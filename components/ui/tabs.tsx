'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeTab}"]`,
    );
    if (activeEl) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicator({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex gap-1 p-1 rounded-xl glass ${className}`}
      role="tablist"
    >
      {/* Animated indicator */}
      <span
        className="absolute bottom-0 h-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300 ease-out"
        style={{ left: indicator.left, width: indicator.width }}
      />

      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            data-tab-id={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              'relative z-10 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 select-none',
              isActive
                ? 'text-white bg-white/[0.08]'
                : 'text-white/55 hover:text-white/80 hover:bg-white/[0.04]',
            ].join(' ')}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
