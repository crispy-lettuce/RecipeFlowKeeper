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

97 checks. It stubs Supabase entirely, so it proves nothing about sign-in, hydration, RLS or the
write queue — never claim the app works end to end on the strength of a green run.

## Things that will bite

- **Every `load*`/`save*` is synchronous.** Writes queue in the background via `queueWrite`,
  which always returns `true` immediately. Don't await them; don't make them async.
- **Any exception inside `hydrate()` signs the user out.** The failure mode is a login screen you
  can't escape. Use `.maybeSingle()` where a row might legitimately not exist.
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

## Style

Match the surrounding code: comments explain *why*, not what, and often record a decision and
the reasoning behind it. Keep that habit — much of the value in this file is in its comments.
British English in user-facing text; metric units throughout.
