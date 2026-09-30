# Keeping the photo a recipe was converted from

**Asked for by the household on 30 Sep 2026:** *"when we add recipes that originate from screenshots or photographs … could it
somehow store the image source file somewhere that could, if required, be referenced again further down the line as you can with
the original source link?"* Planned the same day, and **agreed "all as suggested"** the same day: every answer in §6 is the
recommended one.

| Step | What | Status |
| --- | --- | --- |
| 1 | The migration, `docs/migrations/add-source-photos.md` | **Applied by the household 30 Sep, 16:35 UTC; checked read-only 16:47** |
| 2 | Attach, store, view, tidy | **Built and merged 30 Sep** (PR #63, 16:34 UTC); tablet step 38b |
| 3 | CHECKED AGAINST THE PHOTO | **Built 30 Sep**, after tablet step 38b passed; tablet step 38c |

## 1. Why it matters

A recipe converted from a web page keeps its link, and everything since 28 Sep builds on that: COMPARE WITH SOURCE, the pasted-list
comparison, OPEN SOURCE, VALIDATE INGREDIENT LIST, LIBRARY CHECK. A recipe converted from a **photo of a cookbook page, a card or a
screenshot** keeps nothing. Once the photo is gone from the conversion chat, nobody can check the recipe against what it was made
from, and LIBRARY CHECK can only say "no source link to compare". The oat bars showed what an unchecked conversion can hide.

It also covers the case found on 30 Sep: a site that blocks the converter, where the household pastes the text or a screenshot.
Keeping the screenshot keeps the evidence.

## 2. What exists today (read-only, 30 Sep 2026)

- **Storage:** one bucket, `recipe-images`, **public**, 10 MB per file, images only; 31 files, 6.5 MB in all. Files live under a
  folder per household (`<household_id>/…`), and four policies on `storage.objects` let an `authenticated` member of that household
  read, write, update and delete there.
- **Recipe photos reach storage through the `rehost-images` Edge Function**, not from the browser. Nothing in the app uploads a file
  directly yet.
- **`recipes`** has no column that could hold this (`source_check`, added 29 Sep, is the last).
- **Export** (`exportAllData`) is a JSON file of the rows. Recipe photos are not in it; they are links. **The nightly backup**
  (`pg_dump`, in `PrivateBackup`) is the database only: storage's files are not in it either.
- **Deleting a recipe** deletes its row; nothing in storage is tidied (a recipe photo can be shared with other recipes, so that was
  deliberate).

## 3. The proposal

### Where the photos live: a new private bucket

`recipe-sources`, **private** (never public: a scanned cookbook page is someone else's work, and a household's own card is private),
images and PDF, 10 MB per file. The same folder-per-household layout and the same four policies as `recipe-images`, naming the new
bucket. Files at `<household_id>/<recipe_id>/<time>.jpg`.

Shown through **signed links** that last an hour, made when a photo is opened. A signed link needs the network, so a source photo
cannot be opened offline; the recipe itself still can.

### How a recipe refers to them: a new column

`recipes.source_photos`, `jsonb`, nullable: a list, one entry per photo, `{ path, added, pages? }`, in page order. **More than one**,
because a cookbook recipe often runs over two pages.

A column rather than a header line in the recipe text: the text is what the converter writes and what the shopping list reads, and a
file path is neither. It follows `source_check`: the app leaves the key out of a save when a recipe has none, so a merge that arrives
before the migration cannot break an ordinary save (`CLAUDE.md`).

### Adding one

In the add and edit form, under the source fields: **SOURCE PHOTOS** with **ADD PHOTO** (a file picker; on the tablet it offers the
camera or the gallery) and a thumbnail per photo with **REMOVE**.

- **Shrunk in the browser first:** long edge 2000 px, JPEG at about 80 %, which keeps cookbook text legible at about 300–600 KB.
  The free plan's 1 GB then holds roughly two thousand pages.
- **Uploaded when the recipe is SAVED, not when picked,** so a form closed without saving leaves nothing behind. Through the write
  queue like every other save, so it is retried if the tablet is offline, and BEFORE YOU SAVE says "Stores 2 source photos".
- The conversion itself does not change: the household still gives the photo to the conversion project, then attaches the same
  photo in the app.

### Seeing one

- **Viewer:** a **SOURCE PHOTO** chip beside the source, opening the photo full screen, pinch to zoom, one page after another.
  Hidden in cooking mode with the other chips.
- **Edit:** the same thumbnails, and for a recipe with no web link, **AGAINST THE SOURCE** shows the photo beside the ingredient
  list, so it can be checked by eye.

### Checking a photo recipe (optional, §6.4)

No comparison can read a photo, but the household can. **CHECKED AGAINST THE PHOTO** would record the same `source_check` as a
comparison (`route: 'photo'`, the lines' hash, `validated`), so the chip reads **VALIDATED**, LIBRARY CHECK stops listing it, and
it lapses when the ingredient lines change, exactly as for a web recipe.

### Tidying

Removing a photo, or deleting its recipe, deletes the file (one delete each). A recipe's photos are its own, never shared, so this is
safe here where it was not for recipe photos.

## 4. Order of work

1. **The migration** (`docs/migrations/add-source-photos.md`), **the household applies it first**: the bucket, its four policies,
   the column, and `revoke all … from anon` as for `aisle_overrides`. No app change. Checked read-only afterwards.
2. **Attach, store, view, tidy** (`index.html`; `core.js` only if a helper for the list is shared). The app copes with the column or
   bucket missing, as it did for `aisle_overrides`: the section says the photos are not set up yet, and nothing signs anyone out.
3. **Checked against the photo** and LIBRARY CHECK's status for it, if §6.4 is yes.

Each with browser checks seen failing (the stub gains a pretend storage), and a tablet step, since the camera route can only be
tried on the tablet.

## 5. What it does not do

- It does not convert anything: the conversion project still reads the photo.
- It does not put the photos in the JSON export (§6.5).
- It does not fetch or keep web pages: a web recipe keeps its link. A screenshot of one can still be attached.

## 6. Decisions, answered 30 Sep 2026

The household answered "all as suggested":

1. **The reference is a new column,** `recipes.source_photos`, not a header line in the recipe text.
2. **Size:** shrunk to a 2000 px long edge, about half a megabyte; the original is not kept.
3. **More than one photo per recipe:** yes, in page order.
4. **CHECKED AGAINST THE PHOTO:** yes, as step 3.
5. **Backups:** the JSON export keeps the list of photos, not the photos, which is enough for now. A "download all source photos"
   can come later if wanted. Neither the export nor the nightly `pg_dump` holds the files, so a photo deleted from storage is
   gone.
