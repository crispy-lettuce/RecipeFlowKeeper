# Plan: adding a recipe as one flow, from pasted conversion to saved recipe

**Written 29 Sep 2026** (date from `date -u`), in a planning session that changed no code. Checked
against `main` at `55cd5a6` (PR #39) and the live database, read-only, the same day. The household
answered the questions in §4 during the session, so this document is a set of decisions, not a
proposal. **Nothing in it has been built.**

**Who this is for.** An implementation session, probably on a less capable model, taking one PR at a
time. Each PR entry in §8 is written to be self-contained: what to change, where, the exact rule,
the numbers to expect, the checks to add and the mutation that must make each fail. §11 says when to
stop and hand back. If anything here disagrees with the code, the code wins and the disagreement is
reported (§11, trigger 4), not worked around.

**How to read it.** Every claim is labelled. **Fact** means read in the code or measured against the
live library on 29 Sep. **Assumption** means a reading of the household's intent that they have not
confirmed in those words. **Recommendation** means a choice this document makes and the household can
overrule. Where the household has already decided, §4 says so and the decision is not reopened.

---

## 0. In one paragraph

Today a recipe reaches the library through five separate things: a converter chat, a paste into
"Add a recipe", a form, a review that exists only as a proposal, and the dictionary, swaps and word
matches managed in four other places. The plan makes the paste-to-save journey one page with five
bands in reading order, where every change the app proposes is shown with its reason before it
applies and can be undone; runs the source comparison by itself wherever it can and records the
result on the recipe, so a recipe that was never compared says so; lets the household settle a new
ingredient's name and aisle at the moment it first arrives, from a form rather than a code change;
and gives Settings one place to look up what the app knows about any ingredient and why. It is eight
small PRs, each one behaviour, in a fixed order.

---

## 1. The tests the flow must pass

The household's five requirements, turned into checks that can be applied to each screen:

1. **Every automated change is shown before it is applied, with its reason, and can be undone.**
   Check: for every row in §7's table, "shown where" and "undone where" are both filled in.
2. **No black-box actions.** Check: for any ingredient, Settings can say what the list calls it,
   which aisle it lands in and why, and which household facts touch it (§6).
3. **Managing dictionaries, swaps and merges is understandable without reading code or docs.**
   Check: each household fact has one home in Settings that names it in plain words and offers the
   undo; the dictionary is readable there too.
4. **A recipe from a source the app has never seen needs no code change.** Check: its new names get
   a name (word match), an aisle (override) and a source check from forms. **Fact:** the one thing
   that stays a code change is a dictionary *display spelling*; §6 says why that is acceptable.
5. **Someone adding their first recipe can complete the flow without instruction.** Check: the page
   explains itself in its bands; a typed recipe has a template; nothing is hidden behind a button
   the person has to know about.

---

## 2. The journey today, as a first-time user

Read from the code on 29 Sep: the modal markup (`index.html:1609–1660`), `openAddModal` (5937),
`parseAndPreview` (6481), `renderLineChecks` (6532), the save handler (6706–6800), the word-match
code (2795–2861), swaps matching (5012), the shopping list's suggestion gate (5199).

| Step | What happens | Data changed | Checked | Gap |
| --- | --- | --- | --- | --- |
| 1. Open "Add a recipe" | Subtitle: "Paste the syntax from your recipe-conversion chat…". Textarea placeholder is the only format hint. Form hidden until PARSE. **Fact** | — | — | No route for a typed recipe; assumes the chat exists |
| 2. PARSE & PREVIEW | Eight header fields copied into the form (source URL only if the text has one); an unknown course added to the select; keywords joined. **Fact** | Form fields | `parsed.unread` | No listener on the textarea: an edit after PARSE leaves checks and diagram stale until PARSE again. **Fact** |
| 3. Checks box | NOT READ; THE SHOPPING LIST CAN'T TOTAL (five `affectsList` codes; USE THIS rewrites one line and re-parses); AGAINST THE SOURCE with two routes (function needs an https URL and is refused by the sites behind 18 of 34 recipes; paste box). **Fact** | Textarea (USE THIS) | Line shape; source, on request | Nothing stored: the comparison dies with the form. No undo for USE THIS. Not run unless pressed |
| 4. Fields | SOURCE and SERVINGS required; TIME, IMAGE, SOURCE URL, EQUIPMENT; SCALE TO SERVE rewrites every quantity (persistent equipment warning); COURSE; KEYWORDS with suggestions from the existing vocabulary. Diagram preview is below all of this. **Fact** | Textarea (scale) | Two required fields | The diagram, which says what the recipe means, is last on the page |
| 5. SAVE | Guards; a remembered source spelling applied silently, or `findSimilarTerm` → `confirm()` that writes a word match or a "not the same" row at once; header lines rewritten into the text; blank title → "Untitled recipe"; new keywords merged into the household vocabulary; one-row upsert; image re-host queued; modal closes. **Fact** | Text, `aliases`, `keywords`, `recipes`, later `image_url` + `IMAGE:` line | Source, servings | The last dialog in the app; three silent writes (spelling, vocabulary, re-host); no duplicate check; nothing reads the converter's own source note; no record of any comparison |
| 6. Afterwards | Matches are offered only when both names are on one week's list; aisles are silent (dictionary row, keyword fallback, or Other); word matches have three entry points with three rules; swaps are a separate view whose subtitle still describes the substring match 6d-2 replaced (`index.html:1473–1478` against `5012`); the dictionary is a PR. **Fact** | — | — | Five words for two ideas (word match, alias, swap, merge, same as) |

**Relation to the conversion-integrity finding** (`docs/HANDOVER-CONVERSION-INTEGRITY.md`). The flow
has no step where "does this match its source?" is required, recorded or remembered. Provenance is
`SOURCE_URL` and free text under a notes heading. `test/validate-recipes.js` has no reference to
`sourceFidelity` (**Fact**, grep on 29 Sep), so a batch is never compared either. Of the handover's
four preventions: the converter rule is PR 2; the batch check is in PR 3; the visible marker is PR 5;
the "refuse to ingest" was considered and the household decided against any gate (§4, decision 6).

**A typed personal recipe** arrives in a different shape (**Fact**, converter instructions): `SOURCE:
Personal recipe`, no `SOURCE_URL`, no `IMAGE`. So it can have no source check and no photo, and the
flow must say so rather than show an empty SOURCE section. It may also arrive with no converter at
all, typed straight into the box; the template in §5 covers that.

---

## 3. Where today's rules fit today's recipes

**Measured 29 Sep against the live library**, read-only, the export kept in scratch and never
committed. Counts only.

| Measure | Value |
| --- | --- |
| Recipes · ingredient lines · shopping rows · rows in Other · likely splits | 34 · 466 · 169 · 32 · 0 (matches `NEXT-SESSION.md`) |
| Lines whose name the dictionary knows | 371 of 466 (80%) |
| Dictionary rows hit by the library · never hit | 86 · 53 of 139 |
| The dominant source (17 recipes, 300 lines) | 86% known, 2% in Other |
| Every other source (11 sources, 166 lines) | 40–75% known, 14–38% in Other, one 8-line exception at 100% |
| Distinct keys used by exactly one recipe | 95 of 173 (55%) |
| 24 invented lines from cuisines the library does not cover | 3 known to the dictionary, 14 land in Other |

**Facts from the code:**

- The first 90 dictionary rows came from the library itself (78 from ingredients shared by two or
  more library recipes, 12 from one survey); the 49 US rows came from glossaries
  (`tools/ingredient-names-preamble.md`).
- `categorizeIngredient`'s keyword lists (`core.js:717–729`) have no word for leek, kale, squash,
  avocado, steak, duck, mackerel, lentil or tofu; the three `AISLE_FIRST` rules each came from one
  row seen on 25 Sep.
- `COUNT_UNITS` lacks bulb, block, nest and ear, so "1 bulb fennel" keys as `bulb fennel` and
  "1 block firm tofu" as `block firm tofu`, each its own row. `TRAILING_COUNT` covers garlic and
  celery only. `LEFTOVER_PREP` is the ingredient review's table, the library again.
- `strictMatchSuggestions` (`core.js:1235`) proposes only two names sharing their last word and
  differing by exactly one word; and `renderShopping` (`index.html:5199`) shows a pair only when
  both are on that week's list.
- The source check's false alarms are proportional to the dictionary's gaps: 58% of 67 US→UK pairs
  before the 7f rows, 22–37% after (`HANDOVER.md` §7, 7f). Whole against ground is not caught.
- `ingredientLineFaults` has a five-code `affectsList` set and a three-form `PRODUCT_FORM`
  whitelist; a new shape passes silently rather than nags, the right failure but still a gap.

**What this means (Assumption, from the numbers).** Coverage tracks source concentration. A recipe
from a new site will land a quarter to a third of its lines in Other and give each unknown name its
own row, and the strict rule will find only one-word-apart pairs among them. The two things that let
the household fix such a case themselves, an aisle they can set and a match they can make at
ingest, do not exist yet. That is what PRs 3, 4 and 6 build. Growing the dictionary stays the survey
tool's job and is not on this plan's path.

---

## 4. Decisions already made by the household (29 Sep 2026)

These are settled. Do not reopen them in an implementation session.

1. **The 15 US→UK pairs still flagged by the source check stay flagged.** No dictionary change.
2. **The `a big handful of …` reading is fixed** in `shoppingLine` (PR 1).
3. **`tinned` is folded into `canned`** in the source check **and** in the shopping list (PR 1).
   **Fact, measured 29 Sep, ingredient lines only:** 2 lines in 2 recipes say "canned" (as the
   handover's decision 3 says), 1 line in 1 recipe says "tinned", 0 ticks are stored. (Counting
   every line of the text, notes and method included, gives 3 and 3; that count was written into
   the session's chat first and is wrong for this purpose.) Folding tinned → canned changes the key
   of the one "tinned" line and leaves the "canned" lines as they are. That is the direction.
4. **One form, bands in reading order.** Not a wizard.
5. **The review may write three kinds of household fact:** aisle overrides (a new table), a
   provenance record per recipe (a new column), and it may run over the whole library from Settings.
6. **No hard refusal.** First chosen, then withdrawn in the same session: *"lets forget about the
   hard refusal. Going forward we will have the enforced check point so that any mis-match will be
   seen and the opportunity to correct it identified."* **Assumption about "enforced check point":**
   the SOURCE section is always present, runs by itself wherever it can, shows a loud row when the
   text carries a reconstruction note, and its outcome ("not compared" included) is written on the
   recipe and shown in the viewer. Nothing blocks a save. If the household meant something stronger
   (a save that needs a comparison to have run), that is a decision for §10, not something to build.

---

## 5. The target flow: one form, five bands

The Add and Edit modal stays one modal (`#addModalOverlay`) and keeps every existing element id, so
the smoke suite's selectors keep working. What changes is the order of what is inside `#addForm`,
and what each band says. New ids are given here so code and tests agree.

### Band 1 — PASTE

- `#importInput` and `#parseBtn` as today.
- **Parse on paste.** A `paste` event on the textarea runs `parseAndPreview` on the next tick.
  Nothing else auto-parses.
- **A stale marker, never silent staleness.** After any parse, an `input` event on the textarea
  shows `#staleBar` at the top of the bands: *"The text changed since it was checked."* with a
  **RE-CHECK** button that runs `parseAndPreview`. The bands below get class `stale` (dimmed). A
  parse clears both.
- **WRITE ONE BY HAND** (`#handTemplateBtn`), a link under the textarea. When the box is empty it
  fills it with the template below and parses; when the box is not empty it does nothing but show
  the toast *"Clear the box first"*. The band text beside it: *"From your conversion chat, or write
  one by hand. A recipe of your own has no source page, so it gets no source check and no photo
  unless you add a link."*

```
TITLE: My recipe
SOURCE: Personal recipe
SERVINGS: 4
TAGS: course=Main

GROUP base:
2 onions, sliced
1 tbsp rapeseed oil

GROUP finish:
1 lemon, juiced

STAGE:
MERGE base -> cooked: soften the onions [10 min]

STAGE:
MERGE cooked, finish -> dish: stir in the lemon and serve [instant]
```

  The template's lines are placeholders to replace; the parser has no comment syntax, so they must
  be real lines. **Recommendation:** keep the template this small.

### Band 2 — WHAT THE APP READ (`#addRead`)

- `#addReadSummary`: one line, *"Smoky Aubergine Traybake · Example Kitchen · serves 4 · 9
  ingredients · 5 steps"*, from the parse.
- `#addPreview`: the flow diagram, moved here from the bottom of the form. Same `mountFlow` call.
- `#addUnread`: the NOT READ block as today, only when there is something in it.

### Band 3 — CHECKS (`#addChecks`)

Four sections in a fixed order. Each is one quiet line when there is nothing to say. Every row that
proposes a change reads the same way: **the line as read → what will happen → why, in words →
the buttons**, and the words *"for every recipe"* wherever the answer is household-wide.

**LINES** (`#reviewLines`). As today (`ingredientLineFaults`, `affectsList` only, USE THIS), plus
**UNDO** after a USE THIS (PR 4) which restores the exact line and re-parses. Quiet line: *"Every
ingredient line is in a shape the shopping list can total."*

**SOURCE** (`#reviewSource`, keeping the existing `#sourceCheck` id on its inner box).
- Runs by itself when `#f-source-url` starts with `https://` and that URL has not been checked
  since the form opened (`lastCheckedUrl`, a module-level variable cleared on close). A URL that
  changes is checked again. A refused or failed fetch shows today's message and the paste box.
- On Edit, when the stored `source_check` (PR 5) has a `linesHash` equal to the current lines',
  it does **not** run again: it shows the stored result (*"Compared 29 Sep · no differences"*) and
  a **RE-CHECK** button.
- The paste box and COMPARE PASTED LIST as today. The pasted text is never stored; only the counts
  are (PR 5).
- A **SOURCE NOTE** row (PR 3) whenever `sourceNoteIn(text)` finds one (rule in §8, PR 3): the
  converter's line quoted, and, when it carries a reconstruction word, in the `unread` (red) style:
  *"This recipe was not read from its own page. Compare it with the real page before saving, or
  re-convert it from the page's text."* Advice, never a gate.
- With no https URL: *"No source page to compare with."* (personal recipes), or *"Add the SOURCE
  URL to compare with the page."*

**SHOPPING LIST** (`#reviewList`), the review proposal's Phase A–C, built as PR 3 (read-only),
PR 4 (answers) and PR 6 (aisles):
- Quiet line: *"11 of 13 ingredients are already on your list."*
- One row per name new to the library: the name as the list will print it, the aisle it lands in
  (**Other** marked), and:
  - **"Same as *Jackfruit*?"** with **SAME · KEEP APART** when the strict rule pairs it with an
    existing library name (PR 4). SAME first shows, inline, *"Total 'young jackfruit' with
    'jackfruit', for every recipe? MERGE · CANCEL"* (the same guard MERGE WITH… has). The new name
    always folds into the existing one.
  - An aisle `<select>` (the five `INGREDIENT_AISLES`) when the name lands in Other and has no
    pending "Same as" (PR 6). Picking one writes an override at once and shows *"Moved to Produce
    · UNDO"*.
- On Edit, the recipe being edited is left out of "the library".

**ALREADY IN YOUR LIBRARY?** (`#reviewDuplicate`). *"'Lemon Tart' has the same source link."* with
**SHOW IT**, which expands the row to that recipe's title, source, date added and ingredient
lines, inline, no navigation. URL match only (rule in §8, PR 3); on Edit only when the URL
differs from the stored one. Quiet: nothing shown. Never offers to delete anything.

### Band 4 — DETAILS

The fields as today, same ids, plus one row under SOURCE (`#sourceSpellRow`, PR 4), shown at parse
time and re-evaluated on `change` of `#f-source`:
- when a settled spelling applies (`applySourceAlias`), the field is set and the row says *"Source
  recorded as 'Example Kitchen', a spelling you settled before (Settings → Word Matches)"*;
- when `findSimilarTerm` finds a match that is not settled either way: *"Looks like 'Kitchen
  Sanctuary' (17 recipes). USE THAT · KEEP MINE"*. Each button writes exactly what today's
  `confirm()` writes, at the tap. Left unanswered, SAVE uses the typed spelling and writes nothing,
  so it is asked again next time.
- The `confirm()` in the save handler is removed (PR 4). No dialog remains in the add path.

### Band 5 — BEFORE YOU SAVE (`#addBeforeSave`, PR 4; provenance line PR 5)

A short list, recomputed on every parse and on any `input`/`change` inside `#addForm` (debounced
150 ms), of exactly what SAVE will do. Only lines that apply are shown:

- *"Rewrites the TITLE: and SERVINGS: lines to match the fields above"* (compare
  `withUpdatedHeaderLines(text, fields)` with the text, line by line, and name the header keys
  that differ).
- *"Copies the photo into your own storage after saving"* (image URL present and not ours).
- *"Adds to your keywords: one pan, slow"* (keywords not in `fullKeywordVocab`).
- *"Records: compared with the source today, no differences"* / *"…3 differences"* / *"not compared
  with its source"* / *"compared, but the ingredients changed since"* (PR 5).
- On Edit: *"Resets the ticks on this recipe's diagram."*

Then `#saveBtn`. Never disabled by any check.

### The viewer (PR 5)

A chip beside the source link, from `source_check` and `sourceNoteIn`: **COMPARED 29 SEP · NO
DIFFERENCES** / **COMPARED 29 SEP · 3 DIFFERENCES** / **COMPARED BEFORE THE INGREDIENTS CHANGED** /
**NOT COMPARED WITH ITS SOURCE**, and **CARRIES A SOURCE NOTE** when the text has one. Viewer only;
not on the cards (**Recommendation:** cards stay uncluttered; the library check is the overview).

---

## 6. Managing what the app knows: Settings

**Facts kept from `docs/PROPOSAL-AISLE-OVERRIDES.md`:** the aisle override is its own small Settings
block, not folded into Word Matches, and independent of them (merge first, then one aisle for the
merged name). Both were settled with the household on 28 Sep and are not reopened.

New in Settings (PR 7), above the WORD MATCHES block:

- **INGREDIENT LOOKUP** (`#ingredientLookup`, output `#ingredientLookupOut`). Type a name as a
  recipe would write it. On each keystroke it shows, read-only:
  - *"The list calls it: **chopped tomatoes**"* (dictionary row) or *"…**bulb fennel**, your own
    wording"* (no row);
  - *"Aisle: Pantry, from the dictionary"* / *"…from a keyword rule"* / *"…your override"* /
    *"Other: nothing places it. Set an aisle below."*;
  - *"Word matches: 'young jackfruit' means 'jackfruit'"* with FORGET beside it, or none;
  - *"Swaps: brown rice syrup → maple syrup (1 : 0.75)"* with EDIT (goes to Swaps), or none.
  The aisle reason comes from a new `aisleWhy` field on `aggregateShoppingLines` items
  (`'dictionary' | 'keyword' | 'override' | 'none'`; `'override'` arrives with PR 6).
- **DICTIONARY** (`#dictionaryList`): the 139 rows, grouped by aisle, each row its name and its
  live wordings, filtered by the same lookup box. Read-only, with one line: *"Changing a row is a
  code change; ask for it in a session."* **Fact:** that is the one thing on the "no code change"
  test (§1.4) that stays code. **Recommendation:** accept it, because a display spelling affects
  every household's list and a wrong one re-keys ticks; a word match and an override cover
  everything a new source needs.
- **SHOPPING AISLES**: the block as designed in the aisle proposal (PR 6).
- **WORD MATCHES**: unchanged.
- **Swaps**: the view stays where it is (option A). Its subtitle is corrected (PR 7) to: *"Your own
  ingredient substitutions, built up over time. Each carries a scaling ratio. A swap applies
  wherever the shopping list would call an ingredient by the swap's name, so 'butter' never
  catches 'peanut butter'."* Option B (Swaps moves into Settings under the lookup) is drawn in the
  mockup for comparison and is **not** in this plan; §10.

---

## 7. Every data change, and where it is shown and undone

| Change | Made by | Shown before it applies | Undone where | PR |
| --- | --- | --- | --- | --- |
| One ingredient line rewritten | USE THIS | The suggestion beside the line | UNDO in the row | today / 4 |
| Every quantity scaled | SCALE TO SERVE | Re-parse + persistent warning | UNDO SCALE (restores the pre-scale text) | today / 4 |
| Source spelling replaced | settled alias, or USE THAT | The row under SOURCE | Settings → Word Matches, FORGET | today (dialog) / 4 |
| "Not the same source" remembered | KEEP MINE | The row | Settings → Word Matches, ASK AGAIN | today / 4 |
| Header lines rewritten into the text | SAVE | BEFORE YOU SAVE | Edit the text | today / 4 |
| Keywords added to the vocabulary | SAVE | BEFORE YOU SAVE | Settings → Keywords, delete | today / 4 |
| Photo copied to our storage, IMAGE: line rewritten | after SAVE | BEFORE YOU SAVE | Change the image URL and save | today / 4 |
| Two names totalled as one | SAME | The row, then MERGE · CANCEL | Settings → Word Matches, FORGET | 4 |
| Two names kept apart | KEEP APART | The row | Settings → Word Matches, ASK AGAIN | 4 |
| An aisle set for a name | The row's select, or Settings | The row; "Moved to … · UNDO" | UNDO, or Settings → Shopping Aisles, REMOVE | 6 |
| Comparison recorded on the recipe | SAVE, after a comparison | BEFORE YOU SAVE | RE-CHECK and save again | 5 |
| Ticks on the diagram reset | SAVE CHANGES | BEFORE YOU SAVE | — (session-only ticks) | today / 4 |

Every write goes through the function that already writes that kind: `addAlias`, `removeAlias`,
`saveRecipe`, `mergeKeywordVocab`, `rehostImageFor`, and `addAisleOverride` (PR 6). No new write
path. `buildShoppingList` is not touched by anything here.

---

## 8. The PRs

**Order and dependencies.** PR 1 and PR 2 first, independent of each other and of the rest. Then
3 → 4 → 5 in order. PR 6 after 3 (it adds the review's aisle pick) and before 7. PR 7 after 6.
PR 8 after 5 and 6. One behaviour per PR; a smaller PR is always fine.

**Before every PR, in this order** (`CLAUDE.md`, first section, applies in full):

1. `git fetch origin main`; branch from `origin/main`.
2. Run `node test/core.test.js`, then `node test/build.js && node test/smoke.js`, and read `echo $?`
   after each. Write the counts down. On 29 Sep they were **109** and **280**; if the exit code is
   not 0 before you change anything, stop (§11).
3. Read the PR's entry below, then the functions it names, in the code. If a name is not there,
   stop (§11).
4. Make the change. Add the checks. Break each one on purpose, see it fail **by name**, restore the
   code (`git diff` shows only your intended change).
5. If `core.js` changed, bump `KITCHEN_CORE_VERSION`, `core.js?v=` and `EXPECTED_CORE_VERSION`
   together (today's date plus `.1`, or the next number).
6. If the PR changes how ingredients are named (PR 1 only), re-measure on `main` and on the branch
   per `test/README.md` "Re-measuring the live library" and put both results in the PR.
7. `git diff origin/main` read for private data. Dates from `date -u`.
8. Open the PR with what was verified and how, and what was not. **The household merges.** Never
   merge, never deploy an Edge Function, never write recipe text.

### PR 1 — Two naming fixes in `core.js` (decisions 2 and 3)

**Scope.** (a) In `shoppingLine`, when there is no amount and the first word is an article, skip
size words and read a count unit after them: the exact snippet is in
`docs/HANDOVER-CONVERSION-INTEGRITY.md` §7, decision 2. (b) One helper,
`const foldTin = s => s.replace(/\btinned\b/g, 'canned');`, applied in **three** places: at the top
of `dictionaryKey` (before `squash`), in `shoppingLine` on `text` right after it is lowercased, and
in `fidelityItems` on each line before its key and words are worked out. **Fact:** the chickpeas row
lists `tinned chickpeas` as a live wording, so the fold must reach `dictionaryKey` too, or a
dictionary phrase and a recipe line could stop meeting.

**Files.** `core.js`, `test/core.test.js`, `index.html` (version stamp only),
`converter/ingredient-names.md` only if the generator's output changes (it should not; run
`node tools/generate-ingredient-names.js --check`).

**Expected numbers.** Re-measure on `main`: 34 recipes, 466 lines, 169 rows, 32 Other, 0 splits.
On the branch: the **only** line that changes key is an ingredient line containing the word
"tinned" (1 line in 1 recipe on 29 Sep); rows 169 or fewer; nothing else changes name, amount or
aisle; 0 ticks stored (`select count(*) from shopping_checked` must be re-read on the day).
Anything else: stop.

**Checks to add** (names to use; each mutation-tested): `a big handful of X reads as 1 handful of
X`; `a small bunch of X reads as 1 bunch`; `a large pinch of X reads as 1 pinch`; `the check that
pinned the handful gap now expects it closed` (rewrite the existing pin); `tinned X and canned X
total as one row`; `tinned X in a line meets a dictionary row written canned X`; `tinned in the
source against canned in the recipe is quiet`; `tinned against canned in the shopping key`; and the
converter test set's test 8 recorded output now gives 0 hard differences.
**Mutations.** Remove the size-word skip → the three handful checks fail. Remove the fold from
`shoppingLine` → the row check fails. Remove it from `dictionaryKey` → the dictionary-row check
fails. Remove it from `fidelityItems` → the source check fails.

**Risk.** Low. It is a naming change, so it ships only after the household has seen the two
measures. **Recommendation:** any day is fine (one line, no ticks), but if the household prefers
the Friday-morning rule for naming changes, wait for one.

### PR 2 — The converter's rule for a page it cannot read (docs only)

**Scope.** In `converter/conversion-instructions.md` §1 Extract, after the photo bullet, add:

> - If the source is a URL and the page cannot be read (blocked, an access error, a login wall,
>   anything but the page itself): **stop**. Say which address failed and ask for the recipe's text
>   or its ingredient list to be pasted. Never convert from another page that seems to carry the
>   same recipe, a partner's or branded version, a search snippet, or memory: a recipe reconstructed
>   that way is not the source's recipe, and nothing downstream can tell. If a conversion has to say
>   anything about its source, write it as its own line beginning `⚠️ Source note:` under NOTES, and
>   say plainly what was not read.

In §3 Check add: *"The page itself was read; nothing was reconstructed from another page or from
memory."* In `converter/test-set.md` add test 9, "A page that cannot be read": the source is a URL
the converter cannot fetch; must produce a question, not a recipe; fails if any recipe syntax is
produced. Add a revision note dated from `date -u`. `docs/DOCUMENT-INDEX.md`'s converter entry gains
one sentence.

**Household's part (not verifiable from a session):** reload the file into the conversion project.

**Checks.** `node test/core.test.js` (it checks the generated dictionary even for a docs change).
**Risk.** None to the app.

### PR 3 — The review band, read-only

**Scope.** Bands 2 and 3 of §5 without any write: the form reordered (diagram up, ids kept), parse on
paste, the stale bar, the LINES section as today, the SOURCE section running by itself, the SOURCE
NOTE row, the SHOPPING LIST section showing new names and aisles and "Same as X?" **as text only**
(the buttons come in PR 4), the duplicate check with SHOW IT, and the WRITE ONE BY HAND template.
No write, no schema, no Edge Function change.

**`core.js` additions (pure, exported, tested in Node):**

- `sourceNoteIn(text)` → `null`, or `{ line, reconstructed, why }`. `line` is the first line
  matching `/^\s*(⚠️\s*)?source note\b/i` (**Fact:** both live notes are one line each, begin with
  the glyph and carry their reconstruction words on that line). `reconstructed` is true when that
  same line matches
  `/\b(reconstruct\w*|reproduction|reproduced|from memory|could\s?n[o'’]?t\s+(be\s+)?(fetch|read|access)\w*|blocked for|access error|partner version|branded version)\b/i`.
  A note without those words (the third library recipe's note about inconsistencies on its page)
  is `reconstructed: false` and shows as a plain SOURCE NOTE row.
- `normalisedSourceUrl(url)` → lowercase; strip `^https?://`; strip `^www\.`; cut at the first `?`
  or `#`; strip trailing `/`; return `''` unless the result contains a `.`.
- `linesHash(lines)` → FNV-1a 32-bit over `lines.join('\n')`, as 8 hex characters. Used by PR 5;
  added here so PR 5 is smaller.
- `newRecipeReview({ lines, sourceUrl, recipeId, library, alias, isSettled })`, where `library` is
  `[{ id, title, sourceUrl, lines }]` and `alias`/`isSettled` are the page's word-match functions.
  It aggregates both sides with `aggregateShoppingLines`, leaves out the recipe whose `id` equals
  `recipeId`, and returns `{ names: [{ key, name, aisle, other, isNew }], knownCount, newCount,
  sameAs: [{ from, fromName, to, toName }], duplicates: [{ id, title, sourceUrl }] }`. `sameAs` is
  `strictMatchSuggestions` over the union, kept only where exactly one side is new, with `from`
  always the new key. `duplicates` are library recipes whose `normalisedSourceUrl` equals the
  recipe's and is not `''`.

**`test/validate-recipes.js`** switches to `newRecipeReview` for its "new to the dictionary" and
"totals as" lines, and gains `--source <file>`: a file of `TITLE:`-keyed ingredient lists (kept
outside the repo) run through `sourceFidelity`, reported per recipe. A recipe whose text trips
`sourceNoteIn(...).reconstructed` is reported as a **warning** with the line quoted (not held back;
the household decided against a gate).

**`index.html`.** `renderLineChecks` becomes the band renderer; `compareWithSource` is called from
`parseAndPreview` under the `lastCheckedUrl` rule; the modal markup is reordered; new ids as in §5.
Keep `pastedSourceText`'s restore-after-re-parse behaviour.

**Checks to add.** Node: `sourceNoteIn finds a one-line note`; `a note without reconstruction words
is not reconstructed`; `no note is null`; `normalisedSourceUrl drops scheme, www, query, fragment
and slash`; `a non-URL normalises to empty`; `linesHash is stable and 8 hex`; `newRecipeReview
marks names not in the library as new`; `…leaves the edited recipe out`; `…pairs a new name with an
existing one, new first`; `…finds a duplicate by normalised URL only`. Browser: `pasting parses`;
`editing after a parse shows the stale bar and RE-CHECK clears it`; `the diagram renders above the
fields`; `a recipe whose names are all known shows one quiet line`; `a new name landing in Other is
marked`; `a recipe with the same source link is found and SHOW IT expands`; `a reconstruction note
shows the red row and SAVE stays enabled`; `the source check runs by itself for an https URL`;
`it does not run twice for the same URL`; `WRITE ONE BY HAND fills an empty box and refuses a full
one`.
**Mutations.** One per check: drop the regex word list; skip the `recipeId` exclusion; compare
titles instead of URLs; parse on `input` instead of `paste`; remove the once-per-URL guard.

**Risk.** Low: no writes. The one judgement is the reconstruction word list; keep it as written and
put any new word in a follow-up.

### PR 4 — Answers in place, and no dialog left

**Scope.** SAME / KEEP APART on "Same as" rows (through `addAlias`, with the inline MERGE · CANCEL
guard, new name → existing name); the source-spelling row replacing the save handler's `confirm()`;
UNDO for USE THIS and UNDO SCALE; the BEFORE YOU SAVE band (without the provenance line).

**Checks to add** (browser, asserted on `window.__WRITES__`): `SAME writes exactly one ingredient
alias, new name to existing`; `CANCEL writes nothing`; `KEEP APART writes one distinct row`; `a
settled pair is not offered`; `USE THAT writes a source alias and sets the field`; `KEEP MINE writes
a source_distinct row`; `an unanswered spelling row saves the typed spelling and writes no alias`;
`no confirm() is called in the add path` (stub `window.confirm` to throw); `UNDO restores the line`;
`UNDO SCALE restores the text`; `BEFORE YOU SAVE names the header lines that will change`; `…the
keywords that are new`; `…the photo copy`.
**Mutations.** Reverse the merge direction; write on pick instead of on MERGE; leave the `confirm()`
in; compute the header list from the fields instead of the text.

**Risk.** Medium: these are household-wide writes from the add form. Each is the same row the
shopping list or Settings already writes, and each is undone in Settings.

### PR 5 — Provenance recorded on the recipe

**Scope.** Migration: `alter table public.recipes add column source_check jsonb;` (nullable, no
default; RLS is per row and needs no change). **The household applies it**; the PR carries the SQL
and is merged after. Value shape: `{ "at": ISO string, "route": "function" | "pasted",
"hard": n, "soft": n, "sourceLines": n, "linesHash": "8 hex" }`. Written by SAVE (add or edit)
when a comparison ran in that form session; never by the comparison alone. Stale when
`linesHash` differs from `linesHash(recipeIngredientLines())`. The pasted text is never stored.

**Fact:** `recipeToRow` (`index.html:2482`) and `rowToRecipe` (2500) are explicit allowlists, so
the column must be added in **four** places: `recipeToRow` (`source_check`), `rowToRecipe`
(`sourceCheck`), `exportAllData` (carried on each recipe object; no version bump, a missing value
is `null`) and `importAllData` (passed through). The cache must carry it (`CLAUDE.md`: a form save
upserts the whole row from the cache).

**Also:** the BEFORE YOU SAVE provenance line; the viewer chip (§5); on Edit, the SOURCE section
shows the stored result with RE-CHECK when the hash matches.

**Checks to add.** Node: `linesHash changes when an ingredient line changes and not when a keyword
does`. Browser: `a save after a comparison pushes source_check with the counts and hash`; `a save
without a comparison pushes null`; `editing an ingredient line makes the chip say the ingredients
changed`; `export carries source_check and import restores it`; `an older backup without it imports
with null`; `the viewer shows NOT COMPARED for a recipe with none`.
**Mutations.** Hash the whole text; write on compare instead of save; drop the column from
`recipeToRow`.

**Risk.** Medium: a schema change and the row allowlist. The migration is a one-line `ALTER TABLE`;
`hydrate()` needs nothing (`select('*')` returns the column). The stub gets the column too.

### PR 6 — Aisle overrides

**Scope.** Exactly `docs/PROPOSAL-AISLE-OVERRIDES.md`: the `aisle_overrides` table with the same RLS
pattern as the other tables (`TO authenticated`), `aisleOverrideMap` in `core.js`, the third
parameter on `aggregateShoppingLines` plus the `aisleWhy` field (`'override'` when applied), the
Settings block SHOPPING AISLES, the cache functions mirroring the alias ones, and the review's aisle
`<select>` on Other rows with "Moved to … · UNDO". **The household applies the migration.**

**Checks and mutations:** as the proposal's step 4, plus `the review's aisle pick writes one
override and UNDO deletes it` and `no key changes with an override applied` (assert on keys before
and after). **Risk.** Low: by construction it never touches a key.

### PR 7 — Settings: lookup, dictionary, swaps text

**Scope.** §6: INGREDIENT LOOKUP, the read-only DICTIONARY list, the Swaps subtitle. `aisleWhy` for
`'dictionary' | 'keyword' | 'none'` if PR 6 did not add them. No writes, no schema.

**Checks to add.** Node: `aggregateShoppingLines reports why an aisle was chosen`. Browser: `the
lookup names the dictionary row for a known wording`; `…says "your own wording" for an unknown one`;
`…says Other and points at the aisle block`; `…lists a word match touching the name`; `…lists a
swap for the name`; `the dictionary list filters as typed`. **Risk.** None to data.

### PR 8 — LIBRARY CHECK in Settings

**Scope.** A block `#libraryCheck` with a RUN button. For every recipe: title · source · status
(from `source_check` and `sourceNoteIn`: **reconstruction note** / **not compared** / **compared
before the ingredients changed** / **n differences** / **no differences**) · new names in Other ·
OPEN (calls `openEditModal(id)`, where every action lives). Sorted with the recipes needing
attention first, in that order; a checkbox *"only those needing attention"*. Read-only; nothing is
written from this screen. This is the audit the finding asks for: the household works down the list,
comparing each in the edit form and saving, and the column is the record. No spreadsheet.

**Checks to add** (browser): `every recipe is listed`; `a recipe with no source_check reads NOT
COMPARED`; `a recipe with a reconstruction note sorts first`; `OPEN opens the edit form for that
recipe`; `nothing is written by RUN`. **Risk.** None to data; 34 parses is trivial.

### Outside the PRs

- **Repairing the two reconstructed recipes** (the oat bars; the loaded fries): re-convert from the
  real page's text through the household's converter (after PR 2), validate, then the md5-guarded
  `UPDATE` in `CLAUDE.md` "Changing recipe text in the live database", first recipe alone, household
  present, undo file in `PrivateBackup`. Never delete and re-insert. This is a data job, not a PR.
- **Growing the dictionary** stays the survey tool's job (`converter/ingredient-extraction-prompt.md`).

---

## 9. How this reconciles with the two proposals and the finding

**`docs/PROPOSAL-NEW-RECIPE-REVIEW.md`.** Adopted, extended, and its phases mapped: A → PR 3,
B → PR 4, C → PR 6, D → PR 8. Its five open decisions, answered here: (1) Phase A first, yes; (2) on
a duplicate, SHOW IT only, inline, nothing deletes; (3) shown on Edit too, the recipe left out of the
library, the duplicate check only when the URL changed; (4) the source-spelling question moves to
parse time as an inline row (**Recommendation**, following "no dialogs" and decision 4; the
household has not been asked in those words); (5) Phase D wanted, as PR 8. Its 15 pitfalls stand;
pitfall 3 (merge direction) and 10 (a tablet slip) are built in above.

**`docs/PROPOSAL-AISLE-OVERRIDES.md`.** Built as designed, as PR 6, its two settled choices kept.
Its "general point" (one key, one home in Settings, naming facts re-key ticks and the others do
not) is the rule §7 follows.

**`docs/HANDOVER-CONVERSION-INTEGRITY.md`.** The three §7 decisions are answered (§4, 1–3) and
built as PR 1. Of its §4 step 4 preventions: the converter rule → PR 2; `validate-recipes.js`
running `sourceFidelity` → PR 3; the visible marker → PR 3 (the row) and PR 5 (the chip); refusing
to ingest → **not built**, by the household's decision 6. Its step 3 audit → PR 8 with PR 5 as the
record. Its step 5 repair → "Outside the PRs".

**`docs/REVIEW-ARCHITECTURE-FINDINGS.md`.** A plan closes nothing; PRs do. F12 (the ingredient
review measured itself) is answered in substance by the source check existing, but it is an
Info finding with no tick to give. No finding is ticked by this document.

---

## 10. Decisions still the household's

Short, and none blocks PR 1–3:

1. **Decision 6's wording.** §4 reads "enforced check point" as: always present, runs itself, result
   recorded, nothing blocked. If a save should instead *require* a comparison to have run, say so
   before PR 3; it changes PR 3 and PR 5.
2. **Provenance as a column, not a header line.** **Recommendation:** column (a comparison is an
   event about the text, not part of the recipe; editing the text should make it stale, not carry
   it). Say before PR 5 if you want it in the text instead.
3. **Swaps stay a view (A).** Option B (into Settings under the lookup) is drawn in the mockup only.
   Say if you want B, and when.
4. **PR 1's day.** One line re-keys and no tick exists; the Friday-morning rule is yours to keep
   or waive.
5. **The reconstruction word list** (PR 3). Add or remove words before it ships if you know a
   phrasing the converter uses.

---

## 11. STOP AND ASK

An implementation session stops, hands back, and does nothing further on that PR when **any** of
these happens. "Stop" means: commit only what is green, with a message that says it is partial;
push the branch; **do not open a PR**; report in chat what happened, the exact error text or number,
and the two ways forward you can see. Never widen the PR to get past it.

1. A test suite is not green (exit code not 0) **before** you change anything.
2. After your change, a check you did not write fails.
3. The re-measure (PR 1) shows a key change on any line that does not contain "tinned", or a row
   count above 169, or a tick count above 0.
4. A function, element id, file or line this document names is not in the code. Search first
   (`grep -n`); if it is truly gone, stop.
5. You need any of: a schema change, a new table, a new Edge Function, a new dependency, a change
   to `buildShoppingList`, `hydrate()`, `pushList`, `queueWrite`, `refreshLibrary` or the
   `replace*` functions, that the PR entry does not name.
6. The live database differs from the entry's numbers: ticks not 0 for PR 1; a third recipe with
   a reconstruction note; `recipes` already has `source_check`; `aisle_overrides` already exists.
7. A mutation you make does not fail a check by name and two attempts have not shown you why.
8. The change would show a dialog, block a save, delete anything, write a household fact without
   a tap, or write recipe text.
9. A document you must update says something you cannot verify, or contradicts this plan.
10. The change is bigger than the entry describes, or you are about to add "one more thing".

Not a stop: a documented count that has moved (the smoke suite grows with every PR). Trust the run
on `main`, write the new number down, and correct the documents that state it in the same PR, saying
so (the repo's convention, `docs/HANDOVER.md` §6).

---

## 12. What this session verified, and how; and what it could not

| Claim | How |
| --- | --- |
| The add path's order, writes and the last `confirm()` | Read in `index.html` on `main` at `55cd5a6` |
| The naming rules, the strict rule, the line faults, the exports | Read in `core.js` `2026-09-29.1` |
| 34 / 466 / 169 / 32 / 0 | `tools/remeasure.js` on an export read with `test/README.md`'s query, in scratch |
| 80% known; 86 of 139 rows hit; per-source coverage; 55% one-recipe keys | A scratch script over the same export, counts only |
| 2 canned ingredient lines in 2 recipes; 1 tinned in 1; both notes one line each with the glyph and the words | Scratch scripts over the same export, through `parseRecipe`, counts and shape only |
| 0 ticks, 2 notes, 12 sources, 3 + 10 + 1 word matches, 2 swaps, 49 keywords | One aggregate SQL query, read-only |
| `recipes` columns (no `source_check` yet); `recipeToRow`/`rowToRecipe` allowlists | `information_schema.columns`; the code |
| `validate-recipes.js` never calls `sourceFidelity` | `grep -c` |
| The Swaps subtitle is stale | `index.html:1473–1478` against `5012–5013` |

**Not verified:** the live app in a browser; the tablet; what a real copy from a refusing site looks
like; whether the converter project's file matches the repo's; the household's steps 36a–36c;
anything about how the two reconstructed recipes were produced (the conversion chat was not
available).

**The mockups** (three self-contained HTML pages with invented data, kept in the session's scratch
directory and never in this repo, per `CLAUDE.md`) show bands 1–5 in a quiet and a busy case, the
CHECKS band with every row type, and Settings with the lookup in options A and B. They are the
target look, not pixel specifications; ids in this document are the contract.

---

## 13. The prompt to start an implementation session with

Written for a less capable model. Copy the whole block; change `<N>` to the PR number (§8) and
nothing else. One PR per session. The same block is in `docs/NEXT-SESSION.md`.

```
I'm continuing work on my Kitchen recipe app, in the repo
crispy-lettuce/RecipeFlowKeeper. main is production: GitHub Pages serves it and
every merge deploys to the tablet I cook from. Work on a new branch and open a
pull request when the work is tested. Never merge.

YOUR JOB THIS SESSION: PR <N> of docs/PLAN-NEW-RECIPE-FLOW.md, and nothing else.

Read these first, in this order, before writing anything:
  CLAUDE.md                          - its first three sections apply to the letter
  docs/PLAN-NEW-RECIPE-FLOW.md       - section 8 "Before every PR", then the entry
                                       for PR <N>, then section 11 STOP AND ASK,
                                       then sections 4, 5 and 7 for the rules behind it
  docs/DOCUMENT-INDEX.md             - the map of every document
  docs/ARCHITECTURE.md               - how the app and its recipe format work
  the functions, files and ids the PR entry names, in the code itself

Then, before any change, write five lines in chat: what PR <N> changes, which
files, what it must not touch, the numbers you expect before and after, and the
checks you will add. Wait for my "go".

BOUNDARIES. Do not:
  - do any part of another PR, or "one more thing" the entry does not name;
  - reopen a decision in section 4 of the plan, or ask me a question the plan
    already answers (section 10's open items take the plan's recommendation
    unless I say otherwise in this chat);
  - change buildShoppingList, hydrate(), pushList, queueWrite, refreshLibrary
    or any replace* function unless the entry names it;
  - change the database schema, add a table, add a dependency, or change an
    Edge Function unless the entry names it, and never deploy one;
  - show a dialog, block a save, delete anything, or write a household fact
    without a tap;
  - write recipe text to the database, commit any recipe, plan or diary data,
    or paste real ingredient lines anywhere (examples are invented and checked
    against the library);
  - merge, or push to any branch but your own;
  - claim a test passed without running it and reading its exit code.

MUST, in this order (section 8 of the plan has the detail):
  1. git fetch origin main; branch from origin/main.
  2. node test/core.test.js, then node test/build.js && node test/smoke.js
     (npm install playwright once; if no browser is found, set
     PLAYWRIGHT_CHROMIUM to the chrome under /opt/pw-browsers/chromium-*/
     chrome-linux/). Read echo $? after each. Green before you change anything,
     or stop.
  3. Make the change the entry describes. Add the checks it names. Break each
     one on purpose, see it fail by name, restore the code; git diff must show
     only your intended change.
  4. If core.js changed, bump KITCHEN_CORE_VERSION, core.js?v= and
     EXPECTED_CORE_VERSION together.
  5. PR 1 only: re-measure the live library on main and on your branch
     (test/README.md, "Re-measuring the live library"); the export stays in
     scratch. Put both results in the PR.
  6. git diff origin/main, read for private data. Dates from date -u.
  7. Open the PR. Its description has two headings: "Verified by" (what you
     ran, the counts, the mutations and which check each failed) and "Not
     verified" (everything you could not check, the live app included).
  8. Tick nothing in docs/REVIEW-ARCHITECTURE-FINDINGS.md unless the entry
     says to; update the status column of row 8 in docs/NEXT-SESSION.md; add
     one line to docs/HANDOVER.md section 7 saying what was verified and how.

STOP AND ASK when any trigger in section 11 of the plan happens. Stop means:
commit only what is green, with a message saying it is partial; push your
branch; do not open a PR; tell me what happened, the exact error text or
number, and the two ways forward you see. A smaller PR is always fine. When
unsure, stop.

Some context worth having:
  - index.html and core.js are the whole app. No build step, no framework.
    The test suite stubs Supabase, so a green run proves nothing about
    sign-in, RLS or the write queue.
  - Don't trust status notes, mine included, where you can check the real
    thing. The corrections table in docs/HANDOVER.md section 6 says why.
  - The repo is public.
```
