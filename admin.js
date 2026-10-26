/* 운영 화면 */
(function () {
  var NC = window.NC, U = NC.u, $ = U.$, $$ = U.$$, esc = U.esc;
  var P = NC.pages;
  function opts(list, cur) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function memberOpts(ms, cur, empty) { return (empty ? '<option value="">' + empty + '</option>' : '') + opts(ms.map(function (m) { return [m.id, m.name + ' (@' + m.id + ')']; }), cur); }
  NC.opts = opts; NC.memberOpts = memberOpts;
  function attr(o) { return esc(JSON.stringify(o)); }

  // ============================================================
  // 오늘 할 일
  // ============================================================
  P.admin = async function (el, q, alive) {
    var d = await NC.api('admin.home');
    if (!alive()) return;
    function tile(k, v, href, alert, sub) { return '<a class="stat link' + (alert ? ' alert' : '') + '" href="#/' + href + '"><div class="k">' + k + '</div><div class="v num">' + v + (sub ? '<small>' + sub + '</small>' : '') + '</div></a>'; }
    var alerts = [];
    if (d.maintenance) alerts.push('<a class="banner urgent" href="#/admin/system" style="text-decoration:none;color:inherit">🛠 지금 점검 중 모드예요. 멤버들은 들어올 수 없어요 — 시스템 설정에서 끌 수 있어요</a>');
    d.expelTargets.forEach(function (x) { alerts.push('<a class="banner urgent" href="#/admin/members?focus=' + esc(x.memberId) + '" style="text-decoration:none;color:inherit">🚨 <b>' + esc(x.name) + '</b> 퇴출 대상 (경고 ' + x.warnings + '회) — 확인 후 퇴출 확정</a>'); });
    if (!d.questThis.daily || !d.questThis.weekly) alerts.push('<a class="banner urgent" href="#/admin/quests" style="text-decoration:none;color:inherit">📝 이번 주(' + U.md(d.questThis.week) + ') ' + [!d.questThis.daily ? '데일리' : '', !d.questThis.weekly ? '위클리' : ''].filter(Boolean).join('·') + ' 퀘스트가 없어요</a>');
    if (!d.questNext.daily || !d.questNext.weekly) alerts.push('<a class="banner" href="#/admin/quests" style="text-decoration:none;color:inherit">📝 다음 주(' + U.md(d.questNext.week) + ') ' + [!d.questNext.daily ? '데일리' : '', !d.questNext.weekly ? '위클리' : ''].filter(Boolean).join('·') + ' 퀘스트를 미리 등록하세요</a>');
    if (d.unsettled.length) alerts.push('<a class="banner" href="#/admin/settle" style="text-decoration:none;color:inherit">💰 정산 대기 주: ' + d.unsettled.map(function (w) { return U.md(w) + '~' + U.md(U.addDays(w, 6)); }).join(', ') + '</a>');
    if (d.usage && (d.usage.dbPct >= 80 || d.usage.reqPct >= 80)) alerts.push('<a class="banner urgent" href="#/admin/system" style="text-decoration:none;color:inherit">📈 사용량이 예산의 80%를 넘었어요 — 저장 공간 ' + Math.round(d.usage.dbPct) + '% · 오늘 요청 ' + Math.round(d.usage.reqPct) + '%</a>');
    if (d.backupDays === null && d.lastBackup !== undefined) alerts.push('<a class="banner" href="#/admin/data?tab=backup" style="text-decoration:none;color:inherit">💾 아직 백업을 받은 적이 없어요. 데이터 도구에서 내려받아 두세요</a>');
    else if (d.backupDays !== undefined && d.backupDays >= 7) alerts.push('<a class="banner" href="#/admin/data?tab=backup" style="text-decoration:none;color:inherit">💾 마지막 백업이 ' + d.backupDays + '일 전이에요</a>');
    el.innerHTML = '<div class="stack"><div class="grid3">' +
      tile('확인 대기', d.pending, 'admin/pending', false, '개') +
      tile('경고 후보', d.candidates, 'admin/warnings', d.candidates > 0, '명') +
      tile('퇴출 대상', d.expelTargets.length, 'admin/members', d.expelTargets.length > 0, '명') +
      tile('지급 대기 구매', d.waitingPurchases, 'admin/shop', false, '건') +
      tile('오늘 ' + esc(d.attendName), d.todayAttend, 'admin/judge?view=item&mission=attend', false, '/ ' + d.activeCount) +
      '</div>' + (alerts.length ? '<div class="stack" style="gap:8px">' + alerts.join('') + '</div>' : '<div class="card small muted">지금 챙길 일이 없어요 ✨</div>') +
      '<div class="card"><div class="card-head"><h2>바로가기</h2></div><div class="row wrap">' +
      [['admin/judge', '판정 표', 'judge.view'], ['admin/pending', '확인 대기 목록', 'judge.view'], ['admin/warnings', '경고 후보', 'warn.manage'], ['admin/quests', '퀘스트 등록', 'quests.manage'],
       ['admin/games', '날짜별 미니게임', 'games.schedule'], ['admin/settle', '주간 정산', 'settle.view'], ['admin/notices', '공지 쓰기', 'notices.manage']]
        .filter(function (x) { return NC.can(x[2]); }).map(function (x) { return '<a class="btn" href="#/' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</div></div></div>';
  };
  P['admin/pending'] = function (el, q, alive) { return P['admin/judge'](el, Object.assign({}, q, { view: 'pending' }), alive); };

  // ============================================================
  // 멤버 목록
  // ============================================================
  P['admin/members'] = async function (el, q, alive) {
    var D = await NC.api('members.list');
    if (!alive()) return;
    var list = D.members, myRank = NC.me.rank, filter = 'active', search = '', dev = D.canDev;
    el.innerHTML = '<div class="stack"><div class="row wrap"><div class="seg" id="mm-f"><button data-f="active" class="on">활성</button><button data-f="inactive">비활성(퇴출·삭제)</button><button data-f="expel">퇴출 대상</button></div>' +
      '<input class="input sm" id="mm-q" placeholder="이름·아이디 검색" style="max-width:200px"><span class="right row wrap" style="gap:6px">' + (D.canBulk ? '<button class="btn" id="mm-bulk">여러 명 추가</button>' : '') + '<button class="btn primary" id="mm-add">+ 멤버 추가</button></span></div><div id="mm-list"></div></div>';
    var expelAt = NC.settings.expelAt;
    function draw() {
      var arr = list.filter(function (m) {
        if (filter === 'active' && m.status !== 'active') return false;
        if (filter === 'inactive' && m.status === 'active') return false;
        if (filter === 'expel' && !(m.status === 'active' && m.warnings >= expelAt)) return false;
        var s = search.toLowerCase();
        return !s || m.name.toLowerCase().indexOf(s) >= 0 || m.id.toLowerCase().indexOf(s) >= 0;
      });
      $('#mm-list').innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th>이름</th><th>인스타</th><th class="num">파이</th><th class="num">경고</th><th>최근 파이 변동</th><th>상태</th><th></th></tr></thead><tbody>' +
        (arr.length ? arr.map(function (m) {
          return '<tr><td>' + NC.who(m, { id: true }) + (m.memo ? ' <span title="' + esc(m.memo) + '">📝</span>' : '') + '</td><td class="small">' + (m.insta ? '@' + esc(m.insta) : '-') + '</td>' +
            '<td class="num">' + U.num(m.balance) + '</td><td class="num">' + (m.warnings >= expelAt ? '<b class="minus">' + m.warnings + '</b> 🚨' : m.warnings) + '</td>' +
            '<td class="small muted">' + (m.lastActivity ? U.fmtAgo(m.lastActivity) : '-') + '</td>' +
            '<td>' + (m.status === 'active' ? '<span class="pill st-ok">활성</span>' : m.status === 'expelled' ? '<span class="pill st-fail">퇴출</span>' : '<span class="pill st-none">삭제</span>') + '</td>' +
            '<td><button class="btn sm" data-m="' + esc(m.id) + '">관리</button></td></tr>';
        }).join('') : '<tr><td colspan="7"><div class="empty">해당하는 멤버가 없어요</div></td></tr>') + '</tbody></table></div>';
      $$('[data-m]', el).forEach(function (b) { b.onclick = function () { manage(list.filter(function (m) { return m.id === b.getAttribute('data-m'); })[0]); }; });
    }
    $$('#mm-f button').forEach(function (b) { b.onclick = function () { filter = b.getAttribute('data-f'); $$('#mm-f button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }; });
    $('#mm-q').oninput = function () { search = this.value; draw(); };
    async function refresh() { D = await NC.api('members.list'); list = D.members; draw(); }
    function grantable() { return dev ? ['dev', 'lead', 'sub', 'sup'] : ['lead', 'sub', 'sup'].filter(function (t) { return ({ lead: 3, sub: 2, sup: 1 })[t] < myRank; }); }
    function tagChecks(cur) {
      return '<div class="row wrap">' + grantable().map(function (t) { return '<label class="check"><input type="checkbox" data-tag="' + t + '"' + (cur.indexOf(t) >= 0 ? ' checked' : '') + '><span class="badge ' + t + '">' + NC.TAG_NAMES[t] + '</span></label>'; }).join('') +
        '<label class="check"><input type="checkbox" data-role="mentor"' + (cur.indexOf('mentor') >= 0 ? ' checked' : '') + '><span class="badge mentor">' + NC.TAG_NAMES.mentor + '</span></label>' +
        '<label class="check"><input type="checkbox" data-role="mentee"' + (cur.indexOf('mentee') >= 0 ? ' checked' : '') + '><span class="badge mentee">' + NC.TAG_NAMES.mentee + '</span></label></div>';
    }
    function readTags(w, keepOps) {
      var ops = (keepOps || []).filter(function (t) { return grantable().indexOf(t) < 0; });
      $$('[data-tag]', w).forEach(function (c) { if (c.checked) ops.push(c.getAttribute('data-tag')); });
      return { ops: ops, mentor: $('[data-role=mentor]', w).checked, mentee: $('[data-role=mentee]', w).checked };
    }
    $('#mm-add').onclick = function () {
      NC.modal({ title: '멤버 추가', body: '<div class="stack"><div class="form-grid"><label class="field"><span>이름</span><input class="input" id="na-name"></label><label class="field"><span>아이디 (로그인·식별용)</span><input class="input" id="na-id" placeholder="영문·숫자·한글"></label>' +
        '<label class="field"><span>처음 비밀번호</span><input class="input" id="na-pw"></label><label class="field"><span>인스타그램 아이디</span><input class="input" id="na-ig" placeholder="@없이"></label></div>' +
        '<div class="field"><span>태그</span>' + tagChecks(['mentee']) + '</div><div class="notice-pw">멤버에게 실제 사용하는 비밀번호와 다른 비밀번호를 쓰도록 안내해 주세요.</div></div>',
        actions: [{ label: '취소' }, { label: '추가', cls: 'primary', onClick: async function (c, w) {
          var t = readTags(w);
          await NC.api('members.create', { member: Object.assign({ id: $('#na-id', w).value.trim(), name: $('#na-name', w).value.trim(), password: $('#na-pw', w).value, insta: $('#na-ig', w).value.trim() }, t) });
          NC.toast('멤버를 추가했어요.', 'ok'); refresh();
        } }] });
    };
    if ($('#mm-bulk')) $('#mm-bulk').onclick = function () {
      var parsed = [];
      var mo = NC.modal({ title: '여러 명 한꺼번에 추가', wide: true, body: '<div class="stack"><p class="small muted" style="margin:0">한 줄에 한 명씩 <b>이름, 아이디, 처음 비밀번호, 인스타그램, 멘토/멘티</b> 순서로 적어요. 엑셀에서 복사해 붙여넣어도 돼요 (칸 사이가 탭이어도 돼요). 뒤의 두 칸은 비워도 돼요.</p>' +
        '<textarea class="input mono" id="bk-t" rows="8" placeholder="김민지, minji, 1234, minji_study, 멘티&#10;박서연, seoyeon, 1234, , 멘토 멘티"></textarea><div id="bk-pv"></div></div>',
        actions: [{ label: '취소' }, { label: '추가', cls: 'primary', onClick: async function () {
          if (!parsed.length) { NC.toast('추가할 줄이 없어요.', 'err'); return false; }
          var r = await NC.api('members.bulk', { members: parsed });
          NC.toast(r.count + '명을 추가했어요.', 'ok'); refresh();
        } }] });
      $('#bk-t', mo.body).oninput = function () {
        parsed = this.value.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
          var p = l.split(/\t|,/).map(function (x) { return x.trim(); });
          var role = (p[4] || '');
          return { name: p[0] || '', id: p[1] || '', password: p[2] || '', insta: (p[3] || '').replace(/^@/, ''), mentor: /멘토|mentor/i.test(role), mentee: /멘티|mentee/i.test(role) || !role };
        });
        $('#bk-pv', mo.body).innerHTML = parsed.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>이름</th><th>아이디</th><th>비밀번호</th><th>인스타</th><th>태그</th></tr></thead><tbody>' + parsed.map(function (m) {
          return '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.id) + '</td><td>' + esc(m.password) + '</td><td>' + esc(m.insta) + '</td><td>' + (m.mentor ? NC.TAG_NAMES.mentor + ' ' : '') + (m.mentee ? NC.TAG_NAMES.mentee : '') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="tiny muted">' + parsed.length + '명</p>' : '';
      };
    };
    function manage(m) {
      var can = m.canManage;
      var body = '<div class="stack"><div class="row wrap">' + NC.who(m, { id: true }) + '</div>' +
        '<dl class="kv"><dt>파이</dt><dd>' + U.num(m.balance) + '</dd><dt>경고</dt><dd>' + m.warnings + ' / ' + expelAt + '</dd><dt>가입</dt><dd>' + U.fmtDT(m.joinedAt) + '</dd><dt>최근 파이 변동</dt><dd>' + (m.lastActivity ? U.fmtDT(m.lastActivity) : '-') + '</dd></dl>' +
        (NC.can('members.memo') ? '<label class="field"><span>운영 메모 (운영진만 보여요)</span><textarea class="input" id="mg-memo" rows="2" placeholder="경고 판단 근거, 사정 등">' + esc(m.memo || '') + '</textarea></label><button class="btn sm" id="mg-memo-save" style="align-self:flex-start">메모 저장</button>' : '');
      if (can) {
        body += '<hr class="sep"><div class="form-grid"><label class="field"><span>이름</span><input class="input" id="mg-name" value="' + esc(m.name) + '"></label>' +
          '<label class="field"><span>인스타그램</span><input class="input" id="mg-ig" value="' + esc(m.insta || '') + '"></label>' +
          (dev ? '<label class="field"><span>가입일</span><input class="input" id="mg-join" value="' + esc(m.joinedAt || '') + '" placeholder="2026-10-26 09:00:00"></label>' : '') + '</div>' +
          '<div class="field"><span>태그</span>' + tagChecks(m.tags) + '</div><button class="btn primary sm" id="mg-save" style="align-self:flex-start">정보 저장</button>' +
          '<hr class="sep"><div class="row wrap"><button class="btn sm" id="mg-pw">비밀번호 보기</button><button class="btn sm" id="mg-reset">비밀번호 새로 정하기</button>' +
          (NC.can('pie.view') ? '<a class="btn sm" href="#/admin/pie?member=' + esc(m.id) + '">파이 내역</a>' : '') + (NC.can('judge.view') ? '<a class="btn sm" href="#/admin/judge?view=member&member=' + esc(m.id) + '">미션 기록</a>' : '') + '</div>' +
          '<div class="row wrap">' + (m.status === 'active' ? '<button class="btn sm danger" id="mg-expel">퇴출 확정</button><button class="btn sm danger" id="mg-del">멤버 삭제</button>'
            : '<button class="btn sm" id="mg-restore">다시 활성화</button>' + (D.canPurge && m.id !== NC.me.id ? '<button class="btn sm danger fill" id="mg-purge">계정 완전 삭제</button>' : '')) + '</div>';
        if (dev) body += '<hr class="sep"><div class="small" style="font-weight:700">개발자 도구</div><div class="row wrap"><button class="btn sm" id="mg-rename">아이디 바꾸기</button>' + (m.id !== NC.me.id ? '<button class="btn sm" id="mg-merge">다른 계정으로 합치기</button>' : '') +
          '<button class="btn sm" id="mg-logout">모든 기기에서 로그아웃</button>' + (D.canView && m.id !== NC.me.id ? '<button class="btn sm" id="mg-view">이 멤버 화면으로 보기</button>' : '') + '</div>';
      } else body += '<p class="small muted">이 멤버에게는 운영 메모만 남길 수 있어요.</p>';
      body += '</div>';
      var mo = NC.modal({ title: '멤버 관리', body: body, wide: true });
      var w = mo.body;
      if ($('#mg-memo-save', w)) $('#mg-memo-save', w).onclick = async function () { try { await NC.api('members.memo', { id: m.id, memo: $('#mg-memo', w).value }); m.memo = $('#mg-memo', w).value; NC.toast('메모 저장', 'ok'); draw(); } catch (e) { NC.err(e); } };
      if (!can) return;
      $('#mg-save', w).onclick = async function () {
        var data = Object.assign({ id: m.id, name: $('#mg-name', w).value, insta: $('#mg-ig', w).value }, readTags(w, m.ops));
        if ($('#mg-join', w)) data.joinedAt = $('#mg-join', w).value;
        try { await NC.api('members.update', { member: data }); NC.toast('저장했어요.', 'ok'); mo.close(); refresh(); if (m.id === NC.me.id) NC.refreshMe(); } catch (e) { NC.err(e); }
      };
      $('#mg-pw', w).onclick = async function () {
        try { var r = await NC.api('members.viewPw', { id: m.id }); this.outerHTML = '<span class="pill">비밀번호: <b style="user-select:all">' + esc(r.password) + '</b></span>'; } catch (e) { NC.err(e); }
      };
      $('#mg-reset', w).onclick = async function () {
        var pw = await NC.confirm(m.name + '님의 비밀번호를 새로 정합니다.', { title: '비밀번호 새로 정하기', ok: '바꾸기', extra: '<input class="input" id="rp" placeholder="새 비밀번호 (4자 이상)">', collect: function (x) { return $('#rp', x).value; } });
        if (!pw) return;
        try { await NC.api('members.resetPw', { id: m.id, password: pw }); NC.toast('새 비밀번호로 바꿨어요. 이 멤버는 다시 로그인해야 해요.', 'ok'); } catch (e) { NC.err(e); }
      };
      function status(st, msg, danger) {
        return async function () {
          var reason = await NC.confirm(msg, { danger: danger, ok: '확인', extra: '<input class="input" id="rs" placeholder="사유 (선택)">', collect: function (x) { return $('#rs', x).value || ' '; } });
          if (!reason) return;
          try { await NC.api('members.setStatus', { id: m.id, status: st, reason: reason.trim() }); NC.toast('처리했어요.', 'ok'); mo.close(); refresh(); } catch (e) { NC.err(e); }
        };
      }
      if ($('#mg-expel', w)) $('#mg-expel', w).onclick = status('expelled', m.name + '님을 퇴출할까요?\n로그인이 막히고 목록·랭킹에서 숨겨집니다. 기록은 보존돼요.', true);
      if ($('#mg-del', w)) $('#mg-del', w).onclick = status('deleted', m.name + '님을 삭제(비활성화)할까요?\n기록은 보존되며 개발자가 완전 삭제할 수 있어요.', true);
      if ($('#mg-restore', w)) $('#mg-restore', w).onclick = status('active', m.name + '님을 다시 활성화할까요?');
      if ($('#mg-purge', w)) $('#mg-purge', w).onclick = async function () {
        var ok = await NC.confirm(m.name + '님의 모든 기록(미션·파이·경고·구매·게시글 등, 모든 시즌)을 영구 삭제합니다. 되돌릴 수 없어요.\n확인을 위해 아이디(' + m.id + ')를 입력하세요.', { danger: true, ok: '영구 삭제', extra: '<input class="input" id="pg">', collect: function (x) { return $('#pg', x).value === m.id; } });
        if (!ok) return;
        try { await NC.api('members.purge', { id: m.id }); NC.toast('완전 삭제했어요.', 'ok'); mo.close(); refresh(); } catch (e) { NC.err(e); }
      };
      if ($('#mg-rename', w)) $('#mg-rename', w).onclick = async function () {
        var nid = await NC.confirm(m.name + '님의 아이디를 바꿔요. 미션 · 파이 · 경고 등 모든 기록이 새 아이디로 옮겨지고, 이 멤버는 새 아이디로 다시 로그인해야 해요.', { title: '아이디 바꾸기', ok: '바꾸기', extra: '<input class="input" id="ni" value="' + esc(m.id) + '">', collect: function (x) { return $('#ni', x).value.trim(); } });
        if (!nid || nid === m.id) return;
        try { var r = await NC.api('members.changeId', { id: m.id, newId: nid }); NC.toast('아이디를 ' + r.id + '(으)로 바꿨어요.', 'ok'); mo.close(); if (r.self) { NC.toast('새 아이디로 다시 로그인해 주세요.'); NC.logout(); } else refresh(); } catch (e) { NC.err(e); }
      };
      if ($('#mg-merge', w)) $('#mg-merge', w).onclick = async function () {
        var others = list.filter(function (x) { return x.id !== m.id; });
        var into = await NC.confirm(m.name + '(@' + m.id + ') 계정의 기록을 다른 계정으로 옮기고 이 계정은 지워요. 파이 내역은 모두 합쳐지고, 같은 날 두 계정 모두 미션 기록이 있으면 남길 계정 쪽 기록을 남겨요. 되돌릴 수 없으니 먼저 백업을 받아 두세요.',
          { title: '계정 합치기', danger: true, ok: '합치기', extra: '<label class="field"><span>남길 계정</span><select class="input" id="mi">' + memberOpts(others, '') + '</select></label>', collect: function (x) { return $('#mi', x).value; } });
        if (!into) return;
        try { await NC.api('members.merge', { from: m.id, into: into }); NC.toast('합쳤어요.', 'ok'); mo.close(); refresh(); } catch (e) { NC.err(e); }
      };
      if ($('#mg-logout', w)) $('#mg-logout', w).onclick = async function () {
        if (!(await NC.confirm(m.name + '님을 모든 기기에서 로그아웃시킬까요? 비밀번호는 그대로예요.'))) return;
        try { var r = await NC.api('members.logoutAll', { id: m.id }); if (r && r.token) NC.setToken(r.token); NC.toast('로그아웃시켰어요.', 'ok'); } catch (e) { NC.err(e); }
      };
      if ($('#mg-view', w)) $('#mg-view', w).onclick = async function () { mo.close(); try { await NC.viewAs(m.id); } catch (e) { NC.err(e); } };
    }
    if (q.focus) filter = 'active';
    draw();
    if (q.focus) { var fm = list.filter(function (m) { return m.id === q.focus; })[0]; if (fm) manage(fm); }
  };

  // ============================================================
  // 퀘스트
  // ============================================================
  P['admin/quests'] = async function (el, q, alive) {
    var cur = U.weekOf(U.today()), from = q.from ? U.weekOf(q.from) : U.addDays(cur, -14);
    var d = await NC.api('quests.list', { from: from, to: q.to || null });
    if (!alive()) return;
    var to = d.to, weeks = [];
    for (var w0 = d.from; w0 <= to && weeks.length < 30; w0 = U.addDays(w0, 7)) weeks.push(w0);
    function forWeek(w) { return d.quests.filter(function (x) { return x.week === w; }); }
    var anytime = !d.maxWeek;
    el.innerHTML = '<div class="stack"><p class="small muted" style="margin:0">' + (anytime ? '기간 제한 없이 등록할 수 있어요.' : '퀘스트는 ' + NC.settings.weeksAhead + '주 뒤(' + U.md(d.maxWeek) + ' 주)까지 미리 등록할 수 있어요.') + ' 데일리 퀘스트는 주 단위로 1개를 등록하면 그 주 7일 동안 매일 수행할 수 있어요. 특정 요일만 바꾸려면 요일별 덮어쓰기를 추가하세요. 위클리 퀘스트는 주 1개(+' + NC.settings.rewards.weekly + '파이)입니다.</p>' +
      '<div class="row wrap"><a class="btn sm" href="#/admin/quests?from=' + U.addDays(d.from, -28) + (anytime ? '&to=' + U.addDays(to, -28) : '') + '">◀ 이전</a>' +
      (anytime ? '<a class="btn sm" href="#/admin/quests?from=' + U.addDays(d.from, 28) + '&to=' + U.addDays(to, 28) + '">다음 ▶</a>' : '') + '<a class="btn sm ghost" href="#/admin/quests">이번 주 기준으로</a></div>' +
      weeks.map(function (w) {
        var list = forWeek(w), daily = list.filter(function (x) { return x.type === 'daily' && x.dow === null; })[0], weekly = list.filter(function (x) { return x.type === 'weekly'; })[0];
        var over = list.filter(function (x) { return x.type === 'daily' && x.dow !== null; }).sort(function (a, b) { return a.dow - b.dow; });
        var tag = w === cur ? '<span class="badge lead">이번 주</span>' : w === U.addDays(cur, 7) ? '<span class="badge soft">다음 주</span>' : w < cur ? '<span class="badge soft">지난 주</span>' : '';
        function qline(x, label, type, dowv) {
          return '<div class="li"><span class="badge soft">' + label + '</span><div class="grow">' + (x ? '<b>' + esc(x.title) + '</b>' + (x.desc ? '<div class="tiny muted">' + esc(x.desc) + '</div>' : '') : '<span class="muted small">' + (type === 'weekly' || dowv === null ? '미등록' : '') + '</span>') + '</div>' +
            '<button class="btn sm" data-edit="' + attr({ id: x ? x.id : null, type: type, week: w, dow: dowv, title: x ? x.title : '', desc: x ? x.desc : '' }) + '">' + (x ? '수정' : '등록') + '</button>' +
            (x ? '<button class="btn sm ghost" data-del="' + x.id + '">삭제</button>' : '') + '</div>';
        }
        return '<div class="card' + (w < cur ? '" style="opacity:.75' : '') + '"><div class="card-head"><h2>' + U.md(w) + ' ~ ' + U.md(U.addDays(w, 6)) + '</h2>' + tag +
          ((!daily || !weekly) && w >= cur ? '<span class="badge new">미등록 있음</span>' : '') + '</div><div class="list">' +
          qline(daily, '데일리', 'daily', null) + over.map(function (x) { return qline(x, U.DOW[x.dow] + '요일', 'daily', x.dow); }).join('') +
          '<div class="li"><span class="small muted grow">특정 요일만 다른 데일리 퀘스트로 바꾸기</span><button class="btn sm ghost" data-over="' + w + '">+ 요일 덮어쓰기</button></div>' +
          qline(weekly, '위클리', 'weekly', null) + '</div></div>';
      }).join('') + '</div>';
    function edit(x) {
      NC.modal({ title: (x.type === 'weekly' ? '위클리' : '데일리') + ' 퀘스트 · ' + U.md(x.week) + ' 주', body: '<div class="stack">' +
        (x.type === 'daily' ? '<label class="field"><span>적용 요일</span><select class="input" id="qe-dow"><option value="">주 전체 (기본)</option>' + U.DOW.map(function (n, i) { return '<option value="' + i + '"' + (x.dow === i ? ' selected' : '') + '>' + n + '요일만 (' + U.md(U.addDays(x.week, i)) + ')</option>'; }).join('') + '</select></label>' : '') +
        '<label class="field"><span>제목</span><input class="input" id="qe-t" value="' + esc(x.title) + '" placeholder="예: 플래너 인증"></label>' +
        '<label class="field"><span>설명 (인증 방법 포함)</span><textarea class="input" id="qe-d">' + esc(x.desc) + '</textarea></label></div>',
        actions: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: async function (c, w) {
          var dw = $('#qe-dow', w) ? $('#qe-dow', w).value : '';
          await NC.api('quests.save', { quest: { id: x.id, type: x.type, week: x.week, dow: dw === '' ? null : +dw, title: $('#qe-t', w).value, desc: $('#qe-d', w).value } });
          NC.toast('저장했어요.', 'ok'); NC.route();
        } }] });
    }
    $$('[data-edit]', el).forEach(function (b) { b.onclick = function () { edit(JSON.parse(b.getAttribute('data-edit'))); }; });
    $$('[data-over]', el).forEach(function (b) { b.onclick = function () { edit({ id: null, type: 'daily', week: b.getAttribute('data-over'), dow: 0, title: '', desc: '' }); }; });
    $$('[data-del]', el).forEach(function (b) { b.onclick = async function () { if (!(await NC.confirm('이 퀘스트를 삭제할까요?', { danger: true, ok: '삭제' }))) return; try { await NC.api('quests.delete', { id: b.getAttribute('data-del') }); NC.route(); } catch (e) { NC.err(e); } }; });
  };

  // ============================================================
  // 경고
  // ============================================================
  P['admin/warnings'] = async function (el, q, alive) {
    var d = await NC.api('warn.list');
    if (!alive()) return;
    var meId = NC.me.id;
    el.innerHTML = '<div class="stack">' +
      (d.expelTargets.length ? '<div class="stack" style="gap:8px">' + d.expelTargets.map(function (x) { return '<a class="banner urgent" href="#/admin/members?focus=' + esc(x.memberId) + '" style="text-decoration:none;color:inherit">🚨 <b>' + esc(x.name) + '</b> 경고 ' + x.warnings + '회 · 퇴출 대상 — 멤버 관리에서 퇴출 확정</a>'; }).join('') + '</div>' : '') +
      '<div class="card"><div class="card-head"><h2>경고 후보</h2><span class="small muted">' + esc(NC.TAG_NAMES.mentee) + '의 필수 미션이 미수행(빨강)으로 확정된 날 · 한 사람당 하루 1회 (데이오프 · 전체 휴일 제외)</span></div>' +
      (d.candidates.length ? '<div class="list">' + d.candidates.map(function (c) {
        return '<div class="li wrap"><div class="grow"><b>' + esc(c.name) + '</b> <span class="small muted">현재 경고 ' + c.warnings + '</span><div class="small">' + U.mdw(c.date) + ' · <span class="pill st-fail">' + esc(c.missionName) + ' 미수행</span></div></div>' +
          (c.memberId === meId ? '<span class="small muted">본인 일은 다른 운영진이 처리해요</span>' : '<button class="btn sm danger fill" data-give="' + attr(c) + '">경고 주기</button>') + '<button class="btn sm" data-skip="' + esc(c.key) + '">넘어가기</button></div>';
      }).join('') + '</div>' : '<div class="empty">경고 후보가 없어요</div>') + '</div>' +
      '<div class="card"><div class="card-head"><h2>직접 경고 주기</h2><span class="small muted">방에서의 소란 등 운영진 판단</span></div><div class="form-grid">' +
      '<label class="field"><span>대상</span><select class="input" id="wg-m">' + memberOpts(d.members.filter(function (m) { return m.id !== meId; }), '', '선택') + '</select></label>' +
      '<label class="field" style="grid-column:span 2"><span>사유</span><input class="input" id="wg-r"></label></div><button class="btn danger" id="wg-go" style="margin-top:10px">경고 주기</button></div>' +
      '<div class="card"><div class="card-head"><h2>전체 경고 내역</h2></div><div class="table-wrap"><table class="tbl"><thead><tr><th>일시</th><th>대상</th><th>사유</th><th>관련</th><th>준 사람</th><th>상태</th><th></th></tr></thead><tbody>' +
      (d.warnings.length ? d.warnings.map(function (w) {
        return '<tr' + (w.canceled ? ' style="opacity:.55"' : '') + '><td class="small">' + U.fmtDT(w.at) + '</td><td><b>' + esc(w.name) + '</b></td><td style="white-space:normal;min-width:160px">' + esc(w.reason) + '</td><td class="small">' + (w.refDate ? U.md(w.refDate) + ' ' + esc(w.refName) : '-') + '</td>' +
          '<td class="small">' + esc(w.byName) + '</td><td class="small">' + (w.canceled ? '취소 (' + esc(w.canceledByName) + ')' : '<span class="pill st-fail">유효</span>') + '</td>' +
          '<td class="nowrap">' + (w.memberId !== meId ? '<button class="btn sm ghost" data-wedit="' + attr(w) + '">고치기</button>' + (!w.canceled ? '<button class="btn sm" data-cancel="' + w.id + '">취소</button>' : '') : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="empty">경고 내역이 없어요</div></td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h2>넘어간 경고 후보</h2><span class="small muted">잘못 넘겼다면 되돌려서 다시 후보로 올릴 수 있어요</span></div>' +
      (d.skips.length ? '<div class="list">' + d.skips.map(function (s) { return '<div class="li"><b>' + esc(s.name) + '</b><span class="small">' + U.mdw(s.date) + '</span><span class="tiny muted grow">' + esc(s.byName) + ' · ' + U.fmtDT(s.at) + '</span><button class="btn sm ghost" data-unskip="' + esc(s.key) + '">되돌리기</button></div>'; }).join('') + '</div>' : '<div class="small muted">없어요</div>') + '</div></div>';
    $$('[data-give]', el).forEach(function (b) {
      b.onclick = async function () {
        var c = JSON.parse(b.getAttribute('data-give'));
        var reason = await NC.confirm(c.name + '님에게 경고를 줄까요? (지금 ' + c.warnings + '회)', { danger: true, ok: '경고 주기', extra: '<input class="input" id="wr" value="' + esc(U.mdw(c.date) + ' ' + c.missionName + ' 미수행') + '">', collect: function (x) { return $('#wr', x).value; } });
        if (!reason) return;
        try { var r = await NC.api('warn.give', { memberId: c.memberId, reason: reason, refDate: c.date, refMission: c.missionName }); NC.toast('경고를 줬어요 (누적 ' + r.count + '회)' + (r.expelTarget ? ' — 퇴출 대상' : ''), r.expelTarget ? 'err' : 'ok'); NC.route(); } catch (e) { NC.err(e); }
      };
    });
    $$('[data-skip]', el).forEach(function (b) { b.onclick = async function () { try { await NC.api('warn.skip', { key: b.getAttribute('data-skip') }); NC.route(); } catch (e) { NC.err(e); } }; });
    $$('[data-unskip]', el).forEach(function (b) { b.onclick = async function () { try { await NC.api('warn.unskip', { key: b.getAttribute('data-unskip') }); NC.toast('다시 후보로 올렸어요.', 'ok'); NC.route(); } catch (e) { NC.err(e); } }; });
    $$('[data-cancel]', el).forEach(function (b) {
      b.onclick = async function () {
        var reason = await NC.confirm('이 경고를 취소할까요?', { ok: '경고 취소', extra: '<input class="input" id="cr" placeholder="취소 사유">', collect: function (x) { return $('#cr', x).value || '운영진 취소'; } });
        if (!reason) return;
        try { await NC.api('warn.cancel', { id: b.getAttribute('data-cancel'), reason: reason }); NC.toast('취소했어요.', 'ok'); NC.route(); } catch (e) { NC.err(e); }
      };
    });
    $$('[data-wedit]', el).forEach(function (b) {
      b.onclick = function () {
        var w = JSON.parse(b.getAttribute('data-wedit'));
        NC.modal({ title: '경고 고치기 · ' + w.name, body: '<div class="stack"><label class="field"><span>사유</span><input class="input" id="we-r" value="' + esc(w.reason) + '"></label>' +
          '<div class="form-grid"><label class="field"><span>관련 날짜 (비우면 날짜 없는 경고)</span><input class="input" type="date" id="we-d" value="' + esc(w.refDate || '') + '"></label><label class="field"><span>관련 미션</span><input class="input" id="we-m" value="' + esc(w.refName || '') + '"></label></div></div>',
          actions: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: async function (c, x) {
            await NC.api('warn.edit', { id: w.id, reason: $('#we-r', x).value, refDate: $('#we-d', x).value, refMission: $('#we-m', x).value });
            NC.toast('고쳤어요.', 'ok'); NC.route();
          } }] });
      };
    });
    $('#wg-go').onclick = async function () {
      var mid = $('#wg-m').value, reason = $('#wg-r').value.trim();
      if (!mid || !reason) return NC.toast('대상과 사유를 입력하세요.', 'err');
      try { var r = await NC.api('warn.give', { memberId: mid, reason: reason }); NC.toast('경고를 줬어요 (누적 ' + r.count + '회)', 'ok'); NC.route(); } catch (e) { NC.err(e); }
    };
  };

  // ============================================================
  // 데이오프 · 전체 휴일
  // ============================================================
  P['admin/dayoffs'] = async function (el, q, alive) {
    var week = U.weekOf(q.week || U.today());
    var d = await NC.api('dayoff.list', { week: week });
    if (!alive()) return;
    var days = []; for (var i = 0; i < 7; i++) days.push(U.addDays(week, i));
    var by = {}, hol = {};
    d.dayoffs.forEach(function (o) { by[o.date + '|' + o.memberId] = o; });
    d.holidays.forEach(function (h) { hol[h.date] = h.reason; });
    el.innerHTML = '<div class="stack"><div class="jtool"><div class="weeknav"><a class="btn icon sm" href="#/admin/dayoffs?week=' + U.addDays(week, -7) + '">' + NC.icon('left') + '</a><span class="lbl">' + U.md(week) + ' ~ ' + U.md(U.addDays(week, 6)) + '</span><a class="btn icon sm" href="#/admin/dayoffs?week=' + U.addDays(week, 7) + '">' + NC.icon('right') + '</a></div>' +
      '<button class="btn primary sm right" id="do-add">+ 데이오프 지정</button></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>멤버</th>' + days.map(function (x) { return '<th class="center">' + U.mdw(x) + (hol[x] ? '<div class="tiny" style="color:var(--st-off)">휴일</div>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
      d.members.map(function (m) {
        return '<tr><td>' + NC.who(m) + '</td>' + days.map(function (x) {
          var o = by[x + '|' + m.id];
          return '<td class="center">' + (o ? '<button class="btn sm" style="border-color:var(--st-off);color:var(--st-off)" data-o="' + o.id + '" title="' + esc((o.mode === 'self' ? '본인 신청' : o.byName + ' 지정') + (o.reason ? ' · ' + o.reason : '')) + '">OFF' + (o.mode === 'self' ? '' : '*') + '</button>' : hol[x] ? '<span class="tiny" style="color:var(--st-off)">휴일</span>' : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="tiny muted">OFF = 본인 신청, OFF* = 운영진 지정. 눌러서 취소할 수 있어요. 운영진 지정은 본인 신청과 별도로 횟수 제한이 없어요. 지난 날짜도 지정할 수 있어요.</p>' +
      (NC.can('holidays') ? '<div class="card"><div class="card-head"><h2>전체 휴일</h2><span class="small muted">모든 멤버가 데이오프인 날 (경고 후보 · 필수 미션에서 빠져요)</span></div>' +
        '<div class="list">' + (d.holidays.length ? d.holidays.map(function (h) { return '<div class="li"><b>' + U.mdw(h.date) + '</b><span class="grow small">' + esc(h.reason) + '</span><button class="btn sm ghost" data-hdel="' + h.date + '">취소</button></div>'; }).join('') : '<div class="small muted">정한 휴일이 없어요</div>') + '</div>' +
        '<div class="row wrap" style="margin-top:10px"><input type="date" class="input sm" id="hd-d" value="' + U.today() + '" style="width:auto"><input class="input sm" id="hd-r" placeholder="사유 (예: 시험 기간)" style="max-width:240px"><button class="btn sm primary" id="hd-add">휴일로 정하기</button></div></div>' : '') + '</div>';
    $$('[data-o]', el).forEach(function (b) {
      b.onclick = async function () {
        if (!(await NC.confirm('이 데이오프를 취소할까요?\n' + b.title, { danger: true, ok: '취소하기' }))) return;
        try { await NC.api('dayoff.cancel', { id: b.getAttribute('data-o') }); NC.route(); } catch (e) { NC.err(e); }
      };
    });
    $('#do-add').onclick = function () {
      NC.modal({ title: '데이오프 지정', body: '<div class="stack"><label class="field"><span>멤버</span><select class="input" id="da-m">' + memberOpts(d.members, '') + '</select></label>' +
        '<label class="field"><span>날짜</span><input class="input" type="date" id="da-d" value="' + U.today() + '"></label><label class="field"><span>사유</span><input class="input" id="da-r" placeholder="예: 시험 기간, 병원"></label></div>',
        actions: [{ label: '취소' }, { label: '지정', cls: 'primary', onClick: async function (c, w) {
          await NC.api('dayoff.assign', { memberId: $('#da-m', w).value, date: $('#da-d', w).value, reason: $('#da-r', w).value });
          NC.toast('지정했어요.', 'ok'); NC.go('admin/dayoffs?week=' + U.weekOf($('#da-d', w).value));
        } }] });
    };
    if ($('#hd-add')) $('#hd-add').onclick = async function () {
      try { await NC.api('holidays.save', { date: $('#hd-d').value, reason: $('#hd-r').value }); NC.toast('전체 휴일로 정했어요.', 'ok'); NC.route(); } catch (e) { NC.err(e); }
    };
    $$('[data-hdel]', el).forEach(function (b) { b.onclick = async function () { if (!(await NC.confirm(U.mdw(b.getAttribute('data-hdel')) + ' 전체 휴일을 취소할까요?'))) return; try { await NC.api('holidays.delete', { date: b.getAttribute('data-hdel') }); NC.route(); } catch (e) { NC.err(e); } }; });
  };

  // ============================================================
  // 파이
  // ============================================================
  P['admin/pie'] = async function (el, q, alive) {
    var F = { memberId: q.member || '', type: '', from: '', to: '' };
    el.innerHTML = '<div class="stack">' + (NC.can('pie.adjust') ? '<div class="card"><div class="card-head"><h2>직접 지급 · 회수</h2></div><div class="stack">' +
      '<div class="field"><span>대상 (여러 명 선택 가능)</span><div class="row wrap" id="pa-sel"></div><div id="pa-pick"></div></div>' +
      '<div class="form-grid"><label class="field"><span>금액 (회수는 음수, 예: -300)</span><input class="input" type="number" id="pa-amt"></label><label class="field"><span>사유</span><input class="input" id="pa-r"></label></div>' +
      '<button class="btn primary" id="pa-go" style="align-self:flex-start">적용</button></div></div>' : '') +
      '<div id="pt-tools"></div>' +
      '<div class="card"><div class="card-head"><h2>파이 내역</h2><span class="small muted" id="pl-sum"></span></div><div class="form-grid" id="pl-f" style="margin-bottom:10px"></div><div id="pl-list"></div></div></div>';
    var picked = {}, members = [], types = {}, tools = false, D = null;
    async function load() {
      $('#pl-list').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      D = await NC.api('pie.ledger', F);
      if (!alive()) return;
      var d = D;
      members = d.members.filter(function (m) { return m.status === 'active' || F.memberId === m.id; }); types = d.types; tools = d.tools;
      if (!$('#pl-fm')) {
        $('#pl-f').innerHTML = '<select class="input sm" id="pl-fm">' + memberOpts(d.members, F.memberId, '전체 멤버') + '</select><select class="input sm" id="pl-ft"><option value="">전체 종류</option>' + opts(Object.keys(types).map(function (k) { return [k, types[k]]; }), F.type) + '</select>' +
          '<input class="input sm" type="date" id="pl-from"><input class="input sm" type="date" id="pl-to">';
        ['pl-fm', 'pl-ft', 'pl-from', 'pl-to'].forEach(function (id, i) { $('#' + id).onchange = function () { F[['memberId', 'type', 'from', 'to'][i]] = this.value; load(); }; });
        if ($('#pa-sel')) drawPick();
        if (tools) drawTools();
      }
      $('#pl-sum').textContent = '총 ' + d.total + '건 · 합계 ' + U.signed(d.sum);
      $('#pl-list').innerHTML = '<div class="table-wrap"><table class="tbl"><thead><tr><th>일시</th><th>대상</th><th class="num">금액</th><th>종류</th><th>관련</th><th>처리한 사람</th><th>내용</th>' + (tools ? '<th></th>' : '') + '</tr></thead><tbody>' +
        (d.list.length ? d.list.map(function (l) {
          return '<tr><td class="small">' + U.fmtDT(l.at) + '</td><td>' + esc(l.name) + '</td><td class="num ' + (l.amount > 0 ? 'plus' : 'minus') + '">' + U.signed(l.amount) + '</td><td class="small">' + esc(l.typeName) + '</td>' +
            '<td class="small">' + (l.refDate ? U.md(l.refDate) + ' ' : '') + (l.type === 'shop' || l.type === 'refund' || l.type === 'settle' ? '' : esc(l.refName || '')) + '</td><td class="small">' + esc(l.byName) + '</td><td class="small" style="white-space:normal;min-width:140px">' + esc(l.reason) + '</td>' +
            (tools ? '<td class="nowrap"><button class="btn sm ghost" data-led="' + attr(l) + '">고치기</button><button class="btn sm ghost" data-ldel="' + esc(l.id) + '">지우기</button></td>' : '') + '</tr>';
        }).join('') : '<tr><td colspan="8"><div class="empty">내역이 없어요</div></td></tr>') + '</tbody></table></div>' + (d.total > d.list.length ? '<p class="tiny muted">최근 ' + d.list.length + '건만 보여요. 필터로 좁혀보세요.</p>' : '');
      $$('[data-led]', el).forEach(function (b) {
        b.onclick = function () {
          var l = JSON.parse(b.getAttribute('data-led'));
          NC.modal({ title: '파이 내역 고치기 · ' + l.name, body: '<div class="stack"><p class="small muted" style="margin:0">' + U.fmtDT(l.at) + ' · ' + esc(l.typeName) + '</p><div class="form-grid"><label class="field"><span>금액</span><input class="input" type="number" id="le-a" value="' + l.amount + '"></label><label class="field"><span>내용</span><input class="input" id="le-r" value="' + esc(l.reason) + '"></label></div>' +
            '<p class="tiny muted" style="margin:0">미션 판정으로 생긴 줄을 고치면 \'파이 다시 계산\'에서 차이로 보일 수 있어요.</p></div>',
            actions: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: async function (c, w) { await NC.api('pie.editRow', { id: l.id, amount: $('#le-a', w).value, reason: $('#le-r', w).value }); NC.toast('고쳤어요.', 'ok'); load(); } }] });
        };
      });
      $$('[data-ldel]', el).forEach(function (b) { b.onclick = async function () { if (!(await NC.confirm('이 파이 내역 한 줄을 지울까요? 잔액이 바로 바뀌어요.', { danger: true, ok: '지우기' }))) return; try { await NC.api('pie.deleteRow', { id: b.getAttribute('data-ldel') }); NC.toast('지웠어요.', 'ok'); load(); } catch (e) { NC.err(e); } }; });
    }
    function drawTools() {
      $('#pt-tools').innerHTML = '<div class="grid2"><div class="card"><div class="card-head"><h2>잔액 맞추기</h2></div><div class="stack"><p class="small muted" style="margin:0">정한 잔액이 되도록 차액을 한 줄로 지급·회수해요.</p>' +
        '<div class="form-grid"><label class="field"><span>멤버</span><select class="input" id="sb-m">' + memberOpts(members, F.memberId) + '</select></label><label class="field"><span>맞출 잔액</span><input class="input" type="number" id="sb-t"></label><label class="field"><span>사유 (선택)</span><input class="input" id="sb-r"></label></div>' +
        '<button class="btn" id="sb-go" style="align-self:flex-start">맞추기</button></div></div>' +
        '<div class="card"><div class="card-head"><h2>파이 다시 계산</h2></div><div class="stack"><p class="small muted" style="margin:0">미션 판정 · 위클리 · 미니게임 기록과 실제로 지급한 파이가 같은지 비교해요. 다르면 차액만 보정할 수 있어요.</p>' +
        '<div class="row wrap"><input type="date" class="input sm" id="rc-f" value="' + U.addDays(U.today(), -27) + '" style="width:auto"><span>~</span><input type="date" class="input sm" id="rc-t" value="' + U.today() + '" style="width:auto"><button class="btn sm" id="rc-go">비교하기</button></div><div id="rc-out"></div></div></div></div>';
      $('#sb-go').onclick = async function () {
        var m = $('#sb-m').value, t = $('#sb-t').value;
        if (!m || t === '') return NC.toast('멤버와 잔액을 입력하세요.', 'err');
        try { var r = await NC.api('pie.setBalance', { memberId: m, target: t, reason: $('#sb-r').value }); NC.toast(r.diff ? '차액 ' + U.signed(r.diff) + ' 파이를 반영했어요.' : '이미 그 잔액이에요.', 'ok'); load(); } catch (e) { NC.err(e); }
      };
      $('#rc-go').onclick = async function () {
        var box = $('#rc-out'); box.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
          var r = await NC.api('pie.recalc', { from: $('#rc-f').value, to: $('#rc-t').value });
          box.innerHTML = r.list.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>날짜</th><th>멤버</th><th>항목</th><th class="num">기록</th><th class="num">지급</th><th class="num">차액</th></tr></thead><tbody>' +
            r.list.map(function (x) { return '<tr><td class="small">' + U.md(x.date) + '</td><td>' + esc(x.name) + '</td><td class="small">' + esc(x.itemName) + '</td><td class="num">' + x.expected + '</td><td class="num">' + x.actual + '</td><td class="num ' + (x.diff > 0 ? 'plus' : 'minus') + '">' + U.signed(x.diff) + '</td></tr>'; }).join('') +
            '</tbody></table></div><div class="row" style="margin-top:8px"><span class="small">' + r.list.length + '곳 · 합계 ' + U.signed(r.sum) + '</span><button class="btn sm primary right" id="rc-apply">차액 보정하기</button></div>' : '<div class="small" style="color:var(--ok)">✓ 모두 맞아요</div>';
          if ($('#rc-apply')) $('#rc-apply').onclick = async function () {
            if (!(await NC.confirm(r.list.length + '곳의 차액(합계 ' + U.signed(r.sum) + ')을 보정할까요?'))) return;
            try { await NC.api('pie.recalc', { from: r.from, to: r.to, apply: true }); NC.toast('보정했어요.', 'ok'); box.innerHTML = ''; load(); } catch (e) { NC.err(e); }
          };
        } catch (e) { box.innerHTML = ''; NC.err(e); }
      };
    }
    function drawPick() {
      $('#pa-sel').innerHTML = Object.keys(picked).map(function (id) { return '<span class="chip on" data-un="' + esc(id) + '">' + esc(picked[id]) + ' ✕</span>'; }).join('') || '<span class="small muted">아래에서 멤버를 고르세요</span>';
      $('#pa-pick').innerHTML = '<div class="chips" style="margin-top:6px">' + members.filter(function (m) { return (m.id !== NC.me.id || tools) && !picked[m.id]; }).map(function (m) { return '<button class="chip" data-pk="' + esc(m.id) + '">' + esc(m.name) + '</button>'; }).join('') +
        '<button class="chip" id="pa-all">전체 선택</button></div>';
      $$('[data-un]').forEach(function (c) { c.onclick = function () { delete picked[c.getAttribute('data-un')]; drawPick(); }; });
      $$('[data-pk]').forEach(function (c) { c.onclick = function () { var m = members.filter(function (x) { return x.id === c.getAttribute('data-pk'); })[0]; picked[m.id] = m.name; drawPick(); }; });
      $('#pa-all').onclick = function () { members.forEach(function (m) { if (m.id !== NC.me.id && m.status === 'active') picked[m.id] = m.name; }); drawPick(); };
    }
    if ($('#pa-go')) $('#pa-go').onclick = async function () {
      var ids = Object.keys(picked), amt = +$('#pa-amt').value, reason = $('#pa-r').value.trim();
      if (!ids.length || !amt || !reason) return NC.toast('대상, 금액, 사유를 모두 입력하세요.', 'err');
      if (!(await NC.confirm(ids.length + '명에게 ' + U.signed(amt) + ' 파이를 ' + (amt > 0 ? '지급' : '회수') + '할까요?\n사유: ' + reason))) return;
      try { await NC.api('pie.adjust', { memberIds: ids, amount: amt, reason: reason }); NC.toast('적용했어요.', 'ok'); picked = {}; $('#pa-amt').value = ''; $('#pa-r').value = ''; drawPick(); load(); NC.refreshMe(); } catch (e) { NC.err(e); }
    };
    await load();
  };

  // ============================================================
  // 상점
  // ============================================================
  P['admin/shop'] = async function (el, q, alive) {
    var d = await NC.api('shop.admin');
    if (!alive()) return;
    var pf = 'waiting';
    el.innerHTML = '<div class="stack"><div class="card"><div class="card-head"><h2>상품</h2><button class="btn primary sm" id="sp-add" style="margin-left:auto">+ 상품 추가</button></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>상품</th><th class="num">가격</th><th>종류</th><th>재고</th><th>구매 제한</th><th>상태</th><th></th></tr></thead><tbody>' +
      (d.products.length ? d.products.map(function (p) {
        return '<tr' + (p.status === 'hidden' ? ' style="opacity:.55"' : '') + '><td><b>' + esc(p.name) + '</b></td><td class="num">' + U.num(p.price) + '</td><td class="small">' + (p.type === 'warn' ? '경고 차감' : '일반') + '</td>' +
          '<td class="small">' + (p.stock === null ? '무제한' : p.stock <= 0 ? '<b class="minus">품절</b>' : p.stock) + '</td><td class="small">' + (p.limitType === 'total' ? '전체 ' + p.limitN + '개' : p.limitType === 'weekly' ? '주당 ' + p.limitN + '개' : '없음') + '</td>' +
          '<td class="small">' + (p.status === 'hidden' ? '숨김' : '판매 중') + '</td><td><button class="btn sm" data-ed="' + p.id + '">수정</button></td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="empty">상품이 없어요</div></td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h2>구매 내역</h2><div class="seg" id="pu-f" style="margin-left:auto"><button data-f="waiting" class="on">지급 대기</button><button data-f="done">완료</button><button data-f="canceled">취소</button><button data-f="">전체</button></div></div><div id="pu-list"></div></div></div>';
    function drawP() {
      var arr = d.purchases.filter(function (x) { return !pf || x.status === pf; });
      $('#pu-list').innerHTML = arr.length ? '<div class="list">' + arr.map(function (x) {
        return '<div class="li wrap"><div class="grow"><b>' + esc(x.name) + '</b> · ' + esc(x.productName) + ' <span class="small muted">' + U.num(x.price) + '파이</span><div class="tiny muted">' + U.fmtDT(x.at) + (x.byName && x.status !== 'waiting' ? ' · 처리 ' + esc(x.byName) + ' ' + U.fmtDT(x.doneAt) : '') + '</div></div>' +
          NC.purchasePill(x.status) + (x.status === 'waiting' ? '<button class="btn sm primary" data-dv="' + x.id + '">지급 완료</button>' : '') + (x.status !== 'canceled' ? '<button class="btn sm danger" data-cx="' + x.id + '">구매 취소·환불</button>' : '') + '</div>';
      }).join('') + '</div>' : '<div class="empty">내역이 없어요</div>';
      $$('[data-dv]', el).forEach(function (b) { b.onclick = async function () { try { var r = await NC.api('shop.deliver', { id: b.getAttribute('data-dv') }); replace(r); } catch (e) { NC.err(e); } }; });
      $$('[data-cx]', el).forEach(function (b) {
        b.onclick = async function () {
          if (!(await NC.confirm('구매를 취소하고 파이를 환불할까요? 재고도 복원되고, 경고 차감 상품이면 경고가 되살아나요.', { danger: true, ok: '취소·환불' }))) return;
          try { var r = await NC.api('shop.cancel', { id: b.getAttribute('data-cx') }); replace(r); NC.toast('환불했어요.', 'ok'); } catch (e) { NC.err(e); }
        };
      });
    }
    function replace(r) { if (r && r.id) d.purchases = d.purchases.map(function (x) { return x.id === r.id ? r : x; }); drawP(); }
    $$('#pu-f button').forEach(function (b) { b.onclick = function () { pf = b.getAttribute('data-f'); $$('#pu-f button').forEach(function (x) { x.classList.toggle('on', x === b); }); drawP(); }; });
    drawP();
    function edit(p) {
      p = p || { name: '', desc: '', price: 0, type: 'normal', stock: null, limitType: 'none', limitN: 1, status: 'on' };
      NC.modal({ title: p.id ? '상품 수정' : '상품 추가', body: '<div class="stack"><label class="field"><span>이름</span><input class="input" id="pe-n" value="' + esc(p.name) + '"></label>' +
        '<label class="field"><span>설명 (지급 방식 안내 포함)</span><textarea class="input" id="pe-d">' + esc(p.desc) + '</textarea></label>' +
        '<div class="form-grid"><label class="field"><span>가격 (파이)</span><input class="input" type="number" id="pe-p" value="' + p.price + '"></label>' +
        '<label class="field"><span>종류</span><select class="input" id="pe-t">' + opts([['normal', '일반 (운영진이 직접 전달)'], ['warn', '경고 차감 (즉시 -1)']], p.type) + '</select></label>' +
        '<label class="field"><span>재고 (비우면 무제한)</span><input class="input" type="number" id="pe-s" value="' + (p.stock === null ? '' : p.stock) + '"></label>' +
        '<label class="field"><span>1인당 구매 제한</span><select class="input" id="pe-lt">' + opts([['none', '제한 없음'], ['total', '전체 기간 n개'], ['weekly', '주당 n개']], p.limitType) + '</select></label>' +
        '<label class="field"><span>n (제한 개수)</span><input class="input" type="number" id="pe-ln" value="' + (p.limitN || 1) + '"></label>' +
        '<label class="field"><span>판매 상태</span><select class="input" id="pe-st">' + opts([['on', '판매 중'], ['hidden', '숨김 (삭제)']], p.status) + '</select></label></div>' +
        '<p class="tiny muted" style="margin:0">상품을 삭제하면 숨김 처리되어 과거 구매 내역은 보존돼요.</p></div>',
        actions: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: async function (c, w) {
          var s = $('#pe-s', w).value;
          await NC.api('shop.save', { product: { id: p.id, name: $('#pe-n', w).value, desc: $('#pe-d', w).value, price: +$('#pe-p', w).value, type: $('#pe-t', w).value,
            stock: s === '' ? null : +s, limitType: $('#pe-lt', w).value, limitN: +$('#pe-ln', w).value, status: $('#pe-st', w).value } });
          NC.toast('저장했어요.', 'ok'); NC.route();
        } }] });
    }
    $('#sp-add').onclick = function () { edit(); };
    $$('[data-ed]', el).forEach(function (b) { b.onclick = function () { edit(d.products.filter(function (p) { return p.id === b.getAttribute('data-ed'); })[0]); }; });
  };

  // ============================================================
  // 주간 정산
  // ============================================================
  P['admin/settle'] = async function (el, q, alive) {
    var L = await NC.api('settle.list');
    if (!alive()) return;
    var weeks = L.unsettled.concat(L.settled.map(function (s) { return s.week; })).filter(function (w, i, a) { return a.indexOf(w) === i; }).sort().reverse();
    var cur = q.week || L.unsettled[0] || weeks[0] || U.addDays(L.current, -7);
    if (weeks.indexOf(cur) < 0) weeks.unshift(cur);
    el.innerHTML = '<div class="stack"><div class="row wrap"><label class="field"><span>정산할 주</span><select class="input" id="st-w">' +
      weeks.map(function (w) { var done = L.settled.some(function (s) { return s.week === w; }); return '<option value="' + w + '"' + (w === cur ? ' selected' : '') + '>' + U.md(w) + ' ~ ' + U.md(U.addDays(w, 6)) + (done ? ' (정산 완료)' : ' (미정산)') + '</option>'; }).join('') +
      '</select></label><label class="field"><span>다른 주</span><input type="date" class="input" id="st-pick" max="' + U.addDays(L.current, -1) + '"></label></div><div id="st-body"></div></div>';
    $('#st-w').onchange = function () { NC.go('admin/settle?week=' + this.value); };
    $('#st-pick').onchange = function () { if (this.value) NC.go('admin/settle?week=' + U.weekOf(this.value)); };
    var body = $('#st-body');
    body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    var d = await NC.api('settle.preview', { week: cur });
    if (!alive()) return;
    var items = ['attend', 'study', 'problem', 'mentoring', 'daily'];
    var total = 0;
    d.rows.forEach(function (r) { total += r.total; });
    var h = '';
    if (d.locked) h += '<div class="banner">🔒 ' + U.fmtDT(d.at) + ' ' + esc(d.byName || '') + ' 님이 확정한 정산이에요. 이 주의 판정은 잠겨 있어요.' + (L.canCancel ? '<button class="btn sm danger right" id="st-cancel">정산 취소</button>' : '') + '</div>';
    else {
      var pc = d.precheck;
      h += '<div class="card"><div class="card-head"><h2>① 사전 점검</h2></div>' +
        (pc.pending.length || pc.grayRequired.length ? '<div class="banner urgent" style="margin-bottom:10px">⚠️ 판정이 끝나지 않은 칸이 있어요. 그대로 진행할 수도 있지만, 먼저 판정 표에서 정리하는 것을 권장해요.</div>' : '<div class="small" style="color:var(--ok)">✓ 확인 대기 칸이 없어요.</div>') +
        (pc.pending.length ? '<details open><summary><b>확인 대기 ' + pc.pending.length + '개</b></summary><div class="small" style="margin:6px 0 10px">' + pc.pending.map(function (x) { return U.md(x.date) + ' ' + esc(x.name) + ' ' + esc(x.missionName); }).join(' · ') + '</div></details>' : '') +
        (pc.grayRequired.length ? '<details><summary><b>' + esc(NC.TAG_NAMES.mentee) + ' 필수 미션 회색 ' + pc.grayRequired.length + '개</b> <span class="small muted">(전체 회색 ' + pc.grayTotal + '개)</span></summary><div class="small" style="margin:6px 0 10px">' + pc.grayRequired.map(function (x) { return U.md(x.date) + ' ' + esc(x.name) + ' ' + esc(x.missionName); }).join(' · ') + '</div></details>' : '<div class="small muted">전체 회색 칸 ' + pc.grayTotal + '개 (선택 미션 포함)</div>') +
        '<a class="btn sm" href="#/admin/judge?date=' + cur + '" style="margin-top:8px">판정 표로 가기</a></div>';
    }
    h += '<div class="card"><div class="card-head"><h2>' + (d.locked ? '정산 결과' : '② 미리보기') + '</h2><span class="small muted">총 ' + U.num(total) + ' 파이</span></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>멤버</th>' + items.map(function (k) { return '<th class="num">' + esc(NC.MISSION_SHORT[k]) + '</th>'; }).join('') + '<th class="num">공부시간</th><th class="num">순위</th><th class="num">합계</th></tr></thead><tbody>' +
      d.rows.map(function (r) {
        return '<tr><td>' + NC.who(r) + '</td>' + items.map(function (k) { return '<td class="num">' + r.counts[k] + '일' + (r.bonus[k] ? '<div class="tiny plus">+' + r.bonus[k] + '</div>' : '') + '</td>'; }).join('') +
          '<td class="num">' + U.fmtMin(r.minutes) + '</td><td class="num">' + (r.rank ? r.rank + '등' + (r.rankBonus ? '<div class="tiny plus">+' + U.num(r.rankBonus) + '</div>' : '') : '-') + '</td><td class="num"><b>' + U.num(r.total) + '</b></td></tr>';
      }).join('') + '</tbody></table></div><p class="tiny muted">수행일 = 초록 + 연두 칸. 데이오프일은 실제로 한 미션만 셉니다. 위클리 퀘스트는 판정 즉시 지급되므로 제외돼요.</p></div>';
    if (!d.locked) {
      h += '<div class="card"><div class="card-head"><h2>③ 확정</h2></div>' +
        (L.canConfirm ? '<p class="small">확정하면 보너스가 즉시 지급되고 이 주의 판정이 잠깁니다. 결과 공지 초안이 공지 관리에 만들어져요.' + (L.canCancel ? ' 잘못 확정했다면 나중에 정산 취소로 되돌릴 수 있어요.' : '') + '</p>' +
          '<div class="row wrap"><input class="input" id="st-phrase" placeholder="정산 확정" style="max-width:200px"><button class="btn danger fill" id="st-go">정산 확정</button></div><p class="tiny muted">확인 문구 <b>정산 확정</b>을 입력하세요.</p>'
          : '<p class="small muted">정산 확정 버튼은 개발자 계정에 있어요. 미리보기를 확인했다면 개발자에게 알려 주세요.</p>') + '</div>';
    }
    body.innerHTML = h;
    if ($('#st-go')) $('#st-go').onclick = async function () {
      if ($('#st-phrase').value.trim() !== '정산 확정') return NC.toast('확인 문구를 정확히 입력하세요.', 'err');
      if (!(await NC.confirm(U.md(cur) + ' 주를 정산합니다. 총 ' + U.num(total) + ' 파이가 지급돼요. 진행할까요?', { danger: true, ok: '확정' }))) return;
      try { var r = await NC.api('settle.confirm', { week: cur, phrase: '정산 확정' }); NC.toast('정산 완료! ' + U.num(r.total) + ' 파이 지급', 'ok'); NC.refreshMe(); NC.route(); } catch (e) { NC.err(e); }
    };
    if ($('#st-cancel')) $('#st-cancel').onclick = async function () {
      var ok = await NC.confirm(U.md(cur) + ' 주 정산을 취소할까요? 지급했던 보너스 ' + U.num(total) + ' 파이를 회수하고, 이 주의 판정 잠금이 풀려요. 결과 공지 초안은 그대로 남아요.\n확인 문구 \'정산 취소\'를 입력하세요.',
        { danger: true, ok: '정산 취소', extra: '<input class="input" id="sc-p" placeholder="정산 취소">', collect: function (x) { return $('#sc-p', x).value.trim(); } });
      if (!ok) return;
      try { var r = await NC.api('settle.cancel', { week: cur, phrase: ok }); NC.toast('정산을 취소했어요. ' + U.num(r.total) + ' 파이 회수', 'ok'); NC.refreshMe(); NC.route(); } catch (e) { NC.err(e); }
    };
  };

  // ============================================================
  // 공지
  // ============================================================
  P['admin/notices'] = async function (el, q, alive) {
    var list = await NC.api('notices.list');
    if (!alive()) return;
    el.innerHTML = '<div class="stack"><div class="row"><button class="btn primary right" id="nt-add">+ 새 공지</button></div><div class="card">' +
      (list.length ? '<div class="list">' + list.map(function (n) {
        return '<div class="li wrap"><div class="grow">' + (n.draft ? '<span class="badge soft">초안</span> ' : '') + (n.pinned ? '📌 ' : '') + (n.important ? '<span class="badge req">중요</span> ' : '') + '<b>' + esc(n.title) + '</b><div class="tiny muted">' + esc(n.authorName) + ' · ' + U.fmtDT(n.at) + '</div></div>' +
          '<button class="btn sm" data-e="' + n.id + '">' + (n.draft ? '다듬어 게시' : '수정') + '</button><button class="btn sm ghost" data-d="' + n.id + '">삭제</button></div>';
      }).join('') + '</div>' : '<div class="empty">공지가 없어요</div>') + '</div></div>';
    function edit(n) {
      n = n || { title: '', body: '', pinned: false, important: false, draft: false };
      NC.modal({ title: n.id ? (n.draft ? '초안 다듬기' : '공지 수정') : '새 공지', wide: true, body: '<div class="stack"><label class="field"><span>제목</span><input class="input" id="ne-t" value="' + esc(n.title) + '"></label>' +
        '<label class="field"><span>본문</span><textarea class="input" id="ne-b" rows="12">' + esc(n.body) + '</textarea></label>' +
        '<div class="row wrap"><label class="check"><input type="checkbox" id="ne-p"' + (n.pinned ? ' checked' : '') + '>상단 고정</label><label class="check"><input type="checkbox" id="ne-i"' + (n.important ? ' checked' : '') + '>중요 표시</label></div></div>',
        actions: [{ label: '취소' }, { label: '초안 저장', onClick: function (c, w) { return save(w, true); } }, { label: '게시', cls: 'primary', onClick: function (c, w) { return save(w, false); } }] });
      async function save(w, draft) {
        await NC.api('notices.save', { notice: { id: n.id, title: $('#ne-t', w).value, body: $('#ne-b', w).value, pinned: $('#ne-p', w).checked, important: $('#ne-i', w).checked, draft: draft } });
        NC.toast(draft ? '초안을 저장했어요.' : '게시했어요.', 'ok'); NC.route();
      }
    }
    $('#nt-add').onclick = function () { edit(); };
    $$('[data-e]', el).forEach(function (b) { b.onclick = function () { edit(list.filter(function (n) { return n.id === b.getAttribute('data-e'); })[0]); }; });
    $$('[data-d]', el).forEach(function (b) { b.onclick = async function () { if (!(await NC.confirm('이 공지를 삭제할까요?', { danger: true, ok: '삭제' }))) return; try { await NC.api('notices.delete', { id: b.getAttribute('data-d') }); NC.route(); } catch (e) { NC.err(e); } }; });
  };

  // ============================================================
  // 활동 기록
  // ============================================================
  P['admin/logs'] = async function (el, q, alive) {
    var F = { from: U.addDays(U.today(), -14), to: U.today(), actor: '', target: '', act: '' };
    el.innerHTML = '<div class="stack"><div class="form-grid" id="lg-f"></div><div id="lg-list"></div></div>';
    async function load() {
      $('#lg-list').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      var d = await NC.api('logs.list', F);
      if (!alive()) return;
      if (!$('#lg-from')) {
        $('#lg-f').innerHTML = '<label class="field"><span>시작</span><input type="date" class="input sm" id="lg-from" value="' + F.from + '"></label><label class="field"><span>끝</span><input type="date" class="input sm" id="lg-to" value="' + F.to + '"></label>' +
          '<label class="field"><span>한 사람</span><select class="input sm" id="lg-actor">' + memberOpts(d.members, '', '전체') + '</select></label>' +
          '<label class="field"><span>대상 멤버</span><select class="input sm" id="lg-target">' + memberOpts(d.members, '', '전체') + '</select></label>' +
          '<label class="field"><span>한 일</span><select class="input sm" id="lg-act"><option value="">전체</option>' + opts(d.actions.map(function (a) { return [a, a]; }), '') + '</select></label>';
        [['lg-from', 'from'], ['lg-to', 'to'], ['lg-actor', 'actor'], ['lg-target', 'target'], ['lg-act', 'act']].forEach(function (x) { $('#' + x[0]).onchange = function () { F[x[1]] = this.value; load(); }; });
      }
      $('#lg-list').innerHTML = '<p class="small muted" style="margin:0 2px 8px">총 ' + d.total + '건 · 활동 기록은 사이트에서 고치거나 지울 수 없어요.</p><div class="table-wrap"><table class="tbl"><thead><tr><th>일시</th><th>한 사람</th><th>한 일</th><th>대상</th><th>바꾸기 전 → 후</th><th>사유·내용</th></tr></thead><tbody>' +
        (d.list.length ? d.list.map(function (l) {
          var ba = (l.before || l.after) ? '<span class="muted">' + esc(short(l.before)) + '</span> → ' + esc(short(l.after)) : '';
          return '<tr><td class="small">' + U.fmtDT(l.at) + '</td><td>' + esc(l.actorName) + '</td><td class="small"><b>' + esc(l.action) + '</b></td><td>' + esc(l.targetName) + '</td>' +
            '<td class="small" style="white-space:normal;max-width:300px">' + ba + '</td><td class="small" style="white-space:normal;max-width:240px">' + esc(l.reason) + '</td></tr>';
        }).join('') : '<tr><td colspan="6"><div class="empty">기록이 없어요</div></td></tr>') + '</tbody></table></div>';
    }
    function short(s) { s = String(s || ''); return s.length > 80 ? s.slice(0, 80) + '…' : s; }
    await load();
  };
})();
