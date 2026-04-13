import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'Flyeas — AI Travel Agent';
  const subtitle = searchParams.get('subtitle') || 'Find the cheapest flights & hotels powered by AI';
  const price = searchParams.get('price');
  const route = searchParams.get('route');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0C0A09 0%, #1C1917 50%, #0C0A09 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            right: '-10%',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.1), transparent 70%)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #F59E0B, #F97316, #EF4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            ✈️
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #F59E0B, #F97316, #EF4444)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Flyeas
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: price ? '36px' : '48px',
            fontWeight: '800',
            color: 'white',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '20px',
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '16px 0 0 0',
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </p>

        {/* Price badge if route */}
        {price && route && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginTop: '32px',
              padding: '16px 32px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)' }}>
              {route}
            </span>
            <span
              style={{
                fontSize: '40px',
                fontWeight: '800',
                color: '#F59E0B',
              }}
            >
              ${price}
            </span>
          </div>
        )}

        {/* Footer */}
        <p
          style={{
            position: 'absolute',
            bottom: '24px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          faregenie.vercel.app
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
