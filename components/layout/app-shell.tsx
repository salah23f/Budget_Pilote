'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';
import BottomNav from './bottom-nav';
import PageTransition from './page-transition';
import { useUserStore } from '@/stores/user-store';
import { useIdentityStore } from '@/lib/store/identity-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { initializeTheme } from '@/lib/store/theme-store';
import { ChevronUp } from 'lucide-react';

const ChatPanel = lazy(() => import('@/components/chat/chat-panel'));
const CommandPalette = lazy(() => import('@/components/command-palette'));
const SavingsCelebration = lazy(() => import('@/components/savings-celebration').then(m => ({ default: m.SavingsCelebration })));
const OnboardingTutorial = lazy(() => import('@/components/onboarding-tutorial').then(m => ({ default: m.OnboardingTutorial })));
const OfflineBanner = lazy(() => import('@/components/offline-banner').then(m => ({ default: m.OfflineBanner })));

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const setName = useUserStore((s) => s.setName);

  // ── Identity hydration (replaces old sv_user read) ──
  const hydrateIdentity = useIdentityStore((s) => s.hydrate);
  const reconcileIdentity = useIdentityStore((s) => s.reconcile);
  const identity = useIdentityStore((s) => s.identity);
  const hydrateProfile = useProfileStore((s) => s.hydrate);

  useEffect(() => {
    // 1. Hydrate identity from localStorage (instant)
    hydrateIdentity();
    // 2. Hydrate user travel profile from localStorage (instant)
    hydrateProfile();
    // 3. Initialize theme
    initializeTheme();
    // 4. Try server reconcile (async, non-blocking)
    void reconcileIdentity();
  }, [hydrateIdentity, reconcileIdentity, hydrateProfile]);

  // Bridge identity → legacy userStore so existing components get the name
  useEffect(() => {
    if (identity?.firstName) {
      setName(identity.firstName);
    }
  }, [identity?.firstName, setName]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex bg-ink-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-[260px] min-h-screen">
        <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-bottom-nav">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <BottomNav />

      <Suspense fallback={null}>
        <ChatPanel />
        <CommandPalette />
        <SavingsCelebration />
        <OnboardingTutorial />
        <OfflineBanner />
      </Suspense>

      {/* Scroll to top — neutral, no glow */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-24 right-6 z-40 w-10 h-10 rounded-md flex items-center justify-center transition-all duration-200 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          background: 'var(--ink-800)',
          border: '1px solid var(--line-2)',
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-4 h-4 text-pen-2" strokeWidth={2} />
      </button>
    </div>
  );
}
