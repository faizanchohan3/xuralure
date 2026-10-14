// Import your BigCommerce inventory into the storefront.
//
//   node import.js path/to/products-export.csv   # from a CSV export
//   node import.js --api                          # from the BigCommerce API (.env credentials)
//   node import.js --demo                         # go back to the built-in demo catalog
//
// A running server picks up the new data automatically.

const fs = require('fs');
const path = require('path');
const { importCsv, importApi } = require('./lib/bigcommerce');

const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
// Written atomically to data/import.json; the server applies it (on start, or
// within a couple of seconds if it's running) so it never races server writes.
const write = (name, v) => {
  const file = path.join(DATA, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(v));
  fs.renameSync(file + '.tmp', file);
};

(async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node import.js <export.csv> | --api | --demo');
    process.exit(1);
  }
  if (arg === '--demo') {
    for (const f of ['products.json', 'categories.json', 'source.json', 'import.json']) fs.rmSync(path.join(DATA, f), { force: true });
    console.log('Removed imported catalog. Restart the server to load the demo catalog.');
    return;
  }

  const { products, categories } = arg === '--api'
    ? await importApi(process.env.BC_STORE_HASH, process.env.BC_ACCESS_TOKEN)
    : importCsv(path.resolve(arg));

  if (!products.length) throw new Error('No visible products found to import.');
  write('import.json', {
    products, categories,
    source: { type: arg === '--api' ? 'bigcommerce-api' : 'csv', file: arg === '--api' ? null : path.basename(arg), importedAt: new Date().toISOString() }
  });

  const tracked = products.filter((p) => p.stock !== null).length;
  console.log(`Imported ${products.length} products in ${categories.length} categories (${tracked} with stock tracking, ${products.filter((p) => p.image).length} with photos).`);
  categories.forEach((c) => console.log(`  ${c.name}: ${products.filter((p) => p.category === c.id).length}`));
})().catch((e) => { console.error('Import failed:', e.message); process.exit(1); });
