# Plan: a test household, and a fresh start for the real one

**Done 18 Oct 2026.** `switch.sql` ran at 18:02:53 UTC; the family's account is in a new household under its own name
(`dfeac187-a044-4f6e-a7a7-d47119930127`), and `286a8a12…` is **Test Kitchen** with the test account. Read back by a session
afterwards (`check.sql`, read-only); the result, and the two differences from §2 (the household cleared its planned meals
from 18 Oct on just before the switch, and later shared the new library with Test Kitchen), are in `PrivateBackup`'s
`migrations/test-household-split/README.md`. Steps 8 to 11 of the household's job were reported done the same evening.

**Written 18 Oct 2026** (`date -u`), against `main` at the commit this branch started from, and the live database read
(read-only) that morning. A plan only: nothing in the app changes, and no production row was written to write it.

**The ask (18 Oct):** the family's household holds a placeholder library: recipes, cooking history, plan and diary
entered while the app was being built. The household wants to start again with its own recipes, and keep the
placeholders somewhere to test with.

**Decided with the household the same day:**

- **Move the account, not the data.** The family's first household (`286a8a12-c12a-4b83-afbc-0912533f6b1c`) keeps
  everything in it and becomes the test household, renamed **Test Kitchen**, with a test account of its own. The
  family's account moves into a new, empty household under the family's existing name.
- **The new household keeps sharing with the relatives' household**, so the share moves with the account.
- **Three things come with it, copied:** the word matches (16), the shopping aisles (10) and the swaps (2). Nothing
  else: no recipes, history, plan, diary, meal groups, keywords, shortlist or ticks.
- The test account's address, like every account's, is in `PrivateBackup` (`migrations/test-household-split/`), not
  here: this repo is public.

## 1. Why move the account rather than the data

| | Move the data to a new household | Move the account (this plan) |
| --- | --- | --- |
| Rows changed | Every row of the household in 12 tables (about 300) | 2 membership rows, plus the copies, the share and the Google row |
| Photos | 34 files in two buckets sit under `<household_id>/`. Each would have to be moved in Storage, and every `IMAGE:` line and `source_photos` path rewritten, or the private source photos stop opening (their policies key on the folder's household) | Nothing moves; every path stays right |
| Undo | Another bulk move | One `DO` block, tried (§4) |

**The weekly live check's household can't be used.** `PrivateBackup`'s `scripts/weekly-live-check.js` first checks that its
household is empty and fails if it is not; it must stay empty. So the test library needs a household of its own, and
the one it is already in is the cheapest to make.

## 2. What is tied to the old household, and what happens to each

| Tied to the household | What the switch does |
| --- | --- |
| Recipes, logs, notes, plan, diary, meal groups, keywords, shortlist, ticks, photos | Stay: they are the test library |
| Word matches, aisles, swaps | Copied: the new household gets its own, and Test Kitchen keeps its own, so its shopping list reads as before |
| The share with the relatives' household (`recipe_shares`, this household → theirs) | Moves to the new household in the same step, so they see the new library from the moment of the switch and never the test one |
| Google Calendar and Drive (`calendar_connections`; the token in Vault under the household's id) | DISCONNECT first (it forgets the token and keeps the calendar and Drive folder ids); the switch moves the row, so CONNECT from the new household carries on with the **same** RecipeWrangler calendar and Drive folder (`calendar-auth` reuses `calendar_id`; `drive-backup` reuses `drive_folder_id`) |
| Calendar events already made | Each event's id is made from the household's id (`calendarEventId`), so the new household could never tidy them. Before disconnecting, take the days from today on out of the calendar (5 days, 18 to 22 Oct, on the morning of 18 Oct). Past days' events stay in Google, as they always do; delete them there by hand if wanted |
| Settings (`household_settings`) | The new household gets the defaults, as `docs/ONBOARDING.md` §4 does. The only differences from the old one on 18 Oct: Appearance (Dark) and the converter confirmation (DONE) |
| The household's name | Renamed to Test Kitchen from the app first; the new household is made with the family's name (names need not be unique; `set_household_name` keeps 40 characters) |
| An open tab | `refreshLibrary` re-reads the account's membership whenever the tab comes back, so an open tab moves over by itself. Reloading every device is still the plain safe step |

Untouched: the weekly live check's household, the relatives' household (bar the share's owner), the nightly and
weekly backups (they copy every household and name none), and the app's code.

## 3. The steps

The household's own steps are also in `docs/HOUSEHOLD-JOBS.md`, with what each should show.

1. **Safety.** The latest nightly backup in `PrivateBackup` is green. EXPORT DATA in the app, kept somewhere safe.
2. **In the app, as the family's account:**
   1. **PLANNER:** for each day from today on that shows ✓ IN CALENDAR, tap it to take it out (AUTOMATICALLY ADD TO
      CALENDAR was off on 18 Oct, so nothing puts them back). The event goes from Google.
   2. **SETTINGS → APP → CALENDAR → DISCONNECT.**
   3. **SETTINGS → APP → RECIPE SHARING:** change the household's name to `Test Kitchen`, then SAVE.
3. **Supabase dashboard → Authentication → Users → Add user:** the test account (address in `PrivateBackup`), with a
   password.
4. **Supabase SQL editor:** run `PrivateBackup/migrations/test-household-split/switch.sql`. It checks that steps 2 and 3
   happened (renamed; disconnected and the token gone; nothing from today on in the calendar; the test account exists
   and is in no household) and raises, changing nothing, if one did not. Otherwise, in one go:
   - makes the new household and its settings row;
   - moves the family's account into it, still as owner;
   - puts the test account in Test Kitchen as its owner;
   - copies the word matches, aisles and swaps, and checks each count;
   - moves the share and the (disconnected) Google row.
5. **Check:**
   - **Every device:** reload the app.
   - **Signed in as the family:** an empty app under the family's name, with the word matches, aisles and swaps in
     Settings and the relatives' household under RECIPE SHARING. Set Appearance to Dark, tap DONE on the CONVERTER bar,
     and CONNECT GOOGLE CALENDAR again. It should name the same calendar, and the next backup should land in the same
     Drive folder.
   - **Signed in as the test account** (another browser profile or a private window): Test Kitchen with every
     placeholder recipe, its photos and history.
   - **A session runs `check.sql` read-only** and records the result in `PrivateBackup`.
6. **Afterwards, a documentation PR:**
   - `docs/INFRASTRUCTURE.md` §1 and §3 (the household id they give as "the family's" is Test Kitchen's now; four
     households);
   - `docs/ONBOARDING.md` (it says three);
   - this page, marked done.

**Undo:** `undo.sql` beside it puts every row back and deletes the new household. It refuses once the new household
holds a recipe, log, note, plan row, meal group, shortlist item or keyword of its own, since deleting the household would
cascade them away. From then on, the way back is by hand.

## 4. Tried on a scratch database (18 Oct 2026)

A local PostgreSQL 16, not the live database. It was built to the live shape of the tables the switch touches (columns,
defaults, checks, unique keys and cascading foreign keys read from the live database that morning), with made-up rows
in the live counts.

- Each missing step stopped the switch with its own message and nothing changed.
- With every step done, the switch gave the split in §2.
- Run again, it refused.
- `undo.sql` refused while the new household held a recipe or was connected to Google. Otherwise it gave back a
  database identical, row for row, to the one before.

The detail is in `PrivateBackup/migrations/test-household-split/README.md`. *Not verified:* anything the app does after
the switch, which is step 5's to see.

## 5. Using the test household afterwards

- **It tests data, not code.** Test Kitchen runs the same app from `main`, so a change still reaches the tablet when
  it merges. A place to try code first is issue #100 (`docs/PLAN-PREVIEW-SITE.md`, parked); the two would go together.
- **Keep Google off in Test Kitchen.** Its Google row moves to the family's household, so CONNECT there would make a
  second RecipeWrangler calendar.
- **One account, one household** (`docs/ONBOARDING.md`). The test account stays in Test Kitchen; sign in to it in a
  separate browser profile, not on the tablet.
- **App checks after the split.** The family's new library is empty until recipes are added, so `docs/HOUSEHOLD-JOBS.md`
  has the checks that look at recipes and the plan (61a to 66a, 18 Oct) done in Test Kitchen. Whether later checks that write
  (adding, cooking, planning) go there too is the household's call.
- **The converter's DONE is kept per household** (`household_settings.converter_ack_version`). The new household starts with none,
  so the CONVERTER bar shows there once; Test Kitchen keeps the old household's. That is why the job list puts the converter
  reload (#155) after the split.
