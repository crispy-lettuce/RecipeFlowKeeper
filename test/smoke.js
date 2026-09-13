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
