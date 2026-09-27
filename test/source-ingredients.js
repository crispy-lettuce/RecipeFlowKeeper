/* Tests the source-ingredients Edge Function's page reading, and the
 * source check in core.js that it feeds.
 *
 * Like image-integrity.js, this lifts the code out of the real function
 * source rather than keeping a copy, so a copy cannot drift and pass while
 * the deployed function fails. The lifted section is the one between the
 * "pure" markers in supabase/functions/source-ingredients/index.ts; its
 * type annotations are stripped, which is all that stands between that
 * Deno module and plain Node. If a function goes missing, this throws
 * rather than passing vacuously.
 *
 * Every page here is made up. No real site is fetched: this proves what
 * the function makes of a page, not that any real site carries one — the
 * household's first run after deploying is that (docs/NEXT-SESSION.md, 6c-1).
 *
 *   node test/source-ingredients.js
 *
 * Added 28 Sep 2026, PR 6c-1. */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'source-ingredients', 'index.ts');

function load(){
  const src = fs.readFileSync(SRC, 'utf8');
  const from = src.indexOf('/* ---- pure: lifted');
  const to = src.indexOf('/* ---- end pure ---- */');
  if(from < 0 || to < from) throw new Error('could not find the pure section in ' + SRC);
  const js = src.slice(from, to)
    // function f(a: T, b: U): R {   ->   function f(a, b) {
    .replace(/function\s+(\w+)\s*\(([^)]*)\)[^\n{]*\{\s*$/gm,
      (_, name, args) => `function ${name}(${args.split(',').map(a => a.split(':')[0].trim()).filter(Boolean).join(', ')}) {`)
    // (a: T): R =>   and   (a: T) =>
    .replace(/\(([\w$]+)\s*:\s*[^()]*?\)\s*(:\s*[\w<>|\[\] ]+)?\s*=>/g, '($1) =>')
    // const X: T = …   and   let x: T = …   and   let x: T;
    .replace(/\b(const|let)\s+([\w$]+)\s*:\s*[^=;\n]+(\s*[=;])/g, '$1 $2$3');
  const out = new Function(js + '\nreturn { safePageUrl, decodeEntities, cleanIngredient, extractRecipeIngredients };')();
  for(const name of ['safePageUrl', 'decodeEntities', 'cleanIngredient', 'extractRecipeIngredients']){
    if(typeof out[name] !== 'function') throw new Error(`${name} missing from ${SRC} — checks would be vacuous`);
  }
  return out;
}

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined && !pass ? '  (' + detail + ')' : ''}`);
};

const fn = load();
globalThis.PALETTE = ['#111']; globalThis.MERGE_COLOR = '#999';
const core = require(path.join(__dirname, '..', 'core.js'));

/* ---- Which addresses it will fetch ---- */
check('a public https page is allowed', fn.safePageUrl('https://www.example-recipes.co.uk/cake') === 'https://www.example-recipes.co.uk/cake');
const refused = ['http://www.example.com/cake', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://10.0.0.5/x',
  'https://intranet/x', 'https://printer.local/x', 'https://abc.supabase.co/rest/v1/recipes', 'https://user:pw@example.com/x',
  'file:///etc/passwd', 'javascript:alert(1)', '', null];
const let_in = refused.filter(u => fn.safePageUrl(u) !== null);
check('and nothing that would reach inside a network: http, IPs, local names, Supabase itself, credentials', let_in.length === 0, let_in.join(', '));

/* ---- Reading the page ---- */
const page = (...blocks) => `<html><head><title>x</title>${blocks.map(b => `<script type="application/ld+json">${typeof b === 'string' ? b : JSON.stringify(b)}</script>`).join('')}</head><body>…</body></html>`;
const plain = fn.extractRecipeIngredients(page({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Made-up Cake',
  recipeIngredient: ['200 g self-raising flour', '2 eggs'] }));
check('a plain Recipe block gives its name and ingredients', plain && plain.name === 'Made-up Cake' && plain.ingredients.join('|') === '200 g self-raising flour|2 eggs', JSON.stringify(plain));
const graph = fn.extractRecipeIngredients(page({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebPage', name: 'Page' }, { '@type': 'Person', name: 'A Cook' },
  { '@type': ['Recipe', 'NewsArticle'], name: 'Graph Stew', recipeIngredient: ['1 onion'] }] }));
check('one inside a Yoast-style @graph, typed as a list, is found', graph && graph.name === 'Graph Stew' && graph.ingredients[0] === '1 onion', JSON.stringify(graph));
const older = fn.extractRecipeIngredients(page({ '@type': 'Recipe', name: 'Old Site', ingredients: ['1 lemon'] }));
check('the older "ingredients" property is read too', older && older.ingredients[0] === '1 lemon', JSON.stringify(older));
const messy = fn.extractRecipeIngredients(page('{ this is not json', { '@type': 'Recipe', name: 'Second Block',
  recipeIngredient: ['1&frac12; tsp <b>ground</b> cumin', '100&nbsp;g cr&egrave;me fra&icirc;che', 'salt &amp; pepper', '2 tbsp chef&#39;s oil', '  '] }));
check('a broken block does not lose the next one', messy && messy.name === 'Second Block');
check('entities and tags are cleaned, blanks dropped',
      messy && messy.ingredients.join('|') === '1½ tsp ground cumin|100 g crème fraîche|salt & pepper|2 tbsp chef\'s oil', messy && messy.ingredients.join('|'));
check('a page with no recipe gives nothing, not an error', fn.extractRecipeIngredients('<html><body>no data</body></html>') === null
      && fn.extractRecipeIngredients(page({ '@type': 'Recipe', name: 'Empty', recipeIngredient: [] })) === null);

/* ---- The check it feeds (core.js) ---- */
const f = core.sourceFidelity(
  ['1 tsp Italian seasoning', '2 cups all-purpose flour', '1/2 cup heavy cream', '1 bunch cilantro, chopped', 'salt and pepper'],
  ['1 tsp dried oregano', '250 g plain flour', '120 ml double cream', '1 bunch fresh coriander, chopped', 'salt, to taste', 'black pepper, to taste']);
check('a swapped ingredient shows on both sides: the Italian seasoning case',
      f.sourceOnly.join('|') === '1 tsp Italian seasoning' && f.recipeOnly.join('|') === '1 tsp dried oregano', JSON.stringify(f));
check('American names made British still pair up, through the dictionary',
      ['all-purpose flour', 'heavy cream', 'cilantro'].every(w => f.matched.some(m => m.source.includes(w))), JSON.stringify(f.matched));
check('one source line written as two recipe lines is not a miss', f.matched.filter(m => m.source === 'salt and pepper').length === 2, JSON.stringify(f.matched));
const dropped = core.sourceFidelity(['2 eggs', '100 g sugar', '1 tsp vanilla extract'], ['2 eggs', '100 g caster sugar']);
check('a line left out shows on the source side only', dropped.sourceOnly.join('|') === '1 tsp vanilla extract' && !dropped.recipeOnly.length, JSON.stringify(dropped));

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
