# Recipe Conversion — Project Instructions

*Revised 23 Sep 2026 — see the notes at the end for what changed and why.*

Whenever a recipe is given here — a photo, a URL, or pasted text — convert it into
GROUP / STAGE / MERGE syntax for the recipe merge-flow tool. Work through these
stages in order every time; don't skip Check even for a simple recipe.

## 1. Extract

- If the source is a photo: read it as given first. If it's rotated, read it as if
  rotated upright — if code execution is available, physically rotate the file and
  look at the corrected version before extracting anything. If, even after that, a
  specific number (a gram amount, a time, a temperature) is genuinely too small,
  blurry, or cropped to read with confidence, do NOT guess — flag that field as
  "unconfirmed" or ask for a clearer/straightened photo of just that section before
  finalizing quantities. A correct structure with a wrong quantity is a real failure
  mode, not a minor one.
- Pull out, precisely: title; every ingredient with its exact quantity and unit; any
  one-off prep steps that aren't ingredients (oven temp, tin size/prep); the full
  method in order, including timings, doneness cues, and technique cautions;
  yield/storage/serving notes if given; and the number of servings.
- **Note when each ingredient actually joins the dish**, not just what the ingredient
  is. An ingredient the method adds later — off the heat, at the end, just before
  serving, stirred in after cooking — is a separate moment in time, and needs to stay
  separate through Structure. See the grouping rule in step 2.
- Watch for split ingredients — one egg used two ways, an onion used half-and-half,
  one stock cube divided across two stages — these need to become two ingredient
  lines, one in each relevant group.
- Paraphrase the method in your own words rather than quoting the source.
- Do not attempt to detect or crop a "hero image" from a photographed recipe card.
  Cropping a region from a photo is low-confidence, and the resulting image data is
  impractical to hand over through a pasted text block anyway. If the person wants a
  photo attached to a card-sourced recipe, that happens in the app itself (a manual
  "attach a photo" option), not in this conversion step.
- Determine the source. If the recipe came from a URL, the site name is the source
  (e.g. "BBC Good Food," "Sally's Baking Addiction"). If it's a photographed card or
  printed page, look for a visible site/brand name, author byline, or watermark on the
  page itself — many cards print this in a header or footer (e.g. "Greek Potato Hash —
  Nicky's Kitchen Sanctuary," a HelloFresh logo). If nothing on the input confidently
  identifies a source, ask the person directly rather than guessing or leaving it
  silently blank — e.g. "I can't tell where this one's from — what should I record as
  the source?" If they say it's their own or a family recipe, record that answer as the
  source (e.g. "Personal recipe") rather than omitting the field.
- **Convert every quantity to metric at this stage.** If the source uses cups, oz, lb, °F,
  or anything else, convert it now; don't leave the source's original unit in the output.
  Use standard cooking conversions (e.g. 1 cup plain flour ≈ 120g, 1 cup granulated sugar ≈
  200g, 350°F = 180°C). Where a cup-to-gram conversion genuinely depends on how the
  ingredient settles (flour scooped vs. spooned, packed vs. loose brown sugar), use the
  commonly accepted approximate figure rather than refusing to convert. This app has no use
  for imperial units downstream, so an approximate metric figure is more useful than an
  exact imperial one.
- **Write every ingredient line in one shape: `<quantity> <unit> <name>, <preparation> (<note>)`.**
  The shopping list reads these lines mechanically and totals two lines only when their
  names agree, so the shape matters more than the wording. Examples:
  ```
  4 tbsp olive oil
  1 onion, finely chopped
  3 garlic cloves, crushed
  400 g chopped tomatoes (1 tin)
  375 g tinned tuna (3 × 125 g tins), drained
  100 ml golden syrup (or honey)
  1/2 orange, zest only
  1 pinch nutmeg
  black pepper, to taste
  3 eggs (large)
  ```
  - **One ingredient per line.** "Salt and pepper to taste" is two lines: `salt, to taste`
    and `black pepper, to taste`. A free choice ("any nuts or dried fruit") is one line with
    a single name and the choices in brackets.
  - **Quantity first**: a whole number, a decimal with a point (`1.5`), a fraction (`1/2`),
    or a mixed number with a space (`1 1/2`). A range uses a hyphen (`2-3 tbsp`) and stays
    in the line as the source gives it: don't pick one end or move the range to NOTES. Never
    `½`, never "a" or "an", never a multiplier like `3 x 125 g`: write the total and put the
    pack in the note, as in `375 g tinned tuna (3 × 125 g tins)`. Leave the quantity out
    only for a line that ends `, to taste` or `, to serve`.
  - **Unit**: `g`, `kg`, `ml`, `L`, `tsp`, `tbsp`, or one count word: `pinch`, `bunch`,
    `handful`, `sprig`, `slice`, `rasher`, `piece`, `tin`. Countable things need no unit
    (`2 onions`, `3 eggs`). Garlic and celery keep their natural form: `3 garlic cloves`,
    `2 celery sticks`. Nothing else goes between the number and the name, so no "large",
    "heaped" or "thumb-sized": write `1 onion (large), diced`, not "1 large onion, diced".
  - **Weigh solids, measure liquids.** Above 1 tbsp, butter, sugar, flour, cocoa and nut
    butters go in grams, not spoons: spoons of a solid can't be added to grams of the same
    thing on the shopping list. **Tins and packs:** use the unit printed on them, with the
    container in the note: `400 g chopped tomatoes (1 tin)`, `400 ml coconut milk (1 tin)`.
    The container word never goes in the name ("400 g tin chopped tomatoes").
  - **Name**: what you buy, **as a UK supermarket labels it on the shelf**, in plain British
    English: *aubergine*, not eggplant; *beef mince*, not ground beef. Where
    `ingredient-names.md` lists the ingredient, use its spelling exactly: that list records
    the household's own choices and settles ambiguous words. Rename, never replace: the
    product stays the one the source asks for ("Italian seasoning" stays Italian seasoning,
    not dried oregano). Keep the words that change
    what you buy: ground, dried, frozen, cooked, raw, smoked, double/single,
    plain/self-raising, baby, spring, red/green/yellow, light/dark, unsalted, whole, bone-in.
    Leave out the ones that don't: large, small, medium, ripe, fresh, free-range, pure,
    extra. If a size matters, it goes in the note: `3 eggs (large)`.
    **Before presenting, look up every name in the "Also written as" column of
    `ingredient-names.md`.** If it appears there, replace it with the name in the "Write"
    column: "plain yogurt" becomes `natural yoghurt`, "neutral oil" becomes `vegetable oil`.
  - **Preparation after the first comma**, never before the name: `cheddar, grated`, not
    "grated cheddar". The exception is when the prepared form is what you buy: *chopped
    tomatoes, ground cumin, minced beef, flaked almonds*.
  - **Part of an ingredient** is preparation, not a quantity: `1/2 orange, zest only`,
    `1 lemon, juiced`, `1/2 bunch coriander, leaves only`, never "zest of 1/2 orange".
    Written that way, the number comes first and scales.
  - **Alternatives and notes in brackets**, with the first choice as the name:
    `100 ml golden syrup (or honey)`, `600 ml chicken stock (or vegetable stock)`. The
    first name is the one on the shopping list. Keep the alternative on the line itself:
    VARIATIONS is for changes to the whole dish, not a swap for one ingredient.
  - **The amount you buy, not the amount after cooking**:
    `200 g long-grain rice, cooked and cooled`, not "600 g cooked rice". The shopping list
    adds up what you buy.
- **Pick one base unit per ingredient and stay with it.** Don't write one quantity of
  an ingredient in grams and another in kilograms within the same recipe. Prefer the
  smaller unit (`g`, `ml`) unless the quantity is naturally large enough to read oddly
  that way — a 1.5kg joint stays `1.5kg`, not `1500g`. The shopping list combines
  quantities across recipes and picks its own display unit, so it needs a consistent
  base to work from.
- **Phrase quantities so they still read correctly when scaled.** Write "1/2 lemon",
  not "1/2 a lemon"; "1/4 onion", not "1/4 of an onion". The app scales these
  arithmetically and doesn't correct grammar, so "1/2 a lemon" doubled becomes
  "1 a lemon". Keep the article out of the quantity.

## 2. Structure

```
TITLE: <name>
SOURCE: <site, publication, or person — always present, never omitted>
SOURCE_URL: <the exact page the recipe came from — omit for a photographed card or a verbal recipe>
IMAGE: <hero image URL, only if the source is a webpage with one — omit entirely otherwise>
TIME: <total time, e.g. "35 min" or "1 hr 40" — from stated prep+cook times>
SERVINGS: <plain number — always present; ask if the source doesn't say>
EQUIPMENT: <size-specific tin/tray/dish only, e.g. "20cm springform tin" — omit if only everyday kitchen equipment is needed>
TAGS: course=<Breakfast/Main/Side/Dessert/Bread/Baking/Snack>, <any obvious meal-base keyword(s)>
STEPS:
<one-off prep with no ingredient — preheat oven, line tin>
GROUP <handle>:
<ingredient line>
<ingredient line>
STAGE:
MERGE <handle(s)> -> <new handle>: <action label> [<duration>]
NOTES:
<tips that aren't a sequential step and don't fit a more specific subsection below —
 storage, technique options>
VARIATIONS:
<swaps or alternative versions the source mentions — different protein, spice level,
 dietary substitution, etc.>
STORING:
<how long it keeps, where, any reheating notes — only if the source says>
FREEZING:
<whether it freezes, how, for how long — only if the source says>
TIPS:
<technique advice that isn't a sequential step but doesn't fit the other headings — a
 doneness tell, a common mistake to avoid, an ingredient note>
```

- `SOURCE`, unlike `IMAGE` and `TIME`, is never just omitted — it's either determined
  from the input or asked for directly, per the Extract step above. A consistent field
  here is what lets the app filter "all BBC Good Food recipes" reliably, which a
  sometimes-missing field can't do cleanly.
- `SOURCE_URL` is the actual link, kept separately from `SOURCE` (the site *name*), so
  the original page can be reopened later. Record it whenever the recipe came from a
  webpage; omit the line entirely for a photographed card, a printed page, or a recipe
  given verbally. Don't reconstruct or guess a plausible URL — only record one you were
  actually given.
- `IMAGE` only applies when the source is a URL with a clear hero image (an `og:image`
  meta tag or a `schema.org/Recipe` image field — most recipe sites have one). It's
  either clearly present or it isn't; if there's any doubt, omit it rather than guess.
  Never attempt this for a photographed card — see the note above.
- `TIME` is the total time (prep + cook) as stated or clearly inferable from the
  source. Omit rather than guess if the source doesn't give one.
- `SERVINGS` is a plain number (e.g. `4`, not "4 servings" or "serves 4-6" — if the
  source gives a range, use the lower figure). **It's now required on every recipe**,
  because the app scales recipes by target number of people and can't do that without a
  starting figure. If the source doesn't state or clearly imply a yield, ask the person
  directly — e.g. "This one doesn't give a yield — how many does it serve as you make
  it?" — and use their answer. Still don't invent one from the ingredient quantities.
- `EQUIPMENT` captures size-specific kit the recipe depends on: a 20cm springform tin,
  a 23x33cm traybake tin, a 900g loaf tin, a specific dish size. It's about the sizes
  that change the outcome, not a full equipment list — omit the line entirely if the
  recipe just needs an everyday pan, bowl and oven.
- `TAGS` is a starting suggestion, not a final answer. There is no single-value
  "protein" or "meal base" field any more — course/protein/meal-base-style facts about a
  dish (Chicken, Veg, Pasta, Rice, Orzo, Risotto, and so on) are all just keywords now,
  comma-separated after `course=`, and a recipe can genuinely carry more than one at
  once (a chicken-and-chorizo pasta bake is both Chicken and Pasta — include both). Only
  include course and any meal-base keyword where the recipe makes it genuinely obvious;
  don't force a guess for things like occasion or personal-judgment keywords (Weeknight,
  Guests, Christmas, etc.), which the person applies themselves after import.
- **Flag a likely batch-cook recipe automatically.** If the recipe is clearly intended
  for batch cooking — a notably large yield relative to a normal meal, an explicit
  mention of freezing or portioning for later, or similar signals — add `Batch` as one
  of the TAGS keywords without being asked. This is a suggestion the person can remove
  after import, same as any other tag, not a guarantee.
- GROUP ingredients that get combined **at the same point in the method**. Order groups
  so anything merged together later ends up in adjacent rows — MERGE can only combine
  handles that currently sit next to each other.
- **A later addition gets its own group.** If an ingredient joins at a distinctly
  different moment from the others it's listed beside — off the heat, at the end, just
  before serving, stirred in after something has cooked — give it its own GROUP that
  merges in at the stage where it's actually added. Do not fold it into an earlier group
  just because the source mentions it in the same sentence as the other ingredients, and
  do not rely on the MERGE label's wording to carry the correction. The diagram is the
  output that matters: a group is a statement that "these go in together," so bundling a
  late addition into an earlier group makes the diagram say something untrue, even if
  the label text happens to describe the right order.

  Right:
  ```
  GROUP wet:
  70g coconut oil
  67g brown sugar
  80ml maple syrup

  GROUP vanilla:
  1 tsp vanilla extract

  STAGE:
  MERGE wet -> syrup: heat, whisking until the sugar dissolves [4 min]

  STAGE:
  MERGE syrup, vanilla -> liquidmix: off the heat, whisk in the vanilla [instant]
  ```
  Wrong — the vanilla is heated along with everything else as far as the diagram is
  concerned, and the correction survives only as prose inside the label:
  ```
  GROUP wet:
  70g coconut oil
  67g brown sugar
  80ml maple syrup
  1 tsp vanilla extract

  STAGE:
  MERGE wet -> liquidmix: heat until the sugar dissolves, remove from heat and whisk in the vanilla [4 min]
  ```
  This matters most for anything heat-sensitive (vanilla and other extracts, fresh
  herbs, citrus juice and zest, delicate dairy), where the late addition is the whole
  point of the technique — but it applies to any separately-timed addition.
- STAGE = one column = one moment in time. Independent actions happening in parallel
  (e.g. two components prepped separately) belong in the same stage as separate MERGE
  lines.
- MERGE with one input just relabels a box — use this for every step after the final
  combine (pour, bake, cool, cut, serve), not just the mixing steps.
- **Every MERGE line ends with a bracketed duration.** Write the time the step takes in
  square brackets at the end of the label: `[8 min]`, `[10-13 min]` for a range,
  `[1 hr]`, `[1 hr 30]` for hours and minutes, `[30 sec]`, or `[overnight]`.
  A range may use a hyphen or an en dash (`[4–5 min]`). `[until done]` and
  `[till reduced]` are read as open-ended. For a step that takes no meaningful time — plating,
  a final stir, sprinkling a garnish — write `[instant]`. Never leave the bracket off:
  the app builds a shared timeline across recipes being cooked together, and one
  missing duration makes that timeline wrong rather than merely incomplete.
- Keep labels short enough to read at a glance mid-recipe, but never drop temperatures,
  times, doneness cues, or cautions to save space.
- Anything that's a tip rather than a sequential action goes in NOTES or one of its
  subsections, not a stage. All five (NOTES, VARIATIONS, STORING, FREEZING, TIPS) are
  optional — omit any that don't apply rather than forcing content into a heading it
  doesn't fit. NOTES itself is the catch-all: use it for anything that's clearly a tip
  but doesn't cleanly belong under one of the other four. Don't split one thought across
  two headings, and don't invent content for a heading the source never mentioned — if
  the source doesn't say whether it freezes, leave FREEZING out entirely rather than
  guessing.

## 3. Check

Before presenting, compare the structured version against what was extracted, line by
line:

- Every ingredient present once, with the right quantity, in a standardised unit
  (`g`/`kg`/`ml`/`L`/`tbsp`/`tsp`, a count word such as `pinch` or `bunch`, `°C` — no cups, oz, lb, or °F left over from
  the source), using one consistent base unit per ingredient.
- Every quantity phrased so it survives scaling — "1/2 lemon", not "1/2 a lemon".
- **Every ingredient line in the standard shape**: one ingredient each, quantity and unit
  first, no size word before the name, ranges kept as ranges, preparation after the first
  comma, and alternatives in brackets on the line.
- **Every name checked against `ingredient-names.md`**: none of the "Also written as"
  phrases survives.
- Every method step represented somewhere — STEPS, a STAGE, or NOTES.
- **Every ingredient joins at the point the method actually adds it** — anything added
  off the heat, at the end, or after a cooking step sits in its own group merging in at
  that stage, not bundled into an earlier one.
- **Every MERGE line ends with a bracketed duration**, `[instant]` included where the
  step genuinely takes no time.
- Every temperature, time, and doneness cue retained.
- Every caution (don't overmix, don't boil, etc.) retained.
- Source is present — either confidently determined from the input or explicitly
  confirmed with the person, never guessed and never silently blank.
- `SOURCE_URL` present if the recipe came from a webpage, absent otherwise.
- Servings present — taken from the source, or asked for and supplied by the person.
  Never estimated from the ingredient quantities.
- `EQUIPMENT` present if the recipe depends on a specific tin/tray/dish size.
- Any VARIATIONS/STORING/FREEZING/TIPS content is placed under the right heading, and
  nothing's been invented to fill a heading the source didn't actually address.
- Anything genuinely uncertain (from image quality, an ambiguous source, or an uncertain
  unit conversion) flagged rather than quietly guessed.

Report gaps as a short list (found → fixed), not a long essay.

## 4. Present

- Give the finished syntax in a single code block, ready to paste straight into the
  recipe app.
- Add a 3–5 sentence plain-language walkthrough of the flow — what merges with what,
  and when.

---

## Revision note (23 Sep 2026)

Changed from the previous version, following `docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md`:

- **A standard shape for every ingredient line**, and a **shared vocabulary**
  (`ingredient-names.md`) to take names from. Measured on the library, the converter copied
  each source's wording, so the shopping list could not total the same ingredient written
  different ways: 274 rows for 168 things to buy. 24 lines could only ever be fixed here,
  among them "X or Y" alternatives, lines holding two ingredients, a tin in ml and a
  cooked weight for something bought uncooked.
- **Count words** (`pinch`, `bunch`, `clove`…) are now allowed as units, and the old units
  bullet keeps only the metric conversion guidance.
- **Weigh solids above 1 tbsp; tins in grams; the amount you buy, not the cooked amount.**
- Tests 6 and 7 in `test-set.md` check the new rules.

## Revision note (13 Sep 2026)

Changed from the previous version:

- **`SOURCE_URL` added.** The app now has a field for the original link, separate from
  the site name — the gap the previous revision left open.
- **`EQUIPMENT` added.** The app has had this field all along but nothing was producing
  it, so it was always empty.
- **Servings is now mandatory**, with a fallback: ask the person rather than omitting
  it. The app scales recipes by target number of people, which needs a starting figure
  on every recipe.
- **Bracketed durations on every MERGE**, `[instant]` included. The group-cooking
  timeline treats a missing duration as a gap in the schedule, so "usually present" was
  not good enough.
- **A late addition now gets its own group**, with a worked right/wrong example. This
  is the rule that was missing when the Maple Almond Granola Clusters conversion put
  vanilla extract into the heated `wet` group — the method adds it off the heat, on
  purpose, because the aromatics cook off otherwise. The correction survived only as
  prose in the step label, so the diagram said all four ingredients went in together.
  The general class of error: late additions and split ingredients getting collapsed
  into an earlier group because they appear in the same sentence of the source method.
- **Consistent base unit per ingredient**, feeding the shopping list's own g/kg and
  ml/L handling cleanly.
- **Quantity phrasing rule** — "1/2 lemon", not "1/2 a lemon" — so arithmetic scaling
  doesn't produce awkward grammar. The app deliberately doesn't attempt grammar
  correction.
- **A standing test set** now lives alongside this file (`converter/test-set.md`). Run
  it whenever these instructions change.

### Revision note (14 Aug 2026)

- Servings extraction added.
- Unit standardisation added, at extraction time.
- `protein=` removed from the TAGS line — meal-base facts are ordinary keywords now,
  and a recipe can carry more than one.
- Automatic `Batch` flagging added.
- Structured NOTES added: VARIATIONS/STORING/FREEZING/TIPS as their own optional
  headings alongside plain NOTES.
