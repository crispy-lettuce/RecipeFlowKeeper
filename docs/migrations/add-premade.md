# Migration: PRE-MADE meals (`planner_days.premade`, `recipe_logs.premade`)

For `docs/PLAN-FOOD-DIARY.md` (10 Oct 2026). Two columns: which planned meals come out of the freezer, and which diary entries
were eaten that way rather than cooked. DDL only, no data.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo.)*

**Applied by the household on 10 Oct 2026**, before PR #78 merged; checked read-only at 20:03 UTC (`docs/INFRASTRUCTURE.md`). Tested before that, on 10 Oct 2026, on a scratch Postgres 16 with the two tables shaped as live and owned by a
non-superuser like the live `postgres`: it applies; an existing day reads `premade = '{}'` and an existing diary row `false`; a day
saved without naming the column (as the app does before this) gets `'{}'`, and a diary row `false`; a day can then store
`'{dinner}'`; the check queries give what they say; the undo runs and leaves the tables as they were.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries the app's side, and
before redeploying `calendar-sync`.** A session does not apply it (`CLAUDE.md`). Merging the app first is safe: until the columns
exist the Planner shows no PRE-MADE switch and no save names them. `calendar-sync` reads `planner_days` with `select('*')`, so it
works on either side of this too.

## The statement

```sql
begin;

-- Per planned item, parallel to recipe_ids and servings: '' for a meal cooked fresh, or the meal it is eaten as
-- ('breakfast', 'lunch', 'dinner', 'snack') when it comes out of the freezer. Default empty, so every existing day and
-- every save from a tab that does not know the column reads as all fresh.
alter table public.planner_days add column premade text[] not null default '{}';

-- A diary entry eaten from the freezer rather than cooked: shown in the diary, left out of "last cooked", times cooked and
-- the streak. False for every row there is today, so all existing history stays cooked.
alter table public.recipe_logs add column premade boolean not null default false;

commit;
```

## Why each part is there

- **`planner_days.premade` as an array beside `recipe_ids`:** the day already keeps `servings` that way, one slot per item in
  the same order, so a day can hold the same recipe twice and each keeps its own setting. The app pads it to the length of
  `recipe_ids` when it reads, as it pads `servings`.
- **The meal type in the slot rather than a true/false:** the household asked for the meal to be chosen when PRE-MADE is switched
  on (breakfast, lunch, dinner or snack), and the automatic diary entry uses it. An empty string means fresh.
- **`recipe_logs.premade`:** the one difference between eating a portion from the freezer and cooking the recipe. The app builds
  each recipe's cooking history from `recipe_logs`; it leaves these rows out of it.
- **No new policy or grant:** both tables' existing household policies cover new columns.

## After it is applied

```sql
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and column_name = 'premade' order by 1;
-- expect: planner_days | premade | ARRAY | NO | '{}'::text[]
--         recipe_logs  | premade | boolean | NO | false
select count(*) filter (where premade) as premade_logs, count(*) as all_logs from public.recipe_logs;
-- expect premade_logs 0 until a pre-made day arrives
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note.

## To undo

Put the app back first if its side has been merged. Pre-made diary entries then read as ordinary cooked ones, and count towards
"last cooked" again.

```sql
begin;
alter table public.recipe_logs drop column premade;
alter table public.planner_days drop column premade;
commit;
```
