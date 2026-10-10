/* Keeps the how-to guide (help.html) true to the app.
 *
 * The guide names buttons exactly as they read in the app, marked
 * <b class="ui">LABEL</b>. A label renamed in index.html would leave the
 * guide quietly wrong, so this checks every one of them is still there, and
 * that every place the app links into the guide (Settings → HELP's QUICK
 * ANSWERS) and the guide links to itself (its contents) lands on an id that
 * exists. Run it after changing an on-screen label or the guide.
 *
 *   node test/help-guide.js
 *
 * Added 10 Oct 2026. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const guide = fs.readFileSync(path.join(ROOT, 'help.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined && !pass ? '  (' + detail + ')' : ''}`);
};
const unescape = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

/* ---- Every quoted label is one the app still shows ---- */
const labels = [...new Set([...guide.matchAll(/<b class="ui">([\s\S]*?)<\/b>/g)].map(m => unescape(m[1]).trim()))];
check('the guide quotes the app\'s buttons (more than 50 of them)', labels.length > 50, labels.length);
const missing = labels.filter(l => !app.includes(l) && !app.includes(l.replace(/&/g, '&amp;')));
check('every button the guide names is still in the app, spelt the same', missing.length === 0, missing.join(' | '));

/* ---- Every link into the guide lands ---- */
const ids = new Set([...guide.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const appLinks = [...app.matchAll(/href="help\.html#([^"]+)"/g)].map(m => m[1]);
const answers = (app.match(/<ul class="help-answers" id="helpAnswers">([\s\S]*?)<\/ul>/) || [])[1] || '';
const answerHrefs = [...answers.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
check('Settings → HELP\'s QUICK ANSWERS all link into the guide (at least six)',
      answerHrefs.length >= 6 && answerHrefs.every(h => /^help\.html#[\w-]+$/.test(h)), answerHrefs.join(', '));
const appBroken = appLinks.filter(a => !ids.has(a));
check('every link from the app into the guide lands on a section that exists', appBroken.length === 0, appBroken.join(', '));
check('the app links to the guide itself', /href="help\.html"/.test(app));
const ownLinks = [...guide.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
const ownBroken = ownLinks.filter(a => !ids.has(a));
check('every entry in the guide\'s contents lands on a section that exists', ownLinks.length >= 10 && ownBroken.length === 0, ownBroken.join(', ') || ownLinks.length);

/* ---- Links to this repo's own files land (10 Oct 2026) ----
   The guide points a new household at converter/conversion-instructions.md on GitHub rather than copying it, so it is always the
   current version. A file moved or renamed would leave that link dead without anyone noticing; this names it. */
const REPO_FILE = /href="https:\/\/(?:github\.com\/crispy-lettuce\/RecipeFlowKeeper\/blob|raw\.githubusercontent\.com\/crispy-lettuce\/RecipeFlowKeeper)\/main\/([^"#?]+)"/g;
const repoFiles = [...guide.matchAll(REPO_FILE)].map(m => decodeURIComponent(m[1]));
const repoMissing = repoFiles.filter(f => !fs.existsSync(path.join(ROOT, f)));
check('every link from the guide to a file in this repo names a file that exists (the conversion instructions among them)',
      repoFiles.includes('converter/conversion-instructions.md') && repoMissing.length === 0, repoMissing.join(', ') || repoFiles.join(', '));

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
