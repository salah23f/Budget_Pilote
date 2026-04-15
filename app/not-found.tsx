import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0c0a09' }}>
      <div className="text-center max-w-sm">
        <p className="text-8xl font-bold mb-4" style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #EF4444))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          404
        </p>
        <h1 className="text-xl font-semibold text-white mb-2">Page not found</h1>
        <p className="text-sm text-white/40 mb-8">
          This destination doesn't exist — but we can find you a real one.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #E8A317, #EF4444))' }}
          >
            Go home
          </Link>
          <Link href="/flights" className="px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition border border-white/10">
            Search flights
          </Link>
        </div>
      </div>
    </div>
  );
}
