/* Rezervle — Panel > Ayarlar ve Paket yönetimi */
(function (RZ) {
  'use strict';
  const U = RZ.util, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  /* ================= AYARLAR ================= */
  RZ.views.settings = function (root) {
    const c = RZ.store.ctx();
    const biz = c.biz;

    /* --- Kurulum durumu --- */
    const steps = [
      { t: 'Kaynaklar tanımlandı', d: `${c.resources.length} kaynak`, ok: c.resources.length > 0 },
      { t: 'Hizmet ve fiyatlar girildi', d: `${c.services.length} hizmet`, ok: c.services.length > 0 },
      { t: 'Çalışma saatleri ayarlandı', d: 'Haftalık takvim', ok: true },
      { t: 'Müşteri listesi aktarıldı', d: `${c.customers.length} müşteri`, ok: c.customers.length > 10 },
      { t: 'Otomatik hatırlatma açık', d: `Randevudan ${biz.settings.reminderHours} saat önce`, ok: true },
    ];
    root.appendChild(el('div.card.card-pad', { style: { marginBottom: '14px' } },
      el('div.row-b', { style: { marginBottom: '6px' } },
        el('h3', { style: { fontSize: '15px' } }, 'Kurulum durumu'),
        el('span.badge.badge-money', `${steps.filter((s) => s.ok).length}/${steps.length} tamam`)),
      el('div', steps.map((s) =>
        el('div.setup-step' + (s.ok ? '.done' : ''),
          el('div.n', { html: s.ok ? U.icon('check', 13) : '' }, s.ok ? null : '•'),
          el('div.grow', el('div.t-sm', { style: { fontWeight: '560' } }, s.t), el('div.hint', s.d)))))
    ));

    /* --- Isletme bilgileri --- */
    root.appendChild(el('div.grid.g2',
      RZ.ui.sectionCard('İşletme bilgileri', 'Uygulamada görünen kartınız',
        el('div.card-pad.stack',
          field('İşletme adı', biz.name, (v) => RZ.store.updateBiz({ name: v })),
          field('Telefon', biz.phone, (v) => RZ.store.updateBiz({ phone: v })),
          field('Adres', biz.address, (v) => RZ.store.updateBiz({ address: v })),
          el('div.row', { style: { gap: '10px' } },
            el('div.grow', field('Kategori', biz.category, (v) => RZ.store.updateBiz({ category: v }))),
            el('div.grow', field('İlçe', biz.district, (v) => RZ.store.updateBiz({ district: v }))))
        )),
      RZ.ui.sectionCard('Çalışma saatleri', 'Bu aralık dışına rezervasyon açılamaz',
        el('div', U.GUN.map((g, i) => {
          const h = biz.hours[i];
          return el('div.lrow',
            el('div.grow.t-sm', { style: { fontWeight: h ? '560' : '400', color: h ? null : 'var(--ink-3)' } }, g),
            h
              ? el('div.row', { style: { gap: '6px' } },
                  timeInput(h[0], (v) => { biz.hours[i][0] = v; RZ.store.emit('hours'); }),
                  el('span.hint', '–'),
                  timeInput(h[1], (v) => { biz.hours[i][1] = v; RZ.store.emit('hours'); }))
              : el('span.badge', 'Kapalı'),
            el('label.row', { style: { gap: '6px', cursor: 'pointer' } },
              el('input', {
                type: 'checkbox', checked: !!h,
                onchange: (e) => { biz.hours[i] = e.target.checked ? [540, 1200] : null; RZ.store.emit('hours'); RZ.app.rerender(); },
              }),
              el('span.hint', 'açık')));
        })))
    ));

    /* --- Kaynaklar --- */
    const lim = RZ.plans.limit(biz, 'resources');
    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(RZ.ui.sectionCard(
      'Kaynaklar', `Saha, kort, koltuk, kabin, masa… · ${c.resources.length}${lim === Infinity ? '' : ' / ' + lim}`,
      el('div', c.resources.map((r) =>
        el('div.lrow',
          el('i', { style: { width: '12px', height: '12px', borderRadius: '4px', background: r.color, display: 'block' } }),
          el('div.grow',
            el('input.input', {
              value: r.name, style: { height: '32px', border: 'none', background: 'transparent', padding: '0', fontWeight: '560' },
              onchange: (e) => RZ.store.updateResource(r.id, { name: e.target.value }),
            }),
            el('div.hint', r.type)),
          el('label.row', { style: { gap: '6px', cursor: 'pointer' } },
            el('input', { type: 'checkbox', checked: !r.closed, onchange: (e) => { RZ.store.updateResource(r.id, { closed: !e.target.checked }); RZ.app.rerender(); } }),
            el('span.hint', 'aktif')),
          el('button.btn.btn-sm.btn-quiet', {
            style: { color: 'var(--danger)' },
            onclick: async () => {
              const ok = await RZ.ui.confirm({ title: 'Kaynağı sil', text: `${r.name} silinecek. Geçmiş rezervasyonlar raporlarda kalır.`, ok: 'Sil', danger: true });
              if (ok) { RZ.store.removeResource(r.id); RZ.app.rerender(); }
            },
          }, 'Sil'))
      )),
      el('button.btn.btn-sm.btn-ghost', {
        onclick: () => {
          const res = RZ.store.addResource({ name: `Yeni kaynak ${c.resources.length + 1}`, type: c.resources[0] ? c.resources[0].type : 'Kaynak', color: '#2b59f0' });
          if (!res.ok) { RZ.ui.toast(res.error, 'err'); RZ.ui.upgradeModal('multiBranch'); return; }
          RZ.ui.toast('Kaynak eklendi.', 'ok'); RZ.app.rerender();
        },
      }, el('span', { html: U.icon('plus', 15) }), 'Kaynak ekle')
    ));
    if (lim !== Infinity) {
      root.appendChild(el('div.hint', { style: { marginTop: '8px' } },
        `${RZ.plans.byId(biz.plan).name} paketinde en fazla ${lim} kaynak tanımlanabilir. `,
        el('a', { href: '#/panel/paket', style: { color: 'var(--brand)', fontWeight: '600' } }, 'Paketleri karşılaştır')));
    }

    /* --- Hizmetler --- */
    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(RZ.ui.sectionCard('Hizmetler ve fiyatlar', 'Ciro raporu bu fiyatlardan oluşur',
      el('div.tbl-wrap', el('table.tbl',
        el('thead', el('tr', el('th', 'Hizmet'), el('th', 'Süre'), el('th.r', 'Fiyat'), el('th.r', 'Kapora'), el('th'))),
        el('tbody', c.services.map((s) =>
          el('tr',
            el('td', el('input.input', {
              value: s.name, style: { height: '32px', border: 'none', background: 'transparent', padding: '0', fontWeight: '560' },
              onchange: (e) => RZ.store.upsertService({ id: s.id, name: e.target.value }),
            })),
            el('td', el('div.row', { style: { gap: '5px' } },
              el('input.input', { type: 'number', value: s.duration, style: { width: '78px', height: '32px' }, onchange: (e) => RZ.store.upsertService({ id: s.id, duration: Number(e.target.value) }) }),
              el('span.hint', 'dk'))),
            el('td.r', el('input.input', { type: 'number', value: s.price, style: { width: '110px', height: '32px', textAlign: 'right' }, onchange: (e) => RZ.store.upsertService({ id: s.id, price: Number(e.target.value) }) })),
            el('td.r', el('input.input', { type: 'number', value: s.deposit || 0, style: { width: '100px', height: '32px', textAlign: 'right' }, onchange: (e) => RZ.store.upsertService({ id: s.id, deposit: Number(e.target.value) }) })),
            el('td.r', el('button.btn.btn-sm.btn-quiet', {
              style: { color: 'var(--danger)' },
              onclick: () => { RZ.store.removeService(s.id); RZ.app.rerender(); },
            }, 'Sil')))
        )))),
      el('button.btn.btn-sm.btn-ghost', {
        onclick: () => {
          RZ.store.upsertService({ name: 'Yeni hizmet', duration: 60, price: 500, deposit: 0, color: '#2b59f0', resourceTypes: null });
          RZ.app.rerender();
        },
      }, el('span', { html: U.icon('plus', 15) }), 'Hizmet ekle')));

    /* --- Bildirim ve veri --- */
    root.appendChild(el('div', { style: { height: '14px' } }));
    root.appendChild(el('div.grid.g2',
      RZ.ui.sectionCard('Hatırlatma ayarları', 'No-show’u azaltan tek en etkili özellik',
        el('div.card-pad.stack',
          el('div.field', el('label', 'Randevudan kaç saat önce SMS gönderilsin'),
            el('select.select', { onchange: (e) => { biz.settings.reminderHours = Number(e.target.value); RZ.store.emit('settings'); } },
              [1, 2, 3, 6, 12, 24, 48].map((h) => el('option', { value: h, selected: biz.settings.reminderHours === h }, h + ' saat')))),
          el('div.field', el('label', 'Ücretsiz iptal penceresi'),
            el('select.select', { onchange: (e) => { biz.settings.cancelWindow = Number(e.target.value); RZ.store.emit('settings'); } },
              [0, 3, 6, 12, 24].map((h) => el('option', { value: h, selected: biz.settings.cancelWindow === h }, h ? h + ' saat öncesine kadar' : 'İptal edilemez')))),
          el('div.hint', 'Hatırlatma mesajında tek tıkla teyit ve iptal bağlantısı yer alır; iptal edilen slot anında yeniden satışa açılır.'))),
      RZ.ui.sectionCard('Demo verisi', 'Bu bir tanıtım ortamıdır',
        el('div.card-pad.stack',
          el('div.hint', { style: { lineHeight: '1.6' } },
            'Panel, tarayıcınızda saklanan örnek veriyle çalışır. Yaptığınız değişiklikler kalıcıdır; ',
            'sıfırlayarak ilk hâline döndürebilirsiniz.'),
          el('button.btn.btn-ghost', {
            onclick: async () => {
              const ok = await RZ.ui.confirm({ title: 'Demo verisini sıfırla', text: 'Tüm değişiklikler silinecek ve örnek veri yeniden oluşturulacak.', ok: 'Sıfırla', danger: true });
              if (ok) { RZ.store.reset(); RZ.ui.toast('Demo verisi sıfırlandı.', 'ok'); RZ.app.rerender(); }
            },
          }, el('span', { html: U.icon('repeat', 15) }), 'Demo verisini sıfırla')))
    ));

    function field(label, value, onSave) {
      return el('div.field', el('label', label),
        el('input.input', { value: value || '', onchange: (e) => { onSave(e.target.value); RZ.ui.toast('Kaydedildi.', 'ok'); } }));
    }
    function timeInput(mins, onSave) {
      return el('input.input', {
        type: 'time', value: U.hhmm(mins), style: { width: '104px', height: '32px' },
        onchange: (e) => onSave(U.parseTime(e.target.value)),
      });
    }
  };

  /* ================= PAKET ================= */
  RZ.views.plan = function (root) {
    const biz = RZ.store.biz();
    const c = RZ.store.ctx();
    const cur = RZ.plans.byId(biz.plan);
    const bill = RZ.plans.monthlyBill(biz);

    root.appendChild(el('div.card.card-pad', { style: { marginBottom: '16px' } },
      el('div.row-b', { style: { flexWrap: 'wrap', gap: '14px' } },
        el('div',
          el('div.hint', 'Mevcut paketiniz'),
          el('div.row', { style: { gap: '10px', marginTop: '3px' } },
            el('h2', { style: { fontSize: '22px' } }, 'Rezervle ' + cur.name),
            (biz.addons || []).length ? el('span.badge.badge-violet', `${biz.addons.length} ek modül`) : null),
          el('div.hint', { style: { marginTop: '4px' } }, `${cur.pitch} · ${cur.target}`)),
        el('div', { style: { textAlign: 'right' } },
          el('div', { style: { fontSize: '28px', fontWeight: '700', letterSpacing: '-.03em' } }, tl(bill.total)),
          el('div.hint', 'aylık toplam · KDV hariç'))),
      el('div.divider'),
      el('div.grid.g4', { style: { gap: '10px' } },
        el('div.stat-mini', el('div.l', 'Kaynak'), el('div.v', `${c.resources.length}${RZ.plans.limit(biz, 'resources') === Infinity ? '' : ' / ' + RZ.plans.limit(biz, 'resources')}`)),
        el('div.stat-mini', el('div.l', 'SMS'), el('div.v', `${U.fmtNum(biz.smsUsed || 0)} / ${U.fmtNum(RZ.plans.limit(biz, 'sms'))}`)),
        el('div.stat-mini', el('div.l', 'Bu ay rezervasyon'), el('div.v', c.reservations.filter((r) => r.date >= U.dayKey(U.startOfMonth(new Date()))).length)),
        el('div.stat-mini', el('div.l', 'Üyelik'), el('div.v', { style: { fontSize: '14px' } }, U.dateStr(U.fromKey(biz.since), 'md') + '’den beri')))
    ));

    /* Fatura dokumu */
    root.appendChild(el('div.split.side', { style: { marginBottom: '16px' } },
      RZ.ui.sectionCard('Paketler', 'Fiyatlar 35 işletmeyle yapılan saha anketine göre belirlendi (medyan 2.000 ₺/ay)',
        el('div.card-pad',
          el('div.plan-grid', RZ.plans.PLANS.map((p) => planCard(p, biz)))
        )),
      RZ.ui.sectionCard('Aylık faturanız', 'Ek modüller ayrı satır olarak görünür',
        el('div.card-pad',
          el('div', bill.lines.map((l) =>
            el('div.row-b', { style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } },
              el('div',
                el('div.t-sm', { style: { fontWeight: '560' } }, l.label),
                l.kind === 'addon' ? el('div.hint', 'ek modül') : null),
              el('div.row', { style: { gap: '8px' } },
                el('span.mono-money.t-sm', tl(l.amount)),
                l.kind === 'addon'
                  ? el('button.btn.btn-sm.btn-quiet', {
                      style: { color: 'var(--danger)' },
                      onclick: () => { RZ.store.toggleAddon(l.key); RZ.ui.toast('Modül kaldırıldı.'); RZ.app.rerender(); },
                    }, 'Kaldır')
                  : null)))),
          el('div.row-b', { style: { paddingTop: '12px', fontWeight: '700' } },
            el('span', 'Toplam'), el('span.mono-money', { style: { fontSize: '18px' } }, tl(bill.total))),
          el('div.hint', { style: { marginTop: '10px' } },
            '30 gün ücretsiz deneme · kurulum ücreti alınmaz · uygulamada listelenme her pakette ücretsizdir.')))
    ));

    root.appendChild(valueProof(c, biz, bill));

    /* Ek moduller */
    const addable = RZ.plans.availableAddons(biz);
    root.appendChild(RZ.ui.sectionCard('Ek modüller', 'Paketi yükseltmeden tek tek açabilirsiniz',
      el('div.card-pad',
        el('div.grid.g3',
          Object.keys(RZ.plans.FEATURES).filter((k) => RZ.plans.FEATURES[k].addon).map((k) => {
            const f = RZ.plans.FEATURES[k];
            const on = RZ.plans.can(biz, k);
            const inPlan = cur.features.includes(k);
            return el('div.card.card-pad', { style: on ? { borderColor: 'var(--money)' } : null },
              el('div.row', { style: { gap: '9px', marginBottom: '8px' } },
                el('span', { style: { color: on ? 'var(--money)' : 'var(--ink-3)' }, html: U.icon(f.icon, 18) }),
                el('div.grow', el('div', { style: { fontWeight: '620', fontSize: '14px' } }, f.name)),
                on ? el('span.badge.badge-money', inPlan ? 'pakette' : 'açık') : null),
              el('div.hint', { style: { minHeight: '52px', lineHeight: '1.5' } }, f.desc),
              el('div.row-b', { style: { marginTop: '10px' } },
                el('span.mono-money.t-sm', tl(f.addon.price) + '/ay'),
                inPlan
                  ? el('span.hint', 'dahil')
                  : el('button.btn.btn-sm.' + (on ? 'btn-ghost' : 'btn-primary'), {
                      onclick: () => { RZ.store.toggleAddon(k); RZ.ui.toast(on ? 'Modül kapatıldı.' : `<b>${f.name}</b> açıldı.`, on ? '' : 'ok'); RZ.app.rerender(); },
                    }, on ? 'Kapat' : 'Ekle')));
          })
        ),
        addable.length ? null : el('div.hint', { style: { marginTop: '12px' } }, 'Tüm modüller paketinize dahil.'))));
  };

  /* "Bu ay ne kazandirdi" — faturanin yanindaki kanit.
     Kesin olcumler ile tahmini kazanimlar acikca ayrilir; tahmin gizlenmez. */
  function valueProof(c, biz, bill) {
    const A = RZ.analytics, S = RZ.schedule;
    const p = A.period('month');
    const rep = A.report(c, p);

    // Olculen: gercekten tahsil edilmis kapora (aksi halde tamamen kayipti)
    const charged = c.reservations.filter(
      (r) => r.deposit && r.deposit.status === 'charged' && r.date >= p.fromKey && r.date <= p.toKey
    );
    const depositSaved = RZ.plans.can(biz, 'deposit') ? U.sum(charged, (r) => r.deposit.amount) : 0;

    // Baglam: pesin alinan paket nakdi. Ciro degil nakit akisidir ve isletme
    // bunun bir kismini zaten satardi -> TOPLAMA DAHIL EDILMEZ, ayri gosterilir.
    const pkgCash = U.sum(
      c.soldPackages.filter((x) => x.soldAt >= p.fromKey && x.soldAt <= p.toKey),
      (x) => x.price
    );

    // Tahmini: hatirlatmanin onledigi no-show (olculen kaybin %40'i)
    const preventedNoShow = Math.round(rep.lost * 0.4);

    // Tahmini: kampanyadan donen rezervasyonlar. Indirim dusulur ve yalnizca
    // yarisi kampanyaya atfedilir (digeri muhtemelen zaten gelecekti).
    const campaignGain = Math.round(U.sum(
      c.campaigns.filter((x) => x.createdAt >= p.from.toISOString()),
      (x) => x.redeemed * (rep.avgTicket || 0) * (1 - (x.discount || 0) / 100) * 0.5
    ));

    const total = depositSaved + preventedNoShow + campaignGain;
    const line = (label, amount, note, estimated) =>
      el('div.row-b', { style: { padding: '9px 0', borderBottom: '1px solid var(--line)' } },
        el('div',
          el('div.t-sm', { style: { fontWeight: '560' } }, label,
            estimated ? el('span.badge', { style: { marginLeft: '7px', height: '18px', fontSize: '10.5px' } }, 'tahmini') : null),
          el('div.hint', note)),
        el('span.mono-money.t-sm', { style: { color: amount ? 'var(--money)' : 'var(--ink-3)' } }, '+' + tl(amount)));

    return RZ.ui.sectionCard(
      'Bu ay Rezervle ne kazandırdı', `${p.label} · abonelik bedeliniz ${tl(bill.total)}`,
      el('div.card-pad',
        el('div.split.side',
          el('div',
            line('Tahsil edilen kapora', depositSaved,
              `${charged.length} gelmeyen müşteriden tahsil edildi — kaporasız tamamen kayıptı`, false),
            line('Hatırlatmayla önlenen kayıp', preventedNoShow,
              `Bu ay ölçülen no-show kaybı ${tl(rep.lost)}; otomatik hatırlatma bunu tipik olarak %40 azaltır`, true),
            line('Kampanyayla dolan boş saat', campaignGain,
              'İndirim düşülmüş tutarın yarısı sayıldı — diğer yarısı zaten gelecek olan müşteri kabul edildi', true),
            el('div.row-b', { style: { paddingTop: '13px' } },
              el('b', 'Toplam katkı'),
              el('span.mono-money', { style: { fontSize: '19px', color: 'var(--money)' } }, tl(total))),
            el('div.row-b', { style: { paddingTop: '6px' } },
              el('span.dim.t-sm', 'Abonelik bedeli'),
              el('span.mono-money.t-sm', '−' + tl(bill.total))),
            pkgCash
              ? el('div.row-b', { style: { marginTop: '12px', paddingTop: '11px', borderTop: '1px solid var(--line)' } },
                  el('div',
                    el('div.t-sm', { style: { fontWeight: '560' } }, 'Ayrıca: paket satışından peşin nakit'),
                    el('div.hint', 'Nakit akışına katkı — ciro sayılmaz, toplama dahil edilmedi')),
                  el('span.mono-money.t-sm.dim', tl(pkgCash)))
              : null),
          el('div.card.card-pad', {
            style: {
              background: total >= bill.total ? 'var(--money-soft)' : 'var(--warn-soft)',
              borderColor: 'transparent', textAlign: 'center',
            },
          },
            el('div.hint', { style: { marginBottom: '6px' } }, 'Net'),
            el('div', {
              style: {
                fontSize: '30px', fontWeight: '700', letterSpacing: '-.03em',
                color: total >= bill.total ? 'var(--money)' : 'var(--warn)',
              },
            }, (total - bill.total >= 0 ? '+' : '') + tl(total - bill.total)),
            el('div.hint', { style: { marginTop: '8px', lineHeight: '1.55' } },
              total >= bill.total
                ? 'Bu ay ürün kendi bedelini ödedi. Rakamlar panelinizdeki gerçek kayıtlardan hesaplanır.'
                : 'Bu ay katkı abonelik bedelinin altında. Kapora ve kampanya modüllerini kullanmak farkı kapatır.'))),
        el('div.hint', { style: { marginTop: '14px', lineHeight: '1.6' } },
          el('b', 'Nasıl hesaplanıyor: '),
          'Kapora satırı panelinizdeki gerçek tahsilattır. "Tahmini" işaretli iki satır sektör ortalamasına dayanır ve ',
          el('b', 'bilerek muhafazakâr'),
          ' tutuldu: kampanya kazanımının yalnızca yarısı sayıldı, paket peşinatı toplama hiç dahil edilmedi. ',
          'Kendi verinizle zamanla kalibre edilir.')));
  }

  function planCard(p, biz) {
    const isCur = p.id === biz.plan;
    const featureList = Object.keys(RZ.plans.FEATURES);
    return el('div.plan-card' + (isCur ? '.current' : ''),
      p.popular ? el('div.ribbon', 'En çok tercih edilen') : null,
      el('div.pt', p.name),
      el('div.pp', tl(p.price), el('small', ' /ay')),
      el('div.hint', p.pitch),
      el('ul',
        featureList.filter((k) => !RZ.plans.FEATURES[k].core).map((k) => {
          const has = p.features.includes(k);
          return el('li' + (has ? '' : '.off'),
            el('span.ck', { html: U.icon(has ? 'check' : 'x', 14) }),
            RZ.plans.FEATURES[k].name);
        }),
        el('li', el('span.ck', { html: U.icon('check', 14) }),
          p.limits.resources === Infinity ? 'Sınırsız kaynak' : `${p.limits.resources} kaynağa kadar`),
        el('li', el('span.ck', { html: U.icon('check', 14) }), `Aylık ${U.fmtNum(p.limits.sms)} SMS`)
      ),
      isCur
        ? el('button.btn.btn-ghost.btn-block', { disabled: true }, 'Mevcut paketiniz')
        : el('button.btn.' + (RZ.plans.rank(p.id) > RZ.plans.rank(biz.plan) ? 'btn-primary' : 'btn-ghost') + '.btn-block', {
            onclick: () => {
              RZ.store.setPlan(p.id);
              RZ.ui.toast(`<b>${p.name}</b> paketine geçildi.`, 'ok');
              RZ.app.rerender();
            },
          }, RZ.plans.rank(p.id) > RZ.plans.rank(biz.plan) ? `${p.name} pakete geç` : `${p.name} pakete dön`),
      el('div.hint', { style: { marginTop: '9px', textAlign: 'center' } }, p.target)
    );
  }
})(window.RZ);
