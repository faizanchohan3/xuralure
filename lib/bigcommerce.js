// Import products from a BigCommerce store, either from a CSV export or the
// live API, and normalize them into the storefront's product format.

const fs = require('fs');

// ---------- helpers ----------
const slug = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };

// BigCommerce descriptions are HTML. Store plain text only, so nothing from the
// feed can inject markup or scripts into the storefront.
function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()
    .slice(0, 5000);
}

// Pick an icon for categories that come from the store (used when a part has no photo)
function iconFor(name) {
  const n = name.toLowerCase();
  if (/brake|wheel|tire|steer/.test(n)) return 'wheel';
  if (/exhaust|drive|axle|suspension|shock|strut/.test(n)) return 'axle';
  if (/light|lamp/.test(n)) return 'light';
  if (/cool|heat|radiat|a\/c|hvac/.test(n)) return 'snow';
  if (/electric|ignition|battery|alternator|starter/.test(n)) return 'bolt';
  if (/gauge|sensor|module|computer/.test(n)) return 'chip';
  if (/engine|fuel|air|intake|filter/.test(n)) return 'engine';
  if (/transmission|gear|clutch/.test(n)) return 'gear';
  if (/hose|fitting|valve/.test(n)) return 'grid';
  if (/mirror/.test(n)) return 'mirror';
  if (/door|body/.test(n)) return 'door';
  return 'car';
}

// Pull year/make/model out of a title like "2015-2018 Ford F-150 ..." when present
const MAKES = ['Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep', 'Kia', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Ram', 'Subaru', 'Toyota', 'Volkswagen', 'Volvo'];
function fitmentFromTitle(title) {
  const m = String(title).match(/\b((?:19|20)\d{2})(?:\s*-\s*((?:19|20)?\d{2}))?\s+([A-Za-z-]+)\s+([A-Za-z0-9-]+)/);
  if (!m) return {};
  const make = MAKES.find((x) => x.toLowerCase() === m[3].toLowerCase());
  if (!make) return {};
  let to = m[2] ? +m[2] : +m[1];
  if (to < 100) to += 2000;
  return { make, model: m[4], yearFrom: +m[1], yearTo: to };
}

function finish(p) {
  // Only show a crossed-out "was" price when there is a real discount
  if (!(p.listPrice > p.price)) p.listPrice = null;
  p.icon = iconFor(p.categoryName + ' ' + p.title);
  Object.assign(p, fitmentFromTitle(p.title));
  p.updatedAt = Date.now();
  return p;
}

function categoriesFrom(products) {
  const map = new Map();
  for (const p of products) if (!map.has(p.category)) map.set(p.category, { id: p.category, name: p.categoryName, icon: iconFor(p.categoryName) });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- CSV ----------
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Column names differ between BigCommerce export templates; accept all of them.
const COLS = {
  type: ['item type'],
  id: ['product id', 'id'],
  name: ['product name', 'name'],
  sku: ['product code/sku', 'sku', 'product sku'],
  brand: ['brand name', 'brand', 'brand_name'],
  price: ['price', 'calculated price'],
  sale: ['sale price', 'sale_price'],
  retail: ['retail price', 'retail_price', 'msrp'],
  stock: ['current stock level', 'inventory_level', 'stock level', 'inventory level'],
  track: ['track inventory', 'inventory_tracking'],
  category: ['category', 'categories', 'category string'],
  desc: ['product description', 'description'],
  image: ['product image url - 1', 'product image url', 'image url', 'image_url', 'images'],
  visible: ['product visible?', 'is_visible', 'visible'],
  url: ['product url', 'custom_url', 'url']
};

function importCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (rows.length < 2) throw new Error('CSV has no product rows.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [k, names] of Object.entries(COLS)) col[k] = head.findIndex((h) => names.includes(h));
  if (col.name < 0 || col.price < 0) throw new Error(`Could not find "Product Name" and "Price" columns. Found: ${rows[0].join(', ')}`);
  const get = (r, k) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');

  const products = [];
  for (const r of rows.slice(1)) {
    const type = get(r, 'type');
    if (type && type.toLowerCase() !== 'product') continue; // skip variant/rule rows
    if (/^(n|no|false|0)$/i.test(get(r, 'visible'))) continue;
    const name = get(r, 'name'); if (!name) continue;
    // "Brakes/Brake Pads;Exhaust" → first path, top level is the category
    const catPath = (get(r, 'category').split(';')[0] || 'Other').split('/').map((s) => s.trim()).filter(Boolean);
    const top = catPath[0] || 'Other';
    const price = num(get(r, 'sale')) || num(get(r, 'price'));
    const tracked = !/^(none|by product: no|n|no)$/i.test(get(r, 'track') || 'yes') && col.stock >= 0;
    const id = get(r, 'id') || slug(get(r, 'sku') || name);
    products.push(finish({
      id: 'BC' + id, sku: get(r, 'sku'), title: name, brand: get(r, 'brand'),
      category: slug(top), categoryName: top, subcategory: catPath.slice(1).join(' › '),
      price, listPrice: num(get(r, 'retail')) || num(get(r, 'price')),
      stock: tracked ? Math.max(0, Math.round(num(get(r, 'stock')))) : null,
      image: (get(r, 'image').split(/[|;,]\s*(?=https?:)/)[0] || '').trim() || null,
      description: htmlToText(get(r, 'desc')),
      spec: {}
    }));
  }
  return { products, categories: categoriesFrom(products) };
}

// ---------- API ----------
async function bcGet(hash, token, path) {
  const res = await fetch(`https://api.bigcommerce.com/stores/${hash}/v3${path}`, {
    headers: { 'X-Auth-Token': token, Accept: 'application/json' }
  });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); return bcGet(hash, token, path); }
  if (!res.ok) throw new Error(`BigCommerce API ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function bcAll(hash, token, path) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await bcGet(hash, token, `${path}${sep}limit=250&page=${page}`);
    out.push(...r.data);
    const pg = r.meta?.pagination;
    if (!pg || page >= pg.total_pages) break;
  }
  return out;
}

async function importApi(hash, token) {
  if (!hash || !token) throw new Error('Set BC_STORE_HASH and BC_ACCESS_TOKEN (see .env.example).');
  const [items, cats, brands] = await Promise.all([
    bcAll(hash, token, '/catalog/products?include=images&is_visible=true'),
    bcAll(hash, token, '/catalog/categories'),
    bcAll(hash, token, '/catalog/brands')
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const topOf = (id) => { let c = catById.get(id); while (c && c.parent_id && catById.get(c.parent_id)) c = catById.get(c.parent_id); return c; };
  const brandById = new Map(brands.map((b) => [b.id, b.name]));

  const products = items.map((p) => {
    const first = catById.get(p.categories?.[0]);
    const top = topOf(p.categories?.[0]);
    const img = (p.images || []).find((i) => i.is_thumbnail) || (p.images || [])[0];
    return finish({
      id: 'BC' + p.id, sku: p.sku || '', title: p.name, brand: brandById.get(p.brand_id) || '',
      category: slug(top?.name || 'Other'), categoryName: top?.name || 'Other',
      subcategory: first && top && first.id !== top.id ? first.name : '',
      price: p.sale_price > 0 ? p.sale_price : p.price,
      listPrice: p.retail_price || p.price,
      stock: p.inventory_tracking === 'none' ? null : Math.max(0, p.inventory_level),
      image: img?.url_standard || null,
      description: htmlToText(p.description),
      spec: {}
    });
  });
  return { products, categories: categoriesFrom(products) };
}

module.exports = { importCsv, importApi, parseCsv, htmlToText, finish, categoriesFrom, slug };
