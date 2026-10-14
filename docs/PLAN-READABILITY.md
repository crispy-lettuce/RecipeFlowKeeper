# Readability: type, contrast, shapes, tap targets, focus

**Proposed 14 Oct 2026** from a design review of `index.html`'s CSS, with a before/after mock-up (made-up recipe, kept
outside the repo). **Not yet agreed by the household.** Five changes, built one PR at a time in the order below.

**Common to all five:** `index.html` CSS only. No change to data, the database, `core.js`, markup, ids, button wording or
`help.html`. The palette and the IBM Plex fonts stay. Each PR carries browser checks seen failing (`CLAUDE.md` rule 3) and a
tablet step in `docs/TEST-PLAN.md`. Print and EXPORT PNG must still match the screen (PLAN-LAYOUT C).

| Order | Change | Size | Status |
| --- | --- | --- | --- |
| 1 | **T**, colour tokens: contrast and the hard-coded `rgba()` | Small | Proposed |
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
