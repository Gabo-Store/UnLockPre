// Prints an apply_patch patch after validating extracted files; does not edit HTML.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const html = fs.readFileSync('index.html','utf8');
const match = html.match(/    const fileCatalog = (\[[\s\S]*?\n    \]);/);
if (!match) throw new Error('Catalog marker not found');
const catalog = JSON.parse(match[1]);
const originalCount = catalog.length;
const limit = Number(process.argv[2] || 25);
if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Batch size must be 1..50');
const models = vm.runInNewContext('(' + html.match(/const detailedModels = (\{[\s\S]*?\n    \});/)[1] + ')');
const samsung = JSON.parse(fs.readFileSync('research/samsung-preloader-coverage.json','utf8')).records;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
for (const name of fs.readdirSync('downloads').filter(name => name.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync('downloads/' + name, 'utf8'));
  if (!d.file || !/^[a-zA-Z0-9_.-]+\.bin$/.test(d.file)) continue;
  const image = fs.readFileSync('downloads/' + d.file);
  if (image.length !== d.bytes || digest(image) !== d.sha256) throw new Error('Integrity mismatch: ' + name);
  if (catalog.some(file => file.href === 'downloads/' + d.file)) continue;
  if (catalog.some(file => file.sha256 === d.sha256)) throw new Error('Duplicate binary hash: ' + name);
  if (catalog.length - originalCount >= limit) break;
  const isSamsung = !!d.model;
  const brand = isSamsung ? 'Samsung' : d.brand || 'Xiaomi';
  const names = d.models || [samsung.find(r => r.code === d.model)?.model];
  if (!names.length || names.some(n => !n || !models[brand]?.some(label => label.split('·')[0].trim() === n))) throw new Error('Unmapped model: ' + name);
  const region = d.region;
  const code = d.variantCode || (isSamsung ? d.model : d.codename + '-' + (region.match(/\(([^)]+)\)/)?.[1] || region));
  const manifestVerified = !!d.plan?.partition && d.plan.partition.sha256 === d.sha256;
  if (!isSamsung && !manifestVerified && !d.component?.crc32) throw new Error('No documented integrity method: ' + name);
  const firmware = d.firmware;
  const deviceSource = d.deviceSource || 'https://www.samsung.com/support/';
  catalog.push({ id: isSamsung ? 'samsung-' + d.model + '-' + region + '-' + firmware : d.id,
    brand, models: names, variant: code, variantLabel: d.variantLabel || (isSamsung ? d.model : d.codename + ' · ' + region),
    firmware, build: d.metadata?.['post-build-incremental'] || firmware, region,
    android: d.android || d.metadata?.['android_version'] || d.metadata?.['post-build']?.match(/:([^/]+)\//)?.[1] || 'No documentado',
    patch: d.metadata?.['post-security-patch-level'] || 'No extraído del paquete', binary: isSamsung ? firmware.slice(-5,-4) : 'No documentado',
    filename: d.file, href: 'downloads/' + d.file, bytes: d.bytes, sha256: d.sha256, source: d.source, deviceSource,
    provenance: 'downloads/' + name,
    hashBasis: manifestVerified ? 'SHA-256 del bloque comprimido y de la partición coincide con el manifiesto de la OTA.' : isSamsung ? 'SHA-256 calculado localmente. CRC32 del ZIP, MD5 del componente BL y checksums LZ4 comprobados.' : 'SHA-256 calculado localmente. Tamaño y CRC32 de la imagen original comprobados contra el ZIP de origen.',
    sourceLabel: isSamsung ? 'Ficha Samsung ↗' : d.stockZip ? 'Firmware completo (varios GB) ↗' : 'OTA completa (varios GB) ↗', verified: true,
    note: 'Imagen original ' + (d.zipEntry || d.partition || d.component?.entry || 'preloader') + ' extraída sin recortar ni modificar del firmware de ' + brand + '. Carga en TSM no probada.'
  });
}
if (catalog.length === originalCount) { console.error('No unpublished files'); process.exit(2); }
// Patch only the final existing object plus new entries, avoiding an ever-growing replacement.
const tailStart = match[0].lastIndexOf('\n      {');
if (tailStart < 0) throw new Error('Catalog tail not found');
const before = match[0].slice(tailStart + 1);
const suffix = JSON.stringify(catalog.slice(originalCount - 1),null,2).split('\n').slice(1,-1).map(line => '    ' + line).join('\n') + '\n    ];';
console.log('*** Begin Patch\n*** Update File: index.html\n@@\n' + before.split(/\r?\n/).map(l=>'-'+l).join('\n') + '\n' + suffix.split('\n').map(l=>'+'+l).join('\n') + '\n*** End Patch');
