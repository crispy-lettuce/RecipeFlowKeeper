# Status: where things stand

Read after `README.md` and `CLAUDE.md`. It says what is built, what is open, and what not to undo. The README's table lists the
other documents. **Written 22 Oct 2026**; every line below says where to check it, because versions and counts written here go
stale on the next release. It carries no test counts.

---

## 1. Where things stand

- **The app is live and in daily use.** `main` is production: GitHub Pages serves it and every merge deploys. The current versions
  are `APP_VERSION` and `CONVERTER_VERSION` in `index.html` and `KITCHEN_CORE_VERSION` in `core.js`; Settings → HELP shows the first.
- **Open work on GitHub:** check the pull requests and issues. On 22 Oct there were no open pull requests and one open issue, #100 (a
  staging/preview site), which the household decided to ignore.
- **Tablet checks:** the household reported every open check complete on 22 Oct; `docs/HOUSEHOLD-JOBS.md` lists what is waiting.
- **Schema, Edge Functions, households and backups:** `docs/INFRASTRUCTURE.md` (§3 for the first three, §2 for backups). On 22 Oct
  nothing was waiting to be applied or redeployed (last read 12 and 20 Oct; not re-checked).
- **Removed documents** are at commit `67b552e` of `main`; the README says how to read them.

## 2. The Build Brief

`docs/BUILD-BRIEF.md` defines the reference codes (S1, P3, R4, H1 …) used in code comments. **All of them are built;**
`docs/SPEC.md` describes each feature, and `converter/` holds the C-series. Added since the brief, all in `SPEC.md`: recipe sharing
between households, the Drive backup, PRE-MADE and COOKED ✓, SERVE WITH / OFTEN WITH, FINISH TOGETHER, preparation as steps, AUDIT on
the shopping list, the source-photo store, ADD SEVERAL, LIBRARY CHECK, the Modernist style, + OTHER on the Planner, the converter
reminder and the version bar.

## 3. What is open

1. **Nothing is planned.** The household picks the next piece of work.
2. **#100, a preview site.** Parked and now ignored; close the issue if it is not wanted. The reasoning (GitHub Pages stays live,
   Cloudflare Pages gives each PR a preview, one database means a preview writes real data) is in
   `git show 67b552e:docs/PLAN-PREVIEW-SITE.md`.
3. **Household jobs:** `docs/HOUSEHOLD-JOBS.md`.
4. **Optional, not planned:** a "download all source files" backup; drawing a PDF's pages inside the app.
5. **Housekeeping a session can do:** re-measure the live library every ten or so new recipes ("Re-measuring the live library",
   `test/README.md`) and look at what the shopping list puts in Other; new dictionary rows are edited in `core.js`, then
   `node tools/generate-ingredient-names.js`.

## 4. Not to undo

`PrivateBackup`'s default branch is not `main`, and its dump needs the Session pooler string and `pg_dump` 17 by full path:
`docs/INFRASTRUCTURE.md` §2.

## 5. Starting a session

Change the task line and nothing else. `CLAUDE.md` holds the rules; the prompt only points at them.

```
I'm continuing work on my Kitchen recipe app, in the repo crispy-lettuce/RecipeFlowKeeper.
main is production: every merge deploys to the tablet I cook from. Work on a branch and open
a pull request when the work is tested. Don't merge unless I ask.

YOUR JOB THIS SESSION: <one thing>, and nothing else.

Read first: CLAUDE.md (follow "Every session" and "Where a session stops" to the letter), then
docs/STATUS.md. Read docs/SPEC.md and docs/ARCHITECTURE.md for the parts the job touches.

Before any change, write five lines in chat: what changes, which files, what it must not
touch, the numbers you expect before and after, and the checks you will add. Wait for my "go".

Do not reopen a decision I have made. When unsure, stop and ask. A smaller PR is always fine.
```

### Other starting points

- **Adding recipes:** the app's NEW RECIPE form, one at a time, or ADD SEVERAL for a batch (`docs/SPEC.md` §5.3). A batch written
  straight to the database is the exception, and follows `CLAUDE.md`'s rules for recipe text.
- **A regression pass:** `docs/TEST-PLAN.md`, after a change to `hydrate()`, the write queue, or anything its expected counts depend
  on. Re-read those counts from the database first.
- **After a restore from backup, or a save made offline:** Settings → Library → RECIPE PHOTOS → RE-HOST EXTERNAL IMAGES
  (`docs/IMAGES.md`).
