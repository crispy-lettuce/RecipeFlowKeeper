# Household job list

**Last brought up to date: 13 Oct 2026, after #132 merged (plans filed).**

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
| [53a: FILE labels and the printed list](#53a-file-labels-and-the-printed-shopping-list) | tablet | 5 min | Ticks only, undone at the end |
| [54a: AUDIT on the shopping list](#54a-audit-on-the-shopping-list) | tablet and phone | 5 min | One aisle, undone by UNDO |
| [55a: folding and searching INGREDIENTS](#55a-folding-and-searching-settings--ingredients) | tablet and phone | 3 min | No |
| [Confirm the converter in the second household](#confirm-the-converter-in-the-second-household) | Claude app, then the app | 5 min | One tap |
| [Choose what to build next](#your-own-issues-decided-13-oct) | — | — | — |

---

## Quick jobs

### Reload the app on every device

A new version goes live when the PR for #94's printed list and the FILE labels merges.

1. On the tablet, the phone and the laptop, open the app.
2. If a bar says **A new version is ready**, tap **RELOAD**. Otherwise refresh the page.

---

## App checks

### 55a: folding and searching Settings → INGREDIENTS

After the #95 PR merges, and the app is reloaded.

1. Open **Settings → INGREDIENTS**.
   - **You should see:** **WORD MATCHES**, **SHOPPING AISLES** and **SWAPS** open, each with a count in brackets; **DICTIONARY**
     is one line, (140).
2. Tap **WORD MATCHES**, leave Settings, and come back.
   - **You should see:** it folded to one line, and still folded.
3. Type a word you know is in one of your swaps into **INGREDIENT LOOKUP**.
   - **You should see:** SWAPS open, showing (1 OF …); the others folded, reading (0 OF …).
4. Clear the box.
   - **You should see:** WORD MATCHES folded again, as you left it. Tap it to open it again.
5. Do steps 1 and 2 on the phone.
   - **You should see:** nothing runs off the side of the screen.

### 54a: AUDIT on the shopping list

After the AUDIT PR merges, and the app is reloaded. Do it after 53a.

1. Open **SHOPPING**.
   - **You should see:** no **MERGE WITH…** on any row, and an **AUDIT** button at the top (it reads **AUDIT · 1** or more if
     a "Same as …?" question is waiting).
2. Tap **AUDIT**.
   - **You should see:** the button reads **END AUDIT**; every row shows **MERGE WITH…** and its aisle, with why it is there.
3. Tick an item, then pick another aisle for it.
   - **You should see:** it moves to that aisle, still ticked, and says **Moved to … · UNDO**. Tap **UNDO**: it goes back.
4. Reload the page.
   - **You should see:** still in AUDIT. On the phone, the list is not.
5. On the phone, tap **AUDIT**.
   - **You should see:** nothing runs off the side of the screen.
6. **PRINT / A4 PDF** and **EXPORT PNG** while in AUDIT.
   - **You should see:** none of the tools on the page or in the picture.
7. Tap **END AUDIT**, and untick the item.

### 53a: FILE labels and the printed shopping list

After the PR for the FILE labels and #94's printed list merges, and the app is reloaded.

1. **EDIT** a recipe that has a source photo or PDF.
   - **You should see:** under the photos, each one is labelled **FILE 1**, **FILE 2** and so on (it used to say PAGE).
2. Open that recipe's source files from the viewer.
   - **You should see:** **FILE 1 OF 2** (or however many) under each. Leave without saving.
3. On **SHOPPING**, tick one item, then tap **PRINT / A4 PDF** and look at the preview.
   - **You should see:** the ticked item is not on the page; everything else is. Cancel the print.
4. Tick every item in one aisle, then **PRINT / A4 PDF** again.
   - **You should see:** that aisle's heading has gone too. Cancel the print.
5. Tap **EXPORT PNG** and open the picture.
   - **You should see:** the same as the print: no ticked items, no empty aisle, and no **MERGE WITH…** links.
6. Untick what you ticked.

---

## Library jobs

### Confirm the converter in the second household

Your household has done this (13 Oct). The second family household still sees the gold **CONVERTER** bar until someone there
does the same. The master copy is `converter/conversion-instructions.md` in this repo.

1. On a device signed in to the second household, open the app.
   - **You should see:** the gold **CONVERTER** bar, version 2026-10-12.1.
2. Tap **OPEN THE INSTRUCTIONS ↗**, download the file, and in the Claude app replace the copy in that household's conversion
   project with it.
3. Back in the app, tap **DONE**.
   - **You should see:** the bar goes, for everyone in that household.

The weekly live test's own household never confirms, since no one uses it; nobody sees its bar.

The other files under `converter/` are reference material only. Don't load them.

---

## Your own issues

### Your own issues: decided 13 Oct

You chose a direction for each on 13 Oct, and "defaults" on every plan's questions. The plans are in `docs/`
(`PLAN-SIDES.md`, `PLAN-PREP-STEPS.md`, `PLAN-SHOPPING-AUDIT.md`, `PLAN-INGREDIENTS-TAB.md`, `PLAN-PREVIEW-SITE.md`).
You chose the order on 13 Oct: #94, then #95, #88 and #87; #100 stays parked.

- **#87, sides with no timings:** the app spots "serve with rice" and offers a matching side recipe for the same day.
- **#88, when chopping is done:** a setting that turns "sliced", "diced" and the like into their own steps in the flow.
- **#94, the shopping list:** both halves built: ticked items left off print and PNG (53a above), and the **AUDIT** button
  (54a above).
- **#95, the INGREDIENTS tab:** built: collapsible sections and a search (55a above).
- **#100, a preview site:** parked; the plan is about trying a change before it reaches the live app.

---

## Nothing to do: a session checks these

- **The photo backup** on Sunday 18 Oct: the first run of the new mirror script in `PrivateBackup`.

---

## Recently done

- **13 Oct:**
  - The two recipe titles in the docs became "recipe A" and "recipe B", as you asked. Issue #101 is closed.
  - #129 (the converter reminder, #127) merged, and its SQL applied: the column is there, read back by a session.
  - Tablet step 52a passed. Your household reloaded the converter and tapped DONE; the database holds version 2026-10-12.1.
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
