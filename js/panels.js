// ════════════════════════════════════════════════════════════════
//  DETAIL PANELS — Overview · Infrastructure · Grants · Disasters · Edit
// ════════════════════════════════════════════════════════════════
let renderSeq = 0;

function setTab(tab) {
  S.tab = tab;
  $$('#detail-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderDetail();
}
function renderDetail() {
  const body = $('#detail-body'); if (!body || !CD() || !CD().loaded) return;
  const seq = ++renderSeq; body.onclick = null;
  const key = S.tab + '|' + S.selected; if (body.dataset.key !== key) { body.scrollTop = 0; body.dataset.key = key; }
  ({ overview: renderOverview, infra: renderInfra, grants: renderGrants, disasters: renderDisasters, edit: renderEdit }[S.tab] || renderOverview)(body, seq);
}
const stale = (seq) => seq !== renderSeq;

// ── helpers ──────────────────────────────────────────────────────
function addInto(a, b) { Object.keys(b).forEach(k => { if (k === 'counties') return; if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; else if (b[k] && typeof b[k] === 'object') addInto(a[k] || (a[k] = {}), b[k]); }); return a; }
function statewideSummary(r) { const o = {}; Object.values(r.byDistrict).forEach(s => addInto(o, s)); return o; }
const RACE_DEF = [['white', 'White', '#0072b2'], ['black', 'Black', '#d55e00'], ['asian', 'Asian', '#009e73'], ['aian', 'Am. Indian / Alaska Native', '#cc79a7'], ['nhpi', 'Pacific Islander', '#e69f00'], ['other', 'Other', '#56b4e9'], ['multi', 'Two or more', '#7a5195']];
const tile = (v, l, s, wide, icon) => {
  const ic = Icons.svg(icon || Icons.forLabel(l), 20);
  return `<div class="tile${wide ? ' wide' : ''}${ic ? ' has-ico' : ''}">${ic ? `<span class="ico">${ic}</span>` : ''}<div class="tx"><div class="v">${v}</div><div class="l">${esc(l)}</div>${s ? `<div class="s">${s}</div>` : ''}</div></div>`;
};
const secH = (icon, text, extra = '') => `<h2 class="sec">${Icons.svg(icon, 15)}<span>${text}</span>${extra}</h2>`;
const fmtDate = (v) => { if (v == null || v === '') return ''; if (typeof v === 'number' || /^\d{11,}$/.test(String(v))) return new Date(Number(v)).toISOString().slice(0, 10); return String(v); };

// ── OVERVIEW ─────────────────────────────────────────────────────
function renderOverview(body) {
  const d = CD();
  if (S.selected == null) return renderStatewide(body);
  const f = featureById(S.selected), p = partyOf(f), m = memberFor(f);
  const name = personName(f), cands = photoCandidates(f);
  const photo = cands.length ? `<img alt="Portrait of ${esc(name)}" src="${esc(cands[0])}" data-srcs='${esc(JSON.stringify(cands.slice(1)))}' data-ini="${esc(initials(name))}">` : esc(initials(name));
  const title = attr(f, 'title'), first = attr(f, 'firstYear') || (m && m.firstYear), lead = attr(f, 'leadership'), com = attr(f, 'committees'), web = attr(f, 'website');
  const pop = d.fmap.population ? Number(f.attributes[d.fmap.population]) : null;
  const dev = (pop && d.ideal) ? ((pop - d.ideal) / d.ideal) * 100 : null;
  const infra = cikrIn(f._id);
  body.innerHTML = `
    <div class="rep-card">
      <div class="rep-photo">${photo}</div>
      <div class="rep-info">
        <div class="district">${esc(districtLabel(f))} · ${esc(CD().cfg.short)}</div>
        <h1>${esc(name || 'Vacant / not recorded')}</h1>
        <div class="rep-meta">
          <div>${partyChip(p)} ${esc(CD().cfg.seatTitle)}${title ? ' · ' + esc(title) : ''}</div>
          ${first ? `<div>In office since ${esc(first)}</div>` : ''}
          ${m && m.hometown ? `<div>${esc(m.hometown)}</div>` : ''}
          ${lead ? `<div><b>${esc(lead)}</b></div>` : ''}
          ${web && /^https?:\/\//i.test(web) ? `<div><a href="${esc(web)}" target="_blank" rel="noopener">Official website</a></div>` : ''}
        </div>
      </div>
    </div>
    ${com ? `<div class="committees"><b>Committees:</b> ${esc(com)}</div>` : ''}
    <h2 class="sec">At a glance</h2>
    <div class="tiles">
      ${tile(fmtN(pop), 'Residents (layer)', dev != null ? `<span class="${dev > 0 ? 'delta-pos' : 'delta-neg'}">${dev > 0 ? '+' : ''}${dev.toFixed(2)}% vs. ideal ${fmtN(d.ideal)}</span>` : '')}
      ${tile(S.cikr ? fmtN(infra.length) : '…', 'Infrastructure sites', S.cikr ? `${new Set(infra.map(catOf)).size} categories` : 'loading')}
    </div>
    ${secH('chart', 'Census profile')}
    <div id="census-box">${censusHTML(f)}</div>`;
}

function renderStatewide(body) {
  const d = CD(), c = S.census[S.chamber];
  const rows = d.features.map(f => {
    const pop = d.fmap.population ? Number(f.attributes[d.fmap.population]) : null;
    const dev = (pop && d.ideal) ? ((pop - d.ideal) / d.ideal) * 100 : null;
    return `<tr><td><button type="button" data-go="${esc(f._id)}">${esc(districtNum(f._id))}</button> <span class="muted">${esc(personName(f))}</span></td><td>${fmtN(pop)}</td><td>${dev == null ? '—' : (dev > 0 ? '+' : '') + dev.toFixed(1) + '%'}</td><td>${S.cikr ? fmtN(cikrIn(f._id).length) : '…'}</td></tr>`;
  }).join('');
  body.innerHTML = `
    <h2 class="sec">${esc(d.cfg.label)}</h2>
    <div class="tiles">
      ${tile(d.features.length, 'Districts')}
      ${tile(fmtN(d.total), 'Residents (sum of layer)')}
      ${tile(fmtN(d.ideal), 'Ideal district size')}
      ${tile(S.cikr ? fmtN(S.cikr.pts.length) : '…', 'Infrastructure sites')}
    </div>
    ${c && c.status === 'ready' && Object.keys(c.result.split).length ? `<div class="note info">Counties divided between districts in this chamber: ${esc(Object.keys(c.result.split).map(k => c.result.counties[k] || k).join(', '))}.</div>` : ''}
    <h2 class="sec">All districts</h2>
    <table class="state"><thead><tr><th>District</th><th>Residents</th><th>Dev.</th><th>Sites</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted" style="margin-top:10px">Select a district on the map or in the list for the member, census profile and infrastructure.</p>`;
  body.onclick = (e) => { const b = e.target.closest('button[data-go]'); if (b) selectDistrict(b.dataset.go); };
}

function censusHTML(f) {
  const c = S.census[S.chamber];
  if (!c || c.status === 'loading') return `<div class="muted"><span class="spin"></span>${esc((c && c.msg) || 'Building census profile…')}</div>`;
  if (c.status === 'error') return `<div class="note err">Census profile unavailable: ${esc(c.error.message)}</div>`;
  const r = c.result, s = r.byDistrict[f._id];
  if (!s) return '<div class="note">No census tracts were matched to this district.</div>';
  const m = Census.metrics(s), st = Census.metrics(statewideSummary(r));
  const sw = (x, fmt) => `<span title="Statewide">TN: ${fmt(x)}</span>`;
  let html = '';
  if (!r.acsYear) {
    html += `<div class="note">${r.acsError && r.acsError.noKey ? 'Add a Census API key in <code>js/config.js</code> to load income, poverty, age, housing and race. Showing tract-based population only.' : 'ACS data could not be loaded (' + esc(r.acsError ? r.acsError.message : 'unknown') + '). Showing tract-based population only.'}</div>`;
    html += `<div class="tiles">${tile(fmtN(s.pop), 'Residents (tract estimates)')}${tile(fmtN(s.tracts), 'Census tracts')}</div>`;
  } else {
    html += `<div class="tiles">
      ${tile(fmtN(m.pop), 'Population', `ACS ${esc(r.acsYear)} 5-yr`)}
      ${tile(fmtN(m.households), 'Households', `${fmtN(m.housingUnits)} housing units`)}
      ${tile(fmtMoney(m.medianIncome), 'Median household income', sw(st.medianIncome, fmtMoney) + ' · approx.')}
      ${tile(fmtPct(m.pctPoverty), 'Below poverty level', sw(st.pctPoverty, fmtPct))}
      ${tile(fmtPct(m.pctOver65), 'Age 65 and over', sw(st.pctOver65, fmtPct))}
      ${tile(fmtPct(m.pctUnder18), 'Under 18', sw(st.pctUnder18, fmtPct))}
      ${tile(fmtPct(m.pctDisability), 'With a disability', sw(st.pctDisability, fmtPct))}
      ${tile(fmtPct(m.pctNoVehicle), 'Households with no vehicle', sw(st.pctNoVehicle, fmtPct))}
      ${tile(fmtPct(m.pctRenter), 'Renter-occupied', sw(st.pctRenter, fmtPct))}
      ${tile(fmtPct(m.unemployment), 'Unemployment rate', sw(st.unemployment, fmtPct))}
    </div>`;
    const rt = m.race.total || 0;
    if (rt) {
      html += `${secH('globe', 'Race &amp; ethnicity', ' <span style="text-transform:none;letter-spacing:0;font-weight:400">(2020 Census)</span>')}
        <div class="stack" role="img" aria-label="Race composition">${RACE_DEF.map(([k, l, col]) => `<span style="width:${(m.race[k] / rt * 100).toFixed(2)}%;background:${col}" title="${esc(l)} ${(m.race[k] / rt * 100).toFixed(1)}%"></span>`).join('')}</div>
        <div class="key">${RACE_DEF.filter(([k]) => m.race[k] / rt >= 0.005).map(([k, l, col]) => `<span><i style="background:${col}"></i>${esc(l)} ${(m.race[k] / rt * 100).toFixed(1)}%</span>`).join('')}</div>
        <p class="muted" style="margin-top:6px">Hispanic or Latino (any race): <b>${fmtPct(m.pctHispanic)}</b></p>`;
    }
  }
  // county makeup
  const counties = Object.entries(s.counties).sort((a, b) => b[1] - a[1]);
  html += `${secH('pin', 'County makeup')}<div class="county-list">${counties.map(([k, pop]) => {
    const sp = r.split[k]; const others = sp ? sp.filter(x => x !== f._id).map(districtNum).join(', ') : '';
    return `<div><span>${esc(r.counties[k] || 'County ' + k)}${sp ? `<span class="split" title="Also in District ${esc(others)}">split</span>` : ''}</span><span class="muted">${fmtN(pop)} in district</span></div>`;
  }).join('')}</div>
  <p class="muted" style="margin-top:10px">Tracts are assigned to districts by centroid, so figures for districts that divide a county are close approximations. Source: ${r.acsYear ? 'ACS ' + esc(r.acsYear) + ' 5-year and 2020 Census' : 'Esri Living Atlas tract population'}.</p>`;
  return html;
}

// ── INFRASTRUCTURE ───────────────────────────────────────────────
function renderInfra(body, seq) {
  if (!S.cikr) { body.innerHTML = '<div class="empty"><span class="spin"></span>Loading infrastructure layer…</div>'; return; }
  const all = S.selected != null ? cikrIn(S.selected) : S.cikr.pts;
  const counts = {}; all.forEach(p => { const k = catOf(p); counts[k] = (counts[k] || 0) + 1; });
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]), max = Math.max(1, ...Object.values(counts));
  const list = (S.catFilter ? all.filter(p => catOf(p) === S.catFilter) : all).slice().sort((a, b) => facName(a).localeCompare(facName(b)));
  const canEditCikr = AG.canEdit(S.cikr.meta);
  body.innerHTML = `
    <div class="tiles">${tile(fmtN(all.length), S.selected != null ? `Sites in ${districtLabel(featureById(S.selected))}` : 'Sites statewide')}${tile(cats.length, 'Categories')}</div>
    <h2 class="sec">By category ${S.catFilter ? '<button type="button" class="pill" id="clear-cat" style="margin-left:6px">Clear filter</button>' : ''}</h2>
    <div>${cats.map(c => `<div class="bar-row${S.catFilter === c ? ' sel' : ''}"><button type="button" data-cat="${esc(c)}" aria-pressed="${S.catFilter === c}"><span>${catBadge(c, 18)}${esc(c)}</span><div class="bar"><i style="width:${counts[c] / max * 100}%;background:${S.cikr.color[c]}"></i></div></button><span class="n">${counts[c]}</span></div>`).join('') || '<div class="empty">No infrastructure sites in this district.</div>'}</div>
    <h2 class="sec">Facilities (${list.length})</h2>
    ${list.slice(0, 150).map(p => `<div class="row-item"><button type="button" class="row-item clickable" style="border:0;padding:0;margin:0" data-oid="${p.oid}"><h3>${catBadge(catOf(p), 18)}${esc(facName(p))}</h3><div class="sub">${esc(catOf(p))}${S.cikr.f.notes && p.a[S.cikr.f.notes] ? ' — ' + esc(p.a[S.cikr.f.notes]) : ''}</div></button>${canEditCikr ? `<div class="btn-row"><button type="button" class="btn btn-sm" data-edit="${p.oid}">Edit</button></div>` : ''}</div>`).join('')}
    ${list.length > 150 ? `<p class="muted">Showing the first 150 of ${list.length}. Filter by category or select a district to narrow the list.</p>` : ''}`;
  body.onclick = (e) => {
    const c = e.target.closest('button[data-cat]'); if (c) { S.catFilter = S.catFilter === c.dataset.cat ? null : c.dataset.cat; renderCikrMarkers(); return renderDetail(); }
    if (e.target.closest('#clear-cat')) { S.catFilter = null; renderCikrMarkers(); return renderDetail(); }
    const ed = e.target.closest('button[data-edit]'); if (ed) { S.editingFacility = Number(ed.dataset.edit); S.pending = null; return setTab('edit'); }
    const o = e.target.closest('button[data-oid]'); if (o) focusFacility(Number(o.dataset.oid));
  };
}

// ── GRANTS ───────────────────────────────────────────────────────
S.grants = { year: null, years: null, layers: {} };
function detectDistrictField(meta, ch, override, kind) {
  const names = AG.fieldNames(meta);
  const pref = [override, CONFIG.joinFields && CONFIG.joinFields[kind] && CONFIG.joinFields[kind][ch]].filter(Boolean);
  for (const n of pref) { const r = AG.realField(meta, n); if (r) return r; }
  const re = { congress: /cong/i, senate: /sen/i, house: /house|hse/i }[ch];
  return names.find(n => re.test(n)) || names.find(n => /^district$/i.test(n)) || null;
}
// Every plausible way the layers might spell this district: District_Filter, LongName, "1", "01", "District 1"…
function districtKeys(f, ch = S.chamber) {
  const n = districtNum(f._id), p2 = String(n).padStart(2, '0');
  const vals = [attr(f, 'filter', ch), attr(f, 'longName', ch), f._id, String(n), p2, `District ${n}`, `District ${p2}`];
  return [...new Set(vals.filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim()))];
}
function whereDistrict(meta, field, f) {
  const fd = meta.fields.find(x => x.name === field);
  if (fd && /Integer|Double|Single|SmallInteger/.test(fd.type)) return `${field} = ${districtNum(f._id)}`;
  return `${field} IN (${districtKeys(f).map(v => `'${v.replace(/'/g, "''")}'`).join(',')})`;
}
async function layerInfo(key, itemId, override) {
  const L = S.grants.layers;
  if (!L[key]) L[key] = (async () => {
    const url = await AG.layerUrlFromItem(itemId), meta = await AG.meta(url);
    return { url, meta, distField: detectDistrictField(meta, S.chamber, override, 'grants') };
  })().catch(e => { delete L[key]; throw e; });
  const info = await L[key];
  info.distField = detectDistrictField(info.meta, S.chamber, override, 'grants'); // chamber can change
  return info;
}
async function grantYears() {
  if (S.grants.years) return S.grants.years;
  try {
    const g = CONFIG.grants[0], info = await layerInfo(g.key, g.itemId), yf = AG.realField(info.meta, CONFIG.grantFields.year);
    const d = await AG.request(info.url + '/query', { where: '1=1', outFields: yf, returnDistinctValues: 'true', returnGeometry: 'false' });
    const ys = d.features.map(x => Number(x.attributes[yf])).filter(Boolean).sort((a, b) => a - b);
    S.grants.years = ys.length ? ys : CONFIG.fiscalYears;
  } catch { S.grants.years = CONFIG.fiscalYears; }
  if (!S.grants.year) S.grants.year = S.grants.years[S.grants.years.length - 1];
  return S.grants.years;
}
async function grantTotal(g, f) {
  const info = await layerInfo(g.key, g.itemId, CONFIG.grantDistrictField);
  const yf = AG.realField(info.meta, CONFIG.grantFields.year), af = AG.realField(info.meta, CONFIG.grantFields.amount);
  if (!af) throw new Error(`No "${CONFIG.grantFields.amount}" field`);
  const yfd = info.meta.fields.find(x => x.name === yf);
  const where = [yf ? (yfd && yfd.type === 'esriFieldTypeString' ? `${yf} = '${S.grants.year}'` : `${yf} = ${S.grants.year}`) : '1=1'];
  if (info.distField) {
    where.push(whereDistrict(info.meta, info.distField, f));
    const d = await AG.request(info.url + '/query', { where: where.join(' AND '), returnGeometry: 'false', outStatistics: JSON.stringify([{ statisticType: 'sum', onStatisticField: af, outStatisticFieldName: 'S' }, { statisticType: 'count', onStatisticField: info.meta.objectIdField || 'OBJECTID', outStatisticFieldName: 'C' }]) });
    const a = (d.features[0] || {}).attributes || {}; return { sum: a.S, count: a.C || 0, mode: 'field' };
  }
  if (/Point/.test(info.meta.geometryType || '')) {
    const rows = await AG.queryAll(info.url, { where: where.join(' AND '), outFields: af }, { pageSize: 1000 });
    const inD = rows.filter(r => r.geometry && AG.featureContains(f, r.geometry.x, r.geometry.y));
    return { sum: inD.reduce((t, r) => t + (Number(r.attributes[af]) || 0), 0), count: inD.length, mode: 'spatial' };
  }
  return { sum: null, count: 0, mode: 'none' };
}
async function renderGrants(body, seq) {
  if (S.selected == null) { body.innerHTML = '<div class="empty">Select a district to show grant funds.</div>'; return; }
  body.innerHTML = '<div class="empty"><span class="spin"></span>Loading grant totals…</div>';
  const f = featureById(S.selected), ch = S.chamber;
  try {
    const years = await grantYears(); if (stale(seq)) return;
    const results = await Promise.all(CONFIG.grants.map(g => grantTotal(g, f).catch(e => ({ error: e.message }))));
    if (stale(seq)) return;
    const none = results.every(r => r.mode === 'none');
    body.innerHTML = `
      <h2 class="sec">Fiscal year</h2>
      <div class="pills" role="group" aria-label="Fiscal year">${years.map(y => `<button type="button" class="pill" data-year="${y}" aria-pressed="${y === S.grants.year}">${y}</button>`).join('')}</div>
      ${CONFIG.grants.map((g, i) => { const r = results[i]; return `<div class="grant"><div class="g-l"><span>${esc(g.key)} — ${esc(g.label)}</span><span>${r.error ? '' : fmtN(r.count) + ' awards'}</span></div><div class="g-v">${r.error ? '<span style="font-size:13px;font-weight:500">' + esc(r.error) + '</span>' : (r.count ? fmtMoney2(r.sum) : '—')}</div></div>`; }).join('')}
      ${none ? `<div class="note">These grant layers have no district field and no point geometry, so awards can't be tied to ${esc(CD().cfg.short)} districts. Add a district field (or set <code>grantDistrictField</code> in config.js).</div>` : ''}
      ${results.some(r => r.mode === 'spatial') ? '<p class="muted">Awards located by point-in-district.</p>' : ''}
      ${results.every(r => r.count === 0 && !r.error) ? `<p class="muted">No funding totals for ${S.grants.year}.</p>` : ''}`;
    body.onclick = (e) => { const b = e.target.closest('button[data-year]'); if (b) { S.grants.year = Number(b.dataset.year); renderDetail(); } };
  } catch (e) { if (!stale(seq)) body.innerHTML = `<div class="note err">${esc(e.message)}</div>`; if (e.tokenExpired) onFatal(e); }
}

// ── DISASTERS ────────────────────────────────────────────────────
function parseCounties(raw) {
  const s = String(raw ?? '');
  if (/<table/i.test(s)) {
    const doc = new DOMParser().parseFromString(s, 'text/html');
    const rows = [...doc.querySelectorAll('tr')].map(tr => [...tr.children].map(c => c.textContent.trim()));
    return { table: rows, names: rows.slice(1).map(r => r[0]).filter(Boolean) };
  }
  const text = (new DOMParser().parseFromString(s, 'text/html').body.textContent || '');
  return { table: null, text, names: text.split(/[,;\n]/).map(x => x.replace(/ County$/i, '').trim()).filter(Boolean) };
}
async function loadDisasters() {
  if (S.disasters) return S.disasters;
  S.disasters = (async () => {
    const cfg = CONFIG.disasters, url = await AG.layerUrlFromItem(cfg.itemId), meta = await AG.meta(url);
    const df = AG.realField(meta, 'disaster_date');
    const rows = await AG.queryAll(url, { outFields: '*', returnGeometry: 'false', ...(df ? { orderByFields: df + ' DESC' } : {}) }, { pageSize: 500 });
    return { url, meta, rows: rows.map(r => r.attributes) };
  })().catch(e => { S.disasters = null; throw e; });
  return S.disasters;
}
async function renderDisastersLayer(body, seq) {
  if (S.selected == null) { body.innerHTML = '<div class="empty">Select a district to view its disaster declarations.</div>'; return; }
  body.innerHTML = '<div class="empty"><span class="spin"></span>Loading disaster declarations…</div>';
  const f = featureById(S.selected);
  try {
    const D = await loadDisasters(); if (stale(seq)) return;
    const fld = (n) => AG.realField(D.meta, n);
    const distF = detectDistrictField(D.meta, S.chamber, CONFIG.disasters.districtField, 'disasters');
    let rows, method;
    let diag = '';
    if (distF) {
      const want = new Set(districtKeys(f).map(x => x.toLowerCase()));
      // a cell may hold one district or a delimited list of them
      rows = D.rows.filter(r => { const cell = String(r[distF] ?? '').trim().toLowerCase(); return want.has(cell) || cell.split(/[,;|]/).some(t => want.has(t.trim())); });
      method = 'district field';
      if (!rows.length) diag = `<div class="note">No records matched on field <b>${esc(distF)}</b> for any of: ${esc(districtKeys(f).join(' · '))}.<br>Values found in that field include: ${esc([...new Set(D.rows.map(r => String(r[distF] ?? '')))].slice(0, 8).join(' · ') || '(empty)')}.</div>`;
    }
    else {
      const names = new Set(countyNamesFor(f._id).map(x => x.toLowerCase()));
      if (!names.size) { const c = S.census[S.chamber]; if (!c || c.status !== 'ready') { body.innerHTML = '<div class="empty"><span class="spin"></span>Waiting for county makeup…</div>'; setTimeout(() => { if (!stale(seq)) renderDetail(); }, 1500); return; } }
      rows = D.rows.filter(r => parseCounties(r[fld('counties')]).names.some(n => names.has(n.toLowerCase().replace(/ county$/i, ''))));
      method = 'counties';
    }
    const cn = fld('counties'), num = fld('disaster_number'), ty = fld('disaster_type'), dt = fld('disaster_date');
    body.innerHTML = `
      <div class="tiles">${tile(fmtN(rows.length), 'Declared disasters')}</div>
      ${diag}
      ${method === 'counties' ? '<div class="note info">Matched by county (these records have no district field). Counties shared with another district appear in both.</div>' : ''}
      <h2 class="sec">Declarations</h2>
      ${rows.slice(0, 100).map(r => {
        const pc = parseCounties(r[cn]);
        const inD = new Set(countyNamesFor(f._id).map(x => x.toLowerCase()));
        let detail;
        if (pc.table && pc.table.length > 1) {
          const rws = pc.table.slice(1).filter(x => method !== 'counties' || !inD.size || inD.has((x[0] || '').toLowerCase().replace(/ county$/i, '')));
          detail = `<table class="mini"><thead><tr>${pc.table[0].map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rws.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        } else detail = `<div class="sub">${esc(pc.text || pc.names.join(', '))}</div>`;
        return `<div class="row-item"><h3>Disaster #${esc(r[num])} ${esc(r[ty])}</h3><div class="sub">${esc(fmtDate(r[dt]))}</div>${detail}</div>`;
      }).join('') || '<div class="empty">No disaster listings for this district.</div>'}
      ${rows.length > 100 ? `<p class="muted">Showing the 100 most recent of ${rows.length}.</p>` : ''}`;
  } catch (e) { if (!stale(seq)) body.innerHTML = `<div class="note err">${esc(e.message)}</div>`; if (e.tokenExpired) onFatal(e); }
}

// ── EDIT CONSOLE ─────────────────────────────────────────────────
function updateEditTab() {
  const d = CD(), dEdit = d && d.loaded && AG.canEdit(d.meta), cEdit = S.cikr && (AG.canEdit(S.cikr.meta) || AG.canCreate(S.cikr.meta));
  $('#tab-edit').hidden = !(dEdit || cEdit);
  if ($('#tab-edit').hidden && S.tab === 'edit') setTab('overview');
}
const REP_FIELDS = [['name', 'Name (as displayed)', 'text'], ['party', 'Party (R / D / I)', 'text'], ['title', 'Title', 'text'], ['firstYear', 'First year in office', 'number'],
  ['leadership', 'Leadership position', 'text'], ['committees', 'Committees', 'textarea'], ['photo', 'Photo (path or URL)', 'text'], ['website', 'Website', 'text'], ['bioguide', 'Bioguide ID', 'text']];
const inputHTML = (id, label, type, val, extra = '') => `<div class="input-row"><label for="${id}">${esc(label)}</label>${type === 'textarea' ? `<textarea id="${id}" ${extra}>${esc(val ?? '')}</textarea>` : `<input id="${id}" type="${type}" value="${esc(val ?? '')}" ${extra}>`}</div>`;

function renderEdit(body) {
  const d = CD(), dEdit = AG.canEdit(d.meta), cEdit = S.cikr && AG.canEdit(S.cikr.meta);
  let html = '';
  // — representative record
  html += '<h2 class="sec">Member record</h2>';
  if (!dEdit) html += `<div class="note">You don't have permission to edit the ${esc(d.cfg.short)} district layer.</div>`;
  else if (S.selected == null) html += '<div class="empty" style="padding:12px">Select a district to edit its member record.</div>';
  else {
    const f = featureById(S.selected);
    html += `<p class="muted" style="margin-bottom:8px">${esc(districtLabel(f))} — changes save to the ${esc(d.cfg.short)} district layer.</p>`;
    // portrait upload (stored as an attachment on the district feature)
    const up = d.photos && d.photos.get(f._id), pc = photoCandidates(f);
    html += `<div class="rep-card" style="margin-bottom:14px"><div class="rep-photo" style="width:84px;height:104px;font-size:22px">${pc.length ? `<img alt="" src="${esc(pc[0])}" data-srcs='${esc(JSON.stringify(pc.slice(1)))}' data-ini="${esc(initials(personName(f)))}">` : esc(initials(personName(f)))}</div>
      <div style="flex:1">${d.meta.hasAttachments
        ? `<div class="input-row"><label for="photo-file">Portrait (JPG or PNG)</label><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp"></div>
           <div class="btn-row"><button type="button" class="btn btn-primary btn-sm" id="upload-photo">Upload portrait</button>${up ? '<button type="button" class="btn btn-sm" id="remove-photo">Remove uploaded</button>' : ''}</div>
           <p class="muted" style="margin-top:6px">Resized automatically. ${up ? 'Shown instead of the default photo.' : 'Overrides the default photo once uploaded.'}</p>`
        : '<div class="note" style="margin:0">Turn on <b>Attachments</b> for this layer in ArcGIS Online to enable portrait uploads.</div>'}</div></div>`;
    html += REP_FIELDS.filter(([k]) => d.fmap[k]).map(([k, l, t]) => inputHTML('ef-' + k, l, t, f.attributes[d.fmap[k]])).join('');
    html += '<div class="btn-row"><button type="button" class="btn btn-primary" id="save-rep">Save member record</button></div>';
    const missing = REP_FIELDS.filter(([k]) => !d.fmap[k]).map(([k]) => CONFIG.districtFields[k]);
    if (missing.length) html += `<div class="note">Fields not on this layer (add them in ArcGIS Online to edit them here): <b>${esc(missing.join(', '))}</b></div>`;
    html += `<p class="muted">Photo tip: put the image in <code>${esc(d.cfg.photoDir)}</code> in the GitHub repo and enter the path, e.g. <code>${esc(d.cfg.photoDir)}name.jpg</code>.</p>`;
  }
  // — infrastructure
  html += '<h2 class="sec">Infrastructure layer</h2>';
  if (!S.cikr) html += '<div class="muted"><span class="spin"></span>Loading…</div>';
  else if (!(AG.canEdit(S.cikr.meta) || AG.canCreate(S.cikr.meta))) html += '<div class="note">You don\'t have permission to edit the infrastructure layer.</div>';
  else {
    const cats = `<datalist id="cat-list">${S.cikr.categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
    if (S.pending) {
      html += `<div class="note info">New facility at ${S.pending.y.toFixed(5)}, ${S.pending.x.toFixed(5)}</div>${cats}
        ${inputHTML('nf-name', 'Facility name', 'text', '')}${inputHTML('nf-cat', 'Category', 'text', '', 'list="cat-list"')}${inputHTML('nf-notes', 'Notes', 'textarea', '')}
        <div class="btn-row"><button type="button" class="btn btn-primary" id="save-new">Add facility</button><button type="button" class="btn" id="cancel-pick">Cancel</button></div>`;
    } else if (S.editingFacility != null) {
      const p = S.cikr.pts.find(x => x.oid === S.editingFacility);
      if (!p) { S.editingFacility = null; }
      else html += `<div class="note info">Editing: <b>${esc(facName(p))}</b></div>${cats}
        ${S.cikr.f.name ? inputHTML('fe-name', 'Facility name', 'text', p.a[S.cikr.f.name]) : ''}${S.cikr.f.category ? inputHTML('fe-cat', 'Category', 'text', p.a[S.cikr.f.category], 'list="cat-list"') : ''}${S.cikr.f.notes ? inputHTML('fe-notes', 'Notes', 'textarea', p.a[S.cikr.f.notes]) : ''}
        <div class="btn-row"><button type="button" class="btn btn-primary" id="save-fac">Save</button>${AG.canEdit(S.cikr.meta) ? '<button type="button" class="btn" id="move-fac">Move on map</button>' : ''}${AG.canDelete(S.cikr.meta) ? '<button type="button" class="btn btn-danger" id="del-fac">Delete</button>' : ''}<button type="button" class="btn" id="done-fac">Done</button></div>`;
    }
    if (!S.pending && S.editingFacility == null) {
      html += `<p class="muted" style="margin-bottom:8px">${S.pickMode === 'add' ? 'Click the map to place the new facility…' : 'Add a new site, or open the Infrastructure tab and choose Edit on an existing one.'}</p>
        <div class="btn-row">${AG.canCreate(S.cikr.meta) ? `<button type="button" class="btn btn-primary" id="add-fac">${S.pickMode === 'add' ? 'Cancel placing' : 'Add facility'}</button>` : ''}</div>`;
    }
    if (S.pickMode === 'move') html += '<div class="note info">Click the new location on the map…</div>';
  }
  // — schema check
  const miss = [];
  ['name', 'category', 'notes'].forEach(k => { if (S.cikr && !S.cikr.f[k]) miss.push(CONFIG.cikr[k + 'Field']); });
  if (miss.length) html += `<div class="note">Infrastructure layer is missing fields: <b>${esc(miss.join(', '))}</b></div>`;
  body.innerHTML = html;
  wireEdit(body);
}

function wireEdit(body) {
  const d = CD(), val = (id) => { const e = $('#' + id, body); return e ? e.value.trim() : undefined; };
  const click = (id, fn) => { const b = $('#' + id, body); if (b) b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { onFatal(e); } finally { b.disabled = false; } }; };

  click('save-rep', async () => {
    const f = featureById(S.selected), attrs = {};
    REP_FIELDS.filter(([k]) => d.fmap[k]).forEach(([k, , t]) => {
      let v = val('ef-' + k); if (v === '') v = null; else if (t === 'number') v = Number(v);
      if (k === 'party' && v) v = String(v).toUpperCase();
      const old = f.attributes[d.fmap[k]]; if ((old ?? null) !== v && !(old == null && v == null)) attrs[d.fmap[k]] = v;
    });
    if (!Object.keys(attrs).length) return toast('No changes to save.');
    attrs[d.meta.objectIdField || 'OBJECTID'] = f.attributes[d.meta.objectIdField || 'OBJECTID'];
    await AG.applyEdits(d.cfg.url, { updates: [{ attributes: attrs }] });
    Object.assign(f.attributes, attrs);
    toast('Member record saved.'); renderList(); S.polys[f._id] && S.polys[f._id].setTooltipContent(`${districtLabel(f)} — ${personName(f)}`); renderDetail();
  });
  click('upload-photo', async () => {
    const file = $('#photo-file', body).files[0];
    if (!file) return toast('Choose an image first.', true);
    if (file.size > 15 * 1024 * 1024) return toast('Image is over 15 MB.', true);
    const f = featureById(S.selected), oid = f.attributes[d.meta.objectIdField || 'OBJECTID'], old = (d.photos.get(f._id) || {}).all || [];
    const blob = await resizePortrait(file);
    await AG.addAttachment(d.cfg.url, oid, blob, `portrait-${Date.now()}.jpg`);
    if (old.length) await AG.deleteAttachments(d.cfg.url, oid, old).catch(e => console.warn('Old portrait not removed:', e.message));
    await loadPhotos(S.chamber); toast('Portrait uploaded.'); renderList(); renderDetail();
  });
  click('remove-photo', async () => {
    const f = featureById(S.selected), up = d.photos.get(f._id); if (!up) return;
    if (!confirm('Remove the uploaded portrait for this district?')) return;
    await AG.deleteAttachments(d.cfg.url, up.oid, up.all);
    d.photos.delete(f._id); toast('Portrait removed.'); renderList(); renderDetail();
  });
  click('add-fac', async () => { S.pickMode = S.pickMode === 'add' ? null : 'add'; $('#map').classList.toggle('picking', !!S.pickMode); renderDetail(); });
  click('cancel-pick', async () => { cancelPick(); renderDetail(); });
  click('save-new', async () => {
    const c = S.cikr, attrs = {};
    if (c.f.name) attrs[c.f.name] = val('nf-name') || null; if (c.f.category) attrs[c.f.category] = val('nf-cat') || null; if (c.f.notes) attrs[c.f.notes] = val('nf-notes') || null;
    if (c.f.name && !attrs[c.f.name]) return toast('Enter a facility name.', true);
    await AG.applyEdits(CONFIG.cikr.url, { adds: [{ attributes: attrs, geometry: { x: S.pending.x, y: S.pending.y, spatialReference: { wkid: 4326 } } }] });
    cancelPick(); toast('Facility added.'); await reloadCikr();
  });
  click('save-fac', async () => {
    const c = S.cikr, p = c.pts.find(x => x.oid === S.editingFacility), attrs = { [c.oidField]: p.oid };
    if (c.f.name) attrs[c.f.name] = val('fe-name') || null; if (c.f.category) attrs[c.f.category] = val('fe-cat') || null; if (c.f.notes) attrs[c.f.notes] = val('fe-notes') || null;
    await AG.applyEdits(CONFIG.cikr.url, { updates: [{ attributes: attrs }] });
    toast('Facility saved.'); await reloadCikr();
  });
  click('move-fac', async () => { S.pickMode = 'move'; $('#map').classList.add('picking'); renderDetail(); });
  click('del-fac', async () => {
    const p = S.cikr.pts.find(x => x.oid === S.editingFacility);
    if (!confirm(`Delete "${facName(p)}" from the infrastructure layer? This cannot be undone.`)) return;
    await AG.applyEdits(CONFIG.cikr.url, { deletes: [p.oid] });
    S.editingFacility = null; toast('Facility deleted.'); await reloadCikr();
  });
  click('done-fac', async () => { S.editingFacility = null; renderDetail(); });
}
// Downscale to at most 450×560 (keeps aspect) and re-encode as JPEG so uploads stay small.
async function resizePortrait(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 450 / bmp.width, 560 / bmp.height), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('Could not process image')), 'image/jpeg', 0.88));
}
function cancelPick() { S.pickMode = null; S.pending = null; S.layers.pending.clearLayers(); $('#map').classList.remove('picking'); }
async function onMapPick(e) {
  const { lat, lng } = e.latlng;
  if (S.pickMode === 'add') {
    S.pending = { x: lng, y: lat }; S.pickMode = null; $('#map').classList.remove('picking');
    S.layers.pending.clearLayers(); L.marker([lat, lng]).addTo(S.layers.pending);
    renderDetail();
  } else if (S.pickMode === 'move') {
    const p = S.cikr.pts.find(x => x.oid === S.editingFacility); S.pickMode = null; $('#map').classList.remove('picking');
    try { await AG.applyEdits(CONFIG.cikr.url, { updates: [{ attributes: { [S.cikr.oidField]: p.oid }, geometry: { x: lng, y: lat, spatialReference: { wkid: 4326 } } }] }); toast('Facility moved.'); await reloadCikr(); }
    catch (err) { onFatal(err); renderDetail(); }
  }
}
async function reloadCikr() {
  const keep = S.editingFacility; S.cikr = null; // points are re-queried; layer metadata stays cached
  await loadCikr(); indexCikr(); renderCikrMarkers(); renderList(); S.editingFacility = S.cikr.pts.some(p => p.oid === keep) ? keep : null; renderDetail();
}


// ── DISASTERS from OpenFEMA ──────────────────────────────────────
// One OpenFEMA row = one county in one declaration. Group by disaster number, then keep the
// declarations that include at least one county in the selected district (matched by county FIPS).
async function loadFema() {
  if (S.fema) return S.fema;
  S.fema = (async () => {
    const c = CONFIG.disasters, rows = [], top = 1000;
    for (let skip = 0; skip < 20000; skip += top) {
      const q = `$filter=${encodeURIComponent(`state eq '${c.state}'`)}&$orderby=${encodeURIComponent('declarationDate desc')}&$top=${top}&$skip=${skip}&$format=json`;
      const res = await fetch(`${c.femaUrl}?${q}`);
      if (!res.ok) throw new Error(`OpenFEMA HTTP ${res.status}`);
      const j = await res.json(), page = j.DisasterDeclarationsSummaries || [];
      rows.push(...page); if (page.length < top) break;
    }
    const by = new Map();
    rows.forEach(r => {
      const n = r.disasterNumber; if (n == null) return;
      let d = by.get(n);
      if (!d) by.set(n, d = { number: n, id: r.femaDeclarationString, kind: r.declarationType, title: r.declarationTitle, type: r.incidentType, date: r.declarationDate, begin: r.incidentBeginDate, end: r.incidentEndDate, areas: new Map() });
      const fips = String(r.fipsCountyCode || '').padStart(3, '0');
      if (fips === '000') return;                       // statewide / tribal placeholders
      d.areas.set(fips, { name: String(r.designatedArea || '').replace(/\s*\(County\)\s*$/i, ''), ia: !!(r.iaProgramDeclared), pa: !!r.paProgramDeclared, hm: !!r.hmProgramDeclared });
    });
    return [...by.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  })().catch(e => { S.fema = null; throw e; });
  return S.fema;
}
async function renderDisasters(body, seq) {
  if (CONFIG.disasters.source !== 'fema') return renderDisastersLayer(body, seq);
  if (S.selected == null) { body.innerHTML = '<div class="empty">Select a district to view its disaster declarations.</div>'; return; }
  const f = featureById(S.selected), c = S.census[S.chamber];
  if (!c || c.status === 'loading') { body.innerHTML = '<div class="empty"><span class="spin"></span>Working out which counties are in this district…</div>'; setTimeout(() => { if (!stale(seq)) renderDetail(); }, 1200); return; }
  if (c.status === 'error') return renderDisastersLayer(body, seq);   // can't derive counties → fall back to the layer
  const s0 = c.result.byDistrict[f._id], inD = new Set(s0 ? Object.keys(s0.counties) : []);
  body.innerHTML = '<div class="empty"><span class="spin"></span>Loading FEMA declarations…</div>';
  try {
    const all = await loadFema(); if (stale(seq)) return;
    const rows = all.filter(d => [...d.areas.keys()].some(k => inD.has(k)));
    const dr = rows.filter(d => d.kind === 'DR').length, em = rows.filter(d => d.kind === 'EM').length;
    const kindName = { DR: 'Major Disaster', EM: 'Emergency', FM: 'Fire Management' };
    const yes = (b) => b ? 'Y' : '-';
    body.innerHTML = `
      <div class="tiles">${tile(fmtN(rows.length), 'Declared disasters', `${dr} major · ${em} emergency`)}${tile(fmtN(inD.size), 'Counties in district', 'matched by FIPS code')}</div>
      <p class="muted" style="margin-top:8px">Source: OpenFEMA Disaster Declarations Summaries. Counties shared with another district appear in both.</p>
      ${secH('storm', 'Declarations')}
      ${rows.slice(0, 100).map(d => {
        const areas = [...d.areas.entries()].filter(([k]) => inD.has(k)).sort((a, b) => a[1].name.localeCompare(b[1].name));
        return `<div class="row-item"><h3>${esc(d.id || 'Disaster #' + d.number)} · ${esc(d.type || '')}</h3>
          <div class="sub">${esc(d.title || '')}${d.kind ? ' — ' + esc(kindName[d.kind] || d.kind) : ''}</div>
          <div class="sub">Declared ${esc(fmtDate(d.date).slice(0, 10))}${d.begin ? ' · incident began ' + esc(fmtDate(d.begin).slice(0, 10)) : ''}</div>
          <table class="mini"><thead><tr><th>County</th><th>IA</th><th>PA</th><th>HM</th></tr></thead><tbody>${areas.map(([, a]) => `<tr><td>${esc(a.name)}</td><td>${yes(a.ia)}</td><td>${yes(a.pa)}</td><td>${yes(a.hm)}</td></tr>`).join('')}</tbody></table></div>`;
      }).join('') || '<div class="empty">No disaster declarations for this district.</div>'}
      ${rows.length > 100 ? `<p class="muted">Showing the 100 most recent of ${rows.length}.</p>` : ''}`;
  } catch (e) {
    if (stale(seq)) return;
    console.warn('OpenFEMA failed, falling back to layer:', e);
    toast('OpenFEMA unavailable (' + e.message + ') — using the internal layer.', true);
    renderDisastersLayer(body, seq);
  }
}
