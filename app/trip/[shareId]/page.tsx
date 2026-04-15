import { Metadata } from 'next';
import SharedTripClient from './SharedTripClient';

/* ------------------------------------------------------------------ */
/*  Dynamic OG metadata                                                */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: { shareId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareId } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://faregenie.vercel.app';

  try {
    const res = await fetch(`${baseUrl}/api/trips/${shareId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Not found');
    const { tripData } = await res.json();

    const flightCount = tripData.flights?.length || 0;
    const hotelCount = tripData.hotels?.length || 0;
    const total = tripData.totalPrice || 0;
    const dest = tripData.destination || 'Unknown';

    return {
      title: `Trip to ${dest} | Flyeas`,
      description: `Check out this trip: ${flightCount} flight${flightCount !== 1 ? 's' : ''}, ${hotelCount} hotel${hotelCount !== 1 ? 's' : ''} — $${total}`,
      openGraph: {
        title: `Trip to ${dest} | Flyeas`,
        description: `Check out this trip: ${flightCount} flight${flightCount !== 1 ? 's' : ''}, ${hotelCount} hotel${hotelCount !== 1 ? 's' : ''} — $${total}`,
        type: 'website',
        siteName: 'Flyeas',
        images: [
          {
            url: `${baseUrl}/api/og?title=${encodeURIComponent(`Trip to ${dest}`)}&subtitle=${encodeURIComponent(`${flightCount} flights, ${hotelCount} hotels — $${total}`)}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Trip to ${dest} | Flyeas`,
        description: `Check out this trip: ${flightCount} flight${flightCount !== 1 ? 's' : ''}, ${hotelCount} hotel${hotelCount !== 1 ? 's' : ''} — $${total}`,
      },
    };
  } catch (_) {
    return {
      title: 'Shared Trip | Flyeas',
      description: 'Check out this trip on Flyeas',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function SharedTripPage({ params }: PageProps) {
  const { shareId } = params;
  return <SharedTripClient shareId={shareId} />;
}
