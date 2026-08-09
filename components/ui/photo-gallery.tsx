'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DestinationPhoto } from '@/lib/destinations-media';

/**
 * PhotoGallery — a swipeable, keyboard-navigable photo strip.
 *
 * Built for the destination cards: real photography, licensed for commercial
 * use, served locally. Attribution rides discreetly in the bottom-right
 * because CC BY / CC BY-SA require it.
 *
 * Interaction budget, in order of priority:
 *   1. Touch  — swipe horizontally (the only affordance most users need).
 *   2. Mouse  — arrows fade in on hover, so the photo stays the hero.
 *   3. Keys   — ←/→ once the strip has focus.
 * Dots are always visible: they answer "how many?" without a click.
 *
 * Only the first photo is `priority`; the rest mount lazily the first time
 * they're shown, then stay mounted so the crossfade has something to fade to.
 */

export type PhotoGalleryProps = {
  photos: DestinationPhoto[];
  /** Responsive sizes hint for next/image. */
  sizes?: string;
  /** Give the first image loading priority (use for above-the-fold heroes). */
  priority?: boolean;
  className?: string;
  /** Accessible name for the whole strip, e.g. "Photos of Kyoto". */
  label?: string;
};

const SWIPE_THRESHOLD = 44; // px — below this it's a tap, not a swipe

export function PhotoGallery({
  photos,
  sizes = '(max-width: 768px) 100vw, 60vw',
  priority = false,
  className = '',
  label = 'Destination photos',
}: PhotoGalleryProps) {
  const [index, setIndex] = useState(0);
  // Photos that have ever been shown — keeps them mounted for the crossfade
  // while avoiding downloading the whole set up front.
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]));
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const count = photos.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      const wrapped = (next + count) % count;
      setIndex(wrapped);
      setMounted((prev) => (prev.has(wrapped) ? prev : new Set(prev).add(wrapped)));
    },
    [count],
  );

  // Reset when the photo set actually changes (e.g. a different destination).
  // Compared by src signature, not array identity: callers routinely pass a
  // freshly-built array (`getPhotos(city)`) on every render, and keying off
  // identity would snap the gallery back to photo 1 continuously.
  const signature = photos.map((p) => p.src).join('|');
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setIndex(0);
    setMounted(new Set([0]));
    setLoaded(new Set());
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Ignore mostly-vertical gestures so page scrolling still works.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? index + 1 : index - 1);
  };

  if (count === 0) return null;

  const current = photos[index];

  // The slides are absolutely positioned, so the root has no intrinsic
  // height: it only gets one from `relative` inside a sized parent, or from
  // the caller positioning it. Emitting `relative` unconditionally fights a
  // caller-supplied `absolute inset-0` — the root then sits in normal flow
  // with no content, collapses to zero, and takes every slide with it.
  const positionedByCaller = /\b(absolute|fixed|sticky)\b/.test(className);

  return (
    <div
      className={`group ${positionedByCaller ? '' : 'relative'} overflow-hidden bg-ink-600 ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Shimmer until the visible photo has decoded */}
      {loaded.has(index) ? null : (
        <div className="absolute inset-0 flyeas-shimmer" aria-hidden />
      )}

      {photos.map((photo, i) =>
        mounted.has(i) ? (
          <div
            key={photo.src}
            className={`absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={i !== index}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={sizes}
              priority={priority && i === 0}
              loading={priority && i === 0 ? undefined : 'lazy'}
              className="object-cover"
              onLoad={() => setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))}
            />
          </div>
        ) : null,
      )}

      {count > 1 && (
        <>
          {/* Arrows — hidden until hover/focus on pointer devices */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full
                       bg-ink-950/80 border border-line-1 text-pen-1 shadow-elev-1 hover:bg-ink-950
                       transition-opacity motion-reduce:transition-none
                       md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full
                       bg-ink-950/80 border border-line-1 text-pen-1 shadow-elev-1 hover:bg-ink-950
                       transition-opacity motion-reduce:transition-none
                       md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {photos.map((photo, i) => (
              <button
                key={photo.src}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full border border-line-1 transition-all motion-reduce:transition-none ${
                  i === index ? 'w-5 bg-ink-950' : 'w-1.5 bg-ink-950/60 hover:bg-ink-950/90'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Attribution — required for CC BY / CC BY-SA, kept deliberately quiet */}
      <span className="absolute bottom-1 right-1.5 text-[9px] leading-none text-pen-2/70 max-w-[70%] truncate pointer-events-none">
        {current.credit} · {current.license}
      </span>

      {/* Screen-reader position announcement */}
      <span className="sr-only" aria-live="polite">
        Photo {index + 1} of {count}
      </span>
    </div>
  );
}

export default PhotoGallery;
