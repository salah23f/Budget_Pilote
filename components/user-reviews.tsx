'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types & Storage                                                     */
/* ------------------------------------------------------------------ */

export interface Review {
  id: string;
  itemId: string;
  itemType: 'flight' | 'hotel';
  rating: number;
  title: string;
  comment: string;
  author: string;
  date: string;
  helpful: number;
}

const STORAGE_KEY = 'flyeas_reviews';

function loadReviews(): Review[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { return []; }
}

function saveReviews(reviews: Review[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews.slice(-200))); } catch (_) {}
}

/* ------------------------------------------------------------------ */
/*  Review list component                                               */
/* ------------------------------------------------------------------ */

interface UserReviewsProps {
  itemId: string;
  itemType: 'flight' | 'hotel';
  itemName: string;
  className?: string;
}

export function UserReviews({ itemId, itemType, itemName, className = '' }: UserReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>(loadReviews);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  const itemReviews = useMemo(() =>
    reviews.filter((r) => r.itemId === itemId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [reviews, itemId]
  );

  const avgRating = itemReviews.length > 0
    ? (itemReviews.reduce((s, r) => s + r.rating, 0) / itemReviews.length).toFixed(1)
    : null;

  function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !comment.trim()) return;

    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('sv_user') : null;
    let authorName = 'Traveler';
    try { if (storedUser) authorName = JSON.parse(storedUser).firstName || 'Traveler'; } catch (_) {}

    const review: Review = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      itemId,
      itemType,
      rating,
      title: title.trim(),
      comment: comment.trim(),
      author: authorName,
      date: new Date().toISOString(),
      helpful: 0,
    };

    const updated = [...reviews, review];
    setReviews(updated);
    saveReviews(updated);
    setShowForm(false);
    setTitle('');
    setComment('');
    setRating(5);
  }

  function markHelpful(reviewId: string) {
    const updated = reviews.map((r) =>
      r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r
    );
    setReviews(updated);
    saveReviews(updated);
  }

  return (
    <div className={`glass rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>⭐</span> Reviews
          </h3>
          {avgRating && (
            <p className="text-[11px] text-white/35 mt-0.5">
              {avgRating}/5 · {itemReviews.length} review{itemReviews.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '✍️ Write Review'}
        </Button>
      </div>

      {/* Review form */}
      {showForm && (
        <form onSubmit={submitReview} className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <label className="text-[10px] text-white/35 font-medium uppercase tracking-wider">Rating</label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-xl transition-transform ${star <= rating ? 'text-amber-400 scale-110' : 'text-white/15'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder="Review title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="glass-input w-full rounded-xl text-sm"
            required
          />
          <textarea
            placeholder="Share your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="glass-input w-full rounded-xl text-sm min-h-[80px] resize-none"
            required
          />
          <Button type="submit" variant="primary" size="sm">Submit Review</Button>
        </form>
      )}

      {/* Reviews list */}
      {itemReviews.length === 0 && !showForm && (
        <p className="text-xs text-white/30 text-center py-4">
          No reviews yet. Be the first to share your experience!
        </p>
      )}

      <div className="space-y-3">
        {itemReviews.map((review) => (
          <div key={review.id} className="rounded-xl p-4 stagger-item" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--flyeas-gradient)' }}>
                  {review.author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium text-white">{review.author}</p>
                  <p className="text-[10px] text-white/25">
                    {new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex text-xs">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < review.rating ? 'text-amber-400' : 'text-white/10'}>★</span>
                ))}
              </div>
            </div>
            <h4 className="text-xs font-semibold text-white mb-1">{review.title}</h4>
            <p className="text-xs text-white/50 leading-relaxed">{review.comment}</p>
            <button
              onClick={() => markHelpful(review.id)}
              className="mt-2 text-[10px] text-white/25 hover:text-white/50 transition"
            >
              👍 Helpful ({review.helpful})
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
