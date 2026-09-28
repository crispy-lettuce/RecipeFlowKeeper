# Working on this project

Read `docs/DOCUMENT-INDEX.md` first — it maps every document. `docs/ARCHITECTURE.md` explains
the app and its recipe format; `docs/HANDOVER.md` is the verified status.

## Every session, before you push

Nobody else checks these. Each one is here because it went wrong at least once.

1. **Tests.** `node test/core.test.js`, then `node test/build.js && node test/smoke.js`. Read the
   exit code (`echo $?`), not the number of `ok` lines. Run `core.test.js` even for a
   documentation change, since it also checks the generated dictionary. The smoke suite needs
   `npm install playwright` once; `.gitignore` keeps what that writes out of the repo. If it can't
   find a browser in a cloud session, set `PLAYWRIGHT_CHROMIUM` to the `chrome` under
   `/opt/pw-browsers/chromium-*/chrome-linux/`.
2. **`core.js` changed → bump its version in all three places at once:** `KITCHEN_CORE_VERSION`
   in `core.js`, and `core.js?v=` and `EXPECTED_CORE_VERSION` in `index.html`. Use today's date
   plus `.1`, or the next number if today already has one. `core.test.js` fails if the three
   disagree.
3. **Make every new check fail once.** Break the code it guards, see the check fail by name, then
   restore the code (`git diff` shows nothing). A check you have never seen fail proves nothing.
4. **Take dates from `git log`, the database's timestamps or `date -u`**, never from memory or the
   version stamp. On 27 Sep a wrong date reached nine documents.
5. **Read your diff for private data** (`git diff origin/main`). Leave out real recipe lines, the
   household's word matches, and plan or diary rows. Examples must be made up, and checked
   against the library so they aren't real lines by accident.
6. **"Done" means seen.** That means the database row, the log line or the green CI run. Write
   down what you checked, and write "not verified" where you couldn't check.

## Where a session stops and hands back

- **Open the PR; the household merges.** Merge only when asked, and only on green CI.
  `offline-harness` is a required check on `main`.
- **Don't deploy Edge Functions.** The household deploys them from the dashboard, pasting the
  file from its raw GitHub URL.
- **A change to how ingredients are named re-keys the household's ticks.** This means `shoppingLine`
  or a dictionary row. Re-measure the library first ("Re-measuring the live library" in
  `test/README.md`), then ask before shipping.
- **The only production writes a session makes** are single rows the household asks for, and
  recipe text changed as described below. Anything else, ask. A smaller PR is always fine.

## Changing recipe text in the live database

Change recipe text only this way, with the household present:

1. The household approves the exact new lines, then takes a fresh export from the app.
2. Save the approved lines and every recipe's text before and after in `PrivateBackup`
   (`migrations/<job>/`), never here. That file is the undo.
3. Write one statement per recipe, guarded both ways. Generate it from the saved file; never
   retype the text by hand.

   ```sql
   with v(s) as (select $t$<new text>$t$::text)
   update public.recipes r set syntax = v.s, updated_at = now() from v
   where r.id = '<id>' and md5(r.syntax) = '<md5 before>' and md5(v.s) = '<md5 after>'
   returning r.title;
   ```

   If it returns no row, nothing changed: stop and find out why.
4. Write the first recipe alone. The household opens it in the app before you write the rest.
5. Afterwards, compare every stored md5 in one query, then re-measure.

Never delete and re-insert a recipe: its cooking history cascades with it.
`migrations/6c-2-line-rewrite/` in `PrivateBackup` is the worked example.

## Ground rules

**This repo is public.** Recipe, planner and diary data must never be committed here. Backups go
to the private `PrivateBackup` repo. Never commit the Supabase service-role key or the database
password — the publishable/anon key in `index.html` is meant to be public and is fine.

**Verify rather than trust status notes — including these.** Two separate audits in September
2026 found tasks recorded as "completed" that weren't: a Storage bucket existed with no feature
behind it, and a servings backfill had never run. Both had been reported as done. If you can
check the code, the database or GitHub Actions directly, do that instead of believing a summary.

**Run the tests after any change to `index.html` or `core.js`:**

```sh
node test/core.test.js
node test/build.js && node test/smoke.js
```

`core.test.js` is 77 checks in Node, in under a second: the pure functions, the dictionary, the
shopping list's naming rules, and the rules that keep `core.js` and `index.html` apart. The smoke
suite is 275 checks. **Run both,
always** — `smoke.js` loads what `build.js` wrote, so skipping the build
tests your previous edit and reports a pass or a failure that belongs to code you have changed.

It stubs Supabase entirely, so it proves nothing about sign-in, hydration, RLS or the write
queue — never claim the app works end to end on the strength of a green run.

**After any change to the image Edge Functions, also run:**

```sh
node test/image-integrity.js
```

31 checks over the integrity checker and `parseRecipeFilter` in `supabase/functions/*/index.ts`.
It lifts the code out of the real source rather than copying it, so a signature change makes it
throw rather than pass vacuously. After a change to `source-ingredients`, or to `sourceFidelity`
in `core.js`, run `node test/source-ingredients.js` (12 checks, lifted the same way).

## Things that will bite

- **Every `load*`/`save*` is synchronous.** Writes queue in the background via `queueWrite`,
  which always returns `true` immediately. Don't await them; don't make them async.
- **An exception inside `hydrate()` at start-up signs the user out** — any except a network
  failure. The failure mode is a login screen you can't escape. Use `.maybeSingle()` where a row
  might legitimately not exist.
- **Coming back to the tab re-runs the load.** supabase-js emits `SIGNED_IN` on every hidden →
  visible change, offline too; the app turns the second and later ones into `refreshLibrary()`.
  That refresh is load-bearing — it is what stops a long-open tab pushing a stale library over
  another device's work — so don't remove it. It must never replace the cache while the cache
  holds something the server doesn't; `docs/HANDOVER.md` §2e has the four rules it follows.
- **`buildShoppingList()` must stay side-effect free** — it runs on every planner mutation via
  `updateSidebarCounts()`. Never put a prompt or a write in it. Since PR 6b it only *returns*
  suggestions; `renderShopping` shows them in place and the buttons do the writing.
- **`recipe_logs` cascades on delete from `recipes`.** Deleting a recipe destroys its cooking
  history. Prefer updating a recipe row in place over delete-and-reinsert.
- **`shopping_checked.item_key` is the shopping row's key: the ingredient's name alone** since
  PR 6b (plus a `both|` prefix on the both-weeks list). A recipe changing its unit keeps the tick,
  but any change to how ingredients are *named* — a rule in `shoppingLine`, a dictionary row —
  silently re-keys every tick for that ingredient. Measure against the library before shipping one.
- **Group order in recipe syntax is load-bearing** — MERGE only combines handles on adjacent
  rows. See `docs/ARCHITECTURE.md` §2.
- **A schema column existing does not mean the feature exists.** Several columns are Phase 3
  scaffolding; `docs/ARCHITECTURE.md` §4 lists them.
- **Anything the app learns from the server must be written back into `cache`.** A save from
  the edit form upserts that recipe's whole row from the cache, so a value the cache doesn't
  know about is overwritten the next time that recipe is saved. This is why `rehostImageFor`
  writes its answer back rather than trusting the row. *(Until 24 Sep every save rewrote every
  recipe and a favourite toggle was enough to lose it.)*
- **The app is two files since 25 Sep: `index.html` and `core.js`.** `core.js` holds the pure
  functions (parsing, layout, quantities, scaling, naming) and the ingredient dictionary; nothing
  in it may touch the page, and nothing it defines may also be defined in `index.html`.
  **Bump `KITCHEN_CORE_VERSION` in `core.js` and `EXPECTED_CORE_VERSION` in `index.html`
  together** whenever `core.js` changes: Pages caches the two separately, and the page asks for a
  reload when they disagree. `test/core.test.js` fails if they differ.
- **The ingredient-line checks live in `core.js` (`ingredientLineFaults`) since 27 Sep**, shared by the
  app's preview and `validate-recipes.js`. A fault marked `affectsList` is shown in the preview;
  mark one only when the shopping list genuinely can't cope, or the preview nags about lines that
  are fine. The preview's checks are advice: never make one block a save.
- **The ingredient dictionary is edited in `core.js`, never in `converter/ingredient-names.md`.**
  That file is generated: `node tools/generate-ingredient-names.js`, then commit both.
- **Ordinary saves write one row; `pushList` and the `replace*` functions are for import only.**
  A favourite is an `update` of that column; a save is an upsert of that row; a removal is a
  delete of that row. Never route a normal action through a whole-table replace again — it is
  what let a stale tab overwrite another device's work and delete its recipes (F1).

## Style

Match the surrounding code: comments explain *why*, not what, and often record a decision and
the reasoning behind it. Keep that habit — much of the value in this file is in its comments.
British English in user-facing text; metric units throughout.
