# Kitchen App — Handover

**Written 14 Sep 2026.** Every claim below was verified against the running code, the live
database, or GitHub Actions at the time of writing — not copied from an earlier status note.
That distinction matters: an earlier task list recorded two things as "completed" that turned
out not to be, which is what prompted this audit.

Work lives on branch `claude/recipe-app-supabase-0z139o` in both repos.

Repo URLs, the Supabase project/org, connection details and the secrets policy all live in
`docs/INFRASTRUCTURE.md` — read that first if you're picking this up without prior context.

---

## 1. Where things stand, against the Build Brief's own codes

The Build Brief assigns a reference code to every requirement. This is all of them, with
verified status. **Nothing here is inferred from a previous summary.**

### Settings

| | Item | Status |
| --- | --- | --- |
| S1 | Week start day | **Done.** Settings screen, default Friday, drives Planner, Shopping List and History together. |
| S2 | Dark mode | **Deliberately deferred** out of Phase 2. A `dark_mode` column exists on `household_settings`, unused. The CSS is token-driven (19 tokens), so it's a small job when wanted. |
| S3 | Aliases manager | **Done.** Settings → Word Matches. Covers source *and* ingredient names, both "same" and "not the same" answers, all reversible. |

### Planner

| | Item | Status |
| --- | --- | --- |
| P1 | Servings + scale on the card | **Done.** Per-entry headcount, stored in a parallel `servings smallint[]` on `planner_days`, feeds that week's shopping list. |
| P2 | Total time on cards | **Done, verified.** Planner rows (`day-recipe-time`) and Shortlist cards (`course · time`). This one was inherited, not built — confirmed present rather than assumed. |
| P3 | Automatic calendar push | **Not started. Never appeared in any task list.** Phase 3 in the brief's own build order. Needs a Supabase Edge Function holding a Google OAuth refresh token — see §4. |

### Recipe viewing & editing

| | Item | Status |
| --- | --- | --- |
| R1 | Reset ticked ingredients/stages | **Done.** Ticks are keyed to flow geometry, so they survive a rescale; RESET TICKS clears in place without re-rendering. Session-only by design. |
| R2 | Auto-collapsing sidebar | **Done.** Collapses over both Viewers at 861–1180px, peek tab restores it, navigating away resets it. Mobile untouched. |
| R3 | Group Viewer parity | **Done, with two conscious omissions.** Delivered: Keep Awake, Favourite, Edit, Export PNG, Print, Reset Ticks, plus **OPEN →** per recipe. Omitted on purpose: *Shortlist* (contradictory for something already planned) and a *group-level Scale row* (no single base to scale from) — OPEN → covers both. **Worth confirming you're happy with that reading**, since the brief lists both as gaps to close. |
| R4 | Dated cooking notes | **Not started.** Phase 3. The `recipe_notes` table already exists, empty and unreferenced by the app — it was created in Phase 1 anticipating this. Not dead schema; just early. |
| R5 | Scale by servings | **Done.** Multiplier buttons retired everywhere. Viewer reads `SERVES 6 (SCALED FROM 4)`. |
| R6 | Servings mandatory | **App side done, library retrofit outstanding.** Save is blocked without servings. But **23 of 40 recipes still have none** — the retrofit rides on the reprocess. See §3. |
| R7 | Recipe images | **Not started. Bucket only.** See §2 — this is the gap that prompted the audit. |

### Shopping list

| | Item | Status |
| --- | --- | --- |
| SL1 | Unit handling | **Done.** Totals in a base unit, displayed as g/ml under 1000 and kg/L at 1000+. Metric only, never mixed systems. |
| SL2 | Ingredient name matching | **Done.** Prep words ignored when matching (with `ground` deliberately excluded — ground coriander is seed, coriander is leaf). Prompts capped at 3 per visit, both answers remembered. |
| SL3 | Show/hide checked items | **Done.** |
| SL4 | Reset ticks | **Done.** Scoped per mode, so clearing one list doesn't clear the other. |
| SL5 | Week selection | **Done.** This Week / Next Week / Both Weeks, with combined-mode ticks stored separately. |

### History & food diary

| | Item | Status |
| --- | --- | --- |
| H1 | Meal type at point of logging | **Not started.** Phase 3. |
| H2 | Ad-hoc entries | **Not started.** Phase 3. |
| H3 | CSV export | **Not started.** Phase 3. |

### Converter & conversion instructions

All instruction-side work is complete in `converter/conversion-instructions.md`. The **data**
retrofit for each is pending the reprocess — the instructions changed, the existing library
hasn't caught up yet.

| | Item | Instructions | Library data |
| --- | --- | --- | --- |
| C1 | Extract equipment | Done | **39 of 40 recipes have no equipment**; 0 have an `EQUIPMENT:` line |
| C2 | Capture source URL | Done | **0 of 40 have a source URL** |
| C3 | Guarantee bracket timings | Done | **296 of 302 MERGE lines have no duration**; 39 of 40 recipes have none at all |
| C4 | Servings mandatory + fallback | Done | 23 of 40 missing |
| C5 | Consistent phrasing | Done | — |
| C6 | Standardised units | Done | — |
| C7 | Test set and audit | Done | 5 tests in `converter/test-set.md`, plus two library audits |

### Architecture

| Item | Status |
| --- | --- |
| Hosting (GitHub Pages) | **Correction (14 Sep, this pass) — likely live, not "nothing deployed" as previously stated here.** The repo's own settings report Pages as configured (`has_pages: true`), and the default branch is `main` — which still holds the pre-Supabase, localStorage-only app. The Claude Code sandbox has no route to `github.io` to confirm the page's actual content, so **check `https://crispy-lettuce.github.io/RecipeFlowKeeper/` in a browser** before assuming either way. If it's live, anyone with the URL can reach the old app (though not your Supabase data — that's a separate login). See `docs/INFRASTRUCTURE.md` for the full repo/Pages picture. |
| Backend (Supabase) | **Done.** 13 tables, RLS enabled with policies on every one. |
| Household id on every table from day one | **Done, verified.** |
| Backup to a separate private repo | **Done and genuinely working.** See §5. |
| Images in Supabase Storage | **Not done** — see §2. |
| Calendar reminders | **Not done** — P3, see §4. |

### Brief's own open items

- *"Confirm whether the repo serving Pages is public"* — **resolved.** `RecipeFlowKeeper` is public;
  backups go to the private `PrivateBackup`. A `.gitignore` keeps `*.sql` and `kitchen-backup-*.json`
  out of the public repo.
- *"Multi-tenant households: the data model should anticipate it"* — **done.**

---

## 2. The image gap (R7) — what's actually true

This is the one that prompted the audit, and it's worth being precise about because the
earlier record was misleading.

**What exists:** a Supabase Storage bucket named `recipe-images`, created 13 Sep, **private**,
**completely empty — zero objects ever uploaded**.

**What doesn't exist:** any code at all. `index.html` contains no reference to Supabase Storage —
no upload, no signed URL, nothing. All 33 recipes that have an image point straight at the
source website. 7 have no image.

An old task read "Create Storage bucket recipe-images — completed", which was true of the
bucket and false of the feature. R7 in the brief is the actual requirement, and it was never
tracked as a task.

**Agreed approach (14 Sep):** a Supabase **Edge Function** does the fetching server-side.
A browser-side fetch was rejected because most recipe-site CDNs (Sanity, Cloudinary, WordPress)
don't send permissive CORS headers, so reading the bytes would fail for many sources.

**Agreed shape:** a **decoupled sweep**, not wired into the save path. Recipes save with
whatever `image_url` they arrive with; separately, a job walks the table, finds externally
hosted images, re-hosts them, and rewrites the column. Reasons: it treats the existing 33 and
any future recipe identically with no special-casing, and it keeps "did my recipe save" from
depending on a third-party fetch succeeding.

**Still undecided:** whether to flip the bucket public (recommended — a recipe photo isn't
sensitive, and a signed URL that expires would need re-signing everywhere `image_url` renders:
card grid, Viewer, Group Viewer, PNG export) or keep it private with signed URLs.

**Note for whoever builds it:** the Claude Code sandbox has no outbound access to fetch
arbitrary web images. An Edge Function has its own egress and isn't subject to that, which is
part of why it's the right home for this.

---

## 3. Immediate next task: ingesting the reprocessed recipes

The library is being reprocessed against the revised conversion instructions, landing at
roughly 33 recipes. Older recipes that aren't carried forward can be dropped — confirmed.

**Agreed method: update in place, by title match.**

| Case | Action |
| --- | --- |
| New recipe's title matches an existing one | **UPDATE** that row's `source`, `source_url`, `image_url`, `time_text`, `servings`, `equipment`, `tags`, `syntax`. Leave `id`, `household_id`, `favourite`, `date_added` alone. |
| No match | **INSERT** with a fresh UUID, `date_added` = today. |
| Existing recipe with no counterpart in the new set | **DELETE**, once the new set is confirmed in. |

**Why update rather than wipe and reseed:** `recipe_logs.recipe_id` is `ON DELETE CASCADE`, so
deleting a recipe row destroys its cooking history — 125 log entries are at stake. Keeping the
same `id` also keeps Planner assignments and meal groups pointing at something real;
`planner_days.recipe_ids` and `meal_groups.recipe_ids` are plain `uuid[]` with no FK, so a
delete-and-reinsert would leave them showing "Recipe removed" placeholders.

`shortlist_items.recipe_id` is `ON DELETE SET NULL` — a dropped recipe leaves the shortlist
entry as plain text. Harmless.

**Format to hand over:** exactly what the conversion prompt's *Present* step already produces —
one fenced code block per recipe, starting `TITLE:`. No reformatting needed. Prose around the
block is ignored. Every block needs `SOURCE:` and a numeric `SERVINGS:`; anything missing those
gets held back and reported rather than guessed at.

**Before writing anything:** parse each block with the app's real `parseRecipe`, lay it out with
`computeColumns` to catch structural errors, and show the proposed old→new title mapping for
confirmation — a near-miss title match could pair the wrong two recipes or silently create a
duplicate.

---

## 4. Calendar push (P3) — never tracked, not started

Phase 3 in the brief. Recorded here because it appears in no task list anywhere and would
otherwise be forgotten.

The brief's decided mechanism: a Supabase Edge Function holds a Google OAuth refresh token,
obtained through a one-off consent screen (expect an "unverified app" warning — normal for a
personal project). After that, reminders are created automatically. Opt-in per planner entry.

This explicitly **supersedes** the earlier downloadable `.ics` idea, which is in the brief's
"deliberately dropped" list so it doesn't quietly reappear.

---

## 5. Backups — working, with one fragility

**Verified working.** `.github/workflows/backup-supabase.yml` in `PrivateBackup` runs daily at
04:00 UTC. The scheduled run on 14 Sep at 04:07 completed successfully on its own. Two real
dumps are committed, ~87 KB each.

Getting there took three goes — the direct connection is IPv6-only and GitHub runners have no
IPv6 route (fixed by using the **Session pooler**), and the runner's own `pg_dump` is older than
the server (fixed by calling `/usr/lib/postgresql/17/bin/pg_dump` by full path). Both are
documented in `PrivateBackup/README.md`; don't undo either.

**The fragility:** `PrivateBackup` has exactly one branch — `claude/recipe-app-supabase-0z139o` —
which is therefore its default branch, which is why the schedule fires. Renaming or deleting it
during a tidy-up would silently stop backups. Worth renaming to `main` deliberately at some
point, and confirming the schedule still fires afterwards.

---

## 6. Corrections to the earlier record

Two tasks were marked complete that were not:

- **"Create Storage bucket recipe-images"** — the bucket was created; the feature (R7) was never
  built. Restated in §2.
- **"Servings backfill pass"** — never happened. 23 of 40 recipes still have no servings. It
  rides on the reprocess.

And these brief items appeared in **no** task list at all: **P3** (calendar), **R4** (cooking
notes), **R7** (images), **H1/H2/H3** (history and food diary). All are Phase 3 in the brief's
own build order, so they're not overdue — but they were invisible, which is the real problem.

---

## 7. Testing

`test/` holds an offline harness: `build.js` bakes `index.html` against a fake Supabase,
`smoke.js` runs **97 checks** across every screen, `shots.js` captures screenshots.

```sh
npm install playwright
node test/build.js && node test/smoke.js
```

**What it does not cover:** sign-in, hydration, row-level security and the background write
queue are all stubbed. A green run is not a substitute for opening the real app. Keep Awake
can't be tested outside a real tablet.

**Still outstanding:** the full browser pass has never been run. `docs/TEST-PLAN.md` has the
checklist. The riskiest step is signing out and back in — any exception during hydration signs
you straight back out, so the failure mode is a login screen you can't get past.

---

## 8. Facts worth not rediscovering

- Supabase project ref: `mhkayefzrtceesgizkjs`. The publishable key is in `index.html` and is
  meant to be public. **The service-role key and database password must never appear in chat
  or the repo.**
- `RecipeFlowKeeper` is **public** — recipe, planner and diary data must never be committed there.
- Every `load*`/`save*` in the app is **synchronous**; writes queue in the background via
  `queueWrite`, which always returns `true` immediately.
- Any exception inside `hydrate()` signs the user out. `household_settings` must use
  `.maybeSingle()`, not `.single()`, for exactly this reason.
- `[instant]` and `[overnight]` are real duration keywords the parser now understands. Any
  other unrecognised bracket (`[to taste]`) is deliberately left intact in the label.
