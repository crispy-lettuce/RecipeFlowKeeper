# Proposal: a household-editable aisle override, in Settings

**Written 28 Sep 2026, not started.** Raised by the household noticing "Sirloin Steak" on the
shopping list under **Other** instead of **Meat & Fish**, and asking the better question behind
it: since this keeps happening — a past PR fixed 12 mis-aisled rows (25 Sep, PR #20), another
moved one more (27 Sep, PR #22/6c-1) — could the household fix it themselves from Settings,
rather than needing a code change and a PR each time it recurs? This document is the design for
that, checked against the running code, ready to build whenever it's picked up. Two open design
choices in it were settled with the household before writing it down (§"Design choices already
made" below); nothing else here has been.

**Why it happens today.** The shopping list's aisle for an ingredient comes from an exact-match
row in the hand-maintained `INGREDIENT_DICTIONARY` in `core.js`, or, failing that, a generic
keyword fallback (`categorizeIngredient`). Neither recognises "steak" or "sirloin", so the line
falls through to the hardcoded `'Other'` default (`core.js:742`).

## Why this is safe to build — confirmed in the code, not assumed

The shopping-list **key** every household tick (`shopping_checked.item_key`) is stored under is
resolved by `shoppingLine`/`aggregateShoppingLines` *before* any aisle is computed — aisle
(`category`) is a separate, later field, added at `core.js:1138`:
```js
category: aisleFor(it.key, display, it.row), ...
```
An aisle override, by construction, only ever supplies a replacement for this `category` value —
it cannot touch `key`. So this feature can never re-key a household tick, which is exactly the
risk CLAUDE.md's naming-change warning is about. The existing "Word Matches" feature already
proves the same shape works safely today: `alias(key)` in `aggregateShoppingLines` overrides the
*key* itself, deliberately, and the household already uses it from Settings without incident.

## Design choices already made

Asked and settled with the household before this was written down:

- **A new, small, dedicated Settings section** — not folded into Word Matches, not a whole new
  page like Swaps. Proportionate to how rarely this is expected to be used.
- **Independent of Word Matches** — an aisle override applies to whatever shopping-list key a row
  already has. If two recipes word an ingredient too differently to already share a row (e.g.
  "steak" vs "sirloin steak"), the household uses the *existing* Word Matches feature to merge
  them first, then sets one aisle override for the merged name. Each feature keeps doing one job.

## Design

**New table, `aisle_overrides`** — same shape and RLS pattern as the other 13 tables
(`docs/ARCHITECTURE.md` §4; `private.household_ids_for_user()`, `TO authenticated` only, per the
28 Sep RLS-hardening precedent — built already-hardened, not needing a follow-up):

- `id` (uuid, client-generated via `uid()`, PK)
- `household_id`
- `name` (the ingredient as typed, e.g. `"sirloin steak"` — stored raw, like `aliases.alias` and
  `ingredient_swaps.original`, not pre-folded)
- `aisle` (text; must be one of `INGREDIENT_AISLES`)
- Unique on `(household_id, name)` — one override per ingredient, matching `aliases`'s
  `(household_id, kind, alias)` "a word means one thing" convention (`index.html:2818-2821`).

**Matching, in `core.js`.** A new pure helper, next to `ingredientMatchMap` (`core.js:1330-1338`):
```js
function aisleOverrideMap(overrides){
  const map = new Map();
  (overrides || []).forEach(o => {
    const key = shoppingKeyForName(o.name);
    if(key && o.aisle) map.set(key, o.aisle);
  });
  return map;
}
```
`aggregateShoppingLines` gains a third parameter, applied exactly like `alias` is — an override,
never the mechanism, and it runs *after* `key` is already final:
```js
function aggregateShoppingLines(lines, alias, aisleOverride){
  ...
  category: (aisleOverride && aisleOverride(it.key)) || aisleFor(it.key, display, it.row),
  ...
}
```
Export `aisleOverrideMap` alongside the existing exports (`core.js:1345`).

**Household-side plumbing, in `index.html`** — mirrors `aliasMaps`/`rebuildAliasMaps`/
`applyIngredientAlias` (`index.html:2784-2851`) exactly:

- `cache.aisleOverrides`, loaded in `hydrate()` alongside `aliases`/`swaps`
  (`sb.from('aisle_overrides').select('*')`, near `index.html:2534-2540`).
- `loadAisleOverrides()` / `addAisleOverride(name, aisle)` / `removeAisleOverride(id)` — same
  synchronous-cache-then-`queueWrite` shape as `addAlias`/`removeAlias` (`index.html:2822-2845`):
  upsert resolving on `(household_id, name)`, delete by name (not cache id), one row per write,
  never a whole-table replace.
- `rebuildAisleOverrideMap()` (mirrors `rebuildAliasMaps`, `index.html:2785-2807`): recomputes a
  module-level `Map` via `core.aisleOverrideMap(loadAisleOverrides())` whenever the cache changes.
- `applyAisleOverride(key){ return aisleOverrideLookup.get(key); }` — passed as the third argument
  at both existing `aggregateShoppingLines` call sites (`index.html:5068`, the real shopping list;
  `index.html:5099`, `allLibraryIngredientNames()` — harmless there since it only reads
  `key`/`name`, kept for consistency).

**Settings UI** — one new `.settings-block`, same shape as WORD MATCHES (`index.html:1524-1541`),
placed alongside it:
```html
<div class="settings-block">
  <div class="side-label">SHOPPING AISLES</div>
  <p class="subtle">Move something the list got wrong into the right aisle.</p>
  <div class="alias-form">
    <input type="text" id="aisleOverride-name" placeholder="e.g. sirloin steak">
    <select class="sort" id="aisleOverride-aisle" aria-label="Aisle"></select>
    <button class="btn" id="aisleOverrideAddBtn">ADD</button>
  </div>
  <p class="field-error" id="aisleOverrideError" style="display:none;"></p>
  <div id="aisleOverridesList" class="sources-list"></div>
</div>
```
- The `<select>` is populated from `core.INGREDIENT_AISLES` (the same array the dictionary itself
  uses, so it can never offer an aisle the rest of the app doesn't know), in `renderSettings()`.
- `renderAisleOverridesList()` mirrors `renderAliasesList()` (`index.html:6277-6326`): one row per
  override, `name → aisle`, a single REMOVE button per row wired via `data-remove-aisle-override`,
  re-attached on every redraw.
- The ADD button's handler mirrors the alias-add handler (`index.html:6328-6355`): validate a
  non-empty name and a selected aisle, call `addAisleOverride(name, aisle)`, then
  `renderAisleOverridesList(); if(state.view === 'shopping') renderShopping();` — so the change is
  visible immediately, from the cache, not a server round-trip.
- One line added inside `renderSettings()` (`index.html:6178-6190`) calling
  `renderAisleOverridesList()`.

## Implementation steps

1. **Schema first.** Write the migration for `aisle_overrides` (columns/constraint as above), RLS
   policies matching the other 13 tables' `TO authenticated` pattern. This is a production schema
   change — share the exact SQL with the household and apply only with their explicit go-ahead,
   the same way the 28 Sep RLS-hardening migration was.
2. **`core.js`**: add `aisleOverrideMap`, extend `aggregateShoppingLines`'s signature and the
   `category:` line, export the new function, bump `KITCHEN_CORE_VERSION`.
3. **`index.html`**: the load in `hydrate()`, the three cache functions, the map rebuild + apply
   function, both call-site updates, the Settings markup, the two render/wiring functions, the
   `renderSettings()` hookup, and bump `EXPECTED_CORE_VERSION` + the `core.js?v=` tag to match.
4. **Tests:**
   - `test/core.test.js`: a check that an aisle override wins over both the dictionary and the
     `categorizeIngredient` fallback, mutation-tested (temporarily skip the override in
     `aggregateShoppingLines`, confirm the check fails by name, restore it).
   - `test/build.js && test/smoke.js`: add an override through the real Settings form, confirm the
     shopping list's row moves aisle; confirm it survives a reload (the write reaches
     `window.__WRITES__` for `aisle_overrides`); remove it and confirm the row reverts to whatever
     the dictionary/fallback gives it.
5. **Docs**: `docs/ARCHITECTURE.md` — add `aisle_overrides` to the "tables in active use" list and
   update `aggregateShoppingLines`'s function-reference row for the new parameter;
   `docs/INFRASTRUCTURE.md` — the new migration in its history; `docs/NEXT-SESSION.md` /
   `docs/HANDOVER.md` — record what was verified and how, per this project's usual practice.
6. **The Sirloin Steak case itself** is then just the feature's first real use: the household
   types "sirloin steak", picks Meat & Fish, done — no PR needed for this one specifically once
   the feature ships.
7. **Review the diff for private data, open a PR — the household merges, never a session.** Wait
   for `offline-harness` (the required check on `main`) to go green first.

## Critical files

- `core.js` — `aggregateShoppingLines` (1086-1144), `aisleFor` (1024-1034), `ingredientMatchMap`
  (1330-1338, the direct model to copy), `KITCHEN_CORE_VERSION` (28)
- `index.html` — the Word Matches block end-to-end (`aliasMaps`/`rebuildAliasMaps`/
  `applyIngredientAlias` at 2784-2851; `addAlias`/`removeAlias` at 2822-2845; markup at
  1524-1541; `renderAliasesList` at 6277-6326) — the pattern every new piece mirrors
- `docs/ARCHITECTURE.md` §4 (the database) — for the new table's write-up
- (new) a Supabase migration for `aisle_overrides`

## Verification, when this is built

- `node test/core.test.js` and `node test/build.js && node test/smoke.js`, both green, exit code
  checked, new checks confirmed to fail by name once (mutation-tested) before being made to pass.
- A live check once the migration ships: use the new Settings form on the real app to move
  Sirloin Steak to Meat & Fish, confirm it shows there on the shopping list, reload, confirm it
  held.
- `git diff origin/main` reviewed for private data before pushing.
- Confirmed by design, and worth re-confirming after building: the shopping-list `key` for the
  overridden row is provably unchanged (it's computed before `aisleOverride` is ever consulted),
  so no household tick is re-keyed by this feature.

## The general point: one ingredient, several household facts, one key

*Added 28 Sep 2026, after the household asked how all of this is kept right over time rather than
one case at a time.*

An aisle is one of several facts the household holds about an **ingredient** rather than about a
recipe. The others are:

- its word matches ("same" / "not the same"), in Settings → Word Matches and on the shopping list;
- its household swaps, in Settings → Swaps;
- its name and aisle in `INGREDIENT_DICTIONARY` (changed by a PR).

The rules below keep them consistent:

1. **One key.** Each fact is keyed by the shopping-list name, `shoppingKeyForName`, and never by
   recipe. It is answered once and applies to every recipe that uses the name, so a wrong answer
   spreads just as widely as a right one.
2. **Word matches apply first, and everything else follows the key they produce.** That is why
   this override stays independent: merge first, then set one aisle for the merged name.
3. **Naming facts re-key ticks; the others don't.** A word match or a dictionary rename changes
   `item_key`. An aisle or a swap never does. Measure the library before a naming change
   (CLAUDE.md); an aisle override needs no measuring.
4. **Each fact the household sets has one home in Settings** where it can be seen and undone.
   Dictionary rows are the exception, because they live in code. Anywhere else that sets a
   household fact, such as the shopping list's inline buttons or a future ingest review, writes
   through the same function to the same table.
5. **The best time to settle them is when a new name first enters the library**, not weeks later
   on a shopping list. `docs/PROPOSAL-NEW-RECIPE-REVIEW.md` proposes exactly that: a quiet section
   in the Add/Edit preview listing a new recipe's new names, where each will land, likely matches
   and a duplicate check. Its Phase C is this override's aisle pick, offered in place for a new
   name that lands in Other. `tools/remeasure.js` stays the backstop for recipes that arrive
   without going through the form.

## What this document does not cover

- The one-off alternative of just adding a `sirloin steak` row directly to `INGREDIENT_DICTIONARY`
  in `core.js` — still the right call for a single, immediate fix if this feature isn't wanted yet;
  a plain dictionary row also fixes the *display spelling*, which an aisle override alone doesn't.
- Whether the household wants this at all versus continuing to ask for a one-off code fix each
  time — that's the open question this proposal is waiting on, not something to assume from here.
