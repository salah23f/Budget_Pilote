'use client';

import { useState } from 'react';
import { useThemeStore, THEME_PRESETS, type ThemePreset } from '@/lib/store/theme-store';

/**
 * Theme customizer — Revolut-style color picker.
 * Shows preset themes (free/pro/elite gated) + custom color for Elite.
 */
export function ThemeCustomizer({ userTier = 'free' }: { userTier?: 'free' | 'pro' | 'elite' }) {
  const { activeThemeId, customAccent, mode, setTheme, setCustomAccent, toggleMode, getAccent } = useThemeStore();
  const [showCustom, setShowCustom] = useState(false);

  const tierOrder = { free: 0, pro: 1, elite: 2 };
  const userLevel = tierOrder[userTier];

  function canUse(preset: ThemePreset): boolean {
    return tierOrder[preset.tier] <= userLevel;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">App theme</h3>
          <p className="text-xs text-white/40 mt-0.5">Personalize the look of Flyeas</p>
        </div>
        <div
          className="w-8 h-8 rounded-lg"
          style={{ background: useThemeStore.getState().getGradient() }}
        />
      </div>

      {/* Dark / Light mode toggle */}
      <div
        className="flex items-center justify-between p-3 rounded-xl mb-4"
        style={{
          background: mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
          border: mode === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{mode === 'dark' ? '🌙' : '☀️'}</span>
          <span className="text-sm font-medium">{mode === 'dark' ? 'Dark mode' : 'Light mode'}</span>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          className="relative h-7 w-12 rounded-full transition-colors"
          style={{ background: mode === 'light' ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)' }}
        >
          <div
            className="absolute top-1 h-5 w-5 rounded-full bg-white transition-transform shadow-sm"
            style={{ transform: mode === 'light' ? 'translateX(22px)' : 'translateX(4px)' }}
          />
        </button>
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
        {THEME_PRESETS.map((preset) => {
          const locked = !canUse(preset);
          const active = activeThemeId === preset.id && !customAccent;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (locked) return;
                setTheme(preset.id);
              }}
              className={`relative rounded-xl p-1 transition-all ${
                active ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0c0a09]' : ''
              } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
              title={locked ? `${preset.tier.charAt(0).toUpperCase() + preset.tier.slice(1)} plan required` : preset.name}
            >
              <div
                className="w-full aspect-square rounded-lg"
                style={{ background: preset.gradient }}
              />
              <p className="text-[9px] text-white/50 mt-1 text-center truncate">{preset.name}</p>
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/70 font-medium">
                    {preset.tier === 'pro' ? 'Pro' : 'Elite'}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom color picker — Elite only */}
      {userTier === 'elite' ? (
        <div>
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            className="text-xs text-white/40 hover:text-white transition flex items-center gap-1.5"
          >
            <span className="text-sm">🎨</span>
            Custom color
            <span className="text-white/20">{showCustom ? '▲' : '▼'}</span>
          </button>
          {showCustom && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={customAccent || getAccent()}
                onChange={(e) => setCustomAccent(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <div className="flex-1">
                <p className="text-xs text-white/60">Pick any color</p>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">
                  {customAccent || getAccent()}
                </p>
              </div>
              {customAccent && (
                <button
                  type="button"
                  onClick={() => setTheme(activeThemeId)}
                  className="text-[10px] text-white/40 hover:text-white px-2 py-1 rounded border border-white/10"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-white/25 flex items-center gap-1">
          🎨 Custom colors available with Elite plan
        </p>
      )}
    </div>
  );
}
