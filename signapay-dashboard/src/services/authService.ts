import { User } from '../types';

const AUTH_KEY = 'dashboard_user';

export const authService = {
  login: async (username: string, password: string): Promise<user |="" null=""> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simple mock auth (user/pass: admin/password)
    if (username === 'admin' && password === 'password') {
      const user: User = { id: '1', username };
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.reload();
  }
};
