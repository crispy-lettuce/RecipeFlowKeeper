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

### 3. Merge to `main` and go live ← **start here**

Option C below. This is the moment the Supabase rewrite reaches the tablet, and the moment the
GitHub Pages site changes. **Step 2 is done, so the blocker on this is gone.**

One thing to confirm first, still unverified: what `https://crispy-lettuce.github.io/RecipeFlowKeeper/`
currently serves. `docs/INFRASTRUCTURE.md` §2 flags it as unchecked from any sandbox.

Also the moment the documentation becomes visible on the repo's default branch. Everything
currently lives only on `claude/recipe-app-supabase-0z139o`.

### 4. Image re-hosting (R7)

`docs/HANDOVER.md` §2. An Edge Function, run as a decoupled sweep.

**Why after ingestion:** re-hosting images beforehand would have done the work against recipes
about to be replaced. Ingestion has happened, so this is now unblocked: **29 of the 33 recipes
have an image and every one of them is hosted on the source website**, with the
`recipe-images` bucket still holding zero objects. It's server-side work that doesn't need the
app merged, so it can equally happen alongside step 3.

### 5. Phase 3, and anything left

No dependencies between these; pick by appetite.

- **H1–H3** — meal type at logging, ad-hoc diary entries, CSV export
- **R4** — dated cooking notes (the `recipe_notes` table already exists for it)
- **P3** — automatic calendar push, needing a one-off Google consent
- **S2** — dark mode, deferred out of Phase 2; small, since the CSS is already token-driven

---

## The prompt for the next session

Copy everything in the block below.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper, on branch claude/recipe-app-supabase-0z139o.
Please read these first, in this order:

  docs/DOCUMENT-INDEX.md   — the map of all documentation
  docs/HANDOVER.md         — verified status
  docs/INFRASTRUCTURE.md   — repos, Pages, Supabase, secrets policy
  docs/NEXT-SESSION.md     — the order of work; we are at step 3

THE TASK: merge to main and go live.

main already serves an OLDER BUILD of the Supabase app — it is not the
pre-Supabase one the docs claimed until 21 Sep, and PR #1 put the rewrite
there at some earlier point. So this is an update of a deployed app, not a
first deployment. It is still the moment the current code reaches the
tablet I cook from.

Both blockers are now cleared: the library was reprocessed and ingested on
20 Sep (33 recipes), and the full 20-step browser test pass was completed
on 21 Sep against the real backend.

Before merging, tell me what could go wrong, and in particular:

1. Confirm what https://crispy-lettuce.github.io/RecipeFlowKeeper/ is
   actually serving right now. docs/INFRASTRUCTURE.md §2 flags this as
   unverified — no sandbox has been able to reach github.io to check. If
   it is live, it is currently the old app, publicly reachable.
2. Tell me whether merging changes what that URL serves, and whether I
   want it to.
3. Whether main should become the default branch for future work, and what
   that means for the odd branch naming across both repos.

Do NOT touch PrivateBackup's default branch — it is
claude/recipe-app-supabase-0z139o, and that is why the nightly backup
fires. Renaming it silently stops backups.

Some context worth having:

  - index.html is the whole app. One file, no build step, no framework.
    Run `node test/build.js && node test/smoke.js` after any code change.
    102 checks. It stubs Supabase, so it proves nothing about sign-in.
  - The repo is public. Recipe data must never be committed to it.
  - Don't trust status notes, mine included, where you can check the real
    thing instead.
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

### D. Image re-hosting (step 4)

> Let's build the image re-hosting Edge Function in `docs/HANDOVER.md` §2. The approach is
> decided: server-side fetch, because browser-side fails CORS on most recipe CDNs, run as a
> decoupled sweep rather than wired into the save path. One thing still open — whether to make the
> `recipe-images` bucket public or keep it private with signed URLs. Give me your recommendation
> and reasoning before building.

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
