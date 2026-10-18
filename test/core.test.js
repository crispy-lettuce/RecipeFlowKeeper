/* The pure core, tested in Node: no browser, no build, milliseconds.

     node test/core.test.js

   Two kinds of check. The first half keeps the split between core.js and
   index.html honest, because a split that drifts is worse than none: a
   function defined in both files runs whichever the page happens to load
   last, and a core.js that reached into the page could no longer run here.
   The second half pins the behaviour the app relies on, with made-up lines,
   the same claims the smoke suite makes through the browser — so the
   shopping-list release (PR 6b) can be written against these in seconds.

   Added 25 Sep 2026 with core.js (PR 6a). Prints as it goes, like smoke.js,
   and exits 1 on any failure. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* computeColumns reads the flow table's colours from the page at call time
   (they follow the theme). Stand them in before anything is called. */
globalThis.PALETTE = ['#111', '#222', '#333'];
globalThis.MERGE_COLOR = '#999';
const core = require(path.join(ROOT, 'core.js'));

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined && !pass ? '  (' + detail + ')' : ''}`);
};

const coreSrc = fs.readFileSync(path.join(ROOT, 'core.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/* Comments are prose and may name anything; only the code is checked. */
const code = coreSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

/* ---- The split ---- */
const touches = (code.match(/\b(document|window|localStorage|sessionStorage|navigator|cache|state|sb)\s*\./g) || []);
check('core.js touches no page state (document, window, cache, state, sb, storage)', touches.length === 0, touches.join(', '));

const topNames = src => new Set([...src.matchAll(/^(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm)].map(m => m[1] || m[2]));
const inCore = topNames(coreSrc);
const inPage = topNames(pageSrc);
const both = [...inCore].filter(n => inPage.has(n));
check('nothing core.js defines is also defined in index.html', both.length === 0, both.join(', '));
check('core.js defines the functions the page moved to it',
      ['splitQty', 'parseRecipe', 'scaleRecipeSyntax', 'computeColumns', 'parseIngredientAmount', 'categorizeIngredient', 'withUpdatedHeaderLines'].every(n => inCore.has(n)));

const expected = (pageSrc.match(/const EXPECTED_CORE_VERSION = '([^']+)'/) || [])[1];
const tagVersion = (pageSrc.match(/<script src="core\.js\?v=([^"]+)"><\/script>/) || [])[1];
check('index.html expects the core.js version that core.js declares',
      expected === core.KITCHEN_CORE_VERSION && tagVersion === core.KITCHEN_CORE_VERSION,
      `core ${core.KITCHEN_CORE_VERSION}, page expects ${expected}, tag asks for ${tagVersion}`);
const coreTag = pageSrc.indexOf('<script src="core.js');
const mainScript = pageSrc.indexOf('const EXPECTED_CORE_VERSION');
check('core.js loads before the page script that uses it', coreTag !== -1 && mainScript > coreTag);

/* ---- The app's version and its change log (issue #91, 11 Oct 2026) ----
   changelog.json is what the household reads in Settings → HELP and what an open tab asks to learn a new version is out,
   so a malformed one, or one whose top entry is not the version the page says it is, would mislead both. */
let changelog = null, changelogError = '';
try { changelog = JSON.parse(fs.readFileSync(path.join(ROOT, 'changelog.json'), 'utf8')); } catch(e){ changelogError = e.message; }
check('changelog.json reads as a list of entries', Array.isArray(changelog) && changelog.length > 0, changelogError);
const clEntries = Array.isArray(changelog) ? changelog : [];
const clBad = clEntries.filter(e => !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(e.version || '') || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')
  || !Array.isArray(e.changes) || !e.changes.length || e.changes.some(c => typeof c !== 'string' || !c.trim()) || e.date > e.version.split('.')[0]
  || (e.issues !== undefined && (!Array.isArray(e.issues) || e.issues.some(n => !Number.isInteger(n)))));
check('every entry has a dated version (YYYY-MM-DD.n), its date, and at least one change in words', clBad.length === 0, JSON.stringify(clBad));
const clOrder = (a, b) => { const [da, na] = a.split('.'), [db, nb] = b.split('.'); return da !== db ? (da < db ? -1 : 1) : (+na) - (+nb); };
const clVersions = clEntries.map(e => e.version);
check('the versions are all different, newest first',
      new Set(clVersions).size === clVersions.length && clVersions.every((v, i) => i === 0 || clOrder(clVersions[i - 1], v) > 0), clVersions.join(', '));
const appVersion = (pageSrc.match(/const APP_VERSION = '([^']+)'/) || [])[1];
check('index.html is the version at the top of changelog.json', !!appVersion && appVersion === clVersions[0], `page ${appVersion}, log ${clVersions[0]}`);

/* ---- The page's colours (READABILITY T, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
   Read from the stylesheet's source, in Node: the pure-arithmetic half of T. The browser half (what actually lands on
   screen, against the real backgrounds) is in smoke.js. Comments are stripped first because the :root block's own comments
   name the strings these checks look for. */
{
  const css = pageSrc.slice(pageSrc.indexOf('<style>') + 7, pageSrc.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rootLight = (css.match(/:root\{([^}]*)\}/) || [])[1] || '';
  const rootDark = (css.match(/:root\[data-theme="dark"\]\{([^}]*)\}/) || [])[1] || '';
  const rules = css.replace(/:root\{[^}]*\}/, '').replace(/:root\[data-theme="dark"\]\{[^}]*\}/, '');
  const found = rootLight.includes('--paper:') && rootDark.includes('--paper:');

  /* A literal colour in a rule is a light-theme colour the dark theme cannot reach: a plum wash written as rgba(91,42,74,.09)
     was dark plum on a dark ground, 1.03:1 against its surface, i.e. not there. */
  const literals = (rules.match(/[^;{}]*rgba\([^;}]*/g) || []).map(s => s.trim().slice(0, 70));
  check('no rule in the stylesheet writes an rgba() colour; every tint, shadow and scrim is a token that has a dark value',
        found && literals.length === 0, found ? literals.join(' | ') : 'the :root blocks were not found');

  const hexOf = (block, name) => (block.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})\\s*;')) || [])[1];
  const lum = hex => { const n = parseInt(hex.slice(1), 16); const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
                       return 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const short = [];
  for (const [theme, block] of [['light', rootLight], ['dark', rootDark]])
    for (const ink of ['ink-soft', 'ink-faint'])
      for (const ground of ['paper', 'card']) {
        const fg = hexOf(block, ink), bg = hexOf(block, ground);
        const r = fg && bg ? ratio(fg, bg) : 0;
        if (r < 4.5) short.push(`${theme} ${ink} ${fg} on ${ground} ${bg}: ${r.toFixed(2)}`);
      }
  check('--ink-soft and --ink-faint reach 4.5:1 on --paper and --card, in the light and the dark theme',
        found && short.length === 0, short.join('; '));

  /* --ink-mute was 3.4:1 on paper and is kept only as a fill (the numbered-step badge). Text 18px or larger could use it
     under WCAG; if that is ever wanted, this check is the place to say which rule. */
  const muteText = (rules.match(/(?:^|[;{\s])color\s*:\s*var\(--ink-mute\)/g) || []).length;
  check('no rule sets its text colour to --ink-mute', found && muteText === 0, muteText + ' rule(s)');

  check("the sidebar's SAVED count is --ink-faint, not --line-faint (a border colour, 1.7:1)",
        /\.side-count\{[^}]*[;\s]color:var\(--ink-faint\)/.test(rules));

  /* The dark theme is one attribute swapping the whole palette (see the DARK THEME block): a token defined only in the light
     block resolves to nothing in the dark one and the colour silently falls back to inherited. --r is a size, not a colour. */
  const names = block => new Set([...block.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const lightNames = names(rootLight), darkNames = names(rootDark);
  const missingDark = [...lightNames].filter(n => n !== '--r' && !darkNames.has(n));
  check('every colour token the light theme defines, the dark theme defines too', found && missingDark.length === 0, missingDark.join(', '));
}

/* ---- The type scale (READABILITY S, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
   Read from the stylesheet's source, as T's colour checks are. The stylesheet had 21 sizes from 8.5px to 28px, 76 rules at
   10.5px or smaller and IBM Plex Mono on 108 rules; the browser half (what 13px and 14px do to the real screens) is in smoke.js. */
{
  const css = pageSrc.slice(pageSrc.indexOf('<style>') + 7, pageSrc.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  /* A rule's body has no braces, so this reads a rule inside an @media block as it reads one outside it. */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));
  const SCALE = [13, 14, 15, 16, 19, 22, 26];
  const sizes = [...css.matchAll(/font-size\s*:\s*([\d.]+)px/g)].map(m => +m[1]);
  const shorthand = rules.filter(r => /(^|[;\s])font\s*:[^;]*\d+(\.\d+)?px/.test(r.body)).map(r => r.sel);
  const off = [...new Set(sizes.filter(v => !SCALE.includes(v)))];
  check('every font size in the stylesheet is on the scale (13, 14, 15, 16, 19, 22, 26px), and none is set in a font shorthand',
        sizes.length > 150 && off.length === 0 && shorthand.length === 0, `${sizes.length} sizes read` + (off.length ? '; off the scale: ' + off.join(', ') + 'px' : '') + (shorthand.length ? '; shorthand: ' + shorthand.join(' | ') : ''));

  /* Mono is for figures, times and code, where its fixed width lines them up. A label in tracked mono capitals is wider in
     Plex Sans, so a new label set in mono again would be the old stylesheet back. The list is exact: a rule that gains or loses
     mono is a decision to make here, not a drift. */
  const MONO_OK = ['.mono', '.qty', '.step-duration', '.day-recipe-time', '.day-num', '.scale-btn', '.history-day-num', '.side-count',
    '.result-count', '.shortlist-count', '.ingr-count', '.source-row-count', 'ol.setup li::before', 'textarea#importInput',
    'textarea#sourcePasteInput', '.rv-row code', '.line-check code', '.rv-undo code', '.hstat-legend-value', '.swap-row-ratio',
    '.timeline-ruler', '.cn-date', '.stacked-recipe-start', '.stacked-recipe-serves', '.photo-overlay-head', '.pdf-card-mark'];
  const mono = rules.filter(r => /IBM Plex Mono/.test(r.body)).map(r => r.sel);
  const stray = mono.filter(sel => !MONO_OK.includes(sel)), unused = MONO_OK.filter(sel => !mono.includes(sel));
  check('IBM Plex Mono is on exactly the rules for numbers, times and code (26), and nowhere else',
        mono.length > 0 && stray.length === 0 && unused.length === 0, [stray.length ? 'mono but not listed: ' + stray.join(' | ') : '', unused.length ? 'listed but not mono: ' + unused.join(' | ') : ''].filter(Boolean).join('; '));

  /* Weight 300 is thin on the tablet. Titles of 19px and up keep it; body text is 400. */
  const bodyRule = rules.find(r => r.sel === 'body');
  const thin = rules.filter(r => /font-weight\s*:\s*300/.test(r.body)).filter(r => { const m = r.body.match(/font-size\s*:\s*([\d.]+)px/); return !m || +m[1] < 19; }).map(r => r.sel);
  check('the body weight is 400, and weight 300 is left only on titles of 19px and up',
        !!bodyRule && /font-weight\s*:\s*400/.test(bodyRule.body) && thin.length === 0, thin.join(' | '));

  /* PLAN-LAYOUT C (step words at the foot of the box) stands; READABILITY S set the words flush left in Plex Sans 15px. */
  const bc = rules.find(r => r.sel === '.box-cell');
  check('a step box is Plex Sans 15px, flush left and at the foot of its box (not mono, not centred)',
        !!bc && !/Mono/.test(bc.body) && /text-align\s*:\s*left/.test(bc.body) && /vertical-align\s*:\s*bottom/.test(bc.body) && /font-size\s*:\s*15px/.test(bc.body) && /line-height\s*:\s*1\.45/.test(bc.body), bc ? bc.body.replace(/\s+/g, ' ').trim() : 'no .box-cell rule');

  /* The old done state faded the whole cell with opacity .35. */
  const dn = rules.find(r => r.sel === '.ing-cell.done, .box-cell.done'), tk = rules.find(r => r.sel === '.ing-cell.done::after, .box-cell.done::after');
  check('a ticked box is struck through, not faded, and its tick is 26px with a 15px glyph',
        !!dn && !/opacity/.test(dn.body) && /line-through/.test(dn.body) && !!tk && /width\s*:\s*26px/.test(tk.body) && /height\s*:\s*26px/.test(tk.body) && /font-size\s*:\s*15px/.test(tk.body),
        (dn ? dn.body.replace(/\s+/g, ' ').trim() : 'no done rule') + ' | ' + (tk ? 'tick found' : 'no tick rule'));
}

/* ---- Tap targets (READABILITY H, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
   Read from the stylesheet's source, as T's and S's are. The plan's list named the viewer's buttons, but its check reached the
   Planner's, 28 of whose 36 buttons stayed under 44px on the list alone; smoke.js measures what is on screen. */
{
  const css = pageSrc.slice(pageSrc.indexOf('<style>') + 7, pageSrc.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sels: m[1].split(',').map(x => x.trim().replace(/\s+/g, ' ')), body: m[2] }));
  const px = (r, prop) => { const m = r.body.match(new RegExp('(?:^|[;\\s])' + prop + '\\s*:\\s*([\\d.]+)px')); return m ? +m[1] : 0; };
  const has = (sel, prop, min) => rules.some(r => r.sels.includes(sel) && px(r, prop) >= min);
  /* A new button in the viewer, the Planner or the sidebar belongs on this list, and on the one in the stylesheet's TAP TARGETS block. */
  const TALL = ['.btn', '.chip', '.scale-btn', 'select.sort', '.kw-input', '.day-recipe-premade', '.day-recipe-cooked', '.backlink', '.toggle-switch',
    '.day-choose', '.day-recipe-title', '.day-recipe-serves', '.day-recipe-remove', '.day-side-add', '.day-side-hide', '.day-cal-btn', '.group-badge',
    '.sl-remove', '.saved-view', '.data-link', '.new-recipe', '.navlink', '.serve-with-link', '#viewerServesCustom'];
  const WIDE = ['.scale-btn', '.day-recipe-remove', '.day-side-hide', '.sl-remove'];   // × and the round scale buttons were 13px and 27px wide
  const short = TALL.filter(sel => !has(sel, 'min-height', 44)), narrow = WIDE.filter(sel => !has(sel, 'min-width', 44));
  check('every button in the viewer, Planner and sidebar has a min-height of 44px, and the × and scale buttons a min-width of 44px',
        short.length === 0 && narrow.length === 0, [short.length ? 'not 44px tall: ' + short.join(', ') : '', narrow.length ? 'not 44px wide: ' + narrow.join(', ') : ''].filter(Boolean).join('; '));

  /* 44px circles would cover the photo, so the card's corner buttons are 36px and an invisible ::before makes up the rest (-5px from the padding box, inside a 1px border: -4px was 42px). */
  const corner = ['.rcard-shortlist', '.rcard-favourite'];
  const cornerOk = corner.every(sel => has(sel, 'width', 36) && has(sel, 'height', 36)) &&
    rules.some(r => corner.every(sel => r.sels.includes(sel + '::before')) && /content\s*:\s*''/.test(r.body) && /position\s*:\s*absolute/.test(r.body) && /inset\s*:\s*-5px/.test(r.body));
  check('the card corner buttons are 36px with a ::before that makes their hit area 44px', cornerOk);

  /* The thumb travels the track's inside less the thumb and a 2px gap each side; change one number and the others follow. */
  const track = rules.find(r => r.sels.includes('.toggle-track')), thumb = rules.find(r => r.sels.includes('.toggle-thumb')),
    travel = (css.match(/input:checked \+ \.toggle-track \.toggle-thumb\s*\{\s*transform\s*:\s*translateX\((\d+)px\)/) || [])[1];
  const tw = track ? px(track, 'width') : 0, th = track ? px(track, 'height') : 0, tt = thumb ? px(thumb, 'width') : 0;
  check('the toggle is 44px by 26px, and its thumb travels exactly the room it has',
        tw === 44 && th === 26 && tt === 20 && +travel === tw - 2 - tt - 4, `track ${tw}x${th}, thumb ${tt}px, travel ${travel}px (should be ${tw - 2 - tt - 4})`);
}

/* ---- Keyboard focus (READABILITY F, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
   Seven rules used to turn the page's ring off on the control that has the focus: the keyword box looked the same focused or not.
   Read from the stylesheet's source, as T's, S's and H's are; smoke.js tabs through the screens and looks at what is drawn. */
{
  const css = pageSrc.slice(pageSrc.indexOf('<style>') + 7, pageSrc.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sels: m[1].split(',').map(x => x.trim().replace(/\s+/g, ' ')), body: m[2] }));
  const rule = sel => rules.find(r => r.sels.includes(sel));

  /* A new field that sets outline:none is a control the keyboard cannot see. The search input is the one exception: its frame draws the ring. */
  const off = rules.filter(r => /(?:^|[;\s])outline(?:-style)?\s*:\s*(?:none|0)(?![\d.])/.test(r.body)).map(r => r.sels.join(', '));
  check("the only rule that turns the focus ring off is the search input's, whose frame draws it instead",
        off.length === 1 && off[0] === '.searchbar input', off.length ? 'outline off on: ' + off.join(' | ') : 'no rule found');

  /* The frame carries the search input's ring; the side menu clips its sides (overflow-y:auto), so its links draw theirs inside. */
  const frame = rule('.searchbar:focus-within'), side = rule('.sidebar :focus-visible');
  const frameOk = !!frame && /outline\s*:\s*2px solid var\(--plum\)/.test(frame.body) && /outline-offset\s*:\s*2px/.test(frame.body);
  const sideOk = !!side && /outline-offset\s*:\s*-2px/.test(side.body);
  check("the search bar's frame draws the ring, and the side menu draws it inside its links",
        frameOk && sideOk, [frameOk ? '' : 'the search frame has no 2px plum ring', sideOk ? '' : 'the side menu has no inside ring'].filter(Boolean).join('; '));

  /* The keyword box is replaced the moment it loses focus, so its idle border is rarely seen; the plan still asks for --line, then --plum. */
  const kw = rule('.kw-input'), kwFocus = rule('.kw-input:focus');
  check('the keyword box has a --line border until it has focus, and a --plum one then',
        !!kw && /border\s*:\s*1px solid var\(--line\)/.test(kw.body) && !!kwFocus && /border-color\s*:\s*var\(--plum\)/.test(kwFocus.body),
        kw ? kw.body.match(/border\s*:[^;]*/)?.[0] + ' / ' + (kwFocus ? kwFocus.body.trim() : 'no :focus rule') : 'no .kw-input rule');
}

/* ---- One corner radius (READABILITY R, 14 Oct 2026, docs/PLAN-READABILITY.md) ----
   There were twelve values: circles (50%), pills (20px, 999px) and five small ones beside --r. Read from the stylesheet's source;
   smoke.js looks at the corners that are drawn. */
{
  const css = pageSrc.slice(pageSrc.indexOf('<style>') + 7, pageSrc.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sels: m[1].split(',').map(x => x.trim().replace(/\s+/g, ' ')), body: m[2] }));
  /* Two corners are square on purpose because they sit against another edge, where a round one would leave a notch: the Equipment
     warning is a full-width strip, and the peek tab is attached to the window's edge (its square side is the attached one). */
  const FLUSH = { '#viewerEquipmentWarning': '0', '.sidebar-peek-btn': '0 var(--r) var(--r) 0' };
  const found = [];
  for (const r of rules) for (const m of r.body.matchAll(/(?:^|[;\s])border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;]+)/g))
    found.push({ sel: r.sels.join(', '), value: m[1].trim().replace(/\s+/g, ' ') });
  const stray = found.filter(f => f.value !== 'var(--r)' && FLUSH[f.sel] !== f.value);
  const flushSeen = Object.keys(FLUSH).filter(k => found.some(f => f.sel === k && f.value === FLUSH[k]));
  const rootR = [...pageSrc.matchAll(/--r\s*:\s*([^;]+);/g)].map(m => m[1].trim());
  check('every corner in the stylesheet is var(--r) (2px), except two rules that sit flush against an edge',
        found.length > 60 && stray.length === 0 && flushSeen.length === 2 && rootR.length === 1 && rootR[0] === '2px',
        `${found.length} declarations` + (stray.length ? '; not var(--r): ' + stray.slice(0, 4).map(f => f.sel + ' ' + f.value).join(' | ') : '') +
        (flushSeen.length !== 2 ? '; the flush rules have changed: ' + Object.keys(FLUSH).filter(k => !flushSeen.includes(k)).join(', ') : '') + (rootR.length === 1 && rootR[0] === '2px' ? '' : `; --r is ${rootR.join(' and ') || 'missing'}`));
}

/* ---- The second style, Modernist (docs/PLAN-MODERNIST.md) ----
   It is a layer on top of Classic and must never reach it. Read from the sources, in Node, as the Classic lints above are;
   smoke.js proves the switch in a browser. The Classic lints read only the first <style> block, so none of them sees
   styles/modernist.css, and these are its own. */
{
  const modSrc = fs.readFileSync(path.join(ROOT, 'styles', 'modernist.css'), 'utf8');
  const mod = modSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  const classic = pageSrc.slice(pageSrc.indexOf('<style>') + 7, pageSrc.indexOf('</style>'));
  /* A rule inside @media is matched on its own, by its innermost {…}, and the @media wrapper is never part of a selector.
     A block that is not a rule (@font-face, @keyframes) would show up with an @ selector and fail the scope check. */
  /* Split a selector list on its own commas only, not those inside :is(…) or :not(…). */
  const splitSelectors = s => { const out = []; let depth = 0, cur = '';
    for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
    return out.concat(cur).map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean); };
  const rules = [...mod.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sels: splitSelectors(m[1]), body: m[2] }));
  const SCOPE = /^(?:html)?\[data-style="modernist"\](?![\w-])/;

  const unscoped = rules.flatMap(r => r.sels).filter(s => !SCOPE.test(s));
  check('every selector in styles/modernist.css begins [data-style="modernist"], so none of it can reach Classic',
        rules.length > 5 && unscoped.length === 0, `${rules.length} rules` + (unscoped.length ? '; not scoped: ' + unscoped.slice(0, 4).join(' | ') : ''));

  const radii = rules.flatMap(r => [...r.body.matchAll(/(?:^|[;\s])border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;]+)/g)].map(m => r.sels[0] + ' ' + m[1].trim()))
    .filter(x => !/ 0(?:px)?$/.test(x));
  const radiusTokens = [...mod.matchAll(/--(?:radius-(?:sm|md|lg)|r)\s*:\s*([^;]+);/g)].map(m => m[1].trim());
  check('zero border-radius anywhere: no rule sets one, and every radius token is 0px',
        radii.length === 0 && radiusTokens.length >= 4 && radiusTokens.every(v => v === '0px'), radii.concat(radiusTokens.filter(v => v !== '0px')).slice(0, 4).join(' | '));

  const fonts = rules.flatMap(r => [...r.body.matchAll(/(?:^|[;\s])font-family\s*:\s*([^;]+)/g)].map(m => m[1].replace(/\s*!important/, '').trim()));
  const fontTokens = [...mod.matchAll(/--font-(?:heading|body)\s*:\s*([^;]+);/g)].map(m => m[1].trim());
  /* The only url() allowed is an inline SVG (an icon drawn as a mask): nothing is fetched by this file. */
  check('Archivo only: every font-family is the font token, both tokens start with Archivo, and nothing imports a font or fetches a file',
        fonts.length > 0 && fonts.every(f => /^var\(--font-(?:body|heading)\)$/.test(f)) && fontTokens.length === 2 && fontTokens.every(f => /^"Archivo"/.test(f)) && !/@import|@font-face|url\((?!"data:image\/svg\+xml,)/.test(mod),
        fonts.filter(f => !/^var\(--font-/.test(f)).concat(fontTokens.filter(f => !/^"Archivo"/.test(f))).join(' | '));

  /* EXPORT PNG draws with html2canvas 1.4.1, which throws on the color(srgb …) that Chrome reports for a color-mix(): the
     export failed outright in this style until the tints were written as rgba(). Measured with the real library, 15 Oct. */
  const mixes = rules.filter(r => /color-mix\(/.test(r.body)).map(r => r.sels[0]).concat(/color-mix\(/.test(mod.replace(/[^{}]+\{[^{}]*\}/g, '')) ? ['outside a rule'] : []);
  check('no color-mix() in styles/modernist.css, which EXPORT PNG cannot draw', mixes.length === 0, mixes.slice(0, 4).join(' | '));

  /* Words on red use the darker fill (--km-fill, #dd2b0f: 4.7:1 with white), never the accent itself (4.2:1); the household
     chose it on 15 Oct. A rule that sets on-accent words must not set the accent as its background. */
  const onBright = rules.filter(r => /color\s*:\s*var\(--km-on-accent\)/.test(r.body) && /(?:background(?:-color)?|--cell-bg)\s*:\s*var\(--color-accent\)/.test(r.body)).map(r => r.sels[0]);
  check('words on a red fill sit on the darker red (--km-fill), not the accent', onBright.length === 0, onBright.slice(0, 4).join(' | '));

  /* Where it is linked, and the version in the link. */
  const link = pageSrc.match(/<link rel="stylesheet" href="styles\/modernist\.css\?v=([^"]*)">/);
  const classicEnd = pageSrc.indexOf('</style>');
  check('the page links styles/modernist.css after Classic\'s <style>, and ?v= is the app version',
        !!link && link.index > classicEnd && link[1] === appVersion, link ? `?v=${link[1]}, APP_VERSION ${appVersion}, linked ${link.index > classicEnd ? 'after' : 'BEFORE'} the <style>` : 'no link');

  check('Classic\'s own <style> knows nothing of the second style',
        !/data-style|modernist/i.test(classic) && /\.mod-only\{\s*display:none;\s*\}/.test((pageSrc.match(/<style id="style-base">([\s\S]*?)<\/style>/) || [])[1] || ''),
        /data-style|modernist/i.test(classic) ? 'Classic\'s <style> mentions it' : 'no .mod-only base rule in <style id="style-base">');

  /* The attribute is set by a script in <head> before any stylesheet; Archivo's address appears once, inside the function
     that only Modernist reaches, and nowhere as a <link> a Classic device would load. */
  const head = pageSrc.slice(0, pageSrc.indexOf('</head>'));
  const bootAt = head.indexOf("setAttribute('data-style', style)");
  const firstStyle = head.indexOf('<style>');
  const archivoUses = (pageSrc.match(/family=Archivo/g) || []).length;
  check('the style is set in <head> before any stylesheet, and Archivo is loaded only by loadArchivoFont, only for Modernist',
        bootAt > 0 && bootAt < firstStyle && /localStorage\.getItem\('kitchen\.style'\)/.test(head) &&
        archivoUses === 1 && /function loadArchivoFont\(\)\{[\s\S]*?family=Archivo[\s\S]*?\n\}/.test(head) &&
        /if\(style === 'modernist'\) loadArchivoFont\(\);/.test(head) && !/<link[^>]*Archivo/.test(pageSrc),
        `boot at ${bootAt}, first <style> at ${firstStyle}, Archivo mentioned ${archivoUses}×`);
}

/* ---- The converter's instructions (issue #127, 12 Oct 2026) ----
   Each household loads converter/conversion-instructions.md into its own conversion project, and the app asks each
   once to reload it when CONVERTER_VERSION moves. So a change to the file must move the version, or nobody is told.
   The file's fingerprint is pinned here against its version: change the file, and this fails until the "Version" line
   in the file and CONVERTER_VERSION in index.html are both moved on, and the new fingerprint (printed below) is put
   here beside the new version. */
const CONVERTER_PINNED = { version: '2026-10-18.1', sha256: 'dce259f9cff4457da9e660d9439fe44e65b0e6cde46d1f2d5c83397bce5276d6' };
{
  const convSrc = fs.readFileSync(path.join(ROOT, 'converter', 'conversion-instructions.md'), 'utf8');
  const convSha = require('crypto').createHash('sha256').update(convSrc).digest('hex');
  const fileVersion = (convSrc.match(/^\*\*Version (\d{4}-\d{2}-\d{2}\.\d+)\.\*\*/m) || [])[1];
  const pageConverter = (pageSrc.match(/const CONVERTER_VERSION = '([^']+)'/) || [])[1];
  check('the converter instructions carry a version, and the app asks about the same one',
        !!fileVersion && fileVersion === pageConverter, `file ${fileVersion}, index.html ${pageConverter}`);
  check('    and the file has not changed since that version was set (change it, and move the version on)',
        convSha === CONVERTER_PINNED.sha256 && fileVersion === CONVERTER_PINNED.version,
        `file is ${convSha} at version ${fileVersion}; pinned ${CONVERTER_PINNED.sha256} at ${CONVERTER_PINNED.version}`);
}

/* ---- The dictionary's master copy ---- */
const { execFileSync } = require('child_process');
let genOk = true, genOut = '';
try { genOut = execFileSync('node', [path.join(ROOT, 'tools', 'generate-ingredient-names.js'), '--check'], { encoding: 'utf8' }); }
catch(e){ genOk = false; genOut = (e.stderr || e.message).trim(); }
check('converter/ingredient-names.md is exactly what core.js generates', genOk, genOut);
const D = core.INGREDIENT_DICTIONARY;
/* 140 since 29 Sep: "ground almonds" (almond flour, almond meal), asked for by the household with 0 of the
   library's almond lines changing key. */
check('the dictionary holds its 140 rows', D.length === 140, D.length);
const names = D.map(r => r.name.toLowerCase());
check('every name in the dictionary is written once', new Set(names).size === names.length,
      names.filter((n, i) => names.indexOf(n) !== i).join(', '));
/* Frozen alone has no rows (issue #90): a line is frozen because it says so, never by a name the dictionary gives it. */
check('every row is in a listed aisle, and every aisle but Frozen has rows',
      D.every(r => core.INGREDIENT_AISLES.includes(r.aisle)) && core.INGREDIENT_AISLES.every(a => a === 'Frozen' || D.some(r => r.aisle === a))
      && !D.some(r => r.aisle === 'Frozen'));
const decided = (n) => D.find(r => r.name === n);
check('the household\'s 23 Sep decisions are in it (D7, D8, D9)',
      /\boil\b/.test(decided('vegetable oil').also) && decided('unsalted butter') && decided('sea salt') && /\bsoy sauce\b/.test(decided('light soy sauce').also));

/* ---- What the dictionary's reader does with the wordings (29 Sep 2026) ----
   Rows are edited by hand and read by one function, so these are properties of
   the whole table, not of the rows somebody remembered. The first bug they hold
   off was real: an apostrophe was on the reader's list of "this is a note", so
   the one plain spelling that had one, confectioners' sugar, was written in the
   file and never indexed. */
const pieces = D.map(r => ({ row: r.name, ...core.dictionaryPhrases(r) }));
const notNotes = pieces.flatMap(p => p.skipped.filter(s => !/[()*"`]/.test(s)).map(s => `${p.row}: ${s}`));
check('every wording the reader skips is a note: it carries a bracket, emphasis, backtick or quote mark', notNotes.length === 0, notNotes.join('; '));
const claimed = new Map();
pieces.forEach(p => p.live.forEach(w => { const k = core.dictionaryKey(w); (claimed.get(k) || claimed.set(k, new Set()).get(k)).add(p.row); }));
const claimedTwice = [...claimed].filter(([, rows]) => rows.size > 1).map(([k, rows]) => `${k}: ${[...rows].join(' / ')}`);
check('no wording belongs to two rows (the index keeps the first without a word)', claimedTwice.length === 0, claimedTwice.join('; '));
const offName = pieces.flatMap(p => p.live.filter(w => core.shoppingKeyForName(w) !== core.shoppingKeyForName(p.row)).map(w => `${p.row}: "${w}" keys as ${core.shoppingKeyForName(w)}`));
check('every wording of a row totals with the row\'s own name, whatever the line pipeline does to it on the way', offName.length === 0, offName.join('; '));
check("an apostrophe is part of a spelling: confectioners' sugar, confectioner's sugar and confectioners sugar are one row, icing sugar",
      ["confectioners' sugar", "confectioner's sugar", 'confectioners sugar'].every(w => core.shoppingKeyForName(w) === 'icing sugar'),
      ["confectioners' sugar", "confectioner's sugar", 'confectioners sugar'].map(w => core.shoppingKeyForName(w)).join(' | '));
/* F19 (October review): a note glued in brackets onto a plain spelling hid the
   spelling, and the reader split notes at their inner commas. */
const f19 = [['long-grain rice', 'long grain rice'], ['sweet paprika', 'paprika'], ['coriander powder', 'ground coriander'], ['free-range eggs', 'eggs']]
  .filter(([w, row]) => core.shoppingKeyForName(w) !== core.shoppingKeyForName(row));
check('a spelling whose note sits in the row\'s `note` is indexed: long-grain rice, sweet paprika, coriander powder, free-range eggs (F19)',
      f19.length === 0, f19.map(([w]) => `${w} keys as ${core.shoppingKeyForName(w)}`).join('; '));
const longWordings = pieces.flatMap(p => p.live.filter(w => w.split(/\s+/).length > 4).map(w => `${p.row}: ${w}`));
check('    and a note is never cut at its own commas into a "spelling" (the bacon note was, until F19)', longWordings.length === 0, longWordings.join('; '));

/* ---- Quantities ---- */
const q = (line) => core.splitQty(line);
check('a mixed number is one quantity', q('1 3/4 tbsp soy sauce').qty === '1 3/4 tbsp', q('1 3/4 tbsp soy sauce').qty);
check('a digit with a vulgar fraction is one quantity', q('1½ tsp ground cumin').qty === '1½ tsp', q('1½ tsp ground cumin').qty);
const range = core.parseIngredientAmount('2-3 tbsp');
check('a range buys its upper figure', range && range.amount === 3 && range.low === 2 && range.high === 3, JSON.stringify(range));
const packs = core.parseIngredientAmount('3 x 400 g');
check('a pack count totals the whole', packs && packs.amount === 1200 && packs.count === 3 && packs.unit === 'g', JSON.stringify(packs));
const upTo = core.parseIngredientAmount('up to 500 ml');
check('"up to" is a quantity', upTo && upTo.amount === 500 && upTo.upTo === true, JSON.stringify(upTo));
check('kilograms total as grams, and show as kilograms past 1000 g',
      core.toBaseUnit(1.2, 'kg').amount === 1200 && core.formatShoppingQty(1500, 'g') === '1 1/2 kg' && core.formatShoppingQty(600, 'g') === '600 g');
check('amounts read back as cooking fractions', core.formatAmount(0.75) === '3/4' && core.formatAmount(1.5) === '1 1/2' && core.formatAmount(2) === '2');

/* ---- Scaling ---- */
const scaled = core.scaleRecipeSyntax('SERVINGS: 2\n\nGROUP a:\n1 1/2 tsp ground cumin\n2-3 tbsp olive oil\n3 x 400 g chopped tomatoes\n\nSTAGE:\nMERGE a -> b: Cook for 10 min [10 min]', 2);
check('scaling doubles a mixed number', /^3 tsp ground cumin$/m.test(scaled), scaled);
/* Olive oil is a liquid, so since 18 Oct its doubled 2-3 tbsp (60-90 ml) reads in ml; until then this read "4-6 tbsp". */
check('scaling doubles both ends of a range', /^60-90 ml olive oil$/m.test(scaled), scaled);
check('scaling doubles the pack count, not the pack size', /^6 x 400 g chopped tomatoes$/m.test(scaled), scaled);
/* F45 (October review): a permanent scale from EDIT rewrites the household's own lines. */
const sc1 = (line, m) => core.scaleRecipeSyntax('GROUP a:\n' + line, m).split('\n')[1];
check('scaling keeps the unit as it was typed, agreeing a spelled-out one with its number (F45)',
      sc1('1 L water', 2) === '2 L water' && sc1('100 grams flour', 2) === '200 grams flour' && sc1('1 litre stock', 2) === '2 litres stock'
      && sc1('2 litres stock', 0.5) === '1 litre stock' && sc1('500g mince', 1.5) === '750g mince' && sc1('3 x 1 litre cartons', 2) === '6 x 1 litre cartons',
      [sc1('1 L water', 2), sc1('100 grams flour', 2), sc1('1 litre stock', 2), sc1('2 litres stock', 0.5), sc1('500g mince', 1.5), sc1('3 x 1 litre cartons', 2)].join(' | '));
check('    and scales a pinch, dash or handful only to a whole number, its word agreeing (F45)',
      sc1('1 pinch nutmeg', 2) === '2 pinches nutmeg' && sc1('1 pinch nutmeg', 1.5) === '1 pinch nutmeg' && sc1('2 handfuls basil', 0.5) === '1 handful basil'
      && sc1('1-2 dashes hot sauce', 2) === '2-4 dashes hot sauce' && sc1('2 onions', 1.5) === '3 onions',
      [sc1('1 pinch nutmeg', 2), sc1('1 pinch nutmeg', 1.5), sc1('2 handfuls basil', 0.5), sc1('1-2 dashes hot sauce', 2), sc1('2 onions', 1.5)].join(' | '));
/* Liquids (18 Oct 2026, docs/PLAN-LIQUID-MEASURES.md): tsp under 15 ml, tbsp under 50 ml, ml from 50 ml, decided after
   rounding; only for a line in ml or litres, or in spoons with a liquid's name; never at ×1, never a weight. */
{
  const edges = [['1 tsp vanilla extract', 2, '2 tsp vanilla extract'], ['1 tsp vanilla extract', 2.8, '1 tbsp vanilla extract'],
    ['3 tbsp olive oil', 0.5, '1 1/2 tbsp olive oil'], ['1 tbsp olive oil', 3.2, '3 tbsp olive oil'], ['1 tbsp olive oil', 3.27, '50 ml olive oil'],
    ['3 tbsp olive oil', 4 / 3, '60 ml olive oil'], ['3 tbsp olive oil', 2, '90 ml olive oil'], ['100 ml chicken stock', 0.25, '1 1/2 tbsp chicken stock'],
    ['100 ml chicken stock', 0.1, '2 tsp chicken stock'], ['500 ml chicken stock', 1.99, '995 ml chicken stock'], ['500 ml chicken stock', 2.64, '1.3 L chicken stock']];
  const wrong = edges.filter(([l, m, want]) => sc1(l, m) !== want).map(([l, m, want]) => `${l} ×${m}: ${sc1(l, m)}, not ${want}`);
  check('a scaled liquid reads in tsp under 15 ml, tbsp under 50 ml, ml from 50 ml and L from a litre, decided after rounding',
        wrong.length === 0, wrong.join('; '));
  check('    a range takes its unit from its upper end, and "up to" and a spelled-out unit keep their words',
        sc1('2-3 tbsp rice vinegar', 2) === '60-90 ml rice vinegar' && sc1('1-2 tbsp soy sauce', 1.5) === '1 1/2-3 tbsp soy sauce'
        && sc1('2 tablespoons soy sauce', 3) === '90 ml soy sauce' && sc1('1 tablespoon soy sauce', 1.5) === '1 1/2 tablespoons soy sauce',
        [sc1('2-3 tbsp rice vinegar', 2), sc1('1-2 tbsp soy sauce', 1.5), sc1('2 tablespoons soy sauce', 3), sc1('1 tablespoon soy sauce', 1.5)].join(' | '));
  check('    a weighed liquid, a spice or paste in spoons, coconut oil, condensed milk and a pack count keep their units',
        sc1('30 g honey', 2) === '60 g honey' && sc1('3 tbsp ground cumin', 2) === '6 tbsp ground cumin' && sc1('2 tbsp tomato purée', 2) === '4 tbsp tomato purée'
        && sc1('3 tbsp coconut oil', 2) === '6 tbsp coconut oil' && sc1('3 tbsp condensed milk', 2) === '6 tbsp condensed milk' && sc1('3 x 1 litre cartons', 2) === '6 x 1 litre cartons',
        [sc1('30 g honey', 2), sc1('3 tbsp ground cumin', 2), sc1('2 tbsp tomato purée', 2), sc1('3 tbsp coconut oil', 2)].join(' | '));
  const viaMatch = core.scaleRecipeSyntax('GROUP a:\n3 tbsp house dressing', 2, k => k === 'house dressing' ? 'olive oil' : k).split('\n')[1];
  check('    a name the household matched to a liquid is a liquid, and at ×1 nothing is rewritten',
        viaMatch === '90 ml house dressing' && sc1('3 tbsp house dressing', 2) === '6 tbsp house dressing'
        && core.scaleRecipeSyntax('GROUP a:\n4 tbsp olive oil\n14 ml lime juice', 1) === 'GROUP a:\n4 tbsp olive oil\n14 ml lime juice',
        [viaMatch, sc1('3 tbsp house dressing', 2)].join(' | '));
}
check('scaling updates SERVINGS and leaves the step text alone', /^SERVINGS: 4$/m.test(scaled) && /Cook for 10 min \[10 min\]/.test(scaled), scaled);

/* ---- Parsing and layout ---- */
const parsed = core.parseRecipe('TITLE: T\nSOURCE: S\nTAGS: course=Main, Veg\n\nGROUP a:\n1 onion\n\nGROUP b:\n1 carrot\n\nSTAGE:\nMERGE a, b -> ab: Fry [5-6 min]');
check('parseRecipe reads the header, groups, stages and a timing',
      parsed.title === 'T' && parsed.tags.course === 'Main' && parsed.tags.keywords[0] === 'Veg' &&
      parsed.groups.length === 2 && parsed.stages[0][0].duration.min === 5 && parsed.stages[0][0].duration.max === 6,
      JSON.stringify({ title: parsed.title, tags: parsed.tags, groups: parsed.groups.length }));
const gap = core.parseRecipe('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nGROUP c:\n1 z\n\nSTAGE:\nMERGE a, c -> ac: Join [instant]');
const gapErrors = core.computeColumns(gap.groups, gap.stages).errors;
check('a merge across a gap is an error that names the stage', gapErrors.length === 1 && /Stage 1/.test(gapErrors[0]) && /adjacent/.test(gapErrors[0]), gapErrors.join(' | '));
check('adjacent rows merge without an error', core.computeColumns(parsed.groups, parsed.stages).errors.length === 0);
/* The `merge` mark (docs/PLAN-MODERNIST.md, 15 Oct 2026): a box that brings together two or more step outputs, which the
   Modernist style fills in ink. Adding raw ingredients to one cooked thing is still a step, as in the design's own example
   (a sauce step that adds passata to the softened onions is a step; the box that combines the chicken and the sauce is the merge). */
{
  const m = core.parseRecipe('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nGROUP c:\n1 z\n\nGROUP d:\n1 w\n\n' +
    'STAGE:\nMERGE a -> A: Fry [5 min]\nMERGE b, c -> B: Stir [5 min]\n\n' +
    'STAGE:\nMERGE A -> C: Grill [5 min]\nMERGE B, d -> D: Simmer [5 min]\n\n' +
    'STAGE:\nMERGE C, D -> E: Blend [5 min]');
  const cols = core.computeColumns(m.groups, m.stages);
  const marked = cols.columns.flat().filter(b => b.merge).map(b => b.outputHandle);
  check('a box is marked merge only when two or more of its inputs are steps, not raw groups (B and D add raw ingredients; E joins two steps)',
        cols.errors.length === 0 && JSON.stringify(marked) === '["E"]', JSON.stringify({ marked, errors: cols.errors }));
  /* A step may take the name of a group already used up; from then on that name is a step's output, not raw ingredients. */
  const r = core.parseRecipe('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nSTAGE:\nMERGE a -> x: Fry [5 min]\n\nSTAGE:\nMERGE b -> a: Stir [5 min]\n\nSTAGE:\nMERGE x, a -> y: Join [5 min]');
  const rc = core.computeColumns(r.groups, r.stages), rm = rc.columns.flat().filter(b => b.merge).map(b => b.outputHandle);
  check('    a step output that reuses a used-up group\'s name counts as a step', rc.errors.length === 0 && JSON.stringify(rm) === '["y"]', JSON.stringify({ rm, errors: rc.errors }));
  /* PREPARATION as steps (18 Oct 2026): "Fry the veg" takes two prepared halves of one group, which are raw ingredients cut,
     not steps; as written it is no merge, and drawing the preparation must not make it one. */
  const pv = core.parseRecipe('TITLE: P\nSERVINGS: 2\n\nGROUP veg:\n2 leeks, thinly sliced\n1 onion, diced\n\nGROUP s:\n1 x\n\n' +
    'STAGE:\nMERGE s -> S: Simmer [10 min]\n\nSTAGE:\nMERGE veg -> V: Fry the veg [8 min]\n\nSTAGE:\nMERGE V, S -> W: Combine [5 min]');
  const pd = core.withPrepSteps(pv), pc = core.computeColumns(pd.groups, pd.stages);
  const pm = pc.columns.flat().filter(b => b.merge).map(b => b.outputHandle);
  const pAsWritten = core.computeColumns(pv.groups, pv.stages).columns.flat().filter(b => b.merge).map(b => b.outputHandle);
  check('    with PREPARATION drawn as steps, a step fed only by prepared ingredients is not a merge; joining two steps still is',
        pd !== pv && pc.errors.length === 0 && pd.stages.some(st => st.some(op => op.prep)) && JSON.stringify(pm) === '["W"]' && JSON.stringify(pAsWritten) === '["W"]',
        JSON.stringify({ pm, pAsWritten, errors: pc.errors }));
  /* The mark cannot depend on the order of lines within a stage: a stage's outputs only become steps after the stage. */
  const ord = (first, second) => { const q = core.parseRecipe('GROUP b:\n1 y\n\nGROUP a:\n1 x\n\nGROUP c:\n1 z\n\nSTAGE:\nMERGE c -> C: Fry [5 min]\n\n' +
    `STAGE:\n${first}\n${second}`); const qc = core.computeColumns(q.groups, q.stages); return qc.errors.length + ':' + JSON.stringify(qc.columns.flat().filter(b => b.merge).map(b => b.outputHandle)); };
  const o1 = ord('MERGE b -> a: Stir [5 min]', 'MERGE a, C -> D: Join [5 min]'), o2 = ord('MERGE a, C -> D: Join [5 min]', 'MERGE b -> a: Stir [5 min]');
  check('    the order of two lines within one stage does not change which boxes are merges', o1 === o2 && o1 === '0:[]', JSON.stringify({ o1, o2 }));
}
/* F41 (October review): each used to be laid out silently. */
const colErrs = t => { const p = core.parseRecipe(t); return core.computeColumns(p.groups, p.stages).errors; };
const twiceGroup = colErrs('GROUP a:\n1 x\n\nGROUP a:\n1 y\n\nSTAGE:\nMERGE a -> b: Join [instant]');
check('a GROUP handle written twice is an error that names it (F41)', twiceGroup.length === 1 && /GROUP "a"/.test(twiceGroup[0]), twiceGroup.join(' | '));
const liveOut = colErrs('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nSTAGE:\nMERGE a -> b: Fry [5 min]\nSTAGE:\nMERGE b -> c: Stir [instant]');
const twoOut = colErrs('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nSTAGE:\nMERGE a -> x: Fry [5 min]\nMERGE b -> x: Wash [instant]');
const reused = colErrs('GROUP a:\n1 x\n\nGROUP b:\n1 y\n\nSTAGE:\nMERGE a -> a: Fry [5 min]\nMERGE b -> x: Wash [instant]\nSTAGE:\nMERGE a, x -> c: Stir [instant]');
check('    and so is a MERGE output named like a handle still in play, but not one reusing its own input',
      liveOut.length === 1 && /Stage 1: "b"/.test(liveOut[0]) && twoOut.length === 1 && /"x"/.test(twoOut[0]) && reused.length === 0,
      [liveOut, twoOut, reused].map(e => e.join(' / ')).join(' | '));

/* ---- Header lines ---- */
const rewritten = core.withUpdatedHeaderLines('TITLE: A\nSOURCE: S\n\nGROUP a:\n1 onion', {
  title: 'B', source: 'S2', sourceUrl: '', imageUrl: '', time: '20 min', servings: 4, equipment: '',
  tags: { course: 'Side', keywords: ['Veg'] } });
const back = core.parseRecipe(rewritten);
check('header lines are written from the form and parse back to it',
      back.title === 'B' && back.source === 'S2' && back.time === '20 min' && back.servings === '4' && back.tags.course === 'Side' && !/^SOURCE_URL:/m.test(rewritten),
      rewritten.split('\n').slice(0, 5).join(' | '));
check('a title with $& in it is written literally', /^TITLE: Fish & chips \$&$/m.test(core.withUpdatedHeaderLine('TITLE: x', 'TITLE', 'Fish & chips $&')));

/* ---- The shopping list (PR 6b) ----
   The review's test plan, docs/REVIEW-INGREDIENT-MATCHING-FINDINGS.md §6,
   numbered as it is there. Made-up lines only. Each was run once against
   the mutation the review names for it and seen to fail. */
const list = (...raws) => core.aggregateShoppingLines(raws.map(raw => ({ recipeTitle: 'R', raw })), null);
const keysOf = (...raws) => list(...raws).map(i => i.key);
const only = (...raws) => { const l = list(...raws); return l.length === 1 ? l[0] : { qtyText: l.length + ' rows: ' + l.map(i => i.key).join(', ') }; };

check('7: "4 cloves" (the spice) and garlic cloves never share a row',
      keysOf('4 cloves', '3 garlic cloves', '2 cloves garlic').length === 2 && only('3 garlic cloves', '2 cloves garlic').qtyText === '5 cloves',
      JSON.stringify(list('4 cloves', '3 garlic cloves', '2 cloves garlic').map(i => [i.key, i.qtyText])));
check('8: cinnamon sticks never join ground cinnamon, or cinnamon', keysOf('2 cinnamon sticks', '2 tsp ground cinnamon', '1 tsp cinnamon').length === 3,
      JSON.stringify(keysOf('2 cinnamon sticks', '2 tsp ground cinnamon', '1 tsp cinnamon')));
const neverMerge = [['1 tsp ground coriander', '1 bunch coriander'], ['2 spring onions', '1 onion'], ['1 red onion', '1 onion'],
  ['1 tsp garlic salt', '1 tsp salt'], ['1 tsp celery salt', '1 tsp salt'], ['100 ml double cream', '100 ml single cream'],
  ['100 g plain flour', '100 g self-raising flour'], ['1 tbsp olive oil', '1 tbsp vegetable oil'], ['1 tbsp light soy sauce', '1 tbsp dark soy sauce'],
  ['1 lemon', '2 tbsp lemon juice'], ['100 g milk chocolate', '100 ml milk'], ['1 tbsp peanut butter', '10 g butter'],
  ['200 g cherry tomatoes', '400 g chopped tomatoes']];
const merged9 = neverMerge.filter(p => keysOf(...p).length !== 2);
check('9: the never-merge pairs stay apart', merged9.length === 0, merged9.map(p => p.join(' + ')).join('; '));
/* The words that change what you buy are never dropped from a name, and
   never the one word a suggested pair differs by. Pinned here rather than
   read from core.NEVER_IGNORE, so a word removed there fails here: looping
   over the live set, the check lost its word along with the rule. */
const NEVER_IGNORE_PINNED = ['ground', 'red', 'green', 'yellow', 'dried', 'dark', 'light', 'unsalted',
  'double', 'single', 'baby', 'plain', 'self-raising', 'spring', 'sea', 'whole', 'frozen', 'cooked',
  'raw', 'full-fat', 'bone-in', 'smoked', 'white', 'black', 'brown', 'sweet', 'hot', 'mild'];
const droppedWords = NEVER_IGNORE_PINNED.filter(w => !core.shoppingKeyForName(w + ' zorbleberry').split(' ').includes(w));
check('    and no word on the never-ignore list is ever dropped from a name', droppedWords.length === 0, droppedWords.join(', '));
const offeredWords = NEVER_IGNORE_PINNED.filter(w => core.strictMatchSuggestions([{ key: w + ' zorbleberry', count: 1 }, { key: 'zorbleberry', count: 1 }], null).length);
check('    or offered as the only difference between two names', offeredWords.length === 0, offeredWords.join(', '));
check('10: a dangling "and" is not part of the name', only('1 carrot, peeled and diced', '1 carrot peeled and diced', '2 carrots').qtyText === '4',
      only('1 carrot, peeled and diced', '1 carrot peeled and diced', '2 carrots').qtyText);
check('    and the row takes the plural spelling on a tie', only('1 carrot', '2 carrots').name === 'Carrots', only('1 carrot', '2 carrots').name);
check('11: a size word is not part of the name', only('2 large eggs', '1 egg').qtyText === '3' && only('2 large courgettes', '1 courgette').qtyText === '3',
      only('2 large eggs', '1 egg').qtyText + ', ' + only('2 large courgettes', '1 courgette').qtyText);
check('12: "pinch of" is a pinch', only('pinch of nutmeg').qtyText === '1 pinch' && only('pinch of nutmeg').key === 'nutmeg', JSON.stringify(only('pinch of nutmeg')));
/* Two naming fixes, 29 Sep 2026 (PR 1 of docs/PLAN-NEW-RECIPE-FLOW.md, the household's
   decisions 2 and 3). Made-up lines, none of whose names is in the library.
   Size words between the article and the unit: until then only a unit straight after
   the article was read, so "a big handful of X" left the article in the name, "a handful
   of x", with no amount and no dictionary row. A word the dictionary knows (arugula)
   and one it does not (chervil) go the same way. */
const bigHandful = only('a big handful of chervil'), bigHandfulKnown = only('a big handful of arugula');
check('a big handful of X reads as 1 handful of X, whether or not the dictionary knows X',
      bigHandful.key === 'chervil' && bigHandful.qtyText === '1 handful' && bigHandfulKnown.key === 'rocket' && bigHandfulKnown.qtyText === '1 handful',
      JSON.stringify([bigHandful.key, bigHandful.qtyText, bigHandfulKnown.key, bigHandfulKnown.qtyText]));
const smallBunch = only('a small bunch of sorrel');
check('a small bunch of X reads as 1 bunch of X', smallBunch.key === 'sorrel' && smallBunch.qtyText === '1 bunch', JSON.stringify([smallBunch.key, smallBunch.qtyText]));
const largePinch = only('a large pinch of sumac');
check('a large pinch of X reads as 1 pinch of X', largePinch.key === 'sumac' && largePinch.qtyText === '1 pinch', JSON.stringify([largePinch.key, largePinch.qtyText]));
/* A tin in the UK, a can in the US: "tinned" folds into "canned", so a line already
   written canned keeps the key it had. */
const tinCan = list('400 g tinned peach slices', '400 g canned peach slices');
check('tinned X and canned X total as one row', tinCan.length === 1 && tinCan[0].qtyText === '800 g', JSON.stringify(tinCan.map(i => [i.key, i.qtyText])));
check('tinned X in a line meets a dictionary row written canned X, and a wording written either way meets the other',
      core.shoppingKeyForName('tinned chopped tomatoes') === core.shoppingKeyForName('chopped tomatoes') && core.dictionaryKey('tinned chickpeas') === core.dictionaryKey('canned chickpeas'),
      JSON.stringify([core.shoppingKeyForName('tinned chopped tomatoes'), core.shoppingKeyForName('chopped tomatoes'), core.dictionaryKey('tinned chickpeas'), core.dictionaryKey('canned chickpeas')]));
check('tinned against canned in the shopping key: one key, and a line already written canned keeps the key it had',
      core.shoppingKeyForName('tinned peach slices') === core.shoppingKeyForName('canned peach slices') && core.shoppingKeyForName('canned peach slices') === 'canned peach slice',
      JSON.stringify([core.shoppingKeyForName('tinned peach slices'), core.shoppingKeyForName('canned peach slices')]));
const peppers = list('1/4 tsp pepper', 'pinch of pepper', 'pepper, to taste', '1 red pepper', '2 peppers', '1 yellow pepper');
const pepperRow = k => peppers.find(i => i.key === k) || {};
check('13: pepper by the spoon, the pinch or to taste is black pepper; counted, a vegetable',
      pepperRow('black pepper').count === 3 && pepperRow('black pepper').category === 'Spices & Seasoning' &&
      pepperRow('red pepper').category === 'Produce' && pepperRow('pepper').qtyText === '2' && pepperRow('pepper').category === 'Produce' &&
      pepperRow('yellow pepper').category === 'Produce',
      JSON.stringify(peppers.map(i => [i.key, i.category, i.qtyText])));
/* The review wrote this one as "4 tsp". The total is the check; since 25 Sep
   a mix of the two spoons is shown as both, "1 tbsp + 1 tsp" (see below). */
check('14: 1 tsp + 1 tbsp of one thing totals 20 ml, shown as 1 tbsp + 1 tsp', only('1 tsp cumin', '1 tbsp cumin').qtyText === '1 tbsp + 1 tsp', only('1 tsp cumin', '1 tbsp cumin').qtyText);
check('    and with 10 ml as well, 30 ml', only('1 tsp cumin', '1 tbsp cumin', '10 ml cumin').qtyText === '30 ml', only('1 tsp cumin', '1 tbsp cumin', '10 ml cumin').qtyText);
check('15: a count and a weight are one row, "2 + 400 g"', only('2 chicken breasts', '400 g chicken breast').qtyText === '2 + 400 g', only('2 chicken breasts', '400 g chicken breast').qtyText);
/* 16: a tick is stored under the key, so a key that ignores the unit keeps
   the tick when a recipe changes tbsp -> g. (The page half is in smoke.js.) */
check('16: a line keeps its key when the recipe changes tbsp -> g', only('1 tbsp butter').key === only('15 g butter').key && only('1 tbsp butter', '15 g butter').key === 'butter');
/* 17 and 18 are the page's: smoke.js. */
const suggest = pairs => core.strictMatchSuggestions(pairs.map(k => ({ key: k, count: 1 })), null);
check('19: the strict rule offers curly parsley ~ parsley', JSON.stringify(suggest(['curly parsley', 'parsley'])) === '[{"from":"curly parsley","to":"parsley"}]', JSON.stringify(suggest(['curly parsley', 'parsley'])));
const falsePairs = [['unsalted butter', 'salt'], ['milk chocolate', 'milk'], ['peanut butter', 'butter'], ['celery salt', 'salt'],
  ['spring onion', 'onion'], ['coriander', 'ground coriander'], ['cinnamon', 'cinnamon stick'], ['oil', 'anchovies in olive oil'],
  /* and three made up in the shape of the live library's before the
     dictionary rule (25 Sep): a listed product against a bare word */
  ['raspberry jam', 'jam'], ['chicken stock', 'stock'], ['panko breadcrumb', 'breadcrumb']];
const offered19 = falsePairs.filter(p => suggest(p).length);
check('    and none of the review\'s false pairs', offered19.length === 0, offered19.map(p => p.join(' ~ ')).join('; '));
check('    and a pair already answered is not offered again', core.strictMatchSuggestions([{ key: 'curly kale', count: 1 }, { key: 'kale', count: 1 }], () => true).length === 0);
check('    and on a tie the plainer name is kept', JSON.stringify(suggest(['kale', 'curly kale'])) === '[{"from":"curly kale","to":"kale"}]', JSON.stringify(suggest(['kale', 'curly kale'])));
/* Until 29 Sep 2026 "chili flakes" was not a dictionary spelling, so this was the
   keyword rule's alone (the lists are written in plurals, the folded key is not).
   It is a spelling of chilli flakes now, so this reads the row; the keyword rule is
   held by the second check, on a name the dictionary deliberately does not know
   ("chili powder" is a blend in the US, not ground chillies). */
check('20: chili flakes are a spice after the key folds the plural', only('1 tsp chili flakes').category === 'Spices & Seasoning', only('1 tsp chili flakes').category);
check('    and so is chili powder, which no dictionary row claims', core.dictionaryRow(core.shoppingKeyForName('chili powder')) === null && only('1 tsp chili powder').category === 'Spices & Seasoning', only('1 tsp chili powder').category);
check('    and bay leaves are one because it does', only('2 bay leaves').category === 'Spices & Seasoning', only('2 bay leaves').category);
check('21: the aisle comes from the dictionary', only('1 red pepper').category === 'Produce' && only('1 tbsp chinese rice wine').category === 'Pantry',
      only('1 red pepper').category + ', ' + only('1 tbsp chinese rice wine').category);
/* 22 is the generator check above. */
check('23: a word match stored in the old words still applies', core.shoppingKeyForName('carrot and') === 'carrot' && core.shoppingKeyForName('Courgettes, sliced') === 'courgette',
      core.shoppingKeyForName('carrot and') + ', ' + core.shoppingKeyForName('Courgettes, sliced'));
const unstable = core.INGREDIENT_DICTIONARY.map(r => core.shoppingKeyForName(r.name)).filter(k => core.shoppingKeyForName(k) !== k);
check('    and re-normalising a key gives the key back', unstable.length === 0, unstable.join(', '));
const { checkLine } = require(path.join(__dirname, 'ingredient-lines.js'));
const shape = line => { const { qty, rest } = core.splitQty(line); return checkLine({ line, qty, rest }, { synonyms: new Map(), names: new Set(), listedAs: new Map() }).why.join('; '); };
check('24: validate-recipes warns on a two-ingredient line and on "3 x"',
      /two ingredients/.test(shape('1 onion and 1 carrot')) && /multiplier/.test(shape('3 x 400 g tins chopped tomatoes')),
      shape('1 onion and 1 carrot') + ' | ' + shape('3 x 400 g tins chopped tomatoes'));
check('eighths read, total and print', only('⅛ tsp salt', '1/8 tsp salt').qtyText === '1/4 tsp' && core.formatAmount(0.125) === '1/8',
      only('⅛ tsp salt', '1/8 tsp salt').qtyText + ', ' + core.formatAmount(0.125));
/* ---- The follow-up to 6b, 25 Sep: what the first live list showed ---- */
const aisleOf = raw => only(raw).category;
const aisleCases = [['400 g cooked egg noodles', 'Pantry'], ['3 tbsp hot pepper sauce', 'Pantry'], ['200 ml full-fat coconut milk', 'Pantry'],
  ['300 g dried linguine', 'Pantry'], ['400 ml passata', 'Pantry'], ['500 g gnocchi', 'Pantry'], ['4 cloves', 'Spices & Seasoning'],
  ['1 tbsp curry powder', 'Spices & Seasoning'], ['1 1/2 tbsp harissa paste', 'Spices & Seasoning'], ['1 tbsp crème fraîche', 'Dairy & Eggs'],
  ['1 jalapeño', 'Produce'], ['1 red or green chilli', 'Produce'],
  /* and the ones those words must not pull away */
  ['2 eggs', 'Dairy & Eggs'], ['1/2 tsp black pepper', 'Spices & Seasoning'], ['200 ml milk', 'Dairy & Eggs'], ['1 tsp chilli flakes', 'Spices & Seasoning'],
  ['3 garlic cloves', 'Produce'], ['1 tsp chilli powder', 'Spices & Seasoning']];
const misfiled = aisleCases.filter(([raw, aisle]) => aisleOf(raw) !== aisle);
check('the aisles the first live list had wrong are right, and nothing they touch moved', misfiled.length === 0,
      misfiled.map(([raw, aisle]) => `${raw}: ${aisleOf(raw)}, not ${aisle}`).join('; '));
/* A spice since 18 Oct: vegetable oil is a liquid, and its 55 ml now reads "55 ml (3 tbsp + 2 tsp)" (below). */
check('a mix of spoons reads as both, largest first', only('3 tbsp ground cumin', '2 tsp ground cumin').qtyText === '3 tbsp + 2 tsp',
      only('3 tbsp ground cumin', '2 tsp ground cumin').qtyText);
check('    but teaspoons alone stay teaspoons, and a mix under a tablespoon too',
      only('4 tsp cumin', '2 tsp cumin').qtyText === '6 tsp' && only('1/2 tbsp cumin', '1 tsp cumin').qtyText === '2 1/2 tsp',
      only('4 tsp cumin', '2 tsp cumin').qtyText + ', ' + only('1/2 tbsp cumin', '1 tsp cumin').qtyText);
/* Liquids on the list (18 Oct 2026): spoons under 50 ml, ml from 50 ml with the lines in brackets when any is in spoons. */
check('a liquid of 50 ml or more reads in ml, with its lines largest first when any is in spoons',
      only('3 tbsp olive oil', '100 ml olive oil').qtyText === '145 ml (100 ml + 3 tbsp)' && only('4 tbsp sesame oil', '6 tbsp sesame oil').qtyText === '150 ml (6 tbsp + 4 tbsp)'
      && only('4 tbsp olive oil').qtyText === '60 ml (4 tbsp)' && only('300 ml milk', '200 ml milk').qtyText === '500 ml',
      [only('3 tbsp olive oil', '100 ml olive oil').qtyText, only('4 tbsp sesame oil', '6 tbsp sesame oil').qtyText, only('4 tbsp olive oil').qtyText, only('300 ml milk', '200 ml milk').qtyText].join(' | '));
check('    under 50 ml a liquid reads in spoons (a name the list does not know is a liquid when written in ml), and a paste or spice in spoons, or a weight, as before',
      only('30 ml lime juice').qtyText === '2 tbsp' && only('30 ml ponzu').qtyText === '2 tbsp' && only('2 tbsp olive oil', '1 tsp olive oil').qtyText === '2 tbsp + 1 tsp' && only('10 ml lime juice').qtyText === '2 tsp'
      && only('3 tbsp curry paste', '3 tbsp curry paste', '3 tbsp curry paste').qtyText === '9 tbsp' && only('30 g golden syrup', '2 tbsp golden syrup').qtyText === '30 g + 2 tbsp',
      [only('30 ml lime juice').qtyText, only('2 tbsp olive oil', '1 tsp olive oil').qtyText, only('10 ml lime juice').qtyText, only('3 tbsp curry paste', '3 tbsp curry paste', '3 tbsp curry paste').qtyText].join(' | '));
check('    and the dictionary marks its liquids: every row with `liquid` names something poured, and coconut oil is not one',
      core.INGREDIENT_DICTIONARY.filter(r => r.liquid).length === 21 && !core.dictionaryRow('coconut oil').liquid && core.dictionaryRow('olive oil').liquid === true,
      core.INGREDIENT_DICTIONARY.filter(r => r.liquid).map(r => r.name).join(', '));
const grouped = (...ls) => core.aggregateShoppingLines(ls.map(([recipeTitle, group, raw]) => ({ recipeTitle, group, raw })), null);
const parm = grouped(['A', 'cheese', '75 g grated parmesan'], ['A', 'garnish', 'grated parmesan'], ['B', 'sauce', '50 g grated parmesan'], ['C', 'garnish', 'grated parmesan']);
check('lines with no amount in a garnish group read "extra to serve", counting recipes', parm.length === 1 && parm[0].qtyText === '125 g + extra to serve (2 recipes)',
      parm.map(i => i.qtyText).join(' // '));
const one = grouped(['A', 'garnish', 'grated parmesan'], ['A', 'cheese', '75 g grated parmesan']);
check('    with no count for one recipe', one[0].qtyText === '75 g + extra to serve', one[0].qtyText);
const said = grouped(['A', 'base', 'salt, to taste'], ['B', 'base', 'salt, to taste'], ['B', 'base', '1 tsp salt'], ['C', 'base', '2 eggs'], ['C', 'top', 'beaten egg, to glaze'],
  ['D', 'base', '100 ml maple syrup'], ['D', 'brushing', 'maple syrup, extra for brushing'], ['E', 'garnish', 'parsley, chopped']);
const qtyOf = key => (said.find(i => i.key === key) || {}).qtyText;
check('    and a line\'s own note wins: to taste, to glaze, or plain extra; alone, no "extra"',
      qtyOf('salt') === '1 tsp + to taste (2 recipes)' && qtyOf('egg') === '2 + extra to glaze' && qtyOf('maple syrup') === '100 ml + extra' && qtyOf('parsley') === 'to serve',
      ['salt', 'egg', 'maple syrup', 'parsley'].map(k => k + ': ' + qtyOf(k)).join('; '));
check('    and never "N more", which read as N more of the same amount', !/\bmore\b/.test(said.concat(parm).map(i => i.qtyText).join(' ')));

/* ---- 6c-1, 28 Sep: checks where recipes come in ---- */
const faultCodes = line => core.ingredientLineFaults(line).map(f => f.code + (f.affectsList ? '!' : '')).join(',');
const shapeCases = [
  ['3 tbsp honey or golden syrup', 'alternative!'], ['salt and pepper, to taste', 'two!'], ['1 cup rice', 'metric!'],
  ['400 ml tin plum tomatoes', 'container,tinMl!'], ['zest of 1/2 lemon', 'prep,amountInName!,noqty'],
  ['1 large onion, chopped', 'size'], ['75 g grated parmesan', 'prep'], ['grated parmesan', 'prep,noqty'],
  ['400 g plum tomatoes (1 tin)', ''], ['3 tbsp golden syrup (or honey)', ''], ['1 onion', ''],
  /* F18: the units QTY_UNIT does not admit, each its own case so each is seen to fail. */
  ['1 pint milk', 'metric!'], ['1 1/2 pints stock', 'metric!'], ['1 quart water', 'metric!'], ['8 ounces cheese', 'metric!'],
  ['1 pound beef mince', 'metric!'], ['4 fl oz double cream', 'metric!'], ['2 sticks of butter', 'metric!'], ['1 stick butter', 'metric!'],
  ['500 g pound cake', ''], ['1 stick celery', ''], ['2 cinnamon sticks', '']];
const shapeWrong = shapeCases.filter(([l, want]) => faultCodes(l) !== want);
check('each line fault is found, and marked ! only where the shopping list cannot cope', shapeWrong.length === 0,
      shapeWrong.map(([l, w]) => `${l}: ${faultCodes(l)} (want ${w})`).join('; '));
const sug = l => core.suggestIngredientLine(l);
check('a rewrite is offered where there is one right answer',
      sug('400 ml tin plum tomatoes') === '400 g plum tomatoes (1 tin)' && sug('zest of 1/2 lemon') === '1/2 lemon, zested'
      && sug('juice of 1 lemon') === '1 lemon, juiced', [sug('400 ml tin plum tomatoes'), sug('zest of 1/2 lemon'), sug('juice of 1 lemon')].join(' | '));
check('    and none where the choice is the household\'s', sug('3 tbsp honey or golden syrup') === null && sug('salt and pepper, to taste') === null
      && core.LINE_HINTS.alternative && core.LINE_HINTS.two);
check('    and every suggestion passes its own check',
      ['400 ml tin plum tomatoes', 'zest of 1/2 lemon', 'juice of 1 lemon'].every(l => !core.ingredientLineFaults(sug(l)).some(f => f.affectsList)));
const unreadOf = t => core.parseRecipe(t).unread.map(u => u.line).join('|');
/* The onion is lost with its misspelt GROUP: no group was open to take it. */
check('the parser reports the lines it reads past, and nothing it reads',
      unreadOf('Ingredients\nTITLE: X\nGROUP a-b:\n1 onion\nGROUP ok:\n1 leek\nSTAGE:\nMERGE ok -> done: Cook [5 min]\nStir\nMERGE ok → x: y') === 'Ingredients|GROUP a-b:|1 onion|Stir|MERGE ok → x: y'
      && unreadOf('TITLE: X\nGROUP a:\n1 onion\nSTAGE:\nMERGE a -> done: Cook [5 min]\nNOTES:\nKeeps a week') === '',
      unreadOf('Ingredients\nTITLE: X\nGROUP a-b:\n1 onion\nGROUP ok:\n1 leek\nSTAGE:\nMERGE ok -> done: Cook [5 min]\nStir\nMERGE ok → x: y'));
check('    including a misspelt GROUP inside a group, the commonest case, which fell in as an ingredient',
      unreadOf('TITLE: X\nGROUP a:\n1 onion\nGROUP b-c:\n1 leek\nSTAGE:\nMERGE a -> done: Cook [5 min]') === 'GROUP b-c:',
      unreadOf('TITLE: X\nGROUP a:\n1 onion\nGROUP b-c:\n1 leek\nSTAGE:\nMERGE a -> done: Cook [5 min]'));
/* F17 (October review): STEPS and NOTES are prose, so a sentence that starts
   with a keyword is not a misspelt line; one written in the syntax's shape is. */
const proseKeywords = 'TITLE: X\nSTEPS:\nStage the toppings before you start\nGROUP a-b:\nGROUP a:\n1 onion\nSTAGE:\nMERGE a -> d: Cook [5 min]\n'
  + 'NOTES:\nMerge well before serving\nGroup the bowls by colour\nTIPS:\nSTAGE 2:\nMERGE a → b: Stir';
check('    but a NOTES or STEPS sentence that starts "Merge", "Stage" or "Group" is not reported (F17)',
      unreadOf(proseKeywords) === 'GROUP a-b:|STAGE 2:|MERGE a → b: Stir', unreadOf(proseKeywords));
check('    without changing what it parses: a misspelt GROUP still lands where it always did',
      JSON.stringify(core.parseRecipe('GROUP a:\n1 onion\nGROUP b-c:\n1 leek').groups) === JSON.stringify([{ handle: 'a', items: ['1 onion', 'GROUP b-c:', '1 leek'] }]));
/* A recipe's choice belongs to that recipe (decided 28 Sep): by the row's name
   only when every recipe on the row offers it, else beside the recipe. */
const alts = core.aggregateShoppingLines([{ recipeTitle: 'A', raw: '3 tbsp golden syrup (or honey)' }, { recipeTitle: 'B', raw: '1 tbsp golden syrup' },
  { recipeTitle: 'C', raw: '200 ml milk (whole or semi-skimmed)' }, { recipeTitle: 'D', raw: '400 g plum tomatoes (1 tin)' },
  { recipeTitle: 'E', raw: '10 g butter (or oil)' }, { recipeTitle: 'F', raw: '20 g butter (or oil)' }], null);
const rowOf = k => alts.find(i => i.key === k) || {};
check('a choice from one recipe of several sits beside that recipe, not the row',
      JSON.stringify(rowOf('golden syrup').alts) === '[]' && JSON.stringify(rowOf('golden syrup').recipeAlts) === '[{"recipe":"A","alts":["or honey"]}]',
      JSON.stringify(rowOf('golden syrup')));
check('    beside the name when every recipe on the row offers it, a single recipe included',
      JSON.stringify(rowOf('milk').alts) === '["whole or semi-skimmed"]' && JSON.stringify(rowOf('butter').alts) === '["or oil"]'
      && !rowOf('milk').recipeAlts.length && !rowOf('butter').recipeAlts.length, JSON.stringify([rowOf('milk'), rowOf('butter')]));
check('    and a bracket with no choice in it shows nowhere, and never splits a row',
      alts.length === 4 && JSON.stringify(rowOf('plum tomato').alts) === '[]' && !rowOf('plum tomato').recipeAlts.length, JSON.stringify(alts.map(i => i.key)));
check('ghee goes with the dairy', only('2 tbsp ghee').category === 'Dairy & Eggs', only('2 tbsp ghee').category);
const wm = core.ingredientMatchMap([{ kind: 'ingredient', alias: 'Curly Kale', canonical: 'kale' }, { kind: 'ingredient', alias: 'large onion', canonical: 'onion' },
  { kind: 'source', alias: 'x', canonical: 'y' }]);
check('word matches are applied in today\'s words, and one the rules make anyway falls away',
      wm.size === 1 && wm.get('curly kale') === 'kale', JSON.stringify([...wm]));
/* F16 (October review): merge A into B, then B into C; A must reach C. Made-up names. */
const chain = core.ingredientMatchMap([{ kind: 'ingredient', alias: 'purple sprouting', canonical: 'tenderstem' },
  { kind: 'ingredient', alias: 'tenderstem', canonical: 'broccoli' }, { kind: 'ingredient', alias: 'romanesco', canonical: 'cauli' }, { kind: 'ingredient', alias: 'cauli', canonical: 'romanesco' }]);
check('a chain of word matches is followed to its end, and a loop stops rather than hanging (F16)',
      chain.get('purple sprouting') === 'broccoli' && chain.get('tenderstem') === 'broccoli' && chain.has('romanesco') && chain.has('cauli'), JSON.stringify([...chain]));
const tinRow = core.aggregateShoppingLines([{ recipeTitle: 'A', raw: '400 g tinned peaches' }]);
const tinBoth = core.aggregateShoppingLines([{ recipeTitle: 'A', raw: '400 g tinned peaches' }, { recipeTitle: 'B', raw: '200 g canned peaches' }]);
check('a line written "tinned" is shown as written, and still totals with "canned" (F45)',
      tinRow[0].name === 'Tinned peaches' && tinBoth.length === 1 && tinBoth[0].key === tinRow[0].key,
      JSON.stringify([tinRow.map(i => [i.key, i.name]), tinBoth.map(i => [i.key, i.name])]));

/* ---- PR 6 of the add-recipe plan, 29 Sep: the household's aisles ----
   An aisle replaces `category` once the key is final, and never the key. Made-up lines. */
const aoLines = [{ recipeTitle: 'A', raw: '300 g smoked mackerel' }, { recipeTitle: 'A', raw: '1 onion' }, { recipeTitle: 'A', raw: '1 romano pepper' }, { recipeTitle: 'B', raw: '2 smoked mackerel fillets' }, { recipeTitle: 'B', raw: '4 lamb shanks' }];
const aoMap = core.aisleOverrideMap([{ name: 'Smoked Mackerel', aisle: 'Meat & Fish' }, { name: 'onion', aisle: 'Pantry' }, { name: 'romano pepper', aisle: 'Pantry' }, { name: 'lamb shanks', aisle: 'Pantry' },
  { name: 'kohlrabi', aisle: 'Cellar' }, { name: '', aisle: 'Pantry' }]);
check('aisleOverrideMap keys each name in today\'s words and drops an aisle the app does not have',
      aoMap.get('smoked mackerel') === 'Meat & Fish' && aoMap.get('onion') === 'Pantry' && aoMap.get('lamb shank') === 'Pantry' && !aoMap.has('kohlrabi') && aoMap.size === 4, JSON.stringify([...aoMap]));
const aoPlain = core.aggregateShoppingLines(aoLines, null), aoSet = core.aggregateShoppingLines(aoLines, null, k => aoMap.get(k));
const aoRow = (items, k) => items.find(i => i.key === k) || {};
check('an aisle override wins over nothing, the keyword rules and a dictionary row alike, and says so',
      aoRow(aoPlain, 'smoked mackerel').category === 'Other' && aoRow(aoPlain, 'smoked mackerel').aisleWhy === 'none'
      && aoRow(aoPlain, 'romano pepper').aisleWhy === 'keyword' && aoRow(aoPlain, 'lamb shank').category === 'Meat & Fish' && aoRow(aoPlain, 'lamb shank').aisleWhy === 'keyword'
      && aoRow(aoPlain, 'onion').aisleWhy === 'dictionary'
      && aoRow(aoSet, 'smoked mackerel').category === 'Meat & Fish' && aoRow(aoSet, 'romano pepper').category === 'Pantry' && aoRow(aoSet, 'onion').category === 'Pantry'
      && aoRow(aoSet, 'lamb shank').category === 'Pantry' && ['smoked mackerel', 'romano pepper', 'lamb shank', 'onion'].every(k => aoRow(aoSet, k).aisleWhy === 'override'),
      JSON.stringify([aoPlain, aoSet].map(l => l.map(i => [i.key, i.category, i.aisleWhy]))));
check('    and no key changes with an override applied: the same rows, the same keys, the same totals',
      JSON.stringify(aoPlain.map(i => [i.key, i.name, i.qtyText, i.count])) === JSON.stringify(aoSet.map(i => [i.key, i.name, i.qtyText, i.count])),
      JSON.stringify([aoPlain.map(i => i.key), aoSet.map(i => i.key)]));
const aoRev = core.newRecipeReview({ lines: ['300 g smoked mackerel'], library: [], alias: null, isSettled: null, aisleOverride: k => aoMap.get(k) });
check('    the review lands a new name where the household put it, no longer Other',
      aoRev.names.length === 1 && aoRev.names[0].aisle === 'Meat & Fish' && aoRev.names[0].other === false && aoRev.names[0].aisleWhy === 'override', JSON.stringify(aoRev.names));

/* ---- PR 7d, 28 Sep: a source's list pasted from its page ---- */
const pastedOf = t => core.pastedIngredientLines(t);
const furniture = '▢ 500 g chicken breast\n\n• 2 tbsp olive oil\n- 1 onion, chopped\n☐\u00a01\u00a0tsp   salt\r\n[ ] 3 eggs\n   \n▢\n\u200b▢ 4 shallots\n';
check('a pasted list loses its tick boxes, bullets, blank lines, zero-width and odd spaces, and nothing else',
      pastedOf(furniture).join('|') === '500 g chicken breast|2 tbsp olive oil|1 onion, chopped|1 tsp salt|3 eggs|4 shallots', JSON.stringify(pastedOf(furniture)));
check('    a heading is dropped when it is certainly one: no digit, and a colon, "For the…" or a section word',
      pastedOf('Ingredients\nFor the sauce\nFor a crumb topping:\nSauce:\nMethod\n2 eggs').join('|') === '2 eggs', JSON.stringify(pastedOf('Ingredients\nFor the sauce\nFor a crumb topping:\nSauce:\nMethod\n2 eggs')));
const keptLines = ['salt', 'black pepper, to taste', 'For the sauce: 200 ml cream', 'a pinch of salt', '1–2 tbsp honey', '½ tsp cumin', '*optional: chives', 'Water'];
check('    and anything that might be an ingredient stays, so the check never quietly loses one',
      pastedOf(keptLines.join('\n')).join('|') === keptLines.join('|'), JSON.stringify(pastedOf(keptLines.join('\n'))));
check('    nothing, or something that is not text, is an empty list rather than an error',
      pastedOf('').length === 0 && pastedOf(null).length === 0 && pastedOf(undefined).length === 0 && pastedOf('  \n\n ').length === 0);
const pastedCheck = core.sourceFidelity(pastedOf('Ingredients\n▢ 1 tsp Italian seasoning\n▢ 2 cups all-purpose flour\nFor the topping:\n▢ 1/2 cup heavy cream'),
  ['1 tsp dried oregano', '250 g plain flour', '120 ml double cream']);
check('    and a swapped ingredient in a pasted list shows on both sides, as it does from the function',
      pastedCheck.sourceOnly.join('|') === '1 tsp Italian seasoning' && pastedCheck.recipeOnly.join('|') === '1 tsp dried oregano'
      && pastedCheck.matched.length === 2, JSON.stringify(pastedCheck));

/* ---- PR 7e, 28 Sep: the source check no longer calls a difference a match ----
   A real comparison paired a source's second "1/2 tsp" line with the recipe's
   "pinch" line, and reported it matched. Probing then found the check blind to
   ten of eleven faults tried. Every line below is made up. */
const fid = (src, rec) => core.sourceFidelity(src, rec);
const groupsFlagged = f => new Set(f.matched.filter(m => m.check).map(m => m.check)).size;
const flagCount = f => f.sourceOnly.length + f.recipeOnly.length + groupsFlagged(f);
const flagKinds = f => [...new Set(f.matched.filter(m => m.check).map(m => m.check.kind))].sort().join(',');
const dupSrc = ['1/4 tsp ground cinnamon', '2 eggs', 'a pinch of salt and cinnamon', '1/4 tsp ground cinnamon'];
const dupRec = ['1/4 tsp ground cinnamon', '2 eggs', 'pinch salt', 'pinch cinnamon'];
const dup = fid(dupSrc, dupRec);
check('a source line listed twice, with a compound pinch line, is not hidden by matching the pinch line: it is flagged once, as an amount',
      flagCount(dup) === 1 && flagKinds(dup) === 'amount' && /source 1\/4 tsp \+ 1\/4 tsp; recipe 1\/4 tsp/.test(dup.matched.find(m => m.check).check.why), JSON.stringify(dup));
check('    and the pinch stays with its own compound line, split in two, unflagged',
      dup.matched.filter(m => m.source === 'a pinch of salt and cinnamon' && !m.check).map(m => m.recipe).sort().join('|') === 'pinch cinnamon|pinch salt', JSON.stringify(dup.matched));
const dupPepper = fid(['1/4 tsp black pepper', 'a pinch of salt and pepper', '1/4 tsp black pepper'], ['1/4 tsp black pepper', 'pinch salt', 'pinch pepper']);
check('    the same through the dictionary, where a bare "pepper" is black pepper: the pinch is part of the total, and named',
      flagCount(dupPepper) === 1 && flagKinds(dupPepper) === 'amount'
      && dupPepper.matched.some(m => m.source === 'a pinch of salt and pepper' && m.recipe === 'pinch pepper' && m.check)
      && /source 1\/4 tsp \+ 1\/4 tsp \+ a pinch; recipe 1\/4 tsp \+ a pinch/.test(dupPepper.matched.find(m => m.check).check.why), JSON.stringify(dupPepper));
const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(r => [x].concat(r)));
/* Flagged rightly is not enough: it must be flagged for the right reason, or
   the person reads "1/4 tsp against a pinch" and looks in the wrong place. The
   pepper variant matters most, because both of its candidate lines share one
   dictionary name and score alike; only the amounts tell them apart. */
const diagnosis = f => JSON.stringify([[...new Set(f.matched.filter(m => m.check).map(m => m.check.why))], f.sourceOnly.length, f.recipeOnly.length]);
const wrongOrder = [];
/* Which line is drawn beside which is only presentation, but a spoon drawn beside a pinch sends the eye to the wrong lines. */
const mixesSpoonAndPinch = f => f.matched.some(m => /\btsp\b/.test(m.source) !== /\btsp\b/.test(m.recipe));
[[dupSrc, dupRec], [['1/4 tsp black pepper', 'a pinch of salt and pepper', '1/4 tsp black pepper'], ['1/4 tsp black pepper', 'pinch salt', 'pinch pepper']]].forEach(([src, rec]) => {
  const right = diagnosis(fid(src, rec));
  perms(src).forEach(ps => perms(rec).forEach(pr => { const f = fid(ps, pr), d = diagnosis(f); if(d !== right || mixesSpoonAndPinch(f) || f.matched.some(m => m.note)) wrongOrder.push(ps.join(' / ') + ' :: ' + pr.join(' / ') + ' => ' + d); }));
});
check('    whatever order the lists come in (612 orders, both variants), it is the same two lines blamed for the same reason, drawn sensibly and with no stray note', wrongOrder.length === 0,
      wrongOrder.length + ' wrong, e.g. ' + wrongOrder[0]);

/* 29 Sep: a web page's line of alternatives, "sliced, slivered, or chopped almonds",
   was named "sliced" (the text before its first comma), so it had no name of its own,
   joined the recipe's "ground almonds" by that line's words alone, and left the
   recipe's flaked almonds standing on their own. Made-up amounts. */
const altList = fid(['1 cup (100g) almond flour', '1/2 cup (50g) sliced, slivered, or chopped almonds'], ['100 g ground almonds', '50 g flaked almonds']);
check('a source line of alternatives ("sliced, slivered, or chopped almonds") is named by its first one and the noun they share, so it pairs with the flaked almonds',
      altList.matched.some(m => /sliced, slivered/.test(m.source) && m.recipe === '50 g flaked almonds')
      && altList.matched.some(m => /almond flour/.test(m.source) && m.recipe === '100 g ground almonds')
      && altList.matched.length === 2 && !altList.matched.some(m => m.split) && !altList.recipeOnly.length && !altList.sourceOnly.length, JSON.stringify(altList));

/* 29 Sep, the household: ground almonds are not almonds. "Ground" counts in a name wherever the shopping
   list's key keeps it, and is dropped where the key drops it ("freshly ground pepper" is black pepper).
   And UK "ground almonds" is US "almond flour" or "almond meal" (a dictionary row), so a source written
   "almond flour or almond meal" is read as its first alternative. Made-up amounts. */
const grAlm = fid(['100 g almonds'], ['100 g ground almonds']), grCar = fid(['1 tsp caraway seeds'], ['1 tsp ground caraway']);
check('ground almonds are not almonds, nor ground caraway caraway seeds: each is flagged as a wording difference',
      flagKinds(grAlm) === 'wording' && /adds ground/.test(grAlm.matched[0].check.why) && flagKinds(grCar) === 'wording',
      JSON.stringify([grAlm, grCar]));
const grPep = fid(['1/2 tsp black pepper', 'a pinch of freshly ground pepper'], ['1/2 tsp ground black pepper', 'pinch black pepper']);
check('    but "ground" stays dropped where the list drops it: ground black pepper is black pepper, with no hard difference',
      flagCount(grPep) === 0 && !grPep.matched.some(m => m.note && /ground/.test(m.note.why)), JSON.stringify(grPep));
const grFlour = fid(['1 cup (100g) almond flour', '1/2 cup (50g) almond meal', '3/4 cup (80g) almond flour or almond meal'], ['100 g ground almonds', '50 g ground almonds', '80 g ground almonds']);
check('    and a source\'s almond flour, almond meal, or "almond flour or almond meal" is the recipe\'s ground almonds',
      flagCount(grFlour) === 0 && !grFlour.matched.some(m => m.note), JSON.stringify(grFlour));
const grOr = fid(['2 tbsp olive oil or butter'], ['2 tbsp olive oil (or butter)']);
check('    the first alternative is the name, as the converter keeps the rest in brackets ("olive oil or butter" is olive oil)',
      flagCount(grOr) === 0, JSON.stringify(grOr));

/* Each of these is a conversion fault a person would want to see. */
const faults = [
  ['white pepper for black', ['1/2 tsp black pepper'], ['1/2 tsp white pepper'], 'wording'],
  ['onion powder for garlic powder', ['1/4 tsp garlic powder'], ['1/4 tsp onion powder'], 'wording'],
  ['beef stock for chicken stock', ['240 ml chicken stock'], ['240 ml beef stock'], 'wording'],
  ['skimmed milk for whole milk', ['200 ml whole milk'], ['200 ml skimmed milk'], 'wording'],
  ['baking powder for baking soda', ['1 tsp baking soda'], ['1 tsp baking powder'], 'wording'],
  ['self-raising for plain flour', ['250 g plain flour'], ['250 g self-raising flour'], 'wording'],
  ['black pepper for a red bell pepper', ['1 red bell pepper'], ['1 pepper'], 'wording'],
  ['a more specific product than the source named', ['1 tsp vanilla'], ['1 tsp vanilla extract'], 'wording'],
  ['2 tbsp written as 1 tbsp', ['2 tbsp olive oil'], ['1 tbsp olive oil'], 'amount'],
  ['1 tsp written as 1 tbsp', ['1 tsp baking powder'], ['1 tbsp baking powder'], 'amount'],
  ['400 g written as 40 g', ['400 g plain flour'], ['40 g plain flour'], 'amount'],
  ['2 cloves written as 3', ['2 cloves garlic'], ['3 cloves garlic'], 'amount'],
  ['a pinch quantified as a spoon', ['a pinch of chilli flakes'], ['1/4 tsp chilli flakes'], 'amount'],
  ['a split that does not add up: 3 tbsp as 1 + 1', ['3 tbsp oil'], ['1 tbsp oil', '1 tbsp oil'], 'amount'],
  ['a pound written as 600 g', ['1 lb beef'], ['600 g beef'], 'amount'],
  ['a range collapsed to its low end', ['2-3 tbsp olive oil'], ['2 tbsp olive oil'], 'amount'],
  ['a range collapsed to its high end', ['2-3 tbsp olive oil'], ['3 tbsp olive oil'], 'amount'],
  ['a range shifted', ['2-3 tbsp olive oil'], ['2-4 tbsp olive oil'], 'amount'],
  ['a spoon written as a pinch', ['1 tsp cumin'], ['1 pinch cumin'], 'amount'],
  ['a figure moved 4% in the same unit, for which there is no conversion to blame', ['250 g plain flour'], ['240 g plain flour'], 'amount'],
  ['two source lines merged into too little: 1 + 1 tsp as 1', ['1 tsp cumin', '1 tsp cumin'], ['1 tsp cumin'], 'amount'],
  ['an ingredient dropped', ['1 onion', '1 carrot'], ['1 carrot'], ''],
  ['an ingredient dropped whose only remaining neighbour shares a word', ['1 red bell pepper', '1/2 tsp black pepper'], ['1/2 tsp black pepper'], ''],
  ['the same, when the dropped line has no comma so the dictionary cannot name it', ['1 green pepper de-seeded and sliced', 'a pinch of salt and pepper'], ['pinch salt', 'pinch pepper'], ''],
  ['the second half of a compound line dropped', ['a pinch of salt and cumin'], ['pinch salt'], ''],
  ['an ingredient added that the source lacks', ['2 eggs'], ['2 eggs', '1 tsp cumin'], '']];
/* A difference between two paired lines is reported once, on the pair: not again as a line found on one side only. */
const missed = faults.filter(([, s, r, kind]) => { const f = fid(s, r); return flagCount(f) === 0 || flagKinds(f) !== kind || (kind && (f.sourceOnly.length || f.recipeOnly.length)); });
check('each of twenty-six conversion faults is flagged, and as the right kind of fault', missed.length === 0,
      missed.map(([n, s, r]) => n + ': ' + JSON.stringify(fid(s, r))).join(' || '));
check('    a dropped half of a compound line says which half',
      /the "cumin" part/.test(fid(['a pinch of salt and cumin'], ['pinch salt']).sourceOnly.join('|')), JSON.stringify(fid(['a pinch of salt and cumin'], ['pinch salt']).sourceOnly));
check('    and a flagged pair says what differs, in words',
      /the recipe adds skimmed/.test(fid(['200 ml whole milk'], ['200 ml skimmed milk']).matched[0].check.why)
      && /amounts differ: source 2 tbsp; recipe 1 tbsp/.test(fid(['2 tbsp olive oil'], ['1 tbsp olive oil']).matched[0].check.why));

/* And none of these is a fault: the converter doing what it is asked, or the
   check declining to compare what it cannot. Unknown never warns. */
const fine = [
  ['cups against grams cannot be compared', ['2 cups plain flour'], ['250 g plain flour']],
  ['cups with the ml in brackets', ['1 cup (240 ml) milk'], ['240 ml milk']],
  ['a half cup as ml', ['1/2 cup milk'], ['120 ml milk']],
  ['ounces as grams', ['8 oz cream cheese'], ['225 g cream cheese']],
  ['a pound as grams', ['1 lb beef'], ['450 g beef']],
  ['a pound rounded to 500 g, as a cook would', ['1 lb beef'], ['500 g beef']],
  ['a cup as 250 ml, the metric cup', ['1 cup milk'], ['250 ml milk']],
  ['a spoon against grams cannot be compared', ['1 tbsp sugar'], ['15 g sugar']],
  ['a weight for a volume is not compared', ['500 ml stock'], ['500 g stock']],
  ['a count against a weight cannot be compared', ['2 (400 g) tins chopped tomatoes'], ['800 g chopped tomatoes (2 tins)']],
  ['3 x 400 g as 1200 g', ['3 x 400 g tins tomatoes'], ['1200 g tomatoes']],
  ['a range kept as the source gives it', ['2-3 tbsp olive oil'], ['2-3 tbsp olive oil']],
  ['a range written with an en dash and kept with a hyphen', ['2–3 tbsp olive oil'], ['2-3 tbsp olive oil']],
  ['1 1/2 written as 1.5', ['1 1/2 tsp baking powder'], ['1.5 tsp baking powder']],
  ['a third written as 0.33', ['1/3 tsp salt'], ['0.33 tsp salt']],
  ['a late addition: 3 tbsp split 1 + 2', ['3 tbsp oil'], ['1 tbsp oil', '2 tbsp oil']],
  ['two source lines correctly merged: 1 + 1 tsp as 2', ['1 tsp cumin', '1 tsp cumin'], ['2 tsp cumin']],
  ['a late addition, with a note on each', ['2 tbsp butter'], ['1 tbsp butter (for frying)', '1 tbsp butter (to finish)']],
  ['preparation worded differently', ['1 onion, finely chopped'], ['1 onion, diced']],
  ['"peeled and sliced" is one ingredient, not two', ['1 shallot peeled and sliced'], ['1 shallot, peeled and sliced']],
  ['cloves reordered', ['3 cloves garlic, crushed'], ['3 garlic cloves, crushed']],
  ['a tin in brackets', ['1 (14 oz) can chickpeas, drained'], ['400 g chickpeas (1 tin), drained']],
  ['the product moved into brackets', ['250 g noodles (I use udon)'], ['250 g udon (noodles)']],
  ['a source note dropped', ['200 g (1 cup) dried apricots I like the soft ones'], ['200 g dried apricots']],
  ['a compound line split in two', ['salt and pepper, to taste'], ['salt, to taste', 'black pepper, to taste']],
  ['a pinch of each', ['a pinch of salt and cumin'], ['pinch salt', 'pinch cumin']],
  ['a pinch for a pinch', ['a pinch of salt'], ['pinch salt']],
  ['US names the dictionary knows', ['1/2 cup heavy cream', '1 bunch cilantro', '4 scallions'], ['120 ml double cream', '1 bunch fresh coriander', '4 spring onions']],
  ['soy sauce, which the dictionary makes light', ['2 tbsp soy sauce'], ['2 tbsp light soy sauce']],
  ['a recipe that says less than its source', ['1 tsp freshly grated nutmeg'], ['1 tsp nutmeg']]];
const noisy = fine.filter(([, s, r]) => flagCount(fid(s, r)) !== 0);
check('each of thirty conversions that are not faults stays quiet', noisy.length === 0,
      noisy.map(([n, s, r]) => n + ': ' + JSON.stringify(fid(s, r))).join(' || '));
const amt = l => core.fidelityAmount(l);
const agree = (x, y) => core.fidelityAgree(x.map(amt), y.map(amt));
check('amounts compare only where a difference cannot be a unit conversion',
      agree(['1 tbsp oil'], ['15 ml oil']) === 'agree' && agree(['1 tsp oil'], ['1 tbsp oil']) === 'differ' && agree(['8 oz cheese'], ['225 g cheese']) === 'agree'
      && agree(['8 oz cheese'], ['150 g cheese']) === 'differ' && agree(['1 cup flour'], ['120 g flour']) === 'unknown' && agree(['2 eggs'], ['200 g eggs']) === 'unknown'
      && agree(['2-3 tbsp oil'], ['2 tbsp oil']) === 'differ' && agree(['2-3 tbsp oil'], ['2-3 tbsp oil']) === 'agree' && agree(['up to 600 ml cider'], ['600 ml cider']) === 'unknown',
      JSON.stringify([agree(['1 tbsp oil'], ['15 ml oil']), agree(['1 tsp oil'], ['1 tbsp oil']), agree(['1 cup flour'], ['120 g flour'])]));
check('    a pinch is an amount of its own kind: it differs from a spoon and agrees with a pinch, and totals add up',
      agree(['a pinch of salt'], ['1/2 tsp salt']) === 'differ' && agree(['a pinch of salt'], ['pinch salt']) === 'agree'
      && agree(['1 tbsp oil', '2 tbsp oil'], ['3 tbsp oil']) === 'agree' && agree(['1 tbsp oil'], ['3 tbsp oil', '2 tbsp oil']) === 'differ'
      && amt('1 tbsp oil, a pinch').kind === 'measured' && amt('salt') === null
      && amt('a dash of vinegar').text === 'a dash' && amt('two pinches of salt') === null && amt('a pinch of salt').text === 'a pinch'
      && ['a pinch of salt', 'pinch of salt', '1 pinch salt', 'pinch salt', 'a pinch salt'].every(l => agree(['a pinch of salt'], [l]) === 'agree') && agree(['2 pinches salt'], ['1 pinch salt']) === 'differ');

/* ---- Generality guard (28 Sep, PR 7e) ----
   The checks above pin cases somebody thought of, and a comparison written from a
   handful of examples passes every one of them. This runs the same faults and the
   same harmless conversions over EVERY ingredient in the dictionary and its plain
   spellings, so a rule that only holds for the ingredients it was written from
   cannot pass. Nothing below names an ingredient: the lines are built from the
   vocabulary, and the operators are the ways a converter may legitimately reshape
   a line (conversion-instructions.md) and the ways it can get one wrong. */
const vocab = core.INGREDIENT_DICTIONARY.map(r => ({ name: r.name, aisle: r.aisle,
  aliases: core.dictionaryPhrases(r).live.slice(1) }));
const wordsOf = n => n.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !['and', 'the', 'whole', 'fresh'].includes(w));
const allWords = r => new Set([r.name].concat(r.aliases).flatMap(wordsOf));
const collides = (a, b) => { const wa = allWords(a); return [...allWords(b)].some(w => wa.has(w)); };
const AMOUNTS = { 'Spices & Seasoning': [[1, 'tsp'], [0.5, 'tsp'], [2, 'tsp'], [1, 'tbsp']], Produce: [[2, ''], [3, ''], [200, 'g'], [1, '']],
  'Meat & Fish': [[300, 'g'], [500, 'g'], [250, 'g'], [2, '']], 'Dairy & Eggs': [[100, 'g'], [200, 'ml'], [4, ''], [50, 'g']],
  Pantry: [[2, 'tbsp'], [100, 'g'], [250, 'ml'], [1, 'tsp'], [150, 'g']] };
const amountOf = (r, i) => { const l = AMOUNTS[r.aisle] || AMOUNTS.Pantry; return l[i % l.length]; };
const fracText = n => ({ 0.5: '1/2', 0.25: '1/4', 1.5: '1 1/2' }[n] || String(n));
const glyphText = n => ({ 0.5: '½', 0.25: '¼', 1.5: '1½' }[n] || String(n));
const Ln = (q, u, name) => `${fracText(q)}${u ? ' ' + u : ''} ${name}`.trim();
/* [name, make(name, qty, unit, another ingredient, its row) => [source lines, recipe lines] or null] */
const QUIET_OPS = [
  ['an identical line', (n, q, u) => [[Ln(q, u, n)], [Ln(q, u, n)]]],
  ['a fraction glyph', n => [[`${glyphText(0.5)} tsp ${n}`], [`1/2 tsp ${n}`]]],
  ['a mixed number glyph', n => [[`${glyphText(1.5)} tbsp ${n}`], [`1 1/2 tbsp ${n}`]]],
  ['long unit words', n => [[`2 tablespoons ${n}`], [`2 tbsp ${n}`]]],
  ['a unit glued to its number', n => [[`500g ${n}`], [`500 g ${n}`]]],
  ['kilos as grams', n => [[`1.5 kg ${n}`], [`1500 g ${n}`]]],
  ['a litre as ml', n => [[`1 litre ${n}`], [`1000 ml ${n}`]]],
  ...['a pinch of', 'pinch of', '1 pinch', 'a pinch', 'pinch'].flatMap(a => ['1 pinch', 'pinch'].map(b => [`a pinch written "${a}" and "${b}"`, n => [[`${a} ${n}`], [`${b} ${n}`]]])),
  ['a dash written two ways', n => [[`a dash of ${n}`], [`1 dash ${n}`]]],
  ['a size word moved into a note', n => [[`1 large ${n}`], [`1 ${n} (large)`]]],
  ['a can with its weight as a tin', n => [[`1 can (400g) ${n}`], [`400 g ${n} (1 tin)`]]],
  ['two tins as their total', n => [[`2 x 400g tins ${n}`], [`800 g ${n} (2 tins)`]]],
  ['a can in ounces', n => [[`1 (14 oz) can ${n}`], [`400 g ${n} (1 tin)`]]],
  ['cups as grams, which cannot be compared', n => [[`1 cup ${n}`], [`120 g ${n}`]]],
  ['cups as ml', n => [[`1/2 cup ${n}`], [`120 ml ${n}`]]],
  ['cups as a metric cup', n => [[`1 cup ${n}`], [`250 ml ${n}`]]],
  ['spoons as grams, which cannot be compared', n => [[`3 tbsp ${n}`], [`45 g ${n}`]]],
  ['ounces as grams', n => [[`8 oz ${n}`], [`225 g ${n}`]]],
  ['a pound as 450 g', n => [[`1 lb ${n}`], [`450 g ${n}`]]],
  ['a pound rounded to 500 g', n => [[`1 lb ${n}`], [`500 g ${n}`]]],
  ['an ounce rounded to 30 g', n => [[`1 oz ${n}`], [`30 g ${n}`]]],
  ['preparation moved after the comma', n => [[`2 finely chopped ${n}`], [`2 ${n}, finely chopped`]]],
  ['preparation reworded', n => [[`2 ${n}, chopped`], [`2 ${n}, roughly diced`]]],
  ['a note added in brackets', n => [[`2 ${n}`], [`2 ${n} (about 200 g)`]]],
  ['preparation described in words the app has never seen', n => [[`2 ${n}`], [`2 ${n}, cut into matchsticks`]]],
  ['a teaspoon as 5 ml', n => [[`2 tsp ${n}`], [`10 ml ${n}`]]],
  ['a tablespoon as 15 ml', n => [[`2 tbsp ${n}`], [`30 ml ${n}`]]],
  ['a tablespoon as three teaspoons', n => [[`1 tbsp ${n}`], [`3 tsp ${n}`]]],
  ['a quarter cup as 60 ml', n => [[`1/4 cup ${n}`], [`60 ml ${n}`]]],
  ['an "optional" note dropped', n => [[`2 ${n} (optional)`], [`2 ${n}`]]],
  ['"to serve"', n => [[`${n}, to serve`], [`${n}, to serve`]]],
  ['"to taste" with no comma', n => [[`${n} to taste`], [`${n}, to taste`]]],
  ['a late addition, 3 tbsp as 1 + 2', n => [[`3 tbsp ${n}`], [`1 tbsp ${n}`, `2 tbsp ${n}`]]],
  ['a late addition, 300 g as 100 + 200', n => [[`300 g ${n}`], [`100 g ${n}`, `200 g ${n}`]]],
  ['a late addition, 4 as 2 + 2', n => [[`4 ${n}`], [`2 ${n}`, `2 ${n}`]]],
  ['two source lines merged, 1 + 1 tsp as 2', n => [[`1 tsp ${n}`, `1 tsp ${n}`], [`2 tsp ${n}`]]],
  ['three source lines restructured to two, the same total', n => [[`2 tbsp ${n}`, `1 tbsp ${n}`, `3 tbsp ${n}`], [`4 tbsp ${n}`, `2 tbsp ${n}`]]],
  ['two source lines restructured to three, the same total', n => [[`300 g ${n}`, `100 g ${n}`], [`100 g ${n}`, `100 g ${n}`, `200 g ${n}`]]],
  ['a repeated ingredient, the same on both sides', n => [[`2 ${n}`, `3 ${n}`, `1 ${n}`], [`3 ${n}`, `2 ${n}`, `1 ${n}`]]],
  ['a range kept', n => [[`2-3 tbsp ${n}`], [`2-3 tbsp ${n}`]]],
  ['a range kept with an en dash turned to a hyphen', n => [[`2–3 tbsp ${n}`], [`2-3 tbsp ${n}`]]],
  ['a recipe that says less than its source', n => [[`2 ${n} (the good kind)`], [`2 ${n}`]]],
  ['a compound line split in two', (n, q, u, o) => [[`${n} and ${o}, to taste`], [`${n}, to taste`, `${o}, to taste`]]],
  ['a dictionary spelling with a serving note and no comma', (n, q, u, o, r) => r.aliases.length ? [[`${r.aliases[0]} to taste`], [`${n}, to taste`]] : null],
  ['a spelling the dictionary lists, for its name', (n, q, u, o, r) => r.aliases.length ? [[Ln(q, u, r.aliases[0])], [Ln(q, u, n)]] : null],
  ['its name, for a spelling the dictionary lists', (n, q, u, o, r) => r.aliases.length ? [[Ln(q, u, n)], [Ln(q, u, r.aliases[r.aliases.length - 1])]] : null]];
const FLAG_OPS = [
  ['a line dropped', (n, q, u) => [[Ln(q, u, n)], []]],
  ['an ingredient added that the source lacks', (n, q, u) => [[], [Ln(q, u, n)]]],
  ...[[2, 'doubled'], [0.5, 'halved'], [3, 'tripled'], [0.1, 'a tenth'], [1.04, '4% out, in the same unit']].map(([m, w]) => [`an amount ${w}`, (n, q, u) => [[Ln(q, u, n)], [Ln(+(q * m).toFixed(3), u, n)]]]),
  ['a tsp and a tbsp mixed up', (n, q, u) => u === 'tsp' || u === 'tbsp' ? [[Ln(q, u, n)], [Ln(q, u === 'tsp' ? 'tbsp' : 'tsp', n)]] : null],
  ['grams written as kilos', (n, q, u) => u === 'g' ? [[Ln(q, u, n)], [Ln(q, 'kg', n)]] : null],
  ['ml written as litres', (n, q, u) => u === 'ml' ? [[Ln(q, u, n)], [Ln(q, 'l', n)]] : null],
  ['a count changed', (n, q, u) => u === '' ? [[Ln(q, u, n)], [Ln(q + 1, u, n)]] : null],
  ['a different ingredient', (n, q, u, o) => [[Ln(q, u, n)], [Ln(q, u, o)]]],
  ['a source line listed twice, the recipe once', (n, q, u) => [[Ln(q, u, n), Ln(q, u, n)], [Ln(q, u, n)]]],
  ['three source lines restructured to two, the total too small', n => [[`2 tbsp ${n}`, `1 tbsp ${n}`, `3 tbsp ${n}`], [`4 tbsp ${n}`, `1 tbsp ${n}`]]],
  ['two source lines restructured to three, the total too large', n => [[`300 g ${n}`, `100 g ${n}`], [`100 g ${n}`, `200 g ${n}`, `200 g ${n}`]]],
  ['a range collapsed to its low end', n => [[`2-3 tbsp ${n}`], [`2 tbsp ${n}`]]],
  ['a range collapsed to its high end', n => [[`2-3 tbsp ${n}`], [`3 tbsp ${n}`]]],
  ['a range shifted', n => [[`2-3 tbsp ${n}`], [`2-4 tbsp ${n}`]]],
  ['a pinch quantified as a spoon', n => [[`a pinch of ${n}`], [`1/4 tsp ${n}`]]],
  ['a spoon written as a pinch', n => [[`1 tsp ${n}`], [`1 pinch ${n}`]]],
  ['the second half of a compound line dropped', (n, q, u, o) => [[`${n} and ${o}, to taste`], [`${n}, to taste`]]]];
/* Nothing may silently disappear: every line handed in is drawn in a pair or listed on its own. */
const accountedFor = (f, src, rec) => src.every(l => f.matched.some(m => m.source === l) || f.sourceOnly.some(x => x === l || x.startsWith(l + ' (the "')))
  && rec.every(l => f.matched.some(m => m.recipe === l) || f.recipeOnly.some(x => x === l || x.startsWith(l + ' (the "')));
const sweep = (ops, expectFlag, withBackground) => {
  const wrong = []; let n = 0;
  vocab.forEach((r, i) => {
    if(withBackground && i % 6) return;
    const [q, u] = amountOf(r, i);
    const rest = vocab.slice(i + 1).concat(vocab.slice(0, i));
    const other = rest.find(o => !collides(o, r));
    /* the compound operators need a second ingredient that also stays out of the background */
    const bg = rest.filter(o => !collides(o, r) && !collides(o, other)).slice(0, 7).map((o, k) => Ln(...amountOf(o, i + k), o.name));
    ops.forEach(([name, make]) => {
      const pair = make(r.name, q, u, other.name, r); if(!pair) return;
      const f = withBackground ? fid(bg.concat(pair[0]), bg.slice().reverse().concat(pair[1])) : fid(pair[0], pair[1]);
      n++;
      const noted = !expectFlag && !/spelling/.test(name) && f.matched.some(m => m.note);
      const src = withBackground ? bg.concat(pair[0]) : pair[0], rec = withBackground ? bg.concat(pair[1]) : pair[1];
      if((flagCount(f) > 0) !== expectFlag || noted || !accountedFor(f, src, rec)) wrong.push(`${name}: ${JSON.stringify(pair)} => ${JSON.stringify(f)}`.slice(0, 380));
    });
  });
  return { n, wrong };
};
const quietPlain = sweep(QUIET_OPS, false, false), quietBg = sweep(QUIET_OPS, false, true);
const flagPlain = sweep(FLAG_OPS, true, false), flagBg = sweep(FLAG_OPS, true, true);
check(`across every ingredient in the dictionary, ${quietPlain.n} harmless conversions stay quiet`, quietPlain.wrong.length === 0, quietPlain.wrong.length + ' false alarms, e.g. ' + quietPlain.wrong[0]);
check(`    and with a recipe's other lines around them (${quietBg.n} more)`, quietBg.wrong.length === 0, quietBg.wrong.length + ' false alarms, e.g. ' + quietBg.wrong[0]);
check(`across every ingredient in the dictionary, ${flagPlain.n} conversion faults are all flagged`, flagPlain.wrong.length === 0, flagPlain.wrong.length + ' missed, e.g. ' + flagPlain.wrong[0]);
check(`    and with a recipe's other lines around them (${flagBg.n} more)`, flagBg.wrong.length === 0, flagBg.wrong.length + ' missed, e.g. ' + flagBg.wrong[0]);
/* Every pair of dictionary ingredients as a compound line: 8,010 of them were run
   once, when this was written; a spread of them runs here. */
const compoundWrong = [];
vocab.forEach((r, i) => [1, 7, 31].forEach(off => {
  const o = vocab[(i + off) % vocab.length], src = [`${r.name} and ${o.name}, to taste`];
  if(flagCount(fid(src, [`${r.name}, to taste`, `${o.name}, to taste`])) !== 0) compoundWrong.push('split: ' + src[0]);
  if(flagCount(fid(src, [`${r.name}, to taste`])) === 0) compoundWrong.push('half dropped: ' + src[0]);
}));
check('a compound line of any two dictionary ingredients is quiet when split and flagged when a half is dropped', compoundWrong.length === 0, compoundWrong.length + ' wrong, e.g. ' + compoundWrong[0]);

/* ---- US translations (29 Sep 2026) ----
   The check no longer takes "shares a word" for "the same", so a US name the dictionary
   has no row for was flagged against its British one (58% of 67 pairs written for the
   purpose). The remedy is rows, and the rule for a row is the household's own (23 Sep):
   ONE PRODUCT ON THE SHELF UNDER TWO NAMES. Never a substitute, never a near
   equivalent, because a row also totals the shopping list, and two different products
   on one row is a worse failure than a false alarm here. These checks hold both halves. */
const wordingsWrong = [];
vocab.forEach(r => { const all = [r.name].concat(r.aliases);
  all.forEach(a => all.forEach(b => { if(a !== b && flagCount(fid([`2 tbsp ${a}`], [`2 tbsp ${b}`])) !== 0) wordingsWrong.push(`${a} -> ${b}`); })); });
check('every wording of a row is quiet against every other wording of the same row, in both directions', wordingsWrong.length === 0, wordingsWrong.length + ' flagged, e.g. ' + wordingsWrong[0]);
const neighbours = [];
vocab.forEach((a, i) => vocab.slice(i + 1).forEach(b => { if(collides(a, b)) neighbours.push([a.name, b.name]); }));
const takenForOne = neighbours.filter(([a, b]) => flagCount(fid([`2 tbsp ${a}`], [`2 tbsp ${b}`])) === 0 || flagCount(fid([`2 tbsp ${b}`], [`2 tbsp ${a}`])) === 0);
check(`two different rows that share a word are never taken for one another (${neighbours.length} pairs, both ways round)`, takenForOne.length === 0, takenForOne.map(p => p.join(' / ')).join('; '));
const TRANSLATED = [['eggplant', 'aubergine'], ['zucchini', 'courgette'], ['arugula', 'rocket'], ['heavy whipping cream', 'double cream'], ["confectioners' sugar", 'icing sugar'],
  ['shrimp', 'prawns'], ['garbanzo beans', 'chickpeas'], ['rutabaga', 'swede'], ['snow peas', 'mangetout'], ['yogurt', 'yoghurt'], ['greek yogurt', 'greek yoghurt'],
  ['fava beans', 'broad beans'], ['romaine lettuce', 'cos lettuce'], ['string beans', 'green beans'], ['chile flakes', 'chilli flakes'], ['crushed red pepper', 'chilli flakes'],
  ['beef broth', 'beef stock'], ['vegetable broth', 'vegetable stock'], ['broth', 'stock'], ['sour cream', 'soured cream'], ['light cream', 'single cream'],
  ['skim milk', 'skimmed milk'], ['sea salt flakes', 'flaky sea salt'], ['quick oats', 'porridge oats'], ['golden raisins', 'sultanas'], ['ground beef', 'beef mince'],
  ['ground turkey', 'turkey mince'], ['whole wheat flour', 'wholemeal flour'], ['bread flour', 'strong white bread flour'], ['navy beans', 'haricot beans'],
  ['lima beans', 'butter beans'], ['bok choy', 'pak choi'], ['canola oil', 'rapeseed oil'], ['italian parsley', 'flat-leaf parsley'], ['canadian bacon', 'back bacon'],
  ['napa cabbage', 'chinese leaf'], ['belgian endive', 'chicory'], ['corn kernels', 'sweetcorn'], ['green chile', 'green chilli'], ['snap peas', 'sugar snap peas'],
  ['gelatin', 'gelatine'], ['beets', 'beetroot'], ['pork tenderloin', 'pork fillet'], ['vanilla beans', 'vanilla pods'], ['phyllo dough', 'filo pastry'],
  ['ladyfingers', 'sponge fingers'], ['club soda', 'soda water'], ['bouillon cubes', 'stock cubes'], ['pepitas', 'pumpkin seeds'], ['powdered ginger', 'ground ginger'],
  ['freshly ground pepper', 'black pepper'], ['canned diced tomatoes', 'chopped tomatoes']];
const stillFlagged = TRANSLATED.filter(([us, uk]) => flagCount(fid([`2 tbsp ${us}`], [`2 tbsp ${uk}`])) !== 0);
check(`${TRANSLATED.length} US names for a British product read as one product and stay quiet`, stillFlagged.length === 0, stillFlagged.map(p => p.join(' -> ')).join('; '));
/* What a row must NOT do. Each pair is two products a cook might swap, or a word that
   means something else on the other side. A row that made any of these quiet would hide
   a substitution the converter is told never to make, and merge two things on the list. */
const SUBSTITUTES = [['granulated sugar', 'caster sugar'], ['half-and-half', 'single cream'], ['whipping cream', 'double cream'], ['cake flour', 'plain flour'],
  ['molasses', 'black treacle'], ['light corn syrup', 'golden syrup'], ['graham crackers', 'digestive biscuits'], ['raisins', 'sultanas'],
  ['collard greens', 'spring greens'], ['jalapeno', 'green chilli'], ['chili powder', 'chilli powder'], ['pie crust', 'shortcrust pastry'],
  ['skimmed milk', 'semi-skimmed milk'], ['plain yoghurt', 'greek yoghurt'], ['kale', 'chard'], ['beef mince', 'beef fillet']];
const madeQuiet = SUBSTITUTES.filter(([a, b]) => flagCount(fid([`2 tbsp ${a}`], [`2 tbsp ${b}`])) === 0);
check(`${SUBSTITUTES.length} substitutes are still flagged: a translation is one product under two names, never a swap`, madeQuiet.length === 0, madeQuiet.map(p => p.join(' -> ')).join('; '));
const stayApart = [['1 tbsp skimmed milk', '1 tbsp milk'], ['125 g yoghurt', '125 g natural yoghurt'], ['125 g greek yoghurt', '125 g natural yoghurt'], ['100 ml single cream', '100 ml double cream'],
  ['500 g beef mince', '500 g beef'], ['500 g beef mince', '500 g pork mince'], ['100 g wholemeal flour', '100 g plain flour'], ['100 g strong white bread flour', '100 g plain flour'],
  ['100 g dark brown sugar', '100 g light brown sugar'], ['100 g sultanas', '100 g raisins'], ['100 g mangetout', '100 g sugar snap peas'], ['100 g green beans', '100 g broad beans'],
  ['100 g haricot beans', '100 g butter beans'], ['200 ml stock', '200 ml chicken stock'], ['1 green chilli', '1 red chilli'], ['1 tsp ground ginger', '1 tsp fresh ginger'],
  ['100 g pork fillet', '100 g pork mince'], ['100 g chickpea flour', '100 g plain flour']];
const mergedRows = stayApart.filter(p => keysOf(...p).length !== 2);
check(`the shopping list keeps ${stayApart.length} near-neighbours as two rows`, mergedRows.length === 0, mergedRows.map(p => p.join(' + ')).join('; '));
/* A row named for a mince is the one deliberate re-key: "mince" is a preparation word
   ("garlic, minced"), so before a row said otherwise "beef mince" totalled with "beef". */
check('mince is a product once a row says so, and still a preparation for the rest', keysOf('500 g beef mince', '500 g minced beef', '300 g ground beef').length === 1
      && keysOf('7 garlic cloves, minced', '3 garlic cloves').length === 1 && keysOf('1 onion, minced', '1 onion').length === 1,
      JSON.stringify([keysOf('500 g beef mince', '500 g minced beef', '300 g ground beef'), keysOf('7 garlic cloves, minced', '3 garlic cloves')]));

/* The converter's own test set (converter/test-set.md, tests 6-8), written by earlier
   sessions for a different purpose: sources, the outputs recorded as correct, and the
   wrong outputs its "Fails if" lines name. None of it was written for this check. */
const T6s = ['1½ tsp ground cumin', '2-3 tbsp olive oil', '1 large onion, diced', '2 x 400g tins chopped tomatoes', '1 cup plain flour', '4 tbsp butter, melted', 'a knob of butter to finish', 'juice of 1 lemon', 'golden syrup or honey (2 tbsp)', 'salt and freshly ground pepper to taste'];
const T6r = ['1 1/2 tsp ground cumin', '2-3 tbsp olive oil', '1 onion (large), diced', '800 g chopped tomatoes (2 tins)', '120 g plain flour', '60 g butter, melted', '1 knob butter, to finish', '1 lemon, juiced', '2 tbsp golden syrup (or honey)', 'salt, to taste', 'black pepper, to taste'];
const T7s = ['2 scallions, sliced', 'a handful of cilantro', '1 red bell pepper, sliced', '2 tbsp neutral oil', '150 ml heavy cream', '3 tbsp plain yogurt', '1 tbsp all-purpose flour', '2 tbsp soy sauce'];
const T7r = ['2 spring onions, sliced', '1 handful coriander', '1 red pepper, sliced', '2 tbsp neutral oil', '150 ml double cream', '3 tbsp plain yoghurt', '1 tbsp plain flour', '2 tbsp soy sauce'];
const T8s = ['1 large eggplant, cubed', '1 can (400g) garbanzo beans, drained', '250g ground beef', '1 stalk lemongrass, bruised', '2 kaffir lime leaves', '1 tbsp Thai green curry paste', '1 can (400 ml) coconut milk', '1 tbsp fish sauce', 'a big handful of arugula to serve'];
const T8r = ['1 aubergine (large), cubed', '400 g chickpeas (1 tin), drained', '250 g beef mince', '1 stalk lemongrass, bruised', '2 kaffir lime leaves', '1 tbsp Thai green curry paste', '400 ml coconut milk (1 tin)', '1 tbsp fish sauce', '1 handful rocket, to serve'];
const swapLine = (arr, from, to) => arr.map(l => l === from ? to : l);
const hardOf = f => f.sourceOnly.concat(f.recipeOnly, f.matched.filter(m => m.check).map(m => m.check.why));
const newHard = (src, good, bad) => { const had = new Set(hardOf(fid(src, good))); return hardOf(fid(src, bad)).filter(x => !had.has(x)); };
check('the converter test set\'s recorded correct output for its vocabulary test (test 7) is quiet',
      flagCount(fid(T7s, T7r)) === 0, JSON.stringify(hardOf(fid(T7s, T7r))));
/* Written by earlier sessions, never tuned to this check, and the best evidence it has of a
   real US source: before the 29 Sep dictionary rows, test 6 had one hard difference and
   test 8 six. Test 6's is the converter's own "salt and freshly ground pepper" -> "black
   pepper" (the dictionary listed "ground black pepper" and not "ground pepper"), now a
   shaded note. Test 8's remaining two were ONE gap, and not a dictionary one: "a big
   handful of arugula" was read as a name, since the article was only taken off when the
   count word followed it directly, so the row was never looked up. Closed on 29 Sep
   (PR 1 of docs/PLAN-NEW-RECIPE-FLOW.md): shoppingLine skips size words after the article. */
const t6 = fid(T6s, T6r), t8 = fid(T8s, T8r);
check('    and for its first test (6) no hard difference, the pepper line being a shaded note',
      flagCount(t6) === 0 && t6.matched.some(m => m.note && /adds black/.test(m.note.why)), JSON.stringify(hardOf(t6)));
check('    and for its US-source test (8) no hard difference: "a big handful of arugula" is read as a handful, so it meets rocket',
      flagCount(t8) === 0 && JSON.stringify(hardOf(t8)) === '[]', JSON.stringify(hardOf(t8)));
const namedWrong = [
  ['a range collapsed to one figure (test 6, run 1)', T6s, T6r, swapLine(T6r, '2-3 tbsp olive oil', '2 tbsp olive oil')],
  ['a different product: oyster for soy sauce (test 7)', T7s, T7r, swapLine(T7r, '2 tbsp soy sauce', '2 tbsp oyster sauce')],
  ['an amount changed: 150 ml cream as 300 ml (test 7)', T7s, T7r, swapLine(T7r, '150 ml double cream', '300 ml double cream')],
  ['a line dropped: fish sauce (test 8)', T8s, T8r, T8r.filter(l => !/fish sauce/.test(l))],
  ['a line added that the source lacks (test 8)', T8s, T8r, T8r.concat(['1 tsp ground cumin'])]];
const namedMissed = namedWrong.filter(([, s, good, bad]) => newHard(s, good, bad).length === 0);
check('    and the wrong outputs it names that a comparison can see are each flagged, against its correct output', namedMissed.length === 0, namedMissed.map(x => x[0]).join('; '));
const soy = fid(T7s, swapLine(T7r, '2 tbsp soy sauce', '2 tbsp light soy sauce'));
check('    a recipe naming a product more specifically than its source (light soy sauce for soy sauce) is a soft note, listed, never a hard difference',
      flagCount(soy) === 0 && soy.matched.some(m => m.note && m.note.kind === 'specific' && /adds light/.test(m.note.why)), JSON.stringify(soy));
check('    and where the dictionary does not know the two as one product, the same addition is a hard difference',
      flagCount(fid(['1 tsp vanilla'], ['1 tsp vanilla extract'])) === 1, JSON.stringify(fid(['1 tsp vanilla'], ['1 tsp vanilla extract'])));
/* A tin in the UK, a can in the US: an adjective swap that was flagged whenever both
   sides wrote one (PR 1, decision 3). The lines are still shown as each side wrote them.
   Two kinds of pair, because they are decided differently: where the lines differ only
   by that word the key settles it (shoppingLine folds it), but a source that says more
   ("in syrup") against a recipe that says less is judged by the words, and there only
   the fold in fidelityItems makes it quiet. Found by mutating the fold away: the plain
   pair alone stayed green. */
const tinSrc = fid(['400 g tinned peach slices'], ['400 g canned peach slices']), canSrc = fid(['400 g canned peach slices'], ['400 g tinned peach slices']);
const tinChatty = fid(['400 g tinned peach slices in syrup'], ['400 g canned peach slices']), canChatty = fid(['400 g canned peach slices in syrup'], ['400 g tinned peach slices']);
check('tinned in the source against canned in the recipe is quiet, in either direction, and also when the source says more; both lines are shown as written',
      [tinSrc, canSrc, tinChatty, canChatty].every(f => flagCount(f) === 0)
      && tinSrc.matched[0].source === '400 g tinned peach slices' && tinSrc.matched[0].recipe === '400 g canned peach slices'
      && canChatty.matched[0].source === '400 g canned peach slices in syrup' && canChatty.matched[0].recipe === '400 g tinned peach slices',
      JSON.stringify([tinSrc, canSrc, tinChatty, canChatty].map(flagCount)));

/* ---- Reviewing a recipe as it comes in (PR 3 of the add-recipe plan, 29 Sep 2026) ----
   Four pure functions behind the add form's read-only review. Invented lines and
   links throughout, none in the library: lentil soup, jackfruit, sumac, quince, and
   example.test, a domain reserved so that it names no real site. */
const NOTE_RECON = '⚠️ Source note: the page could not be read, so this recipe was reconstructed from another page.';
const noteA = core.sourceNoteIn(`TITLE: Lentil soup\nNOTES:\n${NOTE_RECON}\nStir well.`);
check('sourceNoteIn finds a one-line note, and reads a reconstruction word on that same line',
      !!noteA && noteA.line === NOTE_RECON && noteA.reconstructed === true && /could not be read|reconstruct/i.test(noteA.why), JSON.stringify(noteA));
const noteB = core.sourceNoteIn('NOTES:\n⚠️ Source note: the page gives two different oven times.\nA line saying it was reconstructed, but not the note.');
check('a note without reconstruction words is not reconstructed, even when another line of the recipe has one',
      !!noteB && noteB.reconstructed === false && noteB.why === '', JSON.stringify(noteB));
check('no note is null, and a line that only mentions a source is not a note',
      core.sourceNoteIn('TITLE: x\nNOTES:\nStir well.') === null && core.sourceNoteIn('SOURCE: A source note is not this\nNOTES:\nx') === null && core.sourceNoteIn('') === null && core.sourceNoteIn(null) === null);
check('normalisedSourceUrl drops scheme, www, query, fragment and slash, and ignores case',
      ['HTTPS://www.Example.test/lentil-soup/?ref=x#top', 'http://example.test/lentil-soup//', 'example.test/lentil-soup'].every(u => core.normalisedSourceUrl(u) === 'example.test/lentil-soup'),
      JSON.stringify(['HTTPS://www.Example.test/lentil-soup/?ref=x#top', 'http://example.test/lentil-soup//', 'example.test/lentil-soup'].map(core.normalisedSourceUrl)));
check('a non-URL normalises to empty, so "Personal recipe" never matches another that says the same',
      ['Personal recipe', '', '   ', null, undefined, 'https://localhost/x'].every(u => core.normalisedSourceUrl(u) === ''),
      JSON.stringify(['Personal recipe', '', '   ', null, undefined, 'https://localhost/x'].map(core.normalisedSourceUrl)));
const hashLines = ['2 onions, sliced', '1 tsp sumac'];
check('linesHash is stable and 8 hex, pads a leading zero, and tells a changed line, a reorder and a join apart',
      core.linesHash(hashLines) === '5ef03332' && core.linesHash(hashLines.slice()) === core.linesHash(hashLines)
      && core.linesHash(['1 onion', 'tin 828']) === '0029281a' && core.linesHash([]) === '811c9dc5'
      && core.linesHash(['2 onions, sliced', '2 tsp sumac']) !== core.linesHash(hashLines)
      && core.linesHash(hashLines.slice().reverse()) !== core.linesHash(hashLines) && core.linesHash(['a', 'b']) !== core.linesHash(['ab']),
      [core.linesHash(hashLines), core.linesHash(['1 onion', 'tin 828'])].join(' '));
const revLib = [
  { id: 'a', title: 'Lentil soup', sourceUrl: 'https://www.example.test/lentil-soup/?ref=x#top', lines: ['2 onions, diced', '15 ml olive oil', '200 g red lentils'] },
  { id: 'b', title: 'Jackfruit curry', sourceUrl: 'https://example.test/jackfruit', lines: ['400 g jackfruit', '1 onion, sliced', '30 ml olive oil'] },
  { id: 'c', title: 'Plain toast', sourceUrl: '', lines: ['2 slices bread'] }];
const rev = o => core.newRecipeReview({ library: revLib, alias: null, isSettled: null, ...o });
const revNew = rev({ lines: ['1 onion', '300 g young jackfruit', '1 pinch sumac', '2 quinces'] });
const byKey = k => revNew.names.find(n => n.key === k) || {};
check('newRecipeReview marks names not in the library as new, with the aisle each lands in and Other flagged',
      byKey('onion').isNew === false && byKey('onion').aisle === 'Produce' && byKey('onion').other === false
      && byKey('sumac').isNew === true && byKey('sumac').other === true && byKey('sumac').aisle === 'Other'
      && revNew.knownCount === 1 && revNew.newCount === 3, JSON.stringify(revNew.names.map(n => [n.key, n.isNew, n.aisle])));
const ownLines = revLib[0].lines;
check('newRecipeReview leaves the edited recipe out of the library, so it never finds itself',
      rev({ lines: ownLines, recipeId: 'a' }).names.find(n => n.key === 'red lentil').isNew === true
      && rev({ lines: ownLines }).names.find(n => n.key === 'red lentil').isNew === false
      && rev({ lines: ownLines, recipeId: 'a' }).names.find(n => n.key === 'onion').isNew === false,
      JSON.stringify(rev({ lines: ownLines, recipeId: 'a' }).names.map(n => [n.key, n.isNew])));
/* The strict rule's own from/to is "the rarer folds into the commoner", which is the wrong
   question here: whichever way round it comes back, the NEW name is the one to fold. The
   second case makes the existing name the rarer, so the direction has to be put right. */
const flipped = core.newRecipeReview({ lines: ['200 g jackfruit', '1 tin jackfruit'], library: [{ id: 'x', title: 'X', sourceUrl: '', lines: ['1 tin young jackfruit'] }], alias: null, isSettled: null });
const bothKnown = core.newRecipeReview({ lines: ['1 onion'], library: [{ id: 'p', title: 'P', sourceUrl: '', lines: ['1 tin jackfruit'] }, { id: 'q', title: 'Q', sourceUrl: '', lines: ['1 tin young jackfruit'] }], alias: null, isSettled: null });
check('newRecipeReview pairs a new name with an existing one, new first, and only where exactly one side is new',
      revNew.sameAs.length === 1 && revNew.sameAs[0].from === 'young jackfruit' && revNew.sameAs[0].to === 'jackfruit' && revNew.sameAs[0].fromName === 'Young jackfruit'
      && flipped.sameAs.length === 1 && flipped.sameAs[0].from === 'jackfruit' && flipped.sameAs[0].to === 'young jackfruit'
      && bothKnown.sameAs.length === 0 && rev({ lines: ['300 g young jackfruit'], isSettled: () => true }).sameAs.length === 0,
      JSON.stringify([revNew.sameAs, flipped.sameAs, bothKnown.sameAs]));
const dupHit = rev({ lines: ['1 onion'], sourceUrl: 'HTTP://WWW.Example.test/lentil-soup' });
check('newRecipeReview finds a duplicate by normalised URL only: not by title, not for a non-URL, not the recipe itself',
      dupHit.duplicates.length === 1 && dupHit.duplicates[0].id === 'a' && dupHit.duplicates[0].title === 'Lentil soup'
      && rev({ lines: ['1 onion'], sourceUrl: 'https://other.test/lentil-soup-2' }).duplicates.length === 0
      && rev({ lines: ['1 onion'], sourceUrl: 'Personal recipe' }).duplicates.length === 0
      && rev({ lines: ['1 onion'], sourceUrl: '' }).duplicates.length === 0
      && rev({ lines: ['1 onion'], sourceUrl: 'https://example.test/jackfruit', recipeId: 'b' }).duplicates.length === 0
      && rev({ lines: ['1 onion'], sourceUrl: 'https://example.test/jackfruit' }).duplicates.map(d => d.id).join() === 'b',
      JSON.stringify(dupHit.duplicates));

/* changedHeaderKeys (PR 4): which header lines a save would change, by name, for BEFORE YOU
   SAVE. It asks withUpdatedHeaderLine, the function the save uses, so it cannot say something
   the save does not do. Invented recipe. */
const hkText = 'TITLE: Lentil Soup\nSOURCE: Blue Door Bakery\nSERVINGS: 4\nTAGS: course=Main, one pan\n\nGROUP a:\n1 onion\n\nSTAGE:\nMERGE a -> done: Cook [5 min]';
const hkFields = { title: 'Lentil Soup', source: 'Blue Door Bakery', sourceUrl: null, imageUrl: null, time: '', servings: 4, equipment: '', tags: { course: 'Main', keywords: ['one pan'] } };
check('changedHeaderKeys is empty when the fields agree with the text, so an untouched save changes nothing',
      core.changedHeaderKeys(hkText, hkFields).length === 0 && core.withUpdatedHeaderLines(hkText, hkFields) === hkText,
      JSON.stringify(core.changedHeaderKeys(hkText, hkFields)));
check('changedHeaderKeys names only the lines that differ, in header order',
      JSON.stringify(core.changedHeaderKeys(hkText, { ...hkFields, servings: 6, title: 'Smoky Lentil Soup' })) === '["TITLE","SERVINGS"]'
      && JSON.stringify(core.changedHeaderKeys(hkText, { ...hkFields, tags: { course: 'Main', keywords: ['one pan', 'slow'] } })) === '["TAGS"]'
      && JSON.stringify(core.changedHeaderKeys(hkText, { ...hkFields, source: 'Blue Door' })) === '["SOURCE"]',
      JSON.stringify(core.changedHeaderKeys(hkText, { ...hkFields, servings: 6, title: 'Smoky Lentil Soup' })));
const hkVariants = [{}, { time: '35 min' }, { sourceUrl: 'https://example.test/x' }, { imageUrl: 'https://example.test/i.jpg' }, { servings: null },
  { equipment: '20 cm tin' }, { tags: { course: '', keywords: [] } }, { title: 'X', source: 'Y', servings: 2 }];
check('changedHeaderKeys counts a line that would be added or dropped, not one that stays missing, and agrees with the save on every variant',
      JSON.stringify(core.changedHeaderKeys(hkText, { ...hkFields, time: '35 min' })) === '["TIME"]'
      && JSON.stringify(core.changedHeaderKeys(hkText, { ...hkFields, servings: null })) === '["SERVINGS"]'
      && core.changedHeaderKeys(hkText, { ...hkFields, imageUrl: '', equipment: '' }).length === 0
      && hkVariants.every(v => (core.changedHeaderKeys(hkText, { ...hkFields, ...v }).length > 0) === (core.withUpdatedHeaderLines(hkText, { ...hkFields, ...v }) !== hkText)),
      JSON.stringify(hkVariants.map(v => core.changedHeaderKeys(hkText, { ...hkFields, ...v }))));

/* PR 5: what a recorded comparison is of, and what it found. Invented recipe and lines. */
const pvText = (tags, extra, spice) => ['TITLE: Lentil Soup', 'SOURCE: Blue Door Bakery', 'SERVINGS: 4', ...extra, 'TAGS: ' + tags, '',
  'GROUP a:', '2 onions, diced', spice, '200 g red lentils', '', 'STAGE:', 'MERGE a -> done: Simmer until soft [20 min]'].join('\n');
const pvLinesOf = t => { const p = core.parseRecipe(t); const un = new Set((p.unread || []).map(u => u.line)); return p.groups.flatMap(g => g.items).filter(l => !un.has(l)); };
const pvBase = pvText('course=Main, one pan', [], '3 tsp ground caraway');
const pvKeyword = pvText('course=Main, one pan, slow', ['TIME: 35 min'], '3 tsp ground caraway').replace('Simmer until soft', 'Simmer gently until soft');
const pvLine = pvBase.replace('200 g red lentils', '250 g red lentils');
check('linesHash changes when an ingredient line changes, and not when a keyword, a header or a step does',
      /^[0-9a-f]{8}$/.test(core.linesHash(pvLinesOf(pvBase)))
      && core.linesHash(pvLinesOf(pvBase)) === core.linesHash(pvLinesOf(pvKeyword))
      && core.linesHash(pvLinesOf(pvBase)) !== core.linesHash(pvLinesOf(pvLine)),
      [core.linesHash(pvLinesOf(pvBase)), core.linesHash(pvLinesOf(pvKeyword)), core.linesHash(pvLinesOf(pvLine))].join(' '));
const pvLines = pvLinesOf(pvBase);
const pvCheck = { at: '2026-09-29T10:00:00.000Z', route: 'function', hard: 3, soft: 1, sourceLines: 9, linesHash: core.linesHash(pvLines) };
const pvFresh = core.sourceCheckStatus(pvCheck, pvLines);
const pvStale = core.sourceCheckStatus(pvCheck, pvLinesOf(pvLine));
check('sourceCheckStatus says fresh for the lines that were compared, stale once one has changed, and none for nothing usable',
      pvFresh.state === 'fresh' && pvFresh.hard === 3 && pvFresh.soft === 1 && pvFresh.sourceLines === 9 && pvFresh.route === 'function' && pvFresh.at === pvCheck.at
      && pvStale.state === 'stale' && pvStale.hard === 3
      && [null, undefined, {}, 'text', 5, { linesHash: '' }, { linesHash: 5 }].every(c => core.sourceCheckStatus(c, pvLines).state === 'none'),
      JSON.stringify([pvFresh, pvStale]));
/* VALIDATE INGREDIENT LIST (30 Sep 2026): the household's acceptance is carried on a fresh check and on
   nothing else, so an edited recipe loses it with its comparison. */
const pvValidated = { ...pvCheck, validated: '2026-09-30T12:00:00.000Z' };
check('sourceCheckStatus carries the validation on a fresh check only, and none when there is none',
      core.sourceCheckStatus(pvValidated, pvLines).validated === pvValidated.validated && core.sourceCheckStatus(pvValidated, pvLines).state === 'fresh'
      && core.sourceCheckStatus(pvValidated, pvLinesOf(pvLine)).validated === null && core.sourceCheckStatus(pvCheck, pvLines).validated === null
      && core.sourceCheckStatus({ ...pvCheck, validated: 5 }, pvLines).validated === null,
      JSON.stringify([core.sourceCheckStatus(pvValidated, pvLines), core.sourceCheckStatus(pvValidated, pvLinesOf(pvLine))]));
const fcOf = (src, rec) => core.fidelityCounts(core.sourceFidelity(src, rec));
/* The caraway pair counted as the same until 29 Sep, when the household set "ground" apart where the
   shopping list keeps it (ground almonds are not almonds): caraway seeds against ground caraway is now
   one of the four. */
check('fidelityCounts is the "N to look at": lines on one side only and pairs that differ, one flagged group counting once',
      JSON.stringify(fcOf(['2 onions', '200 g red lentils', '3 tsp caraway', '400 g tin tomatoes'], ['2 onions', '250 g red lentils', '3 tsp ground caraway', '1 leek'])) === '{"hard":4,"soft":0}'
      && JSON.stringify(fcOf(['2 onions', '200 g red lentils'], ['2 onions', '200 g red lentils'])) === '{"hard":0,"soft":0}'
      && JSON.stringify(fcOf(['200 g red lentils'], ['100 g red lentils', '50 g red lentils'])) === '{"hard":1,"soft":0}',
      JSON.stringify(fcOf(['200 g red lentils'], ['100 g red lentils', '50 g red lentils'])));
check('fidelityCounts counts the shaded notes apart, and they are never in the count to look at',
      JSON.stringify(fcOf(['7 ml soy sauce', '2 onions'], ['7 ml light soy sauce', '2 onions'])) === '{"hard":0,"soft":1}'
      && JSON.stringify(fcOf(['7 ml soy sauce', '2 onions'], ['7 ml light soy sauce', '2 onions', '1 leek'])) === '{"hard":1,"soft":1}',
      JSON.stringify(fcOf(['7 ml soy sauce', '2 onions'], ['7 ml light soy sauce', '2 onions', '1 leek'])));

/* Six rows, not five: the leek under the misspelt GROUP x-y is still read, into
   the group above; only the GROUP line itself is reported as read past. */
const { remeasure } = require(path.join(ROOT, 'tools', 'remeasure.js'));
const rm = remeasure({ recipes: [
  { title: 'A', syntax: 'TITLE: A\nGROUP a:\n200 g curly kale\n3 tbsp honey or golden syrup\n1 tsp za\'atar\nSTAGE:\nMERGE a -> b: Cook [5 min]' },
  { title: 'B', syntax: 'TITLE: B\nGROUP a:\n100 g kale\n2 onions\nGROUP x-y:\n1 leek\nSTAGE:\nMERGE a -> b: Cook [5 min]' }],
  aliases: [{ kind: 'ingredient', alias: 'large onions', canonical: 'onion' }] });
check('tools/remeasure.js totals an export as the list does, and reports what to look at',
      rm.recipes === 2 && rm.rows === 6 && rm.wordMatches === 0 && JSON.stringify(rm.splits) === '[{"from":"curly kale","to":"kale"}]'
      && rm.shape.length === 1 && rm.shape[0].line === '3 tbsp honey or golden syrup' && rm.unread.map(u => u.line).join('|') === 'GROUP x-y:'
      && rm.other.includes("Za'atar"), JSON.stringify(rm));

check('stock files under Pantry before chicken can claim it', only('500 ml chicken stock').category === 'Pantry', only('500 ml chicken stock').category);

/* ---- Durations as the flow and the timeline show them (issue #86, 11 Oct 2026) ---- */
const dur = b => core.formatDuration(core.extractStepDuration(`Step [${b}]`).duration);
const durs = ['20 sec', '30-45 sec', '1 min', '90 sec', '8 min', '4–5 min', '1 hr 30', '2 hr', 'instant', 'overnight', 'until done'].map(dur);
check('durations read in seconds under a minute, minutes under an hour, and hours above',
      JSON.stringify(durs) === JSON.stringify(['20 sec', '30–45 sec', '1 min', '1.5 min', '8 min', '4 min–5 min', '1h 30m', '2h', 'instant', 'overnight', 'until done']),
      JSON.stringify(durs));
const mins = [1/3, 0.999, 59.97, 119.6, 60, 0].map(core.formatMinutesForDisplay);
check('an hour or more is rounded before it is split: never "1h 60m"; 59.97 minutes is an hour',
      JSON.stringify(mins) === JSON.stringify(['20 sec', '1 min', '1h', '2h', '1h', '0 sec']), JSON.stringify(mins));

/* ---- FROZEN (issue #90, 11 Oct 2026) ----
   A line that says frozen goes to Frozen, before any other keyword can claim it, and keeps its name, so its tick stays.
   A household's own aisle still wins. Made-up lines. */
const fzLines = ['200 g frozen peas', '400 g frozen chicken thighs', '150 g peas', '300 g frozen spinach'].map(raw => ({ recipeTitle: 'F', raw }));
const fz = core.aggregateShoppingLines(fzLines, null);
const fzRow = k => fz.find(i => i.key === k) || {};
check('a line that says frozen is shopped under Frozen, even when another aisle\'s word is in it, and keeps its name',
      fzRow('frozen pea').category === 'Frozen' && fzRow('frozen chicken thigh').category === 'Frozen' && fzRow('frozen spinach').category === 'Frozen'
      && fzRow('pea').category !== 'Frozen' && fzRow('frozen pea').name === 'Frozen peas', JSON.stringify(fz.map(i => [i.key, i.category, i.name])));
const fzSet = core.aggregateShoppingLines(fzLines, null, k => (k === 'frozen pea' ? 'Pantry' : k === 'pea' ? 'Frozen' : undefined));
check('a household\'s own aisle wins over the word frozen, and Frozen can be chosen for anything',
      (fzSet.find(i => i.key === 'frozen pea') || {}).category === 'Pantry' && (fzSet.find(i => i.key === 'pea') || {}).category === 'Frozen'
      && core.aisleOverrideMap([{ name: 'ice cream', aisle: 'Frozen' }]).get('ice cream') === 'Frozen');
check('Frozen is the last aisle, and the last section of the shopping list',
      core.INGREDIENT_AISLES[core.INGREDIENT_AISLES.length - 1] === 'Frozen' && core.SHOPPING_CATEGORIES[core.SHOPPING_CATEGORIES.length - 1].name === 'Frozen');

/* ---- The stub answers every query the app makes (12 Oct 2026, the October review, F47) ----
   test/stub.js stands in for supabase-js, and a method the app chains that the stub lacks is a TypeError, which queueWrite
   can swallow into a toast while the suite stays green: that is how a missing update() once hid a broken diary save
   (stub.js says so). So every method the app chains onto sb.from(…), before and after update()/delete(), and onto
   sb.storage.from(…), is listed from index.html's source and looked for in the stub. A query built in steps
   (`let q = sb.from(t).delete()…; q = q.not(…)`) is followed through its variable. */
{
  const stubSrc = fs.readFileSync(path.join(ROOT, 'test', 'stub.js'), 'utf8');
  const methodsOf = fn => {
    const at = stubSrc.indexOf('function ' + fn + '(');
    const body = at < 0 ? '' : stubSrc.slice(at, stubSrc.indexOf('\n  }\n', at));
    return new Set([...body.matchAll(/^\s+(\w+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]));
  };
  const stub = { read: methodsOf('builder'), filter: methodsOf('filterChain'), storage: methodsOf('storageBucket') };
  const closeParen = i => {
    for (let d = 0; i < pageSrc.length; i++) {
      const c = pageSrc[i];
      if (c === '(') d++;
      else if (c === ')') { if (--d === 0) return i + 1; }
      else if (c === "'" || c === '"' || c === '`') { for (i++; i < pageSrc.length && pageSrc[i] !== c; i++) if (pageSrc[i] === '\\') i++; }
    }
    return i;
  };
  const used = { read: new Set(), filter: new Set(), storage: new Set() };
  const follow = (i, phase) => {
    for (;;) {
      const m = /^\s*\.\s*([A-Za-z_]\w*)\s*\(/.exec(pageSrc.slice(i, i + 200));
      if (!m) return phase;
      used[phase].add(m[1]);
      if (phase === 'read' && (m[1] === 'update' || m[1] === 'delete')) phase = 'filter';
      i = closeParen(i + m[0].length - 1);
    }
  };
  const builtIn = {};
  for (const m of pageSrc.matchAll(/(?:\b(?:let|const)\s+(\w+)\s*=\s*)?\bsb\s*\.\s*(storage\s*\.\s*)?from\s*\(/g)) {
    const end = follow(closeParen(m.index + m[0].length - 1), m[2] ? 'storage' : 'read');
    if (m[1]) builtIn[m[1]] = end;
  }
  /* …and through a function that hands one back (sourcePhotoStore() is sb.storage.from(SOURCE_PHOTO_BUCKET)). */
  for (const m of pageSrc.matchAll(/function\s+(\w+)\s*\(\)\s*\{\s*return\s+sb\s*\.\s*(storage\s*\.\s*)?from\s*\(/g))
    for (const c of pageSrc.matchAll(new RegExp('\\b' + m[1] + '\\s*\\(\\s*\\)', 'g'))) follow(c.index + c[0].length, m[2] ? 'storage' : 'read');
  for (const [v, phase] of Object.entries(builtIn))
    for (const m of pageSrc.matchAll(new RegExp('\\b' + v + '\\s*=\\s*' + v + '\\b', 'g'))) follow(m.index + m[0].length, phase);
  const lacking = Object.entries(used).flatMap(([k, set]) => [...set].filter(n => !stub[k].has(n)).map(n => k + ':' + n));
  check('the stub defines every query method the app chains (' + Object.entries(used).map(([k, v]) => k + ' ' + v.size).join(', ') + ')',
        used.read.size >= 8 && used.filter.has('eq') && used.filter.has('not') && used.storage.size >= 3 && lacking.length === 0, lacking.join(', '));
}

/* ---- Preparation as steps (#88, 13 Oct 2026, docs/PLAN-PREP-STEPS.md) ----
   Made-up lines only, each checked against the library when the plan was written. */
{
  const ps = l => (core.prepStepFor(l) || {}).label || null;
  const seen = {
    '2 leeks, thinly sliced': 'Thinly slice the leeks', '3 carrots, peeled and diced': 'Peel and dice the carrots',
    '400 g potatoes, cut into 2cm chunks': 'Cut the potatoes into 2cm chunks', '1 lemon, zest only': 'Zest the lemon',
    '1 bunch parsley, leaves only': 'Pick the parsley leaves', '2 eggs, beaten': 'Beat the eggs',
    '1 swede, peeled and roughly chopped': 'Peel and roughly chop the swede',
    '50 g butter, softened': null, 'black pepper, to taste': null, '500 ml vegetable stock': null,
    '2 onions, chopped/crushed': null, '150 g grated cheddar': null, '100 g rice, divided': null, '1 tin beans, blitzed': null };
  const wrong = Object.entries(seen).filter(([l, want]) => ps(l) !== want).map(([l, want]) => `${l} → ${ps(l)} (want ${want})`);
  check('a line\'s preparation reads as a step only from the fixed table; ahead-of-time, notes and unknown words give none (#88)',
        wrong.length === 0, wrong.join('; '));
  const veg = 'TITLE: X\nSERVINGS: 2\n\nGROUP veg:\n2 carrots, diced\n2 celery sticks, diced\n1 onion\nGROUP liq:\n500 ml stock\n\n' +
    'STAGE:\nMERGE veg -> soft: Soften [10 min]\nSTAGE:\nMERGE soft, liq -> soup: Simmer [20 min]';
  const p1 = core.parseRecipe(veg);
  const before = JSON.stringify(p1);
  const d1 = core.withPrepSteps(p1);
  check('    working the steps out leaves the recipe it was given exactly as it was', JSON.stringify(p1) === before);
  const plain = core.parseRecipe('TITLE: Y\nSERVINGS: 2\n\nGROUP a:\n200 g rice\nGROUP b:\n400 ml water\n\nSTAGE:\nMERGE a -> a2: Rinse [instant]\n' +
    'STAGE:\nMERGE a2, b -> c: Simmer [12 min]');
  const plainCols = core.computeColumns(plain.groups, plain.stages);
  const plainD = core.withPrepSteps(plain);
  const colours = plainCols.columns.map(col => col.map(b => b.outputHandle + ':' + b.color).join(',')).join(' | ');
  check('    a recipe with nothing to read lays out exactly as before, its colours included',
        plainD === plain && JSON.stringify(core.computeColumns(plainD.groups, plainD.stages)) === JSON.stringify(plainCols)
        && colours === `a2:#111,b:#222 | c:${MERGE_COLOR}`, colours);
  const lay = core.computeColumns(d1.groups, d1.stages);
  const rowsSame = JSON.stringify(core.buildRows(d1.groups).rows) === JSON.stringify(core.buildRows(p1.groups).rows);
  const first = lay.columns[0].map(b => b.outputHandle + (b.prep ? ':prep:' + b.label : '') + ':' + b.color).join(',');
  check('    rows never move; prep in the first stage gets a column of its own; same-step neighbours share one box in the group\'s colour',
        rowsSame && !lay.errors.length && lay.columns.length === 3
        && first === `veg~1~p:prep:Dice the carrots and celery sticks:#111,veg~2:#111,liq:#222`
        && lay.columns[1][0].outputHandle === 'soft' && lay.columns[1][0].color === '#111', JSON.stringify({ rowsSame, errors: lay.errors, first }));
  const later = core.parseRecipe('TITLE: Z\nSERVINGS: 2\n\nGROUP base:\n1 onion\nGROUP top:\n2 leeks, thinly sliced\n\n' +
    'STAGE:\nMERGE base -> soft: Soften [10 min]\nSTAGE:\nMERGE soft, top -> done: Stir in [5 min]');
  const dl = core.withPrepSteps(later);
  const ll = core.computeColumns(dl.groups, dl.stages);
  const quick = core.parseRecipe('TITLE: Q\nSERVINGS: 2\n\nGROUP base:\n1 onion\nGROUP top:\n2 leeks, thinly sliced\n\n' +
    'STAGE:\nMERGE base -> soft: Tip in [instant]\nSTAGE:\nMERGE soft, top -> done: Stir in [5 min]');
  const dq = core.withPrepSteps(quick);
  check('    a step later in the recipe sits beside the step before it; after an all-instant stage it gets a column of its own',
        !ll.errors.length && ll.columns.length === 2 && ll.columns[0].some(b => b.prep && b.label === 'Thinly slice the leeks')
        && dq.stages.length === 3 && dq.stages[1].every(op => op.prep), JSON.stringify({ ll: ll.columns.length, dq: dq.stages.length }));
  const broken = core.parseRecipe('TITLE: B\nSERVINGS: 2\n\nGROUP a:\n2 leeks, sliced\nGROUP a:\n1 onion\n\nSTAGE:\nMERGE a -> b: Cook [5 min]');
  check('    a recipe with layout errors comes back as it is', core.withPrepSteps(broken) === broken);
  check('    every ingredient line is still there, once, in order, so the shopping list reads the same',
        JSON.stringify(d1.groups.flatMap(g => g.items)) === JSON.stringify(p1.groups.flatMap(g => g.items))
        && JSON.stringify(dl.groups.flatMap(g => g.items)) === JSON.stringify(later.groups.flatMap(g => g.items)));
}

// #87 FINISH TOGETHER: a short dish starts late enough to be ready with the long one.
{
  const tl = t => { const p = core.parseRecipe(t); return core.computeTimeline(p.groups, p.stages); };
  const long = tl('TITLE: L\nSERVINGS: 2\n\nGROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: Roast [60 min]');
  const short = tl('TITLE: S\nSERVINGS: 2\n\nGROUP a:\n100 g millet\n\nSTAGE:\nMERGE a -> b: Bubble gently [15 min]');
  const fin = core.lineUpTimelines([long, short, null], 'finish');
  const sta = core.lineUpTimelines([long, short, null], 'start');
  check('lineUpTimelines: FINISH TOGETHER starts a 15-minute dish 45 minutes after a 60-minute one; both end together',
        fin.totalSpan === 60 && fin.lanes[0].offset === 0 && fin.lanes[1].offset === 45
        && fin.lanes[1].steps[0].start === 45 && fin.lanes[1].steps[0].end === 60, JSON.stringify(fin.lanes.map(l => l && l.offset)));
  check('    START TOGETHER starts everything at 0, as before',
        sta.lanes[0].offset === 0 && sta.lanes[1].offset === 0 && sta.lanes[1].steps[0].start === 0, JSON.stringify(sta.lanes.map(l => l && l.offset)));
  check('    a dish with no timings stays without a lane', fin.lanes[2] === null && sta.lanes[2] === null);
  check('    fixed timings are not ABOUT', fin.about === false);
  const open = tl('TITLE: O\nSERVINGS: 2\n\nGROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: Roast [45 min]\n\nSTAGE:\nMERGE b -> c: Rest [until set]');
  check('    a longest dish with an open-ended step makes the start times ABOUT', core.lineUpTimelines([open, short], 'finish').about === true);
}

// #87: what a recipe asks to be served with, and which Side recipes would do (docs/PLAN-SIDES.md §4.2–4.3).
{
  const R = body => core.parseRecipe('TITLE: T\nSERVINGS: 2\n\n' + body);
  const items = body => core.servingCalls(R(body)).map(c => c.where + ':' + c.items.join('|'));
  check('servingCalls: an ingredient line ending "to serve", "for serving", "to accompany" or "on the side" is heard, by its shopping name',
        JSON.stringify(items('GROUP a:\n2 flatbreads, to serve\n100 g freekeh, to accompany\npickled shallots, for serving\ncharred leeks on the side\n1 swede\n\nSTAGE:\nMERGE a -> b: Mix [2 min]'))
        === JSON.stringify(['ingredient:flatbread', 'ingredient:freekeh', 'ingredient:pickled shallot', 'ingredient:charred leek']),
        JSON.stringify(items('GROUP a:\n2 flatbreads, to serve\n100 g freekeh, to accompany\npickled shallots, for serving\ncharred leeks on the side\n1 swede\n\nSTAGE:\nMERGE a -> b: Mix [2 min]')));
  const prose = items('GROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: Bake, then serve over freekeh or jacket potatoes [40 min]\n\nSTEPS:\nHeat the oven. Serve it alongside flatbreads; keep warm.\n\nNOTES:\nGood accompanied by a bed of buttered greens, pickles and/or slaw.\nWith charred leeks on the side.\nWarm flatbreads to accompany.');
  check('    a MERGE label, STEPS and NOTES are heard; "or", "and/or" and commas make alternatives; "a bed of" is dropped; it stops at punctuation',
        JSON.stringify(prose) === JSON.stringify(['step:freekeh|jacket potatoes', 'step:flatbreads', 'notes:buttered greens|pickles|slaw', 'notes:charred leeks', 'notes:warm flatbreads']),
        JSON.stringify(prose));
  const quiet = items('GROUP a:\n1 swede, enough to serve 4\n\nSTAGE:\nMERGE a -> b: Serve immediately on warmed plates [2 min]\n\nSTEPS:\nThis is enough to serve 4. Serves 6.\n\nNOTES:\nServe hot.');
  check('    "to serve 4", "serves 6", "serve immediately", "serve hot" and "serve on warmed plates" are not heard', quiet.length === 0, JSON.stringify(quiet));
  check('    "crusty bread for dipping": what follows "for" or "to" is why, not what',
        JSON.stringify(items('GROUP a:\n1 swede\n\nSTAGE:\nMERGE a -> b: Serve with crusty flatbreads for dipping [2 min]')) === '["step:crusty flatbreads"]');

  const sides = [
    { id: 's-pilaf', title: 'Freekeh pilaf', course: 'Side', keywords: [] },
    { id: 's-plain', title: 'Plain freekeh', course: 'Side', keywords: [] },
    { id: 's-jacket', title: 'Jacket potato', course: 'Side', keywords: [] },
    { id: 's-pot', title: 'Jewelled grain pot', course: 'Side', keywords: ['Flatbread'] },
    { id: 'm-pud', title: 'Freekeh pudding', course: 'Dessert', keywords: [] },
    { id: 'self', title: 'Smoky freekeh', course: 'Side', keywords: [] },
  ];
  const m = (list, self) => core.matchSides([{ items: list, where: 'step' }], sides, self).map(x => x.sideId + ':' + x.score);
  check('matchSides: 3 when the item is the title (descriptors like "plain" dropped), 2 when every word is in it, 1 on the last word; best first',
        JSON.stringify(m(['steamed freekeh'])) === '["s-plain:3","s-pilaf:1"]' && JSON.stringify(m(['freekeh pilaf'])) === '["s-pilaf:3"]'
        && JSON.stringify(m(['pilaf freekeh'])) === '["s-pilaf:2","s-plain:1"]', JSON.stringify([m(['steamed freekeh']), m(['freekeh pilaf']), m(['pilaf freekeh'])]));
  check('    plurals fold ("jacket potatoes" is "Jacket potato"); a keyword matches ("flatbreads" finds the grain pot tagged Flatbread)',
        JSON.stringify(m(['jacket potatoes'])) === '["s-jacket:3"]' && JSON.stringify(m(['flatbreads'])) === '["s-pot:3"]', JSON.stringify([m(['jacket potatoes']), m(['flatbreads'])]));
  check('    only course=Side recipes, never the recipe itself, at most two per item and three per dish',
        m(['pudding']).length === 0 && JSON.stringify(m(['smoky freekeh'])) === '["self:3","s-pilaf:1"]'
        && !m(['smoky freekeh'], 'self').some(x => x.startsWith('self')) && m(['freekeh']).length === 2
        && m(['freekeh', 'flatbreads', 'jacket potatoes']).length === 3, JSON.stringify([m(['pudding']), m(['smoky freekeh']), m(['smoky freekeh'], 'self'), m(['freekeh', 'flatbreads', 'jacket potatoes'])]));
  check('    a phrase that matches no side offers nothing ("pickled shallot")', m(['pickled shallot']).length === 0);
  check('    the shopping list names "to accompany" and "on the side" lines as before: no tick is re-keyed',
        core.shoppingKeyForName('freekeh, to accompany') === 'freekeh' && core.shoppingKeyForName('buttered freekeh on the side') === 'buttered freekeh on the side'
        && core.shoppingKeyForName('pickled shallots for serving') === 'pickled shallots for serving');
}

// #142 OFTEN WITH: what a recipe has been grouped with before (docs/PLAN-SIDES.md §9.3).
{
  const G = (dateIso, ...recipeIds) => ({ dateIso, recipeIds });
  const gw = (id, groups) => core.groupedWith(id, groups).map(x => x.id + ':' + x.times);
  const groups = [G('2026-08-01', 'm', 'old'), G('2026-08-10', 'm', 'twice'), G('2026-08-20', 'm', 'twice'), G('2026-08-25', 'm', 'new'), G('2026-08-26', 'x', 'y')];
  check('groupedWith: grouped on two days comes before once; a tie goes to the more recent day; a group without it adds nothing',
        JSON.stringify(gw('m', groups)) === '["twice:2","new:1","old:1"]', JSON.stringify(gw('m', groups)));
  check('    two groups on one day are one pairing, and a recipe listed twice in one group counts once; never itself',
        JSON.stringify(gw('m', [G('2026-08-01', 'm', 'p', 'p', 'm'), G('2026-08-01', 'm', 'p')])) === '["p:1"]',
        JSON.stringify(gw('m', [G('2026-08-01', 'm', 'p', 'p', 'm'), G('2026-08-01', 'm', 'p')])));
  check('    it works both ways, and no groups gives nothing',
        JSON.stringify(gw('old', groups)) === '["m:1"]' && gw('m', []).length === 0 && gw('m', null).length === 0);
  check('    each partner says the last day they were grouped',
        core.groupedWith('m', groups).find(x => x.id === 'twice').last === '2026-08-20');
}

const failed = checks.filter(c => !c.pass).length;
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
