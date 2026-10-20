# Planned meals in Google Calendar (P3)

**Asked for in the original build brief** (`docs/BUILD-BRIEF.md`, P3, and "Calendar reminders" under Architecture): *"A Supabase
Edge Function holds a Google OAuth refresh token, obtained via one one-off consent screen … After that single step, reminders are
created automatically with no further manual action, ever."* and *"Opt-in per entry."* Scoped on 30 Sep 2026 at the household's
request; **the household answered §7 on 1 Oct 2026**, then simplified their answers the same day: **§9 is the design being built and
supersedes §4 and §8 wherever they differ.** §10 is the household's setup. **PR 1 (the migration and the two Edge Functions) is
merged (#69, 1 Oct); the app (PR 2, #71) merged 9 Oct, and the household applied the migration and connected the same day** (the
connection is dated 17:52 UTC). Then `docs/TEST-PLAN.md` step 40a, the household's tablet and phone pass, and PR 3 records it.
**§11** is the follow-up asked for on 9 Oct: two toggles that switch days on automatically (`docs/migrations/add-calendar-auto.md`,
step 40b).
**§12** (20 Oct) is a reminder per meal rather than per day, so that a breakfast and a dinner on one day can differ, and a group
cooked together has one. The household took the recommendation on all six questions (§12.11). **Status: built in two PRs** — the
function, its tests and the migration page (#176, merged, waiting for the household to apply and deploy), then the app (2026-10-20.7).

## 1. What it is for

The Planner says what is for dinner on which day; nothing tells anyone *when to start*. A recipe that takes 1 h 20 is noticed at
18:00 for a 18:30 meal. The calendar the household already carries on their phones can: an event for the planned meal, starting
when cooking has to start, with a notification at that moment.

## 2. What exists today (read-only, 30 Sep 2026)

- **The Planner** is `planner_days`: one row per day, `recipe_ids` and a parallel `servings`, or `is_blank`. No time of day and
  no opt-in flag. 16 days were planned in the last four weeks (about four a week); 3 are planned ahead today. `meal_groups` (7
  rows) says which recipes on a day are cooked together.
- **How long a recipe takes** is known two ways: its `TIME:` line, and the timeline the app draws from its steps' durations
  (`computeTimeline` in `core.js`). None of the 34 recipes has an `[overnight]` step; 6 have a step of an hour or more.
- **Household settings** hold the week start and dark mode; nothing about meal times.
- **Edge Functions:** three today (`rehost-images`, `find-recipe-image`, `source-ingredients`), deployed by the household from the
  dashboard. None talks to Google.
- **For a secret the database must hold:** Supabase **Vault** (`supabase_vault` 0.3.1) is installed. It stores secrets encrypted,
  with a key kept outside the database. `pg_cron` and `pg_net` are available but not installed.
- **Backups:** the nightly `pg_dump` in `PrivateBackup` copies the `public` and `private` schemas. **A Google token kept in either
  would be copied into the backup repo every night.** Vault's secrets live in its own schema, encrypted, and are not in that dump.

## 3. Two ways to do it

| | A. A live connection (the brief's choice) | B. A calendar feed Google subscribes to |
| --- | --- | --- |
| How | An Edge Function writes events into Google Calendar with the household's permission | An Edge Function serves an `.ics` feed at a secret address; Google Calendar subscribes to it |
| A change made at 17:00 | In the calendar within seconds | Google refreshes subscribed feeds only every several hours, so maybe not before dinner |
| Notifications | Set per event, at the start-cooking time | Google ignores a feed's own alarms; only a fixed default per calendar |
| Setup | A Google Cloud project and one consent screen (§5) | Paste one address into Google Calendar |
| Secret held | A Google refresh token (in Vault) | The feed's address itself |

**Recommended: A**, as the brief decided. B's refresh delay defeats a same-day reminder, and the brief dropped the file-based idea
for that reason.

## 4. The proposal

### What goes in the calendar

For each planned day the household has switched on, **one event**:

- **Title:** `Cook: Test Pasta` (two recipes: `Cook: Test Pasta + Test Soup`).
- **When:** ending at the household's meal time, starting when cooking has to start: meal time minus the recipe's cooking time
  (the longer of its timeline and its `TIME:`; for a group, the longest). `Europe/London`, so the clocks going back cannot move it.
- **Notification:** at the start (a pop-up on the phone), plus one 15 minutes before, to get the oven on.
- **Description:** each recipe, the servings planned, its time, and a link to open it in the app.
- **In its own calendar,** `Kitchen`, created in the connected Google account: it can be shown, hidden, coloured or shared with
  family in Google's own settings, and removing it removes everything the app ever made.

### Choosing which days

**Opt-in per day,** as the brief says: each planned day in the Planner gets a small **IN CALENDAR** switch, and the week gets
**ADD THE WEEK TO CALENDAR**. A blank day never goes in. Changing a day's recipes, its servings, or unplanning it updates or
removes its event; so does editing a recipe's title or time, for days to come.

### Keeping it in step

The app asks the function to bring a day up to date after each Planner change that touches a switched-on day, through the write
queue like every save, so it waits and retries when offline. The function reads the day from the database (never trusts what the
browser sends), then creates, updates or deletes that day's event. **SYNC NOW** in Settings does every switched-on day from today.
Events get an id worked out from the household and the date, so the function never needs a table of which event is which, and a
retry can never make a second event.

### Settings → App → Calendar

- **CONNECT GOOGLE CALENDAR** (once): Google's consent screen, then back to the app. Then: "Connected as …, calendar Kitchen".
- **We eat at** 18:30, and **Remind me** at the start and 15 minutes before.
- **SYNC NOW**, the time of the last sync, and any error in words ("Google no longer accepts the connection: CONNECT again").
- **DISCONNECT:** removes the app's events, forgets the token (and tells Google to), and leaves the switches as they were.

### Security

- The Google **client secret** is set by the household in the Edge Functions' secrets in the dashboard. Never in chat, never in
  this repo (`docs/BUILD-BRIEF.md`, "On credentials").
- The **refresh token** goes into **Vault**, reachable only by the functions (through a function in the `private` schema granted to
  the service role alone), and so is not in the nightly backup. Restoring a backup into a new project means connecting again.
- The consent step is bound to the household by a one-time value that expires in ten minutes, so a stray link cannot connect
  someone else's calendar.
- **Least access:** Google offers a scope that lets an app make its own calendars and manage only those. If the household's Google
  Cloud project offers it, the app uses that and can see nothing else in the account; otherwise the full `calendar` scope
  (*corrected 1 Oct: `calendar.events` cannot create a calendar, so it is no fallback*). To be checked at setup (§5), not assumed.

## 5. The household's one-off setup (about 20 minutes, before the build is merged)

1. In the Google Cloud console, with the Google account whose calendar will hold the meals: a new project, **RecipeWrangler**; enable the
   **Google Calendar API**.
2. **OAuth consent screen:** External; app name RecipeWrangler; the household's email; the calendar scope (§4, Security). Then
   **publish it** (status "In production"). Not verified by Google, so the consent screen warns "Google hasn't verified this app":
   expected, and clicked through once. **Left in "Testing", Google expires the connection after seven days**, which is why it is
   published.
3. **Credentials → OAuth client ID:** Web application, with one redirect address, the callback function's
   (`https://mhkayefzrtceesgizkjs.supabase.co/functions/v1/calendar-auth/callback`).
4. In the Supabase dashboard, **Edge Functions → Secrets:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Apply the migration (§6, step 1), deploy the two functions, then merge; then CONNECT in Settings.

A session cannot do any of this: it has no Google account, and never handles the secret.

## 6. How it would be built

| Step | What | Who applies it |
| --- | --- | --- |
| 1 | **Migration** (`docs/migrations/add-calendar-push.md`): `planner_days.calendar` (boolean, default false); `household_settings.meal_time` (default 18:30) and the reminder minutes; the connection's status (connected as, calendar id, last sync, last error); a `private` table for the one-time consent values; `private` functions for Vault, granted to the service role only | The household, first |
| 2 | **Two Edge Functions:** `calendar-auth` (the consent link, and the callback that stores the token and makes the Kitchen calendar; its callback has JWT checking off, since Google calls it, and is guarded by the one-time value) and `calendar-sync` (a day, or every day from today). Their pure parts (the event for a day, times across a clock change, the id) are tested in Node the way `test/source-ingredients.js` lifts code from the real source | The household deploys both |
| 3 | **The app:** Settings → Calendar, the Planner's switches and ADD THE WEEK, the sync after changes, a tolerant load (no migration yet: the calendar section says so). `savePlanDay` sends `calendar` only when it is set, so an ordinary save works before the migration | Merge |
| 4 | **Tablet and phone pass** (step 40a): connect once; switch a day on; the event on the phone, at the right time, with its notification; change the recipe; unplan it; DISCONNECT | The household |

Steps 1 to 3 as one PR carrying the SQL, as source photos was, or two; the household's choice. **Not testable from a session:**
anything that talks to Google. The functions are tested with Google's answers stubbed; the first real event is the household's.

## 7. Decisions for the household

1. **The event:** from start-cooking time to the meal, notified at the start and 15 minutes before (recommended), or a short event
   at the meal time with a reminder before it?
2. **The meal time:** one time for the household, 18:30 unless you say otherwise (recommended), or a time per planned day?
3. **Which days:** switched on per day, with ADD THE WEEK (recommended, as the brief says), or every planned day automatically?
4. **Which calendar:** a new **Kitchen** calendar (recommended), or your main calendar?
5. **Which Google account** holds it? (One per household; share the Kitchen calendar with family from Google Calendar.)
6. **Prep ahead:** none of today's recipes has an overnight step, so leave "start the day before" reminders out for now
   (recommended), or add them for recipes that gain one?
7. **DISCONNECT:** removes the app's events (recommended), or leaves them in the calendar?

## 8. As first answered (1 Oct 2026; superseded by §9)

The household's answers, and what they change:

1. **The event is a placeholder at the meal's standard time, 15 minutes long**, not a block from start-cooking time. ("They are
   just place holders, so that's OK.") No cooking time is worked out.
2. **Standard times:** breakfast 07:00, lunch 13:00, dinner 19:00 (`Europe/London`). Kept as settings, so they can change.
3. **Switched on per day, with ADD THE WEEK**, as recommended.
4. **The calendar is called `RecipeWrangler`.**
5. **The account:** the household's own Google account, named in the answer. It is not written here, since this repo is public.
6. **A reminder the evening before, chosen per meal on the Planner.** Its purpose is the freezer: "to remind you to get something
   out of the freezer, and a key feature of the calendar". So the "start the day before" idea is dropped. A meal with its
   reminder on gets one phone notification **at 20:00 the evening before** ("Dinner: Lamb Tagine, tomorrow 19:00"). The 20:00 is a
   setting. Google times a reminder from the event's start, so the app works it out per meal: 23 hours before a 19:00 dinner,
   17 before a 13:00 lunch, 11 before a 07:00 breakfast, all landing on 20:00.
7. **DISCONNECT** was unclear, so it is put plainly in the open points below.

### What this changes

- **A planned day can now hold more than one meal.** Today a planned day is one list of recipes with no meal attached (the brief
  dropped "meal slots in the Planner" in favour of asking the meal when cooking is logged). Standard times need to know which meal
  each planned recipe is. So each recipe on a planned day gets a meal, **dinner unless the recipe's course is Breakfast**, changed
  with a small picker on the Planner row. Recipes on the same day and meal make one event: `Dinner: Lamb Tagine + Rice`.
- **Two switches per meal on the Planner:** IN CALENDAR (with ADD THE WEEK), and REMIND THE EVENING BEFORE (only offered once the
  meal is in the calendar).
- **The migration** gains `planner_days.meals` (one per recipe, parallel to `recipe_ids` and `servings`, as `servings` is) and the
  reminder choice per meal; `household_settings` gains the three meal times and the reminder time instead of one meal time.
- **The events:** one per day and meal that is switched on, with an id worked out from the household, the date and the meal.

### Still open

1. **The meal a recipe is planned as:** dinner unless its course is Breakfast, changeable on the Planner (recommended)? Or always
   ask when it is planned?
2. **DISCONNECT** (the button in Settings that stops the app using your Google Calendar, for example if you ever want to switch the
   feature off): should it also **delete the RecipeWrangler calendar and every meal the app put in it** (recommended: it is the
   app's own calendar, so nothing of yours is lost), or **leave the calendar and its events** where they are, frozen as they were?


## 9. As finally answered (1 Oct 2026): the design being built

Later on 1 Oct the household simplified the answers above: *"this calendar is purely for the reminders. And it in no way is
intended to serve as a food diary … it could simply be an all day calendar event, with a reminder the previous day at 8 p.m."*
On DISCONNECT: *"leave the calendar and meals where they are"*. So:

- **One all-day event per planned day that is switched on**, titled with that day's recipes ("Invented Bean Hotpot + Pretend
  Flatbreads"); the description lists each with its servings and links to the app. **No meal times, no breakfast, lunch or
  dinner, and nothing stored per planned recipe**: §8's `meals` column, the three meal times and both of §8's open points go.
  The event is "free", not "busy", so it never blocks the household's time in a shared calendar.
- **Two switches per day on the Planner:** IN CALENDAR (with **ADD THE WEEK** on each week), and, once that is on, **REMIND ME**:
  one phone notification at **20:00 the evening before**, chiefly for the freezer. 20:00 is a setting for the whole household.
  Google times reminders back from the event's start, and an all-day event starts at 00:00, so 20:00 the evening before is
  240 minutes before. A day with REMIND ME off carries no reminder at all, not the calendar's default.
- **The calendar is `RecipeWrangler`**, made by the app in the household's Google account on the first connection. The account is
  named in chat, not here: this repo is public.
- **DISCONNECT** tells Google to revoke the connection and forgets it here. **The RecipeWrangler calendar and its events stay
  where they are**; connecting again carries on with the same calendar.
- **What reaches the calendar:** switching a day on or off; changing its recipes or servings; marking it away (its event goes);
  ADD THE WEEK; a recipe's title edited, for its days to come; and SYNC NOW in Settings, which brings every day from today into
  step and removes any of the app's events that no longer match. Past days are never rewritten.
- **The food diary needs no replanning.** The diary (`recipe_logs`) records what *was* cooked, when it is logged; the calendar
  shows what *will* be cooked, from the Planner. Neither reads or writes the other's data, and the after-cooking prompt is
  unchanged. A future food-diary feature reads the diary, not the calendar.

### How it is built

| PR | What | Before merging |
| --- | --- | --- |
| 1 | `docs/migrations/add-calendar-push.md`: `planner_days.calendar` and `calendar_remind`, `household_settings.calendar_remind_at` (default 20:00), a `calendar_connections` status row the household can read but not write, the one-time consent values in `private`, and five service-role-only functions that keep the Google token in **Vault**. Two Edge Functions, `calendar-auth` (CONNECT, Google's callback, DISCONNECT) and `calendar-sync` (a list of days, or every day from today). `test/calendar-push.js` lifts their pure parts from the real source | The household's setup, §10 |
| 2 | The app: the Planner's switches and ADD THE WEEK, Settings → App → CALENDAR (CONNECT, REMIND AT, SYNC NOW, DISCONNECT), a sync queued after each Planner change to a switched-on day, through the write queue so it waits and retries offline. Before the migration it shows nothing and sends nothing new | PR 1's SQL applied |
| 3 | Docs, after the tablet and phone pass (`docs/TEST-PLAN.md` step 40a) | |

What the functions do, in brief: the event's id is worked out from the household and the date, so the function needs no table of
events and a retry cannot make a second one. A day is written by inserting with that id; if Google already has it (409, a live
event or one deleted earlier), it is replaced with its status set back to confirmed. Deleting an event Google has already lost
(404, 410) counts as done. The function always reads the day from the database, never from what the browser sends. If Google stops
accepting the connection, the status row says so in words and the app offers CONNECT again.

### Still to be seen on the real thing (step 40a)

None of this can be tested from a session: there is no Google account here. The functions were run under Deno with Google and
Supabase faked, and their pure parts are tested in Node; the first real event is the household's. To confirm there:

1. Google offers `calendar.app.created` at setup (§5). If not, set the secret `GOOGLE_CALENDAR_SCOPE` to
   `https://www.googleapis.com/auth/calendar` (no code change).
2. A REMIND ME day's notification arrives on the phone at 20:00 the evening before.
3. A day switched off and on again brings its event back (Google keeps deleted ids; the function replaces with status confirmed).

## 10. The household's setup for PR 1, in order

All in the household's own accounts; a session cannot do any of it and never sees the client secret.

1. **Google Cloud console**, signed in as the Google account that will hold the calendar: new project **RecipeWrangler**; APIs &
   Services → Library → **Google Calendar API** → Enable.
2. **OAuth consent screen** (Google Auth platform → Branding / Audience / Data access): External; app name RecipeWrangler; your
   email as support and developer contact. Data access → Add scopes: `…/auth/calendar.app.created` (shown as "Make secondary
   Google calendars, and see, create, change, and delete events on them"), plus `openid` and `email`. *(Since 10 Oct 2026 also
   `…/auth/drive.file`, and the Google Drive API enabled, for the weekly Drive backup: `docs/PLAN-DRIVE-BACKUP.md` §4.)* If `calendar.app.created`
   is not in the list, use `…/auth/calendar` and see §9, point 1. Audience → **Publish app** ("In production"). Left in Testing,
   Google expires the connection after seven days.
3. **Clients → Create client:** Web application, name RecipeWrangler; Authorised redirect URI exactly
   `https://mhkayefzrtceesgizkjs.supabase.co/functions/v1/calendar-auth/callback`. No JavaScript origins are needed. Copy the
   client ID and client secret straight into step 4.
4. **Supabase dashboard → Edge Functions → Secrets:** add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **SQL editor:** paste and run `docs/migrations/add-calendar-push.md`, the whole statement, once; then its "After it is applied"
   queries, or ask a session to run them.
6. **Deploy the two functions** from their raw GitHub URLs on this PR's branch (or `main` after merging):
   - `calendar-sync`: **Verify JWT on**, like the other three.
   - `calendar-auth`: **Verify JWT OFF.** Google's callback carries no Supabase sign-in; the function checks the sign-in itself on
     everything else, and the callback is guarded by the one-time value.
7. Merge PR 1. Nothing visible changes until PR 2; then CONNECT in Settings, click through "Google hasn't verified this app"
   (Advanced → Go to RecipeWrangler) once, and allow.

## 11. Two automatic toggles (asked for and answered 9 Oct 2026)

With the calendar connected and in use, the household asked not to have to switch each day on by hand. Two toggles in
**Settings → App → CALENDAR**, under REMIND AT, shown only while connected:

- **AUTOMATICALLY ADD TO CALENDAR:** "Each day you plan goes into the calendar." A day goes in when a recipe is put on it.
- **AUTOMATICALLY REMIND ME FOR MAIN MEALS:** "Days with a Main course get the evening-before reminder." A day with a Main-course
  recipe gets REMIND ME.

The household's answers, 9 Oct:

- **Main meals** are recipes whose own course tag is Main (`tags.course`): 18 of the 34 recipes that day (read-only, 18:59 UTC).
- **Switching a toggle on also sweeps upcoming days**, from today, once: each planned day it applies to is switched on, then one
  call brings the calendar into step. Past days and days marked away are never touched.
- **The reminder toggle on its own also puts a main-meal day in the calendar**, since a reminder needs an event.
- **The toggles only ever switch on**, and only at two moments: a recipe put on a day, and a toggle switched on. Switching a toggle
  off changes no day. A day switched off by hand stays off until a recipe is next added to it, and the Planner's own buttons work
  as before.
- **The setting belongs to the household**, not the device: two columns on `household_settings`,
  `docs/migrations/add-calendar-auto.md`. Before they exist the toggles stay hidden, so the app's PR is safe to merge either way.
- **Only while connected.** A day reaches the calendar only then; a toggle is not shown while disconnected, and a preference
  already set flags nothing until the household connects again (then a recipe added, or the toggle switched off and on, applies it).

How it is built: the rules live in one place, `addPlanRecipe`, which both the recipe picker and the shortlist use; the day is then
saved and synced as any other. The sweep writes only the days whose switches change, then makes one `calendar-sync` call. Tablet
and phone step 40b.


## 12. A reminder per meal, not per day (proposed and agreed 20 Oct 2026)

**Status: agreed (§12.11); built in two PRs (§12.12); the household's steps are C1 and 75a in `docs/HOUSEHOLD-JOBS.md`.** Written from the code as it stands on 20 Oct 2026 (version
2026-10-20.6), not from §9, which it corrects in one place (§12.1).

### 12.1 The brief, and what is there now

On 20 Oct, looking at the Planner with the calendar connected, the household saw IN CALENDAR once for a day with a breakfast and a
dinner on it, and said that *"for a given day you may want a reminder for one of the planned meals (say dinner) but not another"*,
and then that ***grouped meals should have one reminder***. Both are right, and neither can be done today:

- **One pair of switches per day.** `planner_days.calendar` and `calendar_remind` are booleans on the day's row; on the plan entry
  they are `calendar` and `remind`, present only while true (`isCalendarDay`, `withCalendarFlags`, `keepCalendarFlags`). Nothing is
  kept per dish. (§9 says "nothing stored per planned recipe": that was the decision, and this section is the first to reopen it.)
- **One event per switched-on day** (`eventForDay` in `calendar-sync`): the day's recipes joined with " + " as the title, one line
  each in the description with its servings and "(from the freezer)" for a PRE-MADE one, transparent, and a single popup at REMIND AT
  the evening before when `calendar_remind` is true, none otherwise. Its id is `meal` + the household's hex + the date's digits, so a
  day has exactly one (`calendarEventId`, `dateFromEventId`); SYNC NOW deletes any of ours the plan no longer wants.
- **The automatic toggle works per day too** (§11, `applyCalendarAuto`): a day with a Main-course dish or any PRE-MADE one gets REMIND
  ME when a dish is put on it. So a day with a breakfast and a Main reminds about both.
- **`calendar-sync` does not read `meal_groups`.** It reads `planner_days`, the recipes' titles, `household_settings` and
  `calendar_connections`. A group (two or more dishes cooked together on a day) is invisible to it.
- **The shape a per-dish setting already has.** `servings` and `premade` are arrays beside `recipe_ids`, one slot per dish in the
  same order, padded when read, spliced together when a dish is removed (`planServings`, `planPremade`, `removePlanRecipeAt`), each
  introduced by a migration page (`docs/migrations/add-premade.md`).

### 12.2 The idea: the unit is the meal

A **meal** is a group (its dishes are cooked and eaten together, so they are one reminder) or a dish that is in no group. A day has
one or more meals. IN CALENDAR and REMIND ME become settings of a meal. A day with a single meal, which is most days and every day with
one group, looks and behaves exactly as it does now.

### 12.3 The data

One more array beside `premade`: **`planner_days.calendar_items text[] not null default '{}'`**, one slot per dish: `''` (not in the
calendar), `'in'` (in the calendar) or `'remind'` (in, with the reminder: REMIND ME still needs IN CALENDAR, as now). Padded on
reading like `premade`, so an older tab that writes only `recipe_ids` reads back as a day with nothing switched on in the array. On
the plan entry it is `calendarItems`, present only while some dish is on, so an ordinary day keeps the shape it always had.

- **The day-level `calendar` and `calendar_remind` columns stay**, written as "some dish is in" and "some dish is reminded". The
  deployed `calendar-sync`, a stale tab, an export and a restore all keep making sense. They can be dropped in a later clean-up.
- **Existing days need no data move.** A day whose `calendar_items` is empty but whose `calendar` is true reads as every dish in, and
  every dish reminded if `calendar_remind` is true. The first save of the day writes the array.
- **A group has one state.** The app keeps every member of a group equal (§12.5). `calendar-sync` does not trust that: it reads
  `meal_groups` for the dates it is syncing (one more select) and treats a group's state as the strongest of its members' ('remind'
  over 'in' over off), so a group made or changed on another device, or by a stale tab, still gets one reminder.

### 12.4 The events

Each switched-on day has **at most two events**: one for the meals that have the reminder, one for those that are in the calendar
without it.

- **Reminded:** the title is its dishes joined with " + ", and it has the popup at REMIND ME the evening before. The popup on the phone
  therefore names the dishes it is about, which is the point of the freezer reminder.
- **Not reminded:** the other switched-on dishes, no reminder at all (as now, not the calendar's default).
- **A group is never split across the two**, by construction. A day with no reminders, or with every dish reminded, is **one event with
  the same title and text as today**: only a day that differs gets two.
- **Ids:** `meal…date` plus a suffix, `r` for the reminded event and `n` for the other (both inside Google's a–v, 0–9). The old plain
  id is retired: `dateFromEventId` learns the suffix, and `syncActions` wants up to two ids a date, writes those, and deletes the
  other one and any old plain one. SYNC NOW does that for every day from today (§12.8 step 4), and any later sync of a day does it for
  that day.
- **What was rejected: one event per dish.** It puts five entries on a busy day, doubles the Google calls, and goes against §9, where the
  household chose one event a day. This keeps the calendar as it reads now and still lets the reminder name only what it is for.

### 12.5 The Planner

Measured on the household's real plan (landscape tablet, dark, calendar on, as in the screenshot of 20 Oct) by a mock-up in a scratch
page (in the working folder, not in the repository), run again on 20 Oct against the same plan without the pills for the "before"
figures.

- **A day with one meal: nothing changes.** The strip at the end of the day keeps IN CALENDAR and REMIND ME 20:00 THE EVENING BEFORE;
  with one meal, its REMIND ME is that meal's. That is every day with one dish, and every day whose dishes are all one group.
- **A day with two or more meals** (a group and a loose dish, or two loose dishes, such as a breakfast and a Main)
  **gets a REMIND ME 20:00 pill on each meal**: on a loose dish's own line, after its other pills; on a group's GROUPED bar, beside
  UNGROUP. The strip then keeps IN CALENDAR for the whole day. The pill's text is short; "the evening before" is in Settings, in the
  guide and in the event itself. A tap switches that meal's reminder; IN CALENDAR off clears every reminder on the day, as it does now.
- **Cost, measured:** with the shortlist open the one two-meal day grows by 62px (the list from 1,479px to 1,541px; still five whole
  days on the screen) because that day's two names have 313px and 319px instead of 421px and 474px and wrap to a second line; with the
  shortlist folded nothing grows (the list stays 1,459px). A mock-up also showed the × falling onto a line of its own on the longest such
  line: **the build must keep the × beside the name.** Days with a single meal are untouched.
- **The GROUPED bar is a `<button>` today** (`data-action="viewGroup"`) with UNGROUP, a `<span data-action="ungroup">`, inside it. A pill is a
  third control and cannot sit inside a button, so **the build turns the bar into a `<div>` holding the view area, the pill and UNGROUP as
  separate controls**, each reaching 44px. (The mock-up's tap scan already reports UNGROUP's upper reach as missing, with the pills and
  without them: the span's own box is short and the point lands on the bar. That is how it is now; the rebuilt bar should settle it.)
- **The group rule in the app.** Switching a reminder on a group switches all its members. Putting dishes in a group that differ takes
  the strongest state; adding a side to a group (the SERVE WITH and OFTEN WITH + buttons) gives it the group's; UNGROUP leaves each
  member as it was. Each of those is one more write to the day's row, queued with the group's own write, and one `calendar-sync`.
- **The automatic toggles, per meal.** AUTOMATICALLY ADD TO CALENDAR switches every meal of a day in. AUTOMATICALLY REMIND ME FOR MAIN
  MEALS gives REMIND ME to a meal that has a Main-course dish or a PRE-MADE one, not to the whole day. Switching on only, at the same
  two moments as now (a dish put on a day; the toggle switched on, which sweeps upcoming days).
- **Considered and left for later:** an IN CALENDAR pill on each meal as well (wider, and the household asked about reminders); a
  small chooser dialog from the strip (a dialog to build and test, and one more tap on every multi-meal day).

### 12.6 What changes, and what does not

**Changes:** `index.html` (hydrate reads the column, with a probe like `premadeAvailable`; `calendarColumns`, `savePlanDay` and
`pushPlan` name it only once it is there; `withCalendarFlags`, `keepCalendarFlags`, `isCalendarDay`, `setPlanCalendar`,
`setPlanRemind`, `addWeekToCalendar`, `applyCalendarAuto` and the sweep; the array kept in lockstep in `addPlanRecipe`,
`setPlanServingsAt`, `setPlanPremadeAt` and `removePlanRecipeAt`; the group functions; the Planner's strip, the new pills and the GROUPED bar rebuilt as in §12.5;
export and restore carry `calendarItems`; UNDO for the × already restores the whole entry, so it needs nothing but a check);
`supabase/functions/calendar-sync` (the event for a day becomes up to two, the ids, the group read); a migration page
`docs/migrations/add-calendar-items.md`; `docs/INFRASTRUCTURE.md`; the guide and the job list.
**Does not change:** the connection, REMIND AT, SYNC NOW, DISCONNECT, the 20:00 default, the all-day transparent event, the food
diary, or any day with one meal.

### 12.7 Tests

`test/calendar-push.js`, which lifts `calendar-sync`'s pure code from the real source, gains: the suffixed ids and that they stay in
a–v and 0–9; a day split into a reminded and an unreminded event, and a day that is all one stays one event with today's title and
text; a group never split, and a group whose stored members disagree resolved to the strongest; an old row with an empty
`calendar_items` read as the day's flags; the old plain id deleted. `test/smoke.js`, with the calendar on (the checks added on 20 Oct
for the Planner already run so): the pills on a two-meal day and none on a one-meal day; a group's one pill; every button 44px to tap;
UNDO bringing back the array; the day-level columns written as "some". Each new check seen to fail once, as always.

### 12.8 The order, and what the household does

1. **Apply the migration** (a markdown page, applied from the dashboard's SQL editor, `add column calendar_items text[] not null
   default '{}'`; nothing else). First, as for any schema change (`CLAUDE.md`).
2. **Merge the app.** Safe before step 3: it keeps writing `calendar` and `calendar_remind` as "some", so the function deployed now
   carries on exactly as it does (one event a day, a reminder if any meal has one). Until step 3 a reminder on one meal reminds for
   the whole day's event.
3. **Deploy the new `calendar-sync`** by pasting the file from its raw GitHub URL; it reads rows with and without the array.
4. **Press SYNC NOW once** (Settings → App → CALENDAR). Every day from today is rewritten under the new ids and the old ones removed; a
   day with all its dishes reminded, or none, comes out as one event as before.
5. `docs/INFRASTRUCTURE.md` records the migration and the deploy, with how each was checked (`CLAUDE.md`).

Two PRs: the migration page and the function with their tests (the household applies, then deploys), then the app. A session does neither.

### 12.9 Risks

- **A stale tab** that saves a day without the array leaves the column as it was (an upsert that omits a column keeps it) while its
  recipes change: the array can then be shorter or longer than the dish list. Reading pads or truncates it, as it does `servings`.
- **Google keeps deleted events as "cancelled"** under their id; the function already revives or replaces on a 409, and the new ids
  are new. A phone may show a changed event once at the next sync; a reminder for tonight survives, because the new event carries
  the same reminder time.
- **Two events on a mixed day** is the one visible change in the calendar. It is the point of the feature.

### 12.10 Questions for the household (each with a recommendation)

1. **The events.** At most two a day, reminded and not (**recommended**); one per dish; or keep one a day and put the reminder on it if
   any meal has one?
2. **First build.** A reminder per meal and IN CALENDAR still per day (**recommended**), or IN CALENDAR per meal as well?
3. **Existing days.** Every dish takes the day's state as it is (**recommended**), or start with every reminder off?
4. **Dishes with different states put in one group.** The group takes the stronger state, so a reminder is never lost (**recommended**).
5. **The automatic rule.** Per meal (**recommended**), or keep it per day?
6. **The pill's words.** "REMIND ME 20:00" on a meal, the full "THE EVENING BEFORE" staying on the day's strip and in Settings and the
   guide (**recommended**), or the full words on every pill (wider)?

### 12.11 The household's answers (20 Oct 2026)

"Go with the recommendations on all six." So:

1. **Events:** at most two a day, one for the meals with the reminder and one for those without (§12.4).
2. **First build:** a reminder per meal; IN CALENDAR stays per day.
3. **Existing days:** every dish takes its day's state as it is (no data move; §12.3).
4. **Dishes with different states put in one group:** the group takes the strongest, so a reminder is never lost.
5. **The automatic rule:** per meal (§12.5).
6. **The pill:** "REMIND ME 20:00" on a meal; the full words stay on the day's strip, in Settings and in the guide.

### 12.12 What is built, and when

- **PR A (20 Oct 2026): the function, its tests and the migration page.** `calendar-sync` writes up to two events a day under the new
  ids (`…r` with the reminder, `…n` without), deletes the retired plain id, resolves a group to its strongest member (reading
  `meal_groups` for the same days), and falls back to the day's two flags when no dish is marked, so it is correct beside the old
  app and the new one, before or after the SQL. `test/calendar-push.js` went from 39 to 62 checks; each new check was seen to
  fail by breaking the code it guards, 18 breakages in all. `docs/migrations/add-calendar-items.md` was run on a scratch
  Postgres 16 (applied as a non-superuser owner, the checks, the undo); **not** applied to the live project, which is the
  household's. `docs/INFRASTRUCTURE.md` lists both as waiting. **Not verified:** the function against Google, which can only be
  seen on the phones (steps in `docs/HOUSEHOLD-JOBS.md` once the app's PR is in).
- **PR B (20 Oct 2026, app 2026-10-20.7): the app.** `planner_days.calendar_items` is read (a one-column probe, like `premade`'s) and written with
  every day save and every restore once the column exists, and never before: until then the Planner is as it was, one pair of switches a day. A day's
  entry keeps `calendarItems` beside `recipeIds`, `servings` and `premade`, one of `''` / `'in'` / `'remind'` a dish, spliced in lockstep when a dish is
  put on or taken off or a recipe deleted; `calendar` and `remind` stay as "some dish is in / has the reminder" and are what the deployed function reads.
  A day with two or more meals has REMIND ME 20:00 on each (a group's on its bar, which is now three controls and no longer a button holding a span);
  IN CALENDAR is still the day's. A dish added to a day in the calendar joins without a reminder; a side put with its main takes the main's state; grouping
  takes the strongest; UNGROUP changes nothing; the automatic reminder looks at the meal of the dish just put on, not the whole day. The × moved into its
  dish's group of pills so it cannot stand alone on a line. Decisions D70 to D72 in `docs/PLAN-MODERNIST.md`; the household's steps are 75a. *Measured on
  the real plan, after:* the one two-meal day is 62px taller with the shortlist open (the list 1,463px to 1,525px, five whole days either way) and no
  taller with it folded. **Not verified:** the tablet, Google, or the live database; nothing of this has run against them.
