// ════════════════════════════════════════════════════════════════
//  ArcGIS REST helpers + geometry utilities (no external deps)
// ════════════════════════════════════════════════════════════════
const AG = (() => {
  // ── Core request: always POST (long geometry URLs) with token ────
  async function request(url, params = {}, { token = true, retried = false } = {}) {
    const body = new URLSearchParams({ f: 'json', ...params });
    if (token && Auth.accessToken) body.set('token', Auth.accessToken);
    const res = await fetch(url, { method: 'POST', body });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) {
      const code = data.error.code;
      if ((code === 498 || code === 499) && token && !retried && Auth.token && Auth.token.refreshToken) {
        try { Auth.save(await Auth.refresh()); return request(url, params, { token, retried: true }); } catch {}
      }
      const err = new Error(data.error.message || `ArcGIS error ${code}`);
      err.code = code; err.tokenExpired = (code === 498 || code === 499);
      err.details = data.error.details;
      throw err;
    }
    return data;
  }

  const metaCache = new Map();
  async function meta(layerUrl, token = true) {
    if (!metaCache.has(layerUrl)) metaCache.set(layerUrl, request(layerUrl, {}, { token }).catch(e => { metaCache.delete(layerUrl); throw e; }));
    return metaCache.get(layerUrl);
  }
  const fieldNames = (m) => (m.fields || []).map(f => f.name);
  const hasField = (m, name) => !!name && fieldNames(m).some(n => n.toLowerCase() === name.toLowerCase());
  const realField = (m, name) => fieldNames(m).find(n => n.toLowerCase() === String(name).toLowerCase());
  const canEdit = (m) => /update|editing/i.test(m.capabilities || '');
  const canCreate = (m) => /create|editing/i.test(m.capabilities || '');
  const canDelete = (m) => /delete|editing/i.test(m.capabilities || '');

  // ── Paged query → [{attributes, geometry}] ───────────────────────
  async function queryAll(layerUrl, params = {}, { token = true, pageSize = 1000, onPage } = {}) {
    const out = [];
    let offset = 0;
    for (let guard = 0; guard < 80; guard++) {
      const d = await request(layerUrl + '/query', {
        where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326',
        resultOffset: String(offset), resultRecordCount: String(pageSize), ...params,
      }, { token });
      const feats = d.features || [];
      out.push(...feats);
      if (onPage) onPage(out.length);
      if (!d.exceededTransferLimit || !feats.length) break;
      offset += feats.length;
    }
    return out;
  }

  async function applyEdits(layerUrl, { adds, updates, deletes } = {}) {
    const p = {};
    if (adds && adds.length) p.adds = JSON.stringify(adds);
    if (updates && updates.length) p.updates = JSON.stringify(updates);
    if (deletes && deletes.length) p.deletes = deletes.join(',');
    p.rollbackOnFailure = 'true';
    const d = await request(layerUrl + '/applyEdits', p);
    const results = [...(d.addResults || []), ...(d.updateResults || []), ...(d.deleteResults || [])];
    const bad = results.find(r => !r.success);
    if (bad) throw new Error((bad.error && bad.error.description) || 'Edit failed');
    return d;
  }

  // Resolve a portal item id → FeatureServer layer URL (cached).
  const itemUrlCache = new Map();
  async function layerUrlFromItem(itemId, layerIndex = 0) {
    const key = itemId + '/' + layerIndex;
    if (!itemUrlCache.has(key)) {
      itemUrlCache.set(key, request(`${CONFIG.portalUrl}/content/items/${itemId}`, {}).then(d => {
        if (!d.url) throw new Error('Item has no service URL');
        return `${d.url.replace(/\/$/, '')}/${layerIndex}`;
      }).catch(e => { itemUrlCache.delete(key); throw e; }));
    }
    return itemUrlCache.get(key);
  }

  // ── Geometry ─────────────────────────────────────────────────────
  // Esri polygon rings → keep as-is for PIP (even-odd across all rings
  // handles holes), compute bbox for a fast reject.
  function prepPolygon(feature) {
    const rings = (feature.geometry && feature.geometry.rings) || [];
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    rings.forEach(r => r.forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }));
    feature._rings = rings; feature._bbox = [minX, minY, maxX, maxY];
    return feature;
  }
  function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function featureContains(f, x, y) {
    const b = f._bbox;
    if (!b || x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
    let hits = 0;
    for (const r of f._rings) if (pointInRing(x, y, r)) hits++;
    return (hits % 2) === 1; // even-odd
  }
  function locate(features, x, y) {
    for (const f of features) if (featureContains(f, x, y)) return f;
    return null;
  }
  // Esri polygon → Leaflet [lat,lng] ring arrays (Leaflet handles even-odd fill with holes).
  function toLeafletRings(feature) {
    return (feature._rings || []).map(r => r.map(([x, y]) => [y, x]));
  }
  function bboxCenter(f) { const b = f._bbox; return [(b[1] + b[3]) / 2, (b[0] + b[2]) / 2]; }

  return { request, meta, fieldNames, hasField, realField, canEdit, canCreate, canDelete,
           queryAll, applyEdits, layerUrlFromItem, prepPolygon, featureContains, locate, toLeafletRings, bboxCenter };
})();
