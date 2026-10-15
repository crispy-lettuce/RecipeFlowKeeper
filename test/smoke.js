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
  const errors = [];
  /* Every page this suite opens goes through here (12 Oct 2026, the October review, F30 and F47). Two things used to be
     true of the main page only, or of none:
       - A console error failed the run only on the main page; the secondary pages listened for uncaught exceptions
         alone, so an app console.error there passed.
       - Nothing stopped a page reaching the network. The fixture's recipes carry image addresses under the live
         project's public Storage prefix, as they must for SELF_HOST_PREFIX to match, and headless Chromium fetched
         them: the live edge logs showed a burst of GETs from every smoke run, CI on a public repo's PRs included,
         while tests.yml said nothing here touched the live project. Google Fonts and the R3 fixture's external
         image went out too.
     So every page now records page errors and console errors under its label (p.__label, set where it is opened;
     p.__expectConsole names the one error a page is there to provoke),
     and refuses every http(s) request as blocked by the client, which is also the only network error the console
     filter lets through. A test that answers a request itself (page.route, which runs before this catch-all) still
     can. Every request a page makes is listed, and the last checks prove each one was either refused here or
     answered by the test: none reached the network. */
  const net = { seen: [], handled: new Set() };
  const openPage = browser.newPage.bind(browser);
  let opened = 0;
  browser.newPage = async (opts) => {
    const p = await openPage(opts);
    const n = ++opened;
    const label = () => p.__label || 'page ' + n;
    p.on('pageerror', e => errors.push(`PAGEERROR (${label()}): ` + e.message));
    p.on('console', m => {
      if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(m.text()) && !(p.__expectConsole && p.__expectConsole.test(m.text())))
        errors.push(`CONSOLE (${label()}): ` + m.text());
    });
    p.on('request', r => { if (/^https?:/.test(r.url())) net.seen.push({ req: r, url: r.url(), page: label() }); });
    const route = p.route.bind(p);
    p.route = (url, handler, o) => route(url, (rt, req) => { net.handled.add(rt.request()); return handler(rt, req); }, o);
    await route(/^https?:\/\//, rt => { net.handled.add(rt.request()); return rt.abort('blockedbyclient'); });
    return p;
  };
  const page = await browser.newPage();
  page.__label = 'main';

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

  /* ---- Readability T (14 Oct 2026, docs/PLAN-READABILITY.md): the quiet inks can be read, in both themes ----
     core.test.js checks the token values by arithmetic; this checks what lands on screen. Before T, 365 text elements
     in the light theme and 225 in the dark were under 4.5:1 on the screens below, nearly all of them --ink-faint and
     --ink-mute. Every element whose text colour is one of the three quiet inks is measured against its real background:
     the translucent backgrounds of its ancestors composited onto each other, because a wash behind a label can take a
     colour that passes on paper below 4.5:1 (faint text on a .06 plum wash was 4.47). An element faded by opacity (a day
     outside the month, a step mid-fade) is left out: it is dimmed on purpose. Sage and gold used as text are not quiet inks;
     they are still under 4.5:1 (25 elements in the light theme) and are left for a later change, because T is colour tokens
     only. About 490 elements are measured in each theme; fewer than 300 means the walk missed a screen. */
  const readInks = () => page.evaluate(() => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = el => {
      const layers = [];
      for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; } }
      return layers.reduceRight((under, layer) => over(layer, under), { r: 255, g: 255, b: 255, a: 1 });
    };
    const resolve = n => { const s = document.createElement('span'); s.style.color = 'var(--' + n + ')'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; };
    const quiet = new Set(['ink-soft', 'ink-faint', 'ink-mute'].map(resolve));
    let n = 0; const bad = [], small = [], seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t; (t = walker.nextNode()); ) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.nodeValue.trim() || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      let shown = true, op = 1;
      for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') { shown = false; break; } op *= parseFloat(c.opacity); }
      if (!shown) continue;
      if (parseFloat(cs.fontSize) < 13) small.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} ${cs.fontSize}`);
      if (!quiet.has(cs.color) || op < 0.99 || el.closest(':disabled')) continue;
      n++;
      const bg = bgOf(el), rt = ratio(parse(cs.color), bg);
      if (rt < 4.5) bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} "${t.nodeValue.trim().slice(0, 18)}" ${rt.toFixed(2)}`);
    }
    const qty = [...document.querySelectorAll('.qty')].find(q => q.getBoundingClientRect().width > 0);
    return { n, bad, small, qty: qty ? ratio(bgOf(qty), bgOf(qty.parentElement)) : null };
  });
  const walkInks = async () => {
    const all = { n: 0, bad: [], small: [], qty: null, labels: null, viewer: null, done: null };
    const take = async view => { const r = await readInks(); all.n += r.n; all.bad.push(...r.bad.map(b => b + ' (' + view + ')')); all.small.push(...r.small.map(b => b + ' (' + view + ')')); if (r.qty !== null) all.qty = r.qty; };
    await page.click('.navlink[data-view="recipes"]'); await page.waitForTimeout(300); await take('recipes');
    all.labels = await page.evaluate(() => { const ls = [...document.querySelectorAll('.filter-row-label')].filter(l => l.getBoundingClientRect().width > 0);
      return { n: ls.length, clipped: ls.filter(l => l.scrollWidth > l.clientWidth + 1).map(l => l.textContent.trim()) }; });
    await page.click('.rcard'); await page.waitForTimeout(600); await take('viewer');
    all.viewer = await page.evaluate(() => { const one = sel => document.querySelector('#view-viewer ' + sel); const px = sel => { const e = one(sel); return e && e.getBoundingClientRect().width > 0 ? parseFloat(getComputedStyle(e).fontSize) : null; };
      const bc = one('.box-cell'); return { sizes: { boxCell: px('.box-cell'), viewerMeta: px('.viewer-meta'), hint: px('.hint'), btn: px('.btn') }, boxFamily: bc ? getComputedStyle(bc).fontFamily : null }; });
    /* The done state is a class, so the check puts the class on and takes it off: no tick is made, nothing is logged as cooked. */
    all.done = await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--ink-soft)'; document.body.appendChild(s); const soft = getComputedStyle(s).color; s.remove(); const out = { soft };
      for (const sel of ['.ing-cell', '.box-cell']) { const c = document.querySelector('#view-viewer ' + sel); if (!c) { out[sel] = null; continue; }
        /* The cell fades its colours in over .15s, and a style read straight after the class goes on returns the start of the
           fade, not where it ends up; so the fade is switched off for the read. */
        c.style.transition = 'none'; c.classList.add('done'); const cs = getComputedStyle(c), as = getComputedStyle(c, '::after');
        out[sel] = { line: cs.textDecorationLine, opacity: cs.opacity, colour: cs.color, tick: as.width + ' x ' + as.height }; c.classList.remove('done'); c.style.transition = ''; }
      return out; });
    for (const v of ['planner', 'shortlist', 'shopping', 'history', 'settings']) {
      await page.click(`.navlink[data-view="${v}"]`); await page.waitForTimeout(400); await take(v);
    }
    for (const tab of ['ingredients', 'library', 'app', 'help']) {
      await page.click(`[data-settings-tab-btn="${tab}"]`); await page.waitForTimeout(250); await take('settings/' + tab);
    }
    return all;
  };
  const inkLight = await walkInks();
  check('light theme: every element in a quiet ink (soft, faint, mute) is at least 4.5:1 against its real background',
        inkLight.n >= 300 && inkLight.bad.length === 0, `${inkLight.n} measured` + (inkLight.bad.length ? '; ' + inkLight.bad.slice(0, 6).join('; ') : ''));
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.click('[data-settings-tab-btn="app"]');
  await page.selectOption('#setDarkMode', 'dark');
  await page.waitForTimeout(300);
  const inkDark = await walkInks();
  check('dark theme: every element in a quiet ink (soft, faint, mute) is at least 4.5:1 against its real background',
        inkDark.n >= 300 && inkDark.bad.length === 0, `${inkDark.n} measured` + (inkDark.bad.length ? '; ' + inkDark.bad.slice(0, 6).join('; ') : ''));
  /* The plum wash behind a quantity was dark plum at 9% in both themes: 1.03:1 against a dark card, so in the dark theme the
     pill was not there at all. Now it is a token that has a dark value (1.18:1). 1.08:1 is the weakest wash the light theme
     shows (today's Planner row, 1.08:1). */
  check('dark theme: a quantity pill shows against the surface it sits on (at least 1.08:1)',
        inkDark.qty !== null && inkDark.qty >= 1.08, inkDark.qty === null ? 'no .qty on screen' : `light ${inkLight.qty === null ? 'n/a' : inkLight.qty.toFixed(2)}, dark ${inkDark.qty.toFixed(2)}`);

  /* ---- Readability S (14 Oct 2026, docs/PLAN-READABILITY.md): the type scale ----
     core.test.js checks the stylesheet's sizes and mono list from its source; these check what the browser makes of them. */
  const vw = inkLight.viewer, sizes = vw.sizes;
  check('the viewer reads at 13px or more (.box-cell, .viewer-meta, .hint, .btn), and a step box is not set in mono',
        Object.values(sizes).every(v => v !== null && v >= 13) && !!vw.boxFamily && !/mono/i.test(vw.boxFamily), JSON.stringify(sizes) + ' ' + vw.boxFamily);
  check('no visible text on the screens walked is under 13px, in either theme',
        inkLight.small.length === 0 && inkDark.small.length === 0, [...inkLight.small, ...inkDark.small].slice(0, 6).join('; '));
  const dn = inkLight.done, tickedOk = k => !!dn[k] && /line-through/.test(dn[k].line) && dn[k].opacity === '1' && dn[k].colour === dn.soft && dn[k].tick === '26px x 26px';
  check('a ticked ingredient and a ticked step are struck through at full opacity in --ink-soft (over the step\'s inline colour), with a 26px tick',
        tickedOk('.ing-cell') && tickedOk('.box-cell'), JSON.stringify(dn));
  check('the filter labels (COURSE, SOURCE, KEYWORD) fit their column',
        inkLight.labels.n >= 3 && inkLight.labels.clipped.length === 0, `${inkLight.labels.n} labels` + (inkLight.labels.clipped.length ? '; clipped: ' + inkLight.labels.clipped.join(', ') : ''));
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  await page.click('[data-settings-tab-btn="app"]');
  await page.selectOption('#setDarkMode', 'system');
  await page.waitForTimeout(300);
  await page.click('[data-settings-tab-btn="ingredients"]');  // leave Settings as the checks below expect

  /* ---- Readability H (14 Oct 2026, docs/PLAN-READABILITY.md): 44px tap targets ----
     core.test.js checks the stylesheet's rules from its source; these measure what is on screen. The plan's check is "every visible
     button in the viewer and Planner is at least 44px tall"; the sidebar's buttons are on screen in both, so they are counted too.
     The card's corner buttons are 36px by design and have their own hit test below. */
  const tapScan = (pg, scopes) => pg.evaluate(scopes => {
    const seen = new Set(), bad = []; let n = 0;
    for (const sc of scopes) for (const root of document.querySelectorAll(sc)) for (const e of root.querySelectorAll('button, label.toggle-switch')) {
      if (seen.has(e) || e.classList.contains('rcard-shortlist') || e.classList.contains('rcard-favourite')) continue;
      seen.add(e);
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      let hidden = false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break; } }
      if (hidden) continue;
      n++;
      if (r.height < 43.5) bad.push(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''} "${(e.textContent || '').trim().slice(0, 14)}" ${Math.round(r.height)}px`);
    }
    return { n, bad };
  }, scopes);
  const tapWalk = async pg => {
    const all = { n: 0, bad: [] };
    await pg.click('.navlink[data-view="recipes"]'); await pg.waitForTimeout(300);
    await pg.click('.rcard'); await pg.waitForTimeout(600);
    let r = await tapScan(pg, ['#view-viewer', '.sidebar']); all.n += r.n; all.bad.push(...r.bad.map(b => b + ' (viewer)'));
    await pg.click('.navlink[data-view="planner"]'); await pg.waitForTimeout(500);
    r = await tapScan(pg, ['#view-planner', '.sidebar']); all.n += r.n; all.bad.push(...r.bad.map(b => b + ' (planner)'));
    return all;
  };
  const tapTablet = await tapWalk(page);
  check('tablet width: every visible button in the viewer, Planner and sidebar is at least 44px tall',
        tapTablet.n >= 40 && tapTablet.bad.length === 0, `${tapTablet.n} measured` + (tapTablet.bad.length ? '; ' + tapTablet.bad.slice(0, 6).join('; ') : ''));
  const phone = await browser.newPage({ viewport: { width: 412, height: 915 } });
  phone.__label = 'phone';
  await phone.clock.setFixedTime(FIXTURE_NOW);
  await phone.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await phone.waitForTimeout(1200);
  const tapPhone = await tapWalk(phone);
  await phone.close();
  check('phone width: every visible button in the viewer, Planner and navigation is at least 44px tall',
        tapPhone.n >= 40 && tapPhone.bad.length === 0, `${tapPhone.n} measured` + (tapPhone.bad.length ? '; ' + tapPhone.bad.slice(0, 6).join('; ') : ''));

  /* A button's 44px hit area is not its rectangle when an invisible ::before makes up the rest, so this points at the four edges
     of the 44px square around each card corner button and asks what a tap there would land on. */
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(400);
  const cornerHits = await page.evaluate(() => {
    const out = { n: 0, miss: [] };
    for (const b of document.querySelectorAll('.rcard-shortlist, .rcard-favourite')) {
      const r = b.getBoundingClientRect(); if (r.width < 4) continue;
      out.n++;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const [dx, dy] of [[-21, 0], [21, 0], [0, -21], [0, 21]]) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        if (!hit || hit.closest('.rcard-shortlist, .rcard-favourite') !== b) out.miss.push(`${b.className.split(' ')[0]} ${dx},${dy}`);
      }
    }
    return out;
  });
  check('the card corner buttons answer a tap anywhere in a 44px square around them',
        cornerHits.n >= 2 && cornerHits.miss.length === 0, `${cornerHits.n} buttons` + (cornerHits.miss.length ? '; missed: ' + cornerHits.miss.slice(0, 4).join(', ') : ''));

  /* PLAN-LAYOUT B: cooking mode keeps what is left on a tidy header. The information rows (the meta line, the provenance chips and
     the SERVE WITH and OFTEN WITH lines) wrap onto rows of their own whatever the buttons do, and which of them a recipe shows decides
     how many lines the header takes. So the controls are measured with those rows out of the way, and each row is allowed one line. */
  await page.click('.rcard');
  await page.waitForTimeout(600);
  await page.click('#view-viewer .toggle-switch');
  await page.waitForTimeout(500);
  const cookLines = await page.evaluate(() => {
    const head = document.querySelector('#view-viewer .viewer-head');
    const lines = () => { const cs = [...head.children].filter(k => { const r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(k => { const r = k.getBoundingClientRect(); return r.top + r.height / 2; }).sort((a, b) => a - b);
      let n = 0, last = -99; for (const c of cs) { if (c - last > 10) n++; last = c; } return n; };
    const withMeta = lines();
    const hide = ['#viewerMeta', '#viewerProvenance', '#viewerServeWith', '#viewerOftenWith'].map(sel => document.querySelector(sel)).filter(e => e && e.getBoundingClientRect().height > 0);
    const shown = hide.map(e => e.style.display); hide.forEach(e => { e.style.display = 'none'; });
    const controlsOnly = lines();
    hide.forEach((e, i) => { e.style.display = shown[i]; });
    return { withInfo: withMeta, controlsOnly, infoRows: hide.length };
  });
  await page.click('#view-viewer .toggle-switch');   // cooking mode off again
  await page.waitForTimeout(400);
  check('cooking mode at tablet width: the header controls fit on one line, and each information row adds at most one more',
        cookLines.controlsOnly === 1 && cookLines.withInfo <= cookLines.controlsOnly + cookLines.infoRows, JSON.stringify(cookLines));

  /* ---- Keyboard focus (READABILITY F, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
     core.test.js reads the rules; this presses Tab on Recipes, Planner and Settings and looks at what is drawn on each stop. A stop
     shows a ring when it has a 2px outline itself, or its frame has (the search bar). The keyword box only exists while it has focus, so
     it is added by hand. In the side menu the ring must also stay inside the menu, which clips its sides. Each walk gets a page of its
     own: Tab starts from wherever the last click or focus was, so on the long-lived page above it would start in the middle of the
     screen and skip the search box (seen: it did, and removing the search bar's ring failed nothing). */
  const MUST_SEE = ['input#searchInput', 'input#shortlistInput', 'input#swap-original'];   // a walk that never reached them proves nothing about them
  const focusWalk = async dark => {
    const res = { stops: 0, bare: [], wrong: [], sideStops: 0, sideClipped: [], kw: null, saw: new Set(), views: [] };
    const probe = () => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      let wrapped = false; if (!window.__fwFirst) window.__fwFirst = e; else if (window.__fwFirst === e) wrapped = true;   // Tab has come round to where it began
      const sig = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
      const ringOf = x => { const c = getComputedStyle(x); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2 ? c : null; };
      const drawn = ringOf(e) || (e.closest('.searchbar') && ringOf(e.closest('.searchbar')));
      const t = document.createElement('i'); t.style.color = 'var(--plum)'; document.body.appendChild(t);
      const plum = getComputedStyle(t).color; t.remove();
      const sb = e.closest('.sidebar'); let clipped = false;
      if (sb && drawn) {
        const off = parseFloat(drawn.outlineOffset) + parseFloat(drawn.outlineWidth), r = e.getBoundingClientRect(), s = sb.getBoundingClientRect();
        const left = s.left + sb.clientLeft, right = left + sb.clientWidth;
        clipped = r.left - off < left - .5 || r.right + off > right + .5;
      }
      return { sig, wrapped, drawn: !!drawn, colour: drawn ? drawn.outlineColor : null, plum, inSide: !!sb, clipped };
    };
    for (const [view, tab] of [['recipes'], ['planner'], ['settings', 'ingredients'], ['settings', 'app']]) {
      const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await pg.clock.setFixedTime(FIXTURE_NOW);
      await pg.goto('file://' + path.join(__dirname, 'app-under-test.html'));
      await pg.waitForTimeout(1200);
      if (dark) {
        await pg.evaluate(() => { showView('settings'); showSettingsTab('app'); }); await pg.waitForTimeout(200);
        await pg.selectOption('#setDarkMode', 'dark'); await pg.waitForTimeout(300);
      }
      await pg.evaluate(v => showView(v), view);
      if (tab) await pg.evaluate(t => showSettingsTab(t), tab);   // Settings shows one tab at a time, and its swap fields and its appearance select are on different ones
      await pg.waitForTimeout(400);
      const tag = view + (tab ? '/' + tab : '') + ': ';
      const take = async () => {
        const p = await pg.evaluate(probe); if (!p) return null;
        res.saw.add(p.sig.split('.')[0]);
        if (!p.drawn) res.bare.push(tag + p.sig); else if (p.colour !== p.plum) res.wrong.push(tag + p.sig + ' ' + p.colour + ' not ' + p.plum);
        if (p.inSide) { res.sideStops++; if (p.clipped) res.sideClipped.push(p.sig); }
        return p;
      };
      let here = 0, last = [], ended = 'cap';
      for (let i = 0; i < 150; i++) {
        await pg.keyboard.press('Tab');
        const p = await take(); if (!p) { ended = 'left the page'; break; } if (p.wrapped) { ended = 'wrapped'; break; }
        res.stops++; here++; last.push(p.sig.split('.')[0]); if (last.length > 3) last.shift();
      }
      res.views.push(`${tag.slice(0, -2)} ${here} (${ended}, last ${last.join(' > ')})`);
      if (view === 'recipes') {   // the keyword box is not in the tab order until + ADD is pressed, and then it has focus at once
        await pg.click('#addKwBtn'); await pg.waitForTimeout(200);
        res.kw = await take();
      }
      await pg.close();
    }
    return res;
  };
  const lightWalk = await focusWalk(false);
  const unseen = w => MUST_SEE.filter(x => !w.saw.has(x));
  check('keyboard focus: every Tab stop on Recipes, Planner and Settings shows a 2px plum ring, on itself or on its frame',
        lightWalk.stops >= 60 && lightWalk.kw && lightWalk.kw.sig.startsWith('input#kwInput') && unseen(lightWalk).length === 0 && lightWalk.bare.length === 0 && lightWalk.wrong.length === 0,
        `${lightWalk.stops} stops [${lightWalk.views.join('; ')}]` + (unseen(lightWalk).length ? '; never reached: ' + unseen(lightWalk).join(', ') : '') + (lightWalk.bare.length ? '; no ring: ' + lightWalk.bare.slice(0, 5).join(', ') : '') + (lightWalk.wrong.length ? '; wrong colour: ' + lightWalk.wrong.slice(0, 3).join(', ') : '') + (lightWalk.kw ? '' : '; the keyword box did not take focus'));
  check('in the side menu the ring is drawn inside the link, so the menu does not cut its sides off',
        lightWalk.sideStops >= 12 && lightWalk.sideClipped.length === 0, `${lightWalk.sideStops} stops` + (lightWalk.sideClipped.length ? '; cut off: ' + [...new Set(lightWalk.sideClipped)].slice(0, 4).join(', ') : ''));

  const darkWalk = await focusWalk(true);
  check('in the dark theme every Tab stop shows the dark theme\'s plum ring',
        darkWalk.stops >= 60 && unseen(darkWalk).length === 0 && darkWalk.bare.length === 0 && darkWalk.wrong.length === 0 && darkWalk.kw && darkWalk.kw.plum !== lightWalk.kw.plum,
        `${darkWalk.stops} stops, ring ${darkWalk.kw && darkWalk.kw.colour} against light ${lightWalk.kw && lightWalk.kw.colour}` + (unseen(darkWalk).length ? '; never reached: ' + unseen(darkWalk).join(', ') : '') + (darkWalk.bare.length ? '; no ring: ' + darkWalk.bare.slice(0, 5).join(', ') : '') + (darkWalk.wrong.length ? '; wrong colour: ' + darkWalk.wrong.slice(0, 3).join(', ') : ''));

  /* ---- One corner radius (READABILITY R, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
     core.test.js reads the rules; this reads the corners that are drawn, on every screen, for each element and its ::before and
     ::after (the numbered-step badge is one). A circle computes as 50% and a pill as 20px or 999px, so anything but 0 or 2px is one.
     Each width gets a page of its own, as the focus walk does. Some circles must have been on screen, or an empty scan would pass. */
  const RADIUS_MUST = ['.rcard-shortlist', '.rcard-favourite', '.toggle-thumb', '.toggle-track', '.scale-btn', '.day-choose .circle'];
  const radiusWalk = async vp => {
    const pg = await browser.newPage({ viewport: vp });
    await pg.clock.setFixedTime(FIXTURE_NOW);
    await pg.goto('file://' + path.join(__dirname, 'app-under-test.html'));
    await pg.waitForTimeout(1200);
    const res = { n: 0, screens: 0, bad: [], seen: new Set() };
    const scan = async tag => {
      const r = await pg.evaluate(must => {
        const sig = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        const square = v => v === '0px' || v === '2px';
        let n = 0; const bad = new Set(), seen = new Set();
        for (const e of document.body.querySelectorAll('*')) {
          if (['SCRIPT', 'STYLE', 'OPTION'].includes(e.tagName) || e.closest('svg')) continue;
          const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
          let hidden = false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') { hidden = true; break; } }
          if (hidden) continue;
          for (const m of must) if (e.matches(m)) seen.add(m);
          for (const ps of [null, '::before', '::after']) {
            const cs = getComputedStyle(e, ps); if (ps && (cs.content === 'none' || cs.content === 'normal')) continue;
            n++;
            const c = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
            if (!c.every(square)) bad.add(sig(e) + (ps || '') + ' ' + [...new Set(c)].join('/'));
          }
        }
        return { n, bad: [...bad], seen: [...seen] };
      }, RADIUS_MUST);
      res.n += r.n; res.screens++; res.bad.push(...r.bad.map(b => tag + b)); r.seen.forEach(x => res.seen.add(x));
    };
    const show = async v => { await pg.evaluate(v2 => showView(v2), v); await pg.waitForTimeout(400); };
    await show('recipes'); await scan('recipes: ');
    await pg.click('.rcard'); await pg.waitForTimeout(600); await scan('viewer: ');
    await pg.click('#view-viewer .toggle-switch'); await pg.waitForTimeout(400); await scan('cooking mode: ');
    for (const v of ['planner', 'shortlist', 'shopping', 'history']) { await show(v); await scan(v + ': '); }
    await show('settings');
    for (const t of ['ingredients', 'library', 'app', 'help']) { await pg.evaluate(t2 => showSettingsTab(t2), t); await pg.waitForTimeout(300); await scan('settings/' + t + ': '); }
    await show('recipes'); await pg.click('#openAddBtn'); await pg.waitForTimeout(400); await scan('add dialog: ');
    await pg.close();
    return res;
  };
  for (const [label, vp] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 412, height: 915 }]]) {
    const rw = await radiusWalk(vp);
    const missing = RADIUS_MUST.filter(x => !rw.seen.has(x));
    check(`${label} width: every corner on screen is 0 or 2px, so no circle or pill is left`,
          rw.n >= 800 && rw.bad.length === 0 && missing.length === 0,
          `${rw.n} corners checked on ${rw.screens} screens` + (rw.bad.length ? '; not square: ' + rw.bad.slice(0, 5).join(', ') : '') + (missing.length ? '; never on screen: ' + missing.join(', ') : ''));
  }

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

  /* #94 (13 Oct): ticked means "already have it", so the list taken to the shops, printed or as a PNG, leaves the row off,
     MERGE WITH… and all, and an aisle with nothing left to buy goes too. The screen still shows both. */
  const shopShown = (scope) => page.evaluate(sc => {
    const root = sc ? document.querySelector(sc) : document;
    const vis = el => el.getClientRects().length > 0;
    const rows = [...root.querySelectorAll('.shop-row')];
    const ticked = rows.filter(r => r.querySelector('.shop-item.checked'));
    const unticked = rows.filter(r => !r.querySelector('.shop-item.checked'));
    const full = [...root.querySelectorAll('.shop-category.all-checked')];
    return { ticked: ticked.length, tickedShown: ticked.filter(vis).length, unticked: unticked.length,
      untickedShown: unticked.filter(vis).length, fullAisles: full.length, fullShown: full.filter(vis).length,
      toolsShown: [...root.querySelectorAll('.shop-tools')].filter(vis).length };
  }, scope);
  /* The PNG: html2canvas is the build's stub, so look at the page at the moment it is called, then once it has finished. */
  const shopPng = () => page.evaluate(async () => {
    const real = window.html2canvas, vis = el => el.getClientRects().length > 0;
    let seen = null;
    window.html2canvas = node => {
      const rows = [...node.querySelectorAll('.shop-row')];
      const ticked = rows.filter(r => r.querySelector('.shop-item.checked')), unticked = rows.filter(r => !r.querySelector('.shop-item.checked'));
      seen = { tickedShown: ticked.filter(vis).length, unticked: unticked.length, untickedShown: unticked.filter(vis).length,
        fullShown: [...node.querySelectorAll('.shop-category.all-checked')].filter(vis).length,
        toolsShown: [...node.querySelectorAll('.shop-tools')].filter(vis).length };
      return real(node);
    };
    document.getElementById('shopExportBtn').click();
    await new Promise(r => setTimeout(r, 300));
    window.html2canvas = real;
    return { seen, tickedBack: [...document.querySelectorAll('.shop-row')].filter(r => r.querySelector('.shop-item.checked') && vis(r)).length };
  });
  await page.emulateMedia({ media: 'print' });
  const shopPrint = await shopShown();
  await page.emulateMedia({ media: null });
  check('PRINT leaves ticked items off the shopping list, and keeps everything still to buy (#94)',
        shopPrint.ticked === 1 && shopPrint.tickedShown === 0 && shopPrint.unticked > 0 && shopPrint.untickedShown === shopPrint.unticked,
        JSON.stringify(shopPrint));
  const shopPngOut = await shopPng();
  check('    and so does EXPORT PNG, the whole row with its MERGE WITH…, which come back on screen afterwards',
        !!shopPngOut.seen && shopPngOut.seen.tickedShown === 0 && shopPngOut.seen.unticked > 0
        && shopPngOut.seen.untickedShown === shopPngOut.seen.unticked && shopPngOut.seen.toolsShown === 0 && shopPngOut.tickedBack === 1,
        JSON.stringify(shopPngOut));
  // Tick the rest of the tomato's aisle: the aisle's heading goes from both, then untick what was ticked here.
  const shopAisleTicked = await page.evaluate(() => {
    const cat = document.querySelector('.shop-item.checked').closest('.shop-category');
    return [...cat.querySelectorAll('.shop-item:not(.checked)')].map(el => el.dataset.key);
  });
  for (const k of shopAisleTicked) { await page.locator(`.shop-item[data-key="${k}"] input`).check(); await page.waitForTimeout(150); }
  await page.emulateMedia({ media: 'print' });
  const shopAislePrint = await shopShown();
  await page.emulateMedia({ media: null });
  const shopAislePng = await shopPng();
  const shopAisleScreen = await shopShown();
  for (const k of shopAisleTicked) { await page.locator(`.shop-item[data-key="${k}"] input`).uncheck(); await page.waitForTimeout(150); }
  const shopAisleAfter = await page.locator('.shop-item.checked').count();
  check('    an aisle with everything ticked is left off both, heading and all, though the screen still shows it',
        shopAislePrint.fullAisles === 1 && shopAislePrint.fullShown === 0 && shopAislePng.seen && shopAislePng.seen.fullShown === 0
        && shopAisleScreen.fullShown === 1 && shopAisleAfter === 1,
        JSON.stringify({ shopAislePrint, shopAislePng, shopAisleScreen, shopAisleAfter }));

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
  /* Since #94 (13 Oct) the fixing tools are drawn only while AUDIT is on; off, its button counts the questions waiting. */
  const auditOff = await page.evaluate(() => ({ tools: document.querySelectorAll('#shopBody .shop-tools').length,
    label: document.getElementById('shopAuditBtn').textContent }));
  await page.click('#shopAuditBtn');
  await page.waitForTimeout(200);
  const auditAsked = await page.evaluate(() => document.querySelectorAll('#shopBody .shop-suggest').length);
  check('AUDIT off: no row carries the fixing tools, and the button counts the questions waiting (#94)',
        auditOff.tools === 0 && auditAsked >= 1 && auditOff.label === `AUDIT · ${auditAsked}`, JSON.stringify({ auditOff, auditAsked }));
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
  // Tidy away the kale recipes, their plan entries and the matches, and end AUDIT.
  await page.evaluate((p) => {
    [p.a, p.b, p.c].forEach(id => deleteRecipe(id));
    loadAliases().filter(a => /kale|cavolo/.test(a.alias)).forEach(a => removeAlias(a.id));
  }, planned);
  await page.click('#shopAuditBtn');
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
  cold.__label = 'offline start';
  /* The app says so in the console when it cannot load at start-up; that is this page's whole point. */
  cold.__expectConsole = /^Could not load your library/;
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
  /* Leaving the box: blurred directly, since the box it used to move to is folded while the lookup holds text (#95). */
  await page.evaluate(() => document.activeElement.blur());
  const acBlur = await (async () => { await page.waitForTimeout(250); return acList('ingredientLookup'); })();
  await acType('ingredientLookup', '');
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
  await acType('ingredientLookup', '');  // the box below is folded while the lookup holds text (#95)
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
  /* HELP joined on 10 Oct 2026: the guide is help.html beside the app, opened in a new tab. Whether its anchors
     exist is test/help-guide.js's to check; this checks the tab shows its own blocks, links out, and is remembered. */
  await page.click('[data-settings-tab-btn="help"]');
  const stHelp = await stShown();
  const stHelpLinks = await page.evaluate(() => {
    const g = document.getElementById('helpGuideLink');
    const qs = [...document.querySelectorAll('#helpAnswers a')];
    return { guide: g && g.getAttribute('href'), guideTarget: g && g.target, guideShown: !!(g && g.offsetParent),
      quick: qs.length, quickOk: qs.every(a => /^help\.html#[a-z-]+$/.test(a.getAttribute('href')) && a.target === '_blank' && /noopener/.test(a.rel)) };
  });
  await page.click('.navlink[data-view="recipes"]');
  await page.waitForTimeout(200);
  await page.click('.navlink[data-view="settings"]');
  await page.waitForTimeout(300);
  const stHelpKept = await stShown();
  check('    HELP shows the guide, the version and the quick answers alone, opens help.html in a new tab, and is remembered like the other tabs',
        stHelp.join('|') === 'HOW-TO GUIDE|VERSION AND WHAT\'S NEW|QUICK ANSWERS' && stHelpLinks.guide === 'help.html' && stHelpLinks.guideTarget === '_blank'
        && stHelpLinks.guideShown && stHelpLinks.quick >= 6 && stHelpLinks.quickOk && stHelpKept.join('|') === stHelp.join('|'),
        JSON.stringify([stHelp, stHelpLinks, stHelpKept]));
  await page.click('[data-settings-tab-btn="ingredients"]');
  check('layout E: Settings has three tabs; Ingredients holds the lookup, word matches, aisles, swaps and dictionary, and SWAPS has left the sidebar',
        stIng.join('|') === 'INGREDIENT LOOKUP|WORD MATCHES|SHOPPING AISLES|SWAPS|DICTIONARY' && !stNav.includes('swaps') && stNav.includes('settings'),
        JSON.stringify([stIng, stNav]));
  /* CALENDAR joined App on 9 Oct 2026 (P3 PR 2), RECIPE SHARING and BACKUP TO GOOGLE DRIVE on 10 Oct; before their migrations each only says it is waiting. */
  check('    Library holds the library check, sources, keywords and photos; App the week start, appearance, style, preparation, calendar, sharing and Drive backup; the last tab is remembered',
        stLib.join('|') === 'LIBRARY CHECK|SOURCES|KEYWORDS|RECIPE PHOTOS' && stApp.join('|') === 'WEEK STARTS ON|APPEARANCE|STYLE|PREPARATION|CALENDAR|RECIPE SHARING|BACKUP TO GOOGLE DRIVE' && stKept.join('|') === stApp.join('|'),
        JSON.stringify([stLib, stApp, stKept]));
  /* Since #95 (13 Oct) the dictionary's fold is its heading, DICTIONARY (n), like every list on the tab. */
  const stDict = () => page.evaluate(() => ({ list: document.getElementById('dictionaryList').offsetParent !== null,
    head: document.querySelector('[data-ingr-section="dictionary"] .ingr-count').textContent.trim(),
    rows: [...document.querySelectorAll('#dictionaryList .dict-row')].filter(r => r.offsetParent !== null).length }));
  const stFolded = await stDict();
  await page.fill('#ingredientLookup', 'almond meal');
  await page.waitForTimeout(80);
  const stTyped = await stDict();
  await page.fill('#ingredientLookup', '');
  await page.waitForTimeout(80);
  const stRefolded = await stDict();
  await page.click('[data-ingr-section="dictionary"]');
  const stOpen = await stDict();
  await page.click('[data-ingr-section="dictionary"]');
  const stClosed = await stDict();
  const stCount = await page.evaluate(() => INGREDIENT_DICTIONARY.length);
  check('    the dictionary is folded under its heading; typing in the lookup opens the rows that match, and the heading opens and closes the whole of it',
        !stFolded.list && stFolded.rows === 0 && stFolded.head === `(${stCount})` && stTyped.list && stTyped.rows === 1 && stTyped.head === `(1 OF ${stCount})`
        && !stRefolded.list && stOpen.list && stOpen.rows === stCount && !stClosed.list,
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
        && spNewThumbs.length === 2 && spNewThumbs[0].caption === 'FILE 1 · NEW VIEW REMOVE' && /^blob:/.test(spNewThumbs[1].src)
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
        && spViewer.pages.length === 2 && spViewer.pages.every(p => /^blob:/.test(p.src) && p.link === p.src) && /^FILE 1 OF 2 · ADDED /.test(spViewer.pages[0].caption)
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
        spStoredThumbs.length === 2 && spStoredThumbs[0].caption === 'FILE 1 VIEW REMOVE' && spStoredThumbs.every(t => /^blob:/.test(t.src))
        && spRmBand.includes('Deletes the source file you removed') && spRmBefore === 0
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
  const pcWhen = await page.evaluate(() => { const sc = loadRecipes().find(r => r.id === 'pc-one').sourceCheck; return sc && sc.validated ? formatDate(isoLocal(new Date(sc.validated))).toUpperCase() : null; });
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
  /* A tap in a form closed unsaved is not carried to the next form (pc-two has pc-one's lines, so a tap left
     over would match them); and lines typed after the tap but not yet re-read are not vouched for by SAVE. */
  await page.evaluate(() => openEditModal('pc-two'));
  await page.waitForTimeout(400);
  await anClick('#photoCheckRow [data-photo-check]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.evaluate(() => openEditModal('pc-two'));
  await page.waitForTimeout(400);
  const pcReopened = await pcRow();
  await anClick('#photoCheckRow [data-photo-check]');
  await page.evaluate(() => { const ta = document.getElementById('importInput'); ta.value = ta.value.replace('2 tbsp black treacle', '3 tbsp black treacle'); ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(300);
  const pcTypedBand = await anBeforeSave();
  const pcMarkT = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const pcTypedRow = ((await spRecipeWrites(pcMarkT)).pop() || { rows: [{}] }).rows[0];
  check('    a tap in a form closed unsaved is gone when it opens again, and lines typed after the tap are not saved as checked',
        pcReopened.check && !pcReopened.undo && !pcTypedBand.some(l => /photo/.test(l)) && pcTypedRow.id === 'pc-two' && !('source_check' in pcTypedRow),
        JSON.stringify([pcReopened, pcTypedBand, pcTypedRow.id, pcTypedRow.source_check]));
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
  await page.fill('#sourcePasteInput', '300 g rye flour\n3 tbsp black treacle');
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
  /* ---- PDF sources (asked 30 Sep 2026: a recipe page "printed" to PDF) ----
     Kept as it is, up to the bucket's 10 MB, opened by the browser; refused when too big or not a PDF. */
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
  await page.evaluate(() => {
    loadRecipes().push({ id: 'pdf-one', title: 'PDF Barley Broth', source: 'A printed page', sourceUrl: '', servings: 4, tags: { course: '', keywords: [] },
      history: [], dateAdded: '2026-09-06', sourceCheck: null, sourcePhotos: null,
      syntax: ['TITLE: PDF Barley Broth', 'SOURCE: A printed page', 'SERVINGS: 4', '', 'GROUP a:', '120 g pearl barley', '1 leek, sliced', '', 'STAGE:', 'MERGE a -> done: Simmer [45 min]'].join('\n') });
  });
  await page.evaluate(() => openEditModal('pdf-one'));
  await page.waitForTimeout(300);
  const pdfSMark0 = await spStorageMark();
  const pdfMark0 = await anMark();
  const pdfAccept = await page.evaluate(() => document.getElementById('sourcePhotoInput').accept);
  await page.setInputFiles('#sourcePhotoInput', [
    { name: 'barley-broth.pdf', mimeType: 'application/pdf', buffer: pdfBytes },
    { name: 'whole-book.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10.5 * 1024 * 1024)]) },
    { name: 'not-really.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>a saved page</html>') }]);
  // Waited for, not required: a PDF that never arrives must fail the check below by name, not time out here.
  await page.waitForFunction(() => formPhotos.length >= 1, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const pdfForm = await page.evaluate(() => ({ photos: formPhotos.map(p => ({ type: p.type || null, name: p.name || null, size: p.blob && p.blob.size })),
    toast: (document.querySelector('.toast') || { textContent: '' }).textContent,
    thumbs: [...document.querySelectorAll('#sourcePhotoList figure')].map(f => ({ caption: f.querySelector('figcaption').textContent.replace(/\s+/g, ' ').trim(),
      open: (f.querySelector('.pdf-open') || {}).href || '' })),
    compare: { card: !!document.querySelector('#sourcePhotoCompare .pdf-card'), button: ((document.querySelector('#photoCheckRow [data-photo-check]') || {}).textContent || '') } }));
  const pdfBand = await anBeforeSave();
  check('PDF SOURCES: ADD PHOTO OR PDF takes a PDF as it is, and refuses one over 10 MB and a file that is not a PDF',
        /application\/pdf/.test(pdfAccept) && pdfForm.photos.length === 1 && pdfForm.photos[0].type === 'pdf' && pdfForm.photos[0].name === 'barley-broth.pdf'
        && pdfForm.photos[0].size === pdfBytes.length && /over 10 MB/.test(pdfForm.toast)
        && (await anSince(pdfMark0)).length === 0 && (await spStorage(pdfSMark0)).length === 0, JSON.stringify([pdfAccept, pdfForm.photos, pdfForm.toast]));
  check('    it shows as a PDF with its name and an OPEN link, beside the lines too, named by BEFORE YOU SAVE, and the check reads "against the PDF"',
        pdfForm.thumbs.length === 1 && pdfForm.thumbs[0].caption === 'FILE 1 · PDF · NEW REMOVE' && /^blob:/.test(pdfForm.thumbs[0].open)
        && pdfForm.compare.card && pdfForm.compare.button === 'CHECKED AGAINST THE PDF' && pdfBand.includes('Stores the new source PDF with the recipe'),
        JSON.stringify([pdfForm.thumbs, pdfForm.compare, pdfBand]));
  await page.setInputFiles('#sourcePhotoInput', [{ name: 'renamed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html></html>') }]);
  await page.waitForTimeout(300);
  const pdfNotPdf = await page.evaluate(() => ({ n: formPhotos.length, toast: (document.querySelector('.toast') || { textContent: '' }).textContent }));
  const pdfSMark1 = await spStorageMark();
  const pdfMark1 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pdfUp = (await spStorage(pdfSMark1)).filter(s => s.op === 'upload');
  const pdfRow = ((await spRecipeWrites(pdfMark1)).pop() || { rows: [{}] }).rows[0];
  const pdfEntry = (pdfRow.source_photos || [])[0] || {};
  await page.evaluate(() => localPhotoUrls.clear());
  const pdfChip = await page.evaluate(() => (document.querySelector('#viewerProvenance [data-source-photos]') || {}).textContent || '');
  await anClick('#viewerProvenance [data-source-photos]');
  await page.waitForTimeout(300);
  const pdfViewer = await page.evaluate(() => ({ title: document.getElementById('sourcePhotoTitle').textContent,
    open: (document.querySelector('#sourcePhotoBody .pdf-open') || {}).href || '', target: (document.querySelector('#sourcePhotoBody .pdf-open') || {}).target || '',
    fullSize: /OPEN FULL SIZE/.test(document.getElementById('sourcePhotoBody').textContent) }));
  await page.keyboard.press('Escape');
  check('    SAVE stores it as a PDF, byte for byte, under a .pdf name, the row saying so; the chip reads SOURCE PDF and opens it in a new tab by a signed link',
        /not a PDF|Couldn't read that file/.test(pdfNotPdf.toast) && pdfNotPdf.n === 1
        && pdfUp.length === 1 && pdfUp[0].contentType === 'application/pdf' && pdfUp[0].size === pdfBytes.length && /\/pdf-one\/[^/]+\.pdf$/.test(pdfUp[0].path)
        && pdfEntry.type === 'pdf' && pdfEntry.name === 'barley-broth.pdf' && pdfEntry.path === pdfUp[0].path
        && pdfChip === 'SOURCE PDF' && /· SOURCE PDF$/.test(pdfViewer.title) && /^blob:/.test(pdfViewer.open) && pdfViewer.target === '_blank' && !pdfViewer.fullSize,
        JSON.stringify([pdfNotPdf, pdfUp, pdfEntry, pdfChip, pdfViewer]));
  // A photo added beside it: the PDF keeps what it is, and the chip counts files.
  await page.evaluate(() => openEditModal('pdf-one'));
  await page.waitForTimeout(300);
  await spPick([800, 600]);
  const pdfMark2 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const pdfMixed = (((await spRecipeWrites(pdfMark2)).pop() || { rows: [{}] }).rows[0].source_photos) || [];
  const pdfMixedChip = await page.evaluate(() => (document.querySelector('#viewerProvenance [data-source-photos]') || {}).textContent || '');
  check('    with a photo added beside it the PDF keeps its type and name, the photo has none, and the chip reads SOURCE FILES · 2',
        pdfMixed.length === 2 && pdfMixed[0].type === 'pdf' && pdfMixed[0].name === 'barley-broth.pdf' && !('type' in pdfMixed[1]) && /\.jpg$/.test(pdfMixed[1].path)
        && pdfMixedChip === 'SOURCE FILES · 2', JSON.stringify([pdfMixed, pdfMixedChip]));
  await page.evaluate(() => { for(let i = loadRecipes().length - 1; i >= 0; i--) if(loadRecipes()[i].id === 'pdf-one') loadRecipes().splice(i, 1); showView('recipes'); });
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

  /* ---- Cooking notes (R4, docs/PLAN-COOKING-NOTES.md, 30 Sep 2026) ----
     A running log per recipe: one row per note, dated when written, newest first; kept while cooking;
     a box after cooking; FOLD INTO NOTES moves one into the recipe's text on SAVE. An invented recipe. */
  await page.evaluate(() => {
    loadRecipes().push({ id: 'cn-one', title: 'CN Butter Bean Stew', source: 'A family card', sourceUrl: '', servings: 4, tags: { course: '', keywords: [] },
      history: [], dateAdded: '2026-09-06', sourceCheck: null, sourcePhotos: null,
      syntax: ['TITLE: CN Butter Bean Stew', 'SOURCE: A family card', 'SERVINGS: 4', '', 'GROUP a:', '400 g butter beans', '1 tbsp rose harissa', '',
        'STAGE:', 'MERGE a -> done: Simmer [20 min]', '', 'NOTES:', 'Serve with warm flatbread.', '', 'TIPS:', 'Keeps for two days.'].join('\n') });
    window.__LOG__.length = 0;
  });
  const cnRows = mark => page.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'recipe_notes')
    .map(w => ({ op: w.op, rows: w.rows || null, patch: w.patch || null, eqs: w.eqs || null })), mark);
  const cnLog = () => page.evaluate(() => [...document.querySelectorAll('#cookingNotes .cn-item')].filter(li => getComputedStyle(li).display !== 'none')
    .map(li => ({ date: (li.querySelector('.cn-date') || {}).textContent || '', body: ((li.querySelector('.cn-body') || {}).textContent || '') })));
  const cnChip = () => page.evaluate(() => (document.querySelector('#viewerProvenance [data-cook-notes]') || {}).textContent || '');
  await page.evaluate(() => openRecipe('cn-one', 'recipes'));
  await page.waitForTimeout(300);
  const cnHouse = await page.evaluate(() => HOUSEHOLD_ID);
  const cnToday = await page.evaluate(() => noteDateLabel(new Date().toISOString()));
  const cnEmpty = { log: await cnLog(), chip: await cnChip(), empty: await page.isVisible('#cookingNotes .cn-empty') };
  const cnMark0 = await anMark();
  await page.fill('#cookNoteInput', '   ');
  await page.click('#cookNoteAddBtn');
  const cnBlank = (await cnRows(cnMark0)).length;
  await page.fill('#cookNoteInput', '  Needed 10 min longer in our oven  ');
  await page.click('#cookNoteAddBtn');
  await page.waitForTimeout(250);
  const cnAdd = await cnRows(cnMark0);
  const cnAddRow = ((cnAdd[0] || {}).rows || [])[0] || {};
  check('COOKING NOTES: ADD writes one row for the note, trimmed and dated now, shows it at the top with the date, and the header chip counts it; a blank box adds nothing',
        cnEmpty.log.length === 0 && cnEmpty.chip === '' && cnEmpty.empty && cnBlank === 0
        && cnAdd.length === 1 && cnAdd[0].op === 'upsert' && cnAdd[0].rows.length === 1 && cnAddRow.recipe_id === 'cn-one' && cnAddRow.household_id === cnHouse
        && cnAddRow.body === 'Needed 10 min longer in our oven' && !isNaN(Date.parse(cnAddRow.created_at)) && typeof cnAddRow.id === 'string'
        && JSON.stringify(await cnLog()) === JSON.stringify([{ date: cnToday, body: 'Needed 10 min longer in our oven' }]) && (await cnChip()) === 'NOTES · 1'
        && /^\d{1,2} [A-Z]{3} \d{4}$/.test(cnToday), JSON.stringify([cnEmpty, cnBlank, cnAdd, cnToday]));
  await page.evaluate(() => {
    ['2026-09-01', '2026-09-03', '2026-09-02', '2026-08-20'].forEach((d, i) => cache.recipeNotes.push({ id: 'cn-old-' + i, recipeId: 'cn-one', body: 'Older note ' + d, createdAt: d + 'T18:00:00.000Z' }));
    renderViewer();
  });
  const cnThree = await cnLog();
  const cnMoreText = await page.evaluate(() => (document.querySelector('#cookingNotes [data-note-more]') || {}).textContent || '');
  await anClick('#cookingNotes [data-note-more]');   // a click that may find nothing, so a missing button fails the check below by name
  const cnAll = await cnLog();
  check('    newest first, the latest three shown with SHOW ALL for the rest, and the chip counts them all',
        cnThree.length === 3 && cnThree[0].body === 'Needed 10 min longer in our oven' && cnThree[1].body === 'Older note 2026-09-03' && cnThree[2].body === 'Older note 2026-09-02'
        && cnMoreText === 'SHOW ALL 5 NOTES' && cnAll.length === 5 && cnAll[4].body === 'Older note 2026-08-20' && cnAll[4].date === '20 AUG 2026' && (await cnChip()) === 'NOTES · 5',
        JSON.stringify([cnThree, cnMoreText, cnAll]));
  // EDIT the text (never the date); DELETE with UNDO.
  const cnMark1 = await anMark();
  await page.click('#cookingNotes .cn-item[data-note-id="cn-old-1"] [data-note-edit]');
  await page.fill('#cookingNotes .cn-edit', 'Older note, now edited');
  await page.click('#cookingNotes [data-note-save]');
  await page.waitForTimeout(200);
  const cnEdit = await cnRows(cnMark1);
  const cnEdited = await page.evaluate(() => cache.recipeNotes.find(n => n.id === 'cn-old-1'));
  const cnMark2 = await anMark();
  await page.click('#cookingNotes .cn-item[data-note-id="cn-old-1"] [data-note-delete]');
  await page.waitForTimeout(150);
  const cnGone = await page.evaluate(() => ({ cache: cache.recipeNotes.some(n => n.id === 'cn-old-1'), shown: !!document.querySelector('#cookingNotes [data-note-id="cn-old-1"]'),
    undo: !!document.querySelector('#cookingNotes [data-note-undo]') }));
  await page.click('#cookingNotes [data-note-undo]');
  await page.waitForTimeout(200);
  const cnDelUndo = await cnRows(cnMark2);
  const cnBack = await page.evaluate(() => cache.recipeNotes.find(n => n.id === 'cn-old-1'));
  const cnScoped = w => JSON.stringify(w.eqs) === JSON.stringify([{ column: 'household_id', value: cnHouse }, { column: 'id', value: 'cn-old-1' }]);
  check('    EDIT sends the new text alone, to that one note, and keeps its date; DELETE is one note\'s delete with UNDO, which puts the same note back',
        cnEdit.length === 1 && cnEdit[0].op === 'update' && JSON.stringify(cnEdit[0].patch) === JSON.stringify({ body: 'Older note, now edited' }) && cnScoped(cnEdit[0])
        && cnEdited.createdAt === '2026-09-03T18:00:00.000Z' && !cnGone.cache && !cnGone.shown && cnGone.undo
        && cnDelUndo.length === 2 && cnDelUndo[0].op === 'delete' && cnScoped(cnDelUndo[0]) && cnDelUndo[1].op === 'upsert'
        && cnDelUndo[1].rows[0].id === 'cn-old-1' && cnDelUndo[1].rows[0].created_at === '2026-09-03T18:00:00.000Z' && cnDelUndo[1].rows[0].body === 'Older note, now edited'
        && cnBack && cnBack.body === 'Older note, now edited', JSON.stringify([cnEdit, cnEdited, cnGone, cnDelUndo]));
  // Cooking mode keeps the box and the latest line; print leaves the notes out.
  await anClick('#cookingNotes [data-note-more]');   // back to the latest three, as a cook would find it
  await page.evaluate(() => { state.keepAwake = true; updateKeepAwakeStatus(); });
  await page.waitForTimeout(150);
  const cnCooking = await page.evaluate(() => ({ box: document.getElementById('cookNoteInput').offsetParent !== null,
    add: document.getElementById('cookNoteAddBtn').offsetParent !== null,
    lines: [...document.querySelectorAll('#cookingNotes .cn-item')].filter(li => getComputedStyle(li).display !== 'none').length,
    actions: [...document.querySelectorAll('#cookingNotes .cn-actions')].filter(a => getComputedStyle(a).display !== 'none').length }));
  await page.evaluate(() => { state.keepAwake = false; updateKeepAwakeStatus(); });
  await page.emulateMedia({ media: 'print' });
  const cnPrint = await page.evaluate(() => getComputedStyle(document.getElementById('cookingNotes')).display);
  await page.emulateMedia({ media: 'screen' });
  const cnInFlow = await page.evaluate(() => !!document.querySelector('#flowMount #cookingNotes'));
  check('    while cooking the box stays with the latest note only and nothing to edit; PRINT and EXPORT PNG leave the notes out',
        cnCooking.box && cnCooking.add && cnCooking.lines === 1 && cnCooking.actions === 0 && cnPrint === 'none' && !cnInFlow, JSON.stringify([cnCooking, cnPrint, cnInFlow]));
  // After cooking: the meal prompt's box adds a note to that recipe, dated today; nothing when empty.
  const cnMark3 = await anMark();
  await page.evaluate(() => logRecipeUsed('cn-one'));
  await page.waitForTimeout(200);
  const cnPrompt = await page.evaluate(() => ({ open: document.getElementById('mealTypeOverlay').classList.contains('open'), row: !document.getElementById('mealTypeNoteRow').hidden }));
  await page.fill('#mealTypeNote', 'Halve the harissa next time');
  await page.click('#mealTypeChoices .meal-type-btn');
  await page.waitForTimeout(250);
  const cnAfter = await cnRows(cnMark3);
  const cnAfterToast = await page.evaluate(() => (document.querySelector('.toast') || { textContent: '' }).textContent);
  const cnAfterTop = (await cnLog())[0] || {};
  await page.evaluate(() => { promptForMealType('no-recipe-entry', 'A takeaway'); });
  const cnAdHocRow = await page.evaluate(() => !document.getElementById('mealTypeNoteRow').hidden);
  const cnMark4 = await anMark();
  await page.click('#mealTypeSkip');
  await page.waitForTimeout(150);
  const cnSkipRows = (await cnRows(cnMark4)).length;
  check('    after cooking, the meal prompt has a note box: what is typed becomes a note on that recipe, dated today; none for an entry with no recipe, and SKIP with it empty adds none',
        cnPrompt.open && cnPrompt.row && cnAfter.length === 1 && cnAfter[0].rows[0].recipe_id === 'cn-one' && cnAfter[0].rows[0].body === 'Halve the harissa next time'
        && /note added/.test(cnAfterToast) && cnAfterTop.body === 'Halve the harissa next time' && cnAfterTop.date === cnToday && !cnAdHocRow && cnSkipRows === 0,
        JSON.stringify([cnPrompt, cnAfter, cnAfterToast, cnAfterTop, cnAdHocRow, cnSkipRows]));
  // FOLD INTO NOTES: pending until SAVE; SAVE writes the text, then deletes the note; closing changes nothing.
  const cnFoldId = await page.evaluate(() => cache.recipeNotes.find(n => n.body === 'Needed 10 min longer in our oven').id);
  const cnFoldLine = await page.evaluate(id => foldedNoteLine(cache.recipeNotes.find(n => n.id === id)), cnFoldId);
  const cnMark5 = await anMark();
  await page.click(`#cookingNotes [data-note-id="${cnFoldId}"] [data-note-fold]`);
  await page.waitForTimeout(400);
  const cnFoldText = await page.evaluate(() => document.getElementById('importInput').value.split('\n'));
  const cnFoldBand = await anBeforeSave();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const cnClosed = { writes: (await anSince(cnMark5)).length, kept: await page.evaluate(id => cache.recipeNotes.some(n => n.id === id), cnFoldId),
    pending: await page.evaluate(() => pendingFold) };
  const cnNotesAt = cnFoldText.indexOf('NOTES:');
  check('    FOLD INTO NOTES opens EDIT with the note dated at the end of NOTES:, before TIPS:, named by BEFORE YOU SAVE; closing the form writes nothing and keeps the note',
        cnNotesAt > 0 && cnFoldText[cnNotesAt + 1] === 'Serve with warm flatbread.' && cnFoldText[cnNotesAt + 2] === cnFoldLine && cnFoldText.indexOf('TIPS:') > cnNotesAt + 2
        && /: Needed 10 min longer in our oven$/.test(cnFoldLine) && cnFoldBand.includes('Adds the cooking note to NOTES: and takes it out of the log')
        && cnClosed.writes === 0 && cnClosed.kept && cnClosed.pending === null, JSON.stringify([cnFoldText, cnFoldLine, cnFoldBand, cnClosed]));
  await page.evaluate(() => openRecipe('cn-one', 'recipes'));
  await page.waitForTimeout(250);
  await page.click(`#cookingNotes [data-note-id="${cnFoldId}"] [data-note-fold]`);
  await page.waitForTimeout(400);
  const cnMark6 = await anMark();
  await page.evaluate(() => { window.__LOG__.length = 0; });
  await page.click('#saveBtn');
  await page.waitForTimeout(600);
  const cnSaved = await page.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'recipes' || w.table === 'recipe_notes')
    .map(w => ({ table: w.table, op: w.op, syntax: w.rows && w.rows[0] && w.rows[0].syntax, eqs: w.eqs })), cnMark6);
  const cnSavedOrder = await page.evaluate(() => window.__LOG__.filter(l => /^write-done:(recipes|recipe_notes)$/.test(l)));
  const cnAfterFold = { cache: await page.evaluate(id => cache.recipeNotes.some(n => n.id === id), cnFoldId), log: (await cnLog()).map(l => l.body) };
  check('    SAVE writes the recipe with the line, then deletes that note, and the log no longer shows it',
        cnSaved.length === 2 && cnSaved[0].table === 'recipes' && cnSaved[0].syntax.split('\n').includes(cnFoldLine)
        && cnSaved[1].table === 'recipe_notes' && cnSaved[1].op === 'delete' && JSON.stringify(cnSaved[1].eqs) === JSON.stringify([{ column: 'household_id', value: cnHouse }, { column: 'id', value: cnFoldId }])
        && cnSavedOrder.join(',') === 'write-done:recipes,write-done:recipe_notes' && !cnAfterFold.cache && !cnAfterFold.log.includes('Needed 10 min longer in our oven'),
        JSON.stringify([cnSaved, cnSavedOrder, cnAfterFold]));
  // The line taken out again before SAVE: the note stays in the log.
  const cnKeepId = await page.evaluate(() => cache.recipeNotes.find(n => n.body === 'Halve the harissa next time').id);
  await page.click(`#cookingNotes [data-note-id="${cnKeepId}"] [data-note-fold]`);
  await page.waitForTimeout(400);
  await page.evaluate(id => { const ta = document.getElementById('importInput'); const line = foldedNoteLine(cache.recipeNotes.find(n => n.id === id));
    ta.value = ta.value.split('\n').filter(l => l !== line).join('\n'); ta.dispatchEvent(new Event('input', { bubbles: true })); }, cnKeepId);
  await page.waitForTimeout(300);
  const cnKeepBand = await anBeforeSave();
  const cnMark7 = await anMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  const cnKept = { deletes: (await cnRows(cnMark7)).length, cache: await page.evaluate(id => cache.recipeNotes.some(n => n.id === id), cnKeepId) };
  check('    and a folded line taken out again before SAVE leaves the note where it was',
        !cnKeepBand.some(l => /cooking note/.test(l)) && cnKept.deletes === 0 && cnKept.cache, JSON.stringify([cnKeepBand, cnKept]));
  // Export carries them; deleting the recipe says how many go with it and drops them from the cache.
  const cnExport = await page.evaluate(() => { let payload = null; const real = window.Blob;
    window.Blob = function(parts){ payload = JSON.parse(parts[0]); return new real(parts); };
    try { exportAllData(); } catch(e){} window.Blob = real; return payload && payload.recipeNotes ? payload.recipeNotes.filter(n => n.recipeId === 'cn-one').length : -1; });
  const cnCount = await page.evaluate(() => notesForRecipe('cn-one').length);
  const cnConfirm = await page.evaluate(() => { let msg = ''; const real = window.confirm; window.confirm = m => { msg = m; return true; };
    document.getElementById('deleteBtn').click(); window.confirm = real; return msg; });
  const cnDeleted = await page.evaluate(() => cache.recipeNotes.filter(n => n.recipeId === 'cn-one').length);
  check('    the export carries the notes, and deleting the recipe says its notes go with it and drops them',
        cnExport === cnCount && cnCount === 5 && new RegExp(`Its ${cnCount} cooking notes go with it`).test(cnConfirm) && cnDeleted === 0, JSON.stringify([cnExport, cnCount, cnConfirm, cnDeleted]));
  // Import: notes restored, but only on recipes the file restores.
  const cnImport = await page.evaluate(async () => {
    const real = window.confirm; window.confirm = () => true;
    const base = { app: 'Kitchen', version: 3, exportedAt: new Date().toISOString(), plan: {}, shortlist: [], keywordVocab: [], shoppingChecked: {}, swaps: [], groups: [], aliases: [], diary: [],
      recipes: [{ id: 'cn-imp', title: 'CN Import', source: 'A family card', sourceUrl: '', servings: 2, tags: { course: '', keywords: [] }, history: [], dateAdded: '2026-09-06',
        syntax: 'TITLE: CN Import\nSOURCE: A family card\nSERVINGS: 2\n\nGROUP a:\n1 leek\n\nSTAGE:\nMERGE a -> done: Cook [5 min]' }],
      recipeNotes: [{ id: 'cn-imp-1', recipeId: 'cn-imp', body: 'Kept', createdAt: '2026-09-10T10:00:00.000Z' },
        { id: 'cn-imp-2', recipeId: 'not-in-the-file', body: 'Dropped', createdAt: '2026-09-10T10:00:00.000Z' }] };
    const mark = window.__WRITES__.length;
    importAllData(new File([JSON.stringify(base)], 'backup.json', { type: 'application/json' }));
    await new Promise(r => setTimeout(r, 800));
    window.confirm = real;
    const w = window.__WRITES__.slice(mark).filter(x => x.table === 'recipe_notes' && x.op === 'upsert').flatMap(x => x.rows);
    return { cache: cache.recipeNotes.map(n => n.id), rows: w.map(r => r.id) };
  });
  check('    an import restores the notes on the recipes it restores, and drops a note whose recipe is not in the file',
        JSON.stringify(cnImport.cache) === JSON.stringify(['cn-imp-1']) && JSON.stringify(cnImport.rows) === JSON.stringify(['cn-imp-1']), JSON.stringify(cnImport));
  // The table unreadable: no one is signed out, the viewer says so, and nothing offers a write that would fail.
  const cnSignouts = await page.evaluate(() => window.__SIGNOUTS__);
  const cnMissing = await page.evaluate(async () => { window.__MISSING_TABLES__ = ['recipe_notes'];
    try { const ok = await hydrate(); return { ok, available: recipeNotesAvailable }; } catch(e){ return { threw: String(e && e.message || e) }; } });
  await page.evaluate(() => { openRecipe(loadRecipes()[0].id, 'recipes'); promptForMealType('x', 'A recipe', loadRecipes()[0].id); });
  await page.waitForTimeout(250);
  const cnMissingUi = await page.evaluate(() => ({ text: document.getElementById('cookingNotes').textContent, box: !!document.getElementById('cookNoteInput'),
    prompt: !document.getElementById('mealTypeNoteRow').hidden }));
  await page.evaluate(() => { document.getElementById('mealTypeSkip').click(); });
  const cnMissingExport = await page.evaluate(() => { let payload = null; const real = window.Blob;
    window.Blob = function(parts){ payload = JSON.parse(parts[0]); return new real(parts); };
    try { exportAllData(); } catch(e){} window.Blob = real; return payload ? ('recipeNotes' in payload) : 'no export'; });
  check('    with the notes unreadable the load carries on and signs nobody out; the viewer says so, with no box, the prompt has none, and export leaves the key out',
        cnMissing.ok === true && cnMissing.available === false && (await page.evaluate(() => window.__SIGNOUTS__)) === cnSignouts
        && /can't be loaded/.test(cnMissingUi.text) && !cnMissingUi.box && !cnMissingUi.prompt && cnMissingExport === false,
        JSON.stringify([cnMissing, cnMissingUi, cnMissingExport]));
  await page.evaluate(async () => { window.__MISSING_TABLES__ = []; await hydrate(); showView('recipes'); renderHome(); });

  /* ---- The calendar push, P3 PR 2 (docs/PLAN-CALENDAR-PUSH.md §9; added 9 Oct 2026) ----
     Three states, each as the live app meets it: before the migration (the default fixture: the stub
     reads calendar_connections as not created), the migration in but not connected, and connected.
     calendar-sync and calendar-auth are the stub's invoke, answered per check; 'invoke:<name>' in __LOG__
     is what shows the Planner write landed before the sync was asked for. */
  const calDrain = () => page.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue); });
  const calMark = () => page.evaluate(() => ({ w: window.__WRITES__.length, i: window.__INVOKES__.length, l: window.__LOG__.length }));
  const calSince = m => page.evaluate(m => ({
    plan: window.__WRITES__.slice(m.w).filter(w => w.table === 'planner_days'),
    settings: window.__WRITES__.slice(m.w).filter(w => w.table === 'household_settings').flatMap(w => w.rows || []),
    syncs: window.__INVOKES__.slice(m.i).filter(c => c.name === 'calendar-sync').map(c => c.body),
    auths: window.__INVOKES__.slice(m.i).filter(c => c.name === 'calendar-auth').map(c => c.body),
    log: window.__LOG__.slice(m.l)
  }), m);
  const calToast = () => page.evaluate(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; });
  const calPlanRow = (s, date) => { const ups = s.plan.filter(w => w.op === 'upsert').flatMap(w => w.rows).filter(r => r.plan_date === date); return ups[ups.length - 1] || null; };
  const CAL_CONNECTED = { household_id: '286a8a12-c12a-4b83-afbc-0912533f6b1c', connected: true, google_email: 'cook@example.test',
    calendar_id: 'made-up-calendar@group.calendar.google.com', scope: 'https://www.googleapis.com/auth/calendar.app.created openid email',
    connected_at: '2026-09-21T18:00:00.000Z', last_sync_at: null, last_error: null, updated_at: '2026-09-21T18:00:00.000Z' };
  const calOk = () => page.evaluate(() => { window.__INVOKE_REPLY__ = call => call.name === 'calendar-sync'
    ? { data: { ok: true, put: 1, deleted: 0 }, error: null } : { data: null, error: null }; });

  // Before the migration: a fresh page on the default fixture, exactly as the live app is today.
  const calPre = await browser.newPage();
  calPre.__label = 'calendar, before';
  await calPre.clock.setFixedTime(FIXTURE_NOW);
  await calPre.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await calPre.waitForTimeout(1200);
  const calPreState = await calPre.evaluate(async () => {
    const m = window.__WRITES__.length;
    const d = isoLocal(dayList()[0]);
    setPlanServingsAt(d, 0, 6);
    setSetting('weekStartDay', 5);
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    const ws = window.__WRITES__.slice(m);
    const planRows = ws.filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows);
    const setRows = ws.filter(w => w.table === 'household_settings').flatMap(w => w.rows);
    showView('planner');
    const switches = document.querySelectorAll('#dayList .day-cal, #dayList .week-cal').length;
    showView('settings'); showSettingsTab('app');
    return { gate: !document.getElementById('loginGate').hidden, signouts: window.__SIGNOUTS__, available: calendarAvailable,
      planKeys: planRows.length ? Object.keys(planRows[0]).filter(k => /calendar/.test(k)) : ['NO ROW'],
      setKeys: setRows.length ? Object.keys(setRows[0]).filter(k => /calendar/.test(k)) : ['NO ROW'],
      switches, text: document.getElementById('calendarSettings').textContent.replace(/\s+/g, ' ').trim(),
      connect: !!document.getElementById('calConnectBtn'), syncs: window.__INVOKES__.filter(c => /^calendar/.test(c.name)).length };
  });
  check('calendar, before the migration: the load carries on and signs nobody out, and the feature reads as unavailable',
        !calPreState.gate && calPreState.signouts === 0 && calPreState.available === false, JSON.stringify(calPreState));
  check('    a Planner save and a settings save name no calendar column, no switches show, and nothing calls the calendar',
        calPreState.planKeys.length === 0 && calPreState.setKeys.length === 0 && calPreState.switches === 0 && calPreState.syncs === 0,
        JSON.stringify(calPreState));
  check('    Settings → App → CALENDAR says it is waiting for the database change, and offers no CONNECT',
        /Waiting for the database change/.test(calPreState.text) && !calPreState.connect, calPreState.text);
  await calPre.close();

  // Available, not connected.
  await page.evaluate(async () => { window.__MISSING_TABLES__ = []; window.__STUB_DATA__.calendar_connections = []; await hydrate();
    window.__INVOKES__.length = 0; window.__INVOKE_REPLY__ = null; });
  const calD0 = await page.evaluate(() => isoLocal(dayList()[0]));
  const calD1 = await page.evaluate(() => isoLocal(dayList()[1]));
  let calM = await calMark();
  await page.evaluate(d => { setPlanServingsAt(d, 0, 6); setSetting('remindAt', 1200); showView('planner'); }, calD0);
  await calDrain();
  let calS = await calSince(calM);
  const calNcSwitches = await page.locator('#dayList .day-cal, #dayList .week-cal').count();
  /* Since 12 Oct 2026 (F42) a setting sends its own column only, so the reminder time is the one set here. */
  check('calendar, migration in but not connected: a Planner save sends the switch off, settings send 20:00 and only that, no switches show, nothing is synced',
        calPlanRow(calS, calD0) && calPlanRow(calS, calD0).calendar === false && calPlanRow(calS, calD0).calendar_remind === false
        && calS.settings.length && calS.settings[0].calendar_remind_at === 1200 && !('week_start_day' in calS.settings[0])
        && calNcSwitches === 0 && calS.syncs.length === 0,
        JSON.stringify([calPlanRow(calS, calD0), calS.settings, calNcSwitches, calS.syncs]));
  await page.evaluate(() => { showView('settings'); showSettingsTab('app');
    window.__WENT__ = null; window.__REAL_GO__ = goToGoogle; window.goToGoogle = url => { window.__WENT__ = url; };
    window.__INVOKE_REPLY__ = call => call.name === 'calendar-auth' ? { data: { url: 'https://accounts.example.test/consent?state=made-up' }, error: null } : { data: null, error: null }; });
  calM = await calMark();
  await page.click('#calConnectBtn');
  await page.waitForTimeout(300);
  calS = await calSince(calM);
  const calWent = await page.evaluate(() => window.__WENT__);
  check('    CONNECT GOOGLE CALENDAR asks calendar-auth to start, coming back to this page, and goes to the address it returns',
        calS.auths.length === 1 && calS.auths[0].action === 'start' && /\/app-under-test\.html$/.test(calS.auths[0].returnTo || '')
        && calWent === 'https://accounts.example.test/consent?state=made-up', JSON.stringify([calS.auths, calWent]));

  // Connected.
  await page.evaluate(async c => { window.__STUB_DATA__.calendar_connections = [c]; await hydrate(); window.__INVOKES__.length = 0; showView('planner'); }, CAL_CONNECTED);
  await calOk();
  calM = await calMark();
  await page.click(`.day-row[data-date="${calD0}"] [data-action="calToggle"]`);
  await calDrain();
  calS = await calSince(calM);
  const calOrder = { write: calS.log.lastIndexOf('write-done:planner_days'), invoke: calS.log.indexOf('invoke:calendar-sync') };
  check('calendar, connected: IN CALENDAR saves the day switched on, then asks calendar-sync for that day, after the Planner write has landed',
        calPlanRow(calS, calD0) && calPlanRow(calS, calD0).calendar === true && calS.syncs.length === 1
        && JSON.stringify(calS.syncs[0]) === JSON.stringify({ dates: [calD0] }) && calOrder.write !== -1 && calOrder.write < calOrder.invoke,
        JSON.stringify([calPlanRow(calS, calD0), calS.syncs, calS.log]));
  const calRemindLabel = await page.locator(`.day-row[data-date="${calD0}"] [data-action="calRemind"]`).textContent();
  calM = await calMark();
  await page.click(`.day-row[data-date="${calD0}"] [data-action="calRemind"]`);
  await calDrain();
  calS = await calSince(calM);
  check('    REMIND ME shows the household\'s time, saves calendar_remind and syncs the day',
        /REMIND ME 20:00 THE EVENING BEFORE/.test(calRemindLabel) && calPlanRow(calS, calD0) && calPlanRow(calS, calD0).calendar_remind === true
        && JSON.stringify(calS.syncs) === JSON.stringify([{ dates: [calD0] }]), JSON.stringify([calRemindLabel, calPlanRow(calS, calD0), calS.syncs]));
  calM = await calMark();
  await page.evaluate(([a, b]) => { setPlanServingsAt(a, 0, 3); setPlanServingsAt(b, 0, 3); }, [calD0, calD1]);
  await calDrain();
  calS = await calSince(calM);
  check('    a servings change keeps the switches and syncs a switched-on day; on a day that is off nothing is sent to the calendar',
        calPlanRow(calS, calD0) && calPlanRow(calS, calD0).calendar === true && calPlanRow(calS, calD0).calendar_remind === true
        && calPlanRow(calS, calD1) && calPlanRow(calS, calD1).calendar === false && JSON.stringify(calS.syncs) === JSON.stringify([{ dates: [calD0] }]),
        JSON.stringify([calPlanRow(calS, calD0), calPlanRow(calS, calD1), calS.syncs]));
  calM = await calMark();
  await page.evaluate(d => setPlanBlank(d), calD0);
  await calDrain();
  calS = await calSince(calM);
  const calAwayEntry = await page.evaluate(d => cache.plan[d], calD0);
  check('    marking a day away drops its switches, saves them off and syncs it, which removes the event',
        calPlanRow(calS, calD0) && calPlanRow(calS, calD0).is_blank === true && calPlanRow(calS, calD0).calendar === false
        && !calAwayEntry.calendar && JSON.stringify(calS.syncs) === JSON.stringify([{ dates: [calD0] }]), JSON.stringify([calPlanRow(calS, calD0), calAwayEntry, calS.syncs]));
  await page.evaluate(d => setPlanCalendar(d, true), calD1);
  await calDrain();
  calM = await calMark();
  const calKept = await page.evaluate(d => { removePlanRecipeAt(d, 1); return !!cache.plan[d].calendar; }, calD1);
  await page.evaluate(d => removePlanRecipeAt(d, 0), calD1);
  await calDrain();
  calS = await calSince(calM);
  check('    taking one recipe off a switched-on day keeps it on; emptying it deletes the row and syncs it',
        calKept && calS.plan.some(w => w.op === 'delete' && (w.eqs || []).some(e => e.column === 'plan_date' && e.value === calD1))
        && JSON.stringify(calS.syncs) === JSON.stringify([{ dates: [calD1] }, { dates: [calD1] }]), JSON.stringify([calKept, calS.plan.map(w => w.op), calS.syncs]));

  // ADD THE WEEK: the second week (a whole week from Friday), three days planned and off.
  const calWeek = await page.evaluate(() => { const wk = groupDaysByWeek(dayList())[1].map(isoLocal).slice(0, 3);
    const r1 = loadRecipes().find(r => r.title === 'Test Pasta').id; wk.forEach(d => addPlanRecipe(d, r1)); renderPlanner(); return wk; });
  await calDrain();
  calM = await calMark();
  await page.click(`.week-cal[data-dates*="${calWeek[0]}"]`);
  await calDrain();
  calS = await calSince(calM);
  const calWeekLeft = await page.locator(`.week-cal[data-dates*="${calWeek[0]}"]`).count();
  check('    ADD THE WEEK switches every planned day of the week on and makes ONE call for all of them, after their Planner writes',
        calWeek.every(d => calPlanRow(calS, d) && calPlanRow(calS, d).calendar === true) && calS.syncs.length === 1
        && JSON.stringify(calS.syncs[0]) === JSON.stringify({ dates: calWeek.slice().sort() })
        && calS.log.lastIndexOf('write-done:planner_days') < calS.log.indexOf('invoke:calendar-sync') && calWeekLeft === 0,
        JSON.stringify([calS.syncs, calS.log, calWeekLeft]));

  // A title edit: the recipe's switched-on days from today, not a past one.
  const calPast = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 3); const iso = isoLocal(d);
    cache.plan[iso] = { recipeIds: [loadRecipes().find(r => r.title === 'Test Pasta').id], servings: [0], calendar: true }; return iso; });
  const calR1 = await page.evaluate(() => loadRecipes().find(r => r.title === 'Test Pasta').id);
  await page.evaluate(id => openEditModal(id), calR1);
  await page.waitForTimeout(350);
  await page.fill('#f-title', 'Test Pasta, Renamed');
  calM = await calMark();
  await page.click('#saveBtn');
  await page.waitForTimeout(400);
  await calDrain();
  calS = await calSince(calM);
  check('    a recipe\'s title edited through the form syncs its switched-on days from today (never a past one), after the recipe\'s write',
        JSON.stringify(calS.syncs) === JSON.stringify([{ dates: calWeek.slice().sort() }]) && !JSON.stringify(calS.syncs).includes(calPast)
        && calS.log.indexOf('write-done:recipes') !== -1 && calS.log.indexOf('write-done:recipes') < calS.log.indexOf('invoke:calendar-sync'),
        JSON.stringify([calS.syncs, calS.log]));
  await page.evaluate(d => { delete cache.plan[d]; rebuildCalendarDates(); showView('planner'); }, calPast);

  // Google refuses the connection: said, and not sent again.
  await page.evaluate(() => { window.__INVOKE_REPLY__ = call => call.name === 'calendar-sync'
    ? { data: { error: 'Google no longer accepts the connection', reconnect: true }, error: null } : { data: null, error: null }; });
  calM = await calMark();
  await page.click(`.day-row[data-date="${calWeek[0]}"] [data-action="calToggle"]`);
  await calDrain();
  const calRcToast = await calToast();
  await page.evaluate(() => { setSetting('weekStartDay', 5); });
  await calDrain();
  calS = await calSince(calM);
  const calRc = await page.evaluate(() => ({ connected: calendarConn.connected, failed: failedWrites.map(f => f.label), unsent: [...unsentLabels],
    switches: (renderPlanner(), document.querySelectorAll('#dayList .day-cal').length) }));
  await page.evaluate(() => { showView('settings'); showSettingsTab('app'); });
  const calRcSettings = await page.evaluate(() => ({ connect: !!document.getElementById('calConnectBtn'), text: document.getElementById('calendarSettings').textContent }));
  check('    an answer of reconnect is shown in words, CONNECT comes back, the switches go, and it is NOT sent again by the next write',
        calS.syncs.length === 1 && /CONNECT GOOGLE CALENDAR again/.test(calRcToast) && calRc.connected === false && !calRc.failed.includes('the calendar')
        && !calRc.unsent.includes('the calendar') && calRc.switches === 0 && calRcSettings.connect && /no longer accepts/.test(calRcSettings.text),
        JSON.stringify([calS.syncs.length, calRcToast, calRc, calRcSettings]));

  // A dead network: retried with the same days.
  await page.evaluate(() => { calendarConn.connected = true; calendarConn.last_error = null; showView('planner');
    window.__INVOKE_REPLY__ = call => call.name === 'calendar-sync'
      ? { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' } } : { data: null, error: null }; });
  calM = await calMark();
  const calNfErrors = errors.length;
  await page.click(`.day-row[data-date="${calWeek[1]}"] [data-action="calToggle"]`);
  await calDrain();
  /* The deliberate failure logs 'Sync failed', which this suite otherwise counts as an app fault: only that, only here. */
  for (let i = errors.length - 1; i >= calNfErrors; i--) if (/Sync failed: the calendar/.test(errors[i])) errors.splice(i, 1);
  const calNf = await page.evaluate(() => ({ failed: failedWrites.map(f => f.label), toast: document.querySelector('.toast').textContent }));
  await calOk();
  await page.evaluate(() => flushFailedWrites());
  await calDrain();
  calS = await calSince(calM);
  const calNfAfter = await page.evaluate(() => ({ failed: failedWrites.map(f => f.label), unsent: [...unsentLabels] }));
  check('    a network failure is kept and sent again, the same days, once the network is back',
        calNf.failed.includes('the calendar') && /Couldn't save the calendar/.test(calNf.toast) && calS.syncs.length === 2
        && JSON.stringify(calS.syncs[0]) === JSON.stringify({ dates: [calWeek[1]] }) && JSON.stringify(calS.syncs[1]) === JSON.stringify(calS.syncs[0])
        && !calNfAfter.failed.length && !calNfAfter.unsent.includes('the calendar'), JSON.stringify([calNf, calS.syncs, calNfAfter]));

  // Settings: who, REMIND AT, SYNC NOW.
  await page.evaluate(() => { showView('settings'); showSettingsTab('app'); });
  const calSet = await page.evaluate(() => ({ text: document.getElementById('calendarSettings').textContent.replace(/\s+/g, ' '),
    opts: [...document.querySelectorAll('#calRemindAt option')].map(o => o.textContent), value: document.getElementById('calRemindAt').value }));
  calM = await calMark();
  await page.selectOption('#calRemindAt', '1290');
  await calDrain();
  await page.click('#calSyncBtn');
  await calDrain();
  calS = await calSince(calM);
  const calNewLabel = await page.evaluate(d => { showView('planner'); const b = document.querySelector(`.day-row[data-date="${d}"] [data-action="calRemind"]`); return b ? b.textContent : 'NONE'; }, calWeek[2]);
  check('    Settings names the account and offers REMIND AT from 16:00 to 23:30 on the half hour, at 20:00',
        /Connected as cook@example\.test, calendar RecipeWrangler/.test(calSet.text) && calSet.opts.length === 16
        && calSet.opts[0] === '16:00' && calSet.opts[15] === '23:30' && calSet.value === '1200', JSON.stringify(calSet));
  check('    a new REMIND AT is saved, then every day is synced; SYNC NOW syncs every day; the Planner shows the new time',
        calS.settings.length === 1 && calS.settings[0].calendar_remind_at === 1290
        && JSON.stringify(calS.syncs) === JSON.stringify([{ all: true }, { all: true }])
        && calS.log.indexOf('write-done:household_settings') < calS.log.indexOf('invoke:calendar-sync') && /21:30/.test(calNewLabel),
        JSON.stringify([calS.settings, calS.syncs, calNewLabel]));

  // DISCONNECT.
  await page.evaluate(() => { showView('settings'); showSettingsTab('app');
    window.__INVOKE_REPLY__ = call => call.name === 'calendar-auth' ? { data: { ok: true }, error: null } : { data: null, error: null };
    window.__CAL_CONFIRM__ = ''; window.__REAL_CONFIRM__ = window.confirm; window.confirm = m => { window.__CAL_CONFIRM__ = m; return true; }; });
  const calPlanBefore = await page.evaluate(() => JSON.stringify(cache.plan));
  calM = await calMark();
  await page.click('#calDisconnectBtn');
  await page.waitForTimeout(300);
  await calDrain();
  calS = await calSince(calM);
  const calDc = await page.evaluate(() => { window.confirm = window.__REAL_CONFIRM__;
    return { msg: window.__CAL_CONFIRM__, plan: JSON.stringify(cache.plan), connected: calendarConn.connected, connect: !!document.getElementById('calConnectBtn') }; });
  check('    DISCONNECT asks first, saying the calendar stays in Google, then asks calendar-auth to disconnect and changes nothing in the plan',
        /stay in your Google account/.test(calDc.msg) && JSON.stringify(calS.auths) === JSON.stringify([{ action: 'disconnect' }])
        && calS.plan.length === 0 && calS.syncs.length === 0 && calDc.plan === calPlanBefore && calDc.connected === false && calDc.connect,
        JSON.stringify([calDc.msg, calS.auths, calS.plan.length, calDc.connected]));

  // Coming back from Google: a fresh page at #calendar=<outcome>.
  const calReturn = async (outcome, conn) => {
    const p = await browser.newPage();
    p.__label = 'calendar, #' + outcome;
    await p.addInitScript(c => { window.__STUB_EXTRA__ = { calendar_connections: c };
      window.__INVOKE_REPLY__ = call => call.name === 'calendar-sync' ? { data: { ok: true, put: 0, deleted: 0 }, error: null } : { data: null, error: null }; }, conn);
    await p.clock.setFixedTime(FIXTURE_NOW);
    await p.goto('file://' + path.join(__dirname, 'app-under-test.html') + '#calendar=' + outcome);
    await p.waitForTimeout(1500);
    const out = await p.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue);
      const toast = document.querySelector('.toast');
      return { hash: location.hash, href: location.href.includes('#'), toast: toast ? toast.textContent : '',
        settings: document.getElementById('view-settings').classList.contains('active'),
        appTab: document.querySelector('[data-settings-tab-btn="app"]').classList.contains('active'),
        syncs: window.__INVOKES__.filter(c => c.name === 'calendar-sync').map(c => c.body) }; });
    await p.close();
    return out;
  };
  const calBackOk = await calReturn('connected', [CAL_CONNECTED]);
  check('    back from Google connected: a toast says so, the address loses #calendar=, Settings opens on App, and every day is synced',
        /Google Calendar connected/.test(calBackOk.toast) && calBackOk.hash === '' && !calBackOk.href && calBackOk.settings && calBackOk.appTab
        && JSON.stringify(calBackOk.syncs) === JSON.stringify([{ all: true }]), JSON.stringify(calBackOk));
  const calBackNo = await calReturn('denied', []);
  check('    back from Google refused: the toast says permission was not given, the hash is cleared, and nothing is synced',
        /permission wasn't given/.test(calBackNo.toast) && calBackNo.hash === '' && calBackNo.settings && calBackNo.syncs.length === 0, JSON.stringify(calBackNo));

  await page.evaluate(async () => { delete window.__STUB_DATA__.calendar_connections; window.__INVOKE_REPLY__ = null;
    window.goToGoogle = window.__REAL_GO__; await hydrate(); showView('recipes'); renderHome(); });

  /* ---- The automatic calendar toggles (docs/PLAN-CALENDAR-PUSH.md §11; added 9 Oct 2026) ----
     AUTOMATICALLY ADD TO CALENDAR and AUTOMATICALLY REMIND ME FOR MAIN MEALS. Two made-up recipes join the
     fixture for this section only (a Main and a Side; the fixture's three are all Main), and the settings row
     is given the two columns, or not, to stand for add-calendar-auto applied, or not yet. */
  const AUTO_MAIN = 'auto-main-0000-4000-8000-000000000001', AUTO_SIDE = 'auto-side-0000-4000-8000-000000000002';
  const autoRecipe = (id, title, course) => ({ id, household_id: '286a8a12-c12a-4b83-afbc-0912533f6b1c', title, source: 'Test Kitchen',
    source_url: null, image_url: null, time_text: '20 min', servings: 2, favourite: false, equipment: '', tags: { course, keywords: [] },
    date_added: '2026-01-01', source_photos: null,
    syntax: `TITLE: ${title}\nSOURCE: Test Kitchen\nSERVINGS: 2\nTAGS: course=${course}\n\nGROUP a:\n1 leek\n\nSTAGE:\nMERGE a -> done: Cook [5 min]` });
  const autoSetup = (cols, conn) => page.evaluate(async ([cols, conn, recs]) => {
    const D = window.__STUB_DATA__;
    D.calendar_connections = [conn];
    D.recipes = D.recipes.filter(r => !/^auto-/.test(r.id)).concat(recs);
    /* Fresh planner rows each time: the stub hands back its own arrays, not copies as the real client does, so an
       earlier check that emptied a day in place (removePlanRecipeAt splices) emptied the fixture's row with it. */
    const day = n => isoLocal(dayList()[n]);
    D.planner_days = [
      { household_id: '286a8a12-c12a-4b83-afbc-0912533f6b1c', plan_date: day(0), is_blank: false, recipe_ids: ['11111111-1111-4111-8111-111111111111'], servings: [] },
      { household_id: '286a8a12-c12a-4b83-afbc-0912533f6b1c', plan_date: day(1), is_blank: false,
        recipe_ids: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'], servings: [] }];
    const row = D.household_settings[0];
    delete row.calendar_auto; delete row.calendar_auto_remind;
    if(cols) Object.assign(row, cols);
    window.__MISSING_TABLES__ = [];
    await hydrate();
    window.__INVOKES__.length = 0;
    window.__INVOKE_REPLY__ = call => call.name === 'calendar-sync' ? { data: { ok: true, put: 1, deleted: 0 }, error: null } : { data: null, error: null };
    showView('planner');
  }, [cols, conn, [autoRecipe(AUTO_MAIN, 'Invented Bean Hotpot', 'Main'), autoRecipe(AUTO_SIDE, 'Pretend Green Salad', 'Side')]]);
  const autoDay = n => page.evaluate(n => isoLocal(dayList()[n]), n);
  const autoShown = () => page.evaluate(() => { showView('settings'); showSettingsTab('app');
    const r = { add: !!document.getElementById('calAutoAdd'), remind: !!document.getElementById('calAutoRemind') }; showView('planner'); return r; });
  const autoFlags = d => page.evaluate(d => { const e = cache.plan[d]; return e ? { calendar: !!e.calendar, remind: !!e.remind, blank: !!e.blank } : null; }, d);
  const [autoD0, autoD1, autoD3, autoD4, autoD5, autoD6] = await Promise.all([0, 1, 3, 4, 5, 6].map(autoDay));

  // 1. Before the migration: the toggles' columns are not in the row.
  await autoSetup(null, CAL_CONNECTED);
  const autoPreShown = await autoShown();
  let autoM = await calMark();
  const autoPreAvail = await page.evaluate(([d, id]) => { cache.settings.calendarAuto = true; cache.settings.calendarAutoRemind = true;
    addPlanRecipe(d, id); setSetting('weekStartDay', 5); return calendarAutoAvailable; }, [autoD3, AUTO_MAIN]);
  await calDrain();
  let autoS = await calSince(autoM);
  check('calendar toggles, before their migration: none shown, a settings save names neither column, and adding a recipe switches no day on',
        autoPreAvail === false && !autoPreShown.add && !autoPreShown.remind
        && autoS.settings.length === 1 && !('calendar_auto' in autoS.settings[0]) && !('calendar_auto_remind' in autoS.settings[0])
        && calPlanRow(autoS, autoD3) && calPlanRow(autoS, autoD3).calendar === false && autoS.syncs.length === 0,
        JSON.stringify([autoPreAvail, autoPreShown, autoS.settings, calPlanRow(autoS, autoD3), autoS.syncs]));

  // 2. Applied, connected, both off: today's behaviour.
  await autoSetup({ calendar_auto: false, calendar_auto_remind: false }, CAL_CONNECTED);
  const autoOffShown = await autoShown();
  autoM = await calMark();
  await page.evaluate(([d, id]) => { addPlanRecipe(d, id); setSetting('calendarAuto', false); }, [autoD3, AUTO_MAIN]);
  await calDrain();
  autoS = await calSince(autoM);
  check('    applied, connected, both off: the toggles show, off; adding a recipe leaves the day off and syncs nothing; the setting sends its own column, false',
        autoOffShown.add && autoOffShown.remind && calPlanRow(autoS, autoD3) && calPlanRow(autoS, autoD3).calendar === false && autoS.syncs.length === 0
        && autoS.settings.length === 1 && autoS.settings[0].calendar_auto === false && !('calendar_auto_remind' in autoS.settings[0]),
        JSON.stringify([autoOffShown, calPlanRow(autoS, autoD3), autoS.syncs, autoS.settings]));

  // 3. AUTO ADD on.
  await autoSetup({ calendar_auto: true, calendar_auto_remind: false }, CAL_CONNECTED);
  autoM = await calMark();
  await page.evaluate(([d, id]) => addPlanRecipe(d, id), [autoD3, AUTO_SIDE]);
  await calDrain();
  autoS = await calSince(autoM);
  check('    AUTO ADD on: adding a recipe to an empty day saves it in the calendar (no reminder), and the Planner write lands before the sync of that day',
        calPlanRow(autoS, autoD3) && calPlanRow(autoS, autoD3).calendar === true && calPlanRow(autoS, autoD3).calendar_remind === false
        && JSON.stringify(autoS.syncs) === JSON.stringify([{ dates: [autoD3] }])
        && autoS.log.lastIndexOf('write-done:planner_days') !== -1 && autoS.log.lastIndexOf('write-done:planner_days') < autoS.log.indexOf('invoke:calendar-sync'),
        JSON.stringify([calPlanRow(autoS, autoD3), autoS.syncs, autoS.log]));
  await page.evaluate(d => setPlanCalendar(d, false), autoD3);
  await calDrain();
  autoM = await calMark();
  await page.evaluate(d => setPlanServingsAt(d, 0, 4), autoD3);
  await calDrain();
  const autoHandOff = await calSince(autoM);
  autoM = await calMark();
  await page.evaluate(([d, id]) => addPlanRecipe(d, id), [autoD3, AUTO_SIDE]);
  await calDrain();
  autoS = await calSince(autoM);
  check('    a day switched off by hand stays off on a servings change, and goes back on when a recipe is next added to it',
        calPlanRow(autoHandOff, autoD3) && calPlanRow(autoHandOff, autoD3).calendar === false && autoHandOff.syncs.length === 0
        && calPlanRow(autoS, autoD3) && calPlanRow(autoS, autoD3).calendar === true && JSON.stringify(autoS.syncs) === JSON.stringify([{ dates: [autoD3] }]),
        JSON.stringify([calPlanRow(autoHandOff, autoD3), autoHandOff.syncs, calPlanRow(autoS, autoD3), autoS.syncs]));

  // 4. AUTO REMIND on, AUTO ADD off.
  await autoSetup({ calendar_auto: false, calendar_auto_remind: true }, CAL_CONNECTED);
  autoM = await calMark();
  await page.evaluate(([a, b, main, side]) => { addPlanRecipe(a, main); addPlanRecipe(b, side); }, [autoD3, autoD4, AUTO_MAIN, AUTO_SIDE]);
  await calDrain();
  autoS = await calSince(autoM);
  check('    AUTO REMIND on alone: a Main recipe puts the day in the calendar with REMIND ME; a Side alone gets neither',
        calPlanRow(autoS, autoD3) && calPlanRow(autoS, autoD3).calendar === true && calPlanRow(autoS, autoD3).calendar_remind === true
        && calPlanRow(autoS, autoD4) && calPlanRow(autoS, autoD4).calendar === false && calPlanRow(autoS, autoD4).calendar_remind === false
        && JSON.stringify(autoS.syncs) === JSON.stringify([{ dates: [autoD3] }]),
        JSON.stringify([calPlanRow(autoS, autoD3), calPlanRow(autoS, autoD4), autoS.syncs]));

  // 5. The sweep, through the real toggles.
  await autoSetup({ calendar_auto: false, calendar_auto_remind: false }, CAL_CONNECTED);
  const autoPast = await page.evaluate(([d4, d5, d6, side, main]) => {
    addPlanRecipe(d4, side); setPlanBlank(d5); addPlanRecipe(d6, main); setPlanCalendar(d6, true);
    const p = new Date(); p.setDate(p.getDate() - 2); const past = isoLocal(p);
    cache.plan[past] = { recipeIds: [main], servings: [0] };
    return past;
  }, [autoD4, autoD5, autoD6, AUTO_SIDE, AUTO_MAIN]);
  await calDrain();
  await page.evaluate(() => { showView('settings'); showSettingsTab('app'); });
  autoM = await calMark();
  await page.click('label:has(#calAutoAdd)');
  await calDrain();
  autoS = await calSince(autoM);
  const autoSweepToast = await calToast();
  const autoSweepWrote = autoS.plan.filter(w => w.op === 'upsert').flatMap(w => w.rows).map(r => r.plan_date).sort();
  const autoAfterAdd = { past: await autoFlags(autoPast), blank: await autoFlags(autoD5) };
  check('    switching AUTO ADD on saves it, then puts every upcoming planned day not already on in the calendar, in ONE call after their writes',
        autoS.settings.length === 1 && autoS.settings[0].calendar_auto === true
        && JSON.stringify(autoSweepWrote) === JSON.stringify([autoD0, autoD1, autoD4].sort())
        && JSON.stringify(autoS.syncs) === JSON.stringify([{ dates: [autoD0, autoD1, autoD4].sort() }])
        && autoS.log.lastIndexOf('write-done:planner_days') < autoS.log.indexOf('invoke:calendar-sync') && /Added 3 days to the calendar/.test(autoSweepToast),
        JSON.stringify([autoS.settings, autoSweepWrote, autoS.syncs, autoSweepToast]));
  check('    the sweep leaves a past day and a day marked away untouched',
        !autoSweepWrote.includes(autoPast) && !autoSweepWrote.includes(autoD5) && autoAfterAdd.past && !autoAfterAdd.past.calendar
        && autoAfterAdd.blank && autoAfterAdd.blank.blank && !autoAfterAdd.blank.calendar, JSON.stringify([autoSweepWrote, autoAfterAdd]));
  autoM = await calMark();
  await page.click('label:has(#calAutoRemind)');
  await calDrain();
  autoS = await calSince(autoM);
  const autoRemindToast = await calToast();
  const autoRemindWrote = autoS.plan.filter(w => w.op === 'upsert').flatMap(w => w.rows).filter(r => r.calendar_remind).map(r => r.plan_date).sort();
  check('    switching AUTO REMIND on gives REMIND ME to the upcoming days with a Main course, a Side-only day none, in one call',
        autoS.settings.length === 1 && autoS.settings[0].calendar_auto_remind === true
        && JSON.stringify(autoRemindWrote) === JSON.stringify([autoD0, autoD1, autoD6].sort())
        && JSON.stringify(autoS.syncs) === JSON.stringify([{ dates: [autoD0, autoD1, autoD6].sort() }]) && /Reminders added to 3 main-meal days/.test(autoRemindToast),
        JSON.stringify([autoS.settings, autoRemindWrote, autoS.syncs, autoRemindToast]));
  const autoPlanBefore = await page.evaluate(() => JSON.stringify(cache.plan));
  autoM = await calMark();
  await page.click('label:has(#calAutoAdd)');
  await calDrain();
  await page.click('label:has(#calAutoRemind)');
  await calDrain();
  autoS = await calSince(autoM);
  const autoPlanAfter = await page.evaluate(() => JSON.stringify(cache.plan));
  check('    switching either toggle off saves it and changes no day: no Planner write, no sync, the plan as it was',
        autoS.settings.length === 2 && autoS.settings[0].calendar_auto === false && autoS.settings[1].calendar_auto_remind === false
        && !('calendar_auto_remind' in autoS.settings[0]) && !('calendar_auto' in autoS.settings[1])
        && autoS.plan.length === 0 && autoS.syncs.length === 0 && autoPlanAfter === autoPlanBefore,
        JSON.stringify([autoS.settings, autoS.plan.length, autoS.syncs]));

  // 6. Not connected: the preference is kept, nothing is flagged.
  await autoSetup({ calendar_auto: true, calendar_auto_remind: true }, { ...CAL_CONNECTED, connected: false });
  const autoNcShown = await autoShown();
  autoM = await calMark();
  await page.evaluate(([d, id]) => addPlanRecipe(d, id), [autoD3, AUTO_MAIN]);
  await calDrain();
  autoS = await calSince(autoM);
  check('    not connected: the toggles are hidden, and adding a Main recipe with both on flags nothing',
        !autoNcShown.add && !autoNcShown.remind && calPlanRow(autoS, autoD3) && calPlanRow(autoS, autoD3).calendar === false
        && calPlanRow(autoS, autoD3).calendar_remind === false && autoS.syncs.length === 0,
        JSON.stringify([autoNcShown, calPlanRow(autoS, autoD3), autoS.syncs]));

  await page.evaluate(async () => { const D = window.__STUB_DATA__; D.recipes = D.recipes.filter(r => !/^auto-/.test(r.id));
    delete D.household_settings[0].calendar_auto; delete D.household_settings[0].calendar_auto_remind; delete D.calendar_connections;
    window.__INVOKE_REPLY__ = null; await hydrate(); showView('recipes'); renderHome(); });

  /* ---- Recipe sharing between households (10 Oct 2026, docs/PLAN-RECIPE-SHARING.md) ----
     Before docs/migrations/add-recipe-sharing.md is applied (the main page: every function reads as not created), and
     after it, on a fresh page whose database functions answer as another household, "The Testers", sharing with us. */
  console.log('\nRecipe sharing');
  await page.evaluate(() => { showView('settings'); showSettingsTab('app'); });
  const shPre = await page.evaluate(async () => {
    const m = window.__WRITES__.length;
    const r1 = loadRecipes().find(r => r.title === 'Test Pasta');
    saveRecipe({ ...r1 });
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    const row = window.__WRITES__.slice(m).filter(w => w.table === 'recipes').flatMap(w => w.rows)[0] || {};
    showView('recipes');
    return { available: shared.available, problem: shared.problem, signouts: window.__SIGNOUTS__,
      text: document.getElementById('sharingSettings').textContent.replace(/\s+/g, ' ').trim(),
      switchHidden: document.getElementById('librarySwitch').hidden,
      calls: window.__RPCS__.map(c => c.name).filter((n, i, a) => a.indexOf(n) === i).sort(),
      copiedKey: 'copied_from' in row, rowId: row.id === r1.id };
  });
  check('    before the database change: Settings says it is waiting, no library switch, only the two list calls made, nobody signed out',
        !shPre.available && shPre.problem === 'missing' && /Waiting for the database change/.test(shPre.text) && !/SHARE\b/.test(shPre.text.replace(/RECIPE SHARING/g, ''))
        && shPre.switchHidden && JSON.stringify(shPre.calls) === JSON.stringify(['households_i_share_with', 'households_sharing_with_me']) && shPre.signouts === 0,
        JSON.stringify(shPre));
  check('    an ordinary save of a recipe never names copied_from', shPre.rowId && !shPre.copiedKey, JSON.stringify(shPre));

  const sh = await browser.newPage();
  sh.__label = 'sharing';
  await sh.route('**/storage/v1/object/public/recipe-images/**', route =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0xff, 0xd9]) }));
  await sh.addInitScript(() => {
    const THEM = '99999999-9999-4999-8999-999999999999';
    window.__THEM__ = THEM;
    window.__STUB_EXTRA__ = { households: [{ id: '286a8a12-c12a-4b83-afbc-0912533f6b1c', name: 'Household' }] };
    const flow = (title, course, kw, extra) => [`TITLE: ${title}`, 'SOURCE: Made Up', ...extra, 'SERVINGS: 2', `TAGS: course=${course}, ${kw}`, '',
      'GROUP a:', '200 g invented beans', '', 'STAGE:', 'MERGE a -> warm: Warm through [5 min]', '', 'STAGE:', 'MERGE warm -> done: Serve [instant]'].join('\n');
    window.__THEIR_ROWS__ = () => {
      const img = SELF_HOST_PREFIX + THEM + '/bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb.jpg';
      return [
        { id: 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', title: 'Test Bean Pot', source: 'Made Up', source_url: null, image_url: img, time_text: '20 min',
          servings: 2, equipment: '', tags: { course: 'Main', keywords: ['Beans'] }, syntax: flow('Test Bean Pot', 'Main', 'Beans', [`IMAGE: ${img}`]),
          date_added: '2026-09-01', source_check: null },
        { id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', title: 'Test Flapjack', source: 'Made Up', source_url: null, image_url: null, time_text: '40 min',
          servings: 2, equipment: '', tags: { course: 'Baking', keywords: ['Oats'] }, syntax: flow('Test Flapjack', 'Baking', 'Oats', []),
          date_added: '2026-09-02', source_check: null },
        { id: 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb', title: 'Their Traybake', source: 'Test Kitchen', source_url: 'https://example.com/traybake', image_url: null,
          time_text: '50 min', servings: 4, equipment: '', tags: { course: 'Main', keywords: ['Batch'] }, syntax: flow('Their Traybake', 'Main', 'Batch', []),
          date_added: '2026-09-03', source_check: null }
      ];
    };
    window.__RPC_REPLY__ = call => {
      const a = call.args || {};
      if(call.name === 'households_i_share_with') return { data: [], error: null };
      if(call.name === 'households_sharing_with_me') return { data: [{ household_id: THEM, name: 'The Testers', recipes: 3 }], error: null };
      if(call.name === 'shared_recipes') return { data: a.p_owner === THEM ? window.__THEIR_ROWS__() : [], error: null };
      if(call.name === 'share_recipes_with') return { data: a.p_email === 'cook@example.test' ? { ok: true, household: THEM, name: 'The Testers' } : { error: 'No account uses that email' }, error: null };
      if(call.name === 'stop_sharing_with') return { data: null, error: null };
      if(call.name === 'set_household_name') return { data: String(a.p_name || '').trim().slice(0, 40) || null, error: null };
      return null;
    };
  });
  await sh.clock.setFixedTime(FIXTURE_NOW);
  await sh.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await sh.waitForTimeout(1500);
  const shDrain = () => sh.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue); await new Promise(r => setTimeout(r, 50)); });
  const shGrid = () => sh.evaluate(() => ({
    titles: [...document.querySelectorAll('#recipeGrid .rcard-title')].map(e => e.textContent),
    buttons: document.querySelectorAll('#recipeGrid [data-shortlist], #recipeGrid [data-favourite]').length,
    copied: [...document.querySelectorAll('#recipeGrid .rcard')].filter(c => c.querySelector('.rcard-copied')).map(c => c.querySelector('.rcard-title').textContent),
    switchText: [...document.querySelectorAll('#librarySwitch button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
    side: document.getElementById('sideCount').textContent, ours: cache.recipes.length,
    theirsInCache: cache.recipes.some(r => /^bbbbbbbb/.test(r.id)) }));
  const shOurs = await shGrid();
  check('    another household shares with us: RECIPES shows OUR RECIPES · THE TESTERS\' RECIPES, ours chosen and our cards as before',
        JSON.stringify(shOurs.switchText) === JSON.stringify(['OUR RECIPES*', "THE TESTERS' RECIPES"]) && shOurs.titles.length === 3
        && shOurs.titles.every(t => /^Test (Pasta|Soup|Traybake)$/.test(t)) && shOurs.buttons === 6, JSON.stringify(shOurs));
  await sh.click('#librarySwitch button:has-text("TESTERS")');
  await sh.waitForTimeout(300);
  const shTheirs = await shGrid();
  const shFetch = await sh.evaluate(() => window.__RPCS__.filter(c => c.name === 'shared_recipes').map(c => c.args));
  check('    choosing theirs fetches shared_recipes for that household and shows their three, without shortlist or favourite buttons',
        JSON.stringify(shFetch) === JSON.stringify([{ p_owner: '99999999-9999-4999-8999-999999999999' }]) && shTheirs.titles.length === 3
        && shTheirs.titles.includes('Test Flapjack') && shTheirs.buttons === 0 && shTheirs.switchText[1] === "THE TESTERS' RECIPES*", JSON.stringify([shFetch, shTheirs]));
  check('    our library is untouched: still three recipes, none of theirs in it, and the sidebar counts ours',
        shTheirs.ours === 3 && !shTheirs.theirsInCache && shTheirs.side === '3 RECIPES SAVED', JSON.stringify(shTheirs));
  check('    their card for a page we already have says ALREADY IN OUR RECIPES, and no other does',
        JSON.stringify(shTheirs.copied) === JSON.stringify(['Their Traybake']), JSON.stringify(shTheirs.copied));
  await sh.fill('#searchInput', 'flapjack');
  await sh.waitForTimeout(200);
  const shSearch = await shGrid();
  await sh.fill('#searchInput', '');
  await sh.waitForTimeout(200);
  check('    search works on their library', JSON.stringify(shSearch.titles) === JSON.stringify(['Test Flapjack']), JSON.stringify(shSearch.titles));

  await sh.click('#recipeGrid .rcard:has-text("Test Bean Pot")');
  await sh.waitForTimeout(500);
  const shView = await sh.evaluate(() => {
    const vis = id => { const el = document.getElementById(id); return !!el && el.offsetParent !== null; };
    return { theirs: document.getElementById('view-viewer').classList.contains('theirs'),
      hidden: ['favouriteBtn', 'shortlistBtn', 'editRecipeBtn', 'deleteBtn', 'cookingNotes'].filter(vis),
      add: vis('addToOursBtn') ? document.getElementById('addToOursBtn').textContent : '',
      note: document.getElementById('viewerTheirsNote').textContent, meta: document.getElementById('viewerMeta').textContent,
      cells: document.querySelectorAll('#flowMount .box-cell').length };
  });
  check('    their recipe opens read-only: FAVOURITE, SHORTLIST, EDIT, DELETE and the cooking notes hidden, ADD TO OUR RECIPES shown, the flow drawn',
        shView.theirs && shView.hidden.length === 0 && shView.add === 'ADD TO OUR RECIPES' && /^From The Testers' recipes\. Add it to our recipes/.test(shView.note)
        && /FROM THE TESTERS/.test(shView.meta) && !/COOKED|NEVER/.test(shView.meta) && shView.cells > 0, JSON.stringify(shView));
  const shLogM = await sh.evaluate(() => ({ m: window.__WRITES__.length, diary: loadDiary().length }));
  const shCells = sh.locator('#flowMount .box-cell');
  await shCells.nth((await shCells.count()) - 1).click();
  await sh.waitForTimeout(400);
  await shDrain();
  const shLog = await sh.evaluate(m => ({ writes: window.__WRITES__.slice(m.m).map(w => w.table), diary: loadDiary().length,
    prompt: document.getElementById('mealTypeOverlay').classList.contains('open'), toast: (document.querySelector('.toast') || {}).textContent || '' }), shLogM);
  check('    ticking the last column of theirs logs nothing: no write, no diary entry, no meal prompt, and a toast says why',
        shLog.writes.length === 0 && shLog.diary === shLogM.diary && !shLog.prompt && /Not logged/.test(shLog.toast), JSON.stringify(shLog));

  const shAddM = await sh.evaluate(() => window.__WRITES__.length);
  await sh.click('#addToOursBtn');
  await sh.waitForTimeout(300);
  await shDrain();
  const shAdd = await sh.evaluate(m => {
    const ws = window.__WRITES__.slice(m);
    const rows = ws.filter(w => w.table === 'recipes' && w.op === 'upsert').flatMap(w => w.rows);
    const patches = ws.filter(w => w.table === 'recipes' && w.op === 'update').map(w => ({ patch: w.patch, eqs: w.eqs }));
    const copy = cache.recipes.find(r => r.copiedFrom === 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb');
    return { rows, patches, uploads: window.__STORAGE__.filter(c => c.op === 'upload').map(c => ({ bucket: c.bucket, path: c.path })),
      copyId: copy && copy.id, image: copy && copy.imageUrl, imageLine: copy && /IMAGE: .*286a8a12/.test(copy.syntax), ours: cache.recipes.length,
      keywords: window.__WRITES__.slice(m).filter(w => w.table === 'keywords').flatMap(w => w.rows.map(r => r.name)),
      viewing: state.view, selected: state.selectedRecipeId, shared: state.viewerShared,
      theirs: document.getElementById('view-viewer').classList.contains('theirs') };
  }, shAddM);
  const HOUSE_ID = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
  /* No favourite in the row since 12 Oct 2026 (F25): a save never names it, and a new row takes the column's default, not starred. */
  check('    ADD TO OUR RECIPES writes exactly one new recipes row, in our household, with copied_from, a new id and the same text',
        shAdd.rows.length === 1 && shAdd.rows[0].household_id === HOUSE_ID && shAdd.rows[0].copied_from === 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
        && shAdd.rows[0].id === shAdd.copyId && !/^bbbbbbbb/.test(shAdd.copyId) && shAdd.rows[0].title === 'Test Bean Pot' && !('favourite' in shAdd.rows[0])
        && !('source_photos' in shAdd.rows[0]) && shAdd.ours === 4 && JSON.stringify(shAdd.keywords) === JSON.stringify(['Beans']),
        JSON.stringify([shAdd.rows.map(r => [r.household_id, r.copied_from, r.title, r.favourite]), shAdd.ours, shAdd.keywords]));
  check('    its photo is copied into our own folder, and the copy points there (column and IMAGE: line both)',
        JSON.stringify(shAdd.uploads) === JSON.stringify([{ bucket: 'recipe-images', path: `${HOUSE_ID}/${shAdd.copyId}.jpg` }])
        && shAdd.image === `https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/${HOUSE_ID}/${shAdd.copyId}.jpg` && shAdd.imageLine
        && shAdd.patches.length === 1 && shAdd.patches[0].patch.image_url === shAdd.image && shAdd.patches[0].eqs.some(e => e.column === 'household_id' && e.value === HOUSE_ID),
        JSON.stringify([shAdd.uploads, shAdd.image, shAdd.patches]));
  check('    then our copy opens, as one of ours', shAdd.viewing === 'viewer' && shAdd.selected === shAdd.copyId && shAdd.shared === null && !shAdd.theirs,
        JSON.stringify([shAdd.viewing, shAdd.shared, shAdd.theirs]));
  await sh.evaluate(() => { state.library = '99999999-9999-4999-8999-999999999999'; showView('recipes'); });
  await sh.waitForTimeout(200);
  const shAfter = await shGrid();
  check('    back in their library, the original now says ALREADY IN OUR RECIPES',
        shAfter.copied.includes('Test Bean Pot') && shAfter.copied.includes('Their Traybake') && !shAfter.copied.includes('Test Flapjack'), JSON.stringify(shAfter.copied));

  await sh.evaluate(() => { showView('settings'); showSettingsTab('app'); });
  await sh.waitForTimeout(150);
  const shSet = await sh.evaluate(() => document.getElementById('sharingSettings').textContent.replace(/\s+/g, ' ').trim());
  check('    Settings shows our name, SHARE, nobody shared with yet, and that The Testers share with us',
        /The Testers shares their recipes with us \(3 recipes\)/.test(shSet) && /Nobody yet/.test(shSet)
        && await sh.inputValue('#shareName') === 'Household', shSet);
  await sh.fill('#shareName', '  The Cooks  ');
  await sh.click('#shareNameBtn');
  await sh.waitForTimeout(200);
  await sh.fill('#shareEmail', 'nobody@example.test');
  await sh.click('#shareBtn');
  await sh.waitForTimeout(200);
  const shRefused = await sh.evaluate(() => ({ toast: document.querySelector('.toast').textContent, list: shared.iShareWith.length }));
  await sh.fill('#shareEmail', 'cook@example.test');
  await sh.click('#shareBtn');
  await sh.waitForTimeout(200);
  const shShared = await sh.evaluate(() => ({ toast: document.querySelector('.toast').textContent,
    rows: [...document.querySelectorAll('#sharingSettings [data-stop-share]')].map(b => b.closest('li').textContent.replace(/\s+/g, ' ').trim()),
    calls: window.__RPCS__.filter(c => /share_recipes_with|set_household_name/.test(c.name)) }));
  check('    SAVE sends the name; SHARE sends the email, shows a refusal as given, and on success lists them with STOP SHARING',
        JSON.stringify(shShared.calls) === JSON.stringify([{ name: 'set_household_name', args: { p_name: '  The Cooks  ' } },
          { name: 'share_recipes_with', args: { p_email: 'nobody@example.test' } }, { name: 'share_recipes_with', args: { p_email: 'cook@example.test' } }])
        && shRefused.toast === 'No account uses that email' && shRefused.list === 0 && /Sharing our recipes with The Testers/.test(shShared.toast)
        && JSON.stringify(shShared.rows) === JSON.stringify(['The Testers STOP SHARING']) && await sh.inputValue('#shareName') === 'The Cooks',
        JSON.stringify([shRefused, shShared]));
  await sh.evaluate(() => { window.__CONFIRMS__ = []; window.confirm = msg => { window.__CONFIRMS__.push(msg); return window.__CONFIRMS__.length > 1; }; });
  await sh.click('#sharingSettings [data-stop-share]');
  await sh.waitForTimeout(150);
  const shKept = await sh.evaluate(() => ({ stops: window.__RPCS__.filter(c => c.name === 'stop_sharing_with').length, list: shared.iShareWith.length }));
  /* Clicked in the page, not by Playwright: if Cancel had not kept the row, there is no button left, and the check below
     must fail by name rather than the run dying on a timeout. */
  await sh.evaluate(() => { const b = document.querySelector('#sharingSettings [data-stop-share]'); if(b) b.click(); });
  await sh.waitForTimeout(200);
  const shStop = await sh.evaluate(() => ({ stops: window.__RPCS__.filter(c => c.name === 'stop_sharing_with').map(c => c.args), list: shared.iShareWith.length,
    confirms: window.__CONFIRMS__, text: document.getElementById('sharingSettings').textContent }));
  check('    STOP SHARING asks first, does nothing on Cancel, and on OK calls stop_sharing_with for that household and drops it from the list',
        shKept.stops === 0 && shKept.list === 1 && JSON.stringify(shStop.stops) === JSON.stringify([{ p_household: '99999999-9999-4999-8999-999999999999' }])
        && shStop.list === 0 && /Stop letting The Testers browse our recipes/.test(shStop.confirms[0]) && /Nobody yet/.test(shStop.text), JSON.stringify([shKept, shStop]));

  /* They stop sharing with us: the next load drops their library, and the switch goes. */
  await sh.evaluate(async () => { state.library = '99999999-9999-4999-8999-999999999999';
    const reply = window.__RPC_REPLY__; window.__RPC_REPLY__ = c => c.name === 'households_sharing_with_me' ? { data: [], error: null } : reply(c);
    showView('recipes'); await loadSharing(); });
  const shGone = await shGrid();
  check('    when they stop sharing, the next load drops their recipes and the switch, and RECIPES is ours again',
        shGone.switchText.length === 0 && shGone.titles.length === 4 && await sh.evaluate(() => Object.keys(shared.recipes).length === 0 && state.library === null),
        JSON.stringify(shGone));
  await sh.close();

  /* ---- The weekly backup to Google Drive (10 Oct 2026, docs/PLAN-DRIVE-BACKUP.md) ----
     Before docs/migrations/add-drive-backup.md (the main page: no calendar_connections at all, as the default fixture), then on
     fresh pages whose connection row has the drive_* columns, with or without the Drive permission, saved or not lately. */
  console.log('\nBackup to Google Drive');
  const drPre = await page.evaluate(() => { showView('settings'); showSettingsTab('app');
    const t = document.getElementById('driveSettings').textContent.replace(/\s+/g, ' ').trim(); showView('recipes');
    return { text: t, button: !!document.getElementById('driveSaveBtn'), calls: window.__INVOKES__.filter(c => c.name === 'drive-backup').length }; });
  check('    before the database change: Settings says it is waiting, offers no button, and nothing is ever sent',
        /Waiting for the database change/.test(drPre.text) && !drPre.button && drPre.calls === 0, JSON.stringify(drPre));

  const DR_HOUSE = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
  const DR_CAL = 'https://www.googleapis.com/auth/calendar.app.created';
  const DR_DRIVE = 'https://www.googleapis.com/auth/drive.file';
  const drDaysAgo = n => new Date(FIXTURE_NOW - n * 86400000).toISOString();
  const drConn = over => Object.assign({ household_id: DR_HOUSE, connected: true, google_email: 'cook@example.test', calendar_id: 'made-up@group.calendar.google.com',
    scope: `openid ${DR_CAL} ${DR_DRIVE} email`, connected_at: drDaysAgo(20), last_sync_at: null, last_error: null, updated_at: drDaysAgo(20),
    drive_folder_id: null, drive_backup_at: null, drive_last_error: null }, over || {});
  const drPage = async (conn, label) => {
    const p = await browser.newPage();
    p.__label = 'drive, ' + label;
    await p.addInitScript(c => { window.__STUB_EXTRA__ = { calendar_connections: [c] };
      window.__DRIVE_REPLY__ = { data: { ok: true, name: 'kitchen-backup-2026-09-22.json', at: '2026-09-22T09:00:05.000Z', deleted: 0 }, error: null };
      window.__INVOKE_REPLY__ = call => call.name === 'drive-backup' ? window.__DRIVE_REPLY__ : { data: { ok: true, put: 0, deleted: 0 }, error: null }; }, conn);
    await p.clock.setFixedTime(FIXTURE_NOW);
    await p.goto('file://' + path.join(__dirname, 'app-under-test.html'));
    await p.waitForTimeout(1500);
    return p;
  };
  const drState = p => p.evaluate(() => { showView('settings'); showSettingsTab('app');
    const calls = window.__INVOKES__.filter(c => c.name === 'drive-backup');
    return { text: document.getElementById('driveSettings').textContent.replace(/\s+/g, ' ').trim(),
      save: !!document.getElementById('driveSaveBtn'), reconnect: !!document.getElementById('driveReconnectBtn'),
      calls: calls.length, sameFile: calls.length ? calls.every(c => JSON.stringify(c.body) === JSON.stringify({ backup: exportPayload() })) : null,
      toast: (document.querySelector('.toast') || {}).textContent || '' }; });

  // Connected before Drive was asked for: no Drive permission.
  const drNo = await drPage(drConn({ scope: `openid ${DR_CAL} email` }), 'no permission');
  await drNo.evaluate(() => { window.goToGoogle = url => { window.__WENT__ = url; };
    const r = window.__INVOKE_REPLY__; window.__INVOKE_REPLY__ = c => c.name === 'calendar-auth' ? { data: { url: 'https://accounts.example.test/consent' }, error: null } : r(c); });
  const drNoS = await drState(drNo);
  /* Clicked in the page: if the button is wrongly missing, the check below fails by name rather than the run dying on a timeout. */
  await drNo.evaluate(() => { const b = document.getElementById('driveReconnectBtn'); if(b) b.click(); });
  await drNo.waitForTimeout(200);
  const drNoGo = await drNo.evaluate(() => ({ went: window.__WENT__, auth: window.__INVOKES__.filter(c => c.name === 'calendar-auth').map(c => c.body.action) }));
  check('    connected without the Drive permission: nothing is sent, and CONNECT AGAIN FOR DRIVE goes to Google as CONNECT does',
        drNoS.calls === 0 && drNoS.reconnect && !drNoS.save && /without permission for Drive/.test(drNoS.text)
        && drNoGo.went === 'https://accounts.example.test/consent' && JSON.stringify(drNoGo.auth) === JSON.stringify(['start']), JSON.stringify([drNoS, drNoGo]));
  await drNo.close();

  // Allowed and never saved: the first load saves once, the same file EXPORT DATA makes.
  const drNew = await drPage(drConn(), 'never saved');
  const drNewS = await drState(drNew);
  check('    allowed and never saved: the first load sends one backup, the very payload EXPORT DATA downloads, and says so',
        drNewS.calls === 1 && drNewS.sameFile === true && /This week's backup is saved in Google Drive/.test(drNewS.toast)
        && /Last saved to Drive/.test(drNewS.text) && drNewS.save, JSON.stringify(drNewS));
  await drNew.evaluate(async () => { await refreshLibrary(); await refreshLibrary(); });
  const drAgain = await drState(drNew);
  check('    coming back to the tab does not send another, even though the stub still says never saved (once per load)',
        drAgain.calls === 1, JSON.stringify(drAgain));
  await drNew.click('#driveSaveBtn');
  await drNew.waitForTimeout(300);
  const drHand = await drState(drNew);
  check('    SAVE TO DRIVE NOW sends one at any time and names the file in its toast',
        drHand.calls === 2 && drHand.sameFile === true && drHand.toast === 'Saved to Google Drive as kitchen-backup-2026-09-22.json', JSON.stringify(drHand));
  await drNew.evaluate(() => { window.__DRIVE_REPLY__ = { data: { error: 'Drive would not take the file (500)' }, error: null }; });
  await drNew.click('#driveSaveBtn');
  await drNew.waitForTimeout(300);
  const drFail = await drState(drNew);
  check('    a failed save says why, by hand in a toast and in Settings as the last problem',
        drFail.calls === 3 && /Couldn't save to Google Drive: Drive would not take the file \(500\)/.test(drFail.toast)
        && /Last problem: Drive would not take the file \(500\)/.test(drFail.text), JSON.stringify(drFail));
  await drNew.close();

  // Saved three days ago: nothing by itself. Eight days ago: one.
  const drRecent = await drPage(drConn({ drive_backup_at: drDaysAgo(3) }), 'saved 3 days ago');
  const drRecentS = await drState(drRecent);
  await drRecent.close();
  const drOld = await drPage(drConn({ drive_backup_at: drDaysAgo(8) }), 'saved 8 days ago');
  const drOldS = await drState(drOld);
  await drOld.close();
  check('    saved three days ago, nothing is sent by itself; saved eight days ago, the load sends one',
        drRecentS.calls === 0 && /Last saved to Drive/.test(drRecentS.text) && drOldS.calls === 1, JSON.stringify([drRecentS.calls, drOldS.calls]));

  /* ---- PRE-MADE meals and COOKED ✓ (10 Oct 2026, docs/PLAN-FOOD-DIARY.md) ----
     Before docs/migrations/add-premade.md (the main page: no `premade` key on any row), then on a fresh page whose planner and
     diary rows carry the columns. The fixture plans Test Pasta today and Pasta + Soup tomorrow. */
  console.log('\nPRE-MADE and COOKED ✓');
  const pmIso = off => page.evaluate(o => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + o); return isoLocal(d); }, off);
  const PM_TODAY = await pmIso(0), PM_TOMORROW = await pmIso(1), PM_YESTERDAY = await pmIso(-1);
  const PM_R1 = '11111111-1111-4111-8111-111111111111', PM_R2 = '22222222-2222-4222-8222-222222222222';
  const pmDrain = p => p.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue); });
  const pmPre = await page.evaluate(async ([today]) => {
    showView('planner');
    const m = window.__WRITES__.length;
    setPlanServingsAt(today, 0, 0);
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    const row = window.__WRITES__.slice(m).filter(w => w.table === 'planner_days').flatMap(w => w.rows || [])[0] || {};
    const todayRow = document.querySelector(`.day-row[data-date="${today}"]`);
    return { available: premadeAvailable, pills: document.querySelectorAll('#dayList .day-recipe-premade').length,
      key: 'premade' in row, cooked: todayRow ? todayRow.querySelectorAll('[data-action="cooked"]').length : -1 };
  }, [PM_TODAY]);
  check('    before the database change: no PRE-MADE switch, and a Planner save never names the column; COOKED ✓ needs no change and is offered today',
        !pmPre.available && pmPre.pills === 0 && !pmPre.key && pmPre.cooked === 1, JSON.stringify(pmPre));
  const pmFuture = await page.evaluate(t => document.querySelector(`.day-row[data-date="${t}"]`).querySelectorAll('[data-action="cooked"]').length, PM_TOMORROW);
  check('    COOKED ✓ is not offered on a day still to come', pmFuture === 0, String(pmFuture));
  /* No recipe open, as when the app is opened straight on the Planner: a redraw of the Viewer would then take the page
     back to RECIPES, which is the regression this check catches. */
  let pmM = await page.evaluate(() => { state.selectedRecipeId = null; return window.__WRITES__.length; });
  await page.click(`.day-row[data-date="${PM_TODAY}"] [data-action="cooked"]`);
  await page.waitForTimeout(300);
  await pmDrain(page);
  const pmCooked = await page.evaluate(([m, today, r1]) => {
    const ins = window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs');
    const rows = ins.flatMap(w => Array.isArray(w.rows) ? w.rows : [w.rows]);
    return { ops: ins.map(w => w.op), rows: rows.map(r => ({ recipe: r.recipe_id === r1, on: r.cooked_on, premade: 'premade' in r })),
      today, prompt: document.getElementById('mealTypeOverlay').classList.contains('open'), view: state.view,
      done: (document.querySelector(`.day-row[data-date="${today}"] .day-recipe-cooked.done`) || {}).textContent || '',
      history: loadRecipes().find(r => r.id === r1).history.includes(today) };
  }, [pmM, PM_TODAY, PM_R1]);
  await page.evaluate(() => closeMealTypePrompt());
  check('    COOKED ✓ logs the recipe for that day exactly as finishing the flow does, asks which meal, stays on the Planner, then reads ✓ COOKED',
        JSON.stringify(pmCooked.ops) === JSON.stringify(['insert']) && pmCooked.rows.length === 1 && pmCooked.rows[0].recipe
        && pmCooked.rows[0].on === PM_TODAY && !pmCooked.rows[0].premade && pmCooked.prompt && pmCooked.view === 'planner'
        && pmCooked.done === '✓ COOKED' && pmCooked.history, JSON.stringify(pmCooked));
  pmM = await page.evaluate(() => window.__WRITES__.length);
  const pmPast = await page.evaluate(async ([m, y, r2]) => { logRecipeUsed(r2, y); let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    closeMealTypePrompt();
    const rows = window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs').flatMap(w => Array.isArray(w.rows) ? w.rows : [w.rows]);
    const h = loadRecipes().find(r => r.id === r2).history;
    return { on: rows.map(r => r.cooked_on), toast: document.querySelector('.toast').textContent, sorted: h.join() === h.slice().sort().join() };
  }, [pmM, PM_YESTERDAY, PM_R2]);
  check('    logging a recipe for an earlier day writes that day, says the date, and keeps its history in order',
        JSON.stringify(pmPast.on) === JSON.stringify([PM_YESTERDAY]) && !/cooked today/.test(pmPast.toast) && pmPast.sorted, JSON.stringify(pmPast));

  // After the migration: a fresh page whose rows carry the columns.
  const pmPage = await browser.newPage();
  pmPage.__label = 'pre-made';
  await pmPage.addInitScript(([today, tomorrow, yesterday, r1, r2]) => {
    const H = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
    window.__STUB_EXTRA__ = {
      planner_days: [
        { household_id: H, plan_date: today, is_blank: false, recipe_ids: [r1], servings: [], premade: [] },
        { household_id: H, plan_date: tomorrow, is_blank: false, recipe_ids: [r1, r2], servings: [], premade: [] }
      ],
      recipe_logs: [
        { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', household_id: H, recipe_id: r1, cooked_on: '2026-09-15', meal_type: 'dinner', note: null, title: null, premade: false },
        { id: 'aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa', household_id: H, recipe_id: r2, cooked_on: yesterday, meal_type: 'lunch', note: null, title: null, premade: true }
      ]
    };
  }, [PM_TODAY, PM_TOMORROW, PM_YESTERDAY, PM_R1, PM_R2]);
  await pmPage.clock.setFixedTime(FIXTURE_NOW);
  await pmPage.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await pmPage.waitForTimeout(1500);
  const pmLoad = await pmPage.evaluate(([y, r2]) => ({ available: premadeAvailable,
    r2history: loadRecipes().find(r => r.id === r2).history, diary: loadDiary().filter(e => e.premade).map(e => e.cookedOn),
    kindInDay: (() => { state.historySelectedDate = y; showView('history'); return document.getElementById('historyDayDetail').textContent; })() }), [PM_YESTERDAY, PM_R2]);
  check('    a diary entry eaten from the freezer is in the diary, marked FROM THE FREEZER, and not in the recipe\'s cooking history',
        pmLoad.available && JSON.stringify(pmLoad.diary) === JSON.stringify([PM_YESTERDAY]) && !pmLoad.r2history.includes(PM_YESTERDAY)
        && /FROM THE FREEZER/.test(pmLoad.kindInDay), JSON.stringify(pmLoad));
  /* Each row's name with its whole description (amounts included), so a halved amount shows as a change. */
  const pmShop = () => pmPage.evaluate(() => buildShoppingList(groupDaysByWeek(dayList())[0] || []).categories
    .flatMap(c => c.items.map(i => i.name + ' ' + JSON.stringify(i))));
  await pmPage.evaluate(() => showView('planner'));
  const pmShopBefore = await pmShop();
  pmM = await pmPage.evaluate(() => window.__WRITES__.length);
  await pmPage.click(`.day-row[data-date="${PM_TODAY}"] [data-action="premade"]`);
  await pmPage.waitForTimeout(200);
  const pmAsk = await pmPage.evaluate(() => ({ open: document.getElementById('premadeOverlay').classList.contains('open'),
    what: document.getElementById('premadeWhat').textContent, meals: document.querySelectorAll('#premadeChoices .meal-type-btn').length }));
  /* Clicked in the page: if no question was asked there is no button, and the check below fails by name. */
  await pmPage.evaluate(() => { const b = document.querySelector('#premadeChoices .meal-type-btn[data-meal="dinner"]'); if(b) b.click(); });
  await pmPage.waitForTimeout(200);
  await pmDrain(pmPage);
  const pmOn = await pmPage.evaluate(([m, today, r1]) => {
    const ws = window.__WRITES__.slice(m);
    const plan = ws.filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows).filter(r => r.plan_date === today);
    const logs = ws.filter(w => w.table === 'recipe_logs');
    return { plan: plan.map(r => r.premade), logs: logs.map(w => ({ op: w.op, opts: w.opts, rows: w.rows })),
      pill: (document.querySelector(`.day-row[data-date="${today}"] .day-recipe-premade`) || {}).textContent || '',
      cookedBtn: document.querySelectorAll(`.day-row[data-date="${today}"] [data-action="cooked"]`).length,
      history: loadRecipes().find(r => r.id === r1).history.includes(today),
      expectId: premadeLogId('286a8a12-c12a-4b83-afbc-0912533f6b1c', today, r1, 1), toast: document.querySelector('.toast').textContent };
  }, [pmM, PM_TODAY, PM_R1]);
  check('    PRE-MADE asks which meal first, then saves that meal in the item\'s slot and reads PRE-MADE · DINNER, with no COOKED ✓ beside it',
        pmAsk.open && pmAsk.what === 'Test Pasta' && pmAsk.meals === 4 && JSON.stringify(pmOn.plan) === JSON.stringify([['dinner']])
        && pmOn.pill.trim() === 'PRE-MADE · DINNER' && pmOn.cookedBtn === 0, JSON.stringify([pmAsk, pmOn.plan, pmOn.pill]));
  const pmLog = pmOn.logs.length === 1 ? pmOn.logs[0] : null;
  const pmRow = pmLog && pmLog.rows && pmLog.rows[0];
  check('    today\'s pre-made meal goes into the diary at once: one upsert that ignores a duplicate, its own worked-out id, the meal, premade, and no cooking history',
        pmLog && pmLog.op === 'upsert' && pmLog.opts && pmLog.opts.ignoreDuplicates === true && pmLog.opts.onConflict === 'id'
        && pmRow.id === pmOn.expectId && pmRow.premade === true && pmRow.meal_type === 'dinner' && pmRow.cooked_on === PM_TODAY
        && pmRow.recipe_id === PM_R1 && !pmOn.history && /in the food diary as eaten from the freezer/.test(pmOn.toast), JSON.stringify([pmOn.logs, pmOn.toast]));
  const pmShopAfter = await pmShop();
  const pmPasta = list => list.find(n => /^Dried pasta /.test(n)) || '';
  check('    and its ingredients are off the week\'s shopping list: the pasta row now buys only tomorrow\'s, still fresh',
        pmPasta(pmShopBefore) && pmPasta(pmShopAfter) && pmPasta(pmShopBefore) !== pmPasta(pmShopAfter)
        && /600/.test(pmPasta(pmShopBefore)) && /300/.test(pmPasta(pmShopAfter)) && !/600/.test(pmPasta(pmShopAfter)),
        JSON.stringify([pmPasta(pmShopBefore), pmPasta(pmShopAfter)]));
  const pmOnlyToday = await pmPage.evaluate(today => buildShoppingList([new Date(today + 'T00:00:00')]).totalItems, PM_TODAY);
  check('    a day whose only meal is pre-made has nothing to buy', pmOnlyToday === 0, String(pmOnlyToday));
  pmM = await pmPage.evaluate(() => window.__WRITES__.length);
  const pmAgain = await pmPage.evaluate(async m => { const n = logDuePremade(); let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    return { n, logs: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs').length }; }, pmM);
  const pmIds = await pmPage.evaluate(([today, r1]) => { const H = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
    const a = premadeLogId(H, today, r1, 1);
    return { same: a === premadeLogId(H, today, r1, 1), uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a),
      differs: new Set([a, premadeLogId(H, today, r1, 2), premadeLogId(H, '2026-01-01', r1, 1), premadeLogId(H.replace('2', '3'), today, r1, 1)]).size === 4 }; }, [PM_TODAY, PM_R1]);
  check('    running it again writes nothing, and the id is the same on any device for the same day and place, and different otherwise',
        pmAgain.n === 0 && pmAgain.logs === 0 && pmIds.same && pmIds.uuid && pmIds.differs, JSON.stringify([pmAgain, pmIds]));
  pmM = await pmPage.evaluate(() => window.__WRITES__.length);
  /* Tomorrow is Pasta then Soup. Soup (second) is made pre-made, then Pasta (first) is taken off: Soup must keep its own
     setting, which moves up a place with it. Then Soup is taken off too, before its day, and Pasta put back as it was. */
  const pmLater = await pmPage.evaluate(async ([m, tomorrow, r1]) => {
    setPlanPremadeAt(tomorrow, 1, 'lunch'); let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    const logsAfterOn = window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs').length;
    removePlanRecipeAt(tomorrow, 0); do { t = writeQueue; await t; } while(t !== writeQueue);
    const rows = () => window.__WRITES__.slice(m).filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows).filter(r => r.plan_date === tomorrow);
    /* Copied now: the recorded row shares its arrays with the cache, which the next removal changes in place. */
    const afterFirst = JSON.parse(JSON.stringify(rows()[rows().length - 1]));
    removePlanRecipeAt(tomorrow, 0); do { t = writeQueue; await t; } while(t !== writeQueue);
    const gone = !(tomorrow in loadPlan());
    addPlanRecipe(tomorrow, r1); do { t = writeQueue; await t; } while(t !== writeQueue);
    return { logsAfterOn, logs: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs').length,
      afterFirst: { ids: afterFirst.recipe_ids, premade: afterFirst.premade }, gone };
  }, [pmM, PM_TOMORROW, PM_R1]);
  check('    a day still to come is not logged; taking a dish off keeps the others\' PRE-MADE in step, and removing the pre-made one before its day leaves nothing behind',
        pmLater.logsAfterOn === 0 && pmLater.logs === 0 && JSON.stringify(pmLater.afterFirst.ids) === JSON.stringify([PM_R2])
        && JSON.stringify(pmLater.afterFirst.premade) === JSON.stringify(['lunch']) && pmLater.gone, JSON.stringify(pmLater));
  pmM = await pmPage.evaluate(() => window.__WRITES__.length);
  await pmPage.click(`.day-row[data-date="${PM_TODAY}"] [data-action="premade"]`);
  await pmPage.waitForTimeout(200);
  await pmDrain(pmPage);
  const pmOff = await pmPage.evaluate(([m, today]) => {
    const ws = window.__WRITES__.slice(m);
    return { plan: ws.filter(w => w.table === 'planner_days').flatMap(w => w.rows || []).map(r => r.premade),
      logs: ws.filter(w => w.table === 'recipe_logs').map(w => w.op), kept: loadDiary().filter(e => e.premade && e.cookedOn === today).length,
      open: document.getElementById('premadeOverlay').classList.contains('open') };
  }, [pmM, PM_TODAY]);
  check('    tapping PRE-MADE · DINNER again makes it fresh at once, with no question; the diary entry already made stays',
        JSON.stringify(pmOff.plan) === JSON.stringify([['']]) && pmOff.logs.length === 0 && pmOff.kept === 1 && !pmOff.open, JSON.stringify(pmOff));
  const pmDel = await pmPage.evaluate(([today, r1]) => {
    const e = loadDiary().find(x => x.premade && x.cookedOn === today);
    const r = loadRecipes().find(x => x.id === r1);
    r.history.push(today); r.history.sort();
    deleteDiaryEntry(e.id);
    return r.history.includes(today);
  }, [PM_TODAY, PM_R1]);
  check('    removing a pre-made entry from the diary leaves the recipe\'s own cooking that day alone', pmDel === true, String(pmDel));
  const pmRemind = await pmPage.evaluate(([today, r2]) => {
    calendarAvailable = true; calendarConn = { connected: true }; calendarAutoAvailable = true;
    cache.settings.calendarAutoRemind = true; cache.settings.calendarAuto = false;
    const r = loadRecipes().find(x => x.id === r2); const course = r.tags.course; r.tags.course = 'Side';
    const fresh = { recipeIds: [r2], servings: [0] }, frozen = { recipeIds: [r2], servings: [0], premade: ['lunch'] };
    const out = { fresh: applyCalendarAuto(fresh), frozen: applyCalendarAuto(frozen), flags: [frozen.calendar, frozen.remind] };
    r.tags.course = course; calendarAvailable = false; calendarConn = null; calendarAutoAvailable = false; cache.settings.calendarAutoRemind = false;
    return out;
  }, [PM_TODAY, PM_R2]);
  check('    AUTOMATICALLY REMIND ME FOR MAIN MEALS also reminds for a pre-made Side, and not for a fresh one',
        pmRemind.fresh === false && pmRemind.frozen === true && pmRemind.flags[0] === true && pmRemind.flags[1] === true, JSON.stringify(pmRemind));
  const pmExport = await pmPage.evaluate(([today, tomorrow]) => {
    setPlanPremadeAt(tomorrow, 0, 'snack');
    const x = exportPayload();
    return { plan: x.plan[tomorrow].premade, plainDay: 'premade' in x.plan[today], diary: x.diary.filter(e => e.premade).length,
      ordinary: x.diary.filter(e => !e.premade).every(e => !('premade' in e)) };
  }, [PM_TODAY, PM_TOMORROW]);
  const pmBackup = await pmPage.evaluate(() => JSON.stringify(exportPayload()));
  pmM = await pmPage.evaluate(() => window.__WRITES__.length);
  pmPage.once('dialog', d => d.accept());
  await pmPage.setInputFiles('#importFileInput', { name: 'kitchen-backup-pm.json', mimeType: 'application/json', buffer: Buffer.from(pmBackup) });
  await pmPage.waitForTimeout(1200);
  await pmDrain(pmPage);
  const pmImp = await pmPage.evaluate(([m, tomorrow]) => {
    const ws = window.__WRITES__.slice(m);
    const logs = ws.filter(w => w.table === 'recipe_logs' && w.op === 'upsert').flatMap(w => w.rows);
    const plan = ws.filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows);
    return { logsAll: logs.length && logs.every(r => typeof r.premade === 'boolean'), logsPm: logs.filter(r => r.premade).length,
      planAll: plan.length && plan.every(r => Array.isArray(r.premade)), planPm: (plan.find(r => r.plan_date === tomorrow) || {}).premade,
      cache: loadDiary().filter(e => e.premade).length };
  }, [pmM, PM_TOMORROW]);
  check('    EXPORT DATA carries PRE-MADE on the day and on the diary entry only where set, and IMPORT DATA writes it back on every row',
        JSON.stringify(pmExport.plan) === JSON.stringify(['snack']) && !pmExport.plainDay && pmExport.diary === 1 && pmExport.ordinary
        && pmImp.logsAll && pmImp.logsPm === 1 && pmImp.planAll && JSON.stringify(pmImp.planPm) === JSON.stringify(['snack']) && pmImp.cache === 1,
        JSON.stringify([pmExport, pmImp]));
  await pmPage.close();

  /* ---- Fresh or freezer? (tablet step 41a, 10 Oct 2026) ----
     Finishing the flow of a dish down as PRE-MADE today logged it a second time, as cooked. Today here is Pasta (pre-made,
     dinner) then Soup (fresh); the load puts Pasta in the diary from the freezer. Then the Planner row on a phone. */
  console.log('\nFresh or freezer, and the Planner row on a phone');
  const ff = await browser.newPage();
  ff.__label = 'fresh or freezer';
  await ff.addInitScript(([today, r1, r2]) => {
    window.__STUB_EXTRA__ = {
      planner_days: [{ household_id: '286a8a12-c12a-4b83-afbc-0912533f6b1c', plan_date: today, is_blank: false,
        recipe_ids: [r1, r2], servings: [], premade: ['dinner', ''] }],
      recipe_logs: []
    };
  }, [PM_TODAY, PM_R1, PM_R2]);
  await ff.clock.setFixedTime(FIXTURE_NOW);
  await ff.setViewportSize({ width: 412, height: 915 });
  await ff.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await ff.waitForTimeout(1500);
  const ffRow = () => ff.evaluate(today => {
    showView('planner');
    return [...document.querySelectorAll(`.day-row[data-date="${today}"] .day-recipe-row`)].map(row => {
      const t = row.querySelector('.day-recipe-title').getBoundingClientRect();
      const pill = row.querySelector('.day-recipe-premade').getBoundingClientRect();
      return { title: Math.round(t.width), titleTop: Math.round(t.top), pillTop: Math.round(pill.top) };
    });
  }, PM_TODAY);
  const ffPhone = await ffRow();
  await ff.setViewportSize({ width: 800, height: 1280 });
  const ffTablet = await ffRow();
  await ff.setViewportSize({ width: 412, height: 915 });
  check('    on a phone each dish keeps a readable name (the pills wrap under it); on the tablet a short one still has its pills beside it',
        ffPhone.length === 2 && ffPhone.every(r => r.title >= 150) && ffTablet.length === 2 && Math.abs(ffTablet[1].pillTop - ffTablet[1].titleTop) < 12,
        JSON.stringify({ ffPhone, ffTablet }));
  const ffFreezerId = await ff.evaluate(([today, r1]) => premadeLogId(HOUSEHOLD_ID, today, r1, 1), [PM_TODAY, PM_R1]);
  const ffDrain = () => pmDrain(ff);
  /* The final column's cells, in the page: the last cell in the page is not always in the last column. Ticking each one
     not yet done finishes the flow; unticking takes one off again. */
  const ffFinal = untick => ff.evaluate(untick => {
    const cells = [...document.querySelectorAll('#flowMount .box-cell')];
    const last = Math.max(...cells.map(c => +c.dataset.col));
    const finals = cells.filter(c => +c.dataset.col === last);
    if(untick){ const c = finals.find(x => x.classList.contains('done')); if(c) c.click(); }
    else finals.filter(c => !c.classList.contains('done')).forEach(c => c.click());
  }, !!untick).then(() => ff.waitForTimeout(300));
  const ffLastCell = () => ffFinal(false);
  const ffAgain = async () => { await ffFinal(true); await ffFinal(false); };
  const ffState = m => ff.evaluate(([m, today, r1, fid]) => {
    const ws = window.__WRITES__.slice(m);
    return { logs: ws.filter(w => w.table === 'recipe_logs').map(w => ({ op: w.op,
        rows: (Array.isArray(w.rows) ? w.rows : w.rows ? [w.rows] : []).map(r => ({ on: r.cooked_on, premade: !!r.premade, recipe: r.recipe_id === r1 })) })),
      plan: ws.filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows).filter(r => r.plan_date === today).map(r => r.premade),
      ask: document.getElementById('freshOrFreezerOverlay').classList.contains('open'),
      what: document.getElementById('freshOrFreezerWhat').textContent,
      prompt: document.getElementById('mealTypeOverlay').classList.contains('open'),
      freezer: loadDiary().filter(e => e.premade && e.cookedOn === today).map(e => e.id),
      cooked: loadDiary().filter(e => !e.premade && e.cookedOn === today && e.recipeId === r1).length,
      history: loadRecipes().find(r => r.id === r1).history.includes(today),
      toast: (document.querySelector('.toast') || {}).textContent || '' };
  }, [m, PM_TODAY, PM_R1, ffFreezerId]);
  await ff.evaluate(r1 => openRecipe(r1), PM_R1);
  await ff.waitForTimeout(400);
  let ffM = await ff.evaluate(() => window.__WRITES__.length);
  await ffLastCell();
  await ffDrain();
  const ffAsk = await ffState(ffM);
  check('    finishing the flow of a dish down as PRE-MADE today asks fresh or freezer, and logs nothing until it is answered',
        ffAsk.ask && ffAsk.what === 'Test Pasta' && ffAsk.logs.length === 0 && !ffAsk.prompt
        && JSON.stringify(ffAsk.freezer) === JSON.stringify([ffFreezerId]) && !ffAsk.history, JSON.stringify(ffAsk));
  await ff.evaluate(() => { const b = document.getElementById('freshOrFreezerFreezer'); if(b) b.click(); });
  await ff.waitForTimeout(200);
  await ffAgain();
  await ffDrain();
  const ffFrozen = await ffState(ffM);
  check('    FROM THE FREEZER adds nothing, the one freezer entry stays, and ticking the last column again does not ask again',
        !ffFrozen.ask && ffFrozen.logs.length === 0 && ffFrozen.plan.length === 0 && !ffFrozen.prompt && ffFrozen.freezer.length === 1
        && ffFrozen.cooked === 0 && /from the freezer/.test(ffFrozen.toast), JSON.stringify(ffFrozen));
  // The other answer, as if asked afresh.
  await ff.evaluate(() => freshOrFreezerAnswered.clear());
  ffM = await ff.evaluate(() => window.__WRITES__.length);
  await ffAgain();
  await ff.evaluate(() => { const b = document.getElementById('freshOrFreezerFresh'); if(b) b.click(); });
  await ff.waitForTimeout(300);
  await ffDrain();
  const ffFresh = await ffState(ffM);
  const ffDeleted = await ff.evaluate(([m, fid]) => window.__WRITES__.slice(m).some(w => w.table === 'recipe_logs' && w.op === 'delete'
    && JSON.stringify(w).includes(fid)), [ffM, ffFreezerId]);
  check('    COOKED FRESH takes PRE-MADE off the dish, removes its freezer entry by its own id, and logs it as cooked with the meal question',
        ffDeleted && JSON.stringify(ffFresh.plan) === JSON.stringify([['', '']]) && ffFresh.freezer.length === 0 && ffFresh.cooked === 1 && ffFresh.history
        && ffFresh.logs.filter(l => l.op === 'insert').length === 1 && ffFresh.logs.filter(l => l.op === 'delete').length === 1
        && ffFresh.prompt && !ffFresh.ask, JSON.stringify({ ffDeleted, ffFresh }));
  await ff.evaluate(() => closeMealTypePrompt());
  await ff.evaluate(r2 => openRecipe(r2), PM_R2);
  await ff.waitForTimeout(400);
  ffM = await ff.evaluate(() => window.__WRITES__.length);
  await ffLastCell();
  await ffDrain();
  const ffSoup = await ff.evaluate(([m, today, r2]) => ({ ask: document.getElementById('freshOrFreezerOverlay').classList.contains('open'),
    prompt: document.getElementById('mealTypeOverlay').classList.contains('open'),
    rows: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs').flatMap(w => Array.isArray(w.rows) ? w.rows : [w.rows])
      .map(r => r.recipe_id === r2 && r.cooked_on === today && !r.premade) }), [ffM, PM_TODAY, PM_R2]);
  check('    a dish cooked fresh as planned is logged at once, with no question',
        !ffSoup.ask && ffSoup.prompt && JSON.stringify(ffSoup.rows) === '[true]', JSON.stringify(ffSoup));
  await ff.close();

  /* ---- Issues #85, #86, #89, #93 (11 Oct 2026) ----
     On a tablet-sized page: the recipe box fills half the screen, so the preview opens out of sight (#85). A made-up
     recipe with a 20-second step (#86). The switch's new name (#89) and the Drink course (#93). */
  console.log('\nParse feedback, seconds, COOKING MODE, Drink');
  const ia = await browser.newPage({ viewport: { width: 800, height: 1280 } });
  ia.__label = 'issues 85-93';
  await ia.clock.setFixedTime(FIXTURE_NOW);
  await ia.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await ia.waitForTimeout(1500);
  await ia.evaluate(() => openAddModal());
  await ia.evaluate(() => document.getElementById('parseBtn').click());
  await ia.waitForTimeout(300);
  const iaEmpty = await ia.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '',
    shown: document.getElementById('addForm').style.display, line: !document.getElementById('parseResult').hidden }));
  check('    PARSE & PREVIEW with nothing pasted says so, rather than doing nothing',
        /Paste a recipe first/.test(iaEmpty.toast) && iaEmpty.shown === 'none' && !iaEmpty.line, JSON.stringify(iaEmpty));
  const IA_RECIPE = ['TITLE: Test Toast', 'SOURCE: Personal recipe', 'SERVINGS: 2', 'TAGS: course=Snack', '',
    'GROUP bread:', '2 slices bread', '', 'GROUP top:', '1 tbsp butter', '',
    'STAGE:', 'MERGE bread -> toast: toast the bread [20 sec]', '',
    'STAGE:', 'MERGE toast, top -> done: butter it [30-45 sec]'].join('\n');
  const iaInView = () => ia.evaluate(() => {
    const ov = document.getElementById('addModalOverlay').getBoundingClientRect(), r = document.getElementById('addBands').getBoundingClientRect();
    return { top: Math.round(r.top), inView: r.top >= ov.top - 2 && r.top < 200,
      scroll: Math.round(document.getElementById('addModalOverlay').scrollTop) };
  });
  const iaBefore = await ia.evaluate(t => { document.getElementById('importInput').value = t; return document.getElementById('addModalOverlay').scrollTop; }, IA_RECIPE);
  await ia.evaluate(() => document.getElementById('parseBtn').click());
  await ia.waitForTimeout(900);
  const iaRead = await iaInView();
  const iaLine = await ia.evaluate(() => ({ hidden: document.getElementById('parseResult').hidden, text: document.getElementById('parseResult').textContent }));
  check('    PARSE & PREVIEW says what it read beside the button, and brings the preview into view',
        iaBefore === 0 && iaRead.inView && iaRead.scroll > 0 && !iaLine.hidden && /^Read 2 ingredients and 2 steps\. .*below/.test(iaLine.text),
        JSON.stringify({ iaBefore, iaRead, iaLine }));
  await ia.evaluate(() => { document.getElementById('addModalOverlay').scrollTop = 0; document.getElementById('recheckBtn').click(); });
  await ia.waitForTimeout(900);
  const iaQuiet = await iaInView();
  check('    a re-parse nobody asked to see (RE-CHECK) leaves the page where it is', iaQuiet.scroll === 0 && !iaQuiet.inView, JSON.stringify(iaQuiet));
  const iaBadges = await ia.evaluate(() => [...document.querySelectorAll('#addPreview .step-duration')].map(b => b.textContent.trim()));
  check('    a 20-second step reads 20 SEC, and a range under a minute 30–45 SEC, not fractions of a minute',
        JSON.stringify(iaBadges) === JSON.stringify(['20 SEC', '30–45 SEC']), JSON.stringify(iaBadges));
  const iaTicks = await ia.evaluate(t => {
    const p = parseRecipe(t), box = document.createElement('div');
    box.innerHTML = buildTimelineHTML(computeTimeline(p.groups, p.stages));
    return { ticks: [...box.querySelectorAll('.timeline-tick')].map(e => e.textContent), head: box.querySelector('.timeline-strip-head').textContent };
  }, IA_RECIPE);
  check('    a timeline under a minute marks its ticks in seconds, not "+0 min" five times',
        iaTicks.ticks.length === 6 && new Set(iaTicks.ticks).size === 6 && iaTicks.ticks.slice(1).every(x => /^\+\d+ sec$/.test(x)) && /TOTAL: \d+ sec/.test(iaTicks.head),
        JSON.stringify(iaTicks));
  const iaOpts = await ia.evaluate(() => ({ select: [...document.querySelectorAll('#f-course option')].map(o => o.value) }));
  await ia.evaluate(() => { const o = document.getElementById('addModalOverlay'); o.classList.remove('open'); document.body.style.overflow = ''; showView('recipes'); renderHome(); });
  const iaChips = await ia.evaluate(() => !!document.querySelector('#filterRows .chip[data-cat="course"][data-val="Drink"]'));
  const iaLabels = await ia.evaluate(() => [...document.querySelectorAll('.keep-awake-toggle')].map(t => (t.closest('label') || t.parentElement).textContent.trim()));
  check('    Drink is a course: in the edit form\'s list after Dessert, and among the COURSE filters',
        iaOpts.select.indexOf('Drink') === iaOpts.select.indexOf('Dessert') + 1 && iaChips, JSON.stringify({ iaOpts, iaChips }));
  check('    the cooking switch reads COOKING MODE on the recipe and the group page, and KEEP AWAKE has gone',
        iaLabels.length === 2 && iaLabels.every(l => l === 'COOKING MODE'), JSON.stringify(iaLabels));
  // Pasting is how most recipes arrive: it parses by itself, and has to show it as the button does.
  await ia.evaluate(t => { openAddModal(); const ta = document.getElementById('importInput'); ta.value = t; ta.dispatchEvent(new Event('paste')); }, IA_RECIPE);
  await ia.waitForTimeout(900);
  const iaPaste = await iaInView();
  const iaPasteLine = await ia.evaluate(() => !document.getElementById('parseResult').hidden);
  check('    a paste shows what it read and brings the preview into view, as the button does',
        iaPaste.inView && iaPaste.scroll > 0 && iaPasteLine, JSON.stringify({ iaPaste, iaPasteLine }));
  await ia.close();

  /* ---- FROZEN (issue #90, 11 Oct 2026) ----
     A made-up recipe planned today: a line that says frozen is shopped in a FROZEN section, last before Other, and FROZEN is
     one of the aisles a household can choose in Settings. */
  console.log('\nFROZEN aisle');
  const fz = await browser.newPage();
  fz.__label = 'frozen';
  await fz.clock.setFixedTime(FIXTURE_NOW);
  await fz.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await fz.waitForTimeout(1500);
  const fzList = await fz.evaluate(async () => {
    const d = new Date(); d.setHours(0,0,0,0); const today = isoLocal(d);
    cache.recipes.push({ ...loadRecipes()[0], id: 'fzfzfzfz-0000-4000-8000-000000000001', title: 'Test Frozen Supper', history: [], favourite: false,
      syntax: 'TITLE: Test Frozen Supper\nSERVINGS: 2\nGROUP a:\n200 g frozen peas\n1 onion\n\nSTAGE:\nMERGE a -> b: cook [5 min]' });
    addPlanRecipe(today, 'fzfzfzfz-0000-4000-8000-000000000001');
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    const list = buildShoppingList(groupDaysByWeek(dayList())[0] || []);
    showView('shopping'); renderShopping();
    const titles = [...document.querySelectorAll('#view-shopping .shop-category-title')].map(e => e.textContent.trim());
    const frozenCat = list.categories.find(c => c.name === 'Frozen');
    return { order: list.categories.map(c => c.name), titles, frozen: frozenCat ? frozenCat.items.map(i => i.name) : [] };
  });
  const fzNames = fzList.order.filter(n => n !== 'Other');
  check('    a planned line that says frozen is shopped in a FROZEN section, the last before Other',
        fzNames[fzNames.length - 1] === 'Frozen' && fzList.frozen.includes('Frozen peas') && fzList.titles.includes('FROZEN')
        && !fzList.frozen.includes('Onion'), JSON.stringify(fzList));
  const fzChoice = await fz.evaluate(() => { aisleOverridesAvailable = true; renderAisleOverridesList();
    return [...document.querySelectorAll('#aisleOverride-aisle option')].map(o => o.value); });
  check('    Settings → SHOPPING AISLES offers FROZEN', fzChoice.includes('Frozen'), JSON.stringify(fzChoice));
  await fz.close();

  /* ---- Your own photo as a recipe's picture (issue #92, 11 Oct 2026) ----
     A made-up recipe and a drawn picture. The photo is chosen into the form, kept through a re-parse, uploaded by SAVE
     before the row, into this household's own folder of recipe-images, and never sent to be re-hosted. */
  console.log('\nUpload your own recipe photo');
  const rp = await browser.newPage();
  rp.__label = 'recipe photo';
  await rp.clock.setFixedTime(FIXTURE_NOW);
  await rp.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await rp.waitForTimeout(1500);
  const rpPng = (w, h) => rp.evaluate(([w, h]) => new Promise(res => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#4a8'; x.fillRect(0, 0, w, h);
    c.toBlob(b => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(b); }, 'image/png'); }), [w, h]);
  const RP_RECIPE = ['TITLE: Test Garden Tart', 'SOURCE: Personal recipe', 'SERVINGS: 4', 'IMAGE: https://example.invalid/hero.jpg', 'TAGS: course=Main', '',
    'GROUP a:', '1 sheet puff pastry', '200 g cherry tomatoes', '', 'STAGE:', 'MERGE a -> done: bake [25 min]'].join('\n');
  await rp.evaluate(t => { openAddModal(); document.getElementById('importInput').value = t; parseAndPreview({ reveal: true }); }, RP_RECIPE);
  await rp.waitForTimeout(300);
  await rp.setInputFiles('#recipePhotoInput', [{ name: 'my-tart.png', mimeType: 'image/png', buffer: Buffer.from(await rpPng(2400, 1800), 'base64') }]);
  await rp.waitForFunction(() => !!pendingRecipePhoto, null, { timeout: 5000 });
  const rpChosen = await rp.evaluate(() => ({ preview: !document.getElementById('recipePhotoPreview').hidden, field: document.getElementById('f-image').value,
    before: document.getElementById('addBeforeSave').textContent }));
  check('    UPLOAD PHOTO shows the photo in the form, empties the link, and BEFORE YOU SAVE says it will be stored',
        rpChosen.preview && rpChosen.field === '' && /Stores your photo as the recipe's picture/.test(rpChosen.before) && !/Copies the photo/.test(rpChosen.before),
        JSON.stringify(rpChosen));
  await rp.evaluate(() => document.getElementById('recheckBtn').click());
  await rp.waitForTimeout(200);
  const rpKept = await rp.evaluate(() => ({ kept: !!pendingRecipePhoto, field: document.getElementById('f-image').value }));
  check('    a re-parse keeps the chosen photo, though the text still names a link', rpKept.kept && rpKept.field === '', JSON.stringify(rpKept));
  await rp.setInputFiles('#recipePhotoInput', [{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') }]);
  await rp.waitForTimeout(300);
  const rpRefused = await rp.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '', kept: !!pendingRecipePhoto }));
  check('    a file that is not a photo is refused, and the chosen photo stays', /isn't a photo/.test(rpRefused.toast) && rpRefused.kept, JSON.stringify(rpRefused));
  const rpMark = await rp.evaluate(() => ({ s: window.__STORAGE__.length, l: window.__LOG__.length, w: window.__WRITES__.length, i: window.__INVOKES__.length }));
  await rp.evaluate(() => document.getElementById('saveBtn').click());
  await rp.waitForTimeout(300);
  await pmDrain(rp);
  const rpSaved = await rp.evaluate(async m => {
    const r = loadRecipes().find(x => x.title === 'Test Garden Tart');
    const ups = window.__STORAGE__.slice(m.s).filter(x => x.op === 'upload');
    const row = window.__WRITES__.slice(m.w).filter(w => w.table === 'recipes').flatMap(w => Array.isArray(w.rows) ? w.rows : [w.rows]).find(x => x && x.title === 'Test Garden Tart') || {};
    const log = window.__LOG__.slice(m.l).filter(l => /^(write-done:recipes|storage-done:upload)/.test(l));
    const file = ups[0] && window.__STORAGE_FILES__[ups[0].path];
    const dims = file ? await new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res(null); im.src = file; }) : null;
    return { id: r && r.id, ups: ups.map(u => ({ bucket: u.bucket, path: u.path, type: u.contentType, upsert: u.upsert })), image: r && r.imageUrl, rowImage: row.image_url,
      line: r && (r.syntax.split('\n').find(l => /^IMAGE:/.test(l)) || ''), log, dims, household: HOUSEHOLD_ID, prefix: SELF_HOST_PREFIX,
      invokes: window.__INVOKES__.slice(m.i).map(c => c.name), photoLeft: !!pendingRecipePhoto };
  }, rpMark);
  const rpPath = rpSaved.id ? `${rpSaved.household}/${rpSaved.id}.jpg` : '?';
  check('    SAVE uploads the photo, shrunk to 1600 px and as JPEG, to this household\'s own folder, named by the recipe',
        rpSaved.ups.length === 1 && rpSaved.ups[0].bucket === 'recipe-images' && rpSaved.ups[0].path === rpPath && rpSaved.ups[0].type === 'image/jpeg'
        && rpSaved.ups[0].upsert && JSON.stringify(rpSaved.dims) === '[1600,1200]', JSON.stringify(rpSaved));
  check('    the recipe\'s picture and its IMAGE: line are that file\'s address with a ?v=, written after the file, and never sent to be re-hosted',
        rpSaved.image && rpSaved.image.startsWith(rpSaved.prefix + rpPath + '?v=') && rpSaved.rowImage === rpSaved.image && rpSaved.line === 'IMAGE: ' + rpSaved.image
        && rpSaved.log[0] === 'storage-done:upload' && rpSaved.log.includes('write-done:recipes') && !rpSaved.invokes.includes('rehost-images') && !rpSaved.photoLeft,
        JSON.stringify(rpSaved));
  // Typing a link afterwards means the link is wanted.
  await rp.evaluate(() => openAddModal());
  await rp.setInputFiles('#recipePhotoInput', [{ name: 'again.png', mimeType: 'image/png', buffer: Buffer.from(await rpPng(400, 300), 'base64') }]);
  await rp.waitForFunction(() => !!pendingRecipePhoto, null, { timeout: 5000 });
  await rp.evaluate(() => { const f = document.getElementById('f-image'); f.value = 'https://example.invalid/other.jpg'; f.dispatchEvent(new Event('input')); });
  const rpLink = await rp.evaluate(() => ({ photo: !!pendingRecipePhoto, preview: !document.getElementById('recipePhotoPreview').hidden }));
  check('    typing a link instead lets the chosen photo go', !rpLink.photo && !rpLink.preview, JSON.stringify(rpLink));
  /* Another household's uploaded photo, as ADD TO OUR RECIPES meets it: copied into our own folder. The picture is
     handed back by a stand-in fetch, so nothing here reaches the network. */
  const rpCopy = await rp.evaluate(async () => {
    const other = '11111111-2222-4333-8444-555555555555', url = `${SELF_HOST_PREFIX}${other}/abc.jpg?v=1760000000000`;
    const realFetch = window.fetch;
    window.fetch = async () => new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 });
    const m = window.__STORAGE__.length;
    loadRecipes().push({ id: 'rp-copy', title: 'RP Copy', imageUrl: url, syntax: 'TITLE: RP Copy\nIMAGE: ' + url, tags: { course: '', keywords: [] }, history: [] });
    copySharedImage('rp-copy', url);
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    window.fetch = realFetch;
    return { up: window.__STORAGE__.slice(m).filter(x => x.op === 'upload').map(x => x.path), image: loadRecipes().find(r => r.id === 'rp-copy').imageUrl, mine: `${SELF_HOST_PREFIX}${HOUSEHOLD_ID}/rp-copy.jpg` };
  });
  check('    a photo another household uploaded is copied into our own folder when added to our recipes, never theirs',
        JSON.stringify(rpCopy.up) === JSON.stringify([rpCopy.mine.slice(rpCopy.mine.indexOf('recipe-images/') + 14)]) && rpCopy.image === rpCopy.mine, JSON.stringify(rpCopy));
  await rp.close();

  /* ---- The version, what's new, and a newer version while a tab is open (issue #91, 11 Oct 2026) ----
     The page's own APP_VERSION at the top of a made-up log of six entries; then a newer one, as if just merged. */
  console.log('\nVersion and what\'s new');
  const vnLog = ver => [ver, '2026-10-01.1', '2026-09-30.2', '2026-09-30.1', '2026-09-29.1', '2026-09-28.1'].map((v, i) => (
    { version: v, date: v.split('.')[0], ...(i === 0 ? { issues: [91] } : {}), changes: [`Test change ${i + 1}`] }));
  const vn = await browser.newPage();
  vn.__label = 'version';
  const vnApp = await (async () => { const m = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').match(/const APP_VERSION = '([^']+)'/); return m && m[1]; })();
  await vn.addInitScript(log => { window.__CHANGELOG__ = log; try { localStorage.setItem('kitchen.lastSeenVersion', '2000-01-01.1'); } catch(e){} }, vnLog(vnApp));
  await vn.clock.setFixedTime(FIXTURE_NOW);
  await vn.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await vn.waitForTimeout(1500);
  const vnStart = await vn.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '', seen: localStorage.getItem('kitchen.lastSeenVersion'),
    bar: !document.getElementById('coreBar').hidden, fetches: window.__CHANGELOG_FETCHES__ || 0, app: APP_VERSION }));
  check('    the first load on a newer version says so once, and remembers it on this device; the same version shows no bar',
        new RegExp('^Updated to ' + vnStart.app.replace(/\./g, '\\.') + ': see what\'s new').test(vnStart.toast) && vnStart.seen === vnStart.app && !vnStart.bar && vnStart.fetches >= 1,
        JSON.stringify(vnStart));
  const vnHelp = await vn.evaluate(() => { showView('settings'); showSettingsTab('help');
    return { version: document.getElementById('appVersion').textContent, entries: [...document.querySelectorAll('#whatsNewList .whats-new-entry')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      link: (document.querySelector('#whatsNewList a') || {}).href || '' }; });
  check('    Settings → HELP shows the version and the five newest entries, with a link to the issue',
        vnHelp.version === vnStart.app && vnHelp.entries.length === 5 && /Test change 1/.test(vnHelp.entries[0]) && !vnHelp.entries.some(e => /Test change 6/.test(e))
        && /\/issues\/91$/.test(vnHelp.link), JSON.stringify(vnHelp));
  const vnNewer = vnStart.app.split('.')[0] + '.' + (parseInt(vnStart.app.split('.')[1], 10) + 9);
  const vnReturn = await vn.evaluate(async newer => {
    window.__CHANGELOG_FETCHES__ = 0; lastVersionCheck = 0;
    window.__CHANGELOG__ = [{ version: newer, date: newer.split('.')[0], changes: ['Test newer'] }];
    await onSignedIn(); await new Promise(r => setTimeout(r, 50));
    const first = { fetches: window.__CHANGELOG_FETCHES__, bar: !document.getElementById('coreBar').hidden, text: document.getElementById('coreBarText').textContent };
    await onSignedIn(); await new Promise(r => setTimeout(r, 50));
    return { ...first, after: window.__CHANGELOG_FETCHES__ };
  }, vnNewer);
  check('    returning to a tab when a newer version is out turns the UPDATE bar on, and two returns in ten minutes ask once',
        vnReturn.fetches === 1 && vnReturn.bar && vnReturn.text === 'A new version is ready.' && vnReturn.after === 1, JSON.stringify({ vnNewer, vnReturn }));
  await vn.context().setOffline(true);
  const vnOff = await vn.evaluate(async () => { window.__CHANGELOG_FETCHES__ = 0; lastVersionCheck = 0; await checkForNewVersion(true); return window.__CHANGELOG_FETCHES__; });
  await vn.context().setOffline(false);
  check('    offline, it does not ask', vnOff === 0, String(vnOff));
  const vnNone = await vn.evaluate(async () => { changelogCache = null; window.__CHANGELOG__ = null; lastVersionCheck = 0;
    showSettingsTab('ingredients'); showSettingsTab('help'); await new Promise(r => setTimeout(r, 50));
    return { version: document.getElementById('appVersion').textContent, list: document.getElementById('whatsNewList').textContent.trim() }; });
  check('    with no log to be had, HELP still shows the version and says what\'s new needs a connection',
        vnNone.version === vnStart.app && vnNone.list === "What's new needs a connection.", JSON.stringify(vnNone));
  await vn.close();
  const vf = await browser.newPage();
  vf.__label = 'version, first visit';
  await vf.clock.setFixedTime(FIXTURE_NOW);
  await vf.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await vf.waitForTimeout(1500);
  const vfFirst = await vf.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '', seen: localStorage.getItem('kitchen.lastSeenVersion'), app: APP_VERSION,
    bar: !document.getElementById('coreBar').hidden, barText: document.getElementById('coreBarText').textContent }));
  check('    a first visit shows no update line, only remembers the version; the bar keeps its own words for a half-arrived update',
        !/^Updated to/.test(vfFirst.toast) && vfFirst.seen === vfFirst.app && !vfFirst.bar && vfFirst.barText === 'This page is part-way through an update.', JSON.stringify(vfFirst));
  await vf.close();

  /* ---- Lost changes, part 1 (12 Oct 2026, the October review's PR 4: F14, F15, F20, F32, F33, F39, F46) ----
     Small ways a change was silently lost or undone. Each check below was seen failing against the code it guards. A
     fresh page, so the main page's state is not disturbed; made-up recipes, copied from a fixture one under new ids. */
  console.log('\nLost changes, part 1');
  const lx = await browser.newPage();
  lx.__label = 'lost changes';
  /* The writes these checks have the server refuse are logged as failed: that is the point of them. */
  lx.__expectConsole = /^Sync failed: recipes /;
  /* A planner row carrying `premade` is what tells the app add-premade.md is in (premadeAvailable). */
  await lx.addInitScript(() => { window.__STUB_EXTRA__ = { recipe_notes: [], planner_days: [{ household_id: '286a8a12-c12a-4b83-afbc-0912533f6b1c',
    plan_date: '2026-01-05', is_blank: false, recipe_ids: ['11111111-1111-4111-8111-111111111111'], servings: [], premade: [] }] }; });
  await lx.clock.setFixedTime(FIXTURE_NOW);
  await lx.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await lx.waitForTimeout(1500);
  const LC_HOUSE = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
  /* In the page: wait until the write queue has nothing left, including writes queued by writes. */
  const lxDrain = () => lx.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue); });
  const lxCopy = (title, extra) => lx.evaluate(([title, extra]) => {
    const r = { ...loadRecipes().find(x => x.title === 'Test Pasta'), id: uid(), title, history: [], ...(extra || {}) };
    saveRecipe(r);
    return r.id;
  }, [title, extra || null]);
  const lxDay = off => lx.evaluate(o => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + o); return isoLocal(d); }, off);
  const LC_TODAY = await lxDay(0), LC_LATER = await lxDay(10), LC_YESTERDAY = await lxDay(-1);
  const LC_KEEP = await lx.evaluate(() => loadRecipes().find(x => x.title === 'Test Pasta').id);

  // F14 and F20: deleting a recipe keeps the other dishes' PRE-MADE, and takes its diary rows out of the cache.
  const lxGone = await lxCopy('LC Gone Soon');
  await lx.evaluate(([day, today, keep, gone]) => {
    addPlanRecipe(day, keep); addPlanRecipe(day, gone); setPlanPremadeAt(day, 0, 'dinner');
    addDiaryEntry({ recipeId: gone, cookedOn: today });
  }, [LC_LATER, LC_TODAY, LC_KEEP, lxGone]);
  await lxDrain();
  const lxM1 = await lx.evaluate(() => window.__WRITES__.length);
  await lx.evaluate(id => deleteRecipe(id), lxGone);
  await lxDrain();
  const lxDel = await lx.evaluate(([m, day, gone]) => ({
    ids: planRecipeIds(loadPlan()[day]), premade: planPremade(loadPlan()[day]),
    written: window.__WRITES__.slice(m).filter(w => w.table === 'planner_days' && w.op === 'upsert').flatMap(w => w.rows).filter(r => r.plan_date === day).map(r => r.premade),
    diary: loadDiary().filter(e => e.recipeId === gone).length, exported: exportPayload().diary.filter(e => e.recipeId === gone).length
  }), [lxM1, LC_LATER, lxGone]);
  check('deleting a recipe keeps PRE-MADE on the other dishes of its days, in the cache and in the Planner write (F14)',
        JSON.stringify(lxDel.ids) === JSON.stringify([LC_KEEP]) && JSON.stringify(lxDel.premade) === '["dinner"]'
        && lxDel.written.length > 0 && JSON.stringify(lxDel.written[lxDel.written.length - 1]) === '["dinner"]', JSON.stringify(lxDel));
  check('    and its diary rows leave the cache, so an export taken at once carries none for a recipe it does not contain (F20)',
        lxDel.diary === 0 && lxDel.exported === 0, JSON.stringify(lxDel));
  // F20: a backup whose diary names a recipe the file does not hold restores the rest, without that row.
  const LC_MISSING = 'dddddddd-0000-4000-8000-dddddddddddd';
  const lxBackup = await lx.evaluate(([missing, today]) => JSON.stringify({
    app: 'Kitchen', version: 3, recipes: loadRecipes(), plan: loadPlan(), shortlist: loadShortlist(), keywordVocab: loadKeywordVocab(),
    shoppingChecked: loadShoppingChecked(), swaps: loadSwaps(), groups: loadGroups(), settings: loadSettings(), aliases: loadAliases(),
    diary: loadDiary().concat([{ id: 'eeeeeeee-0000-4000-8000-eeeeeeeeeeee', recipeId: missing, title: '', cookedOn: today, mealType: 'dinner', note: '' }])
  }), [LC_MISSING, LC_TODAY]);
  /* Writes held back for the import, so the cache is read as the import set it, before its history write lands and
     rebuilds it from the rows it sent: each holds a gap of its own, and the two are checked apart. */
  const [lxM2, lxL2] = await lx.evaluate(() => { window.__WRITE_DELAY__ = 1500; return [window.__WRITES__.length, window.__LOG__.length]; });
  lx.once('dialog', d => d.accept());
  await lx.setInputFiles('#importFileInput', { name: 'lx-backup.json', mimeType: 'application/json', buffer: Buffer.from(lxBackup) });
  await lx.waitForTimeout(500);
  const lxImpEarly = await lx.evaluate(([missing, l]) => ({ cache: loadDiary().some(e => e.recipeId === missing), total: loadDiary().length,
    sentYet: window.__LOG__.slice(l).includes('write-done:recipe_logs') }), [LC_MISSING, lxL2]);
  await lx.evaluate(() => { window.__WRITE_DELAY__ = 0; });
  await lxDrain();
  const lxImp = await lx.evaluate(([m, missing]) => ({
    cache: loadDiary().some(e => e.recipeId === missing), total: loadDiary().length,
    sent: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs' && w.op === 'upsert').flatMap(w => w.rows),
  }), [lxM2, LC_MISSING]);
  check('    a backup\'s diary row for a recipe the file does not hold is left out of the restore, in the cache and in the write (F20)',
        !lxImpEarly.sentYet && !lxImpEarly.cache && lxImpEarly.total > 0 && !lxImp.cache && lxImp.total > 0 && lxImp.sent.length > 0
        && !lxImp.sent.some(r => r.recipe_id === LC_MISSING), JSON.stringify({ early: lxImpEarly, cache: lxImp.cache, total: lxImp.total, sent: lxImp.sent.length }));

  // F32: a refused row delete takes no source files with it; they go once the delete lands.
  const lxPhotoPath = `${LC_HOUSE}/lx/p1.jpg`;
  const lxPhotos = await lxCopy('LC With Photos', { sourcePhotos: [{ path: lxPhotoPath, added: '2026-09-01T10:00:00.000Z' }] });
  await lxDrain();
  const lxRefused = await lx.evaluate(async id => {
    window.__WRITE_FAIL_TABLES__ = { recipes: 'refused' };
    const s = window.__STORAGE__.length;
    deleteRecipe(id);
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    return { removes: window.__STORAGE__.slice(s).filter(x => x.op === 'remove').length, toast: document.querySelector('.toast').textContent };
  }, lxPhotos);
  const lxLanded = await lx.evaluate(async () => {
    window.__WRITE_FAIL_TABLES__ = {};
    const s = window.__STORAGE__.length, l = window.__LOG__.length;
    flushFailedWrites();
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    return { removes: window.__STORAGE__.slice(s).filter(x => x.op === 'remove').map(x => x.paths),
      order: window.__LOG__.slice(l).filter(x => x === 'write-done:recipes' || x === 'storage-done:remove') };
  });
  check('a recipe delete the server refuses removes none of its source files, and says the server refused it rather than blaming the connection (F32)',
        lxRefused.removes === 0 && /the server refused it/.test(lxRefused.toast) && !/check your connection/.test(lxRefused.toast), JSON.stringify(lxRefused));
  check('    once the delete lands on a retry, its files go, after it',
        lxLanded.removes.length === 1 && JSON.stringify(lxLanded.removes[0]) === JSON.stringify([lxPhotoPath])
        && lxLanded.order.join(',') === 'write-done:recipes,storage-done:remove', JSON.stringify(lxLanded));

  // F33: FOLD INTO NOTES deletes the note only once the recipe's save has landed.
  const lxFoldRecipe = await lxCopy('LC Fold Target');
  await lxDrain();
  const lxNote = await lx.evaluate(id => addRecipeNote(id, 'A made-up note about resting it longer').id, lxFoldRecipe);
  await lxDrain();
  await lx.evaluate(([r, n]) => { foldNoteIntoRecipe(r, n); }, [lxFoldRecipe, lxNote]);
  await lx.waitForTimeout(300);
  const lxM3 = await lx.evaluate(() => { window.__WRITE_FAIL_TABLES__ = { recipes: 'refused' }; return window.__WRITES__.length; });
  await lx.click('#saveBtn');
  await lx.waitForTimeout(400);
  await lxDrain();
  const lxFoldRefused = await lx.evaluate(([m, n]) => ({
    deletes: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_notes' && w.op === 'delete').length,
    inTab: loadRecipeNotes().some(x => x.id === n) }), [lxM3, lxNote]);
  const lxFoldLanded = await lx.evaluate(async ([m, n]) => {
    window.__WRITE_FAIL_TABLES__ = {};
    const l = window.__LOG__.length;
    flushFailedWrites();
    let t; do { t = writeQueue; await t; } while(t !== writeQueue);
    return { deletes: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_notes' && w.op === 'delete').map(w => w.eqs.map(e => e.value)),
      order: window.__LOG__.slice(l).filter(x => x === 'write-done:recipes' || x === 'write-done:recipe_notes') };
  }, [lxM3, lxNote]);
  check('FOLD INTO NOTES: a save the server refuses deletes no note from the server, though the note leaves this tab (F33)',
        lxFoldRefused.deletes === 0 && !lxFoldRefused.inTab, JSON.stringify(lxFoldRefused));
  check('    and the save\'s retry, once it lands, deletes that note, after it',
        lxFoldLanded.deletes.length === 1 && JSON.stringify(lxFoldLanded.deletes[0]) === JSON.stringify([LC_HOUSE, lxNote])
        && lxFoldLanded.order.join(',') === 'write-done:recipes,write-done:recipe_notes', JSON.stringify(lxFoldLanded));

  // F39: a fresh and a pre-made copy of one recipe on a day; the fresh one taken off; no second freezer row.
  const lxTwice = await lxCopy('LC Twice Today');
  await lx.evaluate(([today, id]) => { addPlanRecipe(today, id); addPlanRecipe(today, id); setPlanPremadeAt(today, 1, 'dinner'); }, [LC_TODAY, lxTwice]);
  await lxDrain();
  await lx.evaluate(today => { removePlanRecipeAt(today, planRecipeIds(loadPlan()[today]).length - 2); logDuePremade(); }, LC_TODAY);
  await lxDrain();
  const lxRows = await lx.evaluate(([today, id]) => loadDiary().filter(e => e.recipeId === id && e.premade && e.cookedOn === today).map(e => e.mealType), [LC_TODAY, lxTwice]);
  check('a day with a fresh and a pre-made copy of one recipe keeps one freezer row when the fresh copy is taken off (F39)',
        JSON.stringify(lxRows) === '["dinner"]', JSON.stringify(lxRows));
  // F39: the meal changed on the Planner is changed in the diary.
  const lxM4 = await lx.evaluate(() => window.__WRITES__.length);
  /* As the Planner does it: PRE-MADE off (the row stays), then on again as lunch. */
  await lx.evaluate(([today, id]) => { const i = planRecipeIds(loadPlan()[today]).lastIndexOf(id); setPlanPremadeAt(today, i, ''); setPlanPremadeAt(today, i, 'lunch'); }, [LC_TODAY, lxTwice]);
  await lxDrain();
  const lxMeal = await lx.evaluate(([m, today, id]) => ({
    diary: loadDiary().filter(e => e.recipeId === id && e.premade && e.cookedOn === today).map(e => e.mealType),
    sent: window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs' && w.op === 'update').map(w => w.patch) }), [lxM4, LC_TODAY, lxTwice]);
  check('    switching that dish off and on again as lunch changes the freezer row from dinner to lunch, in the cache and on the server',
        JSON.stringify(lxMeal.diary) === '["lunch"]' && lxMeal.sent.some(p => p.meal_type === 'lunch'), JSON.stringify(lxMeal));
  // F39: answered "from the freezer", then PRE-MADE switched off: finishing the flow logs it as cooked.
  await lx.evaluate(id => finishRecipe(id), lxTwice);
  await lx.waitForTimeout(200);
  const lxAsked = await lx.evaluate(() => document.getElementById('freshOrFreezerOverlay').classList.contains('open'));
  await lx.evaluate(() => document.getElementById('freshOrFreezerFreezer').click());
  await lx.evaluate(([today, id]) => { const i = planRecipeIds(loadPlan()[today]).lastIndexOf(id); setPlanPremadeAt(today, i, ''); finishRecipe(id); }, [LC_TODAY, lxTwice]);
  await lx.waitForTimeout(200);
  const lxFinished = await lx.evaluate(([today, id]) => ({ history: loadRecipes().find(r => r.id === id).history.includes(today),
    cooked: loadDiary().filter(e => e.recipeId === id && !e.premade && e.cookedOn === today).length }), [LC_TODAY, lxTwice]);
  await lx.evaluate(() => { const b = document.querySelector('#mealTypeOverlay .meal-type-skip, #mealTypeSkip'); if(b) b.click(); });
  check('    answered "from the freezer", then PRE-MADE switched off: finishing the flow again logs it as cooked (F39)',
        lxAsked && lxFinished.history && lxFinished.cooked === 1, JSON.stringify({ lxAsked, lxFinished }));

  // F15: REMOVE on a freezer entry the plan still marks PRE-MADE also takes PRE-MADE off, so it does not come back.
  const lxYest = await lxCopy('LC Yesterday From The Freezer');
  await lx.evaluate(([y, id]) => { addPlanRecipe(y, id); setPlanPremadeAt(y, planRecipeIds(loadPlan()[y]).lastIndexOf(id), 'lunch'); }, [LC_YESTERDAY, lxYest]);
  await lxDrain();
  const lxEntry = await lx.evaluate(([y, id]) => (loadDiary().find(e => e.recipeId === id && e.premade && e.cookedOn === y) || {}).id, [LC_YESTERDAY, lxYest]);
  await lx.evaluate(y => { state.historySelectedDate = y; showView('history'); }, LC_YESTERDAY);
  await lx.waitForTimeout(250);
  let lxConfirm = '';
  lx.once('dialog', d => { lxConfirm = d.message(); d.accept(); });
  await lx.click(`[data-delete-log="${lxEntry}"]`);
  await lx.waitForTimeout(250);
  await lxDrain();
  const lxBack = await lx.evaluate(([y, id, entry]) => {
    const again = logDuePremade();
    const i = planRecipeIds(loadPlan()[y]).lastIndexOf(id);
    return { again, premade: planPremade(loadPlan()[y])[i], inDiary: loadDiary().some(e => e.id === entry) };
  }, [LC_YESTERDAY, lxYest, lxEntry]);
  check('REMOVE on a freezer entry says PRE-MADE comes off that dish, takes it off, and the next load does not bring the entry back (F15)',
        !!lxEntry && /PRE-MADE comes off it on the Planner too/.test(lxConfirm) && lxBack.premade === '' && !lxBack.inDiary && lxBack.again === 0,
        JSON.stringify({ lxEntry, lxConfirm, lxBack }));

  // F46: a source file that cannot be had says to add it again through EDIT; a card whose picture will not load says so.
  const lxMissing = await lxCopy('LC Missing Photo', { sourcePhotos: [{ path: `${LC_HOUSE}/lx/never-arrived.jpg`, added: '2026-09-01T10:00:00.000Z' }],
    imageUrl: 'https://mhkayefzrtceesgizkjs.supabase.co/storage/v1/object/public/recipe-images/lx/never-arrived.jpg' });
  await lxDrain();
  await lx.evaluate(id => openRecipe(id, 'recipes'), lxMissing);
  await lx.waitForTimeout(300);
  await lx.evaluate(() => { const b = document.querySelector('[data-source-photos], .rv-source-photos, [data-photo-chip]'); if(b) b.click(); });
  await lx.waitForTimeout(500);
  const lxMissingText = await lx.evaluate(() => [...document.querySelectorAll('.photo-missing')].map(e => e.textContent));
  await lx.evaluate(() => showView('recipes'));
  await lx.waitForTimeout(600);
  const lxCard = await lx.evaluate(() => { const c = [...document.querySelectorAll('.rcard')].find(x => /LC Missing Photo/.test(x.textContent));
    const box = c && c.querySelector('.rcard-photo'); return box ? { broken: box.classList.contains('broken'), after: getComputedStyle(box, '::after').content } : null; });
  check('a source photo that never arrived says to add it again through EDIT (F46)',
        lxMissingText.length > 0 && lxMissingText.every(t => /add it again through EDIT/.test(t)), JSON.stringify(lxMissingText));
  check('    and a card whose picture will not load shows the empty frame and PHOTO CAN\'T BE SHOWN, not a broken image',
        !!lxCard && lxCard.broken && /PHOTO CAN'T BE SHOWN/.test(lxCard.after), JSON.stringify(lxCard));
  await lx.close();

  /* ---- The write queue (12 Oct 2026, the October review's PR 5: F5, F8) ----
     A write that fails twice and then lands must not overtake a later write to the same row, and a diary change made
     while its entry's insert is failing must arrive after it. The stub's { how, times } switch fails a table's next n
     writes, then lets them land: the shape no earlier check could make. */
  console.log('\nThe write queue');
  const wq = await browser.newPage();
  wq.__label = 'write queue';
  /* Every write these checks fail on purpose is logged as failed, and the diary's waiting update says what it waits for. */
  wq.__expectConsole = /^Sync failed: (recipes|the food diary|cooking notes) /;
  await wq.addInitScript(() => { window.__STUB_EXTRA__ = { recipe_notes: [] }; });
  await wq.clock.setFixedTime(FIXTURE_NOW);
  await wq.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await wq.waitForTimeout(1500);
  const wqDrain = () => wq.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue); });
  const wqCopy = title => wq.evaluate(title => {
    const r = { ...loadRecipes().find(x => x.title === 'Test Pasta'), id: uid(), title, history: [], favourite: false };
    saveRecipe(r);
    return r.id;
  }, title);
  /* A write to another table, so the pile is re-run, as any later tap would. */
  const wqNudge = () => wq.evaluate(() => saveTick('2026-01-05', 'wq nudge ' + Math.random(), true));

  // 1. F5: favourite on fails twice; favourite off lands; the old "on" never lands after it.
  const wqFav = await wqCopy('WQ Favourite');
  await wqDrain();
  const wqM1 = await wq.evaluate(id => {
    window.__WRITE_FAIL_TABLES__ = { recipes: { how: 'refused', times: 2 } };
    const m = window.__WRITES__.length;
    const r = cache.recipes.find(x => x.id === id);
    r.favourite = true; patchRecipe(id, { favourite: true });
    return m;
  }, wqFav);
  await wqDrain();
  await wq.evaluate(id => { const r = cache.recipes.find(x => x.id === id); r.favourite = false; patchRecipe(id, { favourite: false }); }, wqFav);
  await wqDrain();
  await wqNudge(); await wqDrain();
  await wqNudge(); await wqDrain();
  const wqFavOut = await wq.evaluate(([m, id]) => ({
    sent: window.__WRITES__.slice(m).filter(w => w.table === 'recipes' && w.op === 'update' && w.match && w.match.value === id).map(w => w.patch.favourite),
    fails: window.__WRITE_FAILS__.recipes || 0, unsent: [...unsentLabels], pile: failedWrites.length }), [wqM1, wqFav]);
  check('a favourite switched on (refused twice) then off: the last one sent is off, and the older on is never sent after it (F5)',
        wqFavOut.fails === 2 && wqFavOut.sent[wqFavOut.sent.length - 1] === false && wqFavOut.sent.lastIndexOf(true) < wqFavOut.sent.indexOf(false)
        && wqFavOut.pile === 0 && !wqFavOut.unsent.includes('recipes'), JSON.stringify(wqFavOut));

  // 2. F5: two saves of one recipe's text; the first fails twice; the second's text is the last sent, the first never again.
  const wqEdit = await wqCopy('WQ Edited Twice');
  await wqDrain();
  const wqM2 = await wq.evaluate(id => {
    window.__WRITE_FAIL_TABLES__ = { recipes: { how: 'refused', times: 2 } };
    const m = window.__WRITES__.length;
    const r = { ...cache.recipes.find(x => x.id === id), equipment: 'first edit' };
    saveRecipe(r);
    return m;
  }, wqEdit);
  await wqDrain();
  await wq.evaluate(id => saveRecipe({ ...cache.recipes.find(x => x.id === id), equipment: 'second edit' }), wqEdit);
  await wqDrain();
  await wqNudge(); await wqDrain();
  const wqEditOut = await wq.evaluate(([m, id]) => window.__WRITES__.slice(m).filter(w => w.table === 'recipes' && w.op === 'upsert' && w.rows[0].id === id)
    .map(w => w.rows[0].equipment), [wqM2, wqEdit]);
  check('    two saves of one recipe, the first refused twice: the second is the last sent, and the first is not sent again after it',
        wqEditOut[wqEditOut.length - 1] === 'second edit' && wqEditOut.lastIndexOf('first edit') < wqEditOut.indexOf('second edit'), JSON.stringify(wqEditOut));

  // 2b. Both saves fail, then are retried in order: the older landing first never drops the newer one.
  const wqBoth = await wqCopy('WQ Both Failed');
  await wqDrain();
  const wqM2b = await wq.evaluate(id => {
    window.__WRITE_FAIL_TABLES__ = { recipes: { how: 'network', times: 3 } };
    const m = window.__WRITES__.length;
    saveRecipe({ ...cache.recipes.find(x => x.id === id), equipment: 'older' });
    return m;
  }, wqBoth);
  await wqDrain();
  await wq.evaluate(id => saveRecipe({ ...cache.recipes.find(x => x.id === id), equipment: 'newer' }), wqBoth);
  await wqDrain();
  await wq.evaluate(() => flushFailedWrites()); await wqDrain();
  const wqBothOut = await wq.evaluate(([m, id]) => ({ sent: window.__WRITES__.slice(m).filter(w => w.table === 'recipes' && w.op === 'upsert' && w.rows[0].id === id)
    .map(w => w.rows[0].equipment), pile: failedWrites.length }), [wqM2b, wqBoth]);
  check('    both saves failing, then retried in order: the older lands first and the newer still lands after it',
        wqBothOut.sent[wqBothOut.sent.length - 1] === 'newer' && wqBothOut.sent.slice(-2).join(',') === 'older,newer' && wqBothOut.pile === 0, JSON.stringify(wqBothOut));

  // 3. A partial write never drops an older failed whole-row write: the text still arrives.
  const wqPart = await wqCopy('WQ Text Then Star');
  await wqDrain();
  const wqM3 = await wq.evaluate(id => {
    window.__WRITE_FAIL_TABLES__ = { recipes: { how: 'refused', times: 2 } };
    const m = window.__WRITES__.length;
    saveRecipe({ ...cache.recipes.find(x => x.id === id), equipment: 'text that must arrive' });
    return m;
  }, wqPart);
  await wqDrain();
  await wq.evaluate(id => { const r = cache.recipes.find(x => x.id === id); r.favourite = true; patchRecipe(id, { favourite: true }); }, wqPart);
  await wqDrain();
  await wqNudge(); await wqDrain();
  /* Every write to this recipe in order: the save (refused), its retry (refused), the favourite, then the save again,
     which is the one that lands. Reading only the last upsert would pass on a save that was refused twice and dropped. */
  const wqPartOut = await wq.evaluate(([m, id]) => ({
    order: window.__WRITES__.slice(m).filter(w => w.table === 'recipes' && ((w.rows && w.rows[0].id === id) || (w.match && w.match.value === id)))
      .map(w => w.op === 'upsert' ? 'save:' + w.rows[0].equipment : w.op),
    pile: failedWrites.length, unsent: [...unsentLabels] }), [wqM3, wqPart]);
  check('    a favourite tapped after a refused save of the text does not drop that save: the text is sent again after it, and lands',
        wqPartOut.order.join(',') === 'save:text that must arrive,save:text that must arrive,update,save:text that must arrive'
        && wqPartOut.pile === 0 && !wqPartOut.unsent.includes('recipes'), JSON.stringify(wqPartOut));

  // 4. F8: a meal type tapped while the entry's insert is failing arrives after it.
  const wqM4 = await wq.evaluate(() => {
    window.__WRITE_FAIL_TABLES__ = { recipe_logs: { how: 'network', times: 2 } };
    const m = window.__WRITES__.length, l = window.__LOG__.length;
    const e = addDiaryEntry({ recipeId: loadRecipes()[0].id, cookedOn: '2026-09-20' });
    window.__WQ_ENTRY__ = e.id;
    return [m, l];
  });
  await wqDrain();
  await wq.evaluate(() => updateDiaryEntry(window.__WQ_ENTRY__, { mealType: 'lunch' }));
  await wqDrain();
  await wq.evaluate(() => flushFailedWrites());
  await wqDrain();
  const wqDiary = await wq.evaluate(([m]) => {
    const id = window.__WQ_ENTRY__;
    const ws = window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs');
    return { order: ws.map(w => w.op + (w.op === 'update' ? ':' + w.patch.meal_type : '')),
      cache: loadDiary().find(e => e.id === id).mealType, pile: failedWrites.length, unsent: [...unsentLabels], saved: !unsavedDiaryIds.has(id) };
  }, wqM4);
  check('a meal type tapped while its entry\'s insert is failing is sent after the insert lands, not dropped (F8)',
        wqDiary.order[wqDiary.order.length - 2] === 'insert' && wqDiary.order[wqDiary.order.length - 1] === 'update:lunch'
        && wqDiary.cache === 'lunch' && wqDiary.saved && wqDiary.pile === 0 && !wqDiary.unsent.includes('the food diary'), JSON.stringify(wqDiary));

  // 5. A delete drops a failing insert: the entry the household removed is not created afterwards.
  const wqM5 = await wq.evaluate(() => {
    window.__WRITE_FAIL_TABLES__ = { recipe_logs: { how: 'network', times: 2 } };
    const m = window.__WRITES__.length;
    window.__WQ_GONE__ = addDiaryEntry({ recipeId: loadRecipes()[0].id, cookedOn: '2026-09-19' }).id;
    return m;
  });
  await wqDrain();
  await wq.evaluate(() => deleteDiaryEntry(window.__WQ_GONE__));
  await wqDrain();
  await wq.evaluate(() => flushFailedWrites()); await wqDrain();
  await wqNudge(); await wqDrain();
  const wqGone = await wq.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'recipe_logs').map(w => w.op), wqM5);
  check('    an entry removed while its insert is failing: once the delete lands, the insert is never sent again',
        wqGone[wqGone.length - 1] === 'delete' && wqGone.filter(o => o === 'insert').length === 2, JSON.stringify(wqGone));

  // 6. A save's follow-up survives the save being covered: FOLD INTO NOTES still deletes its note, once.
  const wqFold = await wqCopy('WQ Fold Covered');
  await wqDrain();
  const wqNote = await wq.evaluate(id => addRecipeNote(id, 'A made-up note for the queue').id, wqFold);
  await wqDrain();
  const wqM6 = await wq.evaluate(([id, n]) => {
    window.__WRITE_FAIL_TABLES__ = { recipes: { how: 'refused', times: 2 } };
    const m = window.__WRITES__.length;
    cache.recipeNotes = loadRecipeNotes().filter(x => x.id !== n);
    saveRecipe({ ...cache.recipes.find(x => x.id === id), equipment: 'folded' }, () => queueRecipeNoteDelete(n));
    return m;
  }, [wqFold, wqNote]);
  await wqDrain();
  await wq.evaluate(id => saveRecipe({ ...cache.recipes.find(x => x.id === id), equipment: 'folded, then edited' }), wqFold);
  await wqDrain();
  const wqFoldOut = await wq.evaluate(([m, n]) => window.__WRITES__.slice(m).filter(w => w.table === 'recipe_notes' && w.op === 'delete')
    .map(w => w.eqs.map(e => e.value)[1]).filter(x => x === n).length, [wqM6, wqNote]);
  check('    a save carrying FOLD INTO NOTES, covered by a later save before it landed: the note is still deleted, once',
        wqFoldOut === 1, String(wqFoldOut));
  await wq.evaluate(() => { window.__WRITE_FAIL_TABLES__ = {}; });
  await wq.close();

  /* ---- Several households (12 Oct 2026, the October review's PR 6: F36, F31, F23, F24, F25, F42, F44, F40, F43) ----
     Writes that carried more than their own change, and a sign-in and a sign-out that assumed one household and one
     account. Fresh pages where the state needs one. */
  console.log('\nSeveral households');
  const HH_HOUSE = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
  const hhOpen = async (label, extra, init, expect) => {
    const p = await browser.newPage();
    p.__label = label;
    if (expect) p.__expectConsole = expect;
    if (init) await p.addInitScript(init);
    await p.addInitScript(x => { if (x) window.__STUB_EXTRA__ = x; }, extra || null);
    await p.clock.setFixedTime(FIXTURE_NOW);
    await p.goto('file://' + path.join(__dirname, 'app-under-test.html'));
    await p.waitForTimeout(1500);
    return p;
  };
  const hhDrain = p => p.evaluate(async () => { let t; do { t = writeQueue; await t; } while(t !== writeQueue); });

  // F36: an account in two households is told so at sign-in, and nothing of either loads.
  /* The app says so in the console too, as it does for any start-up that cannot load: that is this page's point. */
  const hh2 = await hhOpen('two households', { household_members: [{ household_id: HH_HOUSE }, { household_id: '99999999-9999-4999-8999-999999999999' }] },
    null, /^Could not load your library .*more than one household/);
  const hh2Out = await hh2.evaluate(() => ({ gate: !document.getElementById('loginGate').hidden && getComputedStyle(document.getElementById('loginGate')).display !== 'none',
    msg: (document.getElementById('loginError') || {}).textContent || '', cards: document.querySelectorAll('.rcard').length, household: HOUSEHOLD_ID }));
  check('an account in two households is told so at sign-in, and neither household\'s library loads (F36)',
        hh2Out.gate && /more than one household/.test(hh2Out.msg) && hh2Out.cards === 0 && !hh2Out.household, JSON.stringify(hh2Out));
  await hh2.close();

  // F31: a session that ends on its own reloads the page, as SIGN OUT does.
  const hhOut = await hhOpen('signed out', null, () => { window.name = String((parseInt(window.name, 10) || 0) + 1); });
  await hhOut.evaluate(() => window.__AUTH_CB__('SIGNED_OUT'));
  await hhOut.waitForTimeout(1500);
  const hhLoads = await hhOut.evaluate(() => window.name);
  check('    a session that ends on its own reloads the page, so nothing of the old account is kept or sent (F31)', hhLoads === '2', hhLoads);
  await hhOut.close();

  // F23: a household with no settings row still has the automatic calendar toggles.
  const hhNo = await hhOpen('no settings row', { household_settings: [] });
  const hhAuto = await hhNo.evaluate(() => calendarAutoAvailable);
  check('    a household with no settings row is not read as missing the calendar toggles\' columns (F23)', hhAuto === true, String(hhAuto));

  // F42: one setting sends its own column, nothing else from this tab's copy.
  const hhM1 = await hhNo.evaluate(() => window.__WRITES__.length);
  await hhNo.evaluate(() => setSetting('darkMode', 'dark'));
  await hhDrain(hhNo);
  const hhSet = await hhNo.evaluate(m => window.__WRITES__.slice(m).filter(w => w.table === 'household_settings').map(w => Object.keys(w.rows || {}).sort().join(',')), hhM1);
  check('    changing DARK MODE sends that column only, not the week\'s first day this tab last saw (F42)',
        JSON.stringify(hhSet) === JSON.stringify(['dark_mode,household_id,updated_at']), JSON.stringify(hhSet));

  // F25: a recipe save names no favourite; a source merge updates three columns of each recipe it touches.
  const hhM2 = await hhNo.evaluate(() => window.__WRITES__.length);
  await hhNo.evaluate(() => { const r = loadRecipes().find(x => x.title === 'Test Soup'); saveRecipe({ ...r }); saveRecipes([r]); });
  await hhDrain(hhNo);
  const hhSave = await hhNo.evaluate(m => {
    const ws = window.__WRITES__.slice(m).filter(w => w.table === 'recipes');
    return { upsert: ws.filter(w => w.op === 'upsert').map(w => 'favourite' in w.rows[0]),
      updates: ws.filter(w => w.op === 'update').map(w => Object.keys(w.patch).sort().join(',')) };
  }, hhM2);
  check('    a recipe save never sends the favourite, and a source or keyword merge sends only source, tags and the text (F25)',
        JSON.stringify(hhSave.upsert) === '[false]' && JSON.stringify(hhSave.updates) === JSON.stringify(['source,syntax,tags,updated_at']), JSON.stringify(hhSave));

  // F24: restoring word matches and aisles upserts on their own keys.
  const hhM3 = await hhNo.evaluate(() => window.__WRITES__.length);
  await hhNo.evaluate(() => { replaceAliases([{ id: uid(), kind: 'ingredient', alias: 'made-up alias', canonical: 'made-up name' }]);
    replaceAisleOverrides([{ id: uid(), name: 'made-up item', aisle: 'Pantry' }]); });
  await hhDrain(hhNo);
  const hhKeys = await hhNo.evaluate(m => window.__WRITES__.slice(m).filter(w => w.op === 'upsert').map(w => w.table + ':' + ((w.opts || {}).onConflict || 'id')), hhM3);
  check('    restoring word matches and aisles upserts on their own keys, not the id (F24)',
        hhKeys.includes('aliases:household_id,kind,alias') && hhKeys.includes('aisle_overrides:household_id,name'), JSON.stringify(hhKeys));

  // F44: a picture changed while the sweep ran is not overwritten by the sweep's answer.
  const hhSweep = await hhNo.evaluate(async () => {
    const r = loadRecipes().find(x => x.title === 'Test Traybake');
    const sent = r.imageUrl;
    window.__INVOKE_REPLY__ = () => { r.imageUrl = 'https://example.test/chosen-during-sweep.jpg';
      return { data: { report: [{ id: r.id, outcome: 'rehosted', from: sent, to: SELF_HOST_PREFIX + 'h/swept.jpg' }] }, error: null }; };
    runImageSweep('rehostSweepBtn', {}, () => 'done');
    await new Promise(res => setTimeout(res, 300));
    window.__INVOKE_REPLY__ = null;
    return r.imageUrl;
  });
  check('    a picture changed while the image sweep ran keeps the change, not the sweep\'s copy of the old one (F44)',
        hhSweep === 'https://example.test/chosen-during-sweep.jpg', hhSweep);

  // F43: their recipe from the same page, written with a trailing slash and a tracking query, is ours already.
  const hhCopy = await hhNo.evaluate(() => {
    const r = loadRecipes().find(x => x.title === 'Test Soup');
    r.sourceUrl = 'https://example.test/recipes/soup';
    const found = ourCopyOf({ id: 'theirs-1', sourceUrl: 'https://example.test/recipes/soup/?utm_source=made-up' });
    return found ? found.title : null;
  });
  check('    a shared recipe from the same page, its address written differently, reads as already in our recipes (F43)',
        hhCopy === 'Test Soup', String(hhCopy));
  await hhNo.close();

  // F40: changing the week's first day asks, then clears the ticks it would strand; cancelling changes nothing.
  const hhWeek = await hhOpen('week start');
  const hhTick = await hhWeek.evaluate(() => {
    showView('settings');
    const week = isoLocal(startOfWeek(new Date()));
    toggleShoppingChecked(week, 'made-up item');
    return { week, from: weekStartDay(), to: (weekStartDay() + 1) % 7 };
  });
  await hhDrain(hhWeek);
  let hhAsk = '';
  hhWeek.once('dialog', d => { hhAsk = d.message(); d.dismiss(); });
  await hhWeek.evaluate(to => { const s = document.getElementById('setWeekStart'); s.value = String(to); s.dispatchEvent(new Event('change')); }, hhTick.to);
  await hhWeek.waitForTimeout(200);
  const hhKept = await hhWeek.evaluate(t => ({ start: weekStartDay(), select: document.getElementById('setWeekStart').value,
    ticked: !!(loadShoppingChecked()[t.week] || {})['made-up item'] }), hhTick);
  const hhM4 = await hhWeek.evaluate(() => window.__WRITES__.length);
  hhWeek.once('dialog', d => d.accept());
  await hhWeek.evaluate(to => { const s = document.getElementById('setWeekStart'); s.value = String(to); s.dispatchEvent(new Event('change')); }, hhTick.to);
  await hhWeek.waitForTimeout(200);
  await hhDrain(hhWeek);
  const hhMoved = await hhWeek.evaluate(([m, t]) => ({ start: weekStartDay(), ticked: !!(loadShoppingChecked()[t.week] || {})['made-up item'],
    deletes: window.__WRITES__.slice(m).filter(w => w.table === 'shopping_checked' && w.op === 'delete').map(w => [w.eqs.map(e => e.value)[1], (w.in || {}).values]) }), [hhM4, hhTick]);
  check('changing the week\'s first day asks first; cancelling keeps the day and the ticks (F40)',
        /ticked will be cleared/.test(hhAsk) && hhKept.start === hhTick.from && hhKept.select === String(hhTick.from) && hhKept.ticked, JSON.stringify({ hhAsk, hhKept }));
  check('    and going ahead clears the ticks the old weeks held, on the server and in the tab',
        hhMoved.start === hhTick.to && !hhMoved.ticked && hhMoved.deletes.some(d => d[0] === hhTick.week && (d[1] || []).includes('made-up item')), JSON.stringify(hhMoved));
  await hhWeek.close();

  /* ---- The converter reminder (issue #127, 12 Oct 2026) ----
     A bar, not a dialog, until someone in the household taps DONE; DONE sends its one column, LATER sends nothing, and a
     household whose database has no converter_ack_version column never sees it. */
  console.log('\nThe converter reminder');
  const cvRow = ack => ({ household_settings: [{ household_id: HH_HOUSE, week_start_day: 5, dark_mode: 'system', converter_ack_version: ack }] });
  const cvBar = p => p.evaluate(() => { const b = document.getElementById('converterBar');
    return { shown: !b.hidden && getComputedStyle(b).display !== 'none', text: document.getElementById('converterBarText').textContent, version: CONVERTER_VERSION }; });
  const cvDue = await hhOpen('converter due', cvRow(null));
  const cvSeen = await cvBar(cvDue);
  check('a household that has not confirmed this version of the converter instructions sees a bar naming it',
        cvSeen.shown && cvSeen.text.includes(cvSeen.version) && /conversion project/.test(cvSeen.text), JSON.stringify(cvSeen));
  /* Not modal: a real click on PLANNER (which Playwright refuses if anything covers the button) changes the view while the
     bar shows, and the bar sits in the page's flow rather than over it. */
  const cvClick = await cvDue.click('.navlink[data-view="planner"]', { timeout: 3000 }).then(() => true, e => String(e.message || e).split('\n')[0]);
  const cvUse = await cvDue.evaluate(c => { const b = document.getElementById('converterBar');
    return { clicked: c, planner: getComputedStyle(document.getElementById('view-planner')).display !== 'none', bar: !b.hidden,
      position: getComputedStyle(b).position, overlays: [...document.querySelectorAll('.modal-overlay, dialog[open]')]
        .filter(e => getComputedStyle(e).display !== 'none' && !e.hidden).length };
  }, cvClick);
  check('    and the app stays usable under it: the planner opens with the bar still there, and nothing is laid over the page',
        cvUse.clicked === true && cvUse.planner && cvUse.bar && cvUse.position === 'static' && cvUse.overlays === 0, JSON.stringify(cvUse));
  const cvM1 = await cvDue.evaluate(() => window.__WRITES__.length);
  await cvDue.click('#converterDoneBtn');
  await hhDrain(cvDue);
  const cvDone = await cvDue.evaluate(m => ({ shown: !document.getElementById('converterBar').hidden,
    sent: window.__WRITES__.slice(m).map(w => ({ table: w.table, op: w.op, rows: w.rows })) }), cvM1);
  const cvSent = cvDone.sent.filter(w => w.table === 'household_settings');
  check('    DONE hides it and records this version for the household, sending that one column and nothing else',
        !cvDone.shown && cvDone.sent.length === 1 && cvSent.length === 1 && cvSent[0].op === 'upsert'
        && Object.keys(cvSent[0].rows).sort().join(',') === 'converter_ack_version,household_id,updated_at'
        && cvSent[0].rows.converter_ack_version === cvSeen.version && cvSent[0].rows.household_id === HH_HOUSE, JSON.stringify(cvDone));
  // Another device taps DONE: this tab's next refresh reads the household's row and the bar goes.
  await cvDue.close();
  const cvOther = await hhOpen('converter done elsewhere', cvRow(null));
  const cvBefore = (await cvBar(cvOther)).shown;
  await cvOther.evaluate(() => { window.__STUB_DATA__.household_settings[0].converter_ack_version = CONVERTER_VERSION; return refreshLibrary(); });
  await cvOther.waitForTimeout(300);
  const cvAfter = (await cvBar(cvOther)).shown;
  check('    once another device in the household has tapped DONE, this one\'s next refresh takes the bar away', cvBefore && !cvAfter,
        JSON.stringify({ cvBefore, cvAfter }));
  await cvOther.close();

  const cvLater = await hhOpen('converter later', cvRow('2026-01-01.1'));
  const cvM2 = await cvLater.evaluate(() => window.__WRITES__.length);
  const cvOld = (await cvBar(cvLater)).shown;
  await cvLater.click('#converterLaterBtn');
  await hhDrain(cvLater);
  const cvL = await cvLater.evaluate(m => ({ shown: !document.getElementById('converterBar').hidden, sent: window.__WRITES__.length - m }), cvM2);
  check('an older confirmed version still asks; LATER hides the bar and sends nothing', cvOld && !cvL.shown && cvL.sent === 0,
        JSON.stringify({ cvOld, cvL }));
  await cvLater.close();

  const cvUpToDate = await hhOpen('converter up to date', cvRow(cvSeen.version));
  const cvNone = (await cvBar(cvUpToDate)).shown;
  await cvUpToDate.close();
  const cvNoCol = await hhOpen('converter no column');
  const cvNoColShown = (await cvBar(cvNoCol)).shown;
  const cvNoColRow = await cvNoCol.evaluate(() => { const w0 = window.__WRITES__.length; setSetting('converterAckVersion', 'x');
    return window.__WRITES__.length - w0; });
  await hhDrain(cvNoCol);
  const cvNoColSent = await cvNoCol.evaluate(() => window.__WRITES__.filter(w => w.table === 'household_settings' && 'converter_ack_version' in (w.rows || {})).length);
  check('a household that has confirmed this version sees no bar', !cvNone, String(cvNone));
  check('    nor does one whose database has no converter_ack_version column yet, and nothing sends it there',
        !cvNoColShown && cvNoColSent === 0, JSON.stringify({ cvNoColShown, cvNoColRow, cvNoColSent }));
  await cvNoCol.close();

  /* ---- AUDIT on the shopping list (#94's second half, 13 Oct 2026, docs/PLAN-SHOPPING-AUDIT.md) ----
     The fixing tools are drawn only while AUDIT is on, which this device remembers; an aisle pick writes one row by the
     row's own key and never moves a tick; a merge that would hide an amount still to buy says so, then unticks it. */
  console.log('\nAUDIT on the shopping list');
  const auOpen = async (label, extra, init) => {
    const p = await hhOpen(label, extra, init);
    await p.evaluate(() => showView('shopping'));
    await p.waitForTimeout(300);
    return p;
  };
  const au = await auOpen('audit');
  const auM0 = await au.evaluate(() => window.__WRITES__.length);
  await au.click('#shopAuditBtn');
  await au.waitForTimeout(200);
  const auOn = await au.evaluate(m => {
    const rows = [...document.querySelectorAll('#shopBody .shop-row')];
    const fits = r => { const s = r.querySelector('.shop-aisle-select'), cat = r.closest('.shop-category').querySelector('.shop-category-title').textContent;
      return !!s && (s.value ? s.value.toUpperCase() === cat : cat === 'OTHER'); };
    return { label: document.getElementById('shopAuditBtn').textContent, pressed: document.getElementById('shopAuditBtn').getAttribute('aria-pressed'),
      rows: rows.length, fitted: rows.filter(r => r.querySelector('.shop-merge-with') && fits(r)).length,
      writes: window.__WRITES__.length - m, stored: localStorage.getItem('kitchen.shoppingAudit') };
  }, auM0);
  check('AUDIT on: every row shows MERGE WITH… and an aisle pick set to the aisle it is in, and nothing is written',
        auOn.label === 'END AUDIT' && auOn.pressed === 'true' && auOn.rows > 1 && auOn.fitted === auOn.rows && auOn.writes === 0
        && auOn.stored === 'on', JSON.stringify(auOn));
  await au.reload();
  await au.waitForTimeout(1500);
  await au.evaluate(() => showView('shopping'));
  await au.waitForTimeout(300);
  const auKept = await au.evaluate(() => ({ label: document.getElementById('shopAuditBtn').textContent,
    tools: document.querySelectorAll('#shopBody .shop-tools').length }));
  check('    and this device remembers it after a reload', auKept.label === 'END AUDIT' && auKept.tools > 0, JSON.stringify(auKept));

  // An aisle pick on BOTH WEEKS, on a ticked row: one row by the row's own key; the row moves, its tick stays; UNDO removes it.
  await au.selectOption('#shopWeekSelect', 'both');
  await au.waitForTimeout(300);
  const auRow = await au.evaluate(() => {
    const s = [...document.querySelectorAll('#shopBody .shop-aisle-select')].find(x => x.value && x.value !== 'Frozen');
    const label = s.closest('.shop-row').querySelector('.shop-item');
    return { key: s.dataset.aisleKey, tickKey: label.dataset.key, from: s.value };
  });
  await au.locator(`.shop-item[data-key="${auRow.tickKey}"] input`).check();
  await au.waitForTimeout(200);
  await hhDrain(au);
  const auM1 = await au.evaluate(() => window.__WRITES__.length);
  await au.selectOption(`.shop-aisle-select[data-aisle-key="${auRow.key}"]`, 'Frozen');
  await au.waitForTimeout(300);
  await hhDrain(au);
  const auMoved = await au.evaluate(([m, r]) => {
    const label = document.querySelector(`.shop-item[data-key="${r.tickKey}"]`);
    const w = window.__WRITES__.slice(m);
    return { writes: w.map(x => ({ table: x.table, op: x.op, name: x.rows && x.rows[0] && x.rows[0].name, aisle: x.rows && x.rows[0] && x.rows[0].aisle,
        conflict: x.opts && x.opts.onConflict })),
      aisle: label && label.closest('.shop-category').querySelector('.shop-category-title').textContent,
      ticked: !!label && label.classList.contains('checked'),
      undo: !!document.querySelector(`[data-shop-aisle-undo="${r.key}"]`) && /Moved to Frozen/.test(label.closest('.shop-row').textContent) };
  }, [auM1, auRow]);
  check('an aisle pick on BOTH WEEKS writes one aisle row by the row\'s own name; the row moves to that aisle with its tick kept',
        auMoved.writes.length === 1 && auMoved.writes[0].table === 'aisle_overrides' && auMoved.writes[0].op === 'upsert'
        && auMoved.writes[0].name === auRow.key && auMoved.writes[0].aisle === 'Frozen' && auMoved.writes[0].conflict === 'household_id,name'
        && auMoved.aisle === 'FROZEN' && auMoved.ticked && auMoved.undo, JSON.stringify({ auRow, auMoved }));
  const auM2 = await au.evaluate(() => window.__WRITES__.length);
  await au.click(`[data-shop-aisle-undo="${auRow.key}"]`);
  await au.waitForTimeout(300);
  await hhDrain(au);
  const auBack = await au.evaluate(([m, r]) => ({ writes: window.__WRITES__.slice(m).map(x => x.table + ':' + x.op),
    aisle: document.querySelector(`.shop-item[data-key="${r.tickKey}"]`).closest('.shop-category').querySelector('.shop-category-title').textContent }), [auM2, auRow]);
  check('    UNDO with no aisle of the household\'s own before removes the one it wrote, and the row goes back',
        JSON.stringify(auBack.writes) === '["aisle_overrides:delete"]' && auBack.aisle === auRow.from.toUpperCase(), JSON.stringify(auBack));
  // With an aisle of its own already: UNDO puts that back, rather than removing it.
  await au.evaluate(k => { addAisleOverride(k, 'Pantry'); renderShopping(); }, auRow.key);
  await hhDrain(au);
  await au.selectOption(`.shop-aisle-select[data-aisle-key="${auRow.key}"]`, 'Frozen');
  await au.waitForTimeout(200);
  await hhDrain(au);
  const auM3 = await au.evaluate(() => window.__WRITES__.length);
  await au.click(`[data-shop-aisle-undo="${auRow.key}"]`);
  await au.waitForTimeout(300);
  await hhDrain(au);
  const auPrior = await au.evaluate(m => window.__WRITES__.slice(m).map(x => x.table + ':' + x.op + ':' + (x.rows && x.rows[0] ? x.rows[0].aisle : '')), auM3);
  check('    UNDO where the household had its own aisle puts that aisle back',
        JSON.stringify(auPrior) === '["aisle_overrides:upsert:Pantry"]', JSON.stringify(auPrior));
  await au.evaluate(k => { const o = loadAisleOverrides().find(x => x.name === k); if(o) removeAisleOverride(o.id); }, auRow.key);
  await au.locator(`.shop-item[data-key="${auRow.tickKey}"] input`).uncheck();
  await au.waitForTimeout(200);
  await hhDrain(au);

  // A merge where only the row merged into is ticked: it says so first, then the merged row is unticked.
  await au.selectOption('#shopWeekSelect', '0');
  await au.waitForTimeout(300);
  const auPair = await au.evaluate(() => {
    const labels = [...document.querySelectorAll('#shopBody .shop-item')];
    return { from: labels[0].dataset.key, to: labels[1].dataset.key, toName: labels[1].dataset.name };
  });
  await au.locator(`.shop-item[data-key="${auPair.to}"] input`).check();
  await au.waitForTimeout(200);
  await hhDrain(au);
  await au.click(`[data-merge-with="${auPair.from}"]`);
  await au.fill('.shop-merge-filter', auPair.toName);
  await au.waitForTimeout(150);
  await au.click(`.shop-merge-option[data-key="${auPair.to}"]`);
  await au.waitForTimeout(150);
  const auWarn = await au.evaluate(() => (document.querySelector('.shop-merge-confirm') || {}).textContent || '');
  const auM4 = await au.evaluate(() => window.__WRITES__.length);
  await au.click('.shop-merge-confirm [data-merge-from]');
  await au.waitForTimeout(300);
  await hhDrain(au);
  const auMerged = await au.evaluate(([m, p]) => ({
    writes: window.__WRITES__.slice(m).map(x => x.table + ':' + x.op + (x.op === 'delete' ? ':' + (x.eqs || []).map(e => e.value).join('|') : '')),
    ticked: !!(document.querySelector(`.shop-item[data-key="${p.to}"]`) || {}).classList && document.querySelector(`.shop-item[data-key="${p.to}"]`).classList.contains('checked') }), [auM4, auPair]);
  check('a merge when only one of the two rows is ticked warns first, then unticks the merged row: one word match, one tick removed',
        /merged row will be unticked/.test(auWarn) && auMerged.writes.length === 2 && auMerged.writes[0] === 'aliases:upsert'
        && auMerged.writes[1].startsWith('shopping_checked:delete') && auMerged.writes[1].includes(auPair.to) && !auMerged.ticked,
        JSON.stringify({ auWarn, auMerged }));
  await au.evaluate(f => { loadAliases().filter(a => a.alias === f).forEach(a => removeAlias(a.id)); }, auPair.from);
  await hhDrain(au);

  // Print and the PNG never show the tools; on a phone nothing runs off the side.
  await au.emulateMedia({ media: 'print' });
  const auPrint = await au.evaluate(() => [...document.querySelectorAll('.shop-tools, #shopAuditBtn')].filter(e => e.getClientRects().length).length);
  await au.emulateMedia({ media: null });
  await au.setViewportSize({ width: 412, height: 900 });
  await au.waitForTimeout(200);
  const auPhone = await au.evaluate(() => ({ scroll: document.documentElement.scrollWidth,
    right: Math.round(document.getElementById('shopAuditBtn').getBoundingClientRect().right) }));
  check('    PRINT shows no tools in AUDIT, and at phone width nothing runs off the side, the AUDIT button included',
        auPrint === 0 && auPhone.scroll <= 412 && auPhone.right <= 412, JSON.stringify({ auPrint, auPhone }));
  await au.click('#shopAuditBtn');
  await au.waitForTimeout(200);
  const auEnded = await au.evaluate(() => ({ stored: localStorage.getItem('kitchen.shoppingAudit'), tools: document.querySelectorAll('#shopBody .shop-tools').length }));
  check('    END AUDIT puts the list back and forgets it on this device', auEnded.stored === null && auEnded.tools === 0, JSON.stringify(auEnded));
  await au.close();

  // Blocked storage reads as off, without an error; a household whose aisle table is missing gets no pick.
  const auBlocked = await auOpen('audit storage blocked', null, () => {
    for (const fn of ['getItem', 'setItem', 'removeItem']) {
      const real = Storage.prototype[fn];
      Storage.prototype[fn] = function(k, ...rest){ if(k === 'kitchen.shoppingAudit') throw new Error('blocked'); return real.call(this, k, ...rest); };
    }
  });
  const auB = await auBlocked.evaluate(() => { document.getElementById('shopAuditBtn').click();
    return { label: document.getElementById('shopAuditBtn').textContent, tools: document.querySelectorAll('#shopBody .shop-tools').length }; });
  check('with storage blocked AUDIT reads as off and a tap does no harm', /^AUDIT/.test(auB.label) && auB.tools === 0, JSON.stringify(auB));
  await auBlocked.close();
  const auNoTable = await auOpen('audit no aisle table', null, () => {
    window.__MISSING_TABLES__ = ['aisle_overrides'];
    localStorage.setItem('kitchen.shoppingAudit', 'on');
  });
  const auNT = await auNoTable.evaluate(() => ({ selects: document.querySelectorAll('.shop-aisle-select').length,
    said: [...document.querySelectorAll('.shop-aisle')].every(s => /can't be set yet/.test(s.textContent)), rows: document.querySelectorAll('.shop-aisle').length }));
  await auNoTable.evaluate(() => localStorage.removeItem('kitchen.shoppingAudit'));
  check('    and where the aisle table is missing, no pick is offered, only a line saying so',
        auNT.selects === 0 && auNT.rows > 0 && auNT.said, JSON.stringify(auNT));
  await auNoTable.close();

  /* ---- Settings → INGREDIENTS folds, and one search (#95, 13 Oct 2026, docs/PLAN-INGREDIENTS-TAB.md) ---- */
  console.log('\nINGREDIENTS: folding and one search');
  const igOpen = async (label, init) => {
    const p = await hhOpen(label, null, init);
    await p.evaluate(() => { try{ localStorage.removeItem('kitchen.ingredientsOpen'); }catch(e){}
      cache.swaps = cache.swaps.concat([{ id: 'ig-swap', original: 'zebra quince', replacement: 'yellow quince', ratio: '1', notes: '' }]);
      // Made-up rows, so each count has something to count: two word matches of different kinds, and one aisle.
      cache.aliases = cache.aliases.concat([{ id: 'ig-a1', kind: 'ingredient', alias: 'violet carrot', canonical: 'carrot' },
        { id: 'ig-a2', kind: 'ingredient_distinct', alias: 'blue cheese || cheese', canonical: '' }]);
      cache.aisleOverrides = cache.aisleOverrides.concat([{ id: 'ig-o1', name: 'pink salt', aisle: 'Pantry' }]);
      rebuildAliasMaps(); rebuildAisleOverrideMap();
      showView('settings'); showSettingsTab('ingredients'); renderSettings(); });
    await p.waitForTimeout(200);
    return p;
  };
  const igState = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ingr-head')].map(h => [h.dataset.ingrSection,
    { open: h.getAttribute('aria-expanded') === 'true', bodyShown: !h.nextElementSibling.hidden, count: h.querySelector('.ingr-count').textContent.trim(),
      tall: Math.round(h.getBoundingClientRect().height) }])));
  const ig = await igOpen('ingredients tab');
  const igM0 = await ig.evaluate(() => window.__WRITES__.length);
  const igFresh = await igState(ig);
  const igTotals = await ig.evaluate(() => ({ matches: loadAliases().length, aisles: loadAisleOverrides().length, swaps: loadSwaps().length, dictionary: INGREDIENT_DICTIONARY.length }));
  check('each INGREDIENTS heading counts what its list holds, kept-separate pairs included (#95)',
        igTotals.matches >= 2 && igTotals.aisles >= 1 && igTotals.swaps >= 1
        && Object.keys(igTotals).every(k => igFresh[k] && igFresh[k].count === `(${igTotals[k]})`), JSON.stringify({ igFresh, igTotals }));
  check('    on a fresh device WORD MATCHES, SHOPPING AISLES and SWAPS are open and the dictionary is folded',
        igFresh.matches.open && igFresh.aisles.open && igFresh.swaps.open && !igFresh.dictionary.open
        && igFresh.matches.bodyShown && !igFresh.dictionary.bodyShown, JSON.stringify(igFresh));
  await ig.click('[data-ingr-section="matches"]');
  await ig.waitForTimeout(100);
  await ig.evaluate(() => { showView('recipes'); showView('settings'); });
  await ig.reload();
  await ig.waitForTimeout(1500);
  await ig.evaluate(() => { showView('settings'); showSettingsTab('ingredients'); });
  await ig.waitForTimeout(200);
  const igKept = await igState(ig);
  check('    a tap folds a section, and this device remembers it after leaving Settings and a reload',
        !igKept.matches.open && !igKept.matches.bodyShown && igKept.aisles.open, JSON.stringify(igKept));
  // One search: an invented word in one invented swap only.
  await ig.evaluate(() => { cache.swaps = cache.swaps.concat([{ id: 'ig-swap', original: 'zebra quince', replacement: 'yellow quince', ratio: '1', notes: '' },
    { id: 'ig-swap2', original: 'green fig', replacement: 'black fig', ratio: '1', notes: '' }]); renderSwaps(); });
  await ig.fill('#ingredientLookup', 'zebra');
  await ig.waitForTimeout(150);
  const igFound = await igState(ig);
  const igSwapRows = await ig.evaluate(() => [...document.querySelectorAll('#swapsList .source-row')].filter(r => !r.hidden).map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  await ig.click('[data-ingr-section="aisles"]');
  await ig.waitForTimeout(100);
  const igNone = await ig.evaluate(() => { const b = document.querySelector('[data-ingr-section="aisles"]').nextElementSibling;
    return { shown: !b.hidden, said: (b.querySelector('.ingr-nomatch') || {}).hidden === false ? b.querySelector('.ingr-nomatch').textContent : '' }; });
  check('typing in the lookup narrows every list: the one with a match opens at (1 OF n), the rest fold at (0 OF n)',
        igFound.swaps.open && /^\(1 OF \d+\)$/.test(igFound.swaps.count) && igSwapRows.length === 1 && /zebra quince/.test(igSwapRows[0])
        && !igFound.aisles.open && /^\(0 OF \d+\)$/.test(igFound.aisles.count) && !igFound.dictionary.open && /^\(0 OF \d+\)$/.test(igFound.dictionary.count)
        && !igFound.matches.open, JSON.stringify({ igFound, igSwapRows }));
  check('    a folded section opened during a search says nothing matches', igNone.shown && /Nothing here matches “zebra”/.test(igNone.said), JSON.stringify(igNone));
  await ig.fill('#ingredientLookup', '');
  await ig.waitForTimeout(150);
  const igCleared = await igState(ig);
  const igStored = await ig.evaluate(() => localStorage.getItem('kitchen.ingredientsOpen'));
  check('    clearing the box puts every section back as this device left it, and the search stored nothing',
        !igCleared.matches.open && igCleared.aisles.open && igCleared.swaps.open && !igCleared.dictionary.open
        && igCleared.swaps.count === `(${igTotals.swaps + 1})` && JSON.parse(igStored).matches === false && JSON.parse(igStored).aisles === true,
        JSON.stringify({ igCleared, igStored }));
  // A jump to SWAPS opens it when folded; nothing here writes; nothing runs off a phone.
  await ig.click('[data-ingr-section="swaps"]');
  await ig.waitForTimeout(100);
  await ig.evaluate(() => { showView('recipes'); showView('swaps'); });
  await ig.waitForTimeout(150);
  const igJump = await igState(ig);
  await ig.setViewportSize({ width: 412, height: 900 });
  await ig.waitForTimeout(150);
  const igPhone = await ig.evaluate(() => document.documentElement.scrollWidth);
  const igPhoneHeads = await igState(ig);
  const igWrites = await ig.evaluate(m => window.__WRITES__.length - m, igM0);
  check('    a jump to SWAPS opens it; at phone width nothing runs off the side and every heading is a good tap; folding and searching wrote nothing',
        igJump.swaps.open && igPhone <= 412 && Object.values(igPhoneHeads).every(h => h.tall >= 40) && igWrites === 0,
        JSON.stringify({ igJump: igJump.swaps, igPhone, igPhoneHeads, igWrites }));
  await ig.evaluate(() => localStorage.removeItem('kitchen.ingredientsOpen'));
  await ig.close();
  const igBlocked = await igOpen('ingredients storage blocked', () => {
    for (const fn of ['getItem', 'setItem']) {
      const real = Storage.prototype[fn];
      Storage.prototype[fn] = function(k, ...rest){ if(k === 'kitchen.ingredientsOpen') throw new Error('blocked'); return real.call(this, k, ...rest); };
    }
  });
  await igBlocked.click('[data-ingr-section="dictionary"]');
  await igBlocked.waitForTimeout(100);
  const igB = await igState(igBlocked);
  check('with storage blocked the tab draws its defaults and a tap does no harm, without an error',
        igB.matches.open && igB.aisles.open && igB.swaps.open && !igB.dictionary.open && igB.dictionary.count.length > 0, JSON.stringify(igB));
  await igBlocked.close();

  /* ---- Preparation as steps (#88 part 2, 13 Oct 2026, docs/PLAN-PREP-STEPS.md) ----
     A device setting, drawn by the viewers only: the timeline, the Add/Edit preview and the shopping list read the recipe as
     written. The recipe's lines are made up and were checked against the library (no match). */
  console.log('\nPreparation as steps');
  const pp = await hhOpen('prep steps');
  const ppView = () => pp.evaluate(() => {
    const m = document.getElementById('flowMount');
    const strip = m.querySelector('.timeline-strip');
    return { prep: [...m.querySelectorAll('.box-cell.prep')].map(c => ({ col: c.dataset.col, text: c.textContent.trim() })),
      cols: Math.max(-1, ...[...m.querySelectorAll('.box-cell')].map(c => +c.dataset.col)) + 1,
      hint: (m.querySelector('p.hint') || {}).textContent || '', strip: strip ? strip.outerHTML : null,
      done: [...m.querySelectorAll('.box-cell.done, .ing-cell.done')].length };
  });
  await pp.evaluate(() => {
    try{ localStorage.removeItem('kitchen.prepSteps'); }catch(e){}
    loadRecipes().push({ id: 'pp-one', title: 'Test Prep Recipe', source: 'Test', servings: 2, tags: { course: '', keywords: [] }, history: [],
      syntax: 'TITLE: Test Prep Recipe\nSERVINGS: 2\n\nGROUP base:\n1 onion\nGROUP top:\n2 leeks, thinly sliced\n3 carrots, peeled and diced\n' +
        'GROUP liq:\n500 ml stock\n\nSTAGE:\nMERGE base -> soft: Soften [10 min]\nSTAGE:\nMERGE soft, top -> mixed: Stir in [5 min]\n' +
        'STAGE:\nMERGE mixed, liq -> soup: Simmer [20 min]' });
    openRecipe('pp-one', 'recipes');
  });
  await pp.waitForTimeout(200);
  const ppBefore = await ppView();
  const ppM0 = await pp.evaluate(() => window.__WRITES__.length);
  await pp.evaluate(() => { showView('settings'); showSettingsTab('app'); });
  await pp.selectOption('#setPrepSteps', 'steps');
  await pp.waitForTimeout(150);
  const ppSet = await pp.evaluate(m => ({ stored: localStorage.getItem('kitchen.prepSteps'),
    writes: window.__WRITES__.slice(m).filter(w => w.table === 'household_settings').length }), ppM0);
  check('as written by default; PREPARATION in Settings → APP is kept on this device and writes nothing to the household (#88)',
        ppBefore.prep.length === 0 && !/PREPARATION SHOWN/.test(ppBefore.hint) && ppSet.stored === 'steps' && ppSet.writes === 0,
        JSON.stringify({ ppBefore: { prep: ppBefore.prep, cols: ppBefore.cols }, ppSet }));
  await pp.evaluate(() => openRecipe('pp-one', 'recipes'));
  await pp.waitForTimeout(200);
  const ppAfter = await ppView();
  check('    on, the viewer draws each preparation as a step beside the step before the one that needs it, and says so',
        JSON.stringify(ppAfter.prep.map(p => p.col + ':' + p.text)) === JSON.stringify(['0:Thinly slice the leeks', '0:Peel and dice the carrots'])
        && /^PREPARATION SHOWN AS STEPS/.test(ppAfter.hint) && ppAfter.cols === ppBefore.cols, JSON.stringify({ prep: ppAfter.prep, cols: [ppBefore.cols, ppAfter.cols] }));
  check('    the timeline is drawn from the recipe as written, unchanged', !!ppBefore.strip && ppAfter.strip === ppBefore.strip);
  // Ticking the step that uses them ticks them too; each drawing keeps its own ticks; the last column still logs the recipe.
  await pp.click('#flowMount .box-cell[data-handle="mixed"]');
  await pp.waitForTimeout(100);
  const ppTicked = await pp.evaluate(() => ({ prepDone: [...document.querySelectorAll('#flowMount .box-cell.prep')].every(c => c.classList.contains('done')),
    done: document.querySelectorAll('#flowMount .done').length }));
  await pp.evaluate(() => { localStorage.removeItem('kitchen.prepSteps'); openRecipe('pp-one', 'recipes'); });
  await pp.waitForTimeout(150);
  const ppPlainTicks = (await ppView()).done;
  await pp.evaluate(() => { localStorage.setItem('kitchen.prepSteps', 'steps'); openRecipe('pp-one', 'recipes'); });
  await pp.waitForTimeout(150);
  const ppBack = (await ppView()).done;
  await pp.click('#flowMount .box-cell[data-handle="soup"]');
  await pp.waitForTimeout(200);
  const ppLogged = await pp.evaluate(() => (loadRecipes().find(r => r.id === 'pp-one').history || []).includes(todayStr()));
  check('    ticking the step that uses a preparation ticks it too; each drawing keeps its own ticks; the last column still logs it',
        ppTicked.prepDone && ppTicked.done > 0 && ppPlainTicks === 0 && ppBack === ppTicked.done && ppLogged,
        JSON.stringify({ ppTicked, ppPlainTicks, ppBack, ppLogged }));
  // The Group Viewer follows the setting; the Add/Edit preview and the shopping list do not.
  const ppGroup = await pp.evaluate(() => {
    const day = isoLocal(new Date());
    const other = loadRecipes().find(r => r.id !== 'pp-one' && r.syntax).id;
    addPlanRecipe(day, 'pp-one'); addPlanRecipe(day, other);
    createGroup(day, ['pp-one', other]);
    const g = loadGroups().find(x => x.recipeIds.includes('pp-one'));
    openGroup(g.id, 'planner');
    const sub = document.getElementById('groupFlow-pp-one');
    return { prep: sub ? sub.querySelectorAll('.box-cell.prep').length : -1 };
  });
  const ppPreview = await pp.evaluate(() => { openEditModal('pp-one');
    const n = document.querySelectorAll('#addPreview .box-cell.prep').length; document.getElementById('closeAddModal').click(); return n; });
  const ppShop = await pp.evaluate(() => {
    const week = groupDaysByWeek(dayList())[0];
    const on = JSON.stringify(buildShoppingList(week).categories);
    localStorage.removeItem('kitchen.prepSteps');
    const off = JSON.stringify(buildShoppingList(week).categories);
    return on === off && /leek/.test(on);
  });
  check('    the Group Viewer follows the setting; the Add/Edit preview shows the recipe as written; the shopping list is the same either way',
        ppGroup.prep === 2 && ppPreview === 0 && ppShop, JSON.stringify({ ppGroup, ppPreview, ppShop }));
  await pp.close();
  const ppBlocked = await hhOpen('prep storage blocked', null, () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function(k, ...rest){ if(k === 'kitchen.prepSteps') throw new Error('blocked'); return real.call(this, k, ...rest); };
  });
  const ppB = await ppBlocked.evaluate(() => { openRecipe(loadRecipes()[0].id, 'recipes');
    return { prep: document.querySelectorAll('#flowMount .box-cell.prep').length, cells: document.querySelectorAll('#flowMount .box-cell').length }; });
  check('with storage blocked recipes show as written, without an error', ppB.prep === 0 && ppB.cells > 0, JSON.stringify(ppB));
  await ppBlocked.close();

  // #87 FINISH TOGETHER: a group with a Side lines its dishes up to finish together; START TOGETHER puts them back.
  const ft = await hhOpen('finish together');
  const ftView = () => ft.evaluate(() => {
    const m = document.getElementById('view-group-viewer');
    return { pressed: [...m.querySelectorAll('[data-group-lineup][aria-pressed="true"]')].map(b => b.dataset.groupLineup),
      starts: [...m.querySelectorAll('.stacked-recipe-start')].map(e => e.textContent.trim()),
      ticks: [...m.querySelectorAll('.timeline-strip .timeline-tick')].map(e => e.textContent.trim()),
      lanes: [...m.querySelectorAll('.timeline-strip [data-recipe-id]')].map(e => e.dataset.recipeId + '@' + (e.style.left || '')) };
  });
  await ft.evaluate(() => {
    const mk = (id, title, course, step) => loadRecipes().push({ id, title, source: 'Test', servings: 2, tags: { course, keywords: [] }, history: [],
      syntax: `TITLE: ${title}\nSERVINGS: 2\n\nGROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: ${step}` });
    mk('ft-main', 'Test Long Dish', 'Main', 'Roast [60 min]');
    mk('ft-side', 'Test Short Dish', 'Side', 'Bubble gently [15 min]');
    const day = isoLocal(new Date());
    addPlanRecipe(day, 'ft-main'); addPlanRecipe(day, 'ft-side');
    createGroup(day, ['ft-main', 'ft-side']);
    const g = loadGroups().find(x => x.recipeIds.includes('ft-side'));
    openGroup(g.id, 'planner');
  });
  const ftFinish = await ftView();
  check('FINISH TOGETHER: a group with a Side opens finishing together; the short dish says when to start it, and the last tick reads SERVE',
        JSON.stringify(ftFinish.pressed) === '["finish"]' && JSON.stringify(ftFinish.starts) === '["START FIRST","START AT +45 min"]'
        && ftFinish.ticks[ftFinish.ticks.length - 1] === 'SERVE', JSON.stringify(ftFinish));
  await ft.click('#view-group-viewer [data-group-lineup="start"]');
  const ftStart = await ftView();
  check('    START TOGETHER puts both dishes at the start, with no start times and no SERVE',
        JSON.stringify(ftStart.pressed) === '["start"]' && ftStart.starts.length === 0 && !ftStart.ticks.includes('SERVE')
        && JSON.stringify(ftStart.lanes) !== JSON.stringify(ftFinish.lanes), JSON.stringify({ ftStart, ftFinish: ftFinish.lanes }));
  const ftPlain = await ft.evaluate(() => {
    state.groupLineUp = null;
    loadRecipes().find(r => r.id === 'ft-side').tags.course = 'Main';
    renderGroupViewer();
    return [...document.querySelectorAll('#view-group-viewer [data-group-lineup][aria-pressed="true"]')].map(b => b.dataset.groupLineup);
  });
  check('    a group with no Side opens starting together, as before', JSON.stringify(ftPlain) === '["start"]', JSON.stringify(ftPlain));
  // Cooking mode hides the strip, and with it the switch, behind SHOW TIMELINE; the start times stay on each dish.
  const ftCook = await ft.evaluate(() => {
    try{ localStorage.removeItem('kitchen.cookingTimeline'); }catch(e){}
    state.groupLineUp = null;
    loadRecipes().find(r => r.id === 'ft-side').tags.course = 'Side';
    renderGroupViewer();
    state.keepAwake = true; updateKeepAwakeStatus();
    const shown = sel => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null; };
    const r = { switchShown: shown('#view-group-viewer [data-group-lineup="finish"]'),
      starts: [...document.querySelectorAll('#view-group-viewer .stacked-recipe-start')].filter(e => e.offsetParent !== null).map(e => e.textContent.trim()) };
    document.querySelector('#view-group-viewer .cook-timeline-btn').click();
    r.afterShow = shown('#view-group-viewer [data-group-lineup="finish"]');
    try{ localStorage.removeItem('kitchen.cookingTimeline'); }catch(e){}
    state.keepAwake = false; updateKeepAwakeStatus();
    return r;
  });
  check('    in cooking mode the switch waits behind SHOW TIMELINE, and the start times stay on each dish',
        !ftCook.switchShown && ftCook.afterShow && JSON.stringify(ftCook.starts) === '["START FIRST","START AT +45 min"]', JSON.stringify(ftCook));
  await ft.close();

  // #87 SERVE WITH: a recipe that says "serve with freekeh" names the library's Side of that name, read-only.
  const sw = await hhOpen('serve with');
  const swView = () => sw.evaluate(() => { const el = document.getElementById('viewerServeWith');
    return { shown: !el.hidden && el.offsetParent !== null, text: el.textContent.trim(), links: [...el.querySelectorAll('[data-serve-with]')].map(b => b.dataset.serveWith) }; });
  await sw.evaluate(() => {
    const mk = (id, title, course, body) => loadRecipes().push({ id, title, source: 'Test', servings: 2, tags: { course, keywords: [] }, history: [],
      syntax: `TITLE: ${title}\nSERVINGS: 2\n\nGROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: ${body}` });
    mk('sw-main', 'Test Swede Bake', 'Main', 'Bake, then serve with freekeh or flatbreads [40 min]');
    mk('sw-other', 'Test Swede Mash', 'Main', 'Mash and serve hot [10 min]');
    openRecipe('sw-main', 'recipes');
  });
  const swNone = await swView();
  check('SERVE WITH: no Side in the library that matches, no line', !swNone.shown && swNone.links.length === 0, JSON.stringify(swNone));
  await sw.evaluate(() => {
    loadRecipes().push({ id: 'sw-side', title: 'Test Plain Freekeh', source: 'Test', servings: 2, tags: { course: 'Side', keywords: [] }, history: [],
      syntax: 'TITLE: Test Plain Freekeh\nSERVINGS: 2\n\nGROUP a:\n100 g freekeh\n\nSTAGE:\nMERGE a -> b: Bubble gently [15 min]' });
    openRecipe('sw-main', 'planner');
  });
  const swOne = await swView();
  check('    with a Side whose title has the word, the viewer says SERVE WITH: and links it',
        swOne.shown && /^SERVE WITH: Test Plain Freekeh →$/.test(swOne.text) && JSON.stringify(swOne.links) === '["sw-side"]', JSON.stringify(swOne));
  const swOrder = await sw.evaluate(() => {
    loadRecipes().push({ id: 'sw-side2', title: 'Test Freekeh Salad', source: 'Test', servings: 2, tags: { course: 'Side', keywords: [] },
      history: ['2026-09-01', '2026-09-08'], syntax: 'TITLE: Test Freekeh Salad\nSERVINGS: 2\n\nGROUP a:\n100 g freekeh\n\nSTAGE:\nMERGE a -> b: Toss [5 min]' });
    openRecipe('sw-main', 'planner');
    const links = [...document.querySelectorAll('#viewerServeWith [data-serve-with]')].map(b => b.dataset.serveWith);
    cache.recipes = cache.recipes.filter(r => r.id !== 'sw-side2');
    openRecipe('sw-main', 'planner');
    return links;
  });
  check('    of two sides that match as well, the more-cooked comes first', JSON.stringify(swOrder) === '["sw-side2","sw-side"]', JSON.stringify(swOrder));
  await sw.click('#viewerServeWith [data-serve-with="sw-side"]');
  const swOpened = await sw.evaluate(() => ({ id: state.selectedRecipeId, back: state.viewerReturnTo, line: document.getElementById('viewerServeWith').hidden }));
  check('    the link opens the side, keeping the way back; the side itself asks for nothing',
        swOpened.id === 'sw-side' && swOpened.back === 'planner' && swOpened.line, JSON.stringify(swOpened));
  const swOthers = await sw.evaluate(() => {
    openRecipe('sw-other', 'recipes');
    const plain = document.getElementById('viewerServeWith').hidden;
    shared.recipes['sw-house'] = [{ ...loadRecipes().find(r => r.id === 'sw-main'), id: 'sw-theirs' }];
    openSharedRecipe('sw-house', 'sw-theirs');
    const theirs = document.getElementById('viewerServeWith').hidden;
    delete shared.recipes['sw-house'];
    return { plain, theirs };
  });
  check('    a recipe with no serving phrase, and another household\'s recipe, show no line', swOthers.plain && swOthers.theirs, JSON.stringify(swOthers));
  await sw.close();

  // #87 the Planner's offer: under a dish that asks for freekeh, + the side, which joins the day and the dish's group.
  const so = await hhOpen('side offer');
  const soDays = await so.evaluate(() => {
    const mk = (id, title, course, servings, body) => loadRecipes().push({ id, title, source: 'Test', servings, tags: { course, keywords: [] }, history: [],
      syntax: `TITLE: ${title}\nSERVINGS: ${servings}\n\nGROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: ${body}` });
    mk('so-main', 'Test Swede Bake', 'Main', 2, 'Bake, then serve with freekeh or flatbreads [40 min]');
    mk('so-other', 'Test Swede Mash', 'Main', 2, 'Mash [10 min]');
    mk('so-side', 'Test Plain Freekeh', 'Side', 4, 'Bubble gently [15 min]');
    mk('so-bread', 'Test Flatbread Stack', 'Side', 2, 'Griddle, then serve with freekeh [6 min]');
    const day = n => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + n); return isoLocal(d); };
    const a = day(2), b = day(3);
    addPlanRecipe(a, 'so-main'); setPlanServingsAt(a, 0, 6);
    addPlanRecipe(b, 'so-main'); addPlanRecipe(b, 'so-other'); createGroup(b, ['so-main', 'so-other']);
    showView('planner'); renderPlanner();
    return { a, b };
  });
  await hhDrain(so);
  const soOffer = date => so.evaluate(d => [...document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer.serve .day-side-add`)].map(b => b.dataset.sideId + ':' + b.textContent.trim()), date);
  const soA = await soOffer(soDays.a);
  check('SIDE OFFER: under a dish that asks for freekeh or flatbreads, the Planner offers + each side that fits',
        JSON.stringify(soA) === '["so-side:+ TEST PLAIN FREEKEH","so-bread:+ TEST FLATBREAD STACK"]', JSON.stringify(soA));
  const soPicking = await so.evaluate(d => {
    state.groupingDate = d; state.groupingSelection = []; renderPlanner();
    const n = document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer.serve`).length;
    state.groupingDate = null; renderPlanner();
    return n;
  }, soDays.a);
  check('    no offer while GROUP SOME TOGETHER is picking', soPicking === 0, String(soPicking));
  const soM0 = await so.evaluate(() => window.__WRITES__.length);
  await so.click(`.day-row[data-date="${soDays.a}"] [data-action="hideSides"]`);
  const soHidden = await so.evaluate(([d, m]) => { const n = document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer.serve`).length;
    renderPlanner(); return { n, again: document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer.serve`).length, writes: window.__WRITES__.length - m }; }, [soDays.a, soM0]);
  check('    × hides it for that dish on that day, writing nothing', soHidden.n === 0 && soHidden.again === 0 && soHidden.writes === 0, JSON.stringify(soHidden));
  await so.evaluate(() => { state.sideOffersHidden.clear(); renderPlanner(); });
  const soM1 = await so.evaluate(() => window.__WRITES__.length);
  await so.click(`.day-row[data-date="${soDays.a}"] .day-side-offer.serve [data-side-id="so-side"]`);
  await hhDrain(so);
  const soTap = await so.evaluate(([d, m]) => {
    const ws = window.__WRITES__.slice(m);
    const plan = ws.filter(w => w.table === 'planner_days'), groups = ws.filter(w => w.table === 'meal_groups');
    const g = groupContaining(d, 'so-main');
    return { tables: ws.map(w => w.table + ':' + w.op), planRows: plan.flatMap(w => w.rows || []).map(r => ({ date: r.plan_date, ids: r.recipe_ids, servings: r.servings, h: r.household_id === HOUSEHOLD_ID })),
      groupRows: groups.flatMap(w => w.rows || []).map(r => ({ ids: r.recipe_ids, h: r.household_id === HOUSEHOLD_ID })), group: g && g.recipeIds,
      offer: document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer.serve`).length, toast: (document.querySelector('.toast') || {}).textContent || '' };
  }, [soDays.a, soM1]);
  check('    a tap writes one planner_days row for that day (the side at the dish\'s 6, not its own 4) and one meal_groups row grouping the two',
        JSON.stringify(soTap.tables) === '["planner_days:upsert","meal_groups:upsert"]' && soTap.planRows.length === 1 && soTap.planRows[0].date === soDays.a
        && JSON.stringify(soTap.planRows[0].ids) === '["so-main","so-side"]' && JSON.stringify(soTap.planRows[0].servings) === '[6,6]' && soTap.planRows[0].h
        && soTap.groupRows.length === 1 && JSON.stringify(soTap.groupRows[0].ids) === '["so-main","so-side"]' && soTap.groupRows[0].h
        && /Test Plain Freekeh added to .*, cooking with Test Swede Bake\./.test(soTap.toast), JSON.stringify(soTap));
  check('    once a side for "freekeh or flatbreads" is on the day, nothing more is offered for it', soTap.offer === 0, JSON.stringify(soTap.offer));
  const soM2 = await so.evaluate(() => window.__WRITES__.length);
  await so.click(`.day-row[data-date="${soDays.b}"] .day-side-offer.serve [data-side-id="so-bread"]`);
  await hhDrain(so);
  const soExt = await so.evaluate(([d, m]) => {
    const ws = window.__WRITES__.slice(m);
    const plan = ws.filter(w => w.table === 'planner_days').flatMap(w => w.rows || []);
    return { tables: ws.map(w => w.table + ':' + w.op), groups: groupsForDate(d).map(g => g.recipeIds), servings: plan.map(r => r.servings) };
  }, [soDays.b, soM2]);
  check('    a dish already in a group: that group gains the side, no group is deleted, and a side written for the same number keeps 0 (as written)',
        JSON.stringify(soExt.tables) === '["planner_days:upsert","meal_groups:upsert"]' && JSON.stringify(soExt.groups) === '[["so-main","so-other","so-bread"]]'
        && JSON.stringify(soExt.servings) === '[[0,0,0]]', JSON.stringify(soExt));
  const soSideRow = await so.evaluate(d => document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer.serve .day-side-add`).length, soDays.b);
  check('    none under a Side, though this one says "serve with freekeh"', soSideRow === 0, String(soSideRow));
  await so.close();

  // #142 OFTEN WITH: what a dish has been grouped with before, any course, once is enough; offered like SERVE WITH.
  const ow = await hhOpen('often with');
  const owDays = await ow.evaluate(() => {
    const mk = (id, title, course, body) => loadRecipes().push({ id, title, source: 'Test', servings: 2, tags: { course, keywords: [] }, history: [],
      syntax: `TITLE: ${title}\nSERVINGS: 2\n\nGROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: ${body}` });
    mk('ow-main', 'Test Swede Bake', 'Main', 'Bake, then serve with freekeh [40 min]');
    mk('ow-side', 'Test Plain Freekeh', 'Side', 'Bubble gently [15 min]');
    mk('ow-dhal', 'Test Swede Dhal', 'Main', 'Simmer gently [30 min]');
    mk('ow-bread', 'Test Rye Loaf', 'Bread', 'Prove and bake [50 min]');
    mk('ow-cake', 'Test Pear Cake', 'Dessert', 'Bake [35 min]');
    mk('ow-lone', 'Test Lone Stew', 'Main', 'Stew [60 min]');
    const day = n => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + n); return isoLocal(d); };
    /* Past groups straight into the cache: the history being read, not a write under test. */
    const g = (n, ...ids) => loadGroups().push({ id: 'ow-g' + n, dateIso: day(n), recipeIds: ids, name: '' });
    g(-10, 'ow-main', 'ow-dhal'); g(-9, 'ow-main', 'ow-dhal'); g(-8, 'ow-main', 'ow-bread'); g(-7, 'ow-main', 'ow-cake'); g(-5, 'ow-main', 'ow-side');
    g(-6, 'ow-main', 'ow-deleted-long-ago');
    const a = day(2), b = day(3);
    addPlanRecipe(a, 'ow-main'); addPlanRecipe(a, 'ow-dhal');
    addPlanRecipe(b, 'ow-side');
    return { a, b };
  });
  await hhDrain(ow);
  const owView = await ow.evaluate(() => {
    const line = id => { const el = document.getElementById(id); return el.hidden ? null : el.textContent.trim(); };
    openRecipe('ow-main', 'recipes');
    const main = { serve: line('viewerServeWith'), often: line('viewerOftenWith') };
    openRecipe('ow-lone', 'recipes'); const lone = line('viewerOftenWith');
    shared.recipes['ow-house'] = [{ ...loadRecipes().find(r => r.id === 'ow-main'), id: 'ow-theirs' }];
    openSharedRecipe('ow-house', 'ow-theirs'); const theirs = line('viewerOftenWith');
    delete shared.recipes['ow-house'];
    return { main, lone, theirs };
  }).catch(e => ({ main: { error: String(e).slice(0, 160) } }));
  check('OFTEN WITH: the viewer names what the dish was grouped with, most days first then most recent, two at most; the deleted one and the SERVE WITH side are left out',
        owView.main.serve === 'SERVE WITH: Test Plain Freekeh →' && owView.main.often === 'OFTEN WITH: Test Swede Dhal → · Test Pear Cake →', JSON.stringify(owView.main));
  check('    nothing for a recipe never grouped, nor for another household\'s recipe', owView.lone === null && owView.theirs === null, JSON.stringify(owView));
  await ow.evaluate(() => { showView('planner'); renderPlanner(); }).catch(e => check('    the Planner draws with OFTEN WITH', false, String(e).slice(0, 160)));
  const owLines = date => ow.evaluate(d => [...document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer`)].map(l =>
    l.querySelector('.day-side-offer-label').textContent + [...l.querySelectorAll('.day-side-add')].map(b => b.dataset.sideId).join(',')), date);
  const owA = await owLines(owDays.a);
  check('    on the Planner, under the dish: SERVE WITH and OFTEN WITH apart; a partner already on the day is not offered again',
        JSON.stringify(owA) === '["SERVE WITH:ow-side","OFTEN WITH:ow-cake,ow-bread"]', JSON.stringify(owA));
  const owB = await owLines(owDays.b);
  check('    shown under a Side too (any course): the side offers the dish it was grouped with', JSON.stringify(owB) === '["OFTEN WITH:ow-main"]', JSON.stringify(owB));
  await ow.click(`.day-row[data-date="${owDays.a}"] [data-action="hideSides"]`);
  const owA2 = await owLines(owDays.a);
  await ow.evaluate(() => { state.sideOffersHidden.clear(); renderPlanner(); });
  check('    hiding SERVE WITH does not move its side into OFTEN WITH', JSON.stringify(owA2) === '["OFTEN WITH:ow-cake,ow-bread"]', JSON.stringify(owA2));
  const owPick = await ow.evaluate(d => { state.groupingDate = d; state.groupingSelection = []; renderPlanner();
    const n = document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer`).length; state.groupingDate = null; renderPlanner(); return n; }, owDays.a);
  check('    no offer while GROUP SOME TOGETHER is picking', owPick === 0, String(owPick));
  const owM0 = await ow.evaluate(() => window.__WRITES__.length);
  await ow.click(`.day-row[data-date="${owDays.b}"] [data-action="hideOften"]`);
  const owHid = await ow.evaluate(([d, m]) => ({ lines: document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-offer`).length, writes: window.__WRITES__.length - m }), [owDays.b, owM0]);
  check('    its × hides it for that dish on that day, writing nothing', owHid.lines === 0 && owHid.writes === 0, JSON.stringify(owHid));
  const owM1 = await ow.evaluate(() => window.__WRITES__.length);
  await ow.click(`.day-row[data-date="${owDays.a}"] [data-side-id="ow-cake"]`);
  await hhDrain(ow);
  const owTap = await ow.evaluate(([d, m]) => {
    const ws = window.__WRITES__.slice(m);
    return { tables: ws.map(w => w.table + ':' + w.op), day: planRecipeIds(loadPlan()[d]), groups: groupsForDate(d).map(g => g.recipeIds),
      often: [...document.querySelectorAll(`.day-row[data-date="${d}"] .day-side-add`)].map(b => b.dataset.sideId) };
  }, [owDays.a, owM1]);
  check('    + writes the day and the group, one row each, and the dish is then not offered again',
        JSON.stringify(owTap.tables) === '["planner_days:upsert","meal_groups:upsert"]' && JSON.stringify(owTap.day) === '["ow-main","ow-dhal","ow-cake"]'
        && JSON.stringify(owTap.groups) === '[["ow-main","ow-cake"]]' && !owTap.often.includes('ow-cake'), JSON.stringify(owTap));
  await ow.close();

  /* ---- The second style, Modernist (docs/PLAN-MODERNIST.md, step 1: the switch) ----
     Classic is what every device has until it chooses, and the choice is this device's alone: localStorage, never the
     database. What is proved here is the mechanism: the attribute is set before the page body exists, it survives a
     reload, Archivo is asked for only once Modernist is on, and Style and Appearance move independently. What each screen
     looks like in Modernist is checked screen by screen as they are built. */
  const watchStyle = () => {
    window.__styleAtBody = null;
    new MutationObserver((m, o) => { if (document.body) { window.__styleAtBody = document.documentElement.getAttribute('data-style'); o.disconnect(); } })
      .observe(document, { childList: true, subtree: true });
  };
  const archivoAsked = label => net.seen.filter(x => x.page === label && /family=Archivo/.test(x.url)).length;
  const look = pg => pg.evaluate(() => ({
    style: document.documentElement.getAttribute('data-style'), theme: document.documentElement.getAttribute('data-theme'),
    stored: (() => { try { return localStorage.getItem('kitchen.style'); } catch (e) { return 'BLOCKED'; } })(),
    bodyFont: getComputedStyle(document.body).fontFamily, monoFont: getComputedStyle(document.getElementById('sideCount')).fontFamily,
    radius: getComputedStyle(document.querySelector('.new-recipe')).borderTopLeftRadius, bg: getComputedStyle(document.body).backgroundColor,
    chrome: document.querySelector('meta[name="theme-color"]').getAttribute('content'), writes: window.__WRITES__.length,
    optionsText: [...document.querySelectorAll('#setStyle option')].map(o => o.textContent).join(','), chosen: document.getElementById('setStyle').value
  }));

  const sty = await browser.newPage();
  sty.__label = 'style';
  await sty.addInitScript(watchStyle);
  await sty.clock.setFixedTime(FIXTURE_NOW);
  await sty.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await sty.waitForTimeout(1200);
  await sty.click('.navlink[data-view="settings"]');
  await sty.click('[data-settings-tab-btn="app"]');
  const s0 = await look(sty);
  check('a device that has never chosen is Classic: the attribute says so, set before the body existed, in Plex and with 2px corners',
        s0.style === 'classic' && (await sty.evaluate(() => window.__styleAtBody)) === 'classic' && s0.stored === null &&
        /IBM Plex Sans/.test(s0.bodyFont) && /IBM Plex Mono/.test(s0.monoFont) && s0.radius === '2px' && s0.bg === 'rgb(234, 228, 213)', JSON.stringify(s0));
  check('    and has not asked for Archivo', archivoAsked('style') === 0, String(archivoAsked('style')));
  check('Settings → APP has a STYLE select beside APPEARANCE, CLASSIC first and chosen',
        s0.optionsText === 'CLASSIC,MODERNIST' && s0.chosen === 'classic' &&
        (await sty.evaluate(() => { const a = document.getElementById('setDarkMode').closest('.settings-block'), b = document.getElementById('setStyle').closest('.settings-block'); return a.nextElementSibling === b && b.dataset.settingsTab === 'app'; })));

  await sty.selectOption('#setStyle', 'modernist');
  await sty.waitForTimeout(300);
  const s1 = await look(sty);
  check('choosing MODERNIST sets the attribute and remembers it on this device',
        s1.style === 'modernist' && s1.stored === 'modernist' && s1.chosen === 'modernist', JSON.stringify(s1));
  check('    the page is now in Archivo throughout (the mono face too), with square corners and the Modernist ground',
        /^"?Archivo/.test(s1.bodyFont) && /^"?Archivo/.test(s1.monoFont) && s1.radius === '0px' && s1.bg === 'rgb(243, 242, 242)', JSON.stringify(s1));
  check('    and only now does it ask for Archivo; the browser chrome takes the Modernist ground',
        archivoAsked('style') === 1 && s1.chrome === '#f3f2f2', `asked ${archivoAsked('style')}×, chrome ${s1.chrome}`);
  check('    the choice is this device\'s: nothing is written to the database', s1.writes === s0.writes, `${s0.writes} → ${s1.writes} writes`);

  /* All four: Style and Appearance are independent, in either order. */
  await sty.selectOption('#setDarkMode', 'dark');
  await sty.waitForTimeout(300);
  const s2 = await look(sty);
  check('Modernist dark: the theme moved and the style did not, and the ground is the dark one',
        s2.style === 'modernist' && s2.theme === 'dark' && s2.bg === 'rgb(22, 21, 20)' && s2.chrome === '#161514', JSON.stringify(s2));
  await sty.selectOption('#setStyle', 'classic');
  await sty.waitForTimeout(300);
  const s3 = await look(sty);
  check('Classic dark: the style moved back and the theme did not, and every Classic value is back',
        s3.style === 'classic' && s3.theme === 'dark' && s3.bg === 'rgb(20, 18, 16)' && s3.chrome === '#141210' && s3.stored === null &&
        /IBM Plex Sans/.test(s3.bodyFont) && s3.radius === '2px', JSON.stringify(s3));
  await sty.selectOption('#setDarkMode', 'light');
  await sty.waitForTimeout(300);
  await sty.selectOption('#setStyle', 'modernist');
  await sty.waitForTimeout(300);
  const s4 = await look(sty);
  check('Modernist light again, reached the other way round: Classic light, Classic dark, Modernist dark and Modernist light all work',
        s4.style === 'modernist' && s4.theme === 'light' && s4.bg === 'rgb(243, 242, 242)' && s4.chrome === '#f3f2f2', JSON.stringify(s4));

  /* The reload is the proof that the choice outlives the page, and the observer that the first paint is already right. */
  await sty.reload();
  await sty.waitForTimeout(1200);
  const s5 = await sty.evaluate(() => ({ atBody: window.__styleAtBody, style: document.documentElement.getAttribute('data-style'), bg: getComputedStyle(document.body).backgroundColor }));
  check('after a reload the style is Modernist before the page body exists, so Classic never flashes first',
        s5.atBody === 'modernist' && s5.style === 'modernist' && s5.bg === 'rgb(243, 242, 242)', JSON.stringify(s5));
  check('    and the reload asked for Archivo again, the way a fresh start does', archivoAsked('style') === 2, String(archivoAsked('style')));
  await sty.close();

  /* Storage that will not answer is Classic, not an error. */
  const stb = await browser.newPage();
  stb.__label = 'style, blocked storage';
  await stb.addInitScript(() => { const bad = () => { throw new Error('blocked'); }; try { Object.defineProperty(window, 'localStorage', { get: bad }); } catch (e) {} });
  await stb.clock.setFixedTime(FIXTURE_NOW);
  await stb.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await stb.waitForTimeout(800);
  check('with storage blocked the style is Classic, and the page still starts',
        (await stb.evaluate(() => document.documentElement.getAttribute('data-style'))) === 'classic' && (await stb.locator('.rcard').count()) > 0);
  await stb.close();

  /* ---- Modernist, step 2: the sidebar ----
     228px, numbered rows, the brand renamed, the count at the right. It folds to a 56px rail on the Planner and on a viewer
     in cooking mode (and on any viewer between 861 and 1180px, as Classic does for the width); the rail peeks it, ‹ folds
     it, and another screen resets it. Widths are read after the 0.22s transition. Classic is checked alongside, unchanged. */
  const navState = pg => pg.evaluate(() => {
    const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    return { w: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width), rail: vis(document.getElementById('navRailBtn')),
      links: [...document.querySelectorAll('.navlink')].filter(vis).length, hide: vis(document.getElementById('navHideBtn')),
      peekTab: vis(document.getElementById('sidebarPeekBtn')), focus: document.activeElement && document.activeElement.id };
  });
  const settle = pg => pg.waitForTimeout(400);

  const nc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  nc.__label = 'sidebar, classic';
  await nc.clock.setFixedTime(FIXTURE_NOW);
  await nc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await nc.waitForTimeout(1200);
  await nc.click('.navlink[data-view="planner"]'); await settle(nc);
  const c0 = await navState(nc);
  const cBrand = await nc.evaluate(() => ({ brand: document.querySelector('.brand').innerText.trim(), before: getComputedStyle(document.querySelector('.navlink'), '::before').content }));
  check('Classic\'s sidebar is as it was on the Planner: 214px, six links, no rail, "Kitchen", no numbers',
        c0.w === 214 && c0.links === 6 && !c0.rail && cBrand.brand === 'Kitchen' && cBrand.before === 'none', JSON.stringify([c0, cBrand]));
  await nc.close();

  const nv = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  nv.__label = 'sidebar, modernist';
  await nv.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await nv.clock.setFixedTime(FIXTURE_NOW);
  await nv.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await nv.waitForTimeout(1200);
  const m0 = await navState(nv);
  const mLook = await nv.evaluate(() => {
    const sb = document.querySelector('.sidebar').getBoundingClientRect(), sl = document.getElementById('navShortlist');
    const count = sl.querySelector('.nav-count'), sep = sl.querySelector('.nav-sep');
    return { brand: document.querySelector('.brand').innerText.trim(), before: getComputedStyle(document.querySelector('.navlink'), '::before').content,
      text: sl.textContent, count: count && count.textContent, sepShown: !!sep && getComputedStyle(sep).display !== 'none',
      countGap: count ? Math.round(sb.right - count.getBoundingClientRect().right) : null };
  });
  check('Modernist\'s sidebar on Recipes: 228px, six numbered links, "Recipe Wrangler", no rail',
        m0.w === 228 && m0.links === 6 && !m0.rail && !m0.hide && mLook.brand === 'Recipe Wrangler' && /counter\(nav, decimal-leading-zero\)/.test(mLook.before),
        JSON.stringify([m0, mLook.brand, mLook.before]));
  check('    the shortlist count sits at the right of its row without its " · ", and the row\'s words are unchanged',
        mLook.text === 'SHORTLIST · 1' && mLook.count === '1' && !mLook.sepShown && mLook.countGap >= 18 && mLook.countGap <= 24, JSON.stringify(mLook));

  await nv.click('.navlink[data-view="planner"]'); await settle(nv);
  const m1 = await navState(nv);
  check('on the Planner it folds to the 56px rail, and only the rail shows', m1.w === 56 && m1.rail && m1.links === 0 && !m1.peekTab, JSON.stringify(m1));
  await nv.click('#navRailBtn'); await settle(nv);
  const m2 = await navState(nv);
  check('    tapping the rail peeks the whole sidebar, with ‹ in place of the square, and focus on ‹',
        m2.w === 228 && !m2.rail && m2.links === 6 && m2.hide && m2.focus === 'navHideBtn', JSON.stringify(m2));
  const hit = await nv.evaluate(() => {
    const b = document.getElementById('navHideBtn'), r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const on = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && e.closest('#navHideBtn') === b; };
    return { size: [Math.round(r.width), Math.round(r.height)], inside: [on(r.left - 5, cy), on(r.right + 5, cy), on(cx, r.top - 5), on(cx, r.bottom + 5)], outside: on(r.left - 8, cy) };
  });
  check('    ‹ is drawn 32px square and answers a tap 6px around it (44px), and no further',
        hit.size.join() === '32,32' && hit.inside.every(Boolean) && !hit.outside, JSON.stringify(hit));
  await nv.click('#navHideBtn'); await settle(nv);
  const m3 = await navState(nv);
  check('    ‹ folds it again, and focus goes back to the rail', m3.w === 56 && m3.rail && m3.focus === 'navRailBtn', JSON.stringify(m3));
  await nv.click('#navRailBtn'); await settle(nv);
  await nv.click('.navlink[data-view="shopping"]'); await settle(nv);
  const m4 = await navState(nv);
  await nv.click('.navlink[data-view="planner"]'); await settle(nv);
  const m5 = await navState(nv);
  check('    another screen ends the peek: Shopping is full width, and the Planner is folded again on return',
        m4.w === 228 && !m4.rail && m5.w === 56 && m5.rail, JSON.stringify([m4, m5]));

  await nv.click('#navRailBtn'); await settle(nv);
  await nv.click('.navlink[data-view="recipes"]'); await settle(nv);
  await nv.locator('.rcard').first().click(); await settle(nv);
  const v0 = await navState(nv);
  await nv.click('#view-viewer .toggle-track'); await settle(nv);
  const v1 = await navState(nv);
  await nv.click('#view-viewer .toggle-track'); await settle(nv);
  const v2 = await navState(nv);
  check('on a recipe the sidebar stays open, folds when cooking mode goes on and opens when it goes off',
        v0.w === 228 && v1.w === 56 && v1.rail && !v1.peekTab && v2.w === 228, JSON.stringify([v0, v1, v2]));
  await nv.setViewportSize({ width: 1100, height: 800 }); await settle(nv);
  const v3 = await navState(nv);
  check('    between 861 and 1180px a recipe has the rail, where Classic folds the sidebar for the width, and no ☰ tab',
        v3.w === 56 && v3.rail && !v3.peekTab, JSON.stringify(v3));
  await nv.setViewportSize({ width: 412, height: 915 }); await settle(nv);
  const v4 = await nv.evaluate(() => ({ w: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width), vw: window.innerWidth,
    rail: getComputedStyle(document.getElementById('navRailBtn')).display }));
  check('    on a phone it is Classic\'s bar across the top, with no rail', v4.w === v4.vw && v4.rail === 'none', JSON.stringify(v4));
  await nv.close();

  /* ---- Modernist, step 3: Recipes ----
     The title and its count beside the search; SOURCE beside SORT on the KEYWORD row; three cards to a row sharing 2px rules;
     the card's ✓ takes a recipe off the shortlist (Modernist only). Classic is checked alongside, as it was. */
  const recipesLook = pg => pg.evaluate(() => {
    const vis = el => !!el && el.getClientRects().length > 0;
    const r = el => el.getBoundingClientRect(), h1 = document.querySelector('.recipes-titleblock h1'), sb = document.querySelector('#view-recipes .searchbar');
    const src = document.getElementById('sourceFilterSelect'), row = src && src.closest('.filter-row');
    const cards = [...document.querySelectorAll('#recipeGrid .rcard')].slice(0, 3).map(c => { const b = r(c), s = getComputedStyle(c);
      return { top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), bt: s.borderTopWidth, bl: s.borderLeftWidth, br: s.borderRightWidth, bb: s.borderBottomWidth }; });
    const grid = document.getElementById('recipeGrid'), gridRight = Math.round(r(grid).right - parseFloat(getComputedStyle(grid).paddingRight));
    return { title: vis(h1) ? h1.textContent : null, count: vis(document.getElementById('recipesCountMod')) ? document.getElementById('recipesCountMod').textContent : null,
      inBar: vis(document.getElementById('resultCount')) ? document.getElementById('resultCount').textContent : null,
      beside: vis(h1) ? (r(sb).left > r(h1).right && r(sb).top < r(h1).bottom && r(sb).bottom > r(h1).top) : null, barH: Math.round(r(sb).height),
      sources: document.querySelectorAll('#sourceFilterSelect').length, sourceRow: row ? row.querySelector('.filter-row-label').textContent : null,
      cards, gridRight, photoH: Math.round(r(document.querySelector('#recipeGrid .rcard-photo')).height) };
  });
  const rcc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  rcc.__label = 'recipes, classic';
  await rcc.clock.setFixedTime(FIXTURE_NOW);
  await rcc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await rcc.waitForTimeout(1200);
  const k0 = await recipesLook(rcc);
  check('Classic\'s Recipes is as it was: no title, "3 OF 3" in the search bar, SOURCE on a row of its own',
        k0.title === null && k0.count === null && k0.inBar === '3 OF 3' && k0.sources === 1 && k0.sourceRow === 'SOURCE', JSON.stringify(k0));
  const cId = await rcc.evaluate(() => document.querySelector('#recipeGrid .rcard').dataset.id);
  await rcc.click(`#recipeGrid [data-shortlist="${cId}"]`); await rcc.waitForTimeout(200);
  await rcc.click(`#recipeGrid [data-shortlist="${cId}"]`); await rcc.waitForTimeout(200);
  const k1 = await rcc.evaluate(id => ({ on: loadShortlist().some(i => i.recipeId === id), label: document.querySelector(`[data-shortlist="${id}"]`).getAttribute('aria-label') }), cId);
  check('    and in Classic the card\'s ✓ only says it is on the shortlist: a second tap leaves it there', k1.on && k1.label === 'On shortlist', JSON.stringify(k1));
  await rcc.close();

  const rc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  rc.__label = 'recipes, modernist';
  await rc.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await rc.clock.setFixedTime(FIXTURE_NOW);
  await rc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await rc.waitForTimeout(1200);
  const r0 = await recipesLook(rc);
  check('Modernist\'s Recipes: "Recipes" and "3 RECIPES" beside a 48px search bar, and no count inside the bar',
        r0.title === 'Recipes' && r0.count === '3 RECIPES' && r0.inBar === null && r0.beside === true && r0.barH === 48, JSON.stringify(r0));
  check('    SOURCE sits on the KEYWORD row, and there is still one source select', r0.sources === 1 && r0.sourceRow === 'KEYWORD', JSON.stringify(r0));
  const [ca, cb, cc] = r0.cards;
  check('    three cards to a row, equal widths filling it, sharing 2px rules (the first row draws the top, the first card the left)',
        ca.top === cb.top && cb.top === cc.top && ca.left < cb.left && cb.left < cc.left && Math.abs(ca.w - cb.w) <= 1 && Math.abs(cb.w - cc.w) <= 1 && Math.abs(cc.right - r0.gridRight) <= 1 &&
        ca.bt === '2px' && ca.bl === '2px' && cb.bl === '0px' && cb.bt === '2px' && [ca, cb, cc].every(x => x.br === '2px' && x.bb === '2px') && r0.photoH === 176,
        JSON.stringify(r0.cards) + ' grid right ' + r0.gridRight + ' photo ' + r0.photoH);
  await rc.fill('#searchInput', 'Soup'); await rc.waitForTimeout(200);
  check('    a filter turns the count into "1 OF 3"', (await rc.textContent('#recipesCountMod')) === '1 OF 3');
  await rc.fill('#searchInput', ''); await rc.waitForTimeout(200);

  const mId = await rc.evaluate(() => document.querySelector('#recipeGrid .rcard').dataset.id);
  const sl = () => rc.evaluate(id => ({ on: loadShortlist().filter(i => i.recipeId === id).length,
    label: document.querySelector(`[data-shortlist="${id}"]`).getAttribute('aria-label'), text: document.querySelector(`[data-shortlist="${id}"]`).textContent,
    writes: window.__WRITES__.filter(w => w.table === 'shortlist_items').map(w => w.op) }), mId);
  const t0 = await sl();
  await rc.click(`#recipeGrid [data-shortlist="${mId}"]`); await rc.waitForTimeout(300);
  const t1 = await sl();
  await rc.click(`#recipeGrid [data-shortlist="${mId}"]`); await rc.waitForTimeout(300);
  const t2 = await sl();
  check('    the card\'s + puts it on the shortlist and becomes ✓, "Remove from shortlist"',
        t0.on === 0 && t1.on === 1 && t1.text === '✓' && t1.label === 'Remove from shortlist', JSON.stringify([t0, t1]));
  check('    and ✓ takes it off again with one delete, back to +, "Add to shortlist"',
        t2.on === 0 && t2.text === '+' && t2.label === 'Add to shortlist' && t2.writes.length === t1.writes.length + 1 && t2.writes[t2.writes.length - 1] === 'delete',
        JSON.stringify([t1.writes, t2]));
  const fav = await rc.evaluate(() => {
    const on = document.querySelector('.rcard-favourite.on'), off = document.querySelector('.rcard-favourite:not(.on)');
    const s = el => getComputedStyle(el), a = el => getComputedStyle(el, '::after');
    const btn = document.querySelector('.rcard-shortlist'), r = btn.getBoundingClientRect();
    const hits = [[r.left - 4, r.top + 18], [r.right + 4, r.top + 18], [r.left + 18, r.top - 4], [r.left + 18, r.bottom + 4]]
      .map(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && e.closest('.rcard-shortlist') === btn; });
    return { onColour: s(on).color, offColour: s(off).color, textSize: s(on).fontSize,
      onMask: /fill='black'/.test(a(on).webkitMaskImage || a(on).maskImage), offMask: /fill='none'/.test(a(off).webkitMaskImage || a(off).maskImage),
      size: Math.round(r.width) + 'x' + Math.round(r.height), hits, img: s(document.querySelector('.rcard-photo img') || document.body).filter };
  });
  check('    the favourite is the Lucide star, filled and red when on, outlined in ink when off; photos are not filtered to grey',
        fav.onColour === 'rgb(236, 48, 19)' && fav.offColour === 'rgb(32, 30, 29)' && fav.textSize === '0px' && fav.onMask && fav.offMask && fav.img === 'none', JSON.stringify(fav));
  check('    the corner buttons are drawn 36px and answer a tap 4px around them (44px)', fav.size === '36x36' && fav.hits.every(Boolean), JSON.stringify(fav));

  /* Switching style redraws the screen: SOURCE goes back to a row of its own without a reload. */
  await rc.evaluate(() => applyStyle('classic')); await rc.waitForTimeout(200);
  const r1 = await recipesLook(rc);
  await rc.evaluate(() => applyStyle('modernist')); await rc.waitForTimeout(200);
  const r2 = await recipesLook(rc);
  check('switching style redraws Recipes at once: SOURCE moves to its own row in Classic and back in Modernist',
        r1.sourceRow === 'SOURCE' && r1.sources === 1 && r2.sourceRow === 'KEYWORD' && r2.sources === 1, JSON.stringify([r1.sourceRow, r2.sourceRow]));
  await rc.close();

  /* ---- Modernist, step 4: the recipe viewer ----
     A made-up recipe shaped like the design's own example (groups a to e; two steps, a step that adds raw ingredients to
     one, a merge of two steps, a last column), so the table has every kind of cell and four group rules. */
  const STEW = ['TITLE: Test Layered Stew', 'SOURCE: Test Kitchen', 'TIME: 75 min', 'SERVINGS: 4', '',
    'STEPS:', 'Take the test chunks out first.', 'Start the test rice when the sauce simmers.', '',
    'GROUP a:', '500 g test chunks', '150 g test yoghurt', '1 tbsp test spice', '', 'GROUP b:', '1 test onion', '2 test cloves', '',
    'GROUP c:', '400 g test passata', '', 'GROUP d:', '150 ml test cream', '', 'GROUP e:', '1 bunch test herbs', '',
    'STAGE:', 'MERGE a -> A: Mix and rest [30 min]', 'MERGE b -> B: Soften gently [8 min]', '',
    'STAGE:', 'MERGE A -> C: Grill until charred [12 min]', 'MERGE B, c -> D: Add the passata and simmer [15 min]', '',
    'STAGE:', 'MERGE C, D, d -> E: Blend and simmer together [10 min]', '', 'STAGE:', 'MERGE E, e -> F: Scatter and serve [instant]'].join('\n');
  const openStew = pg => pg.evaluate(sx => { loadRecipes().push({ id: 'mod-stew', title: 'Test Layered Stew', source: 'Test Kitchen', time: '75 min', servings: 4,
    tags: { course: 'Main', keywords: [] }, history: [], syntax: sx }); openRecipe('mod-stew'); }, STEW);
  const flowLook = pg => pg.evaluate(() => {
    const m = document.getElementById('flowMount'), cs = el => getComputedStyle(el), top = sel => { const e = m.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; };
    const box = h => m.querySelector(`.box-cell[data-handle="${h}"]`);
    return { row: !!m.querySelector('.recipe-title-row'), titleSize: cs(m.querySelector('.recipe-title')).fontSize,
      serves: (m.querySelector('.recipe-serves') || {}).textContent || null, ticked: (m.querySelector('.recipe-ticked') || {}).textContent || null,
      titleTop: top('.recipe-title'), overviewTop: top('.timeline-strip'), setupTops: [...m.querySelectorAll('ol.setup li')].map(li => Math.round(li.getBoundingClientRect().top)),
      inline: [...m.querySelectorAll('.box-cell')].filter(c => c.getAttribute('style')).length,
      step: (b => b && { bg: cs(b).backgroundColor, bar: cs(b).borderLeftWidth + ' ' + cs(b).borderLeftColor })(box('A')),
      addRaw: box('D') && box('D').className, merge: (b => b && { cls: b.className, bg: cs(b).backgroundColor })(box('E')),
      final: (b => b && { cls: b.className, bg: cs(b).backgroundColor, size: cs(b).fontSize })(box('F')),
      groupTops: [...m.querySelectorAll('.ing-cell')].map((c, i) => c.classList.contains('group-top') ? i : -1).filter(i => i >= 0),
      groupRule: (c => c && cs(c).borderTopWidth + ' ' + cs(c).borderTopColor)(m.querySelector('.ing-cell.group-top')),
      firstCol: Math.round(m.querySelector('.ing-cell').getBoundingClientRect().width),
      lastLane: (l => l && { inline: /background/.test(l.getAttribute('style')), bg: cs(l).backgroundColor })(m.querySelector('.timeline-lane-row:last-child .timeline-lane-abs')) };
  });

  const vc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  vc.__label = 'viewer, classic';
  await vc.clock.setFixedTime(FIXTURE_NOW);
  await vc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await vc.waitForTimeout(1200);
  await openStew(vc); await vc.waitForTimeout(300);
  const fc = await flowLook(vc);
  check('Classic\'s viewer is as it was: no title row or counter, the overview above the title, every box coloured inline, no kinds',
        !fc.row && fc.serves === null && fc.overviewTop < fc.titleTop && fc.inline === 6 && !/box-(?:merge|final)/.test(fc.merge.cls + ' ' + fc.final.cls) && fc.groupTops.length === 0,
        JSON.stringify(fc));
  await vc.close();

  const vm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  vm.__label = 'viewer, modernist';
  await vm.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await vm.clock.setFixedTime(FIXTURE_NOW);
  await vm.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await vm.waitForTimeout(1200);
  await openStew(vm); await vm.waitForTimeout(300);
  const fm = await flowLook(vm);
  check('Modernist\'s viewer: a 76px title with "SERVES 4" and "0 / 14 TICKED" beside it, then the set-up notes side by side, then the overview',
        fm.row && fm.titleSize === '76px' && fm.serves === 'SERVES 4' && fm.ticked === '0 / 14 TICKED' && fm.titleTop < fm.overviewTop &&
        fm.setupTops.length === 2 && fm.setupTops[0] === fm.setupTops[1] && fm.setupTops[0] < fm.overviewTop, JSON.stringify(fm));
  check('    boxes are drawn by kind, with no inline colours: a step on grey with a 4px ink bar, a merge of two steps in ink, the last column in red',
        fm.inline === 0 && fm.step.bg === 'rgb(234, 233, 233)' && fm.step.bar === '4px rgb(32, 30, 29)' && !/box-merge/.test(fm.addRaw) &&
        /box-merge/.test(fm.merge.cls) && fm.merge.bg === 'rgb(32, 30, 29)' && /box-final/.test(fm.final.cls) && fm.final.bg === 'rgb(221, 43, 15)' && fm.final.size === '24px',
        JSON.stringify([fm.step, fm.addRaw, fm.merge, fm.final]));
  check('    a 4px ink rule across the ingredients where each group starts (rows 4, 6, 7 and 8), and a 270px ingredient column',
        JSON.stringify(fm.groupTops) === '[3,5,6,7]' && fm.groupRule === '2px rgb(32, 30, 29)' && Math.abs(fm.firstCol - 270) <= 1, JSON.stringify([fm.groupTops, fm.groupRule, fm.firstCol]));
  check('    the overview\'s lanes are ink, the last step red, with no inline colour', fm.lastLane && !fm.lastLane.inline && fm.lastLane.bg === 'rgb(221, 43, 15)', JSON.stringify(fm.lastLane));
  await vm.click('#flowMount .box-cell[data-handle="C"]'); await vm.waitForTimeout(200);
  check('    ticking "Grill" ticks what fed it, and the counter says 5 / 14', (await vm.textContent('#flowMount .recipe-ticked')) === '5 / 14 TICKED');
  await vm.click('#view-viewer .toggle-track'); await vm.waitForTimeout(300);
  const cook = await vm.evaluate(() => ({ bar: getComputedStyle(document.querySelector('#view-viewer .keep-awake-status')).backgroundColor,
    scaleShown: document.querySelector('#view-viewer .viewer-scale-row').getClientRects().length > 0 }));
  check('    cooking mode shows the red bar and hides COOK FOR', cook.bar === 'rgb(221, 43, 15)' && !cook.scaleShown, JSON.stringify(cook));
  await vm.click('#view-viewer .toggle-track'); await vm.waitForTimeout(200);
  await vm.evaluate(() => applyStyle('classic')); await vm.waitForTimeout(200);
  const sw1 = await flowLook(vm);
  await vm.evaluate(() => applyStyle('modernist')); await vm.waitForTimeout(200);
  const sw2 = await flowLook(vm);
  check('switching style redraws an open recipe: Classic\'s inline colours and no title row, then Modernist\'s again, ticks kept',
        !sw1.row && sw1.inline === 6 && sw2.row && sw2.inline === 0 && sw2.ticked === '5 / 14 TICKED', JSON.stringify([sw1.row, sw1.inline, sw2.row, sw2.inline, sw2.ticked]));
  await vm.close();

  /* ---- Modernist, step 5: the Planner and the shortlist ----
     A made-up fortnight: two grouped dishes today (one cooked, one for six), a pre-made dish tomorrow, a day away, and three
     more ideas on the shortlist. Each button's 44px is measured by pointing at it, as the pills are drawn about 28px. */
  const planWeek = pg => pg.evaluate(() => {
    premadeAvailable = true;
    const R = (id, title, course, time, servings, history) => ({ id, title, source: 'Test Kitchen', time, servings, tags: { course, keywords: [] }, history: history || [], syntax: 'TITLE: ' + title });
    cache.recipes.push(R('pw1', 'Test Bean Stew with a Long Name to See It Clip', 'Main', '1 hr 10 min', 4, ['2026-09-22']), R('pw2', 'Test Green Side', 'Side', '15 min', 4),
      R('pw3', 'Test Flatbread', 'Bread', '25 min', 4), R('pw4', 'Test Noodle Bowl', 'Main', '20 min', 2));
    cache.plan['2026-09-22'] = { recipeIds: ['pw1', 'pw2'], servings: [6, 0], premade: ['', ''] };
    cache.plan['2026-09-23'] = { recipeIds: ['pw4'], servings: [0], premade: ['dinner'] };
    cache.plan['2026-09-24'] = { blank: true };
    cache.groups.push({ id: 'pwg', dateIso: '2026-09-22', recipeIds: ['pw1', 'pw2'], name: '' });
    cache.shortlist.push({ id: 'pws1', recipeId: 'pw3' }, { id: 'pws2', text: 'Something with test squash' }, { id: 'pws3', recipeId: 'pw4' });
  });
  const plannerLook = pg => pg.evaluate(() => {
    const v = document.getElementById('view-planner'), cs = el => getComputedStyle(el), R = el => el.getBoundingClientRect();
    const vis = el => !!el && el.getClientRects().length > 0 && cs(el).visibility !== 'hidden';
    const week = v.querySelector('.week-label'), today = v.querySelector('.day-row.today'), panel = v.querySelector('.shortlist-panel');
    const row = today.querySelector('.day-recipe-row'), t = row.querySelector('.day-recipe-title'), x = row.querySelector('.day-recipe-remove');
    const pills = [...row.querySelectorAll('.day-recipe-serves, .day-recipe-premade, .day-recipe-cooked')];
    return { h1: cs(v.querySelector('.planner-head h1')).fontSize, week: week.textContent.trim(), weekRule: cs(week).borderTopWidth + ' ' + cs(week).borderTopColor,
      summary: (s => s ? s.textContent : null)(week.querySelector('.week-summary')), num: today.querySelector('.day-num').textContent,
      numW: Math.round(R(today.querySelector('.day-num')).width), date: (d => d && { size: cs(d).fontSize, colour: cs(d).color })(today.querySelector('.day-date')),
      title: { size: cs(t).fontSize, weight: cs(t).fontWeight, top: Math.round(R(t).top), h: Math.round(R(t).height) }, xTop: Math.round(R(x).top),
      pillTops: pills.map(p => Math.round(R(p).top)), pillH: pills.map(p => Math.round(R(p).height)), below: pills.every(p => R(p).top >= R(t).bottom - 10),
      cooked: (c => c && cs(c).backgroundColor)(row.querySelector('.day-recipe-cooked.done')), servesOn: (c => c && cs(c).borderTopColor)(row.querySelector('.day-recipe-serves.on')),
      panelW: Math.round(R(panel).width), label: vis(panel.querySelector('.side-label')), headTitle: vis(panel.querySelector('.sl-head-title')),
      collapseBtn: vis(document.getElementById('shortlistCollapseBtn')), rail: vis(document.getElementById('shortlistRailBtn')),
      railText: document.getElementById('shortlistRailBtn').textContent.trim().replace(/\s+/g, ' '), count: document.getElementById('shortlistCount').textContent,
      handle: vis(panel.querySelector('.sl-handle')), num1: (i => i && { content: getComputedStyle(i, '::before').content, colour: getComputedStyle(i, '::before').color })(panel.querySelector('.sl-item')),
      railLabel: document.getElementById('shortlistRailBtn').getAttribute('aria-label'),
      preview: (b => ({ bg: cs(b).backgroundColor, shown: vis(b) }))(panel.querySelector('.shopping-preview')),
      daysW: Math.round(R(v.querySelector('.planner-days')).width), scroll: document.documentElement.scrollWidth, inner: innerWidth };
  });
  /* Points 21px above and below each visible button's middle (and either side, if it is drawn narrower than 44px), and asks
     what a tap there lands on. Points off the screen are not asked. */
  const hitScan = (pg, scope) => pg.evaluate(scope => {
    const out = { n: 0, miss: [] };
    for (const b of document.querySelectorAll(scope + ' button')) {
      const r = b.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight) continue;
      let hidden = false; for (let x = b; x; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === 'none' || c.visibility === 'hidden') { hidden = true; break; } }
      if (hidden) continue;
      out.n++;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (const [dx, dy] of [[0, -21], [0, 21]].concat(r.width < 44 ? [[-21, 0], [21, 0]] : [])) {
        const px = cx + dx, py = cy + dy; if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue;
        const h = document.elementFromPoint(px, py);
        if (!h || h.closest('button') !== b) out.miss.push(`${b.className.split(' ')[0]} "${b.textContent.trim().slice(0, 12)}" ${dx},${dy}`);
      }
    }
    return out;
  }, scope);

  const plc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  plc.__label = 'planner, classic';
  await plc.clock.setFixedTime(FIXTURE_NOW);
  await plc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await plc.waitForTimeout(1200);
  await planWeek(plc);
  await plc.click('.navlink[data-view="planner"]'); await plc.waitForTimeout(400);
  const q0 = await plannerLook(plc);
  check('Classic\'s Planner is as it was: "THIS WEEK" with no dates or count, "TUE 22" on one line, the 340px panel with no rail and no collapse',
        q0.week === 'THIS WEEK' && q0.summary === null && q0.num === 'TUE 22TODAY' && q0.date === null && q0.panelW === 340 && q0.label && !q0.headTitle && !q0.collapseBtn && !q0.rail && q0.handle,
        JSON.stringify(q0));
  await plc.close();

  const plm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  plm.__label = 'planner, modernist';
  await plm.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await plm.clock.setFixedTime(FIXTURE_NOW);
  await plm.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await plm.waitForTimeout(1200);
  await planWeek(plm);
  await plm.click('.navlink[data-view="planner"]'); await plm.waitForTimeout(400);
  const ideas = await plm.evaluate(() => loadShortlist().length);
  const q1 = await plannerLook(plm);
  check('Modernist\'s Planner: a 46px title, "THIS WEEK · 22–24 SEP" and "3 PLANNED" under a 2px ink rule, each day a 92px column, today\'s date 24px in red',
        q1.h1 === '46px' && /^THIS WEEK · 22–24 SEP/.test(q1.week) && q1.summary === '3 PLANNED' && q1.weekRule === '2px rgb(32, 30, 29)' &&
        q1.num === 'TUE22TODAY' && q1.numW === 92 && q1.date.size === '24px' && q1.date.colour === 'rgb(236, 48, 19)', JSON.stringify(q1));
  check('    a dish\'s name is 20px/800 on a line of its own with its × beside it, the pills on the next line, drawn 28px; ✓ COOKED in ink, SERVES 6 lit in red',
        q1.title.size === '20px' && q1.title.weight === '800' && q1.title.h === 44 && q1.xTop === q1.title.top && q1.below && q1.pillTops.length === 3 &&
        q1.pillTops.every(y => y === q1.pillTops[0]) && q1.pillH.every(h => h === 28) && q1.cooked === 'rgb(32, 30, 29)' && q1.servesOn === 'rgb(236, 48, 19)', JSON.stringify(q1));
  check('    the 330px shortlist: "Shortlist" and its count with a collapse button, numbered rows in red with no ≡, the shopping block in red',
        q1.panelW === 330 && q1.headTitle && !q1.label && q1.collapseBtn && !q1.rail && q1.count === `${ideas} IDEAS` && !q1.handle &&
        /counter\(sl, decimal-leading-zero\)/.test(q1.num1.content) && q1.num1.colour === 'rgb(174, 24, 0)' && q1.preview.bg === 'rgb(221, 43, 15)', JSON.stringify(q1));
  const planHits = await hitScan(plm, '#view-planner');
  check('    every button on the Planner answers a tap 21px above and below its middle (44px), and either side when drawn narrower',
        planHits.n >= 20 && planHits.miss.length === 0, `${planHits.n} buttons` + (planHits.miss.length ? '; missed: ' + planHits.miss.slice(0, 5).join(', ') : ''));

  await plm.click('#shortlistCollapseBtn'); await plm.waitForTimeout(300);
  const q2 = await plannerLook(plm);
  const f2 = await plm.evaluate(() => document.activeElement.id);
  check('    › collapses the shortlist to a 56px rail that says "Shortlist" and how many, the days take the room, and focus moves to the rail',
        q2.panelW === 56 && q2.rail && q2.railText === `Shortlist${ideas}` && q2.railLabel === `Open the shortlist, ${ideas} ideas` && !q2.headTitle && !q2.preview.shown && q2.daysW === q1.daysW + 274 && f2 === 'shortlistRailBtn',
        JSON.stringify([q2.panelW, q2.rail, q2.railText, q2.railLabel, q2.daysW, q1.daysW, f2]));
  await plm.click('#shortlistRailBtn'); await plm.waitForTimeout(300);
  const q3 = await plannerLook(plm);
  const f3 = await plm.evaluate(() => document.activeElement.id);
  check('    the rail opens it again, with focus on the collapse button', q3.panelW === 330 && !q3.rail && f3 === 'shortlistCollapseBtn', JSON.stringify([q3.panelW, q3.rail, f3]));
  await plm.click('#shortlistCollapseBtn'); await plm.waitForTimeout(200);
  await plm.click('#navRailBtn'); await plm.waitForTimeout(200);
  await plm.click('.navlink[data-view="recipes"]'); await plm.waitForTimeout(300);
  await plm.click('.navlink[data-view="planner"]'); await plm.waitForTimeout(300);
  const q4 = (await plannerLook(plm)).panelW;
  await plm.click('#navRailBtn'); await plm.waitForTimeout(200);
  await plm.click('.navlink[data-view="shortlist"]'); await plm.waitForTimeout(300);
  const q5 = await plm.evaluate(() => ({ view: state.view, w: Math.round(document.querySelector('#view-planner .shortlist-panel').getBoundingClientRect().width) }));
  check('    collapsed it stays collapsed between screens, and SHORTLIST in the sidebar opens the Planner with it open',
        q4 === 56 && q5.view === 'planner' && q5.w === 330, JSON.stringify([q4, q5]));

  /* The shopping block is one link: a tap on its corner, nowhere near the words, opens the list. */
  const corner = await plm.evaluate(() => { const r = document.querySelector('#view-planner .shopping-preview').getBoundingClientRect(); return [r.left + 6, r.top + 6]; });
  await plm.mouse.click(corner[0], corner[1]); await plm.waitForTimeout(300);
  check('    a tap anywhere on the red shopping block opens the shopping list', (await plm.evaluate(() => state.view)) === 'shopping');

  /* Collapsed in Modernist, then Classic: Classic has no collapse and redraws its own days; back in Modernist it is as it was. */
  await plm.click('.navlink[data-view="planner"]'); await plm.waitForTimeout(300);
  await plm.click('#shortlistCollapseBtn'); await plm.waitForTimeout(200);
  await plm.evaluate(() => applyStyle('classic')); await plm.waitForTimeout(300);
  const q6 = await plannerLook(plm);
  await plm.evaluate(() => applyStyle('modernist')); await plm.waitForTimeout(300);
  const q7 = await plannerLook(plm);
  check('switching style redraws the Planner: Classic\'s "TUE 22" and 340px panel even while Modernist\'s is collapsed, then Modernist\'s again, still collapsed',
        q6.num === 'TUE 22TODAY' && q6.summary === null && q6.panelW === 340 && q6.label && !q6.rail && q7.num === 'TUE22TODAY' && q7.summary === '3 PLANNED' && q7.panelW === 56,
        JSON.stringify([q6.num, q6.summary, q6.panelW, q7.num, q7.summary, q7.panelW]));
  await plm.close();

  const plp = await browser.newPage({ viewport: { width: 412, height: 915 } });
  plp.__label = 'planner, modernist, phone';
  await plp.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await plp.clock.setFixedTime(FIXTURE_NOW);
  await plp.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await plp.waitForTimeout(1200);
  await planWeek(plp);
  await plp.click('.navlink[data-view="planner"]'); await plp.waitForTimeout(400);
  const q8 = await plannerLook(plp);
  const planHitsPhone = await hitScan(plp, '#view-planner');
  check('Modernist\'s Planner on a phone: nothing runs off the side (a long name is clipped), the shortlist sits under the days with no collapse, buttons answer over 44px',
        q8.scroll === q8.inner && q8.panelW === 412 && !q8.collapseBtn && !q8.rail && q8.headTitle && planHitsPhone.n >= 10 && planHitsPhone.miss.length === 0,
        JSON.stringify([q8.scroll, q8.inner, q8.panelW, q8.collapseBtn, q8.rail, planHitsPhone.n, planHitsPhone.miss.slice(0, 4)]));
  await plp.close();

  /* ---- Modernist, step 6: the Shopping List ----
     The fixture's list (PANTRY 3, PRODUCE 2). The square is a span beside the checkbox, which stays the thing that is
     focused and ticked; EXPORT PNG and print were checked with the real html2canvas and the browser's print by hand. */
  const shopLook = pg => pg.evaluate(() => {
    const cs = el => getComputedStyle(el), R = el => el.getBoundingClientRect();
    const cats = [...document.querySelectorAll('#shopBody .shop-category')].map(c => { const t = c.querySelector('.shop-category-title');
      return { name: t.textContent, count: t.dataset.count || null, after: getComputedStyle(t, '::after').content, rule: cs(t).borderTopWidth + ' ' + cs(t).borderTopColor,
        top: Math.round(R(c).top), left: Math.round(R(c).left) }; });
    const item = document.querySelector('#shopBody .shop-item'), box = item.querySelector('.shop-box'), input = item.querySelector('input');
    return { h1: cs(document.querySelector('#view-shopping .shop-head h1')).fontSize, meta: document.getElementById('shopMeta').textContent,
      metaColour: cs(document.getElementById('shopMeta')).color, options: [...document.querySelectorAll('#shopWeekSelect option')].map(o => o.textContent),
      cats, boxes: document.querySelectorAll('#shopBody .shop-box').length, box: box && { size: Math.round(R(box).width) + 'x' + Math.round(R(box).height), border: cs(box).borderTopWidth + ' ' + cs(box).borderTopColor },
      inputOpacity: cs(input).opacity, rows: document.querySelectorAll('#shopBody .shop-item').length,
      scroll: document.documentElement.scrollWidth, inner: innerWidth };
  });
  const shc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  shc.__label = 'shopping, classic';
  await shc.clock.setFixedTime(FIXTURE_NOW);
  await shc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await shc.waitForTimeout(1200);
  await shc.evaluate(() => showView('shopping')); await shc.waitForTimeout(300);
  const h0 = await shopLook(shc);
  check('Classic\'s Shopping List is as it was: "THIS WEEK · 5 items · 2 recipes", no dates in the weeks, the checkbox itself, no square or count',
        h0.meta === 'THIS WEEK · 5 items · 2 recipes' && h0.options[0] === 'THIS WEEK' && h0.boxes === 0 && h0.inputOpacity === '1' && h0.cats.every(c => c.count === null) &&
        h0.cats.length === 2 && h0.cats[0].left === h0.cats[1].left, JSON.stringify(h0));
  await shc.close();

  const shm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  shm.__label = 'shopping, modernist';
  await shm.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await shm.clock.setFixedTime(FIXTURE_NOW);
  await shm.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await shm.waitForTimeout(1200);
  await shm.evaluate(() => showView('shopping')); await shm.waitForTimeout(300);
  const h1 = await shopLook(shm);
  check('Modernist\'s Shopping List: a 56px title over "THIS WEEK · 22–24 SEP · 5 ITEMS · 2 RECIPES · 0 TICKED" in red, the weeks dated in the select',
        h1.h1 === '56px' && h1.meta === 'THIS WEEK · 22–24 SEP · 5 ITEMS · 2 RECIPES · 0 TICKED' && h1.metaColour === 'rgb(174, 24, 0)' && h1.options[0] === 'THIS WEEK · 22–24 SEP',
        JSON.stringify([h1.h1, h1.meta, h1.metaColour, h1.options]));
  check('    the aisles side by side in two columns, each under a 2px ink rule, its name alone in the title and "ticked / total" drawn beside it',
        h1.cats.length === 2 && h1.cats[0].top === h1.cats[1].top && h1.cats[1].left > h1.cats[0].left + 300 &&
        h1.cats.every(c => c.rule === '2px rgb(32, 30, 29)' && /attr\(data-count\)|\d \/ \d/.test(c.after)) &&
        h1.cats[0].name === 'PANTRY' && h1.cats[0].count === '0 / 3' && h1.cats[1].count === '0 / 2', JSON.stringify(h1.cats));
  check('    each row has a 22px square with a 2px ink rule, and the checkbox is still there, unseen',
        h1.boxes === h1.rows && h1.rows === 5 && h1.box.size === '22x22' && h1.box.border === '2px rgb(32, 30, 29)' && h1.inputOpacity === '0', JSON.stringify(h1.box));

  const shw0 = await shm.evaluate(() => window.__WRITES__.length);
  /* A tap where the square is drawn: the unseen checkbox lies over it, so that is what a finger meets. */
  const sqr = await shm.evaluate(() => { const r = document.querySelectorAll('#shopBody .shop-box')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await shm.mouse.click(sqr[0], sqr[1]); await shm.waitForTimeout(300);
  const sht1 = await shm.evaluate(() => { const it = document.querySelectorAll('#shopBody .shop-item')[1], cs = el => getComputedStyle(el);
    return { checked: it.classList.contains('checked') && it.querySelector('input').checked, box: cs(it.querySelector('.shop-box')).backgroundColor,
      fade: cs(it.querySelector('.shop-item-main')).opacity, strike: cs(it.querySelector('.shop-item-name')).textDecorationLine,
      meta: document.getElementById('shopMeta').textContent, count: it.closest('.shop-category').querySelector('.shop-category-title').dataset.count, writes: window.__WRITES__.length }; });
  check('    a tap on the square ticks the row (one write): the square goes red, the row fades and is struck through, and the counts say 1',
        sht1.checked && sht1.box === 'rgb(221, 43, 15)' && sht1.fade === '0.45' && sht1.strike === 'line-through' && /· 1 TICKED$/.test(sht1.meta) && sht1.count === '1 / 3' && sht1.writes === shw0 + 1,
        JSON.stringify(sht1));
  /* Onto the third row's checkbox by Tab, as a keyboard user arrives: the ring is drawn on its square. Space then ticks it.
     (The list is redrawn on every tick, so focus is lost after it, in both styles: a follow-up, D13.) */
  await shm.locator('#shopBody .shop-item input').nth(1).focus(); await shm.keyboard.press('Tab'); await shm.waitForTimeout(100);
  const shk0 = await shm.evaluate(() => { const it = document.querySelectorAll('#shopBody .shop-item')[2];
    return { onIt: document.activeElement === it.querySelector('input'), ring: getComputedStyle(it.querySelector('.shop-box')).outlineStyle }; });
  await shm.keyboard.press('Space'); await shm.waitForTimeout(300);
  const shk1 = await shm.evaluate(() => ({ checked: document.querySelectorAll('#shopBody .shop-item')[2].classList.contains('checked'), meta: document.getElementById('shopMeta').textContent }));
  check('    from the keyboard: Tab onto a row draws the focus ring on its square, and Space ticks it',
        shk0.onIt && shk0.ring === 'solid' && shk1.checked && /· 2 TICKED$/.test(shk1.meta), JSON.stringify([shk0, shk1]));
  await shm.click('#shopHideCheckedBtn'); await shm.waitForTimeout(300);
  const shh = await shopLook(shm);
  check('    HIDE TICKED leaves the rows still to buy, and the aisle still counts the whole of it ("2 / 3")',
        shh.rows === 3 && shh.cats[0].count === '2 / 3', JSON.stringify([shh.rows, shh.cats.map(c => c.count)]));
  await shm.click('#shopHideCheckedBtn'); await shm.waitForTimeout(200);
  await shm.evaluate(() => applyStyle('classic')); await shm.waitForTimeout(300);
  const h2 = await shopLook(shm);
  await shm.evaluate(() => applyStyle('modernist')); await shm.waitForTimeout(300);
  const h3 = await shopLook(shm);
  check('switching style redraws the Shopping List: Classic\'s words and checkboxes, then Modernist\'s again, ticks kept',
        h2.meta === 'THIS WEEK · 5 items · 2 recipes' && h2.boxes === 0 && /· 2 TICKED$/.test(h3.meta) && h3.boxes === 5, JSON.stringify([h2.meta, h2.boxes, h3.meta, h3.boxes]));
  await shm.close();

  const shp = await browser.newPage({ viewport: { width: 412, height: 915 } });
  shp.__label = 'shopping, modernist, phone';
  await shp.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await shp.clock.setFixedTime(FIXTURE_NOW);
  await shp.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await shp.waitForTimeout(1200);
  await shp.evaluate(() => showView('shopping')); await shp.waitForTimeout(300);
  const h4 = await shopLook(shp);
  check('Modernist\'s Shopping List on a phone: one column, and nothing runs off the side',
        h4.cats[0].left === h4.cats[1].left && h4.cats[1].top > h4.cats[0].top && h4.scroll === h4.inner, JSON.stringify([h4.cats, h4.scroll, h4.inner]));
  await shp.close();

  /* ---- Modernist, step 7: History ----
     The fixture's diary: 15 Sep cooked, 19 Sep one cooked and one ad hoc (a lunch), 20 Sep two ad hoc; today is 22 Sep. */
  const histLook = pg => pg.evaluate(() => {
    const cs = el => getComputedStyle(el), R = el => el.getBoundingClientRect(), cell = d => document.querySelector(`.history-day[data-date="${d}"]`);
    const tag = d => (t => t ? t.textContent : null)(cell(d) && cell(d).querySelector('.history-day-tag'));
    const panel = document.querySelector('#view-history .shortlist-panel'), h1 = document.getElementById('historyMonthLabel');
    const prev = document.getElementById('historyPrevMonth'), next = document.getElementById('historyNextMonth'), today = document.getElementById('historyTodayBtn');
    const other = document.querySelector('.history-day.other-month'), grid = document.getElementById('historyGrid');
    return { h1: cs(h1).fontSize, arrows: [prev, next].map(b => Math.round(R(b).width) + 'x' + Math.round(R(b).height) + ' ' + cs(b).fontSize),
      oneLine: Math.abs(R(prev).top - R(next).top) < 2 && R(next).left > R(h1).right, buttonsBelow: R(today).top >= R(h1).bottom - 4,
      grid: cs(grid).borderTopWidth + ' ' + cs(grid).borderTopColor + ' gap ' + cs(grid).rowGap, cellH: Math.round(R(cell('2026-09-08')).height),
      tags: ['2026-09-15', '2026-09-19', '2026-09-20', '2026-09-22', '2026-09-08'].map(tag),
      ring: cs(cell('2026-09-22')).boxShadow, todayNum: cs(cell('2026-09-22').querySelector('.history-day-num')).color,
      other: other && { cell: cs(other).opacity, num: cs(other.querySelector('.history-day-num')).opacity, bg: cs(other).backgroundColor },
      detail: document.getElementById('historyDayDetail').textContent.trim(), pies: document.querySelectorAll('#historyStats svg').length,
      bars: [...document.querySelectorAll('#historyStats .hstat-bar')].map(b => ({ h: Math.round(R(b).height), segs: [...b.children].map(x => cs(x).backgroundColor) })),
      mix: [1, 2, 3, 4, 5].map(i => cs(document.documentElement).getPropertyValue('--km-mix-' + i).trim()),
      panelScroll: panel.scrollWidth - panel.clientWidth, scroll: document.documentElement.scrollWidth - innerWidth };
  });
  const hc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  hc.__label = 'history, classic';
  await hc.clock.setFixedTime(FIXTURE_NOW);
  await hc.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await hc.waitForTimeout(1200);
  await hc.evaluate(() => showView('history')); await hc.waitForTimeout(300);
  const y0 = await histLook(hc);
  check('Classic\'s History is as it was: no word at the foot of a cell, the two pies, ← and → as words, nothing in the panel until a day is picked',
        y0.tags.every(t => t === null) && y0.pies === 2 && y0.bars.length === 0 && y0.detail === '' && y0.arrows.every(a => / 16px$/.test(a)), JSON.stringify(y0));
  await hc.close();

  const hm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  hm.__label = 'history, modernist';
  await hm.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await hm.clock.setFixedTime(FIXTURE_NOW);
  await hm.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await hm.waitForTimeout(1200);
  await hm.evaluate(() => showView('history')); await hm.waitForTimeout(300);
  const y1 = await histLook(hm);
  check('Modernist\'s History: the month at 56px between 40px ‹ and › squares, TODAY, + ENTRY and CSV on the line below, the grid in a 2px ink frame, cells 92px',
        y1.h1 === '56px' && y1.arrows.every(a => /^40x40 0px$/.test(a)) && y1.oneLine && y1.buttonsBelow && y1.grid === '2px rgb(32, 30, 29) gap 2px' && y1.cellH >= 92,
        JSON.stringify([y1.h1, y1.arrows, y1.oneLine, y1.buttonsBelow, y1.grid, y1.cellH]));
  check('    each cell says COOKED, AD HOC or TODAY at its foot; today is ringed in red with a red date; other months\' days are faint on the same ground',
        JSON.stringify(y1.tags) === '["COOKED","COOKED","AD HOC","TODAY",null]' && y1.ring === 'rgb(236, 48, 19) 0px 0px 0px 3px inset' && y1.todayNum === 'rgb(236, 48, 19)' &&
        y1.other.cell === '1' && y1.other.num === '0.4' && y1.other.bg === 'rgb(243, 242, 242)', JSON.stringify([y1.tags, y1.ring, y1.todayNum, y1.other]));
  check('    the panel says "Pick a day" until one is picked, and does not scroll sideways', y1.detail === 'Pick a day' && y1.panelScroll === 0, JSON.stringify([y1.detail, y1.panelScroll]));
  check('    the meal-base mixes are two 28px bars in the accent and ink, with no pies',
        y1.pies === 0 && y1.bars.length === 2 && y1.bars.every(b => b.h === 28 && b.segs[0] === 'rgb(236, 48, 19)' && b.segs[1] === 'rgb(32, 30, 29)'), JSON.stringify(y1.bars));

  await hm.click('.history-day[data-date="2026-09-19"]'); await hm.waitForTimeout(300);
  const y2 = await hm.evaluate(() => {
    const cs = el => getComputedStyle(el), R = el => el.getBoundingClientRect(), c = document.querySelector('.history-day[data-date="2026-09-19"]');
    const t = document.querySelector('.history-day-detail-title'), adhoc = document.querySelector('.history-day-recipe.diary-adhoc');
    const meal = adhoc.querySelector('.diary-meal-tag'), kind = adhoc.querySelector('.diary-kind');
    return { cell: cs(c).backgroundColor + ' / ' + cs(c).color, title: cs(t).fontSize + ' ' + cs(t).borderBottomWidth + ' ' + cs(t).borderBottomColor,
      entries: document.querySelectorAll('.history-day-recipe').length, mealFirst: R(meal).left < R(kind).left && Math.abs(R(meal).top - R(kind).top) < 2,
      below: R(meal).top > R(adhoc.querySelector('span > :first-child')).bottom - 2, sep: getComputedStyle(kind, '::before').content, colour: cs(meal).color };
  });
  check('    picking a day fills it with ink; the panel\'s day title is 26px over a 2px ink rule; an entry reads "LUNCH · AD HOC" in red under its name',
        y2.cell === 'rgb(32, 30, 29) / rgb(243, 242, 242)' && y2.title === '26px 2px rgb(32, 30, 29)' && y2.entries === 2 && y2.mealFirst && y2.below && /·/.test(y2.sep) && y2.colour === 'rgb(174, 24, 0)',
        JSON.stringify(y2));
  const histHits = await hitScan(hm, '#view-history .history-head');
  check('    ‹, › and the buttons beside them answer a tap over 44px', histHits.n === 5 && histHits.miss.length === 0, JSON.stringify(histHits));
  await hm.evaluate(() => { applyTheme('dark'); rerenderForTheme(); }); await hm.waitForTimeout(300);
  const y3 = await histLook(hm);
  check('    in dark the bars take the dark colours without a redraw, and the five are all different (the spec\'s dark accent-300 and accent-800 are one colour)',
        y3.bars[0].segs[0] === 'rgb(255, 86, 60)' && y3.bars[0].segs[1] === 'rgb(241, 238, 236)' && new Set(y3.mix).size === 5, JSON.stringify([y3.bars, y3.mix]));
  await hm.evaluate(() => { applyTheme('light'); rerenderForTheme(); }); await hm.waitForTimeout(200);
  await hm.evaluate(() => applyStyle('classic')); await hm.waitForTimeout(300);
  const y4 = await histLook(hm);
  await hm.evaluate(() => applyStyle('modernist')); await hm.waitForTimeout(300);
  const y5 = await histLook(hm);
  check('switching style redraws History: Classic\'s pies and plain cells, then Modernist\'s bars and words again',
        y4.pies === 2 && y4.bars.length === 0 && y4.tags.every(t => t === null) && y5.pies === 0 && y5.bars.length === 2 && y5.tags[3] === 'TODAY',
        JSON.stringify([y4.pies, y4.bars.length, y4.tags, y5.pies, y5.bars.length, y5.tags]));
  await hm.close();

  const hp = await browser.newPage({ viewport: { width: 412, height: 915 } });
  hp.__label = 'history, modernist, phone';
  await hp.addInitScript(() => { try { localStorage.setItem('kitchen.style', 'modernist'); } catch (e) {} });
  await hp.clock.setFixedTime(FIXTURE_NOW);
  await hp.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await hp.waitForTimeout(1200);
  await hp.evaluate(() => showView('history')); await hp.waitForTimeout(300);
  const y6 = await histLook(hp);
  check('Modernist\'s History on a phone: ‹ September 2026 › on one line, and nothing runs off the side',
        y6.oneLine && y6.scroll === 0 && y6.panelScroll === 0, JSON.stringify([y6.oneLine, y6.scroll, y6.panelScroll, y6.h1]));
  await hp.close();

  /* Nothing reached the network (F30): every http(s) request any page made was refused by the catch-all above or
     answered by the test's own route. A request is intercepted before it is sent, so one the catch-all had not got to
     yet (a late image on a page still open when this runs, or one dropped when its page closed) was held, not sent:
     it shows as never answered, as no response with no error (its page closed first: seen once in four runs side by
     side, 12 Oct), or as ERR_ABORTED, and is not counted. One that reached the network has an answer or a
     network error of its own (a DNS or proxy failure), and is. The second check proves the first is not vacuous:
     the fixture's live Storage addresses were among them. */
  await page.waitForTimeout(300);
  const unhandled = net.seen.filter(x => !net.handled.has(x.req));
  for (const x of unhandled) {
    const r = await Promise.race([x.req.response().catch(() => null), new Promise(ok => setTimeout(() => ok('pending'), 500))]);
    x.fate = (x.req.failure() || {}).errorText || (r === 'pending' ? 'never answered' : r ? 'answered ' + r.status() : 'no response');
  }
  const escaped = unhandled.filter(x => !/^(never answered|no response|net::ERR_ABORTED)$/.test(x.fate));
  check('no page reached the network: every request was refused or answered by the test',
        escaped.length === 0, [...new Set(escaped.map(x => x.page + ' ' + x.url + ' ' + x.fate))].slice(0, 5).join(', '));
  check(`    and the live project's addresses were among them (${net.seen.length} requests, ${opened} pages)`,
        net.seen.some(x => /^https:\/\/[a-z]+\.supabase\.co\//.test(x.url)));

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
