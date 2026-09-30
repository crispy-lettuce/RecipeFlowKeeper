/* Boots the app against the stub and walks every screen, failing on any
   uncaught error. Re-run after each Phase 2 step. */
const { chromium } = require('playwright');

/* Playwright finds its own browser by default. PLAYWRIGHT_CHROMIUM is only
   needed where the repo's Chromium lives somewhere Playwright doesn't look. */
const launchOpts = process.env.PLAYWRIGHT_CHROMIUM
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
  : {};
const path = require('path');
const { FIXTURE_NOW } = require('./fixture-time');

/* Results print the moment they are recorded, not at the end. Until 23 Sep
   they were held and printed after the last step, so a crash anywhere in the
   run — a click that timed out because an earlier mutation broke its
   precondition — reported nothing at all, and two mutations in the
   architecture review were "caught" only by that silence
   (docs/REVIEW-ARCHITECTURE-FINDINGS.md, F7). Now the last line printed names
   the check the run died after. */
const checks = [];
const check = (name, pass, detail) => {
  checks.push({name, pass, detail});
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};

(async () => {
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    // Google Fonts is blocked by this sandbox's egress proxy — not an app fault.
    /* Network errors this sandbox produces for anything outside it, none of
       which is an app fault:
         ERR_CERT_AUTHORITY_INVALID  the TLS-intercepting proxy, on Google Fonts
         ERR_TUNNEL_CONNECTION_FAILED  the proxy refusing outbound entirely,
             which is what the R3 fixture's external image URL hits — and that
             fixture has to carry a real external URL, because "not yet
             self-hosted" is the whole state it exists to represent.
       The browser's message for these carries neither the URL nor the other
       tokens, so each needs naming or the suite can never go green here.
         ERR_NAME_NOT_RESOLVED  the same two fetches on a GitHub Actions
             runner, which has no route to the fonts or to the fixture's
             made-up host and says so by failing DNS. Found by the first CI
             run, 23 Sep: 197 checks passed and the job still exited 1.
       Everything else still fails the run. */
    if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_BLOCKED|ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(m.text())) {
      errors.push('CONSOLE: ' + m.text());
    }
  });

  /* The page's Date is pinned to the fixture's date (timers keep running).
     Without this the suite's meaning changed with the weekday — see
     fixture-time.js. */
  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await page.waitForTimeout(1200);

  check('signed in past the login gate', !(await page.isVisible('#loginGate')));
  /* core.js and the page agree on their version, so no reload notice (PR 6a). */
  check('the page and core.js match, so no update notice shows', !(await page.isVisible('#coreBar')));
  check('recipe library rendered', (await page.locator('.rcard').count()) > 0,
        (await page.locator('.rcard').count()) + ' cards');

  // Walk every nav destination.
  /* Swaps is not in the sidebar since 30 Sep 2026: it is a section of Settings (docs/PLAN-LAYOUT.md, E). */
  for (const view of ['planner','shopping','history','settings','recipes']) {
    await page.click(`.navlink[data-view="${view}"]`);
    await page.waitForTimeout(350);
    const target = view === 'shortlist' ? 'planner' : view;
    check(`${view} view opens`, await page.isVisible(`#view-${target}`));
  }

  /* PR 6b: a tick is keyed by the ingredient's name alone. Ticks in the old
     "name|unit" keys can never match a row again, so they are deleted at
     start-up, by name, and the new ones are left alone. */
  const purge = await page.evaluate(() => {
    const week = weekStartIsoOf(groupDaysByWeek(dayList())[0]);
    const del = (window.__WRITES__ || []).filter(w => w.table === 'shopping_checked' && w.op === 'delete');
    return { week, weeks: Object.keys(cache.shoppingChecked), kept: Object.keys(cache.shoppingChecked[week] || {}).sort(),
             deleted: del.map(w => (w.in && w.in.values || []).slice().sort()) };
  });
  check('old-format ticks are purged at start-up, new ones kept',
        purge.weeks.length === 1 && purge.weeks[0] === purge.week && JSON.stringify(purge.kept) === '["basil","both|basil"]',
        JSON.stringify(purge));
  check('and deleted on the server by name, in one write',
        purge.deleted.length === 1 && JSON.stringify(purge.deleted[0]) === '["both|chopped tomatoes|g","garlic|clove"]',
        JSON.stringify(purge.deleted));

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

  await page.click('[data-settings-tab-btn="app"]');  // Appearance is on Settings' App tab since 30 Sep
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
  await page.click('[data-settings-tab-btn="ingredients"]');  // the tab is remembered: leave Settings as the checks below expect

  /* ---- The food diary (H1, H2, H3) ----
     The stub seeds one cooked recipe with a meal type, one without, and
     one ad-hoc entry, so every shape the diary holds is on screen. */
  await page.click('.navlink[data-view="history"]');
  await page.waitForTimeout(500);
  /* Derived from the fixture rather than hard-coded: a count written as a
     literal makes every future fixture change look like a regression, which
     trains people to edit the number instead of reading the failure. */
  const expectedAdHocDays = await page.evaluate(() =>
    new Set(loadDiary().filter(e => !e.recipeId).map(e => e.cookedOn)).size);
  const adHocCellsShown = await page.locator('.history-day.has-adhoc').count();
  check('every day with an ad-hoc entry is flagged on the calendar',
        adHocCellsShown === expectedAdHocDays,
        adHocCellsShown + ' shown, ' + expectedAdHocDays + ' expected');

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
  const diaryBefore = await page.evaluate(() => loadDiary().length);
  await page.click('#historyAddEntryBtn');
  await page.waitForTimeout(300);
  check('ad-hoc dialog opens', await page.isVisible('#adHocOverlay .mini-panel'));
  check('autocomplete offers names already used',
        (await page.locator('#adHocVocab option').count()) >= 1);
  /* The autocomplete puts a user-typed title into an HTML attribute. The
     fixture includes a title containing a double quote, which before
     escapeHtml handled quotes would break out of value="..." and inject an
     attribute. Asserting on the parsed DOM, not the markup string: if the
     escape fails the browser sees an extra attribute, and the option's
     value is truncated at the quote. */
  const attrSafety = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('#adHocVocab option')];
    const hit = opts.find(o => o.value.includes('onfocus'));
    return {
      found: !!hit,
      value: hit ? hit.value : null,
      strayAttrs: hit ? [...hit.attributes].map(a => a.name).filter(n => n !== 'value') : []
    };
  });
  check('a quote in an entry name does not break out of the attribute',
        attrSafety.found && attrSafety.value === 'x" onfocus="alert(1)'
          && attrSafety.strayAttrs.length === 0,
        JSON.stringify(attrSafety));
  await page.click('#adHocSave');
  await page.waitForTimeout(250);
  check('a nameless entry is refused', await page.isVisible('#adHocError'));
  await page.fill('#adHocTitle', 'Chip shop tea');
  await page.click('#adHocMealChoices .meal-type-btn[data-meal="dinner"]');
  await page.click('#adHocSave');
  await page.waitForTimeout(500);
  const diaryCount = await page.evaluate(() => loadDiary().length);
  check('the new entry is in the diary', diaryCount === diaryBefore + 1,
        diaryCount + ' after, ' + diaryBefore + ' before');
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
  check('the log is saved before the prompt is answered',
        loggedBeforeAnswering === diaryBefore + 2,
        loggedBeforeAnswering + ' entries, expected ' + (diaryBefore + 2));
  await page.click('#mealTypeChoices .meal-type-btn[data-meal="lunch"]');
  await page.waitForTimeout(400);
  const newest = await page.evaluate(() =>
    loadDiary().slice().sort((a,b)=>b.cookedOn.localeCompare(a.cookedOn))[0].mealType);
  check('choosing a meal type tags the entry in memory', newest === 'lunch', String(newest));

  /* And that it reaches the database. The version of this check that only
     read loadDiary() passed while the write was throwing a TypeError, because
     the cache is updated before the write is queued. Asserting on the
     recorded write is what makes the column names real: a patch built with
     `mealType` instead of `meal_type` would satisfy the cache and lose every
     meal type the household ever taps. */
  const mealWrite = await page.evaluate(() =>
    window.__WRITES__.filter(w => w.table === 'recipe_logs' && w.op === 'update').pop() || null);
  check('the meal type is actually written', mealWrite !== null,
        mealWrite ? '' : 'no update reached recipe_logs');
  check('written with the database\'s own column name',
        mealWrite && mealWrite.patch && mealWrite.patch.meal_type === 'lunch',
        mealWrite ? JSON.stringify(mealWrite.patch) : '-');
  check('and aimed at the row just logged',
        mealWrite && mealWrite.match && mealWrite.match.column === 'id',
        mealWrite ? JSON.stringify(mealWrite.match) : '-');

  /* A meal type tapped before its own insert has round-tripped must still
     land — the exact race a live run against the real backend found on
     28 Sep (F13): updateDiaryEntry checked unsavedDiaryIds before it ever
     queued its own write, so "still in flight" and "genuinely failed"
     looked identical, and a fast tap — human or scripted — almost always
     found the insert not yet confirmed and silently dropped the update,
     while the "Tagged as X" toast fired regardless. The stub answers a
     write on the same tick by default, so this could never race here
     before; __WRITE_DELAY__ holds both writes open long enough to force
     the same window a real network round trip does. Driven through the
     app's own functions rather than the overlay, since the race is in the
     data layer, not the click wiring — that part is unchanged and already
     covered above by the ordinary meal-type checks. */
  await page.evaluate(() => {
    loadRecipes().push({ id: uid(), title: 'Race Test', source: '', servings: 2,
      tags: { course: '', keywords: [] }, history: [],
      syntax: 'TITLE: Race Test\nSERVINGS: 2\n\nGROUP a:\n1 test ingredient\n\nSTAGE:\nMERGE a -> done: Mix [instant]' });
  });
  await page.evaluate(() => { window.__WRITE_DELAY__ = 300; });
  const raceId = await page.evaluate(() => {
    const r = loadRecipes().find(x => x.title === 'Race Test');
    logRecipeUsed(r.id);
    const entry = loadDiary().find(e => e.recipeId === r.id);
    updateDiaryEntry(entry.id, { mealType: 'dinner' }); // tapped before the 300ms insert resolves
    closeMealTypePrompt(); // the click handler's job, done by hand since this bypasses it
    return entry.id;
  });
  await page.waitForTimeout(900); // insert + update each held open 300ms, serialised — 900ms clears both
  await page.evaluate(() => { window.__WRITE_DELAY__ = 0; });
  const raceMealType = await page.evaluate((id) => loadDiary().find(e => e.id === id).mealType, raceId);
  check('a meal type tapped before its own insert is confirmed still lands',
        raceMealType === 'dinner', String(raceMealType));
  const raceWrite = await page.evaluate((id) =>
    window.__WRITES__.filter(w => w.table === 'recipe_logs' && w.op === 'update' && w.match && w.match.value === id).pop() || null,
    raceId);
  check('and reaches the database, not just the cache',
        raceWrite && raceWrite.patch && raceWrite.patch.meal_type === 'dinner',
        raceWrite ? JSON.stringify(raceWrite.patch) : 'no update reached recipe_logs for this entry');

  /* H3: the CSV, read from the file the app actually produces.

     The version of this block that came before built a CSV inside the test
     from its own literal header and its own row logic, then asserted against
     that. Every one of those checks would have passed with exportDiaryCsv
     deleted. They had also already drifted from it — the test joined with \n
     where the app uses \r\n, and omitted the BOM whose four-line
     justification sits in the source. Downloading the real file is the only
     version of this that means anything, and the backup check below already
     showed the harness can do it. */
  await page.click('.navlink[data-view="history"]');
  await page.waitForTimeout(300);
  const csv = await (async () => {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#historyCsvBtn'),
    ]);
    const tmp = require('path').join(require('os').tmpdir(), 'kitchen-diary-check.csv');
    await dl.saveAs(tmp);
    return { name: dl.suggestedFilename(), text: require('fs').readFileSync(tmp, 'utf8') };
  })();
  const csvLines = csv.text.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);

  check('CSV downloads with a dated filename', /^kitchen-diary-\d{4}-\d{2}-\d{2}\.csv$/.test(csv.name), csv.name);
  /* The BOM is why an accented ingredient survives Excel. Nothing else in
     the suite would notice it going missing. */
  check('CSV starts with a BOM for Excel', csv.text.charCodeAt(0) === 0xFEFF,
        'first char code ' + csv.text.charCodeAt(0));
  check('CSV uses CRLF line endings', csv.text.includes('\r\n'));
  check('CSV header matches the brief',
        csvLines[0] === '"Date","Meal type","Entry","Source","Course","Ingredients"', csvLines[0]);
  check('CSV has one row per diary entry',
        csvLines.length - 1 === (await page.evaluate(() => loadDiary().length)),
        (csvLines.length - 1) + ' rows');
  check('CSV distinguishes recipe from ad hoc',
        csv.text.includes('"Ad hoc"') && csv.text.includes('"Recipe"'));
  check('CSV strips quantities from ingredients',
        csv.text.includes('dried pasta') && !/\b300 g\b/.test(csv.text));
  check('CSV leaves ad-hoc course and ingredients blank',
        /"Fish and chips","Ad hoc","",""/.test(csv.text),
        csvLines.find(l => l.includes('Fish and chips')));
  check('CSV rows are ordered by date',
        (() => { const d = csvLines.slice(1).map(l => l.slice(1, 11));
                 return d.every((v, i) => i === 0 || d[i-1] <= v); })(),
        csvLines.slice(1).map(l => l.slice(1, 11)).join(' '));
  /* A cell beginning = + - or @ is a formula to Excel, quotes or not. */
  check('CSV neutralises spreadsheet formulas',
        !/,"[=+@]/.test(csv.text) && !/^"[=+@]/m.test(csv.text),
        (csv.text.match(/"[=+@][^"]*"/) || ['none'])[0]);

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
  /* S1 claims week-start drives Planner, Shopping and History together.
     History's bucketing is checked above; the Planner's was not — this line
     used to collect week labels and then never assert on them. */
  /* The planner's day list starts at TODAY, so the first row is whatever
     day it happens to be — asserting Friday there tests the calendar, not
     the app. What week-start actually governs is where the BUCKET
     BOUNDARIES fall, so that is what to check: every bucket after the first
     must open on the configured day. */
  const bucketOpeners = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#plannerDays .week-label, .planner-days .week-label, .week-label')
      .forEach(label => {
        let el = label.nextElementSibling;
        while(el && !el.classList.contains('day-row')) el = el.nextElementSibling;
        if(el) out.push(el.textContent.trim().slice(0, 12));
      });
    return out;
  });
  /* At least two, or "every bucket after the first" is true of nothing. */
  check('planner groups days into week buckets', bucketOpeners.length >= 2, bucketOpeners.join(' | '));
  check('every bucket after the first opens on the configured day (Friday)',
        bucketOpeners.slice(1).every(t => /\bFRI\b/i.test(t)),
        bucketOpeners.join(' | '));
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
  /* By the row's own name, not its whole text: since PR 6b a row lists its
     recipes underneath, and "Test Pasta" is one of them on the tomato row. */
  const pasta = await page.evaluate(() => [...document.querySelectorAll('.shop-item')]
    .filter(el => /pasta/i.test(el.dataset.name || ''))
    .map(el => el.textContent.replace(/\s+/g, ' ').trim()));
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
  /* R5 retired multiplier buttons (×2, ×3) in favour of a headcount. The
     previous version of this checked for `[data-viewer-scale], [data-scale]`
     — two attributes the app has never used, so it asserted the absence of
     things that were never there and would not have noticed multipliers
     reappearing under any other name. Check what is actually on screen:
     the scale控 controls must offer people, never a × multiplier. */
  const scaleLabels = await page.locator('.viewer-scale-row button').allTextContents();
  check('scale controls exist at all', scaleLabels.length > 0, scaleLabels.join(','));
  check('and none of them is a multiplier',
        !scaleLabels.some(t => /[×x]\s*\d/i.test(t.trim())), scaleLabels.join(','));
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
  /* Count writes to `recipes` BEFORE the blocked save, and compare after.
     The previous version asserted that no write to that table had happened
     at any point in the entire run — which passes today only because
     nothing earlier in the suite writes it. Adding a favourite-toggle test
     upstream would have broken this check for a reason that has nothing to
     do with what it is testing. */
  const writesBefore = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes').length);
  await page.click('#saveBtn');
  await page.waitForTimeout(300);
  const err = await page.locator('#saveError').textContent();
  check('save blocked with servings empty', /servings/i.test(err) && await page.isVisible('#saveError'), err.trim().slice(0, 70));
  const writesAfter = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes').length);
  check('nothing written when blocked', writesAfter === writesBefore,
        writesBefore + ' before, ' + writesAfter + ' after');

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

  /* The quantity reader (docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §4.6).
     Before 22 Sep, "1 3/4 tbsp" read as 1 and doubled to "2 3/4"; ranges,
     "up to" and "3 x 400 g" were no quantity at all, so never scaled. Each
     check below was run against the mutation named beside it and failed. */
  const qtyRead = await page.evaluate(() => {
    const x2 = l => scaleRecipeSyntax('GROUP a:\n' + l, 2).split('\n')[1];
    const amt = l => { const a = parseIngredientAmount(splitQty(l).qty); return a && a.amount; };
    return {
      mixed: [amt('1 1/2 tsp ground mace'), x2('1 1/2 tsp ground mace')],       // mutation: drop the mixed-number branch
      vulgar: [amt('1½ tsp ground mace'), amt('1 ½ tsp ground mace')],         // mutation: drop the attached-fraction branch
      range: [x2('2-3 tbsp capers'), x2('2–3 tbsp capers'), amt('2-3 tbsp capers')], // mutation: drop the range branch / buy the lower figure
      pack: [x2('3 x 400 g tins butter beans'), amt('3 x 400 g tins butter beans')],  // mutation: scale the pack size instead
      upTo: x2('up to 300 ml cider'),                                          // mutation: drop the "up to" branch
      display: splitQty('1 3/4 tbsp fish sauce'),                              // mutation: revert splitQty
      longUnit: splitQty('500 grams strong flour')
    };
  });
  check('a mixed number reads whole and scales', qtyRead.mixed[0] === 1.5 && qtyRead.mixed[1] === '3 tsp ground mace',
        JSON.stringify(qtyRead.mixed));
  check('"1½" and "1 ½" read as 1.5', qtyRead.vulgar[0] === 1.5 && qtyRead.vulgar[1] === 1.5, JSON.stringify(qtyRead.vulgar));
  check('a range scales at both ends and buys the upper figure',
        qtyRead.range[0] === '4-6 tbsp capers' && qtyRead.range[1] === '4–6 tbsp capers' && qtyRead.range[2] === 3,
        JSON.stringify(qtyRead.range));
  check('"3 x 400 g" scales the count, not the tin, and totals 1.2 kg',
        qtyRead.pack[0] === '6 x 400 g tins butter beans' && qtyRead.pack[1] === 1200, JSON.stringify(qtyRead.pack));
  check('"up to" scales and keeps its words', qtyRead.upTo === 'up to 600 ml cider', qtyRead.upTo);
  check('the flow table shows the whole quantity',
        qtyRead.display.qty === '1 3/4 tbsp' && qtyRead.display.rest === 'fish sauce'
        && qtyRead.longUnit.qty === '500 grams' && qtyRead.longUnit.rest === 'strong flour',
        JSON.stringify([qtyRead.display, qtyRead.longUnit]));

  /* 6c-1 (28 Sep): the preview checks what comes in. Lines the parser reads
     past, ingredient lines the shopping list can't total, and on request
     the source's list beside the recipe's. Advice only: a save goes
     through whatever they say. */
  await page.fill('#importInput', ['TITLE: Checks Test', 'SOURCE: Blue Door Bakery', 'SOURCE_URL: https://example.com/checks', 'SERVINGS: 2', '',
    'GROUP a:', '3 tbsp honey or golden syrup', '400 ml tin plum tomatoes', '1 large onion, chopped', 'grated parmesan', '',
    'GROUP b-c:', '1 carrot', '',
    'STAGE:', 'MERGE a -> done: Cook [5 min]', 'Stir well'].join('\n'));
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  const checksShown = await page.evaluate(() => {
    const box = document.getElementById('addChecks');
    return { unread: [...box.querySelectorAll('.line-checks.unread code')].map(c => c.textContent),
             faulty: [...box.querySelectorAll('.line-checks:not(.unread) .line-check > code')].map(c => c.textContent),
             useButtons: box.querySelectorAll('[data-use-line]').length };
  });
  check('the preview lists the lines the parser read past',
        checksShown.unread.join('|') === 'GROUP b-c:|Stir well', JSON.stringify(checksShown.unread));
  check('and the lines the shopping list cannot total, not the ones it copes with',
        checksShown.faulty.join('|') === '3 tbsp honey or golden syrup|400 ml tin plum tomatoes', JSON.stringify(checksShown.faulty));
  check('with a one-tap rewrite only where there is one right answer', checksShown.useButtons === 1, checksShown.useButtons + ' buttons');
  await page.click('[data-use-line="400 ml tin plum tomatoes"]');
  await page.waitForTimeout(300);
  const afterUse = await page.evaluate(() => ({
    text: document.getElementById('importInput').value,
    still: [...document.querySelectorAll('#addChecks .line-checks:not(.unread) .line-check > code')].map(c => c.textContent)
  }));
  check('USE THIS rewrites the line in place and re-checks',
        afterUse.text.includes('\n400 g plum tomatoes (1 tin)\n') && !afterUse.text.includes('400 ml tin') && afterUse.still.join('|') === '3 tbsp honey or golden syrup',
        JSON.stringify(afterUse.still));

  // The source comparison, against a made-up reply from the function.
  await page.evaluate(() => {
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = call => call.name === 'source-ingredients'
      ? { data: { pageUrl: call.body.pageUrl, name: 'Checks', ingredients: ['3 tbsp honey or golden syrup', '1 (14 oz) can plum tomatoes', '1 large onion', '1 carrot', '1 tsp Italian seasoning'] }, error: null }
      : { data: null, error: null };
  });
  await page.click('#compareSourceBtn');
  await page.waitForTimeout(300);
  const compared = await page.evaluate(() => ({
    call: window.__INVOKES__.find(c => c.name === 'source-ingredients') || null,
    misses: [...document.querySelectorAll('#sourceCompareOut tr.miss td')].map(td => td.textContent).filter(t => t !== '—'),
    rows: document.querySelectorAll('#sourceCompareOut tr').length
  }));
  check('COMPARE WITH SOURCE asks the function for this recipe\'s source page',
        compared.call && compared.call.body.pageUrl === 'https://example.com/checks', JSON.stringify(compared.call));
  check('and highlights what is on one side only: here the dropped seasoning and the unmatched parmesan',
        compared.misses.slice().sort().join('|') === '1 tsp Italian seasoning|grated parmesan', JSON.stringify(compared.misses));
  await page.evaluate(() => { window.__INVOKE_REPLY__ = { data: null, error: { message: 'Function not found' } }; });
  await page.click('#compareSourceBtn');
  await page.waitForTimeout(300);
  const notDeployed = await page.locator('#sourceCompareOut').textContent();
  check('a function that is not there says so, rather than failing silently', /Couldn't reach the source check.*Function not found/.test(notDeployed), notDeployed.trim().slice(0, 90));
  await page.evaluate(() => { window.__INVOKE_REPLY__ = null; });

  /* PR 7d (28 Sep): for the sites that refuse the function, a list pasted
     from the page. It fetches nothing and writes nothing. */
  await page.evaluate(() => { window.__INVOKE_REPLY__ = { data: { error: 'the source page returned 403', pageUrl: 'https://example.com/checks', ingredients: [] }, error: null }; });
  await page.click('#compareSourceBtn');
  await page.waitForTimeout(300);
  const refusedSite = await page.locator('#sourceCompareOut').textContent();
  check('a site that refuses the function points at the paste box, not just at "compare by eye"',
        /returned 403.*paste its list into the box above/.test(refusedSite), refusedSite.trim().slice(0, 120));
  await page.evaluate(() => { window.__INVOKE_REPLY__ = null; window.__INVOKES__.length = 0; });
  const writesBeforePaste = await page.evaluate(() => (window.__WRITES__ || []).length);
  await page.click('#comparePastedBtn');
  await page.waitForTimeout(200);
  const pasteEmpty = await page.evaluate(() => ({ out: document.getElementById('sourceCompareOut').textContent, rows: document.querySelectorAll('#sourceCompareOut tr').length }));
  check('an empty paste box says there is nothing to compare, rather than drawing an empty table',
        /Nothing to compare yet/.test(pasteEmpty.out) && pasteEmpty.rows === 0, JSON.stringify(pasteEmpty));
  await page.fill('#sourcePasteInput', ['Ingredients', '▢ 3 tbsp honey or golden syrup', '▢ 1 (14 oz) can plum tomatoes', '▢ 1 large onion', 'For the topping:', '▢ 1 carrot', '▢ 1 tsp Italian seasoning'].join('\n'));
  await page.click('#comparePastedBtn');
  await page.waitForTimeout(300);
  const pasted = await page.evaluate(() => ({
    misses: [...document.querySelectorAll('#sourceCompareOut tr.miss td')].map(td => td.textContent).filter(t => t !== '—'),
    heading: (document.querySelector('#sourceCompareOut th') || {}).textContent,
    invokes: window.__INVOKES__.length,
    writes: (window.__WRITES__ || []).length
  }));
  check('COMPARE PASTED LIST highlights what is on one side only, the page\'s tick boxes and headings dropped first',
        pasted.misses.slice().sort().join('|') === '1 tsp Italian seasoning|grated parmesan' && pasted.heading === 'PASTED (5)', JSON.stringify(pasted));
  check('    and pasting fetches nothing and writes nothing', pasted.invokes === 0 && pasted.writes === writesBeforePaste, JSON.stringify(pasted));
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  const afterReparse = await page.evaluate(() => ({ box: document.getElementById('sourcePasteInput').value, out: document.getElementById('sourceCompareOut').textContent.trim() }));
  check('a re-parse (or USE THIS) keeps what was pasted, and clears the table it no longer describes',
        afterReparse.box.includes('▢ 1 tsp Italian seasoning') && afterReparse.out === '', JSON.stringify(afterReparse));

  /* PR 7e (28 Sep): a pair can match on its words and still differ. That is
     shown, with what differs, and counted — never left looking matched. */
  const comparePasted = async lines => {
    await page.fill('#sourcePasteInput', lines.join('\n'));
    await page.click('#comparePastedBtn');
    await page.waitForTimeout(300);
    return page.evaluate(() => ({
      hint: ((document.querySelector('#sourceCompareOut .hint') || {}).textContent || '').trim(),
      misses: [...document.querySelectorAll('#sourceCompareOut tr.miss')].length,
      why: [...document.querySelectorAll('#sourceCompareOut tr.miss .why')].map(d => d.textContent)
    }));
  };
  const amountDiffers = await comparePasted(['2 tbsp honey or golden syrup', '1 (14 oz) can plum tomatoes', '1 large onion', 'grated parmesan', '1 carrot']);
  check('a pair that matches on its words but not its amount is highlighted, says what differs, and is counted',
        amountDiffers.misses === 1 && amountDiffers.why.join('|') === 'amounts differ: source 2 tbsp; recipe 3 tbsp' && /^1 to look at/.test(amountDiffers.hint), JSON.stringify(amountDiffers));
  const allAgree = await comparePasted(['3 tbsp honey or golden syrup', '1 (14 oz) can plum tomatoes', '1 large onion', 'grated parmesan', '1 carrot']);
  check('when every ingredient and every comparable amount agrees it says so, and says what it did not compare',
        allAgree.misses === 0 && /found its match, and the amounts that can be compared agree/.test(allAgree.hint) && /cups against grams/.test(allAgree.hint), JSON.stringify(allAgree));
  const wordsDiffer = await comparePasted(['3 tbsp honey or golden syrup', '1 (14 oz) can cherry tomatoes', '1 large onion', 'grated parmesan', '1 carrot']);
  check('cherry tomatoes for plum tomatoes, which share a word, are shown paired but flagged, not quietly matched',
        wordsDiffer.misses === 1 && /not the same wording: the recipe adds plum; the source has cherry/.test(wordsDiffer.why.join('|')), JSON.stringify(wordsDiffer));

  // Advice, never a gate: the recipe saves with warnings still showing.
  const recipeWritesBefore = await page.evaluate(() => (window.__WRITES__ || []).filter(w => w.table === 'recipes').length);
  await page.click('#saveBtn');
  await page.waitForTimeout(400);
  const savedWithWarnings = await page.evaluate(() => ({
    writes: (window.__WRITES__ || []).filter(w => w.table === 'recipes').length,
    id: (loadRecipes().find(r => r.title === 'Checks Test') || {}).id || null
  }));
  check('a recipe with warnings still saves', savedWithWarnings.id && savedWithWarnings.writes > recipeWritesBefore, JSON.stringify(savedWithWarnings));
  await page.evaluate(id => deleteRecipe(id), savedWithWarnings.id);
  await page.waitForTimeout(300);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);

  /* PR 7e: a recipe that names its product more specifically than its source, where the
     dictionary says the two are one product, is a soft note: shaded, listed and counted
     apart from a hard difference, so a bare "soy sauce" made light is seen and a shorthand
     the converter's own example uses does not read like a fault. */
  await page.fill('#importInput', ['TITLE: Soft Note Test', 'SOURCE: Blue Door Bakery', 'SERVINGS: 2', '', 'GROUP a:', '2 tbsp light soy sauce', '1 carrot', '',
    'STAGE:', 'MERGE a -> done: Cook [5 min]'].join('\n'));
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  await page.fill('#sourcePasteInput', ['2 tbsp soy sauce', '1 carrot'].join('\n'));
  await page.click('#comparePastedBtn');
  await page.waitForTimeout(300);
  const softShown = await page.evaluate(() => ({
    hint: ((document.querySelector('#sourceCompareOut .hint') || {}).textContent || '').trim(),
    soft: [...document.querySelectorAll('#sourceCompareOut tr.soft .why')].map(d => d.textContent),
    hard: document.querySelectorAll('#sourceCompareOut tr.miss').length
  }));
  check('a recipe more specific than its source, where the dictionary calls them one product, is a shaded note and not a hard difference',
        softShown.hard === 0 && softShown.soft.join('|') === 'more specific than the source: the recipe adds light', JSON.stringify(softShown));
  check('    and the count says so apart from "to look at", never as though nothing were noted',
        /^Every ingredient found its match/.test(softShown.hint) && /1 line names its product more specifically than the source did \(shaded\)/.test(softShown.hint), softShown.hint);
  await page.fill('#sourcePasteInput', '');

  // The form scales to a headcount too, working the multiplier out of SERVINGS.
  await page.fill('#importInput', 'TITLE: Scale Test\nSOURCE: Somewhere\nSERVINGS: 4\n\nGROUP a:\n300 g pasta\n\nSTAGE:\nMERGE a -> done: Cook [5 min]');
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  check('closing the form forgets a pasted list: a new recipe starts with an empty box', (await page.inputValue('#sourcePasteInput')) === '', await page.inputValue('#sourcePasteInput'));
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

  /* ---- The review band (PR 3 of the add-recipe plan, 29 Sep 2026) ----
     The add form now reads in the order the work goes (what the app read, the checks, then the
     fields) and reviews a recipe against the library, read-only: nothing here may write a row.
     A small invented library is seeded (lentil soup, jackfruit, sumac, mangetout, and
     example.test, a domain reserved so it names no real site) and removed again at the end. */
  await page.evaluate(() => {
    loadRecipes().push(
      { id: 'rv-lentil', title: 'Review Lentil Soup', source: 'Blue Door Bakery', sourceUrl: 'https://www.example.test/lentil-soup/?ref=x', servings: 4,
        tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-01',
        syntax: 'TITLE: Review Lentil Soup\nSOURCE: Blue Door Bakery\nSOURCE_URL: https://www.example.test/lentil-soup/?ref=x\nSERVINGS: 4\n\nGROUP a:\n2 onions, diced\n15 ml olive oil\n200 g red lentils\n\nSTAGE:\nMERGE a -> done: Simmer [20 min]' },
      { id: 'rv-jack', title: 'Review Jackfruit Curry', source: 'Blue Door Bakery', sourceUrl: '', servings: 4,
        tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-02',
        syntax: 'TITLE: Review Jackfruit Curry\nSOURCE: Blue Door Bakery\nSERVINGS: 4\n\nGROUP a:\n400 g jackfruit\n1 onion, sliced\n\nSTAGE:\nMERGE a -> done: Simmer [20 min]' });
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = null;
  });
  const writesBeforeReview = await page.evaluate(() => (window.__WRITES__ || []).length);
  const rvText = (title, lines, header = [], notes = []) => ['TITLE: ' + title, 'SOURCE: Blue Door Bakery', ...header, 'SERVINGS: 4', '',
    'GROUP a:', ...lines, '', 'STAGE:', 'MERGE a -> done: Cook [5 min]', ...(notes.length ? ['', 'NOTES:', ...notes] : [])].join('\n');
  // A paste event, with the text already in the box, as a browser sends it.
  const rvPaste = async text => {
    await page.evaluate(t => { const ta = document.getElementById('importInput'); ta.value = t; ta.dispatchEvent(new Event('paste', { bubbles: true })); }, text);
    await page.waitForTimeout(350);
  };
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);

  await rvPaste(rvText('Paste One', ['1 onion']));
  const rvAfterPaste = await page.evaluate(() => ({ shown: document.getElementById('addForm').style.display, title: document.getElementById('f-title').value,
    summary: document.getElementById('addReadSummary').textContent }));
  await page.fill('#importInput', rvText('Typed Two', ['1 onion']));
  await page.waitForTimeout(300);
  const rvAfterTyping = await page.evaluate(() => ({ title: document.getElementById('f-title').value,
    stale: getComputedStyle(document.getElementById('staleBar')).display, dimmed: document.getElementById('addBands').classList.contains('stale') }));
  check('pasting parses at once, and typing does not: the summary says what the app read',
        rvAfterPaste.shown === 'block' && rvAfterPaste.title === 'Paste One' && rvAfterPaste.summary === 'Paste One · Blue Door Bakery · serves 4 · 1 ingredient · 1 step' && rvAfterTyping.title === 'Paste One',
        JSON.stringify([rvAfterPaste, rvAfterTyping.title]));
  await page.evaluate(() => document.getElementById('recheckBtn').click());
  await page.waitForTimeout(300);
  const rvAfterRecheck = await page.evaluate(() => ({ title: document.getElementById('f-title').value,
    stale: getComputedStyle(document.getElementById('staleBar')).display, dimmed: document.getElementById('addBands').classList.contains('stale') }));
  check('editing after a parse shows the stale bar and dims the bands, and RE-CHECK reads again and clears both',
        rvAfterTyping.stale === 'flex' && rvAfterTyping.dimmed === true && rvAfterRecheck.title === 'Typed Two' && rvAfterRecheck.stale === 'none' && rvAfterRecheck.dimmed === false,
        JSON.stringify([rvAfterTyping, rvAfterRecheck]));
  const rvOrder = await page.evaluate(() => ({ diagram: document.getElementById('addPreview').getBoundingClientRect().top,
    checks: document.getElementById('addChecks').getBoundingClientRect().top, fields: document.getElementById('f-title').getBoundingClientRect().top,
    drawn: document.getElementById('addPreview').children.length }));
  check('the diagram renders above the checks, and the checks above the fields',
        rvOrder.drawn > 0 && rvOrder.diagram < rvOrder.checks && rvOrder.checks < rvOrder.fields, JSON.stringify(rvOrder));

  await rvPaste(rvText('All Known', ['2 onions, diced', '15 ml olive oil']));
  const rvKnown = await page.evaluate(() => ({ quiet: [...document.querySelectorAll('#reviewList .rv-quiet')].map(q => q.textContent.trim()), rows: document.querySelectorAll('#reviewList .rv-row').length }));
  check('a recipe whose names are all known shows one quiet line',
        rvKnown.quiet.join('|') === '2 of 2 ingredients are already on your list.' && rvKnown.rows === 0, JSON.stringify(rvKnown));

  await rvPaste(rvText('Some New', ['1 onion', '1 pinch sumac', '300 g young jackfruit', '175 g mangetout']));
  const rvFresh = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#reviewList .rv-row')].map(r => ({ text: r.textContent.replace(/\s+/g, ' ').trim(), other: !!r.querySelector('.rv-other'),
      rv: [...r.querySelectorAll('[data-rv]')].map(b => b.dataset.rv).join() })),
    buttons: document.querySelectorAll('#reviewList button').length }));
  const rvRowFor = n => rvFresh.rows.find(r => r.text.startsWith(n)) || {};
  /* PR 3 asserted here that "Same as X?" carried no buttons (they were PR 4's). PR 4 gives that row its
     two, so the clause became that ONLY that row had any. SAME AS… (29 Sep, after PR 5) gives every
     other new row one button of its own, so it is now: the "Same as" row has SAME and KEEP APART and
     nothing else, and each other row has exactly SAME AS…. */
  check('a new name landing in Other is marked, one landing in an aisle is not, and "Same as X?" names the existing ingredient',
        rvFresh.rows.length === 3 && rvRowFor('Sumac').other === true && rvRowFor('Young jackfruit').other === true && rvRowFor('Mangetout').other === false
        && /lands under Produce/.test(rvRowFor('Mangetout').text) && /Same as Jackfruit\?/.test(rvRowFor('Young jackfruit').text)
        && rvRowFor('Young jackfruit').rv === 'same,apart' && rvRowFor('Sumac').rv === 'same-as' && rvRowFor('Mangetout').rv === 'same-as' && rvFresh.buttons === 4,
        JSON.stringify(rvFresh));

  await rvPaste(rvText('Same Link', ['1 onion'], ['SOURCE_URL: http://www.EXAMPLE.test/lentil-soup/']));
  const rvDupBefore = await page.evaluate(() => ({ text: document.getElementById('reviewDuplicate').textContent.replace(/\s+/g, ' ').trim(),
    hidden: (document.querySelector('#reviewDuplicate .rv-dup-detail') || {}).hidden }));
  await page.evaluate(() => { const b = document.querySelector('[data-show-dup="rv-lentil"]'); if(b) b.click(); });
  const rvDupAfter = await page.evaluate(() => { const d = document.querySelector('#reviewDuplicate .rv-dup-detail'); return d ? { hidden: d.hidden, text: d.textContent.replace(/\s+/g, ' ').trim() } : { hidden: null, text: '' }; });
  await rvPaste(rvText('Review Lentil Soup', ['1 onion'], ['SOURCE_URL: http://other.test/lentil-soup']));
  const rvDupTitleOnly = await page.evaluate(() => document.getElementById('reviewDuplicate').textContent.trim());
  check('a recipe with the same source link is found, and SHOW IT expands it inline; the same title alone is not a duplicate',
        /Review Lentil Soup.*has the same source link/.test(rvDupBefore.text) && rvDupBefore.hidden === true
        && rvDupAfter.hidden === false && /Blue Door Bakery/.test(rvDupAfter.text) && /added/.test(rvDupAfter.text) && /200 g red lentils/.test(rvDupAfter.text) && rvDupTitleOnly === '',
        JSON.stringify([rvDupBefore, rvDupAfter, rvDupTitleOnly]));

  await rvPaste(rvText('Plain Note', ['1 onion'], [], ['⚠️ Source note: the page gives two different oven times.']));
  const rvPlainNote = await page.evaluate(() => { const n = document.getElementById('sourceNoteRow'); return n ? { red: n.classList.contains('rv-red'), text: n.textContent } : null; });
  await rvPaste(rvText('Reconstructed', ['1 onion'], [], ['⚠️ Source note: the page could not be read, so this recipe was reconstructed from another page.']));
  const rvReconNote = await page.evaluate(() => { const n = document.getElementById('sourceNoteRow'); return n ? { red: n.classList.contains('rv-red'), text: n.textContent.replace(/\s+/g, ' ') } : null; });
  check('a reconstruction note shows the red row and SAVE stays enabled; a note about something else is shown, not alarmed',
        rvPlainNote && rvPlainNote.red === false && /two different oven times/.test(rvPlainNote.text)
        && rvReconNote && rvReconNote.red === true && /could not be read/.test(rvReconNote.text) && /not read from its own page/.test(rvReconNote.text)
        && (await page.isEnabled('#saveBtn')), JSON.stringify([rvPlainNote, rvReconNote]));

  await page.evaluate(() => {
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = call => call.name === 'source-ingredients'
      ? { data: { pageUrl: call.body.pageUrl, name: 'Auto', ingredients: ['2 onions, diced', '1 tsp Italian seasoning'] }, error: null }
      : { data: null, error: null };
  });
  await rvPaste(rvText('Auto Check', ['2 onions, diced'], ['SOURCE_URL: https://example.test/auto-check']));
  const rvAuto1 = await page.evaluate(() => ({ calls: window.__INVOKES__.filter(c => c.name === 'source-ingredients').map(c => c.body.pageUrl), rows: document.querySelectorAll('#sourceCompareOut tr').length }));
  check('the source check runs by itself for an https URL: no button pressed, and the comparison is drawn',
        rvAuto1.calls.join('|') === 'https://example.test/auto-check' && rvAuto1.rows > 0, JSON.stringify(rvAuto1));
  await page.click('#parseBtn');
  await page.waitForTimeout(350);
  const rvAuto2 = await page.evaluate(() => ({ calls: window.__INVOKES__.filter(c => c.name === 'source-ingredients').length, rows: document.querySelectorAll('#sourceCompareOut tr').length }));
  await page.fill('#f-source-url', 'https://example.test/auto-check-2');
  await page.locator('#f-source-url').dispatchEvent('change');
  await page.waitForTimeout(350);
  const rvAuto3 = await page.evaluate(() => window.__INVOKES__.filter(c => c.name === 'source-ingredients').map(c => c.body.pageUrl));
  check('it does not run twice for the same URL, redraws the comparison from what it already has, and runs again for a URL that changes',
        rvAuto2.calls === 1 && rvAuto2.rows > 0 && rvAuto3.join('|') === 'https://example.test/auto-check|https://example.test/auto-check-2', JSON.stringify([rvAuto2, rvAuto3]));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await page.click('#handTemplateBtn');
  await page.waitForTimeout(350);
  const rvHand = await page.evaluate(() => ({ text: document.getElementById('importInput').value, title: document.getElementById('f-title').value,
    source: document.getElementById('f-source').value, status: (document.getElementById('sourceStatus') || {}).textContent, url: document.getElementById('f-source-url').value }));
  await page.fill('#importInput', 'TITLE: Something else\nSOURCE: Somewhere\nSERVINGS: 2\n\nGROUP a:\n1 onion\n\nSTAGE:\nMERGE a -> done: Cook [5 min]');
  await page.click('#handTemplateBtn');
  await page.waitForTimeout(250);
  const rvHandFull = await page.evaluate(() => ({ text: document.getElementById('importInput').value.slice(0, 21), toast: (document.querySelector('.toast.show') || {}).textContent || '' }));
  check('WRITE ONE BY HAND fills an empty box and reads it, and refuses a full one with a word',
        /^TITLE: My recipe\nSOURCE: Personal recipe\nSERVINGS: 4/.test(rvHand.text) && rvHand.title === 'My recipe' && rvHand.source === 'Personal recipe'
        && rvHand.status === 'No source page to compare with.' && rvHand.url === '' && rvHandFull.text === 'TITLE: Something else' && rvHandFull.toast === 'Clear the box first',
        JSON.stringify([rvHand.title, rvHand.source, rvHand.status, rvHand.url, rvHandFull]));

  /* Edit uses the same bands. The recipe being edited is left out of the library, so it is not a
     duplicate of itself and its own names read as they would if it were new; and opening it
     fetches nothing, since until a comparison is stored with the recipe (PR 5) that would fetch
     the source page every time a recipe is opened to change a word. */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const rvInvokesBeforeEdit = await page.evaluate(() => window.__INVOKES__.length);
  await page.evaluate(() => openEditModal('rv-lentil'));
  await page.waitForTimeout(350);
  const rvEdit = await page.evaluate(() => ({
    fresh: [...document.querySelectorAll('#reviewList .rv-row b:first-child')].map(b => b.textContent),
    dup: document.getElementById('reviewDuplicate').textContent.trim(),
    invokes: window.__INVOKES__.length }));
  check('editing a recipe leaves it out of its own review (not a duplicate of itself), and opening it fetches nothing',
        rvEdit.fresh.some(n => /^Red lentil/.test(n)) && rvEdit.dup === '' && rvEdit.invokes === rvInvokesBeforeEdit,
        JSON.stringify([rvEdit, rvInvokesBeforeEdit]));

  const reviewWrites = await page.evaluate(() => ({ writes: (window.__WRITES__ || []).length, invokes: [...new Set(window.__INVOKES__.map(c => c.name))] }));
  check('reading, pasting and reviewing a recipe writes nothing, and the only function it calls is the source check',
        reviewWrites.writes === writesBeforeReview && reviewWrites.invokes.join() === 'source-ingredients', JSON.stringify([writesBeforeReview, reviewWrites]));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    for(let i = loadRecipes().length - 1; i >= 0; i--) if(String(loadRecipes()[i].id).startsWith('rv-')) loadRecipes().splice(i, 1);
    window.__INVOKES__.length = 0; window.__INVOKE_REPLY__ = null;
  });

  /* ---- Answers in place (PR 4 of the add-recipe plan, 29 Sep 2026) ----
     The review asks its questions where they arise and writes only what is tapped, each through the
     function that already writes that kind of row: SAME (then MERGE) and KEEP APART on a "Same as"
     row, USE THAT and KEEP MINE under SOURCE (in place of the save handler's confirm(), now gone),
     UNDO for USE THIS and for SCALE TO SERVE, and a BEFORE YOU SAVE list of what the save will do.
     window.confirm is replaced for the whole block by a counter, so a dialog anywhere in the add path
     is a named failure and not a hang. Invented recipes, removed again at the end; the aliases
     the block writes are put back too. */
  await page.evaluate(() => {
    window.__CONFIRMS__ = 0;
    window.__realConfirm = window.confirm;
    window.confirm = () => { window.__CONFIRMS__++; return false; };
    window.__aliasesBefore = JSON.stringify(cache.aliases);
    loadRecipes().push(
      { id: 'an-jack', title: 'Answer Jackfruit Curry', source: 'Blue Door Bakery', sourceUrl: '', servings: 4,
        tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-03',
        syntax: 'TITLE: Answer Jackfruit Curry\nSOURCE: Blue Door Bakery\nSERVINGS: 4\n\nGROUP a:\n400 g jackfruit\n1 onion, sliced\n\nSTAGE:\nMERGE a -> done: Simmer [20 min]' },
      { id: 'an-lentil', title: 'Answer Lentil Soup', source: 'Blue Door Bakery', sourceUrl: '', servings: 4,
        tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-04',
        syntax: 'TITLE: Answer Lentil Soup\nSOURCE: Blue Door Bakery\nSERVINGS: 4\n\nGROUP a:\n200 g red lentils\n2 onions, diced\n\nSTAGE:\nMERGE a -> done: Simmer [20 min]' });
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = null;
  });
  const anText = (title, source, lines, header = []) => ['TITLE: ' + title, 'SOURCE: ' + source, ...header, 'SERVINGS: 4', '',
    'GROUP a:', ...lines, '', 'STAGE:', 'MERGE a -> done: Cook [5 min]'].join('\n');
  const anMark = () => page.evaluate(() => window.__WRITES__.length);
  const anSince = mark => page.evaluate(m => window.__WRITES__.slice(m).map(w => ({ table: w.table, op: w.op,
    rows: (w.rows || []).map(r => ({ kind: r.kind, alias: r.alias, canonical: r.canonical, source: r.source, syntax: r.syntax, name: r.name })) })), mark);
  const anClick = sel => page.evaluate(s => { const b = document.querySelector(s); if(b) b.click(); return !!b; }, sel);
  const anResetAliases = () => page.evaluate(() => { cache.aliases = JSON.parse(window.__aliasesBefore); rebuildAliasMaps(); });
  const anBeforeSave = () => page.evaluate(() => [...document.querySelectorAll('#addBeforeSave li')].map(li => li.textContent.trim()));
  const anJackLines = ['300 g young jackfruit', '1 onion'];
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);

  // SAME and KEEP APART, on a "Same as" row.
  const anMarkA = await anMark();
  await rvPaste(anText('Same As One', 'Blue Door Bakery', anJackLines));
  const anRow0 = await page.evaluate(() => { const r = document.querySelector('[data-rv="same"]');
    return { same: !!r, apart: !!document.querySelector('[data-rv="apart"]'), text: r ? r.closest('.rv-row').textContent.replace(/\s+/g, ' ') : '' }; });
  await anClick('[data-rv="same"]');
  const anGuard = await page.evaluate(() => { const n = document.querySelector('#reviewList .rv-note');
    return { text: n ? n.textContent.replace(/\s+/g, ' ').trim() : '', merge: !!document.querySelector('[data-rv="merge"]'), cancel: !!document.querySelector('[data-rv="cancel"]') }; });
  await page.waitForTimeout(250);
  const anGuardWrites = (await anSince(anMarkA)).length;
  await anClick('[data-rv="cancel"]');
  await page.waitForTimeout(250);
  const anAfterCancel = await page.evaluate(() => !!document.querySelector('[data-rv="same"]'));
  const anCancelWrites = (await anSince(anMarkA)).length;
  check('CANCEL writes nothing: SAME alone shows the guard ("for every recipe") and writes nothing, and CANCEL puts the row back',
        anRow0.same && anRow0.apart && /Same as Jackfruit\?/.test(anRow0.text) && /Total .*Young jackfruit.* with .*Jackfruit.*for every recipe\?/.test(anGuard.text)
        && anGuard.merge && anGuard.cancel && anGuardWrites === 0 && anAfterCancel && anCancelWrites === 0,
        JSON.stringify([anRow0, anGuard, anGuardWrites, anAfterCancel, anCancelWrites]));
  await anClick('[data-rv="same"]');
  await anClick('[data-rv="merge"]');
  await page.waitForTimeout(300);
  const anMerged = await anSince(anMarkA);
  const anAfterMerge = await page.evaluate(() => ({ buttons: document.querySelectorAll('#reviewList [data-rv]').length,
    text: document.getElementById('reviewList').textContent.replace(/\s+/g, ' '),
    alias: cache.aliases.filter(a => a.kind === 'ingredient' && a.alias === 'young jackfruit').map(a => a.canonical) }));
  check('SAME writes exactly one ingredient alias, new name to existing, and only at MERGE',
        anMerged.length === 1 && anMerged[0].table === 'aliases' && anMerged[0].op === 'upsert' && anMerged[0].rows.length === 1
        && anMerged[0].rows[0].kind === 'ingredient' && anMerged[0].rows[0].alias === 'young jackfruit' && anMerged[0].rows[0].canonical === 'jackfruit'
        && anAfterMerge.buttons === 0 && !/Young jackfruit/.test(anAfterMerge.text) && anAfterMerge.alias.join() === 'jackfruit',
        JSON.stringify([anMerged, anAfterMerge]));

  await anResetAliases();
  await rvPaste(anText('Apart One', 'Blue Door Bakery', anJackLines));
  const anMarkB = await anMark();
  await anClick('[data-rv="apart"]');
  await page.waitForTimeout(300);
  const anApart = await anSince(anMarkB);
  check('KEEP APART writes one distinct row, for the pair in sorted order and with no canonical',
        anApart.length === 1 && anApart[0].table === 'aliases' && anApart[0].rows.length === 1 && anApart[0].rows[0].kind === 'ingredient_distinct'
        && anApart[0].rows[0].alias === 'jackfruit || young jackfruit' && anApart[0].rows[0].canonical === '', JSON.stringify(anApart));
  await rvPaste(anText('Apart Two', 'Blue Door Bakery', anJackLines));
  const anSettled = await page.evaluate(() => ({ buttons: document.querySelectorAll('#reviewList [data-rv]').length, text: document.getElementById('reviewList').textContent.replace(/\s+/g, ' '),
    rv: [...document.querySelectorAll('#reviewList [data-rv]')].map(b => b.dataset.rv).join() }));
  /* Before SAME AS… (29 Sep, after PR 5) the row had no button at all; it now has that one, and only that. */
  check('a settled pair is not offered: after KEEP APART the same names are listed as new, with no "Same as" row',
        anSettled.buttons === 1 && anSettled.rv === 'same-as' && !/Same as/.test(anSettled.text) && /Young jackfruit/.test(anSettled.text), JSON.stringify(anSettled));

  /* SAME AS… (29 Sep, after PR 5): a new name the strict rule never pairs ("whole" is never
     ignored) can be totalled with any name already in the library, from the row. The shopping
     list's MERGE WITH…, at the moment the name arrives: filter, pick, the same guard, and only
     MERGE writes. Invented names. */
  await anResetAliases();
  const saLines = ['300 g whole jackfruit', '1 onion'];
  await rvPaste(anText('Same As Pick', 'Blue Door Bakery', saLines));
  const saMark = await anMark();
  /* Typed through the input event, not page.fill: with the box missing, fill would wait and crash the
     suite instead of failing the check that names it. */
  const saFilter = async q => { await page.evaluate(v => { const f = document.querySelector('#reviewList .rv-sameas-filter');
      if(f){ f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); } }, q); await page.waitForTimeout(80);
    return page.evaluate(() => ({ options: [...document.querySelectorAll('#reviewList [data-rv="same-as-pick"]')].map(b => b.textContent.trim()),
      hint: (document.querySelector('#reviewList .rv-sameas-options .hint') || {}).textContent || '' })); };
  const saRow0 = await page.evaluate(() => [...document.querySelectorAll('#reviewList [data-rv]')].map(b => b.dataset.rv).join());
  await anClick('[data-rv="same-as"]');
  const saOpen = await page.evaluate(() => ({ box: !!document.querySelector('#reviewList .rv-sameas'), focused: document.activeElement && document.activeElement.classList.contains('rv-sameas-filter') }));
  const saJack = await saFilter('jack');
  const saNone = await saFilter('zzqx');
  const saEmpty = await saFilter('');
  check('SAME AS… is offered on a new name the strict rule does not pair, and filters only names already in the library, never the new name itself',
        saRow0 === 'same-as' && saOpen.box && saOpen.focused && saJack.options.join('|') === 'Jackfruit' && !saNone.options.length && /No match in your library/.test(saNone.hint)
        && !saEmpty.options.length, JSON.stringify([saRow0, saOpen, saJack, saNone, saEmpty]));
  await anClick('#reviewList .rv-sameas [data-rv="cancel"]');
  await page.waitForTimeout(150);
  const saAfterCancel1 = await page.evaluate(() => [...document.querySelectorAll('#reviewList [data-rv]')].map(b => b.dataset.rv).join());
  await anClick('[data-rv="same-as"]');
  await saFilter('jack');
  await anClick('[data-rv="same-as-pick"]');
  const saGuard = await page.evaluate(() => { const n = document.querySelector('#reviewList .rv-note');
    return { text: n ? n.textContent.replace(/\s+/g, ' ').trim() : '', merge: !!document.querySelector('#reviewList [data-rv="merge"]') }; });
  await page.waitForTimeout(250);
  const saPickWrites = (await anSince(saMark)).length;
  await anClick('#reviewList [data-rv="cancel"]');
  await page.waitForTimeout(150);
  const saAfterCancel2 = await page.evaluate(() => [...document.querySelectorAll('#reviewList [data-rv]')].map(b => b.dataset.rv).join());
  check('    picking a name writes nothing and shows the same guard as SAME; CANCEL at either step writes nothing and puts the button back',
        /Total .*Whole jackfruit.* with .*Jackfruit.*for every recipe\?/.test(saGuard.text) && saGuard.merge && saPickWrites === 0
        && saAfterCancel1 === 'same-as' && saAfterCancel2 === 'same-as' && (await anSince(saMark)).length === 0,
        JSON.stringify([saGuard, saPickWrites, saAfterCancel1, saAfterCancel2]));
  await anClick('[data-rv="same-as"]');
  await saFilter('jack');
  await anClick('[data-rv="same-as-pick"]');
  await anClick('#reviewList [data-rv="merge"]');
  await page.waitForTimeout(300);
  const saMerged = await anSince(saMark);
  const saAfter = await page.evaluate(() => ({ text: document.getElementById('reviewList').textContent.replace(/\s+/g, ' '), buttons: document.querySelectorAll('#reviewList [data-rv]').length }));
  check('    only MERGE writes: exactly one ingredient alias, the new name to the library\'s, and the row goes',
        saMerged.length === 1 && saMerged[0].table === 'aliases' && saMerged[0].op === 'upsert' && saMerged[0].rows.length === 1
        && saMerged[0].rows[0].kind === 'ingredient' && saMerged[0].rows[0].alias === 'whole jackfruit' && saMerged[0].rows[0].canonical === 'jackfruit'
        && !/Whole jackfruit/.test(saAfter.text) && saAfter.buttons === 0 && /2 of 2 ingredients are already on your list/.test(saAfter.text),
        JSON.stringify([saMerged, saAfter]));
  /* On Edit the recipe being edited is left out, as the review leaves it out: its names are not
     "the library" to total with. */
  const saEditing = await page.evaluate(() => { const was = state.editingRecipeId; state.editingRecipeId = 'an-jack';
    const names = reviewMergeCandidates('whole jackfruit').map(n => n.key); state.editingRecipeId = was;
    return { jack: names.includes('jackfruit'), lentil: names.includes('red lentil') }; });
  check('    on Edit, the recipe being edited is not offered as the library',
        saEditing.jack === false && saEditing.lentil === true, JSON.stringify(saEditing));
  await anResetAliases();

  // The row under SOURCE, in place of the save handler's dialog.
  await anResetAliases();
  const anMarkC = await anMark();
  await rvPaste(anText('Spell One', 'Blue Door', ['1 onion']));
  const anAsked = await page.evaluate(() => { const r = document.getElementById('sourceSpellRow');
    return { shown: getComputedStyle(r).display !== 'none', text: r.textContent.replace(/\s+/g, ' ').trim(), use: !!r.querySelector('[data-spell="use"]'), keep: !!r.querySelector('[data-spell="keep"]'),
      field: document.getElementById('f-source').value }; });
  const anAskedWrites = (await anSince(anMarkC)).length;
  await anClick('[data-spell="use"]');
  await page.waitForTimeout(300);
  const anUse = await anSince(anMarkC);
  const anUseField = await page.inputValue('#f-source');
  check('USE THAT writes a source alias and sets the field, and asking wrote nothing',
        anAsked.shown && /^Looks like Blue Door Bakery \(\d+ recipes?\)\. USE THAT · KEEP MINE$/.test(anAsked.text) && anAsked.use && anAsked.keep && anAsked.field === 'Blue Door' && anAskedWrites === 0
        && anUse.length === 1 && anUse[0].table === 'aliases' && anUse[0].rows[0].kind === 'source' && anUse[0].rows[0].alias === 'Blue Door' && anUse[0].rows[0].canonical === 'Blue Door Bakery'
        && anUseField === 'Blue Door Bakery', JSON.stringify([anAsked, anAskedWrites, anUse, anUseField]));
  await anResetAliases();
  await rvPaste(anText('Spell Two', 'Blue Door', ['1 onion']));
  const anMarkD = await anMark();
  await anClick('[data-spell="keep"]');
  await page.waitForTimeout(300);
  const anKeep = await anSince(anMarkD);
  const anKeepField = await page.inputValue('#f-source');
  check('KEEP MINE writes a source_distinct row and leaves the field as typed',
        anKeep.length === 1 && anKeep[0].table === 'aliases' && anKeep[0].rows[0].kind === 'source_distinct' && anKeep[0].rows[0].alias === 'Blue Door || Blue Door Bakery'
        && anKeep[0].rows[0].canonical === '' && anKeepField === 'Blue Door', JSON.stringify([anKeep, anKeepField]));
  await anResetAliases();
  await page.evaluate(() => addAlias('source', 'Blu Door', 'Blue Door Bakery'));
  await page.waitForTimeout(300);
  const anMarkE = await anMark();
  await rvPaste(anText('Spell Three', 'Blu Door', ['1 onion']));
  const anSettledSpell = await page.evaluate(() => ({ field: document.getElementById('f-source').value, text: document.getElementById('sourceSpellRow').textContent.replace(/\s+/g, ' ').trim() }));
  check('a spelling settled before is put in the field and said so, writing nothing',
        anSettledSpell.field === 'Blue Door Bakery' && /Source recorded as Blue Door Bakery, a spelling you settled before/.test(anSettledSpell.text) && /You typed Blu Door/.test(anSettledSpell.text)
        && (await anSince(anMarkE)).length === 0, JSON.stringify(anSettledSpell));
  // The row follows the field: typing a similar source shows it, and typing something unlike any source takes it away.
  await anResetAliases();
  await rvPaste(anText('Spell Four', 'Somewhere Else Entirely', ['1 onion']));
  const anRowBefore = await page.evaluate(() => getComputedStyle(document.getElementById('sourceSpellRow')).display);
  await page.fill('#f-source', 'Blue Door');
  await page.locator('#f-source').dispatchEvent('change');
  const anRowTyped = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('sourceSpellRow')).display !== 'none', text: document.getElementById('sourceSpellRow').textContent.replace(/\s+/g, ' ').trim() }));
  await page.fill('#f-source', 'Somewhere Else Entirely');
  await page.locator('#f-source').dispatchEvent('change');
  const anRowCleared = await page.evaluate(() => getComputedStyle(document.getElementById('sourceSpellRow')).display);
  check('the SOURCE row follows the field: typing a similar source shows it, and typing another takes it away',
        anRowBefore === 'none' && anRowTyped.shown && /^Looks like Blue Door Bakery/.test(anRowTyped.text) && anRowCleared === 'none', JSON.stringify([anRowBefore, anRowTyped, anRowCleared]));
  // A spelling settled before is still used at save if the field was never blurred (no change event fired): the lookup stayed in the save.
  await page.evaluate(() => addAlias('source', 'Blu Door', 'Blue Door Bakery'));
  await page.waitForTimeout(300);
  await rvPaste(anText('Backstop One', 'Blue Door Bakery', ['1 onion']));
  await page.evaluate(() => { document.getElementById('f-source').value = 'Blu Door'; });
  const anMarkBk = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const anBackstop = await anSince(anMarkBk);
  const anBackstopRow = anBackstop.filter(w => w.table === 'recipes').flatMap(w => w.rows).pop() || {};
  check('a spelling settled before is used at save even when the field was never blurred, and the save writes no alias',
        anBackstopRow.source === 'Blue Door Bakery' && /^SOURCE: Blue Door Bakery$/m.test(anBackstopRow.syntax || '') && anBackstop.filter(w => w.table === 'aliases').length === 0,
        JSON.stringify([anBackstopRow.source, anBackstop.map(w => w.table)]));
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await anResetAliases();
  await anResetAliases();
  await rvPaste(anText('Unanswered One', 'Blue Door', ['1 onion']));
  const anMarkF = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const anUnanswered = await anSince(anMarkF);
  const anSavedRow = anUnanswered.filter(w => w.table === 'recipes').flatMap(w => w.rows).pop() || {};
  check('an unanswered spelling row saves the typed spelling and writes no alias',
        anUnanswered.filter(w => w.table === 'aliases').length === 0 && anSavedRow.source === 'Blue Door' && /^SOURCE: Blue Door$/m.test(anSavedRow.syntax || ''),
        JSON.stringify(anUnanswered.map(w => [w.table, w.op, (w.rows[0] || {}).source])));

  // USE THIS, and taking it back.
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const anLineText = ['TITLE: Undo One', 'SOURCE: Blue Door Bakery', 'SERVINGS: 2', '', 'GROUP a:', '400 ml tin plum tomatoes', '1 onion', '', 'STAGE:', 'MERGE a -> done: Cook [5 min]'].join('\n');
  await rvPaste(anLineText);
  const anMarkG = await anMark();
  await anClick('[data-use-line="400 ml tin plum tomatoes"]');
  await page.waitForTimeout(300);
  const anUsed = await page.evaluate(() => { const u = document.querySelector('#reviewLines .rv-undo');
    return { text: document.getElementById('importInput').value, undo: u ? u.textContent.replace(/\s+/g, ' ').trim() : '' }; });
  await anClick('[data-rv="undo-line"]');
  await page.waitForTimeout(300);
  const anUndone = await page.evaluate(() => ({ text: document.getElementById('importInput').value, undo: document.querySelectorAll('[data-rv="undo-line"]').length,
    offered: document.querySelectorAll('[data-use-line="400 ml tin plum tomatoes"]').length }));
  check('UNDO restores the line: exactly the text as it was, the line offered again, and nothing written',
        anUsed.text.includes('\n400 g plum tomatoes (1 tin)\n') && /^Changed 400 ml tin plum tomatoes to 400 g plum tomatoes \(1 tin\) UNDO$/.test(anUsed.undo)
        && anUndone.text === anLineText && anUndone.undo === 0 && anUndone.offered === 1 && (await anSince(anMarkG)).length === 0, JSON.stringify([anUsed, anUndone]));

  // SCALE TO SERVE, and taking it back.
  const anScaleText = ['TITLE: Scale Undo', 'SOURCE: Blue Door Bakery', 'SERVINGS: 4', '', 'GROUP a:', '300 g pasta', '', 'STAGE:', 'MERGE a -> done: Cook [5 min]'].join('\n');
  await rvPaste(anScaleText);
  const anUndoVisible = () => page.evaluate(() => getComputedStyle(document.getElementById('f-scale-undo')).display !== 'none');
  const anScaleBefore = await anUndoVisible();
  const anMarkH = await anMark();
  await page.fill('#f-scale-servings', '6');
  await page.click('#f-scale-apply');
  await page.waitForTimeout(300);
  const anScaled = await page.evaluate(() => document.getElementById('importInput').value);
  const anScaledVisible = await anUndoVisible();
  await anClick('#f-scale-undo');
  await page.waitForTimeout(300);
  const anUnscaled = await page.evaluate(() => ({ text: document.getElementById('importInput').value, servings: document.getElementById('f-servings').value }));
  check('UNDO SCALE restores the text exactly, re-reads it, offers itself only after a scale, and writes nothing',
        !anScaleBefore && /450\s*g pasta/.test(anScaled) && /^SERVINGS: 6$/m.test(anScaled) && anScaledVisible
        && anUnscaled.text === anScaleText && anUnscaled.servings === '4' && !(await anUndoVisible()) && (await anSince(anMarkH)).length === 0,
        JSON.stringify([anScaleBefore, anScaledVisible, anUnscaled]));

  // Both undos go once the text has changed since: an undo must not take a later edit with it.
  await page.fill('#f-scale-servings', '6');
  await page.click('#f-scale-apply');
  await page.waitForTimeout(300);
  const anScaleThenType = await page.evaluate(() => document.getElementById('importInput').value);
  await page.fill('#importInput', anScaleThenType + '\n');
  await page.waitForTimeout(200);
  const anScaleGone = !(await anUndoVisible());
  await rvPaste(anLineText);
  await anClick('[data-use-line="400 ml tin plum tomatoes"]');
  await page.waitForTimeout(300);
  const anUsedAgain = await page.evaluate(() => document.getElementById('importInput').value);
  await page.fill('#importInput', anUsedAgain + '\n');
  await anClick('#recheckBtn');
  await page.waitForTimeout(300);
  const anLineGone = await page.evaluate(() => document.querySelectorAll('[data-rv="undo-line"]').length);
  check('UNDO SCALE and UNDO go once the text has changed since, so neither can take a later edit with it',
        anScaleGone && anLineGone === 0, JSON.stringify([anScaleGone, anLineGone]));

  // BEFORE YOU SAVE.
  await page.evaluate(() => { if(!loadKeywordVocab().includes('an-known-kw')) cache.keywords.push('an-known-kw'); });
  await rvPaste(anText('Save One', 'Blue Door Bakery', ['1 onion']));
  const anQuiet = await page.evaluate(() => ({ lines: document.querySelectorAll('#addBeforeSave li').length, shown: getComputedStyle(document.getElementById('addBeforeSave')).display }));
  await page.fill('#f-servings', '6');
  await page.fill('#f-title', 'Save One, Smoky');
  await page.waitForTimeout(350);
  const anHeader = await anBeforeSave();
  await page.fill('#f-servings', '4');
  await page.fill('#f-title', 'Save One');
  await page.waitForTimeout(350);
  const anHeaderBack = await anBeforeSave();
  check('BEFORE YOU SAVE names the header lines that will change, and is quiet when nothing will',
        anQuiet.lines === 0 && anQuiet.shown === 'none' && anHeader.join('|') === 'Rewrites the TITLE: and SERVINGS: lines to match the fields above' && anHeaderBack.length === 0,
        JSON.stringify([anQuiet, anHeader, anHeaderBack]));
  // The text is the other half of what the save compares: a line edited there and not yet re-checked is one the save would write the field back over.
  // (An input event sent straight to the box: page.fill would move focus off the last field, whose blur fires a change that refreshes the list on its own.)
  await page.evaluate(t => { const ta = document.getElementById('importInput'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); },
    anText('Save One', 'Blue Door Bakery', ['1 onion']).replace('SERVINGS: 4', 'SERVINGS: 8'));
  await page.waitForTimeout(350);
  const anTextEdit = await anBeforeSave();
  await anClick('#recheckBtn');
  await page.waitForTimeout(350);
  const anTextChecked = await anBeforeSave();
  check('BEFORE YOU SAVE follows the text too: an edited SERVINGS: line not yet re-checked is named as one the save would write back over, and re-checking clears it',
        anTextEdit.join('|') === 'Rewrites the SERVINGS: line to match the field above' && anTextChecked.length === 0, JSON.stringify([anTextEdit, anTextChecked]));
  await rvPaste(anText('Save One', 'Blue Door Bakery', ['1 onion']));
  await page.fill('#f-keywords', 'an-known-kw, sumac-night');
  await page.waitForTimeout(350);
  const anKeywords = await anBeforeSave();
  check('BEFORE YOU SAVE names the keywords that are new, and not the ones already in the vocabulary',
        anKeywords.includes('Adds to your keywords: sumac-night') && !anKeywords.some(l => /an-known-kw/.test(l)), JSON.stringify(anKeywords));
  await page.fill('#f-image', 'https://example.test/pic.jpg');
  await page.waitForTimeout(350);
  const anPhoto = await anBeforeSave();
  await page.fill('#f-image', await page.evaluate(() => SELF_HOST_PREFIX + 'ours.jpg'));
  await page.waitForTimeout(350);
  const anPhotoOurs = await anBeforeSave();
  check('BEFORE YOU SAVE names the photo copy, and not for a photo that is already ours',
        anPhoto.includes('Copies the photo into your own storage after saving') && !anPhotoOurs.some(l => /photo/.test(l)), JSON.stringify([anPhoto, anPhotoOurs]));

  // What it lists is what the save then does.
  await page.fill('#f-servings', '6');
  await page.fill('#f-title', 'Save One, Smoky');
  await page.fill('#f-image', 'https://example.test/pic.jpg');
  await page.waitForTimeout(350);
  const anListed = await anBeforeSave();
  const anMarkI = await anMark();
  await page.evaluate(() => { window.__INVOKES__.length = 0; });
  await page.click('#saveBtn');
  await page.waitForTimeout(700);
  const anSaved = await anSince(anMarkI);
  const anSavedRecipe = anSaved.filter(w => w.table === 'recipes').flatMap(w => w.rows).pop() || {};
  const anKeywordWrite = anSaved.filter(w => w.table === 'keywords').flatMap(w => w.rows).map(r => r.name);
  const anRehost = await page.evaluate(() => window.__INVOKES__.map(c => c.name));
  check('each line of BEFORE YOU SAVE is what the save then does: the header lines, the new keyword, the photo copy',
        anListed.length === 3 && anListed[0] === 'Rewrites the TITLE:, IMAGE:, SERVINGS: and TAGS: lines to match the fields above'
        && /photo/.test(anListed[1]) && anListed[2] === 'Adds to your keywords: sumac-night'
        && /^TITLE: Save One, Smoky$/m.test(anSavedRecipe.syntax || '') && /^IMAGE: https:\/\/example\.test\/pic\.jpg$/m.test(anSavedRecipe.syntax || '')
        && /^SERVINGS: 6$/m.test(anSavedRecipe.syntax || '') && /^TAGS: .*sumac-night/m.test(anSavedRecipe.syntax || '')
        && anKeywordWrite.join() === 'sumac-night' && anRehost.join() === 'rehost-images', JSON.stringify([anListed, anKeywordWrite, anRehost, anSavedRecipe.syntax]));

  // On Edit the ticks line appears only when there are ticks to reset, and an untouched form promises no rewrite.
  const anEditId = await page.evaluate(() => (loadRecipes().find(r => r.title === 'Save One, Smoky') || {}).id);
  await page.evaluate(id => { state.viewerTicks[id] = new Set(['ticked']); openEditModal(id); }, anEditId);
  await page.waitForTimeout(350);
  const anEditTicks = await anBeforeSave();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(id => { delete state.viewerTicks[id]; openEditModal(id); }, anEditId);
  await page.waitForTimeout(350);
  const anEditNoTicks = await anBeforeSave();
  check('on Edit BEFORE YOU SAVE resets-the-ticks only when there are ticks, and an untouched recipe promises no rewrite',
        anEditTicks.some(l => /Resets the ticks/.test(l)) && !anEditNoTicks.some(l => /Resets the ticks/.test(l)) && !anEditNoTicks.some(l => /Rewrites/.test(l)), JSON.stringify([anEditTicks, anEditNoTicks]));
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const anConfirms = await page.evaluate(() => window.__CONFIRMS__);
  check('no confirm() is called in the add path: parsing, answering, saving a new recipe and saving an edit', anConfirms === 0, anConfirms + ' calls');
  await page.evaluate(() => {
    window.confirm = window.__realConfirm;
    for(let i = loadRecipes().length - 1; i >= 0; i--){
      const r = loadRecipes()[i];
      if(String(r.id).startsWith('an-') || ['Unanswered One', 'Backstop One', 'Save One, Smoky'].includes(r.title)) loadRecipes().splice(i, 1);
    }
    cache.keywords = cache.keywords.filter(k => k !== 'an-known-kw' && k !== 'sumac-night');
    cache.aliases = JSON.parse(window.__aliasesBefore); rebuildAliasMaps();
    window.__INVOKES__.length = 0; window.__INVOKE_REPLY__ = null;
  });
  await page.waitForTimeout(200);

  /* ---- The comparison recorded on the recipe (PR 5 of the add-recipe plan, 29 Sep 2026) ----
     A comparison with the source page is remembered by the form and written by SAVE, as source_check:
     the counts and a hash of the ingredient lines it was of, never the page's text or a pasted list.
     The viewer says what is recorded beside the source link, and an edited recipe says its comparison
     was of the lines before. Invented recipes on example.test, removed again at the end. */
  await page.evaluate(() => {
    window.__INVOKES__.length = 0;
    window.__PV_SOURCE__ = [];
    window.__INVOKE_REPLY__ = call => call.name === 'source-ingredients'
      ? { data: { pageUrl: call.body.pageUrl, name: 'Prov', ingredients: window.__PV_SOURCE__ }, error: null }
      : { data: null, error: null };
    const L = ['2 onions, diced', '200 g red lentils'];
    const chk = (hard, lines) => ({ at: new Date().toISOString(), route: 'function', hard, soft: 0, sourceLines: lines.length, linesHash: linesHash(lines) });
    const mk = (id, title, check) => ({ id, title, source: 'Blue Door Bakery', sourceUrl: 'https://example.test/' + id, servings: 4,
      tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-05', sourceCheck: check,
      syntax: ['TITLE: ' + title, 'SOURCE: Blue Door Bakery', 'SOURCE_URL: https://example.test/' + id, 'SERVINGS: 4', '', 'GROUP a:', ...L, '', 'STAGE:', 'MERGE a -> done: Cook [5 min]'].join('\n') });
    loadRecipes().push(mk('pv-none', 'Prov None', null), mk('pv-ok', 'Prov Clear', chk(0, L)), mk('pv-one', 'Prov One', chk(1, L)),
      mk('pv-three', 'Prov Three', chk(3, L)), mk('pv-stale', 'Prov Stale', chk(0, ['2 onions, diced', '250 g red lentils'])), mk('pv-re', 'Prov Recheck', chk(0, L)));
  });
  const pvL = ['2 onions, diced', '200 g red lentils'];
  // The source page's list, or a refusal: what the stub answers source-ingredients with from here.
  const pvReply = list => page.evaluate(l => { window.__PV_SOURCE__ = l || []; window.__INVOKE_REPLY__ = call => call.name === 'source-ingredients'
    ? (l ? { data: { pageUrl: call.body.pageUrl, name: 'Prov', ingredients: window.__PV_SOURCE__ }, error: null } : { data: null, error: { message: 'refused' } })
    : { data: null, error: null }; }, list);
  const pvHash = await page.evaluate(l => linesHash(l), pvL);
  const pvRows = mark => page.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'recipes').flatMap(w => w.rows || []), mark);
  const pvWhen = id => page.evaluate(i => { const c = loadRecipes().find(r => r.id === i).sourceCheck; return c ? formatDate(isoLocal(new Date(c.at))) : ''; }, id);
  const pvChips = async id => {
    await page.evaluate(i => openRecipe(i, 'recipes'), id);
    await page.waitForTimeout(200);
    return page.evaluate(() => [...document.querySelectorAll('#viewerProvenance .prov-chip')].map(c => ({ text: c.textContent, cls: c.className.replace('prov-chip ', '') })));
  };
  const pvStored = () => page.evaluate(() => ({ text: (document.getElementById('sourceStored') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), recheck: !!document.getElementById('sourceRecheckBtn') }));

  // What the viewer says.
  const pvNone = await pvChips('pv-none');
  const pvOk = await pvChips('pv-ok');
  const pvOne = await pvChips('pv-one');
  const pvThree = await pvChips('pv-three');
  const pvStale = await pvChips('pv-stale');
  await page.evaluate(() => { showView('recipes'); renderHome(); });
  await page.waitForTimeout(250);
  const pvCards = await page.evaluate(() => [...document.querySelectorAll('.rcard')].some(c => /COMPARED|SOURCE NOTE/i.test(c.textContent)));
  check('the viewer shows NOT COMPARED for a recipe with none, and the cards show nothing of it',
        pvNone.length === 1 && pvNone[0].text === 'NOT COMPARED WITH ITS SOURCE' && pvNone[0].cls === 'prov-none' && !pvCards, JSON.stringify([pvNone, pvCards]));
  const pvWhenOk = (await pvWhen('pv-ok')).toUpperCase(), pvWhenOne = (await pvWhen('pv-one')).toUpperCase(), pvWhenThree = (await pvWhen('pv-three')).toUpperCase();
  check('the chip says what was found: no differences, one difference, three differences; and it says so when the ingredients have changed since',
        pvOk[0].text === `COMPARED ${pvWhenOk} · NO DIFFERENCES` && pvOk[0].cls === 'prov-ok'
        && pvOne[0].text === `COMPARED ${pvWhenOne} · 1 DIFFERENCE` && pvOne[0].cls === 'prov-warn'
        && pvThree[0].text === `COMPARED ${pvWhenThree} · 3 DIFFERENCES` && pvThree[0].cls === 'prov-warn'
        && pvStale[0].text === 'COMPARED BEFORE THE INGREDIENTS CHANGED' && pvStale[0].cls === 'prov-stale',
        JSON.stringify([pvOk, pvOne, pvThree, pvStale]));
  await page.evaluate(() => { const r = loadRecipes().find(x => x.id === 'pv-none'); r.syntax += '\n\nNOTES:\n⚠️ Source note: the page could not be read, so this recipe was reconstructed from another page.'; });
  const pvNoteRed = await pvChips('pv-none');
  await page.evaluate(() => { const r = loadRecipes().find(x => x.id === 'pv-none'); r.syntax = r.syntax.replace(/could not be read, so this recipe was reconstructed from another page/, 'gives two different oven times'); });
  const pvNotePlain = await pvChips('pv-none');
  await page.evaluate(() => { const r = loadRecipes().find(x => x.id === 'pv-none'); r.syntax = r.syntax.replace(/\n\nNOTES:\n.*$/s, ''); });
  const pvNoNote = await pvChips('pv-none');
  check('a source note shows as its own chip, red when the note says the page was not read, and no chip without one',
        pvNoteRed.length === 2 && pvNoteRed[1].text === 'CARRIES A SOURCE NOTE' && pvNoteRed[1].cls === 'prov-red'
        && pvNotePlain.length === 2 && pvNotePlain[1].cls === 'prov-note' && pvNoNote.length === 1, JSON.stringify([pvNoteRed, pvNotePlain, pvNoNote]));

  // The row both ways, and the key.
  const pvRowShape = await page.evaluate(() => {
    const sc = { at: '2026-09-01T10:00:00.000Z', route: 'pasted', hard: 2, soft: 1, sourceLines: 5, linesHash: 'abcd1234' };
    const mk = extra => ({ id: 'x', title: 'X', source: 'S', servings: 4, syntax: 'TITLE: X', tags: { course: '', keywords: [] }, ...extra });
    return { withOne: recipeToRow(mk({ sourceCheck: sc })), without: recipeToRow(mk({})), nulled: recipeToRow(mk({ sourceCheck: null })),
      back: rowToRecipe({ id: 'x', source_check: sc }, {}).sourceCheck, backNone: rowToRecipe({ id: 'y' }, {}).sourceCheck, backNull: rowToRecipe({ id: 'z', source_check: null }, {}).sourceCheck, sc };
  });
  check('the row carries source_check both ways, and a recipe with none leaves the key out',
        JSON.stringify(pvRowShape.withOne.source_check) === JSON.stringify(pvRowShape.sc) && !('source_check' in pvRowShape.without) && !('source_check' in pvRowShape.nulled)
        && JSON.stringify(pvRowShape.back) === JSON.stringify(pvRowShape.sc) && pvRowShape.backNone === null && pvRowShape.backNull === null, JSON.stringify(pvRowShape));

  // On Edit: the stored result, with RE-CHECK, and nothing fetched on opening.
  await page.evaluate(() => { window.__INVOKES__.length = 0; });
  await page.evaluate(() => openEditModal('pv-ok'));
  await page.waitForTimeout(300);
  const pvEditOk = await pvStored();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.evaluate(() => openEditModal('pv-stale'));
  await page.waitForTimeout(300);
  const pvEditStale = await pvStored();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.evaluate(() => openEditModal('pv-none'));
  await page.waitForTimeout(300);
  const pvEditNone = await pvStored();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.evaluate(() => openEditModal('pv-three'));
  await page.waitForTimeout(300);
  const pvEditThree = await pvStored();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const pvWhenOkRaw = await pvWhen('pv-ok'), pvWhenStaleRaw = await pvWhen('pv-stale');
  check('Edit shows the stored result with RE-CHECK when the lines are the ones compared, says so when they have changed, says none when none, and fetches nothing',
        pvEditOk.text === `Compared ${pvWhenOkRaw} · no differences. VALIDATE INGREDIENT LIST RE-CHECK` && pvEditOk.recheck
        && pvEditStale.text === `Compared ${pvWhenStaleRaw}, before the ingredients changed. RE-CHECK` && pvEditStale.recheck
        && pvEditNone.text === 'Not compared with its source yet.' && !pvEditNone.recheck
        && pvEditThree.text === `Compared ${await pvWhen('pv-three')} · 3 differences. VALIDATE INGREDIENT LIST RE-CHECK`
        && (await page.evaluate(() => window.__INVOKES__.length)) === 0, JSON.stringify([pvEditOk, pvEditStale, pvEditNone, pvEditThree]));

  // RE-CHECK reads the page again, and a save then records the new result.
  await pvReply(['2 onions, diced', '200 g red lentils', '3 tsp caraway']);
  await page.evaluate(() => { window.__INVOKES__.length = 0; });
  await page.evaluate(() => openEditModal('pv-re'));
  await page.waitForTimeout(300);
  const pvMarkRe = await anMark();
  await anClick('#sourceRecheckBtn');
  await page.waitForTimeout(400);
  const pvReAfter = await page.evaluate(() => ({ calls: window.__INVOKES__.filter(c => c.name === 'source-ingredients').map(c => c.body.pageUrl), stored: document.getElementById('sourceStored').textContent.trim(),
    hint: (document.querySelector('#sourceCompareOut .hint') || { textContent: '' }).textContent.slice(0, 20) }));
  const pvReBand = await anBeforeSave();
  const pvReWrites = (await anSince(pvMarkRe)).length;
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvReRow = (await pvRows(pvMarkRe)).pop() || {};
  const pvReChip = await page.evaluate(() => [...document.querySelectorAll('#viewerProvenance .prov-chip')].map(c => c.textContent));
  check('RE-CHECK reads the page again, replaces the stored line, and a save then records the new result',
        pvReAfter.calls.join() === 'https://example.test/pv-re' && pvReAfter.stored === '' && /^1 to look at/.test(pvReAfter.hint)
        && pvReBand.includes('Records: compared with the source today, 1 difference') && pvReWrites === 0
        && pvReRow.source_check && pvReRow.source_check.route === 'function' && pvReRow.source_check.hard === 1 && pvReRow.source_check.sourceLines === 3 && pvReRow.source_check.linesHash === pvHash
        && /· 1 DIFFERENCE$/.test(pvReChip[0] || ''), JSON.stringify([pvReAfter, pvReBand, pvReRow.source_check, pvReChip]));

  // Editing an ingredient line, and a keyword. The save keeps what was recorded either way.
  const pvOkBefore = await page.evaluate(() => JSON.stringify(loadRecipes().find(r => r.id === 'pv-ok').sourceCheck));
  await pvReply(null);   // RE-CHECK re-reads the text, which checks a link not yet fetched for; here the page refuses, so no new comparison
  await page.evaluate(() => openEditModal('pv-ok'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { const ta = document.getElementById('importInput'); ta.value = ta.value.replace('200 g red lentils', '250 g red lentils'); ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await anClick('#recheckBtn');
  await page.waitForTimeout(300);
  const pvEditedNote = (await pvStored()).text;
  const pvMarkEd = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvEdRow = (await pvRows(pvMarkEd)).pop() || {};
  const pvEdChip = await page.evaluate(() => [...document.querySelectorAll('#viewerProvenance .prov-chip')].map(c => c.textContent));
  check('editing an ingredient line makes the chip say the ingredients changed, and the save kept what was recorded',
        /before the ingredients changed/.test(pvEditedNote) && JSON.stringify(pvEdRow.source_check) === pvOkBefore && pvEdChip[0] === 'COMPARED BEFORE THE INGREDIENTS CHANGED', JSON.stringify([pvEditedNote, pvEdChip]));
  await page.evaluate(() => openEditModal('pv-one'));
  await page.waitForTimeout(300);
  await page.fill('#f-keywords', 'sumac-night');
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvKwChip = await page.evaluate(() => [...document.querySelectorAll('#viewerProvenance .prov-chip')].map(c => c.textContent));
  check('a keyword edit does not make the comparison stale',
        pvKwChip.length === 1 && pvKwChip[0] === `COMPARED ${pvWhenOne} · 1 DIFFERENCE`, JSON.stringify(pvKwChip));

  // A new recipe: a comparison that ran is recorded by the save, and by nothing before it.
  await page.evaluate(() => { showView('recipes'); renderHome(); window.__INVOKES__.length = 0; });
  await pvReply(['2 onions, diced', '200 g red lentils', '3 tsp caraway']);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const pvMarkAdd = await anMark();
  await rvPaste(anText('Prov Add', 'Blue Door Bakery', pvL, ['SOURCE_URL: https://example.test/pv-add']));
  await page.waitForTimeout(400);
  const pvAddBefore = await page.evaluate(() => ({ hint: (document.querySelector('#sourceCompareOut .hint') || { textContent: '' }).textContent.slice(0, 20) }));
  const pvAddBand = await anBeforeSave();
  const pvAddWrites = (await anSince(pvMarkAdd)).length;
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvAddRow = (await pvRows(pvMarkAdd)).pop() || {};
  const pvAddSc = pvAddRow.source_check || {};
  check('a comparison alone writes nothing, and a save after a comparison pushes source_check with the counts and hash',
        /^1 to look at/.test(pvAddBefore.hint) && pvAddBand.includes('Records: compared with the source today, 1 difference') && pvAddWrites === 0
        && pvAddSc.route === 'function' && pvAddSc.hard === 1 && pvAddSc.soft === 0 && pvAddSc.sourceLines === 3 && pvAddSc.linesHash === pvHash && !isNaN(Date.parse(pvAddSc.at))
        && Object.keys(pvAddSc).sort().join() === 'at,hard,linesHash,route,soft,sourceLines', JSON.stringify([pvAddBefore, pvAddBand, pvAddWrites, pvAddSc]));

  // A comparison that could not run records nothing, and the save sends no source_check.
  await pvReply(null);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const pvMarkNo = await anMark();
  await rvPaste(anText('Prov Refused', 'Blue Door Bakery', pvL, ['SOURCE_URL: https://example.test/pv-refused']));
  await page.waitForTimeout(400);
  const pvNoBand = await anBeforeSave();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvNoRow = (await pvRows(pvMarkNo)).pop() || {};
  check('a save without a comparison sends no source_check, so it works before the column exists, and the form says it is not compared',
        pvNoBand.includes('Records: not compared with its source') && pvNoRow.title === 'Prov Refused' && !('source_check' in pvNoRow), JSON.stringify([pvNoBand, Object.keys(pvNoRow)]));

  // The pasted route: recorded as pasted, counted, and the pasted text is stored nowhere.
  await page.evaluate(() => { window.__INVOKE_REPLY__ = null; });
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const pvMarkPaste = await anMark();
  await rvPaste(anText('Prov Pasted', 'Blue Door Bakery', pvL));
  await page.fill('#sourcePasteInput', ['2 onions, diced', '200 g red lentils', '1 pinch qzx-marker'].join('\n'));
  await anClick('#comparePastedBtn');
  await page.waitForTimeout(300);
  const pvPasteBand = await anBeforeSave();
  const pvPasteWrites = (await anSince(pvMarkPaste)).length;
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvPasteWritesAll = await page.evaluate(m => JSON.stringify(window.__WRITES__.slice(m)), pvMarkPaste);
  const pvPasteRow = (await pvRows(pvMarkPaste)).pop() || {};
  check('the pasted route is recorded as pasted with the count of its lines, and the pasted text is stored nowhere',
        pvPasteBand.includes('Records: compared with the source today, 1 difference') && pvPasteWrites === 0
        && pvPasteRow.source_check && pvPasteRow.source_check.route === 'pasted' && pvPasteRow.source_check.sourceLines === 3 && pvPasteRow.source_check.hard === 1
        && !/qzx-marker/.test(pvPasteWritesAll), JSON.stringify([pvPasteBand, pvPasteRow.source_check]));

  // An answer that arrives after the form has gone, or for a link that has since changed, must not be recorded against the wrong recipe.
  const pvSlow = ms => page.evaluate(m => { window.__INVOKE_REPLY__ = call => call.name !== 'source-ingredients' ? { data: null, error: null }
    : new Promise(res => setTimeout(() => res({ data: { pageUrl: call.body.pageUrl, name: 'Slow', ingredients: /pv-slow|pv-race-a/.test(call.body.pageUrl)
        ? ['2 onions, diced', '200 g red lentils', '3 tsp caraway'] : ['2 onions, diced', '200 g red lentils'] }, error: null }), /pv-slow|pv-race-a/.test(call.body.pageUrl) ? m : 0)); }, ms);
  await pvSlow(900);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const pvMarkSlow = await anMark();
  await rvPaste(anText('Prov Slow', 'Blue Door Bakery', pvL, ['SOURCE_URL: https://example.test/pv-slow']));
  await page.click('#saveBtn');          // saved before the page has answered
  await page.waitForTimeout(1100);       // and now it answers, to a form that has gone
  const pvSlowRow = (await pvRows(pvMarkSlow)).pop() || {};
  await pvReply(null);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const pvMarkAfter = await anMark();
  await rvPaste(anText('Prov After', 'Blue Door Bakery', pvL));
  const pvAfterBand = await anBeforeSave();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvAfterRow = (await pvRows(pvMarkAfter)).pop() || {};
  check('an answer that arrives after the form has closed is dropped, not carried into the next recipe',
        pvSlowRow.title === 'Prov Slow' && !('source_check' in pvSlowRow) && pvAfterRow.title === 'Prov After' && !('source_check' in pvAfterRow)
        && !pvAfterBand.some(l => /^Records:/.test(l)), JSON.stringify([Object.keys(pvSlowRow), pvAfterBand, Object.keys(pvAfterRow)]));
  await pvSlow(900);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  const pvMarkRace = await anMark();
  await rvPaste(anText('Prov Race', 'Blue Door Bakery', pvL, ['SOURCE_URL: https://example.test/pv-race-a']));
  await page.fill('#f-source-url', 'https://example.test/pv-race-b');
  await page.locator('#f-source-url').dispatchEvent('change');
  await page.waitForTimeout(1300);       // the newer link answered at once; the older answers after it
  const pvRaceHint = await page.evaluate(() => (document.querySelector('#sourceCompareOut .hint') || { textContent: '' }).textContent.slice(0, 40));
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pvRaceRow = (await pvRows(pvMarkRace)).pop() || {};
  check('an older answer for a link that has since changed does not replace the newer comparison',
        /^Every ingredient found its match/.test(pvRaceHint) && pvRaceRow.source_check && pvRaceRow.source_check.hard === 0 && pvRaceRow.source_url === 'https://example.test/pv-race-b',
        JSON.stringify([pvRaceHint, pvRaceRow.source_check, pvRaceRow.source_url]));

  // The same link answering into a different form (here Edit of a recipe that has that link) is dropped too: the link alone cannot tell the two forms apart.
  await page.evaluate(() => {
    loadRecipes().push({ id: 'pv-same', title: 'Prov Same', source: 'Blue Door Bakery', sourceUrl: 'https://example.test/pv-slow', servings: 4, tags: { course: '', keywords: [] },
      history: [], dateAdded: '2026-09-05', sourceCheck: null,
      syntax: 'TITLE: Prov Same\nSOURCE: Blue Door Bakery\nSOURCE_URL: https://example.test/pv-slow\nSERVINGS: 4\n\nGROUP a:\n2 onions, diced\n200 g red lentils\n\nSTAGE:\nMERGE a -> done: Cook [5 min]' });
  });
  await pvSlow(900);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await rvPaste(anText('Prov Gone', 'Blue Door Bakery', pvL, ['SOURCE_URL: https://example.test/pv-slow']));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.evaluate(() => openEditModal('pv-same'));
  await page.waitForTimeout(1200);       // the first form's answer lands while Edit, with the same link, is open
  const pvSameBand = await anBeforeSave();
  const pvSameOut = await page.evaluate(() => document.getElementById('sourceCompareOut').textContent.trim());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('an answer for the same link that arrives in a different form is dropped too',
        pvSameBand.includes('Records: not compared with its source') && !pvSameBand.some(l => /^Records: compared/.test(l)) && pvSameOut === '', JSON.stringify([pvSameBand, pvSameOut]));

  // The four things BEFORE YOU SAVE can say about it, and when it says nothing.
  await pvReply(['2 onions, diced', '200 g red lentils']);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await rvPaste(anText('Prov Band', 'Blue Door Bakery', pvL, ['SOURCE_URL: https://example.test/pv-band']));
  await page.waitForTimeout(400);
  const pvBandClear = await anBeforeSave();
  await page.evaluate(() => { const ta = document.getElementById('importInput'); ta.value = ta.value.replace('200 g red lentils', '250 g red lentils'); ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(350);
  const pvBandChanged = await anBeforeSave();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.evaluate(() => openEditModal('pv-ok'));
  await page.waitForTimeout(300);
  const pvBandEdit = await anBeforeSave();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('BEFORE YOU SAVE says what the save records about the comparison, in its four wordings, and nothing for a recipe that already carries one',
        pvBandClear.includes('Records: compared with the source today, no differences')
        && pvBandChanged.includes('Records: compared with the source, but the ingredients changed since')
        && pvNoBand.includes('Records: not compared with its source') && pvReBand.includes('Records: compared with the source today, 1 difference')
        && !pvBandEdit.some(l => /^Records:/.test(l)), JSON.stringify([pvBandClear, pvBandChanged, pvBandEdit]));

  /* ---- VALIDATE INGREDIENT LIST, and OPEN SOURCE (30 Sep 2026) ----
     The household's word that a comparison was looked at and the list is right as it stands, all its
     differences at once; written only by SAVE, into the comparison; lapses when the lines change. */
  const vlStored = () => page.evaluate(() => ({ text: (document.getElementById('sourceStored') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
    validate: !!document.querySelector('#sourceStored [data-source-validate]'), undo: !!document.querySelector('#sourceStored [data-source-unvalidate]') }));
  await page.evaluate(() => openEditModal('pv-three'));
  await page.waitForTimeout(300);
  const vlOffer = await vlStored();
  const vlMark0 = await anMark();
  await anClick('#sourceStored [data-source-validate]');
  const vlPending = await vlStored();
  const vlBandPending = await anBeforeSave();
  await anClick('#sourceStored [data-source-unvalidate]');
  const vlUndone = await vlStored();
  const vlBandUndone = await anBeforeSave();
  const vlWritesBeforeSave = (await anSince(vlMark0)).length;
  await anClick('#sourceStored [data-source-validate]');
  const vlMark = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const vlRow = (await pvRows(vlMark)).pop() || {};
  const vlSc = vlRow.source_check || {};
  check('VALIDATE INGREDIENT LIST beside a stored comparison: tapped it says so, with UNDO; BEFORE YOU SAVE names it; nothing is written until SAVE',
        vlOffer.validate && /3 differences\. VALIDATE INGREDIENT LIST/.test(vlOffer.text) && vlPending.undo && /Validated when you save/.test(vlPending.text)
        && vlBandPending.includes('Records: the ingredient list validated against its last comparison') && vlUndone.validate && !vlBandUndone.some(l => /validated/.test(l))
        && vlWritesBeforeSave === 0, JSON.stringify([vlOffer, vlPending, vlBandPending, vlUndone, vlWritesBeforeSave]));
  const vlChips = await page.evaluate(() => [...document.querySelectorAll('#viewerProvenance .prov-chip')].map(c => ({ text: c.textContent, cls: c.className.replace('prov-chip ', '') })));
  const vlWhen = await page.evaluate(() => formatDate(isoLocal(new Date(loadRecipes().find(r => r.id === 'pv-three').sourceCheck.validated))).toUpperCase());
  check('    SAVE writes the validation into that comparison, kept whole, and the viewer then says VALIDATED',
        !isNaN(Date.parse(vlSc.validated)) && vlSc.hard === 3 && vlSc.linesHash === pvHash && vlSc.route === 'function'
        && vlChips.length === 1 && vlChips[0].text === `VALIDATED ${vlWhen}` && vlChips[0].cls === 'prov-ok', JSON.stringify([vlSc, vlChips]));
  await page.evaluate(() => openEditModal('pv-three'));
  await page.waitForTimeout(300);
  const vlEditAgain = await vlStored();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const vlLc = await page.evaluate(() => { const row = libraryCheckRows().find(x => x.id === 'pv-three'); const unv = libraryCheckRows().find(x => x.id === 'pv-one');
    return { key: row.key, status: row.status, attentionForStatus: LIBRARY_STATUS.find(s => s.key === row.key).attention, unvalidated: unv.key }; });
  check('    Edit then says when it was validated with no second offer, and LIBRARY CHECK reads it as validated, not needing attention',
        /^Validated .* \(compared .* · 3 differences\)\. RE-CHECK$/.test(vlEditAgain.text) && !vlEditAgain.validate
        && vlLc.key === 'validated' && vlLc.status === 'validated' && vlLc.attentionForStatus === false && vlLc.unvalidated === 'differs', JSON.stringify([vlEditAgain, vlLc]));
  // A comparison run in the form: validated with it; a new comparison starts again.
  await pvReply(['2 onions, diced', '200 g red lentils', '1 tsp ground cumin']);
  await page.evaluate(() => openEditModal('pv-one'));
  await page.waitForTimeout(300);
  await anClick('#compareSourceBtn');
  await page.waitForTimeout(400);
  await anClick('#sourceValidateRow [data-source-validate]');
  const vlFormBand = await anBeforeSave();
  await anClick('#compareSourceBtn');
  await page.waitForTimeout(400);
  const vlAfterNew = await page.evaluate(() => ({ offer: !!document.querySelector('#sourceValidateRow [data-source-validate]') }));
  const vlAfterNewBand = await anBeforeSave();
  await anClick('#sourceValidateRow [data-source-validate]');
  const vlMark2 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const vlSc2 = ((await pvRows(vlMark2)).pop() || {}).source_check || {};
  check('    under a comparison run in the form it is offered too, recorded with it by SAVE; a new comparison asks again',
        vlFormBand.includes('Records: compared with the source today, 1 difference, and the ingredient list validated')
        && vlAfterNew.offer && vlAfterNewBand.includes('Records: compared with the source today, 1 difference') && !vlAfterNewBand.some(l => /validated/.test(l))
        && vlSc2.hard === 1 && !isNaN(Date.parse(vlSc2.validated)) && vlSc2.linesHash === pvHash, JSON.stringify([vlFormBand, vlAfterNew, vlAfterNewBand, vlSc2]));
  await page.evaluate(() => { const r = loadRecipes().find(x => x.id === 'pv-three'); r.syntax = r.syntax.replace('200 g red lentils', '250 g red lentils'); });
  const vlLapsed = await pvChips('pv-three');
  const vlLapsedKey = await page.evaluate(() => libraryCheckRows().find(x => x.id === 'pv-three').key);
  check('    and a validation lapses when the ingredient lines change: the chip says compared before they changed',
        vlLapsed[0].text === 'COMPARED BEFORE THE INGREDIENTS CHANGED' && vlLapsedKey === 'stale', JSON.stringify([vlLapsed, vlLapsedKey]));
  // OPEN SOURCE: the link in the form, in a new tab; nothing for a recipe with no web link.
  await page.evaluate(() => { window.__opened = []; window.__origOpen = window.open; window.open = (...a) => { window.__opened.push(a); return null; }; });
  await page.evaluate(() => openEditModal('pv-ok'));
  await page.waitForTimeout(300);
  await anClick('#openSourceBtn');
  await page.evaluate(() => { document.getElementById('f-source-url').value = ''; });
  await anClick('#openSourceBtn');
  const vlOpened = await page.evaluate(() => { const o = window.__opened; window.open = window.__origOpen; return o; });
  const vlToast = await page.evaluate(() => (document.querySelector('.toast') || { textContent: '' }).textContent);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('OPEN SOURCE opens the recipe\'s link from the form in a new tab, and says so when there is no web link',
        vlOpened.length === 1 && vlOpened[0][0] === 'https://example.test/pv-ok' && vlOpened[0][1] === '_blank' && /no web link/.test(vlToast), JSON.stringify([vlOpened, vlToast]));

  await page.evaluate(() => {
    for(let i = loadRecipes().length - 1; i >= 0; i--){
      const r = loadRecipes()[i];
      if(String(r.id).startsWith('pv-') || ['Prov Add', 'Prov Refused', 'Prov Pasted', 'Prov Slow', 'Prov After', 'Prov Race'].includes(r.title)) loadRecipes().splice(i, 1);
    }
    cache.keywords = cache.keywords.filter(k => k !== 'sumac-night');
    window.__INVOKES__.length = 0; window.__INVOKE_REPLY__ = null;
    showView('recipes'); renderHome();
  });
  await page.waitForTimeout(250);

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
    list.categories.forEach(c => c.items.forEach(i => { if (/pasta/i.test(i.name)) out = i.qtyText; }));
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
    list.categories.forEach(c => c.items.forEach(i => { if (/pasta/i.test(i.name)) out = i.qtyText; }));
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

  /* SL2, since PR 6b (25 Sep): the names come from the rules and dictionary
     in core.js (tested in Node, test/core.test.js); what is checked here is
     the page around them. No dialogs any more — a likely pair is offered in
     place, under the row, and answered when convenient. */
  const norm = await page.evaluate(() => ({
    prepIgnored: shoppingKeyForName('garlic, minced') === shoppingKeyForName('garlic'),
    groundKept: shoppingKeyForName('ground coriander') !== shoppingKeyForName('coriander'),
    groundValue: shoppingKeyForName('ground coriander')
  }));
  check('prep words do not split an ingredient', norm.prepIgnored);
  check('"ground coriander" stays apart from "coriander"', norm.groundKept, norm.groundValue);

  const strict = await page.evaluate(() => strictMatchSuggestions([
    { key: 'curly kale', count: 1 }, { key: 'kale', count: 3 },
    { key: 'unsalted butter', count: 2 }, { key: 'butter', count: 5 },
    { key: 'spring onion', count: 2 }, { key: 'onion', count: 6 }
  ], null));
  check('the strict rule offers the one plain pair', strict.length === 1, JSON.stringify(strict));
  check('and folds the rarer name into the commoner one',
        strict[0] && strict[0].from === 'curly kale' && strict[0].to === 'kale', JSON.stringify(strict[0]));

  /* On the list itself: two recipes that differ only by a word the rules
     keep, planned on one day, so the suggestion has something to show. A
     third, never planned, is 6d-1's "offered from the whole library" case —
     MERGE WITH… must reach it although it never shares a week's list. */
  const planned = await page.evaluate(() => {
    const list = loadRecipes();
    const a = { id: uid(), title: 'Kale One', source: 'Blue Door Bakery', servings: 2, tags: { course: '', keywords: [] }, history: [],
                syntax: 'TITLE: Kale One\nSERVINGS: 2\n\nGROUP a:\n200 g curly kale\n\nSTAGE:\nMERGE a -> b: Cook [5 min]' };
    const b = { ...a, id: uid(), title: 'Kale Two', syntax: 'TITLE: Kale Two\nSERVINGS: 2\n\nGROUP a:\n100 g kale\n\nSTAGE:\nMERGE a -> b: Cook [5 min]' };
    const c = { ...a, id: uid(), title: 'Unplanned Sprinkle Test',
                syntax: 'TITLE: Unplanned Sprinkle Test\nSERVINGS: 2\n\nGROUP a:\n50 g glitter sprinkles\n\nSTAGE:\nMERGE a -> b: Cook [5 min]' };
    list.push(a, b, c);
    const day = isoLocal(new Date());
    addPlanRecipe(day, a.id); addPlanRecipe(day, b.id);
    return { day, a: a.id, b: b.id, c: c.id };
  });
  let shopDialogs = 0;
  const countShopDialog = d => { shopDialogs++; d.dismiss(); };
  page.on('dialog', countShopDialog);
  await page.click('.navlink[data-view="shopping"]');
  await page.waitForTimeout(500);
  page.off('dialog', countShopDialog);
  check('opening the shopping list asks nothing', shopDialogs === 0, shopDialogs + ' dialogs');
  const inline = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#shopBody .shop-row')].find(r => r.querySelector('[data-merge-from="curly kale"]'));
    return row ? row.querySelector('.shop-suggest').textContent.replace(/\s+/g, ' ').trim()
               : 'rows: ' + [...document.querySelectorAll('#shopBody .shop-item')].map(el => el.dataset.name).join(', ');
  });
  check('a likely pair is offered in place, under the rarer row', /Same as Kale\?/.test(inline || ''), inline);
  await page.click('[data-keep-from="curly kale"]');
  await page.waitForTimeout(300);
  const kept = await page.evaluate(() => ({
    distinct: isPairDistinct('ingredient', 'curly kale', 'kale'),
    offered: !!document.querySelector('[data-merge-from="curly kale"]'),
    stored: loadAliases().some(a => a.kind === 'ingredient_distinct' && a.alias === pairKeyFor('curly kale', 'kale'))
  }));
  check('"keep apart" is remembered and stored to sync', kept.distinct && kept.stored, JSON.stringify(kept));
  check('and the pair is not offered again', !kept.offered);
  // Undo the "no" so the "yes" path can be exercised on the same pair.
  await page.evaluate(() => { const a = loadAliases().find(x => x.kind === 'ingredient_distinct' && x.alias === pairKeyFor('curly kale', 'kale')); removeAlias(a.id); renderShopping(); });
  await page.waitForTimeout(200);
  await page.click('[data-merge-from="curly kale"]');
  await page.waitForTimeout(300);
  const merged = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#shopBody .shop-item')].filter(el => /kale/i.test(el.dataset.name));
    return { rows: rows.length, text: rows.map(r => r.querySelector('.shop-item-name').textContent.trim()), redirect: applyIngredientAlias('curly kale') };
  });
  check('"merge" puts the two on one row, and totals them', merged.rows === 1 && /300 g/.test(merged.text[0] || ''), JSON.stringify(merged));
  check('under the name it was merged into', /^300 g\s*Kale$/.test(merged.text[0] || ''), merged.text[0]);
  check('and redirects the name from now on', merged.redirect === 'kale', merged.redirect);

  /* A tick is keyed by the name alone, so changing how a recipe measures
     it (200 g -> 1 bunch here; tbsp -> g in the review) keeps the tick. */
  await page.locator('#shopBody .shop-item[data-name="Kale"] input').check({ timeout: 5000 });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const r = loadRecipes().find(x => x.title === 'Kale One'); r.syntax = r.syntax.replace('200 g curly kale', '1 bunch curly kale'); renderShopping(); });
  await page.waitForTimeout(200);
  const kaleTick = await page.evaluate(() => {
    const el = document.querySelector('#shopBody .shop-item[data-name="Kale"]');
    return el && { checked: el.classList.contains('checked'), text: el.querySelector('.shop-item-name').textContent.trim() };
  });
  check('a tick survives the recipe changing its unit', kaleTick && kaleTick.checked && /1 bunch/.test(kaleTick.text), JSON.stringify(kaleTick));
  await page.locator('#shopBody .shop-item[data-name="Kale"] input').uncheck({ timeout: 5000 });
  await page.evaluate(() => { const r = loadRecipes().find(x => x.title === 'Kale One'); r.syntax = r.syntax.replace('1 bunch curly kale', '200 g curly kale'); });

  /* buildShoppingList runs on every planner change: with a suggestion
     pending and nothing answered, building it must write nothing and ask
     nothing, however many times it runs. */
  let pureDialogs = 0;
  const countPureDialog = d => { pureDialogs++; d.dismiss(); };
  page.on('dialog', countPureDialog);
  const pure = await page.evaluate(async () => {
    const before = { writes: (window.__WRITES__ || []).length, aliases: JSON.stringify(cache.aliases), ticks: JSON.stringify(cache.shoppingChecked) };
    cache.aliases = cache.aliases.filter(a => !(a.kind === 'ingredient' && a.alias === 'curly kale'));
    rebuildAliasMaps();
    const aliasesNow = JSON.stringify(cache.aliases);
    const buckets = groupDaysByWeek(dayList());
    let offered = 0;
    for(let i = 0; i < 5; i++) buckets.forEach(b => { offered += buildShoppingList(b).suggestions.length; });
    /* Writes are queued, so a write made in there lands a moment later:
       counted straight away, the check passed with one in it. */
    await new Promise(r => setTimeout(r, 400));
    const out = { offered, writes: (window.__WRITES__ || []).length - before.writes,
                  aliasesSame: JSON.stringify(cache.aliases) === aliasesNow, ticksSame: JSON.stringify(cache.shoppingChecked) === before.ticks };
    cache.aliases = JSON.parse(before.aliases); rebuildAliasMaps();
    return out;
  });
  page.off('dialog', countPureDialog);
  check('building the list with a suggestion pending writes, asks and changes nothing',
        pure.offered > 0 && pure.writes === 0 && pureDialogs === 0 && pure.aliasesSame && pure.ticksSame, JSON.stringify(pure) + ', ' + pureDialogs + ' dialogs');

  /* MERGE WITH… made safe (6d-1): found 27 Sep, the old dropdown wrote the
     moment a name was picked and offered only this week's rows, so a slip
     of the finger saved the wrong match and two matches couldn't be made at
     all. Now: a filter box over the whole library, a confirm step, and only
     MERGE writes. */
  await page.evaluate(() => { const r = loadRecipes().find(x => x.title === 'Kale Two'); r.syntax = r.syntax.replace('100 g kale', '1 bunch cavolo nero'); renderShopping(); });
  await page.waitForTimeout(200);
  const aliasesBefore = await page.evaluate(() => loadAliases().length);

  await page.click('[data-merge-with="cavolo nero"]');
  await page.waitForTimeout(150);
  await page.fill('.shop-merge-filter', 'sprinkle');
  await page.waitForTimeout(150);
  const offList = await page.evaluate(() => {
    const opt = document.querySelector('.shop-merge-option');
    return opt && { name: opt.dataset.name, key: opt.dataset.key };
  });
  check('a name from an unplanned recipe is offered by the filter', !!offList && /sprinkle/i.test(offList.name || ''), JSON.stringify(offList));

  await page.fill('.shop-merge-filter', 'kale');
  await page.waitForTimeout(150);
  const writesBeforePick = await page.evaluate(() => (window.__WRITES__ || []).length);
  await page.click('.shop-merge-option[data-key="kale"]');
  await page.waitForTimeout(250);
  const picked = await page.evaluate((before) => ({
    confirmText: (document.querySelector('.shop-merge-confirm') || {}).textContent || '',
    writesSince: (window.__WRITES__ || []).length - before
  }), writesBeforePick);
  check('picking a name shows a confirm step, and a pick alone writes nothing',
        /Merge/.test(picked.confirmText) && /MERGE/.test(picked.confirmText) && /CANCEL/.test(picked.confirmText) && picked.writesSince === 0,
        JSON.stringify(picked));

  const writesBeforeCancel = await page.evaluate(() => (window.__WRITES__ || []).length);
  await page.click('.shop-merge-cancel');
  await page.waitForTimeout(250);
  const cancelled = await page.evaluate((before) => ({
    writesSince: (window.__WRITES__ || []).length - before,
    aliasCount: loadAliases().length,
    stillApart: [...document.querySelectorAll('#shopBody .shop-item')].filter(el => /kale|cavolo/i.test(el.dataset.name)).length,
    buttonBack: !!document.querySelector('[data-merge-with="cavolo nero"]')
  }), writesBeforeCancel);
  check('CANCEL writes nothing and leaves the rows apart',
        cancelled.writesSince === 0 && cancelled.aliasCount === aliasesBefore && cancelled.stillApart === 2 && cancelled.buttonBack,
        JSON.stringify(cancelled));

  await page.click('[data-merge-with="cavolo nero"]');
  await page.waitForTimeout(150);
  await page.fill('.shop-merge-filter', 'kale');
  await page.waitForTimeout(150);
  await page.click('.shop-merge-option[data-key="kale"]');
  await page.waitForTimeout(150);
  const writesBeforeMerge = await page.evaluate(() => (window.__WRITES__ || []).length);
  await page.click('.shop-merge-confirm [data-merge-from]');
  await page.waitForTimeout(300);
  const joined = await page.evaluate((before) => ({
    aliasWritesSince: (window.__WRITES__ || []).slice(before).filter(w => w.table === 'aliases' && w.op === 'upsert').length,
    aliasCount: loadAliases().length,
    rows: [...document.querySelectorAll('#shopBody .shop-item')].filter(el => /kale|cavolo/i.test(el.dataset.name))
      .map(el => el.querySelector('.shop-item-name').textContent.trim())
  }), writesBeforeMerge);
  check('MERGE writes exactly one aliases row',
        joined.aliasWritesSince === 1 && joined.aliasCount === aliasesBefore + 1, JSON.stringify(joined));
  check('and joins the two rows the rules keep apart, keeping both parts',
        joined.rows.length === 1 && /200 g \+ 1 bunch/.test(joined.rows[0] || ''), JSON.stringify(joined));
  // Tidy away the kale recipes, their plan entries and the matches.
  await page.evaluate((p) => {
    [p.a, p.b, p.c].forEach(id => deleteRecipe(id));
    loadAliases().filter(a => /kale|cavolo/.test(a.alias)).forEach(a => removeAlias(a.id));
  }, planned);
  await page.waitForTimeout(300);

  /* The page hands each line's group to the list, which is how an unmeasured
     line in a "garnish" group reads "extra to serve" rather than "N more". */
  const served = await page.evaluate(() => {
    const r = { id: uid(), title: 'Garnish Test', source: 'Blue Door Bakery', servings: 2, tags: { course: '', keywords: [] }, history: [],
                syntax: 'TITLE: Garnish Test\nSERVINGS: 2\n\nGROUP cheese:\n40 g grated parmesan\n\nGROUP garnish:\ngrated parmesan\n\nSTAGE:\nMERGE cheese, garnish -> done: Scatter over [instant]' };
    loadRecipes().push(r);
    addPlanRecipe(isoLocal(new Date()), r.id);
    const list = buildShoppingList(groupDaysByWeek(dayList())[0]);
    let text = null;
    list.categories.forEach(c => c.items.forEach(i => { if(i.key === 'parmesan') text = i.qtyText; }));
    deleteRecipe(r.id);
    return text;
  });
  check('an unmeasured garnish line reads "extra to serve" on the list', served === '40 g + extra to serve', served);

  /* A recipe's bracketed choice shows beside that recipe on the row (asked for
     27 Sep: honey in the cupboard, golden syrup in the recipe; attributed to
     its recipe on 28 Sep, so a stir-fry's "or oil" is not read as advice for a
     cake), and never splits the row. */
  const alt = await page.evaluate(() => {
    const mk = (title, line) => ({ id: uid(), title, source: 'Blue Door Bakery', servings: 2, tags: { course: '', keywords: [] }, history: [],
      syntax: `TITLE: ${title}\nSERVINGS: 2\n\nGROUP a:\n${line}\n\nSTAGE:\nMERGE a -> done: Mix [instant]` });
    const made = [mk('Alt One', '3 tbsp golden syrup (or honey)'), mk('Alt Two', '1 tbsp golden syrup'),
                  mk('Alt Three', '100 g plain yoghurt (or kefir)')];
    loadRecipes().push(...made);
    const day = isoLocal(new Date());
    made.forEach(r => addPlanRecipe(day, r.id));
    renderShopping();
    const read = re => [...document.querySelectorAll('#shopBody .shop-item')].filter(el => re.test(el.dataset.name)).map(r => ({
      name: r.querySelector('.shop-item-name').textContent.replace(/\s+/g, ' ').trim(),
      recipes: r.querySelector('.shop-item-recipes').textContent.replace(/\s+/g, ' ').trim() }));
    const out = { shared: read(/golden syrup/i), single: read(/yoghurt/i) };
    made.forEach(r => deleteRecipe(r.id));
    return out;
  });
  check('a choice from one recipe of two shows beside that recipe, and the row still totals both',
        alt.shared.length === 1 && /^4 tbsp\s*Golden syrup$/.test(alt.shared[0].name) && alt.shared[0].recipes === 'Alt One (or honey), Alt Two',
        JSON.stringify(alt.shared));
  check('    and beside the name when the row has only the one recipe',
        alt.single.length === 1 && /\(or kefir\)$/.test(alt.single[0].name) && alt.single[0].recipes === 'Alt Three', JSON.stringify(alt.single));

  /* 6d-2: swaps matched by the list's own name (findSwapMatchesForKey), not
     a substring on the raw ingredient text — the "something fuzzier"
     decision (14 Aug) let a swap for "butter" fire on "peanut butter" too.
     The "possible swaps" panel at the bottom of the list shows name, ratio
     and note only, for whatever it actually matches on this list (28 Sep). */
  const swap = await page.evaluate(() => {
    const day = isoLocal(new Date());
    const mk = (title, line) => ({ id: uid(), title, source: 'Blue Door Bakery', servings: 2, tags: { course: '', keywords: [] }, history: [],
      syntax: `TITLE: ${title}\nSERVINGS: 2\n\nGROUP a:\n${line}\n\nSTAGE:\nMERGE a -> done: Mix [instant]` });
    const butterRecipe = mk('Swap Butter Test', '100 g butter');
    const peanutRecipe = mk('Swap Peanut Butter Test', '30 g peanut butter');
    loadRecipes().push(butterRecipe, peanutRecipe);
    const butterSwap = { id: uid(), original: 'butter', replacement: 'margarine', ratio: 1, notes: 'dairy-free' };

    // The matching function itself: the regression this PR fixes.
    const unit = {
      peanutExcluded: findSwapMatchesForIngredient('peanut butter', [butterSwap]).length === 0,
      butterIncluded: findSwapMatchesForIngredient('butter', [butterSwap]).length === 1,
      byKey: findSwapMatchesForKey('butter', [butterSwap]).length === 1
    };

    addPlanRecipe(day, butterRecipe.id);
    renderShopping();
    const beforeSwap = !document.querySelector('.shop-swap-panel');

    cache.swaps.push(butterSwap);
    renderShopping();
    const panelText = (document.querySelector('.shop-swap-panel') || {}).textContent || '';

    addPlanRecipe(day, peanutRecipe.id);
    renderShopping();
    const withPeanut = (document.querySelector('.shop-swap-panel') || {}).textContent || '';
    const entries = document.querySelectorAll('.shop-swap-panel .swap-list li').length;

    // Ticking the butter row off and hiding ticked items must not hide the
    // swap for it — the panel reads every row on the list, not just the
    // ones HIDE TICKED currently shows.
    const butterRow = [...document.querySelectorAll('#shopBody .shop-item')].find(el => el.dataset.name === 'Butter');
    const weekStart = document.getElementById('shopBody').dataset.weekStart;
    toggleShoppingChecked(weekStart, butterRow.dataset.key);
    state.shoppingHideChecked = true;
    renderShopping();
    const afterTick = { hidden: !document.querySelector('#shopBody .shop-item[data-name="Butter"]'),
                         panel: (document.querySelector('.shop-swap-panel') || {}).textContent || '' };
    state.shoppingHideChecked = false;
    toggleShoppingChecked(weekStart, butterRow.dataset.key);

    deleteRecipe(butterRecipe.id); deleteRecipe(peanutRecipe.id);
    cache.swaps = cache.swaps.filter(s => s.id !== butterSwap.id);
    renderShopping();
    return { unit, beforeSwap, panelText, withPeanut, entries, afterTick };
  });
  check('a swap for "butter" does not fire on "peanut butter"', swap.unit.peanutExcluded, JSON.stringify(swap.unit));
  check('    but still fires on "butter" itself, by key as well as by the old raw-name call', swap.unit.butterIncluded && swap.unit.byKey);
  check('no swap panel when nothing on the list matches a stored swap', swap.beforeSwap, swap.panelText);
  check('a matching swap shows name, ratio and note in the panel',
        /Butter/.test(swap.panelText) && /margarine/.test(swap.panelText) && /ratio 1/.test(swap.panelText) && /dairy-free/.test(swap.panelText),
        swap.panelText);
  check('planning an unrelated "peanut butter" line adds nothing to the panel',
        swap.entries === 1 && !/peanut/i.test(swap.withPeanut), JSON.stringify({entries: swap.entries, withPeanut: swap.withPeanut}));
  check('hiding a ticked row does not hide its swap',
        swap.afterTick.hidden && /margarine/.test(swap.afterTick.panel), JSON.stringify(swap.afterTick));

  // The prompt must never fire from the planner.
  let plannerDialogs = 0;
  const countDialog = d => { plannerDialogs++; d.dismiss(); };
  page.on('dialog', countDialog);
  await page.evaluate(() => { updateSidebarCounts(); renderPlanner(); });
  await page.waitForTimeout(400);
  page.off('dialog', countDialog);
  check('building a list from the planner asks nothing', plannerDialogs === 0, plannerDialogs + ' dialogs');

  /* Word matches stored before the release, in the old normaliser's words,
     still mean the same thing: re-normalised as they load, never rewritten. */
  const legacy = await page.evaluate(() => {
    cache.aliases.push({ id: uid(), kind: 'ingredient', alias: 'shallot and', canonical: 'banana shallots' });
    cache.aliases.push({ id: uid(), kind: 'ingredient', alias: 'large onion', canonical: 'onion' });
    rebuildAliasMaps();
    const out = { redirect: applyIngredientAlias('shallot'), redundantDropped: applyIngredientAlias('onion') === 'onion' };
    cache.aliases = cache.aliases.filter(a => !['shallot and', 'large onion'].includes(a.alias));
    rebuildAliasMaps();
    return out;
  });
  check('an old word match still applies, in today\'s words', legacy.redirect === 'banana shallot', legacy.redirect);
  check('and one the rules now make anyway falls away', legacy.redundantDropped);

  // Settings still has its add form, which stores in the list's own words.
  // (A made-up pair the dictionary knows nothing about: this used to be courgettes and
  // zucchini, which the dictionary has called one row since 29 Sep, so the form rightly
  // stores nothing for them.)
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.selectOption('#alias-kind', 'ingredient').catch(() => {});
  await page.fill('#alias-from', 'Cavolo nero, sliced');
  await page.fill('#alias-to', 'black kale');
  await page.click('#aliasAddBtn');
  await page.waitForTimeout(300);
  const formAlias = await page.evaluate(() => loadAliases().find(a => a.kind === 'ingredient' && /cavolo/.test(a.alias)));
  check('Settings stores a new match in the list\'s own words', formAlias && formAlias.alias === 'cavolo nero' && formAlias.canonical === 'black kale', JSON.stringify(formAlias));
  await page.evaluate(() => loadAliases().filter(a => /cavolo/.test(a.alias)).forEach(a => removeAlias(a.id)));
  await page.evaluate(() => { addAlias('ingredient', 'thing 0', 'things 0'); addAlias('ingredient_distinct', pairKeyFor('thing 1', 'things 1'), ''); addAlias('ingredient_distinct', pairKeyFor('thing 2', 'things 2'), ''); addAlias('ingredient_distinct', pairKeyFor('thing 3', 'things 3'), ''); renderAliasesList(); });
  await page.waitForTimeout(200);

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
    normal: extractStepDuration('bake [40 min]'),
    /* The three forms that caused a real, library-wide silent failure: the
       parser did not recognise any of them, and an unrecognised bracket is
       not inert — the raw text shows up in the diagram. The reprocessed
       batch used [30 sec] three times. Without these, removing the en-dash
       class or the seconds unit would break the whole library and the suite
       would stay green. */
    enDash: extractStepDuration('simmer [4\u20135 min]'),
    seconds: extractStepDuration('blitz [30 sec]'),
    compound: extractStepDuration('prove [1 hr 30]'),
    untilDone: extractStepDuration('reduce [until thickened]')
  }));
  check('an en-dash range is read as a range',
        durationCheck.enDash && durationCheck.enDash.duration
          && durationCheck.enDash.duration.min === 4 && durationCheck.enDash.duration.max === 5,
        JSON.stringify(durationCheck.enDash));
  check('seconds are read as a fraction of a minute',
        durationCheck.seconds && durationCheck.seconds.duration
          && Math.abs(durationCheck.seconds.duration.min - 0.5) < 1e-9,
        JSON.stringify(durationCheck.seconds));
  check('hours and minutes combine',
        durationCheck.compound && durationCheck.compound.duration
          && durationCheck.compound.duration.min === 90,
        JSON.stringify(durationCheck.compound));
  check('an until-phrase is open-ended, not a number',
        durationCheck.untilDone && durationCheck.untilDone.duration
          && durationCheck.untilDone.duration.openEnded === true,
        JSON.stringify(durationCheck.untilDone));
  check('and none of them leaves the bracket in the label',
        [durationCheck.enDash, durationCheck.seconds, durationCheck.compound, durationCheck.untilDone]
          .every(d => d && !/[\[\]]/.test(d.label)),
        [durationCheck.enDash, durationCheck.seconds, durationCheck.compound, durationCheck.untilDone]
          .map(d => d && d.label).join(' | '));
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
    savePlanDay(group.dateIso);
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

  /* The add-recipe modal is left open by an earlier section, and an open
     overlay intercepts every click. This block navigates and clicks cards,
     so it needs a clean screen first. */
  await page.click('#closeAddModal').catch(() => {});
  await page.waitForTimeout(300);

  /* ================= Automatic image re-hosting (IMAGES.md §5 Option A) =================
     Everything here asserts on the recorded INVOKE or the recorded WRITE, not
     on loadRecipes(). The cache is updated before the write is queued, so a
     cache-only assertion passes while the call is throwing — the mistake that
     made the meal-type check vacuous. */

  // The pure helper first: it is what keeps image_url and the IMAGE: line in step.
  const imageLine = await page.evaluate(() => ({
    replaced: withUpdatedImageLine('TITLE: X\nIMAGE: http://old/a.jpg\nTIME: 5 min', 'http://new/b.jpg'),
    inserted: withUpdatedImageLine('TITLE: X\nSOURCE: Y\nTIME: 5 min', 'http://new/b.jpg'),
    removed:  withUpdatedImageLine('TITLE: X\nIMAGE: http://old/a.jpg\nTIME: 5 min', ''),
    noneToRemove: withUpdatedImageLine('TITLE: X\nTIME: 5 min', ''),
  }));
  check('an existing IMAGE line is replaced',
        /IMAGE: http:\/\/new\/b\.jpg/.test(imageLine.replaced) && !/old/.test(imageLine.replaced));
  check('a missing IMAGE line is inserted after SOURCE',
        /SOURCE: Y\nIMAGE: http:\/\/new\/b\.jpg/.test(imageLine.inserted), imageLine.inserted.replace(/\n/g,' | '));
  check('clearing the URL removes the line rather than blanking it',
        !/IMAGE:/.test(imageLine.removed), imageLine.removed.replace(/\n/g,' | '));
  check('removing a line that is not there changes nothing',
        imageLine.noneToRemove === 'TITLE: X\nTIME: 5 min');

  /* The fixture recipe R3 carries an external image, which is the only
     state this feature acts on. Open it, save it unchanged, and the app
     should ask the Edge Function to re-host exactly that recipe. */
  const REHOSTED = 'https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/h/r.jpg?v=123';
  await page.evaluate((to) => {
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = (call) => ({
      data: { report: [{ id: call.body.recipeId, outcome: 'rehosted', to }] }, error: null
    });
  }, REHOSTED);

  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  const r3 = page.locator('.rcard', { hasText: 'Test Traybake' }).first();
  await r3.click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  const externalUrl = await page.inputValue('#f-image');
  check('the fixture recipe really does have an external image',
        externalUrl.startsWith('https://cdn.example.com/'), externalUrl);
  await page.click('#saveBtn');
  await page.waitForFunction(() => (window.__INVOKES__ || []).length > 0, null, { timeout: 4000 })
    .catch(() => {});

  const invokes = await page.evaluate(() => window.__INVOKES__ || []);
  check('saving a recipe with an external image asks for a re-host',
        invokes.length === 1 && invokes[0].name === 'rehost-images', JSON.stringify(invokes));
  check('and asks for that one recipe, not a whole sweep',
        !!(invokes[0] && invokes[0].body && invokes[0].body.recipeId), JSON.stringify(invokes[0] && invokes[0].body));

  const applied = await page.evaluate((to) => {
    const r = loadRecipes().find(x => x.title === 'Test Traybake');
    return { url: r.imageUrl, syntaxHasNew: r.syntax.includes('IMAGE: ' + to), syntaxHasOld: /cdn\.example\.com/.test(r.syntax) };
  }, REHOSTED);
  check('the returned URL is written back to the recipe', applied.url === REHOSTED, applied.url);
  check('and into the IMAGE line, not just the column',
        applied.syntaxHasNew && !applied.syntaxHasOld, JSON.stringify(applied));

  /* THE REGRESSION TEST, in two halves since PR 5.

     A favourite toggle is now an UPDATE of that one column on that one
     row — it cannot carry a stale image URL anywhere, and it must not, so
     the first half asserts on the shape of what was sent. The save from the
     edit form still writes the whole row from the cache, so if the write-back
     above had not happened, THAT save would push the stale external URL
     straight back over the row: the second half asserts on the row it sent. */
  const beforeToggle = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes').length);
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Traybake' }).first().locator('.rcard-favourite').click();
  await page.waitForTimeout(500);
  const toggleWrites = await page.evaluate((n) => {
    const ws = (window.__WRITES__ || []).filter(w => w.table === 'recipes').slice(n);
    const id = loadRecipes().find(r => r.title === 'Test Traybake').id;
    return ws.map(w => ({ op: w.op, keys: w.patch ? Object.keys(w.patch).sort() : null,
                          onId: !!(w.eqs && w.eqs.some(e => e.column === 'id' && e.value === id)),
                          onHousehold: !!(w.eqs && w.eqs.some(e => e.column === 'household_id' && e.value === HOUSEHOLD_ID)) }));
  }, beforeToggle);
  check('a favourite toggle sends exactly one write', toggleWrites.length === 1, JSON.stringify(toggleWrites));
  check('an update of that recipe, scoped to the household',
        toggleWrites.length === 1 && toggleWrites[0].op === 'update' && toggleWrites[0].onId && toggleWrites[0].onHousehold,
        JSON.stringify(toggleWrites));
  check('carrying only the favourite (and the timestamp), never the row',
        toggleWrites.length === 1 && JSON.stringify(toggleWrites[0].keys) === JSON.stringify(['favourite', 'updated_at']),
        JSON.stringify(toggleWrites[0] && toggleWrites[0].keys));

  /* A recipe already self-hosted must not ask again — this is what makes
     the trigger self-limiting rather than needing a flag. And this save is
     the whole-row write the re-hosted URL has to survive. */
  await page.evaluate(() => { window.__INVOKES__.length = 0; });
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Traybake' }).first().click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  check('saving an already self-hosted recipe asks for nothing',
        (await page.evaluate(() => window.__INVOKES__.length)) === 0);
  const pushed = await page.evaluate(() => {
    const last = (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'upsert').pop();
    const row = (last.rows || []).find(r => r.title === 'Test Traybake');
    return row ? { rows: last.rows.length, image_url: row.image_url, syntax_has_cdn: /cdn\.example\.com/.test(row.syntax || '') } : null;
  });
  check('the edit save writes that one row', pushed && pushed.rows === 1, JSON.stringify(pushed));
  check('and does NOT revert the re-hosted URL', pushed && pushed.image_url === REHOSTED, JSON.stringify(pushed));
  check('nor revert the IMAGE line', pushed && !pushed.syntax_has_cdn, JSON.stringify(pushed));

  /* The save path's own IMAGE: line update.
     Until 22 Sep nothing wrote that line — only TITLE: was reconciled with
     the form — so changing the image URL left image_url and the recipe text
     disagreeing, and parseAndPreview would later read the stale line back
     over the field. Asserting on the pushed row, not on loadRecipes(): the
     cache is updated before the write is queued. */
  const CHANGED = 'https://cdn.example.com/changed-photo.jpg';
  await page.evaluate(() => { window.__INVOKES__.length = 0; window.__INVOKE_REPLY__ = { data: { report: [] }, error: null }; });
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Traybake' }).first().click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.fill('#f-image', CHANGED);
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const savedRow = await page.evaluate(() => {
    const last = (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'upsert').pop();
    const row = (last.rows || []).find(r => r.title === 'Test Traybake');
    return row ? { image_url: row.image_url, imageLine: (row.syntax.match(/^IMAGE:.*$/m) || [''])[0] } : null;
  });
  check('editing the image URL writes it to the column',
        savedRow && savedRow.image_url === CHANGED, JSON.stringify(savedRow));
  check('and updates the IMAGE line in the recipe text to match',
        savedRow && savedRow.imageLine === `IMAGE: ${CHANGED}`, JSON.stringify(savedRow));

  /* The race guard.
     The call is in flight for a second or two, and the person may change the
     image again in that time. A response for a URL that is no longer current
     must be discarded, or an older answer silently overwrites a newer choice. */
  const LATER = 'https://cdn.example.com/even-newer.jpg';
  const STALE_REPLY = 'https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/h/stale.jpg?v=1';
  await page.evaluate(({ later, stale }) => {
    window.__INVOKES__.length = 0;
    /* Answer as though the re-host of the PREVIOUS url had just completed,
       while the recipe has since moved on to `later`. */
    window.__INVOKE_REPLY__ = (call) => {
      const r = loadRecipes().find(x => x.id === call.body.recipeId);
      if (r) r.imageUrl = later;          // the person edits again, mid-flight
      return { data: { report: [{ id: call.body.recipeId, outcome: 'rehosted', to: stale }] }, error: null };
    };
  }, { later: LATER, stale: STALE_REPLY });

  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Traybake' }).first().click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.fill('#f-image', 'https://cdn.example.com/in-flight.jpg');
  await page.click('#saveBtn');
  await page.waitForFunction(() => (window.__INVOKES__ || []).length > 0, null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  const afterRace = await page.evaluate(() => loadRecipes().find(r => r.title === 'Test Traybake').imageUrl);
  check('a response for a URL that has since changed is discarded',
        afterRace === LATER, afterRace);

  // A recipe with no image at all must not ask either.
  await page.evaluate(() => { window.__INVOKES__.length = 0; });
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Soup' }).first().click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  check('saving a recipe with no image asks for nothing',
        (await page.evaluate(() => window.__INVOKES__.length)) === 0);

  /* Coming back to the grid by the sidebar must show the re-hosted photo.
     An EDIT save lands on the Viewer, so the re-host reply arrives while the
     grid is hidden and applyRehostedUrl rightly doesn't draw it. The grid
     then has to be drawn on the way back — and showView('recipes') didn't,
     so the card kept the pre-edit photo until a reload. Found on the live
     app, 22 Sep: "the new one appears briefly, then the old one". */
  const VIA_SIDEBAR = 'https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/h/sidebar.jpg?v=7';
  await page.evaluate((to) => {
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = (call) => ({ data: { report: [{ id: call.body.recipeId, outcome: 'rehosted', to }] }, error: null });
  }, VIA_SIDEBAR);
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Traybake' }).first().click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.fill('#f-image', 'https://cdn.example.com/sidebar-source.jpg');
  await page.click('#saveBtn');
  await page.waitForFunction(() => (window.__INVOKES__ || []).length > 0, null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  const cardSrc = () => page.evaluate(() => {
    const card = [...document.querySelectorAll('.rcard')].find(c => c.textContent.includes('Test Traybake'));
    const img = card && card.querySelector('.rcard-photo img');
    return img ? img.getAttribute('src') : null;
  });
  /* The precondition, asserted rather than assumed: the reply really did
     land while the Viewer was showing, and the hidden grid really is stale.
     Without this the check below could pass for the wrong reason. */
  const onViewer = await page.evaluate(() => ({
    view: state.view,
    cached: loadRecipes().find(r => r.title === 'Test Traybake').imageUrl
  }));
  const staleSrc = await cardSrc();
  check('an edit save lands on the Viewer, and the reply is applied there',
        onViewer.view === 'viewer' && onViewer.cached === VIA_SIDEBAR, JSON.stringify(onViewer));
  check('so the hidden grid is still showing the old photo',
        staleSrc !== VIA_SIDEBAR, String(staleSrc));
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  check('returning by the sidebar shows the re-hosted photo',
        (await cardSrc()) === VIA_SIDEBAR, String(await cardSrc()));

  /* ---- Coming back to the tab (22 Sep) ----
     supabase-js emits SIGNED_IN on every hidden → visible change of the tab,
     with no network call, so offline too. The app used to treat each one as
     a fresh start: re-download everything, and sign you out if that failed.
     Found by the first offline test ever run against the live app.

     Each check below targets one mechanism in refreshLibrary, and each was
     mutation-tested by breaking exactly that mechanism. Note the stub's
     "server" never applies writes, so a refresh that DOES apply resets the
     cache to the fixture — which is why these sit at the end of the suite. */
  const fireSignedIn = () => page.evaluate(() => window.__AUTH_CB__('SIGNED_IN'));
  const setServerTitle = (t) => page.evaluate((t) => { window.__STUB_DATA__.recipes[0].title = t; }, t);
  const hasTitle = (t) => page.evaluate((t) => loadRecipes().some(r => r.title === t), t);
  /* A deliberate failure logs 'Sync failed' to the console, which this suite
     otherwise counts as an app fault. Only that, only inside the window. */
  const allowSyncFailures = async (fn) => {
    const mark = errors.length;
    await fn();
    for (let i = errors.length - 1; i >= mark; i--) if (/Sync failed/.test(errors[i])) errors.splice(i, 1);
  };
  const favState = async () => page.evaluate(() => {
    const btn = document.querySelector('.rcard-favourite');
    const r = loadRecipes().find(x => x.id === btn.dataset.favourite);
    return { id: r.id, favourite: !!r.favourite };
  });
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);

  check('the app is listening for SIGNED_IN at all',
        await page.evaluate(() => typeof window.__AUTH_CB__ === 'function'));

  // Offline: nothing may be lost, and nobody may be signed out.
  const countBefore = await page.evaluate(() => loadRecipes().length);
  const signoutsBefore = await page.evaluate(() => window.__SIGNOUTS__);
  await page.evaluate(() => { window.__READ_FAIL__ = true; });
  await fireSignedIn();
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__READ_FAIL__ = false; });
  check('coming back to the tab offline does not sign you out',
        (await page.evaluate(() => window.__SIGNOUTS__)) === signoutsBefore && !(await page.isVisible('#loginGate')));
  check('and keeps the library that was loaded',
        (await page.evaluate(() => loadRecipes().length)) === countBefore && countBefore > 0, String(countBefore));

  // Online: the refresh must still happen — it is what keeps a long-open tab current.
  await setServerTitle('Test Pasta, edited elsewhere');
  await fireSignedIn();
  await page.waitForTimeout(400);
  check('coming back online picks up a change made on another device',
        await hasTitle('Test Pasta, edited elsewhere'));
  await setServerTitle('Test Pasta');

  // It must not read the server before this page's own saves have reached it.
  await page.evaluate(() => { window.__WRITE_DELAY__ = 600; window.__LOG__.length = 0; });
  await page.locator('.rcard-favourite').first().click();
  await fireSignedIn();
  await page.waitForTimeout(1400);
  await page.evaluate(() => { window.__WRITE_DELAY__ = 0; });
  const order = await page.evaluate(() => window.__LOG__.slice());
  const writeDone = order.indexOf('write-done:recipes');
  const firstRead = order.findIndex(e => e.startsWith('read:'));
  check('a refresh waits for queued saves before reading',
        writeDone !== -1 && firstRead > writeDone, order.slice(0, 4).join(', '));

  // A change made while the refresh is fetching must survive it.
  await setServerTitle('Test Pasta, edited mid-fetch');
  await page.evaluate(() => { window.__READ_DELAY__ = 500; });
  await fireSignedIn();
  await page.waitForTimeout(150);
  const midBefore = await favState();
  await page.locator('.rcard-favourite').first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__READ_DELAY__ = 0; });
  const midAfter = await page.evaluate((id) => !!loadRecipes().find(r => r.id === id).favourite, midBefore.id);
  check('a refresh is discarded if anything changed while it was fetching',
        !(await hasTitle('Test Pasta, edited mid-fetch')));
  check('so the change made mid-fetch is kept', midAfter === !midBefore.favourite,
        `${midBefore.favourite} -> ${midAfter}`);
  await setServerTitle('Test Pasta');

  // A save that failed must not be undone by a refresh.
  /* Start from the fixture's own values. The test above leaves this recipe's
     favourite flipped, and from there one failed toggle lands back ON the
     fixture value — so a refresh that wrongly applied would "restore" exactly
     what the check expects, and the check would pass a broken app. It did,
     under mutation, before this line was added. */
  await fireSignedIn();
  await page.waitForTimeout(400);
  const unsentBefore = await favState();
  await allowSyncFailures(async () => {
    await page.evaluate(() => { window.__WRITE_FAIL__ = true; });
    await page.locator('.rcard-favourite').first().click();
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__WRITE_FAIL__ = false; });
  });
  await setServerTitle('Test Pasta, edited while a save was failing');
  await fireSignedIn();
  await page.waitForTimeout(400);
  check('a refresh stands down while a save has failed',
        !(await hasTitle('Test Pasta, edited while a save was failing')));
  check('so the unsaved change is still there to be sent',
        (await page.evaluate((id) => !!loadRecipes().find(r => r.id === id).favourite, unsentBefore.id)) === !unsentBefore.favourite);
  /* The next write of anything re-runs the failed one first (PR 5: saves are
     single rows, so nothing later can vouch for an earlier failure — it has
     to be sent again). Then refreshing may resume. */
  const updatesBeforeRetry = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'update').length);
  await page.locator('.rcard-favourite').first().click();
  await page.waitForTimeout(300);
  const retried = await page.evaluate((n) =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'update').slice(n).map(w => w.patch.favourite), updatesBeforeRetry);
  check('the failed write is sent again ahead of the next one',
        retried.length === 2 && retried[0] === !unsentBefore.favourite && retried[1] === unsentBefore.favourite,
        JSON.stringify(retried));
  await fireSignedIn();
  await page.waitForTimeout(400);
  check('once the retried write lands, refreshing resumes',
        await hasTitle('Test Pasta, edited while a save was failing'));
  await setServerTitle('Test Pasta');

  /* ---------------------------------------------------------------------
     F5 / F7 (23 Sep): the header lines follow the form on save, the delete
     step of pushList is aimed at exactly the right rows, and a non-adjacent
     merge is reported in the preview. Each of these was a mutation the
     architecture review ran against the suite and got 197 green for
     (docs/REVIEW-ARCHITECTURE-FINDINGS.md, Appendix B: M4, M5, M6). Every
     assertion below is on the ROW THAT WAS SENT, not on the cache, because
     the cache is updated before the write is queued and would pass with
     the write missing.
     ------------------------------------------------------------------- */
  const lastRecipeUpsertRow = (title) => page.evaluate((t) => {
    const last = (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'upsert').pop();
    return last ? ((last.rows || []).find(r => r.title === t) || null) : null;
  }, title);
  const headerLine = (syntax, key) => ((syntax || '').match(new RegExp('^' + key + ':.*$', 'm')) || [null])[0];

  // Edit every header field of Test Soup at once.
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard', { hasText: 'Test Soup' }).first().click();
  await page.waitForTimeout(400);
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.fill('#f-title', 'Test Soup Renamed');
  /* Nothing like an existing source, so the similar-source prompt stays
     out of it — this block is about the lines, not the alias flow. */
  await page.fill('#f-source', 'Blue Door Bakery');
  await page.fill('#f-source-url', 'https://example.com/soup');
  await page.fill('#f-time', '1 hr 5');
  await page.fill('#f-servings', '6');
  await page.fill('#f-equipment', '24cm casserole');
  /* A course the vocabulary has not seen, added the way parseAndPreview
     adds one from a pasted recipe. */
  await page.evaluate(() => {
    const sel = document.getElementById('f-course');
    sel.insertAdjacentHTML('beforeend', '<option>Side</option>');
    sel.value = 'Side';
  });
  await page.fill('#f-keywords', 'Veg, Winter');
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const hdr = await lastRecipeUpsertRow('Test Soup Renamed');
  const hs = hdr ? hdr.syntax : '';
  check('the TITLE line follows the form', headerLine(hs, 'TITLE') === 'TITLE: Test Soup Renamed', headerLine(hs, 'TITLE'));
  check('the SOURCE line follows the form', hdr && hdr.source === 'Blue Door Bakery' && headerLine(hs, 'SOURCE') === 'SOURCE: Blue Door Bakery',
        headerLine(hs, 'SOURCE'));
  check('a SOURCE_URL line is written when the text had none',
        hdr && hdr.source_url === 'https://example.com/soup' && headerLine(hs, 'SOURCE_URL') === 'SOURCE_URL: https://example.com/soup',
        headerLine(hs, 'SOURCE_URL'));
  check('the TIME line follows the form', hdr && hdr.time_text === '1 hr 5' && headerLine(hs, 'TIME') === 'TIME: 1 hr 5', headerLine(hs, 'TIME'));
  check('the SERVINGS line follows the form', hdr && hdr.servings === 6 && headerLine(hs, 'SERVINGS') === 'SERVINGS: 6', headerLine(hs, 'SERVINGS'));
  check('an EQUIPMENT line is written when the text had none',
        hdr && hdr.equipment === '24cm casserole' && headerLine(hs, 'EQUIPMENT') === 'EQUIPMENT: 24cm casserole', headerLine(hs, 'EQUIPMENT'));
  check('the TAGS line follows the form, course first',
        hdr && hdr.tags && hdr.tags.course === 'Side' && headerLine(hs, 'TAGS') === 'TAGS: course=Side, Veg, Winter', headerLine(hs, 'TAGS'));
  const hdrOrder = ['TITLE','SOURCE','SOURCE_URL','TIME','SERVINGS','EQUIPMENT','TAGS'].map(k => hs.search(new RegExp('^' + k + ':', 'm')));
  check('inserted lines land in the converter\'s header order',
        hdrOrder.every((pos, i) => pos >= 0 && (i === 0 || pos > hdrOrder[i - 1])), hdrOrder.join(','));
  const reparsed = await page.evaluate((text) => {
    const p = parseRecipe(text);
    return { title: p.title, source: p.source, sourceUrl: p.sourceUrl, time: p.time, servings: p.servings,
             equipment: p.equipment, course: p.tags.course, keywords: p.tags.keywords.join(','), groups: p.groups.length, stages: p.stages.length };
  }, hs);
  check('and the rewritten text parses back to the form\'s values',
        reparsed.title === 'Test Soup Renamed' && reparsed.source === 'Blue Door Bakery' && reparsed.sourceUrl === 'https://example.com/soup'
        && reparsed.time === '1 hr 5' && reparsed.servings === '6' && reparsed.equipment === '24cm casserole'
        && reparsed.course === 'Side' && reparsed.keywords === 'Veg,Winter' && reparsed.groups === 2 && reparsed.stages === 2,
        JSON.stringify(reparsed));

  // Clearing a field removes its line, the way a converter leaves one out.
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  await page.fill('#f-equipment', '');
  await page.fill('#f-source-url', '');
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const cleared = await lastRecipeUpsertRow('Test Soup Renamed');
  const cs = cleared ? cleared.syntax : '';
  check('clearing a field removes its line rather than leaving an empty one',
        cleared && cleared.equipment === '' && cleared.source_url === null && !/^EQUIPMENT:/m.test(cs) && !/^SOURCE_URL:/m.test(cs)
        && !/\n\n\n/.test(cs.split('GROUP')[0]),
        JSON.stringify(cs.split('\n').slice(0, 7)));

  // The live drift case: a SERVINGS line missing from the text is written on save.
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await page.fill('#importInput', 'TITLE: Header Insert Test\nSOURCE: Blue Door Bakery\nTIME: 20 min\n\nGROUP a:\n1 onion\n\nSTAGE:\nMERGE a -> done: Cook [5 min]');
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  await page.fill('#f-servings', '3');
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const inserted = await lastRecipeUpsertRow('Header Insert Test');
  const is = inserted ? inserted.syntax : '';
  check('a SERVINGS line missing from the text is written on save, after TIME',
        inserted && inserted.servings === 3 && /^TIME: 20 min\nSERVINGS: 3$/m.test(is), JSON.stringify(is.split('\n').slice(0, 5)));
  const newRecipeWrite = await page.evaluate(() => {
    const last = (window.__WRITES__ || []).filter(w => w.table === 'recipes').pop();
    return { op: last.op, rows: last.rows ? last.rows.length : null, title: last.rows && last.rows[0].title };
  });
  check('a new recipe is one upsert of one row', newRecipeWrite.op === 'upsert' && newRecipeWrite.rows === 1 && newRecipeWrite.title === 'Header Insert Test',
        JSON.stringify(newRecipeWrite));

  // A non-adjacent merge is an error the preview shows, naming the stage (M6).
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await page.fill('#importInput', 'TITLE: Gap Test\nSOURCE: Blue Door Bakery\nSERVINGS: 2\n\nGROUP a:\n1 onion\n\nGROUP b:\n1 carrot\n\nGROUP c:\n1 leek\n\nSTAGE:\nMERGE a, c -> ac: Combine across the gap [instant]');
  await page.click('#parseBtn');
  await page.waitForTimeout(300);
  const gapErr = (await page.locator('#addPreview .errors').count()) ? await page.locator('#addPreview .errors').textContent() : '';
  check('a merge across non-adjacent rows is reported in the preview, by stage',
        /Stage 1/.test(gapErr) && /aren't adjacent rows/.test(gapErr), gapErr.trim().slice(0, 90));
  const gapOk = await page.evaluate(() => computeColumns(parseRecipe('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nSTAGE:\nMERGE a, b -> ab: Fine [instant]').groups,
                                                         parseRecipe('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nSTAGE:\nMERGE a, b -> ab: Fine [instant]').stages).errors.length);
  check('while adjacent rows merge without complaint', gapOk === 0, gapOk + ' errors');
  await page.click('#closeAddModal');
  await page.waitForTimeout(300);
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);

  /* Deleting a recipe (PR 5, F1 and F11). One delete, of that row; and every
     reference to it tidied as its own row write: the plan day it was on
     (servings kept in lockstep), the group it was in (dissolved, one recipe
     is not a group), the shortlist entry for it. Set those references up
     first, through the app's own functions, so there is something to tidy. */
  await page.locator('.rcard', { hasText: 'Header Insert Test' }).first().click();
  await page.waitForTimeout(400);
  const setup = await page.evaluate(async () => {
    const doomed = state.selectedRecipeId;
    const other = loadRecipes().find(r => r.title.startsWith('Test Pasta')).id;
    const date = '2026-09-25';
    delete loadPlan()[date];
    addPlanRecipe(date, other); setPlanServingsAt(date, 0, 6);
    addPlanRecipe(date, doomed); setPlanServingsAt(date, 1, 3);
    createGroup(date, [other, doomed]);
    addShortlistRecipe(doomed);
    const group = loadGroups().find(g => g.dateIso === date);
    const item = loadShortlist().find(i => i.recipeId === doomed);
    /* Writes are queued, not sent on the spot: let the setup's own land
       before clearing the log, or they would be counted as the delete's. */
    await new Promise(r => setTimeout(r, 100));
    window.__WRITES__.length = 0;   // only the delete's own writes from here
    return { doomed, other, date, groupId: group && group.id, itemId: item && item.id };
  });
  page.once('dialog', d => d.accept());
  await page.click('#deleteBtn');
  await page.waitForTimeout(600);
  const del = await page.evaluate((s) => {
    const ws = window.__WRITES__ || [];
    const eq = (w, col) => (w.eqs || []).find(e => e.column === col);
    const recipeDeletes = ws.filter(w => w.table === 'recipes' && w.op === 'delete');
    const d = recipeDeletes[0];
    const planUpserts = ws.filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows);
    const day = planUpserts.find(r => r.plan_date === s.date);
    const groupDeletes = ws.filter(w => w.table === 'meal_groups' && w.op === 'delete');
    const shortDeletes = ws.filter(w => w.table === 'shortlist_items' && w.op === 'delete');
    return {
      recipeDeletes: recipeDeletes.length,
      onId: !!(d && eq(d, 'id') && eq(d, 'id').value === s.doomed),
      onHousehold: !!(d && eq(d, 'household_id') && eq(d, 'household_id').value === HOUSEHOLD_ID),
      noNotIn: !!(d && !d.not),
      recipeUpserts: ws.filter(w => w.table === 'recipes' && w.op === 'upsert').length,
      dayRow: day ? { ids: day.recipe_ids, servings: day.servings } : null,
      dayOk: !!(day && JSON.stringify(day.recipe_ids) === JSON.stringify([s.other]) && JSON.stringify(day.servings) === JSON.stringify([6])),
      cacheDay: loadPlan()[s.date],
      groupDeleted: groupDeletes.some(w => eq(w, 'id') && eq(w, 'id').value === s.groupId),
      groupGone: !loadGroups().some(g => g.id === s.groupId),
      shortDeleted: shortDeletes.some(w => eq(w, 'id') && eq(w, 'id').value === s.itemId),
      shortGone: !loadShortlist().some(i => i.id === s.itemId),
      stillThere: loadRecipes().some(r => r.id === s.doomed)
    };
  }, setup);
  check('deleting a recipe sends one delete, of that row, scoped to the household',
        del.recipeDeletes === 1 && del.onId && del.onHousehold && del.noNotIn, JSON.stringify(del));
  check('and no rewrite of the rest of the library', del.recipeUpserts === 0 && !del.stillThere, del.recipeUpserts + ' upserts');
  check('its plan day is rewritten without it, servings in lockstep', del.dayOk, JSON.stringify(del.dayRow));
  check('the group it left with one recipe is dissolved', del.groupDeleted && del.groupGone, JSON.stringify(del));
  check('and its shortlist entry is removed', del.shortDeleted && del.shortGone, JSON.stringify(del));

  /* ---- Every other save is one row too (F1) ---- */
  const rowWrites = await page.evaluate(async () => {
    const out = {};
    const since = () => (window.__WRITES__ || []).slice(mark);
    let mark;
    const eq = (w, col) => ((w.eqs || []).find(e => e.column === col) || {}).value;
    /* Each save queues its write; nothing is in the log until the queue has
       run. Drain it before reading. */
    const drain = () => new Promise(r => setTimeout(r, 60));

    // Plan: adding to a day writes that day; emptying it deletes that day.
    mark = window.__WRITES__.length;
    const date = '2026-09-26';
    const r1 = loadRecipes().find(r => r.title.startsWith('Test Pasta')).id;
    addPlanRecipe(date, r1);
    await drain();
    out.planAdd = since().map(w => ({ table: w.table, op: w.op, rows: w.rows && w.rows.map(r => r.plan_date) }));
    mark = window.__WRITES__.length;
    removePlanRecipeAt(date, 0);
    await drain();
    out.planEmpty = since().map(w => ({ table: w.table, op: w.op, date: eq(w, 'plan_date') }));

    // Ticks: on inserts one row, off deletes one row, UNTICK ALL deletes those keys.
    mark = window.__WRITES__.length;
    toggleShoppingChecked('2026-09-18', 'k|one');
    toggleShoppingChecked('2026-09-18', 'k|one');
    clearTicks('2026-09-18', ['k|two', 'k|three']);
    await drain();
    out.ticks = since().map(w => ({ op: w.op, rows: w.rows && w.rows.map(r => r.item_key), key: eq(w, 'item_key'), week: eq(w, 'week_start'), in: w.in && w.in.values }));

    // Word matches: keyed by the word, not the id, on the way in and out.
    mark = window.__WRITES__.length;
    addAlias('ingredient', 'Zucchini', 'courgette');
    const alias = loadAliases().find(a => a.alias === 'Zucchini');
    removeAlias(alias.id);
    await drain();
    out.aliases = since().map(w => ({ op: w.op, rows: w.rows && w.rows.length, onConflict: w.opts && w.opts.onConflict, kind: eq(w, 'kind'), alias: eq(w, 'alias') }));

    // Swaps and keywords: one row each way.
    mark = window.__WRITES__.length;
    saveSwap({ id: uid(), original: 'butter', replacement: 'oil', ratio: '', notes: '' });
    deleteSwap(loadSwaps().find(s => s.original === 'butter').id);
    mergeKeywordVocab(['Brand New']);
    removeKeywordFromVocab('Brand New');
    await drain();
    out.rest = since().map(w => ({ table: w.table, op: w.op, rows: w.rows && w.rows.length, name: eq(w, 'name'), id: !!eq(w, 'id') }));
    out.noDeleteNotIn = since().every(w => !w.not);
    return out;
  });
  check('adding to a plan day writes only that day',
        rowWrites.planAdd.length === 1 && rowWrites.planAdd[0].op === 'upsert' && JSON.stringify(rowWrites.planAdd[0].rows) === '["2026-09-26"]',
        JSON.stringify(rowWrites.planAdd));
  check('emptying a plan day deletes only that day',
        rowWrites.planEmpty.length === 1 && rowWrites.planEmpty[0].op === 'delete' && rowWrites.planEmpty[0].date === '2026-09-26',
        JSON.stringify(rowWrites.planEmpty));
  check('a tick on is one row in, a tick off is one row out, untick-all names its keys',
        rowWrites.ticks.length === 3 && rowWrites.ticks[0].op === 'upsert' && JSON.stringify(rowWrites.ticks[0].rows) === '["k|one"]'
        && rowWrites.ticks[1].op === 'delete' && rowWrites.ticks[1].key === 'k|one' && rowWrites.ticks[1].week === '2026-09-18'
        && rowWrites.ticks[2].op === 'delete' && JSON.stringify(rowWrites.ticks[2].in) === '["k|two","k|three"]',
        JSON.stringify(rowWrites.ticks));
  check('a word match is upserted on its word and deleted by its word',
        rowWrites.aliases.length === 2 && rowWrites.aliases[0].op === 'upsert' && rowWrites.aliases[0].rows === 1 && rowWrites.aliases[0].onConflict === 'household_id,kind,alias'
        && rowWrites.aliases[1].op === 'delete' && rowWrites.aliases[1].kind === 'ingredient' && rowWrites.aliases[1].alias === 'Zucchini',
        JSON.stringify(rowWrites.aliases));
  check('a swap and a keyword go in and out as single rows',
        rowWrites.rest.length === 4 && rowWrites.rest[0].op === 'upsert' && rowWrites.rest[0].rows === 1 && rowWrites.rest[1].op === 'delete' && rowWrites.rest[1].id
        && rowWrites.rest[2].op === 'upsert' && rowWrites.rest[2].rows === 1 && rowWrites.rest[3].op === 'delete' && rowWrites.rest[3].name === 'Brand New',
        JSON.stringify(rowWrites.rest));
  check('and none of them deletes "everything not in my list"', rowWrites.noDeleteNotIn);

  /* ---- Import is the one whole-table replace left, and it must still be one ---- */
  const backupJson = await page.evaluate(() => JSON.stringify({
    app: 'Kitchen', version: 3, recipes: loadRecipes(), diary: loadDiary(), plan: loadPlan(), shortlist: loadShortlist(),
    keywordVocab: loadKeywordVocab(), shoppingChecked: loadShoppingChecked(), swaps: loadSwaps(), groups: loadGroups(),
    settings: loadSettings(), aliases: loadAliases()
  }));
  const recipeCount = JSON.parse(backupJson).recipes.length;
  await page.evaluate(() => { window.__WRITES__.length = 0; });
  page.once('dialog', d => d.accept());
  await page.setInputFiles('#importFileInput', { name: 'kitchen-backup-test.json', mimeType: 'application/json', buffer: Buffer.from(backupJson) });
  await page.waitForTimeout(1200);
  const imp = await page.evaluate(() => {
    const ws = window.__WRITES__ || [];
    const byTable = (t) => ws.filter(w => w.table === t).map(w => ({ op: w.op, rows: w.rows ? w.rows.length : null, notIn: !!(w.not && w.not.op === 'in') }));
    return { recipes: byTable('recipes'), plan: byTable('planner_days'), groups: byTable('meal_groups'), shortlist: byTable('shortlist_items') };
  });
  check('import upserts every recipe in the file and deletes what is not in it',
        imp.recipes.length === 2 && imp.recipes[0].op === 'upsert' && imp.recipes[0].rows === recipeCount && imp.recipes[1].op === 'delete' && imp.recipes[1].notIn,
        JSON.stringify(imp.recipes) + ' for ' + recipeCount + ' recipes');
  check('and replaces the plan, groups and shortlist the same way',
        [imp.plan, imp.groups, imp.shortlist].every(t => t.some(w => w.op === 'delete')),
        JSON.stringify({ plan: imp.plan, groups: imp.groups, shortlist: imp.shortlist }));

  /* PR 5: a backup carries source_check on each recipe that has one, and restoring it puts it back; an older backup
     without it imports as none. The real export button and the real import, through a file. Two invented recipes are
     added to the library for it and taken out again. */
  const impHash = await page.evaluate(l => linesHash(l), ['2 onions, diced', '200 g red lentils']);
  const impCheck = { at: '2026-09-01T10:00:00.000Z', route: 'function', hard: 2, soft: 1, sourceLines: 5, linesHash: impHash };
  await page.evaluate(c => {
    const mk = (id, sc) => ({ id, title: 'Imp ' + id, source: 'Blue Door Bakery', sourceUrl: '', servings: 4, tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-06', sourceCheck: sc,
      syntax: 'TITLE: Imp ' + id + '\nSOURCE: Blue Door Bakery\nSERVINGS: 4\n\nGROUP a:\n2 onions, diced\n200 g red lentils\n\nSTAGE:\nMERGE a -> done: Cook [5 min]' });
    loadRecipes().push(mk('imp-new', c), mk('imp-none', null));
  }, impCheck);
  const impFile = require('path').join(require('os').tmpdir(), 'kitchen-backup-source-check.json');
  const [impDl] = await Promise.all([page.waitForEvent('download'), page.click('#exportDataBtn')]);
  await impDl.saveAs(impFile);
  const impExport = JSON.parse(require('fs').readFileSync(impFile, 'utf8'));
  const impExNew = (impExport.recipes || []).find(r => r.id === 'imp-new') || {};
  const impExNone = (impExport.recipes || []).find(r => r.id === 'imp-none') || {};
  await page.evaluate(() => { loadRecipes().forEach(r => { r.sourceCheck = null; }); window.__WRITES__.length = 0; });   // as if another device, which has never heard of it
  page.once('dialog', d => d.accept());
  await page.setInputFiles('#importFileInput', impFile);
  await page.waitForTimeout(1200);
  const impRows = await page.evaluate(() => window.__WRITES__.filter(w => w.table === 'recipes' && w.op === 'upsert').flatMap(w => w.rows));
  const impBack = await page.evaluate(() => ({ nu: (loadRecipes().find(r => r.id === 'imp-new') || {}).sourceCheck, none: (loadRecipes().find(r => r.id === 'imp-none') || {}).sourceCheck }));
  const impChipNew = await pvChips('imp-new');
  const impChipNone = await pvChips('imp-none');
  check('export carries source_check and import restores it: in the file, in the cache, in the row written, and in the chip',
        JSON.stringify(impExNew.sourceCheck) === JSON.stringify(impCheck) && !impExNone.sourceCheck
        && JSON.stringify(impBack.nu) === JSON.stringify(impCheck) && !impBack.none
        && JSON.stringify((impRows.find(r => r.id === 'imp-new') || {}).source_check) === JSON.stringify(impCheck) && !('source_check' in (impRows.find(r => r.id === 'imp-none') || {}))
        && /· 2 DIFFERENCES$/.test((impChipNew[0] || {}).text || '') && (impChipNone[0] || {}).text === 'NOT COMPARED WITH ITS SOURCE',
        JSON.stringify([impExNew.sourceCheck, impBack, impChipNew, impChipNone]));
  const impOld = JSON.parse(JSON.stringify(impExport));
  impOld.recipes.forEach(r => { delete r.sourceCheck; });
  const impOldFile = require('path').join(require('os').tmpdir(), 'kitchen-backup-older.json');
  require('fs').writeFileSync(impOldFile, JSON.stringify(impOld));
  await page.evaluate(() => { window.__WRITES__.length = 0; });
  page.once('dialog', d => d.accept());
  await page.setInputFiles('#importFileInput', impOldFile);
  await page.waitForTimeout(1200);
  const impOldRows = await page.evaluate(() => window.__WRITES__.filter(w => w.table === 'recipes' && w.op === 'upsert').flatMap(w => w.rows));
  const impOldCache = await page.evaluate(() => loadRecipes().map(r => r.sourceCheck || null));
  const impOldChip = await pvChips('imp-new');
  check('an older backup without it imports with null: no key in any row written, nothing in the cache, and NOT COMPARED in the viewer',
        impOldRows.length === impOld.recipes.length && impOldRows.every(r => !('source_check' in r)) && impOldCache.every(c => c === null)
        && (impOldChip[0] || {}).text === 'NOT COMPARED WITH ITS SOURCE', JSON.stringify([impOldRows.length, impOldCache.filter(Boolean).length, impOldChip]));
  await page.evaluate(() => {
    for(let i = loadRecipes().length - 1; i >= 0; i--) if(String(loadRecipes()[i].id).startsWith('imp-')) loadRecipes().splice(i, 1);
    showView('recipes'); renderHome();
  });
  await page.waitForTimeout(250);

  /* ---- Offline notice (25 Sep). The two-device pass found step 25's toast
     never came: an offline write can sit for up to 30 s behind supabase-js's
     session-refresh retry, then land or fail. The browser knows it is offline
     at once, so the app says so — as a bar across the top that stays for as
     long as it is true, at the household's request — and sends any failed
     write the moment the browser is back online. ---- */
  const toastText = () => page.evaluate(() => { const t = document.querySelector('.toast.show'); return t ? t.textContent : ''; });
  const barShown = () => page.isVisible('#offlineBar');
  check('the offline bar is hidden while online', !(await barShown()));
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); });
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(300);
  await page.locator('.rcard-favourite').first().click();
  await page.waitForTimeout(150);
  check('a save made while offline shows the offline bar at once', await barShown());
  await page.evaluate(() => { document.getElementById('offlineBar').hidden = true; window.dispatchEvent(new Event('offline')); });
  await page.waitForTimeout(100);
  check('going offline shows the bar', await barShown());
  const barBox = await page.evaluate(() => {
    const bar = document.getElementById('offlineBar').getBoundingClientRect();
    const view = document.querySelector('.view.active').getBoundingClientRect();
    return { barBottom: Math.round(bar.bottom), viewTop: Math.round(view.top), text: document.getElementById('offlineBar').textContent.replace(/\s+/g, ' ').trim() };
  });
  check('the bar sits above the page rather than over it', barBox.viewTop >= barBox.barBottom, JSON.stringify(barBox));
  // A write that fails while offline is sent again the moment the browser is back, without a tap.
  await allowSyncFailures(async () => {
    await page.evaluate(() => { window.__WRITE_FAIL__ = true; });
    await page.locator('.rcard-favourite').first().click();
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__WRITE_FAIL__ = false; });
  });
  const updatesBeforeOnline = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'update').length);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    document.querySelector('.toast').classList.remove('show');
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForTimeout(300);
  const updatesAfterOnline = await page.evaluate(() =>
    (window.__WRITES__ || []).filter(w => w.table === 'recipes' && w.op === 'update').length);
  check('coming back online re-sends the failed write by itself', updatesAfterOnline === updatesBeforeOnline + 1,
        updatesBeforeOnline + ' -> ' + updatesAfterOnline);
  check('and says so', /back online/i.test(await toastText()), await toastText());
  check('and the offline bar goes', !(await barShown()));
  await fireSignedIn();
  await page.waitForTimeout(400);
  check('so a refresh is no longer held back', (await page.evaluate(() => window.__LOG__.filter(e => e.startsWith('read:')).length)) > 0);

  // Starting up offline: explain, keep the session, and recover without a password.
  const cold = await browser.newPage();
  const coldErrors = [];
  cold.on('pageerror', e => coldErrors.push(e.message));
  await cold.addInitScript(() => { window.__READ_FAIL__ = true; });
  await cold.clock.setFixedTime(FIXTURE_NOW);
  await cold.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await cold.waitForTimeout(1200);
  const coldMsg = (await cold.textContent('#loginError')) || '';
  check('starting up offline does not sign you out',
        (await cold.evaluate(() => window.__SIGNOUTS__)) === 0);
  check('and says the server could not be reached, not that sign-in failed',
        (await cold.isVisible('#loginGate')) && /reach the server/.test(coldMsg), coldMsg);
  await cold.evaluate(() => { window.__READ_FAIL__ = false; window.__AUTH_CB__('SIGNED_IN'); });
  await cold.waitForTimeout(600);
  check('coming back once connected starts the app by itself',
        !(await cold.isVisible('#loginGate')) && (await cold.locator('.rcard').count()) > 0);
  check('the offline start raised no page errors', coldErrors.length === 0, coldErrors.join('; '));
  await cold.close();

  /* ---- Shopping aisles (PR 6 of the add-recipe plan, 29 Sep 2026) ----
     The household's aisle for a name, set in Settings or from the review, one row per write, and
     applied after the key is final: a row moves aisle and keeps its key and its tick. And the app must
     cope with a merge that arrives before the table does. Invented names, put back at the end. */
  const aoWrites = mark => page.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'aisle_overrides')
    .map(w => ({ op: w.op, rows: (w.rows || []).map(r => ({ name: r.name, aisle: r.aisle, household: !!r.household_id })), onConflict: w.opts && w.opts.onConflict,
      eqs: (w.eqs || []).map(e => e.column + '=' + (e.column === 'household_id' ? 'H' : e.value)).join('&') })), mark);
  const aoShopRow = re => page.evaluate(src => { const el = [...document.querySelectorAll('.shop-item')].find(e => new RegExp(src, 'i').test(e.dataset.name || ''));
    if(!el) return null; const cat = el.closest('.shop-category');
    return { key: el.dataset.key, name: el.dataset.name, aisle: cat ? cat.querySelector('.shop-category-title').textContent.trim() : '', ticked: el.classList.contains('checked') }; }, re.source);
  /* By the row's own name: the tomato row lists "Test Pasta" among its recipes, so matching the text ticks the wrong row. */
  const aoTick = re => page.evaluate(src => { const el = [...document.querySelectorAll('.shop-item')].find(e => new RegExp(src, 'i').test(e.dataset.name || ''));
    if(el) el.querySelector('input').click(); }, re.source);
  await page.click('.navlink[data-view="shopping"]');
  await page.waitForTimeout(300);
  await aoTick(/pasta/);
  await page.waitForTimeout(200);
  const aoBefore = await aoShopRow(/pasta/);
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const aoMark1 = await anMark();
  await page.fill('#aisleOverride-name', aoBefore.name);
  await page.selectOption('#aisleOverride-aisle', 'Produce');
  await page.click('#aisleOverrideAddBtn');
  await page.waitForTimeout(300);
  const aoAdded = await aoWrites(aoMark1);
  const aoListed = await page.evaluate(() => document.getElementById('aisleOverridesList').textContent.replace(/\s+/g, ' ').trim());
  check('Settings → Shopping Aisles: ADD writes one aisle for the name, keyed as the list keys it, upserted on the name',
        aoAdded.length === 1 && aoAdded[0].op === 'upsert' && aoAdded[0].rows.length === 1 && aoAdded[0].rows[0].name === aoBefore.key
        && aoAdded[0].rows[0].aisle === 'Produce' && aoAdded[0].rows[0].household && aoAdded[0].onConflict === 'household_id,name'
        && new RegExp(aoBefore.key + ' ?in ?Produce').test(aoListed), JSON.stringify([aoBefore, aoAdded, aoListed]));
  await page.click('.navlink[data-view="shopping"]');
  await page.waitForTimeout(300);
  const aoMoved = await aoShopRow(/pasta/);
  check('    the row moves to that aisle on the shopping list, with the same key and its tick kept',
        aoBefore && aoBefore.ticked === true && aoBefore.aisle !== 'PRODUCE' && aoMoved && aoMoved.aisle === 'PRODUCE' && aoMoved.key === aoBefore.key && aoMoved.ticked === true,
        JSON.stringify([aoBefore, aoMoved]));
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const aoMark2 = await anMark();
  await page.click('[data-remove-aisle-override]');
  await page.waitForTimeout(300);
  const aoRemoved = await aoWrites(aoMark2);
  await page.click('.navlink[data-view="shopping"]');
  await page.waitForTimeout(300);
  const aoBack = await aoShopRow(/pasta/);
  check('    REMOVE deletes that one row, with no dialog, and the row goes back where the list put it',
        aoRemoved.length === 1 && aoRemoved[0].op === 'delete' && aoRemoved[0].eqs === 'household_id=H&name=' + aoBefore.key && aoBack.aisle === aoBefore.aisle && aoBack.key === aoBefore.key
        && (await page.evaluate(() => loadAisleOverrides().length)) === 0, JSON.stringify([aoRemoved, aoBack]));
  await aoTick(/pasta/);
  await page.waitForTimeout(200);

  // The review's aisle pick.
  await page.evaluate(() => {
    loadRecipes().push({ id: 'ao-jack', title: 'Aisle Jackfruit Curry', source: 'Blue Door Bakery', sourceUrl: '', servings: 4,
      tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-05',
      syntax: 'TITLE: Aisle Jackfruit Curry\nSOURCE: Blue Door Bakery\nSERVINGS: 4\n\nGROUP a:\n400 g jackfruit\n\nSTAGE:\nMERGE a -> done: Simmer [20 min]' });
  });
  await page.click('#openAddBtn');
  await page.waitForTimeout(300);
  await rvPaste(anText('Aisle Pick', 'Blue Door Bakery', ['300 g smoked mackerel', '300 g young jackfruit', '175 g mangetout']));
  const aoRows = () => page.evaluate(() => [...document.querySelectorAll('#reviewList .rv-row')].map(r => ({ text: r.textContent.replace(/\s+/g, ' ').trim(),
    select: !!r.querySelector('select[data-rv-aisle]'), undo: !!r.querySelector('[data-rv="aisle-undo"]') })));
  const aoRowOf = (rows, n) => rows.find(r => r.text.startsWith(n)) || {};
  const aoR0 = await aoRows();
  check('the review offers an aisle on a new name that lands in Other, and not on one with a "Same as" pending or one already placed',
        aoRowOf(aoR0, 'Smoked mackerel').select === true && aoRowOf(aoR0, 'Young jackfruit').select === false && aoRowOf(aoR0, 'Mangetout').select === false,
        JSON.stringify(aoR0));
  const aoMark3 = await anMark();
  await page.selectOption('#reviewList select[data-rv-aisle="smoked mackerel"]', 'Meat & Fish');
  await page.waitForTimeout(300);
  const aoPicked = await aoWrites(aoMark3);
  const aoR1 = await aoRows();
  check('    picking one writes that aisle at once, and the row says "Moved to Meat & Fish" with UNDO',
        aoPicked.length === 1 && aoPicked[0].op === 'upsert' && aoPicked[0].rows[0].name === 'smoked mackerel' && aoPicked[0].rows[0].aisle === 'Meat & Fish'
        && /lands under Meat & Fish/.test(aoRowOf(aoR1, 'Smoked mackerel').text) && /Moved to Meat & Fish/.test(aoRowOf(aoR1, 'Smoked mackerel').text)
        && aoRowOf(aoR1, 'Smoked mackerel').undo && !aoRowOf(aoR1, 'Smoked mackerel').select, JSON.stringify([aoPicked, aoR1]));
  const aoMark4 = await anMark();
  await anClick('[data-rv="aisle-undo"]');
  await page.waitForTimeout(300);
  const aoUndone = await aoWrites(aoMark4);
  const aoR2 = await aoRows();
  check('    UNDO deletes it, and the row is back in Other with its aisle pick',
        aoUndone.length === 1 && aoUndone[0].op === 'delete' && aoUndone[0].eqs === 'household_id=H&name=smoked mackerel' && /lands under Other/.test(aoRowOf(aoR2, 'Smoked mackerel').text)
        && aoRowOf(aoR2, 'Smoked mackerel').select && !aoRowOf(aoR2, 'Smoked mackerel').undo && (await page.evaluate(() => loadAisleOverrides().length)) === 0,
        JSON.stringify([aoUndone, aoR2]));

  /* Merged before its migration: the table does not exist yet. The load must not throw (a throw in
     hydrate signs the household out), and nothing may offer a write that would fail. */
  const aoSignouts = await page.evaluate(() => window.__SIGNOUTS__);
  const aoMissing = await page.evaluate(async () => { window.__MISSING_TABLES__ = ['aisle_overrides'];
    try { const ok = await hydrate(); return { ok, available: aisleOverridesAvailable, n: loadAisleOverrides().length }; }
    catch(e){ return { threw: String(e && e.message || e) }; } });
  await page.evaluate(() => { renderAisleOverridesList(); });
  const aoMissingUi = await page.evaluate(() => ({ note: getComputedStyle(document.getElementById('aisleOverridesUnavailable')).display !== 'none',
    form: getComputedStyle(document.getElementById('aisleOverrideForm')).display !== 'none' }));
  await rvPaste(anText('Aisle Missing', 'Blue Door Bakery', ['300 g smoked mackerel']));
  const aoMissingRows = await aoRows();
  const aoMissingExport = await page.evaluate(() => { let payload = null; const real = window.Blob;
    window.Blob = function(parts){ payload = JSON.parse(parts[0]); return new real(parts); };
    try { exportAllData(); } catch(e){} window.Blob = real; return payload ? ('aisleOverrides' in payload) : 'no export'; });
  check('with the table not created yet, the load carries on without aisles and signs nobody out',
        aoMissing.ok === true && aoMissing.available === false && aoMissing.n === 0 && (await page.evaluate(() => window.__SIGNOUTS__)) === aoSignouts,
        JSON.stringify(aoMissing));
  check('    and nothing offers a write that would fail: Settings says why, with no form, the review has no aisle pick, and export leaves the key out',
        aoMissingUi.note && !aoMissingUi.form && aoRowOf(aoMissingRows, 'Smoked mackerel').text && !aoRowOf(aoMissingRows, 'Smoked mackerel').select && aoMissingExport === false,
        JSON.stringify([aoMissingUi, aoMissingRows, aoMissingExport]));
  await page.evaluate(async () => { window.__MISSING_TABLES__ = []; await hydrate(); renderAisleOverridesList(); });
  check('    and once the table exists the next load finds it again',
        await page.evaluate(() => aisleOverridesAvailable === true), '');
  await page.evaluate(() => { closeAddModal(); });
  await page.waitForTimeout(200);

  /* ---- Settings: ingredient lookup and dictionary (PR 7 of the add-recipe plan, 29 Sep 2026) ----
     Read-only: what the list calls a wording, where it goes and why, the word matches and swaps
     touching it, and the dictionary filtered by the same box. The one write is FORGET, the same
     removal as Word Matches. Invented names; what the block adds is taken out again. */
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const lkAliasesBefore = await page.evaluate(() => JSON.stringify(cache.aliases));
  const lkLook = async text => { await page.fill('#ingredientLookup', text); await page.waitForTimeout(80);
    return page.evaluate(() => Object.fromEntries(['name', 'aisle', 'match', 'swap'].map(k =>
      [k, [...document.querySelectorAll(`#ingredientLookupOut [data-lookup="${k}"]`)].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ')]))); };
  const lkKnown = await lkLook('almond flour');
  check('the lookup names the dictionary row for a known wording, and its aisle from the dictionary',
        /The list calls it: ground almonds$/.test(lkKnown.name) && /Aisle: Pantry, from the dictionary/.test(lkKnown.aisle), JSON.stringify(lkKnown));
  const lkOwn = await lkLook('Bulb fennel');
  check('    says "your own wording" for a name the dictionary does not know',
        /The list calls it: bulb fennel, your own wording/.test(lkOwn.name), JSON.stringify(lkOwn));
  const lkOther = await lkLook('smoked mackerel');
  const lkKeyword = await lkLook('lamb shanks');
  await page.evaluate(() => { addAisleOverride('smoked mackerel', 'Meat & Fish'); });
  const lkOverride = await lkLook('smoked mackerel');
  await page.evaluate(() => { const o = loadAisleOverrides().find(x => x.name === 'smoked mackerel'); if(o) removeAisleOverride(o.id); renderAisleOverridesList(); });
  check('    says Other and points at the aisle block, and names a keyword rule or the household\'s own aisle',
        /Aisle: Other\. Nothing places it; set an aisle in Shopping Aisles below/.test(lkOther.aisle) && /Aisle: Meat & Fish, from a keyword rule/.test(lkKeyword.aisle)
        && /Aisle: Meat & Fish, your own aisle/.test(lkOverride.aisle), JSON.stringify([lkOther, lkKeyword, lkOverride]));
  await page.evaluate(() => { cache.aliases = cache.aliases.concat([{ id: 'lk-alias', kind: 'ingredient', alias: 'young jackfruit', canonical: 'jackfruit' }]); rebuildAliasMaps(); });
  const lkMatchNew = await lkLook('young jackfruit');
  const lkMatchOld = await lkLook('Jackfruit');
  check('    lists a word match touching the name, from either side, with FORGET',
        /Word match: “young jackfruit” means “jackfruit” FORGET/.test(lkMatchNew.match) && /Word match: “young jackfruit” means “jackfruit”/.test(lkMatchOld.match)
        && /The list calls it: jackfruit/.test(lkMatchNew.name) && /Word matches: none/.test(lkOther.match), JSON.stringify([lkMatchNew, lkMatchOld]));
  const lkForgetMark = await anMark();
  await page.evaluate(() => { window.__lkConfirm = window.confirm; window.confirm = () => true; });
  await anClick('[data-lookup-forget="lk-alias"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.confirm = window.__lkConfirm; });
  const lkForgot = await page.evaluate(m => ({ writes: window.__WRITES__.slice(m).map(w => w.table + ':' + w.op), left: cache.aliases.some(a => a.id === 'lk-alias'),
    match: document.querySelector('#ingredientLookupOut [data-lookup="match"]').textContent.trim() }), lkForgetMark);
  check('    and FORGET there is the Word Matches removal: one delete, and the lookup redraws',
        lkForgot.writes.join() === 'aliases:delete' && !lkForgot.left && /Word matches: none/.test(lkForgot.match), JSON.stringify(lkForgot));
  await page.evaluate(() => { cache.swaps = cache.swaps.concat([{ id: 'lk-swap', original: 'butter', replacement: 'margarine', ratio: '1', notes: '' }]); });
  const lkSwap = await lkLook('butter');
  const lkPeanut = await lkLook('peanut butter');
  check('    lists a swap for the name, by the list\'s own name, so butter\'s swap is not peanut butter\'s',
        /Swap: butter → margarine \(1 : 1\)/.test(lkSwap.swap) && /EDIT/.test(lkSwap.swap) && /Swaps: none/.test(lkPeanut.swap), JSON.stringify([lkSwap, lkPeanut]));
  await page.fill('#ingredientLookup', 'butter');
  await page.waitForTimeout(80);
  await anClick('[data-lookup-swaps]');
  await page.waitForTimeout(300);
  const lkSwapsView = await page.evaluate(() => ({ view: state.view, swapsShown: !document.getElementById('swapsBlock').hidden && document.getElementById('swapsBlock').offsetParent !== null,
    subtitle: document.getElementById('swapsSubtitle').textContent.replace(/\s+/g, ' ').trim() }));
  check('    EDIT goes to Swaps, whose subtitle now says how a swap is matched',
        lkSwapsView.view === 'settings' && lkSwapsView.swapsShown && /applies wherever the shopping list would call an ingredient by the swap's name, so "butter" never catches "peanut butter"/.test(lkSwapsView.subtitle)
        && !/fuzzy/.test(lkSwapsView.subtitle), JSON.stringify(lkSwapsView));
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const lkDict = async text => { await page.fill('#ingredientLookup', text); await page.waitForTimeout(80);
    return page.evaluate(() => [...document.querySelectorAll('#dictionaryList .dict-row .source-row-name')].map(e => e.textContent.trim())); };
  const lkDictAll = await lkDict('');
  const lkDictMeal = await lkDict('almond meal');
  const lkDictNone = await lkDict('zzqx');
  check('the dictionary list shows every row, and filters as typed by name or wording',
        lkDictAll.length === (await page.evaluate(() => INGREDIENT_DICTIONARY.length)) && lkDictMeal.join('|') === 'ground almonds' && lkDictNone.length === 0
        && /No row in the dictionary has that wording/.test(await page.textContent('#dictionaryList')), JSON.stringify([lkDictAll.length, lkDictMeal, lkDictNone]));
  await page.fill('#ingredientLookup', '');
  await page.evaluate(b => { cache.aliases = JSON.parse(b); rebuildAliasMaps(); cache.swaps = cache.swaps.filter(x => x.id !== 'lk-swap'); renderSettings(); }, lkAliasesBefore);

  /* ---- Autocomplete on the ingredient boxes (asked for 30 Sep 2026) ----
     The app's own dropdown under each box, since the tablet drew the native datalist of PR #55 as a
     full-screen menu. What the page can check, it does: which names, in what order, the cap, when it opens
     and closes, and what a pick does. How it feels on the tablet is TEST-PLAN step 36j. Invented names;
     the match added is taken out again. */
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const acBoxes = ['ingredientLookup', 'alias-from', 'alias-to', 'aisleOverride-name', 'swap-original', 'swap-replacement'];
  const acType = async (id, text) => { await page.fill('#' + id, text); await page.waitForTimeout(60); };
  const acList = id => page.evaluate(i => { const l = document.getElementById(i + '-suggest');
    return { shown: !!l && l.style.display !== 'none', items: l ? [...l.querySelectorAll('[data-suggest-value]')].map(e => e.dataset.suggestValue) : [] }; }, id);
  const acWiring = await page.evaluate(ids => ids.map(id => { const i = document.getElementById(id), l = document.getElementById(id + '-suggest');
    return id + ':' + (i.getAttribute('list') || '-') + ':' + (l && l.previousElementSibling === i ? 'list' : 'none'); }), acBoxes);
  const acDatalists = await page.evaluate(() => document.querySelectorAll('#ingredientVocab, #libraryIngredientVocab').length);
  check('autocomplete: all six ingredient boxes have the app\'s own list under them, and none a native datalist',
        acWiring.every(w => /:-:list$/.test(w)) && acDatalists === 0, JSON.stringify([acWiring, acDatalists]));
  await page.focus('#ingredientLookup');
  await page.waitForTimeout(60);
  const acEmpty = await acList('ingredientLookup');
  await acType('ingredientLookup', 'alm');
  const acAlm = await acList('ingredientLookup');
  const acExpect = await page.evaluate(() => {
    const library = Array.from(new Set(allLibraryIngredientNames().map(it => it.name.toLowerCase())));
    const dictionaryOnly = INGREDIENT_DICTIONARY.flatMap(r => dictionaryPhrases(r).live).map(p => p.toLowerCase()).filter(p => !library.includes(p));
    return { library, dictionaryOnly };
  });
  const acStarts = acAlm.items.filter(n => n.startsWith('alm'));
  await acType('ingredientLookup', 'on');
  const acOn = await acList('ingredientLookup');
  check('    nothing opens on an empty box; typing opens the names containing it, those starting with it first, each once and in lower case',
        !acEmpty.shown && acAlm.shown && acAlm.items.includes('almond meal') && acAlm.items.includes('ground almonds')
        && acAlm.items.every(n => n.includes('alm') && n === n.toLowerCase()) && new Set(acAlm.items).size === acAlm.items.length
        && acAlm.items.slice(0, acStarts.length).every(n => n.startsWith('alm')) && acAlm.items.indexOf('ground almonds') >= acStarts.length
        && acOn.items[0].startsWith('on') && acOn.items.some(n => !n.startsWith('on') && n.localeCompare(acOn.items[0]) < 0),
        JSON.stringify([acEmpty.shown, acAlm.items.slice(0, 8), acOn.items.slice(0, 4)]));
  await acType('ingredientLookup', 'a');
  const acCap = await page.evaluate(() => { const l = document.getElementById('ingredientLookup-suggest'), i = document.getElementById('ingredientLookup');
    const lr = l.getBoundingClientRect(), ir = i.getBoundingClientRect(), cs = getComputedStyle(l);
    return { items: l.querySelectorAll('[data-suggest-value]').length, height: Math.round(lr.height), overflow: cs.overflowY, scrolls: l.scrollHeight > l.clientHeight,
      below: Math.round(lr.top - ir.bottom), left: Math.round(lr.left - ir.left), width: Math.round(lr.width - ir.width) }; });
  check('    a long list is capped at about five rows and scrolls inside itself, just under the box and as wide as it',
        acCap.items > 10 && acCap.height <= 192 && acCap.overflow === 'auto' && acCap.scrolls && acCap.below >= 0 && acCap.below <= 8 && acCap.left === 0 && acCap.width === 0,
        JSON.stringify(acCap));
  /* "salt", which "sea salt" also contains: the list must not open again on the name just picked. */
  await acType('ingredientLookup', 'sal');
  await page.evaluate(() => { const it = document.querySelector('#ingredientLookup-suggest [data-suggest-value="salt"]');
    it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
  await page.waitForTimeout(80);
  const acPicked = await page.evaluate(() => ({ value: document.getElementById('ingredientLookup').value, focused: document.activeElement.id,
    shown: document.getElementById('ingredientLookup-suggest').style.display !== 'none',
    name: (document.querySelector('#ingredientLookupOut [data-lookup="name"]') || {}).textContent || '' }));
  check('    a tap on a name fills the box, closes the list, keeps the box focused, and the lookup answers for it',
        acPicked.value === 'salt' && !acPicked.shown && acPicked.focused === 'ingredientLookup' && /The list calls it: salt$/.test(acPicked.name.trim()),
        JSON.stringify(acPicked));
  /* A phone: the box just above where the keyboard starts. The list opens above the box, not behind the keyboard. */
  await page.setViewportSize({ width: 412, height: 560 });
  await page.evaluate(() => document.getElementById('ingredientLookup').scrollIntoView({ block: 'end' }));
  await acType('ingredientLookup', 'a');
  const acFlip = await page.evaluate(() => { const l = document.getElementById('ingredientLookup-suggest').getBoundingClientRect(),
    i = document.getElementById('ingredientLookup').getBoundingClientRect(); return { listBottom: Math.round(l.bottom), listTop: Math.round(l.top), boxTop: Math.round(i.top), height: innerHeight }; });
  await acType('ingredientLookup', '');
  await page.evaluate(() => document.getElementById('ingredientLookup').scrollIntoView({ block: 'start' }));
  await acType('ingredientLookup', 'a');
  const acNoFlip = await page.evaluate(() => Math.round(document.getElementById('ingredientLookup-suggest').getBoundingClientRect().top
    - document.getElementById('ingredientLookup').getBoundingClientRect().bottom));
  await page.click('[data-settings-tab-btn="library"]');  // LIBRARY CHECK is on the Library tab since 30 Sep: a hidden box has no width to measure
  const acCheckbox = await page.evaluate(() => Math.round(document.getElementById('libraryCheckOnly').getBoundingClientRect().width));
  await page.click('[data-settings-tab-btn="ingredients"]');
  await acType('ingredientLookup', '');
  await page.setViewportSize({ width: 1280, height: 800 });
  check('    on a phone, a box near the foot of the screen opens its list above it, and one with room below still opens below; the LIBRARY CHECK tick box keeps its size',
        acFlip.listBottom <= acFlip.boxTop && acFlip.listTop >= 0 && acNoFlip >= 0 && acNoFlip <= 8 && acCheckbox > 5 && acCheckbox < 30, JSON.stringify([acFlip, acNoFlip, acCheckbox]));
  await acType('ingredientLookup', 'almond meal');
  const acExact = await acList('ingredientLookup');
  await acType('ingredientLookup', 'alm');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  const acKeys = await page.evaluate(() => document.getElementById('ingredientLookup').value);
  await acType('ingredientLookup', 'alm');
  await page.keyboard.press('Escape');
  const acEsc = await acList('ingredientLookup');
  await acType('ingredientLookup', 'alm');
  const acBefore = await acList('ingredientLookup');
  await page.focus('#aisleOverride-name');
  const acBlur = await (async () => { await page.waitForTimeout(250); return acList('ingredientLookup'); })();
  check('    it closes when the only name left is the one typed; the arrow keys and Enter pick; Escape and leaving the box close it',
        !acExact.shown && acKeys === acAlm.items[1] && !acEsc.shown && acBefore.shown && !acBlur.shown, JSON.stringify([acExact, acKeys, acAlm.items[1], acEsc.shown, acBefore.shown, acBlur.shown]));
  const acLibOnly = acExpect.dictionaryOnly.find(p => /^[a-z]/.test(p));
  const acLibName = acExpect.library[0];
  await acType('aisleOverride-name', acLibName.slice(0, 3));
  const acAisleLib = await acList('aisleOverride-name');
  await acType('aisleOverride-name', acLibOnly.slice(0, 4));
  const acAisleDict = await acList('aisleOverride-name');
  await acType('aisleOverride-name', '');
  check('    the aisle box offers the library\'s names only, never a dictionary wording no recipe uses',
        acAisleLib.items.includes(acLibName) && acAisleLib.items.every(n => acExpect.library.includes(n)) && !acAisleDict.items.includes(acLibOnly)
        && acAisleDict.items.every(n => acExpect.library.includes(n)), JSON.stringify([acLibName, acAisleLib.items, acLibOnly, acAisleDict.items]));
  await acType('alias-from', 'alm');
  const acAliasIng = await acList('alias-from');
  await page.selectOption('#alias-kind', 'source');
  const acKindClosed = await acList('alias-from');
  await acType('alias-to', 'test k');
  const acAliasSrc = await acList('alias-to');
  await page.selectOption('#alias-kind', 'ingredient');
  await acType('alias-to', 'alm');
  const acAliasBack = await acList('alias-to');
  await acType('alias-from', ''); await acType('alias-to', '');
  check('    Word Matches offers ingredients, the sources in use when SOURCE is picked (closing any open list), and ingredients again after',
        acAliasIng.items.includes('almond meal') && !acKindClosed.shown && acAliasSrc.items.join('|') === 'Test Kitchen' && acAliasBack.items.includes('almond meal'),
        JSON.stringify([acAliasIng.items.length, acKindClosed.shown, acAliasSrc.items, acAliasBack.items.length]));
  const acAliasesBefore = await page.evaluate(() => JSON.stringify(cache.aliases));
  await page.fill('#alias-from', 'Sea Purslane');
  await page.fill('#alias-to', 'marsh samphire');
  await page.click('#aliasAddBtn');
  await page.waitForTimeout(200);
  await page.focus('#aisleOverride-name');
  await acType('ingredientLookup', 'purs');
  const acAdded = await acList('ingredientLookup');
  await page.evaluate(b => { cache.aliases = JSON.parse(b); rebuildAliasMaps(); renderSettings(); }, acAliasesBefore);
  await page.focus('#aisleOverride-name');
  await acType('ingredientLookup', 'purs');
  const acGone = await acList('ingredientLookup');
  await acType('ingredientLookup', '');
  check('    a word match added in Settings is offered the next time a box is used, and gone once forgotten',
        acAdded.items.includes('sea purslane') && !acGone.items.includes('sea purslane'), JSON.stringify([acAdded.items, acGone.items]));
  await page.evaluate(() => showView('swaps'));  // Swaps is a section of Settings since 30 Sep
  await page.waitForTimeout(300);
  await acType('swap-original', 'alm');
  const acSwapA = await acList('swap-original');
  await acType('swap-replacement', 'alm');
  const acSwapB = await acList('swap-replacement');
  await acType('swap-original', ''); await acType('swap-replacement', '');
  check('    both Swaps boxes offer the lookup\'s names',
        acSwapA.shown && acSwapA.items.join('|') === acAlm.items.join('|') && acSwapB.items.join('|') === acAlm.items.join('|'),
        JSON.stringify([acSwapA.items.length, acSwapB.items.length, acAlm.items.length]));

  /* ---- Layout, 30 Sep 2026 (docs/PLAN-LAYOUT.md, C and A) ----
     C: a step's words at the foot of its box, on screen and in print. A: the add/edit dialog near full width,
     with a recipe box half the screen tall; a phone still gets the whole width. Read-only. */
  const lyRecipe = await page.evaluate(() => loadRecipes().find(r => r.title === 'Test Pasta').id);
  await page.evaluate(id => openRecipe(id), lyRecipe);
  await page.waitForTimeout(400);
  const lyAlign = () => page.evaluate(() => { const cells = [...document.querySelectorAll('#flowMount .box-cell')];
    const tall = cells.map(c => { const r = c.getBoundingClientRect(), t = [...c.childNodes].map(n => { const rg = document.createRange(); rg.selectNodeContents(n); return rg.getBoundingClientRect(); })
      .filter(b => b.height > 0); const bottom = Math.max(...t.map(b => b.bottom)), top = Math.min(...t.map(b => b.top));
      return { h: Math.round(r.height), gapTop: Math.round(top - r.top), gapBottom: Math.round(r.bottom - bottom) }; }).filter(x => x.h > 120);
    return { n: cells.length, valign: [...new Set(cells.map(c => getComputedStyle(c).verticalAlign))], tall }; });
  const lyScreen = await lyAlign();
  await page.emulateMedia({ media: 'print' });
  const lyPrint = await page.evaluate(() => [...new Set([...document.querySelectorAll('#flowMount .box-cell')].map(c => getComputedStyle(c).verticalAlign))]);
  await page.emulateMedia({ media: 'screen' });
  check('layout: a step\'s words sit at the foot of its box, level with the last ingredient into it, on screen and in print',
        lyScreen.n > 0 && lyScreen.valign.join() === 'bottom' && lyScreen.tall.length > 0 && lyScreen.tall.every(x => x.gapBottom < x.gapTop) && lyPrint.join() === 'bottom',
        JSON.stringify([lyScreen, lyPrint]));
  await page.click('#editRecipeBtn');
  await page.waitForTimeout(400);
  const lyDialog = () => page.evaluate(() => { const p = document.querySelector('#addModalOverlay .modal-panel').getBoundingClientRect();
    return { w: Math.round(p.width), vw: innerWidth, vh: innerHeight, box: Math.round(document.getElementById('importInput').getBoundingClientRect().height) }; });
  const lyWide = await lyDialog();
  await page.setViewportSize({ width: 412, height: 800 });
  const lyPhone = await lyDialog();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => closeAddModal());
  check('    the edit dialog fills the screen less its margin (was 780px), its recipe box half the screen tall; a phone still gets the whole width',
        lyWide.w >= lyWide.vw - 40 && lyWide.w > 780 && lyWide.box >= Math.floor(lyWide.vh / 2) && lyPhone.w >= lyPhone.vw - 40 && lyPhone.box >= 400,
        JSON.stringify([lyWide, lyPhone]));

  /* ---- Layout D, 30 Sep 2026 (docs/PLAN-LAYOUT.md): Shopping Aisles says where a name goes now ----
     The lookup's own answer under the box, the aisle picker set to it, ADD greyed out until another aisle is
     picked, and REMOVE on the household's own aisle. Invented names; the aisle set is taken out again. */
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const adNow = () => page.evaluate(() => { const n = document.getElementById('aisleOverrideNow');
    return { shown: n.style.display !== 'none', text: n.textContent.replace(/\s+/g, ' ').trim(), aisle: document.getElementById('aisleOverride-aisle').value,
      addOff: document.getElementById('aisleOverrideAddBtn').disabled }; });
  const adType = async t => { await page.fill('#aisleOverride-name', t); await page.waitForTimeout(80); await page.keyboard.press('Escape'); return adNow(); };
  const adEmpty = await adType('');
  const adDict = await adType('chopped tomatoes');
  await page.selectOption('#aisleOverride-aisle', 'Produce');
  const adMoved = await adNow();
  check('layout D: Shopping Aisles says where a name goes now and why, sets the picker to it, and greys ADD out until another aisle is picked',
        !adEmpty.shown && adDict.shown && /calls it chopped tomatoes and puts it in Pantry, from the dictionary/.test(adDict.text) && !/No recipe uses/.test(adDict.text)
        && adDict.aisle === 'Pantry' && adDict.addOff && !adMoved.addOff, JSON.stringify([adEmpty, adDict, adMoved]));
  const adOther = await adType('Smoked Eel');
  check('    a name nothing places says Other, leaves the picker empty with ADD usable, and says no recipe uses it',
        /calls it smoked eel and puts it in Other: nothing places it/.test(adOther.text) && /No recipe uses this name yet/.test(adOther.text) && adOther.aisle === '' && !adOther.addOff,
        JSON.stringify(adOther));
  await page.evaluate(() => { addAisleOverride('chopped tomatoes', 'Produce'); renderAisleOverridesList(); });
  const adOwn = await adType('chopped tomatoes');
  const adMark = await anMark();
  await anClick('#aisleOverrideNow [data-now-remove]');
  await page.waitForTimeout(300);
  const adAfter = await adNow();
  const adWrites = (await anSince(adMark)).map(w => w.table + ':' + w.op).join();
  check('    one of your own aisles says so, with REMOVE there: one delete, and it goes back to the dictionary\'s aisle',
        /puts it in Produce, your own aisle\. REMOVE puts it back in Pantry, from the dictionary/.test(adOwn.text) && adOwn.aisle === 'Produce' && adOwn.addOff
        && adWrites === 'aisle_overrides:delete' && /puts it in Pantry, from the dictionary/.test(adAfter.text) && adAfter.aisle === 'Pantry'
        && (await page.evaluate(() => loadAisleOverrides().length)) === 0, JSON.stringify([adOwn, adWrites, adAfter]));
  await adType('');

  /* ---- Layout B, 30 Sep 2026 (docs/PLAN-LAYOUT.md): cooking mode ----
     KEEP AWAKE hides what is not used while cooking, and hides the timeline until SHOW TIMELINE, which the
     device remembers. The state is set directly, as the keep-awake block above does (no wake lock headless).
     Everything is put back at the end: KEEP AWAKE off, the stored choice removed. */
  await page.evaluate(() => { try { localStorage.removeItem('kitchen.cookingTimeline'); } catch(e){} });
  const ckRecipe = await page.evaluate(() => loadRecipes().find(r => r.title === 'Test Pasta').id);
  await page.evaluate(id => openRecipe(id), ckRecipe);
  await page.waitForTimeout(400);
  const ckHidden = ['#viewerProvenance', '#favouriteBtn', '#shortlistBtn', '#editRecipeBtn', '#exportPngBtn', '#printBtn', '#deleteBtn', '#view-viewer .viewer-scale-row',
    '#groupExportPngBtn', '#groupPrintBtn', '#groupUngroupBtn'];
  const ckKept = ['#backToRecipes', '#viewerMeta', '#view-viewer .keep-awake-toggle', '#resetTicksBtn', '#flowMount table'];
  const ckState = () => page.evaluate(([hid, kept]) => { const shown = sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'
      && (!e.closest('#view-viewer') || e.offsetParent !== null || getComputedStyle(e).position === 'fixed'); };
    const btn = document.querySelector('#view-viewer .cook-timeline-btn');
    return { hidden: hid.filter(sel => { const e = document.querySelector(sel); return e && getComputedStyle(e).display === 'none'; }),
      kept: kept.filter(shown), timeline: shown('#view-viewer .timeline-strip'), btn: btn && getComputedStyle(btn).display !== 'none' ? btn.textContent.trim() : '',
      sticky: getComputedStyle(document.querySelector('#view-viewer .viewer-head')).position }; }, [ckHidden, ckKept]);
  const ckOff = await ckState();
  await page.evaluate(() => { state.keepAwake = true; updateKeepAwakeStatus(); });
  await page.waitForTimeout(200);
  const ckOn = await ckState();
  check('layout B: KEEP AWAKE is cooking mode: favourite, shortlist, edit, export, print, delete, the source chip, COOK FOR and the Group Viewer\'s export, print and ungroup hidden',
        ckOff.hidden.filter(x => x !== '#viewerProvenance').length === 0 && ckOn.hidden.length === ckHidden.length, JSON.stringify([ckOff.hidden, ckOn.hidden]));
  check('    the recipe\'s details, KEEP AWAKE, RESET TICKS and the grid stay, with the header pinned; the timeline is hidden with SHOW TIMELINE offered',
        ckOn.kept.length === ckKept.length && ckOn.sticky === 'sticky' && !ckOn.timeline && ckOn.btn === 'SHOW TIMELINE'
        && ckOff.timeline && ckOff.btn === '' && ckOff.sticky !== 'sticky', JSON.stringify([ckOff, ckOn]));
  await page.click('#view-viewer .cook-timeline-btn');
  await page.waitForTimeout(150);
  const ckShown = await ckState();
  const ckStored = await page.evaluate(() => localStorage.getItem('kitchen.cookingTimeline'));
  await page.evaluate(() => { state.keepAwake = false; updateKeepAwakeStatus(); state.keepAwake = true; updateKeepAwakeStatus(); });
  const ckAgain = await ckState();
  await page.click('#view-viewer .cook-timeline-btn');
  await page.waitForTimeout(150);
  const ckHiddenAgain = await ckState();
  check('    SHOW TIMELINE shows it and is remembered on the device, next time too; HIDE TIMELINE hides it again',
        ckShown.timeline && ckShown.btn === 'HIDE TIMELINE' && ckStored === 'show' && ckAgain.timeline && ckAgain.btn === 'HIDE TIMELINE'
        && !ckHiddenAgain.timeline && ckHiddenAgain.btn === 'SHOW TIMELINE', JSON.stringify([ckShown, ckStored, ckAgain, ckHiddenAgain]));
  await page.evaluate(() => { state.keepAwake = false; updateKeepAwakeStatus(); });
  await page.waitForTimeout(150);
  const ckBack = await ckState();
  check('    and turning KEEP AWAKE off brings every one of them back',
        JSON.stringify(ckBack) === JSON.stringify(ckOff), JSON.stringify([ckOff, ckBack]));
  await page.evaluate(() => { try { localStorage.removeItem('kitchen.cookingTimeline'); } catch(e){} applyCookTimeline(); });

  /* ---- Layout E, 30 Sep 2026 (docs/PLAN-LAYOUT.md): Settings in three tabs, with Swaps ----
     Every section drawn as before and only shown or hidden. Invented swap, taken out again. */
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const stShown = () => page.evaluate(() => [...document.querySelectorAll('#view-settings .settings-block')].filter(b => !b.hidden && b.offsetParent !== null)
    .map(b => b.querySelector('.side-label').textContent.trim()));
  const stIng = await stShown();
  const stNav = await page.evaluate(() => [...document.querySelectorAll('.navlink[data-view]')].map(b => b.dataset.view));
  await page.click('[data-settings-tab-btn="library"]');
  const stLib = await stShown();
  await page.click('[data-settings-tab-btn="app"]');
  const stApp = await stShown();
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(200);
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const stKept = await stShown();
  await page.click('[data-settings-tab-btn="ingredients"]');
  check('layout E: Settings has three tabs; Ingredients holds the lookup, word matches, aisles, swaps and dictionary, and SWAPS has left the sidebar',
        stIng.join('|') === 'INGREDIENT LOOKUP|WORD MATCHES|SHOPPING AISLES|SWAPS|DICTIONARY' && !stNav.includes('swaps') && stNav.includes('settings'),
        JSON.stringify([stIng, stNav]));
  check('    Library holds the library check, sources, keywords and photos; App the week start and appearance; the last tab is remembered',
        stLib.join('|') === 'LIBRARY CHECK|SOURCES|KEYWORDS|RECIPE PHOTOS' && stApp.join('|') === 'WEEK STARTS ON|APPEARANCE' && stKept.join('|') === stApp.join('|'),
        JSON.stringify([stLib, stApp, stKept]));
  const stDict = () => page.evaluate(() => ({ list: !document.getElementById('dictionaryList').hidden, btn: document.getElementById('dictionaryToggle').hidden ? '' : document.getElementById('dictionaryToggle').textContent.trim(),
    rows: [...document.querySelectorAll('#dictionaryList .dict-row')].filter(r => r.offsetParent !== null).length }));
  const stFolded = await stDict();
  await page.fill('#ingredientLookup', 'almond meal');
  await page.waitForTimeout(80);
  const stTyped = await stDict();
  await page.fill('#ingredientLookup', '');
  await page.waitForTimeout(80);
  const stRefolded = await stDict();
  await page.click('#dictionaryToggle');
  const stOpen = await stDict();
  await page.click('#dictionaryToggle');
  const stClosed = await stDict();
  const stCount = await page.evaluate(() => INGREDIENT_DICTIONARY.length);
  check('    the dictionary is folded to SHOW ALL; typing in the lookup opens the rows that match, and SHOW ALL opens and closes the whole of it',
        !stFolded.list && stFolded.rows === 0 && stFolded.btn === `SHOW ALL ${stCount} ROWS` && stTyped.list && stTyped.rows === 1 && stTyped.btn === ''
        && !stRefolded.list && stOpen.list && stOpen.rows === stCount && stOpen.btn === 'HIDE THE DICTIONARY' && !stClosed.list,
        JSON.stringify([stFolded, stTyped, stRefolded, stOpen, stClosed]));
  await page.click('[data-settings-tab-btn="app"]');
  await page.evaluate(() => { cache.swaps = cache.swaps.concat([{ id: 'st-swap', original: 'sea kale', replacement: 'curly kale', ratio: '1', notes: '' }]); showView('recipes'); showView('swaps'); });
  await page.waitForTimeout(200);
  const stSwapsNav = await page.evaluate(() => ({ view: state.view, shown: document.getElementById('swapsBlock').offsetParent !== null,
    tab: document.querySelector('[data-settings-tab-btn].active').dataset.settingsTabBtn, listed: /sea kale → curly kale/.test(document.getElementById('swapsList').textContent) }));
  const stSwapsBefore = await page.evaluate(() => loadSwaps().length);
  await page.fill('#swap-original', 'sea purslane');
  await page.fill('#swap-replacement', 'marsh samphire');
  await page.fill('#swap-ratio', '1');
  await page.click('#swapAddBtn');
  await page.waitForTimeout(200);
  const stSwapAdded = await page.evaluate(() => ({ n: loadSwaps().length, listed: /sea purslane → marsh samphire/.test(document.getElementById('swapsList').textContent) }));
  await page.evaluate(() => { cache.swaps = cache.swaps.filter(x => x.original !== 'sea purslane' && x.id !== 'st-swap'); renderSwaps(); });
  check('    anything that asked for the old Swaps screen lands on Settings → Ingredients → Swaps, whose form adds a swap as before',
        stSwapsNav.view === 'settings' && stSwapsNav.shown && stSwapsNav.tab === 'ingredients' && stSwapsNav.listed && stSwapAdded.n === stSwapsBefore + 1 && stSwapAdded.listed,
        JSON.stringify([stSwapsNav, stSwapsBefore, stSwapAdded]));

  /* ---- LIBRARY CHECK (PR 8 of the add-recipe plan, 29 Sep 2026) ----
     Every recipe, its standing against its source and its names in Other, those needing attention
     first; RUN writes nothing and OPEN opens the edit form. Six invented recipes, one per status,
     removed again at the end. The stored comparisons carry the hash of their own lines, so "fresh"
     and "stale" are real states, not faked ones. */
  await page.evaluate(() => {
    const mk = (id, title, lines, extra = {}) => { const syntax = ['TITLE: ' + title, 'SOURCE: Blue Door Bakery', 'SERVINGS: 4', ...(extra.header || []), '', 'GROUP a:', ...lines, '', 'STAGE:', 'MERGE a -> done: Cook [5 min]'].join('\n');
      const hash = linesHash(ingredientLinesOf(parseRecipe(syntax)));
      const check = extra.check === undefined ? null : { at: '2026-09-29T20:00:00.000Z', route: 'function', hard: extra.check, soft: 0, sourceLines: lines.length, linesHash: extra.stale ? '00000000' : hash };
      loadRecipes().push({ id, title, source: 'Blue Door Bakery', sourceUrl: extra.url === undefined ? 'https://example.test/' + id : extra.url, servings: 4,
        tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-06', syntax, sourceCheck: check }); };
    mk('lc-fresh', 'LC Fresh Soup', ['1 onion', '2 carrots'], { check: 0 });
    mk('lc-diff', 'LC Differs Stew', ['1 onion', '300 g smoked mackerel'], { check: 2 });
    mk('lc-stale', 'LC Stale Bake', ['1 onion'], { check: 0, stale: true });
    mk('lc-none', 'LC Never Compared', ['1 onion']);
    mk('lc-nolink', 'LC Family Recipe', ['1 onion'], { url: '' });
    /* Needs nothing about its source (no link) but has a name in Other, so it needs attention after all,
       and must sort above a recipe that needs nothing: only "attention first" puts it there. */
    mk('lc-nolink-other', 'LC Family Fish Pie', ['1 onion', '300 g smoked mackerel'], { url: '' });
    mk('lc-recon', 'LC Rebuilt Bars', ['1 onion'], { header: ['NOTES:', '⚠️ Source note: reconstructed from memory, the page could not be read'] });
  });
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.click('[data-settings-tab-btn="library"]');  // LIBRARY CHECK is on the Library tab since 30 Sep
  const lcMark = await anMark();
  await page.click('#libraryCheckRunBtn');
  await page.waitForTimeout(300);
  const lcRows = () => page.evaluate(() => [...document.querySelectorAll('#libraryCheckList .lc-row')].map(r => ({ id: r.dataset.lcId, status: r.dataset.lcStatus,
    text: r.textContent.replace(/\s+/g, ' ').trim(), attention: r.classList.contains('lc-attention') })));
  const lcAll = await lcRows();
  const lcOf = id => lcAll.find(r => r.id === id) || {};
  const lcRunWrites = (await anSince(lcMark)).length;
  check('LIBRARY CHECK lists every recipe once, and RUN writes nothing',
        lcAll.length === (await page.evaluate(() => loadRecipes().length)) && new Set(lcAll.map(r => r.id)).size === lcAll.length && lcRunWrites === 0,
        JSON.stringify([lcAll.length, lcRunWrites]));
  check('    a recipe with no comparison reads "not compared", one with no https link says it has none to compare, and neither is faked',
        /not compared/.test(lcOf('lc-none').text) && lcOf('lc-none').attention && /no source link to compare/.test(lcOf('lc-nolink').text) && !lcOf('lc-nolink').attention,
        JSON.stringify([lcOf('lc-none'), lcOf('lc-nolink')]));
  check('    each stored comparison reads as the viewer\'s chip would: no differences, 2 differences, compared before the ingredients changed',
        /no differences/.test(lcOf('lc-fresh').text) && !lcOf('lc-fresh').attention && /2 differences/.test(lcOf('lc-diff').text) && /compared before the ingredients changed/.test(lcOf('lc-stale').text),
        JSON.stringify([lcOf('lc-fresh'), lcOf('lc-diff'), lcOf('lc-stale')]));
  const lcOrder = lcAll.filter(r => String(r.id).startsWith('lc-')).map(r => r.id).join(',');
  check('    a reconstruction note sorts first, then not compared, changed since, differences, then a name in Other, and those needing nothing last',
        lcAll[0].id === 'lc-recon' && /reconstruction note/.test(lcAll[0].text) && lcOrder === 'lc-recon,lc-none,lc-stale,lc-diff,lc-nolink-other,lc-fresh,lc-nolink',
        lcOrder);
  check('    and the names a recipe puts in Other are listed with it',
        /in Other: Smoked mackerel/.test(lcOf('lc-diff').text) && !/in Other/.test(lcOf('lc-fresh').text), JSON.stringify([lcOf('lc-diff'), lcOf('lc-fresh')]));
  await page.check('#libraryCheckOnly');
  await page.waitForTimeout(100);
  const lcOnly = await lcRows();
  check('    "only those needing attention" hides the rest',
        lcOnly.length > 0 && lcOnly.every(r => r.attention) && !lcOnly.some(r => r.id === 'lc-fresh' || r.id === 'lc-nolink') && lcOnly.some(r => r.id === 'lc-recon'),
        JSON.stringify(lcOnly.map(r => r.id)));
  await page.uncheck('#libraryCheckOnly');
  await anClick('[data-lc-open="lc-stale"]');
  await page.waitForTimeout(400);
  const lcOpened = await page.evaluate(() => ({ editing: state.editingRecipeId, title: document.getElementById('modalTitle').textContent.trim(),
    text: document.getElementById('importInput').value.split('\n')[0] }));
  check('    OPEN opens the edit form for that recipe, and still nothing has been written',
        lcOpened.editing === 'lc-stale' && /Edit recipe/.test(lcOpened.title) && lcOpened.text === 'TITLE: LC Stale Bake' && (await anSince(lcMark)).length === 0,
        JSON.stringify(lcOpened));
  await page.evaluate(() => { closeAddModal();
    for(let i = loadRecipes().length - 1; i >= 0; i--) if(String(loadRecipes()[i].id).startsWith('lc-')) loadRecipes().splice(i, 1);
    libraryCheckResult = null; renderLibraryCheck(); showSettingsTab('ingredients'); });
  await page.waitForTimeout(200);

  await page.screenshot({ path: path.join(__dirname, 'settings.png'), fullPage: false });

  /* ---- Source photos (docs/PLAN-SOURCE-PHOTOS.md, step 2, 30 Sep 2026) ----
     The photo a recipe was converted from: shrunk in the browser, stored in a private bucket by SAVE
     (before the row), shown by a signed link, deleted by SAVE after REMOVE and with its recipe (after
     the row). Invented recipes and pictures; the stub's storage keeps what is uploaded. */
  const spPng = (w, h) => page.evaluate(([w, h]) => new Promise(res => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#c84'; x.fillRect(0, 0, w, h);
    c.toBlob(b => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(b); }, 'image/png'); }), [w, h]);
  const spPick = async (...sizes) => {
    const files = [];
    for(const [w, h] of sizes) files.push({ name: `page-${w}x${h}.png`, mimeType: 'image/png', buffer: Buffer.from(await spPng(w, h), 'base64') });
    const want = await page.evaluate(() => formPhotos.length) + files.length;
    await page.setInputFiles('#sourcePhotoInput', files);
    await page.waitForFunction(n => formPhotos.length >= n, want, { timeout: 5000 });
    await page.waitForTimeout(100);
  };
  const spStorage = mark => page.evaluate(m => window.__STORAGE__.slice(m), mark);
  const spStorageMark = () => page.evaluate(() => window.__STORAGE__.length);
  const spLogMark = () => page.evaluate(() => window.__LOG__.length);
  const spLog = mark => page.evaluate(m => window.__LOG__.slice(m).filter(l => /^(write-done:recipes|storage-done:)/.test(l)), mark);
  const spRecipeWrites = mark => page.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'recipes'), mark);
  const spThumbs = () => page.evaluate(() => [...document.querySelectorAll('#sourcePhotoList figure')].map(f => ({
    caption: f.querySelector('figcaption').textContent.replace(/\s+/g, ' ').trim(), src: (f.querySelector('img') || {}).src || '' })));
  await page.evaluate(() => {
    const mk = (id, title) => loadRecipes().push({ id, title, source: 'A family card', sourceUrl: '', servings: 4, tags: { course: '', keywords: [] },
      history: [], dateAdded: '2026-09-06', sourceCheck: null, sourcePhotos: null,
      syntax: ['TITLE: ' + title, 'SOURCE: A family card', 'SERVINGS: 4', '', 'GROUP a:', '180 g spelt flour', '60 g toasted hazelnuts', '1½ tsp caraway seeds', '',
        'STAGE:', 'MERGE a -> done: Bake [35 min]'].join('\n') });
    mk('sp-one', 'SP Hazelnut Loaf'); mk('sp-two', 'SP Plain Loaf');
    window.__STORAGE__.length = 0;
  });
  await page.evaluate(() => openEditModal('sp-one'));
  await page.waitForTimeout(300);
  const spMark0 = await anMark();
  const spSMark0 = await spStorageMark();
  const spAddState = await page.evaluate(() => ({ disabled: document.getElementById('addSourcePhotoBtn').disabled, hint: document.getElementById('sourcePhotoHint').textContent }));
  await spPick([3000, 1500], [1200, 2600]);
  const spShrunk = await page.evaluate(async () => Promise.all(formPhotos.map(async p => { const b = await createImageBitmap(p.blob); return { w: b.width, h: b.height, type: p.blob.type, path: p.path || null }; })));
  const spNewThumbs = await spThumbs();
  const spNewBand = await anBeforeSave();
  check('SOURCE PHOTOS: ADD PHOTO shrinks each picture to 2000 px on its long edge as a JPEG, shown as a NEW page, stored by nothing until SAVE',
        !spAddState.disabled && /kept privately/.test(spAddState.hint)
        && JSON.stringify(spShrunk) === JSON.stringify([{ w: 2000, h: 1000, type: 'image/jpeg', path: null }, { w: 923, h: 2000, type: 'image/jpeg', path: null }])
        && spNewThumbs.length === 2 && spNewThumbs[0].caption === 'PAGE 1 · NEW VIEW REMOVE' && /^blob:/.test(spNewThumbs[1].src)
        && spNewBand.includes('Stores 2 new source photos with the recipe') && (await anSince(spMark0)).length === 0 && (await spStorage(spSMark0)).length === 0,
        JSON.stringify([spAddState, spShrunk, spNewThumbs, spNewBand]));
  const spCompare = await page.evaluate(() => ({ lines: [...document.querySelectorAll('#sourcePhotoCompare li')].map(li => li.textContent),
    imgs: document.querySelectorAll('#sourcePhotoCompare img').length }));
  check('    and AGAINST THE SOURCE shows the recipe\'s ingredient lines beside the photos, to check by eye',
        JSON.stringify(spCompare.lines) === JSON.stringify(['180 g spelt flour', '60 g toasted hazelnuts', '1½ tsp caraway seeds']) && spCompare.imgs === 2,
        JSON.stringify(spCompare));
  const spHouse = await page.evaluate(() => HOUSEHOLD_ID);
  const spLog0 = await spLogMark();
  const spSMark1 = await spStorageMark();
  const spMark1 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const spUp = await spStorage(spSMark1);
  const spRow = ((await spRecipeWrites(spMark1)).pop() || { rows: [{}] }).rows[0];
  const spOrder = await spLog(spLog0);
  const spPaths = (spRow.source_photos || []).map(p => p.path);
  check('    SAVE uploads both to the private bucket under the household\'s folder and the recipe, then writes the row listing them in page order',
        spUp.length === 2 && spUp.every(u => u.op === 'upload' && u.bucket === 'recipe-sources' && u.contentType === 'image/jpeg' && u.upsert && u.size > 0)
        && spPaths.length === 2 && spPaths.every(p => p.startsWith(`${spHouse}/sp-one/`) && p.endsWith('.jpg')) && JSON.stringify(spPaths) === JSON.stringify(spUp.map(u => u.path))
        && spRow.source_photos.every(p => !isNaN(Date.parse(p.added))) && spOrder.join(',') === 'storage-done:upload,storage-done:upload,write-done:recipes',
        JSON.stringify([spUp, spRow.source_photos, spOrder]));
  const spChip = await page.evaluate(() => { const b = document.querySelector('#viewerProvenance [data-source-photos]'); return b ? { tag: b.tagName, text: b.textContent } : null; });
  // Shown by a signed link once this tab's own copies are gone, as on another device.
  const spSMark2 = await spStorageMark();
  await page.evaluate(() => localPhotoUrls.clear());
  await anClick('#viewerProvenance [data-source-photos]');
  await page.waitForTimeout(300);
  const spViewer = await page.evaluate(() => ({ open: document.getElementById('sourcePhotoOverlay').classList.contains('open'),
    title: document.getElementById('sourcePhotoTitle').textContent, pages: [...document.querySelectorAll('#sourcePhotoBody figure')].map(f => ({
      src: (f.querySelector('img') || {}).src || '', link: (f.querySelector('[data-photo-open]') || {}).href || '', caption: f.querySelector('figcaption').textContent })) }));
  const spSigned = await spStorage(spSMark2);
  check('    the viewer then shows a SOURCE PHOTOS · 2 chip, which opens both pages full screen by links signed for an hour',
        spChip && spChip.tag === 'BUTTON' && spChip.text === 'SOURCE PHOTOS · 2' && spViewer.open && /SP Hazelnut Loaf · SOURCE PHOTOS · 2/.test(spViewer.title)
        && spViewer.pages.length === 2 && spViewer.pages.every(p => /^blob:/.test(p.src) && p.link === p.src) && /^PAGE 1 OF 2 · ADDED /.test(spViewer.pages[0].caption)
        && spSigned.length === 2 && spSigned.every(s => s.op === 'sign' && s.bucket === 'recipe-sources' && s.expiresIn === 3600) && JSON.stringify(spSigned.map(s => s.path)) === JSON.stringify(spPaths),
        JSON.stringify([spChip, spViewer, spSigned]));
  await page.click('#sourcePhotoBody .source-photo-full');
  const spZoom = await page.evaluate(() => document.querySelector('#sourcePhotoBody .source-photo-full').classList.contains('zoomed'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const spEsc = await page.evaluate(() => ({ open: document.getElementById('sourcePhotoOverlay').classList.contains('open'), view: state.view }));
  check('    a tap zooms a page to its own size, and Escape shuts the photos without leaving the recipe',
        spZoom && !spEsc.open && spEsc.view === 'viewer', JSON.stringify([spZoom, spEsc]));
  // REMOVE, then SAVE: the row first, then the file.
  await page.evaluate(() => openEditModal('sp-one'));
  await page.waitForTimeout(400);
  const spStoredThumbs = await spThumbs();
  const spSMark3 = await spStorageMark();
  const spMark3 = await anMark();
  await anClick('#sourcePhotoList [data-photo-remove="0"]');
  const spRmBand = await anBeforeSave();
  const spRmBefore = (await spStorage(spSMark3)).filter(s => s.op === 'remove').length + (await anSince(spMark3)).length;
  const spLog3 = await spLogMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const spRmRow = ((await spRecipeWrites(spMark3)).pop() || { rows: [{}] }).rows[0];
  const spRm = (await spStorage(spSMark3)).filter(s => s.op === 'remove');
  const spRmOrder = await spLog(spLog3);
  check('    on Edit the stored pages show; REMOVE is named by BEFORE YOU SAVE and done by SAVE: the row without it first, then its file',
        spStoredThumbs.length === 2 && spStoredThumbs[0].caption === 'PAGE 1 VIEW REMOVE' && spStoredThumbs.every(t => /^blob:/.test(t.src))
        && spRmBand.includes('Deletes the source photo you removed') && spRmBefore === 0
        && JSON.stringify((spRmRow.source_photos || []).map(p => p.path)) === JSON.stringify([spPaths[1]])
        && spRm.length === 1 && JSON.stringify(spRm[0].paths) === JSON.stringify([spPaths[0]]) && spRm[0].bucket === 'recipe-sources'
        && spRmOrder.join(',') === 'write-done:recipes,storage-done:remove', JSON.stringify([spStoredThumbs, spRmBand, spRmRow.source_photos, spRm, spRmOrder]));
  // An edit that leaves the photos alone keeps them; a recipe with none sends no source_photos at all.
  const spMark4 = await anMark();
  await page.evaluate(() => openEditModal('sp-one'));
  await page.waitForTimeout(300);
  await page.click('#saveBtn');
  await page.waitForTimeout(400);
  await page.evaluate(() => openEditModal('sp-two'));
  await page.waitForTimeout(300);
  await page.click('#saveBtn');
  await page.waitForTimeout(400);
  const spKeep = (await spRecipeWrites(spMark4)).map(w => w.rows[0]);
  check('    an edit that leaves the photos alone keeps the list, and a recipe with none sends no source_photos, so an ordinary save is unchanged',
        spKeep.length === 2 && JSON.stringify((spKeep[0].source_photos || []).map(p => p.path)) === JSON.stringify([spPaths[1]]) && !('source_photos' in spKeep[1]),
        JSON.stringify(spKeep.map(r => [r.id, r.source_photos])));
  // The last one removed: the row says null, not nothing (a one-row upsert would keep the old list).
  await page.evaluate(() => openEditModal('sp-one'));
  await page.waitForTimeout(300);
  await anClick('#sourcePhotoList [data-photo-remove="0"]');
  const spMark5 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const spNullRow = ((await spRecipeWrites(spMark5)).pop() || { rows: [{}] }).rows[0];
  const spNoChip = await page.evaluate(() => !document.querySelector('#viewerProvenance [data-source-photos]'));
  check('    removing the last page writes source_photos as null, and the chip goes',
        'source_photos' in spNullRow && spNullRow.source_photos === null && spNoChip, JSON.stringify([spNullRow.source_photos, spNoChip]));
  // Closing the form unsaved stores nothing.
  await page.evaluate(() => openEditModal('sp-two'));
  await page.waitForTimeout(300);
  const spSMark6 = await spStorageMark();
  const spMark6 = await anMark();
  await spPick([800, 600]);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const spClosed = { storage: (await spStorage(spSMark6)).length, writes: (await anSince(spMark6)).length,
    photos: await page.evaluate(() => [formPhotos.length, loadRecipes().find(r => r.id === 'sp-two').sourcePhotos]) };
  check('    a photo added to a form closed without saving is never stored',
        spClosed.storage === 0 && spClosed.writes === 0 && spClosed.photos[0] === 0 && spClosed.photos[1] === null, JSON.stringify(spClosed));
  // An upload that fails does not hold up the recipe, and is sent again with the next write.
  await page.evaluate(() => openEditModal('sp-two'));
  await page.waitForTimeout(300);
  await spPick([800, 600]);
  await page.evaluate(() => { window.__STORAGE_FAIL__ = true; });
  const spSMark7 = await spStorageMark();
  const spLog7 = await spLogMark();
  await allowSyncFailures(async () => { await page.click('#saveBtn'); await page.waitForTimeout(600); });
  const spFailToast = await page.evaluate(() => (document.querySelector('.toast') || { textContent: '' }).textContent);
  const spFailState = await page.evaluate(() => ({ unsent: unsentLabels.has('the source photos'), listed: (loadRecipes().find(r => r.id === 'sp-two').sourcePhotos || []).length,
    viewerImg: null }));
  await anClick('#viewerProvenance [data-source-photos]');
  await page.waitForTimeout(300);
  spFailState.viewerImg = await page.evaluate(() => (document.querySelector('#sourcePhotoBody img') || {}).src || '');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__STORAGE_FAIL__ = false; flushFailedWrites(); });
  await page.waitForTimeout(400);
  const spRetry = await spStorage(spSMark7);
  const spRetryLog = await spLog(spLog7);
  const spAfter = await page.evaluate(() => unsentLabels.has('the source photos'));
  check('    an upload that fails leaves the recipe saved and the photo showing from this tab, says so, and is sent again once storage answers',
        /Couldn't save the source photos/.test(spFailToast) && spFailState.unsent && spFailState.listed === 1 && /^blob:/.test(spFailState.viewerImg)
        && spRetry.filter(s => s.op === 'upload').length === 2 && spRetryLog.join(',') === 'write-done:recipes,storage-done:upload' && !spAfter,
        JSON.stringify([spFailToast, spFailState, spRetry.map(s => s.op), spRetryLog, spAfter]));
  // Deleting the recipe deletes its photos, after the row.
  const spTwoPaths = await page.evaluate(() => loadRecipes().find(r => r.id === 'sp-two').sourcePhotos.map(p => p.path));
  const spSMark8 = await spStorageMark();
  const spLog8 = await spLogMark();
  await page.evaluate(() => deleteRecipe('sp-two'));
  await page.waitForTimeout(400);
  const spDel = (await spStorage(spSMark8)).filter(s => s.op === 'remove');
  const spDelOrder = (await page.evaluate(m => window.__LOG__.slice(m).filter(l => /^(write-done:recipes|storage-done:)/.test(l)), spLog8));
  check('    deleting a recipe deletes its source photos too, after the row',
        spDel.length === 1 && JSON.stringify(spDel[0].paths) === JSON.stringify(spTwoPaths) && spDelOrder.join(',') === 'write-done:recipes,storage-done:remove',
        JSON.stringify([spDel, spTwoPaths, spDelOrder]));
  /* ---- CHECKED AGAINST THE PHOTO (docs/PLAN-SOURCE-PHOTOS.md, step 3) ----
     No comparison can read a photo, but the household can: the check is recorded as one would be, so the
     recipe reads VALIDATED and lapses when its lines change. Two invented recipes, each with a stored page. */
  await page.evaluate(() => {
    const mk = (id, title) => { const path = `${HOUSEHOLD_ID}/${id}/page.jpg`; window.__STORAGE_FILES__[path] = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      loadRecipes().push({ id, title, source: 'A family card', sourceUrl: '', servings: 4, tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-06',
        sourceCheck: null, sourcePhotos: [{ path, added: '2026-09-30T10:00:00.000Z' }],
        syntax: ['TITLE: ' + title, 'SOURCE: A family card', 'SERVINGS: 4', '', 'GROUP a:', '250 g rye flour', '2 tbsp black treacle', '', 'STAGE:', 'MERGE a -> done: Bake [40 min]'].join('\n') }); };
    mk('pc-one', 'PC Rye Loaf'); mk('pc-two', 'PC Treacle Rye');
  });
  const pcRow = () => page.evaluate(() => ({ text: ((document.getElementById('photoCheckRow') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    check: !!document.querySelector('#photoCheckRow [data-photo-check]'), undo: !!document.querySelector('#photoCheckRow [data-photo-uncheck]') }));
  await page.evaluate(() => openEditModal('pc-one'));
  await page.waitForTimeout(400);
  const pcOffer = await pcRow();
  const pcMark0 = await anMark();
  await anClick('#photoCheckRow [data-photo-check]');
  const pcPending = await pcRow();
  const pcBandPending = await anBeforeSave();
  await anClick('#photoCheckRow [data-photo-uncheck]');
  const pcUndone = await pcRow();
  const pcBandUndone = await anBeforeSave();
  check('CHECKED AGAINST THE PHOTO is offered beside the photo; tapped it waits for SAVE with UNDO, and BEFORE YOU SAVE names it',
        pcOffer.check && pcPending.undo && /Recorded as checked against the photo when you save/.test(pcPending.text)
        && pcBandPending.includes('Records: the ingredient list checked against the source photo') && pcUndone.check && !pcBandUndone.some(l => /photo/.test(l))
        && (await anSince(pcMark0)).length === 0, JSON.stringify([pcOffer, pcPending, pcBandPending, pcUndone, pcBandUndone]));
  await anClick('#photoCheckRow [data-photo-check]');
  const pcMark1 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const pcSc = (((await spRecipeWrites(pcMark1)).pop() || { rows: [{}] }).rows[0].source_check) || {};
  const pcHash = await page.evaluate(() => linesHash(['250 g rye flour', '2 tbsp black treacle']));
  const pcChip = await page.evaluate(() => [...document.querySelectorAll('#viewerProvenance .prov-chip')].map(c => ({ text: c.textContent, title: c.title })));
  const pcWhen = await page.evaluate(() => formatDate(isoLocal(new Date(loadRecipes().find(r => r.id === 'pc-one').sourceCheck.validated))).toUpperCase());
  check('    SAVE records it as a check of these lines, route "photo", validated; the viewer then says VALIDATED, by the photo',
        pcSc.route === 'photo' && pcSc.hard === 0 && pcSc.linesHash === pcHash && !isNaN(Date.parse(pcSc.validated)) && pcSc.validated === pcSc.at
        && pcChip.length === 2 && pcChip[0].text === `VALIDATED ${pcWhen}` && /source photo/.test(pcChip[0].title) && pcChip[1].text === 'SOURCE PHOTO',
        JSON.stringify([pcSc, pcChip]));
  await page.evaluate(() => openEditModal('pc-one'));
  await page.waitForTimeout(400);
  const pcAgain = { row: await pcRow(), stored: await page.evaluate(() => document.getElementById('sourceStored').textContent.replace(/\s+/g, ' ').trim()) };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const pcLc = await page.evaluate(() => ['pc-one', 'pc-two'].map(id => { const x = libraryCheckRows().find(r => r.id === id); return { key: x.key, status: x.status, attention: LIBRARY_STATUS.find(st => st.key === x.key).attention }; }));
  // The status's own weight: both recipes also put their made-up names in Other, which needs attention for its own reason.
  check('    Edit then says when, with no second offer; LIBRARY CHECK reads it "checked against the photo", and an unchecked photo recipe as needing attention',
        /^Checked against the photo .+\.$/.test(pcAgain.row.text) && !pcAgain.row.check && /^Checked against the source photo .+\.$/.test(pcAgain.stored) && !/RE-CHECK/.test(pcAgain.stored)
        && pcLc[0].key === 'validated' && pcLc[0].status === 'checked against the photo' && !pcLc[0].attention
        && pcLc[1].key === 'photo' && pcLc[1].status === 'source photo not checked' && pcLc[1].attention, JSON.stringify([pcAgain, pcLc]));
  // Lines changed after the tap: it asks again rather than vouch for lines nobody checked.
  await page.evaluate(() => openEditModal('pc-two'));
  await page.waitForTimeout(400);
  await anClick('#photoCheckRow [data-photo-check]');
  await page.evaluate(() => { const ta = document.getElementById('importInput'); ta.value = ta.value.replace('250 g rye flour', '300 g rye flour'); parseAndPreview(); });
  await page.waitForTimeout(300);
  const pcChanged = await pcRow();
  const pcChangedBand = await anBeforeSave();
  const pcMark2 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const pcChangedRow = ((await spRecipeWrites(pcMark2)).pop() || { rows: [{}] }).rows[0];
  check('    a change to the lines after the tap drops it: offered again, not named by BEFORE YOU SAVE, not saved',
        pcChanged.check && !pcChanged.undo && !pcChangedBand.some(l => /photo/.test(l)) && !('source_check' in pcChangedRow), JSON.stringify([pcChanged, pcChangedBand, pcChangedRow.source_check]));
  // A comparison run in the form speaks for the list instead.
  await page.evaluate(() => openEditModal('pc-two'));
  await page.waitForTimeout(400);
  await anClick('#photoCheckRow [data-photo-check]');
  await page.fill('#sourcePasteInput', '300 g rye flour\n2 tbsp black treacle');
  await anClick('#comparePastedBtn');
  await page.waitForTimeout(300);
  const pcAfterCompare = await pcRow();
  const pcMark3 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const pcCmpSc = (((await spRecipeWrites(pcMark3)).pop() || { rows: [{}] }).rows[0].source_check) || {};
  check('    and a comparison run in the form takes its place: the offer goes and SAVE records the comparison',
        !pcAfterCompare.check && !pcAfterCompare.undo && pcCmpSc.route === 'pasted' && !pcCmpSc.validated, JSON.stringify([pcAfterCompare, pcCmpSc]));
  await page.evaluate(() => { for(let i = loadRecipes().length - 1; i >= 0; i--) if(String(loadRecipes()[i].id).startsWith('pc-')) loadRecipes().splice(i, 1); });
  // Before the migration: rows without the column mean it has not been applied; ADD PHOTO says so.
  const spOff = await page.evaluate(async () => {
    const saved = JSON.stringify(window.__STUB_DATA__.recipes);
    window.__STUB_DATA__.recipes.forEach(r => { delete r.source_photos; });
    await hydrate();
    const off = sourcePhotosAvailable;
    openEditModal(loadRecipes()[0].id);
    const form = { disabled: document.getElementById('addSourcePhotoBtn').disabled, hint: document.getElementById('sourcePhotoHint').textContent,
      row: 'source_photos' in recipeToRow(loadRecipes()[0]) };
    closeAddModal();
    window.__STUB_DATA__.recipes = JSON.parse(saved);
    await hydrate();
    return { off, form, on: sourcePhotosAvailable, roundTrip: rowToRecipe({ ...window.__STUB_DATA__.recipes[0], source_photos: [{ path: 'h/r/x.jpg', added: 'a' }] }, {}).sourcePhotos };
  });
  check('    a library whose rows have no source_photos column reads as not set up: ADD PHOTO is off and says why, and a save sends no such column',
        spOff.off === false && spOff.form.disabled && /aren't set up yet/.test(spOff.form.hint) && !spOff.form.row && spOff.on === true
        && JSON.stringify(spOff.roundTrip) === JSON.stringify([{ path: 'h/r/x.jpg', added: 'a' }]), JSON.stringify(spOff));
  await page.evaluate(() => { for(let i = loadRecipes().length - 1; i >= 0; i--) if(String(loadRecipes()[i].id).startsWith('sp-')) loadRecipes().splice(i, 1); showView('recipes'); renderHome(); });

  const failed = checks.filter(c => !c.pass).length;
  console.log(`\n${checks.length} checks, ${failed} failed`);
  console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : 'no console/page errors');
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})().catch(e => {
  /* A crash is a failure with a location, not a silent exit 1. */
  console.log(`\nCRASH after ${checks.length} checks: ${e && e.message ? e.message.split('\n')[0] : e}`);
  process.exit(1);
});
