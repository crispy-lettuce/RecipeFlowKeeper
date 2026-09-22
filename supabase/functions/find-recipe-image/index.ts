/* Finds the candidate hero images for a recipe, and reports how big each
 * one actually is. Read-only — it never writes to a recipe or to storage.
 *
 * WHY THIS EXISTS: docs/IMAGES.md §3 says to replace a bad image by
 * getting "the real image address from the source page", which assumes a
 * person with a browser doing right-click → copy image address. That is
 * fine once and tedious at scale, and it cannot be done at all from a
 * sandbox with no outbound web access — which is where the library is
 * maintained from. The reprocess captured at least one broken image
 * (Tuscan Chicken Pasta, 10 KB against a 137 KB median), so this is a
 * recurring problem, not a one-off.
 *
 * WHY IT REPORTS SIZES RATHER THAN PICKING: a page offers several images
 * and the biggest is usually but not always the hero. Guessing is exactly
 * what this project's conventions forbid, so it ranks candidates and lets
 * a human choose. Pair it with rehost-images: set the chosen URL on the
 * recipe, then sweep.
 *
 *   await sb.functions.invoke('find-recipe-image', {
 *     body: { title: 'Tuscan Chicken Pasta' }
 *   });
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const UA = 'Mozilla/5.0 (compatible; KitchenApp/1.0; +https://github.com/crispy-lettuce/RecipeFlowKeeper)';
const FETCH_TIMEOUT_MS = 20_000;
const MAX_CANDIDATES = 12;

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
 * Web-optimised recipe photos in this library sit around 0.05-0.30
 * bytes/pixel. Tuscan Chicken Pasta was 0.006-0.02 depending on how you
 * read its dimensions — one to two orders of magnitude short. The
 * threshold is deliberately far below anything a real photo reaches, so
 * it flags the unmistakable cases and stays quiet otherwise; the verify
 * mode reports the measured figure for every image so this number can be
 * argued with from evidence rather than taken on faith. */
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

const timedFetch = (url: string, init: RequestInit = {}) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, signal: ctl.signal, redirect: 'follow' })
    .finally(() => clearTimeout(timer));
};

/* Pulls every plausible hero image out of a recipe page, in the order the
   conversion instructions say to prefer them: og:image first, then
   schema.org Recipe, then anything else. Deliberately regex rather than a
   DOM parser — one meta tag and one JSON blob do not justify the
   dependency, and a malformed page should yield nothing rather than
   throw. */
function extractCandidates(html: string, pageUrl: string): Array<{ url: string; source: string }> {
  const out: Array<{ url: string; source: string }> = [];
  const push = (raw: string | undefined, source: string) => {
    if (!raw) return;
    try {
      const abs = new URL(raw.trim().replace(/&amp;/g, '&'), pageUrl).toString();
      if (!/^https?:/.test(abs)) return;
      if (!out.some(c => c.url === abs)) out.push({ url: abs, source });
    } catch { /* an unparseable URL is just not a candidate */ }
  };

  for (const m of html.matchAll(/<meta[^>]+property=["']og:image(?::url)?["'][^>]*>/gi)) {
    push(m[0].match(/content=["']([^"']+)["']/i)?.[1], 'og:image');
  }
  for (const m of html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]*>/gi)) {
    push(m[0].match(/content=["']([^"']+)["']/i)?.[1], 'twitter:image');
  }

  /* schema.org Recipe. The image field is maddeningly polymorphic — a
     string, an array of strings, an ImageObject, or an array of those —
     so this walks whatever it finds rather than assuming a shape. */
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (node: unknown): void => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node === 'object') {
          const o = node as Record<string, unknown>;
          if (o.image) {
            const img = o.image;
            if (typeof img === 'string') push(img, 'schema.org');
            else if (Array.isArray(img)) img.forEach(i => push(typeof i === 'string' ? i : (i as Record<string, string>)?.url, 'schema.org'));
            else if (typeof img === 'object') push((img as Record<string, string>).url, 'schema.org');
          }
          Object.values(o).forEach(walk);
        }
      };
      walk(JSON.parse(m[1].trim()));
    } catch { /* one bad block shouldn't lose the others */ }
  }
  return out.slice(0, MAX_CANDIDATES);
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (p: unknown, status = 200) =>
    new Response(JSON.stringify(p, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { title?: string; recipeId?: string; pageUrl?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }

  let pageUrl = body.pageUrl;
  let title = body.title;
  let currentBytes: number | null = null;
  let currentProblem: string | null = null;

  if (!pageUrl) {
    if (!body.title && !body.recipeId) return json({ error: 'Give a title, a recipeId, or a pageUrl' }, 400);
    const { data: hh } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
    const ids = (hh ?? []).map(h => h.household_id);
    let q = admin.from('recipes').select('id, title, syntax, image_url').in('household_id', ids);
    q = body.recipeId ? q.eq('id', body.recipeId) : q.eq('title', body.title!);
    const { data: rows } = await q.limit(1);
    const r = rows?.[0];
    if (!r) return json({ error: 'No such recipe in your household' }, 404);
    title = r.title;
    pageUrl = (r.syntax?.match(/^SOURCE_URL:\s*(.*)$/m)?.[1] ?? '').trim();
    if (!pageUrl) return json({ error: `"${r.title}" has no SOURCE_URL to look at`, currentImage: r.image_url }, 400);
    /* What the recipe has now, measured the same way as the candidates,
       so the comparison is like for like rather than against a number
       remembered from a previous run. */
    if (r.image_url) {
      try {
        const cur = await timedFetch(r.image_url);
        if (cur.ok) {
          const declared = cur.headers.get('content-length');
          const buf = new Uint8Array(await cur.arrayBuffer());
          currentBytes = buf.byteLength;
          currentProblem = imageIntegrity(buf, declared === null ? null : parseInt(declared, 10));
        }
      } catch { /* unreachable current image is itself worth seeing */ }
    }
  }

  /* A failure to reach the source page used to come back as a bare 502,
     which supabase-js surfaces in the browser as `data: null` and an
     opaque FunctionsHttpError — the caller then has to dig the body out
     of error.context to learn anything. Answering 200 with an `error`
     field keeps the diagnosis in `data`, where it is actually read. */
  let html: string;
  try {
    const res = await timedFetch(pageUrl, { headers: { Accept: 'text/html' } });
    if (!res.ok) {
      return json({ error: `source page returned ${res.status}`, title, pageUrl,
                    currentImageBytes: currentBytes, currentImageProblem: currentProblem,
                    hint: 'The site refused us. Get the image address by hand in a browser (docs/IMAGES.md §3).' });
    }
    html = await res.text();
  } catch (e) {
    return json({ error: `could not fetch the page: ${String((e as Error).message ?? e)}`, title, pageUrl,
                  currentImageBytes: currentBytes, currentImageProblem: currentProblem,
                  hint: 'The site refused us. Get the image address by hand in a browser (docs/IMAGES.md §3).' });
  }

  const candidates = extractCandidates(html, pageUrl);
  const measured = [];
  for (const c of candidates) {
    try {
      const res = await timedFetch(c.url, { headers: { Accept: 'image/*' } });
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!res.ok) { measured.push({ ...c, error: `returned ${res.status}` }); continue; }
      if (!ct.startsWith('image/')) { measured.push({ ...c, error: `not an image (${ct || 'no content-type'})` }); continue; }
      const declared = res.headers.get('content-length');
      const buf = new Uint8Array(await res.arrayBuffer());
      /* Report integrity alongside size, so a candidate isn't chosen for
         being the biggest when it is the biggest broken one. */
      const broken = imageIntegrity(buf, declared === null ? null : parseInt(declared, 10));
      const dim = jpegDimensions(buf);
      measured.push({ ...c, bytes: buf.byteLength, contentType: ct,
                      pixels: dim ? `${dim.w}x${dim.h}` : undefined,
                      ok: !broken, problem: broken ?? undefined });
    } catch (e) {
      measured.push({ ...c, error: String((e as Error).message ?? e) });
    }
    await new Promise(r => setTimeout(r, 200));
  }

  measured.sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1));
  return json({
    title, pageUrl,
    currentImageBytes: currentBytes,
    currentImageProblem: currentProblem,
    hint: 'Pick a candidate reporting ok: true, set it as the recipe IMAGE URL in the app, then run rehost-images.',
    candidates: measured,
  });
});
