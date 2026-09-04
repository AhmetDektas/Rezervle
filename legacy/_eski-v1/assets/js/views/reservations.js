/* Rezervle — Panel > Rezervasyonlar (liste, filtre, toplu işlem) */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  const f = { q: '', status: 'all', channel: 'all', range: 'upcoming', sort: 'date' };

  RZ.views.reservations = function (root, params) {
    if (params && params.f) { f.status = params.f; f.range = 'all'; }
    const c = RZ.store.ctx();
    const todayKey = U.dayKey(new Date());

    const bar = el('div.filters');
    bar.appendChild(el('input.input.search', {
      placeholder: 'Müşteri, hizmet veya not ara…', value: f.q,
      oninput: U.debounce((e) => { f.q = e.target.value; RZ.app.rerender(); }, 260),
    }));
    bar.appendChild(el('select.select', { onchange: (e) => { f.range = e.target.value; RZ.app.rerender(); } },
      [['upcoming', 'Bugün ve sonrası'], ['today', 'Bugün'], ['week', 'Bu hafta'], ['past', 'Geçmiş'], ['all', 'Tümü']]
        .map(([v, t]) => el('option', { value: v, selected: f.range === v }, t))));
    bar.appendChild(el('select.select', { onchange: (e) => { f.status = e.target.value; RZ.app.rerender(); } },
      [['all', 'Tüm durumlar']].concat(Object.entries(S.STATUS).map(([k, v]) => [k, v.label]))
        .map(([v, t]) => el('option', { value: v, selected: f.status === v }, t))));
    bar.appendChild(el('select.select', { onchange: (e) => { f.channel = e.target.value; RZ.app.rerender(); } },
      [['all', 'Tüm kanallar']].concat(Object.entries(S.CHANNEL).map(([k, v]) => [k, v.label]))
        .map(([v, t]) => el('option', { value: v, selected: f.channel === v }, t))));
    bar.appendChild(el('div.grow'));
    bar.appendChild(el('button.btn.btn-primary.btn-sm', { onclick: () => RZ.booking.openBooking({}) },
      el('span', { html: U.icon('plus', 15) }), 'Yeni rezervasyon'));
    root.appendChild(bar);

    /* --- filtre --- */
    const weekStart = U.dayKey(U.startOfWeek(new Date()));
    const weekEnd = U.dayKey(U.addDays(U.startOfWeek(new Date()), 6));
    let rows = c.reservations.filter((r) => {
      if (f.status !== 'all' && r.status !== f.status) return false;
      if (f.channel !== 'all' && r.channel !== f.channel) return false;
      if (f.range === 'upcoming' && r.date < todayKey) return false;
      if (f.range === 'today' && r.date !== todayKey) return false;
      if (f.range === 'week' && (r.date < weekStart || r.date > weekEnd)) return false;
      if (f.range === 'past' && r.date >= todayKey) return false;
      if (f.q) {
        const cus = c.customers.find((x) => x.id === r.customerId);
        const svc = c.services.find((x) => x.id === r.serviceId) || {};
        const hay = U.norm([cus ? cus.name : r.guestName, cus ? cus.phone : '', svc.name, r.note].join(' '));
        if (!hay.includes(U.norm(f.q))) return false;
      }
      return true;
    });
    rows.sort((a, b) => (a.date === b.date ? a.start - b.start : (f.range === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))));

    /* --- ozet --- */
    const active = rows.filter((r) => S.isActive(r));
    root.appendChild(el('div.row.wrap', { style: { gap: '9px', marginBottom: '12px' } },
      el('span.badge', `${rows.length} kayıt`),
      el('span.badge.badge-money', tl(U.sum(active, (r) => r.price)) + ' tutar'),
      rows.filter((r) => r.status === 'pending').length
        ? el('button.chip-tog' + (f.status === 'pending' ? '.on' : ''), {
            onclick: () => { f.status = f.status === 'pending' ? 'all' : 'pending'; RZ.app.rerender(); },
          }, `${rows.filter((r) => r.status === 'pending').length} onay bekliyor`)
        : null,
      el('div.grow'),
      el('button.btn.btn-sm.btn-quiet', {
        onclick: () => exportCsv(c, rows),
      }, el('span', { html: U.icon('download', 14) }), 'CSV indir')
    ));

    if (!rows.length) {
      root.appendChild(el('div.card', RZ.ui.emptyState(
        'Bu filtrelerde kayıt yok',
        'Seçili tarih aralığı, durum ve kanal birleşimine uyan rezervasyon bulunamadı. Filtreleri sıfırlayıp tüm kayıtlara bakabilirsiniz.',
        'search',
        { label: 'Filtreleri sıfırla', icon: 'repeat', onClick: () => { f.q = ''; f.status = 'all'; f.channel = 'all'; f.range = 'upcoming'; RZ.app.rerender(); } })));
      return;
    }

    /* --- tablo --- */
    const tb = el('tbody');
    let lastDate = null;
    rows.slice(0, 400).forEach((r) => {
      if (r.date !== lastDate) {
        lastDate = r.date;
        const d = U.fromKey(r.date);
        tb.appendChild(el('tr', el('td', {
          colspan: 8,
          style: { background: 'var(--surface-2)', fontSize: '12px', fontWeight: '650', color: 'var(--ink-2)', padding: '7px 14px' },
        }, `${U.dateStr(d, 'long')}${r.date === todayKey ? ' · bugün' : ''}`)));
      }
      const cus = c.customers.find((x) => x.id === r.customerId);
      const svc = c.services.find((x) => x.id === r.serviceId) || {};
      const res = c.resources.find((x) => x.id === r.resourceId) || {};
      tb.appendChild(el('tr.clickable', { onclick: () => RZ.booking.openDetail(r.id) },
        el('td', el('span.time-chip', U.hhmm(r.start))),
        el('td',
          el('div', { style: { fontWeight: '580' } }, cus ? cus.name : r.guestName || 'Misafir'),
          el('div.hint', cus ? U.phoneFmt(cus.phone) : '')),
        el('td', el('div.t-sm', svc.name), el('div.hint', `${r.end - r.start} dk`)),
        el('td', el('div.row', { style: { gap: '7px' } },
          el('i', { style: { width: '8px', height: '8px', borderRadius: '2px', background: res.color, display: 'block' } }),
          el('span.t-sm', res.name))),
        el('td', el('span.badge', el('span', { html: U.icon(S.CHANNEL[r.channel].icon, 12) }), S.CHANNEL[r.channel].short)),
        el('td', r.deposit ? el('span.badge.badge-violet', tl(r.deposit.amount)) : el('span.hint', '—')),
        el('td.r', el('span.mono-money', tl(r.price))),
        el('td.r', RZ.ui.statusBadge(r.status))
      ));
    });

    root.appendChild(el('div.card',
      el('div.tbl-wrap',
        el('table.tbl',
          el('thead', el('tr',
            el('th', 'Saat'), el('th', 'Müşteri'), el('th', 'Hizmet'), el('th', 'Kaynak'),
            el('th', 'Kanal'), el('th', 'Kapora'), el('th.r', 'Tutar'), el('th.r', 'Durum'))),
          tb
        )
      )
    ));
    if (rows.length > 400) {
      root.appendChild(el('div.hint', { style: { marginTop: '10px', textAlign: 'center' } },
        `İlk 400 kayıt gösteriliyor (toplam ${U.fmtNum(rows.length)}). Filtreleri daraltın veya CSV indirin.`));
    }
  };

  function exportCsv(c, rows) {
    const head = ['Tarih', 'Saat', 'Musteri', 'Telefon', 'Hizmet', 'Kaynak', 'Kanal', 'Tutar', 'Kapora', 'Durum'];
    const lines = [head.join(';')];
    rows.forEach((r) => {
      const cus = c.customers.find((x) => x.id === r.customerId);
      const svc = c.services.find((x) => x.id === r.serviceId) || {};
      const res = c.resources.find((x) => x.id === r.resourceId) || {};
      lines.push([
        r.date, U.hhmm(r.start), cus ? cus.name : r.guestName || 'Misafir', cus ? cus.phone : '',
        svc.name, res.name, S.CHANNEL[r.channel].short, r.price,
        r.deposit ? r.deposit.amount : 0, S.STATUS[r.status].label,
      ].join(';'));
    });
    RZ.ui.exportFile(`rezervle-rezervasyonlar-${U.dayKey(new Date())}.csv`, lines.join('\n'));
  }
})(window.RZ);
