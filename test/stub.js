/* Stands in for supabase-js so the real app can boot in a sandbox with no
   network. Serves canned rows shaped exactly like the live tables, and
   records every write so tests can assert on what the app tried to save. */
(function(){
  const DATA = window.__STUB_DATA__;
  window.__WRITES__ = [];

  function result(table){
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
      upsert(rows, opts){ window.__WRITES__.push({table, op:'upsert', rows, opts}); return thenable({error:null}); },
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
        const r = result(table);
        const out = single ? { data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: null } : r;
        return Promise.resolve(out).then(res, rej);
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
          onAuthStateChange(){ return { data: { subscription: { unsubscribe(){} } } }; },
          signInWithPassword(){ return Promise.resolve({ error: null }); },
          signOut(){ return Promise.resolve({ error: null }); }
        },
        storage: { from(){ return { createSignedUrl(){ return Promise.resolve({data:null, error:null}); } }; } },
        functions: { invoke }
      };
    }
  };
})();
