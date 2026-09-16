const fs=require('node:fs');
const assert=require('node:assert/strict');
const {discover}=require('./library-index.cjs');
const current=discover();
const saved=JSON.parse(fs.readFileSync('downloads/catalog.json','utf8'));
assert.ok(current.uniqueFiles>100,'More than 100 distinct downloadable binaries required');
assert.deepEqual(saved,current,'downloads/catalog.json must match the validated local binaries and provenance files');
console.log(`PASS ${current.uniqueFiles} files; catalog matches local bytes/SHA-256/provenance`);
