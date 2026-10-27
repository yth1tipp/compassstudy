/* 미니게임 10종 + 게임 화면 */
(function () {
  var NC = window.NC, U = NC.u, $ = U.$, $$ = U.$$, esc = U.esc;
  var EMOJI = { roulette: '🧭', rps: '✌️', mines: '💣', g2048: '🔢', metronome: '🎵', darts: '🎯', treasure: '🎁', stopwatch: '⏱️', cards: '🃏', updown: '🔼' };
  // 게임 설명: 지금 설정된 숫자(판 수 · 탭 횟수 · 목표 시간 등)를 읽어서 만들어요
  function fmtNum(n) { return String(Math.round(n * 100) / 100); }
  var DESC = {
    roulette: function () { return '고정된 8방위 판 위에서 나침반 바늘이 돌다가 멈춘 방위의 파이를 받아요.'; },
    rps: function (c) { return '컴퓨터와 가위바위보 ' + c.rounds + '판! 이길수록 파이가 늘어나요.'; },
    mines: function (c) { var d = minesDims(c); return d.n + '×' + d.n + ' 칸, 지뢰 ' + d.m + '개. 추측 없이 논리만으로 풀 수 있는 판이에요. 빨리 풀수록 더 많이!'; },
    g2048: function () { return '같은 숫자 타일을 합쳐 큰 타일을 만들어요. 더 못 움직이거나 그만두면 최고 타일로 정산해요.'; },
    metronome: function (c) { return '진자가 가운데 판정선을 지나는 순간에 맞춰 ' + c.taps + '번 탭! ' + (c.beatMs > 0 ? '(1분에 ' + fmtNum(60000 / c.beatMs) + '박) ' : '') + '원하는 박에 치면 돼요.'; },
    darts: function (c) { return '움직이는 조준점을 멈춰 다트 ' + c.throws + '발. 실제 다트 점수 그대로 받아요.'; },
    treasure: function (c) {
      var lo = Math.min.apply(null, c.values), hi = Math.max.apply(null, c.values);
      return '상자 3개 중 하나를 골라 열어보세요. ' + (lo === hi ? lo + ' 파이가' : lo + '~' + hi + ' 파이 중 하나가') + ' 들어 있어요.';
    },
    stopwatch: function (c) { return '시간이 안 보이는 상태로 정확히 ' + c.targetSec.toFixed(2) + '초에 멈춰보세요.'; },
    cards: function (c) { return '공부 그림카드 8쌍을 ' + c.maxTries + '번 시도 안에 모두 찾아요.'; },
    updown: function (c) { return '1~' + c.max + ' 사이 숫자를 업/다운 힌트로 ' + c.guesses + '번 안에 맞혀요.'; }
  };
  /** 지뢰찾기 판 크기 · 지뢰 수 (설정이 너무 크거나 작아도 게임이 멈추지 않게 맞춰요) */
  function minesDims(c) { var n = Math.max(4, Math.min(24, Math.round(+c.size) || 9)); return { n: n, m: Math.max(1, Math.min(Math.round(+c.mines) || 10, n * n - 10)) }; }
  function descOf(g, c) { try { return DESC[g] && c ? DESC[g](c) : ''; } catch (e) { return ''; } }
  var PICS = ['🧭', '📚', '✏️', '⏰', '☕', '💡', '🎧', '📒'];
  var PIC_NAMES = ['나침반', '책', '연필', '알람', '커피', '전구', '헤드폰', '노트'];
  var DIR_KO = { N: '북', NE: '북동', E: '동', SE: '남동', S: '남', SW: '남서', W: '서', NW: '북서' };
  var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  // ---------------- 보상 계산 (연습 모드 표시용 · 서버와 같은 규칙) ----------------
  function tier(tiers, v, d, cmp) { for (var i = 0; i < tiers.length; i++) if (cmp(v, tiers[i][0])) return tiers[i][1]; return d; }
  function calc(game, r, preset, c, max) {
    r = r || {}; var p = 0;
    switch (game) {
      case 'roulette': p = c.table[preset.dir] || 0; break;
      case 'treasure': p = preset.value || 0; break;
      case 'rps': p = c.base; (r.rounds || []).slice(0, c.rounds).forEach(function (x) { p += x === 'w' ? c.win : x === 'd' ? c.draw : c.lose; }); break;
      case 'mines': p = r.success ? tier(c.success, Math.floor(r.timeSec), c.successElse, function (v, t) { return v <= t; }) : tier(c.fail, r.correctFlags || 0, c.failElse, function (v, t) { return v <= t; }); break;
      case 'g2048': p = tier(c.tiers, r.maxTile || 0, c['else'], function (v, t) { return v >= t; }); break;
      case 'metronome': p = c.base; (r.deltas || []).slice(0, c.taps).forEach(function (d) { p += c[judge(d, c)] || 0; }); break;
      case 'darts': (r.throws || []).forEach(function (s) { p += s; }); break;
      case 'stopwatch': p = !r.stopped ? c['else'] : tier(c.tiers, Math.round(Math.abs(r.elapsedMs - c.targetSec * 1000)) / 1000, c['else'], function (v, t) { return v <= t + 1e-9; }); break;
      case 'cards': p = r.success && r.tries <= c.maxTries ? tier(c.success, r.tries, 0, function (v, t) { return v <= t; }) : Math.min((r.pairs || 0) * c.perPair, c.failCap); break;
      case 'updown': p = r.success ? Math.max(c.min, c.first - c.step * (r.guesses - 1)) : c.fail; break;
    }
    return Math.max(0, Math.min(Math.round(p), max || 100));
  }
  function judge(d, c) {
    if (d === null || d === undefined) return 'MISS';
    var a = Math.abs(d);
    return a <= c.windows.PERFECT ? 'PERFECT' : a <= c.windows.GREAT ? 'GREAT' : a <= c.windows.GOOD ? 'GOOD' : 'MISS';
  }

  function rewardTable(game, c, max) {
    var rows = [];
    switch (game) {
      case 'roulette': rows = DIRS.map(function (d) { return [d + ' · ' + DIR_KO[d], c.table[d]]; }); rows.push(['확률', '각 12.5%']); break;
      case 'rps': rows = [['기본', c.base], ['판마다 승리', '+' + c.win], ['무승부', '+' + c.draw], ['패배', '+' + c.lose], [c.rounds + '판 모두 이기면', c.base + c.win * c.rounds]]; break;
      case 'mines':
        var prev = -1;
        c.success.forEach(function (t) { rows.push(['성공 ' + (prev < 0 ? '' : fmtS(prev + 1) + ' ~ ') + fmtS(t[0]) + (prev < 0 ? ' 이내' : ''), t[1]]); prev = t[0]; });
        rows.push(['성공 ' + fmtS(prev + 1) + ' 이상', c.successElse]);
        var pf = -1;
        c.fail.forEach(function (t) { rows.push(['실패 · 정답 깃발 ' + (pf + 1) + '~' + t[0] + '개', t[1]]); pf = t[0]; });
        break;
      case 'g2048': rows = c.tiers.map(function (t) { return ['최고 타일 ' + t[0] + (t === c.tiers[0] ? ' 이상' : ''), t[1]]; }); rows.push(['그 외', c['else']]); break;
      case 'metronome': rows = [['기본', c.base], ['PERFECT ±' + c.windows.PERFECT + 'ms', '+' + c.PERFECT], ['GREAT ±' + c.windows.GREAT + 'ms', '+' + c.GREAT], ['GOOD ±' + c.windows.GOOD + 'ms', '+' + c.GOOD], ['MISS', '+' + c.MISS]]; break;
      case 'darts': rows = [['싱글', '숫자'], ['더블 (트리플 구역 포함)', '숫자 × 2'], ['불', 50], ['빗나감', 0], ['최대 (불 ' + c.throws + '발)', 50 * c.throws]]; break;
      case 'treasure': rows = [['상자 속 파이', Math.min.apply(null, c.values) + ' ~ ' + Math.max.apply(null, c.values)], ['확률', '각 ' + Math.round(100 / c.values.length) + '%']]; break;
      case 'stopwatch': rows = c.tiers.map(function (t) { return ['오차 ±' + fmtNum(t[0]) + '초', t[1]]; }); rows.push(['그 외', c['else']]); break;
      case 'cards': rows = c.success.map(function (t) { return ['성공 · ' + t[0] + '시도 이내', t[1]]; }); rows.push(['실패 · 찾은 쌍 1개당', c.perPair + ' (최대 ' + c.failCap + ')']); break;
      case 'updown': rows = [['1번에 맞히기', c.first], ['한 번 늘 때마다', '-' + c.step], [c.guesses + '번째', Math.max(c.min, c.first - c.step * (c.guesses - 1))], ['못 맞혀도', c.fail]]; break;
    }
    // 1회 최대 파이를 넘는 칸은 실제로 받는 값(최대치)으로 보여줘요
    if (max > 0) rows.forEach(function (r) { if (typeof r[1] === 'number' && r[1] > max) r[1] = max + ' (최대)'; });
    return '<table class="reward-tbl" style="width:100%;border-collapse:collapse">' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>';
  }
  function fmtS(s) { var m = Math.floor(s / 60), r = s % 60; return (m ? m + '분' : '') + (r || !m ? (m ? ' ' : '') + r + '초' : ''); }

  function describe(p) {
    var r = p.result || {};
    if (p.status !== 'done') return '진행 중';
    switch (p.game) {
      case 'roulette': return (p.preset.dir || '') + ' ' + (DIR_KO[p.preset.dir] || '');
      case 'treasure': return '상자 ' + ((r.box || 0) + 1) + ' → ' + p.preset.value;
      case 'rps': return (r.rounds || []).map(function (x) { return { w: '승', d: '무', l: '패' }[x]; }).join(' ');
      case 'mines': return r.success ? '성공 ' + fmtS(Math.floor(r.timeSec)) : '실패 · 정답 깃발 ' + (r.correctFlags || 0);
      case 'g2048': return '최고 타일 ' + (r.maxTile || 0);
      case 'metronome': return (r.deltas || []).map(function (d) { return d === null ? 'MISS' : (d > 0 ? '+' : '') + Math.round(d) + 'ms'; }).join(', ');
      case 'darts': return (r.labels || r.throws || []).join(', ');
      case 'stopwatch': return r.stopped ? (r.elapsedMs / 1000).toFixed(2) + '초' : '멈추지 않음';
      case 'cards': return r.success ? '성공 ' + r.tries + '시도' : '실패 · ' + (r.pairs || 0) + '쌍';
      case 'updown': return r.success ? r.guesses + '번 만에 성공' : '실패';
    }
    return '';
  }

  // ============================================================
  // 게임 구현
  // ============================================================
  var G = {};

  // ---------- 1. 룰렛 (나침반 바늘) ----------
  G.roulette = function (st, ctx) {
    var c = ctx.cfg, raf = 0;
    var sectors = DIRS.map(function (d, i) {
      var a0 = (i * 45 - 22.5 - 90) * Math.PI / 180, a1 = (i * 45 + 22.5 - 90) * Math.PI / 180, R = 140;
      var x0 = 150 + R * Math.cos(a0), y0 = 150 + R * Math.sin(a0), x1 = 150 + R * Math.cos(a1), y1 = 150 + R * Math.sin(a1);
      var la = (i * 45 - 90) * Math.PI / 180, lx = 150 + 108 * Math.cos(la), ly = 150 + 108 * Math.sin(la);
      return '<path d="M150 150 L' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 0 1 ' + x1 + ' ' + y1 + 'Z" fill="' + (i % 2 ? '#26315a' : '#1e2a4a') + '" stroke="#c99a46" stroke-width="1"/>' +
        '<text x="' + lx + '" y="' + (ly - 6) + '" text-anchor="middle" font-size="' + (d.length > 1 ? 13 : 17) + '" font-weight="800" fill="' + (d === 'N' ? '#ff7a7f' : '#f3f0e6') + '">' + d + '</text>' +
        '<text x="' + lx + '" y="' + (ly + 12) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#e9c27a">' + c.table[d] + '</text>';
    }).join('');
    st.innerHTML = '<div class="center"><svg viewBox="0 0 300 300" style="width:min(320px,86vw)">' +
      '<circle cx="150" cy="150" r="148" fill="#c99a46"/>' + sectors +
      '<circle cx="150" cy="150" r="62" fill="#f6f1e4" stroke="#c99a46" stroke-width="2"/>' +
      '<g id="rl-needle"><path d="M150 72 L159 150 L150 160 L141 150Z" fill="#e0565b"/><path d="M150 228 L159 150 L150 140 L141 150Z" fill="#9aa3b5"/></g>' +
      '<circle cx="150" cy="150" r="8" fill="#c99a46" stroke="#fff" stroke-width="2"/></svg>' +
      '<div style="margin-top:10px"><button class="btn primary lg" id="rl-go">바늘 돌리기</button></div></div>';
    var needle = $('#rl-needle', st);
    var dir = ctx.preset.dir;
    ctx.partial({ dir: dir });
    $('#rl-go', st).onclick = function () {
      this.disabled = true;
      var i = DIRS.indexOf(dir), off = (Math.random() * 2 - 1) * 14;
      var target = 360 * (5 + Math.floor(Math.random() * 2)) + i * 45 + off, t0 = performance.now(), D = 4200, W = 1100;
      function f(now) {
        var t = now - t0, a;
        if (t < D) { var x = t / D; a = target * (1 - Math.pow(1 - x, 3.4)); }
        else if (t < D + W) { var w = (t - D) / 1000; a = target + 7 * Math.exp(-w * 4.2) * Math.sin(w * 26); }
        else { a = target; needle.setAttribute('transform', 'rotate(' + a + ' 150 150)'); return done(); }
        needle.setAttribute('transform', 'rotate(' + a + ' 150 150)');
        raf = requestAnimationFrame(f);
      }
      raf = requestAnimationFrame(f);
    };
    function done() { ctx.finish({ dir: dir }, dir + ' · ' + DIR_KO[dir]); }
    return { destroy: function () { cancelAnimationFrame(raf); } };
  };

  // ---------- 2. 가위바위보 ----------
  G.rps = function (st, ctx) {
    var c = ctx.cfg, rounds = [], H = { r: '✊', s: '✌️', p: '✋' }, N = { r: '바위', s: '가위', p: '보' };
    st.innerHTML = '<div class="center stack"><div class="row" style="justify-content:center;gap:28px"><div><div class="small muted">나</div><div class="rps-hand" id="rp-me">❔</div></div><div style="font-weight:800;color:var(--muted)">VS</div><div><div class="small muted">컴퓨터</div><div class="rps-hand" id="rp-cpu">❔</div></div></div>' +
      '<div id="rp-msg" style="font-weight:700;min-height:24px"></div><div class="row" style="justify-content:center;gap:10px" id="rp-btns">' +
      ['r', 's', 'p'].map(function (k) { return '<button class="btn lg" data-h="' + k + '" style="font-size:28px;min-width:72px">' + H[k] + '</button>'; }).join('') + '</div><div id="rp-log" class="small muted"></div></div>';
    function log() { $('#rp-log', st).textContent = rounds.length + '/' + c.rounds + '판 · ' + rounds.map(function (x) { return { w: '승', d: '무', l: '패' }[x]; }).join(' '); }
    log();
    $$('[data-h]', st).forEach(function (b) {
      b.onclick = function () {
        if (rounds.length >= c.rounds) return;
        var me = b.getAttribute('data-h'), cpu = ['r', 's', 'p'][Math.floor(Math.random() * 3)];
        var res = me === cpu ? 'd' : ((me === 'r' && cpu === 's') || (me === 's' && cpu === 'p') || (me === 'p' && cpu === 'r')) ? 'w' : 'l';
        rounds.push(res);
        $('#rp-me', st).textContent = H[me]; $('#rp-cpu', st).textContent = H[cpu];
        $('#rp-msg', st).innerHTML = rounds.length + '판: ' + N[me] + ' vs ' + N[cpu] + ' → <span style="color:' + (res === 'w' ? 'var(--ok)' : res === 'l' ? 'var(--danger)' : 'var(--muted)') + '">' + { w: '이겼어요!', d: '비겼어요', l: '졌어요' }[res] + '</span>';
        log();
        ctx.partial({ rounds: rounds.slice() });
        if (rounds.length >= c.rounds) { $$('[data-h]', st).forEach(function (x) { x.disabled = true; }); setTimeout(function () { ctx.finish({ rounds: rounds }); }, 700); }
      };
    });
    return { destroy: function () {} };
  };

  // ---------- 3. 지뢰찾기 (추측 없는 판) ----------
  function nbrs(i, n) {
    var r = Math.floor(i / n), c = i % n, out = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
    return out;
  }
  function solvable(mine, n, start) {
    var N = n * n, open = new Uint8Array(N), flag = new Uint8Array(N), cnt = new Array(N), total = 0, left;
    for (var i = 0; i < N; i++) { cnt[i] = nbrs(i, n).filter(function (j) { return mine[j]; }).length; if (mine[i]) total++; }
    left = N - total;
    function reveal(i) {
      var stack = [i];
      while (stack.length) {
        var x = stack.pop();
        if (open[x] || flag[x]) continue;
        if (mine[x]) return false;
        open[x] = 1; left--;
        if (cnt[x] === 0) nbrs(x, n).forEach(function (j) { if (!open[j]) stack.push(j); });
      }
      return true;
    }
    reveal(start);
    var guard = 0;
    while (left > 0 && guard++ < 500) {
      var prog = false, info = [];
      for (var k = 0; k < N; k++) {
        if (!open[k] || cnt[k] === 0) continue;
        var U2 = [], F = 0;
        nbrs(k, n).forEach(function (j) { if (flag[j]) F++; else if (!open[j]) U2.push(j); });
        if (!U2.length) continue;
        var need = cnt[k] - F;
        if (need === 0) { U2.forEach(reveal); prog = true; }
        else if (need === U2.length) { U2.forEach(function (j) { flag[j] = 1; }); prog = true; }
        else info.push({ u: U2, need: need });
      }
      if (prog) continue;
      for (var a = 0; a < info.length && !prog; a++) for (var b = 0; b < info.length && !prog; b++) {
        if (a === b) continue;
        var A = info[a], B = info[b];
        if (A.u.length >= B.u.length || !A.u.every(function (x) { return B.u.indexOf(x) >= 0; })) continue;
        var diff = B.u.filter(function (x) { return A.u.indexOf(x) < 0; }), dn = B.need - A.need;
        if (dn === 0) { diff.forEach(reveal); prog = true; }
        else if (dn === diff.length) { diff.forEach(function (j) { flag[j] = 1; }); prog = true; }
      }
      if (!prog) return false;
    }
    return left === 0;
  }
  function makeBoard(n, m, start) {
    var safe = [start].concat(nbrs(start, n));
    for (var tries = 0; tries < 3000; tries++) {
      var mine = new Uint8Array(n * n), placed = 0;
      while (placed < m) { var x = Math.floor(Math.random() * n * n); if (!mine[x] && safe.indexOf(x) < 0) { mine[x] = 1; placed++; } }
      if (solvable(mine, n, start)) return mine;
    }
    return mine;
  }
  G.mines = function (st, ctx) {
    var c = ctx.cfg, dims = minesDims(c), n = dims.n, M = dims.m, mine = null, open = new Uint8Array(n * n), flag = new Uint8Array(n * n), cnt = [];
    var t0 = 0, timer = 0, over = false, flagMode = false, lp = null, lpFired = false;
    st.innerHTML = '<div class="stack" style="align-items:center"><div class="row" style="width:100%;max-width:420px"><span class="pill">💣 <b id="mn-left">' + M + '</b></span><span class="pill">⏱ <b id="mn-t">0</b>초</span>' +
      '<button class="btn sm right" id="mn-flag">🚩 깃발 모드 끔</button></div><div class="mines" id="mn-grid" style="grid-template-columns:repeat(' + n + ',1fr);width:min(420px,100%)"></div>' +
      '<div class="tiny muted">길게 누르기(또는 오른쪽 클릭) = 깃발 · 숫자 칸을 누르면 주변 한 번에 열기 · 첫 칸은 항상 안전</div></div>';
    var grid = $('#mn-grid', st);
    for (var i = 0; i < n * n; i++) { var b = document.createElement('button'); b.setAttribute('data-i', i); grid.appendChild(b); }
    var cells = $$('button', grid);
    function correct() { var k = 0; if (!mine) return 0; for (var i = 0; i < n * n; i++) if (flag[i] && mine[i]) k++; return k; }
    function draw() {
      var fl = 0;
      cells.forEach(function (b, i) {
        if (flag[i]) fl++;
        if (open[i]) { b.className = 'open' + (cnt[i] ? ' n' + cnt[i] : ''); b.textContent = cnt[i] || ''; }
        else { b.className = ''; b.textContent = flag[i] ? '🚩' : ''; }
      });
      $('#mn-left', st).textContent = M - fl;
    }
    function reveal(i) {
      var stack = [i];
      while (stack.length) {
        var x = stack.pop();
        if (open[x] || flag[x]) continue;
        if (mine[x]) return boom(x);
        open[x] = 1;
        if (cnt[x] === 0) nbrs(x, n).forEach(function (j) { if (!open[j]) stack.push(j); });
      }
      return true;
    }
    function boom(x) {
      over = true; clearInterval(timer);
      var cf = correct();
      cells.forEach(function (b, i) { if (mine[i]) { b.className = i === x ? 'open boom' : 'open'; b.textContent = flag[i] ? '🚩' : '💣'; } else if (flag[i]) { b.textContent = '❌'; } });
      setTimeout(function () { ctx.finish({ success: false, correctFlags: cf }, '지뢰를 밟았어요 · 정답 깃발 ' + cf + '개'); }, 900);
      return false;
    }
    function checkWin() {
      var k = 0; for (var i = 0; i < n * n; i++) if (open[i]) k++;
      if (k === n * n - M) {
        over = true; clearInterval(timer);
        var sec = Math.floor((performance.now() - t0) / 1000);
        cells.forEach(function (b, i) { if (mine[i]) b.textContent = '🚩'; });
        setTimeout(function () { ctx.finish({ success: true, timeSec: sec }, '성공! ' + fmtS(sec)); }, 500);
      }
    }
    function act(i, wantFlag) {
      if (over) return;
      if (!mine) {
        if (wantFlag) return;
        mine = makeBoard(n, M, i);
        for (var k = 0; k < n * n; k++) cnt[k] = nbrs(k, n).filter(function (j) { return mine[j]; }).length;
        t0 = performance.now();
        timer = setInterval(function () { $('#mn-t', st).textContent = Math.floor((performance.now() - t0) / 1000); }, 250);
      }
      if (wantFlag) { if (!open[i]) flag[i] = flag[i] ? 0 : 1; }
      else if (open[i]) {
        var nb = nbrs(i, n), f = nb.filter(function (j) { return flag[j]; }).length;
        if (cnt[i] && f === cnt[i]) for (var q = 0; q < nb.length; q++) { if (!open[nb[q]] && !flag[nb[q]] && !reveal(nb[q])) return; }
      } else if (!flag[i]) { if (!reveal(i)) return; }
      draw();
      ctx.partial({ success: false, correctFlags: correct() });
      checkWin();
    }
    grid.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button'); if (!b || e.button === 2) return;
      lpFired = false;
      lp = setTimeout(function () { lpFired = true; if (navigator.vibrate) navigator.vibrate(15); act(+b.getAttribute('data-i'), true); }, 430);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { grid.addEventListener(ev, function () { clearTimeout(lp); }); });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (lpFired) { lpFired = false; return; }
      act(+b.getAttribute('data-i'), flagMode);
    });
    grid.addEventListener('contextmenu', function (e) { e.preventDefault(); var b = e.target.closest('button'); if (b && !lpFired) act(+b.getAttribute('data-i'), true); lpFired = false; });
    $('#mn-flag', st).onclick = function () { flagMode = !flagMode; this.textContent = '🚩 깃발 모드 ' + (flagMode ? '켬' : '끔'); this.classList.toggle('primary', flagMode); };
    ctx.partial({ success: false, correctFlags: 0 });
    draw();
    return { destroy: function () { clearInterval(timer); clearTimeout(lp); } };
  };

  // ---------- 4. 2048 ----------
  var TILE = { 2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'],
    128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] };
  G.g2048 = function (st, ctx) {
    var b = [], over = false, pops = {};
    for (var i = 0; i < 16; i++) b.push(0);
    st.innerHTML = '<div class="stack" style="align-items:center"><div class="row" style="width:100%;max-width:380px"><span class="pill">최고 타일 <b id="g2-max">2</b></span><button class="btn sm right" id="g2-quit">그만하고 정산</button></div>' +
      '<div class="g2048" id="g2-b"></div><div class="tiny muted">밀어서(스와이프) 또는 방향키로 움직이세요</div></div>';
    var board = $('#g2-b', st);
    for (i = 0; i < 16; i++) board.appendChild(document.createElement('div'));
    var tiles = $$('div', board);
    function add() { var e = []; b.forEach(function (v, i) { if (!v) e.push(i); }); if (!e.length) return; var k = e[Math.floor(Math.random() * e.length)]; b[k] = Math.random() < .9 ? 2 : 4; pops[k] = 1; }
    function max() { return Math.max.apply(null, b); }
    function draw() {
      tiles.forEach(function (t, i) {
        var v = b[i], col = TILE[v] || ['#3c3a32', '#fff'];
        t.className = 't' + (pops[i] ? ' pop' : '');
        t.textContent = v || '';
        t.style.background = v ? col[0] : '';
        t.style.color = col[1];
        t.style.fontSize = v >= 1024 ? 'clamp(15px,5vw,24px)' : '';
      });
      pops = {};
      $('#g2-max', st).textContent = max();
      ctx.partial({ maxTile: max() });
    }
    function line(idxs) {
      var vals = idxs.map(function (i) { return b[i]; }).filter(Boolean), out = [], moved = false;
      for (var i = 0; i < vals.length; i++) {
        if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); i++; } else out.push(vals[i]);
      }
      while (out.length < 4) out.push(0);
      idxs.forEach(function (ix, k) { if (b[ix] !== out[k]) { moved = true; if (out[k] && out[k] !== b[ix] && b[ix]) pops[ix] = 1; b[ix] = out[k]; } });
      return moved;
    }
    function move(d) {
      if (over) return;
      var moved = false;
      for (var r = 0; r < 4; r++) {
        var idx = [];
        for (var c = 0; c < 4; c++) {
          if (d === 'L') idx.push(r * 4 + c); else if (d === 'R') idx.push(r * 4 + 3 - c);
          else if (d === 'U') idx.push(c * 4 + r); else idx.push((3 - c) * 4 + r);
        }
        if (line(idx)) moved = true;
      }
      if (moved) { add(); draw(); if (stuck()) end('더 이상 움직일 수 없어요'); }
    }
    function stuck() {
      for (var i = 0; i < 16; i++) {
        if (!b[i]) return false;
        if (i % 4 < 3 && b[i] === b[i + 1]) return false;
        if (i < 12 && b[i] === b[i + 4]) return false;
      }
      return true;
    }
    function end(msg) { over = true; ctx.finish({ maxTile: max() }, msg + ' · 최고 타일 ' + max()); }
    function key(e) { var d = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }[e.key]; if (d) { e.preventDefault(); move(d); } }
    document.addEventListener('keydown', key);
    var sx = 0, sy = 0, down = false;
    board.addEventListener('pointerdown', function (e) { down = true; sx = e.clientX; sy = e.clientY; });
    board.addEventListener('pointerup', function (e) {
      if (!down) return; down = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
    });
    $('#g2-quit', st).onclick = async function () { if (await NC.confirm('지금 최고 타일(' + max() + ')로 정산할까요?')) end('중도 포기'); };
    add(); add(); draw();
    return { destroy: function () { document.removeEventListener('keydown', key); } };
  };

  // ---------- 5. 메트로놈 타이밍 ----------
  function judgeBoard(counts) {
    return '<div class="judge-board">' + ['PERFECT', 'GREAT', 'GOOD', 'MISS'].map(function (k) {
      var s = String(counts[k] || 0), z = '0000'.slice(s.length);
      return '<div class="jr"><span class="pjsk ' + k + '">' + k + '</span><span class="c"><span class="z">' + z + '</span>' + s + '</span></div>';
    }).join('') + '</div>';
  }
  G.metronome = function (st, ctx) {
    var c = ctx.cfg, beat = c.beatMs, deltas = [], counts = {}, t0 = 0, raf = 0, running = false, sound = false, ac = null, lastK = -1, ended = false;
    var stage = st.closest('.game-stage'); if (stage) stage.classList.add('dark');
    st.innerHTML = '<div class="stack" style="align-items:center"><div class="row" style="width:100%;max-width:440px"><span class="pill" style="background:rgba(255,255,255,.12);color:#fff">탭 <b id="mt-n">0</b>/' + c.taps + '</span>' +
      '<label class="check right" style="color:#cfd6ff;font-size:13px"><input type="checkbox" id="mt-snd">박자 소리</label></div>' +
      '<div style="position:relative;width:100%;max-width:440px"><canvas class="game-cv" id="mt-cv" width="880" height="560" style="background:#1b2146"></canvas>' +
      '<div id="mt-j" class="pjsk" style="position:absolute;left:0;right:0;top:58%;text-align:center;font-size:clamp(30px,9vw,46px);pointer-events:none;opacity:0;transition:opacity .25s"></div></div>' +
      '<button class="btn lg" id="mt-go" style="min-width:200px">시작</button><div style="width:100%;max-width:340px" id="mt-board">' + judgeBoard(counts) + '</div>' +
      '<div class="tiny" style="color:#aab3dc">진자가 가운데 판정선을 지나는 순간 화면(또는 스페이스바)을 누르세요. 원하는 박을 골라 ' + c.taps + '번!</div></div>';
    var cv = $('#mt-cv', st), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    var px = W / 2, py = 40, L = H - 150, A = 0.52;
    function phase(now) { return (now - t0) / beat; }
    function draw(now) {
      g.clearRect(0, 0, W, H);
      // 판정선
      var grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(126,240,220,.0)'); grd.addColorStop(.5, 'rgba(211,166,255,.9)'); grd.addColorStop(1, 'rgba(255,241,154,.0)');
      g.fillStyle = grd; g.fillRect(px - 3, 20, 6, H - 40);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px - 26, 20, 52, H - 40);
      // 눈금
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
      for (var k = -3; k <= 3; k++) { var a = k * A / 3; g.beginPath(); g.moveTo(px + Math.sin(a) * (L + 18), py + Math.cos(a) * (L + 18)); g.lineTo(px + Math.sin(a) * (L + 34), py + Math.cos(a) * (L + 34)); g.stroke(); }
      var th = running ? A * Math.cos(Math.PI * phase(now)) : A;
      var bx = px + Math.sin(th) * L, by = py + Math.cos(th) * L;
      g.strokeStyle = '#e9edff'; g.lineWidth = 6; g.beginPath(); g.moveTo(px, py); g.lineTo(bx, by); g.stroke();
      g.fillStyle = '#c99a46'; g.beginPath(); g.arc(px, py, 12, 0, 7); g.fill();
      var bg = g.createRadialGradient(bx - 8, by - 8, 4, bx, by, 34);
      bg.addColorStop(0, '#fff6d8'); bg.addColorStop(1, '#e0a63d');
      g.fillStyle = bg; g.beginPath(); g.arc(bx, by, 32, 0, 7); g.fill();
      if (running && sound) {
        var kk = Math.floor(phase(now) - 0.5);
        if (kk > lastK && kk >= 0) { lastK = kk; click(); }
      }
    }
    function click() {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        var o = ac.createOscillator(), gn = ac.createGain();
        o.frequency.value = 1500; gn.gain.setValueAtTime(.25, ac.currentTime); gn.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .05);
        o.connect(gn); gn.connect(ac.destination); o.start(); o.stop(ac.currentTime + .06);
      } catch (e) {}
    }
    function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
    function tap(ts) {
      if (!running || ended || deltas.length >= c.taps) return;
      var ph = phase(ts);
      var k = Math.max(0, Math.round(ph - 0.5));
      var d = (ph - (k + 0.5)) * beat;
      deltas.push(Math.round(d * 10) / 10);
      var j = judge(d, c);
      counts[j] = (counts[j] || 0) + 1;
      var el = $('#mt-j', st);
      el.className = 'pjsk ' + j; el.textContent = j; el.style.transition = 'none'; el.style.opacity = '1';
      setTimeout(function () { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; }, 380);
      $('#mt-board', st).innerHTML = judgeBoard(counts);
      $('#mt-n', st).textContent = deltas.length;
      ctx.partial({ deltas: pad(deltas) });
      if (deltas.length >= c.taps) {
        ended = true;
        setTimeout(function () {
          running = false;
          ctx.finish({ deltas: deltas }, deltas.map(function (x) { return judge(x, c); }).join(' · '));
        }, 900);
      }
    }
    function pad(arr) { var a = arr.slice(); while (a.length < c.taps) a.push(null); return a; }
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); tap(e.timeStamp || performance.now()); });
    function key(e) { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (!e.repeat) tap(e.timeStamp || performance.now()); } }
    document.addEventListener('keydown', key);
    $('#mt-snd', st).onchange = function () { sound = this.checked; if (sound) click(); };
    $('#mt-go', st).onclick = function () {
      this.disabled = true; this.textContent = '진행 중 — 판정선에 맞춰 탭!';
      t0 = performance.now(); lastK = -1; running = true;
      ctx.partial({ deltas: pad(deltas) });
    };
    ctx.partial({ deltas: pad([]) });
    return { destroy: function () { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); try { if (ac) ac.close(); } catch (e) {} } };
  };

  // ---------- 6. 다트 ----------
  var DART_NUMS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  function dartScore(dx, dy, R) {
    var r = Math.sqrt(dx * dx + dy * dy) / R * 170;
    if (r > 170) return { s: 0, l: 'MISS' };
    if (r <= 15.9) return { s: 50, l: 'BULL' };
    var ang = (Math.atan2(dx, -dy) * 180 / Math.PI + 360 + 9) % 360;
    var num = DART_NUMS[Math.floor(ang / 18)];
    var dbl = (r >= 162) || (r >= 99 && r <= 107);
    return dbl ? { s: num * 2, l: 'D' + num } : { s: num, l: 'S' + num };
  }
  G.darts = function (st, ctx) {
    var c = ctx.cfg, throws = [], labels = [], hits = [], raf = 0, t0 = performance.now(), ph1 = Math.random() * 6, ph2 = Math.random() * 6, frozen = false;
    st.innerHTML = '<div class="stack" style="align-items:center"><div class="row" style="width:100%;max-width:440px"><span class="pill">다트 <b id="dt-n">0</b>/' + c.throws + '</span><span class="pill right">합계 <b id="dt-s">0</b></span></div>' +
      '<canvas class="game-cv" id="dt-cv" width="800" height="800" style="background:#14192e"></canvas><button class="btn primary lg" id="dt-go" style="min-width:200px">던지기!</button><div id="dt-log" class="small muted"></div></div>';
    var cv = $('#dt-cv', st), g = cv.getContext('2d'), W = cv.width, cx = W / 2, cy = W / 2, R = W * 0.4;
    function rr(v) { return v / 170 * R; }
    function board() {
      g.fillStyle = '#14192e'; g.fillRect(0, 0, W, W);
      g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, R * 1.18, 0, 7); g.fill();
      for (var i = 0; i < 20; i++) {
        var a0 = (i * 18 - 9 - 90) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180;
        var ring = i % 2 ? '#1f8a4c' : '#d6353d', single = i % 2 ? '#f3e6c4' : '#1a1a1a';
        [[170, 162, ring], [162, 107, single], [107, 99, ring], [99, 15.9, single]].forEach(function (x) {
          g.fillStyle = x[2]; g.beginPath(); g.arc(cx, cy, rr(x[0]), a0, a1); g.arc(cx, cy, rr(x[1]), a1, a0, true); g.closePath(); g.fill();
        });
        var la = (i * 18 - 90) * Math.PI / 180;
        g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(W * 0.042) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(DART_NUMS[i], cx + Math.cos(la) * R * 1.09, cy + Math.sin(la) * R * 1.09);
      }
      g.fillStyle = '#1f8a4c'; g.beginPath(); g.arc(cx, cy, rr(15.9), 0, 7); g.fill();
      g.fillStyle = '#d6353d'; g.beginPath(); g.arc(cx, cy, rr(6.35), 0, 7); g.fill();
      hits.forEach(function (h) {
        g.fillStyle = '#ffd25e'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.arc(h[0], h[1], 11, 0, 7); g.fill(); g.stroke();
      });
    }
    function aim(now) {
      var t = (now - t0) / 1000, sp = c.speed || 0.55;
      return [cx + R * 0.78 * Math.sin(t * 1.3 * sp + ph1) + R * 0.06 * Math.sin(t * 3.1 * sp), cy + R * 0.78 * Math.sin(t * 1.75 * sp + ph2) + R * 0.06 * Math.cos(t * 2.7 * sp)];
    }
    var cur = [cx, cy];
    function loop(now) {
      board();
      if (!frozen) cur = aim(now);
      g.strokeStyle = '#7ef0dc'; g.lineWidth = 4;
      g.beginPath(); g.arc(cur[0], cur[1], 22, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(cur[0] - 34, cur[1]); g.lineTo(cur[0] + 34, cur[1]); g.moveTo(cur[0], cur[1] - 34); g.lineTo(cur[0], cur[1] + 34); g.stroke();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    function shoot() {
      if (throws.length >= c.throws || frozen) return;
      var p = aim(performance.now()), sc = dartScore(p[0] - cx, p[1] - cy, R);
      throws.push(sc.s); labels.push(sc.l + ' ' + sc.s); hits.push(p);
      frozen = true; cur = p;
      $('#dt-n', st).textContent = throws.length;
      $('#dt-s', st).textContent = throws.reduce(function (a, b) { return a + b; }, 0);
      $('#dt-log', st).textContent = labels.join(' · ');
      ctx.partial({ throws: throws.slice(), labels: labels.slice() });
      if (throws.length >= c.throws) { $('#dt-go', st).disabled = true; setTimeout(function () { ctx.finish({ throws: throws, labels: labels }, labels.join(' · ')); }, 900); }
      else setTimeout(function () { frozen = false; t0 = performance.now(); ph1 = Math.random() * 6; ph2 = Math.random() * 6; }, 900);
    }
    $('#dt-go', st).onclick = shoot;
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); shoot(); });
    ctx.partial({ throws: [], labels: [] });
    return { destroy: function () { cancelAnimationFrame(raf); } };
  };

  // ---------- 7. 보물상자 ----------
  G.treasure = function (st, ctx) {
    st.innerHTML = '<div class="center stack"><div class="small muted">상자 하나를 골라 여세요</div><div class="row" style="justify-content:center;gap:10px">' +
      [0, 1, 2].map(function (i) { return '<button class="chest" data-b="' + i + '">🎁</button>'; }).join('') + '</div><div id="tr-r" style="min-height:30px"></div></div>';
    ctx.partial({ box: 0 });
    $$('[data-b]', st).forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-b');
        $$('[data-b]', st).forEach(function (x) { x.disabled = true; if (x !== b) x.style.opacity = '.3'; });
        b.classList.add('picked');
        var k = 0, iv = setInterval(function () { b.style.transform = 'rotate(' + (k % 2 ? 8 : -8) + 'deg) scale(1.1)'; if (++k > 7) { clearInterval(iv); b.style.transform = 'scale(1.15)'; b.textContent = '✨'; $('#tr-r', st).innerHTML = '<b style="font-size:22px;color:var(--accent)">' + ctx.preset.value + ' 파이!</b>'; setTimeout(function () { ctx.finish({ box: i }, '상자 ' + (i + 1) + ' → ' + ctx.preset.value); }, 700); } }, 110);
        ctx.partial({ box: i });
      };
    });
    return { destroy: function () {} };
  };

  // ---------- 8. 스톱워치 ----------
  G.stopwatch = function (st, ctx) {
    var c = ctx.cfg, t0 = 0, state = 0;
    st.innerHTML = '<div class="center stack"><div class="small muted">목표: 정확히 <b>' + c.targetSec.toFixed(2) + '초</b></div><div class="big-num" id="sw-d">0.00</div>' +
      '<button class="btn primary lg" id="sw-b" style="min-width:200px;margin:0 auto">시작</button><div class="tiny muted">스페이스바로도 할 수 있어요</div><div id="sw-r"></div></div>';
    var btn = $('#sw-b', st), disp = $('#sw-d', st);
    ctx.partial({ stopped: false });
    function press(ts) {
      if (state === 0) { state = 1; t0 = ts; btn.textContent = '멈추기!'; btn.className = 'btn danger fill lg'; disp.textContent = '??.??'; disp.style.color = 'var(--muted)'; }
      else if (state === 1) {
        state = 2;
        var ms = ts - t0, err = (ms - c.targetSec * 1000) / 1000;
        btn.disabled = true; btn.textContent = '완료';
        disp.textContent = (ms / 1000).toFixed(2); disp.style.color = '';
        $('#sw-r', st).innerHTML = '오차 <b>' + (err >= 0 ? '+' : '') + err.toFixed(3) + '초</b>';
        ctx.finish({ stopped: true, elapsedMs: Math.round(ms) }, (ms / 1000).toFixed(2) + '초 (오차 ' + (err >= 0 ? '+' : '') + err.toFixed(2) + ')');
      }
    }
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); press(e.timeStamp || performance.now()); });
    function key(e) { if ((e.code === 'Space' || e.key === ' ') && !e.repeat) { e.preventDefault(); press(e.timeStamp || performance.now()); } }
    document.addEventListener('keydown', key);
    return { destroy: function () { document.removeEventListener('keydown', key); } };
  };

  // ---------- 9. 카드 짝맞추기 ----------
  var STAR_BACK = "url('data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#1e2a4a"/><path d="M20 4 23 17 36 20 23 23 20 36 17 23 4 20 17 17z" fill="#c99a46" opacity=".85"/><path d="M20 11 21.5 18.5 29 20 21.5 21.5 20 29 18.5 21.5 11 20 18.5 18.5z" fill="#f3f0e6" opacity=".5" transform="rotate(45 20 20)"/><circle cx="20" cy="20" r="2" fill="#f3f0e6"/></svg>') + "')";
  G.cards = function (st, ctx) {
    var c = ctx.cfg, deck = [], tries = 0, pairs = 0, open = [], lock = false, done = {}, over = false;
    PICS.forEach(function (p, i) { deck.push(i, i); });
    for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    st.innerHTML = '<div class="stack" style="align-items:center"><div class="row" style="width:100%;max-width:400px"><span class="pill">시도 <b id="cd-t">0</b>/' + c.maxTries + '</span><span class="pill right">찾은 쌍 <b id="cd-p">0</b>/8</span></div>' +
      '<div class="cards" id="cd-g">' + deck.map(function (v, i) { return '<div class="card-t" data-i="' + i + '"><div class="b" style="background-image:' + STAR_BACK + ';background-size:48%;background-repeat:space;background-position:center"></div><div class="f" title="' + PIC_NAMES[v] + '">' + PICS[v] + '</div></div>'; }).join('') + '</div></div>';
    var cards = $$('.card-t', st);
    ctx.partial({ success: false, tries: 0, pairs: 0 });
    cards.forEach(function (el) {
      el.onclick = function () {
        var i = +el.getAttribute('data-i');
        if (lock || over || done[i] || open.indexOf(i) >= 0) return;
        el.classList.add('flip'); open.push(i);
        if (open.length < 2) return;
        tries++;
        $('#cd-t', st).textContent = tries;
        var a = open[0], b = open[1];
        if (deck[a] === deck[b]) {
          done[a] = done[b] = 1; pairs++; open = [];
          cards[a].classList.add('done'); cards[b].classList.add('done');
          $('#cd-p', st).textContent = pairs;
          ctx.partial({ success: false, tries: tries, pairs: pairs });
          if (pairs === 8) { over = true; setTimeout(function () { ctx.finish({ success: true, tries: tries, pairs: 8 }, tries + '번 시도로 성공!'); }, 500); return; }
        } else {
          lock = true;
          setTimeout(function () { cards[a].classList.remove('flip'); cards[b].classList.remove('flip'); open = []; lock = false; }, 750);
        }
        ctx.partial({ success: false, tries: tries, pairs: pairs });
        if (tries >= c.maxTries && pairs < 8) { over = true; setTimeout(function () { ctx.finish({ success: false, tries: tries, pairs: pairs }, '시도 횟수를 다 썼어요 · ' + pairs + '쌍'); }, 800); }
      };
    });
    return { destroy: function () {} };
  };

  // ---------- 10. 업다운 ----------
  G.updown = function (st, ctx) {
    var c = ctx.cfg, ans = 1 + Math.floor(Math.random() * c.max), n = 0, hist = [], over = false;
    st.innerHTML = '<div class="center stack" style="max-width:360px;margin:0 auto"><div class="small muted">1 ~ ' + c.max + ' 사이의 숫자를 맞혀보세요 · <b id="ud-n">0</b>/' + c.guesses + '번</div>' +
      '<div class="big-num" id="ud-h" style="font-size:40px">?</div><div class="row"><input class="input grow" type="number" inputmode="numeric" id="ud-i" min="1" max="' + c.max + '" placeholder="숫자 입력"><button class="btn primary" id="ud-go">확인</button></div>' +
      '<div id="ud-log" class="chips" style="justify-content:center"></div></div>';
    ctx.partial({ success: false, guesses: 0 });
    function go() {
      if (over) return;
      var v = Math.round(+$('#ud-i', st).value);
      if (!v || v < 1 || v > c.max) return NC.toast('1~' + c.max + ' 사이 숫자를 입력하세요.', 'err');
      n++;
      $('#ud-n', st).textContent = n;
      var h = $('#ud-h', st);
      if (v === ans) { over = true; h.textContent = '🎉 ' + v; h.style.color = 'var(--ok)'; ctx.finish({ success: true, guesses: n }, n + '번 만에 맞혔어요!'); return; }
      hist.push([v, v < ans ? 'UP' : 'DOWN']);
      h.textContent = v < ans ? 'UP ⬆' : 'DOWN ⬇'; h.style.color = v < ans ? '#e0565b' : '#3266d8';
      $('#ud-log', st).innerHTML = hist.map(function (x) { return '<span class="chip">' + x[0] + ' ' + (x[1] === 'UP' ? '⬆' : '⬇') + '</span>'; }).join('');
      $('#ud-i', st).value = ''; $('#ud-i', st).focus();
      ctx.partial({ success: false, guesses: n });
      if (n >= c.guesses) { over = true; h.textContent = '정답 ' + ans; ctx.finish({ success: false, guesses: n }, c.guesses + '번 안에 못 맞혔어요 (정답 ' + ans + ')'); }
    }
    $('#ud-go', st).onclick = go;
    $('#ud-i', st).onkeydown = function (e) { if (e.key === 'Enter') go(); };
    return { destroy: function () {} };
  };

  // ============================================================
  // 진행 중인 플레이 보관 (중도 이탈 처리)
  // ============================================================
  var KEY = 'nc_play';
  function store(o) { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (e) {} }
  function stored() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  window.addEventListener('pagehide', function () {
    var p = stored();
    if (p && p.playId && NC.token) { NC.beacon('game.finish', { playId: p.playId, result: p.partial || {}, abandoned: true }); store(null); }
  });
  async function recover() {
    var p = stored();
    if (!p || !p.playId) return;
    store(null);
    try { var r = await NC.api('game.finish', { playId: p.playId, result: p.partial || {}, abandoned: true }); if (!r.already) NC.toast('중간에 나간 미니게임을 그 시점 결과로 처리했어요 (+' + r.pie + ' 파이)'); NC.refreshMe(); } catch (e) {}
  }

  // ============================================================
  // 게임 화면
  // ============================================================
  NC.pages.games = async function (el, q, alive) {
    var S = await NC.api('game.state');
    if (!alive()) return;
    var active = null, cur = S.games[0] || null;
    function cfgOf(g) { return (S.cfgs && S.cfgs[g]) || S.cfg; }
    function head() {
      var bonusHint = S.chances.bonus === 0 && S.chances.bonusAvailable > 0 ? '<div class="banner" style="margin-top:12px">📚 오늘 공부인증을 체크하면 기회가 ' + S.chances.bonusAvailable + '회 늘어나요! <a href="#/home" class="right small">체크하러 가기 ›</a></div>' : '';
      var title = S.games.length ? S.gameNames.join(' / ') : '오늘은 쉬어요';
      return '<div class="card"><div class="game-hero"><div class="gi' + (S.games.length > 1 ? ' two' : '') + '">' + (S.games.map(function (g) { return EMOJI[g]; }).join('') || '🎮') + '</div><div class="grow"><div class="small muted">오늘의 미니게임 · ' + U.mdw(S.date) + (S.games.length > 1 ? ' · 도전할 때마다 둘 중 하나를 골라요' : '') + '</div><h2 style="font-size:21px">' + esc(title) + '</h2>' +
        (S.games.length === 1 ? '<div class="small" style="color:var(--ink-2);margin-top:2px">' + descOf(S.games[0], cfgOf(S.games[0])) + '</div>' : '') + '</div></div>' +
        '<div class="grid3" style="margin-top:14px"><div class="stat"><div class="k">남은 기회</div><div class="v num">' + S.remaining + '<small>/ ' + S.chances.total + '</small></div></div>' +
        '<div class="stat"><div class="k">오늘 획득</div><div class="v num">' + S.earned + '<small>/ ' + S.maxPerDay + '</small></div></div>' +
        (S.chances.extra ? '<div class="stat"><div class="k">운영진이 준 기회</div><div class="v num">' + (S.chances.extra > 0 ? '+' : '') + S.chances.extra + '</div></div>' : '') + '</div>' + bonusHint + '</div>';
    }
    function picker() {
      if (S.games.length < 2) return '';
      return '<div class="game-pick">' + S.games.map(function (g) {
        return '<button class="game-opt' + (g === cur ? ' on' : '') + '" data-g="' + g + '"><span class="e">' + EMOJI[g] + '</span><span class="n">' + esc(NC.gameNames[g] || g) + '</span><span class="d">' + esc(descOf(g, cfgOf(g))) + '</span></button>';
      }).join('') + '</div>';
    }
    function draw() {
      el.innerHTML = '<div class="stack">' + head() + (S.games.length ? picker() + '<div class="grid2" style="align-items:start"><div class="stack"><div class="game-stage" id="gs"></div></div>' +
        '<div class="stack"><div class="card"><div class="card-head"><h2>보상표' + (S.games.length > 1 ? ' · ' + esc(NC.gameNames[cur] || '') : '') + '</h2><span class="small muted">1회 최대 ' + S.maxPerPlay + '</span></div>' + rewardTable(cur, cfgOf(cur), S.maxPerPlay) + '</div>' +
        '<div class="card"><div class="card-head"><h2>오늘 기록</h2></div>' + (S.plays.length ? '<div class="list">' + S.plays.map(function (p) {
          return '<div class="li"><span class="pill">' + p.round + '회차</span>' + (S.games.length > 1 ? '<span class="small">' + EMOJI[p.game] + '</span>' : '') + '<span class="grow small">' + esc(p.resultText || '') + '</span><b class="' + (p.pie ? 'plus' : '') + '">' + (p.status === 'done' ? '+' + p.pie : '진행 중') + '</b></div>';
        }).join('') + '</div>' : '<div class="small muted">아직 도전하지 않았어요</div>') + '</div>' +
        '<div class="card small muted">• 시작하면 기회가 1회 소진돼요. 도중에 나가면 그 시점의 결과로 처리돼요.<br>• 기회는 하루가 바뀌면 초기화돼요. 데이오프인 날에도 할 수 있어요.<br>• 기회를 다 쓰면 연습 모드로 계속 즐길 수 있어요 (파이 없음).</div></div></div>' : '<div class="card empty">오늘은 열린 게임이 없어요.</div>') + '</div>';
      $$('[data-g]', el).forEach(function (b) { b.onclick = function () { if (active) return; cur = b.getAttribute('data-g'); draw(); }; });
      if (S.games.length) lobby();
    }
    function lobby() {
      var gs = $('#gs');
      gs.className = 'game-stage';
      gs.innerHTML = '<div class="center stack" style="padding:20px 0"><div style="font-size:64px">' + EMOJI[cur] + '</div><div style="font-weight:700">' + esc(NC.gameNames[cur] || '') + '</div>' +
        (S.remaining > 0 ? '<button class="btn primary lg" id="g-start" style="margin:0 auto;min-width:220px">도전하기 (' + (S.used + 1) + '회차)</button><div class="tiny muted">누르는 순간 기회 1회가 사용돼요</div>'
          : '<div class="small muted">오늘 기회를 모두 썼어요</div>') +
        '<button class="btn' + (S.remaining > 0 ? ' ghost' : ' primary lg') + '" id="g-practice" style="margin:0 auto">연습 모드' + (S.remaining > 0 ? ' (파이 없음)' : '로 하기') + '</button></div>';
      if ($('#g-start')) $('#g-start').onclick = start;
      $('#g-practice').onclick = function () { play({ practice: true, game: cur, preset: practicePreset(cur), cfg: cfgOf(cur) }); };
    }
    function practicePreset(g) {
      if (g === 'roulette') return { dir: DIRS[Math.floor(Math.random() * 8)] };
      if (g === 'treasure') { var v = cfgOf(g).values; return { value: v[Math.floor(Math.random() * v.length)] }; }
      return {};
    }
    async function start() {
      var b = $('#g-start'); b.disabled = true;
      try {
        var r = await NC.api('game.start', { game: cur });
        store({ playId: r.playId, game: r.game, partial: {} });
        play({ practice: false, game: r.game, preset: r.preset, cfg: r.cfg, playId: r.playId, round: r.round });
      } catch (e) { NC.err(e); b.disabled = false; S = await NC.api('game.state'); if (alive()) { if (S.games.indexOf(cur) < 0) cur = S.games[0] || null; draw(); } }
    }
    function play(o) {
      var gs = $('#gs');
      gs.className = 'game-stage';
      $$('[data-g]', el).forEach(function (b) { b.disabled = true; });
      gs.innerHTML = '<div class="row" style="margin-bottom:10px"><span class="badge ' + (o.practice ? 'soft' : 'lead') + '">' + (o.practice ? '연습 모드' : o.round + '회차 도전') + '</span>' +
        (S.games.length > 1 ? '<span class="small">' + EMOJI[o.game] + ' ' + esc(NC.gameNames[o.game] || '') + '</span>' : '') +
        (o.practice ? '<button class="btn sm ghost right" id="g-exit">나가기</button>' : '') + '</div><div id="g-area"></div>';
      var area = $('#g-area'), finished = false, partial = {};
      var inst;
      var ctx = {
        cfg: o.cfg, preset: o.preset, practice: o.practice,
        partial: function (r) { partial = r; if (!o.practice) { var s = stored(); if (s && s.playId === o.playId) { s.partial = r; store(s); } } },
        finish: async function (r, text) {
          if (finished) return; finished = true;
          active = null;
          var pie;
          if (o.practice) pie = calc(o.game, r, o.preset, o.cfg, S.maxPerPlay);
          else {
            try { var res = await NC.api('game.finish', { playId: o.playId, result: r }); pie = res.pie; store(null); NC.me.balance = res.balance; NC.updateShellMe(); }
            catch (e) { NC.err(e); pie = null; }
          }
          var box = document.createElement('div');
          box.className = 'result-box';
          box.innerHTML = (text ? '<div class="small" style="opacity:.85">' + esc(text) + '</div>' : '') +
            (pie === null ? '<div class="small">결과 저장에 실패했어요. 다음에 접속할 때 다시 시도해요.</div>' : o.practice ? '<div class="small muted">연습 모드 · 실전이었다면</div><div class="pie">' + pie + '<small> 파이</small></div>' : '<div class="pie">+' + pie + '<small> 파이</small></div>') +
            '<button class="btn primary" id="g-back" style="margin-top:10px">확인</button>';
          gs.appendChild(box);
          box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          $('#g-back', box).onclick = async function () { if (inst) inst.destroy(); S = await NC.api('game.state'); if (alive()) { if (S.games.indexOf(cur) < 0) cur = S.games[0] || null; draw(); } };
        }
      };
      inst = G[o.game](area, ctx);
      active = { o: o, inst: inst, getPartial: function () { return partial; }, finished: function () { return finished; } };
      if ($('#g-exit')) $('#g-exit').onclick = function () { inst.destroy(); active = null; $$('[data-g]', el).forEach(function (b) { b.disabled = false; }); lobby(); };
    }
    NC.cleanup = function () {
      if (!active) return;
      active.inst.destroy();
      if (!active.o.practice && !active.finished()) {
        var p = active.o.playId, r = active.getPartial();
        store(null);
        NC.api('game.finish', { playId: p, result: r, abandoned: true }).then(function (x) { NC.toast('게임을 나가서 그 시점 결과로 처리했어요 (+' + x.pie + ' 파이)'); NC.refreshMe(); }).catch(function () {});
      }
      active = null;
    };
    draw();
  };

  NC.games = { emoji: function (g) { return EMOJI[g] || '🎮'; }, describe: describe, recover: recover, calc: calc, G: G };
})();
