import { create } from 'zustand';
import api from '../api/client';

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  referenceId: number | null;
  referenceType: string | null;
  createdAt: string;
  readAt: string | null;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isOpen: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  setOpen: (open: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isOpen: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/notifications');
      set({
        notifications: response.data.data,
        unreadCount: response.data.unreadCount,
        isLoading: false,
      });
    } catch (error) {
      console.error('Fetch notifications error:', error);
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      set({ unreadCount: response.data.data.unreadCount });
    } catch (error) {
      console.error('Fetch unread count error:', error);
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  },

  deleteNotification: async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      const notification = get().notifications.find((n) => n.id === id);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  },

  setOpen: (open: boolean) => {
    set({ isOpen: open });
    if (open) {
      get().fetchNotifications();
    }
  },
}));
