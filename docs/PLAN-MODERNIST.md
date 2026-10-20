# PLAN-MODERNIST: a second visual style, "Modernist" (15 Oct 2026)

**Status:** built (15 Oct 2026), all nine steps, merged as #153 on 15 Oct (version 2026-10-15.1). A review afterwards found five
faults; they are fixed in version 2026-10-18.1 ("After the review", below). The household then saw the recipe cards squashed to
strips on the tablet, a sixth fault, fixed in 2026-10-19.2 ("The recipe grid on the tablet", below). What is left is the household's: the tablet check 66a
in `docs/HOUSEHOLD-JOBS.md`, and the questions in the "Decision log" at the end, which records every choice made and why.

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
- **PNG export and print** are stubbed in the harness, so they were run by hand with the real html2canvas 1.4.1 and the browser's
  print engine (the recipe in step 4, the shopping list in step 6, a group in step 9), in both themes.
- **Not verifiable here, so the household checks it on the tablet** (job 66a in `docs/HOUSEHOLD-JOBS.md`): the tablet's own browser
  (its PNG export and printing among it), real data, and how the taps feel.

## Build order and status

1. **The switch** (built 15 Oct): boot script, STYLE select, `applyStyle`/`currentStyle`, the token bridge, the build step, the checks.
2. **App shell and sidebar** (built 15 Oct). 3. **Recipes** (built 15 Oct). 4. **The recipe viewer** (built 15 Oct). 5. **Planner and Shortlist** (built 15 Oct). 6. **Shopping** (built 15 Oct). 7. **History** (built 15 Oct). 8. **Settings** (built 15 Oct). 9. **Everything else** (built 15 Oct).

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
  or "1 OF 3" under a filter). In Modernist, `renderFilterRows` put the one SOURCE select beside SORT on the KEYWORD row
  (`currentStyle()`), and switching style redraws it. Classic is byte-identical. *(Replaced 19 Oct 2026: the filters are in a sheet now;
  see "The filter sheet".)*
- **Cards:** *(corrected 19 Oct 2026: the rows were `auto`, which squashed every card to a strip in a library of more than a few recipes; see "The recipe grid on the tablet")* three to a row at 861px and up, two to 560px, one below, sharing 2px rules (the first row draws the top and the
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

### Step 9 as built
- **The Group Viewer** was the one place Classic's palette still reached in Modernist (each dish's lane and square in gold, sage,
  blue…). `groupColour(i)` gives Modernist four colours of its own, tokens per theme (ink, red, deep red and grey in light; light
  ink, red, pale red and pale grey in dark), with the lanes' words in the colour that reads on all four. Classic's are PALETTE's as
  before, and switching style redraws the viewer. EXPORT PNG of a group was run with the real html2canvas in both themes: the
  token colours come out.
- **Dialogs** (the add form, the meal, pre-made and fresh-or-freezer questions, the diary entry): a 2px ink frame, headings at
  800, 11px capitals for labels, 44px boxes on grey, the chosen meal in red, CANCEL and the like as small red capitals with no
  underline, and the review's notes as a red bar on the red wash rather than a box.
- **The bars across the top** (UPDATE, CONVERTER, OFFLINE): the red wash with a 2px red rule, their names in small red capitals.
- **The toast** is ink with bold words; **the sign-in card** has a 2px ink frame, 44px boxes and the red button, and still says
  "Kitchen" (D31).
- **help.html** names STYLE, CLASSIC and MODERNIST in Settings and says what behaves differently in Modernist (the folding menu,
  the folding shortlist, the card's ✓). `changelog.json` has the entry and `APP_VERSION` is 2026-10-15.1, as is the stylesheet's
  `?v=`. `docs/HOUSEHOLD-JOBS.md` and `docs/TEST-PLAN.md` have the tablet check 66a.
- **Classic, at the end:** byte-identical on every screen but two, Settings → APP (the STYLE block) and Settings → HELP (the new
  version and its entry in what's new).
- **Checks:** 6 in `test/smoke.js` (Classic's group colours; Modernist's in both themes; the redraw; a dialog; the bars; the
  sign-in card), each seen to fail once. In all: `core.test.js` 216 (10 for this style), `smoke.js` 708 (86 for this style).

### After the review (18 Oct 2026, version 2026-10-18.1)
A code review of #153 after it merged found five faults; each is fixed with a check that was seen to fail by breaking the fix.
- **RESET TICKS** cleared the boxes but left "n / N TICKED" showing the old count, on a recipe and in the Group Viewer. The count is
  now read from the cells by `showTickedCount`, which a tap and both RESET TICKS buttons call.
- **The `merge` mark with PREPARATION as steps:** `withPrepSteps` makes each prepared ingredient a step's output (`veg~1~p`), so a
  step fed by two of them was marked a merge and drawn in ink, though as written it is not one. A preparation step's output now
  stays raw (D36). The raw set also changes only between stages now, so the order of two lines in one stage cannot change the mark.
  `core.js` 2026-10-18.1, in the three places; two checks in `core.test.js`.
- **History's meal-base bar** had five colours for nine meal bases, so the sixth repeated the first (D33).
- **The month in the week labels** followed the browser's language, and a British browser says "Sept" (D34).
- **Enter on a card's star, + or ✓** opened the recipe instead, in both styles (D35).
Also corrected: `docs/ARCHITECTURE.md` gave the 15 Oct test counts the date 12 Oct. Not changed, and still open: the Group Viewer
has four dish colours (a group of five repeats one), a last stage with several steps has several red boxes but one red lane in the
overview, and the Edit dialog's preview shows a "0 / N TICKED" count.

### The recipe grid on the tablet (19 Oct 2026, version 2026-10-19.2)
The household opened Modernist's Recipes on the tablet, held sideways, and every card was a strip about 20px tall. Reproduced the same
day in Chromium with 70 made-up recipes, then fixed.
- **Cause:** step 3 gave the grid `grid-auto-rows:auto` in place of Classic's fixed 252px. Above 860px `.app` is `100vh` and the grid
  is a scroller of fixed height, so the browser shared that height out between the rows (a card is `overflow:hidden`, so its row
  could shrink to nothing): 24 rows in about 480px, 20px each, and the grid never scrolled because everything "fitted". At 860px and below
  the page scrolls and the grid has no height to share, so a phone and an upright tablet were never affected. Classic was not either.
- **Measured** (cards, in Modernist, 70 recipes): 12px at 1024x768, 22px at 1280x800, 31px at 1366x1024, against 275 to 299px upright and on
  a phone. After the fix 275 to 299px at every size, and the grid scrolls.
- **Why the checks missed it:** the fixture has three recipes, one row, which is never short of height. The step 3 checks measured
  the cards' widths, rules and photo height, never a card's own height, and "Classic proved unchanged by screenshots" could not see a
  fault Classic does not have. Measured on the unfixed page, it starts at 7 recipes on a 1280x800 screen with a short filter area, 4 or 5
  with the twelve keyword chips the household has, and at 4 on 1024x768.
- **Fix:** `#recipeGrid{ grid-auto-rows:max-content }` (D37). One check in `test/smoke.js` adds 30 recipes and measures the cards at
  1280x800, 1024x768 and 1366x1024, then upright and on a phone, with Classic as the control. Seen to fail by putting `auto` back.
- **Looked for elsewhere:** every other screen, in both styles, at 1430x667 and 1280x800, for a grid item clipped by its own row.
  None, on the fixture's small planner and history. History's own grid already uses `minmax(92px, auto)`.

### The filter sheet (19 Oct 2026, versions 2026-10-19.3 and 2026-10-19.4; PRs 1 and 2)
The household's tablet screenshot (about 1389 x 731 CSS px under Chrome's bars) showed the cards getting about half the page, and the household
asked for at least three-quarters. The handoff folder's brief for a filter sheet (its concept 2b) was read as a proposal, not a spec, and
criticised against the code first (the brief's "40+ keywords wrap the header" is not what the code does: the header shows 12 suggestions
whatever the library holds; what made it tall was SOURCE and SORT beside the chips and the course row).
- **Measured** at 1389 x 731 with the household's twelve suggestions, a share (the OUR RECIPES / TEST KITCHEN'S band) and a 350px SOURCE
  select, a scratch copy of the page gave the cards 49% (the screenshot's own figure: 51%). Mocked, and then built: every filter in a sheet
  gives 81% with nothing on and 76% with three filters on. COURSE kept in the header with the rest in the sheet gives 75% and 70%; one
  sideways-scrolling strip gives 75% with no room to spare. Only the sheet holds the target with filters on (D39).
- **Built:** a FILTERS button beside the search, with a red count of what is on; under the head row one line of chips for the saved view, each
  course, each keyword, the source and a sort that is not the default, each removed with a tap, with CLEAR ALL after them; when they do not
  fit, the ones that do not are hidden and a +N chip opens the sheet. The sheet is 440px, slides in from the right over the whole app over
  180ms (none with reduced motion), and holds COURSE, SOURCE, SORT and every keyword, with + ADD. Every tap applies at once; its foot says
  SHOW n RECIPES and closes it, as do the ×, the backdrop and Esc. Focus goes to the panel on opening and back to FILTERS on closing; Tab
  stays inside; `.app` is inert behind it. Classic is unchanged, shown by screenshots (24 comparisons, taken from `main` and from this build,
  with and without filters, light and dark, at 1280, 1024 and 412px: 22 identical on the first run; the other two, at 1280px light, were run
  again eight times each: one came out identical every time, and the other came out in the same few images from both builds, `main`
  varying against itself). Repeated for PR 2 (14 runs of each build on the cases that differed): the odd images differ from the usual one by 2 to 5
  pixels at the edge of a scroll bar, and `main` produces the same kind against itself.
- **The code:** one state (`state.course`, `.keywords`, `.source`, `.savedView`, `.sort`) and one filter (`filterRecipes`). The small helpers
  that change the state (`toggleCourseFilter`, `addKeywordFilter`, `removeKeywordFilter`, `toggleKeywordFilter`) are used by Classic's rows,
  the sheet and the chips alike. `renderFilterRows` takes the Modernist path first and leaves Classic's code as it was, with its select
  markup and its keyword-box wiring moved into functions both paths use. The sheet's body is drawn only while it is open, and is redrawn on
  every change with its scroll place and focused control put back. The old Modernist rules for the header's filter rows are gone.
- **Checks:** 22 in `test/smoke.js` (the header; the 75% target at 1389 x 731 and 1280 x 800 with the band and with filters on; chips and badge;
  the dialog, its contents, Tab; live apply; SOURCE and SORT; scroll and focus kept; + ADD; Esc, the ×, the backdrop and SHOW; Esc leaving a
  recipe-for-a-day alone; leaving the screen; chips removed and cleared; one line and +N; reduced motion; dark; Classic as it was), and two
  existing checks changed to say SOURCE is no longer a header row. Each was seen to fail by breaking the code it guards, in a scratch copy.
- **Not verified:** the tablet itself (Chrome on Android: `inert`, the soft keyboard, touch), and the household's real header.
- **PR 2 (2026-10-19.4), the keyword find field:** a field above the keyword pills narrows them as you type, ignoring case and matching any
  part of a word (a keyword stays if what was typed is anywhere in it). With no match the sheet says "No keyword matches — Enter to add", and
  Enter applies the typed word as a keyword filter, the way + ADD and the search always have, and puts it at the head of the list; with a
  match in view Enter does nothing, as the brief said (D49). The pills are ordered when the sheet opens: the ones that are on first, then by
  how many recipes carry each, the most first, ties in the app's own order, and that order holds while it is open (D48). + ADD stays at the
  end and puts the cursor in the field (D50); the inline keyword box and its datalist, which PR 1 kept, are gone from the sheet (Classic keeps
  them). The field is empty each time the sheet opens. Opening it puts the cursor in the field with a mouse or keyboard, and on the panel
  itself on touch, so the tablet's keyboard stays down (D47). The pills are drawn on their own, so typing does not redraw the field.
- **Checks in PR 2:** nine, and one of PR 1's replaced: the opening order; a tapped pill staying put and coming first next time; the narrowing,
  in any case and on any part of a word; the no-match line and Enter adding; Enter with a match adding nothing; + ADD; the field emptying on
  opening; and, on a touch screen (`hasTouch`, where `(pointer: fine)` is false), no cursor in a text box. Each was seen to fail by breaking
  the code it guards. 782 in all.

### The tablet review, first batch (20 Oct 2026, version 2026-10-20.3)
The household asked for a review of the whole app on its tablet (12.7", 2944 x 1840, held sideways: 1389 x 868 CSS px at 2.12x, touch, about
0.2mm to the CSS px, so 44px is about 9mm). It was driven in Chromium against the household's own export, loaded through the app's import, with
the backend stubbed and the photo host blocked (so every card showed "photo can't be shown"; the photo boxes are 176px either way). 30 screens
sideways and 12 upright were captured and measured (tap targets by pointing at them, text sizes, clipping, sideways scroll, axe). The report,
the captures and the measurements are in the working folder of that session, **not in the repository**, since they hold recipes. 19 findings; the household chose seven.
- **A finding from one recipe is not a finding.** The first draft proposed folding the sidebar on the viewer (F2) because one recipe's flow table
  was cut off at the right. The household pointed out that depends on how many steps a recipe has. All 71 recipes were then opened at the
  tablet's size: the table is a 270px ingredient column plus 150px a step, the pane is 1,101px, so 17 recipes (2 to 5 steps) fit and 54 (76%)
  scroll sideways, by a median 219px; folding the sidebar would fix only the 14 six-step ones and leave 40, and `docs/PLAN-PREP-STEPS.md` §8
  already calls that "acceptable on the tablet, which already scrolls sideways". **F2 is not changed** (D51). Every other finding that depends
  on a recipe was re-measured on all 71 (F1, F3, F8) and some were changed or dropped (F8: 44px timeline bars would make the median strip 454px).
- **F1, the viewer's header.** The source chip and the SERVE WITH line each had a row of their own, so the pinned header and COOK FOR bar took
  278 to 332px of 868 (32 to 38%) on every recipe, before the flow began. Now they share a row, with a little less padding (Recipe Viewer only, 861px and up): 183 to 238px (21 to 27%),
  measured on the built page for all 71 recipes (D52). A second step, not done: stop pinning the header outside cooking mode.
  **A fault in the first attempt, caught by measuring what answers a tap rather than the boxes:** closing the rows to 8px apart made each upper row of
  buttons lose part of its 44px (a button is drawn 34px and its `::before` reaches 6px past it, so neighbouring rows' reaches overlap). Held upright, where the
  buttons wrap onto three rows, over all 71 recipes: 8px left some at 42px, the base 10px left 93 of 568 at 43px, and 11px leaves every one at 44px, as on `main`.
- **F3, SAVE.** In the add / edit dialog it was the last thing, 2,829 to 4,751px below the top (3.3 to 5.5 screens) for every recipe. It and the
  save error are in a `.save-bar` that sticks to the foot of the screen (D53). On the built page SAVE is on screen at the top, middle and end of the
  dialog for all 71 recipes.
- **F5, F6, F7, F9, F11.** A Settings tab opens at its own top (D57). The library switch (33px), the "choosing a recipe for a day" banner's MARK DAY
  AWAY and CANCEL (17px) and, in AUDIT, the aisle box (22px) and MERGE WITH… (15px) join the 44px list (D54, D55). The card's shortlist button is
  the Lucide list-plus, like the star, in place of a bare 12px + (D56). An empty day's CHOOSE A RECIPE fills its row (D58).
- **Checks:** 13 in `test/smoke.js` and the four new selectors on the 44px list in `test/core.test.js`; 18 breakages in a scratch copy, each seen to fail
  the check that guards it (a phone-width check that could not fail was moved to 820px, where it can). Classic is shown unchanged by a check of its + and its save button, and by the existing Classic checks.
- **Not verified:** the tablet itself; the live database.

### The tablet review, second batch (20 Oct 2026, version 2026-10-20.4)
The household chose F4 and F10, and "a small arrow cue" for F2 in place of a layout change (D59). Measured on the built page against the household's
own export, as in the first batch (the export and the pictures are in the working folder, not in the repository).
- **F4, the rail up to 1100px (D60, D61).** Held upright (868 x 1389), Recipes, History, Shopping, Settings and the Planner all have the 56px rail and
  nothing runs off the right. Recipes: three columns, all 71 cards 252px wide (195px before). History: seven weekday labels, days 61px wide (34px
  before), no sideways scroll, and ‹ month › on one row for all twelve months (D64). **The first version of this batch had ‹ and › stacked under each
  other**: the 56px title was wider than the 314px beside the two squares, and in a wrapping row that sends › to a line of its own. The check then only
  looked for sideways scroll, so it passed here (where the stand-in font, Inter, is narrow) and failed in CI, whose fallback font is wider, on the same
  cause; the first picture of it that went to the household showed the fault, and it was not noticed until CI failed. Shopping: five toolbar buttons on two rows, all inside the screen (drawn 34px, 44px to tap, as everywhere in Modernist).
  A made-up library shows the same, and 1100px is folded where 1101px is not. A phone keeps its top bar, and Classic held upright is as it was.
- **F10, UNDO (D62).** The Planner, with the export's own plan, shows 5 planned days with 7 dishes, 2 of them in a group. Each dish was taken off with its
  × and put back with UNDO: all 7 came back with the day's entry identical to what it was, both groups returned with their ids, and each UNDO wrote only
  `planner_days` and `meal_groups` rows. A bar goes after ten seconds, on leaving the Planner, and when the day has been changed meanwhile (UNDO then
  writes nothing).
- **F2, the arrow (D63).** All 71 recipes opened at 1389px: 54 scroll sideways (median 219px over) and have the arrow, 17 fit and have none, which is exactly
  the set the first batch measured. The arrow is a 32px square 10px in from the table's top right corner; on all 54 it goes at the right end and returns at
  the left. **One recipe has text under it at rest**: it covers about a sixth of the first line of a greyed repeat step, which stays legible, and the
  square moves off it as soon as the table is scrolled (on average 0.6% of a recipe's scroll positions have anything under it).
- **Checks:** 22 in `test/smoke.js` (825 in all) and one in `test/core.test.js` (249: the arrow is left out of both PNG exports and of print, and off in the
  shared stylesheet), and `.day-undo button` joins the 44px list. 24 breakages in a scratch copy, each seen to fail the check that guards it; a click on a
  hidden menu button had made one of the first runs crash rather than fail, so those two clicks only act on a visible button.
- **Not verified:** the tablet itself (the arrow's size and corner, whether the strip feels right upright); the live database (the planner writes are
  the ones a save makes, counted against the stub). The strip also takes a computer window of 861 to 1100px (D60), for the household to say about.

### The Planner, denser (20 Oct 2026, version 2026-10-20.5)
Three days of the fortnight fitted a tablet screen. A brainstorm on the household's own plan (prototypes as injected CSS, nothing in the repository) found where
the height went: a dish was 70px (its name, then its pills on a second line), ADD ANOTHER a 44px row of its own, an empty day 85px (nine of the plan's fourteen
days), and about 20px of padding and rule a day. The household chose "A + C + D" (D65).
- **Why not close the gaps.** The taps keep their 44px (`docs/PLAN-READABILITY.md`), and the comment at the day's rows already records why the spacing is what
  it is: a name reaches 10px past its line each way and a pill 8px past its border, so rows need about 18px between them or a tap meant for one lands on
  another. What was spare was the width, so what stood on two lines stands on one (D66) and the rows that spent 44px for a 12px word were drawn 28px with the 44px
  reaching past them (D67).
- **Measured on the household's real plan** (landscape, shortlist open, the real Archivo files): whole days on the screen 3 (and part of a fourth) to 7 (and part
  of an eighth) as the test harness draws it, and **6 (and part of a seventh) with PRE-MADE shown as the live app does**, where today's dish, with three
  buttons, has its name on two lines; the whole list 1,975px to 1,345px (1,365px with PRE-MADE); a one-dish day 143px to 95px, two dishes 258px to 168px, an empty day 85px to 57px. Every button on the page answers
  a tap 21px above and below its middle, as it did: 38 of 39 (the 39th is UNGROUP, a link inside the grey GROUPED bar, which is short in the layout before too and
  was not changed). The name's room, with PRE-MADE ready as in the live app and the shortlist open: 370 to 474px on the plan's seven dishes, every one on a single line with its group beside it; of the 71 recipe names, 59 stay on one line even at 370px and 12 take two (8 at a typical dish's width), none three. Folded away, the shortlist gives 644 to 748px and all 71 names are on one line.
- **Checks:** 7 in `test/smoke.js` (833 in all; the check that said a dish's name stood on a line of its own with the pills under it now says what is still true), on
  made-up recipes with a very long name. 11 breakages in a scratch copy, each seen to fail the check that guards it; one first got away (the trimmed heading and week
  bands: nothing measured them, so the check now reads the first day's distance from the top and the gap between weeks).
- **Not done:** the brainstorm's third layout (ADD ANOTHER and GROUP SOME TOGETHER in a column at the right of each day, nine days on the screen; names wrap to
  two lines more often). Not verified: the tablet itself; days with SERVE WITH / OFTEN WITH rows, the calendar's switches, choosing dishes to group and assigning
  a shortlisted dish were not measured, and ride on the same rules.

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
| D30 | 15 Oct | session | The Group Viewer's dishes take four colours of Modernist's own (`groupColour`), not Classic's gold, sage and blue. | They were the last of Classic's colours left in this style, beside its red; four tokens per theme keep the lanes' words readable (white on the light theme's four, dark ink on the dark theme's). |
| D31 | 15 Oct | household (as agreed) | The sign-in card still says "Kitchen" in Modernist; only the sidebar's brand is "Recipe Wrangler". | It was the assumption agreed at the start. **A question for you:** the sign-in card is the first thing seen, so you may want it to say "Recipe Wrangler" in Modernist too; it is one line. |
| D32 | 15 Oct | session | The dialogs, bars, toast and sign-in card are drawn by CSS alone (the bridge plus a type and rule pass), with no markup changed. | The handoff does not draw them; the aim is only that nothing looks half-Classic. |
| D33 | 18 Oct | session | History's meal-base bar: five colours, then the same five striped, so all nine meal bases look different. | The palette has no four more reds or greys that would not look like the five; stripes keep to it. |
| D34 | 18 Oct | session | The week labels' months are fixed three-letter names (JAN … DEC), not the browser's. | A British browser says "Sept"; the design's labels are three letters, and the labels must not change with the device's language. |
| D35 | 18 Oct | session | Enter or Space on a card's own button (star, +, ✓) does that button's job, in both styles; on the card itself it still opens the recipe. | The grid took Enter from every element in a card, so the shortlist and favourite buttons could not be used from a keyboard; Classic's + had the same fault. |
| D36 | 18 Oct | session | A preparation step's output counts as raw ingredients for the `merge` mark. | Slicing leeks does not make "Fry the veg" a joining of two cooked things; as written it is a step, and drawing preparation must not change that. |
| D37 | 19 Oct | session | The recipe grid's rows are `max-content`: each row is as tall as its tallest card, so a row of one-line titles is about 22px shorter than a row with a two-line title. | Self-adjusting, and a larger text size cannot clip a card. `minmax(300px, max-content)` would make every row the same height, as Classic's are, at the cost of a number to keep right; yours to choose. |
| D38 | 19 Oct | session | Not done: at 1024px wide the header (title, search, filters) takes about 460px of 768, because the keyword chips are squeezed beside SOURCE and SORT. *(Superseded the same day by D39: the sheet takes every filter row out of the header.)* | In a trial, SOURCE and SORT on a row of their own at 1180px and below gave back about 150px at 1024px and changed nothing at 1280px, the plan's tablet. The household's tablet turned out to be about 1389px wide. |
| D39 | 19 Oct | household | Every filter, COURSE included, moves into a sheet opened by a FILTERS button; the header shows what is on as chips. | The household asked for the cards to have at least three-quarters of the page. Measured on the tablet's size: the sheet gives 81% and 76% with three filters on; COURSE kept in the header gives 75% and 70%. |
| D40 | 19 Oct | session | The sheet is outside `.app`, which is `inert` while it is open; Tab wraps inside it as well. | The backdrop must cover the side menu, and `inert` is the one thing that keeps a screen reader and a keyboard out of the page behind; the wrap covers a browser without it. |
| D41 | 19 Oct | session | Opening the sheet puts focus on the panel, not in a text box. *(Amended in PR 2 by D47: with a mouse or keyboard it goes to the find field.)* | A text box would raise the tablet's keyboard over the keyword list every time. + ADD still focuses its own box, as it always did. PR 2's find field is the place to decide if a keyboard device should land in it. |
| D42 | 19 Oct | session | A saved view is one chip carrying its name; typed search text is not a chip and is not counted; CLEAR and CLEAR ALL do what CLEAR ALL FILTERS did (search text included) and also put a sort that is not the default back. | A saved view is a rule (not cooked in 3 months, favourites), not a set of courses and keywords, so it cannot be shown as the chips it would set. The search box is in front of you. A sort is a chip now, so clearing the chips clears it. |
| D43 | 19 Oct | session | The header's count still reads "N OF M" under a filter; the sheet's foot says SHOW N RECIPES, SHOW 1 RECIPE, or NO RECIPES MATCH. | "N OF M" is decision 9 above and is checked; the foot is a button, and a button that says SHOW 0 RECIPES says the wrong thing. |
| D44 | 19 Oct | session | The "Recipes" title stays 56px. | The brief said 48px; 48 saves 2px on the row, which the search box (48px) sets. |
| D45 | 19 Oct | session | Hover tints apply only where a pointer can hover (`@media (hover: hover)`). | On the tablet a tapped pill would otherwise stay tinted until the next tap. |
| D46 | 19 Oct | session | The browser's Back button is not handled; it leaves the page as it does from every dialog. | The app has never used the history API. Making the sheet the first thing that does is a decision for the household. |
| D47 | 19 Oct | session | Opening the sheet puts the cursor in the find field where the main pointer is fine (a mouse or a trackpad), and on the panel where it is a finger. | The brief says the field; the tablet is the household's main device and a text box that takes focus raises its keyboard over the list on every opening. |
| D48 | 19 Oct | session | The keyword pills are ordered once, when the sheet opens: on first, then by use, the most first, ties in the app's own order. | The brief orders them so; re-ordering after every tap would move a pill from under the finger that had just tapped it. |
| D49 | 19 Oct | session | Enter in the find field acts only when nothing matches. | The brief says so. With matches in view there is nothing to create, and the pill meant is one tap away; a shortcut for exactly one match is a possible follow-up. |
| D50 | 19 Oct | session | + ADD in the sheet puts the cursor in the find field; the inline keyword box and its datalist are gone from the sheet. | One way to add a word, not two; Classic keeps its box. |
| D51 | 20 Oct | household | The tablet review's first batch is F1, F3, F5, F6, F7, F9 and F11. F2 (the flow table scrolling sideways) and the sidebar fold proposed for it are **not** done. | "Go ahead with Batch 1". F2 depends on a recipe's steps: 54 of 71 scroll sideways, the fold would fix 14, and PLAN-PREP-STEPS §8 already accepts it. |
| D52 | 20 Oct | session | In the Recipe Viewer at 861px and up the source chip and the SERVE WITH line take `flex-basis:auto`; the header's padding and the buttons' side padding shrink; the rows are 11px apart (`row-gap`). | 32 to 38% of the screen was pinned on every recipe; now 21 to 27%. 11px, not 8 or the base 10, because the buttons' 44px tap reaches 6px past their 34px (measured: every header button 44px, 568 of 568, upright). Scoped to `#view-viewer` (the Group Viewer has neither line) and to 861px up, where a phone keeps its rows. |
| D53 | 20 Oct | session | The save button and the save error are wrapped in `<div class="save-bar">`, which Modernist sticks to the foot of the dialog (negative margins are the panel's 30px). | Markup, not only CSS, so Classic gets an unstyled block (`position:static`, as a check shows). SAVE was 3 to 5 screens down on every recipe. |
| D54 | 20 Oct | session | `.library-switch button`, `.assign-banner button`, `.shop-aisle-select` and `.shop-merge-with` are on the 44px list in `index.html`, so **Classic gets them too**. | That list is the app's own rule for both styles (READABILITY H), and a new button is meant to go on it. The core check lists them. |
| D55 | 20 Oct | session | `.assign-banner` is `min-height:44px` with no vertical padding, and its buttons have 10px of side padding. | The banner stays about as tall as it was (46px, not 66) now its buttons are 44px. |
| D56 | 20 Oct | session | The card's shortlist button is the Lucide list-plus as a mask (`:not(.on)`); the ✓ state keeps its text. | A bare + could mean add, copy or new, and a tablet has no tooltip. Modernist only; Classic keeps the +. help.html says so. |
| D57 | 20 Oct | session | A Settings tab's scroll is reset in the tab buttons' click handler, not in `showSettingsTab()`. | `renderSettings()` calls `showSettingsTab()` after every action, and must not throw the page to the top. |
| D58 | 20 Oct | session | An empty day's CHOOSE A RECIPE takes the whole row (`flex:1 1 100%`, 64px tall); ADD ANOTHER does not. | Only 166px of an 1,100px row answered a tap. |
| D59 | 20 Oct | household | The tablet review's second batch is F4 and F10, with F2 as "a small arrow cue" and no layout change. | "Go ahead with Batch 2 (F4, F10). For F2 a small arrow cue will be sufficient". |
| D60 | 20 Oct | session | The sidebar is the 56px rail on **every** screen from 861px to 1100px (it was the Planner and a recipe in cooking mode, at any width, and a recipe from 861 to 1180). The rail opens the 228px menu over the page (`sidebar-peek`) and a choice folds it back. | The upright tablet is 868px wide, so the full sidebar left 640px: Recipes' cards 195px, History's week with days 34px wide, Shopping's toolbar 879px. **It also applies to a computer window of 861 to 1100px**, and the household may say if it should not. A check shows 1100px folded and 1101px not. |
| D61 | 20 Oct | session | `.shop-head-right` is `flex:0 1 auto; max-width:100%` in Modernist, so the Shopping toolbar can shrink and wrap (it was `flex:none`, 879px). | With the rail the pane is 812px; the toolbar wraps to a second row rather than being cut off. |
| D62 | 20 Oct | session | UNDO for the Planner's × is a bar inside that day (`.day-undo`), kept in memory (one at a time, `PLANNER_UNDO_MS` = 10s), in **both** styles. The × still writes at once; UNDO writes the day back as a save does (one `planner_days` upsert, one `meal_groups` upsert per group). | A removal is a delete of the dish and of its group, and the household has no way back. In the day, beside what was removed, rather than a message elsewhere on a long screen. The bar shows only while the day's entry is exactly what the removal left (`after`), and UNDO refuses if it is not, so a change made on the day since is never written over. A dissolved group is put back only if none of its dishes is now in another group (a dish is in one group a day). Another device sees the removal for up to ten seconds. |
| D63 | 20 Oct | session | F2's arrow (`.flow-more`) is Modernist only (`display:none` in the base CSS), a sibling placed before each viewer table (not inside it, so it does not scroll with it), a 32px dark square with a Lucide arrow-right at the table's top right, `aria-hidden`, `pointer-events:none`. It is shown while the table can scroll further right and hidden at the right end, by a scroll listener and a `ResizeObserver`. Only the two viewers draw it (`opts.prepSteps`), not the Add / Edit preview; both PNG exports (`hideSelectors`) and print leave it out. | "A small arrow cue". Beside the table rather than in it, so it stays still while the table slides under it. A core check reads the export calls and the print block. |
| D64 | 20 Oct | session | History's month title is `max-width:calc(100% - 112px)` and may wrap, at every width; from 861px to 1100px it is 40px (56px elsewhere) and the calendar's side padding is 20px (28px). | Held upright the calendar is 482px, leaving 314px beside the two 40px squares; "September 2026" at 56px is 433px in Archivo 800 (the tablet's font, measured from the font files for all twelve months) and a wrapping row moves an item to a new line before it shrinks it, so › stacked under ‹. At 40px every month is one line in Archivo (widest 309px); a wider fallback font (DejaVu Sans, CI's) wraps a few months to two lines, with the squares level. At 1101px a long month wraps to two lines at 56px (it used to stack the squares). The 40px is not guarded by a check, which cannot know the tablet's font: the check is that ‹ and › stay on one row for the month as it is and for a deliberately long one. |
| D65 | 20 Oct | household | The Planner is made denser by A (a dish on one line), C (an empty day as one short row) and D (the date block, the heading and the week bands tighter), with ADD ANOTHER drawn 28px (the brainstorm's picture included it). The right-hand column for ADD ANOTHER is not done. | "Go ahead with A + C + D". |
| D66 | 20 Oct | session | A dish is its name (`flex:1 1 280px`, wrapping, never "…"), then `.day-recipe-meta` (course, time, SERVES, PRE-MADE, COOKED, one group), then the × (`order:9`). `.day-recipe-meta` is `display:contents` in the base stylesheet, so Classic and a phone keep their rows exactly; Modernist makes it a flex group from 861px up, which wraps under the name as one when the line cannot hold the name at 280px and the group. | The group is markup, not just CSS: a wrapping row moves an item to a new line before it shrinks anything, so without a wrapper the pills would split between two lines. 280px is what keeps a name from becoming a column of words. |
| D67 | 20 Oct | session | ADD ANOTHER and GROUP SOME TOGETHER are 28px with a `::before` reaching 8px past each side and 10px above them (18px to the dish above, as the pills need); an empty day's button is 56px with no padding in its row (`.day-main-empty`), so the whole row is the button; `.day-num` padding 8px; `.planner-days` top padding 14px, `.planner-head` bottom 10px, `.week-label` margin 14px and padding 5px. | Each is a measured amount of height that was not a tap target. An empty day's row was a 64px button inside 10px of padding that did not answer a tap; now all 57px do. |

### Follow-ups found while building (not done here)
- **D10:** the shortlist's × has no spoken label (both styles).
- **D13:** ticking a shopping row from the keyboard loses focus, as the list is redrawn (both styles).
- **D22:** History's side panel scrolls sideways in Classic (the 560px table rule reaches its small table).
- **D29:** on a phone the top bar is 159px tall, as the data links stack at its end (both styles).
- **From the tablet review (20 Oct), not done, with the household to choose:** the second step of F1; and the
  Low findings F12 to F20 (11px capitals, placeholder-only inputs, tooltip-only "EST.", chips at 42px, long lines, the migration text on Settings → APP
  if it shows on the live app, History's cut titles, a viewer that can be nudged sideways by a few pixels).
