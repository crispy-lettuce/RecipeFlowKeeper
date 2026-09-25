/* The pure core, tested in Node: no browser, no build, milliseconds.

     node test/core.test.js

   Two kinds of check. The first half keeps the split between core.js and
   index.html honest, because a split that drifts is worse than none: a
   function defined in both files runs whichever the page happens to load
   last, and a core.js that reached into the page could no longer run here.
   The second half pins the behaviour the app relies on, with made-up lines,
   the same claims the smoke suite makes through the browser — so the
   shopping-list release (PR 6b) can be written against these in seconds.

   Added 25 Sep 2026 with core.js (PR 6a). Prints as it goes, like smoke.js,
   and exits 1 on any failure. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* computeColumns reads the flow table's colours from the page at call time
   (they follow the theme). Stand them in before anything is called. */
globalThis.PALETTE = ['#111', '#222', '#333'];
globalThis.MERGE_COLOR = '#999';
const core = require(path.join(ROOT, 'core.js'));

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined && !pass ? '  (' + detail + ')' : ''}`);
};

const coreSrc = fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/* Comments are prose and may name anything; only the code is checked. */
const code = coreSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

/* ---- The split ---- */
const touches = (code.match(/\b(document|window|localStorage|sessionStorage|navigator|cache|state|sb)\s*\./g) || []);
check('core.js touches no page state (document, window, cache, state, sb, storage)', touches.length === 0, touches.join(', '));

const topNames = src => new Set([...src.matchAll(/^(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm)].map(m => m[1] || m[2]));
const inCore = topNames(coreSrc);
const inPage = topNames(pageSrc);
const both = [...inCore].filter(n => inPage.has(n));
check('nothing core.js defines is also defined in index.html', both.length === 0, both.join(', '));
check('core.js defines the functions the page moved to it',
      ['splitQty', 'parseRecipe', 'scaleRecipeSyntax', 'computeColumns', 'parseIngredientAmount', 'categorizeIngredient', 'withUpdatedHeaderLines'].every(n => inCore.has(n)));

const expected = (pageSrc.match(/const EXPECTED_CORE_VERSION = '([^']+)'/) || [])[1];
const tagVersion = (pageSrc.match(/<script src="core\.js\?v=([^"]+)"><\/script>/) || [])[1];
check('index.html expects the core.js version that core.js declares',
      expected === core.KITCHEN_CORE_VERSION && tagVersion === core.KITCHEN_CORE_VERSION,
      `core ${core.KITCHEN_CORE_VERSION}, page expects ${expected}, tag asks for ${tagVersion}`);
const coreTag = pageSrc.indexOf('<script src="core.js');
const mainScript = pageSrc.indexOf('const EXPECTED_CORE_VERSION');
check('core.js loads before the page script that uses it', coreTag !== -1 && mainScript > coreTag);

/* ---- The dictionary's master copy ---- */
const { execFileSync } = require('child_process');
let genOk = true, genOut = '';
try { genOut = execFileSync('node', [path.join(ROOT, 'tools', 'generate-ingredient-names.js'), '--check'], { encoding: 'utf8' }); }
catch(e){ genOk = false; genOut = (e.stderr || e.message).trim(); }
check('converter/ingredient-names.md is exactly what core.js generates', genOk, genOut);
const D = core.INGREDIENT_DICTIONARY;
check('the dictionary holds its 90 rows', D.length === 90, D.length);
const names = D.map(r => r.name.toLowerCase());
check('every name in the dictionary is written once', new Set(names).size === names.length,
      names.filter((n, i) => names.indexOf(n) !== i).join(', '));
check('every row is in a listed aisle, and every aisle has rows',
      D.every(r => core.INGREDIENT_AISLES.includes(r.aisle)) && core.INGREDIENT_AISLES.every(a => D.some(r => r.aisle === a)));
const decided = (n) => D.find(r => r.name === n);
check('the household\'s 23 Sep decisions are in it (D7, D8, D9)',
      /\boil\b/.test(decided('vegetable oil').also) && decided('unsalted butter') && decided('sea salt') && /\bsoy sauce\b/.test(decided('light soy sauce').also));

/* ---- Quantities ---- */
const q = (line) => core.splitQty(line);
check('a mixed number is one quantity', q('1 3/4 tbsp soy sauce').qty === '1 3/4 tbsp', q('1 3/4 tbsp soy sauce').qty);
check('a digit with a vulgar fraction is one quantity', q('1½ tsp ground cumin').qty === '1½ tsp', q('1½ tsp ground cumin').qty);
const range = core.parseIngredientAmount('2-3 tbsp');
check('a range buys its upper figure', range && range.amount === 3 && range.low === 2 && range.high === 3, JSON.stringify(range));
const packs = core.parseIngredientAmount('3 x 400 g');
check('a pack count totals the whole', packs && packs.amount === 1200 && packs.count === 3 && packs.unit === 'g', JSON.stringify(packs));
const upTo = core.parseIngredientAmount('up to 500 ml');
check('"up to" is a quantity', upTo && upTo.amount === 500 && upTo.upTo === true, JSON.stringify(upTo));
check('kilograms total as grams, and show as kilograms past 1000 g',
      core.toBaseUnit(1.2, 'kg').amount === 1200 && core.formatShoppingQty(1500, 'g') === '1 1/2 kg' && core.formatShoppingQty(600, 'g') === '600 g');
check('amounts read back as cooking fractions', core.formatAmount(0.75) === '3/4' && core.formatAmount(1.5) === '1 1/2' && core.formatAmount(2) === '2');

/* ---- Scaling ---- */
const scaled = core.scaleRecipeSyntax('SERVINGS: 2\n\nGROUP a:\n1 1/2 tsp ground cumin\n2-3 tbsp olive oil\n3 x 400 g chopped tomatoes\n\nSTAGE:\nMERGE a -> b: Cook for 10 min [10 min]', 2);
check('scaling doubles a mixed number', /^3 tsp ground cumin$/m.test(scaled), scaled);
check('scaling doubles both ends of a range', /^4-6 tbsp olive oil$/m.test(scaled), scaled);
check('scaling doubles the pack count, not the pack size', /^6 x 400 g chopped tomatoes$/m.test(scaled), scaled);
check('scaling updates SERVINGS and leaves the step text alone', /^SERVINGS: 4$/m.test(scaled) && /Cook for 10 min \[10 min\]/.test(scaled), scaled);

/* ---- Parsing and layout ---- */
const parsed = core.parseRecipe('TITLE: T\nSOURCE: S\nTAGS: course=Main, Veg\n\nGROUP a:\n1 onion\n\nGROUP b:\n1 carrot\n\nSTAGE:\nMERGE a, b -> ab: Fry [5-6 min]');
check('parseRecipe reads the header, groups, stages and a timing',
      parsed.title === 'T' && parsed.tags.course === 'Main' && parsed.tags.keywords[0] === 'Veg' &&
      parsed.groups.length === 2 && parsed.stages[0][0].duration.min === 5 && parsed.stages[0][0].duration.max === 6,
      JSON.stringify({ title: parsed.title, tags: parsed.tags, groups: parsed.groups.length }));
const gap = core.parseRecipe('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nGROUP c:\n1 z\n\nSTAGE:\nMERGE a, c -> ac: Join [instant]');
const gapErrors = core.computeColumns(gap.groups, gap.stages).errors;
check('a merge across a gap is an error that names the stage', gapErrors.length === 1 && /Stage 1/.test(gapErrors[0]) && /adjacent/.test(gapErrors[0]), gapErrors.join(' | '));
check('adjacent rows merge without an error', core.computeColumns(parsed.groups, parsed.stages).errors.length === 0);

/* ---- Header lines ---- */
const rewritten = core.withUpdatedHeaderLines('TITLE: A\nSOURCE: S\n\nGROUP a:\n1 onion', {
  title: 'B', source: 'S2', sourceUrl: '', imageUrl: '', time: '20 min', servings: 4, equipment: '',
  tags: { course: 'Side', keywords: ['Veg'] } });
const back = core.parseRecipe(rewritten);
check('header lines are written from the form and parse back to it',
      back.title === 'B' && back.source === 'S2' && back.time === '20 min' && back.servings === '4' && back.tags.course === 'Side' && !/^SOURCE_URL:/m.test(rewritten),
      rewritten.split('\n').slice(0, 5).join(' | '));
check('a title with $& in it is written literally', /^TITLE: Fish & chips \$&$/m.test(core.withUpdatedHeaderLine('TITLE: x', 'TITLE', 'Fish & chips $&')));

/* ---- Names and aisles, as they stand before PR 6b ---- */
check('preparation words are noise for totalling', core.normalizeIngredientName('garlic, minced') === 'garlic', core.normalizeIngredientName('garlic, minced'));
check('but "ground" is kept: ground coriander is not coriander', core.normalizeIngredientName('ground coriander') === 'ground coriander');
check('stock files under Pantry before chicken can claim it', core.categorizeIngredient('chicken stock') === 'Pantry', core.categorizeIngredient('chicken stock'));

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
