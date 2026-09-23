# Ingredient matching — review findings and recommendations

**Written 22 Sep 2026**, answering the brief in `docs/REVIEW-INGREDIENT-MATCHING.md`. Every number
here was measured against the real library: 34 recipes and 463 ingredient lines, read from Supabase
and scored with the app's own functions. It stopped for the household's decisions (§9).

**Decided 23 Sep 2026: all twelve as recommended.** Progress against the ranked list:

| # | Status |
| --- | --- |
| 1 | **Merged to `main` as PR #9, 23 Sep 2026.** `splitQty`, `parseFraction`, `parseIngredientAmount` and `scaleRecipeSyntax` now read mixed numbers, `1½`, ranges, "up to" and `3 x 400 g`. On the real library exactly the 7 predicted lines change, and all 6 scaling faults are gone. Smoke 191 → 197. All seven mutations named in `test/smoke.js` (dropping each branch, buying the lower figure of a range, scaling the pack size, reverting `splitQty`) fail their check by name |
| 2 | **For the household**, in Settings → Word Matches: delete the inverted match and the orphaned one (the private appendix, section A, names them) |
| 3 | **Written, same branch.** `conversion-instructions.md` gains the line shape and the 23 Sep revision note; `ingredient-names.md` holds the vocabulary (the 79 ingredients shared by two or more recipes, with D7–D9 applied); `test-set.md` gains tests 6 and 7; `validate-recipes.js` warns on lines outside the shape. On the real library the warning flags 74 lines, in the fault classes of §2.3. Loaded into the conversion project 23 Sep. **Test 6 passed on run 2; test 7 was one name short on run 2** (bare "coriander"), now fixed in the vocabulary and caught by the validator. Test 7 needs one more run. Run log in `converter/test-set.md` |
| 3a | **Guarding against over-fitting, 23 Sep.** The vocabulary is a small list, not the mechanism. The converter's first rule is now to *name an ingredient as a UK supermarket shelf labels it*, which works on ingredients no list has seen. The list keeps the household's decisions and the ambiguous words, and its spellings are kept as examples the validator checks against. `validate-recipes.js` now reports names the list doesn't know, so an entry is added when an ingredient turns up in a second recipe. Converter test 8 uses only unlisted ingredients. The tin rule, which had been fitted to chopped tomatoes, now reads "the unit on the tin". **Bulk survey, 23 Sep:** `converter/ingredient-extraction-prompt.md` extracts only the ingredient lines of many recipes, in the standard shape and in the source's words; `test/ingredient-survey.js` reports names seen in two or more recipes, spellings to add under listed names, possible duplicates (the strict rule of §2.6) and rule breaks. It shares its line checks with `validate-recipes.js` via `test/ingredient-lines.js` |
| 4–8 | Not started. **Step 4 must also:** make the app's dictionary the master copy, with `converter/ingredient-names.md` generated from it and a test that fails if they differ (§6, check 22); and add a private re-measure after every ten or so new recipes (§6, library regression), watching one number, *items split across names* |

**No library data is in this file.** The repo is public, so every example line below is made up to
show the same fault. The real lines, word matches and weeks behind each number are in a private
appendix handed to the household, which is not committed.

---

## Answers first

### 1. Can we deal with this differently? Yes, and it should be.

Today the app totals two lines only when their text reduces to exactly the same key, and relies on
you to join the rest, three `confirm()` questions at a time. **Measured on your library, that
approach can't get there.** If every recipe were planned at once, the list would have **274 rows
for 168 real things to buy**, and 51 of those things would be split across two or more names. The
questions don't close the gap. Run over the whole library, the current suggester asks 103 of them,
**35 of which are wrong** ("is unsalted butter the same as salt?"). Most of the rest only tidy a
parse artefact, and a "yes" to those stores the artefact permanently. Of the 9 "same" answers
you've given so far:

- 6 patch parse artefacts;
- 1 patches a size word;
- 1 is inverted and actively harmful;
- 1 joins the raw and cooked forms of one staple, which makes a real week's total wrong.

What works instead is to move the judgement to where it's cheap and reliable:

1. **The converter writes every ingredient line in one standard shape**, using names from a shared
   list. The converter is already an AI, so judgement belongs there.
2. **The app reads that shape strictly and mechanically.** No AI at runtime, as now.
3. **A small dictionary** catches synonyms and fixes the categories. 78 synonyms for 42
   ingredients produced every gain measured here. Giving every shared ingredient its aisle takes it
   to about 80 entries.
4. **The list shows one row per ingredient**, with every unit on that row
   (`Chicken breast — 2 + 400 g`), and **ticks are keyed by ingredient name**, so a unit change
   never loses a tick again.
5. **Questions become rare, inline and strict**, instead of the main mechanism.

On the two busy weeks you've actually planned, this takes the list from **79 rows to 60** and
**61 to 52**. Both are exactly the ideal, with **no false merges**.

### 2. Could the conversion stage help? Yes. It's the only place part of this can be fixed.

The converter currently copies the source's wording, so one batch converted on one day still wrote
the same oil four ways and the same yoghurt three ways. **Some faults can't be fixed mechanically
in the app at all:**

- 17 lines offer an alternative ("X or Y"). No single rule reads them all. "First alternative wins"
  gets about half right, and "share the last word" turns *golden or maple syrup*-style lines into
  products that don't exist.
- 3 lines hold two or more ingredients each.
- One tin is measured in ml where every other tin is in grams.
- One line gives the cooked weight of something you buy uncooked.

**24 lines across 13 recipes** need rewriting. Rewriting them in the format proposed in §4.2 brings
the whole library to **exactly 168 names, the ideal, with no false merges** (simulated with the
recommended app rules). The format and the exact converter wording are in §4.2.

### 3. More measurements, and ignoring noise words? Yes, both help. Neither is enough alone.

| Change, applied alone | Rows (today 280 without word matches) | What it does |
| --- | --- | --- |
| Ignore descriptors (large, small, extra, to taste, to serve…) | **259** (−21) | The biggest single app-side rule |
| Count units (pinch, clove, bunch, handful, piece…) | 273 (−5 on top of the quantity fix) | Halves the lines with no amount, **36 → 18** |
| tsp/tbsp totalled as ml | 269 (−11) | Joins spoons with spoons and with ml |
| Singular = plural | 277 (−3) | Small but free |
| All app-side rules together | **228** | 25 items still split |
| …plus the dictionary and your one useful word match | **210** (178 names) | 11 items still split, all fixable only at conversion |

**Some words must never be ignored**, because they change what you buy: *ground, dried, frozen,
cooked, raw, smoked, double/single, plain/self-raising, baby, spring, red/green/yellow, light/dark,
unsalted, whole, bone-in*. The full lists, with how often each word occurs in the library, are in
§4.3. One tested rule is worth avoiding: treating any trailing "stick/clove/stalk" as a unit merges
**cinnamon sticks with ground cinnamon**. Garlic cloves need a named exception instead.

---

## What I recommend, in order

Ranked by value against risk. Items 3 and 4 have no dependency on each other and can happen in
either order. Items 4–6 are one release: item 4 re-keys the list, and items 5 and 6 depend on the
names it produces.

| # | What | Why (measured) | Risk | Size |
| --- | --- | --- | --- | --- |
| **1** | **Fix the quantity reader** (mixed numbers, ranges, `3 x 400 g`, "up to"). Separately, first. | **6 lines scale wrongly or not at all today**, e.g. a `1 3/4 tbsp` line doubled reads `2 3/4`. That's a wrong amount *while cooking*. | Very low: 7 lines' split moves in the flow table, same characters. No live tick affected. | Small |
| **2** | **Delete 2 word matches now:** the inverted one and the orphaned one (§2.5) | The inverted one renames every line of one ingredient to a parse artefact, and would keep doing so after any fix | None | Settings → Word Matches |
| **3** | **Converter: the standard ingredient line and a shared vocabulary** (§4.2), plus 2 new converter tests | Stops new recipes adding to the problem. Fixes the 24 lines nothing else can | None to the app | Instructions and test set |
| **4** | **Shopping list v2**, one release: app-side name rules, the dictionary with aisles, **one row per ingredient**, **ticks keyed by name**, tsp/tbsp as ml | 274 → 210 rows library-wide (178 shown as one per name). Real weeks 79 → 60 and 61 → 52. Categories: 59 items leave "Other" and 18 misfiled items move | Moderate: re-keys ticks once. Ship on a Friday morning before shopping (§5) | Medium |
| **5** | **Replace the "same ingredient?" dialogs** with a strict, inline suggestion | Current suggester: 35 of 103 proposals wrong. Strict rule: 0 of 25 wrong today, 2 proposals left after item 4 | Low | Small |
| **6** | **Tidy word matches** with item 4: 6 more become redundant, 1 needs your decision | Keeps the Word Matches screen honest | None | Settings |
| **7** | **Rewrite the 24 lines** only the converter can fix, in place (§5) | Takes the library to the ideal: 168 names | Low if done in place and validated; never delete-and-reinsert | Small data job |
| 8 | *Optional:* bring all 144 non-conforming lines into the standard shape | Cleaner flow tables; fewer surprises for the dictionary | Low | Medium data job |

**Not recommended**, with the evidence:

- **Keeping the substring suggester.** Once the parsing rules exist it gets worse: 43 of its 72
  proposals are wrong.
- **A generic trailing-unit rule.** It causes the cinnamon false merge.
- **App-side guessing on "or" lines.** At most −3 rows, and it invents names.
- **Any fuzzy or edit-distance matching.** Not tested. After the rules and dictionary, every
  remaining split is an "or" line or something only the converter can fix, and fuzzy matching
  wouldn't fix those either.

---

## 1. How this was measured

- **Data.** The ingredient lines of all 34 recipes were extracted in SQL using the same header rules
  as `parseRecipe`. The local copy was then checked against the database by md5, and was
  byte-identical. The 20 word matches, 9 ticks and 18 planned days were copied the same way and
  checksummed. All of it lives in a scratch directory outside the repo.
- **Code.** The built test page (`test/build.js`) was loaded in Playwright, with the real library
  put into its cache, and the app's own `splitQty`, `parseIngredientAmount`,
  `normalizeIngredientName`, `applyIngredientAlias`, `buildShoppingList`,
  `findIngredientMatchSuggestions`, `categorizeIngredient` and `scaleRecipeSyntax` were called on
  it. Each idea was implemented as a switch on one alternative pipeline. With every switch off,
  that pipeline reproduces the app's own key for **all 463 lines**, so every difference reported
  is caused by the idea being tested.
- **Answer key.** I labelled each line by hand with the thing you'd buy: 168 items. Ten pairs are
  marked "either way is fine" (butter/unsalted butter, salt/sea salt, caster/golden caster…) and
  count as neither right nor wrong. **This is my judgement, not yours**, and the private appendix
  lists it so you can disagree with specific calls.
- **Real weeks.** Every week in `planner_days` was rebuilt as a full Friday-to-Thursday week, using
  the app's own `buildShoppingList` for "today". Two weeks are big enough to matter: **Week A**
  (6 recipes, 109 lines) and **Week B** (5 recipes, 82 lines, the current week).

---

## 2. What happens today

### 2.1 The headline

| | Rows | Distinct names | Items split across names | False merges |
| --- | --- | --- | --- | --- |
| Ideal (answer key) | — | **168** | 0 | 0 |
| Today, with your word matches | **274** | 249 | 51 | 0 |
| Today, without them | 280 | 257 | 53 | 0 |

**The current approach never merges wrongly. It fails by not merging:** 51 of 168 things are split,
and 62 appear on more than one row. Your word matches recover 6 rows.

### 2.2 Quantities

| Fault | Lines | Effect |
| --- | --- | --- |
| Mixed number, `1 3/4 tbsp` | 3 | Quantity read as `1`. **Wrong when scaled** (×2 gives `2 3/4`) and wrong on the list |
| Range, `3-4 tbsp` or `3–4 tbsp` | 2 | No quantity. **Never scaled**, never totalled |
| `up to 500 ml` | 1 | No quantity. Never scaled |
| `3 x 125 g tins` | 1 | Scales correctly (the multiplier), but totals as "3" of a name starting with `x 125 g` |
| `zest of 1/2 …`, `leaves from 1/2 bunch …` | 3 | No leading number. Never scaled |
| No quantity at all | 36 | 18 are genuinely unquantified (garnishes, to taste, to serve). 15 are *pinch of*, *handful of*, *small bunch*, *zest of* forms. 3 are the ranges and "up to" |
| `1½`-style fractions, `grams`, `litre` | 0 | Latent faults only, not present in the library |

Confirmed with the app's own `scaleRecipeSyntax` at ×2: **6 lines come out wrong or unscaled.**

### 2.3 Names

| Fault class | Lines | Made-up example → key today |
| --- | --- | --- |
| **Dangling "and"** (new, not in the brief) | **27** (6%) | `1 carrot, peeled and diced` → `carrot and` |
| Count, size or container word after the number | 37 | `2 large eggs` → `large eggs`; `1 small bunch dill` → `small bunch dill` |
| Alternative, "X or Y" | 17 | `100 ml golden or maple syrup` → the whole phrase |
| Preparation before the name | 20 | `1 tsp grated nutmeg` → `nutmeg` (fine), but `400 g tin chopped tomatoes` → `tin tomatoes` |
| Brackets and notes | 19 | handled today (brackets are dropped) |
| Two or more ingredients on one line | 3 | `salt and pepper, to taste` |
| **Source wording copied through** | — | The same oil written 4 ways, the same yoghurt 3 ways, the same pepper 3 ways, in one batch |

The dangling "and" is the single biggest class. `stripPrepWords` removes *peeled* from "peeled and
diced" but not the *and*, so every "…, deseeded and sliced" line gets its own key.

**A hidden risk.** `chopped` is a prep word, so "tin chopped tomatoes" loses it. Nothing in the
library collides yet, but chopped tomatoes (tinned) and tomatoes (fresh) are one step from merging.
The comma rule (§4.3) fixes this: words *before* the comma describe the product.

### 2.4 Units that can't total

Even with every naming fix, **30 items still sit on 2–4 rows because their units differ**.
Totalling tsp/tbsp as ml fully joins 7 of them and removes 11 rows. Of the 23 that remain:

- 9 involve volume against weight of the same thing: spoons of butter, sugar, yoghurt or cocoa
  against grams, and one tin in ml against tins in grams;
- the other 14 mix measured amounts with pinches, handfuls, bunches, bare counts
  (2 breasts + 400 g) or "to taste".

Showing one row per ingredient absorbs all of them (§4.5).

### 2.5 Your word matches

20 stored: 9 "same", 10 "not the same", 1 source.

| "Same" answers | Count | What they are |
| --- | --- | --- |
| Patches over a parse artefact (a dangling "and", a stray "/", an unparsed "pinch", "to taste", a leftover adverb) | 5 | All made redundant by the rules in §4.3 |
| A size word | 1 | Made redundant by the descriptor rule |
| **Inverted: a clean name mapped *onto* an artefact** (the leftover of a mixed number) | 1 | **Harmful now.** Every line of that ingredient is renamed to the artefact. Delete it (recommendation 2) |
| Already orphaned: its artefact no longer occurs in any recipe | 1 | Delete |
| Raw ↔ cooked version of the same staple | 1 | **Makes a real week's list wrong.** It adds a cooked weight to an uncooked one, so the list asks for more than half as much again as is needed. Decision D4 |

**All 10 "not the same" answers were correct refusals of false suggestions.** Nine stay apart under
the new rules. One pair would be merged by them: a seasoning pepper measured in spoons against the
same pepper measured in pinches. Both are black pepper, and you said "not the same", probably
because the bare word "pepper" looked like the vegetable. Decision D5.

**So of the 19 questions you've answered, 1–2 were genuine synonyms.** The rest were artefacts or
false alarms.

### 2.6 The "same ingredient?" questions

`findSimilarTerm` was written for source names and uses **substring containment**. Run as if the
whole library were on one list:

| | Proposals | Right | Either way | **Wrong** |
| --- | --- | --- | --- | --- |
| Today (with your answers applied) | 103 | 59 | 9 | **35** |
| After the app-side rules | 72 | 22 | 7 | **43** |
| After rules + dictionary | 37 | 4 | 5 | **28** |

The wrong ones follow a few patterns. These made-up pairs have the same shape as the real ones:

- *unsalted butter ⊃ salt*
- *milk chocolate ⊃ milk*
- *peanut butter ⊃ butter*
- *celery salt ⊃ salt*
- *spring onions ⊃ onion*
- *coriander ⊂ ground coriander*, which the code comments say must never total
- *cinnamon ⊂ cinnamon stick*
- *oil ⊂ anchovies in olive oil*

In Week A, 14 questions were queued. 2 were wrong and 1 was "either way". Of the 11 right ones, 8
only tidied artefacts that the rules fix automatically, and 2 were synonyms the dictionary covers.
That left 1 that genuinely needed asking.

**A strict rule does far better.** Propose a pair only when:

- the two names share their last word;
- one name has exactly one extra word;
- that word isn't on the never-ignore list.

That rule makes **25 proposals today with none wrong**, 13 after the rules (none wrong), and **2**
after the dictionary (none wrong). All five false pairs listed in the brief are rejected by its
structure.

### 2.7 Categories

Of the 168 items, **59 (35%) land in "Other"**: meat, vegetables, whole spices, baking staples and
frozen goods among them. **18 more land in the wrong aisle** because a keyword matches the wrong
word:

- sweet peppers file under Spices ("pepper");
- nut butters under Dairy ("butter");
- anything with "milk" or "egg" in its name under Dairy;
- spices named after a herb or bulb under Produce ("coriander", "garlic");
- tinned tomato products under Produce ("tomato").

A dictionary entry carries its aisle, which fixes all of these for known items.

Found while testing: folding plurals for the key breaks keyword categorising ("chilli flake" no
longer matches "chilli flakes"). Categories must be decided from the dictionary or the display name,
never from the folded key.

### 2.8 Ticks

9 ticks are live, all in the current week. 7 are in "both weeks" mode and 2 in single-week mode.
Any change to how items are keyed re-keys them. §5 handles it by timing, not code.

---

## 3. Every idea, tested

The whole library as one list, word matches off unless stated. *Split* means the same item spread
over two or more names. *Extra rows* means rows beyond one per item.

| Idea | Rows | Names | Items split | Extra rows | False merges | Lines with no amount | Amounts changed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Today, your word matches | 274 | 249 | 51 | 106 | 0 | 36 | — |
| Today, none | 280 | 257 | 53 | 112 | 0 | 36 | — |
| Singular = plural | 277 | 253 | 52 | 109 | 0 | 36 | 0 |
| Ignore descriptors | 259 | 231 | 43 | 91 | 0 | 36 | 0 |
| Name ends at the first comma | 267 | 239 | 47 | 100 | **1** | 36 | 0 |
| "or": first alternative | 280 | 256 | 52 | 112 | 0 | 36 | 0 |
| "or": share the last word | 277 | 254 | 53 | 109 | 0 | 36 | 0 |
| tsp/tbsp as ml | 269 | 257 | 53 | 101 | 0 | 36 | 0 |
| Quantity reader fixed | 278 | 255 | 51 | 110 | 0 | 33 | 7 |
| + count units | 273 | 238 | 42 | 105 | 0 | **18** | 22 |
| + "garlic cloves" read as garlic | 272 | 237 | 42 | 104 | 0 | 18 | 22 |
| + *any* trailing clove/stick/stalk | 271 | 235 | 41 | 103 | **1** | 18 | 22 |
| All app-side rules | 228 | 198 | 25 | 61 | 1 | 18 | 22 |
| All rules + your word matches | 227 | 197 | 24 | 60 | 1 | 18 | 22 |
| All rules + dictionary | 205 | 173 | 6 | 38 | 1 | 18 | 22 |
| All rules + dictionary, spoons kept apart | 216 | 173 | 6 | 49 | 1 | 18 | 22 |
| **Recommended:** rules + dictionary, no "or" guessing, 1 word match | **210** | **178** | 11 | 43 | 1 | 18 | 22 |
| Recommended, after rewriting 24 lines | 203 | **168** | 1 | 36 | **0** | 21 | — |

**Every false merge was inspected. Only two ever appeared:**

1. A multi-ingredient line (shaped like *salt and pepper, to taste*) ending up as "salt". This
   comes from the comma rule, and disappears once the line is written as separate lines.
2. *Cinnamon stick* joining *ground cinnamon*. This comes from the generic trailing-unit rule, which
   is not recommended.

**Real weeks**, rows on the list:

| | Today | App rules, one row per name | **Recommended** | Ideal |
| --- | --- | --- | --- | --- |
| Week A (6 recipes) | 79 | 64 | **60** | 60 |
| Week B (5 recipes) | 61 | 56 | **52** | 52 |
| Three smaller weeks | 13 / 26 / 16 | 12 / 26 / 16 | 13 / 26 / 16 | 12 / 26 / 16 |

The one smaller-week miss is an "X or Y" line, which the 24-line rewrite fixes.

---

## 4. The recommendation in detail

### 4.1 Approach: what each candidate costs

| Candidate | Gets you | Costs | Verdict |
| --- | --- | --- | --- |
| **Keep prompt-and-remember, better suggester** | Safe: 0 wrong merges | You do the work forever, and artefacts get stored as synonyms. 274 rows today, 227 at best even with every rule | Keep the *remember*, drop the *prompt* |
| **Smarter parsing in the app** | 280 → 228 with no data change | A long tail of heuristics. "or" lines and multi-ingredient lines can't be done | **Yes**, as the safety net |
| **Small curated dictionary** | 228 → 210, and correct aisles | 78 synonyms for 42 ingredients as tested; about 80 entries once every shared ingredient has its aisle; a few considered additions per new recipe (below) | **Yes** |
| **Converter-emitted standard line** | The only fix for the last 12 splits; reaches the ideal | Converter change, two new converter tests, a 24-line migration | **Yes**, it carries the long term |
| AI at runtime | — | Against a standing rule, and nothing measured needs it | No |

**The dictionary stays small because only shared items matter.** 79 of the 168 items appear in two
or more recipes, and they account for 369 of the 463 lines (80%). An item used once never needs to
merge with anything. Since the first 20 recipes, each new recipe has added 0–8 new items (3.7 on
average). Across those 14 recipes, **two-thirds of their ingredients (104 of 156) were already
known**. A new item only needs an entry once it turns up in a second recipe.

My dictionary was written after seeing your library, so its figures are an upper bound. The growth
figures are the honest measure of upkeep.

**Where the dictionary lives:** in `index.html`, as a constant that is versioned and tested. It's
exported as `converter/ingredient-names.md` for the converter project, with a test that fails if
the two drift (§6). Your own additions stay in Word Matches, which remains the override.

### 4.2 The ingredient line (question 2)

```
<quantity> <unit> <name>, <preparation> (<note>)
```

Made-up examples:

```
4 tbsp olive oil
1 onion, finely chopped
3 garlic cloves, crushed
400 g chopped tomatoes (1 tin)
375 g tinned tuna (3 × 125 g tins), drained
100 ml golden syrup (or honey)
1 green chilli (or red), finely sliced
2-3 tbsp natural yoghurt
1 pinch nutmeg
black pepper, to taste
3 eggs (large)
```

**Proposed converter wording.** This replaces the "Standardise every quantity…" bullet in §1
*Extract* of `converter/conversion-instructions.md`, and keeps the base-unit and phrasing bullets
after it:

> - **Write every ingredient line in one shape: `<quantity> <unit> <name>, <preparation> (<note>)`.**
>   The shopping list reads these lines mechanically, so the shape matters more than the wording.
>   - **One ingredient per line.** "Salt and pepper to taste" is two lines: `salt, to taste` and
>     `black pepper, to taste`. A free choice ("any nuts or dried fruit") is one line with a
>     single name and the choices in brackets.
>   - **Quantity first**: a whole number, a decimal with a point (`1.5`), a fraction (`1/2`), or a
>     mixed number with a space (`1 1/2`). A range uses a hyphen (`2-3 tbsp`). Never `½`, never
>     "a" or "an", never a multiplier like `3 x 125 g`: write the total and put the pack in the
>     note, as in `375 g tinned tuna (3 × 125 g tins)`. Leave the quantity out only for a line
>     that ends `, to taste` or `, to serve`.
>   - **Unit**: `g`, `kg`, `ml`, `L`, `tsp`, `tbsp`, or one count word: `pinch`, `bunch`,
>     `handful`, `sprig`, `slice`, `rasher`, `piece`, `tin`. Countable things need no unit
>     (`2 onions`, `3 eggs`). Garlic and celery keep their natural form: `3 garlic cloves`,
>     `2 celery sticks`. Nothing else goes between the number and the name, so no "large",
>     "heaped" or "thumb-sized".
>   - **Weigh solids, measure liquids.** Above 1 tbsp, butter, sugar, flour, cocoa and nut butters
>     go in grams, not spoons. Tinned goods go in grams (`400 g chopped tomatoes (1 tin)`), never
>     ml.
>   - **Name**: what you buy, spelled exactly as in `ingredient-names.md` when the ingredient is on
>     it. If it isn't, use the plain everyday British name. Keep the words that change what you
>     buy: ground, dried, frozen, cooked, raw, smoked, double/single, plain/self-raising, baby,
>     spring, red/green/yellow, light/dark, unsalted, whole, bone-in. Leave out the ones that
>     don't: large, small, medium, ripe, fresh, free-range, pure, extra. If a size matters, it
>     goes in the note: `3 eggs (large)`.
>   - **Preparation after the first comma**, never before the name: `cheddar, grated`, not
>     "grated cheddar". The exception is when the prepared form is what you buy: *chopped
>     tomatoes, ground cumin, minced beef, flaked almonds*.
>   - **Part of an ingredient** is preparation, not a quantity: `1/2 orange, zest only`,
>     `1 lemon, juiced`, `1/2 bunch coriander, leaves only`, never "zest of 1/2 orange". Written
>     that way, the number comes first and scales.
>   - **Alternatives and notes in brackets**, with the first choice as the name:
>     `100 ml golden syrup (or honey)`, `600 ml chicken stock (or vegetable stock)`.
>   - **The amount you buy, not the amount after cooking**:
>     `200 g long-grain rice, cooked and cooled`, not "600 g cooked rice". *(Subject to D4.)*

Also add to §3 *Check*: "Every ingredient line is in the standard shape, one ingredient each, with
listed names used wherever they fit."

**Two new tests for `converter/test-set.md`:**

- **Test 6 — Ingredient lines.** A synthetic source containing:
  - `1½ tsp ground cumin`, `2-3 tbsp olive oil`, `2 x 400g tins chopped tomatoes`,
    `1 cup plain flour`, `4 tbsp butter, melted`;
  - `salt and freshly ground pepper to taste`, `1 large onion, diced`,
    `a knob of butter`, `juice of 1 lemon`, `golden syrup or honey`.

  *Must produce* the standard shape for each. *Fails if* any output line has two ingredients, a
  `½`, an `x`, a size word in the name, preparation before the name, or spoons of butter.
- **Test 7 — Vocabulary.** A source using synonyms of listed names: *scallions, cilantro,
  all-purpose flour, heavy cream, red bell pepper, neutral oil, plain yogurt*. *Must produce* the
  listed names. *Fails if* any synonym survives.

**The format must also be checked on the app's side.** `test/validate-recipes.js` should warn on
any line the app's reader can't place in the shape. `test-set.md` already records why: "these tests
check what the converter writes, not what the parser reads."

### 4.3 Units and noise words (question 3)

**Count units to recognise.** Occurrences in the library are in brackets.

- clove (19), pinch (8, including "pinch of" and "pinch" without a number), bunch (8),
  handful (4), piece (2), chunk (1), head (1), squeeze (1), cm for ginger (1);
- tin/can, sprig, slice, rasher, stick, cube, knob, jar and pack: 0 today, but cheap to include.

Rules that go with them:

- **Never strip the last word**, so `4 cloves` stays the spice (the rule `tidyIngredientName`
  already follows).
- "Garlic clove(s)" and "celery stick(s)" are named in the dictionary rather than handled by a
  generic trailing-unit rule, which causes the cinnamon false merge.

**tsp and tbsp: yes, total them as ml** (1 tsp = 5 ml, 1 tbsp = 15 ml). This removes 11 rows.
Show spoons when every part was spoons (`2 1/2 tsp`, `3 tbsp`) and ml otherwise. Don't convert
spoons to grams: that needs densities and nothing measured calls for it.

**Ignore:**

| Kind | Words and phrases (occurrences) |
| --- | --- |
| Size and grade | large (15), small (8), medium (7), heaped (2), thumb-sized (1), extra-large, level, generous |
| Quality | fresh (19, already ignored), ripe (2), pure (3), free-range (1), organic |
| Tail notes | to taste (3), to serve (2), to glaze, to finish, plus extra/more for… (2), for greasing/brushing/dusting/flaming, optional (3) |
| Leftover prep | lightly, bashed, defrosted, cored, deveined, tail(s) on, skins removed, hot / cold (stock) |
| Grammar | a trailing "and" / "or" / "with", which is the dangling-and fix (27 lines) |
| **Everything after the first comma** | 137 lines carry preparation after a comma |

**Never ignore.** These change what you buy:

| Word | Occurrences | Keeps apart |
| --- | --- | --- |
| ground | 20 | ground coriander (seed) vs coriander (leaf); ground vs stick cinnamon |
| red / green / yellow | 15 / 4 / 1 | red onion vs onion, and each colour of pepper |
| dried | 13 | dried vs fresh herbs |
| dark / light | 9 / 6 | two soy sauces and two brown sugars |
| unsalted | 6 | *your call* (D8) |
| double / single | 6 / 0 | two creams |
| baby | 6 | baby spinach, baby potatoes |
| plain / self-raising | 5 / 3 | two flours |
| spring | 5 | spring onions vs onions |
| sea | 4 | *your call* (D8) |
| whole | 3 | whole cloves and nutmeg vs ground |
| frozen, cooked, raw | 2 each | frozen fruit, cooked noodles, raw prawns |
| full-fat | 3 | kept, a conservative choice |
| bone-in | 1 | bone-in vs boneless thighs |
| smoked | 0 | smoked vs sweet paprika, when it arrives |

**And the comma rule:** the name is what comes *before* the first comma, so words there describe the
product ("chopped tomatoes") and words after it describe the preparation ("tomatoes, chopped").
Alone it removes 13 rows. Its one false merge is the multi-ingredient line, which the converter fixes.

### 4.4 Suggestions (question 4)

**Keep "remember", drop "prompt".** Word matches stay, since they are your override and the only way
to teach the app something the dictionary doesn't know. The `confirm()` dialogs on opening the
shopping list go.

- **Propose** with the strict rule in §2.6. It measured 25 proposals today with none wrong, and 2
  after the rules and dictionary.
- **Ask inline**: a small "Same as *parsley*? Merge · Keep apart" under the item on the list. It
  never blocks, never shows more than one per item, and is answered when convenient.
- **Merge by hand**: a "Merge with…" action on any item, for the pairs no rule will find. This is
  the S3 aliases manager, reachable from where the problem is seen.

### 4.5 Lines that genuinely can't total (question 5)

**One row per ingredient, with every part on it.** For example:

- `Chicken breast — 2 + 400 g`
- `Salt — 1 tsp + 2 pinches + to taste`
- `Fresh coriander — 1 bunch + 1 handful + 1 tbsp`

The list says what the recipes say, in one place, and doesn't convert what it can't convert
honestly. The recipe names stay underneath as now.

- The **tick belongs to the row**, keyed by the ingredient's canonical name, not name + unit. A
  recipe edited from tbsp to g then keeps its tick. Today it would lose it.
- The **display name** comes from the dictionary (`Chilli flakes`). For an unknown item it's the
  most common spelling among its lines, never the folded key (`chilli flake`).

### 4.6 The scaling faults (question 6)

**Yes: fix them first and separately.** They put wrong numbers in front of the cook, which is worse
than any shopping-list untidiness. The fix is small and touches numbers only:

- `splitQty` learns mixed numbers, `½`-style fractions, ranges, "up to" and `N x`. For
  `3 x 125 g`, scaling changes the 3 and leaves the pack size.
- **Count words are not part of this change.** They're a shopping-list concern, and teaching them to
  `splitQty` would make scaling write "2 pinch salt".
- **Three lines of the "zest of 1/2 …" kind stay unscaled** until they're rewritten in the §4.2
  shape (`1/2 orange, zest only`). They're in the 144-line tidy, not the 24.

The effect on `splitQty`'s five consumers:

- **Flow table:** 7 lines move their split point, with the same characters on screen.
- **Scaling:** 6 lines become right.
- **Swaps:** unaffected, since matching is by substring on the rest of the line.
- **Shopping list:** 7 keys change from artefact to clean. None is ticked today.
- **CSV:** unchanged, because `tidyIngredientName` already strips those numbers.

### 4.7 Build Brief items this challenges

| Item | Brief says | This review |
| --- | --- | --- |
| SL1 | Standardise at conversion time | **Agree, and extend it from units to the whole line and the name** |
| SL2 | Prompt-and-remember | **Challenge.** Keep *remember*; replace *prompt* with the rules and dictionary plus strict inline suggestions |
| S3 | Aliases manager | Agree. Add "Merge with…" on the list itself |
| C5 | Consistent phrasing | Extend it to the line shape in §4.2 |
| C6 | Standardised units | Extend it to count units, solids by weight, and tins in grams |

---

## 5. Migration plan

**Before any data change**, take an export (sidebar → EXPORT DATA) and confirm the PrivateBackup
run. **Never delete a recipe to rewrite it**: `recipe_logs` cascades.

| Step | When | What | Safety |
| --- | --- | --- | --- |
| M1 | With recommendation 1 | Delete the inverted word match and the orphaned one, in Settings → Word Matches | Nothing is keyed on them |
| M2 | Recommendation 3 | Give the converter project `ingredient-names.md` and the new wording; run tests 1–7 | No app change |
| M3 | Release of recommendations 4–6, **on a Friday morning before shopping** | New keys take effect. The week just started has no ticks to lose, and past weeks' ticks don't matter | Worst case, one week's ticks: 9 today, 7 of which would survive by name anyway |
| M4 | Same release | Delete the 6 word matches the rules make redundant, and settle D4 and D5. Keep all "not the same" answers; the strict suggester would propose none of them | Verified: none is re-asked |
| M5 | After M2 | **Rewrite the 24 lines**, in place: `UPDATE recipes SET syntax = … WHERE id = …`, one recipe at a time. Two lines split into more lines *within the same group*, so group order and MERGE adjacency don't change | Before: validate with `validate-recipes.js` (parse, columns, timeline). After: md5 against the validated text and open each flow table |
| M6 | Optional, later | Bring the remaining ~120 non-conforming lines into the standard shape, by converter pass or reviewed batch, same method | As M5 |

- **The one recipe deliberately left unconverted** has 2 of the 24 lines. D6 asks whether its
  ingredient lines alone may be tidied.
- **Word matches store names**, and after M3 the stored names are the new canonical keys. One Word
  Matches screen serves both, since the dictionary is code and your matches are data.

---

## 6. Test plan

Every new check goes in `test/smoke.js` with made-up lines. **Each one names the mutation that must
turn it red, and is run once against that mutation before merging.** That's the practice the
2c/2d reviews established, and it's what stops checks that can't fail.

| # | Check | Mutation that must fail it |
| --- | --- | --- |
| 1 | `1 1/2 tsp` reads 1.5; ×2 gives `3 tsp` | Drop the mixed-number branch |
| 2 | `1½ tsp` reads 1.5 | Drop the attached-fraction branch |
| 3 | `2-3 tbsp` and `2–3 tbsp` scale to `4-6 tbsp`; the list buys 3 | Drop the range branch; use the lower figure |
| 4 | `3 x 400 g tins` scales to `6 x 400 g`; the list shows 1.2 kg | Scale the pack size instead |
| 5 | `up to 500 ml` scales | Drop the "up to" branch |
| 6 | The flow table shows `1 3/4 tbsp` whole in the quantity column | Revert `splitQty` |
| 7 | `4 cloves` (spice) and `3 garlic cloves` never share a row | Strip the last word |
| 8 | `2 cinnamon sticks` never joins `2 tsp ground cinnamon` | Generic trailing-unit rule |
| 9 | Never-merge pairs stay apart: ground/leaf coriander, spring onion/onion, red onion/onion, garlic salt/salt, celery salt/salt, double/single cream, plain/self-raising flour, olive oil/vegetable oil, light/dark soy, lemon/lemon juice, milk chocolate/milk, peanut butter/butter, cherry tomatoes/chopped tomatoes | Remove any word from the never-ignore list |
| 10 | `1 carrot, peeled and diced` + `2 carrots` → one row, 3 | Remove the dangling-"and" rule |
| 11 | `2 large eggs` + `1 egg` → one row, 3 | Remove "large" from descriptors |
| 12 | `pinch of nutmeg` carries 1 pinch | Remove the no-number count form |
| 13 | `1/4 tsp pepper` → black pepper; `1 red pepper` → red pepper, in Produce | Drop the spoon context rule |
| 14 | `1 tsp` + `1 tbsp` of one thing → `4 tsp`; + `10 ml` → `30 ml` | Keep spoons apart |
| 15 | `2 chicken breasts` + `400 g chicken breast` → one row `2 + 400 g` | Key by name + unit |
| 16 | A tick survives the recipe changing tbsp → g | Key ticks by name + unit |
| 17 | `buildShoppingList` stays free of side effects: no writes, no dialogs, with suggestions present | Put the prompt back in it |
| 18 | Opening the shopping list never calls `confirm()` | Restore the dialogs |
| 19 | The strict suggester proposes *curly parsley ~ parsley* and none of the brief's five false pairs | Revert to substring containment |
| 20 | "Chilli flakes" categorises as Spices after key folding | Categorise from the folded key |
| 21 | Aisle comes from the dictionary: `red pepper` → Produce | Remove the dictionary aisle |
| 22 | `converter/ingredient-names.md` matches the app's dictionary, lifted from `index.html` the way `image-integrity.js` lifts code | Edit one side only |
| 23 | An existing word match still applies after the change | Apply word matches before the new normaliser |
| 24 | `validate-recipes.js` warns on a two-ingredient line and on `3 x` | Remove the shape check |

**Plus a private library regression**, never committed: re-run this review's scoring against a fresh
export after each release. Expect 168 items (or more, as recipes are added), 0 false merges, and
Week A and B totals unchanged. It reads the export and the answer key from outside the repo, as
`validate-recipes.js` does.

---

## 7. Limits of this review

- **The answer key is one person's judgement.** Where you'd call it differently (butter vs unsalted,
  salt vs sea salt), the relevant decision below changes a handful of rows, not the conclusions.
- **The dictionary was written after seeing the library**, so 210 rows and 178 names are
  best-case. The growth figures in §4.1 are the realistic upkeep.
- **The converter wording is untested against the converter itself.** Tests 6 and 7 are how to test
  it, and should be run before M5.
- **The harness stubs Supabase**, as all the tests here do. Nothing in this review exercised
  sign-in, hydration or the write queue.
- **Week A and B are two weeks.** They are the two real weeks big enough to show anything.

---

## 8. Glossary of the numbers

| Term | Meaning |
| --- | --- |
| Row | One line on the shopping list: today, one per name + unit |
| Name | One per ingredient, when the list shows one row per ingredient (recommended) |
| Item | A distinct thing to buy, from the answer key: 168 in the library |
| Split | An item spread over two or more names |
| False merge | Two different items on one row. Always inspected by hand |
| Either way | A pair the answer key accepts merged or apart (butter/unsalted, salt/sea salt…) |

---

## 9. Decisions I need from you

Each has my recommendation. Say "as recommended" to take them all.

| | Decision | Recommendation |
| --- | --- | --- |
| **D1** | Adopt the approach: standard lines at conversion, rules and dictionary in the app, one row per ingredient, questions made rare | **Yes** |
| **D2** | Fix the quantity reader first, on its own | **Yes, now.** It's a cooking-accuracy fix |
| **D3** | Delete the inverted and orphaned word matches now, and the 6 redundant ones with the shopping-list release | **Yes** |
| **D4** | A line that gives a *cooked* weight of something you buy uncooked: rewrite it as the uncooked amount (the list then totals correctly), or keep the word match that adds cooked to uncooked | **Rewrite as the uncooked amount** |
| **D5** | Spoon-measured "pepper" and "pinch pepper" (both seasoning): you said "not the same" | **Treat as the same (black pepper).** Both lines are the seasoning |
| **D6** | May the unconverted recipe's ingredient lines (only) be tidied? 2 lines | **Yes**, lines only |
| **D7** | "Oil", "neutral oil", "vegetable oil", "sunflower oil" as one item; olive, sesame and coconut oil kept separate | **Yes** |
| **D8** | Keep apart, as today: butter vs unsalted butter, salt vs sea salt, caster vs golden caster | **Keep apart.** They're different on a shelf |
| **D9** | "Soy sauce" means light soy sauce | **Yes** |
| **D10** | Replace the `confirm()` questions with strict inline suggestions and a "Merge with…" action | **Yes** |
| **D11** | Ship the shopping-list release on a Friday morning, before shopping | **Yes** |
| **D12** | Full tidy of the remaining ~120 lines | **Later**, once the converter change has proved itself on new recipes |
