// ════════════════════════════════════════════════════════════════
//  SYMBOLS — map badges for infrastructure categories.
//  Each category gets a colored round badge with a white glyph that
//  describes what it is. Glyphs are 24×24 SVG paths. Add new ones here
//  and map categories to them in CONFIG.cikr.symbols / symbolRules.
// ════════════════════════════════════════════════════════════════
const Symbols = (() => {
  const G = {
    health:     'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
    education:  'M12 4 2 9l10 5 8-4v6h2V9L12 4zM6 13.2v3.3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.3l-6 3-6-3z',
    dam:        'M3 5h18v3H3zM5 9h14l-1.6 10H6.6zM8 12h8v1.6H8z',
    chemical:   'M9 3h6v2h-1v4.5l4.6 8.1A1.6 1.6 0 0 1 17.2 20H6.8a1.6 1.6 0 0 1-1.4-2.4L10 9.5V5H9z',
    water:      'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    power:      'M13 2 5 13h6l-1 9 8-11h-6z',
    safety:     'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z',
    government: 'M12 2 2 7v2h20V7zM4 11h2.4v7H4zm5.2 0h2.4v7H9.2zm3.2 0h2.4v7h-2.4zm5.2 0H20v7h-2.4zM2 20h20v2H2z',
    transport:  'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
    comms:      'M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 12h2v10h-2zM6.3 4.8l1.4 1.4a6 6 0 0 0 0 8.5l-1.4 1.4a8 8 0 0 1 0-11.3zM17.7 4.8a8 8 0 0 1 0 11.3l-1.4-1.4a6 6 0 0 0 0-8.5z',
    shelter:    'M12 3 2 12h3v8h5v-5h4v5h5v-8h3z',
    facility:   'M3 21V9l6 4V9l6 4V4h6v17z',   // default: factory/building
  };
  const cache = {};
  function keyFor(category) {
    const c = CONFIG.cikr, exact = c.symbols && c.symbols[category];
    if (exact && G[exact]) return exact;
    const rule = (c.symbolRules || []).find(([re]) => re.test(String(category)));
    return rule && G[rule[1]] ? rule[1] : 'facility';
  }
  const glyph = (category) => G[keyFor(category)];
  // Badge as inline SVG markup: colored circle + white glyph.
  function badge(category, color, size = 22, withGlyph = true) {
    const r = size / 2, scale = (size * 0.58) / 24, off = (size - 24 * scale) / 2;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
      `<circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="#fff" stroke-width="1.6"/>` +
      (withGlyph ? `<path transform="translate(${off} ${off}) scale(${scale})" d="${glyph(category)}" fill="#fff"/>` : '') + `</svg>`;
  }
  // Leaflet icon for the current zoom tier: dots when zoomed out, glyph badges closer in.
  function tier(zoom) { return zoom < 8 ? 0 : zoom < 10 ? 1 : 2; }
  const SIZES = [11, 18, 24];
  function leafletIcon(category, color, zoom) {
    const t = tier(zoom), k = category + '|' + color + '|' + t;
    if (!cache[k]) cache[k] = L.divIcon({ className: 'sym', html: badge(category, color, SIZES[t], t > 0), iconSize: [SIZES[t], SIZES[t]], iconAnchor: [SIZES[t] / 2, SIZES[t] / 2], popupAnchor: [0, -SIZES[t] / 2] });
    return cache[k];
  }
  return { badge, leafletIcon, tier, keyFor };
})();

// ════════════════════════════════════════════════════════════════
//  ICONS — outline icons for the census / summary tiles (24×24, stroke).
//  Tiles are matched to an icon from their label (see Icons.forLabel).
// ════════════════════════════════════════════════════════════════
const Icons = (() => {
  const P = {
    users:    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.8 0 4.5 1.9 4.5 4.5"/>',
    home:     '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    dollar:   '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.2c-.5-1-1.5-1.6-2.7-1.6-1.5 0-2.6.8-2.6 2s1 1.7 2.8 2.1 2.8.9 2.8 2.2-1.2 2.1-2.8 2.1c-1.3 0-2.4-.6-2.9-1.7M12 6v1.6M12 16.4V18"/>',
    poverty:  '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    elder:    '<circle cx="10" cy="5" r="2"/><path d="M10 8v6l-2.5 6M10 14l3 6M7 11h5M17 9v11"/>',
    youth:    '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.3 2.2 4 2.2s3-.7 4-2.2M9 9.5h.01M15 9.5h.01"/>',
    access:   '<circle cx="12" cy="4.5" r="1.8"/><path d="M6 8.5h12M12 8.5v5l3.5 6M12 13.5l-3.5 6"/>',
    nocar:    '<path d="M5 16v-4l2-5h10l2 5v4"/><path d="M3 16h18v3H3zM7 19v1.5M17 19v1.5"/><path d="M3 3l18 18"/>',
    key:      '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    work:     '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/>',
    pin:      '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    facility: '<path d="M3 21V9l6 4V9l6 4V4h6v17z"/>',
    grid:     '<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>',
    tag:      '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
    storm:    '<path d="M17 17a4 4 0 0 0 .5-8A6 6 0 0 0 6 10.5 3.5 3.5 0 0 0 6.5 17"/><path d="M12 11l-2 4h4l-2 4"/>',
    chart:    '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  };
  const RULES = [
    [/no vehicle/i, 'nocar'], [/income/i, 'dollar'], [/poverty/i, 'poverty'], [/65/, 'elder'], [/under 18/i, 'youth'],
    [/disab/i, 'access'], [/renter/i, 'key'], [/unemploy/i, 'work'], [/^households/i, 'home'], [/census tracts|^districts$/i, 'grid'],
    [/categories/i, 'tag'], [/disaster/i, 'storm'], [/sites|infrastructure/i, 'facility'], [/residents|population|ideal/i, 'users'],
  ];
  const forLabel = (label) => { const r = RULES.find(([re]) => re.test(String(label))); return r ? r[1] : null; };
  const svg = (name, size = 20) => P[name] ? `<svg class="ico-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>` : '';
  return { svg, forLabel };
})();
