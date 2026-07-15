import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../library/api';
import type { User } from '../library/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null; 
  login: (login: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getUserRequests: () => Promise<any>;
  getUserStatistics: () => Promise<any>;
  isParishioner: boolean;
}

interface RegisterData {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  contact_number?: string;
  address?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null); 
  const authCheckDone = useRef(false);

  const isParishioner = user?.role === 'parishioner';

  // LOGOUT
  const logout = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null); 
    try {
      await api.logout();
      setUser(null);
      setIsAuthenticated(false);
      authCheckDone.current = false;
    } catch (error) {
      console.error('Logout failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      authCheckDone.current = false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // CHECK AUTH STATUS
  const checkAuthStatus = useCallback(async () => {
    if (authCheckDone.current) return;

    setIsLoading(true);
    setAuthError(null); 

    try {
      const token = await AsyncStorage.getItem('auth_token');

      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        authCheckDone.current = true;
        return;
      }

      const verifyResponse = await api.verify();

      if (verifyResponse.success) {
        const profileResponse = await api.profile();
        
        if (profileResponse.success && profileResponse.data) {
          if (profileResponse.data.role === 'parishioner') {
            setUser(profileResponse.data);
            setIsAuthenticated(true);
            setAuthError(null); 
          } else {
            setAuthError('This account is not authorized for this app'); 
            await api.removeToken();
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          await api.removeToken();
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        await api.removeToken();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error: any) {
      if (error?.status === 401) {
        setAuthError('Session expired. Please login again.');
      } else {
        setAuthError('Connection error. Please try again.');
      }
      
      if (__DEV__) {
        console.error('Auth check error:', error);
      }
      
      await api.removeToken();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      authCheckDone.current = true;
    }
  }, []);

  // REFRESH PROFILE
  const refreshProfile = useCallback(async () => {
    try {
      const response = await api.profile();
      if (response.success && response.data) {
        if (response.data.role === 'parishioner') {
          setUser(response.data);
          setAuthError(null); 
        } else {
          await logout();
        }
      }
    } catch (error) {
      console.error('Profile refresh failed:', error);
    }
  }, [logout]);

  // LOGIN
  const login = useCallback(async (loginField: string, password: string) => {
    setIsLoading(true);
    setAuthError(null); 
    try {
      const response = await api.login(loginField, password);
      
      if (response.success && response.data.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        authCheckDone.current = true;
        setAuthError(null); 
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error: any) {
      setAuthError('Invalid email/username or password'); 
      throw new Error('Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // REGISTER
  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await api.register(data);
      
      if (response.success && response.data.token) {
        await AsyncStorage.setItem('auth_token', response.data.token);
        
        if (response.data.user) {
          setUser(response.data.user);
          setIsAuthenticated(true);
          authCheckDone.current = true;
          setAuthError(null); 
        }
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch {
      setAuthError('Registration failed. Please try again.'); 
      throw new Error('Registration failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // UPDATE USER
  const updateUser = useCallback(async (userData: User) => {
    console.log('AuthContext updateUser:', userData.full_name || userData.first_name);
    setUser(userData);
  }, []);

  // GET USER REQUESTS
  const getUserRequests = useCallback(async () => {
    try {
      const response = await api.getUserRequests();
      return response;
    } catch (error) {
      console.error('Failed to get requests:', error);
      throw error;
    }
  }, []);

  // GET USER STATISTICS
  const getUserStatistics = useCallback(async () => {
    try {
      const response = await api.getUserStatistics();
      return response;
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }, []);

  // CHECK AUTH ON APP START
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // PROVIDER VALUE
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        authError, 
        login,
        register,
        logout,
        updateUser,
        checkAuthStatus,
        refreshProfile,
        getUserRequests,
        getUserStatistics,
        isParishioner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// USE AUTH HOOK
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};