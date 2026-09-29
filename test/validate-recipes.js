/* Validates a batch of converted recipes against the app's OWN parser.

   The point of this script is that it reimplements nothing. It boots the
   real index.html (via app-under-test.html, so the CDN scripts are stubbed)
   in a headless browser and calls parseRecipe, computeColumns and
   computeTimeline inside the page. A validator that had its own idea of the
   format could pass a recipe the app then fails to render — which is the
   exact class of bug the offline harness exists to catch.

   Usage:
     node test/build.js
     node test/validate-recipes.js <file.md> [--json out.json] [--source sources.txt]

   The input is whatever the conversion prompt's Present step produces:
   markdown with one fenced code block per recipe, each starting TITLE:.
   Prose between blocks is ignored. NOTHING is read from this repo — recipe
   data is never committed here, so the file lives outside it.

   --source names a second file, also kept outside the repo, of the source
   pages' own ingredient lists, keyed by title: a line "TITLE: <the recipe's
   title>" and then the page's ingredients as copied, one to a line (ticks,
   bullets and headings are dropped as the app's paste box drops them). Each
   recipe with a list is run through the app's own sourceFidelity, the check the
   add form runs, and reported: what is on one side only, what is paired but
   differs, what is more specific than its source. A report, never a blocker,
   like the app's (PR 3 of the add-recipe plan, 29 Sep 2026).

   The ingredient names it reports (new to the dictionary, and what a wording
   totals as) come from the app's own core.js functions, run inside the page, and
   no longer from a second reading of converter/ingredient-names.md. A recipe whose
   text carries a "Source note" that says it was not read from its own page is a
   warning with the line quoted. Warnings never hold a recipe back: the household
   decided against a gate.

   Exit code is 1 if any recipe is held back. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const launchOpts = process.env.PLAYWRIGHT_CHROMIUM
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
  : {};

const srcPath = process.argv[2];
if(!srcPath){ console.error('usage: node test/validate-recipes.js <file.md> [--json out.json] [--source sources.txt]'); process.exit(2); }
const jsonIdx = process.argv.indexOf('--json');
const jsonOut = jsonIdx > -1 ? process.argv[jsonIdx+1] : null;
const sourceIdx = process.argv.indexOf('--source');
const sourceFile = sourceIdx > -1 ? process.argv[sourceIdx+1] : null;
if(sourceIdx > -1 && !sourceFile){ console.error('--source needs a file: TITLE:-keyed ingredient lists, kept outside the repo'); process.exit(2); }

/* The --source file: "TITLE: x" starts a list, and every line after it, until the next
   TITLE:, is the page's own ingredient text. Keyed by title, case-insensitively. */
function readSourceLists(file){
  const lists = new Map();
  let key = null;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*TITLE:\s*(.+?)\s*$/i);
    if(m){ key = m[1]; lists.set(key.toLowerCase(), { title: m[1], text: '' }); }
    else if(key) lists.get(key.toLowerCase()).text += line + '\n';
  });
  return lists;
}

/* Pull out fenced blocks that look like recipe syntax. A block only counts
   if its first non-blank line is TITLE: — that keeps stray shell/JSON
   samples in the same document from being treated as recipes. */
function extractBlocks(md){
  const out = [];
  const lines = md.split('\n');
  let inFence = false, buf = null, fenceLine = 0;
  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(/^\s*```/.test(line)){
      if(!inFence){ inFence = true; buf = []; fenceLine = i+1; }
      else {
        inFence = false;
        const text = buf.join('\n');
        const first = text.split('\n').find(l=>l.trim()!=='') || '';
        if(/^TITLE:/i.test(first.trim())) out.push({ line: fenceLine, text });
        buf = null;
      }
      continue;
    }
    if(inFence) buf.push(line);
  }
  if(inFence) out.push({ line: fenceLine, text: buf.join('\n'), unterminated: true });
  return out;
}

/* The ingredient-line checks live in test/ingredient-lines.js, shared with
   test/ingredient-survey.js so the two tools cannot disagree. */
const { loadVocab, checkLine } = require('./ingredient-lines');
const VOCAB = loadVocab();

(async () => {
  const md = fs.readFileSync(srcPath, 'utf8');
  const blocks = extractBlocks(md);
  const sourceLists = sourceFile ? readSourceLists(sourceFile) : null;
  const sourceUsed = new Set();

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await page.waitForTimeout(800);

  const haveFns = await page.evaluate(() => ({
    parseRecipe: typeof parseRecipe === 'function',
    computeColumns: typeof computeColumns === 'function',
    computeTimeline: typeof computeTimeline === 'function',
    newRecipeReview: typeof newRecipeReview === 'function',
    sourceNoteIn: typeof sourceNoteIn === 'function',
    sourceFidelity: typeof sourceFidelity === 'function'
  }));
  if(Object.values(haveFns).some(v => !v)){
    console.error('app functions not reachable in the page:', haveFns);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  for(const b of blocks){
    /* The page's own list for this recipe, when --source gave one. */
    const list = sourceLists ? sourceLists.get(String((b.text.match(/^\s*TITLE:\s*(.+?)\s*$/im) || [])[1] || '').toLowerCase()) : null;
    if(list) sourceUsed.add(list.title.toLowerCase());
    const r = await page.evaluate(({ text, sourceText }) => {
      const p = parseRecipe(text);
      const cols = computeColumns(p.groups, p.stages);
      const timeline = computeTimeline(p.groups, p.stages);
      const merges = [];
      p.stages.forEach((ops, si) => ops.forEach(op => merges.push({
        stage: si+1, inputs: op.inputs, output: op.output,
        label: op.label, duration: op.duration
      })));
      /* What the shopping list will make of the recipe's lines, from core.js itself: which names
         the dictionary does not know (and which of those land in Other), and which wordings it
         totals under another name. A faulty line is left out, as before: it is fixed first, and
         its name may change when it is. */
      const ingLines = p.groups.flatMap(g => g.items).filter(line => !(p.unread || []).some(u => u.line === line));
      const cleanLines = ingLines.filter(line => !ingredientLineFaults(line).length);
      const review = newRecipeReview({ lines: cleanLines, sourceUrl: p.sourceUrl, recipeId: null, library: [], alias: null, isSettled: null });
      const newNames = review.names.filter(n => !dictionaryRow(n.key)).map(n => ({ name: n.name.toLowerCase(), other: n.other }));
      const totalsAs = [];
      cleanLines.forEach(line => {
        const { qty, rest } = splitQty(line);
        const s = shoppingLine(rest, parseIngredientAmount(qty));
        const row = s.dictionary ? dictionaryRow(s.key) : null;
        const own = rest.replace(/\([^)]*\)/g, ' ').split(',')[0].trim().toLowerCase()
          .replace(/^(?:pinch(?:es)?|bunch(?:es)?|handfuls?|sprigs?|slices?|rashers?|pieces?|tins?|knobs?|stalks?)\s+(?:of\s+)?/, '').trim();
        if(row && own && dictionaryRow(dictionaryKey(own)) === row && foldPlural(own) !== foldPlural(row.name.toLowerCase())){
          const t = `${own} → ${row.name}`;
          if(!totalsAs.includes(t)) totalsAs.push(t);
        }
      });
      const note = sourceNoteIn(text);
      let sourceCheck = null;
      if(sourceText !== null){
        const theirs = pastedIngredientLines(sourceText);
        const f = sourceFidelity(theirs, ingLines);
        const flagged = f.matched.filter(m => m.check);
        sourceCheck = {
          compared: theirs.length,
          sourceOnly: f.sourceOnly, recipeOnly: f.recipeOnly,
          differ: flagged.map(m => ({ source: m.source, recipe: m.recipe, why: m.check.why + (m.note ? ' · ' + m.note.why : '') })),
          soft: f.matched.filter(m => m.note && !m.check).map(m => ({ source: m.source, recipe: m.recipe, why: m.note.why }))
        };
      }
      return {
        newNames, totalsAs, note, sourceCheck,
        title: p.title, source: p.source, sourceUrl: p.sourceUrl,
        imageUrl: p.imageUrl, time: p.time, servings: p.servings,
        equipment: p.equipment, tags: p.tags,
        groups: p.groups.map(g => ({ handle: g.handle, items: g.items })),
        /* The app's own quantity split, for the line-shape check below. */
        splits: p.groups.flatMap(g => g.items.filter(line => !(p.unread || []).some(u => u.line === line))
          .map(line => ({ line, ...splitQty(line) }))),
        stageCount: p.stages.length,
        merges,
        columnErrors: cols.errors,
        rowCount: cols.rows.length,
        columnCount: cols.columns.length,
        timelineNull: timeline === null,
        setupCount: p.setup.length,
        unread: p.unread || []
      };
    }, { text: b.text, sourceText: list ? list.text : null });

    /* Held-back conditions, exactly as agreed in docs/HANDOVER.md §3.
       Anything here is reported, never guessed at. */
    const blockers = [];
    if(!r.title) blockers.push('no TITLE:');
    if(!r.source) blockers.push('no SOURCE:');
    if(r.servings === '') blockers.push('no SERVINGS:');
    else if(!/^\d+$/.test(String(r.servings).trim())) blockers.push(`SERVINGS: not a plain number ("${r.servings}")`);
    if(r.columnErrors.length) blockers.push(...r.columnErrors);
    if(!r.groups.length) blockers.push('no GROUP blocks');
    if(!r.stageCount) blockers.push('no STAGE blocks');
    if(b.unterminated) blockers.push('code fence never closed');

    /* A line the parser reads past used to be an error nowhere — it was
       simply discarded. A GROUP whose handle has a hyphen in it, or a MERGE
       written with a Unicode arrow, vanished and the recipe rendered as
       though those ingredients were never written. That is worse than a
       loud failure, so a GROUP/STAGE/MERGE line it could not read is a
       blocker. Since 28 Sep (PR 6c-1) the parser reports these itself
       (parseRecipe(...).unread), and the app's preview shows them; until
       then this file kept its own copy of the parser's patterns. Other
       lines it reads past (stray text under a STAGE) are warnings. */
    r.unread.forEach(u => {
      if(/^(GROUP|STAGE|MERGE)\b/i.test(u.line)) blockers.push(`line silently ignored by the parser: "${u.line.slice(0,72)}"`);
    });

    /* Warnings do not hold a recipe back — they are library-quality facts
       the audits in converter/test-set.md care about. */
    const warnings = [];
    const bare = r.merges.filter(m => !m.duration);

    /* A bracket the parser couldn't read is the nastiest of these,
       because it looks done. parseRecipe leaves such a label untouched,
       brackets and all, so the raw text shows in the diagram — the
       failure `[instant]` caused before the keyword existed. Reported
       separately from "no bracket at all", with the text shown, because
       `[to taste]` falling through is deliberate and fine while
       `[4-5 min]` with the wrong dash is a real loss. */
    const unread = r.merges
      .filter(m => !m.duration && /\]\s*$/.test(m.label))
      .map(m => (m.label.match(/\[([^\]]*)\]\s*$/) || [,''])[1]);
    if(unread.length) warnings.push(`${unread.length} bracket(s) present but NOT read as a duration: ${unread.map(u=>`[${u}]`).join(' ')}`);

    const trulyBare = bare.length - unread.length;
    if(trulyBare > 0) warnings.push(`${trulyBare} of ${r.merges.length} MERGE lines have no [duration] at all`);
    if(r.timelineNull) warnings.push('no timing data at all — the timeline strip will not render');
    if(!r.sourceUrl) warnings.push('no SOURCE_URL:');
    if(!r.imageUrl) warnings.push('no IMAGE:');
    if(!r.time) warnings.push('no TIME:');
    if(!r.equipment) warnings.push('no EQUIPMENT: (fine unless it needs size-specific bakeware)');
    if(!r.tags.course) warnings.push('no course= in TAGS:');
    r.unread.filter(u => !/^(GROUP|STAGE|MERGE)\b/i.test(u.line))
      .forEach(u => warnings.push(`line not read: "${u.line.slice(0,64)}" — ${u.why}`));

    /* Ingredient lines outside the standard shape (conversion-instructions.md §1,
       docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §4.2). Warnings, not blockers: the
       recipe still renders and scales; what suffers is the shopping list, which totals
       lines by their wording. The quantity comes from the app's own splitQty. */
    const shapeFaults = [];
    r.splits.forEach(split => {
      const { why } = checkLine(split, VOCAB);
      if(why.length) shapeFaults.push(`"${split.line.slice(0,64)}" — ${why.join('; ')}`);
    });
    if(shapeFaults.length){
      warnings.push(`${shapeFaults.length} ingredient line(s) outside the standard shape:`);
      shapeFaults.forEach(f => warnings.push('    ' + f));
    }
    /* A recipe converted from a page the converter could not read says so in its own text
       (converter/conversion-instructions.md §1, PR 2). Advice, never a gate. */
    if(r.note && r.note.reconstructed) warnings.push(`the text carries a source note saying it was not read from its own page: "${r.note.line.slice(0, 110)}"`);

    /* newNames and totalsAs are what the app's own core.js made of the lines (see the page code
       above); the names alone stay in `newNames` for anything reading --json, and the ones that
       land in Other are listed apart. */
    results.push({ line: b.line, ...r, blockers, warnings, newNames: r.newNames.map(n => n.name), newInOther: r.newNames.filter(n => n.other).map(n => n.name),
      bareMerges: bare.length, mergeCount: r.merges.length });
  }

  await browser.close();

  const held = results.filter(r => r.blockers.length);
  const ok = results.filter(r => !r.blockers.length);

  console.log(`Parsed ${results.length} recipe block${results.length===1?'':'s'} from ${srcPath}`);
  console.log(`  ${ok.length} valid, ${held.length} held back\n`);
  for(const r of results){
    const mark = r.blockers.length ? 'HELD' : 'ok  ';
    console.log(`${mark}  ${r.title || '(untitled)'}  [line ${r.line}]`);
    console.log(`        serves ${r.servings || '—'} · ${r.groups.length} groups · ${r.stageCount} stages · ${r.mergeCount} merges (${r.bareMerges} untimed) · ${r.rowCount} rows`);
    r.blockers.forEach(x => console.log(`        BLOCKER: ${x}`));
    r.warnings.forEach(x => console.log(`        warn:    ${x}`));
    if(r.newNames.length) console.log(`        new to the dictionary (add one if it turns up in a second recipe): ${r.newNames.map(n => n + (r.newInOther.includes(n) ? ' (Other)' : '')).join(', ')}`);
    if(r.totalsAs.length) console.log(`        totals on the shopping list as: ${r.totalsAs.join(', ')}`);
    if(sourceLists){
      const s = r.sourceCheck;
      if(!s) console.log(`        source check: no list for this recipe in ${path.basename(sourceFile)}`);
      else {
        const hard = s.sourceOnly.length + s.recipeOnly.length + s.differ.length;
        console.log(`        source check: ${hard ? hard + ' to look at' : 'no difference found'} (${s.compared} source lines)${s.soft.length ? `, ${s.soft.length} more specific than the source` : ''}`);
        s.sourceOnly.forEach(l => console.log(`          only in the source: "${l}"`));
        s.recipeOnly.forEach(l => console.log(`          only in the recipe: "${l}"`));
        s.differ.forEach(d => console.log(`          differs: "${d.source}" / "${d.recipe}" — ${d.why}`));
        s.soft.forEach(d => console.log(`          note: "${d.source}" / "${d.recipe}" — ${d.why}`));
      }
    }
  }
  if(sourceLists){
    const unused = [...sourceLists.values()].filter(l => !sourceUsed.has(l.title.toLowerCase()));
    if(unused.length) console.log(`\nsource lists with no recipe in this batch: ${unused.map(l => l.title).join('; ')}`);
  }
  if(pageErrors.length){
    console.log('\nPAGE ERRORS:');
    pageErrors.forEach(e => console.log('  ' + e));
  }

  if(jsonOut){
    fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
  process.exit(held.length ? 1 : 0);
})();
