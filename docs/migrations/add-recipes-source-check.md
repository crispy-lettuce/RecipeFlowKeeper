# Migration: `recipes.source_check`

For PR 5 of `docs/PLAN-NEW-RECIPE-FLOW.md` (29 Sep 2026): the comparison with the source page,
recorded on the recipe by SAVE.

*(This is a markdown page rather than a `.sql` file because `.gitignore` excludes `*.sql`, on
purpose: nothing that looks like a data dump may be committed to this public repo. It carries one
DDL statement and no data.)*

**Applied, 29 Sep 2026,** by the household from the SQL editor, after PR #45 had merged. Checked read-only at 18:25 UTC:
`source_check | jsonb | YES`. The dashboard gave it no migration version (see `docs/INFRASTRUCTURE.md`).

## Who and when

**The household applies this, from the Supabase dashboard's SQL editor, before merging the PR that
carries it.** A session does not apply it (`CLAUDE.md`: the only production writes a session makes are
single rows the household asks for, and a schema change is the household's to apply, first).

## The statement

```sql
alter table public.recipes add column source_check jsonb;
```

## Why it is safe to apply first

- The column is nullable with no default, so every existing row reads null, and the app that is live
  today never mentions it.
- Row-level security is per row and needs no change.
- `hydrate()` selects every column, so the new app reads it with no other change.
- The new app sends `source_check` only when a recipe has a comparison to record, so a save with none
  is the row it always was.

## What goes in it

One small JSON object per recipe, written only by SAVE and only when a comparison ran in that form
session:

```json
{ "at": "2026-09-29T16:00:00.000Z", "route": "function", "hard": 3, "soft": 1,
  "sourceLines": 9, "linesHash": "8a7cedc3" }
```

`route` is `"function"` (the source page read by the function) or `"pasted"` (a list pasted from the
page). `hard` is the "N to look at" the comparison table shows, `soft` the shaded notes, `sourceLines` how
many lines the source had, and `linesHash` a hash of the recipe's ingredient lines that were compared, so a
recipe edited afterwards can say its comparison was of the lines before. **Never the page's text and never
a pasted list.**

## After it is applied

Check it:

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'recipes' and column_name = 'source_check';
-- expect: source_check | jsonb | YES
```

Then add it to the migration list in `docs/INFRASTRUCTURE.md` ("Migration history"), with the version the
dashboard gives it, and remove it from the "waiting to be applied" note beneath that list.

## To undo

```sql
alter table public.recipes drop column source_check;
```

This loses only the recorded comparisons. A save that carries one would then fail until the column is
back, so put the app back first.
