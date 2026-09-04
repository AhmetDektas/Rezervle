/* Rezervle — tek dosya derleyici
   Kullanım: node build.js
   Üretir:
     dist/rezervle.html  → çift tıklayıp açılabilen, tek parça tanıtım + panel
     dist/artifact.html  → Artifact/gömme için gövde parçası (doctype/head yok)
   Derleme aracı yok; index.html'deki dosya sırası burada da geçerlidir. */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const CSS = ['assets/css/base.css', 'assets/css/panel.css', 'assets/css/landing.css'];
const JS = [
  'assets/js/core/utils.js',
  'assets/js/core/plans.js',
  'assets/js/core/schedule.js',
  'assets/js/core/analytics.js',
  'assets/js/data/seed.js',
  'assets/js/core/store.js',
  'assets/js/ui/components.js',
  'assets/js/ui/booking.js',
  'assets/js/views/dashboard.js',
  'assets/js/views/calendar.js',
  'assets/js/views/reservations.js',
  'assets/js/views/customers.js',
  'assets/js/views/revenue.js',
  'assets/js/views/modules.js',
  'assets/js/views/settings.js',
  'assets/js/views/consumer.js',
  'assets/js/views/landing-consumer.js',
  'assets/js/views/landing-business.js',
  'assets/js/app.js',
];

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400..800&family=Source+Serif+4:opsz,wght@8..60,400..600&display=swap';
const TITLE = 'Rezervle';
const DESC = 'Rezervasyon, müşteri ve ciro tek panelde — halı saha, kuaför, güzellik salonu ve restoranlar için.';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const banner = (p) => `\n/* ===== ${p} ===== */\n`;

const css = CSS.map((p) => banner(p) + read(p)).join('\n');
const js = JS.map((p) => banner(p) + read(p)).join('\n');

/* Gömülü script'lerin erken kapanmasını önle */
const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* ---- 1) Bağımsız tek dosya ---- */
const standalone = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${TITLE} — Rezervasyon, müşteri ve ciro tek panelde</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#004e92">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%2300AEEF'/><stop offset='1' stop-color='%23004E92'/></linearGradient></defs><path fill='url(%23g)' fill-rule='evenodd' d='M20 10h37c15.6 0 26 9.6 26 24 0 11.2-6.4 19.5-16.6 22.7L88 90H63.5L44.2 60.5H40V90H20V10zm20 17v17h16c6.4 0 10.6-3.3 10.6-8.5S62.4 27 56 27H40z'/></svg>">
<style>
${css}
</style>
</head>
<body>
<a class="skip" href="#main">İçeriğe atla</a>
<a class="skip" href="#main">İçeriğe atla</a>
<div id="app"></div>
<div id="toasts"></div>
<script>
${safeJs}
</script>
</body>
</html>
`;

/* ---- 2) Artifact gövdesi (doctype/head yok) ---- */
const artifact = `<title>${TITLE}</title>
<style>
@import url("${FONTS}");
${css}
</style>
<div id="app"></div>
<div id="toasts"></div>
<script>
${safeJs}
</script>
`;

fs.writeFileSync(path.join(OUT, 'rezervle.html'), standalone, 'utf8');
fs.writeFileSync(path.join(OUT, 'artifact.html'), artifact, 'utf8');

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB';
console.log('dist/rezervle.html  ' + kb(standalone));
console.log('dist/artifact.html  ' + kb(artifact));
console.log(`${CSS.length} css + ${JS.length} js dosyası tek parçaya alındı.`);
