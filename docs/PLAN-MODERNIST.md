# PLAN-MODERNIST: a second visual style, "Modernist" (15 Oct 2026)

**Status:** being built, one step at a time on a branch; nothing is on `main` yet. Steps 1 (the switch) and 2 (the sidebar) are built. See "Build order".

The household has a design handoff (a README, an HTML prototype and a token sheet) for a flat, square, one-typeface look for the
tablet in landscape (1280×800). It is added as a **second style beside Classic, not instead of it**: Settings → APP has a STYLE
choice, CLASSIC or MODERNIST, next to APPEARANCE. Classic stays exactly as it was. The handoff folder is **not in this repo**
(it is public and served by Pages, and its sample recipes cannot be checked against the library); the household keeps it.

## What was decided (15 Oct 2026, "proceed with recommendations")

1. **Per device.** STYLE is in `localStorage` (`kitchen.style`), never the database, and is written to nothing. APPEARANCE stays
   household-wide. The four combinations (Classic and Modernist, light and dark) all work.
2. **A layer, not a fork.** The DOM is shared. Modernist is `styles/modernist.css`, every selector under `[data-style="modernist"]`
   (dark: `[data-style="modernist"][data-theme="dark"]`). Classic's `<style>` is not edited. An element only Modernist draws carries
   `.mod-only`; where one piece of markup cannot serve both, the render function asks `currentStyle()` and the screen is redrawn on
   switch (`rerenderForStyle`).
3. **The bridge.** The stylesheet first re-points Classic's own variables (`--paper`, `--ink`, `--plum`, `--line`, `--r`…) to the
   Modernist tokens, so anything the handoff does not draw (dialogs, banners, the group viewer, the sign-in card) wears the same
   colours, square corners and typeface. `--plum` (text) is accent-700; the vivid accent is for fills and large type.
4. **Archivo** is loaded only when Modernist is on (the boot script, or `applyStyle` on choosing it). Classic's fonts are unchanged
   and a Classic device never asks for Archivo.
5. **Flow grid:** it stays a `<table>` (rowspans, the sticky ingredient column, PNG export and print depend on it), styled to the
   prototype's look; stage columns get a minimum width because recipes vary. Classic's per-group colours do not exist in Modernist.
6. **`core.js`:** one `merge` flag on a box from `computeColumns` (a box with more than one input), because Classic's box data has
   only a colour to tell a merge from a step. This is the only `core.js` change, and it moves its version in the three places.
7. **The existing sidebar peek is reused.** Classic already collapses the sidebar in cooking mode and between 861 and 1180px, with
   `.sidebar-peek` reset by `showView`. Modernist's rail (Planner, and the viewer in cooking mode) uses the same class as `navPeek`.
   Below 860px it falls back to the existing top bar.
8. **Behaviour that differs, Modernist only:** the recipe card's shortlist button toggles (✓ removes), as the README says; the app's
   button only adds. The planner's shortlist panel collapses (the History side panel shares the class and does not).
9. **Words stay the app's:** SERVES, PRE-MADE and COOKED ✓ (the prototype says PPL, PREMADE and COOKED?), because `help.html`
   quotes them. The result count reads "N RECIPES", or "N OF M" when filtered. Only the sidebar brand becomes "Recipe Wrangler".
10. **Sizes:** the spec's type (11–12px labels) is followed literally; small controls keep a 44px hit area with an invisible
    `::before`, as the card buttons already do (the 14 Oct readability decisions are for Classic; Modernist's lint is its own).
11. **Last step:** everything the handoff does not draw (modals, banners, the group viewer, the sign-in gate, the group timeline)
    gets a pass of its own after Settings.
12. **Git:** one commit per step, pushed to the branch, no pull request until asked. The changelog entry and `APP_VERSION` bump
    go in the last commit; `styles/modernist.css?v=` is `APP_VERSION` (Pages caches each file separately, as it does `core.js`).

## How it is checked

- `test/core.test.js` lints `styles/modernist.css` on its own (the Classic lints read only the first `<style>` block): every
  selector scoped, zero radius, Archivo only, the link's `?v=` equal to `APP_VERSION`, Classic's block free of any mention, the
  attribute set in `<head>` before any stylesheet, Archivo loaded only by `loadArchivoFont` and only for Modernist.
- `test/smoke.js`: the switch in all four combinations, the attribute set before the body exists and kept across a reload, Archivo
  asked for only after choosing Modernist, nothing written to the database, blocked storage = Classic.
- `test/build.js` inlines the stylesheet into the test copy, as it does `core.js` (the built page lives in `test/`).
- **Classic is proved unchanged by screenshots:** every screen, light and dark, at 1280×800 and phone width, shot from the original
  commit and again after each step, compared byte for byte (the run is deterministic). Only a screen that deliberately gained
  something differs.
- **Not verifiable here, so the household checks it on the tablet** (`docs/HOUSEHOLD-JOBS.md`): PNG export and print in
  Modernist (the harness stubs `html2canvas`), real data, and the real device's rendering.

## Build order and status

1. **The switch** (built 15 Oct): boot script, STYLE select, `applyStyle`/`currentStyle`, the token bridge, the build step, the checks.
2. **App shell and sidebar** (built 15 Oct). 3. Recipes. 4. Viewer. 5. Planner and Shortlist. 6. Shopping. 7. History. 8. Settings. 9. Everything else.

Each step's entry below is added when it lands: what was measured, and where it departs from the prototype.

### Step 1 as built
- Classic differs from the original commit on one screen only: Settings → APP, which now has the STYLE block.
- The spec's dark tokens give `accent-300` and `accent-800` the same value (#ffc4b8); History's stacked bar uses both, so step 7 will
  need to set one of them apart in the dark theme.

### Step 2 as built
- **Markup added, hidden in Classic:** the rail (`#navRailBtn`), the brand's "Recipe Wrangler", square and ‹ (`#navHideBtn`), all
  `.mod-only`; "Kitchen" is wrapped in a span; the shortlist and shopping counts are spans (`.nav-sep`, `.nav-count`) with the
  same text as before ("SHORTLIST · 3"); `showView` sets `.app[data-view]`. The row numbers are a CSS counter, not text.
  Classic is byte-identical on every screen.
- **Folding** is CSS on Classic's own classes: the Planner (`[data-view="planner"]`), or `.keep-awake.viewer-open`, unless
  `.sidebar-peek`. The Group Viewer counts as a viewer. Between 861 and 1180px any viewer has the rail, where Classic folds the
  sidebar for the width. At 860px and below it is Classic's top bar, in these colours, with Classic's ☰ tab. Peek and fold move
  focus to the button that undoes them.
- **Where it departs from the prototype:**
  - The active row is the prototype's red wash with a 4px bar (its screenshots agree). The README says "red fill with white
    text"; the prototype is the source of truth.
  - Saved views and the three data links keep Classic's 44px rows (decision 10), so they sit further apart than in the prototype.
    The data links' gap is 12px, not 14px: at 14 the first two miss sharing a line by a pixel.
  - "N RECIPES SAVED" is hidden: the prototype has none, and Recipes will show the count beside its title (step 3).
  - The prototype's DARK MODE link at the foot of the sidebar is **not** added. Appearance is shared with the household, so a
    one-tap switch there would change it for everyone; it stays in Settings → APP. To revisit with the household.
- **Checks:** 11 in `test/smoke.js` (Classic's sidebar unchanged; widths and the rail on Recipes, the Planner, peek, fold, a
  change of screen, cooking mode, 1100px and a phone; the ‹ button's 44px tap area; focus). Each was seen to fail once.

