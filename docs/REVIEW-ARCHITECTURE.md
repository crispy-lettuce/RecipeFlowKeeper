# Brief: an independent review of the app's structure

*Written 23 Sep 2026. A self-contained brief for a separate session, ideally on a different
model from the ones that built the app. It ends with the prompt that starts that session.*

---

## The ask

The household wants a step back before two structural pieces of work begin: the shopping-list
release (`docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md`, step 4) and sharing the app with family.
The app works and is in daily use; the question is whether its shape is right for what comes
next, and whether the record of it is honest.

**Why now, and why independently.** Every design decision so far was made by the same line of
sessions, and the record has been wrong twice: two audits in September found work recorded as
done that wasn't. A third case surfaced on 23 Sep, one level up: the ingredient review scored
its own design by "rows on the shopping list", a measure that rewards renaming ingredients and
never penalises the converter swapping one product for another. The design passed its own test
and then substituted *Italian seasoning* with *dried oregano* in its first outing on an unseen
site. A reviewer with no stake in the earlier decisions is the antidote to that pattern.

**This is a review, not a build.** The deliverable is a document with findings and ranked
recommendations. Nothing changes on `main`. `main` is production: every merge deploys to the
tablet in the kitchen.

---

## Ground rules

From `CLAUDE.md`, which applies in full:

- **The repo is public.** Recipe, planner and diary data must never be committed to it. Exported
  data, query output and working files stay in a scratch directory outside the repo. Every
  example in anything committed is made up.
- **Verify rather than trust.** Check the code, the database and GitHub directly instead of
  believing any document, this one included. One discrepancy is already known, to calibrate by:
  `docs/ARCHITECTURE.md` §4 says the household id is a constant in `index.html`; in the code it
  is resolved at sign-in from `household_members` (search `HOUSEHOLD_ID`). Expect more of these,
  and report each one.
- `node test/build.js && node test/smoke.js` (197 checks). Always both: `smoke.js` loads what
  `build.js` wrote. The suite stubs Supabase entirely, so a green run says nothing about sign-in,
  hydration, RLS or the write queue.
- British English, metric units.

**Independence, in practice.** Read the code before the documents where you can. For question 2
below, write your answer down before reading `docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md`
§"Answers first" and §4.1, then read them and record where you disagree. That document argued
that judgement belongs in the converter because the converter is already an AI; the household
now doubts that, and wants a view formed without it.

---

## What you are reviewing

A personal recipe app for one household, used from a tablet in a kitchen. One file,
`index.html` (about 7,300 lines: markup, styles and all the code), served by GitHub Pages from
`main`. Data in Supabase (project ref `mhkayefzrtceesgizkjs`): Postgres with row-level security
keyed on household membership, Auth, Storage for recipe photos, and two Edge Functions in
`supabase/functions/`. Nightly `pg_dump` from a GitHub Action in the private `PrivateBackup` repo.

The distinguishing feature is the **recipe format**: a text syntax of `GROUP`, `STAGE` and
`MERGE` lines that the app lays out as a flow diagram with a timeline, so several things cooking
in parallel can be followed on one screen. `docs/ARCHITECTURE.md` §2 explains it. A recipe is
written in that syntax by a **converter**: `converter/conversion-instructions.md` pasted into a
claude.ai project, given a web page or photo, producing syntax the household pastes into the app.
The app parses it (`parseRecipe`) into the structure everything else uses, and stores the text as
the source of truth.

Runtime pattern: everything loads into an in-memory `cache` at sign-in (`hydrate()`), every
`load*`/`save*` is synchronous against that cache, and writes go to Supabase through a background
`queueWrite`. `CLAUDE.md` §"Things that will bite" lists the consequences.

---

## Questions to answer

Answer each with evidence (`file:line`, a query, a workflow run), a severity, and what you would
do about it. Where the answer is "leave it alone", say so and why; that is as useful as a change.

### 1. The data model

Recipes are stored as syntax text and parsed on every load; `recipes` has parsed columns beside
`syntax`, and `docs/ARCHITECTURE.md` §3 explains why the text is the truth. Is that the right
call? What does it decide, for better or worse, for search, scaling, the diary, the shopping
list, and for editing a recipe in place? Would storing the parsed structure alongside, or
instead, be worth the migration? Consider also the parallel arrays in `planner_days`
(`recipe_ids` and `servings`, index-matched), `meal_groups` with no foreign key, and
`shopping_checked.item_key` being the aggregation string itself.

### 2. The ingestion pipeline: where a recipe can be silently changed

Source page → LLM converter → pasted syntax → `parseRecipe` → save → (later) shopping list.
At each stage: can the recipe be changed without anyone seeing it, and what would make that
stage faithful, or at least visible? Include:

- The converter is asked to rename ingredients to a shared vocabulary
  (`converter/ingredient-names.md`). Is asking a model to rename ever safe, or should naming
  live only in the app, at list time, where a wrong match is visible and affects nothing else?
- What is the difference in cost between a missed merge, a wrong merge, and a rewritten recipe,
  and does the current design rank them that way?
- Is there a deterministic alternative for part of the pipeline? Most recipe sites embed
  Schema.org `Recipe` JSON-LD with the ingredient strings, steps, image, servings and times.
  What could be copied rather than interpreted, and what genuinely needs judgement?
- The add/edit modal is paste → preview → save. What would the preview need to show for a
  substitution to be caught at that moment?

### 3. The runtime pattern

The cache-plus-queue design; `hydrate()` throwing meaning sign-out (any exception but a network
failure); the refresh on every hidden → visible change and the four rules it follows
(`docs/HANDOVER.md` §2e); `pushList` upserting every cached recipe on every save. Are these
sound? Where can they lose data across two devices, or strand a user on the login screen? Is
there a simpler shape with the same guarantees, and would it be worth the change?

### 4. Sharing with family

The schema anticipates several households (`households`, `household_members.role`) and RLS is
keyed on membership, but only one household exists and the app has never been used by two
accounts at once. What is the real gap between here and a second person, or a second household?
Cover: RLS as it stands (read the policies, don't infer them); what two devices editing at once
does to the cache and the write queue; and, above all, **how someone without the household's
claude.ai account adds a recipe**. Options the household has heard of, to assess rather than
adopt: an Edge Function that reads a page's JSON-LD and gives a plain recipe with no flow; an
Edge Function that calls a model with the conversion instructions, key held in Supabase secrets.
The second runs a model from the app, which an earlier review called "against a standing rule";
that rule was written about the shopping list. Say whether it applies here, and what you'd do.

### 5. Testing

197 checks that stub the backend entirely; a manual browser test plan (`docs/TEST-PLAN.md`,
`docs/TEST-IMAGES.md`) run by hand twice; Playwright available. What is the smallest automated
thing that would exercise sign-in, RLS and the write queue for real, and is it worth having?
Are there checks in `test/smoke.js` that cannot fail? (Two such were found before, by mutation.)

### 6. One file

Everything is in `index.html`. Is that still right for a project of this size and one
maintainer with AI sessions? At what point, if any, does it stop being? If you would split it,
say into what and why; if you wouldn't, say what keeps it workable.

### 7. Backups and operations

The nightly dump runs from a private repo's only branch, which happens to be its default. Is the
backup restorable? (Read `PrivateBackup/README.md`; don't run a restore against the live
project.) What else is one accident from breaking: Pages deploying from `main`, secrets, the
Edge Functions' auth, the anon key?

### 8. The documents

`docs/DOCUMENT-INDEX.md` maps them. Are they honest and are they the right set? Name everything
recorded as done that the code, the database or GitHub does not bear out, and anything the docs
say that the code contradicts. Say which documents you would merge, retire or add.

### 9. The plan for what's next

`docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md` "What I recommend, in order" and its status table
set out the next release: a name dictionary inside the app, one row per ingredient on the list,
ticks keyed by name, a migration of ticks and word matches. Given your answers to 1 and 2, should
that plan go ahead as written, be changed, or wait?

---

## Method

- **Start from the code.** `index.html` is long; read it by function using the table in
  `docs/ARCHITECTURE.md` §3 as the map, and `CLAUDE.md` for the hazards.
- **Query the live project** for schema, policies and row counts. The Supabase connector for
  project `mhkayefzrtceesgizkjs` has failed to connect in some sessions (`ERR_PROXY_TUNNEL`); if
  it does, say so rather than working round it. Row counts and structure are fine to quote;
  recipe text, plan and diary content are not.
- **Read the RLS policies and the Edge Functions' auth checks as written**, not as described.
- **Run the tests** and, where a claim depends on a check, mutate the code and confirm the check
  fails.
- **Check GitHub Actions** in both repos for what actually ran.
- **Do not change `main`.** Anything committed goes on the session's own branch and holds no data.

---

## Deliverable

`docs/REVIEW-ARCHITECTURE-FINDINGS.md`, containing:

1. **Answers first**: one paragraph per question above, with the verdict up front.
2. **Findings**, each with evidence, severity and the document it contradicts if any.
3. **Recommendations in three lists**: change now; change before sharing with family; leave
   alone, with the reason.
4. **Where you disagree with the ingredient review**, question 2, written before and after
   reading it.
5. **What this review did not cover**, and what it could not verify.

Then **stop for the household's decision.** They have said they are happy to follow clear,
guided recommendations, and they would rather hear "leave it" than a change for its own sake.

---

## References

| What | Where |
| --- | --- |
| The app | `index.html` |
| Rules and hazards | `CLAUDE.md` |
| Map of all documents | `docs/DOCUMENT-INDEX.md` |
| Recipe format, runtime pattern, function map, schema, scaffolding columns | `docs/ARCHITECTURE.md` |
| Verified status, corrections record, the refresh rules (§2e), backups (§5) | `docs/HANDOVER.md` |
| Repos, Supabase project, credentials policy, Actions | `docs/INFRASTRUCTURE.md` |
| Original requirements and the reference codes | `docs/BUILD-BRIEF.md` |
| The ingredient review and its plan | `docs/REVIEW-INGREDIENT-MATCHING.md`, `-FINDINGS.md` |
| Converter instructions, vocabulary, regression set | `converter/` |
| Edge Functions | `supabase/functions/rehost-images`, `supabase/functions/find-recipe-image` |
| Test harness and what it can't tell you | `test/README.md`, `test/build.js`, `test/stub.js`, `test/smoke.js` |
| Backups | `crispy-lettuce/PrivateBackup` (private), its `README.md` and workflow |

Repo: `github.com/crispy-lettuce/RecipeFlowKeeper` (public). Supabase project ref:
`mhkayefzrtceesgizkjs`. Live app: https://crispy-lettuce.github.io/RecipeFlowKeeper/, deployed
from `main` on every merge.

---

## The prompt that starts the session

Paste this into a new Claude Code session with this repo attached, on a different model from the
one used so far.

```text
I'd like an independent review of the structure of my Kitchen recipe app before two pieces of
structural work begin. It was built and documented by earlier AI sessions, and the record has
been wrong before, so verify everything against the code, the database and GitHub rather than
the documents.

Start by reading the brief, then CLAUDE.md, which applies in full:
  docs/REVIEW-ARCHITECTURE.md
  CLAUDE.md
The brief has nine questions, a method, and the deliverable. Follow its independence rule for
question 2: write your own answer before reading the earlier ingredient review's conclusions.

The repo is public, so never commit my recipe, plan or diary data. This is a review, not a
build: give me a findings document with ranked recommendations, including what to leave alone,
and stop for my decision before changing anything.
```
