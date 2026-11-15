# Migration: `shopping_extras`

For issue #241, slice 1 of `docs/PLAN-SHOPPING-EXTRAS.md` (15 Nov 2026): things to buy that no recipe asks for, typed on the
Shopping screen with **ADD AN ITEM**.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that
looks like a data dump may be committed to this public repo. It carries DDL only and no data.)*

**Applied, 15 Nov 2026,** by the household from the SQL editor. Checked read-only at 20:14 UTC: the eight columns with their defaults, RLS on, the four `TO authenticated`
policies on `private.household_ids_for_user()`, the primary key, the foreign key to `households` with `ON DELETE CASCADE`, the index on `household_id`, no `anon` grant, and
no rows. Earlier the same day `to_regclass('public.shopping_extras')` was null.

## Who and when

**The household applies this, from the Supabase dashboard's SQL editor, before merging the PR that carries it.** A session
does not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first).

## The statement

Drafted from the live `aisle_overrides` table (read-only, 15 Nov 2026): the same foreign key and the same four policies, each
`TO authenticated` and each on `private.household_ids_for_user()`.

```sql
create table public.shopping_extras (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  aisle text not null default 'Other',
  amount text,
  ticked_at timestamptz,
  regular boolean not null default false,
  created_at timestamptz not null default now()
);
create index shopping_extras_household_id_idx on public.shopping_extras (household_id);
alter table public.shopping_extras enable row level security;
create policy "select own household" on public.shopping_extras for select to authenticated
  using (household_id in (select private.household_ids_for_user()));
create policy "insert own household" on public.shopping_extras for insert to authenticated
  with check (household_id in (select private.household_ids_for_user()));
create policy "update own household" on public.shopping_extras for update to authenticated
  using (household_id in (select private.household_ids_for_user()))
  with check (household_id in (select private.household_ids_for_user()));
create policy "delete own household" on public.shopping_extras for delete to authenticated
  using (household_id in (select private.household_ids_for_user()));
revoke all on table public.shopping_extras from anon;
```

## Why each part is there

- **`ticked_at` is the extra's own tick.** An extra never has a row in `shopping_checked`, so nothing about how a recipe's
  ingredient is keyed or ticked can be changed by one.
- **No unique key on the name.** Two extras may share a name, and an extra may share one with a recipe's row: the household
  decided they sit side by side (15 Nov 2026).
- **No CHECK on `aisle`.** The app offers the six food aisles, Household, Health & Toiletries, Pets and Other, and reads any
  other value as Other; a CHECK would need a migration whenever an aisle is added.
- **`regular` is for slice 2** (things bought most weeks, tapped back onto the list), built on 15 Nov 2026 after this was applied:
  a row with it set is a regular, kept under REGULARS and never drawn on the list. Slice 1 never named the column.
- **`revoke all … from anon`** costs nothing and keeps this table like the others: on 15 Nov the default privileges of
  `postgres` in `public` gave `anon` nothing, and those of `supabase_admin` still did.

## Why it is safe to apply first

A new, empty table that the app live today never reads. Nothing else changes.

## If the PR is merged first

Nothing breaks. The app reads this table apart from the others and **does not sign anyone out when it is missing**: the
Shopping screen is as it was, with no ADD AN ITEM, nothing is written, and EXPORT DATA leaves the key out. Apply the statement
and reload; the next load finds the table.

## After it is applied

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'shopping_extras' order by ordinal_position;
-- expect: id uuid NO · household_id uuid NO · name text NO · aisle text NO · amount text YES ·
--         ticked_at timestamptz YES · regular boolean NO · created_at timestamptz NO
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'shopping_extras';
-- expect four rows, each for {authenticated}
select grantee from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'shopping_extras' and grantee = 'anon';
-- expect no rows
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

```sql
drop table public.shopping_extras;
```

This loses every extra on the list. The app then shows the Shopping screen without ADD AN ITEM, as above.
