# Kitchen App — How it works

For someone who has never seen this project. Explains the shape of the app, the recipe
format it's built around, and the database behind it. Verified against the code on 14 Sep 2026.

---

## 1. What the app is

A personal recipe app for one household, used mainly from a tablet propped up in a kitchen.
It stores recipes, plans meals across a fortnight, builds a shopping list from that plan,
scales recipes to a number of people, and keeps a history of what was cooked when.

Its distinguishing idea is that **a recipe is stored as a flow, not a list of steps**. Every
recipe is written in a small text format describing which ingredients get combined, and when.
The app renders that as a left-to-right diagram: ingredients on the left, each column a moment
in time, boxes merging as things come together. You tick boxes off as you cook.

## 2. The recipe format

Recipes are stored as plain text in `recipes.syntax`. Everything else about a recipe —
its title, source, servings, tags — is *derived* from that text by parsing it, then stored in
columns alongside for querying. **The text is the source of truth.**

```
TITLE: Maple Almond Granola Clusters
SOURCE: Sally's Baking Addiction
SOURCE_URL: https://sallysbakingaddiction.com/maple-almond-granola-clusters-vegan/
IMAGE: https://.../granola-clusters.jpg
TIME: 1 hr 45
SERVINGS: 11
EQUIPMENT: 23x33cm baking pan
TAGS: course=Snack, Granola, Vegan

STEPS:
Preheat oven to 149°C. Line the pan with parchment.

GROUP dry:
255g whole rolled oats
95g sliced almonds

GROUP wet:
70g coconut oil
80ml maple syrup

GROUP vanilla:
1 tsp vanilla extract

STAGE:
MERGE wet -> syrup: heat, whisking until the sugar dissolves [3-4 min]

STAGE:
MERGE syrup, vanilla -> liquidmix: off the heat, whisk in the vanilla [instant]

STAGE:
MERGE dry, liquidmix -> mixture: pour over the dry and stir [instant]
```

The pieces:

- **`GROUP <handle>:`** — ingredients that go in together at the same moment. The handle is a
  short name used later.
- **`STAGE:`** — one column in the diagram, one moment in time. Independent things happening at
  once go in the *same* stage as separate MERGE lines.
- **`MERGE <handles> -> <new handle>: <label> [<duration>]`** — combines one or more handles into
  a new one. One input just relabels a box (pour, bake, cool), which is how every step after the
  final combine is written.
- **`STEPS:`** — one-off prep with no ingredient (preheat, line a tin).
- **`NOTES:` / `VARIATIONS:` / `STORING:` / `FREEZING:` / `TIPS:`** — optional trailing sections.

Two rules that matter more than they look:

**Group order is load-bearing.** A MERGE can only combine handles that sit on *adjacent rows*.
Groups occupy rows in declaration order, so groups destined to merge must be declared next to
each other. In the example above, `dry` is declared first precisely so that after `wet`+`vanilla`
become `liquidmix`, `dry` sits immediately above it. Get this wrong and `computeColumns` returns
an error rather than a diagram.

**A late addition gets its own group.** Anything added off the heat or at the end is its own
GROUP merging in at a later stage — never folded into an earlier group with the timing
explained in the label. The group *is* the claim "these go in together", so bundling makes the
diagram say something untrue. This was a real bug in the library (vanilla cooked along with the
syrup), and is why `converter/test-set.md` exists.

**Durations.** Every MERGE ends with a bracket: `[8 min]`, `[10-13 min]`, `[1 hr]`, `[instant]`
for a genuinely zero-length step, `[overnight]`. `until`/`till` phrases are read as open-ended.
Any *other* bracket (`[to taste]`) is deliberately left alone as label text — the parser
under-detects on purpose rather than mistake a seasoning note for a timing.

Recipes are written by pasting a source into a conversion prompt; see
`converter/conversion-instructions.md`.

## 3. The app's shape

One file, `index.html` — about 5,900 lines, no build step, no framework, no dependencies
beyond two CDN scripts (supabase-js and html2canvas). Screens are `<section class="view">`
elements toggled by `showView(name)`.

**The data pattern is deliberate and worth understanding before changing anything.** The whole
library loads into memory once at sign-in (`hydrate()`), and everything afterwards is instant.
Consequently:

- Every `load*` / `save*` function is **synchronous**. They read and write an in-memory `cache`
  object.
- Saving queues a background push via `queueWrite(label, fn)`, which **always returns `true`
  immediately**. Callers never await a write.
- Because writes are fire-and-forget, the way to prove something persisted is to **reload** —
  the page rebuilds entirely from Supabase.
- There is no live sync between devices. Two open tabs won't see each other's changes until
  reloaded. This is by design; offline use was explicitly not required.

**`hydrate()` is the fragile part.** Any exception thrown inside it signs the user out, so the
failure mode is a login screen you can't get past. This is why `household_settings` is read with
`.maybeSingle()` rather than `.single()` — a household with no settings row must come back as
`null`, not throw.

### The functions worth knowing

| Function | What it does |
| --- | --- |
| `parseRecipe(text)` | Turns recipe syntax into `{title, source, sourceUrl, servings, groups, stages, notes, ...}`. The single source of truth for the format. |
| `computeColumns(groups, stages)` | Lays the flow out into rows and columns, returning `errors[]` for unknown handles or non-adjacent merges. |
| `computeTimeline(groups, stages)` | Derives each step's start/end from stage order plus durations. Returns `null` if no step has a real duration — which is why the timeline strip auto-hides. |
| `mountFlow(container, parsed, opts)` | Renders the diagram and wires tick-to-complete. `opts.tickKey` makes ticks survive a re-render. |
| `scaleRecipeSyntax(text, multiplier)` | Rewrites quantities in the raw text. Callers compute `multiplier = target ÷ base`; nothing scales by a raw multiplier any more. |
| `buildShoppingList(weekDays)` | Aggregates the plan into a shopping list. **Must stay side-effect free** — it runs on every planner change via `updateSidebarCounts()`. |
| `queueWrite(label, fn)` | Background write queue. Returns `true` synchronously. |
| `hydrate()` | Loads everything into `cache` at sign-in. Throws = signed out. |

## 4. The database

Supabase Postgres. 13 tables, all with row-level security enabled and policies on every one.
RLS is driven by `private.household_ids_for_user()` — kept in a `private` schema, granted only
to `authenticated`, never to `anon`.

Every table carries `household_id` from day one, even though only one household exists. That
was a deliberate call in the brief: retrofitting it later, once data exists, is real rework.

### Tables in active use

| Table | Holds |
| --- | --- |
| `recipes` | The library. `syntax` is the real recipe; other columns are parsed from it. |
| `recipe_logs` | One row per time a recipe was cooked. **`ON DELETE CASCADE`** from `recipes` — deleting a recipe destroys its history. |
| `keywords` | The tag vocabulary, ordered by `sort_order`. |
| `planner_days` | One row per planned day. `recipe_ids uuid[]` plus a **parallel `servings smallint[]`** — index *n* in one matches index *n* in the other, `0` meaning "as the recipe is written". |
| `meal_groups` | Recipes cooked together on a day. `recipe_ids uuid[]`, no foreign key. |
| `shortlist_items` | Ideas not yet planned. `recipe_id` is `ON DELETE SET NULL`. |
| `ingredient_swaps` | Personal substitutions with a scaling ratio. |
| `shopping_checked` | Ticked items, keyed by `week_start` + `item_key`. **`item_key` is the aggregation string itself**, so anything that changes how items are named or combined re-keys them. |
| `aliases` | Word matches. `kind` is `source`, `ingredient`, `source_distinct` or `ingredient_distinct` — the `_distinct` kinds record "these are *not* the same" so the app stops asking. |
| `household_settings` | One row. `week_start_day` (0=Sunday, default 5=Friday). |
| `households`, `household_members` | Identity. Not queried directly by the app; the household id is a constant in `index.html`. |

### Schema that exists but nothing uses yet

Created in Phase 1 in anticipation of Phase 3 features. **Not dead schema — just early.** Worth
knowing so nobody assumes the feature exists because the column does (which is exactly the
mistake that made the image work look finished):

| Column / table | Waiting on |
| --- | --- |
| `recipe_notes` (whole table, empty) | R4, dated cooking notes |
| `recipe_logs.meal_type` | H1, meal type at point of logging |
| `recipe_logs.note` | R4 / food diary |
| ~~`household_settings.dark_mode`~~ | S2 shipped 22 Sep — no longer scaffolding |
| `meal_groups.name` | Written as `''`; no UI ever names a group |
| `households.name`, `household_members.role` | Multi-household support, deliberately anticipated |

Storage has one bucket, `recipe-images` — **public, 29 objects, 4.1 MB** as of 21 Sep. Public
affects only the `/object/public/` read endpoint; writes, deletes and listing still go through
four RLS policies keyed on household membership, so it is readable-if-you-know-the-path rather
than browsable.

`index.html` still references Supabase Storage nowhere, and deliberately — images are re-hosted
by a decoupled Edge Function sweep (`supabase/functions/rehost-images/`), and the app just
renders whatever URL is in `image_url`. That is the whole point of decoupling it: the app never
has to know where a photo lives. See `docs/HANDOVER.md` §2.

## 5. Testing

`test/` holds an offline harness that boots the real `index.html` against a fake Supabase
(`test/stub.js`) and walks every screen.

```sh
npm install playwright
node test/build.js    # bake index.html against the stub
node test/smoke.js    # 116 checks; exits non-zero on failure
```

It has caught real bugs, including a parser gap that would have broken every reprocessed recipe.
**But it stubs the backend entirely** — sign-in, hydration, RLS and the write queue are never
exercised, so a green run says nothing about whether the app can actually talk to Supabase.
Keep Awake can only be tested on a real tablet.

## 6. Repo layout

| Path | What it is |
| --- | --- |
| `index.html` | **The app.** Everything lives here. |
| `supabase/functions/` | Edge Functions. `rehost-images` is the image re-hosting sweep (R7); `find-recipe-image` reports a page's candidate hero images and their real sizes, read-only. Both need a signed-in caller. See `docs/IMAGES.md`. |
| `index-old.html` | The pre-Supabase version, kept for reference. **Not used, not served, not maintained** — don't edit it thinking it's live. |
| `converter/` | Conversion instructions and the standing test set for writing recipes. |
| `test/` | Offline test harness. |
| `docs/` | Everything in §7 of `docs/DOCUMENT-INDEX.md`. |
| `.mcp.json` | Wires the Supabase connector for Claude Code automatically. |
