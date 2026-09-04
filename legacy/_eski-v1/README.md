# Rezervle

Rezervasyonu, müşteriyi ve **ciroyu** tek panelde toplayan sistemin çalışan demosu.
İki parçadan oluşur: **tanıtım sayfası** (şirketi ve ürünü anlatır) ve **işletme paneli** (ürünün kendisi).

Demo, saha anketinden çıkan üç bulguya göre kurgulandı:

| Bulgu | Üründeki karşılığı |
|---|---|
| %79 manuel defter, %9 yazılım | Rakip kâğıt — panel “kolay kullanım” önceliğiyle tasarlandı |
| Müşteri takibi %77, no-show %77 | Müşteri kartı + no-show’un TL karşılığı ciro ekranında |
| Ciro takibi talebi %69 | Ciro ekranı ürünün merkezi; **elle veri girişi yoktur** |
| %81 abonelik, %6 komisyon | Gelir modeli abonelik; ödeme akışı işletmenin POS’unda kalır |

---

## Çalıştırma

```bash
node dev-server.js
```

`http://localhost:5173` → tanıtım sayfası, `#/panel` → işletme paneli.
Bağımlılık yoktur; `index.html` doğrudan da açılabilir (dosya yolundan çalışır, derleme adımı gerekmez).

Tek dosyaya derlemek için:

```bash
node build.js
```

- `dist/rezervle.html` — çift tıklayıp açılabilen tek parça sürüm (sunuma/maile uygun)
- `dist/artifact.html` — gömülü ortamlar için gövde parçası

---

## Dosya düzeni

```
index.html                 Yükleme sırası burada tanımlı (derleyici yok)
assets/css/
  base.css                 Token'lar, reset, buton/kart/tablo/modal
  panel.css                Panel kabuğu, takvim ızgarası, KPI, telefon önizleme
  landing.css              Tanıtım sayfası
assets/js/core/
  utils.js                 DOM (el), TL/tarih biçimlendirme, ikonlar, tohumlu rastgele
  plans.js                 PAKET MİMARİSİ — özellik kataloğu, paketler, ek modüller
  schedule.js              REZERVASYON MOTORU — çakışma, müsaitlik, doluluk, boş aralık
  analytics.js             Ciro raporları, dönem karşılaştırma, müşteri segmentleri
  store.js                 Merkezi durum, kalıcılık, tüm yazma işlemleri
assets/js/data/seed.js     Gerçekçi demo verisi (2 işletme, ~3.400 rezervasyon)
assets/js/ui/
  components.js            Toast, modal, drawer, grafikler, kilit/yükseltme ekranı
  booking.js               Rezervasyon formu ve detay çekmecesi
assets/js/views/           Ekranlar (dashboard, calendar, revenue, modules, …)
assets/js/app.js           Kabuk + hash yönlendirme
```

---

## Mimarideki üç karar

### 1. Çakışma tek bir yerde engellenir

`schedule.validate(ctx, draft, ignoreId)` tek doğrulama kapısıdır. Panelden, telefondan,
sürükle-bırakla taşımadan ve tüketici uygulamasından gelen **her** yazma işlemi
`store` üzerinden bu kapıdan geçer:

```js
const res = RZ.store.addReservation({ ... });
if (!res.ok) showError(res.errors[0].msg);   // kayıt oluşturulmadı
```

Kontrol edilenler: aynı kaynağın çakışması (hata), çalışma saatleri (hata),
kapalı kaynak (hata), personel çakışması (uyarı), geçmişe kayıt (uyarı).

Sürükle-bırakta doğrulama bırakmadan **önce** çalışır: geçersiz hedefte hayalet kutu
kırmızıya döner ve bırakma geri alınır.

### 2. Paketler koda dağılmaz — tek tablodan okunur

`plans.js` içinde her özelliğin adı, açıklaması, hangi paketten itibaren açık olduğu ve
**ek modül olarak ayrı satılıp satılamayacağı** tanımlıdır.

```js
RZ.plans.can(biz, 'deposit')      // açık mı? (pakete dahil VEYA ek modül)
RZ.plans.gate(biz, 'deposit')     // neden kapalı, nasıl açılır, fiyat farkı
RZ.plans.monthlyBill(biz)         // paket + ek modüller = aylık fatura
RZ.ui.guarded('deposit', render)  // kapalıysa bulanık önizleme + yükseltme kartı
```

Yeni bir modül eklemek için tek yapılacak: `FEATURES` içine bir kayıt, ilgili
paketlerin `features` dizisine anahtar, ekranda `RZ.ui.guarded(...)` ile sarmalama.
Menüdeki kilit, fatura satırı, yükseltme akışı ve tanıtım sayfasındaki paket tablosu
kendiliğinden güncellenir.

Kapora bilinçli olarak **iki yoldan** açılabilir: Pro pakete geçerek ya da Başlangıç
paketine 500 ₺/ay ek modül ekleyerek. Ankette kapora talebi %68 ile yaygın olduğu için
alt pakete de satılabilir tutuldu.

### 3. Ciro veri girişi istemez

`analytics.report()` yalnızca rezervasyon kayıtlarını okur:

- **gerçekleşen** = tamamlandı + geldi
- **beklenen** = onaylandı + onay bekliyor
- **kayıp** = gelmedi (no-show’un TL karşılığı)

Ön muhasebe yazılımlarından farkı budur: doldurulması unutulabilecek bir alan yoktur.
Bu yüzden uygulamadan gelmeyen (telefon, kapıdan, WhatsApp) rezervasyonlar da panele
girilir — ciro raporu işletmenin tamamını gösterir.

---

## Veri modeli (özet)

```js
Reservation {
  id, bizId, customerId | guestName, serviceId, resourceId, staffId,
  date: 'YYYY-MM-DD', start, end,        // gün içi dakika (0–1440) — saat dilimi derdi yok
  status: pending|confirmed|arrived|completed|no_show|cancelled,
  channel: app|phone|walkin|whatsapp,
  price, deposit: { amount, status: held|chargeable|charged|released }, note, packageId
}
```

`Business` üzerinde: `plan`, `addons[]`, `hours{0..6}`, `packageDefs[]`, `settings`, `smsUsed`.
Durum `localStorage`’da (`rezervle.state.v1`) saklanır; Ayarlar ekranından sıfırlanabilir.

---

## Demo notları

- Veri **tohumlu rastgele** üretilir: aynı tarihte hep aynı tabloyu verir.
- İki işletme gelir: **Gülveren Spor Tesisleri** (Pro, 4 kaynak) ve **Cinnah Güzellik**
  (Başlangıç, 3 kaynak + 3 personel). İkincisi kilitli modüllerin nasıl göründüğünü gösterir.
- Panelin üstündeki demo bandından paket değiştirilebilir; kilitler anında açılır/kapanır.
- Kapora akışında para hiçbir aşamada Rezervle’den geçmez — tahsilat işletmenin POS’undadır.
- Gömülü (iframe) ortamda tarayıcı dosya indirmeyi engeller; CSV dışa aktarım o durumda
  kopyalanabilir bir pencere açar.

## Sonraki adımlar (bu demoda yok)

Sunucu tarafı ve kimlik doğrulama, gerçek SMS sağlayıcısı, sanal POS entegrasyonu
(kart saklama/ön provizyon), çok şube veri modeli, rol bazlı yetki ve denetim izi,
tüketici uygulamasının mobil sürümü.
