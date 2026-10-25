# Recipe conversion instructions: revision history

What changed in `conversion-instructions.md`, and why, newest first. Until 18 Oct 2026 these notes sat at the end of that
file, so every conversion read them; they say nothing a conversion needs, so they live here, for reference. **This file is
not loaded into the conversion project.** Each household loads `conversion-instructions.md` alone.

## Revision note (25 Oct 2026, version 2026-10-25.1: pasta on its own, and a basted bake)

Raised by issue #207: a blind reading of the 2026-10-24.1 wording over the library's 297 timed steps matched the household's marks on 287 (an earlier note here and in Test 18 said 288; a noodle
step had not been re-judged, which corrected the count by one). Five steps were open besides the deliberate 5-6 minute waits.

- **Pasta and noodles, one clause (was a phrase in the waiting list).** Hands off when the step is only boiling them (and draining): to the packet time with none stated, or for a stated 10 minutes or
  more. A step that also rinses, tosses or stirs them, or boils them for under 10 minutes, follows the general rule. This is what the library does on all ten pasta and noodle steps in it: it
  also removes a clash between the old phrase and "bring to the boil, then simmer for under 10 minutes is hands on".
- **Oven tending, one sentence.** Opening the oven once or twice to baste or turn a dish is tending, not stirring: the bake stays hands off. (An 8-minute bake basted once halfway was read as hands on.)
- **The fifth step was the library's, not the wording's:** a slowly cooked onion step that the proposal tool had marked hands on because "frying pan" matched the verb "frying". The household had that one mark
  changed to hands off (25 Oct, one guarded update), and the tool no longer reads the noun as the verb.
- **Test 18 extended:** step 2 is a 12-minute boil, and steps 13 to 15 are added (short pasta that is rinsed and tossed; untimed noodles that are rinsed; a basted bake). Its "Runs" are corrected.
- **Reload this file into the conversion project.** Recipes already in the library are not changed.

## Revision note (24 Oct 2026, version 2026-10-24.1: the hands-off rule, settled on the library)

Raised by the household's pass over its own library (docs/PLAN-RUN-SHEET.md §6). Version 2026-10-23.1 introduced the `, hands off` mark
(test 17; it had no note here). The household then went through every timed step of its library, and the marks it settled showed where
the first rule left a step open or read it the wrong way.

- **Six clarifications, in the "Hands-off steps" bullets and the matching Check line.** A step that is prepared and then waits ("toss with
  oil and roast for 30 minutes") is judged by the waiting part, where the first rule read the tossing. Pasta or noodles boiling to the packet
  time, stated or not, are hands off. A long simmer or stew stirred only from time to time is hands off (the list of "occasionally" words gains "from time
  to time"). A range counts from its low end, and "bring to the boil, then simmer" under 10 minutes stays hands on. Frying, browning, searing,
  grilling, whisking and tossing as the work of the step are hands on whatever "occasionally" says (searing and grilling are new to the list).
  Cooling and freezing join the waiting steps.
- **Two cases left hands on on purpose:** a wait of only 5-6 minutes in the oven, while resting or while cooling, and a boil with no stated time (pasta apart). The
  household's reading of these varied step by step, and a missing mark only costs a little precision in the plan, where a wrong one says the
  cook's hands are free when they are not. So the file now says **when unsure, write nothing.** A few marks the household put on its library
  sit in these cases, so converting those recipes again leaves them hands on.
- **Test 18 added**, with a made-up source and one step for each clause. `test/core.test.js` reads its table.
- **Reload this file into the conversion project.** Recipes already in the library are not changed.

## Revision note (21 Oct 2026, version 2026-10-21.1: a split adds up to the ingredient list)

Raised by the household from a real conversion whose COMPARE WITH SOURCE showed a sauce as "amounts differ": the recipe had a
small first part and then the source's whole list amount again, so it added up to more than the source asked for.

- **The cause.** The source site prints each ingredient under every method step that uses it, **with its whole list amount each time**
  (`2 tbsp oil` under a step that uses 1 tbsp). The instructions said a split ingredient becomes one line per group but not
  where the amounts come from, so a step's repeat of the list was taken as that step's share, on top of an earlier part. Another ingredient in the same
  recipe came out right, because the method said "the remaining" of it; the sauce did not, because the method gave its last part as an
  approximation ("about 1 3/4 tbsp").
- **Two rules, under "Split ingredients".** The ingredient list is the total, and a step's repeat of it is a reminder, never an
  extra. The lines of a split add up to the list's amount, once: each part from the method's own words, "the remaining" being the total less the
  parts given, halves where the method says so, a question where it cannot be worked out. The smallest part is rounded by the liquids
  rule and the larger gets the rest, so the lines never total more than the list.
- **One line added to Check:** every split's lines add up to the source's list.
- **Test 16 added**, with made-up amounts.
- **Reload this file into the conversion project.** Recipes already in the library are not changed (that would be a recipe-text job).

## Revision note (18 Oct 2026, version 2026-10-18.5: spoons kept in brackets)

Asked for by the household, after seeing spoons of a solid become grams with nothing to say where the figure came from.

- **A solid the converter turns from spoons into grams keeps the spoons in its bracket**, first and as the source wrote them:
  `30 g light brown sugar (2 tbsp)`, `55 g unsalted butter, melted (4 tbsp)`, `12 g cocoa powder (5 tsp)`. Only for spoons that were
  converted: a weight the source gave, cups and ounces are grams alone, and 1 tbsp or less stays a spoon.
- **Why the grams stay.** The shopping list adds grams to grams and never a weight to a volume, so a solid in spoons would sit
  beside the same thing in grams (`30 g + 2 tbsp`) instead of totalling. The weights are the converter's own recall of standard
  figures (the file gives only flour and granulated sugar per cup); the bracket lets the cook measure with a spoon, and shows
  what the grams came from.
- **The app scales the bracket** with the grams (`scaleSpoonNote` in `core.js`, core 2026-10-18.5), so a doubled recipe reads
  `60 g light brown sugar (4 tbsp)`. Without that the bracket would be a stale quantity, which is why the converter is told the exact
  shape. The shopping list, the line check and the source check ignore it.
- **Test 15 added; test 6 now expects `60 g butter, melted (4 tbsp)`.**
- **Reload this file into the conversion project.** Recipes already in the library are not changed (that would be a recipe-text job).

## Revision note (18 Oct 2026, version 2026-10-18.4: the household's answers)

A session tested the rewrite (2026-10-18.3) and raised five queries; the household answered them the same evening. Version
2026-10-18.3 had already merged without them (#160), so they are a version of their own.

- **Several recipes in one message:** nothing is carried from one recipe to another **except `SOURCE`**: recipes from one book,
  page or site, or that the person says share a source, all take it, so it is asked once. Test 14 now expects the shared source
  and only the servings question.
- **The walkthrough of the flow** is written only when the person asks for one (3–5 plain sentences).
- **A step the source doesn't time** is `[instant]` when it is a quick hands-on action (blend, strain, pour) and `[until done]`
  when it takes real but unstated time (rest, chill, prove, roast until cooked). Never an invented figure. Neither version said.
- **The hands-on allowance** in "Estimating TIME" is 5 minutes up to 8 ingredient lines and 10 from 9 (it said "under about 8"
  and "10–15 for a long list", which left 8 to 10 lines either way).
- **A tin with no weight** stays `1 tin chickpeas`; the app now accepts it (no "container word" advice) and scales it as `2 tins`
  (core 2026-10-18.4).
- **Reload this file into the conversion project.**

## Revision note (18 Oct 2026, version 2026-10-18.3: the household's rewrite)

The household rewrote the file to use fewer tokens per conversion (2,904 words, from 5,953), tested it in its own conversion
project, and asked a session to test it and raise queries.

- **The revision history moved here.** The top of the file keeps only its title and `**Version …**` line.
- **The same rules, said more briefly**, grouped under shorter headings (Reading the source, What to extract, Units, Ingredient
  line shape; Fields, Flow rules, Estimating TIME). No rule was dropped; most of the reasons given for them, and some examples,
  were.
- **Check is silent.** The converter fixes what Check finds and no longer reports it ("found → fixed").
- **Present lists only what needs the person**: unconfirmed values, approximate conversions that could matter, anything uncertain,
  or a question that blocks a field. The 3–5 sentence walkthrough of the flow is gone.
- **New: a tin with no weight.** When the source gives only the container ("a tin of chickpeas"), the line is `1 tin chickpeas`;
  no weight is invented.
- **New: source files renamed.** An image or PDF the person attached comes back renamed to the recipe's `TITLE` (`-1`, `-2` in
  page order for several), or, without code execution, as the new filename to use.
- **New: several recipes in one message.** Each is converted on its own, nothing carried from one to another, and the questions
  are gathered at the end, each naming its recipe.
- Two lines were adjusted so the repo's checks can read them, with no change in meaning: the `**Version 2026-10-18.3.**` line
  (the app's CONVERTER bar and `test/core.test.js` read that form), and the Time note, now on a line of its own.
- Tests 13 and 14 in `test-set.md` cover the two new rules that change the output.
- **Reload this file into the conversion project.**

## Revision note (18 Oct 2026, later the same day)

- **`TIME` can now be estimated** (asked for by the household, 18 Oct). A recipe from a cookbook photo or
  any source that gives no overall time used to come out with `TIME` blank, because the rule was "omit
  rather than guess". Now, when the source has no total and no prep and cook times to add, `TIME` is worked
  out from the method and written `TIME: est. 1 hr 45`. The app shows it with an EST. tag.
- **Only from the steps:** the longest chain of MERGE durations (parallel lines in a stage do not add),
  a range at its midpoint, an "at least" step at its stated figure, an allowance for chopping and measuring,
  rounded to 5 minutes. Never from the dish's name, memory or a similar recipe. A step with no figure
  (`[overnight]`, `[until done]` or `[till reduced]` where the source gives none) means no estimate: ask,
  or omit `TIME` with a one-line reason.
- A source that states a total, or prep and cook times that add up, is used exactly as before: no `est.`.
- An estimate comes with its own line under NOTES, `⚠️ Time note: …`. It is deliberately not a
  `⚠️ Source note:`: the app reads that opening as a recipe reconstructed from another page.
- Test 12 in `test-set.md` checks the rule.
- **Reload this file into the conversion project.**

## Revision note (18 Oct 2026)

- **Liquids under 50 ml are written in spoons, and from 50 ml in ml** (asked for by the household,
  18 Oct): `3 tbsp olive oil` (45 ml), but `60 ml olive oil` where the source says 4 tbsp. Under
  15 ml is teaspoons. Spoons round to the nearest half, ml to the nearest 5 ml, and one unit per line.
- **A liquid the source weighs stays weighed**: `30 g golden syrup` is never turned into spoons.
- The example line `4 tbsp olive oil` in section 1 became `3 tbsp olive oil`, since 4 tbsp is 60 ml.
- Test 11 in `test-set.md` checks the rule. The app does not yet switch a scaled line between tbsp
  and ml at the 50 ml mark; that is planned separately (`docs/PLAN-LIQUID-MEASURES.md`).
- **Reload this file into the conversion project.**

## Revision note (11 Oct 2026)

- **Drink** joins the courses on the TAGS line, for a cocktail, a milkshake or a smoothie (issue #93). The app offers it
  in its COURSE filter and the edit form's course list from the same day. Nothing else changes; reload this file into
  the conversion project.

## Revision note (30 Sep 2026)

- **Pasted text from the page needs no source note.** The first conversion under the 29 Sep rule, a
  BBC Good Food page that would not load, rightly stopped and asked for the text, but offered to add a
  `⚠️ Source note:` saying the recipe came from pasted text. Depending on its words ("the page could not
  be fetched"), the app reads such a note as a reconstruction, so LIBRARY CHECK would flag a faithful
  recipe in red. Section 1 now says pasted text, a screenshot or a photo of the page is the page, and
  the note is only for what is missing; section 3 checks it.
- The same day showed why the 29 Sep rule was needed: a conversion chat from before it had taken five
  BBC Good Food recipes from the site's Middle East edition and other people's copies when the page
  was blocked, and said so only in the chat (`docs/HANDOVER.md`, 30 Sep).
- **Reload this file into the conversion project.**

## Revision note (29 Sep 2026)

Changed following the household's comparison of one library recipe with its source page
(`docs/HANDOVER-CONVERSION-INTEGRITY.md`) and PR 2 of `docs/PLAN-NEW-RECIPE-FLOW.md`:

- **A page the converter cannot read is a stop, not a recipe.** These instructions covered a
  photo too blurry to read and said nothing about a URL that would not load. The comparison found a
  recipe whose ingredients were not its source's: the converter had not been able to read the page,
  and had reconstructed the recipe from another one that seemed to carry it. The recipe's own text
  said so, but nothing downstream could act on that. Section 1 now says to stop, name the address
  that failed and ask for the text or the ingredient list, and never to convert from another page,
  a partner's or branded version, a search snippet or memory. Section 3 has the matching check.
- **`⚠️ Source note:`** is the one form a note about the source may take: its own line under NOTES,
  saying plainly what was not read. The app's review of a new recipe (PR 3 of the plan, not yet
  built) will look for exactly that line.
- Test 9 in `test-set.md` checks the rule: an address that cannot be read must produce a question
  and no recipe.
- Nothing changes for a page that can be read, a photo or pasted text.
- **Reload this file into the conversion project.** Nothing in the repo can do that, and until it
  is reloaded the converter behaves as before.

## Revision note (23 Sep 2026, later the same day)

Changed following `docs/REVIEW-ARCHITECTURE-FINDINGS.md` §4 and F12:

- **The converter no longer renames ingredients to a list.** The morning's version said to
  spell every listed ingredient exactly as `ingredient-names.md` has it and to replace every
  "Also written as" phrase before presenting. On its first outing on an unfamiliar site the
  converter obliged by writing *dried oregano* for a recipe's *Italian seasoning*: a
  different product, silently, and permanently once saved. The review found the renaming rule
  had never earned its keep either: every gain the ingredient review measured came from the
  line shape and from app-side rules, and all 24 lines "only the converter could fix" were
  shape faults, not naming ones. So the converter now owns the **shape** of a line and
  **British English**, and keeps the source's product and the source's ambiguities. The
  app's dictionary, which `ingredient-names.md` is the seed of, does the naming at list time,
  where a wrong match costs one shopping trip and is undone in Settings.
- `ingredient-names.md` is **no longer a project file** for the converter. Remove it from the
  conversion project.
- Test 7 in `test-set.md` is reframed to check this, and now fails on the opposite of what it
  failed on this morning: a converter that makes a name *more* specific than the source.

## Revision note (23 Sep 2026)

Changed from the previous version, following `docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md`:

- **A standard shape for every ingredient line**, and a **shared vocabulary**
  (`ingredient-names.md`) to take names from *(the vocabulary half was withdrawn later the
  same day; see the note above)*. Measured on the library, the converter copied
  each source's wording, so the shopping list could not total the same ingredient written
  different ways: 274 rows for 168 things to buy. 24 lines could only ever be fixed here,
  among them "X or Y" alternatives, lines holding two ingredients, a tin in ml and a
  cooked weight for something bought uncooked.
- **Count words** (`pinch`, `bunch`, `clove`…) are now allowed as units, and the old units
  bullet keeps only the metric conversion guidance.
- **Weigh solids above 1 tbsp; tins in grams; the amount you buy, not the cooked amount.**
- Tests 6 and 7 in `test-set.md` check the new rules.

## Revision note (13 Sep 2026)

Changed from the previous version:

- **`SOURCE_URL` added.** The app now has a field for the original link, separate from
  the site name — the gap the previous revision left open.
- **`EQUIPMENT` added.** The app has had this field all along but nothing was producing
  it, so it was always empty.
- **Servings is now mandatory**, with a fallback: ask the person rather than omitting
  it. The app scales recipes by target number of people, which needs a starting figure
  on every recipe.
- **Bracketed durations on every MERGE**, `[instant]` included. The group-cooking
  timeline treats a missing duration as a gap in the schedule, so "usually present" was
  not good enough.
- **A late addition now gets its own group**, with a worked right/wrong example. This
  is the rule that was missing when the Maple Almond Granola Clusters conversion put
  vanilla extract into the heated `wet` group — the method adds it off the heat, on
  purpose, because the aromatics cook off otherwise. The correction survived only as
  prose in the step label, so the diagram said all four ingredients went in together.
  The general class of error: late additions and split ingredients getting collapsed
  into an earlier group because they appear in the same sentence of the source method.
- **Consistent base unit per ingredient**, feeding the shopping list's own g/kg and
  ml/L handling cleanly.
- **Quantity phrasing rule** — "1/2 lemon", not "1/2 a lemon" — so arithmetic scaling
  doesn't produce awkward grammar. The app deliberately doesn't attempt grammar
  correction.
- **A standing test set** now lives alongside this file (`converter/test-set.md`). Run
  it whenever these instructions change.

### Revision note (14 Aug 2026)

- Servings extraction added.
- Unit standardisation added, at extraction time.
- `protein=` removed from the TAGS line — meal-base facts are ordinary keywords now,
  and a recipe can carry more than one.
- Automatic `Batch` flagging added.
- Structured NOTES added: VARIATIONS/STORING/FREEZING/TIPS as their own optional
  headings alongside plain NOTES.
