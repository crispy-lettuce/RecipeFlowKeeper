/* Validates a batch of converted recipes against the app's OWN parser.

   The point of this script is that it reimplements nothing. It boots the
   real index.html (via app-under-test.html, so the CDN scripts are stubbed)
   in a headless browser and calls parseRecipe, computeColumns and
   computeTimeline inside the page. A validator that had its own idea of the
   format could pass a recipe the app then fails to render — which is the
   exact class of bug the offline harness exists to catch.

   Usage:
     node test/build.js
     node test/validate-recipes.js <file.md> [--json out.json]

   The input is whatever the conversion prompt's Present step produces:
   markdown with one fenced code block per recipe, each starting TITLE:.
   Prose between blocks is ignored. NOTHING is read from this repo — recipe
   data is never committed here, so the file lives outside it.

   Exit code is 1 if any recipe is held back. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const launchOpts = process.env.PLAYWRIGHT_CHROMIUM
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
  : {};

const srcPath = process.argv[2];
if(!srcPath){ console.error('usage: node test/validate-recipes.js <file.md> [--json out.json]'); process.exit(2); }
const jsonIdx = process.argv.indexOf('--json');
const jsonOut = jsonIdx > -1 ? process.argv[jsonIdx+1] : null;

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

  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await page.waitForTimeout(800);

  const haveFns = await page.evaluate(() => ({
    parseRecipe: typeof parseRecipe === 'function',
    computeColumns: typeof computeColumns === 'function',
    computeTimeline: typeof computeTimeline === 'function'
  }));
  if(!haveFns.parseRecipe || !haveFns.computeColumns){
    console.error('app functions not reachable in the page:', haveFns);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  for(const b of blocks){
    const r = await page.evaluate(text => {
      const p = parseRecipe(text);
      const cols = computeColumns(p.groups, p.stages);
      const timeline = computeTimeline(p.groups, p.stages);
      const merges = [];
      p.stages.forEach((ops, si) => ops.forEach(op => merges.push({
        stage: si+1, inputs: op.inputs, output: op.output,
        label: op.label, duration: op.duration
      })));
      return {
        title: p.title, source: p.source, sourceUrl: p.sourceUrl,
        imageUrl: p.imageUrl, time: p.time, servings: p.servings,
        equipment: p.equipment, tags: p.tags,
        groups: p.groups.map(g => ({ handle: g.handle, items: g.items })),
        /* The app's own quantity split, for the line-shape check below. */
        splits: p.groups.flatMap(g => g.items.map(line => ({ line, ...splitQty(line) }))),
        stageCount: p.stages.length,
        merges,
        columnErrors: cols.errors,
        rowCount: cols.rows.length,
        columnCount: cols.columns.length,
        timelineNull: timeline === null,
        setupCount: p.setup.length
      };
    }, b.text);

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

    /* A line the parser doesn't recognise is not an error anywhere — it
       simply falls through and is discarded, silently. A GROUP whose
       handle has a hyphen in it, or a MERGE written with a Unicode arrow,
       vanishes and the recipe renders as though those ingredients were
       never written. That is worse than a loud failure, so it is a
       blocker.

       These patterns mirror parseRecipe's own and must be kept in step
       with it — they answer only "would the parser recognise this line",
       never what it means. */
    const KEYWORD = /^(GROUP|STAGE|MERGE)\b/i;
    const RECOGNISED = [
      /^GROUP\s+(\w+)\s*:\s*$/i,
      /^STAGE:\s*$/i,
      /^MERGE\s+(.+?)\s*->\s*(\w+)\s*:\s*(.+)$/i
    ];
    b.text.split('\n').map(l => l.trim()).forEach(line => {
      if(!KEYWORD.test(line)) return;
      if(RECOGNISED.some(re => re.test(line))) return;
      blockers.push(`line silently ignored by the parser: "${line.slice(0,72)}"`);
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

    /* Ingredient lines outside the standard shape (conversion-instructions.md §1,
       docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §4.2). Warnings, not blockers: the
       recipe still renders and scales; what suffers is the shopping list, which totals
       lines by their wording. The quantity comes from the app's own splitQty. */
    const shapeFaults = [];
    const newNames = [], totalsAs = [];
    r.splits.forEach(split => {
      const { why, name, listed, isNew } = checkLine(split, VOCAB);
      if(why.length) shapeFaults.push(`"${split.line.slice(0,64)}" — ${why.join('; ')}`);
      else if(isNew && !newNames.includes(name)) newNames.push(name);
      /* Not a fault: the converter keeps the source's wording on purpose. Shown so
         a wrong dictionary entry is seen here rather than on the shopping list. */
      else if(listed && !totalsAs.includes(`${name} → ${listed}`)) totalsAs.push(`${name} → ${listed}`);
    });
    if(shapeFaults.length){
      warnings.push(`${shapeFaults.length} ingredient line(s) outside the standard shape:`);
      shapeFaults.forEach(f => warnings.push('    ' + f));
    }

    results.push({ line: b.line, ...r, blockers, warnings, newNames, totalsAs, bareMerges: bare.length, mergeCount: r.merges.length });
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
    if(r.newNames.length) console.log(`        new to ingredient-names.md (add one if it turns up in a second recipe): ${r.newNames.join(', ')}`);
    if(r.totalsAs.length) console.log(`        totals on the shopping list as: ${r.totalsAs.join(', ')}`);
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
