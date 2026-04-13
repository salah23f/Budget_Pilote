import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://faregenie.vercel.app';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/flights`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/hotels`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/missions/new`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/legal/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
