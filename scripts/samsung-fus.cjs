// SPDX-License-Identifier: GPL-3.0-or-later
// Protocol reference: samloader (Copyright (C) 2020 nlscc),
// https://github.com/samloader/samloader (auth.py, request.py, crypt.py).
// Smart protocol reference: https://github.com/topjohnwu/samloader-rs
// Copyright 2026 John "topjohnwu" Wu (Apache-2.0), auth/fusclient/xml protocol descriptions.
// Queries public Samsung firmware metadata; no device is connected or modified.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const authKey = Buffer.from('422e73733617ae2b198940fd4e32b0a5', 'hex');
const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const data = (response, tag) => response.match(new RegExp('<' + tag + '>\\s*<Data>([\\s\\S]*?)</Data>'))?.[1] || '';
const logic = (input, nonce) => [...nonce].map(c => input[c.charCodeAt(0) & 15]).join('');
class FUS {
  constructor() { this.signature = ''; this.cookies = {}; }
  header() { return `FUS nonce="${this.encryptedNonce || ''}", signature="${this.signature}", nc="", type="", realm="", newauth="1"`; }
  async request(endpoint, fields, get = '', authorization = this.header()) {
    const body = fields ? '<FUSMsg><FUSHdr><ProtoVer>1.0</ProtoVer><SessionID>0</SessionID><MsgID>1</MsgID></FUSHdr><FUSBody><Put>' + Object.entries(fields).map(([k,v]) => k === 'CmdID' ? `<CmdID>${v}</CmdID>` : `<${k}><Data>${xml(v)}</Data></${k}>`).join('') + '</Put>' + get + '</FUSBody></FUSMsg>' : '';
    const response = await fetch('https://neofussvr.sslcs.cdngc.net/' + endpoint, { method: 'POST', body, signal: AbortSignal.timeout(25000), headers: {
      Authorization: authorization, 'User-Agent': 'SMART 2.0', 'Content-Type': 'application/xml', Cookie: Object.entries(this.cookies).map(([k,v]) => k+'='+v).join('; ')
    }});
    for (const cookie of response.headers.getSetCookie()) { const first = cookie.split(';')[0], p = first.indexOf('='); this.cookies[first.slice(0,p)] = first.slice(p+1); }
    const nonce = response.headers.get('nonce');
    if (nonce) {
      this.encryptedNonce = nonce;
      this.nonce = nonce;
      const block = Buffer.alloc(16, '0'); Buffer.from(nonce).copy(block, 0, 0, 16);
      const cipher = crypto.createCipheriv('aes-128-ecb', authKey, null); cipher.setAutoPadding(false);
      this.signature = Buffer.concat([cipher.update(block),cipher.final()]).toString('hex');
    }
    const text = await response.text();
    if (!response.ok) throw new Error('FUS HTTP ' + response.status);
    return text;
  }
  async history(model, region) {
    if (!/^[A-Z0-9-]+$/.test(model) || !/^[A-Z0-9]+$/.test(region)) throw new Error('Invalid model or region');
    const nonce = crypto.randomBytes(8).toString('hex');
    const md5 = value => crypto.createHash('md5').update(value).digest('hex');
    const signature = md5(md5('auth:' + nonce + ':00000001') + ':FUS:' + md5('interface:' + model));
    const authorization = `FUS nonce="${nonce}", signature="${signature}", nc="00000001", type="auth", realm="interface"`;
    const response = await this.request('SmartHistory.do', { CmdID: 1, ACCESS_MODE: 1, BINARY_LOCAL_CODE: region, BINARY_MODEL_NAME: model }, '', authorization);
    return [...response.matchAll(/<BINARY_INFO>([\s\S]*?)<\/BINARY_INFO>/g)].map(match => ({ version: data(match[1], 'BINARY_SW_VERSION'), date: data(match[1], 'BINARY_OPEN_DATE'), index: data(match[1], 'BINARY_INDEX') }));
  }
  async metadata(model, region, version) {
    if (!/^[A-Z0-9-]+$/.test(model) || !/^[A-Z0-9]+$/.test(region) || !/^[A-Z0-9/]+$/.test(version)) throw new Error('Invalid parameters');
    const parts = version.split('/');
    if (parts.length === 3) parts.push(parts[0]);
    if (!parts[2]) parts[2] = parts[0];
    version = parts.join('/');
    await this.request('NF_SmartDownloadGenerateNonce.do');
    const response = await this.request('NF_SmartDownloadBinaryInform.do', {
      CmdID: 1, ACCESS_MODE: 1, BINARY_NATURE: 1, REQUEST_TYPE: 2, BINARY_SW_VERSION: version,
      BINARY_LOCAL_CODE: region, BINARY_MODEL_NAME: model, LOGIC_CHECK: logic(version, this.nonce)
    }, '<Get><CmdID>2</CmdID><BINARY_SW_VERSION></BINARY_SW_VERSION></Get>');
    const status = response.match(/<Status>([^<]+)/)?.[1];
    if (!['200','S00'].includes(status)) throw new Error('FUS metadata status ' + status + ': ' + response);
    const filename = data(response, 'BINARY_NAME');
    const latest = data(response, 'BINARY_SW_VERSION') || data(response, 'LATEST_FW_VERSION');
    const logicValue = data(response, 'LOGIC_VALUE_FACTORY');
    if (!filename || !latest || !logicValue) throw new Error('Missing firmware metadata: ' + response);
    this.key = crypto.createHash('md5').update(logic(latest, logicValue)).digest();
    this.meta = { model, region, version: latest, filename, path: data(response,'MODEL_PATH'), bytes: Number(data(response,'BINARY_BYTE_SIZE')), checkedAt: new Date().toISOString() };
    await this.request('NF_SmartDownloadBinaryInitForMass.do', { BINARY_NAME: filename, BINARY_SW_VERSION: latest, DEVICE_LOCAL_CODE: region, DEVICE_MODEL_TYPE: data(response,'DEVICE_MODEL_TYPE'), LOGIC_CHECK: logic(filename.slice(-25,-9), this.nonce) });
    return this.meta;
  }
  async range(start, end) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= this.meta.bytes) throw new Error('Invalid byte range');
    const lo = Math.floor(start/16)*16, hi = Math.ceil((end+1)/16)*16-1;
    if (hi-lo > 32*1024*1024) throw new Error('Range exceeds 32 MB cap');
    const url = new URL('https://cloud-neofussvr.samsungmobile.com/NF_SmartDownloadBinaryForMass.do');
    url.search = '?file=' + this.meta.path + this.meta.filename;
    const response = await fetch(url, { signal: AbortSignal.timeout(40000), headers: { Authorization: this.header(), 'User-Agent': 'SMART 2.0', Range: `bytes=${lo}-${hi}` }});
    if (response.status !== 206 || !response.headers.get('content-range')?.startsWith(`bytes ${lo}-${hi}/`)) { await response.body?.cancel(); throw new Error('Server did not accept exact partial download: HTTP ' + response.status); }
    const reader = response.body.getReader(), buffers = []; let size = 0;
    while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size>hi-lo+1) { await reader.cancel(); throw new Error('Oversized response'); } buffers.push(Buffer.from(value)); }
    if (size !== hi-lo+1) throw new Error('Incomplete byte range');
    const decipher = crypto.createDecipheriv('aes-128-ecb', this.key, null); decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(Buffer.concat(buffers)),decipher.final()]);
    return decrypted.subarray(start-lo,end-lo+1);
  }
}
async function main() {
  const [model,region,version] = process.argv.slice(2);
  const client = new FUS();
  if (version === '--history') { console.log(JSON.stringify(await client.history(model,region), null, 2)); return; }
  const meta = await client.metadata(model,region,version);
  console.log(JSON.stringify(meta,null,2));
  const start = meta.bytes - 65536;
  const tail = await client.range(start,meta.bytes-1);
  const dir = path.resolve('.artifacts'); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,model+'-tail.bin'),tail);
  let eocd = -1;
  for(let p=tail.length-22;p>=0;p--) if(tail.readUInt32LE(p)===0x06054b50){eocd=p;break;}
  if(eocd<0) throw new Error('ZIP end directory not found');
  console.log('ZIP',JSON.stringify({centralSize:tail.readUInt32LE(eocd+12),centralOffset:tail.readUInt32LE(eocd+16)}));
  fs.writeFileSync(path.join(dir,model+'-firmware.json'),JSON.stringify(meta,null,2));
}
if (require.main === module) main().catch(error=>{ console.error(error.message); process.exitCode=1; });
module.exports = { FUS };
