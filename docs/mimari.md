# Rezzerv — Mimari

Bu belge sistemin **neden böyle** olduğunu anlatır. Ne olduğunu koddan
okuyabilirsiniz; burada yazan, koda bakınca görünmeyen kararlar ve bedelleri.

---

## 1. Süreçler

Sistem dört süreçten oluşuyor. Başlangıçta tek süreçti; üçü sonradan
eklendi ve her biri belirli bir arızayı kapatmak için var.

```
┌──────────────┐        ┌──────────────┐
│  Next.js web │───────▶│  PostgreSQL  │
│  (3000)      │        │  (5432)      │
└──────┬───────┘        └──────▲───────┘
       │                       │
       │ kuyruğa iş            │
       ▼                       │
┌──────────────┐        ┌──────┴───────┐
│  Redis       │◀───────│  Worker      │
│  (6379)      │        │  (ayrı süreç)│
└──────────────┘        └──────────────┘
```

| Süreç | Ne yapar | Neden ayrı |
|---|---|---|
| **web** | Sayfalar, server action'lar, webhook rotası | — |
| **worker** | Hatırlatma, ödeme süre taraması | İstek döngüsü dışında çalışması gerekiyor |
| **PostgreSQL** | Kalıcı veri | Çakışma engeli DB eşzamanlılık garantilerine dayanıyor |
| **Redis** | Kuyruk + hız sınırı sayacı | Kuyruk zaten istiyordu; sayaç için ikinci altyapı gerekmedi |

**Worker aynı barındırmada ikinci süreç** (S9-1). Tek dağıtım, tek sürüm: web
ile worker arasında sürüm uyuşmazlığı yaşanmıyor. Bedeli, dağıtımın ikisini
birden yeniden başlatması — uçuştaki işler kesilebiliyor. Zarif kapanış
(`WORKER_SHUTDOWN_TIMEOUT_MS`) bunun için var, idempotens kayıtları ikinci
savunma hattı.

**PgBouncer yok** (D2). S7-1 havuzlayıcı seçmişti ama S9-1 tek uzun ömürlü
sunucu modelini seçince gerekçesi kalmadı: web + worker ~18 bağlantı açıyor,
Postgres varsayılanı 100. Havuzlayıcı sıfır fayda, artı işletme yükü.

---

## 2. Yazma kapısı

Her yazma tek bir yoldan geçiyor: **server action** → `run()` → `src/server/*`.

```
form ──▶ server action ──▶ run(ctx) ──▶ src/server/* ──▶ Prisma
                              │
                              ├─ DomainError  ──▶ kullanıcıya mesaj
                              └─ beklenmeyen  ──▶ loglanır, genel hata
```

`src/lib/*` ile `src/server/*` ayrımı bilinçli: `lib` saf (veritabanı bilmez,
test edilmesi ucuz), `server` `server-only` ile işaretli ve istemciye
sızamıyor.

`ActionResult` tipi hata dönüşünü zorunlu kılıyor: `{ ok: false, error }`
okunmadan kullanıcıya bir şey gösterilemiyor.

---

## 3. Çifte rezervasyon: üç katman

Aynı saati iki kişiye satmak bu üründeki en pahalı hata. Üç ayrı katmanla
engelleniyor ve her katmanın ayrı bir amacı var:

1. **Müsaitlik motoru** (`src/lib/availability.ts`) — dolu saati hiç
   göstermiyor. Kullanıcı deneyimi katmanı; yarış durumunu çözmez.
2. **İşlem içi yeniden kontrol** — kayıt yazılmadan hemen önce çakışma
   sorgusu. Çoğu yarışı yakalar.
3. **`slotKey` tekil kısıtı** — `staffId:date:startMin`. Veritabanı düzeyinde
   son söz. İptalde `null`'a çekiliyor (NULL'lar tekilliği tetiklemez), saat
   yeniden satılabiliyor.

Üçüncüsü olmadan ilk ikisi yeterli görünür ve nadiren, üretimde, açıklanamayan
çift kayıtlar olarak geri döner.

---

## 4. Ödeme akışı

**Asenkron**, çünkü Türkiye'de kart ödemesi 3D Secure'dan geçiyor.

```
createReservation
   │
   ├─ kapora yok ──▶ randevu hazır
   │
   └─ kapora var ──▶ charge() ──▶ PENDING + redirectUrl
                                      │
                     müşteri bankaya gider (siteden AYRILIR)
                                      │
        ┌─────────────────────────────┼──────────────────────────┐
        ▼                             ▼                          ▼
   payment.paid                 payment.failed              hiç dönmez
        │                             │                          │
   depositStatus=PAID          iptal, slot serbest      paymentDeadline dolar
   settlement=HELD                                       ──▶ worker iptal eder
```

Üç sonucun üçü de gerçek. Eskiden `charge()` senkron `PAID` dönüyordu —
ödemenin sonucunu bilmeden bildiğimizi varsaymak. Terk senaryosu hiç
yaşanmıyordu çünkü ayrılma diye bir adım yoktu.

### Pazaryeri bölüşümü

Müşteri kaporayı tek seferde öder; **lisanslı ödeme kuruluşu** tutarı ödeme
anında böler. Platform komisyonu bizim üye işyeri hesabımıza geçer, işletme
payı kuruluşta **bloke** kalır (`settlementStatus: HELD`). Randevu
sonuçlanınca ya serbest bırakılır (`RELEASED`) ya da tümü iade edilir
(`REFUNDED`, komisyon dahil).

Bu ayrım hukuki: müşteri parasını toplayıp sonra dağıtmak **6493 sayılı
Kanun** kapsamında ödeme hizmetidir ve lisans gerektirir. Parayı lisanslı
kuruluşta tutarak bu yükümlülüğe girmiyoruz.

### Webhook sözleşmesi

`POST /api/odeme/webhook`

| Başlık | Değer |
|---|---|
| `x-rezzerv-signature` | Ham gövdenin HMAC-SHA256 imzası |

Gövde:

```json
{
  "id": "saglayici_olay_kimligi",
  "type": "payment.paid | payment.failed",
  "providerRef": "saglayici_odeme_referansi",
  "reference": "REZZERV_RANDEVU_KODU",
  "reason": "yalnizca failed icin"
}
```

Yanıtlar:

| Kod | Anlamı | Sağlayıcı ne yapmalı |
|---|---|---|
| 200 | İşlendi ya da zaten işlenmişti | Tekrar denemesin |
| 400 | İmza geçersiz | Tekrar denemesin |
| 500 | Bizim tarafta arıza | **Tekrar denesin** |

**İdempotens:** `ProcessedEvent` tablosunun birincil anahtarı sağlayıcının
olay kimliği. Damga işlemin İÇİNDE yazılıyor; çakışırsa işlem bütünüyle geri
alınıyor ve etki iki kez uygulanmıyor. Teslimat garantisi "en az bir kez"
olduğu için bu tercih değil, zorunluluk.

**Hız sınırı yok ve bu bilinçli (E4).** Sağlayıcı başarısız teslimatı tekrar
dener; tekrarlar sınıra takılsaydı sağlayıcı vazgeçer ve ödeme durumu kalıcı
olarak yarım kalırdı. Buranın koruması sınır değil, imza.

Ham gövde üzerinden imza doğrulanıyor: JSON'a çevirip yeniden dizmek anahtar
sırasını değiştirir ve imza tutmaz.

---

## 5. Arka plan işleri

Tek sözleşme: `defineJob` (`src/worker/define-job.ts`).

| İş | Sıklık | Ne yapar |
|---|---|---|
| `odeme-suresi-doldu` | 1 dk | Süresi geçen 3DS kayıtlarını iptal eder, saati açar |
| `randevu-hatirlatma` | 5 dk | 24 saat kalan randevular için hatırlatma |

Ortak davranış:

- **Kuyruğa atmak asıl işlemi düşürmez.** Randevu oluştu ve iş kuyruğa
  atılamadıysa randevu yine geçerli (GAP-1'in dersi).
- **İş gövdesindeki hata YÜKSELİR.** BullMQ görmeli ki yeniden deneme ve ölü
  mektup çalışsın.
- **Tükenmiş işler silinmiyor** (`removeOnFail: false`) — ölü mektup kutusu
  bu listenin kendisi, `/yonetim/kuyruk` onu okuyor.

İdempotens her işte ayrı: `reminderSentAt` damgası, `paymentDeadline` koşullu
güncelleme. Yeniden deneme olan yerde "iki kez çalışırsa ne olur" sorusunun
cevabı yazılı olmalı.

---

## 6. Log sözleşmesi

**Kimlik evet, içerik hayır.**

Loglanır: `userId`, `businessId`, `reservationId`, durum kodları, hata adı.
Loglanmaz: ad, telefon, e-posta, adres, serbest metin, webhook gövdesi.

Sebebi: loglar KVKK yüzeyi. Bir hata ayıklama satırı yüzünden kişisel veriyi
üçüncü taraf log servisine göndermek, uygulamanın kendisinde alınan tüm
önlemleri boşa çıkarır.

---

## 7. KVKK

| Kayıt | Ne zaman | Geri alınabilir mi |
|---|---|---|
| `AYDINLATMA` | Kayıt anında | Hayır — bilgilendirilmiş olmak geri alınmaz |
| `ACIK_RIZA` | Kayıt anında | **Evet** (KVKK m.7), profilden |

Açık rıza yaptırımı **yalnızca ONLINE kanalda**: diş, veteriner ve estetik
randevusu sağlığa dair çıkarım taşır (m.6). Panelden açılan telefon
randevusunda müşteri klavyenin başında değil; rızayı alan taraf işletmenin
kendisi.

Rıza kaydı silinmiyor, `revokedAt` ile kapatılıyor: "ne zaman verildi, ne
zaman geri alındı" ikisi de kanıt.

---

## 8. Hız sınırı

Katılım **isteğe bağlı**: middleware değil, her eylemin kendisi çağırıyor.
Webhook'u muaf tutmayı unutmak böylece imkânsız (E4).

| Yüzey | Sınır | Anahtar |
|---|---|---|
| Giriş | 10 / 15 dk | IP — yalnızca **başarısız** denemeler |
| Kayıt | 20 / saat | IP |
| İşletme başvurusu | 10 / saat | IP |
| Randevu | 15 / saat | kullanıcı |
| Değerlendirme | 10 / saat | kullanıcı |

**Arıza duruşu açık:** Redis erişilemezse istek geçer ve uyarı loglanır.
Tersi, bir Redis kesintisini tam site kesintisine çevirirdi. Bedeli açık:
kesinti sırasında koruma yok.

`REDIS_URL` tanımsızsa sınır **sessizce devre dışı kalır** — üretimde mutlaka
tanımlı olmalı. Uyarı satırı bu yüzden var.

---

## 9. Ölçüm

İki taraflı huni (`/yonetim/analitik`), **olay tablosu olmadan** mevcut
veriden türetiliyor. Yazmadığımız veri bozulamıyor, kuyruk arızasında
kaybolamıyor ve geriye dönük olarak da doğru.

**Ölçülmeyen: ziyaret.** Sayfa görüntüleme takibi çerez ve açık rıza
gerektiriyor; KVKK yüzeyini genişletmemek için kapsam dışı. Eksik olduğunu
bilmek, yanlış ölçmekten iyi.

---

## 10. Ortam değişkenleri

`.env.example` tam listeyi taşıyor. Kritik olanlar:

| Değişken | Yoksa ne olur |
|---|---|
| `DATABASE_URL` | Uygulama açılmaz |
| `AUTH_SECRET` | Oturum imzalanamaz |
| `REDIS_URL` | Worker açılmaz, **hız sınırı sessizce kapanır** |
| `DEPOSITS_ENABLED=false` | Kapora tahsilatı platform çapında durur (T16) |

`NEXT_PUBLIC_APP_URL` yalnızca istek bağlamı olmayan yerlerde son çare;
ödeme yönlendirmesi ve webhook çağrısı kaynağı **istekten** okuyor
(`requestOrigin`). Sabit port varsayımı, farklı portta çalışırken sessizce
yanlış sunucuya gitmek demekti.

---

## 11. Test katmanları

| Katman | Neyi sorar | Nerede |
|---|---|---|
| Birim | Saf mantık doğru mu | `tests/unit` |
| Entegrasyon | Veritabanı/Redis ile davranış doğru mu | `tests/integration` |
| E2E | Kullanıcı gerçekten yapabiliyor mu | `tests/e2e` |

Entegrasyon testleri **ayrı bir veritabanı** kullanıyor (`rezzerv_test`);
`prisma db push --force-reset` tüm veritabanını sıfırladığı için şema bazlı
ayrım geliştirme verisini her koşuda silerdi.

CI iki katmanlı: her push'ta hızlı iş (tip + lint + birim/entegrasyon), PR ve
main'de E2E. E2E yerelde ~17 dk; her push'ta koşarsa insanlar CI'a bakmayı
bırakır.
