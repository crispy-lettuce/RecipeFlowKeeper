/* Kitchen — the pure core: parsing, layout, quantities, scaling, naming.

   WHY A SECOND FILE (25 Sep 2026, PR 6a). Everything here is a function of its
   arguments: no DOM, no cache, no Supabase. Until today it lived inside
   index.html, so every test of it had to boot a browser, and the shopping-list
   release (PR 6b) rewrites exactly these functions. Here they load in Node in
   milliseconds (test/core.test.js) as well as in the page.
   docs/REVIEW-ARCHITECTURE-FINDINGS.md §1 answer 6 made the case: split by
   testability, not by size, and only when the pure logic is next rewritten.

   Moved verbatim — comments and all — from index.html, in the order below.
   The behaviour of the app did not change; the 236 smoke checks were the proof.

   Two rules keep the split honest, and test/core.test.js enforces both:
   - nothing in here touches document, window, cache or state;
   - nothing in here is also defined in index.html, where a second copy would
     silently win and the two would drift.

   The one thing read from outside is the flow table's colour set (PALETTE,
   MERGE_COLOR), and only when computeColumns runs: they follow the theme, and
   the theme belongs to the page.

   VERSIONED WITH index.html. GitHub Pages caches both files for up to ten
   minutes, independently, so for a short while after a deploy a device can
   hold a new index.html and an old core.js or the other way round. The page
   compares KITCHEN_CORE_VERSION with the version it was built for and asks
   for a reload rather than run on a mismatched pair. Bump both together. */
const KITCHEN_CORE_VERSION = '2026-09-25.1';


/* ======================= quantity split ======================= */

/* The leading quantity of an ingredient line, split from the rest.

   A NUMBER is a whole number or decimal ("2", "1.5"), a fraction ("1/2"),
   a mixed number ("1 1/2"), or a digit with a vulgar fraction ("1½",
   "1 ½", "½"). The mixed forms are tried first: before 22 Sep the pattern
   stopped at the first space, so "1 3/4 tbsp" was read as 1 and scaled to
   "2 3/4 tbsp" instead of "3 1/2 tbsp" — a wrong amount in front of the
   cook, measured on 3 lines of the real library.

   Around the number it also takes "up to", a range ("3-4", "3–4",
   "3 to 4") and a pack count ("3 x 125 g"), which before were no
   quantity at all, so those lines were never scaled or totalled
   (docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §2.2).

   DELIBERATELY NUMBERS AND MEASURES ONLY. Count words (pinch, clove, bunch)
   are a shopping-list matter: taught here, scaling would write
   "2 pinch salt", and every name that changes re-keys a tick. The unit
   list gains only the long spellings normalizeUnit already maps
   ("grams", "litre"), which were unreachable before. */
const QTY_NUM = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?\\s?[¼½¾⅓⅔]|\\d+(?:\\.\\d+)?|[¼½¾⅓⅔])';
const QTY_UNIT = '(?:g|kg|ml|l|cups?|tsp|tbsp|teaspoons?|tablespoons?|oz|lb|grams?|grammes?|kilos?|kgs|kilograms?|millilitres?|milliliters?|litres?|liters?)';
const QTY_RE = new RegExp('^((?:up to\\s+)?' + QTY_NUM +
  '(?:\\s*(?:-|–|—|\\s+to\\s+)\\s*' + QTY_NUM + ')?' +
  '(?:\\s*x\\s*' + QTY_NUM + ')?' +
  '(?:\\s?' + QTY_UNIT + ')?)\\s+(.*)$', 'i');
function splitQty(line){
  const m = line.match(QTY_RE);
  if(m && m[2]) return {qty:m[1].trim(), rest:m[2].trim()};
  return {qty:'', rest:line};
}


/* ======================= tags ======================= */

function parseTags(tagsRaw){
  const tags = {course:'', keywords:[]};
  if(!tagsRaw) return tags;
  tagsRaw.split(',').forEach(part=>{
    const idx = part.indexOf('=');
    if(idx===-1){
      const kw = part.trim();
      if(kw) tags.keywords.push(kw);
      return;
    }
    const k = part.slice(0,idx).trim().toLowerCase();
    const v = part.slice(idx+1).trim();
    if(!v) return;
    if(k==='course') tags.course = v;
    // Any other key (including old "occasion=" and "protein=" syntax from
    // before those were removed as separate fields) falls through as a
    // plain keyword — its value still matters even though neither exists
    // as its own field any more.
    else tags.keywords.push(v);
  });
  return tags;
}


/* ======================= step durations ======================= */

/* ------------------------------- Per-stage timing (POC) -------------------------------
   Optional duration on a MERGE line, written as a trailing bracket:
     [8 min]        -> fixed:   {min:8,  max:8,  openEnded:false}
     [10-15 min]    -> range:   {min:10, max:15, openEnded:false}
     [until done]   -> open-ended, deliberately no numbers at all:
                       {min:null, max:null, openEnded:true}
   No bracket at all (the overwhelming majority of existing recipes,
   including everything converted before this POC) -> duration: null,
   meaning "unknown," not "zero." Treated differently downstream from
   openEnded: null means the recipe simply hasn't been given timing data;
   openEnded means it HAS been considered and is genuinely indeterminate
   ("boil until the liquid's evaporated" has no fixed answer — pretending
   otherwise with a made-up number would be actively misleading for
   sequencing multiple recipes to finish together). Both cases mean
   "can't be used to calculate a starting time," but they're not the same
   fact, and the ordering UI needs to be honest about which one it's
   looking at rather than silently treating "no data yet" and "no fixed
   answer" as identical.

   The unit is intentionally minutes-only for this POC. If the parenthetical
   isn't recognisable as a number/range/"until", it's left alone — the whole
   original label just keeps whatever text was in the brackets, and duration
   stays null. A recipe author fumbling the format shouldn't lose their step
   label over it. */
function extractStepDuration(rawLabel){
  const m = rawLabel.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if(!m) return { label: rawLabel, duration: null };

  const before = m[1].trim();
  const bracket = m[2].trim().toLowerCase();

  /* Deliberately narrow: only phrases that are clearly stating a
     duration is open-ended ("until X", "till X") count. A bare "to" was
     initially included to also catch "cook to done" style phrasing, but
     that's too loose — it also matches non-duration brackets like
     "[to taste]", wrongly treating a seasoning note as a timing
     statement. Better to under-detect (leave it as unrecognised, label
     kept intact) than to silently mis-detect a duration where there
     isn't one. */
  if(/^(?:until|till)\b/.test(bracket)){
    return { label: before, duration: { min:null, max:null, openEnded:true } };
  }
  /* Exact matches, not prefixes — unlike until/till above, these are whole
     words the conversion instructions ask for verbatim, so there's no
     "cook to done"-style phrase to accidentally widen into. A genuinely
     zero-length step (plating, a final stir, a garnish) is a real timing
     fact, distinct from a step whose length just wasn't recorded — see
     the "instantaneous" comment on computeTimeline below, which this
     completes: a truly instant step gets duration 0, not the default
     filler. */
  if(bracket === 'instant'){
    return { label: before, duration: { min:0, max:0, openEnded:false, instant:true } };
  }
  /* An overnight (or similarly long, unattended) step is a real timing
     decision too, but plotting 8-12 hours literally would dwarf every
     other step on a shared same-session cooking timeline and make it
     useless — so this rides the same DEFAULT_STEP_MINUTES filler as
     open-ended below, badged distinctly rather than measured. */
  if(bracket === 'overnight'){
    return { label: before, duration: { min:null, max:null, openEnded:true, overnight:true } };
  }
  /* Everything below is "a number with a unit", so the unit vocabulary and
     the dash live in one place rather than being restated per pattern.

     Seconds are here because a 30-second step is a real thing a recipe
     says ("cook the garlic 30 sec") and the only way to write it without
     them is `[0.5 min]`, which nobody writes. Minutes stay the internal
     unit, so seconds arrive as a fraction — 30 sec is 0.5, not 30.

     DASH matters more than it looks: a range is the one place a converter
     naturally reaches for an en dash, because that's what a range is
     typographically. An ASCII-only pattern read `[4–5 min]` as an
     unrecognised bracket and left it sitting in the step label as raw
     text — the same visible-bracket failure `[instant]` caused before it
     was understood. Accepting the dash family costs nothing: the
     characters are unambiguous between two numbers. */
  const UNIT = '(sec|secs|seconds?|min|mins|minutes?|m|hrs?|hours?|h)';
  const DASH = '[-\\u2010-\\u2015]';
  const unitMultiplier = u => /^h/.test(u) ? 60 : /^s/.test(u) ? 1/60 : 1;

  /* A compound "1 hr 30" is how the TIME: field is already written, so a
     step duration gets written the same way sooner or later. Checked
     before the plain patterns because neither would match it — it would
     otherwise fall through to unrecognised. */
  const compound = bracket.match(new RegExp(`^~?\\s*(\\d+)\\s*(?:hrs?|hours?|h)\\s*(\\d+)\\s*(?:mins?|minutes?|m)?$`));
  if(compound){
    const n = parseInt(compound[1],10) * 60 + parseInt(compound[2],10);
    return { label: before, duration: { min:n, max:n, openEnded:false } };
  }
  const range = bracket.match(new RegExp(`^~?\\s*(\\d+(?:\\.\\d+)?)\\s*${DASH}\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?$`));
  if(range){
    const mult = unitMultiplier((range[3]||'').toLowerCase()); // hours -> minutes internally, so all downstream maths is one unit
    const a = parseFloat(range[1]) * mult, b = parseFloat(range[2]) * mult;
    return { label: before, duration: { min: Math.min(a,b), max: Math.max(a,b), openEnded:false } };
  }
  const fixed = bracket.match(new RegExp(`^~?\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?$`));
  if(fixed){
    const n = parseFloat(fixed[1]) * unitMultiplier((fixed[2]||'').toLowerCase());
    return { label: before, duration: { min:n, max:n, openEnded:false } };
  }
  // Bracket present but not recognised as a duration — leave the label
  // and bracket exactly as written rather than silently dropping content
  // the author may have meant as something else (an aside, a brand name).
  return { label: rawLabel, duration: null };
}


/* ======================= parser, header lines, scaling, layout, timeline ======================= */

function parseRecipe(text){
  const rawLines = String(text||'').split('\n');
  let title='', source='', sourceUrl='', imageUrl='', time='', servings='', equipment='', tagsRaw='', setup=[], groups=[], stages=[];
  /* NOTES is now structured into named subsections — Variations/Storing/
     Freezing/Tips — rather than one flat list, per the 14 Aug decision.
     `general` is the fallback bucket: anything under a bare NOTES: with
     no subheading (including every recipe converted before this change)
     still lands here unchanged, so nothing existing breaks or needs
     migrating — it's additive, not a replacement for the old format. */
  let notes = {general:[], variations:[], storing:[], freezing:[], tips:[]};
  let mode='', currentGroup=null, currentStage=null;
  for(const raw of rawLines){
    const line = raw.trim();
    if(line==='') continue;
    let m;
    if(m = line.match(/^TITLE:\s*(.*)$/i)){ title = m[1].trim(); mode=''; continue; }
    if(m = line.match(/^SOURCE:\s*(.*)$/i)){ source = m[1].trim(); mode=''; continue; }
    /* Where the recipe came from. Carried in the syntax rather than only in
       the form, so a reprocessed recipe pasted back in brings its own origin
       with it and the link survives the round trip. SOURCE_URL is what the
       converter instructions specify; bare URL is accepted as an alias
       because it is the obvious thing to type by hand. Must be tested before
       nothing else — /^SOURCE:/ cannot match "SOURCE_URL:" anyway, since the
       colon does not follow, but keeping them adjacent makes that visible. */
    if(m = line.match(/^(?:SOURCE_URL|URL):\s*(.*)$/i)){ sourceUrl = m[1].trim(); mode=''; continue; }
    if(m = line.match(/^IMAGE:\s*(.*)$/i)){ imageUrl = m[1].trim(); mode=''; continue; }
    if(m = line.match(/^TIME:\s*(.*)$/i)){ time = m[1].trim(); mode=''; continue; }
    if(m = line.match(/^SERVINGS:\s*(.*)$/i)){ servings = m[1].trim(); mode=''; continue; }
    /* EQUIPMENT: a size-specific tin/tray/dish the original quantities were
       written for (e.g. "20cm springform tin"). Structured deliberately —
       per the 14 Aug scaling decision, auto-detecting this from free text
       in STEPS/MERGE labels is unreliable (misses phrasings without an
       exact keyword, false-positives on unrelated pans mentioned for
       sautéing), so it's a field the person states once, the same way
       SOURCE is never guessed. Optional: leave it out entirely for recipes
       with no size-specific bakeware (most savoury stovetop dishes, say),
       and the scaling banner simply won't have anything to warn about. */
    if(m = line.match(/^EQUIPMENT:\s*(.*)$/i)){ equipment = m[1].trim(); mode=''; continue; }
    if(m = line.match(/^TAGS:\s*(.*)$/i)){ tagsRaw = m[1].trim(); mode=''; continue; }
    if(m = line.match(/^STEPS:\s*$/i)){ mode='steps'; continue; }
    if(m = line.match(/^NOTES:\s*$/i)){ mode='notes-general'; continue; }
    if(m = line.match(/^VARIATIONS:\s*$/i)){ mode='notes-variations'; continue; }
    if(m = line.match(/^STORING:\s*$/i)){ mode='notes-storing'; continue; }
    if(m = line.match(/^FREEZING:\s*$/i)){ mode='notes-freezing'; continue; }
    if(m = line.match(/^TIPS:\s*$/i)){ mode='notes-tips'; continue; }
    if(m = line.match(/^GROUP\s+(\w+)\s*:\s*$/i)){ currentGroup = {handle:m[1], items:[]}; groups.push(currentGroup); mode='group'; continue; }
    if(m = line.match(/^STAGE:\s*$/i)){ currentStage = []; stages.push(currentStage); mode='stage'; continue; }
    if(m = line.match(/^MERGE\s+(.+?)\s*->\s*(\w+)\s*:\s*(.+)$/i)){
      const inputs = m[1].split(',').map(s=>s.trim()).filter(Boolean);
      if(!currentStage){ currentStage=[]; stages.push(currentStage); }
      const {label, duration} = extractStepDuration(m[3].trim());
      currentStage.push({inputs, output:m[2].trim(), label, duration});
      mode='stage';
      continue;
    }
    if(mode==='steps') setup.push(line);
    else if(mode==='notes-general') notes.general.push(line);
    else if(mode==='notes-variations') notes.variations.push(line);
    else if(mode==='notes-storing') notes.storing.push(line);
    else if(mode==='notes-freezing') notes.freezing.push(line);
    else if(mode==='notes-tips') notes.tips.push(line);
    else if(mode==='group' && currentGroup) currentGroup.items.push(line);
  }
  return {title, source, sourceUrl, imageUrl, time, servings, equipment, tags: parseTags(tagsRaw), setup, notes, groups, stages};
}

/* The header lines and the form are two copies of the same eight facts —
   title, source, source URL, image, time, servings, equipment, tags — so
   they can drift: editing a field doesn't touch the pasted syntax beneath
   it. docs/ARCHITECTURE.md §2 makes the text the source of truth, and
   parseAndPreview refills the form from a parse, so a line left stale is
   not cosmetic: the next PARSE & PREVIEW reads the old value back over the
   field and silently undoes the edit. Until 23 Sep only TITLE: and IMAGE:
   were reconciled (docs/REVIEW-ARCHITECTURE-FINDINGS.md F5); the live
   library had a SOURCE: line, a SERVINGS: line and two TAGS: lines that
   disagreed with their columns, each left by a save through the form.

   One function for all eight, called on every save (add and edit):

   - an existing line is rewritten in place, whatever its position;
   - a missing line is inserted where the converter would have put it,
     after the nearest header that precedes it in HEADER_ORDER;
   - an empty value removes the line, so "no image" or "no equipment" is
     written the way a converter writes it — by leaving the line out —
     rather than as an empty `EQUIPMENT:`. TITLE: is never empty (the save
     handler substitutes 'Untitled recipe') so it is never removed.

   Matching mirrors parseRecipe: case-insensitive, and SOURCE_URL accepts
   the bare URL: spelling the parser also accepts. */
const HEADER_ORDER = ['TITLE', 'SOURCE', 'SOURCE_URL', 'IMAGE', 'TIME', 'SERVINGS', 'EQUIPMENT', 'TAGS'];
const HEADER_MATCH = {
  TITLE: /^TITLE:\s*.*$/im,
  SOURCE: /^SOURCE:\s*.*$/im,
  SOURCE_URL: /^(?:SOURCE_URL|URL):\s*.*$/im,
  IMAGE: /^IMAGE:\s*.*$/im,
  TIME: /^TIME:\s*.*$/im,
  SERVINGS: /^SERVINGS:\s*.*$/im,
  EQUIPMENT: /^EQUIPMENT:\s*.*$/im,
  TAGS: /^TAGS:\s*.*$/im,
};
function withUpdatedHeaderLine(syntaxText, key, value){
  const text = String(syntaxText || '');
  const clean = (value === null || value === undefined) ? '' : String(value).trim();
  const re = HEADER_MATCH[key];
  const line = `${key}: ${clean}`;
  if(re.test(text)){
    /* A function, not a string, as the replacement: a title containing `$&`
       or `$1` would otherwise be read as a back-reference. The `\n?` on
       removal takes the line's own newline with it, so a dropped header
       leaves no blank line behind in the block. */
    return clean
      ? text.replace(re, () => line)
      : text.replace(new RegExp(re.source + '\\n?', 'im'), '');
  }
  if(!clean) return text;
  /* Insert after the closest header that should precede this one. Splicing
     by index rather than replacing the matched string, so a header whose
     text also occurs earlier in the recipe cannot be mistaken for it. */
  const idx = HEADER_ORDER.indexOf(key);
  for(let i = idx - 1; i >= 0; i--){
    const m = text.match(HEADER_MATCH[HEADER_ORDER[i]]);
    if(m){
      const end = m.index + m[0].length;
      return text.slice(0, end) + `\n${line}` + text.slice(end);
    }
  }
  /* Nothing precedes it: put it before the first header that follows, or
     first of all rather than lose it. */
  for(let i = idx + 1; i < HEADER_ORDER.length; i++){
    const m = text.match(HEADER_MATCH[HEADER_ORDER[i]]);
    if(m) return text.slice(0, m.index) + `${line}\n` + text.slice(m.index);
  }
  return `${line}\n${text}`;
}

/* The TAGS: line as the converter writes it and parseTags reads it:
   `course=Main, keyword, keyword`. parseTags folds any other `key=` pair
   into a plain keyword, so a rewritten line carries the same information
   the parse did, spelled the one way the app now writes. */
function tagsToLine(tags){
  const t = tags || {};
  const parts = [];
  if(t.course) parts.push(`course=${t.course}`);
  (t.keywords || []).forEach(k => { if(k) parts.push(k); });
  return parts.join(', ');
}

/* Every header line from the form's fields, in one pass. `fields` is the
   object the save handler builds, so the row and the text are written
   from the same values and cannot disagree. */
function withUpdatedHeaderLines(syntaxText, fields){
  let text = String(syntaxText || '');
  text = withUpdatedHeaderLine(text, 'TITLE', fields.title);
  text = withUpdatedHeaderLine(text, 'SOURCE', fields.source);
  text = withUpdatedHeaderLine(text, 'SOURCE_URL', fields.sourceUrl);
  text = withUpdatedHeaderLine(text, 'IMAGE', fields.imageUrl);
  text = withUpdatedHeaderLine(text, 'TIME', fields.time);
  text = withUpdatedHeaderLine(text, 'SERVINGS', fields.servings);
  text = withUpdatedHeaderLine(text, 'EQUIPMENT', fields.equipment);
  text = withUpdatedHeaderLine(text, 'TAGS', tagsToLine(fields.tags));
  return text;
}

/* The two original single-line helpers, kept as names because the image
   sweep's write-back (applyRehostedUrl, runImageSweep) still reconciles
   IMAGE: on its own, and because the general function above grew out of
   them. Behaviourally they are the general function with the key fixed. */
function withUpdatedTitleLine(syntaxText, newTitle){
  return withUpdatedHeaderLine(syntaxText, 'TITLE', newTitle);
}
function withUpdatedImageLine(syntaxText, url){
  return withUpdatedHeaderLine(syntaxText, 'IMAGE', url);
}

/* ------------------------------- Scaling -------------------------------
   Rewrites ingredient quantities and SERVINGS in raw syntax text by a
   multiplier — used by both permanent scaling (Edit screen, saves back to
   the recipe) and ad-hoc scaling (Viewer, session-only, never saved). Same
   function underlies both, since the actual maths is identical; only what
   happens to the result differs.

   Deliberately conservative: only lines inside a GROUP block are touched
   (ingredient lines), identified via splitQty the same way the flow table
   itself parses them — never STEPS, MERGE labels, or NOTES text, since a
   number appearing there might be an oven temperature, a stage duration,
   or plain prose, not a quantity to scale. A line whose quantity isn't in
   a form parseIngredientAmount recognises (a whole item with no number,
   "a pinch", "to taste") is left completely untouched rather than guessed
   at — the same "don't guess" principle used throughout this app.

   EQUIPMENT is never touched here — that's the entire point of the field;
   see the 14 Aug decision on flagging rather than attempting to scale
   bakeware.

   Known limitation: purely arithmetic, no grammar awareness. Scaling
   "2 large eggs" down to ×0.5 produces "1 large eggs," not "1 large egg" —
   fixing singular/plural agreement for arbitrary ingredient names would
   need real language handling, not a regex, so this is left as a minor
   cosmetic rough edge rather than attempted and gotten subtly wrong in a
   different way. The number itself is always correct.

   Related: phrasing like "1/2 a lemon" (with the article "a") scales to
   something like "1 1/2 a lemon" — awkward, but pre-existing to splitQty
   itself, not introduced by scaling. Writing "1/2 lemon" without the
   article avoids it and scales cleanly; not fixed here to avoid touching
   splitQty's parsing, which the shopping list and everything else also
   depends on. */
function scaleRecipeSyntax(syntaxText, multiplier){
  const lines = String(syntaxText||'').split('\n');
  let inGroup = false;
  const scaledLines = lines.map(line=>{
    const trimmed = line.trim();
    if(/^GROUP\s+\w+\s*:\s*$/i.test(trimmed)){ inGroup = true; return line; }
    /* Any header line ends the group — including the keyed ones that carry a
       value (TITLE:, SERVINGS: and friends). They only ever appear above the
       first GROUP today, so this is belt and braces, but after P1 this runs
       on every shopping-list build and a stray "TIME: 1 hr" below a group
       would otherwise be read as an ingredient and scaled. */
    if(trimmed === ''
       || /^(STEPS|STAGE|NOTES|VARIATIONS|STORING|FREEZING|TIPS)\s*:?\s*$/i.test(trimmed)
       || /^(TITLE|SOURCE|SOURCE_URL|URL|IMAGE|TIME|SERVINGS|EQUIPMENT|TAGS)\s*:/i.test(trimmed)
       || /^MERGE\b/i.test(trimmed)){
      inGroup = false;
      return line;
    }
    if(!inGroup) return line;

    const {qty, rest} = splitQty(trimmed);
    if(!qty) return line; // no recognisable leading quantity at all — a bare "salt to taste" style line, left as-is
    const parsed = parseIngredientAmount(qty);
    if(!parsed) return line; // quantity present but not a form we can scale confidently (e.g. "a pinch")
    // keep a space between amount and unit only if the original had one ("3 tbsp" vs "500g")
    const unitText = parsed.unit ? `${parsed.space ? ' ' : ''}${parsed.unit}` : '';
    let rebuiltQty;
    if(parsed.count !== undefined){
      /* "3 x 125 g tins": more people means more tins, not bigger ones. */
      rebuiltQty = `${formatAmount(parsed.count * multiplier)} x ${formatAmount(parsed.each)}${unitText}`;
    } else if(parsed.low !== undefined){
      const dash = /to/i.test(parsed.dash) ? ' to ' : parsed.dash;
      rebuiltQty = `${formatAmount(parsed.low * multiplier)}${dash}${formatAmount(parsed.high * multiplier)}${unitText}`;
    } else {
      rebuiltQty = `${formatAmount(parsed.amount * multiplier)}${unitText}`;
    }
    return (parsed.upTo ? 'up to ' : '') + rebuiltQty + ' ' + rest;
  });

  let result = scaledLines.join('\n');

  // SERVINGS scales too, rounded to a whole number — you can't cook for 4.5 people
  result = result.replace(/^SERVINGS:\s*(.*)$/im, (full, val)=>{
    const n = parseFloat(val.trim());
    if(isNaN(n)) return full;
    return `SERVINGS: ${Math.max(1, Math.round(n * multiplier))}`;
  });

  return result;
}

function buildRows(groups){
  const rows=[]; const ranges={};
  groups.forEach(g=>{
    const start = rows.length;
    g.items.forEach(item=>{
      const {qty,rest} = splitQty(item);
      rows.push({qty,rest});
    });
    ranges[g.handle] = {rowStart:start, rowSpan:g.items.length};
  });
  return {rows, ranges};
}

function computeColumns(groups, stages){
  const {rows, ranges} = buildRows(groups);
  const errors = [];
  let active = {};
  groups.forEach((g,i)=>{
    if(!ranges[g.handle]) return;
    active[g.handle] = { rowStart: ranges[g.handle].rowStart, rowSpan: ranges[g.handle].rowSpan, label:'', color: PALETTE[i % PALETTE.length] };
  });

  const columns = [];

  stages.forEach((stageOps, stageIdx)=>{
    const consumed = new Set();
    const newBoxes = [];
    stageOps.forEach(op=>{
      const missing = op.inputs.filter(h=>!active[h]);
      if(missing.length){ errors.push(`Stage ${stageIdx+1}: unknown or already-used handle "${missing.join(', ')}".`); return; }
      const boxes = op.inputs.map(h=>({handle:h, ...active[h]})).sort((a,b)=>a.rowStart-b.rowStart);
      for(let i=1;i<boxes.length;i++){
        if(boxes[i].rowStart !== boxes[i-1].rowStart + boxes[i-1].rowSpan){
          errors.push(`Stage ${stageIdx+1}: "${op.inputs.join(', ')}" aren't adjacent rows, so they can't merge into one box.`);
        }
      }
      const rowStart = boxes[0].rowStart;
      const rowSpan = boxes.reduce((n,b)=>n+b.rowSpan,0);
      const color = boxes.length>1 ? MERGE_COLOR : boxes[0].color;
      op.inputs.forEach(h=>consumed.add(h));
      newBoxes.push({ outputHandle:op.output, rowStart, rowSpan, label:op.label, duration:op.duration||null, color, passthrough:false });
    });

    const carried = [];
    Object.keys(active).forEach(h=>{
      if(!consumed.has(h)) carried.push({ outputHandle:h, ...active[h], passthrough:true });
    });

    const nextActive = {};
    newBoxes.forEach(b=>{ nextActive[b.outputHandle] = {rowStart:b.rowStart, rowSpan:b.rowSpan, label:b.label, duration:b.duration, color:b.color}; });
    carried.forEach(b=>{ nextActive[b.outputHandle] = {rowStart:b.rowStart, rowSpan:b.rowSpan, label:b.label, duration:b.duration, color:b.color}; });
    active = nextActive;

    columns.push([...newBoxes, ...carried].sort((a,b)=>a.rowStart-b.rowStart));
  });

  return {rows, columns, errors};
}

/* ------------------------------- Timeline (persistent strip) -------------------------------
   Derives each step's absolute start/end time from the SAME dependency
   graph computeColumns already walks — STAGE order plus which handles
   feed into which MERGE — rather than needing separate timing data. The
   flow syntax already encodes "what happens after what"; this just adds
   "how long," using each step's optional duration (from the 14 Aug
   timing POC) on top of that existing structure.

   Algorithm: walk stages in order (they're already causally ordered — a
   later stage can only consume handles a prior stage produced). A step's
   start time is the latest finish time among everything it consumes; a
   step with no inputs still waiting on anything starts at 0. A step's
   duration is its own recorded timing if present; if absent, a small
   default is used so it still occupies a visible sliver on the timeline
   rather than a zero-width block — deliberately NOT zero, since "no
   timing recorded" and "instantaneous" are different facts and a
   zero-width block would visually claim the latter.

   Returns null if there's no timing data at all anywhere in the recipe —
   the caller uses this to decide whether the timeline strip is worth
   showing (see the "auto-hide when nothing to show" direction from the
   14 Aug mockup discussion). */
const DEFAULT_STEP_MINUTES = 2; // sliver width for steps with no recorded duration, not a claim they take exactly 2 min
function computeTimeline(groups, stages){
  const {ranges} = buildRows(groups);
  let active = {}; // handle -> finishTime
  groups.forEach(g=>{ if(ranges[g.handle]) active[g.handle] = 0; }); // raw ingredients are "ready" at t=0

  const steps = [];
  let anyRealDuration = false;

  stages.forEach(stageOps=>{
    const nextActive = {...active};
    stageOps.forEach(op=>{
      const missing = op.inputs.filter(h=>!(h in active));
      if(missing.length) return; // same malformed-syntax case computeColumns already reports as an error elsewhere
      const startTime = Math.max(0, ...op.inputs.map(h=>active[h]));
      const d = op.duration;
      let durationMin;
      if(d && !d.openEnded){ durationMin = (d.min + d.max) / 2; anyRealDuration = true; }
      else if(d && d.openEnded){ durationMin = DEFAULT_STEP_MINUTES; anyRealDuration = true; } // open-ended still proves timing was considered, just not a fixed figure
      else { durationMin = DEFAULT_STEP_MINUTES; }
      const endTime = startTime + durationMin;
      steps.push({ label: op.label, duration: d||null, start: startTime, end: endTime, output: op.output });
      nextActive[op.output] = endTime;
    });
    active = nextActive;
  });

  if(!anyRealDuration) return null; // nothing to show a timeline for — every step is the same unknown-length sliver
  const totalSpan = steps.length ? Math.max(...steps.map(s=>s.end)) : 0;
  return { steps, totalSpan };
}


/* ======================= amounts, names, categories ======================= */

/* ------------------------------- Amount parsing ------------------------------- */
function parseFraction(s){
  const fracMap = {'¼':0.25,'½':0.5,'¾':0.75,'⅓':1/3,'⅔':2/3};
  s = String(s).trim();
  if(fracMap[s] !== undefined) return fracMap[s];
  let m;
  if(m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)) return +m[3] ? +m[1] + (+m[2])/(+m[3]) : null;  // "1 1/2"
  if(m = s.match(/^(\d+(?:\.\d+)?)\s?([¼½¾⅓⅔])$/)) return +m[1] + fracMap[m[2]];               // "1½", "1 ½"
  if(s.indexOf('/') !== -1){
    const parts = s.split('/');
    const n = parseFloat(parts[0]), d = parseFloat(parts[1]);
    return (!isNaN(n) && !isNaN(d) && d !== 0) ? n/d : null;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function normalizeUnit(u){
  const map = {
    teaspoon:'tsp', teaspoons:'tsp', tablespoon:'tbsp', tablespoons:'tbsp', cups:'cup',
    gram:'g', grams:'g', gramme:'g', grammes:'g',
    kilogram:'kg', kilograms:'kg', kilo:'kg', kilos:'kg', kgs:'kg',
    millilitre:'ml', millilitres:'ml', milliliter:'ml', milliliters:'ml',
    litre:'l', litres:'l', liter:'l', liters:'l', ltr:'l'
  };
  const lu = (u||'').toLowerCase();
  return map[lu] || lu;
}
/* One base unit per system, so "500 g flour" and "1 kg flour" total instead
   of sitting on the shelf as two separate lines. Metric only, and
   deliberately: mixing grams with ounces would mean picking a system to
   show the total in, and the library is metric throughout. */
const UNIT_BASES = { kg: {unit:'g', factor:1000}, l: {unit:'ml', factor:1000} };
function toBaseUnit(amount, unit){
  const base = UNIT_BASES[unit];
  return base ? { amount: amount * base.factor, unit: base.unit } : { amount, unit };
}
/* And back out again for display: grams up to a kilo stay grams. */
function formatShoppingQty(amount, unit){
  if(unit === 'g' && amount >= 1000) return `${formatAmount(amount/1000)} kg`;
  if(unit === 'ml' && amount >= 1000) return `${formatAmount(amount/1000)} L`;
  return `${formatAmount(amount)}${unit ? ' '+unit : ''}`;
}
/* Turns splitQty's raw quantity string ("500g", "3 tbsp", "1/2 tsp", "4")
   into {amount, unit}. Returns null when it doesn't reduce to a clean
   number — those ingredients still appear, just without a combined total,
   per the deliberate no-AI-guessing rule for this app. */
/* Beyond {amount, unit} it reports the shape, so scaling can rewrite each
   number where it stands: `low`/`high` for a range, `count` for "3 x 125 g"
   (amount is then the whole, 375 g), `upTo` for "up to 500 ml". A range
   buys its upper figure — the shopping list should never leave you short. */
const QTY_PARTS_RE = new RegExp('^(up to\\s+)?(' + QTY_NUM + ')' +
  '(?:\\s*(-|–|—|\\s+to\\s+)\\s*(' + QTY_NUM + '))?' +
  '(?:\\s*x\\s*(' + QTY_NUM + '))?' +
  '(\\s?)([a-zA-Z]*)$', 'i');
function parseIngredientAmount(qtyStr){
  if(!qtyStr) return null;
  const m = String(qtyStr).trim().match(QTY_PARTS_RE);
  if(!m) return null;
  const first = parseFraction(m[2]);
  if(first === null) return null;
  const unit = normalizeUnit(m[7]);
  const base = { unit, upTo: !!m[1], space: m[6] };
  if(m[5] !== undefined){
    const each = parseFraction(m[5]);
    if(each === null) return null;
    return { ...base, amount: first * each, count: first, each };
  }
  if(m[4] !== undefined){
    const high = parseFraction(m[4]);
    if(high === null) return null;
    return { ...base, amount: high, low: first, high, dash: m[3] };
  }
  return { ...base, amount: first };
}
/* What two ingredient lines have to agree on to be totalled together.
   Prep words are noise here: "2 cloves garlic" and "1 clove garlic, minced"
   are one entry on a shopping list, however differently the two recipes
   wrote them. */
function normalizeIngredientName(rest){
  return stripPrepWords(rest, AGGREGATION_PREP_WORDS).replace(/\s+/g,' ').trim();
}
/* Reverses a decimal back to the kind of fraction these recipes are
   written in (0.75 -> "3/4"), since that's the notation the ingredient
   lines themselves use. Falls back to 2 decimal places for anything that
   doesn't land near a common cooking fraction. */
function formatAmount(n){
  if(Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  const whole = Math.floor(n);
  const frac = n - whole;
  const common = [[0.25,'1/4'],[1/3,'1/3'],[0.5,'1/2'],[2/3,'2/3'],[0.75,'3/4']];
  let best = null, bestDiff = Infinity;
  common.forEach(([val,label])=>{
    const diff = Math.abs(frac - val);
    if(diff < bestDiff){ bestDiff = diff; best = label; }
  });
  if(bestDiff > 0.05) return String(Math.round(n*100)/100);
  return whole > 0 ? `${whole} ${best}` : best;
}

/* ------------------------------- Categorization -------------------------------
   Keyword-matched, not AI-classified — same "sensible default, not perfect"
   trade-off as the ingredient totalling below. Order matters: more specific
   categories are checked first so e.g. "chicken stock" lands in Pantry via
   "stock" before "chicken" would otherwise pull it into Meat & Fish.

   Two safeguards against matching a preparation *form* instead of the food
   itself (e.g. "minced garlic" or "cloves garlic, minced" landing in Meat &
   Fish because "mince" is a Meat & Fish keyword and a plain substring check
   can't tell "mince" the noun from "minced" the verb):
     1. Common prep/form words are stripped before matching at all — this is
        the real fix, and it's general rather than specific to "mince".
     2. Keyword matching itself uses word boundaries (with a simple optional
        plural), as a safety net for prep words not yet on the strip list —
        "mince" no longer matches inside "minced" even if it slips through. */
const PREP_WORDS = [
  'minced','mince','sliced','diced','chopped','crushed','grated','peeled',
  'ground','crumbled','cubed','shredded','halved','quartered','trimmed',
  'deveined','skinless','boneless','deboned','zested','juiced','melted',
  'softened','beaten','whisked','drained','rinsed','deseeded','stoned',
  'finely','roughly','thinly','thickly','freshly','fresh','fine','coarse'
];
function stripPrepWords(name, words){
  let s = ' ' + String(name||'').toLowerCase() + ' ';
  s = s.replace(/\([^)]*\)/g, ' ');                                  // "(approx. 525 g)", "(skinless and boneless)"
  s = s.replace(/\b(cut|sliced|chopped|diced)\s+into\s+[^,]*/g, ' '); // "sliced into thin strips"
  words.forEach(w=>{ s = s.replace(new RegExp('\\b'+w+'\\b','g'), ' '); });
  s = s.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return s || String(name||'').toLowerCase(); // don't return empty if we stripped everything
}
function stripPrepWordsForCategorizing(name){
  return stripPrepWords(name, PREP_WORDS);
}
/* Totalling is stricter than categorising about one word: "ground coriander"
   is seed and "coriander" is leaf, and adding them together would put a
   wrong number on the shopping list. Categorising can afford to be loose —
   both belong under Produce either way. */
const AGGREGATION_PREP_WORDS = PREP_WORDS.filter(w=> w !== 'ground');
const SHOPPING_CATEGORIES = [
  { name:'Spices & Seasoning', keywords:['salt','pepper','oregano','cumin','paprika','cinnamon','chilli flakes','chili flakes','cayenne','turmeric','nutmeg','dried thyme','dried rosemary','dried basil','bay leaf','seasoning','garam masala','chilli powder','chili powder','spice'] },
  { name:'Dairy & Eggs', keywords:['cheese','parmesan','feta','cheddar','mozzarella','butter','milk','cream','yogurt','yoghurt','egg'] },
  { name:'Pantry', keywords:['oil','flour','cornflour','cornstarch','sugar','honey','vinegar','sauce','stock','rice','pasta','noodle','bread','tin of','can of'] },
  { name:'Meat & Fish', keywords:['chicken','beef','pork','lamb','turkey','bacon','sausage','mince','fish','salmon','cod','tuna','prawn','shrimp'] },
  { name:'Produce', keywords:['onion','garlic','potato','tomato','lemon','lime','parsley','coriander','cilantro','mint','basil','cucumber','carrot','celery','broccoli','spinach','lettuce','ginger','courgette','aubergine','mushroom'] }
];
function categorizeIngredient(rawName){
  const stripped = stripPrepWordsForCategorizing(rawName);
  for(const cat of SHOPPING_CATEGORIES){
    if(cat.keywords.some(k=> new RegExp('\\b'+k+'(?:e?s)?\\b','i').test(stripped))) return cat.name;
  }
  return 'Other';
}

/* ======================= the ingredient dictionary ======================= */

/* THE MASTER COPY of the app's ingredient dictionary (since 25 Sep 2026, PR 6a).
   converter/ingredient-names.md is generated from this by
   tools/generate-ingredient-names.js, and test/core.test.js fails if the two
   differ, so there is only ever one list to edit: this one. Edit a row here,
   then run the generator and commit both.

   One entry per thing to buy, in its aisle. `name` is what the shopping list
   will call it; `also` is every other wording that totals as the same thing,
   kept as the text a person reads (some cells carry a note in brackets, which
   the readers skip); `countAs` is how a count of it is written, for the
   produce rows where that matters. The cells are kept verbatim from the file
   they came from, so the generated file is byte-identical to the one the
   household decided on 23 Sep (D7, D8, D9).

   NOT YET USED BY THE SHOPPING LIST. PR 6b is the release that totals by it.
   Until then test/validate-recipes.js and test/ingredient-survey.js read it,
   through the generated file, to report. */
const INGREDIENT_AISLES = ["Produce", "Meat & Fish", "Dairy & Eggs", "Pantry", "Spices & Seasoning"];
const INGREDIENT_DICTIONARY = [
  { aisle: "Produce", name: "garlic", also: "garlic clove(s)", countAs: "`3 garlic cloves`" },
  { aisle: "Produce", name: "onion", also: "white onion, brown onion, yellow onion", countAs: "`2 onions`" },
  { aisle: "Produce", name: "red onion", also: "", countAs: "`1 red onion`" },
  { aisle: "Produce", name: "spring onions", also: "scallions, scallion, green onions", countAs: "`1 bunch spring onions`" },
  { aisle: "Produce", name: "red pepper", also: "red bell pepper", countAs: "`1 red pepper`" },
  { aisle: "Produce", name: "green pepper", also: "green bell pepper", countAs: "`1 green pepper`" },
  { aisle: "Produce", name: "red chilli", also: "red chile, fresh red chilli", countAs: "`2 red chillies`" },
  { aisle: "Produce", name: "fresh ginger", also: "ginger, root ginger, ginger root", countAs: "weight, or `1 piece fresh ginger (5 cm)`" },
  { aisle: "Produce", name: "fresh coriander", also: "coriander, coriander leaves, cilantro", countAs: "`1 bunch fresh coriander`" },
  { aisle: "Produce", name: "parsley", also: "curly parsley, flat-leaf parsley, fresh parsley", countAs: "`1 bunch parsley`" },
  { aisle: "Produce", name: "celery", also: "celery stick(s)", countAs: "`2 celery sticks`" },
  { aisle: "Produce", name: "cherry tomatoes", also: "", countAs: "weight" },
  { aisle: "Produce", name: "baby spinach", also: "spinach leaves (when baby)", countAs: "weight" },
  { aisle: "Produce", name: "cucumber", also: "", countAs: "`1 cucumber`" },
  { aisle: "Produce", name: "potatoes", also: "", countAs: "weight" },
  { aisle: "Produce", name: "romaine lettuce", also: "", countAs: "`1 romaine lettuce`" },
  { aisle: "Produce", name: "lemon juice", also: "fresh lemon juice", countAs: "ml or spoons; whole lemons: `1 lemon, juiced`" },
  { aisle: "Meat & Fish", name: "chicken breast", also: "chicken breasts, chicken breast fillets, skinless chicken breast" },
  { aisle: "Meat & Fish", name: "chorizo", also: "cooking chorizo (when the source means it)" },
  { aisle: "Meat & Fish", name: "raw king prawns", also: "king prawns (when cooked in the dish), jumbo shrimp" },
  { aisle: "Meat & Fish", name: "salmon fillets", also: "tail-end salmon fillets" },
  { aisle: "Meat & Fish", name: "streaky bacon", also: "bacon (in US recipes; in a British one it usually means back bacon, so check)" },
  { aisle: "Dairy & Eggs", name: "eggs", also: "egg, large eggs, free-range eggs (write the size in brackets if it matters: `3 eggs (large)`)" },
  { aisle: "Dairy & Eggs", name: "butter", also: "salted butter" },
  { aisle: "Dairy & Eggs", name: "unsalted butter", also: "" },
  { aisle: "Dairy & Eggs", name: "double cream", also: "heavy cream, whipping cream is **not** the same" },
  { aisle: "Dairy & Eggs", name: "milk", also: "whole milk, full-fat milk, semi-skimmed milk" },
  { aisle: "Dairy & Eggs", name: "natural yoghurt", also: "natural yogurt, plain yoghurt, plain yogurt" },
  { aisle: "Dairy & Eggs", name: "parmesan", also: "parmesan cheese, parmigiano reggiano" },
  { aisle: "Pantry", name: "vegetable oil", also: "oil, neutral oil, sunflower oil, rapeseed oil, cooking oil" },
  { aisle: "Pantry", name: "olive oil", also: "extra virgin olive oil" },
  { aisle: "Pantry", name: "sesame oil", also: "toasted sesame oil" },
  { aisle: "Pantry", name: "coconut oil", also: "" },
  { aisle: "Pantry", name: "plain flour", also: "all-purpose flour" },
  { aisle: "Pantry", name: "self-raising flour", also: "self-rising flour" },
  { aisle: "Pantry", name: "cornflour", also: "cornstarch" },
  { aisle: "Pantry", name: "baking powder", also: "" },
  { aisle: "Pantry", name: "bicarbonate of soda", also: "baking soda" },
  { aisle: "Pantry", name: "caster sugar", also: "superfine sugar; plain \"sugar\" when the source doesn't say which" },
  { aisle: "Pantry", name: "golden caster sugar", also: "" },
  { aisle: "Pantry", name: "light brown sugar", also: "soft brown sugar, light soft brown sugar" },
  { aisle: "Pantry", name: "icing sugar", also: "powdered sugar, confectioners' sugar" },
  { aisle: "Pantry", name: "honey", also: "runny honey" },
  { aisle: "Pantry", name: "maple syrup", also: "pure maple syrup" },
  { aisle: "Pantry", name: "vanilla extract", also: "pure vanilla extract" },
  { aisle: "Pantry", name: "cocoa powder", also: "unsweetened cocoa" },
  { aisle: "Pantry", name: "dark chocolate", also: "" },
  { aisle: "Pantry", name: "peanut butter", also: "smooth peanut butter, creamy peanut butter, crunchy peanut butter" },
  { aisle: "Pantry", name: "almond butter", also: "" },
  { aisle: "Pantry", name: "rolled oats", also: "oats, old-fashioned oats, porridge oats, quick-cooking oats" },
  { aisle: "Pantry", name: "flaked almonds", also: "sliced almonds, slivered almonds" },
  { aisle: "Pantry", name: "raisins", also: "" },
  { aisle: "Pantry", name: "raspberry jam", also: "seedless raspberry jam, soft-set raspberry jam" },
  { aisle: "Pantry", name: "long grain rice", also: "long-grain rice (write the **uncooked** amount, D4)" },
  { aisle: "Pantry", name: "rigatoni", also: "pasta shapes (when rigatoni)" },
  { aisle: "Pantry", name: "spaghetti", also: "dried spaghetti" },
  { aisle: "Pantry", name: "orzo", also: "" },
  { aisle: "Pantry", name: "chopped tomatoes", also: "tinned chopped tomatoes (write `400 g chopped tomatoes (1 tin)`, as the tin is labelled)" },
  { aisle: "Pantry", name: "tomato purée", also: "tomato paste" },
  { aisle: "Pantry", name: "sun-dried tomatoes", also: "" },
  { aisle: "Pantry", name: "tomato ketchup", also: "ketchup" },
  { aisle: "Pantry", name: "mayonnaise", also: "mayo" },
  { aisle: "Pantry", name: "gherkins", also: "dill pickles" },
  { aisle: "Pantry", name: "panko breadcrumbs", also: "" },
  { aisle: "Pantry", name: "chicken stock", also: "chicken broth, hot chicken stock" },
  { aisle: "Pantry", name: "light soy sauce", also: "soy sauce" },
  { aisle: "Pantry", name: "dark soy sauce", also: "" },
  { aisle: "Pantry", name: "oyster sauce", also: "" },
  { aisle: "Pantry", name: "worcestershire sauce", also: "" },
  { aisle: "Pantry", name: "chinese rice wine", also: "shaoxing wine, shaoxing rice wine" },
  { aisle: "Pantry", name: "white wine", also: "dry white wine" },
  { aisle: "Spices & Seasoning", name: "salt", also: "table salt, fine salt" },
  { aisle: "Spices & Seasoning", name: "sea salt", also: "fine sea salt, flaky sea salt" },
  { aisle: "Spices & Seasoning", name: "black pepper", also: "pepper, ground black pepper, freshly ground black pepper" },
  { aisle: "Spices & Seasoning", name: "white pepper", also: "ground white pepper" },
  { aisle: "Spices & Seasoning", name: "garlic salt", also: "" },
  { aisle: "Spices & Seasoning", name: "garlic powder", also: "" },
  { aisle: "Spices & Seasoning", name: "paprika", also: "sweet paprika (not smoked, which is its own item)" },
  { aisle: "Spices & Seasoning", name: "smoked paprika", also: "" },
  { aisle: "Spices & Seasoning", name: "chilli flakes", also: "crushed chillies, red pepper flakes" },
  { aisle: "Spices & Seasoning", name: "chilli powder", also: "mild chilli powder, hot chilli powder" },
  { aisle: "Spices & Seasoning", name: "cajun seasoning", also: "cajun spice mix, cajun spice" },
  { aisle: "Spices & Seasoning", name: "dried oregano", also: "oregano, *fresh oregano is its own item*" },
  { aisle: "Spices & Seasoning", name: "ground cumin", also: "cumin (when a powder)" },
  { aisle: "Spices & Seasoning", name: "ground coriander", also: "coriander powder (bare \"coriander\" means the leaf, so write *fresh coriander* for that)" },
  { aisle: "Spices & Seasoning", name: "ground cinnamon", also: "cinnamon (when a powder)" },
  { aisle: "Spices & Seasoning", name: "ground turmeric", also: "turmeric" },
  { aisle: "Spices & Seasoning", name: "cardamom pods", also: "green cardamom pods" },
  { aisle: "Spices & Seasoning", name: "whole cloves", also: "cloves (the spice)" },
  { aisle: "Spices & Seasoning", name: "sesame seeds", also: "" },
];

/* So Node can load this file too (test/core.test.js, the validators). In the
   page there is no `module`, and everything above is simply global, as it was
   when it lived in index.html. */
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    KITCHEN_CORE_VERSION, INGREDIENT_AISLES, INGREDIENT_DICTIONARY,
    splitQty, parseTags, extractStepDuration, parseRecipe,
    withUpdatedHeaderLine, withUpdatedHeaderLines, tagsToLine, withUpdatedTitleLine, withUpdatedImageLine,
    scaleRecipeSyntax, buildRows, computeColumns, computeTimeline,
    parseFraction, normalizeUnit, toBaseUnit, formatShoppingQty, parseIngredientAmount,
    normalizeIngredientName, formatAmount, stripPrepWords, stripPrepWordsForCategorizing, categorizeIngredient,
    SHOPPING_CATEGORIES, PREP_WORDS, AGGREGATION_PREP_WORDS
  };
}
