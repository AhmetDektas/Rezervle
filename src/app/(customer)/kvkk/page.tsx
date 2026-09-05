import type { Metadata } from 'next';
import Link from 'next/link';
import { CONSENT_VERSION } from '@/lib/constants';

export const metadata: Metadata = { title: 'Aydınlatma metni' };

/**
 * KVKK aydınlatma metni.
 *
 * Aydınlatma bir yükümlülük, rıza bir izin: bu sayfa yükümlülüğün karşılığı.
 * Kayıt formundaki kutu buraya bağlanıyor ve onay kaydı `CONSENT_VERSION` ile
 * damgalanıyor; metin değişirse sürüm de değişir ve eski kayıtlar hangi metne
 * onay verildiğini göstermeye devam eder.
 */
const SECTIONS = [
  {
    title: 'Veri sorumlusu',
    body: 'Kişisel verileriniz, randevu platformunu işleten Rezzerv tarafından veri sorumlusu sıfatıyla işlenir. Bu demo sürümünde veriler yalnızca geliştirme ortamında tutulur.',
  },
  {
    title: 'İşlenen veriler',
    body: 'Ad soyad, e-posta, telefon numarası; randevu geçmişiniz (hangi işletmeden, hangi hizmet için, hangi tarihte randevu aldığınız); varsa değerlendirmeleriniz ve favorileriniz. İşletme sahibi iseniz ayrıca işletme adı, adresi ve iletişim bilgileri.',
  },
  {
    title: 'Açık rıza neden isteniyor',
    body: 'Randevunun oluşturulması sözleşmenin ifası kapsamındadır ve ayrı bir rıza gerektirmez. Ancak diş kliniği veya veteriner randevusu gibi kayıtlar sağlık alanına dair bir çıkarım taşıyabildiği için özel nitelikli veri sayılır; bunların işlenmesi açık rızanıza bağlıdır. Rıza vermezseniz bu kategorilerde uygulama üzerinden randevu oluşturamazsınız; işletmeyi doğrudan arayarak randevu almanız mümkündür.',
  },
  {
    title: 'Aktarım',
    body: 'Randevu bilgileriniz, randevuyu vereceği için yalnızca ilgili işletmeyle paylaşılır. Hatırlatma göndermek amacıyla e-posta ve SMS sağlayıcıları kullanılır. Bunun dışında üçüncü kişilere aktarım yapılmaz, veriler reklam amacıyla satılmaz.',
  },
  {
    title: 'Saklama süresi',
    body: 'Hesabınız açık kaldığı sürece saklanır. Hesabınızı kapatmanız hâlinde, ilgili mevzuatın öngördüğü zorunlu saklama süreleri dışında silinir.',
  },
  {
    title: 'Haklarınız',
    body: 'Verilerinize erişme, düzeltilmesini veya silinmesini isteme ve verdiğiniz açık rızayı geri alma hakkınız vardır (KVKK m.11 ve m.7). Rızanızı profil sayfanızdan geri alabilirsiniz; geri alma geçmişe etkili değildir, o ana kadar yapılmış işlemleri geçersiz kılmaz.',
  },
  {
    title: 'İletişim tercihleri',
    body: 'Randevu hatırlatmalarını SMS ve e-posta ile alıp almayacağınızı profil sayfanızdan değiştirebilirsiniz. Tercihinizi kapatmanız hâlinde ilgili kanaldan mesaj gönderilmez; randevularınızı uygulama içi bildirimlerden görmeye devam edersiniz.',
  },
];

export default function KvkkPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Aydınlatma metni</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında hazırlanmıştır. Bu sayfa
        Rezzerv’in demo sürümü içindir ve hukuki bir metin yerine geçmez.
      </p>
      <p className="mt-1 text-[13px] text-ink-3">Sürüm: {CONSENT_VERSION}</p>

      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold text-navy">{s.title}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-6 text-[13.5px] text-ink-2">
        Hizmet koşulları için{' '}
        <Link href="/sozlesme" className="font-medium text-brand-600 underline-offset-4 hover:underline">
          kullanım koşulları
        </Link>{' '}
        sayfasına bakabilirsiniz.
      </p>
    </div>
  );
}
