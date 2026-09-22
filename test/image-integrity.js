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

/* Pull the checker out of the deployed source and strip the type
   annotations, which is all that stands between this Deno module and plain
   Node.

   The stripping is generic rather than a list of known signatures. The
   earlier version named each function it expected and silently passed
   everything else through — so adding `isobmffTruncated` broke the whole
   file with a syntax error rather than testing the new function. Generic
   also means a signature change no longer needs this file edited in step.

   Still deliberately strict about WHAT it finds: the explicit check below
   throws if any expected export is missing, so a renamed or deleted
   function fails loudly instead of leaving checks that quietly test
   nothing. */
function loadChecker() {
  const src = fs.readFileSync(SRC, 'utf8');
  const from = src.indexOf('function jpegDimensions');
  const to = src.indexOf('const sleep =');
  if (from < 0 || to < 0 || to < from) throw new Error('could not find the checker in ' + SRC);
  const js = src.slice(from, to)
    /* `function name(a: T, b: U | null): {x: number} | null {` -> `function name(a, b) {`
       Anchored on the brace that ENDS THE LINE, not the first brace found:
       a return type can itself contain braces (`{ w: number; h: number }`),
       and matching the first one leaves the type behind as syntax. */
    .replace(/function\s+(\w+)\s*\(([^)]*)\)[^\n]*\{\s*$/gm,
      (_, name, args) => `function ${name}(${args.split(',')
        .map(a => a.split(':')[0].trim()).filter(Boolean).join(', ')}) {`)
    // `const f = (i: number) => …` and other inline annotations
    .replace(/\(([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$.<>|\[\] ]*\)\s*=>/g, '($1) =>')
    .replace(/:\s*Uint8Array\b/g, '');

  const factory = new Function(js +
    '\nreturn { jpegDimensions, imageIntegrity, isobmffTruncated, parseRecipeFilter, MIN_BYTES_PER_PIXEL };');
  const out = factory();
  for (const name of ['jpegDimensions', 'imageIntegrity', 'isobmffTruncated', 'parseRecipeFilter']) {
    if (typeof out[name] !== 'function') throw new Error(`${name} missing from ${SRC} — checks would be vacuous`);
  }
  if (typeof out.MIN_BYTES_PER_PIXEL !== 'number') throw new Error('MIN_BYTES_PER_PIXEL missing');
  return out;
}

const { jpegDimensions, imageIntegrity, isobmffTruncated, parseRecipeFilter, MIN_BYTES_PER_PIXEL } = loadChecker();

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
  /* The counterpart the audit found missing: without a passing case, a
     branch changed to condemn every WEBP would break nothing here. */
  const body = new Array(20).fill(0x57);
  const len = 4 + body.length;                      // "WEBP" + payload
  const whole = new Uint8Array([0x52, 0x49, 0x46, 0x46,
    len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF,
    0x57, 0x45, 0x42, 0x50, ...body]);
  check('a WEBP whose header matches its length passes', imageIntegrity(whole, null) === null,
        imageIntegrity(whole, null));
}

/* ---- AVIF / ISOBMFF ----
   AVIF is in the storage MIME allowlist and in the sweep's EXT map, but is
   neither JPEG, PNG, GIF nor RIFF — so before this it reached the final
   `return null` and was stored with no check at all, while the runbook said
   every download was verified. */
{
  const box = (type, payloadLen) => {
    const size = 8 + payloadLen;
    return [ (size >>> 24) & 0xFF, (size >>> 16) & 0xFF, (size >>> 8) & 0xFF, size & 0xFF,
             ...[...type].map(c => c.charCodeAt(0)), ...new Array(payloadLen).fill(0x00) ];
  };
  const whole = new Uint8Array([...box('ftyp', 16), ...box('meta', 32), ...box('mdat', 64)]);
  check('a whole AVIF passes', imageIntegrity(whole, null) === null, imageIntegrity(whole, null));

  // Cut inside the final mdat: the box still claims its full size.
  const cut = whole.subarray(0, whole.length - 30);
  check('an AVIF cut inside its last box is caught',
        /truncated AVIF/.test(imageIntegrity(new Uint8Array(cut), null) || ''),
        imageIntegrity(new Uint8Array(cut), null));

  // size === 0 means "runs to end of file", which is legal and complete.
  const openEnded = new Uint8Array([...box('ftyp', 16),
    0,0,0,0, ...[...'mdat'].map(c=>c.charCodeAt(0)), ...new Array(40).fill(0)]);
  check('an AVIF whose last box runs to EOF passes', imageIntegrity(openEnded, null) === null,
        imageIntegrity(openEnded, null));

  check('an impossible box size is caught',
        /impossible box size/.test(isobmffTruncated(new Uint8Array([0,0,0,3, 0x66,0x74,0x79,0x70, 0,0,0,0])) || ''));
}
{
  check('a file too small to be an image is caught',
    /too small/.test(imageIntegrity(new Uint8Array([0xFF, 0xD8, 0x00]), null) || ''));
}

/* ---- parseRecipeFilter ----
   The app now asks for one recipe rather than a whole sweep, and the id
   comes off the wire. This is the only part of the request handling that
   can be reached from Node, which is why it was put where it was. */
{
  const ID = '11111111-1111-4111-8111-111111111111';
  check('an absent recipeId means the whole sweep', parseRecipeFilter({}) === null);
  check('an empty recipeId means the whole sweep', parseRecipeFilter({ recipeId: '   ' }) === null);
  check('a valid uuid is returned', parseRecipeFilter({ recipeId: ID }) === ID);
  check('surrounding whitespace is tolerated', parseRecipeFilter({ recipeId: ` ${ID} ` }) === ID);
  /* Rejected here rather than handed to Postgres, which answers a bad uuid
     with an opaque 22P02 that tells the caller nothing useful. */
  let threw = false;
  try { parseRecipeFilter({ recipeId: 'not-a-uuid' }); } catch (e) { threw = /not a uuid/.test(e.message); }
  check('a malformed id is rejected, not passed to the database', threw);
  let threwInjection = false;
  try { parseRecipeFilter({ recipeId: `${ID}' or '1'='1` }); } catch (e) { threwInjection = true; }
  check('anything appended to a valid id is rejected too', threwInjection);
  check('a non-string recipeId is ignored rather than coerced',
        parseRecipeFilter({ recipeId: 12345 }) === null);
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
