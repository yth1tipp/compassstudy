/* 체험판 예시 데이터 (지난주 월요일부터 오늘까지의 활동을 만들어 둡니다) */
window.NC_SEED = async function () {
  var SV = window.NC_SERVER, KST = 9 * 3600000;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(ms) { var d = new Date(ms + KST); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(s) { return (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; }
  function weekOf(s) { return addDays(s, -dow(s)); }
  function kstAt(s, h) { return Date.parse(s + 'T00:00:00Z') - KST + h * 3600000; }
  var real = Date.now(), cur = real;
  SV.setClock(function () { return cur; });
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  async function call(action, params, token) {
    var r = await SV.handle(JSON.stringify(Object.assign({ action: action, token: token }, params || {})));
    return r.ok ? r.data : null;
  }
  function at(date, h, m) { cur = kstAt(date, h) + (m || 0) * 60000; }
  try {
    var today = ymd(real), thisWeek = weekOf(today), start = addDays(thisWeek, -7);
    at(start, 8);
    var A = (await call('auth.login', { id: 'admin', pw: 'admin1234' })).token;
    A = (await call('me.password', { oldPw: 'admin1234', newPw: '1234' }, A)).token;
    var people = [
      ['lead', '한서윤', ['lead'], true, false], ['sub', '정도윤', ['sub'], false, true], ['sup', '윤하린', ['sup'], false, true],
      ['mentor1', '강지후', [], true, false], ['m1', '김민지', [], false, true], ['m2', '이준호', [], false, true],
      ['m3', '박서연', [], true, true], ['m4', '최유나', [], false, true], ['m5', '오태민', [], false, true]
    ];
    await call('members.bulk', { members: people.map(function (p) { return { id: p[0], name: p[1], password: '1234', ops: p[2], mentor: p[3], mentee: p[4], insta: 'study_' + p[0] }; }) }, A);
    var tok = {};
    for (var i = 0; i < people.length; i++) tok[people[i][0]] = (await call('auth.login', { id: people[i][0], pw: '1234' })).token;
    var SUB = tok.sub;
    var weeks = [start, thisWeek];
    for (i = 0; i < 2; i++) {
      await call('quests.save', { quest: { type: 'daily', week: weeks[i], title: i ? '오늘 공부 계획 플래너 사진 올리기' : '좋은 글귀 한 줄 필사', desc: '인스타 인증방에 #데일리퀘스트 태그와 함께 올려주세요.' } }, SUB);
      await call('quests.save', { quest: { type: 'weekly', week: weeks[i], title: i ? '이번 주 공부 회고 3줄 쓰기' : '오답노트 5문제 정리', desc: '일요일까지 인증방에 올리고 사이트에서 체크하세요.' } }, SUB);
    }
    await call('quests.save', { quest: { type: 'daily', week: thisWeek, dow: 2, title: '수요일 특별: 책상 정리 전후 사진', desc: '깨끗해진 책상을 보여주세요!' } }, SUB);
    // 날짜별 미니게임: 이번 주는 매일 정해 두고, 주말은 2개 중 고르기
    var days = {}, order = ['roulette', 'rps', 'mines', 'g2048', 'metronome', 'darts', 'treasure', 'stopwatch', 'cards', 'updown'];
    for (i = 0; i < 14; i++) { var dd = addDays(thisWeek, i); days[dd] = dow(dd) >= 5 ? [order[i % 10], order[(i + 3) % 10]] : [order[i % 10]]; }
    days[today] = ['roulette', 'treasure'];
    await call('game.schedule', { days: days }, SUB);
    await call('shop.save', { product: { name: '경고 차감권', desc: '구매 즉시 경고 1회가 차감됩니다.', price: 800, type: 'warn', stock: null, limitType: 'weekly', limitN: 1 } }, A);
    await call('shop.save', { product: { name: '아메리카노 기프티콘', desc: '구매 후 운영진이 인스타 DM으로 보내드려요.', price: 2500, stock: 5, limitType: 'total', limitN: 1 } }, A);
    await call('shop.save', { product: { name: '공부 플레이리스트 신청권', desc: '다음 주 단체 공부방 BGM을 고를 수 있어요.', price: 300, stock: null, limitType: 'none', limitN: 0 } }, A);
    await call('shop.save', { product: { name: '나침반 스티커 세트', desc: '오프라인 모임 때 전달됩니다.', price: 1200, stock: 0, limitType: 'none', limitN: 0 } }, A);

    var ids = people.map(function (p) { return p[0]; }), mentee = {};
    people.forEach(function (p) { mentee[p[0]] = p[4]; });
    var habit = { lead: .9, sub: .95, sup: .85, mentor1: .7, m1: .97, m2: .8, m3: .9, m4: .75, m5: .55 };
    for (var d = start; d <= today; d = addDays(d, 1)) {
      var isToday = d === today;
      for (var k = 0; k < ids.length; k++) {
        var id = ids[k], h = habit[id];
        if (isToday) cur = real - (ids.length - k) * 60000;
        else at(d, 19 + Math.floor(rnd() * 4), Math.floor(rnd() * 59));
        if (rnd() < h) await call('mission.mark', { date: d, mission: 'attend' }, tok[id]);
        if (rnd() < (mentee[id] ? h : .5)) await call('mission.mark', { date: d, mission: 'study' }, tok[id]);
        if (rnd() < (mentee[id] ? h - .1 : .3)) await call('mission.mark', { date: d, mission: 'problem' }, tok[id]);
        if (rnd() < .45) await call('mission.mark', { date: d, mission: 'mentoring' }, tok[id]);
        if (rnd() < h - .15) await call('mission.mark', { date: d, mission: 'hours', inputMin: 60 + Math.floor(rnd() * 420) }, tok[id]);
        if (rnd() < .55) await call('mission.mark', { date: d, mission: 'daily' }, tok[id]);
        if (dow(d) === 5 && rnd() < .6) await call('mission.mark', { date: d, mission: 'weekly' }, tok[id]);
      }
      // 그제 이전 날짜는 운영진이 판정 완료, 어제 · 오늘은 확인 대기로 남김
      if (d < addDays(today, -1)) {
        at(addDays(d, 1), 10, 30);
        var grid = await call('judge.grid', { from: d, to: d }, SUB), cells = [];
        grid.recs.forEach(function (r) {
          if (r.date !== d || r.status !== 'pending') return;
          var c = { date: d, memberId: r.memberId, mission: r.mission, status: 'ok' };
          if (r.mission === 'study' && rnd() < .12) c.status = 'vague';
          if (r.mission === 'hours') c.finalMin = Math.floor(r.inputMin / 10) * 10;
          cells.push(c);
        });
        grid.members.forEach(function (m) {
          if (!m.mentee) return;
          ['attend', 'study', 'problem'].forEach(function (mi) {
            var has = grid.recs.some(function (r) { return r.date === d && r.memberId === m.id && r.mission === mi && r.status !== 'none'; });
            if (!has) cells.push({ date: d, memberId: m.id, mission: mi, status: 'fail' });
          });
        });
        await call('judge.set', { cells: cells }, SUB);
      }
    }
    at(thisWeek, 11);
    var wg = await call('judge.grid', { from: start, to: addDays(start, 6) }, SUB);
    await call('judge.set', { cells: wg.recs.filter(function (r) { return r.mission === 'weekly' && r.status === 'pending'; })
      .map(function (r) { return { date: r.date, memberId: r.memberId, mission: 'weekly', status: 'ok' }; }) }, SUB);
    // 경고 · 데이오프
    at(thisWeek, 12);
    var wl = await call('warn.list', {}, SUB);
    var c5 = wl.candidates.filter(function (c) { return c.memberId === 'm5'; });
    if (c5[0]) await call('warn.give', { memberId: 'm5', reason: c5[0].missionName + ' 미수행', refDate: c5[0].date, refMission: c5[0].missionName }, SUB);
    if (c5[1]) await call('warn.give', { memberId: 'm5', reason: c5[1].missionName + ' 미수행', refDate: c5[1].date, refMission: c5[1].missionName }, SUB);
    await call('dayoff.assign', { memberId: 'm2', date: addDays(start, 2), reason: '학교 시험' }, SUB);
    cur = real;
    await call('dayoff.request', { date: addDays(today, dow(today) < 6 ? 1 : 0) }, tok.m4);
    // 공지 · 게시판
    at(start, 9);
    await call('notices.save', { notice: { title: '나침반 스터디 운영 안내 🧭', pinned: true, important: true,
      body: '나침반 스터디그룹에 오신 것을 환영해요!\n\n• 멘티는 생존신고 · 공부인증 · 문제만들기가 필수예요.\n• 공부인증 · 문제만들기 등은 다음 날 12시까지 체크할 수 있어요.\n• 인증 사진은 인스타그램 인증방에 올려주세요. 운영진이 확인 후 파이를 지급합니다.\n• 경고 5회가 되면 퇴출 대상이 됩니다.\n\n비밀번호는 실제로 쓰는 것과 다른 비밀번호를 써주세요. 관리자가 열람할 수 있어요.' } }, A);
    at(addDays(start, 4), 13);
    await call('notices.save', { notice: { title: '상점에 새 상품이 들어왔어요', body: '아메리카노 기프티콘이 5개 한정으로 들어왔어요. 1인당 1개만 살 수 있어요!' } }, SUB);
    var posts = [['m1', '오늘 7시간 채웠다!! 다들 화이팅 💪', 2], ['m3', '문제만들기 너무 어렵다… 그래도 하는 중', 1], ['lead', '이번 주 랭킹 경쟁 치열하네요 👀', 0], ['m4', '내일 데이오프 쓰고 푹 쉬고 올게요', 0]];
    for (i = 0; i < posts.length; i++) {
      var p = posts[i];
      cur = real - (posts.length - i) * 3 * 3600000;
      var po = await call('posts.create', { text: p[1] }, tok[p[0]]);
      if (!po) continue;
      var rs = ['sub', 'm2', 'lead', 'm5'].slice(0, 2 + p[2]);
      for (var j = 0; j < rs.length; j++) await call('posts.react', { id: po.id, kind: ['heart', 'thumb', 'laugh', 'wow'][j % 4] }, tok[rs[j]]);
    }
  } finally {
    SV.setClock(null);
  }
};
