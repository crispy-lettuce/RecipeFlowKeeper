# Kitchen App — Handover

**Written 14 Sep 2026.** Every claim below was verified against the running code, the live
database, or GitHub Actions at the time of writing — not copied from an earlier status note.
That distinction matters: an earlier task list recorded two things as "completed" that turned
out not to be, which is what prompted this audit.

`main` is production; work goes on short-lived branches merged by pull request. *(This line named
a shared working branch until 23 Sep; that branch is merged and finished.)*

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
| P3 | Automatic calendar push | **Done, 9 Oct 2026.** Scoped 30 Sep in `docs/PLAN-CALENDAR-PUSH.md` (until then it had never appeared in any task list; Phase 3 in the brief's own build order). PR 1, the migration and the `calendar-auth` and `calendar-sync` Edge Functions, merged 1 Oct (#69); PR 2, the app, merged 9 Oct (#71); the automatic toggles merged 9 Oct (#72). The household applied both migrations and connected Google on 9 Oct. Tablet step 40a passed 12 Oct; 40b is the household's. See §4. *(Until 12 Oct this row said "not built"; corrected 12 Oct 2026, the October review's F13.)* |

### Recipe viewing & editing

| | Item | Status |
| --- | --- | --- |
| R1 | Reset ticked ingredients/stages | **Done.** Ticks are keyed to flow geometry, so they survive a rescale; RESET TICKS clears in place without re-rendering. Session-only by design. |
| R2 | Auto-collapsing sidebar | **Done, extended 21 Sep.** Collapses over both Viewers at 861–1180px, peek tab restores it, navigating away resets it. **Also collapses at any width while Keep Awake is on** — a statement that cooking is happening now beats a guess from the window size. Peek tab still offered, so it cannot strand you. |
| R3 | Group Viewer parity | **Done, with two conscious omissions.** (Its PNG export truncated to one screenful until 21 Sep — see §7.) Delivered: Keep Awake, Favourite, Edit, Export PNG, Print, Reset Ticks, plus **OPEN →** per recipe. Omitted on purpose: *Shortlist* (contradictory for something already planned) and a *group-level Scale row* (no single base to scale from) — OPEN → covers both. **Worth confirming you're happy with that reading**, since the brief lists both as gaps to close. |
| R4 | Dated cooking notes | **Built 30 Sep 2026** (`docs/PLAN-COOKING-NOTES.md`, agreed "as suggested"): a running log per recipe in the `recipe_notes` table Phase 1 made for it. See §7. |
| R5 | Scale by servings | **Done.** Multiplier buttons retired everywhere. Viewer reads `SERVES 6 (SCALED FROM 4)`. |
| R6 | Servings mandatory | **Done, both sides, 20 Sep.** Save is blocked without servings, and all 33 recipes now carry one. The retrofit rode on the reprocess, as planned. |
| R7 | Recipe images | **Done, 21 Sep.** All 29 images self-hosted in Supabase Storage via an Edge Function. Automatic on save since 22 Sep. See §2 and §2d. |

### Shopping list

| | Item | Status |
| --- | --- | --- |
| SL1 | Unit handling | **Done.** Totals in a base unit, displayed as g/ml under 1000 and kg/L at 1000+. Metric only, never mixed systems. |
| SL2 | Ingredient name matching | **Done.** Prep words ignored when matching (with `ground` deliberately excluded — ground coriander is seed, coriander is leaf). Prompts capped at 3 per visit, both answers remembered. **Reviewed 22 Sep against the real library** (`docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md`): works, but 274 rows for 168 real items; the household chose the review's full plan on 23 Sep. Step 1, the quantity reader (mixed numbers, ranges, `up to`, `3 x 400 g`), merged as PR #9 on 23 Sep; step 3 (line shape, dictionary, survey tooling) is PR #10, revised the same day so the converter no longer renames to the dictionary (`docs/REVIEW-ARCHITECTURE-FINDINGS.md` §4); the rest is PR 6 in `docs/NEXT-SESSION.md`. **Steps 4–6 are PR 6b** (merged 25 Sep): no more prompts; a likely pair is offered in place under the row, and MERGE WITH… joins any two. |
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
| Backend (Supabase) | **Done.** 16 tables in `public` and 1 in `private` (12 Oct 2026), row-level security on every one; every `public` table has policies, and `private.calendar_oauth_states` has none, reached only by the Edge Functions' service role. *(Until 12 Oct this row said 13 tables; corrected 12 Oct 2026, the October review's Appendix B.)* |
| Household id on every table from day one | **Done, verified.** |
| Backup to a separate private repo | **Done and genuinely working.** See §5. |
| Images in Supabase Storage | **Done, 21 Sep** — 30 objects, 4,603 kB as of 23 Sep (29 on 22 Sep); 35 on 12 Oct, beside the private `recipe-sources` bucket's 4 source files. See §2. Mirrored weekly to `PrivateBackup` since 23 Sep. |
| Calendar reminders | **Done, 9 Oct 2026** — P3, see §4. *(Said "Not done" until 12 Oct; corrected 12 Oct 2026, the October review's F13.)* |

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

**Both broken images are fixed, and the diagnosis they came with was wrong twice.** Recipe A's
photo was recorded here as a lazy-load placeholder. It was not: it was a truncated JPEG,
which rendered as a photo on the top 40% of the card and solid grey below. Chasing that turned up a
second one nobody had noticed — recipe B's, cut off mid-transfer at exactly 35 × 1024 bytes.

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
still loads. *(Narrowed 24 Sep by PR 5: only an edit-save of that recipe rewrites its row now, and
a favourite toggle updates one column. The write-back is still required.)*

That is why `applyRehostedUrl` exists, why `runImageSweep` reconciles from the function's report
rather than just printing it, and why the end-to-end check below is "toggle a favourite and
reload" rather than "look at the card". **The same hazard is still live for the console sweep** —
hard-reload after running one — and `pushList`'s habit of also *deleting* rows absent from the
cache is untouched and still wants its own piece of work. *(That piece of work was PR 5, 24 Sep:
`pushList` is import-only now.)*

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

A restore from backup calls `replaceRecipesList` with the whole library and never touches the save
handler, so nothing fires; a save made offline never reaches the function. Both are what the sweep
is now for, and the sweep has moved out of the console into **Settings → RECIPE PHOTOS** (Settings → LIBRARY →
RECIPE PHOTOS since Layout E, 30 Sep; noted 12 Oct 2026, the October review's Appendix B).

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
- **8 planner slots and 2 meal groups pointed at deleted recipes** after the ingestion and render
  as "Recipe removed". 7 days and 1 group still do as of 23 Sep (`docs/REVIEW-ARCHITECTURE-FINDINGS.md`
  F11). Expected; a delete that also cleans the plan is planned for the row-scoped-writes PR.

**Two conversions carry a `⚠️ Source note` in their own syntax**, written by the converter
rather than by this ingestion: *No-Bake Chocolate Oat Bars* (allrecipes.com couldn't be
fetched, so it's reconstructed from a secondary reproduction) and *Lasagne Loaded Fries*
(poppycooks.com returned an access error, so it uses McCain's branded reproduction). Both are
worth a glance against the original page before cooking from them. *Cacao & Almond Oat Bar*
carries a note about two inconsistencies on the source page itself.
**(29 Sep: "worth a glance" understated this. The oat bars' ingredients are not the source's; see
`docs/HANDOVER-CONVERSION-INTEGRITY.md`.)**

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

## 4. Calendar push (P3) — answered 1 Oct 2026; PRs 1 and 2 merged and connected 9 Oct; the automatic toggles merged 9 Oct

Phase 3 in the brief. Recorded here because it appears in no task list anywhere and would
otherwise be forgotten.

The brief's decided mechanism: a Supabase Edge Function holds a Google OAuth refresh token,
obtained through a one-off consent screen (expect an "unverified app" warning — normal for a
personal project). After that, reminders are created automatically. Opt-in per planner entry.

This explicitly **supersedes** the earlier downloadable `.ics` idea, which is in the brief's
"deliberately dropped" list so it doesn't quietly reappear.

**Scoped 30 Sep 2026: `docs/PLAN-CALENDAR-PUSH.md`**, with seven decisions for the household. Found while scoping: the nightly
`pg_dump` copies the `public` and `private` schemas, so the refresh token must live in Vault (installed), not in a table.

**Answered 1 Oct 2026** (its §9): the calendar is for reminders, not a food diary. One all-day event per switched-on day, REMIND ME
at 20:00 the evening before, ADD THE WEEK, a RecipeWrangler calendar, and DISCONNECT leaving the calendar and its events.
**PR 1 built 1 Oct:** the migration (`docs/migrations/add-calendar-push.md`, applied by the household 9 Oct), the `calendar-auth` and
`calendar-sync` Edge Functions (deployed 9 Oct; v4 of each since 12 Oct), and `test/calendar-push.js`; merged 1 Oct (#69). **PR 2, the app, built 9 Oct:** the
Planner's IN CALENDAR, REMIND ME and ADD THE WEEK, Settings → App → CALENDAR, and a sync queued after each Planner change to a
switched-on day. It shows and sends nothing new until the migration is applied. What was verified is in §7; the real test is the
household's tablet and phone pass, `docs/TEST-PLAN.md` step 40a. PR 2 merged 9 Oct (#71); the household applied the migration
and connected the same day. **The follow-up, 9 Oct** (`docs/PLAN-CALENDAR-PUSH.md` §11): AUTOMATICALLY ADD TO CALENDAR and
AUTOMATICALLY REMIND ME FOR MAIN MEALS, on two new `household_settings` columns (`docs/migrations/add-calendar-auto.md`, applied
by the household 9 Oct before #72 merged, and checked read-only at 20:03 UTC), step 40b. Step 40a passed on the tablet 12 Oct;
40b is still to be reported.

*(Until 12 Oct this section said the first migration was "not applied", the functions "not deployed" and `add-calendar-auto`
"waiting", and §1 said P3 was "not built". All were done on 9 Oct (`docs/INFRASTRUCTURE.md` §3 and its list of migrations).
Corrected 12 Oct 2026, the October review's F13.)*

---

## 5. Backups — working, and restorable since 23 Sep

**Verified working.** `.github/workflows/backup-supabase.yml` in `PrivateBackup` runs daily at
04:00 UTC. The scheduled run on 14 Sep at 04:07 completed successfully on its own. As of 23 Sep,
13 runs, 12 successful, 12 dumps of 81–88 kB in the tree. *(Until 23 Sep this paragraph went
on: "A restore has never been rehearsed". True when written; the next paragraph is what
changed.)*

**Restore rehearsed 23 Sep 2026** (`PrivateBackup` PR #1, closing F2 and F3): the last
`public`-only dump and the first `public`+`private` dump, the latter made by the changed
workflow running from its branch against the live database, were each restored on a local
Postgres 17 set up to imitate the live roles, grants and `auth` schema; the old README command
was confirmed to strip every grant *and* the default privileges, data-only needs the 13 tables
in dependency order, the rebuild-without-dropping-the-schema path restores with no errors, and
a fresh-project restore ends with row-level security verified for a new user, a stranger and
`anon`. The photo backup is written and reviewed but has not run: its first run is the one
after the merge. *(It has run every Sunday since; the 18 Oct run, the first on the new mirror script, passed: see
`docs/INFRASTRUCTURE.md`.)* The runbook and the rehearsed/not-rehearsed table are `PrivateBackup/README.md`.
*(13 tables then; 16 in `public` and 1 in `private` on 12 Oct 2026, so a data-only restore today has more tables to order.
`PrivateBackup/README.md`, not this paragraph, is the runbook. Noted 12 Oct 2026, the October review's Appendix B.)*

Getting there took three goes — the direct connection is IPv6-only and GitHub runners have no
IPv6 route (fixed by using the **Session pooler**), and the runner's own `pg_dump` is older than
the server (fixed by calling `/usr/lib/postgresql/17/bin/pg_dump` by full path). Both are
documented in `PrivateBackup/README.md`; don't undo either.

**The fragility:** `PrivateBackup`'s default branch is `claude/recipe-app-supabase-0z139o` (still so
on 12 Oct 2026), which is why the schedule fires. Renaming or deleting it during a tidy-up would
silently stop backups. Worth renaming to `main` deliberately at some point, and confirming the
schedule still fires afterwards. *(Until 12 Oct this said it was the repo's only branch; the
October review found a second remote branch on 10 Oct. The default is what matters. Corrected
12 Oct 2026, the October review's Appendix B.)*

---

## 6. Corrections to the earlier record

Thirty-five times now, something recorded as true wasn't. The pattern is worth more than the individual
corrections: **every one was found by checking the real thing, and none by reading more carefully.**

| Recorded | Actually | Found |
| --- | --- | --- |
| "Create Storage bucket recipe-images — completed" | Bucket existed, feature (R7) never built | 13 Sep audit |
| "Servings backfill pass — completed" | Never ran. **Done 20 Sep** via the ingestion | 14 Sep audit |
| "`main` still serves the pre-Supabase app" — in four documents | `main` had been serving the Supabase rewrite since PR #1, 13 Sep | 21 Sep, before the merge |
| "Nothing here is deployed and nothing live can break" | Pages had been live and sharing this database throughout | 21 Sep, same check |
| Test plan's "Planned days 15" read as an on-screen expectation | A row count; every stored day was in the past, so an empty Planner was correct | 21 Sep, by the person running the pass |
| Recipe A's image was "a lazy-load placeholder, cosmetic" | A truncated JPEG. Chasing it found a second broken image nobody had noticed | 22 Sep, from a screenshot of the card |
| Image re-hosting "verified against the dry run's byte counts" | That check cannot detect the fault it claims to — both reads fetch the same source | 22 Sep, while fixing the above |
| "C3: 249 of 249 MERGE lines timed" | 242 of 242. The library holds 250; 8 are in the one recipe never converted | 22 Sep audit, by counting |
| `INFRASTRUCTURE.md`: bucket "private, and currently empty"; "no Edge Functions deployed" | Public with 29 objects, and two functions live — both for six days | 22 Sep audit |
| `HANDOVER.md` §1: H1/H2/H3 "Not started" | Built, merged and deployed the same day, contradicting §2b in this very file | 22 Sep audit |
| `node test/build.js && node test/smoke.js` documented as the green gate | Exited 1. The stub had no `update()`, so the diary's write threw and a check passed on the cache alone | 22 Sep review, by reading the exit code rather than counting "ok" lines |
| `IMAGES.md`: "the recipe text is updated too", of changing an image | True of the sweep, **false of the app's own save** — which left the `IMAGE:` line stale, so the change reverted on the next parse | 22 Sep, while building §2d |
| `IMAGES.md`: "the card, the Viewer and the Group Viewer all render that external URL" | Only the card. `r.imageUrl` is read in exactly one render path | 22 Sep, by grepping for the field rather than re-reading the sentence |
| "The new checks pass; the mutations prove nothing" — briefly believed of §2d's tests | The artifact had not been rebuilt, so three runs in a row tested the wrong file. Rebuilt, the baseline was green and both mutations failed by name | 22 Sep, by noticing a debug probe that could not possibly be missing was missing |
| `TEST-IMAGES.md` step 9: "go back online, hard-reload, expect 1 copied in" | Impossible. An offline save never reaches the database, so the reload discards it and there is nothing left to copy | 22 Sep, by running it on the live app |
| `README.md`, `INFRASTRUCTURE.md`, this file, `NEXT-SESSION.md`, `TEST-PLAN.md`: work lives on a shared branch "ahead of `main` and unmerged" | Merged and finished; `main` is the trunk and production | 23 Sep review, `git log` and the PR list |
| `README.md` "102 checks", `DOCUMENT-INDEX.md` "157-check" | 197 | 23 Sep review, by running it |
| `ARCHITECTURE.md` §4: the household id "is a constant in `index.html`" | Resolved at sign-in from `household_members` | 23 Sep review, by reading `hydrate()` |
| `INFRASTRUCTURE.md` §3: both Edge Functions "with source in this repo" | `rehost-images` v8 was deployed from an uncommitted copy; six hunks differed | 23 Sep review, by diffing the deployed source |
| `HANDOVER.md` §5: "Two real dumps are committed" | Twelve; and no restore has ever been tried | 23 Sep review, from the private repo and its Actions |
| `NEXT-SESSION.md`: the conversion prompt "needs no edits" | Revised 23 Sep (standard ingredient line, vocabulary) | 23 Sep review |
| `DOCUMENT-INDEX.md` on the ingredient review: "Nothing in it has been implemented" | Step 1 merged the same day as PR #9 | 23 Sep review, PR list |
| `ARCHITECTURE.md`: two tabs "won't see each other's changes until reloaded" | Coming back to a tab has always re-downloaded the whole library, and that was what kept a long-open tablet from overwriting the desktop | 22 Sep, while tracing the sign-out in §2e |
| Architecture review F5: "1 whose `SOURCE:` line differs … 1 with a `servings` column and no `SERVINGS:` line; 0 drift on title, image, URL, time or equipment" | Three recipes, not two: `TAGS:` disagreed with its column on two, one of them the servings recipe. The review's query never compared `TAGS:` | 23 Sep, by writing the query for all eight lines before building PR 4 |
| 6c-1 "built 28 Sep" — in nine documents and fourteen code comments | Built, merged and deployed on 27 Sep; `git log` and the database agree. The Markdown is corrected; the comments wait for the next code change (one is in the deployed `source-ingredients`, which would stop matching the repo) | 27 Sep, when dating 6c-2 against the database's own timestamps |
| "197 checks pass" as a statement about the code | True on six days of the week. The fixture planned "today" and "tomorrow" from the real clock, and on a Thursday tomorrow is a new Friday-start week, so two shopping-list checks failed with the code untouched | 24 Sep, four minutes past midnight, when a green run went red on its own |
| `CLAUDE.md`, `ARCHITECTURE.md`, `DOCUMENT-INDEX.md`, `TEST-PLAN.md`, `TEST-IMAGES.md`, `test/README.md` and this file's §7: the smoke suite has 257 checks | 269 when the PR 7d session began. §7 had logged 261, 267 and 269 as 6d-1, 6d-2 and PR #31 landed, but the pages that state the *current* size were last touched at 6c-1. (The Node suite's 72 was right.) All now say 275 and 77, after 7d | 28 Sep, by running the suite before changing anything |
| `NEXT-SESSION.md` rows 6 and 6c-1: the source-fidelity check is "reported by `validate-recipes.js`" | `validate-recipes.js` never calls `sourceFidelity` (no reference to it in the file); the check exists only in the browser's preview, so a batch of recipes is not checked against its sources before ingestion. Not fixed by 7e | 28 Sep, while tracing the check for 7e |
| PR 6c-1's and 7d's description of COMPARE WITH SOURCE: it catches an ingredient "swapped or left out", and a clean result meant "every ingredient matched" | It caught only an ingredient sharing no word with anything else: **one of eleven fault types** probed on 28 Sep, and on the household's first real comparison it reported two different lines as matched. Its tests covered the one fault it could see, and its fixtures passed only because it was loose | 28 Sep, by the household reading the table, then by probing with made-up lines |
| 7e as first built and described (in the PR and this file): "probed with 11 fault types, all caught", and tested by "an independent 50-case corpus" | Every case was written by the same hand as the fix, after seeing the failure. Run against the converter's own spec, the dictionary's vocabulary and mechanical operators, it false-alarmed on the converter's own `1 pinch X` shape every time, on an ingredient restructured across lines 53–96% of the time, and missed collapsed ranges entirely. Rebuilt around per-ingredient totals; the earlier "independent" claim was wrong | 28 Sep, when the household asked that it not be a fit to the examples |
| 7e's account: the converter's own bare-`pepper` example "is a soft note here" | True of `pepper` alone. The converter test set's own source line, `salt and freshly ground pepper`, gave a **hard** flag until 7f added `ground pepper` to the dictionary | 29 Sep, by running the test set's recorded correct outputs through the check |
| `confectioners' sugar` listed as a spelling of icing sugar in the dictionary's file, and in `core.js`, since 23 Sep | Never indexed: the reader treated an apostrophe as a note and skipped it, so it totalled with nothing | 29 Sep, by probing US→UK pairs and asking what each keyed as |
| §3 (20 Sep): two conversions carry a `⚠️ Source note`, "worth a glance against the original page before cooking from them" | For *No-Bake Chocolate Oat Bars* a glance was not enough. On the household's own comparison with the Allrecipes page, one of six source ingredients matches, one is a shaded refinement, one is a different product and **three are absent**, and the recipe has two the source lacks: not the same recipe. Nobody compared ingredient lists because nothing could (the source check arrived 27 Sep and `validate-recipes.js` never calls it). *Lasagne Loaded Fries* has the same shape and has not been compared. The converter's instructions cover an unreadable photo and say nothing of an unreadable URL. Full account in `docs/HANDOVER-CONVERSION-INTEGRITY.md` | 29 Sep, by the household's paste-box comparison of a US-source recipe |
| PR #38 (7f): the `a big handful of …` change "re-keys nothing in the library (measured)" | Said before it was measured. Measured afterwards, on a copy in scratch: 0 of 466 lines change key and none has that shape, so the claim happened to be true. The wording was ahead of the evidence | 29 Sep, on rereading the PR against what had been run |
| This file's §1 and §4, `NEXT-SESSION.md`, `TEST-PLAN.md`: P3 "not built", `add-calendar-auto` "waiting", `add-calendar-push` "not applied" and its functions "not deployed", the family "one account, one household", TEST-PLAN's B2 "never run against the real backend" and C "still open"; and stated test counts of 329 and 133 | All done: P3 built and connected 9 Oct, both calendar migrations applied 9 Oct and the functions deployed; three households; the image pass run 22 Sep and export and import round-tripped 21 Sep; 547 and 162 checks on 12 Oct. Each line was right when written and was never updated when the work landed. Corrected in place, each with a dated note | 10 Oct, the October review (F13, Appendices B and D), by reading `git log` and the live project; corrected 12 Oct |

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
`smoke.js` runs **713 checks** (18 Oct 2026, after the Modernist review's fixes; 708 on 15 Oct, 622 on 14 Oct, 620 after F, 617 after H, 613 after S, 609 after T and 606 on 13 Oct; `core.test.js` adds 218 in Node, 216 on 15 Oct, 206 on 14 Oct, 205 after F, 202 after H, 199 after S, 194 after T and 189 on 13 Oct) across every screen, `shots.js` captures screenshots. Run
`build.js` first, every time — see §2d. Since 24 Sep the harness runs on one fixed date
(`test/fixture-time.js`), because a fixture dated from the real clock failed two checks every
Thursday. *(Until 12 Oct this paragraph said 329 and 133, the counts at PR 5 of the add-recipe plan; corrected 12 Oct 2026,
the October review's Appendix B and D. The entries below keep the counts of their own day.)*

**PR 4, the faithful save (24 Sep 2026, PR #14, closing F5 and F7).** Verified by: 213 checks
green locally and in CI; sixteen new checks assert on the row the app sent, not the cache; five
mutations run against them (the delete removed, its exclusion list removed, the header rewrite
made a no-op, the rewrite cut back to title and image only, the adjacency error dropped) each
fail by name; and the live drift query, run before the change, found three recipes where a
header line and its column disagree — the two the review counted, plus `TAGS:`, which its query
never compared. The three were re-saved through the app on 24 Sep at 18:15 UTC, from a phone that
had loaded the merged build, and the query read 0 on every column: the feature's first and only
run against the real backend so far. *(A first attempt two minutes after the merge, from a tab
opened before it, wrote the old shape — a live example of the stale-tab hazard PR 5 removes.)*

**PR 5, row-scoped writes (24 Sep 2026, PR #15, closing F1 and F11).** Every ordinary save is
one row and `pushList` is import-only. Verified by: 228 checks green locally and in CI, fifteen of
them new, each asserting on the write that was sent — a favourite is an update of one column of
one row; a new recipe is one upsert of one row; deleting a recipe is one delete of that row plus
the row writes that tidy its plan day, group and shortlist entry; a plan day, a tick, a word match,
a swap and a keyword each go in and out as single rows; nothing but the import sends a delete of
"everything not in my list", and the import still does. Five mutations (a favourite that writes
the whole row, a delete that skips the plan cleanup, a delete through the whole-table push, the
retry removed, an import without its delete) each fail by name. **Not yet run against the real
backend**: the two-device pass, section D of `docs/TEST-PLAN.md`, is the household's to do after
the merge. **Run 24 Sep 2026 by the household, on an Android tablet and a Windows machine, after
the merge: steps 21–24 and 26 as expected.** Step 25 was the one surprise: no "Couldn't save"
toast appeared offline on either device, yet both favourites landed. Reading the pinned
supabase-js showed why — an offline request waits behind the session-refresh retry (up to 30 s)
and then lands if the network is back, so the write never failed and there was nothing to report.
Step 25 was rewritten to expect that, and PR #16 (25 Sep) makes the app say it is offline at the
moment of saving and re-send failed writes the moment the browser is back online; five checks
cover it in the stub, none against the live app. The household re-ran step 25 on 25 Sep and saw
the offline message, then asked for a bar rather than a toast, since being offline lasts: PR #17
shows a gold OFFLINE bar across the top of the page for as long as the browser is offline, in both
themes, and keeps the "Back online — sending your changes" toast for the moment it ends. **Seen
working on the tablet by the household on 25 Sep**, after the merge.

**PR 6a, the core extraction (25 Sep 2026, PR #18).** The pure functions moved verbatim from
`index.html` to `core.js` (678 lines in five blocks), and the ingredient dictionary's master copy
with them; `converter/ingredient-names.md` is generated from it. Verified by: the 237-check smoke
suite green with `core.js` inlined by `build.js` from the real file — the move changed nothing it
can see; the generator's first run reproducing the hand-written file byte for byte before its
prose was touched; 29 new Node checks in `test/core.test.js`, including four guards each run
against the mutation it exists for (a second copy of a function left in `index.html`, a version
stamp bumped on one side only, a dictionary row edited without regenerating, `core.js` reaching
for `document`), each failing by name; and `validate-recipes.js` and `ingredient-survey.js` both
run on made-up batches. **Not run against the live site**: the first load after the merge is the
test that Pages serves `core.js` and the version check stays quiet. *(That load was done by the
household on the tablet on 25 Sep, after the merge: the app loaded and no UPDATE bar showed.)*

**PR 6b, the shopping list release (PR #19, merged Friday 25 Sep 2026, a week earlier than
planned — the new week had just begun, so nothing current was ticked).** One row per ingredient, named by the rules and the dictionary in `core.js`, ticks keyed by
name, strict inline suggestions instead of dialogs. Verified by: 27 mutations, each turning a named check red — every one §6 of the ingredient review names, plus the start-up tick purge, the three inline buttons, re-normalising word matches, the suggester's dictionary rule and tie-break, and the merged row's name (three first ran green, and their checks were fixed until they didn't: one counted queued writes before they were sent, one looped over the very list it was guarding); the smoke suite at 246 and
`core.test.js` at 52, green; and a read-only re-measure of the live library (34 recipes, from
the database into scratch outside the repo) — 185 rows against 278 before, Week A 79 → 60 and
Week B 61 → 54, no false merges on reading every merged row, and 1 suggestion library-wide. That
re-measure found three faults the made-up checks had not: the suggester offering five pairs the
dictionary already answers (a listed product against a bare word, *raspberry jam ~ jam* in shape), "2 peppers" totalling as black pepper, and a
merged row keeping the name it was merged *from*; all three fixed and checked before commit.
**Not verified:** anything against the real backend — the purge of old-key ticks deleting
server rows, and ticks syncing under the new keys, are section E of `docs/TEST-PLAN.md`.

*After the merge, 25 Sep:* CI and the Pages deploy green on `main`; `shopping_checked` empty
where it had held 9 old-format ticks (consistent with the purge having run on a device's first
load, though the table alone can't rule out hand-unticking); all 17 word matches still stored.
Section E, **steps 27–29 passed**: the household planned Week A's recipes into the live app and
sent the list; it matched, row for row and quantity for quantity, what `core.js` computes in Node
from the export for the same plan — 59 rows with one recipe swapped, then **60** with Week A's
own six, the review's figure — and reading every row found no wrong join. **Steps 30–32 passed
on 27 Sep:** three rows ticked on one device stayed ticked after a reload and showed on the
tablet, and `shopping_checked` held exactly those three, under name-only keys for the week of
25 Sep, and nothing else; MERGE WITH… joined
two rows and was undone in Settings; Settings still listed every word match. **Section E is
complete.**

**The follow-up to 6b (25 Sep 2026, PR #20).** What that first live list showed, fixed without
touching a key: 12 rows in the wrong aisle (egg noodles with the eggs, hot pepper sauce with the
spices, coconut milk in the fridge, and nine in Other — "Other" goes from 45 rows to 36 across
the library); a mix of spoons shown as both ("3 tbsp + 2 tsp", where it read "11 tsp"); and a line
with no amount saying what it is for, from its own note or its group ("125 g + extra to serve
(2 recipes)", where it read "125 g + 2 more", which looked like two more of 125 g — measured, 19
of the library's 20 such lines are to serve, garnish or taste). Verified by: every row of the
whole library listed before and after, **keys identical in all 185**, and only the 12 intended
rows changing aisle; `core.test.js` 52 → 59 and smoke 246 → 247, green; 11 mutations each
failing a named check, and a twelfth (an accent fold) not failing because the fold was
redundant — removed rather than kept.

**6c-1, checks where recipes come in (27 Sep 2026, PR #22).** Planned after the household asked
how the line shape is kept up once the old lines are fixed; the honest answer was that nothing in
the app looked at a line. Now: the line checks live in `core.js` and the add/edit preview shows
the ones the shopping list can't cope with (22 lines in the library today), with a one-tap
rewrite where there is one right answer — advice, never a gate; the parser reports what it reads
past, and the preview shows it; COMPARE WITH SOURCE pairs the recipe with the source page's own
ingredient list from a new `source-ingredients` Edge Function; the list shows a recipe's
bracketed choice ("(or honey)", asked for by the household) beside the recipe that offered it —
beside the row's name only when every recipe on the row offers it, after the household saw a
frying recipe's "(or oil)" would otherwise read as advice for a cake on the same row (11 of the
20 rows with a choice after 6c-2 are shared like that); ghee files under
Dairy; `tools/remeasure.js` re-measures from an export. Verified by: `core.test.js` 59 → 72,
smoke 247 → 257 and a new `test/source-ingredients.js` (12), all green; Deno's own `check` and
`lint` on the function (strict type check, clean); the whole library listed before and after,
**keys identical in all 185 rows**, the one aisle move the intended ghee; the validators' output
unchanged but for the two new checks; 25 mutations, each failing a named check once one gap was
closed (a misspelt GROUP *inside* a group was reported by nothing but the re-measure check, so
a check for it was added and the mutation re-run). *Found on the
way:* `find-recipe-image` fails Deno's strict type check (two errors) yet runs, so Supabase
deploys do not type-check; the new function passes it anyway. **Deployed the same evening** (v1,
checked against the repo with `get_edge_function`), and section F passed by the household:
bracketed choices sit beside the right recipes (step 36), the warnings never block a save (35),
and the comparison pairs lines sensibly (34). **Step 33**, one recipe per source site, run by the
household the same evening: **two of the twelve sites refuse the function with a 403** —
Kitchen Sanctuary, which is 17 of the 34 recipes, and Allrecipes (1) — and no other failure was
reported. So for half the library the check says "compare by eye". All three functions send the
same self-identifying user agent; whether the refusal is of that or of Supabase's addresses is
not known, since this sandbox cannot reach either site. The function's log had caught up with
only one of the evening's calls when this was written, so the tally is the household's, not the
log's. Earlier, a comparison on a site outside the library's usual ones showed the household a
line its own copy had got wrong, fixed by hand.

**6c-2, the line rewrite (27 Sep 2026, a data job, no PR).** 27 ingredient lines in 14 recipes
rewritten in the standard shape, in place in the production database, with the household present;
the lines and both texts of every recipe are in `PrivateBackup`
(`migrations/6c-2-line-rewrite/`, the undo), never here. Each recipe was one `UPDATE … WHERE id =`
guarded twice: on the md5 of the text in the export taken for the job, so a recipe changed since
could not be overwritten, and on the md5 of the new text as validated, so a mistyped statement
could not be stored. The first went alone and the household opened it before the other 13.
**Verified by:** every statement returning its row (none did not); one query afterwards comparing
all 14 stored texts with the validated ones (14 of 14); then the library re-measured from the
database with `tools/remeasure.js`: **172 rows**, as simulated, from 185 before 6c; no line the
list can't total; none the parser reads past; 21 rows showing a choice — the 20 simulated plus
one from a line the household had edited by hand that evening. Word matches: of the five
proposed, the household kept three and kept two pairs apart as different things to buy: **169
rows**, with no further merge offered. *Found on the way:* one match was saved against the
neighbouring name in MERGE WITH…'s dropdown, which saves on the first pick and felt unresponsive
on the tablet; caught by reading the `aliases` table, not the screen, and redone. That dropdown is
in 6d.

**Rules any model can follow (27 Sep 2026, documentation only).** The household expects to use
a less capable model for some sessions. So `CLAUDE.md` now opens with three short sections:

- a checklist before every push, where each point is something that went wrong at least once;
- where a session stops and hands back;
- the one way to change recipe text in the live database, which was only written down here and
  in `PrivateBackup` before.

`test/README.md` gains the re-measure as a recipe: the query, the unwrap, the tool. The unwrap
was run against a real saved result before it was written down. 6d is split into 6d-1
(MERGE WITH…) and 6d-2 (swaps), one behaviour each. The household made `offline-harness` a
required check on `main`, read back from GitHub's API; it is enforced for everyone but admins.

```sh
npm install playwright
node test/build.js && node test/smoke.js
```

**6d-1, MERGE WITH… made safe (28 Sep 2026, PR #25, merged).** The dropdown that wrote the moment
a name was picked, from only this week's rows, is now a filter box over the whole library
(`allLibraryIngredientNames()`, the same aggregation the shopping list itself uses, unscaled) with
a confirm step — "Merge X with Y? MERGE · CANCEL" — before anything is written. The confirm's
MERGE button reuses the same `addAlias` call the inline "Same as X?" suggestion already uses, so
there is one path that ever writes an ingredient word match; only names `allLibraryIngredientNames()`
returns can appear as an option, so typing a new name has no effect, per the household's 27 Sep
decision. **Verified by:** `core.test.js` unchanged at 72 checks (`core.js` untouched, so no
version bump); smoke 257 → 261, the four new checks — a pick alone writes nothing, CANCEL writes
nothing, MERGE writes exactly one `aliases` row, a name from a recipe never planned is offered by
the filter — each mutation-tested to fail by name (not a crash) before being restored, per
`CLAUDE.md`. `docs/TEST-PLAN.md` step 15 is rewritten for the new flow. **Not verified:** anything
against the real backend or on the tablet — that is still the household's own pass; CI went green
and the PR was merged the same session.

**6d-2, household swaps on the shopping list (28 Sep 2026, PR #26, merged).** Two changes. First,
`findSwapMatchesForIngredient` (used by the recipe viewer's ⇄ icon and its own Substitution
Recommendations box) and a new `findSwapMatchesForKey(key, swaps)` (used by the panel below) both
now match by running the swap's `original` and the ingredient through `shoppingKeyForName` — the
same normalisation the shopping list itself uses — rather than checking whether `original` is a
raw substring of the ingredient text. That old rule let a swap for "butter" also fire on "peanut
butter"; the smoke suite proves this with invented names, since the repo is public. Second, a
"possible swaps" panel at the bottom of the shopping list lists, for each swap that matches a row
on the list, the row's name, the swap's ratio and its note — decided 28 Sep, no attempt to scale
a row's aggregated total, which can be in mixed units or partly unmeasured. It reads every row on
the list, not just the ones HIDE TICKED currently shows, so ticking something off doesn't hide the
swap for it; `buildShoppingList` is untouched, so it stays free of this as `CLAUDE.md` requires.
**Verified by:** `core.test.js` unchanged at 72 (`core.js` untouched, no version bump); smoke
261 → 267, six new checks — the matching fix itself (a swap for "butter" excludes "peanut
butter" but still matches "butter"), the panel absent when nothing matches, present with name/
ratio/note when something does, unaffected by an unrelated planned ingredient, and still shown
when its row is ticked and hidden — each mutation-tested to fail by name (not a crash) before
being restored. One mutation (matching a swap to more than one row) was caught only because a
defensive dedup-by-id in the panel's first draft was removed once it was found to be masking
exactly that regression — worth recording, since a check that cannot fail proves nothing, and
this time the mechanism supposedly making the code safer was the thing hiding the fault.
`docs/TEST-PLAN.md` gains step 15a for the household's own pass. **Read-only against the real
library, never committed** (`docs/TEST-PLAN.md`'s point, `tools/remeasure.js`'s method, applied
by hand this time): of the household's 2 stored swaps, one matched the same one row under the old
rule and the new; the other had matched **nothing** under the old rule — its wording and the
recipe's wording put the same words in a different order, which a raw substring check missed and
the dictionary-driven key catches. No false positive was sitting in the live library today, but
the fix reaches further than "removes one" — it also finds a real match the old rule silently
missed. Neither swap's own text appears here, per `CLAUDE.md`. **Not verified:** anything against
the real backend or on the tablet — that's still the household's own pass; CI went green and the
PR merged the same session.

**7a, the onboarding runbook (28 Sep 2026, PR #27, merged).** `docs/ONBOARDING.md`:
the three steps to add a family member (create their account in the dashboard, one guarded SQL
statement to link them to the household, give them the app's address), what `hydrate()`'s real
error looks like if the link is missing, why the app has no sign-up form of its own to do any of
this, and that `household_members.role` is schema built ahead of a feature that isn't there.
Started after checking with the household how to split "Sharing" — one PR per piece, the JSON-LD
"plain recipe, no flow" extraction and the model-backed converter both deferred until a family
member is actually adding a recipe. **Verified by:** reading the running code rather than
describing it from memory — the exact error text quoted from `index.html:2520`; the login form
checked at `index.html:1250` to have no sign-up fields; `household_members.role` confirmed unused
by `grep -rn "\.role\b" index.html` (no hits); and the live database read read-only (never
written to): 1 user, 1 household, 1 membership row; the anon-grants finding (F8) checked again
and unchanged — `anon` still holds full privileges on all 13 `public` tables and four `storage`
tables; leaked-password protection still off, per the security advisor. `node test/core.test.js`:
72 checks, unchanged (nothing in `index.html` or `core.js` touched). **Not verified:** the
procedure itself against a real second account — nobody has been added yet, so the SQL is
checked against the schema's real constraints (the unique index, the two `ON DELETE CASCADE`
foreign keys) but not run.

**7b, RLS belt and braces (28 Sep 2026, migration `rls_belt_and_braces_restrict_to_authenticated`,
documented on PR #27, merged — the migration itself is not app code, so it ran directly).**
Run against production with the household's
explicit go-ahead, after the exact SQL was written out and checked here first. Every policy that
was `TO public` — the 46 on the app's own 13 tables, plus 4 on `storage.objects` found the same
day, none of them named in F8 but the identical shape — is now `TO authenticated`; `anon`'s
blanket `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on all 13 `public` tables
is revoked. Deliberately left alone: `storage`'s table-level grants (the public bucket's own read
path is a Storage-service setting, not a table grant or a policy, and this pass doesn't touch
it — not tested directly, so left as a precaution rather than assumed safe); `pg_default_acl` for
`public` was checked first and found empty, so a future table is not protected by this and the
same check is worth repeating after any migration that adds one; leaked-password protection,
which is a dashboard toggle, not SQL. **Verified by:** re-reading the database straight after —
0 policies left with `roles = '{public}'` in `public` or `storage`; 0 rows for `anon` in
`information_schema.role_table_grants` on `public`; the security advisor shows the same one
warning as before (leaked-password protection) and nothing new. The policies' own `USING`/`WITH
CHECK` clauses were untouched — `ALTER POLICY … TO authenticated` changes who a policy applies to,
never the logic — so this is a narrowing of *who*, not a change in *what's allowed once
signed in*. **Not verified:** the app itself, signed in, after this change — nobody has tried
it against the live app yet, which is the same "not a substitute for opening the real app" gap
`test/README.md` already names for the offline harness. `docs/REVIEW-ARCHITECTURE-FINDINGS.md`
F8 is annotated as partially closed, with what's still open (leaked-password protection; whether
public sign-up is enabled, still uncheckable from a session).

**7c, the weekly live-backend test (28 Sep 2026, `PrivateBackup` PR #3, merged; fix on PR #4,
open — nothing in this repo).** `scripts/weekly-live-check.js` and
`.github/workflows/weekly-live-check.yml`, in `PrivateBackup`: signs in to a *dedicated* test
household (never the family's — this script adds and deletes a real recipe and two real diary
entries every run), adds a recipe, favourites it, logs it as cooked and answers the meal-type
prompt, adds an ad-hoc entry, then cleans all of it up — each step proven by a reload rather than
trusted from the in-page cache. Answers Answer 5's suggested test and closes F13's specific gap
(the diary's writes had never run against the real backend).

**Its own household was linked first (28 Sep 2026).** The household created the test account in
the dashboard and gave back its email; from a session, that account's `auth.users` row was found,
a fresh `households` row was inserted for it alone, and a `household_members` row linked the
two — the same guarded-insert shape as `docs/ONBOARDING.md` §1, but into a brand-new household
rather than the family's.

**The first real run (28 Sep 2026, run #1, triggered manually right after the household added
the two secrets and PR #3 merged) found a genuine bug — in the test script, not the app.** Sign-in,
the household starting with zero recipes and zero diary entries (`hydrate()` and RLS both
working), and the initial save all passed. The reload straight after that save then timed out
after 20 s waiting for the recipe's card to reappear. Every *other* write-then-reload step in the
script already waits 2 s first, with a comment explaining why — writes queue in the background
(this file's own documented gotcha) and return immediately, so a reload right after a click can
race ahead of the real network write reaching Supabase — but the very first one, straight after
the initial save, was missing that wait. Checked the database afterwards: the test household's
`recipes` and `recipe_logs` were both empty, which fits "the write never landed before the
browser closed" rather than "it landed and something else failed to find it" — no manual cleanup
was needed. Fixed on `PrivateBackup` PR #4, merged the same session.

**Run #2, straight after PR #4 merged, proved that fix and found a second, real one — this time
in the app.** The recipe now survived its first reload correctly. But logging a cook and tapping
a meal type, then reloading, came back with `mealType: null` instead of `'lunch'` — and run #3,
triggered to rule out a flake, failed identically on the same commit. `updateDiaryEntry`
(`index.html`) checked `unsavedDiaryIds.has(id)` *before* ever calling `queueWrite`, meaning
"insert still in flight" and "insert genuinely failed" looked identical from outside, and a fast
tap — human or scripted — happens well inside a real network round trip almost every time. The
meal-type update was silently never queued at all, while the click handler showed "Tagged as X"
regardless, since it never checked the return value.

Verified with a three-way independent check before acting on it (a `Workflow` run: one pass
re-traced the code by hand, one pulled Supabase's `edge_logs` for both failing runs and found
**zero** PATCH requests to `recipe_logs` in either window — the update was never even attempted,
not rejected by RLS — and one confirmed why the run's ad-hoc-entry step passed instead: it sets
`mealType` in its one insert and never calls `updateDiaryEntry` at all). All three independently
reached the same root cause.

**Fixed on PR #31** (this repo): the check moves inside the queued write itself, which already
sits behind the insert in the same shared `writeQueue`, so by the time it runs the insert has
resolved one way or the other. `test/smoke.js` gains a check using `__WRITE_DELAY__` (already in
the stub, never used for this) to hold both writes open long enough to force the same race a real
network round trip does — the offline harness's instant-resolving stub is exactly why this had
never been caught. **Verified by:** `node test/core.test.js` (72, unchanged); `node test/build.js
&& node test/smoke.js` (269, 0 failed, up from 267); mutation-tested — reverted the fix, the two
new checks failed by name with everything else still green, restored, 269/269 again.

**A real number worth having, not a conclusion:** every one of the household's own 115 real
cooking-log rows has `meal_type` null. That is consistent with this bug having quietly eaten every
tag ever tapped — but SKIP is a legitimate, designed answer to the prompt (`docs/HANDOVER.md`'s
own comment on `promptForMealType` calls it "an enrichment, not a requirement"), so 115-for-115
null is equally consistent with the household never having tapped a meal type at all. The database
can't tell those two apart; only the household knows which it was.

**Verified against the live app (28 Sep 2026, run #5, merged 20:36 UTC, triggered 20:48).** The
run right after PR #31 merged (run #4, 20:36) failed the same way one more time — GitHub Pages/CDN
propagation lag, not the fix being wrong: confirmed by reading `index.html` straight from `main`
(the fix was already there) and by the fact that waiting another twelve minutes and triggering
once more turned it fully green. Run #5: **13 checks, 0 failed**, `the meal type survives a
reload — reached the real database  (lunch)` included. This is the first genuinely clean pass —
sign-in, `hydrate()`, RLS, and the background write queue, including the exact race this session
found, all proven against the real backend in one run. `weekly-live-check.yml` now runs itself
every Monday at 06:00 UTC; nothing further is owed here unless a future run goes red.

**What the offline harness does not cover** (this live check covers the first four): in `smoke.js`,
sign-in, hydration, row-level security and the background write queue are all stubbed. A green
offline run is not a substitute for opening the real app. Keep Awake can't be tested outside a
real tablet. *(Until 12 Oct this paragraph read as if it described the live check above it, which
proves the opposite; it belongs to the offline harness. Corrected 12 Oct 2026, the October review's
Appendix B.)*

**7d, the paste box for COMPARE WITH SOURCE (28 Sep 2026, PR #35, merged 21:53 UTC).** Asked and answered
at the start of the session: its own small PR. Two of the twelve source sites (Kitchen Sanctuary, 17
of 34 recipes, and Allrecipes, 1) refuse `source-ingredients` with a 403, so half the library's
source check ended at "compare by eye". The add/edit preview now also has a box under AGAINST THE
SOURCE: select the ingredient list on the page, copy, paste, COMPARE PASTED LIST. The lines go
through `pastedIngredientLines` (`core.js`) and then the same `sourceFidelity` and the same table as
the function's list, so the two routes cannot disagree about a match. It fetches nothing, writes
nothing, and needs no SOURCE URL; the pasted text is held in memory until the form closes (kept
across a re-parse, since USE THIS re-parses and a list fetched from another tab is a chore to redo).
The tidy-up is deliberately narrow: tick boxes, bullets, blank lines and headings that are
*certainly* headings (no digit, and a colon, "For the…" or a section word) go; anything else stays
and shows as a highlighted row, because a heading left in is a row to read past and an ingredient
dropped is a line never checked. A refused site's message now points at the box. No schema, Edge
Function, naming or dictionary change, so no tick is re-keyed and nothing in production was touched.
**Verified by:** the suite run on `main` first (72 and 269, green — the documents said 257, see §6),
then after: `core.test.js` 72 → 77 and smoke 269 → 275, both green, exit codes read; the new
checks broken on purpose, fourteen ways, each failing the check meant to catch it *by name* (eight
in Node: the glyph strip, the zero-width strip, each of the three heading rules, a rule that drops
every line without a digit, the digit guard, and `null` becoming the word "null"; six in the
browser: the 403 message, the empty-box guard, cleaning skipped, pasting that also calls the
function, the box not restored after a re-parse, the box not cleared on close), the tree
restored and compared byte for byte to the known-good copy after each. Two things found on the way:
one mutation first matched nothing, because the editing tool had written the zero-width space into
`core.js` and `core.test.js` as the literal invisible character instead of `\u200b` — one in the
first, three in the second, fixed and counted against `HEAD`; and a non-breaking-space replacement
was removed as redundant, since `\s` already matches it and no check could fail it. `core.js` is
`2026-09-28.3` in all three places, which `core.test.js` checks. **Not verified:** what a real copy
from either site looks like — no session can reach them, so the tidy-up was written from a general
idea of what copying a recipe page gives, and `docs/TEST-PLAN.md` step 36a asks the household to
try one and report what comes along; the first load after a merge (Pages serving the new
`core.js`, no UPDATE bar); anything on a real device or against the real backend. The example lines
in the new checks are generic and made up, most of them the kind the existing tests already
commit, but **not checked against the library** — no export was to hand and the Supabase connector
failed to connect this session, so no fact about the live database was re-verified either.

*After the merge (read from GitHub, 28 Sep):* `main`'s tests (run 63) and the Pages deploy (run 52) both
succeeded, and the household used the box on a real page that evening. A check a session left
running to fetch the live page reported "not live", and means nothing: this sandbox's proxy refuses
`github.io`, so it never saw the site.

**7e, the source check that no longer calls a difference a match (28 Sep 2026, PR #37, merged 29 Sep at 05:06 UTC).**
Found by the household on the first real use of the paste box: comparing recipe A, two
lines came out *matched* that were not. The source listed one ingredient twice, with the same
amount, beside a compound "salt and pepper" line; the recipe carried the doubled line once and the
compound line split in two. The leftover second copy took the recipe's "pinch" line, because the two
shared a word and a dictionary name, so the one real difference — a line the source lists that the
recipe does not — was displayed as a match. Reproduced with the app's own `sourceFidelity` on the
lines from the household's screenshot (in scratch, never committed) before anything was changed.

Probed with made-up lines, **the check caught one of eleven fault types**: an ingredient sharing no
word with anything else. It passed black pepper for white, garlic powder for onion powder, a dropped
half of "salt and pepper", and every wrong amount, because it read no amounts and one shared word was
enough to match. The words in PR 6c-1's and 7d's descriptions ("catches one swapped or left out") were
true of much less than they claimed.

**The first rebuild was itself tailored, and the household asked that it not be.** It fixed the
examples it had been written from and was tested with cases written by the same hand. It was then
measured against data nobody wrote for it — the converter's own specification and test set, the
dictionary's 90 ingredients and their spellings driven through mechanical operators, and the real
recipe — and that found six general faults, none about pepper: (1) **`a pinch of X` against the
converter's own `1 pinch X` false-alarmed every time**, since one read as a count and the other as
"unmeasured"; (2) **an ingredient in several lines that the converter restructures (three source
lines as two, two as three, the same total) false-alarmed 53% and 96% of the time**, because lines
were grouped by luck of pairing and not by ingredient; (3) a range collapsed or shifted (`2-3` as
`2`), which the converter's own run notes record it doing, passed 100% of the time; (4) a spoon
written as a pinch passed 100%; (5) an ingredient whose only words are count words (`whole cloves`)
was not recognised as one, so a compound line containing it was mishandled (267 of 8,010 pairs); and
(6) a loose "the recipe says less" match let a bare `pinch pepper` absorb a dropped `red bell pepper`
whenever the source line had no comma, which switches the dictionary off.

**The design that replaced it** (`core.js`, `2026-09-28.5`; the comment above `sourceFidelity` is the
full statement). What matters is what the source asks for of an *ingredient* in total against what the
recipe asks for, not how the converter split or merged the lines — the way the shopping list already
totals. So every line, on either side, joined by a same-ingredient pair is one group, and the group's
amounts are compared as totals per kind (mass, volume, count, and a pinch as its own kind, however
written), only where a difference cannot be a unit conversion; a range is compared by both ends.
"Same ingredient" is two tiers: the same name (the dictionary's, or the same words) is exact, and
"the recipe says less than the source" is looser and joins only lines with no exact partner. A
compound line becomes its parts, as the converter is itself told to do. A recipe that keeps everything
the source said and adds a qualifier is a **soft note** where the dictionary calls the two one product
(shaded, listed, counted apart) and a hard difference where it does not. Similar-only lines pair
last and are always flagged. Nothing may silently disappear: every line is drawn or listed. No write,
no schema, no dictionary or naming change, so no tick is re-keyed.

**Verified, on data that was not written for it.** *The converter test set* (`converter/test-set.md`
tests 6–8, by earlier sessions): its recorded correct output for the vocabulary test is quiet, and the
wrong outputs it names that a comparison can see are each flagged (range collapsed, oyster for soy
sauce, an amount changed, a line dropped, a line added). *The dictionary, mechanically:* about 50
operators — every way the converter is told to reshape a line, and every way it can get one wrong —
run over all 90 ingredients and their plain spellings; scratch runs of ~4,500 cases per seed on four
seeds found no miss and no false alarm, and the committed version (`test/core.test.js`) runs 4,854
harmless conversions and 1,620 faults, then a spread of both again inside recipes, plus every
sampled pair of ingredients as a compound line. Every case also checks that no line is lost. *The
real recipe:* exactly one hard flag, on the doubled line, naming its amounts, and nothing else among
the other 22 lines. `core.test.js` 77 → 96 and smoke 275 → 280, green, exit codes read; the Node
suite now takes about a second. **Mutation-tested, 46 ways** (38 in Node against the final structure,
8 in the browser), each ending in a named check failing. Survivors were found and closed rather than
argued with: the unit factors and the tolerances (no case crossed units), unfamiliar preparation words,
which lines are drawn beside which, a leftover line never drawn, a note drawn from an unshown edge,
and a serving-note rule no test could tell from its absence (removed as dead code).

**The price, measured, and the household's to decide.** Stricter matching stops accepting "shares a
word", which is also what let swaps through, so a translation the dictionary has no entry for now
flags. On 67 well-known US→UK pairs written for this check from general knowledge (not from the
dictionary), false alarms rose **from 31% to 58%**: 18 pairs that share a word and used to pass now
flag (`heavy whipping cream` → `double cream`, `sour cream` → `soured cream`, `beef broth` → `beef
stock`, `confectioners sugar` → `icing sugar`…), and none improved. **The noise is proportional to the
dictionary's gaps and lands almost entirely on US sources**; the real recipe, from a UK site, gave none.
The remedy that fits the project is the existing one — translations added to the dictionary through the
survey tool, which also improves the shopping list's totals — and it re-keys ticks, so it needs the
household's go-ahead and a re-measure first (`CLAUDE.md`). The alternatives are a separate glossary used
only by this check, or relaxing to "any shared word" and losing the swaps. Not done in this PR; **done in 7f, below**. The 39 pairs that flagged, for whoever takes the dictionary route (some are
loose equivalents, so each needs a decision, not a paste): eggplant → aubergine; zucchini → courgette; arugula → rocket; heavy whipping cream → double cream; half-and-half → single cream; confectioners sugar → icing sugar; granulated sugar → caster sugar; shrimp → prawns; garbanzo beans → chickpeas; rutabaga → swede; snow peas → mangetout; yogurt → yoghurt; molasses → black treacle; light corn syrup → golden syrup; canned tomatoes → tinned tomatoes; canned chickpeas → tinned chickpeas; fava beans → broad beans; romaine lettuce → cos lettuce; collard greens → spring greens; string beans → green beans; jalapeno → green chilli; chile flakes → chilli flakes; cookies → biscuits; graham crackers → digestive biscuits; pie crust → shortcrust pastry; candy → sweets; broth → stock; beef broth → beef stock; vegetable broth → vegetable stock; sour cream → soured cream; skim milk → skimmed milk; sea salt flakes → flaky sea salt; quick oats → porridge oats; raisins → sultanas; golden raisins → sultanas; shortening → vegetable shortening; endive → chicory; frisee → curly endive; mesclun → mixed salad leaves.

**What it still cannot do — a clean result is not a guarantee.** It does not read the method, the
groups, the timings or the order things go in. Amounts in different systems (cups against grams, a
count against a weight) are *unknown*, and unknown never warns, so "1 cup" turning into the wrong number
of grams is invisible. **A recipe that settles an ambiguity by swapping the qualifier is not caught:**
`vegetable oil` for `neutral oil` and `natural yoghurt` for `plain yogurt`, both documented as failures
in the test set, because the dictionary calls each pair one product and the words are substituted rather
than added; an *addition* (`light soy sauce` for `soy sauce`) is only a soft note. A recipe scaled to
another number of people flags every amount, so compare before scaling. The converter's own example
writes bare `pepper` as `black pepper`, which is a soft note here, and the converter's rule against
settling an ambiguity and that example disagree: either the converter keeps `pepper`, or the household
accepts the note. **Not verified:** anything against the real library (the connector was down and the
source sites cannot be reached from a session), so it is calibrated on one real recipe, the converter's
test set and generated data; the household's step 36b; the live app.

*After the merge (read from GitHub, 29 Sep):* `main`'s tests (run 68) and the Pages deploy (run 53)
both succeeded on the merge commit `4b3f8eb`. Whether the household's step 36b has been done: not known.

**7f, US names in the dictionary (29 Sep 2026, PR #38, merged 29 Sep 05:52 UTC).** The household's
answer to 7e's price: "Add US translations to the dictionary". **49 rows added (90 → 139) and spellings
added to 15 that were there**, listed by `git diff origin/main -- converter/ingredient-names.md`, which is
generated from `core.js`. `core.js` is `2026-09-29.1` in all three places.

*The rule for a row* (written into `tools/ingredient-names-preamble.md`): **one product on the shelf
under two names**, never a substitute or a near equivalent, because a row also totals the shopping list
and two products on one row is a worse failure than a flag here. So the 39 pairs 7e listed were sorted,
not pasted: 24 were translations and are now rows; 15 were not and are deliberately still flagged, since
flagging them is the check doing its job — granulated for caster sugar, half-and-half for single cream,
molasses for black treacle, corn syrup for golden syrup, graham crackers for digestives, raisins for
sultanas, collard greens for spring greens, jalapeño for green chilli, pie crust for shortcrust; and
four left alone as ambiguous or not an ingredient (cookies for biscuits, since a US biscuit is a
scone; candy; shortening; endive and frisée). The one exception in that 15 is `canned tomatoes` against
`tinned tomatoes`, an adjective swap that is a real false alarm and that rows cannot fix without
listing every ingredient twice.

*Two things found on the way.* **`confectioners' sugar` has never worked as a spelling.** It was in the
dictionary's own file since 23 Sep, and the reader skipped it, because an apostrophe was on its list of
"this piece is a note". One function, `dictionaryPhrases`, now reads a row for both the index and the
tests, and `core.test.js` checks that everything the reader skips carries a bracket, emphasis or quote
mark. **7e's claim that the converter's own bare-`pepper` example is "a shaded note" was true of bare
`pepper` and false of the converter test set's own source line**, `salt and freshly ground pepper`: it
gave a *hard* flag, because the dictionary listed `ground black pepper` and not `ground pepper`. Added.

*Measured before shipping, on the live library (read-only; the export stayed in scratch).* The
connector worked this session: 34 recipes, 466 ingredient lines, 169 rows on `main` and on the branch,
`tools/remeasure.js` on both. **0 of 466 lines change key**, so no tick is re-keyed; no row changes its
name or its amounts; the household's word-match map is identical (3 entries; 14 alias rows). **The one
visible change: "Other" 34 → 32, mangetout and pak choi now file under Produce**, since each has a row and
a row has an aisle. No line in the library says "mince", which is what let the five mince rows in
(`mince` is a preparation word, so until then "beef mince" totalled with "beef").

*Measured for effect.* The 67 US→UK pairs 7e used: **false alarms 58% → 22%** (39 flagged → 15). That
list is what the first rows were made from, so it proves little alone. A second list of 46 translations,
20 substitutes and 10 controls, written from the published US/UK glossaries *before* looking at the rows:
**78% false alarms on `main`, 37% on the first pass of rows**, and then 9% after the gaps it showed were
closed (no longer held out, so quote the 37). The 4 left are a modifier on a spelling (`vanilla yogurt`,
`low-fat yogurt`, `cooked shrimp`) and a household decision (`jumbo shrimp` is raw king prawns). The
substitutes: 19 of 20 still flag; the miss, `coriander seeds` for `ground coriander`, is the same on
`main` (see below). Controls: 10 of 10 quiet. **The evidence not written for this**, the converter test
set's recorded correct outputs: test 8, the US-source test, went from **6 hard differences to 2**, and
test 6 from 1 to 0.

*Checks.* `core.test.js` 96 → **109** (about two seconds now, not one). They are properties of the whole
table, not of the rows somebody remembered: no wording belongs to two rows; every wording of a row totals
with its name; every wording of a row is quiet against every other wording of the same row; **any two rows
that share a word (260 pairs) are never taken for one another, both ways round**; plus named tables of 52
translations that must be quiet, 16 substitutes that must still flag, and 18 near-neighbours the
shopping list must keep as two rows. Each of the 13 mutations I tried (an apostrophe back on the list, a
wording claimed twice, a spelling the pipeline turns into another key, the dictionary veto removed, a
substitute made a spelling, the mince rows removed, a row dropped, raisins made sultanas, yoghurt merged
with natural yoghurt, three more against the converter-set checks) ended in a check failing by name, and
the tree was restored and compared byte for byte. `smoke.js` stays at 280 (green, exit 0): one fixture
pair changed, because Settings' "same" form is asked for courgettes and zucchini, which the dictionary
now calls one row, so it rightly stores nothing for them.

*What it does not do, found while measuring.* **A wording the dictionary has not heard of still
flags**, and a modifier on one (`vanilla yogurt`) is a wording of its own: rows cannot list every
modifier. The survey tool is still how the dictionary grows. **`a big handful of arugula`** is read as a
name, not a count word, because `shoppingLine` takes the article off only when the count word follows it
directly; it is why test 8 still has two hard differences. It is a small change to how ingredients are
named, so it needs a go-ahead; not made here, and pinned by a check that says so. It re-keys nothing in
the library: **measured on 29 Sep after the merge** (0 of 466 lines change key, none has the shape); when
this paragraph was first written the claim was ahead of the evidence (§6). **Whole for ground is not caught**: `coriander seeds` against `ground coriander`
passes (the same on `main`). **Twenty-three wordings in the file are skipped on purpose as notes**, and
some are plain spellings with a note glued on (`long-grain rice`, `tinned chopped tomatoes`, `sweet
paprika`), so they never total with their rows; not touched, since each is a household decision that
would re-key lines.

**Not verified:** the live app; the household's step 36b and the new 36c; the first load after a merge
(the UPDATE bar); the rows against any source I did not have, since the two sites that refuse the
function cannot be reached from a session.

**The add-recipe flow, planned (29 Sep 2026, documentation only, no PR yet).** `docs/PLAN-NEW-RECIPE-FLOW.md`,
written in a session that changed no code. **Verified by:** the add path read in `index.html` on `main`
at `55cd5a6` (the modal markup, `parseAndPreview`, `renderLineChecks`, the save handler's `confirm()`,
`recipeToRow`/`rowToRecipe`); the naming rules read in `core.js` `2026-09-29.1`; the live library
re-measured read-only with `tools/remeasure.js` from an export kept in scratch — 34 recipes, 466 lines,
169 rows, 32 in Other, 0 splits, as recorded — and three scratch scripts over the same export for counts
only: 80% of lines dictionary-known, 86 of 139 rows hit, per-source coverage, 55% of keys in one recipe,
2 "canned" and 1 "tinned" ingredient line, both source notes one line each; one aggregate SQL query (0
ticks, 2 notes, 12 sources, 3 + 10 + 1 word matches, 2 swaps, 49 keywords) and `information_schema` for
the `recipes` columns. `node test/core.test.js` (109) and `node test/build.js && node test/smoke.js`
(280) run green on the branch, exit codes read. **Not verified:** the live app, the tablet, the converter
project's copy of the instructions. The household answered 7f's three decisions and four flow questions
in the session; one answer (a hard refusal for a reconstructed recipe) was withdrawn the same session and
the plan records both. A count first given in chat (3 canned, 3 tinned) was over every line of the text;
the plan carries the ingredient-line count.

**PR 1 of the add-recipe plan, the two naming fixes (29 Sep 2026, PR #41, merged 29 Sep 10:48 UTC).** The
household's decisions 2 and 3 (`docs/PLAN-NEW-RECIPE-FLOW.md` §4). (a) `shoppingLine` now skips size
words between an article and a count unit, so `a big handful of X`, `a small bunch of X` and `a large
pinch of X` read as 1 handful, bunch or pinch; before, the article was left in the name (`a handful of
x`), with no amount and no dictionary row. (b) One helper, `foldTin`, reads `tinned` as `canned` in
`dictionaryKey`, `shoppingLine` and `fidelityItems`; in the source check only the words compared are
folded, so the preview still shows each line as written. `core.js` `2026-09-29.2` in all three places.

*Verified by.* `node test/core.test.js` **109 → 116** (seven checks added, one rewritten: the pin that
held test 8's "known gap" now expects 0 hard differences, which it gets; it was 2), exit 0; `node
test/build.js && node test/smoke.js` **280**, exit 0; `tools/generate-ingredient-names.js --check` exit
0. **Mutations, each seen failing by name:** removing the size-word skip failed the three handful, bunch
and pinch checks and the test 8 check; removing the fold from `shoppingLine` failed the row, key and
dictionary-row checks (and two older dictionary checks); from `dictionaryKey`, the dictionary-row check
alone; folding the wrong way round (canned into tinned), the key check alone; folding the line that is
shown, and not only the copy compared, failed the source check (and two older checks). **The fold in
`fidelityItems` was the one that first failed nothing.** With it removed all 116 stayed green, because
two lines that differ only by tinned/canned already share a key (the key folds inside `shoppingLine`)
and the source check treats equal keys as the same product. The words decide only where the keys
differ, as when a source says more (`canned peach slices in syrup`) against a recipe that says less; the
check now includes that pair, and then fails without the fold. The live library, read-only through
`execute_sql` into scratch and never into the repo, on `main` and on the branch: 34 recipes, 466 lines,
169 rows, 32 in Other, 0 splits, 0 lines the list cannot total, 0 the parser reads past, both times;
a per-line snapshot (key, name, unit, amount, dictionary hit) of all 466 lines is identical, **0 lines
changed**, and the 169 rows are identical. One aggregate query the same day: 0 ticks, no `source_check`
column, no `aisle_overrides` table, 14 word matches (documented as 3 + 10 + 1; the split was not re-read,
though `remeasure.js` applied 3).

**A correction to the plan.** It said the fold would change the key of the one "tinned" line. It changes
none: that line also says "canned" and its "tinned" sits inside a bracket, which no key reads. So
**neither fix touches a line in today's library** (no line has the size-word shape either). What they
change is the next line written that way, the shopping list's key for it, and the source check, where
test 8 of the converter's set goes from 2 hard differences to 0. The plan's §4 item 3, its PR 1 numbers
and §10 item 4 are corrected in place, saying so.

**Not verified:** the live app or the tablet; the household's Friday-morning rule for a naming change
(the plan leaves it to them, and nothing here needs a tick re-keyed); whether the converter project's
copy of its instructions matches the repo's. The examples in the new checks are invented (chervil, sorrel,
sumac, peach slices) and were checked against the export: none of those words appears in the library.

*After the merge (read from GitHub, 29 Sep):* the household merged it at 10:48:02 UTC as `3fce7fe`; on
that commit `main`'s tests (run 82) and the Pages deploy (run 58) both succeeded. **Not verified:** what
the deployed site serves. The session's egress policy blocks `github.io` (a 403 from the proxy), so
`core.js` `2026-09-29.2` was not read from the live site.

**PR 2 of the add-recipe plan, the converter's rule for a page it cannot read (29 Sep 2026, documentation
only, PR #42, merged 29 Sep 12:25 UTC).** `converter/conversion-instructions.md` §1 now says that a URL whose page cannot
be read is a stop: name the address that failed and ask for the text or the ingredient list, and never
convert from another page, a partner's or branded version, a search snippet or memory; any note about the
source is its own `⚠️ Source note:` line under NOTES. §3 has the matching check. `converter/test-set.md`
gains test 9, an address on `.invalid` (so no real site is named) that must produce a question and no
recipe. The bullet, the check and the test are the plan's wording, unchanged; the revision note, the
header date and the test-set counts (eight → nine, here and in `docs/DOCUMENT-INDEX.md`) are the rest.
No code, no schema, no Edge Function, no recipe text.

*Verified by.* `node test/core.test.js` 116, exit 0, and `node test/build.js && node test/smoke.js` 280,
exit 0, both before and after the change; `generate-ingredient-names.js --check` exit 0. **Test 9 against a
stand-in, not the conversion project:** a model given only the instructions (old wording from `main`, then
the new) and told what the failed fetch returned, one run per cell. With nothing else available it asked
for the text on **both** wordings; with a same-named page from another site found, the old wording
converted that page's recipe as a "draft" and the new one declined it and asked. **So test 9 as written
cannot fail without something to reconstruct from**, and it was not seen failing on the old wording; only
the variant with another page to find was. That is recorded in the test set, with the instruction to
note which tools the conversion project had. The stand-in is not necessarily the conversion project's
model, and the search result was simulated.

*Not verified:* whether the conversion project follows the rule. It has to be reloaded there and test 9 run
in a fresh chat, which no session can do (`docs/NEXT-SESSION.md`, the household's list). Nothing in the
app reads the `⚠️ Source note:` line until PR 3.

*After the merge (read from GitHub, 29 Sep):* the household merged it at 12:25:23 UTC as `c052b4c`; on that commit
`main`'s tests (run 85) and the Pages deploy (run 59) both succeeded. **Not verified:** what the deployed site
serves (the session's egress policy blocks `github.io`).

**PR 3 of the add-recipe plan, the review band (29 Sep 2026, PR #43, merged 29 Sep 14:15 UTC as `c914792`).** The add and edit form
now reads in the order the work goes: what the app read (a one-line summary, then the diagram), the checks, then
the fields, with every existing id kept. Pasting parses at once; editing the text afterwards shows a stale bar with
RE-CHECK; the source check runs by itself for an `https` link that has not been fetched for since the form opened
(never on opening Edit, and never twice for the same link); a `⚠️ Source note:` line shows as a row, red when it says
the page was not read; the shopping-list section lists the names new to the library with where each lands (Other
marked) and "Same as X?" **as text only**; a recipe with the same source link is found, with SHOW IT; WRITE ONE BY HAND
fills an empty box. Read-only throughout: no write, no dialog, nothing that holds a save back. `core.js` gains
`sourceNoteIn`, `normalisedSourceUrl`, `linesHash` (for PR 5) and `newRecipeReview`; `core.js` is `2026-09-29.3` in
all three places. `test/validate-recipes.js` takes `--source <file>`, warns on a reconstruction note, and reports its two
ingredient-name lines from `core.js` run in the page instead of a second reading of `ingredient-names.md`.

*Verified by.* `node test/core.test.js` **116 → 126** (the plan's ten checks) and `node test/build.js && node
test/smoke.js` **280 → 292** (the plan's ten browser checks, plus two of mine: that reading, pasting and reviewing
writes nothing, and that Edit leaves the edited recipe out of its own review and fetches nothing), both exit 0, and
`generate-ingredient-names.js --check` exit 0. **All 280 existing smoke checks passed unchanged**, so no check I did not
write had to change. **Mutations, each seen failing by name:** 15 on the `core.js` functions and 21 on the page, run
against a review-only harness (a temporary copy of the suite's boot code and the new block, deleted before the commit),
each failing at least one named check; the first browser pass was not clean and is worth recording: three mutations
ended in a crash from a click that timed out on a missing control rather than a failed check, one read a missing
element (all three now fail by name, having been made null-safe), and one (moving the bands with CSS `order`) was
ineffective, since the form's inline `display:block` overrides it, and was replaced by one that moves the bands in
the DOM. The validator has no suite, so its seven new output lines were mutated by hand and each changed the output;
comparing it with `main`'s on the same invented batch found a regression, the `totals on the shopping list as` line
had gone silent (it compared the wording's key with the row's, which differ by definition for a synonym), fixed before
commit. **Measured, read-only:** the live database still has no `source_check` column and no `aisle_overrides` table, 0
ticks, 34 recipes; the library's own recipes reviewed one at a time against the other 33 (as Edit would) give a median of 2
new names per recipe (at most 9; 6 of 34 have none), 31 new names landing in Other across 15 recipes, **0** "Same as"
pairs and **0** duplicates by source link, in about 24 ms per review (59 ms at most); 33 of 34 recipes carry an `https`
link, so the source check would run by itself on parse for nearly all of them, and exactly **two** recipes have a source-note
line, both reconstruction notes (the plan's "third recipe's note" is not found by its own rule; corrected in place).

*Where it differs from the plan* (recorded as "Built as" in its PR 3 entry): `#addChecks` already existed and is Band 3's
container; `#addUnread` is the first block inside it, so an existing check that reads NOT READ through `#addChecks` stays
valid; Edit does not auto-run the source check; a comparison the form fetched is redrawn after a re-parse with no second
fetch; `closeAddModal` now empties the link field, which it had always left behind and which would now have sent the next
recipe's check to the wrong page.

*Not verified:* the live app and the tablet. The reordered form is the visible change and only a person on the tablet can
judge it (`docs/TEST-PLAN.md` step 36d). The paste is tested with a synthetic `paste` event, not a real paste on iPadOS or
Android. The auto-run is tested against the stub, never the real `source-ingredients` function or a real site.

**PR 4 of the add-recipe plan, answers in place and no dialog left (29 Sep 2026, PR #44, merged 29 Sep 16:02 UTC as `eee0f43`).** The
add and edit form now gives its answers where the questions arise, and writes only what is tapped, each through the
function that already writes that kind of row. A "Same as X?" row has SAME (which asks once more, "for every recipe?
MERGE · CANCEL", and writes only at MERGE: the new name is the alias, the existing one the canonical) and KEEP APART. A
row under SOURCE (`#sourceSpellRow`) replaces the save handler's `confirm()`: a spelling settled before is put in the
field and said so, and a spelling that looks like an existing source is asked about with USE THAT and KEEP MINE. USE THIS
and SCALE TO SERVE each have an UNDO. A BEFORE YOU SAVE list (`#addBeforeSave`) names exactly what the save will do: the
header lines it will rewrite, a photo it will copy, keywords it will add, and on Edit ticks it will reset. **No dialog
remains in the add path.** `core.js` gains `changedHeaderKeys`, and is `2026-09-29.4` in all three places.

*Verified by.* `node test/core.test.js` **126 → 129** (three checks for `changedHeaderKeys`) and `node test/build.js &&
node test/smoke.js` **292 → 312** (the plan's thirteen browser checks and seven of mine), both exit 0, no console or page
errors, and `generate-ingredient-names.js --check` exit 0. **One existing check had to change, by one clause**, and this is
worth reading: PR 3's `…and "Same as X?" is text only` asserted that the review had no buttons at all, which PR 4 exists
to change, so it now asserts that the "Same as" row has exactly its two. I ran the previous suite unamended against the new
build to be sure it was the only one: 292 checks, 1 failed, and the other 291 passed unchanged. Whether that counts as §11
item 2 ("a check you did not write fails") is the household's call. **Mutations, each seen failing by name:** 6 on
`changedHeaderKeys` and 30 on the page (the merge direction reversed, SAME writing at the pick, a `confirm()` left in the save,
the header list computed from the fields instead of the text, CANCEL and KEEP APART writing, a settled pair offered again,
USE THAT not setting the field, KEEP MINE writing the wrong kind, an unanswered save writing an alias, each undo putting back
the wrong text or not remembering it, every keyword listed as new, the photo line missing or shown for our own, a settled
spelling not put in the field or ignored at save, the undos never dropped after an edit, the ticks line on every Edit, the
list not recomputed on input, the save no longer adding keywords, asking writing, the SOURCE row not following the field, the
guard not saying "for every recipe", the list not redrawn after MERGE, the empty list still shown, and the text box not
refreshing the list), run against a temporary harness of the suite's boot code and the new block (deleted before the commit).
**Two things worth recording.** Reading my own diff found a gap, that an edit to the text box did not refresh BEFORE YOU
SAVE (the box is outside `#addForm`), so a line edited and not yet re-checked was not named as one the save would write back
over; the check I wrote for it **passed without the fix**, by accident, because `page.fill` moved focus off the title field
and that blur fired a `change` which refreshed the list. It now sends the `input` event straight to the box, fails without the
listener, passes with it, and has its own mutation. **Measured, read-only, from the live-library export taken for PR 3
earlier on 29 Sep (not re-read today):** 0 "Same as" pairs, 0 pairs among the 12 distinct sources that the similar-source rule
would offer, and an untouched Edit-save would rewrite the header lines of **0** of 34 recipes; 14 word matches (3 ingredient, 10
ingredient-kept-apart, 1 source). So today's library would show none of the new rows until a new name or spelling arrives, and
they are tested with invented recipes only. The diff was scanned mechanically for 472 strings from that export (titles,
sources, links, ingredient lines, word matches): one hit, the single word `onion`, which is also one word match's target and is
not a pair or a line.

*Where it differs from the plan* (recorded as "Built as" in its PR 4 entry): `core.js` gained `changedHeaderKeys`, which the
entry does not name; the keyword line compares with the stored vocabulary, not `fullKeywordVocab`, because that is what
`mergeKeywordVocab` writes against; the ticks line shows only when there are ticks; each undo is offered only while the text is
exactly what the step left; the settled-spelling lookup stays in the save (a plain lookup, no dialog, no write) and what went is
the `confirm()` and its two writes. **One behaviour changes:** cancelling the old dialog wrote a `source_distinct` row, and an
unanswered row now writes nothing and is asked again next time.

*Not verified:* the live app and the tablet (`docs/TEST-PLAN.md` step 36e, which **writes**, so it uses a made-up recipe and
is undone in Settings). Every write is tested against the stub, so a green run says nothing about the real `aliases` table,
RLS or the write queue for these calls, though each is the same `addAlias` call the shopping list and Settings already make.
Whether the buttons are easy to hit on the tablet. That the Settings word-match list is redrawn after a tap (called, not
asserted). What the deployed site serves. I also did not read `main`'s own test and Pages runs after PR 3 merged.

**PR 5 of the add-recipe plan, the comparison recorded on the recipe (29 Sep 2026, PR #45, merged 17:12 UTC as `9c4b6f7`; its SQL
statement applied by the household after the merge).** A comparison with the source page is now remembered by the add and edit form
and written by SAVE, and only by SAVE, as `recipes.source_check`: `{at, route, hard, soft, sourceLines, linesHash}`, the counts
(the table's own "N to look at" and its shaded notes) and a hash of the ingredient lines it was of, never the page's text or a
pasted list. The viewer says what is recorded in a chip beside the source link (COMPARED … · NO DIFFERENCES or N DIFFERENCES,
COMPARED BEFORE THE INGREDIENTS CHANGED, NOT COMPARED WITH ITS SOURCE, and CARRIES A SOURCE NOTE, red when the note says the
page was not read); Edit shows the stored result with RE-CHECK; BEFORE YOU SAVE says what the save records; export carries it and
import restores it, and an older backup without it imports as none. **The column does not exist on the live database** (read,
read-only, at the start of the PR 5 session on 29 Sep: `recipes` has no `source_check`, no `aisle_overrides` table, 34 recipes, 0 ticks, last migration
`20260928123928`). The statement is `docs/migrations/add-recipes-source-check.md`, a markdown page because `.gitignore` excludes
`*.sql` on purpose; **a session did not apply it, and the household applies it before merging.** `core.js` gains `fidelityCounts`
and `sourceCheckStatus` and is `2026-09-29.5` in all three places. **Applied, 29 Sep:** the PR merged before the statement had been run (read-only checks
at 17:19 and 17:29 UTC still found no column), and the household then ran it from the dashboard's SQL editor. **Checked,
read-only, at 18:25 UTC:** `source_check | jsonb | YES`, 0 recipes holding a value, and no new row in
`supabase_migrations.schema_migrations`, since the SQL editor does not record one. Step 36f is now the household's to do.

*Verified by.* `node test/core.test.js` **129 → 133** (four checks) and `node test/build.js && node test/smoke.js` **312 → 329**
(seventeen browser checks: the plan's six and eleven of mine), both exit 0, no console or page errors, and
`generate-ingredient-names.js --check` exit 0. **Both suites were green, exit 0, on unchanged `main` first (129 and 312), and all
312 existing smoke checks and 129 Node checks passed unchanged against the new code before I added any check**, so no check I did
not write had to be amended (no §11 item 2 this time). **Mutations, each seen failing by name:** 7 on the new `core.js` functions
and 28 on the page (the hash taken of the whole text, a comparison writing by itself, the column dropped from `recipeToRow` or
from `rowToRecipe`, a recipe with none sending null, SAVE not recording, the route always `function`, the recorded count always 0,
a changed recipe shown as compared, no chip for none, a reconstruction note not red, a chip on the cards, Edit showing no stored
result, Edit fetching on opening, RE-CHECK not wired, each wording of BEFORE YOU SAVE, an Edit with no comparison wiping what was
recorded, the viewer hashing the whole text, the stored line or the band not redrawn, the pasted text kept with the record, a
closed form keeping its comparison, an answer for a closed form or for a changed link still recorded, and three that made the
count read 0), none crashing. They ran against a temporary harness of the suite's boot code and the new blocks (deleted before
the commit), and `index.html` and `core.js` were restored and compared byte-identical after each run.
**Four things worth recording.** (1) **Reading my own diff found a real bug:** an answer from the source check that arrived
after the form had closed would have set the comparison on the *next* form and been saved against the wrong recipe, and a slow
older answer would have replaced a newer one for a changed link. Two checks were written first and **seen failing** (the next
recipe's band read "compared, but the ingredients changed since"; the older answer's count won), then a guard was added to
`compareWithSource`. (2) **One mutation of that guard survived** (removing the closed-form half), because the link comparison
alone caught every case I had tried; it is only needed when the same link answers into a different form, so a third check
was written for exactly that (Edit of a recipe with that link, opened while the answer was in flight) and the mutation now fails.
(3) **The first scan of the diff found three real library strings in my new test data** (two ingredient lines and one
household word match, deliberately not repeated here); all were swapped for invented lines, and the rescan finds one hit, a
single generic ingredient word, which is not a line or a pair. **The first rescan of the documents then found that this very
paragraph had named them**, which is why it does not. (4) **My first attempt to
ship the migration as a `.sql` file was silently ignored by `.gitignore`** (`*.sql`, on purpose); it is a markdown page instead,
and the ignore is unchanged.

*Where it differs from the plan* (recorded as "Built as" in its PR 5 entry): the column is sent **only when the recipe has one**,
not as `null` on every save, so merging before the migration is applied breaks only the first save that carries a comparison
and not every save (the write queue resends a failed write, so an unmigrated column would otherwise stop all saving); Edit
**does not fetch the source page on opening**, as in PR 3, and shows what is stored (a **decision for the household**: §5 reads as
though it should run the check on opening when nothing fresh is stored, which would fetch the page for every recipe opened, and
reverse a PR 3 check); two pure functions the entry does not name; the chip is in its own element, `#viewerProvenance`; BEFORE
YOU SAVE says "not compared" only when there is an `https` link to compare against. **A known limit, not built:** the value has no
URL, so changing the link and saving without comparing again keeps a result that was about the old page.

*Not verified:* the live app and the tablet (`docs/TEST-PLAN.md` step 36f, after the migration is applied and the PR merged). The
migration itself, which has not been run. That a real Supabase upsert stores the object in a `jsonb` column and that `select('*')`
returns it: the suite stubs Supabase, so a green run says nothing about the real table, RLS or the write queue for this column. The
real `source-ingredients` function or a real site. What the deployed site serves. `main`'s own test and Pages runs after PR 4 merged
were not read.

**The source check named a web page's line of alternatives by its first word (29 Sep 2026, after PR 5).** Found by the household's
step 36f on the tablet: a comparison drew the recipe's ground almonds line beside **both** of the source's almond lines, and left the
recipe's flaked almonds line on its own, as the one difference. The recipe's text was right (read-only: one line of each). **Root
cause, reproduced in Node:** `fidelityName` reads a name as the text before the first comma, which is the recipe's format but not a
web page's; the source's "sliced, slivered, or chopped almonds" was named `sliced`, which is a preparation word, so the line had no
name and no name words, and "ground" being a preparation word too, the recipe's ground almonds line read as plain almonds and joined
it by the looser "the recipe says less" rule. With no exact partner on either side, both source lines joined one group with the
ground almonds, and the cups against grams hid the totals. **Fix:** when the text before the first comma names nothing (no content
word and no dictionary name, as `fidelityItems` already judges it), the name is that first alternative with the noun the list ends
on, "sliced almonds", which the dictionary calls flaked almonds. The first version keyed "names nothing" on content words alone, and
the dictionary sweep failed on "2 whole cloves, cut into matchsticks" (all count words, but a dictionary name); it now asks the
dictionary as well. `core.js` `2026-09-29.6` in all three places. No change to `shoppingLine` or the dictionary, so no tick is
re-keyed.

*Verified by.* `core.test.js` 133 → 134 (one check, invented lines, seen failing by name against the old `fidelityName` with the
fault's own shape, then passing), `source-ingredients.js` 12, `smoke.js` 329, `generate-ingredient-names.js --check`, all exit 0.
**Measured, read-only:** all 126 comma lines in the live library (88 distinct texts before the comma) name something before it, so
the new reading never applies to a recipe line, only to a source's. The household's line pair reproduced the fault and, with the fix,
pairs each almond line with its own; the only note left is a soft "the recipe adds flaked", which `main` also gives for a plain
"sliced almonds" line (a follow-up, not this change: "sliced" is dropped as a preparation word). *Not verified:* the tablet after
the merge. **Left as it is, for the household to decide:** "ground" stays a preparation word, so a recipe's "ground almonds" still
reads as a source's bare "almonds" when neither has an exact partner; making it part of the name is a naming question for the
shopping list too, so it needs a re-measure first. The recipe's stored `source_check` (1 difference) stays until it is compared and
saved again.

**PR 5b of the add-recipe plan, SAME AS… in the review (29 Sep 2026).** Asked for by the household after a recipe's "Whole rolled
oats" was listed as new and landing in Other while the library had "Rolled oats": the strict rule never pairs across a word on
`NEVER_IGNORE`, so nothing asked. Every new row with no pending "Same as" now has SAME AS…: a filter over the names already in the
library (the recipe being edited left out), a pick, the guard SAME shows, and only MERGE writes, one `ingredient` alias through
`addAlias`. `index.html` only; no schema, no `core.js`, no naming change. The plan's PR 5b entry has the detail and the "Built as".

*Verified by.* `smoke.js` **329 → 333**, `core.test.js` 134, both exit 0, no console or page errors. **Two existing clauses were
amended (§11 item 2, put to the household in the PR):** the unamended suite against the new build failed exactly PR 4's row check
and its settled-pair check, each on its button count alone. Six mutations, each seen failing by name; `index.html` restored and
compared byte-identical after the run. *Not verified:* the tablet, and a real tap in the filter box on iPadOS or Android.

**PR 6 of the add-recipe plan, shopping aisles (29 Sep 2026).** The household's aisle for an ingredient: a new
`aisle_overrides` table (`docs/migrations/add-aisle-overrides.md`, **the household applies it before merging**), SHOPPING
AISLES in Settings with ADD and REMOVE, and on the add form's review an aisle list on a new name that lands in Other, which
writes at once and says "Moved to … · UNDO". `core.js`: `aisleOverrideMap`, a third parameter on `aggregateShoppingLines`
applied after the key is final, and `aisleWhy` on every row. **The first PR to touch `hydrate()`:** the new table is read apart
and a missing table does not sign anyone out; the feature says it is unavailable instead. Export and import carry the aisles.
The plan's PR 6 entry has the "Built as". `core.js` `2026-09-29.7`.

*Verified by.* `core.test.js` **134 → 138**, `smoke.js` **333 → 342**, both exit 0, no console or page errors, and **no
existing check changed**. Node mutations on the new `core.js` code each fail a named check; two survived a first round (an
override looked up by the display name, and a keyword aisle reported as the dictionary's) because every test name's display
equalled its key and the only keyword case went through the pepper rule, so "4 lamb shanks" was added and both now fail. The
first browser run caught a test fault, not an app fault: the tomato row lists "Test Pasta" among its recipes, so ticking "the
row with pasta in it" ticked the tomatoes; rows are now found by their own name. **Twelve page mutations, each seen failing by name:** `hydrate`
throwing on a missing table, the list or the review ignoring aisles, the aisle list on every row, while unavailable or beside
a pending "Same as", a delete by id instead of name, an UNDO that does nothing or is not shown, export writing the key while
unavailable, the Settings form shown while unavailable, and a name stored as typed. That last one first **survived**: both
callers passed an already-keyed name, so the keying inside `addAisleOverride` was never exercised. Settings now passes the typed
text and `addAisleOverride` is the one place a name is keyed; the mutation then failed two checks. `index.html` was restored and
compared byte-identical after the runs. The live `aliases` definition and the
project's default privileges were read (read-only) to draft the migration: new tables in `public` grant `anon` everything by
default, hence the revoke. **The migration was applied by the household between 20:40 UTC (read-only: no table) and 20:49 UTC, when PR #49
merged**, and the table was read back read-only that minute exactly as drafted (columns, RLS, four policies, keys, no `anon` grant). *Not verified:* a real
write through RLS and the upsert on `(household_id, name)`, the tablet (`docs/TEST-PLAN.md` step 36g), and a real select on iPadOS or Android. **Counts corrected
in passing:** `CLAUDE.md`, `test/README.md`, `docs/ARCHITECTURE.md` and `docs/DOCUMENT-INDEX.md` still said 133 and 329, which
PRs #47 and #48 should have moved.

**Ground almonds are not almonds (29 Sep 2026, the household's decision).** After PR #47, the granola comparison still read the
recipe's "ground almonds" as plain almonds: the comparison drops preparation words, and "ground" is one, although the shopping list
keeps it where it changes what you buy (`AGGREGATION_PREP_WORDS`, `NEVER_IGNORE`), so the list already had them as two rows. Now
the comparison keeps "ground" wherever the list's key keeps it ("ground almond", "ground caraway", "ground cumin") and drops it
where the key does ("freshly ground pepper" is black pepper). Setting them apart then flagged the source's "almond flour or almond
meal" against the recipe's ground almonds, which in the UK are the same thing, so two more, **both asked for or approved by the
household:** a dictionary row **"ground almonds" (Pantry), also "almond flour, almond meal"**, and a source written "X or Y" is read
as its first alternative when the dictionary knows that and not the whole (the recipe's format keeps alternatives in brackets).
**Measured read-only before the row was added:** the library's 10 almond lines, 0 change key; the only visible change is "Ground
almonds" moving from Other to Pantry; 0 ticks stored; 0 library lines have "or" in their name. `core.js` `2026-09-29.8`, dictionary
139 → 140 rows, `converter/ingredient-names.md` regenerated.

*Verified by.* `core.test.js` **138 → 142**, `smoke.js` 342, `source-ingredients.js` 12, the dictionary check, all exit 0. **Two
existing checks were amended, both by the decision itself:** the dictionary's row count (139 → 140), and `fidelityCounts`, whose
example counted "3 tsp caraway" against "3 tsp ground caraway" as the same (now one of four). The household's granola lines, run in
scratch and not committed: 0 to look at (1 before #47, 0 after it but only because ground almonds were being read as almonds), and
one shaded note, "the recipe adds flaked", which is older and unrelated. Six mutations, each failing a named check; one (the last
alternative instead of the first) first survived because almond flour and almond meal are the same row, so an olive oil or butter
check was added. *Not verified:* the tablet.

**PR 7 of the add-recipe plan, Settings: ingredient lookup and dictionary (29 Sep 2026).** Two read-only blocks above WORD
MATCHES. INGREDIENT LOOKUP takes a wording as a recipe would write it and says what the shopping list calls it (the dictionary's
name, or "your own wording"), its aisle and why (dictionary, keyword rule, the household's own, or Other with a pointer to Shopping
Aisles), the word matches touching it from either side with FORGET, and the swaps for its name with EDIT. It runs the wording
through `aggregateShoppingLines` with the household's matches and aisles, so it cannot disagree with the list. DICTIONARY lists
every row by aisle with its live wordings, filtered by the same box. The Swaps subtitle no longer describes the substring match
6d-2 replaced. `index.html` only.

*Verified by.* `smoke.js` **342 → 350**, `core.test.js` 142, both exit 0, **no existing check changed**. The first run failed two
of the new checks on the test's own setup, not the app: by then the PR 6 block had reloaded the stub, which has no swap, so the
test now adds an invented one and removes it. **Nine page mutations, each seen failing by name:** the dictionary never
known, every aisle said to be the dictionary's, word matches found from one side only, FORGET removing nothing, swaps matched by
substring (so butter's catches peanut butter), EDIT going nowhere, the dictionary list unfiltered, the lookup ignoring word
matches, and the old Swaps subtitle; `index.html` restored and compared byte-identical after the run.

**PR 8 of the add-recipe plan, Settings: library check (29 Sep 2026).** The audit the conversion-integrity finding asks for,
and the plan's last PR. LIBRARY CHECK → RUN lists every recipe with its standing against its source, read by the viewer chip's own
rules (reconstruction note, not compared, compared before the ingredients changed, *n* differences, no differences, or no source
link to compare), and the names it puts in Other; those needing attention first; a box to show only those; OPEN goes to the edit
form. Nothing is written from it. `index.html` only. The plan's PR 8 entry has the "Built as" (a sixth status for a recipe with no
link, which could otherwise never leave the list).

*Verified by.* `smoke.js` **350 → 357**, `core.test.js` 142, both exit 0, **no existing check changed**, with six invented recipes,
one per status, whose stored comparisons carry the hash of their own lines. The first run failed three new checks on the test's
data, not the app: "red lentils" lands in Other with the dictionary, so the "no differences" recipe rightly needed attention; it
now uses carrots. **What RUN will show on the live library** (read-only, 22:17 UTC): 34 recipes, 2 with a reconstruction note
(first, in red), 1 compared (its stored result says 1 difference until it is compared and saved again), 33 with an `https` link and
1 without. **Nine page mutations, each seen failing by name:** a reconstruction note missed, a stale comparison read as fresh,
RUN writing, the attention sort dropped, the "only those" box ignored, OPEN going nowhere, names in Other ignored, a recipe with
no link read as not compared, and the number of differences hidden. "Attention first" at first **survived**: with every
attention row also ranked above every other, sorting by status alone gave the same order, so a recipe with no link but a name in
Other was added, which only attention-first puts above one needing nothing. `index.html` restored byte-identical after the run. *Tablet:* 36h (PR 7) and 36i reported done by the household, 30 Sep.

**Autocomplete on the ingredient boxes, Settings and Swaps (30 Sep 2026).** Asked for by the household after the tablet passes of
PRs 6 to 8, planned in `docs/HANDOVER-2026-09-29-SESSION.md` §7 and built on their "go", with both decisions answered: Swaps too,
and the aisle box offering the library's names only. A native `<datalist>` on six boxes, as the diary title and the form's SOURCE
already use. `#ingredientVocab` (every name the library's shopping list uses, every dictionary name and wording, both sides of
every ingredient word match; lower case, each once) serves the ingredient lookup, both Word Matches boxes and both Swaps boxes;
`#libraryIngredientVocab` (the library's names alone) serves Shopping Aisles. Word Matches follows its kind select to the sources
in use (`#sourceVocab`, now filled when Settings is drawn too, by `fillSourceVocab`). Refilled when Settings or Swaps is drawn
and after a word match is added. A suggestion only fills the box; nothing is written by one. `index.html` only: no `core.js`
change, no schema, no naming change.

*Verified by.* `smoke.js` **357 → 363**, `core.test.js` 142, both exit 0, **no existing check changed**. The lists are emptied
before the block, so what it sees is what drawing Settings put there. Invented names (sea purslane, marsh samphire), checked
read-only against the live recipes and word matches first: neither appears. **Ten page mutations, each seen failing by name:**
a box without its list, the aisle box on the full list, the dictionary left out, names not lower-cased (duplicates), the kind
select not followed, the sources not filled from Settings, the list not refilled after a match is added, Swaps not filling the
list, word matches left out, and the aisle list given the dictionary's names. `index.html` restored after each, `git diff`
empty. *Not verified:* how the tablet shows the suggestions; a headless browser draws no datalist dropdown
(`docs/TEST-PLAN.md` step 36j).

**The ingredient boxes' own dropdown, replacing that datalist (30 Sep 2026).** The household's first tablet try (08:03 local):
the laptop drew the datalist as a short scrolling box, but the tablet's Chrome drew it as a full-screen menu of every name,
opened on the first tap before anything was typed. A page has no say over how a datalist is drawn, so the six boxes now use the
app's own dropdown, the keyword list's look (`renderIngredientSuggest` in `index.html`): about five rows (190px) and scrolling inside
itself, placed under its box by script so no row's layout changes; nothing until something is typed; names starting with it first,
then names containing it; closed when the only name left is the one typed, on Escape and on leaving the box; the arrow keys and
Enter as the laptop's list had; a tap fills the box and tells it so, as typing would. The names are worked out when a box is
focused, so the refills #55 wired in are gone. The same names per box as #55 (the aisle box the library's only; Word Matches the
sources in use when SOURCE is picked). `index.html` only, no data or naming change.

*Verified by.* `smoke.js` **363 → 366** (the six #55 checks replaced by nine that can now check the list itself), `core.test.js`
142, both exit 0, no other check changed. Screenshots at 1280×800 and 700×900 in the session: the list sits just under the box, as
wide as it, over the page below. **Fifteen page mutations, each seen failing by name:** no cap, open on an empty box, starting
matches not first, not closing on the only name left, a pick that does not tell the box, a pick that reopens the list, no arrow
keys, no Escape, not closing on leaving the box, the aisle box on the full list, SOURCE ignored, the kind change leaving a list open,
names worked out once only, word matches left out, and the list not placed under its box. "Leaving the box" at first **survived**:
the test pressed Escape first, so the list was already shut; it now reopens the list before leaving. The first run also failed one
check on the test's own typo ("almond me" is not the only name left). Each mutation ran in its own worktree, removed after.
*Not verified:* the tablet: whether a name is easy to tap, and whether scrolling the list ever picks one (a synthetic mousedown
cannot tell); `docs/TEST-PLAN.md` step 36k.

*Added before merging, after the household's phone screenshots (09:22 local, still the #55 datalist, since this PR was not yet
merged).* They showed two things this PR had not handled. **A box just above the keyboard:** Chrome scrolls a focused box only
just clear of the keyboard, so a list opened under it would sit behind the keyboard; the list now opens above the box when
`visualViewport` shows more room there. **LIBRARY CHECK's tick box**, stretched to 150px by `.alias-form input` and left floating
mid-row with its words at the far edge; a more specific rule keeps it its own size. `smoke.js` **366 → 367**: one check at
412×560 with the box at the foot of the screen (list above it) and at the top (list below), plus the tick box's width. Seen
failing: never opening above, always opening above (which also fails the placement check), and the tick box at 150px (the first
fix lost to the later rule of equal weight). Screenshot at 412×560, dark: the list above the box, opaque.
*Tablet:* 36k reported "broadly ok" by the household, 30 Sep.

**Layout, C and A (30 Sep 2026), the first PR of `docs/PLAN-LAYOUT.md`.** Planned with mockups and agreed "all as suggested"
the same day. **C:** a step's words sit at the foot of its box (`vertical-align: bottom` on `.box-cell`), level with the last
ingredient into it, on screen, in print and in the PNG, since print has no rule of its own for it. **A:** the add/edit dialog
fills the screen less 20px, to 1600px (`#addModalOverlay` only; it is the one `.modal-panel`), and the recipe box is
`max(240px, 50vh)` tall. `index.html` only.

*Verified by.* `smoke.js` **367 → 369**, `core.test.js` 142, both exit 0, no other check changed. **Four page mutations, each
seen failing by name:** the bottom alignment removed, a print rule putting it back to the middle, the dialog's width cap put
back, and the recipe box's height put back. Screenshots at 1280×800 of Test Pasta and its edit dialog. *Not verified:* the
tablet (`docs/TEST-PLAN.md` step 37a).

**Layout D (30 Sep 2026): Shopping Aisles says where a name goes now.** `renderAisleOverrideNow`: under the box, what the list
calls the name, its aisle and why (`ingredientLookup`'s answer, so it matches INGREDIENT LOOKUP), the aisle picker set to it as
the name is typed, and ADD greyed out while the picker shows the aisle the name has already. The household's own aisle gets
REMOVE there, naming where the name goes back to (worked out without the household's aisles). A name no recipe uses is said so.
`.btn:disabled` is new. `index.html` only.

*Verified by.* `smoke.js` **369 → 372**, `core.test.js` 142, both exit 0, no other check changed (the PR 6 checks, which type a
name and pick another aisle before ADD, pass as they were). "Smoked eel", the invented name, checked read-only against the live
recipes, word matches and aisles first: none. **Seven page mutations, each seen failing:** the picker not set, ADD never greyed, the
line not following typing, "no recipe uses" inverted, REMOVE not wired, and the "goes back to" aisle lost, each by name; and ADD
not following the picker, which the suite reports as a crash at the PR 6 check's ADD click (the button stays greyed, so
Playwright waits on it) before the new check is reached. Same fault, earlier symptom; the older check was left as it was. *Not verified:* the tablet (`docs/TEST-PLAN.md` step 37b).

**Layout B (30 Sep 2026): cooking mode.** With KEEP AWAKE on, the recipe viewer hides FAVOURITE, + SHORTLIST, EDIT, EXPORT
PNG, PRINT, DELETE, the source chip and COOK FOR, and the Group Viewer hides EXPORT PNG, PRINT and UNGROUP: CSS on the
`.app.keep-awake` class the toggle already sets, so turning it off brings them all back. The header is pinned (`sticky`); the
timeline is hidden while cooking until SHOW TIMELINE, which is remembered per device (`kitchen.cookingTimeline`). No "COOKING
FOR n" text was added: the meta line's "SERVES 6 (SCALED FROM 4)" already says it. `index.html` only.

*Verified by.* `smoke.js` **372 → 376**, `core.test.js` 142, both exit 0, no other check changed. Screenshots at 1280×800 and
412×800 with KEEP AWAKE on. **Seven page mutations, each seen failing by name:** DELETE left showing, the
Group Viewer's buttons left showing, COOK FOR left showing, the timeline shown by default, the header not pinned, SHOW TIMELINE
not remembered, and the switch showing outside cooking mode.

**Layout E (30 Sep 2026): Settings in three tabs, with Swaps.** INGREDIENTS (lookup, word matches, aisles, swaps, dictionary),
LIBRARY (library check, sources, keywords, photos) and APP (week start, appearance): blocks marked `data-settings-tab`, shown and
hidden by `showSettingsTab`, the last tab remembered per device (`kitchen.settingsTab`), the tab bar pinned. The Swaps screen and
its sidebar entry are gone; its form and list moved into Settings with the same ids, so every swap handler is unchanged, and
`showView('swaps')` (the lookup's EDIT) opens Settings → Ingredients at Swaps. The dictionary is folded behind "SHOW ALL 140 ROWS"
and opens by itself to the matching rows when the lookup is typed in. `index.html` only. Tablet passes 37a–37c reported passed by
the household the same day.

*Verified by.* `smoke.js` **376 → 379**: four new checks, less the sidebar walk's Swaps step. **Existing checks that changed, all
for the move and none weakened:** the sidebar walk no longer visits Swaps; the appearance and library-check checks pick their tab
first (and Ingredients again after, since the tab is remembered); the lookup's EDIT now expects Settings with Swaps showing; the
autocomplete check opens Swaps through `showView`; and #56's tick-box width check now also requires a width above 5px, since a
box on a hidden tab measures 0, which passed "under 30". `core.test.js` 142. Both exit 0. "Sea kale", the invented swap, checked
read-only against the live recipes and swaps first: none. **Eight page mutations:** tabs not hiding, Sources on the wrong tab, the
dictionary never folded, the lookup not opening it, Swaps not drawn when Settings opens, and SWAPS back in the sidebar each failed
by name; no redirect for the old screen failed the EDIT check by name, then crashed; the tab not remembered crashed early, at the
appearance check's control on a tab no longer shown. Screenshots at 1280×900 and 412×860. *Tablet:* 37d reported "ok" by the
household, 30 Sep, after PR #60 merged. The layout plan is finished, and every tablet step of it (37a–37d) has passed.

**Keep Awake on the Android tablet (reported 30 Sep 2026).** The household reported that Keep Awake works on the Android tablet,
the one thing `docs/TEST-PLAN.md` had left "deferred to the tablet" since the first build, because no desktop browser can show a
screen that would otherwise dim. *Not stated:* whether that was the Recipe Viewer, the Group Viewer or both, and which of the two
methods (the screen-lock API or the video fallback) the status line named; the status line says which when it is on.

**Converter test 9 passed (30 Sep 2026)**, run by the household in the conversion project after reloading
`conversion-instructions.md` alone: it named the address it could not read, converted nothing, said why, and asked for the text.
Recorded in `converter/test-set.md` with its two caveats: the reason it gave ("the site blocks automated access") is a guess for a
`.invalid` address, and the chat's tools were not stated, so the run does not test the case the rule exists for (a page it could
have reconstructed from).

**Five BBC Good Food recipes were rebuilt, not read (found 30 Sep 2026).** Converting a BBC Good Food page after the 29 Sep
rule, the household saw it stop (the site blocks the converter's fetch) and then found, in the conversion chat that had made the
library's BBC Good Food recipes before that rule, the converter's own words: bbcgoodfood.com was blocking it, so it "pulled all
five from BBC Good Food's own Middle East edition (bbcgoodfoodme.com) ... cross-checked against independent reproductions where
needed". None of the recipes says so: read-only on 30 Sep, the library has **six** BBC Good Food recipes, none with a source note
and none compared with its page, and one (*Easy Pilau Rice*) still links to bbcgoodfoodme.com. Which five were in that batch is
in the household's chat, not here. **What to do, the household's:** compare each against its real page with COMPARE PASTED LIST
and save; any that differ join D6. The one *BBC Food* recipe (bbc.co.uk, a different site) was converted on 22 Sep, also before
the rule, and is uncompared too.

**Converter: pasted page text needs no source note (30 Sep 2026).** The same conversion offered to add a `⚠️ Source note:` for a
recipe made from pasted text. Checked against `RECONSTRUCTION_WORDS` in `core.js`: "made from text you supplied" passes as
ordinary, but "the page itself could not be fetched" or "could not be read" flags the recipe as reconstructed in LIBRARY CHECK and
the viewer. `converter/conversion-instructions.md` §1 now says pasted text, a screenshot or a photo of the page is the page,
converted with no note unless something is missing; §3 checks it; `converter/test-set.md` test 10 tests it. **The household
reloads the file into the conversion project** and runs test 10. No app change. *Done 30 Sep:* the household reloaded it and test 10 passed.

**VALIDATE INGREDIENT LIST, and OPEN SOURCE (30 Sep 2026).** Asked for by the household after comparing *Easy Pilau Rice*
(one difference: "salt, to taste", taken from the method, which they were happy with): "1 difference" read as a problem still
open. The chip now says COMPARED with its count, and VALIDATE INGREDIENT LIST (all the differences in one tap, as asked) turns it
to **VALIDATED** and the date. Offered under a comparison run in the form and beside a stored comparison still of these lines, so
a recipe compared earlier needs no second paste; pending until SAVE, with UNDO; SAVE writes `validated` into that comparison;
LIBRARY CHECK reads it as "validated", not needing attention; a change to the ingredient lines lapses it with the comparison, and
a new comparison asks again. `sourceCheckStatus` (`core.js` `2026-09-30.1`) carries it on a fresh check only. No schema change: a
key inside `source_check`. **OPEN SOURCE ↗** (asked the same day) opens the form's link in a new tab, to copy the list for COMPARE
PASTED LIST; only an http(s) link, otherwise it says there is none.

*Verified by.* `core.test.js` **142 → 143**, `smoke.js` **379 → 385**, both exit 0. One existing check changed: Edit's stored-result
text now includes the VALIDATE button on a fresh comparison (the stale and none cases unchanged). **Nine mutations:** in `core.js`,
the validation carried on a stale check (failed by name); on the page, no VALIDATED chip, the stored validation not saved, the form's
not saved, no reset on a new comparison, LIBRARY CHECK ignoring it, UNDO not wired, and OPEN SOURCE opening any value each failed by
name; OPEN SOURCE in the same tab crashed the run by navigating away. *Not verified:* the tablet (`docs/TEST-PLAN.md` step 38a).
*Merged 30 Sep 15:01 UTC as PR #62,* on a green `offline-harness` run. *Tablet:* 38a reported "OK" by the household, 30 Sep.

**Source photos, step 1: the migration (30 Sep 2026).** The household asked to keep the photo or screenshot a recipe was
converted from, as a web recipe keeps its link. `docs/PLAN-SOURCE-PHOTOS.md` was agreed "all as suggested" the same day. This
step is `docs/migrations/add-source-photos.md` only: a **private** bucket, `recipe-sources` (images and PDF, 10 MB), with the
four folder-per-household policies of `recipe-images` renamed and `TO authenticated`, and one nullable `jsonb` column,
`recipes.source_photos`, checked to be a list. Drafted from the live bucket and its policies, read-only at 15:10 UTC. **Not
applied:** the household applies it from the SQL editor before merging. No app change, so the tests are unchanged.
Also found while planning: the nightly `pg_dump` holds the database only, so neither it nor the JSON export will hold the photos
themselves (the plan's §6.5, accepted).

**Source photos, step 2: attach, store, view, tidy (30 Sep 2026).** `index.html` only; no `core.js` change. In the add/edit form,
under SOURCE URL, **SOURCE PHOTOS** with **ADD PHOTO** (`accept="image/*"`, so the tablet offers camera or gallery), a thumbnail per
page with VIEW and REMOVE. Each picture is shrunk in the browser to 2000 px on its long edge, JPEG at 80 % (`shrinkSourcePhoto`,
turned the way the camera held it). **Nothing is stored until SAVE:** it uploads new pages to `recipe-sources` under
`<household_id>/<recipe_id>/`, queued **before** the row, writes `source_photos` (`[{path, added}]`, page order) with the row, and
deletes removed pages **after** it; a form closed unsaved stores nothing. A failed upload does not hold up the recipe: it waits in
the write queue, is sent again with the next write, and this tab shows the page from memory meanwhile. BEFORE YOU SAVE names what
is stored and deleted. The viewer shows a **SOURCE PHOTO / SOURCE PHOTOS · n** chip (hidden in cooking mode with the other chips)
opening the pages full screen by links signed for an hour: a tap shows a page at its own size, OPEN FULL SIZE ↗ hands it to the
browser for pinch-to-zoom. Under **AGAINST THE SOURCE** the ingredient lines sit beside the photos, to check by eye (whenever the
form has photos, not only without a web link, which the plan had said; a screenshot of a web page is as useful to check against).
Deleting a recipe deletes its photos, after the row. `recipeToRow` sends `source_photos` only when the recipe has a list (an
emptied one as null, since a one-row upsert keeps a column it does not name), so an ordinary save is unchanged. **If a load finds
rows without the column** (the migration not applied), ADD PHOTO is off and says why. Not in the app: PDF (the bucket allows it,
for later).

*Verified by.* `core.test.js` 143, unchanged. `smoke.js` **385 → 397**, both exit 0. The stub gained a pretend bucket
(`__STORAGE__`, `__STORAGE_FAIL__`, `storage-done:` in `__LOG__`), and the fixture rows `source_photos: null`. **Twenty mutations:**
all twenty failed a check by name: no shrinking, the width alone taken as the long edge, the upload after the row, the deletion
before it, an emptied list not sent as null, the column always sent, a week-long link, no copy kept in the tab, no deletion with the
recipe, the column always taken as present, no comparison beside the photo, Escape leaking to the viewer, no zoom, a closed form
keeping its photos, BEFORE YOU SAVE silent, REMOVE deleting at once, a failed upload not retried, ADD PHOTO on without the column,
the chip without its count, and the public bucket. (The upload-after-row run first crashed at check 324, long before the photo
checks, with four suites running at once; alone it failed by name. The crash was not reproduced.) *Screenshots* at 1280×800 and 412 wide (outside the repo): the form's section, the comparison beside the photo, the
chip, the full-screen view. *Not verified:* the real bucket and its policies (the stub is not Supabase), the tablet's camera
route, EXIF turning on a real phone photo, and whether 2000 px keeps a cookbook's small print legible: `docs/TEST-PLAN.md` step
38b, after the migration is applied.
*Merged 30 Sep 16:34 UTC as PR #63,* on a green `offline-harness` run. **The migration was applied by the household at 16:35 UTC**
(the bucket's `created_at`), a minute after the merge, so the live app briefly ran with ADD PHOTO switched off, as designed.
Checked read-only at 16:47 UTC: the bucket private with its 10 MB limit and four types, the four policies each for
`{authenticated}`, the column `jsonb` and nullable with its list check, no `anon` select on it, no files yet.
*Tablet:* 38b reported "successful" by the household, 30 Sep. Checked read-only at 17:06 UTC: one JPEG (106 KB) in
`recipe-sources`, under the household's folder and its recipe's, listed by that one recipe; no unlisted file (the removed page was
deleted) and no listed page missing.

**Source photos, step 3: CHECKED AGAINST THE PHOTO (30 Sep 2026).** `index.html` only. Under AGAINST THE SOURCE, beside the photos,
**CHECKED AGAINST THE PHOTO** records that the household read the lines against the photo: pending until SAVE, with UNDO, named by
BEFORE YOU SAVE. SAVE writes it as a comparison would be, `source_check` `{ at, route: 'photo', hard: 0, soft: 0, sourceLines: 0,
linesHash, validated }`, so `sourceCheckStatus` (unchanged) reads it as fresh and validated: the viewer's chip says **VALIDATED**
(its title "checked by eye against the source photo"), and a change to the lines lapses it like any comparison. The hash is taken
**when tapped**, so lines edited after the tap are not vouched for: the offer comes back and nothing is saved. It is offered only
where nothing else speaks for the list (no comparison in the form, none stored still of these lines; a current one is validated
with VALIDATE INGREDIENT LIST); a comparison run in the form takes its place. Edit says "Checked against the source photo" and the
date, with RE-CHECK only where there is a web link. **LIBRARY CHECK** reads it "checked against the photo", and has a new status,
"source photo not checked" (needs attention), for a recipe with photos and no link that has not been checked; such a recipe read
"no source link to compare" before.

*Verified by.* `core.test.js` 143, unchanged (`sourceCheckStatus` needed nothing). `smoke.js` **397 → 403**, both exit 0: offered and
pending with UNDO and the BEFORE YOU SAVE line; SAVE's record and the VALIDATED chip; Edit afterwards and LIBRARY CHECK's two
readings; a tap not carried to the next form, and lines typed after the tap not saved as checked; lines re-read after the tap
dropping it; a comparison in the form taking its place. **Twelve mutations, all failing a check by name** (the chip's photo branch,
the reset on changed lines, the guard at SAVE, the save itself, the BEFORE YOU SAVE line, the offer despite a comparison, LIBRARY
CHECK's new status and its wording, Edit's line, UNDO, the reset on opening a form, and the check not written as validated). In the
first round three did not: the save removed crashed the run (the test read a missing check; it now fails by name), and the guard
at SAVE and the reset on opening survived, since no check typed lines without re-reading them or reopened a form after a tap; the
check that does both was added, and all three then failed by name. *Not verified:* the tablet, `docs/TEST-PLAN.md` step 38c.
*Merged 30 Sep 17:52 UTC as PR #64.*

**Source photos, step 4: PDF sources (30 Sep 2026).** Asked for by the household once step 3 had merged ("often you can 'print'
recipes as PDFs"). `index.html` only; the bucket already allowed `application/pdf`. ADD PHOTO OR PDF (`accept="image/*,application/pdf"`)
takes a PDF **as it is**, nothing shrunk, held to the bucket's 10 MB and refused before anything is stored if larger ("over 10 MB,
too big to keep"), and refused if it does not begin `%PDF-` (a renamed web page). It is stored as `<time>-<id>.pdf` with
`application/pdf`, and its entry in `source_photos` says `type: 'pdf'` and keeps the file `name`, so an entry without `type` is a
photo, as every earlier one is. **A PDF is not drawn in the app:** it shows as a card with its name and OPEN ↗, a real link (so no
pop-up blocker) to the signed link or, before upload, this tab's copy; the laptop's browser shows it, the tablet hands it to its PDF
viewer. The chip and the viewer's title say SOURCE PDF, SOURCE PDFS · n, or SOURCE FILES · n for a mixture; the check reads
CHECKED AGAINST THE PDF (the route stays `'photo'`). BEFORE YOU SAVE's removal line now says "source file". Not changed: LIBRARY
CHECK's wording ("checked against the photo", "source photo not checked") covers PDFs too.

*Verified by.* `core.test.js` 143, unchanged. `smoke.js` **403 → 407**, both exit 0: taken as it is, and over 10 MB and not-a-PDF
refused with nothing stored; its card, name, OPEN link and the check's wording, and BEFORE YOU SAVE; SAVE storing it byte for byte
as `.pdf` with `application/pdf`, the row's `type` and `name`, the chip, and OPEN by a signed link in a new tab; a photo beside it
keeping both types, and SOURCE FILES · 2. **Twelve mutations, all failing a check by name:** no PDF in the file picker, the PDF sent through the photo shrinker, no size
cap, no `%PDF-` test, stored as `image/jpeg`, stored as `.jpg`, no `type` in the row, the type dropped when Edit reopens it, the
chip's word always PHOTO, the PDF drawn as an image, OPEN in the same tab, and the OPEN link never given its address. (The shrinker
one first crashed the run on a wait the test required; the wait is now a wait, and the check after it fails by name.) *Not verified:* the tablet's PDF viewer, `docs/TEST-PLAN.md` step 38d.
*Merged 30 Sep 19:46 UTC as PR #65.*

**Docs, 30 Sep 2026.** `docs/NEXT-SESSION.md` rewritten from its history into where things stand (numbers read from the
database at 19:11 UTC), what is left and the household's jobs; the conversion project holds one file, `converter/conversion-instructions.md`,
whose master is here (the household, 30 Sep). R4 scoped in `docs/PLAN-COOKING-NOTES.md` from the live schema (read-only: `recipe_notes`
0 rows, four `authenticated` policies, cascade on recipe delete; no `recipe_logs.note` set in 116 entries); not built.
*Merged 30 Sep 19:53 UTC as PR #66.*

**R4, dated cooking notes (30 Sep 2026).** `docs/PLAN-COOKING-NOTES.md`, agreed "as suggested". `index.html` only; no migration,
since `recipe_notes` (Phase 1) had every column needed. **COOKING NOTES** under the recipe in the viewer: ADD A NOTE (dated now, by
the app, so the row and the log agree), newest first, the latest three and SHOW ALL, EDIT (the text only), DELETE with UNDO, and a
**NOTES · n** chip in the header. Each is one row, aimed at one note of one household; ADD and UNDO are upserts, so a retried write
that had landed is not refused. **While cooking** (KEEP AWAKE) the box stays and the log shows its latest line, nothing to edit.
**After cooking**, the "Which meal was that?" prompt has an optional note box, for a cooked recipe only, kept however the prompt
closes. **FOLD INTO NOTES** opens EDIT with `30 Sep 2026: <note>` at the end of the text's `NOTES:` section (or a new one), named by
BEFORE YOU SAVE; SAVE writes the recipe, **then** deletes the note; closing the form changes nothing, and a line taken out before
SAVE leaves the note. Not in PRINT or EXPORT PNG (the section sits outside the diagram, and print hides it). In the JSON export as
`recipeNotes`; an import restores only notes on recipes the file restores. Deleting a recipe says how many notes go with it (the
database cascades). `hydrate()` reads the table apart, like `aisle_overrides`: unreadable, the notes say so and nobody is signed out.

*Verified by.* `core.test.js` 143, unchanged. `smoke.js` **407 → 418**, both exit 0: ADD (one upsert, trimmed, dated; a blank adds
nothing; the chip), order and SHOW ALL, EDIT (text only, one note) and DELETE with UNDO (the same note back), cooking mode and
print, the after-cooking box (and none for an entry with no recipe, none from an empty SKIP), FOLD pending and closed, FOLD saved
(recipe written before the note's delete), a folded line taken out again, export and the delete confirmation, import's filter, and
the table unreadable. **Twenty mutations, all failing a check by name:** ADD not written, a blank note added, oldest first, ten shown instead of three,
EDIT re-dating the note, EDIT unscoped to the household, UNDO doing nothing, cooking mode showing the whole log, notes printed, the
after-cooking box ignored, the box offered for an entry with no recipe, FOLD not deleting, FOLD deleting a line taken out again,
the line placed straight under `NOTES:`, a fold left pending after closing, no export, import keeping notes on recipes not in the
file, a deleted recipe's notes kept in the cache, an unreadable table thrown (signing out), and the note deleted before the recipe
is written. (Ten-not-three first crashed the run on a click at a button that was not there; the click is now one that may find
nothing, and the check fails by name.) The invented lines were checked against the live library (read-only): none is a real line.
*Screenshots* at 1280×800 and 412 wide: the section, cooking mode, the prompt. *Not verified:* the tablet, `docs/TEST-PLAN.md`
step 39a.
*Merged 30 Sep 21:39 UTC as PR #67.*

**P3 scoped (30 Sep 2026).** `docs/PLAN-CALENDAR-PUSH.md`, from the live schema (read-only, 22:01 UTC): `planner_days` has no
time or opt-in; 16 days planned in the last four weeks, 3 ahead; no recipe has an `[overnight]` step, 6 have a step of an hour or more;
Vault installed, `pg_cron` and `pg_net` available but not installed. Not built.
 *Not verified:* the tablet (`docs/TEST-PLAN.md` step 37c).

**P3 PR 1: the calendar push's migration and Edge Functions (1 Oct 2026).** The household answered `docs/PLAN-CALENDAR-PUSH.md`
§7, then simplified it (§9): one all-day event per switched-on day, REMIND ME at 20:00 the evening before, ADD THE WEEK, a
RecipeWrangler calendar, DISCONNECT leaving the calendar. `docs/migrations/add-calendar-push.md` (not applied), drafted from the live
schema (read-only, 1 Oct: `vault.create_secret` and `update_secret` and their defaults, `postgres` able to read and delete
`vault.secrets`, no secrets yet, the default privileges on `public`, the tables' owner). `supabase/functions/calendar-auth` and
`calendar-sync` (not deployed). No `index.html` or `core.js` change. *(As of 1 Oct. The household applied the migration and
deployed both functions on 9 Oct, and connected the same day (§4; `docs/INFRASTRUCTURE.md`). Noted 12 Oct 2026, the October
review's F13.)*

*Verified by.* `test/calendar-push.js` **30 checks**, exit 0, lifting both functions' pure parts from their source. **Thirty-seven
mutations, all failing a check by name**, among them an id outside Google's alphabet, an event ending the same day, a timed event,
a busy one, the calendar's default reminder on a day with REMIND ME off, 20:00 ignored, today taken in UTC, a day marked away kept,
the past rewritten, SYNC NOW not removing strays, a date that does not exist accepted, the consent link without `offline` or
`consent`, a way back to another site, and the full calendar.events scope taken as enough. Two first survived (a day marked away
that still had recipes; an id_token with no `-` or `_` in it) and the checks were tightened until they failed. **The migration** was
run on a scratch local Postgres 16 built to the live project's shape (roles, a stand-in Vault, default privileges), as a
non-superuser like the live `postgres`: it applies; a consent value is taken once and not after ten minutes; the token is set,
replaced, read only for its household and forgotten; `authenticated` and `anon` are refused every function, the private table and
Vault, may read only their own status row and cannot write it; the reminder time refuses 24:00; the page's check queries give
what it says; its undo runs. **Both functions** pass Deno's `check` and `lint`, and were run under Deno with Supabase and Google
faked at `fetch`: CONNECT (a bad way back refused), the callback (token to Vault, calendar made, status row, back to
`#calendar=connected`), a replayed callback (`expired`), reconnecting (the same calendar), consent refused (`denied`), the calendar
permission unticked (`scope`), DISCONNECT (revoke, forget, the calendar left); a sync's insert, its 409 then PUT, delete, 410 as
done, a deleted event brought back, SYNC NOW listing and removing a stray, a past day left alone, Google refusing the token
(status row set to reconnect) and not connected. `core.test.js` and the smoke suite unchanged, both exit 0. The invented recipe
names match nothing in the library (read-only, 34 recipes). *Not verified:* anything against Google or the live database: the
household's setup (§10), the real consent screen, the 20:00 notification on the phone, and a deleted event coming back after a
PUT (step 40a, with PR 2).

**P3 PR 2: the calendar push in the app (9 Oct 2026).** `index.html` only, no `core.js` change. `hydrate` reads
`calendar_connections` apart from the tables whose errors throw (like `aisle_overrides`): the table being there is what says the
migration is in (`calendarAvailable`). Until then nothing new is shown or sent. After it, a Planner save names `calendar` and
`calendar_remind`, and a settings save names `calendar_remind_at`. Once connected, the Planner has IN CALENDAR and REMIND ME per
planned day and ADD THE WEEK per week. A day that was or is now switched on queues `calendar-sync` for that date through the write
queue, after its Planner write. Changing a day's recipes or servings keeps its switches; marking it away or emptying it drops them,
which removes the event. Settings → App → CALENDAR: "Waiting for the database change", or CONNECT (`calendar-auth` start, then
`goToGoogle`), or who, when, REMIND AT, SYNC NOW and DISCONNECT. `#calendar=<outcome>` from Google is read once, cleared, said in a
toast, and opens Settings; `connected` syncs every day.

*Choices beyond the plan:*
- Only a failure to reach the function (`FunctionsFetchError`, or the browser's own words for a dead network) is retried. An
  answer carrying `error`, and any non-2xx (`FunctionsHttpError`), goes into the status and a toast, and is not sent again.
  SYNC NOW is the backstop.
- An import sends the switches with the plan when available, then queues one sync of every day if connected.
- DISCONNECT calls `calendar-auth` directly, not through the queue, since it writes nothing of the app's.
- A stored REMIND AT off the half-hour grid is shown as its own option rather than changed.

A title change is synced from the edit form, not from `saveRecipe`, which is handed the already-edited object.

*Verified by.* `node test/core.test.js` 143 checks, exit 0. `node test/build.js && node test/smoke.js` **437 checks** (418
before), exit 0, no console or page errors. `node test/calendar-push.js` 30 checks, exit 0. The stub now reads
`calendar_connections` as not created unless a test gives it rows, so the default fixture is the live app today and the 418
earlier checks ran unchanged. The one exception is the Settings-tabs check, which now expects CALENDAR on App. It logs
`invoke:<name>` in `__LOG__`, so order can be checked.

The 19 new checks cover three states:
- **Before the migration:** a fresh boot signs nobody out, sends no calendar column, shows no switches, and Settings is waiting.
- **Available, not connected:** the switch is sent as off, 20:00 is sent, and CONNECT starts and goes to Google.
- **Connected:** the toggle, then the sync after the Planner write; REMIND ME; servings on a day that is on and on one that is off;
  marking away; emptying; ADD THE WEEK as one call; a title edit, never syncing a past day; `reconnect` not resent; a network
  failure resent with the same days; REMIND AT and SYNC NOW; DISCONNECT leaving the plan; and the return hash, both connected and
  denied.

**Sixteen mutations, each failing a check by name:**
- no availability guard on the Planner row, or on the settings row;
- the sync queued before the Planner write;
- a servings change dropping the switches;
- marking away keeping them;
- ADD THE WEEK without the batch (one call per day);
- a function `error` thrown, so retried;
- a network failure not thrown;
- DISCONNECT writing the plan;
- the hash not cleared;
- a title edit not synced;
- the connections read made to throw in `hydrate` (the first check, "signed in past the login gate", fails);
- the `connected` return not syncing;
- REMIND AT not syncing;
- a day that is off synced anyway;
- CONNECT not going to Google.

Each ran in its own copy of the repo, so the working tree was never changed. Read-only, 9 Oct 16:35 UTC: `calendar_connections`,
the two `planner_days` columns and `calendar_remind_at` do not exist yet (34 recipes).

*Not verified:* anything against Google or the live database. That means the migration, the deployed functions, the real consent
round trip and its redirect back, supabase-js's real error objects for a 4xx or a relay error, and the 20:00 notification on the
phone. That is tablet and phone step 40a, after §10 of the plan.

**P3 follow-up: the automatic calendar toggles (9 Oct 2026).** Asked for and answered the same day (`docs/PLAN-CALENDAR-PUSH.md`
§11): AUTOMATICALLY ADD TO CALENDAR and AUTOMATICALLY REMIND ME FOR MAIN MEALS in Settings → App → CALENDAR, under REMIND AT, drawn
as the KEEP AWAKE switch. `docs/migrations/add-calendar-auto.md` adds `household_settings.calendar_auto` and `calendar_auto_remind`
(waiting; the household applies it, then merges). `index.html` only, no `core.js` change.
- **Detection:** `calendarAutoAvailable` is `'calendar_auto' in` the settings row from the existing `select('*')`. Until the
  migration, the toggles stay hidden and no save names the columns.
- **Where the rules apply:** in `addPlanRecipe`, the one place a recipe is put on a day. `applyCalendarAuto` only switches on, only
  while connected, and never on a blank day.
- **Main:** the recipe's own `tags.course === 'Main'`. That is 18 of 34 recipes (read-only, 18:59 UTC).
- **The sweep:** switching a toggle on catches up the planned days from today inside `withCalendarBatch`. It writes only the days
  whose switches change, then makes one `calendar-sync` call. Switching a toggle off changes no day.

*Verified by.* `node test/core.test.js` 143 checks, exit 0. `node test/build.js && node test/smoke.js` **447 checks** (437
before, exit 0 on a copy of `main` at `8ca9321`), exit 0, no console or page errors. `node test/calendar-push.js` 30 checks, exit
0.

The ten new checks use two invented recipes (a Main and a Side, no live title like them) and cover:
- before the columns exist;
- both off;
- AUTO ADD on, including a day switched off by hand staying off on a servings change and coming back when a recipe is added;
- AUTO REMIND on alone, Main against Side;
- the sweep for each toggle: one call, past and away days untouched;
- off changing nothing;
- not connected.

**Ten mutations, each failing a check by name:**
- the settings save without its guard;
- AUTO ADD ignored;
- any course taken as Main;
- the sweep touching past days;
- the sweep making a call per day;
- switching off undoing days;
- applying while disconnected;
- the columns taken as present without the key;
- `addPlanRecipe` not applying the rules;
- the sweep writing days that do not change.

Each ran in its own copy of the repo, so the working tree was never changed.

*Found while testing:* the stub returns its fixture arrays themselves, not copies as supabase-js does, and `hydrate` keeps
`recipe_ids` by reference. So a check that empties a day in place (`removePlanRecipeAt` splices) also empties the fixture row, for
every later read. The toggles' checks therefore set fresh planner rows; the stub itself was not changed.

Also found: the existing check "export carries source_check and import restores it" failed once while four smoke runs shared the
machine, because the import had not finished when it was read. It passed on the same code run alone. It is timing-sensitive under
load.

*Not verified:* the migration (not applied at the time; applied by the household 9 Oct and checked read-only at 20:03 UTC), and
anything against Google: the sweep's events, and the reminder on a Main-course day. That is tablet and phone step 40b.

**The how-to guide and Settings → HELP (10 Oct 2026).** Asked for by the household while they review the PRE-MADE plan; answered
the same day: a HELP tab in Settings, one page with contents, written for the family's everyday use. `help.html` is a new static
page beside the app (no data, no sign-in), in the app's palette, following its APPEARANCE setting through the `kitchen.darkMode`
key the app keeps on the same origin. Twelve sections: a week with the app, one per screen, adding a recipe, Settings, what goes
wrong, and backups with the recipe text in brief. Every button it names was taken from a read of `index.html` that day and is
marked `<b class="ui">`. Settings gains a fourth tab, HELP: HOW-TO GUIDE (OPEN THE GUIDE ↗, a new tab) and eight QUICK ANSWERS
linking to the guide's sections. It needs a connection to open, like the app (there is no offline cache). No `core.js` change.

*Verified by.* `node test/core.test.js` 143, exit 0. `node test/build.js && node test/smoke.js` **448** (447 before), exit 0, no
console or page errors: one new check that HELP shows only its two blocks, links out to `help.html` in a new tab, and is
remembered. A new `node test/help-guide.js`, 6 checks, exit 0, in CI: 73 quoted buttons all in `index.html`; every QUICK ANSWER
links into the guide; every link from the app and from the guide's contents lands. **Seven mutations, each failing by name:** a
button renamed in the app (CLEAR TICKS), a section's id changed, a contents entry broken, a QUICK ANSWER pointing elsewhere (the
first version of that check let this through, and was tightened), HELP left out of `SETTINGS_TABS`, the guide opened in the same
tab, and a HELP block put on the APP tab. The guide rendered at 412 and 1280 wide, light and dark, with no sideways scrolling,
and printed to A4. Also corrected here: `docs/INFRASTRUCTURE.md` said `add_calendar_push`'s check queries had not been run by a
session, and listed `add_calendar_auto` as waiting; both were done on 9 Oct. *Not verified:* the tablet (step 42a), and whether
the wording reads well to someone new to the app.

**Recipe sharing between households (10 Oct 2026; `docs/PLAN-RECIPE-SHARING.md`).** Asked for the same day: a household of
the family with its own app, each keeping its own recipe database, able to browse the other's. Answered: the whole library,
read-only, switched on in Settings by each side, and copies independent. The database side, `docs/migrations/add-recipe-sharing.md`,
adds `recipe_shares`, `recipes.copied_from` and six `security definer` functions; the `recipes` policies are not widened, since
`hydrate` reads recipes with no household filter. A new household is made from an email address by one guarded statement
(`docs/ONBOARDING.md` §4). The app: Settings → APP → RECIPE SHARING (name and SAVE, SHARE by email, SHARED WITH and STOP SHARING,
who shares with us; "waiting" until the migration is in); RECIPES gains OUR RECIPES · 〈NAME〉'S RECIPES; their recipes come from
`shared_recipes()` into a list of their own, `shared`, never `cache.recipes`, so they never reach our plan, shopping list, diary or
export; their recipe opens read-only (EDIT, DELETE, FAVOURITE, SHORTLIST and notes hidden; finishing it logs nothing); ADD TO OUR
RECIPES saves an independent copy with `copied_from`, copies a photo stored in their folder into ours, and opens the copy. The
sharing calls are made at once, not queued, as CONNECT is for the calendar. `loadSharing` runs after `hydrate` and the tab-return
refresh, outside `hydrate`, so nothing about sharing can sign anyone out.

*Verified by.* The migration on a scratch Postgres 16 built to the live shape (the migration page lists what was checked). `node
test/core.test.js` 143, exit 0. `node test/build.js && node test/smoke.js` **465** (448 before), exit 0, no console or page errors:
17 new checks, before the migration (waiting, no switch, no `copied_from` on an ordinary save) and after it on a page whose database
functions answer as another household; the stub gained `sb.rpc`, unanswered calls reading as not created yet. `node
test/help-guide.js` 6, exit 0, with the guide's new section 11 and a QUICK ANSWER. **Seventeen mutations, each failing by name:**
`copied_from` always sent; sharing reported available before the migration; the possessive ("THE TESTERS'S"); the switch ignored;
their recipes added to `cache.recipes`; the copy mark without the source-page match; shortlist and favourite on their cards;
search over ours instead of theirs; the read-only CSS dropped; their recipe logged on finishing; the copy without `copied_from`;
the photo copied but not saved to the row; the copy not opened; the "shares with us" line dropped; a refused SHARE listed;
STOP SHARING without asking (the first version of that check died on a timeout instead of failing by name, and was changed);
a stopped share's recipes kept. *Not verified:* anything against the live database (the migration is not applied), the real
`sb.rpc` answers and storage policies, the photo copy against real Storage, and two real households; that is tablet step 43a.
*(As of the build. The household applied the migration on 10 Oct before #74 merged, and its check queries were run read-only at
16:15 UTC (`docs/INFRASTRUCTURE.md`); `recipe_shares` holds one share on 12 Oct, and tablet step 43a passed 12 Oct. Noted 12 Oct
2026, the October review's F13.)*

**A weekly backup to Google Drive (10 Oct 2026; `docs/PLAN-DRIVE-BACKUP.md`).** Asked once Google was connected for the
calendar; answered the same day: the app's own export, weekly and by hand, into the household's own Drive, the export file only.
The nightly dump stays the real backup. `drive-backup` (new) takes the export from the app, so the file is exactly EXPORT DATA's
(`exportPayload()`, now shared by both), names it as the download is, replaces a same-day file, keeps the newest 8, and deletes only
files of its own name pattern; it records `drive_backup_at`, `drive_last_error` and `drive_folder_id` on `calendar_connections`
(`docs/migrations/add-drive-backup.md`). `calendar-auth` asks for `drive.file` beside the calendar; the calendar still connects if
Drive is unticked. The app: Settings → APP → BACKUP TO GOOGLE DRIVE (waiting / connect Google first / CONNECT AGAIN FOR DRIVE /
last saved, SAVE TO DRIVE NOW); `maybeWeeklyDriveBackup()` after the load and the tab-return refresh, once per page load, when the
last save is a week old and nothing is unsent. DISCONNECT's question now says the Drive backup stops too. Also corrected in
`docs/INFRASTRUCTURE.md`: `add_recipe_sharing` recorded as applied (checked 16:15 UTC), the calendar functions as deployed, and the
deployed versions as seen at 16:45 UTC.

*Verified by.* The migration on a scratch Postgres 16 (applies as a non-superuser owner; the check queries; the undo). `node
test/core.test.js` 143, exit 0. `node test/build.js && node test/smoke.js` **472** (465 before), exit 0, no console or page errors:
7 new checks, before the migration and on fresh pages connected with and without Drive, saved never, 3 and 8 days ago. A new `node
test/drive-backup.js`, 11 checks, exit 0, in CI, lifted from the function; `node test/calendar-push.js` 31 (one new: CONNECT asks
for the calendar and `drive.file` and nothing wider). `node test/help-guide.js` 6, exit 0. **Nineteen mutations, each failing by
name:** eleven in the functions (the scope matched as a substring, the date in UTC, a non-export accepted, no size limit, one file
too many kept, no sort, never replacing today's file, deleting any file, the upload's closing boundary, the file not pretty-printed,
CONNECT not asking for Drive) and eight in the app (Drive offered before the migration, or without the permission; a different
payload; the weekly save on every tab return; a two-day week; the file name left out of the toast; a failure not recorded; no save
at start-up). One check died on a timeout instead of failing by name under its mutation, and was changed to click in the page.
*Not verified:* anything against Google or the live database: the consent with two permissions, the folder, the upload, the tidy,
and the token's Drive scope. That is tablet step 44a, after the household's steps in the plan's §4.

**Converting your own recipes, in the guide (10 Oct 2026).** Asked by the household for a second household that will convert its
own recipes: link to the instructions rather than copy them into the guide, since the file is long and revised over time.
`help.html` §9 gains "Converting your own recipes" (`#converter`): download `converter/conversion-instructions.md` from GitHub, add it
to a project in the Claude app, give it a page, a photo or text, paste its reply into NEW RECIPE; download it again now and then.
Settings → HELP gains a QUICK ANSWER for it. *Verified by.* `node test/help-guide.js` **7** (6 before), exit 0: a new check that
every link from the guide to a file in this repo names a file that exists, seen failing by name under two mutations (the path
misspelt; both links removed). `node test/core.test.js` 143 and `node test/build.js && node test/smoke.js` 472, each exit 0.
*Not verified:* how GitHub Pages would serve the `.md` file itself (Pages was unreachable from the session), which is why the
guide links to GitHub rather than to the app's own site; and the Claude app's own steps, which are described in plain words.

**PRE-MADE meals and COOKED ✓ (10 Oct 2026; `docs/PLAN-FOOD-DIARY.md`).** The food diary fed from the Planner, planned and
approved on 10 Oct. `docs/migrations/add-premade.md` adds `planner_days.premade text[]` and `recipe_logs.premade boolean`. On the
Planner each dish gains PRE-MADE (asks the meal; leaves the shopping list; on its day goes into the diary by itself, from the
freezer, by an upsert whose id `premadeLogId` works out from the household, day, recipe and place, so two devices write one row)
and, on today, COOKED ✓ (`logRecipeUsed(id, date)`: the same entry and prompt as finishing the flow). Pre-made rows stay out of the
recipe's `history` at hydrate and on delete, so "last cooked", counts and the streak are cooking only; History and the CSV mark
them. The automatic main-meal reminder covers pre-made meals, and `calendar-sync` writes "(from the freezer)" in the description
and now reads `planner_days` with `select('*')`. Export and import carry both. Nothing about PRE-MADE shows, and no save names
either column, until a `premade` key is seen on a row read. Also: `logRecipeUsed` now redraws only the screen it was called from
(it had redrawn the Viewer from anywhere, which with no recipe open would have sent the Planner to RECIPES).

*Verified by.* The migration on a scratch Postgres 16 (as a non-superuser owner; defaults for existing and new rows; the undo).
`node test/core.test.js` 143, exit 0. `node test/build.js && node test/smoke.js` **487** (472 before), exit 0, no console or page
errors: 15 new checks, before the migration on the main page and after it on a fresh page whose rows carry the columns. `node
test/calendar-push.js` 32 (one new). `node test/help-guide.js` 7, with the guide's new "From the freezer, and cooked" and a QUICK
ANSWER. **Twenty-one mutations, each failing by name:** nineteen in the app (PRE-MADE offered, or the column sent, before the
migration; COOKED ✓ on a future day; the date ignored; the Viewer redrawn from the Planner; pre-made rows in the history; no
freezer mark; no meal asked; duplicates kept; a future day logged; the shopping list not skipping it; no de-duplication; a random
id; the slots out of step on removal; switching off asking again; a diary delete touching the history; the reminder ignoring
pre-made; import and export dropping it) and two in `calendar-sync`. Three of the first run's checks did not catch theirs and were
tightened: the Viewer redraw (the test had a recipe open from earlier), the slots (removing the last dish hides it), and the meal
question (a timeout instead of a named failure). *Not verified:* anything against the live database or Google, and two devices at
once for real; that is tablet step 41a after the household's steps in the plan's §5.

**Fresh or freezer?, and the Planner row on a phone (10 Oct 2026; `docs/PLAN-FOOD-DIARY.md` §2a).** Tablet step 41a found that
finishing the flow of a dish down as PRE-MADE today logged it a second time, as cooked (read-only: 20:40 and 20:41 UTC). The
household asked for a question. Finishing a flow, in the viewer or a group, now goes through `finishRecipe`. For a dish
pre-made today it asks "Cooked fresh, or from the freezer?":
- FROM THE FREEZER, or closing the question, adds nothing.
- COOKED FRESH switches PRE-MADE off, deletes that dish's freezer entry by the id `premadeLogId` gave it, and logs it as cooked
  with the meal question.

The answer is kept until the page reloads. On a phone the Planner squeezed a dish's name to one letter. The title now keeps
`min(12em, 100%)` inside the 860 px block, so the pills wrap below it; the tablet's row is unchanged where it fits.

*Verified by.* `node test/core.test.js` 143, `node test/build.js && node test/smoke.js` **492** (487 before) and
`node test/help-guide.js` 7, each exit 0, with no console or page errors. Five new smoke checks, on a fresh page whose day is a
pre-made dish and a fresh one: the layout at 412 and 800 px; the question asked and nothing logged; FROM THE FREEZER; COOKED
FRESH; a fresh dish logged at once.

**Eight mutations, each failing by name:**
- the CSS floor removed, or made `flex-basis:100%`;
- the viewer still calling `logRecipeUsed`;
- the answer not remembered;
- no delete;
- PRE-MADE left on;
- a fresh dish not logged (caught by the older meal-prompt checks);
- FROM THE FREEZER logging.

A ninth: the guide's new COOKED FRESH label renamed in the app made `help-guide.js` fail. It first passed, because a code
comment quoted the label, so the comments were reworded.

*Not verified:* the group viewer calling `finishRecipe` (no check covers it).

**Tablet step 41b done by the household, 10 Oct, after #80 merged (21:37 UTC).** Read-only at 22:13 UTC: the dish's 20:40
freezer row and the 20:41 double entry are both gone; it has one row for today, cooked, dinner, written 22:05:59; today's
`planner_days.premade` reads `['', '']`, saved 22:05:56; tomorrow's pre-made dinner is untouched. That is COOKED FRESH doing
all three things at once. The FROM THE FREEZER branch and the phone layout rest on the smoke checks and the household's
word.

**PRE-MADE missing in a household that started empty (20 Oct 2026, app 2026-10-20.1).** The household reported no PRE-MADE
on the Planner, in either style. The columns were in (read-only, 20 Oct: `planner_days.premade` `ARRAY` and
`recipe_logs.premade` `boolean`, both granted to `authenticated`). The cause was how `hydrate` decided: a `premade` key on any
planner or diary row. The family's household was made empty at the split (18 Oct), so when the tablet loaded at 06:10 UTC it
had neither, and every save that morning left the column out. The edge logs show seven `planner_days` upserts from the tablet
between 06:12 and 06:13 UTC, and one from the phone on 19 Oct at 21:41, all with `columns=` that leave out `premade`. A reload
after the first saved day would have brought the button back, and emptying the plan would have taken it away again.
`hydrate` now asks the database directly, with `planner_days.select('premade').limit(1)`, read apart like the
`calendar_auto` probe, so a failure means "not yet" and never signs anyone out. The rows still count as well. The stub refuses
a select that names a column in its `PENDING_COLUMNS` unless a fixture row carries the column or `__STUB_COLUMNS__` lists it.
Two smoke checks cover an empty household with the column and without it. Each was seen to fail: the first with the old
row-only rule, the second (and the existing before-migration check) when the switch was always on. Tablet step 71a.
**Seen live after #168 merged (07:42 UTC).** The edge logs show the probe (`planner_days?select=premade&limit=1`) answered 200 at
07:44:53 UTC, and two `planner_days` upserts at 07:45:09 and 07:45:14 UTC with `premade` in their `columns=`, the first from the
family's household since the split. The household then reported PRE-MADE showing on the tablet (20 Oct, 71a step 1; which styles
not stated). *Not verified:* 71a step 2, switching a dish to PRE-MADE and back, in the family's household.

**A calendar reminder per meal (20 Oct 2026; the function and the SQL page in #176, merged 17:59 UTC; the app 2026-10-20.7).** The household
saw IN CALENDAR once a day and asked for a reminder per meal, with a group cooked together as one; the plan is `docs/PLAN-CALENDAR-PUSH.md` §12 and
they took its recommendation on all six questions. *First part (#176):* `calendar-sync` writes up to two events a day (`…r` with the 20:00 pop-up,
`…n` without), deletes the retired plain id, resolves a group to its strongest member by reading `meal_groups`, and falls back to the day's two flags
when no dish is marked; `test/calendar-push.js` 39 to 62 checks, each seen to fail (18 breakages); `docs/migrations/add-calendar-items.md`
(`planner_days.calendar_items text[]`) ran on a scratch Postgres 16 and is **not applied to the live project**. *Second part (this PR):* the app reads the
column (a one-column probe), keeps `calendarItems` per dish beside `premade`, splices it in lockstep, writes it with every day save only once the column
exists, and shows REMIND ME 20:00 on each meal of a day with two or more (a group's on its bar, now three controls and not a button holding a span);
until then the Planner is as it was. The × moved into its dish's group of pills so it cannot stand alone on a line. Smoke 838 to 868 checks, run
under CI's fonts and the local ones; 30 breakages of the app, each caught by name (two only after tightening the check, and one,
the bar's `align-self`, is equivalent at every width tested: the 44px floor in the core test, seen failing, guards it instead). Measured on the real
plan: the one two-meal day is 62px taller with the shortlist open and no taller folded. **Not verified:** any of it against the live database,
Google, or the tablet. The household's tablet check is 75a in `docs/HOUSEHOLD-JOBS.md`.
**Applied, deployed and read back (20 Oct 2026, about 19:10 UTC).** The household applied the SQL, deployed `calendar-sync` v8 (19:07:09 UTC) and ran SYNC
NOW. Read-only: `planner_days.calendar_items` is `ARRAY`, not null, default `'{}'::text[]`; the function's source carries `dishStates`, `mealEventId`,
`dayEventIds` and the `meal_groups` read; `calendar_connections` has `last_sync_at` 19:07:30 UTC and no error. Of 44 planned days none has a setting per
dish and the last plan save was at 17:13 UTC, before 2026-10-20.7: nothing has yet been saved by the new app, so the Planner's buttons and the two-event
days in Google are **not seen**.
**Tablet check 75a reported done (20 Oct 2026, read back at about 20:00 UTC).** One day, 24 Oct, was saved by the new app at 19:42:32 UTC with two dishes
and `calendar_items` `{in,remind}` (flags true, true), and a sync followed at 19:42:58 UTC with no error; the household's screenshot shows the Planner as
designed on that day, on a one-group day and on a one-dish day. Google, read at about 20:05 UTC through the Calendar connector: 24 Oct has the two events as designed (`…24n`, no reminder; `…24r`, a 20:00 pop-up the evening before),
and 20 and 23 Oct are single `…r` events; no plain-id event of this household is left. Found on the way, not this change's: thirteen events from Test Kitchen's old household (9 to 22 Oct, not the 17th) remain in
the calendar and nothing will delete them (`docs/INFRASTRUCTURE.md`); the household decided on 20 Oct to leave them as they are. Still **not seen:** a reminder arriving on a phone.

**+ OTHER on a Planner day (21 Oct 2026, app 2026-10-21.2; `docs/PLAN-ADHOC-PLANNER.md`, PR 1).** The household answered the plan's questions (button wording **+ OTHER**, the rest
as recommended) and PR 1 was built. Each day (not one marked away) has **+ OTHER**, which opens History's own dialog (`#adHocOverlay`, now with an origin: `openAdHocEntry({ origin, date })`,
`adHocOrigin`) worded "Add to the Planner" and set to that day; saving calls the same `addDiaryEntry`, so the row is a `recipe_logs` row with no recipe, a title, the day and an optional
meal, and the Planner stays on screen (History keeps its own ending). **No schema, Edge Function, core.js or calendar change.** `renderPlannerDays` draws a day's ad-hoc rows after its
recipes (`plannerAdHocByDay`, `adHocRowHtml`): plain text, `MEAL · AD HOC`, and a ×, with none of SERVES, PRE-MADE, COOKED ✓ or the calendar's buttons; a day of only entries keeps CHOOSE A RECIPE
(small, beneath them); an away day keeps the entries it has but offers no button. × (`removeAdHoc` → `deleteDiaryEntry`) asks for today or earlier, as History's REMOVE does, and not for a day to come.
The new actions are on the list of taps that must not assign a selected shortlist item. The Modernist week band's PLANNED counts the entries (§9 Q5). Nothing else reads these rows differently:
the shopping list, the sidebar's count and `calendar-sync` read the plan and the recipes only.
Seventeen smoke checks (`+ OTHER on a Planner day`), each seen to fail with its own break: sixteen breaks, run one at a time through a throwaway runner for that block (13 s a run), which showed
two of the checks to be blind at first: the "runs off the side" measure read the document's width, which the page never grows (it clips), and a layout measure scrolled each button into view
before reading where it sat; both were mended and re-seen failing. A first draft of the break list also showed that a whole-suite run cannot attribute a failure past the first broken step, hence the
runner. Tablet step 77a. *Not verified:* the tablet and the phone, and the live app.

**A recipe opens at the day's SERVES (21 Oct 2026, app 2026-10-21.1).** The household asked whether the card should inherit the headcount set on the
Planner, which it did not: `openRecipe` set `state.viewerServes` to null on every open, so a dish planned for 20 opened at the recipe's own 4, while the shopping
list and the Group Viewer (`plannedServingsLookup`) already used the day's number. The `viewerServes` comment records a 14 Aug decision that the viewer's ad-hoc scaling is
session-only and never saved; this keeps it, because nothing is written: `openRecipe(id, returnTo, planned)` takes the entry's SERVES when the Planner's name button is
tapped (0, "as written", leaves it null), and only that route passes it. The entry is the one tapped (`planEntries(...)[idx]`), not the first of its recipe on the day.
RESET still goes to the recipe's own amounts. Five smoke checks, including that opening wrote nothing; the first three were seen to fail (the old call with no
headcount fails two; a lookup by recipe fails the second-copy check). The write-nothing check was not mutated. Tablet step 76a. *Not verified:* the tablet.

**Issues #85, #86, #89, #93: parse feedback, seconds, COOKING MODE, Drink (11 Oct 2026).** Raised on GitHub on 11 Oct,
the first issues from the second household; planned and approved the same day.
- **#85, parse feedback.** PARSE & PREVIEW, a paste, or WRITE ONE BY HAND now does two things. It says beside the button
  what was read ("Read N ingredients and M steps…"), and it scrolls the bands into view inside the dialog. Before, the
  preview opened below a box that fills half the screen, and nothing seemed to happen. An empty box says "Paste a recipe
  first". The other re-parses (RE-CHECK, scaling, undo, folding a note in) leave the page where it is, through a `reveal`
  option only those three callers pass.
- **#86, durations under a minute.** These read in whole seconds: "20 sec", and "30–45 sec" for a range.
  - An hour or more is rounded before it is split, so 119.6 minutes is "2h", not "1h 60m".
  - A timeline shorter than five minutes marks its ticks in seconds instead of "+0 min" five times.
  - `formatMinutesForDisplay` and `formatDuration` moved into `core.js` with tests. The version is `2026-10-11.1` in all
    three places.
- **#89, the switch's name.** The KEEP AWAKE switch reads COOKING MODE, on the recipe and the group page, with its status
  line and tooltip. Internal names (`.keep-awake`, `state.keepAwake`, the guide's `#keep-awake`) are unchanged; nothing
  was stored under the old name.
- **#93, the Drink course.** Drink joins the courses after Dessert. The converter's instructions list it too: each
  household reloads `converter/conversion-instructions.md` into its own conversion project.

*Verified by.*
- `node test/core.test.js`: **145** (143 before), exit 0.
- `node test/build.js && node test/smoke.js`: **500** (492 before), exit 0, no console or page errors.
- `node test/help-guide.js`: 7, exit 0.
- **Eleven mutations, each failing by name:**
  - no seconds branch;
  - the old split, giving "1h 60m";
  - no seconds range;
  - no scroll;
  - no result line;
  - RE-CHECK revealing;
  - an empty box silent;
  - no Drink;
  - the old label;
  - ticks rounded;
  - a paste not revealing. The first run did not catch this one; a check that pastes was added and seen failing.

*Not verified:* the tablet itself (step 45a); the smooth scroll on Android Chrome.

**Issue #90: a FROZEN aisle (11 Oct 2026).** Asked on GitHub on 11 Oct.

*Measured before it was built, read-only, by household:*
- the family: 2 ingredient lines say frozen. Both were under Other and move to Frozen, and their
  names and shopping keys are unchanged;
- the new household: 1 line (counted, not read);
- the weekly test household: none.

The household chose for a line that says frozen to move by itself.

*What changed:*
- `INGREDIENT_AISLES` and `SHOPPING_CATEGORIES` gain Frozen, last. The second list is also the shopping list's section
  order, so it has to be in both, or items placed there would vanish from the list.
- `AISLE_FIRST` sends any line saying "frozen" there before another keyword can claim it, so "frozen chicken" is not Meat
  & Fish. The word stays in the name (`NEVER_IGNORE`), so ticks are kept.
- No dictionary rows, since a row would name an ingredient and re-key ticks. `core.test.js` exempts Frozen from
  "every aisle has rows", and the generator writes a sentence for the empty section instead of an empty table.
- A household's own aisle still wins, and FROZEN is a choice in Settings → SHOPPING AISLES and the review.
- The version is `2026-10-11.2`.

*Verified by.*
- `node test/core.test.js`: **148**, exit 0.
- `node test/build.js && node test/smoke.js`: **502**, exit 0, no console or page errors.
- `node test/help-guide.js` and `node test/ingredient-lines.js`: both exit 0.
- **Four mutations, each failing by name:**
  - no frozen-first rule;
  - no Frozen section;
  - Frozen not an aisle;
  - Frozen first instead of last.

*Not verified:* the tablet (step 46a), and the other household's line, which was counted only.

**Issue #92: your own photo as a recipe's picture (11 Oct 2026).** Asked on GitHub on 11 Oct. UPLOAD PHOTO, beside IMAGE URL
in the edit form, takes a picture from the device.
- **Shrinking:** the browser shrinks it to 1600 px JPEG, reusing `shrinkSourcePhoto` with an edge of its own.
- **When it is stored:** the upload is queued at SAVE, before the row, as source photos are, since a new recipe has no id
  until then.
- **Where:** `recipe-images/<household>/<recipe id>.jpg`, the name the re-host gives, under the only folder that
  household's policies let it write.
- **The address:** `image_url` and the `IMAGE:` line become that file's public address plus `?v=<time>`. Being under the
  prefix, it is never sent to `rehost-images`.
- **In the form:** a re-parse keeps the chosen photo, and typing a link lets it go. BEFORE YOU SAVE says "Stores your
  photo as the recipe's picture".
- No schema change and no Edge Function change. `docs/IMAGES.md` and `docs/INFRASTRUCTURE.md` no longer say the app
  cannot upload or write Storage.

*Verified by.*
- `node test/core.test.js`: 148, exit 0.
- `node test/build.js && node test/smoke.js`: **509** (502 before), exit 0, no console or page errors. The seven new
  checks cover:
  - the choice, BEFORE YOU SAVE, a re-parse, and a file that isn't a photo;
  - the upload's bucket, path, type and size: 2400×1800 in, 1600×1200 stored;
  - the address and its `?v=`, the file written before the row, and no re-host;
  - a typed link letting the photo go;
  - another household's uploaded photo, met by ADD TO OUR RECIPES, copied into our own folder. Its fetch is a stand-in,
    so nothing reaches the network.
- `node test/help-guide.js`: 7, exit 0, with the new label.
- **Nine mutations, each failing by name:**
  - no upload;
  - the wrong folder;
  - no `?v=`;
  - a re-parse wiping it;
  - no type check;
  - full size;
  - the upload after the row;
  - a link not letting it go;
  - no BEFORE YOU SAVE line.

*Not verified:* the tablet's camera and gallery (step 47a); a real upload to the live bucket. The read-only check is
after 47a.

**Issue #91: the app's version and a change log (11 Oct 2026).** Asked on GitHub on 11 Oct, once a second household was on the
app. The household chose a date version (`2026-10-11.4`), a list readable in the app, and history from 10 Oct.

**`changelog.json`**, newest first: version, date, issue numbers and what changed, in plain words. It does two jobs:
- **The list the household reads.** Settings → HELP gains VERSION AND WHAT'S NEW: the version, the five newest entries
  with links to their issues, and THE WHOLE LIST ↗. With no connection it says so and still shows the version.
- **The signal to an open tab.** Before, a tab left open ran old code with nothing to say so. The UPDATE bar caught only
  a half-arrived `core.js`, once, at load.
  - Now the log is asked for at start-up and on each return to the tab (`onSignedIn`), at most once in ten minutes and
    never offline.
  - A newer first version turns the same bar on with "A new version is ready". `compareVersions` reads `.10` as newer
    than `.9`.
  - The first load on a new version shows one line, "Updated to …", once per device. `localStorage`
    `kitchen.lastSeenVersion` is a convenience only; a first visit shows nothing.

*How the version is kept:*
- `APP_VERSION` in `index.html` must equal the log's first version, and `core.test.js` checks it, with the log's shape
  and order.
- `CLAUDE.md` gains "Every session" 2a: a change the household will notice adds an entry.
- `KITCHEN_CORE_VERSION` is unchanged in purpose.

*The test harness:* `test/build.js` hands the real log to the test page (`window.__CHANGELOG_FILE__`), since a `file://`
page cannot fetch it, and `stub.js` uses it unless a test supplies its own.

*Verified by.*
- `node test/core.test.js`: **152** (148 before), exit 0.
- `node test/build.js && node test/smoke.js`: **515** (509 before), exit 0, no console or page errors.
- `node test/help-guide.js`: 7, exit 0.
- **Ten mutations, each failing by name:**
  - versions compared as text;
  - no ten-minute limit;
  - asking offline;
  - no update line;
  - an update line on a first visit;
  - six entries;
  - the bar's old words;
  - `APP_VERSION` out of step;
  - no check on return;
  - nothing shown without a log.

*Not verified:* the bar appearing on the tablet after a real merge, through Pages' cache (step 48a).

**The October review, PR 2: Edge Function hardening (11 Oct 2026; F3, F4, F27, F26, F7).** The second of the eight PRs in
the plan made from `docs/REVIEW-2026-10-FINDINGS.md`.
- **`find-recipe-image` removed (F3).** Nothing called it, and it fetched any address. The household deletes the deployed
  function.
- **`source-ingredients`' address guard (F27).**
  - It allows a trailing dot, so `localhost.` is refused.
  - It refuses `supabase.com` and `supabase.net` beside `.co` and `.in`.
  - It refuses the public wildcard-DNS services by name (`nip.io`, `sslip.io`, `xip.io`, `localtest.me`, `lvh.me`), which
    is all a check that does not resolve the address can do.
  - The dead `includes(':')` is gone.
- **`rehost-images` (F4).**
  - It carries the same guard, character for character; `test/image-integrity.js` checks they are identical.
  - It fetches through `fetchImage`, which follows redirects by hand and checks each hop, refuses a declared length over
    10 MB before reading the body, and keeps the timer running until the body has arrived.
  - `limit` is bounded to 1–500.
  - The verify pass still follows redirects, but only ever reads the household's own stored files.
- **`calendar-auth` (F26).** Google's callback checks that the person who tapped CONNECT is still a member of the household
  before it exchanges the code.
- **`calendar-sync` and `drive-backup` (F7).** A row that says connected with no token in Vault (what a restore into a new
  project leaves) is marked not connected and answers `reconnect`, which the app already turns into CONNECT.
- **The guide** says the Drive backups go to the Google account of whoever connected.

*Verified by.*
- `node test/source-ingredients.js`: 12, exit 0 (the refused list gained five addresses).
- `node test/image-integrity.js`: **35** (31 before), exit 0.
- `node test/calendar-push.js`: **35** (32 before), exit 0.
- `node test/drive-backup.js`: **13** (11 before), exit 0.
- `node test/core.test.js`, smoke (515) and `help-guide.js`: all exit 0.
- **Nine mutations, each failing by name:** no trailing dot; `nip.io` allowed; `supabase.com` allowed; the two guards
  drifting apart; redirects followed; `limit` unbounded; no membership check; never stale; stale not noted.
- **`tsc --strict`** against stand-in Deno and Supabase declarations: each function has the same errors before and after
  (pre-existing implicit `any`s), and no new ones.

*Deployed and checked, 12 Oct 2026.* #102 merged at 07:32 UTC, and the household redeployed all five between 07:34 and
07:37.
- `list_edge_functions` shows `find-recipe-image` gone.
- The versions are `calendar-auth` 4 (JWT off), `calendar-sync` 4, `drive-backup` 2, `rehost-images` 14 and
  `source-ingredients` 4, the last four with JWT on.
- `get_edge_function` on each found every new piece: `fetchImage` with `redirect: 'manual'`, the shared guard with
  `nip\.io` and the trailing `\.?$`, `stillMember`, `staleConnection` and `reconnect: true`.
- Five to eight lines spread through each repo file were found in the deployed copy, whitespace aside. That is a
  spot-check, not a full diff.
- The same morning, PrivateBackup's first scheduled backup on the new workflow (04:15 UTC) passed every step. It logged
  `dump: tables=16 policies=52; live: tables=16 policies=52`, and its prune removed only the oldest dump (14 Sep). The
  photo backup's first run on the new mirror script is the weekly one on 18 Oct. *(It ran at 05:05 UTC on 18 Oct and
  passed every step; a session read its log: see `docs/INFRASTRUCTURE.md`.)*

**The October review, PR 3: the public repo and the test harness (12 Oct 2026; F9, F28, F29, F30, F47).**
- **`index-old.html` removed (F9).** It was the pre-Supabase app, renamed on 17 Aug.
  - Pages served it at the app's address with no sign-in, and its seed data held complete recipes.
  - It stays in history, as the household chose.
  - `ARCHITECTURE.md` and the 23 Sep review are corrected.
  - `test/image-integrity.js` no longer names the two library recipes whose photos were broken. The docs that tell
    that story (`IMAGES.md`, this file, `TEST-PLAN.md`) and `rehost-images`' comments still name them; they are titles,
    not recipe lines, and were left.
- **Nothing reaches the network (F30, F47).**
  - Every page `smoke.js` opens now goes through one wrapper. It records page errors and console errors under the
    page's label: secondary pages used to fail only on uncaught exceptions, so an app `console.error` there passed.
  - The wrapper refuses every http(s) request, unless the test answers it itself.
  - The last checks prove no request reached the network, and that the live Storage addresses were among those
    refused.
  - Until now every run fetched the fixture's images from the live project, as the edge logs showed.
  - The only console error now allowed is the client-side block. The old allowances (the sandbox's TLS proxy, a
    runner's DNS) are gone because nothing goes out.
  - The offline-start page names the one error it exists to provoke.
- **`help-guide.js` (F28).**
  - It strips comments from `index.html`, then requires each of the guide's 100 labels as the whole text of an element
    or a string.
  - Two labels the app builds from a template (SOURCE PHOTO, CHECKED AGAINST THE PHOTO) are matched to that template.
  - Six labels failed the new check:
    - the guide now quotes `⇄ SUBSTITUTION RECOMMENDATIONS` as it reads;
    - the REMIND AT label wraps its hint in a span, so it reads exactly as before;
    - `image/*` in an accept list had been read as the start of a comment, which hid two other labels; JS comments are
      now taken out only where they start a line or follow a space.
  - Under the old check, renaming GO in the app alone passed.
- **The stub (F47).** `core.test.js` lists every query method `index.html` chains onto `sb.from(…)` and
  `sb.storage.from(…)`, following a query built in steps through its variable and `sourcePhotoStore()`. It fails if
  `test/stub.js` lacks one.
- **CI (F29).** Playwright is pinned to 1.63.0, the version installed locally, with `--no-save`. The header no longer
  carries a check count. `permissions: contents: read`.

*Verified by.*
- `node test/core.test.js` **153** (152 before), exit 0.
- `node test/build.js && node test/smoke.js` **517** (515 before), exit 0, no console or page errors.
- `help-guide.js` 7, `image-integrity.js` 35, `source-ingredients.js` 12, `calendar-push.js` 35, `drive-backup.js` 13:
  all exit 0.
- **Seven mutations, each failing by name:**
  - GO renamed in the app only;
  - REMIND AT back inside a longer label;
  - the CHECKED AGAINST template renamed;
  - the stub without `in()`;
  - the stub without `limit()`;
  - the catch-all route removed;
  - a changed console message on the offline-start page.


**The October review, PR 4: lost changes, part 1 (12 Oct 2026; F14, F15, F20, F32, F33, F39, F46).** #117 (PR 3) merged first;
nothing to deploy for it.
- **Deleting a recipe (F14, F20, F32).**
  - Other dishes on its days keep PRE-MADE. It used to be dropped, so a freezer dish came back fresh, onto the shopping
    list.
  - Its diary rows leave the cache, as they leave the server. An export taken at once no longer carries rows for a recipe
    it does not contain.
  - An import leaves out diary rows for a recipe the file does not restore, in the cache and in `replaceAllDiary`, as
    the notes import already did.
  - Its source files are removed only once the row delete lands: the removal is queued from inside that write. A refused
    delete used to take the files and leave the recipe.
  - `runWrite`'s toast tells a refusal ("the server refused it… if this keeps happening, reload") from a network failure
    ("check your connection"), using `isNetworkFailure`.
- **FOLD INTO NOTES (F33).** The note leaves the tab at once, but its row is deleted inside the recipe's own write, after
  the upsert lands (`saveRecipe`'s new `landed` step). A refused save no longer loses the folded line.
- **REMOVE on a freezer entry (F15).** If the plan still marks that dish PRE-MADE, the question says so, and PRE-MADE comes
  off it. The next load no longer writes the entry back.
- **PRE-MADE (F39).**
  - The freezer row's id counts pre-made copies only (`premadeLogIdAt`). Measured before the change, across every
    household: 3 planned days carry a PRE-MADE, none repeats a recipe, and there is 1 freezer row. So no logged row
    changes its id.
  - Switched on as a meal while its row is already in the diary as another (off, then on as lunch), the row changes to
    match. This happens only at that moment, so a meal type changed by hand in History is never overwritten.
  - "From the freezer" is remembered only while the dish is still PRE-MADE.
  - The Planner has no direct meal change: tapping a pre-made dish turns it off. The first version of this fix assumed
    there was one, and would never have run; the check follows the Planner's own off-then-on path.
- **A picture that cannot be had (F46, and the #92 upload).**
  - A recipe card whose image fails to load shows the empty frame and PHOTO CAN'T BE SHOWN, not a broken image. A
    capture-phase `error` listener sets a class, and the `<img>` and its address stay.
  - A missing source photo now also says "If it doesn't come back, add it again through EDIT."
- **The stub.** `__WRITE_FAIL_TABLES__` refuses (or drops, as a network) one table's writes.
- **PR 3's network check had a race of its own.** In four suites run side by side, one image request on the recipe-photo
  page was dropped as its page closed: no answer and no error, so it had never been sent. It is now counted as held, like
  a request never answered, and the check still fails by name when the catch-all is removed.
- `changelog.json` **2026-10-12.1**. `help.html` (REMOVE on a freezer entry; switching PRE-MADE back on as another meal).
  `TEST-PLAN.md` step 49a.

*Verified by.*
- `node test/core.test.js` 153, exit 0.
- `node test/build.js && node test/smoke.js` **530** (517 before), exit 0, no console or page errors.
- `help-guide.js` 7, exit 0.
- **Thirteen mutations, each failing by name:**
  - PRE-MADE dropped on delete;
  - diary rows left in the cache;
  - the import's cache filter undone (caught only once the check read the cache before the history write rebuilt it);
  - the import's write filter undone;
  - files removed beside the delete;
  - the toast blaming the connection;
  - the note deleted independently;
  - every copy counted;
  - the meal not corrected;
  - the answered set checked first;
  - PRE-MADE left on by REMOVE;
  - no EDIT advice;
  - the card not marked.
- The network catch-all removed still fails by name.

*Not verified:* the live app. Tablet step 49a covers it.

**The October review, PR 5: the write queue (12 Oct 2026; F5, F8).** #118 (PR 4) merged first.
- **F5.** A write to one row carries a key, `'table:row'` for the whole row and `'table:row#cols'` for some columns.
  When it lands, older failed writes it covers leave the pile instead of being retried over it. A whole-row write
  covers its row's writes of any kind; a partial one covers only the same columns.
  - 23 single-row writes carry keys: recipes, the diary, Planner days, settings, cooking notes, ticks, groups, the
    shortlist, swaps, word matches and aisles.
  - Imports, writes of several rows and function calls are unkeyed and retried as before.
  - A write's follow-up moved from inside its function to `{ after }`, so it still runs when the write is covered by a
    later one. These are FOLD INTO NOTES' note delete and a deleted recipe's file removal, both from PR 4.
  - A diary delete also drops a still-failing insert of the same entry, which would otherwise have re-created what the
    household removed.
- **F8.** `updateDiaryEntry` throws, marked as waiting, while its entry's insert is unsaved, instead of returning as if
  it had landed. The meal type goes on the pile behind the insert and arrives after it. It adds no toast of its own;
  the insert's failure has already said so.
- **The stub.** `__WRITE_FAIL_TABLES__[table] = { how, times }` fails the next n writes and then lets them land, and
  `__WRITE_FAILS__` counts the failures.
- `changelog.json` **2026-10-12.2**. `CLAUDE.md`'s line on `queueWrite` gives the key rule.

*Verified by.*
- `node test/core.test.js` 153, exit 0.
- `node test/build.js && node test/smoke.js` **537** (530 before), exit 0, no console or page errors, also in a run
  beside another.
- `help-guide.js` 7, exit 0.
- **Seven new checks:**
  - a favourite on (refused twice) then off;
  - two saves of one recipe;
  - both saves failing, then retried in order;
  - a favourite after a refused text save, which must not drop it;
  - a meal type during a failing insert;
  - a delete during a failing insert;
  - FOLD INTO NOTES covered by a later save.
- **Mutations, each failing by name:**
  - nothing dropped;
  - a partial write covering the whole row (survived at first, because that check read only the last upsert sent;
    tightened to the order of every write);
  - the follow-up lost when covered;
  - `return` instead of `throw`;
  - the diary delete unkeyed;
  - the favourite patch unkeyed.
- **One mutation survives, as expected:** removing the "older only" guard in `writeCovers`. The pile is always taken
  whole and in order, so no path reaches it; the comment says so.

*Not verified:* live. The failure needs a server error twice in a row, which no tablet step can make on demand.

**The October review, PR 6: several households (12 Oct 2026; F36, F31, F23, F24, F25, F42, F44, F40, F43, F35).**
#119 (PR 5) merged first.
- **Sign-in and sign-out (F36, F31).**
  - `hydrate` reads every membership. An account in two households is told so at sign-in, and nothing loads: the reads are
    not filtered by household, so it used to get both libraries merged and write to whichever came first.
  - `HOUSEHOLD_ID` is set only after the refresh's veto.
  - `SIGNED_OUT` reloads the page, as SIGN OUT does.
- **The calendar toggles with no settings row (F23).** When there is no row to tell by, the app asks separately whether
  `calendar_auto` exists, and no longer hides the toggles. The SQL page gives the one household without a row its row, and
  `ONBOARDING.md` §2 now makes it with the household.
- **Restores (F24).** Word matches and aisles upsert on their natural keys through `pushList(…, onConflict)`.
- **Writes that carried more than their change (F25, F42).**
  - `saveRecipe` leaves out `favourite`: the live column defaults to `false`, read-only. It is keyed `recipes:<id>#text`, so
    it never covers a favourite still waiting to land.
  - `saveRecipes` (source and keyword merges) updates source, tags and the text of each recipe instead of upserting every
    column.
  - `setSetting` upserts its own column only (`SETTING_COLUMNS`). The import keeps the whole row.
- **The image sweep (F44)** applies a re-hosted address only if the recipe still has the one it sent.
- **The week's first day (F40).** Changing it asks first, then clears the ticks of every week key that no longer starts a
  week, on the server and in the tab. The comment that said this already happened is corrected.
- **Shared recipes (F43).** `ourCopyOf` compares `normalisedSourceUrl` on both sides. Left out: `shared_recipes()`
  returning `copied_from`, a drop-and-create of a security-definer function for a case no household has hit.
- **`docs/migrations/harden-default-privileges.md` (F35, F23), waiting.**
  - New tables and sequences in `public` give `anon` nothing by default.
  - New functions still reach everyone through Postgres's global `PUBLIC` default, which a rule for one schema cannot take
    away, so each page that adds one keeps its revoke; the page says so.
  - It also inserts the missing settings row.
  - Tried on the scratch PG17 cluster, as the page records.
- `changelog.json` **2026-10-12.3**; `help.html` (the week-start question); `TEST-PLAN.md` step 50a.
- Four existing checks that asserted the old behaviour now assert the new: three on settings sending the whole row, one on
  a new recipe's row naming `favourite`.

*Verified by.*
- `node test/core.test.js` 153, exit 0.
- `node test/build.js && node test/smoke.js` **547** (537 before), exit 0, no console or page errors.
- `help-guide.js` 7, exit 0.
- Ten new checks.
- Mutations: see the PR.

*Not verified:* live. The SQL page is the household's to apply, and tablet step 50a is the household's.

*After the merge (12 Oct).* The household applied the SQL page, then merged #120 at 13:47 UTC. Read-only at 13:47: `pg_default_acl`
for `postgres` in `public` grants `anon` nothing on `S`, `f` or `r`, and no household is without a settings row. Issues #107,
#108, #109 and #113 were closed with comments. The household reported tablet steps 39a, 40a, 42a, 43a, 44a, 45a, 46a, 48a and
49a passed the same day (`docs/TEST-PLAN.md`); 38c, 38d, 40b, 47a and 50a are still to be reported.

**The October review, PR 7: the parser and the dictionary (12 Oct 2026; F17, F18, F41, F16, F19, F45).** #120 (PR 6)
merged first. Everything is in `core.js`; its version is `2026-10-12.1` in all three places, and `changelog.json` is
**2026-10-12.4** (#111, #112).
- **Lines reported unreadable (F17).** In STEPS and NOTES a line is prose: only one written in the syntax's own shape
  (`GROUP x-y:`, `STAGE 2:`, `MERGE a → b`) is reported. A misspelt GROUP straight after the steps still is.
- **Not metric (F18).** Pint, quart, ounce, pound, fl oz and sticks of butter are flagged when they follow a bare number; a
  stick of celery, a cinnamon stick and "500 g pound cake" are not.
- **Diagram errors (F41).** A GROUP handle written twice, and a MERGE output named like a group or step still in play, are
  errors in the diagram (and blockers in `validate-recipes.js`). A MERGE reusing its own input's name is still fine.
- **Word-match chains (F16).** `ingredientMatchMap` follows each match to the end of its chain; a loop stops.
- **Dictionary spellings (F19).** The reader splits an `also` cell only at commas outside brackets, and a note about a plain
  spelling goes in the row's new `note` field. Now indexed: long-grain rice, sweet paprika, coriander powder, free-range
  eggs; and the bacon note is no longer cut into a fake spelling. `tools/generate-ingredient-names.js` prints the note back
  in brackets, so `converter/ingredient-names.md` is byte-for-byte unchanged and neither household needs to reload anything.
- **Wording kept (F45).** The list shows "tinned" as written (the key is still folded, so it totals with "canned").
  Scaling keeps the unit as typed, agreeing a spelled-out one with its number (`1 litre` ×2 is `2 litres`), and scales a
  pinch, dash, handful, knob, squeeze or splash only to whole numbers, its word agreeing (`2 pinches`); otherwise the line is
  left as written. The household chose each of these on 12 Oct.
- **Measured live, read-only, before asking** (`tools/remeasure.js`'s method; every household counted, none read but ours):
  - F17, F18 and F41 newly flag nothing in any household's library (34, 0 and 5 recipes).
  - Shopping rows: 169 and 64, the same keys before and after, so **no tick is re-keyed**. One row in ours shows a
    different name (the tinned line); no row changes aisle or amount.
  - One recipe in ours scales differently (a pinch line); none in the others.
- `TEST-PLAN.md` step 51a.

*Verified by.*
- `node test/core.test.js` **162** (153 before), exit 0; nine new checks, each seen failing under a mutation (see the PR).
- `node test/build.js && node test/smoke.js` 547, exit 0, no console or page errors.
- `help-guide.js` 7, exit 0; `node tools/generate-ingredient-names.js --check`, exit 0.
- Every quoted line added to the tests compared with the live library: none is a real line.

*Not verified:* the tablet (step 51a).

**The October review's last two findings, F37 and F38 (12 Oct 2026; #105, #106).** Asked for by the household after PR 8
(#122) merged; not in the eight-PR plan. Edge Functions only: nothing in the app changes, so no changelog entry.
- **F37, `source-ingredients` and `rehost-images`.** A new `readCapped(res, max)`, one copy in each function and identical:
  a declared length over the limit is refused unread, and a body with no length (or a false one) is cut off once it passes the
  limit, instead of being buffered whole and measured after. `source-ingredients`' page fetch and `rehost-images`' stored-photo
  check now keep their timer until the body is in; both were cleared at the headers. (`rehost-images`' external fetch had the
  timer fixed in #102; it now reads through `readCapped` too.) `find-recipe-image`, the third function the finding named, is gone.
- **F38, `calendar-sync`.** SYNC NOW (`{ all: true }`) reaches `ALL_DAYS_AHEAD` = 400 days: the Planner read, the Google
  listing (`timeMax`) and `syncActions` all stop at `lastAllDate(today)`. A day further out is still written when the app sends
  its date. The send loop stops at `SYNC_BUDGET_MS` = 100 s, well inside the platform's 150 s, counts what it did not reach, and
  `note()` always records the outcome ("Google was slow: N days were not reached. SYNC NOW again to finish").
- **Tests:** `source-ingredients.js` 16 (12 before: `readCapped` run on made-up streams, and the fetch read from source);
  `image-integrity.js` 37 (35: the two copies identical, every image body through it); `calendar-push.js` 39 (35: the horizon,
  the date path unaffected, the query and listing bounds, the budget). 14 mutations, each caught by name. `tsc --strict` over
  the three files with stand-ins for Deno and supabase-js: no errors but the stand-ins' own, the same as on `main`.
- **For the household:** redeploy the three functions, JWT verification on; `docs/INFRASTRUCTURE.md` lists them as waiting.

*Not verified:* live. A slow or oversized page, and a plan 400 days ahead, cannot be made on demand; the versions are read
back after the redeploy.

*After the merge (#123, 17:00 UTC).* The household redeployed the three at 17:00–17:01 UTC, but from `main`'s raw links within a
minute of the merge, which GitHub still served from cache: v15, v5 and v5 carried the old code (the same `ezbr_sha256` as v14, v4
and v4; `source-ingredients` v5 read back with no `readCapped`). Redeployed from links pinned to the merge commit at
17:05–17:06 UTC: **`rehost-images` v16, `source-ingredients` v6, `calendar-sync` v6**, JWT verification on, each read back in full
with `get_edge_function` and carrying the change (and `calendar-sync` pasted without the added indentation). `INFRASTRUCTURE.md`
records them and now says to use a commit-pinned link or wait five minutes. #105 and #106 closed.

**The converter reminder (12 Oct 2026; #127).** Asked for by the household: when a coded change alters the converter's
instructions, ask each household to reload them into its conversion project, without stopping anyone using the app.
- **What the household sees.** A gold CONVERTER bar, in the page's flow like the OFFLINE bar (never a dialog), saying the
  instructions have changed and naming the version, with OPEN THE INSTRUCTIONS ↗, DONE and LATER. DONE records the version for
  the household (one tap, any device); LATER hides it until the app is next opened and writes nothing.
- **Where the version lives.** `converter/conversion-instructions.md` now carries a `**Version 2026-10-12.1.**` line, and
  `index.html` a matching `CONVERTER_VERSION`. `test/core.test.js` pins the file's sha256 with the version
  (`CONVERTER_PINNED`): a change to the file without moving all three fails, which is what makes "only coded changes count" hold.
  `CLAUDE.md` says so. This PR's own edit to the file (the Version line) is the first change it announces.
- **The record.** `household_settings.converter_ack_version`, one nullable text column (`docs/migrations/add-converter-ack.md`,
  waiting; tried on the scratch PG17 cluster). The app reads it from the settings row (`select('*')`), shows the bar and sends the
  column only when the row carries it, so either order is safe and the page says so (the F34 rule). DONE goes through
  `setSetting`, so it sends `household_id`, the column and `updated_at` only, keyed to that column; the import's whole-row
  `saveSettings` does not send it. A refresh (coming back to the tab) re-reads the row, so a DONE on another device clears the bar.
- `changelog.json` **2026-10-12.5**; `help.html`: section 9's tip and a new "The CONVERTER bar" under section 12;
  `TEST-PLAN.md` step 52a, and `HOUSEHOLD-JOBS.md`, where it replaces "Reload the converter in both households".

*Verified by.*
- `node test/core.test.js` **164** (162 before), exit 0: the file's version agrees with the app's, and the file matches its pin.
- `node test/build.js && node test/smoke.js` **554** (547 before), exit 0, no console or page errors: the bar shows and names the
  version; a real click on PLANNER works under it and nothing is laid over the page; DONE sends that one column and hides it;
  another device's DONE clears it on refresh; an older version still asks; LATER sends nothing; the current version, or no column,
  shows nothing, and nothing sends the column where it doesn't exist.
- `help-guide.js` 7, exit 0.
- Nine mutations, each failing by name: the column detected from any row; DONE writing nothing; LATER writing; the bar never
  shown; the column sent where it doesn't exist; the bar laid over the page; the refresh not redrawing it; the file changed
  without its pin; the app's version differing from the file's.

*Not verified:* live. The SQL page is the household's to apply, and step 52a is the household's.

*After the merge (#129, 02:24 UTC 13 Oct).* The household applied `add-converter-ack.md` afterwards (the column was not there at
02:24) and reported both checks as expected. Checked read-only at 05:53 UTC: `converter_ack_version` `text`, nullable, no default; 3 households, 0 confirmed; granted to `authenticated` (and `postgres`, `service_role`), not to `anon`. Step 52a passed on the tablet the same morning: the bar appeared, DONE took it away for good (a reload, and the phone), and the
household's row read back `2026-10-12.1` at 06:19:13 UTC with its other settings unchanged. The second family household has
not confirmed yet; the live test's household never will, and no one sees its bar.

**Ticked items off the printed list, FILE labels, and two titles scrubbed (13 Oct 2026; #94's first half).** The household's
answers of 13 Oct.
- **PRINT / A4 PDF leaves ticked items off** (`@media print` hides `.shop-row.checked` and `.shop-category.all-checked`), as
  EXPORT PNG already meant to. The PNG hid only a ticked row's name, leaving its MERGE WITH… behind, and showed every row's
  MERGE WITH…: it now hides the same two classes and `.shop-tools`. `renderShopping` sets both classes, so paper and PNG agree.
- **Source files are FILE 1, FILE 2…** on the form and FILE 1 OF n in the viewer, not PAGE: a PDF of several pages is one file,
  kept whole (the household's question at 38d).
- **The two recipe titles** in `IMAGES.md`, `HANDOVER.md`, `TEST-PLAN.md`, `HANDOVER-CONVERSION-INTEGRITY.md`,
  `converter/test-set.md` and `rehost-images`' comments are "recipe A" and "recipe B". Comments only in the function: no
  redeploy (`INFRASTRUCTURE.md` says so). Old commits still hold them; history is not rewritten.
- `changelog.json` **2026-10-13.1**; `help.html` §7 and §9; `TEST-PLAN.md` and `HOUSEHOLD-JOBS.md` step 53a; the job list's
  #101 entry gone (closed) and its "two titles" decision done.

*Verified by.* `node test/core.test.js` 164, exit 0. `node test/build.js && node test/smoke.js` **557** (554 before), exit 0, no
console or page errors: print leaves the ticked row off and keeps the rest; the PNG does the same, with no MERGE WITH…, and the
screen is restored after; an aisle with everything ticked is left off both and still shown on screen. Four existing checks
now read FILE. `help-guide.js` 7 and `image-integrity.js` 37, exit 0. Five mutations, each failing by name: the label left as
PAGE, the print rule removed, the PNG hiding only the name, the PNG keeping `.shop-tools`, the aisle class never set.

*Not verified:* a real printer (the check emulates print media in Chromium). Step 53a reported passed by the household, 13 Oct.

**AUDIT on the shopping list (13 Oct 2026; #94's second half, `docs/PLAN-SHOPPING-AUDIT.md`, answered "defaults").**
- **AUDIT** at the top of the list (after CLEAR TICKS) draws the fixing tools on every row: the existing *Same as …?* and
  MERGE WITH…, and a new aisle pick set to the row's aisle, with why it is there. **Off, no row has tools**: until now they
  showed on every row, always. Off, the button reads `AUDIT · n` when *Same as …?* questions are waiting. On, END AUDIT.
- **Remembered on the device** (`localStorage 'kitchen.shoppingAudit'`, `shopAuditOn`/`setShopAudit`, in `try/catch`; blocked
  storage reads as off). Never a column.
- **The aisle pick** writes one row through `addAisleOverride(it.key, aisle)` — the row's own key, never the tick key, which
  carries `both|` on BOTH WEEKS. The row moves and says *Moved to … · UNDO*; UNDO puts back the household's own earlier aisle
  if it had one, or removes the one written (`shopAisleUndo`, per tab). No pick while `aisle_overrides` is missing.
- **A merge where only one row is ticked** says so first (*The merged row will be unticked…*, on *Same as …?* and on MERGE
  WITH…'s confirm line), and `mergeOnList` then unticks the merged (`to`) row with one `saveTick` delete when `to` was the ticked
  one. Both MERGE paths go through it.
- `.shop-head-right` wraps under 860 px. Print and PNG already hid the tools (#132). `buildShoppingList` is untouched.
- `changelog.json` **2026-10-13.2**; `help.html` §7 (`#shopping-audit`) and a QUICK ANSWERS link; step **54a**.

*Verified by.* `node test/core.test.js` 164, exit 0. `node test/build.js && node test/smoke.js` **568** (557 before), exit 0, no
console or page errors: eleven new checks (off draws no tools and counts the question; on draws every row's tools with its aisle
and writes nothing; remembered after a reload; BOTH WEEKS pick by the row's own name with the tick kept; UNDO both ways; the
merge warning and its one untick; print, and 412 px with nothing off the side; END AUDIT forgets; storage blocked; table
missing). The kale merge checks now turn AUDIT on first. `help-guide.js` 7, exit 0. Eleven mutations, each failing by name (blocked storage without its `try/catch` crashes the suite
at that check): tools always drawn, no count, not remembered, no `try/catch`, the tick key used for the aisle, UNDO always
deleting, no untick, no availability guard, no wrap, the print rule for the tools removed, no warning.

Step 54a reported passed by the household, 13 Oct.

**Settings → INGREDIENTS folds, and one search (13 Oct 2026; #95, `docs/PLAN-INGREDIENTS-TAB.md`, answered "defaults").**
- WORD MATCHES, SHOPPING AISLES, SWAPS and DICTIONARY each fold under a heading (a full-width button, at least 44 px) that
  counts what the list holds, kept-separate pairs included: `WORD MATCHES (15)`. Open at first: the first three; the dictionary
  folded, its heading replacing SHOW ALL 140 ROWS (`#dictionaryToggle` and `dictionaryOpen` are gone). Remembered per device,
  `kitchen.ingredientsOpen`, in `try/catch`; only a tap on a heading writes it.
- **The INGREDIENT LOOKUP box is the tab's one search** (now `type="search"`): `renderIngredientsHeads` hides every list row
  whose text, less its buttons, lacks what is typed, drops empty group labels, opens the sections with a match and folds the
  rest to `(0 OF n)`; a folded one opened during a search says *Nothing here matches "…"*. Taps during a search are not stored,
  so clearing the box puts every section back as left. It filters the rows each list has drawn and draws nothing itself, so
  no list redraws another (the loop the plan warned of cannot arise). No search across other tabs (the plan's §2).
- `showView('swaps')` (the lookup's EDIT) opens SWAPS first and remembers it open. Nothing writes to the database.
- Two older autocomplete checks moved focus to a box that is now folded while the lookup holds text; they clear or blur first.
- `changelog.json` **2026-10-13.3**; `help.html` §10; step **55a**; `PLAN-LAYOUT.md` E notes the change.

*Verified by.* `node test/core.test.js` 164, exit 0. `node test/build.js && node test/smoke.js` **576** (568 before), exit 0, no
console or page errors: seven new checks (counts against the cache with made-up rows; the opening state; a fold remembered over
leaving Settings and a reload; a search opening the one section with a match at (1 OF n) and folding the rest; the no-match
line; clearing restores, storing nothing; a jump to SWAPS opens it, 412 px with no sideways scroll and headings ≥ 40 px, and no
writes), plus blocked storage. The dictionary check reads the heading. `help-guide.js` 7, exit 0. Nine mutations: seven fail by name (kept-separate pairs not counted, the dictionary open
by default, nothing stored, the jump not opening SWAPS, short headings, no no-match line, no filtering), blocked storage
without its `try/catch` crashes the suite at its check, and a search that stores its folds crashes it earlier, in the
autocomplete checks, whose boxes it leaves folded: caught, though not by its own check.

Step 55a reported passed by the household, 13 Oct.

**Preparation as steps, PR 1: the derivation in `core.js` (13 Oct 2026; #88, `docs/PLAN-PREP-STEPS.md`, answered "defaults").**
Nothing visible yet: PR 2 adds the per-device setting and draws it. No changelog entry (the household notices nothing).
- **`prepStepFor(line)`** reads the clause after an ingredient line's first comma against a fixed table of 27 participles
  (sliced→slice … toasted→toast), each with an optional adverb of its own (*peeled and roughly chopped* → **Peel and roughly
  chop the swede**), up to three joined by "and", plus *cut into …*, *zest only*, *juice only* and *leaves only*. Anything
  else gives no step: tail notes, *divided*, ahead-of-time states (kept out of the table), preparation before the name.
- **`withPrepSteps(parsed)`** splits each group with a step into parts, in order, so rows never move; each prepared part gets
  a one-input MERGE marked `prep`, beside the step before the one that needs it, or in a column of its own before it when that
  is the first stage or an all-`[instant]` one. The input is never changed; a recipe with layout errors comes back as it is.
- **`computeColumns`** gives a split group its own colour (`paletteIndex`) and keeps it through a step that joins its parts
  (`family`); a recipe with neither lays out exactly as before. The timeline is untouched (PR 2 keeps drawing it from the
  recipe as written).
- Core version **2026-10-13.1** in all three places.

*Verified by.* `node test/core.test.js` **171** (164 before), exit 0: seven new checks. `node test/build.js && node
test/smoke.js` 576, exit 0, no console or page errors. Ten mutations, each failing by name except one: a separate
"ahead-of-time" guard could not change any answer (none of its words is in the table), so it was removed rather than kept
untested. **Measured on the live library (read-only, counts only, by a subagent; no text left the database's answer file,
deleted after):** 39 recipes, 0 with layout errors before or after, 0 whose ingredient lines changed, 0 whose input was
changed, 0 exceptions; 34 gain 97 prep boxes; extra columns 0 / 1 / 2 in 20 / 15 / 4 recipes. Of 176 comma clauses, 99 were
read before the adverb fix; the commonest unread shape was "ACT and ADV ACT" (14), which that fix now reads. Every made-up line
in the tests was checked against the library: 0 matches.

*Not verified:* anything on screen; that is PR 2.

**Preparation as steps, part 2: the setting and the drawing (13 Oct 2026; #88, after #136).**
- **PREPARATION** in Settings → APP: BEFORE YOU START (AS WRITTEN), the default, or AS STEPS IN THE FLOW. This device only
  (`kitchen.prepSteps`, `prepStepsOn()` in `try/catch`; blocked storage reads as written); never `setSetting`, never a column.
  APPEARANCE's "like every other setting here" is reworded, since it stopped being true.
- `mountFlow(…, { prepSteps: true })` from the recipe viewer and the Group Viewer only: they draw `withPrepSteps(parsed)`; the
  Add/Edit preview, the timeline and the shopping list keep the recipe as written. A prep box is a shade lighter (`.prep`); the
  hint starts PREPARATION SHOWN AS STEPS (SETTINGS → APP). Ticks are keyed `id|prep` while steps are drawn, so each drawing keeps
  its own place; ticking the step that uses a preparation ticks it too (the existing overlap rule).
- `changelog.json` **2026-10-13.4**; `help.html` §3 `#prep-steps` and a QUICK ANSWERS link; step **56a**; ARCHITECTURE §3 rows.

*Verified by.* `node test/core.test.js` 171, exit 0. `node test/build.js && node test/smoke.js` **582** (576 before), exit 0, no
console or page errors: six new checks (default as written, and the setting stored on the device with no household write; on,
each prepared line a step in the column before, with the hint; the timeline identical; ticks flow back, are kept per drawing,
and the last column still logs it; the Group Viewer follows, the preview and the shopping list do not; blocked storage). The
Settings tabs check now lists PREPARATION. `help-guide.js` 7, exit 0. Nine mutations, each failing by name (never drawn; the
preview following; the timeline from the drawing; shared ticks; not stored; the Group Viewer ignoring it; no hint; no prep
class), and blocked storage without its `try/catch` crashes the suite at its check.

Step 56a reported passed by the household, 13 Oct.

**FINISH TOGETHER in the Group Viewer (13 Oct 2026; #87 PR 3, `docs/PLAN-SIDES.md` §4.4, built first as the plan allowed).**
- **`lineUpTimelines(timelines, mode)`** in `core.js`, pure: in `'finish'` each recipe's lane is offset by the longest span less
  its own, steps shifted with it; in `'start'` every offset is 0, as before. A recipe with no timings stays without a lane.
  `about` is set when the longest dish has an untimed or open-ended step, since those count as the 2-minute stand-in.
  `computeGroupTimeline` calls it and passes `mode` and `about` through. Core version **2026-10-13.2** in all three places.
- **The switch** START TOGETHER · FINISH TOGETHER in the strip's head. **Default:** FINISH when any dish's course is Side,
  otherwise START (§8 Q4). The choice is `state.groupLineUp` (`{ id, mode }`), for that group in this tab only: no write, no
  column, no storage. In FINISH the last tick reads SERVE, and each dish's header says START FIRST or START AT +…, with ABOUT in
  front when `about`. In cooking mode the switch sits with the strip behind SHOW TIMELINE; the start times stay on the headers.
- `changelog.json` **2026-10-13.5**; `help.html` §4 `#finish-together` and a QUICK ANSWERS link; step **57a**.

*Verified by.* `node test/core.test.js` **176** (171 before), exit 0: five new checks (offsets 0 and 45 with both ending
together; START gives 0 and 0; no timings, no lane; fixed timings not ABOUT; an open-ended step on the longest dish is ABOUT).
`node test/build.js && node test/smoke.js` **586** (582 before), exit 0, no console or page errors: four new checks (a group
with a Side opens in FINISH with START FIRST, START AT +45 min and SERVE; START TOGETHER moves the side's lane back to 0 and
drops the start times and SERVE; a group with no Side opens in START; in cooking mode the switch waits behind SHOW TIMELINE
while the start times stay). `help-guide.js` 7, exit 0. Thirteen mutations, each failing by name: four in `lineUpTimelines`
(no offset, steps not shifted, never ABOUT, a laneless dish given a lane), six in the app (default always START, default
always FINISH, no SERVE, the switch not stored, START AT never shown, start times in START mode), two in cooking mode (the
strip not hidden, the start times hidden) and the guide's anchor removed. Every made-up line and title in the tests was
checked against the library (counts only): 0 matches, after one step label that did match a library line was replaced.

Merged as #138 at 13:04 UTC, 13 Oct. Step 57a reported passed by the household, 14 Oct.

**SERVE WITH in the recipe viewer (13 Oct 2026; #87 PR 1, `docs/PLAN-SIDES.md` §4.2–4.3 and §4.5, after #138).**
- **`servingCalls(parsed)`** in `core.js`, pure: an ingredient line ending *to serve* (not *to serve 4*), *for serving*, *to
  accompany* or *on the side*, by its shopping name; and in MERGE labels, `STEPS:` and every notes section, *serve(d) [it|this|
  them] with / alongside / over / on a bed of X*, *with X on the side*, *X to accompany*, *accompanied by X*. X stops at
  punctuation and at *for / to / if / while / when / as / so*, splits on commas, *or*, *and*, *and/or*, and loses a leading
  *a, an, some, extra, plenty of, a bed of…*. `TAIL_NOTES` is untouched, so no shopping row is renamed and no tick re-keyed.
- **`matchSides(calls, sides, selfId)`**: only `course=Side`, never the recipe itself. Score 3 for the title or a keyword, 2
  when every word of a two-word-or-longer item is there, 1 for the head noun; descriptors (*steamed, plain, warm, cooked,
  crusty, fresh, fluffy*) dropped and plurals folded on both sides. Two per phrase, three per dish, ties in the page's order.
- **The viewer** shows `SERVE WITH: <side> →` under the chips (`#viewerServeWith`), most-cooked side first; each opens that
  side with the same way back. Hidden when nothing matches and for another household's recipe. Read-only: nothing is written.
- Core version **2026-10-13.3** in all three places; `changelog.json` **2026-10-13.6**; `help.html` §4 `#serve-with` and a
  QUICK ANSWERS link; step **58a**; ARCHITECTURE §3 row; the plan notes four refinements found while building.

*Verified by.* `node test/core.test.js` **185** (176 before), exit 0: nine new checks (each ingredient tail, by its shopping
name; a MERGE label, STEPS and NOTES with alternatives, *a bed of* dropped and a stop at punctuation; *to serve 4*, *serves 6*,
*serve immediately*, *serve hot* and *serve on warmed plates* unheard; *for dipping* cut; scores 3, 2, 1 in order; plurals and
keywords; Side only, never itself, two and three; no match, no offer; three shopping keys pinned as before). `node
test/build.js && node test/smoke.js` **591** (586 before), exit 0, no console or page errors: five new checks (no Side, no line;
with one, the line and its link; the more-cooked first; the link opens the side keeping the way back; no line for a recipe
without a phrase or for another household's). `help-guide.js` 7, exit 0. Twenty-three mutations, each failing by name (19 in
`core.js`, 4 in the page); the first run left two standing (any course, the recipe itself) because the two-per-phrase cap hid
them, and the check was rewritten until both failed. Every made-up word and title in the tests and the guide was checked
against the library (counts only): 0 matches.
*Live library (read-only, counts only, by a subagent, 13 Oct; the rows were checked against the database's md5s and deleted
after):* household 1, 34 recipes and 3 sides: 13 recipes say what to serve with them (30 phrases: 3 ingredient tails, 20 in
steps, 7 in notes); **8 would show a SERVE WITH line**, one side each (scores 3 ×2, 2 ×1, 1 ×5); 5 are heard but match no side
(garnishes and the like, as intended); no side matches itself; 0 errors. Household 2, 5 recipes and no sides: 4 say what to
serve with them, none shows a line until it has sides (§5). The third household has no recipes. The plan's SQL count (§3) put
household 1 at 7 recipes naming a staple with a matching side; the detector finds 8.

Step 58a reported passed by the household, 14 Oct.

**The Planner's SERVE WITH offer (13 Oct 2026; #87 PR 2, `docs/PLAN-SIDES.md` §4.5–4.6, after #140). #87 is built.**
- Under a non-Side dish on the Planner, `SERVE WITH: + <SIDE> ×` (`sideOfferHtml`, `planSideOffers`): the viewer's matches, less
  any call already covered (a call is covered when any of its alternatives has a side on the day, so "rice or naan" with naan
  planned offers nothing). Not in GROUP SOME TOGETHER; never on a past or AWAY day (the Planner draws no dish rows there).
- **+** (`addSideToDay`): `addPlanRecipe(date, sideId, people)` with a new optional headcount, the main's planned number (0
  when that is what the side is written for), in the day's one `planner_days` upsert; then the main's group gains the side
  (`saveGroup`), or a new group of the two is made (`createGroup`): one `meal_groups` upsert, never a delete. A toast says so.
- **×** hides the offer for that dish on that day in this tab (`state.sideOffersHidden`): no write, no column (§8 Q5).
- `changelog.json` **2026-10-13.7**; `help.html` §4 `#side-offer` and a QUICK ANSWERS link; step **59a**. No `core.js` change.

*Verified by.* `node test/core.test.js` 185, exit 0. `node test/build.js && node test/smoke.js` **598** (591 before), exit 0, no
console or page errors: seven new checks (the offer under a dish asking for "freekeh or flatbreads"; none while picking a group;
× hides it with no write; a tap writes one `planner_days` row, the side at the dish's 6 not its own 4, and one `meal_groups` row
of the two, both in our household, with the toast; nothing more offered once covered; a grouped dish's group gains the side with
no delete, and a side written for the dish's number keeps 0; none under a Side that itself says "serve with"). `help-guide.js`
7, exit 0. Eleven mutations, each failing by name; the first run left one standing (an offer drawn while picking a group),
because the check ran on a day with nothing left to offer, so it moved to the day with an offer, and a second (an offer under
a Side) was made independent of the first. Every made-up line and title was checked against the library: 0 matches.

Step 59a reported passed by the household, 14 Oct.

**OFTEN WITH (13 Oct 2026; #142, `docs/PLAN-SIDES.md` §9, after #143).**
- **`groupedWith(recipeId, groups)`** in `core.js`, pure: every recipe sharing a group with this one, `times` = distinct days
  (two groups on one day count once), `last` = the latest; most times first, then most recent. Core **2026-10-13.4**.
- **Viewer** `#viewerOftenWith` under SERVE WITH: two at most; deleted recipes skipped (6 references when measured); a recipe
  already under SERVE WITH left out. Another household's recipe never shows a line (its id is in none of our groups).
- **Planner** `oftenOfferHtml`, a second line under the dish, `.day-side-offer.often` (SERVE WITH's is now `.serve`): also
  skips what is on the day and what SERVE WITH matches even when that line is hidden; shown under a Side too (any course, as
  decided); not while picking a group; its own × (`state.oftenHidden`, this tab). **+** is SERVE WITH's: `addSideToDay`,
  renamed `addWithToDay`, so the same two one-row writes.
- `changelog.json` **2026-10-13.8**; `help.html` §4 `#often-with` and a QUICK ANSWERS link; step **60a**.

*Verified by.* `node test/core.test.js` **189** (185 before), exit 0: four new checks (two days before one, a tie to the more
recent; one day once, a repeat in a group once, never itself; both ways, and nothing from no groups; `last`). `node
test/build.js && node test/smoke.js` **606** (598 before), exit 0, no console or page errors: eight new checks (the viewer's
line with order, cap, the deleted and the SERVE WITH side left out; none for a recipe never grouped or another household's;
the Planner's two lines apart, a partner on the day not offered; under a Side; hiding SERVE WITH doesn't move its side across;
none while picking; × with no write; + writes one `planner_days` and one `meal_groups` row). #141's SIDE OFFER checks now look
at the SERVE WITH line by its class, since a day can carry both. `help-guide.js` 7, exit 0. Seventeen mutations: fifteen
failed by name at once; a theirs-guard could change nothing (another household's ids are in none of our groups) and was
removed; "deleted not skipped" first crashed the suite in the check's setup, so the setup moved inside the check and it now
fails by name. Every made-up title and line was checked against the library: 0 matches.

Step 60a reported passed by the household, 14 Oct.

*14 Oct 2026:* merged as #144 (20:21 UTC, 13 Oct). The household declined a group history (`PLAN-SIDES.md` §9.6): it does not
expect to ungroup in practice, so no table is planned.

**READABILITY T, colour tokens (14 Oct 2026; `docs/PLAN-READABILITY.md` change T, on `main` at `6652005`).** The household said
"go" for T alone; S, H, R and F are still proposed. `index.html` CSS only: no markup, id, wording, `core.js`, `help.html` or
schema change, and `core.js`'s version is unchanged.
- **Inks.** `--ink-faint` is `#6F6759` (light; the plan said `#736B5C`, which is 4.3:1 on the Planner's group and day rows) and
  `#938A79` (dark; it was 2.9:1 on a card). All 26 small-text uses of `--ink-mute` are `--ink-soft`, so `--ink-mute` is a fill only.
  `.side-count` is `--ink-faint`.
- **Washes.** The 30 `rgba()` literals in rules became 12 tokens with a dark value each (the plan's `--sage-wash`, `--danger-wash`
  and `--ink-shadow`, and nine more); `--plum-wash`, shared by fourteen rules, is unchanged. The plan's "Built as" note has the
  list and the reasons. In dark, the plum wash behind a quantity was 1.03:1 against its card and is 1.17:1; selected text had
  no highlight and has one.
- `changelog.json` **2026-10-14.1**; step **61a**. No `help.html` change: no label changed.

*Verified by.* On `main`, before: `node test/core.test.js` **189**, exit 0; `node test/build.js && node test/smoke.js` **606**,
exit 0. After: `core.test.js` **194** (five new checks), exit 0; smoke **609** (three new), exit 0, no console or page errors;
`help-guide.js` 7, exit 0. Contrast was measured in a browser with a throwaway probe kept outside the repo, on the stub's
made-up data at 1280×800, on the recipes, viewer, Planner, Shortlist, Shopping, History, Settings (four tabs) and the add
dialog: text elements under 4.5:1, **light 365 → 25** (all sage or gold used as text, which T does not touch), **dark 225 → 0**,
about 490 measured in each theme. Two things the probe caught: its first dark pass measured the light theme (the app overrides
a stored theme on load; the suite switches it in Settings → APP), which showed as identical counts in both and was rerun; and a
first dark sage alpha of .12 left two UNGROUP labels at 4.09:1, so it is .06. Eleven mutations (six on the core checks, five on the
browser ones; they cover all eight new checks), each failing the right check by name: `core.test.js`: a literal `rgba()` back on the quantity pill; light `--ink-faint` back to `#A79E8D` (2.35:1) and dark back to
`#6F6759` (3.14:1); `--ink-mute` set as a text colour; `.side-count` back on `--line-faint`; a token missing from the dark
block (`--scrim`). `smoke.js`: the pill's literal back (dark 1.03:1 against 1.08); light and dark `--ink-faint` back (2.50 and
2.91:1 on the sidebar's labels); today's Planner row on the shared wash (4.47:1 light, 4.39:1 dark); dark sage back to .12
(4.09:1). Every mutation was restored and `index.html` compared byte-for-byte with the good copy.

*Not verified.* The real tablet (61a is the household's). **EXPORT PNG and a print preview**: no `@media print` rule sets a
colour and the export reads only `--paper` from the stylesheet, but no PNG or PDF was made here (html2canvas cannot load through
the sandbox proxy). Hover, focus and error states the stub does not reach, and every dialog but the add form. Elements dimmed on
purpose by opacity (7 in the light theme: days outside the month, a step mid-fade) are left out of the checks. The app against
the real backend (smoke stubs Supabase). The by-eye judgements in the plan's "Built as" note come from a style agent's
mock-ups, which this session did not see; its ratios were recomputed here and agree.

*Left for the household to decide* (also in the plan): sage and gold used as text, 25 elements at 2.6 to 3.1:1; and a selected
Shortlist item, which barely differs from an unselected one in either theme (as it did before T).

**READABILITY S, the type scale (14 Oct 2026; `docs/PLAN-READABILITY.md` change S, on `main` at `e7ca4dc`, after T).** The household said
"go" with the defaults put to them. `index.html` CSS and one style attribute (below); no id, wording, `core.js`, `help.html` or
schema change, and `core.js`'s version is unchanged.
- **The scale.** 212 font-size declarations on seven sizes (13, 14, 15, 16, 19, 22 and 26px; 21 before); rules at 10.5px or smaller
  76 to 0; IBM Plex Mono on 26 rules for figures, times and code (108 before; the list is exact in `core.test.js`); body weight
  400, and the 10 rules left at 300 are titles of 19px and up. The plan's "Built as" note under S has the mapping and every
  departure.
- **Departures from the plan's text.** The done state is in `--ink-soft`, not `--ink-mute` (T made that a fill only); the
  ingredient cells reserve 40px for the tick (+45px and +89px of table height, with the alternative priced in the plan); the
  numbered-step badge is 24px; `.filter-row-label` is 92px; the phone calendar cell is 13px; the style attribute on GROUP
  SELECTED in the Planner's group picker loses its `font-size:11.5px`.
- `changelog.json` **2026-10-14.2**; step **62a**. No `help.html` change: no label changed, and the guide never says how a tick looks.

*Verified by.* On `main`, before (a snapshot): `node test/core.test.js` **194**, exit 0; `node test/build.js && node test/smoke.js`
**609**, exit 0. After, on the finished tree: `core.test.js` **199** (five new checks), exit 0; smoke **613** (four new), exit 0, no
console or page errors; `help-guide.js` 7, exit 0. T's own checks still pass (493 and 481 quiet-ink elements at 4.5:1). Measured in
a browser with throwaway scripts kept outside the repo, on the stub's made-up data and a made-up 14-ingredient recipe (no library
line used): sizes 21 to 7, rules at 10.5px or smaller 76 to 0, mono 108 to 26; the flow table 710 to 797px (tablet) and 730 to
886px (phone); the recipe viewer's header 4 to 5 lines (169 to 240px) on the tablet and 6 to 8 lines on the phone; in cooking
mode 3 lines both ways (134 to 146px); the recipe on 2 A4 sheets both ways; elements wider than their box 17 to 18 (tablet) and
17 to 19 (phone, where the new class is the calendar's line-clamped name). The building session looked at before and after
screenshots of the recipes grid, the viewer, the flow table, the timeline and the Planner. **Fourteen mutations, each failing the
right check by name.** `core.test.js` (nine): a size of 12px; a label back in mono; `.qty` losing mono; body at weight 300; a
small label at weight 300; step text centred; step text off the foot of its box (PLAN-LAYOUT C); the done state with opacity
back; the old 18px tick. `smoke.js` (five, run in parallel beside an unmutated control copy that passed all 613): `.viewer-meta`
at 12px (two checks); a step box in mono; `.side-label` at 11px; the done colour without `!important`; the filter label back at
68px (KEYWORD clipped). The mutations and measurements caught four faults of my own, all fixed before this record: a keyframe test
in the transform (`endswith('to')`) that skipped `.rcard-photo`; lane labels wrongly kept in mono; a done-state check that read a
colour mid-fade and so failed on unmutated code (the control run showed it; the cell's colour transition is now switched off for
the read); and a mutation that did not apply. A stray `index.html.stats.json` from the transform script was deleted before the commit.

*Not verified.* **IBM Plex widths:** the sandbox has no IBM Plex (Inter and DejaVu Sans Mono stood in), so every width and line
count is approximate; the real tablet is the household's (62a). EXPORT PNG pixels, and a print preview beyond one made-up recipe's
A4 page count. Hover, focus and error states the stub does not reach. Phone-width clipping only on the screens the stub reaches;
the dark theme's layout was not measured separately (sizes do not depend on it).

*Left for the household to decide:* the ingredient cells' 40px reserve (or reserve only once ticked), and what S's bigger header
does to the viewer, with H still to come.

**READABILITY H, 44px tap targets (14 Oct 2026; `docs/PLAN-READABILITY.md` change H, built on `main` at `6d2ff33`, after S).** The household
chose "option C" from three put to them (everything in the viewer, the Planner and the sidebar at 44px, with tighter row and sidebar
spacing). `index.html` CSS only, plus `APP_VERSION`; no id, markup, button wording, `core.js`, `help.html` or schema change, and `core.js`'s
version is unchanged.
- **What changed.** One `TAP TARGETS (READABILITY H)` block in the stylesheet gives `min-height:44px` to every button in the viewer, the
  Planner and the sidebar, and `min-width:44px` to the × buttons and the round scale buttons; `a.btn` is `inline-flex`; the search bar's input
  stretches to the bar's height. The card's star and **+** are 36px with an invisible `::before` (`inset:-5px`) that makes the hit area 44px; the
  toggle is 44px by 26px. To keep the screen: Planner day rows 14px to 6px padding, the sidebar's gaps removed, nav links exactly 44px.
- **The plan's list was shorter than its own check**, and the list built is the check's (the plan's "Built as" note under H has the account,
  every departure and the pixel numbers).
- `changelog.json` **2026-10-14.3**; steps **63a**. No `help.html` change: no label changed.

*Verified by.* On `main`, before (a snapshot): `core.test.js` **199**, exit 0; `node test/build.js && node test/smoke.js` **613**, exit 0.
After, on the finished tree: `core.test.js` **202** (three new checks), exit 0; smoke **617** (four new), exit 0; `help-guide.js` 7, exit 0.
Measured in a browser with throwaway scripts kept outside the repo, on the stub's made-up data and a made-up 14-ingredient recipe (no
library line used), tablet 1280×800 and phone 412×915, counting buttons, selects, links and fields (the plan's note counts buttons only, so its numbers are smaller): elements under 44px in the Planner 37 of 45 to 0 (39 of 41 to 0), the history 12 of 54
to 0 (14 of 50 to 0), the Shortlist 7 of 14 to 0 (10 of 10 to 0); in the viewer 25 of 32 to 1, the one left being the cook-note box at 38px
(28 of 28 to 1). The recipes filter area 213 to 249px (383 to 461); the Planner's 14 days 913 to 1124px, **+23%** (1062 to 1394px, **+31%** on the
phone); the sidebar fits 1280×800 with 12px to spare, but **at 1280×720 it scrolls by 46px, where it fitted before.** **Fourteen mutations,
each failing the right check by name.** `core.test.js` (nine, run in the repo and restored byte for byte): `.day-choose` leaves the list;
`.sl-remove` loses its width; the card's `::before` removed; the card buttons back at 27px; the thumb's travel 15px; the track 21px tall;
`.navlink` loses its height; the `::before` at `inset:-4px`; `.serve-with-link` leaves the list. `smoke.js` (five, run in parallel on scratch
copies beside an unmutated control copy that passed all 617 with exit 0): the `::before` removed and the `::before` at `-4px` (both fail the
hit test, naming the corner buttons missed); `.btn` back at 30px on the phone only (fails the phone check alone); a cooking-mode header
button forced onto its own line (fails the cooking-mode check alone); `.serve-with-link` out of the list (fails the tablet and the phone
check, naming "Test Pasta →" at 21px). The control run on the first build failed all four new smoke checks, and showed three faults of my own,
fixed before this record: the SERVE WITH links were missing from the list (my measuring recipe had no such line); the hit area was 42px
(`inset` is measured inside the button's border, so `-5px`, not `-4px`); and the cooking-mode check assumed a one-line header, which the
test recipe's information rows do not give (it now hides those rows to test the controls, then asks each row to add at most one line). A
first round of mutant runs was thrown away because its control was failing, and rerun on the fixed code.

*Not verified.* **IBM Plex widths:** the sandbox has no IBM Plex (Inter and DejaVu Sans Mono stood in), so every width and line count is
approximate; the real tablet and a real thumb are the household's (63a). Hover, focus and error states the stub does not reach. The cooking
note's action buttons and the source photo's buttons, which the stub does not show. The header heights above are for a recipe with no SERVE
WITH or OFTEN WITH row; the cooking-mode check bounds what such a row adds (one line), but its pixels were not measured. The deployed
page: the sandbox's proxy blocks `github.io`.

*Still under 44px, left alone* (outside the plan's list; the plan's note has them): the add dialog's close × and its `link-btn`, the text
fields in Settings (30px), the cook-note box (38px), the 21 QUICK ANSWERS links in Settings → HELP, the Library tab's tick box, the cooking
notes' action buttons. The phone's Planner is 31% longer.

*Left for the household to decide:* whether the Planner's +23% (+31% on the phone) and the 1280×720 sidebar scroll are a fair price for
44px targets; R (one corner radius) and F (keyboard focus) are not started.

**READABILITY F, keyboard focus (14 Oct 2026; `docs/PLAN-READABILITY.md` change F, built on `main` at `252047a`, after H).** The household said
"go" to five lines that included a side-menu fix beyond the plan's list. `index.html` CSS only, plus `APP_VERSION`; no id, markup, wording,
`core.js`, `help.html` or schema change, and `core.js`'s version is unchanged.
- **What changed.** `outline:none` came off six controls that take focus themselves (the keyword box, the Shortlist name box, the add-recipe
  paste box, the add-form and swap fields, the source paste box, the login field), so the page's 2px plum ring shows on them. The search
  input keeps it, and its frame draws the ring (`.searchbar:focus-within`). `.kw-input` is `--line` until focused, then `--plum`. Beyond the
  plan: `.sidebar :focus-visible{ outline-offset:-2px }`, because the side menu clips its sides and cut the ring off its links on every
  screen. The plan's "Built as" note has the account.
- `changelog.json` **2026-10-14.4**; step **64a**. No `help.html` change: no label changed.

*Verified by.* On `main`, before: `core.test.js` **202**, exit 0; `node test/build.js && node test/smoke.js` **617**, exit 0. After, on the
finished tree: `core.test.js` **205** (three new, one more than the five lines said, because the keyword box's border colours wanted a
check of their own), exit 0; smoke **620** (three new), exit 0, no console or page errors; `help-guide.js` 7, exit 0. Measured by walking
Tab on the harness's made-up data (a throwaway script outside the repo; light and dark gave the same counts): stops with no visible ring 1
of 42 on Recipes, 1 of 45 on the Planner, 4 of 31 in Settings, 0 on Shopping and History, to 0 everywhere; rings cut off by the side menu
on all five screens to none; the ring's contrast 9.9:1 and 10.6:1 in light, 6.7:1 and 6.3:1 in dark, against the page and card colours.
**Fourteen mutations, each failing the right check by name.** `core.test.js` (eight, run in the repo and restored byte for byte): the
keyword box, the add-form fields, the login field and the Shortlist box each given `outline:none` again (all four fail the first check,
naming the rule); the search frame's ring removed and the side menu's inside offset removed (the second check, naming which); the keyword
box's idle border back to plum and its `:focus` rule removed (the third). `smoke.js` (six, on scratch copies beside an unmutated control that
passed all 620 with exit 0): the Shortlist box, the search frame, the keyword box and the swap fields each losing their ring (the light and
the dark walks fail, naming the stop); the side menu's inside offset removed (the side-menu check alone); the dark theme's ring made white
(the dark check alone, naming the colour). The smoke check had four faults of mine, all fixed before this record: it compared the keyword
box's name without its class; my block left Settings on its App tab, which a later test (`page.fill`) timed out on, crashing the run after
251 checks (the tab is remembered in `localStorage`); **its first walk started Tab in the middle of the page after the keyword step, never
reached the search box, and so passed with that box's ring removed, which the mutation for it showed** (the walk now gets a page of its
own per view and must reach the search box, the Shortlist box and a swap field); and a click at the corner to reset Tab's start worked on a
fresh page but, in the long session, ended every walk in the same place after about 37 stops. I did not find out why, and dropped it. A
harness quirk, not a fault of F: the parallel smoke runs share files in the OS temp directory (`kitchen-backup-check.json` and others), and
one of seven crashed with "Unexpected end of JSON input" after 342 checks; rerun alone it gave the same two failures as expected and no crash.

*Not verified.* The real tablet and a real keyboard (64a). A screen reader. The login field and the source paste box in a browser: neither
was on screen in the stub, so only the core check sees them. Shopping, History and the Shortlist in `smoke.js` (walked once in a throwaway
script, none without a ring, but the suite walks Recipes, the Planner and Settings only). Hover and error states. Two rings left cut off by
a container's edge (a **+ CHOOSE A RECIPE** at the foot of the Planner's scroll area, and the Shortlist panel on History), seen only in the
measuring script's numbers, not on a screen. The deployed page: the sandbox's proxy blocks `github.io`.

*Left for the household to decide:* whether a ring on every tapped text field is wanted. A text field always matches `:focus-visible`, so
the ring shows on a tap as well as a Tab; hiding it for touch would take script. R (one corner radius) is not started.

**READABILITY R, one corner radius (14 Oct 2026; `docs/PLAN-READABILITY.md` change R, built on `main` at `19c756e`, after F).** The household
said "go" to five lines that kept two corners square. `index.html` CSS only, plus `APP_VERSION`; no id, markup, wording, `core.js`,
`help.html` or schema change, and `core.js`'s version is unchanged.
- **What changed.** Twenty `border-radius` declarations (50%, 20px, 999px, 13px, 6px, 5px, 4px, 3px and three 2px literals) became
  `var(--r)`, so every circle and pill is now a rectangle with a 2px corner, the toggle's thumb included (the household's 14 Oct decision).
  Two corners stay square because they sit against another edge: the Equipment warning strip and the sidebar's peek tab. The plan's "Built as"
  note has the list and the numbers.
- `changelog.json` **2026-10-14.5**; step **65a**. No `help.html` change: no label changed.

*Verified by.* On `main`, before: `core.test.js` **205**, exit 0; `node test/build.js && node test/smoke.js` **620**, exit 0. After, on the
finished tree: `core.test.js` **206** (one new), exit 0; smoke **622** (two new), exit 0, no console or page errors; `help-guide.js` 7, exit 0.
Measured in a browser with throwaway scripts kept outside the repo, on the stub's made-up data: elements and
pseudo-elements with a corner other than 0 or 2px 54 to 0, tablet and phone alike; **no size changed on any of 1,470 (tablet) or 1,358 (phone)
elements**, and positions were identical except the add dialog's uniform 13px, which is run-to-run scroll position (unchanged `main` gave two
different values across two runs) and a toast 1px apart mid-animation. I looked at before and after screenshots of the Recipes grid and the
Planner, and the viewer after. **Twelve mutations, each failing the right check by name.** `core.test.js` (seven, run in the repo and restored
byte for byte): the card's shortlist button back to 50%, `.scale-btn` to 20px, `.toggle-thumb` to 50%, the peek tab's square side rounded
(naming the flush rule that changed), `--r` at 6px, a literal radius added inside an `@media` rule, and the PRE-MADE and COOKED pills back to
999px. `smoke.js` (five, on scratch copies beside an unmutated control that passed all 622 with exit 0): the thumb back to 50% and a Planner
**+** back to 50% (tablet and phone both fail, naming the element); the card's favourite button round on the phone only (the phone check
alone); a pseudo-element's radius (`.rcard-shortlist::before`); and the ingredient lookup back to 5px (the Settings screen). No fault of mine
needed fixing in the new checks. Two harness notes: the first launch of the parallel runs crashed all six runs before a check ran, because
the temp directory I gave each (to stop them sharing files, which crashed one run for F) made a path too long for Chromium; a short directory
under `/tmp/claude-0/` fixed it, and no run crashed after.

*Not verified.* The real tablet (65a). PRINT and EXPORT PNG with the new corners. The two square-edged corners on a screen (the strip needs a
recipe with an equipment warning, the tab a mid-width screen). The numbered badge and the timeline lanes in `smoke.js` (the measuring script and a
screenshot saw them; the scan's must-see list does not name them). Hover and error states. The deployed page: the sandbox's proxy blocks
`github.io`.

*Left for the household to decide:* whether any square is too sharp, or a circle should come back somewhere; the plan said no exceptions, so
none was kept. With R built, all five readability changes are built; the plan's open questions (sage and gold as text, the selected Shortlist
item, the 40px tick reserve) are still the household's.

*The 21 Sep record below has stood at the foot of §7 since it was written; every entry above it is later. (Noted 12 Oct
2026, the October review's Appendix B.)*

**21 Sep 2026: the full browser pass was completed** — all 20 steps of `docs/TEST-PLAN.md`, against
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

- *(Until 24 Sep.)* A single favourite toggle rewrote the entire library: `saveRecipesList` →
  `pushList` upserted every recipe and then deleted any row not in the list. It behaved correctly
  against 33 rows, but it meant a `hydrate()` that ever returned a partial library would have had
  the next favourite delete the remainder. PR 5 made a favourite an update of one column and every
  other ordinary save a single row; `pushList` survives for import only.
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
  restore from backup and a save made offline; **Settings → LIBRARY → RECIPE PHOTOS** covers both
  (the LIBRARY tab since 30 Sep; corrected 12 Oct 2026, the October review's Appendix B). The
  console sweep still works and still needs a hard-reload after it. `docs/IMAGES.md` is the
  runbook.
