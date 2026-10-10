# Review of the code, set-up and administration — October 2026, findings

**Written 10 Oct 2026**, against the app repo at `02e7bae` (the merge of PR #80, identical to `main`) and
`PrivateBackup` at `a701c5f`. The brief was to look for errors, inconsistencies and areas of concern across
four areas: the app code, security and administration, backups and restore and CI, and the documents
against reality; to describe fixes, not make them. Every claim below carries its evidence: a `file:line`
at those commits, a read-only query against the live project with the time it ran, a local command with its
exit code, or the words "not verified". No recipe, plan or diary content appears here; counts and
structure only, and every example is made up.

**Three caveats before anything else.**

- The live project was read through the Supabase connector only: catalogue tables, aggregates, the deployed
  function source, the advisors and the last 24 hours of logs. Nothing was written, no function was invoked,
  no request was made as the app makes it. GitHub's settings, secrets and Actions history were out of scope
  by agreement and are reported as not verified wherever they matter.
- Nothing was restored. The restore findings rest on the runbook's text, the live schema and Postgres's
  documented rules, not on a rehearsal.
- The code was read by eight parallel reviewers with non-overlapping regions, then every finding was re-read
  at its cited lines by the author of this document before it was kept. Severities are the author's.

**Severity.** *High*: can lose data, expose data beyond its household, break a restore or take the app down.
*Medium*: wrong, or unverified, in a way that will bite. *Low*: hygiene. *Info*: worth knowing, including
things checked and found right. *(latent)* marks a condition today's data cannot reach.

---

## 0. The verdict in short

The app is sound for what it does today, and the two things the September review asked for first (row-scoped
writes, a rehearsed restore) were done. What has slipped since is the record and the runbook: eleven PRs in
ten days added three tables, a bucket, four Edge Functions, a Vault secret and two households, and the
restore runbook, the backup's self-check and the reference documents still describe the 23 Sep shape.
Four things to do first:

1. **The restore runbook would not work as written.** Case 1 (data only) is refused by Postgres on today's
   schema, and Case 3 (fresh project) binds all three households to one account and omits the second bucket,
   four functions, two secrets and the Vault token (F1, F2, F6, F7).
2. **Two deployed functions fetch whatever address they are given.** `find-recipe-image`, which the app no
   longer calls, is an unguarded fetch oracle for any signed-in account; `rehost-images` follows redirects
   with no host check and publishes whatever image-typed body comes back (F3, F4).
3. **Five small ways a change is lost or comes back.** A retried write can land after a later write to the
   same row and put the old value back; a meal type tapped while an insert is still failing is dropped with a
   success toast; deleting a recipe turns every other pre-made dish on those days fresh again; a freezer entry
   removed from History returns on the next load; and a second word match on an already-merged row splits it
   for good (F5, F8, F14, F15, F16).
4. **The old pre-Supabase page is still in the public repo, served at the Pages root, with recipe text in
   its seed data** (F9).
5. **Three faults in the parser and the dictionary that the preview cannot see**: a notes line beginning
   "Merge" or "Stage" is reported unreadable and blocks a batch; "1 pint milk" passes the metric check; and
   three dictionary spellings, one of them the converter's own model line, are not indexed (F17, F18, F19).

Everything else is a list of specific corrections, most of them to documents, and a longer list of things
that were checked and are right (§5): the deployed functions match the repo character for character apart
from whitespace, every policy is `TO authenticated` and `anon` holds nothing, every nightly dump since 13
Sep ran, the core version stamp agrees in all three places, and all seven test suites pass with exit 0.

---

## 1. Answers first

### (a) App code

**Verdict: sound in its main paths; four edge cases lose a small change, and two reference claims about the
app's shape are false.** The storage pattern (one in-memory cache, one queued background write per action,
a refresh that can never replace unsaved work) holds up on re-reading: the refresh drains the queue, stands
down on unsent changes, discards what it fetched if anything moved, and keeps the cache on any error
(`index.html:10247-10272`). Every ordinary save is one row (`saveRecipe` 3517, `patchRecipe` 3542,
`savePlanDay` 3771, `saveTick` 6124); the whole-table replaces are reachable from `importAllData` only
(10047-10126). The retry rule, though, orders a failed write only against the write that follows it, not
against writes that succeed in between (F5); and the diary's "still unsaved" guard answers with a `return`
where it should throw (F8). Deleting a recipe leaves its diary rows in the cache, so an export taken before
the next refresh carries rows that cannot be imported (F20). Two households now have no settings row, and
the code reads that as "the calendar-auto migration is not in" (F23). The PRE-MADE work of 10 Oct has two
rough edges that the household will meet: a recipe delete drops the flag from the other dishes on those
days (F14), and a freezer entry removed from History is re-logged on the next load (F15). The shopping
list follows a word match one hop only (F16). In `core.js`, which the Node suite covers well, three things
the suite cannot see: a prose line beginning with a keyword is reported unreadable (F17), the metric check
misses the imperial units the converter is most likely to leave (F18), and three dictionary spellings with a
note glued on are unindexed (F19); and three places where the text shown or stored is quietly not the
household's wording (F45). Nothing reachable from a shared household's recipe renders unescaped, and a
shared recipe cannot enter the planner, the shortlist, the diary or the export (§5).

### (b) Security and administration

**Verdict: the database side is right; the two older image functions are not.** Row-level security is on
every one of the 16 public tables, 52 policies in `public` and 8 on `storage.objects`, all `TO authenticated`;
`anon` holds no grant on any of them; the helper and the twelve newer functions are `security definer` with
a fixed `search_path`, and the five that touch Vault are executable by `service_role` only (Appendix A). The
six Edge Functions authenticate the caller before any service-role read and filter by the caller's
membership. The gaps are in what two of them fetch: `find-recipe-image` takes any URL from any signed-in
account with no household check and reports status, type and size of up to twelve more addresses it finds
on that page (F3); `rehost-images` fetches each recipe's `image_url` with redirects followed and no scheme,
host or private-range check, and stores an image-typed answer in the public bucket (F4). Neither is
reachable without a sign-in, and sign-ups are closed by the app, so the audience is the household's own
accounts; the fix is cheap and the pattern already exists in `source-ingredients`. The OAuth flow is
correctly built (random one-time state, fixed redirect URI, token in Vault, scope checked) with one untidy
edge (F26).

### (c) Backups, restore and CI

**Verdict: the backup runs; the restore would not.** Every night since 13 Sep has a dump commit, the photo
mirror has run four times, and the dump does carry the `private` schema and the privileges. But the runbook's
Case 1 names 13 tables where there are 16 that reference `households`, so its `TRUNCATE` is refused (F1);
Case 3 re-points every membership at one new user when there are three (F2) and names one bucket, two
functions and no secrets (F6); after any restore the calendar row says connected while Vault holds no token,
and nothing puts it right (F7). The dump's self-check still asserts "at least 13 tables, at least 46
policies", which a dump missing the three newest tables would pass (F10). The 30-dump prune runs for the
first time on 11 Oct and relies on file times from a fresh checkout (F21). The photo workflow is green
when the private bucket is not mirrored (F22). CI runs every suite `CLAUDE.md` names; its own header still
says "197 checks" and Playwright is unpinned (F29).

### (d) The documents

**Verdict: honest in the way they always were, and stale in the way they always were.** The migration
pages, the plans and `HANDOVER.md` §7 date everything and record what was verified. The reference pages do
not keep up: `INFRASTRUCTURE.md`, the card meant to work "with no prior context", says 13 tables, one
bucket, three functions, one secret, and a function table that disagrees with its own footnote (F11);
`ARCHITECTURE.md` says the app never touches Storage and makes one Edge Function call, where it makes
seven to five functions and uploads to both buckets itself (F12); `HANDOVER.md` §1 says P3 is "not built"
above a §4 that says it is live (F13); the index still says PR 5 of the add-recipe plan is open (F13);
nine documents state a test count that is wrong today (Appendix D); and `help.html`'s test matches its
button names as substrings anywhere in `index.html`, so four of its names already pass only through
comments or longer labels (F28). Appendix B has 60 correction rows.

---

## 2. Findings

### F1 — Restore Case 1 is refused on today's schema; forced through, it loses three tables (High)

- `PrivateBackup/README.md:138`: the data-only restore truncates thirteen named tables in one statement.
  Postgres refuses to truncate a table that is referenced by a foreign key from a table outside the
  statement. Live, 22:45 UTC: `aisle_overrides`, `calendar_connections` and `recipe_shares` (and
  `private.calendar_oauth_states`) all reference `households` with `ON DELETE CASCADE` (`pg_constraint`).
  So step 2 exits 1 before touching anything, and the runbook's "likely case" stops dead.
- If an operator adds `CASCADE` to get past it, those tables are emptied and step 3 reloads only the thirteen
  in `data.list` (`README.md:130-134`): every household aisle, the Google connection row with its Drive
  folder id, and every share are gone unrestored, while `wc -l data.list   # 13` still reassures.
- The dependency order in `data.list` is otherwise still valid: the three new tables reference only
  `households`, so they can go anywhere after it.
- **Fix:** add the three public tables to the `for t in …` list and the `truncate`, add
  `private.calendar_oauth_states` to the `truncate` (ten-minute consent states, nothing to keep), change
  `# 13` to `# 16`, and in "Checking a restore" (`README.md:271-272`) change 46 and 13 to 52 and 16.
  Rehearse Case 1 once against a scratch restore of a dump made on or after 11 Oct, which is the first to
  carry all sixteen tables (the 10 Oct 04:08 dump predates the sharing, Drive and PRE-MADE migrations of
  that afternoon: its table of contents, read with `strings`, shows 16 `TABLE` entries including the
  private one, 51 policies, 6 functions and no `recipe_shares`).

### F2 — Restore Case 3 binds all three households to one account (High)

- `PrivateBackup/README.md:208`: `update public.household_members set user_id = '<new user uuid>';` with
  no `WHERE`, after step 2 creates one user. There are now three households, three members and three auth
  users (live, 22:22 UTC: the family's, the weekly live check's of 28 Sep, and the one made 10 Oct).
- After that statement one account is a member of three households. `hydrate()` picks one with
  `.limit(1)` and no `order` (`index.html:2934`), `private.my_household()` returns null for an account in
  more than one household so every sharing function silently does nothing, and `calendar-sync`,
  `calendar-auth` and `drive-backup` answer "needs exactly one household". The weekly live check's account
  is not recreated at all.
- **Fix:** step 2 creates one auth user per household (the family's, the test account from
  `TEST_USER_EMAIL`, the third); step 4 becomes one `update … where household_id = '<id>'` per row, mapping
  each old user id to its new one. The old ids are in the dump (`pg_restore --data-only -t household_members`
  into a scratch table).

### F3 — `find-recipe-image` is an unguarded fetch oracle, and nothing uses it (Medium)

- `supabase/functions/find-recipe-image/index.ts:273-278`: `pageUrl` from the request body is checked for
  truthiness only, then fetched at 313 through `timedFetch` (199-204) with `redirect: 'follow'` and no
  scheme or host check. The household lookup (280-286) runs only when `pageUrl` is absent, so this path needs
  a sign-in and nothing else. The response returns the upstream status (315), the raw fetch error text (321),
  and for up to twelve candidate addresses taken from that page's own `og:image` and JSON-LD (212-253) each
  one's status, content type, byte count and pixel size (331-342). `recipeId` is not UUID-checked (283).
- `index.html` never invokes it (grep for `functions.invoke`: seven sites, five functions, none this one).
  It is deployed as v6 (live, `list_edge_functions`, 22:22 UTC) and `docs/IMAGES.md` keeps it as a console
  incantation.
- Who can reach it: any account with a Supabase session. The app has no sign-up form, and whether the Auth
  API itself accepts sign-ups is a dashboard setting this review could not read (`docs/ONBOARDING.md:45-46`).
  What its network reaches was not probed and should not be.
- **Fix:** undeploy it (the household's action, from the dashboard) and move the one console use in
  `docs/IMAGES.md` to a guarded path. If it is kept: require a household before any fetch, pass `pageUrl` and
  every candidate through `safePageUrl` and the manual-redirect `fetchPage` from
  `source-ingredients/index.ts:53-61, 118-134`, and return a fixed phrase instead of the fetch error text.

### F4 — `rehost-images` fetches each recipe's `image_url` with redirects and no host check, then publishes the answer (Medium)

- `supabase/functions/rehost-images/index.ts:380`: the sweep fetches `src`, the row's `image_url`, with
  `redirect: 'follow'`. Any member writes that column through an ordinary save (`index.html:2877`). There is
  no scheme, host or private-range check; the 20-second timer is cleared when headers arrive (381), so a slow
  body holds the invocation; the body is buffered in full before the 10 MiB check (392-394); `limit` (287)
  takes any number.
- If the answer carries one of the six image content types (48-51) its bytes are stored at
  `${household_id}/${recipe_id}.${ext}` in the public bucket (400, 416-417) and the public URL is returned.
  Per-row `why:` strings carry the upstream status, content type and byte counts (383-398, 455). Because
  redirects are followed, the stored address need not be internal: a public one that answers 302 will do.
  Reach: a signed-in member of a household (an account in none gets 403 at 293-296).
- `source-ingredients` already has the guard this needs, and `test/source-ingredients.js` tests it. Two
  gaps in that guard, found by running it offline: `https://localhost./x` (trailing dot) and
  `https://127.0.0.1.nip.io/x` (a public name that resolves privately) both pass (`safePageUrl`, line 59
  anchors on `$` and never resolves). Both are Low on their own because that function requires `https:`
  on every hop (F27).
- **Fix:** lift `safePageUrl` and `fetchPage` into `rehost-images` (and `find-recipe-image` if kept), with
  the suffix regex ending `\.?$` and `supabase\.(co|in|com|net)`; refuse early when `content-length` exceeds
  the cap and read with a counting reader; clear the timer after the body, not the headers; bound `limit`.
  Measure first: an `https:`-only rule would make the sweep report any `http:` image still in the library as
  failed (live, 22:45 UTC: 0 recipes carry an external image URL, so today it changes nothing).

### F5 — A write that fails twice and then lands overtakes a later successful write to the same row (Medium)

- `index.html:2807-2811`: `queueWrite` splices the whole failed pile ahead of the new write; a retry that
  fails is pushed back on the pile (2795-2800). The comment at 2779-2780, "a retried toggle can never
  overtake the toggle that followed it", holds only against the write that triggered the retry.
- Scenario: W1 (say a favourite set to on, or a recipe upsert) fails for a non-network reason (a 5xx, a
  token rollover, a transient PostgREST error). W2 (favourite off, or a later edit of the same recipe) is
  queued: W1 is retried first, fails again, goes back on the pile; W2 lands. Any later write, even to another
  table, retries W1, which now lands after W2 and puts the older row back. Its label clears, the next refresh
  pulls the server's older value into the cache, and the later change is gone without a word.
- Not reproducible with the offline stub (it resolves a write on the same tick) and not seen in the live
  logs; it needs a write that fails twice and then succeeds.
- **Fix:** key each queued write by `(table, row key)` and drop a failed write when a later write to the same
  key succeeds; or retry a failed write once behind the next write and then discard it with a lasting
  notice. Either is a change to `runWrite`/`queueWrite` only.

### F6 — Restore Case 3 is missing most of what was added since 23 Sep (Medium)

- `PrivateBackup/README.md:215` creates one bucket and four policies; live there are two buckets and eight
  `storage.objects` policies (22:45 UTC), and nothing in either repo but this runbook can recreate any of
  them, since the `storage` schema is not dumped. `README.md:239` deploys two functions "with the Supabase
  CLI"; there are six, one of them (`calendar-auth`) deployed with JWT verification **off**, which the
  runbook's reader would not know to do. The secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and the
  Google OAuth client's authorised redirect URI (which embeds the project ref,
  `calendar-auth/index.ts:151`) exist nowhere in either repo. `BUCKET=recipe-sources scripts/restore-photos.sh`
  is a second upload pass the script supports and step 6 does not show. The Vault token is not in the dump
  by design, so a reconnect step belongs here (F7). "errors ignored on restore: 2" (`README.md:203`) was
  measured with one membership row.
- What does come back from the dump without any step: `private.calendar_oauth_states` and both private
  functions (`pg_dump --schema=private` takes every object in the schema), the eleven public functions
  (their `vault.*` references are not validated at restore because `pg_dump` emits
  `SET check_function_bodies = false`), and the policies and grants.
- **Fix:** rewrite steps 5, 6, 8 and 9 for two buckets, eight policies (`docs/migrations/add-source-photos.md:27-44`
  has the second set), six functions with `calendar-auth` JWT-off, two secrets, one redirect URI, and add
  "Settings: DISCONNECT, then CONNECT GOOGLE CALENDAR with Drive ticked".

### F7 — After a restore the connection row says connected while Vault holds no token, and nothing corrects it (Medium)

- `supabase/functions/calendar-sync/index.ts:284`: when the row is connected but `calendar_token_get` returns
  nothing, the function returns `notConnected` before `note()` is defined, so the row keeps
  `connected = true`. `drive-backup/index.ts:178` has the same shape. The app's comment at `index.html:4101`,
  "calendar-sync has already recorded this as not connected", is true only of the `reconnect` branch (290).
- Scenario: any restore (the dump carries the row, never the token), or the migration's own undo, which
  deletes the Vault row. Settings shows "Connected as …" with SYNC NOW and DISCONNECT on every load; each
  Planner save that queues a sync toasts "not connected" and flips `connected` in memory only, so it is back
  after a reload; a week after the restored `drive_backup_at` the automatic Drive save tries and records
  "Last problem". Only a tap on DISCONNECT or a reconnect writes the row.
- Live today (22:50 UTC): `connected` true, one Vault secret, no errors recorded: the healthy state.
- **Fix:** in both functions, when `conn?.connected && !refresh`, `note({ connected: false, last_error:
  'CONNECT again in Settings' })` before returning; and add `update public.calendar_connections set
  connected = false;` to the runbook's post-restore steps.

### F8 — A meal type (or any diary edit) tapped while the entry's insert is failing is dropped with a success toast (Medium)

- `index.html:3179-3182`: inside the queued update, `if(unsavedDiaryIds.has(id)){ showToast(…); return; }`.
  A `return`, not a `throw`, so `runWrite` counts it as landed and it is never put on the retry pile.
- Scenario: offline, tick a flow's last column; the insert fails and sits on the pile. Tap "Lunch": the
  update is queued behind the insert's retry, which fails again; the update finds the id still unsaved,
  toasts and returns. Back online, the insert is re-run and lands with `meal_type` null; the update is gone.
  The cache says lunch until the next refresh pulls null back. "Tagged as lunch" (6937) fired anyway.
- The 28 Sep fix that moved this check inside the queued write (the comment above it) made the common case
  right; this is the failing-insert case it did not reach. The offline stub cannot show it (same-tick writes).
- **Fix:** `throw` instead of `return`, so the update is retried in order after the insert; or let the
  update mutate the `entry` object the insert closure reads at run time (3137-3141) instead of replacing it
  (3164-3165).

### F9 — `index-old.html` is in the public repo, served at the Pages root, and carries recipe text (Medium)

- The file (4,900 lines, 221 KB, the pre-Supabase app) has been at the repo root since the merge of PR #31
  on 28 Sep (`git log --diff-filter=A`). GitHub Pages serves the repo root, so it is reachable at the app's
  address with `index-old.html` appended, with no sign-in, as a second working app on browser storage.
- Its `seedIfEmpty` (line 2221 onwards) embeds several complete recipes in the app's own syntax: titles,
  sources, ingredient lines, steps. Checked in scratch, with the live titles read once and the file deleted
  afterwards: two of the seeded titles are titles in the live library today. `CLAUDE.md`'s first ground rule
  is that recipe data must never be committed here. `docs/ARCHITECTURE.md:270` calls the file "not used, not
  served, not maintained", and the 23 Sep review (`REVIEW-ARCHITECTURE-FINDINGS.md:585`) "harmless".
- **Fix:** delete it from the tree in a PR (it stays in history; whether to rewrite history is the
  household's call and probably not worth it for converted web recipes), and correct the two documents.
  `test/image-integrity.js` also names one library recipe's title (in the broken-JPEG case recorded in
  `HANDOVER.md` §6); a title is not a recipe line, but a made-up one would do the same job.

### F10 — The dump's self-check still asserts the 23 Sep shape (Medium)

- `PrivateBackup/.github/workflows/backup-supabase.yml:95-96`: `[ "$TABLES" -ge 13 ]` and
  `[ "$POLICIES" -ge 46 ]`. Live there are 16 public tables and 52 public policies (22:22 UTC), so a dump
  that silently lost `recipe_shares`, `calendar_connections` and `aisle_overrides` and their six policies
  would pass. The check also never looks for `private.my_household()` or `private.calendar_oauth_states`.
- The dump itself is fine: `--schema=private` captures the table and both functions, privileges are kept,
  and the 10 Oct dump's table of contents (read with `strings`, Appendix A) has the expected entries for the
  schema as it stood at 04:08 that morning.
- **Fix:** read the live counts with `psql` in the same run and require equality, or at least raise the
  floors to 16 and 52 and add the two private names.

### F11 — `INFRASTRUCTURE.md` no longer describes the project it is the reference card for (Medium)

The page is "written to be useful with no Claude Code session and no prior context". Against the live
project on 10 Oct it says:

| Line | Says | Actually |
| --- | --- | --- |
| 143-148 | 13 tables, `recipe_notes` "exists, unused" | 16 public tables and one private; `recipe_notes` in use since 30 Sep, 2 rows |
| 27, 153 | "the only" household, "single row", "one member row" | 3 households, 3 members, 3 auth users |
| 162 | "One bucket, `recipe-images`" | Two: `recipe-images` (public, 31 objects) and `recipe-sources` (private, 1 object) |
| 181 | "Three deployed, all `verify_jwt: true`" | Six; `calendar-auth` has JWT verification off, as its own row at 198 says |
| 195-197 | `rehost-images` v10, `find-recipe-image` v4, `source-ingredients` v1 | v12, v6, v3 |
| 203-204 | footnote: `calendar-sync` v2, `calendar-auth` v1, no `drive-backup` | v3, v3, v1; the footnote is older than the table it annotates |
| 108, 300 | "One repository secret required" on `PrivateBackup` | Four: `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (the workflows' `secrets.*` references); §4 says the service-role key lives only in the dashboard |
| 90-117 | two workflows | three: `weekly-live-check.yml` is absent, and the photo workflow's `recipe-sources` step is absent |
| 106-107 | under `backup-photos.yml`: "verified 14 Sep … a real ~87 KB dump" | the database dump's sentence, displaced when the photo bullet was inserted (a 23 Sep workflow cannot have run on 14 Sep) |
| 220-239 | "the full account … in order" ends at `add_calendar_push` | four later pages are in the prose only (265-281); line 241's "the last two" now points at the wrong entries |
| 4 | "most recently 22 Sep" | changed 10 Oct |

- **Fix:** one pass over §1-§3 against Appendix A of this document, and a rule for the page: a migration
  page or a function deploy is not finished until this card says so.

### F12 — `ARCHITECTURE.md` says the app never touches Storage and makes one Edge Function call (Medium)

- `docs/ARCHITECTURE.md:224` and `docs/INFRASTRUCTURE.md:173`: "`index.html` does not read or write Storage
  directly". It uploads source photos to `recipe-sources` (`index.html:7164-7171`), uploads a shared
  recipe's image to `recipe-images` (8023-8032) and makes signed URLs (7154).
- `docs/ARCHITECTURE.md:229-230`: `rehost-images` "is the only Edge Function call in `index.html`;
  `functions.invoke` appears nowhere else". Seven calls to five functions: `rehost-images` (3472, 8345),
  `calendar-sync` (4070), `drive-backup` (8179), `calendar-auth` (8220, 8234), `source-ingredients` (9438).
  Line 269 lists three function directories; there are six. Line 179 says 14 tables; 217 calls
  `households.name` scaffolding, which `set_household_name` has written since 10 Oct; 214 says no UI sets
  `recipe_logs.note`, which the meal prompt's ADD A NOTE does (`index.html:1896, 3139`); 96-97 give line
  counts of 6,980 and 1,140 against 10,327 and 1,839.
- These two are the pages a new session is told to read first. A session trusting them would not look for
  Storage policies when a source-photo upload fails, or would judge a policy change safe.
- **Fix:** rewrite §4's table list (16 + 1), the Storage paragraph and the Edge Function paragraph; date the
  verification line.

### F13 — Status lines that say "not done" of finished work (Medium)

| Where | Says | Actually | Settled by |
| --- | --- | --- | --- |
| `HANDOVER.md:35` (§1, "verified status") | P3 "Scoped 30 Sep …; not built" | PR 1 merged 1 Oct (#69), the app 9 Oct (#71), the toggles (#72); connected 9 Oct | `git log --merges`; the file's own §4 at 615 |
| `HANDOVER.md:638` | `add-calendar-auto` "waiting" | applied 9 Oct, 20:03 UTC | `INFRASTRUCTURE.md:265-267`; the file's own 2046 |
| `HANDOVER.md:632, 1898` | `add-calendar-push` "not applied", functions "not deployed" | applied 9 Oct; both v3 live | `INFRASTRUCTURE.md:257`; `list_edge_functions` |
| `HANDOVER.md:2073` | sharing: "the migration is not applied" | applied 10 Oct 16:13; `recipe_shares` 1 row live | `INFRASTRUCTURE.md:268-272`; the file's own 2085 |
| `DOCUMENT-INDEX.md:421, 438-439` | PLAN-NEW-RECIPE-FLOW "PR 5 open for review … PRs 6-8 are not built" | all eight merged 29 Sep (#41-#53) | `NEXT-SESSION.md:37`; `git log` |
| `PLAN-NEW-RECIPE-FLOW.md:6` | "Nothing in it has been built" | its last commit is PR 8 | `git log` |
| `DOCUMENT-INDEX.md:260, 277` | both PROPOSAL pages "not started" | built 29 Sep (#49; #43, #52, #53); 273 in the same entry says so | `git log` |
| `DOCUMENT-INDEX.md:136-137` | add-recipes-source-check: "`INFRASTRUCTURE.md` lists it as waiting" | applied 29 Sep; `INFRASTRUCTURE.md:282` says nothing is waiting | both files |
| `DOCUMENT-INDEX.md:217-218` | ingredient review: "step 3 is on PR #10; the rest waits" | steps 3-8 done by 27 Sep | `HANDOVER.md:54, 778-860` |
| `DOCUMENT-INDEX.md:148-150` | the live test and RLS "tracked separately in `NEXT-SESSION.md`" | done 28 Sep; `NEXT-SESSION.md` was rewritten 30 Sep and tracks neither | `HANDOVER.md:943-1055` |
| `NEXT-SESSION.md:13` | "Where things stand (30 Sep 2026)" | the content under it is 9-10 Oct | `git blame` |
| `NEXT-SESSION.md:55-57, 59, 81-83` | toggles "apply the SQL, then merge"; help guide "then one PR"; "once its PR merges"; "after the fresh-or-freezer PR merges" | all merged (#72, #73, #77, #80 is HEAD) | `git log` |
| `NEXT-SESSION.md:28` | one account, one household, plus the test's | three households; the third is the family's second (`ONBOARDING.md` §4) | live |
| `TEST-PLAN.md:156, 167` | B2 "never run against the real backend"; C "still open" | TEST-IMAGES ran 22 Sep; export/import round-tripped 21 Sep | `HANDOVER.md:456, 2168` |
| `README.md:11, 13` | "Single HTML file"; "Status, September 2026" | two files since 25 Sep; 32 lines later it says so | `README.md:32` |

- A session told to "build P3" or "apply the waiting SQL" from `HANDOVER.md` §1 would redo finished work
  against a live schema. **Fix:** correct each line in place and say so, as the file's own §6 asks.

### F14 — Deleting a recipe turns every other PRE-MADE dish on the days it touches back into a fresh one (Medium)

- `index.html:3580`: `deleteRecipe` rebuilds each touched day as `keepCalendarFlags(entry, { recipeIds: keepIds,
  servings: keepServings })`, carrying the calendar flags but not `premade`; `removePlanRecipeAt` (3898-3912)
  splices all three in step. `savePlanDay` then writes `premade: planPremade(entry)`, all blank.
- Scenario: a day holds a main plus a dish marked PRE-MADE · DINNER; the household deletes some other recipe
  that is also on that day. The freezer dish silently becomes fresh: it goes back on the shopping list, and if
  the day is today or past its diary row stays while the Planner shows COOKED ✓ for it. Live (22:45 UTC):
  three days carry a pre-made entry.
- **Fix:** collect `keepPremade` alongside `keepIds` and `keepServings` and build the entry with
  `withPremade(…)`, as `removePlanRecipeAt` does; add a smoke check that deletes a recipe from a day with a
  pre-made dish and reads the day's `premade` back.

### F15 — REMOVE on a from-the-freezer diary entry brings it back on the next load (Medium)

- `index.html:6803`: History's REMOVE calls `deleteDiaryEntry` for a pre-made entry like any other. `logDuePremade`
  (5290-5310) rebuilds `have` from the diary and re-adds any planned pre-made meal on a past day whose
  deterministic id is missing; it runs at start-up, on every tab return (10270) and on every PRE-MADE change.
  No plan day is ever pruned.
- Scenario: the household removes a freezer entry from History; the plan still marks the dish pre-made; the
  next load re-inserts the same row and toasts "Logged 1 meal from the freezer".
- **Fix:** have REMOVE on a pre-made entry also clear that day's flag (`setPlanPremadeAt(date, index, '')`), or
  say in the confirm that it will come back while the plan says pre-made.

### F16 — A chained word match is followed one hop, so a second MERGE splits a row that cannot be re-merged (Medium)

- `core.js:1704` builds the alias map as single pairs and `core.js:1202` looks a key up once
  (`alias(key)`), with no transitive walk. Run with made-up names: a map holding `x y → y` and `y → z` answers
  `y` for `x y`, not `z`.
- Scenario: the household merges A into B (row B now totals both); later accepts "Same as C?" on row B, writing
  B → C. From then on B's own lines go to C but A's lines still map to B, so a row "B" reappears holding only
  A's lines; MERGE on it writes B → C again (a no-op upsert), so it can never be closed from the list.
- **Fix:** in `ingredientMatchMap`, follow each value through the map until it stops (a visited set guards a
  cycle), or loop `alias()` in `aggregateShoppingLines` until stable. This changes keys for any chained match,
  so re-measure the library first, as `CLAUDE.md` requires of a naming change. Live: 15 word matches; whether
  any chain exists was not read.

### F17 — The parser reports a notes or steps line that starts with "Group", "Stage" or "Merge" as unreadable, and the batch validator then holds the recipe back (Medium)

- `core.js:272`: `if(KEYWORD_LINE.test(line)) unread.push(…)` runs after the line has been accepted into the
  notes or steps (265-271), and `KEYWORD_LINE` is case-insensitive. Run: a NOTES line "Merge well before
  serving" is kept in `notes.general` and also reported unread ("looks like a GROUP, STAGE or MERGE line but is
  not written as one"). `test/validate-recipes.js` (~215) turns such an unread line into a blocker.
- Scenario: a TIPS line "Stage the toppings before you start" renders correctly in the app, shows a warning in
  the preview, and stops the recipe in a batch validation.
- **Fix:** run the keyword test only when the line was not consumed as prose (mode is none, group or stage),
  or require the stricter shape `^(GROUP\s|STAGE\s*:|MERGE\s)`; add a core.test case with a prose "Merge" line.

### F18 — The "not metric" check never fires for pint, quart, ounce, pound, fl oz or sticks of butter (Medium)

- `core.js:1368` tests `qty` for those words, but `QTY_UNIT` (53) admits only `cups`, `oz` and `lb` of them, so
  "pint", "quart", "ounce(s)", "pound(s)", "fl oz" and "sticks of butter" always land in `rest`. Run:
  `ingredientLineFaults('1 pint milk')` is empty; `'1 cup milk'` is flagged `metric` with `affectsList`.
- Scenario: a converter slip leaves "1 pint milk"; the preview says nothing; the shopping list keys it as
  "pint milk" with amount 1 and no unit, a separate row from milk.
- **Fix:** test the words against the first word of `rest` as well when `qty` is a bare number, and add one
  core.test case per word so each is seen to fail once.

### F19 — Three dictionary spellings carry a bracketed note and are therefore not indexed, one of them the converter's own model line (Medium)

- `core.js:1024`: `DICTIONARY_NOTE` skips the whole comma-piece when it holds a bracket, and three `also`
  cells carry a plain spelling with a note glued on: "long-grain rice (write the uncooked amount …)",
  "sweet paprika (not smoked …)", "coriander powder (bare coriander …)". Run: `dictionaryRow` is null for all
  three, while "long grain rice" and "paprika" find their rows. `converter/conversion-instructions.md` §1
  gives `200 g long-grain rice, cooked and cooled` as a model line. The core.test check "every wording the
  reader skips is a note" passes because a bracket is present, so it cannot see this. Same class as the
  `confectioners' sugar` entry in `HANDOVER.md` §6.
- **Fix:** move notes out of the `also` cell into a `note` field, or index the text before a trailing bracket
  when it holds no note word; then a core.test that asserts the row for `long-grain rice`. This adds dictionary
  rows for those spellings and so re-keys their ticks: re-measure the library first.

### F20 — Deleting a recipe leaves its diary rows in the cache; an export taken before the next refresh cannot be imported (Low)

- `index.html:3560-3562` remove the recipe and its notes from the cache; nothing touches `cache.diary`,
  though the server cascades `recipe_logs`. `exportPayload` (9862) writes `cache.diary` out. On import,
  10072 and `replaceAllDiary` (3627-3637) never check that a row's `recipeId` is among the restored recipes,
  unlike the notes import (10103-10104).
- Scenario: delete a recipe, then EXPORT DATA before leaving the tab. The file's `diary` carries rows for a
  recipe it does not contain. Restoring it: recipes land, the `recipe_logs` upsert hits the foreign key
  (`recipe_logs_recipe_id_fkey`), the whole 'cooking history' write throws and is retried on every later
  write, the refresh is blocked until reload, and the toast says "Imported N recipes".
- The weekly Drive save is not affected: it runs right after a load, from a fresh cache (10221, 10269).
- **Fix:** in `deleteRecipe`, `cache.diary = cache.diary.filter(e => e.recipeId !== id)`; in the import,
  drop (or make ad hoc) diary rows whose recipe is not in the file, as the notes import does.

### F21 — The 30-dump prune runs for the first time on 11 Oct and sorts by file time from a fresh checkout (Low)

- `backup-supabase.yml:103`: `ls -1t *.dump | tail -n +31 | xargs -r rm --`. `git log --diff-filter=A --
  backups` counts 30 dumps ever added and `--diff-filter=D` none deleted; 30 files are in the tree, so the
  next run is the first prune. On a fresh checkout every file carries a checkout-time mtime; `ls -t` on
  equal times falls back to name order, ascending, so `tail -n +31` would then delete the newest old dump
  rather than the oldest. It will probably work (git writes files in index order, so the nanoseconds
  ascend with the names), but nothing guarantees it.
- **Fix:** the names carry the timestamp: `ls -1 *.dump | sort -r | tail -n +31 | xargs -r rm --`. Check
  after the 11 Oct run that the commit deletes exactly the 13 Sep dump.

### F22 — The photo workflow is green while the private bucket is not mirrored, and a half-failed mirror is committed (Low)

- `backup-photos.yml:126` runs the `recipe-sources` step with `continue-on-error: true`, and
  `scripts/mirror-private-bucket.sh:21-24` exits 0 with a `::warning` when the service-role key is absent;
  the guard at 145 fires only on `outcome == 'failure'`. So a lost or renamed secret turns the private mirror
  off silently. Separately, the script moves each good download into place (64) and exits 1 only after the
  loop (68), before writing the manifest, and "Commit and push" still runs: the tree can hold files the
  manifest does not list, and `restore-photos.sh` restores only what the manifest lists.
- **Fix:** now that the secret exists, make a missing key `exit 1` and drop `continue-on-error`; or download
  into a temporary tree and move it in as a whole, and commit the sources only when the step succeeded.

### F23 — A household with no settings row never sees the automatic calendar toggles (Low)

- `index.html:3040`: `calendarAutoAvailable = !!settings.data && 'calendar_auto' in settings.data`. For a
  household with no `household_settings` row (two of three, live 22:50 UTC) `settings.data` is null, so the
  migration is read as not applied: the two toggles stay hidden and `saveSettings` never names the columns,
  although they exist. The row appears only once week start or dark mode is changed (the upsert at 3237),
  and the toggles only after the next load. `sourcePhotosAvailable` on an empty library (3004) has the same
  shape and is documented as intended.
- **Fix:** have `docs/ONBOARDING.md` §4's statement insert a default `household_settings` row with the
  household, and detect the column from the row's shape only when a row exists.

### F24 — Restoring word matches and aisles upserts on `id` where the real key is the natural one (Low)

- `index.html:3294` and `3438`: the import's `pushList` upserts rows by primary key (2861) and only then
  deletes rows not in the file (2864-2865); `addAlias` (3307) relies on `UNIQUE (household_id, kind, alias)`
  and `aisle_overrides` on `UNIQUE (household_id, name)` (live constraints, 22:45 UTC).
- Scenario: a word match settled on another device after the backup was taken has the same `(kind, alias)`
  under a different id. The file's row is inserted first, violates the unique key, the whole 'word matches'
  write fails and is retried forever, and the delete that would have removed the conflicting row never runs.
  Restore-only; live there are no duplicate natural keys.
- **Fix:** for these two tables, pass `onConflict` on the natural key in the restore, or delete-not-in-file by
  natural key before upserting.

### F25 — Whole-row saves from a stale visible tab overwrite other devices' columns, including a star (Low)

- `recipeToRow` (2870-2902) always sends `favourite` (2880), though the edit form has no such field
  (`readFormFields` 8959-8975 does not read it); `saveRecipes` (3530-3537) sends every column of every recipe
  carrying a merged source or keyword. The refresh runs only on hidden → visible (10307), so a desktop tab
  left visible all day keeps its morning cache; an EDIT from it writes the morning `favourite` over a star
  set elsewhere that day, and a source or keyword merge rewrites every column of every recipe it touches.
- The 23 Sep review accepted last-writer-wins at row scope; the star is the one column a form save has no
  business sending. **Fix:** leave `favourite` out of the row when called from the form (`patchRecipe` already
  exists for it); have `saveRecipes` send only `source`/`tags` and `syntax` with an `update`.

### F26 — The OAuth callback trusts the state row's household without re-checking membership (Low)

- `calendar-auth/index.ts:177-203` use `st.household_id` throughout; `st.user_id`, which
  `calendar_state_take` returns, is never read. A member who taps CONNECT, is removed from
  `household_members` within ten minutes, and then completes Google's consent binds the household's calendar
  and its weekly whole-library Drive backup to their Google account until someone taps DISCONNECT. There is
  no removal workflow today, so the window is theoretical.
- Worth saying in `help.html`, by design rather than a bug: whichever member connects routes the household's
  complete export into their personal Drive weekly.
- **Fix:** after the state is taken, one `household_members` read for `(st.user_id, st.household_id)` and a
  `denied` redirect when it is missing.

### F27 — `source-ingredients`'s host blocklist has two bypasses (Low)

- `source-ingredients/index.ts:59`: the suffix regex anchors on `$`, so `https://localhost./x` passes; and
  the check never resolves names, so `https://127.0.0.1.nip.io/x` passes (both run offline through the lifted
  function, Appendix A). `*.supabase.com` and `*.supabase.net` are not listed. Line 58's `host.includes(':')`
  is dead (a WHATWG hostname never holds a colon outside brackets, which `^\[` already catches).
- Why Low: `https:` is required on every hop (56, 123), so a plain-HTTP internal service cannot complete a
  request; what remains is the error-text oracle at 173. The body is buffered before the 5 MB check and the
  timer covers headers only, as in F4.
- **Fix:** `\.?$` on the suffix regex, add the two domains, and add `'https://localhost./x'` and
  `'https://127.0.0.1.nip.io/x'` to the refused list in `test/source-ingredients.js:147-149`, which would fail
  today, as `CLAUDE.md` asks of a new check.

### F28 — `test/help-guide.js` matches the guide's button names as substrings anywhere in `index.html` (Low)

- `test/help-guide.js:31`: `app.includes(label)` over the whole file, comments and code included. Of the 98
  names the guide quotes, CHECKED AGAINST THE PHOTO (help 248) exists in the app only as a template,
  `CHECKED AGAINST THE ${word}` (`index.html:7341`), and the literal appears in two comments; SOURCE PHOTO
  (142) is a substring of the form label "SOURCE PHOTOS AND PDFS" (1996); SUBSTITUTION RECOMMENDATIONS is
  shown with a leading ⇄; REMIND AT only inside "REMIND AT, the evening before"; and GO, SAVE, SOURCE, APP,
  SHARE, HELP, LIBRARY, SKIP, CSV, RESET, OPEN, RUN, MERGE each have one real match and many substring ones,
  so renaming the button alone passes. `HANDOVER.md:2160-2161` records exactly this once already (COOKED
  FRESH), patched by rewording the comments.
- **Fix:** strip comments from `index.html` first, then require each label as whole element or string text
  (a boundary of `>`, a quote or `${…}` on each side), report every label's count, and raise the "more than
  50" floor at line 30 to the measured 98 less a small margin.

### F29 — CI and the weekly live check: unpinned Playwright, a stale header, no concurrency guard (Low)

- `.github/workflows/tests.yml:29`: `npm install playwright` with no version; a Playwright major would break
  CI with no code change. Line 4 still says "the 197-check suite". `PrivateBackup`'s
  `weekly-live-check.yml:45` installs `playwright@^1.63.0` by hand instead of `npm ci` against the committed
  lock file (its `.gitignore` says the lock file exists for exactly that), has no `permissions:`, no
  `concurrency:` (a hand run overlapping Monday's collides on the same test household and both fail at their
  first checks) and no `timeout-minutes`.
- **Fix:** pin (`npm install playwright@1.63.0` or a lock file), `npm ci`, `permissions: {}`,
  `concurrency: live-check`, `timeout-minutes: 20`, and the header number.

### F30 — The "offline" harness fetches image URLs from the live Storage endpoint on every run (Low)

- `test/build.js`'s fixture gives recipes image URLs under the real project's public Storage prefix, as it
  must for `SELF_HOST_PREFIX` to match. The built page renders them as `<img src>`, and headless Chromium
  fetches them. Live `edge_logs`, 10 Oct: nineteen bursts of three to five `GET … 400` requests for
  `recipe-images/h/r.jpg?v=123` and `h/sidebar.jpg?v=7`, one burst per smoke run that day (CI on each PR, and
  this review's two runs at 22:17 and 22:22 UTC). `tests.yml:11` says "Nothing here touches the live
  project". Harmless (a public bucket answering 400), but every CI run on a public repo's PR, including a
  fork's, makes requests to the production project.
- **Fix:** route the page's requests through Playwright (`page.route('**/storage/v1/**', abort)`) or give the
  fixture a prefix the stub serves.

### F31 — `SIGNED_OUT` clears nothing but a flag (Low)

- `index.html:10311`: `appStarted = false; showLoginGate();`. The cache, `writeQueue`, `failedWrites`,
  `unsentLabels`, `HOUSEHOLD_ID`, `calendarConn` and `shared` all survive; only the sign-out button reloads
  (10301-10304). If a session ends on its own (token revoked, expired) and another account signs in on the
  same page, `startApp` re-hydrates, but the old account's failed writes are retried on the next write.
  Writes that built their row at queue time carry the old household and are refused by RLS, leaving a label
  stuck and the refresh blocked; the whole-table replaces build their rows at run time and would push the old
  account's list into the new household. Needs a failed import followed by an account switch without a
  reload: contrived, but the import path is the one that deletes.
- **Fix:** on `SIGNED_OUT`, `location.reload()` as the button does, or clear the queue and the cache.

### F32 — Deleting a recipe when the row delete fails for a non-network reason (Low)

- `index.html:3563-3569`: the row delete is queued; `removeSourcePhotoFiles` is queued right after it
  regardless of outcome; the plan, group and shortlist tidying follows. If the delete is refused (a policy,
  a server error), the files are gone, the recipe is back on reload with `source_photos` naming deleted files
  and missing from every plan day, and the retry toast says "check your connection". The comment at
  3567-3568 ("so the row never names a file already deleted") assumes the delete lands.
- **Fix:** delete the files inside the same queued function after the row delete succeeds; make `runWrite`'s
  toast distinguish a non-network error.

### F33 — FOLD INTO NOTES deletes the note independently of the recipe upsert (Low)

- `index.html:9828-9829`: the note's delete is queued after `saveRecipe` (9821) as an independent write under
  another label. If the upsert fails for a non-network reason while the delete lands, the folded line exists
  only in this tab's cache and in the failed write; a reload loses it. `pendingFold` is otherwise sound
  (cleared at 7544 and 7603; the line must still be in the text, 7519).
- **Fix:** perform the delete inside the same queued function as the upsert, after its success.

### F34 — `CLAUDE.md`'s "apply the SQL, then merge" rule and two migration pages disagree (Low)

- `CLAUDE.md:35-38`: the household applies a schema change from the dashboard "and only then merges".
  `docs/migrations/add-recipes-source-check.md:10` records it applied "after PR #45 had merged";
  `add-source-photos.md:9` "just after PR #63 merged" (`INFRASTRUCTURE.md:253-254` agrees). Both pages say
  the app tolerates the missing column, and both are right, but nothing records the reversed order as a
  decision. A session reading `CLAUDE.md` will refuse an order the household has used twice; one reading the
  pages will treat merge-first as normal.
- **Fix:** one sentence in `CLAUDE.md`: the order may be reversed when the app provably tolerates the
  missing column, and the page says so.

### F35 — Default privileges grant every new table to `anon` and `authenticated` until a migration revokes them (Low)

- `pg_default_acl`, 22:45 UTC: for role `postgres` in schema `public`, tables, sequences and functions are
  granted to `anon`, `authenticated` and `service_role` at creation. Every migration page since 28 Sep
  revokes `anon` by hand, and `calendar_connections` and `recipe_shares` revoke `authenticated` too; live,
  `anon` holds nothing in `public` and `authenticated` holds full DML on `households` and
  `household_members` with a select policy only, so RLS alone stops writes there (both tables have
  `relrowsecurity` true). Correct today, by discipline rather than by default. `private.my_household()` has
  no role grant and relies on the `private` schema not being exposed.
- **Fix:** `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;` (and
  functions, sequences) once, from the dashboard, so a forgotten revoke fails closed; add the explicit
  `REVOKE` to the migration template either way.

### F36 — Two-household accounts: hydrate signs them out or merges their data (Low, latent)

- `index.html:2934` `.limit(1)` with no order; 2940 `recipes.select('*')` with no household filter; 2956
  `household_settings … maybeSingle()` in the throwing group, so two settings rows sign the user out at
  10210. With one settings row the library, planner and ticks come back as the union of both households and
  every one-row write stamps whichever household `limit(1)` returned, so a recipe can migrate between
  households. `HOUSEHOLD_ID` is also reassigned at 2937 before the refresh's veto at 2976. Three Edge
  Functions accept several households, three and the sharing SQL refuse them; `docs/ONBOARDING.md:66-67`
  says "exactly one" is enforced, and it is, by convention. Live (22:45 UTC): no user is in two households.
- **Fix:** throw a clear error when `memberships.length > 1`, and assign `HOUSEHOLD_ID` after the veto.

### F37 — Fetch timers cleared at headers, bodies buffered before the size check (Low)

- `rehost-images/index.ts:381, 392-394`; `find-recipe-image/index.ts:203, 298, 335`;
  `source-ingredients/index.ts:114, 129-130`. A slow or huge body holds one invocation to the platform's
  limit and the memory it allows; only the household's own function budget suffers.
- **Fix:** as in F4.

### F38 — `calendar-sync {all:true}` has no cap on the actions it takes (Low)

- `calendar-sync/index.ts:302` reads planned days from today onwards (the past is not walked), then one
  sequential Google call per future day and per stray own-prefixed event from `listOwnEventIds` (up to 20
  pages of 250), with no cap or delay. A plan hundreds of days ahead could approach the function's wall-clock
  limit, in which case `note()` at 336 never runs. The app sends `{all:true}` unchunked from four places
  (8251, 8277, 8294, 10085). Live: 7 future planned days.
- **Fix:** cap `all` to the next 400 days, or page the actions.

### F39 — PRE-MADE edge cases: a second freezer row, an uncorrected meal type, a silent flow (Low)

- `index.html:5300` counts a recipe's occurrence among all its copies on the day before the `!premade` return at
  5302, so a day holding a fresh and a pre-made copy of the same recipe logs the freezer row with `n = 2`;
  removing the fresh copy re-keys it to `n = 1` and the next `logDuePremade` writes a second row (nothing
  deletes the first, by design, 5276-5278). Live: no duplicate pre-made rows.
- `5304`: a pre-made meal type changed after logging (dinner to lunch) is never corrected in the diary, while
  the toast at 5820 says it is.
- `5233`: once the fresh-or-freezer question was answered "freezer" (or dismissed, 5270-5272), completing the
  flow later that day logs nothing and says nothing, even after PRE-MADE was switched off for that dish.
- **Fix:** count only pre-made copies for the occurrence (and in `cookedFreshInstead`); when `have` holds the id,
  update the entry's meal type if it differs; check the answered set only while the dish is still pre-made.

### F40 — Changing the week-start day strands every tick, and the comment says the opposite (Low)

- `index.html:8318-8324`: the setting is written and a toast shown; nothing else. Ticks are keyed by
  `isoLocal(startOfWeek(days[0]))` (6155-6158), so the current week's key becomes a different date: the list
  shows nothing ticked, the old rows are unreachable from any screen and never deleted. The comment at
  6146-6147 says "which is why ticks were cleared when it moved": they are not.
- **Fix:** delete the household's rows for the stranded week keys on change, or warn in the confirm; fix the
  comment either way.

### F41 — A duplicate GROUP handle, or a MERGE output named like a live handle, is laid out silently (Low)

- `core.js:492` and `503`: `ranges[g.handle]` and `active[g.handle]` overwrite without a word. Run: two
  `GROUP a:` blocks followed by `MERGE a -> b` give `errors: []`, two ingredient rows and one box covering
  only the second block's row; the first block's rows are drawn and never fed into anything.
  `core.js:533-535`: new boxes are written into `nextActive` first and carried ones overwrite them, so
  `MERGE a -> b` followed by `MERGE b -> c` where a raw `GROUP b:` is still live consumes the raw group, not
  the step just made.
- Both pass `validate-recipes.js`. **Fix:** an error from `buildRows` on a repeated handle, and one when a
  stage's output names a still-live handle.

### F42 — A settings change sends the whole row from the cache (Low)

- `index.html:3233-3247`: `saveSettings` upserts every column with `{ whole: true }`, and `setSetting` (3250)
  spreads the cache over it. A tab that has not refreshed (never hidden) and changes DARK MODE writes its
  day-old `week_start_day` over a change made elsewhere. Narrow and self-healing on the next tab return.
- **Fix:** have `setSetting` upsert `{ household_id, <that column> }` only; keep the whole-row form for import.

### F43 — Shared-library duplicate detection compares raw URLs, and cannot see their copy of our recipe (Low)

- `index.html:7933`: `ourCopyOf` matches `r.copiedFrom === theirs.id` or a raw-trimmed `sourceUrl` equality,
  while the add-recipe review uses `normalisedSourceUrl` (9219). The same page with a trailing slash or a
  tracking query reads as "not ours" and ADD TO OUR RECIPES makes a second copy; a page carrying two recipes
  makes the button open our unrelated one. `shared_recipes()` returns no `copied_from`, so their copy of our
  recipe shows no ALREADY IN OUR RECIPES and can be copied back.
- **Fix:** compare with `normalisedSourceUrl` on both sides; add `copied_from` to `shared_recipes()` (a schema
  change, the household's) and test both directions.

### F44 — The image sweep writes the server's answer into the cache without the "still the URL we sent" guard (Low)

- `index.html:8359-8362`: `r.imageUrl = row.to` with no comparison against `row.from`, where `applyRehostedUrl`
  (3493) checks the URL is unchanged. An IMAGE: edit made during a sweep is overwritten in the cache by the
  re-hosted old picture, and the next save writes it. **Fix:** `if(r.imageUrl !== row.from) return;`.

### F45 — `core.js` changes the household's wording in three places where the comments say it does not (Low)

- `core.js:1048, 1109`: `foldTin` folds "tinned" to "canned" in the text the list *displays*, not only the key;
  the comment at 1006-1009 says the person's wording is still what is shown. Run: a made-up "400 g tinned
  peaches" lists as "Canned peaches". The converter's own model line uses "tinned".
- `core.js:458`: `scaleRecipeSyntax` rebuilds a line with the normalised unit, so a permanent scale from EDIT
  rewrites `1 L water` as `2 l water` and `100 grams` as `200 g`.
- `core.js:47-49` says count words are deliberately not units so a scale never writes "2 pinch salt"; it does
  (`1 pinch nutmeg` × 2 is `2 pinch nutmeg`, × 1.5 is `1 1/2 pinch nutmeg`).
- **Fix:** display from the unfolded words; keep the unit as typed; either accept the pinch arithmetic and
  reword the comment or leave count-word lines unscaled when fractional. The first two deserve a core.test each.

### F46 — A source photo upload that fails leaves a saved row naming files that may never exist (Low)

- `index.html:9820-9821`: `uploadSourcePhotos` is queued, then `saveRecipe`; `runWrite` catches the upload
  error, toasts once and runs the next write regardless. Close the tab and the row permanently names missing
  files; other devices then read "Can't show this photo now: offline, or it hasn't finished uploading" (7276)
  for ever. The comment at 7117-7119 accepts the order. Live: the one recipe with photos matches the one object.
- **Fix:** keep the order, but make the missing-file message say it may need re-adding through EDIT.

### F47 — Harness blind spots worth knowing (Low)

- `test/smoke.js:31`: a console error fails the run only on the main page; the six secondary pages register
  `pageerror` only, so an app `console.error` there passes.
- `test/stub.js:62-67`: every read ignores `.eq()`, `.not()`, `.order()` and `.limit()` and returns the whole
  table, so no smoke check can prove a read is scoped to the household; the stub has no `.in/.gte/.is/.or` on
  reads, so a future use throws a TypeError that `queueWrite` may swallow. A guard that lists the chain methods
  `index.html` uses and asserts the stub defines each would catch the next one.
- `build.js` leaves the Google Fonts `<link>` in the built page, so every run also fetches fonts (F30).
- The stated purpose of `help-guide.js` ("fails when a quoted label has gone") does not hold (F28).

### F48 — One orphaned image object, and the cache-buster that made three more look missing (Info)

- Live, 22:50 UTC: of 31 objects in `recipe-images`, 30 are a current recipe's image and one, uploaded 25
  Sep, belongs to no recipe (its recipe was deleted; `deleteRecipe` leaves recipe images on purpose, unlike
  source photos). The weekly mirror copies it too. Three recipes' `image_url` carries a `?v=` cache-buster,
  so a naive `image_url = prefix || name` comparison reports them missing when they are not; `docs/IMAGES.md`
  §7's three photo queries should strip the query string if they do not already.
- **Fix:** none needed; delete the object by hand if tidiness matters, and note the `?v=` form in IMAGES.md.

### F49 — The advisors (Info)

- Security: the six sharing functions are `security definer` and executable by `authenticated` (intended;
  `docs/migrations/add-recipe-sharing.md` says why and each keys on `private.my_household()`); leaked-password
  protection is off (a paid-plan feature; `NEXT-SESSION.md:30` already says so);
  `private.calendar_oauth_states` has RLS with no policy (intended; only the service role, which bypasses
  RLS, touches it). Performance: nine foreign keys without a covering index and one policy
  (`household_members`, `select own membership`) that re-evaluates `auth.uid()` per row. At 119 diary rows
  none of it matters; `(select auth.uid())` in that one policy is a one-line change if it ever does.

### F50 — Small things seen on the way (Info)

- `index.html:3687`: `pushKeywords` escapes a double quote inside a PostgREST `in.(…)` list by doubling it;
  PostgREST's grammar expects a backslash. No keyword contains a quote today (live), so unreachable.
- `index.html:3052-3064`: on a refresh where the main reads succeed but one of the "apart" reads
  (`aisle_overrides`, `recipe_notes`, `calendar_connections`) fails, the cache for that table is emptied and
  the feature vanishes until the next refresh. No write pushes the loss.
- `index.html:3660`: a version-2 backup (no `diary`) restores the diary from bare dates, so meal types and
  freezer entries in the database are replaced by dates alone; accurate to the comment, undocumented for the
  household.
- `drive-backup` and `calendar-sync` share one refresh token; `invalid_grant` from either correctly flips the
  shared `connected` flag (`drive-backup/index.ts:185-188`). If two households ever connected the same Google
  account, one DISCONNECT's revoke at Google would most likely invalidate the other's token too (not verified
  against Google).
- `calendar-auth`'s callback runs one service-role RPC for any anonymous GET with a `state` (157): by design
  (the state is the credential) and nothing leaks; rate limiting is the platform's.
- `safeReturnTo` (98-104) accepts any path on the Pages origin: same-origin, so not an open redirect.
- Three migration pages were tested on "scratch Postgres 16"; live is 17.6. Nothing in them behaves
  differently on 17, and all three were then applied live and checked.
- `auth_logs`, 10 Oct: three failed sign-in attempts ("Password should be at least 6 characters", twice) and
  one "Refresh Token Not Found" at a tab resume. Ordinary.
- GitHub's 60-day inactivity rule for scheduled workflows applies to public repositories only, so it does not
  reach `PrivateBackup`; `HANDOVER.md`'s worry about it can go.
- `index.html:4258` `daysSince` floors a local-midnight difference, so for the hour after the spring clock
  change a date before it reads one day short (LEAST COOKED, "not cooked in 3 months"). Autumn is unaffected.
- `index.html:5137` builds the viewer's source link with `String.replace` and a string replacement, so `$&`
  or `$'` in a source URL would be interpreted (output stays escaped; cosmetic), and a recipe with a URL but
  an empty source matches the empty string.
- `index.html:8423, 8435`: `data-forget="${a.id}"` is written unescaped; ids come from the server or an
  imported file. `escapeHtml` as the aisle list does at 8781.
- `index.html:7510-7512`: `foldNoteIntoRecipe` carries on when `openEditModal` found no recipe; the next ADD
  would show the stale text. `openEditModal` returning a boolean fixes it.
- `index.html:8140, 8150`: Drive settings say "waiting for the database change" for a household that has the
  column but no connection row; wording only.
- `converter/conversion-instructions.md` §1 lists `tin` as a count-word unit and in the same section says the
  container word never goes in the name, so `1 tin chopped tomatoes` gets the `container` fault; §2 never
  states that a handle is letters, digits and underscore, which the parser enforces.
- `calendar-sync` failures that are not network failures are never retried (`index.html:4072`), as the comment
  says; a gateway 5xx or a Google 503 leaves the flag on and the event unwritten until SYNC NOW.

---

## 3. Recommendations

### Change now — small, no data at risk, high value

1. Fix `PrivateBackup/README.md` Case 1's table list and truncate (F1), Case 3's per-household membership
   step (F2) and its missing steps (F6), and add the post-restore `connected = false` (F7). Then rehearse Case
   1 once against a scratch restore of the 11 Oct dump and record the error count.
2. Raise the dump self-check to equality with the live catalogue (F10); sort the prune by name (F21); fail
   the photo run on a missing service-role key (F22).
3. Undeploy `find-recipe-image` (F3). Lift `safePageUrl` and `fetchPage` into `rehost-images` with the two
   regex fixes (F4, F27), and add the two refused URLs to `test/source-ingredients.js` first so the new
   check fails by name before the guard changes.
4. Remove `index-old.html` from the tree and correct `ARCHITECTURE.md:270` (F9).
5. In `calendar-sync` and `drive-backup`, write `connected = false` when the row is connected and Vault is
   empty (F7).
6. `updateDiaryEntry`: `throw` instead of `return` (F8). `deleteRecipe`: carry `premade` and filter
   `cache.diary` (F14, F20). History's REMOVE on a freezer entry clears the day's flag (F15). The form save:
   leave `favourite` out of the row (F25). Each with the smoke check that fails first.
6a. `core.js`: the keyword test only on lines not consumed as prose (F17); the metric check on the first word
   of `rest` (F18). Both are a few lines and re-key nothing, so they need no re-measure; bump the version
   stamp in all three places.
7. One pass over `INFRASTRUCTURE.md` §1-§3, `ARCHITECTURE.md` §4 and the fifteen status lines in F13, using
   Appendix A and B of this document; then the nine stale test counts (Appendix D).
8. `help-guide.js`: match whole labels outside comments (F28). Pin Playwright in both workflows (F29).

### Change before the next household, device or restore

9. The write queue's retry rule: key failed writes by row and drop one when a later write to the same row
   lands (F5). This is the one finding here that can silently undo a change in daily use, but it needs a
   failing-then-succeeding write to show, and a new stub mode to test.
10. The callback's membership re-check (F26); `SIGNED_OUT` reloads (F31); the delete and fold orderings
    (F32, F33); the natural-key restore for aliases and aisles (F24); a default settings row at onboarding
    (F23); a hard error on two memberships (F36).
11. `ALTER DEFAULT PRIVILEGES` so a forgotten revoke fails closed (F35).
12. Keep the harness off the live project (F30).
13. The two naming changes, each after a re-measure of the live library (`test/README.md`, "Re-measuring"):
    transitive word matches (F16) and the three unindexed dictionary spellings (F19). Both re-key ticks for
    the names they touch; the household decides when.
14. The PRE-MADE edge cases (F39), the stranded ticks on a week-start change (F40), the silent layout faults
    (F41), the per-column settings write (F42), the duplicate detection in the shared library (F43), the
    sweep's guard (F44) and the three wording changes in `core.js` (F45): each small, none urgent.

### Leave alone, and why

- **Row-scoped last-writer-wins.** The 23 Sep review chose it over a merge engine for one household on two
  devices, and it still fits; F25 trims one column from it rather than replacing it.
- **The public `recipe-images` bucket.** Unguessable paths, no listing, and the alternative (signed URLs)
  would rot inside the dumps. Shared recipes' images depend on it (`copySharedImage` reads another
  household's object by URL). Still right.
- **The six `security definer` sharing functions executable by `authenticated`.** The advisor warns; the
  design is explicit and each keys on the caller's own single household. Right.
- **`calendar-auth` without PKCE, and the unverified `id_token`.** A confidential client with a secret, a
  bound redirect URI and a random one-time state; the id token comes straight from Google's token endpoint
  over TLS and is only displayed. Fine.
- **The no-sign-up design and the one-household rule.** Fine; just make the rule fail loudly (F36).
- **The whitespace-only drift in the deployed functions** (no final newline; `calendar-sync` re-indented by
  the dashboard editor). It changes nothing the code does. The next deploy of each can paste it cleanly.

---

## 4. What this review did not cover, and could not verify

- **GitHub's settings and history.** Branch protection and the required `offline-harness` check on `main`,
  the repository secrets, Pages configuration, and the Actions run list (so: whether the weekly live check
  has ever gone red, and the backup-photos runs beyond what the commits show). Out of scope by agreement; all
  "not verified".
- **Live requests as the app makes them.** No request was made to the functions, Auth, PostgREST or
  Storage; RLS was verified by reading policies, grants and function bodies. Whether the Auth API accepts
  sign-ups (`GET /auth/v1/settings`) was not checked.
- **A restore rehearsal.** This sandbox's `pg_restore` is version 16 and refuses the dumps; the apt
  repository was not fetched. F1, F2 and F6 are read from the runbook, the live catalogue and Postgres's
  rules.
- **What the Edge Functions' network can reach** (F3, F4). Not probed.
- **Google's behaviour** on revoking a shared token (F50) and the Drive folder's state.
- **The tablet, Keep Awake, the converter project in the Claude app**, and the household's own data jobs.
- **The content of the backups and photos** in `PrivateBackup`: only file names, commit dates and the
  dump's table-of-contents tags were read.
- **Whether the household's three accounts are the three expected** (family, test, new): counts only.

---

## 5. Checked and found right

Recorded because each one either contradicts a worry in the documents or closes an earlier finding.

- All six deployed Edge Functions match the repo's source character for character apart from whitespace:
  `find-recipe-image` and `source-ingredients` byte-identical (same md5); `rehost-images`, `calendar-auth`,
  `drive-backup` lack only the final newline; `calendar-sync` additionally carries up to 659 extra leading
  spaces per line (105 KB against 17.6 KB), as `INFRASTRUCTURE.md:199` recorded. `diff -w` empty for all six.
  The September review's F4 (a deploy from an uncommitted copy) has not recurred. No secret-shaped string in
  any deployed copy.
- `KITCHEN_CORE_VERSION` `2026-09-30.1` in `core.js:28`, `index.html:2041` and `:2049`; `core.js` last changed
  30 Sep (`git log`).
- All seven suites pass with exit 0 (Appendix A): 143, 492, 31, 12, 32, 11, 7 checks.
- RLS on all 16 public tables (`relrowsecurity` true, `relforcerowsecurity` false); 52 policies in `public`
  and 8 on `storage.objects`, every one `TO authenticated`; `anon` holds no table grant in `public`, `private`
  or `vault`. Storage policies pin the first folder segment to the caller's households on insert, update and
  delete for both buckets, and select on the private one.
- The thirteen functions' live definitions match `docs/migrations/add-calendar-push.md` and
  `add-recipe-sharing.md`; all `security definer` with `search_path` set; the five `calendar_*` executable by
  `service_role` only; `private.household_ids_for_user` by `authenticated` only.
- Every Edge Function calls `getUser` before any service-role read and filters by the caller's membership
  (the OAuth callback's state take is the one designed exception); the CORS origin regex is anchored on both
  alternatives; `rehost-images`' update-by-id is safe because the id came from a household-filtered select;
  `drive-backup`'s Drive query takes its folder id from Google or from a column only functions write, and
  deletes only names matching its own pattern; `calendar-sync` validates dates, caps at 62, reads the plan
  from the database and never walks the past; event ids carry the full household id so they cannot collide.
- `purgeOldFormatTicks` cannot purge a new-format key: `squash` strips everything outside `[a-z0-9\s'-]`
  (`core.js:994`). The 214 inserts and 214 deletes on `shopping_checked` (live `pg_stat_user_tables`) are
  consistent with ticking during a shop and UNTICK ALL after it; nothing clears ticks on load or on a week
  change.
- `refreshLibrary`'s protection is complete for one membership; every `*Available` flag, `calendarDates`,
  the theme and `calendarConn` are assigned after the veto. `HANDOVER.md` §2e's four rules match the code;
  the "fifth" is `onSignedIn`'s one-load-at-a-time (10276-10283).
- `recipeToRow` omits `source_check`, `source_photos` and `copied_from` when the cache has none, so a stale
  tab cannot null them; a removed last photo sends null on purpose; the row is built at queue time.
- `copySharedImage`: path in the caller's own folder, matching the insert policy; `ext` taken before the
  `?v=` query; `applyRehostedUrl` guards by the exact URL sent. `shared_recipes` returns twelve columns and
  never favourites, source photos or `copied_from`; the shared library never enters `cache.recipes`.
- `exportPayload` covers every app table the household can edit (recipes with `sourceCheck`, photo paths and
  `copiedFrom`; the diary with `premade`; plan flags; settings; aliases; aisles; notes); the Drive file is the
  same function, so the two cannot diverge. `csvCell` neutralises formula-leading characters.
- Every night from 13 Sep to 10 Oct has a dump commit (two on 20 and 23 Sep; 4 Oct ran at 05:26); the
  dump covers `private` fully and keeps privileges; the photo mirror has run 23 Sep, 27 Sep, 4 Oct, 10 Oct
  and the `recipe-sources` step once, as `README.md` records.
- No `.sql` file, no `sb_secret`, no JWT, no connection string in either repo; `index.html`, the tests and
  the converter files carry no live recipe title except the one named in F9.
- Date handling is consistent: local dates everywhere a date is stored, ISO UTC for timestamps.
- `test/image-integrity.js`, `calendar-push.js`, `drive-backup.js` and `source-ingredients.js` lift their
  functions by marker and throw if a marker or export is missing: none can pass vacuously.
- `help.html:344`'s "Settings → LIBRARY → RECIPE PHOTOS" is the right path; `IMAGES.md:35, 84` and
  `HANDOVER.md:443, 2222` ("Settings → RECIPE PHOTOS") are the stale ones.
- The Planner cannot leave a day with `calendar` on and no recipes: every rebuild goes through
  `keepCalendarFlags`/`isCalendarDay` (3933-3939), `setPlanCalendar` refuses an empty day (4026), and removing
  the last recipe of a calendar day queues the sync that deletes its event (3801; `calendar-sync` treats an
  asked-about date with no row as a delete). `withCalendarBatch` nesting and flushing on throw are right
  (4011-4022). The auto toggles never reach past days (3978). Live: 0 calendar days without recipes.
- `premadeLogId` makes a uuid Postgres accepts, and two devices make the same one; `addDiaryEntry`'s upsert
  with `ignoreDuplicates` keeps one row (3148). Double-tapping a flow's end cannot double-log (5196-5197).
- A shared household's recipe can be viewed and cooked from but not starred, shortlisted, edited, deleted,
  planned, grouped or logged: the buttons are hidden (`[data-ours-only]`), each handler looks the id up in
  our own library, picking for a day forces our library (7917), and `onComplete` for theirs is a toast
  (5173-5175). Every recipe-derived string from either household is escaped on the card, in the viewer and
  in the flow table (4705-4727, 5133-5139, 2395-2484); the http(s)-only guard holds on the source link.
- The ticks: the stored key is the ingredient name alone with the `both|` prefix in both-weeks mode
  (6371); UNTICK ALL clears only the keys of the mode shown (6283-6286, 6462-6464); the render and the
  change handler use the same week key (6338, 6544); a MERGE from the list cannot write a self-alias or a
  reverse edge (6523). `buildShoppingList` has no write or prompt; pre-made entries are skipped (6228);
  short or zero servings arrays are padded and fall back to ×1 (3822-3826, 6235).
- Word matches and aisles are deleted by their natural key, never by a client id (3313-3322, 3356-3363), so a
  client/server id mismatch cannot strand a row. The aisle pick validates against `INGREDIENT_AISLES`.
- The Add/Edit form never gates a save on advice: the only early returns are the SOURCE and SERVINGS field
  requirements (9764, 9775). `source_check` stores counts, a route and a hash, never page text (9470-9471).
- `households` has a select policy (`select own household`, live), so OUR HOUSEHOLD'S NAME can read back.
- `core.js`: 140 dictionary rows, every aisle valid, no key claimed by two rows, the two apostrophe spellings
  indexed since 29 Sep; `generate-ingredient-names.js --check` matches; every model line in
  `conversion-instructions.md` §1 parses with zero faults, and every duration form the instructions name is
  recognised; `sourceFidelity` on made-up pairs behaves as its documentation says; nothing is defined in both
  files and nothing `index.html` uses is unexported. `aisleFor` (1118) is dead code.
- `csvCell` guards `=`, `+`, `-`, `@`, tab and CR (9997-10001); ad-hoc titles and notes are escaped wherever
  shown; `showToast` uses `textContent`.

---

## Appendix A — What was verified, and how

| Claim | How |
| --- | --- |
| All seven suites pass | `node test/core.test.js` (143, exit 0); `node test/build.js && PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/smoke.js` (492, exit 0); `image-integrity` 31, `source-ingredients` 12, `calendar-push` 32, `drive-backup` 11, `help-guide` 7, each exit 0; run 22:51 UTC from a clean tree |
| Tables, row counts, RLS flags, constraints, foreign keys, policies with their predicates, grants, default privileges, function definitions and privileges, buckets and object counts, extensions, Vault and auth counts | Supabase connector, read-only `select`s against `pg_class`, `pg_policies`, `pg_constraint`, `pg_default_acl`, `pg_proc`, `information_schema`, `storage.buckets`/`objects`, `vault.secrets` (count), `auth.users` (count); Appendix E |
| Structural aggregates (orphans, duplicates, multi-membership, image references, premade rows) | counts only, Appendix E; no title, text, note or email read into this document |
| Deployed Edge Functions against the repo | `list_edge_functions`; `get_edge_function` ×6, the returned source written verbatim to scratch (five by transcription from the tool result, `calendar-sync` by parsing the persisted tool result with a script), then `diff -u`, `diff -uw`, `md5sum`, `wc` |
| Advisors | `get_advisors` security and performance, 22:22 and 22:45 UTC |
| Logs | `query_logs`, last 24 h: sources, function status lines, edge 4xx, auth warnings |
| URL-guard bypasses | `safePageUrl` copied into `node -e` and run on eight made-up addresses |
| `core.js` behaviour (F16-F19, F41, F45, §5) | `node -e` scripts requiring `core.js` with made-up lines and names: `ingredientMatchMap`, `parseRecipe`, `ingredientLineFaults`, `dictionaryKey`/`dictionaryRow`, `computeColumns`, `aggregateShoppingLines`, `scaleRecipeSyntax`; `node tools/generate-ingredient-names.js --check` |
| The Planner's premade drop (F14) | `deleteRecipe` 3574-3582 against `withPremade` 3837 and `keepCalendarFlags` 3938, read |
| The dump's contents | `strings -n 4` over `kitchen-2026-10-10T04-08-42Z.dump`, counting the `TABLE`, `TABLE DATA`, `POLICY` and `FUNCTION` tags and grepping six object names; `pg_restore` 16 refuses the file; no data section read (they are compressed) |
| Dump cadence and prune history | `git log --format=%cd -- backups`, `--diff-filter=A` / `-D` |
| Recipe titles in the public repo | the 34 live titles read once into a scratch file outside both repos, grepped (`grep -F -i -f`) against `index-old.html`, `index.html`, `test/`, `docs/`, `converter/` and this document, then deleted |
| Document claims | each compared with the code at `02e7bae`, `git log`/`git blame`, or the live project; Appendix B |
| Branch and tree | `git status --porcelain` empty in both repos before and after; `git diff origin/main` of this document read in full |

## Appendix B — Corrections to the record

The rows in F11, F12 and F13 are not repeated. Each row: document says | actually | checked how.

| Document says | Actually | Checked how |
| --- | --- | --- |
| `README.md:53`: "237 checks against a stubbed backend" | 492 in the browser, 143 in Node | run |
| `DOCUMENT-INDEX.md:502`: `test/README.md` describes "the 418-check smoke suite" | `test/README.md:80` says 492 | read |
| `ARCHITECTURE.md:248`: `smoke.js # 418 checks` | 492 | run |
| `HANDOVER.md:739` (§7 intro): 329 and 133 | 492 and 143; the file's own 10 Oct entries say 492 | run |
| `TEST-PLAN.md:15`: 329 and 133 | 492 and 143 | run |
| `TEST-IMAGES.md:9`: "passes 329 checks" | 492 | run |
| `HANDOVER.md:2041`: `help-guide.js` "6 checks", "73 quoted buttons" | 7 checks, 98 distinct labels | run; `help-guide.js` |
| `tests.yml:4`: "the 197-check suite" (as history) | 492 today | run |
| `test/README.md:15-16`: "the same three commands run in GitHub Actions" | seven steps | `tests.yml` |
| `test/README.md`: no mention of `image-integrity.js` or `drive-backup.js` | both run in CI | `tests.yml:36, 43` |
| `DOCUMENT-INDEX.md:5`: "Written 14 Sep … every document verified at the time of writing" | last changed 10 Oct; F13's entries | `git log` |
| `DOCUMENT-INDEX.md:464, 473`: "Nine" converter cases | ten; the file's own intro says ten | `converter/test-set.md:3, 329` |
| `DOCUMENT-INDEX.md:161-166`: TEST-PLAN "completed 21 Sep" and, three lines on, "nothing confirmed against the real backend" | the second sentence is the superseded framing | `TEST-PLAN.md:3` |
| `DOCUMENT-INDEX.md`: no entry for `converter/ingredient-names.md`, `privacy.html`, `terms.html` | all three exist; the first is the generated dictionary the index says "maps every document" | `ls` |
| `HANDOVER.md:88` (§1): "13 tables" | 16 public, 1 private | live |
| `HANDOVER.md:655`: "data-only needs the 13 tables in dependency order" | 16, and the runbook is wrong (F1) | live |
| `HANDOVER.md:666`, `INFRASTRUCTURE.md:23`: `PrivateBackup` "exactly one branch" | two remote branches; the default is still `claude/recipe-app-supabase-0z139o` | `git branch -r`; `git remote show origin` |
| `HANDOVER.md:1057-1059`: "sign-in, hydration, RLS and the write queue are all stubbed" | sits inside the weekly **live-backend** entry two lines after the opposite; belongs to an offline-harness entry | read |
| `HANDOVER.md:2166-2192`: an undated "the full browser pass was completed on 21 Sep" block after the 10 Oct entry | the 21 Sep record, left at the foot | `git blame` |
| `HANDOVER.md:443, 2222`; `IMAGES.md:35, 84`: "Settings → RECIPE PHOTOS" | Settings → LIBRARY → RECIPE PHOTOS since Layout E (30 Sep) | `index.html:1707-1711, 1815` |
| `IMAGES.md:565-566`: two function sources; `rehost-images` v8, `find-recipe-image` v4 | six; v12 and v6 | `ls`; live |
| `ARCHITECTURE.md:270`, `REVIEW-ARCHITECTURE-FINDINGS.md:585`: `index-old.html` "not served", "harmless" | served at the Pages root; carries recipe text (F9) | `git`; grep in scratch |
| `ARCHITECTURE.md:201`: `household_settings` "One row. `week_start_day`" | also `dark_mode`, `calendar_remind_at`, `calendar_auto`, `calendar_auto_remind`; one row of three households' | live |
| `ONBOARDING.md:3-4, 73, 79`: "one household today", "there's only one", name "Household" | three; `set_household_name` renames from Settings | live; `index.html:8086` |
| `ONBOARDING.md:37, 44`: `index.html:2520`, `:1250` | the error string is at 2936 and the Sign in button at 1492 | grep |
| `ONBOARDING.md:56`: `households.name` "built ahead of a feature that isn't there" | written since 10 Oct | `add-recipe-sharing.md:116` |
| `ONBOARDING.md:66-67`: "exactly one household" enforced by the functions | by three of six functions and the sharing SQL; `hydrate` takes the first silently (F36) | `supabase/functions/*`; `index.html:2934` |
| `PLAN-RECIPE-SHARING.md:6-7, 34`: "the household applies the migration first" (future) | applied and merged 10 Oct | `INFRASTRUCTURE.md:268-272` |
| `HANDOVER-2026-09-29-SESSION.md:1`: PR 6 "waiting for a go" (title) | resolved 29 Sep; the file's own note says so | read |
| `REVIEW-ARCHITECTURE-FINDINGS.md:692`: P3 "not started, not reviewed" (23 Sep) | built 1-9 Oct; history, not marked as such | `git log` |
| `INFRASTRUCTURE.md:4`, `ARCHITECTURE.md:4`: "most recently 22 Sep", "verified 14 Sep" | both changed 10 Oct | `git log` |
| `CLAUDE.md:123`: `HANDOVER.md` §2e "has the four rules" | four, matching; `onSignedIn`'s one-load-at-a-time is the unlisted fifth guard | `index.html:10247-10283` |
| `CLAUDE.md:35-38` vs `add-recipes-source-check.md:10`, `add-source-photos.md:9` | two migrations applied after the merge (F34) | read |
| `add-recipe-sharing.md:10`, `add-drive-backup.md:6`, `add-premade.md:9`: "scratch Postgres 16" | live is 17.6; no construct differs | live |
| `docs/migrations/*` "After it is applied … remove the waiting note in INFRASTRUCTURE" | there is no waiting note left to remove (`INFRASTRUCTURE.md:282`) | read |
| `PrivateBackup/README.md:32`: the private schema "is that one function" | two functions and a table since 9-10 Oct | live |
| `PrivateBackup/README.md:135, 201, 271-272`: 13 tables, 46 policies | 16 and 52 | live |
| `NEXT-SESSION.md:17-19`: 116 diary entries, cooking notes "none yet" | 119 and 2 (10 Oct) | live |
| `TEST-PLAN.md:21-25`: "`main` holds an older build … earning the confidence to merge" | history since 21 Sep, under "Context" | read |

## Appendix C — Deployed Edge Functions against the repo

Fetched with `get_edge_function` on 10 Oct 2026, 22:50 UTC; written verbatim to scratch; diffed against
the working tree, which matches `02e7bae`.

| Function | Version | JWT verification | Deployed (UTC) | Repo lines / bytes | Deployed lines / bytes | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `rehost-images` | 12 | on | 2026-09-25 11:43 | 462 / 23,562 | 461 / 23,561 | identical but for the final newline |
| `find-recipe-image` | 6 | on | 2026-09-22 14:06 | 357 / 17,338 | 357 / 17,338 | byte-identical |
| `source-ingredients` | 3 | on | 2026-09-27 18:45 | 179 / 9,368 | 179 / 9,368 | byte-identical |
| `calendar-sync` | 3 | on | 2026-10-10 20:30 | 338 / 17,656 | 337 / 105,111 | identical ignoring leading whitespace and the final newline |
| `calendar-auth` | 3 | **off** | 2026-10-10 18:01 | 255 / 13,154 | 254 / 13,153 | identical but for the final newline |
| `drive-backup` | 1 | on | 2026-10-10 18:00 | 228 / 12,302 | 227 / 12,301 | identical but for the final newline |

`diff -uw` is empty for all six; no CRLF on either side; no secret-shaped string in any deployed copy.
`INFRASTRUCTURE.md`'s table should read v12 / v6 / v3 / v3 / v3 / v1.

## Appendix D — Stated check counts against the run

Measured 10 Oct 2026: `core.test.js` 143; `smoke.js` 492 (486 literal `check(` calls plus 4 from the five-view
loop at `smoke.js:67` and 2 from the three-button loop at 2226); `image-integrity.js` 31;
`source-ingredients.js` 12; `calendar-push.js` 32; `drive-backup.js` 11; `help-guide.js` 7.

| Where | States | As current? |
| --- | --- | --- |
| `CLAUDE.md:89-110`, `test/README.md:38-80`, `NEXT-SESSION.md:20-23`, `IMAGES.md:568` | 143 / 492 / 31 / 12 / 32 / 11 / 7 | yes, and right |
| `README.md:53` | 237 | yes, wrong |
| `DOCUMENT-INDEX.md:502` | 418 | yes, wrong |
| `ARCHITECTURE.md:245, 248` | 143, 418 | yes, half wrong |
| `HANDOVER.md:739`, `TEST-PLAN.md:15`, `TEST-IMAGES.md:9` | 329 / 133 | yes, wrong |
| `HANDOVER.md:2041, 2067, 2092` | help-guide 6 | reads as current; 7 |
| `tests.yml:4` | 197 | as history |
| `REVIEW-ARCHITECTURE.md:41, 131`, `REVIEW-ARCHITECTURE-FINDINGS.md` (six places), `REVIEW-INGREDIENT-MATCHING.md:39`, `PLAN-NEW-RECIPE-FLOW.md:566, 630, 699`, `HANDOVER.md` §7 entries | 191 … 487 | as history, fine |

## Appendix E — Every statement run against the live project

All read-only, through the Supabase connector, project `mhkayefzrtceesgizkjs`, on 10 Oct 2026 between
22:22 and 23:05 UTC. Each returned counts, names, booleans, definitions or uuids; the one query that returned
recipe titles (for the privacy grep in Appendix A) was read into scratch and not into this document.

| Time (UTC) | Statement (abridged) | What it returned, in aggregate |
| --- | --- | --- |
| 22:22 | `list_tables` public, private | 17 tables with RLS and row counts: households 3, members 3, settings 1, recipes 34, recipe_logs 119, recipe_notes 2, keywords 49, planner_days 34, shortlist 4, meal_groups 7, swaps 2, shopping_checked 0, aliases 15, aisle_overrides 1, calendar_connections 1, recipe_shares 1, calendar_oauth_states 0 |
| 22:22 | `list_edge_functions`; `list_migrations`; `get_advisors security` | six functions and versions (Appendix C); 14 versioned migrations ending `20260928123928`; three advisories (F49) |
| 22:25 | `pg_policies` for public, private, storage (name, cmd, roles) | 52 + 0 + 8, all `{authenticated}` |
| 22:25 | `pg_proc` with `has_function_privilege` for anon, authenticated, service_role | 13 functions and their executors (§5) |
| 22:25 | `storage.buckets` with object counts | `recipe-images` public 31; `recipe-sources` private 1 |
| 22:25 | `information_schema.columns` for public | every column, type, nullability and default (used for F11, F12, Appendix B) |
| 22:25 | `role_table_grants` for anon, authenticated, service_role in public and private | `anon` none; `authenticated` full DML on 14 tables, SELECT only on `calendar_connections`, `recipe_shares` |
| 22:27 | `version()`, `count(auth.users)`, `count(vault.secrets)`, `pg_extension` | 17.6; 3; 1; plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault |
| 22:30 | households with member, recipe and settings counts | three rows: 13 Sep (1, 34, 1), 28 Sep (1, 0, 0), 10 Oct (1, 0, 0) |
| 22:45 | `pg_constraint` foreign keys with `confdeltype` | 20 keys; all `households` references cascade; `recipe_logs`/`recipe_notes` → `recipes` cascade; `shortlist_items.recipe_id` set null |
| 22:45 | `pg_default_acl` | tables, sequences, functions in public granted to anon, authenticated, service_role by default (F35) |
| 22:45 | `pg_class.relrowsecurity` | true on all 16, force false |
| 22:45 | `pg_stat_user_tables` | inserts/updates/deletes per table (F48, §5: `shopping_checked` 214/0/214) |
| 22:45 | seventeen structural counts (multi-membership, premade duplicates, dangling shares and copies, source photos, source checks, external images, calendar days, premade days, future days, ad-hoc logs, notes on logs, unmatched objects) | 0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 4 (no image), 8, 3, 7, 1, 0, 4 |
| 22:45 | `pg_policies` with `qual`/`with_check` for storage and four tables | predicates as quoted in §5 |
| 22:45 | `pg_get_functiondef` for the 13 functions | definitions compared with the migration pages |
| 22:45 | `pg_constraint` primary, unique and check constraints | as used in F24, F36 |
| 22:45 | `role_table_grants` in vault, storage, private, auth | `anon`/`authenticated`: nothing in vault, private or auth; Supabase's standard grants on `storage.objects`/`buckets` (RLS applies) |
| 22:45 | `get_advisors performance` | nine unindexed foreign keys, one initplan warning (F49) |
| 22:50 | fourteen image and connection counts (object ↔ recipe matching, query strings, other households, oauth states, connection flags) | 3 (false alarm, `?v=`), 0, 4, 3, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1 |
| 22:50 | the three "missing" image rows with their url path and the objects for that recipe id | each has its object; the url carries `?v=` |
| 22:50 | the four unmatched objects with size, type and whether a recipe exists | three are the `?v=` cases; one is an orphan of 25 Sep (F48) |
| 22:50 | `query_logs`: sources; function status lines; error-like lines; the `recipe-images/h/` 400s by minute | §5, F30, F50 |
| 22:55 | eleven more counts (keywords with quotes, null meal types, households without settings, duplicate aliases, calendar days without recipes, short servings arrays, past calendar days, image urls with a query, non-object tags) | 0, 0, 116, 3, 2, 0, 0, 0, 1, 3, 0 |
| 22:58 | `string_agg(title)` from recipes | 34 titles, into scratch only, for Appendix A's grep; deleted |
| 22:50 | `get_edge_function` ×6 | Appendix C |
