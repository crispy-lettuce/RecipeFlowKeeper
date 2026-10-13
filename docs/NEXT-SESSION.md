# What to do next, and in what order

**Rewritten 30 Sep 2026**, when every agreed plan had been built and merged. Until then this page carried each plan's history as
it happened; that history is in `docs/HANDOVER.md` (§7 has what was verified for every PR) and in this file's git history. What
is here now: where things stand, what is left and in what order, the household's own jobs, and a prompt for the next session.

For repo URLs, the Supabase project and where secrets live, see `docs/INFRASTRUCTURE.md`. **`main` is production:** GitHub Pages
serves it and every merge deploys to the tablet within a minute. Work on a branch, open a pull request, let `offline-harness` run,
and the household decides when to merge. Before anything else, read the first three sections of `CLAUDE.md`.

---

## Where things stand (12 Oct 2026)

Checked against `git log` and, read-only, against the live project on 12 Oct (15:16 UTC). The library and diary counts in the
first two lines are older, as dated there. Check again before relying on a number.

- **Library:** 34 recipes on 30 Sep (19:11 UTC); 39 across the three households on 12 Oct. On 30 Sep, 2 carried a stored
  comparison with their source, 1 of them validated; 6 are BBC Good Food, five of which were rebuilt from another edition before
  the 29 Sep rule (the household's job below); 1 recipe had a source photo.
- **Cooking diary:** 116 entries on 30 Sep (119 on 10 Oct, the October review). **Word matches:** 15. **Household aisles:** 1.
  **Swaps:** 2 (all three on 30 Sep). **Cooking notes:** 2 rows in all on 12 Oct (R4 built 30 Sep).
- **Tests:** `node test/core.test.js` 185 checks; `node test/build.js && node test/smoke.js` 591 checks (418 until P3 PR 2, 437 until the
  calendar toggles, both 9 Oct; 447 until the HELP tab, 448 until recipe sharing, 465 until the Drive backup, 472 until PRE-MADE, 487 until fresh or
  freezer, all 10 Oct; 492 until issues #85–#93, 500 until FROZEN, 502 until photo upload, 509 until the version and change log, 11 Oct; 515 until the network guard, 517 until the lost-changes fixes, 530 until the write queue, 537 until several households, 547 until the converter reminder, 12 Oct; 554 until the printed list, 557 until AUDIT, 568 until the INGREDIENTS folds, 576 until PREPARATION, 13 Oct).
  `node test/calendar-push.js` 39 checks; `node test/drive-backup.js` 13 checks; `node test/image-integrity.js` 37 checks;
  `node test/source-ingredients.js` 16 checks; `node test/help-guide.js` 7 checks. `offline-harness` runs
  both on every PR and is required on `main`.
- **Schema:** 16 tables in `public` and 1 in `private`, row-level security on every one (12 Oct). Nothing is waiting:
  the last page, `docs/migrations/add-converter-ack.md` (#127), was applied by the household on 13 Oct, after #129 merged. The one before it,
  `docs/migrations/harden-default-privileges.md`, was applied by the household on 12 Oct before #120 merged. `add_calendar_auto`
  (the P3 toggles) was applied by the household on 9 Oct, before #72 merged. The one before it,
  `add_calendar_push`, was applied 9 Oct, before the household connected the calendar at 17:52 UTC (`docs/INFRASTRUCTURE.md`;
  read-only check 18:59 UTC: connected, 5 days switched on, 1 with a reminder).
- **Edge Functions:** five, all redeployed on 12 Oct after #102 (`docs/INFRASTRUCTURE.md` §3).
  `find-recipe-image` is gone from the repo and the project.
- **Three households, three accounts, three memberships** (12 Oct): the family's, the family's second (made by
  `docs/ONBOARDING.md` §4), and the weekly live test's own (`PrivateBackup`). One recipe share is live. An account in two
  households is refused at sign-in since #120. `docs/ONBOARDING.md` adds a person to a household. Leaked-password protection is a
  paid-plan feature and the household is on the free plan: not an open item.

*(Until 12 Oct this section was headed 30 Sep over lines from 9–12 Oct, and said the family was one account and one household.
Corrected 12 Oct 2026, the October review's F13 and Appendix B.)*

### Plans, all finished

| Plan | What it was | Status |
| --- | --- | --- |
| The seven-PR plan (23 Sep) | Safety net, backups, faithful saves, row-scoped writes, the shopping list release, sharing | Done, 1–7f |
| `docs/PLAN-NEW-RECIPE-FLOW.md` (29 Sep) | Adding a recipe as one flow: review band, answers in place, the comparison recorded, aisles, Settings lookup, LIBRARY CHECK | Done, PRs #41–#53 |
| Autocomplete (30 Sep) | The ingredient boxes' own dropdown in Settings and Swaps | Done, PRs #55–#56; tablet 36k |
| `docs/PLAN-LAYOUT.md` (30 Sep) | Edit dialog, cooking mode, step text, aisle box, Settings tabs | Done, PRs #57–#60; tablet 37a–37d |
| VALIDATE INGREDIENT LIST, OPEN SOURCE (30 Sep) | Accepting a comparison's differences; the source page from Edit | Done, PR #62; tablet 38a |
| `docs/PLAN-COOKING-NOTES.md` (30 Sep) | R4: dated cooking notes per recipe, after cooking, foldable into NOTES | Done, PR #67; tablet 39a passed 12 Oct |
| `docs/PLAN-SOURCE-PHOTOS.md` (30 Sep) | The photo or PDF a recipe was converted from, kept privately; CHECKED AGAINST THE PHOTO | Done, PRs #63–#65; tablet 38b passed; 38c and 38d passed 12 Oct |
| `docs/PLAN-CALENDAR-PUSH.md` (P3, 30 Sep) | Planned days in a RecipeWrangler Google calendar: IN CALENDAR, REMIND ME, ADD THE WEEK; the two automatic toggles (§11) | Done, PRs #69, #71, #72, both migrations applied and connected 9 Oct; tablet 40a passed 12 Oct, 40b the household's |
| The how-to guide (10 Oct) | `help.html`, opened from Settings → HELP; converting your own recipes | Done, PRs #73, #77; tablet 42a passed 12 Oct |
| `docs/PLAN-RECIPE-SHARING.md` (10 Oct) | A second household of the family, and browsing and copying each other's recipes | Done, PR #74, the SQL applied first; tablet 43a passed 12 Oct |
| `docs/PLAN-DRIVE-BACKUP.md` (10 Oct) | The export file, weekly and by hand, into the household's own Drive | Done, PR #75, first saved 10 Oct 18:05 UTC; tablet 44a passed 12 Oct |
| `docs/PLAN-FOOD-DIARY.md` (10 Oct) | PRE-MADE meals and COOKED ✓; fresh or freezer | Done, PRs #78, #80; tablet 41a and 41b |
| Issues #85–#93 (11 Oct) | Parse feedback, seconds, COOKING MODE, Drink; FROZEN; your own photo; the version and change log | Done, PRs #96–#99; tablet 45a, 46a, 47a, 48a passed 12 Oct |
| The October review, PRs 1–7 (`docs/REVIEW-2026-10-FINDINGS.md`, 11 Oct) | Backups, Edge Function hardening, the public repo and harness, lost changes, the write queue, several households, the parser and dictionary | Done, PrivateBackup#7, #102, #117–#121, 11–12 Oct; tablet 49a and 51a passed 12 Oct, 50a passed 12 Oct. PR 8, the documents, in progress |

---

## What is left, in order

Brought up to date 12 Oct 2026. Every plan above is merged; what follows is all that is open.

1. **The October review is finished** (12 Oct): its eight PRs (`PrivateBackup`#7, #102, #117–#122) and the extra one for F37 and
   F38 (#123) are merged, and the three functions #123 changed are redeployed and read back (`docs/INFRASTRUCTURE.md` §3).
2. **The household's own issues, decided 13 Oct ("defaults" on every plan), built in the order #94, #95, #88, #87:** #87 `docs/PLAN-SIDES.md`
   (PR 3, FINISH TOGETHER, built 13 Oct as #138; PR 1, SERVE WITH, built 13 Oct; PR 2, the Planner offer, next), #88
   `docs/PLAN-PREP-STEPS.md` (built 13 Oct), #94's AUDIT `docs/PLAN-SHOPPING-AUDIT.md` (built 13 Oct; its first half is #132), #95
   `docs/PLAN-INGREDIENTS-TAB.md` (built 13 Oct); #100 `docs/PLAN-PREVIEW-SITE.md` is parked. The household picks the order.
3. **The household's jobs**, in `docs/HOUSEHOLD-JOBS.md`: every tablet step up to 56a has passed (53a–56a on 13 Oct). Left: the
   second family household reloads the converter and taps DONE, and tablet step 57a (#138). #101 is closed and the recipe
   titles are scrubbed (#132). The BBC validations and D6 are dropped by the household (12 Oct): the
   recipes will be cleared before full adoption.
4. **#127, the converter reminder** (#129, merged 13 Oct; its SQL applied the same day): a bar in the app, per household, until
   someone taps DONE after reloading the converter. A session can see who has confirmed, read-only:
   `household_settings.converter_ack_version`. A change to
   `converter/conversion-instructions.md` moves its Version line, `CONVERTER_VERSION` in `index.html` and `CONVERTER_PINNED` in
   `test/core.test.js` together (`CLAUDE.md`).
5. **Optional, not planned:** a "download all source files" backup (the source files go into `PrivateBackup`'s weekly mirror
   instead, 10 Oct); drawing a PDF's pages inside the app, not needed: 38d passed and the household is happy opening the PDF outside the app (12 Oct).

Keep the how-to guide true: a renamed button or a new everyday feature updates `help.html` in the same PR (`test/help-guide.js`).

*(Until 12 Oct this list still carried R4, P3, the guide, PRE-MADE, sharing and the Drive backup as work to do, with "apply the
SQL, then merge" and "then one PR" for things merged 9–10 Oct. They are in the table above. Corrected 12 Oct 2026, the October
review's F13.)*

## Things that are the household's to do

**Moved to `docs/HOUSEHOLD-JOBS.md` on 12 Oct 2026**, written as numbered steps the household can follow on the tablet. A
session that adds a tablet step, or hears that one passed, updates that page in the same PR. Things a session checks with
nothing for the household to do (the photo backup on Sunday 18 Oct) are listed there too.

---

## The prompt for the next session

Change the task line and nothing else.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper. main is production: GitHub Pages serves it and
every merge deploys to the tablet I cook from. Work on a branch and open a pull
request when the work is tested. Never merge.

YOUR JOB THIS SESSION: <one item from "What is left, in order" in
docs/NEXT-SESSION.md, e.g. "build R4 from docs/PLAN-COOKING-NOTES.md with my
answers: ...">, and nothing else.

Read these first, in this order, before writing anything:
  CLAUDE.md                  - its first three sections apply to the letter
  docs/NEXT-SESSION.md       - where things stand
  docs/DOCUMENT-INDEX.md     - the map of every document
  docs/ARCHITECTURE.md       - how the app and its recipe format work
  the plan for the job, if it has one, and the code it names

Then, before any change, write five lines in chat: what changes, which files,
what it must not touch, the numbers you expect before and after, and the checks
you will add. Wait for my "go".

Do not: reopen a decision the plan records; change the schema (the SQL goes in
docs/migrations/ for me to apply first), add a dependency or deploy an Edge
Function; show a dialog, block a save or delete anything without a tap; write
recipe text to the database except by CLAUDE.md's rules; commit recipe, plan
or diary data or real ingredient lines (examples are invented and checked
against the library); merge; claim a test passed without reading its exit code.

Must: run node test/core.test.js and node test/build.js && node test/smoke.js
before and after (set PLAYWRIGHT_CHROMIUM to the chrome under
/opt/pw-browsers/chromium-*/chrome-linux/ if no browser is found); break every
new check once and see it fail by name; bump core.js's version in all three
places if core.js changes; read git diff origin/main for private data; take
dates from date -u; record what was verified, and what was not, in the PR and
in docs/HANDOVER.md.

When unsure, stop and ask. A smaller PR is always fine.
```

---

## Alternative starting points

### Ingesting more recipes

> I've got more recipes converted with `converter/conversion-instructions.md`. Add them through the app's + NEW RECIPE form, one
> at a time, so each gets the review band and its source check. For a batch too large for that, the 20 Sep method is in
> `docs/HANDOVER.md` §3: validate first with `node test/build.js && node test/validate-recipes.js <file>`, show me the title
> mapping before writing, take a fresh backup, and check `select count(*) from shopping_checked` first.

### Re-running the browser test pass

> Walk me through `docs/TEST-PLAN.md` again, as a regression run after a change to `hydrate()`, the write queue, or anything the
> plan's expected counts depend on. Re-read those counts from the database first.

### Re-running the image sweep

Needed only after a **restore from backup** or a save made **offline**: **Settings → Library → RECIPE PHOTOS → RE-HOST EXTERNAL
IMAGES**. `docs/IMAGES.md` §2 has the console dry run.

### A growing dictionary

Every ten or so new recipes: re-measure the live library (`test/README.md`, "Re-measuring the live library") and look at what the
shopping list puts in Other. New dictionary rows are edited in `core.js`, then `node tools/generate-ingredient-names.js`.
`converter/ingredient-extraction-prompt.md` is the survey prompt for a larger batch, run in a chat of its own.

---

## Two things not to undo

- **`PrivateBackup`'s default branch** is `claude/recipe-app-supabase-0z139o`, not `main`. That's why the nightly backup fires.
  Renaming it will silently stop backups unless the schedule is re-confirmed afterwards.
- **The backup workflow's two fixes:** the Session pooler connection string (the direct one is IPv6-only; GitHub runners have no
  IPv6) and the full path to `pg_dump` 17 (the runner's own is older than the server). Both took several failed runs to find.
