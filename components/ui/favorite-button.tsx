'use client';

import { useCallback } from 'react';
import { useFavoritesStore, type FavoriteItem } from '@/lib/store/favorites-store';

interface FavoriteButtonProps {
  item: FavoriteItem;
  size?: 'sm' | 'md';
  className?: string;
}

export function FavoriteButton({ item, size = 'sm', className = '' }: FavoriteButtonProps) {
  // Subscribe to the full items array to ensure re-render on changes
  const items = useFavoritesStore((s) => s.items);
  const isFav = items.some((i) => i.id === item.id);
  const toggle = useFavoritesStore((s) => s.toggle);
  const remove = useFavoritesStore((s) => s.remove);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFav) {
      // Use remove with just the ID to avoid object comparison issues
      remove(item.id);
    } else {
      toggle(item);
    }
  }, [isFav, item, toggle, remove]);

  const px = size === 'sm' ? 16 : 20;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`favorite-btn ${isFav ? 'active' : ''} ${className}`}
      title={isFav ? 'Remove from favorites' : 'Save to favorites'}
      aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill={isFav ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </button>
  );
}
