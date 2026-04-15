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
  const [showScrollTop, setShowScrollTop] = useState(false);
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

  // Show scroll-to-top button when scrolled down
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

      {/* Scroll to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-24 right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
        style={{
          background: 'linear-gradient(135deg, #F59E0B, #F97316)',
          boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
          opacity: showScrollTop ? 1 : 0,
          pointerEvents: showScrollTop ? 'auto' : 'none',
          transform: showScrollTop ? 'translateY(0)' : 'translateY(16px)',
        }}
        aria-label="Scroll to top"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 15L12 9L6 15" />
        </svg>
      </button>
    </div>
  );
}
