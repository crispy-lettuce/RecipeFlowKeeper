# Kitchen App — Verifying Phases 1 and 2 against the real backend

## Context

Phases 1 and 2 are built and pushed to `claude/recipe-app-supabase-0z139o` (15 commits ahead of
`main`), and 86 automated checks pass. But those checks run against a **stubbed** Supabase: every
query is answered from a fixed object in `test/stub.js` and every write is recorded rather than sent.
So the parts most likely to go wrong have never actually run — sign-in, hydration, row-level
security, and the background write queue.

`main` still holds the pre-Supabase app, so nothing here is deployed and nothing live can break.
This pass is about earning the confidence to merge.

**Scope of this plan:** run the branch locally, work the checklist below, report what fails.
The tablet-only checks are listed but explicitly deferred to after the merge.

## Getting it running

```sh
git clone -b claude/recipe-app-supabase-0z139o \
  https://github.com/crispy-lettuce/RecipeFlowKeeper.git kitchen-test
cd kitchen-test
python3 -m http.server 8080      # or: npx http-server -p 8080
```

Then open **http://localhost:8080** — not the file directly. A real origin makes localStorage and
sign-in behave exactly as they will in production, and `localhost` counts as a secure context, so
Keep Awake gets the genuine screen-lock API rather than the video fallback.

Keep the browser console open throughout (F12 → Console). A red error there is a finding even if
the screen looks fine.

## What the database holds right now

Numbers to check against, **re-read from the project on 20 Sep 2026, after the recipe
ingestion.** The earlier figures in this table described the 40-recipe library that ingestion
replaced.

| | |
|---|---|
| Recipes | 33 |
| Cooking-log entries | 114 |
| Keywords | 34 |
| Planned days | 15 |
| Shortlist items | 2 |
| Meal groups | 2 |
| Ingredient swaps | 1 |
| Ticked shopping items | 0 (cleared deliberately) |
| Word matches | 0 (none recorded yet) |
| Week starts on | Friday |

## The things that will look like bugs and aren't

**This section used to say that 23 of 40 recipes had no servings, so most of Phase 2 was
invisible. That is no longer true** — the 20 Sep ingestion gave every recipe servings and nearly
every one full step timings. The scaling controls and the timeline strip should now appear
almost everywhere, so **if either fails to render, that is a real finding**, not the library
being sparse. Any recipe is now a fair choice for the scaling checks.

Three things that *will* still look wrong and aren't:

1. **8 planner slots and 2 meal-group entries show "Recipe removed".** They point at recipes
   deleted during ingestion. `planner_days.recipe_ids` and `meal_groups.recipe_ids` are plain
   `uuid[]` with no foreign key, so nothing cleaned them up. Expected. Clear them from the
   Planner when convenient — but check they render as placeholders rather than throwing first,
   because that path has never been exercised with real data.
2. **One shortlist item has no recipe behind it.** `shortlist_items.recipe_id` is
   `ON DELETE SET NULL`, so a dropped recipe leaves the entry as plain text. By design.
3. **Victoria Sandwich has no timeline strip and no source link.** It is the one recipe the
   ingestion deliberately left untouched — see `docs/HANDOVER.md` §3. Every *other* recipe
   should show both.

## A — Phase 1 foundations (never yet run against the real backend)

1. **Sign in.** Expect the library to appear, 33 cards, no console errors.
2. **Hard reload** (Ctrl/Cmd-Shift-R). Expect to stay signed in, still 33.
3. **Sign out, then back in.** The riskiest single path — any throw during hydration signs you
   straight back out, which would show as a login screen you cannot get past.
4. **Check the counts** against the table above: sidebar shortlist count, keywords and sources in
   Settings, swaps on the Swaps screen, groups shown on the Planner.
5. **Make one small change and hard-reload** — favourite a recipe, say. If it survives the reload it
   reached the database, because the page rebuilds entirely from Supabase on load. This is the only
   way to see the write queue working.
6. **Open a second tab** and confirm the change is there too. There is no live sync by design, so a
   reload is required — that is expected, not a fault.

## B — Phase 2, the nine changes

7. **Week start.** Settings → change it to Sunday. Planner, Shopping List and History should all
   re-bucket together. Set it back to Friday afterwards.
8. **History calendar.** Columns start on the chosen day, every date sits under the correct weekday,
   and "most cooked by day of week" still names the right day.
9. **Scaling.** Open a recipe with servings → **COOK FOR** → 6. Quantities scale, the meta line reads
   `SERVES 6 (SCALED FROM n)`, **RESET** returns it. Nothing is saved — reopen and it is back to normal.
10. **Servings required.** Edit any recipe, clear the servings field, try to save. Expect a refusal,
    not a silent save.
11. **Planner servings.** Tap a **SERVES** pill, set 6. The pill lights up, survives a reload, and the
    Shopping List quantities for that recipe change to match.
12. **Shopping list totals.** Find an ingredient two planned recipes share. Expect one line, in one
    unit — 500 g and 1 kg should read as a single 1.5 kg.
13. **Hide ticked / clear ticks.** Tick a few, hide them, show them again, clear them.
14. **Both Weeks.** Switch to it, tick something, switch back to a single week. That tick must **not**
    appear there; the two lists keep their ticks separately on purpose.
15. **Word matches.** If the list offers to combine two ingredient names, answer one "yes" and one
    "no". Both should appear in Settings → Word Matches, and neither should be asked again. At most
    three questions per visit. You may get none — that is fine, the prep-word change already merges
    most variants without asking.
16. **Viewer ticks.** Tick three steps, then change COOK FOR. The ticks must survive. **RESET TICKS**
    clears them without moving you off the recipe.
17. **Sidebar.** Narrow the window to roughly 1000px and open a recipe. The sidebar slides shut, the
    tab on the left brings it back, and leaving the recipe restores it.
18. **Group Viewer.** Open one of the two groups from the Planner. Expect Keep Awake, Reset Ticks,
    Export PNG and Print at the top; Favourite, Edit and **OPEN →** per recipe; the nav highlight
    still on Planner. **OPEN →** then back should return you to the group with ticks intact.

## C — Export and import (Phase 1 task, still open)

19. **Export.** Sidebar → EXPORT DATA. Open the file and confirm it has `version: 2` with `settings`
    and `aliases` alongside the recipes.
20. **Import it straight back.** Expect the counts above to be unchanged afterwards. This rewrites
    everything, so do it while you still have the export you just took.

**Keep that export file.** It is your undo for this whole session. The nightly backup in
`PrivateBackup` is the other one.

## Deferred to the tablet, after merging

- **Keep Awake** on both the Recipe and Group Viewers. It cannot be tested on a desktop browser in
  any meaningful way — the failure mode is a screen that dims twenty minutes later.
- The sidebar peek and general reachability with wet hands at arm's length.

## If something fails

Tell me the step number, what you saw, and anything red in the console. Useful to know:

- Your data is in Supabase, not the browser, so clearing site data or closing the tab loses nothing.
- Nothing is deployed — `main` is untouched, so there is no live app to roll back.
- If a screen throws, the console error and the step that triggered it is usually enough for me to
  find it without you digging further.

## After a clean pass

Merging `claude/recipe-app-supabase-0z139o` into `main` is what puts it on the tablet, and is the
go-live moment for the Supabase migration as a whole.

**Then: reprocess the library against the new converter instructions** — decided 14 Sep, building
up to all 40 eventually rather than only the flagged ones.

That absorbs the 23 missing servings rather than needing a separate backfill, because the new
instructions make `SERVINGS:` mandatory and require *asking* for a yield rather than inventing one
(test 5 in `converter/test-set.md`). No separate servings job needed.

Two things to settle before that campaign starts:

1. **~~There is nowhere to record where a recipe came from.~~** Resolved. `SOURCE_URL:` is now
   read by `parseRecipe` and carried in the syntax, and 32 of the 33 recipes have one, so a
   future reprocess starts from the actual page rather than a site name. The one gap is
   Victoria Sandwich.
2. **~~Order the flagged ones first.~~** Resolved by the 20 Sep ingestion. All four dishes with
   known-wrong structure — the granola clusters, No-Bake Chocolate Oat Bars, the almond butter
   oatmeal bars and the chocolate chunk cookies — were restructured, and the three redundant
   granola versions were deleted. The third scan in `converter/test-set.md` records the
   before-and-after for each.

   **Worth checking with your own eyes during this pass**, since the fix has only ever been
   confirmed against the parser, not in a kitchen: open Maple Almond Granola Clusters and
   confirm the vanilla sits in its own box joining *after* the syrup comes off the heat.

Also still deferred: S2 dark mode, dropped out of Phase 2 scope.
