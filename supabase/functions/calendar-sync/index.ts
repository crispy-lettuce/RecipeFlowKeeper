/* Brings the household's Google Calendar into step with the Planner.
 *
 * WHAT IT IS FOR: the Planner says what is for dinner on which day; the
 * calendar on the household's phones is what reminds them. Above all the
 * evening before ("get it out of the freezer"), which is why the event is
 * an all-day one with a reminder at 20:00 the night before, and not a
 * timed meal: the calendar is for reminders, not a food diary (the diary is
 * recipe_logs). The design and the household's answers are
 * docs/PLAN-CALENDAR-PUSH.md §9.
 *
 * WHAT IT DOES: for each day asked about, one all-day event in the
 * RecipeWrangler calendar while the day is planned and switched on (IN
 * CALENDAR), none otherwise. It reads the day from the database and never
 * trusts what the browser sends, so a stale tab can ask for any date and
 * the answer is still the saved plan. The event's id is worked out from
 * the household and the date, so there is no table of which event is which
 * and a retry can never make a second event.
 *
 *   await sb.functions.invoke('calendar-sync', { body: { dates: ['2026-10-05'] } });
 *   await sb.functions.invoke('calendar-sync', { body: { all: true } });   // every day from today: SYNC NOW
 *
 * Errors come back as 200 with an `error` field, as the other functions do:
 * supabase-js hides a non-2xx body in error.context, and the app reads
 * `data`. `reconnect: true` means Google no longer accepts the connection.
 *
 * The Google token is in Vault and reached only through the service-role
 * functions in docs/migrations/add-calendar-push.md. Deploy with JWT
 * verification on. Needs the secrets GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET (Edge Functions → Secrets), never in this repo.
 *
 * Added 1 Oct 2026, P3 PR 1.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const APP_URL = 'https://crispy-lettuce.github.io/RecipeFlowKeeper/';

const ALLOWED_ORIGIN = /^https:\/\/crispy-lettuce\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  if (!ALLOWED_ORIGIN.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

type PlanRow = { plan_date: string; is_blank: boolean; recipe_ids: string[]; servings: number[]; calendar: boolean; calendar_remind: boolean };
type SyncInput = { household: string; rows: PlanRow[]; titles: Titles; remindAt: number; today: string;
  dates?: string[]; all?: boolean; existingIds?: string[] };
type EventBody = Record<string, unknown>;
type SyncAction = { op: 'put' | 'delete'; id: string; date: string; event?: EventBody };
type Titles = Record<string, string>;
// deno-lint-ignore no-explicit-any
type Body = any;
type DayItem = { title: string; serves: number };
type SyncRequest = { dates?: string[]; all?: boolean; error?: string };
/* The pure section below keeps every parameter's type to one name, with no
   commas or braces in it: test/calendar-push.js strips the types with the
   same three patterns as test/source-ingredients.js, and those patterns
   are deliberately simple. */

/* ---- pure: lifted and tested by test/calendar-push.js ---- */

const MAX_DATES = 62;

/* Google's event ids may use only base32hex: the digits and a to v. So the
   prefix is "meal" (no w), then the household's id without its dashes
   (hex, so inside the alphabet), then the date's digits. Stable, so the
   same day always names the same event; unique per household and date. */
function calendarEventId(household: string, date: string): string {
  return 'meal' + String(household).toLowerCase().replace(/-/g, '') + String(date).replace(/-/g, '');
}
function eventIdPrefix(household: string): string {
  return 'meal' + String(household).toLowerCase().replace(/-/g, '');
}
function dateFromEventId(household: string, id: string): string | null {
  const prefix = eventIdPrefix(household);
  if (!String(id).startsWith(prefix)) return null;
  const m = String(id).slice(prefix.length).match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function isIsoDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* An all-day event ends on the next day, exclusive. Worked in UTC, where
   every day is 24 hours, so the clocks changing cannot move it. */
function nextDate(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* Google times a reminder in minutes before the event starts, and an
   all-day event starts at 00:00 on its day in the calendar's time zone
   (Europe/London). So 20:00 the evening before is 1440 − 1200 = 240.
   Anything that is not a time of day falls back to 20:00, as asked. */
function reminderMinutes(remindAt: unknown): number {
  const at = typeof remindAt === 'number' && Number.isInteger(remindAt) && remindAt >= 0 && remindAt < 1440 ? remindAt : 1200;
  return 1440 - at;
}

/* Today in the kitchen's own time zone: between midnight and 01:00 in
   summer, UTC is still on yesterday. */
function londonToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/* The day's event, or null when there is nothing to show (every recipe on
   it since deleted). Transparent, so it never makes the household look
   busy to anyone they share their calendar with. With REMIND ME off the
   event carries no reminder at all, not the calendar's default. */
function eventForDay(household: string, row: PlanRow, titles: Titles, remindAt: number): EventBody | null {
  const items: DayItem[] = [];
  (row.recipe_ids || []).forEach((rid, i) => {
    const title = titles[rid];
    if (!title) return;
    const n = Number((row.servings || [])[i]);
    items.push({ title: String(title).trim(), serves: Number.isInteger(n) && n > 0 ? n : 0 });
  });
  if (!items.length) return null;
  const description = items.map(it => it.serves ? `${it.title}, for ${it.serves}` : it.title).join('\n')
    + `\n\nPlanned in RecipeWrangler: ${APP_URL}`;
  return {
    id: calendarEventId(household, row.plan_date),
    summary: items.map(it => it.title).join(' + '),
    description,
    start: { date: row.plan_date },
    end: { date: nextDate(row.plan_date) },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: row.calendar_remind ? [{ method: 'popup', minutes: reminderMinutes(remindAt) }] : [] },
  };
}

/* What to do, given the saved plan. A day from today on that is planned,
   not away and switched on gets its event written (created or brought up
   to date); any other day asked about has its event deleted, which is how
   switching off, marking away and emptying a day all reach the calendar.
   Past days are left as they were: the calendar is not rewritten
   backwards. With `all`, events of this household's in the calendar that
   no longer match a wanted day are deleted too, so SYNC NOW also mends
   anything a missed sync left behind. */
function syncActions(input: SyncInput): SyncAction[] {
  const byDate: Map<string, PlanRow> = new Map();
  for (const r of input.rows || []) byDate.set(r.plan_date, r);
  const wanted: Map<string, EventBody> = new Map();
  for (const r of input.rows || []) {
    if (r.plan_date < input.today || r.is_blank || !r.calendar) continue;
    const event = eventForDay(input.household, r, input.titles || {}, input.remindAt);
    if (event) wanted.set(r.plan_date, event);
  }
  const consider: Set<string> = new Set();
  if (input.all) {
    for (const d of byDate.keys()) consider.add(d);
    for (const id of input.existingIds || []) {
      const d = dateFromEventId(input.household, id);
      if (d) consider.add(d);
    }
  } else {
    for (const d of input.dates || []) consider.add(d);
  }
  const actions: SyncAction[] = [];
  for (const date of [...consider].sort()) {
    if (date < input.today) continue;
    const id = calendarEventId(input.household, date);
    if (wanted.has(date)) actions.push({ op: 'put', id, date, event: wanted.get(date) });
    else actions.push({ op: 'delete', id, date });
  }
  return actions;
}

/* What the app may ask for: a list of real dates, or everything. */
function parseSyncRequest(body: Body): SyncRequest {
  const b: Body = body && typeof body === 'object' ? body : {};
  if (b.all === true) return { all: true };
  if (!Array.isArray(b.dates) || !b.dates.length) return { error: 'Give dates or all' };
  if (b.dates.length > MAX_DATES) return { error: `At most ${MAX_DATES} dates at a time` };
  if (!b.dates.every(isIsoDate)) return { error: 'Dates must be YYYY-MM-DD' };
  const dates: string[] = [...new Set(b.dates)].map(String).sort();
  return { dates };
}

/* ---- end pure ---- */

async function googleAccessToken(refreshToken: string): Promise<{ token?: string; invalid?: boolean; error?: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.access_token) return { token: j.access_token };
  /* invalid_grant: revoked in the Google account, or (with the consent
     screen left in Testing) seven days old. Only CONNECT again mends it. */
  if (j.error === 'invalid_grant') return { invalid: true };
  return { error: `Google refused the token: ${j.error ?? res.status}` };
}

async function listOwnEventIds(calendarId: string, token: string, household: string, today: string): Promise<string[]> {
  const ids: string[] = [];
  const prefix = eventIdPrefix(household);
  let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ timeMin: today + 'T00:00:00Z', maxResults: '250', singleEvents: 'true' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`listing the calendar returned ${res.status}`);
    const j = await res.json();
    for (const e of j.items ?? []) if (String(e.id).startsWith(prefix)) ids.push(e.id);
    pageToken = j.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return ids;
}

/* Insert with our own id; if Google already has that id (409), it is
   either our live event or one deleted earlier, which Google keeps as
   "cancelled". A PUT with status confirmed updates the first and brings
   the second back. */
async function putEvent(calendarId: string, token: string, a: SyncAction): Promise<number> {
  const base = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const ins = await fetch(base, { method: 'POST', headers, body: JSON.stringify(a.event) });
  await ins.body?.cancel();
  if (ins.status !== 409) return ins.status;
  const upd = await fetch(`${base}/${a.id}`, { method: 'PUT', headers, body: JSON.stringify({ ...a.event, status: 'confirmed' }) });
  await upd.body?.cancel();
  return upd.status;
}

async function deleteEvent(calendarId: string, token: string, a: SyncAction): Promise<number> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${a.id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  await res.body?.cancel();
  /* 404: never made. 410: already deleted. Either way the day has no event. */
  return res.status === 404 || res.status === 410 ? 204 : res.status;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (p: unknown, status = 200) =>
    new Response(JSON.stringify(p, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  let body: unknown = {};
  try { body = await req.json(); } catch { /* parseSyncRequest says what is missing */ }
  const ask = parseSyncRequest(body);
  if (ask.error) return json({ error: ask.error }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: hh } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
  const households = (hh ?? []).map(h => h.household_id);
  if (households.length !== 1) return json({ error: 'Calendar sync needs exactly one household for this account' });
  const household = households[0];

  const { data: conn } = await admin.from('calendar_connections').select('connected, calendar_id').eq('household_id', household).maybeSingle();
  const { data: refresh } = await admin.rpc('calendar_token_get', { p_household: household });
  if (!conn?.connected || !conn.calendar_id || !refresh) return json({ error: 'Google Calendar is not connected', notConnected: true });

  const note = (fields: Record<string, unknown>) =>
    admin.from('calendar_connections').update({ ...fields, updated_at: new Date().toISOString() }).eq('household_id', household);

  const access = await googleAccessToken(refresh);
  if (access.invalid) {
    await note({ connected: false, last_error: 'Google no longer accepts the connection: CONNECT again in Settings' });
    return json({ error: 'Google no longer accepts the connection', reconnect: true });
  }
  if (!access.token) {
    await note({ last_error: access.error });
    return json({ error: access.error });
  }

  const today = londonToday(new Date());
  let q = admin.from('planner_days').select('plan_date, is_blank, recipe_ids, servings, calendar, calendar_remind').eq('household_id', household);
  q = ask.all ? q.gte('plan_date', today) : q.in('plan_date', ask.dates!);
  const { data: rows, error: rowsErr } = await q;
  if (rowsErr) return json({ error: `could not read the Planner: ${rowsErr.message}` });

  const recipeIds = [...new Set((rows ?? []).flatMap(r => r.recipe_ids ?? []))];
  const titles: Record<string, string> = {};
  if (recipeIds.length) {
    const { data: recipes } = await admin.from('recipes').select('id, title').eq('household_id', household).in('id', recipeIds);
    for (const r of recipes ?? []) titles[r.id] = r.title;
  }
  const { data: settings } = await admin.from('household_settings').select('calendar_remind_at').eq('household_id', household).maybeSingle();

  let existingIds: string[] = [];
  if (ask.all) {
    try { existingIds = await listOwnEventIds(conn.calendar_id, access.token, household, today); }
    catch (e) { await note({ last_error: String((e as Error).message ?? e) }); return json({ error: String((e as Error).message ?? e) }); }
  }

  const actions = syncActions({ household, rows: rows ?? [], titles, remindAt: settings?.calendar_remind_at ?? 1200, today,
    dates: ask.dates, all: ask.all, existingIds });
  const failed: { date: string; op: string; status: number }[] = [];
  let put = 0, deleted = 0;
  for (const a of actions) {
    let status = 0;
    try { status = a.op === 'put' ? await putEvent(conn.calendar_id, access.token, a) : await deleteEvent(conn.calendar_id, access.token, a); }
    catch { status = 0; }
    if (status >= 200 && status < 300) { if (a.op === 'put') put++; else deleted++; }
    else failed.push({ date: a.date, op: a.op, status });
  }
  /* A 404 on the calendar itself means it was deleted in Google: say so in
     words, since only CONNECT again (which makes a new one) mends it. */
  const lastError = !failed.length ? null
    : failed.some(f => f.status === 404) ? 'The RecipeWrangler calendar is missing in Google: CONNECT again in Settings'
    : `${failed.length} day${failed.length === 1 ? '' : 's'} could not be written (Google said ${failed[0].status || 'nothing'})`;
  await note({ last_sync_at: new Date().toISOString(), last_error: lastError });
  return json(failed.length ? { error: lastError, put, deleted, failed } : { ok: true, put, deleted });
});
