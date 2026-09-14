# Document index

Everything written for this project, what each is for, and when to read it. Start here.

**Written 14 Sep 2026.** Every document listed was verified against the live code, database and
GitHub at the time of writing.

---

## Read in this order if you're new

1. **`docs/BUILD-BRIEF.md`** — what was decided and why, before any of it was built.
2. **`docs/ARCHITECTURE.md`** — how the app and its recipe format actually work.
3. **`docs/HANDOVER.md`** — what's built, what isn't, and what was found to be wrongly recorded.
4. **`docs/INFRASTRUCTURE.md`** — repos, Supabase, credentials policy.

Then pick up work from **`docs/NEXT-SESSION.md`**, which sets out the order things should
happen in. As of 14 Sep 2026 the project is at **step 1 of 5: ingesting the reprocessed recipes**.

---

## The documents

### `docs/BUILD-BRIEF.md` — the original specification
**What:** A verbatim transcription of the Build Brief that started the project. Defines every
requirement with a reference code (`S1` week start, `P1` planner servings, `R7` images,
`C3` bracket timings, and so on), the architecture decisions, what was deliberately dropped,
and the intended three-phase build order.

**Use it when:** you meet a reference code in any other document and need to know what it means,
or you want to know whether something was decided, dropped, or never considered. This is the
source of truth for intent. Everything else describes progress against it.

**Don't:** treat it as a status document. It describes the plan, not what exists.

---

### `docs/ARCHITECTURE.md` — how it works
**What:** The app's shape and the thinking behind it. Covers the recipe flow format
(`GROUP`/`STAGE`/`MERGE`) with a worked example, the two rules that trip people up (group order
is load-bearing; late additions get their own group), the in-memory-cache-plus-background-write
data pattern, the functions worth knowing, the full database schema including columns that exist
for features not yet built, and the repo layout.

**Use it when:** you're about to change code, write or debug a recipe, or work out why something
is structured the way it is.

---

### `docs/HANDOVER.md` — verified status
**What:** Every Build Brief requirement with its real status, checked against the running code
and live database rather than copied from earlier notes. Also records the image-handling plan,
the agreed recipe-ingestion method, the backup situation, and an explicit list of corrections to
things previously recorded wrongly.

**Use it when:** you need to know what's actually done. This is the document to update as work
progresses — and to distrust first if something doesn't match reality.

---

### `docs/INFRASTRUCTURE.md` — the reference card
**What:** Both repositories (URLs, visibility, default branches, what the odd branch naming
means), the Supabase organisation and project with its ref, region and URL, the anon key, the
household id, the migration history, and an explicit statement of which credentials are safe to
share and which must never leave a platform's settings screen.

**Use it when:** connecting to anything, or handing the project to someone new. Written to be
useful with no Claude Code session and no prior context at all.

---

### `docs/TEST-PLAN.md` — the browser checklist
**What:** A step-by-step verification pass against the real backend: sign-in, hydration, the
write queue, then every Phase 2 feature, then export/import. Includes expected row counts to
check against and flags which failures would be serious.

**Use it when:** running the outstanding verification, which **has never been done**. Nothing in
the Supabase rewrite has been confirmed working against the real backend by a human in a browser.
The riskiest step is signing out and back in.

---

### `docs/NEXT-SESSION.md` — the order of work, and how to start
**What:** **The definitive sequence for what happens next**, with the reasoning behind the three
places where order genuinely matters. Plus a complete, ready-to-paste prompt for the next session
and alternative starting points if you want to work out of sequence.

**Use it when:** starting a new session, or whenever you're unsure what should happen next.
Currently at **step 1: ingest the reprocessed recipes**.

**Contains one warning worth not missing:** the test plan's export/import step rewrites
everything, so that export must be taken *after* recipe ingestion, never before.

---

### `converter/conversion-instructions.md` — how recipes are written
**What:** The prompt used to convert a recipe from a web page, photo or pasted text into the
app's flow format. Covers extraction, structure, a mandatory check pass, and how to present the
result. Includes worked right/wrong examples for the grouping rule that late additions get their
own group.

**Use it when:** adding any recipe. Paste it, or its contents, into a conversation along with the
source recipe.

**Keep in step with:** the app's parser. The two must agree — a mismatch between what this asks
for and what `parseRecipe` understands caused a real bug (`[instant]` durations the app didn't
recognise, leaving raw bracket text visible in the diagram).

---

### `converter/test-set.md` — the converter's regression tests
**What:** Five deliberately awkward recipes, each isolating one failure mode — a late addition, a
split ingredient, parallel prep, a zero-length step, a missing yield — with what a correct
conversion must produce and what counts as a failure. Plus two audits of the real library
recording what's wrong with it.

**Use it when:** you change `conversion-instructions.md`. Run all five through the revised
instructions and compare. Also the record of which existing recipes have known problems.

---

### `test/README.md` — the offline harness
**What:** How to run the 97-check test suite, and an honest account of what it can't tell you
(everything about the real backend).

**Use it when:** making any code change.

---

### `CLAUDE.md` — guidance for AI sessions
**What:** Ground rules and the specific traps in this codebase — the synchronous save pattern,
the hydrate-throws-signs-you-out trap, the cascade on recipe deletion, and the standing
instruction to verify rather than trust status notes.

**Use it when:** it's picked up automatically by Claude Code. Worth reading yourself for the
list of things that bite.

---

### `README.md` — the public front door
**What:** What the app is, how to run it locally, where to go next.

---

## Not in this repo

- **The recipe data itself.** Lives in Supabase. This repo is public, so recipe, planner and
  diary content must never be committed here.
- **Database backups.** Nightly dumps go to the private `PrivateBackup` repo. Restore
  instructions are in that repo's own `README.md`.
- **Credentials.** See `docs/INFRASTRUCTURE.md` §4 for what lives where.

---

## Keeping these honest

Two audits found status records that were wrong — a Storage bucket reported as a finished
feature, and a backfill that never ran. Both were believed for days because nobody checked.

If you update these documents, **record what you verified and how**, not just what you did. And
when something turns out to have been recorded wrongly, correct it in place and say so rather
than quietly fixing it — the correction is more useful than the tidy result.
