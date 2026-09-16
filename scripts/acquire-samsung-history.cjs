// Bounded historical firmware acquisition for variants already verified to contain a preloader.
const fs = require('node:fs');
const { FUS } = require('./samsung-fus.cjs');
const { acquire } = require('./acquire-samsung.cjs');
const output = 'research/samsung-history-acquisition.json';
const audit = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {
  scope: 'Up to 25 stable historical firmwares per previously verified Samsung variant/region. Identical SHA-256 files are not saved or counted again.', records: []
};
const save = () => fs.writeFileSync(output, JSON.stringify(audit, null, 2) + '\n');
const target = Number(process.argv[2] || 110);
if (!Number.isInteger(target) || target < 110 || target > 500) throw new Error('Library target must be 110..500');
async function main() {
  const seeds = [];
  for (const name of fs.readdirSync('downloads').filter(n => n.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync('downloads/' + name, 'utf8'));
    if (d.model && !seeds.some(s => s.model === d.model && s.region === d.region)) seeds.push(d);
  }
  const queues = [];
  for (const seed of seeds) {
    const history = await new FUS().history(seed.model, seed.region);
    const versions = [...new Map(history.filter(v => v.index !== '90' && v.date && v.version).sort((a,b) => b.date.localeCompare(a.date)).map(v => [v.version.split('/')[0],v])).values()].slice(0,25);
    queues.push(versions.map(v => ({ model: seed.model, region: seed.region, version: v.version, releaseDate: v.date })));
    console.log(seed.model + ' ' + seed.region + ': ' + versions.length + ' historical candidates');
  }
  // Round-robin across devices; one request workflow at a time to limit CDN load.
  for (let round = 0; round < 25; round++) for (const queue of queues) {
    const candidate = queue[round]; if (!candidate) continue;
    if (fs.readdirSync('downloads').filter(n => n.endsWith('.bin')).length >= target) { console.log('Library target reached; remaining candidates retained.'); return; }
    const key = candidate.model + ':' + candidate.region + ':' + candidate.version;
    if (audit.records.some(r => r.key === key)) continue;
    const record = { ...candidate, key, checkedAt: new Date().toISOString() };
    try {
      const result = await acquire(candidate.model, candidate.region, candidate.version, { quiet: true, dedupe: true });
      record.status = result.duplicate ? 'duplicate-not-counted' : 'download-available';
      record.file = result.file || result.existing; record.sha256 = result.sha256;
      record.returnedFirmware = result.firmware;
    } catch (error) { record.status = 'not-acquired'; record.reason = error.message.slice(0,500); }
    audit.records.push(record); save();
    console.log(audit.records.length + ' ' + candidate.model + ' ' + candidate.version.split('/')[0] + ': ' + record.status);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
