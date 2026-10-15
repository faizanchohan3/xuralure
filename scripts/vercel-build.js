// Vercel build: writes .vercel/output using Vercel's Build Output API (v3),
// which spells out exactly what to deploy instead of relying on auto-detection:
//   static/          → the storefront (public/)
//   functions/api.func → the API server (server.js + its modules + seed catalog)
//   config.json      → routing: static files first, /api/* → the function
// Docs: https://vercel.com/docs/build-output-api/v3

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, '.vercel', 'output');
const fn = path.join(out, 'functions', 'api.func');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(fn, { recursive: true });

// Static storefront
fs.cpSync(path.join(root, 'public'), path.join(out, 'static'), { recursive: true });

// The full catalog as a static file: served from Vercel's CDN (compressed and
// cached at the edge) instead of the function, so pages load fast. Orders
// still re-check price and stock on the server.
const seedFile = path.join(root, 'seed', 'products.json');
const catalog = fs.existsSync(seedFile) ? require(seedFile) : require(path.join(root, 'catalog.js')).buildProducts();
fs.writeFileSync(path.join(out, 'static', 'catalog.json'), JSON.stringify(catalog));

// Serverless function: the server and everything it requires
for (const item of ['server.js', 'catalog.js', 'lib', 'seed', 'package.json']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(fn, item), { recursive: true });
}
fs.writeFileSync(path.join(fn, 'index.js'), "module.exports = require('./server.js');\n");
fs.writeFileSync(path.join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 30
}, null, 2));

// Routing
fs.writeFileSync(path.join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/(sw\\.js|index\\.html)?$', headers: { 'Cache-Control': 'no-cache' }, continue: true },
    { src: '^/api/products$', dest: '/catalog.json' },
    { src: '^/api/(.*)$', dest: '/api?path=$1' },
    { handle: 'filesystem' }
  ]
}, null, 2));

const count = (d) => fs.readdirSync(d, { recursive: true }).length;
console.log(`Vercel output ready: ${count(path.join(out, 'static'))} static files, function with ${count(fn)} files` +
  (fs.existsSync(path.join(root, 'seed', 'products.json')) ? ' (includes seed catalog)' : ' (demo catalog)'));
