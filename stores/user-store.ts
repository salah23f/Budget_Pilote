'use client';

import { create } from 'zustand';

type UserStore = {
  name: string;
  avatar: string;
  unreadNotifications: number;
  currentChain: string;
  setName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setUnreadNotifications: (count: number) => void;
  setCurrentChain: (chain: string) => void;
};

export const useUserStore = create<UserStore>((set) => ({
  name: 'Traveler',
  avatar: '',
  unreadNotifications: 0,
  currentChain: 'Base',
  setName: (name) => set({ name }),
  setAvatar: (avatar) => set({ avatar }),
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  setCurrentChain: (chain) => set({ currentChain: chain }),
}));
