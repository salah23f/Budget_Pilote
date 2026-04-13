'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { posts } from '@/lib/blog-data';

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Travel Intelligence
        </h1>
        <p className="text-sm text-white/40 mt-2">
          Data-driven tips, hacks, and guides to save on every trip.
        </p>
      </div>

      {/* Featured post */}
      <Card hoverable padding="none" className="overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="highlight" size="sm">{posts[0].category}</Badge>
            <span className="text-[11px] text-white/30">{posts[0].readTime} read</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-tight">
            {posts[0].title}
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-6 max-w-2xl">
            {posts[0].excerpt}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/blog/${posts[0].slug}`}
              className="premium-button rounded-xl px-5 py-2.5 text-sm font-semibold text-white inline-block"
            >
              Read Article
            </Link>
            <span className="text-xs text-white/25">
              {new Date(posts[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </Card>

      {/* Article grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.slice(1).map((post, i) => (
          <Card key={post.slug} hoverable padding="none" className="overflow-hidden card-interactive stagger-item">
            <div className="p-5">
              {/* Category dot + label */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: post.color }}
                />
                <span className="text-[11px] font-medium" style={{ color: post.color }}>
                  {post.category}
                </span>
                <span className="text-[10px] text-white/25 ml-auto">{post.readTime}</span>
              </div>

              <h3 className="text-sm font-semibold text-white leading-snug mb-2 line-clamp-2">
                {post.title}
              </h3>
              <p className="text-xs text-white/40 leading-relaxed line-clamp-3 mb-4">
                {post.excerpt}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/20">
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-[11px] font-medium text-amber-400/70 hover:text-amber-300 transition-colors"
                >
                  Read →
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Newsletter CTA */}
      <Card padding="lg" className="text-center">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-white mb-2">
            Never miss a deal
          </h3>
          <p className="text-sm text-white/40 mb-5">
            Get weekly travel hacks and exclusive error fares straight to your inbox.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement;
              if (!input?.value) return;
              try {
                const res = await fetch('/api/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: input.value }),
                });
                const data = await res.json();
                if (data.success) {
                  input.value = '';
                  alert('Subscribed! Check your inbox for a welcome email.');
                } else {
                  alert(data.error || 'Subscription failed. Try again.');
                }
              } catch {
                alert('Network error. Please try again.');
              }
            }}
            className="flex gap-2"
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="flex-1 glass-input rounded-xl text-sm"
            />
            <button
              type="submit"
              className="premium-button rounded-xl px-5 py-2.5 text-sm font-semibold text-white flex-shrink-0"
            >
              Subscribe
            </button>
          </form>
          <p className="text-[10px] text-white/20 mt-3">
            Free forever. Unsubscribe anytime. No spam.
          </p>
        </div>
      </Card>
    </div>
  );
}
