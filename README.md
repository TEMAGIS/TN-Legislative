# TN Legislative Districts (redesign)

Static web app (Leaflet + ArcGIS REST, no build step) for viewing and editing Tennessee's
Congressional, Senate and House districts and summarising the Legislative CIKR infrastructure layer.
Hosted on GitHub Pages; signs in with ArcGIS Online OAuth 2.0 + PKCE, same pattern as PREDS Summary.

## What it does

| Area | Behaviour |
|---|---|
| Viewer | Three district sets (Congress / Senate / House), searchable list, map with district shading, optional county lines, deep links like `#congress/5` |
| Member card | Photo, name, party, title, in-office-since, leadership, committees, website. Photo falls back through `PhotoURL` field → `photos/…` in this repo → public Congress image → initials |
| Census profile | Population, households, median household income, poverty, age 65+/under 18, disability, no-vehicle, renter share, unemployment, race (2020 Census), Hispanic share, county makeup with split-county flags. Each stat shows the statewide figure for comparison |
| Infrastructure | CIKR sites assigned to districts **by geometry** (point-in-polygon), so counts stay correct after redistricting. Category breakdown, filterable list, map markers |
| Grants / Disasters | EMPG, HSGP, HMEP totals by fiscal year and disaster declarations for the selected district (layers resolved from the item IDs in the old dashboard) |
| Appearance | Edit tab → Appearance: staff pick the map symbol and color for each infrastructure category, the district colors, and the icon, label and visibility of every census / summary tile. Saved to a shared ArcGIS Online item so all viewers see it |
| Edit console | Shown with `?edit=1`. Edit member records and portraits; add, edit, move, delete CIKR facilities; add, edit, delete EMPG / HSGP / HMEP grant awards (form built from each layer's own fields); sync boundaries from the source layer. All edits go through `applyEdits` as the signed-in user |

## Viewer vs. editor URLs

* `https://…/legislative-app/` — read-only viewer (no Edit tab, no Edit buttons).
* `https://…/legislative-app/?edit=1` — shows the Edit tab and an **Edit mode** badge. Share this URL (e.g. in a separate
  Experience Builder page) with the people who maintain the data. The setting is remembered for the browser session so it survives sign-in.
* `?edit=0` turns it back off.

`?edit=1` only reveals the editing screens. Who can actually save changes is decided by the ArcGIS layer's sharing and
editing settings, so users without permission will see a "no permission" message rather than being able to edit.

## Updating boundaries (Sync boundaries)

The Congress layer the app reads/edits is `TN_Congressional_Districts` (existing layer with member data). In edit mode
(`?edit=1`) → Edit tab → **Boundaries → Compare with source** reads `TN_Congressional_Districts_Update`, matches districts on
`DISTRICT`, and lists which shapes and populations differ. **Apply** downloads a JSON backup of the current shapes, then updates only
geometry and population one district at a time. Member names, committees and photos are not touched. It runs as the signed-in
user, so that account needs edit rights (including geometry updates) on the target layer and read access to the source.
Change the pair in `js/config.js` (`chambers.congress.url` / `syncSource`).

## Appearance settings (symbols, colors, census icons)

In edit mode open **Edit → Appearance**. Click a symbol to choose from the glyph gallery, pick a color, rename or hide census tiles,
and change section icons. Changes preview immediately; **Save for everyone** writes them to an ArcGIS Online item
(type *Application*, tag `tn-legislative-app-settings`, shared with the organization). The first save creates the item under the
saver's account; later saves update it (the saver must own it, be an org admin, or be in its shared-update group). Every user's app
finds it by tag on load. To pin a specific item, set `settings.itemId` in `js/config.js`. **Export JSON / Import JSON** make a backup,
and a file saved as `data/settings.json` in the repo is used as the default when no shared item exists. New categories added to the
infrastructure layer appear in the list automatically.

## Deploy

1. **Register the app in ArcGIS Online** (Content → New item → Application → *Other application*, or copy how PREDS Summary was registered).
   Add your GitHub Pages URL as a **Redirect URI** exactly as it will be opened, including the trailing slash, e.g.
   `https://temagis.github.io/<repo-name>/`. Copy the **Client ID**.
2. Edit `js/config.js`:
   - `clientId` → the new Client ID
   - `redirectUri` → leave `null` (auto) or set the exact URL from step 1
   - `censusApiKey` → free key from https://api.census.gov/data/key_signup.html (the Census API now rejects keyless calls)
3. Push to GitHub, then Settings → Pages → deploy from the branch root.

## Photos

**Admin upload (recommended):** in the Edit tab, select a district, choose an image and click *Upload portrait*. It is resized
to ≤450×560 JPEG and stored as an attachment on that district's feature, so it needs **Attachments enabled** on the district
layer in ArcGIS Online and an account that can edit it. An uploaded portrait takes priority everywhere; *Remove uploaded* reverts
to the defaults below. Photo order: uploaded attachment → `PhotoURL` field → file in this repo → public Congress image → initials.

**Repo files (defaults):**

Congress photos live in `photos/congress/<slug>.jpg` (slugs: harshbarger, burchett, fleischmann, desjarlais,
ogles, rose, vanepps, kustoff, cohen). Official portraits are public-domain works of the U.S. House.
For Senate / House, name files by zero-padded district: `photos/senate/05.jpg`, `photos/house/42.jpg`,
or set the `PhotoURL` field on the layer to any path/URL.

## Data assumptions to verify

* **Congress layer** is `TN_Congressional_Districts_Update` (the service PREDS Summary already uses). It must hold the
  May 2026 boundaries. Confirm in ArcGIS Online; if it is still the old geometry, republish it.
* **Recommended fields** on the district layers (the Edit tab lists any that are missing): `DISTRICT`, `NAME`, `POPULATION`,
  `LongName`, `Party`, `Title`, `First_Year`, `Leadership_Position`, `Committees`, `PhotoURL`, `Website`, `BioguideID`.
  Only `DISTRICT` is required; everything else degrades gracefully.
* **Grants / disasters** are matched to districts by a field whose name contains `cong` / `sen` / `house` (or set
  `grantDistrictField` / `disasters.districtField` in config). Without one, grants fall back to point-in-district if the layer
  has point geometry, and disasters fall back to matching county names.
* **Census figures** assign each census tract to the district containing its centroid, then roll up ACS 5-year and 2020
  Census data. Districts that divide a county (the 2026 map splits Shelby County three ways) are close approximations,
  not official Census district counts.
* `data/members.json` seeds member names/party/first-year for the 119th Congress; the layer's own attributes take priority.
  Verify Van Epps' Bioguide ID (left blank) at https://bioguide.congress.gov.

## Files

```
index.html            page shell
css/app.css           styles
js/config.js          the only file to edit for deployment
js/auth.js            OAuth 2.0 + PKCE, silent refresh
js/arcgis.js          REST helpers, paging, applyEdits, point-in-polygon
js/census.js          tract → district assignment, ACS / Census roll-up
js/app.js             state, map, district list, boot
js/panels.js          Overview, Infrastructure, Grants, Disasters, Edit
js/settings.js        shared appearance settings (load/save to ArcGIS Online item)
js/appearance.js      Edit → Appearance UI
data/members.json     member seed data
photos/               member portraits (see above)
```
