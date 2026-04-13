'use client';

import { useFavoritesStore, type FavoriteItem } from '@/lib/store/favorites-store';

interface FavoriteButtonProps {
  item: FavoriteItem;
  size?: 'sm' | 'md';
  className?: string;
}

export function FavoriteButton({ item, size = 'sm', className = '' }: FavoriteButtonProps) {
  const isFav = useFavoritesStore((s) => s.items.some((i) => i.id === item.id));
  const toggle = useFavoritesStore((s) => s.toggle);

  const px = size === 'sm' ? 16 : 20;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
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
