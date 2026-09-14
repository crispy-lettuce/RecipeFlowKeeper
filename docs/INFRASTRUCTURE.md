# Kitchen App — Infrastructure Reference

**Written 14 Sep 2026, verified against the live GitHub API and Supabase project at the time
of writing** — not copied from an earlier note. This document assumes nothing about who or
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
| Shared working branch | `claude/recipe-app-supabase-0z139o`, on both repos |
| Supabase organisation | CrispyLettuce (`kvfcdgzdurwcqftttukd`) |
| Supabase project | **RecipeWrangler** (`mhkayefzrtceesgizkjs`), region `eu-west-1`, Postgres 17 |
| Supabase project URL | `https://mhkayefzrtceesgizkjs.supabase.co` |
| Household id | `286a8a12-c12a-4b83-afbc-0912533f6b1c` (the only one; not a secret — see §5) |

---

## 2. GitHub

### `crispy-lettuce/RecipeFlowKeeper` — the app

- **Public.** https://github.com/crispy-lettuce/RecipeFlowKeeper
- Default branch: `main`. Work happens on `claude/recipe-app-supabase-0z139o`, currently ahead
  of `main` and unmerged.
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
- **GitHub Pages is configured on this repo** (`has_pages: true` in the repo's own settings).
  Because the default branch is `main`, this most likely means **the old, pre-Supabase,
  localStorage-only app is live right now** at:

  **`https://crispy-lettuce.github.io/RecipeFlowKeeper/`**

  This is unverified rather than assumed — the sandbox this was written from has no route to
  `github.io` to check the page's actual content. **Open that URL in a browser before treating
  either "it's live" or "nothing's deployed" as fact.** If it is serving `main`, that's the old
  app, not the Supabase-backed rewrite — it can't reach your recipe data (that needs the
  Supabase login), but it's a stale, publicly-reachable copy of the tool. Whether that matters
  depends on whether anyone but you would ever land on it.

### `crispy-lettuce/PrivateBackup` — the nightly database dump

- **Private.** https://github.com/crispy-lettuce/PrivateBackup
- **Default branch is `claude/recipe-app-supabase-0z139o` — not `main`.** This isn't
  provisional; it's the actual repository default, which is why the scheduled workflow fires
  without any extra configuration. **Renaming or deleting this branch stops the nightly backup
  silently.** If it's ever renamed to `main` for tidiness, confirm afterwards that the schedule
  still fires (check the Actions tab).
- `.github/workflows/backup-supabase.yml` — runs daily at 04:00 UTC, dumps the `public` schema
  via `pg_dump`, commits the result under `backups/`, keeps the 30 most recent in the working
  tree. Verified genuinely working on 14 Sep — the scheduled run fired unattended and committed
  a real ~87 KB dump.
- **One repository secret required:** `SUPABASE_DB_URL` — the project's **Session pooler**
  connection string (Supabase Dashboard → Project Settings → Database → Connection string →
  Session pooler → URI), including the password. Set at
  **Settings → Secrets and variables → Actions** on this repo. Not the direct connection
  (IPv6-only; GitHub's runners have no IPv6 route) and not the transaction pooler on port 6543
  (doesn't give `pg_dump` the session-mode connection it needs).
- Full restore instructions are in `PrivateBackup/README.md`.

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

One bucket, `recipe-images` — **private, and currently empty (zero objects)**. No app code
references Supabase Storage yet. See `docs/HANDOVER.md` §2 for the agreed plan (an Edge
Function, run as a decoupled sweep) — nothing built yet.

### Edge Functions

**None deployed.** Both the image re-hosting plan and the calendar-push plan (P3) depend on one
each; neither exists yet.

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
```

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
   git clone -b claude/recipe-app-supabase-0z139o https://github.com/crispy-lettuce/RecipeFlowKeeper.git
   git clone -b claude/recipe-app-supabase-0z139o https://github.com/crispy-lettuce/PrivateBackup.git
   ```
2. Read `docs/HANDOVER.md` for what's actually built and verified, and `docs/NEXT-SESSION.md`
   for how to start the next piece of work.
3. If continuing in Claude Code: opening `RecipeFlowKeeper` picks up the Supabase connector
   automatically from its `.mcp.json` (§2 above) — no setup needed beyond that.
4. If continuing with a different tool, or by hand: the project ref (`mhkayefzrtceesgizkjs`)
   and URL (`https://mhkayefzrtceesgizkjs.supabase.co`) above are everything needed to point
   the Supabase CLI or dashboard at the right project. Sign in at
   https://supabase.com/dashboard with the account that owns organisation CrispyLettuce.
5. **Before assuming anything about deployment, check the Pages URL directly** — §2 above
   flags this as unverified from where this document was written.
