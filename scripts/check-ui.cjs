const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'device-atlas-ui-'));
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--disable-software-rasterizer', '--disable-background-networking',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let ws;
const errors = [], requests = [];
async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 120 && !fs.existsSync(portFile); i++) await sleep(125);
  if (!fs.existsSync(portFile)) throw new Error('Browser did not start; profile: ' + profile);
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); clearTimeout(task.timeout); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result); }
  });
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 8000);
      pending.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  const check = async (expression, label) => {
    for (let i = 0; i < 30; i++) {
      if (await evaluate(expression)) { console.log('PASS', label); return; }
      await sleep(50);
    }
    assert.fail(label);
  };
  async function allModelDownloads() {
    const links = new Set();
    for (let i = 0; i < 100; i++) {
      for (const href of await evaluate('[...document.querySelectorAll("#variantList a[download]")].map(a=>a.getAttribute("href"))')) links.add(href);
      if (!await evaluate('!!document.querySelector("#filePagination [data-file-next]:not(:disabled)")')) break;
      await evaluate('document.querySelector("#filePagination [data-file-next]").click()');
      if (i === 99) throw new Error('File pagination did not terminate');
    }
    await evaluate('changeFilePage(1)');
    return [...links];
  }
  await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
  await command('Page.navigate', { url: pathToFileURL(path.resolve('index.html')).href });
  for (let i = 0; i < 80; i++) { if (await evaluate('!!document.querySelector(".brand-card")')) break; await sleep(100); }
  if (process.env.ATLAS_BENCHMARK) {
    await require('./benchmark-ui.cjs')(command, evaluate, process.env.ATLAS_BENCHMARK);
    await command('Browser.close').catch(() => {});
    return;
  }
  await evaluate('document.head.insertAdjacentHTML("beforeend", "<style>*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}</style>")');
  for (const width of [320, 390, 768, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await check('document.documentElement.scrollWidth <= window.innerWidth', 'no horizontal overflow at ' + width);
  }
  await check('document.querySelectorAll(".brand-card").length === 12', 'catalog pagination');
  await check('document.querySelector("#brandTotal").textContent === "140"', 'real brand count');
  await evaluate('searchInput.value="SM-A055M";searchInput.dispatchEvent(new Event("input"))');
  await check('document.querySelectorAll(".brand-card").length===1 && document.querySelector(".brand-card").dataset.brand==="Samsung"', 'abbreviated variant code search');
  await evaluate('document.querySelector(".brand-card").click();document.querySelector("[data-model]").click()');
  await check('modal.open && !document.querySelector("#variantPanel").hidden && [...document.querySelectorAll(".variant-row strong")].map(x=>x.textContent).join(",")==="SM-A055F,SM-A055M"', 'brand to model to exact A05 variants');
  assert.equal((await allModelDownloads()).length, await evaluate('filesFor("Samsung", "Galaxy A05").length'));
  await check('document.querySelectorAll(".variant-card a[download]").length<=4 && document.querySelector("#variantList").textContent.includes("Origen: Samsung")', 'all stock A05 downloads accessible with bounded rendering');
  await check('document.querySelector("#variantList").textContent.includes("CHO") && document.querySelector("#variantList").textContent.includes("XSG")', 'Samsung firmware regions remain distinct');
  await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
  await check('modal.scrollWidth<=modal.clientWidth && document.querySelector(".modal-body").scrollWidth<=document.querySelector(".modal-body").clientWidth', 'variant modal mobile width');
  fs.mkdirSync('.artifacts', { recursive: true });
  const samsungShot = await command('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.artifacts/samsung-mobile.png', Buffer.from(samsungShot.data, 'base64'));
  await evaluate('document.querySelector("#backToModels").click()');
  await check('document.activeElement.hasAttribute("data-model") && document.querySelector("#variantPanel").hidden', 'return to selected model with keyboard focus');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(50);
  await check('!modal.open && document.activeElement.classList.contains("brand-card") && !document.body.classList.contains("modal-open")', 'Escape restores page and focus');
  await evaluate('document.querySelector("#showDownloads").click();document.querySelector("[data-brand=Xiaomi]").click()');
  await evaluate('const b=[...document.querySelectorAll("[data-model]")].find(x=>x.textContent.includes("Redmi 13C"));b.click()');
  const download = await evaluate('document.querySelector("#variantList a[download]").getAttribute("href")');
  assert.ok(download.startsWith('downloads/'));
  const provenance = JSON.parse(fs.readFileSync('downloads/provenance.json', 'utf8'));
  const file = fs.readFileSync(download);
  assert.equal(crypto.createHash('sha256').update(file).digest('hex'), provenance.sha256);
  console.log('PASS real downloadable binary SHA-256 matches provenance');
  assert.equal((await allModelDownloads()).length, await evaluate('filesFor("Xiaomi", "Redmi 13C").length'));
  await check('document.querySelectorAll("#variantList a[download]").length<=4 && document.querySelector("#variantList").textContent.includes("Global (MI)")', 'all gale regions accessible without rendering the entire history');
  await check('document.querySelector(".file-detail").textContent.includes("V14.0.5.0.TGPINXM")', 'firmware and region are visible');
  await check('document.querySelector(".modal-body").scrollWidth<=document.querySelector(".modal-body").clientWidth', 'download detail mobile width');
  const catalog = await evaluate('fileCatalog');
  const uniqueIds = new Set();
  const uniqueHashes = new Set();
  for (const entry of catalog) {
    assert.ok(!uniqueIds.has(entry.id), 'unique file id'); uniqueIds.add(entry.id);
    assert.ok(!uniqueHashes.has(entry.sha256), 'unique binary content, not renamed copies'); uniqueHashes.add(entry.sha256);
    assert.ok(/^downloads\/[a-zA-Z0-9_.-]+\.bin$/.test(entry.href), 'safe download path');
    const binary = fs.readFileSync(entry.href);
    const record = JSON.parse(fs.readFileSync(entry.provenance, 'utf8'));
    assert.equal(hash(binary), entry.sha256, entry.filename);
    assert.equal(binary.length, entry.bytes);
    assert.equal(record.sha256, entry.sha256);
    assert.equal(record.firmware, entry.firmware);
    assert.equal(record.file, entry.filename);
    assert.equal(record.source, entry.source);
  }
  console.log('PASS every published file matches its own size, SHA-256, firmware and provenance');
  await check('document.querySelector("#downloadTotal").textContent === publishedFiles.length + " archivos originales disponibles · " + new Set(publishedFiles.flatMap(file => file.models.map(model => file.brand + ":" + model))).size + " modelos"', 'accurate file/model counts');
  const downloadDir = fs.mkdtempSync(path.resolve('.artifacts', 'browser-download-'));
  await command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await evaluate('document.querySelector("#variantList a[download]").click()');
  const downloaded = path.join(downloadDir, provenance.file);
  for (let i = 0; i < 60 && !fs.existsSync(downloaded); i++) await sleep(100);
  assert.equal(hash(fs.readFileSync(downloaded)), provenance.sha256);
  console.log('PASS actual browser download and resulting file SHA-256');
  for (const sample of [
    { query: 'RMX3636', brand: 'Realme', model: 'Realme 11 4G / 5G', files: 2 },
    { query: 'RMX3782', brand: 'Realme', model: 'Realme C67 5G', files: 1 },
    { query: 'RMX3998', brand: 'Realme', model: 'Realme 12X', files: 1 },
    { query: 'DN2103', brand: 'Oneplus', model: 'OnePlus Nord 2', files: 1 },
    { query: 'SM-A156E', brand: 'Samsung', model: 'Galaxy A15 5G', files: 2 }
  ]) {
    await evaluate('modal.close();resetFilters();searchInput.value=' + JSON.stringify(sample.query) + ';applyFilters()');
    assert.equal(await evaluate('document.querySelector(".brand-card").dataset.brand'), sample.brand);
    await evaluate('document.querySelector(".brand-card").click();document.querySelector("[data-model]").click()');
    assert.equal(await evaluate('document.querySelector("#selectedModelTitle").textContent'), sample.model);
    const expectedDownloads = catalog.filter(file => file.brand === sample.brand && file.models.includes(sample.model)).length;
    assert.ok(expectedDownloads >= sample.files);
    assert.equal((await allModelDownloads()).length, expectedDownloads);
    await check('document.querySelector(".modal-body").scrollWidth<=document.querySelector(".modal-body").clientWidth', sample.query + ' search, variant downloads and mobile width');
  }
  await evaluate('modal.close();resetFilters();searchInput.value="SM-A146M";applyFilters();document.querySelector(".brand-card").click();document.querySelector("[data-model]").click()');
  await check('document.querySelector("#variantList").textContent.includes("No se encontró preloader dentro del componente BL comprobado")', 'checked Samsung absence is scoped to its actual BL, not all firmware');
  const coverage = JSON.parse(fs.readFileSync('research/samsung-preloader-coverage.json', 'utf8')).records;
  const embeddedCoverage = await evaluate('samsungCoverage');
  assert.equal(Object.keys(embeddedCoverage).length, coverage.length);
  for (const record of coverage) assert.equal(embeddedCoverage[record.code].status, record.status);
  console.log('PASS embedded coverage matches all Samsung audit records');
  await evaluate('modal.close();resetFilters();searchInput.value="SM-A055M";applyFilters();document.querySelector(".brand-card").click();document.querySelector("[data-model]").click();document.querySelector("#firmwareSearch").value="A055MUBSJDZF1";document.querySelector("#firmwareSearch").dispatchEvent(new Event("input"))');
  await check('document.querySelectorAll("#variantList a[download]").length===1 && document.querySelector("#variantSummary").textContent.includes("1 de")', 'exact firmware filter finds one file within the model history');
  await evaluate('document.querySelector("#firmwareSearch").value="no-such-firmware";document.querySelector("#firmwareSearch").dispatchEvent(new Event("input"))');
  await check('!document.querySelector("#variantList a[download]") && !!document.querySelector("#variantList .empty")', 'unknown firmware never falls back to a different download');
  await evaluate('modal.close();resetFilters();searchInput.value="RMX3636";applyFilters();document.querySelector(".brand-card").click();document.querySelector("[data-model]").click()');
  fs.mkdirSync('.artifacts', { recursive: true });
  const detailShot = await command('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.artifacts/download-mobile.png', Buffer.from(detailShot.data, 'base64'));
  await evaluate('modal.close();searchInput.value="Samsung A55";detailFilter.value="all";applyFilters();document.querySelector(".brand-card").click();document.querySelector("[data-model]").click()');
  await check('document.querySelectorAll("#variantList a[download]").length===0 && !!document.querySelector(".unavailable:disabled")', 'unpublished files remain disabled');
  await evaluate('modal.close();resetFilters();searchInput.value="zzzz-no-model";applyFilters()');
  await check('!document.querySelector(".brand-card") && !!document.querySelector(".empty")', 'empty result and recovery link');
  await evaluate('resetFilters();sortOrder.value="za";applyFilters()');
  await check('document.querySelector(".brand-card").dataset.brand==="Zuum"', 'sorting Z to A');
  await evaluate('resetFilters();[...document.querySelectorAll("[data-page]")].find(button=>button.dataset.page==="2").click()');
  await check('document.querySelector("[aria-current=page]").textContent==="2" && document.activeElement.id==="brandGrid"', 'pagination retains keyboard focus');
  await evaluate('resetFilters();window.scrollTo(0,0);searchInput.blur()');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const shot = await command('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.artifacts/desktop.png', Buffer.from(shot.data, 'base64'));
  assert.deepEqual(errors, [], 'browser runtime errors');
  assert.equal(requests.filter(url => /^https?:/.test(url)).length, 0, 'page loads without external fonts or libraries');
  console.log('PASS zero external page requests and zero runtime errors');
  await command('Browser.close').catch(() => {});
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (ws) ws.close(); browser.kill(); });
