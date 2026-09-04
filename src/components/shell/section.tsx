import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/** Başlık + "tümü" bağlantısı olan bölüm sarmalayıcısı. */
export function Section({
  title,
  description,
  href,
  hrefLabel = 'Tümünü gör',
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? <p className="muted mt-0.5">{description}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg py-1 text-[13.5px] font-medium text-brand-600 hover:underline"
          >
            {hrefLabel}
            <ChevronRight size={15} aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
