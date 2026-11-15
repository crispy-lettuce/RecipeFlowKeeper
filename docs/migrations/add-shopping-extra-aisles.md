# Migration: `shopping_extra_aisles`

For issue #241, slice 3 of `docs/PLAN-SHOPPING-EXTRAS.md` (15 Nov 2026): the aisle an added item was given, remembered for its
name on every device of the household, so it is filled in the next time that name is typed.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that
looks like a data dump may be committed to this public repo. It carries DDL only and no data.)*

**Not applied yet.** Read-only on 15 Nov 2026 at 21:58 UTC: `to_regclass('public.shopping_extra_aisles')` was null on the live database.

## Who and when

**The household applies this, from the Supabase dashboard's SQL editor, before merging the PR that carries it.** A session
does not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first).

## The statement

Drafted from the live `aisle_overrides` table (read-only, 15 Nov 2026): the same foreign key, the same unique key on the
household and the name, and the same four policies, each `TO authenticated` and each on `private.household_ids_for_user()`.

```sql
create table public.shopping_extra_aisles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  label text not null,
  aisle text not null,
  created_at timestamptz not null default now(),
  constraint shopping_extra_aisles_household_id_name_key unique (household_id, name)
);
alter table public.shopping_extra_aisles enable row level security;
create policy "select own household" on public.shopping_extra_aisles for select to authenticated
  using (household_id in (select private.household_ids_for_user()));
create policy "insert own household" on public.shopping_extra_aisles for insert to authenticated
  with check (household_id in (select private.household_ids_for_user()));
create policy "update own household" on public.shopping_extra_aisles for update to authenticated
  using (household_id in (select private.household_ids_for_user()))
  with check (household_id in (select private.household_ids_for_user()));
create policy "delete own household" on public.shopping_extra_aisles for delete to authenticated
  using (household_id in (select private.household_ids_for_user()));
revoke all on table public.shopping_extra_aisles from anon;
```

## Why each part is there

- **`name` is the name's key** (trimmed, in small letters), and **`label` the name as it was last typed**, which is what the name
  box offers.
- **Unique on `(household_id, name)`:** one remembered aisle per name, and what the app's upsert resolves on. It also serves as
  the index on `household_id`.
- **No CHECK on `aisle`.** The app offers the food aisles, Household, Health & Toiletries, Pets and Other, and leaves out a row
  with any other value when it reads; a CHECK would need a migration whenever an aisle is added.
- **A table of its own, not `aisle_overrides`.** That table moves a recipe's row on the shopping list and holds only food
  aisles. Remembering where an added item went must not move a recipe's row by itself.
- **`revoke all … from anon`** keeps this table like the others.

## Why it is safe to apply first

A new, empty table that the app live today never reads. Nothing else changes.

## If the PR is merged first

Nothing breaks. The app reads this table apart from the others and **does not sign anyone out when it is missing**: items are
added as before, nothing is remembered, nothing is written here, and EXPORT DATA leaves the key out. Apply the statement and
reload; the next load finds the table.

## After it is applied

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'shopping_extra_aisles' order by ordinal_position;
-- expect: id uuid NO · household_id uuid NO · name text NO · label text NO · aisle text NO · created_at timestamptz NO
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'shopping_extra_aisles';
-- expect four rows, each for {authenticated}
select grantee from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'shopping_extra_aisles' and grantee = 'anon';
-- expect no rows
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

```sql
drop table public.shopping_extra_aisles;
```

This forgets every remembered aisle. Items on the list, and regulars, are in `shopping_extras` and are not affected.
