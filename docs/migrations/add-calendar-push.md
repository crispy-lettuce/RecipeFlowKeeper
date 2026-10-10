# Migration: the calendar push (`planner_days.calendar`, `calendar_connections`, the token in Vault)

For PR 1 of P3, `docs/PLAN-CALENDAR-PUSH.md` §9 (1 Oct 2026). It adds the Planner's two switches per day, the household's reminder
time, a status row for the Google connection, and somewhere safe for the Google token.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo. It carries DDL only and no data.)*

**Applied by the household on 9 Oct 2026** (`docs/INFRASTRUCTURE.md`); its check queries were run read-only that day. *(Until 10 Oct this line said not applied.)*

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries it.** A session does
not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first). Paste the whole statement below and run it
once. It is one transaction, so a failure part-way leaves nothing behind.

## The statement

This was drafted from the live schema on 1 Oct 2026 (read-only): `planner_days`, `household_settings` and their constraints;
`vault.create_secret` and `vault.update_secret` and their arguments; who may read `vault.secrets`; and the default privileges on
`public`.

```sql
begin;

-- The Planner's two switches, per day.
alter table public.planner_days
  add column calendar boolean not null default false,
  add column calendar_remind boolean not null default false;

-- When the evening-before reminder goes off, in minutes after midnight: 1200 is 20:00.
alter table public.household_settings
  add column calendar_remind_at smallint not null default 1200
  constraint household_settings_calendar_remind_at_check check (calendar_remind_at between 0 and 1439);

-- The connection's status, which the app reads. Never the token.
create table public.calendar_connections (
  household_id uuid primary key references public.households(id) on delete cascade,
  connected boolean not null default false,
  google_email text,
  calendar_id text,
  scope text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.calendar_connections enable row level security;
create policy "select own household" on public.calendar_connections for select to authenticated
  using (household_id in (select private.household_ids_for_user()));
revoke all on table public.calendar_connections from anon, authenticated;
grant select on table public.calendar_connections to authenticated;

-- One-time values for the consent step, ten minutes each.
create table private.calendar_oauth_states (
  state text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  return_to text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
revoke all on table private.calendar_oauth_states from public, anon, authenticated, service_role;

create function public.calendar_state_issue(p_state text, p_household uuid, p_user uuid, p_return_to text)
returns void language sql security definer set search_path = '' as $$
  delete from private.calendar_oauth_states where expires_at < now();
  insert into private.calendar_oauth_states (state, household_id, user_id, return_to)
  values (p_state, p_household, p_user, p_return_to);
$$;

create function public.calendar_state_take(p_state text)
returns table (household_id uuid, user_id uuid, return_to text)
language sql security definer set search_path = '' as $$
  with taken as (delete from private.calendar_oauth_states s where s.state = p_state returning s.*)
  select t.household_id, t.user_id, t.return_to from taken t where t.expires_at > now();
$$;

-- The Google refresh token, in Vault, one per household.
create function public.calendar_token_set(p_household uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text := 'calendar_refresh_token:' || p_household;
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then
    perform vault.create_secret(p_token, v_name, 'Google Calendar refresh token (RecipeWrangler calendar push)');
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end;
$$;

create function public.calendar_token_get(p_household uuid)
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'calendar_refresh_token:' || p_household;
$$;

create function public.calendar_token_forget(p_household uuid)
returns void language sql security definer set search_path = '' as $$
  delete from vault.secrets where name = 'calendar_refresh_token:' || p_household;
$$;

revoke all on function public.calendar_state_issue(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.calendar_state_take(text) from public, anon, authenticated;
revoke all on function public.calendar_token_set(uuid, text) from public, anon, authenticated;
revoke all on function public.calendar_token_get(uuid) from public, anon, authenticated;
revoke all on function public.calendar_token_forget(uuid) from public, anon, authenticated;
grant execute on function public.calendar_state_issue(text, uuid, uuid, text) to service_role;
grant execute on function public.calendar_state_take(text) to service_role;
grant execute on function public.calendar_token_set(uuid, text) to service_role;
grant execute on function public.calendar_token_get(uuid) to service_role;
grant execute on function public.calendar_token_forget(uuid) to service_role;

commit;
```

## Why each part is there

- **`planner_days.calendar` and `calendar_remind`:**
  - What IN CALENDAR and REMIND ME store, one pair per planned day.
  - `not null default false`, so every existing day reads "off" and nothing reaches the calendar until it is switched on.
  - They take the table's existing grants and policies.
- **`household_settings.calendar_remind_at`:**
  - The time of the evening-before reminder, the same for every day. It defaults to 20:00, as asked on 1 Oct.
  - It is stored as minutes after midnight because Google takes a reminder as "minutes before the event": an all-day event starts at 00:00, so 20:00 the evening before is `1440 − 1200 = 240` minutes before.
- **`public.calendar_connections`:**
  - What the app shows in Settings: whether the household is connected, as which Google account, which calendar, and the last sync and error.
  - The household can read its own row. **Only the Edge Functions write it**: they use the service role, which RLS does not apply to, and every grant but `select` is revoked from `authenticated`.
  - `revoke … from anon` is needed because the project's default privileges give `anon` every right on a new table in `public` (`pg_default_acl`, read 1 Oct).
- **`private.calendar_oauth_states`:**
  - Ties the one consent visit to the household that started it.
  - `calendar-auth` issues a random value when CONNECT is tapped. Google hands it back to the callback, which takes it exactly once (`delete … returning`), and only within ten minutes.
  - A stray or replayed link therefore cannot connect anyone's calendar. The table is in `private`, with no grants, and is reached only through the functions above.
- **The token in Vault, not in a table:**
  - The nightly `pg_dump` copies the `public` and `private` schemas into the `PrivateBackup` repo. A token in either would be copied every night.
  - Vault keeps its secrets in its own schema, encrypted with a key held outside the database, and the dump does not include it. One secret per household, named `calendar_refresh_token:<household id>` (Vault's names are unique).
  - Restoring a backup into a new project therefore means connecting again. That is the right trade.
- **Five functions in `public`, `security definer`, callable by the service role only:**
  - The Edge Functions call them through the Data API (`rpc`), which can reach `public` only. `security definer` runs them as their owner, `postgres`, who may use Vault and `private`.
  - The service role could use Vault directly, but not `private`. One small set of functions is also easier to check than grants spread over two schemas.
  - `search_path = ''`, with every name written in full, so nothing can be slipped in ahead of `vault` or `private`.
  - The project's default privileges grant `execute` to `anon` and `authenticated` on every new function in `public`, and Postgres grants it to `public` (everyone). Each `revoke` takes that back.
  - *(The plan had private functions with thin public wrappers; one layer does the same job.)*

## Why it is safe to apply first

- The two `planner_days` columns and the settings column have defaults, so the app live today goes on saving rows exactly as before. Its upserts name only the columns it knows, and the new ones keep their defaults.
- The table, the private table and the functions are new, and nothing calls them until the functions are deployed and the app (PR 2) is merged.
- Nothing about any existing table's policies or grants changes.

## After it is applied

```sql
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and ((table_name = 'planner_days' and column_name like 'calendar%')
    or (table_name = 'household_settings' and column_name = 'calendar_remind_at'))
 order by 1, 2;
-- expect: household_settings calendar_remind_at smallint NO 1200
--         planner_days calendar boolean NO false · planner_days calendar_remind boolean NO false
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'calendar_connections';
-- expect one row: select own household | SELECT | {authenticated}
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'calendar_connections' and grantee in ('anon', 'authenticated');
-- expect one row: authenticated | SELECT
select p.proname, has_function_privilege('anon', p.oid, 'execute') anon,
       has_function_privilege('authenticated', p.oid, 'execute') authed,
       has_function_privilege('service_role', p.oid, 'execute') service
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'calendar\_%' order by 1;
-- expect five rows, each: false | false | true
select count(*) from vault.secrets where name like 'calendar_refresh_token:%';
-- expect 0 until the household connects; 1 afterwards
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

If the app (PR 2) has been merged, put it back first: it sends `calendar` on a Planner save only when the load found the
connections table, and that table goes below. DISCONNECT in Settings first, if connected, so that Google forgets the
connection too. The calendar and its events stay in Google either way; delete the RecipeWrangler calendar there if wanted.

```sql
begin;
delete from vault.secrets where name like 'calendar_refresh_token:%';
drop function public.calendar_state_issue(text, uuid, uuid, text);
drop function public.calendar_state_take(text);
drop function public.calendar_token_set(uuid, text);
drop function public.calendar_token_get(uuid);
drop function public.calendar_token_forget(uuid);
drop table private.calendar_oauth_states;
drop table public.calendar_connections;
alter table public.household_settings drop column calendar_remind_at;
alter table public.planner_days drop column calendar, drop column calendar_remind;
commit;
```

This loses which days were switched on.
