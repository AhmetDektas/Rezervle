import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Metinden URL uyumlu slug üretir (Türkçe karakterler dahil). */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
    ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
    // Düzeltme işaretli harfler Türkçede yaygın: "Dükkân", "Kâğıt", "Hâlâ".
    // Haritada olmayan harf ayraca dönüştüğü için "Kasap Dükkânı" adresi
    // "kasap-dukk-ni" oluyordu — kırık görünen ve okunmayan bir URL.
    â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
  };
  return input
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Deterministik gradient — görsel yüklenemediğinde yerine geçer. */
export function gradientFor(hue: number): string {
  const a = ((hue % 360) + 360) % 360;
  const b = (a + 26) % 360;
  return `linear-gradient(135deg, hsl(${a} 72% 52%), hsl(${b} 68% 38%))`;
}

/** Bir dizeden 0..359 arası kararlı bir ton üretir. */
export function hueFromString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 100000;
  return h % 360;
}

export function jsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Rezervasyon kodu: RZ-4F7K2 */
export function reservationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `RZ-${out}`;
}
