// Copy the current catalog (data/products.json + categories.json) into seed/,
// which is committed with the code so serverless deploys (Vercel) include it.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = (f) => path.join(root, 'data', f);
if (!fs.existsSync(src('products.json')) || !fs.existsSync(src('source.json'))) {
  console.log('No imported catalog found in data/. Run an import first (see README).');
  process.exit(1);
}
fs.mkdirSync(path.join(root, 'seed'), { recursive: true });
const products = JSON.parse(fs.readFileSync(src('products.json'), 'utf8')).map((p) => ({ ...p, updatedAt: undefined }));
fs.writeFileSync(path.join(root, 'seed', 'products.json'), JSON.stringify(products));
fs.copyFileSync(src('categories.json'), path.join(root, 'seed', 'categories.json'));
console.log(`seed/ updated: ${products.length} products. Commit and push to deploy.`);
