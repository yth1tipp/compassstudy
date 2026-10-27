/* 운영 화면 2 — 미니게임 관리 · 시스템 설정 · 데이터 도구 */
(function () {
  var NC = window.NC, U = NC.u, $ = U.$, $$ = U.$$, esc = U.esc;
  var P = NC.pages;
  function opts(list, cur) { return NC.opts(list, cur); }
  function attr(o) { return esc(JSON.stringify(o)); }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    var framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (framed) NC.toast('파일이 안 받아지면 사이트를 브라우저에서 직접 열어 주세요. (미리보기 창에서는 내려받기가 막혀 있을 수 있어요)');
  }
  function readFile(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = rej; r.readAsText(file, 'utf-8'); }); }
  function stampName() { var d = new Date(Date.now() + 9 * 3600000); return d.toISOString().slice(0, 16).replace(/[-:T]/g, ''); }

  // ============================================================
  // 미니게임 관리
  // ============================================================
  P['admin/games'] = async function (el, q, alive) {
    var today = U.today(), from = q.from ? U.weekOf(q.from) : U.addDays(U.weekOf(today), -7);
    var d = await NC.api('game.config', { from: from, to: q.to || null });
    if (!alive()) return;
    var names = d.names, F = d.fields, G = JSON.parse(JSON.stringify(d.games)), anytime = d.maxDate === null, byDate = {};
    d.days.forEach(function (x) { byDate[x.date] = x; });
    function editable(dt) { return (anytime || dt >= today) && (anytime || !d.maxDate || dt <= d.maxDate); }
    var weeks = [];
    for (var w = d.from; w <= d.to; w = U.addDays(w, 7)) weeks.push(w);
    var gameList = Object.keys(names).map(function (k) { return [k, names[k]]; });
    el.innerHTML = '<div class="stack">' +
      '<div class="card"><div class="card-head"><h2>날짜별 게임</h2><span class="small muted">오늘: <b>' + esc((byDate[today] ? byDate[today].games : d.todayGames).map(function (g) { return names[g]; }).join(' / ') || '-') + '</b></span></div>' +
      '<p class="small muted" style="margin-top:-4px">날짜마다 게임을 1개 또는 2개 골라요. 2개인 날은 멤버가 도전할 때마다 둘 중 하나를 골라요. 정하지 않은 날(흐린 칸)은 아래 순서대로 1개가 자동으로 열려요.' + (anytime ? ' 기간 제한 없이 정할 수 있어요.' : ' ' + U.md(d.maxDate) + '까지 미리 정할 수 있어요.') + '</p>' +
      '<div class="row wrap" style="margin-bottom:8px"><a class="btn sm" href="#/admin/games?from=' + U.addDays(d.from, -28) + '&to=' + U.addDays(d.from, -1) + '">◀ 이전</a>' + (anytime || U.addDays(d.to, 1) <= d.maxDate ? '<a class="btn sm" href="#/admin/games?from=' + U.addDays(d.to, 1) + '&to=' + U.addDays(d.to, 28) + '">다음 ▶</a>' : '') + '<a class="btn sm ghost" href="#/admin/games">이번 주 기준으로</a></div>' +
      '<div class="gsched">' + weeks.map(function (wk) {
        return '<div class="gs-week"><div class="gs-wh"><b>' + U.md(wk) + ' 주</b>' + (weeks.length && [0, 1, 2, 3, 4, 5, 6].some(function (i) { return editable(U.addDays(wk, i)); }) ? '<button class="btn sm ghost" data-wk="' + wk + '">한 주 정하기</button>' : '') + '</div><div class="gs-days">' +
          [0, 1, 2, 3, 4, 5, 6].map(function (i) {
            var dt = U.addDays(wk, i), x = byDate[dt] || { games: [], fixed: false }, ed = editable(dt);
            return '<button class="gs-day' + (x.fixed ? ' fixed' : '') + (dt === today ? ' today' : '') + (ed ? '' : ' ro') + '" data-day="' + dt + '"' + (ed ? '' : ' disabled') + '><span class="dl">' + U.DOW[i] + ' ' + U.md(dt) + '</span><span class="em">' + x.games.map(function (g) { return NC.games.emoji(g); }).join(' ') + '</span><span class="nm">' + esc(x.games.map(function (g) { return names[g]; }).join(' · ')) + (x.fixed ? '' : ' (자동)') + '</span></button>';
          }).join('') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="grid2"><div class="card"><div class="card-head"><h2>자동 순서 · 켜기/끄기</h2></div>' +
      '<p class="tiny muted" style="margin:-4px 0 8px">날짜별로 정하지 않은 날에 이 순서대로 1종씩 열려요. 끈 게임은 건너뛰어요.</p><div class="list" id="gm-order"></div><button class="btn primary" id="gm-save-list" style="margin-top:10px">순서 저장</button></div>' +
      '<div class="stack">' + (d.canExtra ? '<div class="card"><div class="card-head"><h2>기회 더 주기</h2></div><div class="stack"><div class="chips" id="gx-pick"></div>' +
        '<div class="form-grid"><label class="field"><span>날짜</span><input type="date" class="input" id="gx-d" value="' + today + '"></label><label class="field"><span>기회 (빼려면 음수)</span><input type="number" class="input" id="gx-n" value="1"></label><label class="field"><span>사유</span><input class="input" id="gx-r" placeholder="예: 오류 보상, 이벤트"></label></div>' +
        '<button class="btn" id="gx-go" style="align-self:flex-start">주기</button></div></div>' : '') +
      (d.canRules ? '<div class="card"><div class="card-head"><h2>도전 기회</h2></div><div class="form-grid">' +
        '<label class="field"><span>기본 기회</span><input class="input" type="number" id="gm-base" value="' + G.baseChances + '"></label>' +
        '<label class="field"><span>공부인증 체크 시 추가</span><input class="input" type="number" id="gm-bonus" value="' + G.bonusChances + '"></label>' +
        '<label class="field"><span>1회 최대 파이</span><input class="input" type="number" id="gm-max" value="' + G.maxPerPlay + '"></label></div></div>' : '') + '</div></div>' +
      (d.canRules ? '<div class="card"><div class="card-head"><h2>게임별 보상 · 규칙</h2></div><div class="row wrap" style="margin-bottom:12px"><select class="input sm" id="gm-cg" style="max-width:220px">' + opts(G.order.map(function (k) { return [k, names[k]]; }), G.order[0]) + '</select><button class="btn sm ghost" id="gm-cdef">처음 값으로</button></div>' +
        '<div id="gm-form" class="form-grid"></div><button class="btn primary" id="gm-save-rules" style="margin-top:12px">보상 · 기회 저장</button></div>' : '') +
      (d.canExtra ? '<div class="row"><button class="btn" id="gm-plays-btn">최근 플레이 기록 보기</button></div><div id="gm-plays"></div>' : '') + '</div>';

    // 날짜별 게임
    function pickModal(title, cur, onSave) {
      var sel = (cur || []).slice();
      var mo = NC.modal({ title: title, body: '<div class="stack"><p class="small muted" style="margin:0">1개 또는 2개를 골라요. 하나도 안 고르면 자동 순서대로 열려요.</p><div class="game-grid" id="pk"></div></div>',
        actions: [{ label: '취소' }, { label: '자동으로 두기', onClick: function () { return onSave([]); } }, { label: '저장', cls: 'primary', onClick: function () { return onSave(sel); } }] });
      function draw() {
        $('#pk', mo.body).innerHTML = gameList.map(function (g) { var i = sel.indexOf(g[0]); return '<button class="gpk' + (i >= 0 ? ' on' : '') + '" data-g="' + g[0] + '"><span class="e">' + NC.games.emoji(g[0]) + '</span>' + esc(g[1]) + (i >= 0 ? '<span class="no">' + (i + 1) + '</span>' : '') + '</button>'; }).join('');
        $$('[data-g]', mo.body).forEach(function (b) { b.onclick = function () { var g = b.getAttribute('data-g'), i = sel.indexOf(g); if (i >= 0) sel.splice(i, 1); else { if (sel.length >= 2) sel.shift(); sel.push(g); } draw(); }; });
      }
      draw();
    }
    async function saveDays(days) { await NC.api('game.schedule', { days: days }); NC.toast('저장했어요.', 'ok'); NC.route(); }
    $$('[data-day]', el).forEach(function (b) {
      b.onclick = function () {
        var dt = b.getAttribute('data-day'), x = byDate[dt] || { games: [], fixed: false };
        pickModal(U.mdw(dt) + ' 게임', x.fixed ? x.games : [], function (sel) { var o = {}; o[dt] = sel; return saveDays(o); });
      };
    });
    $$('[data-wk]', el).forEach(function (b) {
      b.onclick = function () {
        var wk = b.getAttribute('data-wk'), ds = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return U.addDays(wk, i); }).filter(editable);
        var go = [['', '자동']].concat(gameList), go2 = [['', '없음']].concat(gameList);
        NC.modal({ title: U.md(wk) + ' 주 게임 정하기', wide: true, body: '<div class="stack">' + ds.map(function (dt) {
          var x = byDate[dt] || { games: [], fixed: false }, g = x.fixed ? x.games : [];
          return '<div class="row wrap"><b style="min-width:84px">' + U.mdw(dt) + '</b><select class="input sm" data-a="' + dt + '" style="width:auto">' + opts(go, g[0] || '') + '</select><select class="input sm" data-b="' + dt + '" style="width:auto">' + opts(go2, g[1] || '') + '</select></div>';
        }).join('') + '<p class="tiny muted" style="margin:0">두 번째 칸을 고르면 그날은 둘 중 하나를 골라서 해요.</p></div>',
          actions: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: function (c, w) {
            var days = {};
            ds.forEach(function (dt) { var a = $('[data-a="' + dt + '"]', w).value, bb = $('[data-b="' + dt + '"]', w).value; days[dt] = a ? (bb && bb !== a ? [a, bb] : [a]) : (bb ? [bb] : []); });
            return saveDays(days);
          } }] });
      };
    });
    // 순서
    var dragIdx = null;
    function drawOrder() {
      $('#gm-order').innerHTML = G.order.map(function (g, i) {
        return '<div class="li" draggable="true" data-i="' + i + '" style="cursor:grab"><span class="muted">⋮⋮</span><span style="font-size:20px">' + NC.games.emoji(g) + '</span><b class="grow">' + (i + 1) + '. ' + esc(names[g]) + '</b>' +
          '<label class="check"><input type="checkbox" data-en="' + g + '"' + (G.enabled[g] !== false ? ' checked' : '') + '>켜기</label>' +
          '<button class="btn icon sm ghost" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">↑</button><button class="btn icon sm ghost" data-dn="' + i + '"' + (i === G.order.length - 1 ? ' disabled' : '') + ' aria-label="아래로">↓</button></div>';
      }).join('');
      $$('[data-en]').forEach(function (c) { c.onchange = function () { G.enabled[c.getAttribute('data-en')] = c.checked; }; });
      function mv(i, j) { var x = G.order.splice(i, 1)[0]; G.order.splice(j, 0, x); drawOrder(); }
      $$('[data-up]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-up'); mv(i, i - 1); }; });
      $$('[data-dn]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-dn'); mv(i, i + 1); }; });
      $$('#gm-order [draggable]').forEach(function (r) {
        r.ondragstart = function () { dragIdx = +r.getAttribute('data-i'); };
        r.ondragover = function (e) { e.preventDefault(); };
        r.ondrop = function (e) { e.preventDefault(); var j = +r.getAttribute('data-i'); if (dragIdx !== null && dragIdx !== j) mv(dragIdx, j); dragIdx = null; };
      });
    }
    drawOrder();
    $('#gm-save-list').onclick = async function () { try { var r = await NC.api('game.saveList', { games: { order: G.order, enabled: G.enabled } }); NC.toast('저장했어요. 오늘: ' + r.todayGames.map(function (g) { return names[g]; }).join(' / '), 'ok'); } catch (e) { NC.err(e); } };
    // 기회 더 주기
    if ($('#gx-pick')) {
      var gx = {};
      var drawGx = function () {
        $('#gx-pick').innerHTML = d.members.map(function (m) { return '<button class="chip' + (gx[m.id] ? ' on' : '') + '" data-gx="' + esc(m.id) + '">' + esc(m.name) + '</button>'; }).join('');
        $$('[data-gx]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-gx'); if (gx[id]) delete gx[id]; else gx[id] = true; drawGx(); }; });
      };
      drawGx();
      $('#gx-go').onclick = async function () {
        var ids = Object.keys(gx);
        if (!ids.length) return NC.toast('멤버를 고르세요.', 'err');
        try { await NC.api('game.extra', { memberIds: ids, date: $('#gx-d').value, n: +$('#gx-n').value, reason: $('#gx-r').value }); NC.toast(ids.length + '명에게 기회를 줬어요.', 'ok'); gx = {}; drawGx(); } catch (e) { NC.err(e); }
      };
    }
    // 보상 · 규칙
    if (d.canRules) {
      var curG = G.order[0];
      var getP = function (o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
      var setP = function (o, path, v) { var p = path.split('.'); for (var i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; } o[p[p.length - 1]] = v; };
      var tiersHtml = function (id, list) {
        return '<div class="field-tiers" data-tiers="' + id + '">' + list.map(function (t) {
          return '<div class="tier-row"><input class="input sm" type="number" step="any" value="' + t[0] + '"><span class="muted">→</span><input class="input sm" type="number" step="any" value="' + t[1] + '"><span class="small muted">파이</span><button class="btn ghost sm" data-del-tier>삭제</button></div>';
        }).join('') + '<button class="btn sm ghost" data-add-tier style="align-self:flex-start">+ 구간 추가</button></div>';
      };
      var bindTier = function (tr) { $('[data-del-tier]', tr).onclick = function () { tr.remove(); }; };
      var showCfg = function () {
        var c = G.cfg[curG];
        $('#gm-form').innerHTML = F[curG].map(function (f, i) {
          var v = getP(c, f.key), id = 'gf' + i;
          if (f.type === 'num') return '<label class="field"><span>' + esc(f.label) + '</span><input class="input" type="number" step="any" id="' + id + '" value="' + v + '"></label>';
          if (f.type === 'list') return '<label class="field" style="grid-column:1/-1"><span>' + esc(f.label) + '</span><input class="input" id="' + id + '" value="' + esc((v || []).join(', ')) + '"><span class="tiny muted">쉼표로 구분해서 적어요</span></label>';
          return '<div class="field" style="grid-column:1/-1"><span>' + esc(f.label) + '</span>' + tiersHtml(id, v || []) + '</div>';
        }).join('');
        $$('[data-add-tier]', el).forEach(function (b) { b.onclick = function () { var row = document.createElement('div'); row.innerHTML = tiersHtml('x', [['', '']]); var tr = $('.tier-row', row); b.parentNode.insertBefore(tr, b); bindTier(tr); }; });
        $$('.tier-row', el).forEach(bindTier);
      };
      var stashCfg = function () {
        var c = G.cfg[curG];
        for (var i = 0; i < F[curG].length; i++) {
          var f = F[curG][i], id = 'gf' + i;
          if (f.type === 'num') { var v = $('#' + id).value; if (v === '' || !isFinite(+v)) { NC.toast('"' + f.label + '" 값을 숫자로 적어주세요.', 'err'); return false; } setP(c, f.key, +v); }
          else if (f.type === 'list') { var l = $('#' + id).value.split(/[,\s]+/).filter(Boolean).map(Number).filter(function (n) { return isFinite(n); }); if (!l.length) { NC.toast('"' + f.label + '"을 적어주세요.', 'err'); return false; } setP(c, f.key, l); }
          else {
            var rows = $$('[data-tiers="' + id + '"] .tier-row', el).map(function (tr) { var ins = $$('input', tr); return [ins[0].value, ins[1].value]; })
              .filter(function (t) { return t[0] !== '' && t[1] !== ''; }).map(function (t) { return [+t[0], +t[1]]; });
            if (!rows.length) { NC.toast('"' + f.label + '" 구간을 하나 이상 적어주세요.', 'err'); return false; }
            setP(c, f.key, rows);
          }
        }
        return true;
      };
      $('#gm-cg').onchange = function () { if (!stashCfg()) { this.value = curG; return; } curG = this.value; showCfg(); };
      $('#gm-cdef').onclick = function () { F[curG].forEach(function (f) { setP(G.cfg[curG], f.key, JSON.parse(JSON.stringify(f.dflt))); }); showCfg(); };
      showCfg();
      $('#gm-save-rules').onclick = async function () {
        if (!stashCfg()) return;
        try { await NC.api('game.saveRules', { games: { cfg: G.cfg, baseChances: +$('#gm-base').value, bonusChances: +$('#gm-bonus').value, maxPerPlay: +$('#gm-max').value } }); NC.toast('저장했어요.', 'ok'); } catch (e) { NC.err(e); }
      };
    }
    // 플레이 기록
    if ($('#gm-plays-btn')) $('#gm-plays-btn').onclick = async function () {
      var pd = await NC.api('game.plays', { from: U.addDays(today, -6), to: today });
      $('#gm-plays').innerHTML = '<div class="card" style="margin-top:14px"><div class="card-head"><h2>플레이 기록 (최근 7일)</h2></div><div class="table-wrap"><table class="tbl"><thead><tr><th>시작</th><th>멤버</th><th>게임</th><th>회차</th><th>결과</th><th class="num">파이</th>' + (pd.canEdit ? '<th></th>' : '') + '</tr></thead><tbody>' +
        (pd.plays.length ? pd.plays.map(function (p) {
          return '<tr><td class="small">' + U.fmtDT(p.startedAt) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.gameName) + '</td><td>' + p.round + '</td><td class="small" style="white-space:normal;max-width:280px">' + esc(p.resultText) + '</td><td class="num">' + (p.status === 'done' ? p.pie : '진행 중') + '</td>' +
            (pd.canEdit ? '<td class="nowrap"><button class="btn sm ghost" data-pe="' + attr(p) + '">고치기</button><button class="btn sm ghost" data-pd="' + attr(p) + '">지우기</button></td>' : '') + '</tr>';
        }).join('') : '<tr><td colspan="7"><div class="empty">기록이 없어요</div></td></tr>') + '</tbody></table></div>' +
        (pd.extras.length ? '<div class="small" style="margin-top:10px"><b>준 기회</b> · ' + pd.extras.map(function (x) { return U.md(x.date) + ' ' + esc(x.name) + ' ' + (x.n > 0 ? '+' : '') + x.n + '회 (' + esc(x.byName) + (x.reason ? ', ' + esc(x.reason) : '') + ')'; }).join(' · ') + '</div>' : '') + '</div>';
      $$('[data-pe]', el).forEach(function (b) {
        b.onclick = async function () {
          var p = JSON.parse(b.getAttribute('data-pe'));
          var v = await NC.confirm(p.name + ' · ' + p.gameName + ' ' + p.round + '회차의 파이를 고쳐요. 차액은 바로 지급·회수돼요.', { title: '플레이 기록 고치기', ok: '저장', extra: '<input class="input" type="number" id="pp" value="' + p.pie + '">', collect: function (x) { return $('#pp', x).value; } });
          if (v === false || v === '') return;
          try { await NC.api('game.playEdit', { date: p.date, id: p.id, pie: +v }); NC.toast('고쳤어요.', 'ok'); $('#gm-plays-btn').click(); } catch (e) { NC.err(e); }
        };
      });
      $$('[data-pd]', el).forEach(function (b) {
        b.onclick = async function () {
          var p = JSON.parse(b.getAttribute('data-pd'));
          if (!(await NC.confirm(p.name + ' · ' + p.gameName + ' ' + p.round + '회차 기록을 지울까요? 받은 ' + p.pie + '파이는 회수되고, 그날 기회가 1회 돌아와요.', { danger: true, ok: '지우기' }))) return;
          try { await NC.api('game.playEdit', { date: p.date, id: p.id, remove: true }); NC.toast('지웠어요.', 'ok'); $('#gm-plays-btn').click(); } catch (e) { NC.err(e); }
        };
      });
      $('#gm-plays').scrollIntoView({ behavior: 'smooth' });
    };
  };

  // ============================================================
  // 사용량 막대
  // ============================================================
  function usageLevel(pct) {
    if (pct < 50) return ['blue', '여유'];
    if (pct < 75) return ['green', '보통'];
    if (pct < 100) return ['yellow', '주의'];
    if (pct < 125) return ['orange', '예산 넘음'];
    if (pct < 150) return ['red', '많이 넘음'];
    return ['darkred', '크게 넘음'];
  }
  NC.usageLevel = usageLevel;
  function meter(label, pct, text) {
    var lv = usageLevel(pct);
    return '<div class="meter lv-' + lv[0] + '"><div class="row"><b>' + label + '</b><span class="pill">' + lv[1] + '</span><span class="right small">' + text + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, pct) + '%"></i>' + (pct > 100 ? '<em style="width:' + Math.min(100, pct - 100) + '%"></em>' : '') + '</div><div class="tiny muted">' + pct.toFixed(1) + '%</div></div>';
  }
  function mb(b) { return (b / 1048576).toFixed(b < 10 * 1048576 ? 2 : 1) + 'MB'; }

  // ============================================================
  // 속도 점검 (개발자 화면 · 시스템 설정 안)
  //   전체 시간 = 서버까지 오가는 시간 + 서버 안에서 쓴 시간(그중 데이터베이스 시간)
  // ============================================================
  function msStr(v) { if (v === undefined || v === null || !isFinite(v)) return '-'; return v < 1000 ? Math.round(v) + 'ms' : (v / 1000).toFixed(2) + '초'; }
  function speedRow(x, i) {
    var net = x.server !== undefined ? Math.max(0, x.total - x.server) : null;
    return '<tr><td>' + (i !== undefined ? (i + 1) + '회' : '<span class="small">' + esc(x.action) + '</span>') + (x.cold ? ' <span class="pill" title="이 서버가 막 켜진 뒤 처음 받은 요청이에요">첫 구동</span>' : '') + (x.ok ? '' : ' <span class="pill st-fail">오류</span>') + '</td>' +
      '<td class="num"><b>' + msStr(x.total) + '</b></td><td class="num">' + msStr(net) + '</td><td class="num">' + msStr(x.server) + '</td>' +
      '<td class="num">' + msStr(x.db) + '</td><td class="num">' + (x.q === undefined ? '-' : x.q + '번') + '</td></tr>';
  }
  var SPEED_HEAD = '<thead><tr><th></th><th class="num">전체</th><th class="num">오가는 시간</th><th class="num">서버 안</th><th class="num">그중 데이터베이스</th><th class="num">질의</th></tr></thead>';
  function speedCheck(box) {
    if (!box) return;
    box.innerHTML = '<div class="card-head"><h2>속도 점검</h2></div>' +
      '<p class="small muted" style="margin:-4px 0 10px">가장 가벼운 요청을 5번 연달아 보내서 걸린 시간을 나눠서 보여줘요. <b>오가는 시간</b>은 이 기기에서 서버까지 갔다 오는 시간(인터넷 · 서버 위치), <b>서버 안</b>은 서버가 일한 시간, <b>그중 데이터베이스</b>는 데이터베이스를 기다린 시간이에요. 5번은 오늘 요청 수에 더해져요.' + (NC.demo ? ' (체험판은 서버 없이 이 브라우저 안에서 돌아서 숫자가 실제와 달라요)' : '') + '</p>' +
      '<div class="row wrap"><button class="btn primary sm" id="sp-go">5번 재기</button><button class="btn sm" id="sp-log">최근 요청 보기</button></div><div id="sp-out" style="margin-top:12px"></div>';
    var out = $('#sp-out', box);
    $('#sp-go', box).onclick = async function () {
      var b = this, rows = [];
      b.disabled = true;
      out.innerHTML = '<div class="small muted">재는 중… 0/5</div>';
      try {
        for (var i = 0; i < 5; i++) {
          await NC.api('system.ping');
          var x = NC.reqLog[NC.reqLog.length - 1];
          if (x && x.action === 'system.ping') rows.push(x);
          out.innerHTML = '<div class="small muted">재는 중… ' + (i + 1) + '/5</div>';
        }
        var warm = rows.filter(function (x) { return !x.cold; }), use = warm.length ? warm : rows;
        function avg(k) { var v = use.filter(function (x) { return isFinite(x[k]); }); return v.length ? v.reduce(function (s, x) { return s + x[k]; }, 0) / v.length : null; }
        var tot = avg('total'), srv = avg('server'), dbm = avg('db'), net = tot !== null && srv !== null ? Math.max(0, tot - srv) : null;
        out.innerHTML = '<div class="grid3"><div class="stat"><div class="k">평균 전체</div><div class="v">' + msStr(tot) + '</div></div>' +
          '<div class="stat"><div class="k">오가는 시간</div><div class="v">' + msStr(net) + '</div></div>' +
          '<div class="stat"><div class="k">서버 안 (그중 데이터베이스)</div><div class="v">' + msStr(srv) + ' <small>' + msStr(dbm) + '</small></div></div></div>' +
          (warm.length < rows.length ? '<p class="tiny muted" style="margin:6px 2px 0">평균은 \'첫 구동\'을 뺀 값이에요. 첫 구동은 한동안 요청이 없어서 서버가 새로 켜지느라 더 걸린 거예요.</p>' : '') +
          '<div class="table-wrap" style="margin-top:10px"><table class="tbl">' + SPEED_HEAD + '<tbody>' + rows.map(function (x, i) { return speedRow(x, i); }).join('') + '</tbody></table></div>' +
          '<p class="tiny muted" style="margin:8px 2px 0">이 요청은 화면 데이터를 거의 안 읽어요. 실제 화면은 \'최근 요청 보기\'에서 확인하세요.</p>';
      } catch (e) { out.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
      b.disabled = false;
    };
    $('#sp-log', box).onclick = function () {
      // 같은 화면에서 잇달아 나간 요청끼리 묶어요 (화면이 바뀌거나 1.5초 넘게 쉬면 새 묶음)
      var groups = [], g = null;
      (NC.reqLog || []).filter(function (x) { return x.action !== 'system.ping'; }).forEach(function (x) {
        var start = x.at - x.total;
        if (!g || g.page !== x.page || start - g.end > 1500) { g = { page: x.page, start: start, end: x.at, list: [] }; groups.push(g); }
        g.list.push(x); g.end = Math.max(g.end, x.at);
      });
      if (!groups.length) { out.innerHTML = '<div class="empty">아직 기록이 없어요. 다른 화면을 몇 개 열어본 뒤 다시 눌러 주세요.</div>'; return; }
      out.innerHTML = '<p class="small muted" style="margin:0 2px 8px">이 기기에서 이번에 사이트를 연 뒤 보낸 요청이에요 (최근 100개, 새로고침하면 지워져요). 화면 하나를 열 때 요청이 몇 번 나갔고 모두 합쳐 얼마나 걸렸는지 묶어서 보여줘요.</p>' +
        groups.slice(-20).reverse().map(function (g) {
          var d = new Date(g.start), hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
          return '<div style="margin-bottom:12px"><div class="small" style="margin:0 2px 4px"><b>' + esc(g.page) + '</b> <span class="muted">· ' + hm + ' · 요청 ' + g.list.length + '번 · 모두 ' + msStr(g.end - g.start) + '</span></div>' +
            '<div class="table-wrap"><table class="tbl">' + SPEED_HEAD + '<tbody>' + g.list.map(function (x) { return speedRow(x); }).join('') + '</tbody></table></div></div>';
        }).join('');
    };
  }

  // ============================================================
  // 시스템 설정
  // ============================================================
  P['admin/system'] = async function (el, q, alive) {
    var d = await NC.api('settings.get');
    if (!alive()) return;
    var S = d.settings, C = d.can, R = S.rewards, BF = {};
    d.basicFields.forEach(function (f) { BF[f.key] = f; });
    var rk = [['attend', '생존신고'], ['study', '공부인증 인정'], ['studyVague', '공부인증 애매함'], ['problem', '문제만들기'], ['mentoring', '멘토/멘티 활동'], ['hourPer', '공부시간 1시간당'], ['hourCap', '공부시간 최대 인정 시간'], ['daily', '데일리 퀘스트'], ['weekly', '위클리 퀘스트']];
    var bk = ['attend', 'study', 'problem', 'mentoring', 'daily'];
    var html = '<div class="stack">';
    if (C.usage) html += '<div class="card" id="sy-usage"><div class="card-head"><h2>사용량</h2><button class="btn sm ghost right" id="sy-errs">오류 기록</button></div><div class="loading"><div class="spinner"></div></div></div>';
    if (C.usage) html += '<div class="card" id="sy-speed"></div>';
    if (C.season) html += '<div class="card"><div class="card-head"><h2>시즌</h2><span class="small muted">버전 ' + esc(d.version) + (NC.demo ? ' · 체험판' : '') + '</span></div><div class="form-grid">' +
      '<label class="field"><span>시즌 번호</span><input class="input" value="' + d.season + '" disabled></label>' +
      '<label class="field"><span>시즌 이름 (비우면 \'시즌 ' + d.season + '\')</span><input class="input" id="se-n" value="' + esc(d.seasonName) + '"></label>' +
      '<label class="field"><span>시즌 시작일</span><input class="input" type="date" id="se-s" value="' + esc(d.seasonStart) + '"></label>' +
      '<label class="field"><span>하루가 바뀌는 시각 (0~6시)</span><select class="input" id="se-h">' + opts([0, 1, 2, 3, 4, 5, 6].map(function (h) { return [h, h === 0 ? '0시 (자정)' : '새벽 ' + h + '시']; }), S.dayStartHour) + '</select></label></div>' +
      '<p class="tiny muted">하루가 바뀌는 시각을 4시로 정하면 새벽 4시 전까지는 전날로 쳐요 (생존신고 · 미니게임 기회 · 오늘의 미션 모두). 시즌 시작일은 정산 대기 주 계산에 써요.</p><button class="btn" id="se-save">시즌 정보 저장</button></div>';
    html += '<div class="card"><div class="card-head"><h2>기본</h2></div><div class="form-grid">' +
      '<label class="field"><span>그룹 이름</span><input class="input" id="sy-name" value="' + esc(S.groupName) + '"></label>' +
      '<label class="field"><span>다음 날 체크 마감 시각 (시)</span><input class="input" type="number" id="sy-dl" value="' + S.deadlineHour + '"></label>' +
      '<label class="field"><span>퇴출 기준 경고 수</span><input class="input" type="number" id="sy-ex" value="' + S.expelAt + '"></label>' +
      '<label class="field"><span>본인 데이오프 신청 (주당)</span><input class="input" type="number" id="sy-do" value="' + S.dayoffPerWeek + '"></label>' +
      '<label class="field"><span>미리 정할 수 있는 기간 (주)</span><input class="input" type="number" id="sy-wa" value="' + S.weeksAhead + '"></label>' +
      '<label class="field"><span>오늘 마감 알림 시작 (시)</span><input class="input" type="number" id="sy-be" value="' + S.banner.evening + '"></label>' +
      '<label class="field"><span>어제 마감 알림 시작 (시)</span><input class="input" type="number" id="sy-bm" value="' + S.banner.morning + '"></label>' +
      '<label class="field"><span>저장 공간 예산 (MB)</span><input class="input" type="number" id="sy-bd" value="' + S.budget.dbMB + '"></label>' +
      '<label class="field"><span>하루 요청 예산 (회)</span><input class="input" type="number" id="sy-br" value="' + S.budget.requests + '"></label></div></div>' +
      '<div class="card"><div class="card-head"><h2>미션별 파이</h2></div><div class="form-grid">' + rk.map(function (x) { return '<label class="field"><span>' + x[1] + '</span><input class="input" type="number" data-rw="' + x[0] + '" value="' + R[x[0]] + '"></label>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-head"><h2>주간 보너스 표</h2><span class="small muted">수행 일수별 파이 (빈칸 = 없음)</span></div><div class="table-wrap"><table class="tbl"><thead><tr><th>항목</th>' +
      [7, 6, 5, 4, 3, 2, 1].map(function (n) { return '<th class="num">' + n + '일</th>'; }).join('') + '</tr></thead><tbody>' +
      bk.map(function (k) { return '<tr><td class="nowrap">' + esc(NC.MISSION_NAMES[k]) + '</td>' + [7, 6, 5, 4, 3, 2, 1].map(function (n) { return '<td><input class="input sm" type="number" style="width:76px" data-bn="' + k + '|' + n + '" value="' + ((S.bonus[k] || {})[n] || '') + '"></td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><div class="field" style="margin-top:12px"><span>공부랭킹 보너스 (1등부터 차례로, 쉼표로 구분 · 개수를 늘리면 더 많은 등수에 보너스)</span><input class="input" id="sy-rb" value="' + esc(S.rankBonus.join(', ')) + '"></div></div>' +
      '<button class="btn primary lg" id="sy-save" style="align-self:flex-start">기본 수치 저장</button>';
    if (C.missions) {
      var ms = d.settings.missions.list.concat([d.settings.missions.byKey.weekly]);
      html += '<div class="card"><div class="card-head"><h2>미션 설정</h2></div><div class="table-wrap"><table class="tbl"><thead><tr><th>미션</th><th>이름</th><th class="num">순서</th><th class="center">켜기</th><th class="center">' + esc(NC.TAG_NAMES.mentee) + ' 필수</th><th>본인 체크 마감</th></tr></thead><tbody>' +
        ms.map(function (m) {
          var wk = m.key === 'weekly';
          return '<tr data-ms="' + m.key + '"><td class="small muted nowrap">' + esc(d.missionDefaults[m.key]) + '</td><td><input class="input sm" data-f="name" value="' + esc(m.name) + '" style="min-width:120px"></td>' +
            (wk ? '<td colspan="4" class="small muted">이름만 바꿀 수 있어요 · 마감: 다음 주 월요일 마감 시각</td>' :
              '<td><input class="input sm" type="number" data-f="order" value="' + m.order + '" style="width:64px"></td><td class="center"><input type="checkbox" data-f="on"' + (m.on ? ' checked' : '') + '></td>' +
              '<td class="center"><input type="checkbox" data-f="required"' + (m.required ? ' checked' : '') + '></td><td><select class="input sm" data-f="deadline" style="width:auto">' + opts([['today', '당일 하루 끝'], ['next', '다음 날 마감 시각']], m.deadline) + '</select></td>') + '</tr>';
        }).join('') + '</tbody></table></div><p class="tiny muted">끈 미션은 멤버 화면과 판정 표에서 사라지고, 지난 기록은 그대로 남아요. 필수를 바꾸면 경고 후보 기준도 바뀌어요.</p><button class="btn" id="ms-save">미션 설정 저장</button></div>';
    }
    if (C.texts) {
      var T = S.texts, tf = d.textFields;
      html += '<div class="card"><div class="card-head"><h2>화면 문구 · 태그 · 메뉴</h2></div><div class="form-grid">' +
        tf.filter(function (f) { return !/^(color|menu)\./.test(f.key); }).map(function (f) { return '<label class="field"' + (/Notice|Tagline/.test(f.key) ? ' style="grid-column:1/-1"' : '') + '><span>' + esc(f.label) + '</span>' + (f.key === 'homeNotice' ? '<textarea class="input" data-tx="' + f.key + '" rows="2">' + esc(T[f.key]) + '</textarea>' : '<input class="input" data-tx="' + f.key + '" value="' + esc(T[f.key]) + '" placeholder="' + esc(f.dflt) + '">') + '</label>'; }).join('') + '</div>' +
        '<div class="row wrap" style="margin-top:12px">' + tf.filter(function (f) { return /^color\./.test(f.key); }).map(function (f) { return '<label class="check"><input type="color" data-tx="' + f.key + '" value="' + esc(T[f.key] || f.dflt) + '"><span class="badge ' + f.key.slice(6) + '">' + esc(NC.TAG_NAMES[f.key.slice(6)]) + '</span></label>'; }).join('') + '<button class="btn sm ghost" id="tx-color-reset">색 처음으로</button></div>' +
        '<div class="row wrap" style="margin-top:12px">' + tf.filter(function (f) { return /^menu\./.test(f.key); }).map(function (f) { return '<label class="check"><input type="checkbox" data-tx="' + f.key + '"' + (/^(o|y|1|true)$/i.test(String(T[f.key])) || T[f.key] === 'O' ? ' checked' : '') + '>' + esc(f.label) + '</label>'; }).join('') + '</div>' +
        '<button class="btn" id="tx-save" style="margin-top:12px">문구 · 태그 · 메뉴 저장</button></div>';
    }
    if (C.access) {
      var groups = {};
      d.access.forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });
      var rankOpts = [0, 1, 2, 3, 4].map(function (r) { return [r, d.rankWords[r]]; });
      html += '<div class="card"><div class="card-head"><h2>기능별로 쓸 수 있는 사람</h2></div><p class="small muted" style="margin-top:-4px">각 기능을 누가 쓸 수 있는지 정해요. 자물쇠(🔒)가 붙은 기능은 항상 개발자만 써요. 바꾸면 메뉴도 함께 보였다 숨었다 해요.</p>' +
        Object.keys(groups).map(function (g) {
          return '<div class="acc-group"><div class="small" style="font-weight:700;margin:10px 0 4px">' + esc(g) + '</div>' + groups[g].map(function (a) {
            return '<div class="acc-row"><span class="grow small">' + esc(a.desc) + (a.locked ? ' 🔒' : '') + (a.rank !== a.dflt ? ' <span class="badge soft">바꿈</span>' : '') + '</span><select class="input sm" data-acc="' + a.key + '"' + (a.locked ? ' disabled' : '') + ' style="width:auto">' + opts(rankOpts, a.rank) + '</select></div>';
          }).join('') + '</div>';
        }).join('') + '<div class="row" style="margin-top:12px"><button class="btn" id="acc-save">저장</button><button class="btn ghost" id="acc-reset">처음 값으로</button></div></div>';
    }
    if (C.maintenance) html += '<div class="card"><div class="card-head"><h2>점검 중 모드</h2>' + (d.maintenance ? '<span class="badge req">켜짐</span>' : '<span class="badge soft">꺼짐</span>') + '</div>' +
      '<p class="small" style="margin-top:0">켜면 개발자를 뺀 모든 멤버가 사이트에 들어올 수 없고, 아래 안내 문구가 보여요. 데이터를 크게 고칠 때 써요.</p>' +
      '<label class="field"><span>안내 문구</span><input class="input" id="mt-msg" value="' + esc(d.maintenance || '지금 점검 중이에요. 잠시 후 다시 들어와 주세요.') + '"></label>' +
      '<div class="row" style="margin-top:10px">' + (d.maintenance ? '<button class="btn primary" id="mt-off">점검 끝내기</button><button class="btn" id="mt-on">문구만 바꾸기</button>' : '<button class="btn danger" id="mt-on">점검 중 모드 켜기</button>') + '</div></div>';
    if (C.reset) html += '<div class="card" style="border-color:color-mix(in srgb, var(--danger) 45%, var(--line))"><div class="card-head"><h2>전체 초기화 · 새 시즌 시작</h2></div>' +
      '<p class="small" style="margin-top:0">새 시즌을 처음부터 시작해요. 파이, 미션 기록, 경고, 데이오프, 구매, 게시글이 모두 0에서 시작합니다. 지금 시즌 기록은 지워지지 않고 데이터 도구에서 계속 볼 수 있어요.</p>' +
      '<div class="row wrap" style="margin-bottom:10px"><label class="check"><input type="checkbox" id="rs-m" checked>멤버 명단 이어가기</label><label class="check"><input type="checkbox" id="rs-s" checked>설정 이어가기</label><label class="check"><input type="checkbox" id="rs-p" checked>상품 목록 이어가기</label></div>' +
      '<label class="field" style="max-width:360px"><span>확인: 원주율 소수점 아래 101번째부터 110번째 자리 (10자리)</span><input class="input" id="rs-d" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="숫자 10자리"></label>' +
      '<button class="btn danger fill" id="rs-go" style="margin-top:10px;align-self:flex-start">전체 초기화</button></div>';
    if (NC.demo) html += '<div class="card"><div class="card-head"><h2>체험판 데이터</h2></div><p class="small muted">이 브라우저에 저장된 예시 데이터를 처음 상태로 되돌려요.</p><button class="btn danger" id="sy-reset">체험판 처음으로</button></div>';
    el.innerHTML = html + '</div>';

    async function after(msg) { NC.toast(msg || '저장했어요.', 'ok'); await NC.refreshMe(); }
    if (C.usage) loadUsage();
    async function loadUsage() {
      var box = $('#sy-usage');
      try {
        var u = await NC.api('system.usage');
        box.innerHTML = '<div class="card-head"><h2>사용량</h2><button class="btn sm ghost right" id="sy-errs">오류 기록</button></div><div class="grid2">' +
          meter('저장 공간', u.db.pct, mb(u.db.bytes) + ' / ' + u.db.budgetMB + 'MB') + meter('오늘 요청', u.today.pct, U.num(u.today.requests) + ' / ' + U.num(u.today.budget) + '회') + '</div>' +
          '<div class="tiny muted" style="margin-top:6px">오늘 평균 응답 ' + u.today.avgMs + 'ms · 오류 ' + u.today.errors + '건 · 데이터베이스 전체 ' + mb(u.db.totalBytes) + ' (Supabase 무료 한도 500MB 기준)</div>' +
          '<div class="spark">' + u.days.slice(-14).map(function (x) { var p = x.requests / u.today.budget * 100, lv = usageLevel(p); return '<div class="sb lv-' + lv[0] + '" title="' + x.day + ' · ' + x.requests + '회"><i style="height:' + Math.max(3, Math.min(100, p)) + '%"></i><span>' + (+x.day.slice(8)) + '</span></div>'; }).join('') + '</div>' +
          '<details style="margin-top:8px"><summary class="small">표별 크기</summary><div class="list">' + u.tables.slice(0, 12).map(function (t) { return '<div class="li small"><span class="grow">' + esc(t.title) + '</span><span class="muted">' + U.num(t.rows) + '줄</span><b>' + mb(t.bytes) + '</b></div>'; }).join('') + '</div></details>';
        $('#sy-errs').onclick = showErrors;
      } catch (e) { box.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    }
    if (C.usage) speedCheck($('#sy-speed'));
    async function showErrors() {
      try {
        var r = await NC.api('system.errors');
        NC.modal({ title: '오류 기록 (최근 200건)', wide: true, body: r.list.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>일시</th><th>기능</th><th>사용자</th><th>내용</th></tr></thead><tbody>' + r.list.map(function (x) { return '<tr><td class="small">' + U.fmtDT(x.at) + '</td><td class="small">' + esc(x.action) + '</td><td class="small">' + esc(x.actor) + '</td><td class="small" style="white-space:normal">' + esc(x.message) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">오류가 없어요 👍</div>' });
      } catch (e) { NC.err(e); }
    }
    if ($('#sy-errs')) $('#sy-errs').onclick = showErrors;
    if ($('#se-save')) $('#se-save').onclick = async function () {
      try { await NC.api('season.edit', { name: $('#se-n').value, start: $('#se-s').value, dayStartHour: +$('#se-h').value }); after(); } catch (e) { NC.err(e); }
    };
    $('#sy-save').onclick = async function () {
      var rw = {}, bn = {};
      $$('[data-rw]').forEach(function (i) { rw[i.getAttribute('data-rw')] = i.value; });
      bk.forEach(function (k) { bn[k] = {}; });
      $$('[data-bn]').forEach(function (i) { var p = i.getAttribute('data-bn').split('|'); if (i.value !== '' && +i.value > 0) bn[p[0]][p[1]] = +i.value; });
      var rb = $('#sy-rb').value.split(/[,\s]+/).filter(Boolean).map(Number).filter(function (n) { return isFinite(n); });
      try {
        await NC.api('settings.save', { settings: { groupName: $('#sy-name').value, deadlineHour: +$('#sy-dl').value, expelAt: +$('#sy-ex').value, dayoffPerWeek: +$('#sy-do').value, weeksAhead: +$('#sy-wa').value,
          banner: { evening: +$('#sy-be').value, morning: +$('#sy-bm').value }, budget: { dbMB: +$('#sy-bd').value, requests: +$('#sy-br').value }, rewards: rw, bonus: bn, rankBonus: rb } });
        after();
      } catch (e) { NC.err(e); }
    };
    if ($('#ms-save')) $('#ms-save').onclick = async function () {
      var list = $$('[data-ms]').map(function (tr) {
        var o = { key: tr.getAttribute('data-ms') };
        $$('[data-f]', tr).forEach(function (i) { var f = i.getAttribute('data-f'); o[f] = i.type === 'checkbox' ? i.checked : i.value; });
        return o;
      });
      try { await NC.api('missions.save', { missions: list }); after(); NC.route(); } catch (e) { NC.err(e); }
    };
    if ($('#tx-save')) {
      $('#tx-color-reset').onclick = function () { d.textFields.forEach(function (f) { if (/^color\./.test(f.key)) $('[data-tx="' + f.key + '"]').value = f.dflt; }); };
      $('#tx-save').onclick = async function () {
        var t = {};
        $$('[data-tx]').forEach(function (i) { t[i.getAttribute('data-tx')] = i.type === 'checkbox' ? (i.checked ? 'O' : 'X') : i.value; });
        try { await NC.api('texts.save', { texts: t }); await after(); NC.me = null; NC.render(); } catch (e) { NC.err(e); }
      };
    }
    if ($('#acc-save')) {
      $('#acc-save').onclick = async function () {
        var a = {};
        $$('[data-acc]').forEach(function (s) { if (!s.disabled) a[s.getAttribute('data-acc')] = +s.value; });
        try { await NC.api('access.save', { access: a }); await after(); NC.route(); } catch (e) { NC.err(e); }
      };
      $('#acc-reset').onclick = function () { d.access.forEach(function (a) { var s = $('[data-acc="' + a.key + '"]'); if (s && !s.disabled) s.value = a.dflt; }); NC.toast('처음 값으로 바꿨어요. 저장을 눌러야 반영돼요.'); };
    }
    if ($('#mt-on')) $('#mt-on').onclick = async function () {
      if (!d.maintenance && !(await NC.confirm('점검 중 모드를 켤까요? 개발자를 뺀 모든 멤버가 바로 사이트를 쓸 수 없게 돼요.', { danger: true, ok: '켜기' }))) return;
      try { await NC.api('system.maintenance', { on: true, message: $('#mt-msg').value }); after('점검 중 모드를 켰어요.'); NC.route(); } catch (e) { NC.err(e); }
    };
    if ($('#mt-off')) $('#mt-off').onclick = async function () { try { await NC.api('system.maintenance', { on: false }); after('점검을 끝냈어요.'); NC.route(); } catch (e) { NC.err(e); } };
    if ($('#rs-go')) $('#rs-go').onclick = async function () {
      var digits = $('#rs-d').value.replace(/\s/g, '');
      if (digits.length !== 10) return NC.toast('숫자 10자리를 입력하세요.', 'err');
      if (!(await NC.confirm('정말 전체 초기화할까요? 새 시즌이 시작되고, 지금까지의 파이와 기록은 사이트에서 보이지 않게 돼요. (데이터 도구에서는 볼 수 있어요)', { danger: true, ok: '새 시즌 시작' }))) return;
      try {
        var r = await NC.api('season.reset', { digits: digits, keep: { members: $('#rs-m').checked, settings: $('#rs-s').checked, products: $('#rs-p').checked } });
        NC.toast(r.season + '을(를) 시작했어요.', 'ok');
        await NC.refreshMe(); NC.updateShellMe(); NC.route();
      } catch (e) { NC.err(e); }
    };
    if ($('#sy-reset')) $('#sy-reset').onclick = async function () {
      if (!(await NC.confirm('체험판 데이터를 처음 상태로 되돌릴까요?', { danger: true, ok: '처음으로' }))) return;
      await NC.resetDemo(); NC.toast('처음 상태로 되돌렸어요.', 'ok'); NC.logout();
    };
  };

  // ============================================================
  // 데이터 도구 (개발자)
  // ============================================================
  var TOOL_TABS = [['editor', '데이터 편집기'], ['history', '되돌리기'], ['backup', '백업 · 엑셀'], ['check', '데이터 점검']];
  P['admin/data'] = async function (el, q, alive) {
    var tab = q.tab || 'editor';
    el.innerHTML = '<div class="stack"><div class="seg" id="dt-tab">' + TOOL_TABS.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div><div id="dt-body"></div></div>';
    $$('#dt-tab button').forEach(function (b) { b.onclick = function () { NC.go('admin/data?tab=' + b.getAttribute('data-t')); }; });
    var body = $('#dt-body');
    var meta = await NC.api('data.tables');
    if (!alive()) return;
    if (tab === 'editor') return editor(body, meta, q, alive);
    if (tab === 'history') return history(body, meta, alive);
    if (tab === 'backup') return backup(body, meta, alive);
    if (tab === 'check') return check(body, alive);
  };
  function tableOpts(meta, cur) {
    return meta.tables.map(function (t) { return '<option value="' + t.table + '"' + (t.table === cur ? ' selected' : '') + '>' + esc(t.title) + ' (' + U.num(t.count) + '줄)</option>'; }).join('');
  }
  function colsOf(t) {
    var cols = [['_id', '줄 번호', true]];
    if (t.scope) cols.push([t.scope, t.scopeLabel]);
    t.cols.forEach(function (c) { cols.push([c[0], c[1]]); });
    cols.push(['_season', '시즌']);
    return cols;
  }

  // ---------- 편집기 ----------
  async function editor(body, meta, q, alive) {
    var tname = q.table || 'members', T = meta.tables.filter(function (x) { return x.table === tname; })[0] || meta.tables[0];
    var st = { season: meta.season, search: '', filters: {}, sort: '', desc: false, offset: 0, limit: 100 }, rows = [], total = 0, edits = {}, adds = [], sel = {};
    body.innerHTML = '<div class="card"><p class="small muted" style="margin-top:0">모든 표를 직접 보고 고칠 수 있어요. 칸을 누르면 고칠 수 있고, <b>저장</b>을 눌러야 반영돼요. 저장한 내용은 <b>되돌리기</b> 탭에서 되돌릴 수 있어요. ' +
      '미션 표의 상태를 고치면 그 날짜를 다음에 볼 때 파이 차액이 자동으로 지급·회수돼요.</p>' +
      '<div class="row wrap"><select class="input sm" id="de-t" style="max-width:280px">' + tableOpts(meta, T.table) + '</select>' +
      '<select class="input sm" id="de-s" style="width:auto">' + meta.seasons.map(function (s) { return '<option value="' + s + '"' + (s === meta.season ? ' selected' : '') + '>시즌 ' + s + (s === meta.season ? ' (지금)' : '') + '</option>'; }).join('') + '<option value="all">모든 시즌</option></select>' +
      '<input class="input sm" id="de-q" placeholder="모든 칸에서 찾기" style="max-width:200px"><span class="right row wrap" style="gap:6px"><button class="btn sm" id="de-add">+ 줄 추가</button><button class="btn sm primary" id="de-save" disabled>저장</button></span></div></div>' +
      '<div id="de-grid"></div>';
    $('#de-t').onchange = function () { NC.go('admin/data?tab=editor&table=' + this.value); };
    $('#de-s').onchange = function () { st.season = this.value === 'all' ? 'all' : +this.value; st.offset = 0; load(); };
    var qt = null;
    $('#de-q').oninput = function () { var v = this.value; clearTimeout(qt); qt = setTimeout(function () { st.search = v; st.offset = 0; load(); }, 350); };
    var cols = colsOf(T);
    async function load() {
      if (dirty() && !(await NC.confirm('저장하지 않은 고침이 있어요. 버리고 다시 불러올까요?', { danger: true, ok: '버리기' }))) return;
      edits = {}; adds = []; sel = {};
      $('#de-grid').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      try {
        var r = await NC.api('data.rows', { table: T.table, season: st.season, search: st.search, filters: st.filters, sort: st.sort, desc: st.desc, offset: st.offset, limit: st.limit });
        if (!alive()) return;
        rows = r.rows; total = r.total; draw();
      } catch (e) { $('#de-grid').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    }
    function dirty() { return Object.keys(edits).length || adds.length; }
    function nEdits() { var n = 0; Object.keys(edits).forEach(function (id) { n += Object.keys(edits[id]).length; }); return n; }
    function draw() {
      var h = '<div class="table-wrap de-wrap"><table class="tbl de"><thead><tr><th class="ck"><input type="checkbox" id="de-all"></th>' + cols.map(function (c) {
        return '<th data-sort="' + c[0] + '" title="' + esc(c[0]) + '">' + esc(c[1]) + (st.sort === c[0] ? (st.desc ? ' ▼' : ' ▲') : '') + '</th>';
      }).join('') + '</tr><tr class="flt"><th></th>' + cols.map(function (c) { return '<th><input class="input sm" data-flt="' + c[0] + '" value="' + esc(st.filters[c[0]] || '') + '" placeholder="거르기"></th>'; }).join('') + '</tr></thead><tbody>';
      adds.forEach(function (a, i) {
        h += '<tr class="added"><td class="ck"><button class="btn ghost sm" data-unadd="' + i + '">✕</button></td>' + cols.map(function (c) {
          if (c[2]) return '<td class="muted small">새 줄</td>';
          return '<td><input class="input sm cell-in" data-add="' + i + '" data-col="' + c[0] + '" value="' + esc(a[c[0]] === undefined ? '' : a[c[0]]) + '"></td>';
        }).join('') + '</tr>';
      });
      rows.forEach(function (r) {
        var e = edits[r._id] || {};
        h += '<tr' + (sel[r._id] ? ' class="selrow"' : '') + '><td class="ck"><input type="checkbox" data-sel="' + esc(r._id) + '"' + (sel[r._id] ? ' checked' : '') + '></td>' + cols.map(function (c) {
          var v = c[0] in e ? e[c[0]] : r[c[0]];
          if (c[2]) return '<td class="muted small">' + esc(r._id) + '</td>';
          return '<td class="cell' + (c[0] in e ? ' changed' : '') + '" data-id="' + esc(r._id) + '" data-col="' + c[0] + '" title="' + esc(v) + '">' + esc(String(v === undefined ? '' : v).slice(0, 80)) + '</td>';
        }).join('') + '</tr>';
      });
      if (!rows.length && !adds.length) h += '<tr><td colspan="' + (cols.length + 1) + '"><div class="empty">줄이 없어요</div></td></tr>';
      h += '</tbody></table></div><div class="row wrap" style="margin-top:8px"><span class="small muted">' + U.num(total) + '줄 중 ' + (total ? (st.offset + 1) + '~' + Math.min(total, st.offset + rows.length) : 0) + '</span>' +
        '<button class="btn sm" id="de-prev"' + (st.offset ? '' : ' disabled') + '>◀</button><button class="btn sm" id="de-next"' + (st.offset + rows.length < total ? '' : ' disabled') + '>▶</button>' +
        '<span class="right row wrap" style="gap:6px"><span class="small" id="de-selinfo"></span><button class="btn sm" id="de-bulk" disabled>선택한 줄 한꺼번에 바꾸기</button><button class="btn sm danger" id="de-del" disabled>선택한 줄 지우기</button></span></div>';
      $('#de-grid').innerHTML = h;
      bind();
      status();
    }
    function status() {
      var n = nEdits() + adds.length, s = Object.keys(sel).length;
      $('#de-save').disabled = !n; $('#de-save').textContent = n ? '저장 (' + n + ')' : '저장';
      $('#de-selinfo').textContent = s ? s + '줄 선택' : '';
      $('#de-bulk').disabled = !s; $('#de-del').disabled = !s;
    }
    function bind() {
      $$('[data-sort]').forEach(function (th) { th.onclick = function () { var c = th.getAttribute('data-sort'); if (st.sort === c) st.desc = !st.desc; else { st.sort = c; st.desc = false; } st.offset = 0; load(); }; });
      $$('[data-flt]').forEach(function (i) { i.onkeydown = function (e) { if (e.key === 'Enter') { var c = i.getAttribute('data-flt'); if (i.value) st.filters[c] = i.value; else delete st.filters[c]; st.offset = 0; load(); } }; });
      $('#de-all').onchange = function () { var on = this.checked; rows.forEach(function (r) { if (on) sel[r._id] = true; else delete sel[r._id]; }); draw(); };
      $$('[data-sel]').forEach(function (c) { c.onchange = function () { var id = c.getAttribute('data-sel'); if (c.checked) sel[id] = true; else delete sel[id]; c.closest('tr').classList.toggle('selrow', c.checked); status(); }; });
      $$('td.cell').forEach(function (td) {
        td.onclick = function () {
          if (td.querySelector('input,textarea')) return;
          var id = td.getAttribute('data-id'), c = td.getAttribute('data-col'), r = rows.filter(function (x) { return x._id === id; })[0];
          var cur = edits[id] && c in edits[id] ? edits[id][c] : r[c];
          var long = String(cur).length > 40 || /body|desc|memo|text|before|after|message/.test(c);
          td.innerHTML = long ? '<textarea class="input sm cell-in" rows="3">' + esc(cur) + '</textarea>' : '<input class="input sm cell-in" value="' + esc(cur) + '">';
          var inp = td.firstChild; inp.focus(); if (inp.select) inp.select();
          function done(save) {
            if (save) {
              var v = inp.value;
              if (String(v) === String(r[c])) { if (edits[id]) { delete edits[id][c]; if (!Object.keys(edits[id]).length) delete edits[id]; } }
              else { edits[id] = edits[id] || {}; edits[id][c] = v; }
            }
            var nv = edits[id] && c in edits[id] ? edits[id][c] : r[c];
            td.classList.toggle('changed', !!(edits[id] && c in edits[id]));
            td.textContent = String(nv).slice(0, 80); td.title = nv;
            status();
          }
          inp.onblur = function () { done(true); };
          inp.onkeydown = function (e) { if (e.key === 'Escape') { inp.onblur = null; done(false); } if (e.key === 'Enter' && (inp.tagName === 'INPUT' || e.ctrlKey || e.metaKey)) { e.preventDefault(); inp.blur(); } };
        };
      });
      $$('[data-add]').forEach(function (i) { i.oninput = function () { adds[+i.getAttribute('data-add')][i.getAttribute('data-col')] = i.value; status(); }; });
      $$('[data-unadd]').forEach(function (b) { b.onclick = function () { adds.splice(+b.getAttribute('data-unadd'), 1); draw(); }; });
      $('#de-prev').onclick = function () { st.offset = Math.max(0, st.offset - st.limit); load(); };
      $('#de-next').onclick = function () { st.offset += st.limit; load(); };
      $('#de-bulk').onclick = function () {
        var ids = Object.keys(sel);
        NC.modal({ title: ids.length + '줄 한꺼번에 바꾸기', body: '<div class="stack"><label class="field"><span>칸</span><select class="input" id="bk-c">' + opts(cols.filter(function (c) { return !c[2]; }).map(function (c) { return [c[0], c[1]]; }), '') + '</select></label><label class="field"><span>새 값</span><input class="input" id="bk-v"></label><p class="tiny muted" style="margin:0">바로 저장되지 않아요. 표에서 확인한 뒤 저장을 누르세요.</p></div>',
          actions: [{ label: '취소' }, { label: '적용', cls: 'primary', onClick: function (c, w) { var col = $('#bk-c', w).value, v = $('#bk-v', w).value; ids.forEach(function (id) { var r = rows.filter(function (x) { return x._id === id; })[0]; if (!r) return; if (String(r[col]) === v) return; edits[id] = edits[id] || {}; edits[id][col] = v; }); draw(); } }] });
      };
      $('#de-del').onclick = async function () {
        var ids = Object.keys(sel);
        if (!(await NC.confirm('선택한 ' + ids.length + '줄을 지울까요? (되돌리기 탭에서 되돌릴 수 있어요)', { danger: true, ok: '지우기' }))) return;
        try { var r = await NC.api('data.save', { table: T.table, removes: ids }); NC.toast(r.count + '줄을 지웠어요.', 'ok'); edits = {}; adds = []; sel = {}; load(); } catch (e) { NC.err(e); }
      };
    }
    $('#de-add').onclick = function () { var a = {}; if (st.season !== 'all') a._season = st.season; adds.unshift(a); draw(); };
    $('#de-save').onclick = async function () {
      var e2 = Object.keys(edits).map(function (id) { return { id: id, set: edits[id] }; });
      if (!e2.length && !adds.length) return;
      try {
        var r = await NC.api('data.save', { table: T.table, edits: e2, adds: adds });
        NC.toast(r.count + '줄을 저장했어요.', 'ok');
        edits = {}; adds = []; load();
      } catch (e) { NC.err(e); }
    };
    window.onbeforeunload = function () { return dirty() ? '저장하지 않은 고침이 있어요.' : undefined; };
    NC.cleanup = function () { window.onbeforeunload = null; };
    await load();
  }

  // ---------- 되돌리기 ----------
  async function history(body, meta, alive) {
    body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    var r = await NC.api('data.history', {});
    if (!alive()) return;
    body.innerHTML = '<div class="card"><p class="small muted" style="margin-top:0">데이터 편집기 · 엑셀 올리기로 고친 내용이 묶음별로 남아요. 되돌리면 그 묶음에서 고친 칸이 고치기 전 값으로 돌아가요. (그 뒤에 다시 바뀐 칸도 고치기 전 값으로 돌아가요)</p>' +
      (r.batches.length ? '<div class="list">' + r.batches.map(function (b) {
        return '<div class="li wrap"' + (b.undone ? ' style="opacity:.55"' : '') + '><div class="grow" style="min-width:220px"><b>' + esc(b.title) + '</b> <span class="small muted">' + [b.edits ? '고침 ' + b.edits : '', b.adds ? '추가 ' + b.adds : '', b.removes ? '지움 ' + b.removes : ''].filter(Boolean).join(' · ') + '</span>' +
          '<div class="tiny muted">' + U.fmtDT(b.at) + ' · ' + esc(b.actor) + ' · 번호 ' + esc(b.batch) + '</div>' +
          '<div class="tiny" style="white-space:normal">' + b.samples.map(function (s) { return esc(s.op + ' #' + s.rowId + ' ' + (s.before ? s.before.slice(0, 60) : '') + (s.after ? ' → ' + s.after.slice(0, 60) : '')); }).join('<br>') + '</div></div>' +
          (b.undone ? '<span class="pill">되돌림</span>' : '<button class="btn sm" data-undo="' + esc(b.batch) + '">되돌리기</button>') + '</div>';
      }).join('') + '</div>' : '<div class="empty">아직 직접 고친 기록이 없어요</div>') + '</div>';
    $$('[data-undo]', body).forEach(function (b) {
      b.onclick = async function () {
        if (!(await NC.confirm('이 묶음을 되돌릴까요?', { ok: '되돌리기' }))) return;
        try { var x = await NC.api('data.undo', { batch: b.getAttribute('data-undo') }); NC.toast(x.count + '줄을 되돌렸어요.', 'ok'); NC.route(); } catch (e) { NC.err(e); }
      };
    });
  }

  // ---------- 백업 · 엑셀 ----------
  function csvCell(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x !== ''; }); });
  }
  async function backup(body, meta, alive) {
    body.innerHTML = '<div class="grid2"><div class="card"><div class="card-head"><h2>전체 백업</h2></div><p class="small muted" style="margin-top:0">모든 표를 파일 하나(.json)로 내려받아요. 크게 고치기 전이나 일주일에 한 번쯤 받아 두면 안전해요.</p>' +
      '<div class="row wrap"><button class="btn primary" id="bk-cur">이번 시즌 내려받기</button><button class="btn" id="bk-all">모든 시즌 내려받기</button></div></div>' +
      '<div class="card"><div class="card-head"><h2>백업으로 되돌리기</h2></div><p class="small muted" style="margin-top:0">백업 파일의 내용으로 바꿔요. 지금 데이터는 지워지니, 먼저 지금 상태를 백업해 두세요.</p>' +
      '<input type="file" accept=".json,application/json" id="rs-f" class="input"><div id="rs-info" class="small" style="margin-top:8px"></div></div></div>' +
      '<div class="grid2" style="margin-top:14px"><div class="card"><div class="card-head"><h2>엑셀(CSV) 내보내기</h2></div><div class="stack"><select class="input" id="cx-t">' + tableOpts(meta, 'members') + '</select>' +
      '<select class="input" id="cx-s">' + meta.seasons.map(function (s) { return '<option value="' + s + '">시즌 ' + s + '</option>'; }).join('') + '<option value="all">모든 시즌</option></select>' +
      '<label class="check"><input type="checkbox" id="cx-k" checked>첫 줄을 한글 칸 이름으로</label><button class="btn" id="cx-go" style="align-self:flex-start">내려받기</button></div></div>' +
      '<div class="card"><div class="card-head"><h2>엑셀(CSV) 올리기</h2></div><div class="stack"><p class="small muted" style="margin:0">첫 줄은 칸 이름(한글 또는 영문)이어야 해요. \'줄 번호\'가 있는 줄은 그 줄을 고치고, 없는 줄은 새로 추가해요.</p><select class="input" id="ci-t">' + tableOpts(meta, 'members') + '</select>' +
      '<input type="file" accept=".csv,text/csv" id="ci-f" class="input"><label class="check"><input type="checkbox" id="ci-app">줄 번호가 있어도 모두 새 줄로 추가</label><div id="ci-info" class="small"></div></div></div></div>' +
      '<div class="card" style="margin-top:14px"><div class="card-head"><h2>오래된 기록 정리</h2></div><p class="small muted" style="margin-top:0">쌓이기만 하는 기록을 지워서 저장 공간을 줄여요. 지우기 전에 위에서 엑셀(CSV)로 내려받아 두세요. 모든 시즌에서 지워져요.</p>' +
      '<div class="row wrap"><select class="input sm" id="pr-t" style="width:auto">' + opts([['logs', '활동 기록'], ['game_plays', '미니게임 기록'], ['error_log', '오류 기록'], ['edit_history', '직접 고친 기록 (되돌리기용)']], 'logs') + '</select>' +
      '<select class="input sm" id="pr-d" style="width:auto">' + opts([[30, '30일 지난 것'], [90, '90일 지난 것'], [180, '180일 지난 것'], [365, '1년 지난 것']], 90) + '</select><button class="btn sm" id="pr-go">몇 줄인지 보기</button><span id="pr-info" class="small"></span></div></div>';
    $('#pr-go').onclick = async function () {
      var t = $('#pr-t').value, days = +$('#pr-d').value, info = $('#pr-info');
      try {
        var r = await NC.api('data.prune', { table: t, days: days });
        if (!r.count) { info.textContent = '지울 줄이 없어요.'; return; }
        info.innerHTML = r.before + ' 이전 ' + esc(r.title) + ' ' + U.num(r.count) + '줄 <button class="btn sm danger" id="pr-del">지우기</button>';
        $('#pr-del').onclick = async function () {
          if (!(await NC.confirm(r.title + ' ' + r.count + '줄을 지울까요? 되돌릴 수 없어요.', { danger: true, ok: '지우기' }))) return;
          try { var x = await NC.api('data.prune', { table: t, days: days, apply: true }); NC.toast(x.count + '줄을 지웠어요.', 'ok'); info.textContent = ''; } catch (e) { NC.err(e); }
        };
      } catch (e) { NC.err(e); }
    };
    async function dumpDl(all) {
      try {
        var r = await NC.api('backup.export', { all: all });
        download('나침반_백업_' + (all ? '전체' : '시즌' + r.season) + '_' + stampName() + '.json', JSON.stringify(r), 'application/json');
        NC.toast('백업 파일을 내려받았어요.', 'ok');
      } catch (e) { NC.err(e); }
    }
    $('#bk-cur').onclick = function () { dumpDl(false); };
    $('#bk-all').onclick = function () { dumpDl(true); };
    $('#rs-f').onchange = async function () {
      var f = this.files[0]; if (!f) return;
      var info = $('#rs-info');
      try {
        var b = JSON.parse(await readFile(f));
        if (b.app !== 'nachimban-compass') throw new Error('나침반 백업 파일이 아니에요.');
        var n = 0; Object.keys(b.tables || {}).forEach(function (t) { n += b.tables[t].length; });
        info.innerHTML = '<b>' + esc(b.at) + '</b> 백업 · ' + (b.all ? '모든 시즌' : '시즌 ' + b.season) + ' · ' + U.num(n) + '줄<div class="row wrap" style="margin-top:8px"><input class="input sm" id="rs-p" placeholder="백업으로 되돌리기" style="max-width:200px"><button class="btn sm danger fill" id="rs-go">되돌리기</button></div><div class="tiny muted">확인 문구 \'백업으로 되돌리기\'를 입력하세요.</div>';
        $('#rs-go').onclick = async function () {
          if ($('#rs-p').value.trim() !== '백업으로 되돌리기') return NC.toast('확인 문구를 정확히 입력하세요.', 'err');
          try { await NC.api('backup.restore', { backup: b, phrase: '백업으로 되돌리기' }); NC.toast('백업으로 되돌렸어요. 다시 로그인해 주세요.', 'ok'); setTimeout(function () { NC.logout(); }, 1200); } catch (e) { NC.err(e); }
        };
      } catch (e) { info.innerHTML = '<span class="minus">' + esc(e.message) + '</span>'; }
    };
    $('#cx-go').onclick = async function () {
      var t = meta.tables.filter(function (x) { return x.table === $('#cx-t').value; })[0], cols = colsOf(t), kor = $('#cx-k').checked;
      try {
        var r = await NC.api('data.rows', { table: t.table, season: $('#cx-s').value === 'all' ? 'all' : +$('#cx-s').value, limit: 5000 });
        var all = r.rows, off = all.length;
        while (off < r.total) { var more = await NC.api('data.rows', { table: t.table, season: $('#cx-s').value === 'all' ? 'all' : +$('#cx-s').value, limit: 5000, offset: off }); all = all.concat(more.rows); off += more.rows.length; if (!more.rows.length) break; }
        var lines = [cols.map(function (c) { return csvCell(kor ? c[1] : c[0]); }).join(',')].concat(all.map(function (x) { return cols.map(function (c) { return csvCell(x[c[0]]); }).join(','); }));
        download('나침반_' + t.title + '_' + stampName() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
        NC.toast(all.length + '줄을 내려받았어요.', 'ok');
      } catch (e) { NC.err(e); }
    };
    $('#ci-f').onchange = async function () {
      var f = this.files[0]; if (!f) return;
      var t = meta.tables.filter(function (x) { return x.table === $('#ci-t').value; })[0], cols = colsOf(t), info = $('#ci-info');
      try {
        var rows = parseCsv(await readFile(f));
        if (rows.length < 2) throw new Error('내용이 없어요.');
        var head = rows[0].map(function (h) { h = h.trim(); var c = cols.filter(function (x) { return x[0] === h || x[1] === h; })[0]; return c ? c[0] : null; });
        if (!head.some(Boolean)) throw new Error('첫 줄에서 아는 칸 이름을 찾지 못했어요.');
        var data = rows.slice(1).map(function (r) { var o = {}; head.forEach(function (k, i) { if (k) o[k] = r[i] === undefined ? '' : r[i]; }); return o; });
        var upd = data.filter(function (o) { return o._id; }).length;
        info.innerHTML = U.num(data.length) + '줄 · 알아본 칸: ' + head.filter(Boolean).map(function (k) { return esc((cols.filter(function (c) { return c[0] === k; })[0] || [k, k])[1]); }).join(', ') +
          '<div class="tiny muted">' + ($('#ci-app').checked ? '모두 새 줄로 추가' : '고칠 줄 ' + upd + ' · 새 줄 ' + (data.length - upd)) + '</div><button class="btn sm primary" id="ci-go" style="margin-top:8px">올리기</button>';
        $('#ci-go').onclick = async function () {
          if (!(await NC.confirm(t.title + ' 표에 ' + data.length + '줄을 올릴까요?'))) return;
          try { var x = await NC.api('data.import', { table: t.table, rows: data, mode: $('#ci-app').checked ? 'append' : 'upsert' }); NC.toast('고침 ' + x.edits + ' · 추가 ' + x.adds + (x.batch ? ' (되돌리기 가능)' : ''), 'ok'); info.innerHTML = ''; } catch (e) { NC.err(e); }
        };
      } catch (e) { info.innerHTML = '<span class="minus">' + esc(e.message) + '</span>'; }
    };
  }

  // ---------- 데이터 점검 ----------
  async function check(body, alive) {
    body.innerHTML = '<div class="card"><div class="row wrap"><span class="small">최근</span><select class="input sm" id="ck-d" style="width:auto">' + opts([[14, '14일'], [30, '30일'], [60, '60일'], [93, '93일']], 30) + '</select><button class="btn sm primary" id="ck-go">점검하기</button></div><div id="ck-out" style="margin-top:12px"></div></div>';
    $('#ck-go').onclick = run;
    async function run() {
      var out = $('#ck-out'), days = +$('#ck-d').value;
      out.innerHTML = '<div class="loading"><div class="spinner"></div>점검 중…</div>';
      try {
        var r = await NC.api('data.check', { days: days });
        if (!alive()) return;
        out.innerHTML = r.ok ? '<div class="small" style="color:var(--ok)">✓ 맞지 않는 곳이 없어요</div>' : '<div class="list">' + r.issues.map(function (x) {
          return '<div class="li wrap"><div class="grow" style="min-width:220px"><div class="small">' + esc(x.text) + '</div><div class="tiny muted">' + esc(x.where) + '</div>' +
            (x.list ? '<details><summary class="tiny">자세히</summary><div class="tiny">' + x.list.map(function (y) { return esc(U.md(y.date) + ' ' + y.name + ' ' + y.itemName + ': 기록 ' + y.expected + ' / 지급 ' + y.actual); }).join('<br>') + '</div></details>' : '') + '</div>' +
            (x.fix ? '<button class="btn sm primary" data-fix="' + x.kind + '">한 번에 맞추기</button>' : '<a class="btn sm ghost" href="#/admin/data?tab=editor">편집기에서 고치기</a>') + '</div>';
        }).join('') + '</div>';
        $$('[data-fix]', out).forEach(function (b) {
          b.onclick = async function () {
            if (!(await NC.confirm('맞지 않는 곳을 한 번에 맞출까요? 필요한 만큼 파이가 지급·회수돼요.'))) return;
            try { var x = await NC.api('data.fix', { kind: b.getAttribute('data-fix'), days: days }); NC.toast(x.count + '건을 맞췄어요.', 'ok'); run(); } catch (e) { NC.err(e); }
          };
        });
      } catch (e) { out.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
    }
    run();
  }
})();
