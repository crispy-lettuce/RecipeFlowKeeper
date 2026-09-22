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
5. **`docs/IMAGES.md`** — how recipe photos become ours, and the two cases that still need a
   button pressed.

Then pick up work from **`docs/NEXT-SESSION.md`**, which sets out the order things should
happen in. As of 21 Sep 2026 **steps 1 to 4 are done** — the library was reprocessed and ingested
(33 recipes), the full browser test pass was run against the real backend, the app was merged to
`main` and is live, and all 29 recipe images are self-hosted. The project is at **step 5:
Phase 3**, none of which has been started.

**One thing to absorb before changing anything: `main` is production.** GitHub Pages serves from
`main`, and every merge deploys straight to the tablet. There is no staging step. This was
discovered on 21 Sep, having been recorded the other way round in four documents.

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

### `docs/IMAGES.md` — how recipe photos get to Supabase
**What:** The runbook for image re-hosting (R7). Opens with **"Answers first"** — adding an image
to a new recipe, replacing one, how images get moved to Supabase, and whether it can be made
automatic — then the console commands, the integrity checks, what goes wrong, and how to verify.

**Use it when:** you want to change an image, or you've restored a backup and want the photos
self-hosted again. **Adding a recipe needs nothing** — since 22 Sep the app re-hosts the photo
itself on save (§5). The sweep is kept for the two cases that cannot reach: a restore, and a save
made offline. It is a button in Settings, not a console command.

**Don't:** expect a file picker. The app only ever takes a URL; there is no upload-from-device
(§5 Option D covers what adding one would involve — it is smaller than it sounds, because no
cross-origin fetch is involved).

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

**Use it when:** running a regression pass. The full 20-step pass **was completed on 21 Sep
2026** — the sentence that used to sit here, saying it had never been done, was true when
written and stale within a week. What follows is the original framing, kept because it explains
what the pass is for. Nothing in
the Supabase rewrite has been confirmed working against the real backend by a human in a browser.
The riskiest step is signing out and back in.

---

### `docs/TEST-IMAGES.md` — the image re-hosting pass
**What:** Eleven steps against the live app, checking that a new recipe's photo is copied into our
own Storage on save and stays there, and that losing the connection loses nothing. Roughly 25
minutes; needs a desktop, because several steps want devtools or the SQL editor.

**Use it when:** after any change to how images are saved, or to how the app loads and refreshes
the library. First run on the live app 22 Sep: steps 1–8 passed; step 9 found the sign-out and the
stale grid (`HANDOVER.md` §2e), and steps 9–11 were rewritten afterwards. It is separate from
`TEST-PLAN.md` so it can be re-run on its own.

**Don't:** take a green `node test/smoke.js` as covering any of it. The suite stubs Supabase
entirely, so it can show the app *asks* for a re-host and what it does with the reply, and nothing
about whether a file is ever stored. **Step 4 is the one to stop on** — a re-hosted photo that
reverts after an unrelated save is the feature failing in a way that looks exactly like success.

---

### `docs/REVIEW-INGREDIENT-MATCHING.md` — brief for reviewing the shopping list's matching
**What:** A self-contained brief for a separate review session. It covers how ingredient lines
become shopping-list items today, the faults already found by running the real functions, what
makes changes expensive, the questions to answer, and how to measure against the real library.
It ends with the prompt that starts the session.

**Use it when:** starting that review, or before touching `splitQty`, `normalizeIngredientName`,
word matches or the converter's ingredient rules.

**Don't:** commit library data while following it. Its examples are made up on purpose; the repo
is public.

---

### `docs/NEXT-SESSION.md` — the order of work, and how to start
**What:** **The definitive sequence for what happens next**, with the reasoning behind the three
places where order genuinely matters. Plus a complete, ready-to-paste prompt for the next session
and alternative starting points if you want to work out of sequence.

**Use it when:** starting a new session, or whenever you're unsure what should happen next.
Currently at **step 5: Phase 3** — steps 1 to 4 are done, and within Phase 3 the food diary
(H1–H3) and dark mode (S2) have shipped. R4 and P3 remain.

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
conversion must produce and what counts as a failure. Plus three audits of the real library. The
first two (13 and 14 Sep) describe the pre-reprocess library and are history now; the third
(20 Sep) re-runs all five tests against what's actually in the database.

**Use it when:** you change `conversion-instructions.md`. Run all five through the revised
instructions and compare. Also the record of which library faults have been fixed and when.

**Worth knowing:** these tests check what the *converter* writes, not what the app's parser
*reads*. A batch can pass every rule here and still land wrong — which is exactly what happened
on 20 Sep. `test/validate-recipes.js` covers the other half.

---

### `test/README.md` — the offline harness
**What:** How to run the 157-check test suite, and an honest account of what it can't tell you
(everything about the real backend).

**Use it when:** making any code change.

Alongside it, **`test/validate-recipes.js`** checks a batch of converted recipes before it goes
anywhere near the database, by calling the app's own `parseRecipe` and `computeColumns` inside
the built page rather than reimplementing them. Takes the batch as a file path, outside this
repo — recipe data must never be committed here.

```sh
node test/build.js && node test/validate-recipes.js ~/recipes.md
```

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
