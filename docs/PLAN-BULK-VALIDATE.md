# Plan: checking many recipes against their sources at once

A working file with an end (`CLAUDE.md`, "How the documents are kept"): the PR that closes it updates `docs/SPEC.md` §5.3, §5.9 and §6.3 and deletes
this file. Written 31 Oct 2026. **Slices 1 to 3 (the prompt and reader in `core.js`, CHECK ALL by the function, and READ BY CHAT) are built; slice 4 and the servings idea are not.** The aisle half of the original ask is built and separate (IN OTHER NOW, Settings → INGREDIENTS →
SHOPPING AISLES, #225): it needed no chat.

## 1. The problem

A recipe is checked against its source page only from its own Edit form: open it, open the source, copy the ingredient list, paste it into the box, read the
table, press VALIDATE INGREDIENT LIST, save. LIBRARY CHECK says which recipes are still to do but is read-only; each OPEN lands in that form. For a library of
several dozen this is the slow part of keeping the converter honest (`docs/SPEC.md` §6.3).

What exists and is reused as it stands: `sourceFidelity` (the pairing and the differences), `pastedIngredientLines` (cleans a pasted list), `fidelityCounts` and
`sourceCheckStatus` (what is recorded, and whether it is still of these lines), the `source-ingredients` Edge Function (reads a page's Schema.org block), and
`recipes.source_check` (jsonb; `route` is free text, so a new route needs no schema change).

## 2. What the chat test showed (31 Oct 2026)

The household ran four of its own source links through a regular Claude chat with the prompt in §5. What it reported, which is **one chat, four pages and the
chat's own account of itself, not a measurement**:

- It has WebFetch, which returns a page as **markdown text**, not HTML. It put the reliable batch at **4 to 6 pages** and expected dropped lines or small
  "tidying" slips beyond about 10.
- Three of four pages read; the fourth (an old BBC Good Food link) was **blocked outright**. The chat did not try an archive copy, reasoning that a block is not a
  paywall. Whether the archive route works for those is **untested** (issue #216 suggests it).
- It kept imperial units as printed, and gave line counts that matched a page's own "8 ingredients".
- It said where its copy might not be exact: markdown flattens how a page separates fields, so a comma or divider may be lost, and it typed a straight
  apostrophe where the page had a curly one.
- One page came back with its whole comment thread (98 comments) and used most of the chat's context.
- It volunteered that for many pages the dependable route is the page's structured data (JSON-LD) compared by a program, not retyped by a model. That is what
  the `source-ingredients` function already does.

Two things in the reply matter to the design, and I checked the first against the code: **section headings** came back without a colon ("Cookie Dough"), and
`pastedIngredientLines` keeps a heading unless it has no digit *and* ends in a colon (or starts "For the…" or is a section word), so these would reach the
comparison as ingredients and show as extras; and **the failed page's title was replaced** by "COULD NOT READ", so a reply cannot be matched by title alone.

## 3. The design: three routes, cheapest first

The chat is not the first resort. The app can already read many pages itself, and does so deterministically.

1. **CHECK ALL (the app, no chat).** One button in Settings → LIBRARY. For each recipe with an https link that is not fresh-compared, the app calls the existing
   `source-ingredients` function with the recipe's link (`pageUrl`, as the Edit form does; the function can also take a `recipeId`, but that reads the link from
   the database and needs no more than the cache already holds), one recipe at a time with a visible progress line and a
   STOP, and runs the result through `sourceFidelity`. Recorded as `route: "function"`, as the Edit form records it. No chat, no copy and paste, no deploy.
2. **READ BY CHAT (the leftovers).** Recipes the function could not read (no Schema.org block, a refused page) are offered in batches of **8** (the household's choice on 1 Nov 2026; the chat estimated 4 to 6 as reliable, so watch for dropped lines) as a prompt to
   copy into a regular chat (§5), and the reply is pasted back. Recorded as `route: "chat"`, so the viewer's chip can say the list was read by a person's
   chat and not by the app's function.
3. **As today.** Still unread (blocked sites, no link): SOURCE PHOTO / CHECKED AGAINST THE PHOTO, or paste the list in the Edit form.

How many recipes fall to each is **not known**; step 1 measures it, and the plan's later steps should be sized from that count, not a guess.

### Review and recording (both routes share it)

- A table, one row per recipe: the title, `fidelityCounts` (hard to look at, soft notes), and a way to expand the same difference table the Edit form draws.
- **RECORD COMPARISONS** writes `source_check` for the rows with a result. VALIDATE stays the household's word: it is set only on rows the household ticks after
  looking, as today (a recorded comparison with no differences is already shown as fine by LIBRARY CHECK).
- Recipes with real differences get OPEN, which opens Edit with the source's list already in the paste box, so only those need the manual route.
- **The write is one column of one row**, queued with the key `recipes:<id>#source_check`, and written back into `cache` at the same moment (`CLAUDE.md`: a
  save from the Edit form upserts the whole row from the cache, so a value the cache lacks would be overwritten later). It is sent only if the recipe's ingredient
  lines still hash to what was compared (`linesHash`), so a recipe edited meanwhile is skipped, not recorded as checked. It never touches recipe text, so the
  recipe-text procedure in `CLAUDE.md` does not apply.

## 4. Why the chat's output is treated as a witness, not a fact

The point of the check is that the source's list reaches the comparison **independently of the converter**. A chat that retypes a list can slip (§2), and a slip
can hide a real difference or invent one. So: the route is recorded as `chat` and shown as such; a reply is read as pasted text through `pastedIngredientLines`
and the same `sourceFidelity`, nothing more trusting than a paste; the parser flags a reply that is plainly wrong (no lines, or very different in length from the
recipe) before it is compared; and the pilot in §7 measures the chat's agreement with the function on recipes both can read before the route is relied on.

## 5. The prompt (generated by the app, so it cannot drift)

Titles and links only, **no ingredient lines** (so nothing leans the transcription towards what the recipe already says). Numbered. The rules:

- Open each page and copy its ingredient list **exactly as printed**: no unit conversion, no tidying, no merging, no rewording, no guessing.
- Write each **section heading on its own line ending with a colon** (the app's cleaner drops those; it keeps a bare heading as an ingredient).
- If a page cannot be read, write `COULD NOT READ: <why>` and **never** rebuild a list from memory or another site. If a page is paywalled (not blocked) the
  chat may try its web.archive.org copy and must say so.
- Do not paste the page's comments or notes; ingredients only.
- Reply with one code block per recipe, **opening with the number from the prompt**, so a failed page still matches:

  ```
  RECIPE 3
  TITLE: <title as the page gives it>
  READ: yes | no | partly (one line on how)
  INGREDIENTS:
  <one per line>
  ```
- After the blocks: each page's line count, and any line it was unsure of or altered.

The reply parser matches on the **number**, treats the title as a check only, tolerates bullets, bold and prose outside the blocks, and reports each recipe as
read, couldn't read, or unmatched. It is a pure function in `core.js` with tests, like the other readers.

## 6. Build, in slices (each its own PR; the household merges)

1. **Pure functions in `core.js`**: `buildSourcePrompt(items)`, `parseSourceReply(text, items)`. Tests in `test/core.test.js` with made-up recipes, each check seen
   failing once. Bumps `KITCHEN_CORE_VERSION` in its three places.
2. **CHECK ALL by the function** (route 1), **built 31 Oct 2026** as Settings → LIBRARY → CHECK ALL AGAINST SOURCES. As built it records as it goes
   instead of waiting behind a RECORD COMPARISONS button, because the household decided that an exact match is validated automatically (§9); everything else
   is recorded not validated and listed with OPEN. Of the original wording, the review table is the list under the button. `index.html`, smoke tests (the stub answers the function), changelog,
   `help.html`, `docs/SPEC.md`. **No Edge Function change.** This slice alone may be most of the saving; stop and look at the numbers after it.
3. **READ BY CHAT** (route 2), **built 1 Nov 2026** together with slice 1 (`buildSourcePrompt`, `parseSourceReply`, `replyLengthOff` in `core.js`) as Settings → LIBRARY → READ BY CHAT.
   It was built because the first real CHECK ALL read 4 of 55 pages and the other 51 all failed with 403: the sites refuse the function, which identifies itself honestly and
   is not made to look like a browser. As built: the batch is frozen when the prompt is copied and the reply is matched to it by number; the same exact-match rule
   validates, except that a chat that said it read only part of a page is never validated; a recipe the chat could not read is set aside for the session; the
   viewer's chip says a chat read the list. Not yet seen on a device (`docs/HOUSEHOLD-JOBS.md` Job 6).
4. **Small, built 1 Nov 2026 except the filter:** OPEN with the list pre-filled in Edit (for CHECK ALL's list and READ BY CHAT's alike), and both lists showing only what is still to look at. Not built: a LIBRARY CHECK filter for `chat`. The viewer chip's wording for the route is built.

Each PR also adds its tablet steps to `docs/HOUSEHOLD-JOBS.md` and removes them when reported passed.

## 7. Done means seen

- The `source_check` rows with `route` `function` and `chat` in the database after a real run, and LIBRARY CHECK's "not compared" count falling by the number recorded.
  The smoke suite stubs Supabase, so it cannot show this.
- **Pilot before relying on the chat route:** take ten recipes the function can read, run the same pages through the chat, and compare the counts (hard and
  soft) recipe by recipe. Any disagreement is read, not averaged. One deliberately wrong line in a Test Kitchen recipe must be caught by both.
- Write down what was checked, and "not verified" where it was not.

## 8. Risks and open points

- **Fetch limits and cost.** The function reads one page in up to 20 seconds; a library of ~100 is minutes, so it runs one at a time, visibly, and can be
  stopped. Whether the function has any rate limit on its side is **not checked**.
- **Character-level differences** (a curly apostrophe, a lost comma) may show as small differences in the comparison. Whether `sourceFidelity` already folds
  them is **not checked**; test it with made-up lines before the chat route is relied on, and fold them in the reply reader if it does not.
- **Blocked sites** (BBC Good Food, #216) stay on route 3 unless the archive route is shown to work; test it on one link before promising it.
- **A batch of 5** across a large leftover set is many round trips. The count from step 1 decides whether route 2 is worth building at all.
- **Rejected:** an Edge Function that calls the Anthropic API from the app (a secret, cost, a deploy by the household and a new dependency); revisit only if
  route 2 proves too slow. A Claude Project with standing instructions (it would tie to the converter's version bar for no gain). Applying the source's amounts to
  a recipe in bulk: recipe text changes only by the procedure in `CLAUDE.md`, with the household present.
- **Aisles** are done in #225. A shared dictionary row for a name is a session job (re-measure first, then ask), not part of this plan.

## 9. Decided by the household (31 Oct 2026)

1. **Start with CHECK ALL by the function**, and decide on the chat route from the count it leaves: yes.
2. **Validated by itself:** only on an exact match, meaning no hard difference **and no soft note**. A recipe with a note, however soft, is recorded but not validated.
3. **Servings:** read a page's servings only for a recipe that has none in the app. **Not built.** It needs two things this slice avoids: the function returning the
   page's yield (an Edge Function change, deployed by the household), and writing a `SERVINGS:` line into the recipe, which is recipe text and follows the procedure
   in `CLAUDE.md` with the household present. Servings are mandatory in the app, so how many recipes lack them is unknown; count them before building anything.
