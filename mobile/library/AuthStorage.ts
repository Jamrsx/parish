import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  user_id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  email?: string;
  username?: string;
  contact_number?: string;
  address?: string;
  role: 'secretary' | 'cashier' | 'priest' | 'parishioner';
  role_label: string;
  last_login?: string;
  created_at?: string;
}

export const authStorage = {
  saveToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  },

  getToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  removeToken: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  saveUser: async (user: AuthUser): Promise<void> => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving user:', error);
    }
  },

  getUser: async (): Promise<AuthUser | null> => {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (userJson) {
        return JSON.parse(userJson);
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  removeUser: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  },

  clearAll: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await authStorage.getToken();
    return token !== null;
  },
};

export default authStorage;