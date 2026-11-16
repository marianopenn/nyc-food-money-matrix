# Who Owns The Block? (NYC Food Money Matrix)

A map of Williamsburg, Brooklyn restaurants, cafés and bars, labelled by who actually owns them:

- **$ PE-backed**: a private-equity or growth-equity firm owns the brand or holds a reported stake (including franchised chains whose brand sits with a buyout fund).
- **C Corp & VC**: owned by a publicly traded company, or scaling on venture rounds.
- **I Independent**: founder, family or local-operator owned, with no institutional owner found in public reporting.

Every entry cites its sources, shows a "follow the money" ownership chain, and has a confidence rating. Tapping a PE or corporate spot suggests the nearest independent alternatives.

The idea comes from the [London Food Money Matrix](https://london-food-money-matrix.vercel.app). This is a separate implementation for NYC, starting with Williamsburg.

## Run locally

It's a static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

(The page fetches `data/restaurants.json`, so opening `index.html` straight from disk won't work. Serve it.)

## Deploy

Any static host works. On Vercel, import the repo with framework preset **Other** and leave the build command empty.

## Data

All places live in [`data/restaurants.json`](data/restaurants.json). Each entry has:

| field | meaning |
|---|---|
| `tier` | `pe`, `corp` or `indie` |
| `owner` | who owns it, in one line |
| `chain` | ownership chain from the storefront up to the ultimate owner |
| `note` | context, including mixed cases |
| `sources` | list of `{label, url}` |
| `confidence` | `high` when sources state the ownership directly, `medium` when it's inferred (e.g. no investor found) |
| `lat`, `lng` | geocoded with NYC Planning GeoSearch |
| `area`, `cuisine` | used by the filters |

To add or correct a place, open an issue or PR with a source link. Ownership changes, so dates matter.

## Stack

Plain HTML/CSS/JS, [Leaflet](https://leafletjs.com) 1.9.4, CARTO dark basemap (OpenStreetMap data), Google Fonts (Anton, Archivo, IBM Plex Mono).
