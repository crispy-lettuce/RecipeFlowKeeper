/* Proposes which timed steps look after themselves, from an app export, for the hands-off pass over the library.

     node tools/propose-hands-off.js /path/outside/the/repo/kitchen-backup.json /path/outside/the/repo/proposals.json

   WHY: docs/PLAN-RUN-SHEET.md §6. A step marked `, hands off` (`[25 min, hands off]`) tells the run sheet when the cook's hands are free.
   The library's own steps are unmarked, and about 250 of them want a look. This reads the export the sidebar's EXPORT DATA writes, and for
   every timed MERGE step that is not already marked writes down the recipe, the md5 of its `syntax` (so a later write can be guarded
   against a recipe edited since), the line, its bracket, a proposal and why. The proposal is one of
     off   waiting, or stirred only now and then from 10 minutes up: write `, hands off`
     on    under 5 minutes, or stirred/whisked/fried/watched: write nothing
     ask   the words and the minutes do not settle it: a person reads it by the rule
   The rule is the one the household's marks refined on 23 Oct 2026 (converter/conversion-instructions.md, "Hands-off steps"). Plain word
   lists were right 85% of the time where they answered and said nothing on a third of the steps, so this sorts and orders the review; it
   never decides it, and it never writes: not to the database, not to a recipe, and not into this repo.

   THE EXPORT AND THE PROPOSALS ARE LIBRARY DATA, and this repo is public (CLAUDE.md). The tool refuses a path inside the repo, for
   the export and for the output alike, and prints counts only (no recipe text) to the terminal. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const REPO = path.resolve(__dirname, '..');

globalThis.PALETTE = globalThis.PALETTE || ['#111'];
globalThis.MERGE_COLOR = globalThis.MERGE_COLOR || '#999';
const core = require(path.join(REPO, 'core.js'));

/* Words, in the order the rule uses them. Deliberately short: a step none of them settles is `ask`, which is the honest answer. */
const WAITING = /\b(simmer(?:ing)?|bak(?:e|ing)|roast(?:ing)?|rest(?:ing)?|prov(?:e|ing)|proof(?:ing)?|chill(?:ing)?|marinat(?:e|ing)|soak(?:ing)?|cool(?:ing)?|leave|slow[- ]cooker|in the oven|fridge|refrigerat(?:e|ing)|freez(?:e|ing)|infus(?:e|ing)|steep(?:ing)?|rise|braise|braising)\b/i;
const OFTEN = /\b(often|constantly|continuously|frequently|all the time|non-?stop)\b/i;
const OCCASIONAL = /\b(occasionally|occasional|now and then|once or twice|from time to time|every few minutes|halfway|half way|midway|half-way)\b/i;
/* Work that keeps the cook at it (brown as a verb, not "brown sugar"), and watching for a moment, which is only hands on while it is short. */
const HANDS_ON = /\b(whisk(?:ing)?|fry(?:ing)?|brown(?:ing)?(?!\s+(?:sugar|rice|lentils?|mustard|bread|flour|stock))|toss(?:ing)?|knead(?:ing)?|beat(?:ing)?|saut[eé](?:ing)?)\b/i;
const WATCHING = /\b(bring to|watch(?:ing)?)\b/i;
const STIRRING = /\b(stir(?:ring)?|turn(?:ing)?|flip(?:ping)?)\b/i;

/* The same line the parser reads (core.js, parseRecipe): a MERGE, its inputs, its output and its label, whose bracket extractStepDuration
   reads. Reading the line again here rather than the parsed recipe keeps the line itself to hand for the report. */
const MERGE_LINE = /^MERGE\s+(.+?)\s*->\s*(\w+)\s*:\s*(.+)$/i;

function judge(label, d){
  const why = [];
  const hit = re => (label.match(re) || [])[0];
  const m = d.openEnded ? null : d;        // minutes known: d.min and d.max
  if(m && m.max < 5) return { proposal: 'on', why: ['under 5 minutes'] };
  if(m && m.min < 5) return { proposal: 'ask', why: ['the time runs across the 5-minute line'] };
  const often = hit(OFTEN), hands = hit(HANDS_ON), occ = hit(OCCASIONAL), stir = hit(STIRRING), wait = hit(WAITING);
  if(often) return { proposal: 'on', why: [`stirred or worked often ("${often}")`] };
  if(hands) return { proposal: 'on', why: [`a hands-on word ("${hands}")`] };
  const watch = hit(WATCHING);
  if(watch) return m && m.min < 10 ? { proposal: 'on', why: [`the cook watches ("${watch}"), under 10 minutes`] }
                                     : { proposal: 'ask', why: [`the cook watches ("${watch}"), and the step is 10 minutes or more`] };
  if(occ && stir){
    if(!m) return { proposal: 'ask', why: [`stirred "${occ}" and the time is open-ended`] };
    return m.min >= 10 ? { proposal: 'off', why: [`stirred only "${occ}", ${m.min} minutes or more`] }
                       : { proposal: 'on', why: [`any stirring under 10 minutes ("${stir}")`] };
  }
  if(wait && !stir) return { proposal: 'off', why: [`a waiting word ("${wait}")`, m ? `${m.min} minutes or more` : 'open-ended'] };
  if(wait && stir) return { proposal: 'ask', why: [`a waiting word ("${wait}") and a doing word ("${stir}"), not said how often`] };
  if(stir) return { proposal: 'ask', why: [`stirring ("${stir}"), not said how often`] };
  why.push('no waiting or doing word');
  return { proposal: 'ask', why };
}

function propose(exp){
  const out = [];
  const skipped = { instant: 0, alreadyMarked: 0, untimed: 0 };
  (exp && exp.recipes || []).forEach(r => {
    const syntax = String(r.syntax || '');
    const md5 = crypto.createHash('md5').update(syntax).digest('hex');
    syntax.split('\n').forEach(raw => {
      const line = raw.trim();
      const m = line.match(MERGE_LINE);
      if(!m) return;
      const { label, duration } = core.extractStepDuration(m[3].trim());
      if(!duration){ skipped.untimed++; return; }
      if(duration.instant){ skipped.instant++; return; }
      if(duration.handsOff){ skipped.alreadyMarked++; return; }
      const bracket = (m[3].match(/\[[^\]]*\]\s*$/) || [''])[0].trim();
      out.push({ recipeId: r.id || null, title: r.title || '', md5, line, bracket, ...judge(label, duration) });
    });
  });
  const counts = { off: 0, on: 0, ask: 0 };
  out.forEach(p => counts[p.proposal]++);
  return { steps: out, counts, skipped, recipes: (exp && exp.recipes || []).length };
}

function insideRepo(abs){ return abs === REPO || abs.startsWith(REPO + path.sep); }

if(require.main === module){
  const [inFile, outFile] = process.argv.slice(2);
  if(!inFile || !outFile){ console.error('usage: node tools/propose-hands-off.js <export.json> <proposals.json>, both outside the repo'); process.exit(2); }
  const a = path.resolve(inFile), b = path.resolve(outFile);
  if(insideRepo(a) || insideRepo(b)){
    console.error('Refusing: a path is inside the repo, which is public. Keep the export and the proposals outside it.');
    process.exit(2);
  }
  const res = propose(JSON.parse(fs.readFileSync(a, 'utf8')));
  fs.writeFileSync(b, JSON.stringify(res, null, 2));
  console.log(`${res.recipes} recipes, ${res.steps.length} timed steps not yet marked: ${res.counts.off} off, ${res.counts.on} on, ${res.counts.ask} ask`);
  console.log(`left alone: ${res.skipped.instant} instant, ${res.skipped.alreadyMarked} already marked, ${res.skipped.untimed} with no readable time`);
  console.log(`wrote ${b}`);
}

module.exports = { propose, judge };
