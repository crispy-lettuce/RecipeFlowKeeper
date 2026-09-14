# What to do next, and in what order

Two things live here: **the order work should happen in**, with the reasoning, and a
**ready-to-paste prompt** for starting the next session.

For repo URLs, the Supabase project and where secrets live, see `docs/INFRASTRUCTURE.md` —
that document assumes no prior context at all, including no Claude Code session.

---

## The order

The sequence matters in three places. Everything else is preference.

### 0. Reprocess the recipes *(happening now, outside any session)*

Running the library back through `converter/conversion-instructions.md`, landing at roughly 33
recipes. Expected to produce, for the first time: servings on every recipe, bracketed durations
on every MERGE, equipment where it applies, and a source URL each.

### 1. Ingest the reprocessed recipes ← **start here**

Update in place by title match. Full method in `docs/HANDOVER.md` §3.

**Take a fresh backup first.** The nightly one runs at 04:00 UTC, so depending on the hour it
could be most of a day stale — and this step deletes the recipes not carried forward. Run the
workflow manually from the Actions tab of `crispy-lettuce/PrivateBackup` and wait for it to go
green before writing anything.

### 2. The browser test pass

`docs/TEST-PLAN.md`. Nothing in the Supabase rewrite has ever been confirmed working against the
real backend by a human in a browser.

**Why this comes after ingestion, not before:** the test plan exercises scaling, the timeline and
per-day servings — and on today's library those are largely untestable. 23 of 40 recipes have no
servings, so the scaling controls don't even appear on them, and 39 of 40 have no step timings,
so the timeline never renders. Testing against that library mostly proves that features correctly
hide themselves. After ingestion the same checklist actually exercises the features.

Ingestion doesn't depend on the app working — it goes in through SQL, not the UI — so there's no
risk in this order.

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

**Why after ingestion:** re-hosting images now would do the work against recipes about to be
replaced, and the reprocessed ones arrive with their own fresh `IMAGE:` URLs. It's server-side
work that doesn't need the app merged, so it can equally happen alongside step 3 — but not
before step 1.

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
  docs/HANDOVER.md         — verified status; §3 covers exactly this task
  docs/ARCHITECTURE.md     — how the app and its recipe format work
  docs/NEXT-SESSION.md     — the order of work; we are at step 1

THE TASK: ingest my reprocessed recipes into the database.

Before writing anything:

1. Tell me to trigger a fresh backup, and wait for me to confirm it went
   green. Manual run from the Actions tab of crispy-lettuce/PrivateBackup.
   This step deletes recipes and the nightly backup may be hours stale.

2. Validate every recipe I give you using the app's own parseRecipe and
   computeColumns — not a reimplementation — via the offline harness in
   test/. Hold back anything with structural errors, a missing SOURCE:, or
   a missing or non-numeric SERVINGS:. Report those rather than guessing.

3. Show me the proposed old-to-new title mapping and wait for my approval.
   I need to see which existing recipes will be updated, which are new, and
   which will be deleted. A near-miss title match could pair the wrong two
   or silently duplicate.

Then ingest, using the agreed method in docs/HANDOVER.md §3:

  - Title matches an existing recipe -> UPDATE that row's source,
    source_url, image_url, time_text, servings, equipment, tags and syntax.
    Leave id, household_id, favourite and date_added alone.
  - No match -> INSERT with a fresh UUID.
  - Existing recipe with no counterpart in the new set -> DELETE, but only
    once the new set is confirmed in.

This must be update-in-place, never delete-and-reinsert: recipe_logs
cascades on delete and would destroy 125 cooking-log entries, and the
planner and meal groups reference recipes by id.

Afterwards, report what changed, and re-run the checks in
converter/test-set.md against the new library — the previous audits found
missing durations, missing equipment and split ingredient lines that made
the shopping list buy double. I want to know whether the reprocess
actually fixed those.

Some context worth having:

  - index.html is the whole app. One file, no build step, no framework.
  - Run `node test/build.js && node test/smoke.js` after any code change.
    97 checks. It stubs Supabase, so it proves nothing about sign-in or
    the write queue.
  - The repo is public. Recipe data must never be committed to it.
  - Don't trust status notes, mine included, where you can check the real
    thing instead. Three separate audits found things recorded as done
    that weren't.

My recipes are below.

[paste the fenced code blocks — one per recipe, each starting TITLE:]
```

---

## Alternative starting points

If you want to do something other than step 1, swap the task section of the prompt above.

### B. The browser test pass (step 2)

> Nothing has ever been tested against the real backend — sign-in, hydration, row-level security
> and the write queue are all unverified. Walk me through `docs/TEST-PLAN.md`. I'll run it locally
> and report back. Start by telling me how to get the branch running. Note the export/import trap:
> the export at step 19 must be taken after any recipe ingestion, not before.

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
