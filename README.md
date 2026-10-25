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
| Edit console | Appears only if your ArcGIS account can edit the layer. Edit member records; add, edit, move, delete CIKR facilities. All edits go through `applyEdits` as the signed-in user |

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
data/members.json     member seed data
photos/               member portraits (see above)
```
