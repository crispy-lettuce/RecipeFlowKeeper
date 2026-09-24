const { chromium } = require('playwright');

/* Playwright finds its own browser by default. PLAYWRIGHT_CHROMIUM is only
   needed where the repo's Chromium lives somewhere Playwright doesn't look. */
const launchOpts = process.env.PLAYWRIGHT_CHROMIUM
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
  : {};
const path = require('path');
const { FIXTURE_NOW } = require('./fixture-time');
(async () => {
  const b = await chromium.launch(launchOpts);
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.clock.setFixedTime(FIXTURE_NOW);   // the fixture's dates are relative to this day
  await p.goto('file://' + path.join(__dirname, 'app-under-test.html'));
  await p.waitForTimeout(1200);
  const shots = [
    ['planner', '.navlink[data-view="planner"]'],
    ['shopping', '.navlink[data-view="shopping"]'],
    ['settings', '.navlink[data-view="settings"]'],
    ['history', '.navlink[data-view="history"]']
  ];
  for (const [name, sel] of shots) {
    await p.click(sel);
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(__dirname, name + '.png') });
  }
  // A recipe scaled to 6, to show the viewer control row.
  await p.click('.navlink[data-view="recipes"]');
  await p.waitForTimeout(400);
  await p.locator('.rcard').first().click();
  await p.waitForTimeout(500);
  await p.click('.viewer-scale-row .scale-btn[data-viewer-serves="6"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, 'viewer.png') });
  await b.close();
  console.log('shots written');
})();
