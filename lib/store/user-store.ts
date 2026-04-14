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

  /* Supabase preference sync */
  syncPreferences: (userId: string) => Promise<void>;
  loadPreferences: (userId: string) => Promise<void>;
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

      /* -------------------------------------------------------------- */
      /*  Supabase preference sync                                       */
      /* -------------------------------------------------------------- */

      /**
       * Push the current user preferences to Supabase. Gracefully
       * no-ops if the API is unreachable or Supabase is not configured.
       */
      syncPreferences: async (userId: string) => {
        const { user } = get();
        if (!user?.preferences) return;
        try {
          const res = await fetch('/api/user/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, preferences: user.preferences }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('[user-store] sync preferences failed:', err);
          }
        } catch (err) {
          console.warn('[user-store] sync preferences failed:', err);
        }
      },

      /**
       * Load preferences from Supabase and merge into the current user
       * profile. Remote values overwrite local values. If there is no
       * remote record yet the local preferences are kept as-is.
       */
      loadPreferences: async (userId: string) => {
        try {
          const res = await fetch(
            `/api/user/preferences?userId=${encodeURIComponent(userId)}`
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('[user-store] load preferences failed:', err);
            return;
          }
          const { preferences } = await res.json();
          if (!preferences) return;

          const current = get().user;
          if (current) {
            set({
              user: {
                ...current,
                preferences: { ...current.preferences, ...preferences },
              },
            });
          }
        } catch (err) {
          console.warn('[user-store] load preferences failed:', err);
        }
      },
    }),
    { name: 'sv-user-store' }
  )
);
