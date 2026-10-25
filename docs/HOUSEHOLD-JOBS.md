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
| [Try START COOKING and its timers](#try-start-cooking), once the app is **2026-10-24.5** | tablet | 12 min | No |
| [Tap DONE on the converter bar](#the-converter-bar), if it shows | app | 1 min | Only the converter's DONE |

Nothing else is waiting. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Reload the app on every device

The current app is **2026-10-25.1** (`APP_VERSION`) once the converter-wording PR is merged.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** Version **2026-10-25.1** or later.

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

## Try START COOKING

Needs a recipe with times on its steps, or a group, open in the app. Nothing here is saved: a reload ends the run, as it ends the ticks. Best tried in Test
Kitchen, with a step or two marked `, hands off` (see the converter bar below for the mark).

1. Open a recipe with times on its steps. Under the heading, tap **START COOKING**. **You should see:** the button becomes **STOP COOKING**, EAT AT stops
   following the clock, a line reads **On time for HH:MM** (your EAT AT), and a **Now** line says what is going or what is next for your hands.
2. Wait for the first step's time. **You should see:** a red line down the strip at the real time, moving; the Now line saying what is going and how
   long it has left, and whether your hands are busy.
3. Tick a step a few minutes after it was planned to end. **You should see:** its bar drawn out to the tick, everything after it moving later, a faint dotted
   mark where it had been planned, each later box's **AT** time changed, and the line reading **Ready at HH:MM, N min after HH:MM**.
4. Tick a step before its planned start. **You should see:** nothing after it moves earlier than planned.
5. Tap **RESET TICKS**. **You should see:** the plan back to where it would be with nothing ticked, at once.
6. Open a group of dishes and tap **START COOKING**. **You should see:** the same; and if two steps want your hands at once, the later one waits, so the meal reads
   late, while **AVOID THE CLASH** is still there to move it earlier instead.
7. With a run going, look at the flow table. **You should see:** a **START** button on each step (not on a step with no time, and not on one already ticked). Press **START**
   on a step as you begin it. **You should see:** the box reads **STARTED hh:mm** with a **DONE** button, the box is **not** ticked, and the bar, the hands row and the ready line
   follow the time you pressed it.
8. Press **DONE**. **You should see:** the box ticked, and the bar drawn from when you started to now. Tap the ticked box to un-tick it: it goes back to **STARTED**.
9. Press **START** on a step before the one before it is done. **You should see:** it is running from then.
10. Tap **STOP COOKING**. **You should see:** the plan as it was before, with no red line, no Now line, no dotted marks and no START buttons.
11. Start the run again. A step marked hands off with a time reads **START TIMER**; press it. **You should see:** the box reads **STARTED hh:mm** and, beside it, a countdown such as
    **8:34 LEFT** that goes down each second. (A step with no time to count, such as "until done", has no countdown.)
12. Let a short timer reach zero (start the shortest timed step, and watch the box). **You should see:** one chime and, on a device that can, one buzz; the box reads **TIME'S UP**; **DONE** pulses;
    the Now line begins **Time's up:** and the step's name; and a message at the foot of the screen names it. **If you hear nothing:** check the tablet is not on silent and its volume is up,
    then tell the next session; the buzz, the pulse and the words do not depend on sound.
13. Leave it a minute. **You should see:** it does not ring again. Press **DONE**: the box is ticked and the pulsing stops.
14. For a step given as a range (for example 10-13 minutes), start it. **You should see:** it counts down to the short end and then reads **CHECK IT**, not TIME'S UP.
15. Turn on **COOKING MODE**, start a timer of a few minutes and leave the tablet alone. **You should see:** the screen stays on and it chimes on time. (Without cooking mode a tablet that
    goes to sleep may chime late, when you wake it.)

Tell the next session which step did not do what it said. When you report the timers passed, the plan (`docs/PLAN-RUN-SHEET.md`) is closed and deleted in a docs-only PR.

## The converter bar

The master copy of the converter's instructions is `converter/conversion-instructions.md` (version **2026-10-25.1** now). When it changes, a gold
**CONVERTER** bar shows in your household until someone taps **DONE**. The 25 Oct change makes two kinds of step clear (pasta on its own, and a bake you open the oven to baste), on top of the 24 Oct rule for the steps that look after
themselves (a step that is prepared and then waits, long simmers, ranges, and "when unsure, write nothing"), so reload every device first (above), then do the steps below.

1. Tap **OPEN THE INSTRUCTIONS ↗** and download the file.
2. In the Claude app, open your conversion project and replace its copy of the file with the new one.
3. Back in the app, tap **DONE**. **You should see:** the bar goes, on every device in the household.
4. To prove the new file, convert three recipes you have the page for, in the conversion project, and compare each timed step's `, hands off` with the same step in your
   library. **You should see:** the same marks, except that a step which only waits 5 or 6 minutes (in the oven, resting or cooling), a boil with no time that is not pasta on its own, and a step
   the page leaves unclear come out with no mark. That is the rule on purpose; add the mark by hand if you want it. Do not paste these into the app; the recipes are already there.

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
