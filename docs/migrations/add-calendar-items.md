# Migration: a calendar setting per dish (`planner_days.calendar_items`)

For `docs/PLAN-CALENDAR-PUSH.md` §12 (proposed 20 Oct 2026; the household took the recommendation on all six questions the same
day). One column: which of a day's dishes are in the calendar, and which of those have the evening-before reminder. DDL only, no
data.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo.)*

**Applied by the household on 20 Oct 2026** (the time was not read; the column was there at about 19:10 UTC). Checked read-only at about 19:10 UTC: `planner_days | calendar_items | ARRAY | NO | '{}'::text[]`, and no day had a dish marked yet
(`docs/INFRASTRUCTURE.md`).

Tested on 20 Oct 2026 on a scratch Postgres 16.15 with `planner_days` shaped as live and owned by a role that is not a
superuser, like the live `postgres`: it applies; an existing day (calendar on, reminder on) reads `calendar_items = '{}'`; a day
saved without naming the column, as the app does before this, gets `'{}'`; a day can then store `'{remind,in}'`; the check
queries below give what they say; the undo runs and leaves the table with the columns it had.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries the app's side.** A
session does not apply it (`CLAUDE.md`). Paste the whole statement below and run it once. It is one transaction, so a failure
part-way leaves nothing behind.

## The statement

```sql
begin;

-- Per planned dish, parallel to recipe_ids, servings and premade: '' for a dish that is not in the calendar, 'in' for one that
-- is, 'remind' for one that is with the reminder the evening before. Default empty, so every existing day and every save from a
-- tab that does not know the column reads as "no dish marked": calendar-sync and the app then fall back to the day's own
-- calendar and calendar_remind, which is what those days have meant until now.
alter table public.planner_days add column calendar_items text[] not null default '{}';

commit;
```

## Why each part is there

- **An array beside `recipe_ids`:** the day already keeps `servings` and `premade` that way, one slot per dish in the same
  order, so a day can hold the same recipe twice and each keeps its own setting. The app pads it to the length of `recipe_ids`
  when it reads, as it pads those two.
- **The state in the slot rather than two true/false arrays:** a dish is out of the calendar, in it, or in it with the
  reminder, and a reminder without being in the calendar means nothing. One text value says that and cannot say the other.
- **No data move:** `planner_days.calendar` and `calendar_remind` stay, and the app keeps writing them as "some dish is in the
  calendar" and "some dish has the reminder". An existing day with an empty array is read as every dish at the day's own state.
  The first save of that day writes the array.
- **No new policy or grant:** the table's existing household policy covers a new column.

## Why it is safe in either order

- **Applied before the app's PR is merged:** the app live today names only the columns it knows when it saves a day, so the new
  one keeps its default `'{}'`. `calendar-sync` reads `planner_days` with `select('*')` and works with or without it.
- **The app's PR merged first:** the app asks the database whether the column exists (a read of the one column, apart from the
  main load, like the `premade` probe) and, until it does, shows the Planner's calendar strip as it is now, one pair of switches
  a day, and never names `calendar_items` in a save. **That is why the order may be reversed here** (`CLAUDE.md`).
- **The deployed `calendar-sync` before or after:** the old one ignores the column and writes one event a day, with the reminder
  if any dish has it. The new one reads it. Press SYNC NOW once after deploying the new one (Settings → App → CALENDAR) to move
  the calendar to the new event ids.

## After it is applied

```sql
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and column_name = 'calendar_items';
-- expect: planner_days | calendar_items | ARRAY | NO | '{}'::text[]
select count(*) filter (where cardinality(calendar_items) > 0) as days_with_items, count(*) as days from public.planner_days;
-- expect days_with_items 0 until a day is set per dish in the Planner
```

Then record it in `docs/INFRASTRUCTURE.md` and remove the "waiting" note.

## To undo

Put the app back first if its side has been merged (the app only names the column once it exists, so leaving it merged is also
safe: the probe finds the column gone and the Planner shows the single strip again). Per-dish settings are lost; each day keeps
`calendar` and `calendar_remind`, which say "some dish", so a day that had a reminder on one dish reads as every dish reminded.

```sql
begin;
alter table public.planner_days drop column calendar_items;
commit;
```
