# Plan: things to buy that no recipe asks for (issue #241)

A working file with an end (`CLAUDE.md`, "How the documents are kept"). Written 15 Nov 2026 from issue #241, sent from the app
that day. The household answered its questions the same day (§6). **Slice 1 is built** (app version 2026-11-15.2) and waits on the household: the table (`docs/migrations/add-shopping-extras.md`) and Job 14. Slices 2 and 3 are not built.

## 1. What is asked

The shopping list today is only what the week's planned dishes need. The household also buys things no recipe on the plan asks
for, and wants them on the same list, in the same aisles, ticked off the same way, so the app's list is the only list taken to
the shop. The issue's three cases:

1. **Running low.** Halfway through making something, the jar is nearly empty. Add it now so it is on the list whatever next
   week's recipes need.
2. **Regulars that are not in a recipe:** tea, coffee, milk, salad.
3. **Not food at all:** pet food, cleaning things, toiletries. These want aisles the list does not have.

It also asks for the name box to offer what the app already knows as you type, and for the things added before to be kept so
they can be added again.

## 2. What it is, in one paragraph

An **extra** is a row the household types: a name, an aisle, and optionally a few words of how much ("2 bags"). It is drawn on
the Shopping screen in its aisle, among the recipe rows, marked so it can be told apart, with a tick box like any other row and
a × to take it off. It is not tied to a recipe or a day. Extras live in a table of their own and have their own tick, so
nothing about how recipe ingredients are named, keyed or ticked changes.

## 3. How it fits what is there (read 15 Nov 2026)

- `buildShoppingList` (`index.html`) returns categories of rows from `aggregateShoppingLines` (`core.js`); `renderShopping`
  draws them. **`buildShoppingList` must stay free of side effects**: it runs on every Planner change. Extras are read from the
  cache and merged into the categories for drawing; nothing is written from there.
- A recipe row's tick is a row in `shopping_checked`, keyed by the week's first day and the ingredient's name. **Extras do not
  use that table.** An extra's tick is a column on its own row. This is the main design choice: no rule in `shoppingLine` and no
  dictionary row is touched, so no existing tick is re-keyed, and the library does not need re-measuring for this feature.
- Aisles come from `INGREDIENT_AISLES` in `core.js` (six, plus Other). The household's own aisle for a name is
  `aisle_overrides`. The non-food aisles are a second, separate list used only by extras, drawn after the food aisles and
  before Other. `INGREDIENT_AISLES` itself does not change, so SHOPPING AISLES in Settings, the dictionary and the converter's
  generated names file are untouched.
- The name box's suggestions come from two places already in memory: the dictionary's names (`INGREDIENT_DICTIONARY`) and the
  household's earlier extras. Choosing a dictionary name fills in its aisle (`aisleFor`, read only).
- The one-recipe list (SHOPPING LIST on a recipe) shows no extras: it is that recipe's list.
- PRINT / A4 PDF and EXPORT PNG include extras, and leave out ticked ones as they do for recipe rows. HIDE TICKED applies.
  AUDIT's tools (MERGE WITH…, the aisle pick, "Same as …?") are not offered on an extra: its name and aisle are what was typed.
  Slice 1 has no editing: an extra is changed by taking it off (×) and adding it again.
- EXPORT DATA and IMPORT DATA carry extras, as they carry aisle overrides. The nightly dump covers a new table by itself.

## 4. The table

One new table, `shopping_extras`, modelled on `aisle_overrides` (same foreign key, same four `TO authenticated` policies, the
`anon` revoke). The SQL is in `docs/migrations/add-shopping-extras.md`, **for the household to apply before the
PR is merged**. A session never runs it.

| Column | What it holds |
| --- | --- |
| `id`, `household_id`, `created_at` | As every table. |
| `name` | What was typed, as shown. |
| `aisle` | One of the food aisles, one of the extras' own, or Other. |
| `amount` | Free words, optional. Never added up. |
| `ticked_at` | Empty while it is still to buy; the time it was ticked. |
| `regular` | True for something bought most weeks (slice 2). |

`hydrate()` reads it apart from the other tables, as it reads `aisle_overrides`: a missing table means the feature is absent
and says so, and nobody is signed out. Every write is one row (`queueWrite` with a `{ key }` of `'shopping_extras:<id>'`).

## 5. Slices

Each is a PR of its own, with its tests, a changelog entry, `help.html`, `docs/SPEC.md` §5.7 and tablet steps in
`docs/HOUSEHOLD-JOBS.md`.

1. **Add, tick, remove.** The migration page. An ADD AN ITEM row at the top of the Shopping screen: name, aisle, optional
   amount. The extra appears in its aisle with an ADDED mark where a recipe row names its recipes, its tick and ×. The aisles offered are the food
   aisles, Household, Health & Toiletries, Pets and Other. An extra shows on this week, next week and both weeks
   alike until it is ticked. The sidebar's count includes the extras (ticked ones too, as it counts ticked recipe rows). Print, PNG, HIDE TICKED, export and import.
2. **Suggestions and regulars.** The name box offers dictionary names and earlier extras as you type, filling in the aisle. A
   **REGULARS** list: mark an extra as a regular, and it can be put back on the list with one tap (or all of them at once) after
   it has been ticked and cleared.
3. **The remembered aisle.** Where a name was given an aisle before, the same aisle next time.

The three non-food aisles are decided (§6), so slice 1 offers them from the start; slice 3 is then only the remembered aisle.

## 6. What the household decided (15 Nov 2026)

1. **An extra stays until it is ticked**, on every week's list. Ticked, it stays visible and struck through like any ticked row,
   and CLEAR TICKS removes it (a regular goes back to the REGULARS list).
2. **The non-food aisles are Household, Health & Toiletries, and Pets**, in that order, after Frozen and before Other.
3. **An extra never joins a recipe row of the same name.** It sits beside it in the same aisle as its own line. **It must be
   clear at a glance which rows come from recipes and which were added by hand:** a recipe row names its recipes under it, as
   now; an extra carries an ADDED mark in that place, in both styles, on screen, in print and in the PNG.
4. **The amount is optional free words**, shown before the name, never added up.
5. **Extras are added from the Shopping screen only**, to start.
6. **Regulars are remembered and tapped back on**, never put on the list by themselves.

## 7. What it must not do

- Change `shoppingLine`, the dictionary, `INGREDIENT_AISLES` or a key in `shopping_checked`.
- Put a write or a prompt in `buildShoppingList`.
- Send the new table's rows before the table exists, or make `hydrate()` throw when it is missing.
- Route a single add, tick or removal through a whole-table replace.
- Put a real extra, or a real shopping row, in a test, a document or a commit: fixtures use made-up names.

## 8. Checks each slice adds

In `test/smoke.js`, each seen to fail once: an extra added writes one `shopping_extras` row and appears in its aisle; ticking it
updates that row only and writes nothing to `shopping_checked`; a recipe row's key and tick are the same before and after an
extra of the same name is added; the list with the table missing is the list as it is today, with no console error; a ticked
extra is left out of the print view; import and export carry extras through unchanged.

## 9. Closing this plan

The PR that ships the last slice updates `docs/SPEC.md` §5.7 and `docs/ARCHITECTURE.md` §4 (the new table), and deletes this
file. Anything left unbuilt goes back to issue #241 or an issue of its own.
