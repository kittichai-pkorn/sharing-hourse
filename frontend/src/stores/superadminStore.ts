import { create } from 'zustand';
import { superadminApi } from '../api/client';

interface SuperAdmin {
  id: number;
  email: string;
}

interface SuperAdminState {
  superAdmin: SuperAdmin | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useSuperAdminStore = create<SuperAdminState>((set) => ({
  superAdmin: null,
  token: localStorage.getItem('superadmin_token'),
  isAuthenticated: !!localStorage.getItem('superadmin_token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await superadminApi.post('/login', { email, password });
      const { token, user } = response.data.data;

      localStorage.setItem('superadmin_token', token);

      set({
        superAdmin: user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  },

  logout: () => {
    localStorage.removeItem('superadmin_token');
    set({
      superAdmin: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('superadmin_token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    try {
      const response = await superadminApi.get('/me');
      set({
        superAdmin: response.data.data,
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem('superadmin_token');
      set({
        superAdmin: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },
}));
