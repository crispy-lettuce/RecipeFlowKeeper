# Starting the next session

Copy the block below into a new chat. It's written to stand on its own.

---

## The prompt

> I'm continuing work on my Kitchen recipe app. Please start by reading
> `docs/HANDOVER.md` in the `crispy-lettuce/RecipeFlowKeeper` repo, on branch
> `claude/recipe-app-supabase-0z139o` — it's a verified status document written at the end of
> the previous session and it explains where everything stands.
>
> Also read `converter/conversion-instructions.md` and `converter/test-set.md` for how recipes
> are converted, and `docs/TEST-PLAN.md` for the browser checks that are still outstanding.
>
> Some context the handover assumes you know:
>
> - The app is a single `index.html` file — no build step, no framework, about 5,900 lines.
>   Everything lands in that one file.
> - It runs on Supabase (project ref `mhkayefzrtceesgizkjs`). You should have the Supabase
>   connector available; use it to inspect the database rather than guessing.
> - `RecipeFlowKeeper` is a **public** repo. Recipe, planner and diary data must never be
>   committed to it. Backups go to the private `PrivateBackup` repo.
> - There's an offline test harness in `test/`. Run `node test/build.js && node test/smoke.js`
>   after any change — 98 checks, and it catches real bugs. It stubs Supabase, so it proves
>   nothing about sign-in or the write queue.
> - Don't trust status notes, including the handover, where you can check the real thing
>   instead. The last session found two tasks marked "done" that weren't. Verify against the
>   code, the database, or GitHub Actions.
>
> What I want to do first: **[see "Pick your starting point" below — paste one]**

---

## Pick your starting point

Paste whichever applies as the last line of the prompt.

### A. Ingesting the reprocessed recipes (most likely)

> I have the reprocessed recipes ready. Read §3 of the handover for the agreed method — update
> in place by title match, never delete-and-reinsert, because `recipe_logs` cascades on delete
> and would destroy 125 cooking-log entries. Validate every block with the app's own
> `parseRecipe` and `computeColumns` before writing anything, show me the proposed old→new
> title mapping for confirmation, and hold back anything missing `SOURCE:` or a numeric
> `SERVINGS:` rather than guessing. Here are the recipes:
>
> [paste the fenced code blocks — one per recipe, each starting `TITLE:`]

### B. The browser test pass

> Nothing has ever been tested against the real backend — sign-in, hydration, row-level
> security and the write queue are all unverified. Walk me through `docs/TEST-PLAN.md`. I'll
> run it locally and report back. Start by telling me how to get the branch running.

### C. Building the image re-hosting (R7)

> Let's build the image re-hosting Edge Function described in §2 of the handover. The approach
> is already decided: server-side fetch (browser-side fails on CORS for most recipe CDNs), run
> as a decoupled sweep rather than wired into the save path. One thing still open — whether to
> make the `recipe-images` bucket public or keep it private with signed URLs. Give me your
> recommendation and reasoning before building.

### D. Going live

> The branch has never been deployed — `main` still serves the pre-Supabase app. Let's get
> `claude/recipe-app-supabase-0z139o` merged and confirm GitHub Pages is serving it. Note that
> this is the go-live moment for the whole Supabase migration, so tell me what could go wrong
> first.

### E. Phase 3

> Let's plan Phase 3: the food diary (H1, H2, H3), dated cooking notes (R4), and the calendar
> push (P3). All are in the Build Brief with reference codes; none has been started, and none
> was ever tracked in a task list. §1 and §4 of the handover cover what's decided.

---

## The recipe conversion prompt

Unchanged — keep using `converter/conversion-instructions.md` as it stands. It was reviewed on
14 Sep against the app's real parser and needs no edits.

**One thing worth adding to your conversion chat**, since the output now goes straight into the
database rather than being pasted through the app's form one at a time:

> These conversions are being ingested directly into the app's database, so the fenced code
> block is the data, not just a preview. Give each recipe as its own fenced code block starting
> `TITLE:`. Don't abbreviate, summarise or omit anything after presenting it.

Everything else the ingestion needs — `SOURCE_URL:`, `EQUIPMENT:`, bracketed durations on every
MERGE, mandatory `SERVINGS:` — the instructions already mandate.

---

## Two things not to undo

- **`PrivateBackup`'s default branch** is `claude/recipe-app-supabase-0z139o`, not `main`.
  That's why the nightly backup fires. Renaming it will silently stop backups unless the
  schedule is re-confirmed afterwards.
- **The backup workflow's two fixes** — the Session pooler connection string (the direct one is
  IPv6-only, GitHub runners have no IPv6) and the full path to `pg_dump` 17 (the runner's own is
  older than the server). Both took several failed runs to find.
