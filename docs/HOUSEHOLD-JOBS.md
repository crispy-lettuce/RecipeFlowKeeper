# Household job list

**Last brought up to date: 14 Oct 2026, after 60a passed.**

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other
households sort out their own converter and need no steps here.

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
| [Choose what to build next](#your-own-issues-decided-13-oct) (#100 is parked) | — | — | — |

---

## Quick jobs

### Reload the app on every device

The newest version is 2026-10-14.5 (one corner). Once it has merged, reload on every device. The four before it,
2026-10-14.1 (colours), 2026-10-14.2 (bigger writing), 2026-10-14.3 (bigger buttons) and 2026-10-14.4 (keyboard focus), were merged as
#147, #149, #150 and #151 on 14 Oct, so they should already be live. Steps 61a, 62a, 63a, 64a and 65a are below.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready**, tap **RELOAD**. Otherwise refresh the page.

---

## App checks

### 61a. Quieter text is easier to read (new 14 Oct, `docs/PLAN-READABILITY.md` change T)

Colours only: nothing moves. Do this after the readability pull request has merged and you have reloaded the app.

1. In the light theme, open **RECIPES**. **You should see:** the small grey words (COURSE and SORT above the filters, the
   "3 OF 3" count, the dashed chips, SAVED VIEWS and EXPORT DATA in the sidebar) a little darker than before, still the quietest
   text on the page, and none of them hard to read.
2. Open a recipe. **You should see:** the line under the title and the hint under the grid read clearly, and the quantity beside
   each ingredient is still in its pale plum pill, no heavier than before.
3. Open **PLANNER**. **You should see:** the day numbers, and SERVES n and × on a planned dish, read clearly; today's row has a
   faint tint, as before.
4. **SETTINGS → APP → Appearance → Dark**, then look at 1 to 3 again. **You should see:** the quantity pills now show as pills
   (before, they did not show at all in dark); today's row is tinted; and dragging across a few words of a note shows a highlight.
5. Put Appearance back to what it was.
6. If you use them, **PRINT / A4 PDF** and **EXPORT PNG** on a recipe. **You should see:** the same as the screen, the small
   grey words a little darker.

The small green and gold words (a card's MAIN · VEG tags, a day's course label, the favourite star) are **not** changed. Tell
the next session if any of them is hard to read, and whether anything now looks too dark or heavy.

### 62a. Bigger, clearer writing (new 14 Oct, `docs/PLAN-READABILITY.md` change S)

Nothing is saved. Do this after the type-scale pull request has merged and you have reloaded the app. Tablet first; step 6 is
the phone.

1. Open **RECIPES**. **You should see:** every label, chip, count and card line bigger than before and easy to read at the
   distance you cook from, with nothing squashed, and the labels COURSE, SOURCE and KEYWORD whole.
2. Open a recipe. **You should see:** the ingredients bigger; each step's words flush left at the foot of its box, in the page's
   own font, with its time underneath in typewriter figures; and the buttons above the recipe running onto a second or third line.
3. Tap an ingredient. **You should see:** it struck through on a plain tint, with a square tick at the right and none of its
   words under the tick. Tap it again: it goes back as it was. Do the same with a step.
4. Switch **COOKING MODE** on. **You should see:** the header tidy, with only what you need.
5. Open **PLANNER** and **SHOPPING**. **You should see:** every row still fits, with the day, SERVES n and × readable.
6. On the phone, open **HISTORY** and a recipe. **You should see:** each calendar day showing a short name on one line, and the
   recipe's buttons wrapping without anything cut off.
7. In **SETTINGS → APP → Appearance → Dark**, look at a recipe again, then put Appearance back.
8. If you use it, **PRINT / A4 PDF** on a recipe. **You should see:** the same number of sheets as before (a typical recipe is two).

Tell the next session what looks too big or too cramped, and anything you can't read.

### 63a. Bigger buttons (new 14 Oct, `docs/PLAN-READABILITY.md` change H)

Nothing is saved. Do this after the buttons pull request has merged and you have reloaded the app. Tablet first; step 6 is the phone.

1. Open **RECIPES**. **You should see:** the filter chips and the SOURCE and SORT boxes taller and easy to hit. The star and **+** on a
   card look the same, but a tap just outside the circle still works. A tap anywhere along the search bar puts the cursor in it.
2. Open a recipe. **You should see:** every button above it, the **2 4 6 8** buttons under COOK FOR, **GO**, **RESET** and the
   **COOKING MODE** switch comfortable to press with a thumb.
3. Switch **COOKING MODE** on. **You should see:** a tidy header, with **RESET TICKS** and **SHOW TIMELINE** together on one line.
4. Open **PLANNER**. **You should see:** the **×** on a dish, **SERVES n**, **+ CHOOSE A RECIPE**, **+ ADD ANOTHER**, the **GROUPED:**
   badge and **COOKED ✓** all easy to hit without aiming, and the days a little closer together than plain big buttons would leave them.
5. Look at the side menu. **You should see:** SAVED VIEWS, **NEW RECIPE**, **EXPORT DATA**, **IMPORT DATA** and **SIGN OUT** all in
   view without scrolling, each with room around it. (Look; don't tap SIGN OUT.)
6. On the phone, look at the top bar's links, **NEW RECIPE** and the Planner's buttons. **You should see:** each comfortable to press.

Tell the next session if anything is hard to hit, if something now needs scrolling that didn't, or if a screen feels too long.

### 64a. A clear outline on the box you are typing in (new 14 Oct, `docs/PLAN-READABILITY.md` change F)

Nothing is saved. Do this after the keyboard-focus pull request has merged and you have reloaded the app. The outline only shows a
change you can see; a keyboard is optional, and only step 6 needs one.

1. Open **RECIPES** and tap the search bar. **You should see:** a plum outline round the whole bar, with the cursor in it.
2. Tap **+ ADD** beside the keywords. **You should see:** the keyword box with a plum outline while you type.
3. Open **PLANNER** and tap the Shortlist name box. **You should see:** the same outline.
4. Open **NEW RECIPE** and tap the paste box and the boxes below it. **You should see:** each with the outline when tapped.
5. Open **SETTINGS** and tap a box on the INGREDIENTS tab and on the APP tab. **You should see:** the outline on each.
6. With a keyboard attached, press **Tab** a few times in the side menu. **You should see:** each link outlined wholly inside its
   row, not cut off at the menu's edges.
7. **SETTINGS → APP → Appearance → Dark**, then look at 1 again, and put Appearance back. **You should see:** the outline in a lighter
   plum.

Tell the next session if any outline is hard to see, or if something now looks too busy.

### 65a. One corner everywhere (new 14 Oct, `docs/PLAN-READABILITY.md` change R)

Nothing is saved, and nothing moves or changes size: only corners change. Do this after the corners pull request has merged and you
have reloaded the app.

1. Open **RECIPES**. **You should see:** the star and **+** on each card as small squares with slightly rounded corners, not circles.
   A tap just outside one still works.
2. Open a recipe. **You should see:** the **2 4 6 8** buttons, **GO**, **RESET** and the **COOKING MODE** switch (its thumb a square) with
   the same corners as the other buttons.
3. Open **PLANNER**. **You should see:** the **+** beside **CHOOSE A RECIPE** and **ADD ANOTHER**, and the SERVES and COOKED labels, as
   squares and rectangles too.
4. Look at a few boxes in **SETTINGS** and on **NEW RECIPE**. **You should see:** one corner everywhere.
5. If you use them, **PRINT / A4 PDF** and **EXPORT PNG** on a recipe. **You should see:** the same as the screen.

Tell the next session if any square looks too sharp, or if you want a circle back anywhere.

---

## Library jobs

None at the moment. The master copy of the converter's instructions is `converter/conversion-instructions.md`; when it changes,
the gold **CONVERTER** bar says so in your household, and the steps are in the bar. The other files under `converter/` are
reference material only.

---

## Your own issues

### Your own issues: decided 13 Oct

You chose a direction for each on 13 Oct, and "defaults" on every plan's questions. The plans are in `docs/`
(`PLAN-SIDES.md`, `PLAN-PREP-STEPS.md`, `PLAN-SHOPPING-AUDIT.md`, `PLAN-INGREDIENTS-TAB.md`, `PLAN-PREVIEW-SITE.md`).
You chose the order on 13 Oct: #94, then #95, #88 and #87; #100 stays parked.

- **#87, sides with no timings:** the app spots "serve with rice" and offers a matching side recipe for the same day.
  **FINISH TOGETHER** in the Group Viewer (#138), the recipe's **SERVE WITH** line (#140) and the Planner's offer to add
  the side (#141) are built, and 57a–59a passed (14 Oct). #87 is closed.
- **#142, OFTEN WITH:** recipes you have grouped with a dish before, offered the same way (any course, once is enough).
  Built 13 Oct (#144), as planned in `docs/PLAN-SIDES.md` §9; 60a passed 14 Oct.
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

- **14 Oct:** tablet step 60a (OFTEN WITH) passed; every app check is done. Testing is in your household only; the
  second household's converter is theirs to sort out, so it is off this list.
- **14 Oct:** you decided OFTEN WITH needs no group history, since you don't expect to ungroup in practice. Issue #87
  is closed (#142 closed with #144). Tablet steps 57a, 58a and 59a passed.
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
