# Readability: type, contrast, shapes, tap targets, focus

**Proposed 14 Oct 2026** from a design review of `index.html`'s CSS, with a before/after mock-up (made-up recipe, kept
outside the repo). **Not yet agreed by the household.** Five changes, built one PR at a time in the order below.

**Common to all five:** `index.html` CSS only. No change to data, the database, `core.js`, markup, ids, button wording or
`help.html`. The palette and the IBM Plex fonts stay. Each PR carries browser checks seen failing (`CLAUDE.md` rule 3) and a
tablet step in `docs/TEST-PLAN.md`. Print and EXPORT PNG must still match the screen (PLAN-LAYOUT C).

| Order | Change | Size | Status |
| --- | --- | --- | --- |
| 1 | **T**, colour tokens: contrast and the hard-coded `rgba()` | Small | **Built and merged**, 14 Oct (#147) |
| 2 | **S**, one type scale; mono only for quantities and times | Medium | **Built and merged**, 14 Oct (#149) |
| 3 | **H**, 44px tap targets | Medium | **Built and merged**, 14 Oct (#150) |
| 4 | **R**, one corner radius | Small | **Built**, 14 Oct |
| 5 | **F**, keyboard focus everywhere | Small | **Built and merged**, 14 Oct (#151) |

## T. Colour tokens

Measured on paper `#F5F1E6`: `--ink-faint #A79E8D` is 2.4:1, `--ink-mute #8A8172` is 3.4:1, `--ink-soft #6E665A` is 5.0:1.
Body text needs 4.5:1.

- `--ink-faint` → `#736B5C` (4.7:1), same hue. Re-check the dark theme's `--ink-faint` (`#6F6759` on `#1C1915`) the same way.
- `--ink-mute` stays, for borders, icons and text 18px or larger only. Small text using it moves to `--ink-soft`.
- `.side-count` uses `--line-faint` as a text colour: move it to `--ink-faint`.
- 36 `rgba()` literals in the CSS. Replace each with a token so the dark theme follows. Add washes where none exists:
  `--sage-wash`, `--danger-wash`, `--ink-shadow`. Examples: `.qty` `rgba(91,42,74,.09)` → `var(--plum-wash)`;
  `.keep-awake-status.warn` → `var(--danger-wash)`; `.navlink:hover`, `::selection`, `.rcard-shortlist.on`,
  `.rcard-favourite.on`, `.btn.on`, `.prov-chip.prov-warn`, `.day-recipe-premade.on`.
- **Check:** no `rgba(` left outside `:root` blocks (a source grep in a test); in dark theme `.qty`'s background differs from
  `--card`.

**Built as (14 Oct 2026).** The household said "go" for T alone, after a mock-up of five open questions, so S, H, R and F are
still proposed. Measured first, on the app's made-up test data at 1280×800, every visible piece of text on the recipes, viewer,
Planner, Shortlist, Shopping, History, Settings and add dialog, against its real background: **365 text elements in the light
theme and 225 in the dark were under 4.5:1; after T, 25 and 0.** The 25 are all sage or gold used as text, which T does not
touch (below).

- **`--ink-faint` is `#6F6759` in the light theme, not the plan's `#736B5C`.** `#736B5C` is 4.67:1 on paper only; on the Planner's
  group and day rows it is 4.3:1 (UNGROUP, SERVES n, ×). `#6F6759` is 4.95:1 on paper and clears 4.5:1 wherever small text sat
  in the app. The mock-up could not tell the two apart side by side; the price is that "faint" is now almost "soft" (5.01:1),
  so size, capitals and mono carry the difference. **Dark `--ink-faint`** (the plan said to re-check it) was 2.9:1 on a card and is
  **`#938A79`**, within a hair of dark `--ink-mute`; the steps that show are still ink, soft and faint (14.2, 8.0, 5.1:1).
- **All 26 small-text uses of `--ink-mute` are `--ink-soft`**: none of them was 18px or larger, so `--ink-mute` is now a fill only
  (the numbered-step badge). `.side-count` is `--ink-faint`.
- **The 30 `rgba()` literals became 12 tokens**, each with a dark value: the plan's `--sage-wash`, `--danger-wash` and
  `--ink-shadow`, and nine it turned out to need (`--plum-wash-soft`, `--plum-select`, `--sage-wash-strong`, `--sage-line`,
  `--danger-line`, `--ink-shadow-strong`, `--scrim`, `--photo-bar`, `--lane-stripe`). Each alpha is the lowest that keeps small
  text on it at 4.5:1, and the dark ones are set for the same visibility as the light, not the same alpha (a light accent on a dark
  ground shows far more per unit of alpha). `--plum-wash` is shared by fourteen rules and is unchanged; `--plum-wash-soft` is the
  lighter one for today's Planner row, because faint text on the shared wash was 4.47:1. In the dark theme the plum wash behind a
  quantity was 1.03:1 against its card (not there) and is now 1.17:1; selected text had no visible highlight and now has one.
- **Checks:** five in `test/core.test.js` (no `rgba(` in a rule; the two quiet inks at 4.5:1 on paper and card in both themes;
  no `color:var(--ink-mute)`; `.side-count`; every light token has a dark one) and three in `test/smoke.js` (every element in a
  quiet ink at 4.5:1 against its composited background, per theme, about 490 elements each; the dark quantity pill shows).
- **Not done, for the household to decide.** (1) **Sage and gold used as text** (a card's tags, a day's course label, the
  group badge, the favourite star), 2.6 to 3.1:1. A mock-up of `#5A6D53` and `#816522` (4.5:1) showed sage reads olive-grey at
  9 to 10.5px and close to `--ink-soft`; gold stays warm. It needs its own change and a dark check. (2) **A selected Shortlist
  item** barely differs from an unselected one in either theme (its dashed border dominates); `--sage-wash-strong` on
  `.sl-item.selected` would show it. It was already so before T.

## S. One type scale

Today the CSS has 21 sizes (8.5 to 28px), with 76 rules at 10.5px or smaller, and IBM Plex Mono in 108 rules.

| Step | Use |
| --- | --- |
| 13px | Small print, timings (`.step-duration`, timeline ruler and lanes, `.cn-date`) |
| 14px | Labels, buttons, chips, meta, hints, nav (Plex Sans 500, `letter-spacing:.04em`, wording unchanged) |
| 16px | Ingredients (`td`, `.ing-cell`), step text, body |
| 19px | Card titles (`.rcard-title`, unchanged) |
| 22px | Section heads |
| 26px | Page titles (`.recipe-title`, `.planner-head h1`, unchanged) |

- **Mono kept for numbers only:** `.qty` (14px), `.step-duration`, `.day-recipe-time`, `.day-num`, scale buttons, counts.
  Everywhere else `'IBM Plex Mono'` goes back to the body font.
- `.box-cell`: Plex Sans 15px, line-height 1.45. It stays `vertical-align:bottom` (PLAN-LAYOUT C).
- **Decided 14 Oct by the household:** step text sits flush left (`text-align:left` on `.box-cell`), no longer centred.
- Body weight goes from 300 to 400 where text is 16px or smaller (300 is thin on the tablet).
- Done state (`.ing-cell.done`, `.box-cell.done`): opacity .35 → struck through with `--ink-mute` text and a tinted
  background; the tick badge 18px → 26px, 15px glyph, `border-radius:var(--r)`.
- **Check:** computed `font-size` of `.box-cell`, `.viewer-meta`, `.hint`, `.btn` is at least 13px; `.box-cell`'s
  `font-family` is not monospace. Print: the A4 grid still fits a typical recipe (measure one before and after).

**Built as (14 Oct 2026).** The household said "go" with the defaults put to them. Measured on the app's made-up test data and
a made-up "typical" recipe (14 ingredient lines, 5 stages); **the sandbox has no IBM Plex** (Inter and DejaVu Sans Mono stand in),
so every width below is approximate.

- **The scale.** The 212 font-size declarations now use seven sizes, 13, 14, 15, 16, 19, 22 and 26px (21 before). By value: 8.5 to
  9.5 became 13; 10 to 12.5 became 14; 13 stays; 13.5 became 14; 14.5 and 15 became 16; 18 became 19; 24 became 22; 28 became 26.
  The timeline, a step's duration and a cooking note's date are 13px by role. The 15 is `.box-cell` and the tick's glyph, as the
  plan says. **Rules at 10.5px or smaller: 76 to 0.**
- **Mono: 108 rules to 26**, for figures, times and code (the list is in `test/core.test.js`, and exact). The timeline's lane
  labels are step names, so they are Plex Sans (a first pass kept them mono and they were cut off more than before). A label that
  was tracked mono capitals is Plex Sans 500 at `.04em` whatever its tracking was. **Weight:** the body is 400; the 10 rules left
  at 300 are all titles of 19px and up.
- **The done state is struck through in `--ink-soft` on a solid `--well`, not the plan's `--ink-mute`:** READABILITY T made
  `--ink-mute` a fill (3.4:1) and a test forbids it as text. A step box's colours are inline, from the recipe's palette, so only
  `!important` reaches them; the stylesheet already does that for dashed pass-through borders. The tick is 26px, a 15px glyph, a
  square corner.
- **Found by measuring, not in the plan.** The 18px numbered-step badge held a 14px numeral, so it is 24px. `.filter-row-label`
  was 68px and clipped KEYWORD at 14px, so it is 92px. The phone's calendar cell (`.history-day-info`) is 13px on one line (at
  14px it showed about three letters). The one size outside the stylesheet, `font-size:11.5px` in a style attribute on GROUP
  SELECTED in the Planner's group picker, is removed from the attribute so that button is 14px like the rest.
- **Ingredient cells reserve 40px on the right so the 26px tick never covers a word.** For the made-up recipe the flow table goes
  from 710 to 797px high on the tablet (+12%) and from 730 to 886px on the phone (+21%); the reserve is 45px and 89px of that.
  Reserving only once a cell is ticked leaves the table at 752px and 797px, but ticking then adds a line (22px) to 3 of 13
  ingredient rows on the tablet and 4 of 13 on the phone, which moves the page under the thumb. A one-line change if preferred.
- **What it costs, measured (1280×800, then 412×915).** The recipe viewer's header, with every button, runs to 5 lines (240px)
  from 4 (169px), and on the phone to 8 lines (396px) from 6 (278px). In cooking mode it stays 3 lines (146px from 134px), and
  on the phone 5 lines from 4. The made-up recipe still prints on 2 A4 sheets. Elements wider than their box: 17 to 18 on the
  tablet and 17 to 19 on the phone; the one new class is the phone calendar's line-clamped dish name.
- **Checks.** Five in `test/core.test.js`: every size on the scale and none in a `font` shorthand; mono on exactly the 26 listed
  rules; body weight 400 and weight 300 only on titles of 19px and up; `.box-cell` as set and at the foot of its box; the done
  state struck through with no opacity and a 26px tick. Four in `test/smoke.js`: the plan's check (13px or more for `.box-cell`,
  `.viewer-meta`, `.hint` and `.btn`, and a step box not mono); no visible text under 13px on the screens walked, both themes; a
  ticked ingredient and step struck through at full opacity in `--ink-soft` over the inline colours, with a 26px tick; the filter
  labels not clipped.
- **Left for H.** The 44px minimum will lengthen the viewer's header again; it already costs 71px at tablet width.

## H. 44px tap targets

`.btn` is about 33px tall, `.scale-btn` about 27px, `.chip` about 26px, `.day-recipe-premade/.cooked` about 22px, and the card
corner buttons 27px.

- `min-height:44px` with `display:inline-flex; align-items:center` on `.btn`, `.chip`, `.scale-btn` (44×44),
  `select.sort`, `.kw-input`, `.day-recipe-premade`, `.day-recipe-cooked`, `.backlink`, `.toggle-switch`.
- `.rcard-shortlist`, `.rcard-favourite`: 27px → 36px visible, with a 44px hit area (padding or `::before` inset).
- Toggle track 36×21 → 44×26.
- Phone (`max-width:860px`) is unchanged except that the minimum height applies.
- **Check:** at 1280×800 and 412×915, every visible `button` in the viewer and Planner is at least 44px tall
  (`getBoundingClientRect`). Make sure the viewer header still fits on one line in cooking mode at tablet width (PLAN-LAYOUT B).

**Built as (14 Oct 2026).** The household chose "option C" from three put to them. Measured on the app's made-up test data and a made-up
"typical" recipe; **the sandbox has no IBM Plex** (Inter and DejaVu Sans Mono stand in), so widths are approximate.

- **The plan's list is shorter than its own check.** It covers the viewer, but with it alone 28 of the Planner's 36 buttons stayed under
  44px (the 12 "+ CHOOSE A RECIPE" rows, the × buttons, SERVES, the GROUPED badge, + ADD ANOTHER, the side-offer buttons) and 7 of 8 sidebar
  buttons did. So the list built is the check's: everything in the viewer, the Planner and the sidebar, in one `TAP TARGETS` block in the
  stylesheet. The × buttons and the round scale buttons are 44px wide too (the × was 13px wide). The links under SERVE WITH and OFTEN WITH
  (`button.serve-with-link`, 21px) are in it as well: the first measurement used a recipe with no SERVE WITH line and missed them, which the
  build's first run of its own smoke check showed; the smoke check's recipe has one. `a.btn` is `inline-flex` so its words centre; the search bar's input fills the bar's 50px (it was 20px, so a tap above or below the words missed); the phone's `NEW RECIPE` and
  nav links are 44px.
- **The card's corner buttons are 36px with a 44px hit area**, made by an invisible `::before` with `inset:-5px`, not the -4px first tried: `inset` is
  measured from the button's padding box, inside its 1px border, so -4px gave a 42px square and -5px gives 44px (the smoke hit test showed it);
  the toggle is 44px by 26px, its thumb 20px travelling 18px.
- **Trimmed so the bigger targets don't cost the screen:** the Planner's day rows (14px to 6px padding), the sidebar's saved views and data
  links (no gaps), the brand and sidebar padding, and the nav links are exactly 44px. Without this the 14 Planner days grew 49% and the
  sidebar pushed IMPORT DATA and SIGN OUT 123px below the fold at 800px tall.
- **Measured, tablet 1280×800 (phone 412×915):** buttons under 44px in the viewer 16 to 0 (16 to 0), in the Planner 30 to 0 (29 to 0), in
  the sidebar and navigation 7 of 14 to 0 (10 of 10 to 0). The recipes filter area 213 to 249px (383 to 461); the viewer's header 203 to
  244px (359 to 414), the same number of lines; the cooking-mode header still one line for a short meta line, 76 to 83px (4 lines, 212 to
  253px); **the 14 Planner days 913 to 1124px, +23% (1062 to 1394px, +31%)**; the sidebar fits 1280×800 with 12px to spare (SIGN OUT's
  bottom edge at 788px), **but at 1280×720 it scrolls by 46px, where it fitted before.**
- **PLAN-LAYOUT B's "one line"** depends on the recipe's meta line: with a long one, the header wraps to two rows in cooking mode, before H
  and after. The check proves the controls themselves (← ALL RECIPES, the switch, RESET TICKS, SHOW TIMELINE) fit on one line with the information rows
  (meta line, provenance, SERVE WITH, OFTEN WITH) hidden, and that each of those rows, shown again, adds at most one more line. (Its first
  form assumed a one-line header and failed on the unmutated build, because the test recipe's header carries information rows beyond the
  meta line.) The header
  heights quoted above are for a recipe with none of those rows except the meta line; a SERVE WITH or OFTEN WITH row adds a line of 44px
  links, not measured in pixels.
- **Checks.** Three in `test/core.test.js`: every listed selector has `min-height:44px` (the × and scale buttons `min-width:44px` too); the
  card buttons are 36px with the `::before`; the toggle is 44×26 and its thumb's travel is the room it has. Four in `test/smoke.js`: every
  visible button in the viewer, Planner and sidebar at least 44px tall at tablet width, and in the viewer, Planner and navigation at phone
  width (a second page at 412×915); the card buttons answer a tap at the four edges of a 44px square around them (a hit test, since a
  `::before` doesn't change the rectangle); the cooking-mode header as above.
- **Still under 44px, left alone** (outside the plan's list and its check; the same at tablet width): the add dialog's close × (30px) and its
  underlined `link-btn`; the text fields in Settings (30px) and the cook-note box (38px); the Library tab's 13px "only those needing
  attention" tick box (its target is a line of text; not measured); the 21 QUICK ANSWERS links in Settings → HELP (text
  links). History, Shortlist and the other Settings tabs' buttons are covered by the list as it stands (12, 7 and 14 down to 0). Shopping needed
  nothing: each item is a full-width 60px label, and its 18px checkbox is not the target.

## R. One corner radius

There are 12 radius values today: `var(--r)`, 50%, 20px, 999px, 11px, 6px, 5px, 4px, 3px, 2px, 0, and one mixed.

- Everything becomes `var(--r)` (2px), including `.scale-btn`, the day chips, card corner buttons, the toggle,
  `ol.setup li::before` and `.timeline-lane-abs`.
- **Decided 14 Oct by the household:** the toggle thumb is square too (`var(--r)`), to match the rest. No exceptions.
- **Check:** no `border-radius` literal outside `:root`.

**Built as (14 Oct 2026).** The household said "go" to five lines that kept two square edges, which is a departure from the plan's "no
literal outside `:root`" and is named below. Measured on the app's made-up test data in Chromium; a corner does not depend on the font, so
the missing IBM Plex does not matter here.

- **Twenty of the 74 declarations changed, to `var(--r)`** (22 had not been; two stay). 50% (5): the card's star and **+** (two rules), the
  toggle's thumb, the numbered set-up step's badge, and the Planner's **+** circle (`.day-choose .circle`, which the plan's list does not name
  but "everything" covers). 20px (3): `.scale-btn`, `.day-recipe-serves`, `.day-cal-btn`. 999px: PRE-MADE and COOKED. 13px: the toggle's track
  (H made it 13px from 11px). 5px (4): the shopping merge filter, the sameas filter, the ingredient lookup, the aisle select. 6px: the photo
  preview. 4px: the group picker's tick. 3px: `.timeline-lane-abs`. And three 2px literals, the same value written out. Twelve distinct values
  became three, and every one but the exceptions is `var(--r)`.
- **Two corners stay square, because they sit against another edge** and a round corner would leave a notch: `#viewerEquipmentWarning`
  (`0`: a full-width strip with no side borders) and `.sidebar-peek-btn` (`0 var(--r) var(--r) 0`: its square side is the one attached to the
  window). The check names both and fails if either changes. Neither was seen on a screen: the strip only shows for a recipe with an equipment
  warning, and the tab only on a mid-width screen with a recipe open.
- **The household's 14 Oct decision stands:** the toggle's thumb is square too, no exception.
- **Measured, tablet 1280×800 (phone 412×915 gave the same):** elements and pseudo-elements on screen with a corner other than 0 or 2px,
  54 to 0 (before: Recipes 8, the viewer 15, cooking mode 3, the Planner 19, the add dialog 8, Settings 1). **Layout: no size changed on any
  of 1,470 elements (tablet) or 1,358 (phone).** Positions were identical but for the add dialog (+13px on all 207 of its elements, which is the
  dialog's scroll position: unchanged `main` gave -728 and then -715 on two runs, and the new tree the same two values) and one toast
  caught 1px apart mid-animation.
- **Looked at:** before and after screenshots of the Recipes grid and the Planner, and the viewer after. The star and **+** are 36px
  squares in the same places; the Planner's **+** is a square and **COOKED** a rectangle, with every row where it was; the toggle's thumb,
  the servings buttons and the step badge are square.
- **Checks.** One in `test/core.test.js`: every `border-radius` declaration in the stylesheet (the per-corner ones too, and those inside
  `@media`) is `var(--r)`, bar the two named, and `--r` is 2px. Two in `test/smoke.js`, tablet and phone, each on a page of its own: the
  computed corners of every visible element and its `::before` and `::after`, on 12 screens (1,157 and 1,045 corners), are 0 or 2px. A scan
  of whatever is on screen could pass empty, so it fails unless the card's two buttons, the toggle's thumb and track, a servings button and a
  Planner **+** were seen.
- **Not seen:** PRINT and EXPORT PNG with the new corners (a canvas export draws corners itself); the numbered badge and the timeline's lanes
  were seen in the measuring script and a screenshot but are not on the smoke scan's must-see list. `help.html` has two `2px` literals of its
  own, which the plan (CSS in `index.html`) does not cover; they are the same value.

## F. Keyboard focus

There is a global `:focus-visible` ring, but 7 rules set `outline:none` (for example `.kw-input`, `.searchbar input`), so those
controls look the same focused and unfocused.

- Remove `outline:none` where the element itself can take focus. For inputs inside a framed box, keep it on the input and give
  the frame `:focus-within{ outline:2px solid var(--plum); outline-offset:2px; }`.
- `.kw-input`: border `--line` when idle, `--plum` plus the ring when focused.
- **Check:** tabbing to `.kw-input` and to the search input changes the computed outline or the frame's outline.

**Built as (14 Oct 2026).** The household said "go" to five lines that included the side-menu fix below. Measured on the app's made-up test
data in Chromium at 1280×800; focus rings do not depend on the font, so the missing IBM Plex does not matter here as it did for S and H.

- **The seven rules.** `outline:none` was on `.searchbar input`, `.kw-input`, `.shortlist-input`, `#importInput`, `.field-row input` and
  `select`, `#sourcePasteInput`, and the login card's input. The search input keeps it, and its frame draws the ring instead
  (`.searchbar:focus-within`: 2px `--plum`, offset 2px); the other six lost it, so the page's own ring shows on them. Their `:focus`
  border-colour changes stay, so a focused field has the ring and the plum border. **A text field always matches `:focus-visible`, so a
  tap into one draws the ring as well as a keyboard press**; the tablet will show it.
- **`.kw-input`** is `--line` until it has focus and `--plum` then, as the plan says. The box is replaced the moment it loses focus, so its
  idle border is rarely seen. `.shortlist-input` keeps its plum idle border (the plan does not mention it): focused and idle differ by the
  ring alone.
- **One rule beyond the plan's list:** `.sidebar :focus-visible{ outline-offset:-2px }`. The side menu is `overflow-y:auto`, which clips
  sideways too, and its links fill its width, so a ring 2px outside a link lost its left and right edges. Measured: cut off on the menu's
  links on all five screens walked before, on none after.
- **Measured, by walking Tab on the made-up data** (light and dark gave the same counts): stops with no visible ring were 1 of 42 on
  Recipes (the search box), 1 of 45 on the Planner (the Shortlist name box) and 4 of 31 in Settings (the four swap fields), 0 on Shopping
  and History; the keyword box looked the same focused or not. After: 0 on every screen. The ring is `--plum` on the page: 9.9:1 against
  `--paper` and 10.6:1 against `--card` in light, 6.7:1 and 6.3:1 in dark (3:1 is the bar for a focus indicator).
- **Rings still cut off, left alone** (the measuring script flagged both; why is a guess): a **+ CHOOSE A RECIPE** button at the foot of the
  Planner's scroll area, probably because the browser scrolls a tabbed-to button flush to the edge with no room for the offset; and the
  Shortlist panel on History, which takes a Tab stop there, probably because Chromium makes a scrolling region focusable, and sits against
  the window's edge. Neither was looked at on a screen.
- **Checks.** Three in `test/core.test.js`: the only `outline:none` left in the stylesheet is the search input's; the search frame has the
  2px plum ring and the side menu the inside offset; `.kw-input` is `--line` then `--plum`. Three in `test/smoke.js`: Tab walked over
  Recipes, the Planner and both of Settings' working tabs, each on a page of its own (139 stops), every stop with a 2px plum ring on itself
  or its frame, and the keyword box too; the same in the dark theme, with the dark theme's colour; and the side menu's rings inside the
  menu. The walk must reach the search box, the Shortlist name box and a swap field or it fails. Its first form started Tab in the middle of
  the page, never reached the search box, and so passed with that box's ring removed, which the mutation for it showed.
- **Not covered by a browser check:** Shopping and History were walked in a throwaway script (0 stops without a ring), but `smoke.js` walks
  Recipes, the Planner and Settings only; the login input and the source paste box were not on screen in the stub, so only the core check
  sees them.

## Not in this plan

- The Modernist restyle (Archivo, red accent). That is a different direction for the household to decide on separately.
- Any wording change (labels stay uppercase in the markup, so tests and `help.html` are untouched).
