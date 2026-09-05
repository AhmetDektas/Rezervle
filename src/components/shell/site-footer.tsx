import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export function SiteFooter() {
  return (
    <footer className="mt-12 hidden border-t border-line bg-surface lg:block">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo size={28} />
          <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-ink-3">
            Rezzerv, işletmelerin takvimini canlı okuyan bir randevu platformudur.
            Gördüğünüz saat gerçekten boştur.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-navy">Keşfet</p>
          <ul className="mt-3 space-y-2 text-[13.5px] text-ink-3">
            <li><Link href="/kesfet?kategori=restoran" className="hover:text-navy">Restoranlar</Link></li>
            <li><Link href="/kesfet?kategori=guzellik-salonu" className="hover:text-navy">Güzellik salonları</Link></li>
            <li><Link href="/kesfet?kategori=hali-saha" className="hover:text-navy">Halı sahalar</Link></li>
            <li><Link href="/kesfet?kategori=dis-klinigi" className="hover:text-navy">Diş klinikleri</Link></li>
            <li><Link href="/kesfet?kategori=veteriner" className="hover:text-navy">Veterinerler</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-navy">İşletmeler için</p>
          <ul className="mt-3 space-y-2 text-[13.5px] text-ink-3">
            <li><Link href="/kayit/isletme" className="hover:text-navy">İşletmenizi ekleyin</Link></li>
            <li><Link href="/panel" className="hover:text-navy">İşletme paneli</Link></li>
            <li><Link href="/giris" className="hover:text-navy">Giriş yap</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-6 py-4">
        <p className="mx-auto max-w-6xl text-[12.5px] text-ink-3">
          © {new Date().getFullYear()} Rezzerv. Demo amaçlı bir uygulamadır.
        </p>
      </div>
    </footer>
  );
}
