# Kitchen App — Infrastructure Reference

**Written 14 Sep 2026** and verified against the live GitHub API and Supabase project *at that
time*; sections have been added and corrected since, most recently 12 Oct 2026, when §1-§3 were
checked against the live project (the October review's F11). Treat the
original date as the age of the oldest content, not as a warrant over all of it — a 22 Sep
audit found this file still describing the Storage bucket as empty and the Edge Functions as
non-existent, six days after both shipped, and on 10 Oct the October review found it behind
again: tables, a bucket, functions and migrations it did not list, under a "last changed 22 Sep".

**How this card is kept (agreed with the household, 12 Oct 2026).** A migration page or an Edge
Function deploy is not finished until this card says so. Whoever applies or deploys it, or the
session that checks it afterwards, updates the card in the same PR or the next one: what was
applied or deployed, when, and how it was checked. A dated line that was right on its date is
left as history; a line that reads as current is corrected in place.

This document assumes nothing about who or what is reading it: it's written to stand on its own
for a human, a different AI tool, or a future Claude Code session with no memory of this one.

It contains no secrets. Every value below is either explicitly meant to be public (per the
project's own rule, restated in §4) or a plain identifier that grants nothing on its own.

---

## 1. Quick reference

| | |
| --- | --- |
| GitHub account | `crispy-lettuce` (personal account, not an organisation) |
| App repo | `crispy-lettuce/RecipeFlowKeeper` — **public** |
| Backup repo | `crispy-lettuce/PrivateBackup` — **private** |
| How work flows | `main` is the trunk and production. Changes go on a short-lived branch and merge by pull request, which runs the tests (`.github/workflows/tests.yml`); `offline-harness` has been a required check on `main` since 27 Sep, enforced for everyone but admins. `PrivateBackup`'s default branch is still `claude/recipe-app-supabase-0z139o`, not `main` — see §2 |
| Supabase organisation | CrispyLettuce (`kvfcdgzdurwcqftttukd`) |
| Supabase project | **RecipeWrangler** (`mhkayefzrtceesgizkjs`), region `eu-west-1`, Postgres 17 |
| Supabase project URL | `https://mhkayefzrtceesgizkjs.supabase.co` |
| Household id | The family's: `dfeac187-a044-4f6e-a7a7-d47119930127` (since 18 Oct, 18:02 UTC). `286a8a12-c12a-4b83-afbc-0912533f6b1c`, the family's first until then, is **Test Kitchen**, the test household. Four exist — see §3. Not a secret |

---

## 2. GitHub

### `crispy-lettuce/RecipeFlowKeeper` — the app

- **Public.** https://github.com/crispy-lettuce/RecipeFlowKeeper
- Default branch: `main`, which is production. `claude/recipe-app-supabase-0z139o` was the
  working branch until 22 Sep; it is fully merged and behind `main` now, and nothing should be
  built on it. *(Corrected 23 Sep: this line said "ahead of `main` and unmerged" for a day
  after the last merge.)*
- Two files, `index.html` and `core.js` (the pure functions, since 25 Sep 2026) — no build step, no framework. `converter/` holds the conversion
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
  `backups/`, keeps the 30 most recent in the working tree. Verified genuinely working on 14 Sep —
  the scheduled run fired unattended and committed a real ~87 KB dump. On 12 Oct the 04:15 UTC run,
  the first on the workflow as `PrivateBackup` #7 left it (the October review, F10), printed
  `tables=16 policies=52`, the live numbers.
- `.github/workflows/backup-photos.yml` — runs weekly (Sundays 05:00 UTC), mirrors the
  `recipe-images` bucket into `photos/recipe-images/` at the bucket's own paths with a manifest,
  checking every download's size and MD5 against `storage.objects`, and the private
  `recipe-sources` bucket too, through `scripts/mirror-private-bucket.sh` (the October review,
  F22, read it on 10 Oct). Added 23 Sep, `PrivateBackup` PR #1. **First run on the new mirror script: 18 Oct 2026, 05:05 UTC,
  passed** (run 39099322057, checked by a session in its log): every `recipe-images` object fetched and checked against
  `storage.objects`, "5 objects in recipe-sources" mirrored, and 4 new photos and 4 new source files committed as `3870dd2`
  ("Recipe photo backup 2026-10-18"). *(Until 12 Oct the
  14 Sep sentence above sat under this bullet, where it could not be true, and this bullet named
  only the one bucket.)*
- `.github/workflows/weekly-live-check.yml` — the live-backend test (`PrivateBackup` PR #3,
  28 Sep 2026; `docs/HANDOVER.md` §7, 7c): signs in to a dedicated test household, never the
  family's, adds a recipe, favourites it, logs it and answers the meal prompt, adds an ad-hoc diary
  entry, proves each by a reload, then removes all of it. Set up to run every Monday at 06:00 UTC.
- **Four repository secrets**, set at **Settings → Secrets and variables → Actions** on this repo
  (the workflows' `secrets.*` references, 12 Oct 2026). *(This line said "one" until 12 Oct.)*
  - `SUPABASE_DB_URL` — the project's **Session pooler** connection string (Supabase Dashboard →
    Project Settings → Database → Connection string → Session pooler → URI), including the
    password. Not the direct connection (IPv6-only; GitHub's runners have no IPv6 route) and not
    the transaction pooler on port 6543 (doesn't give `pg_dump` the session-mode connection it
    needs).
  - `SUPABASE_SERVICE_ROLE_KEY` — for the photo workflow's `recipe-sources` step: a private bucket
    is read as the service role.
  - `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` — the live check's test account.
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

### Tables (16 in `public`, 1 in `private`, all with row-level security on; read 12 Oct 2026)

`public`, each with its policies (52 in all): `households`, `household_members`, `household_settings`,
`recipes`, `recipe_logs`, `recipe_notes` (dated cooking notes, in use since 30 Sep), `keywords`,
`planner_days`, `meal_groups`, `shortlist_items`, `ingredient_swaps`, `shopping_checked`, `aliases`,
`aisle_overrides` (29 Sep), `calendar_connections` (9 Oct; one select policy, the app only reads it) and
`recipe_shares` (10 Oct; one select policy). What each holds is `docs/ARCHITECTURE.md` §4.

`private`: `calendar_oauth_states` (9 Oct), the one-time values for Google's consent step. RLS on, no
policies and no grants: the Edge Functions reach it only through the service-role-only `calendar_*`
functions (`docs/migrations/add-calendar-push.md`).

RLS is driven by `private.household_ids_for_user()` — deliberately in a `private` schema, not
`public`, and granted only to the `authenticated` role, not `anon`. The same schema holds
`private.my_household()` (10 Oct, `docs/migrations/add-recipe-sharing.md`), which the sharing
functions key on. *(Until 12 Oct this heading said 13 tables and `recipe_notes` "exists, unused".)*

### Households

Four rows in `households`, four in `household_members`, four accounts in `auth.users` and four `household_settings`
rows (read 18 Oct 2026, 18:20 UTC):

- **Test Kitchen**, `286a8a12-c12a-4b83-afbc-0912533f6b1c` (13 Sep): the family's first household and its placeholder library,
  the test household since 18 Oct, with the test account as owner.
- the live check's test household (28 Sep, `docs/HANDOVER.md` §7, 7c);
- the relatives' household, the family's second (10 Oct, `docs/ONBOARDING.md` §4);
- **the family's own**, `dfeac187-a044-4f6e-a7a7-d47119930127` (18 Oct, under the family's household name), with the family's account as owner.
  It shares its recipes with the relatives' household and with Test Kitchen (two `recipe_shares` rows), and holds the Google
  connection.
 Every one has a name (Settings sets it through
`set_household_name` since 10 Oct) and a `household_settings` row (since 12 Oct). An id is not a secret — RLS is
enforced by `auth.uid()` against `household_members`, not by anyone knowing a UUID — but the
family's is useful to have on hand for writing ad-hoc SQL scoped to it (since 18 Oct that is `dfeac187…`, not the first one). *(Until 12 Oct this
section was "The one household".)*

**Done (18 Oct 2026): the test-household split**, `docs/PLAN-TEST-HOUSEHOLD.md`. The household ran `switch.sql` from the
dashboard at 18:02:53 UTC (the new household's `created_at`); the editor's "Success. No rows returned" is a pass, since every
check in it raises. A session read it back afterwards with `check.sql` (read-only): the counts above, Test Kitchen's library
intact (34 recipes, 127 logs, 34 files), the word matches, aisles and swaps copied (16, 10, 2), and Google reconnected in the new
household at 18:11 with one Vault token. The full table is in `PrivateBackup` (`migrations/test-household-split/README.md`).

### Storage

Two buckets (12 Oct 2026), with eight policies on `storage.objects` between them:

- `recipe-images` — **public, 35 objects** (30 and 4,603 kB on 23 Sep; 29 and 4,426 kB on 22 Sep).
  Built 21 Sep; this section described it as private and empty until an audit on 22 Sep caught that.
- `recipe-sources` — **private, 4 objects**: the photos and PDFs a recipe was converted from
  (`docs/migrations/add-source-photos.md`, 30 Sep; `docs/PLAN-SOURCE-PHOTOS.md`), under
  `<household_id>/<recipe_id>/`, shown only by links signed for an hour.

*(Until 12 Oct this section named one bucket.)* The rest of this part is about `recipe-images`.

**Public means the `/object/public/` read endpoint serves bytes without auth, and nothing
more.** Writes, deletes and *listing* all still go through four RLS policies on
`storage.objects` requiring the first path segment to be a household the caller belongs to. So
it is readable-if-you-know-the-exact-path, and the paths are two random v4 UUIDs. That was a
correctness decision, not a convenience one: the alternative, signed URLs, expire — and
`image_url` is written verbatim into both the JSON export and the nightly `pg_dump`, so a
signed URL would rot inside the backups.

The app moves a web photo through the Edge Function that re-hosts it: after a save, and from two
buttons in Settings (since 22 Sep). It also writes this bucket directly, from the browser, in two
places: ADD TO OUR RECIPES copies a shared recipe's photo into the household's own folder (10 Oct),
and UPLOAD PHOTO stores a photo of the household's own at SAVE (11 Oct, issue #92). Both write only
under `<household_id>/`, which is all the bucket's policies allow. It compares a photo's address with the
bucket's public URL prefix to decide whether the photo is already ours. It reads and writes `recipe-sources` directly too:
SAVE uploads a recipe's source photos and deletes removed ones, and viewing one asks for a signed link (`sourcePhotoUrl`).
`docs/IMAGES.md` is the runbook for the images. *(Until 12 Oct this paragraph said the prefix was the single thing the app
knew about Storage.)*

### Edge Functions

**Five deployed** (12 Oct 2026, `list_edge_functions` at 15:16 UTC), one per directory under
`supabase/functions/`, where their source lives. All but `calendar-auth` have JWT verification on;
`calendar-auth` has it off, on purpose (its row says why). The app calls all five, seven
`functions.invoke` calls in `index.html`. *(Until 12 Oct this said "three deployed, all
`verify_jwt: true`", which was true on 27 Sep.)* The 23 Sep review diffed the two then deployed against what was running: `find-recipe-image`
was identical; `rehost-images` v8 had been deployed from an uncommitted copy, and the repo was
brought into step on 23 Sep (`docs/REVIEW-ARCHITECTURE-FINDINGS.md` F4, Appendix D). **A deploy
is a commit**: change the file, commit, then deploy. **Copy the file from its raw URL**
(`raw.githubusercontent.com/…`), not from GitHub's file view: on 27 Sep a copy from the view
stopped at line 100 and the dashboard refused it (`Expected '}', got '<eof>'`). **Use the link pinned to the merge
commit** (`raw.githubusercontent.com/crispy-lettuce/RecipeFlowKeeper/<commit>/supabase/functions/…`), **or wait five
minutes after the merge**: the `main` link is cached for up to five minutes, and on 12 Oct three functions pasted from it
within a minute of #123's merge were the old code under new version numbers (`ezbr_sha256` unchanged; caught by reading
the deployed source back, then redeployed from the pinned links). `rehost-images` was **redeployed from the repo on 25 Sep 2026**
through the dashboard editor, twice in a row, so it was then v10 (v14 since 12 Oct, below); checked the same day against
`main`, it carries the repo's header, the same twelve `id: r.id` report fields and the same final
lines. The one difference is a missing newline at the end of the file, which the dashboard editor
drops. *(Until 25 Sep this paragraph said the next deploy would be v9.)*

| Function | Version | What it does |
| --- | --- | --- |
| `rehost-images` | **v16, redeployed 12 Oct 2026 at 17:05 UTC after #123** (F37: the capped body reader), JWT verification on; read back in full with `get_edge_function` and carrying `readCapped` in both fetches. (v15, 17:00, was the old code from a cached link; v14, after #102 that morning, the October review's hardening.) Before that: v10 | Copies external images into Storage. `{"recipeId": "…"}` for one recipe — what the app sends after a save, added in v8; omit it for the full sweep, which is what v7 and earlier always did. `{"dryRun": true}` to preview, `{"verify": true}` to re-check what is already stored |
| `find-recipe-image` | **Removed 11 Oct 2026** (the October review, F3): nothing called it, and it fetched any address a signed-in account gave it. Its source left the repo in the hardening PR (#102), and the household deleted the deployed function on 12 Oct; `list_edge_functions` no longer lists it | — |
| `source-ingredients` | **v6, redeployed 12 Oct 2026 at 17:06 UTC after #123** (F37: the capped body reader, one timer to the end of the body), JWT verification on; read back in full with `get_edge_function` and matching `main`. (v5, 17:01, was the old code from a cached link; v4, after #102 that morning, the October review's hardening.) Before that: v1, deployed 27 Sep through the dashboard editor from `main` after PR #22 merged; checked the same day against the repo with `get_edge_function` | Read-only. Reads the Schema.org recipe block at a `SOURCE_URL` and returns the source's ingredient strings, for the preview's COMPARE WITH SOURCE. `{"pageUrl": "https://…"}` or `{"recipeId": "…"}`. Fetches public https pages only, re-checking every redirect. Deploy with JWT verification on, like every function but `calendar-auth`; it needs no secrets beyond the ones Supabase provides |
| `calendar-auth` | **v4, redeployed 12 Oct 2026 after #102** (the October review's hardening), JWT verification off; read back with `get_edge_function` that morning and spot-checked against `main`. Before that: v3, redeployed 10 Oct 2026 after PR #75 (v1 was 9 Oct), JWT verification off; read back with `get_edge_function` at 17:50 UTC and carrying the Drive change (`requestedScope`) | CONNECT (Google's consent link), Google's callback (stores the token in Vault, makes the RecipeWrangler calendar), DISCONNECT. **Deploy with JWT verification OFF**: Google calls the callback with no Supabase sign-in; the function checks the sign-in itself on everything else, and the callback is guarded by a one-time value. Needs the secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Since 10 Oct it asks for `drive.file` beside the calendar, for `drive-backup` |
| `calendar-sync` | **v8, deployed 20 Oct 2026 at 19:07 UTC after #176** (the reminder per meal, `docs/PLAN-CALENDAR-PUSH.md` §12: up to two events a day under the ids `…r` and `…n`, the retired plain id deleted, `meal_groups` read), JWT verification on; read back with `get_edge_function` at about 19:10 UTC and carrying `dishStates`, `mealEventId`, `dayEventIds` and the `meal_groups` read (spot-checked, not diffed line for line; the code came through with its own indentation). Before that: **v6, redeployed 12 Oct 2026 at 17:06 UTC after #123** (F38: SYNC NOW to 400 days, a 100-second budget), JWT verification on; read back in full with `get_edge_function`, carrying `ALL_DAYS_AHEAD`, `SYNC_BUDGET_MS` and the deadline, and pasted cleanly this time (no added indentation). (v5, 17:01, was the old code from a cached link; v4, after #102 that morning.) Before that: v3, redeployed 10 Oct 2026 after PR #78 (v2 was 9 Oct; v1 carried `calendar-auth`'s code by mistake), JWT verification on. Read back with `get_edge_function` at 20:31 UTC: the same code as `main` line for line, carrying "(from the freezer)" and `select('*')`, **but every line indented further than the last** (up to 659 spaces; 105 KB against 17.6 KB), which the dashboard editor added on paste. It changes nothing the code does (the file has no string or template literal spanning lines), so compare it ignoring whitespace; the next redeploy can paste it cleanly |
| `drive-backup` | **v2, redeployed 12 Oct 2026 after #102** (the October review's hardening), JWT verification on; read back with `get_edge_function` that morning and spot-checked against `main`. Before that: v1, deployed 10 Oct 2026, JWT verification on; read back with `get_edge_function` at 17:50 UTC and matching `main`. First backup saved 18:05:55 UTC that day | Saves the app's backup file, the one EXPORT DATA downloads, into a "RecipeWrangler backups" folder in the household's own Google Drive, one file a day and the newest 8 kept. `{"backup": <the export>}`. JWT verification on. The same two secrets, and the household's Google connection with the Drive permission (`docs/PLAN-DRIVE-BACKUP.md`) |

The two calendar functions are P3 (`docs/PLAN-CALENDAR-PUSH.md` §9, §10); `drive-backup` uses the same Google connection.
*Seen with `list_edge_functions` on 12 Oct 2026, after 17:06 UTC:* the five in the table and no other, at the versions it
gives: `rehost-images` v16, `source-ingredients` v6 and `calendar-sync` v6 deployed 17:05–17:06 UTC, `calendar-auth` v4 and
`drive-backup` v2 at 07:34–07:36 UTC. *(History: at 15:16 UTC that day it listed v14, v4, v4, v4 and v2. History: on 10 Oct, 16:45 UTC, it listed `rehost-images` v12,
`find-recipe-image` v6, `source-ingredients` v3, `calendar-sync` v2 and `calendar-auth` v1, later than this table said then; the
October review diffed all six against the repo that night, its Appendix C.)*

**Waiting to be redeployed: nothing** (20 Oct 2026, 19:09 UTC). `calendar-sync` v8 is the repo's `main` as of #176 (the reminder per meal);
`list_edge_functions` gave it as v8, updated 19:07:09 UTC, and the other four as in the table. Before that: the F37 and F38 redeploys
(#123) were the table's v16, v6 and v6, and on 13 Oct the repo's `rehost-images` changed in comments only (two recipe titles became
"recipe A" and "recipe B"): no redeploy is needed, and the deployed v16 still names them in its comments, which only the dashboard shows.

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
20260928123928  rls_belt_and_braces_restrict_to_authenticated
(no version)    add_recipes_source_check      (29 Sep 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_aisle_overrides           (29 Sep 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_source_photos             (30 Sep 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_calendar_push             (9 Oct 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_calendar_auto             (9 Oct 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_recipe_sharing            (10 Oct 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_drive_backup              (10 Oct 2026, run from the SQL editor, so not in schema_migrations)
(no version)    add_premade                   (10 Oct 2026, run from the SQL editor, so not in schema_migrations)
(no version)    harden_default_privileges     (12 Oct 2026, run from the dashboard)
```

`make_recipe_images_public_with_guards` and `add_recipe_logs_title_for_adhoc_diary_entries` were
missing from this list until 22 Sep, while the features they carry were recorded as done
elsewhere. The last five were added on 12 Oct; four of them (9-10 Oct) had been in the prose below
only. *(Until 12 Oct this sentence said "the last two", which by then pointed at other entries.)* If you
are adding a migration, add it here in the same breath, and its paragraph below —
`select version, name from supabase_migrations.schema_migrations` is the check for a versioned
one. Every page in `docs/migrations/` is in this list; each page's own "Applied" line agrees with
its date here.

A statement run in the dashboard's SQL editor is not recorded in `schema_migrations`, so the check above does
not show it: `add_recipes_source_check` (`docs/migrations/add-recipes-source-check.md`, one nullable `jsonb` column,
`recipes.source_check`, for PR 5 of the add-recipe plan) was applied that way by the household on 29 Sep 2026 and is
checked instead with the query on its own page (read-only, 18:25 UTC that day: `source_check | jsonb | YES`).
`add_aisle_overrides` (`docs/migrations/add-aisle-overrides.md`, the `aisle_overrides` table for PR 6 of the add-recipe plan) was
applied the same way the same evening, and checked read-only at 20:49 UTC, the minute PR #49 merged: the five columns, row-level
security on, the four `TO authenticated` policies, the household foreign key, unique `(household_id, name)`, and no `anon` grant.
`add_source_photos` (`docs/migrations/add-source-photos.md`: the private `recipe-sources` bucket, its four `TO authenticated`
policies and `recipes.source_photos`, for `docs/PLAN-SOURCE-PHOTOS.md`) was applied the same way by the household on 30 Sep, just
after PR #63 merged (the bucket's `created_at` is 16:35:52 UTC; the merge was 16:34). Checked read-only at 16:47 UTC: the bucket
private, 10 MB, the four types; four policies, one per command, each for `{authenticated}` and naming the bucket and the household
folder; the column `jsonb`, nullable, no default, with its list check; no `anon` select on it; no files yet.
`add_calendar_push` (`docs/migrations/add-calendar-push.md`, PR 1 of P3: two columns on `planner_days`, one on
`household_settings`, the `calendar_connections` table, `private.calendar_oauth_states`, and five service-role-only functions that
keep the Google token in Vault) was applied the same way by the household on 9 Oct 2026, before their first connection (dated
17:52:47 UTC). Seen read-only at 18:59 UTC that day: `household_settings.calendar_remind_at` exists and the household is connected.
Its own page's check queries were run read-only by a session on 9 Oct, before the household connected: the one `TO authenticated`
select policy on `calendar_connections` and no other grant to `authenticated` but `SELECT`; the five `calendar_*` functions each
executable by `service_role` only, not `anon` or `authenticated`; `private.calendar_oauth_states` present; no token in Vault yet.
*(Until 10 Oct this paragraph said they had not been run; the session's own record says they had.)*
`add_calendar_auto` (`docs/migrations/add-calendar-auto.md`, the P3 follow-up: `household_settings.calendar_auto` and
`calendar_auto_remind`, both off by default, for the two automatic toggles) was applied the same way by the household on 9 Oct
2026, before PR #72 merged (20:03 UTC). Checked read-only at 20:03 UTC: both `boolean`, not null, default false.
`add_recipe_sharing` (`docs/migrations/add-recipe-sharing.md`: `recipe_shares`, `recipes.copied_from`, and six `security definer`
functions for browsing another household's recipes, `docs/PLAN-RECIPE-SHARING.md`) was applied the same way by the household on
10 Oct 2026, before PR #74 merged (16:13 UTC). Its page's check queries were run read-only at 16:15 UTC: `copied_from` `uuid`,
nullable; the four `recipes` policies unchanged and the one select policy on `recipe_shares`; the six functions executable by
`authenticated` and not `anon`; no shares and no copies yet.
`add_drive_backup` (`docs/migrations/add-drive-backup.md`: three columns on `calendar_connections` for the weekly backup to
Google Drive, `docs/PLAN-DRIVE-BACKUP.md`) was applied the same way by the household on 10 Oct 2026, before PR #75 merged (17:46
UTC). Checked read-only at 17:47 UTC: `drive_backup_at` `timestamp with time zone`, `drive_folder_id` and `drive_last_error`
`text`. The household reconnected Google with the Drive permission at 18:05:32 UTC, and the first backup reached Drive at 18:05:55
(`drive-backup` answered 200; `drive_folder_id` set, no error; the calendar re-synced at 18:05:49, no error).
`add_premade` (`docs/migrations/add-premade.md`: `planner_days.premade text[]` and `recipe_logs.premade boolean`, for PRE-MADE
meals and COOKED ✓, `docs/PLAN-FOOD-DIARY.md`) was applied the same way by the household on 10 Oct 2026, before PR #78 merged (20:02
UTC). Checked read-only at 20:03 UTC: `planner_days.premade` `ARRAY`, not null, default `'{}'::text[]`; `recipe_logs.premade`
`boolean`, not null, default `false`. At 20:31 no day had a pre-made dish yet and no diary row was pre-made.
`docs/migrations/harden-default-privileges.md` (the October review, F35 and F23) was applied by the household on 12 Oct 2026,
before #120 merged (13:47 UTC). New tables, sequences and functions that `postgres` makes in `public` give `anon` nothing by
default (functions still reach everyone through `PUBLIC`, so a page that adds one keeps its revoke), and the one household
without a `household_settings` row got its row. Checked read-only at 13:47 UTC: `pg_default_acl` for `postgres` in `public`
shows no `anon` on `S`, `f` or `r`, and no household is without a settings row.
`docs/migrations/add-converter-ack.md` (#127: `household_settings.converter_ack_version`, for the converter reminder) was applied by
the household on 13 Oct 2026, after #129 merged (02:24 UTC; the page allows either order, and at 02:24 the column was not yet there).
Checked read-only at 05:53 UTC: `converter_ack_version` `text`, nullable, no default; 3 households, 0 confirmed; granted to `authenticated` (and `postgres`, `service_role`), not to `anon`.

`docs/migrations/add-calendar-items.md` (`planner_days.calendar_items text[] not null default '{}'`, for a calendar reminder per meal,
`docs/PLAN-CALENDAR-PUSH.md` §12) was applied by the household on 20 Oct 2026 (the time of the SQL itself was not read; the page was written
that day, and the column was there at about 19:10 UTC). Checked read-only at about 19:10 UTC with the page's check
query: `planner_days | calendar_items | ARRAY | NO | '{}'::text[]`. Of 44 planned days none has a dish marked yet and the last plan save
was at 17:13:58 UTC, before the app that writes the column (2026-10-20.7) was merged, so **no day has been saved with a setting per dish**:
every day still reads from its two flags, as the page says it will. The household ran SYNC NOW after deploying `calendar-sync` v8:
`calendar_connections` shows `connected` true, `last_sync_at` 19:07:30 UTC (21 seconds after the deploy) and no `last_error`. *Not seen at 19:10:*
what the sync wrote to Google, or the Planner's new buttons on the tablet. **Seen at about 20:00 UTC, after the household's tablet check (75a):**
one day, 24 Oct, saved by the new app at 19:42:32 UTC with two dishes, `calendar_items` `{in,remind}` and `calendar`, `calendar_remind` both true (so the
column and the app's write are seen working together); and `calendar_connections` shows a sync at 19:42:58 UTC with no error. Still not seen: the events in Google.

**Waiting to be applied: nothing** (20 Oct 2026; every page in `docs/migrations/` carries its "Applied" line). A PR that adds a
migration page lists it here as waiting, and the household applies it (first, unless the page says why the order may be
reversed: `CLAUDE.md`); whoever applies it moves it into the list and
paragraphs above, as the rule at the top of this card says.

---

## 4. Secrets — what's safe and what isn't

This is the project's own rule from the original Build Brief, restated here because it governs
everything above:

**Safe to state plainly, anywhere, including committed to the public repo:** the GitHub repo
names/URLs, the Supabase project's public URL, and its anon/publishable key. The publishable
key is explicitly meant to be public-facing — it's designed to sit in front-end code with RLS
doing the actual access control.

**Never paste into chat, and never commit to either repo:** the Supabase **service role key**,
the database **password**, and the Google OAuth **client secret** (P3). These live
only in:

- **GitHub Actions secrets** on the relevant repo: on `PrivateBackup`, `SUPABASE_DB_URL` (which carries the password) and
  `SUPABASE_SERVICE_ROLE_KEY`, with the live check's test account, as in §2. *(Until 12 Oct this bullet named only the
  first, as if the service role key lived in the dashboard alone.)*
- **Supabase's own dashboard** (Project Settings → API for the service role key; Project
  Settings → Database for the password)
- **Edge Functions → Secrets** in the Supabase dashboard, for the Google client: `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` (P3). The Google **refresh token** the calendar functions are given at CONNECT is kept in
  **Vault** (`calendar_refresh_token:<household id>`), reachable only by the service role, and is not in the nightly backup

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
