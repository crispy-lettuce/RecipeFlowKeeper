# Migration: source photos (`recipe-sources` bucket, `recipes.source_photos`)

For step 1 of `docs/PLAN-SOURCE-PHOTOS.md` (30 Sep 2026): somewhere private to keep the photo or screenshot a recipe was
converted from, and a column on the recipe listing them.

*(A markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on purpose: nothing that looks like a
data dump may be committed to this public repo. It carries DDL only and no data.)*

**Applied, 30 Sep 2026,** by the household from the SQL editor, just after PR #63 merged (the bucket was created at 16:35:52 UTC;
the merge was at 16:34, so the app ran for a minute or two with ADD PHOTO switched off, as designed). Checked read-only at
16:47 UTC with the queries below: `recipe-sources | false | 10485760 | {image/jpeg,image/png,image/webp,application/pdf}`; the four
policies, SELECT, INSERT, UPDATE and DELETE, each for `{authenticated}`; `source_photos | jsonb | YES` with its list check; no
`anon` select on the column. The dashboard gave it no migration version (see `docs/INFRASTRUCTURE.md`).

## Who and when

**The household applies this, from the Supabase dashboard's SQL editor, before merging the PR that carries it.** A session
does not apply it (`CLAUDE.md`: a schema change is the household's to apply, and first). Paste the whole statement below and
run it once.

## The statement

Drafted from the live `recipe-images` bucket and its four policies (read-only, 30 Sep): the same folder-per-household rule,
naming the new bucket, and `TO authenticated` as the 28 Sep hardening made every policy.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-sources', 'recipe-sources', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy "household can read own source photos" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-sources'
    and (storage.foldername(name))[1]::uuid in (select private.household_ids_for_user()));
create policy "household can write own source photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-sources'
    and (storage.foldername(name))[1]::uuid in (select private.household_ids_for_user()));
create policy "household can update own source photos" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-sources'
    and (storage.foldername(name))[1]::uuid in (select private.household_ids_for_user()))
  with check (bucket_id = 'recipe-sources'
    and (storage.foldername(name))[1]::uuid in (select private.household_ids_for_user()));
create policy "household can delete own source photos" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-sources'
    and (storage.foldername(name))[1]::uuid in (select private.household_ids_for_user()));

alter table public.recipes add column source_photos jsonb
  constraint recipes_source_photos_is_list check (source_photos is null or jsonb_typeof(source_photos) = 'array');
```

## Why each part is there

- **`public` is false.** A scanned cookbook page is someone else's work and a household's own recipe card is private, so
  unlike `recipe-images` nothing in this bucket can be fetched by knowing its path. The app shows a photo through a signed
  link that lasts an hour, made when it is opened; a signed link needs the `select` policy above.
- **10 MB and those four types** are enforced by storage itself, so a bug in the app cannot store an error page or a huge
  file. The app shrinks a photo to about half a megabyte before sending it; 10 MB leaves room for a PDF.
- **The four policies** are `recipe-images`' four with the bucket's name changed: a signed-in member of a household can read,
  add, replace and delete files under that household's folder (`<household_id>/…`) and nowhere else.
  `private.household_ids_for_user()` is granted to `authenticated` only.
- **`recipes.source_photos`** is the recipe's list of its photos, one entry per page, in page order:
  `[{ "path": "<household_id>/<recipe_id>/<time>.jpg", "added": "<ISO time>" }]`. Never the photo itself.
- **The check** keeps the column a list, so the app never has to cope with anything else there.
- **No `revoke … from anon`** is needed: this adds a column to a table, and a bucket, not a table. `recipes` has had no `anon`
  grant since 28 Sep and a new column has the table's grants; the policies are `TO authenticated`.

## Why it is safe to apply first

- The bucket is new and empty, and the app live today never names it.
- The column is nullable with no default, so every existing row reads null, and the app live today never mentions it.
  `hydrate()` selects every column, so the next app reads it with no other change.
- Nothing about `recipe-images` or its policies changes.

## If the PR is merged first

The app sends `source_photos` only on a recipe that has photos, as it does `source_check`, so an ordinary save is the row it
always was. A load that finds recipe rows without the column turns ADD PHOTO off, with a line saying this page has not been
applied; nothing signs anyone out. Apply the statement and reload.

## After it is applied

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'recipe-sources';
-- expect: recipe-sources | false | 10485760 | {image/jpeg,image/png,image/webp,application/pdf}
select policyname, cmd, roles from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like '%source photos';
-- expect four rows (SELECT, INSERT, UPDATE, DELETE), each for {authenticated}
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'recipes' and column_name = 'source_photos';
-- expect: source_photos | jsonb | YES
```

Then add it to the migration history in `docs/INFRASTRUCTURE.md` and remove the "waiting" note beneath it.

## To undo

Put the app back first if it has been merged: a save that carries photos would fail without the column.

```sql
alter table public.recipes drop column source_photos;
drop policy "household can read own source photos" on storage.objects;
drop policy "household can write own source photos" on storage.objects;
drop policy "household can update own source photos" on storage.objects;
drop policy "household can delete own source photos" on storage.objects;
```

Then empty and delete the `recipe-sources` bucket from the dashboard's Storage page (storage refuses to delete a bucket that
still holds files). This loses every source photo.
