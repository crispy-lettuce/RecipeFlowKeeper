/* Boots the app against the stub and walks every screen, failing on any
   uncaught error. Re-run after each Phase 2 step. */
const { chromium } = require('playwright');

/* Playwright finds its own browser by default. PLAYWRIGHT_CHROMIUM is only
   needed where the repo's Chromium lives somewhere Playwright doesn't look. */
const launchOpts = process.env.PLAYWRIGHT_CHROMIUM
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
  : {};
const path = require('path');

(async () => {
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    // Google Fonts is blocked by this sandbox's egress proxy — not an app fault.
    if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_BLOCKED|fonts\.googleapis/.test(m.text())) {
      errors.push('CONSOLE: ' + m.text());
    }
  });

  await page.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await page.waitForTimeout(1200);

  const checks = [];
  const check = (name, pass, detail) => { checks.push({name, pass, detail}); };

  check('signed in past the login gate', !(await page.isVisible('#loginGate')));
  check('recipe library rendered', (await page.locator('.rcard').count()) > 0,
        (await page.locator('.rcard').count()) + ' cards');

  // Walk every nav destination.
  for (const view of ['planner','shopping','history','swaps','settings','recipes']) {
    await page.click(`.navlink[data-view="${view}"]`);
    await page.waitForTimeout(350);
    const target = view === 'shortlist' ? 'planner' : view;
    check(`${view} view opens`, await page.isVisible(`#view-${target}`));
  }

  // Settings specifics.
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(350);
  const weekOpts = await page.locator('#setWeekStart option').count();
  const weekSel = await page.locator('#setWeekStart').inputValue();
  check('week-start select has 7 days', weekOpts === 7, weekOpts + ' options');
  check('week start defaults to Friday (5)', weekSel === '5', 'value=' + weekSel);
  check('sources list populated', (await page.locator('#sourcesList .source-row').count()) > 0);
  check('keywords list populated', (await page.locator('#keywordsList .source-row').count()) > 0);
  check('aliases list present', await page.isVisible('#aliasesList'));

  /* ---- Dark mode (S2) ----
     The stub's household_settings says dark_mode:'system', and the harness
     runs with no system preference, so the app must boot light. Everything
     below drives the real control rather than poking state, because the
     thing worth testing is that choosing a theme repaints the app. */
  const themeOpts = await page.locator('#setDarkMode option').allTextContents();
  check('appearance select offers three states', themeOpts.length === 3, themeOpts.join(','));
  check('appearance defaults to follow-system',
        (await page.locator('#setDarkMode').inputValue()) === 'system');
  check('app boots light when nothing asks for dark',
        (await page.getAttribute('html', 'data-theme')) === 'light');

  await page.selectOption('#setDarkMode', 'dark');
  await page.waitForTimeout(300);
  check('choosing dark sets the theme attribute',
        (await page.getAttribute('html', 'data-theme')) === 'dark');

  const darkBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('dark theme actually repaints the page', darkBody === 'rgb(20, 18, 16)', darkBody);
  const meta = await page.getAttribute('meta[name="theme-color"]', 'content');
  check('browser chrome colour follows the theme', meta === '#141210', String(meta));

  /* The localStorage mirror is what the boot script reads to paint the
     first frame. If this stops being written, dark mode still works but
     flashes light on every load — a regression nothing else would catch. */
  const mirror = await page.evaluate(() => { try { return localStorage.getItem('kitchen.darkMode'); } catch (e) { return 'BLOCKED'; } });
  check('theme mirrored to localStorage for the next boot', mirror === 'dark', String(mirror));

  /* Two colour sets live in JavaScript beyond the flow table's, and both
     were missed on the first pass at dark mode: the history pie palette
     (dark slices on a dark card) and the PNG export background (a cream
     border around dark content). Neither is reachable by a token swap, so
     neither fails visibly in any test that only checks CSS. */
  await page.click('.navlink[data-view="history"]');
  await page.waitForTimeout(600);
  const pieFill = await page.evaluate(() => {
    const el = document.querySelector('#view-history svg path');
    return el ? el.getAttribute('fill') : 'NONE';
  });
  check('pie chart uses the dark palette', pieFill === '#C98FB4', pieFill);
  const exportBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
  check('PNG export background follows the theme', exportBg === '#1C1915', exportBg);

  /* The flow table paints PALETTE into inline styles, so it is the one
     screen a token swap cannot reach on its own. */
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.click('.rcard');
  await page.waitForTimeout(500);
  const laneBg = await page.evaluate(() => {
    const el = document.querySelector('.timeline-lane-abs');
    return el ? getComputedStyle(el).backgroundColor : 'NONE';
  });
  check('timeline lane uses the light-on-dark colour', laneBg === 'rgb(201, 143, 180)', laneBg);
  const boxColour = await page.evaluate(() => {
    const el = document.querySelector('.box-cell');
    return el ? getComputedStyle(el).color : 'NONE';
  });
  check('flow box text is a dark-theme palette colour',
        boxColour !== 'NONE' && boxColour !== 'rgb(91, 42, 74)', boxColour);

  // Back to light, and the flow table has to come back with it.
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.selectOption('#setDarkMode', 'light');
  await page.waitForTimeout(300);
  check('switching back restores light',
        (await page.getAttribute('html', 'data-theme')) === 'light');
  const lightBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('light theme is the original shell colour', lightBody === 'rgb(234, 228, 213)', lightBody);
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.click('.rcard');
  await page.waitForTimeout(500);
  const laneLight = await page.evaluate(() => {
    const el = document.querySelector('.timeline-lane-abs');
    return el ? getComputedStyle(el).backgroundColor : 'NONE';
  });
  check('timeline lane returns to the plum', laneLight === 'rgb(91, 42, 74)', laneLight);

  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.selectOption('#setDarkMode', 'system');
  await page.waitForTimeout(300);

  /* ---- The food diary (H1, H2, H3) ----
     The stub seeds one cooked recipe with a meal type, one without, and
     one ad-hoc entry, so every shape the diary holds is on screen. */
  await page.click('.navlink[data-view="history"]');
  await page.waitForTimeout(500);
  check('ad-hoc entries are flagged on the calendar',
        (await page.locator('.history-day.has-adhoc').count()) === 1);

  await page.locator('.history-day.has-adhoc').first().click();
  await page.waitForTimeout(350);
  const dayText = await page.locator('#historyDayDetail').innerText();
  check('cooked and ad-hoc share one day list',
        dayText.includes('Test Soup') && dayText.includes('Fish and chips'), dayText.replace(/\n/g,' | '));
  check('an ad-hoc entry is marked as such', dayText.includes('AD HOC'));
  check('meal type is shown where there is one', dayText.includes('LUNCH'));
  /* An ad-hoc entry has no recipe to open, so it must not be a link —
     the absence of the button is the feature, not an oversight. */
  const adHocIsPlain = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.history-day-recipe')];
    const row = rows.find(r => r.textContent.includes('Fish and chips'));
    return row ? !row.querySelector('.day-recipe-title') : false;
  });
  check('ad-hoc entries are not clickable recipes', adHocIsPlain);

  // H2: add one through the real dialog.
  await page.click('#historyAddEntryBtn');
  await page.waitForTimeout(300);
  check('ad-hoc dialog opens', await page.isVisible('#adHocOverlay .mini-panel'));
  check('autocomplete offers names already used',
        (await page.locator('#adHocVocab option').count()) >= 1);
  await page.click('#adHocSave');
  await page.waitForTimeout(250);
  check('a nameless entry is refused', await page.isVisible('#adHocError'));
  await page.fill('#adHocTitle', 'Chip shop tea');
  await page.click('#adHocMealChoices .meal-type-btn[data-meal="dinner"]');
  await page.click('#adHocSave');
  await page.waitForTimeout(500);
  const diaryCount = await page.evaluate(() => loadDiary().length);
  check('the new entry is in the diary', diaryCount === 4, String(diaryCount));
  check('and appears in the day list',
        (await page.locator('#historyDayDetail').innerText()).includes('Chip shop tea'));

  // H1: logging a cook asks for the meal type, after saving it.
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.click('.rcard');
  await page.waitForTimeout(500);
  const cells = page.locator('.box-cell');
  await cells.nth((await cells.count()) - 1).click();
  await page.waitForTimeout(600);
  check('logging a cook asks which meal it was', await page.isVisible('#mealTypeOverlay .mini-panel'));
  check('the prompt offers the four meal types',
        (await page.locator('#mealTypeChoices .meal-type-btn').count()) === 4);
  /* The entry must exist BEFORE the prompt is answered — dismissing it
     cannot be allowed to lose the log. */
  const loggedBeforeAnswering = await page.evaluate(() => loadDiary().length);
  check('the log is saved before the prompt is answered', loggedBeforeAnswering === 5, String(loggedBeforeAnswering));
  await page.click('#mealTypeChoices .meal-type-btn[data-meal="lunch"]');
  await page.waitForTimeout(400);
  const newest = await page.evaluate(() =>
    loadDiary().slice().sort((a,b)=>b.cookedOn.localeCompare(a.cookedOn))[0].mealType);
  check('choosing a meal type tags the entry', newest === 'lunch', String(newest));

  // H3: the CSV itself.
  await page.click('.navlink[data-view="history"]');
  await page.waitForTimeout(300);
  const csv = await page.evaluate(() => {
    const rows = loadDiary().slice().sort((a,b)=>a.cookedOn.localeCompare(b.cookedOn));
    const byId = new Map(loadRecipes().map(r=>[r.id, r]));
    return [['Date','Meal type','Entry','Source','Course','Ingredients'].map(csvCell).join(',')]
      .concat(rows.map(e=>{
        const r = e.recipeId ? byId.get(e.recipeId) : null;
        return [e.cookedOn, e.mealType ? MEAL_TYPE_LABELS[e.mealType] : '',
                diaryEntryTitle(e, byId), e.recipeId ? 'Recipe' : 'Ad hoc',
                r && r.tags ? (r.tags.course || '') : '',
                r ? diaryIngredientSummary(r) : ''].map(csvCell).join(',');
      })).join('\n');
  });
  check('CSV header matches the brief',
        csv.split('\n')[0] === '"Date","Meal type","Entry","Source","Course","Ingredients"');
  check('CSV distinguishes recipe from ad hoc',
        csv.includes('"Ad hoc"') && csv.includes('"Recipe"'));
  /* The CSV-only name tidier. The two cases that matter are opposites:
     "cloves" is a unit in "2 cloves garlic" and an ingredient in "whole
     cloves", and only the never-strip-the-last-word rule tells them apart.
     A fix applied inside splitQty could not have made that distinction —
     and would have re-keyed every ticked shopping item besides. */
  const tidy = await page.evaluate(() => ({
    garlic:   tidyIngredientName('cloves garlic'),
    spice:    tidyIngredientName('whole cloves'),
    alone:    tidyIngredientName('cloves'),
    eggs:     tidyIngredientName('large eggs'),
    multi:    tidyIngredientName('x 125 g tins tuna in olive oil'),
    plain:    tidyIngredientName('dried pasta'),
    lastWord: tidyIngredientName('large'),
  }));
  check('a leading unit is dropped', tidy.garlic === 'garlic', tidy.garlic);
  check('but never the last word, so the spice survives', tidy.spice === 'cloves', tidy.spice);
  check('a bare unit-looking ingredient is left alone', tidy.alone === 'cloves', tidy.alone);
  check('size words are dropped too', tidy.eggs === 'eggs', tidy.eggs);
  check('a multipack unwinds to the ingredient', tidy.multi === 'tuna in olive oil', tidy.multi);
  check('an already-clean name is untouched', tidy.plain === 'dried pasta', tidy.plain);
  check('a one-word name is never emptied', tidy.lastWord === 'large', tidy.lastWord);

  /* splitQty must be untouched by all of this: its output is the shopping
     list's aggregation key, so a change there silently unticks everything. */
  const splitUnchanged = await page.evaluate(() => {
    const a = splitQty('2 cloves garlic, minced');
    const b = splitQty('300 g dried pasta');
    return a.rest === 'cloves garlic, minced' && a.qty === '2'
        && b.rest === 'dried pasta' && b.qty === '300 g';
  });
  check('splitQty still splits exactly as before', splitUnchanged);

  check('CSV strips quantities from ingredients',
        csv.includes('dried pasta') && !/\b300 g\b/.test(csv));
  check('CSV leaves ad-hoc course and ingredients blank',
        /"Fish and chips","Ad hoc","",""/.test(csv), csv.split('\n').find(l=>l.includes('Fish and chips')));
  check('CSV quotes every field', !/,(?!")/.test(csv.split('\n')[1].replace(/"[^"]*"/g, m=>m.replace(/,/g,'~'))));

  // Removing an entry takes it out of the recipe's own history too.
  const removedOk = await page.evaluate(() => {
    const e = loadDiary().find(x => x.recipeId);
    const before = (loadRecipes().find(r=>r.id===e.recipeId).history||[]).includes(e.cookedOn);
    deleteDiaryEntry(e.id);
    const after = (loadRecipes().find(r=>r.id===e.recipeId).history||[]).includes(e.cookedOn);
    return before && !after;
  });
  check('removing a cooked entry clears the date from the recipe', removedOk);

  /* The backup is the whole point of the diary surviving anything. Export
     used to select only rows with a recipe_id, so once ad-hoc entries
     existed a backup would have looked complete and been missing a
     feature's worth of data. This reads the real downloaded file. */
  const backup = await (async () => {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportDataBtn'),
    ]);
    const tmp = require('path').join(require('os').tmpdir(), 'kitchen-backup-check.json');
    await dl.saveAs(tmp);
    return JSON.parse(require('fs').readFileSync(tmp, 'utf8'));
  })();
  /* Read through a local that is always an array. A missing `diary` is the
     exact regression these checks exist for, and reaching into it directly
     would throw — which reports as a crashed suite rather than a named
     failure, and takes every check after it down too. */
  const backupDiary = Array.isArray(backup.diary) ? backup.diary : [];
  check('backup declares the version that carries a diary', backup.version === 3, String(backup.version));
  check('backup contains the diary', backupDiary.length > 0,
        Array.isArray(backup.diary) ? backupDiary.length + ' entries' : 'diary key missing entirely');
  check('backup keeps ad-hoc entries',
        backupDiary.some(e => !e.recipeId && e.title === 'Fish and chips'));
  check('backup keeps meal types',
        backupDiary.some(e => e.mealType === 'lunch' || e.mealType === 'dinner'));

  // History calendar must start on the configured day and stay aligned.
  await page.click('.navlink[data-view="history"]');
  await page.waitForTimeout(350);
  const heads = await page.locator('#historyWeekdayLabels span').allTextContents();
  check('history header starts Friday', heads.join(',') === 'FRI,SAT,SUN,MON,TUE,WED,THU', heads.join(','));
  const align = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('#historyWeekdayLabels span')].map(s => s.textContent);
    const names = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const cells = [...document.querySelectorAll('#historyGrid .history-day')];
    const bad = [];
    cells.forEach((c, i) => {
      const iso = c.dataset.date;
      if (!iso) return;
      const wd = names[new Date(iso + 'T00:00:00').getDay()];
      if (wd !== labels[i % 7]) bad.push(iso + ' under ' + labels[i % 7] + ' but is ' + wd);
    });
    return { n: cells.length, bad: bad.slice(0, 3) };
  });
  check('every date sits under its own weekday', align.bad.length === 0,
        align.n + ' cells' + (align.bad.length ? '; ' + align.bad.join('; ') : ''));

  // Planner should bucket into Friday-start weeks.
  await page.click('.navlink[data-view="planner"]');
  await page.waitForTimeout(350);
  const weekLabels = await page.locator('.week-label, .day-week-label').allTextContents();
  check('planner rendered day rows', (await page.locator('.day-row').count()) > 0,
        (await page.locator('.day-row').count()) + ' days');

  // Shopping list: g and kg are one shelf, and the head controls work.
  await page.click('.navlink[data-view="shopping"]');
  await page.waitForTimeout(400);
  const tomato = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.shop-item')]
      .map(el => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => /tomato/i.test(t));
    return rows;
  });
  check('500 g + 1 kg tomatoes make one line', tomato.length === 1, tomato.join(' // ') || 'none');
  // 500 g (x2 days) + 1 kg = 2000 g, which should read as kilograms.
  check('and 1000+ g reads in kilograms', /^2 kg/.test(tomato[0] || ''), tomato[0] || '');
  const pasta = await page.evaluate(() => [...document.querySelectorAll('.shop-item')]
    .map(el => el.textContent.replace(/\s+/g, ' ').trim()).filter(t => /pasta/i.test(t)));
  check('and under 1000 g stays in grams', /^600 g/.test(pasta[0] || ''), pasta[0] || '');

  await page.locator('.shop-item', { hasText: /tomato/i }).first().locator('input').check();
  await page.waitForTimeout(300);
  check('ticking sticks', (await page.locator('.shop-item.checked').count()) === 1);

  await page.click('#shopHideCheckedBtn');
  await page.waitForTimeout(300);
  check('hide ticked removes it from view', (await page.locator('.shop-item.checked').count()) === 0);
  check('hide button flips its label', /SHOW TICKED/.test(await page.locator('#shopHideCheckedBtn').textContent()));
  await page.click('#shopHideCheckedBtn');
  await page.waitForTimeout(300);

  // Both Weeks is its own list with its own ticks.
  await page.selectOption('#shopWeekSelect', 'both');
  await page.waitForTimeout(400);
  check('both weeks is selectable', /THIS WEEK \+ NEXT WEEK/.test(await page.locator('#shopMeta').textContent()),
        (await page.locator('#shopMeta').textContent()).trim());
  check('combined list starts unticked', (await page.locator('.shop-item.checked').count()) === 0);
  await page.locator('.shop-item').first().locator('input').check();
  await page.waitForTimeout(300);
  const combinedTicks = await page.locator('.shop-item.checked').count();
  await page.selectOption('#shopWeekSelect', '0');
  await page.waitForTimeout(400);
  const singleTicks = await page.locator('.shop-item.checked').count();
  check('combined ticks stay out of the single-week list', combinedTicks === 1 && singleTicks === 1,
        'combined=' + combinedTicks + ' single=' + singleTicks);

  // Clearing one mode must leave the other alone.
  page.once('dialog', d => d.accept());
  await page.click('#shopClearBtn');
  await page.waitForTimeout(400);
  check('clear ticks empties this week', (await page.locator('.shop-item.checked').count()) === 0);
  await page.selectOption('#shopWeekSelect', 'both');
  await page.waitForTimeout(400);
  check('and leaves the combined list ticked', (await page.locator('.shop-item.checked').count()) === 1,
        (await page.locator('.shop-item.checked').count()) + ' still ticked');
  page.once('dialog', d => d.accept());
  await page.click('#shopClearBtn');
  await page.waitForTimeout(400);
  await page.selectOption('#shopWeekSelect', '0');
  await page.waitForTimeout(300);

  // Scaling is by target servings, not a multiplier.
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Pasta' }).first().click();
  await page.waitForTimeout(400);
  const metaBase = await page.locator('#viewerMeta').textContent();
  check('viewer shows the recipe servings', /SERVES 4/.test(metaBase), metaBase.trim().slice(0, 90));
  check('no multiplier buttons anywhere', (await page.locator('[data-viewer-scale], [data-scale]').count()) === 0);
  await page.click('.viewer-scale-row .scale-btn[data-viewer-serves="6"]');
  await page.waitForTimeout(300);
  const metaScaled = await page.locator('#viewerMeta').textContent();
  check('scales to a headcount', /SERVES 6 \(SCALED FROM 4\)/.test(metaScaled), metaScaled.trim().slice(0, 90));
  const qty = await page.evaluate(() =>
    [...document.querySelectorAll('#flowMount')].map(e => e.textContent).join(' '));
  check('ingredients scaled 4 -> 6', /450\s*g/.test(qty), /450\s*g/.test(qty) ? '300 g pasta -> 450 g' : 'no 450 g found');
  await page.click('#viewerServesResetBtn');
  await page.waitForTimeout(300);
  check('reset returns to the recipe base',
        /SERVES 4/.test(await page.locator('#viewerMeta').textContent()));

  // R1: ticks survive a rescale, and reset clears them without navigating away.
  const flowCells = page.locator('#flowMount .ing-cell, #flowMount .box-cell');
  check('the flow has cells to tick', (await flowCells.count()) > 2, (await flowCells.count()) + ' cells');
  await flowCells.first().click();
  await page.waitForTimeout(250);
  const tickedBefore = await page.locator('#flowMount .done').count();
  check('clicking ticks a cell', tickedBefore > 0, tickedBefore + ' done');

  await page.click('.viewer-scale-row .scale-btn[data-viewer-serves="8"]');
  await page.waitForTimeout(400);
  const tickedAfter = await page.locator('#flowMount .done').count();
  check('ticks survive a rescale', tickedAfter === tickedBefore,
        tickedBefore + ' -> ' + tickedAfter);
  check('and the rescale really happened',
        /SERVES 8/.test(await page.locator('#viewerMeta').textContent()));

  await page.click('#resetTicksBtn');
  await page.waitForTimeout(250);
  check('reset clears every tick', (await page.locator('#flowMount .done').count()) === 0);
  check('and stays on the recipe', await page.isVisible('#view-viewer'));
  await page.click('.viewer-scale-row .scale-btn[data-viewer-serves="4"]');
  await page.waitForTimeout(300);
  check('reset is not undone by a re-render', (await page.locator('#flowMount .done').count()) === 0);

  // R2: the sidebar collapses over a recipe and peeks back.
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  const sidebarW = () => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().width);
  check('sidebar collapses over the viewer', (await sidebarW()) < 10, (await sidebarW()) + 'px');
  check('and the peek tab is offered', await page.isVisible('#sidebarPeekBtn'));
  await page.click('#sidebarPeekBtn');
  await page.waitForTimeout(400);
  check('peeking brings it back', (await sidebarW()) > 200, (await sidebarW()) + 'px');
  await page.click('#sidebarPeekBtn');
  await page.waitForTimeout(400);
  check('and tucks it away again', (await sidebarW()) < 10, (await sidebarW()) + 'px');
  await page.click('#backToRecipes');
  await page.waitForTimeout(400);
  check('leaving the viewer restores the sidebar', (await sidebarW()) > 200, (await sidebarW()) + 'px');
  check('and the peek tab goes away', !(await page.isVisible('#sidebarPeekBtn')));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);

  /* Keep Awake collapses the sidebar at ANY width (21 Sep), where the rule
     exercised above only fires between 861 and 1180px. 1280px is therefore
     the whole point of this block: the width rule is not in play.

     It sets the state directly instead of clicking the toggle, because
     enableKeepAwake() needs a real wake lock or a playable video and gets
     neither headless — see test/README.md. What is ours to test is that the
     sidebar answers the state, and that the peek tab is still there, since
     without it Keep Awake would strand you on a screen with no menu. */
  await page.locator('.rcard', { hasText: 'Test Pasta' }).first().click();
  await page.waitForTimeout(400);
  check('sidebar is open in a recipe at 1280px', (await sidebarW()) > 200, (await sidebarW()) + 'px');
  await page.evaluate(() => { state.keepAwake = true; updateKeepAwakeStatus(); });
  await page.waitForTimeout(400);
  check('keep awake collapses it even at 1280px', (await sidebarW()) < 10, (await sidebarW()) + 'px');
  check('and still offers the peek tab', await page.isVisible('#sidebarPeekBtn'));
  await page.click('#sidebarPeekBtn');
  await page.waitForTimeout(400);
  check('which still brings it back', (await sidebarW()) > 200, (await sidebarW()) + 'px');
  await page.click('#sidebarPeekBtn');
  await page.waitForTimeout(400);
  await page.evaluate(() => { state.keepAwake = false; updateKeepAwakeStatus(); });
  await page.waitForTimeout(400);
  check('switching keep awake off restores it', (await sidebarW()) > 200, (await sidebarW()) + 'px');
  await page.click('#backToRecipes');
  await page.waitForTimeout(300);

  // R6: servings are mandatory on save.
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await page.fill('#importInput', 'TITLE: Guard Test\nSOURCE: Somewhere\n\nGROUP a:\n1 onion\n\nSTAGE:\nMERGE a -> done: Cook [5 min]');
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  await page.fill('#f-servings', '');
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const err = await page.locator('#saveError').textContent();
  check('save blocked with servings empty', /servings/i.test(err) && await page.isVisible('#saveError'), err.trim().slice(0, 70));
  const savedAnyway = await page.evaluate(() => (window.__WRITES__ || []).some(w => w.table === 'recipes'));
  check('nothing written when blocked', !savedAnyway);

  // A reprocessed recipe carries its own origin through the parse.
  await page.fill('#importInput', 'TITLE: URL Test\nSOURCE: Somewhere\nSOURCE_URL: https://example.com/a-recipe\nSERVINGS: 4\n\nGROUP a:\n1 onion\n\nSTAGE:\nMERGE a -> done: Cook [5 min]');
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  check('SOURCE_URL reaches the form', (await page.inputValue('#f-source-url')) === 'https://example.com/a-recipe',
        await page.inputValue('#f-source-url'));
  const urlParse = await page.evaluate(() => ({
    canonical: parseRecipe('SOURCE_URL: https://a.example').sourceUrl,
    alias: parseRecipe('URL: https://b.example').sourceUrl,
    sourceUntouched: parseRecipe('SOURCE: Nicky\'s Kitchen Sanctuary').source
  }));
  check('both spellings parse', urlParse.canonical === 'https://a.example' && urlParse.alias === 'https://b.example',
        JSON.stringify(urlParse));
  check('and plain SOURCE is unaffected', urlParse.sourceUntouched === "Nicky's Kitchen Sanctuary", urlParse.sourceUntouched);

  // A URL line below a GROUP must not be scaled as if it were an ingredient.
  const headerSafe = await page.evaluate(() =>
    scaleRecipeSyntax('GROUP a:\n2 onions\nSOURCE_URL: https://example.com/2-of-these\n', 3));
  check('a URL below a group is left alone', headerSafe.includes('https://example.com/2-of-these'),
        headerSafe.replace(/\n/g, ' | '));

  // The form scales to a headcount too, working the multiplier out of SERVINGS.
  await page.fill('#importInput', 'TITLE: Scale Test\nSOURCE: Somewhere\nSERVINGS: 4\n\nGROUP a:\n300 g pasta\n\nSTAGE:\nMERGE a -> done: Cook [5 min]');
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  await page.fill('#f-scale-servings', '6');
  await page.click('#f-scale-apply');
  await page.waitForTimeout(300);
  const scaledText = await page.inputValue('#importInput');
  check('form scales ingredients to the target', /450\s*g pasta/.test(scaledText));
  check('form rewrites SERVINGS', /SERVINGS:\s*6/.test(scaledText));
  check('form servings field follows', (await page.inputValue('#f-servings')) === '6');

  // Escape must still close the Add modal now the two manager modals are gone.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Escape closes the Add modal', !(await page.isVisible('#addModalOverlay.open')));

  // P1: per-entry planner servings drive the shopping list.
  await page.click('.navlink[data-view="planner"]');
  await page.waitForTimeout(350);
  const pills = page.locator('.day-recipe-serves');
  check('planner rows carry a headcount', (await pills.count()) > 0, (await pills.count()) + ' pills');
  check('headcount defaults to the recipe', /SERVES 4/.test(await pills.first().textContent()),
        (await pills.first().textContent()).trim());

  const before = await page.evaluate(() => {
    const list = buildShoppingList(groupDaysByWeek(dayList())[0]);
    let out = null;
    list.categories.forEach(c => c.items.forEach(i => { if (/pasta/i.test(i.name)) out = i.amount + ' ' + i.unit; }));
    return out;
  }).catch(() => null);

  page.once('dialog', d => d.accept('8'));
  await pills.first().click();
  await page.waitForTimeout(400);
  check('headcount updates on the card', /SERVES 8/.test(await pills.first().textContent()),
        (await pills.first().textContent()).trim());
  check('headcount pill lights up when overridden',
        (await pills.first().getAttribute('class')).includes('on'));

  const wrote = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'planner_days' && w.op === 'upsert')
      .flatMap(w => w.rows).filter(r => Array.isArray(r.servings) && r.servings.some(n => n === 8)).length);
  check('headcount persisted to planner_days', wrote > 0, wrote + ' rows carrying 8');

  const after = await page.evaluate(() => {
    const list = buildShoppingList(groupDaysByWeek(dayList())[0]);
    let out = null;
    list.categories.forEach(c => c.items.forEach(i => { if (/pasta/i.test(i.name)) out = i.amount + ' ' + i.unit; }));
    return out;
  }).catch(() => null);
  check('shopping quantities follow the headcount', before && after && before !== after,
        before + ' -> ' + after);

  // Removing one entry must not shift another's headcount.
  const lockstep = await page.evaluate(() => {
    const iso = Object.keys(loadPlan()).find(k => planRecipeIds(loadPlan()[k]).length >= 2);
    if (!iso) return 'no two-recipe day';
    setPlanServingsAt(iso, 1, 9);
    const second = planEntries(loadPlan()[iso])[1];
    removePlanRecipeAt(iso, 0);
    const survivor = planEntries(loadPlan()[iso])[0];
    return (survivor.recipeId === second.recipeId && survivor.servings === 9)
      ? 'ok' : 'drifted to ' + JSON.stringify(survivor);
  });
  check('removing an entry keeps the others in lockstep', lockstep === 'ok', lockstep);

  // SL2: ingredient name matching.
  const norm = await page.evaluate(() => ({
    prepIgnored: normalizeIngredientName('garlic, minced') === normalizeIngredientName('garlic'),
    groundKept: normalizeIngredientName('ground coriander') !== normalizeIngredientName('coriander'),
    groundValue: normalizeIngredientName('ground coriander')
  }));
  check('prep words do not split an ingredient', norm.prepIgnored);
  check('"ground coriander" stays apart from "coriander"', norm.groundKept, norm.groundValue);

  const sugg = await page.evaluate(() => findIngredientMatchSuggestions([
    { key: 'spring onion|', count: 1 },
    { key: 'spring onions|', count: 4 },
    { key: 'butter|g', count: 2 }
  ]));
  check('suggests the one similar pair', sugg.length === 1, JSON.stringify(sugg));
  check('and folds the rarer name into the commoner one',
        sugg[0] && sugg[0].from === 'spring onion' && sugg[0].to === 'spring onions', JSON.stringify(sugg[0]));

  // The prompt is capped, and both answers are remembered.
  let asked = 0;
  const onDialog = d => { asked++; d.dismiss(); }; // dismiss = "keep them separate"
  page.on('dialog', onDialog);
  const capped = await page.evaluate(() => {
    const many = [];
    for (let i = 0; i < 6; i++) many.push({ from: 'thing ' + i, to: 'things ' + i });
    return promptIngredientMatches(many);
  });
  page.off('dialog', onDialog);
  check('prompts are capped at three', asked === 3, asked + ' asked');
  check('answering reports a change', capped === true);

  const remembered = await page.evaluate(() => ({
    distinct: isPairDistinct('ingredient', 'thing 0', 'things 0'),
    stillSuggested: findIngredientMatchSuggestions([
      { key: 'thing 0|', count: 1 }, { key: 'things 0|', count: 2 }
    ]).length,
    stored: loadAliases().filter(a => a.kind === 'ingredient_distinct').length
  }));
  check('a "no" is remembered', remembered.distinct);
  check('and stops the pair being suggested again', remembered.stillSuggested === 0);
  check('and is stored to sync', remembered.stored === 3, remembered.stored + ' stored');

  // A "yes" must actually combine the two on the list.
  const yesWorks = await page.evaluate(() => {
    addAlias('ingredient', 'spring onion', 'spring onions');
    return applyIngredientAlias('spring onion');
  });
  check('a "yes" redirects the name', yesWorks === 'spring onions', yesWorks);

  // The prompt must never fire from the planner.
  let plannerDialogs = 0;
  const countDialog = d => { plannerDialogs++; d.dismiss(); };
  page.on('dialog', countDialog);
  await page.evaluate(() => { updateSidebarCounts(); renderPlanner(); });
  await page.waitForTimeout(400);
  page.off('dialog', countDialog);
  check('building a list from the planner asks nothing', plannerDialogs === 0, plannerDialogs + ' dialogs');

  // And the answers are visible and reversible in Settings.
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(400);
  check('Settings lists the remembered answers',
        (await page.locator('#aliasesList .source-row').count()) >= 4,
        (await page.locator('#aliasesList .source-row').count()) + ' rows');
  check('and offers to reverse them',
        (await page.locator('#aliasesList [data-forget]').count()) >= 4);

  // instant and overnight brackets — required by the conversion
  // instructions, and every reprocessed recipe will use them.
  const durationCheck = await page.evaluate(() => ({
    instant: extractStepDuration('plate up [instant]'),
    overnight: extractStepDuration('chill [overnight]'),
    normal: extractStepDuration('bake [40 min]')
  }));
  check('instant label has no literal bracket', durationCheck.instant.label === 'plate up',
        durationCheck.instant.label);
  check('instant is a real zero-length duration', durationCheck.instant.duration.instant === true &&
        durationCheck.instant.duration.min === 0, JSON.stringify(durationCheck.instant.duration));
  check('overnight label has no literal bracket', durationCheck.overnight.label === 'chill',
        durationCheck.overnight.label);
  check('overnight is recognised as timing considered', durationCheck.overnight.duration.overnight === true &&
        durationCheck.overnight.duration.openEnded === true, JSON.stringify(durationCheck.overnight.duration));
  check('ordinary numeric durations still work', durationCheck.normal.duration.min === 40,
        JSON.stringify(durationCheck.normal.duration));
  const badgeCheck = await page.evaluate(() => ({
    instant: durationBadge({min:0,max:0,openEnded:false,instant:true}),
    overnight: durationBadge({min:null,max:null,openEnded:true,overnight:true})
  }));
  check('instant badge reads INSTANT, not faded', badgeCheck.instant.includes('INSTANT') && !badgeCheck.instant.includes('open-ended'),
        badgeCheck.instant);
  check('overnight badge reads OVERNIGHT, faded like until-done', badgeCheck.overnight.includes('OVERNIGHT') && badgeCheck.overnight.includes('open-ended'),
        badgeCheck.overnight);

  // R3: the Group Viewer has no functional gap left.
  await page.click('.navlink[data-view="planner"]');
  await page.waitForTimeout(400);
  await page.locator('.group-badge').first().click();
  await page.waitForTimeout(500);
  check('group viewer opens', await page.isVisible('#view-group-viewer'));
  check('the nav highlight survives it',
        (await page.locator('.navlink.active').first().getAttribute('data-view')) === 'planner',
        await page.locator('.navlink.active').first().getAttribute('data-view'));

  for (const id of ['groupResetTicksBtn', 'groupExportPngBtn', 'groupPrintBtn']) {
    check(`group has ${id}`, await page.isVisible('#' + id));
  }
  check('group has a keep-awake toggle',
        (await page.locator('#view-group-viewer .keep-awake-toggle').count()) === 1);
  const perRecipe = await page.locator('.stacked-recipe').count();
  check('every recipe gets its own controls',
        (await page.locator('.stacked-recipe [data-group-action="open"]').count()) === perRecipe &&
        (await page.locator('.stacked-recipe [data-group-action="edit"]').count()) === perRecipe &&
        (await page.locator('.stacked-recipe [data-group-action="favourite"]').count()) === perRecipe,
        perRecipe + ' recipes');

  // Each flow is scaled to what the planner day asks for.
  const scaledTo = await page.evaluate(() => {
    // Earlier checks have moved the plan around, so set this group's own day
    // explicitly rather than assuming what is still on it.
    const group = loadGroups().find(g => g.id === state.selectedGroupId);
    const p = loadPlan();
    p[group.dateIso] = { recipeIds: group.recipeIds.slice(), servings: [8, 0] };
    savePlan(p);
    renderGroupViewer();
    return group.recipeIds.map(id => {
      const r = loadRecipes().find(x => x.id === id);
      return r.title + ' base ' + r.servings;
    });
  });
  await page.waitForTimeout(400);
  const groupText = await page.locator('#groupFlowMount').textContent();
  // Test Pasta is written for 4 with 300 g pasta, so cooking for 8 is 600 g.
  check('group flow scales to the planner headcount',
        /SERVES 8/.test(groupText) && /600\s*g/.test(groupText),
        (groupText.match(/SERVES \d+/g) || []).join(',') + ' | ' + scaledTo.join('; '));
  // The other recipe has no override, so it stays as written.
  check('and leaves an un-overridden recipe as written', /SERVES 2/.test(groupText),
        (groupText.match(/SERVES \d+/g) || []).join(','));

  // Ticks are shared with the single Viewer, and reset clears the lot.
  await page.locator('#groupFlowMount .ing-cell, #groupFlowMount .box-cell').first().click();
  await page.waitForTimeout(300);
  const groupTicked = await page.locator('#groupFlowMount .done').count();
  check('ticking works in the group', groupTicked > 0, groupTicked + ' done');

  await page.locator('.stacked-recipe [data-group-action="open"]').first().click();
  await page.waitForTimeout(500);
  check('OPEN goes to the single recipe', await page.isVisible('#view-viewer'));
  check('and carries the ticks over', (await page.locator('#flowMount .done').count()) > 0,
        (await page.locator('#flowMount .done').count()) + ' done');
  await page.click('#backToRecipes');
  await page.waitForTimeout(500);
  check('and back returns to the group', await page.isVisible('#view-group-viewer'));

  await page.click('#groupResetTicksBtn');
  await page.waitForTimeout(300);
  check('group reset clears every tick', (await page.locator('#groupFlowMount .done').count()) === 0);
  check('and stays on the group', await page.isVisible('#view-group-viewer'));

  await page.screenshot({ path: path.join(__dirname, 'settings.png'), fullPage: false });

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log(`${c.pass ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  (' + c.detail + ')' : ''}`);
  }
  console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nno console/page errors');
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})();
