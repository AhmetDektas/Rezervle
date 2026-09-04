/* Rezervle — uygulama kabuğu ve yönlendirme
   Tek sayfa: '#/' tanitim sitesi, '#/panel/...' isletme paneli. */
(function (RZ) {
  'use strict';
  const U = RZ.util, el = U.el;

  const ROUTES = [
    { path: '/panel',              view: 'dashboard',      title: 'Özet',                 icon: 'grid',     group: 'Günlük iş' },
    { path: '/panel/takvim',       view: 'calendar',       title: 'Takvim',               icon: 'calendar', group: 'Günlük iş' },
    { path: '/panel/rezervasyon',  view: 'reservations',   title: 'Rezervasyonlar',       icon: 'list',     group: 'Günlük iş' },
    { path: '/panel/musteri',      view: 'customers',      title: 'Müşteriler',           icon: 'users',    group: 'Günlük iş' },
    { path: '/panel/musteri/:id',  view: 'customerDetail', title: 'Müşteri kartı',        hidden: true },
    { path: '/panel/ciro',         view: 'revenue',        title: 'Ciro',                 icon: 'trend',    group: 'Gelir' },
    { path: '/panel/kapora',       view: 'deposits',       title: 'Kapora',               icon: 'shield',   group: 'Gelir', feature: 'deposit' },
    { path: '/panel/paket-kredi',  view: 'packages',       title: 'Paket & Kredi',        icon: 'box',      group: 'Gelir', feature: 'packages' },
    { path: '/panel/kampanya',     view: 'campaigns',      title: 'Kampanya',             icon: 'mega',     group: 'Gelir', feature: 'campaigns' },
    { path: '/panel/uygulama',     view: 'consumer',       title: 'Müşteri uygulaması',   icon: 'bolt',     group: 'Sistem' },
    { path: '/panel/ayarlar',      view: 'settings',       title: 'Ayarlar',              icon: 'cog',      group: 'Sistem' },
    { path: '/panel/paket',        view: 'plan',           title: 'Paket ve fatura',      icon: 'star',     group: 'Sistem' },
  ];

  const SUB = {
    dashboard: 'İşletmenizin bugünkü durumu',
    calendar: 'Sürükleyip bırakın — çakışma sistemce engellenir',
    reservations: 'Tüm kanallardan gelen rezervasyonlar',
    customers: 'Ziyaret, harcama ve sıklık geçmişi',
    revenue: 'Sistemden geçen her rezervasyon buraya işlenir',
    deposits: 'No-show koruması · para işletmenin POS’undan geçer',
    packages: 'Ön ödemeli paketler ve bakiye takibi',
    campaigns: 'Boş kapasiteyi ciroya çevirin',
    consumer: 'Tüketici tarafının canlı önizlemesi',
    settings: 'Kaynaklar, hizmetler ve çalışma saatleri',
    plan: 'Paketiniz, ek modülleriniz ve aylık faturanız',
  };

  let current = { path: '/', params: {}, query: {} };
  let navOpen = false;
  let lastViewPath = null;
  let slowMode = false;

  /** Hangi ekranda hangi iskelet gosterilecek */
  const SKELETON = {
    reservations: 'list', customers: 'list', deposits: 'list', packages: 'list',
    revenue: 'chart', calendar: 'chart', consumer: 'chart',
  };

  /* ---------------- Yönlendirme ---------------- */
  function parseHash() {
    let h = location.hash.replace(/^#/, '') || '/';
    const [pathRaw, qsRaw] = h.split('?');
    const query = {};
    (qsRaw || '').split('&').filter(Boolean).forEach((kv) => {
      const [k, v] = kv.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    const path = pathRaw.replace(/\/+$/, '') || '/';
    for (const r of ROUTES) {
      const rp = r.path.split('/'), pp = path.split('/');
      if (rp.length !== pp.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < rp.length; i++) {
        if (rp[i].startsWith(':')) params[rp[i].slice(1)] = pp[i];
        else if (rp[i] !== pp[i]) { ok = false; break; }
      }
      if (ok) return { route: r, path, params, query };
    }
    return { route: null, path, params: {}, query };
  }

  /** Tanitim sayfalari rota degil, iki ayri hedef kitle: '/' tuketici, '/isletme' isletme */
  const SITES = { '/': 'landing', '/isletme': 'business' };

  function mountSite(app, path) {
    app.innerHTML = '';
    app.className = '';
    delete app.dataset.page;
    RZ.views[SITES[path] || 'landing'](app);
  }

  /** Hedefe kaydirir. Bulunamazsa diger tanitim sayfasini kurup tekrar dener. */
  function scrollToAnchor(app, id) {
    let t = document.getElementById(id);
    if (!t) {
      mountSite(app, app.dataset.page === 'business' ? '/' : '/isletme');
      t = document.getElementById(id);
    }
    if (!t) return false;
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function render() {
    const app = document.getElementById('app');
    const raw = location.hash.replace(/^#/, '');

    // 1) Saf sayfa ici bag (#nasil, #paketler…): rota degildir, yeniden cizme — kaydir.
    //    Aksi halde menu linkleri sayfayi bastan olusturup kaydirmayi bozar.
    if (raw && raw[0] !== '/') {
      if (!app.classList.contains('site')) mountSite(app, '/');
      if (!scrollToAnchor(app, raw)) mountSite(app, '/');
      return;
    }

    // 2) '/isletme#paketler' gibi birlesik bag: once dogru sayfa, sonra kaydirma
    const hashAt = raw.indexOf('#');
    const sitePath = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const anchor = hashAt >= 0 ? raw.slice(hashAt + 1) : null;

    const { route, path, params, query } = parseHash();
    current = { path: sitePath || path, params, query };
    const y = window.scrollY;

    if (!route) {
      const want = SITES[sitePath || '/'] ? (sitePath || '/') : '/';
      const wantPage = SITES[want] === 'business' ? 'business' : 'consumer';
      const already = app.classList.contains('site') && app.dataset.page === wantPage;
      if (!already) mountSite(app, want);
      if (anchor && scrollToAnchor(app, anchor)) return;
      window.scrollTo(0, already ? y : 0);
      return;
    }
    app.innerHTML = '';
    app.className = '';
    // Kilitli sayfa: yine acilir ama icerik kilit ekranina doner (views icinde guarded)
    app.appendChild(shell(route, params, query));
    window.scrollTo(0, y);
  }

  /* ---------------- Panel kabuğu ---------------- */
  function shell(route, params, query) {
    const biz = RZ.store.biz();
    const c = RZ.store.ctx();
    const wrap = el('div.panel');

    /* --- sol menü --- */
    const nav = el('nav.nav' + (navOpen ? '.open' : ''));
    nav.appendChild(el('div.nav-brand',
      el('a.row', { href: '#/', style: { gap: '9px', flex: '1' } },
        el('span.mark', { html: U.logoMark(30) }),
        el('span.name', 'Rezervle')),
      el('span.tag', 'PANEL')));

    nav.appendChild(el('button.biz-switch', { onclick: () => bizSwitcher() },
      el('span.av', biz.emoji),
      el('span.grow', el('span.bn', biz.name), el('span.bc', `${biz.district} · ${RZ.plans.byId(biz.plan).name}`)),
      el('span', { style: { color: 'var(--ink-3)' }, html: U.icon('chevD', 15) })));

    const scroll = el('div.nav-scroll');
    const todayKey = U.dayKey(new Date());
    const counts = {
      '/panel/takvim': c.reservations.filter((r) => r.date === todayKey && RZ.schedule.isActive(r)).length,
      '/panel/rezervasyon': c.reservations.filter((r) => r.status === 'pending' && r.date >= todayKey).length,
      '/panel/kapora': c.reservations.filter((r) => r.deposit && r.deposit.status === 'chargeable').length,
    };
    let lastGroup = null;
    ROUTES.filter((r) => !r.hidden).forEach((r) => {
      if (r.group !== lastGroup) { lastGroup = r.group; scroll.appendChild(el('div.nav-sec', r.group)); }
      const locked = r.feature && !RZ.plans.can(biz, r.feature);
      const active = current.path === r.path;
      const n = counts[r.path];
      scroll.appendChild(el('a.nav-item' + (active ? '.active' : '') + (locked ? '.locked' : ''), {
        href: '#' + r.path,
        onclick: () => { navOpen = false; },
      },
        el('span.ico', { html: U.icon(r.icon, 17) }),
        el('span.grow', r.title),
        locked ? el('span.lock', { html: U.icon('lock', 14) }) : n ? el('span.count', n) : null
      ));
    });
    nav.appendChild(scroll);

    const bill = RZ.plans.monthlyBill(biz);
    nav.appendChild(el('div.nav-foot',
      el('a.plan-chip', { href: '#/panel/paket' },
        el('span', { style: { color: 'var(--brand)' }, html: U.icon('star', 16) }),
        el('span.grow',
          el('span.pn', 'Rezervle ' + RZ.plans.byId(biz.plan).name),
          el('span.pd', U.tl(bill.total) + ' / ay')),
        el('span', { style: { color: 'var(--ink-3)' }, html: U.icon('chevR', 14) })),
      el('a.nav-item', { href: '#/' }, el('span.ico', { html: U.icon('logout', 17) }), 'Tanıtım sayfası')
    ));
    wrap.appendChild(nav);

    /* --- ana alan --- */
    const main = el('div.main');
    main.appendChild(el('div.topbar',
      el('button.icon-btn.nav-toggle', { html: U.icon('menu', 19), onclick: () => { navOpen = !navOpen; render(); } }),
      el('div.grow',
        el('h1', route.title),
        el('div.crumb', SUB[route.view] || '')),
      el('button.icon-btn', {
        title: 'Açık / koyu tema',
        html: U.icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18),
        onclick: toggleTheme,
      }),
      el('button.btn.btn-primary.btn-sm', { onclick: () => RZ.booking.openBooking({}) },
        el('span', { html: U.icon('plus', 15) }), 'Rezervasyon')
    ));

    const content = el('main.content', { id: 'main', tabindex: '-1' });
    if (route.view === 'dashboard') content.appendChild(demoBar(biz));

    const draw = () => {
      try {
        RZ.views[route.view](content, Object.assign({}, params, query));
      } catch (e) {
        console.error(e);
        content.appendChild(RZ.ui.errorState(e));
      }
    };

    // Yukleme durumu: yalnizca rota degistiginde ve "yavas baglanti" acikken
    // iskelet gosterilir. Her yeniden cizimde gostermek titremeye yol acardi.
    const routeChanged = lastViewPath !== route.path;
    lastViewPath = route.path;
    if (slowMode && routeChanged) {
      content.appendChild(RZ.ui.skeleton(SKELETON[route.view] || 'panel'));
      setTimeout(() => {
        const live = document.querySelector('.content');
        if (!live || lastViewPath !== route.path) return;
        live.innerHTML = '';
        if (route.view === 'dashboard') live.appendChild(demoBar(RZ.store.biz()));
        try {
          RZ.views[route.view](live, Object.assign({}, params, query));
        } catch (e) { live.appendChild(RZ.ui.errorState(e)); }
      }, 800);
    } else {
      draw();
    }
    main.appendChild(content);
    wrap.appendChild(main);

    if (navOpen) {
      wrap.appendChild(el('div.scrim', { style: { zIndex: '105' }, onclick: () => { navOpen = false; render(); } }));
    }
    return wrap;
  }

  function demoBar(biz) {
    return el('div.demo-bar',
      el('span', { html: U.icon('sparkle', 15) }),
      el('span', el('b', 'Canlı demo. '),
        'Örnek veriyle çalışıyorsunuz — rezervasyon ekleyin, takvimde sürükleyin, paketi değiştirip kilitlerin nasıl açıldığını görün.'),
      el('div.grow'),
      el('div.row', { style: { gap: '5px' } },
        RZ.plans.PLANS.map((p) =>
          el('button.chip-tog' + (biz.plan === p.id ? '.on' : ''), {
            style: { fontSize: '11.5px' },
            onclick: () => { RZ.store.setPlan(p.id); RZ.ui.toast(`<b>${p.name}</b> paketine geçildi.`, 'ok'); },
          }, p.name)),
        el('button.chip-tog' + (slowMode ? '.on' : ''), {
          style: { fontSize: '11.5px' },
          title: 'Yükleme durumunu görmek için sayfa geçişlerine gecikme ekler',
          onclick: () => { slowMode = !slowMode; lastViewPath = null; render(); },
        }, 'Yavaş bağlantı'))
    );
  }

  function bizSwitcher() {
    const list = RZ.store.get().businesses;
    RZ.ui.modal({
      title: 'İşletme değiştir',
      sub: 'Demo iki farklı sektörle gelir — mimari ikisinde de aynıdır.',
      body: el('div', list.map((b) =>
        el('div.lrow.clickable', {
          onclick: () => { RZ.store.setBiz(b.id); RZ.ui.closeTop(); RZ.ui.toast(`<b>${b.name}</b> paneli açıldı.`, 'ok'); },
        },
          el('div.av-circle', { style: { fontSize: '17px' } }, b.emoji),
          el('div.grow',
            el('div', { style: { fontWeight: '620' } }, b.name),
            el('div.hint', `${b.category} · ${b.district} · Rezervle ${RZ.plans.byId(b.plan).name}`)),
          b.id === RZ.store.biz().id ? el('span.badge.badge-brand', 'açık') : null))),
    });
  }

  /* ---------------- Tema ---------------- */
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark' : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('rezervle.theme', next); } catch (e) {}
    render();
  }

  /* ---------------- Başlat ---------------- */
  function boot() {
    try {
      const t = localStorage.getItem('rezervle.theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch (e) {}
    RZ.store.init();
    RZ.store.on(U.debounce(() => render(), 30));
    window.addEventListener('hashchange', () => { navOpen = false; render(); });
    render();
  }

  RZ.app = { boot, rerender: render, toggleTheme, ROUTES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.RZ);
