# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
23 Oct 2026**: the 22 Oct tablet checks were all reported complete; the only app steps waiting are the timeline ones below.

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

| Job | Where | Time | Saves anything? |
| --- | --- | --- | --- |
| [Reload the app](#reload-the-app-on-every-device), on every device | every device | 1 min | No |
| [Set the ovens and try the run sheet](#set-the-ovens-and-try-the-run-sheet), once the app is **2026-10-23.3** | tablet | 5 min | The number of ovens, on that device only |
| [Tap DONE on the converter bar](#the-converter-bar), if it shows | app | 1 min | Only the converter's DONE |

Nothing else is waiting. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Reload the app on every device

The current app is **2026-10-23.2** (`APP_VERSION`); **2026-10-23.3** once the run-sheet PR is merged.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** Version **2026-10-23.3** or later.

## Set the ovens and try the run sheet

Needs a group of two or three dishes on the Planner with times on their steps. Nothing here saves anything but the number of ovens, and that
stays on the device you set it on.

1. On the **tablet**, open **SETTINGS → APP**, find **OVENS** and choose **2 OVENS**. **You should see:** a note that this kitchen has 2 ovens, on
   this device. (A device you never set has one oven.)
2. Open a group of dishes. **You should see:** under the heading, **EAT AT** with a time (now plus the longest dish, up to the next five minutes),
   four buttons **−15 −5 +5 +15**, and **START AT** a time. The ruler reads times of day, each box says **AT 17:20** (its own time), and each dish
   says when to begin it (**START AT 17:35**, the first one **START FIRST**).
   Under the heading a sentence says what FINISH TOGETHER or START TOGETHER is doing, and each dish says **READY AT** as well as its start.
3. Tap **+15**. **You should see:** EAT AT, START AT, the ruler and every box's time all move 15 minutes later, and a **NOW** button appears. Tap
   **NOW**: it goes back to the default.
4. Look at the row **YOUR HANDS**. **You should see:** solid where you are busy, an outline **free N min** where nothing needs you for six
   minutes or more, and red hatching, with CLASH in its heading, where two hands-on steps overlap. (A recipe with no hands-off mark yet is left out
   of the row, and a note under the dishes names it. With none marked there is no row and no clash to avoid; mark a step in Test Kitchen to try it.)
5. If there is a clash, tap **AVOID THE CLASH**. **You should see:** the clash gone, one dish told to start earlier, EAT AT unchanged, and the button filled, reading
   **✓ CLASH AVOIDED · TAP TO UNDO**. Tap it again: the clash comes back and the button is plain.
6. A dish whose recipe says "Preheat the oven to 195°C" on its steps: **You should see:** an **OVENS** row with chips such as "195°C fan · the
   dish's name". With one oven and two different settings at once, a sentence under the strip says more ovens are wanted than this kitchen has; with
   **2 OVENS** it does not.
7. Open one dish on its own. **You should see:** the same EAT AT, ruler and hands row.

Tell the next session which step did not do what it said; it takes the job off this page when you report it passed.

## The converter bar

The master copy of the converter's instructions is `converter/conversion-instructions.md` (version **2026-10-23.1** now). When it changes, a gold
**CONVERTER** bar shows in your household until someone taps **DONE**. The 23 Oct change adds a rule that marks the steps that look after
themselves, so reload every device first (above), then do the steps below.

1. Tap **OPEN THE INSTRUCTIONS ↗** and download the file.
2. In the Claude app, open your conversion project and replace its copy of the file with the new one.
3. Back in the app, tap **DONE**. **You should see:** the bar goes, on every device in the household.

The test account in Test Kitchen has its own DONE, so it shows the bar too until it is tapped there. A session can see which version
a household has confirmed (`household_settings.converter_ack_version`); it did not look today, so whether the bar is showing now is
**not verified**. The other files under `converter/` are reference material only.

---

## Nothing to do: a session checks these

None at the moment.

---

## Recently done

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
