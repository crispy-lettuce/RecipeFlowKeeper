# Migration: the automatic calendar toggles (`household_settings.calendar_auto`, `calendar_auto_remind`)

For the follow-up to P3 (`docs/PLAN-CALENDAR-PUSH.md` §11, 9 Oct 2026). It adds the two switches in Settings → App → CALENDAR
that save the household switching each day on by hand: AUTOMATICALLY ADD TO CALENDAR and AUTOMATICALLY REMIND ME FOR MAIN MEALS.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo. It carries DDL only and no data.)*

**Not applied yet.**

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries it.** A session does
not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first). Paste the whole statement below and run it
once. It is one transaction, so a failure part-way leaves nothing behind.

## The statement

Drafted from the live schema on 9 Oct 2026 (read-only, 18:59 UTC): `household_settings` has `household_id`, `week_start_day`,
`dark_mode`, `calendar_remind_at` and `updated_at`, and nothing called `calendar_auto`.

```sql
begin;

-- Settings → App → CALENDAR's two automatic toggles, one pair per household. Off until switched on.
alter table public.household_settings
  add column calendar_auto boolean not null default false,
  add column calendar_auto_remind boolean not null default false;

commit;
```

## Why each part is there

- **On `household_settings`, not on the device:** the tablet and the phones share one plan and one calendar, so whether a planned
  day goes into the calendar by itself is the household's choice, like `calendar_remind_at` beside it.
- **`not null default false`:** the household's row reads "off" for both the moment it is applied, so nothing changes until a
  toggle is switched on in Settings.
- **No policy or grant:** the columns take the table's existing row-level security and grants. The table has no `anon` grant to
  revoke.

## Why it is safe in either order

- **Applied before the app's PR is merged:** the app live today names only the columns it knows when it saves the settings row,
  so the new ones keep their defaults.
- **The app's PR merged first:** the app reads the settings row with `select('*')` and shows the toggles only when that row
  carries `calendar_auto`. Until then they stay hidden and no settings save names either column.

## After it is applied

```sql
select column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'household_settings' and column_name like 'calendar_auto%'
 order by 1;
-- expect: calendar_auto boolean NO false · calendar_auto_remind boolean NO false
select calendar_auto, calendar_auto_remind from public.household_settings;
-- expect one row: false | false (until switched on in Settings)
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

If the app's PR has been merged, nothing needs putting back first: without the columns the app hides the toggles again. Days the
toggles already switched on stay switched on; they are ordinary days in the calendar, switched off by hand as before.

```sql
begin;
alter table public.household_settings drop column calendar_auto, drop column calendar_auto_remind;
commit;
```

This loses only the two preferences.
