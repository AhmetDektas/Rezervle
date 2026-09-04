/**
 * Saat dilimi katmanı.
 *
 * Kural: rezervasyonun "gerçeği" yerel takvim günü + gün içi dakikadır
 * (date: 'YYYY-MM-DD', startMin: 0..1439). UTC anı (startsAt) bundan
 * türetilir ve yalnızca sıralama/hatırlatma için kullanılır. Böylece
 * sunucu hangi saat diliminde çalışırsa çalışsın 14:00 randevusu 14:00'te
 * kalır.
 */

export const TZ = 'Europe/Istanbul';

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

type Wall = { y: number; m: number; d: number; hh: number; mm: number; ss: number };

function wallClock(instant: Date): Wall {
  const p = PARTS.formatToParts(instant);
  const get = (t: string): number => Number(p.find((x) => x.type === t)?.value ?? '0');
  // en-CA saat 24 döndürebilir (gece yarısı); 0'a normalize et.
  const hh = get('hour') % 24;
  return { y: get('year'), m: get('month'), d: get('day'), hh, mm: get('minute'), ss: get('second') };
}

/** Verilen anda TZ'nin UTC'ye göre ofseti (dakika). */
function offsetAt(instant: Date): number {
  const w = wallClock(instant);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss);
  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000;
}

/** 'YYYY-MM-DD' + gün içi dakika → UTC anı. */
export function zonedToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Geçersiz tarih: ${date}`);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  // Ofset, tahmini anda hesaplanır; DST sınırında ikinci geçişle düzeltilir.
  let off = offsetAt(new Date(guess));
  let utc = guess - off * 60000;
  const off2 = offsetAt(new Date(utc));
  if (off2 !== off) {
    off = off2;
    utc = guess - off * 60000;
  }
  return new Date(utc);
}

/** UTC anı → TZ'deki 'YYYY-MM-DD'. */
export function utcToDateStr(instant: Date): string {
  const w = wallClock(instant);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

/** UTC anı → TZ'deki gün içi dakika. */
export function utcToMinutes(instant: Date): number {
  const w = wallClock(instant);
  return w.hh * 60 + w.mm;
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** TZ'de bugünün tarihi. */
export function today(now: Date = new Date()): string {
  return utcToDateStr(now);
}

/** TZ'de şu anın gün içi dakikası. */
export function nowMinutes(now: Date = new Date()): number {
  return utcToMinutes(now);
}

/** 'YYYY-MM-DD' → 0=Pazar .. 6=Cumartesi */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Takvim günü ekle/çıkar (saat dilimi kaymasından etkilenmez). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  return Math.round((dateNum(a) - dateNum(b)) / 86400000);
}

function dateNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Haftanın başlangıcı (Pazartesi). */
export function startOfWeek(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Gün içi dakika → 'HH:MM' */
export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** 'HH:MM' → gün içi dakika */
export function minutesOf(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** İki aralık kesişiyor mu? Uçlar dokunabilir (bitiş = başlangıç sorun değil). */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
