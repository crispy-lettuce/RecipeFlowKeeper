/* Surveys ingredient lines extracted in bulk by the prompt in
   converter/ingredient-extraction-prompt.md, to grow converter/ingredient-names.md
   from recipes it has never seen, rather than only from the library it was built
   from (docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md, status row 3a).

   Usage:
     node test/build.js
     node test/ingredient-survey.js <extractions.md> [more.md …] [--out report.md]

   Input: fenced blocks whose first line is RECIPE:, as the prompt produces them:

     RECIPE: Green Curry Traybake
     SOURCE: Some Site
     1 aubergine, cubed | 1 large eggplant, cubed
     400 g chickpeas (1 tin), drained | 1 can (400g) garbanzo beans, drained
     ? 2 lime leaves | 2 kaffir lime leaves

   The left of " | " is the line in the standard shape; the right is the source's
   own wording, kept so real synonyms can be learnt from real sources. A leading
   "?" marks a line the extractor was unsure of.

   The files live OUTSIDE this repo. Even recipes from public sites are a
   household's choices, and this repo is public.

   Like validate-recipes.js it reimplements nothing: quantities are split by the
   app's own splitQty inside the built page, and the line checks are the shared
   ones in test/ingredient-lines.js. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { loadVocab, checkLine, fold } = require('./ingredient-lines');

const launchOpts = process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {};
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outPath = outIdx > -1 ? args[outIdx + 1] : null;
const inputs = args.filter((a, i) => outIdx === -1 || (i !== outIdx && i !== outIdx + 1));
if(!inputs.length){ console.error('usage: node test/ingredient-survey.js <extractions.md> [more.md …] [--out report.md]'); process.exit(2); }

function readRecipes(md, file){
  const recipes = [];
  let inFence = false, buf = [];
  md.split('\n').forEach(raw => {
    if(/^\s*```/.test(raw)){
      if(inFence){
        const lines = buf.map(l => l.trim()).filter(Boolean);
        if(lines.length && /^RECIPE:/i.test(lines[0])){
          const r = { file, title: lines[0].replace(/^RECIPE:\s*/i, ''), source: '', lines: [] };
          lines.slice(1).forEach(l => {
            if(/^SOURCE:/i.test(l)){ r.source = l.replace(/^SOURCE:\s*/i, ''); return; }
            const unsure = /^\?\s*/.test(l);
            const body = l.replace(/^\?\s*/, '');
            const cut = body.indexOf(' | ');
            r.lines.push({ std: (cut > -1 ? body.slice(0, cut) : body).trim(),
                           orig: cut > -1 ? body.slice(cut + 3).trim() : '', unsure });
          });
          recipes.push(r);
        }
      }
      inFence = !inFence; buf = []; return;
    }
    if(inFence) buf.push(raw);
  });
  return recipes;
}

/* The source's own name for an ingredient, stripped of the words a standard line
   leaves out ("a big handful of", "1 can", "large"), so "1 can (400g) garbanzo
   beans" reads as "garbanzo beans". Stripped repeatedly, because sources stack
   them. */
function sourceName(line){
  let n = line.toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[\[\]]/g, '')      // shop links: "[paprika](http://…)"
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s[–—-]\s|,|\/|\s+or\s+|\s+i\s+(use|like)\b/)[0]            // alternatives, asides
    .replace(/\s+/g, ' ').trim(), prev;
  do {
    prev = n;
    n = n.replace(/^[\d¼½¾⅓⅔⅛.\/\s-]+/, '')
         .replace(/^(g|kg|ml|l|oz|lbs?|cups?|tsp|tbsp|teaspoons?|tablespoons?)\b\s*/, '')
         .replace(/^(a|an|x|big|good|large|small|medium|heaped|level|generous|thumb-sized|fresh|freshly|finely|thinly|roughly|chopped|sliced|diced|minced|grated|shredded|chilled)\s+/, '')
         .replace(/^(cans?|tins?|jars?|packs?|packets?|pinch(es)?|bunch(es)?|handfuls?|sprigs?|slices?|strips?|rashers?|pieces?|knobs?|stalks?|sticks?|cloves?)\s+(of\s+)?(?=\S)/, '')
         .trim();
  } while(n !== prev);
  /* Preparation written without a comma: "onion peeled and thinly sliced". */
  return n.replace(/\s+(peeled|chopped|sliced|diced|minced|grated|shredded|trimmed|deseeded|de-stoned|cut|finely|thinly|roughly|lightly|chilled|divided|for|to|defrosted|rinsed|drained|halved|quartered|whisked|beaten|melted|softened|the|with|if|once|about|approx)\b.*$/, '').trim();
}

/* The strict pair rule from the review (§2.6): same last word, exactly one extra
   word, and that word is not one that changes what you buy. It found 25 real pairs
   in the library with none wrong; substring matching found 35 wrong ones. */
const PROTECT = new Set(('ground smoked spring red green yellow white black sweet baby double single clotted sour plain '
  + 'self-raising strong dark light golden caster icing brown cherry plum sun-dried stem garlic celery onion chilli '
  + 'lemon lime orange olive sesame coconut peanut almond vegetable chicken beef lamb pork fish soy oyster hot milk '
  + 'cream salted unsalted whole frozen dried cooked raw tinned canned streaky back basmati jasmine arborio long-grain '
  + 'wholemeal granulated demerara muscovado mixed bone-in boneless skinless egg rice wine cider malt balsamic tomato '
  + 'powder seed flake paste sauce juice zest stock cube leaf oil salt sugar curry').split(/\s+/));
function strictPairs(names){
  const out = [];
  for(const a of names) for(const b of names){
    if(a >= b) continue;
    const A = a.split(' '), B = b.split(' ');
    const [S, L] = A.length < B.length ? [A, B] : [B, A];
    if(L.length !== S.length + 1 || S[S.length - 1] !== L[L.length - 1]) continue;
    const extra = L.filter(w => !S.includes(w));
    if(extra.length === 1 && S.every(w => L.includes(w)) && !PROTECT.has(extra[0])) out.push([a, b, extra[0]]);
  }
  return out;
}

(async () => {
  const recipes = inputs.flatMap(f => readRecipes(fs.readFileSync(f, 'utf8'), path.basename(f)));
  if(!recipes.length){ console.error('no RECIPE: blocks found'); process.exit(2); }
  const vocab = loadVocab();

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await page.waitForTimeout(800);
  if(!await page.evaluate(() => typeof splitQty === 'function')){ console.error('splitQty not reachable; run node test/build.js first'); await browser.close(); process.exit(2); }
  const flat = recipes.flatMap((r, ri) => r.lines.map(l => ({ ri, ...l })));
  const splits = await page.evaluate(ls => ls.map(l => ({ std: splitQty(l.std), orig: l.orig ? splitQty(l.orig) : null })), flat);
  await browser.close();

  const byName = new Map();          // folded name -> {spellings, recipes, originals}
  const faults = [], survivors = [], unsure = [], spellingsToAdd = new Map();
  let cleanListed = 0, cleanNew = 0;
  flat.forEach((l, i) => {
    const r = recipes[l.ri];
    const where = `${r.title}${r.source ? ' (' + r.source + ')' : ''}`;
    const c = checkLine({ line: l.std, ...splits[i].std }, vocab);
    if(l.unsure) unsure.push(`\`${l.std}\` ← "${l.orig}" — ${where}`);
    if(c.why.length){
      faults.push(`\`${l.std}\` — ${c.why.join('; ')} — ${where}`);
      if(c.listed) survivors.push(c.name);
      return;
    }
    if(c.isNew) cleanNew++; else cleanListed++;
    const key = fold(c.name);
    if(!byName.has(key)) byName.set(key, { spellings: new Map(), recipes: new Set(), originals: new Set(), listed: !c.isNew });
    const e = byName.get(key);
    e.spellings.set(c.name, (e.spellings.get(c.name) || 0) + 1);
    e.recipes.add(l.ri);
    /* The source's own name for the same thing, once its quantity, size words and
       preparation are stripped the same way. Where it differs, it is a real-world
       synonym: a spelling to add under a listed name, or a note on a new one. */
    if(splits[i].orig){
      /* A source line holding two things ("salt and pepper") names neither. */
      /* A source line naming two things ("salt and pepper") or offering a choice
         ("vegetable or sunflower oil") is not a synonym for either. */
      let o = (/ and /.test(l.orig) && !/ and \w+ (seeds|cheese|sausages?)\b/.test(l.orig)) || / or /i.test(l.orig.replace(/\([^)]*\)/g, '')) ? '' : sourceName(l.orig);
      /* "spring onions scallions": the source glossed its own name. The gloss is
         the synonym. */
      if(o.startsWith(c.name + ' ')) o = o.slice(c.name.length + 1);
      const known = x => vocab.names.has(fold(x)) || vocab.synonyms.has(x);
      /* "coriander cilantro", "tomato puree paste": a known name glossed with
         another word. Which word is the synonym can't be told apart safely, so
         neither is proposed. */
      const words = o.split(' ');
      if(words.slice(1).some((_, k) => known(words.slice(0, k + 1).join(' ')))) o = '';
      if(known(o) || o.length < 3) o = '';
      if(o && fold(o) !== key){
        e.originals.add(o);
        if(e.listed && !vocab.synonyms.has(o)){
          const listedAs = vocab.listedAs.get(key) || c.name;
          if(!spellingsToAdd.has(listedAs)) spellingsToAdd.set(listedAs, new Set());
          spellingsToAdd.get(listedAs).add(o);
        }
      }
    }
  });

  const shown = e => [...e.spellings].sort((a, b) => b[1] - a[1])[0][0];
  const entries = [...byName.values()];
  const candidates = entries.filter(e => !e.listed && e.recipes.size >= 2).sort((a, b) => b.recipes.size - a.recipes.size);
  const onceOnly = entries.filter(e => !e.listed && e.recipes.size < 2);
  const pairs = strictPairs(entries.map(shown));
  const sources = new Set(recipes.map(r => r.source).filter(Boolean));

  const L = [];
  L.push(`# Ingredient survey — ${new Date().toISOString().slice(0, 10)}`, '');
  L.push(`**PRIVATE — keep outside the public repo.** ${recipes.length} recipes from ${sources.size || 'unnamed'} source(s), ${flat.length} ingredient lines, from: ${inputs.map(f => path.basename(f)).join(', ')}.`, '');
  L.push('| | Lines | Share |', '| --- | --- | --- |');
  const pct = n => flat.length ? Math.round(100 * n / flat.length) + '%' : '—';
  L.push(`| In the standard shape, with a listed name | ${cleanListed} | ${pct(cleanListed)} |`);
  L.push(`| In the standard shape, name not listed | ${cleanNew} | ${pct(cleanNew)} |`);
  L.push(`| Outside the standard shape | ${faults.length} | ${pct(faults.length)} |`);
  L.push(`| Marked unsure by the extractor | ${unsure.length} | ${pct(unsure.length)} |`, '');

  L.push('## 1. Candidates to add to ingredient-names.md', '');
  L.push('Names not on the list that turned up in two or more recipes. These are the ones worth a row: each is one ingredient that will otherwise be written more than one way. Check the source wordings before adding; they become the "Also written as" column.', '');
  if(candidates.length){
    L.push('| Write | Recipes | Source wordings seen |', '| --- | --- | --- |');
    candidates.forEach(e => L.push(`| ${shown(e)} | ${e.recipes.size} | ${[...e.originals].join(', ') || '—'} |`));
  } else L.push('None.');
  L.push('');

  L.push('## 2. Spellings to add under names already listed', '');
  L.push('The extractor chose a listed name, but the source called it something the "Also written as" column doesn\'t have yet. Adding them lets `validate-recipes.js` catch those wordings when a conversion lets one through.', '');
  if(spellingsToAdd.size){
    L.push('| Listed name | Add these spellings |', '| --- | --- |');
    [...spellingsToAdd].sort().forEach(([n, s]) => L.push(`| ${n} | ${[...s].join(', ')} |`));
  } else L.push('None.');
  L.push('');

  L.push('## 3. Possible duplicates', '');
  L.push('Pairs of names that differ by one word which does not change what you buy (the review\'s strict rule, §2.6). Either they are the same thing and one spelling should win, or the extra word matters and belongs on the never-ignore list.', '');
  L.push(pairs.length ? pairs.map(([a, b, x]) => `- *${a}* ~ *${b}* (extra word: "${x}")`).join('\n') : 'None.');
  L.push('');

  L.push('## 4. Lines outside the standard shape', '');
  L.push(`The extractor broke a rule the converter must follow${survivors.length ? `, including ${survivors.length} listed synonym(s) that survived` : ''}. Worth reading as a test of the instructions: a rule broken often here will be broken in conversions too.`, '');
  L.push(faults.length ? faults.map(f => '- ' + f).join('\n') : 'None.');
  L.push('');

  L.push('## 5. Lines the extractor was unsure of', '');
  L.push(unsure.length ? unsure.map(f => '- ' + f).join('\n') : 'None.');
  L.push('');

  L.push(`## 6. Seen in one recipe only (${onceOnly.length})`, '');
  L.push('No row needed yet. They appear here so a second sighting is easy to spot next time.', '');
  L.push(onceOnly.length ? onceOnly.map(shown).sort().join(', ') : 'None.');

  const report = L.join('\n') + '\n';
  if(outPath){ fs.writeFileSync(outPath, report); console.log(`wrote ${outPath}`); }
  else process.stdout.write(report);
})();
