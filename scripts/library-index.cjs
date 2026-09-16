// Validate every published binary and generate a small downloadable inventory.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
function inventory() {
  const html = fs.readFileSync('index.html', 'utf8');
  const files = JSON.parse(html.match(/const fileCatalog = (\[[\s\S]*?\n    \]);/)[1]);
  const models = vm.runInNewContext('(' + html.match(/const detailedModels = (\{[\s\S]*?\n    \});/)[1] + ')');
  const hashes = new Set(), ids = new Set(), modelKeys = new Set(), variantKeys = new Set();
  const byBrand = {};
  for (const file of files) {
    assert.ok(file.verified && !hashes.has(file.sha256) && !ids.has(file.id), 'Unique verified files required');
    assert.match(file.href, /^downloads\/[a-zA-Z0-9_.-]+\.bin$/);
    assert.match(file.provenance, /^downloads\/[a-zA-Z0-9_.-]+\.json$/);
    const bytes = fs.readFileSync(file.href);
    assert.equal(bytes.length, file.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
    const record = JSON.parse(fs.readFileSync(file.provenance, 'utf8'));
    for (const key of ['sha256','bytes','firmware','source']) assert.equal(file[key], record[key], file.filename + ': ' + key);
    const regionName = value => value.replace(/ \([A-Z]{2,3}\)$/, '');
    assert.equal(regionName(file.region), regionName(record.region), 'Documented region (optional display code)');
    assert.equal(file.filename, record.file);
    const host = new URL(file.source).hostname;
    const allowedHosts = file.brand === 'Samsung' ? ['cloud-neofussvr.samsungmobile.com'] : file.brand === 'Xiaomi' ? ['bigota.d.miui.com','hugeota.d.miui.com'] : ['gauss-componentotacostmanual-eu.allawnofs.com','gauss-componentotamanual.allawnofs.com'];
    assert.ok(file.source.startsWith('https://') && allowedHosts.includes(host), 'Manufacturer HTTPS origin');
    for (const name of file.models) {
      assert.ok(models[file.brand]?.some(label => label.split('·')[0].trim() === name), 'Model must exist in catalog');
      modelKeys.add(file.brand + ':' + name);
    }
    variantKeys.add(file.brand + ':' + file.variant);
    hashes.add(file.sha256); ids.add(file.id);
    byBrand[file.brand] = (byBrand[file.brand] || 0) + 1;
  }
  return {
    schemaVersion: 1,
    scope: 'Distinct unmodified stock preloader binaries, including historical firmware and regions. File count is NOT a device/model count. Full package signatures and TSM/hardware compatibility have not been independently verified.',
    uniqueFiles: hashes.size, modelReferences: modelKeys.size, variantRegionReferences: variantKeys.size,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), byBrand,
    files: files.map(({id,brand,models,variant,variantLabel,firmware,build,region,android,filename,href,bytes,sha256,provenance,source}) => ({id,brand,models,variant,variantLabel,firmware,build,region,android,filename,href,bytes,sha256,provenance,source}))
  };
}
if (require.main === module) {
  const result = inventory();
  fs.writeFileSync('downloads/catalog.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, files: undefined }, null, 2));
}
module.exports = { inventory };
