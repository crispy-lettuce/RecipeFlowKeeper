# Proposal: a review when a new recipe comes in

**Written 28 Sep 2026, not started.** Raised by the household while the aisle override
(`docs/PROPOSAL-AISLE-OVERRIDES.md`) was being written up. Each fix so far has been made after the
fact and on its own: an aisle here, a word match there, a duplicate spotted by eye. The best moment
to settle these things is the moment a recipe is added, while the person adding it is looking at
it and knows what they mean. This document holds the brainstorm, the pitfalls, and a phased
design. It was checked against the running code and the live library on 28 Sep. Nothing in it has
been agreed with the household beyond the idea itself, and nothing has been built.

## The idea

When a recipe is parsed in the Add/Edit form, the preview already shows whether each line has the
right shape and whether it matches the source. Add one more section: **what this recipe does to
the shopping list.** It would show:

- which of its ingredients are new to the library;
- where each new one will land, and whether that is **Other**;
- which new ones look like a name the library already uses;
- whether the recipe itself looks like one already saved.

Keep it quiet when there is nothing to say, never make it block a save, and let the household
answer in place, where an answer is needed at all.

The retrospective work is still needed, because the library already has 34 recipes. That work
does not recur, though. New recipes do.

## What a recipe brings with it

A recipe carries three kinds of household fact. Only the third is shared across recipes, and that
is the kind that goes wrong quietly.

| Level | Facts | Where it is set today | Checked when a recipe comes in? |
|---|---|---|---|
| **Recipe** | source spelling, `SOURCE_URL`, image, servings, course, keywords | the form | Yes, mostly. Servings and source are required. A new source spelling gets a `confirm()` at save. Keywords are suggested. The image is found and rehosted. **Duplicates: no check at all.** |
| **Line** | the line's shape; whether it matches the source's list | the recipe text | Yes, since 6c-1 and 7d: `ingredientLineFaults` and `sourceFidelity`. Both are advice and never a gate. |
| **Ingredient** | its name on the list (dictionary display spelling), its aisle, its word matches ("same" / "not the same"), its household swaps | `INGREDIENT_DICTIONARY` in `core.js` (by a PR); Settings → Word Matches; the shopping list's inline MERGE / KEEP APART and MERGE WITH…; Settings → Swaps; the aisle override (proposed) | **No**, except that swaps already show in the preview's substitution panel. Everything else surfaces later: on the shopping list, when a developer runs `tools/remeasure.js`, or when someone notices. |

Every ingredient-level fact is keyed by the **shopping-list name**, `shoppingKeyForName`. None is
keyed by the recipe. So each fact is answered once and applies to every recipe that uses the name.
That is why the first recipe to bring a name in is the right place to ask about it, and why one
wrong answer reaches every other recipe too.

## What already happens when a recipe comes in (checked in the code, 28 Sep)

- **Add/Edit form** (`index.html` ~1609–1656). Pasting into `#importInput` and parsing runs
  `parseAndPreview`, and `renderLineChecks` fills `#addChecks`. It can show three headings:
  - NOT READ, for lines the parser dropped;
  - THE SHOPPING LIST CAN'T TOTAL…, for `affectsList` faults, each with a suggested line;
  - AGAINST THE SOURCE, the `source-ingredients` function's comparison or 7d's paste box.
- **Save** (`index.html` ~6710–6780). This step requires a source and servings. If the source is
  new or has changed, it applies a settled source alias, or asks through `findSimilarTerm` and a
  `confirm()`. The answer is remembered either way: `source` or `source_distinct`. **This is the
  last `confirm()` in the add path.** D10 replaced the shopping list's equivalent dialogs because
  103 questions had been asked and 35 of them were wrong.
- **Nothing compares the recipe with the library.** The strict "same as…?" rule
  (`strictMatchSuggestions`, `core.js:1235`) runs only inside `buildShoppingList`. `renderShopping`
  shows a pair only when **both names are on this week's list** (`index.html` ~5199). A new
  recipe's near-duplicate name is therefore found only in a week when both recipes are planned
  together. MERGE WITH… (6d-1) searches the whole library, but only for someone who already
  suspects a pair.
- **The developer-side checks already compute most of this, out of sight.** For each recipe,
  `test/validate-recipes.js` (lines 174–205) reports:
  - **new names**: "new to ingredient-names.md";
  - **"totals on the shopping list as"**: a line whose list name differs from how it was written.

  Across the whole export, `tools/remeasure.js` reports rows, likely splits and **Other** rows.
  The household never sees either.

## The live library, measured for this (28 Sep, read-only)

- **34 recipes. 33 have a `SOURCE_URL`**, on 12 distinct sites. That makes the source link a
  strong duplicate signal.
- **Every one of the 30 images is self-hosted.** `rehost-images` rewrites `image_url` and the
  `IMAGE:` line to our own Storage, and the original web address is not kept anywhere. **An
  image-URL duplicate check would therefore never match**, even though an image URL settled an
  earlier duplicate question. Only the source link survives.
- The shopping list, with everything planned at once, comes to 169 rows (`NEXT-SESSION.md`,
  28 Sep).

## Design

### What the section shows

A new block in `#addChecks`, below AGAINST THE SOURCE, headed **ON THE SHOPPING LIST**. The example
below is made up, with a hypothetical library that already has jackfruit in it:

```
ON THE SHOPPING LIST
11 of 13 ingredients are already on your list.
  Young jackfruit   → Other    Same as Jackfruit?  SAME · KEEP APART
  Sumac             → Other    new to your list
ALREADY IN YOUR LIBRARY?
  "Lemon Tart" has the same source link (example.com/recipes/lemon-tart).  OPEN IT
```

- **Quiet by default.** A recipe whose ingredients are all known gets the one summary line, and
  nothing else. A known name has been through before, so it has nothing to ask.
- **Only names new to the library get a row.** Each row shows the name as the list will print it
  and the aisle it will land in. The row is marked **Other** when it lands there.
- **"Same as…?"** comes from the **same strict rule** the list uses, run with the new names on one
  side and the whole library's names on the other. It reuses the never-merge list and the
  dictionary guard. The rule was measured with no wrong answers, so it inherits that record rather
  than starting a new one.
- **Duplicate check on the source link only.** The link is normalised: scheme, `www.`, trailing
  slash, query string and fragment are dropped. It is compared with every other recipe's link. A
  similar title is at most a quiet hint. Two recipes can share a title and be different recipes,
  and titles have misled before.
- **On edit,** the recipe being edited is left out of "the library". Without that, every name
  would be "already known" because of itself, and every recipe a duplicate of itself.

### Where the code goes

- **`core.js`:** one pure function, for example
  `newRecipeReview(recipeItems, libraryItems, { alias, isSettled })`. It aggregates both sides
  with `aggregateShoppingLines`, which is how the list names and files them. It returns:
  - the known and new names;
  - the aisle of each new name;
  - strict pairs where exactly one side is new;
  - source-link matches.

  It shares code with `validate-recipes.js` and `remeasure.js`, as `ingredientLineFaults` did in
  6c-1, so the preview and the developer tools cannot drift apart. A `core.js` change means the
  version bump in all three places.
- **`index.html`:** call it from `renderLineChecks` with the cache's recipes, then render the
  block. Nothing is fetched. It works offline because the cache is all it reads.

## Phases

Each phase is its own small PR, and each is useful without the next.

| Phase | What | Writes? | Schema? |
|---|---|---|---|
| **A** | The section, read-only. The summary line, new names with their list name and aisle, "same as…?" pairs as text, source-link duplicates with OPEN IT. `validate-recipes.js` switches to the shared function. | No | No |
| **B** | Answers in place. SAME and KEEP APART write through the existing `addAlias` (`ingredient` / `ingredient_distinct`), exactly as the shopping list's buttons do, and are reversible in Settings → Word Matches. | Yes, existing `aliases` table | No |
| **C** | For a new name that lands in Other, an aisle pick in the row. It writes an aisle override. | Yes | **Yes**: needs `docs/PROPOSAL-AISLE-OVERRIDES.md` built first |
| **D** *(optional)* | A LIBRARY CHECK in Settings that runs the same review over every recipe. It covers the 34 already in, answered at the household's pace. | As B and C | No more than C |

Phase A alone would have shown "Sirloin steak → Other" the day the first recipe using it was added.

## Pitfalls, and how the design answers each

1. **Nagging (D10 again).** A review that asks about everything gets ignored, and some answers
   will be wrong. Only new names get a row, only the strict rule proposes pairs, and there is
   never a dialog. If Phase A shows noise on real recipes, fix the rule before Phase B lets anyone
   answer it.
2. **It must never block a save.** It follows the preview's own rule: advice only. A recipe with
   three unanswered questions saves exactly as it does today.
3. **The direction of a merge can re-key the household's ticks.** *(A new point.)* The shopping
   list's buttons fold the rarer name into the commoner one. On a tie they keep the plainer name
   (`core.js:1262–1266`). At ingest, the new name has a count of 1. If it is the plainer of the two, and
   the library's name is used only once, the list's own rule would fold the **library's** name into
   the new one, and every tick stored under the library's name would be orphaned. At ingest the
   direction must be fixed: **the new name folds into the existing one, always.** It will not have
   been planned yet, so it has no ticks to lose.
4. **Image URLs cannot find duplicates.** *(A new point, from the measurement above.)* Every
   stored image is rehosted, so the web address pasted with a new recipe never matches. Keeping
   the original URL would be a schema change for little gain, since 33 of 34 recipes have a source
   link.
5. **URL normalisation cuts both ways.** Dropping the query string merges `?utm_source=…`
   variants, which is right. It would also merge two recipes on a site that puts the recipe's ID
   in the query string. Show the match as "same source link?" with OPEN IT, never as fact, and
   check the 12 sites' URL shapes before building.
6. **Never offer to delete the other recipe.** `recipe_logs` cascades, so a delete would destroy
   that recipe's cooking history, and nothing merges logs from one recipe into another. The only
   actions are OPEN IT (look, then abandon this add or edit the existing one in place) and saving
   anyway (it is a variant). Nothing is offered that deletes.
7. **A re-parse must not lose answers or state.** Parsing rebuilds `#addChecks`. Phase B answers
   are written the moment they are tapped, so a re-parse just re-runs the review, and settled pairs
   drop out through `isSettled`. Any typed-but-unsent input follows 7d's `pastedSourceText`
   pattern: a module-level variable that `renderLineChecks` restores.
8. **The preview can go stale before save.** If the recipe text is edited after PARSE, the section
   describes the old text. This is the same weakness the line checks have today. Either re-run the
   review at save and note any new names quietly, or mark the section stale when the textarea
   changes. Decide in Phase A; do not add a dialog.
9. **Answers are household-wide.** A SAME tapped while adding one recipe changes the list for
   every recipe that uses either name. It is also written straight away, even if the recipe is
   then abandoned. Both are fine, since Settings → Word Matches can undo them, but the row should
   say so in a word. It matters more once a second family member can add recipes
   (`docs/ONBOARDING.md`).
10. **Tablet slips.** 6d-1 added a confirm step after a stray tap on MERGE WITH… on the tablet.
    SAME in the preview is the same kind of write and needs the same guard, done inline and not
    as a dialog.
11. **Paths that bypass the form.** `importAllData` (a whole-library restore), developer SQL batch
    ingests and md5-guarded rewrites never pass through the preview. Keep `remeasure.js` as the
    backstop. Sharing the function means it reports exactly what the preview would have shown.
12. **What the strict rule cannot see.** Two names for one thing that share no word are never
    proposed. Since 7f the dictionary folds 49 US names into their UK product, so those arrive
    already known, but any pair it doesn't list (a regional name, a brand) still won't be proposed.
    Showing new names is the catch-all.
    Whoever is adding the recipe can see "Sumac: new to your list" and use MERGE WITH… if they
    know better. Don't loosen the rule to find these; that is how 35 of 103 went wrong.
13. **Aisle answers depend on word matches.** An aisle override applies to the key after word
    matches. If a new name is about to be merged, its aisle comes from the name it joins. So the
    row asks SAME first and offers the aisle pick only while the name is still new. That matches
    the aisle proposal's "independent, one job each" choice.
14. **Not a wizard.** Adding a recipe is a paste and a PARSE today. A step-by-step flow would slow
    every add down to serve the occasional one that needs it. This is one section in the preview
    already on screen.
15. **Cost.** Phase A compares about a dozen new names with about 170 library names on each
    parse. That is trivial on the tablet, and the library is already parsed for MERGE WITH….

## Open decisions for the household

1. **Is Phase A wanted on its own first?** Recommended. It is read-only, needs no schema change,
   and shows whether the section is useful or noisy before anything can be answered from it.
2. **On a likely duplicate: OPEN IT only, or also a SAVE AS A VARIANT that notes it?** OPEN IT
   alone is recommended. Nothing should suggest deleting.
3. **Show the section on edit too, or only on add?** Recommended: on edit as well for new names,
   because an edit can bring one in. The duplicate check runs on edit only when the source link
   has changed.
4. **Should the source-spelling `confirm()` at save move into this section?** It is the last
   dialog in the add path. Moving it would change *when* it is asked (at parse, not at save), so
   this is the household's call, not a tidy-up to slip in.
5. **Is Phase D (a library check in Settings) wanted?** Or are the shopping list's inline
   suggestions, MERGE WITH… and a developer's `remeasure.js` run enough for the 34 recipes already
   in?

## What this document does not cover

- **The aisle override itself.** It is designed in `docs/PROPOSAL-AISLE-OVERRIDES.md`, and
  Phase C depends on it.
- **Dictionary rows.** A display spelling or an aisle that is wrong for everyone is still a
  `core.js` change and a PR. It re-keys ticks when it renames, so the library has to be re-measured
  first (CLAUDE.md).
- **Recipe text.** Changing existing recipes' lines in the live database follows CLAUDE.md's
  md5-guarded procedure, not anything here.
