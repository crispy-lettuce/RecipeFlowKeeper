# Settings → INGREDIENTS: folding sections and one search (#95)

**Asked for by the household** in issue #95: the INGREDIENTS tab will get hard to read as its lists grow. On 13 Oct 2026 they
chose **collapsible sections plus a search**, and asked: *"Should there be a 'main' search within this section that searches all
tabs for instances?"* Planned 13 Oct 2026 (date from `date -u`) as a design only; nothing is built. §7 has the questions, each
with a recommended answer.

**In short:** `index.html` and `help.html` only. No schema change, no `core.js` change, no change to how the shopping list names
anything, so no tick is re-keyed. What is open or folded is remembered on the device; the search is never stored.

## 1. What exists today (read 13 Oct 2026)

- **The tabs.** `#view-settings` (`index.html:1725`), with a pinned tab bar of four buttons (`index.html:1735-1740`, CSS
  `:1244-1246`). Every block is a `.settings-block` with `data-settings-tab`. `showSettingsTab` (`:8648-8658`) sets `hidden` on
  each block, marks the active button, and stores the tab in `localStorage` as `kitchen.settingsTab` (`settingsTabStored`,
  `:8645-8647`, inside `try/catch`). `renderSettings` (`:8128`) redraws every list, then `showSettingsTab(settingsTabStored())` (`:8148`).
- **The INGREDIENTS tab, in order:**

| Block | Markup | Drawn by | What it shows |
| --- | --- | --- | --- |
| INGREDIENT LOOKUP | `:1741-1747`, `#ingredientLookup` | `renderIngredientLookup` `:8918-8938`, answer from `ingredientLookup` `:8907` | What the list calls the typed wording, its aisle and why, its word matches (FORGET) and swaps (EDIT) |
| WORD MATCHES | `:1749-1766` | `renderAliasesList` `:8762-8810` | ADD form; rows under INGREDIENTS, SOURCES and KEPT SEPARATE labels, each with FORGET / ASK AGAIN |
| SHOPPING AISLES | `:1768-1783` | `renderAisleOverridesList` `:9107-9124`, `renderAisleOverrideNow` `:9130` | ADD form with the "where it goes now" line; rows "name in aisle" with REMOVE |
| SWAPS | `:1785-1803` | `renderSwaps` `:9204` | The swap form; rows with EDIT and DELETE |
| DICTIONARY | `:1805-1811` | `renderDictionaryList` `:8944-8962` | Folded behind `#dictionaryToggle` ("SHOW ALL 140 ROWS" / "HIDE THE DICTIONARY", `dictionaryOpen` `:8943`); rows by aisle |

- **A search already exists, in part.** Typing in the lookup box filters the dictionary by name or wording and opens it to the
  rows that match (`:8922`, `:8945-8953`). The lookup's EDIT on a swap calls `showView('swaps')` (`:9099`), which opens Settings →
  INGREDIENTS and scrolls to `#swapsBlock` (`:4715-4722`).
- **The other tabs are not ingredient lists.** LIBRARY: LIBRARY CHECK (a report of recipes, run on demand), SOURCES, KEYWORDS,
  RECIPE PHOTOS (two buttons) (`:1813-1853`). APP: week start, appearance, calendar, sharing, Drive backup (`:1855-1887`). HELP:
  the guide link, what's new and quick answers (`:1889-1915`). Where an ingredient is *used* is already searchable: the RECIPES
  box searches "by name, ingredient, or note" (`:1582-1584`).
- **Folding and remembering, as the app already does them.** No `<details>` anywhere. Folds are buttons the app redraws:
  `#dictionaryToggle`, and the cooking notes' SHOW ALL (`:7782`). Per-device memory is `localStorage` under `kitchen.*`, every read
  and write in `try/catch`: `kitchen.darkMode` (`:38`, `:2182`), `kitchen.cookingTimeline` (`:5674`, `:5682`), `kitchen.settingsTab`.
- **A trap.** `renderAliasesList` and `renderAisleOverridesList` call `renderIngredientLookup` when the box has text (`:8763`,
  `:9115`). If the lookup now redraws those lists, the two call each other for ever. §4 breaks the loop.

**Measured on the live database, 13 Oct 2026, counts only:** the first household has 15 word matches (4 ingredient, 1 source,
10 kept separate), 8 aisles and 2 swaps; the second household has none of the three. The dictionary has 140 rows (`core.js`). So
today 140 of the tab's 165 rows are the dictionary. The household's own lists are short, and this is for when they grow.
(KEYWORDS, on LIBRARY, holds 49 and 8.)

## 2. The household's question: one search across all tabs?

**Recommended: no. One search for the INGREDIENTS tab, and it is the lookup box that is already there.**

- The other tabs hold nothing an ingredient search would find. LIBRARY lists recipes, sources and keywords; APP and HELP are
  controls and links. A box that matched across them would switch tabs under you as you typed, and mix unlike things in one list.
- "Instances" of an ingredient across the app means the recipes that use it, and the RECIPES search box already finds those.
- The lookup already gathers everything the app holds about *one* ingredient from every section (name, aisle, word matches,
  swaps). Making the same box filter every list below means one box, not two that disagree.
- **Cheap later, if wanted:** a line in the lookup's answer, "Used in 4 recipes", that opens RECIPES searched for that name.
  The names come from `allLibraryIngredientNames` (`:6516`). If KEYWORDS or SOURCES grow long, the same fold and filter can go on
  the LIBRARY tab, reusing the same functions. Neither is in this plan.

## 3. The proposal

### Folding sections

- **WORD MATCHES, SHOPPING AISLES, SWAPS and DICTIONARY each get a heading you tap** to fold or open the section. The heading
  reads `WORD MATCHES (15)`, with ▾ when open and ▸ when folded. Folded, a section is that one line.
- **Everything under the heading folds**: the explanation, the ADD form and the list.
- **INGREDIENT LOOKUP does not fold**, because it is the search.
- **Open by default:** WORD MATCHES, SHOPPING AISLES and SWAPS. **DICTIONARY starts folded**, as decided on 30 Sep. Its
  heading replaces SHOW ALL 140 ROWS / HIDE THE DICTIONARY.
- **Remembered per device** as `kitchen.ingredientsOpen` (for example `{"matches":true,"aisles":true,"swaps":true,"dictionary":false}`),
  read and written in `try/catch`. If storage is blocked, the defaults are used. Only a tap on a heading writes it, never the search.
- **Counts** are the rows the section lists. WORD MATCHES counts its kept-separate pairs too. SHOPPING AISLES shows no count
  while its table is unavailable (`:1775`).

### One search

- **The INGREDIENT LOOKUP box filters every section as you type**, from the first letter, and also still gives its answer.
  The subtitle gains: *"It also narrows every list below to what matches."* The box becomes `type="search"`, like the
  RECIPES box, so Chrome draws its own ✕ to clear it. The box's own suggestion list is unchanged.
- **What matches:** the words on the row, ignoring case: both sides of a word match or kept-separate pair; an aisle row's
  name and aisle (so "frozen" lists everything moved to Frozen); a swap's original, replacement and notes; a dictionary row's
  wordings, as now. A row named exactly what the lookup says the list calls the wording also matches. So "eggs" finds a row
  stored as "egg" (a made-up example).
- **While searching:** each heading reads `(2 OF 15)`. A section with matches opens. A section with none folds to its heading,
  `(0 OF 15)`. Opened anyway, it says *"Nothing here matches "zzq"."* Group labels with nothing left under them are dropped.
- **Clearing the box** puts every section back as the household left it.
- **Jump-ins open what they jump to.** The lookup's EDIT and `showView('swaps')` open SWAPS before scrolling to it, and
  that is remembered as if the heading had been tapped.

### Phone width

The heading is a full-width button at least 44px tall, with the count on the same line, and it wraps rather than scrolls. When
a section is folded, the 34px gap between blocks (`:1216`) shrinks to 12px, so a tab of folded sections reads as a short list.
No new horizontal scroll at 412px. The search box is not pinned (see §7.5).

### Labels as they will read (for `help.html`, `<b class="ui">`)

`INGREDIENT LOOKUP`, `WORD MATCHES`, `SHOPPING AISLES`, `SWAPS` and `DICTIONARY`. These are unchanged. The count sits in its own
`<span>` beside the `.side-label`, never inside it. That way `test/help-guide.js` still finds each one as a whole label (its
`whole()` needs a `<` straight after, `test/help-guide.js:38`). The layout-E smoke check, which reads `.side-label` text
(`test/smoke.js:3534`, `:3567`), also passes unchanged. `SHOW ALL 140 ROWS` and `HIDE THE DICTIONARY` go; the guide quotes
neither.

## 4. How it would be built

One PR, `index.html` only (plus `help.html`, `changelog.json` and docs):

1. **Markup.** In each of the four blocks:
   `<button type="button" class="ingr-head" data-ingr-section="matches" aria-expanded aria-controls>`, holding the existing
   `.side-label`, a `.ingr-count` span and the chevron. Under it, a `<div class="ingr-body">` wraps the rest. The block's own
   `hidden` stays `showSettingsTab`'s alone. The body folds by its own `hidden`, with a `display:none !important` rule like
   `:1272`.
2. **One function decides, the others draw.** `ingredientsQuery()` gives the box's text. Each list renderer filters its own
   rows by it, draws its empty or no-match line, and reports `{ shown, total }`. A new `renderIngredientsTab()` runs the
   lookup's answer, then the four lists, then `renderIngredientsHeads()` (counts, `aria-expanded`, open or folded). The box's
   `input` handler and `renderSettings` call it. **The loop is broken:** the lookup no longer redraws a list, and the lists'
   calls at `:8763` and `:9115` become calls to the heads only.
3. **The dictionary.** `dictionaryOpen` and `#dictionaryToggle` go. The section's open state does their job.
4. **Jump-ins.** `showView('swaps')` (`:4718`) opens SWAPS first.
5. **Nothing writes to the database.** Folding and searching only redraw. `buildShoppingList` is untouched.

**No schema change**, confirmed: the three tables are already loaded into `cache` at start-up, and the new state lives in the
device's `localStorage`. **No `core.js` change**, so no core version bump. `APP_VERSION` and `changelog.json` do move (§5).

## 5. Checks, guide, changelog, tablet step

**Smoke checks** (`test/smoke.js`, invented rows only, each seen failing once by breaking what it guards, then `git diff` clean):

1. Each heading's count equals the rows in `cache` (word matches of all four kinds, aisles, swaps, `INGREDIENT_DICTIONARY.length`).
   *Break:* count only ingredient matches.
2. On a fresh device, three sections open and DICTIONARY folded. A tap folds and opens a section and sets `aria-expanded`.
   The state survives leaving Settings and a reload. *Break:* open the dictionary by default; drop the store.
3. With `localStorage` throwing (an `addInitScript` stub), the tab draws its defaults and the page has no error.
   *Break:* remove a `try/catch`.
4. Typing an invented word that is in one invented swap and no other row: SWAPS opens at `(1 OF n)`, and the other three fold
   at `(0 OF n)`. Opening one shows the no-match line. Clearing the box restores the remembered states, and
   `kitchen.ingredientsOpen` is unchanged. *Break:* let the search store; skip the restore.
5. The lookup's EDIT opens SWAPS when it was folded (extend the check at `:3206`). *Break:* remove the open in `showView`.
6. At 412px, with every section open and a search typed: no horizontal scroll, and each heading at least 40px tall.
   *Break:* `white-space:nowrap` on the heading.
7. Typing and folding add nothing to the write queue. *Break:* store the query through `queueWrite`.

These existing checks must stay as they are: the dictionary filter (`:3213-3220`, "almond meal" giving one row), layout E
(`:3567`), `#aliasesList` visible (`:112`), and the autocomplete run (`:3231-3348`). A check that folds a section opens it again
before it ends, as tab checks pick INGREDIENTS again.

**`help.html`** §10 (`help.html:280-291`). The INGREDIENTS line gains: *"Each list folds: tap its name to fold or open it, and
the device remembers. Typing in <b class="ui">INGREDIENT LOOKUP</b> narrows every list at once."* `test/help-guide.js` needs no
change. Run it with the rest.

**`changelog.json`**: a new top entry (version from `date -u` on the day, issues `[95]`), with `APP_VERSION` to match:
*"In Settings → INGREDIENTS each list folds to one line showing how many it holds. Tap its name to open or fold it, and this
device remembers. Typing in the lookup box now narrows every list at once."*

**`docs/TEST-PLAN.md`**: step **54a** (the next free number when built), *Folding and searching INGREDIENTS*. **`docs/HOUSEHOLD-JOBS.md`**:
the same as numbered steps under App checks, with what each should show:
1. Settings → INGREDIENTS. WORD MATCHES, SHOPPING AISLES and SWAPS are open, each with its count. DICTIONARY is one line, (140).
2. Tap WORD MATCHES. It folds to one line. Leave Settings and come back. It is still folded.
3. Type a word you know is in one swap. SWAPS opens showing (1 OF …). The others read (0 OF …).
4. Clear the box. WORD MATCHES is folded again, as you left it. Open it again.
5. Do steps 1 and 2 on the phone. Nothing runs off the side.

The #95 line under "Decisions waiting on you" points at this plan. Also: a `docs/DOCUMENT-INDEX.md` entry for the plan, and a
line on `docs/PLAN-LAYOUT.md` E saying the dictionary's fold is now its heading.

**Beside #94's planned AUDIT button:** no conflict. If AUDIT later links into Settings, it can fill this box to land on the row.

## 6. Size

Small to medium: about the size of layout E (PR #60). There is no data work and no household job before it merges.

## 7. Decisions (answered 13 Oct 2026)

**Answered by the household on 13 Oct 2026: "defaults on all plans", so each question below is decided as its recommended answer.** Nothing is built yet.

1. **One box or two?** Use the INGREDIENT LOOKUP box as the search (recommended), or add a separate SEARCH box above it?
   Two boxes would both filter the dictionary and could disagree.
2. **Is the dictionary folded at first?** Folded (recommended, as agreed 30 Sep), or open like the other three?
3. **What folds?** The whole section, ADD form included (recommended), or only the list, with the form always shown?
4. **A section with no matches while searching:** it folds to its heading, showing `(0 OF n)` (recommended), or it stays open
   saying "nothing matches"?
5. **Pin the search box** under the tab bar while scrolling? Not pinned (recommended: on the phone it would take room from the lists).
6. **Search across all tabs:** no, INGREDIENTS only (recommended, §2). Later, a "Used in n recipes" line in the lookup, if wanted.
