/* 서버 통신 (Apps Script 웹 앱) · 데모 모드 */
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
        await loadScript('js/demo/mock-gas.js');
        await loadScript('backend/Code.js');
        await loadScript('backend/Actions.js');
        await loadScript('js/demo/seed.js');
        if (window.MockGAS.isEmpty()) { window.NC_SEED(); window.MockGAS.save(); }
      })();
    }
    return demoReady;
  }
  NC.resetDemo = async function () {
    await ensureDemo();
    window.MockGAS.reset();
    window.NC_SEED();
    window.MockGAS.save();
  };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  NC.api = async function (action, params) {
    var body = JSON.stringify(Object.assign({ action: action, token: NC.token || undefined }, params || {}));
    var res;
    if (NC.demo) {
      await ensureDemo();
      await wait(90);
      res = JSON.parse(window.doPost({ postData: { contents: body } }).getContent());
      window.MockGAS.save();
    } else {
      var r;
      try {
        r = await fetch(cfg.API_URL, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
      } catch (e) {
        throw Object.assign(new Error('연결하지 못했어요. 인터넷 연결을 확인해 주세요.'), { code: 'NET' });
      }
      try { res = await r.json(); }
      catch (e) { throw Object.assign(new Error('응답을 읽지 못했어요. 설치 안내의 웹 앱 배포 설정을 확인해 주세요.'), { code: 'NET' }); }
    }
    if (!res.ok) {
      var err = new Error(res.error || '알 수 없는 오류');
      err.code = res.code;
      if (res.code === 'AUTH' && action !== 'auth.login' && NC.onAuthFail) NC.onAuthFail();
      throw err;
    }
    return res.data;
  };

  /** 페이지를 떠날 때 보내는 요청 (미니게임 중도 이탈) */
  NC.beacon = function (action, params) {
    var body = JSON.stringify(Object.assign({ action: action, token: NC.token }, params || {}));
    if (NC.demo) { if (window.doPost) { window.doPost({ postData: { contents: body } }); window.MockGAS.save(); } return; }
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(cfg.API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' }));
      else fetch(cfg.API_URL, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    } catch (e) {}
  };
})();
