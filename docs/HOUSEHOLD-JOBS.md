# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
25 Oct 2026**: you reported every job here complete, and nothing is waiting.

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

Nothing is waiting. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Nothing to do: a session checks these

None at the moment.

---

## Recently done

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
