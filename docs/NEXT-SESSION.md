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

### 2. The browser test pass ← **start here**

`docs/TEST-PLAN.md`. Nothing in the Supabase rewrite has ever been confirmed working against the
real backend by a human in a browser.

**Why this came after ingestion, not before:** the test plan exercises scaling, the timeline and
per-day servings, and on the old library those were largely untestable — 23 of 40 recipes had no
servings, so the scaling controls never appeared, and 39 of 40 had no step timings, so the
timeline never rendered. Testing against that library would mostly have proved that features
correctly hide themselves.

**That is no longer true, so this step is now worth real effort.** All 33 recipes have servings
and 32 have full step timings, so the scaling controls and the timeline strip appear everywhere
and the checklist genuinely exercises them. Nothing in the Supabase rewrite has still ever been
confirmed working against the real backend by a human in a browser — and the offline harness
stubs Supabase entirely, so the 97 checks say nothing about it.

> **One trap.** Test plan steps 19–20 export the data and import it straight back, and the import
> **rewrites everything**. Take that export *after* ingestion. An export taken beforehand, imported
> afterwards, would wipe the entire reprocessed library.

### 3. Merge to `main` and go live

Option D below. This is the moment the Supabase rewrite reaches the tablet, and the moment the
GitHub Pages site changes. Don't do it before step 2 — that would put never-verified code on the
device you actually cook from.

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
  docs/HANDOVER.md         — verified status; §3 records what the last
                             session did and the two deviations it made
  docs/ARCHITECTURE.md     — how the app and its recipe format work
  docs/NEXT-SESSION.md     — the order of work; we are at step 2
  docs/TEST-PLAN.md        — the checklist for this task

THE TASK: the browser test pass, against the real backend.

Nothing in the Supabase rewrite has ever been confirmed working by a human
in a browser. Sign-in, hydration, row-level security and the background
write queue are all stubbed by the offline harness, so its 97 green checks
say nothing about any of them. I'll run the steps locally and report back.

Start by telling me how to get the branch running, then walk me through
docs/TEST-PLAN.md a few steps at a time rather than all at once.

Things to know before we start:

  - The riskiest step is signing out and back in. Any exception inside
    hydrate() signs the user out, so the failure mode is a login screen I
    can't get past. If that happens, treat it as the priority.
  - TRAP: test plan steps 19-20 export the data and import it straight
    back, and the import rewrites everything. The export must be taken
    now, after the recipe ingestion — an older export imported today would
    wipe the whole reprocessed library.
  - The library is 33 recipes as of 20 Sep. All have servings and 32 have
    full step timings, so the scaling controls and the timeline strip
    should now appear on nearly everything. On the old library they were
    mostly invisible, so if either fails to render, that's a real bug and
    not the library being sparse.
  - 8 planner slots and 2 meal groups point at recipes deleted during
    ingestion and will show "Recipe removed". That's expected, not a bug.
  - index.html is the whole app. One file, no build step, no framework.
    Run `node test/build.js && node test/smoke.js` after any code change.
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

### C. Going live (step 3)

> The branch has never been deployed — `main` still serves the pre-Supabase app. Let's merge
> `claude/recipe-app-supabase-0z139o` and confirm Pages is serving it. This is the go-live moment
> for the whole Supabase migration, so tell me what could go wrong first. Also confirm what the
> Pages site is currently serving — `docs/INFRASTRUCTURE.md` §2 flags this as unverified.

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
