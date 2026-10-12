# Migration: new tables closed to signed-out visitors by default, and a settings row for every household

For the October review's PR 6 (`docs/REVIEW-2026-10-FINDINGS.md`, F35 and F23; 12 Oct 2026).

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo.)*

**Waiting.** Not yet applied.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries it.** A session does
not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first). Paste each statement below and run it.
Running either a second time changes nothing.

## What it changes, and why

**1. New tables are no longer open to signed-out visitors by default (F35).** Read-only on 12 Oct (12:20 UTC): the database's
default privileges in `public` give every new table, sequence and function to `anon` (anyone holding the app's public key,
signed in or not) as well as to `authenticated`. Every migration page since 28 Sep revokes `anon` by hand, and today `anon` can
read nothing in `public`: correct by discipline, not by default. One forgotten line in a future page would leave a new table
readable by anyone. After this, a new table or sequence gives `anon` nothing unless a page grants it, and a forgotten line fails
closed.

- **Only for tables made from the dashboard.** Those are made by the `postgres` role, whose defaults this changes. Supabase's own
  `supabase_admin` role has the same defaults; the dashboard cannot change another role's, and nothing in this app is made by it.
- **Existing tables keep their grants.** It changes what a new object starts with, nothing that exists.
- **Functions still need their own revoke.** Postgres gives every new function to everyone (`PUBLIC`) through a default that
  applies to all schemas, and a rule for one schema can add to that but never take it away. Taking it away for every schema
  would also strip the functions in `private` that the row-level policies call. So this removes `anon`'s own grant on
  functions, and a page that adds a function keeps revoking `execute` from `public` and `anon`, as
  `add-recipe-sharing.md` does.

**2. A settings row for every household (F23).** Read-only on 12 Oct (12:20 UTC): 3 households, **1** with no
`household_settings` row. The app could not tell from a missing row whether the calendar toggles' columns exist, so it hid
them; the app now asks separately, and this gives that household the row every other household has. Every column has a
default (weeks start on Friday, follow the system's light or dark, reminders at 20:00, both automatic toggles off), so the
row is exactly what the household had already. From now on `docs/ONBOARDING.md` makes the row with the household.

## The statements

### 1. Default privileges

```sql
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
```

### 2. A settings row for any household without one

```sql
insert into public.household_settings (household_id)
select h.id from public.households h
where not exists (select 1 from public.household_settings s where s.household_id = h.id)
returning household_id;
```

It returns **one row** today (one per household that had none). Run again, it returns none.

## Checking it, read-only

```sql
select d.defaclobjtype as kind, d.defaclacl::text like '%anon=%' as anon_still_granted
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' and pg_get_userbyid(d.defaclrole) = 'postgres' order by 1;
-- expect three rows (S, f, r), each anon_still_granted = false

select count(*) as households_without_settings from public.households h
where not exists (select 1 from public.household_settings s where s.household_id = h.id);
-- expect 0
```

## Tried first

On the scratch Postgres 17 cluster in the session (12 Oct), restored from the 11 Oct backup, with Supabase's roles imitated:

- **Before:** a new table gave `anon` select, and `pg_default_acl` granted `anon` all three kinds.
- **After part 1:**
  - a new table gave `anon` nothing and `authenticated` what it had;
  - a new sequence gave `anon` nothing;
  - the table made before kept its `anon` grant;
  - a new function was still executable by `anon` through `PUBLIC`, as explained above.
- **Part 1 run twice:** no error and no change.
- **Part 2 on the restored copy:** returned 2 rows (that copy is a day older: two households had none then); run again, 0.
- **The checks:** three `false`, and `0`.
- **The new `ONBOARDING.md` statement:** one household, one owner and one settings row with the defaults; run again, nothing.

## Undo

```sql
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant all on functions to anon;
```

The settings row needs no undo: it holds the defaults the household was already using.
