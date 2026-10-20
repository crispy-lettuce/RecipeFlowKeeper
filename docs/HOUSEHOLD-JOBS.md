# Household job list

**Last brought up to date: 20 Oct 2026 (73a, the second batch from the tablet review, added; 72a before it), earlier 19 Oct 2026 (70a, the filter sheet, added), earlier 18 Oct 2026, checked step by step against the app, with 66a revised for the fixes of 18 Oct; the test-household split and the converter reload put first, and 68a added, the same day. 66a step 3 gained the scroll and upright check on 19 Oct.**

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
| [L1. Tap DONE on the converter bar](#l1-tap-done-on-the-converter-bar-18-oct) (tests 11 to 14 passed) | app | 1 min | Only the converter's DONE |
| [Reload the app](#reload-the-app-on-every-device), on any device not opened since 18 Oct | every device | 1 min | No |
| [61a–65a: the readability changes](#61a-quieter-text-is-easier-to-read-new-14-oct-docsplan-readabilitymd-change-t), **in Classic** | tablet (62a and 63a end on the phone) | 25 min | Only Appearance, switched to dark and put back (61a, 62a, 64a) |
| [66a: the Modernist style](#66a-a-second-style-modernist-new-15-oct-revised-18-oct-docsplan-modernistmd) | tablet, landscape | 15 min | Two things, each undone in the next tap (see 66a) |
| [67a: liquids in spoons or ml](#67a-liquids-in-spoons-or-ml-new-18-oct-docsplan-liquid-measuresmd), in Test Kitchen | tablet | 5 min | No |
| [68a: EST. beside an estimated time](#68a-est-beside-a-time-the-converter-worked-out-new-18-oct-version-2026-10-184), in Test Kitchen | tablet | 10 min | One recipe's TIME, put back in step 6 |
| [69a: add several recipes at once](#69a-add-several-recipes-at-once-new-19-oct-version-2026-10-191-docsplan-bulk-addmd), in Test Kitchen | tablet | 10 min | Three made-up recipes, deleted in step 8 |
| [70a: the Recipes filter sheet](#70a-the-recipes-filter-sheet-new-19-oct-version-2026-10-193-docsplan-modernistmd), in Modernist | tablet, landscape | 10 min | No |
| [71a: PRE-MADE on the Planner again](#71a-pre-made-on-the-planner-in-your-own-household-new-20-oct-version-2026-10-201) (the button is back), in your own household | tablet | 1 min | One dish switched to PRE-MADE and back |
| [72a: the first changes from the tablet review](#72a-the-first-changes-from-the-tablet-review-new-20-oct-version-2026-10-203-docsplan-modernistmd), in Modernist | tablet, landscape | 8 min | No (AUDIT is switched on and off) |
| [73a: the second batch from the tablet review](#73a-the-second-batch-from-the-tablet-review-new-20-oct-version-2026-10-204-docsplan-modernistmd), in Modernist | tablet, upright then landscape | 10 min | One dish taken off a day and put back (step 5) |
| [Choose what to build next](#your-own-issues-decided-13-oct) (#100 is parked) | — | — | — |

**The split is done** (18 Oct, see Recently done), so your own library is empty until you add recipes. Do 61a to 70a signed in as the
test account, in Test Kitchen, which has the recipes and the plan they look at. 61a to 65a describe the **Classic** look (plum, gold, rounded corners), which is how the app opens
unless a device has been switched. Do them first, then 66a, which switches to Modernist and back at the end.

---

## Quick jobs

### Reload the app on every device

Live now: **2026-10-18.4** (checked 18 Oct, 18:20 UTC, indirectly: your household's converter DONE is stored for 2026-10-18.2,
which only the 2026-10-18.4 app asks about, so the device you used was running it; a session could not reach the site itself).

It covers **2026-10-18.1** (#154, the fixes from #153's review), **2026-10-18.2** (#155, the converter's liquids rule),
**2026-10-18.3** (#157, liquids when scaled and on the list; check 67a) and **2026-10-18.4** (estimated times shown with EST.;
check 68a), then **2026-10-18.5** (#160, the converter's shorter rewrite) and **2026-10-18.6** (its follow-up with your answers, and
`1 tin` lines scaled as `2 tins`). Reload any device that has not been opened since.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** Version **2026-10-18.6** once the follow-up has merged (**2026-10-18.5** before it).

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
   three cards to a row, photos in colour. Scroll down the list: every card keeps its full size, with its photo, title and time, however
   far you go (until 19 Oct they were squashed to thin strips). Turn the tablet upright: two cards to a row, as full. Turn it back.
   Tap **+** on a card: it becomes **✓**. Tap **✓**: the recipe comes off the shortlist.
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

### 67a. Liquids in spoons or ml (new 18 Oct, `docs/PLAN-LIQUID-MEASURES.md`)

Nothing is saved: COOK FOR and the shopping list only change what is shown. After the split, do this signed in as the test
account, in Test Kitchen, as for 61a to 66a. **Before** you reload into the new version, tick one oil,
stock or milk row on the shopping list, so step 4 can check it is still ticked.

1. Open a recipe with an oil in tablespoons (1 or 2 tbsp). Use **COOK FOR** to cook for enough people to make it 50 ml or more
   (2 tbsp for 4 is 60 ml for 8). **You should see:** that line in ml, e.g. **60 ml**. Tap **RESET**. **You should see:** the
   tablespoons exactly as written.
2. On a recipe with a spice or a paste in spoons (ground cumin, curry paste), cook for twice the people. **You should see:** it
   stays in spoons.
3. On a recipe with honey or a syrup in grams, if you have one, cook for twice the people. **You should see:** it stays in grams.
4. Open **SHOPPING**. **You should see:** an oil, stock or milk of 50 ml or more in ml, with the recipes' own amounts after it when
   any are spoons, e.g. **145 ml (100 ml + 3 tbsp)**; under 50 ml, spoons, e.g. **2 tbsp + 1 tsp**. The row you ticked before
   reloading is still ticked.

Tell the next session if any line reads oddly, or if something poured stays in spoons when scaled (the list may not know it is a
liquid: the session can add it).

### 68a. EST. beside a time the converter worked out (new 18 Oct, version 2026-10-18.4)

This saves one recipe's TIME and puts it back in step 6, so do it in Test Kitchen, not in your own library. It works in either
style. You do not need the new converter file for it: you type the marker yourself.

1. Open a recipe, tap **EDIT**, and in **TIME** type `est. 40 min`. Tap **SAVE RECIPE**.
2. Open **RECIPES**. **You should see:** that recipe's card with a small **EST.** tag in front of **40 MIN**, and no tag on other
   recipes' times.
3. Open the recipe. **You should see:** the line under its title reading SOURCE · EST. 40 MIN · …, and a recipe whose time is plain
   (35 min) with no tag. Hold or hover over EST. **You should see:** "Estimated from the method steps: the source gives no overall
   time" (on the tablet this may only show with a mouse).
4. Put that recipe on a day in **PLANNER** and on the shortlist. **You should see:** EST. 40 MIN on the day's row, on one line and
   not touching the **SERVES** button, and EST. 40 MIN on the shortlist line.
5. In **RECIPES**, tap **Weeknight, under 30 min** after giving a Weeknight recipe `est. 25 min`. **You should see:** it listed,
   as a recipe with a plain 25 min would be.
6. **EDIT** each recipe you changed, type back its real time (an empty TIME box removes it), and **SAVE RECIPE**. **You should see:**
   the tag gone with the old figure.

Tell the next session if the tag is hard to see or read, or if anything wraps onto two lines.

### 69a. Add several recipes at once (new 19 Oct, version 2026-10-19.1, `docs/PLAN-BULK-ADD.md`)

This adds three made-up recipes, so do it in Test Kitchen and delete them in step 8. You need the app reloaded on this device first.
Copy this whole block (all three recipes) to paste in step 2:

```
TITLE: Bulk Test One
SOURCE: Bulk Test Book
SERVINGS: 2
SOURCE_URL: https://example.com/bulk-test-one
TAGS: course=Main, Bulktest
GROUP a:
2 onions
STAGE:
MERGE a -> done: soften the onions [5 min]

TITLE: Bulk Test Two
SOURCE: Bulk Test Book
TAGS: course=Main, Bulktest
GROUP a:
1 carrot
STAGE:
MERGE a -> done: boil the carrot [8 min]

TITLE: Bulk Test Three
SOURCE: Bulk Test Book
SERVINGS: 4
TAGS: course=Side, Bulktest
GROUP a:
1 leek
STAGE:
MERGE a -> done: fry the leek [4 min]
```

1. Note how many recipes **RECIPES** shows. Tap **ADD SEVERAL** (under **NEW RECIPE**). **You should see:** a box to paste into and
   **CHOOSE A FILE**.
2. Paste the block. **You should see:** "3 read: 2 ready, 1 held back." Bulk Test Two is held back, with the reason SERVINGS and the
   line it starts on, and its box cannot be ticked. The button reads **ADD 2 RECIPES**.
3. Behind the dialog, **RECIPES** still shows the same number: reading added nothing.
4. Untick Bulk Test One. **You should see:** the button reads **ADD 1 RECIPE**. Tick it again. Tap **SHOW THE RECIPE** under it.
   **You should see:** its table of steps.
5. Under **SOURCES** you should see "Bulk Test Book: a new source. 2 recipes." Tap **ADD 2 RECIPES**. **You should see:** a panel saying
   2 recipes added, listing both with **OPEN**, and the two recipes in **RECIPES** at once.
6. Tap **OPEN** beside Bulk Test One. **You should see:** its edit form, with the title and source filled in. Close it.
7. Tap **ADD SEVERAL** again and paste only the Bulk Test One recipe. **You should see:** it listed as already in your library (the same
   source link), unticked, and the button reading **ADD 0 RECIPES** and greyed.
8. Close the dialog, then delete Bulk Test One and Bulk Test Three the usual way. In Settings → Keywords, delete **Bulktest** if it is listed.

Tell the next session if a step didn't say what it should, or if anything is hard to read on the tablet.

### 70a. The Recipes filter sheet (new 19 Oct, version 2026-10-19.3, `docs/PLAN-MODERNIST.md`)

Do this on the tablet held landscape, in **MODERNIST**, after reloading into 2026-10-19.3. Filters are not saved anywhere, so it writes
nothing. Use Test Kitchen's recipes if your own library is still small, so there is something to filter.

1. Open **RECIPES**. **You should see:** the header on one line: "Recipes", the count, the search box and a black **FILTERS** button, with
   no rows of **COURSE** or **KEYWORD** chips under it. The first row of recipe cards starts about a quarter of the way down the page, so
   cards fill at least three-quarters of it, with the **OUR RECIPES** / **TEST KITCHEN'S RECIPES** buttons showing.
2. Tap **FILTERS**. **You should see:** a panel slide in from the right, about 440 px wide, over the whole app, the side menu included, with
   the rest dimmed. In it: **COURSE**, **SOURCE** and **SORT**, then every **KEYWORD**, with how many there are at the right.
3. Tap a course, then a keyword. **You should see:** the recipes behind the dim change at once, and the red button at the foot says how
   many are left (for example **SHOW 7 RECIPES**). Tapping a pill again switches it off. The list does not jump to the top when you tap.
4. Change **SORT** to **A – Z**. **You should see:** the recipes re-order behind the panel.
5. Tap the red **SHOW** button. **You should see:** the panel slides away. Under the search there is a row of small chips (the course, the
   keyword, **SORT: A – Z**), a red number on **FILTERS**, and **CLEAR ALL** after the chips. Open the panel again and close it with the
   **×**, then with a tap on the dimmed area. (With a keyboard, **Esc** closes it too.)
6. Tap one chip. **You should see:** that filter goes off and the recipes change. Tap **CLEAR ALL**. **You should see:** every filter off, the
   chip row gone, and no empty band left under the search.
7. Switch on four or five filters in a row. **You should see:** the chips stay on one line. If they cannot all fit, the last place says
   something like **+2**; tap it and the panel opens.
8. Open the panel: **You should see:** no keyboard. The keywords are listed with the ones that are on first, then the most used. Tap the
   box above them (**Find a keyword…**) and type a few letters from the middle of a word. **You should see:** the keyboard now, and the
   keywords narrowing as you type, in capitals or not. Type something no keyword has. **You should see:** "No keyword matches — Enter to
   add". Send it: it becomes a chip and a filled pill at the head of the list, and the box empties. Tap **+ ADD**: the cursor goes to the
   box. Close the panel and open it again: the box is empty and every keyword is back.
9. Tap **Weeknight, under 30 min** in the side menu. **You should see:** one chip carrying that name. Tap the chip to clear it.
10. In **SETTINGS**, **APP**, choose **CLASSIC**. **You should see:** Recipes with its rows of filters as before, and no **FILTERS** button.
    Choose whichever style you want to keep.

Tell the next session how the panel feels to use with one hand, whether anything is hard to tap, and whether you miss seeing the
keyword suggestions in the header.

### 71a. PRE-MADE on the Planner, in your own household (new 20 Oct, version 2026-10-20.1)

Your own household, not Test Kitchen: the button was missing there because the household started empty on 18 Oct. You reported it
showing on the tablet again on 20 Oct (the old step 1), so one step is left.

1. On the **PLANNER**, on a dish planned for a day still to come, tap **PRE-MADE**, choose a meal, then tap it again. **You should see:** it reads **PRE-MADE · DINNER** (or the meal you chose), the
   toast says it is off the shopping list, and the second tap makes it an ordinary dish again with no question.

### 72a. The first changes from the tablet review (new 20 Oct, version 2026-10-20.3, `docs/PLAN-MODERNIST.md`)

On the tablet held landscape, in **MODERNIST**, after reloading into 2026-10-20.3. Your own household or Test Kitchen, whichever has recipes.
Nothing is saved: step 2 closes the edit window without saving, and step 6 turns AUDIT off again.

1. Open a recipe. **You should see:** the top of it on two rows (three if it has a **SERVE WITH** line): the back link, the source line and the
   grey source note on the first, then **COOKING MODE** and the buttons. The title starts higher than it did, with the steps
   showing sooner. (It was about a third of the screen; it should now be about a quarter or less.)
2. Tap **EDIT** and scroll down the window. **You should see:** **SAVE CHANGES** stays at the bottom of the screen with a line above it, wherever
   you are in the window. Close it with the **×**.
3. On **RECIPES**, look at a card. **You should see:** the star at one corner and a small list-with-plus picture at the other, in place of a bare **+**.
   Tap the picture: the recipe goes on the shortlist and the picture turns to a tick. Tap the tick to take it off again.
4. **OUR RECIPES** and **TEST KITCHEN'S RECIPES** at the top are taller than before, as easy to tap as the other buttons.
5. In **PLANNER**, tap an empty day anywhere along its row, not only on the words. **You should see:** Recipes open with "Choosing a recipe for
   …" and **MARK DAY AWAY** and **CANCEL** in the bar, easy to tap. Tap **CANCEL**.
6. In **SHOPPING**, tap **AUDIT**. **You should see:** on each line the aisle box and **MERGE WITH…** are as tall as the other buttons. Tap **END AUDIT**.
7. In **SETTINGS**, scroll down **INGREDIENTS** a long way, then tap **LIBRARY**. **You should see:** **LIBRARY** opens at its top, with its heading in view.
   The same for **APP** and **HELP**.

Tell the next session if a step didn't say what it should, and whether the recipe's top feels better or too cramped. Not changed, and yours to
say about: a recipe with more than five steps still scrolls sideways to its last column (about three in four do), and nothing says so.
(73a below adds an arrow for that.)

### 73a. The second batch from the tablet review (new 20 Oct, version 2026-10-20.4, `docs/PLAN-MODERNIST.md`)

On the tablet, in **MODERNIST**, after reloading into 2026-10-20.4. Steps 1 to 4 are with the tablet held **upright**; steps 5 to 7 sideways.
Step 5 changes one day of the Planner and puts it back with UNDO. Use a day still to come, in your own household or Test Kitchen.

1. Held upright, open **RECIPES**. **You should see:** the menu down the left is a thin strip with the app's name along it and a **›**, not the full menu, and the
   cards are in three columns, each wider than before (about 250 px, where they were about 195). Tap the strip: the full menu slides out over the page. Tap
   the **‹** at the top of it, or choose a screen, and it folds back.
2. Still upright, open **HISTORY**. **You should see:** the whole calendar on the screen, with all seven days named along the top and none cut off
   at the right, and no sideways scroll.
3. Open **SHOPPING**. **You should see:** every button along the top on the screen, onto a second row if they don't fit on one.
4. Open **SETTINGS** and the **PLANNER**. **You should see:** the strip on both and nothing running off to the right.
5. Turn the tablet sideways. In the **PLANNER**, on a day with a dish, tap the **×** beside the dish. **You should see:** the dish goes, as it did, and a bar
   in that day says **Removed "…"** with **UNDO**, easy to tap. Tap **UNDO**: the dish is back in the same place, with the same number of people, and in its
   group if it was in one. Then take it off again and wait ten seconds, or go to another screen: the bar goes, and the dish stays off.
6. Open a recipe with several steps (one that you have to scroll sideways). **You should see:** a small dark square with an arrow at the top right
   corner of the table. Scroll the table: the arrow stays where it is. Scroll to the end: it goes. Scroll back: it returns. A recipe that fits on
   the screen has none.
7. In that recipe, tap **EXPORT PNG**. **You should see:** the picture has no arrow in it.

Tell the next session if a step didn't say what it should. The strip now also applies to a computer window narrower than 1100 pixels, and to a
tablet held sideways in a split screen; say if you'd rather it did not.

---

## Library jobs

### L1. Tap DONE on the converter bar (18 Oct)

Your conversion project has version 2026-10-18.4, and tests 11 to 14 passed in it (18 Oct). One step is left: your household's DONE
was still stored for 2026-10-18.2 when a session read it (about 19:20 UTC), so the bar will keep asking.

1. Open the app and reload it if a bar says **A new version is ready.** **Shows:** the gold **CONVERTER** bar, naming 2026-10-18.4.
2. Tap **DONE**. **Shows:** the bar goes, on every device, since DONE is kept for the household.

Test Kitchen's DONE is still 2026-10-12.1, so the test account sees the bar too: tap **DONE** there as well (it shares your project).

The app's half of the liquids rule (switching a scaled line between tbsp and ml at 50 ml, and the shopping list's breakdown) is
built and live (#157, 2026-10-18.3); 67a checks it.

**Once the spoons-in-brackets change has merged (converter 2026-10-18.5, app 2026-10-18.7):** the bar will name 2026-10-18.5, so
load the new `converter/conversion-instructions.md` into your conversion project first, then tap **DONE** as above. Then run
**test 15** in `converter/test-set.md` (a small recipe with a few solids in spoons): the butter, sugar and cocoa should come back
in grams with the spoons in brackets, like `45 g butter (3 tbsp)`, and the flour, oats and golden syrup with no bracket. Nothing in
the library changes. Reload the app on each device and check **SETTINGS → HELP** shows Version **2026-10-18.7**.

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

- **18 Oct:** **converter tests 11 to 14 passed** in your conversion project, with version 2026-10-18.4 (your shorter rewrite and
  your answers): liquids, estimated times, a tin with no weight, and several recipes in one message.
- **18 Oct:** **the test-household split.** `switch.sql` ran at 18:02:53 UTC. Your account is now in a **new household under your household's name**, empty,
  with your 16 word matches, 10 aisles and 2 swaps, sharing with the relatives' household, and Google reconnected to the same calendar and
  Drive folder (18:11). The old household is **Test Kitchen**, with the test account and every placeholder recipe, log, photo and
  plan day up to 17 Oct; you cleared the planned meals from 18 Oct on just before switching, on purpose. You also shared your new
  library with Test Kitchen (18:13). Steps 8 to 11 reported done by you; a session read the database afterwards and the result is
  in `PrivateBackup` (`migrations/test-household-split/README.md`). You reloaded the converter and tapped DONE (2026-10-18.2).
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
