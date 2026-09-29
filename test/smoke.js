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
  for (const view of ['planner','shopping','history','swaps','settings','recipes']) {
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
    rows: [...document.querySelectorAll('#reviewList .rv-row')].map(r => ({ text: r.textContent.replace(/\s+/g, ' ').trim(), other: !!r.querySelector('.rv-other') })),
    buttons: document.querySelectorAll('#reviewList button').length }));
  const rvRowFor = n => rvFresh.rows.find(r => r.text.startsWith(n)) || {};
  /* PR 3 asserted here that "Same as X?" carried no buttons (they were PR 4's). PR 4 gives that row its
     two, so the clause is now that ONLY that row has any (the other two rows have none). */
  check('a new name landing in Other is marked, one landing in an aisle is not, and "Same as X?" names the existing ingredient',
        rvFresh.rows.length === 3 && rvRowFor('Sumac').other === true && rvRowFor('Young jackfruit').other === true && rvRowFor('Mangetout').other === false
        && /lands under Produce/.test(rvRowFor('Mangetout').text) && /Same as Jackfruit\?/.test(rvRowFor('Young jackfruit').text) && rvFresh.buttons === 2,
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
  const anSettled = await page.evaluate(() => ({ buttons: document.querySelectorAll('#reviewList [data-rv]').length, text: document.getElementById('reviewList').textContent.replace(/\s+/g, ' ') }));
  check('a settled pair is not offered: after KEEP APART the same names are listed as new, with no "Same as" row',
        anSettled.buttons === 0 && !/Same as/.test(anSettled.text) && /Young jackfruit/.test(anSettled.text), JSON.stringify(anSettled));

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

  await page.screenshot({ path: path.join(__dirname, 'settings.png'), fullPage: false });

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
