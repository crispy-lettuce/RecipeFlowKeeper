/* Finds the candidate hero images for a recipe, and reports how big each
 * one actually is. Read-only — it never writes to a recipe or to storage.
 *
 * WHY THIS EXISTS: docs/IMAGES.md §3 says to replace a bad image by
 * getting "the real image address from the source page", which assumes a
 * person with a browser doing right-click → copy image address. That is
 * fine once and tedious at scale, and it cannot be done at all from a
 * sandbox with no outbound web access — which is where the library is
 * maintained from. The reprocess captured at least one lazy-load
 * placeholder (Tuscan Chicken Pasta, 10 KB against a 137 KB median), so
 * this is a recurring problem, not a one-off.
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
        if (cur.ok) currentBytes = (await cur.arrayBuffer()).byteLength;
      } catch { /* unreachable current image is itself worth seeing */ }
    }
  }

  let html: string;
  try {
    const res = await timedFetch(pageUrl, { headers: { Accept: 'text/html' } });
    if (!res.ok) return json({ error: `source page returned ${res.status}`, pageUrl }, 502);
    html = await res.text();
  } catch (e) {
    return json({ error: `could not fetch the page: ${String((e as Error).message ?? e)}`, pageUrl }, 502);
  }

  const candidates = extractCandidates(html, pageUrl);
  const measured = [];
  for (const c of candidates) {
    try {
      const res = await timedFetch(c.url, { headers: { Accept: 'image/*' } });
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!res.ok) { measured.push({ ...c, error: `returned ${res.status}` }); continue; }
      if (!ct.startsWith('image/')) { measured.push({ ...c, error: `not an image (${ct || 'no content-type'})` }); continue; }
      measured.push({ ...c, bytes: (await res.arrayBuffer()).byteLength, contentType: ct });
    } catch (e) {
      measured.push({ ...c, error: String((e as Error).message ?? e) });
    }
    await new Promise(r => setTimeout(r, 200));
  }

  measured.sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1));
  return json({
    title, pageUrl,
    currentImageBytes: currentBytes,
    hint: 'Pick a candidate, set it as the recipe IMAGE URL in the app, then run rehost-images.',
    candidates: measured,
  });
});
