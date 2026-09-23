# Converter test set

Eight deliberately awkward recipes for checking `conversion-instructions.md` still
produces the right shape. Run them whenever those instructions change: paste each
source into a fresh conversion chat and compare the output against the notes here.

These are synthetic — written to isolate one failure mode each, not to be cooked.
They check structure, not wording: handle names and phrasing will vary, and that's
fine. What must match is which ingredients sit in which group, where each group joins,
and that every MERGE carries a duration. Tests 6 to 8 are the exception: they check the ingredient lines
themselves, because the shopping list reads their shape, and because a renamed ingredient is a
changed recipe.

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

## 6. Ingredient lines

**Why:** added 23 Sep 2026. The shopping list reads ingredient lines mechanically, so every
line has to be in the standard shape (`conversion-instructions.md` §1). Measured on the
library, the lines that broke it were the ones below: fractions it couldn't read, ranges,
multipliers, two ingredients on a line, alternatives, size words and preparation in the name.

**Source:**

> **Store-Cupboard Tomato Stew** — Serves 4. You'll need 1½ tsp ground cumin, 2-3 tbsp
> olive oil, 1 large onion, diced, 2 x 400g tins chopped tomatoes, 1 cup plain flour, 4 tbsp
> butter, melted, a knob of butter to finish, juice of 1 lemon, golden syrup or honey
> (2 tbsp) and salt and freshly ground pepper to taste. Soften the onion in the oil for
> 8 minutes, add the cumin, then the tomatoes, and simmer for 20 minutes. Stir in the rest
> and season.

**Must produce** lines in this shape (wording of the preparation may vary):

```
1 1/2 tsp ground cumin
2-3 tbsp olive oil
1 onion (large), diced
800 g chopped tomatoes (2 tins)
120 g plain flour
60 g butter, melted
1 knob butter, to finish        (or a weight, e.g. 15 g butter, to finish)
1 lemon, juiced
2 tbsp golden syrup (or honey)
salt, to taste
black pepper, to taste
```

**Fails if** any line:
- holds two ingredients;
- contains `½` or `x`;
- has a size word ("large") between the quantity and the name;
- puts preparation before the name ("juice of", "melted butter");
- measures more than 1 tbsp of butter in spoons;
- or uses an alternative ("or") outside brackets.

---

**Run 1, 23 Sep 2026: failed on one line, two softer misses.** The converter wrote
`1 large onion, diced`, with the size word before the name. It also collapsed the range to
`2 tbsp olive oil`, with the range in NOTES, and moved "or honey" to VARIATIONS. Everything
else matched. The instructions were tightened on all three points the same day, and the test
needs running again.

**Run 2, 23 Sep 2026: passed.** Every line in the standard shape: the range kept
(`2-3 tbsp olive oil`), `1 onion (large), diced`, `30 ml golden syrup (or honey)` on its own
line, and butter by weight. The converter also noticed that this test's "bean stew" had no
beans, so the test recipe was renamed *Tomato Stew*.

---

## 7. British English, and nothing more specific than the source

**Why:** added 23 Sep 2026 as "Vocabulary", and **reframed later the same day** after
`docs/REVIEW-ARCHITECTURE-FINDINGS.md` §4. The morning's version required the converter to
replace every source wording with the name from `ingredient-names.md`; the review showed that
rule buys nothing the app's own dictionary doesn't, and that a converter told to canonicalise
will canonicalise the cases the list never meant (it wrote *dried oregano* for *Italian
seasoning*). The rule is now the opposite: translate the word into British English, keep the
product, and keep the source's ambiguities. The app's dictionary totals them at list time.

**Source:**

> **Weeknight Noodle Bowl** — Serves 2. 2 scallions, sliced; a handful of cilantro; 1 red
> bell pepper, sliced; 2 tbsp neutral oil; 150 ml heavy cream; 3 tbsp plain yogurt; 1 tbsp
> all-purpose flour; 2 tbsp soy sauce. Fry the pepper in the oil for 4 minutes, stir in the
> flour, then the soy sauce, cream and yogurt, and warm through for 2 minutes. Top with the
> scallions and cilantro.

**Must produce** these names: *spring onions, coriander, red pepper, neutral oil, double cream,
plain yoghurt, plain flour, soy sauce*. The first five and *plain flour* are the same product
under its UK name; *neutral oil*, *plain yoghurt* and *soy sauce* are what the source said,
British-spelt, and no more specific.

**Fails if:**
- an American word survives: scallion, cilantro, bell pepper, all-purpose, heavy cream, or the
  spelling "yogurt";
- **or the converter settles what the source left open**: `vegetable oil` for "neutral oil",
  `natural yoghurt` for "plain yogurt", `light soy sauce` for "soy sauce". That is the
  Italian-seasoning fault in miniature, and the one this test now exists to catch.

Run `test/validate-recipes.js` on the output: it should report no faults and print
`totals on the shopping list as: neutral oil → vegetable oil, plain yoghurt → natural yoghurt,
soy sauce → light soy sauce`, which is the app doing the job the converter no longer does.

**Run 1, 23 Sep 2026 (as "Vocabulary"): failed on one name.** The converter wrote
`3 tbsp plain yogurt`; the other seven listed names matched.

**Run 2, 23 Sep 2026 (as "Vocabulary"): one name short.** `natural yoghurt` came through, but
the converter wrote `1 handful coriander`, not `fresh coriander`. Under the reframed test
that line is correct: "coriander" is the shelf name, and *fresh coriander* is what the app
totals it under.

**Run 3, 23 Sep 2026, the first under the reframed wording: passed.** All eight names correct,
and the three that matter most came through unspecified, as the source had them: `2 tbsp neutral
oil`, `3 tbsp plain yoghurt`, `2 tbsp soy sauce`. Under the morning's rule those would have been
"corrected" to vegetable oil, natural yoghurt and light soy sauce. The converter had the revised
instructions and no `ingredient-names.md`. First evidence that the reversal works.

---

## 8. Ingredients the list has never seen

**Why:** added 23 Sep 2026, so the converter is not only tested on ingredients the dictionary already lists.
`ingredient-names.md` was built from the library's own recipes, and each new recipe brings
about four ingredients the library hasn't met. This test uses **none of the listed
ingredients**, so it checks the general rule: name each thing as a UK supermarket shelf
labels it, in the standard line shape.

**Source:**

> **Green Curry Traybake** — Serves 4. 1 large eggplant, cubed; 1 can (400g) garbanzo beans,
> drained; 250g ground beef; 1 stalk lemongrass, bruised; 2 kaffir lime leaves; 1 tbsp Thai
> green curry paste; 1 can (400 ml) coconut milk; 1 tbsp fish sauce; a big handful of arugula
> to serve. Roast the eggplant for 20 minutes at 200°C. Brown the beef for 6 minutes, stir in
> the curry paste, lemongrass and lime leaves, then the coconut milk, fish sauce and
> chickpeas, and simmer for 10 minutes. Pour over the eggplant and top with the arugula.

**Must produce** these names, in the standard shape:

- *aubergine*
- *chickpeas*, e.g. `400 g chickpeas (1 tin), drained`
- *beef mince*
- *lemongrass*
- *lime leaves* (the shelf name; "kaffir" is no longer used on UK labels)
- *green curry paste*
- *coconut milk*, e.g. `400 ml coconut milk (1 tin)`, **in ml**, as the tin is labelled
- *fish sauce*
- *rocket*

**Fails if:**

- an American or source-only word survives: eggplant, garbanzo, ground beef, arugula, can;
- a size word leads a name ("large", "big");
- the container is in the name ("1 can coconut milk");
- or "stalk" and "handful" lines lack a number.

**Run 1, 23 Sep 2026: passed on every fail criterion, one soft miss.** `1 aubergine (large),
cubed`, `400 g chickpeas (1 tin), drained`, `250 g beef mince`, `400 ml coconut milk (1 tin)`,
`1 tbsp fish sauce`, `1 handful rocket, to serve`; no American word, no container in a name, the
stalk and handful lines numbered. The miss: `2 kaffir lime leaves`, where the shelf name is
*lime leaves*. Same product, a translation not made rather than a swap, so not a failure; if it
turns up in a second recipe, "kaffir lime leaves" becomes a spelling under *lime leaves* in the
dictionary. "Thai green curry paste" is what the jar says, and fine.

**Worth knowing:** whoever maintains the dictionary also wrote this test, so it is only partly
independent. The strongest version of this test is the next real recipe from a site the
library hasn't used before: convert it, run `validate-recipes.js`, and read the "new to
ingredient-names.md" line it prints.

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

---

## Third scan — 20 Sep 2026, after ingestion

The reprocessed library went in on 20 Sep: 33 recipes, replacing the 40 the two scans above
describe. **Those two scans are now history, not status** — they describe recipes that either
no longer exist or have been rewritten. Kept as written, because what they found is the reason
the conversion instructions say what they say.

Re-run of all five tests against the ingested library. Checked against the syntax actually in
the database, which was first confirmed byte-identical to the validated text by md5.

| Test | Was | Now |
| --- | --- | --- |
| 1 — late addition | 7 recipes flagged | **Fixed.** All four surviving flagged recipes restructured; see below |
| 2 — split ingredient | 2 lines restating a total | **Fixed.** No line in the library now restates a total |
| 3 — parallel prep | not measured | 10 stages carry more than one MERGE line |
| 4 — instant step | 296 of 302 MERGE lines bare | **242 of 242 timed.** `[instant]` used 78 times. (Recorded as 249 until a 22 Sep recount: 250 MERGE lines exist, 8 of them in Victoria Sandwich, deliberately never converted.) |
| 5 — no stated yield | 23 of 40 missing | **33 of 33 present** |

### Test 1 — the four flagged recipes

- **Maple Almond Granola Clusters** — the case that started all this. `vanilla` is now its own
  group, merging into the heated syrup a stage later: `MERGE wet_heated, vanilla -> syrup:
  Remove from the heat and whisk in the vanilla [instant]`. The diagram now says what the
  method says. The v2/v2b/v3 duplicates were deleted.
- **No-Bake Chocolate Oat Bars** — the collapsed `base`/`topping` pair is gone; four groups
  (dry, peanut butter, honey, chocolate) each merge at their own stage, matching the method's
  "fold in the chocolate chips last".
- **Chocolate Almond Butter Oatmeal Bars** (was *Easy No-Bake Almond Butter Oatmeal Bars*) —
  `wetbase` no longer holds both the dry mix and what's stirred in after; the topping and
  almonds join at their own later stages.
- **Chocolate Chunk Cookies** — vanilla has moved out of the creamed butter-and-sugar group
  into `eggwet`, beaten in with the egg a step later, which is what the recipe does.

### Test 2 — the split lines that bought double

Both faults are gone, and by different routes:

| Was | Now |
| --- | --- |
| Jambalaya: `960 ml chicken stock` ×2, totalling 1.92 L | appears once. Fixed |
| Chicken Fried Rice: `2 tbsp dark soy sauce` ×2, totalling 4 tbsp | that recipe was dropped; its successor **Egg Fried Rice** splits the 2 tbsp properly as `1/4 tbsp` + `1 3/4 tbsp` |

23 other ingredients are named in more than one group across the library. Every one was checked
and every one states what *that* use needs — six of them legitimately repeat the same figure
(1 tbsp oil for each of two fryings, 1 tsp cumin in both a marinade and a spice mix), which is
the correct pattern the first audit blessed, not the incorrect one it flagged.

### One borderline, not called a failure

**Classic Scones** warms the milk and stirs the vanilla and lemon juice into it within a single
group: `MERGE wet -> wet_warm: Warm the milk in a jug ... until warm but not hot; stir in the
vanilla and lemon juice [1 min]`. Strictly this is the test 1 shape — two moments inside one
group. It is left alone because the stakes are nothing like the granola case: the milk is
brought to lukewarm rather than cooked, so there is no aromatic to drive off, and the source
presents it as one action. Recorded here so the next person doesn't have to re-derive the
judgement.

### A parser gap this scan exists because of

The first version of the reprocess wrote its timings as prose inside the MERGE label rather
than in brackets, so all 33 recipes arrived untimed and were rejected before they reached the
database. Re-run correctly, they exposed a second problem: `extractStepDuration` did not
recognise `[4–5 min]` with an en dash, `[30 sec]`, or `[1 hr 30]`. An unrecognised bracket is
not inert — the label keeps it, so the raw text shows in the diagram and the step counts as
untimed. All three are now accepted. The batch used `[30 sec]` three times.

**The lesson for this file:** a conversion can satisfy every rule here and still land wrong,
because these tests check what the converter writes, not what the parser reads. When the two
disagree the failure is silent. `test/validate-recipes.js` now checks the second half.
