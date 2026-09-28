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
