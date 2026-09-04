import { WEEKDAYS, WEEKDAYS_SHORT } from './constants';
import { TZ, today, addDays } from './time';

const TRY = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat('tr-TR');

/** 1250 → "1.250 ₺" */
export function money(value: number): string {
  return TRY.format(value);
}

export function num(value: number): string {
  return NUM.format(value);
}

export function percent(value: number, digits = 0): string {
  return `%${value.toFixed(digits).replace('.', ',')}`;
}

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

function parts(date: string): { d: number; m: number; y: number; wd: number } {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return { d: d ?? 1, m: m ?? 1, y: y ?? 1970, wd };
}

/** '2026-03-14' → "14 Mart 2026" */
export function longDate(date: string): string {
  const p = parts(date);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** '2026-03-14' → "14 Mart, Cumartesi" */
export function dayWithWeekday(date: string): string {
  const p = parts(date);
  return `${p.d} ${MONTHS[p.m - 1]}, ${WEEKDAYS[p.wd]}`;
}

/** '2026-03-14' → "14 Mar" */
export function shortDate(date: string): string {
  const p = parts(date);
  return `${p.d} ${MONTHS[p.m - 1]?.slice(0, 3)}`;
}

/** '2026-09-04' → "Eyl" */
export function monthShort(date: string): string {
  return MONTHS[parts(date).m - 1]?.slice(0, 3) ?? '';
}

export function weekdayShort(date: string): string {
  return WEEKDAYS_SHORT[parts(date).wd] ?? '';
}

/** Bugün / Yarın / "14 Mart, Cumartesi" */
export function relativeDay(date: string, now = today()): string {
  if (date === now) return 'Bugün';
  if (date === addDays(now, 1)) return 'Yarın';
  if (date === addDays(now, -1)) return 'Dün';
  return dayWithWeekday(date);
}

const DT = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function dateTime(instant: Date): string {
  return DT.format(instant);
}

/** "3 dakika önce", "2 saat önce", "5 gün önce" */
export function ago(instant: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - instant.getTime()) / 1000));
  if (s < 60) return 'az önce';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dakika önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün önce`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} ay önce`;
  return `${Math.round(mo / 12)} yıl önce`;
}

/** 90 → "1 sa 30 dk" */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

/** 1..3 → "₺" / "₺₺" / "₺₺₺" */
export function priceLevel(level: number): string {
  return '₺'.repeat(Math.max(1, Math.min(3, level)));
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase('tr-TR') ?? '')
    .join('');
}

/** Telefonu okunur hale getirir: 5321234567 → "0532 123 45 67" */
export function phone(value: string | null | undefined): string {
  if (!value) return '';
  const d = value.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
  if (d.length !== 10) return value;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}
