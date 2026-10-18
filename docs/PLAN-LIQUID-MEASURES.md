# Liquids in spoons under 50 ml, in ml from 50 ml

**Asked for 18 Oct 2026** (`date -u`) by the household, in a session, with four rules:

1. A liquid under 50 ml is shown in tablespoons (45 ml = 3 tbsp).
2. A liquid the original recipe weighs is never turned into tbsp or ml (syrups and honey are often weighed). One given in
   tbsp or ml follows the same rules.
3. The shopping list combines the same liquid written as a mix of tbsp and ml: 3 tbsp and 100 ml of oil make 145 ml,
   shown as `145 ml (3 × 15 ml + 100 ml)` or similar.
4. A scaled recipe ideally changes from tbsp to ml once the 50 ml mark is reached.

Rules 1 and 2 are the converter's, and are **done** in this PR: `converter/conversion-instructions.md` version 2026-10-18.1,
with test 11 in `converter/test-set.md`. Rules 3 and 4 are the app's, and are **planned here, not built**. The household asked
for the converter first, so conversions can start; nothing in the app has to change for the new lines to work (§1).

**Every example line here is made up.** *Not verified*: they were not checked against the library, since this session could
not read the backup. The session that builds §3 checks them (an exact-match count of 0) before merging.

## 1. What exists today (read 18 Oct 2026, run in Node against `core.js` 2026-10-15.1)

- **The shopping list already adds spoons and ml of one liquid.** `shoppingLine` (`core.js:1276`) turns tsp and tbsp into ml
  (`SPOON_ML`, `core.js:1200`) and `aggregateShoppingLines` (`core.js:1441`) keeps one ml total per row, so `3 tbsp olive oil`
  in one recipe and `100 ml olive oil` in another already read **Olive oil — 145 ml**. What is missing is the breakdown.
- **A total of spoons only stays in spoons, however large** (`formatShoppingParts`, `core.js:1399`): `4 tbsp sesame oil` and
  `6 tbsp sesame oil` read **10 tbsp** (150 ml). Under 1 tbsp it is teaspoons; a mix is `spoonsMixed` (`core.js:1381`),
  "3 tbsp + 1 tsp".
- **A weight and a volume of one thing are never added**: `30 g golden syrup` and `2 tbsp golden syrup` read
  **30 g + 2 tbsp**. That is right, and stays: adding them needs a density, which is a guess.
- **Scaling keeps the unit as written** (`scaleRecipeSyntax`, `core.js:444`): `3 tbsp olive oil` × 2 is `6 tbsp olive oil`;
  `100 ml stock` × 0.25 is `25 ml stock`; `3 tbsp` × 0.25 is `3/4 tbsp`. It runs in four places in `index.html`: the recipe
  view (`:5816`), the Group Viewer (`:5544`), the shopping list (`:7000`) and EDIT's permanent scale (`:10800`). The first three
  always scale from the recipe's own text, so nothing drifts; the fourth rewrites the text.
- **Nothing in the app knows which ingredients are liquids.** The dictionary (`INGREDIENT_DICTIONARY`, `core.js:1004`) has an
  aisle and spellings, no form. The source check (`fidelityAgree`, `core.js:1816`) already treats tsp, tbsp and ml as one kind,
  with 12% tolerance across units, so a converter's `2 1/2 tbsp` for a source's 40 ml agrees (6% apart).

So the converter's new lines (`3 tbsp olive oil`, `60 ml olive oil`) total and scale correctly in today's app; they are only
not switched at 50 ml when scaled.

## 2. The one hard part: which lines are liquids

Rule 4 has to turn `3 tbsp olive oil` × 2 into `90 ml olive oil`, and must **not** turn `3 tbsp ground cumin` × 2 into
`90 ml ground cumin`, or `2 tbsp tomato purée` × 2 into `60 ml tomato purée`. The line itself cannot say which, so:

- **A line written in ml is a liquid.** The converter measures only liquids in ml ("Weigh solids, measure liquids").
- **A line in tsp or tbsp is a liquid only if the dictionary says so**: a new `liquid: true` on the rows for oils, vinegars,
  stock, milk, cream, wine, juices, thin sauces (soy, fish, Worcestershire), syrups, honey, treacle, extracts and water.
  A name the dictionary doesn't mark stays in spoons whatever it scales to. That is the app's no-guessing rule: a liquid left
  in spoons is mildly awkward; a paste turned into ml is wrong.
- **A household word match** (Settings → WORD MATCHES) that points a name at a liquid row makes it a liquid, since the match
  is how the household already says "this is that".
- Adding a field to a row **changes no key and re-keys no tick**: `item_key` is the name alone. CLAUDE.md still asks for the
  library to be re-measured before shipping a dictionary change ("Re-measuring the live library" in `test/README.md`), to show
  that no key moved. `converter/ingredient-names.md` is regenerated only if the generator is changed to print the flag (it
  need not be).

## 3. What would be built (one PR, `core.js` and `index.html`)

### 3a. Scaling (rule 4) — `scaleRecipeSyntax`

After scaling, a **liquid** line (§2) measured in tsp, tbsp, ml or L is rewritten by its amount in ml:

| Scaled amount | Written as | Rounded to |
|---|---|---|
| under 15 ml | tsp | nearest 1/2 tsp, never below 1/4 tsp |
| 15 ml to under 50 ml | tbsp | nearest 1/2 tbsp |
| 50 ml to under 1 litre | ml | nearest 5 ml |
| 1 litre and over | L | as now (`formatAmount`) |

- `3 tbsp olive oil` × 2 → `90 ml olive oil`; × 4/3 → `60 ml olive oil`; × 1/2 → `1 1/2 tbsp olive oil`.
- `100 ml chicken stock` × 1/4 → `1 1/2 tbsp chicken stock` (25 ml, the nearest half tablespoon is 22.5 ml).
- A range takes its unit from its upper end, as the converter's rule does: `2-3 tbsp` × 2 → `60-90 ml`.
- **A weighed line is untouched** (`30 g honey` × 2 is `60 g honey`), and so is a non-liquid spoon line.
- **At ×1 nothing changes**: a recipe is shown as written, so an older recipe's `4 tbsp olive oil` still reads 4 tbsp until
  it is scaled (decision D2).
- The recipe view, the Group Viewer and the shopping list scale from the stored text each time, so 3 tbsp → 90 ml → back to
  3 tbsp never drifts. EDIT's permanent scale writes the rounded figure into the recipe; the rounding is at most half a
  spoon or 2.5 ml, and UNDO is already there.

### 3b. The shopping list (rule 3) — `formatShoppingParts`

An ml total is shown by the same table as 3a, **if the row is a liquid** (§2):

- **Under 50 ml**: spoons, as now (`3 tbsp`, `2 tbsp + 1 tsp`).
- **50 ml and over**: ml, and when the total came from more than one line, the lines after it in brackets, largest first:
  **Olive oil — 145 ml (100 ml + 3 tbsp)**; **Sesame oil — 150 ml (6 tbsp + 4 tbsp)**. One line shows no brackets. The
  wording is decision D1.
- **A non-liquid spoon total stays in spoons**, as now (`10 tbsp curry paste`).
- Weights and volumes still never add (`30 g + 2 tbsp`). Nothing about a row's name or key changes, so **no tick moves**;
  only the quantity text does. PRINT, PNG and AUDIT read the same `qtyText`.

### 3c. Tests, versions and docs

- `test/core.test.js`: the table in 3a at each edge (14.9, 15, 49.9, 50, 999, 1000 ml), a range across 50 ml, a weighed
  liquid, a non-liquid spoon line, ×1 unchanged, and 3b's three cases. Each made to fail once by breaking the code it guards
  (CLAUDE.md step 3).
- `test/smoke.js`: the recipe view at a scale that crosses 50 ml, and the list's bracketed breakdown.
- `KITCHEN_CORE_VERSION`, `core.js?v=` and `EXPECTED_CORE_VERSION` together; a `changelog.json` entry and `APP_VERSION`;
  `help.html`'s shopping-list section; a tablet step in `docs/TEST-PLAN.md` and `docs/HOUSEHOLD-JOBS.md`.
- The library re-measured before and after (§2), to show the row count and every key unchanged.

## 4. Risks

- **A liquid the dictionary doesn't know stays in spoons when scaled.** Visible, harmless, and fixed by adding the row (or a
  word match). Measuring the library's spoon lines against the dictionary, when building, says how many there are.
- **Rounding on a permanent scale.** At most half a spoon (7.5 ml) between 15 and 50 ml, 2.5 ml above. Small next to how the
  recipes are written, and only on the household's own button press.
- **Older recipes** keep their spoons at ×1 (D2). Rewriting their text is a recipe-text job under CLAUDE.md's procedure
  (approved lines, a fresh export, guarded statements), and is not proposed here.

## 5. Decisions for the household

- **D1, the list's wording.** Recommended `145 ml (100 ml + 3 tbsp)`: the lines as the recipes write them. The alternative
  is the household's own example, `145 ml (100 ml + 3 × 15 ml)`.
- **D2, older recipes at ×1.** Recommended: shown as written. The alternative applies 3a's table on screen at ×1 too, so
  `4 tbsp olive oil` reads `60 ml olive oil` everywhere without touching the stored text.
- **D3, scaling down.** Recommended: yes, the same table both ways, so `100 ml` scaled to a quarter reads `1 1/2 tbsp`.
- **D4, teaspoons under 15 ml.** The household's rule says tablespoons below 50 ml; this plan and the converter use teaspoons
  under 1 tbsp (`1 tsp vanilla extract`, not `1/3 tbsp`), as recipes do. Confirm.
- **D5, rounding.** Recommended: nearest 1/2 spoon, nearest 5 ml, as the converter now does.
