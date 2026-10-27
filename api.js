/* 서버 통신 (Supabase 서버 함수) · 체험판 */
(function () {
  var NC = window.NC = window.NC || {};
  var cfg = window.NC_CONFIG || {};
  NC.demo = !cfg.API_URL;
  var demoReady = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error(src + ' 를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    });
  }
  function ensureDemo() {
    if (!demoReady) {
      demoReady = (async function () {
        await loadScript('demo-server.js');
        await loadScript('demo-seed.js');
        if (window.NC_SERVER.isEmpty()) await window.NC_SEED();
      })();
    }
    return demoReady;
  }
  NC.resetDemo = async function () {
    await ensureDemo();
    window.NC_SERVER.reset();
    await window.NC_SEED();
  };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function netErr(msg) { return Object.assign(new Error(msg), { code: 'NET' }); }

  // 잠깐 기억해 두는 화면 데이터 (같은 화면을 다시 열 때 서버에 다시 묻지 않아요). 무언가를 바꾸면 모두 지워져요.
  var CACHE_MS = 30000, cache = {};
  var CACHEABLE = { 'ranking': 1, 'notices.list': 1, 'calendar': 1, 'settle.list': 1, 'logs.list': 1, 'game.config': 1, 'quests.list': 1 };
  var READS = { 'boot': 1, 'home': 1, 'mission.day': 1, 'me.status': 1, 'game.state': 1, 'shop.list': 1, 'posts.list': 1, 'public.members': 1, 'judge.grid': 1, 'judge.pending': 1,
    'admin.home': 1, 'warn.list': 1, 'dayoff.list': 1, 'members.list': 1, 'pie.ledger': 1, 'shop.admin': 1, 'game.plays': 1, 'settle.preview': 1, 'settings.get': 1,
    'system.usage': 1, 'system.ping': 1, 'system.errors': 1, 'data.tables': 1, 'data.rows': 1, 'data.history': 1, 'data.check': 1 };
  NC.clearCache = function () { cache = {}; };
  NC.api = async function (action, params) {
    var key = CACHEABLE[action] ? action + '|' + JSON.stringify(params || {}) + '|' + (NC.token || '') : null;
    if (key && cache[key] && Date.now() - cache[key].at < CACHE_MS) return JSON.parse(cache[key].v);
    if (!CACHEABLE[action] && !READS[action]) cache = {};
    var data = await callApi(action, params);
    if (key) cache[key] = { at: Date.now(), v: JSON.stringify(data) };
    return data;
  };
  // 속도 점검: 최근 요청 100개의 걸린 시간을 이 화면(브라우저)에만 기억해요. 서버에는 보내지 않아요.
  NC.reqLog = [];
  function logReq(action, t1, res) {
    try {
      var t = (res && res.t) || {};
      NC.reqLog.push({ at: Date.now(), page: (location.hash || '#/').replace(/^#\/?/, '').split('?')[0] || 'home', action: action,
        total: Math.round(now() - t1), server: t.ms, q: t.q, db: t.db, cold: !!t.cold, ok: !!(res && res.ok) });
      if (NC.reqLog.length > 100) NC.reqLog.splice(0, NC.reqLog.length - 100);
    } catch (e) {}
  }
  function now() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  async function callApi(action, params) {
    var body = JSON.stringify(Object.assign({ action: action, token: NC.token || undefined }, params || {}));
    var res, t1 = now();
    if (NC.demo) {
      await ensureDemo();
      await wait(60);
      res = await window.NC_SERVER.handle(body);
    } else {
      var r, headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      if (cfg.API_KEY) { headers.apikey = cfg.API_KEY; headers.Authorization = 'Bearer ' + cfg.API_KEY; }
      try {
        r = await fetch(cfg.API_URL, { method: 'POST', body: body, headers: headers });
      } catch (e) {
        throw netErr('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요. (계속되면 서버 함수의 JWT 확인이 꺼져 있는지 확인해 주세요)');
      }
      if (r.status === 401) throw netErr('서버가 요청을 막았어요. Supabase 서버 함수 설정에서 "JWT 확인(Verify JWT)"을 꺼 주세요.');
      if (r.status === 404) throw netErr('서버 함수를 찾지 못했어요. config.js 의 주소가 맞는지 확인해 주세요.');
      try { res = await r.json(); }
      catch (e) { throw netErr('서버 응답을 읽지 못했어요. (상태 ' + r.status + ') 잠시 후 다시 시도해 주세요.'); }
    }
    logReq(action, t1, res);
    if (!res.ok) {
      var err = new Error(res.error || '알 수 없는 오류');
      err.code = res.code;
      if (res.code === 'AUTH' && action !== 'auth.login' && NC.onAuthFail) NC.onAuthFail();
      if (res.code === 'MAINT' && NC.onMaintenance) NC.onMaintenance(res.error);
      throw err;
    }
    return res.data;
  }

  /** 페이지를 떠날 때 보내는 요청 (미니게임 중도 이탈) */
  NC.beacon = function (action, params) {
    var body = JSON.stringify(Object.assign({ action: action, token: NC.token }, params || {}));
    if (NC.demo) { if (window.NC_SERVER) window.NC_SERVER.handle(body); return; }
    try {
      if (!cfg.API_KEY && navigator.sendBeacon) navigator.sendBeacon(cfg.API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' }));
      else fetch(cfg.API_URL, { method: 'POST', body: body, keepalive: true, headers: Object.assign({ 'Content-Type': 'text/plain;charset=utf-8' }, cfg.API_KEY ? { apikey: cfg.API_KEY, Authorization: 'Bearer ' + cfg.API_KEY } : {}) });
    } catch (e) {}
  };
})();
