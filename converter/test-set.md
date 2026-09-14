# Converter test set

Five deliberately awkward recipes for checking `conversion-instructions.md` still
produces the right shape. Run them whenever those instructions change: paste each
source into a fresh conversion chat and compare the output against the notes here.

These are synthetic — written to isolate one failure mode each, not to be cooked.
They check structure, not wording: handle names and phrasing will vary, and that's
fine. What must match is which ingredients sit in which group, where each group joins,
and that every MERGE carries a duration.

---

## 1. Late addition (the granola clusters case)

**Why:** the failure that prompted the test set. A heat-sensitive ingredient listed
in the same breath as the rest of the wet ingredients, but added off the heat.

**Source:**

> **Maple Syrup Drizzle** — Serves 4. Melt 70g butter with 60g brown sugar and 80ml
> maple syrup in a small pan over medium heat, whisking for about 4 minutes until the
> sugar dissolves. Remove from the heat and whisk in 1 tsp vanilla extract. Pour over
> 250g warm pancakes and serve straight away.

**Must produce:** vanilla in its **own group**, merging in at a later stage than the
butter/sugar/syrup group — not a fourth line inside the melted group. The off-heat
instruction must survive as structure, not only as words in the label.

**Fails if:** vanilla appears in the same group as the butter, sugar and syrup, however
accurately the MERGE label describes the order.

---

## 2. Split ingredient

**Why:** one ingredient used at two different points has to become two lines, one per
group, or the shopping list under-counts and the flow loses a step.

**Source:**

> **Garlic Butter Greens** — Serves 2. Melt 30g of butter in a pan and fry 2 sliced
> garlic cloves for 1 minute. Add 300g green beans and cook for 6 minutes. Stir the
> remaining 20g butter through at the end until glossy, then serve.

**Must produce:** two butter lines — `30g butter` in the frying group, `20g butter` in
its own late-addition group merging at the final stage. Ideally each marked as a split
(e.g. `30g butter (split: 1 of 50g)`).

**Fails if:** a single `50g butter` line appears anywhere, or the second addition is
dropped into the first group.

---

## 3. Parallel prep

**Why:** two independent tracks that only meet at the end. They must occupy the *same*
stage as separate MERGE lines, not be flattened into a sequence.

**Source:**

> **Soup and Toast** — Serves 2. Simmer 400g chopped tomatoes with 200ml stock for 10
> minutes, then blend until smooth. While that simmers, toast 4 slices of sourdough for
> 3 minutes and rub each with a halved garlic clove. Ladle the soup into bowls and serve
> the toast alongside.

**Must produce:** the soup track and the toast track running as separate MERGE lines
within the same STAGE (they happen at once), converging in a final plating merge.

**Fails if:** the toast is sequenced after the soup finishes, implying it's made
afterwards rather than during.

---

## 4. Instant step

**Why:** checks `[instant]` is used rather than the bracket being dropped, which is what
breaks the shared cooking timeline.

**Source:**

> **Finished Soup** — Serves 2. Reheat 500ml soup for 5 minutes until steaming. Divide
> between bowls, scatter over a small handful of chopped chives and a grind of black
> pepper, and serve.

**Must produce:** every MERGE with a bracket, and the scatter/serve step marked
`[instant]` rather than given an invented duration or left bare.

**Fails if:** any MERGE line has no bracket, or the garnish step is padded with a made-up
time like `[1 min]`.

---

## 5. No stated yield

**Why:** servings is mandatory now, so the converter has to ask rather than omit.

**Source:**

> **Herb Oil** — Blitz 50g parsley with 150ml olive oil and a pinch of salt for 30
> seconds until bright green. Strain through a sieve. Keeps in the fridge for a week.

**Must produce:** a question back to the person asking what it serves, before any final
syntax is presented. `SERVINGS:` must be present in the output, carrying the answer.

**Fails if:** the `SERVINGS:` line is omitted, or a number is invented from the
quantities without asking.

---

## Library audit — 13 Sep 2026

Scan of the 40 existing recipes for the same late-addition pattern as test 1. Flagged
for re-conversion, worst first:

| Recipe | Issue |
| --- | --- |
| Maple Almond Granola Clusters | `1 tsp vanilla extract` inside the heated `wet` group; method adds it off the heat |
| Maple Almond Granola Clusters v2 | same |
| Maple Almond Granola Clusters v3 | same |
| Maple Almond Granola Clusters v2b | same |
| No-Bake Chocolate Oat Bars | `base`/`topping` groups collapse three moments (melt butter → stir in sugar and vanilla → mix in oats) into one |
| Easy No-Bake Almond Butter Oatmeal Bars | `wetbase` holds both the dry mix and the almond butter/syrup stirred in after |
| Chocolate chunk cookies | vanilla grouped with butter and sugars, though beaten in with the egg a step later |

### Second scan — 14 Sep 2026

Two library-wide faults the first scan missed. Both matter more than the late-addition
list above, because they affect nearly everything rather than four recipes.

**No step timings anywhere.** 296 of 302 MERGE lines across all 40 recipes carry no
`[duration]` bracket. 39 recipes have none at all; not one is fully timed. The app only
reads a duration from a trailing bracket, and `computeTimeline` returns null unless at
least one step has one — so the timeline strip never appears and no step shows a time
badge. A whole feature is dark across the library. Test 4 covers this for new
conversions; the back catalogue predates it.

**Split lines that repeat the total instead of the portion.** 8 split lines across 3
recipes. The shopping list strips the parenthetical when matching names, so both halves
of a split combine — which is correct only if each line carries its own portion.
Verified against the app's own aggregation code:

| Recipe | Written as | Totals to | Should be |
| --- | --- | --- | --- |
| Chicken Fried Rice | `1 tbsp oil` ×2 | 2 tbsp | 2 tbsp — correct |
| Chicken Fried Rice | `2 tbsp dark soy sauce` ×2 | 4 tbsp | 2 tbsp |
| Jambalaya | `960 ml chicken stock` ×2 | 1.92 L | 960 ml |

The oil lines show the right pattern: each states what that use needs. The soy sauce and
stock lines each restate the whole amount, so the shopping list buys double. Test 2's
`30g butter (split: 1 of 50g)` is the shape to aim for.

Checked and correct — flagged by the scan but right as they stand: the `topping` and
`garnish` groups in Greek Potato Hash, Creamy Cajun Prawn Pasta, Cajun Prawns with
Noodles and Tuscan Salmon with Orzo all merge at the final stage, which is exactly where
the method adds them. Creaming butter with sugar (Victoria Sandwich, scones) is one
action, not two moments.
