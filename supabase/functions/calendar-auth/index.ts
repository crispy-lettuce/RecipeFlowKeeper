/* Connects the household's Google Calendar, once, and disconnects it.
 *
 * WHY: the calendar push (calendar-sync, docs/PLAN-CALENDAR-PUSH.md §9)
 * writes into the household's own Google Calendar, which needs their
 * permission: Google's consent screen, once. After that, Google gives a
 * refresh token that lasts until it is revoked, and the app never asks
 * again. That one-off step is what the brief asked for ("After that single
 * step, reminders are created automatically with no further manual action,
 * ever").
 *
 *   POST { action: 'start', returnTo }   signed in: returns { url }, Google's consent page
 *   GET  /calendar-auth/callback?code&state   Google sends the browser here after consent
 *   POST { action: 'disconnect' }         signed in: forgets the connection
 *
 * The callback is called by Google, with no Supabase sign-in, so this
 * function is deployed with JWT verification OFF. Each POST checks the
 * sign-in itself (getUser); the callback is guarded by the one-time value
 * that `start` issued for a signed-in member, which it takes exactly once
 * and only within ten minutes (calendar_state_take).
 *
 * On a first connection it makes a calendar of its own, RecipeWrangler, in
 * the Google account. With the calendar.app.created scope the app can see
 * and change that calendar and nothing else in the account.
 *
 * DISCONNECT revokes the token at Google and forgets it here, and leaves
 * the RecipeWrangler calendar and its events where they are, as the
 * household chose on 1 Oct 2026. The calendar's id is kept, so connecting
 * again carries on with the same calendar.
 *
 * The refresh token is kept in Vault (docs/migrations/add-calendar-push.md),
 * never in a table: the nightly backup copies the tables. The secrets
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Edge Functions →
 * Secrets by the household, never in this repo. GOOGLE_CALENDAR_SCOPE may
 * be set there too, to the full calendar scope, if Google does not offer
 * calendar.app.created at setup.
 *
 * Added 1 Oct 2026, P3 PR 1.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const APP_URL = 'https://crispy-lettuce.github.io/RecipeFlowKeeper/';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

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

type ConsentInput = { clientId: string; redirectUri: string; state: string; scope: string };

/* ---- pure: lifted and tested by test/calendar-push.js ---- */

/* Google's consent page. `access_type=offline` asks for a refresh token,
   and `prompt=consent` makes Google send a fresh one even when the account
   granted this app before: without it, connecting again after DISCONNECT
   would come back with no refresh token. `openid email` is only so the app
   can say which account it is connected as. */
function consentUrl(input: ConsentInput): string {
  const q = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: ['openid', 'email', input.scope].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state: input.state,
  });
  return `${GOOGLE_AUTH_URL}?${q}`;
}

/* Where the browser goes back to afterwards: only the app's own pages,
   so the callback cannot be used to send anyone elsewhere. The hash is
   dropped, since the outcome is added as one. */
function safeReturnTo(raw: unknown): string | null {
  let u: URL;
  try { u = new URL(String(raw || '')); } catch { return null; }
  if (!ALLOWED_ORIGIN.test(u.origin) || u.username || u.password) return null;
  u.hash = '';
  return u.toString();
}

function withOutcome(returnTo: string, outcome: string): string {
  return returnTo.replace(/#.*$/, '') + '#calendar=' + encodeURIComponent(outcome);
}

/* The account's email, from the id_token Google's token endpoint returned
   to this function directly over TLS, which OpenID Connect allows to be
   read without checking its signature. Only shown in Settings. */
function emailFromIdToken(idToken: unknown): string | null {
  const part = String(idToken || '').split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
    return typeof claims.email === 'string' ? claims.email : null;
  } catch { return null; }
}

/* Google's consent screen lets each permission be unticked. Without one
   of these the app cannot make or write its calendar, so connecting says
   so rather than half-working. */
function grantedEnough(scope: unknown): boolean {
  const granted = String(scope || '').split(/\s+/);
  return granted.includes('https://www.googleapis.com/auth/calendar.app.created')
    || granted.includes('https://www.googleapis.com/auth/calendar');
}

/* ---- end pure ---- */

function randomState(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (p: unknown, status = 200) =>
    new Response(JSON.stringify(p, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
  const redirectUri = `${url}/functions/v1/calendar-auth/callback`;
  const here = new URL(req.url);

  /* ---- Google sends the browser back here ---- */
  if (req.method === 'GET' && here.pathname.endsWith('/callback')) {
    const state = here.searchParams.get('state') ?? '';
    const { data: taken } = state ? await admin.rpc('calendar_state_take', { p_state: state }) : { data: null };
    const st = Array.isArray(taken) ? taken[0] : null;
    if (!st) return redirect(withOutcome(APP_URL, 'expired'));
    const back = safeReturnTo(st.return_to) ?? APP_URL;
    if (here.searchParams.get('error') || !here.searchParams.get('code')) return redirect(withOutcome(back, 'denied'));

    try {
      const tokRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: here.searchParams.get('code')!, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const tok = await tokRes.json().catch(() => ({}));
      if (!tokRes.ok || !tok.access_token) return redirect(withOutcome(back, 'error'));
      if (!grantedEnough(tok.scope)) return redirect(withOutcome(back, 'scope'));
      if (!tok.refresh_token) return redirect(withOutcome(back, 'error'));
      const auth = { Authorization: `Bearer ${tok.access_token}` };

      /* The same calendar again if it is still there; otherwise a new one. */
      const { data: prev } = await admin.from('calendar_connections').select('calendar_id').eq('household_id', st.household_id).maybeSingle();
      let calendarId: string | null = null;
      if (prev?.calendar_id) {
        const chk = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(prev.calendar_id)}`, { headers: auth });
        await chk.body?.cancel();
        if (chk.ok) calendarId = prev.calendar_id;
      }
      if (!calendarId) {
        const made = await fetch(`${CALENDAR_API}/calendars`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: 'RecipeWrangler', timeZone: 'Europe/London',
            description: `Planned meals from RecipeWrangler, with a reminder the evening before. ${APP_URL}` }),
        });
        const cal = await made.json().catch(() => ({}));
        if (!made.ok || !cal.id) return redirect(withOutcome(back, 'error'));
        calendarId = cal.id;
      }

      const { error: vaultErr } = await admin.rpc('calendar_token_set', { p_household: st.household_id, p_token: tok.refresh_token });
      if (vaultErr) return redirect(withOutcome(back, 'error'));
      const now = new Date().toISOString();
      const { error: rowErr } = await admin.from('calendar_connections').upsert({
        household_id: st.household_id, connected: true, google_email: emailFromIdToken(tok.id_token), calendar_id: calendarId,
        scope: String(tok.scope ?? ''), connected_at: now, last_error: null, updated_at: now,
      }, { onConflict: 'household_id' });
      if (rowErr) return redirect(withOutcome(back, 'error'));
      return redirect(withOutcome(back, 'connected'));
    } catch {
      return redirect(withOutcome(back, 'error'));
    }
  }

  /* ---- The app's own calls: signed in ---- */
  if (req.method !== 'POST') return json({ error: 'Not found' }, 404);
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);
  const { data: hh } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
  const households = (hh ?? []).map(h => h.household_id);
  if (households.length !== 1) return json({ error: 'Calendar needs exactly one household for this account' });
  const household = households[0];

  let body: { action?: string; returnTo?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }

  if (body.action === 'start') {
    if (!clientId || !clientSecret) return json({ error: 'The Google client is not set up yet (Edge Functions → Secrets)' });
    const back = safeReturnTo(body.returnTo);
    if (!back) return json({ error: 'returnTo must be the app\'s own address' }, 400);
    const state = randomState();
    const { error } = await admin.rpc('calendar_state_issue', { p_state: state, p_household: household, p_user: user.id, p_return_to: back });
    if (error) return json({ error: `could not start: ${error.message}` });
    return json({ url: consentUrl({ clientId, redirectUri, state, scope: Deno.env.get('GOOGLE_CALENDAR_SCOPE') || DEFAULT_SCOPE }) });
  }

  if (body.action === 'disconnect') {
    const { data: refresh } = await admin.rpc('calendar_token_get', { p_household: household });
    if (refresh) {
      /* Telling Google is a courtesy: forgetting the token here is what
         stops the app, so a failure there does not stop the disconnect. */
      try {
        const r = await fetch(GOOGLE_REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: refresh }) });
        await r.body?.cancel();
      } catch { /* see above */ }
    }
    const { error: forgetErr } = await admin.rpc('calendar_token_forget', { p_household: household });
    if (forgetErr) return json({ error: `could not forget the connection: ${forgetErr.message}` });
    await admin.from('calendar_connections').update({ connected: false, last_error: null, updated_at: new Date().toISOString() })
      .eq('household_id', household);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
