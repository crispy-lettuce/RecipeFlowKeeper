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
- **EAT AT.** A time the cook sets in the strip's header (default: a decision, §10). With it, the ruler reads clock times
  (`17:50`, `18:00`) and every box says when it starts; without it, the strip is as today.
- **Your hands row**, above the lanes: solid where you are busy, hatched red where two hands-on steps overlap (a clash), an
  outline saying `free 16 min` where you are not needed for six minutes or more.
- **AVOID THE CLASH** (shown only when there is one): moves the later hands-on step, and what feeds it, earlier until nothing
  overlaps. The dish it moves is then ready a few minutes before serving.
- **START COOKING** starts a playhead at the real time. From then:
  - a box ticked is done at that moment; a box ticked without START is drawn as having ended then and lasted its time;
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
PR 1  timeline fixes + ticks drive the bars          no format change; can ship now
PR 2  the marker: parser, converter, display          core.js and converter versions move
      ── household merges PR 2, reloads every device, taps DONE on the converter bar ──
DATA  hands-off pass over the library                 CLAUDE.md's recipe-text procedure, household present
PR 3  EAT AT, START COOKING, hands row, re-planning
PR 4  timers
```

PR 2 must be **merged and every device reloaded before the data job writes a single bracket**: a copy of the app from before
PR 2 shows `[25 min, hands off]` as text and loses that step's time (§1). The app asks for a reload when `core.js`'s version
changes, but a tab left open is the risk; `docs/HOUSEHOLD-JOBS.md` carries the reload step. **PR 2 is never reverted after the
data job** for the same reason. PR 3 can be built before the data job finishes, and would treat every step as hands on until
recipes carry the marker; it is most useful after.

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
   refuses a path inside this repo, as `tools/remeasure.js` does, and writes nothing to the database. Its rules are §2's word
   lists; `ask` for mixed wording and for a waiting word under 10 minutes. It is tested here on a **made-up** export.
4. **The household decides,** step by step, in a session: the likely ones in a batch, every `ask` one by one. The result, with
   each recipe's before and after text and both md5s, is saved in `PrivateBackup` as `migrations/<date>-hands-off/`
   (`approved.json`, `before-after.json`, a `README.md` like 6c-2's). Never in this repo.
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
- Converter: a rule ("Mark a step `hands off` when it needs nobody: simmering, baking, resting, proving, chilling, marinating.
  Not when the source says to stir often, baste or watch it."), a new test in `converter/test-set.md`, and the version moved in
  all three places (the file's **Version** line, `CONVERTER_VERSION`, `CONVERTER_PINNED`), which brings back the converter bar.
- `tools/propose-hands-off.js` (§6.3) and its made-up fixture.
- `docs/ARCHITECTURE.md` §2 (the durations paragraph), `docs/SPEC.md` §3.
- Tests: the parser's cases, including `[instant, hands off]` and `[hands off]` left unrecognised; the converter pin; a smoke
  check that a hands-off fixture step is hatched and badged.

### PR 3: the run sheet

- `core.js`, pure and tested:
  - `planToServe(lanes, serveAt, { avoidClash })`: today's FINISH TOGETHER offsets turned into clock times, then, with
    `avoidClash`, hands-on steps moved earlier (with what feeds them) until no two overlap. Each dish keeps today's shape
    (a decision, §10).
  - `projectRun(plan, run, now)`: done steps as recorded; a running step ends at the later of its planned end and now; every
    other step at the earliest of: its planned start, now, the end of what feeds it, and the end of any hands-on step in its way
    if it is hands on. Returns each step's projected start and end, the ready time and minutes late.
  - `handsWindows(steps)`: busy, clash and free intervals.
  - An open-ended step keeps the 2-minute stand-in, so a projection through it is a guess; the header says "about" whenever
    `lineUpTimelines`' `about` would.
- `index.html`: EAT AT and START COOKING in the strip header of both viewers; the clock ruler, playhead, hands row, planned
  marks, ready flag and Now line; START and DONE in boxes in cooking mode.
  - **Updated in place once a second, redrawn only when a projection changes**, so a tap is never lost to a redraw (the mock's
    pattern).
  - Run state (start time, each step's start and done) lives with the ticks and is keyed the same way, so it survives
    `refreshLibrary()`'s redraw. How long it lasts is a decision (§10).
  - Hidden from print and PNG through `hideSelectors`.
  - `buildShoppingList()` is not touched; no `load*`/`save*` is added.
- Smoke: driven by Playwright's clock (`p.clock`, as `FIXTURE_NOW` already is): a late tick moves the ready time; a clash
  shows and AVOID THE CLASH clears it; the stub records no write from any of it.

### PR 4: timers

- START TIMER on a timed step; the countdown on its bar and box; at zero a chime (Web Audio, unlocked by the START tap), a
  vibration where supported, DONE pulsing (still under `prefers-reduced-motion`).
- Per-device sound setting if the household wants one (§10).
- Smoke: a timer reaching zero under Playwright's clock shows ready and pulses; no write.

## 8. Not in this plan

From the same review, parked: **Trace** (hold a box to dim everything that does not feed it), **fold away** finished rows and
columns in cooking mode, a **step-through** view (one "now" card at a time), drawn connector lines between boxes. Each wants
its own issue if the household picks it up; none depends on this plan.

## 9. Risks

- **A stale tab during the data job** shows brackets as text: §5's order, and the reload step, are the guard.
- **A reload mid-cook** loses the run if it lives only in the tab, as ticks do today (§10).
- **False precision.** A ready time to the minute from midpoints of ranges and 2-minute stand-ins; "about" is the guard, and
  the re-planning corrects it as the cook ticks.
- **The proposal script's word lists** will be wrong on some steps; that is why every `ask` is the household's call and the
  script never writes.
- **Background tabs and screen lock.** A timer is only as audible as the tablet is awake; cooking mode keeps it awake, and
  without it a chime may come late. Push notifications are out of scope.

## 10. Decisions for the household

Each has a recommendation; the build waits for the answer, and the PR that builds it records it.

1. **The marker:** `[25 min, hands off]` inside the bracket (recommended), or another word.
2. **Default EAT AT:** the next five minutes after now plus the longest dish (recommended: start now, eat when it is ready), or
   a fixed household time such as 18:30.
3. **AVOID THE CLASH:** a button, off until pressed (recommended), or done automatically, or a warning only.
4. **Each dish's shape:** keep today's (dishes shifted whole, recommended: the strip matches the diagram), or plan every step as
   late as it can go (side branches move nearer serving).
5. **How long a run lasts:** with the ticks, until reload (recommended for PR 3: one rule for both), or kept on the device for
   12 hours so a reload mid-cook keeps the timers (ticks would then last that long too).
6. **Chime and vibration:** on (recommended), or a per-device setting.
7. **Which households' recipes** the data job marks: the family's, after a Test Kitchen rehearsal (recommended); the
   relatives' only with them.

**When this plan is done** (PR 4 merged and checked on the tablet), the PR that closes it updates `docs/SPEC.md` and deletes
this file.
