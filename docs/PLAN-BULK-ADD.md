# Plan: adding several recipes at once, from one combined file

**Written 18 Oct 2026** (date from `date -u`), in a planning session that changed no code. **Updated 19 Oct 2026:** the household
answered §9 (all four as recommended), and PR 1 is built on the session branch (not yet merged); PR 4 is dropped. Checked against `main`
at `10c86c3` (PR #163), by reading the code (§3 was checked by running the splitter, 19 Oct). Nothing was run against the live app. The household asked for the
feature after a session loaded 62 converted recipes straight into the database (record and undo in `PrivateBackup`,
a dated folder under `migrations/` there), which worked, but is not something the household can do for itself.

**Who this is for.** An implementation session taking one PR at a time. Each PR entry in §7 says what to change,
the rule, the checks to add and the mutation that must make each fail. If anything here disagrees with the code,
the code wins and the disagreement is reported (§10), not worked around.

**How to read it.** **Fact** means read in the code on 18 Oct. **Decided** means the household said so. **Recommendation**
is this document's choice, open to being overruled. §9 records the household's answers.

---

## 0. In one paragraph

Add an **ADD SEVERAL** button beside NEW RECIPE. It takes one combined file (or pasted text) in the format the
converter already produces, reads every recipe in it with the app's own parser, and shows a review list: which are
ready, which are held back and why, which look like recipes already in the library, which sources are spelt
differently from the library's, and which ingredient names are new. The household ticks what to add and presses one
button. Each ticked recipe is saved as a new row through the same `saveRecipe` the form uses, its photo is queued for
re-hosting, and the household verifies each one afterwards in the edit form, as it does today. No schema change, no
Edge Function change, no dictionary change.

---

## 1. Why, and what the database route skipped

**Decided (18 Oct):** bulk input is wanted; the input is a combined Markdown file like the one used that day; every
recipe is still verified by hand afterwards.

**Fact:** `IMPORT DATA` cannot do this. It restores a whole-library backup and replaces everything on every device
(`importAllData`, `index.html:11178`). The one-at-a-time form is deliberate (`docs/NEXT-SESSION.md`: "so each gets
the review band and its source check"), but at 60 recipes it is an hour of pasting.

What the session's insert did not give, and what this plan does about each:

| Single-recipe flow gives | Session insert gave | Bulk add |
| --- | --- | --- |
| Parse, NOT READ lines, line faults shown | Validator output in chat | The same parser and checks, per recipe, in the review list |
| Shopping-list review: names new to the library, Other flagged | Counts from a validator that measured against the dictionary, not the library | A batch-level band (PR 3). **Fact:** once a batch is in the library, a new name shared by two of its recipes is flagged on neither (`newRecipeReview` leaves out only the recipe being opened), so the band is worth having at add time |
| Source spelling asked about (`evaluateSourceSpelling`) | Fixed by hand in the file | A SOURCES band: one question per distinct source |
| Duplicate by source link | Checked by hand | Per-recipe DUPLICATE status |
| Keywords added to the vocabulary (`mergeKeywordVocab`) | Added by hand with SQL | Same function, once for the batch |
| Source comparison runs by itself on paste (`autoCheckSource`) | Not run | **Not run** (§5; decided, §9 Q3): Edit does not run it on opening either. LIBRARY CHECK already lists every recipe "not compared" |
| Photo re-host queued per recipe (`rehostImageFor`) | Not queued (a household button press) | Queued per recipe |

---

## 2. The journey

1. **Entry.** **Recommendation:** a second button under NEW RECIPE, labelled **ADD SEVERAL**, opening its own dialog
   (`#bulkOverlay`, same overlay styles as `#addModalOverlay`). Not a mode inside the NEW RECIPE form: that form's
   state (`state.editingRecipeId`, `formComparison`, `reviewLines`, `bandsShown`…) is shared by many handlers, and
   the bulk dialog needs none of it.
2. **Input.** A file picker (`.md`, `.txt`, plain text) and a paste box. Both feed one string. **Fact:** the house
   style is that the page does not fetch the file's contents anywhere; `File.text()` is read in the tab.
3. **Reading.** `splitRecipeBlocks(text)` (core.js, §3) returns the blocks. Each goes through `parseRecipe` and the
   existing line checks. Nothing is written yet.
4. **Review.** A summary line ("62 read: 60 ready, 1 held back, 1 looks like a recipe you have"), then one row per
   recipe (§4). Held-back rows are unticked and cannot be ticked. Everything else is ticked by default except
   DUPLICATE rows. A row expands to the same read-only preview the form shows (`mountFlow`), drawn only on expand
   (60 flow diagrams at once is slow on the tablet).
5. **SOURCES band** (PR 2). Each distinct SOURCE in the ticked recipes, with its count. A source the library spells
   differently gets the form's own row: "Looks like **X** (n recipes). USE THAT · KEEP MINE", with the same writes
   (USE THAT is `addAlias('source', typed, term)`; KEEP MINE is `addAlias('source_distinct', pairKeyFor(typed, term), '')`;
   see the click handler after `evaluateSourceSpelling`). A spelling already
   settled is applied and said so. Unanswered means saved as typed, asked again next time, as in the form.
6. **SHOPPING LIST band** (PR 3). Names new to the library, once each, with how many of the batch use them and the
   Other ones first. Read-only in v1: SAME AS… and AISLE… stay in the edit form and Settings.
7. **Save.** One button, "ADD 60 RECIPES". Then the result panel (§4).
8. **Verify.** As today: OPEN a recipe, check it, COMPARE WITH SOURCE, save. LIBRARY CHECK is the persisted worklist.

---

## 3. The splitter

`splitRecipeBlocks(text)` in `core.js`, pure, returning `{ blocks, stray }` with `blocks` as `[{ text, line, title, unterminated }]`
in file order. `test/validate-recipes.js` calls it, so the command line and the app cannot disagree about what a block is
(the precedent is `ingredientLineFaults`, 27 Sep). **Built 19 Oct as PR 1.** Rules:

1. **Fenced input wins.** If the text contains any fence line (a line starting with three backticks, indented or not), a block
   is the text between a pair of fences whose first non-blank line starts `TITLE:` (any case). Other fenced text (a shell
   sample, JSON) is ignored, and so is anything outside the fences. A fence that never closes gives a block marked
   `unterminated` (a cut-off paste) if it starts with `TITLE:`; one that is not a recipe gives nothing.
2. **Stray lines.** In a fenced file, a `TITLE:` line at column 0 that falls outside every block is listed in `stray` (by line
   number), so a half-fenced paste says so instead of silently losing recipes. The review shows it; the command line warns.
3. **Unfenced input.** A block starts at a line beginning `TITLE:` at column 0 and ends before the next one. A numbered
   heading (`12. Some Title`) directly above a `TITLE:` line with the same title (case and spacing ignored) is the file's own
   label and is left out of the block above it. **Corrected from the first draft:** any other text before the next `TITLE:`
   stays with the block above, because nothing here can tell prose from the tail of a recipe; the parser's NOT READ list
   shows what it could not use. A heading whose title differs also stays (it cannot be told from a numbered step).
   Trailing blank lines are dropped. `TITLE:` mid-line or indented starts nothing.
4. **Nothing inside a block is changed.** No trimming (a fenced block keeps a leading blank line and trailing spaces), no
   quote or dash changes. Source spelling is the SOURCES band's job. A BOM and CRLF line endings are normalised first.
5. A block empty after its `TITLE:` line is returned and held back by the review ("nothing after the title").
   `line` is the 1-based line of the opening fence (fenced) or of the `TITLE:` line (unfenced).

**Fact (tested 18 Oct):** a block with no `STEPS:` line parses cleanly (5 groups, 6 stages, no NOT READ lines),
because `parseRecipe` treats the groups and stages as the steps. A missing `STEPS:` is therefore not a fault and
needs no rule.

---

## 4. The rules the review applies

**Held back** (unticked, cannot be ticked, reason shown). The first three are what the form already refuses on
save, plus what the 20 Sep ingestion held back:

| Reason | Rule |
| --- | --- |
| No source | `parseRecipe(...).source` empty |
| No servings | `servings` not a whole number of 1 or more |
| Nothing to cook | no groups, or no ingredient lines |
| Cut off | the splitter marked it `unterminated` |
| Two blocks, one title in the file | the second and later (case-insensitive); the first is kept |

**Warnings** (shown, never block, as in the form): lines in NOT READ (`parsed.unread`); lines the list cannot
total (`ingredientLineFaults(...).filter(f => f.affectsList)`); no link; no image; no time; a `Source note` that says
the page was not read (`sourceNoteIn`).

**Duplicate** (unticked by default, can be ticked): same normalised source link as a library recipe
(`normalisedSourceUrl`), or same title ignoring case and surrounding space. Shows the library recipe's title and
SHOW IT, as `duplicateHtml` does. **Recommendation:** v1 only ever adds. It never updates a library recipe (§9 Q1).

**What a saved row is.** Fields come from the parsed block exactly as the form's `readFormFields` would give them
(title, source after the SOURCES band, link, image, time, servings, equipment, tags), `syntax` goes through
`withUpdatedHeaderLines` (a no-op when nothing changed; **Fact:** it changed none of the 62 on 18 Oct), `id` is
`uid()`, `dateAdded` is `todayStr()`, no favourite, no `sourceCheck`, no `sourcePhotos`. Saved with `saveRecipe`
(one row, keyed `recipes:<id>#text`). **Fact:** `saveRecipe` upserts one new row and `recipeToRow` leaves out
`source_check`, `source_photos` and `copied_from` when absent, so it works with no migration applied.

**Not a whole-table write.** The batch is N single-row upserts of new ids, each queued on its own so a failure retries
that row alone and a later edit of the same recipe covers it (the `key` rule, 12 Oct F5). A chunked multi-row upsert
would be faster but has no per-row key, so a retry could write old text over a later edit. **Recommendation:** accept
the sequential writes (about 60 small requests; the queue already behaves this way).

**Result panel.** After saving, the dialog lists what was added: each title with OPEN (goes to the edit form), and a
count line ("60 added, queued to save"). Closing it is final. This is the household's checklist for the first pass.

---

## 5. What it does not do

- **No update in place.** A duplicate is shown, not merged. (The 20 Sep ingestion did update in place; it is also the
  most dangerous kind of bulk write: the cooking history, plan slots and ticks hang off the row's id.)
- **No change to `shoppingLine`, the dictionary, or any naming rule**, so **no shopping tick is re-keyed**
  (CLAUDE.md, "a change to how ingredients are named…" does not apply).
- **No schema change, no Edge Function change, no converter change** (so no `CONVERTER_VERSION` bar). Nothing for the
  household to apply first.
- **No automatic source comparison.** It would fetch the source page 60 times in a row, and "some sites turn that
  check away". Declined (§9 Q3).
- **No SAME AS / AISLE actions in the batch band.** They stay in the edit form (and Settings → Word Matches).

---

## 6. Risks

| Risk | Handling |
| --- | --- |
| A stale tab adds a recipe another device just added | The duplicate rule runs against the cache; `refreshLibrary()` already runs when the tab becomes visible (CLAUDE.md, "Coming back to the tab"). Say so in the dialog if the cache was refreshed while it was open: re-run the review. |
| 60 recipes saved offline | `saveRecipe` queues; the offline bar and "Back online" flush already cover it. The dialog says "queued", never "saved". |
| 60 flow diagrams freeze the tablet | Drawn on expand only (§2.4). |
| 60 image re-host calls in a row | **Recommendation:** per recipe via `rehostImageFor`, queued behind the recipe's own write, as the form does. The sweep button stays the catch-up. A failure keeps the external URL, which still displays. |
| Huge paste | The textarea holds it (the 18 Oct file was about 200 KB). **Recommendation:** warn, do not refuse, above 100 recipes. |
| Private data | All fixtures in tests are made up (CLAUDE.md, "Read your diff for private data"). The household's real batch lives only in `PrivateBackup`. |
| A mistaken batch | Undo is the delete the app already has, one recipe at a time. Declined: no UNDO BATCH (§9 Q4). |

---

## 7. The PRs

**PR 1 — the splitter (core.js). Built 19 Oct** on the session branch, not yet merged: core version `2026-10-19.1`, 13 new checks in `test/core.test.js` (248 in all; each seen to fail once, by mutation), `validate-recipes.js` on the shared splitter (a 62-recipe test file reads 62 valid both fenced and unfenced; smoke 724 of 724). `splitRecipeBlocks` per §3; `test/validate-recipes.js` calls it instead of its own
`extractBlocks`. Bump `KITCHEN_CORE_VERSION` in all three places (CLAUDE.md, item 2). No UI, so no changelog entry.
Checks in `test/core.test.js` (all with invented recipes): fenced; unfenced with numbered headings; mixed fenced and
prose; CRLF and BOM; unterminated fence; empty block; two blocks one title; a line `NOTES: TITLE: x` mid-block does
not start a block; a block with no `STEPS:` is returned whole. Plus one check that `validate-recipes.js` reads blocks only through
`splitRecipeBlocks` (it keeps no fence loop of its own).

**PR 2 — ADD SEVERAL: read, review, save.** The button, the dialog, file and paste input, the review list with the
§4 statuses, the SOURCES band, the save, the result panel, `mergeKeywordVocab` once. `help.html`: a new short section
and the quoted button labels as `<b class="ui">` (`test/help-guide.js` fails if a label is wrong). `changelog.json`
entry (new `version`, no recipe names) and `APP_VERSION` (CLAUDE.md, 2a). A tablet step in `docs/HOUSEHOLD-JOBS.md`
and `docs/TEST-PLAN.md`. Smoke checks (stubbed Supabase, invented recipes): 4 blocks in, 1 held back (no servings),
1 duplicate by link, 2 ready; the duplicate is unticked; ticking it adds it; saving adds exactly the ticked ones to
the cache with distinct ids; one upsert per recipe, none carrying a column that may not exist; keywords merged once;
a source spelt unlike the library's offers USE THAT, and USE THAT changes all the batch's rows with it; nothing is
written until the button is pressed; closing the dialog writes nothing.

**PR 3 — the SHOPPING LIST band.** `batchShoppingReview` in `core.js` (version bump again), built on
`aggregateShoppingLines`: names new to the library across the ticked recipes, each once, with batch counts and
Other flagged. Smoke: a name used by two batch recipes shows once with "2 recipes"; a name already in the library
does not show.

**PR 4 — dropped (19 Oct).** It was COMPARE ALL WITH SOURCE and UNDO BATCH; the household declined both (§9 Q3, Q4).

Each PR: `node test/core.test.js`; `node test/build.js && node test/smoke.js`; read the exit codes; make each new
check fail once and restore (CLAUDE.md, items 1 and 3); update the check counts quoted in CLAUDE.md and
`test/README.md`; `git diff origin/main` read for private data. Open the PR; the household merges on green CI.

---

## 8. Checks for the finished feature, on the tablet

(For `docs/HOUSEHOLD-JOBS.md` when PR 2 lands.) Add several with a file of 3 invented recipes: the list reads 3; one
unticked row is a duplicate; ADD makes the others appear in Recipes at once; a second tablet shows them after a
refresh; closing the dialog before ADD adds nothing; airplane mode: ADD shows "queued", and they arrive on reconnecting.

---

## 9. The household's answers (19 Oct 2026: "happy with recommendations", and deleting one recipe at a time is fine)

1. **Duplicates.** Decided: unticked by default, the feature only adds. No UPDATE for a duplicate.
2. **The button.** Decided: ADD SEVERAL beside NEW RECIPE, its own dialog.
3. **Source comparison.** Decided: left to LIBRARY CHECK and the per-recipe COMPARE WITH SOURCE. No COMPARE ALL.
4. **Undo.** Decided: no UNDO BATCH. A mistaken batch is removed with the delete the app already has, one recipe at a time.

---

## 10. When to stop and hand back

1. The splitter finds a different number of blocks from `validate-recipes.js` on any file: stop, report both.
2. Any column the save sends does not exist in the live schema: stop. The household applies SQL first (CLAUDE.md).
3. The shopping list's totals change for an existing ingredient after the change: a naming rule was touched. Stop.
4. This document disagrees with the code: report it, do not work around it.
