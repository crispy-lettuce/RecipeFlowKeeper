<!-- Verbatim transcription of the original Build Brief (.docx), added to the repo
     14 Sep 2026 so its reference codes (S1, P1, R7, C3 ...) can actually be resolved
     by anyone reading the other docs. Content unchanged; only headings and list
     markers added. This is the source of truth for what was decided and why. -->


# Kitchen App — Build Brief
Everything decided, in one place, written to stand on its own in a new conversation. Pair this with the three files already in this project's knowledge — the current app's HTML, a sample data export, and the recipe-conversion instructions — for how things work today.

## What this is
A personal recipe app, currently a single HTML file used from a tablet, with everything stored in the browser. It handles recipes, meal planning, a shopping list, scaling, and more — full detail is in the project's existing files. This brief covers everything about to be added or changed.

## The shape of what's being built
Proper multi-device use (tablet and phone), via a real backend rather than browser-only storage.
A long list of everyday improvements — planner, recipe viewing, shopping list, history.
A food diary, including things that were never cooked from a recipe at all.
Converter and conversion-instruction fixes, closing gaps found during review.
Automatic calendar reminders for meal prep.

## Architecture — final decisions

### Hosting
Stays exactly as it is: GitHub Pages. No migration needed for the app itself.

### Backend
Supabase (Postgres database, Auth, Storage, Edge Functions), free tier.
Data pattern: the whole library loads into memory when the app opens; everything is instant from then on; changes save to Supabase in the background. This is deliberately not a full offline-sync engine — offline use was confirmed as not required, so the simpler pattern was chosen on purpose.

### Images
Stored in Supabase Storage, not embedded in JSON or browser storage. This removes the old browser storage ceiling entirely — no compression gymnastics needed to fit a quota.

### Accounts
One shared household login to start; separate logins for other households planned later. Build requirement: every table should carry a household/account identifier from day one, even though only one household exists initially. Retrofitting that later, once data exists without it, is real rework — designing it in now costs almost nothing.

### Backup
A scheduled GitHub Action exports the database on a timer and stores the result in a separate private repository — not the one serving the public GitHub Pages site. Confirm which repo currently serves Pages and whether it's public before wiring this up; recipe and diary data shouldn't end up committed somewhere public by accident.

### Calendar reminders
A Supabase Edge Function holds a Google OAuth refresh token, obtained via one one-off consent screen (expect an "unverified app" warning the first time — normal for a personal project, click through once). After that single step, reminders are created automatically with no further manual action, ever. This replaces the earlier downloadable-file idea entirely — a live, backend-held connection turned out to be the better option once a backend existed anyway.

## Full functional requirements
Everything below is decided. Reference codes are for discussion; original note numbers from the improvement notes are in brackets.

### Settings

**S1  Week start day [3]**
Configurable, default Friday. Drives both Planner and Shopping List, which already share one week-grouping function.


**S2  Dark mode [20]**
Three states: on, off, or follow system.


**S3  Aliases manager [9, 24]**
One shared mechanism covering both source names and ingredient names, viewable and editable after the fact.


### Planner

**P1  Servings + scale on the planner card [1, 2]**
Each entry shows servings and can be scaled by entering a target number of people, not a multiplier.
Scaling an entry is per-instance — it doesn't alter the saved recipe — and the scaled quantities feed that week's shopping list.


**P2  Total time on cards [6]**
Shown on Planner and Shortlist cards. No converter work needed — TIME is already captured, just not surfaced there yet.


**P3  Automatic calendar push [23]**
Opt-in per entry. See Architecture above for the mechanism.


### Recipe viewing & editing

**R1  Reset ticked ingredients/stages [4]**
A reset button in the Viewer, clearing all ticks without navigating away.


**R2  Auto-collapsing sidebar [5]**
Collapses automatically on opening a Recipe or Group Viewer; a small control peeks it back; returns to normal on leaving.


**R3  Group Viewer parity [7]**
No functional gap between single and grouped viewing. Currently missing from the Group Viewer: Keep Awake, Favourite, Shortlist, Edit, Export, Print, Scale.


**R4  Dated cooking notes [22]**
A note box in the Viewer; each entry dated, building a running log per recipe across cooking sessions; foldable into the permanent Notes text later.


**R5  Scale by servings [1]**
Everywhere — Planner and Edit — scaling works by target servings. The old ×0.5/×1/×2/×3 buttons are retired.


**R6  Servings mandatory [1]**
Every recipe must have one. Converter prompts for it manually if it can't be found. Roughly half the existing library will need this adding — fold into the reprocessing pass.


**R7  Recipe images [15]**
Stored in Supabase Storage (see Architecture). Manual upload supported for recipes with no source image.


### Shopping list

**SL1  Unit handling [8]**
Standardise at conversion time. Combined totals: under 1000 g/ml shown as g/ml, 1000+ shown as kg/l. Never mixed systems.


**SL2  Ingredient name matching [9]**
Prompt-and-remember, same pattern as source matching. Editable via the aliases manager (S3).


**SL3  Show/hide checked items [10]**
Toggle.


**SL4  Reset ticks [11]**
Clear-all button for the current list.


**SL5  Week selection [12]**
This Week / Next Week / Both Weeks combined.


### History & food diary

**H1  Meal type at point of logging [18, 19]**
A one-tap prompt (Breakfast/Lunch/Dinner/Snack) when marking a recipe cooked. Chosen over inferring from clock-time. Removes the need for Planner meal-slots entirely.


**H2  Ad-hoc entries [E]**
A lightweight quick-log for things with no recipe card — a takeaway, a snack. Lives alongside cooked-meal history on one timeline, visually distinguished, kept deliberately out of the Planner. Autocomplete on description for clean, consistent naming.


**H3  CSV export [18]**
Date, meal type, entry name, source (recipe vs ad hoc), course tag where applicable, ingredient summary without quantities.


### Converter & conversion instructions

**C1  Extract equipment [17]**
Size-specific tin/tray/dish into the EQUIPMENT field — present in the app today but never populated.


**C2  Capture source URL [13]**
Store the actual link, not just the site name.


**C3  Guarantee bracket timings [6]**
Mandatory stage durations (e.g. "[8 min]") so the Group Viewer's shared timeline is reliable rather than incidental.


**C4  Servings mandatory, with fallback [1]**
Converter prompts for manual entry when a recipe doesn't state one.


**C5  Consistent ingredient phrasing [7]**
Tighter phrasing rules (e.g. "1/2 lemon" not "1/2 a lemon") so arithmetic scaling doesn't produce awkward grammar. No app-side grammar correction attempted.


**C6  Standardised units [8]**
Consistent metric units at conversion time, feeding SL1 cleanly.


**C7  Test set and audit [14]**
A standing set of deliberately tricky example recipes (split ingredients, late additions, parallel prep) to check the instructions against. Separately, audit the existing library for the staging mistake that prompted this.


## Deliberately dropped
Recorded so they don't quietly reappear:
Scaling rounding rules [16] — ship without any; revisit only if it proves annoying in practice.
Week-number picker on the shopping list [12] — redundant given the Planner's forward range.
Meal slots or tagging in the Planner [19] — replaced by capturing meal type at the point of logging (H1).
Live Google Calendar via a downloadable .ics file — superseded once a backend made a proper live connection possible (see Architecture).
Direct Google Keep integration — parked. No personal-account API exists; if revisited, the standard phone Share sheet is the better route, not a Keep-specific connection.

## Suggested build order

### Phase 1 — foundations
Supabase project: schema (with household/account id from day one), Auth (shared login), Storage bucket for images.
GitHub Action backup job, writing to a separate private repo.
Converter changes (C1–C6) and the test set (C7).
Reprocess the existing library against the updated converter, including the servings retrofit (R6).

### Phase 2 — the everyday wins
Planner servings and scaling (P1, R5, R6), total time (P2).
Shopping list improvements (SL1–SL5) and the aliases manager (S3).
Viewer quality-of-life: reset, sidebar, group parity (R1–R3).

### Phase 3 — the newer ideas
History rework and food diary (H1–H3).
Cooking notes (R4).
Images into Supabase Storage (R7).
Calendar push (P3), once the one-off Google consent has been done.

## On credentials — what's needed, and what isn't
Nothing secret belongs in a chat message.
Safe to state plainly: the GitHub repo name/URL, the Supabase project's public URL, and its "anon" key — this one is meant to be public-facing and is safe inside front-end code.
Never paste into chat or commit to the repo: the Supabase service role key, the database password, or the Google OAuth client secret.

## Continuing in…
How it actually works

### Claude Code
Log into the GitHub CLI and Supabase CLI on your own machine first. Claude Code then acts directly — schema, functions, deploys — with no secret ever appearing in the conversation.

### claude.ai chat
Code gets written as files — SQL, Edge Functions, the GitHub Action YAML — for you to paste into the repo yourself. Real secret values go into GitHub's and Supabase's own settings screens, never into the chat.


## Open items
Confirm whether the repo serving GitHub Pages is public — determines where backups must not go.
Multi-tenant household accounts: not needed now, but the data model should anticipate it (see Accounts, above).
