# Offline test harness

Boots the real `index.html` in a headless browser with a fake Supabase behind
it, walks every screen, and fails on any console error or broken expectation.
No network, no account, no touching the live database.

## Running it

```sh
npm install playwright   # once
node test/build.js       # bake a runnable copy against the stub
node test/smoke.js       # walk it; exits non-zero on any failure
```

Since 23 Sep the same three commands run in GitHub Actions on every pull request and every push
to `main` (`.github/workflows/tests.yml`), so the gate no longer depends on anyone remembering.
Results print as each check runs; a crash prints `CRASH after N checks` and the last `ok` line
names where it died.

`build.js` writes `test/app-under-test.html` — a copy of the app with the two
CDN `<script>` tags swapped for `stub.js` and a set of canned rows injected.
Re-run it after every change to `index.html`; `smoke.js` reads only that copy,
never the original.

`node test/validate-recipes.js <file>` checks a converted batch against the app's own parser,
and `node test/ingredient-survey.js <files> [--out report.md]` surveys bulk ingredient
extractions (`converter/ingredient-extraction-prompt.md`). Both read their input from outside
this repo, and share the ingredient-line checks, which since 27 Sep live in `core.js`
(`ingredientLineFaults`, the same copy the app's preview uses) and are reported through
`ingredient-lines.js`.

Since 29 Sep (PR 3 of the add-recipe plan) `validate-recipes.js` also takes `--source <file>`: the source
pages' own ingredient lists, keyed by `TITLE:` and kept outside the repo, run through the app's own
`sourceFidelity` and reported per recipe. Its "new to the dictionary" and "totals as" lines now come from
`core.js` run inside the page, not from a second reading of `converter/ingredient-names.md`, and a
recipe whose text carries a `Source note` saying it was not read from its own page is a warning.

`node test/source-ingredients.js` (12 checks, no browser) tests the `source-ingredients` Edge
Function's page reading — which addresses it refuses, and what it makes of a recipe page's
Schema.org block — lifted from the real function source, and the source check in `core.js` it
feeds. Every page in it is made up; it proves nothing about whether a real site carries the
block. `node tools/remeasure.js <export>` re-measures the whole library from an export kept
outside the repo.

`node test/shots.js` writes a PNG of each main screen, for eyeballing a layout
change without a browser to hand.

Both scripts use whichever Chromium Playwright installs. Set
`PLAYWRIGHT_CHROMIUM` to an executable path if yours lives somewhere else.

## What it can and can't tell you

**`test/core.test.js` — the pure core, in Node.** Since 25 Sep (PR 6a) the parser, layout,
quantity, scaling and naming functions live in `core.js`, which loads in Node as well as the page.
142 checks, about two seconds, no browser: the behaviour the app relies on, the shopping list's naming
and totalling (since PR 6b: the ingredient review's §6 checks, numbered as they are there, each run
once against the mutation it names), the dictionary's master
copy against the generated `converter/ingredient-names.md`, and three rules about the split —
`core.js` never touches the page, nothing is defined in both files, and the two version stamps
agree. Run it first; CI does.

```sh
node test/core.test.js
```

`build.js` inlines the real `core.js` into the built page, so the smoke suite below tests exactly
what Pages serves.

**376 checks.** It covers the parts that are pure app logic: week bucketing, scaling (including mixed numbers, ranges and pack counts),
shopping-list totals and unit merging, tick behaviour, the planner's per-day servings, the
`SOURCE_URL` round trip, the `[instant]`/`[overnight]` duration keywords, the automatic image
re-host on save, what happens when you come back to the tab (online, offline, mid-save, after a
failed save), the add form's review and its answers in place (what each tap writes and that asking writes nothing, that no `confirm()` is called anywhere in the add path, the undos, and that BEFORE YOU SAVE lists what the save then does), the comparison recorded on the recipe (what SAVE writes and when, the chip in the viewer, Edit's stored result, and export and import carrying it), and that every screen renders without throwing.

**`stub.js` can misbehave on request.** `__READ_FAIL__` / `__WRITE_FAIL__` fail the way supabase-js
reports a dead network; `__READ_DELAY__` / `__WRITE_DELAY__` hold a request open; `__LOG__` records
reads and completed writes in order; `__AUTH_CB__` is the app's auth listener, so a test can fire
`SIGNED_IN` as a tab return does; `__SIGNOUTS__` counts sign-outs. All off by default.

**`node test/build.js` first, every time.** `smoke.js` opens `test/app-under-test.html`, which
`build.js` writes from `index.html`. Run `smoke.js` on its own after editing the app and you are
testing the previous build — which passes, or fails for a reason that no longer exists. That has
cost real time here.

It cannot tell you anything about **Supabase itself** — `stub.js` answers every
query from a fixed object and records writes to `window.__WRITES__` rather than
sending them. Sign-in, row-level security, the write queue and hydration are
all unexercised, so a green run is not a substitute for opening the real app
once. **Keep Awake** can't be tested here either; it needs a real tablet.

## The canned data

Two recipes, two planned days, one meal group, a shortlist item and a
handful of keywords — all invented, in `build.js`. Deliberately no real recipes:
this repo is public.

**The suite runs on one fixed date.** `test/fixture-time.js` holds it (a Tuesday in September
2026); `build.js` dates every fixture row from it and `smoke.js` pins the page's clock to it, so
"today", "tomorrow" and "this week" mean the same thing in the data and in the app whatever day
the suite is run. Until 24 Sep the fixture used the real clock, and two shopping-list checks
failed every Thursday, when "tomorrow" fell into the next Friday-start week. If you add a
fixture row with a date, use `iso(n)`; if you add a check that reasons about days, reason from
`FIXTURE_NOW`, never from `new Date()`.

**The stub records what an update or a delete was aimed at.** `.eq()`, `.not()` and `.in()` are
written onto the recorded write (`match` for the last `.eq()`, `eqs` for all of them, `not`,
`in`), so a check can assert that a favourite toggle updated one row of one household, or that
the import's delete excluded exactly the rows in the file. Before 24 Sep the filters were
discarded and the delete step had no test that could see it.

**Every stub write can fail.** `__WRITE_FAIL__` and `__WRITE_DELAY__` apply to upserts, inserts,
updates and deletes alike, and each logs `write-done:<table>`. Since PR 5 an ordinary save is a
single-row update or delete, so the refresh-rule checks need those to be able to fail too.

**Writes are queued, not sent on the spot.** A check that calls a save function inside
`page.evaluate` and reads `__WRITES__` in the same breath sees nothing: wait a moment (the new
row-scoped checks `await` a short timer) before sampling the log.

## Re-measuring the live library

Do this before shipping any change to how ingredients are named or totalled, after a rewrite
of recipe text, and every ten or so new recipes. It reads the live library and changes nothing.
The copy it reads is library data, so it lives in the session's scratch directory, **never in
this repo**. `tools/remeasure.js` refuses a file inside the repo.

1. **Read the library** with the Supabase `execute_sql` tool:

   ```sql
   select json_build_object(
     'recipes', (select json_agg(json_build_object('title', title, 'syntax', syntax) order by title) from public.recipes),
     'aliases', (select json_agg(to_json(a)) from public.aliases a)
   )::text as exp;
   ```

   The result is too large to show, so the tool saves it to a file and prints the path.
2. **Unwrap it into scratch.** `$S` is the session's scratchpad directory and `$F` is the path the
   tool printed:

   ```sh
   node -e '
   const fs=require("fs"); let t=fs.readFileSync(process.argv[1],"utf8");
   try{ const o=JSON.parse(t); if(o.result) t=o.result; }catch(e){}
   const m=t.match(/\[\{"exp":"([\s\S]*)"\}\]/);
   fs.writeFileSync(process.argv[2], JSON.parse("\""+m[1]+"\""));
   ' "$F" "$S/export.json"
   ```

3. **Measure:** `node tools/remeasure.js "$S/export.json"`. It prints:
   - how many rows the list comes to with every recipe planned;
   - pairs the list would offer to merge;
   - rows filed under "Other";
   - lines the list can't total;
   - lines the parser reads past.

   Before a naming change, run it on `main` and on your branch, and compare. Every changed row
   key is a tick the household loses.

On 27 Sep 2026, after 6c-2 and the household's word matches: 34 recipes, 169 rows, no line the
list can't total, and none the parser reads past. A change that moves those numbers must say
why.
