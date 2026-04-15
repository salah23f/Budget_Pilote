'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';
import BottomNav from './bottom-nav';
import PageTransition from './page-transition';
import { useUserStore } from '@/stores/user-store';
import { initializeTheme } from '@/lib/store/theme-store';
import { ChevronUp } from 'lucide-react';

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
      <div className="flex-1 flex flex-col lg:ml-[260px] min-h-screen">
        <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-bottom-nav">
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
        className={`fixed bottom-24 right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-accent-light to-accent-dark shadow-glow transition-all duration-300 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
