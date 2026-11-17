import { loadTelcoDashboardData, type TelcoDashboardData } from './telcoData';
import {
  CAMPAIGN_OFFERS,
  generateSklearnPipelineScript,
  trainTelcoMlModels,
  type CampaignOfferKey,
  type ScoredCustomer,
  type TelcoMlResult,
} from './telcoMl';
import {
  ROSENBAUM_CITATIONS,
  runFiberPsmStudy,
  type PsmSpecKey,
  type PsmStudyResult,
} from './telcoPsm';
import {
  buildReportContent,
  generateExecutivePdfBytes,
  type ReportSectionsContent,
} from './telcoReport';

interface TooltipData {
  cat?: string;
  val?: string;
  sub?: string;
}

interface CaptionCol {
  label: string;
  num: boolean;
}

interface CaptionOpts {
  fig: string;
  caption: string;
  source?: string;
  cols: CaptionCol[];
  rows?: string[][];
  getRows?: () => string[][];
}

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (val: number, dec = 0): string =>
  new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(val);

function scaleLinear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | null | undefined> = {},
  children: Array<Node | string | null | undefined> | Node | string = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k === 'class') node.className = String(v);
    else node.setAttribute(k, String(v));
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (child !== null && child !== undefined) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | null | undefined> = {},
  children: Array<Node | string | null | undefined> | Node | string = []
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (child !== null && child !== undefined) {
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

function renderFigureCaption(targetId: string, opts: CaptionOpts) {
  const host = document.getElementById(targetId);
  if (!host) return { refreshTable: () => {} };
  const tblId = `${targetId}-tbl`;
  const btn = el('button', {
    type: 'button',
    class: 'fig-table-btn',
    'aria-expanded': 'false',
    'aria-controls': tblId,
    text: 'Show data table ↓',
  });
  const wrap = el('div', { class: 'fig-table-wrap', id: tblId, hidden: '' });

  function buildTable() {
    wrap.innerHTML = '';
    const rows = typeof opts.getRows === 'function' ? opts.getRows() : opts.rows || [];
    const thead = el(
      'thead',
      {},
      el(
        'tr',
        {},
        opts.cols.map((c) => el('th', { class: c.num ? 'is-num' : '', scope: 'col', text: c.label }))
      )
    );
    const tbody = el(
      'tbody',
      {},
      rows.map((r) =>
        el(
          'tr',
          {},
          r.map((cell, idx) =>
            el('td', { class: opts.cols[idx] && opts.cols[idx].num ? 'is-num' : '', text: String(cell) })
          )
        )
      )
    );
    wrap.appendChild(el('table', { class: 'data-table' }, [thead, tbody]));
  }

  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    if (!open) buildTable();
    btn.setAttribute('aria-expanded', String(!open));
    btn.textContent = open ? 'Show data table ↓' : 'Hide data table ↑';
    wrap.hidden = open;
  });

  const cap = el('div', { class: 'fig-caption' }, [
    el('div', { class: 'fig-meta' }, [
      el('span', { class: 'micro-upper', text: opts.fig }),
      el('span', { class: 'fig-text', text: opts.caption }),
      el('span', { class: 'mono-meta', text: opts.source || 'Source: Telco-Customer-Churn.csv, n = 7,043' }),
    ]),
    btn,
  ]);
  host.innerHTML = '';
  host.appendChild(cap);
  host.appendChild(wrap);
  return {
    refreshTable: () => {
      if (btn.getAttribute('aria-expanded') === 'true') buildTable();
    },
  };
}

function initTooltip() {
  const tt = document.getElementById('tt') as HTMLElement;
  const ttCat = document.getElementById('ttCat') as HTMLElement;
  const ttVal = document.getElementById('ttVal') as HTMLElement;
  const ttSub = document.getElementById('ttSub') as HTMLElement;
  const live = document.getElementById('liveRegion') as HTMLElement;
  let activeOwner: Element | null = null;

  function clampPosition(x: number, y: number) {
    const pad = 12;
    const rect = tt.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - pad;
    const maxY = window.innerHeight - rect.height - pad;
    return {
      x: Math.max(pad, Math.min(x, maxX)),
      y: Math.max(48, Math.min(y, maxY)),
    };
  }

  function show(owner: Element | null, data: TooltipData, pointerEvent?: PointerEvent) {
    if (activeOwner && activeOwner !== owner) {
      activeOwner.removeAttribute('aria-describedby');
    }
    activeOwner = owner;
    ttCat.textContent = data.cat || '';
    ttVal.textContent = data.val || '';
    ttSub.textContent = data.sub || '';
    tt.hidden = false;
    tt.classList.add('is-visible');
    if (owner) owner.setAttribute('aria-describedby', 'tt');
    live.textContent = [data.cat, data.val, data.sub].filter(Boolean).join('. ');

    let x: number;
    let y: number;
    if (pointerEvent && typeof pointerEvent.clientX === 'number') {
      x = pointerEvent.clientX + 16;
      y = pointerEvent.clientY + 16;
      const rect = tt.getBoundingClientRect();
      if (x + rect.width > window.innerWidth - 12) {
        x = pointerEvent.clientX - rect.width - 16;
      }
      if (y + rect.height > window.innerHeight - 12) {
        y = pointerEvent.clientY - rect.height - 16;
      }
    } else if (owner) {
      const or = owner.getBoundingClientRect();
      const tr = tt.getBoundingClientRect();
      x = or.left + or.width / 2 - tr.width / 2;
      y = or.top - tr.height - 10;
      if (y < 48) y = or.bottom + 10;
    } else {
      x = 16;
      y = 56;
    }
    const pos = clampPosition(x, y);
    tt.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)`;
  }

  function hide() {
    if (activeOwner) {
      activeOwner.removeAttribute('aria-describedby');
      activeOwner = null;
    }
    tt.classList.remove('is-visible');
    tt.hidden = true;
  }

  window.addEventListener('scroll', hide, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as Node | null;
    if (activeOwner && target && !activeOwner.contains(target) && !tt.contains(target)) {
      hide();
    }
  });

  return { show, hide };
}

function countUp(node: Element) {
  const target = parseFloat(node.getAttribute('data-countup') || '');
  const decimals = parseInt(node.getAttribute('data-decimals') || '0', 10);
  if (Number.isNaN(target)) return;
  if (REDUCED_MOTION) {
    node.textContent = fmt(target, decimals);
    return;
  }
  const dur = 1200;
  const start = performance.now();
  function tick(now: number) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = fmt(target * eased, decimals);
    if (t < 1) requestAnimationFrame(tick);
    else node.textContent = fmt(target, decimals);
  }
  requestAnimationFrame(tick);
}

function initPager(sectionsMeta: TelcoDashboardData['sections']) {
  const links = Array.from(document.querySelectorAll('.pager-link'));
  const circle = document.getElementById('pagerCircle') as HTMLElement | null;
  const folioL = document.getElementById('bandFolioLeft') as HTMLElement;
  const folioR = document.getElementById('bandFolioRight') as HTMLElement;
  const bandTitle = document.getElementById('bandTitle') as HTMLElement;
  const mobileNum = document.getElementById('pagerMobileNum') as HTMLElement;
  const toggleBtn = document.getElementById('pagerToggle') as HTMLElement;
  const dropdown = document.getElementById('pagerMenu') as HTMLElement;
  const dropdownList = document.getElementById('pagerDropdownList') as HTMLElement;
  const prevBtn = document.getElementById('pagerPrev') as HTMLElement;
  const nextBtn = document.getElementById('pagerNext') as HTMLElement;
  const sections = sectionsMeta.map((s) => document.getElementById(s.id)).filter((n): n is HTMLElement => Boolean(n));
  let activeIdx = 0;

  dropdownList.innerHTML = '';
  sectionsMeta.forEach((s, idx) => {
    const a = el('a', { href: `#${s.id}`, 'data-msec': idx }, [
      el('span', { class: 'num', text: s.num }),
      el('span', { text: s.short }),
    ]);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      closeDropdown();
      jumpTo(idx);
    });
    dropdownList.appendChild(el('li', {}, a));
  });

  function updateCircle(idx: number) {
    const target = links[idx];
    if (!target || !circle) return;
    const x = idx * 24 + 2;
    circle.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  function setActive(idx: number, updateHash = true) {
    if (idx < 0 || idx >= sectionsMeta.length) return;
    const changed = idx !== activeIdx;
    activeIdx = idx;
    const sec = sectionsMeta[idx];
    links.forEach((a, i) => {
      if (i === idx) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    dropdownList.querySelectorAll('a').forEach((a, i) => {
      if (i === idx) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    updateCircle(idx);
    folioL.textContent = sec.folioL;
    folioR.textContent = sec.folioR;
    mobileNum.textContent = sec.num;
    if (changed) {
      if (REDUCED_MOTION) {
        bandTitle.textContent = sec.short;
      } else {
        bandTitle.classList.add('is-fading');
        window.setTimeout(() => {
          bandTitle.textContent = sec.short;
          bandTitle.classList.remove('is-fading');
        }, 90);
      }
    }
    if (updateHash && window.location.hash !== `#${sec.id}`) {
      try {
        history.replaceState(null, '', `#${sec.id}`);
      } catch (_) {}
    }
  }

  function jumpTo(idx: number) {
    if (idx < 0 || idx >= sections.length) return;
    const secEl = sections[idx];
    const heading = secEl.querySelector('h1, h2') as HTMLElement | null;
    secEl.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
    if (heading) {
      window.setTimeout(() => {
        heading.focus({ preventScroll: true });
      }, REDUCED_MOTION ? 0 : 350);
    }
  }

  function openDropdown() {
    dropdown.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown(returnFocus = false) {
    if (dropdown.hidden) return;
    dropdown.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggleBtn.focus();
  }

  links.forEach((a, idx) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      jumpTo(idx);
    });
  });

  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) closeDropdown();
    else openDropdown();
  });
  prevBtn.addEventListener('click', () => jumpTo(Math.max(0, activeIdx - 1)));
  nextBtn.addEventListener('click', () => jumpTo(Math.min(sections.length - 1, activeIdx + 1)));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute('data-sec-index') || '', 10);
          if (!Number.isNaN(idx)) setActive(idx, true);
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));

  setActive(0, false);

  return {
    getActive: () => activeIdx,
    jumpTo,
    closeDropdown,
    isDropdownOpen: () => !dropdown.hidden,
  };
}

function hydrateHeroKpis(DATA: TelcoDashboardData) {
  const k = DATA.kpis;
  const setAttr = (id: string, val: string, dec: number) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.setAttribute('data-countup', val);
    node.setAttribute('data-decimals', String(dec));
    node.textContent = fmt(parseFloat(val), dec);
  };
  setAttr('kpiTotalNum', String(k.totalCustomers), 0);
  setAttr('kpiChurnRateNum', k.churnRate.toFixed(1), 1);
  setAttr('kpiMrrNum', k.mrrAtRiskK.toFixed(1), 1);
  setAttr('kpiTenureNum', k.avgTenureChurn.toFixed(1), 1);

  const churnCap = document.getElementById('kpiChurnCap');
  if (churnCap) churnCap.textContent = `overall subscriber churn rate (${fmt(k.churnedCount)} churned vs ${fmt(k.retainedCount)} retained)`;

  const mrrCap = document.getElementById('kpiMrrCap');
  if (mrrCap) mrrCap.textContent = `MRR lost to churn (${fmt(k.mrrAtRiskPct, 1)}% of $${fmt(k.totalMrrK, 1)}k MRR · $${fmt(k.avgMrrChurn, 1)} vs $${fmt(k.avgMrrRetained, 1)} avg)`;

  const tenCap = document.getElementById('kpiTenureCap');
  if (tenCap) tenCap.textContent = `mean tenure of churned accounts (retained average: ${fmt(k.avgTenureRetained, 1)} mo)`;

  const tenDelta = document.getElementById('kpiTenureDelta');
  if (tenDelta) tenDelta.textContent = `↓ ${fmt(k.tenureGap, 1)} mo`;

  const lede = document.getElementById('heroLede');
  if (lede) {
    lede.textContent = `Across ${fmt(k.totalCustomers)} customer accounts in the Telco Customer Churn dataset, ${fmt(k.churnRate, 1)}% churned—putting $${fmt(k.mrrAtRiskK, 1)}k (${fmt(k.mrrAtRiskPct, 1)}% of MRR) at risk. Toggle Volume vs Value or group by churn, contract, or internet tier opposite.`;
  }

  const evM2m = document.getElementById('evM2mPct');
  if (evM2m) evM2m.textContent = `${fmt(k.churnedM2mPct, 1)} %`;
  const evSec = document.getElementById('evNoSecPct');
  if (evSec) evSec.textContent = `${fmt(k.churnedNoSecPct, 1)} %`;
  const evEcheck = document.getElementById('evEcheckPct');
  if (evEcheck) evEcheck.textContent = `${fmt(k.churnedEcheckPct, 1)} %`;
}

function renderMatrix(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart01') as HTMLElement;
  const basisSub = document.getElementById('matrixBasisSub') as HTMLElement | null;
  type MatrixMode = 'all' | 'churn' | 'contract' | 'internet';
  type MatrixBasis = 'volume' | 'value';
  let mode: MatrixMode = 'all';
  let basis: MatrixBasis = 'volume';
  let highlightContract: string | null = null;
  const total = DATA.heroMatrix.total;
  const rawTotal = DATA.heroMatrix.rawTotal;
  const totalMrr = DATA.heroMatrix.totalMrr;

  const getGroupsForMode = (m: Exclude<MatrixMode, 'all'>) => {
    if (basis === 'volume') return DATA.heroMatrix[m];
    if (m === 'churn') return DATA.heroMatrix.churnValue;
    if (m === 'contract') return DATA.heroMatrix.contractValue;
    return DATA.heroMatrix.internetValue;
  };

  const svgEl = svg('svg', {
    class: 'matrix-svg',
    role: 'group',
    'aria-labelledby': 'matrixTitle matrixDesc',
  });
  svgEl.appendChild(svg('title', { id: 'matrixTitle', text: `Unit matrix chart, ${total} squares representing ${fmt(rawTotal)} accounts` }));
  svgEl.appendChild(svg('desc', { id: 'matrixDesc', text: 'Interactive unit matrix chart of telecom accounts, switchable between account volume and monthly recurring revenue value.' }));

  const labelsLayer = svg('g', { class: 'matrix-labels' });
  const squaresLayer = svg('g', { class: 'matrix-squares' });
  const hitLayer = svg('g', { class: 'matrix-hits' });
  svgEl.appendChild(labelsLayer);
  svgEl.appendChild(squaresLayer);
  svgEl.appendChild(hitLayer);
  host.innerHTML = '';
  host.appendChild(svgEl);

  const rects: SVGRectElement[] = [];
  for (let i = 0; i < total; i++) {
    const r = svg('rect', { class: 'matrix-sq', width: 8, height: 8, 'aria-hidden': 'true' });
    squaresLayer.appendChild(r);
    rects.push(r);
  }

  const capApi = renderFigureCaption('cap01', {
    fig: 'FIG. 01',
    caption: `Unit matrix comparing account Volume (${fmt(rawTotal)} accounts) vs Value ($${fmt(totalMrr / 1000, 1)}k MRR) across ${total} squares.`,
    cols: [
      { label: 'Category', num: false },
      { label: 'Volume (n) / MRR ($)', num: true },
      { label: 'Share (%)', num: true },
    ],
    getRows: () => {
      if (mode === 'all') {
        return basis === 'volume'
          ? [['All telecom accounts', `${fmt(rawTotal)} accounts`, '100.0 %']]
          : [['Total portfolio MRR', `$${fmt(totalMrr)} /mo`, '100.0 %']];
      }
      const den = basis === 'volume' ? rawTotal : totalMrr;
      return getGroupsForMode(mode).map((g) => [
        g.name,
        basis === 'volume' ? `${fmt(g.rawCount)} accts` : `$${fmt(g.rawCount)} /mo`,
        `${fmt((g.rawCount / den) * 100, 1)} %`,
      ]);
    },
  });

  function layout() {
    const w = Math.max(260, host.clientWidth || 500);
    const gap = w < 440 ? 3 : 4;
    const allCols = w >= 520 ? 32 : w >= 380 ? 26 : 22;
    const sq = (w - (allCols - 1) * gap) / allCols;
    const step = sq + gap;

    labelsLayer.innerHTML = '';
    hitLayer.innerHTML = '';

    if (mode === 'all') {
      const cols = allCols;
      const rows = Math.ceil(total / cols);
      const h = rows * step - gap;
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const maxDiag = cols + rows - 2 || 1;
      for (let i = 0; i < total; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const node = rects[i];
        node.setAttribute('width', sq.toFixed(2));
        node.setAttribute('height', sq.toFixed(2));
        node.setAttribute('fill', 'var(--ink-3)');
        node.style.transform = `translate3d(${(c * step).toFixed(2)}px, ${(r * step).toFixed(2)}px, 0)`;
        node.style.transitionDelay = REDUCED_MOTION ? '0ms' : `${Math.round(((c + r) / maxDiag) * 900)}ms`;
      }
      const hit = svg('rect', {
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: 'transparent',
        tabindex: 0,
        role: 'img',
        class: 'matrix-group-hit',
        'aria-label': `All customer accounts: ${fmt(rawTotal)} subscribers`,
      });
      const info =
        basis === 'volume'
          ? { cat: 'Telco Portfolio (Volume)', val: `${fmt(rawTotal)} accounts`, sub: `${total} squares · 1 sq ≈ ${DATA.heroMatrix.scaleUnit} accounts` }
          : { cat: 'Telco Portfolio (MRR Value)', val: `$${fmt(totalMrr)} /mo`, sub: `${total} squares · 1 sq ≈ $${fmt(DATA.heroMatrix.mrrScaleUnit)} MRR` };
      hit.addEventListener('pointerenter', (e) => tt.show(hit, info, e));
      hit.addEventListener('pointermove', (e) => tt.show(hit, info, e));
      hit.addEventListener('pointerleave', tt.hide);
      hit.addEventListener('focus', () => tt.show(hit, info));
      hit.addEventListener('blur', tt.hide);
      hitLayer.appendChild(hit);
      return;
    }

    const groups = getGroupsForMode(mode);
    const den = basis === 'volume' ? rawTotal : totalMrr;
    const twoCol = w >= 520;
    const colGap = 24;
    const blockW = twoCol ? (w - colGap) / 2 : w;
    const blockCols = Math.max(10, Math.floor((blockW + gap) / step));
    const bSq = (blockW - (blockCols - 1) * gap) / blockCols;
    const bStep = bSq + gap;

    let idxCursor = 0;
    let rowY = 0;
    const rowStride = twoCol ? 2 : 1;

    for (let rowIdx = 0; rowIdx < groups.length; rowIdx += rowStride) {
      const rowGroups = groups.slice(rowIdx, rowIdx + rowStride);
      let maxRowH = 0;

      rowGroups.forEach((grp, colPos) => {
        const gIdx = rowIdx + colPos;
        const color = grp.name === 'Churned' ? 'var(--vermilion)' : DATA.palette[gIdx % DATA.palette.length];
        const baseX = twoCol ? colPos * (blockW + colGap) : 0;
        const share = fmt((grp.rawCount / den) * 100, 1);
        const valText = basis === 'volume' ? fmt(grp.rawCount) : `$${fmt(grp.rawCount / 1000, 1)}k`;

        const lbl = svg('text', {
          x: baseX,
          y: rowY + 13,
          class: 'svg-label',
          text: `${grp.name} · ${valText} (${share}%)`,
        });
        labelsLayer.appendChild(lbl);

        const gridTop = rowY + 22;
        const rows = Math.ceil(grp.count / blockCols);
        const blockH = rows * bStep - gap;
        if (blockH > maxRowH) maxRowH = blockH;
        const isDim = highlightContract && mode === 'contract' && highlightContract !== grp.name;

        for (let j = 0; j < grp.count; j++) {
          const node = rects[idxCursor + j];
          if (!node) continue;
          const c = j % blockCols;
          const r = Math.floor(j / blockCols);
          node.setAttribute('width', bSq.toFixed(2));
          node.setAttribute('height', bSq.toFixed(2));
          node.setAttribute('fill', isDim ? 'var(--neutral-data)' : color);
          node.style.transform = `translate3d(${(baseX + c * bStep).toFixed(2)}px, ${(gridTop + r * bStep).toFixed(2)}px, 0)`;
          const delay = REDUCED_MOTION ? 0 : Math.min(600, Math.round(((idxCursor + j) / total) * 540));
          node.style.transitionDelay = `${delay}ms`;
        }

        const hit = svg('rect', {
          x: baseX,
          y: gridTop,
          width: blockW,
          height: blockH,
          fill: 'transparent',
          tabindex: 0,
          role: 'img',
          class: 'matrix-group-hit',
          'aria-label': `${grp.name}: ${valText}, ${share} percent`,
        });
        const modeTitle = mode === 'churn' ? 'Churn Outcome' : mode === 'contract' ? 'Contract Tier' : 'Internet Service';
        const info =
          basis === 'volume'
            ? { cat: `${modeTitle} · Volume`, val: `${grp.name}: ${fmt(grp.rawCount)} accts`, sub: `${share} % of ${fmt(rawTotal)} accounts` }
            : { cat: `${modeTitle} · MRR Value`, val: `${grp.name}: $${fmt(grp.rawCount)}/mo`, sub: `${share} % of $${fmt(totalMrr / 1000, 1)}k total MRR` };
        hit.addEventListener('pointerenter', (e) => tt.show(hit, info, e));
        hit.addEventListener('pointermove', (e) => tt.show(hit, info, e));
        hit.addEventListener('pointerleave', tt.hide);
        hit.addEventListener('focus', () => tt.show(hit, info));
        hit.addEventListener('blur', tt.hide);
        hitLayer.appendChild(hit);

        idxCursor += grp.count;
      });

      rowY += 22 + maxRowH + 22;
    }

    svgEl.setAttribute('viewBox', `0 0 ${w} ${Math.max(100, rowY - 14)}`);
  }

  document.querySelectorAll('[data-matrix-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = (btn.getAttribute('data-matrix-mode') || 'all') as MatrixMode;
      document.querySelectorAll('[data-matrix-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layout();
      capApi.refreshTable();
    });
  });

  document.querySelectorAll('[data-matrix-basis]').forEach((btn) => {
    btn.addEventListener('click', () => {
      basis = (btn.getAttribute('data-matrix-basis') || 'volume') as MatrixBasis;
      document.querySelectorAll('[data-matrix-basis]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      if (basisSub) {
        basisSub.textContent =
          basis === 'volume'
            ? `Unit matrix chart, 1 square ≈ ${DATA.heroMatrix.scaleUnit} customer accounts`
            : `Unit matrix chart, 1 square ≈ $${fmt(DATA.heroMatrix.mrrScaleUnit)} monthly MRR`;
      }
      if (basis === 'value' && mode === 'all') {
        mode = 'churn';
        document.querySelectorAll('[data-matrix-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-matrix-mode') === 'churn')));
      }
      layout();
      capApi.refreshTable();
    });
  });

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();

  return {
    reveal: () => svgEl.classList.add('is-revealed'),
    highlightContract: (contractName: string | null) => {
      highlightContract = contractName;
      if (mode === 'contract') layout();
    },
  };
}

function renderStackBar(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart02a') as HTMLElement;
  const items = DATA.contractStack;
  const svgEl = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'stackTitle stackDesc',
  });
  svgEl.appendChild(svg('title', { id: 'stackTitle', text: 'Portfolio composition by contract and churn outcome' }));
  svgEl.appendChild(svg('desc', { id: 'stackDesc', text: items.map((i) => `${i.name} ${i.value}%`).join(', ') }));
  const gBars = svg('g');
  svgEl.appendChild(gBars);
  const legendDiv = el('div', { class: 'hm-ramp', style: 'margin-top:var(--s-3);', hidden: '' });
  host.innerHTML = '';
  host.appendChild(svgEl);
  host.appendChild(legendDiv);

  renderFigureCaption('cap02a', {
    fig: 'FIG. 02A',
    caption: 'Proportional breakdown across 7,043 accounts splitting Month-to-month exits vs retained term contracts.',
    cols: [
      { label: 'Segment', num: false },
      { label: 'Accounts (n)', num: true },
      { label: 'Share (%)', num: true },
    ],
    rows: items.map((i) => [i.name, fmt(i.rawCount), `${fmt(i.value, 1)} %`]),
  });

  let revealed = REDUCED_MOTION;

  function layout() {
    const w = Math.max(260, host.clientWidth || 500);
    const compact = w < 440;
    const h = compact ? 48 : 112;
    const barTop = compact ? 0 : 52;
    const barH = 48;
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gBars.innerHTML = '';

    const innerG = svg('g', {
      style: `transform-origin:0 ${barTop + barH / 2}px;transform:scaleX(${revealed ? 1 : 0});transition:transform var(--d-3) var(--ease-out);`,
    });

    let x = 0;
    items.forEach((seg, idx) => {
      const segW = (seg.value / 100) * w;
      const r = svg('rect', {
        x,
        y: barTop,
        width: segW,
        height: barH,
        fill: seg.color,
        tabindex: 0,
        role: 'img',
        'aria-label': `${seg.name}: ${seg.value} percent (${fmt(seg.rawCount)} accounts)`,
        style: 'cursor:pointer;',
      });
      const info = { cat: seg.name, val: `${fmt(seg.value, 1)} %`, sub: `${fmt(seg.rawCount)} of ${fmt(DATA.kpis.totalCustomers)} accounts` };
      r.addEventListener('pointerenter', (e) => tt.show(r, info, e));
      r.addEventListener('pointermove', (e) => tt.show(r, info, e));
      r.addEventListener('pointerleave', tt.hide);
      r.addEventListener('focus', () => tt.show(r, info));
      r.addEventListener('blur', tt.hide);
      innerG.appendChild(r);

      if (segW >= (compact ? 36 : 52)) {
        const tIn = svg('text', {
          x: x + (compact ? 5 : 8),
          y: barTop + 30,
          style: `fill:${seg.text};font-size:${compact ? 11.5 : 13}px;font-weight:500;pointer-events:none;`,
          text: compact ? `${seg.value}%` : `${seg.value} %`,
        });
        innerG.appendChild(tIn);
      }

      if (!compact) {
        const cx = x + segW / 2;
        const stagger = idx % 2 === 1 ? 14 : 28;
        const anchor = idx === items.length - 1 ? 'end' : idx === 0 ? 'start' : 'middle';
        const lx = idx === 0 ? x : idx === items.length - 1 ? Math.min(w, x + segW) : cx;
        innerG.appendChild(svg('line', { x1: cx, y1: barTop, x2: cx, y2: stagger + 4, stroke: 'var(--ink-3)', 'stroke-width': 1 }));
        innerG.appendChild(svg('text', { x: lx, y: stagger, 'text-anchor': anchor, class: 'svg-micro', text: seg.name }));
      }

      x += segW;
    });

    gBars.appendChild(innerG);

    if (compact) {
      legendDiv.hidden = false;
      legendDiv.innerHTML = '';
      items.forEach((seg) => {
        legendDiv.appendChild(
          el('span', { class: 'hm-ramp-item' }, [
            el('span', { class: 'hm-ramp-box', style: `background:${seg.color};width:10px;height:10px;` }),
            document.createTextNode(`${seg.name} ${seg.value}%`),
          ])
        );
      });
    } else {
      legendDiv.hidden = true;
      legendDiv.innerHTML = '';
    }
  }

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();

  return {
    reveal: () => {
      revealed = true;
      const g = gBars.firstChild as SVGGElement | null;
      if (g) g.style.transform = 'scaleX(1)';
    },
  };
}

function renderContractTable(DATA: TelcoDashboardData, onRowHover: (contractName: string | null) => void) {
  const host = document.getElementById('chart02b') as HTMLElement;
  type SortKey = 'contract' | 'n' | 'churnRate' | 'churnMrr' | 'medianTenure';
  let sortCol: SortKey = 'n';
  let sortDir: 'asc' | 'desc' = 'desc';

  const cols: Array<{ key: SortKey; label: string; num: boolean }> = [
    { key: 'contract', label: 'Contract', num: false },
    { key: 'n', label: 'Accounts', num: true },
    { key: 'churnRate', label: 'Churn rate', num: true },
    { key: 'churnMrr', label: 'Churned MRR', num: true },
    { key: 'medianTenure', label: 'Med. tenure', num: true },
  ];

  function draw() {
    const sorted = [...DATA.contractSummary].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const thead = el(
      'thead',
      {},
      el(
        'tr',
        {},
        cols.map((c) => {
          const isSorted = sortCol === c.key;
          const ariaSort = isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
          const btn = el('button', {
            type: 'button',
            class: 'sort-btn',
            html: `${c.label} <span aria-hidden="true">${isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>`,
          });
          btn.addEventListener('click', () => {
            if (sortCol === c.key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
            else {
              sortCol = c.key;
              sortDir = c.key === 'contract' ? 'asc' : 'desc';
            }
            draw();
          });
          return el('th', { class: c.num ? 'is-num' : '', scope: 'col', 'aria-sort': ariaSort }, btn);
        })
      )
    );

    const tbody = el(
      'tbody',
      {},
      sorted.map((r) => {
        const tr = el('tr', { tabindex: 0 }, [
          el('td', { text: r.contract }),
          el('td', { class: 'is-num', text: `${fmt(r.n)} (${fmt(r.share, 1)}%)` }),
          el(
            'td',
            { class: 'is-num' },
            el('span', { class: 'inline-bar-cell' }, [
              el('span', { class: 'inline-bar-track', 'aria-hidden': 'true' }, el('span', { class: 'inline-bar-fill', style: `width:${(r.churnRate / 45) * 100}%` })),
              el('span', { text: `${fmt(r.churnRate, 1)} %` }),
            ])
          ),
          el('td', { class: 'is-num', text: `$${fmt(r.churnMrr)}` }),
          el('td', { class: 'is-num', text: `${r.medianTenure} mo` }),
        ]);
        tr.addEventListener('pointerenter', () => onRowHover(r.contract));
        tr.addEventListener('pointerleave', () => onRowHover(null));
        tr.addEventListener('focus', () => onRowHover(r.contract));
        tr.addEventListener('blur', () => onRowHover(null));
        return tr;
      })
    );

    const totalChurnMrr = DATA.contractSummary.reduce((a, r) => a + r.churnMrr, 0);
    const tfoot = el(
      'tfoot',
      {},
      el('tr', {}, [
        el('td', { text: 'Portfolio total' }),
        el('td', { class: 'is-num', text: `${fmt(DATA.kpis.totalCustomers)} (100%)` }),
        el('td', { class: 'is-num', text: `${fmt(DATA.kpis.churnRate, 1)} %` }),
        el('td', { class: 'is-num', text: `$${fmt(totalChurnMrr)}` }),
        el('td', { class: 'is-num', text: '29 mo' }),
      ])
    );

    host.innerHTML = '';
    host.appendChild(el('div', { class: 'table-scroll' }, el('table', { class: 'data-table' }, [thead, tbody, tfoot])));
  }

  draw();
  const fig = el(
    'div',
    { class: 'fig-caption' },
    el('div', { class: 'fig-meta' }, [
      el('span', { class: 'micro-upper', text: 'FIG. 02B' }),
      el('span', { class: 'fig-text', text: 'Contract tier churn rate, monthly revenue at risk, and median tenure; hover rows to highlight Section 01.' }),
      el('span', { class: 'mono-meta', text: 'Source: Telco-Customer-Churn.csv, n = 7,043' }),
    ])
  );
  const capHost = document.getElementById('cap02b');
  if (capHost) {
    capHost.innerHTML = '';
    capHost.appendChild(fig);
  }
}

function renderDumbbell(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart03') as HTMLElement;
  let sortBy: 'churned' | 'delta' | 'retained' = 'churned';
  let revealed = REDUCED_MOTION;

  const svgEl = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'dumbTitle dumbDesc',
  });
  svgEl.appendChild(svg('title', { id: 'dumbTitle', text: 'Retained vs churned attribute prevalence' }));
  svgEl.appendChild(svg('desc', { id: 'dumbDesc', text: 'Animated dumbbell chart comparing prevalence (%) across retained vs churned subscribers.' }));
  const gridG = svg('g');
  const rowsG = svg('g');
  svgEl.appendChild(gridG);
  svgEl.appendChild(rowsG);
  host.innerHTML = '';
  host.appendChild(svgEl);

  function getSorted() {
    return [...DATA.drivers].sort((a, b) => {
      if (sortBy === 'churned') return b.churned - a.churned;
      if (sortBy === 'retained') return b.retained - a.retained;
      return Math.abs(b.churned - b.retained) - Math.abs(a.churned - a.retained);
    });
  }

  const capApi = renderFigureCaption('cap03', {
    fig: 'FIG. 03',
    caption: 'Attribute prevalence among Retained (hollow) vs Churned (filled) accounts with live sorting.',
    cols: [
      { label: 'Subscriber Attribute', num: false },
      { label: 'Retained (%)', num: true },
      { label: 'Churned (%)', num: true },
      { label: 'Gap (pp)', num: true },
    ],
    getRows: () =>
      getSorted().map((d) => {
        const diff = d.churned - d.retained;
        return [d.item, `${d.retained} %`, `${d.churned} %`, `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} pp`];
      }),
  });

  interface RowRef {
    g: SVGGElement;
    hit: SVGRectElement;
    label: SVGTextElement;
    line: SVGLineElement;
    dotRet: SVGCircleElement;
    dotChurn: SVGCircleElement;
    deltaTxt: SVGTextElement;
  }
  const rowEls = new Map<string, RowRef>();
  const rowH = 44;
  const topPad = 30;

  function buildOnce() {
    rowsG.innerHTML = '';
    rowEls.clear();
    DATA.drivers.forEach((d, idx) => {
      const diff = d.churned - d.retained;
      const accentColor = diff >= 0 ? 'var(--vermilion)' : 'var(--violet)';
      const textColor = diff >= 0 ? 'var(--vermilion-ink)' : 'var(--violet-ink)';
      const g = svg('g', {
        tabindex: 0,
        role: 'img',
        'aria-label': `${d.item}: Retained ${d.retained} percent, Churned ${d.churned} percent, difference ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} pp`,
        style: 'cursor:pointer;transition:transform var(--d-3) var(--ease-in-out);',
      });
      const hit = svg('rect', { x: 0, y: 0, height: rowH, fill: 'transparent' });
      const label = svg('text', { x: 0, y: 26, class: 'svg-label', text: d.item });
      const line = svg('line', {
        y1: 22,
        y2: 22,
        stroke: accentColor,
        'stroke-width': 2,
        style: `transition:transform var(--d-3) var(--ease-out);transition-delay:${REDUCED_MOTION ? 0 : idx * 60 + 120}ms;`,
      });
      const dotRet = svg('circle', {
        cy: 22,
        r: 5,
        fill: 'var(--paper)',
        stroke: 'var(--ink)',
        'stroke-width': 2,
        style: `transition:opacity var(--d-2) var(--ease-out);transition-delay:${REDUCED_MOTION ? 0 : idx * 60}ms;`,
      });
      const dotChurn = svg('circle', {
        cy: 22,
        r: 6,
        fill: accentColor,
        style: `transition:opacity var(--d-2) var(--ease-out);transition-delay:${REDUCED_MOTION ? 0 : idx * 60 + 360}ms;`,
      });
      const deltaTxt = svg('text', {
        y: 26,
        'text-anchor': 'end',
        style: `font-size:13px;font-weight:500;fill:${textColor};`,
        text: `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} pp`,
      });

      const info = {
        cat: d.item,
        val: `${d.churned}% churned vs ${d.retained}% retained`,
        sub: `Risk gap: ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} percentage points`,
      };
      g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
      g.addEventListener('pointermove', (e) => tt.show(g, info, e));
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('focus', () => tt.show(g, info));
      g.addEventListener('blur', tt.hide);

      g.appendChild(hit);
      g.appendChild(label);
      g.appendChild(line);
      g.appendChild(dotRet);
      g.appendChild(dotChurn);
      g.appendChild(deltaTxt);
      rowsG.appendChild(g);
      rowEls.set(d.item, { g, hit, label, line, dotRet, dotChurn, deltaTxt });
    });
  }

  function layout() {
    const w = Math.max(280, host.clientWidth || 540);
    const stacked = w < 460;
    const rH = stacked ? 56 : rowH;
    const tPad = stacked ? 28 : topPad;
    const labelW = stacked ? 0 : 210;
    const deltaW = stacked ? 0 : 54;
    const plotL = stacked ? 8 : labelW;
    const plotR = stacked ? w - 12 : w - deltaW;
    const xScale = scaleLinear(0, 100, plotL, plotR);
    const h = tPad + DATA.drivers.length * rH + 34;
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

    gridG.innerHTML = '';
    gridG.appendChild(svg('circle', { cx: plotL + 5, cy: 10, r: 4.5, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2 }));
    gridG.appendChild(svg('text', { x: plotL + 14, y: 14, class: 'svg-micro', text: 'Retained' }));
    gridG.appendChild(svg('circle', { cx: plotL + 84, cy: 10, r: 5, fill: 'var(--vermilion)' }));
    gridG.appendChild(svg('text', { x: plotL + 94, y: 14, class: 'svg-micro', text: 'Churned (elevated)' }));

    for (let tick = 0; tick <= 100; tick += 20) {
      const x = xScale(tick);
      gridG.appendChild(svg('line', { x1: x, y1: tPad, x2: x, y2: h - 24, stroke: tick === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': tick === 0 ? 1.5 : 1 }));
      gridG.appendChild(svg('text', { x, y: h - 6, 'text-anchor': 'middle', class: 'svg-micro', text: `${tick}%` }));
    }

    getSorted().forEach((d, rank) => {
      const refs = rowEls.get(d.item);
      if (!refs) return;
      const y = tPad + rank * rH;
      const trackY = stacked ? 36 : 22;
      const textY = stacked ? 15 : 26;
      refs.g.style.transform = `translate3d(0, ${y}px, 0)`;
      refs.hit.setAttribute('width', String(w));
      refs.hit.setAttribute('height', String(rH));
      refs.label.setAttribute('y', String(textY));

      const x1 = xScale(d.retained);
      const x2 = xScale(d.churned);
      refs.line.setAttribute('x1', String(x1));
      refs.line.setAttribute('x2', String(x2));
      refs.line.setAttribute('y1', String(trackY));
      refs.line.setAttribute('y2', String(trackY));
      refs.line.style.transformOrigin = `${x1}px ${trackY}px`;
      refs.line.style.transform = revealed ? 'scaleX(1)' : 'scaleX(0)';
      refs.dotRet.setAttribute('cx', String(x1));
      refs.dotRet.setAttribute('cy', String(trackY));
      refs.dotRet.style.opacity = revealed ? '1' : '0';
      refs.dotChurn.setAttribute('cx', String(x2));
      refs.dotChurn.setAttribute('cy', String(trackY));
      refs.dotChurn.style.opacity = revealed ? '1' : '0';
      refs.deltaTxt.setAttribute('x', String(w));
      refs.deltaTxt.setAttribute('y', String(textY));
    });
  }

  buildOnce();
  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();

  document.querySelectorAll('[data-dumb-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sortBy = (btn.getAttribute('data-dumb-sort') || 'churned') as typeof sortBy;
      document.querySelectorAll('[data-dumb-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layout();
      capApi.refreshTable();
    });
  });

  return {
    reveal: () => {
      revealed = true;
      layout();
    },
  };
}

function renderRotatedBars(
  container: HTMLElement,
  data: { labels: string[]; colors: string[]; onColors?: string[]; values: number[] },
  opts: {
    maxVal?: number;
    compact?: boolean;
    ariaLabel?: string;
    getTooltip?: (idx: number, val: number) => TooltipData;
  },
  tt: ReturnType<typeof initTooltip>
) {
  const maxVal = opts.maxVal || Math.max(...data.values);
  let currentVals = [...data.values];
  let revealed = REDUCED_MOTION;

  const wrap = el('div', { class: 'rot-bars-wrap' });
  const stage = el('div', {
    class: `rot-bars-stage ${opts.compact ? 'rot-bars-stage--outlook' : ''}`,
    role: 'group',
    'aria-label': opts.ariaLabel || 'Bar chart with rotated percentage numerals',
  });
  const labelsRow = el('div', { class: 'rot-bars-labels' });

  const barRefs = data.labels.map((label, idx) => {
    const val = currentVals[idx];
    const delayMs = REDUCED_MOTION ? 0 : idx * 60;
    const fill = el('div', {
      class: 'rot-bar-fill',
      style: `background:${data.colors[idx]};transition-delay:${delayMs}ms;`,
    });
    const anchor = el('div', {
      class: 'rot-num-anchor',
      style: `transition-delay:${REDUCED_MOTION ? 0 : idx * 60 + 280}ms;`,
    });
    const numText = el('span', { class: 'rot-num-text is-active', text: `${val}%` });
    anchor.appendChild(numText);

    const onColor = (data.onColors && data.onColors[idx]) || 'var(--ink)';
    const anchorIn = el('div', {
      class: 'rot-num-anchor',
      style: `transition-delay:${REDUCED_MOTION ? 0 : idx * 60 + 280}ms;`,
    });
    const numTextIn = el('span', {
      class: 'rot-num-text is-active',
      style: `color:${onColor};`,
      text: `${val}%`,
    });
    anchorIn.appendChild(numTextIn);
    const clipLayer = el(
      'div',
      {
        class: 'rot-bar-clip',
        'aria-hidden': 'true',
        style: `transition-delay:${delayMs}ms;`,
      },
      anchorIn
    );

    const btn = el(
      'button',
      {
        type: 'button',
        class: 'rot-bar-btn',
        'aria-label': `${label}: ${val} percent`,
      },
      [fill, anchor, clipLayer]
    );

    btn.addEventListener('pointerenter', (e) => {
      const info = opts.getTooltip ? opts.getTooltip(idx, currentVals[idx]) : { cat: label, val: `${currentVals[idx]} %`, sub: '' };
      tt.show(btn, info, e);
    });
    btn.addEventListener('pointermove', (e) => {
      const info = opts.getTooltip ? opts.getTooltip(idx, currentVals[idx]) : { cat: label, val: `${currentVals[idx]} %`, sub: '' };
      tt.show(btn, info, e);
    });
    btn.addEventListener('pointerleave', tt.hide);
    btn.addEventListener('focus', () => {
      const info = opts.getTooltip ? opts.getTooltip(idx, currentVals[idx]) : { cat: label, val: `${currentVals[idx]} %`, sub: '' };
      tt.show(btn, info);
    });
    btn.addEventListener('blur', tt.hide);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        barRefs[(idx + 1) % barRefs.length].btn.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        barRefs[(idx - 1 + barRefs.length) % barRefs.length].btn.focus();
      }
    });

    stage.appendChild(btn);
    labelsRow.appendChild(el('span', { class: 'rot-bar-label', text: label }));
    return { btn, fill, anchor, numText, anchorIn, numTextIn, onColor, label };
  });

  wrap.appendChild(stage);
  wrap.appendChild(labelsRow);
  container.innerHTML = '';
  container.appendChild(wrap);

  function applyHeights() {
    barRefs.forEach((ref, idx) => {
      const ratio = revealed ? currentVals[idx] / maxVal : 0;
      const rStr = ratio.toFixed(4);
      ref.fill.style.transform = `scaleY(${rStr})`;
      ref.btn.style.setProperty('--bar-ratio', rStr);
    });
  }

  function swapNum(anchor: HTMLElement, curEl: HTMLElement, newStr: string, extraStyle: string) {
    if (REDUCED_MOTION) {
      curEl.textContent = newStr;
      return curEl;
    }
    curEl.classList.remove('is-active');
    curEl.classList.add('is-exiting');
    const fresh = el('span', {
      class: 'rot-num-text is-entering',
      style: extraStyle || null,
      text: newStr,
    });
    anchor.appendChild(fresh);
    void fresh.offsetWidth;
    fresh.classList.remove('is-entering');
    fresh.classList.add('is-active');
    window.setTimeout(() => {
      if (curEl.parentNode === anchor) curEl.remove();
    }, 620);
    return fresh;
  }

  function update(newVals: number[]) {
    currentVals = [...newVals];
    applyHeights();
    barRefs.forEach((ref, idx) => {
      const newStr = `${currentVals[idx]}%`;
      ref.btn.setAttribute('aria-label', `${ref.label}: ${currentVals[idx]} percent`);
      if (ref.numText.textContent === newStr) return;
      ref.numText = swapNum(ref.anchor, ref.numText, newStr, '');
      ref.numTextIn = swapNum(ref.anchorIn, ref.numTextIn, newStr, `color:${ref.onColor};`);
    });
  }

  applyHeights();

  return {
    reveal: () => {
      revealed = true;
      applyHeights();
    },
    update,
  };
}

function initContractMix(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart04') as HTMLElement;
  const live = document.getElementById('limitsLive') as HTMLElement;
  let svc = 'All Accounts';
  const rl = DATA.contractByInternet;

  const bars = renderRotatedBars(
    host,
    {
      labels: rl.labels,
      colors: rl.colors,
      onColors: ['var(--on-vermilion)', 'var(--on-violet)', 'var(--on-magenta)'],
      values: rl.services[svc].values,
    },
    {
      maxVal: rl.maxAll,
      ariaLabel: 'Contract distribution bars by internet service',
      getTooltip: (idx, val) => {
        const regObj = rl.services[svc];
        const nEst = Math.round((val / 100) * regObj.n);
        const baseVal = rl.services['All Accounts'].values[idx];
        const diff = val - baseVal;
        const diffTxt = svc === 'All Accounts' ? 'Portfolio baseline' : `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} pp vs All`;
        return {
          cat: `${svc} · ${rl.labels[idx]}`,
          val: `${val} %`,
          sub: `≈ ${fmt(nEst)} accounts (${diffTxt})`,
        };
      },
    },
    tt
  );

  const capApi = renderFigureCaption('cap04', {
    fig: 'FIG. 04',
    caption: 'Contract term distribution (%) across internet infrastructure tiers with animated percentage numerals.',
    cols: [
      { label: 'Internet Tier', num: false },
      { label: 'Month-to-month (%)', num: true },
      { label: 'One year (%)', num: true },
      { label: 'Two year (%)', num: true },
      { label: 'Churn rate (%)', num: true },
      { label: 'n', num: true },
    ],
    getRows: () =>
      Object.entries(rl.services).map(([name, obj]) => [
        name,
        `${obj.values[0]} %`,
        `${obj.values[1]} %`,
        `${obj.values[2]} %`,
        `${fmt(obj.churnRate, 1)} %`,
        fmt(obj.n),
      ]),
  });

  const leadKicker = document.getElementById('limitsLeadKicker');
  const leadNum = document.getElementById('limitsLeadNum');
  const leadCap = document.getElementById('limitsLeadCap');

  document.querySelectorAll('[data-limit-region]').forEach((btn) => {
    btn.addEventListener('click', () => {
      svc = btn.getAttribute('data-limit-region') || 'All Accounts';
      document.querySelectorAll('[data-limit-region]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      const regObj = rl.services[svc];
      const vals = regObj.values;
      bars.update(vals);
      live.textContent = `${svc}: ${vals[0]} % month-to-month, ${vals[1]} % one year, ${vals[2]} % two year.`;
      if (leadKicker && leadNum && leadCap) {
        leadKicker.textContent = `Contract Mix · ${svc} (n = ${fmt(regObj.n)})`;
        leadNum.textContent = `${vals[0]} %`;
        leadCap.textContent = `held month-to-month contracts in ${svc} (churn rate ${fmt(regObj.churnRate, 1)}%), while ${vals[1]} % held one-year and ${vals[2]} % two-year terms.`;
      }
      capApi.refreshTable();
    });
  });

  return bars;
}

function renderTenureCurve(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const lineHost = document.getElementById('chart05a') as HTMLElement;
  const tlHost = document.getElementById('chart05b') as HTMLElement;
  const detailBox = document.getElementById('timelineDetail') as HTMLElement;
  let activeEventIdx = 0;

  const lineSvg = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'regTitle regDesc',
  });
  lineSvg.appendChild(svg('title', { id: 'regTitle', text: 'Churn hazard curve across tenure brackets' }));
  lineSvg.appendChild(svg('desc', { id: 'regDesc', text: 'Scroll-drawn line chart tracking subscriber churn declining from 52.9% in months 0–6 to 6.6% in months 61–72.' }));
  const gridG = svg('g');
  const pathG = svg('g');
  const marksG = svg('g');
  lineSvg.appendChild(gridG);
  lineSvg.appendChild(pathG);
  lineSvg.appendChild(marksG);
  lineHost.innerHTML = '';
  lineHost.appendChild(lineSvg);

  const tlSvg = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-label': 'Tenure cohort milestones 0 to 72 months',
  });
  const tlMobileList = el('div', {
    class: 'tl-mobile-list',
    role: 'group',
    'aria-label': 'Tenure cohort milestones 0 to 72 months',
    hidden: '',
  });
  tlHost.innerHTML = '';
  tlHost.appendChild(tlSvg);
  tlHost.appendChild(tlMobileList);

  let pathEl: SVGPathElement | null = null;
  let pathLen = 1;
  let markerEls: Array<{ sq: SVGRectElement; lbl: SVGTextElement | null; frac: number }> = [];
  let tlButtons: SVGGElement[] = [];
  let tlMobileButtons: HTMLButtonElement[] = [];
  let scrollProgress = REDUCED_MOTION ? 1 : 0;

  function updateDraw() {
    if (!pathEl) return;
    const p = REDUCED_MOTION ? 1 : scrollProgress;
    pathEl.style.strokeDashoffset = String(pathLen * (1 - p));
    markerEls.forEach(({ sq, lbl, frac }) => {
      const vis = p >= frac - 0.03 ? '1' : '0';
      sq.style.opacity = vis;
      if (lbl) lbl.style.opacity = vis;
    });
  }

  function renderDetail(idx: number) {
    activeEventIdx = idx;
    const ev = DATA.tenureMilestones[idx];
    detailBox.innerHTML = '';
    detailBox.appendChild(el('div', { class: 'timeline-detail-date', text: ev.date }));
    detailBox.appendChild(el('h3', { class: 'timeline-detail-title', text: ev.title }));
    detailBox.appendChild(el('p', { class: 'timeline-detail-body', text: ev.summary }));
    detailBox.appendChild(
      el('p', { class: 'timeline-detail-why' }, [
        el('strong', { text: 'Retention insight: ' }),
        document.createTextNode(ev.why),
      ])
    );

    tlButtons.forEach((btn, i) => {
      const isAct = i === idx;
      btn.setAttribute('tabindex', isAct ? '0' : '-1');
      btn.setAttribute('aria-pressed', String(isAct));
      const r = btn.querySelector('rect[fill]:not([fill="transparent"])');
      if (r) r.setAttribute('fill', isAct ? 'var(--vermilion)' : 'var(--ink)');
    });
    tlMobileButtons.forEach((btn, i) => {
      btn.setAttribute('aria-pressed', String(i === idx));
    });
  }

  function layout() {
    const w = Math.max(280, lineHost.clientWidth || 540);
    const h = 260;
    const padL = 38;
    const padR = w < 420 ? 58 : 54;
    const padT = 24;
    const padB = 30;
    const xScale = scaleLinear(0, 6.2, padL, w - padR);
    const yScale = scaleLinear(0, 60, h - padB, padT);

    lineSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gridG.innerHTML = '';
    pathG.innerHTML = '';
    marksG.innerHTML = '';
    markerEls = [];

    for (let tick = 0; tick <= 60; tick += 15) {
      const y = yScale(tick);
      gridG.appendChild(svg('line', { x1: padL, y1: y, x2: w - padR, y2: y, stroke: tick === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': tick === 0 ? 1.5 : 1 }));
      gridG.appendChild(svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'svg-micro', text: `${tick}%` }));
    }

    const pts = DATA.tenureLine.map((d) => ({ x: xScale(d.bandIdx), y: yScale(d.churnRate), d }));
    const dStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    pathEl = svg('path', { d: dStr, fill: 'none', stroke: 'var(--vermilion)', 'stroke-width': 2.2 });
    pathG.appendChild(pathEl);
    pathLen = pathEl.getTotalLength() || 1;
    pathEl.style.strokeDasharray = String(pathLen);

    pts.forEach((p, idx) => {
      gridG.appendChild(svg('text', { x: p.x, y: h - 8, 'text-anchor': 'middle', class: 'svg-micro', text: p.d.label.replace(' mo', 'm') }));
      const sq = svg('rect', {
        x: p.x - 3.5,
        y: p.y - 3.5,
        width: 7,
        height: 7,
        fill: 'var(--vermilion)',
        tabindex: 0,
        role: 'img',
        'aria-label': `${p.d.label}: ${p.d.churnRate} percent churn rate (${p.d.churned} of ${p.d.n})`,
        style: 'cursor:pointer;transition:opacity 180ms var(--ease-out);',
      });
      const info = { cat: `Tenure ${p.d.label}`, val: `${fmt(p.d.churnRate, 1)} % churn`, sub: `${fmt(p.d.churned)} exited out of ${fmt(p.d.n)} accounts` };
      sq.addEventListener('pointerenter', (e) => tt.show(sq, info, e));
      sq.addEventListener('pointermove', (e) => tt.show(sq, info, e));
      sq.addEventListener('pointerleave', tt.hide);
      sq.addEventListener('focus', () => tt.show(sq, info));
      sq.addEventListener('blur', tt.hide);
      marksG.appendChild(sq);

      let lbl: SVGTextElement | null = null;
      if (idx === pts.length - 1) {
        lbl = svg('text', {
          x: p.x + 10,
          y: p.y + 6,
          style: `font-size:${w < 400 ? 18 : 22}px;font-weight:500;letter-spacing:-0.015em;fill:var(--ink);transition:opacity 200ms;`,
          text: `${fmt(p.d.churnRate, 1)} %`,
        });
        marksG.appendChild(lbl);
      }
      markerEls.push({ sq, lbl, frac: idx / (pts.length - 1) });
    });

    const compactTl = w < 560;
    tlSvg.innerHTML = '';
    tlButtons = [];
    tlMobileList.innerHTML = '';
    tlMobileButtons = [];

    if (compactTl) {
      const tlH = 34;
      tlSvg.setAttribute('viewBox', `0 0 ${w} ${tlH}`);
      tlSvg.appendChild(svg('line', { x1: padL, y1: 16, x2: w - padR, y2: 16, stroke: 'var(--ink)', 'stroke-width': 1.5 }));
      DATA.tenureMilestones.forEach((ev, idx) => {
        const x = xScale(ev.pos);
        const gBtn = svg('g', {
          role: 'button',
          tabindex: idx === activeEventIdx ? 0 : -1,
          'aria-pressed': String(idx === activeEventIdx),
          'aria-label': `${ev.date}: ${ev.title}`,
          style: 'cursor:pointer;',
        });
        gBtn.appendChild(svg('rect', { x: x - 10, y: 4, width: 20, height: 24, fill: 'transparent' }));
        gBtn.appendChild(svg('rect', { x: x - 5, y: 11, width: 10, height: 10, fill: idx === activeEventIdx ? 'var(--vermilion)' : 'var(--ink)' }));
        gBtn.addEventListener('click', () => renderDetail(idx));
        gBtn.addEventListener('focus', () => renderDetail(idx));
        tlSvg.appendChild(gBtn);
        tlButtons.push(gBtn);

        const mBtn = el('button', { type: 'button', class: 'tl-mobile-btn', 'aria-pressed': String(idx === activeEventIdx) }, [
          el('span', { class: 'tl-mobile-sq', 'aria-hidden': 'true' }),
          el('span', { class: 'tl-mobile-date', text: ev.date }),
          el('span', { class: 'tl-mobile-title', text: ev.short }),
        ]);
        mBtn.addEventListener('click', () => renderDetail(idx));
        mBtn.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (idx + 1) % tlMobileButtons.length;
            renderDetail(next);
            tlMobileButtons[next].focus();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = (idx - 1 + tlMobileButtons.length) % tlMobileButtons.length;
            renderDetail(prev);
            tlMobileButtons[prev].focus();
          }
        });
        tlMobileList.appendChild(mBtn);
        tlMobileButtons.push(mBtn);
      });
      tlMobileList.hidden = false;
    } else {
      tlMobileList.hidden = true;
      const tlH = 166;
      tlSvg.setAttribute('viewBox', `0 0 ${w} ${tlH}`);
      tlSvg.appendChild(svg('line', { x1: padL, y1: 18, x2: w - padR, y2: 18, stroke: 'var(--ink)', 'stroke-width': 1.5 }));

      const tierMap = [0, 1, 2, 0, 1, 2, 0];
      DATA.tenureMilestones.forEach((ev, idx) => {
        const x = xScale(ev.pos);
        const stack = tierMap[idx] || 0;
        const tickY = 18 + stack * 48;
        if (stack > 0) {
          tlSvg.appendChild(svg('line', { x1: x, y1: 18, x2: x, y2: tickY, stroke: 'var(--rule)', 'stroke-width': 1 }));
        }
        const gBtn = svg('g', {
          role: 'button',
          tabindex: idx === activeEventIdx ? 0 : -1,
          'aria-pressed': String(idx === activeEventIdx),
          'aria-label': `${ev.date}: ${ev.title}`,
          style: 'cursor:pointer;',
        });
        gBtn.appendChild(svg('rect', { x: x - 12, y: tickY - 12, width: 24, height: 24, fill: 'transparent' }));
        gBtn.appendChild(svg('rect', { x: x - 6, y: tickY - 6, width: 12, height: 12, fill: idx === activeEventIdx ? 'var(--vermilion)' : 'var(--ink)' }));

        const anchor = ev.pos > 5.4 ? 'end' : ev.pos < 0.5 ? 'start' : 'middle';
        const tx = anchor === 'start' ? x - 6 : anchor === 'end' ? x + 6 : x;
        gBtn.appendChild(svg('text', { x: tx, y: tickY + 20, 'text-anchor': anchor, class: 'svg-micro', text: ev.date }));
        gBtn.appendChild(svg('text', { x: tx, y: tickY + 34, 'text-anchor': anchor, style: 'font-size:11px;font-weight:500;fill:var(--ink);', text: ev.short }));

        gBtn.addEventListener('click', () => renderDetail(idx));
        gBtn.addEventListener('focus', () => renderDetail(idx));
        gBtn.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = (idx + 1) % tlButtons.length;
            renderDetail(next);
            tlButtons[next].focus();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = (idx - 1 + tlButtons.length) % tlButtons.length;
            renderDetail(prev);
            tlButtons[prev].focus();
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            renderDetail(idx);
          }
        });

        tlSvg.appendChild(gBtn);
        tlButtons.push(gBtn);
      });
    }

    updateDraw();
  }

  renderFigureCaption('cap05', {
    fig: 'FIG. 05',
    caption: 'Scroll-drawn hazard curve plotting churn rate across all 7 tenure brackets from onboarding to 6 years.',
    cols: [
      { label: 'Tenure Bracket', num: false },
      { label: 'Accounts (n)', num: true },
      { label: 'Churned (n)', num: true },
      { label: 'Churn Rate (%)', num: true },
    ],
    rows: DATA.tenureLine.map((d) => [d.label, fmt(d.n), fmt(d.churned), `${fmt(d.churnRate, 1)} %`]),
  });

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(lineHost);
  layout();
  renderDetail(activeEventIdx);

  return {
    onScroll: (secEl: HTMLElement) => {
      if (REDUCED_MOTION) return;
      const r = secEl.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const start = vh * 0.8;
      const end = vh * 0.4;
      const next = Math.max(0, Math.min(1, (start - r.top) / (start - end)));
      if (Math.abs(next - scrollProgress) > 0.004) {
        scrollProgress = next;
        updateDraw();
      }
    },
  };
}

function renderMrrColumns(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart06') as HTMLElement;
  const legendHost = document.getElementById('volumeLegend') as HTMLElement;
  const series = DATA.mrrByTenure.series;
  const years = DATA.mrrByTenure.years;

  const activeKeys = new Set(series.map((s) => s.key));
  let mode: 'abs' | 'share' = 'abs';
  let stepHighlight = 0;
  let revealed = REDUCED_MOTION;

  legendHost.innerHTML = '';
  series.forEach((s) => {
    const chip = el(
      'button',
      {
        type: 'button',
        class: 'legend-chip',
        'aria-pressed': 'true',
        'data-series': s.key,
      },
      [el('span', { class: 'legend-swatch', style: `background:${s.color};` }), el('span', { text: s.label })]
    );
    chip.addEventListener('click', () => {
      if (activeKeys.has(s.key) && activeKeys.size === 1) return;
      if (activeKeys.has(s.key)) activeKeys.delete(s.key);
      else activeKeys.add(s.key);
      chip.setAttribute('aria-pressed', String(activeKeys.has(s.key)));
      layout();
      capApi.refreshTable();
    });
    legendHost.appendChild(chip);
  });

  const svgEl = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'volTitle volDesc',
  });
  svgEl.appendChild(svg('title', { id: 'volTitle', text: 'Monthly recurring revenue by tenure band and contract term' }));
  svgEl.appendChild(svg('desc', { id: 'volDesc', text: 'Interactive stacked column chart showing MRR ($k) across 6 annual tenure cohorts stacked by contract tier.' }));

  const gridG = svg('g');
  const colsG = svg('g');
  const crosshair = svg('line', { y1: 24, y2: 316, stroke: 'var(--ink)', 'stroke-width': 1, 'stroke-dasharray': '3 3', style: 'opacity:0;pointer-events:none;' });
  svgEl.appendChild(gridG);
  svgEl.appendChild(colsG);
  svgEl.appendChild(crosshair);
  host.innerHTML = '';
  host.appendChild(svgEl);

  const capApi = renderFigureCaption('cap06', {
    fig: 'FIG. 06',
    caption: 'Monthly recurring revenue ($k/mo) across tenure cohorts disaggregated by contract commitment.',
    cols: [
      { label: 'Tenure Band', num: false },
      ...series.map((s) => ({ label: `${s.label} ($k)`, num: true })),
      { label: 'Total MRR ($k)', num: true },
    ],
    getRows: () =>
      years.map((yr) => {
        const sum = series.filter((s) => activeKeys.has(s.key)).reduce((a, s) => a + yr[s.key], 0);
        return [yr.year, ...series.map((s) => (activeKeys.has(s.key) ? fmt(yr[s.key], 1) : '—')), fmt(sum, 1)];
      }),
  });

  function isSeriesHighlighted(key: 'm2m' | 'one' | 'two') {
    if (stepHighlight === 0) return key === 'm2m';
    if (stepHighlight === 1) return key === 'one';
    return true;
  }

  let colHits: SVGRectElement[] = [];

  function layout() {
    const w = Math.max(280, host.clientWidth || 540);
    const h = 360;
    const padL = 50;
    const padR = w < 400 ? 18 : 12;
    const padT = 34;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gridG.innerHTML = '';
    colsG.innerHTML = '';
    colHits = [];
    crosshair.setAttribute('y1', String(padT));
    crosshair.setAttribute('y2', String(padT + plotH));

    const maxVal = mode === 'share' ? 100 : Math.max(30, ...years.map((yr) => series.filter((s) => activeKeys.has(s.key)).reduce((a, s) => a + yr[s.key], 0)));
    const yMax = mode === 'share' ? 100 : Math.ceil(maxVal / 30) * 30 || 120;
    const yScale = scaleLinear(0, yMax, padT + plotH, padT);

    const ticks = mode === 'share' ? [0, 25, 50, 75, 100] : [0, 30, 60, 90, 120, 150].filter((t) => t <= yMax + 10);
    ticks.forEach((t) => {
      const y = yScale(t);
      gridG.appendChild(svg('line', { x1: padL, y1: y, x2: w - padR, y2: y, stroke: t === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': t === 0 ? 1.5 : 1 }));
      gridG.appendChild(svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'svg-micro', text: mode === 'share' ? `${t}%` : `$${fmt(t)}k` }));
    });

    const slotW = plotW / years.length;
    const barW = Math.max(20, Math.min(54, slotW * 0.68));
    const compact = slotW < 44;

    years.forEach((yr, idx) => {
      const cx = padL + slotW * idx + slotW / 2;
      const x = cx - barW / 2;
      const activeSum = series.filter((s) => activeKeys.has(s.key)).reduce((a, s) => a + yr[s.key], 0);
      const colGroup = svg('g', {
        style: `transform-origin:${cx}px ${padT + plotH}px;transform:scaleY(${revealed ? 1 : 0});transition:transform var(--d-3) var(--ease-out);transition-delay:${REDUCED_MOTION ? 0 : idx * 45}ms;`,
      });

      let acc = 0;
      series.forEach((s) => {
        if (!activeKeys.has(s.key)) return;
        const raw = yr[s.key];
        if (raw <= 0) return;
        const val = mode === 'share' ? (activeSum > 0 ? (raw / activeSum) * 100 : 0) : raw;
        const yTop = yScale(acc + val);
        const yBot = yScale(acc);
        const segH = Math.max(0, yBot - yTop);
        const hi = isSeriesHighlighted(s.key);
        colGroup.appendChild(svg('rect', { x, y: yTop, width: barW, height: segH, fill: hi ? s.color : 'var(--neutral-data)' }));
        acc += val;
      });

      colsG.appendChild(colGroup);
      const topY = yScale(mode === 'share' ? 100 : activeSum);
      colsG.appendChild(svg('text', { x: cx, y: topY - 7, 'text-anchor': 'middle', class: 'svg-label', style: `font-size:${compact ? 10 : 12}px;`, text: mode === 'share' ? '100%' : `$${fmt(activeSum, 1)}k` }));
      colsG.appendChild(svg('text', { x: cx, y: padT + plotH + 18, 'text-anchor': 'middle', class: 'svg-micro', style: compact ? 'font-size:10px;' : null, text: compact ? yr.year.replace(' mo', 'm') : yr.year }));

      const breakdown = series.filter((s) => activeKeys.has(s.key)).map((s) => `${s.label}: $${fmt(yr[s.key], 1)}k`).join(' | ');
      const hit = svg('rect', {
        x: padL + slotW * idx,
        y: padT,
        width: slotW,
        height: plotH,
        fill: 'transparent',
        tabindex: 0,
        role: 'img',
        'aria-label': `${yr.year}: $${fmt(activeSum, 1)}k MRR. ${breakdown}`,
        style: 'cursor:pointer;',
      });
      const info = { cat: `Tenure ${yr.year}`, val: `$${fmt(activeSum, 1)}k MRR`, sub: breakdown };
      hit.addEventListener('pointerenter', (e) => {
        crosshair.setAttribute('x1', String(cx));
        crosshair.setAttribute('x2', String(cx));
        crosshair.style.opacity = '1';
        tt.show(hit, info, e);
      });
      hit.addEventListener('pointermove', (e) => tt.show(hit, info, e));
      hit.addEventListener('pointerleave', () => {
        crosshair.style.opacity = '0';
        tt.hide();
      });
      hit.addEventListener('focus', () => {
        crosshair.setAttribute('x1', String(cx));
        crosshair.setAttribute('x2', String(cx));
        crosshair.style.opacity = '1';
        tt.show(hit, info);
      });
      hit.addEventListener('blur', () => {
        crosshair.style.opacity = '0';
        tt.hide();
      });
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          colHits[(idx + 1) % colHits.length].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          colHits[(idx - 1 + colHits.length) % colHits.length].focus();
        }
      });
      colsG.appendChild(hit);
      colHits.push(hit);
    });
  }

  document.querySelectorAll('[data-vol-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = (btn.getAttribute('data-vol-mode') || 'abs') as 'abs' | 'share';
      document.querySelectorAll('[data-vol-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layout();
    });
  });

  const stepBtns = Array.from(document.querySelectorAll('.scrolly-step'));
  const mobileTabs = Array.from(document.querySelectorAll('[data-step-tab]'));

  function setStep(idx: number) {
    stepHighlight = idx;
    stepBtns.forEach((b, i) => {
      b.classList.toggle('is-active', i === idx);
      b.setAttribute('aria-pressed', String(i === idx));
    });
    mobileTabs.forEach((b, i) => b.setAttribute('aria-pressed', String(i === idx)));
    layout();
  }

  stepBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      setStep(i);
      if (window.innerWidth >= 1024) {
        b.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
      }
    });
  });
  mobileTabs.forEach((b, i) => b.addEventListener('click', () => setStep(i)));

  const stepIO = new IntersectionObserver(
    (entries) => {
      if (window.innerWidth < 768) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute('data-step') || '', 10);
          if (!Number.isNaN(idx)) setStep(idx);
        }
      });
    },
    { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
  );
  stepBtns.forEach((b) => stepIO.observe(b));

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();

  return {
    reveal: () => {
      revealed = true;
      layout();
    },
  };
}

function renderHeatmap(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart07') as HTMLElement;
  const slider = document.getElementById('hmThreshold') as HTMLInputElement;
  const threshValEl = document.getElementById('hmThresholdVal') as HTMLElement;
  const liveCount = document.getElementById('hmLiveCount') as HTMLElement;

  let sortCol: number | null = null;
  let sortDir: 'asc' | 'desc' = 'desc';
  let threshold = 0;

  function binStyle(v: number) {
    if (v >= 50) return { bg: 'var(--violet-600)', fg: 'var(--white)' };
    if (v >= 40) return { bg: 'var(--violet-500)', fg: 'var(--white)' };
    if (v >= 30) return { bg: 'var(--violet-400)', fg: 'var(--ink)' };
    if (v >= 20) return { bg: 'var(--violet-300)', fg: 'var(--ink)' };
    if (v >= 10) return { bg: 'var(--violet-200)', fg: 'var(--ink)' };
    return { bg: 'var(--violet-100)', fg: 'var(--ink)' };
  }

  function getRows() {
    const rows = [...DATA.heatmap.rows];
    if (sortCol !== null) {
      const colIdx = sortCol;
      rows.sort((a, b) => (sortDir === 'desc' ? b.vals[colIdx] - a.vals[colIdx] : a.vals[colIdx] - b.vals[colIdx]));
    }
    return rows;
  }

  const capApi = renderFigureCaption('cap07', {
    fig: 'FIG. 07',
    caption: 'Interactive 10×5 matrix showing churn rate (%) across subscriber attributes and payment methods.',
    cols: [{ label: 'Risk / Service Factor', num: false }, ...DATA.heatmap.cols.map((c) => ({ label: `${c} (%)`, num: true }))],
    getRows: () => getRows().map((r) => [r.sector, ...r.vals.map((v) => `${v} %`)]),
  });

  function draw() {
    const rows = getRows();
    const cols = DATA.heatmap.cols;
    const scrollWrap = el('div', { class: 'heatmap-scroll' });
    const table = el('table', { class: 'heatmap-table', role: 'grid', 'aria-label': 'Churn rate heatmap by attribute and payment channel' });

    const thead = el(
      'thead',
      {},
      el('tr', {}, [
        el('th', { class: 'hm-sector-col', scope: 'col', text: 'Risk Factor' }),
        ...cols.map((c, cIdx) => {
          const sorted = sortCol === cIdx;
          const ariaSort = sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
          const btn = el('button', {
            type: 'button',
            class: 'sort-btn',
            html: `${c === 'Overall' ? 'Segment Avg' : c} <span aria-hidden="true">${sorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>`,
          });
          btn.addEventListener('click', () => {
            if (sortCol === cIdx) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
            else {
              sortCol = cIdx;
              sortDir = 'desc';
            }
            draw();
            capApi.refreshTable();
          });
          return el('th', { scope: 'col', 'aria-sort': ariaSort, class: c === 'Overall' ? 'hm-global-col' : '' }, btn);
        }),
      ])
    );

    const cellMatrix: HTMLButtonElement[][] = [];
    const tbody = el(
      'tbody',
      {},
      rows.map((r, rIdx) => {
        const rowBtns: HTMLButtonElement[] = [];
        const tr = el('tr', {}, [
          el('th', { scope: 'row', class: 'hm-row-label', text: r.sector }),
          ...r.vals.map((v, cIdx) => {
            const st = binStyle(v);
            const diff = v - r.vals[4];
            const isOverall = cIdx === 4;
            const btn = el('button', {
              type: 'button',
              class: `hm-cell-btn${v < threshold ? ' is-below' : ''}`,
              style: `background:${st.bg};color:${st.fg};`,
              tabindex: rIdx === 0 && cIdx === 0 ? '0' : '-1',
              'aria-label': `${r.sector}, ${cols[cIdx]}: ${v} percent churn${isOverall ? '' : `, ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} pp vs Segment Avg`}`,
              text: `${v}%`,
            });
            const info = {
              cat: `${r.sector} · ${cols[cIdx]}`,
              val: `${v} % churn`,
              sub: isOverall ? 'All payment methods combined' : `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} pp vs segment avg (${r.vals[4]} %)`,
            };
            btn.addEventListener('pointerenter', (e) => {
              highlightCrosshair(rIdx, cIdx);
              tt.show(btn, info, e);
            });
            btn.addEventListener('pointermove', (e) => tt.show(btn, info, e));
            btn.addEventListener('pointerleave', () => {
              clearCrosshair();
              tt.hide();
            });
            btn.addEventListener('focus', () => {
              highlightCrosshair(rIdx, cIdx);
              tt.show(btn, info);
            });
            btn.addEventListener('blur', () => {
              clearCrosshair();
              tt.hide();
            });
            btn.addEventListener('keydown', (e) => {
              let nr = rIdx;
              let nc = cIdx;
              if (e.key === 'ArrowRight') nc = Math.min(cols.length - 1, cIdx + 1);
              else if (e.key === 'ArrowLeft') nc = Math.max(0, cIdx - 1);
              else if (e.key === 'ArrowDown') nr = Math.min(rows.length - 1, rIdx + 1);
              else if (e.key === 'ArrowUp') nr = Math.max(0, rIdx - 1);
              else if (e.key === 'Home') nc = 0;
              else if (e.key === 'End') nc = cols.length - 1;
              else return;
              e.preventDefault();
              btn.setAttribute('tabindex', '-1');
              const nextBtn = cellMatrix[nr][nc];
              nextBtn.setAttribute('tabindex', '0');
              nextBtn.focus();
            });
            rowBtns.push(btn);
            return el('td', { class: isOverall ? 'hm-global-col' : '' }, btn);
          }),
        ]);
        cellMatrix.push(rowBtns);
        return tr;
      })
    );

    function highlightCrosshair(tr: number, tc: number) {
      cellMatrix.forEach((row, rIdx) =>
        row.forEach((b, cIdx) => {
          b.classList.toggle('is-dim', rIdx !== tr && cIdx !== tc);
        })
      );
    }
    function clearCrosshair() {
      cellMatrix.forEach((row) => row.forEach((b) => b.classList.remove('is-dim')));
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    scrollWrap.appendChild(table);
    host.innerHTML = '';
    host.appendChild(scrollWrap);
    host.appendChild(el('p', { class: 'mono-meta hm-mobile-cue', text: 'Swipe table horizontally to compare all payment channels →' }));
    updateThresholdCount();
  }

  function updateThresholdCount() {
    let count = 0;
    const btns = host.querySelectorAll('.hm-cell-btn');
    btns.forEach((b) => {
      const val = parseInt(b.textContent || '0', 10);
      const pass = val >= threshold;
      b.classList.toggle('is-below', !pass);
      if (pass) count++;
    });
    liveCount.textContent = `${count} of ${btns.length} cells`;
  }

  slider.addEventListener('input', () => {
    threshold = parseInt(slider.value, 10);
    threshValEl.textContent = String(threshold);
    updateThresholdCount();
  });

  draw();
}

function renderWaffle(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart08a') as HTMLElement;
  const statHost = document.getElementById('waffleRotStat') as HTMLElement;
  let segment = 'All Accounts';
  let statControl: { anchor: HTMLElement; numText: HTMLElement } | null = null;

  function renderStat(val: number) {
    if (!statControl) {
      const anchor = el('div', { class: 'rot-num-anchor' });
      const numText = el('span', { class: 'rot-num-text is-active', text: String(val) });
      anchor.appendChild(numText);
      statHost.innerHTML = '';
      statHost.appendChild(anchor);
      statControl = { anchor, numText };
    } else {
      const newStr = String(val);
      if (statControl.numText.textContent === newStr) return;
      if (REDUCED_MOTION) {
        statControl.numText.textContent = newStr;
        return;
      }
      const oldEl = statControl.numText;
      oldEl.classList.remove('is-active');
      oldEl.classList.add('is-exiting');
      const fresh = el('span', { class: 'rot-num-text is-entering', text: newStr });
      statControl.anchor.appendChild(fresh);
      void fresh.offsetWidth;
      fresh.classList.remove('is-entering');
      fresh.classList.add('is-active');
      statControl.numText = fresh;
      window.setTimeout(() => {
        if (statControl && oldEl.parentNode === statControl.anchor) oldEl.remove();
      }, 620);
    }
  }

  const svgEl = svg('svg', {
    style: 'width:100%;max-width:260px;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'waffleTitle waffleDesc',
  });
  svgEl.appendChild(svg('title', { id: 'waffleTitle', text: '10x10 outcome waffle chart' }));
  svgEl.appendChild(svg('desc', { id: 'waffleDesc', text: '10 by 10 waffle chart of 100 accounts split into churned, month-to-month retained, and term-contract retained.' }));

  const defs = svg('defs');
  const pat = svg('pattern', { id: 'waffle-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pat.appendChild(svg('rect', { width: 5, height: 5, fill: 'var(--paper)' }));
  pat.appendChild(svg('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: 'var(--violet)', 'stroke-width': 2 }));
  defs.appendChild(pat);
  svgEl.appendChild(defs);

  const cellsG = svg('g');
  const hitG = svg('g');
  svgEl.appendChild(cellsG);
  svgEl.appendChild(hitG);
  const legendDiv = el('div', { class: 'hm-ramp' });
  host.innerHTML = '';
  host.appendChild(svgEl);
  host.appendChild(legendDiv);

  const cellSize = 20;
  const gap = 4;
  const step = cellSize + gap;
  const gridSize = 10 * step - gap;
  svgEl.setAttribute('viewBox', `0 0 ${gridSize} ${gridSize}`);

  const cells: SVGRectElement[] = [];
  for (let c = 0; c < 10; c++) {
    for (let r = 0; r < 10; r++) {
      const yRow = 9 - r;
      const rect = svg('rect', {
        x: c * step,
        y: yRow * step,
        width: cellSize,
        height: cellSize,
        fill: 'none',
        stroke: 'var(--ink-3)',
        'stroke-width': 1,
        style: 'transition:fill 120ms linear, stroke 120ms linear;',
      });
      cellsG.appendChild(rect);
      cells.push(rect);
    }
  }

  const capApi = renderFigureCaption('cap08a', {
    fig: 'FIG. 08A',
    caption: '10×10 waffle lattice showing churned, month-to-month retained, and term-locked accounts per 100 subscribers.',
    cols: [
      { label: 'Internet Tier', num: false },
      { label: 'Churned (%)', num: true },
      { label: 'M2M Retained (%)', num: true },
      { label: 'Term Retained (%)', num: true },
    ],
    rows: Object.entries(DATA.waffle).map(([k, v]) => [k, `${v.churned} %`, `${v.m2mRetained} %`, `${v.termRetained} %`]),
  });

  function applySegment(animateSeq = false) {
    const d = DATA.waffle[segment];
    renderStat(d.churned);

    cells.forEach((rect, idx) => {
      const delay = animateSeq && !REDUCED_MOTION ? idx * 6 : 0;
      const run = () => {
        if (idx < d.churned) {
          rect.setAttribute('fill', 'var(--vermilion)');
          rect.setAttribute('stroke', 'var(--vermilion)');
        } else if (idx < d.churned + d.m2mRetained) {
          rect.setAttribute('fill', 'url(#waffle-hatch)');
          rect.setAttribute('stroke', 'var(--violet)');
        } else {
          rect.setAttribute('fill', 'var(--paper)');
          rect.setAttribute('stroke', 'var(--ink-3)');
        }
      };
      if (delay > 0) window.setTimeout(run, delay);
      else run();
    });

    hitG.innerHTML = '';
    const cats = [
      { label: 'Churned', val: d.churned },
      { label: 'M2M Retained', val: d.m2mRetained },
      { label: 'Term Retained (1–2 yr)', val: d.termRetained },
    ];
    const summaryHit = svg('rect', {
      x: 0,
      y: 0,
      width: gridSize,
      height: gridSize,
      fill: 'transparent',
      tabindex: 0,
      role: 'img',
      'aria-label': `${segment}: ${d.churned} churned, ${d.m2mRetained} month-to-month retained, ${d.termRetained} term-locked per 100 accounts`,
      style: 'cursor:pointer;',
    });
    const info = {
      cat: segment,
      val: `${d.churned} / 100 churned`,
      sub: `${d.m2mRetained} M2M retained · ${d.termRetained} term-locked`,
    };
    summaryHit.addEventListener('pointerenter', (e) => tt.show(summaryHit, info, e));
    summaryHit.addEventListener('pointermove', (e) => tt.show(summaryHit, info, e));
    summaryHit.addEventListener('pointerleave', tt.hide);
    summaryHit.addEventListener('focus', () => tt.show(summaryHit, info));
    summaryHit.addEventListener('blur', tt.hide);
    hitG.appendChild(summaryHit);

    legendDiv.innerHTML = '';
    cats.forEach((c) => {
      let box: Element;
      if (c.label === 'M2M Retained') {
        box = svg('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' }, [
          svg('rect', { x: 0.5, y: 0.5, width: 11, height: 11, fill: 'var(--paper)', stroke: 'var(--violet)', 'stroke-width': 1 }),
          svg('line', { x1: 0, y1: 6, x2: 6, y2: 0, stroke: 'var(--violet)', 'stroke-width': 1.5 }),
          svg('line', { x1: 0, y1: 12, x2: 12, y2: 0, stroke: 'var(--violet)', 'stroke-width': 1.5 }),
          svg('line', { x1: 6, y1: 12, x2: 12, y2: 6, stroke: 'var(--violet)', 'stroke-width': 1.5 }),
        ]);
      } else {
        box = el('span', {
          class: 'hm-ramp-box',
          style:
            c.label === 'Churned'
              ? 'background:var(--vermilion);border:1px solid var(--vermilion);width:12px;height:12px;'
              : 'background:var(--paper);border:1px solid var(--ink-3);width:12px;height:12px;',
        });
      }
      legendDiv.appendChild(el('span', { class: 'hm-ramp-item' }, [box, document.createTextNode(`${c.label} ${c.val}`)]));
    });
  }

  document.querySelectorAll('[data-waffle-seg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      segment = btn.getAttribute('data-waffle-seg') || 'All Accounts';
      document.querySelectorAll('[data-waffle-seg]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      applySegment(true);
      capApi.refreshTable();
    });
  });

  applySegment(false);
}

function renderLifecycleBars(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart08b') as HTMLElement;
  let sortMode: 'original' | 'retained' = 'original';
  let revealed = REDUCED_MOTION;

  const cats = [
    { label: 'Early churn (0–12m)', color: 'var(--vermilion)' },
    { label: 'Later churn (>12m)', color: 'var(--vermilion-tint)' },
    { label: 'M2M retained', color: 'var(--neutral-data)' },
    { label: '1-Yr retained', color: 'var(--violet-tint)' },
    { label: '2-Yr retained', color: 'var(--violet)' },
  ];

  const svgEl = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'likertTitle likertDesc',
  });
  svgEl.appendChild(svg('title', { id: 'likertTitle', text: 'Diverging customer lifecycle outcome distribution' }));
  svgEl.appendChild(svg('desc', { id: 'likertDesc', text: 'Diverging stacked bars across subscriber segments centred on Month-to-Month Retained.' }));

  const rowsG = svg('g');
  svgEl.appendChild(rowsG);
  const legendDiv = el('div', { class: 'hm-ramp', style: 'margin-top:0;margin-bottom:var(--s-3);' });
  cats.forEach((c) => {
    legendDiv.appendChild(el('span', { class: 'hm-ramp-item' }, [el('span', { class: 'hm-ramp-box', style: `background:${c.color};` }), document.createTextNode(c.label)]));
  });
  host.innerHTML = '';
  host.appendChild(legendDiv);
  host.appendChild(svgEl);

  function getSorted() {
    const list = [...DATA.lifecycleBars];
    if (sortMode === 'retained') {
      list.sort((a, b) => b.vals[3] + b.vals[4] - (a.vals[3] + a.vals[4]));
    }
    return list;
  }

  const capApi = renderFigureCaption('cap08b', {
    fig: 'FIG. 08B',
    caption: 'Diverging outcome breakdown (%) centred on Month-to-Month Retained.',
    cols: [
      { label: 'Subscriber Segment', num: false },
      { label: '0–12m Churn', num: true },
      { label: '>12m Churn', num: true },
      { label: 'M2M Ret.', num: true },
      { label: '1-Yr Ret.', num: true },
      { label: '2-Yr Ret.', num: true },
    ],
    getRows: () => getSorted().map((d) => [d.text, ...d.vals.map((v) => `${v} %`)]),
  });

  function wrapWords(str: string, maxChars: number) {
    const words = str.split(' ');
    const lines: string[] = [];
    let cur = '';
    words.forEach((word) => {
      const next = cur ? `${cur} ${word}` : word;
      if (next.length > maxChars && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = next;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function layout() {
    const w = Math.max(280, host.clientWidth || 540);
    const isCompact = w < 460;
    const topPad = 8;
    const sidePad = isCompact ? 36 : 42;
    const chartW = w - sidePad * 2;
    const cx = w / 2;
    const pxPerPct = chartW / 160;
    const rows = getSorted();
    const maxChars = Math.max(32, Math.floor(w / 6.8));

    const rowMetrics = rows.map((row) => {
      const lines = isCompact ? wrapWords(row.text, maxChars) : [row.text];
      const labelH = lines.length > 1 ? 34 : 20;
      return { row, lines, labelH, rH: labelH + 40 };
    });

    const totalH = topPad + rowMetrics.reduce((acc, m) => acc + m.rH, 0) + 8;
    svgEl.setAttribute('viewBox', `0 0 ${w} ${totalH}`);
    rowsG.innerHTML = '';

    let yCursor = topPad;
    rowMetrics.forEach(({ row, lines, labelH, rH }, rIdx) => {
      const yTop = yCursor;
      const barY = yTop + labelH + 2;
      const barH = 22;
      const [c1, c2, c3, c4, c5] = row.vals;
      const churnNet = c1 + c2;
      const termNet = c4 + c5;
      const leftStart = cx - (churnNet + c3 / 2) * pxPerPct;

      const lblEl = svg('text', { x: 0, y: yTop + 14, class: 'svg-label', style: `font-size:${isCompact ? 12 : 12.5}px;` });
      if (lines.length === 1) {
        lblEl.textContent = lines[0];
      } else {
        lines.forEach((ln, li) => {
          lblEl.appendChild(svg('tspan', { x: 0, dy: li === 0 ? '0' : '15', text: ln }));
        });
      }
      rowsG.appendChild(lblEl);

      const barGroup = svg('g', {
        style: `transform-origin:${cx}px ${barY + barH / 2}px;transform:scaleX(${revealed ? 1 : 0});transition:transform var(--d-3) var(--ease-out);transition-delay:${REDUCED_MOTION ? 0 : rIdx * 60}ms;`,
      });

      let xCur = leftStart;
      row.vals.forEach((val, cIdx) => {
        const segW = val * pxPerPct;
        const rect = svg('rect', {
          x: xCur,
          y: barY,
          width: segW,
          height: barH,
          fill: cats[cIdx].color,
          tabindex: 0,
          role: 'img',
          'aria-label': `${row.text}: ${cats[cIdx].label} ${val} percent`,
          style: 'cursor:pointer;',
        });
        const info = { cat: cats[cIdx].label, val: `${val} %`, sub: `${row.text} (Churned ${churnNet}%, Term retained ${termNet}%)` };
        rect.addEventListener('pointerenter', (e) => tt.show(rect, info, e));
        rect.addEventListener('pointermove', (e) => tt.show(rect, info, e));
        rect.addEventListener('pointerleave', tt.hide);
        rect.addEventListener('focus', () => tt.show(rect, info));
        rect.addEventListener('blur', tt.hide);
        barGroup.appendChild(rect);
        xCur += segW;
      });
      rowsG.appendChild(barGroup);
      rowsG.appendChild(svg('line', { x1: cx, x2: cx, y1: barY - 3, y2: barY + barH + 3, stroke: 'var(--ink)', 'stroke-width': 1.5, style: 'pointer-events:none;' }));
      rowsG.appendChild(svg('text', { x: leftStart - 6, y: barY + 15, 'text-anchor': 'end', class: 'svg-micro', style: 'fill:var(--vermilion-ink);font-weight:500;', text: `${churnNet}%` }));
      rowsG.appendChild(svg('text', { x: xCur + 6, y: barY + 15, 'text-anchor': 'start', class: 'svg-micro', style: 'fill:var(--violet-ink);font-weight:500;', text: `${termNet}%` }));

      yCursor += rH;
    });
  }

  document.querySelectorAll('[data-likert-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sortMode = (btn.getAttribute('data-likert-sort') || 'original') as 'original' | 'retained';
      document.querySelectorAll('[data-likert-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layout();
      capApi.refreshTable();
    });
  });

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();

  return {
    reveal: () => {
      revealed = true;
      layout();
    },
  };
}

function renderScatter(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart09') as HTMLElement;
  const chipsHost = document.getElementById('scatterSectors') as HTMLElement;
  const minSlider = document.getElementById('scatterMinScore') as HTMLInputElement;
  const minValEl = document.getElementById('scatterMinVal') as HTMLElement;
  const trendToggle = document.getElementById('scatterTrendToggle') as HTMLInputElement;
  const slopeReadout = document.getElementById('scatterSlopeReadout') as HTMLElement;
  const r2Readout = document.getElementById('scatterR2Readout') as HTMLElement;
  const dynamicSlopeSpan = document.querySelector('[data-slope]');

  const sectors = DATA.scatter.sectors;
  const deals = DATA.scatter.deals;
  const activeSectors = new Set(sectors.map((s) => s.name));
  let minTenure = 0;
  let showTrend = true;

  const sectorMap = Object.fromEntries(sectors.map((s) => [s.name, s]));
  chipsHost.innerHTML = '';
  sectors.forEach((s) => {
    const chip = el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': 'true' }, [
      el('span', { class: 'legend-swatch', style: `background:${s.color};border-radius:${s.shape === 'circle' ? '50%' : '0'};` }),
      el('span', { text: s.name }),
    ]);
    chip.addEventListener('click', () => {
      if (activeSectors.has(s.name) && activeSectors.size === 1) return;
      if (activeSectors.has(s.name)) activeSectors.delete(s.name);
      else activeSectors.add(s.name);
      chip.setAttribute('aria-pressed', String(activeSectors.has(s.name)));
      layout();
      capApi.refreshTable();
    });
    chipsHost.appendChild(chip);
  });

  const svgEl = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'scatTitle scatDesc',
  });
  svgEl.appendChild(svg('title', { id: 'scatTitle', text: 'Churn rate vs mean tenure scatter plot' }));
  svgEl.appendChild(svg('desc', { id: 'scatDesc', text: 'Interactive scatter plot of 30 tenure-service cohorts with live OLS linear regression line.' }));

  const gridG = svg('g');
  const trendLine = svg('line', { stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', style: 'transition:opacity 180ms var(--ease-std);' });
  const ptsG = svg('g');
  svgEl.appendChild(gridG);
  svgEl.appendChild(trendLine);
  svgEl.appendChild(ptsG);
  host.innerHTML = '';
  host.appendChild(svgEl);

  function isVisible(d: (typeof deals)[number]) {
    return activeSectors.has(d.sector) && d.score >= minTenure;
  }

  const capApi = renderFigureCaption('cap09', {
    fig: 'FIG. 09',
    caption: 'Cohort churn rate (y) vs mean tenure months (x) across 30 tenure brackets with live OLS regression.',
    cols: [
      { label: 'Cohort Bracket', num: false },
      { label: 'Service Tier', num: false },
      { label: 'Accounts (n)', num: true },
      { label: 'Avg Tenure (mo)', num: true },
      { label: 'Churn Rate (%)', num: true },
    ],
    getRows: () => deals.filter(isVisible).map((d) => [d.label, d.sector, fmt(d.n), fmt(d.score, 1), `${fmt(d.bps, 1)} %`]),
  });

  function computeOLS(pts: typeof deals) {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    pts.forEach((p) => {
      sx += p.score;
      sy += p.bps;
      sxx += p.score * p.score;
      sxy += p.score * p.bps;
    });
    const mx = sx / n;
    const my = sy / n;
    const den = sxx - n * mx * mx;
    if (Math.abs(den) < 1e-9) return null;
    const slope = (sxy - n * mx * my) / den;
    const intercept = my - slope * mx;
    let ssRes = 0;
    let ssTot = 0;
    pts.forEach((p) => {
      const pred = slope * p.score + intercept;
      ssRes += (p.bps - pred) ** 2;
      ssTot += (p.bps - my) ** 2;
    });
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;
    return { slope, intercept, r2 };
  }

  function shapeNode(shape: string, cx: number, cy: number, color: string, active: boolean) {
    const fill = active ? color : 'var(--neutral-data)';
    if (shape === 'circle') return svg('circle', { cx, cy, r: 5, fill });
    if (shape === 'square') return svg('rect', { x: cx - 5, y: cy - 5, width: 10, height: 10, fill });
    return svg('polygon', { points: `${cx},${cy - 6} ${cx + 5.5},${cy + 4.5} ${cx - 5.5},${cy + 4.5}`, fill });
  }

  function layout() {
    const w = Math.max(280, host.clientWidth || 540);
    const h = 360;
    const padL = 48;
    const padR = 18;
    const padT = 20;
    const padB = 40;
    const xScale = scaleLinear(0, 75, padL, w - padR);
    const yScale = scaleLinear(0, 75, h - padB, padT);

    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gridG.innerHTML = '';
    ptsG.innerHTML = '';

    [0, 15, 30, 45, 60, 75].forEach((tick) => {
      const y = yScale(tick);
      gridG.appendChild(svg('line', { x1: padL, y1: y, x2: w - padR, y2: y, stroke: tick === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': tick === 0 ? 1.5 : 1 }));
      gridG.appendChild(svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'svg-micro', text: `${tick}%` }));
    });

    [0, 15, 30, 45, 60, 75].forEach((tick) => {
      const x = xScale(tick);
      gridG.appendChild(svg('line', { x1: x, y1: padT, x2: x, y2: h - padB, stroke: tick === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': tick === 0 ? 1.5 : 1 }));
      gridG.appendChild(svg('text', { x, y: h - 22, 'text-anchor': 'middle', class: 'svg-micro', text: `${tick}m` }));
    });
    gridG.appendChild(svg('text', { x: padL, y: 12, class: 'svg-micro', text: 'Churn rate (%)' }));
    gridG.appendChild(svg('text', { x: w - padR, y: h - 4, 'text-anchor': 'end', class: 'svg-micro', text: 'Mean tenure (months) →' }));

    const visibleDeals = deals.filter(isVisible);
    const ols = computeOLS(visibleDeals);

    if (ols && showTrend) {
      const xs = visibleDeals.map((d) => d.score);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.max(0, Math.min(75, ols.slope * x0 + ols.intercept));
      const y1 = Math.max(0, Math.min(75, ols.slope * x1 + ols.intercept));
      trendLine.setAttribute('x1', String(xScale(x0)));
      trendLine.setAttribute('y1', String(yScale(y0)));
      trendLine.setAttribute('x2', String(xScale(x1)));
      trendLine.setAttribute('y2', String(yScale(y1)));
      trendLine.style.opacity = '1';
    } else {
      trendLine.style.opacity = '0';
    }

    if (ols) {
      const absSlope = Math.abs(ols.slope);
      const sign = ols.slope <= 0 ? '−' : '+';
      slopeReadout.textContent = `${sign}${fmt(absSlope, 2)} pp per tenure month`;
      r2Readout.textContent = `R² ${fmt(ols.r2, 2)}`;
      if (dynamicSlopeSpan) dynamicSlopeSpan.textContent = `${sign}${fmt(absSlope, 2)} pp`;
    } else {
      slopeReadout.textContent = 'Insufficient points';
      r2Readout.textContent = 'R² —';
    }

    const activeNodes: Array<{ g: SVGGElement; cx: number; cy: number }> = [];

    deals.forEach((d) => {
      const cx = xScale(d.score);
      const cy = yScale(d.bps);
      const active = isVisible(d);
      const spec = sectorMap[d.sector];

      const g = svg('g', {
        style: `opacity:${active ? 1 : 0.35};cursor:pointer;`,
        tabindex: active ? 0 : -1,
        role: 'img',
        'aria-label': `${d.label}: mean tenure ${d.score} months, churn ${d.bps} percent (${d.n} accounts)`,
      });
      g.appendChild(svg('circle', { cx, cy, r: 12, fill: 'transparent' }));
      g.appendChild(shapeNode(spec.shape, cx, cy, spec.color, active));

      const info = {
        cat: d.label,
        val: `${fmt(d.bps, 1)} % churn`,
        sub: `Mean tenure ${fmt(d.score, 1)} mo · Avg $${fmt(d.avgMonthly, 0)}/mo · n = ${fmt(d.n)}${active ? '' : ' (filtered out)'}`,
      };
      g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
      g.addEventListener('pointermove', (e) => tt.show(g, info, e));
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('focus', () => tt.show(g, info));
      g.addEventListener('blur', tt.hide);

      if (active) {
        const entry = { g, cx, cy };
        activeNodes.push(entry);
        g.addEventListener('keydown', (e) => {
          let dirX = 0;
          let dirY = 0;
          if (e.key === 'ArrowRight') dirX = 1;
          else if (e.key === 'ArrowLeft') dirX = -1;
          else if (e.key === 'ArrowDown') dirY = 1;
          else if (e.key === 'ArrowUp') dirY = -1;
          else return;
          e.preventDefault();
          let best: (typeof activeNodes)[number] | null = null;
          let bestScore = Infinity;
          activeNodes.forEach((cand) => {
            if (cand === entry) return;
            const dx = cand.cx - entry.cx;
            const dy = cand.cy - entry.cy;
            const proj = dx * dirX + dy * dirY;
            if (proj <= 1) return;
            const perp = Math.abs(dx * dirY - dy * dirX);
            const dist = proj + perp * 1.8;
            if (dist < bestScore) {
              bestScore = dist;
              best = cand;
            }
          });
          if (best) (best as (typeof activeNodes)[number]).g.focus();
        });
      }

      ptsG.appendChild(g);
    });
  }

  minSlider.addEventListener('input', () => {
    minTenure = parseInt(minSlider.value, 10);
    minValEl.textContent = String(minTenure);
    layout();
    capApi.refreshTable();
  });
  trendToggle.addEventListener('change', () => {
    showTrend = trendToggle.checked;
    layout();
  });

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();
}

function initRiskSummaryBars(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart10a') as HTMLElement;
  const ob = DATA.riskSummaryBars;
  const bars = renderRotatedBars(
    host,
    {
      labels: ob.labels,
      colors: ob.colors,
      onColors: ['var(--on-vermilion)', 'var(--on-violet)', 'var(--on-magenta)'],
      values: ob.values,
    },
    {
      maxVal: ob.maxAll,
      compact: true,
      ariaLabel: 'Share of churned monthly revenue by contract tier',
      getTooltip: (idx, val) => ({
        cat: `Churned MRR · ${ob.labels[idx]}`,
        val: `${val} %`,
        sub: `$${fmt(ob.amountsK[idx], 1)}k of $${fmt(DATA.kpis.mrrAtRiskK, 1)}k lost MRR`,
      }),
    },
    tt
  );

  renderFigureCaption('cap10a', {
    fig: 'FIG. 10A',
    caption: 'Share of $139.1k monthly recurring revenue lost to churn by contract agreement.',
    cols: [
      { label: 'Contract Tier', num: false },
      { label: 'Churned MRR ($k)', num: true },
      { label: 'Share (%)', num: true },
    ],
    rows: ob.labels.map((l, i) => [l, `$${fmt(ob.amountsK[i], 1)}k`, `${ob.values[i]} %`]),
  });

  return bars;
}

function renderSegmentTable(DATA: TelcoDashboardData) {
  const host = document.getElementById('chart10b') as HTMLElement;
  const searchInput = document.getElementById('marketSearch') as HTMLInputElement;
  const countEl = document.getElementById('marketCount') as HTMLElement;
  const csvBtn = document.getElementById('downloadCsvBtn') as HTMLButtonElement;

  let searchQuery = '';
  let contractFilter = 'All';
  type SortCol = 'segment' | 'contract' | 'n' | 'churnRate' | 'avgMonthly' | 'mrrAtRisk' | 'avgTenure';
  let sortCol: SortCol = 'churnRate';
  let sortDir: 'asc' | 'desc' = 'desc';
  let debounceTimer: number | undefined;

  const cols: Array<{ key: SortCol | 'trend'; label: string; num: boolean; nosort?: boolean }> = [
    { key: 'segment', label: 'Internet & Payment Segment', num: false },
    { key: 'contract', label: 'Contract', num: false },
    { key: 'n', label: 'Accounts', num: true },
    { key: 'churnRate', label: 'Churn (%)', num: true },
    { key: 'avgMonthly', label: 'Avg $/mo', num: true },
    { key: 'mrrAtRisk', label: 'MRR at Risk ($)', num: true },
    { key: 'avgTenure', label: 'Avg Tenure', num: true },
    { key: 'trend', label: 'Y1–Y6 Churn Curve', num: false, nosort: true },
  ];

  function getFilteredSorted() {
    const q = searchQuery.trim().toLowerCase();
    return DATA.segments
      .filter((m) => contractFilter === 'All' || m.contract === contractFilter)
      .filter((m) => !q || m.segment.toLowerCase().includes(q) || m.contract.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }

  function makeSparkline(vals: number[]) {
    const w = 96;
    const h = 24;
    const pad = 3;
    const maxV = Math.max(...vals, 30);
    const xS = scaleLinear(0, vals.length - 1, pad, w - pad - 3);
    const yS = scaleLinear(0, maxV, h - pad, pad);
    const pts = vals.map((v, i) => `${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ');
    const lx = xS(vals.length - 1);
    const ly = yS(vals[vals.length - 1]);
    return svg('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true', style: 'display:block;' }, [
      svg('polyline', { fill: 'none', stroke: 'var(--violet)', 'stroke-width': 1.5, points: pts }),
      svg('circle', { cx: lx, cy: ly, r: 2.5, fill: 'var(--violet)' }),
    ]);
  }

  function draw() {
    const rows = getFilteredSorted();
    countEl.textContent = `Showing ${rows.length} of ${DATA.segments.length} segments`;

    if (rows.length === 0) {
      const empty = el('div', { class: 'empty-state' }, [
        el('span', { text: `No segments match "${searchQuery.trim() || contractFilter}".` }),
        el('button', { type: 'button', class: 'fig-table-btn', text: 'Clear filters' }),
      ]);
      empty.querySelector('button')?.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        contractFilter = 'All';
        document.querySelectorAll('[data-mregion]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-mregion') === 'All')));
        draw();
      });
      host.innerHTML = '';
      host.appendChild(empty);
      return;
    }

    const scrollRegion = el('div', {
      class: 'market-table-scroll',
      tabindex: 0,
      role: 'region',
      'aria-label': 'Interactive 36-segment churn index table',
    });

    const thead = el(
      'thead',
      {},
      el(
        'tr',
        {},
        cols.map((c) => {
          if (c.nosort || c.key === 'trend') return el('th', { scope: 'col', text: c.label });
          const sorted = sortCol === c.key;
          const ariaSort = sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
          const btn = el('button', {
            type: 'button',
            class: 'sort-btn',
            html: `${c.label} <span aria-hidden="true">${sorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>`,
          });
          btn.addEventListener('click', () => {
            if (sortCol === c.key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
            else {
              sortCol = c.key as SortCol;
              sortDir = c.key === 'segment' || c.key === 'contract' ? 'asc' : 'desc';
            }
            draw();
          });
          return el('th', { class: c.num ? 'is-num' : '', scope: 'col', 'aria-sort': ariaSort }, btn);
        })
      )
    );

    const tbody = el(
      'tbody',
      {},
      rows.map((m) =>
        el(
          'tr',
          {
            'aria-label': `${m.contract} · ${m.segment}: ${m.churnRate} percent churn across ${m.n} accounts`,
          },
          [
            el('td', { style: 'font-weight:500;', text: m.segment }),
            el('td', { style: 'color:var(--ink-2);', text: m.contract }),
            el('td', { class: 'is-num', text: fmt(m.n) }),
            el(
              'td',
              { class: 'is-num' },
              el('span', { class: 'inline-bar-cell' }, [
                el('span', { class: 'inline-bar-track', 'aria-hidden': 'true' }, el('span', { class: 'inline-bar-fill', style: `width:${(m.churnRate / 65) * 100}%` })),
                el('span', { text: fmt(m.churnRate, 1) }),
              ])
            ),
            el('td', { class: 'is-num', text: `$${fmt(m.avgMonthly, 1)}` }),
            el('td', { class: 'is-num', style: 'color:var(--vermilion-ink);font-weight:500;', text: `$${fmt(m.mrrAtRisk)}` }),
            el('td', { class: 'is-num', text: `${fmt(m.avgTenure, 1)} mo` }),
            el('td', {}, makeSparkline(m.trend)),
          ]
        )
      )
    );

    scrollRegion.appendChild(el('table', { class: 'data-table' }, [thead, tbody]));
    host.innerHTML = '';
    host.appendChild(scrollRegion);
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      searchQuery = searchInput.value;
      draw();
    }, 120);
  });

  document.querySelectorAll('[data-mregion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      contractFilter = btn.getAttribute('data-mregion') || 'All';
      document.querySelectorAll('[data-mregion]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      draw();
    });
  });

  csvBtn.addEventListener('click', () => {
    const rows = getFilteredSorted();
    const header = ['Segment', 'Contract', 'Accounts', 'Churned', 'Churn Rate (%)', 'Avg Monthly ($)', 'MRR at Risk ($)', 'Avg Tenure (mo)', 'Y1 (%)', 'Y2 (%)', 'Y3 (%)', 'Y4 (%)', 'Y5 (%)', 'Y6 (%)'];
    const lines = [header.join(',')].concat(
      rows.map((m) =>
        [
          `"${m.segment}"`,
          `"${m.contract}"`,
          m.n,
          m.churned,
          m.churnRate.toFixed(1),
          m.avgMonthly.toFixed(1),
          m.mrrAtRisk,
          m.avgTenure.toFixed(1),
          ...m.trend.map((v) => v.toFixed(1)),
        ].join(',')
      )
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'telco-churn-segments.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  draw();
}

function initReveal(callbacks: Record<string, () => void>) {
  const revealEls = Array.from(document.querySelectorAll('[data-reveal]'));
  const countEls = Array.from(document.querySelectorAll('[data-countup]'));

  if (REDUCED_MOTION) {
    revealEls.forEach((sec) => sec.classList.add('is-in'));
    Object.values(callbacks).forEach((fn) => fn());
    countEls.forEach(countUp);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const sec = entry.target;
        sec.classList.add('is-in');
        io.unobserve(sec);
        if (sec.id && callbacks[sec.id]) callbacks[sec.id]();
        sec.querySelectorAll('[data-countup]').forEach(countUp);
      });
    },
    { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
  );

  revealEls.forEach((s) => io.observe(s));
}

function initScrollLoop(onRegScroll: (el: HTMLElement) => void) {
  const progressBar = document.getElementById('scrollProgress') as HTMLElement;
  const sec05 = document.getElementById('s05') as HTMLElement | null;
  let ticking = false;

  function frame() {
    ticking = false;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    progressBar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (onRegScroll && sec05) onRegScroll(sec05);
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    },
    { passive: true }
  );
  frame();
}

const THEMES = [
  { id: 'lavender-press', name: 'Lavender Press', desc: 'The house edition: violet masthead, lilac stock, vermilion signal.' },
  { id: 'newsprint', name: 'Newsprint', desc: 'Warm uncoated stock, black masthead, cobalt and brick inks.' },
  { id: 'night-edition', name: 'Night Edition', desc: 'Charcoal pages and an amber masthead for after-hours reading.' },
  { id: 'gazette-mono', name: 'Gazette Mono', desc: 'Black on white; greys carry the data, labels carry the meaning.' },
  { id: 'swiss-poster', name: 'Swiss Poster', desc: 'International Style red and black with one cobalt counterpoint.' },
  { id: 'forest-ochre', name: 'Forest & Ochre', desc: 'Field-guide greens, ochre and rust on oat-coloured paper.' },
  { id: 'riso-pastel', name: 'Riso Pastel', desc: 'Two-drum risograph: fluoro pink and medium blue on cream.' },
];

function initThemePanel(pager: ReturnType<typeof initPager>, tt: ReturnType<typeof initTooltip>) {
  const STORAGE_KEY = 'folio.theme.v1';
  const DEFAULT_THEME = 'lavender-press';
  const panel = document.getElementById('themePanel') as HTMLDialogElement;
  const inner = document.getElementById('themePanelInner') as HTMLElement;
  const btn = document.getElementById('themePanelBtn') as HTMLButtonElement;
  const closeBtn = document.getElementById('themePanelClose') as HTMLButtonElement;
  const list = document.getElementById('themeList') as HTMLFieldSetElement;
  const resetBtn = document.getElementById('themeReset') as HTMLButtonElement;
  const storageNote = document.getElementById('themeStorageNote') as HTMLElement | null;
  const statusEl = document.getElementById('themeStatus') as HTMLElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  let storageOk = true;
  try {
    localStorage.setItem('folio.theme.test', '1');
    localStorage.removeItem('folio.theme.test');
  } catch (_) {
    storageOk = false;
  }
  if (!storageOk && storageNote) {
    storageNote.textContent = 'Not saved: storage unavailable';
  }

  THEMES.forEach((t) => {
    const radio = el('input', { type: 'radio', name: 'theme', value: t.id, class: 'theme-radio' });
    const swatch = el('span', { class: 'theme-swatch', 'data-swatch': t.id, 'aria-hidden': 'true' }, [
      el('span', { class: 'sw-band' }),
      el('span', { class: 'sw-mid' }, [el('span', { class: 'sw-line' }), el('span', { class: 'sw-bars' }, [el('i'), el('i'), el('i')])]),
      el('span', { class: 'sw-ramp' }, [el('i'), el('i'), el('i'), el('i'), el('i'), el('i')]),
    ]);
    const body = el('span', { class: 'theme-opt-body' }, [
      swatch,
      el('span', { class: 'theme-opt-text' }, [el('span', { class: 'theme-opt-name', text: t.name }), el('span', { class: 'theme-opt-desc', text: t.desc })]),
      el('span', { class: 'theme-opt-mark', 'aria-hidden': 'true' }),
    ]);
    list.appendChild(el('label', { class: 'theme-opt' }, [radio, body]));
  });

  const radios = Array.from(list.querySelectorAll('.theme-radio')) as HTMLInputElement[];
  let persistTimer: number | undefined;
  let fadeTimer: number | undefined;
  let lastFocus: HTMLElement | null = null;
  let closing = false;

  function syncThemeColorMeta() {
    if (!themeMeta) return;
    const bandColor = getComputedStyle(document.documentElement).getPropertyValue('--band').trim();
    if (bandColor) themeMeta.setAttribute('content', bandColor);
  }

  function applyTheme(id: string, opts: { persist?: boolean; remove?: boolean; immediate?: boolean; announce?: boolean } = {}) {
    const themeObj = THEMES.find((t) => t.id === id) || THEMES[0];
    const safeId = themeObj.id;
    document.documentElement.dataset.theme = safeId;
    radios.forEach((r) => {
      r.checked = r.value === safeId;
    });
    const isDefault = safeId === DEFAULT_THEME;
    resetBtn.disabled = isDefault;
    resetBtn.setAttribute('aria-disabled', String(isDefault));
    syncThemeColorMeta();

    if (opts.announce !== false) statusEl.textContent = `Theme: ${themeObj.name}`;
    document.dispatchEvent(new CustomEvent('folio:themechange', { detail: { id: safeId } }));

    if (opts.persist !== false && storageOk) {
      window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        try {
          if (opts.remove) localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, safeId);
        } catch (_) {
          storageOk = false;
          if (storageNote) storageNote.textContent = 'Not saved: storage unavailable';
        }
      }, opts.immediate ? 0 : 150);
    }
  }

  function switchTheme(id: string, opts: { persist?: boolean; remove?: boolean; immediate?: boolean; announce?: boolean; force?: boolean } = {}) {
    const current = document.documentElement.dataset.theme || DEFAULT_THEME;
    if (current === id && !opts.force) return;
    if (REDUCED_MOTION) {
      applyTheme(id, opts);
      return;
    }
    if (typeof (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition === 'function') {
      try {
        (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => applyTheme(id, opts));
        return;
      } catch (_) {}
    }
    window.clearTimeout(fadeTimer);
    document.documentElement.classList.add('theme-fading');
    applyTheme(id, opts);
    fadeTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-fading');
    }, 450);
  }

  radios.forEach((r) => {
    r.addEventListener('change', () => {
      if (r.checked) switchTheme(r.value, { persist: true, announce: true });
    });
  });

  resetBtn.addEventListener('click', () => {
    switchTheme(DEFAULT_THEME, { persist: true, remove: true, immediate: true, announce: true });
  });

  function openPanel() {
    if (panel.open) return;
    closing = false;
    if (pager.isDropdownOpen()) pager.closeDropdown(false);
    tt.hide();
    const ae = document.activeElement;
    lastFocus = ae && ae !== document.body && ae !== document.documentElement && ae instanceof HTMLElement ? ae : btn;
    document.documentElement.classList.add('panel-open');
    panel.showModal();
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      const checked = (panel.querySelector('.theme-radio:checked') as HTMLInputElement | null) || radios[0];
      if (checked) checked.focus({ preventScroll: true });
    });
  }

  function finishClose() {
    if (!panel.open) return;
    panel.close();
    btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('panel-open');
    closing = false;
    const target = lastFocus && lastFocus !== document.body && document.contains(lastFocus) ? lastFocus : btn;
    target.focus();
  }

  function closePanel() {
    if (!panel.open || closing) return;
    closing = true;
    panel.classList.remove('is-open');
    let done = false;
    const onDone = (e: Event) => {
      if (e.target !== panel || done) return;
      done = true;
      panel.removeEventListener('transitionend', onDone);
      finishClose();
    };
    panel.addEventListener('transitionend', onDone);
    window.setTimeout(() => {
      if (!done) {
        done = true;
        panel.removeEventListener('transitionend', onDone);
        finishClose();
      }
    }, REDUCED_MOTION ? 140 : 300);
  }

  btn.addEventListener('click', () => (panel.open ? closePanel() : openPanel()));
  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('cancel', (e) => {
    e.preventDefault();
    closePanel();
  });
  panel.addEventListener('click', (e) => {
    if (e.target !== panel) return;
    const rect = inner.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closePanel();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const checked = (panel.querySelector('.theme-radio:checked') as HTMLInputElement | null) || radios[0];
    const lastEl = resetBtn.disabled ? checked : resetBtn;
    if (e.shiftKey) {
      if (document.activeElement === closeBtn) {
        e.preventDefault();
        lastEl.focus();
      }
    } else if (document.activeElement === lastEl) {
      e.preventDefault();
      closeBtn.focus();
    }
  });

  const bandEl = document.querySelector('.band');
  const bandInner = document.querySelector('.band-inner');
  function fitBand() {
    if (!bandEl || !bandInner) return;
    bandEl.classList.remove('band--hide-label', 'band--hide-folio');
    const vw = window.innerWidth;
    if (vw >= 768 && vw <= 1023) {
      if (bandInner.scrollWidth > bandInner.clientWidth) bandEl.classList.add('band--hide-label');
      if (bandInner.scrollWidth > bandInner.clientWidth) bandEl.classList.add('band--hide-folio');
    }
  }
  if (bandInner) {
    new ResizeObserver(() => requestAnimationFrame(fitBand)).observe(bandInner);
    window.addEventListener('resize', () => requestAnimationFrame(fitBand), { passive: true });
    fitBand();
  }

  const initial = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
  applyTheme(initial, { persist: false, announce: false });

  return {
    isOpen: () => panel.open,
    open: openPanel,
    close: closePanel,
    applyTheme: (id: string) => switchTheme(id, { persist: true, announce: true }),
  };
}

function initShortcuts(
  sectionsCount: number,
  pager: ReturnType<typeof initPager>,
  themePanel: ReturnType<typeof initThemePanel>,
  tt: ReturnType<typeof initTooltip>
) {
  const gridOverlay = document.getElementById('gridOverlay');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      tt.hide();
      if (pager.isDropdownOpen()) pager.closeDropdown(true);
      return;
    }
    if (themePanel.isOpen()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const key = e.key.toLowerCase();
    if (key === 'j') {
      e.preventDefault();
      pager.jumpTo(Math.min(sectionsCount - 1, pager.getActive() + 1));
    } else if (key === 'k') {
      e.preventDefault();
      pager.jumpTo(Math.max(0, pager.getActive() - 1));
    } else if (key === 'g') {
      e.preventDefault();
      gridOverlay?.classList.toggle('is-on');
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
      pager.jumpTo(idx);
    }
  });
}

function renderMlSection(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>): TelcoMlResult | null {
  const curveHost = document.getElementById('chart11a') as HTMLElement | null;
  const driverHost = document.getElementById('chart11b') as HTMLElement | null;
  const tableHost = document.getElementById('chart11c') as HTMLElement | null;
  if (!curveHost || !driverHost || !tableHost) return null;

  const aucReadout = document.getElementById('mlAucReadout') as HTMLElement | null;
  const aucSub = document.getElementById('mlAucSub') as HTMLElement | null;
  const liftReadout = document.getElementById('mlLiftReadout') as HTMLElement | null;
  const liftSub = document.getElementById('mlLiftSub') as HTMLElement | null;
  const roiReadout = document.getElementById('mlRoiReadout') as HTMLElement | null;
  const roiSub = document.getElementById('mlRoiSub') as HTMLElement | null;

  const topPctSlider = document.getElementById('mlTopPct') as HTMLInputElement;
  const topPctVal = document.getElementById('mlTopPctVal') as HTMLElement;
  const targetCountInline = document.getElementById('mlTargetCountInline') as HTMLElement;
  const offerSelect = document.getElementById('mlOfferSelect') as HTMLSelectElement;
  const summaryEl = document.getElementById('mlTargetSummary') as HTMLElement;
  const searchInput = document.getElementById('mlSearch') as HTMLInputElement;
  const downloadCsvBtn = document.getElementById('mlDownloadCsvBtn') as HTMLButtonElement;
  const downloadPyBtn = document.getElementById('mlDownloadPyBtn') as HTMLButtonElement;

  let ml: TelcoMlResult;
  try {
    ml = trainTelcoMlModels(DATA.rawRows);
  } catch (err) {
    summaryEl.textContent = `ML pipeline error: ${err instanceof Error ? err.message : 'Training failed'}`;
    return null;
  }

  let selectedModel: 'gb' | 'logreg' | 'both' = 'gb';
  let curveMode: 'lift' | 'gains' | 'uplift' = 'lift';
  let topPct = 20;
  let offerKey: CampaignOfferKey = 'contract_security';
  let rankStrategy: 'uplift' | 'risk' | 'persuadable' = 'uplift';
  let segFilter = 'All';
  let searchQuery = '';
  let debounceTimer: number | undefined;

  const getProb = (c: ScoredCustomer): number => {
    if (selectedModel === 'gb') return c.probGb;
    if (selectedModel === 'logreg') return c.probLogReg;
    return c.probEnsemble;
  };

  const getUplift = (c: ScoredCustomer): number => {
    if (selectedModel === 'gb') return c.upliftGb[offerKey];
    if (selectedModel === 'logreg') return c.upliftLogReg[offerKey];
    return 0.5 * (c.upliftGb[offerKey] + c.upliftLogReg[offerKey]);
  };

  const getOffer = () => CAMPAIGN_OFFERS.find((o) => o.key === offerKey) || CAMPAIGN_OFFERS[0];

  function classifyQuadrant(prob: number, uplift: number): { label: string; cls: string } {
    if (uplift >= 0.14) return { label: 'Persuadable', cls: 'ml-quad-persuadable' };
    if (prob >= 0.45 && uplift < 0.14) return { label: 'High-Risk Lock', cls: 'ml-quad-high' };
    if (prob < 0.15) return { label: 'Sure Thing', cls: 'ml-quad-base' };
    return { label: 'Moderate Base', cls: 'ml-quad-base' };
  }

  function getTargetCohort(applyViewFilters: boolean) {
    const offer = getOffer();
    const totalN = ml.customers.length;
    const cutoffCount = Math.max(1, Math.round((totalN * topPct) / 100));

    let pool = ml.customers.map((c) => {
      const prob = getProb(c);
      const uplift = getUplift(c);
      const netRoi12m = c.monthlyCharges * 12 * uplift - offer.monthlyIncentiveCost * 12;
      const quad = classifyQuadrant(prob, uplift);
      return {
        customer: c,
        prob,
        uplift,
        netRoi12m,
        quad,
      };
    });

    if (rankStrategy === 'persuadable') {
      pool = pool.filter((item) => item.uplift >= 0.12 && item.netRoi12m > 0);
      pool.sort((a, b) => b.netRoi12m - a.netRoi12m);
    } else if (rankStrategy === 'risk') {
      pool.sort((a, b) => b.prob - a.prob || b.uplift - a.uplift);
    } else {
      pool.sort((a, b) => b.uplift - a.uplift || b.netRoi12m - a.netRoi12m);
    }

    const sliced = pool.slice(0, Math.min(cutoffCount, pool.length));
    if (!applyViewFilters) return sliced;

    const q = searchQuery.trim().toLowerCase();
    return sliced.filter((item) => {
      const c = item.customer;
      if (segFilter === 'Month-to-month' && c.contract !== 'Month-to-month') return false;
      if (segFilter === 'Fiber optic' && c.internet !== 'Fiber optic') return false;
      if (segFilter === 'Electronic check' && c.payment !== 'Electronic check') return false;
      if (!q) return true;
      return (
        c.customerID.toLowerCase().includes(q) ||
        c.contract.toLowerCase().includes(q) ||
        c.internet.toLowerCase().includes(q) ||
        c.payment.toLowerCase().includes(q) ||
        item.quad.label.toLowerCase().includes(q)
      );
    });
  }

  function updateKpiStrip() {
    const activeKey = selectedModel === 'logreg' ? 'logreg' : 'gb';
    const m = ml.models[activeKey];
    const other = ml.models[activeKey === 'gb' ? 'logreg' : 'gb'];
    if (aucReadout && aucSub) {
      aucReadout.textContent = selectedModel === 'both' ? `${fmt(ml.models.gb.rocAuc, 3)} / ${fmt(ml.models.logreg.rocAuc, 3)}` : fmt(m.rocAuc, 3);
      aucSub.textContent =
        selectedModel === 'both'
          ? `GB vs LogReg holdout AUC (n = ${fmt(ml.testCount)})`
          : `${m.name} · PR-AUC ${fmt(m.prAuc, 3)} · vs ${fmt(other.rocAuc, 3)}`;
    }
    if (liftReadout && liftSub) {
      const idx = Math.max(0, Math.min(9, Math.round(topPct / 10) - 1));
      const dec = ml.deciles[activeKey][idx];
      liftReadout.textContent = `${fmt(m.topDecileLift, 2)}×`;
      liftSub.textContent = `Top ${topPct}% cum. lift ${fmt(dec.cumLift, 2)}× (${fmt(dec.cumCapture, 1)}% capture)`;
    }

    const cohort = getTargetCohort(false);
    const totalSaves = cohort.reduce((a, b) => a + b.uplift, 0);
    const totalNetRoi = cohort.reduce((a, b) => a + b.netRoi12m, 0);
    if (roiReadout && roiSub) {
      const kRoi = totalNetRoi / 1000;
      roiReadout.textContent = `${kRoi >= 0 ? '+' : '−'}$${fmt(Math.abs(kRoi), 1)}k`;
      roiSub.textContent = `${fmt(Math.round(totalSaves))} expected saves across ${fmt(cohort.length)} accounts`;
    }
  }

  // Chart 11A: Cumulative Lift / Gains / Uplift Curve
  const svgCurve = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'mlCurveTitle mlCurveDesc',
  });
  svgCurve.appendChild(svg('title', { id: 'mlCurveTitle', text: 'ML Churn Lift, Gains, and Uplift Curve' }));
  svgCurve.appendChild(svg('desc', { id: 'mlCurveDesc', text: 'Out-of-sample model lift, cumulative gains, and counterfactual campaign uplift across customer deciles.' }));
  const cGrid = svg('g');
  const cLines = svg('g');
  const cDots = svg('g');
  svgCurve.appendChild(cGrid);
  svgCurve.appendChild(cLines);
  svgCurve.appendChild(cDots);
  curveHost.innerHTML = '';
  curveHost.appendChild(svgCurve);

  const cap11a = renderFigureCaption('cap11a', {
    fig: 'FIG. 11A',
    caption: 'Holdout decile Lift, Cumulative Gains, and Counterfactual Uplift curve across targeting depth (n = 7,043; holdout n = 1,407).',
    source: 'Source: Telco-Customer-Churn.csv · 80/20 stratified holdout',
    cols: [
      { label: 'Target Depth (%)', num: true },
      { label: 'GB Cum. Lift (×)', num: true },
      { label: 'LogReg Cum. Lift (×)', num: true },
      { label: 'GB Capture (%)', num: true },
      { label: 'Uplift Saves (n)', num: true },
    ],
    getRows: () => {
      const activeKey = selectedModel === 'logreg' ? 'logreg' : 'gb';
      const uCurve = ml.upliftCurves[activeKey][offerKey];
      return ml.deciles.gb.map((d, i) => [
        `${d.pctPop} %`,
        `${fmt(d.cumLift, 2)}×`,
        `${fmt(ml.deciles.logreg[i].cumLift, 2)}×`,
        `${fmt(d.cumCapture, 1)} %`,
        fmt(uCurve[i + 1]?.upliftIncrementalSaves ?? 0),
      ]);
    },
  });

  function drawCurve() {
    const w = Math.max(280, curveHost!.clientWidth || 540);
    const h = 340;
    const padL = 52;
    const padR = 18;
    const padT = 30;
    const padB = 42;
    svgCurve.setAttribute('viewBox', `0 0 ${w} ${h}`);
    cGrid.innerHTML = '';
    cLines.innerHTML = '';
    cDots.innerHTML = '';

    const xMin = curveMode === 'lift' ? 10 : 0;
    const xScale = scaleLinear(xMin, 100, padL, w - padR);
    const gbDec = ml.deciles.gb;
    const lrDec = ml.deciles.logreg;
    const activeKey = selectedModel === 'logreg' ? 'logreg' : 'gb';
    const upPts = ml.upliftCurves[activeKey][offerKey];

    let yMax = 3.5;
    let yTicks: number[] = [0, 1, 2, 3];
    let yLabel = 'Cumulative Lift (×)';
    if (curveMode === 'gains') {
      yMax = 100;
      yTicks = [0, 25, 50, 75, 100];
      yLabel = 'Churners Captured (%)';
    } else if (curveMode === 'uplift') {
      const maxU = Math.max(100, ...upPts.map((p) => Math.max(p.upliftIncrementalSaves, p.riskIncrementalSaves)));
      yMax = Math.ceil(maxU / 200) * 200;
      yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];
      yLabel = 'Expected Incremental Saves (accounts)';
    } else {
      yMax = Math.max(3.2, Math.ceil(Math.max(gbDec[0].cumLift, lrDec[0].cumLift) * 2) / 2);
      yTicks = [0, 1, 2, 3];
    }
    const yScale = scaleLinear(0, yMax, h - padB, padT);

    // Highlight selected campaign cutoff band (0..topPct%)
    const cutX = xScale(topPct);
    cGrid.appendChild(
      svg('rect', {
        x: padL,
        y: padT,
        width: Math.max(0, cutX - padL),
        height: h - padB - padT,
        fill: 'var(--violet-100)',
        opacity: '0.55',
      })
    );

    yTicks.forEach((t) => {
      const y = yScale(t);
      cGrid.appendChild(svg('line', { x1: padL, y1: y, x2: w - padR, y2: y, stroke: t === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': t === 0 ? 1.5 : 1 }));
      const lbl = curveMode === 'lift' ? `${t.toFixed(1)}×` : curveMode === 'gains' ? `${t}%` : fmt(t);
      cGrid.appendChild(svg('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'svg-micro', text: lbl }));
    });

    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach((t) => {
      const x = xScale(t);
      cGrid.appendChild(svg('line', { x1: x, y1: padT, x2: x, y2: h - padB, stroke: 'var(--rule)', 'stroke-width': 1, opacity: '0.55' }));
      if (t % 20 === 0 || t === 10 || t === 100) {
        cGrid.appendChild(svg('text', { x, y: h - 22, 'text-anchor': 'middle', class: 'svg-micro', text: `${t}%` }));
      }
    });

    cGrid.appendChild(svg('text', { x: padL, y: 12, class: 'svg-micro', text: yLabel }));
    cGrid.appendChild(svg('text', { x: w - padR, y: h - 4, 'text-anchor': 'end', class: 'svg-micro', text: 'Customer Base Targeted (%) →' }));

    // Cutoff line
    cGrid.appendChild(svg('line', { x1: cutX, y1: padT, x2: cutX, y2: h - padB, stroke: 'var(--violet-ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
    cGrid.appendChild(svg('text', { x: cutX + 5, y: padT + 12, class: 'svg-micro', style: 'fill:var(--violet-ink);font-weight:600;', text: `Top ${topPct}%` }));

    // Random baseline
    if (curveMode === 'lift') {
      const y1 = yScale(1);
      cLines.appendChild(svg('line', { x1: xScale(10), y1, x2: xScale(100), y2: y1, stroke: 'var(--ink-3)', 'stroke-width': 1.25, 'stroke-dasharray': '5 4' }));
    } else if (curveMode === 'gains') {
      cLines.appendChild(svg('line', { x1: xScale(0), y1: yScale(0), x2: xScale(100), y2: yScale(100), stroke: 'var(--ink-3)', 'stroke-width': 1.25, 'stroke-dasharray': '5 4' }));
    } else {
      const lastRand = upPts[upPts.length - 1]?.randomIncrementalSaves ?? 0;
      cLines.appendChild(svg('line', { x1: xScale(0), y1: yScale(0), x2: xScale(100), y2: yScale(lastRand), stroke: 'var(--ink-3)', 'stroke-width': 1.25, 'stroke-dasharray': '5 4' }));
    }

    const drawSeries = (pts: Array<{ x: number; y: number }>, color: string, dashed = false) => {
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`).join(' ');
      cLines.appendChild(
        svg('path', {
          d,
          fill: 'none',
          stroke: color,
          'stroke-width': 2.5,
          'stroke-dasharray': dashed ? '6 4' : null,
        })
      );
    };

    const legendItems: Array<{ label: string; color: string; dashed?: boolean }> = [];

    if (curveMode === 'uplift') {
      drawSeries(upPts.map((p) => ({ x: p.pctPop, y: p.upliftIncrementalSaves })), 'var(--violet)');
      drawSeries(upPts.map((p) => ({ x: p.pctPop, y: p.riskIncrementalSaves })), 'var(--vermilion)', true);
      legendItems.push({ label: `${activeKey === 'gb' ? 'GB' : 'LogReg'} Uplift Ranking`, color: 'var(--violet)' });
      legendItems.push({ label: 'Churn-Risk Ranking', color: 'var(--vermilion)', dashed: true });
      legendItems.push({ label: 'Random Targeting', color: 'var(--ink-3)', dashed: true });

      upPts.slice(1).forEach((p) => {
        const cx = xScale(p.pctPop);
        const cy = yScale(p.upliftIncrementalSaves);
        const dot = svg('rect', {
          x: cx - 4,
          y: cy - 4,
          width: 8,
          height: 8,
          fill: 'var(--violet)',
          tabindex: 0,
          role: 'img',
          'aria-label': `Top ${p.pctPop}%: ${p.upliftIncrementalSaves} incremental saves via uplift vs ${p.riskIncrementalSaves} via risk`,
          style: 'cursor:pointer;',
        });
        const info = {
          cat: `Uplift Curve · Top ${p.pctPop}%`,
          val: `${fmt(p.upliftIncrementalSaves)} saved accounts`,
          sub: `Risk-only: ${fmt(p.riskIncrementalSaves)} saved · Random: ${fmt(p.randomIncrementalSaves)} saved`,
        };
        dot.addEventListener('pointerenter', (e) => tt.show(dot, info, e));
        dot.addEventListener('pointermove', (e) => tt.show(dot, info, e));
        dot.addEventListener('pointerleave', tt.hide);
        dot.addEventListener('focus', () => tt.show(dot, info));
        dot.addEventListener('blur', tt.hide);
        cDots.appendChild(dot);
      });
    } else {
      const mapMetric = (d: (typeof gbDec)[number]) => (curveMode === 'lift' ? d.cumLift : d.cumCapture);
      if (selectedModel === 'gb' || selectedModel === 'both') {
        const pts = (curveMode === 'gains' ? [{ x: 0, y: 0 }] : []).concat(gbDec.map((d) => ({ x: d.pctPop, y: mapMetric(d) })));
        drawSeries(pts, 'var(--vermilion)');
        legendItems.push({ label: 'Gradient Boosting', color: 'var(--vermilion)' });
      }
      if (selectedModel === 'logreg' || selectedModel === 'both') {
        const pts = (curveMode === 'gains' ? [{ x: 0, y: 0 }] : []).concat(lrDec.map((d) => ({ x: d.pctPop, y: mapMetric(d) })));
        drawSeries(pts, 'var(--violet)', selectedModel === 'both');
        legendItems.push({ label: 'Logistic Regression', color: 'var(--violet)', dashed: selectedModel === 'both' });
      }
      legendItems.push({ label: curveMode === 'lift' ? 'Random (1.0×)' : 'Random Baseline', color: 'var(--ink-3)', dashed: true });

      const activeDecs = selectedModel === 'logreg' ? lrDec : gbDec;
      activeDecs.forEach((d, idx) => {
        const val = mapMetric(d);
        const cx = xScale(d.pctPop);
        const cy = yScale(val);
        const col = selectedModel === 'logreg' ? 'var(--violet)' : 'var(--vermilion)';
        const dot = svg('rect', {
          x: cx - 4,
          y: cy - 4,
          width: 8,
          height: 8,
          fill: col,
          tabindex: 0,
          role: 'img',
          'aria-label': `Decile ${d.decile} (Top ${d.pctPop}%): Cum Lift ${d.cumLift}x, Cum Capture ${d.cumCapture}%`,
          style: 'cursor:pointer;',
        });
        const info = {
          cat: `Top ${d.pctPop}% (Decile ${d.decile})`,
          val: curveMode === 'lift' ? `${fmt(d.cumLift, 2)}× cum. lift` : `${fmt(d.cumCapture, 1)}% churn captured`,
          sub: `Decile rate: ${fmt(d.churnRate, 1)}% · GB ${fmt(gbDec[idx].cumLift, 2)}× vs LogReg ${fmt(lrDec[idx].cumLift, 2)}×`,
        };
        dot.addEventListener('pointerenter', (e) => tt.show(dot, info, e));
        dot.addEventListener('pointermove', (e) => tt.show(dot, info, e));
        dot.addEventListener('pointerleave', tt.hide);
        dot.addEventListener('focus', () => tt.show(dot, info));
        dot.addEventListener('blur', tt.hide);
        cDots.appendChild(dot);
      });
    }

    // Inline top-right SVG legend
    let lx = w - padR;
    for (let i = legendItems.length - 1; i >= 0; i--) {
      const item = legendItems[i];
      const textWidth = item.label.length * 6.2 + 22;
      lx -= textWidth;
      if (lx < padL + 80) break;
      cGrid.appendChild(
        svg('line', {
          x1: lx,
          y1: 9,
          x2: lx + 14,
          y2: 9,
          stroke: item.color,
          'stroke-width': item.dashed ? 1.5 : 2.5,
          'stroke-dasharray': item.dashed ? '4 3' : null,
        })
      );
      cGrid.appendChild(svg('text', { x: lx + 18, y: 12, class: 'svg-micro', text: item.label }));
    }
  }

  // Chart 11B: Top 7 Feature Drivers Horizontal Comparison
  const svgDrivers = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'mlDriverTitle mlDriverDesc',
  });
  svgDrivers.appendChild(svg('title', { id: 'mlDriverTitle', text: 'Top ML Feature Importances and Log-Odds' }));
  svgDrivers.appendChild(svg('desc', { id: 'mlDriverDesc', text: 'Top churn predictors ranked by Gradient Boosting split gain alongside Logistic Regression log-odds direction.' }));
  const dGrid = svg('g');
  svgDrivers.appendChild(dGrid);
  driverHost.innerHTML = '';
  driverHost.appendChild(svgDrivers);

  const topDrivers = ml.featureDrivers.slice(0, 7);
  renderFigureCaption('cap11b', {
    fig: 'FIG. 11B',
    caption: 'Top 7 predictive features by Gradient Boosting gain (%) paired with L2 Logistic Regression standardized log-odds.',
    source: 'Source: Telco-Customer-Churn.csv · Standardized train split',
    cols: [
      { label: 'Feature', num: false },
      { label: 'GB Gain (%)', num: true },
      { label: 'LogReg β', num: true },
      { label: 'Odds Ratio', num: true },
    ],
    rows: topDrivers.map((d) => [
      d.feature,
      `${fmt(d.gbImportance, 1)} %`,
      `${d.logRegCoef >= 0 ? '+' : '−'}${fmt(Math.abs(d.logRegCoef), 2)}`,
      `${fmt(d.oddsRatio, 2)}×`,
    ]),
  });

  function drawDrivers() {
    const w = Math.max(260, driverHost!.clientWidth || 440);
    const rowH = 30;
    const h = topDrivers.length * rowH + 22;
    const labelW = w < 400 ? 132 : 165;
    const rightPad = 76;
    const maxImp = Math.max(20, ...topDrivers.map((d) => d.gbImportance));
    const xScale = scaleLinear(0, maxImp, labelW, w - rightPad);

    svgDrivers.setAttribute('viewBox', `0 0 ${w} ${h}`);
    dGrid.innerHTML = '';

    topDrivers.forEach((d, idx) => {
      const y = idx * rowH + 6;
      const barW = Math.max(3, xScale(d.gbImportance) - labelW);
      const color = d.direction === 'risk' ? 'var(--vermilion)' : 'var(--violet)';
      const textColor = d.direction === 'risk' ? 'var(--vermilion-ink)' : 'var(--violet-ink)';

      const g = svg('g', { tabindex: 0, role: 'img', 'aria-label': `${d.feature}: ${d.gbImportance}% GB gain, LogReg beta ${d.logRegCoef}`, style: 'cursor:pointer;' });
      g.appendChild(svg('rect', { x: 0, y, width: w, height: rowH, fill: 'transparent' }));
      g.appendChild(svg('text', { x: 0, y: y + 18, class: 'svg-label', style: 'font-size:12px;', text: d.feature }));
      g.appendChild(svg('rect', { x: labelW, y: y + 7, width: barW, height: 12, fill: color }));
      g.appendChild(
        svg('text', {
          x: w,
          y: y + 17,
          'text-anchor': 'end',
          class: 'svg-micro',
          style: `fill:${textColor};font-weight:500;`,
          text: `${fmt(d.gbImportance, 1)}% · β ${d.logRegCoef >= 0 ? '+' : '−'}${fmt(Math.abs(d.logRegCoef), 2)}`,
        })
      );

      const info = {
        cat: d.feature,
        val: `${fmt(d.gbImportance, 1)} % GB importance`,
        sub: `LogReg β = ${d.logRegCoef >= 0 ? '+' : '−'}${fmt(Math.abs(d.logRegCoef), 2)} (Odds ratio ${fmt(d.oddsRatio, 2)}× · ${d.direction})`,
      };
      g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
      g.addEventListener('pointermove', (e) => tt.show(g, info, e));
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('focus', () => tt.show(g, info));
      g.addEventListener('blur', tt.hide);
      dGrid.appendChild(g);
    });
  }

  // Chart 11C: Management Campaign Target List Table
  function drawTargetTable() {
    const offer = getOffer();
    const cohort = getTargetCohort(true);
    const totalExpectedSaves = cohort.reduce((a, b) => a + b.uplift, 0);
    const protectedMrr = cohort.reduce((a, b) => a + b.customer.monthlyCharges * b.uplift, 0);
    const totalNetRoi = cohort.reduce((a, b) => a + b.netRoi12m, 0);

    summaryEl.textContent = `Targeting ${fmt(cohort.length)} accounts (Top ${topPct}% · ${offer.shortLabel}) · Est. Saves: ${fmt(Math.round(totalExpectedSaves))} · Protected MRR: $${fmt(protectedMrr / 1000, 1)}k/mo · 12m Net ROI: ${totalNetRoi >= 0 ? '+' : '−'}$${fmt(Math.abs(totalNetRoi / 1000), 1)}k`;

    if (cohort.length === 0) {
      const empty = el('div', { class: 'empty-state' }, [
        el('span', { text: 'No customer accounts match the current filter and target criteria.' }),
        el('button', { type: 'button', class: 'fig-table-btn', text: 'Reset target filters' }),
      ]);
      empty.querySelector('button')?.addEventListener('click', () => {
        searchQuery = '';
        searchInput.value = '';
        segFilter = 'All';
        rankStrategy = 'uplift';
        document.querySelectorAll('[data-ml-seg]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-ml-seg') === 'All')));
        document.querySelectorAll('[data-ml-rank]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-ml-rank') === 'uplift')));
        drawTargetTable();
      });
      tableHost!.innerHTML = '';
      tableHost!.appendChild(empty);
      return;
    }

    const displayLimit = 120;
    const shown = cohort.slice(0, displayLimit);

    const scrollRegion = el('div', {
      class: 'market-table-scroll',
      tabindex: 0,
      role: 'region',
      'aria-label': 'Prioritized campaign target customers',
    });

    const thead = el(
      'thead',
      {},
      el('tr', {}, [
        el('th', { class: 'is-num', scope: 'col', text: 'Rank' }),
        el('th', { scope: 'col', text: 'Customer ID' }),
        el('th', { scope: 'col', text: 'Contract & Service Profile' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Tenure' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Monthly ($)' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Churn Prob' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Uplift (+pp)' }),
        el('th', { scope: 'col', text: 'Quadrant' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Est. 12m Net' }),
      ])
    );

    const tbody = el(
      'tbody',
      {},
      shown.map((item, idx) => {
        const c = item.customer;
        const probPct = item.prob * 100;
        const upliftPp = item.uplift * 100;
        const roiRound = Math.round(item.netRoi12m);
        return el('tr', {}, [
          el('td', { class: 'is-num', style: 'color:var(--ink-3);', text: `#${idx + 1}` }),
          el('td', { style: 'font-family:var(--font-mono);font-size:12.5px;font-weight:500;', text: c.customerID }),
          el('td', { style: 'color:var(--ink-2);', text: `${c.contract} · ${c.internet} · ${c.payment}` }),
          el('td', { class: 'is-num', text: `${c.tenure} mo` }),
          el('td', { class: 'is-num', text: `$${fmt(c.monthlyCharges, 2)}` }),
          el(
            'td',
            { class: 'is-num' },
            el('span', { class: 'inline-bar-cell' }, [
              el('span', { class: 'inline-bar-track', 'aria-hidden': 'true' }, el('span', { class: 'inline-bar-fill', style: `width:${Math.min(100, probPct)}%` })),
              el('span', { text: `${fmt(probPct, 1)}%` }),
            ])
          ),
          el('td', { class: 'is-num', style: 'color:var(--violet-ink);font-weight:600;', text: `+${fmt(upliftPp, 1)} pp` }),
          el('td', { class: item.quad.cls, text: item.quad.label }),
          el('td', {
            class: 'is-num',
            style: roiRound >= 0 ? 'color:var(--ink);font-weight:500;' : 'color:var(--vermilion-ink);',
            text: `${roiRound >= 0 ? '+' : '−'}$${fmt(Math.abs(roiRound))}`,
          }),
        ]);
      })
    );

    scrollRegion.appendChild(el('table', { class: 'data-table' }, [thead, tbody]));
    tableHost!.innerHTML = '';
    tableHost!.appendChild(scrollRegion);

    if (cohort.length > displayLimit) {
      tableHost!.appendChild(
        el('p', {
          class: 'mono-meta',
          style: 'margin-top:var(--s-2);',
          text: `Showing top ${displayLimit} priority rows in browser view. Click "Download Target CSV ↓" to export all ${fmt(cohort.length)} targeted customers.`,
        })
      );
    }
  }

  function refreshAll() {
    targetCountInline.textContent = fmt(Math.round((ml.customers.length * topPct) / 100));
    updateKpiStrip();
    drawCurve();
    cap11a.refreshTable();
    drawTargetTable();
  }

  // Event listeners
  document.querySelectorAll('[data-ml-model]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedModel = (btn.getAttribute('data-ml-model') || 'gb') as typeof selectedModel;
      document.querySelectorAll('[data-ml-model]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      refreshAll();
    });
  });

  document.querySelectorAll('[data-ml-curve]').forEach((btn) => {
    btn.addEventListener('click', () => {
      curveMode = (btn.getAttribute('data-ml-curve') || 'lift') as typeof curveMode;
      document.querySelectorAll('[data-ml-curve]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      drawCurve();
    });
  });

  topPctSlider.addEventListener('input', () => {
    topPct = parseInt(topPctSlider.value, 10);
    topPctVal.textContent = String(topPct);
    refreshAll();
  });

  offerSelect.addEventListener('change', () => {
    offerKey = offerSelect.value as CampaignOfferKey;
    refreshAll();
  });

  document.querySelectorAll('[data-ml-rank]').forEach((btn) => {
    btn.addEventListener('click', () => {
      rankStrategy = (btn.getAttribute('data-ml-rank') || 'uplift') as typeof rankStrategy;
      document.querySelectorAll('[data-ml-rank]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      drawTargetTable();
    });
  });

  document.querySelectorAll('[data-ml-seg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      segFilter = btn.getAttribute('data-ml-seg') || 'All';
      document.querySelectorAll('[data-ml-seg]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      drawTargetTable();
    });
  });

  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      searchQuery = searchInput.value;
      drawTargetTable();
    }, 120);
  });

  downloadCsvBtn.addEventListener('click', () => {
    const offer = getOffer();
    const cohort = getTargetCohort(true);
    const header = [
      'Rank',
      'customerID',
      'Contract',
      'InternetService',
      'PaymentMethod',
      'TenureMonths',
      'MonthlyCharges',
      'ChurnProb_GB',
      'ChurnProb_LogReg',
      'ExpectedUplift_pp',
      'Quadrant',
      'RecommendedOffer',
      'Est_12m_NetROI_USD',
    ];
    const lines = [header.join(',')].concat(
      cohort.map((item, idx) => {
        const c = item.customer;
        return [
          idx + 1,
          c.customerID,
          `"${c.contract}"`,
          `"${c.internet}"`,
          `"${c.payment}"`,
          c.tenure,
          c.monthlyCharges.toFixed(2),
          (c.probGb * 100).toFixed(2),
          (c.probLogReg * 100).toFixed(2),
          (item.uplift * 100).toFixed(2),
          `"${item.quad.label}"`,
          `"${offer.shortLabel}"`,
          item.netRoi12m.toFixed(2),
        ].join(',');
      })
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telco-campaign-targets-top${topPct}pct.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  downloadPyBtn.addEventListener('click', () => {
    const scriptText = generateSklearnPipelineScript(offerKey);
    const blob = new Blob([scriptText], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'telco_churn_sklearn_pipeline.py';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const roCurve = new ResizeObserver(() => requestAnimationFrame(drawCurve));
  roCurve.observe(curveHost);
  const roDrv = new ResizeObserver(() => requestAnimationFrame(drawDrivers));
  roDrv.observe(driverHost);

  drawDrivers();
  refreshAll();
  return ml;
}

function renderChurnValueVsVolume(DATA: TelcoDashboardData, tt: ReturnType<typeof initTooltip>) {
  const host = document.getElementById('chart02v') as HTMLElement | null;
  if (!host) return { reveal: () => {} };

  type VvDim = 'internet' | 'spend' | 'contract';
  let dim: VvDim = 'internet';
  let revealed = REDUCED_MOTION;

  const svgEl = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'vvTitle vvDesc',
  });
  svgEl.appendChild(svg('title', { id: 'vvTitle', text: 'Churn Value vs Churn Volume paired comparison' }));
  svgEl.appendChild(svg('desc', { id: 'vvDesc', text: 'Paired horizontal bars comparing each segment share of churned accounts against share of lost monthly recurring revenue.' }));

  const gGrid = svg('g');
  const gRows = svg('g');
  svgEl.appendChild(gGrid);
  svgEl.appendChild(gRows);

  const legend = el('div', { class: 'hm-ramp', style: 'margin-top:0;margin-bottom:var(--s-2);' }, [
    el('span', { class: 'hm-ramp-item' }, [el('span', { class: 'hm-ramp-box', style: 'background:var(--violet);' }), document.createTextNode('Churn Volume (% of 1,869 exits)')]),
    el('span', { class: 'hm-ramp-item' }, [el('span', { class: 'hm-ramp-box', style: 'background:var(--vermilion);' }), document.createTextNode('Churn Value (% of $139.1k MRR)')]),
  ]);

  host.innerHTML = '';
  host.appendChild(legend);
  host.appendChild(svgEl);

  const capApi = renderFigureCaption('cap02v', {
    fig: 'FIG. 02C',
    caption: 'Share of churned subscriber count (Volume) vs share of lost monthly revenue (Value) with value-skew gap (pp).',
    cols: [
      { label: 'Segment', num: false },
      { label: 'Exits (n)', num: true },
      { label: 'Vol. Share (%)', num: true },
      { label: 'Lost MRR ($)', num: true },
      { label: 'Val. Share (%)', num: true },
      { label: 'Skew (pp)', num: true },
    ],
    getRows: () =>
      DATA.churnValueVsVolume[dim].map((r) => [
        r.label,
        fmt(r.churnedCount),
        `${fmt(r.volumeShare, 1)} %`,
        `$${fmt(r.churnMrr)}`,
        `${fmt(r.valueShare, 1)} %`,
        `${r.skewPp >= 0 ? '+' : '−'}${fmt(Math.abs(r.skewPp), 1)} pp`,
      ]),
  });

  function layout() {
    const rows = DATA.churnValueVsVolume[dim];
    const w = Math.max(260, host!.clientWidth || 460);
    const stacked = w < 440;
    const labelW = stacked ? 0 : 126;
    const rightW = stacked ? 0 : 72;
    const plotL = stacked ? 2 : labelW;
    const plotR = stacked ? w - 8 : w - rightW;
    const xScale = scaleLinear(0, 100, plotL, plotR);

    const rowH = stacked ? 58 : 44;
    const topPad = 6;
    const h = topPad + rows.length * rowH + 26;

    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gGrid.innerHTML = '';
    gRows.innerHTML = '';

    [0, 25, 50, 75, 100].forEach((tick) => {
      const x = xScale(tick);
      gGrid.appendChild(svg('line', { x1: x, y1: topPad, x2: x, y2: h - 22, stroke: tick === 0 ? 'var(--ink)' : 'var(--rule)', 'stroke-width': tick === 0 ? 1.5 : 1 }));
      gGrid.appendChild(svg('text', { x, y: h - 5, 'text-anchor': 'middle', class: 'svg-micro', text: `${tick}%` }));
    });

    rows.forEach((r, idx) => {
      const y = topPad + idx * rowH;
      const barY1 = stacked ? y + 20 : y + 7;
      const barY2 = stacked ? y + 34 : y + 21;
      const barH = 11;
      const wVol = Math.max(2, xScale(r.volumeShare) - plotL);
      const wVal = Math.max(2, xScale(r.valueShare) - plotL);
      const skewColor = r.skewPp >= 0 ? 'var(--vermilion-ink)' : 'var(--violet-ink)';
      const skewStr = `${r.skewPp >= 0 ? '+' : '−'}${fmt(Math.abs(r.skewPp), 1)} pp`;

      const g = svg('g', {
        tabindex: 0,
        role: 'img',
        'aria-label': `${r.label}: ${r.volumeShare}% of churn volume (${r.churnedCount} exits) vs ${r.valueShare}% of churn value ($${fmt(r.churnMrr)} MRR)`,
        style: 'cursor:pointer;',
      });

      g.appendChild(svg('rect', { x: 0, y, width: w, height: rowH, fill: 'transparent' }));
      g.appendChild(svg('text', { x: 0, y: stacked ? y + 14 : y + 23, class: 'svg-label', style: 'font-size:12.5px;', text: r.label }));

      const barsG = svg('g', {
        style: `transform-origin:${plotL}px ${(barY1 + barY2 + barH) / 2}px;transform:scaleX(${revealed ? 1 : 0});transition:transform var(--d-3) var(--ease-out);transition-delay:${REDUCED_MOTION ? 0 : idx * 60}ms;`,
      });
      barsG.appendChild(svg('rect', { x: plotL, y: barY1, width: wVol, height: barH, fill: 'var(--violet)' }));
      barsG.appendChild(svg('rect', { x: plotL, y: barY2, width: wVal, height: barH, fill: 'var(--vermilion)' }));
      g.appendChild(barsG);

      g.appendChild(
        svg('text', {
          x: w,
          y: stacked ? y + 14 : y + 23,
          'text-anchor': 'end',
          class: 'svg-micro',
          style: `fill:${skewColor};font-weight:600;`,
          text: `${skewStr} val`,
        })
      );

      const info = {
        cat: `${r.label} · Value vs Volume`,
        val: `${fmt(r.valueShare, 1)}% Value vs ${fmt(r.volumeShare, 1)}% Volume`,
        sub: `$${fmt(r.churnMrr)}/mo lost across ${fmt(r.churnedCount)} exits ($${fmt(r.avgChurnedArpu, 1)}/mo avg · ${skewStr} skew)`,
      };
      g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
      g.addEventListener('pointermove', (e) => tt.show(g, info, e));
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('focus', () => tt.show(g, info));
      g.addEventListener('blur', tt.hide);

      gRows.appendChild(g);
    });
  }

  document.querySelectorAll('[data-vv-dim]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dim = (btn.getAttribute('data-vv-dim') || 'internet') as VvDim;
      document.querySelectorAll('[data-vv-dim]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layout();
      capApi.refreshTable();
    });
  });

  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(host);
  layout();

  return {
    reveal: () => {
      revealed = true;
      layout();
    },
  };
}

function renderPsmSection(
  DATA: TelcoDashboardData,
  tt: ReturnType<typeof initTooltip>
): (() => PsmStudyResult) | null {
  const diagHost = document.getElementById('chart12a') as HTMLElement | null;
  const decompHost = document.getElementById('chart12b') as HTMLElement | null;
  const auditHost = document.getElementById('chart12c') as HTMLElement | null;
  if (!diagHost || !decompHost || !auditHost) return null;

  const pairsReadout = document.getElementById('psmPairsReadout');
  const pairsSub = document.getElementById('psmPairsSub');
  const attReadout = document.getElementById('psmAttReadout');
  const attSub = document.getElementById('psmAttSub');
  const roiReadout = document.getElementById('psmRoiReadout');
  const roiSub = document.getElementById('psmRoiSub');
  const gammaReadout = document.getElementById('psmGammaReadout');
  const gammaSub = document.getElementById('psmGammaSub');

  const costSlider = document.getElementById('psmCostSlider') as HTMLInputElement | null;
  const costVal = document.getElementById('psmCostVal');
  const summaryLine = document.getElementById('psmSummaryLine');
  const downloadBtn = document.getElementById('psmDownloadPairsBtn') as HTMLButtonElement | null;
  const citationsGrid = document.getElementById('psmCitationsGrid');
  const tkChurnTitle = document.getElementById('psmTakeawayChurnTitle');
  const tkChurnBody = document.getElementById('psmTakeawayChurnBody');
  const tkRoiTitle = document.getElementById('psmTakeawayRoiTitle');
  const tkRoiBody = document.getElementById('psmTakeawayRoiBody');
  const tkGammaTitle = document.getElementById('psmTakeawayGammaTitle');
  const tkGammaBody = document.getElementById('psmTakeawayGammaBody');

  let specKey: PsmSpecKey = 'full';
  let caliperMultiplier = 0.2;
  let campaignCost = 150;
  let viewMode: 'love' | 'gamma' | 'overlap' = 'love';
  let result: PsmStudyResult = runFiberPsmStudy(DATA.rawRows, {
    specKey,
    caliperMultiplier,
    campaignCostPerUpgrade: campaignCost,
  });

  if (citationsGrid) {
    citationsGrid.innerHTML = '';
    ROSENBAUM_CITATIONS.forEach((c) => {
      citationsGrid.appendChild(
        el('article', { class: 'psm-cite-item' }, [
          el('div', { class: 'psm-cite-head', text: `${c.authors} (${c.year}). ${c.title}.` }),
          el('div', { class: 'psm-cite-venue', text: c.venue }),
          el('p', { class: 'psm-cite-note', text: c.concept }),
        ])
      );
    });
  }

  const svgDiag = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'psmDiagTitle psmDiagDesc',
  });
  svgDiag.appendChild(svg('title', { id: 'psmDiagTitle', text: 'Propensity Score Matching Diagnostics' }));
  svgDiag.appendChild(svg('desc', { id: 'psmDiagDesc', text: 'Covariate balance Love plot, Rosenbaum sensitivity Gamma bounds, and propensity score common-support overlap.' }));
  const diagGrid = svg('g');
  const diagMarks = svg('g');
  svgDiag.appendChild(diagGrid);
  svgDiag.appendChild(diagMarks);
  diagHost.innerHTML = '';
  diagHost.appendChild(svgDiag);

  const svgDecomp = svg('svg', {
    style: 'width:100%;height:auto;display:block;overflow:visible;',
    role: 'group',
    'aria-labelledby': 'psmDecompTitle psmDecompDesc',
  });
  svgDecomp.appendChild(svg('title', { id: 'psmDecompTitle', text: 'Naive vs Matched Causal Decomposition' }));
  svgDecomp.appendChild(svg('desc', { id: 'psmDecompDesc', text: 'Comparison of unadjusted Fiber vs DSL differences against 1:1 caliper-matched causal estimates and 1-year net ROI.' }));
  const decompG = svg('g');
  svgDecomp.appendChild(decompG);
  decompHost.innerHTML = '';
  decompHost.appendChild(svgDecomp);

  const cap12a = renderFigureCaption('cap12a', {
    fig: 'FIG. 12A',
    caption: 'Covariate balance |SMD| before vs. after 1:1 logit propensity caliper matching (benchmark |SMD| < 0.10 per Rosenbaum 2010 / Austin 2011).',
    source: 'Source: Telco-Customer-Churn.csv · Broadband subset (n = 5,517)',
    cols: [
      { label: 'Covariate', num: false },
      { label: 'Pre |SMD|', num: true },
      { label: 'Post |SMD|', num: true },
      { label: 'Bias Red. (%)', num: true },
    ],
    getRows: () =>
      result.balanceRows.map((b) => [
        b.inSpec ? b.label : `${b.label} (unadj.)`,
        fmt(Math.abs(b.preSmd), 3),
        fmt(Math.abs(b.postSmd), 3),
        `${b.biasReductionPct >= 0 ? '' : '−'}${fmt(Math.abs(b.biasReductionPct), 1)} %`,
      ]),
  });

  const cap12b = renderFigureCaption('cap12b', {
    fig: 'FIG. 12B',
    caption: 'Overt selection bias removal on churn (+pp) and 1-year net ROI decomposition across matched Fiber vs DSL pairs.',
    source: 'Source: Telco-Customer-Churn.csv · 1:1 Matched Counterfactuals',
    cols: [
      { label: 'Estimator', num: false },
      { label: 'Churn Gap (pp)', num: true },
      { label: '1-Yr Rev Lift ($)', num: true },
      { label: 'Net Profit ($)', num: true },
      { label: '1-Yr ROI (%)', num: true },
    ],
    getRows: () => [
      [
        'Naive Unadjusted (3,096 vs 2,421)',
        `+${fmt(result.naive.churnDiffPp, 1)} pp`,
        `+$${fmt(result.naive.treatedRev1Yr - result.naive.controlRev1Yr)}`,
        `${result.naive.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(result.naive.netProfitPerUpgrade))}`,
        `${result.naive.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(result.naive.roiPct), 1)} %`,
      ],
      [
        `PSM Matched ATT (${fmt(result.matchedPairsCount)} pairs)`,
        `${result.matched.attChurnPp >= 0 ? '+' : '−'}${fmt(Math.abs(result.matched.attChurnPp), 1)} pp`,
        `+$${fmt(result.matched.grossRevLift1Yr)}`,
        `${result.matched.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(result.matched.netProfitPerUpgrade))}`,
        `${result.matched.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(result.matched.roiPct), 1)} %`,
      ],
    ],
  });

  function formatP(p: number): string {
    if (p < 0.0001) return '< 0.0001';
    if (p < 0.01) return p.toFixed(4);
    return p.toFixed(3);
  }

  function updateKpis() {
    const m = result.matched;
    const n = result.naive;
    const removed = n.churnDiffPp - m.attChurnPp;
    const absAtt = Math.abs(m.attChurnPp);
    const per100 = Math.round(absAtt);
    const breakEvenCost = Math.round(m.grossRevLift1Yr);

    if (pairsReadout && pairsSub) {
      pairsReadout.textContent = `${fmt(result.matchedPairsCount)} pairs`;
      pairsSub.textContent = `${fmt(result.supportRetentionPct, 1)}% Fiber matched · ${result.balancedUnder010Count}/${result.totalCovariatesCount} traits balanced (<0.10 SMD)`;
    }
    if (attReadout && attSub) {
      attReadout.textContent = `${m.attChurnPp >= 0 ? '+' : '−'}${fmt(absAtt, 1)} pp`;
      attSub.textContent = `${fmt(m.treatedChurnRate, 1)}% Fiber vs ${fmt(m.controlChurnRate, 1)}% DSL (~${per100} MORE exits per 100 upgrades; ${fmt(removed, 1)} pp bias removed)`;
    }
    if (roiReadout && roiSub) {
      const np = m.netProfitPerUpgrade;
      const roi = m.roiPct;
      roiReadout.textContent = `${np >= 0 ? '+' : '−'}$${fmt(Math.abs(np), 0)} (${roi >= 0 ? '+' : '−'}${fmt(Math.abs(roi), 0)}%)`;
      roiReadout.style.color = np >= 0 ? 'var(--violet-ink)' : 'var(--vermilion-ink)';
      const totK = m.totalNetProfitK;
      roiSub.textContent = `${totK >= 0 ? '+' : '−'}$${fmt(Math.abs(totK), 1)}k total net · break-even upgrade cost ~$${fmt(breakEvenCost)}`;
    }
    if (gammaReadout && gammaSub) {
      gammaReadout.textContent = `Γ* = ${fmt(result.criticalGammaChurn, 2)} / ${fmt(result.criticalGammaNetRev, 2)}`;
      const revPct = Math.round((result.criticalGammaNetRev - 1) * 100);
      gammaSub.textContent =
        result.criticalGammaNetRev > 1.01
          ? `hidden bias must skew Fiber odds +${revPct}% to doubt 1-yr ROI (p > 0.05)`
          : `1-yr net profit is near break-even (cannot rule out zero effect at α=0.05)`;
    }
    if (summaryLine) {
      summaryLine.textContent = `${result.specLabel} · Caliper ${result.caliperMultiplier.toFixed(2)} SD (${fmt(result.caliperLogitRadius, 3)} logit) · Matched ${fmt(result.matchedPairsCount)}/${fmt(result.rawTreatedCount)} Fiber pairs · Cost $${fmt(result.campaignCostPerUpgrade)}/upgrade`;
    }

    if (tkChurnTitle && tkChurnBody) {
      const biasShare = n.churnDiffPp > 0 ? Math.round((removed / n.churnDiffPp) * 100) : 0;
      const signStr = `${m.attChurnPp >= 0 ? '+' : '−'}${fmt(absAtt, 1)} pp`;
      const moreOrLess = m.attChurnPp >= 0 ? 'MORE' : 'LESS';
      tkChurnTitle.textContent = `1. What ${signStr} churn means: ${moreOrLess} churn, not ${m.attChurnPp >= 0 ? 'less' : 'more'}`;
      tkChurnBody.textContent =
        `“${signStr}” (percentage points) means Fiber upgrades experienced ${fmt(absAtt, 1)} percentage points ${moreOrLess} churn than identical DSL customers—` +
        `${fmt(m.treatedChurnRate, 1)}% of upgraded Fiber accounts left within a year vs ${fmt(m.controlChurnRate, 1)}% of matched DSL twins. ` +
        `In plain numbers, for every 100 customers upgraded to Fiber, roughly ${per100} ${moreOrLess} cancelled than if they had stayed on DSL. ` +
        `Crucially, raw unadjusted numbers overstated this gap at +${fmt(n.churnDiffPp, 1)} pp (${fmt(n.treatedChurnRate, 1)}% vs ${fmt(n.controlChurnRate, 1)}%): ` +
        `${biasShare}% of the headline alarm (${fmt(removed, 1)} pp) came from targeting higher-risk month-to-month and electronic-check users, not Fiber itself.`;
    }

    if (tkRoiTitle && tkRoiBody) {
      const np = m.netProfitPerUpgrade;
      const totK = m.totalNetProfitK;
      const mrrDiff = m.attMrrLift;
      const isPos = np > 0;
      tkRoiTitle.textContent = isPos
        ? `2. Positive 1-Yr ROI (+${fmt(m.roiPct, 0)}%) despite higher churn`
        : np === 0
          ? `2. Campaign sits right at 1-Yr financial break-even`
          : `2. Negative 1-Yr ROI (−${fmt(Math.abs(m.roiPct), 0)}%) at $${fmt(result.campaignCostPerUpgrade)} upgrade cost`;
      tkRoiBody.textContent =
        `How can Fiber lose ~${per100} more customers per 100 yet still ${isPos ? 'make money' : 'lose money at high cost'}? ` +
        `Matched Fiber subscribers pay +$${fmt(mrrDiff, 2)}/month more ($${fmt(m.treatedAvgMrr, 1)} vs $${fmt(m.controlAvgMrr, 1)}/mo). Even after accounting for early cancellations, ` +
        `the average Fiber upgrade generated $${fmt(m.treatedRev1Yr, 0)} in 1-year billing vs $${fmt(m.controlRev1Yr, 0)} for its DSL twin—a +$${fmt(m.grossRevLift1Yr, 0)} gross lift. ` +
        (isPos
          ? `Subtracting the $${fmt(result.campaignCostPerUpgrade)} upgrade cost leaves +$${fmt(np, 0)} net profit per upgrade (+$${fmt(totK, 1)}k total across ${fmt(result.matchedPairsCount)} matched pairs). Profit remains positive whenever upgrade costs stay below $${fmt(breakEvenCost)}/account.`
          : `Because your $${fmt(result.campaignCostPerUpgrade)} upgrade cost exceeds the +$${fmt(m.grossRevLift1Yr, 0)} gross revenue lift, the campaign loses −$${fmt(Math.abs(np), 0)} per upgrade (−$${fmt(Math.abs(totK), 1)}k cohort net). Lowering upgrade cost below $${fmt(breakEvenCost)} restores positive ROI.`);
    }

    if (tkGammaTitle && tkGammaBody) {
      const chPct = Math.round((result.criticalGammaChurn - 1) * 100);
      const rvPct = Math.round((result.criticalGammaNetRev - 1) * 100);
      tkGammaTitle.textContent = `3. What Rosenbaum Γ bounds (${fmt(result.criticalGammaChurn, 2)} / ${fmt(result.criticalGammaNetRev, 2)}) mean to management`;
      tkGammaBody.textContent =
        `Because management did not run a randomized experiment, some unmeasured factor (like local competitor Fiber promos, speed complaints, or credit quality) might not be in the CSV. ` +
        `Rosenbaum’s Γ (Gamma) is a stress test asking: “How skewed would a hidden factor have to be before our findings could be a mirage?” ` +
        `Γ = 1.00 assumes zero hidden bias. Here, Γ* = ${fmt(result.criticalGammaChurn, 2)} for churn and Γ* = ${fmt(result.criticalGammaNetRev, 2)} for 1-year net revenue mean ` +
        (result.criticalGammaNetRev > 1.05
          ? `an unrecorded driver would have to make a customer roughly +${chPct}% to +${rvPct}% more likely to receive the Fiber upgrade—even after matching on all ${result.totalCovariatesCount} observed traits—to push worst-case p⁺(Γ) above 0.05. That signals moderate-to-solid executive confidence: small hidden differences cannot overturn these results, though retention add-ons from Section 11 are still needed to curb Fiber exits.`
          : `at a $${fmt(result.campaignCostPerUpgrade)} upgrade cost, the net 1-year profit margin is too close to break-even (Γ* = ${fmt(result.criticalGammaNetRev, 2)}) to be statistically robust against even tiny hidden confounding.`);
    }
  }

  function drawDiag() {
    const w = Math.max(280, diagHost!.clientWidth || 540);
    diagGrid.innerHTML = '';
    diagMarks.innerHTML = '';

    if (viewMode === 'love') {
      const rows = result.balanceRows;
      const rowH = 26;
      const topPad = 36;
      const botPad = 34;
      const h = topPad + rows.length * rowH + botPad;
      const labelW = w < 420 ? 124 : 156;
      const padR = 16;
      const maxSmd = 0.85;
      const xScale = scaleLinear(0, maxSmd, labelW, w - padR);
      svgDiag.setAttribute('viewBox', `0 0 ${w} ${h}`);

      // Legend at top
      diagGrid.appendChild(svg('rect', { x: labelW, y: 6, width: 9, height: 9, fill: 'none', stroke: 'var(--vermilion)', 'stroke-width': 2 }));
      diagGrid.appendChild(svg('text', { x: labelW + 14, y: 14, class: 'svg-micro', text: 'Pre-Match |SMD|' }));
      diagGrid.appendChild(svg('circle', { cx: labelW + 122, cy: 10.5, r: 4.5, fill: 'var(--violet)' }));
      diagGrid.appendChild(svg('text', { x: labelW + 131, y: 14, class: 'svg-micro', text: 'Post-Match |SMD| (<0.10)' }));

      [0, 0.1, 0.2, 0.4, 0.6, 0.8].forEach((tick) => {
        const x = xScale(tick);
        const isThresh = Math.abs(tick - 0.1) < 1e-6;
        diagGrid.appendChild(
          svg('line', {
            x1: x,
            y1: topPad - 6,
            x2: x,
            y2: h - botPad,
            stroke: isThresh ? 'var(--violet-ink)' : tick === 0 ? 'var(--ink)' : 'var(--rule)',
            'stroke-width': isThresh || tick === 0 ? 1.5 : 1,
            'stroke-dasharray': isThresh ? '4 3' : null,
          })
        );
        diagGrid.appendChild(
          svg('text', {
            x,
            y: h - 14,
            'text-anchor': 'middle',
            class: 'svg-micro',
            style: isThresh ? 'fill:var(--violet-ink);font-weight:600;' : null,
            text: tick.toFixed(1),
          })
        );
      });
      diagGrid.appendChild(svg('text', { x: w - padR, y: h - 2, 'text-anchor': 'end', class: 'svg-micro', text: 'Absolute Standardized Mean Difference |SMD| →' }));

      rows.forEach((b, idx) => {
        const y = topPad + idx * rowH + rowH * 0.5;
        const absPre = Math.abs(b.preSmd);
        const absPost = Math.abs(b.postSmd);
        const xPre = xScale(Math.min(maxSmd, absPre));
        const xPost = xScale(Math.min(maxSmd, absPost));
        const postBalanced = absPost < 0.1;

        const g = svg('g', {
          tabindex: 0,
          role: 'img',
          'aria-label': `${b.label}: pre SMD ${absPre.toFixed(3)}, post SMD ${absPost.toFixed(3)}`,
          style: 'cursor:pointer;',
        });
        g.appendChild(svg('rect', { x: 0, y: y - rowH * 0.5, width: w, height: rowH, fill: 'transparent' }));
        g.appendChild(svg('line', { x1: labelW, y1: y, x2: w - padR, y2: y, stroke: 'var(--rule)', 'stroke-width': 0.5, opacity: '0.55' }));
        g.appendChild(
          svg('text', {
            x: 0,
            y: y + 4,
            class: 'svg-label',
            style: `font-size:12px;${b.inSpec ? '' : 'fill:var(--ink-3);'}`,
            text: b.inSpec ? b.label : `${b.label} (unadj.)`,
          })
        );
        g.appendChild(
          svg('line', {
            x1: xPost,
            y1: y,
            x2: xPre,
            y2: y,
            stroke: postBalanced ? 'var(--violet-tint)' : 'var(--vermilion-tint)',
            'stroke-width': 2,
          })
        );
        g.appendChild(
          svg('rect', {
            x: xPre - 4,
            y: y - 4,
            width: 8,
            height: 8,
            fill: 'var(--paper)',
            stroke: 'var(--vermilion)',
            'stroke-width': 2,
          })
        );
        g.appendChild(
          svg('circle', {
            cx: xPost,
            cy: y,
            r: 4.8,
            fill: postBalanced ? 'var(--violet)' : 'var(--vermilion)',
            stroke: 'var(--paper)',
            'stroke-width': 1,
          })
        );

        const isPct = b.key !== 'tenure';
        const fmtVal = (v: number) => (isPct ? `${fmt(v * 100, 1)}%` : `${fmt(v, 1)} mo`);
        const info = {
          cat: `${b.label}${b.inSpec ? '' : ' (Omitted from Spec)'}`,
          val: `|SMD| ${fmt(absPre, 3)} → ${fmt(absPost, 3)}`,
          sub: `Pre: ${fmtVal(b.preTreatedMean)} vs ${fmtVal(b.preControlMean)} · Matched: ${fmtVal(b.postTreatedMean)} vs ${fmtVal(b.postControlMean)} (${fmt(b.biasReductionPct, 0)}% red.)`,
        };
        g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
        g.addEventListener('pointermove', (e) => tt.show(g, info, e));
        g.addEventListener('pointerleave', tt.hide);
        g.addEventListener('focus', () => tt.show(g, info));
        g.addEventListener('blur', tt.hide);
        diagMarks.appendChild(g);
      });
    } else if (viewMode === 'gamma') {
      const h = 340;
      const padL = 52;
      const padR = 18;
      const padT = 32;
      const padB = 42;
      const sRows = result.sensitivityRows;
      const xScale = scaleLinear(1.0, 3.0, padL, w - padR);
      const yMax = 0.25;
      const yScale = scaleLinear(0, yMax, h - padB, padT);
      svgDiag.setAttribute('viewBox', `0 0 ${w} ${h}`);

      const compactLegend = w < 440;
      diagGrid.appendChild(svg('line', { x1: padL, y1: 10, x2: padL + 14, y2: 10, stroke: 'var(--vermilion)', 'stroke-width': 2.5 }));
      diagGrid.appendChild(svg('text', { x: padL + 19, y: 14, class: 'svg-micro', text: `Churn p⁺(Γ) (Γ*=${fmt(result.criticalGammaChurn, 2)})` }));
      diagGrid.appendChild(svg('line', { x1: compactLegend ? padL : padL + 162, y1: compactLegend ? 24 : 10, x2: compactLegend ? padL + 14 : padL + 176, y2: compactLegend ? 24 : 10, stroke: 'var(--violet)', 'stroke-width': 2.5 }));
      diagGrid.appendChild(svg('text', { x: compactLegend ? padL + 19 : padL + 181, y: compactLegend ? 28 : 14, class: 'svg-micro', text: `1-Yr Net Rev p⁺(Γ) (Γ*=${fmt(result.criticalGammaNetRev, 2)})` }));

      [0, 0.05, 0.1, 0.15, 0.2, 0.25].forEach((tick) => {
        const y = yScale(tick);
        const isAlpha = Math.abs(tick - 0.05) < 1e-6;
        diagGrid.appendChild(
          svg('line', {
            x1: padL,
            y1: y,
            x2: w - padR,
            y2: y,
            stroke: isAlpha ? 'var(--vermilion-ink)' : tick === 0 ? 'var(--ink)' : 'var(--rule)',
            'stroke-width': isAlpha || tick === 0 ? 1.5 : 1,
            'stroke-dasharray': isAlpha ? '5 4' : null,
          })
        );
        diagGrid.appendChild(
          svg('text', {
            x: padL - 8,
            y: y + 4,
            'text-anchor': 'end',
            class: 'svg-micro',
            style: isAlpha ? 'fill:var(--vermilion-ink);font-weight:600;' : null,
            text: tick.toFixed(2),
          })
        );
      });

      sRows.forEach((r) => {
        const x = xScale(r.gamma);
        diagGrid.appendChild(svg('line', { x1: x, y1: padT, x2: x, y2: h - padB, stroke: 'var(--rule)', 'stroke-width': 0.75, opacity: '0.6' }));
        diagGrid.appendChild(svg('text', { x, y: h - 22, 'text-anchor': 'middle', class: 'svg-micro', text: r.gamma.toFixed(2) }));
      });
      diagGrid.appendChild(svg('text', { x: w - padR, y: h - 4, 'text-anchor': 'end', class: 'svg-micro', text: 'Rosenbaum Hidden Bias Sensitivity Parameter Γ (odds ratio) →' }));

      const drawCurve = (vals: number[], color: string) => {
        const d = sRows
          .map((r, i) => `${i === 0 ? 'M' : 'L'}${xScale(r.gamma).toFixed(1)},${yScale(Math.min(yMax, vals[i])).toFixed(1)}`)
          .join(' ');
        diagMarks.appendChild(svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2.5 }));
      };

      drawCurve(sRows.map((r) => r.churnUpperP), 'var(--vermilion)');
      drawCurve(sRows.map((r) => r.netRevUpperP), 'var(--violet)');

      sRows.forEach((r) => {
        const cx = xScale(r.gamma);
        const cyCh = yScale(Math.min(yMax, r.churnUpperP));
        const cyRv = yScale(Math.min(yMax, r.netRevUpperP));

        const ptCh = svg('rect', {
          x: cx - 4,
          y: cyCh - 4,
          width: 8,
          height: 8,
          fill: 'var(--vermilion)',
          tabindex: 0,
          role: 'img',
          'aria-label': `Gamma ${r.gamma.toFixed(2)}: Churn upper p = ${formatP(r.churnUpperP)}, Net Rev upper p = ${formatP(r.netRevUpperP)}`,
          style: 'cursor:pointer;',
        });
        const info = {
          cat: `Rosenbaum Sensitivity · Γ = ${r.gamma.toFixed(2)}`,
          val: `Churn p⁺ = ${formatP(r.churnUpperP)} · Rev p⁺ = ${formatP(r.netRevUpperP)}`,
          sub: `p ≤ 0.05: Churn ${r.churnSignificantAt05 ? 'Robust' : 'Sensitive'} · 1-Yr Net Rev ${r.netRevSignificantAt05 ? 'Robust' : 'Sensitive'}`,
        };
        ptCh.addEventListener('pointerenter', (e) => tt.show(ptCh, info, e));
        ptCh.addEventListener('pointermove', (e) => tt.show(ptCh, info, e));
        ptCh.addEventListener('pointerleave', tt.hide);
        ptCh.addEventListener('focus', () => tt.show(ptCh, info));
        ptCh.addEventListener('blur', tt.hide);
        diagMarks.appendChild(ptCh);

        diagMarks.appendChild(svg('circle', { cx, cy: cyRv, r: 4, fill: 'var(--violet)', style: 'pointer-events:none;' }));
      });
    } else {
      // Propensity Score Common-Support Mirror Histogram
      const h = 340;
      const padL = 46;
      const padR = 16;
      const padT = 32;
      const padB = 38;
      const midY = (padT + (h - padB)) * 0.5;
      const halfH = midY - padT;
      const bins = result.overlapBins;
      const maxBin = Math.max(100, ...bins.map((b) => Math.max(b.rawTreated, b.rawControl)));
      const colW = (w - padL - padR) / bins.length;
      svgDiag.setAttribute('viewBox', `0 0 ${w} ${h}`);

      const compactLeg = w < 440;
      diagGrid.appendChild(svg('rect', { x: padL, y: 6, width: 9, height: 9, fill: 'var(--violet)' }));
      diagGrid.appendChild(svg('text', { x: padL + 13, y: 14, class: 'svg-micro', text: 'Matched Fiber ↑' }));
      diagGrid.appendChild(svg('rect', { x: padL + 114, y: 6, width: 9, height: 9, fill: 'var(--vermilion)' }));
      diagGrid.appendChild(svg('text', { x: padL + 127, y: 14, class: 'svg-micro', text: 'Matched DSL ↓' }));
      diagGrid.appendChild(svg('rect', { x: compactLeg ? padL : padL + 224, y: compactLeg ? 20 : 6, width: 9, height: 9, fill: 'var(--neutral-data)' }));
      diagGrid.appendChild(svg('text', { x: compactLeg ? padL + 13 : padL + 237, y: compactLeg ? 28 : 14, class: 'svg-micro', text: 'Unmatched' }));

      diagGrid.appendChild(svg('line', { x1: padL, y1: midY, x2: w - padR, y2: midY, stroke: 'var(--ink)', 'stroke-width': 1.5 }));
      [0.5, 1.0].forEach((frac) => {
        const val = Math.round(maxBin * frac);
        const yUp = midY - frac * halfH;
        const yDn = midY + frac * halfH;
        diagGrid.appendChild(svg('line', { x1: padL, y1: yUp, x2: w - padR, y2: yUp, stroke: 'var(--rule)', 'stroke-width': 1 }));
        diagGrid.appendChild(svg('line', { x1: padL, y1: yDn, x2: w - padR, y2: yDn, stroke: 'var(--rule)', 'stroke-width': 1 }));
        diagGrid.appendChild(svg('text', { x: padL - 6, y: yUp + 4, 'text-anchor': 'end', class: 'svg-micro', text: fmt(val) }));
        diagGrid.appendChild(svg('text', { x: padL - 6, y: yDn + 4, 'text-anchor': 'end', class: 'svg-micro', text: fmt(val) }));
      });
      diagGrid.appendChild(svg('text', { x: padL - 6, y: midY + 4, 'text-anchor': 'end', class: 'svg-micro', text: '0' }));

      bins.forEach((b, idx) => {
        const bx = padL + idx * colW + 3;
        const bw = Math.max(8, colW - 6);
        const rawTH = (b.rawTreated / maxBin) * halfH;
        const matTH = (b.matchedTreated / maxBin) * halfH;
        const rawCH = (b.rawControl / maxBin) * halfH;
        const matCH = (b.matchedControl / maxBin) * halfH;

        const g = svg('g', {
          tabindex: 0,
          role: 'img',
          'aria-label': `Propensity bin ${b.binLabel}: Fiber ${b.matchedTreated} of ${b.rawTreated} matched; DSL ${b.matchedControl} of ${b.rawControl} matched`,
          style: 'cursor:pointer;',
        });
        g.appendChild(svg('rect', { x: bx, y: midY - rawTH, width: bw, height: rawTH, fill: 'var(--neutral-data)' }));
        g.appendChild(svg('rect', { x: bx, y: midY - matTH, width: bw, height: matTH, fill: 'var(--violet)' }));
        g.appendChild(svg('rect', { x: bx, y: midY, width: bw, height: rawCH, fill: 'var(--neutral-data)' }));
        g.appendChild(svg('rect', { x: bx, y: midY, width: bw, height: matCH, fill: 'var(--vermilion)' }));

        if (idx % 2 === 0 || w > 480) {
          diagGrid.appendChild(svg('text', { x: bx + bw * 0.5, y: h - 18, 'text-anchor': 'middle', class: 'svg-micro', text: b.binLabel }));
        }

        const info = {
          cat: `Propensity Bin ê(X) ∈ [${b.binLabel}]`,
          val: `Fiber ${fmt(b.matchedTreated)}/${fmt(b.rawTreated)} · DSL ${fmt(b.matchedControl)}/${fmt(b.rawControl)}`,
          sub: `Unmatched tail discarded outside ${result.caliperMultiplier.toFixed(2)} SD common-support caliper`,
        };
        g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
        g.addEventListener('pointermove', (e) => tt.show(g, info, e));
        g.addEventListener('pointerleave', tt.hide);
        g.addEventListener('focus', () => tt.show(g, info));
        g.addEventListener('blur', tt.hide);
        diagMarks.appendChild(g);
      });
      diagGrid.appendChild(svg('text', { x: w - padR, y: h - 2, 'text-anchor': 'end', class: 'svg-micro', text: 'Estimated Fiber Assignment Propensity Score ê(X) →' }));
    }
  }

  function drawDecomp() {
    const w = Math.max(260, decompHost!.clientWidth || 440);
    const h = 236;
    decompG.innerHTML = '';
    svgDecomp.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const labelW = w < 400 ? 118 : 148;
    const rightW = 72;
    const x0 = labelW;
    const x1 = w - rightW;

    // Panel A: Churn Rate Gap Decomposition (pp)
    const chMax = 28;
    const xCh = scaleLinear(0, chMax, x0, x1);
    const overtBias = Math.max(0, result.naive.churnDiffPp - result.matched.attChurnPp);

    decompG.appendChild(svg('text', { x: 0, y: 14, class: 'svg-micro', text: 'A · CHURN GAP DECOMPOSITION (FIBER − DSL EXCESS CHURN)' }));

    const chRows = [
      { label: 'Naive unadjusted gap', val: result.naive.churnDiffPp, color: 'var(--ink)', sub: `${fmt(result.naive.treatedChurnRate, 1)}% Fiber vs ${fmt(result.naive.controlChurnRate, 1)}% DSL` },
      { label: 'Overt selection bias', val: overtBias, color: 'var(--neutral-data)', sub: 'Confounding removed by 1:1 propensity caliper matching' },
      { label: 'Causal ATT (matched)', val: result.matched.attChurnPp, color: 'var(--vermilion)', sub: `${fmt(result.matched.treatedChurnRate, 1)}% Fiber vs ${fmt(result.matched.controlChurnRate, 1)}% matched DSL` },
    ];
    chRows.forEach((row, i) => {
      const y = 26 + i * 26;
      const bw = Math.max(2, xCh(Math.min(chMax, Math.max(0, row.val))) - x0);
      const g = svg('g', { tabindex: 0, role: 'img', 'aria-label': `${row.label}: ${row.val.toFixed(1)} pp`, style: 'cursor:pointer;' });
      g.appendChild(svg('rect', { x: 0, y, width: w, height: 22, fill: 'transparent' }));
      g.appendChild(svg('text', { x: 0, y: y + 15, class: 'svg-label', style: 'font-size:12px;', text: row.label }));
      g.appendChild(svg('rect', { x: x0, y: y + 5, width: bw, height: 12, fill: row.color }));
      g.appendChild(svg('text', { x: w, y: y + 15, 'text-anchor': 'end', class: 'svg-micro', style: 'font-weight:600;fill:var(--ink);', text: `+${fmt(row.val, 1)} pp` }));
      const info = { cat: row.label, val: `+${fmt(row.val, 1)} pp`, sub: row.sub };
      g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
      g.addEventListener('pointermove', (e) => tt.show(g, info, e));
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('focus', () => tt.show(g, info));
      g.addEventListener('blur', tt.hide);
      decompG.appendChild(g);
    });

    decompG.appendChild(svg('line', { x1: 0, y1: 112, x2: w, y2: 112, stroke: 'var(--rule)', 'stroke-width': 1 }));
    decompG.appendChild(svg('text', { x: 0, y: 129, class: 'svg-micro', text: 'B · 1-YEAR REALIZED VALUE PER MATCHED UPGRADE ($/ACCT)' }));

    const revMax = Math.max(1000, Math.ceil(result.matched.treatedRev1Yr / 100) * 100);
    const xRev = scaleLinear(0, revMax, x0, x1);
    const netColor = result.matched.netProfitPerUpgrade >= 0 ? 'var(--violet)' : 'var(--vermilion)';
    const revRows = [
      { label: 'Matched Fiber 1-yr rev', val: result.matched.treatedRev1Yr, color: 'var(--violet)', display: `$${fmt(result.matched.treatedRev1Yr)}`, sub: `$${fmt(result.matched.treatedAvgMrr, 1)}/mo avg ARPU, survival-adjusted` },
      { label: 'Matched DSL counterfactual', val: result.matched.controlRev1Yr, color: 'var(--ink-3)', display: `$${fmt(result.matched.controlRev1Yr)}`, sub: `$${fmt(result.matched.controlAvgMrr, 1)}/mo avg ARPU, matched controls` },
      { label: `Upgrade cost ($${fmt(result.campaignCostPerUpgrade)})`, val: result.campaignCostPerUpgrade, color: 'var(--vermilion)', display: `−$${fmt(result.campaignCostPerUpgrade)}`, sub: 'Installation, modem & promotional campaign credit' },
      { label: 'Net 1-yr profit / upgrade', val: Math.abs(result.matched.netProfitPerUpgrade), color: netColor, display: `${result.matched.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(result.matched.netProfitPerUpgrade))}`, sub: `1-yr ROI = ${result.matched.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(result.matched.roiPct), 1)}%` },
    ];
    revRows.forEach((row, i) => {
      const y = 140 + i * 24;
      const bw = Math.max(2, xRev(Math.min(revMax, Math.max(0, row.val))) - x0);
      const g = svg('g', { tabindex: 0, role: 'img', 'aria-label': `${row.label}: ${row.display}`, style: 'cursor:pointer;' });
      g.appendChild(svg('rect', { x: 0, y, width: w, height: 22, fill: 'transparent' }));
      g.appendChild(svg('text', { x: 0, y: y + 14, class: 'svg-label', style: 'font-size:12px;', text: row.label }));
      g.appendChild(svg('rect', { x: x0, y: y + 4, width: bw, height: 12, fill: row.color }));
      g.appendChild(
        svg('text', {
          x: w,
          y: y + 14,
          'text-anchor': 'end',
          class: 'svg-micro',
          style: `font-weight:600;fill:${row.label.startsWith('Net') && result.matched.netProfitPerUpgrade < 0 ? 'var(--vermilion-ink)' : 'var(--ink)'};`,
          text: row.display,
        })
      );
      const info = { cat: row.label, val: row.display, sub: row.sub };
      g.addEventListener('pointerenter', (e) => tt.show(g, info, e));
      g.addEventListener('pointermove', (e) => tt.show(g, info, e));
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('focus', () => tt.show(g, info));
      g.addEventListener('blur', tt.hide);
      decompG.appendChild(g);
    });
  }

  function drawAuditTables() {
    const m = result.matched;
    const n = result.naive;

    const roiScroll = el('div', { class: 'table-scroll' });
    const roiHead = el(
      'thead',
      {},
      el('tr', {}, [
        el('th', { scope: 'col', text: 'Causal & Financial Outcome Metric' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Naive (No Match)' }),
        el('th', { class: 'is-num', scope: 'col', text: 'PSM Matched (ATT)' }),
      ])
    );
    const roiRows: Array<[string, string, string]> = [
      ['Sample Size (Fiber vs DSL)', `${fmt(result.rawTreatedCount)} vs ${fmt(result.rawControlCount)}`, `${fmt(result.matchedPairsCount)} vs ${fmt(result.matchedPairsCount)} pairs`],
      ['Max Covariate Imbalance |SMD|', fmt(result.maxAbsSmdPre, 3), `${fmt(result.maxAbsSmdPost, 3)} (${result.balancedUnder010Count}/${result.totalCovariatesCount} < 0.10)`],
      ['Fiber vs DSL Churn Rate', `${fmt(n.treatedChurnRate, 1)}% vs ${fmt(n.controlChurnRate, 1)}%`, `${fmt(m.treatedChurnRate, 1)}% vs ${fmt(m.controlChurnRate, 1)}%`],
      ['Excess Churn Effect (Fiber − DSL)', `+${fmt(n.churnDiffPp, 1)} pp`, `${m.attChurnPp >= 0 ? '+' : '−'}${fmt(Math.abs(m.attChurnPp), 1)} pp (p = ${formatP(m.mcnemarP)})`],
      ['McNemar Discordant Pairs (b / c)', 'Unpaired', `b=${fmt(m.discordantB_TreatedOnlyChurn)} / c=${fmt(m.discordantC_ControlOnlyChurn)} (χ²=${fmt(m.mcnemarChi2, 1)})`],
      ['Monthly ARPU Lift ($/mo)', `+$${fmt(n.mrrDiff, 2)}`, `+$${fmt(m.attMrrLift, 2)}`],
      ['1-Yr Realized Revenue Lift / Acct', `+$${fmt(n.treatedRev1Yr - n.controlRev1Yr, 2)}`, `+$${fmt(m.grossRevLift1Yr, 2)}`],
      ['Net 1-Yr Profit / Upgrade (after cost)', `${n.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(n.netProfitPerUpgrade), 2)}`, `${m.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(m.netProfitPerUpgrade), 2)}`],
      ['1-Year Net Campaign ROI (%)', `${n.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(n.roiPct), 1)}%`, `${m.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(m.roiPct), 1)}%`],
      ['Total Cohort 1-Yr Net Value ($k)', 'Unadjusted', `${m.totalNetProfitK >= 0 ? '+' : '−'}$${fmt(Math.abs(m.totalNetProfitK), 1)}k on $${fmt(m.totalCampaignCostK, 1)}k spend`],
    ];
    const roiBody = el(
      'tbody',
      {},
      roiRows.map((r) =>
        el('tr', {}, [
          el('td', { style: 'font-weight:500;', text: r[0] }),
          el('td', { class: 'is-num', style: 'color:var(--ink-2);', text: r[1] }),
          el('td', { class: 'is-num', style: 'font-weight:600;', text: r[2] }),
        ])
      )
    );
    roiScroll.appendChild(el('table', { class: 'data-table' }, [roiHead, roiBody]));

    const sensScroll = el('div', { class: 'table-scroll' });
    const sensHead = el(
      'thead',
      {},
      el('tr', {}, [
        el('th', { class: 'is-num', scope: 'col', text: 'Bias Γ (Odds Skew)' }),
        el('th', { class: 'is-num', scope: 'col', text: 'Churn p⁺(Γ)' }),
        el('th', { class: 'is-num', scope: 'col', text: '1-Yr Rev p⁺(Γ)' }),
        el('th', { scope: 'col', text: 'Business Interpretation (α = 0.05)' }),
      ])
    );
    const sensBody = el(
      'tbody',
      {},
      result.sensitivityRows.map((sr) => {
        const skewPct = Math.round((sr.gamma - 1) * 100);
        const skewDesc = sr.gamma === 1 ? 'No hidden bias' : `+${skewPct}% hidden skew`;
        const verdict =
          sr.churnSignificantAt05 && sr.netRevSignificantAt05
            ? `${skewDesc}: Both churn & ROI hold`
            : sr.churnSignificantAt05
              ? `${skewDesc}: Churn holds; ROI in doubt`
              : sr.netRevSignificantAt05
                ? `${skewDesc}: 1-Yr ROI holds; churn in doubt`
                : `${skewDesc}: Both could be bias artifacts`;
        return el('tr', {}, [
          el('td', { class: 'is-num', style: 'font-family:var(--font-mono);font-weight:600;', text: sr.gamma.toFixed(2) }),
          el('td', { class: 'is-num', style: sr.churnSignificantAt05 ? 'color:var(--ink);' : 'color:var(--vermilion-ink);', text: formatP(sr.churnUpperP) }),
          el('td', { class: 'is-num', style: sr.netRevSignificantAt05 ? 'color:var(--violet-ink);font-weight:500;' : 'color:var(--vermilion-ink);', text: formatP(sr.netRevUpperP) }),
          el('td', { style: 'font-size:12px;', text: verdict }),
        ]);
      })
    );
    sensScroll.appendChild(el('table', { class: 'data-table' }, [sensHead, sensBody]));

    const grid = el('div', { class: 'psm-tables-grid' }, [
      el('div', {}, [
        el('h4', { class: 'micro-upper', style: 'margin-bottom:var(--s-2);', text: 'Table 12A · Naive vs. Matched ATT & 1-Yr Net ROI' }),
        roiScroll,
      ]),
      el('div', {}, [
        el('h4', { class: 'micro-upper', style: 'margin-bottom:var(--s-2);', text: 'Table 12B · Rosenbaum (2002) Primal Sensitivity Bounds' }),
        sensScroll,
      ]),
    ]);

    auditHost!.innerHTML = '';
    auditHost!.appendChild(grid);
  }

  function recomputeAndRender() {
    result = runFiberPsmStudy(DATA.rawRows, {
      specKey,
      caliperMultiplier,
      campaignCostPerUpgrade: campaignCost,
    });
    updateKpis();
    drawDiag();
    drawDecomp();
    drawAuditTables();
    cap12a.refreshTable();
    cap12b.refreshTable();
  }

  document.querySelectorAll('[data-psm-spec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      specKey = (btn.getAttribute('data-psm-spec') || 'full') as PsmSpecKey;
      document.querySelectorAll('[data-psm-spec]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      recomputeAndRender();
    });
  });

  document.querySelectorAll('[data-psm-caliper]').forEach((btn) => {
    btn.addEventListener('click', () => {
      caliperMultiplier = parseFloat(btn.getAttribute('data-psm-caliper') || '0.20');
      document.querySelectorAll('[data-psm-caliper]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      recomputeAndRender();
    });
  });

  document.querySelectorAll('[data-psm-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewMode = (btn.getAttribute('data-psm-view') || 'love') as typeof viewMode;
      document.querySelectorAll('[data-psm-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      drawDiag();
    });
  });

  if (costSlider && costVal) {
    costSlider.addEventListener('input', () => {
      campaignCost = parseInt(costSlider.value, 10) || 0;
      costVal.textContent = String(campaignCost);
      recomputeAndRender();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const header = [
        'PairIndex',
        'Treated_Fiber_ID',
        'Matched_DSL_ID',
        'Propensity_Treated',
        'Propensity_Control',
        'Logit_Distance',
        'Treated_Churned',
        'Control_Churned',
        'Treated_MRR',
        'Control_MRR',
        'Treated_1Yr_Rev',
        'Control_1Yr_Rev',
        'Net_1Yr_Profit_USD',
      ];
      const lines = [header.join(',')].concat(
        result.samplePairs.map((p) =>
          [
            p.pairIndex,
            p.treatedId,
            p.controlId,
            p.propensityTreated.toFixed(4),
            p.propensityControl.toFixed(4),
            p.logitDiff.toFixed(4),
            p.treatedChurned ? 'Yes' : 'No',
            p.controlChurned ? 'Yes' : 'No',
            p.treatedMrr.toFixed(2),
            p.controlMrr.toFixed(2),
            p.treatedRev1Yr.toFixed(2),
            p.controlRev1Yr.toFixed(2),
            p.netProfit1Yr.toFixed(2),
          ].join(',')
        )
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telco-fiber-psm-pairs-${specKey}-cal${caliperMultiplier.toFixed(2)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  const roDiag = new ResizeObserver(() => requestAnimationFrame(drawDiag));
  roDiag.observe(diagHost);
  const roDecomp = new ResizeObserver(() => requestAnimationFrame(drawDecomp));
  roDecomp.observe(decompHost);

  recomputeAndRender();
  return () => result;
}

function buildReportSheetNode(content: ReportSectionsContent, includeOverview: boolean): HTMLElement {
  const makeTable = (
    headers: Array<{ label: string; num?: boolean }>,
    rows: string[][]
  ): HTMLElement => {
    const theadRow = el(
      'tr',
      {},
      headers.map((h) => el('th', { class: h.num ? 'is-num' : '', text: h.label }))
    );
    const bodyRows = rows.map((r) =>
      el(
        'tr',
        {},
        r.map((cell, idx) =>
          el('td', {
            class: headers[idx]?.num ? 'is-num' : '',
            text: cell,
          })
        )
      )
    );
    return el('div', { class: 'report-table-wrap' }, [
      el('table', { class: 'report-table' }, [el('thead', {}, [theadRow]), el('tbody', {}, bodyRows)]),
    ]);
  };

  const sheetChildren: Array<Node | null> = [
    el('div', {
      class: 'report-band-head',
      text: 'FOLIO ANALYTICS · TELCO CHURN & CAUSAL OBSERVATIONAL BRIEF',
    }),
    el('h1', { class: 'report-title', text: content.title }),
    el('p', { class: 'report-sub', text: content.subtitle }),
    el('p', {
      class: 'report-meta num',
      text: `Generated ${content.generatedAt} · ${content.specSummary}`,
    }),
    el('span', { class: 'report-sec-kicker', text: 'Section 12 · Executive Causal Snapshot' }),
    el('h2', {
      class: 'report-sec-title',
      text: 'Fiber Upgrade Campaign Impact (Matched Counterfactual)',
    }),
    el(
      'div',
      { class: 'report-kpi-grid' },
      content.kpis.map((kpi) =>
        el('div', { class: 'report-kpi-box' }, [
          el('span', { class: 'report-kpi-lbl', text: kpi.label }),
          el('strong', { class: 'report-kpi-val num', text: kpi.value }),
          el('p', { class: 'report-kpi-note', text: kpi.note }),
        ])
      )
    ),
    el('span', { class: 'report-sec-kicker', text: 'Key Takeaways · Plain-Language Business Guide' }),
    el('h2', {
      class: 'report-sec-title',
      text: 'What the Empirical Results Mean for Leadership',
    }),
    el('div', { class: 'report-takeaway-item' }, [
      el('h4', { text: content.churnTakeaway.title }),
      el('p', { text: content.churnTakeaway.body }),
    ]),
    el('div', { class: 'report-takeaway-item' }, [
      el('h4', { text: content.roiTakeaway.title }),
      el('p', { text: content.roiTakeaway.body }),
    ]),
    el('div', { class: 'report-takeaway-item' }, [
      el('h4', { text: content.gammaTakeaway.title }),
      el('p', { text: content.gammaTakeaway.body }),
    ]),
    el('span', { class: 'report-sec-kicker', text: 'Table 12A · Naive vs. Matched ATT' }),
    el('h2', { class: 'report-sec-title', text: '1-Year Realized Revenue, Attrition & Net ROI' }),
    makeTable(
      [
        { label: 'Outcome Metric' },
        { label: 'Raw Naive (Unadjusted)', num: true },
        { label: 'Matched ATT Counterfactual', num: true },
      ],
      content.roiComparisonRows
    ),
    el('span', { class: 'report-sec-kicker', text: 'Table 12B · Rosenbaum Sensitivity Bounds' }),
    el('h2', {
      class: 'report-sec-title',
      text: 'Stress Test Against Hidden Non-RCT Selection Bias (Γ)',
    }),
    makeTable(
      [
        { label: 'Odds Skew Γ', num: true },
        { label: 'Churn Upper p⁺', num: true },
        { label: '1-Yr Net Upper p⁺', num: true },
        { label: 'Plain-English Business Interpretation' },
      ],
      content.sensitivityRows
    ),
    el('span', { class: 'report-sec-kicker', text: 'Table 12C · Covariate Balance Audit' }),
    el('h2', {
      class: 'report-sec-title',
      text: 'Pre- vs. Post-Matching Baseline Imbalance (Top 8 Traits)',
    }),
    makeTable(
      [
        { label: 'Baseline Trait' },
        { label: 'Raw |SMD|', num: true },
        { label: 'Matched |SMD|', num: true },
        { label: 'Bias Reduction', num: true },
      ],
      content.balanceRows
    ),
  ];

  if (includeOverview) {
    sheetChildren.push(
      el('span', {
        class: 'report-sec-kicker',
        text: 'Sections 01–11 · Supporting Context',
      }),
      el('h2', {
        class: 'report-sec-title',
        text: 'Portfolio Churn Value vs. Volume & ML Targeting Overview',
      }),
      el(
        'div',
        { class: 'report-kpi-grid' },
        content.portfolioKpis.map((kpi) =>
          el('div', { class: 'report-kpi-box' }, [
            el('span', { class: 'report-kpi-lbl', text: kpi.label }),
            el('strong', { class: 'report-kpi-val num', text: kpi.value }),
            el('p', { class: 'report-kpi-note', text: kpi.note }),
          ])
        )
      ),
      ...content.portfolioTakeaways.map((txt, idx) =>
        el('div', { class: 'report-takeaway-item' }, [
          el('h4', {
            text: idx === 0 ? 'Churn Value vs. Churn Volume' : 'Contract & Tenure Risk Profile',
          }),
          el('p', { text: txt }),
        ])
      ),
      ...content.mlHighlights.map((txt, idx) =>
        el('div', { class: 'report-takeaway-item' }, [
          el('h4', {
            text:
              idx === 0
                ? 'Predictive Lift Benchmark (Sec 11)'
                : 'Recommended Retention Counterfactual',
          }),
          el('p', { text: txt }),
        ])
      )
    );
  }

  sheetChildren.push(
    el('span', { class: 'report-sec-kicker', text: 'Methodological References' }),
    el('h2', {
      class: 'report-sec-title',
      text: 'Propensity Score & Sensitivity Citations (Rosenbaum)',
    }),
    ...content.citations.map((c) =>
      el('div', { class: 'report-cite-item' }, [
        el('strong', { text: c.citation }),
        el('span', { text: c.note }),
      ])
    )
  );

  return el('article', { class: 'report-sheet-content' }, sheetChildren);
}

function initReportFeature(
  DATA: TelcoDashboardData,
  getMl: () => TelcoMlResult | null,
  getPsm: () => PsmStudyResult,
  themePanel: ReturnType<typeof initThemePanel>,
  tt: ReturnType<typeof initTooltip>
) {
  const dialog = document.getElementById('reportDialog') as HTMLDialogElement | null;
  const dialogInner = document.getElementById('reportDialogInner') as HTMLElement | null;
  const closeBtn = document.getElementById('reportDialogClose') as HTMLButtonElement | null;
  const previewHost = document.getElementById('reportSheetPreview') as HTMLElement | null;
  const printMount = document.getElementById('printReportMount') as HTMLElement | null;
  const includeToggle = document.getElementById('reportIncludeOverview') as HTMLInputElement | null;
  const printBtn = document.getElementById('reportPrintBtn') as HTMLButtonElement | null;
  const modalDownloadBtn = document.getElementById('reportDownloadPdfBtn') as HTMLButtonElement | null;

  const psmOpenBtn = document.getElementById('psmOpenReportBtn') as HTMLButtonElement | null;
  const psmDownloadBtn = document.getElementById('psmDownloadPdfBtn') as HTMLButtonElement | null;
  const footerBtn = document.getElementById('footerReportBtn') as HTMLButtonElement | null;
  const panelBtn = document.getElementById('panelReportBtn') as HTMLButtonElement | null;

  let lastFocus: HTMLElement | null = null;

  const getCurrentContent = (): { content: ReportSectionsContent; includeOverview: boolean } => {
    const includeOverview = includeToggle ? includeToggle.checked : true;
    const nowLabel = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());
    const content = buildReportContent({
      data: DATA,
      psm: getPsm(),
      ml: getMl(),
      includePortfolioAndMl: includeOverview,
      generatedAt: nowLabel,
    });
    return { content, includeOverview };
  };

  const renderPreview = () => {
    const { content, includeOverview } = getCurrentContent();
    const sheetNode = buildReportSheetNode(content, includeOverview);
    if (previewHost) {
      previewHost.replaceChildren(sheetNode.cloneNode(true));
    }
    if (printMount) {
      const printWrapper = el('div', { class: 'report-sheet' }, [sheetNode]);
      printMount.replaceChildren(printWrapper);
    }
  };

  const openReport = (triggerEl?: HTMLElement | null) => {
    if (!dialog) return;
    tt.hide();
    lastFocus = triggerEl || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    renderPreview();
    if (!dialog.open) {
      dialog.showModal();
    }
    requestAnimationFrame(() => {
      closeBtn?.focus({ preventScroll: true });
    });
  };

  const closeReport = () => {
    if (!dialog || !dialog.open) return;
    dialog.close();
    if (lastFocus && document.contains(lastFocus)) {
      lastFocus.focus();
    }
  };

  const downloadPdf = () => {
    const { content, includeOverview } = getCurrentContent();
    const bytes = generateExecutivePdfBytes(content, includeOverview);
    const pdfCopy = new Uint8Array(bytes.byteLength);
    pdfCopy.set(bytes);
    const blob = new Blob([pdfCopy.buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'telco-fiber-psm-executive-report.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  psmOpenBtn?.addEventListener('click', () => openReport(psmOpenBtn));
  footerBtn?.addEventListener('click', () => openReport(footerBtn));
  panelBtn?.addEventListener('click', () => {
    if (themePanel.isOpen()) {
      themePanel.close();
      window.setTimeout(() => openReport(footerBtn), REDUCED_MOTION ? 160 : 320);
    } else {
      openReport(panelBtn);
    }
  });

  psmDownloadBtn?.addEventListener('click', downloadPdf);
  modalDownloadBtn?.addEventListener('click', downloadPdf);

  includeToggle?.addEventListener('change', renderPreview);
  closeBtn?.addEventListener('click', closeReport);

  dialog?.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeReport();
  });

  dialog?.addEventListener('click', (e) => {
    if (e.target !== dialog || !dialogInner) return;
    const rect = dialogInner.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      closeReport();
    }
  });

  printBtn?.addEventListener('click', () => {
    renderPreview();
    if (printMount) printMount.hidden = false;
    window.print();
  });

  window.addEventListener('afterprint', () => {
    if (printMount) printMount.hidden = true;
  });
}

async function boot() {
  const tt = initTooltip();
  try {
    const DATA = await loadTelcoDashboardData();
    hydrateHeroKpis(DATA);
    const pager = initPager(DATA.sections);
    const themePanel = initThemePanel(pager, tt);
    const matrixApi = renderMatrix(DATA, tt);
    const stackApi = renderStackBar(DATA, tt);
    const valueVolApi = renderChurnValueVsVolume(DATA, tt);
    renderContractTable(DATA, (c) => matrixApi.highlightContract(c));
    const dumbbellApi = renderDumbbell(DATA, tt);
    const limitsApi = initContractMix(DATA, tt);
    const regApi = renderTenureCurve(DATA, tt);
    const columnsApi = renderMrrColumns(DATA, tt);
    renderHeatmap(DATA, tt);
    renderWaffle(DATA, tt);
    const lifecycleApi = renderLifecycleBars(DATA, tt);
    renderScatter(DATA, tt);
    const outlookApi = initRiskSummaryBars(DATA, tt);
    renderSegmentTable(DATA);

    initReveal({
      s01: () => matrixApi.reveal(),
      s02: () => {
        stackApi.reveal();
        valueVolApi.reveal();
      },
      s03: () => dumbbellApi.reveal(),
      s04: () => limitsApi.reveal(),
      s06: () => columnsApi.reveal(),
      s08: () => lifecycleApi.reveal(),
      s10: () => outlookApi.reveal(),
    });

    initScrollLoop(regApi.onScroll);
    initShortcuts(DATA.sections.length, pager, themePanel, tt);

    let mlResult: TelcoMlResult | null = null;
    let getPsmResult: (() => PsmStudyResult) | null = null;

    initReportFeature(
      DATA,
      () => mlResult,
      () => (getPsmResult ? getPsmResult() : runFiberPsmStudy(DATA.rawRows)),
      themePanel,
      tt
    );

    // Train sklearn-equivalent Logistic Regression + Gradient Boosting models and run Fiber PSM study after initial paint
    window.setTimeout(() => {
      mlResult = renderMlSection(DATA, tt);
      getPsmResult = renderPsmSection(DATA, tt);
    }, 16);
  } catch (err) {
    const metaSub = document.getElementById('heroMetaSub');
    if (metaSub) {
      metaSub.textContent = `Dataset load error: ${err instanceof Error ? err.message : 'Unable to parse CSV'}`;
    }
  }
}

void boot();
