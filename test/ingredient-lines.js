/* The ingredient-line checks, shared by test/validate-recipes.js (one converted
   batch) and test/ingredient-survey.js (many extracted recipes), so the two can
   never disagree about what a good line is.

   The rules are the ones in converter/conversion-instructions.md §1 ("Write every
   ingredient line in one shape") and docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md
   §4.2. Every check here answers "is this line in the standard shape?". None of
   them decides what the shopping list does with it; that stays in index.html.

   The quantity split is NOT done here: callers pass in what the app's own
   splitQty returned, so "what counts as a quantity" cannot drift from the app. */
const fs = require('fs');
const path = require('path');

/* splitQty leaves count words in place on purpose, so one may still lead the
   name ("handful coriander"); it is dropped before the name is looked up. */
const COUNT_WORD = /^(pinch(es)?|bunch(es)?|handfuls?|sprigs?|slices?|rashers?|pieces?|tins?|knobs?|stalks?)\s+(of\s+)?/;

/* Singular and plural are one name: "1 egg" and "3 eggs" both write *eggs*
   correctly, so neither may be reported as a synonym of the other. */
function fold(name){
  /* "purée" and "puree" are one spelling too. */
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ').map((w, i, a) => {
    if(i !== a.length - 1 || w.length < 4 || /(ss|us|is)$/.test(w)) return w;
    if(/chillies$/.test(w)) return w.slice(0, -2);
    if(/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if(/(oes|ches|shes)$/.test(w)) return w.slice(0, -2);
    return w.replace(/s$/, '');
  }).join(' ');
}

/* The converter's shared vocabulary, read from converter/ingredient-names.md so
   there is one list, not two. Each "Also written as" phrase maps to the name to
   write instead. Only plain phrases are taken: anything with brackets or a
   qualifier ("when a powder") needs judgement, and a warning that fires on a
   correct line is worse than one that stays quiet. Exact matches only, so
   "olive oil" is never mistaken for "oil". */
function loadVocab(file){
  /* synonyms: wording to replace -> listed name
     names:    folded listed names, plus the count forms the list itself uses
               ("3 garlic cloves" in the "Count as" column), which are correct
     listedAs: folded name or count form -> the row's own name, for reports */
  const vocab = { synonyms: new Map(), names: new Set(), listedAs: new Map() };
  let md;
  try { md = fs.readFileSync(file || path.join(__dirname, '..', 'converter', 'ingredient-names.md'), 'utf8'); }
  catch(e){ return vocab; }   /* no vocabulary file: the shape checks still run, just without names */
  md.split('\n').forEach(row => {
    const cells = row.split('|').map(c => c.trim());
    if(cells.length < 4 || !cells[1] || /^(write|-+)$/i.test(cells[1])) return;
    const canonical = cells[1].toLowerCase();
    vocab.names.add(fold(canonical));
    vocab.listedAs.set(fold(canonical), canonical);
    (cells[3] || '').match(/`[^`]+`/g)?.forEach(ex => {
      const n = ex.replace(/`/g, '').replace(/^[\d\/.\s]+/, '').replace(COUNT_WORD, '').split(/[,(]/)[0].trim().toLowerCase();
      if(n){ vocab.names.add(fold(n)); vocab.listedAs.set(fold(n), canonical); }
    });
    cells[2].split(',').map(x => x.trim().toLowerCase()).forEach(syn => {
      if(!syn || /[()*"'`]|\b(when|not|is)\b/.test(syn) || fold(syn) === fold(canonical)) return;
      vocab.synonyms.set(syn, canonical);
    });
  });
  return vocab;
}

/* Where the prepared form is what you buy, it is the name, not preparation
   ("chopped tomatoes, ground cumin, minced beef"). */
const PRODUCT_FORM = /^(chopped tomatoes|minced (beef|pork|lamb|turkey|chicken)|flaked almonds)\b/;
/* One line, already split by splitQty. Returns:
     why      — the faults, empty for a line in the standard shape
     name     — the name as the shopping list will first see it (lower case)
     listed   — the vocabulary name, when `name` is one of its "also written as" spellings
     isNew    — a clean name the vocabulary doesn't know yet */
function checkLine({ line, qty, rest }, vocab){
  const why = [];
  const noBrackets = rest.replace(/\([^)]*\)/g, ' ');
  const segments = noBrackets.split(',').map(x => x.trim());
  const first = segments[0].toLowerCase();
  if(/[¼½¾⅓⅔]/.test(line)) why.push('uses ½-style fraction');
  if(/^\s*[\d.\/\s]+\s*x\s*\d/i.test(line)) why.push('multiplier ("3 x …")');
  if(/\band\b|&/.test(first) || (segments.length >= 3 && /\band\b/.test(segments[1]))) why.push('two ingredients on one line?');
  if(/\s(or|and\/or)\s/.test(first)) why.push('alternative outside brackets');
  if(/^(large|small|medium|big|heaped|level|generous|thumb-sized)\b/.test(first)) why.push('size word before the name');
  if(!PRODUCT_FORM.test(first) && (/^(minced|grated|chopped|diced|sliced|crushed|melted|softened|beaten)\b/.test(first)
     || /^(juice|zest|leaves|stalks)\s+(of|from)\b/.test(first))) why.push('preparation before the name');
  if(/\b(cups?|oz|ounces?|lbs?|pounds?|quarts?|pints?|sticks? of butter)\b/i.test(qty)) why.push('not metric (convert cups, oz and lb)');
  if(qty && /^(tins?|cans?|jars?|packs?|packets?)\b/.test(first)) why.push('container word in the name (put "(1 tin)" in brackets)');
  if(!qty && !/,.*\bto (taste|serve|glaze|finish)\b/i.test(line) && !/^(pinch|handful|squeeze|knob)\b/i.test(line)) why.push('no quantity');

  const name = first.replace(COUNT_WORD, '').trim();
  const listed = vocab.synonyms.get(name) || null;
  if(listed) why.push(`use the listed name "${listed}"`);
  /* Not a fault: the vocabulary only lists ingredients shared by two or more
     recipes. Reported only from otherwise clean lines, because a faulty line is
     fixed first and its name may change when it is. */
  const isNew = !!(vocab.names.size && name && !why.length && !vocab.names.has(fold(name)) && !vocab.synonyms.has(name));
  return { why, name, listed, isNew };
}

module.exports = { loadVocab, checkLine, fold };
