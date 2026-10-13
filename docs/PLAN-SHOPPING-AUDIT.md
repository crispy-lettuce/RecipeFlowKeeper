# Fixing names and aisles from the shopping list (issue #94, second half)

**Built 13 Oct 2026** (the PR after #133; HANDOVER §7 has what was checked). **Written 13 Oct 2026** (date from `date -u`) against `origin/main` at `e11de60`. **A plan, not built; nothing in the repo,
the database or GitHub was changed to write it.** Line numbers are `origin/main`'s. The first half of #94 (ticked items left
off PRINT and the PNG) was in progress, uncommitted, in the same working tree when this was read (merged as #132, 13 Oct); §7 says where the two meet.

The household's words in #94: *"New 'audit' Setting that shows/hides the 'merges with' option plus a new shortcut to adjust
Aisle of an item."*

## 1. What it is for

A name in the wrong aisle, or two spellings on two rows, is noticed on the shopping list, mid-week, with the list open.
Today the word match can be fixed there (MERGE WITH…) but the aisle cannot: it means Settings → INGREDIENTS → SHOPPING
AISLES, typing the name again, and coming back. AUDIT puts both fixes on the row, and keeps them off the list the rest of
the time, so the list taken to the shop is just the list.

## 2. What exists today (read in the code)

**The rows.** `renderShopping()` (`index.html:6538`) draws one `.shop-row` per item: the `<label class="shop-item">` (the
tick, `data-key` = the stored tick key, `'both|' + key` on BOTH WEEKS) and, outside the label so a tap never ticks,
`.shop-tools` (`:6640`). `.shop-tools` is styled at `:818` and hidden by `@media print` at `:1458`.

**"Merges with" is on every row, always.** `.shop-tools` holds (a) the strict suggestion, `Same as <b>X</b>? MERGE ·
KEEP APART`, at most one per row (`suggestionFor`, `:6615`), from the `suggestions` that `buildShoppingList` *returns*
(`:6510`, `strictMatchSuggestions` in `core.js:1384`); and (b) `MERGE WITH…` (`:6644`) on every row. The click handler in
`initShoppingListeners()` (`:6689`): MERGE writes at once (`:6722`, `addAlias('ingredient', from, to)`); KEEP APART writes
an `ingredient_distinct` pair; MERGE WITH… opens a filter over `allLibraryIngredientNames()` (`:6520`), a pick, then a
confirm line `Merge A with B? MERGE · CANCEL` (`:6761`) — only that MERGE writes. **Neither is behind any switch.** The
only other place suggestions surface is the add form's review, for a recipe's new names.

**Word matches are written** by `addAlias(kind, alias, canonical)` (`:3508`): one upsert to `aliases`, `onConflict
'household_id,kind,alias'`, write key `aliases:kind|alias`; removed by `removeAlias` (`:3521`), Settings → WORD MATCHES.

**Aisles are decided** in `aggregateShoppingLines` (`core.js:1300`): the household's own aisle first
(`applyAisleOverride(key)`, `index.html:3547`, a lookup in the map `aisleOverrideMap` builds, `core.js:1802`), else the
dictionary or a keyword rule (`aisleAndWhy`). Each item carries `category` and `aisleWhy` (`dictionary`, `keyword`,
`override` or `none`); `AISLE_WHY_TEXT` (`index.html:8906`) words them. **The aisle is applied after the key is final, so it
never re-keys a tick** (comment at `core.js:1295`, smoke "the row moves to that aisle … with the same key and its tick kept").

**Aisles are written** by `addAisleOverride(name, aisle)` (`:3549`): `shoppingKeyForName(name)` makes the key, one upsert
to `aisle_overrides`, `onConflict 'household_id,name'`, write key `aisle_overrides:<key>`; `removeAisleOverride(id)`
(`:3564`) deletes by name. Both are refused while `aisleOverridesAvailable` (`:3543`) is false. Two places call them:
Settings → SHOPPING AISLES (`#aisleOverridesBlock`, `:1768`; `renderAisleOverridesList` `:9107`,
`renderAisleOverrideNow` `:9130`, which shows the current aisle and greys ADD until another is picked), and the add
form's review (`aisleSelectHtml` `:9689`, an `AISLE…` select on a new name in Other; the pick writes at once (`:9907`) and
the row says `Moved to <b>Produce</b> · UNDO` (`:9681`), UNDO deleting the override (`:10000`), held in `aisleUndo`
(`:9556`)).

**Toggle patterns.** Per tab: `state.shoppingHideChecked` (`:4662`), HIDE TICKED ↔ SHOW TICKED with `aria-pressed`.
Remembered on the device: `kitchen.cookingTimeline` (`cookTimelineShown`, `:5673`) and `kitchen.settingsTab` (`:8650`),
every read and write in `try/catch`, defaulting when storage is blocked.

## 3. The design

**The button.** `AUDIT` in `.shop-head-right`, after CLEAR TICKS, as a `.btn` with `aria-pressed`. On, it reads
`END AUDIT`. When audit is off and the list has suggestions, it reads `AUDIT · 2` (the number of rows carrying a
`Same as …?`), so a waiting question is still seen without cluttering the list.

**Its state: remembered on this device** (`localStorage 'kitchen.shoppingAudit'`, read through a `shopAuditOn()` like
`cookTimelineShown`, wrapped in `try/catch`, off when storage is blocked or empty). Why: the household asked for a
"Setting", so it should survive a reload; per device, because AUDIT on the tablet at home should not put tools on the
phone in the shop. Not in `household_settings`: that would be a column, and it is a view preference, not a household fact.

**Audit off (the default).** `.shop-tools` is not drawn at all: no `Same as …?`, no MERGE WITH…. **This is a change:
today both show on every row, always.** The household confirmed it on 13 Oct (§9, Q1).

**Audit on.** Each row's `.shop-tools` holds, in this order:

1. **The strict suggestion**, exactly as today (`Same as <b>X</b>? MERGE · KEEP APART`).
2. **MERGE WITH…**, exactly as today (filter, pick, confirm, only MERGE writes), with the tick warning below.
3. **The aisle line, new:** `Aisle:` and a select of `INGREDIENT_AISLES`, **set to the row's current aisle** (Other shows
   as `AISLE…`, as in the review), then why, from `aisleWhy` (`from the dictionary`, `from a keyword rule`, `your own
   aisle`, `nothing places it`). Picking another aisle writes at once through **`addAisleOverride(it.key, aisle)`** — the
   row's key, **never `data-key`**, which carries `both|` on BOTH WEEKS. The list redraws, the row moves to its new aisle,
   is scrolled into view, and says `Moved to <b>Produce</b> · UNDO`. UNDO puts back what was there: **a previous own aisle
   is upserted again; with none, the override is removed** (the review's UNDO only ever removes, because it only offers the
   select in Other; on the list a row may already have one). One UNDO is held at a time (`shopAisleUndo`, per tab, cleared
   on the next pick or when audit ends), as `aisleUndo` is.
   While `aisleOverridesAvailable` is false the select is not drawn; the row says `Aisles can't be set yet` instead.

Code: one `aisleOptionsHtml(selected)` shared by `aisleSelectHtml`, Settings' select and the list, so the three cannot offer
different aisles. The list's override wording needs its own phrase (`AISLE_WHY_TEXT.override` says "set below", which is
Settings'). Every write is one row through the existing functions; nothing new reaches the database.

**What does not change.** `buildShoppingList` (`:6468`) is untouched and stays side-effect free: the audit flag is read
only in `renderShopping` and the handlers, never in it, so `updateSidebarCounts` (`:4776`) is unaffected. Ticks are
unaffected by audit itself; HIDE TICKED, BOTH WEEKS and CLEAR TICKS work the same in both modes. ⇄ POSSIBLE SWAPS is
unchanged. Settings → WORD MATCHES and SHOPPING AISLES still list and undo everything the list writes.

## 4. Ticks and re-keying

**An aisle never re-keys a tick** (§2): the row moves, keeps `data-key`, keeps its tick. Checked by a smoke check (§6).

**A word match does.** MERGE folds `from` into `to`: the merged row is keyed `to`. A tick on `from` is left behind in
`shopping_checked`, unseen; a tick on `to` now covers both. The dangerous case is **`to` ticked, `from` not**: the merged row
shows as ticked, so the amount still to buy is hidden — and after the first half of #94, left off PRINT and the PNG too. This
is household data through an existing feature, not a naming-rule change, so CLAUDE.md's re-measure applies only if the build
touches `shoppingLine` or the dictionary (it must not).

**Recommended (Q3):** both MERGE paths go through one `mergeOnList(from, to)` that writes the alias and, **if exactly one
of the two rows is ticked on this list, unticks `to`** for this week and mode (cache, then `saveTick(week, key, false)`, one
row). Both ticked stays ticked; neither stays unticked. **The UI warns before it happens:** when either side is ticked, the
`Same as …?` line and the MERGE WITH… confirm line add `The merged row will be unticked, so check you have enough.` Other
weeks' ticks are not touched (said in the help guide).

## 5. Phone, print and PNG

- **Phone (412 px).** `.shop-head-right` is `flex:none` with no wrap (`:788`); a sixth control can push the page sideways.
  Add `flex-wrap:wrap` to it inside the `max-width:860px` block (beside `.shop-head{flex-direction:column}`, `:1406`).
  The aisle select gets `max-width:100%`; `.shop-tools` already wraps. Whether today's head already overflows at 412 px
  is **not verified**; the first smoke check below measures it before anything is changed.
- **PRINT** already hides `.shop-tools` (`:1458`). **PNG**: on `origin/main` `exportNodeAsPng` hides only
  `.shop-head-right` (`:6805`), so the tools are in today's picture; the first half's work adds `.shop-tools` to
  `hideSelectors`, and this PR relies on that (or adds it if it lands first). Audit on or off, both outputs are the same.

## 6. Checks (smoke suite; each seen failing once, the mutation named)

1. Off by default: no `.shop-tools` on any row, AUDIT `aria-pressed=false`. *Mutation: draw the tools regardless.*
2. With a fixture pair, off reads `AUDIT · 1`; on, `END AUDIT`. *Mutation: count from the filtered categories.*
3. On: every row has MERGE WITH… and an aisle select set to its own aisle; the fixture pair has `Same as`. *Mutation: leave
   the select unset.*
4. Remembered: on, reload, still on; storage that throws renders off with no error. *Mutation: drop the try/catch.*
5. Toggling AUDIT writes nothing (`__WRITES__` unchanged) and `buildShoppingList` returns the same either way.
   *Mutation: save the flag through `queueWrite`.*
6. Aisle pick on **BOTH WEEKS**: one upsert, `onConflict household_id,name`, `name` is the row's key without `both|`; the row
   moves aisle, same `data-key`, tick kept; `Moved to … UNDO` shown. *Mutation: pass `data-key`.*
7. UNDO with no prior own aisle: one delete; with a prior one: one upsert of the prior aisle. *Mutation: always delete.*
8. MERGE with `to` ticked, `from` not: warning shown first; then one alias upsert and one tick delete for `to`; merged row
   unticked. Both ticked: no tick write. *Mutation: skip the untick.*
9. Table missing: no select, the one line instead, no write offered. *Mutation: drop the availability guard.*
10. 412 px, audit on: no horizontal scroll, AUDIT inside the viewport. *Mutation: remove the `flex-wrap`.*
11. Print and PNG with audit on: no `.shop-tools` visible (extends the first half's checks). *Mutation: remove `.shop-tools`
    from `hideSelectors`.*

`core.test.js`: `shoppingKeyForName` returns a key unchanged (the list passes keys, not names). Measured while writing this
over the dictionary's 489 wordings and six made-up lines: 0 change. **Not measured on the live library.**

## 7. The PR

`index.html` and `help.html` only. **No schema change** (`aliases`, `aisle_overrides` and `shopping_checked` exist; the
flag is device storage) and **no `core.js` change**, so no version bump there. Merge after the first half of #94, or rebase
over it: both touch `renderShopping` and the PNG call.

- **`changelog.json`**: a new top entry (next version after the first half's `2026-10-13.1`, from `date -u` on the day),
  issue 94, e.g. *"AUDIT on the shopping list shows MERGE WITH… and an aisle picker on every row, so a name or an aisle can
  be fixed from the list. Turn it off with END AUDIT; it stays as you left it on each device. Merging two rows when only
  one is ticked unticks the merged row."* `APP_VERSION` to match.
- **`help.html` §7 Shopping**: a bullet `id="shopping-audit"`: <b class="ui">AUDIT</b>, <b class="ui">MERGE WITH…</b>,
  <b class="ui">MERGE</b>, <b class="ui">KEEP APART</b>, <b class="ui">UNDO</b>, <b class="ui">END AUDIT</b>; the
  `Same as …?` bullet says it appears in AUDIT; the intro's "moved there in Settings → SHOPPING AISLES" adds "or from the
  list's AUDIT". A QUICK ANSWERS link, *"How do I move something to another aisle?"* → `help.html#shopping-audit`. Run
  `node test/help-guide.js`.
- **`docs/TEST-PLAN.md` 54a** (53a is the first half's) and the same step in **`docs/HOUSEHOLD-JOBS.md`**: (1) SHOPPING: no
  MERGE WITH… on any row; AUDIT at the top. (2) AUDIT: each row shows MERGE WITH… and its aisle. (3) Move one item to
  another aisle: it moves, keeps its tick, says Moved to … UNDO; UNDO puts it back. (4) Reload: still in audit; the phone is
  not. (5) On the phone, AUDIT: nothing runs off the side. (6) PRINT and EXPORT PNG in audit: no tools. (7) END AUDIT.
  Writes one aisle row in (3), removed by UNDO.
- `docs/ARCHITECTURE.md`'s `buildShoppingList` and `renderShopping` notes gain one sentence each.

## 8. Not in this version

Forgetting a word match from the list (Settings' FORGET stays the one place); a REMOVE for an own aisle on the row (UNDO
covers a slip, Settings' REMOVE the rest); auditing the dictionary itself.

## 9. Decisions (answered 13 Oct 2026)

**Answered by the household on 13 Oct 2026: "defaults on all plans", so each question below is decided as its recommended answer.** Nothing is built yet.

1. **Hide "Same as …?" and MERGE WITH… unless AUDIT is on?** *Default: yes*, as #94 reads; `AUDIT · n` says when a
   question is waiting.
2. **Remembered or not?** *Default: remembered on each device*; the alternative is off again whenever the app is reloaded.
3. **MERGE when only one of the two rows is ticked.** *Default: warn, then untick the merged row on this list*, so nothing
   still to buy is hidden or left off the printout; the alternative is a warning only.
4. ~~Where the switch lives~~ **Decided 13 Oct:** a button at the top of the shopping list.
5. **The label.** *Default: AUDIT / END AUDIT*; the household also suggested SETTINGS.
