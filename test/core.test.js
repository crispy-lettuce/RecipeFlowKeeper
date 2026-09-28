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
/* The review wrote this one as "4 tsp". The total is the check; since 25 Sep
   a mix of the two spoons is shown as both, "1 tbsp + 1 tsp" (see below). */
check('14: 1 tsp + 1 tbsp of one thing totals 20 ml, shown as 1 tbsp + 1 tsp', only('1 tsp cumin', '1 tbsp cumin').qtyText === '1 tbsp + 1 tsp', only('1 tsp cumin', '1 tbsp cumin').qtyText);
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
/* ---- The follow-up to 6b, 25 Sep: what the first live list showed ---- */
const aisleOf = raw => only(raw).category;
const aisleCases = [['400 g cooked egg noodles', 'Pantry'], ['3 tbsp hot pepper sauce', 'Pantry'], ['200 ml full-fat coconut milk', 'Pantry'],
  ['300 g dried linguine', 'Pantry'], ['400 ml passata', 'Pantry'], ['500 g gnocchi', 'Pantry'], ['4 cloves', 'Spices & Seasoning'],
  ['1 tbsp curry powder', 'Spices & Seasoning'], ['1 1/2 tbsp harissa paste', 'Spices & Seasoning'], ['1 tbsp crème fraîche', 'Dairy & Eggs'],
  ['1 jalapeño', 'Produce'], ['1 red or green chilli', 'Produce'],
  /* and the ones those words must not pull away */
  ['2 eggs', 'Dairy & Eggs'], ['1/2 tsp black pepper', 'Spices & Seasoning'], ['200 ml milk', 'Dairy & Eggs'], ['1 tsp chilli flakes', 'Spices & Seasoning'],
  ['3 garlic cloves', 'Produce'], ['1 tsp chilli powder', 'Spices & Seasoning']];
const misfiled = aisleCases.filter(([raw, aisle]) => aisleOf(raw) !== aisle);
check('the aisles the first live list had wrong are right, and nothing they touch moved', misfiled.length === 0,
      misfiled.map(([raw, aisle]) => `${raw}: ${aisleOf(raw)}, not ${aisle}`).join('; '));
check('a mix of spoons reads as both, largest first', only('3 tbsp vegetable oil', '2 tsp vegetable oil').qtyText === '3 tbsp + 2 tsp',
      only('3 tbsp vegetable oil', '2 tsp vegetable oil').qtyText);
check('    but teaspoons alone stay teaspoons, and a mix under a tablespoon too',
      only('4 tsp cumin', '2 tsp cumin').qtyText === '6 tsp' && only('1/2 tbsp cumin', '1 tsp cumin').qtyText === '2 1/2 tsp',
      only('4 tsp cumin', '2 tsp cumin').qtyText + ', ' + only('1/2 tbsp cumin', '1 tsp cumin').qtyText);
const grouped = (...ls) => core.aggregateShoppingLines(ls.map(([recipeTitle, group, raw]) => ({ recipeTitle, group, raw })), null);
const parm = grouped(['A', 'cheese', '75 g grated parmesan'], ['A', 'garnish', 'grated parmesan'], ['B', 'sauce', '50 g grated parmesan'], ['C', 'garnish', 'grated parmesan']);
check('lines with no amount in a garnish group read "extra to serve", counting recipes', parm.length === 1 && parm[0].qtyText === '125 g + extra to serve (2 recipes)',
      parm.map(i => i.qtyText).join(' // '));
const one = grouped(['A', 'garnish', 'grated parmesan'], ['A', 'cheese', '75 g grated parmesan']);
check('    with no count for one recipe', one[0].qtyText === '75 g + extra to serve', one[0].qtyText);
const said = grouped(['A', 'base', 'salt, to taste'], ['B', 'base', 'salt, to taste'], ['B', 'base', '1 tsp salt'], ['C', 'base', '2 eggs'], ['C', 'top', 'beaten egg, to glaze'],
  ['D', 'base', '100 ml maple syrup'], ['D', 'brushing', 'maple syrup, extra for brushing'], ['E', 'garnish', 'parsley, chopped']);
const qtyOf = key => (said.find(i => i.key === key) || {}).qtyText;
check('    and a line\'s own note wins: to taste, to glaze, or plain extra; alone, no "extra"',
      qtyOf('salt') === '1 tsp + to taste (2 recipes)' && qtyOf('egg') === '2 + extra to glaze' && qtyOf('maple syrup') === '100 ml + extra' && qtyOf('parsley') === 'to serve',
      ['salt', 'egg', 'maple syrup', 'parsley'].map(k => k + ': ' + qtyOf(k)).join('; '));
check('    and never "N more", which read as N more of the same amount', !/\bmore\b/.test(said.concat(parm).map(i => i.qtyText).join(' ')));

/* ---- 6c-1, 28 Sep: checks where recipes come in ---- */
const faultCodes = line => core.ingredientLineFaults(line).map(f => f.code + (f.affectsList ? '!' : '')).join(',');
const shapeCases = [
  ['3 tbsp honey or golden syrup', 'alternative!'], ['salt and pepper, to taste', 'two!'], ['1 cup rice', 'metric!'],
  ['400 ml tin plum tomatoes', 'container,tinMl!'], ['zest of 1/2 lemon', 'prep,amountInName!,noqty'],
  ['1 large onion, chopped', 'size'], ['75 g grated parmesan', 'prep'], ['grated parmesan', 'prep,noqty'],
  ['400 g plum tomatoes (1 tin)', ''], ['3 tbsp golden syrup (or honey)', ''], ['1 onion', '']];
const shapeWrong = shapeCases.filter(([l, want]) => faultCodes(l) !== want);
check('each line fault is found, and marked ! only where the shopping list cannot cope', shapeWrong.length === 0,
      shapeWrong.map(([l, w]) => `${l}: ${faultCodes(l)} (want ${w})`).join('; '));
const sug = l => core.suggestIngredientLine(l);
check('a rewrite is offered where there is one right answer',
      sug('400 ml tin plum tomatoes') === '400 g plum tomatoes (1 tin)' && sug('zest of 1/2 lemon') === '1/2 lemon, zested'
      && sug('juice of 1 lemon') === '1 lemon, juiced', [sug('400 ml tin plum tomatoes'), sug('zest of 1/2 lemon'), sug('juice of 1 lemon')].join(' | '));
check('    and none where the choice is the household\'s', sug('3 tbsp honey or golden syrup') === null && sug('salt and pepper, to taste') === null
      && core.LINE_HINTS.alternative && core.LINE_HINTS.two);
check('    and every suggestion passes its own check',
      ['400 ml tin plum tomatoes', 'zest of 1/2 lemon', 'juice of 1 lemon'].every(l => !core.ingredientLineFaults(sug(l)).some(f => f.affectsList)));
const unreadOf = t => core.parseRecipe(t).unread.map(u => u.line).join('|');
/* The onion is lost with its misspelt GROUP: no group was open to take it. */
check('the parser reports the lines it reads past, and nothing it reads',
      unreadOf('Ingredients\nTITLE: X\nGROUP a-b:\n1 onion\nGROUP ok:\n1 leek\nSTAGE:\nMERGE ok -> done: Cook [5 min]\nStir\nMERGE ok → x: y') === 'Ingredients|GROUP a-b:|1 onion|Stir|MERGE ok → x: y'
      && unreadOf('TITLE: X\nGROUP a:\n1 onion\nSTAGE:\nMERGE a -> done: Cook [5 min]\nNOTES:\nKeeps a week') === '',
      unreadOf('Ingredients\nTITLE: X\nGROUP a-b:\n1 onion\nGROUP ok:\n1 leek\nSTAGE:\nMERGE ok -> done: Cook [5 min]\nStir\nMERGE ok → x: y'));
check('    including a misspelt GROUP inside a group, the commonest case, which fell in as an ingredient',
      unreadOf('TITLE: X\nGROUP a:\n1 onion\nGROUP b-c:\n1 leek\nSTAGE:\nMERGE a -> done: Cook [5 min]') === 'GROUP b-c:',
      unreadOf('TITLE: X\nGROUP a:\n1 onion\nGROUP b-c:\n1 leek\nSTAGE:\nMERGE a -> done: Cook [5 min]'));
check('    without changing what it parses: a misspelt GROUP still lands where it always did',
      JSON.stringify(core.parseRecipe('GROUP a:\n1 onion\nGROUP b-c:\n1 leek').groups) === JSON.stringify([{ handle: 'a', items: ['1 onion', 'GROUP b-c:', '1 leek'] }]));
/* A recipe's choice belongs to that recipe (decided 28 Sep): by the row's name
   only when every recipe on the row offers it, else beside the recipe. */
const alts = core.aggregateShoppingLines([{ recipeTitle: 'A', raw: '3 tbsp golden syrup (or honey)' }, { recipeTitle: 'B', raw: '1 tbsp golden syrup' },
  { recipeTitle: 'C', raw: '200 ml milk (whole or semi-skimmed)' }, { recipeTitle: 'D', raw: '400 g plum tomatoes (1 tin)' },
  { recipeTitle: 'E', raw: '10 g butter (or oil)' }, { recipeTitle: 'F', raw: '20 g butter (or oil)' }], null);
const rowOf = k => alts.find(i => i.key === k) || {};
check('a choice from one recipe of several sits beside that recipe, not the row',
      JSON.stringify(rowOf('golden syrup').alts) === '[]' && JSON.stringify(rowOf('golden syrup').recipeAlts) === '[{"recipe":"A","alts":["or honey"]}]',
      JSON.stringify(rowOf('golden syrup')));
check('    beside the name when every recipe on the row offers it, a single recipe included',
      JSON.stringify(rowOf('milk').alts) === '["whole or semi-skimmed"]' && JSON.stringify(rowOf('butter').alts) === '["or oil"]'
      && !rowOf('milk').recipeAlts.length && !rowOf('butter').recipeAlts.length, JSON.stringify([rowOf('milk'), rowOf('butter')]));
check('    and a bracket with no choice in it shows nowhere, and never splits a row',
      alts.length === 4 && JSON.stringify(rowOf('plum tomato').alts) === '[]' && !rowOf('plum tomato').recipeAlts.length, JSON.stringify(alts.map(i => i.key)));
check('ghee goes with the dairy', only('2 tbsp ghee').category === 'Dairy & Eggs', only('2 tbsp ghee').category);
const wm = core.ingredientMatchMap([{ kind: 'ingredient', alias: 'Curly Kale', canonical: 'kale' }, { kind: 'ingredient', alias: 'large onion', canonical: 'onion' },
  { kind: 'source', alias: 'x', canonical: 'y' }]);
check('word matches are applied in today\'s words, and one the rules make anyway falls away',
      wm.size === 1 && wm.get('curly kale') === 'kale', JSON.stringify([...wm]));

/* ---- PR 7d, 28 Sep: a source's list pasted from its page ---- */
const pastedOf = t => core.pastedIngredientLines(t);
const furniture = '▢ 500 g chicken breast\n\n• 2 tbsp olive oil\n- 1 onion, chopped\n☐\u00a01\u00a0tsp   salt\r\n[ ] 3 eggs\n   \n▢\n\u200b▢ 4 shallots\n';
check('a pasted list loses its tick boxes, bullets, blank lines, zero-width and odd spaces, and nothing else',
      pastedOf(furniture).join('|') === '500 g chicken breast|2 tbsp olive oil|1 onion, chopped|1 tsp salt|3 eggs|4 shallots', JSON.stringify(pastedOf(furniture)));
check('    a heading is dropped when it is certainly one: no digit, and a colon, "For the…" or a section word',
      pastedOf('Ingredients\nFor the sauce\nFor a crumb topping:\nSauce:\nMethod\n2 eggs').join('|') === '2 eggs', JSON.stringify(pastedOf('Ingredients\nFor the sauce\nFor a crumb topping:\nSauce:\nMethod\n2 eggs')));
const keptLines = ['salt', 'black pepper, to taste', 'For the sauce: 200 ml cream', 'a pinch of salt', '1–2 tbsp honey', '½ tsp cumin', '*optional: chives', 'Water'];
check('    and anything that might be an ingredient stays, so the check never quietly loses one',
      pastedOf(keptLines.join('\n')).join('|') === keptLines.join('|'), JSON.stringify(pastedOf(keptLines.join('\n'))));
check('    nothing, or something that is not text, is an empty list rather than an error',
      pastedOf('').length === 0 && pastedOf(null).length === 0 && pastedOf(undefined).length === 0 && pastedOf('  \n\n ').length === 0);
const pastedCheck = core.sourceFidelity(pastedOf('Ingredients\n▢ 1 tsp Italian seasoning\n▢ 2 cups all-purpose flour\nFor the topping:\n▢ 1/2 cup heavy cream'),
  ['1 tsp dried oregano', '250 g plain flour', '120 ml double cream']);
check('    and a swapped ingredient in a pasted list shows on both sides, as it does from the function',
      pastedCheck.sourceOnly.join('|') === '1 tsp Italian seasoning' && pastedCheck.recipeOnly.join('|') === '1 tsp dried oregano'
      && pastedCheck.matched.length === 2, JSON.stringify(pastedCheck));

/* ---- PR 7e, 28 Sep: the source check no longer calls a difference a match ----
   A real comparison paired a source's second "1/2 tsp" line with the recipe's
   "pinch" line, and reported it matched. Probing then found the check blind to
   ten of eleven faults tried. Every line below is made up. */
const fid = (src, rec) => core.sourceFidelity(src, rec);
const groupsFlagged = f => new Set(f.matched.filter(m => m.check).map(m => m.check)).size;
const flagCount = f => f.sourceOnly.length + f.recipeOnly.length + groupsFlagged(f);
const flagKinds = f => [...new Set(f.matched.filter(m => m.check).map(m => m.check.kind))].sort().join(',');
const dupSrc = ['1/4 tsp ground cinnamon', '2 eggs', 'a pinch of salt and cinnamon', '1/4 tsp ground cinnamon'];
const dupRec = ['1/4 tsp ground cinnamon', '2 eggs', 'pinch salt', 'pinch cinnamon'];
const dup = fid(dupSrc, dupRec);
check('a source line listed twice, with a compound pinch line, is not hidden by matching the pinch line: it is flagged once, as an amount',
      flagCount(dup) === 1 && flagKinds(dup) === 'amount' && /source 1\/4 tsp \+ 1\/4 tsp; recipe 1\/4 tsp/.test(dup.matched.find(m => m.check).check.why), JSON.stringify(dup));
check('    and the pinch stays with its own compound line, split in two, unflagged',
      dup.matched.filter(m => m.source === 'a pinch of salt and cinnamon' && !m.check).map(m => m.recipe).sort().join('|') === 'pinch cinnamon|pinch salt', JSON.stringify(dup.matched));
const dupPepper = fid(['1/4 tsp black pepper', 'a pinch of salt and pepper', '1/4 tsp black pepper'], ['1/4 tsp black pepper', 'pinch salt', 'pinch pepper']);
check('    the same through the dictionary, where a bare "pepper" is black pepper: the pinch is part of the total, and named',
      flagCount(dupPepper) === 1 && flagKinds(dupPepper) === 'amount'
      && dupPepper.matched.some(m => m.source === 'a pinch of salt and pepper' && m.recipe === 'pinch pepper' && m.check)
      && /source 1\/4 tsp \+ 1\/4 tsp \+ a pinch; recipe 1\/4 tsp \+ a pinch/.test(dupPepper.matched.find(m => m.check).check.why), JSON.stringify(dupPepper));
const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(r => [x].concat(r)));
/* Flagged rightly is not enough: it must be flagged for the right reason, or
   the person reads "1/4 tsp against a pinch" and looks in the wrong place. The
   pepper variant matters most, because both of its candidate lines share one
   dictionary name and score alike; only the amounts tell them apart. */
const diagnosis = f => JSON.stringify([[...new Set(f.matched.filter(m => m.check).map(m => m.check.why))], f.sourceOnly.length, f.recipeOnly.length]);
const wrongOrder = [];
/* Which line is drawn beside which is only presentation, but a spoon drawn beside a pinch sends the eye to the wrong lines. */
const mixesSpoonAndPinch = f => f.matched.some(m => /\btsp\b/.test(m.source) !== /\btsp\b/.test(m.recipe));
[[dupSrc, dupRec], [['1/4 tsp black pepper', 'a pinch of salt and pepper', '1/4 tsp black pepper'], ['1/4 tsp black pepper', 'pinch salt', 'pinch pepper']]].forEach(([src, rec]) => {
  const right = diagnosis(fid(src, rec));
  perms(src).forEach(ps => perms(rec).forEach(pr => { const f = fid(ps, pr), d = diagnosis(f); if(d !== right || mixesSpoonAndPinch(f) || f.matched.some(m => m.note)) wrongOrder.push(ps.join(' / ') + ' :: ' + pr.join(' / ') + ' => ' + d); }));
});
check('    whatever order the lists come in (612 orders, both variants), it is the same two lines blamed for the same reason, drawn sensibly and with no stray note', wrongOrder.length === 0,
      wrongOrder.length + ' wrong, e.g. ' + wrongOrder[0]);

/* Each of these is a conversion fault a person would want to see. */
const faults = [
  ['white pepper for black', ['1/2 tsp black pepper'], ['1/2 tsp white pepper'], 'wording'],
  ['onion powder for garlic powder', ['1/4 tsp garlic powder'], ['1/4 tsp onion powder'], 'wording'],
  ['beef stock for chicken stock', ['240 ml chicken stock'], ['240 ml beef stock'], 'wording'],
  ['skimmed milk for whole milk', ['200 ml whole milk'], ['200 ml skimmed milk'], 'wording'],
  ['baking powder for baking soda', ['1 tsp baking soda'], ['1 tsp baking powder'], 'wording'],
  ['self-raising for plain flour', ['250 g plain flour'], ['250 g self-raising flour'], 'wording'],
  ['black pepper for a red bell pepper', ['1 red bell pepper'], ['1 pepper'], 'wording'],
  ['a more specific product than the source named', ['1 tsp vanilla'], ['1 tsp vanilla extract'], 'wording'],
  ['2 tbsp written as 1 tbsp', ['2 tbsp olive oil'], ['1 tbsp olive oil'], 'amount'],
  ['1 tsp written as 1 tbsp', ['1 tsp baking powder'], ['1 tbsp baking powder'], 'amount'],
  ['400 g written as 40 g', ['400 g plain flour'], ['40 g plain flour'], 'amount'],
  ['2 cloves written as 3', ['2 cloves garlic'], ['3 cloves garlic'], 'amount'],
  ['a pinch quantified as a spoon', ['a pinch of chilli flakes'], ['1/4 tsp chilli flakes'], 'amount'],
  ['a split that does not add up: 3 tbsp as 1 + 1', ['3 tbsp oil'], ['1 tbsp oil', '1 tbsp oil'], 'amount'],
  ['a pound written as 600 g', ['1 lb beef'], ['600 g beef'], 'amount'],
  ['a range collapsed to its low end', ['2-3 tbsp olive oil'], ['2 tbsp olive oil'], 'amount'],
  ['a range collapsed to its high end', ['2-3 tbsp olive oil'], ['3 tbsp olive oil'], 'amount'],
  ['a range shifted', ['2-3 tbsp olive oil'], ['2-4 tbsp olive oil'], 'amount'],
  ['a spoon written as a pinch', ['1 tsp cumin'], ['1 pinch cumin'], 'amount'],
  ['a figure moved 4% in the same unit, for which there is no conversion to blame', ['250 g plain flour'], ['240 g plain flour'], 'amount'],
  ['two source lines merged into too little: 1 + 1 tsp as 1', ['1 tsp cumin', '1 tsp cumin'], ['1 tsp cumin'], 'amount'],
  ['an ingredient dropped', ['1 onion', '1 carrot'], ['1 carrot'], ''],
  ['an ingredient dropped whose only remaining neighbour shares a word', ['1 red bell pepper', '1/2 tsp black pepper'], ['1/2 tsp black pepper'], ''],
  ['the same, when the dropped line has no comma so the dictionary cannot name it', ['1 green pepper de-seeded and sliced', 'a pinch of salt and pepper'], ['pinch salt', 'pinch pepper'], ''],
  ['the second half of a compound line dropped', ['a pinch of salt and cumin'], ['pinch salt'], ''],
  ['an ingredient added that the source lacks', ['2 eggs'], ['2 eggs', '1 tsp cumin'], '']];
/* A difference between two paired lines is reported once, on the pair: not again as a line found on one side only. */
const missed = faults.filter(([, s, r, kind]) => { const f = fid(s, r); return flagCount(f) === 0 || flagKinds(f) !== kind || (kind && (f.sourceOnly.length || f.recipeOnly.length)); });
check('each of twenty-six conversion faults is flagged, and as the right kind of fault', missed.length === 0,
      missed.map(([n, s, r]) => n + ': ' + JSON.stringify(fid(s, r))).join(' || '));
check('    a dropped half of a compound line says which half',
      /the "cumin" part/.test(fid(['a pinch of salt and cumin'], ['pinch salt']).sourceOnly.join('|')), JSON.stringify(fid(['a pinch of salt and cumin'], ['pinch salt']).sourceOnly));
check('    and a flagged pair says what differs, in words',
      /the recipe adds skimmed/.test(fid(['200 ml whole milk'], ['200 ml skimmed milk']).matched[0].check.why)
      && /amounts differ: source 2 tbsp; recipe 1 tbsp/.test(fid(['2 tbsp olive oil'], ['1 tbsp olive oil']).matched[0].check.why));

/* And none of these is a fault: the converter doing what it is asked, or the
   check declining to compare what it cannot. Unknown never warns. */
const fine = [
  ['cups against grams cannot be compared', ['2 cups plain flour'], ['250 g plain flour']],
  ['cups with the ml in brackets', ['1 cup (240 ml) milk'], ['240 ml milk']],
  ['a half cup as ml', ['1/2 cup milk'], ['120 ml milk']],
  ['ounces as grams', ['8 oz cream cheese'], ['225 g cream cheese']],
  ['a pound as grams', ['1 lb beef'], ['450 g beef']],
  ['a pound rounded to 500 g, as a cook would', ['1 lb beef'], ['500 g beef']],
  ['a cup as 250 ml, the metric cup', ['1 cup milk'], ['250 ml milk']],
  ['a spoon against grams cannot be compared', ['1 tbsp sugar'], ['15 g sugar']],
  ['a weight for a volume is not compared', ['500 ml stock'], ['500 g stock']],
  ['a count against a weight cannot be compared', ['2 (400 g) tins chopped tomatoes'], ['800 g chopped tomatoes (2 tins)']],
  ['3 x 400 g as 1200 g', ['3 x 400 g tins tomatoes'], ['1200 g tomatoes']],
  ['a range kept as the source gives it', ['2-3 tbsp olive oil'], ['2-3 tbsp olive oil']],
  ['a range written with an en dash and kept with a hyphen', ['2–3 tbsp olive oil'], ['2-3 tbsp olive oil']],
  ['1 1/2 written as 1.5', ['1 1/2 tsp baking powder'], ['1.5 tsp baking powder']],
  ['a third written as 0.33', ['1/3 tsp salt'], ['0.33 tsp salt']],
  ['a late addition: 3 tbsp split 1 + 2', ['3 tbsp oil'], ['1 tbsp oil', '2 tbsp oil']],
  ['two source lines correctly merged: 1 + 1 tsp as 2', ['1 tsp cumin', '1 tsp cumin'], ['2 tsp cumin']],
  ['a late addition, with a note on each', ['2 tbsp butter'], ['1 tbsp butter (for frying)', '1 tbsp butter (to finish)']],
  ['preparation worded differently', ['1 onion, finely chopped'], ['1 onion, diced']],
  ['"peeled and sliced" is one ingredient, not two', ['1 shallot peeled and sliced'], ['1 shallot, peeled and sliced']],
  ['cloves reordered', ['3 cloves garlic, crushed'], ['3 garlic cloves, crushed']],
  ['a tin in brackets', ['1 (14 oz) can chickpeas, drained'], ['400 g chickpeas (1 tin), drained']],
  ['the product moved into brackets', ['250 g noodles (I use udon)'], ['250 g udon (noodles)']],
  ['a source note dropped', ['200 g (1 cup) dried apricots I like the soft ones'], ['200 g dried apricots']],
  ['a compound line split in two', ['salt and pepper, to taste'], ['salt, to taste', 'black pepper, to taste']],
  ['a pinch of each', ['a pinch of salt and cumin'], ['pinch salt', 'pinch cumin']],
  ['a pinch for a pinch', ['a pinch of salt'], ['pinch salt']],
  ['US names the dictionary knows', ['1/2 cup heavy cream', '1 bunch cilantro', '4 scallions'], ['120 ml double cream', '1 bunch fresh coriander', '4 spring onions']],
  ['soy sauce, which the dictionary makes light', ['2 tbsp soy sauce'], ['2 tbsp light soy sauce']],
  ['a recipe that says less than its source', ['1 tsp freshly grated nutmeg'], ['1 tsp nutmeg']]];
const noisy = fine.filter(([, s, r]) => flagCount(fid(s, r)) !== 0);
check('each of thirty conversions that are not faults stays quiet', noisy.length === 0,
      noisy.map(([n, s, r]) => n + ': ' + JSON.stringify(fid(s, r))).join(' || '));
const amt = l => core.fidelityAmount(l);
const agree = (x, y) => core.fidelityAgree(x.map(amt), y.map(amt));
check('amounts compare only where a difference cannot be a unit conversion',
      agree(['1 tbsp oil'], ['15 ml oil']) === 'agree' && agree(['1 tsp oil'], ['1 tbsp oil']) === 'differ' && agree(['8 oz cheese'], ['225 g cheese']) === 'agree'
      && agree(['8 oz cheese'], ['150 g cheese']) === 'differ' && agree(['1 cup flour'], ['120 g flour']) === 'unknown' && agree(['2 eggs'], ['200 g eggs']) === 'unknown'
      && agree(['2-3 tbsp oil'], ['2 tbsp oil']) === 'differ' && agree(['2-3 tbsp oil'], ['2-3 tbsp oil']) === 'agree' && agree(['up to 600 ml cider'], ['600 ml cider']) === 'unknown',
      JSON.stringify([agree(['1 tbsp oil'], ['15 ml oil']), agree(['1 tsp oil'], ['1 tbsp oil']), agree(['1 cup flour'], ['120 g flour'])]));
check('    a pinch is an amount of its own kind: it differs from a spoon and agrees with a pinch, and totals add up',
      agree(['a pinch of salt'], ['1/2 tsp salt']) === 'differ' && agree(['a pinch of salt'], ['pinch salt']) === 'agree'
      && agree(['1 tbsp oil', '2 tbsp oil'], ['3 tbsp oil']) === 'agree' && agree(['1 tbsp oil'], ['3 tbsp oil', '2 tbsp oil']) === 'differ'
      && amt('1 tbsp oil, a pinch').kind === 'measured' && amt('salt') === null
      && amt('a dash of vinegar').text === 'a dash' && amt('two pinches of salt') === null && amt('a pinch of salt').text === 'a pinch'
      && ['a pinch of salt', 'pinch of salt', '1 pinch salt', 'pinch salt', 'a pinch salt'].every(l => agree(['a pinch of salt'], [l]) === 'agree') && agree(['2 pinches salt'], ['1 pinch salt']) === 'differ');

/* ---- Generality guard (28 Sep, PR 7e) ----
   The checks above pin cases somebody thought of, and a comparison written from a
   handful of examples passes every one of them. This runs the same faults and the
   same harmless conversions over EVERY ingredient in the dictionary and its plain
   spellings, so a rule that only holds for the ingredients it was written from
   cannot pass. Nothing below names an ingredient: the lines are built from the
   vocabulary, and the operators are the ways a converter may legitimately reshape
   a line (conversion-instructions.md) and the ways it can get one wrong. */
const vocab = core.INGREDIENT_DICTIONARY.map(r => ({ name: r.name, aisle: r.aisle,
  aliases: String(r.also || '').split(/[,;]/).map(x => x.trim()).filter(p => p && !/[()*"'`]|\b(when|not|is|its own|check)\b/i.test(p)) }));
const wordsOf = n => n.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !['and', 'the', 'whole', 'fresh'].includes(w));
const allWords = r => new Set([r.name].concat(r.aliases).flatMap(wordsOf));
const collides = (a, b) => { const wa = allWords(a); return [...allWords(b)].some(w => wa.has(w)); };
const AMOUNTS = { 'Spices & Seasoning': [[1, 'tsp'], [0.5, 'tsp'], [2, 'tsp'], [1, 'tbsp']], Produce: [[2, ''], [3, ''], [200, 'g'], [1, '']],
  'Meat & Fish': [[300, 'g'], [500, 'g'], [250, 'g'], [2, '']], 'Dairy & Eggs': [[100, 'g'], [200, 'ml'], [4, ''], [50, 'g']],
  Pantry: [[2, 'tbsp'], [100, 'g'], [250, 'ml'], [1, 'tsp'], [150, 'g']] };
const amountOf = (r, i) => { const l = AMOUNTS[r.aisle] || AMOUNTS.Pantry; return l[i % l.length]; };
const fracText = n => ({ 0.5: '1/2', 0.25: '1/4', 1.5: '1 1/2' }[n] || String(n));
const glyphText = n => ({ 0.5: '½', 0.25: '¼', 1.5: '1½' }[n] || String(n));
const Ln = (q, u, name) => `${fracText(q)}${u ? ' ' + u : ''} ${name}`.trim();
/* [name, make(name, qty, unit, another ingredient, its row) => [source lines, recipe lines] or null] */
const QUIET_OPS = [
  ['an identical line', (n, q, u) => [[Ln(q, u, n)], [Ln(q, u, n)]]],
  ['a fraction glyph', n => [[`${glyphText(0.5)} tsp ${n}`], [`1/2 tsp ${n}`]]],
  ['a mixed number glyph', n => [[`${glyphText(1.5)} tbsp ${n}`], [`1 1/2 tbsp ${n}`]]],
  ['long unit words', n => [[`2 tablespoons ${n}`], [`2 tbsp ${n}`]]],
  ['a unit glued to its number', n => [[`500g ${n}`], [`500 g ${n}`]]],
  ['kilos as grams', n => [[`1.5 kg ${n}`], [`1500 g ${n}`]]],
  ['a litre as ml', n => [[`1 litre ${n}`], [`1000 ml ${n}`]]],
  ...['a pinch of', 'pinch of', '1 pinch', 'a pinch', 'pinch'].flatMap(a => ['1 pinch', 'pinch'].map(b => [`a pinch written "${a}" and "${b}"`, n => [[`${a} ${n}`], [`${b} ${n}`]]])),
  ['a dash written two ways', n => [[`a dash of ${n}`], [`1 dash ${n}`]]],
  ['a size word moved into a note', n => [[`1 large ${n}`], [`1 ${n} (large)`]]],
  ['a can with its weight as a tin', n => [[`1 can (400g) ${n}`], [`400 g ${n} (1 tin)`]]],
  ['two tins as their total', n => [[`2 x 400g tins ${n}`], [`800 g ${n} (2 tins)`]]],
  ['a can in ounces', n => [[`1 (14 oz) can ${n}`], [`400 g ${n} (1 tin)`]]],
  ['cups as grams, which cannot be compared', n => [[`1 cup ${n}`], [`120 g ${n}`]]],
  ['cups as ml', n => [[`1/2 cup ${n}`], [`120 ml ${n}`]]],
  ['cups as a metric cup', n => [[`1 cup ${n}`], [`250 ml ${n}`]]],
  ['spoons as grams, which cannot be compared', n => [[`3 tbsp ${n}`], [`45 g ${n}`]]],
  ['ounces as grams', n => [[`8 oz ${n}`], [`225 g ${n}`]]],
  ['a pound as 450 g', n => [[`1 lb ${n}`], [`450 g ${n}`]]],
  ['a pound rounded to 500 g', n => [[`1 lb ${n}`], [`500 g ${n}`]]],
  ['an ounce rounded to 30 g', n => [[`1 oz ${n}`], [`30 g ${n}`]]],
  ['preparation moved after the comma', n => [[`2 finely chopped ${n}`], [`2 ${n}, finely chopped`]]],
  ['preparation reworded', n => [[`2 ${n}, chopped`], [`2 ${n}, roughly diced`]]],
  ['a note added in brackets', n => [[`2 ${n}`], [`2 ${n} (about 200 g)`]]],
  ['preparation described in words the app has never seen', n => [[`2 ${n}`], [`2 ${n}, cut into matchsticks`]]],
  ['a teaspoon as 5 ml', n => [[`2 tsp ${n}`], [`10 ml ${n}`]]],
  ['a tablespoon as 15 ml', n => [[`2 tbsp ${n}`], [`30 ml ${n}`]]],
  ['a tablespoon as three teaspoons', n => [[`1 tbsp ${n}`], [`3 tsp ${n}`]]],
  ['a quarter cup as 60 ml', n => [[`1/4 cup ${n}`], [`60 ml ${n}`]]],
  ['an "optional" note dropped', n => [[`2 ${n} (optional)`], [`2 ${n}`]]],
  ['"to serve"', n => [[`${n}, to serve`], [`${n}, to serve`]]],
  ['"to taste" with no comma', n => [[`${n} to taste`], [`${n}, to taste`]]],
  ['a late addition, 3 tbsp as 1 + 2', n => [[`3 tbsp ${n}`], [`1 tbsp ${n}`, `2 tbsp ${n}`]]],
  ['a late addition, 300 g as 100 + 200', n => [[`300 g ${n}`], [`100 g ${n}`, `200 g ${n}`]]],
  ['a late addition, 4 as 2 + 2', n => [[`4 ${n}`], [`2 ${n}`, `2 ${n}`]]],
  ['two source lines merged, 1 + 1 tsp as 2', n => [[`1 tsp ${n}`, `1 tsp ${n}`], [`2 tsp ${n}`]]],
  ['three source lines restructured to two, the same total', n => [[`2 tbsp ${n}`, `1 tbsp ${n}`, `3 tbsp ${n}`], [`4 tbsp ${n}`, `2 tbsp ${n}`]]],
  ['two source lines restructured to three, the same total', n => [[`300 g ${n}`, `100 g ${n}`], [`100 g ${n}`, `100 g ${n}`, `200 g ${n}`]]],
  ['a repeated ingredient, the same on both sides', n => [[`2 ${n}`, `3 ${n}`, `1 ${n}`], [`3 ${n}`, `2 ${n}`, `1 ${n}`]]],
  ['a range kept', n => [[`2-3 tbsp ${n}`], [`2-3 tbsp ${n}`]]],
  ['a range kept with an en dash turned to a hyphen', n => [[`2–3 tbsp ${n}`], [`2-3 tbsp ${n}`]]],
  ['a recipe that says less than its source', n => [[`2 ${n} (the good kind)`], [`2 ${n}`]]],
  ['a compound line split in two', (n, q, u, o) => [[`${n} and ${o}, to taste`], [`${n}, to taste`, `${o}, to taste`]]],
  ['a dictionary spelling with a serving note and no comma', (n, q, u, o, r) => r.aliases.length ? [[`${r.aliases[0]} to taste`], [`${n}, to taste`]] : null],
  ['a spelling the dictionary lists, for its name', (n, q, u, o, r) => r.aliases.length ? [[Ln(q, u, r.aliases[0])], [Ln(q, u, n)]] : null],
  ['its name, for a spelling the dictionary lists', (n, q, u, o, r) => r.aliases.length ? [[Ln(q, u, n)], [Ln(q, u, r.aliases[r.aliases.length - 1])]] : null]];
const FLAG_OPS = [
  ['a line dropped', (n, q, u) => [[Ln(q, u, n)], []]],
  ['an ingredient added that the source lacks', (n, q, u) => [[], [Ln(q, u, n)]]],
  ...[[2, 'doubled'], [0.5, 'halved'], [3, 'tripled'], [0.1, 'a tenth'], [1.04, '4% out, in the same unit']].map(([m, w]) => [`an amount ${w}`, (n, q, u) => [[Ln(q, u, n)], [Ln(+(q * m).toFixed(3), u, n)]]]),
  ['a tsp and a tbsp mixed up', (n, q, u) => u === 'tsp' || u === 'tbsp' ? [[Ln(q, u, n)], [Ln(q, u === 'tsp' ? 'tbsp' : 'tsp', n)]] : null],
  ['grams written as kilos', (n, q, u) => u === 'g' ? [[Ln(q, u, n)], [Ln(q, 'kg', n)]] : null],
  ['ml written as litres', (n, q, u) => u === 'ml' ? [[Ln(q, u, n)], [Ln(q, 'l', n)]] : null],
  ['a count changed', (n, q, u) => u === '' ? [[Ln(q, u, n)], [Ln(q + 1, u, n)]] : null],
  ['a different ingredient', (n, q, u, o) => [[Ln(q, u, n)], [Ln(q, u, o)]]],
  ['a source line listed twice, the recipe once', (n, q, u) => [[Ln(q, u, n), Ln(q, u, n)], [Ln(q, u, n)]]],
  ['three source lines restructured to two, the total too small', n => [[`2 tbsp ${n}`, `1 tbsp ${n}`, `3 tbsp ${n}`], [`4 tbsp ${n}`, `1 tbsp ${n}`]]],
  ['two source lines restructured to three, the total too large', n => [[`300 g ${n}`, `100 g ${n}`], [`100 g ${n}`, `200 g ${n}`, `200 g ${n}`]]],
  ['a range collapsed to its low end', n => [[`2-3 tbsp ${n}`], [`2 tbsp ${n}`]]],
  ['a range collapsed to its high end', n => [[`2-3 tbsp ${n}`], [`3 tbsp ${n}`]]],
  ['a range shifted', n => [[`2-3 tbsp ${n}`], [`2-4 tbsp ${n}`]]],
  ['a pinch quantified as a spoon', n => [[`a pinch of ${n}`], [`1/4 tsp ${n}`]]],
  ['a spoon written as a pinch', n => [[`1 tsp ${n}`], [`1 pinch ${n}`]]],
  ['the second half of a compound line dropped', (n, q, u, o) => [[`${n} and ${o}, to taste`], [`${n}, to taste`]]]];
/* Nothing may silently disappear: every line handed in is drawn in a pair or listed on its own. */
const accountedFor = (f, src, rec) => src.every(l => f.matched.some(m => m.source === l) || f.sourceOnly.some(x => x === l || x.startsWith(l + ' (the "')))
  && rec.every(l => f.matched.some(m => m.recipe === l) || f.recipeOnly.some(x => x === l || x.startsWith(l + ' (the "')));
const sweep = (ops, expectFlag, withBackground) => {
  const wrong = []; let n = 0;
  vocab.forEach((r, i) => {
    if(withBackground && i % 6) return;
    const [q, u] = amountOf(r, i);
    const rest = vocab.slice(i + 1).concat(vocab.slice(0, i));
    const other = rest.find(o => !collides(o, r));
    /* the compound operators need a second ingredient that also stays out of the background */
    const bg = rest.filter(o => !collides(o, r) && !collides(o, other)).slice(0, 7).map((o, k) => Ln(...amountOf(o, i + k), o.name));
    ops.forEach(([name, make]) => {
      const pair = make(r.name, q, u, other.name, r); if(!pair) return;
      const f = withBackground ? fid(bg.concat(pair[0]), bg.slice().reverse().concat(pair[1])) : fid(pair[0], pair[1]);
      n++;
      const noted = !expectFlag && !/spelling/.test(name) && f.matched.some(m => m.note);
      const src = withBackground ? bg.concat(pair[0]) : pair[0], rec = withBackground ? bg.concat(pair[1]) : pair[1];
      if((flagCount(f) > 0) !== expectFlag || noted || !accountedFor(f, src, rec)) wrong.push(`${name}: ${JSON.stringify(pair)} => ${JSON.stringify(f)}`.slice(0, 380));
    });
  });
  return { n, wrong };
};
const quietPlain = sweep(QUIET_OPS, false, false), quietBg = sweep(QUIET_OPS, false, true);
const flagPlain = sweep(FLAG_OPS, true, false), flagBg = sweep(FLAG_OPS, true, true);
check(`across every ingredient in the dictionary, ${quietPlain.n} harmless conversions stay quiet`, quietPlain.wrong.length === 0, quietPlain.wrong.length + ' false alarms, e.g. ' + quietPlain.wrong[0]);
check(`    and with a recipe's other lines around them (${quietBg.n} more)`, quietBg.wrong.length === 0, quietBg.wrong.length + ' false alarms, e.g. ' + quietBg.wrong[0]);
check(`across every ingredient in the dictionary, ${flagPlain.n} conversion faults are all flagged`, flagPlain.wrong.length === 0, flagPlain.wrong.length + ' missed, e.g. ' + flagPlain.wrong[0]);
check(`    and with a recipe's other lines around them (${flagBg.n} more)`, flagBg.wrong.length === 0, flagBg.wrong.length + ' missed, e.g. ' + flagBg.wrong[0]);
/* Every pair of dictionary ingredients as a compound line: 8,010 of them were run
   once, when this was written; a spread of them runs here. */
const compoundWrong = [];
vocab.forEach((r, i) => [1, 7, 31].forEach(off => {
  const o = vocab[(i + off) % vocab.length], src = [`${r.name} and ${o.name}, to taste`];
  if(flagCount(fid(src, [`${r.name}, to taste`, `${o.name}, to taste`])) !== 0) compoundWrong.push('split: ' + src[0]);
  if(flagCount(fid(src, [`${r.name}, to taste`])) === 0) compoundWrong.push('half dropped: ' + src[0]);
}));
check('a compound line of any two dictionary ingredients is quiet when split and flagged when a half is dropped', compoundWrong.length === 0, compoundWrong.length + ' wrong, e.g. ' + compoundWrong[0]);

/* The converter's own test set (converter/test-set.md, tests 6-8), written by earlier
   sessions for a different purpose: sources, the outputs recorded as correct, and the
   wrong outputs its "Fails if" lines name. None of it was written for this check. */
const T6s = ['1½ tsp ground cumin', '2-3 tbsp olive oil', '1 large onion, diced', '2 x 400g tins chopped tomatoes', '1 cup plain flour', '4 tbsp butter, melted', 'a knob of butter to finish', 'juice of 1 lemon', 'golden syrup or honey (2 tbsp)', 'salt and freshly ground pepper to taste'];
const T6r = ['1 1/2 tsp ground cumin', '2-3 tbsp olive oil', '1 onion (large), diced', '800 g chopped tomatoes (2 tins)', '120 g plain flour', '60 g butter, melted', '1 knob butter, to finish', '1 lemon, juiced', '2 tbsp golden syrup (or honey)', 'salt, to taste', 'black pepper, to taste'];
const T7s = ['2 scallions, sliced', 'a handful of cilantro', '1 red bell pepper, sliced', '2 tbsp neutral oil', '150 ml heavy cream', '3 tbsp plain yogurt', '1 tbsp all-purpose flour', '2 tbsp soy sauce'];
const T7r = ['2 spring onions, sliced', '1 handful coriander', '1 red pepper, sliced', '2 tbsp neutral oil', '150 ml double cream', '3 tbsp plain yoghurt', '1 tbsp plain flour', '2 tbsp soy sauce'];
const T8s = ['1 large eggplant, cubed', '1 can (400g) garbanzo beans, drained', '250g ground beef', '1 stalk lemongrass, bruised', '2 kaffir lime leaves', '1 tbsp Thai green curry paste', '1 can (400 ml) coconut milk', '1 tbsp fish sauce', 'a big handful of arugula to serve'];
const T8r = ['1 aubergine (large), cubed', '400 g chickpeas (1 tin), drained', '250 g beef mince', '1 stalk lemongrass, bruised', '2 kaffir lime leaves', '1 tbsp Thai green curry paste', '400 ml coconut milk (1 tin)', '1 tbsp fish sauce', '1 handful rocket, to serve'];
const swapLine = (arr, from, to) => arr.map(l => l === from ? to : l);
const hardOf = f => f.sourceOnly.concat(f.recipeOnly, f.matched.filter(m => m.check).map(m => m.check.why));
const newHard = (src, good, bad) => { const had = new Set(hardOf(fid(src, good))); return hardOf(fid(src, bad)).filter(x => !had.has(x)); };
check('the converter test set\'s recorded correct output for its vocabulary test (test 7) is quiet',
      flagCount(fid(T7s, T7r)) === 0, JSON.stringify(hardOf(fid(T7s, T7r))));
const namedWrong = [
  ['a range collapsed to one figure (test 6, run 1)', T6s, T6r, swapLine(T6r, '2-3 tbsp olive oil', '2 tbsp olive oil')],
  ['a different product: oyster for soy sauce (test 7)', T7s, T7r, swapLine(T7r, '2 tbsp soy sauce', '2 tbsp oyster sauce')],
  ['an amount changed: 150 ml cream as 300 ml (test 7)', T7s, T7r, swapLine(T7r, '150 ml double cream', '300 ml double cream')],
  ['a line dropped: fish sauce (test 8)', T8s, T8r, T8r.filter(l => !/fish sauce/.test(l))],
  ['a line added that the source lacks (test 8)', T8s, T8r, T8r.concat(['1 tsp ground cumin'])]];
const namedMissed = namedWrong.filter(([, s, good, bad]) => newHard(s, good, bad).length === 0);
check('    and the wrong outputs it names that a comparison can see are each flagged, against its correct output', namedMissed.length === 0, namedMissed.map(x => x[0]).join('; '));
const soy = fid(T7s, swapLine(T7r, '2 tbsp soy sauce', '2 tbsp light soy sauce'));
check('    a recipe naming a product more specifically than its source (light soy sauce for soy sauce) is a soft note, listed, never a hard difference',
      flagCount(soy) === 0 && soy.matched.some(m => m.note && m.note.kind === 'specific' && /adds light/.test(m.note.why)), JSON.stringify(soy));
check('    and where the dictionary does not know the two as one product, the same addition is a hard difference',
      flagCount(fid(['1 tsp vanilla'], ['1 tsp vanilla extract'])) === 1, JSON.stringify(fid(['1 tsp vanilla'], ['1 tsp vanilla extract'])));

/* Six rows, not five: the leek under the misspelt GROUP x-y is still read, into
   the group above; only the GROUP line itself is reported as read past. */
const { remeasure } = require(path.join(ROOT, 'tools', 'remeasure.js'));
const rm = remeasure({ recipes: [
  { title: 'A', syntax: 'TITLE: A\nGROUP a:\n200 g curly kale\n3 tbsp honey or golden syrup\n1 tsp za\'atar\nSTAGE:\nMERGE a -> b: Cook [5 min]' },
  { title: 'B', syntax: 'TITLE: B\nGROUP a:\n100 g kale\n2 onions\nGROUP x-y:\n1 leek\nSTAGE:\nMERGE a -> b: Cook [5 min]' }],
  aliases: [{ kind: 'ingredient', alias: 'large onions', canonical: 'onion' }] });
check('tools/remeasure.js totals an export as the list does, and reports what to look at',
      rm.recipes === 2 && rm.rows === 6 && rm.wordMatches === 0 && JSON.stringify(rm.splits) === '[{"from":"curly kale","to":"kale"}]'
      && rm.shape.length === 1 && rm.shape[0].line === '3 tbsp honey or golden syrup' && rm.unread.map(u => u.line).join('|') === 'GROUP x-y:'
      && rm.other.includes("Za'atar"), JSON.stringify(rm));

check('stock files under Pantry before chicken can claim it', only('500 ml chicken stock').category === 'Pantry', only('500 ml chicken stock').category);

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
