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
    fire:       'M12 2c1 3 5 5.5 5 11a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.6.9 2.6 1.8 3C10.4 8.2 11 5 12 2z',
    fuel:       'M4 3h9v8h1.5a2.5 2.5 0 0 1 2.5 2.5V17a1 1 0 0 0 2 0v-6.2l-2-2L19.4 7.4 22 10v7a3 3 0 0 1-6 0v-3.5a.5.5 0 0 0-.5-.5H13v8H4zm2 2v4h5V5z',
    bridge:     'M2 17h20v2H2zM4 7h2v10H4zm14 0h2v10h-2zM5 7c3 0 4 4 7 4s4-4 7-4v2.2c-2 0-3 4-7 4S7 11.2 5 9.2z',
    rail:       'M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-2 2.8L19 20h-2l-1-1.5H8L7 20H5l2-3.2A3 3 0 0 1 5 14V5a2 2 0 0 1 2-2zm0 3v4h10V6zm2 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    port:       'M12 2a3 3 0 0 1 1 5.8V9h3v2h-3v8c2.8-.3 4.7-2 5.2-4.3L16 15l3-4 3 4-1.9-.3C19.4 18.4 16.4 21 12 21s-7.4-2.6-8.1-6.300L2 15l3-4 3 4-2.2-.3C6.3 17 8.2 18.7 11 19v-8H8V9h3V7.800A3 3 0 0 1 12 2zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    waste:      'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
    building:   'M5 21V3h9v6h5v12zm3-15v2h2V6zm0 4v2h2v-2zm0 4v2h2v-2zm5 0v2h2v-2zm0-4v2h2v-2z',
    park:       'M12 2 6 11h3l-4 6h5.500v5h3v-5H19l-4-6h3z',
    library:    'M4 4h7a2 2 0 0 1 1 .3 2 2 0 0 1 1-.3h7v15h-7a1 1 0 0 0-1 1 1 1 0 0 0-1-1H4zm2 2v11h5V6zm7 0v11h5V6z',
    lock:       'M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10h2zm2 0h6V7a3 3 0 0 0-6 0z',
    star:       'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.800L12 17.1 5.9 20.600l1.4-6.800L2.2 9.100l6.9-.8z',
  };
  const cache = {};
  function keyFor(category) {
    const c = CONFIG.cikr, set = (typeof Settings !== 'undefined' && Settings.symbol(category));   // staff choice (Edit → Appearance) wins
    if (set && G[set]) return set;
    const exact = c.symbols && c.symbols[category];
    if (exact && G[exact]) return exact;
    const rule = (c.symbolRules || []).find(([re]) => re.test(String(category)));
    return rule && G[rule[1]] ? rule[1] : 'facility';
  }
  const glyph = (category) => G[keyFor(category)];
  const keys = () => Object.keys(G);
  // Badge as inline SVG markup: colored circle + white glyph. `key` forces a specific glyph (used by the picker).
  function badge(category, color, size = 22, withGlyph = true, key) {
    const r = size / 2, scale = (size * 0.58) / 24, off = (size - 24 * scale) / 2;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
      `<circle cx="${r}" cy="${r}" r="${r - 1}" fill="${color}" stroke="#fff" stroke-width="1.6"/>` +
      (withGlyph ? `<path transform="translate(${off} ${off}) scale(${scale})" d="${key ? G[key] : glyph(category)}" fill="#fff" fill-rule="evenodd"/>` : '') + `</svg>`;
  }
  // Leaflet icon for the current zoom tier: dots when zoomed out, glyph badges closer in.
  function tier(zoom) { return zoom < 8 ? 0 : zoom < 10 ? 1 : 2; }
  const SIZES = [11, 18, 24];
  function leafletIcon(category, color, zoom) {
    const t = tier(zoom), k = category + '|' + keyFor(category) + '|' + color + '|' + t;
    if (!cache[k]) cache[k] = L.divIcon({ className: 'sym', html: badge(category, color, SIZES[t], t > 0), iconSize: [SIZES[t], SIZES[t]], iconAnchor: [SIZES[t] / 2, SIZES[t] / 2], popupAnchor: [0, -SIZES[t] / 2] });
    return cache[k];
  }
  return { badge, leafletIcon, tier, keyFor, keys };
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
    heart:    '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.500A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    school:   '<path d="M2 9l10-5 10 5-10 5zM6 11.500V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
    bus:      '<path d="M5 4h14a1 1 0 0 1 1 1v12H4V5a1 1 0 0 1 1-1zM4 11h16M7 20v-3M17 20v-3M8 14h.01M16 14h.01"/>',
    wifi:     '<path d="M2 9a15 15 0 0 1 20 0M5 12.500a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.500h.01"/>',
    flag:     '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    building: '<path d="M5 21V3h10v18M15 9h4v12M9 7h2M9 11h2M9 15h2M3 21h18"/>',
    shield:   '<path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/>',
    droplet:  '<path d="M12 3s6 6 6 10.500a6 6 0 0 1-12 0C6 9 12 3 12 3z"/>',
    star:     '<path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.200L12 17l-5.6 3 1.3-6.200L3 9.500l6.3-.7z"/>',
    bolt:     '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
    vote:     '<path d="M4 12h16v8H4zM8 12l-1-6 7-2 1 6M9 16h6"/>',
    map:      '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
    bank:     '<path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  };
  const RULES = [
    [/no vehicle/i, 'nocar'], [/income/i, 'dollar'], [/poverty/i, 'poverty'], [/65/, 'elder'], [/under 18/i, 'youth'],
    [/disab/i, 'access'], [/renter/i, 'key'], [/unemploy/i, 'work'], [/^households/i, 'home'], [/census tracts|^districts$/i, 'grid'],
    [/categories/i, 'tag'], [/disaster/i, 'storm'], [/sites|infrastructure/i, 'facility'], [/residents|population|ideal/i, 'users'],
  ];
  const forLabel = (label) => { const r = RULES.find(([re]) => re.test(String(label))); return r ? r[1] : null; };
  const svg = (name, size = 20) => P[name] ? `<svg class="ico-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>` : '';
  const keys = () => Object.keys(P);
  return { svg, forLabel, keys };
})();
