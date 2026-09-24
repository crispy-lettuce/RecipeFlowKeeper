# Kitchen App — Verifying Phases 1 and 2 against the real backend

> **This pass was completed on 21 Sep 2026.** All 20 steps passed against the real backend.
> Two findings came out of it — PNG export truncating to one screenful, and a request that Keep
> Awake collapse the sidebar — both fixed the same day; see `docs/HANDOVER.md` §7.
>
> The document stays live as a **regression checklist**: run it again after any change to
> `hydrate()`, the write queue, or anything the expected counts below depend on. **Re-read those
> counts from the database before each run** — they go stale every time the library changes, and
> a stale count reads as a failure.

## Context

Phases 1 and 2 are built and live on `main`; the pass below was run on 21 Sep and the branch
story that used to open this paragraph is history. 213 automated checks pass (102 when this was
written). But those checks run against a **stubbed** Supabase: every
query is answered from a fixed object in `test/stub.js` and every write is recorded rather than sent.
So the parts most likely to go wrong have never actually run — sign-in, hydration, row-level
security, and the background write queue.

`main` holds an **older build of the Supabase app** — not the pre-Supabase one this line claimed
until 21 Sep; see `docs/INFRASTRUCTURE.md` §2. So something *is* deployed, and it shares this
database. Nothing in this plan writes anything the app itself wouldn't, but "nothing live can
break" was never quite true.
This pass is about earning the confidence to merge.

**Scope of this plan:** run the branch locally, work the checklist below, report what fails.
The tablet-only checks are listed but explicitly deferred to after the merge.

## Getting it running

```sh
git clone https://github.com/crispy-lettuce/RecipeFlowKeeper.git kitchen-test
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
| Diary entries (`recipe_logs`) | 115 |
| Keywords | 47 |
| Planned days | 18 |
| Meal groups | 4 |
| Shortlist items | 3 |
| Ingredient swaps | 1 |
| Ticked shopping items | 9 |
| Word matches (aliases) | 7 |
| Week starts on | Friday |

**Re-read these from the database before every pass.** They change whenever the library or the
planner does, and a stale number here turns a correct app into a reported failure. The query is
at the end of this document.

**The Planner is no longer expected to look empty.** Until 22 Sep this section said every
stored planner day was in the past and that an empty Planner was therefore the correct result.
That is now false — the newest planner day and meal group are both **2026-09-23**, in the
future — so **an empty Planner today would be a genuine bug**. This is exactly the kind of
prose conclusion that goes stale along with the numbers it was drawn from, while looking like
settled guidance.

## The things that will look like bugs and aren't

**This section used to say that 23 of 40 recipes had no servings, so most of Phase 2 was
invisible. That is no longer true** — the 20 Sep ingestion gave every recipe servings and nearly
every one full step timings. The scaling controls and the timeline strip should now appear
almost everywhere, so **if either fails to render, that is a real finding**, not the library
being sparse. Any recipe is now a fair choice for the scaling checks.

Some things that *will* still look wrong and aren't:

1. **Some planner slots and meal-group entries show "Recipe removed"** (8 and 2 on 21 Sep; 7 and 1 on 23 Sep). They point at recipes
   deleted during ingestion. `planner_days.recipe_ids` and `meal_groups.recipe_ids` are plain
   `uuid[]` with no foreign key, so nothing cleaned them up. Expected. Clear them from the
   Planner when convenient — but check they render as placeholders rather than throwing first,
   because that path has never been exercised with real data.
2. **One shortlist item has no recipe behind it.** `shortlist_items.recipe_id` is
   `ON DELETE SET NULL`, so a dropped recipe leaves the entry as plain text. By design.
3. **Victoria Sandwich has no timeline strip and no source link.** It is the one recipe the
   ingestion deliberately left untouched — see `docs/HANDOVER.md` §3. Every *other* recipe
   should show both.
4. **27 keywords in the vocabulary that nothing is tagged with** — Christmas, Easter, BBQ,
   Weeknight, Picnic and so on. Not leftovers to tidy away: the conversion instructions
   deliberately refuse to guess occasion tags, leaving them for you to apply by hand, so these
   are vocabulary waiting to be used. Leave them.

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

## B2 — Automatic image re-hosting (new 22 Sep, never run against the real backend)

**Split into its own document: `docs/TEST-IMAGES.md`.** Eleven steps, about 25 minutes, needs a
desktop because three of them want devtools or the SQL editor. It is kept separate because it is
the only pass that can say anything about whether images actually reach Supabase — the smoke suite
stubs the backend entirely — and because it stands alone: you will want to re-run it after any
change to how images are saved, without re-running everything else here.

Its step 4 is the one to stop on. If a re-hosted photo reverts after an *unrelated* save, the
feature is undoing itself silently and nothing on screen looks wrong.

## C — Export and import (Phase 1 task, still open)

19. **Export.** Sidebar → EXPORT DATA. Open the file and confirm it has `version: 3`, a `diary`
    array carrying meal types and any ad-hoc entries, and `settings`
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
- **`main` IS production.** GitHub Pages serves from it and every merge redeploys the live app
  within minutes. This line used to say the opposite; it was wrong from PR #1 onwards. To roll
  back, revert the merge commit on `main` — Pages will redeploy the previous build.
- If a screen throws, the console error and the step that triggered it is usually enough for me to
  find it without you digging further.

## After a clean pass

Merging `claude/recipe-app-supabase-0z139o` into `main` is what puts it on the tablet, and is the
go-live moment for the Supabase migration as a whole.

**The library reprocess that used to come next has already happened** (20 Sep, ahead of this pass
rather than after it — see `docs/HANDOVER.md` §3). So after a clean pass the next step is the
merge itself, and then image re-hosting (R7). The two open questions this section used to list
are both resolved:

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

S2 dark mode shipped 22 Sep and is covered by the smoke suite; the thing worth a human eye is
contrast on the real tablet, which no headless check can judge.

---

## Re-reading the expected counts

Run this before every pass and replace the table at the top with what it returns. The counts
went stale between 21 and 22 Sep and produced a section of confidently wrong guidance, which is
the failure this query exists to prevent.

```sql
select (select count(*) from recipes)          as recipes,
       (select count(*) from recipe_logs)      as diary_entries,
       (select count(*) from keywords)         as keywords,
       (select count(*) from planner_days)     as planned_days,
       (select count(*) from meal_groups)      as meal_groups,
       (select count(*) from shortlist_items)  as shortlist,
       (select count(*) from ingredient_swaps) as swaps,
       (select count(*) from shopping_checked) as ticked_shopping,
       (select count(*) from aliases)          as word_matches,
       (select week_start_day from household_settings limit 1) as week_start_day,
       (select max(plan_date)::text from planner_days)         as newest_planner_day,
       (select max(date_iso)::text  from meal_groups)          as newest_meal_group;
```

**Read the last two.** If `newest_planner_day` is in the past, an empty Planner is correct. If
it is in the future, an empty Planner is a bug. That one distinction is what the 21 Sep version
of this document got wrong for a day.

**Then the header drift.** `docs/ARCHITECTURE.md` §2 makes the recipe text the truth and the
columns a parse of it, and since 24 Sep (PR 4) the save rewrites every header line from the
form. This counts the recipes where a line and its column still disagree. Every column should
be 0; a non-zero count names a recipe that is one PARSE & PREVIEW away from reverting an edit.
On 23 Sep, before PR 4, it found 3 recipes: a `SOURCE:` line, a missing `SERVINGS:` line, and
two `TAGS:` lines (one of them on the servings recipe) — the review had counted two, because its
query never compared `TAGS:`.

```sql
with h as (
  select id,
    substring(syntax from '(?m)^TITLE:[ \t]*(.*)$')              as l_title,
    substring(syntax from '(?m)^SOURCE:[ \t]*(.*)$')             as l_source,
    substring(syntax from '(?m)^(?:SOURCE_URL|URL):[ \t]*(.*)$') as l_url,
    substring(syntax from '(?m)^IMAGE:[ \t]*(.*)$')              as l_image,
    substring(syntax from '(?m)^TIME:[ \t]*(.*)$')               as l_time,
    substring(syntax from '(?m)^SERVINGS:[ \t]*(.*)$')           as l_serv,
    substring(syntax from '(?m)^EQUIPMENT:[ \t]*(.*)$')          as l_equip,
    substring(syntax from '(?m)^TAGS:[ \t]*(.*)$')               as l_tags,
    trim(both ', ' from concat_ws(', ',
      case when coalesce(tags->>'course','') <> '' then 'course=' || (tags->>'course') end,
      (select string_agg(k, ', ') from jsonb_array_elements_text(coalesce(tags->'keywords','[]'::jsonb)) k)
    )) as col_tags,
    title, source, source_url, image_url, time_text, servings, equipment
  from recipes)
select count(*) filter (where coalesce(l_title,'')  <> coalesce(title,''))            as title_drift,
       count(*) filter (where coalesce(l_source,'') <> coalesce(source,''))           as source_drift,
       count(*) filter (where coalesce(l_url,'')    <> coalesce(source_url,''))       as url_drift,
       count(*) filter (where coalesce(l_image,'')  <> coalesce(image_url,''))        as image_drift,
       count(*) filter (where coalesce(l_time,'')   <> coalesce(time_text,''))        as time_drift,
       count(*) filter (where coalesce(l_serv,'')   <> coalesce(servings::text,''))   as servings_drift,
       count(*) filter (where coalesce(l_equip,'')  <> coalesce(equipment,''))        as equipment_drift,
       count(*) filter (where coalesce(l_tags,'')   <> coalesce(col_tags,''))         as tags_drift
from h;
```

A recipe this names is fixed by opening it, pressing EDIT and then SAVE RECIPE with nothing
changed: the save rewrites its header lines from the form.
