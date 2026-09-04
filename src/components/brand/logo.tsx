import { cn } from '@/lib/utils';

/**
 * Rezzerv markası — yalnızca geometrik SVG ve metinden oluşur.
 * İşaret: yuvarlatılmış kare içinde "R"; sağ üstteki boşluk bir saat kadranı
 * dilimi gibi okunur (randevu/zaman fikri).
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Rezzerv"
    >
      <defs>
        <linearGradient id="rz-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B85FF" />
          <stop offset="100%" stopColor="#0E52D9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rz-mark)" />
      <path
        d="M10 8.6h6.4c3.1 0 5.2 1.9 5.2 4.7 0 2.1-1.2 3.7-3.2 4.4l3.8 5.7h-4.1l-3.3-5.1h-1.4v5.1H10V8.6Zm3.4 3v3.6h2.7c1.3 0 2.1-.7 2.1-1.8s-.8-1.8-2.1-1.8h-2.7Z"
        fill="#fff"
      />
      <circle cx="24.4" cy="8.2" r="2.2" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

export function Logo({
  size = 30,
  className,
  wordmark = true,
  tone = 'default',
}: {
  size?: number;
  className?: string;
  wordmark?: boolean;
  tone?: 'default' | 'light';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {wordmark ? (
        <span
          className={cn(
            'text-[19px] font-bold tracking-[-0.02em]',
            tone === 'light' ? 'text-white' : 'text-navy',
          )}
        >
          Rezzerv
        </span>
      ) : null}
    </span>
  );
}
