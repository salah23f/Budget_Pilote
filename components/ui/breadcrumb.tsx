import Link from 'next/link';

interface BreadcrumbProps {
  items: Array<{ label: string; href?: string }>;
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-[11px] text-pen-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-pen-3">/</span>}
            {item.href && i < items.length - 1 ? (
              <Link
                href={item.href}
                className="hover:text-pen-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 rounded-md"
              >
                {item.label}
              </Link>
            ) : (
              <span className={i === items.length - 1 ? 'text-pen-2' : ''}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
