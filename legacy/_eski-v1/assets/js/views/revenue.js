/* Rezervle — Panel > Ciro
   Urunun satin alma sebebi burasi: rezervasyon veri girisi, bu ekran ise ciktisi.
   Elle giris yoktur; sistemden gecen her rezervasyon buraya kendiliginden duser. */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, A = RZ.analytics, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  let periodKind = 'month';

  RZ.views.revenue = function (root) {
    const c = RZ.store.ctx();
    const biz = c.biz;
    const p = A.period(periodKind);
    const cmp = A.compare(c, p);
    const rep = cmp.cur;

    /* ---------- Donem secici ---------- */
    root.appendChild(el('div.cal-toolbar',
      el('div.seg',
        [['today', 'Bugün'], ['week', 'Bu hafta'], ['month', 'Bu ay'], ['30d', 'Son 30 gün'], ['90d', 'Son 90 gün'], ['prevMonth', 'Geçen ay']]
          .map(([k, t]) => el('button' + (periodKind === k ? '.on' : ''), {
            onclick: () => { periodKind = k; RZ.app.rerender(); },
          }, t))
      ),
      el('div.grow'),
      el('div.hint', `${U.dateStr(p.from, 'md')} – ${U.dateStr(p.to, 'md')}`)
    ));

    /* ---------- KPI ---------- */
    root.appendChild(el('div.kpi-row', { style: { marginBottom: '14px' } },
      RZ.ui.kpi({
        label: 'Gerçekleşen ciro', icon: 'trend', accent: 'money', hero: true,
        value: tl(rep.gross), delta: cmp.d.gross, deltaLabel: p.prevLabel,
        spark: rep.byDay.map((d) => d.total), sparkColor: 'var(--money)',
      }),
      RZ.ui.kpi({
        label: 'Tamamlanan rezervasyon', icon: 'calendar',
        value: U.fmtNum(rep.count), delta: cmp.d.count, deltaLabel: p.prevLabel,
        foot: rep.expected.length ? `${rep.expected.length} rezervasyon bekliyor (${tl(rep.expectedSum, { compact: true })})` : null,
      }),
      RZ.ui.kpi({
        label: 'Ortalama fiş', icon: 'wallet',
        value: tl(rep.avgTicket), delta: cmp.d.avgTicket, deltaLabel: p.prevLabel,
      }),
      RZ.ui.kpi({
        label: 'Doluluk', icon: 'grid',
        value: rep.occupancy, unit: '%',
        delta: cmp.d.occupancy, deltaLabel: 'puan farkı',
        foot: `${Math.round(rep.occSold / 60)} / ${Math.round(rep.occCap / 60)} saat`,
      })
    ));

    /* ---------- Ana grafik ---------- */
    const labels = rep.byDay.map((d) => U.dateStr(d.date, 'md'));
    const todayKey = U.dayKey(new Date());
    // Gelecek gunlerde gerceklesen ciro sifirdir; onun yerine rezerve edilmis tutari
    // soluk goster — aksi halde grafik sonunda gercek olmayan bir dusus gorunur.
    const future = rep.byDay.map((d) => d.key > todayKey);
    const chart = rep.byDay.length <= 31
      ? RZ.ui.barChart(labels, rep.byDay.map((d, i) => (future[i] ? d.expected : d.total)), {
          height: 240,
          colors: rep.byDay.map((d) => (d.date.getDay() === 0 || d.date.getDay() === 6 ? 'var(--brand)' : 'var(--money)')),
          dim: future,
        })
      : RZ.ui.lineChart(labels, [
          { key: 'g', name: 'Ciro', color: 'var(--money)', values: rep.byDay.map((d) => d.total) },
        ], { money: true, height: 240 });

    root.appendChild(RZ.ui.sectionCard(
      'Günlük ciro', `${p.label} · toplam ${tl(rep.gross)}`,
      el('div.chart-box', chart,
        el('div.chart-legend',
          el('span', el('i', { style: { background: 'var(--money)' } }), 'Hafta içi'),
          el('span', el('i', { style: { background: 'var(--brand)' } }), 'Hafta sonu'),
          future.some(Boolean)
            ? el('span', el('i', { style: { background: 'var(--money)', opacity: '.35' } }), 'Bekleyen (henüz gerçekleşmedi)')
            : null,
          el('span.hint', 'Sütunun üzerine gelin: o günün cirosu görünür.')
        )
      ),
      el('button.btn.btn-sm.btn-quiet', { onclick: () => exportReport(c, rep) },
        el('span', { html: U.icon('download', 14) }), 'Rapor indir')
    ));

    /* ---------- Kayip ve kapora ---------- */
    const lostAvoidable = Math.round(rep.lost * 0.4);
    root.appendChild(el('div.grid.g3', { style: { marginTop: '14px' } },
      el('div.card.card-pad',
        el('div.row', { style: { gap: '9px', color: 'var(--danger)', marginBottom: '9px' } },
          el('span', { html: U.icon('ban', 18) }),
          el('span', { style: { fontWeight: '640', fontSize: '14px' } }, 'Gelmeyen müşteri kaybı')),
        el('div', { style: { fontSize: '26px', fontWeight: '700', letterSpacing: '-.03em', color: 'var(--danger)' } }, tl(rep.lost)),
        el('div.hint', `${rep.noshow.length} rezervasyon · dönem içi oranı %${U.nf.format(Math.round(rep.noShowRate))}`),
        el('div.divider'),
        el('div.hint', { style: { lineHeight: '1.6' } },
          `Otomatik hatırlatma bu kaybı tipik olarak %40 azaltır: bu dönemde `,
          el('b', { style: { color: 'var(--money)' } }, tl(lostAvoidable)),
          ' geri kazanılabilirdi.')
      ),
      el('div.card.card-pad',
        el('div.row', { style: { gap: '9px', color: 'var(--violet)', marginBottom: '9px' } },
          el('span', { html: U.icon('shield', 18) }),
          el('span', { style: { fontWeight: '640', fontSize: '14px' } }, 'Kapora')),
        RZ.plans.can(biz, 'deposit')
          ? el('div',
              el('div', { style: { fontSize: '26px', fontWeight: '700', letterSpacing: '-.03em' } }, tl(rep.deposit.held + rep.deposit.charged)),
              el('div.hint', `${tl(rep.deposit.held)} güvencede · ${tl(rep.deposit.charged)} tahsil edildi`),
              el('div.divider'),
              el('div.hint', 'Para Rezervle’den geçmez; tahsilatı kendi sanal POS’unuzdan yaparsınız.')
            )
          : el('div',
              el('div.hint', { style: { marginBottom: '10px' } },
                'Kapora modülü kapalı. Ankette işletmelerin %68’i kapora istiyor; no-show sorunu ise %77 ile ilk sırada.'),
              el('button.btn.btn-sm.btn-primary', { onclick: () => RZ.ui.upgradeModal('deposit') }, 'Kapora modülünü aç')
            )
      ),
      el('div.card.card-pad',
        el('div.row', { style: { gap: '9px', color: 'var(--brand)', marginBottom: '9px' } },
          el('span', { html: U.icon('users', 18) }),
          el('span', { style: { fontWeight: '640', fontSize: '14px' } }, 'Müşteri')),
        el('div.grid.g2', { style: { gap: '9px' } },
          el('div.stat-mini', el('div.l', 'Gelen müşteri'), el('div.v', rep.customers.active)),
          el('div.stat-mini', el('div.l', 'Yeni müşteri'), el('div.v', rep.customers.new)),
          el('div.stat-mini', el('div.l', 'İptal oranı'), el('div.v', '%' + Math.round(rep.cancelRate))),
          el('div.stat-mini', el('div.l', 'Kişi başı'), el('div.v', tl(rep.customers.active ? rep.gross / rep.customers.active : 0, { compact: true })))
        )
      )
    ));

    /* ---------- Kirilimlar ---------- */
    root.appendChild(el('div.grid.g2', { style: { marginTop: '14px' } },
      RZ.ui.sectionCard('Hizmete göre ciro', `${rep.byService.length} hizmet`,
        el('div.card-pad', RZ.ui.barList(rep.byService.map((x, i) => Object.assign({}, x, { color: palette(i) })), { limit: 8 }))),
      RZ.ui.sectionCard('Kaynağa göre ciro', 'Saha / kort / koltuk / kabin bazında',
        el('div.card-pad', RZ.ui.barList(rep.byResource, { limit: 8 })))
    ));

    /* ---------- Gelismis analiz (paket kilitli) ---------- */
    root.appendChild(el('div', { style: { marginTop: '14px' } },
      RZ.ui.guarded('revenueAdv', () =>
        el('div.grid.g2',
          RZ.ui.sectionCard(
            c.staff.length ? 'Personele göre ciro' : 'Kanala göre ciro',
            c.staff.length ? 'Kim ne kazandırdı' : 'Rezervasyon nereden geldi',
            el('div.card-pad', RZ.ui.barList(c.staff.length ? rep.byStaff : rep.byChannel, { limit: 8 }))
          ),
          RZ.ui.sectionCard('Saat bazlı yoğunluk', 'Hangi saat gerçekten kazandırıyor',
            el('div.card-pad', heatmapEl(c, p)))
        )
      )
    ));

    /* ---------- Aciklama ---------- */
    root.appendChild(el('div.card.card-pad', { style: { marginTop: '14px', background: 'var(--surface-2)' } },
      el('div.row', { style: { gap: '10px', alignItems: 'flex-start' } },
        el('span', { style: { color: 'var(--brand)' }, html: U.icon('bolt', 18) }),
        el('div.hint', { style: { lineHeight: '1.65' } },
          el('b', 'Bu rapor elle doldurulmaz. '),
          'Telefondan, kapıdan, WhatsApp’tan veya Rezervle uygulamasından gelen tüm rezervasyonlar aynı takvime düştüğü için ciro kaydı kendiliğinden oluşur. ',
          'Ön muhasebe yazılımlarından farkı budur: veri girmeyi unutabileceğiniz bir alan yok.')
      )
    ));
  };

  function palette(i) {
    return ['var(--brand)', 'var(--money)', 'var(--violet)', 'var(--warn)', 'var(--cyan)', 'var(--danger)'][i % 6];
  }

  function heatmapEl(c, p) {
    const hm = A.heatmap(c, p);
    const hours = [];
    for (let h = 8; h <= 23; h++) hours.push(h);
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '34px repeat(' + hours.length + ',1fr)', gap: '2px', minWidth: '380px' } });
    grid.appendChild(el('div'));
    hours.forEach((h) => grid.appendChild(el('div.hint', { style: { fontSize: '9px', textAlign: 'center' } }, h % 3 === 0 ? h : '')));
    U.GUN_K.slice(1).concat(U.GUN_K[0]).forEach((gk, wd) => {
      grid.appendChild(el('div.hint', { style: { fontSize: '10.5px', lineHeight: '18px' } }, gk));
      hours.forEach((h) => {
        const v = hm.grid[wd + ':' + h] || 0;
        const a = hm.max ? v / hm.max : 0;
        grid.appendChild(el('div', {
          title: `${gk} ${h}:00 · ${v} rezervasyon`,
          style: {
            height: '18px', borderRadius: '4px',
            background: v ? `color-mix(in srgb, var(--brand) ${Math.round(12 + a * 88)}%, var(--surface-3))` : 'var(--surface-3)',
          },
        }));
      });
    });
    return el('div', { style: { overflowX: 'auto' } }, grid,
      el('div.hint', { style: { marginTop: '10px' } },
        'Koyu hücreler dolu saatleri gösterir. Açık kalan saatler kampanya modülünün hedefidir.'));
  }

  function exportReport(c, rep) {
    const lines = ['Rezervle ciro raporu;' + rep.period.label];
    lines.push('');
    lines.push('Tarih;Ciro;Rezervasyon;No-show kaybi');
    rep.byDay.forEach((d) => lines.push([d.key, d.total, d.count, d.lost].join(';')));
    lines.push('');
    lines.push('Hizmet;Ciro;Adet');
    rep.byService.forEach((s) => lines.push([s.name, s.total, s.count].join(';')));
    lines.push('');
    lines.push('Kaynak;Ciro;Adet');
    rep.byResource.forEach((s) => lines.push([s.name, s.total, s.count].join(';')));
    RZ.ui.exportFile(`rezervle-ciro-${rep.period.fromKey}.csv`, lines.join('\n'));
  }
})(window.RZ);
