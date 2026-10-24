# Kitchen App — How it works

For someone who has never seen this project: the shape of the app, the recipe format it is built around, and the database behind
it. What the app *does*, screen by screen, is `docs/SPEC.md`. Trimmed 22 Oct 2026; §4 (the database) was last checked against the live project on 12 Oct.

---

## 1. What the app is

A personal recipe app for a few households of one family (each with its own data), used mainly from a tablet propped up in a kitchen.
It stores recipes, plans meals across a fortnight, builds a shopping list from that plan,
scales recipes to a number of people, and keeps a history of what was cooked when.

Its distinguishing idea is that **a recipe is stored as a flow, not a list of steps**. Every
recipe is written in a small text format describing which ingredients get combined, and when.
The app renders that as a left-to-right diagram: ingredients on the left, each column a moment
in time, boxes merging as things come together. You tick boxes off as you cook.

## 2. The recipe format

Recipes are stored as plain text in `recipes.syntax`. Everything else about a recipe —
its title, source, servings, tags — is *derived* from that text by parsing it, then stored in
columns alongside for querying. **The text is the source of truth.**

```
TITLE: Maple Almond Granola Clusters
SOURCE: Sally's Baking Addiction
SOURCE_URL: https://sallysbakingaddiction.com/maple-almond-granola-clusters-vegan/
IMAGE: https://.../granola-clusters.jpg
TIME: 1 hr 45
SERVINGS: 11
EQUIPMENT: 23x33cm baking pan
TAGS: course=Snack, Granola, Vegan

STEPS:
Preheat oven to 149°C. Line the pan with parchment.

GROUP dry:
255g whole rolled oats
95g sliced almonds

GROUP wet:
70g coconut oil
80ml maple syrup

GROUP vanilla:
1 tsp vanilla extract

STAGE:
MERGE wet -> syrup: heat, whisking until the sugar dissolves [3-4 min]

STAGE:
MERGE syrup, vanilla -> liquidmix: off the heat, whisk in the vanilla [instant]

STAGE:
MERGE dry, liquidmix -> mixture: pour over the dry and stir [instant]
```

The pieces:

- **`GROUP <handle>:`** — ingredients that go in together at the same moment. The handle is a
  short name used later.
- **`STAGE:`** — one column in the diagram, one moment in time. Independent things happening at
  once go in the *same* stage as separate MERGE lines.
- **`MERGE <handles> -> <new handle>: <label> [<duration>]`** — combines one or more handles into
  a new one. One input just relabels a box (pour, bake, cool), which is how every step after the
  final combine is written.
- **`STEPS:`** — one-off prep with no ingredient (preheat, line a tin).
- **`NOTES:` / `VARIATIONS:` / `STORING:` / `FREEZING:` / `TIPS:`** — optional trailing sections.
- **`TIME:` is free text** (`time_text`), and since 18 Oct 2026 may begin `est.` (`TIME: est. 1 hr 45`): the converter worked
  it out from the method steps because the source gave no overall time. The marker is kept inside the text on purpose, in
  `syntax` and in `time_text`, so there is no second column to keep in step, a copy from another household carries it, and
  typing a real time into the TIME box removes it. `splitTimeText` (`core.js`) reads it back out; `timeHtml` (`index.html`)
  draws the EST. tag on the card, in the recipe's line, on the Planner and on the Shortlist; `parseMinutes` reads the figure
  with or without it, so the Weeknight, under 30 min view counts an estimate. The timeline reads the MERGE durations, never
  `TIME`. The converter also writes `⚠️ Time note: …` under NOTES with an estimate; it is not a `⚠️ Source note:` and the app
  does not read it as one.

Two rules that matter more than they look:

**Group order is load-bearing.** A MERGE can only combine handles that sit on *adjacent rows*.
Groups occupy rows in declaration order, so groups destined to merge must be declared next to
each other. In the example above, `dry` is declared first precisely so that after `wet`+`vanilla`
become `liquidmix`, `dry` sits immediately above it. Get this wrong and `computeColumns` returns
an error rather than a diagram.

**A late addition gets its own group.** Anything added off the heat or at the end is its own
GROUP merging in at a later stage — never folded into an earlier group with the timing
explained in the label. The group *is* the claim "these go in together", so bundling makes the
diagram say something untrue. This was a real bug in the library (vanilla cooked along with the
syrup), and is why `converter/test-set.md` exists.

**Durations.** Every MERGE ends with a bracket: `[8 min]`, `[10-13 min]`, `[1 hr]`, `[instant]`
for a genuinely zero-length step, `[overnight]`. `until`/`till` phrases are read as open-ended.
Any *other* bracket (`[to taste]`) is deliberately left alone as label text — the parser
under-detects on purpose rather than mistake a seasoning note for a timing.

**Hands off.** A step that looks after itself once it is going says so inside its bracket, after a comma: `[25 min, hands off]`,
`[40-50 min, hands off]`, `[until set, hands off]` (23 Oct 2026, `docs/SPEC.md` §3). Hands on is the default and is written as nothing.
`extractStepDuration` splits a trailing `, hands off` (any case, `hands-off` too) off first, reads what is left exactly as before
(`readBracketDuration`), and returns that duration with `handsOff: true` and nothing else changed, so scaling, the timeline's sums and
`formatDuration` do not know it exists. It is accepted after a number, a range, a compound and `until …`; **not after `instant`** and not
with no duration (`[hands off]`), which stay unrecognised and are reported by `test/validate-recipes.js` like any other unread bracket;
`[overnight]` is hands off by itself. `computeTimeline` carries `handsOff` and `inputs` (the handles a step waits for) on each step; the box
badge reads `25 MIN · HANDS OFF` and the timeline hatches the bar (`--lane-hatch`). A copy of the app from before this reads such a bracket as
unrecognised and loses the step's time, which is why a recipe is marked only after every device has reloaded.
`tools/propose-hands-off.js` sorts a library export into `off`, `on` and `ask` for the household's review and writes nothing.

Recipes are written by pasting a source into a conversion prompt; see
`converter/conversion-instructions.md`.

## 3. The app's shape

Two files, no build step, no framework, no dependencies beyond two CDN scripts (supabase-js and
html2canvas). **`index.html`** is the page: markup, styles, the data layer and
every screen. **`core.js`** holds the pure functions —
`parseRecipe`, `computeColumns`, `splitQty`, `scaleRecipeSyntax`, the quantity and naming helpers,
the header-line writers, and since PR 6b the shopping list's naming and totalling — and the ingredient dictionary. It touches nothing on the page, so it
loads in Node for testing as well as in the browser. The page loads it first and checks a shared
version stamp, asking for a reload if the two files ever arrive at different versions. Screens are
`<section class="view">` elements toggled by `showView(name)`.

**The data pattern is deliberate and worth understanding before changing anything.** The whole
library loads into memory once at sign-in (`hydrate()`), and everything afterwards is instant.
Consequently:

- Every `load*` / `save*` function is **synchronous**. They read and write an in-memory `cache`
  object.
- Saving queues a background push via `queueWrite(label, fn)`, which **always returns `true`
  immediately**. Callers never await a write.
- **Every ordinary save is one row** (since 24 Sep, PR 5): a favourite toggle is an `update` of
  that column on that recipe, a save from the form upserts that recipe's row, a removal deletes
  that row; a plan change writes that day, a tick inserts or deletes that key, and so on for
  groups, shortlist, word matches, swaps and keywords. Deleting a recipe also tidies the plan
  days, group and shortlist entry that pointed at it. The **whole-table replace** (`pushList`
  and the `replace*` functions, which upsert every row and delete the rest) is used by **import
  only**, where "this file is the truth" is what the person means.
- A write that fails is kept and re-sent at the head of the queue the next time anything is
  written; the refresh below stands down until it lands.
- Because writes are fire-and-forget, the way to prove something persisted is to **reload** —
  the page rebuilds entirely from Supabase.
- There is no live sync between devices — but **coming back to a tab re-reads the library**
  (`refreshLibrary`). supabase-js emits `SIGNED_IN` on every hidden → visible change of the tab,
  and the app answers the second and later ones with a refresh. This document used to say two
  tabs never saw each other's changes until reloaded; they always did, by accident, from the day
  the Supabase rewrite shipped. It mattered more than it looked until PR 5: every save pushed
  the whole cached table and deleted what it didn't hold, so a long-open tab that never
  refreshed would overwrite another device's work on its next save. Row-scoped writes make the
  refresh a convenience rather than the last line of defence.
- A refresh can never lose anything. It waits for the write queue to empty, stands down while any
  save has failed, and discards what it fetched if anything changed mid-fetch. Any failure
  leaves everything as it was. Offline use is still not a requirement; not being thrown out by a
  flaky connection is.

**`hydrate()` is the fragile part.** At start-up, an exception thrown inside it signs the user out
— unless it is a network failure, which keeps the session and says the server couldn't be
reached. On a refresh, nothing it throws signs anyone out. It still must not throw on data that
might legitimately be absent: this is why `household_settings` is read with `.maybeSingle()`
rather than `.single()` — a household with no settings row must come back as `null`, not throw.
`hydrate(opts)` asks `opts.shouldApply()` once, after every fetch and before any assignment, so a
refresh lands whole or not at all.

### Coming back to a tab: why the refresh exists, and its four rules

supabase-js emits `SIGNED_IN` **every time the tab goes hidden → visible**, with no network call, so offline too (verified in the
`@supabase/auth-js` source, `_onVisibilityChanged` → `_recoverAndRefresh`). The app used to answer each one by re-downloading
everything and signing out if that failed, so leaving the tab while offline and coming back signed you out. It now answers the
first with `startApp()` and every later one with `refreshLibrary()`.

**That refresh is load-bearing; do not remove it.** Until row-scoped writes, a save pushed the whole cached table and deleted
what it did not hold, so a tablet left open since the morning would overwrite another device's work and delete its new recipes
(cascading their cooking history). The refresh is what stopped that. It is now a convenience rather than the last line of defence,
but it must never lose anything, so:

| It | Because otherwise |
| --- | --- |
| waits for the write queue to empty before reading | it reads the server before this tab's own saves arrive, and replaces them |
| stands down while any save has failed | the tab holds a change the server lacks, and the refresh would silently undo it |
| discards what it fetched if anything changed mid-fetch | the change is wiped from the cache, then pushed back as a loss |
| on any failure, does nothing | a refresh is an opportunity, never a reason to sign anyone out |

A failed save clears only when a later save of the whole table or row succeeds (then the server provably matches the tab). The
labels that can block a refresh are an allowlist, so one added later defaults to blocking. Starting up offline does not sign you out
either: the gate says the server could not be reached and keeps the session; a non-network failure (an account not linked to a
household) still signs out. `showView('recipes')` redraws the grid on entry, because a re-hosted photo can arrive while it is hidden.

### The functions worth knowing

| Function | What it does |
| --- | --- |
| `parseRecipe(text)` | Turns recipe syntax into `{title, source, sourceUrl, servings, groups, stages, notes, unread, ...}`. The single source of truth for the format. `unread` lists the lines it read past (a GROUP with a hyphen, a stray line under a STAGE), shown in the preview since 27 Sep; it changes nothing about what is parsed. |
| `computeColumns(groups, stages)` | Lays the flow out into rows and columns, returning `errors[]` for unknown handles or non-adjacent merges. A group's colour follows `paletteIndex` and `family` when `withPrepSteps` has split it (#88). A box that brings together two or more step outputs (not raw groups) is marked `merge` (15 Oct 2026), which only the Modernist style draws. A preparation step's output still counts as raw, and the raw set changes only between stages (18 Oct 2026). |
| `prepStepFor(line)` | The step an ingredient line's preparation reads as ("2 leeks, thinly sliced" → *Thinly slice the leeks*), from a fixed table, or `null` (#88, 13 Oct 2026). |
| `withPrepSteps(parsed)` | The recipe as drawn with preparation as steps: groups split in order, a one-input MERGE marked `prep` beside the step before the one that needs it. Used by the two viewers when the device's PREPARATION setting asks; never by the timeline, the preview or the shopping list. |
| `computeTimeline(groups, stages)` | Derives each step's start/end from stage order plus durations. Returns `null` if no step has a real duration — which is why the timeline strip auto-hides. Each step also carries `inputs` (the handles it waits for) and `handsOff` (23 Oct 2026); nothing in the arithmetic reads them. |
| `lineUpTimelines(timelines, mode)` (`core.js`) | Lines a group's timelines up for the Group Viewer: `'start'` starts every dish at 0; `'finish'` offsets each by the longest span less its own, so all end together (#87, 13 Oct 2026). `about` says the longest dish has an untimed or open-ended step. |
| `planToServe(timelines, serveAt, opts)`, `handsWindows(steps, opts)`, `ovenUse(dishes, ovens)`, `preheatOf(setup)`, `formatClock`, `defaultServeAt` (`core.js`) | The run sheet's planning half (23 Oct 2026, `docs/SPEC.md` §5.2), all pure, on one clock axis the caller picks (the page uses minutes since local midnight). `planToServe` puts `lineUpTimelines`'s arithmetic on the clock at an EAT AT and returns the steps flat (dish, index, inputs, handsOff, and `handsKnown`: whether that dish has any marked step) and `unmarked`, the dishes with none, which `needsHands` does not count; with `avoidClash` it moves the later of two overlapping hands-on steps earlier, with what feeds it, until none overlap (nothing moves later; bounded). `handsWindows` gives busy, clash and free (six minutes between busy stretches, default). `preheatOf` reads one °C figure and fan from a recipe's STEPS lines, or says why not; `ovenUse` assigns each oven step to an oven by setting, and reports where more settings are wanted at once than ovens, and recipes left out. `projectRun(plan, marks, now, starts)` and `runStatus(proj, now)` are the running half (24 Oct; `starts[dish][handle]` is when START was pressed on a step, which makes it running from then): `projectRun` re-draws a plan from which steps are done and when (`marks[dish][handle] = { at, direct }`) and returns the plan's own shape, so the rows and bars read it unchanged, and `runStatus` says what is going and what is next for the hands. The page side is `buildRun` (EAT AT is `state.eatAt` and the run is `state.cook`, each kept for the recipe or group open and never stored; `state.cook.marks[recipeId][handle]` is when a box was ticked, written by `mountFlow`'s `onTick`, and `state.cook.starts[recipeId][handle]` when START was pressed on it, written by `onStart` (caught on the way down, so the tap does not also tick the box); both are cleared with the ticks by `clearViewerTicks`; a box's START/DONE holder is `.box-run`, drawn by `boxRunHolder` and kept up to date by `updateBoxRun`), `runRowsHTML`, `runControlsHTML`, `runStatusHTML`, `wireEatAt` (EAT AT, AVOID THE CLASH, START and STOP COOKING) and, for the clock, `runUI` (set by each viewer when it draws), `refreshRunStrip` (replaces the strip only, never the flow table) and `runClockTick` (once a second: playhead and Now line in place, the strip when `runSignature` changes); the ovens count is `localStorage['kitchen.ovens']`. |
| `servingCalls(parsed)` and `matchSides(calls, sides, selfId)` (`core.js`) | What a recipe asks to be served with (an ingredient ending "to serve", "serve with rice or naan" in a step or note), and which Side recipes fit: 3 for the title or a keyword, 2 for every word, 1 for the head noun; two per phrase, three per dish. Advice only, drawn as the viewer's SERVE WITH line (#87, 13 Oct 2026). Never touches `TAIL_NOTES`, so no tick is re-keyed. |
| `groupedWith(recipeId, groups)` (`core.js`) | The recipes grouped with this one before, by distinct days then the latest; drawn as OFTEN WITH in the viewer and on the Planner, any course, two at most, never repeating SERVE WITH (#142, 13 Oct 2026). |
| `mountFlow(container, parsed, opts)` | Renders the diagram and wires tick-to-complete. `opts.tickKey` makes ticks survive a re-render. |
| `scaleRecipeSyntax(text, multiplier)` | Rewrites quantities in the raw text. Callers compute `multiplier = target ÷ base`; nothing scales by a raw multiplier any more. |
| `buildShoppingList(weekDays)` | Aggregates the plan into a shopping list. **Must stay side-effect free** — it runs on every planner change via `updateSidebarCounts()`. The naming and totalling are `aggregateShoppingLines` in `core.js` (since PR 6b); the page adds the week, the headcount, the household's word matches, the household's aisles (`applyAisleOverride`, PR 6 of the add-recipe plan) and each line's group, which says what a line with no amount is for ("+ extra to serve"). An aisle replaces a row's `category` after its key is final, so it never re-keys a tick. |
| `shoppingLine(rest, parsed)` (`core.js`) | One ingredient line → its key, the name to show, its aisle's dictionary row and its amount in a base unit. The rules, in order, are in its comment: brackets and the first comma go, then tail notes, size words and a leading count unit ("pinch of", "2 tins", and since 29 Sep, PR 1, with size words between the article and the unit: "a big handful of"); "tinned" is read as "canned" (`foldTin`, also in `dictionaryKey` and the source check, so a tin and a can are one product); garlic and celery carry their count at the end; bare "pepper" is black pepper by the spoon and the vegetable when counted; then the dictionary, then prep words. **One row per key**, whatever the units: parts that can't be added are shown side by side, `2 + 400 g`. |
| `dictionaryPhrases(row)` (`core.js`) | The wordings of one dictionary row: `live`, which the index reads (the name and each plain wording in `also`), and `skipped`, the pieces that carry a note (brackets, emphasis, backtick or quote mark, or "when", "not", "check") and name no single wording. One function so the index and `test/core.test.js` read a row alike, and the test pins that everything skipped carries a mark: an apostrophe once counted as a note, and `confectioners' sugar` was written in the file and never indexed (29 Sep, PR 7f). A row's rule is one product on the shelf under two names, never a substitute (`tools/ingredient-names-preamble.md`). |
| `ingredientLineFaults(line)` (`core.js`) | The standard-shape checks for one ingredient line, each marked `affectsList` when the shopping list can't total it (an alternative outside brackets, two ingredients on a line, cups or oz, a tin in ml, an amount inside the name). The add/edit preview shows only those, as warnings that never block a save; `validate-recipes.js` reports all (27 Sep, PR 6c-1). `suggestIngredientLine` offers a rewrite where there is one right answer. |
| `sourceFidelity(sourceLines, recipeLines)` (`core.js`) | Pairs a source's ingredient list with the recipe's lines and returns what differs: lines on one side only, and pairs that match but differ (`matched[].check`, with a `why`). Rebuilt 28 Sep (PR 7e) after it was found to catch one of eleven fault types, then again when the first rebuild proved tailored to its examples. Every line of one ingredient, on either side, is one group (connected by a same-ingredient pair), and the group's amounts are compared as **totals** per kind (mass, volume, count, a pinch as its own kind, a range by both ends) by `fidelityAmount` and `fidelityAgree`, only where a difference cannot be a unit conversion; cups against grams and a count against a weight are *unknown* and never warn. *Same* ingredient is two tiers: the same name (the dictionary's, or the same words) is exact; "the recipe's words are all in the source's" is looser and joins only lines with no exact partner. Compound lines split into parts. A recipe that adds a qualifier is a *soft note* (`matched[].note`) where the dictionary calls the two one product, else a hard difference. The design and its limits are the comment above the function; `test/core.test.js` runs it over every dictionary ingredient. Fed by the `source-ingredients` Edge Function from COMPARE WITH SOURCE, or by a list pasted into the box beneath it. |
| `pastedIngredientLines(text)` (`core.js`) | A source's ingredient list as pasted into the preview's box, one line each: tick boxes, bullets and blank lines stripped, and a heading dropped only when it certainly is one (no digit, and a colon, "For the…" or a section word). Narrow on purpose: a heading left in is a row to read past, an ingredient dropped is a line never checked. It feeds the same `sourceFidelity` as the function's list, for the sites that refuse the function (PR 7d, 28 Sep). |
| `strictMatchSuggestions(items, isSettled)` (`core.js`) | The pairs the list offers to merge, in place, never in a dialog: two names that share a last word and differ by one word not on `NEVER_IGNORE`, neither known to the dictionary as a different product. |
| `newRecipeReview({ lines, sourceUrl, recipeId, library, alias, isSettled })` (`core.js`) | The add form's read-only review of one recipe against the library (PR 3 of the add-recipe plan, 29 Sep 2026): its ingredient names, which the library already has and which are new, the aisle each new one lands in (Other flagged), which existing name a new one probably is (the strict rule, new name first, offered only where exactly one side is new) and any library recipe with the same source link. The recipe being edited (`recipeId`) is left out, so it never finds itself. Pure: it reads and returns, nothing is written, and the page shows it as advice. `test/validate-recipes.js` calls it too, with an empty library. |
| `sourceNoteIn(text)`, `normalisedSourceUrl(url)`, `linesHash(lines)` (`core.js`) | The converter's `⚠️ Source note:` line (its own line under NOTES, `converter/conversion-instructions.md` §1) and whether the same line says the recipe was not read from its own page; a source link made comparable (scheme, `www.`, query, fragment and trailing slash dropped, empty when it is not a link, so "Personal recipe" never matches); and FNV-1a of the ingredient lines, added for PR 5 to tell whether the lines changed since a comparison was recorded. |
| `changedHeaderKeys(text, fields)` (`core.js`) | Which of the eight header lines (`TITLE:`, `SOURCE:`, `SOURCE_URL:`, `IMAGE:`, `TIME:`, `SERVINGS:`, `EQUIPMENT:`, `TAGS:`) a save would change, by name, each tried on its own through `withUpdatedHeaderLine`, the function the save uses. A line that would be added or dropped counts; one that is missing and stays missing does not. It is what BEFORE YOU SAVE names (PR 4 of the add-recipe plan, 29 Sep 2026). |
| `readFormFields(source)`, `sourceAsSaved()`, `beforeSaveLines()`, `evaluateSourceSpelling()` (`index.html`) | The add form's answers in place (PR 4 of the add-recipe plan). `readFormFields` is the one place the form's fields are read, for the save and for BEFORE YOU SAVE alike, so the list cannot disagree with what is written. `sourceAsSaved` is the SOURCE as the save will record it: only a spelling settled before changes it. `evaluateSourceSpelling` is the row under SOURCE (`#sourceSpellRow`): a settled spelling is put in the field and said so, a spelling that looks like an existing source is asked about with USE THAT and KEEP MINE, each writing through `addAlias` at the tap. `beforeSaveLines` builds `#addBeforeSave`, and only the lines that apply. No dialog remains in the add path. |
| `fidelityCounts(f)`, `sourceCheckStatus(check, lines)` (`core.js`) | The comparison with the source page, recorded on the recipe (PR 5 of the add-recipe plan, 29 Sep 2026). `fidelityCounts` turns what `sourceFidelity` returns into the two numbers the table shows and the recipe records (`hard`, the "N to look at", and `soft`, the shaded notes), so the count drawn and the count recorded cannot differ. `sourceCheckStatus` says whether a recorded comparison is `fresh` (the ingredient lines hash to what they did when it ran), `stale` (they do not) or `none`; the viewer's chip, Edit's SOURCE section and BEFORE YOU SAVE all read that one rule. A keyword or a method step never makes one stale, because only the ingredient lines are hashed (`linesHash`). |
| `formComparison`, `renderProvenance(recipe)`, `storedSourceHtml()` (`index.html`) | `formComparison` is the comparison run in the open form, set whenever the table is drawn (`showSourceComparison`) and written by SAVE and by nothing else. `renderProvenance` draws the viewer's chips under `#viewerProvenance` (COMPARED … · NO DIFFERENCES / N DIFFERENCES, COMPARED BEFORE THE INGREDIENTS CHANGED, NOT COMPARED WITH ITS SOURCE, CARRIES A SOURCE NOTE); viewer only, never on a card. `storedSourceHtml` is the SOURCE section's line on Edit: the stored result with RE-CHECK, or that it is out of date, or that there is none. `recipeToRow` sends `source_check` only when the recipe has one. |
| `formPhotos`, `settleFormPhotos(id)`, `uploadSourcePhotos`, `removeSourcePhotoFiles`, `sourcePhotoUrl(path)` (`index.html`) | Source photos. `formPhotos` is the open form's pages, stored `{path, added}` or new `{added, blob, url}`, each shrunk in the browser to 2000 px (`shrinkSourcePhoto`). SAVE settles them once: uploads queued before the row, deletions after it, nothing if nothing changed. `sourcePhotoUrl` answers from this tab's own copy first, else a link signed for an hour. `sourcePhotosAvailable` is false when a load finds rows without the column, and ADD PHOTO then says so. `deleteRecipe` deletes the recipe's photos after its row. |
| `libraryCheckRows()`, `renderLibraryCheck()` (`index.html`) | Settings → LIBRARY CHECK (PR 8 of the add-recipe plan, 29 Sep 2026): every recipe with its standing against its source, read by the viewer chip's own rules (`sourceCheckStatus`, `sourceNoteIn`): reconstruction note, not compared, compared before the ingredients changed, *n* differences, no differences, or no source link to compare; and the names it puts in Other with the household's word matches and aisles applied. Those needing attention first, in that order. RUN reads and OPEN calls `openEditModal`; nothing is written from it. |
| `ingredientLookup(text)`, `renderIngredientLookup()`, `renderDictionaryList(filter)` (`index.html`) | Settings → INGREDIENT LOOKUP and DICTIONARY (PR 7 of the add-recipe plan, 29 Sep 2026). The lookup runs a typed wording through `aggregateShoppingLines` with the household's word matches and aisles, as `buildShoppingList` does, and shows what the list calls it (the dictionary's name, or "your own wording"), its aisle and why (`aisleWhy`), the word matches touching it from either side (with FORGET, the Word Matches removal) and the swaps for its name (`findSwapMatchesForKey`, with EDIT). The dictionary list is every row by aisle with its live wordings, filtered by the same box. Read-only apart from FORGET. |
| `queueWrite(label, fn)` | Background write queue. Returns `true` synchronously. |
| `rehostImageFor(id, sentUrl)` | Queued after a save. Asks `rehost-images` to copy one recipe's photo into our own Storage, if it is not there already. Never awaited by the save. |
| `applyRehostedUrl(id, sentUrl, newUrl)` | Writes the re-hosted URL back into the cached recipe — both `imageUrl` and the `IMAGE:` line — and discards a reply whose `sentUrl` is no longer current. |
| `withUpdatedImageLine(text, url)` | Reconciles the `IMAGE:` line in recipe syntax with a URL: replaces, inserts after `SOURCE`, or removes when the URL is blank. The image counterpart of `withUpdatedTitleLine`. |
| `hydrate()` | Loads everything into `cache` at sign-in. Throws = signed out. |

## 4. The database

Supabase Postgres. **16 tables in `public` and one in `private`**, all with row-level security on (read 12 Oct 2026); the 16
carry 52 policies between them, at least one each. RLS is driven by `private.household_ids_for_user()` — kept in a `private`
schema, granted only to `authenticated`, never to `anon`. `docs/INFRASTRUCTURE.md` §3 is the live card: counts, migrations
and what was applied when.

Every table of a household's data carries `household_id` from day one, when only one household existed. That
was a deliberate call in the brief: retrofitting it later, once data exists, is real rework. Three
households exist on 12 Oct 2026 (`docs/ONBOARDING.md`), and `recipe_shares` is the one table that
joins two of them.

### Tables in active use

| Table | Holds |
| --- | --- |
| `recipes` | The library. `syntax` is the real recipe; other columns are parsed from it. `source_check` (jsonb, nullable; PR 5 of the add-recipe plan) is what a comparison with the source page found: `{at, route, hard, soft, sourceLines, linesHash}`, written by SAVE when a comparison ran in that form session, never the page's text or a pasted list. Since 30 Sep 2026 it may also carry `validated` (an ISO time): the household pressed VALIDATE INGREDIENT LIST, accepting the list as it stands with whatever differences it has; `sourceCheckStatus` reports it only while the lines are the ones compared. A third `route`, `"photo"` (30 Sep, CHECKED AGAINST THE PHOTO), records that the lines were read by eye against the recipe's source photo: `hard` 0, `validated` at the same time as `at`, and the hash of the lines when the button was tapped. It is added by `docs/migrations/add-recipes-source-check.md`, which the household applied from the SQL editor on 29 Sep 2026 (checked read-only that day: `jsonb`, nullable). `source_photos` (jsonb, nullable, a list) lists the photos the recipe was converted from, `[{path, added}]` in page order (a PDF's entry, since 30 Sep, also carries `type: 'pdf'` and its file `name`); the files are in the private `recipe-sources` bucket under `<household_id>/<recipe_id>/`, shown by links signed for an hour. Sent only when a recipe has a list (an emptied list is sent as null), so an ordinary save is unchanged. Added by `docs/migrations/add-source-photos.md`, which the household applied on 30 Sep 2026. `copied_from` (uuid, nullable, no foreign key) is the other household's recipe a copy was made from by ADD TO OUR RECIPES; sent only on such a copy. Added by `docs/migrations/add-recipe-sharing.md`, with `recipe_shares` and the six functions that are the only way to read another household's recipes (the `recipes` policies are not widened). |
| `recipe_logs` | One row per time a recipe was cooked. **`ON DELETE CASCADE`** from `recipes` — deleting a recipe destroys its history. `premade` (boolean, default false; `docs/migrations/add-premade.md`) marks a dish eaten from the freezer rather than cooked: it is in the diary but left out of the recipe's `history`, so "last cooked", times cooked and the streak count only cooking. A pre-made row's id is worked out from the planned day (`premadeLogId`), so two devices write one row. |
| `keywords` | The tag vocabulary, ordered by `sort_order`. |
| `planner_days` | One row per planned day. `recipe_ids uuid[]` plus a **parallel `servings smallint[]`** — index *n* in one matches index *n* in the other, `0` meaning "as the recipe is written". Since PRE-MADE a third parallel array, `premade text[]`: `''` for fresh, or the meal a dish from the freezer is eaten as; padded like `servings`, and sent only once the column exists. Since P3 (`docs/migrations/add-calendar-push.md`, 9 Oct 2026) two booleans per day, `calendar` and `calendar_remind`: the Planner's switches for putting the day in the Google calendar and the evening-before reminder. Since 20 Oct 2026 (`docs/migrations/add-calendar-items.md`) a fourth parallel array, `calendar_items text[]`: `''`, `'in'` or `'remind'` per dish, so the reminder belongs to a meal (a group is one) and not the day; `calendar` and `calendar_remind` stay as "some dish is in" and "some dish has the reminder". Padded like the others, and sent only once the column exists. |
| `meal_groups` | Recipes cooked together on a day. `recipe_ids uuid[]`, no foreign key. |
| `shortlist_items` | Ideas not yet planned. `recipe_id` is `ON DELETE SET NULL`. |
| `ingredient_swaps` | Personal substitutions with a scaling ratio. |
| `shopping_checked` | Ticked items, keyed by `week_start` + `item_key`. **`item_key` is the row's key**, the ingredient's name alone since PR 6b (with a `both\|` prefix for the both-weeks list), so a recipe changing its unit keeps the tick but anything that changes how items are *named* re-keys them. Until 25 Sep it was `name\|unit`; those rows are deleted at start-up by `purgeOldFormatTicks`. |
| `aliases` | Word matches. `kind` is `source`, `ingredient`, `source_distinct` or `ingredient_distinct` — the `_distinct` kinds record "these are *not* the same" so the app stops asking. Ingredient matches are re-normalised through `shoppingKeyForName` as they load, so a match stored in the old normaliser's words still applies; the stored rows are never rewritten. |
| `aisle_overrides` | The household's aisle for an ingredient (PR 6 of the add-recipe plan, 29 Sep 2026): `name` is the shopping list's key for it (`shoppingKeyForName`), `aisle` one of `INGREDIENT_AISLES`, unique on `(household_id, name)`. Set in Settings → Shopping Aisles or from the add form's review; applied by `aggregateShoppingLines` after the key is final. Created by `docs/migrations/add-aisle-overrides.md`, which the household applied on 29 Sep 2026. **`hydrate()` reads it apart from the other tables and does not throw when it is missing**: the feature is then unavailable and says so. |
| `recipe_notes` | Dated cooking notes (R4, 30 Sep 2026): `body`, and `created_at` as the note's date, sent by the app and never changed; one row per note, written by ADD, EDIT (the text only), DELETE and UNDO, and by the meal prompt's ADD A NOTE (`addRecipeNote`), and deleted by FOLD INTO NOTES once the recipe's text carrying it is saved. Cascades on recipe delete. Made in Phase 1 and unused until R4. Read apart like `aisle_overrides`: a failure leaves the notes unavailable and signs nobody out. In the JSON export as `recipeNotes`. |
| `household_settings` | One row per household (every household has one since 12 Oct 2026, `docs/migrations/harden-default-privileges.md`; read with `.maybeSingle()` all the same). `week_start_day` (0=Sunday, default 5=Friday), `dark_mode`, and for P3 `calendar_remind_at` (minutes after midnight, default 1200), `calendar_auto` and `calendar_auto_remind` (both off by default), and `converter_ack_version` (#127: the version of the converter instructions the household last confirmed with DONE; empty until then; `docs/migrations/add-converter-ack.md`, applied 13 Oct 2026; the app shows no reminder where the column is missing). |
| `households`, `household_members` | Identity. `hydrate()` reads the signed-in user's `household_members` row to set `HOUSEHOLD_ID`, so the app carries no household constant, and since 12 Oct refuses an account in two households rather than guess. `households.name` is the name other households see, set from Settings → APP → RECIPE SHARING through `set_household_name` since 10 Oct 2026. |
| `recipe_shares` | Who may browse whose recipes (10 Oct 2026): `(owner_household, viewer_household)`, one row per direction. The app has one select policy and `SELECT` alone on it; every change, and every read of another household's recipes, goes through the six `security definer` functions in `docs/migrations/add-recipe-sharing.md`, so the `recipes` policies are never widened. |
| `calendar_connections` | One row per household connected to Google (P3, 9 Oct 2026): whether it is connected, the account, the calendar, the scope, the last sync and error, and since 10 Oct the Drive backup's folder, last backup and last error. **Never the token**, which is in Vault. The app has one select policy and `SELECT` alone: only the Edge Functions, as the service role, write it. |
| `private.calendar_oauth_states` | The one-time values for Google's consent step, ten minutes each (9 Oct 2026). RLS on and no policy, and no grant to any API role, the service role included: the Edge Functions reach it only through the `calendar_*` functions, which only the service role may run. |

### Schema that exists but nothing uses yet

Created in Phase 1 in anticipation of Phase 3 features. **Not dead schema — just early.** Worth
knowing so nobody assumes the feature exists because the column does (which is exactly the
mistake that made the image work look finished):

| Column / table | Waiting on |
| --- | --- |
| ~~`recipe_notes`~~ | R4 shipped 30 Sep — no longer scaffolding |
| ~~`recipe_logs.meal_type`~~ | H1 shipped 22 Sep — now written by the prompt after logging |
| `recipe_logs.note` | Round-tripped by the diary since 22 Sep (read, written back unchanged, and carried by export and import) but still no UI sets it: R4 put dated cooking notes in `recipe_notes` instead, and the meal prompt's ADD A NOTE writes a `recipe_notes` row (`closeMealTypePrompt` → `addRecipeNote`), not this column. No row carries one (12 Oct 2026). Deliberately **not** used by H2: an ad-hoc entry's name lives in `recipe_logs.title`, added 22 Sep, so "a takeaway called X" and "a note about recipe Y" stay distinguishable |
| ~~`household_settings.dark_mode`~~ | S2 shipped 22 Sep — no longer scaffolding |
| `meal_groups.name` | Written as `''`; no UI ever names a group |
| ~~`households.name`~~ | Written by `set_household_name` since 10 Oct 2026 (recipe sharing) — no longer scaffolding |
| `household_members.role` | Multi-household support, deliberately anticipated; nothing in `index.html` reads it (`docs/ONBOARDING.md`) |

### Storage

Two buckets (12 Oct 2026), each with four policies on `storage.objects` keyed on household membership, so a caller writes,
deletes and lists only under its own household's folder:

- `recipe-images` — **public, 35 objects.** Public affects only the `/object/public/` read endpoint, so it is
  readable-if-you-know-the-path rather than browsable. A recipe's photo, at `<household_id>/<recipe_id>.<ext>`.
- `recipe-sources` — **private, 4 objects** (30 Sep 2026). The photos and PDFs a recipe was
  converted from, under `<household_id>/<recipe_id>/`.

**The app reads and writes Storage directly** — this section said it did not until 12 Oct 2026 (the October review, F12):

- `recipe-sources`: SAVE uploads a recipe's new source photos and deletes the removed ones (`settleFormPhotos`,
  `uploadSourcePhotos`, `removeSourcePhotoFiles`), and `sourcePhotoUrl` asks for a link signed for an hour to show one.
  `deleteRecipe` deletes the recipe's photos after its row.
- `recipe-images`: UPLOAD PHOTO puts a photo of the household's own there at SAVE (`uploadRecipePhoto`, 11 Oct, issue #92),
  and ADD TO OUR RECIPES copies a shared recipe's photo into the household's own folder (`copySharedImage`, 10 Oct).

A photo **elsewhere on the web** is still moved server-side, by `supabase/functions/rehost-images/`: most recipe CDNs send no
CORS headers, so a browser could not read those bytes to re-upload them, and that is what forces this work into an Edge
Function rather than a preference. The app compares a URL with the bucket's public prefix (`SELF_HOST_PREFIX`) to decide
whether a photo is already ours.

### Edge Functions

Five, one directory each under `supabase/functions/`; `find-recipe-image` was deleted from the repo (#102) and from the
project (12 Oct 2026). `index.html` makes **seven `functions.invoke` calls to the five**:

| Function | Called from |
| --- | --- |
| `rehost-images` | `rehostImageFor`, queued after a save when the recipe's image URL is not already ours; `runImageSweep`, behind the two Settings buttons |
| `source-ingredients` | `compareWithSource`, the preview's COMPARE WITH SOURCE |
| `calendar-auth` | `connectCalendar` and `disconnectCalendar`, CONNECT and DISCONNECT. Google's callback reaches the function directly, which is why it is the one deployed with JWT verification off |
| `calendar-sync` | `queueCalendarSync`, queued after a Planner change to a day in the calendar; every day from today on connecting and on SYNC NOW |
| `drive-backup` | `saveToDrive`: the weekly backup the app sends by itself on a load, and SAVE TO DRIVE NOW |

Both `rehost-images`
callers write the returned URL back into `cache.recipes`, which is not optional: the next save of that recipe from the edit
form upserts its whole row from the cache, so a cache left holding the old URL would push it back over the row *(until PR 5
any favourite toggle rewrote every recipe and was enough to do it)*. See `docs/IMAGES.md` §5, and `docs/INFRASTRUCTURE.md` §3
for what is deployed and how to deploy.

## 5. Testing

`test/` holds an offline harness that boots the real `index.html` against a fake Supabase
(`test/stub.js`) and walks every screen.

```sh
node test/core.test.js                    # the pure core in Node, about two seconds, no browser
npm install --no-save playwright@1.63.0   # once; the version CI pins
node test/build.js                        # bake index.html (with core.js inlined) against the stub
node test/smoke.js                        # the browser suite; exits non-zero on failure; slow (many minutes)
```

`CLAUDE.md` lists the smaller suites that run in Node beside these (the Edge Functions' and the help guide's). Read the exit
code, not the number of `ok` lines.

**`test/build.js` is not optional and not cached.** `smoke.js` loads `test/app-under-test.html`,
which `build.js` writes from `index.html`. Run `smoke.js` without rebuilding and you are testing
the previous edit — which will happily report a pass, or a failure belonging to code you have
already changed. Always run the pair.

It has caught real bugs, including a parser gap that would have broken every reprocessed recipe.
**But it stubs the backend entirely** — sign-in, hydration, RLS and the write queue are never
exercised, so a green run says nothing about whether the app can actually talk to Supabase.
Keep Awake can only be tested on a real tablet.

## 6. Repo layout

| Path | What it is |
| --- | --- |
| `index.html` | **The app**: markup, styles, data layer, every screen. |
| `core.js` | The pure functions and the ingredient dictionary's master copy, loaded by `index.html` (since 25 Sep 2026). |
| `tools/generate-ingredient-names.js` | Writes `converter/ingredient-names.md` from the dictionary in `core.js`; `--check` fails if they differ. |
| `tools/remeasure.js` | Totals an app export (kept **outside** the repo) with the app's own `core.js` and reports rows, likely splits, "Other" rows (after the household's aisle overrides, as the list shows them), lines the list can't total and lines the parser reads past. Refuses a file inside the repo. Run every ten or so new recipes (27 Sep). |
| `supabase/functions/` | Edge Functions, five directories (12 Oct 2026). `rehost-images` is the image re-hosting sweep (R7); `source-ingredients` (27 Sep) returns a source page's own ingredient list, read-only, for the preview's source check; `calendar-auth` and `calendar-sync` (P3, 9 Oct) connect the household's Google calendar and write the planned days to it; `drive-backup` (10 Oct) saves the backup file to the household's Google Drive. All need a signed-in caller but Google's callback into `calendar-auth`, which carries a one-time value instead. `find-recipe-image` was removed on 11 Oct (#102, the October review's F3). See `docs/IMAGES.md` and `docs/INFRASTRUCTURE.md`. |
| ~~`index-old.html`~~ | **Removed 12 Oct 2026** (the October review, F9). The pre-Supabase version, renamed from `index.html` on 17 Aug. It was not "not served", as this row used to say: Pages served it at the app's address with `index-old.html` appended, with no sign-in, and its seed data carried complete recipes. It is still in git history (`git show c19020f:index-old.html`); the household chose not to rewrite history for it. |
| `converter/` | Conversion instructions and the standing test set for writing recipes. |
| `test/` | Offline test harness. |
| `docs/` | The reference documents: `STATUS.md` (read first), `SPEC.md`, this file, `INFRASTRUCTURE.md`, `IMAGES.md`, `ONBOARDING.md`, `TEST-PLAN.md`, `HOUSEHOLD-JOBS.md`, `BUILD-BRIEF.md`, and `migrations/`. |
| `.mcp.json` | Wires the Supabase connector for Claude Code automatically. |
