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
      then(res, rej){
        const r = result(table);
        const out = single ? { data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: null } : r;
        return Promise.resolve(out).then(res, rej);
      }
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
        storage: { from(){ return { createSignedUrl(){ return Promise.resolve({data:null, error:null}); } }; } }
      };
    }
  };
})();
