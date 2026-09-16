const fs = require('node:fs');
const crypto = require('node:crypto');
function duplicateOf(sha256) {
  for (const name of fs.readdirSync('downloads').filter(n => n.endsWith('.json'))) {
    const record = JSON.parse(fs.readFileSync('downloads/' + name, 'utf8'));
    if (record.sha256 !== sha256 || !/^[a-zA-Z0-9_.-]+\.bin$/.test(record.file || '')) continue;
    const bytes = fs.readFileSync('downloads/' + record.file);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Existing library integrity mismatch');
    return record.file;
  }
  return null;
}
module.exports = { duplicateOf };
