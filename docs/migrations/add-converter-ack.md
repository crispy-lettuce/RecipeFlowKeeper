# Migration: the converter reminder (`household_settings.converter_ack_version`)

For issue #127 (12 Oct 2026). The app reminds each household, once, to reload the recipe converter's instructions after a coded
change to `converter/conversion-instructions.md`. Tapping **DONE** records it here, per household.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a data dump
may be committed to this public repo. It carries DDL only and no data.)*

**Waiting.** Not yet applied.

## Who and when

**The household applies this from the Supabase dashboard's SQL editor.** A session does not apply it (`CLAUDE.md`: a schema change
is the household's to apply). Paste the statement below and run it once. Running it again changes nothing.

**Either order is safe** (`CLAUDE.md`'s rule since 12 Oct, F34). The app reads the settings row with `select('*')`, and shows the
reminder, or sends the column, only when that row carries `converter_ack_version`. Merged first, the app works exactly as before
until this is applied. Applying it first is the usual order and is just as fine.

## The statement

Drafted from the live schema on 12 Oct 2026, read-only. `household_settings` has `household_id`, `week_start_day`, `dark_mode`,
`updated_at`, `calendar_remind_at`, `calendar_auto` and `calendar_auto_remind`, and nothing called `converter_ack_version`.

```sql
begin;

-- Which version of the converter instructions this household has said it loaded. Empty until DONE is first tapped.
alter table public.household_settings
  add column if not exists converter_ack_version text;

commit;
```

## Why each part is there

- **On `household_settings`, not on the device.** The ask is per household: each household has its own conversion project in
  the Claude app, so one tap of DONE, on any device, covers that household.
- **Text, empty to begin with.** It holds a version such as `2026-10-12.1`. Empty means "never confirmed", so the first time
  the app sees the column, each household is asked once about the current instructions.
- **`if not exists`.** Running it twice is harmless.
- **No policy or grant.** The column takes the table's row-level security and grants: on the live project, `authenticated` only
  (read 12 Oct), the same as every other settings column.

## Tried first

On the scratch Postgres 17 copy in the session (12 Oct 2026):

- It added one nullable `text` column with no default.
- The three settings rows read empty.
- A second run gave a notice and no error.
- The column carried the table's own grants and nothing more.
- The undo below removed it, and the statement then added it again.

## After it is applied

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'household_settings' and column_name = 'converter_ack_version';
-- expect one row: converter_ack_version | text | YES
select count(*) as households, count(converter_ack_version) as confirmed from public.household_settings;
-- expect: 3 | 0 (until each household taps DONE)
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md`, and change "Waiting" above to "Applied" with the date.

## To undo

Without the column, the app stops showing the reminder and sends nothing; nothing needs putting back first.

```sql
begin;
alter table public.household_settings drop column if exists converter_ack_version;
commit;
```

This loses only the record of which version each household confirmed.
