# Working on this project

Read `docs/DOCUMENT-INDEX.md` first — it maps every document. `docs/ARCHITECTURE.md` explains
the app and its recipe format; `docs/HANDOVER.md` is the verified status.

## Ground rules

**This repo is public.** Recipe, planner and diary data must never be committed here. Backups go
to the private `PrivateBackup` repo. Never commit the Supabase service-role key or the database
password — the publishable/anon key in `index.html` is meant to be public and is fine.

**Verify rather than trust status notes — including these.** Two separate audits in September
2026 found tasks recorded as "completed" that weren't: a Storage bucket existed with no feature
behind it, and a servings backfill had never run. Both had been reported as done. If you can
check the code, the database or GitHub Actions directly, do that instead of believing a summary.

**Run the tests after any change to `index.html`:**

```sh
node test/build.js && node test/smoke.js
```

236 checks. **Run both, always** — `smoke.js` loads what `build.js` wrote, so skipping the build
tests your previous edit and reports a pass or a failure that belongs to code you have changed.

It stubs Supabase entirely, so it proves nothing about sign-in, hydration, RLS or the write
queue — never claim the app works end to end on the strength of a green run.

**After any change to the image Edge Functions, also run:**

```sh
node test/image-integrity.js
```

31 checks over the integrity checker and `parseRecipeFilter` in `supabase/functions/*/index.ts`.
It lifts the code out of the real source rather than copying it, so a signature change makes it
throw rather than pass vacuously.

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
  `updateSidebarCounts()`. Never put a prompt or a write in it.
- **`recipe_logs` cascades on delete from `recipes`.** Deleting a recipe destroys its cooking
  history. Prefer updating a recipe row in place over delete-and-reinsert.
- **`shopping_checked.item_key` is the aggregation string itself**, so any change to how
  ingredients are named or combined silently re-keys every tick.
- **Group order in recipe syntax is load-bearing** — MERGE only combines handles on adjacent
  rows. See `docs/ARCHITECTURE.md` §2.
- **A schema column existing does not mean the feature exists.** Several columns are Phase 3
  scaffolding; `docs/ARCHITECTURE.md` §4 lists them.
- **Anything the app learns from the server must be written back into `cache`.** A save from
  the edit form upserts that recipe's whole row from the cache, so a value the cache doesn't
  know about is overwritten the next time that recipe is saved. This is why `rehostImageFor`
  writes its answer back rather than trusting the row. *(Until 24 Sep every save rewrote every
  recipe and a favourite toggle was enough to lose it.)*
- **Ordinary saves write one row; `pushList` and the `replace*` functions are for import only.**
  A favourite is an `update` of that column; a save is an upsert of that row; a removal is a
  delete of that row. Never route a normal action through a whole-table replace again — it is
  what let a stale tab overwrite another device's work and delete its recipes (F1).

## Style

Match the surrounding code: comments explain *why*, not what, and often record a decision and
the reasoning behind it. Keep that habit — much of the value in this file is in its comments.
British English in user-facing text; metric units throughout.
