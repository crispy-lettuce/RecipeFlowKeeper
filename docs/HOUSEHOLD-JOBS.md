# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
22 Oct 2026**, when the household reported every open tablet check complete; there are no numbered app checks waiting.

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

| Job | Where | Time | Saves anything? |
| --- | --- | --- | --- |
| [Reload the app](#reload-the-app-on-every-device), on any device not opened lately | every device | 1 min | No |
| [Tap DONE on the converter bar](#the-converter-bar), if it shows | app | 1 min | Only the converter's DONE |

Nothing else is waiting. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Reload the app on every device

The current version is the newest entry in `changelog.json`, shown in Settings → HELP.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready.**, tap **RELOAD**. Otherwise refresh the page.
3. Open **SETTINGS → HELP**. **You should see:** the newest version, matching the one the last session announced.

## The converter bar

The master copy of the converter's instructions is `converter/conversion-instructions.md` (its `**Version …**` line says which). When
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
