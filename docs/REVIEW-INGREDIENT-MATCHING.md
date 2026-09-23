# Ingredient matching — brief for a review session

**Written 22 Sep 2026**, to hand the shopping list's ingredient matching to a separate review.
Everything under "What already goes wrong" was verified by running the app's own functions on
example lines. **The example lines are made up, not taken from the household's library** — the
repo is public, and the library was not reachable when this was written. How often each fault
occurs in the real recipes is unmeasured, and measuring it is the first job.

---

## The ask

The shopping list's ingredient matching still does not feel slick. The household wants an
extensive review and ranked suggestions, answering three questions in particular:

1. **Can we deal with this differently?** Not just patch the current approach, if a different
   one is better.
2. **Could the recipe conversion stage help** — for example, a standard way of writing
   ingredient lines?
3. **Does it help to recognise more measurements** than the obvious ones — "pinch", "clove",
   "tin" — **and to ignore non-essential words** such as "large" in "large egg" or "minced"?

Try the ideas on the real ingredient lines, with the current rules, the current word matches and
hypothetical ones, and show the impact of each. **This is a review, not a build:** the deliverable
is a document with findings and recommendations. The household has said, in so many words, that
they want "a solid, tested plan before any implementation to avoid unintended consequences".

---

## Ground rules

From `CLAUDE.md`, which applies in full:

- **The repo is public.** Recipe, planner and diary data must never be committed to it. Keep any
  exported data, query output or working files in a scratch directory outside the repo. Examples
  in anything committed must be made up.
- **Verify rather than trust**, including this brief. It was checked against the code on 22 Sep;
  line numbers drift, so search by function name.
- Tests stub Supabase entirely. `node test/build.js && node test/smoke.js` (191 checks) — always
  both, because `smoke.js` loads what `build.js` wrote.
- British English, metric units.

---

## How matching works today

All in `index.html`. Search by function name.

| Step | Function | What it does |
| --- | --- | --- |
| 0 | *(outside the app)* | A claude.ai project converts a recipe into the app's text format, following `converter/conversion-instructions.md`. Its §1 "Extract" tells it to use only `g`, `kg`, `ml`, `L`, `tbsp`, `tsp`, `pinch`, `°C`, and says countable items ("2 eggs, 3 garlic cloves") are not units. |
| 1 | `parseRecipe` | Reads the text in `recipes.syntax`; each `GROUP` holds raw ingredient lines. |
| 2 | `splitQty(line)` | One regex splits off a leading quantity. Numbers, `¼½¾⅓⅔`, `.` and `/`, then optionally one of 13 unit spellings: `g kg ml l cup cups tsp tbsp teaspoon(s) tablespoon(s) oz lb`. |
| 3 | `parseIngredientAmount` → `normalizeUnit` → `toBaseUnit` | Quantity string to `{amount, unit}`; `kg→g` and `l→ml` only. |
| 4 | `normalizeIngredientName` | `stripPrepWords` with `AGGREGATION_PREP_WORDS` — `PREP_WORDS` minus `ground`, because ground coriander is seed and coriander is leaf. Also drops `(…)`, "cut into …" and commas. |
| 5 | `applyIngredientAlias` | Exact-string lookup in the `aliases` table (kind `ingredient`) — the household's "word matches". |
| 6 | `buildShoppingList` | Key = `name + '|' + baseUnit`. Lines with an identical key are totalled; the displayed name is the first line's raw text. |
| 7 | `findIngredientMatchSuggestions` → `findSimilarTerm` | Proposes "same ingredient?" pairs by **substring containment** — a function written for *source* names ("Kitchen Sanctuary" inside "Nicky's Kitchen Sanctuary"). |
| 8 | `promptIngredientMatches` | Browser `confirm()` dialogs, at most 3 per visit to the shopping list. Yes stores an alias; No stores an `ingredient_distinct` pair so it isn't asked again. |
| 9 | `categorizeIngredient` | Keyword lists in `SHOPPING_CATEGORIES`, checked in order. |

**`splitQty` has five consumers, not one:**

- the flow table's ingredient column (`buildRows`);
- scaling (`scaleRecipeSyntax`);
- swaps (`findSwapMatchesForRecipe`);
- the shopping list;
- the diary CSV (`diaryIngredientSummary`).

The CSV already has its own tidier, `tidyIngredientName` with `NAME_NOISE`, precisely because
`splitQty` couldn't be changed safely — read its comment.

---

## What already goes wrong

Each result below comes from calling the real functions in the built app. The lines are made up.

### Quantities — these also give wrong amounts while cooking

| Line | Today | Consequence |
| --- | --- | --- |
| `1½ tsp ground cumin` | read as **1** (`parseFraction` → `parseFloat("1½")`) | Doubled, it reads **2 tsp** — should be 3. The shopping list total is wrong too |
| `1 1/2 tsp ground cumin` | quantity `1`; name `1/2 tsp ground cumin` | Doubled, it reads **2 1/2 tsp** — should be 3 |
| `2-3 tbsp olive oil` | no quantity at all | Never scaled; never totalled; the numbers end up in the name |
| `500 grams plain flour`, `1 litre chicken stock` | quantity `500`, name `grams plain flour` | `normalizeUnit` maps `grams`/`litre`/`kilogram`, but `splitQty` never captures those words, so those mappings are unreachable |
| `2 x 400g tins chopped tomatoes` | amount **2**, name `x 400g tins tomatoes` | Meaningless total |
| `1 pinch salt` | name `pinch salt` | Although the converter is *told* to use `pinch` as a standard unit |

### Names that should meet and don't

| Lines | Keys produced |
| --- | --- |
| `1 clove garlic` / `2 cloves garlic, minced` / `3 garlic cloves` | `clove garlic`, `cloves garlic`, `garlic cloves` — three items |
| `1 egg` / `3 eggs, beaten` / `2 large eggs` | `egg`, `eggs`, `large eggs` — three items |
| `1 lemon, zested and juiced` | `lemon and` |
| `400g tin chopped tomatoes` | `tin tomatoes` |
| `1 tbsp olive oil` / `30ml olive oil` | Never totalled — no tsp = 5 ml, tbsp = 15 ml |
| `2 chicken breasts` / `400g chicken breast` | Count and mass can never total; how to *show* that is an open question |

### The "same ingredient?" suggestions

Substring containment proposes pairs that are **not the same ingredient**:

- `egg yolk` → `egg`
- `spring onions` → `onion`
- `chicken stock cube` → `chicken stock`
- `salt and pepper to taste` → `salt`
- `ground coriander` → `coriander` — the exact pair the code comments say must never be totalled

It also proposes pairs whose names are **parse artefacts**, such as `grams plain flour` →
`plain flour`, or `1/2 tsp ground cumin` → `ground cumin`. A "yes" then stores the artefact as a
permanent alias: it patches the symptom and leaves the cause.

A "yes" only merges names, because totals still need the same base unit. And the questions are
only ever asked while looking at the shopping list, three at a time, in browser dialogs.

### Categories

- `1 red pepper` lands in **Spices & Seasoning**, because the keyword `pepper` matches.

### One number already measured

**34 of the library's 424 quantity-bearing lines (8%)** start with a count, container or size
word after `splitQty` has run. That was measured on 22 Sep, per the `NAME_NOISE` comment.
Nothing else here has been measured against the real library.

---

## What makes changes expensive

Read these before recommending anything. Most of them are why the current code is conservative.

- **`shopping_checked.item_key` is the aggregation key string itself.** Any change to naming or
  units re-keys every tick. Past weeks' ticks don't matter, but the current week's would vanish
  unless migrated.
- **`aliases` stores normalised names.** Change the normalisation and existing word matches can
  stop matching anything. They would need re-mapping or re-deriving, and some may become
  unnecessary.
- **`splitQty` feeds five things**, including what is shown in the flow table while cooking and
  the arithmetic of scaling.
- **The recipe text is the source of truth** (`docs/ARCHITECTURE.md` §2). A new ingredient-line
  format means re-converting or migrating the library — 33 recipes as of 20 Sep. **One of
  them, Victoria Sandwich, was deliberately left unconverted** (`HANDOVER.md` §1, C3), so its
  lines need not follow the converter's rules; expect it to be an outlier.
  `docs/HANDOVER.md` §3 records how the last bulk change was done: rows updated in place, because
  **deleting a recipe cascades its cooking history** (`recipe_logs`).
- **No AI at runtime** — a deliberate rule, stated in the code comments on
  `parseIngredientAmount` and `buildShoppingList`. **The conversion step *is* an AI**, a claude.ai
  project. So the conversion stage is where judgement can live, and the app stays mechanical.
- **`buildShoppingList` must stay free of side effects** — it runs on every planner change.
- The Build Brief (`docs/BUILD-BRIEF.md`): **SL1** "standardise at conversion time"; **SL2**
  "prompt-and-remember"; **C5** consistent phrasing; **C6** standardised units; **S3** aliases
  manager. The review may challenge these, but should say so explicitly.

---

## Questions to answer

1. **Approach.** Candidate approaches include:
   - a converter-emitted structured line (quantity, unit, canonical name, prep note kept apart);
   - smarter parsing in the app;
   - a small curated dictionary of canonical ingredients;
   - keeping prompt-and-remember, with a better suggester.

   Recommend one, and say what each costs.
2. **Conversion stage.** Specify the exact ingredient-line format and the converter
   instructions to go with it. Cover how the existing library would be brought into line, and
   what `converter/test-set.md` should gain.
3. **Units and noise words:**
   - Which count and container words become units — pinch, clove, tin/can, bunch, handful,
     sprig, slice, rasher, stick, cube, knob, and others?
   - Should tsp and tbsp convert to ml for totalling?
   - Which descriptors to ignore — large, small, fresh, minced…
   - Which must **never** be ignored, because they change what you buy — ground; smoked;
     double vs single cream; plain vs self-raising flour; baby spinach; red onion vs onion?
4. **Suggestions.** Should "same ingredient?" exist at all? If so, how should it propose pairs
   without the false ones above, and where should it ask?
5. **Display.** When lines genuinely can't total (2 breasts + 400 g), what should the list show?
6. **The scaling faults.** They produce wrong quantities while cooking. Should they be fixed
   first and separately, whatever else is decided?

---

## Method

### Get the real data — into scratch, never into the repo

- **Supabase connector**, project ref `mhkayefzrtceesgizkjs`:
  ```sql
  select id, title, servings, syntax from recipes order by title;
  select kind, alias, canonical from aliases order by kind, alias;
  select week_start, count(*) from shopping_checked group by week_start order by week_start;
  select plan_date, recipe_ids, servings from planner_days order by plan_date;
  ```
  The connector has failed to connect in some sessions (`ERR_PROXY_TUNNEL`). If it does, say so
  rather than working round it.
- **Or ask for an export.** In the app: sidebar → **EXPORT DATA** gives a JSON file (version 3)
  with recipes, aliases, plan and ticks, which the household can upload to the chat.

### Measure with the app's own code

Measure with the app's own code, not a re-implementation of it. Build the test page, load it in
Playwright, and call the functions — they are page globals:

```js
// after: node test/build.js
const page = await (await chromium.launch()).newPage();
await page.goto('file://' + path.resolve('test/app-under-test.html'));
await page.waitForTimeout(1200);
const rows = await page.evaluate((lines) => lines.map(l => {
  const { qty, rest } = splitQty(l);
  const a = parseIngredientAmount(qty);
  const b = a ? toBaseUnit(a.amount, a.unit) : null;
  const name = applyIngredientAlias(normalizeIngredientName(rest));
  return { line: l, qty, key: name + '|' + (b ? b.unit : ''), amount: b && b.amount };
}), lines);
```

In this sandbox, Chromium lives at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`. Pass it as
`executablePath`; the test scripts read it from `PLAYWRIGHT_CHROMIUM`. The alternative is lifting
functions out of `index.html` the way `test/image-integrity.js` lifts the Edge Function checker.

### Then

1. **Baseline.** Collect every ingredient line in the library, with its current key.
   - Group the lines by key and count the distinct keys.
   - List the probable duplicates.
   - Count the lines hitting each fault class above.
   - Classify each existing word match: a real synonym, or a parse artefact?
2. **Hypotheses, one at a time and then combined.** Candidates:
   - quantity parsing fixed;
   - count/container units;
   - singular and plural treated alike;
   - descriptor stripping;
   - tsp/tbsp converted to ml;
   - a better suggester;
   - converter-canonical names.

   For each, report:
   - distinct keys before and after;
   - true merges gained;
   - **false merges gained**, each one inspected;
   - lines whose flow-table display or scaling changes;
   - word matches orphaned or made redundant;
   - ticks that would re-key.
3. **Real shopping lists.** Rebuild a few actual weeks from `planner_days`, before and after, side
   by side. That is what the household will judge it by.

---

## Deliverable

A review document containing:

- findings, with numbers from the real library;
- recommendations ranked by value against risk;
- the proposed converter wording and ingredient-line format;
- a migration plan covering recipes, word matches and ticks;
- a test plan, with each new check proven able to fail.

Then **stop for the household's decision** — no changes to `main`. Anything committed goes on the
session's own branch and contains no library data.

---

## References

| What | Where |
| --- | --- |
| The app — every function named above | `index.html` |
| Project rules and hazards | `CLAUDE.md` |
| Map of all documents | `docs/DOCUMENT-INDEX.md` |
| Recipe format; why the text is the source of truth | `docs/ARCHITECTURE.md` §2–§3 |
| Status of SL1/SL2; how the last bulk ingestion was done; corrections record | `docs/HANDOVER.md` §1, §3, §6 |
| Original requirements SL1, SL2, S3, C5, C6 | `docs/BUILD-BRIEF.md` |
| Converter instructions (§1 Extract sets the units) | `converter/conversion-instructions.md` |
| Converter regression set | `converter/test-set.md` |
| Existing tests for matching (search "SL2: ingredient name matching") | `test/smoke.js` |
| Test harness | `test/build.js`, `test/stub.js`, `test/README.md` |
| Tables | `recipes.syntax`, `aliases` (kind, alias, canonical), `shopping_checked` (week_start, item_key), `planner_days`, `ingredient_swaps` |

Repo: `github.com/crispy-lettuce/RecipeFlowKeeper` (public). Supabase project ref:
`mhkayefzrtceesgizkjs`. The live app is https://crispy-lettuce.github.io/RecipeFlowKeeper/,
deployed from `main` on every merge.

---

## The prompt that starts the session

Paste this into a new chat. It works in Claude Code with this repo attached, or in an ordinary
claude.ai chat, which can read the public raw files by URL.

```text
I'd like an extensive review of how my Kitchen recipe app matches ingredients on the shopping
list. It works, but it still doesn't feel slick.

Start by reading the brief, then CLAUDE.md, which applies in full. Both are on the branch
claude/recipe-app-supabase-0z139o (the brief may not be on main yet):
  https://raw.githubusercontent.com/crispy-lettuce/RecipeFlowKeeper/refs/heads/claude/recipe-app-supabase-0z139o/docs/REVIEW-INGREDIENT-MATCHING.md
  https://raw.githubusercontent.com/crispy-lettuce/RecipeFlowKeeper/refs/heads/claude/recipe-app-supabase-0z139o/CLAUDE.md
In a Claude Code session: git fetch origin claude/recipe-app-supabase-0z139o, then
git show FETCH_HEAD:docs/REVIEW-INGREDIENT-MATCHING.md
The repo is github.com/crispy-lettuce/RecipeFlowKeeper; the app is the single file index.html.

My questions:
1. Can we deal with this differently?
2. Is there anything at the recipe conversion stage that could help, e.g. a standard way of
   formatting ingredients?
3. Does it help to allow measurements beyond the obvious ones, e.g. "pinch", and to ignore
   non-essential information, e.g. "large" egg, "minced"?

Please review my current ingredients and play with different combinations to understand the
impact, both with my current word matches and hypothetical ones. Measure against my real
recipes, not assumptions: the Supabase project is mhkayefzrtceesgizkjs. If you can't reach it,
tell me and I'll upload an export from the app (sidebar, EXPORT DATA).

The repo is public, so never commit my recipe, plan or diary data. This is a review, not a
build: give me a document with findings, numbers and ranked recommendations, and stop for my
decision before changing anything. I'm happy to follow clear, guided recommendations.
```
