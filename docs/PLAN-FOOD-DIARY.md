# The food diary from the Planner: PRE-MADE meals and COOKED ✓

**Asked for on 10 Oct 2026:** the household wanted the app to double as a food diary of what was **eaten**, including a meal cooked
earlier and eaten from the freezer, "even if the meal is premade this is as important to have the calendar notification". Planned
the same day; reviewed and approved by the household on 10 Oct; built the same day (PR #78). **Live 10 Oct:** the SQL applied before
the merge (20:02 UTC) and `calendar-sync` redeployed (v3), both checked read-only; tablet step 41a is the household's.

**Why:** the only way into the diary was ticking the last column of a recipe's flow. Read-only on 10 Oct: of 27 past planned days,
3 had a matching diary entry.

## 1. What was decided (the household's answers, 10 Oct)

1. **A PRE-MADE meal goes into the diary by itself when its day arrives** (the planned day is today or past). Changing the plan
   before then leaves nothing behind.
2. **A fresh meal gets COOKED ✓ on the Planner**, on today and past days. It does exactly what finishing the flow does: logs the
   recipe for that day, then asks which meal it was, with the note box.
3. **Eating a pre-made portion is "eaten", not "cooked".** It is in the diary, marked *from the freezer*, and is left out of "last
   cooked", times cooked and the streak.
4. **The meal is asked when PRE-MADE is switched on** (breakfast, lunch, dinner or snack), and the diary entry uses it.

Kept as they were: the Planner, the diary and history views, the meal-type prompt, and the calendar, whose evening-before reminder
is the "get it out of the freezer" reminder these meals need most.

## 2. How it behaves

- **On a Planner day, per recipe:**
  - **PRE-MADE**: switching it on asks the meal; the button then reads "PRE-MADE · DINNER". Tapping it again switches it off. The
    item drops off the shopping list, since there is nothing to buy.
  - **COOKED ✓**: on today and past days, for an item that is not pre-made. Once that recipe is logged for that day it reads
    "✓ COOKED" and does nothing more.
- **The automatic entry** (`logDuePremade`): after the load, after the tab-return refresh and after a PRE-MADE change, every
  pre-made item on today or an earlier day is written to the diary once, with its meal and `premade = true`. Its id is worked out
  from the household, the day, the recipe and which of that recipe's places on the day it is, and it is written as an upsert that
  ignores a duplicate, so two devices at once still make one entry. One toast: "Logged N meals from the freezer".
- **Once in the diary, an entry belongs to the diary:** switching PRE-MADE off afterwards, or removing the item, does not remove
  it; the diary's own REMOVE does. Days already past when this shipped have no PRE-MADE flag and are not filled in.
- **History and the diary:** a pre-made entry shows FROM THE FREEZER. The recipe's cooking history, its card, "last cooked" and the
  stats come only from cooked entries.
- **Calendar:** pre-made days keep IN CALENDAR and REMIND ME as now. AUTOMATICALLY REMIND ME FOR MAIN MEALS also covers a pre-made
  meal of any course, and switching PRE-MADE on is one of the moments it acts. The event's description says "(from the freezer)"
  beside that recipe (`calendar-sync`, redeployed by the household).
- **Backups:** EXPORT DATA and IMPORT DATA carry both, and an older backup restores everything as fresh.

## 2a. After tablet step 41a: fresh or freezer? (10 Oct)

**What 41a found.** On 10 Oct (20:40–20:42 UTC, read-only) the household marked a dish PRE-MADE · DINNER for today, and it went into
the diary from the freezer. Then they finished its recipe in the viewer, which logged it a second time, as cooked. They had not
seen COOKED ✓ either: it is hidden on a pre-made dish, and the fresh dish read ✓ COOKED once its recipe was finished. The
Planner row also squeezed a dish's name to one letter on a phone.

**The household's answer: ask.** Finishing the flow (in the viewer or a group) of a dish down as PRE-MADE today asks "Cooked
fresh, or from the freezer?" (`finishRecipe`):
- **FROM THE FREEZER**, or closing the question, adds nothing, since the freezer entry is already there.
- **COOKED FRESH** says the plan was wrong for today. It switches PRE-MADE off that dish, removes the freezer entry made for it
  (by the id `logDuePremade` gave it, never by matching, so nothing written by hand is touched), and logs it as cooked with the
  meal question and the note box. That differs from switching PRE-MADE off on the Planner, which keeps the entry: there nobody
  has said it was wrong.
- The answer is remembered for that dish and day until the page is reloaded, so unticking and re-ticking does not ask again.

On a phone the dish's name keeps at least 12em and the pills wrap below it; the tablet's row is unchanged where it fits.
Tablet step 41b.

## 3. Data

`docs/migrations/add-premade.md`: `planner_days.premade text[]` (one slot per item: '' or the meal) and `recipe_logs.premade
boolean`. The app offers PRE-MADE only once the columns are there (seen as a key on the rows it reads), and never names them
before.

## 4. Not in this round

- A freezer stock count ("Lamb Tagine ×3 in the freezer"), counted up when cooking extra and down when one is eaten.
- Marking a planned meal "didn't happen".
- Ad-hoc diary entries from the Planner, such as a takeaway.

## 5. The household's steps

1. Supabase SQL editor: run `docs/migrations/add-premade.md`, then its check queries.
2. Merge the PR.
3. Edge Functions → `calendar-sync` → redeploy from its raw GitHub URL on `main`, JWT verification **on**.
4. Tablet step 41a (`docs/TEST-PLAN.md`).
