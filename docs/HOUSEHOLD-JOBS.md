# Household job list

**Last brought up to date: 12 Oct 2026.**

These are the jobs only you can do. A session can't tap the tablet, make decisions for you, or deploy for you.

**How to use this page**

- Each job has numbered steps.
- Under a step, **You should see** says what the app should do.
- When you finish a job, tell the next session, e.g. "51a passed" or "50a: step 2 didn't keep the star". The session takes the
  job off this page.
- The numbers (51a, 50a …) match `docs/TEST-PLAN.md`, which keeps the fuller technical notes.

---

## At a glance

| Job | Where | Time | Saves anything? |
| --- | --- | --- | --- |
| [Reload the app](#reload-the-app-on-every-device) | every device | 1 min | No |
| [Close issue #101](#close-issue-101) | GitHub | 1 min | No |
| [51a · Recipe checker and scaling](#51a--recipe-checker-and-scaling) | tablet | 5 min | No |
| [50a · Settings and stars across devices](#50a--settings-and-stars-across-devices) | tablet + phone | 10 min | Yes, then put back |
| [47a · Your own photo as a recipe's picture](#47a--your-own-photo-as-a-recipes-picture) | tablet + phone | 5 min | Yes |
| [38d · A PDF as a recipe's source](#38d--a-pdf-as-a-recipes-source) | laptop + tablet | 10 min | Yes |
| [38c · Checked against the photo](#38c--checked-against-the-photo) | tablet | 5 min | Yes |
| [40b · Automatic calendar toggles](#40b--automatic-calendar-toggles) | tablet + phone | 15 min, plus the evening before a meal | Yes |
| [BBC Good Food validations](#bbc-good-food-validations) | tablet or laptop | 5 min a recipe | Yes |
| [Reload the converter](#reload-the-converter-in-both-households) | Claude app | 5 min | No |
| [D6 · Repair the reconstructed recipes](#d6--repair-the-reconstructed-recipes) | with a session | an evening | Yes |
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

Do them in this order. The first ones are the quickest.

### 51a · Recipe checker and scaling

**Saves nothing.** You leave without saving.

1. Tap **NEW RECIPE**.
2. Paste this made-up recipe into the box:

   ```
   TITLE: Test 51a
   SOURCE: test
   SERVINGS: 2
   GROUP a:
   1 pint milk
   1 pinch nutmeg
   1 L water
   GROUP a:
   100 grams oats
   STAGE:
   MERGE a -> b: Warm [5 min]
   NOTES:
   Merge the two halves before serving
   ```

3. Tap **PARSE & PREVIEW**.
   - **You should see:**
     - The diagram says GROUP "a" is written more than once.
     - "1 pint milk" is flagged as not metric.
     - The NOTES sentence is **not** listed as a line the app couldn't read.
4. In the text, change the second `GROUP a:` to `GROUP c:`.
5. Change the MERGE line to `MERGE a, c -> b: Warm [5 min]`.
6. Tap **PARSE & PREVIEW** again.
   - **You should see:** the error has gone.
7. In **SCALE TO SERVE**, type 4 and tap **APPLY**.
   - **You should see** these lines in the text:
     - `2 pinches nutmeg`
     - `2 L water`
     - `200 grams oats`
8. Tap **UNDO SCALE**.
9. In **SCALE TO SERVE**, type 3 and tap **APPLY**.
   - **You should see:**
     - `1 pinch nutmeg` is unchanged.
     - The water reads `1 1/2 L water`.
10. Leave without saving.

### 50a · Settings and stars across devices

**Saves settings and a star.** Step 9 puts them back.

**The week-start question**

1. On the shopping list, tick one item.
2. Go to **Settings → APP** and change **WEEK STARTS ON** to another day.
   - **You should see:** it asks first, and says the ticks will be cleared.
3. Tap **Cancel**.
   - **You should see:** the day is unchanged, and your tick is still there.
4. Change the day again and tap **OK**.
   - **You should see:** the tick has gone.
5. Change the day back to what it was.

**A star kept through an edit**

6. On the **phone**, star a recipe.
7. On the **tablet**, without reloading, open that recipe, tap **EDIT**, then **SAVE RECIPE**.
   - **You should see:** after reloading either device, the star is still there.

**Two devices' settings**

8. With the app open on both devices:
   - On one, change **APPEARANCE**.
   - On the other, change **WEEK STARTS ON**.
   - **You should see:** after reloading both, both changes have stuck.

**Put it back**

9. Set **APPEARANCE**, **WEEK STARTS ON** and the star back as they were.

### 47a · Your own photo as a recipe's picture

**Saves the recipe and stores the photo.**

1. Open one of your own recipes and tap **EDIT**.
2. Tap **UPLOAD PHOTO**, then take a photo or pick one from the gallery.
   - **You should see:**
     - The photo shows small beside the button.
     - **IMAGE URL** empties.
     - **BEFORE YOU SAVE** says "Stores your photo as the recipe's picture".
3. Tap **RE-CHECK**.
   - **You should see:** the photo is still chosen.
4. Tap **SAVE RECIPE**.
   - **You should see:** the card shows your photo.
5. On the **phone**, leave the app's tab and come back.
   - **You should see:** the photo there too.
6. **EDIT** again, **UPLOAD PHOTO** with a different picture, then **SAVE RECIPE**.
   - **You should see:** the new photo, not the old one.
7. **EDIT** again, choose a photo, then type a link into **IMAGE URL**.
   - **You should see:** the chosen photo goes. Leave without saving.

**To undo:** paste the old picture link back into **IMAGE URL** and **SAVE RECIPE**.

### 38d · A PDF as a recipe's source

**Saves the recipe and stores the PDF.**

1. On the **laptop**, open a recipe's web page, choose **Print**, and save it as a PDF.
2. In the app, open that recipe and tap **EDIT**.
3. Tap **ADD PHOTO OR PDF** and pick the PDF.
   - **You should see:**
     - It shows as PAGE 1 · PDF · NEW, with its file name and **OPEN ↗**.
     - **BEFORE YOU SAVE** says "Stores the new source PDF with the recipe".
4. Optional: try a PDF over 10 MB.
   - **You should see:** it is refused, and the app says why.
5. Tap **SAVE RECIPE**.
   - **You should see:** the recipe's chip reads **SOURCE PDF**.
6. Tap the chip, then **OPEN ↗**.
   - **You should see:** the PDF opens in a new tab.
7. On the **tablet**, open the same recipe and tap **OPEN ↗**.
   - **You should see:** it opens in the tablet's PDF viewer.

**Tell the session:** is opening it outside the app good enough on the tablet, or would you rather see the pages inside the app?

### 38c · Checked against the photo

**Saves the recipe.** Use the recipe you added a source photo to on 30 Sep (step 38b).

1. Open that recipe and tap **EDIT**.
   - **You should see:** under AGAINST THE SOURCE, beside the photo, a **CHECKED AGAINST THE PHOTO** button.
2. Read the ingredient lines against the photo.
3. If they match, tap **CHECKED AGAINST THE PHOTO**.
   - **You should see:**
     - "Recorded as checked against the photo when you save", with **UNDO**.
     - **BEFORE YOU SAVE** says the same.
4. Tap **SAVE RECIPE**.
   - **You should see:** the recipe's chip reads **VALIDATED** and the date.
5. Tap **EDIT** again.
   - **You should see:** "Checked against the source photo" and the date, and no second offer.
6. Go to **Settings → LIBRARY → LIBRARY CHECK** and tap **RUN**.
   - **You should see:** this recipe reads "checked against the photo" and isn't among those needing attention.

**Tell the session:** do the photo and the lines sit close enough on the tablet to check one against the other?

### 40b · Automatic calendar toggles

**Saves settings and Planner days, and adds events to the RecipeWrangler calendar.**

**Switching on "add to calendar"**

1. Go to **Settings → APP → CALENDAR**.
   - **You should see:** under **REMIND AT**, two switches, both off:
     - **AUTOMATICALLY ADD TO CALENDAR**
     - **AUTOMATICALLY REMIND ME FOR MAIN MEALS**
2. On the Planner, note which upcoming planned days are **not** IN CALENDAR.
3. Switch **AUTOMATICALLY ADD TO CALENDAR** on.
   - **You should see:**
     - A message saying how many days were added.
     - Those days now show IN CALENDAR.
     - Days marked away, and days before today, are unchanged.
     - Within a few seconds, the phone's calendar shows their all-day events.

**New and changed days**

4. Plan a recipe on an empty day.
   - **You should see:** it is IN CALENDAR straight away, and its event appears.
5. Switch that day off by hand, then change its servings.
   - **You should see:** it stays off.
6. Add another recipe to that day.
   - **You should see:** it is on again.

**Switching on "remind me"**

7. Switch **AUTOMATICALLY REMIND ME FOR MAIN MEALS** on.
   - **You should see:**
     - A message saying how many main-meal days got a reminder.
     - A day with a main-course recipe shows REMIND ME on; a day with only a side or a dessert does not.
     - The evening before such a day, at the REMIND AT time, the phone shows a notification.

**Switching both off**

8. Switch both off.
   - **You should see:**
     - The messages say days already set stay set.
     - Nothing on the Planner changes.
9. Plan another recipe.
   - **You should see:** that day stays off.

**On the phone**

10. On the **phone**, open **Settings → APP → CALENDAR**.
    - **You should see:** the switches as you set them on the tablet. They belong to the household, not the device.

**To undo:** switch the toggles off, and switch the days off by hand.

**Tell the session:** does "Main" in the course tags match what you mean by a main meal, recipe by recipe?

---

## Library jobs

**Before any job that changes recipe text:** take a fresh **EXPORT DATA** from the app's sidebar. Keep the file somewhere other
than the repo.

### BBC Good Food validations

Six recipes are from BBC Good Food. Five of them were rebuilt from another edition before the 29 Sep rule.
**Settings → LIBRARY → LIBRARY CHECK** lists the ones still to do.

For each recipe:

1. Open it and tap **EDIT**.
2. Tap **OPEN SOURCE ↗**. The BBC page opens.
3. On the BBC page, copy the ingredient list.
4. Back in the app, paste it into the box and tap **COMPARE PASTED LIST**.
5. If the lists match, tap **VALIDATE INGREDIENT LIST**, then **SAVE RECIPE**.
6. If they don't match, note the recipe and tell a session. It is a D6-style fix.

### Reload the converter in both households

The master copy is `converter/conversion-instructions.md` in this repo. It changed this month.

1. Open the file on GitHub and copy its contents.
2. In the Claude app, open **your** household's conversion project and replace its instructions with the copy.
3. Do the same in the **other** household's conversion project.

The other files under `converter/` are reference material only. Don't load them.

### D6 · Repair the reconstructed recipes

This one is done **with a session**, by the recipe-text rules in `CLAUDE.md`:

1. Take a fresh **EXPORT DATA** first.
2. The session proposes the exact new lines, and you approve them.
3. The lines before and after are saved to `PrivateBackup`, as the undo.
4. The session changes one recipe first. You open it in the app.
5. Only then does it do the rest.

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
  - Tablet steps 39a, 40a, 42a, 43a, 44a, 45a, 46a, 48a and 49a passed.
  - The default-privileges SQL was applied.
  - Three Edge Functions were redeployed and checked.
  - The October review's issues were closed: all but #101.
- **10 Oct:** tablet steps 41a and 41b passed. The third household was made.
