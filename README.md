# RecipeFlowKeeper

A personal recipe app for one household. Recipes are stored as a **flow** rather than a list of
steps — ingredients on the left, each column a moment in time, boxes merging as things come
together — so you can prop a tablet up in the kitchen and tick your way through a cook.

It also plans meals across a fortnight, builds a shopping list from that plan (combining
quantities across recipes), scales any recipe to a number of people, and keeps a history of what
was cooked when.

Single HTML file, no build step, no framework. Data lives in Supabase.

> **Status, September 2026:** live. `main` is the Supabase app and is production: GitHub Pages
> serves it, and every merge deploys. Work happens on short-lived branches merged by pull request.
> Start with [`docs/DOCUMENT-INDEX.md`](docs/DOCUMENT-INDEX.md). *(Corrected 23 Sep 2026 — this
> paragraph said "mid-migration, not merged" for ten days after it stopped being true.)*

## Start here

| If you want to… | Read |
| --- | --- |
| Know what to do next, and in what order | [`docs/NEXT-SESSION.md`](docs/NEXT-SESSION.md) |
| Find your way around all the documentation | [`docs/DOCUMENT-INDEX.md`](docs/DOCUMENT-INDEX.md) |
| Know what's built, verified, and outstanding | [`docs/HANDOVER.md`](docs/HANDOVER.md) |
| Understand how the app and its recipe format work | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Find the repos, the Supabase project, connection details | [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) |
| Know what was originally decided, and why | [`docs/BUILD-BRIEF.md`](docs/BUILD-BRIEF.md) |
| Add a recipe | [`converter/conversion-instructions.md`](converter/conversion-instructions.md) |

## Running it

No build step — it's one file. To run the current branch locally:

```sh
git clone https://github.com/crispy-lettuce/RecipeFlowKeeper.git
cd RecipeFlowKeeper
python3 -m http.server 8080
```

Then open `http://localhost:8080` — not the file directly. A real origin makes sign-in and
storage behave as they will in production, and `localhost` counts as a secure context, so the
screen-wake feature gets the genuine browser API.

You'll need the household login to get past the sign-in gate.

## Tests

```sh
npm install playwright
node test/build.js && node test/smoke.js
```

236 checks against a stubbed backend, run by GitHub Actions on every pull request. See [`test/README.md`](test/README.md) for what it does and
doesn't prove.
