# Session handover — 29 Sep 2026: the add-recipe plan, PRs 1 to 5 done, PR 6 waiting for a "go"

**Written 29 Sep 2026, 17:30 UTC**, at the end of a long working session, for whoever picks it up next.
Everything below was read from GitHub, the live database or a test run during that session, unless it
says *not verified*. It contains counts and neutral facts only: no recipe lines, no word matches (this
repo is public).

---

## 0. Read this first

1. **One SQL statement is waiting for the household, and the app is running without it.** PR #45 merged
   at 17:12 UTC, but `recipes.source_check` **does not exist** on the live database (read-only checks at
   17:19 and 17:29 UTC). See §2. Until it is applied, a save that carries a source comparison, including
   an Add with an `https` link, is likely to fail.
2. **Nothing is half-done in the repo.** `main` is at `9c4b6f7` (PR #45's merge). No PR is open. Both suites
   were green on it. The working branch `claude/affectionate-ptolemy-5ka7pj` holds only this document on top
   of `main`.
3. **PR 6 (aisle overrides) is planned but not started.** The plan was put to the household and is waiting
   for their "go" (§5). Nothing for it has been changed, and no schema has been touched.

---

## 1. Where the plan stands

`docs/PLAN-NEW-RECIPE-FLOW.md` is the plan; its §8 has each PR's entry, and each merged PR has a "Built as"
note recording where the code differs from the text. `docs/HANDOVER.md` §7 has one entry per PR saying what
was verified and how.

| PR | What | Merged (29 Sep, UTC) | Merge commit |
| --- | --- | --- | --- |
| 1 · #41 | Two naming fixes in `core.js` (`tinned` folded into `canned`; the "a big handful of" reading) | 10:48 | — |
| 2 · #42 | The converter's rule for a page it cannot read (docs only) | 12:25 | `c052b4c` |
| 3 · #43 | The read-only review band: paste parses, stale bar, source check runs by itself, source-note row, shopping-list review, duplicate check | 14:15 | `c914792` |
| 4 · #44 | Answers in place, no dialog left: SAME / KEEP APART, the row under SOURCE, UNDO, BEFORE YOU SAVE | 16:02 | `eee0f43` |
| 5 · #45 | The comparison recorded on the recipe (`source_check`), the viewer chip, Edit's stored result | 17:12 | `9c4b6f7` |
| 6 | Aisle overrides (a new table, Settings block, the review's aisle select) | not started | |
| 7 | Settings: ingredient lookup, dictionary list, Swaps subtitle | not started | |
| 8 | LIBRARY CHECK in Settings | not started | |

**On `main` now:** `node test/core.test.js` **133** checks, `node test/smoke.js` **329** checks;
`core.js` is `2026-09-29.5`. Baseline run on `9c4b6f7` before any PR 6 work: core exit 0, `build.js` exit 0,
smoke exit 0, no console or page errors.

*Not read:* `main`'s own test and Pages-deploy runs after the merges of #43, #44 and #45 (only the PRs'
own CI, which was green each time). *Not verifiable from a session:* what the deployed site serves, because
the sandbox blocks `github.io`.

---

## 2. Urgent: `recipes.source_check` is missing from the live database

**Facts.** Read-only queries at 17:19 and 17:29 UTC, both through the Supabase connection:
`recipes` has **no** `source_check` column and there is no `aisle_overrides` table; 34 recipes, 0 ticks, 14 word
matches; the last migration is `20260928123928`.

**Why it matters.** PR #45 was written to work before the column exists *only for saves that carry no
comparison* (`recipeToRow` leaves the key out when a recipe has none). But:

- the source check now runs by itself when a recipe with an `https` link is parsed, and SAVE records what
  it found, so **adding a recipe from a link will send `source_check`, and that write will fail**;
- the write queue resends a failed write ahead of the next one, so a failed save can stall the ones behind it;
- ordinary saves, favourites, planning and the shopping list are unaffected.

**What to do (the household; a session must not, per `CLAUDE.md`).** Paste this into the Supabase SQL editor:

```sql
alter table public.recipes add column source_check jsonb;
```

It is nullable with no default, so it changes no existing row and the pre-merge app never mentions it.
`docs/migrations/add-recipes-source-check.md` has the check and the undo; `docs/INFRASTRUCTURE.md` lists it as
waiting. **Until it is applied, avoid saving a recipe after a comparison, and avoid adding a recipe from a link.**

**For the next session.** Re-run this read-only before anything else:

```sql
select count(*) from information_schema.columns
 where table_schema='public' and table_name='recipes' and column_name='source_check';   -- 1 when applied
```

If it returns 1, add the migration to the list in `docs/INFRASTRUCTURE.md` ("Migration history") with the
version the dashboard gave it, and remove the "waiting" note. Then `docs/TEST-PLAN.md` step 36f can be done.

**The lesson for PR 6, which adds a table.** A merge can arrive before its SQL. PR 6's design therefore
must not let a missing table sign the household out (§5, first judgement call).

---

## 3. Decisions outstanding (the household's)

None blocks reading or planning; the first two shape the next PRs.

| # | Decision | Context | My recommendation |
| --- | --- | --- | --- |
| D1 | **Should Edit run the source check by itself when it opens a recipe with no fresh stored result?** | Plan §5 reads as though it should. PR 5 does not: it shows the stored result (fresh, out of date, or none) with RE-CHECK. Running it on opening would fetch the source page for every recipe opened until each has been compared and saved once (all 34 to begin with), and would reverse a PR 3 check ("opening it fetches nothing"). | Leave it. Compare and save each recipe once, deliberately; LIBRARY CHECK (PR 8) is the tool for working down the list. If wanted, it is a small follow-up. |
| D2 | **PR 6's five judgement calls** (§5) | Put to the household, unanswered. | As stated in §5. |
| D3 | Was PR 4's one changed check a §11 item 2 stop? | PR 3's `"Same as X?" is text only` asserted the review had no buttons, which PR 4 exists to change; it was amended by one clause and the previous suite was run unamended to show it was the only one (292 checks, 1 failed). PR 4 was merged with this stated in its description. | Treat as accepted by the merge. No action, unless the household says otherwise. |
| D4 | Plan §10 items 1 to 5 | (1) "enforced check point" read as: always present, runs itself, recorded, never blocks a save. (2) provenance as a column. (3) Swaps stay a view. (4) PR 1's Friday rule. (5) the reconstruction word list. Items 1, 2 and 4 are settled in practice (built and merged). | Confirm 1 in words if you want; nothing else needs saying. 3 and 5 stand as written. |
| D5 | Known limits accepted in PR 5 | The stored value has no URL, so changing the source link and saving without comparing again keeps a result about the old page. The keyword line in BEFORE YOU SAVE compares with the stored vocabulary, not `fullKeywordVocab` (the plan's wording), because that is what the save writes against. | Accept both. |
| D6 | Repairing the two reconstructed recipes | A data job, outside the PRs: re-convert from the real page's text, validate, then the md5-guarded `UPDATE` in `CLAUDE.md`, first recipe alone, household present, undo file in `PrivateBackup`. Needs converter test 9 (below) first. | When the household wants it; it is theirs to start. |

---

## 4. Tests outstanding

### 4a. Household passes, none yet done (from `docs/TEST-PLAN.md`)

| Step | For | Notes |
| --- | --- | --- |
| 36a, 36b, 36c | The seven-PR plan's 7d, 7e, 7f: the paste box, the comparison that found a fault, US names and the list they must not move | Older; listed as the household's in `docs/NEXT-SESSION.md`. |
| 36d | PR 3, the review band | Read-only; safe on real recipes. |
| 36e | PR 4, answers in place | **Writes** household rows: use a made-up recipe and undo in Settings → Word Matches. |
| 36f | PR 5, the recorded comparison | **Do it only after the SQL in §2 is applied.** Writes one recipe row per save. |
| Converter | After PR 2: reload `converter/conversion-instructions.md` into the conversion project and run test 9 of `converter/test-set.md` once in a fresh chat | Until then the converter behaves as before. |

### 4b. Never verified, because every suite stubs Supabase

- A real write of any of these to the real database: the word-match rows the add form now writes (`aliases`),
  and `source_check` (a real `jsonb` upsert, and `select('*')` returning it). RLS for the new column.
- A real paste on iPadOS or Android (tests use a synthetic `paste` event).
- The real `source-ingredients` function and real sites (tests use the stub).
- Whether the buttons, the chip and the BEFORE YOU SAVE list read clearly on the tablet.
- The exact error PostgREST returns for a table that does not exist (the sandbox's shell cannot reach the
  Supabase host, so it was not observed); relevant to PR 6.

### 4c. What PR 6 must test (planned, none written)

Node (`test/core.test.js`, about 5 new): an override wins over the dictionary and over the keyword fallback
(the proposal's check, mutation-tested by skipping the override in `aggregateShoppingLines`); `aisleOverrideMap`
folds names through `shoppingKeyForName` and ignores empty ones; **no key changes with an override applied**
(assert on the keys of every line before and after); `aisleWhy` reports `override`, `dictionary`, `keyword`
and `none` correctly.

Browser (`test/smoke.js`, about 12 new, asserted on `window.__WRITES__` where it says writes):
Settings ADD writes one `aisle_overrides` upsert (conflict on `household_id,name`) and the shopping-list row
moves aisle; REMOVE deletes by name and the row reverts; the review's aisle pick writes one override and
UNDO deletes it; **hydrate with the table missing does not sign out and marks the feature unavailable**
(needs a small switch in `test/stub.js` to make a table answer with an error); export carries `aisleOverrides`
and import restores it, and an older backup without it leaves existing overrides alone; a tick survives an
override; an invalid aisle is refused.

Mutations: skip the override; apply it before the alias; write on the wrong name; UNDO not deleting; a missing
table throwing; and one per check added. Expected counts: core about 138, smoke about 342.

Also re-measure, read-only, once built: today 169 shopping-list rows, **32 in Other**; overriding every one of
those must change **0** keys.

### 4d. How the tests were run, and what went wrong (so it need not be rediscovered)

- **Commands:** `node test/core.test.js`; `node test/build.js && node test/smoke.js` (set `PLAYWRIGHT_CHROMIUM`
  to the `chrome` under `/opt/pw-browsers/chromium-*/chrome-linux/` if Playwright cannot find a browser);
  `node tools/generate-ingredient-names.js --check`. Read `echo $?`. Both suites take about 2 to 3 minutes in all.
- **Mutation testing** (`CLAUDE.md` item 3) was done with a throw-away driver kept in scratch, not the repo: copy
  the known-good `index.html` / `core.js`, apply one text substitution at a time (asserting it matches exactly
  once), rebuild, run a **focused harness** (a temporary `test/_prN-only.js` generated from `test/smoke.js`: the
  boot code, the helper definitions, and only the new blocks, about 20 seconds a run), record which checks fail,
  and restore and `cmp` the file afterwards. Delete the harness before committing. Kill a background driver by
  PID, never `pkill -f` (it matched the shell itself once and left `index.html` mutated).
- **A check that passes without its fix proves nothing.** One did, in PR 4: `page.fill` moved focus and the blur
  fired a `change` that refreshed the list by accident. Send the event directly.
- **A surviving mutant is information.** In PR 5 one guard clause survived until a test for the one case only it
  covers was written.
- **Read your diff for private data mechanically:** compare every title, source, link, ingredient line and word
  match from a fresh export (kept in scratch, never committed) against the added lines. It found real library
  strings in new test data twice, and once in a documentation paragraph that named what had been found. **Do not
  name real strings in a document or a PR description**, even to say they were removed.
- **`.gitignore` excludes `*.sql` on purpose.** A migration goes in as a markdown page under `docs/migrations/`.
- **When a check you did not write fails,** that is a `docs/PLAN-NEW-RECIPE-FLOW.md` §11 item 2 stop. Twice a
  check written for an earlier PR asserted exactly what the next PR was meant to change; the way through was to
  run the previous suite unamended, show it was the only failure, amend it by the one clause, and say so
  prominently in the PR.

---

## 5. PR 6, as put to the household (awaiting "go")

**The five lines.**

1. *What changes.* A household-editable aisle for a shopping-list item. A new `aisle_overrides` table (one row per
   ingredient name and aisle, RLS `TO authenticated` like the other tables); a SHOPPING AISLES block in Settings
   with ADD and REMOVE; on the add form, an aisle `<select>` on a new name that lands in Other with no "Same as"
   pending, which writes the override at once and shows "Moved to Produce · UNDO"; in `core.js`, `aisleOverrideMap`,
   a third parameter on `aggregateShoppingLines`, and an `aisleWhy` field on each item. An override only ever
   replaces `category`, computed after `key` is final, so it cannot re-key a tick.
2. *Files.* `index.html`, `core.js` (`2026-09-29.6`), `test/core.test.js`, `test/smoke.js`, `test/stub.js`; new
   `docs/migrations/add-aisle-overrides.md`; the usual docs and counts.
3. *Must not touch.* `pushList`, `queueWrite`, `refreshLibrary`, the existing `replace*` functions, any Edge
   Function, `shoppingLine`, the dictionary. `hydrate` and `buildShoppingList` each get a small edit the proposal
   names (below). **A session does not apply the migration.**
4. *Expected numbers.* As §4c. Live: 169 rows, 32 in Other, 0 ticks, no table.
5. *Checks and mutations.* As §4c.

The design is `docs/PROPOSAL-AISLE-OVERRIDES.md` (its line numbers are stale; find the code by name) and
`docs/PLAN-NEW-RECIPE-FLOW.md` §5 (the review's select), §6 (Settings) and §7 (the change table).

**The five judgement calls to confirm at "go".**

1. **`hydrate` gets a tolerant load for the new table.** The proposal's plain change (add the table beside
   `aliases`) would throw if the table does not exist yet, and `CLAUDE.md` says an exception in `hydrate()`
   signs the user out with no way back. So: load it on its own; on any error other than a dead network, treat it
   as empty, mark the feature unavailable, and have Settings say so (and hide the review's select). This is the
   first PR to touch `hydrate`, so it is the one that most needs a reviewer's eyes.
2. **The `buildShoppingList` edit is one argument:** a pure lookup passed to `aggregateShoppingLines`; it stays
   side-effect free.
3. **Export and import carry overrides** (`aisleOverrides`), which the proposal does not mention, so the JSON
   backup has no silent hole. A backup without the key leaves existing overrides alone, as with word matches.
   This adds one new `replace…` function, import only, reusing `pushList` unchanged.
4. **No database CHECK on the `aisle` column.** The select offers only the five aisles and import filters the
   rest; a CHECK would need a migration whenever an aisle is added. The unique constraint on
   `(household_id, name)` is needed for the upsert.
5. **`aisleWhy` gets all four values now** (`override`, `dictionary`, `keyword`, `none`), not just `override`,
   because PR 7 needs the rest and it costs almost nothing.

**The migration, drafted from the `aliases` table's live definition** (read-only; DDL only, not applied). It
will go on `docs/migrations/add-aisle-overrides.md` for the household to apply **before** the PR is merged:

```sql
create table public.aisle_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  aisle text not null,
  created_at timestamptz not null default now(),
  constraint aisle_overrides_household_id_name_key unique (household_id, name)
);
alter table public.aisle_overrides enable row level security;
create policy "select own household" on public.aisle_overrides for select to authenticated
  using (household_id in (select private.household_ids_for_user()));
create policy "insert own household" on public.aisle_overrides for insert to authenticated
  with check (household_id in (select private.household_ids_for_user()));
create policy "update own household" on public.aisle_overrides for update to authenticated
  using (household_id in (select private.household_ids_for_user()))
  with check (household_id in (select private.household_ids_for_user()));
create policy "delete own household" on public.aisle_overrides for delete to authenticated
  using (household_id in (select private.household_ids_for_user()));
revoke all on table public.aisle_overrides from anon;
```

---

## 6. How to start the next session

1. Read `CLAUDE.md`, `docs/DOCUMENT-INDEX.md` and this document.
2. `git fetch origin main`; `git checkout -B claude/affectionate-ptolemy-5ka7pj origin/main` (the branch's only
   extra commit is this document; if it has not been merged, keep it: rebase it onto the new base).
3. Baseline tests (§4d), reading the exit codes: core 133, smoke 329.
4. The read-only database check in §2. If `source_check` is still missing, say so first thing.
5. Use the standing start prompt in `docs/NEXT-SESSION.md` with `<N>` = 6, or, if the household has already said
   "go" to §5, begin PR 6 at "Before every PR" in `docs/PLAN-NEW-RECIPE-FLOW.md` §8.

**Tooling notes.** GitHub is reached only through the `mcp__github__*` tools (there is no `gh` CLI); they are
deferred, so load them with a tool-search `select:` first, and they disconnect and reconnect between turns, so
retry rather than conclude they are gone. Supabase reads go through `mcp__Supabase__execute_sql` (project ref in
`docs/INFRASTRUCTURE.md`); from the shell the Supabase host and `github.io` are blocked. A stop-hook after a merge
reports one "unpushed commit" on the working branch: it is the merge commit, and a plain fast-forward
`git push -u origin claude/affectionate-ptolemy-5ka7pj` clears it. Dates come from `date -u`, never memory.
