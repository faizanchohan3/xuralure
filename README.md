# XoraLure

Used & OEM auto parts storefront with live inventory, smart autocorrect, and an auto-updating front end. No dependencies — just Node.js 18+.

## Run

```bash
npm start        # http://localhost:4321
npm run dev      # same, with a faster simulated inventory feed (every 5s)
```

## Import your BigCommerce inventory

**Option A — CSV export (no setup)**
1. In BigCommerce: **Products › Export**, choose the *Bulk Edit* (or default) template, export as CSV.
2. Run: `npm run import -- path/to/products-export.csv`

**Option B — live API sync (recommended, keeps prices & stock up to date automatically)**
1. In BigCommerce: **Settings › API › Store-level API accounts › Create API account**, scope *Products: read-only*.
2. Copy `.env.example` to `.env` and fill in `BC_STORE_HASH` and `BC_ACCESS_TOKEN`.
3. Run `npm run import -- --api` once, then `npm start`. The server re-syncs every `BC_SYNC_MINUTES` (default 15) and pushes changes to open browsers.

Imports apply instantly if the server is running. Only visible products are imported; descriptions are converted to plain text. Products without inventory tracking are shown as in stock. `npm run import -- --demo` switches back to the demo catalog (restart afterwards).

## Deploy to Vercel

The repo is ready for Vercel (`vercel.json` + `api/index.js`): the storefront is served from `public/` and the API runs as a serverless function.

1. Import the GitHub repo in Vercel — no build settings needed.
2. **Add a database so orders, reviews and subscribers are saved:** Vercel dashboard → your project → **Storage** → **Create / Connect** → **Upstash for Redis** (free tier) → connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. Redeploy.
   Without it the site works, but anything customers submit is lost after a few minutes.
3. The product catalog ships with the code from `seed/products.json`. To update it: run an import locally, then `npm run seed` and push.

On Vercel, prices/stock refresh every 60 s and open browsers reload automatically after each deploy (no live stream on serverless).

## Features

- **Vehicle part finder** — Year → Make → Model → Part, remembered between visits.
- **Shop** — keyword search, filters (year/make/model/part/grade/in-stock), sorting.
- **Product pages** — grade, mileage, specs, warranty, related parts.
- **Cart & checkout** — server re-checks price and stock; orders saved to `data/orders.json`.
- **Quote requests** (`data/quotes.json`), **contact form** (`data/messages.json`), **order tracking**.
- **Auto-correction**
  - Search: typo correction (“altenator” → alternator, “toyta camry”), slang (“tranny”, “chevy”, “ecm”), “Did you mean…”.
  - Forms: email domain fixes (`gmial.con` → `gmail.com`), phone formatting, name capitalization, state names → codes, ZIP, street suffixes, VIN (I/O/Q → 1/0/0).
- **Auto-update**
  - Live inventory: price/stock changes stream to every open browser (Server-Sent Events); cards, product pages and the cart update in place, and carts are adjusted if a part sells out.
  - Site updates: editing anything in `public/` bumps the site version and open browsers reload automatically (or show an “Update now” button if the visitor is typing).
  - Service worker: network-first, so visitors always get the newest files, with an offline fallback.

## Where things live

| Path | Purpose |
|---|---|
| `server.js` | HTTP server, API, live stream, file watcher |
| `catalog.js` | Vehicle list, categories, demo inventory |
| `import.js`, `lib/bigcommerce.js` | BigCommerce CSV/API import + sync |
| `public/` | Storefront (HTML/CSS/JS) |
| `data/` | Saved products, orders, quotes, messages (created on first run) |

To reset the inventory, delete `data/products.json` and restart.

## Before going live

- Replace the simulated inventory feed in `server.js` with your real inventory source.
- Add a payment provider (e.g. Stripe) in the `/api/order` route; checkout is currently demo-only.
- Set up email notifications for quotes and orders.
- Replace the placeholder phone number and email in `public/index.html` and `public/js/app.js`.
