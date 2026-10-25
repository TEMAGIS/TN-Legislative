// ════════════════════════════════════════════════════════════════
//  DRILL — census drill-down inside a district with breadcrumb chips:
//  District › County › Tract › Block group. The selected level's tiles
//  replace the district profile and its geography is drawn on the map.
//  Tracts/counties come from the already-loaded roll-up; block groups
//  are fetched on demand for the chosen tract.
// ════════════════════════════════════════════════════════════════
const Drill = (() => {
  const bgCache = {};   // tract geoid → { status, units, error }
  const tractLabel = (g) => { const c = g.slice(5), ss = c.slice(4); return 'Tract ' + String(+c.slice(0, 4)) + (ss !== '00' ? '.' + ss : ''); };
  const state = () => S.drill || (S.drill = { path: [], token: 0 });
  const layer = () => S.layers.census || (S.layers.census = L.featureGroup().addTo(S.map));
  const ctx = (f) => {
    const c = S.census[S.chamber]; if (!c || c.status !== 'ready') return null;
    const r = c.result; return { r, tractsIn: r.tracts.filter(t => r.assignment.get(t.geoid) === f._id) };
  };
  const cName = (r, k) => r.counties[k] ? r.counties[k] + ' County' : 'County ' + k;

  function reset() { S.drill = { path: [], token: (S.drill ? S.drill.token : 0) + 1 }; if (S.layers && S.layers.census) S.layers.census.clearLayers(); }

  // What the panel shows for the current level.
  function view(f, r) {
    const d = state(), c = ctx(f), P = d.path, v = { level: P.length, crumbs: [{ label: districtLabel(f) }], summary: null, rows: [], head: '', loading: false, error: null };
    if (!c) return v;
    const sumOf = (units) => Census.rollup(units, r.acs);
    if (P[0]) v.crumbs.push({ label: cName(r, P[0].id) });
    if (P[1]) v.crumbs.push({ label: tractLabel(P[1].id) });
    if (P[2]) v.crumbs.push({ label: P[2].label });
    const ct = P[0] ? c.tractsIn.filter(t => t.county === P[0].id) : [];
    if (!P[0]) {
      v.summary = r.byDistrict[f._id];
      v.head = 'County makeup'; v.next = 'county';
      v.rows = Object.entries(v.summary ? v.summary.counties : {}).sort((a, b) => b[1] - a[1]).map(([k, pop]) => {
        const sp = r.split[k]; return { id: k, label: cName(r, k), pop, split: !!sp, tip: sp ? 'Also in District ' + sp.filter(x => x !== f._id).map(districtNum).join(', ') : '' };
      });
    } else if (!P[1]) {
      v.summary = sumOf(ct); v.head = `Tracts in ${cName(r, P[0].id)}`; v.next = 'tract';
      v.rows = ct.slice().sort((a, b) => a.geoid.localeCompare(b.geoid)).map(t => { const s = sumOf([t]); return { id: t.geoid, label: tractLabel(t.geoid), pop: s ? s.pop : t.pop, inc: s && Census.metrics(s).medianIncome }; });
    } else {
      const t = ct.find(x => x.geoid === P[1].id), bg = bgCache[P[1].id];
      v.head = `Block groups in ${tractLabel(P[1].id)}`; v.next = 'bg';
      if (!P[2]) v.summary = t ? sumOf([t]) : null;
      else { const u = bg && bg.units && bg.units.find(x => x.geoid === P[2].id); v.summary = u ? u.summary : null; }
      if (!bg || bg.status === 'loading') v.loading = true;
      else if (bg.status === 'error') v.error = bg.error;
      else v.rows = bg.units.map(u => ({ id: u.geoid, label: u.label, pop: u.summary ? u.summary.pop : 0, inc: u.summary && Census.metrics(u.summary).medianIncome, sel: P[2] && P[2].id === u.geoid }));
      if (P[2]) v.rowsOnly = true;
    }
    return v;
  }

  const chev = '<span class="chev" aria-hidden="true">›</span>';
  function crumbsHTML(v) {
    const last = v.crumbs.length - 1;
    return `<nav class="crumbs" aria-label="Census level">${v.crumbs.map((c, i) => (i ? '<span class="sep" aria-hidden="true">›</span>' : '') +
      (i === last ? `<span class="chip on" aria-current="true">${esc(c.label)}</span>` : `<button type="button" class="chip" data-up="${i}">${esc(c.label)}</button>`)).join('')}</nav>`;
  }
  function listHTML(v) {
    const nextName = { county: 'county', tract: 'tract', bg: 'block group' }[v.next];
    let h = secH(v.level === 0 ? 'pin' : 'grid', v.head);
    if (v.loading) return h + '<div class="muted"><span class="spin"></span>Loading block groups…</div>';
    if (v.error) return h + `<div class="note err">Block groups could not be loaded: ${esc(v.error)}</div>`;
    if (!v.rows.length) return h + '<div class="empty" style="padding:8px">Nothing to show at this level.</div>';
    h += `<div class="drill-list">${v.rows.map(r => `<button type="button" class="drill-row${r.sel ? ' sel' : ''}" data-drill="${v.next}" data-id="${esc(r.id)}" data-label="${esc(r.label)}" aria-label="Open ${esc(r.label)}">
      <span class="dl">${esc(r.label)}${r.split ? `<span class="split" title="${esc(r.tip)}">split</span>` : ''}</span>
      <span class="muted">${fmtN(r.pop)}${r.inc ? ' · ' + fmtMoney(r.inc) : ''}</span>${chev}</button>`).join('')}</div>`;
    h += `<p class="muted" style="margin-top:6px">Select a ${nextName} (here or on the map) to see its profile.${v.level === 2 ? ' Disability and SNAP are only published down to tract level.' : ''}</p>`;
    return h;
  }

  // ── navigation ──
  async function go(level, id, label) {
    const d = state(), f = featureById(S.selected); if (!f) return;
    d.path = d.path.slice(0, level).concat({ level, id, label }); d.token++;
    renderDetail(); $('#detail-body').scrollTop = 0; drawMap(f);
    if (level === 1 && !bgCache[id]) {
      bgCache[id] = { status: 'loading' };
      try { bgCache[id] = { status: 'ready', units: await Census.loadBlockGroups(id) }; }
      catch (e) { console.warn('Block groups failed', e); bgCache[id] = { status: 'error', error: e.message }; }
      if (S.drill === d) { renderDetail(); drawMap(f); }
    }
  }
  function up(n) { const d = state(), f = featureById(S.selected); d.path = d.path.slice(0, n); d.token++; renderDetail(); $('#detail-body').scrollTop = 0; drawMap(f); }

  // ── map ──
  async function drawMap(f) {
    const d = state(), tk = d.token, lg = layer(); lg.clearLayers();
    const P = d.path, c = f && ctx(f); if (!P.length || !c) return;
    const col = '#d55e00', mk = (feat, style, tip, click) => {
      const pl = L.polygon(AG.toLeafletRings(feat), { color: col, weight: 1.5, fillColor: col, fillOpacity: 0.12, bubblingMouseEvents: false, ...style });
      if (tip) pl.bindTooltip(tip, { sticky: true }); if (click) pl.on('click', click); lg.addLayer(pl); return pl;
    };
    try {
      const tg = await Census.tractGeometry(P[0].id); if (tk !== d.token) return;
      const inD = new Set(c.tractsIn.map(t => t.geoid)), mine = tg.filter(t => inD.has(String(t.attributes.FIPS)));
      if (P.length === 1) mine.forEach(t => { const g = String(t.attributes.FIPS); mk(t, {}, tractLabel(g), () => go(1, g, tractLabel(g))); });
      else {
        const sel = tg.find(t => String(t.attributes.FIPS) === P[1].id); if (sel) mk(sel, { weight: 3, fillOpacity: 0.03, interactive: false });
        const bg = bgCache[P[1].id];
        if (bg && bg.units) bg.units.forEach(u => mk(u.feat, P[2] && P[2].id === u.geoid ? { weight: 3, fillOpacity: 0.3 } : { fillOpacity: P[2] ? 0.05 : 0.12 }, u.label, () => go(2, u.geoid, u.label)));
      }
      const b = lg.getBounds(); if (b.isValid()) S.map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
    } catch (e) { console.warn('Drill map failed', e.message); }
  }

  function init() {
    $('#detail-body').addEventListener('click', (e) => {
      const u = e.target.closest('button[data-up]'); if (u) return up(Number(u.dataset.up));
      const b = e.target.closest('button[data-drill]');
      if (b) { const lvl = { county: 0, tract: 1, bg: 2 }[b.dataset.drill]; go(lvl, b.dataset.id, b.dataset.label); }
    });
  }
  return { view, crumbsHTML, listHTML, reset, init, go, up };
})();
