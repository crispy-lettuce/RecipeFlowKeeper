# Regression pass against the real backend

The automated suites (`test/`) run the real page against a **stubbed** Supabase. They prove app logic and nothing about the live
backend: sign-in, hydration, row-level security and the write queue are never exercised there. This is the pass that does, by
hand, in a browser against the real project. Run it after any change to `hydrate()`, the write queue, row-level security, image
saving, or the shopping list's naming, or before trusting a restore.

**Use Test Kitchen** (`docs/INFRASTRUCTURE.md` §3) unless a step says otherwise. Checks for a new feature are not here: they are
written for the household in `docs/HOUSEHOLD-JOBS.md` and removed when reported passed. This page keeps only the standing checks.

Keep the browser console open (F12 → Console). **A red error there is a finding even if the screen looks fine.**

## Getting it running

Either use the live app, or serve the branch: `python3 -m http.server 8080`, then open `http://localhost:8080` (not the file:
a real origin makes sign-in and storage behave as in production, and `localhost` is a secure context for the screen-wake API).

## Expected counts

Re-read these from the database **before every run** and write them down; a stale count reads as a failure. The query:

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

Run it as the household under test (the dashboard's SQL editor sees every household, so add `where household_id = '…'`).
The planner may legitimately show "Recipe removed" for a day whose recipe was deleted: `planner_days.recipe_ids` and
`meal_groups.recipe_ids` are plain `uuid[]` with no foreign key. It must render as a placeholder, not throw. A keyword in the
vocabulary that nothing is tagged with is expected (the converter never guesses occasion tags).

## A. Foundations

1. **Sign in.** The library appears with the expected recipe count and no console errors.
2. **Hard reload** (Ctrl/Cmd-Shift-R). You stay signed in; same count.
3. **Sign out, then back in.** The riskiest path: any throw during hydration signs you straight back out, which shows as a login
   screen you cannot get past.
4. **Counts** match the table above: shortlist in the sidebar, keywords and sources in Settings, swaps in Settings → INGREDIENTS.
5. **One small change, then hard reload.** Favourite a recipe. If it survives, it reached the database, because the page rebuilds
   entirely from Supabase on load. This is the only way to see the write queue working.
6. **A second tab** shows the change after switching to it and back (coming back to a tab re-reads the library).

## B. The everyday features

7. **Week start.** Settings → APP → change to Sunday: Planner, Shopping and History re-bucket together. Put it back.
8. **History calendar.** Columns start on the chosen day; every date sits under the right weekday.
9. **Scaling.** COOK FOR 6 on a recipe with servings: quantities scale, the line reads `SERVES 6 (SCALED FROM n)`, RESET returns it,
   nothing is saved.
10. **Servings required.** Edit a recipe, clear the servings, try to save: refused.
11. **Planner servings.** SERVES set to 6 lights up, survives a reload, and the shopping list quantities follow.
12. **Shopping totals.** An ingredient two recipes share is one row in one unit (500 g and 1 kg read 1.5 kg); a count and a weight
    share a row (`2 + 400 g`).
13. **Hide ticked, clear ticks.** Tick some, hide them, show them, clear them.
14. **Both weeks.** Tick something in BOTH WEEKS; it must not appear ticked in a single week (they keep separate ticks).
15. **Word matches.** The list never asks in a dialog. If a "Same as X?" line appears, MERGE or KEEP APART; both appear in
    Settings → INGREDIENTS → WORD MATCHES and are not offered again. **MERGE WITH…** on any row exercises the same path.
16. **Swaps.** Store a swap for something planned; the shopping list's POSSIBLE SWAPS names it, and a swap for "butter" does not flag
    "peanut butter".
17. **Viewer ticks.** Tick three steps, change COOK FOR: ticks survive. RESET TICKS clears them without leaving the recipe.
18. **Sidebar.** At about 1000 px wide, opening a recipe slides the sidebar shut; the tab brings it back.
19. **Group Viewer.** Open a group from the Planner: START TOGETHER / FINISH TOGETHER, ticks, PNG and print; OPEN → on a dish and
    back keeps the ticks.

## C. Export and import

20. **EXPORT DATA.** The file has `version: 3`, a `diary` array (meal types and ad-hoc entries), and `settings` and `aliases`.
21. **IMPORT DATA** straight back: counts unchanged. This rewrites everything, so do it only with that export in hand.

**Keep the export.** It is your undo for the session. The nightly backup in `PrivateBackup` is the other one.

## D. Two devices at once

Reload the app on both first (a tab opened before a merge runs the old code). Call them A (desktop) and B (phone or tablet).

22. **A stale device must not delete a new recipe.** On A add a recipe. On B, without switching tabs, favourite any recipe. Reload A:
    the new recipe is still there. Reload B: it appears.
23. **A stale device must not undo an edit.** On A edit a recipe's text and save. On B, still stale, favourite that same recipe.
    Reload A: the edit survived and the favourite shows (`updated_at` moved twice).
24. **A delete tidies up.** On A plan, group and shortlist a recipe, then delete it. The Planner shows the day without it and
    without a group; the shortlist does not say "Recipe removed". Reload B: the same.
25. **Ticks add up.** Tick different items on A and B for the same week: both show on both.
26. **A save made offline is kept.** Turn the network off on B and favourite a recipe: the gold OFFLINE bar appears and stays. Turn it on:
    "Back online — sending your changes" (if the write had failed). Reload B: the favourite shows. Do not expect a "Couldn't save"
    toast: an offline write can wait about 30 seconds behind supabase-js's session refresh first.

Then run the count query again; nothing should have changed but what you changed.

## E. Shopping list naming (after any change to `shoppingLine` or a dictionary row)

27. **Fewer, fuller rows.** A shared ingredient is one row listing both recipes; spoons of one thing add (`1 tbsp + 1 tsp`); a line
    with no amount says what it is for.
28. **Nothing wrongly joined.** Read every row once. Garlic cloves and cloves (the spice), cinnamon sticks and ground cinnamon,
    coriander and ground coriander, spring onions and onions, butter and unsalted butter each stay separate. A wrong join costs a
    missed ingredient at the shop.
29. **Aisles.** Produce, Pantry and Spices land where expected; note anything unexpected under Other.
30. **Ticks stick.** Tick three rows, reload: still ticked. Tick one on the tablet, switch tabs on the other device: it shows there.
    **A change to how ingredients are named re-keys every tick**, so run "Re-measuring the live library" (`test/README.md`) first.
31. **No questions.** Opening the list, changing the week and planning a recipe never show a dialog.

## F. Where recipes come in

32. **The source's own list.** Open a recipe that has a source address, EDIT, COMPARE WITH SOURCE. Note whether a list comes back; a
    site that refuses gets "no ingredient list the check can read" and is compared by eye (or by pasting its list).
33. **What the comparison shows.** A highlighted row is on one side only, or paired but different with a reason. A US name made
    British is fine; a different ingredient or amount is not.
34. **Warnings, never a gate.** Add a made-up recipe with `400 ml tin plum tomatoes` and `1 lemon or lime`: the preview names both;
    USE THIS rewrites the first to `400 g plum tomatoes (1 tin)`. It saves with the second warning showing. Delete it.

## G. Images (after any change to how images are saved or the library is loaded and refreshed)

About 25 minutes at a desktop; steps 6 and 7 want devtools or the SQL editor. **Do not take a green `smoke.js` as covering any of
this**: the suite stubs Supabase and can only show that the app *asks* for a re-host. Take an export first.

35. **Add a recipe with an external photo** (any recipe page with a decent photo; fill in SERVINGS). The card appears with the photo.
36. **The photo becomes ours.** After about five seconds, EDIT → IMAGE URL now begins
    `https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/`. Close without saving.
37. **It survives a reload.**
38. **It survives someone else's save. This is the step to stop on.** Favourite an unrelated recipe, hard reload, reopen the test
    recipe's IMAGE URL: still `supabase.co`. If it has reverted to the source site's address the feature is undoing itself silently,
    and nothing on screen looks wrong (the photo still displays, because the source still serves it).
39. **Replacing a photo.** Paste a different external address over it and save: the new photo shows at once; after five seconds the URL is
    `supabase.co` again, now ending `?v=<digits>`.
40. **The text agrees with the database** (expect 0):
    ```sql
    select count(*) from recipes
    where image_url is not null and image_url <> '' and syntax like '%IMAGE:%'
      and position('IMAGE: ' || image_url in syntax) = 0;
    ```
    and `objects`, `self_hosted` and `with_image` from `docs/IMAGES.md` §7 agree.
41. **Settings → LIBRARY → RECIPE PHOTOS → CHECK STORED IMAGES** reports all intact; **RE-HOST EXTERNAL IMAGES** reports
    "0 copied in" (the save path already did the work: 0 is the pass).
42. **Offline.** With the network off, edit a recipe's image address and save: the editor closes and a "Couldn't save" toast appears;
    the change is in this tab only. Go back online **without reloading**, favourite any recipe (any ordinary save re-sends the failed
    write), then run RE-HOST EXTERNAL IMAGES: "1 copied in".
43. **Leaving the tab while offline** (this used to sign you out): go offline, click another tab and back. Still signed in. Online, the
    same.
44. **Coming back to the recipes by the sidebar** after an edit shows the new photo.

Tidy up the test recipe afterwards.

## If something fails

Note the step number, what you saw, and anything red in the console. Your data is in Supabase, not the browser, so clearing site
data or closing the tab loses nothing. **`main` is production:** to roll back, revert the merge commit; Pages redeploys the previous
build.

**Not covered here:** Keep Awake / COOKING MODE can only be judged on a real tablet (the failure mode is a screen that dims
twenty minutes later), and so can reachability with wet hands at arm's length.
