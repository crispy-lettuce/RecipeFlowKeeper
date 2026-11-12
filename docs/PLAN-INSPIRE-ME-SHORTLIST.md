# Plan: INSPIRE ME feeds the shortlist

A working file with an end (`CLAUDE.md`, "How the documents are kept"): the PR that closes it updates `docs/SPEC.md` §5.5 and deletes this file.
Written 12 Nov 2026 from the household's own use of INSPIRE ME the day before. **Nothing here is built.** Three decisions are marked **CONFIRM**: they are
recommendations, not settled.

## 1. The ask

After using ONE MEAL, 3 OPTIONS and A WEEK on the tablet (all good), one observation: a suggestion that is accepted should go **onto the shortlist**, not onto a day,
so the household chooses the day afterwards, as it does for any other idea. That may mean one general **INSPIRE ME** button, on the shortlist, rather than one in the
Planner's heading and one on each empty day.

## 2. Why it is better

- **What and when are two choices.** INSPIRE ME is good at "what"; the household already has a place for "when": tap an item on the shortlist, tap a day. Today ADD
  makes both choices at once (from a day's button) or makes the household say "tap a day" before it has decided (from the heading).
- **It is the shortlist's own idea.** The shortlist exists to hold things waiting for a day, it is shared across devices, and it survives a closed tab. A suggestion
  is exactly that until it is planned.
- **It removes code and clutter.** The day buttons, the heading button, the "tap a day" waiting state and the day-specific panel all go. An empty day goes back to
  CHOOSE A RECIPE and OTHER, which also settles the open question recorded in the closed plan (the pair under CHOOSE A RECIPE made an empty day two lines tall on a phone).
- **It costs a little.** A dish takes two taps more to reach a day than ADD TO did. That is the trade the household has chosen.

## 3. Brainstorm: where the panel lives

| | A. Panel in the shortlist column (recommended) | B. Panel stays above the days; only the button moves |
| --- | --- | --- |
| Button | Under the shortlist's "jot down an idea" box | In the shortlist panel; the panel opens above the days |
| Accepting | A card's button adds it to the list directly below: the result is on screen | The list is in another column (tablet) or far below the days (phone), so the result is only a toast |
| Phone | Everything is in one place at the bottom, reached by the SHORTLIST tab | The button is at the bottom, the panel at the top: a jump each way |
| A WEEK | Its proposals are on the days, away from the panel on a phone; needs the banner below | Panel and days are together |
| Width | The column is 330px (Modernist) and collapses to a 56px rail: chips wrap, cards need a compact form | Unchanged |

**Recommendation: A.** The shortlist is where the household now looks for what it is going to cook, and seeing a dish arrive there is the confirmation. A's cost is
the narrow column and A WEEK on a phone, both handled in §4.

## 4. What it does

### 4.1 One general INSPIRE ME, on the shortlist (**CONFIRM**: the heading button and the day buttons go)
- **INSPIRE ME** is a button in the shortlist panel, under the idea box. The Planner's heading goes back to PREVIOUS 3 DAYS and ROLLS FORWARD DAILY; an empty day goes back
  to CHOOSE A RECIPE and OTHER. In Modernist's collapsed rail the panel is not shown; opening the rail brings the button back.
- The panel opens **inside the shortlist column**, above the list, with the same chips: HOW MANY (ONE MEAL, 3 OPTIONS, A WEEK), PROTEIN, WHICH, MORE CHOICES. A card is
  compact in this column: title, protein, time, last cooked; the photo is dropped or small.
- A card has **ADD TO SHORTLIST** and **OPEN**. ADD TO SHORTLIST is the one write: a one-row save, `addShortlistRecipe`, the one `+ SHORTLIST` already makes. The card
  goes from the panel and the dish appears in the list below it. In ONE MEAL, **ANOTHER** offers a different dish; in 3 OPTIONS the other cards stay, and **ANOTHER 3**
  replaces what is left. Until then nothing is written.
- **Never suggested** adds one rule: a recipe already on the shortlist (it was accepted, or kept for another reason). The rest are as before: a recipe on the 14 days, one
  cooked in the last 14 days (unless POPULAR), one passed over.
- A dish on the shortlist is planned the way every shortlist item is: tap it, then tap a day (it leaves the shortlist when it lands). No change there.

### 4.2 A WEEK (**CONFIRM**: it keeps its days, and gains a second way to finish)
A week is inherently about days (the spread rules, a protein not on two days running, work on the order), so it stays: the proposals are drawn on the empty days, with SWAP and ×.
What changes:
- The panel is now in the shortlist column, which on a phone is below the days, so its **ADD ALL**, **ANOTHER WEEK** and **CANCEL** move to the bar at the top of the days
  (`#assignBanner`, the place "tap a day" already uses), where the proposals are in view.
- A second finish is added: **ALL TO SHORTLIST** puts every proposal on the shortlist and clears the days, for a household that wants the dishes and not the order.
  ADD ALL (to the days, one UNDO) is as built.

### 4.3 What does not change
Nothing else about the choosing: `core.js` is untouched, and so is its version. Accepting writes one shortlist row per dish, queued like any other. No schema change, no
Edge Function, no change to `shoppingLine` or the dictionary.

## 5. What is built, and what goes (`index.html`, `styles/modernist.css`)

- **New:** the button and the panel's home in the shortlist panel; a compact card; the shortlisted recipes added to what is never suggested (`inspireCtx` already
  passes `planned`, so the shortlist's recipe ids join it: no engine change); ALL TO SHORTLIST; the banner for A WEEK's actions.
- **Goes:** `#inspireBtn` in the heading and the rules that make room for it (`.planner-btns`, the clip and wrap rules, the label that gives way); the day button
  (`inspireDayBtn`, `.day-tools` and the pair's CSS in both looks); `openInspire(date)`, `state.inspire.date`, "FOR <day>" and "ADD TO <day>"; `state.inspirePlacing`, its
  banner branch and its day-click branch, and the `assignable` class it set; `inspireAddTo`.
- **Kept:** `+ SHORTLIST` becomes the accepted action and its "on the shortlist" state; the panel's choices, MORE CHOICES, LOW EFFORT MEANS, A WEEK's engine calls,
  ADD ALL and UNDO.

## 6. Slices

One PR, three commits, each tested before the next.

1. **The move, for ONE MEAL and 3 OPTIONS.** The button and panel in the shortlist, ADD TO SHORTLIST, the shortlist excluded from suggestions, the day and heading buttons and
   the placing flow removed, their CSS undone. A WEEK still works at this point (its panel moved with the rest) but its proposals' actions are not yet at the top.
2. **A WEEK's banner and ALL TO SHORTLIST.**
3. **Paperwork:** `changelog.json` (version 2026-11-12.1), `help.html`, `docs/SPEC.md` §5.5 (the INSPIRE ME and A WEEK paragraphs rewritten, not annotated),
   `docs/HOUSEHOLD-JOBS.md` (Job 9 comes off, the household having reported A WEEK good; a new job for this), `docs/STATUS.md`, and this plan deleted.

## 7. Checks

`test/smoke.js` has a block of checks on the day buttons, the heading and the placing flow that this makes untrue; they are rewritten, not deleted, so each rule they held
(never on a past day becomes "not on the days at all"; nothing written before accepting; a panel button is 44px) is held by a check that fails when it breaks. New:
ADD TO SHORTLIST writes exactly one shortlist row and no plan row; the dish is in the list and not suggested again; a shortlisted recipe is never offered; the panel fits
the 330px column and a phone, nothing running off the side; ALL TO SHORTLIST writes one shortlist row per proposal and no plan row; ADD ALL and UNDO as before, now with the
actions in the banner. Every new check is broken once and seen to fail by name.

## 8. Open, to settle while building

- **CONFIRM:** whether to keep a quick way to put a suggestion straight on a day. Recommended **no**: it is what the household moved away from, and the shortlist path
  is two taps.
- The compact card: whether to keep a small photo. The column is 330px; try a 56px photo and judge on the tablet.
- In Modernist's collapsed rail, whether the rail should carry an INSPIRE ME mark. Recommended **no**: expanding the rail is one tap.
- What the shortlist does as it grows: nothing new. An item leaves it when planned or removed with ×, as now.

## 9. What it must not do

- Write a plan row from INSPIRE ME except through ADD ALL, or a shortlist row except on ADD TO SHORTLIST or ALL TO SHORTLIST.
- Offer a recipe already on the shortlist, or put one on it twice.
- Change `shoppingLine` or a dictionary row, or send anything off the device.
