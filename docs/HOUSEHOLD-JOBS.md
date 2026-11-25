# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
25 Nov 2026**: nine jobs are waiting, Job 7 (the Planner's previous days), Job 11 (the tidier Planner in Modernist), Job 12 (INSPIRE ME's FUTURE WEEK), Job 13 (the Planner on a slow start) Job 14 (adding your own items to the shopping list) Job 15 (REGULARS and the names offered as you type) Job 16 (the remembered aisle), Job 17 (installing the app on the tablet) and Job 18 (logging a missed meal).

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

**Nine jobs are waiting:** Job 7, the Planner's previous days (#223), Job 11, the tidier Planner in Modernist, Job 12, INSPIRE ME's FUTURE WEEK, Job 13, the Planner on a slow start (#240), Job 14, adding your own items to the shopping list, Job 15, REGULARS, Job 16, the remembered aisle (all #241),, Job 17, installing the app on the tablet, and Job 18, logging a missed meal (#249); a few minutes each on the tablet. Job 16's database step is done; merge its pull request and try it. Job 14's database step is done; merge its pull request and try it.
What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Job 7: the Planner's previous days (issue #223)

No database change and nothing to deploy. Do it in your own household: it adds a dish to today and can log a dish as cooked on a past day, so tidy up afterwards (REMOVE the diary
entry from History, and × the dish from today) if you were only trying it.

1. **Reload the app** so it is on version 2026-11-01.3. **You should see:** Settings → HELP shows it, and What's new mentions the Planner's previous days.
2. On the Planner, look at the heading. **You should see:** a **PREVIOUS 3 DAYS** button beside ROLLS FORWARD DAILY, the first week starting where it always did, and nothing before today.
3. Press it. **You should see:** an **EARLIER** band with the last three days above today, oldest first. A day with dishes shows them with their title, course, time and **SERVES**
   number; an empty day says **NOTHING PLANNED**; and there is no **×**, no **CHOOSE A RECIPE** and no SERVES button to change on them.
4. Tap a dish's title on one of those days. **You should see:** its recipe opens, at that day's number of people.
5. Press **ADD TO TODAY** on one dish. **You should see:** a note that it is on today as well, and the dish now listed under today, for the same number of people. The past day still has it.
6. Press **COOKED ✓** on a past dish you did cook that day. **You should see:** it reads ✓ COOKED, and in History that day shows the dish.
7. Press **3 MORE**, then **HIDE**. **You should see:** three more days appear, and then the band closes and PREVIOUS 3 DAYS is back. Check the Shopping list: nothing from the past days is on it.

If a step does not do what it says, note which one and what you saw.

---

## Job 11: the tidier Planner (Modernist)

No database change and nothing to deploy. It changes how the Planner is drawn in the Modernist style only; nothing you have planned is touched.

1. **Reload the app** so it is on version 2026-11-12.2, in the Modernist style (Settings → APP → STYLE). **You should see:** Settings → HELP shows the version, and
   What's new describes the tidier Planner.
2. Look at a planned day that is in the calendar. **You should see:** a small calendar with a tick under the date, a bell in front of the dish, and no **IN CALENDAR**
   or **REMIND ME** buttons under the dishes.
3. Tap the bell. **You should see:** a line through it, and the reminder gone from that day's event in Google Calendar. Tap it again to put it back.
4. Tap the small calendar. **You should see:** it change to a calendar with a plus, the bell go, and the day leave Google Calendar. Tap it again to put the day back.
5. Look at a day with two meals that is in the calendar. **You should see:** a bell in front of each dish, each switching by itself. On a day with dishes grouped
   together, the bell is at the left of the **GROUPED** bar.
6. Look down the page. **You should see:** **SERVES** and **TO COOK** as underlined words, in a box only where you changed one (another number of people,
   **COOK AHEAD**, **PRE-MADE**), and the course, time, SERVES and TO COOK lined up in columns from dish to dish. Tap **SERVES** and **TO COOK**: they still open as before.
7. On a planned day press **ADD**. **You should see:** it open into **A RECIPE** and **OTHER** with a ×. Try each: A RECIPE goes to the library for that day, OTHER
   opens the form for something that isn't a recipe, × closes it. An empty day still has **CHOOSE A RECIPE** and **OTHER**.
8. Turn the tablet upright, and look once on a phone. **You should see:** nothing cut off or overlapping, and every icon easy to tap.
9. Switch to Classic (Settings → APP → STYLE). **You should see:** the Planner as it always was there, with its buttons in words. Switch back.

If a step does not do what it says, note which one and what you saw.

---

## Job 12: INSPIRE ME, FUTURE WEEK

No database change and nothing to deploy. ALL TO SHORTLIST puts dishes on the shortlist; × them there afterwards if you were only trying it.

1. **Reload the app** so it is on version 2026-11-12.3. **You should see:** Settings → HELP shows it, and What's new mentions FUTURE WEEK.
2. Press **INSPIRE ME** in the shortlist, then **A WEEK**. **You should see:** THIS WEEK, NEXT WEEK and a third, **FUTURE WEEK**.
3. Choose **FUTURE WEEK**. **You should see:** a list of seven dishes in the panel, each with **SWAP** and **×**, nothing drawn on the days, and a line saying it is not looking at the Planner and
   that nothing is on the shortlist until you press **ALL TO SHORTLIST**. Put a dish on a day first: it can come up here, which it would not under NEXT WEEK.
4. Press **SWAP** on one dish and **×** on another. **You should see:** only that dish change, and the other drop out. Press **ANOTHER WEEK**. **You should see:** a fresh set of
   seven, not shorter for the one you dropped.
5. Press **+** on a protein under AT LEAST. **You should see:** the list change to include at least that many. A protein may appear twice in a row; that is intended.
6. Press **ALL TO SHORTLIST**. **You should see:** every dish on the shortlist, nothing on any day, and **PROPOSE A WEEK** in the panel. Anything already on the shortlist was not suggested.

If a step does not do what it says, note which one and what you saw.

---

## Job 13: the Planner on a slow start (issue #240)

No database change and nothing to deploy. Nothing is written.

1. **Reload the app** so it is on version 2026-11-15.1. **You should see:** Settings → HELP shows it, and What's new mentions the Planner opening empty.
2. Close the app, open it again, and tap **PLANNER** as soon as the menu appears, before the recipes have drawn. Somewhere with a weak signal makes this easier.
   **You should see:** the days fill in with what is planned within a moment, without leaving the Planner or reloading. If the app has already loaded by the time you tap,
   the Planner is simply full, which is also right.
3. If you ever see the Planner (or the shopping list, or History) empty again when it should not be, note what you did just before and send it from REPORT A BUG OR AN IDEA.

---

## Job 14: adding your own items to the shopping list (issue #241)

The database change is done (15 Nov). Do the tablet steps in your own household; they add three made-up items, which the last steps take off again.

1. **Done, 15 Nov:** you applied the SQL, and a session read the table back the same day (`docs/INFRASTRUCTURE.md`).
2. **Merge the pull request, then reload the app** so it is on version 2026-11-15.2. **You should see:** Settings → HELP shows it, and What's new describes adding items.
3. Open **SHOPPING**. **You should see:** a new row under the buttons: a box for the name, a box for how much, an aisle list and **ADD AN ITEM**. The aisle list has the six food
   aisles, then HOUSEHOLD, HEALTH & TOILETRIES and PETS, then OTHER.
4. Add something for the house, with an amount, in HOUSEHOLD. **You should see:** a HOUSEHOLD aisle after the food aisles with your item in it, its amount in front of the name, the
   word **ADDED** under it where the other rows name their recipes, and a **×** at the end of the row. The count beside SHOPPING in the menu goes up by one.
5. Add something with the same name as a row already on the list, in that row's aisle. **You should see:** two rows, side by side in the aisle: the recipe's, unchanged, with its
   amount and its recipes, and yours, marked ADDED. Ticking one does not tick the other.
6. Add a third and leave the aisle at **AISLE…**. **You should see:** it under OTHER.
7. Choose next week, then BOTH WEEKS, from the list at the top. **You should see:** your three items on each, the same as on this week.
8. Tick one of yours, then look on a second device (a phone). **You should see:** it struck through on both. **HIDE TICKED** hides it. **PRINT / A4 PDF** (look at the preview, no
   need to print): the ticked one is left off, the others are there with ADDED, and the adding row and the × are not on the paper.
9. Press **CLEAR TICKS**. **You should see:** a question that says the ticked item you added will be taken off the list. Say yes: it is gone, not unticked.
10. Press **×** on the other two. **You should see:** each go at once, and the menu's count back where it started.

If a step does not do what it says, note which one and what you saw.

---

## Job 15: REGULARS, and names offered as you type (issue #241)

No database change and nothing to deploy. Do it after Job 14, in your own household; the last step takes off what it added.

1. **Reload the app** so it is on version 2026-11-15.3. **You should see:** Settings → HELP shows it, and What's new describes REGULARS.
2. On **SHOPPING**, start typing the name of an ingredient the app knows (two letters are enough). **You should see:** up to eight matching names under the box. Tap one.
   **You should see:** the name and its aisle filled in, and nothing added yet. Press **ADD AN ITEM**.
3. Add something for the house with an amount, in HOUSEHOLD. On its row press **REGULAR**. **You should see:** the button read ✓ REGULAR, **REGULARS · 1** beside ADD AN ITEM,
   and the list and the menu's count unchanged.
4. Tick that item and press **CLEAR TICKS**. **You should see:** it leave the list. Press **REGULARS**. **You should see:** it there with a + in front, amount and all.
5. Tap it. **You should see:** it back on the list in HOUSEHOLD with its amount, unticked and marked ADDED, and under REGULARS it now reads ON THE LIST.
6. Make a second item a regular, clear both off the list as in step 4, and open REGULARS. **You should see:** **ADD ALL**. Press it: both are back on the list.
7. Start typing the name of one of your regulars in the name box. **You should see:** it offered first, marked REGULAR.
8. Press **REGULAR** on a row again, and the **×** beside the other under REGULARS. **You should see:** both gone from REGULARS, and the items still on the list. Take them off with ×.

If a step does not do what it says, note which one and what you saw.

---

## Job 16: the remembered aisle (issue #241)

The database change is done (15 Nov). Do the tablet steps after Jobs 14 and 15, in your own household.

1. **Done, 15 Nov:** you applied the SQL, and a session read the table back the same day (`docs/INFRASTRUCTURE.md`).
2. **Merge the pull request, then reload the app** so it is on version 2026-11-15.4. **You should see:** Settings → HELP shows it, and What's new describes the remembered aisle.
3. On **SHOPPING**, add something the app would not know, choosing **PETS**. Then take it off with ×.
4. Start typing its name again. **You should see:** it offered under the box. Do not tap it: finish the name, leave the aisle at **AISLE…** and press **ADD AN ITEM**.
   **You should see:** it under PETS.
5. On a second device (a phone), reload and start typing the same name. **You should see:** it offered there too, and tapping it sets the aisle to PETS.
6. Take it off, add it again choosing **HOUSEHOLD**, take it off, and add it once more with no aisle. **You should see:** it under HOUSEHOLD.
7. Add an ingredient that is on the list from a recipe, choosing a different aisle from the recipe's row. **You should see:** your item in the aisle you chose, and the recipe's
   row where it was. Take your items off with ×.

If a step does not do what it says, note which one and what you saw.

---

## Job 17: installing the app on the tablet

No database change and nothing to deploy. It changes nothing in your data; installing is per device and can be undone by uninstalling the icon.

1. **Merge the pull request, then reload the app** so it is on version 2026-11-21.1. **You should see:** Settings → HELP shows it, and What's new mentions installing the app.
2. On the Android tablet, open the app in Chrome, sign in, tap the three dots at the top right. **You should see:** **Install app** (or **Add to Home screen**, then **Install**).
3. Install it, then open it from the new icon. **You should see:** the app full-screen with no address bar, the icon on the home screen, and (very likely) you already signed in. Say if it asked you to sign in again.
4. Check your settings (the style, dark mode) and open a recipe. **You should see:** the same as in the browser. Tick something in a recipe, then open the app in the browser on another device. **You should see:** the tick there.
5. In Settings → HELP, tap **OPEN THE GUIDE**. **You should see:** the guide opens and you can get back to the app. Say how it opened (inside the app, or in Chrome).
6. If Google Calendar is not connected yet, try **CONNECT GOOGLE CALENDAR** from the installed app, or skip this step. **You should see:** Google's consent screen, and then the app again. Say whether you came back to the installed app or to a Chrome tab. If it does not come back, connect it from the browser instead and tell the next session.
7. Open the app in the browser too. **You should see:** it works exactly as before.

If a step does not do what it says, note which one and what you saw.

---

## Job 18: logging a missed meal (issue #249)

No database change and nothing to deploy. It writes to your diary and your stats, so REMOVE what you add (step 6) if you were only trying it.

1. **Merge the pull request, then reload the app** so it is on version 2026-11-25.2. **You should see:** Settings → HELP shows it, and What's new mentions logging a recipe you forgot to plan and the list of names fixed.
2. In History, press **+ ENTRY** and type the first few letters of one of your recipes. **You should see:** a short list under the box, on a solid background (nothing showing through it), with the recipe among the names. Tap it. **You should see:** three buttons, **COOKED** (already chosen), **FROM THE FREEZER** and **COOKED AHEAD**, above the meals.
3. Set the date to yesterday (or a day you cooked something you never planned), choose a meal and press **ADD**. **You should see:** "Logged … as cooked on …", that day selected in History with the dish on it, and the recipe's "last cooked" (on its card or in the viewer) showing that day if it is the latest.
4. Press **+ ENTRY** again, pick the same recipe and the same day, and press **ADD**. **You should see:** "It is already logged as cooked on that day." and nothing added.
5. Pick a recipe, choose **COOKED AHEAD**. **You should see:** the meal buttons disappear. Choose **COOKED** again and they come back. Try a date after today. **You should see:** it refused, saying the day has not come yet.
6. Press **REMOVE** on the entry from step 3. **You should see:** it gone from the day, and the recipe's last cooked back to what it was.
7. Type something that is not a recipe (a takeaway). **You should see:** no COOKED buttons, and it is added as AD HOC as before. The Planner's **OTHER** button never shows the three buttons.

If a step does not do what it says, note which one and what you saw.

---

## Nothing to do: a session checks these

None at the moment.

---

## Recently done

- **15 Nov:** issues #224 (the test report from Job 2), #237 (a question about adding a step to a recipe, answered on the issue) and #216 (the converter and old BBC Good Food
  recipes, closed as not planned) were closed at your request. Seen by a session: all three read closed on GitHub that day.
- **12 Nov:** you reported the INSPIRE ME and shortlist changes (Job 10: one button in the shortlist, ADD TO SHORTLIST, ALL TO SHORTLIST) good in the app. That is a report; a session did not see it.
- **12 Nov:** you reported A WEEK (Job 9) tested in the app and all looking good. That is a report; a session did not see it. What you noticed while using it is Job 10's change.
- **11 Nov:** you reported INSPIRE ME (the panel, ONE MEAL and 3 OPTIONS, Job 8) looks good in the app. That is a report; a session did not see it. A WEEK is Job 9.
- **1 Nov:** you reported every job on this page complete: Job 1 (signing in again on each device, #196), Job 2 (REPORT A BUG OR AN IDEA, #198), Job 3 (COOK AHEAD, #221)
  and Job 6 (READ BY CHAT: the remaining recipes worked through, and a re-check after the comparison fix, #229, with the false differences gone). Seen by a session, not only
  reported: #196 was closed on 25 Oct and #198 and #221 on 31 Oct at 09:11 UTC; on 1 Nov the live database held COOK AHEAD's two columns and its constraint (read-only, and 0 of 158
  log rows are cook-ahead, which is what the job's own undo step leaves), and `docs/INFRASTRUCTURE.md` now records the migration as applied. The rest is your report; a session did
  not see it. The test report Job 2 asked you to close, #224, is still open.
- **31 Oct:** you reported CHECK ALL AGAINST SOURCES (Job 5, app version 2026-10-31.2) done: of 55 recipes waiting, 4 were recorded with differences, which you judged real, and 51 could
  not be read; a second run of those 51 failed all 51 with "the source page returned 403" (sites refusing the check). That is your report; a session did not see it. It is why READ BY CHAT exists.
- **31 Oct:** you reported the IN OTHER NOW job (Job 4, #225, app version 2026-10-31.1) OK. That is your report; a session did not see it.
- **25 Oct:** you reported every job on this page complete: the reload (2026-10-25.1), setting the ovens and trying the run sheet, trying START COOKING,
  the timers rehearsal on the tablet, and the converter bar (DONE tapped, and the re-conversion of three recipes compared with the library). Seen in the database
  the same day: the family household's confirmed converter version is 2026-10-25.1, set at 12:59 UTC; the rest is your report, which a session did not see.
  The rehearsal is not retired: it is now a standing check, `docs/TEST-PLAN.md` section H, and the run sheet's plan is closed.
- **23 Oct:** you reported three jobs complete: the reload for 2026-10-23.2, trying the timeline (the strip's fixes and ticks driving the bars), and trying
  a hands-off step in Test Kitchen.
- **22 Oct:** you reported every open tablet check complete (the readability changes, the Modernist style, liquids, EST., ADD SEVERAL,
  the filter sheet, PRE-MADE, the tablet-review batches, the denser Planner, a recipe opening at the day's SERVES, an entry's meal and a
  shortlist note onto a day, and the converter's DONE). Issues #94 and #95 were closed; the preview site (#100) is ignored.
- **21 Oct:** the split-ingredient fix is in your conversion project (converter 2026-10-21.1) and its test 16 passed. A recipe already in the
  library keeps whatever it had: fix one with a one-line edit in its Edit form, then COMPARE WITH SOURCE again.
- **20 Oct:** the calendar's reminder per meal is live (its SQL applied, `calendar-sync` redeployed, a sync ran with no error). You decided to leave
  the 13 old Test Kitchen events in the RecipeWrangler calendar as they are; delete one by hand in Google Calendar if it becomes a nuisance.
- **18 Oct:** the test-household split was done: your account is in a new household under the family's name; the old one is **Test Kitchen**,
  with the test account and the placeholder library. The record is in `PrivateBackup` (`migrations/test-household-split/README.md`).
