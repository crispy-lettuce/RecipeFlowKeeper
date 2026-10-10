# Migration: the weekly backup to Google Drive (`calendar_connections.drive_*`)

For `docs/PLAN-DRIVE-BACKUP.md` (10 Oct 2026). Three columns on the Google connection's status row, where the `drive-backup`
Edge Function records where it keeps the backups and when it last saved one. DDL only, no data.

**Applied by the household on 10 Oct 2026**, before PR #75 merged; checked read-only at 17:47 UTC (`docs/INFRASTRUCTURE.md`). Tested before that, on 10 Oct 2026, on a scratch Postgres 16 with `calendar_connections` as
`add-calendar-push.md` made it (policy, grants, owned by a non-superuser like the live `postgres`): it applies, the check queries
below give what they say (the one `select` grant covers the new columns), and the undo runs.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor, before merging the PR that carries the app's side.** A
session does not apply it (`CLAUDE.md`). Merging first is safe: until the columns exist the app shows no BACKUPS block and calls
nothing.

## The statement

```sql
begin;

-- Where the backups go in the household's Drive, and how the last attempt went. Written only by the drive-backup
-- function (the service role); the household reads its own row through the existing select policy and grant.
alter table public.calendar_connections
  add column drive_folder_id text,
  add column drive_backup_at timestamptz,
  add column drive_last_error text;

commit;
```

## Why each part is there

- **On `calendar_connections`, not `household_settings`:** these are facts about the Google connection that only an Edge Function
  writes, like `last_sync_at` beside them. `household_settings` is written by the app, whose settings save would have to learn to
  leave them alone. The table's select policy ("select own household") and its one grant (`select` to `authenticated`) already
  cover new columns, and nothing but the service role can write it.
- **`drive_folder_id`:** the "RecipeWrangler backups" folder the function made, so later saves go to the same one. If it is
  deleted in Drive, the next save makes a new one.
- **`drive_backup_at`:** when a backup last reached Drive. The app shows it, and saves again by itself once it is a week old.
- **`drive_last_error`:** what went wrong last time, in words, until a save succeeds.

## After it is applied

```sql
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'calendar_connections' and column_name like 'drive%' order by 1;
-- expect: drive_backup_at | timestamp with time zone; drive_folder_id | text; drive_last_error | text
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'calendar_connections' and grantee in ('anon', 'authenticated');
-- expect one row, as before: authenticated | SELECT
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note.

## To undo

Put the app back first if its side has been merged. The backups already in Drive stay there.

```sql
alter table public.calendar_connections drop column drive_folder_id, drop column drive_backup_at, drop column drive_last_error;
```
