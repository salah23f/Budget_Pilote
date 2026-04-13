'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';
import BottomNav from './bottom-nav';
import PageTransition from './page-transition';
import { useUserStore } from '@/stores/user-store';
import { initializeTheme } from '@/lib/store/theme-store';

// Lazy-load heavy components for faster initial page load
const ChatPanel = lazy(() => import('@/components/chat/chat-panel'));
const SavingsCelebration = lazy(() => import('@/components/savings-celebration').then(m => ({ default: m.SavingsCelebration })));
const OnboardingTutorial = lazy(() => import('@/components/onboarding-tutorial').then(m => ({ default: m.OnboardingTutorial })));

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setName = useUserStore((s) => s.setName);

  // Load user name from localStorage + initialize theme
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.firstName) setName(user.firstName);
      }
    } catch {}
    initializeTheme();
  }, [setName]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — hidden on mobile, replaced by bottom nav */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:ml-[240px] min-h-screen">
        <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 p-4 lg:p-6 pb-bottom-nav">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav />

      {/* Lazy-loaded overlays — code-split for faster initial load */}
      <Suspense fallback={null}>
        <ChatPanel />
        <SavingsCelebration />
        <OnboardingTutorial />
      </Suspense>
    </div>
  );
}
