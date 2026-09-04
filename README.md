# Rezzerv Ananı Sikeyim apo

Çok sektörlü **rezervasyon, müşteri yönetimi ve işletme operasyonları** platformu.
Müşteri uygulaması, işletme paneli ve platform yönetimi tek bir modüler monolit içinde.

Beş ana kategori uçtan uca destekleniyor: **restoranlar, güzellik salonları,
halı sahalar, diş klinikleri, veterinerler**. Estetik klinikleri de yayında;
spor salonları için şema hazır, arayüz henüz yok.

---

## Kurulum

Node.js 20 veya üzeri gerekir. Veritabanı için kurulum yapmanıza gerek yok — SQLite dosya
tabanlı çalışır.

```bash
npm install
cp .env.example .env
npm run setup      # prisma generate + migrate + tohum verisi
npm run dev
```

`http://localhost:3000` adresini açın.

> `npm run setup` bir kerelik hazırlıktır. Veriyi sıfırlayıp baştan doldurmak için
> `npm run db:reset` kullanın.
>
> Windows'ta `npm run build` komutunu geliştirme sunucusu **kapalıyken** çalıştırın:
> çalışan sunucu Prisma sorgu motorunu kilitler ve `prisma generate` adımı `EPERM` verir.

### Demo hesaplar

Tümünün parolası: **`Rezzerv123`**

| Rol | E-posta | Nereye açılır |
|---|---|---|
| Müşteri | `demo@rezzerv.com` | Ana sayfa, randevularım |
| İşletme sahibi | `serhat@beyazdis.com` | `/panel` — 2 şubeli diş polikliniği |
| Halı saha sahibi | `kemal@gulverenspor.com` | `/panel` — 4 sahalı tesis, gece 24:00'e kadar |
| Restoran sahibi | `huseyin@kavakliocakbasi.com` | `/panel` — masa rezervasyonu |
| Veteriner | `deniz@patilervet.com` | `/panel` — hekim + pet kuaförü |
| Personel | `aylin.kara@beyazdispoliklinigi.com` | `/panel` — sınırlı yetkiyle aynı işletme |
| Platform yöneticisi | `admin@rezzerv.com` | `/yonetim` |

Geliştirme modunda giriş sayfasında tek tıkla giriş yapan demo düğmeleri vardır.
Bu düğmeler ve `demoLoginAction`, `NODE_ENV=production` iken çalışmaz.

### Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi (önce `prisma generate`) |
| `npm start` | Derlenmiş uygulamayı çalıştırır |
| `npm run typecheck` | TypeScript denetimi (strict) |
| `npm run lint` | ESLint |
| `npm test` | Birim + bütünleşik testler (Vitest) |
| `npm run e2e` | Uçtan uca testler (önce tohum verisini tazeler; masaüstü + mobil) |
| `npm run e2e:only` | Uçtan uca testler, tohumlamadan |
| `npm run db:reset` | Veritabanını sıfırlar ve yeniden tohumlar |
| `npm run db:studio` | Prisma Studio |

E2E testlerini ilk kez çalıştırmadan önce tarayıcıyı indirin:
`npx playwright install chromium`

`npm run e2e` geliştirme veritabanını yeniden tohumlar; testler onay bekleyen işletme
gibi belirli bir başlangıç durumuna güvenir.

---

## Mimari

**Modüler monolit.** Alan sınırları klasörlerle korunur; mikroservis yok.

```
src/
  app/
    (customer)/          Müşteri uygulaması  — /, /kesfet, /isletme/[slug], /randevularim …
    (panel)/panel/       İşletme paneli      — /panel/[slug]/…
    (admin)/yonetim/     Platform yönetimi
    (auth)/              Giriş, kayıt
    actions/             Server action'lar (tek yazma kapısı)
  components/            UI, marka, keşif, rezervasyon, panel, yönetim bileşenleri
  lib/                   Saf mantık: uygunluk motoru, saat dilimi, biçimlendirme, doğrulama
  server/                Sunucuya özel: veritabanı, oturum, yetki, alan servisleri
prisma/                  Şema, migration'lar, tohum verisi
tests/                   unit / integration (Vitest) + e2e (Playwright)
```

**Yığın:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS ·
Prisma + SQLite · Zod · jose ile imzalı çerez oturumu · bcrypt · Vitest · Playwright.

### İki tasarım kararı

**1. Uygunluk tek bir saf fonksiyonda toplanır.**
`src/lib/availability.ts` veritabanı bilmez. Müşteri tarafı, işletme paneli ve
sürükle-bırak taşıma aynı fonksiyonu çağırır. Kural ikiye ayrılırsa er geç ikisi
birbirinden ayrışır ve çifte rezervasyon doğar.

**2. Çifte rezervasyon üç katmanda engellenir.**

| Katman | Ne yapar |
|---|---|
| Okuma | Uygunluk hesabı dolu saatleri hiç göstermez |
| Yazma | İşlem içinde çakışma yeniden sorgulanır |
| Veritabanı | `Reservation.slotKey` (`personel:tarih:dakika`) benzersiz kısıtı |

`slotKey` iptalde `null` yapılır; SQL'de `NULL` değerler benzersiz kısıtı tetiklemediği
için saat yeniden satışa açılır. Eşzamanlı iki istek geldiğinde ikincisi `P2002` alır ve
kullanıcıya *"Bu saat az önce doldu"* mesajı döner. Bu davranış testle doğrulanır.

**Onay bekleyen randevu da slotu kilitler.** `PENDING`, `ACTIVE_STATUSES` içindedir;
yani "onay bekliyor" durumundaki bir randevunun saati başkasına satılamaz. Bu yüzden
onaylanmayı bekleyen bir randevunun başka bir randevuyla çakışması mümkün değildir —
çakışma oluşturma anında engellenmiştir.

### Sonradan geçersizleşen randevular

Çakışma oluşturulamaz ama bir randevu oluşturulduktan *sonra* geçersizleşebilir:
işletme çalışma saatlerini daraltırsa ya da sonradan bir mola/izin eklenirse kayıt
o aralığın dışında kalır. İki savunma var:

1. **Önleme** — çalışma saati değişikliği, izin ekleme ve personel pasifleştirme
   işlemleri, etkilenecek ileri tarihli randevu varsa reddedilir; kaç randevunun
   etkileneceği ve ilkinin tarihi mesajda söylenir.
2. **Görünürlük** — `src/server/audit.ts` her panel listesinde bekleyen ve onaylı
   randevuları denetler. Sorunlu kayıt "Saat dışında", "Molaya denk geliyor",
   "İzin aralığında" ya da "Çakışma" rozetiyle işaretlenir; takvimde blok kırmızı
   çerçeveyle çizilir ve onaylama düğmesinin yanında nedeni yazar.
3. **Onay öncesi gün bakışı** — her onay bekleyen randevuda "Takvimde gör"
   düğmesi vardır. Açılan panel o günün programını, randevunun nereye düştüğünü,
   öncesindeki ve sonrasındaki boşlukları ve varsa denetim uyarısını gösterir;
   onay ya da ret aynı panelden verilir.

Müşteri tarafında da durum açıkça yazar: "Onay bekliyor" rozetinin altında
*"Saatiniz size ayrıldı; bu saate başka kimse randevu alamaz"* açıklaması görünür.

### Uygunluk hesabı neleri dikkate alır

Şube açılış saatleri · personel çalışma saatleri · hizmet süresi · hizmet sonrası tampon ·
haftalık molalar · izin ve blok aralıkları · mevcut randevular (iptaller hariç) ·
geçmiş saatler · online randevular için hazırlık payı (60 dk) · "fark etmez" personel seçimi.

### Sektöre göre terminoloji

Çekirdek her sektörde aynıdır: bir **kaynak** belirli bir aralık için ayrılır.
Ama o kaynak kimi zaman bir hekim, kimi zaman bir saha ya da masadır. Arayüz
metinleri `SECTOR_TERMS` üzerinden tek yerden okunur; böylece halı saha
müşterisine "kiminle görüşmek istersiniz?" diye sorulmaz.

| Sektör | Kaynak | Rezervasyon sorusu | Çalışma saati |
|---|---|---|---|
| Restoran | Masa | "Kaç kişilik masa istersiniz?" | Her gün 12:00–23:30 |
| Güzellik salonu | Personel | "Kiminle görüşmek istersiniz?" | Hafta içi 09:00–19:00 |
| Halı saha | Saha | "Hangi sahayı istersiniz?" | Her gün 09:00–24:00 |
| Diş kliniği | Personel | "Kiminle görüşmek istersiniz?" | Hafta içi 09:00–19:00 |
| Veteriner | Personel | "Hangi veteriner hekim?" | Hafta içi 09:00–19:00 |

Panelde de aynı sözlük geçerlidir: halı saha sahibinin menüsünde "Personel"
yerine "Sahalar", restoranınkinde "Masalar" yazar.

### Saat dilimi

Rezervasyonun gerçeği **yerel takvim günü + gün içi dakikadır** (`date`, `startMin`).
UTC anı (`startsAt`) bundan türetilir ve yalnızca sıralama/hatırlatma için kullanılır.
Böylece sunucu hangi saat diliminde çalışırsa çalışsın 14:00 randevusu 14:00'te kalır.
Dönüşümler `src/lib/time.ts` içinde `Intl` ile yapılır; gidiş-dönüş dönüşümü testlidir.

---

## Roller ve yetkilendirme

| Rol | Yetki |
|---|---|
| `CUSTOMER` | Kendi randevuları, favorileri, profili |
| `STAFF` | Bağlı olduğu işletmenin paneli |
| `OWNER` | Sahibi olduğu işletmelerin paneli |
| `ADMIN` | Tüm işletmeler + `/yonetim` |

Yetki kontrolü **sunucuda** yapılır. Sayfalar `requireRole` / `requireBusinessAccess`,
server action'lar `requireRoleAction` / `assertBusinessAccess` üzerinden geçer.
Butonu gizlemek yetkilendirme sayılmaz; her yazma işlemi ayrıca doğrulanır.
Fiyat, süre ve personel yetkinliği istemciden değil veritabanından okunur.

Oturum, `httpOnly` + `sameSite=lax` çerezde taşınan HS256 imzalı JWT'dir
(üretimde `secure`). Parolalar bcrypt ile saklanır. Kurcalanmış jeton testle reddedilir.

---

## Öne çıkan akışlar

**Müşteri:** keşif ve filtreleme (kategori, semt, tarih, fiyat, puan, bugün müsait) →
işletme sayfası → hizmet, şube, personel, saat seçimi → özet ve onay → randevu detayı →
iptal / erteleme / değerlendirme. Favoriler, bildirimler, profil ve iletişim tercihleri.

**İşletme paneli:** bugün özeti · gün/hafta/ajanda takvimi · sürükle-bırak taşıma ·
panelden randevu açma · durum akışı (onay, geldi, tamamlandı, gelmedi, iptal) ·
hizmet, personel, çalışma saati, izin, şube ve kampanya yönetimi · müşteri kartları
(not, etiket, geçmiş) · raporlar (ciro, doluluk, iptal ve gelmeme oranı, kanal dağılımı) ·
işletme profili ve değerlendirme yanıtları.

**Yönetim:** işletme onay/ret/askı, öne çıkarma, kullanıcı rolleri, kategori yönetimi,
şikayet edilen değerlendirmelerin moderasyonu, platform metrikleri ve durum geçmişi
(denetim izi).

---

## Sektör uzantı noktaları

Çekirdek (işletme → şube → hizmet → personel → randevu) sektörden bağımsızdır.
Sektöre özel alanlar çekirdeği değiştirmeden eklenir:

| Alan | Kullanım |
|---|---|
| `SECTOR_TERMS` | Sektörün arayüz sözlüğü (kaynak adı, sorular, başlıklar) |
| `Business.sectorMeta` | Sektöre özel işletme ayarları (JSON) |
| `Reservation.extra` | `{"partySize":4}`, `{"petId":"…"}`, `{"seats":2}` |
| `Service.capacity` | `>1` → grup dersi veya paylaşımlı masa |
| `PetProfile` | Veteriner modülünün pet kartı için hazır model |

Yeni bir sektör eklemek için sırasıyla: `SECTORS`'a kod, `SECTOR_LABEL` ve
`SECTOR_TERMS`'e metinler, `SECTOR_ICON`'a simge, tohum verisine örnek işletme.
Rezervasyon, çakışma ve raporlama tarafında değişiklik gerekmez.

Spor salonu için şema ve sözlük hazır; örnek işletme ve grup dersi kapasitesi
arayüzü henüz eklenmedi.

---

## Kapora paketi

Kapora, randevuya gelmeme oranını düşürmek için satılan **ek pakettir**. İki ayrı
anahtar vardır ve ikisi birden açık olmadan kapora istenmez:

| Anahtar | Kim açar | Anlamı |
|---|---|---|
| `Business.depositAddon` | Platform yöneticisi | Paket bu işletmeye verildi |
| `Business.depositEnabled` | İşletme sahibi | İşletme özelliği kullanmayı seçti |

Paket verilmemiş bir işletmede kapora arayüzü hiç görünmez; yalnızca paketi
tanıtan kilitli bir kart çıkar. Paket geri alınırsa `depositEnabled` de düşer —
aksi hâlde paket yeniden verildiğinde kapora habersizce istenmeye başlardı.

**Ayarlar:** yüzde veya sabit tutar, alt limit (bu tutarın altında kapora yok),
iade süresi (kaç saat öncesine kadar iptal edilirse iade edilir). Panelde canlı
önizleme, seçilen ayarla 1.000 ₺'lik bir randevuda ne kadar kapora isteneceğini
gösterir.

**Akış:**

1. Müşteri online randevu alırken kapora tutarını, kalan tutarı ve iade
   koşulunu özet ekranında görür; düğme *"₺300 öde ve onayla"* olur.
2. **Önce slot ayrılır, sonra tahsilat yapılır.** Ödeme sırasında saatin
   başkasına gitmemesi için kayıt önce oluşturulur; tahsilat başarısız olursa
   randevu iptal edilip saat yeniden açılır. Ödemesi alınmamış randevu durmaz.
3. Randevu anındaki tutar kayda **dondurulur**: işletme sonradan oranı değiştirse
   bile alınmış kapora değişmez.
4. Randevuya gelinmezse (`NO_SHOW`) kapora gelir yazılır. İptalde, iade
   penceresi içindeyse iade edilir, değilse gelir yazılır.
5. Panelden açılan telefon/kapı randevularında kapora istenmez.

---

## Kapora tahsilatı ve komisyon

Platform kapora üzerinden **%30 komisyon** alır (işletme bazında ayarlanabilir:
`Business.commissionRate`). Buradaki asıl soru paranın kimin hesabına gireceğidir.

### Neden "pazaryeri (alt üye işyeri)" modeli

| Model | Sorun |
|---|---|
| Para doğrudan işletmeye, komisyonu sonra faturala | Tahsilat riski platformda. İşletme ödemezse elde yalnızca hesabı kapatmak kalır. Ayrıca iadeyi müşteriye işletme yapmak zorunda; siz süreci yönetemezsiniz. |
| Para platformun kendi banka hesabına, sonra işletmeye dağıt | Başkası adına para toplayıp dağıtmak 6493 sayılı Kanun kapsamında **ödeme hizmetidir ve lisans gerektirir**. Lisanssız yapılamaz. |
| **Lisanslı ödeme kuruluşunda bölünmüş tahsilat** | Seçilen model. |

Uygulanan akış:

1. Müşteri kaporayı **tek seferde** öder.
2. Lisanslı ödeme kuruluşu tutarı **ödeme anında** böler: platform komisyonu
   platformun üye işyeri hesabına geçer, işletme payı kuruluşta **bloke** kalır.
3. Randevu sonuçlanınca bloke çözülür (hak ediş) veya tahsilat tümüyle iade edilir.

Platform müşteri parasını hiçbir zaman kendi banka hesabında tutmaz; parayı
lisanslı kuruluş taşır. İyzico "alt üye işyeri", PayTR ve Param "pazaryeri"
ürünleri `PaymentProvider` arayüzünün arkasına doğrudan oturur.

### Hak ediş kuralları

| Randevu sonucu | Kapora | Platform komisyonu |
|---|---|---|
| Tamamlandı | Hizmet bedelinden düşülür, işletmeye hak ediş | Alınır |
| Gelmedi | İşletmede kalır | Alınır |
| Geç iptal | İşletmede kalır | Alınır |
| **Zamanında iptal** | **Müşteriye tam iade** | **Alınmaz, geri döner** |

Tahsil edilmemiş bir hizmetten pay almak savunulamaz; bu yüzden iade edilen
kaporadan komisyon alınmaz ve komisyon geliri raporuna girmez.

Oran ve bölüşüm **ödeme anında kayda dondurulur** (`Payment.commissionRate`,
`commissionAmount`, `netAmount`): sözleşme sonradan değişse bile geçmiş
tahsilatın parçalanması değişmez. Değişmez kural: `commissionAmount + netAmount
== capturedAmount`. Yuvarlama işletme lehinedir — kuruş farkı işletmede kalır.

`Payment.amount` müşterinin **toplam borcunu**, `capturedAmount` ise
**uygulamadan fiilen geçen tutarı** (kaporayı) tutar. Kalan tutar işletmede
ödenir ve bizim sistemimizden geçmez.

### Ekranlar

- **İşletme → Raporlar:** hesabına geçen, bloke bekleyen, platform komisyonu,
  müşteriye iade edilen.
- **İşletme → Ayarlar:** hak ediş hesabı (ünvan, IBAN, vergi no) ve komisyon
  oranının örnek üzerinden gösterimi.
- **Yönetim → Komisyon:** komisyon geliri, aracılık edilen tutar, gerçekleşen
  ortalama oran, bloke bekleyen toplam ve işletme kırılımı.

### Hukuki ve mali not

Bu bir yazılım tasarımıdır, hukuki görüş değildir. Canlıya geçmeden önce en az
şunlar netleşmeli: aracılık sözleşmesinde tahsilat aracılığı maddesi, komisyon
faturasının KDV'li düzenlenmesi, aracı hizmet sağlayıcı olarak GİB bildirim
yükümlülükleri ve seçilen ödeme kuruluşuyla alt üye işyeri sözleşmesi. Mali
müşavir ve avukat görüşü alınmalıdır.

---

## Sağlayıcılar

`src/server/providers.ts` e-posta, SMS ve ödeme için arayüz tanımlar.
MVP'de e-posta ve SMS konsola yazar; ödeme sahte sağlayıcıdan geçer ve **kart bilgisi
istemez**. Gerçek entegrasyonda yalnızca bu dosya değişir — rezervasyon mantığı
sağlayıcıyı hiç bilmez. `.env.example` içinde ilgili anahtarlar yorumlu olarak durur.

Ödeme yöntemi randevu başına saklanır (`AT_VENUE` / `ONLINE`) ve randevu tamamlandığında
yerinde ödeme otomatik olarak "ödendi" işaretlenir.

---

## Test

```bash
npm run typecheck && npm run lint && npm test && npm run build && npm run e2e
```

Kapsanan davranışlar:

- Uygunluk hesabı: çalışma saatleri, mola, izin, tampon, geçmiş saat, "fark etmez",
  gece yarısına kadar açık kaynaklar (halı saha)
- Saat dilimi gidiş-dönüş dönüşümü ve takvim aritmetiği
- Rezervasyon oluşturma, çakışma engeli, **eşzamanlı istekte tek kazanan**
- İptal (slot serbest kalır), erteleme (kendi slotunu dolu saymaz), durum geçişleri
- Kampanya kodu doğrulama (süre, kapsam, alt limit)
- Rol ve işletme sahipliği kontrolleri, parola ve oturum jetonu
- E2E: müşteri randevu yolculuğu, iptal, erteleme, kayıt ve giriş hataları,
  panelden hizmet/çalışma saati/randevu/galeri yönetimi, işletme onayı ve değerlendirme
  moderasyonu, yetki reddi, keşif, boş durum ve sektöre göre terminoloji —
  masaüstü ve mobil (Pixel 7) profillerinde

Testler `prisma/test.db` üzerinde çalışır; geliştirme verisine dokunmaz.

---

## Üretim notları

- **PostgreSQL'e geçiş:** `prisma/schema.prisma` içinde `provider = "postgresql"` yapın,
  `DATABASE_URL`'i değiştirin, `npx prisma migrate dev` çalıştırın. Şema bilinçli olarak
  veritabanına özgü özellik kullanmaz.
- **`AUTH_SECRET` zorunludur** ve en az 32 karakter olmalıdır: `openssl rand -base64 48`.
  Eksikse uygulama açık bir hata mesajıyla durur.
- Demo hesaplar ve demo giriş kısayolları üretimde kullanılmamalıdır.
- Uygulama PWA olarak kurulabilir. Servis çalışanı yalnızca statik varlıkları önbelleğe
  alır; **randevu verisi asla önbelleğe alınmaz** — eski bir "boş saat" listesi göstermek
  yanlış bilgi vermek olurdu.

---

## Önceki sürüm

`legacy/` klasöründe bu projeden önceki tek dosyalık vanilya JS uygulaması durur.
Yeni uygulamayla bağlantısı yoktur; gerekmiyorsa silinebilir.
