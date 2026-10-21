# Split ingredients in LIBRARY CHECK (21 Oct 2026; asked for and built the same day)

**What.** Settings → Library → LIBRARY CHECK says, under a recipe, when one ingredient is written on two or more lines
(`On several lines: oil 1 tbsp + 2 tbsp`), and a box shows only those recipes. It points at what to open and compare; it
decides nothing.

**Why.** The same day, a converter fault was found: a source page printed each ingredient under every step that uses it,
with its whole list amount each time, and the converter read a step's repeat as that step's share, on top of an earlier
part (`converter/revision-history.md`, 2026-10-21.1). COMPARE WITH SOURCE showed it as "amounts differ", but only for a
recipe somebody had compared, and the library had 28 recipes writing an ingredient on several lines that nobody had. A
split is the one thing a comparison totals rather than pairs, so it is where this kind of fault hides.

## The rules, and why each is there

- **A split is the same product, measured the same kind of way, on two or more lines** (`splitIngredients` in `core.js`):
  a weight with a weight, a volume with a volume, a count with a count. `1/2 tsp butter` for greasing beside `180 g butter`
  is two uses, not a split; counting it was the biggest source of noise in the hand-made scan this was built from.
- **Not counted:** a pinch, a line with no figure (`salt, to taste` twice is what recipes do), and a single line.
- **`mixed`** means two units for one kind of amount (a teaspoon and a tablespoon; millilitres and a tablespoon). It is the
  shape the fault took, so those recipes sort first among the ones not yet compared.
- **"To check"** means a split, and a page to compare with, and not yet compared clean. A recipe compared with no differences
  is settled (the comparison totals splits); a recipe with no link has nothing to compare with. A recipe whose differences
  were VALIDATED stays "to check": the fault could be sitting behind that button.
- **Not "needing attention".** Most splits are right (`2 tbsp` of oil, then `1 tbsp` later), so the box "only those needing
  attention" and the count of recipes needing attention are as they were. The new box, and a sentence in the summary, carry it.
- **The recipe's own lines only.** The page's text is never stored, so nothing here can say a split is wrong, only that it is
  the shape worth comparing.

## What was measured

Read-only, against the live library on 21 Oct 2026 (kept in scratch, not in the repo): 36 of 76 recipes write an ingredient
on several lines; 8 have no link; none had been compared clean; **28 are "to check", 4 of them in different units**, one of
them the recipe the fault was found in (the control: a scan that missed it would have been useless). The household compares the
4 first, then the others as time allows.

## Not done, on purpose

- **Storing what kind of difference a comparison found.** `source_check` keeps counts only. Keeping the kinds (amount, missing,
  extra, word) would let LIBRARY CHECK list "amounts differ" first, but only for comparisons run after the change, so it would
  be empty of use until recipes are compared again. It needs no schema change (the column is jsonb); it is a separate PR.
- **Comparing every recipe at once.** The page fetch is refused by about half the sites, and each comparison is read by a
  person; a button that ran 28 of them would hide the half that failed.

## Checks

`test/core.test.js`: what is and is not a split (three checks). `test/smoke.js`: the line under a recipe, the units, the order,
the summary and the box, on invented recipes, one per case (mixed, same unit, validated, compared clean, no link, two uses,
seasoning). Each seen failing by breaking the rule it guards.
