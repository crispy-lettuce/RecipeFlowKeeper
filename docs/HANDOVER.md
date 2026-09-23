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
| S2 | Dark mode | **Done, 22 Sep.** Three states per the brief. The column was already read and written by `hydrate()`/`saveSettings`; what was missing was applying it. See §2a. |
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
| R7 | Recipe images | **Done, 21 Sep.** All 29 images self-hosted in Supabase Storage via an Edge Function. Automatic on save since 22 Sep. See §2 and §2d. |

### Shopping list

| | Item | Status |
| --- | --- | --- |
| SL1 | Unit handling | **Done.** Totals in a base unit, displayed as g/ml under 1000 and kg/L at 1000+. Metric only, never mixed systems. |
| SL2 | Ingredient name matching | **Done.** Prep words ignored when matching (with `ground` deliberately excluded — ground coriander is seed, coriander is leaf). Prompts capped at 3 per visit, both answers remembered. **Reviewed 22 Sep against the real library** (`docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md`): works, but 274 rows for 168 real items; the household chose the review's full plan on 23 Sep. Step 1, the quantity reader (mixed numbers, ranges, `up to`, `3 x 400 g`), is built on a branch; the rest is not started. |
| SL3 | Show/hide checked items | **Done.** |
| SL4 | Reset ticks | **Done.** Scoped per mode, so clearing one list doesn't clear the other. |
| SL5 | Week selection | **Done.** This Week / Next Week / Both Weeks, with combined-mode ticks stored separately. |

### History & food diary

| | Item | Status |
| --- | --- | --- |
| H1 | Meal type at point of logging | **Done, 22 Sep.** One tap after the log is saved, never before it. See §2b. |
| H2 | Ad-hoc entries | **Done, 22 Sep.** `recipe_logs` rows with a null `recipe_id` and their own `title`. See §2b. |
| H3 | CSV export | **Done, 22 Sep.** The brief's columns verbatim, quantities stripped. See §2b. |

### Converter & conversion instructions

All instruction-side work is complete in `converter/conversion-instructions.md`. The **data**
retrofit for each is pending the reprocess — the instructions changed, the existing library
hasn't caught up yet.

| | Item | Instructions | Library data |
| --- | --- | --- | --- |
| C1 | Extract equipment | Done | **Done, 20 Sep.** 8 of 33 carry an `EQUIPMENT:` line — the 8 that need a specific tin or basin. The other 25 need nothing size-specific. |
| C2 | Capture source URL | Done | **Done, 20 Sep.** 32 of 33. The one gap is Victoria Sandwich, deliberately left untouched — see §3. |
| C3 | Guarantee bracket timings | Done | **Done, 20 Sep.** 242 of 242 MERGE lines timed across the 32 ingested recipes; `[instant]` used 78 times. (Recorded as "249 of 249" until a 22 Sep audit counted it: the library holds 250 MERGE lines, 8 of them in Victoria Sandwich, the one recipe deliberately left unconverted.) Every one of those recipes now renders a timeline. Was 6 of 302. |
| C4 | Servings mandatory + fallback | Done | **Done, 20 Sep.** 33 of 33. |
| C5 | Consistent phrasing | Done | — |
| C6 | Standardised units | Done | — |
| C7 | Test set and audit | Done | 5 tests in `converter/test-set.md`, plus three library audits — the third (20 Sep) re-runs them against the ingested library |

### Architecture

| Item | Status |
| --- | --- |
| Hosting (GitHub Pages) | **Live, verified 21 Sep.** Serving from `main` at `https://crispy-lettuce.github.io/RecipeFlowKeeper/`, confirmed by a browser screenshot and by the `pages build and deployment` workflow having one run per commit to `main`. **Every merge to `main` redeploys automatically** — there is no staging step. `main` holds the current build as of PR #5 (22 Sep). Two earlier claims in this document were wrong and are corrected in `docs/INFRASTRUCTURE.md` §2: `main` was never the pre-Supabase app during this project, and "nothing is deployed" was never true. |
| Backend (Supabase) | **Done.** 13 tables, RLS enabled with policies on every one. |
| Household id on every table from day one | **Done, verified.** |
| Backup to a separate private repo | **Done and genuinely working.** See §5. |
| Images in Supabase Storage | **Done, 21 Sep** — 29 objects, 4,426 kB. See §2. |
| Calendar reminders | **Not done** — P3, see §4. |

### Brief's own open items

- *"Confirm whether the repo serving Pages is public"* — **resolved.** `RecipeFlowKeeper` is public;
  backups go to the private `PrivateBackup`. A `.gitignore` keeps `*.sql` and `kitchen-backup-*.json`
  out of the public repo.
- *"Multi-tenant households: the data model should anticipate it"* — **done.**

---

## 2. Recipe images (R7) — DONE, 21 Sep 2026; integrity checking added 22 Sep

**All 29 images that existed are now self-hosted.** The library no longer depends on eleven third
parties continuing to serve the same URLs — Kitchen Sanctuary alone held seventeen.

**`docs/IMAGES.md` is the runbook** — how a new recipe's image gets to Supabase, how to replace
one, what goes wrong and how to verify. Read that rather than this. What follows is only the
status and the decisions.

| | |
| --- | --- |
| Objects in `recipe-images` | 29 |
| Rows self-hosted | 29 of 29 with an image (4 recipes have none) |
| Total storage | 4,426 kB |
| Dangling rows / orphaned files / syntax disagreements | 0 / 0 / 0 |
| Verified whole | 29 of 29, by `{"verify": true}` on 22 Sep |

**It is automatic since 22 Sep — see §2d.** When this section was written it was not: a sweep had
to be run by hand from the browser console, and the reason recorded for that was "saving a recipe
should not depend on a third party's server answering". That constraint is real and still holds;
what nobody had noticed is that it rules out re-hosting *synchronously*, not automatically.

**Verified rather than reported:** every row resolves to an object that exists; no orphans; nothing
stored that isn't a JPEG; every stored file passes the integrity checks in `docs/IMAGES.md` §2.
*(This paragraph used to lead with "every stored file's byte count matches what the dry run
predicted", which is in the corrections table below as a check that cannot detect the fault it
claims to.)*

### Decisions worth not relitigating

**Public bucket, not signed URLs** — the one thing the 14 Sep plan left open, and settled on
different grounds than it anticipated. `image_url` is written verbatim into the app's JSON export
*and* the nightly `pg_dump`, so a signed URL would expire inside the backups: restore one months
later and every image is dead. Correctness, not convenience. Public affects only the
`/object/public/` read endpoint; writes, deletes and listing still go through household-scoped RLS,
so it is "readable if you know the path", not browsable, and paths are two random v4 UUIDs.

**A sweep, not the save path** — one code path for the existing library and everything added since,
and a browser could not do it anyway, because most recipe CDNs send no permissive CORS headers.
*(The CORS half still holds. The first half was superseded on 22 Sep: the save path now asks the
same function for one recipe, and the sweep is kept as the catch-up — §2d.)*

### Four things that cost time, and would again

1. **The function needed a CORS preflight handler.** The app is on `github.io`, the function on
   `supabase.co`, so every browser call is cross-origin. Without it the request never reaches the
   function and the error reads like a permissions problem. The preflight must be answered *before*
   the auth check, because it carries no `Authorization` header by design.
2. **A browser User-Agent is not optional.** Several CDNs answer a bare Deno fetch with 403. All 29
   succeeded with one.
3. **One image was 7.7 MB** — more than the rest of the library combined — because Contentful serves
   originals by default. One URL parameter took the library from 11.5 MB to 4.1 MB (4,426 kB today,
   after two images were replaced with whole ones). **Check the dry
   run's byte counts for outliers before any future sweep.**
4. **Two defects found while documenting it, both fixed the same day.** Objects are cached for a
   year at a stable path, so replacing a photo would have shown the *old* one until 2027 — fixed
   with a `?v=<unix seconds>` token that changes the URL without changing the path. And the sweep
   rewrote `image_url` but not the `IMAGE:` line in `syntax`, which broke the invariant in
   `ARCHITECTURE.md` §2 that the recipe text is the source of truth — it meant re-parsing a recipe
   would silently revert its image to the CDN. The sweep now moves both, and the 29 already done
   were backfilled.

**Both broken images are fixed, and the diagnosis they came with was wrong twice.** Tuscan
Chicken Pasta was recorded here as a lazy-load placeholder. It was not: it was a truncated JPEG,
which rendered as a photo on the top 40% of the card and solid grey below. Chasing that turned up a
second one nobody had noticed — Classic Scones, cut off mid-transfer at exactly 35 × 1024 bytes.

Both now carry whole files (257,931 and 35,613 bytes) and a full verify sweep reports 29 of 29
whole. The Scones replacement is *smaller* than the file it replaced, which is the tell: the broken
copy had been padded to a block boundary.

**The lesson is about the verification, not the images.** Two checks were written and shipped
before one worked. The first compared the stored byte count against the dry run's — but both reads
fetch the same source, so a file broken at source yields two identical counts and a clean bill of
health. The second checked for the JPEG end marker — but that marker was present; what had run out
early was the scan data. Neither failure was bad luck; both were reasoning that could not have
caught the fault. `docs/IMAGES.md` §2 has the full account and the measured density distribution
the current threshold rests on. `test/image-integrity.js` pins all three checks.

---

## 2a. Dark mode (S2) — DONE, 22 Sep 2026

Three states, per the Build Brief: follow the system, light, or dark. The control is in
Settings under APPEARANCE, and the choice is shared with the household like every other
setting there.

**Half of it already existed and nobody had noticed.** `household_settings.dark_mode` was
being read by `hydrate()` into `state.settings.darkMode` and written back by `saveSettings`,
with a comment explaining it was round-tripped so a later phase wouldn't be clobbered. So
persistence was built *and* had been exercised by the 21 Sep test pass. What was missing was
everything downstream of the value: nothing ever read it.

**The estimate was wrong, and in an instructive way.** Every note said this was small
"because the CSS is token-driven". The CSS is 18 tokens — but there were also 8 hard-coded
`#fff`, 23 `rgba()` literals and, the part that mattered, **three colours living in
JavaScript**:

| | |
| --- | --- |
| `PALETTE` | six hues used as *text* on a 10% tint of themselves |
| `MERGE_COLOR` | `#5B2A4A`, the plum |
| `SINGLE_RECIPE_TIMELINE_COLOUR` | `#5B2A4A` again |

These are painted into inline styles at render time, because the flow table doesn't know how
many columns it has until it has parsed the recipe. No token swap can reach them, so there
are two palettes and `applyTheme` picks one.

Most of the `rgba()` literals turned out to be fine: an accent at 10% over *any* ground reads
as a tint of that accent. The ones that broke were the two that are surfaces rather than
tints, and those became `--card-veil`.

**`--on-accent` is the non-obvious token.** White works on every light-theme accent because
they are all dark. The dark theme lightens them to stay legible, and white stops working — so
the foreground that sits *on* an accent has to flip too.

**No flash of the wrong theme.** The household's choice is in Supabase, a round trip away, so
painting from it would show light and then snap to dark — worst in the dark, which is when it
is used. A boot script in `<head>` paints from a `localStorage` mirror before first paint;
`hydrate()` reconciles. The database stays the source of truth, the mirror is a cache of the
last known answer, and `applyTheme` is its only writer. A stale mirror costs one repaint.

**Three bugs were found by looking, not by reasoning**, and the pattern in them matters more
than any one of them. Each was a colour living in JavaScript rather than in a token:

| | what it did |
| --- | --- |
| `SINGLE_RECIPE_TIMELINE_COLOUR` | stayed dark while `--on-accent` flipped, giving dark-on-dark lane labels |
| `PIE_COLOURS` | dark plum slices on a dark history card |
| html2canvas `backgroundColor` | a cream border around dark content in every exported PNG |

The first two were caught by screenshots. The third was caught only by giving up on reading the
code and grepping the whole script for hex literals — which is what should have been done first,
and is the lesson worth keeping: **an exhaustive search beats a careful reading when the question
is "have I found all of them?"**

The export background is now read from the live `--paper` token rather than named, so it cannot
drift from the theme again, including from any theme added later.

Smoke coverage went from 102 to **116 checks**, each mutation-tested. What none of them can judge
is contrast on the real tablet in a real kitchen, which is the one thing worth a human eye.

---

## 2b. The food diary (H1, H2, H3) — DONE, 22 Sep 2026

Meal type at the point of logging, ad-hoc entries for things with no recipe card, and a CSV of
the lot. All three on one timeline, per the Build Brief.

**One table, not two.** Ad-hoc entries are `recipe_logs` rows with a null `recipe_id`. That seam
was already open: the column was nullable and both read paths already filtered on it, and the
comment at `logRecipeUsed` said outright that the food diary would build on these rows. The only
thing genuinely missing was somewhere to put an ad-hoc entry's name.

**`recipe_logs.title` was added rather than reusing `note`.** `note` is scaffolding for R4, which
applies to recipe-backed logs too; one column serving both would make "a takeaway called X" and
"a note about recipe Y" indistinguishable. A CHECK constraint
(`recipe_logs_identifies_something`) now requires every row to have either a recipe or a title, so
a nameless entry is unwriteable rather than merely unlikely. Verified by attempting one.

**`meal_type` already had its CHECK constraint** restricting it to breakfast/lunch/dinner/snack —
exactly H1's four. `MEAL_TYPES` in the app is the same list, and the buttons are generated from
it, so the UI and the database cannot drift.

**The prompt comes after the write, not before.** Logging happens by ticking the last column of
the flow table — the moment a meal ends, hands full. A dialog in front of that write would mean a
dismissed prompt loses the log entirely. So the entry lands immediately with `meal_type` null,
which is a legitimate state, and the prompt upgrades it. The id is generated client-side
precisely so the prompt can target a row whose insert is still in flight.

**`cache.diary` is new; `recipe.history` is untouched.** The bare date array still feeds the
cards, "last cooked" and the streak, where a list of dates is exactly right — and it is also the
shape the JSON export has always had. Enriching it would have rippled through all of those and
changed the export format. The richer view lives alongside it.

### The backup bug this closed

`replaceAllRecipeLogs` rebuilt every log from `recipes[].history` on a restore. That array holds
bare dates, so **restoring a backup would have silently erased every meal type and every ad-hoc
entry** — and looked like a clean restore. The export was the other half: it selected only rows
with a `recipe_id`, so a backup would have been missing the diary in the first place.

Both are fixed, and the fix has two paths on purpose:

| Backup | What happens |
| --- | --- |
| version 3 (has `diary`) | Replaces every log, ids, meal types and ad-hoc entries included |
| version 2 or older (no `diary`) | Replaces only recipe-backed rows, leaves ad-hoc entries alone |

An older backup says nothing about ad-hoc entries, and saying nothing is not the same as saying
there are none — so restoring one cannot destroy a diary it has never heard of.

### CSV

The Build Brief's columns verbatim: date, meal type, entry, source (recipe vs ad hoc), course,
ingredients without quantities. Quantities are dropped because they scale with servings, so a row
claiming "300 g" would be wrong more often than right; the ingredient names answer what the sheet
is for. Ad-hoc rows leave course and ingredients blank rather than "n/a", because a blank cell
filters correctly in a spreadsheet and "n/a" is a value you have to exclude by hand. Every field
is quoted (RFC 4180) and the file carries a BOM, since the likely destination is Excel, which
reads a BOM-less UTF-8 CSV as the system codepage and mangles every accent.

**Ingredient names are tidied for the CSV only**, by `tidyIngredientName`, which drops leading
count, container and size words: "cloves garlic" becomes "garlic", "large eggs" becomes "eggs",
"x 125 g tins tuna in olive oil" becomes "tuna in olive oil". 34 of the library's 424
quantity-bearing lines (8%) needed it — measured, not guessed.

**It is deliberately not fixed in `splitQty`, which is where it looks like it belongs.**
`splitQty`'s output feeds `buildShoppingList`, whose result *is* `shopping_checked.item_key`.
Teaching it a new unit would silently re-key every ticked item on the shopping list. The CSV is
the safe place for this because nothing is keyed on its output.

**The rule that makes it safe is "never strip the last word."** "cloves" is a unit in "2 cloves
garlic" and an ingredient in "1 tsp whole cloves" — the first loses it and becomes "garlic", the
second strips "whole" and stops. A list of known units alone would have destroyed the spice.
Mutation-tested: removing that rule fails three checks by name.

Smoke coverage **116 → 140 checks**. The two that matter most were mutation-tested: putting the
prompt before the write, and dropping `diary` from the backup, each produce named failures.

---

## 2c. Independent review — 22 Sep 2026

Two agents reviewed the app after the food diary shipped: one on code correctness, one on
whether the documentation matched reality. Both were read-only. They found things this session
had missed while declaring the same work finished, which is the point of running them.

### The finding that mattered most

**The documented test command exited 1, and one of its checks was vacuous.** `test/stub.js`
implemented `select/upsert/insert/delete` but not `update` — and `updateDiaryEntry` is the only
caller of `.update()` in the app. So the diary's meal-type write threw a TypeError, `queueWrite`
swallowed it, and the check passed anyway **because it asserted `loadDiary()`, the in-memory
cache, which is updated before the write is queued.**

That means H1's persistence write had never executed anywhere — not in the harness, not against
the real backend. And it went unnoticed because the result was being read by counting `ok` lines
instead of by the exit code.

The stub now implements `update` and records the patch and the `.eq()` target, so a test can
assert on the column names actually sent. A patch built with `mealType` instead of `meal_type`
would satisfy the cache and lose every meal type the household ever taps; that is now caught.

### Code fixes

| | |
| --- | --- |
| **Restore could destroy the diary** | `replaceAllDiary` deleted every log row and then inserted — two round trips, no transaction. Meal types and ad-hoc entries exist in no other table, so a failed insert was unrecoverable. Now upserts first and culls afterwards: a failure leaves the existing diary untouched |
| **Import left `cache.diary` stale** | `saveRecipesList` is synchronous, `replaceAllDiary` is queued. In between, an export would write a backup whose diary referenced recipes the file did not contain — which then triggered the row above on restore |
| **A failed insert followed by a silent update** | PostgREST returns no error for an update matching zero rows, so a failed log produced "Couldn't save" and then a cheerful "Tagged as lunch". Unsaved ids are tracked now |
| **`uid()`'s fallback was not a UUID** | `'r-' + Date.now() + ...` is rejected by a `uuid` column. It only ran on browsers without `crypto.randomUUID` — the old tablets nobody tests on — and failed silently |
| **CSV formula injection** | An entry named `=1+1` opened in Excel as the number 2. Quoting does not prevent it; a leading apostrophe does |
| **`escapeHtml` did not escape quotes** | The ad-hoc title reaches an HTML attribute, so a name containing `"` could break out of it |
| **AVIF was stored unverified** | Accepted by the MIME allowlist but matched no branch of the integrity check. Now walks the ISOBMFF box chain |
| **Selection highlight lost on ad-hoc days** | A CSS rule at equal specificity sat after `.selected` and won on source order |

### Test fixes

The CSV checks **reimplemented the exporter inside the test** and asserted against their own
output — every one would have passed with `exportDiaryCsv` deleted, and they had already drifted
(the test joined with `\n` where the app uses `\r\n`, and omitted the BOM). They now download
the real file. Two other checks asserted the absence of selectors the app has never used, or
collected data and never asserted on it.

Fixture data now includes a title that a spreadsheet would evaluate and one that would break out
of an HTML attribute, because without adversarial data those checks pass vacuously.

Smoke **148 → 157**, integrity **19 → 24**, every new check mutation-tested.

### What the review did not cover

Both agents ran against the stub and the database. Neither exercised sign-in, hydration or RLS
against the real backend — `docs/TEST-PLAN.md` is still the only thing that does, and the diary's
writes have not been through it.

---

## 2d. Automatic image re-hosting (IMAGES.md §5 Option A) — DONE, 22 Sep 2026

Adding a recipe used to leave its photo hotlinked from the recipe site until someone opened
devtools and ran a sweep. Now the app asks for the re-host itself, on save, and the console is no
longer needed for anything in normal use.

**`docs/IMAGES.md` §5 is the reference.** What follows is what a later session needs to know that
the reference does not say.

| | |
| --- | --- |
| App → Edge Function calls | 2 (`rehostImageFor` on save, `runImageSweep` in Settings). Before this there were **zero** |
| `rehost-images` | **v8** — adds an optional `recipeId`. A call without it behaves exactly as v7 |
| `find-recipe-image` | Unchanged, v4 |
| Smoke | **157 → 174** |
| Integrity | **24 → 31** |

### The thing that made this more than a one-line feature

**`pushList` upserts every cached recipe on every save**, and nothing refreshes `cache.recipes`
after `hydrate()`. So a value the server knows and the cache does not is overwritten by the next
save of *any* recipe — toggling one favourite is enough. A re-host that did not write its answer
back into the cache would therefore undo itself, silently, and look fine, because the external URL
still loads.

That is why `applyRehostedUrl` exists, why `runImageSweep` reconciles from the function's report
rather than just printing it, and why the end-to-end check below is "toggle a favourite and
reload" rather than "look at the card". **The same hazard is still live for the console sweep** —
hard-reload after running one — and `pushList`'s habit of also *deleting* rows absent from the
cache is untouched and still wants its own piece of work.

### A pre-existing defect this had to fix first

Saving a recipe wrote the form's image URL into `image_url` and **left the `IMAGE:` line in the
recipe text alone.** The title line had always been reconciled; the image line never had been. So
changing a photo by hand produced a row whose column and text disagreed, and because
`parseAndPreview()` refills the form from a parse, the disagreement healed itself *towards the old
URL*. It had gone unnoticed since the feature was built because the card reads the column, so the
new photo appeared immediately and the stale text only surfaced on a later edit.

`withUpdatedImageLine` now reconciles it on every save. The third query in `docs/IMAGES.md` §7
counts these disagreements and should be 0.

### Mutation testing found two checks that could not fail

Five behaviours were broken on purpose to see whether the suite noticed. Three were caught. **Two
were not:** the race guard that discards a reply for a URL that has since changed, and the
save-path `IMAGE:` line. `sentUrl` and `f-image` appeared zero times in `test/smoke.js` — the
code was written and reviewed, and nothing tested it. Both now have named checks, and both
mutations were re-run afterwards to confirm the checks fail.

**And a trap worth knowing:** `smoke.js` loads `test/app-under-test.html`, which `build.js`
writes. Re-running `smoke.js` without rebuilding tests the *previous* edit. That cost a round of
false results here — a mutation appearing to pass, then a clean tree appearing to fail — and it
looks exactly like a real finding. `node test/build.js && node test/smoke.js`, always the pair.

### Not covered, deliberately

A restore from backup calls `saveRecipesList` with the whole library and never touches the save
handler, so nothing fires; a save made offline never reaches the function. Both are what the sweep
is now for, and the sweep has moved out of the console into **Settings → RECIPE PHOTOS**.

### Still unverified against the real backend

The suite stubs Supabase, so none of this proves the function re-hosts anything. Outstanding:
add a recipe with an external image and watch the URL become ours; **toggle a favourite, reload,
and confirm it is still ours**; replace an image; run the §7 queries expecting 0; both Settings
buttons; and a save with the network off.

---

## 2e. Coming back to the tab — the sign-out, and the grid that didn't redraw — FIXED, 22 Sep 2026

Found by running `docs/TEST-IMAGES.md` step 9 on the live app — the first test ever run offline.
Two symptoms: a jump to the sign-in screen (*"Couldn't load your library — TypeError: Failed to
fetch"*), and a card that showed the new photo briefly and then the old one.

**Both are older than the image work.** Neither was caused by §2d; step 9 was simply the first
thing to go looking.

### The sign-out

supabase-js emits `SIGNED_IN` **every time the tab goes hidden → visible** — verified in the
`@supabase/auth-js` 2.117.0 source (`_onVisibilityChanged` → `_recoverAndRefresh`), with no network
call, so offline too. The app answered every `SIGNED_IN` with `startApp()`: re-download
everything, and sign out if that failed. Leave the tab while offline — to copy a recipe from the
converter, say — and coming back signed you out. On the tablet, waking it before the wifi had
reconnected would do the same.

It did not reproduce on a retry because the retry stayed on the tab. That looked like user error
and was nearly recorded as such.

### What the re-download had been doing all along

**Coming back to a tab has always silently re-downloaded the whole library.** Nobody knew:
`ARCHITECTURE.md` said two tabs "won't see each other's changes until reloaded". And it turned
out to be load-bearing. `pushList` pushes the *whole* cached table and deletes rows it doesn't
hold, so a tablet left open since the morning would, on its first save that evening, overwrite
the desktop's edits and **delete the desktop's new recipes** (cascading their cooking history).
The accidental refresh is the only thing that prevented that.

**So the refresh was kept, and made safe** — `refreshLibrary()`:

| It | Because otherwise |
| --- | --- |
| waits for the write queue to empty before reading | it reads the server before this tab's own saves arrive, and replaces them |
| stands down while any save has failed | the tab holds a change the server lacks; the refresh would silently undo it |
| discards what it fetched if anything changed mid-fetch | the change is wiped from the cache, then `pushList` pushes the loss — and deletes a recipe added in the gap |
| on any failure, does nothing | a refresh is an opportunity, never a reason to sign anyone out |

A failed save clears only when a later save of the **whole** table or row succeeds — then the
server provably matches the tab again. The food diary writes one row at a time, so a diary failure
blocks refreshing until a reload. The labels are an allowlist, so one added later defaults to
blocking.

**Starting up** offline no longer signs you out either: the gate says the server couldn't be
reached, and the session is kept, so coming back to the tab once connected starts the app by
itself. A non-network failure — an account not linked to a household — still signs out as before.

### The grid

`showView('recipes')` redrew nothing; every other screen redraws on entry. An EDIT save lands on
the Viewer, so a re-hosted photo arrived while the grid was hidden, and coming back by the
**sidebar** showed the previous photo until a reload. The Viewer's ← button did redraw, which is
why it looked intermittent. A comment in the History code already recorded the defect and worked
around it for one case; the fix is one line in `showView`.

### Tested

Smoke **174 → 191**. Seven mutations, each breaking one mechanism, each failing by name — and one
check that passed a broken app on the first mutation run, because the test before it left a
favourite flipped so a wrongly applied refresh happened to land on the expected value. Fixed by
starting that check from the fixture's own values; re-run, it fails as it should.

The stub gained switches for failed and slow reads and writes, an ordered log of reads and
completed writes, a handle on the app's auth listener, and a sign-out counter. All off by default.

### Still unverified against the real backend

`docs/TEST-IMAGES.md` steps 9–11, rewritten. **Step 10 is the one this section is about** —
offline, click another tab and back, and still be signed in.

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

Sixteen times now, something recorded as true wasn't. The pattern is worth more than the individual
corrections: **every one was found by checking the real thing, and none by reading more carefully.**

| Recorded | Actually | Found |
| --- | --- | --- |
| "Create Storage bucket recipe-images — completed" | Bucket existed, feature (R7) never built | 13 Sep audit |
| "Servings backfill pass — completed" | Never ran. **Done 20 Sep** via the ingestion | 14 Sep audit |
| "`main` still serves the pre-Supabase app" — in four documents | `main` had been serving the Supabase rewrite since PR #1, 13 Sep | 21 Sep, before the merge |
| "Nothing here is deployed and nothing live can break" | Pages had been live and sharing this database throughout | 21 Sep, same check |
| Test plan's "Planned days 15" read as an on-screen expectation | A row count; every stored day was in the past, so an empty Planner was correct | 21 Sep, by the person running the pass |
| Tuscan Chicken Pasta's image was "a lazy-load placeholder, cosmetic" | A truncated JPEG. Chasing it found a second broken image nobody had noticed | 22 Sep, from a screenshot of the card |
| Image re-hosting "verified against the dry run's byte counts" | That check cannot detect the fault it claims to — both reads fetch the same source | 22 Sep, while fixing the above |
| "C3: 249 of 249 MERGE lines timed" | 242 of 242. The library holds 250; 8 are in the one recipe never converted | 22 Sep audit, by counting |
| `INFRASTRUCTURE.md`: bucket "private, and currently empty"; "no Edge Functions deployed" | Public with 29 objects, and two functions live — both for six days | 22 Sep audit |
| `HANDOVER.md` §1: H1/H2/H3 "Not started" | Built, merged and deployed the same day, contradicting §2b in this very file | 22 Sep audit |
| `node test/build.js && node test/smoke.js` documented as the green gate | Exited 1. The stub had no `update()`, so the diary's write threw and a check passed on the cache alone | 22 Sep review, by reading the exit code rather than counting "ok" lines |
| `IMAGES.md`: "the recipe text is updated too", of changing an image | True of the sweep, **false of the app's own save** — which left the `IMAGE:` line stale, so the change reverted on the next parse | 22 Sep, while building §2d |
| `IMAGES.md`: "the card, the Viewer and the Group Viewer all render that external URL" | Only the card. `r.imageUrl` is read in exactly one render path | 22 Sep, by grepping for the field rather than re-reading the sentence |
| "The new checks pass; the mutations prove nothing" — briefly believed of §2d's tests | The artifact had not been rebuilt, so three runs in a row tested the wrong file. Rebuilt, the baseline was green and both mutations failed by name | 22 Sep, by noticing a debug probe that could not possibly be missing was missing |
| `TEST-IMAGES.md` step 9: "go back online, hard-reload, expect 1 copied in" | Impossible. An offline save never reaches the database, so the reload discards it and there is nothing left to copy | 22 Sep, by running it on the live app |
| `ARCHITECTURE.md`: two tabs "won't see each other's changes until reloaded" | Coming back to a tab has always re-downloaded the whole library, and that was what kept a long-open tablet from overwriting the desktop | 22 Sep, while tracing the sign-out in §2e |

**The last one is the most instructive, because the verification itself was the thing that was
wrong.** Every "the tests pass" statement in this repo was false for a day, and the reason it went
unnoticed is that the person checking counted passing lines instead of reading `$?`. A test that
cannot fail and a suite whose result is not read are the same problem wearing different clothes.

**The stale-build one is the other shape of the same problem.** Nothing was recorded wrongly; the
*measurement* was wrong, and it produced a confident, specific, entirely false finding — that two
new tests were worthless. A stale build is indistinguishable from a real result unless you check
which file you are actually running.

The rule in `CLAUDE.md` — verify rather than trust status notes, including these — has now earned
itself sixteen times over. Two were found by agents reviewing work that had just been done and
declared finished; three came out of building §2d, on top of work declared finished the day
before; two more came from actually running the test document written for §2d.

These brief items appeared in **no** task list at all: **P3** (calendar), **R4** (cooking notes),
**R7** (images, since built), **H1/H2/H3** (history and food diary). All are Phase 3 in the brief's
own build order, so they were never overdue — but they were invisible, which is the real problem.

---

## 7. Testing

`test/` holds an offline harness: `build.js` bakes `index.html` against a fake Supabase,
`smoke.js` runs **197 checks** across every screen, `shots.js` captures screenshots. Run
`build.js` first, every time — see §2d.

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
- `[instant]` and `[overnight]` are real duration keywords the parser now understands, as are
  en-dash ranges (`[4–5 min]`), seconds (`[30 sec]`) and compound hours (`[1 hr 30]`) since
  21 Sep. Any *other* unrecognised bracket (`[to taste]`) is deliberately left intact in the
  label — the parser under-detects on purpose rather than mistake a seasoning note for a timing.
- **An unrecognised bracket is not inert.** The label keeps it, so the raw text shows in the
  diagram and the step counts as untimed. That is why the three forms above were worth adding:
  the first reprocess wrote its timings as prose and the second used `[30 sec]` three times.
- **`main` is production.** GitHub Pages serves from `main`, and the `pages build and deployment`
  workflow runs once per commit to it — so every merge deploys to the tablet immediately, with no
  staging step and no approval. Work on the branch; merge deliberately.
- **`PrivateBackup`'s default branch is `claude/recipe-app-supabase-0z139o`, not `main`.** That is
  why the nightly backup fires. Renaming it stops backups silently. Its workflow also depends on
  the Session pooler connection string (the direct one is IPv6-only, and GitHub runners have no
  IPv6 route) and the full path to `pg_dump` 17 (the runner's own is older than the server). Both
  took several failed runs to find; don't undo either.
- **Recipe images re-host themselves on save, since 22 Sep** (§2d). The two cases that miss are a
  restore from backup and a save made offline; **Settings → RECIPE PHOTOS** covers both. The
  console sweep still works and still needs a hard-reload after it. `docs/IMAGES.md` is the
  runbook.
