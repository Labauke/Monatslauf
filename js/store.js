/* Monatslauf – Datenspeicher.
   Mit Supabase-Konfiguration: gemeinsame Daten über die Supabase-REST-API (PostgREST).
   Ohne Konfiguration: Demo-Modus, Daten nur im localStorage dieses Geräts. */
(function (global) {
  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

  function localStore() {
    const KEY = 'monatslauf.local';
    let data; try { data = JSON.parse(lsGet(KEY)); } catch {}
    data = data || { players: {}, entries: {} };
    const subs = {};
    const emit = c => (subs[c] || []).forEach(cb => cb(Object.entries(data[c] || {}).map(([id, v]) => ({ id, ...v }))));
    const save = () => lsSet(KEY, JSON.stringify(data));
    return {
      shared: false,
      onStatus() {},
      subscribe(c, cb) { (subs[c] ||= []).push(cb); setTimeout(() => emit(c)); return () => {}; },
      async set(c, id, v) { (data[c] ||= {})[id] = v; save(); emit(c); },
      async add(c, v) { return this.set(c, Date.now().toString(36) + Math.random().toString(36).slice(2, 6), v); },
      async del(c, id) { delete (data[c] || {})[id]; save(); emit(c); },
      async rpc() { throw { code: 'demo' }; },
    };
  }

  function supabaseStore(url, key) {
    url = url.replace(/\/+$/, '');
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key; // klassischer anon-Key (JWT)
    const CACHE = 'monatslauf.cache';
    let cache; try { cache = JSON.parse(lsGet(CACHE)); } catch {}
    cache = cache || { players: [], entries: [] };
    const subs = { players: [], entries: [] };
    let online = true, statusFn = () => {}, timer = null;

    async function api(path, opt = {}) {
      let r;
      try { r = await fetch(`${url}/rest/v1/${path}`, { ...opt, headers: { ...headers, ...(opt.headers || {}) } }); }
      catch (e) { throw { code: 'offline', message: String(e) }; }
      if (!r.ok) {
        let message = ''; try { message = await r.text(); } catch {}
        const code = r.status === 401 || r.status === 403 ? 'forbidden' : [400, 409, 422].includes(r.status) ? 'invalid' : 'http';
        throw { code, status: r.status, message };
      }
      const t = r.status === 204 ? '' : await r.text();
      return t ? JSON.parse(t) : null;
    }
    async function fetchAll(c) {
      const out = [], page = 1000;
      for (let from = 0; ; from += page) {
        const rows = await api(`${c}?select=*&order=created.asc`, { headers: { Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' } });
        out.push(...rows);
        if (rows.length < page) break;
      }
      return out;
    }
    const setOnline = v => { if (v !== online) { online = v; statusFn(v); } };
    const emit = c => subs[c].forEach(cb => cb(cache[c].map(r => ({ ...r }))));
    async function refresh(c) {
      try { cache[c] = await fetchAll(c); lsSet(CACHE, JSON.stringify(cache)); setOnline(true); emit(c); }
      catch (e) { setOnline(false); if (e.code !== 'offline') console.warn('Supabase:', e); }
    }
    const refreshAll = () => Promise.all(Object.keys(subs).map(refresh));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAll(); });
    addEventListener('online', refreshAll);

    return {
      shared: true,
      onStatus(fn) { statusFn = fn; },
      subscribe(c, cb) {
        subs[c].push(cb);
        if (cache[c].length) setTimeout(() => cb(cache[c].map(r => ({ ...r }))));
        refresh(c);
        clearInterval(timer);
        timer = setInterval(() => { if (document.visibilityState === 'visible') refreshAll(); }, 15000);
        return () => {};
      },
      async set(c, id, v) {
        await api(`${c}?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id, ...v }) });
        await refresh(c);
      },
      async add(c, v) {
        await api(c, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(v) });
        await refresh(c);
      },
      async del(c, id) {
        await api(`${c}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        await refresh(c);
      },
      // Datenbank-Funktion aufrufen (z. B. push_subscribe)
      rpc(name, args) { return api(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }); },
    };
  }

  global.createStore = cfg => (cfg && cfg.supabaseUrl && cfg.supabaseKey) ? supabaseStore(cfg.supabaseUrl, cfg.supabaseKey) : localStore();
  global.lsGet = lsGet;
  global.lsSet = lsSet;
})(window);
