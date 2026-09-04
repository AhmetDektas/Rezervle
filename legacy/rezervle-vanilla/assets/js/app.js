/* Rezervle — kabuk ve yönlendirme */
RZ.app = (function () {
  const u = RZ.u, s = RZ.sched, el = u.el;

  const ROUTES = [
    { p: '/',             v: 'takvim',      t: 'Takvim',         i: 'cal',   w: 'Günün akışı' },
    { p: '/rezervasyon',  v: 'liste',       t: 'Rezervasyonlar', i: 'list',  w: 'Tüm kayıtlar' },
    { p: '/musteri',      v: 'musteriler',  t: 'Müşteriler',     i: 'users', w: 'Kim, ne sıklıkla, ne kadar' },
    { p: '/musteri/:id',  v: 'musteri',     t: 'Müşteri',        hide: true, w: 'Müşteri kartı' },
    { p: '/ciro',         v: 'ciro',        t: 'Ciro',           i: 'chart', w: 'Kayıtlardan hesaplanır' },
    { p: '/ayarlar',      v: 'ayarlar',     t: 'Ayarlar',        i: 'cog',   w: 'Kaynak, hizmet, saat' },
  ];

  let cur = '/';
  let navOpen = false;

  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const q = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    for (const r of ROUTES) {
      const a = r.p.split('/'), b = path.split('/');
      if (a.length !== b.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < a.length; i++) {
        if (a[i][0] === ':') params[a[i].slice(1)] = b[i];
        else if (a[i] !== b[i]) { ok = false; break; }
      }
      if (ok) return { r, path, params, q };
    }
    return { r: ROUTES[0], path: '/', params: {}, q };
  }

  function draw() {
    const { r, path, params, q } = parse();
    cur = path;
    const app = document.getElementById('app');
    const y = window.scrollY;
    app.innerHTML = '';
    app.appendChild(shell(r, params, q));
    window.scrollTo(0, y);
  }

  function shell(route, params, q) {
    const c = RZ.store.ctx();
    const today = u.key(new Date());
    const wrap = el('div.app');

    /* --- sol --- */
    const side = el('div.side' + (navOpen ? '.open' : ''));
    side.appendChild(el('div.brand',
      el('span.mk', { html: u.mark(23) }), el('b', 'Rezervle')));
    side.appendChild(el('div.biz',
      el('div.nm.trunc', c.biz.name),
      el('div.sub', `${c.biz.kind} · ${c.biz.district}`)));

    const counts = {
      '/': c.reservations.filter((r) => r.date === today && s.live(r)).length,
      '/rezervasyon': c.reservations.filter((r) => r.status === 'pending' && r.date >= today).length,
    };
    const nav = el('nav.nav');
    ROUTES.filter((x) => !x.hide).forEach((x) => {
      const on = cur === x.p || (x.p === '/musteri' && cur.startsWith('/musteri'));
      nav.appendChild(el('a' + (on ? '.on' : ''), { href: '#' + x.p, onclick: () => { navOpen = false; } },
        el('span', { html: u.icon(x.i, 17) }),
        el('span.grow', x.t),
        counts[x.p] ? el('span.ct', counts[x.p]) : null));
    });
    side.appendChild(nav);
    side.appendChild(el('div.side-foot',
      el('button.ico-btn', {
        html: u.icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 17),
        'aria-label': 'Tema', onclick: theme,
      }),
      el('span.hint.n', { style: { fontSize: '11px' } }, `${u.num(c.reservations.length)} kayıt`)));
    wrap.appendChild(side);

    /* --- sağ --- */
    const main = el('div.main');
    main.appendChild(el('div.top',
      el('button.ico-btn.burger', { html: u.icon('menu', 18), 'aria-label': 'Menü', onclick: () => { navOpen = !navOpen; draw(); } }),
      el('div.grow', el('h1', route.t), el('div.where', route.w)),
      el('button.btn.primary.sm', { onclick: () => RZ.ui.book({}) },
        el('span', { html: u.icon('plus', 15) }), 'Rezervasyon')));

    const body = el('main.body', { id: 'main', tabindex: '-1' });
    try {
      RZ.views[route.v](body, Object.assign({}, params, q));
    } catch (e) {
      console.error(e);
      body.appendChild(el('div.panel', el('div.empty',
        el('b', 'Bu ekran açılamadı'),
        el('p', 'Verileriniz güvende. Ekranı yenilemeyi deneyin; sorun sürerse bu ekranın adını iletin.'),
        el('button.btn.sm', { onclick: draw }, 'Tekrar dene'))));
    }
    main.appendChild(body);
    wrap.appendChild(main);

    if (navOpen) wrap.appendChild(el('div.scrim', { style: { zIndex: '55' }, onclick: () => { navOpen = false; draw(); } }));
    return wrap;
  }

  function theme() {
    const d = document.documentElement;
    const now = d.dataset.theme;
    const next = now === 'dark' ? 'light' : now === 'light' ? 'dark'
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
    d.dataset.theme = next;
    try { localStorage.setItem('rezervle.theme', next); } catch (e) {}
    draw();
  }

  function boot() {
    try { const t = localStorage.getItem('rezervle.theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
    RZ.store.init();
    RZ.store.on(u.debounce(draw, 20));
    addEventListener('hashchange', () => { navOpen = false; draw(); });
    draw();
  }

  return { boot, draw, ROUTES };
})();

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', RZ.app.boot);
else RZ.app.boot();
