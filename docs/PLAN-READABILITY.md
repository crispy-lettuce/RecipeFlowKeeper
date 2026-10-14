# Readability: type, contrast, shapes, tap targets, focus

**Proposed 14 Oct 2026** from a design review of `index.html`'s CSS, with a before/after mock-up (made-up recipe, kept
outside the repo). **Not yet agreed by the household.** Five changes, built one PR at a time in the order below.

**Common to all five:** `index.html` CSS only. No change to data, the database, `core.js`, markup, ids, button wording or
`help.html`. The palette and the IBM Plex fonts stay. Each PR carries browser checks seen failing (`CLAUDE.md` rule 3) and a
tablet step in `docs/TEST-PLAN.md`. Print and EXPORT PNG must still match the screen (PLAN-LAYOUT C).

| Order | Change | Size | Status |
| --- | --- | --- | --- |
| 1 | **T**, colour tokens: contrast and the hard-coded `rgba()` | Small | **Built and merged**, 14 Oct (#147) |
| 2 | **S**, one type scale; mono only for quantities and times | Medium | Proposed |
| 3 | **H**, 44px tap targets | Medium | Proposed |
| 4 | **R**, one corner radius | Small | Proposed |
| 5 | **F**, keyboard focus everywhere | Small | Proposed |

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

## R. One corner radius

There are 12 radius values today: `var(--r)`, 50%, 20px, 999px, 11px, 6px, 5px, 4px, 3px, 2px, 0, and one mixed.

- Everything becomes `var(--r)` (2px), including `.scale-btn`, the day chips, card corner buttons, the toggle,
  `ol.setup li::before` and `.timeline-lane-abs`.
- **Decided 14 Oct by the household:** the toggle thumb is square too (`var(--r)`), to match the rest. No exceptions.
- **Check:** no `border-radius` literal outside `:root`.

## F. Keyboard focus

There is a global `:focus-visible` ring, but 7 rules set `outline:none` (for example `.kw-input`, `.searchbar input`), so those
controls look the same focused and unfocused.

- Remove `outline:none` where the element itself can take focus. For inputs inside a framed box, keep it on the input and give
  the frame `:focus-within{ outline:2px solid var(--plum); outline-offset:2px; }`.
- `.kw-input`: border `--line` when idle, `--plum` plus the ring when focused.
- **Check:** tabbing to `.kw-input` and to the search input changes the computed outline or the frame's outline.

## Not in this plan

- The Modernist restyle (Archivo, red accent). That is a different direction for the household to decide on separately.
- Any wording change (labels stay uppercase in the markup, so tests and `help.html` are untouched).
