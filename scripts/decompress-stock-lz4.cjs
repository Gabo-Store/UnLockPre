const lz4 = require('lz4js');
const xxhash = require('lz4js/xxh32');
module.exports = function decompressStockLz4(source) {
  if (source.length < 23 || source.readUInt32LE(0) !== 0x184d2204) throw new Error('Expected LZ4 frame');
  const flags = source[4];
  if ((flags & 0xc0) !== 0x40 || !(flags & 8) || !(flags & 4) || (flags & 0x11)) throw new Error('Requires content size/checksum, without dictionary/block checksum');
  const size = Number(source.readBigUInt64LE(6));
  if (!Number.isSafeInteger(size) || size < 1 || size > 32 * 1024 * 1024) throw new Error('LZ4 content size limit');
  if (((xxhash.hash(0,source,4,10) >>> 8) & 255) !== source[14]) throw new Error('LZ4 header checksum mismatch');
  let p = 15;
  while (p + 4 <= source.length) { const blockSize = source.readUInt32LE(p) & 0x7fffffff; p += 4; if (!blockSize) break; p += blockSize; }
  if (p + 4 !== source.length) throw new Error('Truncated or trailing LZ4 data');
  const output = Buffer.alloc(size);
  if (lz4.decompressFrame(source, output) !== size) throw new Error('LZ4 output size mismatch');
  if (xxhash.hash(0,output,0,output.length) !== source.readUInt32LE(p)) throw new Error('LZ4 content checksum mismatch');
  return output;
};
