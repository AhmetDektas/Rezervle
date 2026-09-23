# Rezzerv Android

İki uygulama, tek Gradle modülü:

| Çeşni | Paket adı | Ad | Açılış adresi |
|---|---|---|---|
| `musteri` | `com.rezzerv.app` | Rezzerv | `/` |
| `isletme` | `com.rezzerv.isletme` | Rezzerv İşletme | `/panel` |

## Nasıl çalışıyor

Bu bir **Trusted Web Activity**. Uygulamanın kendi arayüzü yok; telefondaki
Chrome motorunu adres çubuğu olmadan tam ekran açıp siteyi gösteriyor.

Sonuçları:

- Web'de düzelttiğin şey, mağaza güncellemesi beklemeden telefonda da düzelir.
- Web Push olduğu gibi çalışır; Firebase'e gerek yok. Bildirim, Chrome'un
  değil uygulamanın adıyla görünür (`DelegationService`).
- APK ~1 MB.
- Sitenin bağlantıları uygulamada açılır (derin bağlantı).

## Adres çubuğu görünüyorsa

Tek sebebi vardır: **parmak izi eşleşmiyor.**

`https://<alan-adı>/.well-known/assetlinks.json` içindeki
`sha256_cert_fingerprints`, APK'yı imzalayan anahtarın parmak izi olmak
zorunda. Kontrol:

```bash
apksigner verify --print-certs app-musteri-release.apk
```

CI bu karşılaştırmayı her derlemede yapıyor ve tutmazsa derlemeyi düşürüyor
(`.github/workflows/android.yml`).

> **Play App Signing'e geçilirse** Google APK'yı KENDİ anahtarıyla yeniden
> imzalar ve parmak izi değişir. O gün `assetlinks.json` Play Console'daki
> "App signing key certificate" parmak iziyle güncellenmeli, yoksa mağazadan
> kurulan uygulamada adres çubuğu çıkar.

## İmzalama anahtarı

- Depo: `~/.rezzerv/android/rezzerv-release.p12`, parola yanındaki
  `parola.txt` dosyasında. **Depoya girmez** (`.gitignore`).
- CI: `ANDROID_KEYSTORE_BASE64` ve `ANDROID_KEYSTORE_PASSWORD` gizli değerleri.

Bu anahtar kaybolursa aynı uygulamanın güncellemesi bir daha yayınlanamaz —
kullanıcılar uygulamayı silip yenisini kurmak zorunda kalır. Yedekle.

## Alan adı değişince

Tek yer: `android/app/build.gradle` içindeki `siteHost`. Ya da derlemede
`-PrezzervHost=yeni.alan.com`. Ardından `public/.well-known/assetlinks.json`
yeni alan adından sunulmalı.

## Derleme

Derleme GitHub Actions'ta yapılıyor (`Android APK` iş akışı); APK'lar çalışma
sayfasındaki `rezzerv-apk` eserinden indirilir.

Yerelde derlemek için JDK 17 + Android SDK gerekir:

```bash
cd android
REZZERV_KEYSTORE_FILE=~/.rezzerv/android/rezzerv-release.p12 \
REZZERV_KEYSTORE_PASSWORD="$(cat ~/.rezzerv/android/parola.txt)" \
REZZERV_KEY_ALIAS=rezzerv \
REZZERV_KEY_PASSWORD="$(cat ~/.rezzerv/android/parola.txt)" \
gradle assembleRelease
```

Anahtar olmadan `assembleDebug` çalışır ama hata ayıklama anahtarı
assetlinks ile eşleşmediği için o sürümde adres çubuğu görünür.
