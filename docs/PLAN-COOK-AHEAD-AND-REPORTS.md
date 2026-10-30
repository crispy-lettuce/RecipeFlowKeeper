# Plan: COOK AHEAD on the Planner (#221), and reporting a bug or idea from the app (#198)

Written 30 Oct 2026 against `main` at `5be6e96`. The household's answers to the open questions were given in that day's
session and are recorded in §1.3 and §2.2. Neither feature is built. This file is deleted by the PR that builds the
second of the two, which also updates `docs/SPEC.md` (CLAUDE.md, "How the documents are kept").

They are separate PRs and nothing ties them together. **#198 goes first:** it is small, needs nothing from the household
before merging, and touches none of the code #221 changes. #221 carries a schema change, which the household applies
before it merges.

---

## 1. COOK AHEAD (#221)

### 1.1 What the issue asks

Each dish on the Planner gets a third state. The three, and what each counts towards:

| State | Cooking stats (last cooked, times cooked, streak, STATS) | Food diary (the History calendar) | Shopping list |
| --- | --- | --- | --- |
| **TO COOK** (as now) | yes, once logged | yes, once logged | yes |
| **COOK AHEAD** (new) | yes, once logged | **no** | yes |
| **PRE-MADE** (as now) | no | yes, by itself on its day | no |

The case it covers: a batch cooked today for the freezer. Cooking it is cooking, so it counts; nobody ate it today, so it is
not a meal in the diary. When the portions are eaten later, those days are PRE-MADE as they are now.

The shopping-list column is not in the issue. It is read from what the state means: a dish being cooked needs its ingredients.

### 1.2 How the app holds these now

- A Planner day keeps `premade` (`planner_days.premade text[]`) parallel to `recipe_ids` and `servings`: `''` for a dish cooked
  fresh, or the meal it is eaten as. `planPremade`, `withPremade` and `planEntries` read and write it.
- The diary and the cooking stats are both built from `recipe_logs`. `hydrate()` builds each recipe's `history` (the source of
  last cooked, times cooked, the streak and `computeHistoryStats`) from every row with a recipe that is not `premade`. The
  History calendar (`historyByDate`), its day detail and the CSV read `cache.diary`, which is every row.
- So "counts in stats but not in the diary" is a log row that `history` takes and `historyByDate` and the CSV leave out.

### 1.3 Decided (30 Oct 2026)

1. **A cook-ahead dish counts when it is logged, as TO COOK does:** COOKED ✓ on the Planner, or ticking the last column of
   the recipe. Not by itself on its day. There is no meal question afterwards, because it is not eaten that day.
2. **Undo is on the Planner.** The logged dish reads ✓ COOKED AHEAD; tapping it asks "Take this out of the cooking stats?" and
   removes that log row. (A cook-ahead row is not in History, so History's REMOVE cannot reach it.)
3. **The control is a chooser.** The pill reads TO COOK, COOK AHEAD or PRE-MADE · DINNER. Tapping it opens a small dialog
   with the three; PRE-MADE then asks for the meal, as now. A row stays one pill wide, which matters at phone width.

### 1.4 Assumed, and easy to change at review

- **Google Calendar:** a cook-ahead dish is listed on its day like any dish to cook. `calendar-sync` is not changed, so no
  Edge Function redeploy is needed. (It reads only `premade`, and a cook-ahead slot there is `''`.) Adding "(cook ahead)" to
  the event description would be a later, separate change, with a redeploy.
- **The diary CSV leaves cook-ahead rows out**, since it is the food diary. EXPORT DATA (and so the Drive backup) keeps them,
  marked, because it is the backup.
- **Changing the state does not touch a log already made**, as switching PRE-MADE off today keeps its diary entry. Undo is
  the ✓ COOKED AHEAD tap.
- **Finishing the flow of a recipe that is COOK AHEAD today** logs it as cooked ahead with no question. (Only PRE-MADE asks
  "Cooked fresh, or from the freezer?")
- **One log per recipe per day stays the rule** (`logRecipeUsed` returns if `history` already has the date). A recipe planned
  twice on one day, once TO COOK and once COOK AHEAD, logs once, as whichever is logged first.

### 1.5 Schema: a new page in `docs/migrations/`, `add-cook-ahead.md`

```sql
begin;
-- Per planned item, parallel to recipe_ids, servings and premade: true for a dish cooked today to be eaten another day.
alter table public.planner_days add column cook_ahead boolean[] not null default '{}';
-- A log row that is cooking but not a meal: in the recipe's history and the stats, left out of the food diary.
alter table public.recipe_logs add column cook_ahead boolean not null default false;
alter table public.recipe_logs add constraint recipe_logs_not_premade_and_cook_ahead check (not (premade and cook_ahead));
commit;
```

**Why new columns, not a new value in `premade`:** `calendar-sync` reads any non-empty `premade` slot as "from the freezer"
(`supabase/functions/calendar-sync/index.ts`, `eventsForDay`). A value such as `'ahead'` there would put "(from the freezer)"
on the event and need a redeploy. `recipe_logs` needs a column either way. Both existing household policies cover new
columns, so no policy or grant changes.

**Order:** the household applies it first, then merges (CLAUDE.md). The app also checks for the column the way it checks for
`premade` (`select('cook_ahead').limit(1)`, read apart, so a failure means "not yet" and never signs anyone out). Until the
column exists it offers no COOK AHEAD and no save names the column, so the order is safe either way. The migration page
says so. The page is tested on a scratch Postgres if one can be run in the session; otherwise the PR says "not verified".

### 1.6 Changes in `index.html` (`core.js` is not touched, so its version does not move)

1. **Load (`hydrate`).** Add the `cook_ahead` probe and set `cookAheadAvailable`. `history` keeps taking every
   recipe row except `premade` (cook-ahead rows are cooking). `rowToDiaryEntry` carries `cookAhead: true` only when true, as
   `premade` does.
2. **Planner storage.** Add `planCookAhead(entry)` and `withCookAhead`, alongside `planPremade` and `withPremade`, with
   `planEntries` returning `cookAhead` too. The parallel arrays are spliced in about six places (`deleteRecipe`,
   `addPlanRecipe`, `setPlanServingsAt`, `removePlanRecipeAt`, the planner UNDO, `rowToPlanEntry`), and each must carry the
   new one. Fold that into one helper that rebuilds a day's arrays from a kept list of entries, so a later column cannot be
   missed in one of them. `pushPlan` and `savePlanDay` send `cook_ahead` only when `cookAheadAvailable`. An item is never
   both PRE-MADE and COOK AHEAD: setting one clears the other.
3. **The chooser.** It replaces `premadePill`'s toggle and reuses the existing modal pattern of the `premadeOverlay`
   ("Which meal is it for?"). The heading is "How is this dish made?", with TO COOK, COOK AHEAD and PRE-MADE as 44 px buttons;
   PRE-MADE goes on to the meal question. Toasts say what changed ("Cook ahead: on the shopping list, and into the cooking
   stats when you tap COOKED ✓, not into the food diary").
4. **Logging.** `logRecipeUsed(id, date, { cookAhead })` writes the row with `cook_ahead: true` and skips
   `promptForMealType`. `addDiaryEntry` takes the flag and names the column only on those rows. COOKED ✓ on a cook-ahead
   dish and `finishRecipe` for a dish that is COOK AHEAD today both pass it. `cookedPill` shows ✓ COOKED AHEAD for a
   cook-ahead log, with a button that confirms and then `deleteDiaryEntry`s it. `deleteDiaryEntry`'s "still logged" check
   already counts cook-ahead rows as history, which is right.
5. **Kept out of the diary.** `historyByDate`, `renderHistoryDayDetail` and the diary CSV skip `cookAhead` entries. Nothing
   else filters `cache.diary` for display.
6. **Export and import.** EXPORT DATA carries `cookAhead` on diary entries and on plan days. The import path and
   `replaceAllDiary` / `replacePlan` keep it only when `cookAheadAvailable`, as they do `premade`.
7. **Shopping list.** `buildShoppingList` skips only `premade`, so it is unchanged. A check is added to prove it.

### 1.7 Checks to add (each broken once and seen failing by name, CLAUDE.md step 3)

In `test/smoke.js`, beside the PRE-MADE block, using its `__STUB_COLUMNS__` mechanism:

- Without the column: no COOK AHEAD in the chooser, and a saved day does not name `cook_ahead`. With it: the chooser shows
  three choices.
- COOK AHEAD on a dish: the sent row has `cook_ahead: [true]` and `premade: ['']`; then PRE-MADE on the same dish clears it.
- COOKED ✓ on a cook-ahead dish: one `recipe_logs` insert with `cook_ahead: true`, no meal prompt, the date in the recipe's
  `history`, the STATS total up by one, and nothing on that History day or in the CSV.
- ✓ COOKED AHEAD, confirmed: the row is deleted and the date leaves `history`.
- Finishing the flow of a dish that is COOK AHEAD today logs it as cooked ahead without the fresh-or-freezer question.
- The shopping list includes a cook-ahead dish's ingredients, and a removed dish takes its `cook_ahead` slot with it (the
  arrays stay aligned).
- A loaded row with `cook_ahead: true` is in `history` and not in `historyByDate`.

Then `node test/core.test.js`, `node test/build.js && node test/smoke.js` and `node test/help-guide.js`, reading each exit code.

### 1.8 Documents in the same PR

`changelog.json` (new top entry, #221) and `APP_VERSION`; `help.html` §"From the freezer, and cooked" becomes the three
states, naming COOK AHEAD and ✓ COOKED AHEAD as they read; `docs/SPEC.md` §5.5, §5.8, §6.12 (a sentence beside "Eaten is not
cooked": cooked ahead is not eaten) and §7; `docs/INFRASTRUCTURE.md` §3 lists the migration as waiting;
`docs/HOUSEHOLD-JOBS.md` gets a job: apply the migration (with what the check query shows), then on the tablet in Test
Kitchen, set COOK AHEAD, tap COOKED ✓, see STATS move and History not, and undo it.

### 1.9 Risks

- **An open tab from before the merge** reads a cook-ahead row as an ordinary cooked meal (it shows in that tab's diary) until
  the UPDATE bar's RELOAD. Saving a day from it leaves `cook_ahead` as it was, because the upsert does not name the column. If
  that tab also removes a dish, the arrays can fall out of line on that day. The version bar is the mitigation, as it was for
  `premade`.
- **The parallel-array splice** is where a bug would hide. That is why §1.6.2 puts it in one helper and §1.7 checks that the
  arrays stay aligned.

---

## 2. Reporting a bug or idea from the app (#198)

### 2.1 What the issue asks

"Add the ability for users to add GitHub 'create new issue' items from the app itself. Offer 'bug' or 'idea' prefixes."

### 2.2 Decided (30 Oct 2026)

**Everyone who would use it has a GitHub account, so the app opens a prefilled GitHub "new issue" page.** The person reads it
there and taps Submit. There is no token, secret, Edge Function or schema change, and the app never writes to GitHub itself.

### 2.3 What it looks like

In Settings → HELP, a section **REPORT A BUG OR AN IDEA**:

- Two buttons, **BUG** and **IDEA** (one pressed; BUG by default), a short title box, and a box for what happened or what you
  would like.
- A line above the button: *Reports go on the app's public GitHub page. Don't include recipe text or anything personal.*
- **OPEN ON GITHUB ↗** (disabled until the title has something in it) opens
  `https://github.com/crispy-lettuce/RecipeFlowKeeper/issues/new?title=…&body=…&labels=…` in a new tab:
  - title: `Bug: <title>` or `Idea: <title>`;
  - label: `bug` or `enhancement` (both exist on the repository, checked 30 Oct). GitHub applies a label from the link only for
    someone allowed to label issues. Others' reports arrive unlabelled but keep the prefix, which is why the prefix is there;
  - body: the description, then a short "From the app" block: app version, core version, which screen and tab it was opened
    from, style and theme, screen size and the browser. **No** recipe names, household id, email or any other content.
- A QUICK ANSWERS link in the HELP tab ("How do I report a bug or suggest an idea?") goes to a new section in `help.html`.

### 2.4 Changes

- `index.html`: the section's markup and a pure function `issueUrl({ kind, title, description, context })` that builds the URL,
  kept in `index.html` beside its one caller. The description is capped so the whole URL stays under about 8 000 characters,
  which GitHub accepts; past the cap the box says so rather than cutting the text silently. `rel="noopener"`, as the other
  GitHub links have.
- `help.html`: the new section, naming REPORT A BUG OR AN IDEA, BUG, IDEA and OPEN ON GITHUB as they read.
- `changelog.json` (new entry, #198) and `APP_VERSION`; `docs/SPEC.md` §5.9 (HELP) and §6.10.

### 2.5 Checks to add

In `test/smoke.js` (window.open stubbed to record the URL):

- The button is disabled with an empty title.
- BUG plus a title opens a URL whose title starts `Bug: `, whose label is `bug`, and whose body has `APP_VERSION`. IDEA gives
  `Idea: ` and `enhancement`.
- The body has no household id and no recipe title from the stub library.
- Characters that need encoding (`&`, `#`, `?`, a line break, an accented letter) come back intact when the URL is decoded.
- A description over the cap is refused with the message, not truncated.

`test/help-guide.js` covers the new labels and the QUICK ANSWERS link.

### 2.6 What is not verified offline

That GitHub opens the form filled in, and that the label lands, on the household's tablet and phone. That goes in
`docs/HOUSEHOLD-JOBS.md` as one step: file a test report from each device, see it on GitHub with its prefix and label, then
close it.
