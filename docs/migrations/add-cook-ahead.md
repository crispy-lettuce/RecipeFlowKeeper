# Migration: COOK AHEAD (`planner_days.cook_ahead`, `recipe_logs.cook_ahead`)

For issue #221 (30 Oct 2026). Two columns: which planned dishes are cooked today to be eaten another day, and which log
rows are cooking that is not a meal. DDL only, no data.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo.)*

**Applied** by the household from the dashboard's SQL editor, on a date nobody wrote down (after 30 Oct 2026, when this page was written, and before 1 Nov).
**Checked read-only on 1 Nov 2026** against the live project: both columns as the first check below expects, 0 of 158 log rows cook-ahead, and the constraint
present. Recorded in `docs/INFRASTRUCTURE.md` §3. Before that it was tested on 30 Oct 2026 on a scratch Postgres 16.15, with `planner_days` and `recipe_logs`
cut down to the columns that matter here (`premade` already in) and owned by a superuser rather than the live `postgres` role, so
ownership and policies were not exercised. The statement and the undo were run exactly as written on this page. It applies; an
existing day reads `cook_ahead = '{}'` and an existing log row `false`; an insert that does not name either column gets those
defaults; a day can store `'{t}'`; a log row can be `cook_ahead` alone; a row with `premade` and `cook_ahead` both true is refused
by the constraint; the check queries below give what they say; the undo removes both columns and the constraint.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries the app's side.** A session
does not apply it (`CLAUDE.md`).

Merging the app first would also be safe: until the columns exist the Planner offers no COOK AHEAD, and no save names either column
(the app asks the database whether `planner_days.cook_ahead` is there, as it does for `premade`, and a failed question means "not
yet", never a sign-out). The order above is still the one to use, so that the first tap of COOK AHEAD works.

Nothing else moves with it: `calendar-sync` reads `planner_days` with `select('*')` and looks only at `premade`, so it needs no
redeploy and a cook-ahead dish is listed on its day like any dish to be cooked.

## The statement

```sql
begin;

-- Per planned item, parallel to recipe_ids, servings and premade: true for a dish cooked on that day to be eaten on another.
-- Default empty, so every existing day and every save from a tab that does not know the column reads as nothing cooked ahead.
alter table public.planner_days add column cook_ahead boolean[] not null default '{}';

-- A log row that is cooking but not a meal: it counts in the recipe's history (last cooked, times cooked, the streak, STATS)
-- and is left out of the food diary. False for every row there is today, so all existing history stays as it is.
alter table public.recipe_logs add column cook_ahead boolean not null default false;

-- A row is cooked ahead or eaten from the freezer, never both. The app never writes both; this stops another writer doing so.
alter table public.recipe_logs add constraint recipe_logs_not_premade_and_cook_ahead check (not (premade and cook_ahead));

commit;
```

## Why each part is there

- **`planner_days.cook_ahead` as an array beside `recipe_ids`:** the day already keeps `servings` and `premade` that way, one slot per
  item in the same order, so a day can hold the same recipe twice and each keeps its own setting. The app pads it to the length of
  `recipe_ids` when it reads, as it pads `servings`.
- **A separate column, not a new value in `premade`:** `calendar-sync` reads any non-empty `premade` slot as "from the freezer" and
  says so on the calendar event. A value such as `'ahead'` there would mislabel the event and need the function redeployed.
- **`recipe_logs.cook_ahead`:** the one difference between cooking a dish for a meal and cooking it for later. The app builds each
  recipe's history from `recipe_logs` including these rows, and leaves them out of the History calendar, the day detail and the diary
  CSV.
- **The check constraint:** `premade` and `cook_ahead` on one row would mean "eaten and not eaten"; the history rule treats `premade`
  as not cooking and `cook_ahead` as cooking, so the two together would contradict.
- **No new policy or grant:** both tables' existing household policies cover new columns.

## After it is applied

```sql
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and column_name = 'cook_ahead' order by 1;
-- expect: planner_days | cook_ahead | ARRAY   | NO | '{}'::boolean[]
--         recipe_logs  | cook_ahead | boolean | NO | false
select count(*) filter (where cook_ahead) as cook_ahead_logs, count(*) as all_logs from public.recipe_logs;
-- expect cook_ahead_logs 0 until a dish is cooked ahead
select conname from pg_constraint where conname = 'recipe_logs_not_premade_and_cook_ahead';
-- expect one row
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note.

## To undo

Put the app back first if its side has been merged. Cook-ahead log rows then read as ordinary cooked meals and appear in the History
calendar.

```sql
begin;
alter table public.recipe_logs drop constraint recipe_logs_not_premade_and_cook_ahead;
alter table public.recipe_logs drop column cook_ahead;
alter table public.planner_days drop column cook_ahead;
commit;
```
