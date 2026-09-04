import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Kullanım koşulları' };

const SECTIONS = [
  {
    title: 'Hizmetin kapsamı',
    body: 'Rezzerv, kullanıcıların işletmelerden randevu almasını sağlayan bir aracı platformdur. Randevunun konusu olan hizmet, ilgili işletme tarafından verilir; hizmetin içeriği ve kalitesinden işletme sorumludur.',
  },
  {
    title: 'Randevu, iptal ve erteleme',
    body: 'Oluşturduğunuz randevu, işletmenin takviminde sizin adınıza ayrılır. Randevu saatine 2 saatten fazla varsa iptal ve erteleme işlemlerini uygulama üzerinden yapabilirsiniz. Daha kısa sürede işletmeyi doğrudan aramanız gerekir.',
  },
  {
    title: 'Ödeme',
    body: 'Ödeme, işletmede veya uygulama üzerinden yapılabilir. Bu demo sürümünde online ödeme test sağlayıcısı ile simüle edilir; kart bilgisi istenmez ve saklanmaz.',
  },
  {
    title: 'Kişisel veriler',
    body: 'Ad, telefon ve e-posta bilgileriniz yalnızca randevunun oluşturulması, hatırlatılması ve işletmeyle iletişim için kullanılır. İletişim tercihlerinizi profil sayfanızdan her zaman değiştirebilirsiniz.',
  },
  {
    title: 'Değerlendirmeler',
    body: 'Yalnızca tamamlanmış randevular değerlendirilebilir. Hakaret, reklam veya alakasız içerik barındıran değerlendirmeler bildirim üzerine incelenir ve gerekirse yayından kaldırılır.',
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Kullanım koşulları</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        Bu sayfa Rezzerv’in demo sürümü için hazırlanmıştır ve hukuki bir metin yerine geçmez.
      </p>
      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-navy">{s.title}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
