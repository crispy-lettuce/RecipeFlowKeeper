# Status: where things stand, and how to start a session

The one page to read first after `README.md` and `CLAUDE.md`. It says what is built, what is open, and what not to undo. For
*what the app does* read `docs/SPEC.md`; for *how it is built*, `docs/ARCHITECTURE.md`; for repos, Supabase and secrets,
`docs/INFRASTRUCTURE.md`; for what only the household can do, `docs/HOUSEHOLD-JOBS.md`.

**Written 22 Oct 2026.** Checked against `main` at `67b552e` and GitHub that day. Not checked against the live database today.
It carries no test counts: run the suites, and CI is the record.

---

## 1. Where things stand (22 Oct 2026)

- **The app is live and in daily use.** `main` is production: GitHub Pages serves it and every merge deploys. App version
  `2026-10-22.1` (`APP_VERSION`, `index.html`), core `2026-10-21.5` (`KITCHEN_CORE_VERSION`, `core.js`).
- **Open work on GitHub:** no open pull requests; one open issue, #100 (a staging/preview site), which the household has decided
  to ignore. Issues #94 and #95 were closed on 22 Oct (built 13 Oct).
- **Tablet checks:** the household reported every open check complete on 22 Oct.
- **Schema:** nothing waiting to be applied; every page in `docs/migrations/` is applied (`docs/INFRASTRUCTURE.md` §3).
- **Edge Functions:** five; nothing waiting to be redeployed (`docs/INFRASTRUCTURE.md` §3, last read 20 Oct).
- **Households:** four (the family's, the relatives', Test Kitchen, and the live check's). Testing is done in Test Kitchen.
- **Backups:** nightly database dump, weekly photo mirror, weekly live check, in `PrivateBackup`; a weekly Drive copy of the export.
- **Documentation** was rationalised on 22 Oct: the plans, reviews and handovers are gone, and `SPEC.md` and this page replace them. Anything removed is at commit
  `67b552e` of `main`: `git show 67b552e:docs/<file>`. A reference in a code comment to a removed document, or a finding number
  (`F5`, `F45`; two review series overlap), is read there.

## 2. The Build Brief, against what was built

`docs/BUILD-BRIEF.md` defines the reference codes used in code comments. **All of them are built.**

| Area | Codes | Where it lives now |
| --- | --- | --- |
| Settings | S1 week start, S2 dark mode, S3 word matches | `SPEC.md` §5.9 |
| Planner | P1 servings per dish, P2 total time on cards, P3 calendar push (with reminders per meal) | §5.5, §6.6 |
| Recipe viewing | R1 reset ticks, R2 collapsing sidebar, R3 Group Viewer, R4 dated cooking notes, R5 scale by servings, R6 servings mandatory, R7 images | §5.2, §5.4, §6.4 |
| Shopping list | SL1 units, SL2 name matching, SL3 hide ticked, SL4 reset ticks, SL5 week selection | §5.7, §6.2 |
| History | H1 meal type, H2 ad-hoc entries, H3 CSV | §5.8 |
| Converter | C1 equipment, C2 source URL, C3 timed MERGEs, C4 servings, C5 phrasing, C6 units, C7 test set | `converter/conversion-instructions.md`, `converter/test-set.md` |
| Architecture | Pages hosting, Supabase, household id on every table, private backup repo, images in Storage, calendar reminders | `INFRASTRUCTURE.md` |

Added since the brief, all in `SPEC.md`: recipe sharing between households, the Drive backup, PRE-MADE and COOKED ✓, SERVE WITH /
OFTEN WITH, FINISH TOGETHER, preparation as steps, AUDIT on the shopping list, the source-photo store, ADD SEVERAL, LIBRARY CHECK,
the Modernist style, + OTHER on the Planner, the converter reminder, the version bar.

## 3. What is open

1. **One plan, unbuilt: `docs/PLAN-RUN-SHEET.md`** (drafted 23 Oct). Hands-off steps in the recipe format and a live timeline:
   four PRs and a pass over the library's recipe text, in that order. It waits on the household's answers to its §10; PR 1
   (timeline fixes) needs none of them.
2. **#100, a preview site.** Parked and now ignored; close the issue if it is not wanted. The reasoning (GitHub Pages stays live,
   Cloudflare Pages gives each PR a preview, one database means a preview writes real data) is in the archive at
   `docs/PLAN-PREVIEW-SITE.md`.
3. **Household jobs** are in `docs/HOUSEHOLD-JOBS.md`: reloading each device, and the converter bar's DONE.
4. **Optional, not planned:** a "download all source files" backup; drawing a PDF's pages inside the app.
5. **Housekeeping a session can do:** re-measure the live library every ten or so new recipes ("Re-measuring the live library",
   `test/README.md`) and look at what the shopping list puts in Other; new dictionary rows are edited in `core.js`, then
   `node tools/generate-ingredient-names.js`.

## 4. Two things not to undo

- **`PrivateBackup`'s default branch** is `claude/recipe-app-supabase-0z139o`, not `main`. The schedules fire from it.
- **The dump's two fixes:** the Session pooler connection string, and `pg_dump` 17 by its full path.

## 5. Starting a session

Change the task line and nothing else.

```
I'm continuing work on my Kitchen recipe app, in the repo crispy-lettuce/RecipeFlowKeeper.
main is production: GitHub Pages serves it and every merge deploys to the tablet I cook
from. Work on a branch and open a pull request when the work is tested. Never merge.

YOUR JOB THIS SESSION: <one thing>, and nothing else.

Read first, in this order: CLAUDE.md (its first three sections apply to the letter),
docs/STATUS.md, docs/SPEC.md, docs/ARCHITECTURE.md, and the code the job touches.

Then, before any change, write five lines in chat: what changes, which files, what it must
not touch, the numbers you expect before and after, and the checks you will add. Wait for
my "go".

Do not: reopen a decision I have made; change the schema (the SQL goes in docs/migrations/
for me to apply first); add a dependency or deploy an Edge Function; block a save or delete
anything without a tap; write recipe text to the database except by CLAUDE.md's rules;
commit recipe, plan or diary data or real ingredient lines; merge; claim a test passed
without reading its exit code.

Must: run node test/core.test.js and node test/build.js && node test/smoke.js before and
after (set PLAYWRIGHT_CHROMIUM to the chrome under /opt/pw-browsers/chromium-*/chrome-linux/
if no browser is found; the smoke suite is slow); break every new check once and see it fail
by name; bump core.js's version in all three places if core.js changes; update changelog.json,
help.html and docs/SPEC.md for anything the household will notice; read git diff origin/main
for private data; take dates from date -u; say in the PR what was verified and what was not.

When unsure, stop and ask. A smaller PR is always fine.
```

### Other starting points

- **Adding recipes:** through the app's NEW RECIPE form, one at a time, or ADD SEVERAL for a batch (`docs/SPEC.md` §5.3). A batch
  written straight to the database is the exception, and follows `CLAUDE.md`'s rules for recipe text.
- **A regression pass:** `docs/TEST-PLAN.md`, after a change to `hydrate()`, the write queue, or anything its expected counts
  depend on. Re-read those counts from the database first.
- **After a restore from backup, or a save made offline:** Settings → Library → RECIPE PHOTOS → RE-HOST EXTERNAL IMAGES
  (`docs/IMAGES.md`).
