# Documentation audit and rationalisation plan

**Written 22 Oct 2026** (`date -u`), against `main` at `67b552e` (PR #186). An audit and a plan only: **no document, code or
database row was changed to write it.** This file is itself temporary: it is deleted by the last PR in §7.

Evidence is from reading every file in `git ls-files`, running `git`, `grep` and the test suites, and reading the open issues
on GitHub. Things I could not check are in §10.

---

## 1. The verdict

The app is two code files and a handful of Edge Functions. The documentation around it is **40 top-level documents plus 11
migration pages, 1.41 MB of Markdown in `docs/`**, written since 14 Sep (the local clone is shallow and starts at 13 Oct; the
full history is on GitHub). Almost all of it is a record of how the work went, not a description of how things are.

| Class | Files | Size | State |
| --- | --- | --- | --- |
| Plans and proposals (`PLAN-*` 20, `PROPOSAL-*` 2) | 22 | 422 KB | Every one is built and merged except the parked #100 and (until their tablet checks pass) four more |
| Reviews (`REVIEW-*`) | 5 | 229 KB | Every finding is closed or recorded; two of the five are briefs for sessions that finished |
| Handovers (`HANDOVER*`) | 3 | 340 KB | `HANDOVER.md` is 291 KB, **76 % of it (lines 748–3202) a per-PR verification log**. Git, the PR descriptions and `changelog.json` hold the same facts |
| Index and next-session (`DOCUMENT-INDEX`, `NEXT-SESSION`) | 2 | 68 KB | The index is 53 KB: **bigger than all but six of the documents it indexes.** `NEXT-SESSION` says "where things stand" as of 12 Oct |
| Test passes and household jobs | 3 | 155 KB | `TEST-PLAN.md` is 65 % per-feature tablet steps 33–78a that `HOUSEHOLD-JOBS.md` repeats in plain words |
| Living references | 5 | 135 KB | The part worth keeping, with dated "Corrected …" notes through it |
| Migration pages | 11 | 63 KB | All applied; the only place the DDL is written down |

**The documents are mostly not wrong, they are heavy, and the numbers in them have drifted.** Only three path references in the
whole repo point at something missing (§3). But:

- Test counts are written in prose in six files and agree nowhere. Node suite: `README.md` says 206, `test/README.md`,
  `docs/ARCHITECTURE.md` §5 and `docs/NEXT-SESSION.md` say 218, `CLAUDE.md` says 263. Browser suite: 622, 713 (twice), 868 and
  921 respectively. **Run today: `node test/core.test.js` 263 checks, 0 failed, exit 0; `node test/build.js && node test/smoke.js` 922 checks, 0 failed, exit 0.** So even `CLAUDE.md`'s 921 is one behind.
- `README.md` is headed "Status, 12 Oct 2026". `NEXT-SESSION.md` and the index are written as of 12 Oct. Ten days and about
  60 PRs have passed (#126 to #186).
- `DOCUMENT-INDEX.md` calls `PLAN-BULK-ADD.md` "planned, not built". It is built (the plan's own header says PRs 1 and 2 are
  built; `index.html` has the ADD SEVERAL styles; `HOUSEHOLD-JOBS.md` has tablet check 69a).
- A new reader is told to read five documents in order (≈ 410 KB) before the one that says what is open.

**The cause is process, not carelessness** (§8): `CLAUDE.md` and the documents themselves require a `HANDOVER.md` paragraph per PR,
a plan file per feature that is never retired, a "Corrected on …" note instead of a plain edit, and double entry of every tablet
step. Following those rules is what produced the sprawl, so the rules change as part of the clean-up.

**The target: 9 documents in `docs/` (plus the 11 migration pages), about 260 KB, an 80 % cut,** with nothing in them that git
or GitHub does not already hold in better form. 33 files (1.07 MB) are removed; 6 are trimmed, 1 kept as is; 2 are new.

---

## 2. What has to survive, and why (the constraints)

These decide what can be removed safely.

1. **Files the product or CI reads.** `converter/conversion-instructions.md` (linked from the app and `help.html`; its sha256 is pinned in
   `test/core.test.js`), `converter/ingredient-names.md` (generated from `core.js` and `tools/ingredient-names-preamble.md`, compared
   byte for byte), `changelog.json`, `help.html`, `privacy.html`, `terms.html`, `styles/modernist.css`, `test/*`. None is a
   candidate. `test/help-guide.js` fails if a link from `help.html` to a repo file dies.
2. **`core.test.js` reads no document except those.** It does not read `docs/`, `README.md` or `CLAUDE.md`. Deleting anything in
   `docs/` cannot fail a test. (Checked: `grep readFileSync` over `test/*.js`.)
3. **Code comments cite documents: 180 mentions of the documents proposed for removal** (`PLAN-MODERNIST.md` 32,
   `PLAN-CALENDAR-PUSH.md` 16, `PLAN-READABILITY.md` 15 and so on), and 68 bare finding numbers (`F5`, `F45` …) that refer to two
   different review series whose numbers collide. **Do not rewrite them.** Editing `core.js` means a version bump in three places,
   editing `index.html` comments is churn with no household-visible effect, and each comment already says why in its own words.
   Instead, archive (§4) and state the convention once in `README.md`: *a reference in a code comment to a removed document is read at
   the archive tag.* Two citations are load-bearing and **are** fixed: `index.html:14` and `CLAUDE.md` cite `HANDOVER.md` §2e
   (the four refresh rules), which moves to `ARCHITECTURE.md` in PR 3.
4. **Runbooks hidden inside plans** must be lifted out before their plan goes: `PLAN-CALENDAR-PUSH.md` §10 (Google and Supabase
   set-up), `PLAN-DRIVE-BACKUP.md` §4 (Google Cloud steps), `PLAN-FOOD-DIARY.md` §5. They are how the project would be rebuilt.
   They go to `INFRASTRUCTURE.md`.
5. **Everything stays in git.** Deleting a file does not lose it. See §4 for making recovery one command.

---

## 3. Dead references found

Scan: every `docs|converter|test|tools|supabase|styles/…` path in every tracked `.md`, `.html`, `.js`, `.ts` and `.yml`, against `git ls-files`.

| Reference | Where | Verdict |
| --- | --- | --- |
| `supabase/functions/find-recipe-image/index.ts` | `REVIEW-2026-10-FINDINGS.md` | Deleted function, historical mention; goes with the file |
| `test/_prN-only.js` | `HANDOVER-2026-09-29-SESSION.md` | A scratch script; goes with the file |
| `test/app-under-test.html` | `ARCHITECTURE.md`, `HANDOVER.md`, `test/README.md` … | Not dead: built by `test/build.js`, git-ignored on purpose |

So there are **no broken links to fix.** The clean-up is about volume and staleness. (`test/help-guide.js` already guards the only
links that matter at runtime.)

Other findings:

- **Real recipe titles in a public repo.** On 13 Oct the household asked for recipe titles to be scrubbed from the docs (#101, "recipe A"
  and "recipe B"). One real title is still written out **9 times in 5 tracked files** (`HANDOVER.md`, `HANDOVER-CONVERSION-INTEGRITY.md`,
  `DOCUMENT-INDEX.md`, `TEST-PLAN.md`, `converter/test-set.md`), and `TEST-PLAN.md` line 964 names three more dishes. Most of those
  files are being removed, but **`converter/test-set.md` (kept) must be scrubbed** (lines 646 and 709), and the titles stay in git
  history either way (a history rewrite is out of scope and is the household's call, §9). `ARCHITECTURE.md` §2 also uses a real
  recipe, with its source address, as the worked example of the format; that is a published third-party recipe rather than the
  household's own, but the household may prefer a made-up one. No email address or credential was found in tracked prose; the only
  addresses are `*@example.test` in the tests.
- **Issues #94 and #95 are still open on GitHub** but built and merged on 13 Oct (`PLAN-SHOPPING-AUDIT.md`, `PLAN-INGREDIENTS-TAB.md`). #100 is parked. Closing is the household's
  call (§9).
- **`DOCUMENT-INDEX.md` entries carry the correction history of the other documents** ("Corrected 12 Oct 2026, the October review's F13 …").
  Ten such notes in the index, ten in `HANDOVER.md`, eleven in `INFRASTRUCTURE.md`, five in `ARCHITECTURE.md`. Each says what *used* to be wrong. Git
  already says that.
- **Triple statements of the same rules.** "`main` is production", "`PrivateBackup`'s default branch is odd", "all `load*` are
  synchronous", "`hydrate()` throwing signs you out" and the Supabase project ref each appear in `CLAUDE.md`, `HANDOVER.md` §8,
  `NEXT-SESSION.md`, `INFRASTRUCTURE.md` and the index.

---

## 4. Make removal reversible first (PR 0)

Before anything is deleted, mark the last commit that has every document:

```sh
git fetch origin main
git tag docs-archive-2026-10-22 67b552e      # or the then-current origin/main, if later
git push origin docs-archive-2026-10-22
```

Then `git show docs-archive-2026-10-22:docs/PLAN-MODERNIST.md` retrieves anything, and the convention in §2.3 is true. A tag is
a repository-visible action, so the household (or a session they ask) does this; I have not. If a tag is not wanted, record the
commit hash in `README.md` instead; it works the same.

---

## 5. Document-by-document verdicts

**Keep** = leave as is. **Trim** = keep, cut history. **Rewrite** = keep the name, replace the content. **Replace** = new document
takes over. **Remove** = delete after the extraction in the last column (to the archive tag).

### Top level

| File | Size | Verdict | What happens |
| --- | --- | --- | --- |
| `README.md` | 3 KB | **Rewrite** (small) | Drop the "Status 12 Oct" paragraph and the "Corrected" notes and the test counts; make its "Start here" table the only index; add the archive-tag convention |
| `CLAUDE.md` | 13 KB | **Trim + amend** | Update the reading list; replace "record in HANDOVER" and the TEST-PLAN double entry with the §8 rules; drop the 921/263 counts (say "run them; CI is the count"). All the safety rules stay word for word |
| `.mcp.json` | 0.2 KB | **Keep** | It is why a session can reach Supabase; not a document |
| `changelog.json` | 33 KB | **Keep** | Product file, read by the app |
| `help.html`, `privacy.html`, `terms.html` | 45 KB | **Keep** | Product |

### `docs/`: what stays (9 documents)

| File | Now | Target | Verdict |
| --- | --- | --- | --- |
| `ARCHITECTURE.md` | 41 KB | ~35 KB | **Trim + extend.** Remove the `~~strikethrough~~` and "Until 12 Oct this said …" asides. Add the sign-in/refresh section from `HANDOVER.md` §2e and the parser-keyword facts from §8. Replace the test counts with the commands |
| `BUILD-BRIEF.md` | 10 KB | 10 KB | **Keep, frozen.** The reference codes (`R4`, `P3`, `H1` …) are cited in code comments, and this is the only place they are defined |
| `INFRASTRUCTURE.md` | 38 KB | ~28 KB | **Trim + extend.** Condense the 100-line migration-history block to one line per migration pointing to its page; remove the 11 correction notes; delete the part of §2 that duplicates `PrivateBackup`'s own README (link to it); add the Google set-up runbook lifted from `PLAN-CALENDAR-PUSH.md` §10 and `PLAN-DRIVE-BACKUP.md` §4. §5 "Picking this up" points at `STATUS.md` |
| `ONBOARDING.md` | 12 KB | ~9 KB | **Trim.** Runbook; drop correction notes only |
| `IMAGES.md` | 34 KB | ~14 KB | **Trim.** Keep "Answers first", the sweep, integrity checks, "what can go wrong" and "verifying". Remove §4 (why it was manual until 22 Sep) and §5's "options not taken" (B, C, D), which become three lines in `FEATURES.md` |
| `TEST-PLAN.md` | 95 KB | ~25 KB | **Trim hard.** Keep sections A–F (sign-in, hydration, write queue, export/import, two devices, shopping list, recipes coming in), the "things that look like bugs", "if something fails" and the expected-counts query; fold in `TEST-IMAGES.md` as a 10-line section. **Delete steps 37a–78a (lines ~259–928):** the open ones already live in `HOUSEHOLD-JOBS.md`; the passed ones are history. Delete "After a clean pass" (self-described history, written for the 21 Sep pass) |
| `HOUSEHOLD-JOBS.md` | 47 KB | ~20 KB | **Trim.** Keep "At a glance", the quick jobs and the open checks. Keep "Recently done" for the last 7 days only (it now runs back to 12 Oct, several entries of a hundred words or more). Becomes the single place for a tablet step |
| `FEATURES.md` | new | ~40 KB | **Replace** the 26 plans/proposals. One short entry per shipped feature (§6) |
| `STATUS.md` | new | ~12 KB | **Replace** `HANDOVER.md` + `NEXT-SESSION.md` + `DOCUMENT-INDEX.md` (§6) |
| `migrations/*.md` (11) | 63 KB | 63 KB | **Keep.** All applied; the SQL and the how-to-check live nowhere else (`*.sql` is git-ignored on purpose). Code comments cite them 37 times. Low value in the "tried first on a scratch Postgres" prose, but not worth a risk |

### `docs/`: what goes (33 documents, ~1.07 MB)

| File | Size | Verdict | Why it is obsolete / what to lift first |
| --- | --- | --- | --- |
| `DOCUMENT-INDEX.md` | 53 KB | **Remove** | Replaced by `README.md`'s table and `STATUS.md`. Nothing to lift |
| `NEXT-SESSION.md` | 15 KB | **Remove** | Rewritten into `STATUS.md`. Lift: the session-start prompt and the "two things not to undo" |
| `HANDOVER.md` | 291 KB | **Remove** | Lift: §1 requirement-status table → `STATUS.md`; §2e → `ARCHITECTURE.md`; §8 facts → `ARCHITECTURE.md`; §5 backups → already in `INFRASTRUCTURE.md`. §2–§2d, §3, §4, §6, §7 (≈ 2,700 lines) are history |
| `HANDOVER-2026-09-29-SESSION.md` | 25 KB | **Remove** | A session note for 29 Sep that says it is superseded in its first lines. Nothing to lift |
| `HANDOVER-CONVERSION-INTEGRITY.md` | 24 KB | **Remove** | Its open decisions (§7) were answered on 29 Sep in `PLAN-NEW-RECIPE-FLOW.md`. Also carries the real recipe title. Nothing to lift |
| `REVIEW-ARCHITECTURE.md` | 13 KB | **Remove** | The brief for a finished review |
| `REVIEW-INGREDIENT-MATCHING.md` | 17 KB | **Remove** | Likewise, and it says its examples are made up |
| `REVIEW-ARCHITECTURE-FINDINGS.md` | 60 KB | **Remove** | All findings closed by the seven-PR plan. Cited by number (`F1`, `F5` …) in code: the archive tag covers it |
| `REVIEW-INGREDIENT-MATCHING-FINDINGS.md` | 46 KB | **Remove** | Steps 1–7 all built. Lift: "ticks key on the name alone, so a naming change re-keys them" (already in `CLAUDE.md`) and the re-measure routine (already in `test/README.md`) |
| `REVIEW-2026-10-FINDINGS.md` | 93 KB | **Remove** | All 8 PRs merged 11–12 Oct (the document says so). Cited by number (`F23` … `F50`) in code; those numbers collide with the September series, which the convention in §2.3 mentions |
| `PROPOSAL-AISLE-OVERRIDES.md`, `PROPOSAL-NEW-RECIPE-REVIEW.md` | 29 KB | **Remove (PR 3)** | Both superseded by `PLAN-NEW-RECIPE-FLOW.md`, which was built. Lift: the "one key and one home per fact held about an ingredient" rule → `FEATURES.md` |
| `PLAN-NEW-RECIPE-FLOW.md` | 67 KB | **Remove** | Eight PRs built. → `FEATURES.md` "Adding a recipe" |
| `PLAN-MODERNIST.md` | 73 KB | **Remove after tablet check 66a passes** | Largest plan; the decision log D1–D69 is the one part with standing rules. Lift ~20 lines of them. Until 66a is reported, the "questions in the Decision log" are open |
| `PLAN-READABILITY.md` | 25 KB | **Remove after 61a–65a** | All five changes built. Lift the type scale, the 44 px rule and the colour-token rule |
| `PLAN-CALENDAR-PUSH.md` | 42 KB | **Remove** (lift §9 design, §10 set-up) | Built and connected. §12 (reminder per meal) is built and checked (75a) |
| `PLAN-SIDES.md` | 26 KB | **Remove** | #87, #142 built, tablet-checked |
| `PLAN-PREP-STEPS.md` | 18 KB | **Remove** | #88 built, checked |
| `PLAN-BULK-ADD.md` | 18 KB | **Remove after 69a** | Built; index still says "not built" |
| `PLAN-ADHOC-PLANNER.md` | 16 KB | **Remove after 78a** | PRs 1–3 built; 77a passed, 78a open |
| `PLAN-INGREDIENTS-TAB.md`, `PLAN-SHOPPING-AUDIT.md` | 29 KB | **Remove** | Built 13 Oct, checks 54a/55a passed. #94 and #95 still open as issues |
| `PLAN-LAYOUT.md`, `PLAN-COOKING-NOTES.md`, `PLAN-SOURCE-PHOTOS.md`, `PLAN-FOOD-DIARY.md`, `PLAN-DRIVE-BACKUP.md`, `PLAN-RECIPE-SHARING.md`, `PLAN-LIQUID-MEASURES.md`, `PLAN-SPLIT-TRIAGE.md` | 80 KB | **Remove** | All built and checked or in use. Lift runbook steps (§2.4) first |
| `PLAN-TEST-HOUSEHOLD.md` | 10 KB | **Remove** | "Done 18 Oct"; the SQL and result are in `PrivateBackup` `migrations/test-household-split/`. Lift: one line saying `286a8a12…` is Test Kitchen (already in `INFRASTRUCTURE.md`) |
| `PLAN-PREVIEW-SITE.md` | 17 KB | **Remove** | Parked. Post the recommendation (GitHub Pages stays live, Cloudflare Pages previews) as a comment on issue #100 and delete: a parked idea belongs in its issue, not in 147 lines nobody reads |
| `TEST-IMAGES.md` | 12 KB | **Remove** | Folded into `TEST-PLAN.md` (10 lines). Its own header says first run 22 Sep and revised |

Conditional rows ("after 66a / 61a–65a / 69a / 78a") are because those plans are still the written spec for a tablet check the household has
not reported. If the household would rather not wait, §9 question 4 closes them.

---

## 6. The two new documents

**`docs/STATUS.md` (~12 KB, one page to read first).** Replaces three. Sections:

1. **Where things stand**: versions (`APP_VERSION`, `KITCHEN_CORE_VERSION`), households, schema nothing waiting on, Edge Functions deployed. *Each line says how and when it was checked.* No test counts.
2. **Build Brief requirements → status**, one row per code (from `HANDOVER.md` §1: S, P, R, C, H, A series), pointing to the `FEATURES.md` entry.
3. **Open**: tablet checks waiting (link to `HOUSEHOLD-JOBS.md`), parked work (#100), the household's choices.
4. **Not to undo**: the `PrivateBackup` default branch and the two backup-workflow fixes; `main` is production.
5. **Starting a session**: the prompt from `NEXT-SESSION.md`, shortened.

**`docs/FEATURES.md` (~40 KB).** One entry per feature, about 12 lines each, in a fixed shape so it can be grep'd:

> **Name** (issue/PR, version) · *What it does* in two lines · *Where*: functions or files · *Needs*: migration page, Edge Function, setting · *Standing decisions*: the "do not relitigate" lines, each with the reason · *Checked*: tablet step and date, or "by use".

About 30 entries from the 22 plans/proposals: new-recipe flow (review band, source check, aisle overrides, LIBRARY CHECK), source photos, cooking notes, food diary/PRE-MADE, calendar push, Drive backup, recipe sharing, liquids, prep steps,
sides/OFTEN WITH, shopping AUDIT, ingredients tab, layout, readability, Modernist, ad-hoc entries, bulk add, split triage,
test household, image re-hosting, dark mode, diary. This is the "new reference document" the task allows for: it is written
from the plans, not copied from them, so each plan is read once, by the session that deletes it.

---

## 7. Execution: six small PRs, in this order

Every PR is documentation-only, so none needs a `changelog.json` entry or a version bump (`CLAUDE.md` 2, 2a) **unless it
touches `core.js` or `tools/ingredient-names-preamble.md`** (see PR 5). Each runs `core.test.js` (it also checks the generated
dictionary) and `build.js && smoke.js`, reads `echo $?`, and reads its own `git diff origin/main` for private data (`CLAUDE.md` 5).

| PR | Does | Check that it worked |
| --- | --- | --- |
| **0** | Archive tag (§4). No file change | `git show docs-archive-2026-10-22:docs/HANDOVER.md \| wc -l` prints 3232 |
| **1** | Scrub the real titles from `converter/test-set.md`; trim its three library audits (lines 635–753, dated 13 to 20 Sep; the index itself calls the first two history) | `git grep -il '<the title>'` returns only files due for removal; the 16 tests still read correctly. **Make it fail once:** put the title back and see the grep find it |
| **2** | Remove the four files with nothing to lift: `HANDOVER-2026-09-29-SESSION`, `HANDOVER-CONVERSION-INTEGRITY`, `REVIEW-ARCHITECTURE`, `REVIEW-INGREDIENT-MATCHING` | Re-run the §3 path scan: no new dead references appear in a *kept* file |
| **3** | Write `STATUS.md` and `FEATURES.md`; lift `HANDOVER.md` §2e/§8 into `ARCHITECTURE.md` and the Google runbooks into `INFRASTRUCTURE.md`; **then** remove `HANDOVER.md`, `NEXT-SESSION.md`, `DOCUMENT-INDEX.md`, and every `PLAN-*` and `REVIEW-*` whose tablet check has passed. Fix `index.html:14` and `CLAUDE.md`'s §2e citations (comments only, so no changelog) | Scan again. Every state in `STATUS.md` has a "checked how, when". Spot-check five `FEATURES.md` entries against the code |
| **4** | Trim `IMAGES.md`, `INFRASTRUCTURE.md`, `TEST-PLAN.md` (+ `TEST-IMAGES.md`), `HOUSEHOLD-JOBS.md`, `ONBOARDING.md`, `ARCHITECTURE.md`, `test/README.md` | `test/help-guide.js` still passes; `TEST-PLAN.md` still has the expected-counts query; no `docs/` file over ~40 KB |
| **5** | `README.md` and `CLAUDE.md` amended (§8 rules, new reading list, no counts). If `tools/ingredient-names-preamble.md` still cites removed documents, edit it **and** run `node tools/generate-ingredient-names.js`, commit both | `core.test.js` green (it fails on a stale `ingredient-names.md`). Final scan: nothing in `README.md`, `CLAUDE.md`, `docs/` points at a removed file. **This PR deletes this plan** |

Plans waiting on a tablet check (`PLAN-MODERNIST`, `PLAN-READABILITY`, `PLAN-BULK-ADD`, `PLAN-ADHOC-PLANNER`) are removed in
whichever of PR 3 or a later PR follows the household's report, or all in PR 3 if question 4 is answered "close them".

**Rollback:** every PR is revertable; the tag has the lot.

**A guard against regrowth (optional PR 6, small):** `test/docs-links.js`, run by CI, that fails if a path in `README.md`, `CLAUDE.md` or
`docs/*.md` does not exist, or if a number followed by "checks" appears in them. It is the §3 scan made permanent. Per `CLAUDE.md`
rule 3 it must be seen failing once (add a dead path; see it named). It costs one CI step and ends this kind of drift.

---

## 8. Process rules that stop it growing back (go into `CLAUDE.md`)

1. **The PR description is the verification record.** A PR no longer adds a paragraph to a handover document. What was checked
   and what was not goes in the PR body (`CLAUDE.md` 6 already asks for this).
2. **A plan is a working file with an end.** It lives in `docs/PLAN-<name>.md` only while the feature is unbuilt or unchecked. When the
   last PR merges and the tablet check passes, the same PR that closes it adds the feature's `FEATURES.md` entry and deletes the plan.
   A parked plan goes to its issue.
3. **Correct in place, no "Corrected on …" notes.** `git log` is the correction history. (`CLAUDE.md` keeps its one rule, "verify rather than trust".)
4. **No counts of checks in prose.** CI and the command's own output are the count.
5. **A tablet step lives once, in `HOUSEHOLD-JOBS.md`**, in plain words with "You should see". It is removed when reported passed. `TEST-PLAN.md` holds only the standing regression pass.
6. **One index.** `README.md`'s table. Nothing else lists the documents.
7. **State a date and a source for every status line** (`date -u`, `git log`, a query), and drop the line when it can't be checked.

---

## 9. Decisions needed from the household

1. **Create the archive tag** (§4), or record the commit hash in `README.md` instead? *Recommend the tag.*
2. **`converter/ingredient-extraction-prompt.md` and `test/ingredient-survey.js`:** remove? They exist to grow the dictionary from a bulk
   extraction of recipes; nothing else calls the survey (`test/ingredient-lines.js` stays: `core.test.js` uses it). With ADD SEVERAL,
   LIBRARY CHECK and the in-app preview doing that job, I judge them obsolete (about 19 KB, plus their mentions in `test/README.md`), but only you know whether the
   survey is still done by hand. *Recommend remove.*
3. **Close issues #94 and #95** (built 13 Oct) and **post the preview-site recommendation on #100**, then close or leave it open as "parked"?
4. **The tablet-check backlog.** 61a–65a (Classic readability), 66a (Modernist), 67a–70a, 71a, 72a–74a, 76a, 78a and L1 are all
   reported open. Several are 8 to 9 days old. Either pass them, or decide "tested by use" for the old ones so their plans can go. Until then four plans and ~55 KB of
   `TEST-PLAN.md` / `HOUSEHOLD-JOBS.md` stay. *Recommend a cut-off: any step with no report after 14 days is closed as unverified.*
5. **`test/shots.js`** (37 lines, writes git-ignored PNGs; named only in `test/README.md` and the handover). Keep as a convenience or delete? Trivial either way.
6. **Rewriting git history** to remove the one real recipe title? *Recommend no:* the title is low-risk, the household's own #101 decision was
   about the docs not the history, and a history rewrite of a public repo breaks every clone and PR link.

---

## 10. What I did not verify

- **Test baseline.** Both suites were green before this file was added (counts in §1). The first smoke run was killed by my own 540 s timeout at
  check 900; the second, unlimited, run took about 25 minutes in this container and passed. CI was not consulted.
- **`PrivateBackup`.** I read its file list, `README.md` and workflow sizes only. It is 3.5 MB of dumps, 8.9 MB of photos, three workflows and
  the job folders under `migrations/` (the undo files for live changes). I recommend removing nothing there, and I did not check its README line by line.
- **Live state.** I did not query Supabase. Every "built and merged" above is from the documents' own headers, `git log`, `HOUSEHOLD-JOBS.md`,
  `index.html` and the open-issue list; I did not confirm which PRs are merged beyond `main`'s history on GitHub (open PRs: none).
- **The ~60 PRs between #126 and #186** were not individually reviewed.
- **Size targets in §5** are estimates from line counts, not from a draft.
- **180 code citations** (§2.3) were counted, not read.
