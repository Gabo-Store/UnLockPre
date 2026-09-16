// Extract only the stock BL component of an official Samsung firmware ZIP.
// Does not connect to or modify a phone. Requires Node 24 and npm ci --ignore-scripts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const decompressLz4 = require('./decompress-stock-lz4.cjs');
const { FUS } = require('./samsung-fus.cjs');
const hash = (buffer, algorithm = 'sha256') => crypto.createHash(algorithm).update(buffer).digest('hex');
const safe = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid ZIP64 number'); return n; };
async function acquire(model, region, version, options = {}) {
  const log = options.quiet ? () => {} : console.log;
  const client = new FUS();
  const meta = await client.metadata(model, region, version);
  log('Samsung firmware: ' + JSON.stringify(meta));
  const range = (start, length) => client.range(start, start + length - 1);
  const tail = await range(meta.bytes - 65536, 65536);
  let end = -1;
  for (let p = tail.length - 22; p >= 0; p--) if (tail.readUInt32LE(p) === 0x06054b50) { end = p; break; }
  if (end < 0) throw new Error('ZIP directory absent');
  let centralSize = tail.readUInt32LE(end + 12), centralOffset = tail.readUInt32LE(end + 16);
  if (centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    if (end < 20 || tail.readUInt32LE(end - 20) !== 0x07064b50) throw new Error('ZIP64 locator missing');
    const record = await range(safe(tail.readBigUInt64LE(end - 12)), 56);
    if (record.readUInt32LE(0) !== 0x06064b50) throw new Error('Invalid ZIP64 record');
    centralSize = safe(record.readBigUInt64LE(40)); centralOffset = safe(record.readBigUInt64LE(48));
  }
  if (centralSize > 1024 * 1024) throw new Error('Directory limit');
  const central = await range(centralOffset, centralSize), entries = [];
  for (let p = 0; p < central.length;) {
    if (central.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const n = central.readUInt16LE(p + 28), x = central.readUInt16LE(p + 30), c = central.readUInt16LE(p + 32);
    const e = { name: central.toString('utf8', p + 46, p + 46 + n), method: central.readUInt16LE(p + 10), crc32: central.readUInt32LE(p + 16), compressed: central.readUInt32LE(p + 20), size: central.readUInt32LE(p + 24), offset: central.readUInt32LE(p + 42) };
    const extra = central.subarray(p + 46 + n, p + 46 + n + x);
    for (let q = 0; q + 4 <= extra.length;) {
      const type = extra.readUInt16LE(q), length = extra.readUInt16LE(q + 2); q += 4;
      if (type === 1) { let k = q; for (const field of ['size','compressed','offset']) if (e[field] === 0xffffffff) { e[field] = safe(extra.readBigUInt64LE(k)); k += 8; } }
      q += length;
    }
    entries.push(e); p += 46 + n + x + c;
  }
  log('ZIP entries: ' + JSON.stringify(entries));
  const bl = entries.find(e => /^BL_.*\.tar\.md5$/.test(e.name));
  if (!bl || bl.compressed > 24 * 1024 * 1024 || bl.size > 32 * 1024 * 1024) throw new Error('No small stock BL component');
  const local = await range(bl.offset, 30);
  if (local.readUInt32LE(0) !== 0x04034b50) throw new Error('Invalid BL local header');
  const packed = await range(bl.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28), bl.compressed);
  const tar = bl.method === 0 ? packed : bl.method === 8 ? zlib.inflateRawSync(packed, { maxOutputLength: 32 * 1024 * 1024 }) : null;
  if (!tar || tar.length !== bl.size || zlib.crc32(tar) !== bl.crc32) throw new Error('BL ZIP CRC32 mismatch');
  const trailerStart = Math.floor(tar.length / 512) * 512;
  const md5Trailer = tar.subarray(trailerStart).toString('ascii').match(/^([a-f0-9]{32})\s/);
  if (!md5Trailer || hash(tar.subarray(0, trailerStart), 'md5') !== md5Trailer[1]) throw new Error('BL TAR MD5 mismatch');
  const images = [];
  for (let p = 0; p + 512 <= tar.length;) {
    const header = tar.subarray(p, p + 512);
    if (header.every(b => b === 0)) break;
    const name = header.toString('utf8', 0, 100).split('\0')[0];
    const size = parseInt(header.toString('ascii', 124, 136).replace(/\0/g, '').trim(), 8);
    const expected = parseInt(header.toString('ascii', 148, 156).replace(/\0/g, '').trim(), 8);
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (!Number.isSafeInteger(size) || size < 0 || p + 512 + size > tar.length || checksum !== expected) throw new Error('Invalid TAR entry');
    if (/preloader/i.test(name)) images.push({ name, bytes: tar.subarray(p + 512, p + 512 + size) });
    p += 512 + Math.ceil(size / 512) * 512;
  }
  if (images.length !== 1) {
    const error = new Error(images.length ? 'Multiple preloader images require manual review' : 'No preloader entry in the verified BL component');
    error.code = images.length ? 'REVIEW_REQUIRED' : 'NO_PRELOADER_IN_BL';
    error.evidence = { firmware: meta.version, component: bl.name, sha256: hash(tar), tarMd5: md5Trailer[1] };
    throw error;
  }
  const stock = images[0]; let image = stock.bytes;
  if (stock.name.endsWith('.lz4')) {
    fs.mkdirSync('.artifacts', { recursive: true });
    fs.writeFileSync(path.join('.artifacts', model + '-preloader.lz4'), stock.bytes);
    image = decompressLz4(stock.bytes);
  }
  if (!image.length || image.length > 32 * 1024 * 1024) throw new Error('Unexpected preloader size');
  const firmware = meta.version.split('/')[0];
  if (options.dedupe) {
    const existing = require('./preloader-library.cjs').duplicateOf(hash(image));
    if (existing) return { duplicate: true, existing, sha256: hash(image), firmware, model, region };
  }
  const filename = `preloader_${model}_${firmware}_${region}.bin`;
  const source = 'https://cloud-neofussvr.samsungmobile.com/NF_SmartDownloadBinaryForMass.do?file=' + meta.path + meta.filename;
  const android = entries.find(e => e.name.startsWith('AP_'))?.name.match(/_OS(\d+)\.tar/)?.[1] || 'No documentado';
  const provenance = { ...meta, file: filename, firmware, android, source, bytes: image.length, packageBytes: meta.bytes, sha256: hash(image),
    component: { name: bl.name, sha256: hash(tar), tarMd5: md5Trailer[1], crc32: bl.crc32.toString(16).padStart(8,'0'), entry: stock.name, compressedImageSha256: hash(stock.bytes) },
    method: 'Stock BL component from Samsung HTTPS FUS, ENC4 decrypted without firmware modifications. ZIP CRC32, TAR MD5/headers, LZ4 size/header/content checksums verified; preloader decompressed without changes.',
    limits: 'Full firmware signature not independently verified. SHA-256 is calculated locally, not compared to a manufacturer-published preloader digest. Loading in TSM and on a phone not tested. Match exact model, region, firmware and bootloader revision.' };
  fs.mkdirSync('downloads', { recursive: true });
  const dest = path.resolve('downloads', filename);
  if (fs.existsSync(dest) && hash(fs.readFileSync(dest)) !== hash(image)) throw new Error('Existing file differs');
  fs.writeFileSync(dest, image);
  fs.writeFileSync(dest.replace(/\.bin$/, '.json'), JSON.stringify(provenance, null, 2) + '\n');
  log(JSON.stringify({ file: filename, bytes: image.length, sha256: hash(image), header: image.subarray(0,16).toString('hex') }, null, 2));
  return provenance;
}
if (require.main === module) acquire(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { acquire };
