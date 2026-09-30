# What to do next, and in what order

Two things live here: **the order work should happen in**, with the reasoning, and a
**ready-to-paste prompt** for starting the next session.

**Picking the work up after 29 Sep 2026? Read `docs/HANDOVER-2026-09-29-SESSION.md` first:** the note at its top says where
things stand (the add-recipe plan's PRs are all merged, both migrations applied, tablet passes 36a to 36i done). **§7,
autocomplete on the ingredient boxes in Settings and Swaps, was built on 30 Sep**; its tablet pass is `docs/TEST-PLAN.md` step
36j; on the tablet its native list covered the screen, so it was **rebuilt the same day as the app's own capped dropdown**
(tablet step 36k, reported "broadly ok"). **`docs/PLAN-LAYOUT.md` is finished**: five layout changes agreed on
30 Sep, all merged (PRs #57 to #60), every tablet pass (37a to 37d) done. Keep Awake is reported working on the Android tablet.
Converter test 9 passed in the conversion project on 30 Sep (recorded in `converter/test-set.md`). VALIDATE INGREDIENT LIST and
OPEN SOURCE merged 30 Sep (PR #62; tablet step 38a passed). **Being built: `docs/PLAN-SOURCE-PHOTOS.md`**, keeping the photo a
recipe was converted from, agreed "all as suggested" on 30 Sep: step 1 is `docs/migrations/add-source-photos.md`, **which the
household applies before merging**; step 2 (attach, store, view, tidy) follows once it is applied, then step 3 (CHECKED AGAINST
THE PHOTO). **Also the household's:** compare the six BBC Good Food recipes (the conversion reload and test 10 passed on 30 Sep; VALIDATE INGREDIENT
LIST, 30 Sep, records the ones found right) against their real pages, since five were rebuilt from
another edition before the 29 Sep rule (`docs/HANDOVER.md`, 30 Sep); and D6, repairing the reconstructed recipes, a data job
done together, by the recipe-text rules in `CLAUDE.md`.

**Rewritten 23 Sep 2026.** Until then this document narrated steps 0–4 of the original build
(reprocess, ingest, test pass, merge, images), all done by 22 Sep and recorded in
`docs/HANDOVER.md` §2–§3. What replaced them is a seven-PR plan agreed after two reviews:
`docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md` (the shopping list) and
`docs/REVIEW-ARCHITECTURE-FINDINGS.md` (the structure). Read the second one's §0 first; it is
two paragraphs and it decides the order below.

For repo URLs, the Supabase project and where secrets live, see `docs/INFRASTRUCTURE.md`.

**`main` is production.** GitHub Pages serves it, and every merge deploys to the tablet within a
minute. Work on a branch, open a pull request, let `.github/workflows/tests.yml` run, and the
household decides when to merge.

---

## Start here: where things stand (29 Sep 2026)

Each fact below was checked against the database, the deployed functions or `git log` when it
was written. Check again before relying on one.

**Done.** PRs 1–7f are merged and live. 7d, the paste box, was PR #35, merged 28 Sep at 21:53 UTC
(the household used the box on a real page the same evening). 7e, PR #37, rewrote the source check the
paste box feeds, after that first real use showed the check calling a difference a match; merged 29 Sep
at 05:06 UTC (`main`'s tests, run 68, and the Pages deploy, run 53, both succeeded). 7f, PR #38 (below),
added US names to the dictionary, which was 7e's price; merged 29 Sep at 05:52 UTC (tests run 72 and Pages
run 54 both succeeded). `core.js` is `2026-09-29.8` on `main`: `.7` came with shopping aisles (PR #49) and `.8` when ground almonds were set apart from almonds (PR #51, merged 29 Sep); PR 7 leaves it there. 6c-2 was a data job, not a PR; PR #23 is its documentation.

**Open finding, 29 Sep: a recipe whose ingredients are not its source's.** Comparing *No-Bake
Chocolate Oat Bars* with the Allrecipes page (paste box, the first US-source recipe compared), the
household found three of the source's six ingredients missing from the recipe, two ingredients the
source lacks present, and one product changed. The check is right: the recipe's own text says the
converter could not read the page and "reconstructed" it from a secondary reproduction, a note
`HANDOVER.md` §3 recorded on 20 Sep as "worth a glance". *Lasagne Loaded Fries* has the same shape
(a branded partner's version instead of the original page). The converter's instructions cover an
unreadable photo and say nothing of an unreadable URL, and ingestion never compared ingredients with
sources. **`docs/HANDOVER-CONVERSION-INTEGRITY.md` is the handover for a review of this** (written for
Opus): what is known, what is not, what to do in order, and, in its section 7, the three decisions
still open from PR #38, each written out in full. 31 of 34 recipes have never been compared.

**The live app:**

- **Library:** 34 recipes.
- **Shopping list:** planned all at once, the recipes come to **169 rows**. Every ingredient
  line fits the standard shape, and the parser skips none.
- **Word matches:** 3 "same" (added 27 Sep), 10 "not the same" and 1 source.
- **Household swaps:** 2 stored.
- **Edge Functions:** `rehost-images` v10, `find-recipe-image` v4 and `source-ingredients` v1.
  `source-ingredients` gets a 403 from Kitchen Sanctuary (17 recipes) and Allrecipes (1), so
  COMPARE WITH SOURCE says "compare by eye" for half the library — the paste box (7d, merged)
  is the answer.
- **Sharing:** the family is one account, one household (verified 28 Sep) —
  `docs/ONBOARDING.md` is the runbook for adding a second family member. A second `households` row
  now exists too, but it is 7c's isolated test household in `PrivateBackup`
  (`scripts/weekly-live-check.js`), never the family's — querying `households`/`household_members`
  directly will show two rows and is not a sign anything's wrong. `anon` now holds no table access
  and every policy is `authenticated`-only (28 Sep); leaked-password protection is still off.

**Before anything else, read the first three sections of `CLAUDE.md`:**

- "Every session, before you push";
- "Where a session stops and hands back";
- "Changing recipe text in the live database".

They were added on 27 Sep so that any model can hold the line. `main` is protected, and
`offline-harness` is a required check. GitHub enforces that for everyone but admins.

**Done since the last rewrite.** 6d-1 (PR #25), 6d-2 (PR #26) and 7a+7b (PR #27, the onboarding
runbook plus the RLS migration) are all merged — `docs/HANDOVER.md` §7 has what was verified and
how for each. Leaked-password protection is still off, and stays off: it is a paid-plan feature in Supabase and the
household is on the free plan (confirmed by the household, 30 Sep 2026). Not an open item.

**7c, the weekly live-backend test — two real bugs found, one in the test, one in the app.**
`scripts/weekly-live-check.js` and `.github/workflows/weekly-live-check.yml` (`PrivateBackup`, not
this repo) went through PR #3 (merged), then a fix on PR #4 (merged): run #1 raced its own reload
ahead of the write queue — a missing 2 s wait, the test script's own bug, not the app's. Run #2,
right after that fix, proved it and found a second, real bug — **in this repo**: logging a cook,
then tapping a meal type, reloaded to `mealType: null`. Run #3 reproduced it identically, ruling
out a flake. Root cause: `updateDiaryEntry` checked whether its row's insert had confirmed
*before* queueing its own write, so a fast tap almost always found "not yet confirmed" and
silently dropped the update, while the UI's "Tagged as X" toast fired anyway. Verified three
independent ways (a `Workflow` run — code trace, Supabase `edge_logs` showing the update was never
even attempted, and confirming why the same run's ad-hoc-entry step didn't share the bug) before
touching anything. **Fixed and merged on PR #31**, with a new `test/smoke.js` check that
reproduces the race offline (`__WRITE_DELAY__`) and is mutation-tested to fail without the fix.
**Proved against the live app the same session**: run #4, right after the merge, failed once more
on GitHub Pages/CDN propagation lag (confirmed, not the fix) — run #5, twelve minutes later,
**13 checks, 0 failed**, meal type included. `docs/HANDOVER.md` §7 has the full account, including
a live number worth having: all 115 of the household's real cooking-log rows have `meal_type`
null — consistent with this bug, but just as consistent with never having tapped one; the
household is the only one who can tell those apart. **7c is done.** `weekly-live-check.yml` now
runs itself every Monday at 06:00 UTC; nothing further is owed unless a future run goes red.

**7d, the paste box (28 Sep, PR #35) — merged.** Asked and answered the same
session: yes, its own small PR. The two sites that refuse `source-ingredients` are half the library,
so COMPARE WITH SOURCE could only say "compare by eye" for them; the preview now also has a box to
paste the source's ingredient list into, copied from the page in the browser, compared by the same
`sourceFidelity` — no fetch, no function, nothing sent or saved. `HANDOVER.md` §7 says what was
verified and how; `docs/TEST-PLAN.md` step 36a is the household's pass on a real Kitchen Sanctuary
page, and the one thing no session could check: **what a real copy from that page looks like.**

**7e, the source check that no longer calls a difference a match (28 Sep, PR #37) — merged 29 Sep.** Found by the household's first real comparison (Tuscan Chicken Pasta): a source line
listed twice, beside a compound "salt and pepper" line, showed as matched, when the recipe carried
the doubled line once. Reproduced with the app's own functions, then probed with made-up lines:
**the check caught one of eleven fault types**, an ingredient sharing no word with anything. The
first rebuild fixed the examples it was written from, and the household asked that it not; measured
against the converter's own spec and test set and the dictionary's vocabulary it turned out to be
tailored (it false-alarmed on the converter's own `1 pinch X`, and on any ingredient restructured
across lines). It was rebuilt around **per-ingredient totals** and re-measured on data nobody wrote for
it. **The price:** it no longer accepts "shares a word", so a US translation the dictionary lacks now
flags — false alarms on 67 US→UK pairs went from 31% to 58%; UK sources are quiet. Growing the
dictionary is the fix (`HANDOVER.md` §7), and 7f did it. **It is still not a guarantee** — §7 lists
what it cannot see. The household's pass is `docs/TEST-PLAN.md` step 36b.

**7f, US names in the dictionary (29 Sep, PR #38) — merged 29 Sep 05:52 UTC.** The household's answer to that price:
"Add US translations to the dictionary". 49 rows added (90 → 139) and spellings on 15 more, by one rule:
**one product on the shelf under two names**, never a substitute (`tools/ingredient-names-preamble.md`).
Measured on the live library before anything shipped: 0 of 466 lines change key, so no tick is
re-keyed; the only visible change is mangetout and pak choi moving from "Other" to Produce. False alarms
on the 67 US→UK pairs 58% → 22%; on a second list written before the rows, 78% → 37%; on the converter
test set's US-source test, 6 hard differences → 2. **Three decisions for the household**, written out in full in `docs/HANDOVER-CONVERSION-INTEGRITY.md`
§7: (1) the 15 pairs left flagged are substitutes or ambiguous on purpose (`HANDOVER.md` §7, 7f): say if
any should be treated as one product; (2) `a big handful of arugula` is read as a name, not a count word,
a small change to `shoppingLine` that was measured on 29 Sep to re-key nothing in the library and needs
your go-ahead; (3) `canned` against `tinned` is an adjective swap that flags: a fidelity-only fold would
fix it, at no cost to ticks, if wanted. **A known limit, not a decision:** whole against ground
(`coriander seeds` for `ground coriander`) is not caught, on `main` too.
`docs/TEST-PLAN.md` steps 36b and 36c are the household's pass.

**Still open:** nothing from the seven-PR plan. Steps 36a, 36b and 36c are the household's. **7f's
three decisions were answered on 29 Sep** (keep all 15 pairs flagged; fix the `a big handful of`
reading; fold tinned into canned in the source check and the shopping list) and are PR 1 of the plan
below. The open finding above is answered by that plan's PRs 2, 3, 5 and 8, and the repair of the
two reconstructed recipes stays a data job under `CLAUDE.md`.

**Planned, 29 Sep: adding a recipe as one flow. PR 1 is merged (PR #41, 29 Sep 10:48 UTC); PR 2 (docs
only, PR #42) is merged (29 Sep 12:25 UTC); PR 3 (the review band, PR #43) is merged (29 Sep 14:15 UTC); PR 4 (answers in place, no dialog left, PR #44) is merged (29 Sep 16:02 UTC); PR 5 (the comparison recorded on the recipe, PR #45) is built and open for review, and **needs the household to apply one SQL statement before it is merged**; PRs 6–8 are not started.** `docs/PLAN-NEW-RECIPE-FLOW.md`, written
in a planning session with no code change: an audit of the add path, the measured evidence that the
dictionary fits today's recipes (80% of lines known; every source but the dominant one lands 14–38%
of its lines in Other), the household's decisions, and **eight PRs in a fixed order** — 1 the two
naming fixes; 2 the converter's rule for a page it cannot read; 3 the review band, read-only, with the
source check running by itself; 4 answers in place and the last dialog removed; 5 provenance recorded
on the recipe; 6 aisle overrides; 7 Settings lookup and a readable dictionary; 8 a library check. It
has a STOP AND ASK list for an implementation session. The two proposals below are now its PR 6 and
its PRs 3, 4 and 8.

**Proposed, not started:** a household-editable aisle override in Settings — so moving something
like "Sirloin Steak" out of Other is a form entry, not a code change and a PR. Raised 28 Sep after
that exact case; the design is written up in `docs/PROPOSAL-AISLE-OVERRIDES.md`, checked against
the running code. *Since 29 Sep: PR 6 of `docs/PLAN-NEW-RECIPE-FLOW.md`, built as designed.*

**Proposed, not started:** a review when a new recipe comes in — a quiet ON THE SHOPPING LIST
section in the Add/Edit preview showing the recipe's names that are new to the library, where each
will land (Other flagged), likely matches with the whole library and a duplicate check on the
source link, so these are settled when a recipe is added rather than weeks later. Raised 28 Sep
by the household; `docs/PROPOSAL-NEW-RECIPE-REVIEW.md` has the phases (A is read-only), the
pitfalls and five open decisions. Its Phase C is the aisle override above, offered in place. *Since
29 Sep: its phases are PRs 3, 4, 6 and 8 of `docs/PLAN-NEW-RECIPE-FLOW.md`, and its five decisions are
answered in that plan's §9.*

**Not to redo:** 6c-2's recipe text, its undo and the word matches as made are in
`PrivateBackup`, `migrations/6c-2-line-rewrite/`. Nothing about the library's lines needs doing.

---

## The plan: seven pull requests

The rule behind the order: **mechanism before change, data safety before features, one behaviour
change per PR.** Each PR ends the same way: tests green in CI, the findings it closes ticked in
`docs/REVIEW-ARCHITECTURE-FINDINGS.md`, and one line in `docs/HANDOVER.md` saying what was
verified and how.

| # | PR | What it does | Closes | Status |
| --- | --- | --- | --- | --- |
| 1 | **Safety net** | Tests run in GitHub Actions on every PR and push to `main`; `smoke.js` prints as it goes and names a crash; supabase-js pinned; `rehost-images` source matches what is deployed; nine documents corrected in place | F4 F6 F7 F9 F10 | **Done**, PR #11, 23 Sep |
| 2 | **Close the review loop** | The converter no longer renames ingredients to a list (it keeps the source's product, in British English); `ingredient-names.md` becomes the app's dictionary; the findings and this plan land in the repo | §4, §9 of the architecture review; F12 | **This PR** (#10, reworked) |
| 3 | **Backups** | In `PrivateBackup`: dump the `private` schema too, so the policies' helper function travels with them; a weekly photo backup; a restore runbook written from a rehearsal, including the fresh-project steps | F2 F3 | **Done**, `PrivateBackup` PR #1, 23 Sep. The photo workflow's first run is the one after the merge |
| 4 | **Faithful save** | Reconcile all eight header lines on save, not just `TITLE:` and `IMAGE:`; re-save the drifted recipes (three, not two — `TAGS:` drifted too); add the three missing checks (`pushList`'s delete, the `TITLE:` line, the non-adjacent-merge error); pin the harness to one date | F5 F7 | **Done**, PR #14, 24 Sep. The three re-saves happen in the app after the merge |
| 5 | **Row-scoped writes** | One row per save and an explicit delete, for recipes, plan days, groups, shortlist, aliases, swaps and ticks; whole-table replace kept for import only; deleting a recipe also cleans plan days and groups. Then the two-device pass from `docs/TEST-PLAN.md` | F1 F11 | **Done**, PR #15, 24 Sep. The two-device pass (`docs/TEST-PLAN.md` §D) is the household's to run after the merge |
| 6 | **Shopping list release** | Steps 4–8 of the ingredient review as written, plus: the ⅛ fraction; the source-fidelity check in `validate-recipes.js` *before* the 24-line rewrite (D12 waits on it); the pure functions extracted to one `core` script so their tests run in Node; the dictionary's master copy in the app with `ingredient-names.md` generated from it. Ship on a Friday morning, before shopping. **Split on 25 Sep into three**, after reviewing the plan against PRs 3–5, 16 and 17 (below) | §9 of the architecture review; the ingredient review's status rows 4–8 | See 6a–6c |
| 6a | **Core extraction** | The pure functions moved verbatim to `core.js`, loaded before the page script with a shared version stamp; the dictionary's master copy in `core.js`, `converter/ingredient-names.md` generated from it; `test/core.test.js`, 29 checks in Node, run first in CI. No behaviour change | Answer 6 of the architecture review; check 22 of the ingredient review | **Done**, PR #18, 25 Sep |
| 6b | **The release** | Steps 4–6 of the ingredient review: naming rules, the dictionary with aisles, one row per ingredient, ticks keyed by name (keeping the both-weeks prefix), spoons totalled as ml, the ⅛ fraction, strict inline suggestions instead of the `confirm()` questions, word matches re-normalised at load (no data write), old-key ticks deleted. Re-measured against the review's anchors from the live library. Friday 2 Oct, morning | The ingredient review's status rows 4–6 | **Done**, PR #19, merged Fri 25 Sep. Section E steps 27–29 passed live |
| 6b+ | **What the first live list showed** | Aisles for 12 rows (egg noodles, hot pepper sauce, coconut milk and nine in Other); mixed spoons as "3 tbsp + 2 tsp"; unmeasured lines as "+ extra to serve (2 recipes)" rather than "+ 2 more". No key changes | Found by the household on the release day | **Built**, PR #20, 25 Sep |
| 6c-1 | **Checks where recipes come in** | Re-planned 27 Sep, after the household asked how the line shape is kept up once the 24 lines are fixed: nothing in the app checked it. (1) The ingredient-line checks move from `test/ingredient-lines.js` into `core.js`, so the app and `validate-recipes.js` share one copy. (2) The add/edit preview shows them as warnings with a suggested line — never blocking a save. (3) A `source-ingredients` Edge Function reads the Schema.org JSON-LD at `SOURCE_URL` (as `find-recipe-image` already does for images) and returns the source's ingredient strings. (4) The source-fidelity check in `core.js`: each source ingredient matched to one recipe line sharing a content word, misses on either side shown side by side in the preview and reported by `validate-recipes.js`. (5) `parseRecipe` reports the lines it drops, shown in the preview (the review's cheaper fix, §2). (6) `tools/remeasure.js`: reads an export from outside the repo and reports rows, likely splits, "Other" rows and lines outside the shape — run by a developer session every ten or so new recipes. First job once the function is deployed: measure how many of the library's source sites carry JSON-LD (unverified; 13 of the 14 recipes 6c-2 touches have a `SOURCE_URL`, on seven sites; the review counted twelve sites library-wide) | Row 7's prerequisite; §2 and answer 4 of the architecture review; the ingredient review's §6 library regression | **Done**, PR #22, 27 Sep, with two additions the household asked for: the list shows a recipe's bracketed choice beside the recipe that offered it ("(or honey)"), and ghee files under Dairy. `source-ingredients` deployed the same evening (v1). Section F passed. **Step 33, measured by the household on 27 Sep:** of the twelve sites, **two refuse the function outright** with a 403 — Kitchen Sanctuary, which is 17 of the 34 recipes, and Allrecipes (1) — and no other failure was reported. So for half the library COMPARE WITH SOURCE says "compare by eye". Built as 7d, 28 Sep, open for review: a PASTE box in the preview for the source's own list, copied from the page in the browser, so the check works without the function fetching anything. That, rather than a user agent dressed up as a browser, is the answer to a site that turns automated fetches away |
| 6c-2 | **The line rewrite** | Step 7 as a production data job, with the household present. Re-derived 27 Sep from the live library: **21 lines in 13 recipes** (the review counted 24 in 13; the list is private, never committed). Simulated: 185 rows → 172, and → 167 with five word matches made in the app afterwards, against the review's ideal of 168; no group, stage or layout change in any recipe; every new line passes the shape check. Each recipe: the fidelity check against its source (Victoria Sandwich has none, D6: checked by eye), the shape check, parse, columns and timeline; then `UPDATE … WHERE id = …` in place, never delete and re-insert; then md5 against the validated text and the household opens the flow table. The household's five choices were made on 27 Sep (which alternative is bought, in four lines, and D4's uncooked weight), and the other option is kept in brackets, which the list now shows. Six more "X or Y" lines the first list left alone were added and approved on 27 Sep, so the preview has nothing left to warn about in any recipe: **27 lines in 14 recipes**. Simulated: 185 rows → 172, or 167 with the five word matches; no structure change; 20 rows show a choice | Row 7; D12 waits on it | **Done**, 27 Sep, in the database (a data job, no code). All 14 written in place, each `UPDATE` guarded on the md5 of the text before (the export taken for the job) and after (the validated text); all 14 read back as validated. Re-measured from the live library: **172 rows**, no line the list can't total, none the parser reads past, 21 rows show a choice (the 20 simulated, plus one from a line the household edited by hand earlier that evening). Word matches: the household kept three of the five and kept two pairs apart, as different things to buy: **169 rows** |
| 6d-1 | **MERGE WITH… made safe** | A confirm step ("Merge X with Y? MERGE · CANCEL"), a filter box, and names from the whole library rather than this week's. Found 27 Sep: the dropdown felt unresponsive on the tablet and saves on the first pick, so a slip saved the neighbouring name (undone), and two matches couldn't be made because their recipes weren't planned. Split from 6d on 27 Sep, so each PR changes one behaviour | The household's review of 6c-2's word matches, 27 Sep | **Done**, PR #25, merged 28 Sep |
| 6d-2 | **Household swaps on the shopping list** | Decided 27 Sep. First, match a swap by the list's own names (`shoppingKeyForName`) rather than by substring, which today lets a swap for "butter" fire on "peanut butter"; this changes the recipe viewer too. Then a "possible swaps" panel at the **bottom** of the shopping list, listing the household's own swaps (Settings → Swaps) that apply to this week's rows, with ratio and note. A recipe's own alternatives are not in it: since 6c-1 they show on the row, beside the recipe that offered them. Scoping a swap to some recipes or courses (a schema change) only if the panel shows it is needed. Advisory, as the recipe viewer's list already is | The household's review of 6c-1, 27 Sep | **Done**, PR #26, merged 28 Sep. Scoping a swap to specific recipes/courses not needed — the panel didn't ask for it |
| 7 | **Sharing** | Started 28 Sep, split into one PR per piece rather than built as one, the same habit as 6d. The JSON-LD "plain recipe, no flow" extraction and the model-backed converter are both deferred until a family member is actually adding a recipe — asked and answered 28 Sep, not assumed | F8 F13, answer 4 | **Done**, 28 Sep. See 7a–7c |
| 7a | **The onboarding runbook** | Documentation only, no code, no production write: the three steps to add someone (create their account, one guarded SQL statement to link them, give them the address), what `hydrate()`'s real error looks like if the link is missing, why the app has no sign-up form of its own, and that `household_members.role` is unused (verified: `grep -rn "\.role\b" index.html` finds nothing) | F8 (part) | **Done**, PR #27, merged 28 Sep |
| 7b | **RLS belt and braces, leaked-password protection** | Revoke `anon`'s blanket grants and restrict every `TO public` policy to `authenticated` — done. Leaked-password protection is a dashboard toggle, not SQL, and is still off | F8 (part) | **Done**, 28 Sep, migration `rls_belt_and_braces_restrict_to_authenticated` (no PR — a database migration, not app code), documented on PR #27. Leaked-password protection is the household's own click, whenever wanted |
| 7c | **The weekly live-backend test** | A test household, a test user, a Playwright script against the *live* app, credentials in `PrivateBackup`'s secrets | F13 | **Done**, 28 Sep. `PrivateBackup` PR #3 and #4 merged (a missing reload wait, the test script's own bug); this repo's PR #31 merged (a real app bug — `updateDiaryEntry` silently dropped a meal-type tag tapped before its insert confirmed). Run #5 proved both fixes live: 13 checks, 0 failed |
| 7d | **The paste box for COMPARE WITH SOURCE** | Asked and answered 28 Sep: its own small PR. A textarea and COMPARE PASTED LIST under AGAINST THE SOURCE in the add/edit preview, for the two sites (18 of 34 recipes) that refuse the function with a 403. `pastedIngredientLines` in `core.js` strips tick boxes, bullets, blank lines and headings that are certainly headings, and the same `sourceFidelity` pairs what is left with the recipe's lines. No fetch, no write, no schema change; advice only, never a gate. The pasted text is kept only until the form closes | §2 and answer 4 of the architecture review (the source check for half the library); closes no numbered finding | **Done**, PR #35, merged 28 Sep 21:53 UTC. `core.js` `2026-09-28.3`. Its comparison was rewritten in 7e the same evening |
| 7e | **The source check stops calling a difference a match** | Found 28 Sep by the household's first real comparison: a doubled source line was shown as matched. Probing found one of eleven fault types caught. `sourceFidelity` rebuilt twice (the first rebuild was tailored to the examples; see `HANDOVER.md` §7): every line of one ingredient, on either side, is one group, and the group's amounts are compared as totals per kind (mass, volume, count, a pinch), only where a difference cannot be a unit conversion, a range by both ends; the same name is exact and "the recipe says less" joins only unmatched lines; compound lines split into parts; an addition the dictionary calls the same product is a soft note, else a hard difference; every flagged pair says why and nothing is dropped. The table shows hard differences highlighted, soft notes shaded, and counts them apart. No write, no schema, no dictionary or naming change, so no tick is re-keyed | §2 and answer 4 of the architecture review (the source check itself); closes no numbered finding | **Done**, PR #37, merged 29 Sep 05:06 UTC. `core.js` `2026-09-28.5` |
| 8 | **Adding a recipe as one flow** | Eight PRs planned on 29 Sep in `docs/PLAN-NEW-RECIPE-FLOW.md`: the two naming fixes from 7f's decisions; the converter's rule for an unreadable page; the review band with the source check running by itself; answers in place; provenance on the recipe; aisle overrides; a Settings lookup; a library check. Each entry carries its scope, rules, expected numbers, named checks and mutations, and a STOP AND ASK list | The conversion-integrity finding's preventions and audit; both proposals; closes no numbered finding by itself | **PR 1 of 8 merged 29 Sep 10:48 UTC** (PR #41, the two naming fixes, `core.js` `2026-09-29.2`; measured to change no line in today's library; `main`'s tests run 82 and Pages run 58 succeeded). **PR 2 merged 29 Sep 12:25 UTC** (PR #42, docs only: the converter's rule for a page it cannot read; `main`'s tests run 85 and Pages run 59 succeeded; the household's part is to reload the file and run test 9). **PR 3 merged 29 Sep 14:15 UTC** (PR #43, `c914792`, the review band, read-only: the form reordered, paste parses, the source check runs by itself, the review of new names and duplicates; `core.js` `2026-09-29.3`; the household's pass is `docs/TEST-PLAN.md` step 36d). **PR 4 merged 29 Sep 16:02 UTC** (PR #44, `eee0f43`; answers in place: SAME and KEEP APART on a "Same as" row, the row under SOURCE in place of the last `confirm()`, UNDO for USE THIS and SCALE TO SERVE, BEFORE YOU SAVE; it writes household rows at a tap, so **step 36e is a pass that writes**; `core.js` `2026-09-29.4`). **PR 5 merged 29 Sep 17:12 UTC** (PR #45, `9c4b6f7`; the comparison with the source page recorded on the recipe as `source_check`, shown as a chip in the viewer and on Edit; `docs/migrations/add-recipes-source-check.md` applied by the household from the SQL editor after the merge, checked read-only 18:25 UTC; `core.js` `2026-09-29.5`; step 36f, after the merge). **PR 5b** (SAME AS… in the review, added at the household's request 29 Sep, PR #48; `index.html` only). **PR 6** (shopping aisles; a new table, `docs/migrations/add-aisle-overrides.md`, which the household applies first; `core.js` `2026-09-29.7`; step 36g after the merge; merged 29 Sep as PR #49, table applied). **PR 7** (Settings: ingredient lookup, dictionary list, Swaps subtitle; read-only; step 36h; merged 29 Sep as PR #52). **PR 8** (Settings: LIBRARY CHECK, the audit; read-only; step 36i). The plan's last PR |
| 7f | **US names in the dictionary** | The household's answer to 7e's price, 29 Sep: 49 rows and 15 rows' spellings, by the rule one product on the shelf under two names. Also one reader function (`dictionaryPhrases`) so the index and the tests read a row the same way, which fixed `confectioners' sugar` never having worked as a spelling. Read-only re-measure on the live library: 0 of 466 lines change key; mangetout and pak choi file under Produce. No schema, no write, no change to `shoppingLine` | 7e's price, `HANDOVER.md` §7 | **Done**, PR #38, merged 29 Sep 05:52 UTC. `core.js` `2026-09-29.1`. Three decisions and steps 36b–36c are the household's |

### PR 6 reviewed against what came after it (25 Sep)

- **Ticks are single rows since PR 5**, so ticks under the old names would never be swept away by a
  whole-table save again. 6b deletes them. On 25 Sep all 9 live ticks were for the week of 18 Sep,
  so nothing current is lost.
- **Word matches are keyed by their word since PR 5**, and the words are the old normaliser's
  output. 6b re-normalises them as they load, so they keep applying without a write. On 25 Sep
  there were 17: 6 "same", 10 "not the same", 1 source; the review had counted 20.
- **The converter no longer renames to the list** (PR 2), which is exactly the arrangement the
  review measured: 210 rows and 178 names library-wide, 60 and 52 rows for the two busy weeks. The
  library is still 34 recipes, none added since 22 Sep, so those anchors still hold for 6b.
- **Two files can be cached at different versions** for a few minutes after a deploy. 6a added the
  version stamp and a reload notice.
- **The 24-line rewrite is a production data job** that needs the source check and the private
  appendix, so it is 6c, not part of the Friday release.

### Why this order

- **PR 1 first** so that every later PR is checked by a machine, not a habit.
- **PR 3 is the highest severity** and lives mostly outside this repo, so it can run alongside
  PRs 2 and 4. It needs access to `PrivateBackup` and a Postgres 17 for the rehearsal.
- **PR 4 before PR 5** because PR 5's tests build on PR 4's.
- **PR 5 before PR 6.** The household uses more than one device, so the whole-table save is a
  live risk today, and the shopping-list release rewrites 24 recipe lines and re-keys every tick:
  a second device with a stale cache could push the old lines straight back over the migration.
- **PR 6 on a Friday morning**, as the ingredient review's §5 says, so the tick re-key lands
  before the week's shopping rather than in the middle of it.
- **PR 7 has no date** until the household wants it.

### Things that are the household's to do

Checked 27 Sep. Five items that used to be here are done: `offline-harness` required on `main`
(read back from GitHub's API), the two-device pass (24 Sep),
`rehost-images` redeployed as v10 (25 Sep), the six redundant "same" word matches deleted, and
the unused second account deleted (the project has one user). The two exports asked for
before 6b and PR 6 were taken, and 6c-2 is done.

- **Not verifiable from a session, so still listed:**
  - After PR 2 of the seven-PR plan (23 Sep): reload `converter/conversion-instructions.md` into the
    conversion project, and remove `ingredient-names.md` from it. Then reload the survey project's
    instructions from `converter/ingredient-extraction-prompt.md`, likewise without
    `ingredient-names.md`.
  - After PR 2 of the add-recipe plan (29 Sep, the rule for a page it cannot read): reload
    `converter/conversion-instructions.md` into the conversion project again, run test 9 of
    `converter/test-set.md` once in a fresh chat, and record the result there with the tools that chat
    had. **Done 30 Sep 2026: passed** (tools not stated).
- **Before any job that rewrites recipe text:** a fresh export from the app's sidebar, kept
  outside the repo.

---

## The prompt for the next session

**Since 29 Sep 2026 the next work is an implementation session on `docs/PLAN-NEW-RECIPE-FLOW.md`**,
one PR per session, in the order its section 8 gives (PR 1 and PR 2 first, then 3, 4, 5; 6 after 3;
7 after 6; 8 after 5 and 6). The block below is copied from that plan's section 13; if the two ever
differ, the plan's copy wins. Change `<N>` to the PR number and nothing else.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper. main is production: GitHub Pages serves it and
every merge deploys to the tablet I cook from. Work on a new branch and open a
pull request when the work is tested. Never merge.

YOUR JOB THIS SESSION: PR <N> of docs/PLAN-NEW-RECIPE-FLOW.md, and nothing else.

Read these first, in this order, before writing anything:
  CLAUDE.md                          - its first three sections apply to the letter
  docs/PLAN-NEW-RECIPE-FLOW.md       - section 8 "Before every PR", then the entry
                                       for PR <N>, then section 11 STOP AND ASK,
                                       then sections 4, 5 and 7 for the rules behind it
  docs/DOCUMENT-INDEX.md             - the map of every document
  docs/ARCHITECTURE.md               - how the app and its recipe format work
  the functions, files and ids the PR entry names, in the code itself

Then, before any change, write five lines in chat: what PR <N> changes, which
files, what it must not touch, the numbers you expect before and after, and the
checks you will add. Wait for my "go".

BOUNDARIES. Do not:
  - do any part of another PR, or "one more thing" the entry does not name;
  - reopen a decision in section 4 of the plan, or ask me a question the plan
    already answers (section 10's open items take the plan's recommendation
    unless I say otherwise in this chat);
  - change buildShoppingList, hydrate(), pushList, queueWrite, refreshLibrary
    or any replace* function unless the entry names it;
  - change the database schema, add a table, add a dependency, or change an
    Edge Function unless the entry names it, and never deploy one;
  - show a dialog, block a save, delete anything, or write a household fact
    without a tap;
  - write recipe text to the database, commit any recipe, plan or diary data,
    or paste real ingredient lines anywhere (examples are invented and checked
    against the library);
  - merge, or push to any branch but your own;
  - claim a test passed without running it and reading its exit code.

MUST, in this order (section 8 of the plan has the detail):
  1. git fetch origin main; branch from origin/main.
  2. node test/core.test.js, then node test/build.js && node test/smoke.js
     (npm install playwright once; if no browser is found, set
     PLAYWRIGHT_CHROMIUM to the chrome under /opt/pw-browsers/chromium-*/
     chrome-linux/). Read echo $? after each. Green before you change anything,
     or stop.
  3. Make the change the entry describes. Add the checks it names. Break each
     one on purpose, see it fail by name, restore the code; git diff must show
     only your intended change.
  4. If core.js changed, bump KITCHEN_CORE_VERSION, core.js?v= and
     EXPECTED_CORE_VERSION together.
  5. PR 1 only: re-measure the live library on main and on your branch
     (test/README.md, "Re-measuring the live library"); the export stays in
     scratch. Put both results in the PR.
  6. git diff origin/main, read for private data. Dates from date -u.
  7. Open the PR. Its description has two headings: "Verified by" (what you
     ran, the counts, the mutations and which check each failed) and "Not
     verified" (everything you could not check, the live app included).
  8. Tick nothing in docs/REVIEW-ARCHITECTURE-FINDINGS.md unless the entry
     says to; update the status column of row 8 in docs/NEXT-SESSION.md; add
     one line to docs/HANDOVER.md section 7 saying what was verified and how.

STOP AND ASK when any trigger in section 11 of the plan happens. Stop means:
commit only what is green, with a message saying it is partial; push your
branch; do not open a PR; tell me what happened, the exact error text or
number, and the two ways forward you see. A smaller PR is always fine. When
unsure, stop.

Some context worth having:
  - index.html and core.js are the whole app. No build step, no framework.
    The test suite stubs Supabase, so a green run proves nothing about
    sign-in, RLS or the write queue.
  - Don't trust status notes, mine included, where you can check the real
    thing. The corrections table in docs/HANDOVER.md section 6 says why.
  - The repo is public.
```

*(Until 29 Sep this section held the prompt for the conversion-integrity review; that review's
questions are answered in the plan, and its remaining data job, repairing the two reconstructed
recipes, follows `CLAUDE.md`, not a prompt.)*

---

## Alternative starting points

If you want to do something other than the next PR, swap the task section of the prompt above.

### B. Ingesting more recipes

> I've got more recipes converted with `converter/conversion-instructions.md`. Ingest them the
> same way as the 20 Sep batch — the method, and the two deviations from it that turned out to be
> necessary, are in `docs/HANDOVER.md` §3. Validate them first with
> `node test/build.js && node test/validate-recipes.js <file>`, which runs the app's own parser
> and prints what each ingredient will total as on the shopping list; show me the title mapping
> before writing. Take a fresh backup first if any existing recipe is going to be deleted, and
> check `select count(*) from shopping_checked` first: a reprocess re-keys every tick.

### C. Re-running the browser test pass

> Walk me through `docs/TEST-PLAN.md` again. The full pass was completed 21 Sep, so this is a
> regression run rather than a first verification — worth doing after any change to `hydrate()`,
> the write queue, or anything the plan's expected counts depend on. Re-read those counts from
> the database first; they go stale every time the library changes.

### D. Re-running the image sweep

Normally unnecessary since 22 Sep — saving a recipe re-hosts its photo by itself. You want this
after a **restore from backup** or a save made **offline**, which are the two cases the save path
cannot see.

> Some recipes' images are still on the source sites. Run the sweep — **Settings → RECIPE
> PHOTOS → RE-HOST EXTERNAL IMAGES**. It's idempotent, so anything already self-hosted is skipped.
> If you want the per-image detail first, `docs/IMAGES.md` §2 has the console dry run; check its
> byte counts for outliers, because one Contentful image was 7.7 MB until it was asked to resize,
> which was more than the rest of the library put together.

### E. A growing dictionary

> Run the ingredient survey on a new batch of recipes (`converter/ingredient-extraction-prompt.md`
> says how) and tell me which rows and spellings to add to `converter/ingredient-names.md`. Keep
> the batches and the report outside the repo.

### F. Phase 3, after the plan

> The food diary (H1, H2, H3) and dark mode (S2) are done. What's left of Phase 3 is dated
> cooking notes (R4) and the calendar push (P3), both in `docs/BUILD-BRIEF.md` with reference
> codes. R4 needs a decision before any code: `recipe_notes` exists but has no user-settable date
> column, and `recipe_logs.note` is also free. §1 and §4 of the handover cover what's decided.

---

## Two things not to undo

- **`PrivateBackup`'s default branch** is `claude/recipe-app-supabase-0z139o`, not `main`. That's
  why the nightly backup fires. Renaming it will silently stop backups unless the schedule is
  re-confirmed afterwards.
- **The backup workflow's two fixes** — the Session pooler connection string (the direct one is
  IPv6-only; GitHub runners have no IPv6) and the full path to `pg_dump` 17 (the runner's own is
  older than the server). Both took several failed runs to find.

---

## The recipe conversion prompt

`converter/conversion-instructions.md` was reviewed on 14 Sep against the app's real parser and
**revised twice on 23 Sep**: first to add a standard shape for ingredient lines and a vocabulary
to take names from, then, after the architecture review, to withdraw the vocabulary half. The
converter now keeps the source's product words in British English and never makes a name more
specific than the source; the app's dictionary does the naming at list time. Reload the file
into the conversion project after any change, and give it **on its own**: `ingredient-names.md`
is no longer a converter file. Its revision notes say what changed and why.

**One thing worth adding to your conversion chat**, since the output now goes straight into the
database rather than being pasted through the app's form one at a time:

> These conversions are being ingested directly into the app's database, so the fenced code block
> is the data, not just a preview. Give each recipe as its own fenced code block starting `TITLE:`.
> Don't abbreviate, summarise or omit anything after presenting it.
