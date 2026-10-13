# Preparation as steps in the flow (#88)

**PR 1 built 13 Oct 2026** (`core.js` and its tests; nothing visible yet). `docs/HANDOVER.md` §7 has what was checked. One
change from §4: there is no separate "ahead of time" list; those words are simply kept out of the action table, so they never
read as a step (a guard that could not change the answer was dropped).

**Asked for in issue #88** (opened by a household member; the owner replied "The workflow is more about — you need these
ingredients to go into this stage of the recipe. I'll have a think"). Today an ingredient's preparation ("leeks, sliced") is read as
done before the stage that uses it: mise en place. The ask is a **setting**: keep that, or show the preparation as its own step in
the flowchart, at the moment it is needed. Drafted 13 Oct 2026 (`date -u`) as a plan only: nothing is built, no recipe changes.
**Every example line here is made up**, and each was checked against the library on 13 Oct (an exact-match count of 0).

## 1. What exists today (read 13 Oct 2026)

- **The format** (`docs/ARCHITECTURE.md` §2): `GROUP` = ingredients that go in together; `STAGE` = one column, one moment;
  `MERGE a, b -> c: label [duration]`. A MERGE may combine only handles on **adjacent rows** (`core.js:562`), and groups take rows
  in declaration order (`buildRows`, `core.js:519`). A one-input MERGE relabels a box.
- **Parsing**: `parseRecipe` (`core.js:204`) keeps each ingredient line whole in `groups[].items` (`core.js:265`); a MERGE becomes
  `{inputs, output, label, duration}` (`core.js:267`, durations by `extractStepDuration`, `core.js:119`). `splitQty`
  (`core.js:60`) takes the quantity and unit off a line. **Nothing reads the preparation as an action.**
- **Preparation words are already recognised, but only to throw them away**: `PREP_WORDS` (`core.js:782`), `stripPrepWords`
  (`core.js:789`, for the aisle), `AGGREGATION_PREP_WORDS` (`core.js:804`) and `LEFTOVER_PREP` (`core.js:1079`) for the shopping
  key, and `shoppingLine` ends the name at the first comma (`core.js:1145`). `ingredientLineFaults` flags preparation *before*
  the name (`'prep'`, not `affectsList`, `core.js:1457`), with `PRODUCT_FORM` (`core.js:1437`) excusing "chopped tomatoes" and
  the like.
- **The converter already writes the shape this needs**: `<quantity> <unit> <name>, <preparation> (<note>)`
  (`converter/conversion-instructions.md:69`), "Preparation after the first comma, never before the name" (`:116`).
- **Layout**: `computeColumns` (`core.js:532`) walks stages, colours each group `PALETTE[i]` (`:548`) and a multi-input MERGE
  `MERGE_COLOR` (`:567`). `computeTimeline` (`core.js:617`) starts raw groups at t=0 and gives an untimed step a 2-minute sliver
  (`DEFAULT_STEP_MINUTES`, `:616`), returning `null` when no step is timed.
- **Rendering**: `buildFlowHTML` (`index.html:2434`) calls `computeColumns` (`:2444`); a box with no label is a blank cell.
  `mountFlow` (`index.html:2549`) keys ticks by **geometry**, `col:rowStart:rowSpan` (`:2582`), and logs the recipe when the
  last column is all ticked. Callers: the viewer (`:5411`, with the timeline), the Group Viewer (`:5219`, one `mountFlow` per
  recipe, same `tickKey`; its strip is `computeGroupTimeline`, `:2348`), and the Add/Edit preview (`:7918`, `:9497`).
- **The shopping list never sees the layout**: `buildShoppingList` reads `parseRecipe(syntax).groups` directly (`index.html:6483`).
- **Settings**: household ones go through `SETTING_COLUMNS`/`setSetting` (`index.html:3438`, `:3446`) to `household_settings`;
  per-device ones live in `localStorage` with `try/catch`, e.g. `kitchen.cookingTimeline` ("one setting for the device, shared
  by both viewers", `index.html:5668`). Settings → APP's APPEARANCE text says "The choice is shared with the household, like every
  other setting here" (`index.html:1866`).

**Measured on the live library, 13 Oct 2026** (read-only counts; 3 households, 2 with recipes; no text copied):

| | Household A | Household B |
| --- | --- | --- |
| Recipes / ingredient lines | 34 / 466 | 5 / 94 |
| Lines with a clause after the first comma | 140 | 36 |
| …of which an action this plan would read (§4) | 113 | 26 |
| …"ahead of time" (softened, defrosted, cold…) | 4 | 0 |
| …notes (to taste, to serve, plus extra…) | 9 | 7 |
| …anything else (unread, left as now) | 14 | 3 |
| Recipes with at least one action | 30 | 5 |
| Preparation before the name (not read, §4) | 12 | 2 |

Over both: **35 of 39 recipes, 84 groups**, every one of them consumed by a MERGE. The commonest first words: chopped 40,
peeled 23 (21 as "peeled and …"), minced 15, deseeded 10 (all "deseeded and …"), sliced 9, diced 8, grated 7, cut 6, leaves 5.

## 2. Two ways to do it

| | A. The app derives the steps at display time | B. The converter writes them into the recipe |
| --- | --- | --- |
| Where | `core.js`: a pure function turns `parsed` into a layout with prep boxes | `conversion-instructions.md`: a GROUP and a one-input MERGE per prepared line |
| A setting can switch it | Yes, it is only drawing | No: the steps are in the text; hiding them needs new syntax |
| Existing recipes | All 35, at once | Only new conversions; the rest need re-conversion (the recipe-text procedure in `CLAUDE.md`, per recipe, household present) |
| Converter | Unchanged; no `CONVERTER_VERSION` move, no CONVERTER bar | Version moves, the bar returns in both households |
| Group order burden | None: rows never move | Many more groups, each needing adjacency right; more converter slips |
| Durations | None invented (§5) | "Every MERGE ends with a bracket" forces a made-up time |
| Shopping list, ticks | Untouched by construction | Untouched (items unchanged) |
| Both households | Each device chooses | One choice baked into the text |

**Recommended: A.** It is feasible because the converter already puts preparation after the first comma, so it is read the way
`shoppingLine` reads the name, and because a prep step is exactly what the format can already draw: a one-input MERGE on the
prepared row. B is left as the fallback for wording A cannot read, which the converter can fix line by line as today.

## 3. The setting

**Per device, recommended.** `localStorage['kitchen.prepSteps']`, `'before'` (default, today's drawing) or `'steps'`, read and
written in `try/catch` like `kitchen.cookingTimeline`; storage blocked reads as `'before'`. Reasons: it changes drawing only, so
devices need not agree; the tablet at the hob and the laptop used for planning want different things; **no migration**, so no
DDL for the household to apply first and no column the app must not send; and it reaches both households the day it merges.
Per household would need `household_settings.prep_steps`, a `docs/migrations/` page, a `SETTING_COLUMNS` entry and the
household applying SQL first, for a choice nobody needs shared. Shown in **Settings → APP** as a block **PREPARATION** with a
select, "Before you start (as written)" / "As steps in the flow", and the line "This device only". The APPEARANCE sentence
"like every other setting here" is reworded in the same PR, since it stops being true.

## 4. The derivation rules (`core.js`)

Two pure functions, nothing page-side, beside `computeColumns`:

- **`prepStepFor(line)`** → `{ label }` or `null`. Reads one ingredient line:
  1. `splitQty`; brackets dropped; the **clause** is the text after the first comma, up to the next comma. No comma, no step.
  2. The clause is skipped if it is a note (`TAIL_NOTES`, "divided") or an **ahead-of-time state** (softened, at room
     temperature, defrosted, thawed, soaked, chilled, cold, cooled, cooked, marinated, frozen): those genuinely happen before
     you start, so they stay as they are.
  3. Leading adverbs are kept (finely, roughly, thinly, thickly, coarsely, lightly); then one to three **actions** joined by
     "and", each from a fixed table of participle → imperative: sliced→slice, diced→dice, chopped→chop, minced→mince,
     grated→grate, crushed→crush, peeled→peel, deseeded→deseed, halved→halve, quartered→quarter, cubed→cube, shredded→shred,
     trimmed→trim, torn→tear, cored→core, stoned→stone, crumbled→crumble, bashed→bash, zested→zest, juiced→juice,
     beaten→beat, whisked→whisk, sifted→sift, drained→drain, rinsed→rinse, melted→melt, toasted→toast; and the phrases
     "cut into …", "zest only", "juice only", "leaves only". **An unknown first word gives no step** (under-detect, the rule
     `extractStepDuration` already follows): "chopped/crushed" and "blitzed" stay as now.
  4. The name is the line's own words before the comma, less a leading count unit (`COUNT_UNITS`, read only), never the
     shopping key or the dictionary's name, so a dictionary change never moves a label.
  5. Preparation *before* the name ("150 g grated cheddar") is not read: it may be what you buy (`PRODUCT_FORM`), and the
     converter is already asked not to write it.

  Made-up examples: `2 leeks, thinly sliced` → **Thinly slice the leeks**; `3 carrots, peeled and diced` → **Peel and dice the
  carrots**; `400 g potatoes, cut into 2cm chunks` → **Cut the potatoes into 2cm chunks**; `1 lemon, zest only` → **Zest the
  lemon**; `1 bunch parsley, leaves only` → **Pick the parsley leaves**; `50 g butter, softened`, `black pepper, to taste`,
  `500 ml vegetable stock` → no step.

- **`withPrepSteps(parsed)`** → a new `{groups, stages}` for drawing; **the input is never changed**, and if
  `computeColumns(parsed)` has errors it returns `parsed` as it is (the errors are shown as today).
  - **Rows never move.** A group with prepared lines is split, in order, into parts: runs of unprepared lines, and runs of
    adjacent lines with the *same* step ("2 carrots, diced" + "2 celery sticks, diced" → one box, **Dice the carrots and celery
    sticks**). Part handles carry `~` (`veg~2`), which `\w+` in the parser can never produce, so they cannot collide.
  - Each part carries `family` (the group's handle) and `paletteIndex` (its index), and **`computeColumns` gains one rule**:
    a group's colour is `PALETTE[g.paletteIndex ?? i]`, and a MERGE whose inputs all share one family keeps that colour instead
    of `MERGE_COLOR`. A recipe with no parts lays out byte-identically (§7, check 3).
  - The MERGE that first consumes the group has its input replaced, in place, by the part handles (prepared parts by the
    prep step's output). The parts are contiguous rows, so the adjacency check passes by construction.

## 5. Where the steps go, and time

- **Placement (recommended): alongside the step before the one that needs it.** A group first used in stage *k* gets its prep
  boxes in stage *k−1*, on its own rows, which are blank there today: "slice the leeks while the onions soften", which is the
  point of not doing everything first. Two exceptions get a **column of their own just before stage *k***: *k* is the first stage
  (nothing runs before it), or every step in stage *k−1* is `[instant]` (nothing to work alongside). Measured: this adds at most one
  column, in 16 of the 35 recipes. The alternative, a column of its own before every stage that needs prep, would add 79
  columns across the 35 (2.3 on average to 7.1 today, up to 5): a much wider diagram on the tablet.
- **Prep boxes** are drawn in the group's colour, solid like any step, with no duration badge, and marked `prep` so the CSS can
  set them a shade lighter. Ticking the step that uses them ticks them too (the existing overlap rule, `index.html:2593`).
- **No durations are invented.** The format's own comment is that a made-up number is "actively misleading" for sequencing
  recipes together (`core.js:106`). The **timeline is drawn from the recipe as written**, in both viewers (`computeTimeline`
  and `computeGroupTimeline` keep `parsed`, not the derived layout), so the timeline strip and the Group Viewer's sequencing do
  not change at all. Tap-to-jump still lands: the consuming step keeps its output handle.

## 6. Everything else

- **Shopping list, ticks on it, aisles, word matches:** untouched by construction. The derived layout is used only by
  `buildFlowHTML`; `buildShoppingList` keeps reading `parseRecipe(...).groups` (`index.html:6483`). No naming changes, so no
  re-keyed ticks; re-measured anyway (§7) to show it.
- **Scaling:** the viewer and Group Viewer scale the text first and derive after; labels carry no quantity ("2cm" in "cut into"
  is not scaled, as today).
- **Flow ticks:** they are keyed by geometry, and columns move when the setting does, so the tick key becomes
  `recipe.id + '|prep'` while steps are shown. Each mode keeps its own place; switching mid-cook loses nothing.
- **Cooking mode:** nothing new hidden; the setting is not on the cooking screen (Q6).
- **Group Viewer:** each recipe follows the device setting, with the same tick key as its own viewer.
- **Add/Edit preview:** shows the recipe **as written** (Q5): it is there to check the text, and a box that is not in the text
  would be confusing there. The hint line says "PREPARATION SHOWN AS STEPS" in the viewers when on.
- **Print / PNG:** the diagram as on screen.
- **Preview checks (`ingredientLineFaults`):** unchanged. A step the app cannot read is not a fault (preparation is style), so the
  preview does not nag. `tools/remeasure.js` gains a count of clauses read, skipped as ahead-of-time, and **unread first words**,
  so the table in §4 grows from evidence.

## 7. How it would be built

**PR 1, `core.js` and tests only, nothing visible.** `prepStepFor`, `withPrepSteps`, the family-colour rule in `computeColumns`,
exports, the `remeasure.js` counts. `KITCHEN_CORE_VERSION`, `core.js?v=` and `EXPECTED_CORE_VERSION` moved together. No
changelog entry (the household notices nothing). Re-measure the library with a fresh export outside the repo: shopping rows
and keys identical to the last run, layout errors 0 with and without prep, read/unread counts recorded in the PR.

**PR 2, `index.html`, `help.html`, docs.** The PREPARATION block and its device storage; `mountFlow`/`buildFlowHTML` take
`opts.prepSteps` (viewer and Group Viewer only); the tick-key suffix; prep box style; the hint line; the APPEARANCE wording.
`changelog.json` entry (version from `date -u` plus the next number, issue 88, plain words, no recipe names) and `APP_VERSION`;
`help.html` gains "Preparation as steps", naming **PREPARATION** and both options in `<b class="ui">`; `docs/TEST-PLAN.md` step
54 and `docs/HOUSEHOLD-JOBS.md` (open a recipe with sliced and diced lines on the tablet, switch, see each step beside the one
before it and the shopping list unchanged; switch back, ticks where they were); `docs/ARCHITECTURE.md` §3 rows for the two
functions.

**Checks, each made to fail once by breaking what it guards** (`core.test.js`, made-up lines only):
1. `prepStepFor` on every example in §4, including each `null`; an unknown word gives `null`.
2. `withPrepSteps` leaves its input deep-equal to before.
3. A recipe with no readable preparation: `computeColumns` of the derived layout deep-equals the original, colours included;
   and every existing layout fixture unchanged by the family-colour rule.
4. Rows identical (`buildRows`), no errors, on fixtures with prep in stage 1, in stage *k*, after an all-`[instant]` stage.
5. Adjacent same-step rows share a box; rows of two groups never do.
6. A recipe with layout errors comes back unchanged.
7. `aggregateShoppingLines` over a fixture is identical before and after `withPrepSteps` ran on it.

Smoke (`node test/build.js && node test/smoke.js`): default draws exactly today's HTML; the setting persists in
`localStorage` and makes **no** `household_settings` write; prep boxes appear in the right column; ticking the consumer ticks
them; ticks kept per mode; the last column still logs the recipe; Group Viewer; preview as written; timeline strip identical on
and off; shopping list rows and keys identical on and off; `node test/help-guide.js` for the new labels.

## 8. Risks

- **Wrong verb or odd label** from an unusual clause: limited by the fixed table and under-detection; `remeasure.js` lists what
  was read so the household can spot one.
- **"Alongside" claims you have hands free** during a step that needs stirring throughout: the diagram cannot know. The
  household can choose the own-column placement instead (Q2).
- **The colour rule in `computeColumns`** touches every diagram: guarded by check 3 against today's fixtures.
- **A wider diagram** on 16 recipes (one column): acceptable on the tablet, which already scrolls sideways.
- **Lines the converter wrote before the shape rule** (14 with preparation before the name) get no step; correcting them is the
  existing recipe-text procedure, not this plan.

## 9. Decisions (answered 13 Oct 2026)

**Answered by the household on 13 Oct 2026: "defaults on all plans", so each question below is decided as its recommended answer.** Nothing is built yet.

1. **Who the setting is for:** each device (recommended: the tablet and laptop differ, and no database change) or the household?
2. **Where a step goes:** beside the step before the one that needs it (recommended: fits the waiting time, at most one extra
   column), or in a column of its own just before it (clearer order, a much wider diagram)?
3. **Which words:** knife and hand work plus beaten, whisked, sifted, drained, rinsed, melted, toasted (recommended); softened,
   room temperature, defrosted, soaked and cooked stay "before you start". Anything to add or move?
4. **Time:** no time on prep steps and the timeline as written (recommended), or a guessed time per step on the timeline?
5. **The ingredient line:** left exactly as written, "leeks, thinly sliced" (recommended), or the preparation hidden from the
   line when it is shown as a step? And the Add/Edit preview: as written (recommended) or following the setting?
6. **Where to switch it:** Settings → APP only (recommended for the first version), or also a button beside SHOW TIMELINE?
7. **Default on a new device:** "Before you start", as today (recommended).
