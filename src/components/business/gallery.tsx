'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** İşletme galerisi. Yüklenemeyen görseller sessizce listeden düşer. */
export function BusinessGallery({
  images,
}: {
  images: { id: string; url: string; caption: string }[];
}) {
  const [broken, setBroken] = React.useState<Set<string>>(new Set());
  const visible = images.filter((i) => !broken.has(i.id));
  if (visible.length === 0) return null;

  return (
    <section aria-label="İşletme görselleri" className="mt-5">
      <ul className="rail">
        {visible.map((img) => (
          <li
            key={img.id}
            className={cn(
              'relative shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-sunken',
              'h-32 w-48 sm:h-40 sm:w-60',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption || 'İşletme görseli'}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setBroken((prev) => new Set(prev).add(img.id))}
            />
            {img.caption ? (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-3 pb-2 pt-6 text-[12px] font-medium text-white">
                {img.caption}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
