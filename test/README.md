# Offline test harness

Boots the real `index.html` in a headless browser with a fake Supabase behind
it, walks every screen, and fails on any console error or broken expectation.
No network, no account, no touching the live database.

## Running it

```sh
npm install playwright   # once
node test/build.js       # bake a runnable copy against the stub
node test/smoke.js       # walk it; exits non-zero on any failure
```

`build.js` writes `test/app-under-test.html` — a copy of the app with the two
CDN `<script>` tags swapped for `stub.js` and a set of canned rows injected.
Re-run it after every change to `index.html`; `smoke.js` reads only that copy,
never the original.

`node test/shots.js` writes a PNG of each main screen, for eyeballing a layout
change without a browser to hand.

Both scripts use whichever Chromium Playwright installs. Set
`PLAYWRIGHT_CHROMIUM` to an executable path if yours lives somewhere else.

## What it can and can't tell you

**174 checks.** It covers the parts that are pure app logic: week bucketing, scaling,
shopping-list totals and unit merging, tick behaviour, the planner's per-day servings, the
`SOURCE_URL` round trip, the `[instant]`/`[overnight]` duration keywords, the automatic image
re-host on save, and that every screen renders without throwing.

**`node test/build.js` first, every time.** `smoke.js` opens `test/app-under-test.html`, which
`build.js` writes from `index.html`. Run `smoke.js` on its own after editing the app and you are
testing the previous build — which passes, or fails for a reason that no longer exists. That has
cost real time here.

It cannot tell you anything about **Supabase itself** — `stub.js` answers every
query from a fixed object and records writes to `window.__WRITES__` rather than
sending them. Sign-in, row-level security, the write queue and hydration are
all unexercised, so a green run is not a substitute for opening the real app
once. **Keep Awake** can't be tested here either; it needs a real tablet.

## The canned data

Two recipes, two planned days, one meal group, a shortlist item and a
handful of keywords — all invented, in `build.js`. Deliberately no real recipes:
this repo is public.
