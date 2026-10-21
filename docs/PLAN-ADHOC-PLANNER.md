# Plan: ad-hoc entries on the Planner

**Written 21 Oct 2026** (date from `date -u`), in a planning session that changed no code. Checked against `main` at `cd2c8b4` plus
PR #180 (the recipe card opening at the day's SERVES), by reading the code. Nothing was run against the live app or the live
database. The household asked for it: put things on the Planner that are not recipes (a takeaway, eating out, leftovers), **of the
same type as the "+ ENTRY" button on History adds.**

**Who this is for.** An implementation session taking one PR at a time. Each PR in §7 says what to change, the checks to add and the
mutation that must make each fail. If anything here disagrees with the code, the code wins and the disagreement is reported, not
worked around.

**How to read it.** **Fact** means read in the code on 21 Oct. **Decided** means the household said so. **Recommendation** is this
document's choice, open to being overruled. §9 lists what the household still has to answer, each with a recommended default.

---

## 0. In one paragraph

Each day on the Planner gets a second button beside **CHOOSE A RECIPE** / **ADD ANOTHER** that adds something that is not a recipe.
It opens the dialog History's **+ ENTRY** already opens (what it was, the day, an optional meal), set to that day. Saving writes the
same kind of row History writes: a `recipe_logs` row with no `recipe_id`, a title and a date, here a date ahead. The Planner draws
the day's ad-hoc rows under its recipes, with the meal and an AD HOC tag, and an **×** to take one off. There is **no schema
change, no Edge Function change and no new table**, so no SQL for the household to apply. The shopping list and the calendar do not
see these entries at all.

---

## 1. Why this shape

**Decided (21 Oct):** the Planner should take ad-hoc entries, and they should be the type History's **+ ENTRY** uses.

**Fact: what that type is.** `addDiaryEntry({ title, cookedOn, mealType })` inserts one `recipe_logs` row with `recipe_id` null, the
name in `title`, a meal type or none, and a note or none. The table's check `recipe_logs_identifies_something` wants a recipe or a
title. History reads it back through `historyByDate`, tags it `adHoc: !e.recipeId`, and draws it as plain text, not a link, with
the `diary-adhoc` rule. The dialog is `#adHocOverlay` (open with `openAdHocEntry`, save with `saveAdHocEntry`), and the name box
suggests names already used (`adHocTitleSuggestions`).

**Fact: History already holds future dates.** The dialog's date box has no `max` and `saveAdHocEntry` only checks that a date was
given. So an ad-hoc row dated ahead is something the app can already hold, store and show today.

**So the simplest honest answer is to make the Planner a second way into that same row.** One entity, two screens. Nothing is
logged later (unlike PRE-MADE, which writes its diary row on the day): the row already exists, and when the day arrives it is
already in History, with no extra step.

### The two other ways, and why not

| | A. Parallel array on `planner_days` | B. A new table | **C. Diary rows dated ahead (this plan)** |
| --- | --- | --- | --- |
| Schema change | One column (`adhoc text[]`), plus a placeholder uuid in `recipe_ids`, which is `uuid[]` | A table, its policies and grants, and the household applies it first | **None** |
| Same type as History's entry | No: a second representation, copied into the diary on the day | No, likewise | **Yes: the same row** |
| Touches what already reads the plan | Everything that reads `recipe_ids` now meets an id that is no recipe: the "Recipe removed" row, the shopping list, `calendar-sync`, groups, the delete-a-recipe cleanup, counts | Little | **Nothing that reads the plan** |
| History of this repo | Parallel arrays must be kept in step in every place a dish moves; deleting a recipe once dropped PRE-MADE from the other dishes (F14, `docs/HANDOVER.md`) | | |
| Cost | | A migration page, the INFRASTRUCTURE card, export and import, the backup list | **Small** |

A would work: `calendar-sync` skips an id with no recipe (`if (!title …) return`) and `buildShoppingList` skips an orphan quietly, so
neither would break. But the Planner would draw each one as "Recipe removed" until every consumer was taught otherwise, and it would
be a second thing to keep in step with `servings`, `premade` and `calendar_items`.

**Fallback if the household dislikes future rows in the diary: B** (§9 Q1).

---

## 2. What the household sees

- **A new button on every day that is not marked away.** On an empty day, next to **CHOOSE A RECIPE**; on a day with dishes, next
  to **ADD ANOTHER**. Wording is §9 Q3; this plan uses **ADD SOMETHING ELSE**.
- **The dialog.** The History one, reused: **WHAT WAS IT** with the names already used, **DATE** set to the tapped day, the four
  meal buttons (optional, tap again to clear), **ADD**. Its heading and sub-line say "Add to the Planner" and "For something on this
  day that has no recipe card", not "diary entry" and "something you ate".
- **On the day.** After the recipes (History's own order: recipes first, then ad-hoc, each by name): the name as plain text, its
  meal as a small pill if one was given, an **AD HOC** tag where a recipe shows its course, and **×**. No SERVES, no PRE-MADE, no
  COOKED ✓ (it is already in the diary), no calendar buttons.
- **Taking one off.** **×** removes the row (`deleteDiaryEntry`). A day still to come: no question, nothing was eaten. Today or
  earlier: the same question History's **REMOVE** asks, because it is history by then.
- **History.** Unchanged. The entry is there already, on its day, as an ad-hoc entry.

---

## 3. Facts to build against

- **The day is drawn in `renderPlannerDays`** (`#dayList`). Its branches are `entry.blank` (the AWAY banner), `ids.length` (rows) and
  empty (one **CHOOSE A RECIPE** button). A day with only ad-hoc entries has no `planner_days` row, so `ids` is empty: that branch
  must show the ad-hoc rows and the **CHOOSE A RECIPE** button together.
- **`cache.diary` is the source.** `loadDiary()` is in memory, loaded by `hydrate` with `select('*')` and no date filter, and
  replaced by `refreshLibrary`; no new read.
- **Who else reads the diary** (so this is the whole audit list): `historyByDate` (two callers, the History calendar and its day
  detail), `exportDiaryCsv`, `exportAllData` and the restore (`importAllData`), `adHocTitleSuggestions`, `logDuePremade` (ids
  only) and the PRE-MADE look-ups. Nothing counts diary rows for cooking: "last cooked", times cooked and the streak read each
  recipe's `history`, which an ad-hoc row never joins (`recipe_id` null).
- **Each ad-hoc row is its own row with a client id** (`uid()` in `addDiaryEntry`), written as one insert keyed
  `recipe_logs:<id>`. Two devices adding the same thing write two rows; that is as History behaves now.
- **Backups already cover it.** The export carries the whole diary, and the nightly backup is a dump of the `public` schema (`docs/HANDOVER.md` §5), which includes `recipe_logs`; no change.
- **`buildShoppingList` and `calendar-sync` read `planner_days` and recipes only.** They never see a diary row, so neither can
  be changed by this, and `calendar-sync` is not redeployed.
- **Grouping.** GROUP SOME TOGETHER lists a day's recipe rows (`isGroupingThisDay`); ad-hoc rows are not offered to it.
- **The sidebar's "N recipes planned this week"** counts recipe ids, so a week with only a takeaway still says nothing is planned.
  That is right for a line that sits over the shopping list.

---

## 4. What it deliberately does not do

- No calendar entry for an ad-hoc item (§9 Q7). So no `calendar-sync` change.
- Nothing on the shopping list.
- No SERVES or PRE-MADE on it.
- No editing of the name in place: take it off and add it again. (The meal can be changed, PR 2.)
- No "didn't happen" state: taking it off is that.
- It is not offered to GROUP SOME TOGETHER.

---

## 5. Edge cases and the rule for each

| Case | Rule |
| --- | --- |
| A day marked **AWAY** | No add button (undo the away first). If the day already has ad-hoc rows, they stay drawn under the AWAY banner, so an entry is never hidden. |
| Many entries on one day | No limit; they list. |
| The same name twice | Two rows, as in History. |
| Opened from History on the same day | Same row, same dialog code; either screen shows it at once (shared cache). |
| Tab hidden and shown (`refreshLibrary`) | The diary is replaced from the server; the Planner redraws as it does for plan days. |
| Adding offline | The write queues like any other (`queueWrite`); the row is in the cache at once. |
| A day in the past on the Planner | The Planner shows today onward, so past ones are History's. |
| Deleting a recipe | Untouched: ad-hoc rows have no recipe. |
| **A shortlist item is selected** | The Planner's day-tap handler assigns it to the day unless the tap was on one of a listed set of buttons (`setServes`, `calToggle`, `calRemind`, `premade`, `cooked`). The new button's action goes on that list, or tapping it would assign the shortlist item instead of opening the dialog. |
| Name and date empty | The dialog's own corrections ("Give it a name…", "Pick a date.") apply unchanged. |

---

## 6. Risks

1. **A future-dated row is "in the diary" before it happens.** History shows it; the CSV lists it as "Ad hoc". That is already true
   of anything entered with a future date today, but it becomes the normal case. If the household does not want planned things in the
   diary, B (§9 Q1) is the way.
2. **A plan that does not happen** leaves a row nobody removes, and the day later reads as eaten. Mitigation is the visible **×**
   on the Planner; nothing automatic (§4).
3. **Shared dialog.** `saveAdHocEntry` today ends by jumping History to the new month and redrawing History. Reuse means splitting
   that tail by caller, so the Planner does not switch screens. The History path must stay as it is.
4. **Planner row layout** is dense and style-dependent (`docs/PLAN-MODERNIST.md`, "The Planner, denser"): the new row must read well
   in Classic, in Modernist at 1280x800 and at a phone's 412px, with 44px tap targets (`docs/PLAN-READABILITY.md`).
5. **Private data.** An entry is the household's diary. Tests and examples use made-up names ("Test Takeaway"), never real ones.

---

## 7. The PRs

**PR 1: see, add and remove.** `index.html` only (no `core.js`, so no core version bump), `help.html`, docs.
- Split `saveAdHocEntry` into the validation and the write (shared) and a per-caller tail; `openAdHocEntry` takes an origin and a
  date. History passes its own and behaves as today.
- A button on each day (not away). `renderPlannerDays` draws the day's ad-hoc rows after its recipe rows, and the empty-day branch shows
  them above **CHOOSE A RECIPE**.
- **×** removes: confirmation only for today or earlier.
- `changelog.json` (new version), `APP_VERSION`, `help.html` (the Planner's list and a QUICK ANSWER), `docs/TEST-PLAN.md` and
  `docs/HOUSEHOLD-JOBS.md` (a tablet step), `docs/HANDOVER.md`, and the smoke-check count in `CLAUDE.md`.
- **Checks, each seen to fail** (smoke):
  1. Adding from a day writes one `recipe_logs` insert with `recipe_id` null, the title, that day and the meal, and nothing to
     `planner_days`. *Mutation: write the row to the plan.*
  2. The day shows the row after its recipes, as text not a link, with AD HOC, its meal and ×, and none of SERVES, PRE-MADE or
     COOKED ✓. *Mutation: draw it with the recipe buttons.*
  3. A day with only an ad-hoc row still offers **CHOOSE A RECIPE**. *Mutation: draw the empty branch only when there are no rows.*
  4. The same row is in History on that day, unchanged. *Mutation: filter future rows out of `historyByDate`.*
  5. × on a future day deletes the row with no question; on today it asks first. *Mutation: always ask, or never.*
  6. An away day has no add button and keeps its rows. *Mutation: show it.*
  7. The shopping list and the week's counts are the same with and without an ad-hoc row. *Mutation: count the row.*
  8. Adding from History still lands on History's month, as before. *Mutation: share the tail.*
  9. With a shortlist item selected, the new button opens the dialog and assigns nothing. *Mutation: leave it off the handler's list.*
  10. Layout at 1280x800 and 412px, Classic and Modernist: no overflow, targets at least 44px.

**PR 2: small things, if wanted.** Tap the meal pill to change the meal (reusing the meal prompt, `updateDiaryEntry`); the week's
"N PLANNED" in Modernist counting ad-hoc rows (§9 Q5).

**PR 3: only if §9 Q6 is yes.** A shortlist **note** (no recipe) tapped onto a day becomes an ad-hoc entry from its text, and leaves
the shortlist.

---

## 8. Not verified

Everything here is from reading the code. Not run: the dialog on a day, the layout of a row on the tablet or phone, or what the
live diary holds. §6 risk 4 is a guess until a row is drawn.

---

## 9. Questions for the household

1. **Where do planned ad-hoc entries live?** *Recommended:* in the diary, as the same row History's + ENTRY makes, dated ahead
   (this plan). *Otherwise:* a table of their own (plan B), which would need SQL from you first and keeps the diary to things eaten.
2. **Should History mark entries still to come** (say "PLANNED" in its day list) **or leave them as they are?** *Recommended:*
   leave them; they are already allowed there.
3. **The button's wording:** **ADD SOMETHING ELSE**, **NOT A RECIPE**, **+ OTHER**, or your own?
4. **Ask for the meal when adding?** *Recommended:* as History does, the four buttons shown and optional.
5. **Should "N PLANNED" in the Modernist week header count them?** *Recommended:* yes, so a week with only a takeaway does not
   read "NOTHING PLANNED" beside one. The sidebar's shopping line stays as it is.
6. **Should a shortlist note be assignable to a day** (PR 3)? *Recommended:* yes, later, once PR 1 has been used.
7. **In the Google calendar?** *Recommended:* not now. It would need a `calendar-sync` change you would deploy, and the
   calendar is for meals that need a reminder.

## 10. The household's steps

None for PR 1: no SQL, no deploy. After the PR merges, one tablet step (to be written with it, in `docs/HOUSEHOLD-JOBS.md` and
`docs/TEST-PLAN.md`) adds a made-up entry on a day, sees it in History, and takes it off.
