# Handover for review: a recipe whose ingredients are not its source's

*Written 29 Sep 2026 for a review session (Opus), and for the household to pick up at the start of
it. Read `CLAUDE.md` first: its first three sections apply in full. This file is about one finding,
and it ends with the three decisions still open from the last PR, written out in full (section 7).*

**In one paragraph.** The household compared **No-Bake Chocolate Oat Bars** against the ingredient
list on its source page, and found that the recipe in the library is **not the source's recipe**:
three of the source's ingredients are missing, two the source does not have are there, and a product
has been changed. The comparison tool is working correctly; it is reporting a real problem. The
recipe's own text says why: the converter could not read the page and "reconstructed" the recipe from
another version of it. That was noted in `docs/HANDOVER.md` on 20 Sep as "worth a glance". It was
worse than a glance, nothing has ever checked it, and a second recipe has the same shape. The
question for the review is **how a recipe with different ingredients came to be produced, accepted
and put in the library, whether it is one recipe or more, and what should stop it happening again.**

---

## 1. What the household saw

On 29 Sep the household opened the recipe's edit form, pasted the ingredient list from the
Allrecipes page into the COMPARE WITH SOURCE box, and pressed COMPARE PASTED LIST. The page said
**"6 to look at, highlighted"**, plus one shaded row. Their words: *"I'm really confused how we have
ended up with the ingredients we have. New ones added, others omitted. This is very concerning."*

What the table showed, by count (the lines themselves are left out of this file on purpose, see
"Not in this file" below):

| Row | How many | What it means |
| --- | --- | --- |
| In the source's list only | **3** | A fat, a sugar and a flavouring the source uses; the recipe has none of them |
| In the recipe only | **2** | A cocoa product and a liquid sweetener the source does not list |
| Paired, but different | **1** | Chocolate chips: the recipe names one kind (milk); the source names another (semisweet). Highlighted as a hard difference |
| Paired, shaded | **1** | Peanut butter: the recipe adds a word ("smooth"). A soft note, not a fault |
| Paired, quiet | **1** | Oats: quick-cooking in the source, rolled/old-fashioned in the recipe. The dictionary calls them one product |

The pasted list has **six** ingredients. Of the six, one matches, one is a shaded refinement, one is
a different product, and three are absent. The recipe has five ingredient lines. Amounts were not
compared: the source is in cups and the recipe in grams, and the check never warns across those.

**Not in this file.** The real ingredient lines, on either side, are recipe data, and this repo is
public (`CLAUDE.md`, "Ground rules"). Get them from the household's screenshot, from the live
`recipes` row titled *No-Bake Chocolate Oat Bars*, and from a fresh paste of the source page.

## 2. What I verified, and how

Everything here was checked on 29 Sep. "Library" means the export read from the live database at
about 05:24 UTC, read-only, kept in a scratch directory outside the repo.

1. **The comparison tool is right.** Each of the six differences is a kind the check exists to
   raise, and the table matches what the check does with those inputs. It is not misreading a
   translation: none of the differences is a US word for a British one. *Not verified:* what the
   source page really says. Allrecipes refuses this environment, so the household's paste is the
   only evidence, and I have not confirmed that it came from the recipe's own address
   (`allrecipes.com/recipe/10602/no-bake-chocolate-oat-bars/`).
2. **The recipe says so itself.** It ends with a converter-written **"⚠️ Source note"**: the
   Allrecipes page "is blocked for direct fetching", so "this conversion is reconstructed from a
   secondary reproduction of the same recipe rather than a direct read of the original page", and it
   is "worth a quick check against the original if precision matters". The app files that note under
   the **VARIATIONS** heading (the parser gives trailing text to the last notes section; how the
   viewer draws it I read from the code and have not seen in the browser). So the household cooks
   from a recipe whose only warning sits among the variations.
3. **"The same recipe" is not what the household's paste shows.** The note calls it a reproduction of
   the same recipe. Five of six ingredients differ. Either the "secondary reproduction" was a
   different recipe, or the model that wrote the conversion did not have a faithful copy of any
   page. I cannot tell which from here; §3 says what would.
4. **It was recorded, and understated.** `docs/HANDOVER.md` §3 (written 20 Sep) says: *"Two
   conversions carry a ⚠️ Source note in their own syntax … Both are worth a glance against the
   original page before cooking from them."* Nobody compared ingredient lists, because nothing could:
   the source check did not exist until PR 6c-1 (27 Sep).
5. **A second recipe has the same shape.** *Lasagne Loaded Fries* (PoppyCooks): its note says the
   site returned an access error and that the conversion "uses the same recipe as reproduced on
   McCain's site (a branded partner version using McCain products)". A branded partner version is
   not the original. It has not been compared. A third recipe, *Cacao & Almond Oat Bar*, carries a
   note of a different kind (two inconsistencies on the source page itself), which is honest, not a
   substitution.
6. **The converter's instructions do not cover this case.** `converter/conversion-instructions.md`
   says what to do with an unreadable *photo* ("do NOT guess … flag it or ask", lines 11–18) and says
   every ingredient name is "the source's product … never swapped for a similar product" (line 275).
   It says **nothing about a URL that cannot be read**: there is no "stop, say so, and ask for the
   text". Its sister prompt, `converter/ingredient-extraction-prompt.md`, does say "Never
   reconstruct a recipe from memory" (line 99). The rule exists for one prompt and not the other.
7. **Ingestion checked shape, not content.** `test/validate-recipes.js` checks that each ingredient
   line is in the standard shape and that names are listed; it **never calls `sourceFidelity`** (a
   correction already recorded on 28 Sep). A batch of recipes has never been compared with its sources
   before going in.
8. **How much of the library is uncompared.** 34 recipes: Kitchen Sanctuary 17, BBC Good Food 6,
   PoppyCooks 2, and one each from nine other sites; *Victoria Sandwich* has no source address.
   Three carry a ⚠️ note. The `source-ingredients` Edge Function is refused by Kitchen Sanctuary and
   Allrecipes (as recorded on 28 Sep; not re-tested today), so **18 recipes can only be compared by
   pasting**. As far as this record shows, one real comparison had been done before this one (Tuscan
   Chicken Pasta, Kitchen Sanctuary): it turned up a difference in a repeated pinch line, and the
   household has not said how that was resolved. So of 34 recipes, **1 is known to differ from its
   source, 1 more is known to come from a stand-in source, 1 was compared and showed a difference
   whose outcome is not recorded, and 31 have never been compared**: not known to be fine.

## 3. What is not known

These are the open questions, mostly for the household to answer:

- **What the "secondary reproduction" was**, and how the converter chose it. The conversion
  conversation may still exist in the household's conversion project: it is the best evidence.
- **Whether the household's paste is the page at the recipe's address.** Open that address in a
  browser and read the list.
- **Whether this recipe was cooked**, and whether the household noticed a difference. The cooking
  history (`recipe_logs`) has not been read.
- **How many others.** Nothing can say without comparing each one. Any unnoted conversion could have
  the same fault: a note appears only where the converter chose to write one.
- **Whether the converter wrote the note because it noticed, or was made to.** If it writes one
  only sometimes, the notes undercount.

## 4. What the review is asked to do

In this order. None of it needs a production write; the recipe repair in step 5 does, and follows
`CLAUDE.md`'s "Changing recipe text in the live database" to the letter, with the household present.

1. **Reproduce it with the household.** Open the recipe, open the source page in the household's
   browser, paste the list, compare. Write down, without recipe lines in the repo, what differs.
2. **Find the cause.** Get the conversion conversation. Read it against
   `converter/conversion-instructions.md`. Decide whether this is a gap in the instructions, the
   model doing something the instructions already forbid (line 275: never swap a product), or both.
3. **Scope it.** Propose an audit of the 34, riskiest first: the two with notes; the 17 Kitchen
   Sanctuary recipes (paste box); the other 15 (the function, where it works). Keep the results table
   in `PrivateBackup`, not here. Decide how the household can do 31 more comparisons without it being
   a chore: a per-recipe checklist, or a small helper that lists which recipes have been compared.
4. **Propose prevention**, each small, each its own PR:
   - a rule in the converter's instructions: *if the page cannot be read, stop, say so, ask for the
     ingredient list pasted, and never use another page or a reproduction*;
   - `validate-recipes.js` to run `sourceFidelity` when it has a source list, so a batch is checked
     before it goes in (the 28 Sep correction, not yet built);
   - a visible marker in the app for a recipe whose text carries a "Source note", so it is seen when
     cooking, not filed under Variations;
   - refusing to ingest a recipe whose text says it was reconstructed.

   Read `docs/PROPOSAL-NEW-RECIPE-REVIEW.md` first (merged 29 Sep, written by another session, not yet
   agreed or built). It designs a review section in the add form's preview for what a new recipe does
   to the shopping list, and its Phase D is a library check in Settings that would run the same review
   over the 34 recipes already in. It does **not** cover this finding (it is about ingredient names,
   aisles and duplicates, not whether the recipe matches its source), but it is the natural home for a
   "compared with the source: yes or no" line and a "this recipe carries a source note" marker, and the
   natural home for the audit in step 3. Extend it rather than build a second review.
5. **Repair this recipe only with the household's decision.** The options are to re-convert it from
   the real page (the household pastes the list and method), or to leave it and mark it. **Never
   delete and re-insert**: cooking history cascades. The safe route is an in-place `UPDATE`, one
   statement guarded by the md5 of the old and the new text, first recipe alone, backup in
   `PrivateBackup`. That is the worked procedure in `CLAUDE.md`; follow it.
6. **Do not** merge, deploy Edge Functions, commit recipe data, or change recipe text outside that
   procedure. The household merges.

## 5. Ground rules for that session (from `CLAUDE.md`)

- `main` is production; every merge deploys to the tablet. Work on a branch, open a PR when tested.
- Before pushing: `node test/core.test.js`, then `node test/build.js && node test/smoke.js`, and read
  the exit codes (`echo $?`), not the number of `ok` lines. Bump `KITCHEN_CORE_VERSION` in all three
  places if `core.js` changes. Make every new check fail once. Take dates from `date -u`. Read
  `git diff origin/main` for private data.
- To read the library: the Supabase `execute_sql` query in `test/README.md` ("Re-measuring the live
  library"), unwrapped into a scratch directory, then `node tools/remeasure.js`. `remeasure.js`
  refuses a file inside the repo. **The library is read-only for a review session.**
- "Done" means seen: the database row, the log line or the green CI run. Write "not verified" where
  you could not check.

## 6. Where things stand

- `main` is `db1a06b` (PR #38, merged 29 Sep 05:52 UTC). `core.js` is `2026-09-29.1`. Suites on that
  commit: `core.test.js` 109, `smoke.js` 280, `source-ingredients.js` 12, all green locally; on the
  merge commit GitHub's tests run (72) and the Pages deploy (54) both succeeded, read on 29 Sep. The
  live app itself I have not opened.
- The dictionary now has 139 rows, by one rule: one product on the shelf under two names, never a
  substitute (`tools/ingredient-names-preamble.md`). That is why this recipe's *chocolate chips* row is
  a hard difference and not a quiet one: milk and semisweet are two products.
- `docs/PROPOSAL-NEW-RECIPE-REVIEW.md` and `docs/PROPOSAL-AISLE-OVERRIDES.md` are written up and not
  started. The first is relevant to step 4 above.
- The household's own pass on the last PR (`docs/TEST-PLAN.md` steps 36b, 36c) has not been reported.
  This finding came from a comparison on a US-source recipe, which is the pass the plan asks for.
- Two things the last PR said and this session corrected are in `docs/HANDOVER.md` §6.

## 7. The three decisions, in full

These are open from PR #38. **They are the household's to make and they are independent of the
finding above**, except that the finding is a reason to keep the source check strict (see the note on
decision 1). Each says the question, what is true today, what each answer does, the risk, and what I
recommend. Nothing in the app changes until an answer is given.

### Decision 1. Should any of the 15 pairs still flagged count as "the same product"?

**The question.** After PR #38, 15 of the 67 US→UK pairs I used to measure the check still flag when
one side is written with the US name and the other with the British. For each I ask: is it a real
difference the check should keep raising, or one product under two names that the dictionary should
learn?

**What "yes, they are the same" does.** I add the US name as a spelling of the British row (or a
new row). Two effects: the source check goes **quiet** on that pair, so a converter swapping one for
the other is no longer noticed; and the **shopping list totals them as one row**. Tick boxes are keyed
by name, so any tick stored under either name would re-key. I checked the library on 29 Sep: **none of
these names occurs in it**, so no tick is at stake today. It is a dictionary change, so I re-measure
before shipping and you merge.

**The 15, by what they really are:**

| # | Pair (US → UK) | What they are | My view |
| --- | --- | --- | --- |
| 1 | half-and-half → single cream | Half-and-half is milk and cream, about 10–18% fat, sold only in the US. Single cream is about 18%. Close, but a substitute, not a name | **Keep flagged** |
| 2 | granulated sugar → caster sugar | The UK sells granulated sugar too. Caster is finer. Writing one for the other is a substitution | **Keep flagged** |
| 3 | molasses → black treacle | Similar, not identical: molasses comes in light, dark and blackstrap | **Keep flagged** |
| 4 | light corn syrup → golden syrup | Different sweeteners with different flavours | **Keep flagged** |
| 5 | collard greens → spring greens | Related leaves, not the same vegetable | **Keep flagged** |
| 6 | jalapeño → green chilli | A specific chilli against a generic one | **Keep flagged** |
| 7 | graham crackers → digestive biscuits | A common substitute, a different product | **Keep flagged** |
| 8 | pie crust → shortcrust pastry | Similar, made differently | **Keep flagged** |
| 9 | raisins → sultanas | The UK sells both; they are different dried grapes | **Keep flagged** |
| 10 | endive → chicory | Notoriously reversed across the Atlantic: what the US calls endive the UK may call chicory, or endive itself. `belgian endive → chicory` is already a row | **Keep flagged** |
| 11 | shortening → vegetable shortening | The same product; the recipe only says which kind. A US recipe's "shortening" is always the vegetable kind | **Could be added.** Low risk |
| 12 | frisée → curly endive | Frisée is curly endive: one product, two names | **Could be added.** Low risk |
| 13 | cookies → biscuits | The US cookie is the UK sweet biscuit, but a US "biscuit" is a scone, and it is rarely an ingredient | Optional; I would leave it |
| 14 | candy → sweets | A naming difference, but not an ingredient anyone lists | Optional; I would leave it |
| 15 | canned tomatoes → tinned tomatoes | The same product; only the adjective differs | **Decision 3 covers it** |

**Recommendation.** Keep 1–10 flagged. Add 11 and 12 if you like (say so and I add them, re-measure,
and open a PR); 13 and 14 make no practical difference. Leave 15 to decision 3.

**A note in light of the oat bars.** Nine of these are substitutions, which is exactly the fault the
converter is told never to make and the check exists to catch. Making the check quiet on them would
let the same kind of change pass unnoticed. I would not relax any of 1–10.

**What I need from you:** "keep all", or a list of numbers to treat as the same.

### Decision 2. Fix the `a big handful of …` reading in `shoppingLine`?

**The question.** A small change to how the shopping list reads a line, which would also stop the
source check calling one US phrasing a difference.

**What is true today.** An amount can be written with an article and a size word before the unit:
*"a big handful of arugula"*, *"a small bunch of parsley"*, *"a large pinch of salt"*, *"one big
handful arugula"*. `shoppingLine` takes the article off only when the unit follows it directly. So it
drops the size word and leaves the article behind, and the name becomes *"a handful of arugula"*.
The dictionary is then asked about that phrase, which it does not know, so the row is never found and
no amount is read. Measured on 29 Sep:

| Line | Today's key | Today's reading |
| --- | --- | --- |
| a handful of arugula | `rocket` | 1 handful (correct) |
| a big handful of arugula | `a handful of arugula` | no amount, no row |
| a small bunch of parsley | `a bunch of parsley` | no amount, no row |
| a large pinch of salt | `a pinch of salt` | no amount, no row |

**Where it shows.** In the source check: the converter test set's US-source test (test 8) still has
**2 hard differences**, both from this line, which is also why one of my checks is written to pin it
as "the one known gap". On the shopping list it would show as a stray row of its own. The converter
is told to write *"1 handful …"*, so lines in the library do not have this shape.

**The change.** In `shoppingLine`, when there is no amount and the first word is an article, skip any
size words after it, and if what follows is a unit word (`handful`, `bunch`, `pinch`, `knob`…), take
the article and the size word off and read an amount of 1:

```js
if(amount === null && /^(a|an|one)$/.test(words[0] || '')){
  let k = 1; while(k < words.length - 1 && DESCRIPTOR_WORDS.has(words[k])) k++;
  if(COUNT_UNITS[words[k]]){ amount = 1; words = words.slice(k); }
}
```

**Measured, on a copy in scratch, after the PR merged.** On the live library (34 recipes, 466 lines):
**0 lines change key, and 0 lines have this shape at all**; 169 rows before and after; no row changes
name, amount or aisle. With the change, test 6 and test 8 both come out with **0 hard differences**.

**A correction to my own PR.** PR #38 said this change "re-keys nothing in the library (measured)".
When I wrote that I had **not** measured it; I did so afterwards, and the answer happens to be the one
I claimed. The claim was ahead of the evidence, and `docs/HANDOVER.md` §6 now says so.

**Risk.** It is a change to how ingredients are named, so `CLAUDE.md` says to re-measure first and ask.
A future line of this shape would move from a meaningless key to a real one; a tick stored under the
meaningless key would be lost, and none exists. Small: about 5 lines of code, one check that pins the
gap becomes a check that the gap is closed, two or three new checks, a mutation test each, and a
version bump (`core.js` changes).

**Recommendation.** **Yes.** It corrects a real misreading, it is measured to touch nothing you have,
and it makes the converter test set's US-source test fully quiet.

**What I need from you:** "yes" or "no".

### Decision 3. Treat `canned` and `tinned` as the same word in the source check?

**The question.** In the UK a tin, in the US a can. "canned tomatoes" and "tinned tomatoes" are one
product, but the dictionary cannot say so without listing every ingredient twice.

**What is true today.** They flag as a difference whenever the adjective is written on **both** sides
with different words:

| Source | Recipe | Result today |
| --- | --- | --- |
| canned tomatoes | tinned tomatoes | **flagged** (a false alarm) |
| canned coconut milk | tinned coconut milk | **flagged** |
| canned tuna | tinned tuna | **flagged** |
| canned coconut milk | coconut milk | quiet (the recipe says less) |
| canned chickpeas | tinned chickpeas | quiet (there is a `chickpeas` row that lists both) |

So the fault appears only when a converter *writes* "tinned" as an adjective. The converter is told to
put the tin in brackets instead, as in *"400 ml coconut milk (1 tin)"*, so it should be rare.

**The change.** In `fidelityItems` (`core.js`), replace the whole word `tinned` with `canned` in the
text of a line before its key and words are worked out, on both sides. It is used only by the source
check. **`shoppingLine` is not touched, so no shopping-list key changes and no tick is affected.**
About 10 lines with checks.

**A variant, not proposed.** The same fold inside `shoppingLine` would also make the shopping list
total "tinned X" and "canned X" as one row. The direction would matter: your library already has two
lines written with "canned", so folding *tinned into canned* leaves their keys
unchanged, while folding the other way would re-key both ticks. It is a naming change, so it would
need a fresh measure and your go-ahead, for a benefit the list does not yet need.

**Risk.** "tinned" only ever means "canned", so I see no way for the fold to hide a real difference.
It applies wherever the word appears in a name, which is right either way.

**Recommendation.** **Yes, in the source check only.**

**What I need from you:** "yes", "no", or "yes, and in the shopping list too".

### The step that is not a decision

`docs/TEST-PLAN.md` steps **36b and 36c** are your pass on the last PR: compare a recipe from a US
site, note every row that still flags and whether it is a real swap, a substitute left apart on
purpose, or a name the dictionary has not heard of; then plan every recipe and check the shopping
list still has **169 rows**, your ticks intact, and only *Mangetout* and *Pak choi* moved to Produce.
The oat-bars comparison you just ran is that step for one recipe.

---

## 8. A prompt to start the review with

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper. main is production; work on a new branch and
open a pull request when the work is tested.

Read these first, in this order: docs/HANDOVER-CONVERSION-INTEGRITY.md (this is
the task), CLAUDE.md (applies in full, especially the first three sections),
docs/DOCUMENT-INDEX.md, docs/HANDOVER.md §3 and §6, converter/conversion-
instructions.md.

THE TASK: a recipe in my library, No-Bake Chocolate Oat Bars, has different
ingredients from its source page. The recipe's own text says it was
"reconstructed from a secondary reproduction". Review how that happened, whether
other recipes are affected, and what should stop it happening again, following
section 4 of the handover. Start by taking my answers to the three decisions in
section 7, which I will give you. Do not merge, change recipe text in the live
database outside the procedure in CLAUDE.md, deploy Edge Functions, or commit
any recipe data. Don't trust status notes, mine included, where you can check
the real thing.
```
