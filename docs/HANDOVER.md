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
| R2 | Auto-collapsing sidebar | **Done, extended 21 Sep.** Collapses over both Viewers at 861–1180px, peek tab restores it, navigating away resets it. **Also collapses at any width while Keep Awake is on** — a statement that cooking is happening now beats a guess from the window size. Peek tab still offered, so it cannot strand you. |
| R3 | Group Viewer parity | **Done, with two conscious omissions.** (Its PNG export truncated to one screenful until 21 Sep — see §7.) Delivered: Keep Awake, Favourite, Edit, Export PNG, Print, Reset Ticks, plus **OPEN →** per recipe. Omitted on purpose: *Shortlist* (contradictory for something already planned) and a *group-level Scale row* (no single base to scale from) — OPEN → covers both. **Worth confirming you're happy with that reading**, since the brief lists both as gaps to close. |
| R4 | Dated cooking notes | **Not started.** Phase 3. The `recipe_notes` table already exists, empty and unreferenced by the app — it was created in Phase 1 anticipating this. Not dead schema; just early. |
| R5 | Scale by servings | **Done.** Multiplier buttons retired everywhere. Viewer reads `SERVES 6 (SCALED FROM 4)`. |
| R6 | Servings mandatory | **Done, both sides, 20 Sep.** Save is blocked without servings, and all 33 recipes now carry one. The retrofit rode on the reprocess, as planned. |
| R7 | Recipe images | **Done, 21 Sep.** All 29 images self-hosted in Supabase Storage via a decoupled Edge Function sweep. See §2. |

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
| C1 | Extract equipment | Done | **Done, 20 Sep.** 8 of 33 carry an `EQUIPMENT:` line — the 8 that need a specific tin or basin. The other 25 need nothing size-specific. |
| C2 | Capture source URL | Done | **Done, 20 Sep.** 32 of 33. The one gap is Victoria Sandwich, deliberately left untouched — see §3. |
| C3 | Guarantee bracket timings | Done | **Done, 20 Sep.** 249 of 249 MERGE lines timed across the 32 ingested recipes; `[instant]` used 78 times. Every one of those recipes now renders a timeline. Was 6 of 302. |
| C4 | Servings mandatory + fallback | Done | **Done, 20 Sep.** 33 of 33. |
| C5 | Consistent phrasing | Done | — |
| C6 | Standardised units | Done | — |
| C7 | Test set and audit | Done | 5 tests in `converter/test-set.md`, plus three library audits — the third (20 Sep) re-runs them against the ingested library |

### Architecture

| Item | Status |
| --- | --- |
| Hosting (GitHub Pages) | **Live, verified 21 Sep.** Serving from `main` at `https://crispy-lettuce.github.io/RecipeFlowKeeper/`, confirmed by a browser screenshot and by the `pages build and deployment` workflow having one run per commit to `main`. **Every merge to `main` redeploys automatically** — there is no staging step. `main` holds the current build as of PR #2. Two earlier claims in this document were wrong and are corrected in `docs/INFRASTRUCTURE.md` §2: `main` was never the pre-Supabase app during this project, and "nothing is deployed" was never true. |
| Backend (Supabase) | **Done.** 13 tables, RLS enabled with policies on every one. |
| Household id on every table from day one | **Done, verified.** |
| Backup to a separate private repo | **Done and genuinely working.** See §5. |
| Images in Supabase Storage | **Done, 21 Sep** — 29 objects, 4.1 MB. See §2. |
| Calendar reminders | **Not done** — P3, see §4. |

### Brief's own open items

- *"Confirm whether the repo serving Pages is public"* — **resolved.** `RecipeFlowKeeper` is public;
  backups go to the private `PrivateBackup`. A `.gitignore` keeps `*.sql` and `kitchen-backup-*.json`
  out of the public repo.
- *"Multi-tenant households: the data model should anticipate it"* — **done.**

---

## 2. Recipe images (R7) — DONE, 21 Sep 2026

**All 29 images that existed are now self-hosted.** The library no longer depends on eleven
third parties continuing to serve the same URLs.

| | |
| --- | --- |
| Objects in `recipe-images` | 29 |
| Recipe rows pointing at Supabase | 29 of 29 with an image |
| Total storage | 4.1 MB |
| Rows pointing at a missing file | 0 |
| Orphaned objects | 0 |

Verified after the run, not assumed: every stored file's byte count matches what the dry run
had predicted for that recipe, which is what rules out a truncated download; every row resolves
to an object that exists; and nothing is stored that isn't a JPEG.

**How it works.** `supabase/functions/rehost-images/index.ts`, a decoupled sweep. Recipes save
with whatever `image_url` they arrive with; this walks the table separately, fetches anything
externally hosted, stores it at `<household_id>/<recipe_id>.<ext>`, and rewrites the column.
Idempotent — anything already self-hosted is skipped — so re-running after adding recipes is
safe and cheap. Invoke it from the app's console while signed in:

```js
await sb.functions.invoke('rehost-images', { body: { dryRun: true } });  // report only
await sb.functions.invoke('rehost-images', {});                          // do it
```

**The bucket is public**, with a 10 MB size limit and an image-only MIME allowlist. Public
affects exactly one thing: the `/object/public/` endpoint serves bytes without auth. Writes,
deletes and *listing* still go through the four RLS policies on `storage.objects`, which
require the first folder segment to be a household the caller belongs to — and
`private.household_ids_for_user()` is granted to `authenticated` only. So it is "readable if
you know the exact path", not browsable, and the paths are two random v4 UUIDs.

**Why public rather than signed URLs**, which the 14 Sep note left open: `image_url` is written
verbatim into the app's JSON export *and* into the nightly `pg_dump`. A signed URL would expire
inside the backups — restore one months later and every image is dead. That is a correctness
argument, not the convenience one originally recorded.

**Three things learned in the doing, worth not rediscovering:**

1. **The function needed a CORS preflight handler.** The app is on `github.io` and the function
   on `supabase.co`, so every browser call is cross-origin. Without it the request never
   reaches the function at all, and the error reads like a permissions problem. The preflight
   must be answered *before* the auth check, because it deliberately carries no `Authorization`
   header.
2. **A browser User-Agent is not optional.** Several CDNs answer a bare Deno fetch with 403.
   All 29 succeeded with one; expect failures without.
3. **One image was 7.7 MB** — 67% of the library on its own — because Contentful serves the
   original by default. Appending `?w=1600&q=80&fm=jpg` to that `image_url` before the sweep
   brought the whole library from 11.5 MB to 4.1 MB. Worth checking the dry run's byte counts
   for outliers before any future run.

**One cosmetic thing left:** Tuscan Chicken Pasta's image is 10 KB where its Kitchen Sanctuary
siblings are 130–200 KB, which suggests the reprocess captured a lazy-load placeholder rather
than the hero image. It is the same picture the cards showed before, so nothing regressed. Fix
by putting a better URL on that recipe and re-running the sweep.

---

## 3. Recipe ingestion — DONE, 20 Sep 2026

*This was step 1 of five. `docs/NEXT-SESSION.md` has the full order; the project is now at
step 2, the browser test pass.*

**Outcome: the library is 33 recipes, down from 40.** 27 rows updated in place, 5 inserted,
12 deleted. Cooking logs went 126 → 114: the 12 lost all belonged to deleted recipes, and
every log on a surviving recipe was kept, which is the whole reason for updating in place.

**Verified, not assumed.** After ingestion, every one of the 32 ingested recipes was checked
by md5 against the exact text the validator had passed — zero mismatches. That rules out
escaping or transport damage, which a spot-check of a few recipes would not have.

Known state afterwards: 33 of 33 have servings, 32 of 33 a source URL, 32 of 33 bracketed
durations, 8 carry equipment, 29 have an image. The single gap in each case is
**Victoria Sandwich**, left deliberately untouched — see the note below.

**Two things to know about what's in there now:**

- **Victoria Sandwich is the River Cottage one**, kept as it was on request. The reprocess
  offered a *Classic Victoria Sandwich* from BBC Good Food — a genuinely different recipe
  (different source, image, and yield), not a new version of the same one — so it was not
  ingested and the existing row was not deleted. That row therefore still has no source URL
  and no step timings. Reconverting the River Cottage page would close both.
- **8 planner slots and 2 meal groups now point at deleted recipes** and will render as
  "Recipe removed". Expected and accepted; clear them from the Planner when convenient.

**Two conversions carry a `⚠️ Source note` in their own syntax**, written by the converter
rather than by this ingestion: *No-Bake Chocolate Oat Bars* (allrecipes.com couldn't be
fetched, so it's reconstructed from a secondary reproduction) and *Lasagne Loaded Fries*
(poppycooks.com returned an access error, so it uses McCain's branded reproduction). Both are
worth a glance against the original page before cooking from them. *Cacao & Almond Oat Bar*
carries a note about two inconsistencies on the source page itself.

**The method used, for the record:**

| Case | Action |
| --- | --- |
| New recipe's title matches an existing one | **UPDATE** that row's `source`, `source_url`, `image_url`, `time_text`, `servings`, `equipment`, `tags`, `syntax`. Leave `id`, `household_id`, `favourite`, `date_added` alone. |
| No match | **INSERT** with a fresh UUID, `date_added` = today. |
| Existing recipe with no counterpart in the new set | **DELETE**, once the new set is confirmed in. |

**Why update rather than wipe and reseed:** `recipe_logs.recipe_id` is `ON DELETE CASCADE`, so
deleting a recipe row destroys its cooking history — 126 log entries were at stake, and 114
survived because only recipes with no counterpart were deleted. Keeping the
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
duplicate. `test/validate-recipes.js` does the parsing half; it calls the app's own functions
inside `app-under-test.html` rather than reimplementing them.

**One deviation from the column list above, made deliberately.** `title` was updated too. The
list omits it because it assumes an exact title match, but four of the 27 were renames
(*Creamy Cajun Prawn Pasta* → *Cajun Prawn Pasta*, and three others), and the app keeps the
`title` column and the syntax's own `TITLE:` line identical on every save — that's what
`withUpdatedTitleLine` is for. Leaving the column behind would have shown one name on the card
and another in the recipe's own flow table.

**A second deviation, same reasoning.** `image_url`, `time_text` and `equipment` were written
with `coalesce` rather than plain assignment, so a value already in the database is never
replaced by an empty one. The conversion instructions tell the converter to *omit* these when
it can't find them, so a missing line means "not found", not "there is none" — and *Viral
Parmesan Potatoes* had an image its new block didn't carry. A literal overwrite would have
thrown that away for nothing. A value that is present always wins.

**What a near-miss actually looked like.** Four pairs matched on nothing better than a partial
title, and all four turned out to be the same recipe renamed — confirmed by identical image
URLs, and in one case by the new `SOURCE_URL` still reading `/creamy-cajun-prawn-pasta/`. A
fifth, *Classic Victoria Sandwich* against *Victoria Sandwich*, looked just as close and was
two different recipes. Title similarity decided none of them; source and image did.

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
- **"Servings backfill pass"** — never happened at the time of writing; **done 20 Sep** via the ingestion. It
  rides on the reprocess.

And these brief items appeared in **no** task list at all: **P3** (calendar), **R4** (cooking
notes), **R7** (images), **H1/H2/H3** (history and food diary). All are Phase 3 in the brief's
own build order, so they're not overdue — but they were invisible, which is the real problem.

---

## 7. Testing

`test/` holds an offline harness: `build.js` bakes `index.html` against a fake Supabase,
`smoke.js` runs **102 checks** across every screen, `shots.js` captures screenshots.

```sh
npm install playwright
node test/build.js && node test/smoke.js
```

**What it does not cover:** sign-in, hydration, row-level security and the background write
queue are all stubbed. A green run is not a substitute for opening the real app. Keep Awake
can't be tested outside a real tablet.

**The full browser pass was completed on 21 Sep** — all 20 steps of `docs/TEST-PLAN.md`, against
the real backend, by a human in a browser. Sign-in, hydration, RLS and the write queue all
worked; sign-out-and-back-in, the path that had most worried this document, was clean; export
and import round-tripped with every table count intact.

**Two findings, both fixed the same day:**

- **PNG export captured only one screenful.** `.app` is `height:100vh; overflow:hidden`, so
  expanding the scrolling pane — which the 3 Aug fix already did — was never enough on its own;
  the shell went on cropping. Print was unaffected, because the print stylesheet unclips `.app`
  and the PNG path never did. It affected the Recipe Viewer and Shopping List exports too, not
  only the Group Viewer where it was noticed. Fixed by unclipping the shell for the duration of
  the capture, the same way print does, plus telling html2canvas the document is taller than the
  window. **Not reproducible in this sandbox** — the egress proxy blocks cdnjs, so html2canvas
  cannot load and `test/build.js` stubs it — so the fix was verified by a human, not by a test.
- **Keep Awake now collapses the sidebar at any width.** See R2.

**Two things the pass established that are worth not rediscovering:**

- A single favourite toggle rewrites the entire library. `saveRecipesList` → `pushList` upserts
  every recipe and then deletes any row not in the list. It behaved correctly against 33 rows,
  but it means a `hydrate()` that ever returned a partial library would have the next favourite
  delete the remainder. Worth remembering before changing anything in `hydrate()`.
- `shopping_checked.item_key` is the aggregation string, so the 20 Sep ingest re-keyed every
  possible tick. The ticked list was empty, so nothing broke — luck, not design. Clear the ticks
  before the next reprocess.

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
