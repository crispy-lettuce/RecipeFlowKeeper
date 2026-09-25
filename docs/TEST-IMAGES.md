# Test pass — automatic image re-hosting

**For: the live app at https://crispy-lettuce.github.io/RecipeFlowKeeper/, after PR #7 merged
22 Sep 2026; steps 9–11 revised after the first run.** Takes about 25 minutes. Do it at a desktop, not the tablet — three steps need the
browser's devtools.

## Why this is worth doing properly

`node test/build.js && node test/smoke.js` passes 236 checks and **proves nothing here.** The
suite replaces Supabase with a stub, so it can tell you the app *asks* for a re-host and what it
does with the answer, but not that anything is ever copied, stored, or survives a reload. These
eleven steps are the only thing that can.

**Step 4 is the one that matters.** The rest are sanity; step 4 is the regression test for a
failure mode that looks exactly like success — see "What step 4 is really testing" at the bottom.

---

## Before you start

1. **Hard-reload the app.** Ctrl-Shift-R, or Cmd-Shift-R on a Mac. Then go to **SETTINGS** and
   check there is a **RECIPE PHOTOS** block with two buttons. **If it is not there, stop** — the
   deploy has not reached your browser and nothing below will mean anything.
2. **Take an export.** Sidebar → **EXPORT DATA**. Keep the file. It is your undo for this whole
   session; the nightly `PrivateBackup` dump is the other one.
3. **Have a recipe page ready** that you don't mind adding — any recipe site with a decent photo.
   You will add it, test with it, and delete it at the end.
4. **Note the recipe count** you start with, so you can tell it is unchanged at the end.

Record results as you go. A step that "seems fine" and a step you actually looked at are
different things, and this project has been caught out by the difference more than once.

---

## The steps

### 1. Add a recipe with an external photo

Convert a recipe as usual and paste it in → **PARSE & PREVIEW** → check **IMAGE URL** has been
filled with the source site's address → fill in **SERVINGS** (it is required) → **Save**.

**Expect:** the card appears in the library with the photo showing straight away.

**If the photo is missing:** the source URL is wrong or the site blocks us. Not a fault in what
we are testing — pick a different recipe and start again.

- [ ] Card appears, photo shows

### 2. The photo becomes ours

Wait about five seconds. Open the recipe → **EDIT** → look at **IMAGE URL**.

**Expect:** it now starts `https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/`
instead of the recipe site's address. Close the editor without saving.

**This is the headline feature.** Before this change you had to open devtools and run a command
by hand to get here.

**If it still shows the source site's address:** give it another ten seconds and look again —
then see "If something fails" below.

- [ ] IMAGE URL is now a `supabase.co` address

### 3. It survives a reload

Hard-reload the page. Open the same recipe → **EDIT** → **IMAGE URL**.

**Expect:** still the `supabase.co` address.

This proves the re-host reached the database, not just the page you were looking at.

- [ ] Still `supabase.co` after a reload

### 4. ⚠️ It survives someone else's save — the one that matters

1. Go to **RECIPES** and tap the **favourite star** on any *other* recipe. (Any ordinary save
   will do — changing a planner serving, editing a different recipe. The point is that it is a
   save of something unrelated.)
2. **Hard-reload.**
3. Open your test recipe → **EDIT** → **IMAGE URL**.

**Expect:** *still* the `supabase.co` address.

**If it has reverted to the recipe site's address, stop and tell me.** That is the whole feature
failing silently, and it would not look like a failure — the photo still displays perfectly,
because the source site is still serving it. See the explanation at the bottom.

- [ ] Still `supabase.co` after an unrelated save and a reload

### 5. Replacing a photo

Find a different image address — right-click a photo on the source page → **Copy image
address**. Then: open the test recipe → **EDIT** → paste it over the `supabase.co` URL in
**IMAGE URL** → **Save**.

**Expect:** the card shows the new photo immediately. Wait five seconds, reopen **EDIT**, and
**IMAGE URL** should be a `supabase.co` address again — this time with a **`?v=` number on the
end**, because the stored file was overwritten and the URL has to change to beat the browser
cache.

- [ ] New photo shows, then URL returns to `supabase.co`
- [ ] The URL now ends with `?v=` and some digits

### 6. The recipe text agrees with the database

This is the one that needs SQL. Open the Supabase dashboard → **SQL Editor**, and run:

```sql
select count(*) from recipes
where image_url is not null and image_url <> '' and syntax like '%IMAGE:%'
  and position('IMAGE: ' || image_url in syntax) = 0;
```

**Expect: 0.**

Anything above 0 means some recipe's `image_url` column and its `IMAGE:` line disagree, which
means that recipe is one edit away from silently reverting its photo. This was a real defect
until 22 Sep, so a non-zero answer is plausible, not paranoid — **tell me the number and I will
find which recipes.**

While you are there, the fuller check from `docs/IMAGES.md` §7:

```sql
select
  (select count(*) from storage.objects where bucket_id = 'recipe-images')              as objects,
  (select count(*) from recipes where image_url like '%recipe-images/%')                as self_hosted,
  (select count(*) from recipes where image_url is not null and image_url <> '')        as with_image;
```

`objects` and `self_hosted` should match, and `self_hosted` should equal `with_image`.

- [ ] Disagreement query returns **0**
- [ ] objects / self_hosted / with_image: ______ / ______ / ______

### 7. Settings → CHECK STORED IMAGES

**SETTINGS** → **RECIPE PHOTOS** → **CHECK STORED IMAGES**. Takes about a second per image, so
give it half a minute.

**Expect:** *"All 30 stored photos are intact."* (or whatever your count is).

If it names recipes that need replacing, those are genuinely broken files — two were found this
way on 22 Sep. Tell me which, and §3 of `docs/IMAGES.md` is how they get fixed.

- [ ] Reports all intact — count: ______

### 8. Settings → RE-HOST EXTERNAL IMAGES

Same block, the other button.

**Expect:** *"0 copied in, N already yours, 0 failed."* — because steps 1–5 already dealt with
everything.

**0 copied in is the pass here**, which feels backwards. It means the save path had already done
the work, so the sweep found nothing left to do.

- [ ] "0 copied in, N already yours, 0 failed" — N: ______

### 9. Saving with no connection

Devtools → **Network** tab → set throttling to **Offline**. (Or just turn the wifi off.) **Stay on
this tab** until the step says otherwise — step 10 is the one about leaving it.

Open the test recipe → **EDIT** → paste an external image address over its URL → **Save**.

**Expect:** the editor closes normally, leaving you on the recipe, and a toast reads **"Couldn't
save … — check your connection"**. Click **RECIPES** in the sidebar: the card's photo area is
**blank** — correct, because offline no photo can load from anywhere.

**What has actually happened:** your change is in this tab and nowhere else. The database never
received it. So:

1. Go back online. **Do not reload.** A reload rebuilds the app from the database, and the
   database doesn't have your change — the toast was telling you so.
2. Tap any recipe's favourite star twice (on, then off). Each of those saves sends the *whole*
   library, including the change that failed.
3. **SETTINGS → RE-HOST EXTERNAL IMAGES.** Expect **"1 copied in"**, and the card to show the
   stored photo.

*This step used to say "go back online, hard-reload, and expect 1 copied in". That could never
have happened — the reload throws the unsaved change away, so there is nothing external left to
copy. Corrected 22 Sep after it was run for real.*

- [ ] Offline save: editor closes, toast appears, card photo blank
- [ ] Back online, two favourite taps, then RE-HOST reports "1 copied in"

### 10. Leaving the tab while offline

This is the one that used to throw you out. Go offline again. **Click a different browser tab,
then click back** to the Kitchen tab.

**Expect:** nothing happens. You are still signed in, and everything is where you left it.

Until 22 Sep, coming back to the tab offline showed the **sign-in screen** with *"Couldn't load
your library — TypeError: Failed to fetch"*. Coming back to a tab makes the app check for changes
made elsewhere; offline that check failed, and the app answered a failed check by signing you out.
On the tablet this could happen every time it woke before the wifi reconnected.

Now go back online, click away to another tab and back again. Still signed in; nothing changes.

- [ ] Offline, away and back: still signed in, nothing lost
- [ ] Online, away and back: still signed in

### 11. Coming back to the recipes by the sidebar

Online. Open the test recipe → **EDIT** → paste a *different* external image address → **Save**.
That leaves you looking at the recipe. Wait five seconds, then click **RECIPES** in the sidebar.

**Expect:** the card shows the **new** photo.

Until 22 Sep it showed the *previous* one, until a reload. Every other screen redrew itself when
you went to it; the recipe grid didn't, so it showed whatever it had last drawn. The ← back
button on the recipe did redraw, which is why this only showed up by the sidebar.

- [ ] Card shows the new photo straight away

---

## Tidying up

Delete the test recipe: open it → **DELETE**. Safe for a recipe you just added, because deleting
a recipe also destroys its cooking history and this one has none.

Then check your recipe count is back to what you noted at the start, and run the query in step 6
once more. Expect 0.

- [ ] Test recipe deleted, count back to normal, query still 0

---

## If something fails

**Don't fix it in the app.** Write down which step, what you saw instead, and anything in the
browser console (F12 → Console; red text). Then tell me. Two of these steps exist because of
faults that were reported as working, so a surprising result here is the point of running it.

The useful details are: the step number, the recipe's **IMAGE URL** as shown in EDIT, and what
the two SQL queries in step 6 return at that moment.

---

## What step 4 is really testing

Worth understanding, because it explains why the test is "toggle an unrelated favourite" rather
than anything to do with images.

Every save pushes **the whole library** from the browser's memory, not just the recipe you
changed. So the moment the server knows something the open page doesn't — a re-hosted URL, for
instance — the next save of *anything at all* overwrites it with the old value. Toggling one
favourite is enough.

The app handles this by writing the re-hosted address back into memory as soon as the server
returns it. If that write-back were broken, everything else in this document would still pass:
the photo would appear, the URL would look right immediately, and only a *later, unrelated*
save would quietly undo it. Nothing would look wrong, because the original recipe site is still
serving the photo perfectly well.

That is why step 4 is an unrelated save followed by a reload, and why it is the one to stop on.

---

## What this does not cover

- **A restore from backup.** It brings recipes in by a different path and deliberately does not
  re-host anything. Press **RE-HOST EXTERNAL IMAGES** once afterwards; that is what the button
  is for.
- **Keep Awake**, and anything about using the app with wet hands at arm's length. Tablet only.
- **`rehost-images` matching its source in this repo.** Edge Functions deploy straight to
  Supabase rather than through GitHub Pages, so the two can drift — and have. Not checkable from
  a browser.
