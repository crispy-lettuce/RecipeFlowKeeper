# Recipe images — how they get to Supabase

**Written 21 Sep 2026**, the day the feature was built, and verified against the running function
and the live database rather than described from the plan.

Answers the two questions that matter in practice: what happens to the image when you add a
recipe, and how you change one.

---

## The short answer

**It is not automatic.** Nothing re-hosts an image when you add or edit a recipe. A new recipe
keeps whatever image URL it arrived with — usually pointing at the recipe site it came from — and
stays that way until someone runs the sweep by hand.

That is a deliberate choice, not an oversight; §4 explains why, and §5 says what it would take to
change if the manual step gets tiresome.

**The sweep is one line in the browser console**, and it is safe to run at any time:

```js
await sb.functions.invoke('rehost-images', {});
```

---

## 1. What happens when you add a recipe

1. The conversion produces an `IMAGE:` line pointing at the source website — for example
   `https://www.kitchensanctuary.com/wp-content/uploads/.../Egg-fried-rice.jpg`.
2. You paste the recipe into the app. `parseAndPreview()` reads that line into the **IMAGE URL**
   field on the form.
3. You save. The URL goes into `recipes.image_url` exactly as written, and into the recipe's
   `syntax` as the `IMAGE:` line. Both point at the source website.
4. The card, the Viewer and the Group Viewer all render that external URL. **It works
   immediately** — the photo shows up straight away, hotlinked from the recipe site.
5. **Nothing has been copied to Supabase yet.** Until the sweep runs, that image depends on
   someone else's server continuing to serve it.

So a newly added recipe looks completely finished and is quietly still borrowing its photo. The
sweep is what makes it yours.

---

## 2. Running the sweep

In the browser console, **on the app, while signed in** — the function takes your household from
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

**Then hard-reload** before judging the result. Your browser has the old URLs cached against the
cards.

### Check the dry run's sizes before a real run

The median image is around 137 KB. Anything wildly outside that is worth a look **before** you
store it:

- **Far too large.** One Contentful-hosted image came in at 7.7 MB — more than the rest of the
  library put together — because Contentful serves the original unless asked otherwise. Appending
  `?w=1600&q=80&fm=jpg` to that recipe's image URL before the sweep took the whole library from
  11.5 MB to 4.1 MB. Most large CDNs have an equivalent: WordPress `?w=`, Cloudinary `w_1600`,
  Sanity `?w=1600`.
- **Far too small.** Under about 20 KB usually means the conversion captured a lazy-load
  placeholder rather than the real photo. Tuscan Chicken Pasta is 10 KB for that reason and is
  still waiting for a better URL.

---

## 3. Changing or replacing an image

The sweep skips anything already self-hosted, so you cannot replace a photo by re-running it. You
have to give the recipe a new external URL first.

1. Find the image you want and copy its address (right-click → **Copy image address**).
2. In the app, open the recipe → **EDIT**.
3. Paste it into the **IMAGE URL** field, replacing the `supabase.co/...` URL that is there.
4. **Save.** The card now shows the new external image.
5. Run the sweep. It sees a non-Supabase URL, fetches it, and stores it.

**For a recipe that has never had an image**, it is the same minus step 3's deletion: put a URL in
the empty **IMAGE URL** field, save, sweep. Four recipes currently have no image at all.

### Two things that make this work properly

**The stored file is overwritten, but the URL changes.** Every recipe's image lives at a fixed
path, `<household_id>/<recipe_id>.<ext>`, so a replacement overwrites the old file. Objects are
served with `max-age=31536000` — a year — so an unchanged URL would mean every browser that had
already seen the old photo went on showing it for a year. The sweep therefore appends a version
token, `?v=<unix seconds>`, which changes on every re-host. Same path, new URL, cache busted, long
caching kept for the common case.

**The recipe text is updated too.** The sweep rewrites the `IMAGE:` line inside `syntax`, not just
the `image_url` column. `docs/ARCHITECTURE.md` §2 says the recipe text is the source of truth, and
the app means it — `parseAndPreview()` repopulates the form from a parse, so if the text still held
the old CDN URL, re-parsing a recipe would silently revert its image. The original source is not
lost: `SOURCE_URL:` still records the page the photo came from, which is where you would go for a
better one.

**Uploading a file from your device is not supported.** There is no file picker; the app only ever
takes a URL. If you have a photo of your own, it needs to be somewhere reachable by URL first. This
was never in the Build Brief and has not been missed so far.

---

## 4. Why it is a manual sweep and not automatic

Three reasons, in order of how much they mattered:

1. **Saving a recipe should not depend on someone else's server.** If re-hosting ran on save, a
   slow or unavailable CDN would make saving slow or make it fail, and "did my recipe save" would
   become a question with a complicated answer. As it stands, saving is instant and always
   succeeds; the photo catches up later.
2. **It treats everything identically.** A sweep over the table has no special case for "recipes
   that existed before the feature" versus "recipes added since". There is one code path.
3. **A browser cannot do it anyway.** Most recipe CDNs send no permissive CORS headers, so
   JavaScript in the page cannot read the bytes even to re-upload them. That is what forces the
   work server-side into an Edge Function, and once it is a separate server-side job, a sweep is
   its natural shape.

---

## 5. Making it automatic, if you want to

Not done, and a genuine option rather than a vague aspiration. `pg_cron` (1.6.4) and `pg_net`
(0.20.4) are **available on this project but not installed**, which is all that is needed:

- enable both extensions
- store a token in Supabase Vault for the cron job to call the function with
- schedule a nightly `pg_net.http_post` to the function's URL

The catch worth weighing first: the function currently takes the household from the **caller's
JWT**, so a cron job needs either a service-role call with the household hard-coded, or a small
change to let a trusted caller sweep every household. Neither is difficult; both need deciding
rather than guessing.

**Whether it is worth it** depends on how often recipes get added. At a handful a month, one
console paste after a batch of conversions is less machinery than a scheduled job that can fail
silently in the night.

---

## 6. What can go wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Failed to send a request to the Edge Function`, CORS error in console | You are calling from an origin the function does not allow | Only `crispy-lettuce.github.io` and `localhost` on any port are allowed. Use the live app or a local copy over `http://localhost`, not `file://` |
| `sb is not defined` | Not on the app page, or the console is pointed at an iframe | Check the frame dropdown at the top-left of the Console panel says **top** |
| `{ error: 'Not signed in' }` | Signed out, or the token expired | Sign in and try again |
| One recipe reports `source returned 403` | That CDN refused us | The function already sends a browser User-Agent, which is what makes the other 28 work. If one host still refuses, download the image and host it somewhere reachable |
| `not an image (content-type: text/html)` | The URL returns an error page, not a photo | The URL is wrong or the image has been removed. Find a new one |
| Photo does not change after replacing it | Browser cache | Hard-reload. If it persists, check `image_url` actually has a new `?v=` token |
| An image looks like a tiny blurry placeholder | The conversion captured a lazy-load thumbnail | Get the real image address from the source page and replace it (§3) |

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

As of 21 Sep 2026: **29 objects, 29 rows self-hosted, 29 rows with an image, 4.1 MB.**

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

All three should be **0**. The strongest check of all, though, is comparing each stored file's byte
count against what the dry run predicted for that recipe — a file smaller than predicted is a
truncated download, and nothing else catches that.

---

## 8. Reference

| | |
| --- | --- |
| Function source | `supabase/functions/rehost-images/index.ts` |
| Deployed as | `rehost-images`, `verify_jwt: true` |
| Bucket | `recipe-images` — **public**, 10 MB file limit, MIME allowlist of jpeg/png/webp/gif/avif |
| Storage path | `<household_id>/<recipe_id>.<ext>` |
| Public URL | `<project>/storage/v1/object/public/recipe-images/<path>?v=<unix seconds>` |
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
