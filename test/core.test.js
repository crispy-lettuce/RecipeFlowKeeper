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

/* ---- The shopping list (PR 6b) ----
   The review's test plan, docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §6,
   numbered as it is there. Made-up lines only. Each was run once against
   the mutation the review names for it and seen to fail. */
const list = (...raws) => core.aggregateShoppingLines(raws.map(raw => ({ recipeTitle: 'R', raw })), null);
const keysOf = (...raws) => list(...raws).map(i => i.key);
const only = (...raws) => { const l = list(...raws); return l.length === 1 ? l[0] : { qtyText: l.length + ' rows: ' + l.map(i => i.key).join(', ') }; };

check('7: "4 cloves" (the spice) and garlic cloves never share a row',
      keysOf('4 cloves', '3 garlic cloves', '2 cloves garlic').length === 2 && only('3 garlic cloves', '2 cloves garlic').qtyText === '5 cloves',
      JSON.stringify(list('4 cloves', '3 garlic cloves', '2 cloves garlic').map(i => [i.key, i.qtyText])));
check('8: cinnamon sticks never join ground cinnamon, or cinnamon', keysOf('2 cinnamon sticks', '2 tsp ground cinnamon', '1 tsp cinnamon').length === 3,
      JSON.stringify(keysOf('2 cinnamon sticks', '2 tsp ground cinnamon', '1 tsp cinnamon')));
const neverMerge = [['1 tsp ground coriander', '1 bunch coriander'], ['2 spring onions', '1 onion'], ['1 red onion', '1 onion'],
  ['1 tsp garlic salt', '1 tsp salt'], ['1 tsp celery salt', '1 tsp salt'], ['100 ml double cream', '100 ml single cream'],
  ['100 g plain flour', '100 g self-raising flour'], ['1 tbsp olive oil', '1 tbsp vegetable oil'], ['1 tbsp light soy sauce', '1 tbsp dark soy sauce'],
  ['1 lemon', '2 tbsp lemon juice'], ['100 g milk chocolate', '100 ml milk'], ['1 tbsp peanut butter', '10 g butter'],
  ['200 g cherry tomatoes', '400 g chopped tomatoes']];
const merged9 = neverMerge.filter(p => keysOf(...p).length !== 2);
check('9: the never-merge pairs stay apart', merged9.length === 0, merged9.map(p => p.join(' + ')).join('; '));
/* The words that change what you buy are never dropped from a name, and
   never the one word a suggested pair differs by. Pinned here rather than
   read from core.NEVER_IGNORE, so a word removed there fails here: looping
   over the live set, the check lost its word along with the rule. */
const NEVER_IGNORE_PINNED = ['ground', 'red', 'green', 'yellow', 'dried', 'dark', 'light', 'unsalted',
  'double', 'single', 'baby', 'plain', 'self-raising', 'spring', 'sea', 'whole', 'frozen', 'cooked',
  'raw', 'full-fat', 'bone-in', 'smoked', 'white', 'black', 'brown', 'sweet', 'hot', 'mild'];
const droppedWords = NEVER_IGNORE_PINNED.filter(w => !core.shoppingKeyForName(w + ' zorbleberry').split(' ').includes(w));
check('    and no word on the never-ignore list is ever dropped from a name', droppedWords.length === 0, droppedWords.join(', '));
const offeredWords = NEVER_IGNORE_PINNED.filter(w => core.strictMatchSuggestions([{ key: w + ' zorbleberry', count: 1 }, { key: 'zorbleberry', count: 1 }], null).length);
check('    or offered as the only difference between two names', offeredWords.length === 0, offeredWords.join(', '));
check('10: a dangling "and" is not part of the name', only('1 carrot, peeled and diced', '1 carrot peeled and diced', '2 carrots').qtyText === '4',
      only('1 carrot, peeled and diced', '1 carrot peeled and diced', '2 carrots').qtyText);
check('    and the row takes the plural spelling on a tie', only('1 carrot', '2 carrots').name === 'Carrots', only('1 carrot', '2 carrots').name);
check('11: a size word is not part of the name', only('2 large eggs', '1 egg').qtyText === '3' && only('2 large courgettes', '1 courgette').qtyText === '3',
      only('2 large eggs', '1 egg').qtyText + ', ' + only('2 large courgettes', '1 courgette').qtyText);
check('12: "pinch of" is a pinch', only('pinch of nutmeg').qtyText === '1 pinch' && only('pinch of nutmeg').key === 'nutmeg', JSON.stringify(only('pinch of nutmeg')));
const peppers = list('1/4 tsp pepper', 'pinch of pepper', 'pepper, to taste', '1 red pepper', '2 peppers', '1 yellow pepper');
const pepperRow = k => peppers.find(i => i.key === k) || {};
check('13: pepper by the spoon, the pinch or to taste is black pepper; counted, a vegetable',
      pepperRow('black pepper').count === 3 && pepperRow('black pepper').category === 'Spices & Seasoning' &&
      pepperRow('red pepper').category === 'Produce' && pepperRow('pepper').qtyText === '2' && pepperRow('pepper').category === 'Produce' &&
      pepperRow('yellow pepper').category === 'Produce',
      JSON.stringify(peppers.map(i => [i.key, i.category, i.qtyText])));
check('14: 1 tsp + 1 tbsp of one thing is 4 tsp', only('1 tsp cumin', '1 tbsp cumin').qtyText === '4 tsp', only('1 tsp cumin', '1 tbsp cumin').qtyText);
check('    and with 10 ml as well, 30 ml', only('1 tsp cumin', '1 tbsp cumin', '10 ml cumin').qtyText === '30 ml', only('1 tsp cumin', '1 tbsp cumin', '10 ml cumin').qtyText);
check('15: a count and a weight are one row, "2 + 400 g"', only('2 chicken breasts', '400 g chicken breast').qtyText === '2 + 400 g', only('2 chicken breasts', '400 g chicken breast').qtyText);
/* 16: a tick is stored under the key, so a key that ignores the unit keeps
   the tick when a recipe changes tbsp -> g. (The page half is in smoke.js.) */
check('16: a line keeps its key when the recipe changes tbsp -> g', only('1 tbsp butter').key === only('15 g butter').key && only('1 tbsp butter', '15 g butter').key === 'butter');
/* 17 and 18 are the page's: smoke.js. */
const suggest = pairs => core.strictMatchSuggestions(pairs.map(k => ({ key: k, count: 1 })), null);
check('19: the strict rule offers curly parsley ~ parsley', JSON.stringify(suggest(['curly parsley', 'parsley'])) === '[{"from":"curly parsley","to":"parsley"}]', JSON.stringify(suggest(['curly parsley', 'parsley'])));
const falsePairs = [['unsalted butter', 'salt'], ['milk chocolate', 'milk'], ['peanut butter', 'butter'], ['celery salt', 'salt'],
  ['spring onion', 'onion'], ['coriander', 'ground coriander'], ['cinnamon', 'cinnamon stick'], ['oil', 'anchovies in olive oil'],
  /* and three made up in the shape of the live library's before the
     dictionary rule (25 Sep): a listed product against a bare word */
  ['raspberry jam', 'jam'], ['chicken stock', 'stock'], ['panko breadcrumb', 'breadcrumb']];
const offered19 = falsePairs.filter(p => suggest(p).length);
check('    and none of the review\'s false pairs', offered19.length === 0, offered19.map(p => p.join(' ~ ')).join('; '));
check('    and a pair already answered is not offered again', core.strictMatchSuggestions([{ key: 'curly kale', count: 1 }, { key: 'kale', count: 1 }], () => true).length === 0);
check('    and on a tie the plainer name is kept', JSON.stringify(suggest(['kale', 'curly kale'])) === '[{"from":"curly kale","to":"kale"}]', JSON.stringify(suggest(['kale', 'curly kale'])));
/* "chili flakes" is not a dictionary spelling, so this is the keyword rule's. */
check('20: chili flakes are a spice after the key folds the plural', only('1 tsp chili flakes').category === 'Spices & Seasoning', only('1 tsp chili flakes').category);
check('    and bay leaves are one because it does', only('2 bay leaves').category === 'Spices & Seasoning', only('2 bay leaves').category);
check('21: the aisle comes from the dictionary', only('1 red pepper').category === 'Produce' && only('1 tbsp chinese rice wine').category === 'Pantry',
      only('1 red pepper').category + ', ' + only('1 tbsp chinese rice wine').category);
/* 22 is the generator check above. */
check('23: a word match stored in the old words still applies', core.shoppingKeyForName('carrot and') === 'carrot' && core.shoppingKeyForName('Courgettes, sliced') === 'courgette',
      core.shoppingKeyForName('carrot and') + ', ' + core.shoppingKeyForName('Courgettes, sliced'));
const unstable = core.INGREDIENT_DICTIONARY.map(r => core.shoppingKeyForName(r.name)).filter(k => core.shoppingKeyForName(k) !== k);
check('    and re-normalising a key gives the key back', unstable.length === 0, unstable.join(', '));
const { checkLine } = require(path.join(__dirname, 'ingredient-lines.js'));
const shape = line => { const { qty, rest } = core.splitQty(line); return checkLine({ line, qty, rest }, { synonyms: new Map(), names: new Set(), listedAs: new Map() }).why.join('; '); };
check('24: validate-recipes warns on a two-ingredient line and on "3 x"',
      /two ingredients/.test(shape('1 onion and 1 carrot')) && /multiplier/.test(shape('3 x 400 g tins chopped tomatoes')),
      shape('1 onion and 1 carrot') + ' | ' + shape('3 x 400 g tins chopped tomatoes'));
check('eighths read, total and print', only('⅛ tsp salt', '1/8 tsp salt').qtyText === '1/4 tsp' && core.formatAmount(0.125) === '1/8',
      only('⅛ tsp salt', '1/8 tsp salt').qtyText + ', ' + core.formatAmount(0.125));
check('stock files under Pantry before chicken can claim it', only('500 ml chicken stock').category === 'Pantry', only('500 ml chicken stock').category);

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
