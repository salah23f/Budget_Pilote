import Link from 'next/link';

interface BreadcrumbProps {
  items: Array<{ label: string; href?: string }>;
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-[11px] text-white/30">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-white/15">/</span>}
            {item.href && i < items.length - 1 ? (
              <Link
                href={item.href}
                className="hover:text-white/50 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={i === items.length - 1 ? 'text-white/50' : ''}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
