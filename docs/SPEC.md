# Kitchen (RecipeWrangler): what the app is and does

A reference for anyone picking the project up: what the app is for, what each screen does, what it is built on, and the
rules it keeps. It is a specification of the app **as it stands**, not a history and not exhaustive. For how the code is
built read `docs/ARCHITECTURE.md`; for the household's own how-to read `help.html`; for what changed and when, `changelog.json`.

**Written 22 Oct 2026** from the app at version `2026-10-22.1` (core `2026-10-21.5`), by reading `help.html`, `changelog.json`,
`docs/ARCHITECTURE.md`, `docs/BUILD-BRIEF.md`, `index.html` (the sidebar and its views) and `core.js`. Not checked against the
live database today. Table and function counts are as `docs/INFRASTRUCTURE.md` last recorded them (12 Oct).

---

## 1. Purpose and users

A private recipe app for a few households of one family. It is used mainly from a **tablet propped up in the kitchen**, and from
phones and a laptop. It does five things:

1. Keeps a **library of recipes**, each stored as a *flow* (§3), so a recipe is read as a diagram of what happens when.
2. **Plans** the next fortnight, day by day, and can put the plan in Google Calendar.
3. Builds a **shopping list** from the plan, adding amounts across recipes.
4. Helps you **cook**: scaling, ticking through the diagram, cooking several dishes at once.
5. Keeps a **food diary** of what was eaten, including meals with no recipe.

It is not a public product: there is no sign-up, no ads, no analytics, and the terms say so (`terms.html`, `privacy.html`).

**Household.** Everything a person sees belongs to their household (their recipes, plan, diary, settings). Accounts are made
by hand and linked to a household (`docs/ONBOARDING.md`); one account belongs to one household. Three households exist: the
family's, a second family household, and **Test Kitchen**, used for testing. Households can let each other browse recipes (§6.8).
Nothing else is shared.

---

## 2. The system

| Part | What it is |
| --- | --- |
| **The app** | Two files: `index.html` (page, styles, data layer, every screen) and `core.js` (pure functions and the ingredient dictionary), plus `styles/modernist.css`. No build step, no framework. Served by **GitHub Pages from `main`**, so every merge goes live. Also `help.html`, `privacy.html`, `terms.html`, `changelog.json` |
| **Backend** | **Supabase** (project RecipeWrangler, EU): Postgres with row-level security on every table, Auth, Storage, five Edge Functions (§8) |
| **Google** | Calendar (one calendar the app creates, "RecipeWrangler") and Drive (a folder of weekly backups), by one consent the household gives, both optional |
| **Backups** | A private repo, `PrivateBackup`: nightly database dump, weekly photo mirror, a weekly check that signs in to the live app. The restore runbook is its README |
| **Converter** | Not part of the app. A Claude project loaded with `converter/conversion-instructions.md` turns a web page, photo or text into the recipe format (§3). The app reminds each household when those instructions change |
| **Tests** | An offline harness (`test/`) runs the real page against a stubbed Supabase; CI runs it on every pull request and `offline-harness` is required on `main`. It proves app logic, not the live backend |

**How data moves.** On sign-in the whole library loads into memory; everything afterwards is instant. A change is queued and
written to Supabase in the background, one row at a time. Coming back to a tab re-reads the library, so devices pick up each other's
changes without a reload. Offline use is not a goal, but a short loss of connection loses nothing: the app says it is OFFLINE
and re-sends when it is back. There is no live push between devices.

---

## 3. A recipe

A recipe is **plain text** in `recipes.syntax`; the title, source, servings, tags and the rest are read from that text and
stored beside it for searching. The text is the source of truth.

```
TITLE: My recipe          (also SOURCE:, SOURCE_URL:, IMAGE:, TIME:, SERVINGS:, EQUIPMENT:, TAGS:)
TAGS: course=Main, Vegan
GROUP base:               (ingredients that go in together; the handle is used below)
2 onions, sliced
GROUP finish:
1 lemon, juiced
STAGE:                    (one column of the diagram = one moment in time)
MERGE base -> cooked: soften the onions [10 min]
STAGE:
MERGE cooked, finish -> dish: stir in the lemon and serve [instant]
```

- **Diagram.** Ingredients on the left; each column a moment; boxes merge as things are combined, each with a time. Steps
  with no ingredient go under `STEPS:`; `NOTES:`, `VARIATIONS:`, `STORING:`, `FREEZING:` and `TIPS:` can follow.
- **Rules that matter.** Groups that merge must sit on adjacent rows (order of `GROUP` lines is load-bearing). Anything
  added late gets its own group. Every MERGE ends in a duration: `[8 min]`, `[10-13 min]`, `[1 hr]`, `[instant]`, `[overnight]`.
  An unrecognised bracket is left as label text on purpose. A step that looks after itself once it is going adds `, hands off`
  inside the bracket (`[25 min, hands off]`); hands on is the default, `[overnight]` is hands off by itself, and the mark is not read after
  `[instant]` or without a duration. The box reads `25 MIN · HANDS OFF` and the timeline hatches its bar. The converter writes the mark
  by a rule (waiting 5 minutes or more; occasional stirring from 10 minutes up; never under 5 minutes or on an instant step; a step that is
  prepared and then waits is judged by the wait; pasta or noodles on their own are hands off for 10 minutes or more, or to the packet time; opening the oven once or twice to baste
  does not make a bake hands on; and when unsure it writes nothing, so hands on is what a doubtful step gets).
- **Courses** are a tag, `course=Breakfast | Main | Side | Dessert | Drink | Bread | Baking | Snack`. Side matters (§5.4).
- **Time.** `TIME:` is free text; one beginning `est.` was worked out by the converter from the steps, and shows **EST.**
- **Ingredient lines** have a standard shape (quantity, unit, name, then a comma and preparation), in British English and
  metric. A set of checks warns when a line is outside it; they advise and never block a save.
- **A recipe can carry** a photo (own storage), a record of how its ingredients compared with its source page, and the photos or
  PDFs it was converted from.

---

## 4. Navigation

Sidebar: **RECIPES · PLANNER · SHORTLIST · SHOPPING · HISTORY · SETTINGS**; four **saved views** (Weeknight under 30 min,
Not cooked in 3 months, Sunday roasts, Favourites); **NEW RECIPE**; EXPORT DATA, IMPORT DATA, SIGN OUT.

Two **looks**, chosen per device in Settings → APP → STYLE: **Classic** (paper and plum, rounded) and **Modernist** (flat,
square, one typeface, red for the main action). Light, dark or follow-the-system is separate. Everything works the same in all
four; Modernist also folds the sidebar to a rail on the Planner, in cooking mode and on narrow screens, and puts the Recipes
filters in a panel.

---

## 5. What each screen does

### 5.1 Recipes
A grid of cards. Search by name, ingredient or note (Enter keeps it as a tag filter). Filters: course (several), source, keyword.
Sort: recently added, least cooked, most cooked, recently cooked, A to Z. Each card has **+** (shortlist, turns to ✓) and **☆**
(favourite). Another household's library appears behind a switch at the top when they share with us (§6.8).

### 5.2 Recipe viewer
- The diagram; **tick** a box to tick everything that went into it; ticks last until reload; **RESET TICKS** clears them.
  **Ticking the last column logs the recipe as cooked** and asks which meal (with a note); SKIP logs without one.
- **The timeline strip** above the diagram (hidden in cooking mode until SHOW TIMELINE) draws each step as a bar from the MERGE durations.
  A bar is at least 28 px wide, and an `[instant]` step is a diamond with its name beside it. A hands-off step's bar is hatched, a hands-on one solid. The ruler's last mark ends at the strip's right
  edge, and a middle mark that would collide with its neighbour is left out. **It follows the ticks:** a ticked box greys its bar with a ✓
  (drawn from the boxes as they stand, so it survives a redraw and RESET TICKS clears it), tapping a box flashes its bar, tapping a bar jumps
  to its box. Drawing only: nothing is stored. When the table is wider than the screen, an arrow at its top right says so (both styles; not
  in print or PNG).
- **The run sheet** (planning half 23 Oct 2026, running half 24 Oct; the timers are not built): the strip is on the clock. **EAT AT**
  (with −15, −5, +5, +15 and NOW) is by default now plus the longest dish up to the next five minutes, and is held for the recipe or group open in this tab only,
  never stored; the ruler reads times of day, every box says `AT 17:20` when its step starts, and START AT gives when the meal begins. **YOUR HANDS**
  is a row above the lanes: solid where a hands-on step runs, red hatched where two do at once (a clash), an outline `free 16 min` where nothing
  needs the cook for six minutes or more (between busy stretches only). **AVOID THE CLASH** (shown only while there is a clash, or once pressed, to undo
  it) moves the later hands-on step, and what feeds it, earlier until none overlap, so that dish is ready early; once pressed it is a filled button
  reading `✓ CLASH AVOIDED · TAP TO UNDO` and the heading says what moved. A one-sentence note under the heading says what the lining-up does (FINISH
  TOGETHER: every dish ready at EAT AT, the shorter ones starting later; START TOGETHER: every dish starting at once, the shorter ones ready earlier),
  and each dish says START AT and READY AT. `THAT TIME HAS PASSED: TAP NOW` shows only for a meal planned for today whose start has gone. Ovens: a thin lane per oven, each step
  that says oven, roast or bake in the setting its recipe's preheat line gives (one °C figure, fan or not; a recipe with none, a range or two is left out
  and named); two dishes at one setting share an oven; a sentence says when more settings are wanted at once than **OVENS** (Settings → APP,
  this device only, 1 when unset) allows. A recipe with no step marked `, hands off` (or `[overnight]`) is left out of YOUR HANDS and AVOID THE CLASH, since every step would count as
  hands on and the clashes would be false; a group names the dishes left out, and a group of only such dishes shows no hands row. An `[instant]` step is never drawn in an oven lane. The controls are left out of print.
  **START COOKING** (24 Oct 2026) starts the run at the real time and fixes EAT AT (a default one at now plus the longest dish at that moment). From then
  each tick of a box is noted with its time (this tab only, never stored; a box ticked before START counts as done at that moment; un-ticking and RESET TICKS
  drop it) and the plan is re-drawn from them (`projectRun`): a step ticked late runs from its planned start to the tick, one ticked before its planned start
  is its own length counted back from the tick, and one ticked along with a later one keeps its planned times, cut short at the tick. Every step not yet done is
  no earlier than planned, no earlier than now, after what feeds it, and never on top of another hands-on step (so an un-avoided clash reads as lateness);
  a step whose planned start has passed and whose feeders are done is running and ends at the later of its planned end and now. The bars, YOUR HANDS, the oven
  rows, each box's `AT` and each dish's START AT and READY AT all read the re-drawn plan; a faint dotted mark shows a step's planned start where it has moved.
  The strip says `On time for 18:30` or `Ready at 18:43, 13 min after 18:30`, a Now line says what is going with its time left and the hands' next step
  (`Hands free for 9 min, then: …`), and a red line is the real time. A clock looks once a second, from the real time each time; it moves the line and the Now
  line in place and redraws only the strip (never the flow table) when the plan has moved a minute. AVOID THE CLASH stays on offer while the planned meal has a
  clash. STOP COOKING puts the plan back. The status, Now line, line and marks are left out of print and PNG.
  **START and DONE on a box** (24 Oct 2026): while the run is going each box that is a step of the plan has a START button (a 44px target; none on a step with no
  length, a step already done, a prep box or a carried-across box). Pressing it notes the time (`state.cook.starts[recipeId][handle]`, this tab only) and the box
  reads `STARTED 09:14` with DONE, which is the tick (tapping the box does the same). A step with a start is running from it, even before its planned start or before
  what feeds it (the cook's word); once ticked it is drawn from the start to the tick; un-ticking it puts it back as running; RESET TICKS and STOP COOKING clear
  the starts. The buttons are left out of print and PNG. A run belongs to the recipe or group open (opening
  another ends it) and lasts until reload.
  **Timers** (24 Oct 2026): a started step with a fixed length counts down on its box (`STARTED 09:14 · 8:34 LEFT`), from the minute START was pressed and the
  clock (`stepTimer`, core.js; never by adding up ticks, so a tab that was asleep is right on waking). A step that looks after itself and has a length reads
  START TIMER instead of START. At zero, once for each start of each step: one Web Audio chime (made and resumed in the START or START COOKING tap), one vibration where
  the device has it, the box reads TIME'S UP, DONE pulses (a solid colour under reduced motion), the Now line begins `Time's up: <step>.` and a message names the step
  (and the dish, in a group). A range is due at its **short** end and reads CHECK IT, DONE staying until pressed. A step with no length to count (until done,
  overnight) has no countdown. Rung while the recipe or group is open on screen; nothing is stored or written; no sound setting.
- **COOK FOR** rescales for this time only (2, 4, 6, 8 or any number); nothing is saved. Tin sizes never scale. Liquids change unit
  as they scale (teaspoons under 15 ml, tablespoons under 50 ml, ml from 50 ml); weighed liquids stay in grams.
- **COOKING MODE** keeps the screen awake, hides what is not needed at the hob and folds the sidebar. **SHOW TIMELINE** brings the
  overview back.
- **PREPARATION** (Settings → APP, per device): "2 leeks, thinly sliced" can be drawn as its own step, *Thinly slice the leeks*.
- **Also here:** substitution recommendations (the household's swaps that apply); dated **COOKING NOTES** (ADD A NOTE, FOLD INTO
  NOTES); source chips (compared with its page or not) and SOURCE PHOTO; **SHOPPING LIST** for this recipe alone; PRINT / A4 PDF
  and EXPORT PNG; + SHORTLIST, EDIT, DELETE (which deletes its cooking history and notes).
- **SERVE WITH** and **OFTEN WITH** (§5.4).

### 5.3 Add or edit a recipe
**NEW RECIPE** opens one form: paste a converted recipe (it is read at once) or WRITE ONE BY HAND.
- **WHAT THE APP READ** and advice checks sit below; nothing stops a save. Source and servings are needed.
- **COMPARE WITH SOURCE** reads the web page's own ingredient list and sets it beside the recipe's: grouped by kind of difference
  (missing, extra, more, less, different word), biggest first, an ingredient on several lines shown once with their sum. If the site
  refuses, paste its list in. **VALIDATE INGREDIENT LIST** records that it was checked. A page that repeats whole amounts under each
  step is detected and said.
- **ADD PHOTO OR PDF** keeps the page the recipe came from (private storage); **CHECKED AGAINST THE PHOTO** records the check.
  **UPLOAD PHOTO** gives the card a picture from the device. A web photo is copied into our own storage on save.
- **ADD SEVERAL** takes a whole converted batch in one file or message: each is ticked, held back (no source, servings or steps),
  or flagged as a likely duplicate; only new recipes are added, never changes to existing ones.
- Reviewing as you add or edit: a section shows ingredient names new to the library, the aisle each will land in, near matches already in
  the library, and a duplicate check on the source link. A name that lands in Other gets an aisle pick, whether it is new or already in
  the library (a recipe opened to edit is left out of the library, so a name another recipe also uses counts as known): the pick is
  saved at once with UNDO. Known names that are placed stay a count. (Issue #203, 24 Oct 2026.)

### 5.4 Cooking several dishes together
On the Planner, **GROUP SOME TOGETHER** → **GROUP SELECTED** makes dishes of one day a group, opened as one **Group Viewer**: a
timeline with a lane per dish and each diagram below. **START TOGETHER** starts everything at once; **FINISH TOGETHER** lines
dishes up to be ready together, each saying when to start (START AT 17:35, as a time of day since the run sheet). A group with a Side opens in FINISH TOGETHER. Each dish's lane is headed by its name and colour, its bars are matched to its own diagram
only (two dishes can share a handle name), and the strip's heading wraps at phone width.
- **SERVE WITH:** a recipe that says "serve with rice or naan" (or an ingredient "…, to serve") is matched to Side recipes whose
  title or keyword has that word; the viewer and the Planner offer them, and a tap adds the side to the day and groups it.
- **OFTEN WITH:** recipes previously grouped with this dish, any course, offered the same way.
- UNGROUP separates a group; the dishes stay on the day.

### 5.5 Planner
The next 14 days, rolling, in weeks. Per day:
- **CHOOSE A RECIPE** / **ADD ANOTHER**; **MARK DAY AWAY**; **SERVES** (people for that dish on that day: the shopping list and the
  recipe opened from the Planner follow it); **×** takes a dish off, with a 10-second **UNDO**.
- **TO COOK / PRE-MADE:** a dish defaults to TO COOK. PRE-MADE (with a meal) means "already cooked, from the freezer": it leaves
  the shopping list and goes into the diary by itself on its day, and does not count towards last cooked or the streak.
- **COOKED ✓** (today's dishes): logs it as if the recipe had been finished.
- **+ OTHER:** an entry that is not a recipe (takeaway, meal out, leftovers) with an optional meal, tagged AD HOC. It is the same
  diary entry History's + ENTRY makes. Not on the shopping list or the calendar.
- **Calendar buttons** (§6.6): IN CALENDAR, REMIND ME per meal, ADD THE WEEK.
- The **shortlist** panel: tap a recipe or note, then tap a day. A note becomes an ad-hoc entry on that day.

### 5.6 Shortlist
Ideas waiting for a day: recipes added with **+**, and free-text notes for things with no recipe yet.

### 5.7 Shopping
Adds up every ingredient the week's planned dishes need, scaled to each day's SERVES, sorted into aisles
(Produce, Meat & Fish, Dairy & Eggs, Pantry, Spices & Seasoning, Frozen, Other). This week, next week or both (own ticks).
- Same ingredient from different recipes is merged by the ingredient dictionary and the household's word matches; spoons and ml of
  one liquid add (`145 ml (100 ml + 3 tbsp)`); PRE-MADE dishes contribute nothing.
- **Ticks** show on every device; HIDE TICKED, CLEAR TICKS. **PRINT / A4 PDF** and **EXPORT PNG** leave out ticked items.
- **AUDIT** (a mode): per row, **MERGE WITH…** and an aisle picker with UNDO, and "Same as …?" questions (MERGE / KEEP APART).
- **POSSIBLE SWAPS** lists the household's saved substitutions.
- Per-recipe list from the viewer is separate and its ticks stay on the device.

### 5.8 History and the food diary
A month calendar of what was eaten. Cooked recipes arrive by ticking the last column or COOKED ✓; PRE-MADE meals arrive by
themselves, marked FROM THE FREEZER; **+ ENTRY** adds anything with no recipe. REMOVE deletes an entry (for a freezer meal it also
turns PRE-MADE off on the Planner). **CSV** exports the diary; **STATS** gives totals, the streak and most-cooked.

### 5.9 Settings (four tabs)
- **INGREDIENTS:** INGREDIENT LOOKUP (how the list names something and its aisle); **WORD MATCHES** (two words are one
  ingredient); **SHOPPING AISLES** (move an ingredient's aisle); **SWAPS**; the DICTIONARY. Lists fold and remember it per device.
- **LIBRARY:** **LIBRARY CHECK** (recipes not yet compared with their source, and recipes writing one ingredient on several lines);
  tidy SOURCES and KEYWORDS; **RECIPE PHOTOS** (RE-HOST EXTERNAL IMAGES, CHECK STORED IMAGES).
- **APP:** week start day (default Friday), APPEARANCE, STYLE, PREPARATION, OVENS (how many this kitchen has, per device), Google Calendar (§6.6),
  BACKUP TO GOOGLE DRIVE, RECIPE SHARING.
- **HELP:** the guide (`help.html`), the app's version and what changed lately.

---

## 6. Behaviours that cut across screens

1. **Scaling.** Done on the recipe text (`scaleRecipeSyntax`) from a target ÷ base multiplier; a quantity reader understands
   fractions, ranges and the unit forms; scaled liquids switch unit at 15 and 50 ml.
2. **Ingredient naming.** One dictionary in `core.js` (generated into `converter/ingredient-names.md`) gives every ingredient a name,
   spellings that count as it, an aisle and how a line is counted. The shopping key is the name alone, so **a change to how
   ingredients are named re-keys the household's ticks**.
3. **Source check.** A recipe's ingredients can be compared with its web page's; the result (counts, route, date) is stored on
   the recipe and shown as a chip.
4. **Images.** Photos live in Supabase Storage. Saving a recipe with a web photo asks `rehost-images` to copy it into our storage;
   a device photo is shrunk and uploaded at save. Source photos/PDFs go to a private bucket.
5. **Write safety.** One row per write; a failed write is kept and retried; a refresh never overwrites anything unsaved.
6. **Google Calendar.** Optional. A planned day becomes an all-day event listing its dishes in a "RecipeWrangler" calendar; **REMIND
   ME** adds a reminder at 20:00 the evening before (for the freezer); with more than one meal a day, a reminder per meal; two
   Settings toggles do both automatically (reminders for Main-course meals and freezer dishes); DISCONNECT leaves the calendar in
   place. The Google token is kept in Supabase Vault, outside the nightly backup.
7. **Drive backup.** Weekly and on demand, the same file as EXPORT DATA into the connecting account's Drive; the last 8 are kept.
8. **Sharing.** A household can let another browse its recipes, read-only; **ADD TO OUR RECIPES** makes an independent copy. Only
   recipes are visible, never plans, diary, notes, shopping or calendar. Each side switches it on for itself, by email.
9. **Versions.** The app has a date version; a new one is announced by an UPDATE bar (RELOAD). When the converter instructions change,
   each household sees a CONVERTER bar until someone taps DONE.
10. **Help.** `help.html` names every button exactly as it reads and is checked against the app by a test.
11. **Look and feel rules that stand.** Everything pressed with a thumb is at least 44 px tall; text meets 4.5:1 contrast on the surface
    it sits on; there is one type scale and one corner radius per style; step text is flush left; keyboard focus is always visible.
    Colours come from tokens, per theme, so light, dark, Classic and Modernist all work.
12. **Eaten is not cooked.** A meal from the freezer is logged in the diary on its day but does not change "last cooked", times cooked
    or the streak, and a PRE-MADE dish is not on the shopping list.
13. **One key, one home, per fact held about an ingredient.** Word matches, aisle overrides, swaps and the dictionary row each have one
    key and one place in Settings; only the naming facts re-key ticks.

---

## 7. Data

Each row of a household's data carries `household_id`; row-level security restricts everything by it.

| Table | Holds |
| --- | --- |
| `recipes` | The library: `syntax` (the recipe) plus derived columns, `source_check`, `source_photos`, `copied_from` |
| `recipe_logs` | The diary: one row per cooked or eaten meal, with meal type, `premade`, a note. Deleted with its recipe |
| `recipe_notes` | Dated cooking notes |
| `planner_days` | One row per day: recipe ids with parallel servings and premade, calendar flags, per-meal reminder slots |
| `meal_groups` | Dishes cooked together on a day |
| `shortlist_items` | Recipes and notes waiting for a day |
| `shopping_checked` | Ticked items by week and key |
| `aliases` | Word matches (and "keep apart" decisions) |
| `aisle_overrides` | The household's aisle for an ingredient |
| `ingredient_swaps` | Substitutions with a scaling ratio |
| `keywords` | The tag vocabulary |
| `household_settings` | Week start, appearance, calendar toggles and reminder time, converter version confirmed |
| `households`, `household_members` | Identity |
| `recipe_shares` | Who may browse whose recipes |
| `calendar_connections` | Per household: connected, account, calendar, last sync, last error, Drive folder and backup status |
| `private.calendar_oauth_states` | One-time values for Google's consent step; no API role can read it |

Storage: `recipe-images` (public-read by path, writes by household folder) and `recipe-sources` (private).
*(16 tables in `public` and 1 in `private` on 12 Oct; recheck `docs/INFRASTRUCTURE.md` before relying on the count.)*

---

## 8. Edge Functions

| Function | Job |
| --- | --- |
| `rehost-images` | Copies a web photo into our storage, after checking the address and that the file is a whole image; also the sweep behind the two Settings buttons |
| `source-ingredients` | Reads a recipe page's own ingredient list for COMPARE WITH SOURCE (read-only) |
| `calendar-auth` | Google consent, token storage in Vault, DISCONNECT |
| `calendar-sync` | Creates, updates and removes calendar events from the plan |
| `drive-backup` | Saves the export file to Drive weekly and on demand |

The household deploys these by hand from the dashboard; a session does not.

---

## 9. Rules the app keeps

- Recipe, plan and diary data never go in the public repo; credentials never go in either repo.
- Nothing is deleted or lost without a tap: the preview's checks advise, a save is never blocked, a removal can be undone where it can.
- An ordinary action writes one row. Whole-table replacement exists only for IMPORT DATA.
- A recipe is changed in place, never deleted and re-inserted (its history would cascade away).
- `main` is production: nothing merges without green tests, and the household decides when.
- A schema change is applied by the household first; the app must run without it until then.
- Text is British English and metric.

---

## 10. Not built (so nobody assumes it is)

- Offline-first editing or live multi-device sync (a refresh on return is the whole story).
- Self-service sign-up or household creation (done by hand with SQL; `docs/ONBOARDING.md`).
- A freezer stock count, or marking a planned meal "didn't happen" (left for later in the food-diary plan).
- A staging site: previews are parked (issue #100).

*Some of these are the household's choice rather than gaps. The Build Brief (`docs/BUILD-BRIEF.md`) records what was decided and why, and its
reference codes (S1, P3, R4, H1 …) are used in code comments.*

---

## 11. Keeping this document true

A change the household will notice updates, in the same pull request: `changelog.json` (what changed), `help.html` (how to use it,
with buttons named as they read), and **the matching section of this file** (what the app now does). A new screen, setting, table
or Edge Function is not finished until §5 to §8 say so. Take dates from `date -u` and say what you checked; leave out check counts.
