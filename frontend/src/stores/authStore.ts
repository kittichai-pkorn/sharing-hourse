import { create } from 'zustand';
import api from '../api/client';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  role: 'ADMIN' | 'USER';
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tenantSlug: string, identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

interface RegisterData {
  tenantName: string;
  tenantSlug?: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone: string;
  adminEmail?: string;
  adminPassword: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,

  login: async (tenantSlug, identifier, password, rememberMe = false) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', {
        tenantSlug,
        identifier,
        password,
        rememberMe,
      });

      const { token, user, tenant } = response.data.data;

      localStorage.setItem('token', token);

      set({
        user,
        tenant,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/register', data);
      set({ isLoading: false });
      return {
        success: true,
        message: response.data.message,
      };
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      tenant: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    try {
      const response = await api.get('/users/me');
      const user = response.data.data;
      set({
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        tenant: user.tenant,
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem('token');
      set({
        user: null,
        tenant: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },
}));
