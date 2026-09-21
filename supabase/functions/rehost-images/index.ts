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
 * would do without writing anything.
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

  let body: { dryRun?: boolean; limit?: number } = {};
  try { body = await req.json(); } catch { /* no body is fine — sweep everything */ }
  const dryRun = body.dryRun === true;
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

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error('empty response');
      if (bytes.byteLength > MAX_BYTES) throw new Error(`too large (${bytes.byteLength} bytes)`);

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
