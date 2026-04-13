'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ShareDealCardProps {
  type: 'flight' | 'hotel';
  title: string;
  price: number;
  details: string;
  url?: string;
}

export function ShareDealCard({ type, title, price, details, url }: ShareDealCardProps) {
  const [shared, setShared] = useState(false);

  const shareText = `${type === 'flight' ? '✈️' : '🏨'} ${title} — $${price} ${details}\n\nFound on Flyeas`;
  const shareUrl = url || 'https://faregenie.vercel.app';

  async function handleShare(method: 'native' | 'copy' | 'twitter' | 'whatsapp') {
    switch (method) {
      case 'native':
        if (navigator.share) {
          try {
            await navigator.share({ title, text: shareText, url: shareUrl });
            setShared(true);
          } catch {}
        }
        break;
      case 'copy':
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
          '_blank'
        );
        break;
    }
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{
            background: type === 'flight' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
          }}
        >
          {type === 'flight' ? '✈️' : '🏨'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{title}</p>
          <p className="text-xs text-white/40">{details}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-amber-400">${price}</p>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        {typeof navigator !== 'undefined' && navigator.share && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleShare('native')}
            className="flex-1"
          >
            📤 Share
          </Button>
        )}
        <button
          onClick={() => handleShare('copy')}
          className="flex-1 glass rounded-xl px-3 py-2 text-xs font-medium text-white/60 hover:text-white transition"
        >
          {shared ? '✓ Copied!' : '🔗 Copy'}
        </button>
        <button
          onClick={() => handleShare('twitter')}
          className="glass rounded-xl px-3 py-2 text-xs font-medium text-white/60 hover:text-white transition"
        >
          𝕏
        </button>
        <button
          onClick={() => handleShare('whatsapp')}
          className="glass rounded-xl px-3 py-2 text-xs font-medium text-white/60 hover:text-white transition"
        >
          💬
        </button>
      </div>
    </div>
  );
}
