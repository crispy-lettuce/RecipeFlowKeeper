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
- **Tests:** `node test/core.test.js` 153 checks; `node test/build.js && node test/smoke.js` 547 checks (418 until P3 PR 2, 437 until the
  calendar toggles, both 9 Oct; 447 until the HELP tab, 448 until recipe sharing, 465 until the Drive backup, 472 until PRE-MADE, 487 until fresh or
  freezer, all 10 Oct; 492 until issues #85–#93, 500 until FROZEN, 502 until photo upload, 509 until the version and change log, 11 Oct; 515 until the network guard, 517 until the lost-changes fixes, 530 until the write queue, 537 until several households, 12 Oct).
  `node test/calendar-push.js` 35 checks; `node test/drive-backup.js` 13 checks; `node test/image-integrity.js` 35 checks;
  `node test/source-ingredients.js` 12 checks; `node test/help-guide.js` 7 checks. `offline-harness` runs
  both on every PR and is required on `main`.
- **Schema:** `add_calendar_auto` (the P3 toggles) was applied by the household on 9 Oct, before #72 merged. The one before it,
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
| `docs/PLAN-COOKING-NOTES.md` (30 Sep) | R4: dated cooking notes per recipe, after cooking, foldable into NOTES | Done, PR #67; tablet 39a passed 12 Oct |
| `docs/PLAN-SOURCE-PHOTOS.md` (30 Sep) | The photo or PDF a recipe was converted from, kept privately; CHECKED AGAINST THE PHOTO | Done, PRs #63–#65; tablet 38b passed, 38c and 38d the household's |

---

## What is left, in order

1. **The household's tablet passes:** `docs/TEST-PLAN.md` 38c (CHECKED AGAINST THE PHOTO) and 38d (PDF sources).
2. **The household's data jobs** (below): compare and validate the BBC Good Food recipes; D6, the reconstructed recipes.
3. **R4, dated cooking notes: merged 30 Sep** (PR #67; `docs/PLAN-COOKING-NOTES.md`). Tablet step 39a passed 12 Oct.
4. **P3, the calendar push.** Answered 1 Oct (`docs/PLAN-CALENDAR-PUSH.md` §9): one all-day event per switched-on planned day in
   a RecipeWrangler calendar, REMIND ME at 20:00 the evening before, ADD THE WEEK; DISCONNECT leaves the calendar. **PR 1** (the
   migration, `calendar-auth`, `calendar-sync`, `test/calendar-push.js`) merged 1 Oct (#69); **PR 2, the app**, merged 9 Oct (#71):
   the Planner's IN CALENDAR, REMIND ME and ADD THE WEEK, Settings → App → CALENDAR, and a sync after each Planner change to a
   switched-on day. The household set it up and connected on 9 Oct. **The follow-up (§11, 9 Oct):** two toggles,
   AUTOMATICALLY ADD TO CALENDAR and AUTOMATICALLY REMIND ME FOR MAIN MEALS, with `docs/migrations/add-calendar-auto.md`: apply the
   SQL, then merge. Then tablet and phone steps 40a and 40b, and PR 3 records what they found (`docs/INFRASTRUCTURE.md`'s functions
   table, `docs/ARCHITECTURE.md` §4, `docs/HANDOVER.md`).
5. **The how-to guide (10 Oct):** `help.html`, opened from Settings → HELP. Drafted for the household to read; then one PR.
   Keep it true: a renamed button or a new everyday feature updates it in the same PR (`test/help-guide.js`).
6. **PRE-MADE meals and COOKED ✓ (10 Oct): live** (#78, SQL applied, `calendar-sync` v3). The food diary fed from the Planner, `docs/PLAN-FOOD-DIARY.md`.
7. **A new household, and sharing recipes with it (10 Oct, answered):** `docs/ONBOARDING.md` §4 makes the household from an
   email address; `docs/PLAN-RECIPE-SHARING.md` lets either household browse the other's recipes and copy them. The SQL,
   `docs/migrations/add-recipe-sharing.md`, is the household's to apply first; then the app's side. **Merged 10 Oct (#74), the SQL
   applied first.**
8. **A weekly backup to Google Drive (10 Oct): live.** `docs/PLAN-DRIVE-BACKUP.md`. The export file, into the household's own
   Drive, weekly and by hand; the nightly dump stays the real backup. Merged (#75), set up and first saved 10 Oct 18:05 UTC.
9. **Optional, not planned:** a "download all source files" backup (the source files go into `PrivateBackup`'s weekly mirror
   instead, 10 Oct); drawing a PDF's pages inside the app, if opening it in the browser proves awkward on the tablet (38d will tell).

## Things that are the household's to do

**Brought up to date 12 Oct 2026**, while the October review's PRs were going in. These are yours; a session cannot do them. When
you finish one, tell the next session, and it takes the line out.

**1. Reload the app on each device**, since #120 merged (12 Oct, 13:47 UTC).

**2. Tablet and phone steps not yet reported back** (`docs/TEST-PLAN.md`):
- **38c:** CHECKED AGAINST THE PHOTO.
- **38d:** PDF sources.
- **40b:** the automatic calendar toggles.
- **47a:** your own photo as a recipe's picture.
- **50a:** several households: the week-start question, a star kept through an EDIT, two devices' settings. #120 and its SQL
  are in, so it can be done now.

**3. Library jobs:**
- **The BBC Good Food validations.** Compare the six BBC Good Food recipes with their real pages, then VALIDATE INGREDIENT LIST on
  each that is right:
  1. In Edit, tap OPEN SOURCE ↗.
  2. Copy the page's ingredient list.
  3. Paste it into COMPARE PASTED LIST.

  Five were rebuilt from another edition before the 29 Sep rule. LIBRARY CHECK lists what is still to do.
- **D6: repair the reconstructed recipes**, with a session, by the recipe-text rules in `CLAUDE.md`. You approve the exact lines,
  the before and after go to `PrivateBackup`, and there is one guarded statement per recipe.
- **The converter, in both households.** Reload `converter/conversion-instructions.md` into each household's conversion project in
  the Claude app. The master copy is the one in this repo; reload it after any change here. The other files under `converter/`
  stay in git as reference and test material, and are not loaded.
- **Before any job that rewrites recipe text:** take a fresh export from the app's sidebar, kept outside the repo.

**4. Decisions waiting on you:**
- **Your own issues, left open for you to review:**
  - #87, side dishes with no timings;
  - #88, how the flow is meant to be followed;
  - #94, the shopping list: PNG and print keeping the ticks, and an "audit" setting;
  - #95, the INGREDIENTS settings tab as its lists grow;
  - #100, moving to Cloudflare Pages.
- **Two library recipe titles** are still named in `docs/IMAGES.md`, `docs/HANDOVER.md`, `docs/TEST-PLAN.md` and `rehost-images`'
  comments. They tell the story of the two broken photos. Should they be taken out, or left?
- **The last items of #105 and #106**, not in the eight-PR plan:
  - F37: `source-ingredients` keeps its time limit only until the page's headers arrive, and reads the whole page before checking
    its size.
  - F38: the calendar's "sync every day" has no cap.

  A small extra PR. It needs you to redeploy two functions.
- **Coming in PR 7 (the parser):** decide F45 (the wording the app shows and scales), and F16 and F19. F16 and F19 re-key shopping
  ticks, so they come with a measurement across every household first.
- **Coming in PR 8 (the documents):** agree F34's wording, on when a PR may merge before its migration.

**5. Things a session will check, read-only, with nothing for you to do:**
- **The photo backup** (Sunday 18 Oct, or sooner if you dispatch it): its first run on the new mirror script.
- **Review issues:**
  - #111 and #112 stay open until PR 7.
  - #114 stays open until PR 8.
  - #101 (the whole review) stays open until the end.
  - Closed on 12 Oct, with comments naming the PRs: #103, #104, #107, #108, #109, #110, #113 and #115.

**Done, and off this list:**
- Tablet steps 41a and 41b (PRE-MADE and COOKED ✓; 10 Oct).
- Tablet steps 39a, 40a, 42a, 43a, 44a, 45a, 46a, 48a and 49a, all reported passed on 12 Oct.
- `docs/migrations/harden-default-privileges.md`, applied before #120 merged (12 Oct). Checked read-only at 13:47 UTC: `postgres`'
  default privileges in `public` grant `anon` nothing on tables, sequences or functions, and no household is without a settings
  row.
- The third household made (`docs/ONBOARDING.md`; three households live, 12 Oct).

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
