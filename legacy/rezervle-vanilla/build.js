/* Rezervle — tek dosya derleyici
   node build.js
     dist/rezervle.html  → çift tıklayıp açılabilen tek parça uygulama
     dist/artifact.html  → gömülü ortam için gövde parçası (doctype/head yok) */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const CSS = ['assets/css/app.css'];
const JS = ['assets/js/core.js', 'assets/js/seed.js', 'assets/js/ui.js', 'assets/js/views.js', 'assets/js/app.js'];

const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
const ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2317161a'/><path fill='white' fill-rule='evenodd' d='M26 18h32c14 0 23 8.5 23 21.5 0 10-5.8 17.5-14.9 20.3L88 88H67L50 62h-4v26H26V18zm20 15v17h13c5.8 0 9.5-3 9.5-7.6 0-4.7-3.7-7.6-9.5-7.6H46z'/></svg>";

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = CSS.map((p) => `\n/* ===== ${p} ===== */\n` + read(p)).join('\n');
const js = JS.map((p) => `\n/* ===== ${p} ===== */\n` + read(p)).join('\n')
  .replace(/<\/script>/gi, '<\\/script>');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const standalone = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Rezervle — rezervasyon ve ciro takibi</title>
<meta name="description" content="Halı saha, kort ve salon işletmeleri için rezervasyon takvimi ve ciro takibi.">
<meta name="theme-color" content="#17161a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="icon" href="${ICON}">
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<div id="toast"></div>
<script>
${js}
</script>
</body>
</html>
`;

const artifact = `<title>Rezervle</title>
<style>
@import url("${FONTS}");
${css}
</style>
<div id="app"></div>
<div id="toast"></div>
<script>
${js}
</script>
`;

fs.writeFileSync(path.join(OUT, 'rezervle.html'), standalone, 'utf8');
fs.writeFileSync(path.join(OUT, 'artifact.html'), artifact, 'utf8');
const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB';
console.log('dist/rezervle.html  ' + kb(standalone));
console.log('dist/artifact.html  ' + kb(artifact));
