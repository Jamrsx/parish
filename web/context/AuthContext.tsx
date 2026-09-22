/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authStorage, type User, type UserRole, saveAuth, clearAll } from '../library/AuthStorage';
import { authAPI } from '../library/api';

// ============ CONTEXT TYPE ============
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  userRole: UserRole | null;
  
  login: (login: string, password: string) => Promise<{ success: boolean; redirectPath: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  updateUser: (data: Partial<User>) => void;
  checkAuthStatus: () => Promise<void>;
}

// ============ CONTEXT ============
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============ PROVIDER ============
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  /**
   * Check if user is authenticated
   */
  const checkAuthStatus = async (): Promise<void> => {
    try {
      const token = authStorage.getToken();
      
      if (!token) {
        setUser(null);
        setAuthError(null);
        setIsLoading(false);
        return;
      }

      const response = await authAPI.verify();
      
      if (response.data.success) {
        const storedUser = authStorage.getUser();
        if (storedUser) {
          setUser(storedUser);
        }
        setAuthError(null);
      } else {
        clearAll();
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearAll();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial auth check
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Login user - Returns redirect path
   */
  const getLoginErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosErr = error as {
        response?: { data?: { message?: string }; status?: number };
      };
      const apiMessage = axiosErr.response?.data?.message;
      if (apiMessage) return apiMessage;
      if (axiosErr.response?.status === 401) {
        return 'Invalid email/username or password. Please try again.';
      }
      if (axiosErr.response?.status === 403) {
        return 'This account cannot sign in. Please contact the parish office.';
      }
    }
    if (error instanceof Error && error.message && !error.message.includes('status code')) {
      return error.message;
    }
    return 'Login failed. Please try again.';
  };

  const login = async (login: string, password: string): Promise<{ success: boolean; redirectPath: string }> => {
    // Do not toggle global isLoading here — that remounts the login form and hides errors.
    setAuthError(null);

    try {
      const response = await authAPI.webLogin({ login, password });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed');
      }

      const { user, token, role } = response.data.data;

      saveAuth({ token, user, role });
      setUser(user);
      setAuthError(null);

      const redirectPath = authStorage.getRedirectPath(role);

      return { success: true, redirectPath };
    } catch (error: unknown) {
      const message = getLoginErrorMessage(error);
      console.error('Web login failed:', message, error);
      setAuthError(message);
      throw new Error(message);
    }
  };

  /**
   * Logout user
   */
  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAll();
      setUser(null);
      setAuthError(null);
    }
  };

  /**
   * Refresh user profile
   */
  const refreshProfile = async (): Promise<User | null> => {
    try {
      const response = await authAPI.profile();
      
      if (response.data.success) {
        const updatedUser = response.data.data;
        authStorage.updateUser(updatedUser);
        setUser(updatedUser);
        return updatedUser;
      }
      return null;
    } catch (error) {
      console.error('Profile refresh failed:', error);
      return null;
    }
  };

  /**
   * Update user data locally (without API call)
   */
  const updateUser = (data: Partial<User>): void => {
    const updated = authStorage.updateUser(data);
    if (updated) {
      setUser(updated);
    }
  };

  const isAuthenticated = !!user && !!authStorage.getToken();
  const userRole = user?.role || null;

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    authError,
    userRole,
    login,
    logout,
    refreshProfile,
    updateUser,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ============ HOOKS ============
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============ ALIAS FOR ADMIN ============
export const useAdminAuth = useAuth;

export default AuthContext;