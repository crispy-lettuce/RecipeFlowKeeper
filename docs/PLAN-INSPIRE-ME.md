# Plan: INSPIRE ME, suggestions on the Planner

A working file with an end (`CLAUDE.md`, "How the documents are kept"): the PR that closes it updates `docs/SPEC.md` §5.5 and deletes this file.
Written 11 Nov 2026 from an interview with the household that day. **Slices 1 and 2 are built (the engine, then ONE MEAL and 3 OPTIONS on the Planner, app version 2026-11-11.1); A WEEK and shared ingredients are not.**

## 1. The ask

On the Planner, a way to be given ideas rather than to go looking: "a chicken meal I haven't cooked in a while", "three chicken options",
"a week with at least one fish, one chicken and one lamb". The working name was "lucky dip"; the button reads **INSPIRE ME**.

## 2. What was decided (11 Nov 2026)

| Question | Decision |
| --- | --- |
| How a recipe's main protein is known | Worked out from its ingredient lines; a protein keyword on the recipe wins. No protein field comes back, and no recipe text changes |
| "Popular" and "not in a while" | Favourites plus history. NEVER TRIED is its own choice, so recipes with no history do not swamp NOT LATELY |
| Where suggestions go | A preview on the Planner. Nothing is written until ADD |
| What a week fills | One Main per empty day; planned and AWAY days are left alone, and what is already planned counts towards the "at least" rules |
| Which week | THIS WEEK or NEXT WEEK, the shopping list's two weeks, from today onwards |
| How the request is made | Chips and steppers. No typed sentences, no AI, no new Edge Function |
| Filters | Protein (VEG is one of them), keywords, a time limit, LOW EFFORT, FREEZES WELL |
| Never suggested | A recipe already on the 14 days; one cooked in the last 14 days (unless POPULAR is chosen); one swapped away in this sitting |
| A week's spread | Not the same protein two days running; not two of one dish style in the week; a lean towards shared ingredients |
| Choosing among what fits | Weighted chance, leaning towards the popularity choice. ANOTHER gives a different answer |
| Where the button sits | The Planner's heading row, and each empty day beside CHOOSE A RECIPE |

## 3. What the code and the libraries say

Read on 11 Nov 2026 from `main` and, read-only and as counts, from the live database.

- **There is no protein field.** It was removed; Chicken, Beef, Fish and the rest are ordinary keywords (`index.html`, the comments at `DEFAULT_TAGS`
  and `MEAL_BASE_KEYWORDS`). Coverage differs a great deal between libraries, and the same idea is spelt more than one way (Veg, Vegetarian), which is
  why the ingredients decide and the keyword only overrides.
- **History is thin.** In the two large libraries nearly every Main has never been logged as cooked, and no Main has been logged three times. Favourites
  are few, and one library has none. POPULAR will offer little until that changes; the panel says how many recipes fit each choice so an empty one is
  plain before it is tapped.
- **Every Main but a handful has a `TIME:`**, most carry `, hands off` marks, and one library has a `FREEZING:` section on a good share of its Mains.
- **Reused as it stands:** `filterRecipes` and the keyword chips; `lastUsed`, `useCount`, `daysSince`; `parseMinutes` (now in `core.js`); `parseRecipe` and
  `computeTimeline` with `needsHands` (hands-on minutes); `shoppingLine` and `aisleFor` (naming an ingredient and its aisle, read-only);
  `dayList`, `startOfWeek`, `groupDaysByWeek`; `addPlanRecipe` (the one-row write CHOOSE A RECIPE already makes); SERVE WITH and OFTEN WITH, which
  appear by themselves once a dish is on a day.
- **No schema change, no Edge Function, no change to how ingredients are named.** Ticks are not re-keyed: the feature reads `shoppingLine`'s answer and
  changes no rule in it and no dictionary row.

## 4. What it does

### 4.1 The panel
**INSPIRE ME** in the heading opens a panel above the days; the one on an empty day opens it set to ONE MEAL for that day.

- **HOW MANY:** ONE MEAL · 3 OPTIONS · A WEEK (then THIS WEEK / NEXT WEEK).
- **PROTEIN:** chips for the proteins this library has at least one Main of, in a fixed order (CHICKEN, BEEF, LAMB, PORK, FISH, VEG, then any other; FISH is fish, prawns and all seafood).
  Several chips mean any of them. In A WEEK each chip becomes an **AT LEAST** stepper (0, 1, 2 …).
- **WHICH:** ANY · POPULAR · NOT LATELY · NEVER TRIED.
- **MORE:** a time limit (ANY, 30 MIN, 1 HOUR); LOW EFFORT; FREEZES WELL; the keyword chips, as on Recipes.
- Each choice shows how many recipes fit with the others as they are; one that would leave none is greyed, not hidden.
- The choices last while the tab is open; nothing is stored.

### 4.2 The suggestions
- **ONE MEAL:** one card (photo, title, time, protein, last cooked or NEVER COOKED) with **ADD**, **ANOTHER** and **OPEN**.
- **3 OPTIONS:** three cards, each with **ADD**; **ANOTHER 3** replaces them. From the heading, a card asks for a day (tap a day, as the shortlist does);
  each card also has **+** for the shortlist.
- **A WEEK:** a proposal on each empty day of the chosen week, drawn as a proposal and not as a plan. Each has **SWAP** (another that keeps the rules
  satisfied) and **×** (leave this day empty). **ADD ALL** writes them; **CANCEL** writes nothing. If the rules cannot all be met (three fish asked for,
  two in the library; or fewer empty days than the "at least" total) it fills what it can and says which rule is short.
- A dish goes on at the recipe's own servings, as CHOOSE A RECIPE does. ADD ALL is one write per day, with one **UNDO** that takes all of them off.
- Until ADD, the shopping list, the calendar and the sidebar's counts are untouched.

### 4.3 The rules, exactly
- **The pool** is the household's own recipes with `course=Main` (never a shared library's).
- **Main protein** (`mainProtein`, in `core.js`): a protein keyword on the recipe if it has one (`PROTEIN_FAMILIES` lists which keywords mean which
  family; of several, the one heaviest in the lines). Otherwise each ingredient line is named by `shoppingLine`, a line whose name holds a family's word
  is that family, counted pieces are weighed roughly ("3 chicken breasts"), and the family with the most weight wins. A recipe with none is VEG.
  Not the meat: a name with a word such as stock, sauce, fat, tomato or vegetarian in it, or a dictionary row filed outside Meat & Fish. An aisle
  reached by the keyword lists is not asked, because "tuna in olive oil" is Pantry by its oil. "Steak", "mince" and "meatballs" with no animal named are beef.
- **POPULAR:** a favourite, or in the top fifth by times cooked among recipes cooked at least twice.
  **NOT LATELY:** cooked at least once and not in the last 60 days. **NEVER TRIED:** no cooking logged. A PRE-MADE meal is not cooking (SPEC §6.12), so
  it counts for none of these; COOK AHEAD does.
- **LOW EFFORT:** hands-on minutes of 10 or less (the household's number, 11 Nov 2026; a device can set its own, slice 2), from the recipe's own timeline. A recipe with no hands-off mark is judged by its whole time.
- **FREEZES WELL:** the recipe has a `FREEZING:` section.
- **Weighting** (a recipe's share of the chance): ANY is 1 plus the days since cooked over 365, up to 2, and 1.5 for never cooked (level with half a
  year); POPULAR is 1 plus times cooked, plus 1 for a favourite; NOT LATELY is days since cooked over 60; NEVER TRIED is equal. Not tuned against a
  library: there is too little history in the two large ones to tune with.
- **A week** (`suggestWeek`): required proteins are placed first, then the rest; never the same protein on consecutive days (a planned neighbour counts); at
  most one of each dish style (`DISH_STYLES`, the meal-base keywords: Pasta, Rice, Curry, Traybake, Salad and so on). The spread gives way before a day is
  left empty: the style rule first, then the neighbour rule; a family that has run out is reported and its day given to anything that fits. Up to 40
  shuffles are tried and the one that bent fewest rules is kept. Slice 4 adds, among candidates that fit, a lean towards one that shares a Produce, Meat &
  Fish or Dairy & Eggs ingredient with the week so far: a tie-breaker, never a rule.
- Chance comes from a seed passed in, so a test can fix it.

## 5. Slices

Each is its own PR, with `changelog.json`, `help.html` and SPEC from the first one the household can see.

1. **The engine, in `core.js`, with no screen. Built 11 Nov 2026.** `mainProtein`, `handsOnMinutes`, `dishStyles`, `suggestionFacts` (one recipe's
   facts, worked out once), `suggestPool` (what fits an ask), `suggestMeals` and `suggestWeek`, pure and tested in `core.test.js`; `parseMinutes` moved
   to `core.js` for it. `tools/measure-suggestions.js` measures a library from an export kept outside the repo. See §5.1.
2. **ONE MEAL and 3 OPTIONS. Built 11 Nov 2026**, and described in `docs/SPEC.md` §5.5: the panel, INSPIRE ME in the heading and on each empty day, the cards
   with ADD, OPEN and + SHORTLIST, ANOTHER, and Settings → APP → LOW EFFORT MEANS (per device). Where it differs from §4 above: TIME, LOW EFFORT, FREEZES WELL and
   the keywords are folded behind MORE CHOICES, so the suggestions are not a screen below the chips; + SHORTLIST is on every card, not only in 3 OPTIONS; a
   suggestion says when it was last cooked; and ROLLS FORWARD DAILY gives way in the heading where the two buttons leave it no room (measured at eight widths in both looks: the heading is no taller than before at any of them). Awaits the household's
   tablet check, `docs/HOUSEHOLD-JOBS.md` Job 8.
3. **A WEEK.** Proposals on the days, AT LEAST steppers, SWAP, ADD ALL with its UNDO, the "cannot be met" message, and the spread rules except shared
   ingredients.
4. **Shared ingredients.** The lean in §4.3, last because it is the least certain to be worth its weight; if it is not, it becomes an issue and this
   plan closes without it.

### 5.1 What slice 1's measurement showed (11 Nov 2026)

Three libraries, read once from the live database into a session's scratch directory and measured with `tools/measure-suggestions.js`. The lists by title
went to the household in chat, not here.

- **Protein keywords cover far more than was thought.** Once Vegetarian, Prawns, Salmon, Bacon and the like are read as families, about nine Mains in ten
  are decided by a keyword. Where a recipe has one, the ingredient lines agree with it for all but a handful, which is the evidence that the lines can be
  trusted for the recipes with none.
- **Four misreadings were found and fixed before any check was written:** vegetarian sausages counted as pork; anchovy fillets weighed as fish fillets;
  burger buns read as beef; a tin of tuna "in olive oil" dropped as Pantry.
- **POPULAR and NOT LATELY are empty or nearly so in the two large libraries** (no Main cooked twice; few or no favourites). NEVER TRIED is almost the
  whole library there. The small test library, which has history, fills all four.
- **LOW EFFORT at 20 minutes filtered little, so it is 10:** of the Mains whose hands-on time can be told, about four in five are at or under it, and the median is
  10 to 12 minutes. Chopping is not a timed step, so hands-on minutes run low.
- **FREEZES WELL** is one library's feature: another has a single Main with a `FREEZING:` section.
- **Dish styles** come from keywords, and a quarter to a half of Mains carry none, so "one of each style" is a light rule.

## 6. Open, to settle while building

- The protein families as built: Chicken, Turkey, Duck, Beef, Lamb, Pork (sausages, bacon, ham, chorizo), Game, Fish (with prawns and all seafood, the
  household's decision on 11 Nov 2026), Veg; a chip is shown only for a family the library has.
- The nine Mains read as VEG for want of any keyword or meat line were shown to the household, which passed them (11 Nov 2026).
- 60 days and "top fifth" could not be judged: there is not the history yet. The household accepts that POPULAR and NOT LATELY offer little until
  there is (11 Nov 2026); the panel's counts are what make that plain.
- Hands-on minutes are known only for a recipe with a hands-off mark; one library has almost none marked, so LOW EFFORT there falls back to the whole time.
- Whether a week should ever propose a Side. Today it does not: SERVE WITH offers one once the Main is on the day.
- Whether the saved view "Not cooked in 3 months" (90 days) and NOT LATELY (60) should be one number.

## 7. What it must not do

- Write anything before ADD; route a write through anything but the one-row plan save; put a prompt or a write in `buildShoppingList()`.
- Change `shoppingLine` or a dictionary row.
- Suggest onto a past day, an AWAY day or a day that already has a dish.
- Send anything off the device.
