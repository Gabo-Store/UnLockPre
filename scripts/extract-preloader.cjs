// Extract the unmodified preloader partition from a manufacturer-hosted full OTA.
// Local inputs are byte ranges of the URL documented in downloads/provenance.json.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { inspect } = require('./inspect-payload.cjs');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const plan = inspect();
const partition = plan.preloaders.find(p => p.name === 'preloader');
if (!partition || partition.operations.length !== 1) throw new Error('Unexpected operation plan');
const op = partition.operations[0];
if (op.type !== 8 || op.extents.length !== 1 || op.extents[0].start !== 0 || op.extents[0].length !== partition.size) throw new Error('Unsupported extent layout');
const compressed = fs.readFileSync('preloader-gale.tmp.xz');
if (compressed.length !== op.length || sha256(compressed) !== op.sha256) throw new Error('Compressed block SHA-256 mismatch');
const image = execFileSync('C:\\Program Files\\7-Zip\\7z.exe', ['e', '-so', 'preloader-gale.tmp.xz'], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
if (image.length !== partition.size || sha256(image) !== partition.sha256) throw new Error('Partition SHA-256 mismatch');
const dir = path.resolve('downloads');
fs.mkdirSync(dir, { recursive: true });
const filename = 'preloader_gale_V14.0.5.0.TGPINXM_IN.bin';
const destination = path.join(dir, filename);
if (fs.existsSync(destination) && sha256(fs.readFileSync(destination)) !== partition.sha256) throw new Error('Refusing to overwrite a different file');
fs.writeFileSync(destination, image);
const provenance = {
  file: filename, bytes: image.length, sha256: partition.sha256,
  source: 'https://bigota.d.miui.com/V14.0.5.0.TGPINXM/miui_GALEINGlobal_V14.0.5.0.TGPINXM_13d4997127_13.0.zip',
  firmware: 'V14.0.5.0.TGPINXM', codename: 'gale', region: 'India', android: '13',
  checkedAt: '2026-09-15', method: 'Extracted unmodified from full OTA payload; compressed block and final partition SHA-256 match the manufacturer-hosted manifest.',
  limits: 'Full OTA signature was not independently validated. This historical build was not tested in TSM or on a physical device. Do not infer compatibility with other builds, regions or security revisions.',
  plan: { payloadStart: plan.payloadStart, manifestSize: plan.manifestSize, dataStart: plan.dataStart, partition }
};
fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ file: destination, bytes: image.length, sha256: sha256(image), header: image.subarray(0, 16).toString('hex') }, null, 2));
