# Household job list

**Last brought up to date: 18 Oct 2026, checked step by step against the app, with 66a revised for the fixes of 18 Oct; the test-household split and the converter reload put first the same day.**

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
| **1.** [Split off the test household](#split-off-the-test-household-new-18-oct) | app, Supabase dashboard | 20 min | Yes: your household moves to a new, empty one |
| **2.** [L1. Reload the converter](#l1-reload-the-converter-liquids-18-oct), once #155 has merged | app, conversion project | 10 min | Only the converter's DONE |
| [Reload the app](#reload-the-app-on-every-device) | every device | 1 min | No |
| [61a–65a: the readability changes](#61a-quieter-text-is-easier-to-read-new-14-oct-docsplan-readabilitymd-change-t), **in Classic** | tablet (62a and 63a end on the phone) | 25 min | Only Appearance, switched to dark and put back (61a, 62a, 64a) |
| [66a: the Modernist style](#66a-a-second-style-modernist-new-15-oct-revised-18-oct-docsplan-modernistmd) | tablet, landscape | 15 min | Two things, each undone in the next tap (see 66a) |
| [Choose what to build next](#your-own-issues-decided-13-oct) (#100 is parked) | — | — | — |

**Do them in this order.** The split first. Then the converter, once #155 has merged: its DONE is kept per household, so a
DONE tapped before the split has to be tapped again after it. Then, after the split, your own library is empty until you add recipes,
so do 61a to 66a signed in as the test account, in Test Kitchen, which has the recipes and the plan they look at. 61a to 65a describe the **Classic** look (plum, gold, rounded corners), which is how the app opens
unless a device has been switched. Do them first, then 66a, which switches to Modernist and back at the end.

---

## First job

Do this before the others.

### Split off the test household (new 18 Oct)

The plan is `docs/PLAN-TEST-HOUSEHOLD.md`, and the SQL is in `PrivateBackup` (`migrations/test-household-split/`). Today's
library becomes **Test Kitchen**, for testing; your account moves to a new, empty household with your household's name. Your word
matches, aisles and swaps come with you, and so does sharing with the relatives' household.

1. In `PrivateBackup`'s Actions tab, open the latest **backup-supabase** run. **You should see:** a green tick from this morning.
2. In the app, tap **EXPORT DATA** and keep the file. **You should see:** a backup file downloaded.
3. **PLANNER:** tap each day from today on that shows **✓ IN CALENDAR**. **You should see:** the tick goes, and the day leaves
   the RecipeWrangler calendar in Google.
4. **SETTINGS → APP → CALENDAR → DISCONNECT.** **You should see:** CONNECT GOOGLE CALENDAR in its place.
5. **SETTINGS → APP → RECIPE SHARING:** change the name to `Test Kitchen` and tap **SAVE**. **You should see:** the new name.
6. Supabase dashboard → Authentication → Users → **Add user**: the test account's address from `PrivateBackup`, with a
   password you keep. **You should see:** the new user in the list.
7. Supabase SQL editor: paste `switch.sql` from `PrivateBackup` and run it. **You should see:** "Switched: new household …".
   If it stops with a message, nothing has changed. The message names the step to do first.
8. Reload the app on every device. **You should see:** an empty library under your household's name. Settings has your word
   matches, aisles and swaps, and RECIPE SHARING still lists the relatives' household.
9. Set **Appearance** to Dark. **You should see:** the CONVERTER bar, because the new household has confirmed no version yet. If it
   names the version your conversion project already has, tap **DONE**. If it names 2026-10-18.1 (#155), do the next job,
   [Reload the converter](#l1-reload-the-converter-liquids-18-oct), instead.
10. **CONNECT GOOGLE CALENDAR**, and say yes to Google. **You should see:** the same RecipeWrangler calendar as before, not a
    second one.
11. In another browser profile or a private window, sign in as the test account. **You should see:** Test Kitchen with every
    old recipe, its photo and its history.
12. Tell the next session it is done. It checks the database and updates the documents.

Something wrong after step 7? `undo.sql` puts it back, as long as nothing has been added to the new household yet.

---

## Quick jobs

### Reload the app on every device

Live now (checked 18 Oct): **2026-10-15.1**, the Modernist style, merged as #153 on 15 Oct; its tests and the site's deployment
passed. Everything before it (2026-10-14.1 to 2026-10-14.5, the readability changes) is live too.

Merged: **2026-10-18.1**, the fixes found when #153 was reviewed (RESET TICKS and its count, the meal-base colours, prepared
ingredients drawn as steps, the month names, and Enter on a card's buttons), as #154 at 11:11 UTC on 18 Oct. *Not verified:* that
the site is serving it (a session could not reach the site that day). After it, **2026-10-18.2**: the converter's new liquids
rule (#155); only the converter's instructions change, so the app itself looks and works as before.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** Version **2026-10-18.2**.

---

## App checks

### 61a. Quieter text is easier to read (new 14 Oct, `docs/PLAN-READABILITY.md` change T)

Colours only: nothing moves. Do this after the readability pull request has merged and you have reloaded the app.

1. In the light theme, open **RECIPES**. **You should see:** the small grey words (COURSE and SORT above the filters, the
   count in the search bar such as "40 OF 40", the dashed chips, SAVED VIEWS and EXPORT DATA in the sidebar) a little darker than
   before, still the quietest text on the page, and none of them hard to read.
2. Open a recipe. **You should see:** the line under the title and the hint under the grid read clearly, and the quantity beside
   each ingredient is still on its pale plum patch, no heavier than before.
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
   card look the same size, but a tap just outside one still works. A tap anywhere along the search bar puts the cursor in it.
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

### 66a. A second style, Modernist (new 15 Oct, revised 18 Oct, `docs/PLAN-MODERNIST.md`)

Do this on the tablet, held landscape, after the 18 Oct pull request has merged and you have reloaded (version 2026-10-18.1).
It takes about fifteen minutes. Steps 1 and 13 can be done on the phone as well.

**What it saves:** the style is kept on each device, not shared. Step 3 puts a recipe on the shortlist and takes it off again;
step 8 ticks a shopping row and unticks it. In step 4, tap boxes that are **not** in the last column: ticking the last column
logs the recipe as cooked today. Step 7 only opens two questions, which you cancel. Step 11 changes the household's Appearance
and puts it back. Nothing else is saved.

1. Open **SETTINGS**, then **APP**. Under **STYLE**, choose **MODERNIST**. **You should see:** the whole app change at once to a flat,
   square look in one typeface, with **Recipe Wrangler** at the top of the side menu and the menu's links numbered 01 to 06.
2. Reload the page. **You should see:** it comes back in **MODERNIST**, without the old look flashing up first.
3. Open **RECIPES**. **You should see:** "Recipes" in large type with the number of recipes beside it, the search bar beside that, and
   three cards to a row, photos in colour. Tap **+** on a card: it becomes **✓**. Tap **✓**: the recipe comes off the shortlist.
4. Open a recipe. **You should see:** the title very large, with SERVES and "0 / N TICKED" beside it; the flow table with square boxes,
   the last column in red. Tap two boxes that are not in the last column: the count goes up. Tap **RESET TICKS**: every box clears
   and the count goes back to **0 / N TICKED**. Turn **COOKING MODE** on: a red bar says the screen will stay on, and the side menu
   folds to a strip. Tap the strip to open the menu, and ‹ to fold it again. Turn cooking mode off.
5. On that recipe, tap **EXPORT PNG**. **You should see:** a picture of the recipe, looking as it does on screen. If you print, try
   **PRINT / A4 PDF** too.
6. Open **PLANNER**. **You should see:** the side menu folded to a strip, "Next Fourteen Days", each week under a black line with its
   dates and how many are planned, and the shortlist on the right with numbered ideas and a red **SHOPPING LIST** block at its foot.
   Tap **›** at the top of the shortlist: it folds to a strip. Tap the strip: it opens again. Tap the red block: the shopping list opens.
7. Back on the Planner, on a dish that is not already pre-made, tap **SERVES** and cancel the box that asks how many, then tap
   **PRE-MADE** and cancel the question it asks. **You should see:** each answers your thumb first time, without catching the dish's
   name above it.
8. Open **SHOPPING**. **You should see:** the aisles in two columns, a square box on each row. Tick a row: the box goes red, the row
   fades and is struck through, and the count by the aisle and under the title goes up. Untick it. Tap **EXPORT PNG**: the picture
   has the square boxes, with ticked rows left out.
9. Open **HISTORY**. **You should see:** the month in large type between two square arrows, today ringed in red, and words like
   COOKED at the foot of the days. Tap a day: it fills with ink (black, in light) and the panel on the right shows what was eaten.
   Scroll the panel: the meal-base mixes are bars, not pies, and no two meal bases share a look (after five colours they are striped).
10. Open **SETTINGS**. **You should see:** the four tabs as words, the open one underlined in red, and each section between lines.
11. Under **APPEARANCE**, choose dark, then light again (it is shared with the household, so put it back as it was). **You should
    see:** Modernist in dark, then light.
12. Only if you use **PREPARATION → AS STEPS IN THE FLOW** (Settings → APP): open a recipe with sliced or diced ingredients. **You
    should see:** the step that cooks them grey with a black bar down its left, not a solid black box (black boxes are for steps
    that join two cooked things).
13. Under **STYLE**, choose **CLASSIC**. **You should see:** the app exactly as it was before this change. Choose whichever style you
    want to keep.

With a keyboard on the laptop (optional, either style): press **Tab** until a card's **+** is outlined and press **Enter**. **You
should see:** the recipe goes on the shortlist and does not open. Enter on the card itself still opens it. Take it off again.

Tell the next session anything that looks wrong, is hard to tap, or that you would like changed. The decisions made while building
it, with the reasons, are listed at the end of `docs/PLAN-MODERNIST.md`; a few are questions for you (for example, whether the
sign-in card should say "Recipe Wrangler" too).

---

## Library jobs

### L1. Reload the converter (liquids, 18 Oct)

Once the PR that changes `converter/conversion-instructions.md` to version 2026-10-18.1 is merged:

1. Open the app. **Shows:** the gold **CONVERTER** bar, naming version 2026-10-18.1.
2. Follow the bar's steps to replace the file in your conversion project, then tap **DONE**. **Shows:** the bar goes.
3. In a fresh conversion chat, paste test 11's source from `converter/test-set.md` (Ginger Sesame Dressing). **Shows:** the
   eight lines the test lists: `60 ml rice vinegar`, `60 ml sesame oil`, `2 tbsp soy sauce`, `1 1/2 tbsp lime juice`,
   `1/2 tsp fish sauce`, `30 g honey`, `2 tbsp tahini`, `120 ml water`.
4. Tell the next session "test 11 OK", or which line differed.

The app's half (switching a scaled line between tbsp and ml at 50 ml, and the shopping list's breakdown) is planned in
`docs/PLAN-LIQUID-MEASURES.md`, with five questions for you in its §5. Nothing there stops you converting now.

### Otherwise

The master copy of the converter's instructions is `converter/conversion-instructions.md`; when it changes,
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

None at the moment.

---

## Recently done

- **18 Oct:** the photo backup's first run on the new mirror script passed (05:05 UTC, checked by a session in the run's log):
  every photo and source file fetched and checked against the database, and 4 new photos and 4 new source files committed to
  `PrivateBackup`. The nightly database backup has passed every night since 12 Oct.
- **15 Oct:** the Modernist style merged (#153); its tests and the site's deployment passed. A review afterwards found five faults,
  fixed in the 18 Oct pull request (66a now covers them).

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
