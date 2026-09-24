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
| 5 | **Row-scoped writes** | One row per save and an explicit delete, for recipes, plan days, groups, shortlist, aliases, swaps and ticks; whole-table replace kept for import only; deleting a recipe also cleans plan days and groups. Then the two-device pass from `docs/TEST-PLAN.md` | F1 F11 | Not started |
| 6 | **Shopping list release** | Steps 4–8 of the ingredient review as written, plus: the ⅛ fraction; the source-fidelity check in `validate-recipes.js` *before* the 24-line rewrite (D12 waits on it); the pure functions extracted to one `core` script so their tests run in Node; the dictionary's master copy in the app with `ingredient-names.md` generated from it. Ship on a Friday morning, before shopping | §9 of the architecture review; the ingredient review's status rows 4–8 | Not started |
| 7 | **Sharing** | When wanted: a JSON-LD Edge Function (which also gives the preview its source lines); the onboarding runbook; RLS belt and braces and leaked-password protection; a weekly Playwright test against the live app. A model-backed converter only if the family actually adds recipes | F8 F13, answer 4 | Not started |

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

- After PR 2 merges: reload `converter/conversion-instructions.md` into the conversion project
  and **remove `ingredient-names.md` from it**; reload the survey project's instructions from
  `converter/ingredient-extraction-prompt.md`, likewise without `ingredient-names.md`.
- Make the `offline-harness` check **required** on `main` (Settings → Branches). PR 1 could not
  do that from a workflow file.
- Delete the unused second account in the Supabase dashboard (Authentication → Users).
- After PR #14 merges: open each of the three drifted recipes, press EDIT then SAVE RECIPE with
  nothing changed, and run the header-drift query at the end of `docs/TEST-PLAN.md`; every
  column should read 0. PR #14's description names the three. This is also the only run the
  faithful save gets against the real backend.
- Deploy `rehost-images` from the repo (v9) when next in the Supabase dashboard or CLI, so the
  deployed copy and `supabase/functions/rehost-images/index.ts` are byte-identical again
  (F4; the difference is comment wording only).
- Before PR 6: a fresh export from the app's sidebar, kept outside the repo, for the re-measure.

---

## The prompt for the next session

Copy everything in the block below, and change the PR number to the one you are starting.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper. main is production; work on a new branch
and open a pull request when the work is tested.

Please read these first, in this order:

  docs/DOCUMENT-INDEX.md                  — the map of all documentation
  docs/NEXT-SESSION.md                    — the seven-PR plan; we are at PR 5
  docs/REVIEW-ARCHITECTURE-FINDINGS.md    — §0 and the findings the PR closes
  docs/HANDOVER.md                        — verified status
  docs/ARCHITECTURE.md                    — how the app and its recipe format work
  CLAUDE.md                               — applies in full

THE TASK: PR 5 from the plan. Tell me what you'd do and what you need from
me before building anything, then build it, run the tests, and open the PR.

Some context worth having:

  - MAIN IS PRODUCTION. Pages serves from main, and every merge deploys to
    the tablet I cook from immediately. There is no staging step.
  - index.html is the whole app. One file, no build step, no framework.
    Run `node test/build.js && node test/smoke.js` after any code change,
    and `node test/image-integrity.js` after any change to the Edge
    Functions. Run both smoke commands, always: smoke.js loads what build.js
    wrote. The suite stubs Supabase, so it proves nothing about sign-in.
  - The repo is public. Recipe, plan and diary data must never be committed
    to it. Anything exported stays in scratch outside the repo.
  - Don't trust status notes, mine included, where you can check the real
    thing instead. The corrections table in docs/HANDOVER.md §6 has
    twenty-five rows now.
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
