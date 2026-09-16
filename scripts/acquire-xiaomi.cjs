// Selective, bounded download from allowlisted manufacturer HTTPS OTA CDNs. No device writes.
// Requires Node 22+ and 7-Zip. Only complete REPLACE/REPLACE_XZ partitions are accepted.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { inspect } = require('./inspect-payload.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const MAX = 8 * 1024 * 1024;
const safeNumber = n => { const v = Number(n); if (!Number.isSafeInteger(v) || v < 0) throw new Error('Unsafe ZIP offset'); return v; };
async function acquire(config, options = {}) {
  const log = options.quiet ? () => {} : console.log;
  const url = new URL(config.source);
  const hosts = ['Oneplus','Realme','Oppo'].includes(config.brand) ? ['gauss-componentotacostmanual-eu.allawnofs.com','gauss-componentotamanual.allawnofs.com'] : ['bigota.d.miui.com', 'hugeota.d.miui.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname)) throw new Error('Manufacturer HTTPS host required');
  if (typeof config.id !== 'string' || !/^[a-z0-9-]+$/.test(config.id)) throw new Error('Invalid acquisition ID');
  let transferred = 0;
  const range = async (start, length) => {
    if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(length) || length < 1 || length > MAX || transferred + length > 24 * 1024 * 1024) throw new Error('Download cap exceeded');
    const response = await fetch(url, { redirect: 'error', headers: { Range: `bytes=${start}-${start + length - 1}` }, signal: AbortSignal.timeout(45000) });
    if (response.status !== 206 || !response.headers.get('content-range')?.startsWith(`bytes ${start}-${start + length - 1}/`)) { await response.body?.cancel(); throw new Error('Exact HTTP byte range required: ' + response.status); }
    const buffers = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > length) throw new Error('Response too large'); buffers.push(Buffer.from(chunk)); }
    if (size !== length) throw new Error('Incomplete response');
    transferred += size;
    return Buffer.concat(buffers);
  };
  const headResponse = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!headResponse.ok) throw new Error('OTA unavailable: ' + headResponse.status);
  const total = Number(headResponse.headers.get('content-length'));
  if (!Number.isSafeInteger(total) || total < 65557) throw new Error('Invalid OTA size');
  log(config.id + ': reading ZIP directory, OTA ' + total + ' bytes');
  const tailStart = total - 65557, tail = await range(tailStart, 65557);
  let end = -1;
  for (let p = tail.length - 22; p >= 0; p--) if (tail.readUInt32LE(p) === 0x06054b50 && p + 22 + tail.readUInt16LE(p + 20) === tail.length) { end = p; break; }
  if (end < 0) throw new Error('ZIP directory not found');
  let cdSize = tail.readUInt32LE(end + 12), cdOffset = tail.readUInt32LE(end + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    if (end < 20 || tail.readUInt32LE(end - 20) !== 0x07064b50) throw new Error('ZIP64 locator absent');
    const zip64 = await range(safeNumber(tail.readBigUInt64LE(end - 12)), 56);
    if (zip64.readUInt32LE(0) !== 0x06064b50) throw new Error('ZIP64 header invalid');
    cdSize = safeNumber(zip64.readBigUInt64LE(40)); cdOffset = safeNumber(zip64.readBigUInt64LE(48));
  }
  const central = cdOffset >= tailStart && cdOffset + cdSize <= total ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize) : await range(cdOffset, cdSize);
  const entries = [];
  for (let p = 0; p < central.length;) {
    if (central.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid central directory');
    const nameLen = central.readUInt16LE(p + 28), extraLen = central.readUInt16LE(p + 30), commentLen = central.readUInt16LE(p + 32);
    const entry = { name: central.toString('utf8', p + 46, p + 46 + nameLen), method: central.readUInt16LE(p + 10), crc32: central.readUInt32LE(p + 16), size: central.readUInt32LE(p + 24), compressed: central.readUInt32LE(p + 20), offset: central.readUInt32LE(p + 42) };
    const extra = central.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
    for (let q = 0; q + 4 <= extra.length;) {
      const type = extra.readUInt16LE(q), len = extra.readUInt16LE(q + 2); q += 4;
      if (type === 1) { let pos = q; for (const key of ['size','compressed','offset']) if (entry[key] === 0xffffffff) { entry[key] = safeNumber(extra.readBigUInt64LE(pos)); pos += 8; } }
      q += len;
    }
    entries.push(entry); p += 46 + nameLen + extraLen + commentLen;
  }
  async function entryStart(entry) {
    const local = await range(entry.offset, 30);
    if (local.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid local ZIP header');
    return entry.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  }
  async function readEntry(entry) {
    if (!entry || entry.size > MAX) throw new Error('Missing or oversized ZIP entry');
    const bytes = await range(await entryStart(entry), entry.compressed);
    const image = entry.method === 0 ? bytes : entry.method === 8 ? zlib.inflateRawSync(bytes, { maxOutputLength: MAX }) : null;
    if (!image || image.length !== entry.size || zlib.crc32(image) !== entry.crc32) throw new Error('ZIP entry size/CRC32 mismatch');
    return image;
  }
  const metadataEntry = entries.find(e => e.name === 'META-INF/com/android/metadata');
  if (!metadataEntry && config.inspectOnly) {
    const texts = {};
    for (const name of ['build.prop','version_info.txt','all_files_hash_checksum.txt']) {
      const entry = entries.find(e => e.name === name);
      if (entry) texts[name] = (await readEntry(entry)).toString('utf8');
    }
    const result = { metadata: null, texts, entries: entries.filter(e => /preloader|\.ofp$|build.prop$|version_info/.test(e.name)), source: config.source };
    log(JSON.stringify(result, null, 2)); return result;
  }
  const parseProperties = text => Object.fromEntries(text.split(/\r?\n/).filter(line => !line.startsWith('#') && line.indexOf('=') > 0).map(line => { const n = line.indexOf('='); return [line.slice(0, n), line.slice(n + 1)]; }));
  let metadata;
  if (config.stockZip) {
    if (!config.zipEntry || !config.stockModel) throw new Error('Explicit stock entry and model required');
    const properties = parseProperties((await readEntry(entries.find(e => e.name === 'build.prop'))).toString('utf8'));
    if (properties['ro.product.model'] !== config.stockModel || properties['ro.build.display.ota'] !== config.firmware) throw new Error('Stock model/firmware mismatch');
    metadata = {
      'pre-device': properties['ro.product.device'],
      'post-build-incremental': properties['ro.build.version.incremental'],
      'post-build': properties['ro.build.fingerprint'],
      'post-security-patch-level': properties['ro.build.version.security_patch'],
      android_version: properties['ro.build.version.release'],
      stock_model: properties['ro.product.model'],
      stock_version: properties['ro.mediatek.version.release'],
      version_name: properties['ro.build.display.id'],
      ota_version: properties['ro.build.display.ota'],
      metadataSource: 'build.prop (ZIP CRC32 verified)'
    };
  } else {
    if (!metadataEntry) throw new Error('Missing OTA metadata');
    metadata = parseProperties((await readEntry(metadataEntry)).toString('utf8'));
  }
  if (config.inspectOnly) {
    const result = { metadata, entries: entries.filter(e => /preloader|payload\.bin/.test(e.name)), source: config.source };
    log(JSON.stringify(result, null, 2)); return result;
  }
  if (!(metadata['pre-device'] || '').split('|').includes(config.codename) || metadata['post-build-incremental'] !== (config.expectedBuild || config.firmware)) throw new Error('Firmware/device mismatch: ' + JSON.stringify(metadata));
  if (config.zipEntry) {
    const entry = entries.find(e => e.name === config.zipEntry);
    if (!entry || entry.size > MAX) throw new Error('Stock preloader entry unavailable');
    const compressed = await range(await entryStart(entry), entry.compressed);
    const image = entry.method === 0 ? compressed : entry.method === 8 ? zlib.inflateRawSync(compressed, { maxOutputLength: MAX }) : null;
    if (!image || image.length !== entry.size || zlib.crc32(image) !== entry.crc32) throw new Error('Stock ZIP entry CRC32 mismatch');
    if (options.dedupe) {
      const existing = require('./preloader-library.cjs').duplicateOf(sha(image));
      if (existing) return { duplicate: true, existing, sha256: sha(image), firmware: config.firmware };
    }
    const filename = 'preloader_' + config.codename + '_' + config.firmware.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.bin';
    const provenance = { ...config, file: filename, bytes: image.length, sha256: sha(image), checkedAt: new Date().toISOString(), metadata, sourceBytes: total, downloadedBytes: transferred,
      component: { entry: entry.name, crc32: entry.crc32.toString(16).padStart(8,'0') },
      method: 'Unmodified stock image extracted from manufacturer-hosted firmware ZIP. Device/build checked against package metadata; image size and CRC32 verified.',
      limits: 'Full package signature not independently verified. Final SHA-256 is calculated locally, not compared with a manufacturer-published digest. Not tested in TSM or on hardware. Match model, storage layout, firmware and region.' };
    const destination = path.resolve('downloads', filename);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination) && sha(fs.readFileSync(destination)) !== sha(image)) throw new Error('Existing file differs');
    fs.writeFileSync(destination, image);
    fs.writeFileSync(path.resolve('downloads', config.id + '.json'), JSON.stringify(provenance, null, 2) + '\n');
    log(JSON.stringify({ file: filename, bytes: image.length, sha256: sha(image), metadata }, null, 2));
    return provenance;
  }
  const payload = entries.find(e => e.name === 'payload.bin');
  if (!payload || payload.method !== 0) throw new Error('Stored payload.bin required. Relevant ZIP entries: ' + JSON.stringify(entries.filter(e => /preloader|firmware/i.test(e.name))));
  const payloadStart = await entryStart(payload);
  const prefix = await range(payloadStart, 24);
  if (prefix.toString('ascii', 0, 4) !== 'CrAU') throw new Error('Invalid Android payload');
  const manifestSize = safeNumber(prefix.readBigUInt64BE(12));
  const localLength = payloadStart - payload.offset;
  const localAndManifest = await range(payload.offset, localLength + 24 + manifestSize);
  const plan = inspect(localAndManifest, 0, payload.offset);
  const partition = plan.preloaders.find(p => p.name === (config.partition || 'preloader'));
  if (!partition || partition.size > MAX || partition.operations.length < 1) throw new Error('No supported preloader partition: ' + JSON.stringify({ names: plan.names, preloaders: plan.preloaders }));
  const image = Buffer.alloc(partition.size), coverage = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'original-preloader-'));
  try {
    for (const [i, op] of partition.operations.entries()) {
      if (![0,8].includes(op.type) || !op.sha256 || !op.extents.length) throw new Error('Only hash-verified complete REPLACE operations supported');
      const compressed = await range(op.start, op.length);
      if (sha(compressed) !== op.sha256) throw new Error('Compressed SHA-256 mismatch');
      let block = compressed;
      if (op.type === 8) {
        const temp = path.join(tempDir, 'block-' + i + '.xz'); fs.writeFileSync(temp, compressed);
        block = execFileSync('C:\\Program Files\\7-Zip\\7z.exe', ['e','-so',temp], { windowsHide: true, maxBuffer: MAX });
      }
      let used = 0;
      for (const extent of op.extents) {
        if (extent.start < 0 || extent.start + extent.length > image.length || used + extent.length > block.length) throw new Error('Invalid partition extent');
        block.copy(image, extent.start, used, used + extent.length); used += extent.length;
        coverage.push([extent.start, extent.start + extent.length]);
      }
      if (used !== block.length) throw new Error('Unused operation bytes');
    }
  } finally {
    // Only this freshly-created script-owned temporary directory is removed.
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  let cursor = 0;
  for (const [start,end] of coverage.sort((a,b) => a[0]-b[0])) { if (start !== cursor) throw new Error('Gap or overlapping extents'); cursor = end; }
  if (cursor !== image.length || sha(image) !== partition.sha256) throw new Error('Final partition SHA-256 mismatch');
  if (options.dedupe) {
    const existing = require('./preloader-library.cjs').duplicateOf(sha(image));
    if (existing) return { duplicate: true, existing, sha256: sha(image), firmware: config.firmware };
  }
  const filename = 'preloader_' + config.codename + '_' + config.firmware.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.bin';
  const destination = path.resolve('downloads', filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination) && sha(fs.readFileSync(destination)) !== sha(image)) throw new Error('Existing file differs');
  const provenance = { ...config, file: filename, bytes: image.length, sha256: sha(image), checkedAt: new Date().toISOString(), metadata, sourceBytes: total, downloadedBytes: transferred,
    method: 'Unmodified preloader partition extracted from manufacturer-hosted full OTA. Every compressed operation and final partition SHA-256 matches its payload manifest.',
    limits: 'Full OTA signature not independently validated. Not tested with TSM or on hardware. Match device, region, firmware and security revision before use.',
    plan: { payloadStart: plan.payloadStart, dataStart: plan.dataStart, partition } };
  fs.writeFileSync(destination, image);
  fs.writeFileSync(path.resolve('downloads', config.id + '.json'), JSON.stringify(provenance, null, 2) + '\n');
  log(JSON.stringify({file: filename, sha256: sha(image), bytes: image.length, metadata, downloadedBytes: transferred}, null, 2));
  return provenance;
}
if (require.main === module) {
  const configs = JSON.parse(fs.readFileSync('research/ota-sources.json', 'utf8'));
  const config = configs.find(c => c.id === process.argv[2]);
  if (!config) { console.error('Usage: node scripts/acquire-xiaomi.cjs <id from research/ota-sources.json>'); process.exitCode = 1; }
  else acquire({ ...config, inspectOnly: process.argv.includes('--inspect') }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { acquire };
