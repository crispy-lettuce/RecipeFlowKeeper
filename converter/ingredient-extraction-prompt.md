# Ingredient extraction — a prompt for surveying recipes in bulk

*Created 23 Sep 2026.*

**What it's for.** Growing `ingredient-names.md` from recipes it has never seen, rather than only
from the library it was built from. It pulls out **only the ingredient lines** of a batch of
recipes: no groups, stages or method, so it is quick and cheap to run on dozens at once. Each line
comes back twice: in the standard shape the converter must write, and in the source's own words.
`test/ingredient-survey.js` then reports:

1. **Names worth adding.** These turned up in two or more recipes but aren't listed yet.
2. **Spellings worth adding.** These are real-world wordings for names already on the list, such
   as "canola oil" for *vegetable oil*.
3. **Possible duplicates.** Two names that differ by one word that may or may not matter.
4. **Where the rules were broken.** Lines outside the standard shape are a free test of the
   converter's instructions on unfamiliar recipes: a rule broken often here will be broken in
   conversions too.

It is not a conversion. Nothing it produces goes into the app.

---

## How to use it

1. **Set up once.** Create a claude.ai project called *Ingredient survey*. Paste the prompt below
   into its instructions, and add `conversion-instructions.md` and `ingredient-names.md` as
   project files, so the survey always uses the current rules and names.
2. **Choose recipes.** 5–10 per chat, as URLs or pasted text. 20–50 in total makes a useful
   survey. See "Which recipes" below.
3. **Save the output.** Copy the fenced blocks into a text file **outside this repo**, for example
   `~/kitchen-survey/batch-1.md`. Several batches can go in one file or in several.
4. **Run the survey** from a checkout of the repo:
   ```sh
   node test/build.js
   node test/ingredient-survey.js ~/kitchen-survey/*.md --out ~/kitchen-survey/report.md
   ```
5. **Act on the report.** Add a row to `ingredient-names.md` only for names in section 1 you
   expect to cook with. Add spellings from section 2 freely: they cost nothing and help the
   validator. Treat section 4 as feedback on the converter's instructions.

**Which recipes.** Prefer:

- the kinds of dish you actually cook, or might;
- sites you haven't used before, and at least one US site (for the Americanisms);
- a spread of cuisines.

A vocabulary built from dishes you'll never cook is upkeep for nothing. And recipes from the same
few sites teach the list the same few spellings, which is the over-fitting this exists to avoid.

**Keep the files out of the repo.** They are recipe text, and the repo is public. The report
names recipes and sources too.

---

## The prompt

Paste everything in the box into the project's instructions:

````text
You extract ingredient lines from recipes for a survey. You do not convert whole recipes: no
method, groups, stages, servings or notes.

The project files hold the rules. Follow the ingredient-line rules in conversion-instructions.md
(the bullet "Write every ingredient line in one shape" and everything under it), and take names
from ingredient-names.md where the ingredient is listed. Where it isn't listed, name it as a UK
supermarket labels it on the shelf, in plain British English. Convert imperial and cup
measures to metric as conversion-instructions.md says.

For each recipe, output one fenced code block, exactly like this:

```
RECIPE: <recipe title>
SOURCE: <site, publication or person>
<standard line> | <the source's original line, copied exactly>
<standard line> | <the source's original line, copied exactly>
```

Rules for the lines:
- One line per ingredient, in the order the source lists them. Include every sub-list (sauce,
  topping, to serve) without its heading.
- Left of " | ": the line in the standard shape. Right of " | ": the source's line copied word
  for word, quantity included. Never tidy or correct the right-hand side.
- When one source line becomes several standard lines ("salt and pepper, to taste"), repeat
  the same original on each.
- Put "? " at the very start of a line when you are unsure of the name or the quantity, for
  example a regional ingredient, or a unit you had to guess. Never leave a doubt unmarked.
- Never invent a quantity. If the source gives none and the line isn't "to taste" or "to
  serve", write the line without one and mark it "? ".
- Never use a " | " inside a line other than the one separator.

Rules for the batch:
- If you cannot open a URL, or a page has no ingredient list, say so in one line and skip it.
  Never reconstruct a recipe from memory.
- After the blocks, write nothing except a one-line list of any recipes you skipped and why.
````

---

## Why the original wording matters

The right-hand side is the valuable half. It is how the survey learns that real sources say
"garbanzo beans", "nam pla" or "canola oil", and turns those into "Also written as" spellings,
which is what lets `test/validate-recipes.js` catch them when a conversion lets one through.
Without it, the survey could only tell you what the extractor chose, never what it was
choosing between.
