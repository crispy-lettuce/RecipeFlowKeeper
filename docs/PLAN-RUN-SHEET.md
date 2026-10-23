# The run sheet: hands-off steps and a live timeline

**Drafted 23 Oct 2026** (`date -u`) as a plan only: nothing is built and no recipe has changed. The household asked for it on
22–23 Oct, after a review of the recipe viewer's timeline and flow cards, and liked a clickable mock of it
(https://claude.ai/artifact/1rSZJKpekZRi5y4s5ZBXjm, private to the owner's account; a session on that account reads it with the
Artifact tool's `read`). **Every example line here is made up**, and each was checked against the library on 23 Oct (an
exact-match count of 0).

The idea in one paragraph: a recipe step can say it looks after itself, `[25 min, hands off]`. With that, the timeline stops
being a picture and becomes a run sheet. You say when you want to eat; it says when to start, in clock times; a row shows when
your hands are busy, where two dishes need them at once and where you are free; and once you press START COOKING a playhead
moves, your ticks drive the bars, and a late step slides everything after it and says the new ready time.

## 1. What exists today (read 23 Oct 2026)

- **Durations.** Every MERGE ends with a bracket: `[8 min]`, `[10-13 min]`, `[1 hr 30]`, `[30 sec]`, `[instant]`,
  `[overnight]`, `[until …]` (`docs/ARCHITECTURE.md` §2). `extractStepDuration` (`core.js:119`) reads only a bracket that is
  wholly one of these; **any other bracket is left in the label as text**, on purpose (`core.js:195`). So a bracket this plan
  adds is shown as raw text, and its step loses its duration, on any copy of the app that predates it. That decides the order
  in §5.
- **The converter already thinks in hands-on time,** but only for the `TIME` line: "Add a hands-on allowance (chopping,
  measuring, preheating)" (`converter/conversion-instructions.md:152`). Untimed quick actions are `[instant]` (`:141`).
- **The timeline.** `computeTimeline` (`core.js:815`) walks stages, starts each step when the last thing it consumes is done,
  and gives an untimed or open-ended step a 2-minute stand-in (`DEFAULT_STEP_MINUTES`, `:814`). A range counts at its midpoint.
  Its steps carry `label`, `duration`, `start`, `end`, `output`, but **not their inputs**. `lineUpTimelines` (`core.js:850`)
  does START TOGETHER and FINISH TOGETHER for a group by shifting each dish whole; `about` says the longest dish has an
  untimed or open-ended step.
- **Drawing.** `buildTimelineHTML` (`index.html:2698`, one plum for every lane), `wireTimelineInteractions` (`:2741`, tap a
  bar to jump to its box), `computeGroupTimeline` / `groupLineUpMode` / `buildGroupTimelineHTML` (`:2775`–`:2791`),
  `durationBadge` (`:2682`), `buildFlowHTML` (`:2870`), `mountFlow` (`:3035`: ticks, the tick ripple upstream, and the last
  column logging the recipe as cooked). Viewers: `renderGroupViewer` (`:6197`), `renderViewer` (`:6428`).
- **Cooking mode** keeps the screen awake (`wakeLockSentinel`, `index.html:6778`) and hides the strip unless SHOW TIMELINE is on
  (`kitchen.cookingTimeline`, per device, `:6794`).
- **Ticks last until reload** (`docs/SPEC.md` §5.2) and survive a redraw through `tickKey`. Coming back to the tab re-runs the
  load (`CLAUDE.md`, "Things that will bite"), so anything new held for a cook must survive the same redraw.
- **Print and PNG** hide interactive parts through `hideSelectors` (`index.html:6351`, `:6961`).
- **No meal times are stored.** Calendar reminders are per meal, at 20:00 the evening before (`docs/SPEC.md` §6.6); nothing
  says when a meal is eaten. A serve time has to come from the cook.

**Problems found in the 22 Oct review** (screenshots of the stub, not the live app), all in the timeline code:
the last ruler tick is cut off ("+20 mi"); short and instant steps shrink to a 1.5% sliver with a clipped label, too small to tap;
a Group Viewer lane names its dish only in a `title` tooltip a tablet cannot show; at phone width the strip's header squeezes its
label into a column; Classic has no cue that the flow table scrolls sideways (Modernist draws one).

## 2. Measured on the live library (23 Oct 2026)

Read-only counts by SQL over `public.recipes.syntax`; three households; no text copied out. The word lists are rough, made to
size the job, not to decide it.

| | Count |
| --- | --- |
| Recipes (all have MERGE lines) | 116 |
| MERGE lines | 910 |
| …timed with a number | 445 |
| …`[instant]` | 409 |
| …`[until …]` | 47 |
| …`[overnight]` | 1 |
| …no bracket at all | 8 |
| …a bracket containing a comma | 0 |
| Likely hands off: a waiting word (simmer, bake, roast, rest, prove, chill, marinate, soak, cool, leave…), no doing word, 10 min or more or open-ended | 75, in 53 recipes |
| Mixed wording: a waiting word and a doing word (stir, whisk, fry, brown, toss, turn…) | 122 |
| A waiting word under 10 min | 52 |

So about 250 steps want a look, and well under half of the library changes at all. **No bracket contains a comma today,** so
`, hands off` cannot collide with anything already written. The 8 MERGE lines with no bracket break the converter's own rule;
they are outside this plan, and worth a look in the data job (§6) since it reads every recipe anyway.

**Ovens, in the family's 76 recipes** (read 23 Oct): 34 have a "Preheat the oven…" line, 33 of them with a °C figure and 18
saying fan; one gives two temperatures. 39 have a MERGE step that says oven, roast or bake (63 timed steps). A recipe's oven
temperature is free text on its preheat line, not on a step.

## 3. The marker

**Write it inside the duration bracket, after a comma, and only on steps that look after themselves.** Hands on stays the
default, so a recipe that never mentions it reads exactly as it does now.

```
MERGE base, lentils -> ragu: simmer, covered, stirring now and then [25 min, hands off]
MERGE dough -> rested: cover and leave somewhere warm [40-50 min, hands off]
MERGE mix -> set: chill [until firm, hands off]
MERGE batter -> rested: cover and leave in the fridge [overnight]         (overnight is always hands off)
```

Rules for `extractStepDuration`:

1. A trailing `, hands off` (any case; `hands-off` too) is split off first; what is left is read exactly as today.
2. It is accepted after a number, a range, `until …` and `overnight`. **Not after `instant`**: `[instant, hands off]` is left
   unrecognised, so the existing "bracket present but NOT read as a duration" warning in `test/validate-recipes.js` (`:214`)
   reports it, and the preview shows the raw bracket, as for any other mistake.
3. `[overnight]` sets hands off by itself.
4. `[hands off]` alone is not a duration and stays unrecognised: every MERGE still needs a time.
5. The result is `duration.handsOff: true`; nothing else in the duration changes, so scaling, the timeline's arithmetic and
   `formatDuration` are untouched.

**Considered and not chosen:** a separate header line listing hands-off handles (`HANDS OFF: ragu, rested`). It may well be
ignored by older copies of the app (not checked), but it puts the fact away from the step it describes, it would have to be
kept in step by hand when a handle is renamed, and a converter writes it less reliably than one more word in a bracket it
already writes. Marking hands *on* instead: about 400 of the 445 timed steps would change rather than about 100.

## 4. The run sheet (what the app will do)

All of it is drawing and arithmetic. **Nothing is written to the database** by any of it except what already is: the tick that
finishes the last column still logs the recipe as cooked.

- **Hands on and hands off.** A hands-on bar is solid; a hands-off bar is hatched in the dish's colour. A box's duration reads
  `25 min · hands off`.
- **EAT AT.** A time the cook sets in the strip's header (by default now plus the longest dish, §10). With it, the ruler reads clock times
  (`17:50`, `18:00`) and every box says when it starts; without it, the strip is as today.
- **Your hands row**, above the lanes: solid where you are busy, hatched red where two hands-on steps overlap (a clash), an
  outline saying `free 16 min` where you are not needed for six minutes or more.
- **Ovens**, a thin lane per oven under the hands row: which dish is in which oven at what temperature, and a warning when a
  meal wants more ovens, or more temperatures at once, than the kitchen has (two here).
- **AVOID THE CLASH** (shown only when there is one): moves the later hands-on step, and what feeds it, earlier until nothing
  overlaps. The dish it moves is then ready a few minutes before serving.
- **START COOKING** starts a playhead at the real time. From then:
  - a box ticked is done at that moment. **A box ticked without START** is drawn from its planned start to the tick, so a
    step that ran late shows as longer than planned; one ticked before its planned start (done early) is drawn as its own
    length counted back from the tick. Steps ticked along with a later one keep their planned times, cut short at the tick if
    the plan had them ending later. Decided 23 Oct, from three ways compared in a second mock
    (https://claude.ai/artifact/SKWGwVWSBd2Ae7PAkf4nw1); the others counted every step back from the tick (which invents a
    start time) or drew only a tick mark (which leaves the hands row blank for time the cook was busy). None of this changes
    the plan ahead, which runs from when each step ended;
  - in cooking mode each box has START (or START TIMER on a hands-off step) and, once started, DONE, which is the same tick;
  - every step not yet done is re-planned: no earlier than planned, no earlier than now, after what feeds it, and never on top
    of another hands-on step. A faint mark shows where the plan had it;
  - the header says **On time for 18:30**, or **Ready at 18:43, 13 min after 18:30**; a Now line says what is running, how
    long it has left, and the next thing for your hands ("Hands free for 9 min, then: Roll the dough at 18:18").
- **Timers.** A started timed step counts down on its bar and box, and at zero chimes, vibrates where the device can, and pulses
  DONE. Counted from timestamps, never by adding up intervals, so a throttled tab is still right.
- **The review's fixes** (§1) come first, in PR 1.

## 5. The order, and why

```
STEP 0  can steps be marked reliably?                          done 23 Oct: yes (below)
PR 1    timeline fixes + ticks drive the bars                  no format change; can ship now
PR 2    the marker: parser, converter, display                 core.js and converter versions move
        ── household merges PR 2, reloads every device, taps DONE on the converter bar ──
DATA    hands-off pass over the library                        CLAUDE.md's recipe-text procedure, household present
PR 3a   EAT AT, clock ruler, hands row, AVOID THE CLASH, ovens   (split from PR 3 on 23 Oct)
PR 3b   START COOKING, ticks and starts driving the times, re-planning, the Now line
PR 4    timers
```

PR 2 must be **merged and every device reloaded before the data job writes a single bracket**: a copy of the app from before
PR 2 shows `[25 min, hands off]` as text and loses that step's time (§1). The app asks for a reload when `core.js`'s version
changes, but a tab left open is the risk; `docs/HOUSEHOLD-JOBS.md` carries the reload step. **PR 2 is never reverted after the
data job** for the same reason. PR 3 can be built before the data job finishes, and would treat every step as hands on until
recipes carry the marker; it is most useful after.

### Step 0: the proof of concept (done 23 Oct 2026)

The parser and the drawing are the easy part. The risk is the marking: if the household, the word rules and the converter do not
agree on which steps are hands off, the hands row and its free windows mislead, and the rest is not worth building. So, before
PR 2, with no change to the app and nothing written to the database:

1. **A blind sheet.** 54 timed steps from 11 of the family's recipes, chosen for coverage, not popularity: a long simmer with
   "stirring occasionally", an oven dish with a hob gravy alongside, a slow cooker, a curry with few timings, short waiting
   steps, a pudding that bakes, the library's one `[overnight]` step, a stir fry as a control, and a three-recipe roast dinner.
   The household marks which steps are hands off without seeing any proposal.
2. **Two proposals for the same steps,** kept off the sheet: §2's word lists, and a session following a draft converter rule.
   Before any marks, they already disagree on 24 of the 54 (the word lists cannot decide 20).
3. **The real converter.** The draft rule pasted into the conversion project for the test only, and three of the recipes
   re-converted from their source pages; only the `hands off` marks are compared.
4. **The roast** also asks whether, for a meal like that, the oven rather than the cook's hands is the real limit. If it is,
   PR 3 needs an oven lane, or must say it does not model one.

Everything with recipe lines in it, the sheet, the steps with both proposals and the draft rule, is in `PrivateBackup` at
`migrations/2026-10-23-hands-off-poc/`. The results come back here as counts. **About 90% agreement or better on the clear cases**
means the data job (§6) can approve those as a batch; much lower means every step is reviewed by hand, or the library is left
alone and only new recipes carry the marker. The converter rule in PR 2 is the draft as the test leaves it.

**Marked by the household on 23 Oct 2026, revised and confirmed the same day.**

| | Agrees with the household |
| --- | --- |
| A session following the first draft rule | 53 of 54 (98%) |
| The refined rule below, read the same way | 54 of 54 |
| The word lists, where they decided | 29 of 34 (85%); they could not decide 20 of the 54 |

- **Above the 90% line.** The household's first marks differed from the session's on nine steps; asked, it revised eight of them
  as slips. The ninth (onions cooked, stirring occasionally, for 15-20 min) it kept as hands off, and asked whether occasional
  stirring over a longer step should count as hands off. Its marks say yes, and the rule now says so.
- **The rule, refined from the marks** (the converter's draft in `PrivateBackup` carries it):
  1. Waiting for **5 minutes or more** is hands off: simmering, baking, roasting, soaking, resting, chilling, a slow cooker,
     something heating in the oven. Under 5 minutes is hands on, however it is worded.
  2. Stirring or turning **occasionally, now and then, once or twice or halfway** is still hands off **from 10 minutes up**;
     under 10 minutes, any stirring makes it hands on. Nothing in the sample sat between 5 and 15 minutes with occasional
     stirring, so 10 is the household's figure, not a measured one.
  3. Stirring often, constantly or all the time, whisking, frying, browning, and watching for a moment ("bring to a simmer,
     then turn off") are hands on.
  4. A step whose timing matters but needs nobody (fat heating in the oven to be ready with the batter) is hands off; the
     timers (PR 4) look after it.
- **The word lists can sort, not decide.** 85% where they answer, and no answer on a third of the steps (11 of those 20 were
  hands off). In the data job (§6) they order the household's review; a session reading each step by the rule above makes the
  proposal.
- **The oven, not the cook's hands, limits a roast dinner.** Asked about the three-recipe roast, the household said the oven
  would be the limit, and that the kitchen has two. Its dishes want 200°C and 220°C (fan): two ovens can hold both
  temperatures, one cannot. A hands row alone would have shown that meal as relaxed. See §7, PR 3, and §10, 9.
- **The converter run (23 Oct):** the refined rule pasted into the conversion project for the test only, three recipes
  re-converted from their source pages. **Every timed step's mark matched the household's: 20 of 20**; no marker on an
  `[instant]` step or under 5 minutes, no duration dropped. Today's `test/validate-recipes.js` reports exactly the marked
  brackets as unread and the recipes otherwise valid, which is §5's reason for shipping the parser first. One re-conversion
  left some amounts without a unit, as re-conversions can: the data job adds markers to the library's own text and never
  replaces a recipe with a re-conversion.

**Step 0 is complete.** The marker, the rule and the order stand, and §10 is decided: PR 2 can be built.

## 6. The data job: marking the library

Recipe text, so `CLAUDE.md` § "Changing recipe text in the live database" applies to the letter, with
`migrations/6c-2-line-rewrite/` in `PrivateBackup` as the worked example. No ingredient line changes, so the shopping list and
its ticks cannot move; the re-measure in step 8 proves it.

1. **Preconditions.** PR 2 merged; every device reloaded (the household says so); a nightly dump taken after the merge exists in
   `PrivateBackup`; a fresh EXPORT DATA from the app, kept outside this repo.
2. **Rehearse on Test Kitchen** first: one recipe there, the whole procedure, before any family recipe.
3. **Propose.** `tools/propose-hands-off.js <export> <out.json>` (built in PR 2, its own small commit): reads the export with
   the app's own `core.js`, and for every timed MERGE step that is not already marked writes recipe id, title, the md5 of the
   recipe's `syntax`, the line, its bracket, a proposal (`off`, `on`, `ask`) and why (the words it matched, the minutes). It
   refuses a path inside this repo, as `tools/remeasure.js` does, and writes nothing to the database. It applies step 0's
   refined rule as far as words and minutes allow (the waiting words, the 5- and 10-minute lines, "occasionally" against
   "often") and says `ask` where they do not settle it; step 0 showed plain word lists are right 85% of the time and silent on
   a third of steps, so a session then reads every `ask` by the rule and proposes. It is tested here on a **made-up** export.
4. **The household decides,** in a session: the proposals in batches by recipe, every step the session was unsure of one by
   one. The result, with each recipe's before and after text and both md5s, is saved in `PrivateBackup` as
   `migrations/<date>-hands-off/` (`approved.json`, `before-after.json`, a `README.md` like 6c-2's). Never in this repo.
5. **Validate every after text** with `node test/validate-recipes.js`: no "present but NOT read" warning, every flagged step
   reads `handsOff`, no other change to what it reports.
6. **Write one recipe**, by a statement generated from the saved file, guarded both ways:

   ```sql
   with v(s) as (select $t$<new text>$t$::text)
   update public.recipes r set syntax = v.s, updated_at = now() from v
   where r.id = '<id>' and md5(r.syntax) = '<md5 before>' and md5(v.s) = '<md5 after>'
   returning r.title;
   ```

   No row returned: nothing changed; stop and find out why (most likely the recipe was edited since the export). The household
   opens it in the app and checks the hatched bars before the rest are written.
7. **Write the rest,** one statement per recipe, then compare every stored md5 to its after md5 in one query.
8. **Re-measure** with `tools/remeasure.js` on a new export: the shopping rows must be identical to the measure taken before.
9. **Undo** is the before text from `before-after.json`, written back the same way with the guards swapped.

**Other households' recipes** (the relatives') change only with them present or with their say: ask before including them.

## 7. The PRs in detail

Each follows `CLAUDE.md`'s "Every session, before you push": both suites before and after, every new check broken once and seen
failing by name, `git diff origin/main` read for private data, dates from `date -u`, and a PR description saying what was
verified and what was not. Each PR that the household will notice adds a `changelog.json` entry (and `APP_VERSION`), updates
`help.html` and the matching section of `docs/SPEC.md`, and puts its tablet steps in `docs/HOUSEHOLD-JOBS.md`.

### PR 1: timeline fixes, ticks drive the bars (`index.html` only)

- The last ruler tick right-aligned, never past the strip; the same for any label near the end.
- A minimum bar width in pixels large enough to tap (about 28 px), and an instant step drawn as a marker with its label beside
  it rather than inside.
- The dish's name at the start of its lane in the Group Viewer; the colour square stays.
- The strip header wraps at phone width: label, then START/FINISH TOGETHER on their own row, then the total.
- A ticked box's bar greys out with a ✓; tapping a box flashes its bar (the reverse of today's jump), matched by recipe id and
  handle as `wireTimelineInteractions` already does.
- Classic draws a "more to the right" cue like Modernist's (`.flow-more`, `index.html:834`).
- Smoke: each of these at 1280 and 412 px, both styles. No `core.js` change.

### PR 2: the marker

- `core.js`: `extractStepDuration` per §3; `computeTimeline` adds `handsOff` and `inputs` to each step (additive: no caller
  reads them yet, and nothing it returns today changes); version bumped in all three places.
- `index.html`: `durationBadge` adds `· hands off`; hands-off lanes hatched in both styles and both themes, from tokens (the
  stylesheet test refuses an `rgba()` outside `:root`); the preview shows it too.
- `test/validate-recipes.js`: reports how many steps are marked; the existing unread-bracket warning covers mistakes.
- Converter: the rule drafted and tried in step 0 (§5), a new test in `converter/test-set.md`, and the version moved in
  all three places (the file's **Version** line, `CONVERTER_VERSION`, `CONVERTER_PINNED`), which brings back the converter bar.
- `tools/propose-hands-off.js` (§6.3) and its made-up fixture.
- `docs/ARCHITECTURE.md` §2 (the durations paragraph), `docs/SPEC.md` §3.
- Tests: the parser's cases, including `[instant, hands off]` and `[hands off]` left unrecognised; the converter pin; a smoke
  check that a hands-off fixture step is hatched and badged.

### PR 3: the run sheet (split on 23 Oct into 3a, the planning half, and 3b, the running half)

3a is `planToServe`, `handsWindows` and `ovenUse` with EAT AT, the clock ruler, the hands row, the ovens and AVOID THE CLASH; 3b is `projectRun`,
START COOKING, the playhead, START and DONE, the ready flag and the Now line. The list below is the two together.

- `core.js`, pure and tested:
  - `planToServe(lanes, serveAt, { avoidClash })`: today's FINISH TOGETHER offsets turned into clock times, then, with
    `avoidClash`, hands-on steps moved earlier (with what feeds them) until no two overlap. Each dish keeps today's shape
    (§10, 4).
  - `projectRun(plan, run, now)`: done steps as recorded (a step ticked without START by §4's rule); a running step ends at the later of its planned end and now; every
    other step at the latest of: its planned start, now, the end of what feeds it, and the end of any hands-on step in its way
    if it is hands on. Returns each step's projected start and end, the ready time and minutes late.
  - `handsWindows(steps)`: busy, clash and free intervals.
  - **Ovens** (step 0's roast): `ovenUse(lanes, recipes)` reads each recipe's preheat temperature (fan or not) and treats its
    steps that say oven, roast or bake as using an oven at that temperature. With the device's number of ovens (§10, 9),
    it reports when more ovens, or more temperatures, are wanted at once than the kitchen has. Drawn as one thin lane per oven
    under the hands row, coloured by temperature; a clash says which steps want which temperature. A recipe with no
    temperature on its preheat line, or two, is left out of the check and says so. Measured from the text, not marked in
    it: no format change, and the converter already writes the preheat line. If step 0 or the first real cooks show this
    reading is wrong too often, an explicit marker is a later change.
  - An open-ended step keeps the 2-minute stand-in, so a projection through it is a guess; the header says "about" whenever
    `lineUpTimelines`' `about` would.
- `index.html`: EAT AT and START COOKING in the strip header of both viewers; the clock ruler, playhead, hands row, planned
  marks, ready flag and Now line; START and DONE in boxes in cooking mode.
  - **Updated in place once a second, redrawn only when a projection changes**, so a tap is never lost to a redraw (the mock's
    pattern).
  - Run state (start time, each step's start and done) lives with the ticks and is keyed the same way, so it survives
    `refreshLibrary()`'s redraw, and lasts as they do, until reload (§10, 5).
  - The number of ovens in Settings → APP, per device (§10, 9), with its line in `help.html`.
  - Hidden from print and PNG through `hideSelectors`.
  - `buildShoppingList()` is not touched; no `load*`/`save*` is added.
- Smoke: driven by Playwright's clock (`p.clock`, as `FIXTURE_NOW` already is): a late tick moves the ready time; a clash
  shows and AVOID THE CLASH clears it; the stub records no write from any of it.

### PR 4: timers

- START TIMER on a timed step; the countdown on its bar and box; at zero a chime (Web Audio, unlocked by the START tap), a
  vibration where supported, DONE pulsing (still under `prefers-reduced-motion`).
- No sound setting: chime and vibration are always on (§10, 6).
- Smoke: a timer reaching zero under Playwright's clock shows ready and pulses; no write.

## 8. Not in this plan

From the same review, parked: **Trace** (hold a box to dim everything that does not feed it), **fold away** finished rows and
columns in cooking mode, a **step-through** view (one "now" card at a time), drawn connector lines between boxes. Each wants
its own issue if the household picks it up; none depends on this plan.

## 9. Risks

- **A stale tab during the data job** shows brackets as text: §5's order, and the reload step, are the guard.
- **A reload mid-cook** loses the run, as it loses the ticks today: accepted for now (§10, 5).
- **False precision.** A ready time to the minute from midpoints of ranges and 2-minute stand-ins; "about" is the guard, and
  the re-planning corrects it as the cook ticks.
- **The proposals** will be wrong on some steps (step 0: 53 of 54 right on a sample chosen to be awkward); that is why the
  household approves every recipe's marks and the script never writes.
- **The oven check reads free text:** a recipe's preheat line and the words in its steps. It will miss an oven step worded
  another way, and it cannot see a dish that changes temperature part-way; it says when it has left a recipe out, and an
  explicit marker is the later fix (§7, PR 3).
- **Background tabs and screen lock.** A timer is only as audible as the tablet is awake; cooking mode keeps it awake, and
  without it a chime may come late. Push notifications are out of scope.

## 10. Decisions (all made 23 Oct 2026)

The household took the recommendation on each one still open, on 23 Oct; 1, 8 and the drawing of a step ticked without START
(§4) were settled the same day by step 0 and the second mock. The PR that builds each one records it again in its description.

1. **The marker:** `[25 min, hands off]` inside the duration bracket, as step 0 used it.
2. **Default EAT AT:** now plus the longest dish, rounded up to the next five minutes: start now, eat when it is ready. The cook
   changes it with the stepper; it is not stored.
3. **AVOID THE CLASH:** a button, shown only when there is a clash, off until pressed. Nothing moves by itself.
4. **Each dish's shape:** today's. Dishes are shifted whole, so the strip matches the diagram; steps are not each planned as
   late as they can go.
5. **How long a run lasts:** with the ticks, until reload. A reload mid-cook loses the run, as it loses the ticks today (§9);
   keeping both on the device is a later change if it is missed.
6. **Chime and vibration:** on, with no setting.
7. **Which households' recipes the data job marks:** the family's, after a rehearsal on Test Kitchen; the relatives' only with
   them.
8. **What "hands off" means:** step 0's refined rule (§5), with occasional stirring hands off from 10 minutes.
9. **The number of ovens:** kept on each device (`localStorage['kitchen.ovens']`, read in `try/catch`, 1 when unset or
   blocked), set in Settings → APP. No schema change. The family's tablet is set to 2 as a household job when PR 3 ships.

**When this plan is done** (PR 4 merged and checked on the tablet), the PR that closes it updates `docs/SPEC.md` and deletes
this file.
