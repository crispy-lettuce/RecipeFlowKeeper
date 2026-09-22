/* Re-hosts recipe images into Supabase Storage (R7).
 *
 * WHY SERVER-SIDE: most recipe-site CDNs (Sanity, Cloudinary, WordPress,
 * immediate.co.uk) send no permissive CORS headers, so a browser cannot
 * read the bytes. An Edge Function has its own egress and no CORS rules
 * apply to it, which is the whole reason this isn't done in the app.
 *
 * WHY A SWEEP, NOT THE SAVE PATH: recipes save with whatever image_url
 * they arrive with, and this walks the table separately. That treats the
 * existing library and every future recipe identically with no
 * special-casing, and it keeps "did my recipe save" from depending on a
 * third party's server answering.
 *
 * WHY A PUBLIC BUCKET: the alternative, signed URLs, expires. image_url
 * is written verbatim into the app's JSON export AND into the nightly
 * pg_dump, so a signed URL would rot inside the backups — restore one
 * months later and every image is dead. The photos are scraped from
 * public recipe pages and are not sensitive; paths are keyed by record
 * UUID, so they aren't guessable. A correctness argument, not a
 * convenience one.
 *
 * Idempotent: anything already pointing at our own storage is skipped, so
 * re-running is safe and cheap. Call with {"dryRun": true} to see what it
 * would do without writing anything, or {"verify": true} to re-read what
 * is already stored and check every file is whole.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'recipe-images';
const MAX_BYTES = 10 * 1024 * 1024;   // a hero photo far exceeding this is a wrong URL, not a big picture
const FETCH_TIMEOUT_MS = 20_000;
const POLITE_DELAY_MS = 250;          // these are someone else's servers; don't hammer them

/* Several CDNs answer a bare Deno fetch with 403 and a real browser UA
   with 200. Sending one is the difference between this working on
   kitchensanctuary.com and not. */
const UA = 'Mozilla/5.0 (compatible; KitchenApp/1.0; +https://github.com/crispy-lettuce/RecipeFlowKeeper)';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
};

/* Width and height out of a JPEG's SOF segment.
 *
 * Walks the marker chain rather than scanning for a byte pattern, because
 * FFC0 occurs inside compressed data often enough that a naive search
 * finds garbage. Returns null rather than throwing on anything malformed —
 * a file we cannot measure is not thereby a file we can condemn. */
function jpegDimensions(bytes: Uint8Array): { w: number; h: number } | null {
  const n = bytes.byteLength;
  let i = 2; // past SOI
  while (i + 3 < n) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    let m = bytes[i + 1];
    while (m === 0xFF && i + 2 < n) { i++; m = bytes[i + 1]; } // fill bytes are legal
    // Standalone markers carry no length payload.
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD8)) { i += 2; continue; }
    // Start of scan or end of image: no SOF is coming.
    if (m === 0xDA || m === 0xD9) return null;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) return null;
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      if (i + 8 >= n) return null;
      const h = (bytes[i + 5] << 8) | bytes[i + 6];
      const w = (bytes[i + 7] << 8) | bytes[i + 8];
      return (w > 0 && h > 0) ? { w, h } : null;
    }
    i += 2 + len;
  }
  return null;
}

/* Below this, a JPEG claiming to be a photograph is not carrying one.
 *
 * Measured, not guessed. A verify sweep of all 29 images on 22 Sep put the
 * 27 whole ones between 0.087 and 0.385 bytes/pixel, and Tuscan Chicken
 * Pasta — the one rendering grey below the top rows — at 0.011 against its
 * declared 1200x800. So 0.02 sits about 4x below the leanest real photo in
 * the library and about 2x above the broken one: clear of both, and not
 * finely balanced between them.
 *
 * Verify mode reports the measured figure for every image, including the
 * ones that pass, so this number stays arguable from evidence. If a real
 * photo ever trips it, that table is what shows the threshold is wrong
 * rather than the photo. */
const MIN_BYTES_PER_PIXEL = 0.02;

/* Is this actually a complete image file?
 *
 * Added 22 Sep after Tuscan Chicken Pasta rendered as a photo on top and
 * grey below — the signature of a JPEG whose scanlines stop early. It had
 * been stored, and passed verification, because the check at the time
 * compared the stored byte count against the dry run's byte count. Both
 * fetches returned exactly 10,515 bytes, so they agreed with each other
 * and were both incomplete. Agreement between two reads of the same bad
 * source says nothing about integrity.
 *
 * Two independent checks, because they catch different faults:
 *
 *   Content-Length vs what arrived catches a transfer that died mid-flight
 *   — the server promised more than it sent.
 *
 *   The format's own end marker catches a file that is corrupt at source,
 *   where Content-Length agrees with the bytes because the server is
 *   faithfully serving a broken file. That is this case.
 */
function imageIntegrity(bytes: Uint8Array, contentLength: number | null): string | null {
  if (contentLength !== null && contentLength !== bytes.byteLength) {
    return `transfer truncated: server declared ${contentLength} bytes, got ${bytes.byteLength}`;
  }
  const n = bytes.byteLength;
  if (n < 12) return 'file too small to be an image';
  const at = (i: number) => bytes[i];

  // JPEG: SOI FFD8 ... EOI FFD9. Trailing NULs after EOI are legal and common.
  if (at(0) === 0xFF && at(1) === 0xD8) {
    let e = n - 1;
    while (e > 1 && at(e) === 0x00) e--;
    if (!(at(e - 1) === 0xFF && at(e) === 0xD9)) return 'truncated JPEG: no end-of-image marker';
    /* An end marker proves the file was terminated, not that it is full.
       Tuscan Chicken Pasta had FFD9 and still rendered grey below the top
       rows: the marker chain was intact and the entropy-coded scan data
       ran out early, which a decoder fills with mid-grey. Density is what
       separates that from a whole photo. */
    const dim = jpegDimensions(bytes);
    if (dim) {
      const bpp = n / (dim.w * dim.h);
      if (bpp < MIN_BYTES_PER_PIXEL) {
        return `JPEG ends correctly but carries too little image data: ${dim.w}x${dim.h} in ${n} bytes `
             + `(${bpp.toFixed(4)} bytes/pixel, under ${MIN_BYTES_PER_PIXEL}) — decodes to grey below the top rows`;
      }
    }
    return null;
  }
  // PNG: 8-byte signature, and an IEND chunk to finish.
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4E && at(3) === 0x47) {
    const tail = bytes.subarray(Math.max(0, n - 12));
    const hasIend = Array.from(tail).some((_, i) =>
      tail[i] === 0x49 && tail[i + 1] === 0x45 && tail[i + 2] === 0x4E && tail[i + 3] === 0x44);
    if (!hasIend) return 'truncated PNG: no IEND chunk';
    return null;
  }
  // GIF: ends with the 0x3B trailer.
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) {
    if (at(n - 1) !== 0x3B) return 'truncated GIF: no trailer byte';
    return null;
  }
  // WEBP/AVIF declare their own length in the container header.
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46) {
    const riff = at(4) | (at(5) << 8) | (at(6) << 16) | (at(7) << 24);
    if (riff + 8 > n) return `truncated WEBP: header declares ${riff + 8} bytes, got ${n}`;
    return null;
  }
  /* AVIF and anything else: no cheap end-marker check. Saying so beats
     implying a clean bill of health we did not earn. */
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* CORS. The app calls this from the browser, cross-origin — the page is on
   github.io and the function is on supabase.co — so without a preflight
   handler every call dies before reaching any of the code below, with a
   message about a missing Access-Control-Allow-Origin header.

   An allowlist rather than '*': this function holds the service-role key
   and rewrites rows, so there is no reason for an arbitrary origin to get
   a usable response, even though verify_jwt already means a caller needs
   a real token. An origin that isn't recognised gets no CORS headers and
   the browser blocks it, which is the intended answer. */
const ALLOWED_ORIGIN = /^https:\/\/crispy-lettuce\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  if (!ALLOWED_ORIGIN.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  /* The preflight carries no Authorization header by design, so it has to
     be answered before any auth check. */
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload, null, 2), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  /* The caller's token decides WHICH household is swept; the service key
     does the storage write, because a public bucket still needs a policy
     to write to and there is no reason to grant the browser one. */
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(url, serviceKey);

  let body: { dryRun?: boolean; limit?: number; verify?: boolean } = {};
  try { body = await req.json(); } catch { /* no body is fine — sweep everything */ }
  const dryRun = body.dryRun === true;
  const verify = body.verify === true;
  const limit = typeof body.limit === 'number' ? body.limit : 500;

  const { data: households, error: hErr } = await admin
    .from('household_members').select('household_id').eq('user_id', user.id);
  if (hErr || !households?.length) return json({ error: 'No household for this user' }, 403);
  const householdIds = households.map(h => h.household_id);

  const { data: recipes, error: rErr } = await admin
    .from('recipes').select('id, household_id, title, image_url, syntax')
    .in('household_id', householdIds)
    .not('image_url', 'is', null)
    .limit(limit);
  if (rErr) return json({ error: rErr.message }, 500);

  const selfHost = `${url}/storage/v1/object/public/${BUCKET}/`;
  const report: Array<Record<string, unknown>> = [];
  let rehosted = 0, skipped = 0, failed = 0;

  /* {"verify": true} inverts the sweep: instead of re-hosting what is still
     external, it re-reads what we have already stored and checks that each
     file is whole.

     WHY THIS IS A SEPARATE MODE. The sweep skips anything self-hosted, which
     is what makes it idempotent and cheap — and also means it can never
     notice that something it stored months ago is broken. Tuscan Chicken
     Pasta was stored truncated and stayed that way until a person looked at
     a card. The integrity check on the way in stops new ones; this is how
     you ask whether the existing library has others. Read-only. */
  if (verify) {
    let whole = 0;
    const broken: Array<Record<string, unknown>> = [];
    /* Every image's measurements, not just the failures. The density
       threshold is a judgement call, and a judgement call you cannot see
       the distribution behind is just a magic number — this is what makes
       it arguable from evidence. */
    const all: Array<Record<string, unknown>> = [];
    for (const r of recipes ?? []) {
      const src = (r.image_url ?? '').trim();
      if (!src.startsWith(selfHost)) {
        const row = { title: r.title, problem: 'not self-hosted', image_url: src || null };
        broken.push(row); all.push({ title: r.title, ok: false, problem: row.problem });
        continue;
      }
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(src, { headers: { 'Accept': 'image/*' }, signal: ctl.signal, redirect: 'follow' })
          .finally(() => clearTimeout(timer));
        if (!res.ok) {
          const problem = `stored object returned ${res.status}`;
          broken.push({ title: r.title, problem, image_url: src });
          all.push({ title: r.title, ok: false, problem });
          continue;
        }
        const declared = res.headers.get('content-length');
        const bytes = new Uint8Array(await res.arrayBuffer());
        const problem = imageIntegrity(bytes, declared === null ? null : parseInt(declared, 10));
        const dim = jpegDimensions(bytes);
        const bpp = dim ? bytes.byteLength / (dim.w * dim.h) : null;
        all.push({
          title: r.title,
          kb: Math.round(bytes.byteLength / 1024),
          pixels: dim ? `${dim.w}x${dim.h}` : null,
          bytesPerPixel: bpp === null ? null : Number(bpp.toFixed(4)),
          ok: !problem,
          problem: problem ?? undefined,
        });
        if (problem) broken.push({ title: r.title, problem, bytes: bytes.byteLength, image_url: src });
        else whole++;
      } catch (e) {
        const problem = String((e as Error).message ?? e);
        broken.push({ title: r.title, problem, image_url: src });
        all.push({ title: r.title, ok: false, problem });
      }
    }
    return json({ verify: true, checked: recipes?.length ?? 0, whole, broken: broken.length, report: broken, all });
  }

  for (const r of recipes ?? []) {
    const src = (r.image_url ?? '').trim();
    if (!src) { skipped++; report.push({ title: r.title, outcome: 'skipped', why: 'no image_url' }); continue; }
    if (src.startsWith(selfHost)) { skipped++; report.push({ title: r.title, outcome: 'skipped', why: 'already self-hosted' }); continue; }

    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(src, { headers: { 'User-Agent': UA, 'Accept': 'image/*' }, signal: ctl.signal, redirect: 'follow' });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`source returned ${res.status}`);
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const ext = EXT[ct];
      /* Refuse anything that isn't a recognised image rather than storing
         it and finding out later. An HTML error page served with 200 is
         the common case this catches. */
      if (!ext) throw new Error(`not an image (content-type: ${ct || 'none'})`);

      const declared = res.headers.get('content-length');
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error('empty response');
      if (bytes.byteLength > MAX_BYTES) throw new Error(`too large (${bytes.byteLength} bytes)`);
      /* Refuse a broken file rather than store it. A truncated photo looks
         fine in a byte count and wrong in the kitchen. */
      const broken = imageIntegrity(bytes, declared === null ? null : parseInt(declared, 10));
      if (broken) throw new Error(broken);

      const path = `${r.household_id}/${r.id}.${ext}`;
      /* The stored path is stable per recipe, so replacing a photo
         overwrites the same object at the same URL — and these are served
         with max-age=31536000, so every browser that already cached it
         would go on showing the OLD picture for a year. The version token
         changes the URL without changing the path, which busts the cache
         while keeping the long max-age that makes the common case fast.
         `startsWith(selfHost)` still recognises it, so re-runs still skip. */
      const publicUrl = `${selfHost}${path}?v=${Math.floor(Date.now() / 1000)}`;

      if (dryRun) {
        rehosted++;
        report.push({ title: r.title, outcome: 'would rehost', bytes: bytes.byteLength, contentType: ct, to: publicUrl });
      } else {
        /* upsert so a re-run replaces rather than erroring, which makes
           this safe to run repeatedly after a partial failure. */
        const { error: upErr } = await admin.storage.from(BUCKET)
          .upload(path, bytes, { contentType: ct, upsert: true, cacheControl: '31536000' });
        if (upErr) throw new Error(`upload failed: ${upErr.message}`);

        /* A replacement photo in a different format lands at a different
           extension, leaving the old file orphaned and paying for storage
           forever. One call, and paths that don't exist are ignored. */
        const stale = Object.values(EXT)
          .filter((e, i, a) => a.indexOf(e) === i && e !== ext)
          .map(e => `${r.household_id}/${r.id}.${e}`);
        await admin.storage.from(BUCKET).remove(stale).catch(() => {});

        /* The syntax's own IMAGE: line has to move with the column.
           docs/ARCHITECTURE.md §2: the recipe text is the source of truth,
           and the app re-derives the form from it — parseAndPreview()
           repopulates the image field from a parse, so leaving the old CDN
           URL in the text means re-parsing a recipe silently reverts it to
           the external image. Divergence here is not cosmetic.

           The original source is not lost: SOURCE_URL: still records the
           page the photo came from, which is where you would go to find a
           better one. */
        const newSyntax = /^IMAGE:.*$/m.test(r.syntax ?? '')
          ? (r.syntax as string).replace(/^IMAGE:.*$/m, `IMAGE: ${publicUrl}`)
          : r.syntax;

        const { error: updErr } = await admin.from('recipes')
          .update({ image_url: publicUrl, syntax: newSyntax, updated_at: new Date().toISOString() })
          .eq('id', r.id);
        /* The column is only rewritten once the bytes are safely stored,
           so a failure here leaves the recipe pointing at a source that
           still works rather than at a file that may not exist. */
        if (updErr) throw new Error(`stored, but column not updated: ${updErr.message}`);

        rehosted++;
        report.push({ title: r.title, outcome: 'rehosted', bytes: bytes.byteLength, contentType: ct, from: src, to: publicUrl });
      }
    } catch (e) {
      failed++;
      report.push({ title: r.title, outcome: 'failed', from: src, why: String((e as Error).message ?? e) });
    }

    await sleep(POLITE_DELAY_MS);
  }

  return json({ dryRun, considered: recipes?.length ?? 0, rehosted, skipped, failed, report });
});
