# PLAN-MODERNIST: a second visual style, "Modernist" (15 Oct 2026)

**Status:** being built, one step at a time on a branch; nothing is on `main` yet. Steps 1 to 4 (the switch, the sidebar, Recipes, the recipe viewer) are built. See "Build order".

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
6. **`core.js`:** one `merge` flag on a box from `computeColumns` (a box that brings together two or more steps' outputs), because
   Classic's box data has only a colour to tell a merge from a step. This is the only `core.js` change, and it moves its version in
   the three places. *(Corrected 15 Oct 2026, when it was built: this said "a box with more than one input", which would draw the
   design's own sauce step as a merge. See step 4.)*
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
2. **App shell and sidebar** (built 15 Oct). 3. **Recipes** (built 15 Oct). 4. **The recipe viewer** (built 15 Oct). 5. Planner and Shortlist. 6. Shopping. 7. History. 8. Settings. 9. Everything else.

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

### Step 3 as built
- **Markup:** the search bar now sits in `.recipes-head-row` beside a `.mod-only` title and count (`#recipesCountMod`: "3 RECIPES",
  or "1 OF 3" under a filter). In Modernist, `renderFilterRows` puts the one SOURCE select beside SORT on the KEYWORD row
  (`currentStyle()`), and switching style redraws it. Classic is byte-identical.
- **Cards:** three to a row at 861px and up, two to 560px, one below, sharing 2px rules (the first row draws the top and the
  first column the left, so no translucent line is drawn twice). Photo 176px, in colour. The favourite is the Lucide star drawn
  as a CSS mask (filled and red when on); its ☆/★ text stays, at no size, and the button's label is unchanged.
- **Behaviour, Modernist only (decision 8):** the card's ✓ takes the recipe off the shortlist (one delete, as the panel's ×),
  and its label reads "Remove from shortlist". In Classic a tap on ✓ still does nothing and it reads "On shortlist".
- **Where it departs from the prototype:**
  - The selects keep Classic's 44px height (a select cannot carry an invisible hit area); the prototype's are 34px. Chips are
    drawn at the prototype's size, with an invisible 44px hit area.
  - SORT is kept (the prototype has none), beside SOURCE.
  - On a phone SOURCE and SORT wrap onto a second line.
- **`core.test.js`:** the lint now allows `url()` only for an inline SVG, so the file still fetches nothing.
- **Checks:** 11 in `test/smoke.js` (Classic's Recipes and its ✓ unchanged; the title, count and search bar; SOURCE's row; three
  cards filling the row with shared rules; the count under a filter; the toggle on and off with its write; the star; the 44px tap
  areas; redraw on switching style). Each was seen to fail once.

### Step 4 as built
- **EXPORT PNG was broken in this style, and is fixed.** Measured with the real html2canvas 1.4.1 (the tests stub it): Chrome
  reports a `color-mix()` colour as `color(srgb …)`, which html2canvas cannot read, so the export threw and nothing downloaded.
  Every tint in `styles/modernist.css` is now an `rgba()` token per theme, and `test/core.test.js` fails on a `color-mix()`.
  An inset box-shadow on a cell with no bottom rule was also drawn as a black block, so the group rules and step bars are borders.
  After both, the export downloads in all four combinations, and the image matches the screen. Two faults it shares with Classic's
  export are left as they are: the ingredient ticks are missing from the image, and the table is drawn narrower than the page.
- **Printing** (PRINT / A4 PDF) was rendered to A4 here with the browser's print engine: the title, set-up notes, overview and
  table print as on screen. At A4 width the narrow layout applies (set-up notes stacked).
- **`core.js`** (version `2026-10-15.1` in all three places): `computeColumns` marks a box `merge` when two or more of its inputs
  are steps' outputs, not raw groups. This is narrower than "more than one input" (decision 6 as first written): with that, the
  design's own example would draw its sauce step (softened onions plus passata) as a merge. Two checks in `core.test.js`.
- **Markup, Modernist only** (`buildFlowHTML` asks `currentStyle()`; switching redraws an open recipe, ticks kept): a title row
  with the servings and an "n / N TICKED" counter (updated on every tap); cells say what they are (`box-merge`, `box-final`,
  `group-top`, `group-end`, `col-last`, `row-last`) and carry no inline colours; the overview's lanes carry none either. Classic's
  markup is exactly as it was, and its viewer is byte-identical with a four-stage recipe, ticked and in cooking mode.
- **Drawing:** the table stays a `<table>` (rowspans, the sticky ingredient column, PNG and print rely on it), drawn to the grid:
  2px rules, a 2px ink frame, a 270px ingredient column with the quantity hanging in its own 58px column, equal stage columns with
  a 150px minimum (recipes have any number), a step on grey with a 4px ink bar, a merge in ink, the last column in red with a 24px
  title, a carried-through box with a dashed bar. The overview comes after the title and set-up notes, as in the prototype
  (reordered with CSS, so the PNG and Classic are untouched). The `.btn` look (1px rule, 13px capitals, 44px invisible tap area)
  and the switch are defined here for every screen.
- **Where it departs from the prototype:**
  - The cooking bar keeps the app's words (how the screen is kept on, and a warning when it is not), in capitals.
  - The hint above the table ("TAP ANY BOX…") stays, small.
  - TIPS and COOKING NOTES are stacked, not side by side: the recipe's notes are part of what EXPORT PNG captures and the cooking
    notes are not, so they cannot share a row without changing the export.
  - The "people" box in COOK FOR keeps a 44px height (a box to type in cannot carry an invisible tap area).
- **For the household to decide:** white 12–14px words on the red (the cooking bar, NEW RECIPE, the red buttons) are 4.2:1, under
  the 4.5:1 Classic was brought to on 14 Oct. The design asks for it; the darker red `#dd2b0f` would give 4.7:1.
- **Checks:** 8 in `test/smoke.js` (Classic's viewer unchanged; the title row and counter; the order; kinds and colours; the group
  rules and 270px column; the lanes; the counter on a tap; cooking mode; redraw on switching style), each seen to fail once.

