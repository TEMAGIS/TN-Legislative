// ════════════════════════════════════════════════════════════════
//  CENSUS — district summaries that stay correct after redistricting.
//
//  The Census Bureau only publishes congressional-district geography for
//  the boundaries in force at each vintage, so it can't describe the May
//  2026 map. Instead we take every TN census tract (Esri Living Atlas),
//  assign each tract to a district by its centroid, pull ACS 5-year /
//  2020 Census tract data once, and roll tracts up to districts.
//  A tract that straddles a district line goes entirely to the district
//  holding its centroid — a standard approximation; counts for districts
//  that split a county (e.g. Shelby) can be off by a small margin.
// ════════════════════════════════════════════════════════════════
const Census = (() => {
  let tractsPromise = null, countiesPromise = null, acsPromise = null;

  // ── Tracts (public layer, no token) ──────────────────────────────
  function loadTracts() {
    if (!tractsPromise) tractsPromise = (async () => {
      const url = CONFIG.tracts.url;
      const base = { where: "STATE_ABBR='TN'", outFields: 'FIPS,POPULATION', outSR: '4326' };
      let feats = await AG.queryAll(url, { ...base, returnGeometry: 'false', returnCentroid: 'true' }, { token: false, pageSize: 2000 });
      if (!feats.length || !feats[0].centroid) {
        // Layer didn't return centroids — fall back to bbox centers of a lightly-generalised geometry
        feats = await AG.queryAll(url, { ...base, returnGeometry: 'true', maxAllowableOffset: '0.01' }, { token: false, pageSize: 500 });
        feats.forEach(f => { AG.prepPolygon(f); const c = AG.bboxCenter(f); f.centroid = { x: c[1], y: c[0] }; });
      }
      return feats.filter(f => f.centroid && f.attributes.FIPS).map(f => ({
        geoid: String(f.attributes.FIPS), county: String(f.attributes.FIPS).slice(2, 5),
        pop: Number(f.attributes.POPULATION) || 0, x: f.centroid.x, y: f.centroid.y,
      }));
    })().catch(e => { tractsPromise = null; throw e; });
    return tractsPromise;
  }

  function loadCounties() {
    if (!countiesPromise) countiesPromise = (async () => {
      const c = CONFIG.counties;
      const feats = await AG.queryAll(c.url, { outFields: `${c.fips},${c.name}`, returnGeometry: 'false' });
      const m = {};
      feats.forEach(f => { const k = String(f.attributes[c.fips]).padStart(3, '0').slice(-3); m[k] = String(f.attributes[c.name]).replace(/ County$/i, ''); });
      return m;
    })().catch(e => { countiesPromise = null; throw e; });
    return countiesPromise;
  }

  // tract geoid → district id (string) for a set of prepared district features
  function assign(tracts, districts, idField) {
    const out = new Map();
    for (const t of tracts) {
      const f = AG.locate(districts, t.x, t.y);
      if (f) out.set(t.geoid, typeof idField === 'function' ? idField(f) : String(f.attributes[idField]));
    }
    return out;
  }

  // ── ACS / Decennial tract data, statewide in a handful of requests ─
  const DETAIL = ['B01003_001E', 'B25001_001E', 'B25003_001E', 'B25003_002E', 'B25003_003E',
                  'B25044_001E', 'B25044_003E', 'B25044_010E', 'B19013_001E'];
  const AGE = ['B01001_001E',
    'B01001_003E', 'B01001_004E', 'B01001_005E', 'B01001_006E', 'B01001_027E', 'B01001_028E', 'B01001_029E', 'B01001_030E',
    'B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E',
    'B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E'];
  const ECON = ['B17001_001E', 'B17001_002E', 'B22010_001E', 'B22010_002E', 'B23025_003E', 'B23025_005E'];
  const DISAB = ['S1810_C01_001E', 'S1810_C02_001E'];
  const RACE = ['P1_001N', 'P1_003N', 'P1_004N', 'P1_005N', 'P1_006N', 'P1_007N', 'P1_008N', 'P1_009N', 'P2_002N'];

  async function censusGet(path, vars) {
    const p = new URLSearchParams({ get: vars.join(','), for: 'tract:*', in: 'state:47', key: CONFIG.censusApiKey });
    const res = await fetch(`https://api.census.gov/data/${path}?${p}`);
    if (!res.ok) throw new Error(`Census ${path}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
    const rows = await res.json();
    const out = new Map();
    rows.slice(1).forEach(r => {
      const geo = r.slice(-3).join('');
      const o = {};
      vars.forEach((v, i) => { const n = Number(r[i]); o[v] = (r[i] !== null && Number.isFinite(n) && n >= 0) ? n : null; });
      out.set(geo, o);
    });
    return out;
  }

  function loadAcs() {
    if (!acsPromise) acsPromise = (async () => {
      if (!CONFIG.censusApiKey) throw Object.assign(new Error('No Census API key configured'), { noKey: true });
      let year = null;
      for (const y of CONFIG.acsYears) {
        try { await censusGet(`${y}/acs/acs5`, ['B01003_001E']); year = y; break; } catch (e) { console.warn('[Census] vintage', y, e.message); }
      }
      if (!year) throw new Error('No ACS vintage reachable');
      const settle = (p) => p.catch(e => { console.warn('[Census]', e.message); return new Map(); });
      const [d, a, e, s, r] = await Promise.all([
        settle(censusGet(`${year}/acs/acs5`, DETAIL)),
        settle(censusGet(`${year}/acs/acs5`, AGE)),
        settle(censusGet(`${year}/acs/acs5`, ECON)),
        settle(censusGet(`${year}/acs/acs5/subject`, DISAB)),
        settle(censusGet('2020/dec/pl', RACE)),
      ]);
      return { year, d, a, e, s, r };
    })().catch(err => { acsPromise = null; throw err; });
    return acsPromise;
  }

  // ── Roll tracts up to districts ──────────────────────────────────
  const sum = (...v) => v.reduce((t, x) => t + (x || 0), 0);
  function emptySummary() {
    return { tracts: 0, pop: 0, layerPop: 0, households: 0, housingUnits: 0, owner: 0, renter: 0, tenureTotal: 0,
             noVehicle: 0, vehicleTotal: 0, incomeWeighted: 0, incomeHH: 0, under18: 0, over65: 0, ageTotal: 0,
             povTotal: 0, poverty: 0, snapTotal: 0, snap: 0, laborForce: 0, unemployed: 0, disTotal: 0, disabled: 0,
             race: { white: 0, black: 0, aian: 0, asian: 0, nhpi: 0, other: 0, multi: 0, total: 0 }, hispanic: 0,
             counties: {} };
  }
  function aggregate(tracts, assignment, acs) {
    const byDistrict = {};
    for (const t of tracts) {
      const did = assignment.get(t.geoid);
      if (did == null) continue;
      const S = byDistrict[did] || (byDistrict[did] = emptySummary());
      S.tracts++; S.layerPop += t.pop;
      let tractPop = t.pop;
      if (acs) {
        const d = acs.d.get(t.geoid) || {}, a = acs.a.get(t.geoid) || {}, e = acs.e.get(t.geoid) || {},
              s = acs.s.get(t.geoid) || {}, r = acs.r.get(t.geoid) || {};
        if (d.B01003_001E != null) tractPop = d.B01003_001E;
        S.households += d.B25003_001E || 0; S.housingUnits += d.B25001_001E || 0;
        S.owner += d.B25003_002E || 0; S.renter += d.B25003_003E || 0; S.tenureTotal += d.B25003_001E || 0;
        S.noVehicle += sum(d.B25044_003E, d.B25044_010E); S.vehicleTotal += d.B25044_001E || 0;
        if (d.B19013_001E && d.B25003_001E) { S.incomeWeighted += d.B19013_001E * d.B25003_001E; S.incomeHH += d.B25003_001E; }
        S.ageTotal += a.B01001_001E || 0;
        S.under18 += sum(a.B01001_003E, a.B01001_004E, a.B01001_005E, a.B01001_006E, a.B01001_027E, a.B01001_028E, a.B01001_029E, a.B01001_030E);
        S.over65 += sum(a.B01001_020E, a.B01001_021E, a.B01001_022E, a.B01001_023E, a.B01001_024E, a.B01001_025E,
                        a.B01001_044E, a.B01001_045E, a.B01001_046E, a.B01001_047E, a.B01001_048E, a.B01001_049E);
        S.povTotal += e.B17001_001E || 0; S.poverty += e.B17001_002E || 0;
        S.snapTotal += e.B22010_001E || 0; S.snap += e.B22010_002E || 0;
        S.laborForce += e.B23025_003E || 0; S.unemployed += e.B23025_005E || 0;
        S.disTotal += s.S1810_C01_001E || 0; S.disabled += s.S1810_C02_001E || 0;
        S.race.total += r.P1_001N || 0; S.race.white += r.P1_003N || 0; S.race.black += r.P1_004N || 0;
        S.race.aian += r.P1_005N || 0; S.race.asian += r.P1_006N || 0; S.race.nhpi += r.P1_007N || 0;
        S.race.other += r.P1_008N || 0; S.race.multi += r.P1_009N || 0; S.hispanic += r.P2_002N || 0;
      }
      S.pop += tractPop;
      S.counties[t.county] = (S.counties[t.county] || 0) + tractPop;
    }
    return byDistrict;
  }

  // Which counties are cut by more than one district in this chamber?
  function splitCounties(tracts, assignment) {
    const m = {};
    for (const t of tracts) { const d = assignment.get(t.geoid); if (d == null) continue; (m[t.county] || (m[t.county] = new Set())).add(d); }
    const split = {};
    Object.keys(m).forEach(c => { if (m[c].size > 1) split[c] = [...m[c]]; });
    return split;
  }

  // Convenience: everything the UI needs for one chamber.
  async function summarize(districts, idField, onStatus) {
    onStatus && onStatus('Locating census tracts…');
    const [tracts, counties] = await Promise.all([loadTracts(), loadCounties().catch(() => ({}))]);
    const assignment = assign(tracts, districts, idField);
    let acs = null, acsError = null;
    try { onStatus && onStatus('Loading ACS / Census data…'); acs = await loadAcs(); } catch (e) { acsError = e; }
    return {
      byDistrict: aggregate(tracts, assignment, acs),
      assignment, tracts, counties, acsYear: acs && acs.year, acsError,
      split: splitCounties(tracts, assignment),
    };
  }

  // ── Derived display metrics ──────────────────────────────────────
  const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
  function metrics(S) {
    if (!S) return null;
    return {
      pop: S.pop, households: S.households, housingUnits: S.housingUnits,
      medianIncome: S.incomeHH ? S.incomeWeighted / S.incomeHH : null,
      pctOwner: pct(S.owner, S.tenureTotal), pctRenter: pct(S.renter, S.tenureTotal),
      pctNoVehicle: pct(S.noVehicle, S.vehicleTotal),
      pctUnder18: pct(S.under18, S.ageTotal), pctOver65: pct(S.over65, S.ageTotal),
      pctPoverty: pct(S.poverty, S.povTotal), pctSnap: pct(S.snap, S.snapTotal),
      pctDisability: pct(S.disabled, S.disTotal), unemployment: pct(S.unemployed, S.laborForce),
      race: S.race, pctHispanic: pct(S.hispanic, S.race.total),
    };
  }

  return { summarize, metrics, loadTracts, loadCounties };
})();
