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
story that used to open this paragraph is history. 329 automated checks pass, plus 133 in Node (102 when this was
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
   Settings, swaps in Settings → Ingredients → Swaps (its own screen until 30 Sep), groups shown on the Planner.
5. **Make one small change and hard-reload** — favourite a recipe, say. If it survives the reload it
   reached the database, because the page rebuilds entirely from Supabase on load. This is the only
   way to see the write queue working.
6. **Open a second tab** and confirm the change is there too. There is no live sync by design, so a
   reload is required — that is expected, not a fault. *(Since 22 Sep, coming back to a tab
   re-reads the library, so a tab switch is usually enough.)*

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
    unit — 500 g and 1 kg should read as a single 1.5 kg. Since PR 6b one ingredient is always
    one line, even in two units: *Chicken breast — 2 + 400 g* (section E has the rest).
13. **Hide ticked / clear ticks.** Tick a few, hide them, show them again, clear them.
14. **Both Weeks.** Switch to it, tick something, switch back to a single week. That tick must **not**
    appear there; the two lists keep their ticks separately on purpose.
15. **Word matches.** Since PR 6b the list never asks in a dialog. A likely pair shows *Same as
    X? MERGE · KEEP APART* under the rarer row; answer one each way if you get two. Both should
    appear in Settings → Word Matches, and neither should be offered again. You will probably get
    none — the rules and the dictionary total most variants without asking — so **MERGE WITH…**
    on any row exercises the same path: type a few letters to filter (any name in the library, not
    just this week's rows), pick one, expect *Merge X with Y? MERGE · CANCEL* — CANCEL and it is
    unchanged; MERGE and the two rows join.
15a. **Possible swaps** (6d-2). Store a swap in Settings → Swaps for something you've planned this
     week (say, butter → margarine). Open the Shopping List: a *POSSIBLE SWAPS* panel appears at the
     bottom naming it, with its ratio and note. Tick that row off and hide ticked items — the panel
     entry must stay; it lists what's on the list, not what's currently showing. A swap for a
     general word ("butter") must not also flag a longer name that happens to contain it ("peanut
     butter") — matched by the list's own name since 6d-2, not a substring on the raw ingredient
     text, which is also why the recipe Viewer's ⇄ icon and Substitution Recommendations box (same
     function) should now agree with the list rather than over-firing.
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

## D — Two devices at once (new 24 Sep, PR 5; never yet run)

Until PR 5 every save pushed the whole cached table and deleted what it didn't hold, so a device
whose cache was behind could delete another device's new recipe on its next favourite toggle.
Since PR 5 every ordinary save is one row. These steps are the proof, and they are the first time
the app has been tested from two devices at all. **Reload the app on both devices before
starting**: a tab opened before the merge still runs the old code, and its saves are the ones
this pass exists to rule out. Call them **A** (the desktop) and **B** (the phone or tablet).

21. **A stale device must not delete a new recipe.** On A, add a recipe (any short one; the
    converter's test set has several). On B, *without switching tabs or reloading*, favourite any
    recipe. Now reload A: the new recipe must still be there. Then switch to B's tab and back, or
    reload B: the new recipe appears there too. *Before PR 5 this step deleted the recipe and its
    cooking history.*
22. **A stale device must not undo an edit.** On A, edit a recipe's text — add a word to a step —
    and save. On B, still stale, favourite *that same recipe*. Reload A: the edit must survive and
    the favourite must show. Check the database if in doubt: the recipe's `updated_at` moves
    twice, and `syntax` keeps the word.
23. **A delete tidies up.** On A, plan a recipe on some day, group it with another, and shortlist
    it. Then delete it. The Planner must show the day without it and without a group; the
    shortlist must not show "Recipe removed". Reload B: the same.
24. **Ticks from two devices add up.** Both on the Shopping List for the same week: tick one item
    on A, a different item on B, then switch tabs on each. Both ticks should show on both. Press
    UNTICK ALL on A: both go, on both.
25. **A save made offline is kept and sent.** On B, turn the network off (aeroplane mode, or
    devtools → Network → Offline), favourite a recipe: expect a gold **OFFLINE** bar across the
    top of the page (since PR #17; a toast until then), staying there until you are back.
    Turn the network on: expect "Back online — sending your changes" if the write had failed by
    then (it may not have — see below). Reload B: the favourite must show.
    *Do not expect a "Couldn't save" toast.* That one appears only when a write actually fails,
    and an offline write can wait up to about 30 seconds first: supabase-js retries its session
    refresh behind a lock that every request waits on. In the 24 Sep run the network was back
    inside that window, both favourites landed, and no failure was ever reported — which is why
    the app now announces being offline at the moment of saving instead (PR #16).
26. **Import still replaces everything.** Optional, and destructive by design — do it only with a
    fresh export in hand: import that export on A, then reload B. Counts unchanged everywhere.

Then run the header-drift query and the count query below; nothing should have changed but
what you changed. Record the date and the result in `docs/HANDOVER.md` §7.

## E — The shopping list release (new 25 Sep, PR 6b; run on the Friday it merges)

PR 6b changes how every line on the shopping list is named and totalled, and re-keys every tick.
**Reload the app on every device first**: a tab opened before the merge runs the old code, and
Pages can serve the old `core.js` for a few minutes (the gold UPDATE bar says so; reload again).
Use the week you are about to shop for.

27. **Fewer, fuller rows.** Open the Shopping List. Against the list you had before, expect
    visibly fewer rows, and an ingredient two recipes share on one row, listing both recipes. A
    count and a weight share a row: `2 + 400 g`. Spoons of one thing add up: 1 tsp and 1 tbsp read
    `1 tbsp + 1 tsp` (`4 tsp` until PR #20). A line with no amount says what it is for:
    `125 g + extra to serve (2 recipes)`.
28. **Nothing wrongly joined.** Read every row once. Garlic cloves and cloves (the spice),
    cinnamon sticks and ground cinnamon, coriander and ground coriander, spring onions and
    onions, butter and unsalted butter must each still be separate. A wrong join is the one fault
    that costs a missed ingredient at the shop, so note any, with both recipe names.
29. **Aisles.** Red pepper, onions and garlic under Produce; chicken stock under Pantry; black
    pepper under Spices. A few things still land in Other — that is known (36 of 185 across the
    whole library); note any you'd expect elsewhere.
30. **Ticks start fresh, and stick.** Last week's ticks are gone (they were keyed the old way and
    are deleted at start-up). Tick three rows, reload: still ticked. Tick one on the tablet and
    switch tabs on the other device: it shows there too.
31. **No questions.** Opening the list, changing the week, and planning a recipe must never show
    a dialog. If a *Same as…?* line appears, KEEP APART on it, reload: not offered again.
32. **Settings still lists every word match**, including the six "same" answers the rules now make
    anyway. They are harmless; delete them there when convenient (M4 of the ingredient review).

## F — Checks where recipes come in (new 27 Sep, PR 6c-1)

Deploy `source-ingredients` first (`docs/INFRASTRUCTURE.md`, Edge Functions: dashboard → Edge
Functions → deploy a new function named exactly `source-ingredients`, paste
`supabase/functions/source-ingredients/index.ts`, JWT verification **on**). Reload every device.

33. **The source's own list.** Open one recipe from each site the library uses (twelve, per the
    architecture review; the 14 recipes 6c-2 rewrites are on seven of them), EDIT, then COMPARE
    WITH SOURCE. Note for each
    site whether a list comes back at all. *This is the measurement the architecture review could
    not make: whether these sites carry the Schema.org block.* A site that doesn't gets "no
    ingredient list the check can read", and that recipe is compared by eye. *Run 27 Sep: two
    sites refused with a 403 (`docs/HANDOVER.md`, 6c-1).*
34. **What the comparison shows.** On a recipe that came back: a highlighted row is on one side
    only, or paired but different, and a paired one says why underneath (*amounts differ*, *the
    recipe adds X*). A US name made British can show there and is fine; a different ingredient or a
    different amount is not. Note anything the check pairs wrongly, and any row that is only noise.
35. **Warnings, never a gate.** Since 6c-2 (27 Sep) no recipe in the library has a line the
    preview warns about, so this step uses a made-up recipe. Add one with two lines,
    `400 ml tin plum tomatoes` and `1 lemon or lime`. The preview names both and says what to
    do; USE THIS rewrites the first to `400 g plum tomatoes (1 tin)`. Save it with the second
    warning still showing: it saves. Delete it.
36. **The other choice on the list.** Plan two or three recipes and read the list. A recipe's
    choice in brackets — anything with "or" in it — shows in grey **beside that recipe's name**
    on the row, so it reads as that recipe's advice and no other's: a frying recipe's "(or oil)"
    beside butter must not appear against a cake. Only when every recipe on the row offers the same choice
    (a row with one recipe, usually) does it show beside the ingredient's name instead. A bracket
    with no "or" ("(1 tin)", "(rigatoni)") must not show anywhere. Measured on 27 Sep: 4 rows
    show a choice by the name and 3 beside a recipe today; after 6c-2, 9 and 11.
36a. **A pasted list, for the sites that refuse (new 28 Sep, PR 7d).** Open a Kitchen Sanctuary
    recipe (17 of the 34; the function gets a 403 there), EDIT, then COMPARE WITH SOURCE: it names
    the 403 and points at the box below. On the recipe's own page, select the ingredient list
    only, copy it, paste it into the box under AGAINST THE SOURCE, and press COMPARE PASTED LIST.
    Expect the recipe's lines to pair with the page's, and highlighted rows only where there is a
    real difference — or something the copy brought along that the tidy-up did not know. **Note
    what a real copy looks like.** `pastedIngredientLines` was written for tick-box glyphs,
    bullets, blank lines and section headings, from a general idea of what copying a recipe page
    gives — not from a real page, which no session can reach. A unit toggle, an amount on a line
    of its own or a note under the list would show as a row here, and is worth telling me about.
    Then press PARSE: the pasted list is still in the box and the table is cleared. Close the form
    and open Add: the box is empty. Nothing is saved and no request is made (the offline suite
    checks that nothing is sent), so with the connection off it should still work — not yet
    tried on a real device.
36b. **The comparison that found the fault (new 28 Sep, PR 7e).** Re-run the Tuscan Chicken Pasta
    comparison with the same pasted list. Expect **one** flagged group: an amount mismatch on the
    ingredient the source lists in more places than the recipe does, naming the source's amounts and
    the recipe's. The line whose product had moved into brackets, which used to show as unmatched on
    both sides, should now be paired, and nothing else should be flagged, hard or shaded. Then read the source's method: is that ingredient used twice? If so the
    recipe has lost a quantity and the check was right; if the page repeats it by mistake, the recipe
    is right and the row is the check reading the page faithfully. Repeat on two or three more recipes
    and **write down every row that is only noise**. Expect little on a UK source and more on a US
    one, in proportion to the names the dictionary lacks (`docs/HANDOVER.md` §7 measures it: 58% of
    67 US→UK pairs before PR 7f's rows, 22% after, the rest mostly substitutes). A shaded row is not a fault: the recipe names a product more specifically than
    the source did, and the dictionary calls them one product; check the source meant it.
    A recipe scaled to another number of people will flag every amount: compare before scaling.
36c. **US names, and the list they must not move (new 29 Sep, PR 7f).** Two halves. *The source check:*
    paste the ingredient list of a recipe from a US site (the library has one from Allrecipes) and compare.
    A US name for a British product (eggplant for aubergine, zucchini for courgette, ground beef for beef
    mince, heavy cream for double cream…) should now be quiet. **Write down every row that still flags and
    say which it is:** a real swap or omission; a substitute the dictionary leaves apart on purpose
    (granulated for caster sugar, half-and-half for single cream — `docs/HANDOVER.md` §7 lists them, and
    says if you would rather one of them counted as the same product); or a name the dictionary has
    simply not heard of, which is the noise to send back. *The shopping list:* plan every recipe at once.
    Expect **169 rows**, as before, and every tick you had still ticked (no key changed on the live
    library when this was measured). The one change you should see is **Mangetout and Pak choi under
    Produce instead of Other**. Anything else that moved is a fault; tell me the row.

36d. **The review band, on the tablet (new 29 Sep, PR 3 of the add-recipe plan).** Nothing in it writes, so
    it is safe on real recipes. (1) *Add a recipe* and paste a conversion from your chat. It should read at
    once, with no PARSE tap, and the form should show the diagram first, then the checks, then the fields.
    Say whether that order is easier or harder to use on the tablet, and whether the page scrolls where you
    expect. (2) *A link from Kitchen Sanctuary or Allrecipes:* the SOURCE box should say the page refused and
    point at the paste box; from any other site it should draw the comparison by itself, and never fetch
    twice for the same link. (3) *Type in the box after a parse:* the "text changed" bar should appear, and
    RE-CHECK should clear it. (4) *SHOPPING LIST:* the names new to your library are listed with where each
    lands. Write down any that land under Other and should not: that is what PR 6 is for. (5) *Edit an
    existing recipe:* it should open with the same bands, list its own one-recipe names as new (it is left
    out of the library), and fetch nothing. (6) *WRITE ONE BY HAND* on an empty box gives a starter recipe.
    **The one thing no test can judge is a real paste on the tablet: tell me if pasting does not read at
    once.**

36e. **Answers in place, on the tablet (new 29 Sep, PR 4 of the add-recipe plan).** Unlike 36d this one
    **writes**, so use a made-up recipe, and undo what it wrote at the end. (1) *SOURCE:* add a recipe whose
    SOURCE is a shortened spelling of one you already use. A row should appear under the field saying it looks
    like the existing one, with USE THAT and KEEP MINE, and **no dialog should appear at any point**, not on
    parse and not on SAVE. Tap USE THAT and check the field changed; then, with a second made-up recipe, tap
    KEEP MINE and check the field did not. Leave a third unanswered and save: it should save as typed and ask
    again next time. (2) *SHOPPING LIST:* a "Same as X?" row appears only where a new name looks like one you
    already have (today's library has none, so you may need a made-up ingredient named as a longer or shorter
    version of one you use). SAME should ask once more ("… for every recipe? MERGE · CANCEL") and write nothing
    until MERGE; KEEP APART should make the row go. (3) *USE THIS,* on a line the list cannot total, should now
    show an UNDO that puts the line back exactly. (4) *SCALE TO SERVE* should show UNDO SCALE beside APPLY,
    which puts the text back as it was; typing in the box afterwards should make it go. (5) *BEFORE YOU SAVE*
    should list only what applies (the header lines that will be rewritten, a photo that will be copied, keywords
    that are new, and on Edit the ticks that will be reset), and nothing when nothing does. Say whether it is
    clear, or whether it is noise. **Afterwards:** delete the made-up recipes and, in Settings, Word Matches,
    FORGET what steps 1 and 2 wrote (they show there as a source match, a kept-apart pair and an ingredient match).
    **The one thing no test can judge is whether the buttons are easy to hit on the tablet.**

36f. **The comparison recorded on the recipe (new 29 Sep, PR 5 of the add-recipe plan).** **Do this only after the
    SQL in `docs/migrations/add-recipes-source-check.md` has been applied and the PR merged.** It writes one recipe row
    per save, so use one recipe you do not mind, and it is replaced by the next comparison. (1) *Open any recipe:* a small
    chip beside its source link should say NOT COMPARED WITH ITS SOURCE (every one will, to begin with), and the two
    reconstructed ones (the oat bars, the loaded fries) should also say CARRIES A SOURCE NOTE, in red. **The cards should
    show nothing of this.** (2) *Edit a recipe that has a source link,* press COMPARE WITH SOURCE (or paste the page's list
    and press COMPARE PASTED LIST), then look at BEFORE YOU SAVE: it should say "Records: compared with the source today"
    with the number of differences. Save; the chip should now say COMPARED with today's date and that number. (3) *Edit
    it again:* the SOURCE section should show that result with RE-CHECK, and **opening Edit should not fetch the page.**
    (4) *Change an ingredient line and save without comparing:* the chip should say COMPARED BEFORE THE INGREDIENTS
    CHANGED. Change only a keyword or a method step and save: the chip should not change. (5) *A recipe from a site that
    refuses the check:* BEFORE YOU SAVE should say "not compared with its source", and the chip after saving should say
    the same. (6) *Export,* and glance at the file: each compared recipe carries a small `sourceCheck` with counts and a
    hash, and **no ingredient text from the page**. **The one thing no test can judge is whether the chip reads clearly
    beside the link on the tablet.**

36g. **Shopping aisles (new 29 Sep, PR 6 of the add-recipe plan).** **Do this only after the SQL in
    `docs/migrations/add-aisle-overrides.md` has been applied and the PR merged.** It writes one row per aisle set, and
    each is removed again below. (1) *Settings:* a SHOPPING AISLES block sits under WORD MATCHES with a name box, an
    aisle list and ADD, and says no aisles are set. (2) *Pick a row the shopping list puts in Other,* type its name as the
    list shows it, pick an aisle, ADD: the row is listed, and on the shopping list the item has moved to that aisle,
    **still ticked if it was ticked**. REMOVE it: it goes back to Other. (3) *Add a made-up recipe with a line whose name
    is new and lands in Other:* the SHOPPING LIST review shows an aisle list beside SAME AS…; pick an aisle and the row
    says "Moved to …" with UNDO; UNDO puts it back. Close without saving, and check Settings lists nothing left over. **The
    one thing no test can judge is whether the aisle list is easy to use on the tablet.**

36h. **Settings: ingredient lookup and dictionary (new 29 Sep, PR 7 of the add-recipe plan).** Read-only; nothing to undo.
    (1) *Settings:* INGREDIENT LOOKUP and DICTIONARY sit above WORD MATCHES, and the dictionary lists every row by aisle.
    (2) *Type "almond flour":* the lookup says the list calls it ground almonds, in Pantry from the dictionary, and the
    dictionary narrows to that row. (3) *Type a wording from one of your own word matches:* the match is listed with FORGET
    (do not press it unless you mean to). (4) *Type the original of one of your swaps:* the swap is listed; EDIT goes to
    Swaps, whose subtitle now says a swap for "butter" never catches "peanut butter". (5) *Type something the list puts in
    Other:* it says so and points at Shopping Aisles. **The one thing no test can judge is whether the lookup answers the
    question you had when you opened it.**

36i. **Settings: library check (new 29 Sep, PR 8 of the add-recipe plan).** Read-only; nothing to undo. (1) *Settings → LIBRARY
    CHECK → RUN:* every recipe is listed once, with those needing attention first: the two reconstructed ones (the oat bars,
    the loaded fries) at the top in red, then those not compared. (2) *Tick "only those needing attention":* the rest go.
    (3) *OPEN one:* its edit form opens; compare it with its source and save, then RUN again: it has moved down and says
    what the comparison found. **This is the audit: work down the list until it is short.**

36j. *Superseded by 36k the same day:* on the tablet the native list covered the whole screen (reported 30 Sep, 08:03), so
    the boxes now use the app's own dropdown. Kept for the record. **Autocomplete on the ingredient boxes (new 30 Sep).** Nothing is written by a suggestion; only ADD writes, as before.
    (1) *Settings → INGREDIENT LOOKUP, type "alm":* the tablet offers names under the box, among them ground almonds and almond
    meal; pick one and the lookup answers for it. (2) *WORD MATCHES, type in either box:* ingredient names are offered; switch the
    select to SOURCE and the same boxes offer your sources instead; switch back. (3) *SHOPPING AISLES, type "alm":* only the names
    your shopping list uses are offered: ground almonds if a recipe uses them, but never almond meal, which the list calls
    ground almonds. (4) *Swaps, type in ORIGINAL INGREDIENT and
    REPLACEMENT:* the same ingredient names as the lookup. **The one thing no test can judge is how the tablet shows the list:
    whether it appears as you type, and whether a picked name fills the box without an extra tap.**

36k. **The ingredient boxes' own dropdown, on the tablet (new 30 Sep).** Replaces 36j. Nothing is written by a suggestion.
    (1) *Settings → INGREDIENT LOOKUP, tap the box:* nothing opens until you type. (2) *Type "a":* a list opens just under the
    box, about five names high, and **the rest of the screen stays visible**; drag the list to scroll it without anything
    being picked. (3) *Type "alm", tap almond meal:* the box says almond meal, the list closes, the keyboard stays up, and the
    lookup says the list calls it ground almonds. (4) *WORD MATCHES:* either box offers ingredients; pick SOURCE and type
    the start of one of your sources: the sources are offered; switch back. (5) *SHOPPING AISLES, type "alm":* only names your
    shopping list uses, never almond meal. (6) *Swaps:* both boxes offer the lookup's names. (7) *On the phone, with the box
    just above the keyboard:* the list opens above the box, not behind the keyboard. The ▼ at the right of the box, and
    Chrome's own grey list, mean the old version is still loaded: reload. **What no test can judge: whether
    a tap on a name is easy to hit, and whether scrolling the list ever picks one by accident.** *Reported "broadly ok"
    by the household, 30 Sep.*

The 37 series is `docs/PLAN-LAYOUT.md`, the layout changes agreed on 30 Sep. Each is read-only.

37a. **Step words at the foot of their box; the edit dialog near full width (new 30 Sep, C and A).** (1) *Open a recipe with
    a long group:* each step's words sit at the bottom of its box, level with the last ingredient that goes into it. Tick
    down a group and read straight across. (2) *PRINT / A4 PDF, then EXPORT PNG:* the same. (3) *EDIT:* the dialog fills the
    screen less a margin, the recipe box is about half the screen tall, and the preview no longer scrolls sideways (unless
    the recipe has very many steps). *Close it without saving.* (4) *On the phone:* the dialog still fills the width.
    **What no test can judge: whether the bottom-aligned words read better in the kitchen than the centred ones did.**

37b. **Shopping Aisles says where a name goes now (new 30 Sep, D).** Writes only if you press ADD or REMOVE. (1) *Settings →
    SHOPPING AISLES, type a name your recipes use:* a line under the box says what the list calls it and where it goes now,
    and the aisle picker is already on that aisle, with ADD greyed out. (2) *Pick another aisle:* ADD lights up. *Don't press
    it* unless you mean to. (3) *Type a name of your own aisles* (one in the list below the box, if any): the line says
    "your own aisle", with REMOVE and where it would go back to. (4) *Type something no recipe uses:* the line says so.
    **What no test can judge: whether the line answers the question before you have to ask it.**

37c. **Cooking mode (new 30 Sep, B).** (1) *Open a recipe, scale it to 6, turn KEEP AWAKE on:* the header is one line: ← ALL
    RECIPES, the recipe's details (saying SERVES 6, SCALED FROM its own), KEEP AWAKE, RESET TICKS and SHOW TIMELINE. Favourite,
    shortlist, edit, export, print, delete, the source chip and COOK FOR are gone, and so is the timeline. (2) *SHOW TIMELINE:*
    it appears; leave the recipe, open another and turn KEEP AWAKE on: it is still shown. HIDE TIMELINE hides it again, and the
    tablet and the laptop each keep their own choice. (3) *On the phone, scroll down the recipe:* the header stays at the top.
    (4) *Turn KEEP AWAKE off:* everything is back. (5) *A group from the Planner, KEEP AWAKE on:* export, print and ungroup go.
    **What no test can judge: whether anything you want mid-cook has gone missing.**

*37a, 37b and 37c reported passed by the household, 30 Sep ("happy with tests 37a/b/c").*

37d. **Settings in three tabs (new 30 Sep, E).** Read-only unless you add a swap. (1) *Sidebar:* no SWAPS. (2) *Settings:* three
    tabs, INGREDIENTS picked, showing Ingredient Lookup, Word Matches, Shopping Aisles, Swaps (your swaps listed, with EDIT and
    DELETE) and the Dictionary folded to "SHOW ALL 140 ROWS". (3) *LIBRARY:* Library Check, Sources, Keywords, Recipe Photos.
    *APP:* Week Starts On, Appearance. Leave Settings and come back: the tab you left on is still picked. (4) *Type "almond"
    in the lookup:* the dictionary opens to the matching rows; clear it and it folds again. (5) *Look up an ingredient you
    have a swap for, press EDIT:* you land on Swaps in the Ingredients tab. **What no test can judge: whether you can find
    each thing where you expect it.**

*37d reported "ok" by the household, 30 Sep. Every step of the 37 series has passed.*

38a. **VALIDATE INGREDIENT LIST, and OPEN SOURCE (new 30 Sep).** Writes one recipe row, on SAVE. (1) *Open a recipe you have
    compared (Easy Pilau Rice, say), EDIT:* beside "Compared 30 Sep · 1 difference" is VALIDATE INGREDIENT LIST. Tap it: it
    says "Validated when you save" with UNDO, and BEFORE YOU SAVE says so. (2) *SAVE:* the viewer's chip reads VALIDATED and
    the date; EDIT again says when, with no second offer. (3) *Settings → Library → LIBRARY CHECK → RUN:* that recipe reads
    "validated" and is not among those needing attention. (4) *EDIT, OPEN SOURCE ↗:* the source page opens in a new tab.
    **What no test can judge: whether VALIDATED says what you meant by it.** A change to the recipe's ingredient lines takes
    the validation away until it is compared again.

*38a reported "OK" by the household, 30 Sep.*

38b. **Source photos (new 30 Sep; after `docs/migrations/add-source-photos.md` is applied).** Writes one recipe row and stores
    files, on SAVE. Use a recipe converted from a photo or screenshot, or any recipe you don't mind giving a photo. (1) *EDIT,
    SOURCE PHOTOS, ADD PHOTO:* the tablet offers the camera or the gallery. Take a photo of a cookbook page, or pick a screenshot;
    it appears as PAGE 1 · NEW, and BEFORE YOU SAVE says "Stores the new source photo with the recipe". Add a second. Under
    AGAINST THE SOURCE, the ingredient lines sit beside the photos. (2) *SAVE:* the viewer shows SOURCE PHOTOS · 2. Tap it: both
    pages full screen; tap a page to see it at its own size, then OPEN FULL SIZE ↗ and pinch to zoom. Can you read the small
    print? (3) *On the laptop, the same recipe:* the photos show there too (this is the signed link, not the tablet's copy).
    (4) *EDIT, REMOVE page 1, SAVE:* the chip says SOURCE PHOTO. (5) *Close the form without saving after ADD PHOTO:* nothing
    changes. **What no test can judge: whether the camera route is easy, and whether 2000 px is sharp enough for a cookbook's
    small print.** In the dashboard, Storage → `recipe-sources` → your household's folder should hold one file per page kept.

*38b reported "successful" by the household, 30 Sep. Checked read-only at 17:06 UTC: one file in `recipe-sources` (a JPEG,
106 KB), under the household's folder and its recipe's; one recipe listing one page; no file that no recipe lists (so the
removed page was deleted), and no listed page missing.*

38d. **PDF sources (new 30 Sep).** Writes one recipe row and stores a file, on SAVE. (1) *On the laptop, open a recipe
    page, PRINT, "Save as PDF".* (2) *EDIT a recipe, ADD PHOTO OR PDF, pick the PDF:* it shows as PAGE 1 · PDF · NEW with its
    file name and OPEN ↗; BEFORE YOU SAVE says "Stores the new source PDF with the recipe". Try a PDF over 10 MB: it is refused
    and says why. (3) *SAVE:* the viewer's chip reads SOURCE PDF; tap it, then OPEN ↗: the PDF opens in a new tab. (4) *On the
    tablet, the same recipe:* OPEN ↗ opens it in the tablet's PDF viewer. **What no test can judge: whether opening it outside
    the app is good enough on the tablet**, or whether pages drawn inside the app are worth adding.

39a. **Cooking notes (new 30 Sep, R4).** Writes one note row per tap. (1) *Open a recipe:* under the diagram, COOKING NOTES.
    Type "Needed 10 min longer" and ADD A NOTE: it appears at the top with today's date, and the header shows NOTES · 1. (2)
    *EDIT it, change the words, SAVE:* the date stays. *DELETE it:* UNDO brings it back. (3) *KEEP AWAKE on:* the box is still
    there and the latest note shows; nothing to edit. (4) *Tick the last column:* the "Which meal?" prompt has ADD A NOTE; type
    one and pick Dinner: it is in the recipe's log, dated today. (5) *FOLD INTO NOTES on a note:* EDIT opens with it dated at the
    end of NOTES:, and BEFORE YOU SAVE says so; SAVE, and the note is in the recipe's own notes and gone from the log. (6)
    *PRINT:* no cooking notes on the page. **What no test can judge: whether the box is quick enough to use with wet hands,
    and whether notes are where you look for them.**

38c. **CHECKED AGAINST THE PHOTO (new 30 Sep).** Writes one recipe row, on SAVE. (1) *EDIT the recipe from 38b:* under AGAINST
    THE SOURCE, beside the photo, is CHECKED AGAINST THE PHOTO. Read the lines against the photo, then tap it: it says
    "Recorded as checked against the photo when you save" with UNDO, and BEFORE YOU SAVE says so. (2) *SAVE:* the viewer's chip
    reads VALIDATED and the date. EDIT again: "Checked against the source photo" and the date, and no second offer. (3) *Settings
    → Library → LIBRARY CHECK → RUN:* it reads "checked against the photo" and is not among those needing attention; a recipe
    with a photo and no link that has not been checked reads "source photo not checked", and is. **What no test can judge:
    whether the photo and the lines sit close enough on the tablet to check one against the other.** A change to the
    ingredient lines takes the check away, as for a web recipe.

## Deferred to the tablet, after merging

- **Keep Awake** on both the Recipe and Group Viewers. It cannot be tested on a desktop browser in
  any meaningful way — the failure mode is a screen that dims twenty minutes later. *Reported working on the Android tablet
  by the household, 30 Sep 2026* (which viewer, and which method the status line named, not stated).
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
