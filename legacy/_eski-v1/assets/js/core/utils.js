/* Rezervle — cekirdek yardimcilar
   Global ad alani: RZ. Derleme adimi yok; dosyalar sirayla yuklenir. */
window.RZ = window.RZ || {};

(function (RZ) {
  'use strict';

  /* ---------------- DOM ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Hafif hyperscript: el('div.card', {onclick}, child, ...) */
  function el(spec, attrs, ...kids) {
    const m = /^([a-z0-9]+)?([.#][^\s]*)?$/i.exec(spec) || [];
    const tag = m[1] || 'div';
    const node = document.createElement(tag);
    if (m[2]) {
      m[2].split('.').filter(Boolean).forEach((tok) => {
        if (tok.startsWith('#')) node.id = tok.slice(1);
        else tok.split('#').forEach((t, i) => (i === 0 ? node.classList.add(t) : (node.id = t)));
      });
    }
    // attrs yalnizca duz nesne ise ozellik torbasidir; sayi/metin/dugum/dizi cocuk sayilir
    const isAttrs = attrs != null && typeof attrs === 'object' && !attrs.nodeType && !Array.isArray(attrs);
    if (!isAttrs) {
      if (attrs !== undefined) kids.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'data' && typeof v === 'object') Object.entries(v).forEach(([dk, dv]) => (node.dataset[dk] = dv));
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    append(node, kids);
    return node;
  }

  function append(node, kids) {
    kids.flat(4).forEach((k) => {
      if (k == null || k === false) return;
      node.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    });
  }

  const frag = (...kids) => {
    const f = document.createDocumentFragment();
    append(f, kids);
    return f;
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ---------------- Bicimlendirme ---------------- */
  const nf = new Intl.NumberFormat('tr-TR');
  const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

  const fmtNum = (n) => nf.format(Math.round(n || 0));

  /** 12400 -> "12.400 ₺" · compact: "12,4B ₺" */
  function tl(n, opts) {
    n = Math.round(n || 0);
    const o = opts || {};
    if (o.compact && Math.abs(n) >= 1000) {
      const v = n / 1000;
      return (Math.abs(n) >= 1000000 ? nf1.format(n / 1000000) + 'M' : nf1.format(v) + 'B') + ' ₺';
    }
    return nf.format(n) + ' ₺';
  }

  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const pctStr = (n) => '%' + nf1.format(n || 0);

  /* ---------------- Tarih / saat ---------------- */
  const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const GUN_K = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const AY_K = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  const pad2 = (n) => String(n).padStart(2, '0');

  /** Date -> 'YYYY-MM-DD' (yerel saat) */
  const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  /** 'YYYY-MM-DD' -> Date (yerel gece yarisi) */
  function fromKey(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

  /** Haftanin ilk gunu: Pazartesi */
  function startOfWeek(d) {
    const s = startOfDay(d);
    const wd = (s.getDay() + 6) % 7;
    return addDays(s, -wd);
  }
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const sameDay = (a, b) => dayKey(a) === dayKey(b);
  const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);

  /** Gun ici dakika (0-1440) */
  const minsOfDay = (d) => d.getHours() * 60 + d.getMinutes();

  /** 570 -> '09:30' · 1440 -> '24:00' (gece yarisi kapanis) */
  const hhmm = (mins) => {
    const h = Math.floor(mins / 60);
    return `${pad2(h > 24 ? h % 24 : h)}:${pad2(Math.round(mins) % 60)}`;
  };

  const timeStr = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  /** Tarihi Turkce yaz. style: 'short' | 'long' | 'dayName' | 'monthYear' */
  function dateStr(d, style) {
    switch (style) {
      case 'long':
        return `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}, ${GUN[d.getDay()]}`;
      case 'dayName':
        return `${d.getDate()} ${AY_K[d.getMonth()]} ${GUN_K[d.getDay()]}`;
      case 'monthYear':
        return `${AY[d.getMonth()]} ${d.getFullYear()}`;
      case 'md':
        return `${d.getDate()} ${AY_K[d.getMonth()]}`;
      default:
        return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    }
  }

  /** "3 gün önce" / "yarın" gibi goreli ifade */
  function relDay(d, ref) {
    const n = diffDays(d, ref || new Date());
    if (n === 0) return 'bugün';
    if (n === 1) return 'yarın';
    if (n === -1) return 'dün';
    if (n < 0) return `${-n} gün önce`;
    return `${n} gün sonra`;
  }

  const parseTime = (s) => {
    const [h, m] = String(s).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  /* ---------------- Genel ---------------- */
  let seq = 0;
  const uid = (p) => `${p || 'id'}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const sum = (arr, f) => arr.reduce((t, x) => t + (f ? f(x) : x || 0), 0);

  function groupBy(arr, f) {
    const m = new Map();
    arr.forEach((x) => {
      const k = f(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    });
    return m;
  }

  const initials = (name) =>
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toLocaleUpperCase('tr-TR');

  /** Turkce'ye duyarli arama normalizasyonu */
  function norm(s) {
    return String(s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
      .trim();
  }

  const phoneFmt = (p) => {
    const d = String(p).replace(/\D/g, '').slice(-10);
    return d.length === 10 ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : p;
  };

  function debounce(fn, ms) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms || 220);
    };
  }

  /** Tohumlu rastgele — demo verisi her acilista ayni olsun diye */
  function rng(seed) {
    let s = seed >>> 0 || 42;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  /* ---------------- Ikonlar (24x24 stroke) ---------------- */
  const ICONS = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M12 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M17 11a2.5 2.5 0 1 0 0-5M21 19v-1a3.5 3.5 0 0 0-2.5-3.3',
    trend: 'M4 19V5M4 19h16M8 15l3.5-4 3 2.5L20 8',
    wallet: 'M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2M3 9h15a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 13.5h.01',
    box: 'M12 3l8 4.2v9.6L12 21l-8-4.2V7.2zM4 7.2l8 4.3 8-4.3M12 11.5V21',
    mega: 'M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6',
    cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2l.4 2.7h4.4l.4-2.7c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    chevL: 'M15 5l-7 7 7 7',
    chevR: 'M9 5l7 7-7 7',
    chevD: 'M6 9l6 6 6-6',
    check: 'M4 12.5l5 5L20 6.5',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    menu: 'M4 6h16M4 12h16M4 18h16',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
    alert: 'M12 4l9 16H3zM12 10v4M12 17.5h.01',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.2l3.2 2',
    phone: 'M6 3h3l2 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 5.2 2 2 0 0 1 6 3z',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
    arrowUp: 'M12 19V5M6 11l6-6 6 6',
    arrowDown: 'M12 5v14M6 13l6 6 6-6',
    star: 'M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z',
    ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
    building: 'M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M13 10h6a1 1 0 0 1 1 1v10M7 9h3M7 13h3M7 17h3M16 14h1M16 18h1M3 21h18',
    logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h11',
    filter: 'M4 5h16l-6.2 7.3V19l-3.6-2v-4.7z',
    download: 'M12 4v11M8 11.5l4 4 4-4M5 20h14',
    sms: 'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1zM8 10.5h.01M12 10.5h.01M16 10.5h.01',
    repeat: 'M4 10V8a3 3 0 0 1 3-3h10l-3-3M20 14v2a3 3 0 0 1-3 3H7l3 3',
    shield: 'M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6z',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  };

  /** SVG ikon dizesi dondurur */
  function icon(name, size, cls) {
    const d = ICONS[name] || ICONS.grid;
    const s = size || 18;
    return `<svg class="${cls || 'ico'}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  /**
   * Rezervle marka isareti: #00AEEF -> #004E92 gradyanli geometrik R.
   * Her cagrida benzersiz gradyan kimligi uretilir, ayni sayfada birden fazla
   * kullanildiginda gradyanlar birbirini ezmez.
   */
  function logoMark(size) {
    const id = 'rzg' + (seq++).toString(36);
    const s = size || 30;
    return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" role="img" aria-label="Rezervle">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#00AEEF"/><stop offset="1" stop-color="#004E92"/></linearGradient></defs>
<path fill="url(#${id})" fill-rule="evenodd" d="M20 10h37c15.6 0 26 9.6 26 24 0 11.2-6.4 19.5-16.6 22.7L88 90H63.5L44.2 60.5H40V90H20V10zm20 17v17h16c6.4 0 10.6-3.3 10.6-8.5S62.4 27 56 27H40z"/>
</svg>`;
  }

  /**
   * Mekan kapagi: ucuz iki duraklı gradyan yerine mekanin kendi cizgisi.
   * Hali saha icin saha cizgileri, guzellik icin ampullu ayna, kuafor icin tarak.
   * Koyu zemin + sicak projektor isigi; stok fotograf yok, cevrimdisi calisir.
   */
  function venueArt(category, opts) {
    const o = opts || {};
    const h = o.height || 82;
    const id = 'va' + (seq++).toString(36);
    const art = {
      'Halı saha & tenis kortu': {
        ground: '#0a1a16',
        art:
          '<rect x="8" y="8" width="384" height="150" rx="2"/>' +
          '<line x1="200" y1="8" x2="200" y2="158"/>' +
          '<circle cx="200" cy="83" r="34"/>' +
          '<rect x="8" y="41" width="46" height="84"/>' +
          '<rect x="346" y="41" width="46" height="84"/>' +
          '<path d="M8 20 A12 12 0 0 0 20 8"/><path d="M392 20 A12 12 0 0 1 380 8"/>',
      },
      'Güzellik salonu': {
        ground: '#1a1020',
        art:
          '<ellipse cx="200" cy="83" rx="70" ry="86"/>' +
          '<ellipse cx="200" cy="83" rx="56" ry="72"/>' +
          '<circle cx="122" cy="40" r="6"/><circle cx="106" cy="83" r="6"/><circle cx="122" cy="126" r="6"/>' +
          '<circle cx="278" cy="40" r="6"/><circle cx="294" cy="83" r="6"/><circle cx="278" cy="126" r="6"/>',
      },
      'Kuaför': {
        ground: '#0b1424',
        art:
          '<line x1="120" y1="34" x2="120" y2="132"/><line x1="148" y1="26" x2="148" y2="140"/>' +
          '<line x1="176" y1="34" x2="176" y2="132"/><line x1="204" y1="26" x2="204" y2="140"/>' +
          '<line x1="232" y1="34" x2="232" y2="132"/><line x1="260" y1="26" x2="260" y2="140"/>' +
          '<line x1="288" y1="34" x2="288" y2="132"/>' +
          '<path d="M96 83 h224" />',
      },
    }[category] || { ground: '#0c1622', art: '<circle cx="200" cy="83" r="52"/><circle cx="200" cy="83" r="86"/>' };

    return `<svg class="venue-art" viewBox="0 0 400 166" preserveAspectRatio="xMidYMid slice" style="width:100%;height:${h}px;display:block" aria-hidden="true">
<defs><radialGradient id="${id}" cx="50%" cy="-8%" r="86%">
<stop offset="0" stop-color="#ffc46b" stop-opacity=".38"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/>
</radialGradient></defs>
<rect width="400" height="166" fill="${art.ground}"/>
<g fill="none" stroke="#ffffff" stroke-opacity=".20" stroke-width="1.6">${art.art}</g>
<rect width="400" height="166" fill="url(#${id})"/>
</svg>`;
  }

  /** SVG ikon DOM dugumu */
  function iconEl(name, size, cls) {
    const w = document.createElement('span');
    w.style.display = 'inline-flex';
    w.innerHTML = icon(name, size, cls);
    return w.firstChild;
  }

  RZ.util = {
    $, $$, el, frag, esc, append,
    fmtNum, tl, pct, pctStr, nf,
    GUN, GUN_K, AY, AY_K, pad2, dayKey, fromKey, startOfDay, addDays, addMonths,
    startOfWeek, startOfMonth, endOfMonth, sameDay, diffDays, minsOfDay, hhmm, timeStr,
    dateStr, relDay, parseTime,
    uid, clamp, sum, groupBy, initials, norm, phoneFmt, debounce, rng, pick,
    icon, iconEl, logoMark, venueArt, ICONS,
  };
})(window.RZ);
