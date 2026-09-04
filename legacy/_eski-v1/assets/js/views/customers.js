/* Rezervle — Panel > Müşteriler
   Ankette 1 numarali sorun "musteri takibi" (%77). Bu ekran o sorunun karsiligidir:
   kim, ne zaman, ne kadar, hangi siklikla — ve kim kaybolmak uzere. */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, A = RZ.analytics, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  const f = { q: '', seg: 'all', sort: 'spend' };

  RZ.views.customers = function (root, params) {
    if (params && params.seg) f.seg = params.seg;
    const c = RZ.store.ctx();
    const ins = A.customerInsights(c, { lostAfter: 60, top: 100 });

    const segs = [
      ['all', 'Tümü', ins.all.length],
      ['top', 'En değerli', Math.min(20, ins.all.length)],
      ['lost', 'Kaybolan', ins.lost.length],
      ['risky', 'No-show riski', ins.risky.length],
      ['new', 'Son 30 gün', ins.all.filter((x) => x.firstVisit && x.firstVisit >= U.dayKey(U.addDays(new Date(), -30))).length],
    ];

    root.appendChild(el('div.filters',
      el('input.input.search', {
        placeholder: 'İsim veya telefon ara…', value: f.q,
        oninput: U.debounce((e) => { f.q = e.target.value; RZ.app.rerender(); }, 250),
      }),
      segs.map(([k, t, n]) =>
        el('button.chip-tog' + (f.seg === k ? '.on' : ''), {
          onclick: () => { f.seg = k; RZ.app.rerender(); },
        }, `${t} · ${n}`)),
      el('div.grow'),
      el('select.select', { onchange: (e) => { f.sort = e.target.value; RZ.app.rerender(); } },
        [['spend', 'Harcamaya göre'], ['visits', 'Ziyarete göre'], ['recent', 'Son ziyarete göre'], ['name', 'İsme göre']]
          .map(([v, t]) => el('option', { value: v, selected: f.sort === v }, t)))
    ));

    /* Segment ozetleri */
    root.appendChild(el('div.grid.g4', { style: { marginBottom: '14px' } },
      RZ.ui.kpi({ label: 'Kayıtlı müşteri', icon: 'users', value: U.fmtNum(ins.all.length), foot: 'Rezervasyondan otomatik oluşur' }),
      RZ.ui.kpi({ label: 'Toplam müşteri değeri', icon: 'wallet', accent: 'money', value: tl(ins.totalValue, { compact: true }), foot: 'Tüm geçmiş harcama' }),
      RZ.ui.kpi({ label: 'Kaybolan müşteri', icon: 'ban', accent: 'danger', value: ins.lost.length, foot: '60 gündür gelmeyen düzenli müşteriler' }),
      RZ.ui.kpi({ label: 'Ortalama ziyaret', icon: 'repeat', value: U.nf.format(Math.round((U.sum(ins.all, (x) => x.visits) / Math.max(1, ins.all.length)) * 10) / 10), foot: 'Müşteri başına' })
    ));

    let list = f.seg === 'lost' ? ins.lost
      : f.seg === 'risky' ? ins.risky
      : f.seg === 'top' ? ins.all.slice().sort((a, b) => b.spend - a.spend).slice(0, 20)
      : f.seg === 'new' ? ins.all.filter((x) => x.firstVisit && x.firstVisit >= U.dayKey(U.addDays(new Date(), -30)))
      : ins.all;

    if (f.q) {
      const nq = U.norm(f.q);
      list = list.filter((x) => U.norm(x.name).includes(nq) || String(x.phone).replace(/\D/g, '').includes(f.q.replace(/\D/g, '')));
    }
    list = list.slice().sort((a, b) =>
      f.sort === 'visits' ? b.visits - a.visits
      : f.sort === 'name' ? a.name.localeCompare(b.name, 'tr')
      : f.sort === 'recent' ? String(b.lastVisit || '').localeCompare(String(a.lastVisit || ''))
      : b.spend - a.spend);

    if (f.seg === 'lost' && ins.lost.length) {
      root.appendChild(el('div.card.card-pad', { style: { marginBottom: '14px', borderColor: 'var(--warn)', background: 'var(--warn-soft)' } },
        el('div.row-b', { style: { flexWrap: 'wrap', gap: '12px' } },
          el('div',
            el('div', { style: { fontWeight: '650' } }, `${ins.lost.length} müşteri en az 60 gündür gelmedi`),
            el('div.hint', `Geçmiş harcamaları toplamı ${tl(U.sum(ins.lost, (x) => x.spend))}. Tek mesajla geri kazanım deneyin.`)),
          el('button.btn.btn-sm.btn-primary', {
            onclick: () => {
              const biz = RZ.store.biz();
              biz.smsUsed = (biz.smsUsed || 0) + ins.lost.length;
              RZ.store.log('campaign', `${ins.lost.length} kayıp müşteriye geri kazanım mesajı gönderildi`);
              RZ.ui.toast(`<b>${ins.lost.length} kişiye</b> geri kazanım SMS’i gönderildi.`, 'ok');
              RZ.app.rerender();
            },
          }, el('span', { html: U.icon('sms', 14) }), 'Geri kazanım mesajı gönder')
        )
      ));
    }

    if (!list.length) {
      root.appendChild(el('div.card', RZ.ui.emptyState(
        f.q ? 'Aramanıza uyan müşteri yok' : 'Bu segmentte müşteri yok',
        f.q
          ? 'İsmin bir kısmını ya da telefonun son dört hanesini yazmayı deneyin.'
          : 'Segmentler rezervasyon geçmişinden otomatik oluşur. Kayıt biriktikçe burada sadık müşteriler, kaybolanlar ve no-show riski taşıyanlar görünür.',
        'users',
        f.q
          ? { label: 'Aramayı temizle', icon: 'x', onClick: () => { f.q = ''; RZ.app.rerender(); } }
          : { label: 'Tüm müşterileri gör', icon: 'users', onClick: () => { f.seg = 'all'; RZ.app.rerender(); } })));
      return;
    }

    const tb = el('tbody');
    list.slice(0, 300).forEach((x) => {
      tb.appendChild(el('tr.clickable', { onclick: () => (location.hash = '#/panel/musteri/' + x.id) },
        el('td', el('div.row', { style: { gap: '10px' } },
          el('div.av-circle', U.initials(x.name)),
          el('div', el('div', { style: { fontWeight: '580' } }, x.name), el('div.hint', U.phoneFmt(x.phone))))),
        el('td.r', el('span.num', x.visits)),
        el('td.r', el('span.mono-money', tl(x.spend))),
        el('td.r', el('span.num.dim', tl(x.avg, { compact: true }))),
        el('td.r', el('span.num.dim', U.nf.format(Math.round(x.freq * 10) / 10) + '/ay')),
        el('td.r', x.lastVisit
          ? el('span.t-sm' + (x.risk ? '.err' : ''), U.relDay(U.fromKey(x.lastVisit)))
          : el('span.hint', '—')),
        el('td.r',
          x.noShows >= 3 ? el("span.badge.badge-danger", `${x.noShows} no-show`)
          : x.risk ? el('span.badge.badge-warn', 'kaybolmak üzere')
          : x.visits >= 8 ? el('span.badge.badge-money', 'sadık')
          : el('span.hint', '—'))
      ));
    });

    root.appendChild(el('div.card', el('div.tbl-wrap', el('table.tbl',
      el('thead', el('tr',
        el('th', 'Müşteri'), el('th.r', 'Ziyaret'), el('th.r', 'Toplam harcama'),
        el('th.r', 'Ortalama'), el('th.r', 'Sıklık'), el('th.r', 'Son ziyaret'), el('th.r', 'Durum'))),
      tb))));
  };

  /* ---------------- Müşteri kartı ---------------- */
  RZ.views.customerDetail = function (root, params) {
    const c = RZ.store.ctx();
    const id = params.id;
    const base = c.customers.find((x) => x.id === id);
    if (!base) {
      root.appendChild(RZ.ui.emptyState(
        'Müşteri bulunamadı',
        'Bu kayıt silinmiş ya da başka bir işletmeye ait olabilir.',
        'users',
        { label: 'Müşteri listesine dön', icon: 'chevL', onClick: () => (location.hash = '#/panel/musteri') }));
      return;
    }
    const ins = A.customerInsights(c, { lostAfter: 60 });
    const x = ins.all.find((k) => k.id === id) || base;
    const rows = c.reservations.filter((r) => r.customerId === id).sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
    const pkgs = c.soldPackages.filter((p) => p.customerId === id);

    root.appendChild(el('div.row', { style: { gap: '14px', marginBottom: '16px', flexWrap: 'wrap' } },
      el('button.btn.btn-ghost.btn-sm', { onclick: () => (location.hash = '#/panel/musteri') },
        el('span', { html: U.icon('chevL', 15) }), 'Müşteriler'),
      el('div.grow'),
      el('button.btn.btn-ghost.btn-sm', {
        onclick: () => { RZ.store.biz().smsUsed = (RZ.store.biz().smsUsed || 0) + 1; RZ.ui.toast('SMS gönderildi.', 'ok'); },
      }, el('span', { html: U.icon('sms', 14) }), 'Mesaj gönder'),
      RZ.plans.can(c.biz, 'packages')
        ? el('button.btn.btn-ghost.btn-sm', { onclick: () => sellPackageModal(c, id) },
            el('span', { html: U.icon('box', 14) }), 'Paket sat')
        : null,
      el('button.btn.btn-primary.btn-sm', { onclick: () => RZ.booking.openBooking({ customerId: id }) },
        el('span', { html: U.icon('plus', 15) }), 'Rezervasyon aç')
    ));

    root.appendChild(el('div.card.card-pad', { style: { marginBottom: '14px' } },
      el('div.row', { style: { gap: '14px', flexWrap: 'wrap' } },
        el('div.av-circle', { style: { width: '54px', height: '54px', borderRadius: '16px', fontSize: '18px', background: 'var(--brand-soft)', color: 'var(--brand-ink)' } }, U.initials(x.name)),
        el('div.grow',
          el('div.row', { style: { gap: '9px' } },
            el('h2', { style: { fontSize: '21px' } }, x.name),
            x.risk ? el('span.badge.badge-warn', 'kaybolmak üzere') : null,
            x.noShows >= 3 ? el("span.badge.badge-danger", `${x.noShows} kez gelmedi`) : null,
            x.visits >= 8 ? el('span.badge.badge-money', 'sadık müşteri') : null),
          el('div.hint', `${U.phoneFmt(x.phone)} · ilk ziyaret ${x.firstVisit ? U.dateStr(U.fromKey(x.firstVisit), 'md') : '—'}`)
        )
      ),
      el('div.grid.g4', { style: { marginTop: '15px', gap: '10px' } },
        el('div.stat-mini', el('div.l', 'Toplam harcama'), el('div.v', { style: { color: 'var(--money)' } }, tl(x.spend))),
        el('div.stat-mini', el('div.l', 'Ziyaret'), el('div.v', x.visits)),
        el('div.stat-mini', el('div.l', 'Ortalama fiş'), el('div.v', tl(x.avg, { compact: true }))),
        el('div.stat-mini', el('div.l', 'Son ziyaret'), el('div.v', { style: { fontSize: '14px' } }, x.lastVisit ? U.relDay(U.fromKey(x.lastVisit)) : '—'))
      )
    ));

    root.appendChild(el('div.split.narrow',
      RZ.ui.sectionCard('Ziyaret geçmişi', `${rows.length} kayıt`,
        el('div', { style: { maxHeight: '520px', overflow: 'auto' } },
          rows.length ? rows.map((r) => {
            const svc = c.services.find((s) => s.id === r.serviceId) || {};
            const res = c.resources.find((s) => s.id === r.resourceId) || {};
            return el('div.lrow.clickable', { onclick: () => RZ.booking.openDetail(r.id) },
              el('div.time-chip', U.dateStr(U.fromKey(r.date), 'md')),
              el('div.grow',
                el('div.t-sm', { style: { fontWeight: '560' } }, svc.name),
                el('div.hint', `${U.hhmm(r.start)} · ${res.name} · ${S.CHANNEL[r.channel].short}`)),
              el('div.mono-money.t-sm', tl(r.price)),
              RZ.ui.statusBadge(r.status));
          }) : RZ.ui.emptyState(
            'Henüz ziyaret yok',
            'Bu müşteri kayıtlı ama daha gelmemiş. İlk randevusunu açtığınızda geçmiş burada birikmeye başlar.',
            'calendar',
            { label: 'Rezervasyon aç', icon: 'plus', onClick: () => RZ.booking.openBooking({ customerId: id }) }))
      ),
      el('div.stack',
        pkgs.length
          ? RZ.ui.sectionCard('Paket bakiyesi', 'Ön ödemeli haklar',
              el('div', pkgs.map((p) =>
                el('div.lrow',
                  el('div.grow',
                    el('div.t-sm', { style: { fontWeight: '580' } }, p.name),
                    el('div.hint', `${p.credits - p.used} / ${p.credits} hak kaldı · son kullanım ${U.dateStr(U.fromKey(p.expiresAt), 'md')}`),
                    el('div.bar-track', { style: { marginTop: '6px' } },
                      el('span', { style: { width: (p.used / p.credits) * 100 + '%', background: 'var(--violet)' } }))),
                  el('span.mono-money.t-sm', tl(p.price)))
              )))
          : null,
        RZ.ui.sectionCard('Notlar', 'Personelin gördüğü ortak not',
          el('div.card-pad',
            el('textarea.textarea', {
              placeholder: 'Örn. kısa saç sevmiyor, kaleci filesi ister, faturayı şirkete kesiyoruz…',
              value: base.note || '',
              onchange: (e) => { RZ.store.upsertCustomer({ id: base.id, note: e.target.value }); RZ.ui.toast('Not kaydedildi.', 'ok'); },
            }),
            el('div.hint', { style: { marginTop: '8px' } }, 'Not, rezervasyon açılırken personelin karşısına çıkar.')))
      )
    ));
  };

  function sellPackageModal(c, customerId) {
    const defs = c.biz.packageDefs || [];
    let sel = defs.length ? defs[0].id : null;
    RZ.ui.modal({
      title: 'Paket sat',
      sub: 'Ön ödemeli paket, işletmeye peşin nakit sağlar ve müşteriyi sisteme bağlar.',
      body: el('div.stack',
        el('div.field', el('label', 'Paket'),
          el('select.select', { onchange: (e) => (sel = e.target.value) },
            defs.map((d) => el('option', { value: d.id }, `${d.name} · ${d.credits} hak · ${U.tl(d.price)}`)))),
        el('div.hint', 'Satış anında ciroya işlenir; her kullanımda bakiye otomatik düşer.')
      ),
      actions: [
        { label: 'Vazgeç' },
        { label: 'Satışı tamamla', kind: 'btn-primary', onClick: () => {
            RZ.store.sellPackage(customerId, sel);
            RZ.ui.toast('Paket satıldı ve bakiye tanımlandı.', 'ok');
            RZ.app.rerender();
          } },
      ],
    });
  }
})(window.RZ);
