# Planned meals in Google Calendar (P3)

**Asked for in the original build brief** (`docs/BUILD-BRIEF.md`, P3, and "Calendar reminders" under Architecture): *"A Supabase
Edge Function holds a Google OAuth refresh token, obtained via one one-off consent screen … After that single step, reminders are
created automatically with no further manual action, ever."* and *"Opt-in per entry."* Scoped on 30 Sep 2026 at the household's
request. **Not built**; waiting for the household's answers to §7.

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
  Cloud project offers it, the app uses that and can see nothing else in the account; otherwise `calendar.events`. To be checked
  at setup (§5), not assumed.

## 5. The household's one-off setup (about 20 minutes, before the build is merged)

1. In the Google Cloud console, with the Google account whose calendar will hold the meals: a new project, **Kitchen**; enable the
   **Google Calendar API**.
2. **OAuth consent screen:** External; app name Kitchen; the household's email; the calendar scope (§4, Security). Then
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
