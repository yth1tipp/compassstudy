/* 나침반 스터디그룹 — 앱 코어 · 멤버 화면 */
(function () {
  var NC = window.NC = window.NC || {};
  var CFG = window.NC_CONFIG || {};

  // ============================================================
  // 유틸
  // ============================================================
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var KST = 9 * 3600000;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(ms) { var d = new Date(ms + KST); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function today() { return ymd(Date.now()); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(s) { return (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; }
  function weekOf(s) { return addDays(s, -dow(s)); }
  var DOW = ['월', '화', '수', '목', '금', '토', '일'];
  function md(s) { return (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)); }
  function mdw(s) { return md(s) + ' (' + DOW[dow(s)] + ')'; }
  /** 서버 시각 글자(2026-10-26 21:03:15, 한국 시간) → ms */
  function parseTs(s) {
    s = String(s || '');
    if (!s) return 0;
    if (/T.*Z$/.test(s)) return Date.parse(s);
    var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) - KST : 0;
  }
  function fmtDT(iso) {
    if (!iso) return '';
    var d = new Date(parseTs(iso) + KST);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  function fmtAgo(iso) {
    var s = (Date.now() - parseTs(iso)) / 1000;
    if (s < 60) return '방금';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
    return fmtDT(iso).split(' ')[0];
  }
  function fmtMin(m) { if (m === null || m === undefined) return '-'; m = Math.round(m); return Math.floor(m / 60) + ':' + pad(m % 60); }
  function fmtHM(m) { m = Math.round(m || 0); var h = Math.floor(m / 60), r = m % 60; return (h ? h + '시간 ' : '') + (r || !h ? r + '분' : ''); }
  function fmtLeft(ms) {
    var s = Math.floor((ms - Date.now()) / 1000);
    if (s <= 0) return '마감됨';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h >= 24) return Math.floor(h / 24) + '일 ' + (h % 24) + '시간 남음';
    return (h ? h + '시간 ' : '') + m + '분 남음';
  }
  function fmtDeadline(ms) {
    var d = new Date(ms + KST), hh = d.getUTCHours(), mm = d.getUTCMinutes(), date = ymd(ms), t = today();
    if (hh === 0 && mm === 0) { date = ymd(ms - 1); hh = 24; }
    var label = date === t ? '오늘' : date === addDays(t, 1) ? '내일' : date === addDays(t, -1) ? '어제' : md(date);
    return label + ' ' + pad(hh) + ':' + pad(mm);
  }
  function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function signed(n) { return (n > 0 ? '+' : '') + num(n); }
  NC.u = { parseTs: parseTs, $: $, $$: $$, esc: esc, ymd: ymd, today: today, addDays: addDays, dow: dow, weekOf: weekOf, DOW: DOW, md: md, mdw: mdw,
           fmtDT: fmtDT, fmtAgo: fmtAgo, fmtMin: fmtMin, fmtHM: fmtHM, fmtLeft: fmtLeft, fmtDeadline: fmtDeadline, num: num, signed: signed };

  // ============================================================
  // 상수 · 표시 요소
  // ============================================================
  NC.TAG_NAMES = { dev: '개발자', lead: '대표', sub: '부대표', sup: '서포터', mentor: '멘토', mentee: '멘티' };
  NC.MISSION_NAMES = { attend: '생존신고', study: '공부인증', problem: '문제만들기', mentoring: '멘토/멘티 활동', hours: '공부시간 인증', daily: '데일리 퀘스트', weekly: '위클리 퀘스트' };
  NC.MISSION_SHORT = { attend: '생존', study: '공부', problem: '문제', mentoring: '멘토링', hours: '공부시간', daily: '데일리', weekly: '위클리' };
  NC.MISSIONS = ['attend', 'study', 'problem', 'mentoring', 'hours', 'daily'];
  NC.REQUIRED = ['attend', 'study', 'problem'];
  NC.STATUS_NAMES = { none: '미표시', pending: '확인 대기', ok: '확인 완료', vague: '애매함', fail: '미수행' };
  NC.REACTIONS = [['heart', '❤️'], ['thumb', '👍'], ['check', '✔️'], ['angry', '😠'], ['laugh', '😆'], ['cry', '😢'], ['wow', '😮']];

  function badges(tags) { return '<span class="badges">' + (tags || []).map(function (t) { return '<span class="badge ' + t + '">' + NC.TAG_NAMES[t] + '</span>'; }).join('') + '</span>'; }
  function who(m, opts) {
    if (!m) return '';
    opts = opts || {};
    return '<span class="who"><b>' + esc(m.name) + '</b>' + (opts.id ? '<span class="muted tiny">@' + esc(m.id) + '</span>' : '') + badges(m.tags) + '</span>';
  }
  function statusPill(st) { return '<span class="pill st-' + st + '"><span class="dot st-' + st + '"></span>' + NC.STATUS_NAMES[st] + '</span>'; }
  NC.badges = badges; NC.who = who; NC.statusPill = statusPill;

  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
    shop: '<path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8M9 18h6"/>',
    board: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>',
    dash: '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
    judge: '<path d="M4 4h16v16H4z"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.5v.5"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9h4a2 2 0 0 1 0 4h-3.5v3.5M9.5 9v3"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8C9 8 7 7 7 5.5S8.5 3 12 8zm0 0c3 0 5-1 5-2.5S15.5 3 12 8z"/>',
    log: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    quest: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    off: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    pie: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (I[n] || '') + '</svg>'; }
  NC.icon = icon;
  NC.logo = function (cls) {
    return '<svg class="' + (cls || 'logo') + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="30" fill="#1e2a4a"/><circle cx="32" cy="32" r="25" fill="none" stroke="#c99a46" stroke-width="1.6"/>' +
      '<g fill="#c99a46" opacity=".55"><path d="M32 14 35 32 32 50 29 32z" transform="rotate(45 32 32)"/></g>' +
      '<path d="M32 9 36.5 32 32 55 27.5 32z" fill="#f3f0e6"/><path d="M32 9 36.5 32H27.5z" fill="#e0565b"/>' +
      '<path d="M9 32 32 27.5 55 32 32 36.5z" fill="#f3f0e6" opacity=".9"/><circle cx="32" cy="32" r="3.4" fill="#c99a46"/></svg>';
  };

  // ============================================================
  // 토스트 · 모달
  // ============================================================
  function toast(msg, type) {
    var box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, type === 'err' ? 3800 : 2400);
  }
  NC.toast = toast;
  NC.err = function (e) { console.error(e); toast(e && e.message ? e.message : String(e), 'err'); };

  /** modal({title, body, actions:[{label, cls, onClick(close)}], wide, onClose}) */
  function modal(o) {
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="bg"></div><div class="modal' + (o.wide ? ' wide' : '') + (o.cls ? ' ' + o.cls : '') + '" role="dialog" aria-modal="true">' +
      '<div class="mh"><h3>' + esc(o.title || '') + '</h3><button class="btn ghost icon right" data-x aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div class="mb"></div>' + (o.actions && o.actions.length ? '<div class="mf"></div>' : '') + '</div>';
    var mb = $('.mb', wrap);
    if (typeof o.body === 'string') mb.innerHTML = o.body; else if (o.body) mb.appendChild(o.body);
    var closed = false;
    function close(v) {
      if (closed) return; closed = true;
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      if (o.onClose) o.onClose(v);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    $('.bg', wrap).onclick = function () { close(); };
    $('[data-x]', wrap).onclick = function () { close(); };
    if (o.actions) o.actions.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.label;
      b.onclick = async function () {
        if (!a.onClick) return close();
        b.disabled = true;
        try { var r = await a.onClick(close, wrap); if (r !== false) close(r); }
        catch (e) { NC.err(e); }
        finally { b.disabled = false; }
      };
      $('.mf', wrap).appendChild(b);
    });
    document.body.appendChild(wrap);
    var f = $('input:not([type=checkbox]),textarea,select', mb);
    if (f && window.innerWidth > 640) setTimeout(function () { f.focus(); }, 50);
    return { el: wrap, body: mb, close: close };
  }
  NC.modal = modal;
  NC.confirm = function (msg, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      modal({ title: opt.title || '확인', body: '<p style="margin:4px 0 6px;white-space:pre-wrap">' + esc(msg) + '</p>' + (opt.extra || ''),
        actions: [{ label: '취소', onClick: function () { res(false); } }, { label: opt.ok || '확인', cls: opt.danger ? 'danger fill' : 'primary', onClick: function (c, w) { res(opt.collect ? opt.collect(w) : true); } }],
        onClose: function () { res(false); } });
    });
  };

  // ============================================================
  // 인증 · 부팅
  // ============================================================
  NC.token = null;
  try { NC.token = localStorage.getItem('nc_token'); } catch (e) {}
  function setToken(t) { NC.token = t; try { if (t) localStorage.setItem('nc_token', t); else localStorage.removeItem('nc_token'); } catch (e) {} }
  NC.setToken = setToken;
  NC.onAuthFail = function () { setToken(null); NC.me = null; toast('다시 로그인해 주세요.', 'err'); render(); };
  NC.logout = function () { setToken(null); NC.me = null; location.hash = '#/home'; render(); };

  async function boot() {
    if (!NC.token) return false;
    try {
      var b = await NC.api('boot');
      NC.me = b.me; NC.settings = b.settings; NC.gameNames = b.gameNames;
      document.title = b.settings.groupName + ' 스터디그룹';
      return true;
    } catch (e) { if (e.code !== 'AUTH') NC.err(e); return false; }
  }
  NC.refreshMe = async function () {
    try { var b = await NC.api('boot'); NC.me = b.me; updateShellMe(); } catch (e) {}
  };

  // ============================================================
  // 레이아웃 · 라우팅
  // ============================================================
  NC.pages = {};
  var NAV = [
    { sec: '나의 공부' },
    { path: 'home', label: '홈', icon: 'home' },
    { path: 'calendar', label: '달력', icon: 'cal' },
    { path: 'games', label: '미니게임', icon: 'game' },
    { path: 'shop', label: '상점', icon: 'shop' },
    { path: 'me', label: '내 현황', icon: 'user' },
    { path: 'ranking', label: '랭킹', icon: 'trophy' },
    { path: 'board', label: '공지 · 한줄 게시판', icon: 'board' },
    { sec: '운영', rank: 1 }
  ];
  /** 운영 메뉴: 4개 묶음, 각 묶음 안은 위쪽 탭으로 이동 */
  var GROUPS = [
    { key: 'check', label: '인증 확인', icon: 'judge', rank: 1, tabs: [['admin', '오늘 할 일', 2], ['admin/judge', '판정 표', 1], ['admin/pending', '확인 대기', 1]] },
    { key: 'people', label: '멤버 관리', icon: 'users', rank: 2, tabs: [['admin/members', '멤버 목록', 2], ['admin/warnings', '경고', 2], ['admin/dayoffs', '데이오프', 2], ['admin/pie', '파이', 2]] },
    { key: 'content', label: '콘텐츠 관리', icon: 'quest', rank: 2, tabs: [['admin/quests', '퀘스트', 2], ['admin/shop', '상점', 2], ['admin/games', '미니게임', 2], ['admin/notices', '공지', 2]] },
    { key: 'records', label: '정산 · 기록', icon: 'coin', rank: 2, tabs: [['admin/settle', '주간 정산', 2], ['admin/logs', '활동 기록', 2], ['admin/system', '시스템 설정', 4]] }
  ];
  function groupOf(path) { for (var i = 0; i < GROUPS.length; i++) for (var j = 0; j < GROUPS[i].tabs.length; j++) if (GROUPS[i].tabs[j][0] === path) return GROUPS[i]; return null; }
  function groupTabs(g) { return g.tabs.filter(function (t) { return NC.me.rank >= t[2]; }); }
  NC.groupOf = groupOf;
  var TABS = [['home', '홈', 'home'], ['calendar', '달력', 'cal'], ['games', '게임', 'game'], ['shop', '상점', 'shop'], ['me', '내 현황', 'user']];
  var TITLES = { home: '홈', calendar: '달력', games: '미니게임', shop: '상점', me: '내 현황', ranking: '랭킹', board: '공지 · 한줄 게시판' };
  function pageRank(path) {
    var g = groupOf(path);
    if (!g) return 0;
    for (var j = 0; j < g.tabs.length; j++) if (g.tabs[j][0] === path) return g.tabs[j][2];
    return 2;
  }

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '') || 'home';
    var parts = h.split('?'), q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { path: parts[0], q: q };
  }
  NC.go = function (path) { if (location.hash === '#/' + path) route(); else location.hash = '#/' + path; };

  function shellHtml() {
    var r = NC.me.rank;
    var nav = NAV.filter(function (n) { return !n.rank || r >= n.rank; }).map(function (n) {
      if (n.sec) return '<div class="nav-sec">' + n.sec + '</div>';
      return '<a class="nav-item" data-path="' + n.path + '" href="#/' + n.path + '">' + icon(n.icon) + '<span>' + n.label + '</span></a>';
    }).join('') + GROUPS.filter(function (g) { return r >= g.rank; }).map(function (g) {
      return '<a class="nav-item" data-group="' + g.key + '" href="#/' + groupTabs(g)[0][0] + '">' + icon(g.icon) + '<span>' + g.label + '</span></a>';
    }).join('');
    return '<div class="shell">' +
      '<aside class="side" id="side"><div class="brand">' + NC.logo() + '<div><div class="title">' + esc(NC.settings.groupName) + '</div><div class="sub">공스타그램 스터디그룹</div></div></div>' +
      '<nav>' + nav + '</nav>' +
      '<div class="me-box"><div class="grow"><div class="ellipsis" style="font-weight:600" id="side-me"></div><div class="tiny muted">@' + esc(NC.me.id) + '</div></div>' +
      '<button class="btn ghost icon sm" id="theme-btn" title="화면 모드">' + icon('moon') + '</button>' +
      '<button class="btn ghost icon sm" id="logout-btn" title="로그아웃">' + icon('logout') + '</button></div></aside>' +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="main"><header class="topbar" id="topbar"><button class="btn ghost icon menu-btn" id="menu-btn" aria-label="메뉴">' + icon('menu') + '</button>' +
      '<h1 id="page-title"></h1><div class="right row"><a class="pill" href="#/me" id="top-pie" style="text-decoration:none"></a></div></header>' +
      '<div class="content" id="content"></div></div>' +
      '<nav class="tabbar">' + TABS.map(function (t) { return '<a href="#/' + t[0] + '" data-path="' + t[0] + '">' + icon(t[2]) + '<span>' + t[1] + '</span></a>'; }).join('') + '</nav>' +
      '</div>';
  }
  function updateShellMe() {
    if (!NC.me || !$('#side-me')) return;
    $('#side-me').innerHTML = esc(NC.me.name) + ' ' + badges(NC.me.tags);
    $('#top-pie').innerHTML = '<span style="color:var(--accent)">●</span> ' + num(NC.me.balance) + ' 파이';
  }
  NC.updateShellMe = updateShellMe;

  function applyTheme() {
    var t = null;
    try { t = localStorage.getItem('nc_theme'); } catch (e) {}
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme();

  function mountShell() {
    var app = $('#app');
    app.innerHTML = shellHtml();
    updateShellMe();
    var side = $('#side'), scrim = $('#scrim');
    function closeSide() { side.classList.remove('open'); scrim.classList.remove('on'); }
    $('#menu-btn').onclick = function () { side.classList.add('open'); scrim.classList.add('on'); };
    scrim.onclick = closeSide;
    $$('.nav-item', side).forEach(function (a) { a.addEventListener('click', closeSide); });
    $('#logout-btn').onclick = async function () { if (await NC.confirm('로그아웃할까요?')) NC.logout(); };
    $('#theme-btn').onclick = function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      try { localStorage.setItem('nc_theme', dark ? 'light' : 'dark'); } catch (e) {}
      applyTheme();
    };
    window.addEventListener('scroll', function () { var tb = $('#topbar'); if (tb) tb.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  }

  var routeSeq = 0;
  NC.cleanup = null;
  async function route() {
    if (!NC.me) return;
    if (NC.cleanup) { try { NC.cleanup(); } catch (e) {} NC.cleanup = null; }
    var h = parseHash(), path = h.path;
    if (path.indexOf('admin') === 0 && !groupOf(path)) path = 'admin/judge';
    if (NC.me.rank < pageRank(path)) path = NC.me.rank >= 1 ? 'admin/judge' : 'home';
    if (!NC.pages[path]) path = 'home';
    var g = groupOf(path);
    $$('[data-path]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-path') === path); });
    $$('[data-group]').forEach(function (a) { a.classList.toggle('on', !!g && a.getAttribute('data-group') === g.key); });
    $('#page-title').textContent = g ? g.label : (TITLES[path] || '');
    var host = $('#content');
    host.className = 'content' + (path === 'admin/judge' ? ' wide' : '');
    var el = host;
    if (g) {
      var tabs = groupTabs(g);
      host.innerHTML = (tabs.length > 1 ? '<div class="seg group-tabs">' + tabs.map(function (t) { return '<a href="#/' + t[0] + '" class="' + (t[0] === path ? 'on' : '') + '">' + t[1] + '</a>'; }).join('') + '</div>' : '') + '<div id="group-body"></div>';
      el = $('#group-body');
    }
    el.innerHTML = '<div class="loading"><div class="spinner"></div>불러오는 중…</div>';
    window.scrollTo(0, 0);
    var seq = ++routeSeq;
    try {
      await NC.pages[path](el, h.q, function () { return seq === routeSeq; });
    } catch (e) {
      if (seq === routeSeq) el.innerHTML = '<div class="empty">' + esc(e.message || e) + '<br><br><button class="btn" onclick="location.reload()">다시 시도</button></div>';
      if (e.code !== 'AUTH') console.error(e);
    }
  }
  NC.route = route;

  async function render() {
    if (!NC.me) {
      var ok = await boot();
      if (!ok) return renderLogin();
      mountShell();
      if (NC.games && NC.games.recover) NC.games.recover();
    }
    route();
  }
  NC.render = render;
  window.addEventListener('hashchange', function () { if (NC.me) route(); });

  // 마감 카운트다운 갱신
  setInterval(function () { $$('[data-deadline]').forEach(function (e) { e.textContent = fmtLeft(+e.getAttribute('data-deadline')); }); }, 30000);

  // ============================================================
  // 로그인
  // ============================================================
  async function renderLogin() {
    var app = $('#app');
    app.innerHTML = '<div class="login"><div class="login-box"><div class="brand-big">' + NC.logo() + '<h1>' + esc(CFG.GROUP_NAME || '나침반') + ' 스터디그룹</h1><p>오늘도 방향을 잃지 않고, 한 걸음씩</p></div>' +
      '<div class="card stack" id="login-card"><div class="loading"><div class="spinner"></div></div></div></div></div>';
    var data;
    try { data = await NC.api('public.members'); }
    catch (e) { $('#login-card').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    $('.login h1').textContent = data.groupName + ' 스터디그룹';
    var sel = null;
    var card = $('#login-card');
    card.innerHTML =
      (NC.demo ? '<div class="demo-note"><b>체험판</b> — 예시 데이터로 움직이고, 이 브라우저에만 저장돼요. 모든 계정 비밀번호는 <b>1234</b>예요. (개발자: 개발자 / 대표: 한서윤 / 부대표: 정도윤 / 서포터: 윤하린)</div>' : '') +
      '<label class="field"><span>내 이름 찾기</span><input class="input" id="lg-q" placeholder="이름 또는 아이디로 검색" autocomplete="off"></label>' +
      '<div class="member-pick" id="lg-list"></div>' +
      '<div id="lg-pw" class="stack hidden"><div class="row"><span id="lg-who"></span><button class="btn ghost sm right" id="lg-change">다른 사람</button></div>' +
      '<label class="field"><span>비밀번호</span><input class="input" type="password" id="lg-pwi" autocomplete="current-password"></label>' +
      '<div class="notice-pw">실제 사용하는 비밀번호와 다른 비밀번호를 사용하세요. 관리자가 열람할 수 있습니다.</div>' +
      '<button class="btn primary lg block" id="lg-go">로그인</button></div>';
    function list(q) {
      q = (q || '').trim().toLowerCase();
      var arr = data.members.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || m.id.toLowerCase().indexOf(q) >= 0; });
      $('#lg-list').innerHTML = arr.length ? arr.map(function (m) {
        return '<div class="li" data-id="' + esc(m.id) + '"><b>' + esc(m.name) + '</b><span class="muted small">@' + esc(m.id) + '</span><span class="right">' + badges(m.tags) + '</span></div>';
      }).join('') : '<div class="empty">찾는 멤버가 없어요</div>';
      $$('#lg-list .li').forEach(function (li) { li.onclick = function () { pick(li.getAttribute('data-id')); }; });
    }
    function pick(id) {
      sel = data.members.filter(function (m) { return m.id === id; })[0];
      $('#lg-who').innerHTML = who(sel, { id: true });
      $('#lg-pw').classList.remove('hidden');
      $('#lg-list').classList.add('hidden');
      $('#lg-q').parentNode.classList.add('hidden');
      $('#lg-pwi').value = '';
      $('#lg-pwi').focus();
    }
    $('#lg-change').onclick = function () { sel = null; $('#lg-pw').classList.add('hidden'); $('#lg-list').classList.remove('hidden'); $('#lg-q').parentNode.classList.remove('hidden'); };
    $('#lg-q').oninput = function () { list(this.value); };
    async function go() {
      if (!sel) return;
      var b = $('#lg-go'); b.disabled = true;
      try {
        var r = await NC.api('auth.login', { id: sel.id, pw: $('#lg-pwi').value });
        setToken(r.token);
        NC.me = null;
        if (!location.hash || location.hash === '#/') location.hash = '#/home';
        await render();
      } catch (e) { NC.err(e); b.disabled = false; }
    }
    $('#lg-go').onclick = go;
    $('#lg-pwi').onkeydown = function (e) { if (e.key === 'Enter') go(); };
    list('');
  }

  // ============================================================
  // 미션 행 (홈 · 달력 공용)
  // ============================================================
  function missionMeta(it) {
    var parts = [];
    if (it.mission === 'hours' && (it.inputMin !== null || it.finalMin !== null)) {
      parts.push('입력 ' + fmtMin(it.inputMin) + (it.finalMin !== null ? ' / 확정 ' + fmtMin(it.finalMin) : ''));
    }
    if (it.pie) parts.push('<span class="plus">+' + num(it.pie) + '</span>');
    if (!it.closed && (it.status === 'none' || it.status === 'pending')) parts.push('<span data-deadline="' + it.deadline + '">' + fmtLeft(it.deadline) + '</span>');
    else if (it.closed && it.status === 'none') parts.push('마감됨');
    return parts.join(' · ');
  }
  function missionRows(day, onUpdate) {
    var wrap = document.createElement('div');
    function draw() {
      wrap.innerHTML = day.items.map(function (it) {
        var name = esc(it.name) + (it.required ? ' <span class="badge req">필수</span>' : '');
        var sub = '';
        if (it.mission === 'daily') sub = day.quest ? '<div class="small" style="color:var(--ink-2)">' + esc(day.quest.title) + '</div>' : '<div class="small muted">이번 주 퀘스트 준비 중</div>';
        var act = '';
        if (it.mission === 'attend' && it.canMark) act = '<button class="btn accent sm" data-mark="attend">생존신고</button>';
        else if (it.mission === 'hours' && it.canMark) act = '<button class="btn primary sm" data-mark="hours">' + (it.status === 'pending' ? '수정' : '시간 입력') + '</button>';
        else if (it.canMark) act = '<button class="btn primary sm" data-mark="' + it.mission + '">했어요</button>';
        if (it.canUnmark) act += '<button class="btn ghost sm" data-unmark="' + it.mission + '">취소</button>';
        if (!act) act = statusPill(it.status);
        else if (it.status !== 'none') act = statusPill(it.status) + act;
        return '<div class="mission"><span class="bullet st-' + it.status + '"></span><div class="info"><div class="nm">' + name + '</div>' + sub +
          '<div class="meta">' + missionMeta(it) + '</div></div><div class="act">' + act + '</div></div>';
      }).join('');
      $$('[data-mark]', wrap).forEach(function (b) { b.onclick = function () { mark(b.getAttribute('data-mark'), b); }; });
      $$('[data-unmark]', wrap).forEach(function (b) { b.onclick = function () { unmark(b.getAttribute('data-unmark'), b); }; });
    }
    async function mark(mi, b) {
      var params = { date: day.date, mission: mi };
      if (mi === 'hours') {
        var it = day.items.filter(function (x) { return x.mission === 'hours'; })[0];
        var v = await hoursDialog(it.inputMin);
        if (v === null) return;
        params.inputMin = v;
      }
      b.disabled = true;
      try {
        var r = await NC.api('mission.mark', params);
        day = r.day; draw();
        toast(mi === 'attend' ? '생존신고 완료! +' + NC.settings.rewards.attend + ' 파이' : '체크했어요. 운영진 확인 후 파이가 지급돼요.', 'ok');
        if (mi === 'attend' || mi === 'study') NC.refreshMe();
        if (onUpdate) onUpdate(day);
      } catch (e) { NC.err(e); b.disabled = false; }
    }
    async function unmark(mi, b) {
      b.disabled = true;
      try { var r = await NC.api('mission.unmark', { date: day.date, mission: mi }); day = r.day; draw(); toast('체크를 취소했어요.'); if (onUpdate) onUpdate(day); }
      catch (e) { NC.err(e); b.disabled = false; }
    }
    draw();
    return wrap;
  }
  function hoursDialog(cur) {
    return new Promise(function (res) {
      var h = cur ? Math.floor(cur / 60) : '', m = cur ? cur % 60 : '';
      var done = false;
      modal({ title: '공부시간 입력', body: '<p class="small muted" style="margin-top:0">열품타 기록이나 인증 사진에 맞춰 입력하세요. 운영진이 확인 후 최종 시간을 확정해요. (1시간당 ' + NC.settings.rewards.hourPer + '파이, 분 단위 버림, 최대 ' + NC.settings.rewards.hourCap + '시간)</p>' +
        '<div class="row"><label class="field grow"><span>시간</span><input class="input" type="number" inputmode="numeric" min="0" max="24" id="hd-h" value="' + h + '"></label>' +
        '<label class="field grow"><span>분</span><input class="input" type="number" inputmode="numeric" min="0" max="59" id="hd-m" value="' + m + '"></label></div>',
        actions: [{ label: '취소' }, { label: '체크', cls: 'primary', onClick: function (c, w) {
          var v = (+$('#hd-h', w).value || 0) * 60 + (+$('#hd-m', w).value || 0);
          if (v <= 0 || v > 1440) { toast('시간을 올바르게 입력하세요.', 'err'); return false; }
          done = true; res(v);
        } }], onClose: function () { if (!done) res(null); } });
    });
  }
  NC.missionRows = missionRows;

  function weeklyBlock(wv, onUpdate, label) {
    var div = document.createElement('div');
    function draw() {
      var r = wv.rec, act = '';
      if (r.canMark) act = '<button class="btn primary sm" data-w="mark">했어요</button>';
      if (r.canUnmark) act += '<button class="btn ghost sm" data-w="unmark">취소</button>';
      act = (r.status !== 'none' || !act ? statusPill(r.status) : '') + act;
      div.innerHTML = '<div class="quest"><div class="row"><span class="badge soft">' + (label || '이번 주 위클리') + '</span><span class="tiny muted">+' + NC.settings.rewards.weekly + ' 파이</span><span class="right row">' + act + '</span></div>' +
        (wv.quest ? '<div class="t" style="margin-top:6px">' + esc(wv.quest.title) + '</div>' + (wv.quest.desc ? '<div class="d">' + esc(wv.quest.desc) + '</div>' : '') +
          '<div class="tiny muted" style="margin-top:4px">체크 마감 ' + fmtDeadline(r.deadline) + (r.pie ? ' · <span class="plus">+' + r.pie + '</span>' : '') + '</div>'
          : '<div class="d muted" style="margin-top:6px">이번 주 퀘스트 준비 중</div>') + '</div>';
      $$('[data-w]', div).forEach(function (b) {
        b.onclick = async function () {
          b.disabled = true;
          try {
            var res = await NC.api(b.getAttribute('data-w') === 'mark' ? 'mission.mark' : 'mission.unmark', { date: wv.week, mission: 'weekly' });
            wv = res.weekly; draw(); if (onUpdate) onUpdate();
          } catch (e) { NC.err(e); b.disabled = false; }
        };
      });
    }
    draw();
    return div;
  }
  NC.weeklyBlock = weeklyBlock;

  // ============================================================
  // 홈
  // ============================================================
  NC.pages.home = async function (el, q, alive) {
    var d = await NC.api('home');
    if (!alive()) return;
    NC.me.balance = d.balance; updateShellMe();
    var G = d.game;
    var hello = ['좋은 아침이에요', '오늘도 힘내요', '집중하는 오후', '오늘 하루 수고했어요'][Math.min(3, Math.floor(new Date(Date.now() + KST).getUTCHours() / 6))];
    el.innerHTML =
      '<div class="stack">' +
      '<div class="hero">' + NC.logo('compass-bg') + '<div class="hello">' + hello + ' · ' + mdw(d.today) + '</div><div class="name">' + esc(NC.me.name) + '님</div>' +
      '<div class="nums"><div><div class="k">파이 잔액</div><div class="v num">' + num(d.balance) + '</div></div><div><div class="k">경고</div><div class="v num">' + d.warnings + '<span style="font-size:14px;opacity:.7">/' + d.expelAt + '</span></div></div>' +
      (G.game ? '<div><div class="k">미니게임</div><div class="v num">' + G.remaining + '<span style="font-size:14px;opacity:.7">회 남음</span></div></div>' : '') + '</div></div>' +
      '<div id="h-banners" class="stack" style="gap:8px"></div>' +
      '<div class="grid2">' +
      '<div class="card"><div class="card-head"><h2>오늘의 미션</h2>' + (d.day.dayoff ? '<span class="dayoff-tag">OFF 데이오프</span>' : '') + '<a class="more" href="#/calendar">달력 ›</a></div><div id="h-missions"></div></div>' +
      '<div class="stack">' +
      '<div class="card"><div class="card-head"><h2>퀘스트</h2></div><div class="stack" id="h-quests" style="gap:10px"></div></div>' +
      '<a class="card" href="#/games" style="text-decoration:none;display:block"><div class="game-hero"><div class="gi">' + (NC.games ? NC.games.emoji(G.game) : '🎮') + '</div><div class="grow"><div class="small muted">오늘의 미니게임</div>' +
      '<div style="font-weight:700;font-size:17px">' + (G.game ? esc(G.gameName) : '오늘은 쉬어요') + '</div><div class="small muted">기회 ' + G.used + '/' + G.chances.total + ' · 오늘 ' + G.earned + ' / ' + G.maxPerDay + ' 파이</div></div><span class="btn primary sm">하러 가기</span></div></a>' +
      '</div></div>' +
      '<div class="grid2">' +
      '<div class="card"><div class="card-head"><h2>공지</h2>' + (d.newNotices ? '<span class="badge new">N ' + d.newNotices + '</span>' : '') + '<a class="more" href="#/board">전체 ›</a></div><div id="h-notices"></div></div>' +
      '<div class="card"><div class="card-head"><h2>한줄 게시판</h2><a class="more" href="#/board?tab=posts">더 보기 ›</a></div><div id="h-posts"></div></div>' +
      '</div></div>';
    // 배너
    $('#h-banners').innerHTML = d.banners.map(function (b) {
      var go = b.kind === 'game' ? '#/games' : b.kind === 'yesterday' ? '#/calendar?date=' + b.date : b.kind === 'weekly' ? '#/calendar?date=' + b.week : '#/home';
      return '<a class="banner' + (b.deadline - Date.now() < 3 * 3600000 ? ' urgent' : '') + '" href="' + go + '" style="text-decoration:none;color:inherit">⏰ <span class="grow"><b>' + esc(b.text) + '</b> · ' + fmtDeadline(b.deadline) + ' 마감</span><span class="small muted" data-deadline="' + b.deadline + '">' + fmtLeft(b.deadline) + '</span></a>';
    }).join('');
    $('#h-missions').appendChild(missionRows(d.day, function () { NC.refreshMe(); }));
    var qs = $('#h-quests');
    var dq = document.createElement('div');
    dq.innerHTML = '<div class="quest"><div class="row"><span class="badge soft">오늘의 데일리</span><span class="tiny muted">+' + NC.settings.rewards.daily + ' 파이</span></div>' +
      (d.day.quest ? '<div class="t" style="margin-top:6px">' + esc(d.day.quest.title) + '</div>' + (d.day.quest.desc ? '<div class="d">' + esc(d.day.quest.desc) + '</div>' : '') : '<div class="d muted" style="margin-top:6px">이번 주 퀘스트 준비 중</div>') + '</div>';
    qs.appendChild(dq);
    qs.appendChild(weeklyBlock(d.weekly));
    if (d.lastWeekly && d.lastWeekly.quest && (d.lastWeekly.rec.canMark || d.lastWeekly.rec.canUnmark)) qs.appendChild(weeklyBlock(d.lastWeekly, null, '지난주 위클리'));
    $('#h-notices').innerHTML = d.pinned.length ? '<div class="list">' + d.pinned.map(function (n) {
      return '<a class="li" href="#/board?notice=' + n.id + '" style="text-decoration:none">📌 <span class="grow ellipsis">' + (n.important ? '<b>[중요]</b> ' : '') + esc(n.title) + '</span>' + (n.isNew ? '<span class="badge new">N</span>' : '') + '</a>';
    }).join('') + '</div>' : '<div class="empty">고정된 공지가 없어요</div>';
    $('#h-posts').innerHTML = d.posts.length ? '<div class="list">' + d.posts.map(function (p) {
      return '<div class="li" style="align-items:flex-start"><div class="grow"><div class="row small">' + who(p.author) + '<span class="muted tiny right">' + fmtAgo(p.at) + '</span></div><div style="margin-top:3px;word-break:break-word">' + esc(p.text) + '</div></div></div>';
    }).join('') + '</div>' : '<div class="empty">아직 글이 없어요</div>';
  };

  // ============================================================
  // 달력
  // ============================================================
  NC.pages.calendar = async function (el, q, alive) {
    var t = today();
    var month = (q.date || t).slice(0, 7);
    async function draw() {
      var d = await NC.api('calendar', { month: month });
      if (!alive()) return;
      var first = month + '-01', start = addDays(first, -dow(first));
      var byDate = {};
      d.recs.forEach(function (r) { (byDate[r.date] = byDate[r.date] || {})[r.mission] = r.status; });
      var offs = {};
      d.dayoffs.forEach(function (o) { offs[o.date] = o; });
      var cells = '';
      for (var i = 0; i < 42; i++) {
        var day = addDays(start, i);
        if (i >= 35 && day.slice(0, 7) !== month) break;
        var recs = byDate[day] || {};
        var dots = NC.MISSIONS.map(function (mi) { var st = recs[mi]; return st && st !== 'none' ? '<span class="dot st-' + st + '" title="' + NC.MISSION_NAMES[mi] + '"></span>' : ''; }).join('');
        cells += '<div class="d' + (day.slice(0, 7) !== month ? ' out' : '') + (day === t ? ' today' : '') + (offs[day] ? ' off' : '') + (day > t ? ' future' : '') + '" data-d="' + day + '">' +
          '<span class="n">' + (+day.slice(8)) + '</span>' + (offs[day] ? '<span class="off-l">OFF</span>' : '') + '<span class="dots">' + dots + '</span></div>';
      }
      var y = +month.slice(0, 4), m = +month.slice(5, 7);
      el.innerHTML = '<div class="card"><div class="row" style="margin-bottom:12px"><button class="btn icon ghost" id="c-prev">' + icon('left') + '</button>' +
        '<h2 style="font-size:18px">' + y + '년 ' + m + '월</h2><button class="btn icon ghost" id="c-next">' + icon('right') + '</button>' +
        '<button class="btn sm right" id="c-today">오늘</button></div>' +
        '<div class="cal">' + DOW.map(function (w) { return '<div class="dh">' + w + '</div>'; }).join('') + cells + '</div>' +
        '<div class="legend"><span><i class="dot st-ok"></i>확인 완료</span><span><i class="dot st-pending"></i>확인 대기</span><span><i class="dot st-fail"></i>미수행</span><span><span class="dayoff-tag" style="padding:0 5px">OFF</span>데이오프</span></div>' +
        '<p class="tiny muted" style="margin:4px 2px 0">날짜를 누르면 그날의 미션을 보고, 마감 전이면 체크할 수 있어요.</p></div>';
      function shift(n) { var mm = m + n, yy = y; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } month = yy + '-' + pad(mm); draw(); }
      $('#c-prev').onclick = function () { shift(-1); };
      $('#c-next').onclick = function () { shift(1); };
      $('#c-today').onclick = function () { month = t.slice(0, 7); draw(); };
      $$('.cal .d', el).forEach(function (c) { c.onclick = function () { var dd = c.getAttribute('data-d'); if (dd <= t) openDay(dd); }; });
    }
    async function openDay(date) {
      var m = modal({ title: mdw(date), body: '<div class="loading"><div class="spinner"></div></div>', onClose: function () { draw(); } });
      try {
        var r = await NC.api('mission.day', { date: date });
        m.body.innerHTML = r.day.dayoff ? '<div style="margin-bottom:6px"><span class="dayoff-tag">OFF 데이오프</span> <span class="small muted">' + (r.day.dayoff.mode === 'self' ? '본인 신청' : '운영진 지정') + '</span></div>' : '';
        if (r.day.locked) m.body.innerHTML += '<div class="small muted" style="margin-bottom:6px">🔒 정산이 끝난 주예요</div>';
        m.body.appendChild(missionRows(r.day));
        var wk = document.createElement('div'); wk.style.marginTop = '12px';
        wk.appendChild(weeklyBlock(r.weekly, null, mdw(r.weekly.week) + ' 주 위클리'));
        m.body.appendChild(wk);
      } catch (e) { m.body.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    }
    await draw();
    if (q.date && q.date <= t) openDay(q.date);
  };

  // ============================================================
  // 내 현황
  // ============================================================
  NC.pages.me = async function (el, q, alive) {
    var d = await NC.api('me.status');
    if (!alive()) return;
    NC.me = d.me; updateShellMe();
    var t = d.today, weekEnd = addDays(d.week, 6);
    var prog = Object.keys(d.progress).map(function (k) {
      var p = d.progress[k], keys = Object.keys(p.table).map(Number).sort(function (a, b) { return a - b; });
      var next = keys.filter(function (n) { return n > p.done; })[0];
      return '<div style="margin-bottom:10px"><div class="row small"><b>' + p.name + '</b><span class="muted">' + p.done + '/7' + (p.pending ? ' (대기 ' + p.pending + ')' : '') + '</span>' +
        '<span class="right">' + (p.bonusNow ? '<span class="plus">+' + p.bonusNow + '</span>' : next ? '<span class="muted tiny">' + next + '일이면 +' + p.table[next] + '</span>' : '') + '</span></div>' +
        '<div class="bar" style="margin-top:4px"><i style="width:' + Math.round(p.done / 7 * 100) + '%"></i></div></div>';
    }).join('');
    var offRows = d.dayoffs.map(function (o) {
      return '<div class="li"><span class="dayoff-tag">OFF</span><b>' + mdw(o.date) + '</b><span class="small muted">' + (o.mode === 'self' ? '본인 신청' : '운영진 지정' + (o.reason ? ' · ' + esc(o.reason) : '')) + '</span>' +
        (o.mode === 'self' && o.date > t ? '<button class="btn sm ghost right" data-cancel-off="' + o.id + '">취소</button>' : '') + '</div>';
    }).join('');
    var dates = [];
    for (var x = t; x <= weekEnd; x = addDays(x, 1)) dates.push(x);
    el.innerHTML = '<div class="stack">' +
      '<div class="grid3">' +
      '<div class="stat"><div class="k">파이 잔액</div><div class="v num">' + num(d.balance) + '</div></div>' +
      '<div class="stat"><div class="k">이번 주 획득</div><div class="v num">' + signed(d.weekEarned) + '</div></div>' +
      '<div class="stat' + (d.warnCount >= d.expelAt - 1 && d.warnCount ? ' alert' : '') + '"><div class="k">경고</div><div class="v num">' + d.warnCount + '<small>/ ' + d.expelAt + '</small></div></div>' +
      '<div class="stat"><div class="k">연속 기록 🔥</div><div class="v" style="font-size:17px;margin-top:6px">생존 ' + d.streaks.attend + '일 · 공부 ' + d.streaks.study + '일</div></div>' +
      '</div>' +
      '<div class="grid2">' +
      '<div class="card"><div class="card-head"><h2>주간 보너스 진행</h2><span class="small muted">' + md(d.week) + ' ~ ' + md(weekEnd) + '</span></div>' + prog + '</div>' +
      '<div class="stack"><div class="card"><div class="card-head"><h2>이번 주 공부시간</h2><a class="more" href="#/ranking">랭킹 ›</a></div>' +
      '<div class="row"><div class="big-num" style="font-size:34px">' + fmtHM(d.studyMin) + '</div><div class="right center">' + (d.rank ? '<div class="small muted">현재</div><div style="font-size:22px;font-weight:800">' + d.rank + '등</div>' + (d.rankBonus ? '<div class="tiny plus">+' + num(d.rankBonus) + '</div>' : '') : '<div class="small muted">순위 없음</div>') + '</div></div>' +
      '<div class="tiny muted">운영진이 확정한 시간만 합산돼요.</div></div>' +
      '<div class="card"><div class="card-head"><h2>데이오프</h2><span class="small muted">본인 신청 주 1회</span></div>' +
      (offRows ? '<div class="list">' + offRows + '</div>' : '<div class="small muted">이번 주 데이오프 없음</div>') +
      (!d.dayoffSelfUsed ? '<div class="row" style="margin-top:10px"><select class="input sm grow" id="off-date">' + dates.map(function (x) { return '<option value="' + x + '">' + mdw(x) + (x === t ? ' · 오늘' : '') + '</option>'; }).join('') + '</select><button class="btn sm primary" id="off-req">신청</button></div>' +
        '<div class="tiny muted" style="margin-top:6px">신청하면 바로 적용돼요. 그날 필수 미션을 안 해도 경고 후보에 오르지 않아요. (파이는 지급되지 않음)</div>' : '') +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><h2>경고 내역</h2><span class="small muted">' + d.warnCount + '/' + d.expelAt + '</span></div>' +
      (d.warnings.length ? '<div class="list">' + d.warnings.map(function (w) {
        return '<div class="li" style="align-items:flex-start' + (w.canceled ? ';opacity:.55' : '') + '"><span class="badge ' + (w.canceled ? 'soft' : 'req') + '">' + (w.canceled ? '취소됨' : '경고') + '</span><div class="grow"><div>' + esc(w.reason) + '</div>' +
          '<div class="tiny muted">' + (w.refDate ? mdw(w.refDate) + ' ' + esc(w.refName) + ' · ' : '') + fmtDT(w.at) + (w.canceled ? ' · ' + esc(w.canceledByName) + (w.cancelReason ? ' (' + esc(w.cancelReason) + ')' : '') : '') + '</div></div></div>';
      }).join('') + '</div>' : '<div class="small muted">경고가 없어요 👏</div>') + '</div>' +
      '<div class="card"><div class="card-head"><div class="seg" id="me-tab"><button class="on" data-t="ledger">파이 내역</button><button data-t="buy">구매 내역</button></div></div><div id="me-list"></div></div>' +
      '<div class="card"><div class="card-head"><h2>비밀번호 변경</h2></div><div class="notice-pw" style="margin-bottom:10px">실제 사용하는 비밀번호와 다른 비밀번호를 사용하세요. 관리자가 열람할 수 있습니다.</div>' +
      '<div class="form-grid"><label class="field"><span>현재 비밀번호</span><input class="input" type="password" id="pw-old"></label><label class="field"><span>새 비밀번호</span><input class="input" type="password" id="pw-new"></label></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn primary" id="pw-save">변경</button><button class="btn ghost right" id="me-logout">' + icon('logout') + ' 로그아웃</button></div></div>' +
      '</div>';
    function list(tab) {
      if (tab === 'ledger') {
        $('#me-list').innerHTML = d.ledger.length ? '<div class="list">' + d.ledger.map(function (l) {
          return '<div class="li"><div class="grow"><div class="small"><b>' + esc(l.typeName) + '</b> ' + (l.refDate ? '<span class="muted">' + md(l.refDate) + '</span> ' : '') + esc(['mission', 'rejudge', 'sheet', 'game', 'weekly'].indexOf(l.type) >= 0 ? l.refName : '') + '</div>' +
            '<div class="tiny muted">' + fmtDT(l.at) + (l.reason ? ' · ' + esc(l.reason) : '') + '</div></div><span class="num ' + (l.amount > 0 ? 'plus' : 'minus') + '">' + signed(l.amount) + '</span></div>';
        }).join('') + '</div>' : '<div class="empty">아직 내역이 없어요</div>';
      } else {
        $('#me-list').innerHTML = d.purchases.length ? '<div class="list">' + d.purchases.map(function (p) {
          return '<div class="li"><div class="grow"><b>' + esc(p.productName) + '</b><div class="tiny muted">' + fmtDT(p.at) + '</div></div><span class="num">' + num(p.price) + '</span>' + purchasePill(p.status) + '</div>';
        }).join('') + '</div>' : '<div class="empty">구매 내역이 없어요</div>';
      }
    }
    $$('#me-tab button').forEach(function (b) { b.onclick = function () { $$('#me-tab button').forEach(function (x) { x.classList.toggle('on', x === b); }); list(b.getAttribute('data-t')); }; });
    list('ledger');
    if ($('#off-req')) $('#off-req').onclick = async function () {
      var date = $('#off-date').value;
      if (!(await NC.confirm(mdw(date) + '을(를) 데이오프로 신청할까요?\n이번 주 본인 신청은 1회만 할 수 있어요.'))) return;
      try { await NC.api('dayoff.request', { date: date }); toast('데이오프를 신청했어요.', 'ok'); route(); } catch (e) { NC.err(e); }
    };
    $$('[data-cancel-off]').forEach(function (b) { b.onclick = async function () {
      if (!(await NC.confirm('데이오프 신청을 취소할까요?'))) return;
      try { await NC.api('dayoff.cancel', { id: b.getAttribute('data-cancel-off') }); toast('취소했어요.'); route(); } catch (e) { NC.err(e); }
    }; });
    $('#pw-save').onclick = async function () {
      try {
        var r = await NC.api('me.password', { oldPw: $('#pw-old').value, newPw: $('#pw-new').value });
        setToken(r.token); toast('비밀번호를 바꿨어요.', 'ok'); $('#pw-old').value = ''; $('#pw-new').value = '';
      } catch (e) { NC.err(e); }
    };
    $('#me-logout').onclick = async function () { if (await NC.confirm('로그아웃할까요?')) NC.logout(); };
  };
  function purchasePill(st) {
    return st === 'waiting' ? '<span class="pill st-pending">지급 대기</span>' : st === 'done' ? '<span class="pill st-ok">지급 완료</span>' : '<span class="pill st-none">취소됨</span>';
  }
  NC.purchasePill = purchasePill;

  // ============================================================
  // 상점
  // ============================================================
  NC.pages.shop = async function (el, q, alive) {
    var d = await NC.api('shop.list');
    if (!alive()) return;
    NC.me.balance = d.balance; updateShellMe();
    el.innerHTML = '<div class="stack"><div class="row"><div class="stat grow"><div class="k">내 파이</div><div class="v num">' + num(d.balance) + '</div></div></div>' +
      (d.products.length ? '<div class="grid3">' + d.products.map(function (p) {
        var reason = '';
        if (p.stock !== null && p.stock <= 0) reason = '품절';
        else if (p.myLeft !== null && p.myLeft <= 0) reason = p.limitType === 'weekly' ? '이번 주 구매 완료' : '구매 완료';
        else if (p.type === 'warn' && d.warnings <= 0) reason = '차감할 경고 없음';
        else if (d.balance < p.price) reason = '파이 부족';
        var lim = p.limitType === 'total' ? '1인 ' + p.limitN + '개 (남은 ' + p.myLeft + ')' : p.limitType === 'weekly' ? '1인 주당 ' + p.limitN + '개 (남은 ' + p.myLeft + ')' : '구매 제한 없음';
        return '<div class="card product"><div class="row"><h3 class="grow">' + esc(p.name) + '</h3>' + (p.type === 'warn' ? '<span class="badge req">경고 차감</span>' : '') + '</div>' +
          (p.desc ? '<div class="small" style="color:var(--ink-2);white-space:pre-wrap">' + esc(p.desc) + '</div>' : '') +
          '<div class="tiny muted">' + (p.stock === null ? '재고 무제한' : p.stock <= 0 ? '품절' : '재고 ' + p.stock + '개') + ' · ' + lim + '</div>' +
          '<div class="row" style="margin-top:auto"><div class="price num">' + num(p.price) + '<small> 파이</small></div><button class="btn ' + (reason ? '' : 'primary') + ' right" data-buy="' + p.id + '"' + (reason ? ' disabled' : '') + '>' + (reason || '구매') + '</button></div></div>';
      }).join('') + '</div>' : '<div class="card empty">아직 판매 중인 상품이 없어요</div>') +
      '<div class="card"><div class="card-head"><h2>내 구매 내역</h2></div>' + (d.purchases.length ? '<div class="list">' + d.purchases.map(function (p) {
        return '<div class="li"><div class="grow"><b>' + esc(p.productName) + '</b><div class="tiny muted">' + fmtDT(p.at) + '</div></div><span class="num small">' + num(p.price) + '</span>' + purchasePill(p.status) + '</div>';
      }).join('') + '</div>' : '<div class="empty">구매 내역이 없어요</div>') + '</div></div>';
    $$('[data-buy]', el).forEach(function (b) {
      b.onclick = async function () {
        var p = d.products.filter(function (x) { return x.id === b.getAttribute('data-buy'); })[0];
        var msg = p.name + '\n' + num(p.price) + ' 파이를 사용합니다. (잔액 ' + num(d.balance) + ' → ' + num(d.balance - p.price) + ')' + (p.type === 'warn' ? '\n구매 즉시 경고 1회가 차감돼요.' : '\n구매 후 운영진이 직접 전달해 드려요.');
        if (!(await NC.confirm(msg, { title: '구매 확인', ok: '구매' }))) return;
        try { await NC.api('shop.buy', { productId: p.id }); toast('구매했어요!', 'ok'); NC.refreshMe(); route(); } catch (e) { NC.err(e); }
      };
    });
  };

  // ============================================================
  // 랭킹
  // ============================================================
  function rankRows(list, meId) {
    return list.length ? list.map(function (x) {
      return '<div class="rank-row' + (x.memberId === meId ? ' me' : '') + '"><span class="rank-no' + (x.rank <= 3 ? ' r' + x.rank : '') + '">' + x.rank + '</span>' +
        '<div class="grow">' + who({ name: x.name, tags: x.tags }) + '</div><div class="right" style="text-align:right"><div class="num" style="font-weight:700">' + fmtHM(x.minutes) + '</div>' +
        (x.bonus ? '<div class="tiny plus">+' + num(x.bonus) + '</div>' : '') + '</div></div>';
    }).join('') : '<div class="empty">아직 확정된 공부시간이 없어요</div>';
  }
  NC.rankRows = rankRows;
  NC.pages.ranking = async function (el, q, alive) {
    var d = await NC.api('ranking');
    if (!alive()) return;
    var last = d.last;
    el.innerHTML = '<div class="grid2"><div class="card"><div class="card-head"><h2>이번 주 공부시간 랭킹</h2><span class="small muted">' + md(d.week) + ' ~ ' + md(addDays(d.week, 6)) + ' · 실시간</span></div>' +
      '<p class="tiny muted" style="margin:-6px 0 8px">운영진이 확정한 시간 기준 · 보너스 ' + d.rankBonus.map(function (b, i) { return (i + 1) + '등 ' + num(b); }).join(' / ') + '</p>' +
      rankRows(d.list, NC.me.id) + '</div>' +
      '<div class="card"><div class="card-head"><h2>지난 정산 결과</h2>' + (last ? '<span class="small muted">' + md(last.week) + ' ~ ' + md(addDays(last.week, 6)) + '</span>' : '') + '</div>' +
      (last ? rankRows(last.ranking.filter(function (x) { return x.rank <= 5; }), NC.me.id) +
        (last.mine ? '<div class="quest" style="margin-top:12px"><div class="t">내 정산: <span class="plus">+' + num(last.mine.total) + ' 파이</span></div><div class="d">생존 ' + last.mine.counts.attend + '일 · 공부 ' + last.mine.counts.study + '일 · 문제 ' + last.mine.counts.problem + '일 · 멘토링 ' + last.mine.counts.mentoring + '일 · 데일리 ' + last.mine.counts.daily + '일</div></div>' : '') +
        (last.perfect.length ? '<div class="small" style="margin-top:12px">🌟 필수 인증 개근: ' + last.perfect.map(esc).join(', ') + '</div>' : '')
        : '<div class="empty">아직 정산된 주가 없어요</div>') + '</div></div>';
  };

  // ============================================================
  // 공지 · 한줄 게시판
  // ============================================================
  NC.openNotice = function (n) {
    modal({ title: n.title, wide: true, body: '<div class="row small muted" style="margin-bottom:10px">' + (n.important ? '<span class="badge req">중요</span>' : '') + (n.pinned ? '📌 ' : '') + esc(n.authorName) + ' · ' + fmtDT(n.at) + '</div><div class="notice-body">' + esc(n.body) + '</div>' });
  };
  NC.pages.board = async function (el, q, alive) {
    var tab = q.tab === 'posts' ? 'posts' : 'notices';
    el.innerHTML = '<div class="stack"><div class="seg" id="bd-tab"><button data-t="notices">공지사항</button><button data-t="posts">한줄 게시판</button></div><div id="bd-body"></div></div>';
    function setTab(t) {
      tab = t;
      $$('#bd-tab button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
      if (t === 'notices') notices(); else posts();
    }
    $$('#bd-tab button').forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-t')); }; });
    async function notices() {
      var box = $('#bd-body');
      box.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      var list = (await NC.api('notices.list')).filter(function (n) { return !n.draft; });
      if (!alive()) return;
      box.innerHTML = '<div class="card">' + (NC.me.rank >= 2 ? '<div class="row" style="margin-bottom:6px"><a class="btn sm right" href="#/admin/notices">공지 관리</a></div>' : '') +
        (list.length ? list.map(function (n) {
          return '<div class="notice-item" data-n="' + n.id + '"><div class="row">' + (n.pinned ? '📌' : '') + (n.important ? '<span class="badge req">중요</span>' : '') + '<b class="grow ellipsis">' + esc(n.title) + '</b>' + (n.isNew ? '<span class="badge new">N</span>' : '') + '</div>' +
            '<div class="tiny muted">' + esc(n.authorName) + ' · ' + fmtDT(n.at) + '</div></div>';
        }).join('') : '<div class="empty">공지가 없어요</div>') + '</div>';
      $$('[data-n]', box).forEach(function (x) { x.onclick = function () { NC.openNotice(list.filter(function (n) { return n.id === x.getAttribute('data-n'); })[0]); }; });
      if (q.notice) { var n = list.filter(function (x) { return x.id === q.notice; })[0]; if (n) NC.openNotice(n); q.notice = null; }
    }
    var items = [], more = false;
    async function posts(append) {
      var box = $('#bd-body');
      if (!append) {
        box.innerHTML = '<div class="card"><div class="stack" style="gap:8px"><textarea class="input" id="ps-text" maxlength="150" rows="2" placeholder="오늘의 한 줄을 남겨보세요 (최대 150자)"></textarea>' +
          '<div class="row"><span class="counter" id="ps-cnt">0/150</span><button class="btn primary sm right" id="ps-go">올리기</button></div></div></div>' +
          '<div class="card" style="margin-top:12px"><div id="ps-list"><div class="loading"><div class="spinner"></div></div></div><div class="center" id="ps-more"></div></div>';
        $('#ps-text').oninput = function () { $('#ps-cnt').textContent = this.value.length + '/150'; };
        $('#ps-go').onclick = async function () {
          var b = this; b.disabled = true;
          try { var p = await NC.api('posts.create', { text: $('#ps-text').value }); $('#ps-text').value = ''; $('#ps-cnt').textContent = '0/150'; items.unshift(p); draw(); }
          catch (e) { NC.err(e); } finally { b.disabled = false; }
        };
        items = [];
      }
      var r = await NC.api('posts.list', { limit: 30, before: append && items.length ? items[items.length - 1].id : undefined });
      if (!alive()) return;
      items = items.concat(r.posts); more = r.more;
      draw();
    }
    function draw() {
      var meId = NC.me.id, rank = NC.me.rank;
      $('#ps-list').innerHTML = items.length ? items.map(function (p) {
        var rx = NC.REACTIONS.filter(function (r) { return p.reactions[r[0]] && p.reactions[r[0]].length; }).map(function (r) {
          var arr = p.reactions[r[0]], mine = arr.some(function (x) { return x.id === meId; });
          return '<button class="' + (mine ? 'mine' : '') + '" data-rx="' + r[0] + '" title="' + esc(arr.map(function (x) { return x.name; }).join(', ')) + '">' + r[1] + ' <span class="num">' + arr.length + '</span></button>';
        }).join('');
        var tools = '';
        if (p.author.id === meId || rank >= 2) tools += '<button class="btn ghost sm" data-del>삭제</button>';
        if (rank >= 1) tools += '<button class="btn ghost sm" data-hide>' + (p.hidden ? '숨김 해제' : '숨김') + '</button>';
        return '<div class="post' + (p.hidden ? ' hidden-post' : '') + '" data-p="' + p.id + '"><div class="row small">' + who(p.author) + (p.hidden ? '<span class="badge soft">숨김</span>' : '') + '<span class="muted tiny right">' + fmtAgo(p.at) + '</span></div>' +
          '<div class="txt">' + esc(p.text) + '</div><div class="rx">' + rx + '<button class="add" data-add>＋😊</button><span class="right row" style="gap:2px">' + tools + '</span></div></div>';
      }).join('') : '<div class="empty">아직 글이 없어요. 첫 글을 남겨보세요!</div>';
      $('#ps-more').innerHTML = more ? '<button class="btn sm" style="margin-top:10px">더 보기</button>' : '';
      if (more) $('#ps-more button').onclick = function () { posts(true); };
      $$('.post', $('#ps-list')).forEach(function (pe) {
        var id = pe.getAttribute('data-p'), p = items.filter(function (x) { return x.id === id; })[0];
        $$('[data-rx]', pe).forEach(function (b) {
          var timer = null, long = false;
          b.addEventListener('touchstart', function () { long = false; timer = setTimeout(function () { long = true; toast(b.title); }, 450); }, { passive: true });
          b.addEventListener('touchend', function () { clearTimeout(timer); });
          b.addEventListener('touchmove', function () { clearTimeout(timer); }, { passive: true });
          b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
          b.onclick = function () { if (long) { long = false; return; } react(p, b.getAttribute('data-rx')); };
        });
        $('[data-add]', pe).onclick = function (e) {
          var old = $('.rx-pick'); if (old) old.remove();
          var pk = document.createElement('div');
          pk.className = 'rx-pick';
          pk.innerHTML = NC.REACTIONS.map(function (r) { return '<button data-k="' + r[0] + '">' + r[1] + '</button>'; }).join('');
          pe.appendChild(pk);
          $$('button', pk).forEach(function (b) { b.onclick = function () { pk.remove(); react(p, b.getAttribute('data-k')); }; });
          setTimeout(function () { document.addEventListener('click', function off(ev) { if (!pk.contains(ev.target)) { pk.remove(); document.removeEventListener('click', off); } }); }, 0);
          e.stopPropagation();
        };
        var del = $('[data-del]', pe), hide = $('[data-hide]', pe);
        if (del) del.onclick = async function () {
          if (!(await NC.confirm('이 글을 삭제할까요?', { danger: true, ok: '삭제' }))) return;
          try { await NC.api('posts.delete', { id: id }); items = items.filter(function (x) { return x.id !== id; }); draw(); } catch (e) { NC.err(e); }
        };
        if (hide) hide.onclick = async function () {
          try { await NC.api('posts.hide', { id: id, hidden: !p.hidden }); p.hidden = !p.hidden; draw(); } catch (e) { NC.err(e); }
        };
      });
    }
    async function react(p, kind) {
      try { var r = await NC.api('posts.react', { id: p.id, kind: kind }); p.reactions = r.reactions; draw(); } catch (e) { NC.err(e); }
    }
    setTab(tab);
  };

  // ============================================================
  // 시작
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () { render(); });
})();
