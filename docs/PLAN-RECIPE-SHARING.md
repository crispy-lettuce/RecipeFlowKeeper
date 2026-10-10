# Sharing recipes between households

**Asked for on 10 Oct 2026**, when the household wanted to share the app with a new household of close family: "Is it practical
that one household could browse another household's recipes? (Preferred) Or would one household have to 'send' them to the
second household? … it is important that each household has their own recipe database. … this app will only be used by myself
plus one or two close family members, so we can be a little more free." **Answered the same day; the database change and the
new-household steps are written, the app's side is being built.**

## 1. What was decided

- **Each household keeps its own recipe database.** Nothing is merged, and a household's own library, plan, shopping list,
  diary, notes, word matches, aisles, source photos and calendar are never visible to another.
- **A household can let another browse its whole recipe library**, read-only. There is no per-recipe choice.
- **Each side switches it on for itself**, in Settings → APP → RECIPE SHARING, by entering an email from the other household
  (SHARE). Either side can STOP SHARING at any time.
- **ADD TO OUR RECIPES copies** a recipe into your own library. The copy is yours from then on, independent of the original,
  and remembers where it came from so the original's card says ALREADY IN OUR RECIPES.
- **A new household starts empty** and is made in the dashboard from an email address (`docs/ONBOARDING.md` §4). One account
  belongs to one household.
- "Remember me at sign-in" was raised and withdrawn: the app already keeps each device signed in until SIGN OUT.

## 2. Why browsing is safe here

`hydrate()` reads `recipes` with no household filter and relies on row-level security for "only ours". Widening the `recipes`
select policy would pour another household's recipes into our library and shopping list. So the policy is left exactly as it
is, and the other library is reached only through `shared_recipes()`, a `security definer` function that returns rows only
when the owner has shared with the caller's household. The details, and why each part is there, are in
`docs/migrations/add-recipe-sharing.md`.

## 3. How it is built

| Step | What | Who |
| --- | --- | --- |
| 1 | `docs/migrations/add-recipe-sharing.md`: `recipe_shares`, `recipes.copied_from`, and six functions (SHARE, STOP SHARING, the two lists, the shared recipes, the household's name). Tested on a scratch Postgres built to the live shape, 10 Oct | The household applies it |
| 2 | `docs/ONBOARDING.md` §4: a new household from an email address, one guarded statement. The privacy and terms pages say "a few households of one family" | Docs |
| 3 | The app: Settings → APP → RECIPE SHARING (OUR HOUSEHOLD'S NAME, SHARE, SHARED WITH, STOP SHARING); RECIPES gains OUR RECIPES · 〈NAME〉'S RECIPES; their recipe opens read-only, cookable, with ADD TO OUR RECIPES; the photo is copied into our own folder; `help.html` gains a section | Merge, either side of step 1 |
| 4 | Tablet step 43a: name the household, SHARE, browse from the other side, cook one read-only, ADD TO OUR RECIPES | The household |

## 4. Not in this round

- Choosing which recipes to share (a SHARE tick per recipe).
- Updates flowing from an original to its copies.
- Planning or shopping from another household's recipe without copying it first.
- Sharing anything other than recipes.
