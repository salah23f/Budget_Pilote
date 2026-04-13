import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, Notification } from '../types';

interface UserState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  notifications: Notification[];
  unreadCount: number;
  name: string;
  unreadNotifications: number;
  currentChain: string;
  setUser: (user: UserProfile | null) => void;
  updateUser: (partial: Partial<UserProfile>) => void;
  logout: () => void;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setCurrentChain: (chain: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      notifications: [],
      unreadCount: 0,
      name: 'Traveler',
      unreadNotifications: 0,
      currentChain: 'Base',

      setUser: (user) => {
        const name = user ? `${user.firstName} ${user.lastName}`.trim() || 'Traveler' : 'Traveler';
        set({ user, isAuthenticated: !!user, name });
      },

      updateUser: (partial) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...partial } });
        }
      },

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          notifications: [],
          unreadCount: 0,
        }),

      setNotifications: (notifications) => {
        const count = notifications.filter((n) => !n.read).length;
        set({ notifications, unreadCount: count, unreadNotifications: count });
      },

      addNotification: (notification) => {
        const current = get().notifications;
        const inc = notification.read ? 0 : 1;
        set({
          notifications: [notification, ...current],
          unreadCount: get().unreadCount + inc,
          unreadNotifications: get().unreadNotifications + inc,
        });
      },

      markAsRead: (id) => {
        const notifications = get().notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        });
      },

      markAllAsRead: () => {
        const notifications = get().notifications.map((n) => ({
          ...n,
          read: true,
        }));
        set({ notifications, unreadCount: 0, unreadNotifications: 0 });
      },

      setCurrentChain: (chain) => set({ currentChain: chain }),
    }),
    { name: 'sv-user-store' }
  )
);
