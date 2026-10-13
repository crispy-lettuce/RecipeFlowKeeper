# Sides for "serve with rice" (issue #87)

**Asked for in issue #87** (11 Oct 2026): many recipes end with "rice, to serve" or "serve with naan", and that rice or naan
has no timing, so it never appears in the flow or the combined timeline. **The household chose on 13 Oct** that the app should
spot those phrases and offer a matching **side**: an ordinary recipe in the library (plain basmati rice, garlic naan), with its
own timings, that can be added to the same Planner day so its steps join the combined flow. Scoped 13 Oct 2026 against `main`
at `e11de60`. Line numbers are from that commit. §8 lists the questions for the household, answered 13 Oct. **Built so far:** PR 3, FINISH TOGETHER (13 Oct, §6); PRs 1 and 2
are next.

## 1. What it is for

A curry planned for Friday needs rice. Today someone has to remember the rice, find a rice recipe, add it to Friday, group the
two, and then work out from the timeline when to start it. The app already knows two things that make this nearly automatic:
the recipe says "serve with rice", and the library may hold a side called "rice". This plan joins those two facts, and then
makes the Group Viewer show **when to start** each dish so they are ready together.

## 2. What exists today (read 13 Oct 2026)

- **A Side course already exists.** `course=Side` is one of the eight course values in the converter's `TAGS:` line
  (`converter/conversion-instructions.md:150`), in the library filter (`index.html:4580`) and in `COURSE_ORDER`
  (`index.html:4591`). `parseTags` reads it into `tags.course` (`core.js:69`), and it is saved in the `recipes.tags` column,
  parsed from the text like every other header. The Planner already sorts a day's dishes Main, then Side
  (`index.html:5927`). **Nothing new is needed to mark a recipe as a side.**
- **A day holds several dishes.** `addPlanRecipe(dateStr, recipeId)` (`index.html:4083`) appends to the day's parallel
  `recipe_ids` / `servings` / `premade` arrays and calls `savePlanDay` (`index.html:4002`): one `planner_days` upsert for that
  date, key `planner_days:<date>`. It is the one place a recipe goes onto a day (the picker, `activateCard`, `index.html:5052`,
  and the shortlist both come here), and it also applies the calendar toggles (`applyCalendarAuto`, `index.html:4194`).
- **Cooking together is a meal group.** GROUP SOME TOGETHER → GROUP SELECTED (`index.html:5993`, `:6246`) calls `createGroup`
  (`index.html:4394`), which deletes any overlapping group on that day and writes one `meal_groups` row through `saveGroup`
  (`index.html:4368`). Removing a dish from a day dissolves every group it was in (`dissolveGroupsContainingOnDate`,
  `index.html:4405`, called from `removeOne`, `:6214`).
- **The Group Viewer** (`renderGroupViewer`, `index.html:5152`) scales each dish to the day's headcount
  (`plannedServingsLookup`, `:5144`), stacks each dish's own flow, and draws one combined strip (`computeGroupTimeline` and
  `buildGroupTimelineHTML`, `index.html:2346` and `:2358`). **Every dish starts at 0**: each lane is that recipe's own
  `computeTimeline` (`core.js:617`), whose steps begin at t = 0. The ruler's first tick reads `START` and the header shows
  `LONGEST`. A dish with no bracket timing gets no lane, only a "No timing data yet for…" note. **Nothing lines up the
  finishes. "Serve at the same time" does not exist and must be added (§4.4).** In `computeTimeline` an untimed step counts 2
  min (`DEFAULT_STEP_MINUTES`) and an open-ended or overnight step also counts 2 min, so every span is approximate.
- **Where "to serve" phrases live.** The converter writes an unmeasured line as `<name>, to serve` inside a GROUP
  (`conversion-instructions.md:92`). The shopping list reads it through `TAIL_NOTES` (`core.js:1058`) and `unmeasuredPurpose`
  (`core.js:1251`) as "to serve". "Serve with …" in prose ends up in a MERGE label, in `STEPS:`, or under
  `NOTES:`/`TIPS:`/`VARIATIONS:` (`parseRecipe`, `core.js:204`, returns these as `stages[].label`, `setup` and `notes.*`).
  **The live library puts most of them in MERGE labels** (§3), so a detector that read only ingredient lines would miss most.
- **The matching tools are in `core.js`**: `foldPlural` (`core.js:1064`), `shoppingKeyForName` (`core.js:1377`), and the
  shared-last-word rule of `strictMatchSuggestions` (`core.js:1384`).

## 3. Measured on the live library (read-only, counts only, 13 Oct 2026)

Lines matching *to serve / serve(d) with, alongside or over / to accompany / on the side* were counted per household. Recipe
text, titles and lines were not read out. This SQL pattern is broader than the detector proposed in §4.2, so treat these as
upper bounds.

| | Household 1 | Household 2 |
| --- | --- | --- |
| Recipes (of which Main / Side) | 34 (18 / 3) | 5 (5 / 0) |
| Lines with a serving phrase | 15 | 8 |
| … in a MERGE label / an ingredient line / NOTES, TIPS or VARIATIONS | 9 / 3 / 3 | 3 / 4 / 1 |
| Non-side recipes naming a staple (rice, naan, bread, potatoes, salad …) in such a line | 7 | 4 |
| … of those, with a Side in the same library whose title has that word | **7** | **0** |
| Recipes with such a line that names no staple (garnish, plates: false-positive material) | 6 | 2 |
| Side recipes with bracket timings | 3 of 3 | none |
| Meal groups · days with 2+ dishes · days with a Side planned | 8 · 12 · 6 | 0 · 0 · 0 |

The third household has no recipes. `recipe_shares` holds 1 row, so browsing is switched on in one direction.
**What this shows:** in household 1, every recipe that names a staple would get an offer from sides it already has. In
household 2 nothing would be offered until it has sides (§5).

## 4. The proposal

### 4.1 What makes a recipe a side

**A recipe tagged `course=Side`, and nothing else.** That needs no column, no migration, no new syntax header, and no
converter change, and every existing Side is a candidate from day one. A new header (`SIDE_FOR: rice`) was considered and
rejected: it would mean a new parser rule, a new converter version that puts the CONVERTER bar in front of both households,
and existing sides would need rewriting. An optional **keyword** helps where the title doesn't say it. For example, a side
called "Jewelled saffron pot" tagged `Rice` matches "serve with rice". Keywords are already in `TAGS:` and need nothing new. Only the
household's own library is offered: the Planner only takes its own recipes.

### 4.2 Spotting the phrases: `servingCalls(parsed)` in `core.js`, pure

Input is `parseRecipe`'s result. Output is a list of `{ items: ['rice', 'naan'], where: 'ingredient'|'step'|'notes' }`.

- **Ingredient lines** (every GROUP item): a line whose tail is `to serve`, `for serving`, `to accompany` or `on the side`.
  The name is the line's own shopping name (`shoppingLine(rest).key`). The detector strips `to accompany` and `on the side`
  itself. **They are not added to `TAIL_NOTES`**, because that would change how ingredients are named and re-key the
  household's ticks (CLAUDE.md).
- **Prose** (MERGE labels, `STEPS:`, every NOTES section): `serve(d) [it|this|them] with|alongside|over|on a bed of <X>`,
  `with <X> on the side`, `<X> to accompany`, `accompanied by <X>`. `<X>` runs to the next `.;:!?(`. It is split on commas
  and on `or`, `and` and `and/or` into alternatives. Leading `a`, `some`, `plenty of` and `a bed of` are dropped.
- **Ignored on purpose:** `to serve 4`, `serves 4`, `enough to serve`, `serve immediately/hot/warm`, and `serve on warmed
  plates` (`on` alone is not a pattern). The function reports what it heard. It never decides what is a side.

**Detect broadly, offer narrowly.** A phrase leads to an offer only when §4.3 finds a matching side. "Lime wedges, to serve" is
heard, matches no side, and shows nothing. That is how false positives are handled, without a stop-list of garnishes.

### 4.3 Matching: `matchSides(calls, sides)` in `core.js`, pure

`sides` is `[{ id, title, keywords }]`, given by the page already filtered to `course=Side` and ordered most-cooked first.
The recipe itself is excluded. Each item and each side are folded the same way: lower-cased, `foldPlural`, and descriptor
words dropped (`steamed`, `plain`, `warm`, `cooked`, `crusty`, `fresh`, `fluffy`). Score, best first:

1. **3**: the item equals the side's title or one of its keywords ("basmati rice" → "Basmati rice").
2. **2**: every word of the item is in the side's title or keywords ("basmati rice" → "Plain basmati rice").
3. **1**: the item's last word, its head noun, is there ("rice" → "Coconut rice"; "naan" → "Garlic naan").

At most two sides per alternative and three per dish, with ties kept in the page's order. Returns
`[{ item, sideId, score }]`. Nothing is written and nothing is blocked: **it is advice**, like `ingredientLineFaults`.

### 4.4 The Group Viewer: FINISH TOGETHER

A pure `lineUpTimelines(timelines, mode)` in `core.js` takes each recipe's `computeTimeline` result. In `'finish'` mode it
returns each recipe's offset (`longest span − its span`) and its steps shifted by that offset. In `'start'` mode it returns
today's behaviour (offset 0). `computeGroupTimeline` calls it. The arithmetic moves to `core.js` so it can be tested in Node;
the drawing stays in `index.html`.

- The strip gains a two-way switch: **START TOGETHER · FINISH TOGETHER**. In FINISH mode the last tick reads `SERVE`, and each
  stacked dish's header shows **START AT +1h 10m**, or **START FIRST** for the longest dish. The word **ABOUT** is added when
  the longest dish has an untimed or open-ended step, since the 2-minute stand-in makes its span a guess.
- **Default (§8 Q4):** FINISH TOGETHER when the group holds a Side, otherwise START TOGETHER as now. The choice lasts for the
  tab and is never stored, so there is no write and no column. A main with a dessert in the same group keeps today's view.
- A side with no bracket timings still gets no lane, and the existing "No timing data yet" note names it.

### 4.5 Where the offer appears

**On the Planner, under the dish** (the main place, because only there is the day known):

```
Lamb and lentil stew            MAIN  1 HR   SERVES 4  ×
  SERVE WITH RICE OR NAAN:  + PLAIN BASMATI RICE   + GARLIC NAAN   ×
```

- It shows for a non-Side dish on today or a later day, when §4.3 finds a side. It hides for an alternative already covered:
  a side scoring 1 or more on that alternative is already on the day. It is not shown on past days, AWAY days, in GROUP SOME
  TOGETHER mode, or for a "Recipe removed" row.
- The **×** hides it for that dish on that day **in this tab only**. Nothing is stored. A remembered "never for this recipe"
  would need a column, and §8 Q5 asks whether it is wanted.
- After CHOOSE A RECIPE adds a dish, the Planner redraws, so the offer is simply there. The picker gains nothing.

**In the recipe viewer, read-only:** one line under the recipe's chips (`renderProvenance`, `index.html:5309`):
`SERVE WITH: Plain basmati rice → · Garlic naan →`. Each link opens the side. The viewer is not told which day it was opened
from (`openRecipe`, `index.html:5125`), so it adds nothing to the plan. It is hidden for another household's recipe.

### 4.6 What tapping **+ PLAIN BASMATI RICE** writes

At most two writes, one row each, as CLAUDE.md requires:

1. **`planner_days`, that date:** `addPlanRecipe(date, sideId, servings)`, with a new optional `servings` argument so the side
   joins at the main's planned headcount in the same single upsert (0 when that equals the side's own SERVINGS).
2. **`meal_groups`, one row:** the main is already in a group that day → `saveGroup` with the side appended. Otherwise →
   `createGroup(date, [mainId, sideId])`. Its "delete overlapping groups" finds none, because the side was not on the day.

Toast: *"Plain basmati rice added to Fri 17 Oct, cooking with Lamb and lentil stew."* Taking it off again is the row's
existing **×**. That dissolves the whole group (`dissolveGroupsContainingOnDate`), which is today's behaviour for any dish
(§7). The calendar sync, diary and shopping list behave as for any dish added to a day: the side's ingredients join the list,
and finishing its flow logs it as cooked (`finishRecipe`, `index.html:5464`).

### 4.7 Not in this plan

No change to `shoppingLine`, `TAIL_NOTES` or the dictionary, so no tick is re-keyed. No hiding of the main's
"rice, to serve" row when a side is planned. That row stays as it is now, beside the side's "250 g basmati rice". The existing
MERGE WITH… suggestion may pair them, since they share a last word. No converter change, no schema change, no Edge Function.

## 5. Starter sides

Sides are **ordinary recipes, written by the household in the app**: ADD with the converter for a source they like, or the
hand template (`HAND_TEMPLATE`, `index.html:9559`) with `course=Side`. A session does not write recipes into the live
database (CLAUDE.md). Household 1 already has three staple sides, all timed. Household 2 has none; it can write its own, or,
where sharing runs that way, ADD TO OUR RECIPES from household 1. A made-up example of the shape (each line checked: none is
in the library):

```
TITLE: Plain basmati rice
SOURCE: Personal recipe
SERVINGS: 4
TAGS: course=Side, Rice

GROUP rice:
250 g basmati rice
GROUP water:
375 ml water

STAGE:
MERGE rice, water -> cooked: simmer, lidded [10 min]
STAGE:
MERGE cooked -> rested: leave to steam off the heat [5 min]
```

The help guide says what makes a good side: `course=Side`, the staple's name in the title or a keyword, and **bracket timings
on every step**, without which it has no lane.

## 6. Phased PRs

Each PR runs `node test/core.test.js`, then `node test/build.js && node test/smoke.js`, reading the exit code. Every new check
is made to fail once by breaking the code it guards. Any PR touching `core.js` bumps the version in all three places.

1. **PR 1: the detector and the viewer line.** `servingCalls`, `matchSides` (`core.js`). The viewer's SERVE WITH line.
   - *core.test.js:* each pattern (an ingredient tail, a MERGE label, STEPS, NOTES); `rice or naan` gives two alternatives;
     a stop at punctuation; `to serve 4`, `serve immediately` and `serve on warmed plates` give nothing; scores 3, 2 and 1 in
     order; plurals fold ("potatoes" → "potato"); a keyword matches; the recipe never matches itself; a non-Side never matches;
     `TAIL_NOTES` unchanged (`shoppingKeyForName('rice, to accompany')` keeps its present key).
   - *Smoke:* the line shows with links for a made-up main in `test/stub.js`, is absent with no Side in the library, and is
     absent on a shared recipe.
   - Changelog entry; help §4 paragraph; run `test/help-guide.js`.
2. **PR 2: the Planner offer.** The row, `addPlanRecipe`'s `servings` argument, and the two writes.
   - *Smoke:* the offer shows, then hides once the side is on the day; it is absent on past days, AWAY days and in grouping
     mode; × hides it with no write; a tap sends exactly one `planner_days` upsert for that date and one `meal_groups` upsert,
     scoped to the household; the side is grouped with the main (an existing group is extended rather than a new one made);
     the headcount follows the main's.
   - Changelog; help; TEST-PLAN step (next free number in the 54 series) and the same step in `docs/HOUSEHOLD-JOBS.md`.
3. **PR 3: FINISH TOGETHER.** `lineUpTimelines` (`core.js`), the switch, START AT on each card.
   - *core.test.js:* a 60-minute main and a 15-minute side give offsets 0 and 45; `'start'` gives 0 and 0; a null timeline
     stays laneless; ABOUT is set when the long dish has an open-ended step.
   - *Smoke:* the default is FINISH for a group with a Side and START otherwise; the switch moves the side's lane; START AT
     shows; KEEP AWAKE still shows the switch.
   - Changelog; help; a tablet step. PR 3 depends only on today's groups, so it can go first if the household prefers.
   - **Built first, 13 Oct 2026** (core 2026-10-13.2, app 2026-10-13.5; tablet step 57a). In cooking mode the switch sits with
     the timeline behind SHOW TIMELINE, and START AT stays on each dish's header.

## 7. Risks

- **Nagging.** Mitigated by offering only on a match, only on today and later, never twice once covered, and with ×.
  Household 1's count says at most 7 dishes would carry an offer.
- **A wrong match** ("serve with the sauce" → a side called "Peanut sauce"). Advice only; one tap to remove. A score-1 match
  could be dropped if this happens in practice.
- **Removing the side dissolves the whole group,** the main's other grouped dishes included. This is today's behaviour, more
  visible now. Shrinking the group instead is a small follow-up, not part of this plan.
- **FINISH TOGETHER is only as good as the brackets.** Untimed and overnight steps count 2 minutes, hence ABOUT. A main with
  an overnight marinade still shows a sensible order but not true clock times.
- **The shopping list shows two rice rows** (the main's "to serve" and the side's amount), as noted in §4.7.
- No schema, hydrate, write-queue or calendar change, so the sign-in and stale-tab risks of earlier plans don't arise.

## 8. Decisions (answered 13 Oct 2026)

**Answered by the household on 13 Oct 2026: "defaults on all plans", so each question below is decided as its recommended answer.** PR 3 is built (§6).

1. **Which recipes are offered as sides:** every `course=Side` recipe (recommended), or only those also tagged with a keyword
   such as `Standard side`?
2. **What a tap does:** adds the side to the day *and* groups it with the dish (recommended, as that is what puts its timing in
   the combined flow), or only adds it to the day?
3. **How many it's cooked for:** the same number as the dish it goes with (recommended), or as the side's recipe is written?
4. **Group Viewer line-up:** FINISH TOGETHER by default when a group has a Side, START TOGETHER otherwise, with a switch
   (recommended), or FINISH TOGETHER for every group?
5. **Dismissing an offer:** × hides it until the app is reloaded, with nothing stored (recommended), or "never for this
   recipe", remembered across devices? The second needs a new column, which you would apply first.
