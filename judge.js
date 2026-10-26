/* 운영 판정 화면 — 항목 기준 · 멤버 기준 · 날짜 기준 표, 위클리, 확인 대기 목록 */
(function () {
  var NC = window.NC, U = NC.u, $ = U.$, $$ = U.$$, esc = U.esc;
  var SHORT_ST = { none: '', pending: '대기', ok: '인정', vague: '애매', fail: '미수행' };

  NC.pages['admin/judge'] = async function (el, q, alive) {
    var isAdmin = NC.can('judge.all'), canAttend = NC.can('judge.attend');
    var t0 = U.today();
    var S = {
      week: U.weekOf(q.date || t0), view: q.view || 'item', mission: isAdmin ? (q.mission || 'study') : 'attend',
      member: q.member || null, date: q.date || t0, filters: {}, transpose: false, sel: {}, selMode: false, focus: null
    };
    var G = null, idx = {}, offs = {};
    function key(d, m, mi) { return d + '|' + m + '|' + mi; }

    el.innerHTML =
      '<div class="jtool"><div class="seg" id="j-view">' +
      '<button data-v="item">항목 기준</button><button data-v="member">멤버 기준</button><button data-v="date">날짜 기준</button>' +
      (isAdmin ? '<button data-v="weekly">위클리</button>' : '') + '</div></div>' +
      '<div id="j-top"></div><div id="j-body"></div>';

    $$('#j-view button').forEach(function (b) {
      b.onclick = function () { S.view = b.getAttribute('data-v'); S.sel = {}; S.focus = null; renderAll(); };
    });

    async function load() {
      $('#j-body').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      G = await NC.api('judge.grid', { from: S.week, to: U.addDays(S.week, 6) });
      if (!alive()) return false;
      idx = {}; offs = {};
      G.recs.forEach(function (r) { idx[key(r.date, r.memberId, r.mission)] = r; });
      G.dayoffs.forEach(function (d) { offs[d.date + '|' + d.memberId] = d; });
      if (!S.member || !G.members.some(function (m) { return m.id === S.member; })) S.member = G.members[0] ? G.members[0].id : null;
      if (S.date < S.week || S.date > U.addDays(S.week, 6)) S.date = (t0 >= S.week && t0 <= U.addDays(S.week, 6)) ? t0 : S.week;
      return true;
    }

    function dates() { var a = []; for (var i = 0; i < 7; i++) a.push(U.addDays(S.week, i)); return a; }
    function memberList() {
      var ms = G.members;
      if (S.filters.mentee) ms = ms.filter(function (m) { return m.mentee; });
      if (S.filters.mentor) ms = ms.filter(function (m) { return m.mentor; });
      return ms;
    }
    function missionList() { var on = (G && G.missions) || NC.MISSIONS; return S.filters.required ? on.filter(function (mi) { return NC.REQUIRED.indexOf(mi) >= 0; }) : on; }
    function memberById(id) { return G.members.filter(function (m) { return m.id === id; })[0]; }
    function questTitle(d, mi) {
      var wq = G.quests[U.weekOf(d)];
      if (!wq) return '';
      if (mi === 'weekly') return wq.weekly ? wq.weekly.title : '';
      if (mi !== 'daily') return '';
      var o = wq.over[String(U.dow(d))] || wq.daily;
      return o ? o.title : '';
    }

    function mRow(m) { return { k: m.id, label: esc(m.name), sub: m.insta ? '@' + esc(m.insta) : '', tip: m.name }; }
    function dCol(d) { return { k: d, label: U.md(d) + (d === G.today ? ' •' : ''), sub: U.DOW[U.dow(d)] + (G.locked[U.weekOf(d)] ? ' 🔒' : ''), tip: d }; }
    function miCol(mi, d) { var qt = questTitle(d || S.date, mi); return { k: mi, label: NC.MISSION_SHORT[mi], sub: NC.REQUIRED.indexOf(mi) >= 0 ? '필수' : '', tip: NC.MISSION_NAMES[mi] + (qt ? ' · ' + qt : '') }; }

    function axes() {
      var rows, cols, cell;
      if (S.view === 'item') {
        rows = memberList().map(mRow); cols = dates().map(dCol);
        cell = function (r, c) { return { date: c.k, memberId: r.k, mission: S.mission }; };
      } else if (S.view === 'member') {
        rows = missionList().map(function (mi) { return miCol(mi); }); cols = dates().map(dCol);
        cell = function (r, c) { return { date: c.k, memberId: S.member, mission: r.k }; };
      } else if (S.view === 'date') {
        rows = memberList().map(mRow); cols = missionList().map(function (mi) { return miCol(mi, S.date); });
        cell = function (r, c) { return { date: S.date, memberId: r.k, mission: c.k }; };
      } else {
        rows = memberList().map(mRow); cols = [{ k: S.week, label: '위클리 퀘스트', sub: questTitle(S.week, 'weekly') ? esc(questTitle(S.week, 'weekly')).slice(0, 14) : '퀘스트 없음' }];
        cell = function (r, c) { return { date: S.week, memberId: r.k, mission: 'weekly' }; };
      }
      if (S.transpose && S.view !== 'weekly') { var tmp = rows; rows = cols; cols = tmp; var base = cell; cell = function (r, c) { return base(c, r); }; }
      if (S.filters.pending) {
        rows = rows.filter(function (r) { return cols.some(function (c) { return info(cell(r, c)).st === 'pending'; }); });
      }
      return { rows: rows, cols: cols, cell: cell };
    }

    function info(c) {
      var r = idx[key(c.date, c.memberId, c.mission)];
      var st = r ? r.status : 'none';
      var off = c.mission !== 'weekly' ? offs[c.date + '|' + c.memberId] : null;
      var future = c.date > G.today;
      var locked = !!G.locked[U.weekOf(c.date)], editable = G.editable ? G.editable[U.weekOf(c.date)] !== false : !locked;
      var ro = future || !editable || (!isAdmin && !(canAttend && c.mission === 'attend'));
      return { r: r, st: st, off: off, future: future, locked: locked, editable: editable, ro: ro };
    }
    function ck(c) { return key(c.date, c.memberId, c.mission); }

    // ---------------- 상단 도구 ----------------
    function renderTop() {
      $$('#j-view button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === S.view); });
      $('#j-view').parentNode.classList.toggle('hidden', S.view === 'pending');
      var top = $('#j-top');
      if (S.view === 'pending') { top.innerHTML = ''; return; }
      var we = U.addDays(S.week, 6);
      var h = '<div class="jtool"><div class="weeknav"><button class="btn icon sm" id="j-prev">' + NC.icon('left') + '</button><span class="lbl">' + U.md(S.week) + ' ~ ' + U.md(we) + (G && G.locked[S.week] ? ' 🔒' : '') + '</span>' +
        '<button class="btn icon sm" id="j-next">' + NC.icon('right') + '</button></div><button class="btn sm" id="j-this">이번 주</button>' +
        '<input type="date" class="input sm" id="j-pick" style="width:auto" value="' + S.date + '">' +
        (S.view !== 'weekly' ? '<button class="btn sm" id="j-tr" title="가로줄과 세로줄 바꾸기">가로세로 바꾸기</button>' : '') +
        '<button class="btn sm' + (S.selMode ? ' primary' : '') + '" id="j-selmode">선택 모드</button></div>';
      if (S.view === 'item') {
        h += '<div class="chips" style="margin-bottom:8px">' + missionList().map(function (mi) {
          return '<button class="chip' + (S.mission === mi ? ' on' : '') + '" data-mi="' + mi + '">' + NC.MISSION_NAMES[mi] + '</button>';
        }).join('') + '</div>';
      } else if (S.view === 'member') {
        h += '<div class="row" style="margin-bottom:8px"><button class="btn icon sm" id="j-mp">' + NC.icon('left') + '</button><select class="input sm" id="j-mem" style="max-width:260px">' +
          G.members.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === S.member ? ' selected' : '') + '>' + esc(m.name) + ' (@' + esc(m.id) + ')</option>'; }).join('') +
          '</select><button class="btn icon sm" id="j-mn">' + NC.icon('right') + '</button></div>';
      } else if (S.view === 'date') {
        h += '<div class="chips" style="margin-bottom:8px">' + dates().map(function (d) {
          return '<button class="chip' + (S.date === d ? ' on' : '') + '" data-d="' + d + '"' + (d > G.today ? ' disabled style="opacity:.4"' : '') + '>' + U.mdw(d) + '</button>';
        }).join('') + '</div>';
      }
      h += '<div class="jtool"><div class="chips">' +
        (S.view !== 'member' ? '<button class="chip' + (S.filters.mentee ? ' on' : '') + '" data-f="mentee">멘티만</button><button class="chip' + (S.filters.mentor ? ' on' : '') + '" data-f="mentor">멘토만</button>' : '') +
        '<button class="chip' + (S.filters.pending ? ' on' : '') + '" data-f="pending">확인 대기만</button>' +
        (S.view !== 'weekly' ? '<button class="chip' + (S.filters.required ? ' on' : '') + '" data-f="required">필수 미션만</button>' : '') + '</div>' +
        '<div class="row right wrap" style="gap:6px">' + (isAdmin ? '<button class="btn sm" id="j-allok">대기 모두 인정</button>' : '') +
        (isAdmin && S.view === 'date' ? '<button class="btn sm danger" id="j-fillfail">남은 회색 → 미수행</button>' : '') + '</div></div>';
      top.innerHTML = h;
      $('#j-prev').onclick = function () { S.week = U.addDays(S.week, -7); S.date = U.addDays(S.date, -7); reload(); };
      $('#j-next').onclick = function () { S.week = U.addDays(S.week, 7); S.date = U.addDays(S.date, 7); reload(); };
      $('#j-this').onclick = function () { S.week = U.weekOf(t0); S.date = t0; reload(); };
      $('#j-pick').onchange = function () { if (!this.value) return; S.date = this.value; S.week = U.weekOf(this.value); if (S.view === 'item' || S.view === 'member') S.view = S.view; reload(); };
      if ($('#j-tr')) $('#j-tr').onclick = function () { S.transpose = !S.transpose; S.focus = null; renderGrid(); };
      $('#j-selmode').onclick = function () { S.selMode = !S.selMode; if (!S.selMode) S.sel = {}; renderTop(); renderGrid(); };
      $$('[data-mi]', top).forEach(function (b) { b.onclick = function () { S.mission = b.getAttribute('data-mi'); S.sel = {}; renderTop(); renderGrid(); }; });
      $$('[data-d]', top).forEach(function (b) { b.onclick = function () { S.date = b.getAttribute('data-d'); S.sel = {}; renderTop(); renderGrid(); }; });
      $$('[data-f]', top).forEach(function (b) {
        b.onclick = function () {
          var f = b.getAttribute('data-f');
          S.filters[f] = !S.filters[f];
          if (f === 'mentee' && S.filters.mentee) S.filters.mentor = false;
          if (f === 'mentor' && S.filters.mentor) S.filters.mentee = false;
          if (f === 'required' && S.filters.required && NC.REQUIRED.indexOf(S.mission) < 0) S.mission = 'study';
          renderTop(); renderGrid();
        };
      });
      if ($('#j-mem')) {
        $('#j-mem').onchange = function () { S.member = this.value; S.sel = {}; renderGrid(); };
        var step = function (n) { var i = G.members.findIndex(function (m) { return m.id === S.member; }); var nm = G.members[(i + n + G.members.length) % G.members.length]; S.member = nm.id; renderTop(); renderGrid(); };
        $('#j-mp').onclick = function () { step(-1); };
        $('#j-mn').onclick = function () { step(1); };
      }
      if ($('#j-allok')) $('#j-allok').onclick = async function () {
        var cells = viewCells().filter(function (c) { var i = info(c); return !i.ro && i.st === 'pending'; });
        if (!cells.length) return NC.toast('지금 표에 확인 대기 칸이 없어요.');
        if (!(await NC.confirm('지금 표의 확인 대기(노란색) ' + cells.length + '개를 모두 인정할까요?\n공부시간은 멤버 입력값으로 확정됩니다.'))) return;
        apply(cells, 'ok');
      };
      if ($('#j-fillfail')) $('#j-fillfail').onclick = async function () {
        var cells = viewCells().filter(function (c) { var i = info(c); return !i.ro && i.st === 'none'; });
        if (!cells.length) return NC.toast('남은 회색 칸이 없어요.');
        if (!(await NC.confirm(U.mdw(S.date) + '의 남은 회색 칸 ' + cells.length + '개를 모두 미수행(빨강)으로 확정할까요?', { danger: true, ok: '미수행 확정' }))) return;
        apply(cells, 'fail');
      };
    }

    function viewCells() {
      var a = axes(), out = [];
      a.rows.forEach(function (r) { a.cols.forEach(function (c) { out.push(a.cell(r, c)); }); });
      return out;
    }

    // ---------------- 표 ----------------
    var AX = null;
    function cellHtml(c, ri, ci) {
      var i = info(c), cls = 'jc st-' + i.st;
      if (i.future) cls = 'jc na';
      if (i.off) cls += ' off hatch';
      else if (i.ro) cls += ' ro';
      if (S.sel[ck(c)]) cls += ' sel';
      if (S.focus && S.focus[0] === ri && S.focus[1] === ci) cls += ' focus';
      var inner = '';
      if (!i.future) {
        if (c.mission === 'hours' && i.r && (i.r.inputMin !== null || i.r.finalMin !== null)) {
          inner = '<span class="t">입력 ' + U.fmtMin(i.r.inputMin) + '</span><span class="t">확정 ' + (i.r.finalMin !== null && i.st === 'ok' ? U.fmtMin(i.r.finalMin) : '-') + '</span>';
        } else inner = SHORT_ST[i.st];
      }
      return '<td><div class="' + cls + '" data-i="' + ri + ',' + ci + '">' + inner + '</div></td>';
    }
    function renderGrid() {
      var body = $('#j-body');
      if (!G.members.length) { body.innerHTML = '<div class="card empty">활성 멤버가 없어요.</div>'; return; }
      var a = AX = axes();
      var prev = $('.jgrid-wrap', body), sl = prev ? prev.scrollLeft : 0, st = prev ? prev.scrollTop : 0;
      var cornerLabel = S.view === 'item' ? NC.MISSION_NAMES[S.mission] : S.view === 'member' ? esc((memberById(S.member) || {}).name || '') : S.view === 'date' ? U.mdw(S.date) : U.md(S.week) + ' 주';
      var h = '<div class="jgrid-wrap" tabindex="0"><table class="jg"><thead><tr><th class="corner">' + cornerLabel + '</th>' +
        a.cols.map(function (c, ci) { return '<th data-col="' + ci + '" title="' + esc(c.tip || '') + '">' + c.label + (c.sub ? '<span class="s">' + c.sub + '</span>' : '') + '</th>'; }).join('') +
        '<th class="sum">완료 · 대기</th></tr></thead><tbody>';
      var colDone = a.cols.map(function () { return 0; }), colPend = a.cols.map(function () { return 0; });
      a.rows.forEach(function (r, ri) {
        var done = 0, pend = 0;
        h += '<tr><th data-row="' + ri + '" title="' + esc(r.tip || '') + '">' + r.label + (r.sub ? '<span class="s">' + r.sub + '</span>' : '') + '</th>';
        a.cols.forEach(function (c, ci) {
          var cell = a.cell(r, c), i = info(cell);
          if (i.st === 'ok' || i.st === 'vague') { done++; colDone[ci]++; }
          if (i.st === 'pending') { pend++; colPend[ci]++; }
          h += cellHtml(cell, ri, ci);
        });
        h += '<td class="sum">' + done + (pend ? ' · <b style="color:#a77b00">' + pend + '</b>' : '') + '</td></tr>';
      });
      if (!a.rows.length) h += '<tr><td colspan="' + (a.cols.length + 2) + '"><div class="empty">조건에 맞는 칸이 없어요</div></td></tr>';
      h += '</tbody><tfoot><tr><th>완료 · 대기</th>' + a.cols.map(function (c, ci) { return '<td class="sum">' + colDone[ci] + (colPend[ci] ? ' · <b style="color:#a77b00">' + colPend[ci] + '</b>' : '') + '</td>'; }).join('') + '<td class="sum"></td></tr></tfoot></table></div>';
      h += '<div class="legend"><span><i class="dot st-none"></i>미표시</span><span><i class="dot st-pending"></i>확인 대기</span><span><i class="dot st-ok"></i>확인 완료</span><span><i class="dot st-fail"></i>최종 미수행</span><span><span class="dayoff-tag" style="padding:0 4px;font-size:10px">OFF</span>데이오프</span>' +
        '<span class="muted">· 칸을 눌러 판정 · 이름이나 날짜를 누르면 그 줄 전체 선택' + (window.innerWidth > 1023 ? ' · 드래그로 여러 칸 선택 · 방향키 이동, 1 인정 / 2 애매함 / 3 미수행 / 0 초기화' : '') + '</span></div>';
      var n = Object.keys(S.sel).length;
      if (n) h += '<div class="selbar"><b>' + n + '개 선택</b>' +
        (isAdmin ? '<button class="btn sm j-ok" data-b="ok">인정</button><button class="btn sm j-vague" data-b="vague">애매함</button><button class="btn sm j-fail" data-b="fail">미수행</button>' +
          '<button class="btn sm" data-b="failgray">빈칸만 미수행</button><button class="btn sm" data-b="reset">초기화</button><button class="btn sm" data-b="pendonly">대기만 남기기</button>'
          : '<button class="btn sm j-ok" data-b="ok">출석 처리</button>') +
        '<button class="btn sm ghost right" data-b="clear" style="color:inherit">해제</button></div>';
      body.innerHTML = h;
      var wrap = $('.jgrid-wrap', body);
      wrap.scrollLeft = sl; wrap.scrollTop = st;
      bindGrid(wrap);
      $$('.selbar [data-b]', body).forEach(function (b) { b.onclick = function () { selAction(b.getAttribute('data-b')); }; });
    }

    function cellAt(ri, ci) { return AX.cell(AX.rows[ri], AX.cols[ci]); }
    function posOf(elm) { var p = elm.getAttribute('data-i').split(','); return [+p[0], +p[1]]; }
    function toggleSel(c, force) {
      var i = info(c);
      if (i.ro) return;
      var k = ck(c);
      var on = force === undefined ? !S.sel[k] : force;
      if (on) S.sel[k] = c; else delete S.sel[k];
    }

    function bindGrid(wrap) {
      var drag = null, suppress = false;
      wrap.addEventListener('pointerdown', function (e) {
        var c = e.target.closest('.jc');
        if (!c || e.pointerType !== 'mouse' || e.button !== 0) return;
        drag = { s: posOf(c), c: posOf(c), moved: false };
      });
      wrap.addEventListener('pointerover', function (e) {
        if (!drag) return;
        var c = e.target.closest('.jc');
        if (!c) return;
        var p = posOf(c);
        if (p[0] !== drag.s[0] || p[1] !== drag.s[1]) drag.moved = true;
        drag.c = p;
        if (drag.moved) {
          $$('.jc.drag', wrap).forEach(function (x) { x.classList.remove('drag', 'sel'); });
          var r0 = Math.min(drag.s[0], p[0]), r1 = Math.max(drag.s[0], p[0]), c0 = Math.min(drag.s[1], p[1]), c1 = Math.max(drag.s[1], p[1]);
          for (var r = r0; r <= r1; r++) for (var q2 = c0; q2 <= c1; q2++) { var x = $('.jc[data-i="' + r + ',' + q2 + '"]', wrap); if (x && !x.classList.contains('sel')) x.classList.add('sel', 'drag'); }
        }
      });
      function up() {
        if (!drag) return;
        if (drag.moved) {
          var r0 = Math.min(drag.s[0], drag.c[0]), r1 = Math.max(drag.s[0], drag.c[0]), c0 = Math.min(drag.s[1], drag.c[1]), c1 = Math.max(drag.s[1], drag.c[1]);
          for (var r = r0; r <= r1; r++) for (var q2 = c0; q2 <= c1; q2++) toggleSel(cellAt(r, q2), true);
          suppress = true;
          renderGrid();
        }
        drag = null;
      }
      document.addEventListener('pointerup', up, { once: true });
      wrap.addEventListener('pointerup', up);
      wrap.addEventListener('click', function (e) {
        if (suppress) { suppress = false; return; }
        var th = e.target.closest('th[data-row],th[data-col]');
        if (th) {
          var cells = [];
          if (th.hasAttribute('data-row')) { var ri = +th.getAttribute('data-row'); AX.cols.forEach(function (c, ci) { cells.push(cellAt(ri, ci)); }); }
          else { var ci2 = +th.getAttribute('data-col'); AX.rows.forEach(function (r, ri2) { cells.push(cellAt(ri2, ci2)); }); }
          cells = cells.filter(function (c) { return !info(c).ro; });
          var allOn = cells.length && cells.every(function (c) { return S.sel[ck(c)]; });
          cells.forEach(function (c) { toggleSel(c, !allOn); });
          if (!allOn) S.selMode = true;
          renderTop(); renderGrid();
          return;
        }
        var ce = e.target.closest('.jc');
        if (!ce) return;
        var p = posOf(ce), c = cellAt(p[0], p[1]);
        S.focus = p;
        if (S.selMode || e.shiftKey || e.ctrlKey || e.metaKey) { toggleSel(c); renderGrid(); return; }
        if (info(c).future) return;
        openCell(c);
      });
      wrap.addEventListener('keydown', function (e) {
        if (!AX.rows.length) return;
        var f = S.focus || [0, 0], k = e.key;
        var mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
        if (mv) {
          e.preventDefault();
          S.focus = [Math.max(0, Math.min(AX.rows.length - 1, f[0] + mv[0])), Math.max(0, Math.min(AX.cols.length - 1, f[1] + mv[1]))];
          $$('.jc.focus', wrap).forEach(function (x) { x.classList.remove('focus'); });
          var x = $('.jc[data-i="' + S.focus[0] + ',' + S.focus[1] + '"]', wrap);
          if (x) { x.classList.add('focus'); x.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
          return;
        }
        if (!S.focus) return;
        var c = cellAt(f[0], f[1]), i = info(c);
        if (k === 'Enter') { e.preventDefault(); if (!i.future) openCell(c); return; }
        if (k === ' ') { e.preventDefault(); toggleSel(c); renderGrid(); $('.jgrid-wrap').focus(); return; }
        if (k === 'Escape') { S.sel = {}; renderGrid(); $('.jgrid-wrap').focus(); return; }
        if (i.ro) return;
        var st = { '1': 'ok', 'a': 'ok', '2': 'vague', '3': 'fail', 'x': 'fail', '0': 'reset', 'Backspace': 'reset', 'Delete': 'reset' }[k];
        if (!st) return;
        e.preventDefault();
        if (!isAdmin && st !== 'ok') return;
        if (st === 'vague' && c.mission !== 'study') return;
        apply([c], st).then(function () { var w = $('.jgrid-wrap'); if (w) w.focus(); });
      });
    }

    async function selAction(b) {
      var cells = Object.keys(S.sel).map(function (k) { return S.sel[k]; });
      if (b === 'clear') { S.sel = {}; S.selMode = false; renderTop(); renderGrid(); return; }
      if (b === 'pendonly') {
        cells.forEach(function (c) { if (info(c).st !== 'pending') delete S.sel[ck(c)]; });
        renderGrid(); return;
      }
      if (b === 'failgray') {
        cells = cells.filter(function (c) { return info(c).st === 'none'; });
        if (!cells.length) return NC.toast('선택한 칸 중 회색 칸이 없어요.');
        if (!(await NC.confirm('선택한 회색 칸 ' + cells.length + '개를 미수행으로 확정할까요?', { danger: true, ok: '미수행' }))) return;
        return apply(cells, 'fail', true);
      }
      if (b === 'vague') cells = cells.filter(function (c) { return c.mission === 'study'; });
      if (!cells.length) return NC.toast('적용할 칸이 없어요. (애매함은 공부인증에만)');
      var label = { ok: '인정', vague: '애매함', fail: '미수행', reset: '초기화' }[b];
      if (cells.length > 1 && !(await NC.confirm('선택한 ' + cells.length + '개를 ' + label + ' 처리할까요?', { danger: b === 'fail' || b === 'reset', ok: label }))) return;
      apply(cells, b, true);
    }

    async function apply(cells, status, clearSel, finalMin) {
      try {
        var payload = cells.map(function (c) { var o = { date: c.date, memberId: c.memberId, mission: c.mission, status: status }; if (finalMin !== undefined && c.mission === 'hours') o.finalMin = finalMin; return o; });
        var r = await NC.api('judge.set', { cells: payload });
        r.recs.forEach(function (x) { idx[key(x.date, x.memberId, x.mission)] = x; });
        if (clearSel) S.sel = {};
        renderGrid();
        if (r.skipped.length) NC.toast(r.recs.length + '개 처리 · ' + r.skipped.length + '개 건너뜀 (' + r.skipped[0].reason + ')', 'err');
        else if (cells.length > 1) NC.toast(r.recs.length + '개 처리했어요.', 'ok');
        return r;
      } catch (e) { NC.err(e); }
    }

    // ---------------- 칸 팝업 ----------------
    function openCell(c) {
      var i = info(c), m = memberById(c.memberId) || { name: c.memberId, tags: [] }, r = i.r;
      var title = m.name + ' · ' + NC.MISSION_NAMES[c.mission];
      var qt = questTitle(c.date, c.mission);
      var det = '<div class="row wrap" style="margin-bottom:8px">' + NC.who(m) + (m.insta ? '<span class="small muted">@' + esc(m.insta) + '</span>' : '') + '</div>' +
        '<dl class="kv"><dt>날짜</dt><dd>' + (c.mission === 'weekly' ? U.md(c.date) + ' 주' : U.mdw(c.date)) + '</dd>' +
        '<dt>상태</dt><dd>' + NC.statusPill(i.st) + (r && r.pie ? ' <span class="plus small">+' + r.pie + '</span>' : '') + '</dd>' +
        (qt ? '<dt>퀘스트</dt><dd>' + esc(qt) + '</dd>' : '') +
        (r && r.selfMarked ? '<dt>본인 체크</dt><dd>' + U.fmtDT(r.selfAt) + '</dd>' : '') +
        (c.mission === 'hours' ? '<dt>멤버 입력</dt><dd>' + (r && r.inputMin !== null ? U.fmtHM(r.inputMin) : '-') + '</dd>' : '') +
        (r && r.judgeBy ? '<dt>판정</dt><dd>' + esc(r.judgeName) + ' · ' + U.fmtDT(r.judgeAt) + '</dd>' : '') +
        (i.off ? '<dt>데이오프</dt><dd><span class="dayoff-tag">OFF</span> ' + (i.off.mode === 'self' ? '본인 신청' : i.off.mode === 'holiday' ? '전체 휴일' : esc(i.off.byName) + ' 지정') + (i.off.reason ? ' · ' + esc(i.off.reason) : '') + '</dd>' : '') +
        '</dl>';
      if (i.locked && !i.editable) det += '<p class="small muted">🔒 정산이 끝난 주라 바꿀 수 없어요. 필요하면 멤버 관리 › 파이에서 직접 지급·회수하세요.</p>';
      else if (i.locked) det += '<p class="small" style="color:var(--warn,#a77b00)">🔒 정산이 끝난 주예요. 바꾸면 파이 차액이 바로 반영되지만, 이미 지급한 주간 보너스는 그대로예요. (정산을 취소하고 다시 정산할 수 있어요)</p>';
      else if (c.date > G.today) det += '<p class="small muted">미래 날짜는 판정할 수 없어요.</p>';
      else if (!isAdmin && c.mission !== 'attend') det += '<p class="small muted">이 칸은 생존신고 출석 처리만 할 수 있어요.</p>';
      var acts = '';
      if (!i.ro) {
        if (!isAdmin) acts = '<div class="acts"><button class="btn j-ok" data-s="ok" style="grid-column:span 2">출석 처리</button></div>';
        else {
          if (c.mission === 'hours') {
            var base = r ? (r.finalMin !== null && i.st === 'ok' ? r.finalMin : r.inputMin) : null;
            det += '<div class="row" style="margin-top:12px"><label class="field grow"><span>확정 시간</span><input class="input" type="number" min="0" max="24" id="cp-h" value="' + (base !== null ? Math.floor(base / 60) : '') + '" placeholder="시간"></label>' +
              '<label class="field grow"><span>&nbsp;</span><input class="input" type="number" min="0" max="59" id="cp-m" value="' + (base !== null ? base % 60 : '') + '" placeholder="분"></label></div>' +
              '<div class="tiny muted" style="margin-top:4px">파이 = 시간 × ' + NC.settings.rewards.hourPer + ' (분 버림, 최대 ' + NC.settings.rewards.hourCap + '시간) · 랭킹은 분 단위 합산</div>';
          }
          acts = '<div class="acts"><button class="btn j-ok" data-s="ok">' + (c.mission === 'hours' ? '시간 확정' : '인정') + '</button>' +
            (c.mission === 'study' ? '<button class="btn j-vague" data-s="vague">애매함</button>' : '') +
            '<button class="btn j-fail" data-s="fail">미수행</button><button class="btn" data-s="reset">초기화</button></div>';
        }
      }
      var mo = NC.modal({ title: title, body: '<div class="judge-pop">' + det + acts + '</div>' });
      $$('[data-s]', mo.body).forEach(function (b) {
        b.onclick = async function () {
          var s = b.getAttribute('data-s'), fm;
          if (c.mission === 'hours' && s === 'ok' && isAdmin) {
            var hh = $('#cp-h', mo.body).value, mm = $('#cp-m', mo.body).value;
            if (hh === '' && mm === '') return NC.toast('확정 시간을 입력하세요.', 'err');
            fm = (+hh || 0) * 60 + (+mm || 0);
          }
          b.disabled = true;
          var res = await apply([c], s, false, fm);
          if (res && !res.skipped.length) mo.close();
          b.disabled = false;
        };
      });
    }

    // ---------------- 확인 대기 목록 ----------------
    async function renderPending() {
      var body = $('#j-body');
      body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      var d = await NC.api('judge.pending');
      if (!alive()) return;
      var list = d.list.filter(function (r) { return isAdmin || (canAttend && r.mission === 'attend'); });
      if (!list.length) { body.innerHTML = '<div class="card empty">확인 대기 중인 인증이 없어요 🎉</div>'; return; }
      var groups = {};
      list.forEach(function (r) { (groups[r.date] = groups[r.date] || []).push(r); });
      body.innerHTML = '<p class="small muted" style="margin:0 2px 10px">노란색(확인 대기) 칸만 모았어요. 인스타 인증방을 보면서 위에서부터 처리하세요. · 총 ' + list.length + '개</p>' +
        Object.keys(groups).sort().reverse().map(function (dt) {
          return '<div class="card" style="margin-bottom:12px"><div class="card-head"><h2>' + U.mdw(dt) + '</h2><span class="small muted">' + groups[dt].length + '개</span></div><div class="list">' +
            groups[dt].map(function (r) {
              var k = key(r.date, r.memberId, r.mission);
              return '<div class="li wrap" data-k="' + esc(k) + '"><div class="grow" style="min-width:160px"><div><b>' + esc(r.name) + '</b> <span class="muted small">' + (r.insta ? '@' + esc(r.insta) : '') + '</span></div>' +
                '<div class="small"><span class="pill">' + esc(r.missionName) + '</span> ' + (r.mission === 'hours' ? '입력 ' + U.fmtHM(r.inputMin) : '') + ' <span class="tiny muted">체크 ' + U.fmtDT(r.selfAt) + '</span></div></div>' +
                '<div class="row wrap" style="gap:5px">' +
                (r.mission === 'hours' ? '<input class="input sm" type="number" style="width:58px" data-h value="' + Math.floor(r.inputMin / 60) + '">시 <input class="input sm" type="number" style="width:58px" data-m value="' + (r.inputMin % 60) + '">분' : '') +
                '<button class="btn sm j-ok" data-s="ok">인정</button>' + (r.mission === 'study' ? '<button class="btn sm j-vague" data-s="vague">애매함</button>' : '') +
                (isAdmin ? '<button class="btn sm j-fail" data-s="fail">미수행</button>' : '') + '</div></div>';
            }).join('') + '</div></div>';
        }).join('');
      $$('[data-k]', body).forEach(function (row) {
        var p = row.getAttribute('data-k').split('|');
        $$('[data-s]', row).forEach(function (b) {
          b.onclick = async function () {
            var cell = { date: p[0], memberId: p[1], mission: p[2], status: b.getAttribute('data-s') };
            if (cell.mission === 'hours' && cell.status === 'ok') cell.finalMin = (+$('[data-h]', row).value || 0) * 60 + (+$('[data-m]', row).value || 0);
            b.disabled = true;
            try {
              var r = await NC.api('judge.set', { cells: [cell] });
              if (r.skipped.length) { NC.toast(r.skipped[0].reason, 'err'); b.disabled = false; return; }
              row.style.transition = 'opacity .2s'; row.style.opacity = '0';
              setTimeout(function () { row.remove(); }, 200);
            } catch (e) { NC.err(e); b.disabled = false; }
          };
        });
      });
    }

    async function reload() { S.sel = {}; S.focus = null; if (await load()) { renderTop(); renderGrid(); } }
    async function renderAll() {
      if (S.view === 'pending') { renderTop(); return renderPending(); }
      if (!G || G.from !== S.week) { if (!(await load())) return; }
      renderTop(); renderGrid();
    }
    if (q.view === 'pending') S.view = 'pending';
    await renderAll();
  };
})();
