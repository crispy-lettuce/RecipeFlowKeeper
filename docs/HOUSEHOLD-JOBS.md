# Household job list

**Last brought up to date: 13 Oct 2026, after #138 merged (FINISH TOGETHER).**

These are the jobs only you can do. A session can't tap the tablet, make decisions for you, or deploy for you.

**How to use this page**

- Each job has numbered steps.
- Under a step, **You should see** says what the app should do.
- When you finish a job, tell the next session, e.g. "the converter is reloaded" or "a step didn't do what it said". The session takes the
  job off this page.
- App checks are numbered (e.g. 50a) to match `docs/TEST-PLAN.md`, which keeps the fuller technical notes.

---

## At a glance

| Job | Where | Time | Saves anything? |
| --- | --- | --- | --- |
| [Reload the app](#reload-the-app-on-every-device) | every device | 1 min | No |
| [57a: FINISH TOGETHER](#57a-finish-together) | tablet and phone | 5 min | No |
| [58a: SERVE WITH in a recipe](#58a-serve-with-in-a-recipe) | tablet and phone | 3 min | No |
| [59a: the Planner's SERVE WITH offer](#59a-the-planners-serve-with-offer) | tablet | 5 min | A side on a day, undone at the end |
| [60a: OFTEN WITH](#60a-often-with) | tablet | 5 min | A dish on a day, undone at the end |
| [Confirm the converter in the second household](#confirm-the-converter-in-the-second-household) | Claude app, then the app | 5 min | One tap |
| [Choose what to build next](#your-own-issues-decided-13-oct) | — | — | — |

---

## Quick jobs

### Reload the app on every device

A new version (2026-10-13.5, FINISH TOGETHER) went live when #138 merged.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready**, tap **RELOAD**. Otherwise refresh the page.

---

## App checks

### 60a: OFTEN WITH

After the #142 PR merges, and the app is reloaded.

1. Open a recipe you have grouped with another dish before.
   - **You should see:** under the chips (below any SERVE WITH), **OFTEN WITH:** and what it was grouped with, two at most,
     the one grouped most often first. Tap one: it opens.
2. Open a recipe you have never grouped.
   - **You should see:** no OFTEN WITH line.
3. Put the first recipe on a day from tomorrow onwards, on its own.
   - **You should see:** under it, **OFTEN WITH:**, a **+** for each, and **×**.
4. Tap **×**.
   - **You should see:** the line goes. Reload the page: it is back.
5. Tap **+** and a name.
   - **You should see:** it joins the day, for as many people as the dish, a **GROUPED:** badge holds both, and the line goes.
6. Put a Side you have grouped with a main on a day on its own.
   - **You should see:** it offers that main.
7. Take what you added off again with its **×**.

### 59a: the Planner's SERVE WITH offer

After the #87 Planner offer PR merges, and the app is reloaded. Do it after 58a.

1. Put a main that shows SERVE WITH (58a) on a day from tomorrow onwards, and set **SERVES** to a number other than the
   side's recipe is written for.
   - **You should see:** under the main, **SERVE WITH:**, a **+** button for each side, and **×**.
2. Tap **×**.
   - **You should see:** the offer goes. Reload the page: it is back.
3. Tap **+** and the side's name.
   - **You should see:** a message that it was added, cooking with the main; the side on the day at the main's number;
     a **GROUPED:** badge holding both; and no offer any more.
4. Tap the **GROUPED:** badge.
   - **You should see:** the two together, in **FINISH TOGETHER** (57a).
5. On a day where the main is already grouped with another dish, tap **+** for a side.
   - **You should see:** the side joins that same group.
6. Tap **GROUP SOME TOGETHER** on a day with an offer.
   - **You should see:** no offer while picking. Tap **CANCEL**.
7. Take the sides off again with their **×**.
   - **You should see:** the group goes too, as for any dish.

### 58a: SERVE WITH in a recipe

After the #87 SERVE WITH PR merges, and the app is reloaded.

1. Open a main that says to serve it with something you have a **Side** recipe for (rice, naan, potatoes…).
   - **You should see:** under the chips, **SERVE WITH:** and the side's name with an arrow; up to three, the one you have
     cooked most first.
2. Tap the name.
   - **You should see:** that side's recipe. **←** goes back as before.
3. Open a recipe whose only serving words are a garnish ("lime wedges, to serve") or "serve immediately".
   - **You should see:** no SERVE WITH line.
4. If sharing is on, open one of the other household's recipes.
   - **You should see:** no SERVE WITH line.
5. On the phone, step 1 again.
   - **You should see:** the line wraps rather than running off the side.

If a main names something you'd call a side but nothing shows, check the side's course is **Side** and its title (or a keyword)
has that word.

### 57a: FINISH TOGETHER

#138 has merged: reload the app first. You need a recipe whose course is **Side** (EDIT → COURSE) and
a longer recipe with timings, on the same Planner day, grouped with **GROUP SOME TOGETHER**.

1. Tap the **GROUPED: …** badge.
   - **You should see:** **FINISH TOGETHER** lit above the timeline; the side's lane finishes where the main's does; the last
     mark on the timeline reads **SERVE**; the main's header says **START FIRST**, the side's **START AT +…** (with **ABOUT** in
     front if the main has a step without a time in brackets).
2. Tap **START TOGETHER**.
   - **You should see:** both lanes start at the left, the start times go, and the last mark is a time again.
3. Turn on **COOKING MODE**.
   - **You should see:** the timeline hidden behind **SHOW TIMELINE**; **START AT** still on the side's header.
4. Open a group with no Side.
   - **You should see:** it opens in **START TOGETHER**, as before.
5. On the phone, open the first group.
   - **You should see:** the two buttons wrap rather than run off the side.
6. If you changed a recipe's course only for this, change it back.

---

## Library jobs

### Confirm the converter in the second household

Your household has done this (13 Oct). The second family household still sees the gold **CONVERTER** bar until someone there
does the same. The master copy is `converter/conversion-instructions.md` in this repo.

1. On a device signed in to the second household, open the app.
   - **You should see:** the gold **CONVERTER** bar, version 2026-10-12.1.
2. Tap **OPEN THE INSTRUCTIONS ↗**, download the file, and in the Claude app replace the copy in that household's conversion
   project with it.
3. Back in the app, tap **DONE**.
   - **You should see:** the bar goes, for everyone in that household.

The weekly live test's own household never confirms, since no one uses it; nobody sees its bar.

The other files under `converter/` are reference material only. Don't load them.

---

## Your own issues

### Your own issues: decided 13 Oct

You chose a direction for each on 13 Oct, and "defaults" on every plan's questions. The plans are in `docs/`
(`PLAN-SIDES.md`, `PLAN-PREP-STEPS.md`, `PLAN-SHOPPING-AUDIT.md`, `PLAN-INGREDIENTS-TAB.md`, `PLAN-PREVIEW-SITE.md`).
You chose the order on 13 Oct: #94, then #95, #88 and #87; #100 stays parked.

- **#87, sides with no timings:** the app spots "serve with rice" and offers a matching side recipe for the same day.
  **FINISH TOGETHER** in the Group Viewer (#138, 57a above), the recipe's **SERVE WITH** line (#140, 58a above) and the
  Planner's offer to add the side (59a above) are built: #87 is complete once 57a–59a pass.
- **#142, OFTEN WITH:** recipes you have grouped with a dish before, offered the same way (any course, once is enough).
  Built 13 Oct (60a above), as planned in `docs/PLAN-SIDES.md` §9.
- **#88, when chopping is done:** built: **PREPARATION** in Settings → APP turns "sliced", "diced" and the like into their own
  steps in the flow (56a passed).
- **#94, the shopping list:** both halves built: ticked items left off print and PNG (53a passed), and the **AUDIT** button
  (54a passed).
- **#95, the INGREDIENTS tab:** built: collapsible sections and a search (55a passed).
- **#100, a preview site:** parked; the plan is about trying a change before it reaches the live app.

---

## Nothing to do: a session checks these

- **The photo backup** on Sunday 18 Oct: the first run of the new mirror script in `PrivateBackup`.

---

## Recently done

- **13 Oct:**
  - Tablet steps 53a, 54a, 55a and 56a passed.
  - The two recipe titles in the docs became "recipe A" and "recipe B", as you asked. Issue #101 is closed.
  - #129 (the converter reminder, #127) merged, and its SQL applied: the column is there, read back by a session.
  - Tablet step 52a passed. Your household reloaded the converter and tapped DONE; the database holds version 2026-10-12.1.
- **12 Oct:**
  - Tablet steps 39a, 40a, 42a, 43a, 44a, 45a, 46a, 48a and 49a passed; then 47a (your own photo) and 51a (the recipe
    checker and scaling); then 50a, 38d, 38c and 40b. Every app check is done.
  - Your answers: opening a source PDF outside the app is fine; checking lines against an image of the PDF works as it is;
    "Main" in the course tags means what you mean by a main meal.
  - **The BBC Good Food validations and D6 are dropped**: one recipe was reviewed and validated, and the rest will be
    cleared before the app is adopted in full. Nothing breaks without them: LIBRARY CHECK simply goes on listing those
    recipes as needing attention.
  - A reminder to reload the converter after its instructions change is tracked in #127.
  - The default-privileges SQL was applied.
  - Three Edge Functions were redeployed and checked.
  - The October review's issues were closed: all but #101.
- **10 Oct:** tablet steps 41a and 41b passed. The third household was made.
