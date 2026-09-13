/**
 * SVG simgelerden PNG üretir.
 *
 * NEDEN GEREKLİ: manifest'te yalnızca SVG vardı. Chrome SVG simgeyi kabul
 * ediyor ama Android'in eski sürümleri, Play Store ve iOS'un
 * `apple-touch-icon`'u PNG istiyor — SVG verildiğinde simge ya boş çıkıyor ya
 * da varsayılan tarayıcı simgesine düşüyor. "Ana ekrana ekle" dendiğinde
 * uygulamanın adının yanında boş bir kare görünmesi tam olarak buydu.
 *
 * NEDEN DEPOYA İŞLENİYOR: üretilen PNG'ler `public/` altına yazılıyor ve
 * commit ediliyor. Dağıtım sırasında üretmek, dağıtımı bir görsel kütüphanesine
 * bağımlı kılardı; simgeler yılda bir değişen dosyalar.
 *
 *   node scripts/ikon-uret.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** @type {{ kaynak: string, cikti: string, boyut: number }[]} */
const ISLER = [
  // Müşteri uygulaması
  { kaynak: 'icon.svg', cikti: 'icon-192.png', boyut: 192 },
  { kaynak: 'icon.svg', cikti: 'icon-512.png', boyut: 512 },
  { kaynak: 'icon-maskable.svg', cikti: 'icon-maskable-512.png', boyut: 512 },
  // apple-touch-icon: iOS köşe yuvarlamayı kendi uyguluyor ve saydamlığı
  // siyaha çeviriyor, bu yüzden düz zeminli maskelenebilir sürümden üretiliyor.
  { kaynak: 'icon-maskable.svg', cikti: 'apple-touch-icon.png', boyut: 180 },

  // İşletme uygulaması
  { kaynak: 'isletme-icon.svg', cikti: 'isletme-icon-192.png', boyut: 192 },
  { kaynak: 'isletme-icon.svg', cikti: 'isletme-icon-512.png', boyut: 512 },
  { kaynak: 'isletme-icon-maskable.svg', cikti: 'isletme-icon-maskable-512.png', boyut: 512 },
  { kaynak: 'isletme-icon-maskable.svg', cikti: 'isletme-apple-touch-icon.png', boyut: 180 },
];

for (const { kaynak, cikti, boyut } of ISLER) {
  const svg = await readFile(join(KOK, kaynak));
  // density: sharp SVG'yi önce raster'a çeviriyor; varsayılan 72 DPI'da
  // 32 birimlik viewBox 32 piksele iniyor ve büyütünce bulanıklaşıyordu.
  // Hedef boyutu doğrudan vererek keskin kenar alıyoruz.
  const png = await sharp(svg, { density: (boyut / 32) * 72 })
    .resize(boyut, boyut, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(KOK, cikti), png);
  console.log(`  ${cikti.padEnd(34)} ${boyut}×${boyut}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log(`\n${ISLER.length} simge üretildi.`);
