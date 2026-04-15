import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface-primary">
      <div className="text-center max-w-sm">
        <p className="text-7xl font-bold font-display mb-4 gradient-text">
          404
        </p>
        <h1 className="text-xl font-semibold font-display text-text-primary mb-2">
          Destination not found
        </h1>
        <p className="text-sm text-text-muted mb-8 leading-relaxed">
          This page doesn't exist — but thousands of real destinations do. Let's find yours.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="bg-gradient-to-r from-accent-light to-accent-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:shadow-glow transition-all"
          >
            Go home
          </Link>
          <Link
            href="/flights"
            className="px-6 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text-primary transition border border-border-default hover:border-border-default"
          >
            Search flights
          </Link>
        </div>
      </div>
    </div>
  );
}
