/* Tests the Edge Functions' image integrity checker.
 *
 * WHY THIS FILE EXISTS: the checker shipped with a false negative. It
 * verified that a JPEG ends with FFD9 and called that whole, which passed
 * Tuscan Chicken Pasta — a file with an intact marker chain whose
 * entropy-coded scan data ran out early, so it decoded to a photo on top
 * and grey below. A checker that can be wrong silently is worse than no
 * checker, because it launders a bad file as verified. This pins the
 * behaviour so the next change to it has to stay honest.
 *
 * The functions are TypeScript for Deno; this lifts them out of the real
 * source rather than keeping a second copy, because a copy would drift and
 * then test nothing. Fixtures are synthesised from marker bytes rather
 * than committed as binaries: nothing here needs to be a decodable image,
 * only to have the structure the checker reads.
 *
 *   node test/image-integrity.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'rehost-images', 'index.ts');

/* Pull the two functions and the threshold out of the deployed source and
   strip the type annotations, which is all that stands between this Deno
   module and plain Node. Deliberately narrow: if the signatures change,
   this throws rather than silently testing nothing. */
function loadChecker() {
  const src = fs.readFileSync(SRC, 'utf8');
  const from = src.indexOf('function jpegDimensions');
  const to = src.indexOf('const sleep =');
  if (from < 0 || to < 0 || to < from) throw new Error('could not find the checker in ' + SRC);
  const js = src.slice(from, to).split('\n').map(line => {
    if (line.startsWith('function jpegDimensions')) return 'function jpegDimensions(bytes) {';
    if (line.startsWith('function imageIntegrity')) return 'function imageIntegrity(bytes, contentLength) {';
    return line.replace('(i: number)', '(i)');
  }).join('\n');
  const factory = new Function(js + '\nreturn { jpegDimensions, imageIntegrity, MIN_BYTES_PER_PIXEL };');
  return factory();
}

const { jpegDimensions, imageIntegrity, MIN_BYTES_PER_PIXEL } = loadChecker();

/* A JPEG the checker can read: SOI, a SOF0 declaring the dimensions, a
   SOS, `scanBytes` of payload, and optionally the EOI marker. Not a
   decodable image and not meant to be — it carries exactly the structure
   the checker inspects. */
function makeJpeg({ w, h, scanBytes, withEoi = true, trailingNuls = 0 }) {
  const out = [0xFF, 0xD8];
  // SOF0: length 17, 8-bit precision, height, width, 3 components
  out.push(0xFF, 0xC0, 0x00, 0x11, 0x08, (h >> 8) & 0xFF, h & 0xFF, (w >> 8) & 0xFF, w & 0xFF, 0x03);
  for (const id of [1, 2, 3]) out.push(id, 0x11, 0x00);
  // SOS: length 12, 3 components
  out.push(0xFF, 0xDA, 0x00, 0x0C, 0x03);
  for (const id of [1, 2, 3]) out.push(id, 0x00);
  out.push(0x00, 0x3F, 0x00);
  // Payload. 0x00 is a safe filler: FF00 is the stuffed-byte escape, so
  // plain zeroes never look like a marker.
  for (let i = 0; i < scanBytes; i++) out.push(0x00);
  if (withEoi) out.push(0xFF, 0xD9);
  for (let i = 0; i < trailingNuls; i++) out.push(0x00);
  return new Uint8Array(out);
}

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) { passed++; console.log('ok    ' + name); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

// --- jpegDimensions -------------------------------------------------------
{
  const d = jpegDimensions(makeJpeg({ w: 800, h: 1200, scanBytes: 500000 }));
  check('reads width and height from SOF0', d && d.w === 800 && d.h === 1200, JSON.stringify(d));
}
{
  // A preceding APP1 (EXIF) segment must be skipped by length, not scanned past.
  const base = Array.from(makeJpeg({ w: 640, h: 480, scanBytes: 200000 }));
  const app1 = [0xFF, 0xE1, 0x10, 0x02];
  for (let i = 0; i < 0x1000; i++) app1.push(0x00);
  const withExif = new Uint8Array([0xFF, 0xD8, ...app1, ...base.slice(2)]);
  const d = jpegDimensions(withExif);
  check('skips a large APP1 segment to reach SOF0', d && d.w === 640 && d.h === 480, JSON.stringify(d));
}
{
  check('returns null rather than throwing on rubbish',
    jpegDimensions(new Uint8Array([0xFF, 0xD8, 0x00, 0x01, 0x02, 0x03])) === null);
}

// --- imageIntegrity: transfer truncation ----------------------------------
{
  const img = makeJpeg({ w: 800, h: 1200, scanBytes: 500000 });
  check('a whole JPEG passes', imageIntegrity(img, null) === null, imageIntegrity(img, null));
  check('Content-Length disagreeing with the bytes is caught',
    /transfer truncated/.test(imageIntegrity(img, img.byteLength + 5000) || ''));
  check('Content-Length agreeing is not flagged', imageIntegrity(img, img.byteLength) === null);
}

// --- imageIntegrity: the two truncation shapes ----------------------------
{
  // Classic Scones: cut off mid-stream, no end marker.
  const noEoi = makeJpeg({ w: 800, h: 1200, scanBytes: 35000, withEoi: false });
  check('a JPEG with no end marker is caught',
    /no end-of-image marker/.test(imageIntegrity(noEoi, null) || ''));
}
{
  /* Tuscan Chicken Pasta: marker chain intact, EOI present, scan data far
     too short for the declared dimensions. This is the case the original
     checker passed, and the reason this file exists. */
  const terminated = makeJpeg({ w: 800, h: 1200, scanBytes: 10000 });
  const problem = imageIntegrity(terminated, null) || '';
  check('a terminated but under-filled JPEG is caught', /too little image data/.test(problem), problem || '(passed as whole)');
  check('...and the message reports the measured density', /bytes\/pixel/.test(problem));
}
{
  // Trailing NULs after EOI are legal and must not be read as truncation.
  const padded = makeJpeg({ w: 800, h: 1200, scanBytes: 500000, trailingNuls: 64 });
  check('trailing NULs after the end marker are tolerated', imageIntegrity(padded, null) === null);
}
{
  // The threshold must not condemn a normal photo. 0.05 b/px is the low
  // end of what real web-optimised images in this library measure.
  const lean = makeJpeg({ w: 800, h: 1200, scanBytes: Math.round(800 * 1200 * 0.05) });
  check('a lean but normal photo is not condemned', imageIntegrity(lean, null) === null, imageIntegrity(lean, null));
  check('the threshold sits well below a real photo', MIN_BYTES_PER_PIXEL < 0.05);
}

// --- imageIntegrity: other formats ----------------------------------------
{
  const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(40).fill(0)]);
  check('a PNG with no IEND is caught', /no IEND/.test(imageIntegrity(png, null) || ''));
  const whole = new Uint8Array([...png, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  check('a PNG with IEND passes', imageIntegrity(whole, null) === null);
}
{
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(20).fill(0x11)]);
  check('a GIF with no trailer is caught', /no trailer/.test(imageIntegrity(gif, null) || ''));
  const whole = new Uint8Array([...gif, 0x3B]);
  check('a GIF with its trailer passes', imageIntegrity(whole, null) === null);
}
{
  const riff = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0xFF, 0xFF, 0x00, 0x00, ...new Array(20).fill(0)]);
  check('a WEBP shorter than its header claims is caught', /truncated WEBP/.test(imageIntegrity(riff, null) || ''));
}
{
  check('a file too small to be an image is caught',
    /too small/.test(imageIntegrity(new Uint8Array([0xFF, 0xD8, 0x00]), null) || ''));
}

/* The checker is shared by both functions. If they drift apart, one of
   them is running a check the other is not, which is exactly the sort of
   quiet divergence this project's conventions are meant to prevent. */
{
  const other = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'functions', 'find-recipe-image', 'index.ts'), 'utf8');
  const src = fs.readFileSync(SRC, 'utf8');
  const slice = s => s.slice(s.indexOf('function jpegDimensions'), s.indexOf('function imageIntegrity')
    + s.slice(s.indexOf('function imageIntegrity')).indexOf('\n}\n') + 3);
  check('both Edge Functions carry an identical checker', slice(src) === slice(other));
}

console.log('');
if (failures.length) {
  console.log(failures.length + ' failed, ' + passed + ' passed');
  process.exit(1);
}
console.log(passed + ' checks passed');
