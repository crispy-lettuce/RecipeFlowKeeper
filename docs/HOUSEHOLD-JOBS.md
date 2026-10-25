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
| [Try START COOKING](#try-start-cooking), once the app is **2026-10-24.2** | tablet | 8 min | No |
| [Rehearse the timers](#rehearse-the-timers), once the app is **2026-10-24.5** | tablet, in Test Kitchen | 15 min | Two made-up recipes in Test Kitchen's library |
| [Tap DONE on the converter bar](#the-converter-bar), if it shows | app | 1 min | Only the converter's DONE |

Nothing else is waiting. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Reload the app on every device

The current app is **2026-10-24.5** (`APP_VERSION`) once the timers PR is merged.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** Version **2026-10-24.5** or later.

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
The timers (a countdown and a chime) have their own rehearsal, next. Tell the next session which step did not do what it said.

## Rehearse the timers

A real roast takes an hour or more, so this is a rehearsal: two **made-up** recipes whose steps are marked hands off or hands on as in a real cook, with every timed step shortened to 1 or 2 minutes
except one 7-minute roast. The run fits in about a quarter of an hour. It needs the app at **2026-10-24.5** or later, on the **tablet**, signed in to **Test Kitchen** (its plan and shopping list are
separate from yours, so nothing here reaches your week's shop). The ingredients are generic and none is a line from your library. Delete the two recipes afterwards if you like.

**Set up (2 min).** In Test Kitchen tap **NEW RECIPE**, paste the first recipe into the box, tap **SAVE RECIPE**, and do the same for the second.

Recipe 1, the main:

```
TITLE: Timer Rehearsal Roast
SOURCE: Made up for the timers rehearsal
SERVINGS: 2
TIME: 12 min
TAGS: course=Main
STEPS:
Preheat the oven to 185°C (fan).
GROUP tray:
450 g potatoes, cut into chunks
3 chicken thighs
GROUP glaze:
1 tbsp rapeseed oil
2 tsp clear honey
STAGE:
MERGE tray, glaze -> traybake: toss the potatoes and chicken with the oil and honey on a baking tray [2 min]
STAGE:
MERGE traybake -> roasted: roast on the top shelf until golden, turning once halfway [7 min, hands off]
STAGE:
MERGE roasted -> rested: cover with foil and leave to rest [1 min, hands off]
STAGE:
MERGE rested -> sliced: slice the chicken [1 min]
STAGE:
MERGE sliced -> served: plate up with the potatoes [instant]
```

Recipe 2, the side:

```
TITLE: Timer Rehearsal Greens
SOURCE: Made up for the timers rehearsal
SERVINGS: 2
TIME: 6 min
TAGS: course=Side
STEPS:
GROUP beans:
180 g green beans
GROUP gravy:
150 ml chicken stock
1 1/2 tsp cornflour
STAGE:
MERGE beans -> trimmed: top and tail the beans [1 min]
STAGE:
MERGE trimmed -> boiled: boil in salted water until just tender [1-2 min, hands off]
MERGE gravy -> reduced: simmer the stock until glossy [until done, hands off]
STAGE:
MERGE reduced -> thickened: whisk in the cornflour and simmer until thick [2 min]
STAGE:
MERGE boiled, thickened -> served: drain the beans and serve with the gravy [instant]
```

**Part A: one dish, about 11 minutes.** Open **Timer Rehearsal Roast** and stay on the page: a timer sounds only while its recipe or group is open on the screen. Turn the tablet's sound up and take it off silent.

1. Tap **START COOKING**. **You should see:** **On time for HH:MM**, a **Now** line, and in the row **YOUR HANDS** a long outline reading **free 8 min** (nothing needs you while the roast cooks and rests).
2. Tap **START** on the first box (tossing the potatoes). It is hands on, so it says START. **You should see:** **STARTED hh:mm** and a countdown beside it, **2:00 LEFT**, going down each second.
3. At 2:00. **You should see:** one chime, and a buzz if the tablet can; the box reads **TIME'S UP**; **DONE** pulses; the Now line begins **Time's up:**; a message at the foot names the step. Wait another half minute: it does not ring a second time. Tap **DONE**.
4. The roast box now reads **START TIMER** (it looks after itself). Tap it. **You should see:** **7:00 LEFT**. This is the sleep test: press the tablet's power button to lock the screen at once, leave it for about 7 minutes, and wake it just after the 7 minutes are up.
   **You should see:** **TIME'S UP**, and one chime when it wakes. If it was asleep when the time came, the chime may be late: that is the known limit, and why **COOKING MODE** exists. To see the other half, do this step again in a fresh run
   with **COOKING MODE** on and leave the screen alone: it stays on and chimes on time.
5. Tap **DONE**, then **START TIMER** on the rest (1 minute). **You should see:** **1:00 LEFT**, then **TIME'S UP** and one chime. **DONE**. Then **START** on slicing (1 minute): the same. **DONE**.
   **You should see:** the whole dish done in about 11 minutes, with 4 chimes in all (tossing, roasting, resting, slicing).

**Part B: two dishes together, about 4 minutes.** On the **Planner**, add both recipes to today, tap **GROUP SOME TOGETHER**, pick both, tap **GROUP SELECTED**, and open the group.

6. **You should see:** **EAT AT** with a time, the roast starting earlier than the greens (the roast about 11 minutes before EAT AT, the greens about 4), and in **YOUR HANDS** a red hatched **CLASH 1 min** at the end, where slicing the chicken and whisking the gravy both want your hands.
7. Tap **AVOID THE CLASH**. **You should see:** the clash gone, **START AT** 2 minutes earlier (the roast has to start 2 minutes earlier; the greens do not move), EAT AT unchanged, and the button reading **✓ CLASH AVOIDED · TAP TO UNDO**.
8. Tap **START COOKING**. Work through the greens the same way: **START** on topping and tailing, **START TIMER** on the boiling, then **START** on the whisking. **You should see:** the boiling counts down from **1:00** and, at zero, reads **CHECK IT**
   (not TIME'S UP, because the step said 1-2 minutes), with one chime; **DONE** stays pulsing until you press it. The step after it, **simmer the stock until glossy**, has no countdown: it has no length to count.

Together the two dishes have **7 timers**: 3 read START TIMER (the roast, the rest, the boiling), one of them a range, and 4 read START. Part A rings 4 of them, and Part B 3 (topping and tailing, the boiling, and the whisking).

Tell the next session which step did not do what it said. When you report the timers passed, the plan (`docs/PLAN-RUN-SHEET.md`) is closed and deleted in a docs-only PR.

## The converter bar

The master copy of the converter's instructions is `converter/conversion-instructions.md` (version **2026-10-24.1** now). When it changes, a gold
**CONVERTER** bar shows in your household until someone taps **DONE**. The 24 Oct change settles the rule that marks the steps that look after
themselves (a step that is prepared and then waits, pasta, long simmers, ranges, and "when unsure, write nothing"), so reload every device first (above), then do the steps below.

1. Tap **OPEN THE INSTRUCTIONS ↗** and download the file.
2. In the Claude app, open your conversion project and replace its copy of the file with the new one.
3. Back in the app, tap **DONE**. **You should see:** the bar goes, on every device in the household.
4. To prove the new file, convert three recipes you have the page for, in the conversion project, and compare each timed step's `, hands off` with the same step in your
   library. **You should see:** the same marks, except that a step which only waits 5 or 6 minutes (in the oven, resting or cooling), a boil with no time that is not pasta, and a step
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
