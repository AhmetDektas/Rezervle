/* Rezervle — çekirdek: yardımcılar, rezervasyon motoru, ciro hesabı, durum
   Tek kural: her rezervasyon aynı kapıdan geçer. Çakışan bir kayıt hiçbir
   yoldan içeri giremez, ciro da elle girilmez — kayıtlardan hesaplanır. */
window.RZ = {};

/* ============================ Yardımcılar ============================ */
RZ.u = (function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /** el('div.row', {onclick}, child…) — attrs yalnızca düz nesne ise attrs'tır */
  function el(spec, attrs, ...kids) {
    const m = /^([a-z0-9]+)?([.#][^\s]*)?$/i.exec(spec) || [];
    const n = document.createElement(m[1] || 'div');
    if (m[2]) m[2].split('.').filter(Boolean).forEach((t) => {
      if (t[0] === '#') n.id = t.slice(1);
      else t.split('#').forEach((x, i) => (i ? (n.id = x) : n.classList.add(x)));
    });
    const isAttrs = attrs != null && typeof attrs === 'object' && !attrs.nodeType && !Array.isArray(attrs);
    if (!isAttrs) { if (attrs !== undefined) kids.unshift(attrs); attrs = null; }
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      // class ekler, ezmez: spec'ten gelen sınıflar korunur
      if (k === 'class') n.className += (n.className ? ' ' : '') + v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'data' && typeof v === 'object') Object.entries(v).forEach(([a, b]) => (n.dataset[a] = b));
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(4).forEach((k) => { if (k != null && k !== false) n.appendChild(k.nodeType ? k : document.createTextNode(String(k))); });
    return n;
  }

  const nf = new Intl.NumberFormat('tr-TR');
  const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
  const num = (v) => nf.format(Math.round(v || 0));
  /** 12400 → "12.400 ₺" · kısa: "12,4B ₺" */
  function money(v, short) {
    v = Math.round(v || 0);
    if (short && Math.abs(v) >= 1000) {
      return (Math.abs(v) >= 1e6 ? nf1.format(v / 1e6) + 'M' : nf1.format(v / 1000) + 'B') + ' ₺';
    }
    return nf.format(v) + ' ₺';
  }
  const pctS = (v) => '%' + nf1.format(Math.abs(v) || 0);

  const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const GUNK = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const AYK = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const p2 = (n) => String(n).padStart(2, '0');

  const key = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addM = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  const week0 = (d) => addD(day0(d), -((d.getDay() + 6) % 7));
  const month0 = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const month1 = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const diffD = (a, b) => Math.round((day0(a) - day0(b)) / 864e5);
  const mins = (d) => d.getHours() * 60 + d.getMinutes();
  /** 570 → "09:30" · 1440 → "24:00" */
  const hm = (m) => { const h = Math.floor(m / 60); return `${p2(h > 24 ? h % 24 : h)}:${p2(Math.round(m) % 60)}`; };
  const parseHM = (s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  function date(d, f) {
    switch (f) {
      case 'long': return `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()}, ${GUN[d.getDay()]}`;
      case 'day': return `${d.getDate()} ${AYK[d.getMonth()]} ${GUNK[d.getDay()]}`;
      case 'md': return `${d.getDate()} ${AYK[d.getMonth()]}`;
      case 'my': return `${AY[d.getMonth()]} ${d.getFullYear()}`;
      default: return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
    }
  }
  function rel(d) {
    const n = diffD(d, new Date());
    return n === 0 ? 'bugün' : n === 1 ? 'yarın' : n === -1 ? 'dün'
      : n < 0 ? `${-n} gün önce` : `${n} gün sonra`;
  }

  let seq = 0;
  const id = (p) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
  const sum = (a, f) => a.reduce((t, x) => t + (f ? f(x) : x || 0), 0);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const phone = (p) => {
    const d = String(p).replace(/\D/g, '').slice(-10);
    return d.length === 10 ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : p;
  };
  const norm = (s) => String(s || '').toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c').trim();
  const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toLocaleUpperCase('tr-TR');
  function debounce(f, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => f.apply(this, a), ms || 220); }; }
  function rng(seed) {
    let s = seed >>> 0 || 7;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /* 20x20 çizgi ikon seti */
  const I = {
    cal: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v4M16 3v4',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M12 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M17 11a2.5 2.5 0 1 0 0-5',
    chart: 'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6',
    cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12c0-.4 0-.8-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2l.4 2.7h4.4l.4-2.7c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
    plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
    left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', down: 'M6 9l6 6 6-6',
    check: 'M4 12.5l5 5L20 6.5', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    menu: 'M4 6h16M4 12h16M4 18h16', sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
    phone: 'M6 3h3l2 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 5.2 2 2 0 0 1 6 3z',
    door: 'M4 21V4h9v17M13 12h6v9M3 21h18M9.5 12h.01',
    chat: 'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z', ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.2l3.2 2',
    down2: 'M12 4v11M8 11.5l4 4 4-4M5 20h14', repeat: 'M4 10V8a3 3 0 0 1 3-3h10l-3-3M20 14v2a3 3 0 0 1-3 3H7l3 3',
    alert: 'M12 4l9 16H3zM12 10v4M12 17.5h.01',
  };
  const icon = (n, s) =>
    `<svg width="${s || 17}" height="${s || 17}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[n] || I.cal}"/></svg>`;

  /** Marka işareti — sade, tek renk */
  const mark = (s) =>
    `<svg width="${s || 24}" height="${s || 24}" viewBox="0 0 100 100" role="img" aria-label="Rezervle"><path fill="currentColor" fill-rule="evenodd" d="M18 8h38c16 0 26.5 9.8 26.5 24.5 0 11.4-6.6 20-17 23.2L88 92H63L43.5 62H38v30H18V8zm20 17.5V45h16.5c6.6 0 10.9-3.4 10.9-8.7 0-5.4-4.3-8.8-10.9-8.8H38z"/></svg>`;

  return { $, $$, el, num, money, pctS, GUN, GUNK, AYK, AY, p2, key, fromKey, day0, addD, addM,
    week0, month0, month1, diffD, mins, hm, parseHM, date, rel, id, sum, clamp, phone, norm,
    initials, debounce, rng, icon, mark };
})();

/* ========================= Rezervasyon motoru ========================= */
RZ.sched = (function () {
  const u = RZ.u;
  const LIVE = ['pending', 'confirmed', 'arrived', 'done'];
  const live = (r) => LIVE.includes(r.status);

  const STATUS = {
    pending:   { t: 'Onay bekliyor', c: 'wait' },
    confirmed: { t: 'Onaylandı',     c: '' },
    arrived:   { t: 'Geldi',         c: 'live' },
    done:      { t: 'Tamamlandı',    c: 'ok' },
    noshow:    { t: 'Gelmedi',       c: 'bad' },
    cancelled: { t: 'İptal',         c: '' },
  };
  const CHANNEL = {
    phone:    { t: 'Telefon',  i: 'phone' },
    walkin:   { t: 'Kapıdan',  i: 'door' },
    whatsapp: { t: 'WhatsApp', i: 'chat' },
    online:   { t: 'Online',   i: 'bolt' },
  };

  const hours = (biz, d) => (biz.hours[d.getDay()] ? biz.hours[d.getDay()].slice() : null);
  const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

  /** Aynı kaynağı aynı anda ikinci kez satmayı engelleyen çekirdek kontrol */
  function clash(list, d, skip) {
    return list.filter((r) => r.id !== skip && r.date === d.date && r.resourceId === d.resourceId
      && live(r) && overlap(d.start, d.end, r.start, r.end));
  }

  /** { ok, errors[], warnings[] } — ok değilse kayıt yazılmaz */
  function check(ctx, d, skip) {
    const errors = [], warnings = [];
    const day = u.fromKey(d.date);
    if (!d.resourceId) errors.push('Kaynak seçilmedi.');
    if (!(d.end > d.start)) errors.push('Bitiş saati başlangıçtan sonra olmalı.');

    const h = hours(ctx.biz, day);
    if (!h) errors.push(`${u.GUN[day.getDay()]} günü kapalısınız.`);
    else if (d.start < h[0] || d.end > h[1])
      errors.push(`Çalışma saatleri dışında — ${u.GUN[day.getDay()]}: ${u.hm(h[0])}–${u.hm(h[1])}`);

    const res = ctx.resources.find((r) => r.id === d.resourceId);
    if (res && res.closed) errors.push(`${res.name} kapalı.`);

    const c = clash(ctx.reservations, d, skip);
    if (c.length) {
      const who = ctx.customers.find((x) => x.id === c[0].customerId);
      errors.push(`${res ? res.name : 'Kaynak'} ${u.hm(c[0].start)}–${u.hm(c[0].end)} dolu` +
        (who ? ` (${who.name})` : '') + '.');
    }
    const now = new Date();
    if (d.date === u.key(now) && d.end < u.mins(now)) warnings.push('Bu saat geçti; geçmişe kayıt açıyorsunuz.');
    return { ok: !errors.length, errors, warnings };
  }

  /** Gerçekten boş başlangıç saatleri */
  function free(ctx, o) {
    const day = u.fromKey(o.date);
    const h = hours(ctx.biz, day);
    if (!h) return [];
    const dur = o.duration || 60, step = o.step || 30;
    const pool = o.resourceId ? ctx.resources.filter((r) => r.id === o.resourceId)
      : ctx.resources.filter((r) => !r.closed);
    const out = [];
    for (let t = h[0]; t + dur <= h[1]; t += step) {
      const ok = pool.filter((r) => !r.closed &&
        !clash(ctx.reservations, { date: o.date, resourceId: r.id, start: t, end: t + dur }).length);
      if (ok.length) out.push({ start: t, end: t + dur, res: ok.map((r) => r.id) });
    }
    return out;
  }

  /** Açık dakikaların ne kadarı satıldı */
  function fill(ctx, dateKey) {
    const day = u.fromKey(dateKey);
    const h = hours(ctx.biz, day);
    const open = ctx.resources.filter((r) => !r.closed);
    if (!h || !open.length) return { pct: 0, sold: 0, cap: 0 };
    const cap = (h[1] - h[0]) * open.length;
    const sold = u.sum(ctx.reservations.filter((r) => r.date === dateKey && live(r)), (r) => r.end - r.start);
    return { pct: cap ? Math.round((sold / cap) * 100) : 0, sold, cap };
  }

  /** Boş aralıklar — doluluk açığını göstermek için */
  function gaps(ctx, dateKey, min) {
    const day = u.fromKey(dateKey);
    const h = hours(ctx.biz, day);
    if (!h) return [];
    const m = min || 60, out = [];
    ctx.resources.filter((r) => !r.closed).forEach((res) => {
      const rows = ctx.reservations.filter((r) => r.date === dateKey && r.resourceId === res.id && live(r))
        .sort((a, b) => a.start - b.start);
      let cur = h[0];
      rows.forEach((r) => { if (r.start - cur >= m) out.push({ resourceId: res.id, start: cur, end: r.start }); cur = Math.max(cur, r.end); });
      if (h[1] - cur >= m) out.push({ resourceId: res.id, start: cur, end: h[1] });
    });
    return out;
  }

  return { STATUS, CHANNEL, LIVE, live, hours, clash, check, free, fill, gaps };
})();

/* ============================== Ciro ============================== */
RZ.money = (function () {
  const u = RZ.u, s = RZ.sched;
  const REAL = ['done', 'arrived'];     // gerçekleşen
  const SOON = ['confirmed', 'pending']; // bekleyen

  /** Dönem + karşılaştırılacak önceki dönem */
  function period(kind, ref) {
    const t = u.day0(ref || new Date());
    let from, to, label, pf, pt, plabel;
    switch (kind) {
      case 'today': from = to = t; label = 'Bugün'; pf = pt = u.addD(t, -1); plabel = 'düne göre'; break;
      case 'week': from = u.week0(t); to = u.addD(from, 6); label = 'Bu hafta';
        pf = u.addD(from, -7); pt = u.addD(from, -1); plabel = 'geçen haftaya göre'; break;
      case '30d': to = t; from = u.addD(t, -29); label = 'Son 30 gün';
        pt = u.addD(from, -1); pf = u.addD(pt, -29); plabel = 'önceki 30 güne göre'; break;
      case '90d': to = t; from = u.addD(t, -89); label = 'Son 90 gün';
        pt = u.addD(from, -1); pf = u.addD(pt, -89); plabel = 'önceki 90 güne göre'; break;
      case 'month': from = u.month0(t); to = u.month1(t); label = u.date(t, 'my');
        pf = u.month0(u.addM(t, -1)); pt = u.month1(u.addM(t, -1)); plabel = 'geçen aya göre'; break;
      case 'prev': { const p = u.addM(t, -1); from = u.month0(p); to = u.month1(p); label = u.date(p, 'my');
        pf = u.month0(u.addM(p, -1)); pt = u.month1(u.addM(p, -1)); plabel = 'önceki aya göre'; break; }
      default: to = t; from = u.addD(t, -29); label = 'Son 30 gün';
        pt = u.addD(from, -1); pf = u.addD(pt, -29); plabel = 'önceki 30 güne göre';
    }
    return { kind, from, to, label, pf, pt, plabel, a: u.key(from), b: u.key(to) };
  }

  function report(ctx, p) {
    let rows = ctx.reservations.filter((r) => r.date >= p.a && r.date <= p.b);
    // Devam eden dönemi önceki dönemle karşılaştırırken önceki dönem de aynı
    // noktadan kesilir; yarım günü dolu güne kıyaslamak yanıltır.
    if (p.cut != null && p.cutKey) rows = rows.filter((r) => r.date !== p.cutKey || r.start < p.cut);

    const real = rows.filter((r) => REAL.includes(r.status));
    const soon = rows.filter((r) => SOON.includes(r.status));
    const noshow = rows.filter((r) => r.status === 'noshow');
    const cancel = rows.filter((r) => r.status === 'cancelled');
    const gross = u.sum(real, (r) => r.price);

    const byDay = [];
    for (let d = new Date(p.from); d <= p.to; d = u.addD(d, 1)) {
      const k = u.key(d), day = rows.filter((r) => r.date === k);
      byDay.push({
        key: k, date: new Date(d),
        real: u.sum(day.filter((r) => REAL.includes(r.status)), (r) => r.price),
        soon: u.sum(day.filter((r) => SOON.includes(r.status)), (r) => r.price),
        lost: u.sum(day.filter((r) => r.status === 'noshow'), (r) => r.price),
        n: day.filter(s.live).length,
      });
    }

    const dim = (keyOf, nameOf) => {
      const m = new Map();
      real.forEach((r) => {
        const k = keyOf(r); if (k == null) return;
        if (!m.has(k)) m.set(k, { key: k, name: nameOf(k), total: 0, n: 0 });
        const o = m.get(k); o.total += r.price; o.n++;
      });
      return Array.from(m.values()).sort((a, b) => b.total - a.total);
    };
    const nm = (arr, id, f) => (arr.find((x) => x.id === id) || {})[f || 'name'] || '—';

    let sold = 0, cap = 0;
    for (let d = new Date(p.from); d <= p.to && d <= new Date(); d = u.addD(d, 1)) {
      const f = s.fill(ctx, u.key(d)); sold += f.sold; cap += f.cap;
    }

    // İlk gerçekleşen ziyareti bu döneme düşen müşteri = yeni müşteri
    const first = new Map();
    ctx.reservations.forEach((r) => {
      if (!r.customerId || !REAL.includes(r.status)) return;
      const c = first.get(r.customerId);
      if (!c || r.date < c) first.set(r.customerId, r.date);
    });
    let fresh = 0; first.forEach((d) => { if (d >= p.a && d <= p.b) fresh++; });

    return {
      p, rows, real, soon, noshow, cancel,
      gross, soonSum: u.sum(soon, (r) => r.price), lost: u.sum(noshow, (r) => r.price),
      n: real.length, avg: real.length ? gross / real.length : 0,
      noShowPct: real.length + noshow.length ? (noshow.length / (real.length + noshow.length)) * 100 : 0,
      byDay,
      byService: dim((r) => r.serviceId, (k) => nm(ctx.services, k)),
      byResource: dim((r) => r.resourceId, (k) => nm(ctx.resources, k)),
      byChannel: dim((r) => r.channel, (k) => (s.CHANNEL[k] || {}).t || k),
      fill: cap ? Math.round((sold / cap) * 100) : 0, sold, cap,
      guests: new Set(real.map((r) => r.customerId).filter(Boolean)).size,
      fresh,
      deposit: u.sum(rows.filter((r) => r.deposit && r.deposit.charged), (r) => r.deposit.amount),
    };
  }

  /** Bu dönem + önceki dönem + yüzde farkları */
  function compare(ctx, p) {
    const cur = report(ctx, p);
    const today = u.day0(new Date());
    let pt = p.pt, cut = null;
    if (p.to >= today) {
      const passed = Math.max(0, u.diffD(today, p.from));
      const c = u.addD(p.pf, passed);
      pt = c < p.pt ? c : p.pt;
      cut = u.mins(new Date());
    }
    const prev = report(ctx, Object.assign({}, p, {
      from: p.pf, to: pt, a: u.key(p.pf), b: u.key(pt),
      cut, cutKey: cut != null ? u.key(pt) : null,
    }));
    const d = (a, b) => (b ? ((a - b) / b) * 100 : a ? 100 : 0);
    return { cur, prev, d: { gross: d(cur.gross, prev.gross), n: d(cur.n, prev.n), avg: d(cur.avg, prev.avg), fill: cur.fill - prev.fill, lost: d(cur.lost, prev.lost) } };
  }

  /** Müşteri özeti: kaç kez geldi, ne harcadı, ne zaman kayboldu */
  function people(ctx, lostAfter) {
    const gone = lostAfter || 45;
    const today = u.key(new Date());
    return ctx.customers.map((c) => {
      const rs = ctx.reservations.filter((r) => r.customerId === c.id);
      const done = rs.filter((r) => REAL.includes(r.status));
      const dates = done.map((r) => r.date).sort();
      const last = dates[dates.length - 1] || null;
      const spend = u.sum(done, (r) => r.price);
      const since = last ? u.diffD(u.fromKey(today), u.fromKey(last)) : null;
      return Object.assign({}, c, {
        visits: done.length, spend, last, firstV: dates[0] || null,
        noshows: rs.filter((r) => r.status === 'noshow').length,
        since, avg: done.length ? spend / done.length : 0,
        lost: since != null && since > gone && done.length >= 2,
      });
    });
  }

  return { REAL, SOON, period, report, compare, people };
})();

/* ============================== Durum ============================== */
RZ.store = (function () {
  const u = RZ.u, s = RZ.sched;
  const KEY = 'rezervle.v2';
  let st = null;
  const subs = new Set();

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  function emit(why) { save(); subs.forEach((f) => { try { f(st, why); } catch (e) { console.error(e); } }); }
  const on = (f) => { subs.add(f); return () => subs.delete(f); };

  function init() {
    try {
      const raw = localStorage.getItem(KEY);
      const p = raw && JSON.parse(raw);
      st = p && p.v === 2 && p.biz ? p : RZ.seed();
    } catch (e) { st = RZ.seed(); }
    return st;
  }
  const reset = () => { st = RZ.seed(); emit('reset'); return st; };
  const get = () => st;
  const ctx = () => st;
  const find = (c, id) => st[c].find((x) => x.id === id);

  function log(text) {
    st.log.unshift({ id: u.id('l'), text, at: new Date().toISOString() });
    st.log = st.log.slice(0, 60);
  }

  /* --- müşteri --- */
  function customer(data) {
    if (data.id) { Object.assign(find('customers', data.id), data); emit('c'); return find('customers', data.id); }
    const ph = String(data.phone || '').replace(/\D/g, '');
    const hit = ph.length >= 10 && st.customers.find((c) => String(c.phone).replace(/\D/g, '') === ph);
    if (hit) return hit;
    const c = { id: u.id('c'), name: data.name, phone: data.phone || '', note: '' };
    st.customers.push(c); emit('c'); return c;
  }

  /* --- rezervasyon --- */
  function add(d) {
    const svc = st.services.find((x) => x.id === d.serviceId);
    const rec = {
      id: u.id('r'), customerId: d.customerId || null,
      serviceId: d.serviceId, resourceId: d.resourceId,
      date: d.date, start: d.start, end: d.end != null ? d.end : d.start + ((svc && svc.duration) || 60),
      status: d.status || 'confirmed', channel: d.channel || 'phone',
      price: d.price != null ? d.price : (svc ? svc.price : 0),
      deposit: d.deposit || null, note: d.note || '',
      at: new Date().toISOString(),
    };
    const v = s.check(st, rec);
    if (!v.ok) return { ok: false, errors: v.errors };
    st.reservations.push(rec);
    const c = st.customers.find((x) => x.id === rec.customerId);
    log(`${c ? c.name : 'Misafir'} · ${u.date(u.fromKey(rec.date), 'md')} ${u.hm(rec.start)}`);
    emit('r');
    return { ok: true, rec, warnings: v.warnings };
  }

  /** Saat/kaynak değişimi — sürükle-bırak da buradan geçer */
  function move(id, patch) {
    const r = find('reservations', id);
    if (!r) return { ok: false, errors: ['Kayıt yok.'] };
    const next = Object.assign({}, r, patch);
    if (patch.start != null && patch.end == null) next.end = patch.start + (r.end - r.start);
    const v = s.check(st, next, id);
    if (!v.ok) return { ok: false, errors: v.errors };
    Object.assign(r, next); emit('r');
    return { ok: true, rec: r };
  }

  function update(id, patch) {
    if (patch.start != null || patch.end != null || patch.date != null || patch.resourceId != null) return move(id, patch);
    Object.assign(find('reservations', id), patch); emit('r');
    return { ok: true };
  }

  function status(id, next) {
    const r = find('reservations', id);
    if (!r) return;
    r.status = next;
    if (next === 'noshow' && r.deposit && !r.deposit.charged) r.deposit.chargeable = true;
    if (next === 'done' && r.deposit) { r.deposit.chargeable = false; r.deposit.released = true; }
    log(`Durum: ${s.STATUS[next].t}`);
    emit('r');
  }
  const remove = (id) => { st.reservations = st.reservations.filter((r) => r.id !== id); emit('r'); };

  function charge(id) {
    const r = find('reservations', id);
    if (!r || !r.deposit) return;
    r.deposit.charged = true; r.deposit.chargeable = false;
    log(`Kapora tahsil edildi: ${u.money(r.deposit.amount)}`);
    emit('r');
  }

  /* --- kurulum --- */
  const bizUpdate = (p) => { Object.assign(st.biz, p); emit('b'); };
  function resAdd(d) { st.resources.push(Object.assign({ id: u.id('res'), closed: false }, d)); emit('res'); }
  const resUpdate = (id, p) => { Object.assign(find('resources', id), p); emit('res'); };
  const resDel = (id) => { st.resources = st.resources.filter((r) => r.id !== id); emit('res'); };
  function svcUpsert(d) {
    if (d.id) Object.assign(find('services', d.id), d);
    else st.services.push(Object.assign({ id: u.id('svc'), types: null }, d));
    emit('svc');
  }
  const svcDel = (id) => { st.services = st.services.filter((x) => x.id !== id); emit('svc'); };

  return { init, reset, get, ctx, on, emit, find, log, customer, add, move, update, status,
    remove, charge, bizUpdate, resAdd, resUpdate, resDel, svcUpsert, svcDel };
})();
