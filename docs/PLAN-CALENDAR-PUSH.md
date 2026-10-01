# Planned meals in Google Calendar (P3)

**Asked for in the original build brief** (`docs/BUILD-BRIEF.md`, P3, and "Calendar reminders" under Architecture): *"A Supabase
Edge Function holds a Google OAuth refresh token, obtained via one one-off consent screen … After that single step, reminders are
created automatically with no further manual action, ever."* and *"Opt-in per entry."* Scoped on 30 Sep 2026 at the household's
request; **the household answered §7 on 1 Oct 2026**, then simplified their answers the same day: **§9 is the design being built and
supersedes §4 and §8 wherever they differ.** §10 is the household's setup. **PR 1 (the migration and the two Edge Functions) is
built; the app (PR 2) is not.**

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
   Google calendars, and see, create, change, and delete events on them"), plus `openid` and `email`. If `calendar.app.created`
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
