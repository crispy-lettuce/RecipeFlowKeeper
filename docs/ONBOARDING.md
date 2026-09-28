# Adding a family member — how it's done

**Written 28 Sep 2026**, verified against the running app and the live database: one account,
one household, one membership row today; no insert policy on `households` or
`household_members`; the app itself has no sign-up form, only sign-in. Part of PR 7 (Sharing),
`docs/NEXT-SESSION.md`.

---

## Answers first

### How do I add someone?

Three steps, all in the Supabase dashboard and SQL editor — nothing in the app does this, because
nothing in the app *can*: there's no insert policy on `households` or `household_members` (F8),
so joining a household isn't something the app, or the person joining, can do by themselves.

1. **Create their account.** Dashboard → Authentication → Users → **Add user**. Either send them
   an invite email (they set their own password by following the link) or set a password
   yourself now and tell them what it is some other way than email. Either way you end up with a
   row in `auth.users` and its `id`.
2. **Link them to the household.** One SQL statement — §1 has it, guarded so re-running it is
   harmless.
3. **Give them the app's address**, `https://crispy-lettuce.github.io/RecipeFlowKeeper/`, and
   whatever credential they need to sign in.

That's it — the household is shared, so they immediately see every existing recipe, the plan and
the diary. There's no per-person privacy within a household; it was built for one family sharing
one set of everything, not for keeping anything back from each other.

### What do they see if step 2 hasn't happened, or gets it wrong?

Exactly this, and then they're signed out again:

> Couldn't load your library — This account isn't linked to a household yet.

(`hydrate()`, `index.html:2520`.) That's a real, checked error — not a guess at wording — and it
comes back every time they try to sign in until the `household_members` row exists and points at
the household they should be in. It's not a broken account or a bug; it's exactly the state
"created but not linked yet" looks like.

### Can they just sign themselves up through the app?

No. The login screen (`index.html:1250`) only has email + password fields and a **Sign in**
button — there has never been a sign-up form. Whether the Supabase Auth *API* would accept a
direct sign-up request from something other than this app is a separate, project-level setting
(Authentication → Settings → **Allow new users to sign up**), unrelated to anything the app
offers. Check it while you're in there for step 1; since the app never uses it, there's no reason
to leave it on, and turning it off costs nothing. (Leaked-password protection lives on the same
settings page — that's the RLS-hardening PR, not this one.)

### What does `household_members.role` do?

Nothing yet. It's constrained to `'owner'` or `'member'` at the database level and defaults to
`'member'`, but nothing in `index.html` reads it — `grep -rn "\.role\b" index.html` finds no
hits. It's schema built ahead of a feature that isn't there, the same as `households.name`
(`docs/ARCHITECTURE.md` §4). Leave it at the default; changing it changes nothing today.

### What if they should see a *different* set of recipes, not the same one?

That's a second household, which is a bigger step than adding a family member — it means a
second `households` row, and `hydrate()` takes the **first** membership row it finds for a
signed-in user (`index.html:2518-2521`), so anyone in two households would land on an arbitrary
one.
Today there is exactly one household and this doesn't arise. If it ever does, that's a product
decision to make deliberately, not a variation on these steps.

---

## 1. The SQL, guarded

Find the household first — there's only one, so this is safe to run alone and just look at:

```sql
select id, name from public.households;
```

(As of 28 Sep 2026 that's `286a8a12-c12a-4b83-afbc-0912533f6b1c`, "Household" —
`docs/INFRASTRUCTURE.md` §1 has the current value if this ever drifts; re-run the query rather
than trust either document.)

Find the new person's row, created in the dashboard in step 1 above:

```sql
select id, email from auth.users where email = '<their email>';
```

Link them in. `household_members` has a unique constraint on `(household_id, user_id)`, so this
is safe to run twice — a repeat does nothing rather than erroring:

```sql
insert into public.household_members (household_id, user_id)
values ('<household id from the first query>', '<user id from the second query>')
on conflict (household_id, user_id) do nothing
returning *;
```

If it returns no row **and none existed before**, one of the two ids is wrong — stop and check
both queries again, the same rule as changing recipe text (`CLAUDE.md`).

**Removing someone** is the same shape, backwards — find their row and delete it:

```sql
delete from public.household_members where household_id = '<household id>' and user_id = '<their user id>'
returning *;
```

Their account in `auth.users` is untouched; they just can't reach this household's data any more.
Deleting the *household* row (not something this document has a case for) would cascade and
delete every membership in it — the foreign key is `ON DELETE CASCADE` both ways
(`household_members_household_id_fkey`, `household_members_user_id_fkey`), which is also why a
deleted person's own membership row disappears if their `auth.users` row is ever deleted instead.

## 2. Verifying it worked

Have them sign in. If it works, they see the same library, plan and diary you do — no extra step,
no separate check-in.

If you want to check from your side first, without waiting for them:

```sql
select h.name, u.email, hm.role, hm.created_at
from public.household_members hm
join public.households h on h.id = hm.household_id
join auth.users u on u.id = hm.user_id
order by hm.created_at;
```

This should list everyone in the household, the new row included, with today's date.

## 3. What this doesn't cover

- **A second household**, genuinely separate data — see "Answers first" above. Not built for.
- **A model-backed converter** so a family member can add a recipe without your account —
  deliberately deferred until someone actually wants to add one this way
  (`docs/NEXT-SESSION.md`).
- **Anything about *how much* they can do once signed in.** Everyone in a household has the same
  access to everything in it — there's no read-only or partial-access member today, and `role`
  (above) isn't wired to anything that would make one.
