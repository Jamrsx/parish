const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
  ROLE: 'auth_role',
} as const;

export type UserRole = 'secretary' | 'cashier' | 'priest' | 'parishioner';

export interface User {
  user_id: number;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  full_name: string;
  email: string;
  username?: string | null;
  contact_number?: string | null;
  address?: string | null;
  role: UserRole;
  role_label: string;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthData {
  token: string;
  user: User;
  role: UserRole;
}

class AuthStorage {
  /**
   * Save authentication data
   */
  saveAuth(data: AuthData): void {
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
    localStorage.setItem(STORAGE_KEYS.ROLE, data.role);
  }

  /**
   * Get the authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  /**
   * Get the authenticated user
   */
  getUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Get the user's role
   */
  getRole(): UserRole | null {
    const role = localStorage.getItem(STORAGE_KEYS.ROLE);
    if (!role) return null;
    return role as UserRole;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: UserRole | UserRole[]): boolean {
    const userRole = this.getRole();
    if (!userRole) return false;
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  }

  /**
   * Check if user is an admin (secretary or cashier)
   */
  isAdmin(): boolean {
    return this.hasRole(['secretary', 'cashier']);
  }

  /**
   * Update user data
   */
  updateUser(user: Partial<User>): User | null {
    const currentUser = this.getUser();
    if (!currentUser) return null;
    const updatedUser = { ...currentUser, ...user };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    return updatedUser;
  }

  /**
   * Clear all authentication data
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ROLE);
  }

  /**
   * Get the redirect path based on user role
   */
  getRedirectPath(role: UserRole): string {
    switch (role) {
      case 'secretary':
        return '/admin/secretary/dashboard';
      case 'cashier':
        return '/admin/cashier/dashboard';
      case 'priest':
        return '/priest/PriestHomePage';
      case 'parishioner':
        return '/parishioner/ParishionerHomePage';
      default:
        return '/login';
    }
  }

  /**
   * Get the home path for a role
   */
  getHomePath(role: UserRole): string {
    return this.getRedirectPath(role);
  }
}

// Export a singleton instance
export const authStorage = new AuthStorage();

// Export individual functions for convenience
export const {
  saveAuth,
  getToken,
  getUser,
  getRole,
  isAuthenticated,
  hasRole,
  isAdmin,
  updateUser,
  clearAll,
  getRedirectPath,
  getHomePath,
} = authStorage;