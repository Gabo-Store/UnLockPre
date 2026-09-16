// Check each locally catalogued Samsung code, with one stable firmware per code.
// Two region candidates maximum; one bounded component extraction. No phone access.
const fs = require('node:fs');
const vm = require('node:vm');
const { FUS } = require('./samsung-fus.cjs');
const { acquire } = require('./acquire-samsung.cjs');
const html = fs.readFileSync('index.html', 'utf8');
const literal = html.match(/const detailedModels = (\{[\s\S]*?\n    \});/)[1];
const labels = vm.runInNewContext('(' + literal + ')').Samsung;
const targets = [];
for (const label of labels) {
  const [name, raw] = label.split('·'); if (!raw) continue;
  const parts = raw.trim().split('/').map(p => p.trim()), base = parts[0];
  for (let i = 0; i < parts.length; i++) {
    let code = parts[i];
    if (i && /^[A-Z]\d{3}[A-Z0-9]*$/.test(code)) code = 'SM-' + code;
    else if (i && /^(?:[A-Z]+\d*|0)$/.test(code)) code = base.match(/^SM-[A-Z]\d{3}/)?.[0] + code;
    if (/^SM-[A-Z]\d{3}[A-Z0-9]*$/.test(code) && !targets.some(t => t.code === code)) targets.push({ code, model: name.trim() });
  }
}
const output = 'research/samsung-preloader-coverage.json';
const audit = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {
  scope: 'Each Samsung variant code in the local catalog. At most two sales regions, one latest dated non-beta firmware per code; NOT all historical builds or all regions.',
  records: []
};
const save = () => fs.writeFileSync(output, JSON.stringify({ ...audit, checkedAt: new Date().toISOString(), targetCount: targets.length }, null, 2) + '\n');
const regions = code => /M$/.test(code) ? ['CHO','ZTO'] : /(?:U|U1|U2)$/.test(code) ? ['XAA','ATT'] : /W$/.test(code) ? ['XAC','BMC'] : /0$/.test(code) ? ['TGY','CHC'] : /N$/.test(code) ? ['KOO','SKC'] : /(?:B|BU)$/.test(code) ? ['EUX','BTU'] : /E$/.test(code) ? ['INS','XSG'] : ['XSG','INS'];
async function main() {
  for (const target of targets) {
    if (audit.records.some(r => r.code === target.code)) continue;
    const record = { ...target, checkedAt: new Date().toISOString(), attempts: [] };
    const existing = fs.readdirSync('downloads').find(n => n.startsWith('preloader_' + target.code + '_') && n.endsWith('.json'));
    if (existing) { record.status = 'download-available'; record.provenance = 'downloads/' + existing; }
    else {
      let found;
      for (const region of regions(target.code)) {
        try {
          const history = await new FUS().history(target.code, region);
          const latest = history.filter(v => v.index !== '90' && v.version).sort((a,b) => b.date.localeCompare(a.date))[0];
          record.attempts.push({ region, historyEntries: history.length, latest });
          if (latest) { found = { region, version: latest.version }; break; }
        } catch (error) { record.attempts.push({ region, error: error.message }); }
      }
      if (!found) record.status = 'no-firmware-found-in-checked-regions';
      else try {
        const result = await acquire(target.code, found.region, found.version, { quiet: true });
        record.status = 'download-available'; record.provenance = 'downloads/' + result.file.replace(/\.bin$/, '.json');
      } catch (error) {
        record.status = error.code === 'NO_PRELOADER_IN_BL' ? 'no-preloader-in-checked-bl' : 'acquisition-pending';
        record.reason = error.message; if (error.evidence) record.evidence = error.evidence;
      }
    }
    audit.records.push(record); save();
    console.log(audit.records.length + '/' + targets.length + ' ' + target.code + ': ' + record.status);
  }
}
main().catch(error => { save(); console.error(error); process.exitCode = 1; });
