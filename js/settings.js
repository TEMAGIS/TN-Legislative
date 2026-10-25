// ════════════════════════════════════════════════════════════════
//  SETTINGS — staff-editable appearance (map symbols, colors, census icons).
//  Stored as JSON on a shared ArcGIS Online item (tag below) so every viewer sees
//  the same choices. Load order: built-in defaults → data/settings.json (repo file)
//  → the shared item. Editing happens in Edit tab → Appearance.
// ════════════════════════════════════════════════════════════════
const Settings = (() => {
  const TAG = 'tn-legislative-app-settings', LS = 'legapp_settings_item';
  // Every icon/label slot staff can customise. [key, default label, group, default icon, matcher]
  const SLOTS = [
    ['pop', 'Population', 'Census profile', 'users', /^population$/i],
    ['households', 'Households', 'Census profile', 'home', /^households$/i],
    ['income', 'Median household income', 'Census profile', 'dollar', /income/i],
    ['poverty', 'Below poverty level', 'Census profile', 'poverty', /poverty/i],
    ['over65', 'Age 65 and over', 'Census profile', 'elder', /65/],
    ['under18', 'Under 18', 'Census profile', 'youth', /under 18/i],
    ['disability', 'With a disability', 'Census profile', 'access', /disab/i],
    ['novehicle', 'Households with no vehicle', 'Census profile', 'nocar', /no vehicle/i],
    ['renter', 'Renter-occupied', 'Census profile', 'key', /renter/i],
    ['unemployment', 'Unemployment rate', 'Census profile', 'work', /unemploy/i],
    ['residents', 'Residents', 'Summary tiles', 'users', /^residents/i],
    ['sites', 'Infrastructure sites', 'Summary tiles', 'facility', /^(infrastructure )?sites/i],
    ['districts', 'Districts', 'Summary tiles', 'grid', /^districts$/i],
    ['ideal', 'Ideal district size', 'Summary tiles', 'users', /ideal/i],
    ['tracts', 'Census tracts', 'Summary tiles', 'grid', /census tracts/i],
    ['categories', 'Categories', 'Summary tiles', 'tag', /^categories$/i],
    ['disasters', 'Declared disasters', 'Summary tiles', 'storm', /disaster/i],
    ['sec_census', 'Census profile', 'Section headings', 'chart', /^census profile/i, true],
    ['sec_race', 'Race & ethnicity', 'Section headings', 'globe', /^race/i, true],
    ['sec_county', 'County makeup', 'Section headings', 'pin', /^county/i, true],
    ['sec_decl', 'Declarations', 'Section headings', 'storm', /^declarations/i, true],
  ].map(([key, label, group, icon, re, sec]) => ({ key, label, group, icon, re, sec: !!sec }));

  const blank = () => ({ v: 1, cikr: { symbols: {}, colors: {} }, census: { icons: {}, hidden: {}, labels: {} }, chambers: {} });
  const norm = (j) => {
    const b = blank(); if (!j || typeof j !== 'object') return b;
    Object.assign(b.cikr.symbols, j.cikr && j.cikr.symbols); Object.assign(b.cikr.colors, j.cikr && j.cikr.colors);
    ['icons', 'hidden', 'labels'].forEach(k => Object.assign(b.census[k], j.census && j.census[k]));
    Object.assign(b.chambers, j.chambers); return b;
  };
  let data = blank(), itemId = null, owner = null, source = 'defaults', dirty = false, loadError = null;
  const portal = () => CONFIG.portalUrl;

  async function load() {
    data = blank(); source = 'defaults'; dirty = false;
    try { const r = await fetch('data/settings.json', { cache: 'no-store' }); if (r.ok) { data = norm(await r.json()); source = 'repo file (data/settings.json)'; } } catch {}
    try {
      let id = (CONFIG.settings && CONFIG.settings.itemId) || null;
      if (!id) { try { id = localStorage.getItem(LS); } catch {} }
      let item = null;
      if (id) item = await AG.request(portal() + '/content/items/' + id).catch(() => null);
      if (!item || item.error || !item.id) {
        const me = S.user || await AG.request(portal() + '/community/self');
        const q = `tags:"${TAG}"` + (me.orgId ? ` AND orgid:${me.orgId}` : '');
        const s = await AG.request(portal() + '/search', { q, sortField: 'modified', sortOrder: 'desc', num: 5 });
        item = (s.results || [])[0] || null;
      }
      if (item) {
        const j = await AG.request(portal() + '/content/items/' + item.id + '/data');
        data = norm(j); itemId = item.id; owner = item.owner; source = 'shared settings item';
        try { localStorage.setItem(LS, itemId); } catch {}
      }
    } catch (e) { loadError = e.message; console.warn('Settings item not loaded:', e.message); }
    return data;
  }
  async function save() {
    const text = JSON.stringify(data);
    if (itemId) {
      await AG.request(`${portal()}/content/users/${owner}/items/${itemId}/update`, { text });
    } else {
      const me = S.user || await AG.request(portal() + '/community/self'); S.user = me;
      const r = await AG.request(`${portal()}/content/users/${me.username}/addItem`, {
        title: 'TN Legislative App Settings', type: 'Application', tags: TAG, text,
        snippet: 'Map symbols, colors and census icons for the TN Legislative Districts app. Edited from the app (Edit → Appearance).' });
      itemId = r.id; owner = me.username;
      await AG.request(`${portal()}/content/users/${owner}/items/${itemId}/share`, { org: 'true', everyone: 'false' }).catch(e => console.warn('share failed', e.message));
      try { localStorage.setItem(LS, itemId); } catch {}
    }
    source = 'shared settings item'; dirty = false; return itemId;
  }
  const touch = () => { dirty = true; };
  const setOrDel = (obj, k, v) => { if (v == null || v === '') delete obj[k]; else obj[k] = v; touch(); };

  // lookups
  const symbol = (cat) => data.cikr.symbols[cat] || null;
  const color = (cat) => data.cikr.colors[cat] || null;
  const chamberColor = (ch) => (data.chambers[ch] && data.chambers[ch].color) || null;
  const slotFor = (label, key) => { const t = String(label || '').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim(); return key ? SLOTS.find(s => s.key === key) : SLOTS.find(s => s.re.test(t)); };
  const icon = (k) => data.census.icons[k] || null;
  const label = (k, def) => data.census.labels[k] || def;
  const hidden = (k) => !!data.census.hidden[k];

  return {
    SLOTS, TAG, load, save, touch,
    get data() { return data; }, get itemId() { return itemId; }, get source() { return source; }, get dirty() { return dirty; }, get loadError() { return loadError; },
    symbol, color, chamberColor, slotFor, icon, label, hidden,
    setSymbol: (c, v) => setOrDel(data.cikr.symbols, c, v), setColor: (c, v) => setOrDel(data.cikr.colors, c, v),
    setChamberColor: (ch, v) => { if (!v) delete data.chambers[ch]; else data.chambers[ch] = { color: v }; touch(); },
    setIcon: (k, v) => setOrDel(data.census.icons, k, v), setLabel: (k, v) => setOrDel(data.census.labels, k, v),
    setHidden: (k, v) => { if (v) data.census.hidden[k] = true; else delete data.census.hidden[k]; touch(); },
    reset() { data = blank(); touch(); },
    exportJSON: () => JSON.stringify(data, null, 2),
    importJSON(text) { data = norm(JSON.parse(text)); touch(); },
  };
})();
