# What to do next, and in what order

**Rewritten 30 Sep 2026**, when every agreed plan had been built and merged. Until then this page carried each plan's history as
it happened; that history is in `docs/HANDOVER.md` (§7 has what was verified for every PR) and in this file's git history. What
is here now: where things stand, what is left and in what order, the household's own jobs, and a prompt for the next session.

For repo URLs, the Supabase project and where secrets live, see `docs/INFRASTRUCTURE.md`. **`main` is production:** GitHub Pages
serves it and every merge deploys to the tablet within a minute. Work on a branch, open a pull request, let `offline-harness` run,
and the household decides when to merge. Before anything else, read the first three sections of `CLAUDE.md`.

---

## Where things stand (30 Sep 2026)

Checked against the database at 19:11 UTC and against `git log`. Check again before relying on a number.

- **Library:** 34 recipes. 2 carry a stored comparison with their source, 1 of them validated; 6 are BBC Good Food, five of which
  were rebuilt from another edition before the 29 Sep rule (the household's job below). 1 recipe has a source photo.
- **Cooking diary:** 116 entries. **Word matches:** 15. **Household aisles:** 1. **Swaps:** 2. **Cooking notes:** none yet (R4 built 30 Sep).
- **Tests:** `node test/core.test.js` 143 checks; `node test/build.js && node test/smoke.js` 447 checks (418 until P3 PR 2, 437 until the
  calendar toggles, both 9 Oct).
  `node test/calendar-push.js` 30 checks. `offline-harness` runs
  both on every PR and is required on `main`.
- **Schema:** `add_calendar_auto` (the P3 toggles, 9 Oct) is waiting to be applied by the household. The last applied,
  `add_calendar_push`, was applied 9 Oct, before the household connected the calendar at 17:52 UTC (`docs/INFRASTRUCTURE.md`;
  read-only check 18:59 UTC: connected, 5 days switched on, 1 with a reminder).
- **The family is one account, one household.** `docs/ONBOARDING.md` adds a second person. A second `households` row is the weekly
  live test's own (`PrivateBackup`), never the family's. Leaked-password protection is a paid-plan feature and the household is on
  the free plan: not an open item.

### Plans, all finished

| Plan | What it was | Status |
| --- | --- | --- |
| The seven-PR plan (23 Sep) | Safety net, backups, faithful saves, row-scoped writes, the shopping list release, sharing | Done, 1–7f |
| `docs/PLAN-NEW-RECIPE-FLOW.md` (29 Sep) | Adding a recipe as one flow: review band, answers in place, the comparison recorded, aisles, Settings lookup, LIBRARY CHECK | Done, PRs #41–#53 |
| Autocomplete (30 Sep) | The ingredient boxes' own dropdown in Settings and Swaps | Done, PRs #55–#56; tablet 36k |
| `docs/PLAN-LAYOUT.md` (30 Sep) | Edit dialog, cooking mode, step text, aisle box, Settings tabs | Done, PRs #57–#60; tablet 37a–37d |
| VALIDATE INGREDIENT LIST, OPEN SOURCE (30 Sep) | Accepting a comparison's differences; the source page from Edit | Done, PR #62; tablet 38a |
| `docs/PLAN-COOKING-NOTES.md` (30 Sep) | R4: dated cooking notes per recipe, after cooking, foldable into NOTES | Done, PR #67; tablet 39a |
| `docs/PLAN-SOURCE-PHOTOS.md` (30 Sep) | The photo or PDF a recipe was converted from, kept privately; CHECKED AGAINST THE PHOTO | Done, PRs #63–#65; tablet 38b passed, 38c and 38d the household's |

---

## What is left, in order

1. **The household's tablet passes:** `docs/TEST-PLAN.md` 38c (CHECKED AGAINST THE PHOTO) and 38d (PDF sources).
2. **The household's data jobs** (below): compare and validate the BBC Good Food recipes; D6, the reconstructed recipes.
3. **R4, dated cooking notes: merged 30 Sep** (PR #67; `docs/PLAN-COOKING-NOTES.md`). Tablet step 39a is the household's.
4. **P3, the calendar push.** Answered 1 Oct (`docs/PLAN-CALENDAR-PUSH.md` §9): one all-day event per switched-on planned day in
   a RecipeWrangler calendar, REMIND ME at 20:00 the evening before, ADD THE WEEK; DISCONNECT leaves the calendar. **PR 1** (the
   migration, `calendar-auth`, `calendar-sync`, `test/calendar-push.js`) merged 1 Oct (#69); **PR 2, the app**, merged 9 Oct (#71):
   the Planner's IN CALENDAR, REMIND ME and ADD THE WEEK, Settings → App → CALENDAR, and a sync after each Planner change to a
   switched-on day. The household set it up and connected on 9 Oct. **The follow-up (§11, 9 Oct):** two toggles,
   AUTOMATICALLY ADD TO CALENDAR and AUTOMATICALLY REMIND ME FOR MAIN MEALS, with `docs/migrations/add-calendar-auto.md`: apply the
   SQL, then merge. Then tablet and phone steps 40a and 40b, and PR 3 records what they found (`docs/INFRASTRUCTURE.md`'s functions
   table, `docs/ARCHITECTURE.md` §4, `docs/HANDOVER.md`).
5. **Optional, not planned:** a "download all source files" backup (neither the JSON export nor the nightly `pg_dump` holds the
   files); drawing a PDF's pages inside the app, if opening it in the browser proves awkward on the tablet (38d will tell).

## Things that are the household's to do

- **Tablet passes 38c and 38d** (above).
- **Compare the six BBC Good Food recipes with their real pages**, then VALIDATE INGREDIENT LIST on each that is right: in Edit,
  OPEN SOURCE ↗, copy the page's ingredient list, paste it into COMPARE PASTED LIST. Five were rebuilt from another edition
  before the 29 Sep rule (`docs/HANDOVER.md`, 30 Sep). LIBRARY CHECK lists what is still to do.
- **D6: repair the reconstructed recipes**, together with a session, by the recipe-text rules in `CLAUDE.md` (the household
  approves the exact lines; the before and after go to `PrivateBackup`; one guarded statement per recipe).
- **Tablet step 39a**, cooking notes.
- **P3:** apply `docs/migrations/add-calendar-auto.md` in the SQL editor, then merge the toggles' PR. Then tablet and phone steps
  40a and 40b.
- **The converter.** The conversion project in the Claude app holds **one file, `converter/conversion-instructions.md`**; its
  master copy is the one in this repo. After any change to that file here, reload it into the project. The other files under
  `converter/` stay in git as the project's reference and test material (`test-set.md` is how a change to the instructions is
  checked), and are not loaded into the project.
- **Before any job that rewrites recipe text:** a fresh export from the app's sidebar, kept outside the repo.

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
