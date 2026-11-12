# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
12 Nov 2026**: three jobs are waiting, Job 7 (the Planner's previous days), Job 11 (the tidier Planner in Modernist) and Job 12 (INSPIRE ME's FUTURE WEEK).

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

**Three jobs are waiting:** Job 7, the Planner's previous days (#223), Job 11, the tidier Planner in Modernist, and Job 12, INSPIRE ME's FUTURE WEEK; a few minutes each on the tablet. One loose end, which is not a job: issue #224, "Idea: Test", is the test report Job 2 asked you to close, and it is still open on GitHub.
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

## Nothing to do: a session checks these

None at the moment.

---

## Recently done

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
