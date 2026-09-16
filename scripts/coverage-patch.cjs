// Embed the checked Samsung variant statuses so the page also works over file://.
// Emits an apply_patch patch; does not edit HTML.
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const records = JSON.parse(fs.readFileSync('research/samsung-preloader-coverage.json', 'utf8')).records;
const coverage = Object.fromEntries(records.map(record => [record.code, {
  status: record.status,
  firmware: record.evidence?.firmware?.split('/')[0] || record.attempts?.find(a => a.latest)?.latest.version.split('/')[0] || '',
  regions: (record.attempts || []).map(a => a.region).join(' / '),
  reason: record.reason || ''
}]));
const marker = '    let selectedModelIndex = null;';
const old = html.match(/    const samsungCoverage = \{[\s\S]*?\n    \};\n/)?.[0];
const data = '    const samsungCoverage = ' + JSON.stringify(coverage, null, 2).split('\n').join('\n    ') + ';\n';
const before = old || marker;
const after = old ? data : data + marker;
console.log('*** Begin Patch\n*** Update File: index.html\n@@\n' + before.split(/\r?\n/).map(line => '-' + line).join('\n') + '\n' + after.split('\n').map(line => '+' + line).join('\n') + '\n*** End Patch');
