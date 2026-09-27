/* Re-measures the shopping list across the whole library, from an export.

     node tools/remeasure.js /path/outside/the/repo/kitchen-backup-2026-10-12.json [--json]

   WHY: docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §6 asks for a private
   re-measure every ten or so new recipes, watching one number: items split
   across names. The ingredient review and the 6b and 6c-2 releases were each
   measured with throwaway scripts; this is the one kept, so the next check
   costs a command rather than an afternoon. Added 28 Sep 2026, PR 6c-1.

   It reads the file the app's sidebar EXPORT DATA writes, and totals it
   with the same core.js the app runs, the household's word matches applied
   as the list applies them. It reports, and changes nothing:
     - rows: every recipe planned at once, one row per thing to buy
     - likely splits: pairs the list itself would offer to merge
     - rows in "Other", which want an aisle
     - lines the shopping list cannot total properly, by recipe
     - lines the parser reads past

   THE EXPORT IS LIBRARY DATA, and this repo is public (CLAUDE.md). The tool
   refuses a file inside the repo, and prints to the terminal only. Keep the
   export, and anything you copy out of the report, outside the repo. */
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');

globalThis.PALETTE = globalThis.PALETTE || ['#111'];
globalThis.MERGE_COLOR = globalThis.MERGE_COLOR || '#999';
const core = require(path.join(REPO, 'core.js'));

function remeasure(exp){
  const recipes = (exp && exp.recipes) || [];
  const aliases = (exp && exp.aliases) || [];
  const matches = core.ingredientMatchMap(aliases);
  const distinct = new Set(aliases.filter(a => a.kind === 'ingredient_distinct').map(a => {
    const [x, y] = String(a.alias).split(' || ');
    return [core.shoppingKeyForName(x || ''), core.shoppingKeyForName(y || '')].sort().join(' || ');
  }));
  const lines = [], shape = [], unread = [];
  recipes.forEach(r => {
    const p = core.parseRecipe(r.syntax || '');
    const skip = new Set((p.unread || []).map(u => u.line));
    (p.unread || []).forEach(u => unread.push({ recipe: r.title, line: u.line, why: u.why }));
    p.groups.forEach(g => g.items.forEach(raw => {
      if(skip.has(raw)) return;
      lines.push({ recipeTitle: r.title, raw, group: g.handle });
      const faults = core.ingredientLineFaults(raw).filter(f => f.affectsList);
      if(faults.length) shape.push({ recipe: r.title, line: raw, faults: faults.map(f => f.text), suggestion: core.suggestIngredientLine(raw) });
    }));
  });
  const items = core.aggregateShoppingLines(lines, k => matches.get(k) || k);
  const splits = core.strictMatchSuggestions(items, (a, b) => distinct.has([a, b].sort().join(' || ')));
  return {
    recipes: recipes.length,
    lines: lines.length,
    rows: items.length,
    wordMatches: matches.size,
    splits,
    other: items.filter(i => i.category === 'Other').map(i => i.name).sort(),
    shape,
    unread
  };
}

if(require.main === module){
  const file = process.argv[2];
  if(!file){ console.error('usage: node tools/remeasure.js <export.json, outside the repo> [--json]'); process.exit(2); }
  const abs = path.resolve(file);
  if(abs === REPO || abs.startsWith(REPO + path.sep)){
    console.error('Refusing: that file is inside the repo, which is public. Move the export outside it first.');
    process.exit(2);
  }
  const rep = remeasure(JSON.parse(fs.readFileSync(abs, 'utf8')));
  if(process.argv.includes('--json')){ console.log(JSON.stringify(rep, null, 2)); process.exit(0); }
  console.log(`${rep.recipes} recipes, ${rep.lines} ingredient lines -> ${rep.rows} rows (${rep.wordMatches} word matches applied)`);
  console.log(`\nLikely splits (${rep.splits.length}) — the pairs the list offers to merge:`);
  rep.splits.forEach(s => console.log(`  ${s.from}  ~  ${s.to}`));
  console.log(`\nIn "Other" (${rep.other.length}): ${rep.other.join('; ')}`);
  console.log(`\nLines the list cannot total (${rep.shape.length}):`);
  rep.shape.forEach(s => console.log(`  ${s.recipe}: "${s.line}" — ${s.faults.join('; ')}${s.suggestion ? `  → "${s.suggestion}"` : ''}`));
  console.log(`\nLines the parser reads past (${rep.unread.length}):`);
  rep.unread.forEach(u => console.log(`  ${u.recipe}: "${u.line}" — ${u.why}`));
}

module.exports = { remeasure };
