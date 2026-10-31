# Household job list

The jobs only the household can do: a session can't tap the tablet, decide for you, or deploy for you. **Last brought up to date
25 Oct 2026**: you reported every job here complete; one new job is waiting (sign-in, below).

**Testing is done in your household only** (decided 14 Oct): the one that has confirmed the converter. The other households sort
out their own converter and need no steps here.

**How to use this page.** Each job has numbered steps; under a step, **You should see** says what the app should do. When you finish
a job, tell the next session ("the converter is reloaded", "a step didn't do what it said") and it takes the job off this page.
**A session that ships something the household will notice adds its tablet steps here, in plain words, and removes them when
they're reported passed.** The standing regression pass for a session is `docs/TEST-PLAN.md`.

## At a glance

Three jobs: **Sign-in on each device** (Job 1), a few minutes per device; **Reporting a bug or an idea** (Job 2), a few minutes on the tablet; and **COOK AHEAD** (Job 3),
which starts with applying a database change from the dashboard, before the pull request that carries it is merged. What to build next is your choice; `docs/STATUS.md` §3 lists what is open.

---

## Job 1: signing in again on each device (issue #196)

The sign-in screen now remembers your email and lets the device's own password manager offer to save the password. A test cannot see a browser's
"save this password?" offer, so this needs a real device. Do it on the tablet you cook from first, then on a phone or laptop if you like, and tell the
next session which device and browser you used (Safari on an iPad, Chrome on Android, and so on).

1. **Reload the app** so it is on version 2026-10-25.4. **You should see:** Settings → HELP shows that version.
2. Tap **SIGN OUT** at the foot of the sidebar. **You should see:** the sign-in screen with the email box empty the first time (this device does not know
   your email yet).
3. Type your email and password and tap **Sign in**. **You should see:** the app opens. The browser may now offer to save the password: Chrome shows a
   "Save password?" box; Safari on an iPad or iPhone offers it through iCloud Keychain, if Passwords is switched on in the device's Settings. Accept it.
   **If nothing is offered,** say so: that is what a session needs to know.
4. Tap **SIGN OUT** again. **You should see:** the sign-in screen with your **email already filled in**, the cursor in the **password** box, and a small
   underlined **Not you? Use another email** under the email.
5. Tap the password box (or look at the keyboard's suggestion bar). **You should see:** the browser offers your saved password; one tap, or Face ID or a
   fingerprint, fills it in. Tap **Sign in**. **You should see:** the app opens.
6. *Only on a device other people use:* sign out, then tap **Not you? Use another email**. **You should see:** the email box empties and the link goes.
   Sign in again as usual before you finish.

If step 3 or 5 does not behave as written, note which one and what you saw.

---

## Job 2: reporting a bug or an idea from the app (issue #198)

A test cannot open GitHub as you, so whether the form arrives filled in, and whether the label lands, needs a real device. Do it on the tablet and, if you
like, a phone. You need to be signed in to GitHub in that browser.

1. **Reload the app** so it is on version 2026-10-30.1. **You should see:** Settings → HELP shows that version.
2. In Settings → HELP, find **REPORT A BUG OR AN IDEA**. **You should see:** **BUG** and **IDEA** buttons, a title box, a larger box, and
   **OPEN ON GITHUB ↗** greyed out.
3. Choose **IDEA**, type the title `Test report, please close`, and a line or two in the box. **You should see:** the button turns solid once there is a title.
4. Tap **OPEN ON GITHUB ↗**. **You should see:** GitHub opens in a new tab on the app's *new issue* page with the title `Idea: Test report, please close`, your words, and under
   a line a short "From the app" list (version, look, screen, browser). Nothing about any recipe. If GitHub shows the label **enhancement** on it, say so;
   if there is no label, say that instead (it depends on your GitHub account's rights on the repository).
5. Tap GitHub's green **Submit new issue**, then close the issue. **You should see:** it appears under the app's issues. **Do not send a second one**
   unless step 4 failed.
6. Back in the app, **You should see:** what you typed is still in the boxes.

If a step does not do what it says, note which one and what you saw.

---

## Job 3: COOK AHEAD on the Planner (issue #221)

**This one starts with a step only you can do, and it has to come first.** Do the rest in Test Kitchen.

1. **Apply the change to the database.** Supabase dashboard → SQL editor → paste the statement from `docs/migrations/add-cook-ahead.md` (the first code
   block, from `begin;` to `commit;`) → Run. **You should see:** it finishes without an error. Then run the *After it is applied* queries on that page.
   **You should see:** `planner_days | cook_ahead | ARRAY | NO` and `recipe_logs | cook_ahead | boolean | NO`, `cook_ahead_logs 0`, and one constraint row.
   Tell the next session the date, so the page and `docs/INFRASTRUCTURE.md` can say it was applied.
2. **Reload the app** so it is on the version that carries this change. **You should see:** Settings → HELP shows it, and What's new mentions COOK AHEAD.
3. On the Planner, tap the **TO COOK** button on a dish (a recipe for a day from today on is fine). **You should see:** a box, "How is this dish made?", with
   **TO COOK** (marked as the current one), **COOK AHEAD** and **PRE-MADE**, each saying what it does.
4. Choose **COOK AHEAD**. **You should see:** the button reads **COOK AHEAD**, and the dish is still on the Shopping list.
5. On **today**, tap **COOKED ✓** on that dish. **You should see:** a note that it was logged as cooked ahead and is in your cooking stats, not the food diary; no
   question about which meal; the button now reads **✓ COOKED AHEAD**. Open **History** for today. **You should see:** the dish is **not** there. Open **STATS**.
   **You should see:** the meal count up by one, and the dish's card says it was cooked today.
6. Back on the Planner, tap **✓ COOKED AHEAD** and say yes. **You should see:** the button goes back to **COOKED ✓**, and STATS and the card are as they were.
7. Choose **PRE-MADE** from the same box on a dish. **You should see:** it still asks which meal, reads **PRE-MADE · DINNER**, and leaves the Shopping list.
   Put it back to **TO COOK** afterwards.

If a step does not do what it says, note which one and what you saw.

---

## Nothing to do: a session checks these

None at the moment.

---

## Recently done

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
