# Migration: `aisle_overrides`

For PR 6 of `docs/PLAN-NEW-RECIPE-FLOW.md` (29 Sep 2026): the household's aisle for an ingredient, set in
Settings → Shopping Aisles or from the add form's review. The design is `docs/PROPOSAL-AISLE-OVERRIDES.md`.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that
looks like a data dump may be committed to this public repo. It carries DDL only and no data.)*

## Who and when

**The household applies this, from the Supabase dashboard's SQL editor, before merging the PR that carries
it.** A session does not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first).

## The statement

Drafted from the live `aliases` table's definition (read-only, 29 Sep): the same key, foreign key and four
policies, `TO authenticated` as the 28 Sep hardening made every table.

```sql
create table public.aisle_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  aisle text not null,
  created_at timestamptz not null default now(),
  constraint aisle_overrides_household_id_name_key unique (household_id, name)
);
alter table public.aisle_overrides enable row level security;
create policy "select own household" on public.aisle_overrides for select to authenticated
  using (household_id in (select private.household_ids_for_user()));
create policy "insert own household" on public.aisle_overrides for insert to authenticated
  with check (household_id in (select private.household_ids_for_user()));
create policy "update own household" on public.aisle_overrides for update to authenticated
  using (household_id in (select private.household_ids_for_user()))
  with check (household_id in (select private.household_ids_for_user()));
create policy "delete own household" on public.aisle_overrides for delete to authenticated
  using (household_id in (select private.household_ids_for_user()));
revoke all on table public.aisle_overrides from anon;
```

## Why each part is there

- **`revoke all … from anon` is needed.** The project's default privileges give `anon` every right on a new
  table in `public` (read-only, 29 Sep: `pg_default_acl` for `public`). RLS with `TO authenticated` policies
  already refuses `anon`, but the other tables have no `anon` grant at all since 28 Sep, and this keeps it so.
- **Unique on `(household_id, name)`:** one aisle per ingredient, and what the app's upsert resolves on.
- **No CHECK on `aisle`.** The app offers only `INGREDIENT_AISLES`, drops anything else when it reads or
  imports, and a CHECK would need a migration whenever an aisle is added.
- **`name` is the shopping list's key for the ingredient** (`shoppingKeyForName`), as word matches store it.

## Why it is safe to apply first

A new, empty table that the app live today never reads. Nothing else changes.

## If the PR is merged first

The app reads this table apart from the others and **does not sign anyone out when it is missing**: Settings
says the aisles are not available yet, the review offers no aisle pick, and export leaves the key out. Apply
the statement and reload; the next load finds the table.

## After it is applied

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'aisle_overrides' order by ordinal_position;
-- expect: id uuid NO · household_id uuid NO · name text NO · aisle text NO · created_at timestamptz NO
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'aisle_overrides';
-- expect four rows, each for {authenticated}
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

```sql
drop table public.aisle_overrides;
```

This loses every aisle set. The app then says the aisles are unavailable, as above.
