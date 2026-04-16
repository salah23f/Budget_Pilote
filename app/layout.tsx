import './globals.css';
import { Inter, Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import { Toaster } from 'sonner';
import WalletProvider from '@/components/wallet-provider';
import PWAInstallPrompt from '@/components/pwa-install-prompt';
import { CookieBanner } from '@/components/cookie-banner';
import { WebsiteSchema } from '@/components/structured-data';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'] });
// Editorial serif — hero headlines, greetings, section intros (see docs/design-system.md §2)
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata = {
  title: {
    default: 'Flyeas — Your travel concierge',
    template: '%s · Flyeas',
  },
  description:
    'Watch flight and hotel prices around the clock. Set a target, let the mission run, book on your terms.',
  keywords: [
    'travel',
    'flights',
    'hotels',
    'concierge',
    'price tracking',
    'travel planner',
    'price alerts',
    'Flyeas',
  ],
  manifest: '/manifest.json',
  metadataBase: new URL('https://faregenie.vercel.app'),
  openGraph: {
    title: 'Flyeas — Your travel concierge',
    description: 'Watch prices around the clock. Book on your terms.',
    type: 'website',
    siteName: 'Flyeas',
    locale: 'en_US',
    images: [
      {
        url: '/api/og?title=Flyeas&subtitle=Your%20travel%20concierge',
        width: 1200,
        height: 630,
        alt: 'Flyeas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flyeas — Your travel concierge',
    description: 'Watch prices around the clock. Book on your terms.',
    images: ['/api/og?title=Flyeas'],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Flyeas',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B0D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${fraunces.variable}`}>
      <head>
        {/* Travelpayouts affiliate verification */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
      var script = document.createElement("script");
      script.async = 1;
      script.src = 'https://emrldtp.com/NTE3OTcw.js?t=517970';
      document.head.appendChild(script);
  })();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <WebsiteSchema />
        <WalletProvider>
          {children}
          <PWAInstallPrompt />
          <CookieBanner />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1D1D22',
                border: '1px solid #252528',
                color: '#F5F5F1',
                borderRadius: '10px',
              },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}
