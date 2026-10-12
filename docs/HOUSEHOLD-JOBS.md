# Household job list

**Last brought up to date: 12 Oct 2026, evening.**

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
| [Reload the converter](#reload-the-converter-in-both-households) | Claude app | 5 min | No |
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

**None waiting** (12 Oct 2026). A new one appears here when a change needs checking on the tablet.

---

## Library jobs

### Reload the converter in both households

The master copy is `converter/conversion-instructions.md` in this repo. It changed this month.

1. Open the file on GitHub and copy its contents.
2. In the Claude app, open **your** household's conversion project and replace its instructions with the copy.
3. Do the same in the **other** household's conversion project.

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
