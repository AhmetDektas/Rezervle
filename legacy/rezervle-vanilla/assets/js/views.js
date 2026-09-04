/* Rezervle — ekranlar: Takvim, Rezervasyonlar, Müşteriler, Ciro, Ayarlar */
RZ.views = (function () {
  const u = RZ.u, s = RZ.sched, M = RZ.money, ui = RZ.ui, el = u.el;
  const H = 52; // bir saat kaç piksel

  /* ============================== TAKVİM ============================== */
  const cal = { date: u.key(new Date()) };

  function takvim(root, q) {
    if (q && q.d) cal.date = q.d;
    const c = RZ.store.ctx();
    const day = u.fromKey(cal.date);
    const shift = (n) => { cal.date = u.key(u.addD(u.fromKey(cal.date), n)); RZ.app.draw(); };

    const rows = c.reservations.filter((r) => r.date === cal.date && s.live(r));
    const f = s.fill(c, cal.date);

    root.appendChild(el('div.cal-bar',
      el('div.row', { style: { gap: '2px' } },
        el('button.ico-btn', { html: u.icon('left', 17), 'aria-label': 'Önceki gün', onclick: () => shift(-1) }),
        el('button.btn.sm', { onclick: () => { cal.date = u.key(new Date()); RZ.app.draw(); } }, 'Bugün'),
        el('button.ico-btn', { html: u.icon('right', 17), 'aria-label': 'Sonraki gün', onclick: () => shift(1) })),
      el('div', { style: { fontSize: '14px', fontWeight: '550', minWidth: '190px' } }, u.date(day, 'long')),
      el('div.grow'),
      el('div.row.wrap', { style: { gap: '14px' } },
        el('span.hint.n', `${rows.length} rezervasyon`),
        el('span.hint.n', u.money(u.sum(rows, (r) => r.price))),
        el('span.hint.n', `%${f.pct} dolu`)),
      el('button.btn.sm', { onclick: () => ui.book({ date: cal.date }) },
        el('span', { html: u.icon('plus', 15) }), 'Bu güne ekle')));

    const hrs = s.hours(c.biz, day);
    if (!hrs) {
      root.appendChild(el('div.panel', ui.empty(`${u.GUN[day.getDay()]} günü kapalısınız`,
        'Çalışma saatlerini Ayarlar’dan değiştirebilirsiniz.',
        { label: 'Ayarlar', run: () => (location.hash = '#/ayarlar') })));
      return;
    }
    if (!c.resources.length) {
      root.appendChild(el('div.panel', ui.empty('Kaynak tanımlı değil',
        'Takvim kolonları kaynaklarınızdan oluşur: saha, kort, koltuk, masa.',
        { label: 'Kaynak ekle', run: () => (location.hash = '#/ayarlar') })));
      return;
    }

    const [open, close] = hrs;
    const nHours = Math.ceil((close - open) / 60);
    const cols = `56px repeat(${c.resources.length}, minmax(150px, 1fr))`;

    const head = el('div.cal-head', { style: { gridTemplateColumns: cols } },
      el('div'),
      c.resources.map((r) => el('div', r.name, el('div.s', r.type + (r.closed ? ' · kapalı' : '')))));

    const hcol = el('div.hrs');
    for (let i = 0; i < nHours; i++) hcol.appendChild(el('div.hr', u.hm(open + i * 60)));

    const body = el('div.cal-body', { style: { gridTemplateColumns: cols } }, hcol);
    const colEls = [];
    c.resources.forEach((res) => {
      const col = el('div.col', { data: { res: res.id } });
      for (let i = 0; i < nHours; i++) {
        const t = open + i * 60;
        const cell = el('div.cel');
        cell.onclick = (e) => {
          if (e.target !== cell) return;
          const b = cell.getBoundingClientRect();
          ui.book({ date: cal.date, resourceId: res.id, start: t + (e.clientY - b.top > b.height / 2 ? 30 : 0) });
        };
        col.appendChild(cell);
      }
      c.reservations.filter((r) => r.date === cal.date && r.resourceId === res.id && r.status !== 'cancelled')
        .forEach((r) => col.appendChild(evNode(c, r, open)));
      colEls.push(col);
      body.appendChild(col);
    });

    if (cal.date === u.key(new Date())) {
      const now = u.mins(new Date());
      if (now >= open && now <= close) colEls.forEach((col) =>
        col.appendChild(el('div.now', { style: { top: ((now - open) / 60) * H + 'px' } })));
    }

    const wrap = el('div.cal', el('div.cal-scroll', el('div.cal-grid', head, body)));
    drag(wrap, { c, open, close, colEls });
    root.appendChild(wrap);
    root.appendChild(el('div.hint', { style: { marginTop: '10px' } },
      'Sürükleyip bırakarak taşıyın · boş alana tıklayıp kayıt açın · Enter ile detay'));
  }

  function evNode(c, r, open) {
    const sv = c.services.find((x) => x.id === r.serviceId) || {};
    const who = c.customers.find((x) => x.id === r.customerId);
    const cls = { pending: 'pending', arrived: 'here', done: 'done', noshow: 'noshow' }[r.status] || '';
    const name = who ? who.name : 'Misafir';
    const h = Math.max(20, ((r.end - r.start) / 60) * H - 3);
    const n = el('div.ev' + (cls ? '.' + cls : ''), {
      style: { top: ((r.start - open) / 60) * H + 2 + 'px', height: h + 'px' },
      data: { id: r.id },
      tabindex: '0', role: 'button',
      'aria-label': `${u.hm(r.start)}–${u.hm(r.end)}, ${name}, ${sv.name}, ${u.money(r.price)}, ${s.STATUS[r.status].t}`,
      title: `${u.hm(r.start)}–${u.hm(r.end)} · ${sv.name} · ${u.money(r.price)}`,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.detail(r.id); } },
    },
      el('span.t', name),
      h > 30 ? el('span.s', `${u.hm(r.start)} · ${u.money(r.price)}`) : null);
    return n;
  }

  /** Sürükle-bırak — bırakmadan önce çakışma kontrolü, geçersizse geri alınır */
  function drag(wrap, cfg) {
    let d = null;
    wrap.addEventListener('pointerdown', (e) => {
      const ev = e.target.closest('.ev');
      if (!ev || e.button !== 0) return;
      const rec = RZ.store.get().reservations.find((x) => x.id === ev.dataset.id);
      if (!rec) return;
      d = { ev, rec, x: e.clientX, y: e.clientY, moved: false, dur: rec.end - rec.start, ghost: null, target: null };
      ev.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dy = e.clientY - d.y, dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
      if (!d.moved) {
        d.moved = true; d.ev.classList.add('drag');
        d.ghost = el('div.ghost'); wrap.querySelector('.cal-body').appendChild(d.ghost);
      }
      let col = d.ev.parentElement;
      cfg.colEls.forEach((x) => { const b = x.getBoundingClientRect(); if (e.clientX >= b.left && e.clientX <= b.right) col = x; });
      const step = Math.round((dy / H) * 60 / 15) * 15;
      const start = u.clamp(d.rec.start + step, cfg.open, cfg.close - d.dur);
      const patch = { resourceId: col.dataset.res, start, end: start + d.dur };
      const v = s.check(cfg.c, Object.assign({}, d.rec, patch), d.rec.id);
      d.target = { patch, ok: v.ok, msg: v.ok ? '' : v.errors[0] };

      const cb = col.getBoundingClientRect(), bb = wrap.querySelector('.cal-body').getBoundingClientRect();
      Object.assign(d.ghost.style, {
        top: ((start - cfg.open) / 60) * H + 2 + 'px', height: (d.dur / 60) * H - 3 + 'px',
        left: cb.left - bb.left + 3 + 'px', width: cb.width - 6 + 'px',
      });
      d.ghost.classList.toggle('no', !v.ok);
      d.ghost.textContent = v.ok ? `${u.hm(start)}–${u.hm(start + d.dur)}` : 'dolu';
    });
    function end() {
      if (!d) return;
      const x = d; d = null;
      x.ev.classList.remove('drag');
      if (x.ghost) x.ghost.remove();
      if (!x.moved) { ui.detail(x.rec.id); return; }
      if (!x.target || !x.target.ok) {
        x.ev.classList.add('bump'); setTimeout(() => x.ev.classList.remove('bump'), 320);
        ui.toast(x.target ? x.target.msg : 'Taşınamadı', true);
        RZ.app.draw(); return;
      }
      const res = RZ.store.move(x.rec.id, x.target.patch);
      if (!res.ok) { ui.toast(res.errors[0], true); RZ.app.draw(); return; }
      ui.toast(`Taşındı · <b>${u.hm(x.target.patch.start)}</b>`);
    }
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
  }

  /* ========================== REZERVASYONLAR ========================== */
  const flt = { q: '', status: 'all', when: 'next' };

  function liste(root, q) {
    if (q && q.f) { flt.status = q.f; flt.when = 'all'; }
    const c = RZ.store.ctx();
    const today = u.key(new Date());

    root.appendChild(el('div.cal-bar',
      el('input.inp', { placeholder: 'Müşteri, hizmet veya not ara…', value: flt.q, style: { maxWidth: '260px' },
        oninput: u.debounce((e) => { flt.q = e.target.value; RZ.app.draw(); }, 240) }),
      el('select.sel', { style: { width: 'auto' }, onchange: (e) => { flt.when = e.target.value; RZ.app.draw(); } },
        [['next', 'Bugün ve sonrası'], ['today', 'Bugün'], ['past', 'Geçmiş'], ['all', 'Tümü']]
          .map(([v, t]) => el('option', { value: v, selected: flt.when === v }, t))),
      el('select.sel', { style: { width: 'auto' }, onchange: (e) => { flt.status = e.target.value; RZ.app.draw(); } },
        [['all', 'Tüm durumlar']].concat(Object.entries(s.STATUS).map(([k, v]) => [k, v.t]))
          .map(([v, t]) => el('option', { value: v, selected: flt.status === v }, t))),
      el('div.grow'),
      el('button.btn.sm.quiet', { onclick: () => csv(c, rows) }, el('span', { html: u.icon('down2', 15) }), 'CSV'),
      el('button.btn.primary.sm', { onclick: () => ui.book({}) }, el('span', { html: u.icon('plus', 15) }), 'Rezervasyon')));

    let rows = c.reservations.filter((r) => {
      if (flt.status !== 'all' && r.status !== flt.status) return false;
      if (flt.when === 'next' && r.date < today) return false;
      if (flt.when === 'today' && r.date !== today) return false;
      if (flt.when === 'past' && r.date >= today) return false;
      if (flt.q) {
        const who = c.customers.find((x) => x.id === r.customerId);
        const sv = c.services.find((x) => x.id === r.serviceId) || {};
        const hay = u.norm([who && who.name, who && who.phone, sv.name, r.note].join(' '));
        if (!hay.includes(u.norm(flt.q))) return false;
      }
      return true;
    }).sort((a, b) => a.date === b.date ? a.start - b.start
      : (flt.when === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

    if (!rows.length) {
      root.appendChild(el('div.panel', ui.empty('Bu filtrelerde kayıt yok',
        'Tarih aralığı, durum ve arama birleşimine uyan rezervasyon bulunamadı.',
        { label: 'Filtreleri sıfırla', run: () => { flt.q = ''; flt.status = 'all'; flt.when = 'next'; RZ.app.draw(); } })));
      return;
    }

    const tb = el('tbody');
    let last = null;
    rows.slice(0, 300).forEach((r) => {
      if (r.date !== last) {
        last = r.date;
        tb.appendChild(el('tr.grp', el('td', { colspan: 7 },
          u.date(u.fromKey(r.date), 'long') + (r.date === today ? ' · bugün' : ''))));
      }
      const who = c.customers.find((x) => x.id === r.customerId);
      const sv = c.services.find((x) => x.id === r.serviceId) || {};
      const res = c.resources.find((x) => x.id === r.resourceId) || {};
      tb.appendChild(el('tr.clk', { onclick: () => ui.detail(r.id) },
        el('td.n', { style: { width: '58px' } }, u.hm(r.start)),
        el('td', el('div', { style: { fontWeight: '500' } }, who ? who.name : 'Misafir'),
          who ? el('div.hint.n', u.phone(who.phone)) : null),
        el('td.dim', sv.name),
        el('td.dim', res.name),
        el('td.hint', (s.CHANNEL[r.channel] || {}).t),
        el('td.r.n', { style: { fontWeight: '500' } }, u.money(r.price)),
        el('td.r', ui.status(r.status))));
    });

    root.appendChild(el('div.panel', el('div.tbl-x', el('table.tbl',
      el('thead', el('tr', el('th', 'Saat'), el('th', 'Müşteri'), el('th', 'Hizmet'),
        el('th', 'Kaynak'), el('th', 'Kanal'), el('th.r', 'Tutar'), el('th.r', 'Durum'))), tb))));
    if (rows.length > 300) root.appendChild(el('div.hint', { style: { marginTop: '10px', textAlign: 'center' } },
      `İlk 300 kayıt gösteriliyor (toplam ${u.num(rows.length)}). Filtreyi daraltın ya da CSV alın.`));
  }

  function csv(c, rows) {
    const out = ['Tarih;Saat;Musteri;Telefon;Hizmet;Kaynak;Kanal;Tutar;Durum'];
    rows.forEach((r) => {
      const w = c.customers.find((x) => x.id === r.customerId) || {};
      const sv = c.services.find((x) => x.id === r.serviceId) || {};
      const rs = c.resources.find((x) => x.id === r.resourceId) || {};
      out.push([r.date, u.hm(r.start), w.name || 'Misafir', w.phone || '', sv.name, rs.name,
        (s.CHANNEL[r.channel] || {}).t, r.price, s.STATUS[r.status].t].join(';'));
    });
    ui.exportCsv(`rezervasyonlar-${u.key(new Date())}.csv`, out.join('\n'));
  }

  /* ============================= MÜŞTERİLER ============================= */
  const cf = { q: '', seg: 'all', sort: 'spend' };

  function musteriler(root, q) {
    if (q && q.seg) cf.seg = q.seg;
    const c = RZ.store.ctx();
    const all = M.people(c, 45);
    const lost = all.filter((x) => x.lost);
    const loyal = all.filter((x) => x.visits >= 8);
    const risky = all.filter((x) => x.noshows >= 3 && x.visits + x.noshows >= 5);

    root.appendChild(el('div.cal-bar',
      el('input.inp', { placeholder: 'İsim veya telefon…', value: cf.q, style: { maxWidth: '240px' },
        oninput: u.debounce((e) => { cf.q = e.target.value; RZ.app.draw(); }, 240) }),
      el('div.seg',
        [['all', 'Tümü', all.length], ['loyal', 'Sadık', loyal.length],
         ['lost', 'Kaybolan', lost.length], ['risky', 'Riskli', risky.length]]
          .map(([k, t, n]) => el('button' + (cf.seg === k ? '.on' : ''),
            { onclick: () => { cf.seg = k; RZ.app.draw(); } }, `${t} ${n}`))),
      el('div.grow'),
      el('select.sel', { style: { width: 'auto' }, onchange: (e) => { cf.sort = e.target.value; RZ.app.draw(); } },
        [['spend', 'Harcamaya göre'], ['visits', 'Ziyarete göre'], ['recent', 'Son ziyarete göre'], ['name', 'İsme göre']]
          .map(([v, t]) => el('option', { value: v, selected: cf.sort === v }, t)))));

    let list = cf.seg === 'lost' ? lost : cf.seg === 'loyal' ? loyal : cf.seg === 'risky' ? risky : all;
    if (cf.q) {
      const nq = u.norm(cf.q), dq = cf.q.replace(/\D/g, '');
      list = list.filter((x) => u.norm(x.name).includes(nq) || (dq && String(x.phone).replace(/\D/g, '').includes(dq)));
    }
    list = list.slice().sort((a, b) =>
      cf.sort === 'visits' ? b.visits - a.visits
      : cf.sort === 'name' ? a.name.localeCompare(b.name, 'tr')
      : cf.sort === 'recent' ? String(b.last || '').localeCompare(String(a.last || ''))
      : b.spend - a.spend);

    if (cf.seg === 'lost' && lost.length) {
      root.appendChild(el('div.panel.pad', { style: { marginBottom: '14px' } },
        el('div.between.wrap',
          el('div', el('div', { style: { fontWeight: '550', fontSize: '13.5px' } },
            `${lost.length} müşteri 45 günden uzun süredir gelmedi`),
            el('div.hint', `Geçmiş harcamaları ${u.money(u.sum(lost, (x) => x.spend))}. Tek mesajla geri kazanım deneyin.`)),
          el('button.btn.sm', { onclick: () => { RZ.store.log(`${lost.length} kayıp müşteriye mesaj gönderildi`); ui.toast(`${lost.length} kişiye mesaj gönderildi`); } },
            'Mesaj gönder'))));
    }

    if (!list.length) { root.appendChild(el('div.panel', ui.empty('Bu segmentte müşteri yok'))); return; }

    const tb = el('tbody');
    list.slice(0, 300).forEach((x) => tb.appendChild(el('tr.clk', { onclick: () => (location.hash = '#/musteri/' + x.id) },
      el('td', el('div', { style: { fontWeight: '500' } }, x.name), el('div.hint.n', u.phone(x.phone))),
      el('td.r.n', x.visits),
      el('td.r.n', { style: { fontWeight: '500' } }, u.money(x.spend)),
      el('td.r.n.dim', u.money(x.avg, true)),
      el('td.r.hint', x.last ? u.rel(u.fromKey(x.last)) : '—'),
      el('td.r', x.noshows >= 3 ? el('span.st.bad', el('i'), `${x.noshows} gelmedi`)
        : x.lost ? el('span.st.wait', el('i'), 'kayboluyor')
        : x.visits >= 8 ? el('span.st.ok', el('i'), 'sadık') : el('span.hint', '—')))));

    root.appendChild(el('div.panel', el('div.tbl-x', el('table.tbl',
      el('thead', el('tr', el('th', 'Müşteri'), el('th.r', 'Ziyaret'), el('th.r', 'Harcama'),
        el('th.r', 'Ortalama'), el('th.r', 'Son ziyaret'), el('th.r', 'Durum'))), tb))));
  }

  function musteri(root, p) {
    const c = RZ.store.ctx();
    const base = c.customers.find((x) => x.id === p.id);
    if (!base) { root.appendChild(el('div.panel', ui.empty('Müşteri bulunamadı', null,
      { label: 'Listeye dön', run: () => (location.hash = '#/musteri') }))); return; }
    const x = M.people(c, 45).find((k) => k.id === p.id);
    const rows = c.reservations.filter((r) => r.customerId === p.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);

    root.appendChild(el('div.cal-bar',
      el('button.btn.sm.quiet', { onclick: () => (location.hash = '#/musteri') },
        el('span', { html: u.icon('left', 15) }), 'Müşteriler'),
      el('div.grow'),
      el('button.btn.primary.sm', { onclick: () => ui.book({ customerId: p.id }) },
        el('span', { html: u.icon('plus', 15) }), 'Rezervasyon aç')));

    root.appendChild(el('div', { style: { marginBottom: '14px' } },
      el('h2', { style: { fontSize: '20px' } }, x.name),
      el('div.hint.n', { style: { marginTop: '2px' } },
        `${u.phone(x.phone)} · ilk ziyaret ${x.firstV ? u.date(u.fromKey(x.firstV), 'md') : '—'}`)));

    root.appendChild(el('div.figs', { style: { marginBottom: '14px' } },
      ui.fig({ k: 'Toplam harcama', v: u.money(x.spend), tone: 'pos' }),
      ui.fig({ k: 'Ziyaret', v: x.visits }),
      ui.fig({ k: 'Ortalama', v: u.money(x.avg) }),
      ui.fig({ k: 'Gelmediği', v: x.noshows, tone: x.noshows ? 'neg' : '' }),
      ui.fig({ k: 'Son ziyaret', v: x.last ? u.rel(u.fromKey(x.last)) : '—' })));

    root.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: '14px', alignItems: 'start' } },
      ui.panel('Ziyaret geçmişi', `${rows.length} kayıt`,
        el('div', { style: { maxHeight: '460px', overflow: 'auto' } },
          rows.length ? el('div.rows', rows.map((r) => {
            const sv = c.services.find((y) => y.id === r.serviceId) || {};
            const rs = c.resources.find((y) => y.id === r.resourceId) || {};
            return el('button', { onclick: () => ui.detail(r.id) },
              el('span.n.hint', { style: { width: '62px' } }, u.date(u.fromKey(r.date), 'md')),
              el('span.grow', el('div', { style: { fontSize: '13px' } }, sv.name),
                el('div.hint.n', `${u.hm(r.start)} · ${rs.name}`)),
              el('span.n', { style: { fontSize: '13px' } }, u.money(r.price)),
              ui.status(r.status));
          })) : ui.empty('Henüz ziyaret yok', 'İlk randevusunu açtığınızda geçmiş burada birikir.',
            { label: 'Rezervasyon aç', run: () => ui.book({ customerId: p.id }) }))),
      ui.panel('Not', 'Personelin gördüğü ortak not',
        el('div.pad',
          el('textarea.inp', { style: { height: '110px', padding: '9px', lineHeight: '1.5' },
            placeholder: 'örn. kaleci filesi ister, faturayı şirkete kesiyoruz…',
            value: base.note || '',
            onchange: (e) => { RZ.store.customer({ id: base.id, note: e.target.value }); ui.toast('Not kaydedildi'); } }),
          el('div.hint', { style: { marginTop: '7px' } }, 'Not, rezervasyon açılırken personelin karşısına çıkar.')))));
  }

  /* ================================ CİRO ================================ */
  let per = '30d';

  function ciro(root) {
    const c = RZ.store.ctx();
    const p = M.period(per);
    const cmp = M.compare(c, p);
    const R = cmp.cur;

    root.appendChild(el('div.cal-bar',
      el('div.seg', [['today', 'Bugün'], ['week', 'Hafta'], ['30d', '30 gün'], ['90d', '90 gün'], ['month', 'Bu ay'], ['prev', 'Geçen ay']]
        .map(([k, t]) => el('button' + (per === k ? '.on' : ''), { onclick: () => { per = k; RZ.app.draw(); } }, t))),
      el('div.grow'),
      el('span.hint.n', `${u.date(p.from, 'md')} – ${u.date(p.to, 'md')}`),
      el('button.btn.sm.quiet', { onclick: () => cirocsv(R) }, el('span', { html: u.icon('down2', 15) }), 'CSV')));

    root.appendChild(el('div.figs', { style: { marginBottom: '14px' } },
      ui.fig({ k: 'Gerçekleşen ciro', v: u.money(R.gross), lead: true, tone: 'pos',
        d: R.soonSum ? `+${u.money(R.soonSum, true)} bekleyen` : null }),
      ui.fig({ k: 'Tamamlanan', v: u.num(R.n) }),
      ui.fig({ k: 'Ortalama fiş', v: u.money(R.avg) }),
      ui.fig({ k: 'Doluluk', v: '%' + R.fill, d: `${Math.round(R.sold / 60)} / ${Math.round(R.cap / 60)} saat` }),
      ui.fig({ k: 'Gelmeyen', v: u.money(R.lost), tone: 'neg', d: `${R.noshow.length} rezervasyon` })));

    root.appendChild(el('div.panel', { style: { marginBottom: '14px' } },
      el('header',
        el('div', el('h2', 'Günlük ciro'), el('div.sub', `${p.label} · toplam ${u.money(R.gross)}`)),
        el('div.row', { style: { gap: '14px' } },
          ui.delta(cmp.d.gross, p.plabel),
        )),
      el('div.pad', ui.bars(R.byDay))));

    root.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '14px' } },
      ui.panel('Hizmete göre', `${R.byService.length} hizmet`, el('div.pad', ui.breakdown(R.byService))),
      ui.panel('Kaynağa göre', 'Saha ve kort bazında', el('div.pad', ui.breakdown(R.byResource))),
      ui.panel('Nereden geldi', 'Rezervasyon kanalı', el('div.pad', ui.breakdown(R.byChannel)))));

    const saved = Math.round(R.lost * 0.4);
    root.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '14px', marginTop: '14px' } },
      ui.panel('Kaçan para', 'Gelmeyen müşterinin karşılığı', el('div.pad',
        el('div.n.neg', { style: { fontSize: '26px', fontWeight: '500', letterSpacing: '-.03em' } }, u.money(R.lost)),
        el('div.hint', { style: { marginTop: '3px' } }, `${R.noshow.length} rezervasyona gelinmedi · oran %${Math.round(R.noShowPct)}`),
        el('div.hint', { style: { marginTop: '10px', lineHeight: '1.55' } },
          'Randevudan önce gönderilen hatırlatma bu kaybı tipik olarak %40 azaltır: bu dönemde ',
          el('b.pos', u.money(saved)), ' geri kazanılabilirdi.'))),
      ui.panel('Müşteri', p.label, el('div.pad',
        el('div.rows', { style: { margin: '-9px -14px' } },
          el('div', el('span.grow.hint', 'Gelen müşteri'), el('span.n', R.guests)),
          el('div', el('span.grow.hint', 'Yeni müşteri'), el('span.n', R.fresh)),
          el('div', el('span.grow.hint', 'Kişi başı ciro'), el('span.n', u.money(R.guests ? R.gross / R.guests : 0))),
          el('div', el('span.grow.hint', 'Tahsil edilen kapora'), el('span.n', u.money(R.deposit)))))),
      ui.panel('Nasıl hesaplanıyor', 'Elle giriş yok', el('div.pad',
        el('div.hint', { style: { lineHeight: '1.6' } },
          'Ciro, sistemden geçen rezervasyonlardan hesaplanır. ',
          el('b', 'Gerçekleşen'), ' = tamamlandı ve geldi. ',
          el('b', 'Bekleyen'), ' = onaylandı ve onay bekliyor. ',
          el('b', 'Kayıp'), ' = gelmedi. Telefondan ya da kapıdan gelen rezervasyonlar da aynı takvime işlendiği için rapor işletmenin tamamını gösterir.')))));
  }

  function cirocsv(R) {
    const out = [`Rezervle ciro raporu;${R.p.label}`, '', 'Tarih;Ciro;Rezervasyon;Kayip'];
    R.byDay.forEach((d) => out.push([d.key, d.real, d.n, d.lost].join(';')));
    out.push('', 'Hizmet;Ciro;Adet');
    R.byService.forEach((x) => out.push([x.name, x.total, x.n].join(';')));
    out.push('', 'Kaynak;Ciro;Adet');
    R.byResource.forEach((x) => out.push([x.name, x.total, x.n].join(';')));
    ui.exportCsv(`ciro-${R.p.a}.csv`, out.join('\n'));
  }

  /* =============================== AYARLAR =============================== */
  function ayarlar(root) {
    const c = RZ.store.ctx();
    const fld = (label, val, save) => el('div.fld', el('label', label),
      el('input.inp', { value: val || '', onchange: (e) => { save(e.target.value); ui.toast('Kaydedildi'); } }));

    root.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '14px' } },
      ui.panel('İşletme', 'Fişte ve hatırlatma mesajında görünür',
        el('div.pad', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          fld('Ad', c.biz.name, (v) => RZ.store.bizUpdate({ name: v })),
          fld('Telefon', c.biz.phone, (v) => RZ.store.bizUpdate({ phone: v })),
          fld('Adres', c.biz.address, (v) => RZ.store.bizUpdate({ address: v })))),
      ui.panel('Çalışma saatleri', 'Bu aralık dışına rezervasyon açılamaz',
        el('div.rows', u.GUN.map((g, i) => {
          const h = c.biz.hours[i];
          return el('div',
            el('span.grow', { style: { fontSize: '13px', color: h ? '' : 'var(--ink-3)' } }, g),
            h ? el('span.row', { style: { gap: '5px' } },
              el('input.inp.n', { type: 'time', value: u.hm(h[0]), style: { width: '96px' },
                onchange: (e) => { c.biz.hours[i][0] = u.parseHM(e.target.value); RZ.store.emit('h'); } }),
              el('span.hint', '–'),
              el('input.inp.n', { type: 'time', value: u.hm(h[1] >= 1440 ? 1439 : h[1]), style: { width: '96px' },
                onchange: (e) => { c.biz.hours[i][1] = u.parseHM(e.target.value); RZ.store.emit('h'); } })) : el('span.hint', 'Kapalı'),
            el('label.row', { style: { gap: '6px', cursor: 'pointer' } },
              el('input', { type: 'checkbox', checked: !!h,
                onchange: (e) => { c.biz.hours[i] = e.target.checked ? [540, 1380] : null; RZ.store.emit('h'); RZ.app.draw(); } }),
              el('span.hint', 'açık')));
        })))));

    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(ui.panel('Kaynaklar', `Aynı anda kaç rezervasyon alabilirsiniz · ${c.resources.length} kaynak`,
      el('div.rows', c.resources.map((r) => el('div',
        el('input.inp', { value: r.name, style: { maxWidth: '220px' }, onchange: (e) => RZ.store.resUpdate(r.id, { name: e.target.value }) }),
        el('input.inp', { value: r.type, style: { maxWidth: '150px' }, onchange: (e) => RZ.store.resUpdate(r.id, { type: e.target.value }) }),
        el('div.grow'),
        el('label.row', { style: { gap: '6px', cursor: 'pointer' } },
          el('input', { type: 'checkbox', checked: !r.closed, onchange: (e) => { RZ.store.resUpdate(r.id, { closed: !e.target.checked }); RZ.app.draw(); } }),
          el('span.hint', 'aktif')),
        el('button.btn.sm.quiet', { style: { color: 'var(--loss)' }, onclick: async () => {
          if (await ui.ask({ title: 'Kaynağı sil', danger: true, ok: 'Sil', text: `${r.name} silinecek. Geçmiş rezervasyonlar raporlarda kalır.` }))
            { RZ.store.resDel(r.id); RZ.app.draw(); }
        } }, 'Sil')))),
      el('button.btn.sm', { onclick: () => { RZ.store.resAdd({ name: `Yeni kaynak ${c.resources.length + 1}`, type: c.resources[0] ? c.resources[0].type : 'Kaynak' }); RZ.app.draw(); } },
        el('span', { html: u.icon('plus', 15) }), 'Kaynak ekle')));

    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(ui.panel('Hizmetler ve fiyatlar', 'Ciro bu fiyatlardan hesaplanır',
      el('div.tbl-x', el('table.tbl',
        el('thead', el('tr', el('th', 'Hizmet'), el('th', 'Süre'), el('th.r', 'Fiyat'), el('th.r', 'Kapora'), el('th'))),
        el('tbody', c.services.map((sv) => el('tr',
          el('td', el('input.inp', { value: sv.name, style: { border: 'none', background: 'transparent', padding: '0', fontWeight: '500' },
            onchange: (e) => RZ.store.svcUpsert({ id: sv.id, name: e.target.value }) })),
          el('td', el('div.row', { style: { gap: '5px' } },
            el('input.inp.n', { type: 'number', value: sv.duration, style: { width: '72px' }, onchange: (e) => RZ.store.svcUpsert({ id: sv.id, duration: Number(e.target.value) }) }),
            el('span.hint', 'dk'))),
          el('td.r', el('input.inp.n', { type: 'number', value: sv.price, style: { width: '104px', textAlign: 'right' }, onchange: (e) => RZ.store.svcUpsert({ id: sv.id, price: Number(e.target.value) }) })),
          el('td.r', el('input.inp.n', { type: 'number', value: sv.deposit || 0, style: { width: '96px', textAlign: 'right' }, onchange: (e) => RZ.store.svcUpsert({ id: sv.id, deposit: Number(e.target.value) }) })),
          el('td.r', el('button.btn.sm.quiet', { style: { color: 'var(--loss)' }, onclick: () => { RZ.store.svcDel(sv.id); RZ.app.draw(); } }, 'Sil'))))))),
      el('button.btn.sm', { onclick: () => { RZ.store.svcUpsert({ name: 'Yeni hizmet', duration: 60, price: 500, deposit: 0 }); RZ.app.draw(); } },
        el('span', { html: u.icon('plus', 15) }), 'Hizmet ekle')));

    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '14px' } },
      ui.panel('Hatırlatma', 'Gelmeyen müşteriyi azaltan tek en etkili ayar',
        el('div.pad', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          el('div.fld', el('label', 'Randevudan kaç saat önce mesaj gitsin'),
            el('select.sel', { onchange: (e) => { c.biz.settings.reminderHours = Number(e.target.value); RZ.store.emit('s'); } },
              [1, 2, 3, 6, 12, 24, 48].map((h) => el('option', { value: h, selected: c.biz.settings.reminderHours === h }, h + ' saat')))),
          el('div.hint', 'Mesajda tek dokunuşla teyit ve iptal bağlantısı olur; iptal edilen saat anında yeniden satışa açılır.'))),
      ui.panel('Veri', 'Bu bir demo ortamıdır',
        el('div.pad', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          el('div.hint', { style: { lineHeight: '1.55' } },
            `${u.num(c.reservations.length)} rezervasyon, ${c.customers.length} müşteri. Veriler tarayıcınızda saklanır; yaptığınız değişiklikler kalıcıdır.`),
          el('button.btn.sm', { onclick: async () => {
            if (await ui.ask({ title: 'Örnek veriyi sıfırla', danger: true, ok: 'Sıfırla', text: 'Tüm değişiklikler silinip örnek veri yeniden oluşturulacak.' }))
              { RZ.store.reset(); ui.toast('Sıfırlandı'); RZ.app.draw(); }
          } }, el('span', { html: u.icon('repeat', 15) }), 'Sıfırla')))));
  }

  return { takvim, liste, musteriler, musteri, ciro, ayarlar };
})();
