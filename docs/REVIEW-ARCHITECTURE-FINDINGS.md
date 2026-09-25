# Independent review of the app's structure — findings

**Written 23 Sep 2026**, answering `docs/REVIEW-ARCHITECTURE.md`. Every claim below was checked
against the code on `main` (`af361a6`, plus the open PR #10 branch that carries the brief), the
live Supabase project, GitHub Actions and the pull-request history, at the time of writing. Where
something could not be checked from this session, it says so (§5). No recipe, plan or diary
content appears here; counts and structure only, and every example line is made up.

**Two caveats before anything else.**

- The brief asked for a session "on a different model from the ones that built the app". This
  session could not confirm that condition was met, and it should be assumed it was not. Treat
  the review as independent in session, context and instructions — it read the code before the
  documents and wrote its question 2 answer before reading the ingredient review — but not
  necessarily in model.
- The sandbox had no outbound web access beyond the connectors. So the live project was read
  through the Supabase connector (schema, policies, grants, row counts, deployed function
  source), not by making requests to it as the app would; nothing was written to it; and the
  backup dump was inspected but not restored.

---

## 0. The verdict in short

The app is in better shape than its own record fears. The runtime pattern, the row-level
security, the Edge Functions' authentication and the test harness are all sound for what they
were built for: one household, one device at a time. Three things are not ready for what comes
next, and none of them is the shopping list:

1. **Two devices editing at once can delete each other's recipes.** Every save replaces a whole
   table from the tab's cache, and the only thing that brings a cache up to date is the tab going
   hidden and visible again. This must change before a second person uses the app (F1).
2. **The backup has never been restored, and the documented restore would probably leave the
   live app unable to read its own tables** even when it succeeds. A fresh-project restore
   cannot work as the dump stands, and the photos are backed up nowhere (F2, F3).
3. **The converter is the only stage where a recipe changes invisibly, and the current plan
   routes the cheapest shopping-list fault through it.** Naming for totals belongs in the app,
   where a wrong match is visible and reversible; the converter should own the shape of a line,
   and something mechanical should check its output against the source (F12, §4).

Everything else is a list of small, specific fixes and a longer list of things to leave alone.

---

## 1. Answers first

### 1. The data model — keep the text as the truth; enforce it properly; don't migrate

**Verdict: right call, half enforced.** Storing the syntax and deriving everything by parsing
costs nothing measurable at this scale (34 recipes, 941–3,937 characters each, 2,380 on
average) and would still cost nothing at ten times it: search runs over a per-recipe parse cache
(`searchText`, `index.html:3552`), the viewer parses one recipe per render, and the shopping list
parses only the planned recipes on each planner change. Nothing queries ingredients server-side,
nothing aggregates across households, and the diary is keyed by row id, so the text format
touches it only through the CSV. The format is also the interchange format with the converter
and with people, which is the strongest argument for keeping it. Storing the parsed structure
alongside would be a second truth to keep in step for no consumer that needs it; storing it
*instead* would make every recipe unreadable outside the app. **What the design decides for
editing in place is the weak spot:** the form is filled from a parse, the person may then edit
any field, and on save only the `TITLE:` and `IMAGE:` lines are written back into the text
(`index.html:6815`). The other six header fields can and do drift (F5). Fix the invariant, not
the model. The parallel arrays in `planner_days` are correct today (0 length mismatches,
lockstep tested) and their real cost is the "Recipe removed" placeholders left by deletion
(7 planner days and 1 meal group point at recipes that no longer exist) — a cleanup on delete,
not a schema change. `shopping_checked.item_key` being the aggregation string is the one piece
worth changing, and the shopping-list plan already changes it; do it there and store a display
label beside the key so the key can become opaque.

### 2. The ingestion pipeline — move naming to the app, keep shape at conversion, verify against the source

**Verdict: the design ranks the faults upside down.** A rewritten recipe (wrong product or
quantity in the kitchen) is invisible, permanent and propagates into every list, every scaled
view and the diary; a wrong merge costs one shopping trip and is reversible in Settings; a
missed merge is two lines instead of one. The current plan asks the converter — the one stage
whose mistakes nothing downstream can see — to rename ingredients to a vocabulary in order to
reduce missed merges, the cheapest fault, and measures success in rows on the list, which
cannot see a substitution at all. The ingredient review's own table shows the vocabulary rule
is not what earns the result: app-side rules take the library from 280 rows to 228, the app-side
dictionary to 205, and every one of the 24 lines that "only the converter can fix" is a *shape*
fault (an alternative, two ingredients on a line, a tin in ml, a cooked weight), not a naming
one. So: the converter owns the shape of an ingredient line and keeps the source's product words
in British English; the app's dictionary and the existing alias table own naming at list time.
Asking a model to rename is safe only for strict synonyms and never for rules that *settle* an
ambiguity ("soy sauce" means light; "oil" means vegetable; bare "coriander" means the leaf) —
those are exactly the cases a model will over-apply. The deterministic alternative is real:
Schema.org Recipe JSON-LD carries the ingredient strings, steps, yield, times and image, and
the `find-recipe-image` function already parses it from a page. What needs judgement is
grouping, staging, late additions, splits, unstated durations and cup-to-gram conversions —
the converter's actual value. For the preview to catch a substitution it must show the source's
ingredient list beside the converted lines, matched one to one, which needs the source lines to
reach the app: either the converter carries them, or an Edge Function fetches the JSON-LD from
`SOURCE_URL`. The second is independent of the model, which is the point. Two cheaper fixes
belong with it: `parseRecipe` should report lines it drops (today a `GROUP` handle with a hyphen
or a malformed `MERGE` arrow vanishes silently, `index.html:2117-2133`; `validate-recipes.js`
already flags this for batches but the in-app preview does not), and the save should reconcile
every header line (F5). §4 has the answer as written before reading the ingredient review, and
where it moved afterwards.

### 3. The runtime pattern — sound for one device; change writes to row scope before a second

**Verdict: keep the shape, change the writes.** The cache-plus-queue design is right for a
kitchen tablet: every screen is instant, writes are ordered, a failed write is surfaced once and
blocks the next refresh until a whole-table save succeeds (`index.html:2752-2770`). The refresh
on every hidden → visible change and its four rules are correct and worth keeping: I mutated
each of the three mechanisms the suite covers and two were caught by name; the third (the early
stand-down) turned out to be redundant with the apply-time veto, which is why removing it
changed nothing (F7). `hydrate()` throwing meaning sign-out is acceptable: the network branch is
right, an account outside any household gets a truthful message, and the remaining way to be
stranded — a select that starts failing after a schema change — is a developer error the login
screen reports in words. **Where it loses data is not the refresh; it is the save.** `pushList`
upserts every cached row and then deletes every row of the household not in the cache
(`index.html:2776-2785`), and it is called by favourite toggles, deletes, keyword and source
edits, saves and import (ten call sites). A tab's cache is refreshed only by `SIGNED_IN`, which
supabase-js emits on visibility changes; a tablet kept awake on a recipe never goes hidden. So:
phone adds a recipe; tablet, still on the same screen, favourites something; the phone's recipe
is deleted, and `recipe_logs` cascades. The same shape applies to the plan, groups, shortlist,
aliases, swaps, keywords and ticks (ticks are delete-all-then-insert, `index.html:5041`).
`docs/HANDOVER.md` §2d already names this as "untouched and still wants its own piece of
work". The simpler shape with the same guarantees is the obvious one: each save writes the
changed row(s) and deletes explicitly; whole-table replace stays only for import. The four
refresh rules then become belt and braces rather than the last line of defence. Worth the
change: yes, and before sharing (F1).

### 4. Sharing with family — small gap to a second person, a product decision for a second household

**Verdict: the security is right; the operations are missing; the concurrency is F1.** Read as
written, not inferred: all 13 tables have row-level security enabled with 46 policies, every
data table has select/insert/update/delete keyed on `private.household_ids_for_user()`, the
function is `SECURITY DEFINER` with a fixed `search_path` and executable by `authenticated` only,
and the four storage policies key on the first path segment being a household the caller is in.
Two caveats: the policies are `TO public` and both `anon` and `authenticated` hold every table
privilege on all 13 tables (Supabase's default), so an anonymous request is refused only because
it cannot execute the helper function — correct today, but belt and braces is cheap (F8).
There is no insert policy on `household_members` or `households`, so nobody can join or create a
household from the app: adding a family member is one SQL statement in the dashboard, and that
is fine for a family as long as it is written down (it is not). A second account already exists
on the project — created 22 Sep, never signed in, email unconfirmed, in no household; whether
public sign-up is open could not be checked from here. `hydrate()` takes the first membership
(`index.html:2833`), so a person in two households would see an arbitrary one; only a second
household would notice. **Adding a recipe without the household's claude.ai account:** the
converter is a prompt in a public file, not an account, so any family member can use it in any
assistant today and paste the result; what they lack is the project files and the vocabulary,
which is a quality problem, not an access one. Of the two options the household has heard of:
the JSON-LD Edge Function is deterministic, costs nothing per recipe, gives a plain recipe with
no flow, and — the reason to build it first — is the same extraction the question 2 fidelity
check needs. The model-backed Edge Function is reasonable: the key lives in Supabase secrets as
the service-role key does, the function checks household membership as `rehost-images` does, a
daily cap bounds the spend, and a conversion costs of the order of 5 to 10 pence at current
first-party rates. The "no AI at runtime" rule was written about the shopping list's totals
being deterministic and reproducible; it does not apply to ingestion, which is where the AI
already sits. What must not be bypassed is the paste → preview → save gate, made stronger by
the fidelity check. Build the JSON-LD function before sharing; build the model-backed one only
if the family actually adds recipes.

### 5. Testing — honest, mostly; three load-bearing mechanisms untested; no CI at all

**Verdict: the suite is real, and it is not enforced anywhere.** 197 checks pass with exit 0
(run here, against the sandbox's own Chromium). Eight mutations were run (Appendix B): three
were caught by a named check, two by a crash that hid every later check, and three were not
caught at all — the delete step of `pushList`, `withUpdatedTitleLine`, and the non-adjacent-merge
error in `computeColumns`. Those three are the most dangerous line in the app, a documented
invariant, and the rule `CLAUDE.md` calls load-bearing. No check I tried was vacuous by
construction; two are weak by construction (the Friday-bucket check passes on a planner with one
bucket, and "ticks survive a rescale" passes when nothing was ticked). The suite prints its
results only at the end, so any crash mid-run reports nothing — which is how two mutations were
"caught". There is no workflow in the app repo, `main` is unprotected, and every push to it
deploys: the 197-check gate is a habit, not a mechanism. **The smallest real-backend test:** a
test household with its own user (one insert each, once), and a Playwright script that drives
the *live* app: sign in, count cards, toggle a favourite, reload, confirm it persisted, add a
recipe, delete it, sign out. About eighty lines, credentials in the private repo's secrets,
weekly. It exercises sign-in, `hydrate()`, RLS and the write queue exactly as the app does, and
it would have caught nothing the stub could. Worth having: yes — the diary's writes and every
refresh rule have only ever run against the stub, and the live diary shows no meal types and no
ad-hoc entries yet, so nothing has exercised them since.

### 6. One file — still workable; split by testability, not by size, when the shopping-list release lands

**Verdict: keep deploying one file; extract the pure logic when you next rewrite it.**
`index.html` is 7,263 lines: 1,140 of CSS, 398 of markup, 5,681 of script, with 314 lines that
open a comment. What keeps it workable: the function map in `docs/ARCHITECTURE.md` §3, the
habit of comments that record decisions, one maintainer, and tests that call functions as page
globals. What already hurts: every pure function — parser, layout, scaling, quantity reading,
aggregation — can only be tested by booting a browser (`validate-recipes.js` launches Chromium
to call `parseRecipe`), the suite is one 1,241-line sequential script, and the ingredient
review's test plan adds 24 checks on exactly those pure functions. The point at which one file
stops being right is not a line count; it is the moment a second script file would let those
tests run in Node in milliseconds. That moment is the shopping-list release, which rewrites the
functions in question. Extract them into one `core` script loaded by a `<script src>` with a
small Node-compatible footer; leave CSS, markup and UI where they are; no build step, no
framework. Not before then: a split for its own sake would only move line numbers under a
maintainer who has learned them.

### 7. Backups and operations — the backup runs; the restore has never been tried and would misfire

**Verdict: not restorable as documented; fixable in an afternoon.** The nightly dump has run 13
times, 12 successful, the first (13 Sep) failing nine attempts before the pooler and `pg_dump`
fixes; 12 dumps of 81–88 kB sit in the tree. The dump's own table of contents (read without
decompressing any data) shows: 13 tables, 46 policies, 45 references to
`private.household_ids_for_user()`, **no function definition at all** (the workflow dumps
`--schema=public` only), a `DROP SCHEMA public` / `CREATE SCHEMA public` pair, one foreign key
to `auth.users`, and `--no-privileges`. Consequences: on the live project, the README's
`pg_restore --clean` would drop and recreate the `public` schema, and the recreated schema would
carry none of the grants the API roles have today (`anon`, `authenticated` and `service_role`
hold `USAGE` on it now) — the tables come back, and the app gets "permission denied" until
someone re-grants. On a fresh project, every policy fails to create because the function is
absent, the membership row fails because its `auth.users` id does not exist, and the photos are
not there at all: `storage.objects` and the bytes are outside the dump, and since the re-host
rewrote every `IMAGE:` line to the bucket, the original image addresses are no longer in the
recipes (F2, F3). None of this is exotic; all of it is one rehearsal away from being found and
fixed. Other one-accident items: no CI and no branch protection on a branch that deploys on
push (F6); supabase-js loaded from a CDN with an unpinned major version (F9); the deployed
`rehost-images` differing from the repo (F4); the private repo's default branch being the
schedule's only trigger (documented, and a rename via GitHub's own UI would retarget it). What
is fine: the anon key in the page, the service-role key only in Supabase's environment, the
database URL only in the private repo's Actions secrets, the Edge Functions' authentication
(`verify_jwt`, `getUser`, membership filter, origin allowlist), and the public bucket.

### 8. The documents — honest to a fault, stale in one systematic way, wrong in a few specifics

**Verdict: keep the set, fix the branch story, add two runbooks.** The corrections table in
`docs/HANDOVER.md` §6 is the most valuable page in the repo, and this review adds to it rather
than contradicting its spirit. The systematic staleness is the "shared working branch"
narrative: `README.md`, `docs/INFRASTRUCTURE.md`, `docs/HANDOVER.md` and `docs/NEXT-SESSION.md`
all describe work living on `claude/recipe-app-supabase-0z139o`, ahead of `main` and unmerged;
that branch is now fully merged and behind `main`, work happens on throwaway branches merged by
PR, and `main` is the trunk. The specific wrong claims are in Appendix C; the ones that matter
are `README.md` saying the Supabase rewrite "has not been merged" (it is production),
`docs/ARCHITECTURE.md` §4 saying the household id is a constant, `docs/INFRASTRUCTURE.md`
saying both Edge Functions have their source in this repo (one differs), and the
`docs/DOCUMENT-INDEX.md` and ingredient-review status lines saying nothing from that review is
implemented or on `main` (step 1 merged as PR #9). Retire or rewrite `docs/NEXT-SESSION.md`'s
prompt; fold `docs/INFRASTRUCTURE.md` §2's branch section into a paragraph on how work flows;
add a restore runbook in `PrivateBackup/README.md` written from a rehearsal, and an operations
checklist (deploy, pin, secrets, what a rename breaks). Keep `TEST-PLAN.md` and `TEST-IMAGES.md`
separate — they say why.

### 9. The plan for what's next — go ahead with the app-side release; trim the converter's naming rule; add the fidelity check

**Verdict: go ahead, changed.** Steps 4 to 8 of the ingredient review (dictionary in the app,
one row per ingredient, ticks keyed by name, strict inline suggestions, the 24-line rewrite in
place, the tick migration by timing) are pure gain and measured; build them as written, on a
Friday morning as planned. Two changes: cut the converter instruction "spelled exactly as in
`ingredient-names.md` when the ingredient is on it" down to the shape rules plus British English
with the source's product words kept, and make `ingredient-names.md` the app's dictionary (the
plan already moves the master copy there). One addition: the source-fidelity check (§4) in the
preview and in `validate-recipes.js`, before any bulk re-conversion — so D12 waits on it, and
the 24-line rewrite (step 7) is validated against the source lines, not only the parser. Do F1
first if the release will be tested from two devices; otherwise the two are independent.

*Steps 4–6 built 25 Sep as PR 6b, for Friday 2 Oct: dictionary aisles, one row per ingredient,
ticks keyed by name, strict inline suggestions. Step 7 and the fidelity check are 6c.*

---

## 2. Findings

Severity: **High** = can lose data or take the app down; **Medium** = wrong or unverified in a
way that will bite; **Low** = hygiene; **Info** = worth knowing.

### F1 — Every save replaces a whole table from a cache that only a tab switch refreshes (High)

- ✅ **Closed 24 Sep 2026, PR #15.** Every ordinary save is one row: a favourite is an `update`
  of that column, a form save upserts that recipe, a removal deletes that row, and the same for
  a plan day, group, shortlist item, word match, swap, keyword and tick. `pushList` and the
  `replace*` functions survive for import only. A failed write is re-sent ahead of the next one,
  since no later row write can vouch for it; the four refresh rules are unchanged. The stub now
  fails and records every write kind, and fifteen checks assert on what each action sends. What
  is left: two people editing the *same recipe's text* at once is still last-writer-wins on that
  one row, which is the accepted shape. The two-device pass (`docs/TEST-PLAN.md` §D) is still to
  be run by the household.
- `pushList` (`index.html:2776-2785`) upserts every cached row, then deletes every row of the
  household whose id is not in the cache. `saveRecipesList` (`:3181`) routes through it and is
  called from the card favourite (`:4076`), the group viewer favourite (`:4256`), the viewer
  favourite (`:4614`), delete (`:4631`), source and keyword edits (`:6250`, `:6279`, `:6287`),
  save (`:6828`, `:6844`) and import (`:7049`). `pushPlan` (`:3318`), `saveGroups`,
  `saveShortlist`, `saveAliases`, `saveSwaps`, `pushKeywords` and `saveShoppingChecked` (`:5041`,
  delete all then insert) follow the same pattern.
- The cache is refreshed only by `onSignedIn` → `refreshLibrary` (`:7213`, `:7187`), driven by
  `SIGNED_IN`, which supabase-js emits on hidden → visible changes. A tablet with Keep Awake on
  a recipe never goes hidden.
- Two devices: A adds a recipe; B, unrefreshed, favourites anything; B's push deletes A's
  recipe and `recipe_logs` cascades. Today's mitigation is that one person rarely does this.
- `docs/HANDOVER.md` §2d: "`pushList`'s habit of also deleting rows absent from the cache is
  untouched and still wants its own piece of work." Agreed; this is that piece of work.
- Also: the delete step has no test — removing it leaves all 197 checks green (Appendix B, M4).

### F2 — The backup has never been restored, and the documented restore would misfire (High)

- ✅ **Closed 23 Sep 2026, `PrivateBackup` PR #1.** The dump now covers `public` and `private`
  and keeps privileges; the run checks its own table of contents for the function and the 46
  policies; the README is a runbook written from a rehearsal of both dump formats against a
  local Postgres 17 imitating the live roles and grants. The rehearsal confirmed this finding
  and sharpened it: the documented command also destroyed the **default privileges**, so even
  re-granting the schema would not have covered the next table created; a data-only restore
  fails in alphabetical order and needs the tables in dependency order; and on a fresh project
  one policy of 46 survives (the one that checks `auth.uid()` directly). Details, and the list
  of what was not rehearsed, are in `PrivateBackup/README.md`.
- `PrivateBackup/.github/workflows/backup-supabase.yml:59-61`: `--schema=public --format=custom
  --no-owner --no-privileges`. `PrivateBackup/README.md:33`: `pg_restore --clean --if-exists
  --no-owner --no-privileges`.
- The latest dump's table of contents (custom format 1.16, data sections compressed, 0 readable
  recipe tokens) contains `DROP SCHEMA public;`, `CREATE SCHEMA public;`, 13 `CREATE TABLE`,
  46 `CREATE POLICY` (45 referencing `private.household_ids_for_user()`), 0 `CREATE FUNCTION`,
  and one `REFERENCES auth.users(id)`.
- Live project today: `public` is owned by `pg_database_owner` with `USAGE` granted to `anon`,
  `authenticated` and `service_role`; `private` grants `USAGE` to `authenticated`. A schema
  recreated by a `--no-privileges` restore carries neither, so the API roles lose access to
  every table until re-granted — the app shows a login screen it cannot get past.
- On a fresh project the 45 policies fail (no function), the membership row fails (no such
  user), and the Edge Functions, bucket and objects have to be recreated by hand.
- No document records a restore ever being tried. `docs/HANDOVER.md` §5 verifies that the
  backup *runs*.
- Contradicts: `docs/INFRASTRUCTURE.md` §2 and `docs/HANDOVER.md` §5 in effect ("Full restore
  instructions are in `PrivateBackup/README.md`" — instructions exist; they have not been run).
- Also from the same inspection: `pg_restore` 16 cannot read the dump ("unsupported version"),
  exactly as the README warns; a rehearsal needs a Postgres 17 client and server.

### F3 — Recipe photos are backed up nowhere (Medium)

- ✅ **Closed 23 Sep 2026, `PrivateBackup` PR #1**, with one caveat. `backup-photos.yml` mirrors
  the bucket weekly into `photos/recipe-images/` at the bucket's own paths, checking each
  download's size and MD5 against `storage.objects`; `scripts/restore-photos.sh` puts them back.
  The caveat: the workflow could not be started from its branch (GitHub dispatches only workflows
  on the default branch) and the session had no route to the bucket, so its **first run is the
  one after the merge** — run it from the Actions tab and check the manifest lists 30 objects.
- 30 objects in `recipe-images`, 30 of 30 recipes with an image self-hosted, 0 disagreements
  between `image_url` and the `IMAGE:` line (verified by the `docs/IMAGES.md` §7 query).
- The dump covers `public` only; `storage.objects` and the bytes are not in it. The re-host
  rewrote every `IMAGE:` line to the bucket URL, so the original address is gone from the
  recipe; `SOURCE_URL` still points at the page and `find-recipe-image` could rediscover most of
  them, one at a time, if the sites still serve them.
- About 4.4 MB in total; a weekly job in the private repo could fetch each `image_url` (the
  bucket is public and the dump already holds the URLs) and commit only what changed.

### F4 — The deployed `rehost-images` does not match the source in the repo (Medium)

- ✅ **Closed 23 Sep 2026, PR #11**, in substance: the repo carries all six hunks. The deployed
  copy is still v8 and differs in comment wording only; the next deploy from the repo makes the
  two identical. *(Ticked 24 Sep, after checking both copies again; PR #11 did not tick it.)*
  **Closed in full 25 Sep:** the household redeployed from the repo (v10), and the running copy
  matches `main` but for the trailing newline the dashboard editor drops.
- Deployed v8 (updated 2026-09-22 16:42 UTC) was read through the connector and diffed against
  `supabase/functions/rehost-images/index.ts` (last committed 2026-09-22 17:09 UTC, in
  `bcd1362`, whose message says the function was deployed ahead of the commit). Six hunks,
  none of them committed on any branch (Appendix D): two header-comment rewrites, where the
  deployed comment is the accurate one (it describes the save-time call and the `recipeId`
  option; the repo's still says "WHY A SWEEP, NOT THE SAVE PATH"), and four one-token additions
  of `id: r.id` to the rows of the `{"verify": true}` report. Behaviour differs only in that
  extra field, which nothing in the app reads; the checker `test/image-integrity.js` lifts lies
  outside all six hunks, so the suite passes identically with either source — by construction it
  reads the repo, never the deployment.
- `find-recipe-image` v4 (updated 14:05 UTC) is byte-identical to the repo (same md5).
- Contradicts: `docs/INFRASTRUCTURE.md` §3 ("both with source in this repo"), which also
  warns that "the two can drift, and have" — they are drifted now, and the deployed copy is the
  better one. `test/image-integrity.js` pins the repo copy, not what runs.

### F5 — "The text is the source of truth" is enforced for two of eight header fields (Medium)

- ✅ **Closed 24 Sep 2026, PR #14.** One function now writes all eight header lines from the
  form on every save: an existing line is rewritten in place, a missing one is inserted in the
  converter's order, an empty value removes the line. Nine smoke checks assert on the pushed
  row, one per field plus the order and a re-parse. The drift query is in `docs/TEST-PLAN.md`.
  The count below was two recipes; the review's query never compared `TAGS:`, and that line
  disagreed with its column on two more (one of them the servings recipe), so it was three. The
  three are re-saved through the app after the merge, which is also the feature's only
  real-backend run — the query then reads 0 on every column.
- The save handler reconciles `TITLE:` and `IMAGE:` into the syntax (`index.html:6815`) and
  writes `source`, `source_url`, `time_text`, `servings`, `equipment` and `tags` to columns from
  the form without touching the corresponding lines. The source-alias prompt (`:6772`) renames
  the column and never the line.
- Live database: 34 recipes; 1 whose `SOURCE:` line differs from its `source` column; 1 with a
  `servings` column and no `SERVINGS:` line; 0 drift on title, image, URL, time or equipment.
- The card, the planner and the shopping list's scaling read the columns; the viewer parses the
  text; `parseAndPreview` (`:6653`) refills the form from the text on the next edit, so the
  disagreement heals towards the text.
- Contradicts: `docs/ARCHITECTURE.md` §2 ("Everything else about a recipe … is derived from
  that text by parsing it").

### F6 — No CI, no branch protection, deploy on push (Medium)

- ✅ **Closed 23 Sep 2026, PR #11.** `.github/workflows/tests.yml` runs on every pull request
  and push to `main`; `main` is protected (checked 24 Sep; whether the check is *required* is
  a setting the API used could not read). *(Ticked 24 Sep; PR #11 did not tick it.)*
- The app repo has no `.github` directory; its only workflow is GitHub's own `pages build and
  deployment`, which has run once per commit to `main` (runs 18–26 cover PRs #1–#9). `main` is
  not protected. So a mistaken push deploys to the tablet within a minute, and the 197 checks
  run only when someone remembers.
- `docs/HANDOVER.md` §2c records a day on which the documented test command exited 1 and
  nobody noticed. A workflow would have.

### F7 — Three load-bearing mechanisms have no test; two mutations are caught only by a crash (Medium)

- ✅ **Closed in two parts.** Printing as the run goes and naming a crash: PR #11, 23 Sep. The
  three missing checks: PR #14, 24 Sep — the stub now records a delete's filters, so "deletes
  exactly the rows not in the list" is asserted on what was sent; the `TITLE:` line is one of
  the nine header checks; a merge across a gap is asserted on the preview's error text. M4, M5
  and M6 were re-run against the new checks and each fails by name (PR #14's description has
  the runs). Not changed: the two checks weak by construction, which PR 6 rewrites anyway.
  *(Both strengthened in PR 6b: the Friday-bucket check now needs two buckets to pass, and the
  tick checks start from a ticked count above zero.)*
  Found on the way: the fixture used the real clock, so two shopping-list checks failed every
  Thursday; the harness now runs on one fixed date (`test/fixture-time.js`).
- Appendix B. Not caught: `pushList`'s delete (M4); `withUpdatedTitleLine` returning its input
  unchanged (M5); the non-adjacent-merge error in `computeColumns` (M6, `index.html:2300`), the
  rule `CLAUDE.md` calls load-bearing. Caught by a timeout crash rather than a named failure:
  the tick cascade (M7) and the servings guard (M8) — because `test/smoke.js` prints every result
  at the end, a crash reports nothing, and the two mutations broke a later step's precondition.
- Redundant guard: removing `refreshLibrary`'s early stand-down (M2) leaves "a refresh stands
  down while a save has failed" green because the apply-time veto (`shouldApply`, `:7199`) also
  checks `unsentLabels`. Not a vacuous check — a doubly guarded one; the early return saves a
  fetch and is clearer, so keep it, but know the check does not prove it.
- Weak by construction: `every bucket after the first opens on Friday` (`test/smoke.js:388`) is
  true of an empty list, so it passes on a one-bucket planner; `ticks survive a rescale` (`:491`)
  compares two counts that are both 0 if the click before it failed.

### F8 — Access control rests on one grant; hygiene items (Low)

- All 46 policies are `TO public`; `anon` and `authenticated` hold `DELETE, INSERT, REFERENCES,
  SELECT, TRIGGER, TRUNCATE, UPDATE` on all 13 tables. An anonymous request is refused because
  `private.household_ids_for_user()` is executable by `authenticated` only (verified with
  `has_function_privilege`). Correct, and one grant away from not being.
- Supabase's security advisor: leaked-password protection is disabled.
- Two accounts in `auth.users`: the household's (created 13 Sep, signed in 23 Sep) and one
  created 22 Sep, never signed in, unconfirmed, in no household. Whether it is the household's
  own test could not be told from here; whether public sign-up is enabled could not be checked.
- No insert policy on `household_members` or `households`: joining is a dashboard SQL
  statement. Fine for family; undocumented.
- `hydrate()` reads one membership (`index.html:2833`).

### F9 — supabase-js is loaded unpinned (Low)

- ✅ **Closed 23 Sep 2026, PR #11.** Pinned to 2.117.1. *(Ticked 24 Sep.)*
- `index.html:13` loads `@supabase/supabase-js@2` from jsdelivr: every page load takes the
  newest 2.x. `docs/HANDOVER.md` §2e depends on a behaviour verified in auth-js 2.117.0. The
  html2canvas tag (`:12`) is pinned to 1.4.1.

### F10 — Specific claims the code, database or GitHub do not bear out (Low)

- ✅ **Closed 23 Sep 2026, PR #11**, for everything a newcomer would act on. Left as dated
  figures then, corrected by PR #14: the storage counts in `docs/INFRASTRUCTURE.md` §3 and
  `docs/HANDOVER.md` §1. The test plan's count block still lists the 20 Sep numbers because the
  document says to re-read them before every pass. *(Ticked 24 Sep.)*
- Appendix C lists each with what was checked. The ones a newcomer would act on wrongly:
  `README.md` ("mid-migration … has not been merged"; "102 checks"), `docs/INFRASTRUCTURE.md`
  §1–§2 and §5 (the working branch "ahead of `main` and unmerged"; clone that branch),
  `docs/ARCHITECTURE.md` §4 (household id a constant), `docs/NEXT-SESSION.md` (the conversion
  prompt "needs no edits"; the session prompt naming the old branch),
  `docs/DOCUMENT-INDEX.md` (a 157-check suite; "Nothing in it has been implemented").

### F11 — Deleting a recipe leaves references behind (Low)

- ✅ **Closed 24 Sep 2026, PR #15.** `deleteRecipe` rewrites each plan day that held the recipe
  (servings kept in lockstep, the day cleared if it held nothing else), dissolves a group left
  with one recipe, and removes the shortlist entry for it — each as its own row write, asserted
  by three checks. The 7 days and 1 group already dangling are not touched by this; they render
  as "Recipe removed" until the household clears them.
- 7 of 18 planner days and 1 of 4 meal groups hold ids of deleted recipes (from the 20 Sep
  ingestion; `docs/HANDOVER.md` §3 said 8 and 2). The delete handler leaves them "on purpose"
  (`index.html:4633`) so nothing looks unplanned; they render as "Recipe removed". Reasonable
  once; a delete that also removes the id from plan days and groups (and dissolves a group left
  with one recipe) would stop the count growing, at no schema cost.

### F12 — The ingredient review measured itself against its own output (Info)

- `docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md` §1 and §7: the answer key was built from the
  converted lines; rows, names and false merges are all scored against it; nothing compares a
  converted line with the source's line. A substituted product that lands on the right
  dictionary entry counts as a success. Its "Limits" section does not list this. Confirmed by
  reading, after §4 of this document was written.

### F13 — The diary's writes have not run against the real backend (Info)

- `recipe_logs`: 115 rows, 0 with a meal type, 0 ad-hoc entries. H1–H3 shipped 22 Sep;
  `docs/HANDOVER.md` §2c says their writes "have not been through" the browser pass. Still true.

### F14 — The MERGE-line count in the record is right (Info, recorded because it was checked)

- 253 `MERGE` lines across 34 recipes, 245 with a trailing bracket; the 8 without are the one
  recipe deliberately left unconverted. 185 `GROUP` lines, 243 `STAGE` lines, 0 group handles
  with characters the parser would reject. `docs/HANDOVER.md` §1 C3 ("242 of 242" over 32
  recipes on 20 Sep) plus the two recipes added since is consistent with this.

---

## 3. Recommendations

### Change now — small, no data at risk, high value

1. **Make the backup restorable, then prove it.** Add `--schema=private` to the dump so the
   helper function travels with the policies that need it. Replace the README's same-project
   restore with a rehearsed sequence that does not drop the schema (restore into a scratch
   schema, or `--data-only` after truncation, or keep `--clean` and follow it with the schema
   grants — whichever the rehearsal shows works). Rehearse against a local Postgres 17 in Docker,
   from the latest dump, and write the fresh-project steps down (create the user, fix the
   membership row's `user_id`, recreate the bucket and functions). Record the date of the
   rehearsal in `docs/HANDOVER.md` §5. (F2) *✅ Done 23 Sep, `PrivateBackup` PR #1.*
2. **Back up the photos.** A weekly step in the private repo that fetches every `image_url` and
   commits changed objects only. (F3) *✅ Done 23 Sep, `PrivateBackup` PR #1; first run after
   the merge.*
3. **Add a workflow that runs `node test/build.js && node test/smoke.js` and
   `node test/image-integrity.js` on every pull request, and require it on `main`.** (F6) *✅ Done 23 Sep, PR #11.*
4. **Pin supabase-js to an exact version.** (F9) *✅ Done 23 Sep, PR #11.*
5. **Bring the deployed `rehost-images` and the repo copy back into step** — commit the deployed
   source or redeploy the repo's — and add one line to `docs/IMAGES.md`: a deploy is a commit.
   (F4) *✅ Done 23 Sep, PR #11; deployed copy differs in comments only until the next deploy.*
6. **Reconcile every header line on save**, generalising `withUpdatedTitleLine` /
   `withUpdatedImageLine` to `SOURCE`, `SOURCE_URL`, `TIME`, `SERVINGS`, `EQUIPMENT` and `TAGS`;
   re-save the two drifted recipes; add the drift query from F5 to `docs/TEST-PLAN.md`'s count
   block; add a smoke check that mutates one header field and asserts on the pushed row. (F5) *✅ Done 24 Sep, PR #14.*
7. **Add the three missing checks** — `pushList` deletes exactly the rows not in the list;
   the `TITLE:` line follows the form; a non-adjacent merge produces an error the preview shows —
   and make `test/smoke.js` print results as it goes, or wrap each block, so a crash names the
   check it was in. (F7) *✅ Done: printing in PR #11, the three checks in PR #14.*
8. **Correct the record** per Appendix C, in place, saying so — the repo's own convention.
   (F10) *✅ Done 23 Sep, PR #11.*

### Change before sharing with family

9. **Row-scoped writes.** `saveRecipe(recipe)` upserts one row; `deleteRecipe(id)` deletes one
   row explicitly; the same for one plan day, one group, one shortlist item, one alias, one
   swap, one tick. Whole-table replace stays for import only. The tests already assert on what
   is *sent* (`window.__WRITES__`), so each change can be pinned. Keep the refresh and its four
   rules unchanged. (F1) *✅ Done 24 Sep, PR #15.*
10. **Write the onboarding runbook**: create the account, insert the `household_members` row,
    what the person sees if it is missing. Decide whether public sign-up should be on and set it
    accordingly. Enable leaked-password protection. (F8)
11. **Belt and braces on RLS**: `revoke all on all tables in schema public from anon`, and
    restrict the policies to `authenticated`; the app never reads data before sign-in and the
    functions use the service role. (F8)
12. **The real-backend test** from Answer 5: test household, test user, Playwright against the
    live app, weekly from the private repo. (F13)
13. **The JSON-LD Edge Function** from Answer 4, used first by the preview's source check and
    then by anyone who wants a plain recipe without a converter. The model-backed function only
    if the family actually adds recipes, with the key in Supabase secrets, a membership check
    and a daily cap.
14. **Clean up on delete** — remove the id from plan days and groups. (F11) *✅ Done 24 Sep, PR #15.*

### Leave alone, and why

- **The syntax as the source of truth, with no structured copy.** Nothing needs the copy; the
  text is the interchange format. (Answer 1)
- **The cache-plus-queue pattern, the refresh on visibility and its four rules.** Right, and
  tested; after item 9 they are the second line of defence rather than the only one. (Answer 3)
- **`hydrate()` throwing meaning sign-out.** The network branch is correct; the remaining throws
  are truthful. (Answer 3)
- **The parallel arrays in `planner_days` and `meal_groups` without a foreign key.** Working,
  tested for lockstep, 0 mismatches; item 14 removes the only symptom. A `planner_entries`
  table would be a migration for tidiness. (Answer 1)
- **The public bucket.** The reasoning in `docs/IMAGES.md` (signed URLs rot inside backups)
  holds. (Answer 7)
- **The Edge Functions' authentication and CORS design.** `verify_jwt`, `getUser`, the
  membership filter that only narrows, and an origin allowlist: sound. (Answer 4)
- **One deployable file.** Extract the pure logic when the shopping-list release rewrites it,
  not before. (Answer 6) *Done as planned, 25 Sep, PR #18 (6a): `core.js`, just ahead of the
  release that rewrites it.*
- **`shopping_checked.item_key`** until the shopping-list release re-keys it anyway. (Answer 1)
  *Re-keyed in PR 6b, to the ingredient's name alone. No display label is stored beside it: the
  row's name is derived at list time from the dictionary or the recipes' wording, so the key can
  stay a readable name rather than become opaque. The old `name|unit` rows are deleted at
  start-up.*
- **Daily backups at 04:00 UTC, 30 in the tree, all in history.** Right cadence for this data.
- **`index-old.html`.** Referenced once, honestly, in `docs/ARCHITECTURE.md`; harmless.
- **The free tier.** Nothing here is near a limit.

---

## 4. Question 2: before and after reading the ingredient review

### Written before (verbatim from the working notes, 23 Sep)

Read at that point: `index.html` (the parser, `splitQty`, scaling, `buildShoppingList`, the
normaliser, the aliases, `parseAndPreview` and the save handler), the converter files, the
brief, `CLAUDE.md`, `ARCHITECTURE.md`, `HANDOVER.md` (whose SL2 row mentions "274 rows for 168
real items" and that the household chose the review's plan), and two SQL checks. Not read:
`REVIEW-INGREDIENT-MATCHING.md`, `REVIEW-INGREDIENT-MATCHING-FINDINGS.md`, `NEXT-SESSION.md`.

> **Where a recipe can change without anyone seeing.** Stage 1, source → converter: everything
> can change and nothing downstream can tell, because the source is not carried along; the
> converter's "Check" step is the same model reviewing itself. Stage 2, paste → `parseRecipe`:
> unrecognised lines are dropped silently; a `GROUP` handle with a hyphen puts its ingredients
> into the previous group; a malformed `MERGE` arrow vanishes; `computeColumns` reports only
> unknown handles and non-adjacent merges. Stage 3, parse → form → save: only `TITLE:` and
> `IMAGE:` are written back, so columns and text disagree (1 source, 1 servings in the live
> database). Stage 4, later rewrites: the re-host is safe; permanent scaling leaves unparsed
> lines unscaled silently; viewer scaling is display-only. Stage 5, the shopping list: nothing
> here changes the recipe; a wrong alias is visible and reversible; a missed merge is harmless.
> This is the only stage where a naming mistake is visible, local and reversible.
>
> **Is asking a model to rename ever safe?** Only for strict synonyms, and even then the
> original wording should survive. Not for rules that settle an ambiguity ("soy sauce" means
> light; "oil" means vegetable; bare "coriander" means the leaf): a model told to canonicalise
> will canonicalise the cases the rule was not written for — the Italian seasoning case.
> "Rename, never replace" cannot be enforced on a model; it can be enforced by a program that
> checks the output against the source. The converter should own the shape of a line and keep
> the source's product words in British English; naming for totals should live in the app, at
> list time, via a dictionary plus the alias table.
>
> **Cost ranking.** Rewritten recipe ≫ wrong merge > missed merge. The design does not rank
> them that way: it asks the invisible, permanent stage to reduce the cheapest fault, and
> measures success as rows on the list, which cannot see a substitution.
>
> **Deterministic alternative.** JSON-LD carries name, image, yield, times, ingredient strings
> and instructions; all 12 source hosts in the library are mainstream sites likely to embed it
> (unverified from here). Judgement is needed for grouping, staging, late additions, splits,
> unstated durations, cup-to-gram conversions and tin sizes. Concretely: extract the JSON-LD by
> code, hand the model the strings as data, require every source ingredient to be carried
> through so a program can check each maps to one converted line and shares a content word with
> it; run that check in `validate-recipes.js` and the preview.
>
> **The preview.** Today it shows the converter's output and the source not at all, so a
> substitution is invisible by construction. It needs the source ingredient list beside the
> converted lines, matched one to one, quantities beside quantities, misses highlighted; the
> source lines reach the app either from the converter or from an Edge Function reading the
> JSON-LD at `SOURCE_URL` — the second is independent of the model, which is the point. And the
> parser should report the lines it drops.

### After reading "Answers first" and §4

**Agree:** the standard line shape at conversion; an app-side dictionary with aisles; one row per
ingredient; ticks keyed by name; fix the quantity reader first (done, PR #9); no AI in the
list. All measured; all sound.

**Disagree, with the review's own numbers:**

1. "The converter is already an AI, so judgement belongs there" (§4.1). The review's table in §3
   shows app-side rules alone take 280 rows to 228 and the app-side dictionary to 205; the 11
   splits left are fixed by rewriting 24 lines, and every one of those 24 is a shape fault, not
   a naming fault. The converter's vocabulary renaming therefore buys nothing the app's
   dictionary does not, and it is the one step whose mistake is invisible and permanent.
2. The measure. Rows, names and false merges are scored against an answer key built from the
   converted lines (§1, §7); nothing scores fidelity to the source. That is the gap the
   architecture brief describes, and it is not in the review's limits.
3. Test 8 in `converter/test-set.md` — "ingredients the list has never seen" — checks names
   against a list its author wrote; it cannot see a swap. Only a mechanical comparison with the
   source can.
4. §4.2's wording is right on shape and on the words that change what you buy. The line to cut
   is "spelled exactly as in `ingredient-names.md` when the ingredient is on it". Keep the list
   as the app's dictionary, which the review already plans to make the master copy.

**Keep from the plan unchanged:** steps 4 to 8. **Add:** the source-fidelity check, in the
preview and in `validate-recipes.js`, before any bulk re-conversion.

---

## 5. What this review did not cover, and could not verify

- **Live requests as the app makes them.** No outbound access from the sandbox to the project's
  REST, Auth, Storage or Functions endpoints (the proxy refused the tunnel), so RLS was verified
  by reading policies, grants and the helper function's definition — not by trying an anonymous
  request. The `curl` probes to run from a normal machine are simple: an anonymous `select` on
  `recipes` (expect an error, not rows), a `POST` to `rehost-images` with no token (expect 401),
  and `GET /auth/v1/settings` (tells you whether sign-up is open).
- **A restore rehearsal.** The sandbox's `pg_restore` is version 16 and the dump needs 17; the
  Postgres apt repository was unreachable. F2 rests on the dump's table of contents and the
  live grants, which is strong, but it is a prediction until someone runs it.
- **JSON-LD on the 12 source sites.** Not fetched. The claim that most embed it is general
  knowledge, not a measurement.
- **The converter itself.** No access to the claude.ai project; nothing was converted.
- **The tablet.** Keep Awake, the sidebar at arm's length, contrast in a real kitchen.
- **The Edge Functions' behaviour at runtime.** Only their source was read and diffed
  (Appendix D); nothing was invoked.
- **The second auth account's origin, and the sign-up setting.**
- **PNG export** (html2canvas is stubbed in the harness) and anything else the harness stubs;
  this review did not run `docs/TEST-PLAN.md` or `docs/TEST-IMAGES.md`.
- **Whether GitHub Pages is configured from `main` at the root**, other than by the deployment
  runs, which show one per commit to `main`.
- **Supabase free-tier behaviour** (pausing after inactivity) — not relevant while the app is
  used daily; not checked.
- **`P3`, the calendar push** — not started, not reviewed.

---

## Appendix A — What was verified, and how

| Claim | How |
| --- | --- |
| 197 checks pass, exit 0 | `node test/build.js && PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/smoke.js`; 31 integrity checks likewise |
| Schema, policies, grants, constraints, indexes, function definition and privileges | Supabase connector: `pg_policies`, `pg_class`, `information_schema`, `pg_proc`, `pg_namespace`, `has_function_privilege` |
| Row counts and structural queries (drift, MERGE timing, dangling ids, ticks, accounts) | Supabase connector; aggregates only, no content read |
| Deployed Edge Function source and versions | Supabase connector (`list_edge_functions`, `get_edge_function`) |
| Migrations | `supabase_migrations.schema_migrations` — 13, matching `docs/INFRASTRUCTURE.md` §3 |
| Advisors | Supabase security and performance advisors |
| Pages deployments, backup runs, PRs, branches, protection | GitHub API: 26 Pages runs (18–26 one per `main` commit since 13 Sep), 13 backup runs, PRs #1–#10, 4 branches, `main` unprotected |
| Backup dump contents | `strings` over the custom-format TOC of `kitchen-2026-09-23T04-07-23Z.dump`; 0 readable recipe tokens (data compressed); `pg_restore --list` refused the version |
| Document claims | Each compared with `main`, the database or the GitHub API — Appendix C |

## Appendix B — Mutation results

Each mutation was applied to `index.html`, the suite rebuilt and run, and the file restored;
the working tree was clean afterwards.

| # | Mutation | Result |
| --- | --- | --- |
| M1 | `refreshLibrary` no longer waits for the write queue | **Caught**: "a refresh waits for queued saves before reading" |
| M2 | `refreshLibrary`'s early stand-down on unsent changes removed | **Not caught** — 197 green; the apply-time veto also checks `unsentLabels`, so the behaviour survives with one guard |
| M3 | `shouldApply` veto always true | **Caught**: "a refresh is discarded if anything changed while it was fetching" and "so the change made mid-fetch is kept" |
| M4 | `pushList` never deletes absent rows | **Not caught** — 197 green |
| M5 | `withUpdatedTitleLine` returns its input unchanged | **Not caught** — 197 green |
| M6 | non-adjacent-merge error dropped from `computeColumns` | **Not caught** — 197 green |
| M7 | tick cascade to earlier cells removed | **Crash**: the meal-type prompt never appears (the last column is no longer all ticked), `page.click` times out, no results printed |
| M8 | servings no longer required on save | **Crash**: the guard-test recipe saves and closes the modal, the next `page.fill` finds no textarea, no results printed |

## Appendix C — Corrections to the record

| Document says | Actually | Checked how |
| --- | --- | --- |
| `README.md`: "mid-migration … `main` still holds the older browser-storage version" | `main` is the Supabase app and production; nine PRs merged | `git log origin/main`; Pages runs |
| `README.md`, `docs/TEST-PLAN.md` context: 102 checks | 197 | run |
| `docs/DOCUMENT-INDEX.md`: "the 157-check test suite" | 197 | run |
| `docs/DOCUMENT-INDEX.md`, on the ingredient findings: "Nothing in it has been implemented" | Step 1 merged as PR #9 (23 Sep); step 3 on PR #10 | GitHub PRs |
| `docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md` status: step 1 "not yet on `main`" | Merged 16:51 UTC, 23 Sep | PR #9 |
| `docs/INFRASTRUCTURE.md` §1–§2, `docs/HANDOVER.md` top: the shared working branch, "ahead of `main` and unmerged" | Fully merged; `main` is ahead of it | `git log`; branch list |
| `docs/INFRASTRUCTURE.md` §5: clone `claude/recipe-app-supabase-0z139o` | Clone `main` | as above |
| `docs/INFRASTRUCTURE.md` §3: both Edge Functions "with source in this repo" | `rehost-images` v8 differs from the repo (F4) | connector |
| `docs/ARCHITECTURE.md` §4: the household id "is a constant in `index.html`" | Resolved at sign-in from `household_members` (`index.html:2833`) — the brief's known example | code |
| `docs/ARCHITECTURE.md` §3: "about 7,078 lines" | 7,263 | `wc` |
| `docs/ARCHITECTURE.md` §4, `docs/INFRASTRUCTURE.md` §3, `docs/HANDOVER.md` §2: 29 objects, 29 images | 30 and 30; 34 recipes, 4 without an image | connector |
| `docs/NEXT-SESSION.md`: the conversion prompt "unchanged … needs no edits" | Revised 23 Sep (standard line, vocabulary) | `converter/conversion-instructions.md` |
| `docs/NEXT-SESSION.md` prompt: work "on branch `claude/recipe-app-supabase-0z139o`" | Stale | as above |
| `docs/HANDOVER.md` §1 SL2: step 1 "built on a branch" | Merged to `main` the same day | PR #9 |
| `docs/HANDOVER.md` §3: "8 planner slots and 2 meal groups" point at deleted recipes | 7 days and 1 group today | connector |
| `docs/TEST-PLAN.md` counts: 33 recipes, 47 keywords, 3 shortlist, 7 word matches | 34, 48, 4, 17 (18 days, 4 groups, 9 ticks, 1 swap unchanged); the document says to re-read them | connector |
| `docs/HANDOVER.md` §5: "Two real dumps are committed" | 12, 81–88 kB, 12 of 13 runs successful | private repo; Actions |

## Appendix D — Deployed Edge Functions against the repo

Both deployed sources were fetched through the connector, transcribed by decoding the returned
JSON in code (not by hand), spot-checked line by line against the raw result, and diffed with
`diff -u` against the working tree, which matched the committed `HEAD` blobs.

| Function | Deployed | Repo | Result |
| --- | --- | --- | --- |
| `find-recipe-image` | v4, 357 lines, 17,338 bytes | 357 lines, 17,338 bytes | Identical (same md5) |
| `rehost-images` | v8, 452 lines, 22,869 bytes | 453 lines, 22,860 bytes | Six hunks |

The six hunks in `rehost-images`, repo → deployed:

1. Header comment, lines 8–11: "WHY A SWEEP, NOT THE SAVE PATH …" becomes "WHY A SWEEP AS WELL
   AS A SAVE-TIME CALL: the app now asks for one recipe immediately after saving it
   (docs/IMAGES.md §5 Option A) …". Comment only; the deployed text is the true one.
2. Header comment, lines 22–24: the "Call with …" sentence becomes "Body options: {"dryRun":
   true} … {"verify": true} … {"recipeId": "..."} to do one recipe". Comment only.
3. Verify mode, the "not self-hosted" row: `{ title: r.title, problem: … }` gains `id: r.id`.
4. Verify mode, the "stored object returned <status>" row: gains `id: r.id`.
5. Verify mode, the integrity-failure row: gains `id: r.id`.
6. Verify mode, the catch-block row: gains `id: r.id`.

`git log --all -S` for each deployed-only string finds no commit on any branch: v8 was deployed
from an uncommitted working copy at 16:42 UTC on 22 Sep, and the commit that followed at 17:09
captured the `recipeId` code but not these edits. The Settings verify button reads only `broken`,
`whole`, `checked` and `title` from the response, so the extra `id` changes nothing on screen;
it is useful to someone following the console runbook in `docs/IMAGES.md`.
