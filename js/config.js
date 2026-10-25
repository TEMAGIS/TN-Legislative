// ════════════════════════════════════════════════════════════════
//  CONFIG — the only file you should need to edit to deploy.
//
//  1. clientId     → register a NEW "Native / Browser application" item in
//                    ArcGIS Online (see README) and paste its Client ID.
//  2. redirectUri  → leave null to auto-use the page's own URL, or set the
//                    exact GitHub Pages URL you added as a Redirect URI.
//  3. censusApiKey → free key: https://api.census.gov/data/key_signup.html
//                    (the Census API now rejects keyless requests).
// ════════════════════════════════════════════════════════════════
const ORG = 'https://services1.arcgis.com/kILp9lqGUeOhnDbI/arcgis/rest/services/';

window.CONFIG = {
  appTitle: 'TN Legislative Districts',
  clientId: 'Zopcm7n38K754eJt',
  redirectUri: null,
  authorizeUrl: 'https://www.arcgis.com/sharing/rest/oauth2/authorize',
  tokenUrl: 'https://www.arcgis.com/sharing/rest/oauth2/token',
  portalUrl: 'https://www.arcgis.com/sharing/rest',
  tokenExpirationMinutes: 20160,       // refresh-token lifetime (max 14 days)
  refreshBufferMs: 5 * 60 * 1000,
  tokenKey: 'legapp_token_v1',

  censusApiKey: 'da15544938f3846147bc547b15f88413e7a4cf5d',                  // <-- paste your Census API key
  acsYears: ['2024', '2023', '2022'],  // tried newest → oldest

  // ── District layers (all three chambers) ─────────────────────────
  // Congress points at the UPDATED layer (May 2026 map), the same service
  // the PREDS Summary app already uses.
  chambers: {
    congress: {
      label: 'Congressional Districts', short: 'Congress', seatTitle: 'Representative',
      url: ORG + 'TN_Congressional_Districts_Update/FeatureServer/0',
      seats: 9, color: '#0b4f9c', photoDir: 'photos/congress/',
    },
    senate: {
      label: 'Senatorial Districts', short: 'Senate', seatTitle: 'Senator',
      url: ORG + 'TN_Senate_District/FeatureServer/0',
      seats: 33, color: '#7a4b2a', photoDir: 'photos/senate/',
    },
    house: {
      label: 'TN House Districts', short: 'House', seatTitle: 'Representative',
      url: ORG + 'HouseDistricts_ExportFeature/FeatureServer/0',
      seats: 99, color: '#136f63', photoDir: 'photos/house/',
    },
  },
  // Field names on the district layers. Fields that don't exist on a layer
  // are simply hidden, and the Edit tab's schema check lists what to add.
  districtFields: {
    id: 'DISTRICT', name: 'NAME', population: 'POPULATION', longName: 'LongName',
    party: 'Party', title: 'Title', firstYear: 'First_Year',
    leadership: 'Leadership_Position', committees: 'Committees',
    photo: 'PhotoURL', website: 'Website', bioguide: 'BioguideID',
    filter: 'District_Filter',   // value the old dashboard used to join disasters to districts
  },
  // Field on the grants / disaster layers that holds the district (taken from the old dashboard's
  // filter wiring). Matching tries District_Filter, LongName ("District 1"), "1", "01" so the exact
  // value format doesn't matter. Not set here? It falls back to any field containing cong / sen / house.
  joinFields: {
    grants:    { congress: 'Congress', senate: 'Senate', house: 'House' },
    disasters: { congress: 'congress', senate: 'senate', house: 'house' },
  },

  // ── Infrastructure layer maintained by the Legislative Advising group ─
  cikr: {
    url: ORG + 'Legislative_CIKR/FeatureServer/0',
    nameField: 'Facility', categoryField: 'Category', notesField: 'Notes',
    // Map symbols. Exact category names win; otherwise the first keyword rule that
    // matches the category text is used. Symbol keys are defined in js/symbols.js.
    symbols: { /* 'Higher Edu': 'education' */ },
    symbolRules: [
      [/hospital|health|medical|clinic|nursing/i, 'health'],
      [/edu|school|college|universit/i, 'education'],
      [/dam|levee/i, 'dam'],
      [/chem|hazmat|hazardous|industr|manufactur/i, 'chemical'],
      [/wastewater|water|sewer/i, 'water'],
      [/power|energy|electric|nuclear|utilit|gas|fuel|pipeline/i, 'power'],
      [/fire|police|law|sheriff|ems|emergency|public safety|corrections|prison/i, 'safety'],
      [/govern|court|capitol|office|admin/i, 'government'],
      [/transport|airport|aviation|bridge|rail|road|highway|transit|port/i, 'transport'],
      [/communic|telecom|radio|broadcast|tower|data/i, 'comms'],
      [/shelter|housing|lodging|hotel/i, 'shelter'],
    ],
  },

  counties: { url: ORG + 'TN_Counties_Census_2020/FeatureServer/0', fips: 'COUNTY_FIPS', name: 'NAME' },
  // Esri Living Atlas "USA Census Tracts" — public, no token. 2022 POPULATION per tract.
  tracts: { url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_Tracts/FeatureServer/0' },

  // ── Grants & disasters (resolved from item id → service URL at runtime) ─
  grants: [
    { key: 'EMPG', label: 'Emergency Mgmt Performance Grant', itemId: 'e3b7ce43ff2d4710bca25a9b3ae95f6b' },
    { key: 'HSGP', label: 'Homeland Security Grant Program',  itemId: 'f941368779094903ac9cdd724f72e770' },
    { key: 'HMEP', label: 'Hazmat Emergency Preparedness',    itemId: '708934d6eef9464ba5cd1a7483ee1cee' },
  ],
  grantFields: { amount: 'Amount', year: 'Year' },
  // Optional overrides: name of the field on each grants/disaster layer that
  // holds the district. Leave null to auto-detect (a field matching /cong/i etc.).
  grantDistrictField: null,
  // Disaster declarations come from the public OpenFEMA API (no login). Counties are matched to
  // districts by FIPS code. Set source: 'layer' to use the internal layer below instead.
  disasters: {
    source: 'fema',
    femaUrl: 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries',
    state: 'TN',
    itemId: 'fcf5f76dc92a403db38bcf6591dea232', districtField: null,   // used when source is 'layer' (or FEMA is unreachable)
  },
  fiscalYears: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],

  // Statewide ideal-district populations come from the layer's own totals.
  mapCenter: [35.85, -86.35], mapZoom: 7,
  basemap: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  basemapLabels: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
};
