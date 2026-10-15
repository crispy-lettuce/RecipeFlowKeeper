# PLAN-MODERNIST: a second visual style, "Modernist" (15 Oct 2026)

**Status:** being built, one step at a time on a branch; nothing is on `main` yet. Steps 1 to 8 (the switch, the sidebar, Recipes, the recipe viewer, the Planner and shortlist, the Shopping List, History, Settings) are built. See "Build order", and the "Decision log" at the end for every choice made while building and why.

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
2. **App shell and sidebar** (built 15 Oct). 3. **Recipes** (built 15 Oct). 4. **The recipe viewer** (built 15 Oct). 5. **Planner and Shortlist** (built 15 Oct). 6. **Shopping** (built 15 Oct). 7. **History** (built 15 Oct). 8. **Settings** (built 15 Oct). 9. Everything else.

Each step's entry below is added when it lands: what was measured, and where it departs from the prototype.

### Step 1 as built
- Classic differs from the original commit on one screen only: Settings → APP, which now has the STYLE block.
- The spec's dark tokens give `accent-300` and `accent-800` the same value (#ffc4b8); History's stacked bar uses both, so step 7 will
  need to set one of them apart in the dark theme. *(Done in step 7: D21.)*

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
- **Decided by the household (15 Oct):** white 12–14px words on the red (the cooking bar, NEW RECIPE, the red buttons) were 4.2:1,
  under the 4.5:1 Classic was brought to on 14 Oct. Every red fill with words or a tick on it now uses the darker `#dd2b0f` (4.7:1).
  See D1 in the decision log.
- **Checks:** 8 in `test/smoke.js` (Classic's viewer unchanged; the title row and counter; the order; kinds and colours; the group
  rules and 270px column; the lanes; the counter on a tap; cooking mode; redraw on switching style), each seen to fail once.

### Step 5 as built
- **Markup, hidden in Classic:** the shortlist panel gains a `.mod-only` title ("Shortlist"), a collapse button
  (`#shortlistCollapseBtn`, ›) and a rail (`#shortlistRailBtn`: ‹, "Shortlist" set vertically, the count). `renderPlannerDays`
  asks `currentStyle()`: in Modernist each week's band carries its dates and "N PLANNED", and each day's name and date are two
  spans, stacked. Classic's markup is as it was, and its Planner is byte-identical (Classic's screenshots match on every screen
  but Settings → APP, as since step 1).
- **Collapse (decision 8):** `state.shortlistCollapsed`, for this visit only (D4). The ‹ rail opens it again, SHORTLIST in the
  sidebar opens the Planner with it open (the README's "keep it"), and each button moves focus to the one that undoes it. It
  stays collapsed across screens and across a switch to Classic and back; Classic never draws it collapsed. At 860px and below
  the panel sits under the days, as in Classic, and does not collapse (D5).
- **Drawing:** "Next Fourteen Days" at 46px; week bands under a 2px ink rule; each day a 92px column (name, 24px date, TODAY),
  today on the red wash with a red rule; a dish's name at 20px/800 on a line of its own with its × beside it; course, time and
  the pills on the next line (2px rules; SERVES lit red when the day asks for a different number; PRE-MADE on in grey; ✓ COOKED
  in ink); CHOOSE A RECIPE in red beside a square. The panel is 330px: the jot box with a 2px red rule, numbered rows (01, 02…),
  and the shopping block in red at the foot, all of it one link to the list (D11).
- **Where it departs from the prototype:**
  - The spacing between a dish's name and its pills, and between dishes, is 18px, not 8px, so that every control keeps a 44px tap
    area that no neighbour takes (D3). A Planner day with one dish is about 20px taller than the prototype's.
  - ADD ANOTHER, GROUP SOME TOGETHER, the GROUPED line, SERVE WITH, the calendar's pills and UNDO for a day away are the app's
    and not in the prototype; they are drawn in the same language (D8).
  - The words are the app's: SERVES 6, PRE-MADE · DINNER, COOKED ✓ and ✓ COOKED (decision 9).
  - Small red words (TODAY, CHOOSE A RECIPE, the counts, the row numbers) are the darker red, accent-700 (D2).
- **Checks:** 11 in `test/smoke.js` (Classic's Planner unchanged; the title, week band and day column; the dish's two lines and its
  pills; the panel, its numbers and the red block; a 44px tap on every button, measured by pointing at it; collapse, the rail,
  focus and the count it announces; collapsed across screens and SHORTLIST reopening it; the block as one link; a redraw on
  switching style; a phone, with nothing running off the side). Each was seen to fail once, by breaking the code it guards.

### Step 6 as built
- **Markup, Modernist only** (`renderShopping` asks `currentStyle()`; switching redraws it, ticks kept): the weeks in the select
  carry their dates (`modWeekLabel`, shared with the Planner); the line under the title reads "THIS WEEK · 22–24 SEP · 5 ITEMS
  · 2 RECIPES · 1 TICKED"; each aisle's title carries `data-count="1 / 3"`, drawn beside it by CSS (D14); each row gains a
  `.shop-box` span beside its checkbox (D12). Classic's words and markup are exactly as they were, and its screens are
  byte-identical.
- **Drawing:** the title at 56px with the line beneath in red; the controls to the right, over a 2px rule; the aisles in two
  columns (36px apart), each under a 2px ink rule; each row a 22px square with a 2px ink rule, the quantity in red, the name at
  16px and the recipes at 12px beneath. Ticked: the square in red with the Lucide check, the row at 45% and struck through.
  The whole row is the tick, as it was (it is a `<label>`). AUDIT's tools are small red capitals.
- **EXPORT PNG and print, checked with the real tools** (the tests stub html2canvas): the real html2canvas 1.4.1 draws the
  squares, the counts and the red quantities in both themes, and leaves the ticked row out; printed to A4 by the browser, the
  list is two columns with the ticked row left off.
- **Where it departs from the prototype:** the week select keeps 44px (decision 10; the prototype's is 40); the header scrolls
  with the list, as Classic's does (D17); one column below 561px (D16).
- **Checks:** 9 in `test/smoke.js` (Classic's list unchanged; the title, the line beneath and the dated weeks; two columns, the
  rules and the counts; the square and the unseen checkbox; a tap ticking with one write, the red, the fade and the counts; Tab
  and Space, with the ring on the square; HIDE TICKED's counts; a redraw on switching style; a phone). Each was seen to fail once,
  by breaking the code it guards.

### Step 7 as built
- **Markup, Modernist only** (each asks `currentStyle()`; switching redraws History): a word at the foot of a calendar cell
  (TODAY, COOKED or AD HOC, by the prototype's rule: a day with anything cooked says COOKED); "Pick a day" in the panel until
  one is picked; and the two meal-base mixes drawn by `renderMixBar` (a 28px bar of segments and the same legend) in place of
  `renderPieChart`. Classic's cells, panel and pies are exactly as they were, and its screens are byte-identical.
- **Drawing:** ‹ and › as 40px squares (Lucide chevrons; the ← and → stay as their words, at no size) about the month at 56px,
  with TODAY, + ENTRY and CSV on the line below (D19); the weekdays; the month as cells 2px apart in a 2px ink frame, each at
  least 92px, with the date at 20px. Today is ringed in red with a red date; the picked day is ink; other months' days are
  faint (D18). The panel is 330px: the day at 26px over a 2px ink rule, each entry's name with its meal and kind beneath in red
  ("LUNCH · AD HOC"), STATS, the days of the week, then the two bars.
- **Colours of the bars** are five tokens, `--km-mix-1` to `--km-mix-5`, so a change of theme needs no redraw (D21).
- **Where it departs from the prototype:** the entries keep the app's words (no "FROM THE LIBRARY"; decision 9); TODAY under the
  date is the darker red (D2); TODAY, + ENTRY and CSV always have a line of their own (D19).
- **Checks:** 10 in `test/smoke.js` (Classic's History unchanged; the header, frame and cells; the words, the ring and the faint
  days; "Pick a day" and no sideways scroll; the bars; a picked day and its entries; 44px taps on the header; the dark bars and
  five distinct colours; a redraw on switching style; a phone). Each was seen to fail once, by breaking the code it guards.

### Step 8 as built
- **CSS only**: no markup or render function changed for Settings, so Classic is byte-identical by construction (and by the
  screenshots).
- **Drawing:** the title at 56px with its line beneath; the four tabs as words, the open one with a 4px red rule standing on the
  2px rule under them, still pinned as the page scrolls; blocks up to 860px between 2px rules, each with its 11px label (a
  folding section's count in red), its words at 14px and its controls; boxes and selects 44px with a 2px rule on grey (D27),
  the lookup 48px in red; every list as lines with 1px rules under a 2px one, its buttons as small capitals; a recipe needing
  attention in the library check marked with a 4px red bar; the quick answers as numbered lines, each "OPEN ↗" (D28).
- **Where it departs from the prototype:** CALENDAR, RECIPE SHARING and BACKUP TO GOOGLE DRIVE stay blocks like the rest (D26);
  KEYWORDS stays a list of rows, not chips, because each row carries its own MERGE and DELETE; boxes are 44px, not 40.
- **Checks:** 7 in `test/smoke.js` (Classic's Settings unchanged; the title and the tabs on their rule; blocks, boxes and the
  lookup; lists as lines; the numbered quick answers, still linking to the guide; the pinned tabs; a phone, measuring the
  settings body's own scroll as well as the page's). Each was seen to fail once, by breaking the rule it guards.

## Decision log

Every choice made while building, beyond the twelve agreed at the top, with the reason. "Household" means you chose it; "session"
means it was decided while building and is yours to overturn. Newest last.

| # | Date | Who | Decision | Why |
|---|---|---|---|---|
| — | 15 Oct | session | Steps 1–4: tints as `rgba()` tokens, never `color-mix()`; group rules and step bars as borders, not inset shadows. | EXPORT PNG (html2canvas 1.4.1) cannot read Chrome's `color(srgb …)` and drew an inset shadow as a black block. Measured with the real library. Step 4. |
| — | 15 Oct | session | The `merge` flag is "two or more inputs are steps' outputs", narrower than decision 6 as first written. | "More than one input" draws the design's own sauce step as a merge. Step 4. |
| — | 15 Oct | session | No DARK MODE link in the sidebar; selects and typing boxes keep 44px; SORT kept; TIPS and COOKING NOTES stacked. | Appearance is household-wide; a select cannot carry an invisible tap area; SORT is in use; the notes are in the PNG and the cooking notes are not. Steps 2–4. |
| D1 | 15 Oct | household | Every red fill that carries words or a tick is `#dd2b0f` (`--km-fill`), not the spec's `#ec3013`; in dark, `#ff563c` with dark words. Decorative red (rules, the today mark, the brand square) keeps the spec's colour. | White on `#ec3013` is 4.2:1, under the 4.5:1 Classic was brought to on 14 Oct; `#dd2b0f` is 4.7:1. A core check fails on white words over the accent. |
| D2 | 15 Oct | session | Small red words are accent-700 (`#ae1800`; `#ff9783` in dark). The vivid accent is kept for fills and large type (today's 24px date, the set-up numbers). | The README says "red"; the accent is 3.8:1 on the ground, under 4.5:1 for small text; large bold type needs 3:1, which it passes. Same rule as `--plum` in the bridge. |
| D3 | 15 Oct | session | On the Planner, 18px between a dish's name and its pills and between dishes (the prototype has 8px); 16px between rows of pills. | A 24px name and a 28px pill each need their own 44px (the 14 Oct rule), and invisible tap areas cannot overlap without one stealing the other's taps. 8px left 34px between them; the smoke check found it. |
| D4 | 15 Oct | session | The shortlist's collapse is for this visit only, not saved. | The prototype's state is not saved, a fresh start should show the list, and nothing else in this style is written anywhere but `kitchen.style`. |
| D5 | 15 Oct | session | The shortlist collapses only at 861px and up. | Narrower, it sits under the days, where a vertical rail means nothing. |
| D6 | 15 Oct | session | Week bands read THIS WEEK, NEXT WEEK and THE WEEK AFTER, each with the dates of the days shown, not the whole calendar week. | The fortnight starts today, so the first week is usually part of one; "WEEK OF THU 1" beside its own dates would say the date twice. |
| D7 | 15 Oct | session | The shortlist's ≡ is hidden and the row number takes its place. | The ≡ was only a picture (nothing drags). |
| D8 | 15 Oct | session | The Planner's controls the prototype lacks are kept and drawn in its language; ADD ANOTHER and GROUP SOME TOGETHER share a line. | The household uses them, and sharing a line saves a 44px row on every day with two dishes. |
| D9 | 15 Oct | session | The rail's spoken label carries the count ("Open the shortlist, 4 ideas"). | The count is shown on the rail, but a button's label replaces its words for a screen reader. |
| D10 | 15 Oct | session | Not changed, in either style: the shortlist's × has no spoken label. | It is Classic's and outside this work; a one-line follow-up. |
| D11 | 15 Oct | session | The red shopping block is one link, VIEW LIST →, stretched over the block. | The prototype opens the list from anywhere on the block; using the existing link keeps one control and one keyboard stop. |
| D12 | 15 Oct | session | On the Shopping List the 22px square is a span beside the checkbox; the checkbox stays where it was, unseen, and is still what is focused, tapped and ticked. | EXPORT PNG (html2canvas) draws any checkbox in its own grey, rounded look whatever the CSS says; a span is drawn as styled. Keeping the real checkbox keeps the label, the keyboard and screen readers as they were. Checked with the real library. |
| D13 | 15 Oct | session | Not changed, in either style: ticking from the keyboard loses focus, as the list is redrawn on every tick. | It is Classic's and outside this work; a follow-up (keep the focused row's key and focus it again after the redraw). Found by the new keyboard check. |
| D14 | 15 Oct | session | An aisle's "ticked / total" is drawn by CSS from a `data-count` attribute, counted from the whole list even under HIDE TICKED. | The aisle title's text is read by the app's own checks and by AUDIT; an attribute leaves it the aisle's name. The PNG and printout show the count too, though ticked rows are left off them: it reads as progress. |
| D15 | 15 Oct | session | The weeks in the Shopping List's select carry their dates in Modernist, as the Planner's bands do (one helper, `modWeekLabel`). | The prototype's select reads "THIS WEEK · 14–20 OCT"; one helper keeps the two screens saying the same thing. |
| D16 | 15 Oct | session | Two columns down to 561px, which includes an A4 printout; one column below. | A phone has room for one; A4 has room for two, which saves paper. |
| D17 | 15 Oct | session | The Shopping List's header scrolls with the list, as in Classic; it is not pinned. | A pinned element inside a scrolling pane is what EXPORT PNG captures wrongly (see `exportNodeAsPng`). |
| D18 | 15 Oct | session | Days of other months: their words at 40%, on the same ground as the rest. | The README says "40% opacity"; fading the whole cell let the grid's rule colour show through, so those days looked like grey blocks. |
| D19 | 15 Oct | session | On History, TODAY, + ENTRY and CSV always sit on the line below ‹ month ›. | At 1280px they do not fit beside the side panel, and a long month and a short one would otherwise wrap them in different places, so the buttons would move from month to month. |
| D20 | 15 Oct | session | The word at the foot of a calendar cell follows the prototype's rule: TODAY, else COOKED if anything was cooked, else AD HOC. | It is the prototype's; a day with both says COOKED, and the panel lists both. |
| D21 | 15 Oct | session | The meal-base bar's colours: light as the README (accent, ink, accent-300, accent-800, neutral-400); dark: #ff563c, #f1eeec, #ffc4b8, #9c2a17, #77726f. | The spec's dark accent-300 and accent-800 are both #ffc4b8, so two segments would be the same colour. The fourth and fifth are set apart from the ink and the others; a check fails if any two match. |
| D22 | 15 Oct | session | Not changed in Classic: History's side panel scrolls sideways, because the app's rule for every table (`min-width:560px`, meant for the flow table) reaches the small DAY OF WEEK table. Fixed in Modernist only. | Classic is not to be touched in this work; a one-line follow-up for Classic. |
| D23 | 15 Oct | session | "Pick a day" heads the panel in Modernist until a day is picked. | The prototype's panel always has its title; Classic's says nothing, as before. |
| D24 | 15 Oct | session | Today's red ring on History is an inset shadow, not a border. | A border would shift the cell's contents by 3px; History is not exported to PNG, where shadows went wrong (step 4). |
| D25 | 15 Oct | session | Settings is restyled with CSS alone. | Every control there already had a class or id to hang a rule on, and leaving the markup alone means Classic cannot change. |
| D26 | 15 Oct | session | CALENDAR, RECIPE SHARING and BACKUP TO GOOGLE DRIVE stay blocks (label, words, controls), not the prototype's one-line "label, status, button" rows. | Each has several states the prototype does not show (waiting for a database change, connected as…, the last problem, the reminder time, the automatic switches, the households shared with); a one-line row would drop them. |
| D27 | 15 Oct | session | Boxes to type in and selects in Settings are 44px, not the prototype's 40px; the lookup is 48px as drawn. | A box cannot carry an invisible tap area, and the 14 Oct rule is 44px for anything pressed with a thumb (decision 10). |
| D28 | 15 Oct | session | The quick answers read "OPEN ↗", not the prototype's "OPEN →". | They open the guide in a new tab, which the app marks with ↗ everywhere else (OPEN THE GUIDE ↗, THE WHOLE LIST ↗). |
| D29 | 15 Oct | session | Not changed, in either style: on a phone the top bar is 159px tall, because EXPORT DATA, IMPORT DATA and SIGN OUT stack at its end. | Seen while checking Settings on a phone; Classic's own phone bar is the same height. A follow-up for both styles. |

