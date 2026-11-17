// Dados de exemplo (fictícios) e interações comuns às 11 direções visuais do NESS.
window.NESS = (() => {
  const kpis = [
    { label: 'Pedidos em andamento', v: 18, note: '+4 desde ontem', icon: 'package' },
    { label: 'Notas autorizadas', v: 126, note: 'últimos 7 dias', icon: 'badge-check' },
    { label: 'Emissões parciais', v: 2, note: 'pedem sua ação', icon: 'split' },
    { label: 'Pendências fiscais', v: 1, note: 'regra aguardando contador', icon: 'shield-alert' },
  ];
  const orders = [
    { ref: 'PED-2418', cli: 'Marina Costa', pac: 'Ensaio gestante + álbum 30×30', dest: 'Campinas/SP', val: 'R$ 2.480,00', nfse: 'ok', nfe: 'ok' },
    { ref: 'PED-2417', cli: 'Studio Lume Eventos', pac: 'Casamento + álbum duplo', dest: 'Belo Horizonte/MG', val: 'R$ 6.900,00', nfse: 'ok', nfe: 'wait' },
    { ref: 'PED-2416', cli: 'Rafael Nogueira', pac: 'Book 15 anos + álbum 20×30', dest: 'Santos/SP', val: 'R$ 1.750,00', nfse: 'ok', nfe: 'err' },
    { ref: 'PED-2415', cli: 'Clínica Sorriso Pleno', pac: 'Fotos institucionais + fotolivro', dest: 'Curitiba/PR', val: 'R$ 3.200,00', nfse: 'block', nfe: 'block' },
    { ref: 'PED-2414', cli: 'Ana e Pedro Lima', pac: 'Newborn + caixa de fotos', dest: 'São Paulo/SP', val: 'R$ 1.380,00', nfse: 'draft', nfe: 'draft' },
  ];
  const status = {
    ok: ['Autorizada', 'check-circle-2'],
    wait: ['Transmitindo', 'loader'],
    err: ['Rejeitada', 'alert-triangle'],
    block: ['Sem regra fiscal', 'lock'],
    draft: ['Rascunho', 'pencil-line'],
  };
  const activity = [
    { t: '09:42', icon: 'check-circle-2', text: 'NF-e 1.204 autorizada', sub: 'PED-2418 · DANFE pronto para envio' },
    { t: '09:41', icon: 'check-circle-2', text: 'NFS-e 883 autorizada', sub: 'PED-2418 · Marina Costa' },
    { t: '09:15', icon: 'alert-triangle', text: 'NF-e rejeitada pela SEFAZ', sub: 'PED-2416 · CEP do destinatário divergente' },
    { t: '08:57', icon: 'shield-alert', text: 'Cenário PR sem regra aprovada', sub: 'PED-2415 · encaminhado ao contador' },
  ];
  const nav = [
    ['Visão geral', 'layout-dashboard'], ['Pedidos', 'shopping-bag'], ['Emissões', 'send'],
    ['Documentos', 'files'], ['Rastreio', 'truck', '22-ness-rastreio.html'], ['Configuração fiscal', 'scale'], ['Auditoria', 'history'],
  ];

  const badge = s => `<span class="st st-${s}"><i data-lucide="${status[s][1]}"></i>${status[s][0]}</span>`;
  const logo = (size = 28) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="4" width="30" height="42" rx="5" fill="var(--logo-sheet, transparent)" stroke="currentColor" stroke-width="3.5"/><rect x="28" y="18" width="30" height="42" rx="5" fill="var(--logo-sheet, transparent)" stroke="currentColor" stroke-width="3.5"/><path d="M16 38V14L48 50V26" fill="none" stroke="var(--logo-accent, #E8A33D)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const table = () => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Cliente</th><th>Pacote</th><th>Entrega</th><th>NFS-e</th><th>NF-e</th><th class="num">Valor</th></tr></thead><tbody>${
    orders.map(o => `<tr tabindex="0"><td class="ref">${o.ref}</td><td>${o.cli}</td><td class="muted">${o.pac}</td><td class="muted">${o.dest}</td><td>${badge(o.nfse)}</td><td>${badge(o.nfe)}</td><td class="num">${o.val}</td></tr>`).join('')
  }</tbody></table></div>`;

  function render(opts = {}) {
    const q = (s, f) => document.querySelectorAll(s).forEach(f);
    q('[data-logo]', el => el.innerHTML = logo(+el.dataset.logo || 28));
    q('[data-nav]', el => el.innerHTML = nav.map(([n, i, h], k) => `<a href="${h || '#'}" class="nav-item${k === 0 ? ' active' : ''}"${k === 0 ? ' aria-current="page"' : ''}><i data-lucide="${i}"></i><span>${n}</span></a>`).join(''));
    q('[data-kpis]', el => el.innerHTML = kpis.map((k, i) => (opts.kpi || defKpi)(k, i)).join(''));
    q('[data-table]', el => el.innerHTML = table());
    q('[data-activity]', el => el.innerHTML = activity.map(a => `<li class="act"><span class="act-ic"><i data-lucide="${a.icon}"></i></span><div><b>${a.text}</b><small>${a.sub}</small></div><time>${a.t}</time></li>`).join(''));
    if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': opts.stroke || 1.75 } });
    countUp(); pointer(); reveal(); themeToggle();
  }
  const defKpi = k => `<article class="kpi" data-glow><span class="kpi-ic"><i data-lucide="${k.icon}"></i></span><p class="kpi-label">${k.label}</p><p class="kpi-v" data-count="${k.v}">${k.v}</p><p class="kpi-note">${k.note}</p></article>`;

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp() {
    if (still()) return;
    document.querySelectorAll('[data-count]').forEach(el => {
      const end = +el.dataset.count, t0 = performance.now(), d = 1100;
      const step = t => { const p = Math.min(1, (t - t0) / d); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  // Brilho que segue o cursor ([data-glow]) e inclinação 3D ([data-tilt]).
  function pointer() {
    document.querySelectorAll('[data-glow],[data-tilt]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
        if (el.hasAttribute('data-tilt') && !still()) el.style.transform = `perspective(800px) rotateX(${(0.5 - y / r.height) * 8}deg) rotateY(${(x / r.width - 0.5) * 10}deg) translateY(-4px)`;
      });
      el.addEventListener('pointerleave', () => { if (el.hasAttribute('data-tilt')) el.style.transform = ''; });
    });
  }
  // Entrada escalonada: o conteúdo já é visível em repouso; a animação só acrescenta movimento.
  function reveal() {
    document.querySelectorAll('[data-reveal]').forEach((el, i) => el.style.setProperty('--i', i));
    document.documentElement.classList.add('ready');
  }
  function themeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
      const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      r.dataset.theme = dark ? 'light' : 'dark';
    }));
  }
  return { render, logo, badge, orders, kpis };
})();
