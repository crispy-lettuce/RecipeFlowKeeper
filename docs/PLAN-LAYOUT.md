# Layout changes: edit dialog, cooking mode, step text, aisle box, Settings

**Asked for by the household on 30 Sep 2026**, with screenshots from the laptop and the tablet. Planned the same day with
mockups (the real app with each change applied temporarily, on made-up test data; kept outside the repo), and **agreed
"all as suggested"** the same day. Five changes, lettered as the household lettered them, built one PR at a time in the
order below.

**Common to all five:** `index.html` only. No change to data, the database, `core.js`, the shopping list's names or its
ticks. Each change hides, moves or re-lays-out something that exists; nothing is taken away. Each PR carries browser checks
seen failing (`CLAUDE.md` rule 3), and a tablet step in `docs/TEST-PLAN.md` (the 37 series).

| Order | Change | Size | Status |
| --- | --- | --- | --- |
| 1 | **C**, step text at the foot of its box, and **A**, edit dialog near full width | Small | **Built and merged**, 30 Sep (PR #57) |
| 2 | **D**, Shopping Aisles shows the current aisle | Small | **Built and merged**, 30 Sep (PR #58) |
| 3 | **B**, cooking mode | Medium | **Built and merged**, 30 Sep (PR #59) |
| 4 | **E**, Settings in tabs, with Swaps | Largest | **Built**, 30 Sep |

## C. Step text at the foot of its box

*"The way I work is check off the ingredients down from top to bottom … you then have to scroll back up to review the
instruction, so logically you would instead just track across to the right to find it."*

A step's box spans every ingredient row that feeds it; its words were centred in that height, which on a long group is above
where the eye ends up. **Decided:** the words sit at the foot of the box (`vertical-align: bottom` on `.box-cell`), level
with the last ingredient that goes into it. **Everywhere:** screen, PRINT / A4 PDF and EXPORT PNG, so what prints matches
what was cooked from. The Group Viewer uses the same table, so it follows.

**Built as** that one rule, with its reason in a comment. Check: in the viewer, every step box is bottom-aligned and a tall
box's words sit nearer its foot than its top; the same under print media. Tablet step 37a.

## A. Edit dialog near full width

The add/edit dialog (one dialog: + NEW RECIPE and EDIT) was capped at 780px, so its recipe preview scrolled sideways and each
step was squeezed to a few words a line. **Decided:** full width less a 20px margin, to 1600px; a phone was already full
width. **Also decided:** the RECIPE SYNTAX box half the screen tall (`max(240px, 50vh)`), since editing is mostly scrolling
it. Syntax and preview side by side was considered and not chosen: the preview grid is itself wide and would be squeezed again.

**Built as** `#addModalOverlay` rules only, so no other overlay changes. Check: at 1280×800 the dialog is 1240px wide and the
box 400px tall; at 412px wide it still fills the width. Tablet step 37a.

## D. Shopping Aisles shows the current aisle

Today you pick a name and an aisle with no idea where the list puts the name now. **Decided:** once a name is in the box, a
line under it says what the list calls it, its aisle now and why ("Pantry, from the dictionary"), and the aisle picker is
set to that aisle. The answer is `ingredientLookup`'s, the same as INGREDIENT LOOKUP, so the two never disagree.

- **Already one of the household's own aisles:** the line says so, with REMOVE, which goes back to where the list would put it.
- **ADD stays greyed out** until a different aisle is picked, so no aisle is stored that the list would use anyway.
- **A name no recipe uses:** the line says so; its aisle can still be set, for a recipe to come.

**Built as** `renderAisleOverrideNow` in `index.html`, run as the name is typed (setting the picker) and when the picker
changes (only greying ADD). REMOVE there is the list's own removal. A name nothing places says Other and leaves the picker
empty, since Other is not an aisle one can pick, with ADD usable. `.btn:disabled` is new: the app had no disabled button
before. Tablet step 37b.

## B. Cooking mode

*"When this is toggled … they only really need to be able to see the information in the red boxes. It would also be useful
to be able to choose to show/hide the timeline."*

KEEP AWAKE already means "cooking from this now" and already hides the sidebar (`.app.keep-awake.viewer-open`). **Decided:**
with it on, the recipe viewer also hides everything not used while cooking, and what is left sits on one header line.
Turning KEEP AWAKE off brings everything back as it was.

| In the recipe viewer | Cooking mode |
| --- | --- |
| ← ALL RECIPES and the meta line (source, serves, last cooked) | shown |
| KEEP AWAKE, RESET TICKS, the Keep Awake status line | shown |
| Title and the recipe grid; the equipment warning when there is one | shown |
| SHOW / HIDE TIMELINE (new) | shown |
| FAVOURITE, + SHORTLIST, EDIT, EXPORT PNG, PRINT, DELETE; the source-comparison chip | hidden |
| COOK FOR row | hidden; if scaled, the header says "COOKING FOR *n*" |

**Also decided:** the timeline is **hidden by default** in cooking mode and the choice is **remembered per device**
(`localStorage`: the tablet and the laptop are used differently); the **header line is pinned** to the top while scrolling;
the **Group Viewer** gets the same treatment (EXPORT PNG, PRINT and UNGROUP hidden).

**Built as** CSS on the class KEEP AWAKE already sets (`.app.keep-awake`), so the buttons are hidden, never removed, and come
back the moment it is turned off. SHOW / HIDE TIMELINE is in both viewers' headers, shown only while cooking, and stores
`kitchen.cookingTimeline` in `localStorage` (one setting for the device, both viewers). **"COOKING FOR *n*" was not added:**
the meta line already reads "SERVES 6 (SCALED FROM 4)" after scaling, which says the same. The header is `position: sticky`:
on a laptop or tablet only the recipe scrolls anyway, so it matters on a phone, where the page scrolls. Tablet step 37c.

## E. Settings in tabs, with Swaps

Settings is ten sections in one scroll, the DICTIONARY alone 140 rows, and Swaps a separate page. **Decided:** three tabs at
the top of Settings, the last one used remembered per device.

| Tab | Sections |
| --- | --- |
| Ingredients | Ingredient lookup, Word matches, Shopping aisles, **Swaps** (moved in), Dictionary (folded) |
| Library | Library check, Sources, Keywords, Recipe photos |
| App | Week starts on, Appearance |

- **The dictionary is folded** to one line ("SHOW ALL 140 ROWS"); typing in the lookup opens it to the matching rows, as it
  filters today.
- **Swaps works as now**: the same form, list, EDIT and DELETE; the lookup's EDIT goes straight to it.
- **SWAPS leaves the sidebar.** Checks that open Swaps from the sidebar will open it from Settings instead; nothing else in the
  suite should change.
- **Built as** blocks marked `data-settings-tab`, shown and hidden by `showSettingsTab` (stored as `kitchen.settingsTab`), in
  the order above; the tab bar is pinned. The Swaps screen's form and list moved into a Settings block with the same ids, so
  every swap handler is unchanged; `showView('swaps')` now opens Settings → Ingredients at Swaps. The dictionary folds with
  `#dictionaryToggle`. Tablet step 37d. Tests that act on the Library or App tabs pick the tab first (tabs are remembered, so
  they pick Ingredients again after).
- Not chosen: one page with a pinned bar of jump links and folding sections. It changes less, but still scrolls, and leaves
  sections open or shut to remember.

## Also settled on 30 Sep

- **Leaked-password protection is a paid-plan feature** in Supabase, and the household is on the free plan, so it is no longer
  an open item (`docs/NEXT-SESSION.md`, 7b).
- **Tablet step 36k** (the ingredient boxes' own dropdown, PR #56): reported "broadly ok" by the household, 30 Sep.
- **Tablet steps 37a, 37b and 37c** (C and A, D, B): reported passed by the household, 30 Sep.
