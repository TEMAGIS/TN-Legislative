// ════════════════════════════════════════════════════════════════
//  APP CORE — state, boot, map, district list
//  (detail panels and the edit console live in panels.js)
// ════════════════════════════════════════════════════════════════
const S = {
  chamber: 'congress', selected: null, tab: 'overview', search: '',
  members: { congress: [], senate: [], house: [] },
  data: {},            // chamber → { cfg, meta, fmap, features, ideal, total, loaded }
  cikr: null,          // { meta, f:{name,category,notes}, pts:[], categories:[], color:{} }
  cikrIdx: {},         // chamber → Map(districtId → pts[])
  census: {},          // chamber → { status, result, error }
  catFilter: null, map: null, layers: {}, polys: {}, pickMode: null, editingFacility: null,
};

// Edit mode is opt-in via ?edit=1 (share that URL with editors; the plain URL is the read-only viewer).
// It is remembered for the browser session because the OAuth redirect drops the query string.
// This only shows/hides the editing UI — what a user can actually save is still decided by the layer's permissions.
const EDIT_MODE = (() => {
  const q = new URLSearchParams(location.search).get('edit');
  try {
    if (q === '1') sessionStorage.setItem('legapp_edit', '1'); else if (q === '0') sessionStorage.removeItem('legapp_edit');
    return sessionStorage.getItem('legapp_edit') === '1';
  } catch { return q === '1'; }
})();

// ── tiny utilities ───────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('en-US');
const fmtPct = (n, d = 1) => (n == null || isNaN(n)) ? '—' : n.toFixed(d) + '%';
const fmtMoney = (n) => (n == null || isNaN(n)) ? '—' : '$' + Math.round(n).toLocaleString('en-US');
const fmtMoney2 = (n) => (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let toastTimer;
function toast(msg, isErr) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, isErr ? 6000 : 3000);
}
function onFatal(e) {
  console.error(e);
  if (e && e.tokenExpired) { Auth.clear(); showLogin('Your session expired — please sign in again.'); return; }
  toast(e && e.message ? e.message : String(e), true);
}

// ── data accessors ───────────────────────────────────────────────
const CD = (ch = S.chamber) => S.data[ch];
function attr(f, key, ch = S.chamber) { const n = CD(ch).fmap[key]; return n ? f.attributes[n] : undefined; }
const normId = (v) => String(v ?? '').trim().replace(/^0+(?=\d)/, '');
const districtNum = (id) => { const n = parseInt(id, 10); return isNaN(n) ? id : n; };
const districtLabel = (f, ch = S.chamber) => attr(f, 'longName', ch) || `District ${districtNum(f._id)}`;
function featureById(id, ch = S.chamber) { return CD(ch).features.find(f => f._id === String(id)); }
const stripTitle = (s) => String(s || '').replace(/^(Representative|Senator|Rep\.|Sen\.|Congressman|Congresswoman)\s+/i, '').trim();

function memberFor(f, ch = S.chamber) {
  const list = S.members[ch] || [];
  const nm = String(attr(f, 'name', ch) || '').toLowerCase().replace(/[^a-z]/g, '');
  if (nm) { const m = list.find(m => nm.includes(m.slug)); if (m) return m; }
  return null;
}
const personName = (f, ch = S.chamber) => stripTitle(attr(f, 'name', ch)) || (memberFor(f, ch) || {}).name || '';
function partyOf(f, ch = S.chamber) {
  const p = String(attr(f, 'party', ch) || (memberFor(f, ch) || {}).party || '').trim().toUpperCase();
  return p ? (p[0] === 'R' ? 'R' : p[0] === 'D' ? 'D' : p[0] === 'I' ? 'I' : 'U') : null;
}
const partyChip = (p) => p ? `<span class="party ${p}" title="${{ R: 'Republican', D: 'Democratic', I: 'Independent', U: 'Other' }[p]}">${p}</span>` : '';
const initials = (s) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function photoCandidates(f, ch = S.chamber) {
  const cfg = CONFIG.chambers[ch], out = [], m = memberFor(f, ch);
  // 1) portrait uploaded through the Edit console (stored as a layer attachment)
  const up = CD(ch).photos && CD(ch).photos.get(f._id);
  if (up) out.push(AG.attachmentUrl(CD(ch).cfg.url, up.oid, up.id));
  const own = attr(f, 'photo', ch); if (own) out.push(own);
  if (m) {
    out.push(`${cfg.photoDir}${m.slug}.jpg`);
    if (m.bioguide) out.push(`https://unitedstates.github.io/images/congress/450x550/${m.bioguide}.jpg`);
  } else if (ch !== 'congress') out.push(`${cfg.photoDir}${String(districtNum(f._id)).padStart(2, '0')}.jpg`);
  return out;
}
function avatarHTML(f, ch, cls = '') {
  const c = photoCandidates(f, ch), ini = initials(personName(f, ch) || districtNum(f._id));
  if (!c.length) return `<div class="avatar ${cls}" aria-hidden="true">${esc(ini)}</div>`;
  return `<div class="avatar ${cls}" aria-hidden="true"><img alt="" loading="lazy" src="${esc(c[0])}" data-srcs='${esc(JSON.stringify(c.slice(1)))}' data-ini="${esc(ini)}"></div>`;
}
// Walk the candidate list when an image 404s; fall back to initials.
function wirePhotoFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.ini) return;
    let rest = []; try { rest = JSON.parse(img.dataset.srcs || '[]'); } catch {}
    if (rest.length) { img.dataset.srcs = JSON.stringify(rest.slice(1)); img.src = rest[0]; }
    else { const p = img.parentElement; if (p) p.textContent = img.dataset.ini; }
  }, true);
}

// ── loading ──────────────────────────────────────────────────────
async function loadChamber(ch) {
  const d = S.data[ch] || (S.data[ch] = { cfg: CONFIG.chambers[ch] });
  if (d.loaded) return d;
  if (d.loading) return d.loading;
  d.loading = (async () => {
    d.meta = await AG.meta(d.cfg.url);
    d.fmap = {};
    Object.entries(CONFIG.districtFields).forEach(([k, n]) => { d.fmap[k] = AG.realField(d.meta, n); });
    if (!d.fmap.id) throw new Error(`${d.cfg.short} layer has no "${CONFIG.districtFields.id}" field`);
    const feats = await AG.queryAll(d.cfg.url, { outFields: '*', maxAllowableOffset: '0.0003', geometryPrecision: '5' }, { pageSize: 100 });
    feats.forEach(f => { AG.prepPolygon(f); f._id = normId(f.attributes[d.fmap.id]); });
    d.features = feats.filter(f => f._rings && f._rings.length).sort((a, b) => districtNum(a._id) - districtNum(b._id));
    d.total = d.fmap.population ? d.features.reduce((t, f) => t + (Number(f.attributes[d.fmap.population]) || 0), 0) : null;
    d.ideal = d.total ? d.total / d.features.length : null;
    d.loaded = true;
    d.photos = new Map();
    return d;
  })().finally(() => { d.loading = null; });
  return d.loading;
}
// Portraits uploaded by admins live as image attachments on the district features.
async function loadPhotos(ch) {
  const d = S.data[ch]; if (!d || !d.loaded || !d.meta.hasAttachments) return;
  const oidF = d.meta.objectIdField || 'OBJECTID', byOid = new Map(d.features.map(f => [f.attributes[oidF], f]));
  try {
    const groups = await AG.queryAttachments(d.cfg.url, [...byOid.keys()]);
    d.photos = new Map();
    groups.forEach((infos, oid) => { const f = byOid.get(oid); if (f && infos.length) d.photos.set(f._id, { oid, id: infos[infos.length - 1].id, all: infos.map(i => i.id) }); });
  } catch (e) { console.warn('Photo attachments unavailable:', e.message); }
}
async function loadMembers() {
  try { const r = await fetch('data/members.json'); if (r.ok) { const j = await r.json(); S.members = { congress: j.congress || [], senate: j.senate || [], house: j.house || [] }; } }
  catch (e) { console.warn('members.json not loaded', e); }
}
const CAT_COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#56b4e9', '#7a5195', '#8c564b', '#4d4d4d', '#b2182b', '#1b9e77', '#a6761d'];
async function loadCikr() {
  if (S.cikr) return S.cikr;
  const c = CONFIG.cikr, meta = await AG.meta(c.url);
  const f = { name: AG.realField(meta, c.nameField), category: AG.realField(meta, c.categoryField), notes: AG.realField(meta, c.notesField) };
  const feats = await AG.queryAll(c.url, { outFields: '*' }, { pageSize: 1000 });
  const oidF = meta.objectIdField || 'OBJECTID';
  const pts = feats.filter(g => g.geometry && g.geometry.x != null).map(g => ({ oid: g.attributes[oidF], a: g.attributes, x: g.geometry.x, y: g.geometry.y, d: {} }));
  const counts = {};
  pts.forEach(p => { const k = (f.category && p.a[f.category]) || 'Uncategorized'; counts[k] = (counts[k] || 0) + 1; });
  const categories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const color = {}; categories.forEach((k, i) => { color[k] = CAT_COLORS[i % CAT_COLORS.length]; });
  S.cikr = { meta, f, pts, categories, color, oidField: oidF };
  return S.cikr;
}
const catBadge = (c, size = 16) => `<span class="badge">${Symbols.badge(c, S.cikr.color[c], size)}</span>`;
const catOf = (p) => (S.cikr.f.category && p.a[S.cikr.f.category]) || 'Uncategorized';
const facName = (p) => (S.cikr.f.name && p.a[S.cikr.f.name]) || '(unnamed facility)';

// Assign every infrastructure point to its district by geometry for each loaded chamber
function indexCikr() {
  if (!S.cikr) return;
  Object.keys(S.data).forEach(ch => {
    const d = S.data[ch]; if (!d.loaded) return;
    const idx = new Map();
    S.cikr.pts.forEach(p => { const f = AG.locate(d.features, p.x, p.y); p.d[ch] = f ? f._id : null; if (f) { if (!idx.has(f._id)) idx.set(f._id, []); idx.get(f._id).push(p); } });
    S.cikrIdx[ch] = idx;
  });
}
const cikrIn = (id, ch = S.chamber) => (S.cikrIdx[ch] && S.cikrIdx[ch].get(String(id))) || [];

// Population for a district: the layer's POPULATION when it is filled in (> 0), otherwise the
// census-derived estimate (tracts assigned by centroid). Returns null until one is available.
function layerPop(f, ch = S.chamber) { const d = CD(ch), v = d.fmap.population ? Number(f.attributes[d.fmap.population]) : NaN; return v > 0 ? v : null; }
function censusPop(f, ch = S.chamber) { const c = S.census[ch], r = c && c.status === 'ready' && c.result.byDistrict[f._id]; return r && r.pop > 0 ? r.pop : null; }
const popOf = (f, ch = S.chamber) => layerPop(f, ch) ?? censusPop(f, ch);
const popIsEstimate = (f, ch = S.chamber) => layerPop(f, ch) == null && censusPop(f, ch) != null;
function popTotals(ch = S.chamber) {
  const d = CD(ch), ps = d.features.map(f => popOf(f, ch));
  if (!ps.length || ps.some(p => p == null)) return { total: null, ideal: null };
  const total = ps.reduce((a, b) => a + b, 0); return { total, ideal: total / ps.length };
}

async function ensureCensus(ch) {
  const cur = S.census[ch];
  if (cur && (cur.status === 'loading' || cur.status === 'ready')) return;
  S.census[ch] = { status: 'loading' };
  try {
    const d = await loadChamber(ch);
    const result = await Census.summarize(d.features, (f) => f._id, (msg) => { S.census[ch].msg = msg; });
    S.census[ch] = { status: 'ready', result };
  } catch (e) { console.warn('Census failed', e); S.census[ch] = { status: 'error', error: e }; }
  if (S.chamber === ch) { renderDetail(); renderList(); }
}

// ── map ──────────────────────────────────────────────────────────
function initMap() {
  const map = S.map = L.map('map', { zoomSnap: 0.25, minZoom: 5 }).setView(CONFIG.mapCenter, CONFIG.mapZoom);
  L.tileLayer(CONFIG.basemap, { maxZoom: 16, attribution: 'Esri, HERE, Garmin, USGS, NPS' }).addTo(map);
  // District-number labels sit above the infrastructure symbols so they stay readable.
  map.createPane('dlabels'); map.getPane('dlabels').style.zIndex = 650; map.getPane('dlabels').style.pointerEvents = 'none';
  map.createPane('refLabels'); map.getPane('refLabels').style.zIndex = 440; map.getPane('refLabels').style.pointerEvents = 'none';
  L.tileLayer(CONFIG.basemapLabels, { pane: 'refLabels', maxZoom: 16 }).addTo(map);
  S.layers.counties = L.layerGroup();
  S.layers.districts = L.layerGroup().addTo(map);
  S.layers.labels = L.layerGroup().addTo(map);
  S.layers.cikr = L.layerGroup().addTo(map);
  S.layers.pending = L.layerGroup().addTo(map);
  map.on('zoomend', () => { updateLabelClass(); if (S.cikr && Symbols.tier(map.getZoom()) !== S.symTier) renderCikrMarkers(); });
  map.on('click', (e) => { if (S.pickMode) onMapPick(e); });
  window.addEventListener('resize', () => map.invalidateSize());
}
function updateLabelClass() {
  const z = S.map.getZoom();
  S.map.getContainer().classList.toggle('lbl-off', S.chamber === 'house' && z < 8.5);
}
function polyStyle(f) {
  const cfg = CD().cfg, sel = S.selected === f._id, any = S.selected != null;
  return { color: cfg.color, weight: sel ? 4 : 1.8, opacity: any && !sel ? 0.55 : 1, fillColor: cfg.color, fillOpacity: sel ? 0.16 : (any ? 0.02 : 0.06) };
}
function ringLabelPoint(f) {
  let best = null, bestA = -1;
  f._rings.forEach(r => {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const k = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += k; cx += (r[j][0] + r[i][0]) * k; cy += (r[j][1] + r[i][1]) * k; }
    const A = Math.abs(a / 2); if (A > bestA) { bestA = A; best = { r, cx: cx / (3 * a || 1), cy: cy / (3 * a || 1) }; }
  });
  if (best && AG.featureContains(f, best.cx, best.cy)) return [best.cy, best.cx];
  if (best) { const xs = best.r.map(p => p[0]), ys = best.r.map(p => p[1]); return [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2]; }
  return AG.bboxCenter(f);
}
function renderDistrictLayer() {
  const d = CD();
  S.layers.districts.clearLayers(); S.layers.labels.clearLayers(); S.polys = {};
  d.features.forEach(f => {
    const poly = L.polygon(AG.toLeafletRings(f), polyStyle(f));
    poly.on('click', (e) => { if (S.pickMode) return onMapPick(e); L.DomEvent.stopPropagation(e); selectDistrict(f._id, { fit: false }); });
    poly.on('mouseover', () => { if (S.selected !== f._id) poly.setStyle({ fillOpacity: 0.14 }); });
    poly.on('mouseout', () => poly.setStyle(polyStyle(f)));
    poly.bindTooltip(`${esc(districtLabel(f))}${personName(f) ? ' — ' + esc(personName(f)) : ''}`, { sticky: true });
    S.layers.districts.addLayer(poly); S.polys[f._id] = poly;
    S.layers.labels.addLayer(L.marker(ringLabelPoint(f), { interactive: false, keyboard: false, pane: 'dlabels',
      icon: L.divIcon({ className: '', html: `<span class="dlabel">${esc(districtNum(f._id))}</span>`, iconSize: [40, 16], iconAnchor: [20, 8] }) }));
  });
  updateLabelClass();
}
function restyle() { Object.entries(S.polys).forEach(([id, p]) => { const f = featureById(id); if (f) p.setStyle(polyStyle(f)); }); }
function fitState() { const g = L.featureGroup(Object.values(S.polys)); if (g.getLayers().length) S.map.fitBounds(g.getBounds(), { padding: [20, 20] }); }

function renderCikrMarkers() {
  const g = S.layers.cikr; g.clearLayers();
  const on = $('#tog-cikr').checked;
  if (!S.cikr || !on) { renderLegend([]); return; }
  const pts = S.selected != null ? cikrIn(S.selected) : S.cikr.pts;
  const shown = S.catFilter ? pts.filter(p => catOf(p) === S.catFilter) : pts;
  const z = S.map.getZoom(); S.symTier = Symbols.tier(z);
  shown.forEach(p => {
    const cat = catOf(p), m = L.marker([p.y, p.x], { icon: Symbols.leafletIcon(cat, S.cikr.color[cat], z), title: facName(p), keyboard: true });
    m.bindPopup(() => facilityPopup(p)); m._oid = p.oid; g.addLayer(m);
  });
  renderLegend(S.catFilter ? [S.catFilter] : [...new Set(pts.map(catOf))]);
}
function facilityPopup(p) {
  const notes = S.cikr.f.notes && p.a[S.cikr.f.notes];
  const dist = ['congress', 'senate', 'house'].filter(ch => p.d[ch] != null && S.data[ch] && S.data[ch].loaded).map(ch => `${CONFIG.chambers[ch].short} ${districtNum(p.d[ch])}`).join(' · ');
  return `<strong>${esc(facName(p))}</strong><br><span style="color:#46505f">${esc(catOf(p))}</span>${dist ? `<br><small>${esc(dist)}</small>` : ''}${notes ? `<br><small>${esc(notes)}</small>` : ''}`;
}
function renderLegend(cats) {
  const lg = $('#legend');
  if (!cats.length || !S.cikr) { lg.hidden = true; return; }
  lg.hidden = false;
  lg.innerHTML = cats.sort().map(c => `<div>${catBadge(c, 18)}${esc(c)}</div>`).join('');
}
function focusFacility(oid) {
  const p = S.cikr.pts.find(x => x.oid === oid); if (!p) return;
  S.map.setView([p.y, p.x], Math.max(S.map.getZoom(), 12));
  setTimeout(() => { S.layers.cikr.eachLayer(l => { if (l._oid === oid) l.openPopup(); }); }, 350);
}
async function toggleCounties(on) {
  const g = S.layers.counties;
  if (!on) { S.map.removeLayer(g); return; }
  if (!g.getLayers().length) {
    try {
      const c = CONFIG.counties;
      const feats = await AG.queryAll(c.url, { outFields: c.name, maxAllowableOffset: '0.002' }, { pageSize: 100 });
      feats.forEach(f => { AG.prepPolygon(f);
        const p = L.polygon(AG.toLeafletRings(f), { color: '#55606f', weight: 1, fill: false, dashArray: '3 3', interactive: false });
        g.addLayer(p);
        const cn = String(f.attributes[c.name]).replace(/ County$/i, '');
        g.addLayer(L.marker(ringLabelPoint(f), { interactive: false, keyboard: false, pane: 'dlabels', icon: L.divIcon({ className: '', html: `<span class="dlabel" style="font-weight:500;font-size:11px;color:#46505f">${esc(cn)}</span>`, iconSize: [60, 14], iconAnchor: [30, 7] }) }));
      });
    } catch (e) { onFatal(e); $('#tog-counties').checked = false; return; }
  }
  g.addTo(S.map); S.layers.districts.bringToFront && S.layers.districts.eachLayer(l => l.bringToFront());
}

// ── list ─────────────────────────────────────────────────────────
function countyNamesFor(id, ch = S.chamber) {
  const c = S.census[ch]; if (!c || c.status !== 'ready') return [];
  const S0 = c.result.byDistrict[id]; if (!S0) return [];
  return Object.keys(S0.counties).map(k => (c.result.counties[k] || '')).filter(Boolean);
}
function renderList() {
  const d = CD(), ul = $('#district-list'); if (!d || !d.loaded) return;
  const q = S.search.trim().toLowerCase();
  const items = d.features.filter(f => !q ||
    String(districtNum(f._id)) === q || districtLabel(f).toLowerCase().includes(q) ||
    personName(f).toLowerCase().includes(q) || countyNamesFor(f._id).some(c => c.toLowerCase().includes(q)));
  $('#list-meta').textContent = `${items.length} of ${d.features.length} districts` + (popTotals().ideal ? ` · ideal size ${fmtN(popTotals().ideal)}` : '');
  ul.innerHTML = items.map(f => {
    const pop = popOf(f), p = partyOf(f);
    return `<li><button type="button" data-id="${esc(f._id)}" aria-current="${S.selected === f._id}">
      ${avatarHTML(f, S.chamber, d.features.length > 20 ? 'sm' : '')}
      <span class="d-text"><span class="d-title">${esc(districtLabel(f))}</span><br>
      <span class="d-sub">${esc(personName(f) || '—')} ${partyChip(p)}</span>
      ${pop ? `<div class="d-pop">${fmtN(pop)} residents${popIsEstimate(f) ? ' (est.)' : ''}</div>` : ''}</span></button></li>`;
  }).join('') || '<li class="empty">No districts match.</li>';
}

// ── selection / chamber switching ────────────────────────────────
function selectDistrict(id, { fit = true } = {}) {
  S.selected = id == null ? null : String(id); S.catFilter = null; S.editingFacility = null;
  restyle(); renderCikrMarkers(); renderList(); renderDetail();
  if (S.selected != null && fit && S.polys[S.selected]) S.map.fitBounds(S.polys[S.selected].getBounds(), { padding: [30, 30] });
  if (S.selected == null && fit) fitState();
  history.replaceState(null, '', S.selected != null ? `#${S.chamber}/${S.selected}` : location.pathname + location.search);
  const cur = $(`#district-list button[data-id="${CSS.escape(S.selected || '')}"]`); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
async function switchChamber(ch, id) {
  S.chamber = ch; S.selected = null; S.search = ''; $('#search').value = ''; S.catFilter = null;
  $$('#chamber-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ch === ch)));
  $('#district-list').innerHTML = '<li class="empty"><span class="spin"></span>Loading districts…</li>';
  $('#detail-body').innerHTML = '<div class="empty"><span class="spin"></span>Loading…</div>';
  try {
    await loadChamber(ch);
    if (S.chamber !== ch) return; // user switched again while loading
    indexCikr(); renderDistrictLayer(); renderList(); fitState();
    ensureCensus(ch);
    loadPhotos(ch).then(() => { if (S.chamber === ch) { renderList(); renderDetail(); } });
    updateEditTab();
    selectDistrict(id != null && featureById(id) ? id : null, { fit: id != null });
  } catch (e) { onFatal(e); $('#district-list').innerHTML = `<li class="empty">Could not load ${esc(CONFIG.chambers[ch].label)}.<br>${esc(e.message)}</li>`; $('#detail-body').innerHTML = ''; }
}

// ── auth UI + boot ───────────────────────────────────────────────
function showLogin(msg) {
  $('#login-screen').hidden = false; $('#app').hidden = true;
  setLoginError(msg || '');
  Auth.prepareFallbackLink($('#oauth-fallback'));
}
function setLoginError(msg) { const e = $('#login-error'); e.textContent = msg || ''; e.classList.toggle('visible', !!msg); }

async function startApp() {
  $('#login-screen').hidden = true; $('#app').hidden = false;
  if (!S.map) {
    initMap(); wirePhotoFallback(); wireUI();
  }
  S.map.invalidateSize();
  $('#edit-badge').hidden = !EDIT_MODE;
  AG.request(CONFIG.portalUrl + '/community/self').then(u => { $('#user-name').textContent = u.fullName || u.username || ''; S.user = u; }).catch(() => {});
  await loadMembers();
  const m = location.hash.match(/^#(congress|senate|house)(?:\/(\w+))?/);
  const ch = m ? m[1] : 'congress';
  loadCikr().then(() => { indexCikr(); renderCikrMarkers(); renderList(); renderDetail(); updateEditTab(); }).catch(e => { console.warn('CIKR failed', e); toast('Infrastructure layer could not be loaded: ' + e.message, true); });
  await switchChamber(ch, m ? m[2] : null);
}

function wireUI() {
  $('#chamber-tabs').innerHTML = Object.entries(CONFIG.chambers).map(([k, c]) => `<button role="tab" data-ch="${k}" aria-selected="${k === S.chamber}"><span class="t-long">${esc(c.label)}</span><span class="t-short">${esc(c.short)}</span></button>`).join('');
  $('#chamber-tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-ch]'); if (b && b.dataset.ch !== S.chamber) switchChamber(b.dataset.ch); });
  $('#district-list').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) selectDistrict(b.dataset.id); });
  $('#search').addEventListener('input', (e) => { S.search = e.target.value; renderList(); });
  $('#detail-tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('#tog-cikr').addEventListener('change', renderCikrMarkers);
  $('#tog-counties').addEventListener('change', (e) => toggleCounties(e.target.checked));
  $('#reset-view').addEventListener('click', () => selectDistrict(null));
  $('#signout-btn').addEventListener('click', () => { if (confirm('Sign out and clear the cached session?')) { Auth.clear(); showLogin(); } });
  window.addEventListener('hashchange', () => { const m = location.hash.match(/^#(congress|senate|house)(?:\/(\w+))?/); if (m && (m[1] !== S.chamber)) switchChamber(m[1], m[2]); else if (m && m[2] && m[2] !== S.selected) selectDistrict(m[2]); });
}

async function boot() {
  $('#oauth-signin-btn').addEventListener('click', () => Auth.start(setLoginError, startApp));
  if (/REPLACE_WITH/.test(CONFIG.clientId)) console.warn('CONFIG.clientId has not been set — see README.');
  const consumed = await Auth.handleCallback(setLoginError);
  if (consumed && !document.getElementById('app')) return; // popup relay page
  if (!Auth.load()) return showLogin();
  try { await Auth.ensureFresh(); } catch { Auth.clear(); return showLogin('Your session expired — please sign in again.'); }
  startApp();
}
document.addEventListener('DOMContentLoaded', boot);
