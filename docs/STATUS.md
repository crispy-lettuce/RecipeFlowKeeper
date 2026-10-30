# Status: where things stand, and how to start a session

The one page to read first after `README.md` and `CLAUDE.md`. It says what is built, what is open, and what not to undo. For
*what the app does* read `docs/SPEC.md`; for *how it is built*, `docs/ARCHITECTURE.md`; for repos, Supabase and secrets,
`docs/INFRASTRUCTURE.md`; for what only the household can do, `docs/HOUSEHOLD-JOBS.md`.

**Brought up to date 26 Oct 2026.** Checked against `main` at `17157c4` and GitHub that day. Not checked against the live database.
It carries no test counts: run the suites, and CI is the record.

---

## 1. Where things stand (26 Oct 2026)

- **The app is live and in daily use.** `main` is production: GitHub Pages serves it and every merge deploys. App version
  `2026-10-26.1` (`APP_VERSION`, `index.html`), core `2026-10-25.1` (`KITCHEN_CORE_VERSION`, `core.js`).
- **Open work on GitHub:** no open pull requests; five open issues (checked 30 Oct): #221 (COOK AHEAD on the Planner), #216 (the converter and old BBC Good
  Food recipes), #200 (view styles: its three asks are built, see §3), #199 (names: the on-screen name is done, the repository rename is not) and #198
  (reporting a bug or idea from the app). #221 and #198 are built (30 Oct): see §3.
  #100 (a preview site) was closed.
- **Tablet checks:** the household reported every check complete on 25 Oct. Built since, and not yet reported on a device: the sign-in changes (#196,
  Job 1 in `docs/HOUSEHOLD-JOBS.md`), and the Modernist default, the Recipes grid, hiding the menu on every screen and the single NEW RECIPE button (#197, #199, #200).
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
OFTEN WITH, FINISH TOGETHER, preparation as steps, AUDIT on the shopping list, the source-photo store, several recipes at once through NEW RECIPE, LIBRARY CHECK,
the Modernist style, + OTHER on the Planner, the converter reminder, the version bar.

## 3. What is open

1. **The run sheet is built and closed.** The run sheet (hands-off steps in the recipe format, a live timeline with EAT AT, your hands, ovens, START COOKING and
   timers) was planned in `docs/PLAN-RUN-SHEET.md` and built on 23 and 24 Oct 2026 (#189 to #195, then #205 for the timers), with a pass over the family household's recipe
   text on 24 Oct (95 `, hands off` marks in 50 of its 76 recipes; the record is in the private backup repo, and the one later correction of an onion step on 25 Oct is
   there too). The converter's rule for the mark was settled in #202 and #210. What the app now does is in `docs/SPEC.md` §5.2. You reported the tablet checks passed on 25 Oct 2026;
   that is a report, not something a session saw, except that the family household's confirmed converter version read `2026-10-25.1` in the database that day. The plan
   was closed and deleted on 25 Oct: it is at commit `9851f20` (`git show 9851f20:docs/PLAN-RUN-SHEET.md`), which is what the code comments citing its sections mean.
   The timers rehearsal lives on as a standing check, `docs/TEST-PLAN.md` section H.
2. **Open issues** (26 Oct 2026). **#216**, the converter and old BBC Good Food recipes, has no work on it in the repository. **#200** is built in #218 and #219 (Modernist the
   default, the grid fitting its width, the menu hideable on every screen) and the issue is left open for the household to close once it is seen on the tablet.
   **#199**: the app is called "Recipe Wrangler" on screen; renaming the repository is not started and waits on the household's answers. **#198**, reporting a bug or idea from the app, is built (Settings → HELP → REPORT A BUG OR AN IDEA, `docs/SPEC.md` §5.9; it opens a prefilled GitHub
   page, so nothing is stored or deployed) and **#221**, COOK AHEAD on the Planner, is built (`docs/SPEC.md` §5.5). Both await the household's tablet checks
   (`docs/HOUSEHOLD-JOBS.md` Jobs 2 and 3), and #221 needs `docs/migrations/add-cook-ahead.md` applied first: until then the Planner keeps its two-way switch.
   Neither issue is closed; the household closes them once seen. The plan that covered both was deleted with the build: `git show 40e461d:docs/PLAN-COOK-AHEAD-AND-REPORTS.md`. #100, a preview site, was closed; its reasoning is at `git show 67b552e:docs/PLAN-PREVIEW-SITE.md`.
3. **Household jobs** are in `docs/HOUSEHOLD-JOBS.md`: one waiting, signing in again on each device (Job 1, #196).
4. **Optional, not planned:** a "download all source files" backup; drawing a PDF's pages inside the app;
   and four ideas parked from the run sheet's review, each wanting its own issue if picked up: **Trace** (hold a box to dim everything that does not feed it), folding away
   finished rows and columns in cooking mode, a step-through view (one "now" card at a time), and drawn connector lines between boxes.
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

- **Adding recipes:** through the app's NEW RECIPE form: one at a time, or a batch pasted or chosen as a file, which goes to a review (`docs/SPEC.md` §5.3). A batch
  written straight to the database is the exception, and follows `CLAUDE.md`'s rules for recipe text.
- **A regression pass:** `docs/TEST-PLAN.md`, after a change to `hydrate()`, the write queue, or anything its expected counts
  depend on. Re-read those counts from the database first.
- **After a restore from backup, or a save made offline:** Settings → Library → RECIPE PHOTOS → RE-HOST EXTERNAL IMAGES
  (`docs/IMAGES.md`).
