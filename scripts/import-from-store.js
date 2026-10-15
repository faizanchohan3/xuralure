// Import the product list from the category pages of your own BigCommerce
// storefront: product name, brand, price, category, and a link to each
// product photo on the store's BigCommerce CDN (images are linked, not
// copied). Descriptions and stock levels come from your BigCommerce export
// (`npm run import -- export.csv`).
//
//   node scripts/import-from-store.js https://agileautoparts.com
//
// It follows the store's robots.txt crawl delay (10 s between requests), so a
// large catalog takes a while. Progress is saved; re-run to resume.

const fs = require('fs');
const path = require('path');
const { finish, categoriesFrom, slug } = require('../lib/bigcommerce');

const BASE = (process.argv[2] || '').replace(/\/+$/, '');

const DATA = path.join(__dirname, '..', 'data');
const PROGRESS = path.join(DATA, 'store-import-progress.json');
const DELAY_MS = 10000; // robots.txt Crawl-delay
const PER_PAGE = 100;
fs.mkdirSync(DATA, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

const UA = { 'User-Agent': 'XoraLure-CatalogImport/1.0 (store owner catalog import)' };

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { fatal: true });
      return await res.text();
    } catch (e) {
      if (e.fatal || attempt >= 4) throw e;
      console.log(`  ${url}: ${e.message}, retrying in ${attempt * 30}s`);
      await sleep(attempt * 30000);
    }
  }
}

// Each product card carries its facts as data-* attributes
function parseCards(html) {
  const out = [];
  for (const m of html.matchAll(/<article\b[^>]*\bdata-product-id="(\d+)"[^>]*>/g)) {
    const tag = m[0];
    const attr = (name) => { const a = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return a ? decode(a[1]) : ''; };
    const title = attr('data-name');
    const price = parseFloat(attr('data-product-price').replace(/[^0-9.]/g, ''));
    if (!title || !(price > 0)) continue;
    const cats = attr('data-product-category').split(',').map((s) => s.trim()).filter((c) => c && !/^shop all$/i.test(c));
    // Photo: link to the image on the store's own BigCommerce CDN (not downloaded or re-hosted)
    const card = html.slice(m.index, m.index + 4000);
    const img = card.match(/<img[^>]*\bsrc="(https:\/\/cdn\d*\.bigcommerce\.com\/[^"]+)"/);
    out.push({ storeId: m[1], title, brand: attr('data-product-brand'), price, category: cats[0] || 'Other', image: img ? decode(img[1]) : null });
  }
  return out;
}

// Pagination links carry aria-label="Page 1 of 6"
function lastPage(html) {
  const m = html.match(/aria-label="Page \d+ of (\d+)"/);
  return m ? +m[1] : 1;
}

// Category listing URLs from the store's XML sitemap
function categoryUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]).replace(/\/?$/, '/'));
}

async function main() {
  if (!/^https:\/\/[\w.-]+$/.test(BASE)) { console.log('Usage: node scripts/import-from-store.js https://your-store.com'); process.exit(1); }
  let state = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : null;
  if (state && (state.base !== BASE || !state.lists)) state = null;
  if (!state) {
    const xml = await get(`${BASE}/xmlsitemap.php?type=categories&page=1`);
    state = { base: BASE, lists: categoryUrls(xml), list: 0, page: 1, last: null, items: {} };
    console.log(`Found ${state.lists.length} categories to read.`);
    await sleep(DELAY_MS);
  }

  while (state.list < state.lists.length) {
    const listUrl = state.lists[state.list];
    const html = await get(`${listUrl}?limit=${PER_PAGE}&page=${state.page}`);
    if (state.last === null) state.last = lastPage(html);
    const cards = parseCards(html);
    for (const c of cards) state.items[c.storeId] = c;
    console.log(`[${state.list + 1}/${state.lists.length}] ${listUrl.replace(BASE, '')} page ${state.page}/${state.last}: ${cards.length} products (unique total ${Object.keys(state.items).length})`);
    if (state.page >= state.last || !cards.length) { state.list++; state.page = 1; state.last = null; }
    else state.page++;
    fs.writeFileSync(PROGRESS, JSON.stringify(state));
    if (state.list < state.lists.length) await sleep(DELAY_MS);
  }

  const products = Object.values(state.items).map((c) => finish({
    id: 'AG' + c.storeId, sku: '', title: c.title, brand: c.brand,
    category: slug(c.category), categoryName: c.category, subcategory: '',
    price: c.price, listPrice: null, stock: null, image: c.image || null, description: '', spec: {}
  }));
  const categories = categoriesFrom(products);
  const file = path.join(DATA, 'import.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify({ products, categories, source: { type: 'storefront', store: BASE, importedAt: new Date().toISOString() } }));
  fs.renameSync(file + '.tmp', file);
  fs.rmSync(PROGRESS, { force: true });
  console.log(`Done: ${products.length} products in ${categories.length} categories. The running server loads them automatically.`);
}

if (require.main === module) main().catch((e) => { console.error('Import stopped:', e.message, '— re-run the same command to resume.'); process.exit(1); });
module.exports = { parseCards, lastPage, categoryUrls };
