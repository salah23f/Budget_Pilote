'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPostBySlug, posts } from '@/lib/blog-data';
import { BlogPostSchema } from '@/components/structured-data';

export default function BlogArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Article not found</h1>
        <p className="text-white/40 mb-6">The article you are looking for does not exist.</p>
        <Link href="/blog">
          <Button variant="primary">Back to Blog</Button>
        </Link>
      </div>
    );
  }

  // Find related posts (same category, excluding current)
  const related = posts
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => (a.category === post.category ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8 space-y-8">
      {/* SEO structured data */}
      <BlogPostSchema
        title={post.title}
        description={post.excerpt}
        date={post.date}
        slug={post.slug}
        category={post.category}
        readTime={post.readTime}
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-white/30">
        <Link href="/blog" className="hover:text-amber-400 transition-colors">
          Blog
        </Link>
        <span>/</span>
        <span className="text-white/50 truncate">{post.title}</span>
      </div>

      {/* Article header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Badge
            variant="highlight"
            size="sm"
            className="!border-0"
            style={{ background: `${post.color}20`, color: post.color } as React.CSSProperties}
          >
            {post.category}
          </Badge>
          <span className="text-xs text-white/30">{post.readTime} read</span>
          <span className="text-xs text-white/20">·</span>
          <span className="text-xs text-white/30">
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight mb-4">
          {post.title}
        </h1>

        <p className="text-base text-white/50 leading-relaxed">
          {post.excerpt}
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/6" />

      {/* Article content */}
      <article className="space-y-5">
        {post.content.map((paragraph, i) => {
          // Heading
          if (paragraph.startsWith('## ')) {
            return (
              <h2
                key={i}
                className="text-lg font-semibold text-white mt-8 mb-2 flex items-center gap-2"
              >
                <span
                  className="w-1 h-5 rounded-full"
                  style={{ background: post.color }}
                />
                {paragraph.replace('## ', '')}
              </h2>
            );
          }
          // Regular paragraph
          return (
            <p key={i} className="text-[15px] text-white/60 leading-relaxed">
              {paragraph}
            </p>
          );
        })}
      </article>

      {/* CTA */}
      <Card padding="lg" className="text-center mt-12">
        <div className="max-w-sm mx-auto">
          <div className="text-3xl mb-3">Flyeas</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Ready to save on your next trip?
          </h3>
          <p className="text-sm text-white/40 mb-5">
            Set up an AI price mission and let Flyeas find the best deals for you automatically.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/flights">
              <Button variant="primary" size="md">Search Flights</Button>
            </Link>
            <Link href="/missions/new">
              <Button variant="secondary" size="md">Create Mission</Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Share */}
      <div className="flex items-center justify-between py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs text-white/30">Share this article</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const url = window.location.href;
              const text = `${post.title} — ${post.excerpt}`;
              if (navigator.share) {
                navigator.share({ title: post.title, text, url });
              } else {
                navigator.clipboard.writeText(url);
                alert('Link copied!');
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs glass text-white/50 hover:text-white transition"
          >
            🔗 Copy Link
          </button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs glass text-white/50 hover:text-white transition"
          >
            𝕏 Tweet
          </a>
        </div>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">More articles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="glass rounded-xl p-4 group card-interactive"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                  <span className="text-[10px] font-medium" style={{ color: r.color }}>
                    {r.category}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-amber-300 transition-colors">
                  {r.title}
                </h4>
                <p className="text-[10px] text-white/25 mt-2">{r.readTime}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
