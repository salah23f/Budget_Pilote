'use client';

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

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
  full: 'max-w-full mx-0 my-0 rounded-none h-full',
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
    @keyframes bp-modal-panel-in  { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes bp-modal-panel-out { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.97) translateY(8px); } }
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
      requestAnimationFrame(() => setPhase('enter'));
    } else if (mounted) {
      setPhase('exit');
      const t = setTimeout(() => {
        setMounted(false);
        setPhase('idle');
      }, 180);
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

  const isFullscreen = size === 'full';

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? '' : 'p-4'} ${
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
          'bp-modal-panel relative w-full rounded-2xl shadow-xl',
          'bg-surface-elevated border border-border-default',
          sizeClasses[size],
        ].join(' ')}
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>

        {/* Title */}
        {title && (
          <div className="px-6 pt-6 pb-2 pr-14">
            <h2 className="text-lg font-semibold font-display text-text-primary tracking-tight">
              {title}
            </h2>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="px-6 py-4 text-sm text-text-secondary overflow-y-auto max-h-[80vh]">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-3 border-t border-border-subtle">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
