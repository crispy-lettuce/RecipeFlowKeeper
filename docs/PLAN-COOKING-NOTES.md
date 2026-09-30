# Dated cooking notes (R4)

**Asked for in the original build brief** (`docs/BUILD-BRIEF.md`, R4): *"A note box in the Viewer; each entry dated, building a
running log per recipe across cooking sessions; foldable into the permanent Notes text later."* Scoped on 30 Sep 2026 at the
household's request, and **agreed "as suggested" the same day**: every answer in §6 is the recommended one. **Built 30 Sep**
as one PR, `index.html` only, no migration; tablet step 39a. §7 records what was built where it differs from §4.

## 1. What it is for

The recipe text says how a dish *should* go. What the household learns by cooking it lives nowhere: "needed 10 min longer in our
oven", "half the chilli next time", "doubled it for eight, fine". The diary records *that* a recipe was cooked and when, never
*how it went*. R4 is that missing log, one short dated line at a time, read back the next time the recipe is opened.

## 2. What exists today (read-only, 30 Sep 2026)

- **`recipe_notes`**, created in Phase 1 for exactly this and never used: `id`, `household_id`, `recipe_id` (not null),
  `body` (text, not null), `created_at` (timestamptz, default now). **0 rows.** Four policies, one per command, all `TO
  authenticated` on the household; no `anon` access; `recipe_id` cascades on delete, so a deleted recipe's notes go with it,
  as its cooking history does. **Nothing needs a migration** for the recommended design (§4).
- **`recipe_logs.note`**: a free text column on each cooking-diary entry. 116 entries, **none has a note**. The app reads and
  writes it back unchanged but no screen sets it.
- **Where cooking is logged:** ticking the last column of a recipe's diagram logs it as cooked today, then asks for the meal
  type (breakfast / lunch / dinner / snack, or SKIP). The ad-hoc diary entry (H2) logs a meal with no recipe.
- **The recipe text** has its own `NOTES:` section (and `TIPS:`, `VARIATIONS:` and so on), shown under the diagram. That is the
  "permanent Notes text" the brief means.
- **Backups:** the nightly `pg_dump` already holds `recipe_notes`; the app's JSON export does not know it.

## 3. Two ways to do it

| | A. A note per recipe (`recipe_notes`) | B. A note per cooking (`recipe_logs.note`) |
| --- | --- | --- |
| What a note hangs on | The recipe, dated the day it is written | One diary entry, dated the day it was cooked |
| A note without cooking it ("try with lamb next time") | Yes | No: there is no entry to hang it on |
| Seen in | The recipe viewer, as the recipe's running log | The diary; the viewer would have to gather them |
| Migration | None (the table exists) | None (the column exists) |
| Fits the brief's "running log per recipe" | Directly | Indirectly |

**Recommended: A**, with B's one advantage borrowed: the after-cooking prompt (§4) offers a note box, and a note written there
is a recipe note dated that day. One place for notes, not two. `recipe_logs.note` stays as it is.

## 4. The proposal

### In the recipe viewer

Under the recipe's own text, a **COOKING NOTES** section:

- **The log**, newest first: `30 SEP 2026 · needed 10 min longer in our oven`. The first three shown, SHOW ALL for the rest.
- **ADD A NOTE**: a one-line box that grows as needed, and ADD. The note is dated today and saved at once (a write of one row,
  through the write queue like every other save, so it waits and retries offline).
- **Each note**: EDIT (its text, not its date) and DELETE (with UNDO, as elsewhere).
- **A NOTES · 3 chip** in the viewer's header row, beside the source chips, jumping to the section, so a recipe with notes says
  so before anyone scrolls.

### While cooking (KEEP AWAKE on)

Cooking mode hides everything not needed at the hob. **ADD A NOTE stays**, since mid-cook is when "this needs longer" is noticed;
the log itself folds to its first line.

### After cooking

The meal-type prompt that follows ticking the last column gains **ADD A NOTE (OPTIONAL)**: a box under the four meal buttons.
Anything typed there is saved as a note on that recipe, dated that day, when the prompt closes. Leaving it empty adds nothing, as
now.

### Folding a note into the recipe

**FOLD INTO NOTES** on a note opens EDIT with that line appended to the recipe text's `NOTES:` section (creating the section if
there is none), pending like any edit: BEFORE YOU SAVE says "Adds a cooking note to NOTES: and removes it from the log". SAVE
writes the recipe text and deletes the note; closing without saving changes nothing. So a note is in one place or the other,
never both.

### Everywhere else

- **Export and import**: the JSON export gains `recipeNotes`; an import restores them (a backup without the key restores none
  and clears none, as `aisleOverrides` does).
- **Deleting a recipe** deletes its notes (the database does this already); the delete confirmation says how many.
- **Not shown** on recipe cards, in the Group Viewer, on the shopping list, or in PRINT / PNG (unless §6.5 says otherwise).
- **Not searched** by the library's search box in the first version.

## 5. How it would be built

One PR, `index.html` only, no migration, no `core.js` change:

1. **Load**: `hydrate()` reads `recipe_notes` beside the other tables, tolerantly (a failure there must not sign anyone out; the
   section says the notes could not be loaded). `cache.recipeNotes`, with the rest of the cache.
2. **Write**: `addRecipeNote`, `updateRecipeNote`, `deleteRecipeNote`, one row each, the id made in the browser (as the diary
   does) so an EDIT straight after ADD finds its row.
3. **The viewer section, the chip, cooking mode, the prompt's box, FOLD INTO NOTES, export and import.**
4. **Checks** (the smoke suite, each seen failing): add, edit, delete and UNDO, one row each and aimed at one household; the
   date shown is the day written; newest first; the chip's count; cooking mode keeps ADD A NOTE; the prompt's box adds a note
   only when typed in; FOLD pending until SAVE, then text written and note deleted, and nothing on close; export and import
   round trip; a failed load does not sign out.
5. **A tablet step** (the 39 series).

Estimated size: similar to source photos' step 2.

## 6. Decisions for the household

1. **Where notes live:** A, a running log per recipe, with a note box after cooking too (recommended), or B, a note on each
   cooking-diary entry?
2. **Dates:** each note dated the day it is written, and the date fixed (recommended), or a date that can be changed (for
   writing up yesterday's cook)? A changeable date needs one new column, `noted_on`, applied by the household first.
3. **After cooking:** a note box in the meal-type prompt (recommended), or notes only from the recipe viewer?
4. **FOLD INTO NOTES:** moves the note into the recipe text (recommended), copies it (so it is in both), or leave folding out of
   the first version?
5. **Print and PNG:** leave the notes off (recommended: they are the household's working notes, and the printout is the recipe),
   or print them under the recipe?
6. **Who wrote it:** not recorded (recommended while one account uses the app), or record the author for when a family member
   joins (`docs/ONBOARDING.md`)? Recording needs one new column, applied first.

## 7. As built (30 Sep 2026)

As §4, with these particulars:

- **The date** is written by the app with the note (`created_at`), so the log shows it at once and the row agrees; it is shown
  as `30 SEP 2026` on every device. Two notes written in the same instant keep the order they were written in.
- **ADD, EDIT, DELETE and UNDO** each write one row, aimed at one note of one household. ADD and UNDO are upserts, so a retry
  after a write that did land is not refused.
- **FOLD INTO NOTES** puts `30 Sep 2026: <the note>` at the end of the general `NOTES:` section (before `VARIATIONS:`, `TIPS:`
  and the rest), or adds a `NOTES:` section at the end. If the line is taken out of the text before SAVE, the note stays.
- **The after-cooking box** keeps what is typed however the prompt closes (a meal, SKIP or the backdrop), since closing it has
  never been a cancel. It is offered only for a cooked recipe, not for a diary entry without one.
- **The notes' own section** sits outside the diagram, so EXPORT PNG never captured it, and PRINT hides it.
- **Not built:** searching notes from the library's search box (§4 left it out of the first version).

