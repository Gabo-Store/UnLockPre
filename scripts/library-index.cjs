// UnLockPre catalog builder/validator. downloads/catalog.json is the public source of truth.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const ROOT=path.resolve('downloads');
const CATALOG=path.join(ROOT,'catalog.json');
const sha256=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function inferBrand(record,old){if(old?.brand)return old.brand;if(/^SM-|^GT-|^SGH-|^SCH-|^T\d/i.test(record.model||''))return'Samsung';const host=(()=>{try{return new URL(record.source||'').hostname}catch{return''}})();if(/miui\.com$/.test(host))return'Xiaomi';const names=[...(record.models||[]),record.model||''].join(' ');if(/oneplus|nord/i.test(names))return'Oneplus';if(/realme|RMX/i.test(names)||/allawnofs\.com$/.test(host))return'Realme';return old?.brand||'MediaTek'}
function discover(){const old=fs.existsSync(CATALOG)?readJson(CATALOG):{files:[]};const oldByProv=new Map((old.files||[]).map(x=>[x.provenance,x]));const oldByFile=new Map((old.files||[]).map(x=>[x.filename,x]));const out=[];const seenFiles=new Set();for(const name of fs.readdirSync(ROOT).filter(x=>x.endsWith('.json')&&x!=='catalog.json').sort()){
  let r;try{r=readJson(path.join(ROOT,name))}catch{continue}
  const filename=r.file||r.outputFile||r.preloaderFile;if(!filename||!filename.endsWith('.bin'))continue;
  const bin=path.join(ROOT,path.basename(filename));if(!fs.existsSync(bin))continue;
  const prov=`downloads/${name}`;const oldItem=oldByProv.get(prov)||oldByFile.get(path.basename(filename));
  const actualBytes=fs.statSync(bin).size, actualSha=sha256(bin);
  if(r.bytes!=null)assert.equal(Number(r.bytes),actualBytes,`${name}: bytes`);if(r.sha256)assert.equal(String(r.sha256).toLowerCase(),actualSha,`${name}: sha256`);
  const brand=inferBrand(r,oldItem);const models=oldItem?.models||r.models||(r.model?[r.model]:[r.codename||path.basename(filename,'.bin')]);
  const variant=oldItem?.variant||r.model||r.codename||r.device||r.id||path.basename(filename,'.bin');
  const item={id:oldItem?.id||r.id||path.basename(name,'.json'),brand,models,variant,variantLabel:oldItem?.variantLabel||variant,firmware:r.firmware||oldItem?.firmware||r.version||'',build:r.build||oldItem?.build||r.metadata?.['post-build-incremental']||'',region:r.region||oldItem?.region||'',android:r.android||oldItem?.android||'',filename:path.basename(filename),href:`downloads/${path.basename(filename)}`,bytes:actualBytes,sha256:actualSha,provenance:prov,source:r.source||oldItem?.source||'',addedAt:oldItem?.addedAt||r.checkedAt||''};
  if(!seenFiles.has(item.filename)){seenFiles.add(item.filename);out.push(item)}
}
for(const x of old.files||[]){if(seenFiles.has(x.filename))continue;const bin=path.join(ROOT,path.basename(x.filename||''));if(!x.filename||!fs.existsSync(bin))continue;const actualSha=sha256(bin);assert.equal(actualSha,x.sha256,`${x.filename}: sha256`);out.push({...x,bytes:fs.statSync(bin).size,sha256:actualSha})}
const hashes=new Map();for(const x of out){assert.match(x.href,/^downloads\/[a-zA-Z0-9_.-]+\.bin$/);assert.match(x.provenance,/^downloads\/[a-zA-Z0-9_.-]+\.json$/);if(hashes.has(x.sha256))console.warn(`duplicate SHA: ${x.filename} == ${hashes.get(x.sha256)}`);else hashes.set(x.sha256,x.filename)}
const modelKeys=new Set(),variantKeys=new Set(),byBrand={};for(const x of out){for(const m of x.models||[])modelKeys.add(`${x.brand}:${m}`);variantKeys.add(`${x.brand}:${x.variant}`);byBrand[x.brand]=(byBrand[x.brand]||0)+1}
out.sort((a,b)=>(Date.parse(b.addedAt)||0)-(Date.parse(a.addedAt)||0)||`${a.brand}${a.filename}`.localeCompare(`${b.brand}${b.filename}`));
const generatedAt=out.map(x=>x.addedAt).filter(Boolean).sort().at(-1)||old.generatedAt||null;return{schemaVersion:2,generatedAt,scope:'Distinct unmodified stock preloader binaries and metadata. File count is not a device/model count. Compatibility must be independently verified.',uniqueFiles:out.length,modelReferences:modelKeys.size,variantRegionReferences:variantKeys.size,totalBytes:out.reduce((n,x)=>n+x.bytes,0),byBrand,files:out}}
function main(){const result=discover();fs.writeFileSync(CATALOG,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,files:undefined},null,2))}
if(require.main===module)main();module.exports={discover};
