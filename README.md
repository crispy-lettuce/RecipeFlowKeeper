# RecipeFlowKeeper

A personal recipe app for a few households of one family, each with its own recipes. Recipes are stored as a **flow** rather than a
list of steps: ingredients on the left, each column a moment in time, boxes merging as things come together, so you can prop a tablet
up in the kitchen and tick your way through a cook.

It also plans meals across a fortnight, builds a shopping list from that plan (combining quantities across recipes), scales any
recipe to a number of people, keeps a food diary, and can put the plan in Google Calendar.

Two code files, `index.html` and `core.js`, no build step, no framework. Data lives in Supabase. **`main` is production:** GitHub Pages
serves it, and every merge deploys.

## Start here

| If you want to… | Read |
| --- | --- |
| Know where things stand and what is open | [`docs/STATUS.md`](docs/STATUS.md) |
| Know what the app does, screen by screen | [`docs/SPEC.md`](docs/SPEC.md) |
| Understand how it is built and the recipe format | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Find the repos, Supabase, Google set-up, secrets policy | [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) |
| Add a family member or a new household | [`docs/ONBOARDING.md`](docs/ONBOARDING.md) |
| Deal with recipe photos | [`docs/IMAGES.md`](docs/IMAGES.md) |
| Run the regression pass against the real backend | [`docs/TEST-PLAN.md`](docs/TEST-PLAN.md) |
| See the jobs only the household can do | [`docs/HOUSEHOLD-JOBS.md`](docs/HOUSEHOLD-JOBS.md) |
| Know what was originally decided, and what the codes (S1, P3, R4 …) mean | [`docs/BUILD-BRIEF.md`](docs/BUILD-BRIEF.md) |
| See a schema change | [`docs/migrations/`](docs/migrations/) |
| Add a recipe | [`converter/conversion-instructions.md`](converter/conversion-instructions.md) |
| Work on the code as a Claude session | [`CLAUDE.md`](CLAUDE.md) |

The household's own how-to guide is [`help.html`](help.html), opened from Settings → HELP.

**Removed documents.** The plans, reviews and handovers written between September and October 2026 were removed on 22 Oct 2026, once
everything in them was built or recorded. They are all at commit `67b552e` of `main`: `git show 67b552e:docs/<file>`. A reference
in a code comment to a document that is gone, or a finding number such as `F5` (two review series overlap), is read there.

## Running it

```sh
git clone https://github.com/crispy-lettuce/RecipeFlowKeeper.git
cd RecipeFlowKeeper
python3 -m http.server 8080
```

Then open `http://localhost:8080`, not the file directly: a real origin makes sign-in and storage behave as they will in production,
and `localhost` counts as a secure context, so the screen-wake feature gets the real browser API. You need a household login to get
past the sign-in gate.

## Tests

```sh
npm install --no-save playwright@1.63.0   # once; the version CI pins
node test/core.test.js                    # the pure core in Node, seconds
node test/build.js && node test/smoke.js  # the page in a browser against a stubbed backend; slow
```

GitHub Actions runs both, and the smaller suites for the Edge Functions and the help guide, on every pull request; `offline-harness`
is required on `main`. See [`test/README.md`](test/README.md) for what the tests do and don't prove (they stub Supabase entirely, so
they say nothing about sign-in, hydration, row-level security or the write queue).

## Privacy

This repo is public. Recipe, planner and diary data never go in it: backups go to a private repo. The publishable Supabase key in
`index.html` is meant to be public; the service-role key and the database password never are.
