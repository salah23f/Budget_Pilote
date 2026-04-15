import './globals.css';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import WalletProvider from '@/components/wallet-provider';
import PWAInstallPrompt from '@/components/pwa-install-prompt';
import { CookieBanner } from '@/components/cookie-banner';
import { WebsiteSchema } from '@/components/structured-data';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700', '800'] });

export const metadata = {
  title: {
    default: 'Flyeas — AI Travel Agent for Flights & Hotels',
    template: '%s | Flyeas',
  },
  description:
    'AI-powered travel agent that monitors live flight and hotel prices 24/7, predicts the best time to buy, and auto-books within your budget.',
  keywords: [
    'travel',
    'flights',
    'hotels',
    'AI',
    'booking',
    'cheap flights',
    'price prediction',
    'auto-buy',
    'travel agent',
    'Flyeas',
  ],
  manifest: '/manifest.json',
  metadataBase: new URL('https://faregenie.vercel.app'),
  openGraph: {
    title: 'Flyeas — AI Travel Agent for Flights & Hotels',
    description: 'AI-powered travel agent that monitors live prices 24/7 and auto-books the best deals.',
    type: 'website',
    siteName: 'Flyeas',
    locale: 'en_US',
    images: [
      {
        url: '/api/og?title=Flyeas%20—%20AI%20Travel%20Agent&subtitle=Find%20the%20cheapest%20flights%20%26%20hotels%20powered%20by%20AI',
        width: 1200,
        height: 630,
        alt: 'Flyeas — AI Travel Agent',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flyeas — AI Travel Agent',
    description: 'AI-powered travel agent that monitors live prices 24/7.',
    images: ['/api/og?title=Flyeas%20—%20AI%20Travel%20Agent'],
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
  themeColor: '#09090B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
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
                background: 'rgba(9, 9, 11, 0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#FAFAF9',
                backdropFilter: 'blur(12px)',
              },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}
