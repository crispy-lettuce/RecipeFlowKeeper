# Recipe images — how they get to Supabase

**Written 21 Sep 2026**, the day the feature was built; §4 and §5 rewritten 22 Sep, then rewritten
again the same day when Option A was actually built. Verified against the running functions and the
live database rather than described from the plan.

---

## Answers first

### How do I add an image to a new recipe?

You don't do anything separate. The conversion produces an `IMAGE:` line, that URL lands in the
**IMAGE URL** field when you paste the recipe, and saving stores it. The photo appears immediately,
hotlinked from the recipe site — and a second or two later the app has quietly replaced it with its
own copy. §1 has the detail.

### How do I replace an image on an existing recipe?

Open the recipe → **EDIT** → paste a new address over the `supabase.co/...` URL in **IMAGE URL**
→ **Save**. That is the whole thing; the copy happens by itself, because the address you pasted is
not one of ours. §3 has the detail, including how to find a good replacement address.

### How does an image get "moved" to Supabase?

**The app asks for it, on save.** Whenever you save a recipe whose image URL is not already in our
own storage, the app queues a call to the `rehost-images` Edge Function for that one recipe. The
function downloads the bytes, checks the file is whole, uploads it into the `recipe-images` bucket,
and returns the new address; the app writes that into the recipe. You see nothing unless it fails,
in which case you get the ordinary "couldn't save…" toast and the recipe keeps its external URL,
which still displays. §2 has the detail.

Two cases the save cannot cover — a **restore from backup**, and a save made **offline** — so the
old sweep over every recipe is still there, as a catch-up. It is now a button:
**Settings → RECIPE PHOTOS → RE-HOST EXTERNAL IMAGES**. The browser console is no longer needed for
anything in normal use.

**It cannot be done from the app's own page** because most recipe CDNs send no CORS headers, so
the browser is not allowed to read the bytes. That is why there is a server-side function at
all.

### Can this happen automatically when I save a recipe?

**It does, since 22 Sep 2026.** This was Option A in §5, and §5 now describes it as built rather
than as a recommendation. No new infrastructure, no scheduled job, no stored credential, and saving
still never waits on a third party.

---

## 1. What happens when you add a recipe

1. The conversion produces an `IMAGE:` line pointing at the source website — for example
   `https://www.kitchensanctuary.com/wp-content/uploads/.../Egg-fried-rice.jpg`.
2. You paste the recipe into the app. `parseAndPreview()` reads that line into the **IMAGE URL**
   field on the form.
3. You save. The URL goes into `recipes.image_url` exactly as written, and into the recipe's
   `syntax` as the `IMAGE:` line. Both point at the source website.
4. **The card** renders that external URL. It works immediately — the photo shows up straight
   away, hotlinked from the recipe site. The card is the *only* place an image is drawn: the
   Viewer and the Group Viewer show the recipe's text and columns, not its photo. (This document
   said all three until 22 Sep. `r.imageUrl` is read in exactly one render path, `renderHome`'s
   `rcard-photo`.)
5. **Then the app re-hosts it, by itself.** Because the URL is not already in our storage, the
   save queues a call to `rehost-images` for that one recipe. A second or two later the recipe's
   `image_url` and `IMAGE:` line both point at our bucket, and the card re-renders with the
   stored copy. Nothing is shown while this happens, and nothing waits for it.
6. **If it fails**, you get the standard "couldn't save…" toast and the recipe keeps the external
   URL. That still displays — the outcome of a failure is a borrowed photo, not a broken one.

The detail of *why* it is queued rather than awaited, and what happens when it is neither, is in
§5.

---

## 2. The sweep — the catch-up over every recipe

The save path handles every recipe you add or edit in the app. The sweep exists for the two cases
it cannot see: a **restore from backup**, which brings recipes in through a different path, and a
save made **offline**, where the call never fired. Run it after either; there is no need to run it
after adding a recipe normally.

### From Settings (the normal way)

**Settings → RECIPE PHOTOS** has two buttons:

| Button | What it does |
| --- | --- |
| **RE-HOST EXTERNAL IMAGES** | The full sweep. Copies every still-external image into our storage |
| **CHECK STORED IMAGES** | Read-only. Re-reads every stored file and reports whether each is whole |

Both report a one-line result underneath, and **both also update the open page's recipes from what
the function reports**, which is what makes them safe to use without reloading — see the hazard
below.

### From the console (for the dry run and the full report)

The console still gets you the detail the buttons summarise: the dry run, the per-recipe table,
and `data.all`. Run it **on the app, while signed in** — the function takes your household from
your token, so it will not work from a blank tab or the Supabase dashboard.

Open https://crispy-lettuce.github.io/RecipeFlowKeeper/, press F12, choose **Console**. Chrome
blocks the first paste until you type `allow pasting` and press Enter; it remembers after that.

**Look before you leap** — this writes nothing and reports what it would do:

```js
const { data } = await sb.functions.invoke('rehost-images', { body: { dryRun: true } });
console.log(`${data.rehosted} to do, ${data.skipped} already done, ${data.failed} failed`);
console.table(data.report.map(r => ({ title: r.title, outcome: r.outcome, KB: r.bytes && Math.round(r.bytes/1024) })));
```

**Then do it:**

```js
const { data, error } = await sb.functions.invoke('rehost-images', {});
console.log(error ?? `${data.rehosted} rehosted, ${data.skipped} skipped, ${data.failed} failed`);
console.log(data.report.filter(r => r.outcome === 'failed'));
```

It takes roughly 0.7 seconds per image — there is a deliberate 250 ms pause between fetches,
because these are other people's servers.

**It is idempotent.** Anything already self-hosted is skipped, so running it after adding two
recipes costs two fetches and skips the rest. There is no harm in running it more often than
needed, and no need to track which recipes are outstanding.

**After a console sweep, hard-reload — before touching anything else in the app.** This is the
hazard the Settings buttons were added to remove, and it is worth understanding because it explains
a design decision in §5.

**The sweep changes the database; the open page does not know.** A save from the edit form
upserts that recipe's whole row from the in-memory cache — and after a console sweep that cache
still holds the old external URL. So the next edit-save of a swept recipe writes its stale
`image_url` and `IMAGE:` back over what the sweep just did. *(Until 24 Sep, PR 5, every save went
through `pushList` and rewrote every recipe, so toggling one favourite un-hosted all 29 at once.)*
The library silently un-self-hosts itself, and nothing looks wrong, because the external URLs still
load.

A reload runs `hydrate()`, which re-reads the real values, and the hazard is gone. Until then, treat
the page as stale.

**The Settings buttons do not have this problem**, because `runImageSweep` walks the function's
report and writes each new URL — and its `IMAGE:` line — straight into the cached recipe before
re-rendering. That reconciliation is not a nicety: without it the button would undo itself on the
next save, exactly as the console does. The same reasoning produced `applyRehostedUrl` on the save
path; this is the library-scale version of it.

### Check the dry run's sizes before a real run

The median image is around 137 KB. Anything wildly outside that is worth a look **before** you
store it:

- **Far too large.** One Contentful-hosted image came in at 7.7 MB — more than the rest of the
  library put together — because Contentful serves the original unless asked otherwise. Appending
  `?w=1600&q=80&fm=jpg` to that recipe's image URL before the sweep took the whole library from
  11.5 MB to 4.1 MB. Most large CDNs have an equivalent: WordPress `?w=`, Cloudinary `w_1600`,
  Sanity `?w=1600`.
- **Far too small.** Under about 20 KB means something is wrong, though not always the same
  thing. A lazy-load placeholder captured instead of the real photo is one cause; a file that is
  simply broken at source is another. Tuscan Chicken Pasta was 10 KB and turned out to be the
  second — its replacement is 257,931 bytes, 25× larger.

### Every download is checked for integrity

Since 22 Sep both functions verify that what arrived is a *complete* image before storing it or
recommending it. Three independent checks, because they catch different faults:

- **Content-Length against the bytes that arrived.** Catches a transfer that died mid-flight — the
  server promised more than it delivered.
- **The format's own end marker** — JPEG `FFD9`, PNG `IEND`, GIF `0x3B`, the length in a WEBP RIFF
  header. Catches a file that is corrupt at source, where Content-Length agrees with the bytes
  because the server is faithfully serving a broken file.
- **Data density, for JPEGs** — bytes per pixel, measured against the dimensions read out of the
  file's own SOF segment. Catches a file that has an end marker and still isn't whole.
- **The box chain, for AVIF and HEIC** — every ISOBMFF box declares its own size, and the sizes
  must land exactly on the end of the file. Added 22 Sep: AVIF is in the bucket's MIME allowlist
  and in the sweep's extension map, but it is neither JPEG, PNG, GIF nor RIFF, so before this it
  reached the final "no check" branch and was stored unverified while this section said
  everything was verified. The code comment was honest about it; this document was not.

Each of these has caught something the others did not, so none is redundant. The 22 Sep sweep is
the worked example: **Classic Scones** is cut off with no `FFD9` at all, yet its density is a
perfectly healthy 0.2036 — only the marker check sees it. **Tuscan Chicken Pasta** ends correctly
and is starved of data at 0.011 — only the density check sees it.

A failure is reported as `failed` with the reason, and the recipe is left alone rather than having
a broken image written over a working one.

**Why there are three, and why the third took two goes.** Tuscan Chicken Pasta rendered as a photo
on the top 40% of the card with solid grey below. It had been stored, and had *passed
verification*, because the check at the time compared the stored byte count against the byte count
the dry run had seen. Both fetches returned exactly 10,515 bytes. They agreed with each other, and
both were incomplete. **Agreement between two reads of the same bad source is not evidence of
integrity** — only something that knows what a whole file looks like can tell you that.

The end-marker check replaced it, and **still passed Tuscan Chicken Pasta**. The file's marker
chain is intact and `FFD9` is present; what ran out early is the entropy-coded scan data, which a
decoder fills with mid-grey. An end marker proves a file was terminated, not that it is full.

It did find a second broken image nobody had noticed — Classic Scones with Jam & Clotted Cream, 35
KB with no end marker at all — so the weaker check was not useless, just insufficient.

### Where the 0.02 threshold comes from

Measured, not estimated. The full verify sweep of 22 Sep:

| | bytes/pixel |
| --- | --- |
| The 27 whole images | 0.087 – 0.385 |
| Tuscan Chicken Pasta (renders grey) | 0.011 |

So the threshold sits about 4× below the leanest real photo in the library and about 2× above the
broken one. Clear of both, rather than finely balanced between them. If the library ever gains a
legitimately sparse image — a flat graphic rather than a photograph — this is the number to revisit,
and `data.all` is where you would get the evidence to revisit it with.

`test/image-integrity.js` pins all of this. It lifts the checker out of the Edge Function source
rather than keeping a copy, synthesises each failure shape from marker bytes, and asserts both
functions carry an identical checker. Run it with `node test/image-integrity.js`.

---

## 3. Changing or replacing an image

Re-running the sweep will not do it — the sweep skips anything already self-hosted, which is also
what stops it re-fetching 29 images every time. You replace a photo by giving the recipe a new
external URL, and the save does the rest.

1. Find the image you want. Either right-click the photo on the source page → **Copy image
   address**, or let `find-recipe-image` do it (below).
2. In the app, open the recipe → **EDIT**.
3. Paste it into the **IMAGE URL** field, replacing the `supabase.co/...` URL that is there.
4. **Save.** That is the end of it. The card shows the new external image at once, the save queues
   a re-host because the pasted URL is not ours, and a second or two later the card is showing the
   stored copy instead.

**Why overwriting the Supabase URL is the trigger, and not a flag.** "Not already ours" is the
entire condition. It needs nothing remembered and nothing reset: once a recipe has been re-hosted,
its URL *is* ours, so editing its title or its servings never fires a re-host again.

### Finding the right URL without a browser

`find-recipe-image` reads the recipe's `SOURCE_URL:`, fetches that page, pulls out every
candidate hero image — `og:image`, `twitter:image`, and any `schema.org` Recipe image — then
**downloads each one to find out how big it really is** and ranks them. It also measures what the
recipe currently has, so the comparison is like for like.

```js
const { data } = await sb.functions.invoke('find-recipe-image', {
  body: { title: 'Tuscan Chicken Pasta' }
});
console.log('current:', data.currentImageBytes, 'bytes', data.currentImageProblem ?? 'ok');
console.table(data.candidates.map(c => ({ KB: c.bytes && Math.round(c.bytes/1024), ok: c.ok, source: c.source, url: c.url, problem: c.problem ?? c.error })));
```

**Read the `ok` column, not just `KB`.** A candidate can be the largest and still be broken; the
finder reports integrity (§2) on every candidate and on the recipe's current image so you do not
pick the biggest corrupt one.

Takes `title`, `recipeId`, or a bare `pageUrl` for something not in the library yet.

**It reports; it does not choose.** A page usually offers several images and the largest is
usually but not always the hero — a printable version or a step photo can outweigh it. Picking on
byte count alone would be exactly the kind of guess the conventions here exist to prevent. It
writes nothing: not to the recipe, not to storage.

**For a recipe that has never had an image**, it is the same minus the overwriting: put a URL in
the empty **IMAGE URL** field and save. Four recipes currently have no image at all. **Saving with
the field empty asks for nothing** — there is no URL to fetch, so no call is made and nothing is
reported.

### Two things that make this work properly

**The stored file is overwritten, but the URL changes.** Every recipe's image lives at a fixed
path, `<household_id>/<recipe_id>.<ext>`, so a replacement overwrites the old file. Objects are
served with `max-age=31536000` — a year — so an unchanged URL would mean every browser that had
already seen the old photo went on showing it for a year. The sweep therefore appends a version
token, `?v=<unix seconds>`, which changes on every re-host. Same path, new URL, cache busted, long
caching kept for the common case.

**The recipe text is updated too — everywhere, now.** Both the column and the `IMAGE:` line inside
`syntax` are rewritten. `docs/ARCHITECTURE.md` §2 says the recipe text is the source of truth, and
the app means it: `parseAndPreview()` repopulates the form from a parse, so a text still holding the
old URL silently reverts the image the next time the recipe is parsed.

The sweep had always done this. **The app's own save had not** — until 22 Sep, saving a recipe wrote
the form's image URL to `image_url` and left the `IMAGE:` line alone, so changing a photo by hand
produced a row whose column and text disagreed, and the disagreement healed itself in the wrong
direction. It went unnoticed because the card reads the column, so the new photo appeared and the
stale text only surfaced on a later edit. `withUpdatedImageLine` now reconciles the line on every
save, in the same place the title line has always been reconciled. The §7 query that counts
disagreements exists for precisely this class of fault.

The original source is not lost: `SOURCE_URL:` still records the page the photo came from, which is
where you would go for a better one.

**Uploading a file from your device is not supported.** There is no file picker; the app only ever
takes a URL. If you have a photo of your own, it needs to be somewhere reachable by URL first. This
was never in the Build Brief and has not been missed so far.

---

## 4. Why it was a manual sweep until 22 Sep

The reasoning from when this was built. One part of it still binds the design; the rest turned
out to be unexamined.

1. **Saving a recipe should not depend on someone else's server.** If re-hosting ran *inside*
   the save, a slow or unavailable CDN would make saving slow or make it fail, and "did my
   recipe save" would become a question with a complicated answer. **This one still holds, and
   it is the constraint the built version respects** — it rules out re-hosting *synchronously*,
   which is not the same thing as ruling out doing it automatically. Everything in §5 turns on
   that distinction.
2. **It treats everything identically.** A sweep over the table has no special case for
   "recipes that existed before the feature" versus "recipes added since". One code path. Still
   true, and still the reason the sweep is kept rather than deleted.
3. **A browser cannot do it anyway.** Most recipe CDNs send no permissive CORS headers, so
   JavaScript in the page cannot read the bytes even to re-upload them. That is what forces the
   work server-side into an Edge Function. *(True for a URL on someone else's site. Not true
   for a file you pick off your own device — see Option D.)*

**And one thing nobody wrote down:** until 22 Sep the app had never called an Edge Function at
all. `functions.invoke` appeared **zero** times in `index.html`. Every snippet in this document
was something a person typed into devtools. That was not a deliberate design decision anywhere
in the record — it was simply the shape the feature was first built in, and it was the whole
reason this felt like a chore. Worth remembering the next time something here looks like a
considered constraint: check whether anyone ever considered it.

---

## 5. How the automatic re-host works

Built 22 Sep 2026. This section used to weigh four options and recommend one; the recommendation
was taken, so what follows is how the built thing behaves, with the rejected options kept at the
end because the reasons they were rejected are still the reasons not to revisit them.

### The mechanism

`rehost-images` takes an optional `recipeId`, so it can do one recipe instead of sweeping all of
them. Immediately after a save, the app queues a call for that recipe — but only if its image URL
is set and does not already point at our own storage:

```js
saveRecipe(recipe);                           // the row goes first
rehostImageFor(recipe.id, fields.imageUrl);   // then the re-host, behind it in the queue
```

**Order matters and is guaranteed, not hoped for.** `queueWrite` is strict FIFO on a single
chain, so the recipe row is upserted before the function is asked about it. A function asked to
re-host a recipe that does not exist yet would report nothing to do, and the image would stay
external until the next sweep — quietly, which is the worst kind of wrong.

**The `recipeId` filter can only narrow.** The function still applies the household filter from
the caller's JWT and adds `.eq('id', …)` on top of it, and rejects anything that is not a UUID
before it reaches the query. A parameter that could *widen* what a caller sees would be a
different kind of change entirely.

### What happens in each case

| You do | What fires | What you see |
| --- | --- | --- |
| **Add a recipe that has an image** — paste, PARSE & PREVIEW fills IMAGE URL, Save | The save completes, then a queued call for that one recipe | Card appears with the source's photo; a second or two later it is the stored copy. No console, no reload |
| **Replace an image** — EDIT, paste a new address over the `supabase.co` one, Save | The same, because the pasted URL is not self-hosted | New photo on the card once the call returns |
| **Add a recipe with no image** — Save with IMAGE URL empty | Nothing. There is no URL to fetch | Exactly as before. Add one later via EDIT and it behaves like the row above |
| **Edit a recipe whose photo is already ours** — change the title, the servings, a step | Nothing. The URL is already self-hosted | Nothing. This is what keeps it from re-firing forever |
| **Toggle a favourite** | Nothing new | Nothing — but see the write-back below, which is what makes this true |
| **Save with no connection** | Both the recipe's own save and the re-host fail, and are reported | The change is kept **in this tab only** — the database never got it, so a reload discards it. Back online, the next save of any recipe sends it (a favourite tap will do); then the sweep copies the photo. Coming back to the tab meanwhile does not undo it |

### Why the response has to be written back

The function returns the new public URL, and the app writes it into the cached recipe —
`applyRehostedUrl`. **This is load-bearing, not polish.** The edit form's save upserts that
recipe's whole row from the in-memory cache, and nothing refreshes that cache after `hydrate()`
but a tab return. Leave the cache holding the old external URL and the next edit-save of that
recipe pushes it back over the row the function just fixed *(until PR 5, any save of any recipe
did)*. The feature would undo
itself, silently, and nothing would look wrong because the external URL still loads.

So the write-back sets **both** the column and the `IMAGE:` line, for the reason in §3: the text
is the source of truth, and a stale line reverts the column on the next parse.

### The race, and the guard

The call is in flight for a second or two, and nothing stops the person editing the same recipe
again in that window. A response that arrives for a URL that is no longer current must be thrown
away, or a slower answer to an older question overwrites a newer choice:

```js
if((recipes[idx].imageUrl || '') !== sentUrl) return;
```

The URL that was sent is the test. If it still holds, nothing has changed underneath us; if it
does not, the reply is stale by definition. The response is matched to its recipe by `id`, which
the function now returns on every report row, rather than by position or title.

### What it deliberately does not cover

- **A restore from backup** calls `replaceRecipesList` with the whole library at once and never goes
  near the save handler, so nothing fires. Run the sweep afterwards. Having a restore fire thirty
  calls at once would be a worse trade than pressing one button.
- **A save made offline** never reaches the function — nor the database. The change is kept in
  the tab, and the next save of any recipe once connected sends it; then the sweep copies the
  photo. A reload before that discards it. (This line said "the recipe is saved" until 22 Sep.)
- **The recipes that were already self-hosted** — correctly, they are done.

The sweep therefore has not gone away. It has stopped being the only mechanism, and it has moved
out of the console into Settings (§2).

### What is tested, and what that is worth

`test/smoke.js` covers the trigger condition, the request shape, the write-back into both the
column and the text, the no-revert-on-next-save property, the race guard, and the two silent
cases. Each of those checks was mutation-tested — the behaviour was broken on purpose and the
suite had to name the failure. **Two of them passed a broken app on the first attempt** (the race
guard, and the save-path `IMAGE:` line), which is why the checks read the way they do now.

What none of it proves: the suite stubs Supabase entirely, so it says nothing about whether the
function actually re-hosts anything. §7 is how you answer that.

### The options that were not taken

#### Option B — a nightly `pg_cron` job

`pg_cron` (1.6.4) and `pg_net` (0.20.4) are **available on this project but not installed**;
`supabase_vault` (0.3.1) **is** installed. So it was buildable: enable both extensions, store a
token in Vault, schedule a nightly `pg_net.http_post` to the function's URL.

Two real costs. The function identifies the household from the caller's JWT, so a cron job needs
either a service-role call with the household hard-coded or a change letting a trusted caller
sweep every household — a decision, not a guess. And **a scheduled job fails silently in the
night**; you would find out when an image 404s, not when the job broke.

Worth it only if images must become self-hosted without anyone opening the app. They do not — an
external image works fine in the meantime, and the save path now covers everything except the two
cases in §2.

#### Option C — a database trigger on `recipes.image_url`

The most literally automatic: a trigger firing `pg_net.http_post` whenever `image_url` changes.

**Not recommended.** It needs the same extensions and stored token as Option B, and it puts an
outbound HTTP call in the commit path of every recipe write — a well-known source of latency and
failures that are hard to trace. It would also fire 33 times during a bulk ingest unless
specifically guarded. All of that to move a call the app makes perfectly well itself.

#### Option D — upload straight from the browser

Blocked **for an image on someone else's site**: no CORS headers, so the page cannot read the
bytes. That is settled and is why the Edge Function exists.

**But not blocked for a file on your own device.** A file picker writing into the bucket involves
no cross-origin fetch, and the Storage RLS policies already permit a signed-in household member to
write to their own folder. That is a genuinely separate feature — "use my own photo" rather than
"copy this recipe site's photo" — and there is no file picker in the app today. Worth knowing it
is possible and small, if you ever want to photograph your own cooking.

#### Summary

| | New infrastructure | Covers | Fails |
| --- | --- | --- | --- |
| **A — app calls on save** *(built)* | none | every recipe saved in the app, online | visibly, as a toast |
| B — nightly cron | 2 extensions, Vault token | everything, within a day | silently, at night |
| C — database trigger | 2 extensions, Vault token | every write, including bulk | in the commit path |
| D — browser upload | none | only files from your device | visibly |

---

## 6. What can go wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Failed to send a request to the Edge Function`, CORS error in console | You are calling from an origin the function does not allow | Only `crispy-lettuce.github.io` and `localhost` on any port are allowed. Use the live app or a local copy over `http://localhost`, not `file://` |
| `sb is not defined` | Not on the app page, or the console is pointed at an iframe | Check the frame dropdown at the top-left of the Console panel says **top** |
| `{ error: 'Not signed in' }` | Signed out, or the token expired | Sign in and try again |
| One recipe reports `source returned 403` | That CDN refused us | The function already sends a browser User-Agent, which is what makes the other 28 work. If one host still refuses, download the image and host it somewhere reachable |
| `not an image (content-type: text/html)` | The URL returns an error page, not a photo | The URL is wrong or the image has been removed. Find a new one |
| Photo does not change after replacing it | Browser cache | Hard-reload. If it persists, check `image_url` has a **newer** `?v=` token than before. Note most images have **no token at all** — only 2 of 29 as of 22 Sep — because the token is added when a photo is re-hosted over an existing one, and the original sweep wrote each URL once. A missing token on an untouched image is normal, not a fault |
| An image looks like a tiny blurry placeholder | The conversion captured a lazy-load thumbnail | Run `find-recipe-image` for that recipe, pick a candidate, replace it (§3) |
| Photo renders correctly at the top and goes solid grey below | JPEG with an intact end marker but scan data that stops early | The density check catches these; the end-marker check did not. Run `find-recipe-image`, check `currentImageProblem` and each candidate's `problem`, pick one reporting `ok: true`, replace it (§3) |
| Sweep reports `JPEG ends correctly but carries too little image data` | The density check — the file is terminated but not full | Working as intended. Find a different URL (§3). If you believe the photo is genuinely fine, check its bytes/pixel in `data.all` before changing the threshold |
| Sweep reports `failed` with `truncated JPEG: no end-of-image marker` | The source is serving a broken file | Working as intended — it stopped rather than storing it. Find a different URL (§3) |
| Sweep reports `failed` with `transfer truncated: server declared N bytes, got M` | The download died mid-flight | Usually transient. Re-run the sweep; if it repeats, the host is at fault and needs a different URL |
| Saved a recipe and the photo is still on the source's server | The queued call failed — most often no connection at the moment of saving | You will have seen a "couldn't save…" toast. If the recipe's own save failed too, save any recipe once you're connected (a favourite tap will do) so the database has the new URL; then **Settings → RECIPE PHOTOS → RE-HOST EXTERNAL IMAGES** picks it up |
| Restored a backup and everything is hotlinked again | Correct and expected. A restore does not go through the save path (§5) | Press **RE-HOST EXTERNAL IMAGES** once afterwards |
| Edited a photo, and after a later edit the old one is back | The `image_url` column and the `IMAGE:` line in the recipe text disagree, so re-parsing reverts the column | Fixed on the save path since 22 Sep (§3). Run the third query in §7; if it is not 0, re-save the recipes it names |
| `find-recipe-image` returns no candidates | The page hides its images behind JavaScript, or has no `og:image` | Fall back to right-click → Copy image address in a browser |
| `source page returned 403` from `find-recipe-image` | The site blocks non-browser traffic harder than its CDN does | Same fallback — get the URL by hand and put it on the recipe |

---

## 7. Verifying it worked

Run from a Claude Code session with the Supabase connector, or the SQL editor:

```sql
select
  (select count(*) from storage.objects where bucket_id = 'recipe-images')                       as objects,
  (select count(*) from recipes where image_url like '%/object/public/recipe-images/%')          as rows_self_hosted,
  (select count(*) from recipes where image_url is not null and image_url <> '')                 as rows_with_image,
  (select pg_size_pretty(sum((metadata->>'size')::bigint))
     from storage.objects where bucket_id = 'recipe-images')                                      as total_size;
```

As of 22 Sep 2026: **29 objects, 29 rows self-hosted, 29 rows with an image, 4,426 kB**, and
`dangling_rows`, `orphaned_files` and text/column disagreements all 0. A full verify sweep the
same day reported **29 whole, 0 broken**.

Two checks worth more than the counts:

```sql
-- rows pointing at a file that does not exist, and files nothing points at
with obj as (select name from storage.objects where bucket_id = 'recipe-images'),
     rec as (select regexp_replace(split_part(image_url, '?', 1), '^.*/recipe-images/', '') as path
             from recipes where image_url like '%/object/public/recipe-images/%')
select (select count(*) from rec r left join obj o on o.name = r.path where o.name is null) as dangling_rows,
       (select count(*) from obj o left join rec r on r.path = o.name where r.path is null) as orphaned_files;

-- the column and the recipe text must agree, per ARCHITECTURE §2
select count(*) from recipes
where image_url is not null and image_url <> '' and syntax like '%IMAGE:%'
  and position('IMAGE: ' || image_url in syntax) = 0;
```

All three should be **0**.

The third is the one to run after any change to how images are saved. Until 22 Sep the app's own
save could put the column and the text out of step (§3), and nothing in the app complained — the
card reads the column, so it looked right. A count above 0 means some recipe is one parse away
from silently reverting its photo.

**Do not verify by comparing byte counts between the dry run and the real run.** That check was
here until 22 Sep and it is worthless: both runs fetch the same source, so a file that is broken at
source produces two identical byte counts and a clean bill of health. That is precisely how a
truncated JPEG got stored and reported as verified. The integrity check described in §2 is what
actually answers the question, and it runs on the way in — a stored image has already passed it.

**To re-check the whole library after the fact**, the sweep has a read-only verify mode. It is the
inverse of the normal sweep: instead of re-hosting what is still external, it re-reads every file
already stored and checks each one is whole. Nothing is written.

```js
const { data } = await sb.functions.invoke('rehost-images', { body: { verify: true } });
console.log(`${data.whole} whole, ${data.broken} broken of ${data.checked}`);
console.table(data.report);   // the failures
console.table(data.all);      // every image, with its measured bytes/pixel
```

`broken: 0` is the answer you want. Anything listed needs a replacement URL (§3). Worth running
after any bulk ingestion, and after any run that reported failures.

`data.all` gives the measurement behind every verdict, including the ones that passed. That is
deliberate: the density threshold is a judgement call, and a judgement call you cannot see the
distribution behind is just a magic number. If a real photo ever trips it, the table is what tells
you the threshold is wrong rather than the photo.

For a single recipe, `find-recipe-image` reports the same check on its current image as
`currentImageProblem`.

---

## 8. Reference

| | |
| --- | --- |
| Function source | `supabase/functions/rehost-images/index.ts` (the sweep) and `supabase/functions/find-recipe-image/index.ts` (candidate finder, read-only) |
| Deployed as | `rehost-images` (v8) and `find-recipe-image` (v4), both `verify_jwt: true`. **A deploy is a commit**: v8 went live from an uncommitted copy and the repo drifted for a day (`docs/REVIEW-ARCHITECTURE-FINDINGS.md` F4). Change the file, commit, then deploy |
| Called from | **The app**, on save (`rehostImageFor`) and from Settings (`runImageSweep`), and by hand from the console. v8 added the optional `recipeId`; a call without it behaves exactly as v7 |
| Tests | `node test/image-integrity.js` — 31 checks over the integrity checker and `parseRecipeFilter`. The save path is covered by `node test/build.js && node test/smoke.js` |
| Bucket | `recipe-images` — **public**, 10 MB file limit, MIME allowlist of jpeg/png/webp/gif/avif |
| Storage path | `<household_id>/<recipe_id>.<ext>` |
| Public URL | `<project>/storage/v1/object/public/recipe-images/<path>`, with `?v=<unix seconds>` appended on re-host |
| Cache | `max-age=31536000`, busted by the version token |

**Public means read-only, and not browsable.** It affects exactly one thing: the `/object/public/`
endpoint serves bytes without auth. Writes, deletes and *listing* all still go through four RLS
policies on `storage.objects` that require the first folder segment to be a household the caller
belongs to — and `private.household_ids_for_user()` is granted to `authenticated` only. So it is
"readable if you know the exact path", and the paths are two random v4 UUIDs.

**Why public rather than signed URLs**, which was the one thing left open when this was planned:
`image_url` is written verbatim into the app's JSON export *and* into the nightly `pg_dump`. A
signed URL expires, so it would rot inside the backups — restore one months later and every image
is dead. That is a correctness argument, not the convenience one originally recorded.
