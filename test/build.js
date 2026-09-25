/* Builds a runnable copy of the app: swaps the two CDN <script> tags (both
   blocked in this sandbox) for the local stub, and injects canned data. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, 'app-under-test.html');

const HOUSE = '286a8a12-c12a-4b83-afbc-0912533f6b1c';
const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const R3 = '33333333-3333-4333-8333-333333333334';

const { FIXTURE_NOW } = require('./fixture-time');
/* Dates come from the frozen fixture clock, never from the real one — see
   fixture-time.js for the Thursday that made this necessary. */
function iso(offsetDays){
  const d = new Date(FIXTURE_NOW); d.setHours(0,0,0,0); d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

const data = {
  household_members: [{ household_id: HOUSE }],
  household_settings: [{ household_id: HOUSE, week_start_day: 5, dark_mode: 'system' }],
  aliases: [],
  recipes: [
    { id: R1, household_id: HOUSE, title: 'Test Pasta', source: 'Test Kitchen', source_url: null,
      image_url: null, time_text: '30 min', servings: 4, favourite: false, equipment: '',
      tags: { course: 'Main', keywords: ['Pasta'] }, date_added: iso(-30),
      syntax: [
        'TITLE: Test Pasta','SOURCE: Test Kitchen','TIME: 30 min','SERVINGS: 4','TAGS: course=Main, Pasta','',
        'GROUP pasta:','300 g dried pasta','',
        'GROUP sauce:','500 g chopped tomatoes','2 cloves garlic, minced','1 tbsp olive oil','',
        'STAGE:','MERGE pasta -> cooked: Boil until al dente [10 min]','',
        'STAGE:','MERGE sauce -> simmered: Simmer gently [12 min]','',
        'STAGE:','MERGE cooked, simmered -> done: Toss together and serve [instant]'
      ].join('\n') },
    { id: R2, household_id: HOUSE, title: 'Test Soup', source: 'Test Kitchen', source_url: null,
      image_url: null, time_text: '45 min', servings: 2, favourite: true, equipment: '',
      tags: { course: 'Main', keywords: ['Veg'] }, date_added: iso(-10),
      syntax: [
        'TITLE: Test Soup','SOURCE: Test Kitchen','TIME: 45 min','SERVINGS: 2','TAGS: course=Main, Veg','',
        'GROUP base:','1 kg chopped tomatoes','1 onion, finely diced','',
        'GROUP finish:','2 cloves garlic','',
        'STAGE:','MERGE base -> softened: Sweat down [15 min]','',
        'STAGE:','MERGE softened, finish -> soup: Blend smooth [5 min]'
      ].join('\n') },
    /* R3 exists for the image path, which nothing else in the fixture
       exercises: R1 and R2 both have image_url null and no IMAGE: line.
       Its date_added is deliberately OLD — the library sorts by recency by
       default, and three tests click `.rcard` unqualified, so a newer
       fixture would silently retarget them.

       image_url and the IMAGE: line agree here, which is the state a
       correct save leaves behind. */
    { id: R3, household_id: HOUSE, title: 'Test Traybake', source: 'Test Kitchen', source_url: 'https://example.com/traybake',
      image_url: 'https://cdn.example.com/traybake.jpg', time_text: '50 min', servings: 4, favourite: false, equipment: '',
      tags: { course: 'Main', keywords: ['Batch'] }, date_added: iso(-60),
      syntax: [
        'TITLE: Test Traybake','SOURCE: Test Kitchen','SOURCE_URL: https://example.com/traybake',
        'IMAGE: https://cdn.example.com/traybake.jpg','TIME: 50 min','SERVINGS: 4','TAGS: course=Main, Batch','',
        'GROUP veg:','500 g potatoes','1 onion','',
        'STAGE:','MERGE veg -> roasted: Roast until golden [40 min]'
      ].join('\n') }
  ],
  /* One of each kind the diary now holds: a cooked recipe with a meal type,
     a cooked recipe without one (still legitimate — H1 is an enrichment),
     and an ad-hoc entry with no recipe at all. */
  recipe_logs: [
    { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', household_id: HOUSE, recipe_id: R1, cooked_on: iso(-7), meal_type: 'dinner', note: null, title: null },
    { id: 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa', household_id: HOUSE, recipe_id: R2, cooked_on: iso(-3), meal_type: null, note: null, title: null },
    { id: 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa', household_id: HOUSE, recipe_id: null, cooked_on: iso(-3), meal_type: 'lunch', note: null, title: 'Fish and chips' },
    /* A title that a spreadsheet would evaluate, and one that would break
       out of an HTML attribute. Both are things a person can genuinely
       type into the ad-hoc entry box, and without them in the data the
       checks for formula neutralisation and attribute escaping pass
       vacuously — there is nothing for them to catch. */
    { id: 'aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa', household_id: HOUSE, recipe_id: null, cooked_on: iso(-2), meal_type: 'snack', note: null, title: '=1+1' },
    { id: 'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa', household_id: HOUSE, recipe_id: null, cooked_on: iso(-2), meal_type: null, note: null, title: 'x" onfocus="alert(1)' }
  ],
  keywords: [{ name: 'Pasta' }, { name: 'Veg' }, { name: 'Batch' }],
  planner_days: [
    { household_id: HOUSE, plan_date: iso(0), is_blank: false, recipe_ids: [R1], servings: [] },
    { household_id: HOUSE, plan_date: iso(1), is_blank: false, recipe_ids: [R1, R2], servings: [] }
  ],
  shortlist_items: [{ id: '33333333-3333-4333-8333-333333333333', household_id: HOUSE, text: 'Bolognese', recipe_id: null, date_added: iso(-2) }],
  meal_groups: [{ id: '44444444-4444-4444-8444-444444444444', household_id: HOUSE,
                  date_iso: iso(1), recipe_ids: [R1, R2], name: '' }],
  ingredient_swaps: [],
  /* Two ticks in the name-only keys PR 6b introduced, and two in the old
     "name|unit" ones it retired: the old ones are purged at start-up. The
     kept ones name nothing on the list, so the tick checks start clean. */
  shopping_checked: [
    { household_id: HOUSE, week_start: iso(-4), item_key: 'basil' },
    { household_id: HOUSE, week_start: iso(-4), item_key: 'both|basil' },
    { household_id: HOUSE, week_start: iso(-4), item_key: 'garlic|clove' },
    { household_id: HOUSE, week_start: iso(-4), item_key: 'both|chopped tomatoes|g' }
  ]
};

let html = fs.readFileSync(SRC, 'utf8');

// Drop both CDN tags; neither host is reachable from this sandbox.
html = html.replace(/<script src="https:\/\/cdnjs[^"]*"><\/script>\s*/g, '');
html = html.replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>\s*/g,
  `<script>window.html2canvas = function(){ return Promise.resolve(document.createElement('canvas')); };</script>\n` +
  `<script>window.__STUB_DATA__ = ${JSON.stringify(data)};</script>\n` +
  `<script src="stub.js"></script>\n`);

/* core.js is inlined rather than referenced: the built page lives in test/,
   and a relative src would miss the file. Inlining the real file, not a
   copy, is what makes the smoke suite a test of what Pages serves. The tag
   must exist — if index.html stopped loading core.js, that is a failure to
   report, not a step to skip. */
const CORE_TAG = /<script src="core\.js\?v=[^"]*"><\/script>/;
if(!CORE_TAG.test(html)) throw new Error('index.html no longer loads core.js');
const core = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8');
if(/<\/script/i.test(core)) throw new Error('core.js contains "</script", which would end the inlined tag early');
html = html.replace(CORE_TAG, () => '<script>\n' + core + '\n</script>');

fs.writeFileSync(OUT, html);
console.log('built', OUT, html.length, 'bytes');
