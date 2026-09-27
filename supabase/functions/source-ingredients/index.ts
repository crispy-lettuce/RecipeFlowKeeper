/* Reads a recipe page's own ingredient list, for the app's source check.
 * Read-only — it never writes to a recipe or to storage.
 *
 * WHY THIS EXISTS: the converter once swapped Italian seasoning for dried
 * oregano on its first unfamiliar site, and nothing downstream could see it:
 * every check looked at the shape of a line, none at whether it still said
 * what the source said (docs/REVIEW-ARCHITECTURE-FINDINGS.md §2, §4). The
 * app's preview can only compare against the source if the source's list
 * reaches it, and a browser cannot read another site's page itself. This
 * reads it server-side and returns the strings, nothing more; the pairing
 * is sourceFidelity in core.js, where it is tested in Node.
 *
 * WHY JSON-LD AND NOT A MODEL: recipe pages carry a Schema.org Recipe block
 * for search engines, with `recipeIngredient` as plain strings. Reading it is
 * deterministic, costs nothing, and is independent of the converter, which is
 * the whole point of a check on the converter. A page without one gets a
 * plain "no list found", and the household compares by eye.
 *
 *   await sb.functions.invoke('source-ingredients', { body: { pageUrl } });
 *   await sb.functions.invoke('source-ingredients', { body: { recipeId } });
 *
 * Added 28 Sep 2026, PR 6c-1.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const UA = 'Mozilla/5.0 (compatible; KitchenApp/1.0; +https://github.com/crispy-lettuce/RecipeFlowKeeper)';
const FETCH_TIMEOUT_MS = 20_000;
const MAX_PAGE_BYTES = 5_000_000;
const MAX_REDIRECTS = 4;

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

type Found = { name: string; ingredients: string[] };

/* ---- pure: lifted and tested by test/source-ingredients.js ---- */

/* Only a public web page. This function fetches whatever address it is
   given, from inside Supabase's network, so it refuses the addresses that
   would make it a way in: anything but https, a bare IP address, and the
   local names. Checked again on every redirect, because a public page can
   redirect anywhere. */
function safePageUrl(raw: unknown): string | null {
  let u: URL;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || /^\[|^[\d.]+$/.test(host) || host.includes(':')) return null;
  if (/(^|\.)(localhost|local|internal|localdomain|home|lan|supabase\.co|supabase\.in)$/.test(host)) return null;
  return u.toString();
}

/* The entities recipe sites actually put in ingredient strings: fractions
   and quotes mostly. Anything else numeric is decoded by number. */
const NAMED_ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', frac12: '½', frac14: '¼',
  frac34: '¾', frac13: '⅓', frac23: '⅔', frac18: '⅛', deg: '°', times: '×', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', egrave: 'è', ecirc: 'ê', icirc: 'î', ccedil: 'ç' };
function decodeEntities(s: string): string {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+\d*);/gi, (m, n) => NAMED_ENTITIES[n.toLowerCase()] ?? m);
}
function cleanIngredient(s: unknown): string {
  return decodeEntities(decodeEntities(String(s)).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/* The first Schema.org Recipe on the page that lists its ingredients. The
   block's shape varies by site — a bare Recipe, an array, or a Yoast-style
   "@graph" holding the Recipe among other things — so this walks whatever
   it finds rather than assuming one. `recipeIngredient` is the current
   property; `ingredients` is the older one some sites still use. Regex
   rather than a DOM parser, as find-recipe-image does: one script tag
   does not justify the dependency, and a malformed page should yield
   nothing rather than throw. */
function extractRecipeIngredients(html: string): Found | null {
  const isRecipe = (t: unknown): boolean => (Array.isArray(t) ? t : [t]).some((x: unknown) => String(x).toLowerCase() === 'recipe');
  let found: Found | null = null;
  // deno-lint-ignore no-explicit-any
  const walk = (node: any): void => {
    if (found || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (isRecipe(node['@type'])) {
      const list = node.recipeIngredient ?? node.ingredients;
      const items = (Array.isArray(list) ? list : (typeof list === 'string' ? [list] : []))
        .map(cleanIngredient).filter(Boolean);
      if (items.length) { found = { name: cleanIngredient(node.name ?? ''), ingredients: items }; return; }
    }
    Object.values(node).forEach(walk);
  };
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* one bad block shouldn't lose the others */ }
    if (found) break;
  }
  return found;
}

/* ---- end pure ---- */

const timedFetch = (url: string) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctl.signal, redirect: 'manual' })
    .finally(() => clearTimeout(timer));
};

/* Follows redirects by hand, so each hop is checked like the first. */
async function fetchPage(start: string): Promise<{ html?: string; finalUrl?: string; error?: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await timedFetch(url);
    if (res.status >= 300 && res.status < 400) {
      const next = safePageUrl(new URL(res.headers.get('location') ?? '', url).toString());
      if (!next) return { error: 'the page redirected somewhere this check will not follow' };
      url = next;
      continue;
    }
    if (!res.ok) return { error: `the source page returned ${res.status}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_PAGE_BYTES) return { error: 'the source page is too large to read' };
    return { html: new TextDecoder().decode(buf), finalUrl: url };
  }
  return { error: 'too many redirects' };
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

  let body: { pageUrl?: string; recipeId?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }

  let pageUrl = body.pageUrl ?? '';
  if (!pageUrl && body.recipeId) {
    /* A recipe by id: only one in the caller's own household. */
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: hh } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
    const ids = (hh ?? []).map(h => h.household_id);
    const { data: rows } = await admin.from('recipes').select('title, syntax').in('household_id', ids).eq('id', body.recipeId).limit(1);
    const r = rows?.[0];
    if (!r) return json({ error: 'No such recipe in your household' }, 404);
    pageUrl = (r.syntax?.match(/^SOURCE_URL:\s*(.*)$/m)?.[1] ?? '').trim();
    if (!pageUrl) return json({ error: `"${r.title}" has no SOURCE_URL to read` });
  }
  if (!pageUrl) return json({ error: 'Give a pageUrl or a recipeId' }, 400);

  /* Errors about the page come back as 200 with an `error` field, as in
     find-recipe-image: supabase-js hides a non-2xx body in error.context,
     and the preview reads `data`. */
  const safe = safePageUrl(pageUrl);
  if (!safe) return json({ error: 'That address is not a public https page', pageUrl });
  let page;
  try { page = await fetchPage(safe); }
  catch (e) { return json({ error: `could not fetch the page: ${String((e as Error).message ?? e)}`, pageUrl }); }
  if (page.error) return json({ error: page.error, pageUrl });

  const recipe = extractRecipeIngredients(page.html!);
  if (!recipe) return json({ error: 'the page carries no Schema.org recipe with an ingredient list', pageUrl: page.finalUrl, ingredients: [] });
  return json({ pageUrl: page.finalUrl, name: recipe.name, ingredients: recipe.ingredients });
});
