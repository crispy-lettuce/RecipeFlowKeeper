/* Stands in for supabase-js so the real app can boot in a sandbox with no
   network. Serves canned rows shaped exactly like the live tables, and
   records every write so tests can assert on what the app tried to save. */
(function(){
  /* __STUB_EXTRA__ (added 9 Oct 2026 for the calendar push) is merged over the fixture, so a test can boot
     a fresh page in a state the fixture is not in: set it with addInitScript, which runs before this. */
  const DATA = Object.assign(window.__STUB_DATA__, window.__STUB_EXTRA__ || {});
  /* Tables whose migration the live database is still waiting for. They read as not created, as PostgREST
     says so, unless a test puts rows for them in __STUB_DATA__ (an empty list is "created, no rows"): so the
     default fixture is the live app as it is today, and every check written before them runs unchanged. */
  const PENDING_TABLES = ['calendar_connections'];
  window.__WRITES__ = [];

  /* Switches for the paths that only exist when the network misbehaves —
     added 22 Sep, when the first offline test on the live app found that
     coming back to the tab signed you out. All off by default, so every
     existing check runs exactly as before.

       __READ_FAIL__     reads fail the way supabase-js reports a dead network
       __READ_DELAY__    ms before a read answers, to open a mid-fetch window
       __WRITE_FAIL__    writes fail the same way (every kind — upsert, insert,
                         update, delete — since 24 Sep, when ordinary saves
                         became single-row updates and deletes)
       __WRITE_DELAY__   ms before a write answers, to hold the queue open
       __LOG__           'read:<table>', 'write-done:<table>' and 'invoke:<name>', in order,
                         so a test can prove what happened before what
       __AUTH_CB__       the app's onAuthStateChange listener, so a test can
                         fire SIGNED_IN as supabase-js does on a tab return
       __SIGNOUTS__      how many times the app signed itself out
       __MISSING_TABLES__ table names that read as not created yet, the way
                         PostgREST says so (added 29 Sep for PR 6: a merge can
                         arrive before its migration, and the app must cope)
       __STUB_EXTRA__    tables merged over the fixture before anything reads it
                         (9 Oct, the calendar push: a page that boots connected)

     The failure is an error OBJECT with the browser's text as its message,
     not a thrown TypeError — that is what postgrest-js actually hands back,
     and the app's network test has to recognise that shape. */
  window.__LOG__ = [];
  window.__SIGNOUTS__ = 0;
  const NETWORK_ERROR = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' };
  /* No delay means no timer: a microtask, exactly as before these switches
     existed, so the timing every other check was written against is kept. */
  const later = (v, ms) => ms ? new Promise(r => setTimeout(() => r(v), ms)) : Promise.resolve(v);

  function result(table){
    if(window.__READ_FAIL__) return { data: null, error: NETWORK_ERROR };
    if((window.__MISSING_TABLES__ || []).includes(table) || (PENDING_TABLES.includes(table) && DATA[table] === undefined)){
      return { data: null, error: { message: `Could not find the table 'public.${table}' in the schema cache`, details: null, hint: null, code: 'PGRST205' } };
    }
    const rows = DATA[table] === undefined ? [] : DATA[table];
    return { data: rows, error: null };
  }

  function builder(table){
    let single = false;
    const api = {
      select(){ return api; },
      order(){ return api; },
      limit(){ return api; },
      not(){ return api; },
      eq(){ return api; },
      maybeSingle(){ single = true; return api; },
      single(){ single = true; return api; },
      upsert(rows, opts){
        window.__WRITES__.push({table, op:'upsert', rows, opts});
        return settle(table);
      },
      insert(rows){ window.__WRITES__.push({table, op:'insert', rows}); return settle(table); },
      delete(){ const w = {table, op:'delete'}; window.__WRITES__.push(w); return deleteChain(w, table); },
      /* Added 22 Sep. Its absence made the food diary's only update path
         throw a TypeError that queueWrite swallowed, so the check on the
         meal-type prompt passed by asserting the in-memory cache while the
         write had never run — and the suite went red without anyone
         noticing, because it was being read by counting 'ok' lines rather
         than by its exit code. Records like the others so a test can assert
         on the patch actually sent, not just on what the cache believes. */
      update(patch){ const w = {table, op:'update', patch}; window.__WRITES__.push(w); return filterChain(w, table); },
      then(res, rej){
        window.__LOG__.push('read:' + table);
        const r = result(table);
        const out = (single && !r.error) ? { data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: null } : r;
        return later(out, window.__READ_DELAY__).then(res, rej);
      }
    };
    return api;
  }
  /* Every write answers the same way: failing when __WRITE_FAIL__ is set,
     after __WRITE_DELAY__ if set, and logging when it is done. Until 24 Sep
     only upserts did, because only upserts mattered — every save was one.
     Now a favourite is an update and a removal is a delete, and a check on
     "a refresh stands down while a save has failed" needs those to be able
     to fail too, or it would pass against a save that never ran. */
  function settle(table){
    const outcome = window.__WRITE_FAIL__ ? { error: NETWORK_ERROR } : { error: null };
    const done = later(outcome, window.__WRITE_DELAY__).then(v => { window.__LOG__.push('write-done:' + table); return v; });
    return { then(res, rej){ return done.then(res, rej); } };
  }
  /* The filters on an update or a delete are recorded on the write, not
     dropped. `match` is the last .eq() (what the older checks read); `eqs`
     is every .eq() in order, so a check can see a delete aimed at one row
     of one household — and would see one aimed at the whole household. A
     mutation that removed pushList's delete entirely once left all 197
     checks green (F7, M4) because nothing could see what it was aimed at. */
  function filterChain(write, table){
    write.eqs = [];
    const api = {
      eq(column, value){ write.match = {column, value}; write.eqs.push({column, value}); return api; },
      not(column, op, value){ write.not = {column, op, value}; return api; },
      in(column, values){ write.in = {column, values}; return api; },
      then(res, rej){ return settle(table).then(res, rej); }
    };
    return api;
  }
  function deleteChain(write, table){ return filterChain(write, table); }
  function thenable(v){ return { then(res, rej){ return Promise.resolve(v).then(res, rej); } }; }

  /* Edge Function calls.
     Recorded like writes, and answerable per test. Without this,
     `sb.functions.invoke` is a TypeError that queueWrite swallows into a
     toast — the suite stays green while the feature is entirely broken.
     That is not hypothetical: the missing `update()` above did exactly
     that. A test sets window.__INVOKE_REPLY__ to control the response, so
     the error path is reachable and not just the happy one. */
  window.__INVOKES__ = [];
  window.__INVOKE_REPLY__ = window.__INVOKE_REPLY__ || null; // one set by addInitScript (a fresh page) is kept
  function invoke(name, opts){
    const call = { name, body: (opts && opts.body) || null };
    window.__INVOKES__.push(call);
    /* In __LOG__ too (9 Oct 2026), so a check can see a call came after the write it depends on: calendar-sync
       reads the saved Planner row, so the row must have landed first. */
    window.__LOG__.push('invoke:' + name);
    const reply = typeof window.__INVOKE_REPLY__ === 'function'
      ? window.__INVOKE_REPLY__(call)
      : window.__INVOKE_REPLY__;
    return Promise.resolve(reply || { data: null, error: null });
  }

  /* Storage, added 30 Sep 2026 for source photos (docs/PLAN-SOURCE-PHOTOS.md). A pretend bucket that
     keeps what is uploaded, so a signed link can show it back, and records every call in __STORAGE__
     ({bucket, op, path | paths, contentType, upsert}) so a check can see what went where, and when.
       __STORAGE_FAIL__   every storage call fails as a dead network would
       __STORAGE_FILES__  path → a URL to serve for it, for a file "already stored"
     A signed link for a path nothing stored answers as storage does: not found. */
  window.__STORAGE__ = [];
  window.__STORAGE_FILES__ = window.__STORAGE_FILES__ || {};
  function storageBucket(bucket){
    const fail = () => window.__STORAGE_FAIL__ ? { data: null, error: { message: 'Failed to fetch' } } : null;
    return {
      upload(path, blob, opts){
        window.__STORAGE__.push({ bucket, op: 'upload', path, size: blob && blob.size, contentType: opts && opts.contentType, upsert: !!(opts && opts.upsert) });
        const f = fail(); if(f) return Promise.resolve(f);
        window.__STORAGE_FILES__[path] = URL.createObjectURL(blob);
        window.__LOG__.push('storage-done:upload');
        return Promise.resolve({ data: { path }, error: null });
      },
      remove(paths){
        window.__STORAGE__.push({ bucket, op: 'remove', paths });
        const f = fail(); if(f) return Promise.resolve(f);
        paths.forEach(p => { delete window.__STORAGE_FILES__[p]; });
        window.__LOG__.push('storage-done:remove');
        return Promise.resolve({ data: paths.map(name => ({ name })), error: null });
      },
      createSignedUrl(path, expiresIn){
        window.__STORAGE__.push({ bucket, op: 'sign', path, expiresIn });
        const f = fail(); if(f) return Promise.resolve(f);
        const url = window.__STORAGE_FILES__[path];
        return Promise.resolve(url ? { data: { signedUrl: url }, error: null } : { data: null, error: { message: 'Object not found' } });
      }
    };
  }

  window.supabase = {
    createClient(){
      return {
        from: builder,
        auth: {
          getSession(){ return Promise.resolve({ data: { session: { user: { id: 'stub-user' } } } }); },
          onAuthStateChange(cb){ window.__AUTH_CB__ = cb; return { data: { subscription: { unsubscribe(){} } } }; },
          signInWithPassword(){ return Promise.resolve({ error: null }); },
          signOut(){ window.__SIGNOUTS__++; return Promise.resolve({ error: null }); }
        },
        storage: { from: storageBucket },
        functions: { invoke }
      };
    }
  };
})();
