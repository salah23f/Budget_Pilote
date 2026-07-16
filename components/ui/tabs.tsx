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
      className={`relative inline-flex gap-1 p-1 rounded-md bg-ink-900 border border-line-1 ${className}`}
      role="tablist"
    >
      {/* Animated indicator */}
      <span
        className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-300 ease-out"
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
              'relative z-10 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 select-none focus-visible:ring-2 focus-visible:ring-accent/50',
              isActive
                ? 'text-pen-1 bg-ink-700'
                : 'text-pen-3 hover:text-pen-2 hover:bg-ink-600',
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
