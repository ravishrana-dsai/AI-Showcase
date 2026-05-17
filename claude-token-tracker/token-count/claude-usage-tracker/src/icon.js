// Generates a 22x22 template PNG icon at runtime — no external assets needed.
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len  = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc  = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePNG(size, pixelFn) {
  // Build raw RGBA scanlines (filter byte 0 = None prepended to each row)
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter + RGBA pixels
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      row[1 + x * 4]     = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = a;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ◉ style: outer ring + center dot, black on transparent (macOS template image)
function createMenuBarIcon() {
  const { nativeImage } = require('electron');
  const SIZE = 22, CX = 11, CY = 11;

  const png = makePNG(SIZE, (x, y) => {
    const dx = x - CX, dy = y - CY;
    const d2 = dx * dx + dy * dy;
    const ring   = d2 >= 6 * 6 && d2 <= 9 * 9;   // outer ring
    const center = d2 <= 2 * 2;                    // center dot
    return ring || center ? [0, 0, 0, 255] : [0, 0, 0, 0];
  });

  const img = nativeImage.createFromBuffer(png, { scaleFactor: 1 });
  img.setTemplateImage(true); // lets macOS tint for dark/light mode
  return img;
}

module.exports = { createMenuBarIcon };
