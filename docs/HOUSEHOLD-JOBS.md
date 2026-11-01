# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
1 Nov 2026**: you reported every job here complete (Jobs 1, 2, 3 and 6); one new job is waiting (Job 7, the Planner's previous days).

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

**One job is waiting:** Job 7, the Planner's previous days (#223), a few minutes on the tablet. One loose end, which is not a job: issue #224, "Idea: Test", is the test report Job 2 asked you to close, and it is still open on GitHub.
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

## Nothing to do: a session checks these

None at the moment.

---

## Recently done

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
