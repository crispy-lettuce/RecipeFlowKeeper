/* Stands in for supabase-js so the real app can boot in a sandbox with no
   network. Serves canned rows shaped exactly like the live tables, and
   records every write so tests can assert on what the app tried to save. */
(function(){
  const DATA = window.__STUB_DATA__;
  window.__WRITES__ = [];

  /* Switches for the paths that only exist when the network misbehaves —
     added 22 Sep, when the first offline test on the live app found that
     coming back to the tab signed you out. All off by default, so every
     existing check runs exactly as before.

       __READ_FAIL__     reads fail the way supabase-js reports a dead network
       __READ_DELAY__    ms before a read answers, to open a mid-fetch window
       __WRITE_FAIL__    upserts fail the same way
       __WRITE_DELAY__   ms before an upsert answers, to hold the queue open
       __LOG__           'read:<table>' and 'write-done:<table>', in order,
                         so a test can prove what happened before what
       __AUTH_CB__       the app's onAuthStateChange listener, so a test can
                         fire SIGNED_IN as supabase-js does on a tab return
       __SIGNOUTS__      how many times the app signed itself out

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
        const outcome = window.__WRITE_FAIL__ ? { error: NETWORK_ERROR } : { error: null };
        const done = later(outcome, window.__WRITE_DELAY__).then(v => { window.__LOG__.push('write-done:' + table); return v; });
        return { then(res, rej){ return done.then(res, rej); } };
      },
      insert(rows){ window.__WRITES__.push({table, op:'insert', rows}); return thenable({error:null}); },
      delete(){ window.__WRITES__.push({table, op:'delete'}); return deleteChain(); },
      /* Added 22 Sep. Its absence made the food diary's only update path
         throw a TypeError that queueWrite swallowed, so the check on the
         meal-type prompt passed by asserting the in-memory cache while the
         write had never run — and the suite went red without anyone
         noticing, because it was being read by counting 'ok' lines rather
         than by its exit code. Records like the others so a test can assert
         on the patch actually sent, not just on what the cache believes. */
      update(patch){ window.__WRITES__.push({table, op:'update', patch}); return updateChain(table, patch); },
      then(res, rej){
        window.__LOG__.push('read:' + table);
        const r = result(table);
        const out = (single && !r.error) ? { data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: null } : r;
        return later(out, window.__READ_DELAY__).then(res, rej);
      }
    };
    return api;
  }
  function updateChain(table, patch){
    const api = {
      /* .eq() is recorded rather than ignored: a patch aimed at the wrong
         row is a real bug the tests should be able to see. */
      eq(column, value){ window.__WRITES__[window.__WRITES__.length-1].match = {column, value}; return api; },
      not(){ return api; }, in(){ return api; },
      then(res, rej){ return Promise.resolve({error:null}).then(res, rej); }
    };
    return api;
  }
  function deleteChain(){
    const api = {
      eq(){ return api; }, not(){ return api; }, in(){ return api; },
      then(res, rej){ return Promise.resolve({error:null}).then(res, rej); }
    };
    return api;
  }
  function thenable(v){ return { then(res, rej){ return Promise.resolve(v).then(res, rej); } }; }

  /* Edge Function calls.
     Recorded like writes, and answerable per test. Without this,
     `sb.functions.invoke` is a TypeError that queueWrite swallows into a
     toast — the suite stays green while the feature is entirely broken.
     That is not hypothetical: the missing `update()` above did exactly
     that. A test sets window.__INVOKE_REPLY__ to control the response, so
     the error path is reachable and not just the happy one. */
  window.__INVOKES__ = [];
  window.__INVOKE_REPLY__ = null;
  function invoke(name, opts){
    const call = { name, body: (opts && opts.body) || null };
    window.__INVOKES__.push(call);
    const reply = typeof window.__INVOKE_REPLY__ === 'function'
      ? window.__INVOKE_REPLY__(call)
      : window.__INVOKE_REPLY__;
    return Promise.resolve(reply || { data: null, error: null });
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
        storage: { from(){ return { createSignedUrl(){ return Promise.resolve({data:null, error:null}); } }; } },
        functions: { invoke }
      };
    }
  };
})();
