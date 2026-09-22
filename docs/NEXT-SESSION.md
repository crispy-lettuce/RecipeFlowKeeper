# What to do next, and in what order

Two things live here: **the order work should happen in**, with the reasoning, and a
**ready-to-paste prompt** for starting the next session.

For repo URLs, the Supabase project and where secrets live, see `docs/INFRASTRUCTURE.md` —
that document assumes no prior context at all, including no Claude Code session.

---

## The order

The sequence matters in three places. Everything else is preference.

### 0. Reprocess the recipes — **done, 20 Sep**

Ran the library back through `converter/conversion-instructions.md`. It took two attempts: the
first produced no durations, no source URLs and no equipment at all, because it hadn't been run
against the current instructions. That was caught before anything was written, by validating
the batch with the app's own parser. The second attempt delivered all four.

### 1. Ingest the reprocessed recipes — **done, 20 Sep**

33 recipes in, 27 updated in place, 5 inserted, 12 deleted, 114 of 126 cooking logs kept.
Outcome and the two deliberate deviations from the agreed column list are in
`docs/HANDOVER.md` §3; the re-run of the converter tests is the third scan in
`converter/test-set.md`.

### 2. The browser test pass — **done, 21 Sep**

All 20 steps of `docs/TEST-PLAN.md` run against the real backend by a human in a browser, for
the first time. **Nothing in the Supabase rewrite is unverified any more.** Sign-in, hydration,
row-level security and the background write queue all worked; export and import round-tripped
with every table count intact.

Worth recording what the pass actually proved, since the offline harness can prove none of it:

- `hydrate()` completes without throwing, and signing out and back in survives it. That was the
  single riskiest path — any exception there signs the user out, so the failure mode is a login
  screen you cannot get past.
- One favourite toggle rewrites the **whole** library: `saveRecipesList` → `pushList` upserts
  all 33 rows and then deletes anything not in the list. It behaved correctly, but it means a
  hydration that silently returned a partial library would have the next favourite delete the
  rest. Nothing to fix today; worth knowing before anything is changed in `hydrate()`.
- `shopping_checked.item_key` is the aggregation string itself, so the 20 Sep ingest re-keyed
  every possible tick. It happened to be empty, so nothing broke. **The next reprocess will not
  be so lucky** — clear the ticked list first, or expect orphaned keys.

Two findings came out of it, both fixed the same day — see step 2a.

### 2a. What the test pass found

- **PNG export truncated to one screenful.** `.app` is `height:100vh; overflow:hidden`, so
  expanding the scrolling pane was never enough; the shell still cropped. Print was unaffected
  because the print stylesheet already unclips `.app` — the PNG path simply never learned to.
  Affected the Recipe Viewer and Shopping List exports too, not just the Group Viewer where it
  was spotted. Fixed by unclipping the shell during capture, the same way print does.
- **Keep Awake now collapses the sidebar at any width.** Previously only 861–1180px did that,
  on the theory that width implies a cramped device. Keep Awake being on is a much better
  signal — it is a statement that cooking is happening now, not a guess about the screen. The
  peek tab stays available and leaving the recipe restores the sidebar, so it cannot strand you.

### 3. Merge to `main` and go live — **done, 21 Sep**

PR #2, merged. `main` now holds the build the test pass verified, and Pages redeployed itself
within a couple of minutes of the merge.

**The thing this step actually taught:** Pages serves from `main`, so **every merge to `main`
redeploys the live app immediately**, with no staging step and no approval. That was never
written down before. Treat `main` as production from here on — which is the opposite of the
assumption the earlier notes carried, that nothing was deployed and nothing could break.

The related correction, recorded in `docs/INFRASTRUCTURE.md` §2: `main` was never the
pre-Supabase app during this project. It had been serving an older build of the Supabase rewrite
since PR #1, and four documents said otherwise.

Also the moment the documentation becomes visible on the repo's default branch. Everything
currently lives only on `claude/recipe-app-supabase-0z139o`.

### 4. Image re-hosting (R7) — **done, 21 Sep**

All 29 images self-hosted, 4,426 kB. Built as an Edge Function sweep; the app was not touched,
because it renders whatever is in `image_url`.

**The verification in the original version of this line was worthless and has been replaced.** It
compared each stored file's byte count against the dry run's — but both reads fetch the same
source, so a file broken at source produces two identical counts and a clean pass. Two images were
in fact broken. Integrity is now checked on the way in, and
`{"verify": true}` re-checks the stored library; see `docs/IMAGES.md` §2.
Full account, including three things that cost time and would cost them again, in
`docs/HANDOVER.md` §2.

### 4a. The original reasoning, kept because it still holds

`docs/HANDOVER.md` §2. An Edge Function, run as a decoupled sweep.

**Why after ingestion:** re-hosting images beforehand would have done the work against recipes
about to be replaced. Ingestion has happened, so this is now unblocked: **29 of the 33 recipes
have an image and every one of them is hosted on the source website**, with the
`recipe-images` bucket still holding zero objects. It's server-side work that doesn't need the
app merged, so it can equally happen alongside step 3.

### 5. Phase 3, and anything left ← **start here**

No dependencies between these; pick by appetite.

- ~~**H1–H3** — meal type at logging, ad-hoc diary entries, CSV export~~ — **done, 22 Sep**
- **R4** — dated cooking notes (the `recipe_notes` table already exists for it)
- **P3** — automatic calendar push, needing a one-off Google consent
- ~~**S2** — dark mode~~ — **done, 22 Sep**

---

## The prompt for the next session

Copy everything in the block below.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper, on branch claude/recipe-app-supabase-0z139o.
Please read these first, in this order:

  docs/DOCUMENT-INDEX.md   — the map of all documentation
  docs/HANDOVER.md         — verified status
  docs/ARCHITECTURE.md     — how the app and its recipe format work
  docs/BUILD-BRIEF.md      — the original spec, for the reference codes
  docs/NEXT-SESSION.md     — the order of work; we are at step 5

Steps 1 to 4 are all done: the library was reprocessed and ingested
(33 recipes), the full browser test pass was run against the real backend,
the app was merged to main and is live on GitHub Pages, and all 29 recipe
images are now self-hosted in Supabase Storage.

THE TASK: Phase 3. Nothing here has been started, and none of it has
dependencies on the others, so tell me what you'd do first and why before
building anything.

  (H1, H2 and H3 are done, 22 Sep — the food diary is built.)
  R4  dated cooking notes (the recipe_notes table already exists, empty)
  P3  automatic calendar push, needing a one-off Google consent
  (S2 dark mode is done, 22 Sep.)

Some context worth having:

  - MAIN IS PRODUCTION. Pages serves from main, and every merge deploys to
    the tablet I cook from immediately. There is no staging step. Work on
    the branch and I'll decide when to merge.
  - index.html is the whole app. One file, no build step, no framework.
    Run `node test/build.js && node test/smoke.js` after any code change.
    148 checks. It stubs Supabase, so it proves nothing about sign-in.
  - Several columns already exist for these features (recipe_logs.meal_type,
    recipe_logs.note). A column existing does
    not mean the feature does — docs/ARCHITECTURE.md §4 lists them.
  - The repo is public. Recipe data must never be committed to it.
  - Don't trust status notes, mine included, where you can check the real
    thing instead. Four separate times now, something recorded as true
    wasn't.
```

## Alternative starting points

If you want to do something other than step 1, swap the task section of the prompt above.

### B. Ingesting more recipes

> I've got more recipes converted with `converter/conversion-instructions.md`. Ingest them the
> same way as the 20 Sep batch — the method, and the two deviations from it that turned out to be
> necessary, are in `docs/HANDOVER.md` §3. Validate them first with
> `node test/build.js && node test/validate-recipes.js <file>`, which runs the app's own parser,
> and show me the title mapping before writing. Take a fresh backup first if any existing recipe
> is going to be deleted.

### C. Re-running the browser test pass

> Walk me through `docs/TEST-PLAN.md` again. The full pass was completed 21 Sep, so this is a
> regression run rather than a first verification — worth doing after any change to `hydrate()`,
> the write queue, or anything the plan's expected counts depend on. Re-read those counts from
> the database first; they go stale every time the library changes.

### D. Re-running the image sweep

> I've added recipes since the last sweep and their images are still on the source sites. Re-run
> `rehost-images` — it's idempotent, so anything already self-hosted is skipped. Check the dry
> run's byte counts for outliers first: one Contentful image was 7.7 MB until it was asked to
> resize, which was more than the rest of the library put together.

### E. Phase 3 (step 5)

> Let's plan Phase 3: the food diary (H1, H2, H3), dated cooking notes (R4), and the calendar push
> (P3). All are in `docs/BUILD-BRIEF.md` with reference codes; none has been started. §1 and §4 of
> the handover cover what's decided.

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

Unchanged — keep using `converter/conversion-instructions.md` as it stands. It was reviewed on
14 Sep against the app's real parser and needs no edits.

**One thing worth adding to your conversion chat**, since the output now goes straight into the
database rather than being pasted through the app's form one at a time:

> These conversions are being ingested directly into the app's database, so the fenced code block
> is the data, not just a preview. Give each recipe as its own fenced code block starting `TITLE:`.
> Don't abbreviate, summarise or omit anything after presenting it.
