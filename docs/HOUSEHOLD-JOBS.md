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
| [Reload the app](#reload-the-app-on-every-device), on any device not opened since 22 Oct | every device | 1 min | No |
| [Try the timeline](#try-the-timeline-after-the-23-oct-reload), once the app is **2026-10-23.1** | tablet and phone | 5 min | No |
| [Tap DONE on the converter bar](#the-converter-bar), if it shows | app | 1 min | Only the converter's DONE |

Nothing else is waiting. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Reload the app on every device

The current app is **2026-10-22.1** (`APP_VERSION`); **2026-10-23.1** once the timeline PR is merged.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** Version **2026-10-22.1** or later.

## Try the timeline after the 23 Oct reload

Needs a recipe with times on its steps, and a group of two dishes on the Planner (one a Side). Nothing here saves anything.

1. Open a recipe on the **tablet** and look at the strip above the diagram. **You should see:** the last time mark ends at the strip's right
   edge, not cut off; a step with no time (INSTANT) is a small diamond with its name beside it; every bar is wide enough to put a finger on.
2. Tap a box in the diagram. **You should see:** its bar in the strip flashes, and goes grey with a ✓. Tick a later box: the steps before it
   go grey too. Tap the first box again: only that one goes back to colour. Press **RESET TICKS**: every bar is back in colour.
3. Tap a bar. **You should see:** the page takes you to that step's box and flashes it.
4. Open the group on the Planner. **You should see:** each lane has its dish's name and colour above it. Tap a bar: the page takes you to
   that step in **that dish's** diagram. Tick a box in one dish: only that dish's bars go grey.
5. On the **phone**, open the group. **You should see:** the heading in three rows (the label, then START TOGETHER and FINISH TOGETHER, then
   the total), not squeezed into a column.
6. On the phone, open a recipe whose table is wider than the screen, in **Classic**. **You should see:** a small plum square with an arrow at the
   table's top right, which goes when you scroll to the end.

Tell the next session which step did not do what it said; it takes the job off this page when you report it passed.

## The converter bar

The master copy of the converter's instructions is `converter/conversion-instructions.md` (version **2026-10-21.1** now). When
it changes, a gold **CONVERTER** bar shows in your household until someone taps **DONE**.

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

- **22 Oct:** you reported every open tablet check complete (the readability changes, the Modernist style, liquids, EST., ADD SEVERAL,
  the filter sheet, PRE-MADE, the tablet-review batches, the denser Planner, a recipe opening at the day's SERVES, an entry's meal and a
  shortlist note onto a day, and the converter's DONE). Issues #94 and #95 were closed; the preview site (#100) is ignored.
- **21 Oct:** the split-ingredient fix is in your conversion project (converter 2026-10-21.1) and its test 16 passed. A recipe already in the
  library keeps whatever it had: fix one with a one-line edit in its Edit form, then COMPARE WITH SOURCE again.
- **20 Oct:** the calendar's reminder per meal is live (its SQL applied, `calendar-sync` redeployed, a sync ran with no error). You decided to leave
  the 13 old Test Kitchen events in the RecipeWrangler calendar as they are; delete one by hand in Google Calendar if it becomes a nuisance.
- **18 Oct:** the test-household split was done: your account is in a new household under the family's name; the old one is **Test Kitchen**,
  with the test account and the placeholder library. The record is in `PrivateBackup` (`migrations/test-household-split/README.md`).
