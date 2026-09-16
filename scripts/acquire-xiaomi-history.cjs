// Discover full-OTA URLs from an index; acquire/validate bytes only from OEM HTTPS CDNs.
// Uses already-reviewed model/platform mappings, never derives compatibility from filenames alone.
const fs = require('node:fs');
const { acquire } = require('./acquire-xiaomi.cjs');
const auditPath = 'research/xiaomi-history-acquisition.json';
const candidatesPath = 'research/xiaomi-history-sources.json';
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : {
  scope: 'Full OTA history for previously reviewed Xiaomi platforms. Regions derive from firmware codes; identical SHA-256 files are not counted again. Historical versions are not claimed to be latest.', records: []
};
const save = () => fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
const target = Number(process.argv[2] || 110);
if (!Number.isInteger(target) || target < 110 || target > 500) throw new Error('Library target must be 110..500');
const regions = { MI:'Global (MI)', EU:'Europa (EU)', IN:'India (IN)', TW:'Taiwán (TW)', RU:'Rusia (RU)', ID:'Indonesia (ID)', TR:'Turquía (TR)' };
async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Index HTTP ' + response.status);
  const text = await response.text(); if (text.length > 4000000) throw new Error('Index size cap'); return text;
}
async function discover() {
  const seeds = JSON.parse(fs.readFileSync('research/ota-sources.json', 'utf8'));
  const queues = [];
  for (const codename of ['gale','fire','gold','light','ice','earth']) {
    const seed = seeds.find(c => c.codename === codename && !c.brand);
    const index = 'https://mirom.ezbox.idv.tw/en/phone/' + codename + '/';
    const html = await getText(index);
    const histories = [...new Set([...html.matchAll(/href=["']([^"']*roms-[^"']+)["']/g)].map(m => m[1]))];
    for (const history of histories) {
      if (!/^\/en\/phone\/[a-z]+\/roms-[a-z]+-stable\/$/.test(history)) continue;
      if (['ice','earth'].includes(codename) && !history.includes('roms-in-stable')) continue;
      const discoverySource = new URL(history, index).href;
      const page = await getText(discoverySource);
      const urls = [...new Set([...page.matchAll(/href=["'](https:\/\/bigota\.d\.miui\.com\/[^"']+\.zip)["']/g)].map(m => m[1]))].filter(url => !/incremental|blockota/.test(url));
      const queue = [];
      for (const source of urls.slice(0,25)) {
        const firmware = new URL(source).pathname.split('/')[1];
        if (!/^(OS|V)[0-9.]+\.[A-Z]{7}$/.test(firmware)) continue;
        const regionCode = firmware.match(/([A-Z]{2})XM$/)?.[1]; if (!regions[regionCode]) continue;
        queue.push({ id: 'history-' + codename + '-' + firmware.toLowerCase().replace(/\./g,'-'), codename, models: seed.models,
          partition: seed.partition || 'preloader', variantCode: codename + '-' + regionCode,
          variantLabel: (codename === 'light' ? 'POCO M4 5G · ' : '') + codename + ' · ' + regions[regionCode],
          firmware, expectedBuild: firmware.startsWith('OS1.') ? firmware.replace(/^OS1\./,'V816.') : firmware,
          region: regions[regionCode], source, deviceSource: seed.deviceSource, discoverySource });
      }
      queues.push(queue);
    }
    console.log('Discovered ' + codename);
  }
  const candidates = [];
  for (let round = 0; round < 25; round++) for (const queue of queues) if (queue[round]) candidates.push(queue[round]);
  fs.writeFileSync(candidatesPath, JSON.stringify(candidates, null, 2) + '\n');
  return candidates;
}
async function main() {
  const candidates = fs.existsSync(candidatesPath) ? JSON.parse(fs.readFileSync(candidatesPath, 'utf8')) : await discover();
  console.log(candidates.length + ' full OTA candidates');
  for (const config of candidates) {
    if (audit.records.some(r => r.id === config.id)) continue;
    const count = fs.readdirSync('downloads').filter(n => n.endsWith('.bin')).length;
    if (count >= target) { console.log('Library target reached; remaining candidates retained.'); break; }
    const record = { id: config.id, source: config.source, checkedAt: new Date().toISOString() };
    try {
      const result = await acquire(config, { quiet: true, dedupe: true });
      record.status = result.duplicate ? 'duplicate-not-counted' : 'download-available';
      record.file = result.file || result.existing; record.sha256 = result.sha256;
    } catch (error) { record.status = 'not-acquired'; record.reason = error.message.slice(0,1000); }
    audit.records.push(record); save();
    console.log(audit.records.length + '/' + candidates.length + ' ' + config.id + ': ' + record.status);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
