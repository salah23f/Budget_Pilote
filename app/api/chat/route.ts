import { NextRequest, NextResponse } from 'next/server';
import { searchHotels, resolveHotelDestination } from '@/lib/amadeus/hotels';
import { searchFlights, searchAirportsLive } from '@/lib/amadeus/flights';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Flyeas chatbot.
 *
 * Uses Anthropic Claude (if ANTHROPIC_API_KEY is set) with tool-use so the
 * model can actually hit our live flight/hotel search endpoints to answer
 * with real data. Falls back to a rule-based responder that still calls the
 * real APIs for price data — never invents numbers.
 */

/* ---------------- Tool definitions ---------------- */

const TOOLS = [
  {
    name: 'search_flights',
    description:
      'Search for real flights between two cities/airports on a specific date. Returns actual live prices from Sky-Scrapper. Use this whenever the user asks about flight prices, routes, or options.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Origin city or airport (e.g. "Paris", "CDG", "New York")' },
        destination: { type: 'string', description: 'Destination city or airport' },
        departDate: { type: 'string', description: 'Departure date in YYYY-MM-DD format' },
        returnDate: { type: 'string', description: 'Optional return date in YYYY-MM-DD format' },
        adults: { type: 'number', description: 'Number of adult passengers (default 1)' },
        cabinClass: {
          type: 'string',
          enum: ['economy', 'premium_economy', 'business', 'first'],
          description: 'Cabin class (default economy)',
        },
      },
      required: ['origin', 'destination', 'departDate'],
    },
  },
  {
    name: 'search_hotels',
    description:
      'Search for real hotels in a city or area on specific dates. Returns actual live prices with photos, addresses and guest ratings. Use this whenever the user asks about hotel prices or availability.',
    input_schema: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'City, neighborhood, or specific hotel name' },
        checkIn: { type: 'string', description: 'Check-in date in YYYY-MM-DD format' },
        checkOut: { type: 'string', description: 'Check-out date in YYYY-MM-DD format' },
        guests: { type: 'number', description: 'Number of guests (default 2)' },
        rooms: { type: 'number', description: 'Number of rooms (default 1)' },
      },
      required: ['destination', 'checkIn', 'checkOut'],
    },
  },
];

/* ---------------- Tool implementations ---------------- */

async function runTool(name: string, input: any): Promise<any> {
  try {
    if (name === 'search_flights') {
      const offers = await searchFlights({
        origin: input.origin,
        destination: input.destination,
        departDate: input.departDate,
        returnDate: input.returnDate,
        adults: input.adults || 1,
        cabinClass: (input.cabinClass as any) || 'economy',
      });
      const top = offers.slice(0, 8).map((o) => ({
        airline: o.airline,
        flightNumber: o.flightNumber,
        departure: o.departureTime,
        arrival: o.arrivalTime,
        durationMinutes: o.durationMinutes,
        stops: o.stops,
        priceUsd: o.priceUsd,
        carbonKg: o.carbonKg,
        from: (o.rawData as any)?.originIata,
        to: (o.rawData as any)?.destinationIata,
      }));
      if (top.length === 0) return { error: 'No flights found for this route and date.' };
      const minPrice = Math.min(...top.map((t) => t.priceUsd));
      const avgPrice = Math.round(top.reduce((s, t) => s + t.priceUsd, 0) / top.length);
      return { count: offers.length, cheapest: minPrice, average: avgPrice, offers: top };
    }
    if (name === 'search_hotels') {
      const dest = await resolveHotelDestination(input.destination);
      if (!dest) return { error: `Could not find destination "${input.destination}"` };
      const offers = await searchHotels({
        cityCode: input.destination,
        entityId: dest.entityId,
        query: input.destination,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.guests || 2,
        rooms: input.rooms || 1,
      } as any);
      const top = offers.slice(0, 8).map((o) => ({
        name: o.hotelName,
        stars: o.hotelRating,
        pricePerNight: (o.rawData as any)?.pricePerNight,
        totalPrice: o.priceUsd,
        guestRating: (o.rawData as any)?.guestRating,
        reviewCount: (o.rawData as any)?.reviewCount,
        address: (o.rawData as any)?.address,
        partner: (o.rawData as any)?.cheapestOfferPartnerName,
      }));
      if (top.length === 0) return { error: 'No hotels found for this destination and dates.' };
      const minPrice = Math.min(...top.map((t) => t.totalPrice));
      return { destination: dest.entityName, count: offers.length, cheapest: minPrice, hotels: top };
    }
  } catch (err: any) {
    return { error: err.message || 'Tool call failed' };
  }
  return { error: `Unknown tool: ${name}` };
}

/* ---------------- Claude loop ---------------- */

const SYSTEM_PROMPT = `You are **Flyeas**, an AI travel agent. You help users find real flights and hotels worldwide at the best prices.

Rules you MUST follow:
- NEVER invent prices, flight numbers, hotel names or availability. If you need pricing info, call the tools.
- All pricing you mention must come from the tool results. Do not estimate or guess.
- Be concise and friendly. Use markdown with **bold** for key numbers and bullets for lists.
- When asked about best time to book, give balanced, honest advice: flight prices fluctuate and no one can guarantee they will go up or down.
- If the user mentions a budget, do NOT tell them what "you should spend" — just search within their constraints and present real options.
- For flights: always call search_flights when the user provides or implies origin + destination + date.
- For hotels: always call search_hotels when the user provides or implies destination + dates.
- If dates are missing, ask briefly. Default to 30 days from now if the user says "soon" or similar.
- If an upstream search fails, tell the user honestly and suggest trying a nearby alternative.
- After presenting results, offer 2-3 next-step quick actions at the end.

Today's date is ${new Date().toISOString().split('T')[0]}.`;

async function callClaude(messages: any[], history: any[]): Promise<{ text: string; used_tools: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('NO_ANTHROPIC_KEY');

  const baseMessages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    ...messages,
  ];

  let loopMessages = baseMessages;
  let usedTools = false;

  for (let step = 0; step < 4; step++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: loopMessages,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();

    const toolUses = (data.content || []).filter((c: any) => c.type === 'tool_use');
    const textBlocks = (data.content || []).filter((c: any) => c.type === 'text');

    if (toolUses.length === 0) {
      // Final answer
      const text = textBlocks.map((t: any) => t.text).join('\n').trim();
      return { text, used_tools: usedTools };
    }

    usedTools = true;
    // Run tools and feed results back
    const toolResults = await Promise.all(
      toolUses.map(async (tu: any) => {
        const result = await runTool(tu.name, tu.input);
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        };
      })
    );

    loopMessages = [
      ...loopMessages,
      { role: 'assistant', content: data.content },
      { role: 'user', content: toolResults },
    ];
  }

  return { text: "I gathered the information but couldn't finalize a response. Please try again.", used_tools: usedTools };
}

/* ---------------- Rule-based fallback (no API key) ---------------- */

// Words that should never end up inside a captured city name. When the regex
// lazily captures a run of characters that happens to include one of these,
// we trim at that boundary. Also used as a prefix stripper ("Flight Paris…").
const NOISE_WORDS = [
  'flight', 'flights', 'fly', 'plane', 'vol', 'vols',
  'hotel', 'hotels', 'stay', 'stays', 'room', 'rooms',
  'cheap', 'cheapest', 'find', 'book', 'search', 'show',
  'me', 'a', 'an', 'the', 'some',
  'next', 'last', 'this', 'tomorrow', 'today',
  'on', 'for', 'with', 'under', 'around',
  'trip', 'travel',
];

const CITY_STOP = new Set(NOISE_WORDS);

function cleanCity(raw?: string): string | undefined {
  if (!raw) return undefined;
  const words = raw.trim().split(/\s+/);
  const kept: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    // Stop at any noise word or date/number token
    if (CITY_STOP.has(lower)) break;
    if (/^\d/.test(w)) break;
    kept.push(w);
    // Cities are usually 1-3 words max (e.g. "New York", "Los Angeles")
    if (kept.length >= 3) break;
  }
  // Also strip leading noise words (e.g. "Flight Paris" → "Paris")
  while (kept.length > 0 && CITY_STOP.has(kept[0].toLowerCase())) {
    kept.shift();
  }
  const out = kept.join(' ').trim();
  return out || undefined;
}

function extractCities(message: string): { origin?: string; destination?: string; dates?: string[] } {
  const dates = message.match(/\b(\d{4}-\d{2}-\d{2})\b/g) || [];

  // Pattern A: "X to Y" or "X -> Y" — grabs both origin and destination
  const routeMatch = message.match(
    /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?)\s+(?:to|->|→|vers|à)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?)(?:\s|,|\.|\?|$)/i
  );
  if (routeMatch) {
    return {
      origin: cleanCity(routeMatch[1]),
      destination: cleanCity(routeMatch[2]),
      dates,
    };
  }

  // Pattern B: "to X from Y" — reversed order (common in casual speech)
  const reversedMatch = message.match(
    /\bto\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?)\s+from\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?)(?:\s|,|\.|\?|$)/i
  );
  if (reversedMatch) {
    return {
      origin: cleanCity(reversedMatch[2]),
      destination: cleanCity(reversedMatch[1]),
      dates,
    };
  }

  // Pattern C: "Hotels in <city>", "flight to <city>", "in paris"
  const inMatch = message.match(
    /\b(?:in|to|at|for)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30}?)(?:\s|,|\.|\?|$)/i
  );
  if (inMatch) {
    return { destination: cleanCity(inMatch[1]), dates };
  }

  // Pattern D: just a well-known city mentioned
  const cityMatch = message.match(
    /\b(Paris|London|Tokyo|New York|Barcelona|Rome|Madrid|Berlin|Dubai|Bangkok|Istanbul|Amsterdam|Lisbon|Vienna|Prague|Athens|Budapest|Copenhagen|Stockholm|Oslo|Helsinki|Edinburgh|Dublin|Reykjavik|Singapore|Seoul|Hong Kong|Shanghai|Beijing|Sydney|Melbourne|Auckland|Mumbai|Delhi|Cairo|Marrakech|Cape Town|Nairobi|Lagos|Mexico City|Buenos Aires|Rio de Janeiro|Sao Paulo|Lima|Bogota|Santiago|Toronto|Vancouver|Montreal|Los Angeles|San Francisco|Chicago|Miami|Boston|Seattle|Las Vegas|Washington|Bali|Phuket|Maldives|Cancun|Honolulu|Nice|Cannes|Marseille|Lyon|Bordeaux|Geneva|Zurich|Munich|Frankfurt|Hamburg|Brussels|Milan|Florence|Venice|Naples|Tunis|Casablanca)\b/i
  );
  if (cityMatch) {
    return { destination: cityMatch[1], dates };
  }

  return { dates };
}

function defaultDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

async function ruleBasedResponse(
  message: string
): Promise<{ text: string; quickActions?: string[]; cards?: any[] }> {
  const lower = message.toLowerCase();
  const { origin, destination, dates } = extractCities(message);

  // Quick greetings
  if (/^(hi|hello|hey|bonjour|salut|yo)[\s!?.]*$/i.test(message.trim())) {
    return {
      text: `Hi! I'm **Flyeas** — your AI travel agent.\n\nI search **real live prices** for any route worldwide.\n\nTry asking:\n- "Paris to Tokyo on 2026-07-15"\n- "Find hotels in Barcelona next month"\n- "Cheap flight from London to New York"`,
      quickActions: ['Paris → Tokyo', 'Hotels in Barcelona', 'How it works'],
    };
  }

  if (/\bhow.*work|what can you do|help\b/i.test(lower)) {
    return {
      text: `**What I can do:**\n\n- **Search live flights** — real prices from Sky-Scrapper\n- **Find real hotels** — with photos, addresses, ratings\n- **Compare options** by price, duration, carbon, stops\n- **Set up an AI Mission** — I monitor 24/7 and auto-book when your budget is hit\n\nJust tell me where and when. I don't invent prices — everything comes from live APIs.`,
      quickActions: ['Find a flight', 'Find a hotel', 'Create a mission'],
    };
  }

  // Flight search intent
  if (/\b(flights?|fly|plane|airline|vols?|avion)\b/.test(lower) && destination) {
    const o = origin || 'Paris';
    const departDate = dates?.[0] || defaultDate(30);
    const result = await runTool('search_flights', { origin: o, destination, departDate, adults: 1 });
    if (result.error) {
      return {
        text: `I tried to search **${o} → ${destination}** on ${departDate} but: ${result.error}\n\nTry a different route or date.`,
        quickActions: ['Try different dates', 'Try different route'],
      };
    }
    const text = `**Live flights: ${o} → ${destination}** on ${departDate}\n\nFound **${result.count} flights**. Cheapest **$${result.cheapest}**, average **$${result.average}**. Tap a card to book.`;
    return {
      text,
      cards: result.offers.slice(0, 4).map((o: any) => ({
        kind: 'flight',
        airline: o.airline,
        flightNumber: o.flightNumber,
        from: o.from,
        to: o.to,
        priceUsd: o.priceUsd,
        durationMinutes: o.durationMinutes,
        stops: o.stops,
        departure: o.departure,
        arrival: o.arrival,
      })),
      quickActions: ['Show hotels too', 'Try other dates', 'Create a mission'],
    };
  }

  // Hotel search intent
  if (/\b(hotels?|stays?|accommodations?|rooms?|hébergements?|h[oô]tels?)\b/.test(lower) && destination) {
    const checkIn = dates?.[0] || defaultDate(30);
    const checkOut = dates?.[1] || defaultDate(35);
    const result = await runTool('search_hotels', { destination, checkIn, checkOut, guests: 2, rooms: 1 });
    if (result.error) {
      return {
        text: `I tried to search hotels in **${destination}** but: ${result.error}`,
        quickActions: ['Try different city', 'Try different dates'],
      };
    }
    const text = `**Live hotels in ${result.destination}** (${checkIn} → ${checkOut})\n\nFound **${result.count} hotels**. Cheapest total: **$${result.cheapest}**.`;
    return {
      text,
      cards: result.hotels.slice(0, 4).map((h: any) => ({
        kind: 'hotel',
        name: h.name,
        stars: h.stars,
        pricePerNight: h.pricePerNight,
        totalPrice: h.totalPrice,
        guestRating: h.guestRating,
        reviewCount: h.reviewCount,
        address: h.address,
      })),
      quickActions: ['Search flights', 'Filter by rating', 'Create a mission'],
    };
  }

  // Generic fallback — no simulated data
  return {
    text: `I can help you with **live flights** and **real hotels** worldwide. Give me a route and I'll pull current prices.\n\nExamples:\n- "Flight from Paris to Tokyo on 2026-07-15"\n- "Hotels in Barcelona from 2026-06-10 to 2026-06-14"\n- "Cheap flight to Bali for 2 people"`,
    quickActions: ['Paris → Tokyo', 'Hotels in Barcelona', 'Create a mission'],
  };
}

/* ---------------- Handler ---------------- */

export async function POST(req: NextRequest) {
  let body: { message?: string; history?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const message = (body.message || '').trim();
  if (!message) {
    return NextResponse.json({ success: false, message: 'Empty message' }, { status: 400 });
  }

  const history = (body.history || []).filter((h) => h.role === 'user' || h.role === 'assistant');

  // Try Claude first (with tool use), fall back to rule-based with real tool calls
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await callClaude(
        [{ role: 'user', content: message }],
        history
      );
      return NextResponse.json({
        success: true,
        message: result.text,
        quickActions: result.used_tools
          ? ['Show more options', 'Search another route', 'Create a mission']
          : ['Find a flight', 'Find a hotel', 'How it works'],
      });
    } catch (err: any) {
      console.error('[chat] Claude error, falling back:', err?.message);
      // fall through to rule-based
    }
  }

  const result = await ruleBasedResponse(message);
  return NextResponse.json({
    success: true,
    message: result.text,
    quickActions: result.quickActions || [],
    cards: (result as any).cards || undefined,
  });
}
