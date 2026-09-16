const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('assets/app.js','utf8');
for(const token of ['entryModal','hashFile','favoriteList','compareBox','themeSelect','manifest.webmanifest','GaboStore'])assert.ok(html.includes(token),`index.html missing ${token}`);
for(const token of ['downloads/catalog.json','serviceWorker','unlockpre:favorites','crypto.subtle'])assert.ok(js.includes(token),`assets/app.js missing ${token}`);
for(const file of ['assets/app.css','assets/app.js','manifest.webmanifest','sw.js','favicon.svg','404.html','CONTRIBUTING.md'])assert.ok(fs.existsSync(file),`${file} missing`);
JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
console.log('PASS enhanced static site shell, PWA files and safety/credit modal');
