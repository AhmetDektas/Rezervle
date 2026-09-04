/* Rezervle — ortak arayuz bilesenleri (toast, modal, drawer, grafikler, kilit ekrani) */
(function (RZ) {
  'use strict';
  const U = RZ.util;
  const { el, tl, fmtNum } = U;

  /* ---------------- Toast ---------------- */
  function toast(msg, kind, ms) {
    let host = document.getElementById('toasts');
    if (!host) {
      host = el('div#toasts');
      document.body.appendChild(host);
    }
    const t = el('div.toast' + (kind ? '.' + kind : ''), { html: msg });
    host.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 260);
    }, ms || 3200);
  }

  /* ---------------- Modal ---------------- */
  let openLayers = [];
  function closeTop() {
    const l = openLayers.pop();
    if (l) l.destroy();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openLayers.length) closeTop();
  });

  function layer(node, opts) {
    const o = opts || {};
    const scrim = el('div.scrim', { onclick: () => { if (o.dismiss !== false) close(); } });
    document.body.appendChild(scrim);
    document.body.appendChild(node);
    document.body.style.overflow = 'hidden';
    const api = {
      node,
      destroy() {
        node.remove(); scrim.remove();
        openLayers = openLayers.filter((x) => x !== api);
        if (!openLayers.length) document.body.style.overflow = '';
        if (o.onClose) o.onClose();
      },
      close,
    };
    function close() { api.destroy(); }
    openLayers.push(api);
    const focusable = node.querySelector('input,select,textarea,button');
    if (focusable && !o.noFocus) setTimeout(() => focusable.focus(), 60);
    return api;
  }

  /**
   * modal({title, sub, body:Node|fn, actions:[{label,kind,onClick,close}], wide})
   */
  function modal(opts) {
    const node = el('div.modal' + (opts.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true' });
    const head = el('div.modal-head',
      el('div',
        el('h3', opts.title),
        opts.sub ? el('div.sub', opts.sub) : null
      ),
      el('button.x-btn', { html: U.icon('x', 18), title: 'Kapat', onclick: () => api.close() })
    );
    const body = el('div.modal-body');
    node.appendChild(head);
    node.appendChild(body);

    const api = layer(node, opts);
    const content = typeof opts.body === 'function' ? opts.body(api) : opts.body;
    if (content) body.appendChild(content);

    if (opts.actions && opts.actions.length) {
      const foot = el('div.modal-foot');
      opts.actions.forEach((a) => {
        const b = el('button.btn.' + (a.kind || 'btn-ghost'), a.label);
        if (a.id) b.id = a.id;
        b.addEventListener('click', () => {
          const res = a.onClick ? a.onClick(api) : true;
          if (a.close !== false && res !== false) api.close();
        });
        foot.appendChild(b);
      });
      node.appendChild(foot);
    }
    return api;
  }

  function drawer(opts) {
    const node = el('div.drawer', { role: 'dialog', 'aria-modal': 'true' });
    node.appendChild(el('div.modal-head',
      el('div', el('h3', opts.title), opts.sub ? el('div.sub', opts.sub) : null),
      el('button.x-btn', { html: U.icon('x', 18), onclick: () => api.close() })
    ));
    const body = el('div.modal-body.grow');
    node.appendChild(body);
    const api = layer(node, opts);
    const c = typeof opts.body === 'function' ? opts.body(api) : opts.body;
    if (c) body.appendChild(c);
    if (opts.actions && opts.actions.length) {
      const foot = el('div.modal-foot');
      opts.actions.forEach((a) => {
        foot.appendChild(el('button.btn.' + (a.kind || 'btn-ghost'), {
          onclick: () => { const r = a.onClick ? a.onClick(api) : true; if (a.close !== false && r !== false) api.close(); },
        }, a.label));
      });
      node.appendChild(foot);
    }
    return api;
  }

  function confirmDlg(opts) {
    return new Promise((resolve) => {
      modal({
        title: opts.title,
        body: el('p.dim', { style: { fontSize: '14.5px', lineHeight: '1.6' } }, opts.text),
        onClose: () => resolve(false),
        actions: [
          { label: opts.cancel || 'Vazgeç', onClick: () => resolve(false) },
          { label: opts.ok || 'Onayla', kind: opts.danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
        ],
      });
    });
  }

  /* ---------------- KPI ---------------- */
  function kpi(o) {
    const d = o.delta;
    const showDelta = d != null && isFinite(d);
    const up = d > 0;
    const good = o.invert ? !up : up;
    // Turkce'de yuzde isareti sayidan once yazilir: %57
    const val = o.unit === '%' ? el('div.val', '%' + o.value) : el('div.val', o.value, o.unit ? el('small', o.unit) : null);
    return el('div.kpi' + (o.hero ? '.hero' : '') + (o.accent ? '.accent-' + o.accent : ''),
      el('div.lab', o.icon ? el('span', { html: U.icon(o.icon, 14) }) : null, o.label),
      val,
      showDelta
        ? el('div.delta.' + (Math.abs(d) < 0.5 ? '' : good ? 'up' : 'down'),
            Math.abs(d) < 0.5 ? '—' : (up ? '▲' : '▼') + ' ' + U.pctStr(Math.abs(d)),
            o.deltaLabel ? el('span.base', o.deltaLabel) : null)
        : o.foot ? el('div.delta', el('span.base', o.foot)) : null,
      o.spark ? sparkline(o.spark, o.sparkColor || 'var(--brand)') : null
    );
  }

  /* ---------------- Grafikler ---------------- */
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const n = document.createElementNS(svgNS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }

  /** Grafigi bir cumleyle ozetler: ekran okuyucu grafigi "gormek" zorunda kalmaz. */
  function chartLabel(labels, series, o) {
    const fmt = (v) => ((o && o.money) ? tl(v) : fmtNum(v));
    return series.map((ser) => {
      const vals = ser.values;
      const total = U.sum(vals);
      let maxI = 0;
      vals.forEach((v, i) => { if (v > vals[maxI]) maxI = i; });
      return `${ser.name}: ${labels.length} dönem, toplam ${fmt(total)}, ` +
        `en yüksek ${labels[maxI]} (${fmt(vals[maxI])}), ` +
        `ilk ${labels[0]} ${fmt(vals[0])}, son ${labels[labels.length - 1]} ${fmt(vals[vals.length - 1])}`;
    }).join('. ');
  }

  function sparkline(values, color) {
    const w = 96, h = 38;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const rng = max - min || 1;
    const pts = values.map((v, i) => [
      (i / Math.max(1, values.length - 1)) * w,
      h - 4 - ((v - min) / rng) * (h - 10),
    ]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const s = svg('svg', {
      class: 'spark', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none',
      role: 'img', 'aria-label': `Son ${values.length} günün seyri`,
    });
    s.appendChild(svg('path', { d: d + ` L${w},${h} L0,${h} Z`, fill: color, opacity: '.12' }));
    s.appendChild(svg('path', { d, fill: 'none', stroke: color, 'stroke-width': '1.8', 'stroke-linejoin': 'round' }));
    return s;
  }

  /**
   * Alan/cizgi grafigi. series: [{key,name,color,values:[n], dashed}]
   * labels: [str], opts: {height, money, onHover}
   */
  function lineChart(labels, series, opts) {
    const o = opts || {};
    const H = o.height || 210, W = 760, P = { l: 46, r: 12, t: 14, b: 26 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const all = series.flatMap((s) => s.values);
    const max = Math.max(...all, 1) * 1.12;
    const x = (i) => P.l + (labels.length > 1 ? (i / (labels.length - 1)) * iw : iw / 2);
    const y = (v) => P.t + ih - (v / max) * ih;

    const s = svg('svg', {
      viewBox: `0 0 ${W} ${H}`, class: 'lchart', role: 'img',
      style: 'width:100%;height:auto;overflow:visible',
      'aria-label': chartLabel(labels, series, o),
    });

    // yatay izgara + eksen etiketleri
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (max / steps) * i;
      const yy = y(v);
      s.appendChild(svg('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': 1 }));
      const t = svg('text', { x: P.l - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--ink-3)' });
      t.textContent = o.money ? tl(v, { compact: true }).replace(' ₺', '') : fmtNum(v);
      s.appendChild(t);
    }

    // x etiketleri (seyreltilmis)
    const every = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((lb, i) => {
      if (i % every && i !== labels.length - 1) return;
      const t = svg('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink-3)' });
      t.textContent = lb;
      s.appendChild(t);
    });

    series.forEach((ser) => {
      const pts = ser.values.map((v, i) => [x(i), y(v)]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      if (ser.fill !== false && !ser.dashed) {
        s.appendChild(svg('path', {
          d: `${d} L${x(labels.length - 1)},${P.t + ih} L${x(0)},${P.t + ih} Z`,
          fill: ser.color, opacity: '.10',
        }));
      }
      s.appendChild(svg('path', {
        d, fill: 'none', stroke: ser.color, 'stroke-width': ser.dashed ? 1.6 : 2.4,
        'stroke-dasharray': ser.dashed ? '5 4' : null,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
    });

    // etkilesim katmani
    const hover = svg('g', { opacity: '0' });
    const vline = svg('line', { y1: P.t, y2: P.t + ih, stroke: 'var(--ink-3)', 'stroke-width': 1, 'stroke-dasharray': '3 3' });
    hover.appendChild(vline);
    const dots = series.map((ser) => {
      const c = svg('circle', { r: 4.5, fill: 'var(--surface)', stroke: ser.color, 'stroke-width': 2.5 });
      hover.appendChild(c);
      return c;
    });
    s.appendChild(hover);

    const wrap = el('div', { style: { position: 'relative' } }, s);
    const tip = el('div', {
      style: {
        position: 'absolute', pointerEvents: 'none', opacity: '0', transition: 'opacity .12s',
        background: 'var(--ink)', color: 'var(--bg)', padding: '7px 10px', borderRadius: '9px',
        fontSize: '12px', whiteSpace: 'nowrap', transform: 'translate(-50%,-115%)', zIndex: '5',
        boxShadow: 'var(--sh-2)', fontVariantNumeric: 'tabular-nums', lineHeight: '1.45',
      },
    });
    wrap.appendChild(tip);

    s.addEventListener('mousemove', (e) => {
      const box = s.getBoundingClientRect();
      const rel = ((e.clientX - box.left) / box.width) * W;
      let i = Math.round(((rel - P.l) / iw) * (labels.length - 1));
      i = U.clamp(i, 0, labels.length - 1);
      hover.setAttribute('opacity', '1');
      vline.setAttribute('x1', x(i)); vline.setAttribute('x2', x(i));
      dots.forEach((c, k) => { c.setAttribute('cx', x(i)); c.setAttribute('cy', y(series[k].values[i])); });
      tip.innerHTML =
        `<b>${U.esc(labels[i])}</b>` +
        series.map((ser) => `<div style="display:flex;gap:8px;justify-content:space-between"><span style="opacity:.75">${U.esc(ser.name)}</span><b>${o.money ? tl(ser.values[i]) : fmtNum(ser.values[i])}</b></div>`).join('');
      tip.style.opacity = '1';
      tip.style.left = (x(i) / W) * 100 + '%';
      tip.style.top = (y(Math.max(...series.map((ser) => ser.values[i]))) / H) * 100 + '%';
    });
    s.addEventListener('mouseleave', () => { hover.setAttribute('opacity', '0'); tip.style.opacity = '0'; });
    return wrap;
  }

  /** Dikey sutun grafigi — gunluk ciro icin */
  function barChart(labels, values, opts) {
    const o = opts || {};
    const H = o.height || 200, W = 760, P = { l: 46, r: 10, t: 12, b: 24 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const max = Math.max(...values, 1) * 1.1;
    const bw = Math.max(2, (iw / values.length) * 0.62);
    const s = svg('svg', {
      viewBox: `0 0 ${W} ${H}`, style: 'width:100%;height:auto', role: 'img',
      'aria-label': chartLabel(labels, [{ name: o.name || 'Değer', values }], { money: true }),
    });
    for (let i = 0; i <= 4; i++) {
      const yy = P.t + ih - (ih / 4) * i;
      s.appendChild(svg('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'var(--line)' }));
      const t = svg('text', { x: P.l - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--ink-3)' });
      t.textContent = tl((max / 4) * i, { compact: true }).replace(' ₺', '');
      s.appendChild(t);
    }
    const tip = el('div', {
      style: {
        position: 'absolute', pointerEvents: 'none', opacity: '0', transition: 'opacity .12s',
        background: 'var(--ink)', color: 'var(--bg)', padding: '6px 10px', borderRadius: '8px',
        fontSize: '12px', whiteSpace: 'nowrap', transform: 'translate(-50%,-120%)', boxShadow: 'var(--sh-2)',
      },
    });
    values.forEach((v, i) => {
      const cx = P.l + (iw / values.length) * (i + 0.5);
      const h = Math.max(1, (v / max) * ih);
      const rect = svg('rect', {
        x: cx - bw / 2, y: P.t + ih - h, width: bw, height: h, rx: Math.min(3, bw / 2),
        fill: o.colors ? o.colors[i] : 'var(--brand)', opacity: o.dim && o.dim[i] ? '.35' : '1',
      });
      rect.style.transition = 'opacity .15s';
      rect.addEventListener('mouseenter', () => {
        tip.innerHTML = `<b>${U.esc(labels[i])}</b> · ${tl(v)}`;
        tip.style.opacity = '1';
        tip.style.left = (cx / W) * 100 + '%';
        tip.style.top = ((P.t + ih - h) / H) * 100 + '%';
      });
      rect.addEventListener('mouseleave', () => (tip.style.opacity = '0'));
      s.appendChild(rect);
    });
    const every = Math.max(1, Math.ceil(labels.length / 10));
    labels.forEach((lb, i) => {
      if (i % every && i !== labels.length - 1) return;
      const t = svg('text', {
        x: P.l + (iw / values.length) * (i + 0.5), y: H - 6,
        'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink-3)',
      });
      t.textContent = lb;
      s.appendChild(t);
    });
    return el('div', { style: { position: 'relative' } }, s, tip);
  }

  /** Halka grafik — kanal / hizmet dagilimi */
  function donut(items, opts) {
    const o = opts || {};
    const size = o.size || 168, r = size / 2 - 12, cx = size / 2, cy = size / 2;
    const total = U.sum(items, (i) => i.total) || 1;
    const s = svg('svg', {
      viewBox: `0 0 ${size} ${size}`, style: `width:${size}px;height:${size}px;flex:none`, role: 'img',
      'aria-label': 'Dağılım: ' + items.map((i) => `${i.name} ${U.pct(i.total, total)}%`).join(', '),
    });
    let a0 = -Math.PI / 2;
    items.forEach((it) => {
      const frac = it.total / total;
      const a1 = a0 + frac * Math.PI * 2;
      const big = frac > 0.5 ? 1 : 0;
      const p = svg('path', {
        d: `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${big} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`,
        stroke: it.color || 'var(--brand)', 'stroke-width': 18, fill: 'none', 'stroke-linecap': 'butt',
      });
      p.style.opacity = '.92';
      s.appendChild(p);
      a0 = a1 + 0.02;
    });
    const t1 = svg('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700, fill: 'var(--ink)' });
    t1.textContent = o.centerValue || tl(total, { compact: true });
    const t2 = svg('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink-3)' });
    t2.textContent = o.centerLabel || 'toplam';
    s.appendChild(t1); s.appendChild(t2);
    return s;
  }

  /** Siralanmis bar listesi (hizmet/kaynak/personel kirilimi) */
  function barList(items, opts) {
    const o = opts || {};
    const max = Math.max(...items.map((i) => i.total), 1);
    const total = U.sum(items, (i) => i.total) || 1;
    return el('div', items.length
      ? items.slice(0, o.limit || 8).map((it) =>
          el('div.bar-line',
            el('div',
              el('div.lbl',
                el('span.truncate', it.name),
                el('span.v', o.money === false ? fmtNum(it.total) : tl(it.total))
              ),
              el('div.bar-track', el('span', {
                style: { width: (it.total / max) * 100 + '%', background: it.color || 'var(--brand)' },
              }))
            ),
            el('div.pct', '%' + U.pct(it.total, total))
          )
        )
      : emptyState('Bu dönemde kayıt yok', 'Seçili dönemde tamamlanmış rezervasyon bulunmuyor. Üstteki dönem seçiciden daha geniş bir aralık deneyin.', 'trend'));
  }

  /**
   * Bos durum. action: {label, onClick, icon} — cikmaz sokak birakmamak icin
   * her bos ekran bir sonraki adimi onerir.
   */
  function emptyState(title, text, ico, action) {
    return el('div.empty',
      el('div.big', { html: U.icon(ico || 'calendar', 22) }),
      el('div.t', title),
      text ? el('p', text) : null,
      action
        ? el('button.btn.btn-ghost.btn-sm.act', { onclick: action.onClick },
            action.icon ? el('span', { html: U.icon(action.icon, 15) }) : null, action.label)
        : null
    );
  }

  /** Iskelet yukleme bloklari. kind: 'panel' | 'list' | 'chart' */
  function skeleton(kind) {
    const line = (w, cls) => el('div.sk.' + (cls || 'sk-line'), { style: w ? { width: w } : null });
    if (kind === 'list') {
      return el('div.card', Array.from({ length: 6 }, () =>
        el('div.sk-row',
          el('div.sk.sk-avatar'),
          el('div', { style: { flex: '1' } }, line('42%'), line('26%')),
          line('64px'))));
    }
    if (kind === 'chart') {
      return el('div.card.card-pad', line('30%', 'sk-title'), el('div.sk.sk-block'));
    }
    return el('div',
      el('div.kpi-row', { style: { marginBottom: '14px' } },
        el('div.sk.sk-kpi', { style: { height: '118px' } }),
        el('div.sk.sk-kpi'), el('div.sk.sk-kpi'), el('div.sk.sk-kpi')),
      el('div.grid.g2',
        el('div.card.card-pad', line('34%', 'sk-title'), line(), line('88%'), line('72%'), line('90%'), line('60%')),
        el('div.card.card-pad', line('40%', 'sk-title'), el('div.sk', { style: { height: '160px', borderRadius: '12px' } }))));
  }

  /** Tasarlanmis hata durumu — kullaniciya ham hata metni gosterilmez. */
  function errorState(err, onRetry) {
    return el('div.errbox',
      el('div.ic', { html: U.icon('alert', 24) }),
      el('h3', 'Bu ekran açılamadı'),
      el('p', 'Verileriniz güvende — kaybolan bir şey yok. Ekranı yeniden yüklemeyi deneyin; sorun sürerse destek ekibimize bu ekranın adını iletin.'),
      el('div.row', { style: { gap: '8px', marginTop: '4px' } },
        el('button.btn.btn-primary.btn-sm', { onclick: onRetry || (() => RZ.app.rerender()) },
          el('span', { html: U.icon('repeat', 15) }), 'Tekrar dene'),
        el('a.btn.btn-ghost.btn-sm', { href: '#/panel' }, 'Özete dön')),
      el('details',
        el('summary', 'Teknik ayrıntı'),
        el('pre', String((err && err.stack) || err || ''))));
  }

  /* ---------------- Kilit / yukseltme ---------------- */
  /** Kilitli bir bolumu bulaniklastirip uzerine yukseltme karti koyar. */
  function lockPanel(featureKey, preview) {
    const biz = RZ.store.biz();
    const g = RZ.plans.gate(biz, featureKey);
    return el('div.lock-wrap',
      el('div.lock-blur', preview || el('div', { style: { height: '260px' } })),
      el('div.lock-over',
        el('div.lock-card',
          el('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--brand)' }, html: U.icon(g.meta.icon || 'lock', 26) }),
          el('h3', g.meta.name),
          el('p', g.meta.desc || ''),
          el('div.row', { style: { justifyContent: 'center', gap: '8px', flexWrap: 'wrap' } },
            el('button.btn.btn-primary', { onclick: () => upgradeModal(featureKey) },
              g.addon ? `Ek modül olarak ekle · ${tl(g.addon.price)}/ay` : `${g.needPlan.name} pakete geç`),
            el('button.btn.btn-ghost', { onclick: () => (location.hash = '#/panel/paket') }, 'Paketleri gör')
          ),
          el('div.hint', { style: { marginTop: '10px' } },
            g.needPlan ? `${g.needPlan.name} paketine dahildir.` : '')
        )
      )
    );
  }

  /** Yukseltme akisi: ya paketi yukselt ya da ek modul ekle. */
  function upgradeModal(featureKey) {
    const biz = RZ.store.biz();
    const g = RZ.plans.gate(biz, featureKey);
    const cur = RZ.plans.byId(biz.plan);
    const bill = RZ.plans.monthlyBill(biz);

    return modal({
      title: g.meta.name,
      sub: 'İki yoldan açabilirsiniz — hesabınıza uygun olanı seçin.',
      body: el('div.stack',
        el('p.dim.t-sm', { style: { lineHeight: '1.6' } }, g.meta.desc || ''),
        g.addon
          ? el('div.card.card-pad',
              el('div.row-b',
                el('div',
                  el('div', { style: { fontWeight: '650' } }, 'Ek modül olarak ekle'),
                  el('div.hint', `Mevcut ${cur.name} paketiniz aynı kalır · ${g.addon.sku}`)
                ),
                el('div', { style: { textAlign: 'right' } },
                  el('div.mono-money', { style: { fontSize: '18px' } }, tl(g.addon.price)),
                  el('div.hint', '/ay')
                )
              ),
              el('div.divider'),
              el('div.row-b',
                el('div.hint', `Yeni aylık toplam: ${tl(bill.total + g.addon.price)}`),
                el('button.btn.btn-primary.btn-sm', {
                  onclick: (e) => {
                    RZ.store.toggleAddon(featureKey);
                    toast(`<b>${g.meta.name}</b> modülü etkinleştirildi.`, 'ok');
                    e.target.closest('.modal') && closeTop();
                  },
                }, 'Modülü ekle')
              )
            )
          : null,
        g.needPlan && g.needPlan.id !== biz.plan
          ? el('div.card.card-pad', { style: { borderColor: 'var(--brand-line)' } },
              el('div.row-b',
                el('div',
                  el('div', { style: { fontWeight: '650' } }, `${g.needPlan.name} pakete geç`),
                  el('div.hint', `${g.needPlan.features.length} özellik dahil · ${g.needPlan.pitch}`)
                ),
                el('div', { style: { textAlign: 'right' } },
                  el('div.mono-money', { style: { fontSize: '18px' } }, tl(g.needPlan.price)),
                  el('div.hint', `+${tl(g.upgradeDelta)} fark`)
                )
              ),
              el('div.divider'),
              el('ul', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                g.needPlan.features
                  .filter((f) => !cur.features.includes(f))
                  .map((f) => el('li.t-sm.dim', { style: { display: 'flex', gap: '8px' } },
                    el('span', { style: { color: 'var(--money)' }, html: U.icon('check', 15) }),
                    RZ.plans.FEATURES[f].name))
              ),
              el('button.btn.btn-primary.btn-block', {
                style: { marginTop: '14px' },
                onclick: () => {
                  RZ.store.setPlan(g.needPlan.id);
                  toast(`<b>${g.needPlan.name}</b> paketine geçildi.`, 'ok');
                  closeTop();
                },
              }, `${g.needPlan.name} pakete geç`)
            )
          : null,
        el('div.hint', 'Demo ortamı: değişiklik anında uygulanır, kart bilgisi istenmez.')
      ),
    });
  }

  /** Ozellik acik degilse kilit ekranini dondurur, aciksa icerigi. */
  function guarded(featureKey, render) {
    const biz = RZ.store.biz();
    if (RZ.plans.can(biz, featureKey)) return render();
    let preview = null;
    try { preview = render(true); } catch (e) { preview = null; }
    return lockPanel(featureKey, preview);
  }

  /**
   * CSV/metin disa aktarim. Gomulu (iframe) demo ortamlarinda tarayici indirmeyi
   * engeller; o durumda dosyayi indirmek yerine kopyalanabilir olarak gosteririz.
   */
  function exportFile(filename, text) {
    const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
    if (!embedded) {
      const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast(`<b>${filename}</b> indirildi.`, 'ok');
      return;
    }
    const ta = el('textarea.textarea', {
      readonly: true, style: { minHeight: '260px', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '12px', whiteSpace: 'pre' },
    });
    ta.value = text;
    modal({
      title: 'Dışa aktarım · ' + filename,
      sub: 'Gömülü demo ortamında dosya indirme kapalıdır. İçeriği buradan kopyalayabilirsiniz.',
      wide: true,
      body: el('div.stack', ta,
        el('div.hint', 'Gerçek kurulumda bu düğme dosyayı doğrudan indirir; Business pakette muhasebeciye özel dönemsel rapor çıktısı da bulunur.')),
      actions: [
        { label: 'Kapat' },
        { label: 'Panoya kopyala', kind: 'btn-primary', close: false, onClick: () => {
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            toast(ok ? 'Panoya kopyalandı.' : 'Kopyalanamadı — metni seçip elle kopyalayın.', ok ? 'ok' : 'err');
          } },
      ],
    });
  }

  function statusBadge(status) {
    const s = RZ.schedule.STATUS[status];
    return el('span.badge' + (s.badge ? '.' + s.badge : ''), el('i.dot'), s.label);
  }

  function sectionCard(title, sub, body, actions) {
    return el('div.card',
      el('div.card-head',
        el('div', el('h3', title), sub ? el('div.sub', sub) : null),
        actions || null
      ),
      body
    );
  }

  RZ.ui = {
    toast, modal, drawer, confirm: confirmDlg, closeTop,
    kpi, sparkline, lineChart, barChart, donut, barList, emptyState, skeleton, errorState, exportFile,
    lockPanel, upgradeModal, guarded, statusBadge, sectionCard, svg,
  };
})(window.RZ);
