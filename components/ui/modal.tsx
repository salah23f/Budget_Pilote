'use client';

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

/* ------------------------------------------------------------------ */
/*  CSS for animations (injected once)                                 */
/* ------------------------------------------------------------------ */

const ANIM_STYLE_ID = 'bp-modal-anim';

function ensureAnimStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(ANIM_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ANIM_STYLE_ID;
  style.textContent = `
    @keyframes bp-modal-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bp-modal-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes bp-modal-panel-in  { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes bp-modal-panel-out { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(10px); } }
    .bp-modal-enter  .bp-modal-backdrop { animation: bp-modal-backdrop-in  0.2s ease-out forwards; }
    .bp-modal-exit   .bp-modal-backdrop { animation: bp-modal-backdrop-out 0.15s ease-in  forwards; }
    .bp-modal-enter  .bp-modal-panel   { animation: bp-modal-panel-in  0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .bp-modal-exit   .bp-modal-panel   { animation: bp-modal-panel-out 0.15s ease-in  forwards; }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [phase, setPhase] = React.useState<'enter' | 'exit' | 'idle'>('idle');

  // Inject animation CSS once
  useEffect(() => ensureAnimStyles(), []);

  // Mount / unmount lifecycle
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Trigger enter on next frame so the DOM is painted first
      requestAnimationFrame(() => setPhase('enter'));
    } else if (mounted) {
      setPhase('exit');
      const t = setTimeout(() => {
        setMounted(false);
        setPhase('idle');
      }, 180); // match exit duration
      return () => clearTimeout(t);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!mounted) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mounted, handleKeyDown]);

  // Prevent body scroll
  useEffect(() => {
    if (mounted) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        phase === 'enter'
          ? 'bp-modal-enter'
          : phase === 'exit'
            ? 'bp-modal-exit'
            : ''
      }`}
    >
      {/* Backdrop */}
      <div
        className="bp-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={[
          'bp-modal-panel relative w-full glass rounded-2xl shadow-2xl',
          sizeClasses[size],
        ].join(' ')}
        role="dialog"
        aria-modal="true"
      >
        {/* Title + close */}
        {title && (
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 text-sm text-white/80">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-3 border-t border-white/[0.07]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
