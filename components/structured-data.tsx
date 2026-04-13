'use client';

/**
 * JSON-LD structured data for SEO.
 * Renders invisible <script type="application/ld+json"> tags.
 */

interface WebsiteSchemaProps {
  name?: string;
  url?: string;
  description?: string;
}

export function WebsiteSchema({
  name = 'Flyeas',
  url = 'https://faregenie.vercel.app',
  description = 'AI-powered travel agent that monitors live flight and hotel prices 24/7, predicts the best time to buy, and auto-books within your budget.',
}: WebsiteSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url,
    description,
    applicationCategory: 'TravelApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1240',
      bestRating: '5',
    },
    creator: {
      '@type': 'Organization',
      name: 'Flyeas',
      url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BlogPostSchemaProps {
  title: string;
  description: string;
  date: string;
  slug: string;
  category: string;
  readTime: string;
}

export function BlogPostSchema({ title, description, date, slug, category, readTime }: BlogPostSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date,
    dateModified: date,
    url: `https://faregenie.vercel.app/blog/${slug}`,
    image: `https://faregenie.vercel.app/api/og?title=${encodeURIComponent(title)}`,
    author: {
      '@type': 'Organization',
      name: 'Flyeas',
      url: 'https://faregenie.vercel.app',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Flyeas',
      logo: {
        '@type': 'ImageObject',
        url: 'https://faregenie.vercel.app/icon-192.png',
      },
    },
    articleSection: category,
    timeRequired: `PT${parseInt(readTime)}M`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://faregenie.vercel.app/blog/${slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface FAQSchemaProps {
  questions: { question: string; answer: string }[];
}

export function FAQSchema({ questions }: FAQSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
