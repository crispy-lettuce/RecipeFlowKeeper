# Kitchen App — Infrastructure Reference

**Written 14 Sep 2026** and verified against the live GitHub API and Supabase project *at that
time*; sections have been added and corrected since, most recently 22 Sep 2026. Treat the
original date as the age of the oldest content, not as a warrant over all of it — a 22 Sep
audit found this file still describing the Storage bucket as empty and the Edge Functions as
non-existent, six days after both shipped. This document assumes nothing about who or
what is reading it: it's written to stand on its own for a human, a different AI tool, or a
future Claude Code session with no memory of this one.

It contains no secrets. Every value below is either explicitly meant to be public (per the
project's own rule, restated in §4) or a plain identifier that grants nothing on its own.

---

## 1. Quick reference

| | |
| --- | --- |
| GitHub account | `crispy-lettuce` (personal account, not an organisation) |
| App repo | `crispy-lettuce/RecipeFlowKeeper` — **public** |
| Backup repo | `crispy-lettuce/PrivateBackup` — **private** |
| How work flows | `main` is the trunk and production. Changes go on a short-lived branch and merge by pull request, which runs the tests (`.github/workflows/tests.yml`). `PrivateBackup` still lives on its one branch — see §2 |
| Supabase organisation | CrispyLettuce (`kvfcdgzdurwcqftttukd`) |
| Supabase project | **RecipeWrangler** (`mhkayefzrtceesgizkjs`), region `eu-west-1`, Postgres 17 |
| Supabase project URL | `https://mhkayefzrtceesgizkjs.supabase.co` |
| Household id | `286a8a12-c12a-4b83-afbc-0912533f6b1c` (the only one; not a secret — see §5) |

---

## 2. GitHub

### `crispy-lettuce/RecipeFlowKeeper` — the app

- **Public.** https://github.com/crispy-lettuce/RecipeFlowKeeper
- Default branch: `main`, which is production. `claude/recipe-app-supabase-0z139o` was the
  working branch until 22 Sep; it is fully merged and behind `main` now, and nothing should be
  built on it. *(Corrected 23 Sep: this line said "ahead of `main` and unmerged" for a day
  after the last merge.)*
- One file, `index.html` — no build step, no framework. `converter/` holds the conversion
  instructions and standing test set. `test/` holds an offline Playwright harness. `docs/` holds
  this document and its companions.
- **`.mcp.json` at the repo root already wires up the Supabase connector** — this is the
  canonical connection reference, not something to retype:
  ```json
  {
    "mcpServers": {
      "supabase": {
        "type": "http",
        "url": "https://mcp.supabase.com/mcp?project_ref=mhkayefzrtceesgizkjs&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
      }
    }
  }
  ```
  Any Claude Code session opened against this repo picks up the Supabase connector
  automatically from this file — no manual setup needed.
- **GitHub Pages is configured on this repo** (`has_pages: true` in the repo's own settings), at:

  **`https://crispy-lettuce.github.io/RecipeFlowKeeper/`**

  **Correction (21 Sep 2026): `main` is NOT the pre-Supabase app**, as this document and three
  others claimed until today. Its HEAD is
  `107ebeb Merge pull request #1 from crispy-lettuce/claude/recipe-app-supabase-0z139o` — the
  Supabase rewrite was merged to `main` at some earlier point and nobody recorded it. Checked
  directly against the GitHub API and the objects themselves, not inferred.

  *(As of 22 Sep this is history: `main` and the working branch are content-identical at
  6,913 lines, five PRs merged.)* What `main` held at the time was an **older build of the
  Supabase app**: 5,053 lines against the working branch's then-5,976. It has `createClient`, `queueWrite`, `computeTimeline` and Keep Awake;
  it does **not** have `SOURCE_URL:` parsing or the auto-collapsing sidebar (R2). So it is a
  mid-rewrite snapshot, not the localStorage original.

  Two consequences worth holding onto:

  1. Going live is an **update of an already-deployed app**, not a first deployment. Much of the
     risk the other documents attach to it does not exist.
  2. If the Pages site is live, what is publicly reachable is a Supabase-backed login screen.
     Still no data without credentials — row-level security is keyed to the signed-in user's
     household — but it is not the harmless old toy the earlier note described.

  **Settled 21 Sep, finally.** Pages **is** serving, from `main`, at the repo root. Confirmed two
  ways: a browser screenshot of the live site (signed in, showing the reprocessed 33 recipes), and
  the `pages build and deployment` workflow, which has a run per commit to `main` — run #18 was
  PR #1, run #19 was PR #2. So every merge to `main` redeploys the app automatically, with no
  action needed and no way to stage it first.

  **`main` now holds the current build** (PR #2, merged 21 Sep). The gap this section described
  is closed.

### `crispy-lettuce/PrivateBackup` — the nightly database dump

- **Private.** https://github.com/crispy-lettuce/PrivateBackup
- **Default branch is `claude/recipe-app-supabase-0z139o` — not `main`.** This isn't
  provisional; it's the actual repository default, which is why the scheduled workflow fires
  without any extra configuration. **Renaming or deleting this branch stops the nightly backup
  silently.** If it's ever renamed to `main` for tidiness, confirm afterwards that the schedule
  still fires (check the Actions tab).
- `.github/workflows/backup-supabase.yml` — runs daily at 04:00 UTC, dumps the `public` **and
  `private`** schemas via `pg_dump`, privileges included *(since 23 Sep; `public` only and
  `--no-privileges` before that, which is why the pre-23 Sep dumps cannot rebuild a fresh
  project's policies)*, checks the archive's own table of contents, commits the result under
  `backups/`, keeps the 30 most recent in the working tree.
- `.github/workflows/backup-photos.yml` — runs weekly (Sundays 05:00 UTC), mirrors the
  `recipe-images` bucket into `photos/recipe-images/` at the bucket's own paths with a manifest,
  checking every download's size and MD5 against `storage.objects`. Added 23 Sep; its first run
  is the one after `PrivateBackup` PR #1 merges. Verified genuinely working on 14 Sep — the scheduled run fired unattended and committed
  a real ~87 KB dump.
- **One repository secret required:** `SUPABASE_DB_URL` — the project's **Session pooler**
  connection string (Supabase Dashboard → Project Settings → Database → Connection string →
  Session pooler → URI), including the password. Set at
  **Settings → Secrets and variables → Actions** on this repo. Not the direct connection
  (IPv6-only; GitHub's runners have no IPv6 route) and not the transaction pooler on port 6543
  (doesn't give `pg_dump` the session-mode connection it needs).
- The restore runbook is `PrivateBackup/README.md`, **written from a rehearsal on 23 Sep 2026**
  and ending with a table of what was and was not rehearsed. *(This line said "Full restore
  instructions are in" that file for ten days during which they had never been run, and would
  have stripped the API roles' grants.)*

---

## 3. Supabase

- **Organisation:** CrispyLettuce, id `kvfcdgzdurwcqftttukd`.
- **Project:** RecipeWrangler, ref `mhkayefzrtceesgizkjs`, region `eu-west-1`, Postgres `17.6.1`,
  created 12 Sep 2026, on the free tier.
- **Project URL:** `https://mhkayefzrtceesgizkjs.supabase.co` — this is the `SUPABASE_URL`
  constant hardcoded in `index.html`.
- **Dashboard:** https://supabase.com/dashboard/project/mhkayefzrtceesgizkjs

### The anon / publishable key

Safe to state plainly and already committed in `index.html` as `SUPABASE_KEY` — this is the
project's own rule (see §4), not an exception made for this document:

```
sb_publishable_fH3SOU5nVJE6nsXIlffidg_mVKayaEH
```

A legacy JWT-format anon key also exists on the project (Supabase issues both formats side by
side) and is equally safe to use if a tool expects the older shape. The app uses the
publishable-key format above; there's no need to switch it.

### Tables (13, all with row-level security enabled and policies on every one)

`households`, `household_members`, `household_settings`, `recipes`, `recipe_logs`,
`recipe_notes` (exists, unused — earmarked for R4, dated cooking notes), `keywords`,
`planner_days`, `meal_groups`, `shortlist_items`, `ingredient_swaps`, `shopping_checked`,
`aliases`.

RLS is driven by `private.household_ids_for_user()` — deliberately in a `private` schema, not
`public`, and granted only to the `authenticated` role, not `anon`.

### The one household

Single row in `households`, id `286a8a12-c12a-4b83-afbc-0912533f6b1c`, with one member row
linking it to the signed-in user. Not a secret — RLS is enforced by `auth.uid()` against
`household_members`, not by anyone knowing this UUID — but useful to have on hand for writing
ad-hoc SQL scoped to it.

### Storage

One bucket, `recipe-images` — **public, 29 objects, 4,426 kB** (verified 22 Sep 2026). Built
21 Sep; this section described it as private and empty until an audit on 22 Sep caught that.

**Public means the `/object/public/` read endpoint serves bytes without auth, and nothing
more.** Writes, deletes and *listing* all still go through four RLS policies on
`storage.objects` requiring the first path segment to be a household the caller belongs to. So
it is readable-if-you-know-the-exact-path, and the paths are two random v4 UUIDs. That was a
correctness decision, not a convenience one: the alternative, signed URLs, expire — and
`image_url` is written verbatim into both the JSON export and the nightly `pg_dump`, so a
signed URL would rot inside the backups.

The app does not read or write Storage directly — the bytes are moved server-side and the app
renders whatever is in `image_url`. It does, since 22 Sep, **call the Edge Function that moves
them**, after a save and from two buttons in Settings. The single string it knows about Storage is
the public URL prefix it compares against, to decide whether a photo is already ours.
`docs/IMAGES.md` is the runbook.

### Edge Functions

**Two deployed**, both `verify_jwt: true`, with source in this repo under
`supabase/functions/`. The 23 Sep review diffed both against what is running: `find-recipe-image`
was identical; `rehost-images` v8 had been deployed from an uncommitted copy, and the repo was
brought into step on 23 Sep (`docs/REVIEW-ARCHITECTURE-FINDINGS.md` F4, Appendix D). **A deploy
is a commit**: change the file, commit, then deploy. The next deploy from the repo (v9) makes
the two byte-identical again; until then the only difference is the header comment.

| Function | Version | What it does |
| --- | --- | --- |
| `rehost-images` | v8 | Copies external images into Storage. `{"recipeId": "…"}` for one recipe — what the app sends after a save, added in v8; omit it for the full sweep, which is what v7 and earlier always did. `{"dryRun": true}` to preview, `{"verify": true}` to re-check what is already stored |
| `find-recipe-image` | v4 | Read-only. Finds and measures candidate hero images for a recipe |

P3's calendar push would be a third; that one does not exist yet.

**These are deployed straight to Supabase, not through GitHub Pages**, which is why the image
fixes reached the live app without a merge. A change to their source in this repo is a record,
not a deployment — the two can drift, and have.

**The corollary bit on 22 Sep:** v8's `recipeId` was deployed before the app that sends it, which
was safe only because a call without the parameter behaves exactly as v7. Deploying a function and
merging the app are two separate acts, in whichever order; if a change is not backwards compatible,
that ordering is a decision to make explicitly rather than discover.

### Migration history

For a full account of how the schema got here, in order:

```
20260913022853  phase1_core_schema
20260913022944  phase1_rls_policies
20260913022955  phase1_storage_bucket
20260913023119  phase1_harden_helper_function_fixed2
20260913024103  phase1_recipe_logs_cascade
20260913024800  temp_import_function          (library migration scaffolding — since dropped)
20260913024908  temp_import_function_revoke_public
20260913025034  drop_temp_import_function
20260913025952  create_import_staging
20260913031333  drop_import_staging
20260913172854  phase2_planner_servings_and_alias_kinds
20260921193429  make_recipe_images_public_with_guards
20260922122137  add_recipe_logs_title_for_adhoc_diary_entries
```

The last two were missing from this list until 22 Sep, while the features they carry were
recorded as done elsewhere. If you are adding a migration, add it here in the same breath —
`select version, name from supabase_migrations.schema_migrations` is the check.

---

## 4. Secrets — what's safe and what isn't

This is the project's own rule from the original Build Brief, restated here because it governs
everything above:

**Safe to state plainly, anywhere, including committed to the public repo:** the GitHub repo
names/URLs, the Supabase project's public URL, and its anon/publishable key. The publishable
key is explicitly meant to be public-facing — it's designed to sit in front-end code with RLS
doing the actual access control.

**Never paste into chat, and never commit to either repo:** the Supabase **service role key**,
the database **password**, and (once P3 exists) the Google OAuth **client secret**. These live
only in:

- **GitHub Actions secrets** on the relevant repo (`SUPABASE_DB_URL` on `PrivateBackup`, as above)
- **Supabase's own dashboard** (Project Settings → API for the service role key; Project
  Settings → Database for the password)
- Whatever secret store an Edge Function ends up using, once P3 or the image work is built

If a future session or tool needs to act with elevated privilege (the service role key, a
direct `psql` connection), the credential goes into the relevant platform's own settings
screen — never into a conversation, a file in either repo, or this document.

---

## 5. Picking this up with no prior context

1. Clone whichever repo you need:
   ```sh
   git clone https://github.com/crispy-lettuce/RecipeFlowKeeper.git
   git clone https://github.com/crispy-lettuce/PrivateBackup.git   # its default branch is the odd one; see §2
   ```
2. Read `docs/HANDOVER.md` for what's actually built and verified, and `docs/NEXT-SESSION.md`
   for how to start the next piece of work.
3. If continuing in Claude Code: opening `RecipeFlowKeeper` picks up the Supabase connector
   automatically from its `.mcp.json` (§2 above) — no setup needed beyond that.
4. If continuing with a different tool, or by hand: the project ref (`mhkayefzrtceesgizkjs`)
   and URL (`https://mhkayefzrtceesgizkjs.supabase.co`) above are everything needed to point
   the Supabase CLI or dashboard at the right project. Sign in at
   https://supabase.com/dashboard with the account that owns organisation CrispyLettuce.
5. **`main` is production.** GitHub Pages serves from it and every merge redeploys the live
   app within a couple of minutes, with no staging step and no approval. This was settled on
   21 Sep and is no longer an open question — §2 above has the evidence.
