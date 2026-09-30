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
happen in. As of 23 Sep 2026 the app is live and in daily use, and the work is a **seven-PR plan**
agreed after two reviews: a safety net (PR 1, done), closing the review loop (PR 2), backups,
a faithful save, row-scoped writes, the shopping-list release, and sharing with family.
Phase 3's last two items (R4, P3) follow it.

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

### `docs/HANDOVER-2026-09-29-SESSION.md` — the add-recipe plan's session handover (29 Sep 2026), and what is next
**What:** A session handover written when PR 5 of the add-recipe plan had merged (29 Sep, 17:30 UTC): the state of PRs 1 to 8,
the decisions and tests outstanding then, PR 6 as put to the household, and how the tests and mutation runs were done and
what went wrong. **A note at its top (30 Sep) says what has happened since** (every plan PR merged, the migrations applied,
the tablet passes done), and **§7 is the autocomplete on the ingredient boxes in Settings and Swaps**: planned, then built on 30 Sep.

**Use it when:** picking the work up after 29 Sep: read the note at the top and §7 first; §4d is worth reading before any
mutation testing.

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

### `docs/migrations/add-source-photos.md` — a schema change, applied by the household 30 Sep 2026
**What:** Step 1 of `docs/PLAN-SOURCE-PHOTOS.md`: a private storage bucket, `recipe-sources`, with the same four
folder-per-household policies as `recipe-images`, and one nullable `jsonb` column, `recipes.source_photos`. Who applies it
and when (the household, from the dashboard, **before** merging the PR that carries it), why each part is there, how to
check it and how to undo it. DDL only, no data.

**Use it when:** checking it is still in place, or undoing it.

### `docs/migrations/add-aisle-overrides.md` — a schema change, applied by the household 29 Sep 2026
**What:** The `aisle_overrides` table (PR 6 of the add-recipe plan), with its four `TO authenticated` policies and the
`anon` revoke, who applies it and when (the household, from the dashboard, **before** merging that PR), why each part is
there, what the app does if it is merged first, how to check it and how to undo it. DDL only, no data.

### `docs/migrations/add-recipes-source-check.md` — a schema change, applied by the household 29 Sep 2026
**What:** The one `ALTER TABLE` that adds `recipes.source_check` (PR 5 of the add-recipe plan), who applies it
and when (the household, from the dashboard, **before** merging that PR), why it is safe to apply first, what goes in
the column, how to check it and how to undo it. A markdown page and not a `.sql` file because `.gitignore` excludes
`*.sql` on purpose. Carries no data.

**Use it when:** applying the migration, or checking whether it has been. `docs/INFRASTRUCTURE.md` lists it as waiting
until it has been applied.

---

### `docs/ONBOARDING.md` — adding a family member
**What:** The three steps to add someone to the household (create their account, link them with
one guarded SQL statement, give them the app's address), what they see if the link is missing,
and why the app has no sign-up form of its own to do any of this instead. Part of PR 7, Sharing.

**Use it when:** actually adding someone. Written 28 Sep 2026, part one of three for PR 7 — RLS
hardening and the weekly live-backend test are the other two, tracked separately in
`docs/NEXT-SESSION.md`.

**Don't:** use it as a case for a second, genuinely separate household — it says why that's a
bigger decision, not a variation on these steps.

---

### `docs/TEST-PLAN.md` — the browser checklist
**What:** A step-by-step verification pass against the real backend: sign-in, hydration, the
write queue, then every Phase 2 feature, then export/import, two devices at once (D) and the shopping list release (E, PR 6b). Includes expected row counts to
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

### `docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md` — what that review found, and what to do
**What:** The answer to the brief above, measured against the real library on 22 Sep 2026: 34
recipes and 463 lines, scored with the app's own functions against a hand-labelled answer key of
168 items. It covers:

- the fault classes and how often each occurs;
- every idea tested, one at a time and combined;
- two real weeks rebuilt before and after;
- ranked recommendations;
- the proposed ingredient-line format and converter wording;
- a migration plan for recipes, word matches and ticks;
- a test plan in which every check names the mutation that must fail it.

It ends with twelve decisions for the household.

**Use it when:** deciding what to build for the shopping list, or before changing `splitQty`,
the converter's ingredient rules or word matches. Step 1 (the quantity reader) merged as PR #9 on
23 Sep; step 3 is on PR #10; the rest waits on `docs/REVIEW-ARCHITECTURE-FINDINGS.md`, which
changes the plan for the converter's naming rule. *(This line said "nothing implemented" until
23 Sep.)*

**Don't:** look for the real lines here. They are in a private appendix that was handed to the
household and is not in this repo.

---

### `docs/REVIEW-ARCHITECTURE.md` — brief for an independent review of the app's structure
**What:** Nine questions for a separate session on a different model, written 23 Sep 2026 after
the ingredient review's design was found to have scored itself by a measure that rewarded it. It
covers the data model, where the ingestion pipeline can silently change a recipe, the runtime
pattern, sharing with family, testing, the single file, backups, whether the documents are
honest, and whether the planned shopping-list release should go ahead. It ends with the prompt
that starts the session.

**Use it when:** starting that review. Its findings are in `docs/REVIEW-ARCHITECTURE-FINDINGS.md`.

**Don't:** let the reviewer read the ingredient review's conclusions before answering question 2;
the brief says why.

---

### `docs/REVIEW-ARCHITECTURE-FINDINGS.md` — what that review found, and what to do
**What:** The answer to the brief above, written 23 Sep 2026 against the code on `main`, the live
database, the backup dumps and GitHub. It opens with the verdict and one paragraph per question,
then findings with evidence and severity, recommendations in three lists (change now; change
before sharing with family; leave alone, with the reason), the question 2 answer as written
before and after reading the ingredient review, what it could not verify, and a corrections
table for the other documents.

**Use it when:** deciding what to do before the shopping-list release or before sharing the app,
or updating any document it corrects. The household accepted it on 23 Sep; `docs/NEXT-SESSION.md`
holds the seven-PR plan that carries it out, and each PR ticks the findings it closes.

**Don't:** read its restore finding (F2) as the current state — it was a prediction from the
dump's contents and the live grants, rehearsed and closed on 23 Sep by `PrivateBackup` PR #1,
which found it right and incomplete (the default privileges went too).

---

### `docs/PROPOSAL-AISLE-OVERRIDES.md` — a household-editable aisle override, not started
**What:** A design, checked against the running code, for letting the household move an
ingredient into the right shopping-list aisle themselves from Settings — a form entry, not a code
change and a PR — for the recurring case of something landing under Other or in the wrong aisle.
Raised 28 Sep 2026 after "Sirloin Steak" was found under Other. Two design choices in it were
settled with the household already; nothing else has been, and nothing has been built.

**Use it when:** this is picked up. It names the exact new table, the `core.js` function to
extend, and the existing Word Matches feature it mirrors and deliberately stays independent of.
Its last section sets out the general rules for every fact held about an ingredient: word
matches, aisle, swaps and dictionary row. Each has one key and one home in Settings, and only
naming facts re-key ticks.

**Don't:** treat it as tracked work. `docs/NEXT-SESSION.md`'s "Proposed, not started" line points
here, but it's outside the seven-PR plan and has no PR number yet.

---

### `docs/PROPOSAL-NEW-RECIPE-REVIEW.md` — a review when a new recipe comes in, not started
**What:** A brainstorm and a phased design (A–D), checked against the code and the live library on
28 Sep 2026. It adds an ON THE SHOPPING LIST section to the Add/Edit preview, showing:
- a new recipe's names that are new to the library;
- the aisle each will land in, and whether that is Other;
- likely matches with the whole library, by the strict rule;
- a duplicate check on the source link.

It is quiet by default and never a gate. It also lists 15 pitfalls, two of which were found while
writing it:
- a merge made at ingest must always fold the new name into the existing one, or it can orphan
  ticks;
- every image is self-hosted, so image URLs cannot find duplicates.

It lists five open decisions for the household.

**Use it when:** this is picked up, or when anything is changed about how recipes come in. Phase A
is read-only and needs no schema change; Phase C depends on `docs/PROPOSAL-AISLE-OVERRIDES.md`.

**Don't:** treat it as agreed. Only the idea came from the household; the phases, the
recommendations and the open decisions have not been put to them yet.

---

### `docs/NEXT-SESSION.md` — the order of work, and how to start
**What:** **The definitive sequence for what happens next**, with the reasoning behind the three
places where order genuinely matters. Plus a complete, ready-to-paste prompt for the next session
and alternative starting points if you want to work out of sequence.

**Use it when:** starting a new session, or whenever you're unsure what should happen next.
Rewritten 23 Sep around the **seven-PR plan** from the two reviews, with a starting prompt per
PR. Phase 3's R4 and P3 wait until the plan is done.

**Contains one warning worth not missing:** the test plan's export/import step rewrites
everything, so that export must be taken *after* recipe ingestion, never before.

---

### `docs/HANDOVER-CONVERSION-INTEGRITY.md` — a recipe whose ingredients are not its source's (29 Sep 2026)
**What:** A handover for a review session (written for Opus). The household's comparison of
*No-Bake Chocolate Oat Bars* with its source page showed three of six ingredients missing and two
added; the recipe's own text says the converter reconstructed it because it could not read the page.
Covers what was seen and what was verified, what is not known, the ordered work (reproduce, find the
cause, scope an audit of the 34 recipes, propose prevention, repair only through the `CLAUDE.md`
procedure), the ground rules, a ready-to-paste starting prompt, and, in section 7, **the three
decisions still open from PR #38, written out in full** (the 15 pairs left flagged; the `a big
handful of` reading; `canned`/`tinned`).

**Use it when:** starting the review, or answering those three decisions.

**Don't:** look for the recipe's lines in it. They are left out on purpose (this repo is public).

---

### `docs/PLAN-SOURCE-PHOTOS.md` — keeping the photo a recipe was converted from (30 Sep 2026; steps 1 and 2 applied and merged)
**What:** The household's ask to keep the photo or screenshot a recipe was converted from, as a web recipe keeps its link.
What exists today, the proposal (a private bucket, a `source_photos` column, ADD PHOTO in the form, shrunk to 2000 px,
uploaded on SAVE, shown by signed link, deleted with the recipe), the order of work in three steps, what it does not do, and
the household's five answers ("all as suggested").

**Use it when:** building the next step, or asked where a recipe's source photo lives.

---

### `docs/PLAN-LAYOUT.md` — layout changes: edit dialog, cooking mode, step text, aisle box, Settings (30 Sep 2026; all five built, merged and passed on the tablet)
**What:** Five layout changes the household asked for on 30 Sep, lettered A to E as they lettered them, each with what the
app does now, what was decided and why, and what was considered and not chosen. All `index.html` only, no data change.
Built one PR at a time: C and A first, then D (the aisle box shows the current aisle), B (cooking mode, when KEEP AWAKE is on)
and E (Settings in three tabs, Swaps moved in). Tablet steps are the 37 series of `docs/TEST-PLAN.md`.

**Use it when:** building the next of those PRs, or asked why the viewer or Settings looks the way it does.

### `docs/PLAN-NEW-RECIPE-FLOW.md` — adding a recipe as one flow (29 Sep 2026, decided; PRs 1–4 built and merged, PR 5 open for review)
**What:** The plan that makes the journey from a pasted conversion to a saved recipe one page
with five bands, and gives Settings one place to see what the app knows about an ingredient. It
opens with an audit of today's add path (every step, every data change, every missing check, each
claim labelled as read in the code, measured against the live library, or inferred), then the
measured evidence of where the dictionary and naming rules fit only today's recipes, then the
household's decisions of 29 Sep (the three from the conversion-integrity handover's §7 among
them; no hard refusal), the target flow with element ids, every data change with where it is
shown and undone, and **eight PRs in a fixed order**, each with scope, exact rules, the numbers
to expect, the checks to add by name and the mutation that must fail each. §11 is a STOP AND ASK
list written for an implementation session on a less capable model.

**Use it when:** building any of those PRs, or changing anything about how recipes come in. It
supersedes the *phasing* of `docs/PROPOSAL-NEW-RECIPE-REVIEW.md` and adopts
`docs/PROPOSAL-AISLE-OVERRIDES.md` as its PR 6; both proposals stay the design record for the
reasoning behind them.

**Don't:** treat it as done. PRs 1–4 are built and merged and PR 5 is open for review (each entry's "Built as" note
says where the code differs from the text); PRs 6–8 are not built, and a plan closes no finding.

---

### `converter/conversion-instructions.md` — how recipes are written
**What:** The prompt used to convert a recipe from a web page, photo or pasted text into the
app's flow format. Covers extraction, structure, a mandatory check pass, and how to present the
result. Includes worked right/wrong examples for the grouping rule that late additions get their
own group. Since 29 Sep (PR 2 of the add-recipe plan) it also says what to do with a URL it cannot
read: stop, name the address and ask for the text, never convert from another page, and write any
note about the source as a `⚠️ Source note:` line.

**Use it when:** adding any recipe. Paste it, or its contents, into a conversation along with the
source recipe.

**Give it, on its own,** to the conversion project. `converter/ingredient-names.md` is **not** a
converter file any more: since the 23 Sep architecture review the converter keeps the source's
product words in British English, and that list is the app's dictionary for totalling them.

**Keep in step with:** the app's parser. The two must agree — a mismatch between what this asks
for and what `parseRecipe` understands caused a real bug (`[instant]` durations the app didn't
recognise, leaving raw bracket text visible in the diagram).

---

### `converter/test-set.md` — the converter's regression tests
**What:** Nine deliberately awkward cases, each isolating one failure mode — a late addition, a
split ingredient, parallel prep, a zero-length step, a missing yield, and (since 23 Sep) the
shape of ingredient lines, British English without over-specifying, and ingredients no list has seen,
and (since 29 Sep) an address it cannot read — with what a correct
conversion must produce and what counts as a failure. Plus three audits of the real library. The
first two (13 and 14 Sep) describe the pre-reprocess library and are history now; the third
(20 Sep) re-runs all five tests against what's actually in the database.

**Use it when:** you change `conversion-instructions.md`. Run all nine through the revised
instructions and compare. Also the record of which library faults have been fixed and when.

**Worth knowing:** these tests check what the *converter* writes, not what the app's parser
*reads*. A batch can pass every rule here and still land wrong — which is exactly what happened
on 20 Sep. `test/validate-recipes.js` covers the other half.

---

### `core.js` — the pure core (not a document, but read this entry)
**What:** Since 25 Sep 2026, the second of the app's two files: the parser, layout, quantity,
scaling and naming functions, and the ingredient dictionary's master copy. It touches nothing on
the page. `test/core.test.js` tests it in Node, and `tools/generate-ingredient-names.js` writes
`converter/ingredient-names.md` from its dictionary.

**Use it when:** changing how recipes are read, laid out, scaled or totalled, or adding a word
to the dictionary. **Bump its version stamp and the page's together** (`CLAUDE.md` says why).

---

### `test/README.md` — the offline harness
**What:** How to run the 403-check smoke suite, the 143 Node checks and the Edge Function checks, and an honest account of what it can't tell you
(everything about the real backend). Since 27 Sep, also how to re-measure the live library read-only, with the library kept in scratch and never in the repo.

**Use it when:** making any code change.

Alongside it, **`test/validate-recipes.js`** checks a batch of converted recipes before it goes
anywhere near the database, by calling the app's own `parseRecipe` and `computeColumns` inside
the built page rather than reimplementing them. Takes the batch as a file path, outside this
repo — recipe data must never be committed here.

```sh
node test/build.js && node test/validate-recipes.js ~/recipes.md
```

Since 29 Sep (PR 3 of the add-recipe plan) it also takes `--source <file>`, the source pages' own ingredient
lists keyed by `TITLE:` (kept outside the repo), and runs each through the app's own `sourceFidelity`; its
name reports come from `core.js` rather than a second reading of the dictionary file; and a recipe whose
text says it was not read from its own page is a warning.

Since 23 Sep it also warns on ingredient lines outside the standard shape, and lists names that
`converter/ingredient-names.md` doesn't know. Those checks live in **`test/ingredient-lines.js`**,
shared with **`test/ingredient-survey.js`**. The survey reads a bulk extraction made with
`converter/ingredient-extraction-prompt.md`, again from outside the repo, and reports names and
spellings worth adding to the app's dictionary, `converter/ingredient-names.md`.

```sh
node test/build.js && node test/ingredient-survey.js ~/kitchen-survey/*.md --out ~/kitchen-survey/report.md
```

---

### `converter/ingredient-extraction-prompt.md` — surveying recipes in bulk
**What:** A prompt that pulls only the ingredient lines out of a batch of recipes, each in the
standard shape and in the source's own words. Used with `test/ingredient-survey.js` to grow
`ingredient-names.md` from recipes it was not built from.

**Use it when:** before adding dictionary rows by hand, or every so often as the library
grows. **Don't** commit the extractions or the report: they are recipe text, and this repo is
public.

---

### `CLAUDE.md` — guidance for AI sessions
**What:** Since 27 Sep it opens with three short sections that any model follows to the letter: a
six-point checklist before every push; where a session stops and hands back (no merging, no
Edge Function deploys, no naming changes without a re-measure); and the only way to change
recipe text in the live database. Then the ground rules and the specific traps in this
codebase — the synchronous save pattern,
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
- **Database backups and photo backups.** Nightly dumps of the `public` and `private` schemas,
  and a weekly mirror of the photo bucket, go to the private `PrivateBackup` repo. The restore
  runbook is that repo's own `README.md`, rehearsed 23 Sep 2026.
- **Credentials.** See `docs/INFRASTRUCTURE.md` §4 for what lives where.

---

## Keeping these honest

Two audits found status records that were wrong — a Storage bucket reported as a finished
feature, and a backfill that never ran. Both were believed for days because nobody checked.

If you update these documents, **record what you verified and how**, not just what you did. And
when something turns out to have been recorded wrongly, correct it in place and say so rather
than quietly fixing it — the correction is more useful than the tidy result.
