# Infrastructure reference

Where everything lives and how it is wired. Written to be read with no session and no context. It contains **no secrets**:
every value is either meant to be public (§6) or an identifier that grants nothing on its own.

**Last rewritten 22 Oct 2026** from the previous card (last checked against the live project on 12 Oct, with the calendar
function and one migration added on 20 Oct). Figures marked *as last read* have not been re-checked since; check with the
Supabase connector (`list_tables`, `list_edge_functions`, `list_migrations`) before relying on them.

**How this card is kept.** A migration or an Edge Function deploy is not finished until this card says so. Whoever applies or
deploys it, or the session that checks it afterwards, updates §3 or §4 in the same PR or the next: what, when, how it was checked.

---

## 1. Quick reference

| | |
| --- | --- |
| GitHub account | `crispy-lettuce` (personal) |
| App repo | `crispy-lettuce/RecipeFlowKeeper`, **public**, default branch `main` = production |
| Backup repo | `crispy-lettuce/PrivateBackup`, **private**, default branch `claude/recipe-app-supabase-0z139o` (§2) |
| The live app | https://crispy-lettuce.github.io/RecipeFlowKeeper/ (GitHub Pages from `main`, root) |
| Supabase organisation | CrispyLettuce (`kvfcdgzdurwcqftttukd`) |
| Supabase project | **RecipeWrangler** `mhkayefzrtceesgizkjs`, `eu-west-1`, Postgres 17, free tier |
| Project URL | `https://mhkayefzrtceesgizkjs.supabase.co` (the `SUPABASE_URL` constant in `index.html`) |
| Dashboard | https://supabase.com/dashboard/project/mhkayefzrtceesgizkjs |
| Household ids | The family's: `dfeac187-a044-4f6e-a7a7-d47119930127`. **Test Kitchen:** `286a8a12-c12a-4b83-afbc-0912533f6b1c`. Not secrets (§3) |

**Work flow.** Short-lived branch, pull request, `offline-harness` (`.github/workflows/tests.yml`) must pass, the household merges.
A merge to `main` deploys to the tablet within a minute or two: there is no staging step. To roll back, revert the merge commit.

---

## 2. GitHub

### `RecipeFlowKeeper` (the app, public)
Two code files (`index.html`, `core.js`), `styles/modernist.css`, `help.html`, `privacy.html`, `terms.html`, `changelog.json`;
`supabase/functions/` (Edge Function source), `converter/`, `test/`, `tools/`, `docs/`. `.mcp.json` at the root wires the
Supabase connector for any Claude Code session opened on the repo:

```json
{ "mcpServers": { "supabase": { "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=mhkayefzrtceesgizkjs&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching" } } }
```

`offline-harness` is a required check on `main` (since 27 Sep; enforced for everyone but admins). Pages is configured on the repo
and rebuilds on every push to `main`.

### `PrivateBackup` (private)
Recipe, planner and diary data cannot go in the public repo, so backups go here. **Its README is the authority** on the workflows,
the secrets and the rehearsed restore runbook; this is only the map.

| Workflow | When | Does |
| --- | --- | --- |
| `backup-supabase.yml` | daily 04:00 UTC | `pg_dump` of the `public` and `private` schemas with privileges, checked against the live table and policy counts; 30 newest kept under `backups/` |
| `backup-photos.yml` | Sundays 05:00 UTC | mirrors the `recipe-images` and (private) `recipe-sources` buckets into `photos/`, checking each file's size and MD5 against `storage.objects` |
| `weekly-live-check.yml` | Mondays 06:00 UTC | signs in to the **live** app as a test account in its own household, adds, favourites, logs and deletes a recipe |

Four repository secrets (Settings → Secrets and variables → Actions): `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`. Job records for changes made to the live database sit under `migrations/` there
(the undo files); they are not documentation to prune.

**Two things not to undo.**
1. The default branch is not `main`. The schedules fire from the default branch; renaming it stops both backups silently. If it is
   ever renamed, check the Actions tab afterwards.
2. The dump uses the **Session pooler** connection string (the direct one is IPv6-only and GitHub's runners have no IPv6) and calls
   `pg_dump` 17 by its full path (the runner's own is older than the server).

---

## 3. Supabase

### Tables (*as last read, 12 Oct: 16 in `public`, 1 in `private`, row-level security on all*)
`public`: `households`, `household_members`, `household_settings`, `recipes`, `recipe_logs`, `recipe_notes`, `keywords`,
`planner_days`, `meal_groups`, `shortlist_items`, `ingredient_swaps`, `shopping_checked`, `aliases`, `aisle_overrides`,
`calendar_connections`, `recipe_shares`. `private`: `calendar_oauth_states`. What each holds: `docs/SPEC.md` §7.

Row-level security is driven by `private.household_ids_for_user()`, in a `private` schema and granted to `authenticated` only,
never `anon`. `private.my_household()` is used by the sharing functions. New tables, sequences and functions that `postgres` makes
in `public` give `anon` nothing by default (`docs/migrations/harden-default-privileges.md`); a new **function** still needs its
own revoke from `PUBLIC`.

### Households (*as last read, 18 Oct*)
Four rows each in `households`, `household_members`, `auth.users` and `household_settings`:
- **the family's own** (`dfeac187…`), owner the family's account; shares its recipes with the relatives' household and Test Kitchen;
  holds the Google connection;
- **the relatives' household**, the family's second (made by `docs/ONBOARDING.md` §4);
- **Test Kitchen** (`286a8a12…`): the family's first household and its placeholder library, the test household since 18 Oct;
- **the live check's household** (for `weekly-live-check.yml`).

An id is not a secret: RLS is enforced by `auth.uid()` against `household_members`. The test-household split (18 Oct) was one SQL
script run from the dashboard and read back afterwards; its record is `PrivateBackup` `migrations/test-household-split/README.md`.
The calendar still holds 13 events from before the split under Test Kitchen's id (9 to 22 Oct). Nothing syncs them; the household
decided on 20 Oct to leave them.

### Storage
| Bucket | Access | Holds |
| --- | --- | --- |
| `recipe-images` | public read by path; writes, deletes and listing only under the caller's own `<household_id>/` | a recipe's photo, `<household_id>/<recipe_id>.<ext>` |
| `recipe-sources` | private; links signed for an hour | the photos and PDFs a recipe was converted from, `<household_id>/<recipe_id>/` |

Public means only that the `/object/public/` endpoint serves bytes without auth. It was a deliberate choice: signed URLs expire,
and `image_url` is written verbatim into the export and the nightly dump, where an expired link would rot. The app writes both
buckets directly from the browser (UPLOAD PHOTO, source photos, ADD TO OUR RECIPES) and also through `rehost-images`
(`docs/IMAGES.md`).

### Edge Functions
Source is in `supabase/functions/<name>/index.ts`. **They are deployed to Supabase by hand, not by GitHub Pages**, so a change to
the source here is a record, not a deployment, and the two can drift.

| Function | JWT verification | Last deployed (as last read) | Secrets it needs |
| --- | --- | --- | --- |
| `rehost-images` | on | v16, 12 Oct | none beyond Supabase's own |
| `source-ingredients` | on | v6, 12 Oct | none beyond Supabase's own |
| `calendar-auth` | **off** | v4, 12 Oct | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and optionally `GOOGLE_CALENDAR_SCOPE`) |
| `calendar-sync` | on | v8, 20 Oct | the same Google pair |
| `drive-backup` | on | v2, 12 Oct | the same Google pair |

`calendar-auth` has verification off on purpose: Google calls its callback with no Supabase sign-in. The function checks the
sign-in itself on everything else, and the callback is guarded by a one-time value. Deploying a function and merging the app are two
separate acts; if a change is not backward compatible, choose the order deliberately.

**How to deploy.** Dashboard → Edge Functions → paste the file.
- Copy from the **raw** URL (`raw.githubusercontent.com/…`), not GitHub's file view: a copy from the view once stopped at line 100.
- Use the link **pinned to the merge commit**, or wait five minutes after the merge: the `main` link is cached, and on 12 Oct
  three functions pasted within a minute of a merge were the old code under new version numbers.
- The dashboard editor adds indentation on paste and drops the final newline; compare ignoring whitespace.
- Afterwards read the deployed source back with `get_edge_function`, and record the version here.

**Waiting to be redeployed: nothing** (20 Oct).

### Migrations
`select version, name from supabase_migrations.schema_migrations` lists the versioned ones. A statement run in the dashboard's SQL
editor is **not** recorded there, so the later changes are listed here instead. Each page in `docs/migrations/` carries its own
"Applied" line and check queries. The household applies a migration, first, unless the page shows the app works without it.

| Migration | Page | Applied |
| --- | --- | --- |
| Phase 1 schema, RLS, storage, helper hardening, `recipe_logs` cascade; Phase 2 servings and alias kinds | (versioned, 13 Sep) | 13 Sep |
| `make_recipe_images_public_with_guards`; `add_recipe_logs_title_for_adhoc_diary_entries`; `rls_belt_and_braces_restrict_to_authenticated` | (versioned) | 21 Sep; 22 Sep; 28 Sep |
| `add_recipes_source_check` | `add-recipes-source-check.md` | 29 Sep |
| `add_aisle_overrides` | `add-aisle-overrides.md` | 29 Sep |
| `add_source_photos` | `add-source-photos.md` | 30 Sep |
| `add_calendar_push` | `add-calendar-push.md` | 9 Oct |
| `add_calendar_auto` | `add-calendar-auto.md` | 9 Oct |
| `add_recipe_sharing` | `add-recipe-sharing.md` | 10 Oct |
| `add_drive_backup` | `add-drive-backup.md` | 10 Oct |
| `add_premade` | `add-premade.md` | 10 Oct |
| `harden_default_privileges` | `harden-default-privileges.md` | 12 Oct |
| `add_converter_ack` | `add-converter-ack.md` | 13 Oct |
| `add_calendar_items` | `add-calendar-items.md` | 20 Oct |

(The 13 Sep temporary import function and staging table were created and dropped the same day.) **Waiting to be applied:**
`add-cook-ahead.md` (`planner_days.cook_ahead`, `recipe_logs.cook_ahead`, issue #221), written 30 Oct and run with its undo on a scratch
Postgres 16 only; the household applies it from the dashboard before merging the PR that carries the app's side. A PR that adds a page
lists it here as waiting; whoever applies it moves it into the table.

---

## 4. Google (Calendar and Drive): setting it up from nothing

All in the household's own accounts; a session cannot do it and never sees the client secret. About 20 minutes.

1. **Google Cloud console**, signed in as the account that will hold the calendar: new project **RecipeWrangler**; APIs & Services →
   Library → enable **Google Calendar API** and **Google Drive API**.
2. **OAuth consent screen** (Google Auth platform → Branding, Audience, Data access): External; app name RecipeWrangler; your email
   as support and developer contact. Add the scopes `…/auth/calendar.app.created`, `…/auth/drive.file`, `openid` and `email`. (If
   `calendar.app.created` is not offered, use `…/auth/calendar` and set the secret `GOOGLE_CALENDAR_SCOPE` to it; no code change.)
   Audience → **Publish app** ("In production"); left in Testing, Google expires the connection after seven days.
3. **Clients → Create client:** Web application, name RecipeWrangler; authorised redirect URI exactly
   `https://mhkayefzrtceesgizkjs.supabase.co/functions/v1/calendar-auth/callback`. No JavaScript origins. Copy the client ID and
   secret straight into step 4.
4. **Supabase → Edge Functions → Secrets:** add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **SQL editor:** apply `add-calendar-push.md`, `add-calendar-auto.md`, `add-calendar-items.md` and `add-drive-backup.md`, each
   with its check queries.
6. **Deploy** `calendar-auth` (verification **off**), `calendar-sync` and `drive-backup` (verification on) from raw URLs.
7. **In the app:** Settings → APP → CONNECT GOOGLE CALENDAR. Click through "Google hasn't verified this app" (Advanced → Go to
   RecipeWrangler) once, and allow both boxes. SAVE TO DRIVE NOW then writes `RecipeWrangler backups` in the account's Drive.

The Google **refresh token** is kept in Supabase **Vault** (`calendar_refresh_token:<household id>`), reachable only by the service
role, and so not in the nightly backup. DISCONNECT revokes it and leaves the calendar and its events in Google.

---

## 5. Elevated access

Never in a conversation, a file in either repo, or this card: the **service-role key** (GitHub Actions secret on `PrivateBackup`,
and Supabase's dashboard), the **database password** (inside `SUPABASE_DB_URL`), and the **Google client secret** (Supabase Edge
Function secrets). If a tool needs elevated privilege, it goes in that platform's own settings screen.

## 6. What is safe to state publicly

The repo names, the Supabase project ref and URL, household ids, and the **publishable (anon) key** in `index.html`
(`sb_publishable_fH3SOU5nVJE6nsXIlffidg_mVKayaEH`), which is designed to sit in front-end code with RLS doing the access control.
A legacy JWT-format anon key also exists and is equally safe; the app uses the publishable format.

## 7. Picking this up with no prior context

1. Clone what you need: `git clone https://github.com/crispy-lettuce/RecipeFlowKeeper.git`, and `PrivateBackup` if working on backups.
2. Read `README.md`, then `docs/STATUS.md` (where things stand), `docs/SPEC.md` (what the app does) and `docs/ARCHITECTURE.md` (how).
3. Claude Code picks up the Supabase connector from `.mcp.json`. With another tool, the project ref and URL above are all that is
   needed to point the CLI or dashboard at the project; sign in at supabase.com/dashboard with the account that owns CrispyLettuce.
4. **`main` is production.**
