// XoraLure — zero-dependency Node server.
// Serves the storefront, a JSON API, and a Server-Sent Events stream that
// pushes live inventory/price changes and site-version updates to browsers.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { VEHICLES, CATEGORIES, buildProducts } = require('./catalog');
const { importApi } = require('./lib/bigcommerce');

const PORT = Number(process.env.PORT) || 4321;
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const DEV = process.argv.includes('--dev');

fs.mkdirSync(DATA, { recursive: true });

// ---------- persistence ----------
function load(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); }
  catch { return typeof fallback === 'function' ? fallback() : fallback; }
}
function save(name, value) {
  const file = path.join(DATA, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
  fs.renameSync(file + '.tmp', file);
}

// source.json exists once real inventory has been imported (see import.js)
let source = load('source.json', null);
let products = load('products.json', buildProducts);
let categories = load('categories.json', CATEGORIES);
let orders = load('orders.json', []);
let quotes = load('quotes.json', []);
let messages = load('messages.json', []);
let subscribers = load('subscribers.json', []);
// Reviews come only from verified customers (order number + email must match)
let reviews = load('reviews.json', []);
const publicReview = (r) => ({ id: r.id, productId: r.productId, productTitle: r.productTitle, rating: r.rating, title: r.title, text: r.text, name: r.name, createdAt: r.createdAt, verified: true });
function reviewStats(list) {
  const count = list.length;
  return { count, average: count ? +(list.reduce((s, r) => s + r.rating, 0) / count).toFixed(1) : 0 };
}
save('products.json', products);

// null stock = inventory not tracked in the store, treated as available
const available = (p) => (p.stock == null ? 10 : p.stock);

// ---------- site version (drives auto-update in browsers) ----------
function hashDir(dir) {
  const h = crypto.createHash('sha1');
  (function walk(d) {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p); else h.update(f + st.size + st.mtimeMs);
    }
  })(dir);
  return h.digest('hex').slice(0, 10);
}
let siteVersion = hashDir(PUBLIC);

let watchTimer;
try {
  fs.watch(PUBLIC, { recursive: true }, () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      const v = hashDir(PUBLIC);
      if (v !== siteVersion) {
        siteVersion = v;
        console.log(`[update] site files changed -> version ${v}`);
        broadcast('version', { version: v });
      }
    }, 300);
  });
} catch (e) {
  console.warn('File watching unavailable; auto-update on file change disabled.', e.message);
}

// ---------- live event stream ----------
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => broadcast('ping', { t: Date.now() }), 25000);

// Apply a freshly imported catalog: push price/stock changes in place, and tell
// browsers to reload the catalog if products were added or removed.
function applyCatalog(next, nextCategories) {
  const old = new Map(products.map((p) => [p.id, p]));
  const changed = [];
  for (const p of next) {
    const o = old.get(p.id);
    if (o && (o.price !== p.price || o.stock !== p.stock)) changed.push({ id: p.id, stock: p.stock, price: p.price, updatedAt: p.updatedAt });
    if (o && o.price === p.price && o.stock === p.stock) p.updatedAt = o.updatedAt;
  }
  const structural = next.length !== products.length || next.some((p) => !old.has(p.id));
  products = next; categories = nextCategories;
  save('products.json', products); save('categories.json', categories);
  if (structural) broadcast('catalog', { count: products.length });
  else if (changed.length) broadcast('inventory', changed);
  return { changed: changed.length, structural };
}

// Apply a pending `node import.js ...` result (data/import.json), then remove it.
const IMPORT_FILE = path.join(DATA, 'import.json');
function applyPendingImport() {
  if (!fs.existsSync(IMPORT_FILE)) return;
  try {
    const imp = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8'));
    fs.rmSync(IMPORT_FILE, { force: true });
    if (!Array.isArray(imp.products) || !imp.products.length) return console.warn('[import] empty import ignored');
    const r = applyCatalog(imp.products, imp.categories || []);
    source = imp.source || { type: 'import' };
    save('source.json', source);
    console.log(`[import] loaded ${products.length} products (${r.structural ? 'catalog changed' : r.changed + ' price/stock change(s)'})`);
  } catch (e) { console.error('[import] could not apply import.json:', e.message); }
}
applyPendingImport();
fs.watchFile(IMPORT_FILE, { interval: 2000 }, (cur) => { if (cur.mtimeMs) applyPendingImport(); });

// Live sync with BigCommerce when API credentials are configured
const BC_HASH = process.env.BC_STORE_HASH, BC_TOKEN = process.env.BC_ACCESS_TOKEN;
if (BC_HASH && BC_TOKEN) {
  const minutes = Math.max(1, Number(process.env.BC_SYNC_MINUTES) || 15);
  const sync = async () => {
    try {
      const { products: next, categories: cats } = await importApi(BC_HASH, BC_TOKEN);
      if (!next.length) return console.warn('[sync] BigCommerce returned no products; keeping current catalog.');
      const r = applyCatalog(next, cats);
      source = { type: 'bigcommerce-api', importedAt: new Date().toISOString() };
      save('source.json', source);
      console.log(`[sync] ${next.length} products from BigCommerce — ${r.structural ? 'catalog changed' : r.changed + ' price/stock change(s)'}`);
    } catch (e) { console.error('[sync] failed:', e.message); }
  };
  sync();
  setInterval(sync, minutes * 60000);
  console.log(`BigCommerce sync on: every ${minutes} min`);
}

// Simulated warehouse feed for the demo catalog only — real inventory is never
// altered. Stock and prices move over time to show live updates working.
setInterval(() => {
  if (source) return;
  const changed = [];
  for (let i = 0; i < 3; i++) {
    const p = products[Math.floor(Math.random() * products.length)];
    if (Math.random() < 0.7) {
      p.stock = Math.max(0, Math.min(8, p.stock + (Math.random() < 0.5 ? -1 : 1)));
    } else {
      const factor = 1 + (Math.random() * 0.08 - 0.05);
      p.price = Math.max(19, Math.round(p.price * factor)) + 0.99;
    }
    p.updatedAt = Date.now();
    changed.push({ id: p.id, stock: p.stock, price: p.price, updatedAt: p.updatedAt });
  }
  save('products.json', products);
  broadcast('inventory', changed);
}, DEV ? 5000 : 20000);

// ---------- validation helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

function validateContact(b, errors) {
  if (clean(b.name).length < 2) errors.push('Name is required.');
  if (!EMAIL_RE.test(clean(b.email))) errors.push('A valid email is required.');
  if (clean(b.phone).replace(/\D/g, '').length < 10) errors.push('A valid 10-digit phone is required.');
}

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json' : 'text/plain',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) { reject(new Error('Body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
  });
}

const newId = (prefix) => prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/version') return send(res, 200, { version: siteVersion });
  if (route === 'GET /api/vehicles') return send(res, 200, VEHICLES);
  if (route === 'GET /api/categories') return send(res, 200, categories);

  if (route === 'GET /api/products') {
    const q = url.searchParams;
    let list = products;
    if (q.get('make')) list = list.filter((p) => p.make === q.get('make'));
    if (q.get('model')) list = list.filter((p) => p.model === q.get('model'));
    if (q.get('year')) { const y = +q.get('year'); list = list.filter((p) => y >= p.yearFrom && y <= p.yearTo); }
    if (q.get('category')) list = list.filter((p) => p.category === q.get('category'));
    // Large catalogs (tens of thousands of parts) compress ~10x with gzip
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      return zlib.gzip(JSON.stringify(list), (err, buf) => err ? send(res, 200, list)
        : send(res, 200, buf, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }));
    }
    return send(res, 200, list);
  }

  const m = url.pathname.match(/^\/api\/products\/([\w-]+)$/);
  if (req.method === 'GET' && m) {
    const p = products.find((x) => x.id === m[1]);
    return p ? send(res, 200, p) : send(res, 404, { error: 'Part not found' });
  }

  if (route === 'GET /api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: version\ndata: ${JSON.stringify({ version: siteVersion })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (route === 'POST /api/quote') {
    const b = await readBody(req);
    const errors = [];
    validateContact(b, errors);
    if (!clean(b.make) || !clean(b.model) || !clean(b.year)) errors.push('Year, make and model are required.');
    if (!clean(b.part)) errors.push('Tell us which part you need.');
    if (b.vin && !VIN_RE.test(clean(b.vin).toUpperCase())) errors.push('VIN must be 17 characters (no I, O or Q).');
    if (errors.length) return send(res, 400, { errors });
    const quote = {
      id: newId('Q'), createdAt: new Date().toISOString(), status: 'Received',
      name: clean(b.name), email: clean(b.email), phone: clean(b.phone), zip: clean(b.zip, 10),
      year: clean(b.year, 4), make: clean(b.make), model: clean(b.model), part: clean(b.part),
      vin: clean(b.vin, 17).toUpperCase(), notes: clean(b.notes, 1000)
    };
    quotes.push(quote); save('quotes.json', quotes);
    console.log(`[quote] ${quote.id} ${quote.year} ${quote.make} ${quote.model} — ${quote.part}`);
    return send(res, 201, { id: quote.id });
  }

  if (route === 'POST /api/order') {
    const b = await readBody(req);
    const errors = [];
    validateContact(b, errors);
    if (clean(b.address).length < 5) errors.push('Shipping address is required.');
    if (clean(b.city).length < 2) errors.push('City is required.');
    if (!/^[A-Z]{2}$/.test(clean(b.state).toUpperCase())) errors.push('Use a 2-letter state code.');
    if (!/^\d{5}(-\d{4})?$/.test(clean(b.zip))) errors.push('ZIP must be 5 digits.');
    if (!Array.isArray(b.items) || !b.items.length) errors.push('Your cart is empty.');
    if (errors.length) return send(res, 400, { errors });

    // Price and stock are always taken from the server, never trusted from the client.
    const lines = [];
    for (const it of b.items) {
      const p = products.find((x) => x.id === it.id);
      const qty = Math.max(1, Math.min(10, parseInt(it.qty, 10) || 1));
      if (!p) { errors.push(`Part ${clean(it.id, 20)} no longer exists.`); continue; }
      if (available(p) < qty) { errors.push(`Only ${available(p)} left of ${p.title}.`); continue; }
      lines.push({ id: p.id, title: p.title, price: p.price, qty });
    }
    if (errors.length) return send(res, 409, { errors });

    const changed = [];
    for (const l of lines) {
      const p = products.find((x) => x.id === l.id);
      if (p.stock != null) p.stock -= l.qty;
      p.updatedAt = Date.now();
      changed.push({ id: p.id, stock: p.stock, price: p.price, updatedAt: p.updatedAt });
    }
    const subtotal = +lines.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2);
    const order = {
      id: newId('XA'), createdAt: new Date().toISOString(), status: 'Processing',
      customer: { name: clean(b.name), email: clean(b.email), phone: clean(b.phone) },
      shipTo: { address: clean(b.address), city: clean(b.city), state: clean(b.state).toUpperCase(), zip: clean(b.zip) },
      lines, subtotal, shipping: 0, total: subtotal
    };
    orders.push(order);
    save('orders.json', orders); save('products.json', products);
    broadcast('inventory', changed);
    console.log(`[order] ${order.id} $${order.total} (${lines.length} item(s))`);
    return send(res, 201, { id: order.id, total: order.total });
  }

  const t = url.pathname.match(/^\/api\/orders\/([\w-]+)$/);
  if (req.method === 'GET' && t) {
    const email = clean(url.searchParams.get('email')).toLowerCase();
    const o = orders.find((x) => x.id === t[1].toUpperCase() && x.customer.email.toLowerCase() === email);
    if (!o) return send(res, 404, { error: 'No order matches that number and email.' });
    // Simulated fulfilment timeline based on order age
    const ageMin = (Date.now() - new Date(o.createdAt)) / 60000;
    const status = ageMin > 60 * 48 ? 'Delivered' : ageMin > 60 * 24 ? 'Shipped' : ageMin > 60 ? 'Inspected & Packed' : 'Processing';
    return send(res, 200, { id: o.id, status, createdAt: o.createdAt, lines: o.lines, total: o.total, shipTo: { city: o.shipTo.city, state: o.shipTo.state } });
  }

  if (route === 'GET /api/reviews') {
    const pid = url.searchParams.get('product');
    const list = (pid ? reviews.filter((r) => r.productId === pid) : reviews).filter((r) => r.status === 'published');
    const limit = Math.min(50, parseInt(url.searchParams.get('limit'), 10) || 20);
    return send(res, 200, { ...reviewStats(list), reviews: [...list].reverse().slice(0, limit).map(publicReview) });
  }

  if (route === 'POST /api/reviews') {
    const b = await readBody(req);
    const order = orders.find((o) => o.id === clean(b.orderId, 30).toUpperCase() && o.customer.email.toLowerCase() === clean(b.email).toLowerCase());
    if (!order) return send(res, 403, { errors: ['We could not find an order with that number and email. Only customers who bought from us can leave a review.'] });
    const line = order.lines.find((l) => l.id === clean(b.productId, 30));
    if (!line) return send(res, 400, { errors: ['Choose a product from this order to review.'] });
    if (reviews.some((r) => r.orderId === order.id && r.productId === line.id)) return send(res, 409, { errors: ['You already reviewed this product for this order. Thank you!'] });
    const rating = parseInt(b.rating, 10);
    const errors = [];
    if (!(rating >= 1 && rating <= 5)) errors.push('Choose a star rating from 1 to 5.');
    if (clean(b.text, 2000).length < 10) errors.push('Please write at least a sentence about your experience.');
    if (errors.length) return send(res, 400, { errors });
    // Show first name + last initial only, to protect customer privacy
    const parts = order.customer.name.split(/\s+/);
    const review = {
      id: newId('R'), createdAt: new Date().toISOString(), status: 'published',
      orderId: order.id, email: order.customer.email,
      productId: line.id, productTitle: line.title, rating,
      title: clean(b.title, 120), text: clean(b.text, 2000),
      name: parts[0] + (parts.length > 1 ? ' ' + parts[parts.length - 1][0].toUpperCase() + '.' : '')
    };
    reviews.push(review); save('reviews.json', reviews);
    broadcast('review', publicReview(review));
    console.log(`[review] ${review.id} ${rating}★ ${line.title}`);
    return send(res, 201, publicReview(review));
  }

  if (route === 'POST /api/subscribe') {
    const b = await readBody(req);
    const email = clean(b.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return send(res, 400, { errors: ['Please enter a valid email address.'] });
    if (!subscribers.some((s) => s.email === email)) {
      subscribers.push({ email, createdAt: new Date().toISOString() });
      save('subscribers.json', subscribers);
    }
    return send(res, 201, { ok: true });
  }

  if (route === 'POST /api/contact') {
    const b = await readBody(req);
    const errors = [];
    if (clean(b.name).length < 2) errors.push('Name is required.');
    if (!EMAIL_RE.test(clean(b.email))) errors.push('A valid email is required.');
    if (clean(b.message, 2000).length < 5) errors.push('Please write a message.');
    if (errors.length) return send(res, 400, { errors });
    messages.push({ id: newId('M'), createdAt: new Date().toISOString(), name: clean(b.name), email: clean(b.email), message: clean(b.message, 2000) });
    save('messages.json', messages);
    return send(res, 201, { ok: true });
  }

  return send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback: unknown non-asset paths get the app shell
      if (!path.extname(rel)) return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) =>
        e2 ? send(res, 500, 'Server error') : send(res, 200, html, { 'Content-Type': MIME['.html'] }));
      return send(res, 404, 'Not found');
    }
    const ext = path.extname(file);
    send(res, 200, buf, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0, must-revalidate'
    });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 400, { errors: [e.message] });
  }
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Start on another port, e.g.  PORT=5000 npm start`);
  else console.error(e);
  process.exit(1);
}).listen(PORT, () => {
  console.log(`XoraLure running at http://localhost:${PORT}${DEV ? ' (dev: fast inventory feed)' : ''}`);
});
