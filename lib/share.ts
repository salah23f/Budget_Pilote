/**
 * Share utility — Web Share API with clipboard fallback.
 *
 * Every shared deal is a potential new user. This is the viral loop.
 */

export interface ShareDealParams {
  origin: string;
  destination: string;
  price: number;
  airline?: string;
  date?: string;
  url?: string;
}

export async function shareDeal(params: ShareDealParams): Promise<boolean> {
  const title = `${params.origin} → ${params.destination} · $${params.price}`;
  const text = `I found a $${params.price} flight from ${params.origin} to ${params.destination}${
    params.airline ? ` on ${params.airline}` : ''
  }${params.date ? ` (${params.date})` : ''} with Flyeas!`;
  const url = params.url || 'https://faregenie.vercel.app';

  // Try native Web Share API first (mobile + some desktop)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err: any) {
      // User cancelled the share dialog — not an error
      if (err?.name === 'AbortError') return false;
    }
  }

  // Fallback: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return true;
    } catch {}
  }

  return false;
}
