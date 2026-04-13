import { NextResponse } from 'next/server';
import { isAmadeusConfigured } from '@/lib/amadeus/amadeus-real';
import { isKiwiConfigured } from '@/lib/amadeus/kiwi';

export const dynamic = 'force-dynamic';

/**
 * Public status endpoint — reports which real data providers are currently
 * configured. Zero sensitive information exposed.
 */
export async function GET() {
  return NextResponse.json({
    providers: {
      sky_scrapper: {
        configured: !!process.env.RAPIDAPI_KEY,
        purpose: 'Primary: hotels (rock solid) + flights (intermittent)',
      },
      kiwi: {
        configured: isKiwiConfigured(),
        purpose: 'Backup flights via Kiwi.com — free, uses same RAPIDAPI_KEY',
        setup: 'Subscribe to kiwi-com-cheap-flights on RapidAPI',
      },
      amadeus: {
        configured: isAmadeusConfigured(),
        purpose: 'Secondary backup flights (Amadeus Enterprise)',
      },
      claude: {
        configured: !!process.env.ANTHROPIC_API_KEY,
        purpose: 'AI chatbot with real tool use',
      },
    },
    liveData: true,
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    ts: new Date().toISOString(),
  });
}
