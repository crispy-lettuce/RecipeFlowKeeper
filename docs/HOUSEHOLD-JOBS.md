# Household job list

**Last brought up to date: 13 Oct 2026, morning.**

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
| [Reload the app](#reload-the-app-on-every-device) | every device | 1 min | No |
| [Close issue #101](#close-issue-101) | GitHub | 1 min | No |
| [Confirm the converter](#confirm-the-converter) | Claude app, then the app | 5 min per household | One tap per household |
| [Decisions](#decisions-waiting-on-you) | — | — | — |

---

## Quick jobs

### Reload the app on every device

New versions went live on 12 Oct.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready**, tap **RELOAD**. Otherwise refresh the page.

### Close issue #101

Every finding of the October review is now fixed and live.

1. Open https://github.com/crispy-lettuce/RecipeFlowKeeper/issues/101.
2. Tap **Close issue**.

---

## App checks

### 52a: the converter reminder

Do it with [Confirm the converter](#confirm-the-converter) below: the SQL is in and #129 is merged (13 Oct), so the bar is live.

1. Open the app on the tablet.
   - **You should see:** a gold **CONVERTER** bar near the top, saying the converter's instructions have changed, version
     2026-10-12.1.
2. Tap **PLANNER**, then **RECIPES**.
   - **You should see:** both open as usual, with the bar still there.
3. Tap **LATER**, then reload the page.
   - **You should see:** the bar goes, then comes back after the reload.
4. Tap **OPEN THE INSTRUCTIONS ↗**.
   - **You should see:** the file on GitHub, with "Version 2026-10-12.1" near the top.
5. Load it into your household's conversion project (as in the job below), then tap **DONE** in the app.
   - **You should see:** the bar goes, and a message says your household has version 2026-10-12.1. It stays gone after a reload.
6. Open the app on the phone, signed in to the same household.
   - **You should see:** no bar.

---

## Library jobs

### Confirm the converter

The app now asks each household itself, and remembers who has done it. The master copy is `converter/conversion-instructions.md`
in this repo.

1. Reload the app on every device.
   - **You should see:** the gold **CONVERTER** bar.
2. In each household: tap **OPEN THE INSTRUCTIONS ↗** on the bar, download the file, and in the Claude app replace the copy in
   that household's conversion project with it.
3. In each household, back in the app, tap **DONE** (once per household, on any device). App check 52a above walks through it.
   - **You should see:** the bar goes for everyone in that household.

The other files under `converter/` are reference material only. Don't load them.

---

## Decisions waiting on you

### The two recipe titles in the docs

Two library recipe titles are still named in `IMAGES.md`, `HANDOVER.md`, `TEST-PLAN.md` and the `rehost-images` comments. They
tell the story of the two broken photos.

- **Decide:** scrub them, or leave them.

### Your own issues

Nothing is built for these until you decide:

- **#87:** side dishes with no timings.
- **#88:** how the flow is meant to be followed.
- **#94:** the shopping list as a PNG, printing with ticks, and an "audit" setting.
- **#95:** the INGREDIENTS settings tab getting long.
- **#100:** moving to Cloudflare Pages.

---

## Nothing to do: a session checks these

- **The photo backup** on Sunday 18 Oct: the first run of the new mirror script in `PrivateBackup`.

---

## Recently done

- **13 Oct:** #129 (the converter reminder, #127) merged, and its SQL applied: the column is there, read back by a session.
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
