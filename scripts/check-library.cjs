const fs = require('node:fs');
const assert = require('node:assert/strict');
const { inventory } = require('./library-index.cjs');
const current = inventory();
assert.ok(current.uniqueFiles > 100, 'More than 100 distinct downloadable binaries required');
assert.deepEqual(JSON.parse(fs.readFileSync('downloads/catalog.json', 'utf8')), current, 'Downloadable inventory must match page');
console.log('PASS ' + current.uniqueFiles + ' distinct preloaders, exact local bytes/SHA-256, manufacturer origins, model mappings and downloadable inventory');
