/* Rezervle — İşletme tanıtım sayfası (#/isletme)
   Hedef kitle: isletme sahibi. Sattigimiz sey bir defter degil; isletmenin kendi
   cirosunu gorebilmesi. Sayfa bu iddia uzerine kurulu.
   Tuketiciye yonelik ana sayfa icin bkz. landing-consumer.js */
(function (RZ) {
  'use strict';
  const U = RZ.util, A = RZ.analytics, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  RZ.views.business = function (root) {
    root.className = 'site';
    root.dataset.page = 'business';
    root.appendChild(header());
    const main = el('main', { id: 'main', tabindex: '-1' },
      hero(), proof(), problem(), features(), roi(), twoSided(), pricing(), faq(), finalCta());
    root.appendChild(main);
    root.appendChild(footer());
    reveal(root);
  };

  /* ---------------- Üst menü ---------------- */
  function header() {
    const h = el('header.site-head',
      el('div.wrapx',
        el('div.bar',
          el('a.logo', { href: '#/' },
            el('span.mark', { html: U.logoMark(31) }), 'Rezervle'),
          el('nav.site-nav',
            el('a', { href: '#urun' }, 'Ürün'),
            el('a', { href: '#nasil' }, 'Nasıl çalışır'),
            el('a', { href: '#paketler' }, 'Paketler'),
            el('a', { href: '#sss' }, 'S.S.S.')),
          el('div.grow'),
          el('button.icon-btn', { html: U.icon('moon', 18), title: 'Tema', onclick: RZ.app.toggleTheme }),
          el('a.btn.btn-ghost.btn-sm.hide-sm', { href: '#/' }, 'Kullanıcı sayfası'),
          el('a.btn.btn-primary.btn-sm', { href: '#/panel' }, 'İşletme panelini aç')
        )
      )
    );
    const onScroll = () => h.classList.toggle('stuck', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return h;
  }

  /* ---------------- Hero ---------------- */
  function hero() {
    return el('section.hero',
      el('div.hero-glow'),
      el('div.wrapx',
        el('div.inner',
          el('div.eyebrow', el('span', { html: U.icon('sparkle', 14) }), 'Ankara’da 35 işletmeyle yapılan saha araştırmasıyla tasarlandı'),
          el('h1', 'Rezervasyonu deftere yazmayı bırakın. ', el('span.hl', 'Cironuzu görmeye'), ' başlayın.'),
          el('p.lead',
            'Rezervle; halı saha, kuaför, güzellik salonu ve restoranların rezervasyonunu, müşterisini ve cirosunu tek panelde toplar. ',
            'Telefondan, kapıdan, WhatsApp’tan veya uygulamadan gelen her randevu aynı takvime düşer — ciro raporunuz kendiliğinden dolar.'),
          el('div.hero-cta',
            el('a.btn.btn-primary.btn-lg', { href: '#/panel' }, 'İşletme panelini canlı deneyin', el('span', { html: U.icon('chevR', 17) })),
            el('a.btn.btn-ghost.btn-lg', { href: '#paketler' }, 'Paketleri gör')),
          el('div.hero-note',
            el('span', el('span', { style: { color: 'var(--money)' }, html: U.icon('check', 15) }), '30 gün ücretsiz'),
            el('span', el('span', { style: { color: 'var(--money)' }, html: U.icon('check', 15) }), 'Kart bilgisi istenmez'),
            el('span', el('span', { style: { color: 'var(--money)' }, html: U.icon('check', 15) }), 'Kurulum ve veri aktarımı bizden'),
            el('span', el('span', { style: { color: 'var(--money)' }, html: U.icon('check', 15) }), 'Uygulamada listelenme ücretsiz'))
        ),
        el('div.shot', shot())
      )
    );
  }

  /** Gercek demo verisiyle beslenen panel onizlemesi */
  function shot() {
    const c = RZ.store.ctx();
    const cmp = A.compare(c, A.period('month'));
    const rep = cmp.cur;
    const today = c.reservations.filter((r) => r.date === U.dayKey(new Date())).sort((a, b) => a.start - b.start).slice(0, 4);

    const miniKpi = (l, v, d, color) => el('div', { style: { padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '12px' } },
      el('div', { style: { fontSize: '10.5px', color: 'var(--ink-3)' } }, l),
      el('div', { style: { fontSize: '18px', fontWeight: '700', letterSpacing: '-.02em', color: color || 'var(--ink)', fontVariantNumeric: 'tabular-nums' } }, v),
      d ? el('div', { style: { fontSize: '10.5px', color: 'var(--money)', fontWeight: '600' } }, d) : null);

    return el('div.shot-frame',
      el('div.shot-bar', el('i'), el('i'), el('i'), el('span.url', 'panel.rezervle.com/ozet')),
      el('div.shot-body',
        el('div.shot-side',
          el('div.si.on', el('span.sq'), 'Özet'),
          el('div.si', el('span.sq'), 'Takvim'),
          el('div.si', el('span.sq'), 'Rezervasyonlar'),
          el('div.si', el('span.sq'), 'Müşteriler'),
          el('div.si', el('span.sq'), 'Ciro'),
          el('div.si', el('span.sq'), 'Kapora'),
          el('div.si', el('span.sq'), 'Kampanya')),
        el('div.shot-main',
          el('div.shot-kpis',
            miniKpi('Bu ay ciro', tl(rep.gross, { compact: true }), '▲ ' + U.pctStr(Math.abs(cmp.d.gross)), 'var(--money)'),
            miniKpi('Rezervasyon', U.fmtNum(rep.count)),
            miniKpi('Doluluk', '%' + rep.occupancy),
            miniKpi('No-show kaybı', tl(rep.lost, { compact: true }), null, 'var(--danger)')),
          el('div', { style: { border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' } },
            el('div', { style: { padding: '9px 13px', borderBottom: '1px solid var(--line)', fontSize: '12.5px', fontWeight: '650' } },
              'Bugünün akışı'),
            today.length ? today.map((r) => {
              const cus = c.customers.find((x) => x.id === r.customerId);
              const res = c.resources.find((x) => x.id === r.resourceId) || {};
              const svc = c.services.find((x) => x.id === r.serviceId) || {};
              return el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 13px', borderBottom: '1px solid var(--line)' } },
                el('span', { style: { fontSize: '11.5px', fontWeight: '650', background: 'var(--surface-3)', padding: '2px 7px', borderRadius: '6px', fontVariantNumeric: 'tabular-nums' } }, U.hhmm(r.start)),
                el('div', { style: { flex: '1', minWidth: '0' } },
                  el('div', { style: { fontSize: '12.5px', fontWeight: '580' } }, cus ? cus.name : 'Misafir'),
                  el('div', { style: { fontSize: '10.5px', color: 'var(--ink-3)' } }, `${svc.name} · ${res.name}`)),
                el('span', { style: { fontSize: '12px', fontWeight: '650', fontVariantNumeric: 'tabular-nums' } }, tl(r.price)));
            }) : el('div', { style: { padding: '14px', fontSize: '12px', color: 'var(--ink-3)' } }, 'Bugün için kayıt yok')),
          el('div', { style: { marginTop: '12px' } },
            RZ.ui.lineChart(rep.byDay.map((d) => U.dateStr(d.date, 'md')),
              [{ key: 'g', name: 'Ciro', color: 'var(--money)', values: rep.byDay.map((d) => d.total) }],
              { money: true, height: 150 }))
        )
      )
    );
  }

  /* ---------------- Kanıt bandı ---------------- */
  function proof() {
    const cells = [
      ['%97', 'rezervasyonu telefonla alıyor'],
      ['%79', 'manuel deftere yazıyor'],
      ['%9', 'herhangi bir yazılım kullanıyor'],
      ['%77', 'en büyük sorun: müşteri takibi ve no-show'],
      ['%69', 'uygulamada ciro takibi istiyor'],
    ];
    return el('section.proof',
      el('div.wrapx', { style: { padding: '0' } },
        el('div.in', cells.map(([n, l]) => el('div.cell', el('div.n', n), el('div.l', l)))),
      ),
      el('div.wrapx', el('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)', padding: '0 0 14px' } },
        'Kaynak: Rezervle saha anketi · 35 işletme · Ankara · Ağustos 2026. Örneklem yön gösterir, istatistiksel kesinlik iddia etmez.'))
    );
  }

  /* ---------------- Problem / çözüm ---------------- */
  function problem() {
    const bad = [
      ['Aynı saate iki kayıt', 'Defterde çakışma fark edilmez; müşteri kapıda karşılaşır.'],
      ['Kim geldi, kim gelmedi belirsiz', 'Gelmeyen müşteri doğrudan kayıp kapasitedir — ve kimse ölçmez.'],
      ['Ay sonu tahmini', 'Ciro kasadan tahmin edilir; hangi hizmet ya da hangi saha kazandırıyor bilinmez.'],
      ['Kanal dağınık', 'Telefon, WhatsApp, Instagram DM… hepsi ayrı yerde durur.'],
      ['Müşteri hafızası yok', 'Kim ne zaman geldi, ne kadar harcadı — kayıt tutulmaz.'],
    ];
    const good = [
      ['Çakışma sistemce engellenir', 'Aynı kaynak aynı anda ikinci kez satılamaz. Kayıt hiçbir yoldan içeri giremez.'],
      ['Gelmeyen müşteri TL olarak görünür', 'Otomatik hatırlatma, isteğe bağlı kapora ve no-show raporu.'],
      ['Ciro kendiliğinden oluşur', 'Sistemden geçen her rezervasyon ciro kaydıdır; elle giriş yoktur.'],
      ['Tüm kanallar tek takvimde', 'Telefondan gelen de, uygulamadan gelen de aynı ekranda.'],
      ['Müşteri kartı otomatik dolar', 'Ziyaret, harcama, sıklık ve “kaybolan müşteriler” listesi.'],
    ];
    return el('section.sec', { id: 'urun' },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Problem'),
          el('h2', 'Rakibimiz başka bir uygulama değil — kâğıt.'),
          el('p', 'Hedef işletmelerin %79’u rezervasyonu manuel deftere yazıyor, yalnızca %9’u herhangi bir yazılım kullanıyor. Sorun rezervasyon almak değil; alınan rezervasyonun ne olduğunu görememek.')),
        el('div.vs',
          el('div.vs-col.bad.reveal',
            el('h4', 'Bugün · defter ve telefon'),
            el('ul', bad.map(([t, d]) => el('li',
              el('span.ic', { style: { color: 'var(--danger)' }, html: U.icon('x', 16) }),
              el('span', el('b', t), el('br'), el('span.t-sm', d)))))),
          el('div.vs-col.good.reveal',
            el('h4', 'Rezervle ile'),
            el('ul', good.map(([t, d]) => el('li',
              el('span.ic', { style: { color: 'var(--money)' }, html: U.icon('check', 16) }),
              el('span', el('b', t), el('br'), el('span.t-sm', d))))))
        )
      )
    );
  }

  /* ---------------- Özellikler ---------------- */
  function features() {
    const groups = [
      {
        cls: '', title: 'Her pakette',
        items: [
          ['Takvim ve çakışma engeli', 'Gün ve hafta görünümü, kaynak bazlı kolonlar (saha, kort, koltuk, kabin), sürükle-bırak taşıma. Sistem aynı kaynağı iki kez satmanıza izin vermez.'],
          ['Ciro takibi', 'Gün, hafta ve ay bazında ciro; hangi hizmet, hangi kaynak ve hangi kanal ne getirdi; doluluk oranı ve gelmeyen rezervasyonun TL karşılığı.'],
          ['Müşteri kaydı', 'Ziyaret geçmişi, harcama, sıklık ve notlar. En değerli müşteriler ve iki aydır uğramayan “kaybolan müşteriler” listesi.'],
          ['Otomatik hatırlatma', 'Randevudan önce SMS; tek tıkla teyit veya iptal. İptal edilen slot anında yeniden satışa açılır.'],
          ['Uygulamada listelenme', 'Tüketici uygulamasında konumuna göre bulunursunuz. Her pakette ücretsizdir; listelenmek için ayrıca ödeme yapmazsınız.'],
        ],
      },
      {
        cls: 'tier-pro', title: 'Pro pakette — ya da tek tek ek modül olarak',
        items: [
          ['Kapora ile no-show koruması', 'Seçtiğiniz hizmetlerde kart ile güvence alınır, tahsilat yapılmaz. Müşteri gelmezse tutarı kendi POS’unuzdan tahsil edersiniz — para bizden geçmez.'],
          ['Paket ve kredi satışı', '10 saat halı saha, 8 seans bakım gibi ön ödemeli paketleri satın; bakiye her kullanımda otomatik düşer. İşletmeye peşin nakit sağlar.'],
          ['QR ile giriş doğrulama', 'Rezervasyon QR’ı girişte okutulur; kimin geldiği, kimin gelmediği ciroya otomatik işlenir. Ciro verisinin doğruluk şartıdır.'],
          ['Kampanya ve boş slot yönetimi', 'Doluluğun düştüğü saatlere hedefli indirim duyurusu gönderin; boş kapasiteyi ciroya çevirin.'],
          ['Personel ve kaynak bazlı analiz', 'Hangi personel, hangi saha ve hangi saat ne kazandırdı — kırılımlı rapor ve saat bazlı yoğunluk haritası.'],
        ],
      },
      {
        cls: 'tier-biz', title: 'Business pakette',
        items: [
          ['Çok şube yönetimi', 'Şubeleri tek ekrandan yönetin, konsolide ciro alın, rol bazlı yetki verin (sahip, yönetici, resepsiyon).'],
          ['API ve entegrasyonlar', 'Ön muhasebe, POS ve web siteniz için REST API; webhook ile anlık rezervasyon akışı.'],
          ['Gelişmiş dışa aktarım', 'Excel/CSV çıktı ve muhasebecinize özel dönemsel rapor.'],
        ],
      },
    ];

    const group = (g) =>
      el('div.feat-group.' + (g.cls || 'tier-core'),
        el('h4', g.title),
        g.items.map(([t, d]) =>
          el('div.feat-item',
            el('span.mk', { html: U.icon('check', 15) }),
            el('div', el('h3', t), el('p', d)))));

    return el('section.sec', { id: 'nasil', style: { paddingTop: '10px' } },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'İşletme paneli'),
          el('h2', 'Ürünün kapsamı, işletmelerin talep sıralamasına göre belirlendi'),
          el('p', 'Online rezervasyon %100, otomatik hatırlatma %82, kapora %68, kampanya %62 talep gördü. Personel modülü bilinçli olarak küçük tutuldu — talebi yalnızca %38.')),
        el('div.feat-groups.reveal',
          el('div', group(groups[0])),
          el('div', group(groups[1]), el('div', { style: { height: '30px' } }), group(groups[2]))),
        el('div.feat-note.reveal',
          'Kapora, paket satışı, QR giriş, kampanya ve gelişmiş analiz Pro pakete dahildir; Başlangıç paketine tek tek ek modül olarak da eklenebilir. ',
          'Böylece yalnızca ihtiyacınız olan özelliğe ödersiniz.')
      )
    );
  }

  /* ---------------- ROI ---------------- */
  function roi() {
    return el('section.sec', { style: { paddingTop: '10px' } },
      el('div.wrapx',
        el('div.strip.reveal',
          el('div.strip-grid',
            el('div',
              el('div.sec-tag', 'Ürün kendi bedelini ödüyor'),
              el('h2', { style: { fontSize: '27px' } }, 'Aylık 150 rezervasyon alan bir işletme için hesap'),
              el('p.dim', { style: { marginTop: '12px', fontSize: '14.5px', lineHeight: '1.6' } },
                'Ortalama işlem tutarı 400 ₺ olan bir işletmenin aylık cirosu yaklaşık 60.000 ₺’dir. ',
                'Gelmeyen müşteri oranı %10 kabul edildiğinde tablo şöyle görünür:'),
              el('div.hint', { style: { marginTop: '14px' } },
                'Bu hesap saha satış konuşmasının omurgasıdır: fiyat itirazı, ürünün kendi bedelini ödediği noktada satışın merkezinden çıkar.')),
            el('div',
              el('div.calc-row', el('span', 'Aylık ciro'), el('span.v', '60.000 ₺')),
              el('div.calc-row', el('span', 'Gelmeyen müşteri (%10)'), el('span.v.minus', '−6.000 ₺')),
              el('div.calc-row', el('span', 'Hatırlatma ile azalma (~%40)'), el('span.v.plus', '+2.400 ₺')),
              el('div.calc-row', el('span', 'Boş slot kampanyasıyla kazanım'), el('span.v.plus', '+1.500 ₺')),
              el('div.calc-row.total', el('span', 'İşletmeye net katkı'), el('span.v.plus', '~3.900 ₺/ay')),
              el('div.calc-row', el('span.dim', 'Rezervle Pro bedeli'), el('span.v', '−2.500 ₺/ay')))
          ))
      )
    );
  }

  /* ---------------- İki taraflı ---------------- */
  function twoSided() {
    const step = (n, t, d) => el('div.feat-card',
      el('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--brand)', letterSpacing: '.06em', marginBottom: '7px' } }, n),
      el('h3', t), el('p', d));
    return el('section.sec', { style: { paddingTop: '10px' } },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Nasıl çalışır'),
          el('h2', 'Bir sistem satıyoruz: panel işletmede, uygulama tüketicide'),
          el('p', 'Gelirin tamamı işletme aboneliğinden gelir. Tüketici hiçbir ücret ödemez ve ödeme akışı Rezervle’nin hesabından geçmez.')),
        el('div.feat',
          step('01 · Kurulum', 'Kaynak, hizmet ve saatler tanımlanır', 'Sahalar, koltuklar, kabinler ve hizmet fiyatları girilir; mevcut müşteri listesi CSV ile aktarılır. Kurulum saha ekibimizce yapılır.'),
          step('02 · Rezervasyon', 'Tüm kanallar aynı takvime düşer', 'Uygulamadan, telefondan, WhatsApp’tan veya kapıdan gelen rezervasyonların hepsi tek ekranda toplanır.'),
          step('03 · Çakışma', 'Sistem ikinci satışı engeller', 'Aynı kaynak aynı anda iki kez satılamaz; personel çakışması uyarı olarak gösterilir.'),
          step('04 · Ciro', 'Rapor kendiliğinden oluşur', 'Her rezervasyon tutarıyla kaydedilir. Ön muhasebe yazılımlarının aksine elle veri girişi beklemez.'),
          step('05 · Geri kazanım', 'Boş slot ve kayıp müşteri', 'Boş kalan saatlere kampanya, iki aydır gelmeyen müşteriye geri kazanım mesajı.'),
          step('06 · Doğrulama', 'QR ile giriş', 'Rezervasyon QR’ı girişte okutulur; ciro verisinin doğruluğu böyle güvence altına alınır.')),
        el('div.row', { style: { justifyContent: 'center', marginTop: '30px', gap: '10px', flexWrap: 'wrap' } },
          el('a.btn.btn-primary.btn-lg', { href: '#/panel/takvim' }, 'Takvimi ve çakışma engelini deneyin'),
          el('a.btn.btn-ghost.btn-lg', { href: '#/panel/uygulama' }, 'Müşteri uygulamasını görün'))
      )
    );
  }

  /* ---------------- Paketler ---------------- */
  function pricing() {
    const biz = RZ.store.biz();
    const featureList = Object.keys(RZ.plans.FEATURES).filter((k) => !RZ.plans.FEATURES[k].core);
    return el('section.sec', { id: 'paketler' },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Paketler'),
          el('h2', 'Fiyat tahmin değil, saha verisi'),
          el('p', 'Ankette beyan edilen aylık ödeme isteği: medyan 2.000 ₺, çeyrekler 1.500–2.500 ₺, üst bant 3.500 ₺. Halı saha ve kort işletmelerinde medyan 2.500 ₺. Katılımcıların %81’i abonelik modelini tercih ediyor.')),
        el('div.plan-grid.reveal', RZ.plans.PLANS.map((p) =>
          el('div.plan-card' + (p.popular ? '.current' : ''),
            p.popular ? el('div.ribbon', 'Hedef paket') : null,
            el('div.pt', p.name),
            el('div.pp', tl(p.price), el('small', ' /ay')),
            el('div.hint', p.pitch),
            el('ul',
              featureList.map((k) => {
                const has = p.features.includes(k);
                return el('li' + (has ? '' : '.off'),
                  el('span.ck', { html: U.icon(has ? 'check' : 'x', 14) }),
                  RZ.plans.FEATURES[k].name);
              }),
              el('li', el('span.ck', { html: U.icon('check', 14) }),
                p.limits.resources === Infinity ? 'Sınırsız kaynak' : `${p.limits.resources} kaynağa kadar`),
              el('li', el('span.ck', { html: U.icon('check', 14) }), `Aylık ${U.fmtNum(p.limits.sms)} SMS`)),
            el('a.btn.btn-block.' + (p.popular ? 'btn-primary' : 'btn-ghost'), {
              href: '#/panel/paket',
              onclick: () => RZ.store.setPlan(p.id),
            }, `${p.name} ile dene`),
            el('div.hint', { style: { marginTop: '9px', textAlign: 'center' } }, p.target))
        )),
        el('div.card.card-pad.reveal', { style: { marginTop: '18px' } },
          el('div.row-b', { style: { flexWrap: 'wrap', gap: '14px' } },
            el('div', { style: { maxWidth: '620px' } },
              el('div', { style: { fontWeight: '650', marginBottom: '5px' } }, 'Paketi yükseltmek istemiyorsanız: ek modüller'),
              el('div.hint', { style: { lineHeight: '1.6' } },
                'Kapora, paket satışı, QR giriş, kampanya ve gelişmiş analiz modülleri Başlangıç paketine tek tek eklenebilir. ',
                'Böylece işletme yalnızca ihtiyacı olan özelliğe öder; büyüdükçe Pro’ya geçer.')),
            el('div.row', { style: { gap: '8px', flexWrap: 'wrap' } },
              Object.keys(RZ.plans.FEATURES).filter((k) => RZ.plans.FEATURES[k].addon).slice(0, 5).map((k) =>
                el('span.badge.badge-violet', `${RZ.plans.FEATURES[k].name.split(' ')[0]} · ${tl(RZ.plans.FEATURES[k].addon.price)}`)))))
      )
    );
  }

  /* ---------------- SSS ---------------- */
  function faq() {
    const qs = [
      ['Kapora alırken para Rezervle’den mi geçiyor?',
       'Hayır. Müşteri rezervasyon sırasında kart bilgisini verir ve tutar yalnızca güvenceye alınır; tahsilat yapılmaz. Müşteri gelmezse tutarı kendi sanal POS’unuzdan siz tahsil edersiniz. Böylece ödeme aracılığı ve ek vergi yükü doğmaz, cironuz eksilmez.'],
      ['Telefondan gelen rezervasyonlar da sisteme giriyor mu?',
       'Evet — ve bu bilinçli bir tasarım kararıdır. Uygulamadan gelmeyen rezervasyonlar da panele işlenir. Böylece ciro raporunuz işletmenizin tamamını gösterir, yalnızca bizden geleni değil. Ürün ilk günden, henüz tüketici trafiği yokken bile işinize yarar.'],
      ['Neden komisyon değil de abonelik?',
       'Ankette işletmelerin %81’i aylık aboneliği, yalnızca %6’sı işlem başı ücreti tercih ediyor. Ayrıca para uygulamadan geçtiğinde işletmenin eline geçen tutar azalıyor; sahada en sık duyduğumuz itiraz buydu. Abonelik hem pazarın istediği model hem de öngörülebilir bir gelir yapısı.'],
      ['Teknolojiye uzağız, kullanabilir miyiz?',
       'Katılımcıların %66’sı kendi teknoloji düzeyini “düşük” olarak tanımlıyor; ürün buna göre tasarlandı. Kurulum, mevcut defterinizden veri aktarımı ve personel eğitimi satış sürecinin parçasıdır. “Kolay kullanım” birinci ürün hedefimiz — ankette %86 ile en yüksek talep alan iki maddeden biri.'],
      ['Uygulamada listelenmek ne kadar müşteri getirir?',
       'İlk aylarda sınırlı. Bunu açıkça söylüyoruz: aboneliği tüketici trafiği vaadi üzerine satmıyoruz. Listelenme her pakette ücretsizdir; trafik oluştukça ek fayda olarak gelir. Ödediğiniz şey bugün elinizde olan panel: takvim, müşteri kaydı ve ciro görünürlüğü.'],
      ['Verilerimiz bize mi ait?',
       'Evet. Müşteri listeniz, rezervasyon geçmişiniz ve ciro kayıtlarınız işletmenize aittir; istediğiniz an CSV olarak dışa aktarabilirsiniz. Business pakette muhasebecinize özel dönemsel rapor çıktısı da bulunur.'],
      ['Sözleşme süresi var mı?',
       '30 gün ücretsiz deneme kart bilgisi istenmeden başlar. Sonrasında aylık aboneliktir, taahhüt yoktur. Pilot dönemde kurulum ücreti alınmaz.'],
    ];
    return el('section.sec', { id: 'sss' },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Sık sorulanlar'),
          el('h2', 'Sahada en çok sorulan yedi soru')),
        el('div.reveal', qs.map(([q, a]) => {
          const ans = el('div.faq-a', el('div.in', a));
          const item = el('div.faq-item',
            el('button.faq-q', {
              onclick: () => {
                const open = item.classList.toggle('open');
                ans.style.maxHeight = open ? ans.scrollHeight + 40 + 'px' : '0';
              },
            }, el('span', q), el('span.pm', { html: U.icon('plus', 18) })),
            ans);
          return item;
        }))
      )
    );
  }

  function finalCta() {
    return el('section.sec', { style: { paddingTop: '0' } },
      el('div.wrapx',
        el('div.cta-final.reveal',
          el('h2', 'Defteri değil, cironuzu satıyoruz'),
          el('p', 'Panelin tamamı bu sayfada canlı çalışıyor — örnek verilerle. Takvimde bir rezervasyonu sürükleyin, çakışmayı deneyin, ciro raporunu açın.'),
          el('div.row', { style: { justifyContent: 'center', gap: '10px', flexWrap: 'wrap' } },
            el('a.btn.btn-primary.btn-lg', { href: '#/panel' }, 'İşletme panelini aç'),
            el('a.btn.btn-ghost.btn-lg', { href: '#/panel/ciro' }, 'Ciro raporunu gör')))
      )
    );
  }

  function footer() {
    return el('footer.site-foot',
      el('div.wrapx',
        el('div.foot-grid',
          el('div',
            el('a.logo', { href: '#/' }, el('span.mark', { html: U.logoMark(31) }), 'Rezervle'),
            el('p.hint', { style: { marginTop: '11px', maxWidth: '300px', lineHeight: '1.6' } },
              'Küçük hizmet işletmelerinin rezervasyonunu, müşterisini ve cirosunu tek yerde toplayan sistem — ve o işletmeleri tüketiciyle buluşturan uygulama.')),
          el('div', el('h5', 'Ürün'),
            el('ul',
              el('li', el('a', { href: '#urun' }, 'İşletme paneli')),
              el('li', el('a', { href: '#/panel/uygulama' }, 'Müşteri uygulaması')),
              el('li', el('a', { href: '#paketler' }, 'Paketler')),
              el('li', el('a', { href: '#/panel/ciro' }, 'Ciro takibi')))),
          el('div', el('h5', 'Sektörler'),
            el('ul',
              el('li', 'Halı saha ve tenis kortu'),
              el('li', 'Güzellik salonu ve kuaför'),
              el('li', 'Restoran, kafe ve bar'),
              el('li', 'Spor tesisleri'))),
          el('div', el('h5', 'İletişim'),
            el('ul',
              el('li', 'Ankara, Türkiye'),
              el('li', 'merhaba@rezervle.com'),
              el('li', '0850 000 00 00')))),
        el('div.foot-note',
          'Rezervle · Bu sayfa ve panel bir ürün demosudur; veriler örnektir ve tarayıcınızda saklanır. ',
          'Anket verileri: 35 işletme, Ankara, Ağustos 2026. Finansal örnekler model tabanlı tahmindir, taahhüt niteliği taşımaz.')
      )
    );
  }

  /* ---------------- Görünüme girince animasyon ---------------- */
  function reveal(root) {
    const items = U.$$('.reveal', root);
    const showAll = () => items.forEach((i) => i.classList.add('in'));
    // Yazdirma / PDF cikti: gorunmemis bolumler bos sayfa olarak cikmasin
    window.addEventListener('beforeprint', showAll);
    if (!('IntersectionObserver' in window)) { showAll(); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -60px 0px' });
    items.forEach((i) => io.observe(i));
    // Emniyet: gozlemci hic tetiklenmediyse (bazi gomulu/ekran goruntusu ortamlari)
    // icerigi acik birakmaktansa goster.
    setTimeout(() => { if (!items.some((i) => i.classList.contains('in'))) showAll(); }, 2500);
  }
})(window.RZ);
