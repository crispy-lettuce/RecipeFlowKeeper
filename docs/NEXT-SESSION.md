# What to do next, and in what order

Two things live here: **the order work should happen in**, with the reasoning, and a
**ready-to-paste prompt** for starting the next session.

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

## Start here: where things stand (27 Sep 2026, evening)

Each fact below was checked against the database, the deployed functions or `git log` when it
was written. Check again before relying on one.

**Done.** PRs 1–6c are merged and live. The last code change was PR #22, 6c-1, and `core.js`
carries `2026-09-28.2`. That stamp is a label, and PR #22 was really merged on 27 Sep. 6c-2 was
a data job, not a PR. PR #23 is its documentation.

**The live app:**

- **Library:** 34 recipes.
- **Shopping list:** planned all at once, the recipes come to **169 rows**. Every ingredient
  line fits the standard shape, and the parser skips none.
- **Word matches:** 3 "same" (added 27 Sep), 10 "not the same" and 1 source.
- **Household swaps:** 2 stored.
- **Edge Functions:** `rehost-images` v10, `find-recipe-image` v4 and `source-ingredients` v1.
  `source-ingredients` gets a 403 from Kitchen Sanctuary (17 recipes) and Allrecipes (1), so
  COMPARE WITH SOURCE says "compare by eye" for half the library.

**Next: 6d**, three parts that all touch the shopping list. The table below has the reasoning.

1. **Match swaps by the list's names.** `findSwapMatchesForIngredient` (`index.html` ~4978)
   matches by substring, so a swap for "butter" fires on "peanut butter". The recipe viewer uses
   it too: its swap icons (~2031) and its swap list (~2076). The fix changes what the viewer shows
   as well as feeding the panel. Compare the two stored swaps' matches across the whole library
   before and after.
2. **A "possible swaps" panel at the bottom of the shopping list** (`renderShopping` ~5074). It
   lists the household's swaps that apply to rows on the list, each with its ratio and note.
   `buildShoppingList` (~5022) must stay free of side effects (`CLAUDE.md`). A recipe's own
   bracketed choices are not in the panel: they already show on the row.
3. **MERGE WITH…** (~5237). Today it saves on the first pick, with no confirm step, and offers
   only this week's rows. On 27 Sep that saved a wrong match, and two matches couldn't be made
   at all. Add a confirm step and a filter box, and offer names from the whole library.

**Ask the household before building:**

- what the panel shows for each swap;
- whether MERGE WITH… should offer names from the whole library;
- whether the PASTE box for COMPARE WITH SOURCE, the answer to the two sites that refuse the
  function, belongs in 6d or later.

**Not to redo:** 6c-2's recipe text, its undo and the word matches as made are in
`PrivateBackup`, `migrations/6c-2-line-rewrite/`. Nothing about the library's lines needs doing
before 6d.

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
| 6c-1 | **Checks where recipes come in** | Re-planned 27 Sep, after the household asked how the line shape is kept up once the 24 lines are fixed: nothing in the app checked it. (1) The ingredient-line checks move from `test/ingredient-lines.js` into `core.js`, so the app and `validate-recipes.js` share one copy. (2) The add/edit preview shows them as warnings with a suggested line — never blocking a save. (3) A `source-ingredients` Edge Function reads the Schema.org JSON-LD at `SOURCE_URL` (as `find-recipe-image` already does for images) and returns the source's ingredient strings. (4) The source-fidelity check in `core.js`: each source ingredient matched to one recipe line sharing a content word, misses on either side shown side by side in the preview and reported by `validate-recipes.js`. (5) `parseRecipe` reports the lines it drops, shown in the preview (the review's cheaper fix, §2). (6) `tools/remeasure.js`: reads an export from outside the repo and reports rows, likely splits, "Other" rows and lines outside the shape — run by a developer session every ten or so new recipes. First job once the function is deployed: measure how many of the library's source sites carry JSON-LD (unverified; 13 of the 14 recipes 6c-2 touches have a `SOURCE_URL`, on seven sites; the review counted twelve sites library-wide) | Row 7's prerequisite; §2 and answer 4 of the architecture review; the ingredient review's §6 library regression | **Done**, PR #22, 27 Sep, with two additions the household asked for: the list shows a recipe's bracketed choice beside the recipe that offered it ("(or honey)"), and ghee files under Dairy. `source-ingredients` deployed the same evening (v1). Section F passed. **Step 33, measured by the household on 27 Sep:** of the twelve sites, **two refuse the function outright** with a 403 — Kitchen Sanctuary, which is 17 of the 34 recipes, and Allrecipes (1) — and no other failure was reported. So for half the library COMPARE WITH SOURCE says "compare by eye". Not planned yet: a PASTE box in the preview for the source's own list, copied from the page in the browser, so the check works without the function fetching anything. That, rather than a user agent dressed up as a browser, is the answer to a site that turns automated fetches away |
| 6c-2 | **The line rewrite** | Step 7 as a production data job, with the household present. Re-derived 27 Sep from the live library: **21 lines in 13 recipes** (the review counted 24 in 13; the list is private, never committed). Simulated: 185 rows → 172, and → 167 with five word matches made in the app afterwards, against the review's ideal of 168; no group, stage or layout change in any recipe; every new line passes the shape check. Each recipe: the fidelity check against its source (Victoria Sandwich has none, D6: checked by eye), the shape check, parse, columns and timeline; then `UPDATE … WHERE id = …` in place, never delete and re-insert; then md5 against the validated text and the household opens the flow table. The household's five choices were made on 27 Sep (which alternative is bought, in four lines, and D4's uncooked weight), and the other option is kept in brackets, which the list now shows. Six more "X or Y" lines the first list left alone were added and approved on 27 Sep, so the preview has nothing left to warn about in any recipe: **27 lines in 14 recipes**. Simulated: 185 rows → 172, or 167 with the five word matches; no structure change; 20 rows show a choice | Row 7; D12 waits on it | **Done**, 27 Sep, in the database (a data job, no code). All 14 written in place, each `UPDATE` guarded on the md5 of the text before (the export taken for the job) and after (the validated text); all 14 read back as validated. Re-measured from the live library: **172 rows**, no line the list can't total, none the parser reads past, 21 rows show a choice (the 20 simulated, plus one from a line the household edited by hand earlier that evening). Word matches: the household kept three of the five and kept two pairs apart, as different things to buy: **169 rows** |
| 6d | **Household swaps on the shopping list** | Decided 27 Sep. A "possible swaps" panel at the **bottom** of the shopping list, listing the household's own swaps (Settings → Swaps) that apply to this week's rows, with ratio and note. A recipe's own alternatives are not in it: since 6c-1 they show on the row, beside the recipe that offered them. First, match a swap by the list's own names (`shoppingKeyForName`) rather than by substring, which today lets a swap for "butter" fire on "peanut butter". Scoping a swap to some recipes or courses (a schema change) only if the panel shows it is needed. Advisory, as the recipe viewer's list already is. **Also, MERGE WITH…**: the household found its dropdown unresponsive on 27 Sep, and it saves the moment a name is picked, so a slip of the finger saves the neighbouring name (it happened once on 27 Sep, and was undone). It only offers rows on the list being shown, so two names that are never planned in the same week cannot be joined there. A confirm step ("Merge X with Y? MERGE · CANCEL"), a filter box, and names from the whole library rather than this week's | The household's review of 6c-1, and of 6c-2's word matches, 27 Sep | Not started |
| 7 | **Sharing** | When wanted: a JSON-LD Edge Function (which also gives the preview its source lines); the onboarding runbook; RLS belt and braces and leaked-password protection; a weekly Playwright test against the live app. A model-backed converter only if the family actually adds recipes | F8 F13, answer 4 | Not started |

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

Checked 27 Sep. Four items that used to be here are done: the two-device pass (24 Sep),
`rehost-images` redeployed as v10 (25 Sep), the six redundant "same" word matches deleted, and
the unused second account deleted (the project has one user). The two exports asked for
before 6b and PR 6 were taken, and 6c-2 is done.

- **Not verifiable from a session, so still listed:**
  - Make the `offline-harness` check **required** on `main` (Settings → Branches). PR 1 could
    not do that from a workflow file.
  - After PR 2: reload `converter/conversion-instructions.md` into the conversion project, and
    remove `ingredient-names.md` from it. Then reload the survey project's instructions from
    `converter/ingredient-extraction-prompt.md`, likewise without `ingredient-names.md`.
- **Before any job that rewrites recipe text:** a fresh export from the app's sidebar, kept
  outside the repo.

---

## The prompt for the next session

Copy everything in the block below, and change the PR number to the one you are starting.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper. main is production; work on a new branch
and open a pull request when the work is tested.

Please read these first, in this order:

  docs/DOCUMENT-INDEX.md                  — the map of all documentation
  docs/NEXT-SESSION.md                    — "Start here" first; we are at PR 6d
  docs/REVIEW-ARCHITECTURE-FINDINGS.md    — §0 and the findings the PR closes
  docs/HANDOVER.md                        — verified status
  docs/ARCHITECTURE.md                    — how the app and its recipe format work
  CLAUDE.md                               — applies in full

THE TASK: PR 6d from the plan: household swaps on the shopping list, and
MERGE WITH… made safe. Tell me what you'd do and what you need from me
before building anything ("Start here" lists three questions), then build
it, run the tests, and open the PR.

Some context worth having:

  - MAIN IS PRODUCTION. Pages serves from main, and every merge deploys to
    the tablet I cook from immediately. There is no staging step.
  - index.html and core.js are the whole app. No build step, no framework;
    core.js holds the pure functions and the ingredient dictionary.
    Run `node test/core.test.js`, then `node test/build.js && node test/smoke.js`,
    after any code change,
    and `node test/image-integrity.js` after any change to the Edge
    Functions. Run both smoke commands, always: smoke.js loads what build.js
    wrote. The suite stubs Supabase, so it proves nothing about sign-in.
  - The repo is public. Recipe, plan and diary data must never be committed
    to it. Anything exported stays in scratch outside the repo.
  - Don't trust status notes, mine included, where you can check the real
    thing instead. The corrections table in docs/HANDOVER.md §6 has
    twenty-six rows now.
  - When the PR is done: tick the findings it closes in
    docs/REVIEW-ARCHITECTURE-FINDINGS.md, update the status column in
    docs/NEXT-SESSION.md, and add one line to docs/HANDOVER.md saying what
    was verified and how.
```

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
