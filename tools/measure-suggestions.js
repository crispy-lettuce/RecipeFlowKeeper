/* Measures what INSPIRE ME's engine makes of a library, from an export.

     node tools/measure-suggestions.js /path/outside/the/repo/kitchen-backup.json [--today YYYY-MM-DD] [--titles]

   WHY: docs/PLAN-INSPIRE-ME.md, slice 1 (11 Nov 2026). A recipe's main protein is worked out from its ingredient lines, and
   the household looks at what that makes of its own recipes before any screen is built on it. It also gives the numbers the
   plan left open: how many recipes each choice offers, and where 20 minutes hands on falls.

   It reads the file the app's sidebar EXPORT DATA writes (each recipe with its syntax, tags, time, favourite and history),
   with the same core.js the app runs. It reports, and changes nothing:
     - Mains by main protein, and how each was decided (keyword, ingredients, or nothing found: VEG)
     - recipes whose keyword and ingredients disagree, and recipes with meat in the lines that a keyword calls Veg
     - how many Mains fit ANY, POPULAR, NOT LATELY, NEVER TRIED, the time limits, LOW EFFORT and FREEZES WELL
     - hands-on minutes: how many Mains can be told, and their spread

   Without --titles it prints counts only. With it, the disagreements and the VEG list are printed by title, for the household
   to read.

   THE EXPORT IS LIBRARY DATA, and this repo is public (CLAUDE.md). The tool refuses a file inside the repo, and prints to the
   terminal only. Keep the export, and anything you copy out of the report, outside the repo. */
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');

globalThis.PALETTE = globalThis.PALETTE || ['#111'];
globalThis.MERGE_COLOR = globalThis.MERGE_COLOR || '#999';
const core = require(path.join(REPO, 'core.js'));

function measureSuggestions(exp, today){
  const recipes = ((exp && exp.recipes) || []).filter(r => String((r.tags || {}).course || '').toLowerCase() === 'main');
  const facts = recipes.map(r => core.suggestionFacts(r));
  const proteins = recipes.map(r => core.mainProtein(r));
  const byFamily = {}, byHow = {};
  const disagree = [], vegByKeyword = [], vegByNothing = [], mixed = [];
  proteins.forEach((p, i) => {
    byFamily[p.family] = (byFamily[p.family] || 0) + 1;
    byHow[p.by] = (byHow[p.by] || 0) + 1;
    const title = recipes[i].title;
    if(p.by === 'keyword' && p.family !== p.fromIngredients && !p.keywordFamilies.includes(p.fromIngredients)){
      (p.family === 'veg' ? vegByKeyword : disagree).push({ title, keyword: p.family, ingredients: p.fromIngredients });
    }
    if(p.by === 'none') vegByNothing.push({ title });
    if(p.by === 'ingredients' && Object.keys(p.weights).length > 1){
      mixed.push({ title, family: p.family, weights: Object.entries(p.weights).map(([f, g]) => `${f} ${Math.round(g)}`).join(', ') });
    }
  });
  const ctx = { today };
  const fits = ask => core.suggestPool(facts, ask, ctx).length;
  const pools = {
    any: fits({}), popular: fits({ which: 'popular' }), notLately: fits({ which: 'notLately' }), never: fits({ which: 'never' }),
    under30: fits({ maxMinutes: 30 }), under60: fits({ maxMinutes: 60 }), lowEffort: fits({ lowEffort: true }), freezes: fits({ freezes: true })
  };
  const known = facts.map(f => f.handsOn).filter(n => n !== null).sort((a, b) => a - b);
  const at = q => known.length ? known[Math.min(known.length - 1, Math.floor(known.length * q))] : null;
  const styles = {};
  facts.forEach(f => f.styles.forEach(s => { styles[s] = (styles[s] || 0) + 1; }));
  return {
    mains: recipes.length, byFamily, byHow, disagree, vegByKeyword, vegByNothing, mixed, pools,
    popularAt: core.popularThreshold(facts),
    handsOn: { known: known.length, quarter: at(0.25), median: at(0.5), threeQuarters: at(0.75), max: known.length ? known[known.length - 1] : null,
               withinLimit: known.filter(n => n <= core.SUGGEST_RULES.lowEffortMinutes).length },
    styles, noStyle: facts.filter(f => !f.styles.length).length, noTime: facts.filter(f => f.minutes === null).length
  };
}

if(require.main === module){
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--today');
  const todayAt = args.indexOf('--today');
  const today = todayAt >= 0 ? args[todayAt + 1] : new Date().toISOString().slice(0, 10);
  const titles = args.includes('--titles');
  if(!file){ console.error('usage: node tools/measure-suggestions.js /path/outside/the/repo/export.json [--today YYYY-MM-DD] [--titles]'); process.exit(2); }
  const full = path.resolve(file);
  if(full === REPO || full.startsWith(REPO + path.sep)){
    console.error('That file is inside the repo. An export is library data and this repo is public: keep it outside (CLAUDE.md).');
    process.exit(2);
  }
  const m = measureSuggestions(JSON.parse(fs.readFileSync(full, 'utf8')), today);
  const row = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
  console.log(`Mains: ${m.mains} (as of ${today})`);
  console.log(`By main protein: ${row(m.byFamily)}`);
  console.log(`Decided by: ${row(m.byHow)}`);
  console.log(`Keyword and ingredients disagree: ${m.disagree.length}`);
  if(titles) m.disagree.forEach(d => console.log(`  ${d.title}: keyword ${d.keyword}, ingredients ${d.ingredients}`));
  console.log(`Keyword says Veg, the lines hold meat or fish: ${m.vegByKeyword.length}`);
  if(titles) m.vegByKeyword.forEach(d => console.log(`  ${d.title}: ingredients ${d.ingredients}`));
  console.log(`VEG because nothing was found (no keyword, no meat or fish line): ${m.vegByNothing.length}`);
  if(titles) m.vegByNothing.forEach(d => console.log(`  ${d.title}`));
  console.log(`More than one meat or fish in the lines, decided by weight: ${m.mixed.length}`);
  if(titles) m.mixed.forEach(d => console.log(`  ${d.title}: ${d.family} (${d.weights})`));
  console.log(`Fits: ANY ${m.pools.any}, POPULAR ${m.pools.popular}, NOT LATELY ${m.pools.notLately}, NEVER TRIED ${m.pools.never}`);
  console.log(`      30 MIN ${m.pools.under30}, 1 HOUR ${m.pools.under60}, LOW EFFORT ${m.pools.lowEffort}, FREEZES WELL ${m.pools.freezes}`);
  console.log(`Popular without a star from ${m.popularAt === Infinity ? 'nothing yet (no Main cooked twice)' : m.popularAt + ' times cooked'}`);
  console.log(`Hands-on minutes known for ${m.handsOn.known} of ${m.mains}: quarter ${m.handsOn.quarter}, median ${m.handsOn.median}, three quarters ${m.handsOn.threeQuarters}, most ${m.handsOn.max}; ` +
              `${m.handsOn.withinLimit} at ${core.SUGGEST_RULES.lowEffortMinutes} or under`);
  console.log(`Dish styles: ${row(m.styles)}; none ${m.noStyle}. No time: ${m.noTime}`);
}

module.exports = { measureSuggestions };
