// Read-only inspection of Android update payload metadata downloaded from Xiaomi.
// Wire schema: AOSP update_engine/update_metadata.proto (PartitionUpdate / InstallOperation).
const fs = require('node:fs');
function protobuf(buffer) {
  let offset = 0;
  const fields = {};
  function varint() {
    let value = 0n, shift = 0n;
    for (let i = 0; i < 10; i++) {
      if (offset >= buffer.length) throw new Error('Truncated protobuf');
      const byte = buffer[offset++];
      value |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) {
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Integer too large');
        return Number(value);
      }
      shift += 7n;
    }
    throw new Error('Invalid varint');
  }
  while (offset < buffer.length) {
    const tag = varint(), number = tag >>> 3, wire = tag & 7;
    let value;
    if (wire === 0) value = varint();
    else if (wire === 2 || wire === 1 || wire === 5) {
      const length = wire === 2 ? varint() : wire === 1 ? 8 : 4;
      if (offset + length > buffer.length) throw new Error('Truncated field');
      value = buffer.subarray(offset, offset + length);
      offset += length;
    } else throw new Error('Unsupported protobuf wire type ' + wire);
    (fields[number] ||= []).push(value);
  }
  return fields;
}
function inspect(head = fs.readFileSync('firmware-head.tmp'), localOffset = 3516, absoluteBase = 0) {
  // The defaults preserve the original gale acquisition. Callers can supply another ZIP header.
  if (head.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Bad ZIP header');
  if (head.readUInt16LE(localOffset + 8) !== 0) throw new Error('Compressed payload unsupported');
  const payloadStart = localOffset + 30 + head.readUInt16LE(localOffset + 26) + head.readUInt16LE(localOffset + 28);
  if (head.toString('ascii', payloadStart, payloadStart + 4) !== 'CrAU') throw new Error('Not an Android payload');
  const version = Number(head.readBigUInt64BE(payloadStart + 4));
  const manifestSize = Number(head.readBigUInt64BE(payloadStart + 12));
  if (version !== 2) throw new Error('Expected payload v2');
  const signatureSize = head.readUInt32BE(payloadStart + 20);
  if (head.length < payloadStart + 24 + manifestSize) throw new Error('Need more metadata bytes: ' + (payloadStart + 24 + manifestSize));
  const manifest = protobuf(head.subarray(payloadStart + 24, payloadStart + 24 + manifestSize));
  const dataStart = absoluteBase + payloadStart + 24 + manifestSize + signatureSize;
  const blockSize = manifest[3]?.[0] || 4096;
  const partitions = (manifest[13] || []).map(protobuf);
  const preloaders = partitions.filter(p => /preloader/i.test(p[1][0].toString())).map(p => {
    const info = protobuf(p[7][0]);
    return { name: p[1][0].toString(), size: info[1][0], sha256: info[2][0].toString('hex'), operations: p[8].map(protobuf).map(op => ({
      type: op[1][0], start: dataStart + (op[2]?.[0] || 0), length: op[3]?.[0] || 0,
      sha256: op[8]?.[0]?.toString('hex'), extents: (op[6] || []).map(protobuf).map(e => ({ start: e[1][0] * blockSize, length: e[2][0] * blockSize }))
    })) };
  });
  return { payloadStart: absoluteBase + payloadStart, manifestSize, dataStart, blockSize, names: partitions.map(p => p[1][0].toString()), preloaders };
}
if (require.main === module) console.log(JSON.stringify(inspect(), null, 2));
module.exports = { inspect };
