# Plan: try a change on the tablet before it goes live (issue #100) — PARKED

**Written 13 Oct 2026** (`date -u`), against `main` at `e11de60` (#131). Line numbers are at that commit. A plan only:
nothing here is built, and no repo, dashboard or service was changed to write it.

**The ask, as the household clarified it:** "better control of versioning simply meant that when we merge changes we
could do it away from the 'active' site and still do our testing." Today there is no such place: `main` is
production, GitHub Pages serves it, and every merge reaches both households' app within minutes with no staging step
(`docs/HANDOVER.md` §8 line 2730; `docs/INFRASTRUCTURE.md` lines 94 and 409).

## 1. What depends on the site's address and hosting

| Thing | Where | Moves if production moves? | Matters for a preview? |
| --- | --- | --- | --- |
| **CORS allow-list in all five Edge Functions**, `^https://crispy-lettuce\.github\.io$` plus localhost | `rehost-images/index.ts:324`, `source-ingredients/index.ts:31`, `calendar-auth/index.ts:50`, `calendar-sync/index.ts:42`, `drive-backup/index.ts:33` | Yes, all five, then five redeploys by the household | **Yes.** From any other origin the browser blocks every `functions.invoke`: re-hosting a photo after a save (`index.html:3683`, `8702`), COMPARE WITH SOURCE (`9810`), calendar sync and CONNECT/DISCONNECT (`4307`, `8562`, `8576`), Drive backup (`8521`). Everything else still works (below) |
| **Calendar return address**: `safeReturnTo` accepts only an `ALLOWED_ORIGIN` origin; the app sends `location.origin + location.pathname` | `calendar-auth/index.ts:98-104`, `232-233`; `index.html:8562` | Yes (same regex) | Only if calendar CONNECT is tried on a preview |
| **`APP_URL` = the github.io address**: fallback return after an expired consent, the calendar's description, each event's description | `calendar-auth/index.ts:47`, `159-160`, `194`; `calendar-sync/index.ts:40`, `151` | Yes; events already in Google Calendar keep the old link | No |
| **Google OAuth redirect URI** is the *function's* address, `https://mhkayefzrtceesgizkjs.supabase.co/functions/v1/calendar-auth/callback`; "No JavaScript origins are needed" | `docs/PLAN-CALENDAR-PUSH.md:232-233`; built at `calendar-auth/index.ts:151` | **No** | No |
| Google consent screen branding (home page, privacy and terms links to `privacy.html`, `terms.html`) | Google Cloud console, not in the repo; `docs/DOCUMENT-INDEX.md:547-557` | **To check**: what the console holds now | No |
| **Supabase Auth URL configuration** (Site URL, Redirect URLs) | Supabase dashboard → Authentication → URL Configuration, not in the repo | Site URL should follow, for invite emails (`docs/ONBOARDING.md:24`) | **No.** The app signs in by password only (`signInWithPassword`, `index.html:10678`); no `redirectTo`, magic link, OAuth sign-in or password reset exists in it. A wildcard such as `https://*.<project>.pages.dev/**` is needed only if one is ever added (Supabase: `*` stops at `.` and `/`, `**` does not). Current Site URL value: **to check** |
| Supabase REST, Auth, Storage | `SUPABASE_URL`, `index.html:2754` | No | Expected to answer any origin (the app's tables, sign-in and photos would work from a preview): **to check** with one preview load |
| Hard-coded github.io addresses elsewhere | `docs/ONBOARDING.md:29`, `179`; `docs/INFRASTRUCTURE.md:68`; `docs/IMAGES.md:102`, `419`; `docs/REVIEW-ARCHITECTURE.md:215`; `test/calendar-push.js:93`, `175-181`; `PrivateBackup` `scripts/weekly-live-check.js:38` | Yes, all | No |
| Links to github.com (`blob/main/…` converter and changelog, issue links) | `index.html:1567`, `1900`, `3001` | No | No (they show `main`'s file, not the branch's) |
| Relative links: `help.html`, `privacy.html`, `terms.html`, `changelog.json`, `core.js` | `index.html:1893-1917`, `2084`, `2975` | No | No: each preview serves its own copies |
| **Cache-busting and the UPDATE bar**: `core.js?v=` (`index.html:2084`), `EXPECTED_CORE_VERSION` (2092), `KITCHEN_CORE_VERSION` (`core.js:28`), `coreMismatch` (2103); the comments assume GitHub Pages' ten-minute cache (`index.html:2085-2091`, `core.js:22-27`) | | Works unchanged; the comments would need rewording, and Cloudflare's own cache headers are **to check** | Works: a preview's two files carry the branch's versions |
| **"A new version is ready"**: `changelog.json` fetched relative, no-store, at most every ten minutes (`index.html:2963-2989`); `kitchen.lastSeenVersion` (3008-3010) | | Works unchanged | A preview compares against its own `changelog.json`, so it never announces production's version and production never sees the preview's |
| Service worker, manifest, offline file cache | none: no `serviceWorker` or manifest anywhere; OFFLINE is `navigator.onLine` (`index.html:2913`) | — | Nothing to scope |
| **Per-origin browser storage**: supabase-js session (`persistSession`, `index.html:2774`), `kitchen.darkMode` (38, 2182), `kitchen.cookingTimeline` (5674-5682), `kitchen.settingsTab` (8646-8650), `kitchen.lastSeenVersion` | | Every device signs in again; the four conveniences reset | Each preview address is its own origin: sign in once per address, conveniences start blank, the browser's saved password may not be offered |
| CI: `offline-harness` (`.github/workflows/tests.yml`), a required check on `main` | | No | No; it stays the gate. A Cloudflare status on the PR must not be made required |

## 2. The catch that matters most: there is only one database

A preview is the new code against the **live** project. There is no staging database. Branching is **not included on
Supabase's Free plan** (its pricing page; Pro charges $0.01344 per branch-hour on top of the Pro fee: search result,
13 Oct, not read first-hand: **to check**). A second free project as a staging copy is possible in principle (two free
projects per organisation: **to check**) but doubles every migration, function deploy, secret and the Google client,
and a free project pauses after a week unused; not recommended now.

**Signed in as the family on a preview, every action is real**: a recipe edit, a tick, a plan change, a diary row.
Worse than production in three ways: the code is unreviewed by use; a PR that needs a migration fails its saves until
the household has applied it (already the rule: SQL first); and some actions reach outside the app: calendar sync to
the real Google Calendar, a Drive backup into their Drive, DONE on the CONVERTER bar sets that household's
`household_settings.converter_ack_version` for everyone in it. A change to `shoppingLine` or the dictionary re-keys
real ticks the moment the preview builds a list and someone ticks. Two tabs of different code on the same data is the
stale-tab case `refreshLibrary` guards (`docs/HANDOVER.md` §2e); that guard is in both copies, but an old preview left
open after merge is still an old tab.

**Mitigations, in order of preference:**
1. **Test as the test household.** It exists (`docs/INFRASTRUCTURE.md` §3 Households) and the weekly live check signs
   into it (`PrivateBackup` `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`). RLS keeps it apart from both families. It is near
   empty, since the weekly check removes what it adds; it would need a few made-up recipes. Whether extra rows would
   upset the weekly check: **to check** in `scripts/weekly-live-check.js`. Whether the household knows that password
   or wants a second test account: **to ask**. Calendar and Drive on the test household need a Google account of its
   own; leave them untested on previews unless the PR is about them.
2. **Family account, looking only**: fine for layout and reading; anything saved is saved for real.
3. **Close preview tabs after merging**, and delete stale previews if the host keeps them.

## 3. The options (all free)

| | (A) Cloudflare Pages for everything | (B) GitHub Pages stays; Cloudflare Pages for previews only | (C) GitHub Pages stays; a long-lived `staging` branch on a second site |
| --- | --- | --- | --- |
| What the household gets | Production from `main` at a new address; a preview address per branch/PR; one-click rollback to any earlier production deploy (Cloudflare dashboard) | Production exactly as now; a preview address per branch/PR, linked from the PR | One fixed test address showing whatever was merged into `staging`; then a `staging` → `main` PR |
| Address change for the families | **Yes**: every device signs in again, new bookmark/home-screen icon, both households told; the old github.io site must be turned off or replaced by a pointer, or a tab left there runs old code indefinitely | None | None |
| Code changes | 5 functions' `ALLOWED_ORIGIN` + 2 `APP_URL`; tests at `calendar-push.js:93`, `175-181`; weekly check's URL; docs (§1 table); cache comments | 5 functions' `ALLOWED_ORIGIN` only (optional: without it previews lack photos re-hosting, COMPARE WITH SOURCE, calendar and Drive); tests for the new pattern | If the second site is another github.io repo: **none** (same origin, so CORS already passes). On another host: as (B) |
| Household dashboard work | Cloudflare account + GitHub app; Supabase Site URL; Google console branding (**to check**); 5 redeploys; GitHub Pages off | Cloudflare account + GitHub app; 5 redeploys (if the CORS PR is taken) | A second public repo with Pages, or a second host; a sync routine for `staging` |
| Rollback | One click | As today: revert the PR (CI runs again, minutes) | As today |
| Effort | Largest; touches every household | Small | Small to set up, but a second branch to keep level with `main`, and CLAUDE.md's PR-to-`main` flow changes |
| Specific trap | Two live sites during the move | Previews are public by default (the code is public anyway; the app needs a sign-in). An Access policy can gate previews only (free up to a user cap: **to check**) | **Same-origin trap** for a github.io second site: `crispy-lettuce.github.io/RecipeFlowKeeper-staging/` shares origin, so it shares the sign-in (`sb-<ref>-auth-token`) and the four `kitchen.*` keys with production. Signing into the test household there signs the production tab into it too. Avoid |

Free-plan limits (Cloudflare's limits page, via search on 13 Oct: **to check** first-hand): 500 builds a month, one
at a time, 20,000 files. This repo had 101 PRs and 221 PR commits from 13 Sep to 13 Oct (GitHub API, counted), so
builds would run well under 500 but not trivially; Cloudflare's branch rules can limit builds to `claude/*` branches.
Cloudflare now steers new projects towards Workers static assets rather than Pages (third-party claim: **to check**);
the plan holds either way, with "Pages" read as "whichever Cloudflare product gives per-branch previews". Netlify's
deploy previews would do the same job; its current free allowance is **to check**.

## 4. Recommendation: (B), Cloudflare Pages for previews only

It gives the household exactly what they asked: each PR gets an address to try on the tablet, and merging stays the
one act that changes the live app. Nothing changes for either family's devices, Google, the weekly check or the docs'
address. It is reversible by deleting the Cloudflare project. (A) can follow later if one-click rollback becomes
wanted; nothing in (B) is wasted by it. Start with per-PR previews, not a `staging` branch: a branch to batch several
PRs can be added later on the same Cloudflare project if per-PR testing proves too fiddly.

### Steps, in order

**Household (dashboards; a session cannot and does not):**
1. Create a free Cloudflare account; Workers & Pages → Create → connect to Git → install the Cloudflare GitHub app on
   `crispy-lettuce/RecipeFlowKeeper` only.
2. Project name (it becomes `<name>.pages.dev`; uniqueness **to check**). Framework none, build command empty, output
   directory the repo root. Production branch `main`; **turn production deploys off** (or, if the setting cannot, leave
   `<name>.pages.dev` as an unannounced mirror) so there is one live address. Preview branches: `claude/*` (and
   whatever the household uses). Exact setting names: **to check** at the time.
3. Decide on an Access policy for previews (recommend off: the app's own sign-in suffices, and an email PIN on the
   tablet is friction).
4. Confirm that pull requests from forks are not built (**to check**), which keeps the widened CORS pattern ours.
5. Decide which account tests on previews (§2), and seed it or ask a session to (single made-up rows, as asked).
6. After the session's PR merges (below): redeploy the five functions from raw URLs pinned to the merge commit
   (`docs/INFRASTRUCTURE.md` §3), Verify JWT as now (off only for `calendar-auth`).

**Session (one PR, after the household has done 1-2 and named the project):**
7. Widen `ALLOWED_ORIGIN` in the five functions to also accept `^https://([a-z0-9-]+\.)?<name>\.pages\.dev$`, with a
   comment saying why; nothing else in them.
8. Tests. Only `test/calendar-push.js` lifts `ALLOWED_ORIGIN` today (line 34, from `calendar-auth`): add the preview
   origin accepted by `safeReturnTo`, and look-alikes refused (`<name>.pages.dev.evil.example`, `evil<name>.pages.dev`,
   the `http://` form). Add one check that all five functions carry the same pattern, since nothing tests the other
   four's. Make each new check fail once.
9. Docs in the same PR: `docs/INFRASTRUCTURE.md` (a Cloudflare row in §1, a paragraph in §2, "main is production" kept
   but "previews at …" added; the function versions after the redeploy, in this PR or the next), `docs/HANDOVER.md`
   §8, `docs/IMAGES.md:419`, CLAUDE.md "Where a session stops" (give the household the preview link with the PR, and
   say which account to test with), `docs/HOUSEHOLD-JOBS.md` (the steps above; #100 off "your own issues"),
   `docs/TEST-PLAN.md` (a preview step). No `changelog.json` entry: nothing changes in the app the families use.

### How each step would be verified
- Cloudflare connected: the next PR shows a Cloudflare deployment status with a link; `gh api` on the commit's
  statuses shows it. Branch alias address format (`<branch>.<name>.pages.dev`, how `claude/…` is turned into a host
  name): **to check** on the first build.
- Production unaffected: `pages build and deployment` still runs per merge; the github.io site's `APP_VERSION`
  matches `main`'s `changelog.json` top entry.
- The preview is the branch: its Settings → HELP version equals the branch's `APP_VERSION`, and the first load shows
  no UPDATE bar.
- Supabase answers the preview origin: sign in as the test household; the library loads; a save survives a reload.
- CORS widened: after the redeploys, `get_edge_function` reads back each function with the new pattern; on a preview,
  COMPARE WITH SOURCE answers and a saved photo re-hosts (test household). A look-alike origin is shown refused by
  the tests, not live.
- Nothing about sign-in changed: no Supabase Auth URL setting was touched (none is needed for (B)).
- Not verifiable by a session: the Cloudflare and Supabase dashboard settings themselves, and the tablet. The household
  reports each step as `docs/HOUSEHOLD-JOBS.md` asks.

## 5. Decisions (answered 13 Oct 2026; still parked)

**Answered by the household on 13 Oct 2026: "defaults on all plans".** The plan stays **parked**; when it is picked up: option (B);
test as the test household (§2); per-PR previews; previews public, with no Access gate (§4 step 3); production stays on GitHub
Pages for now; and the CORS PR is taken (§4 step 7). The questions as they were asked:
1. Who tests on previews, and as whom: the test household (needs its password and some made-up recipes) or the family
   account knowingly?
2. Per-PR previews (recommended), or a `staging` branch to batch several PRs before one merge?
3. Previews public, or behind a Cloudflare Access email PIN?
4. Is one-click rollback wanted enough to move production too, i.e. (A), later?
5. Take the CORS PR at all? Without it previews still test everything except photos re-hosting, COMPARE WITH SOURCE,
   calendar and Drive backup.

## 6. To check before building
Supabase Site URL's current value; Google consent-screen links (only for (A)); Supabase REST/Auth/Storage accepting
any origin; Supabase branching and second-project terms on Free; Cloudflare's free limits, fork-PR builds, alias
format, how to disable production deploys, Pages-versus-Workers; whether extra rows in the test household affect the
weekly live check; Netlify's free allowance if Cloudflare is ruled out.
