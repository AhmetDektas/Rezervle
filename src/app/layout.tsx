import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { ServiceWorkerRegistrar } from '@/components/shell/service-worker';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Rezzerv — Randevunu saniyeler içinde al',
    template: '%s · Rezzerv',
  },
  description:
    'Diş kliniği, güzellik salonu ve estetik merkezlerinde uygun saatleri gör, randevunu anında oluştur. Ankara’daki işletmeler Rezzerv’de.',
  applicationName: 'Rezzerv',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Rezzerv', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Rezzerv',
    title: 'Rezzerv — Randevunu saniyeler içinde al',
    description: 'Ankara’daki diş, güzellik ve estetik işletmelerinde uygun saatleri gör, anında randevu oluştur.',
  },
};

export const viewport: Viewport = {
  themeColor: '#176BFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// data-scroll-behavior: Next.js rota geçişlerinde yumuşak kaydırmayı şimdiye
// kadar kendisi kapatıyordu; gelecek sürümde bu niyetin açıkça belirtilmesi
// gerekiyor. Belirtilmezse her sayfa yüklemesinde konsola uyarı düşüyor.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable} data-scroll-behavior="smooth">
      <body style={{ ['--font-sans' as string]: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' }}>
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          İçeriğe geç
        </a>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
