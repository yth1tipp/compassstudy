// 이 파일은 server/ 폴더의 파일들을 묶어 만든 것이에요. 고칠 때는 server/ 폴더를 고치고 node server/build.mjs 를 실행하세요.
(function () {
"use strict";
var CLOCK_ = null;
/**
 * 나침반 스터디그룹 서버 (Supabase Edge Function + Postgres) — 기능 명세서 v1.6
 *
 * 모든 기록은 Supabase 데이터베이스의 `compass` 보관 영역(스키마)에 저장됩니다.
 * 표 이름과 칸 이름은 02_tables.js 에 모여 있고, 표가 바뀌면 서버가 시작할 때 자동으로 맞춥니다.
 *
 * 누가 어떤 기능을 쓸 수 있는지는 아래 ACCESS 표 한 곳에서 정합니다.
 * (개발자는 웹의 시스템 설정에서도 바꿀 수 있어요. 잠긴 항목은 항상 개발자만 씁니다.)
 */

// ================================================================
// 0. 상수
// ================================================================
var VERSION = '1.6.0';
var INIT_DEV = { id: 'admin', name: '개발자', password: 'admin1234' };
var PI_101_110 = '8214808651';   // 원주율 소수점 아래 101~110번째 자리 (전체 초기화 확인용)

var MISSIONS = ['attend', 'study', 'problem', 'mentoring', 'hours', 'daily'];
var DEFAULT_REQUIRED = ['attend', 'study', 'problem'];
var MISSION_NAMES = {
  attend: '생존신고', study: '공부인증', problem: '문제만들기', mentoring: '멘토/멘티 활동',
  hours: '공부시간 인증', daily: '데일리 퀘스트', weekly: '위클리 퀘스트'
};
var OP_TAGS = ['dev', 'lead', 'sub', 'sup'];
var TAG_RANK = { dev: 4, lead: 3, sub: 2, sup: 1 };
var TAG_SORT = { lead: 0, dev: 1, sub: 2, sup: 3 };
var TAG_NAMES = { dev: '개발자', lead: '대표', sub: '부대표', sup: '서포터', mentor: '멘토', mentee: '멘티' };
var RANK_WORDS = { 0: '모든 멤버', 1: '서포터 이상', 2: '부대표 이상', 3: '대표 이상', 4: '개발자' };
var REACTIONS = ['heart', 'thumb', 'check', 'angry', 'laugh', 'cry', 'wow'];
var REACTION_NAMES = { heart: '하트', thumb: '엄지', check: '체크', angry: '화남', laugh: '웃음', cry: '울음', wow: '놀람' };
var LEDGER_TYPES = {
  mission: '미션 판정', rejudge: '재판정', sheet: '직접 수정 반영', game: '미니게임', settle: '주간 정산',
  weekly: '위클리 퀘스트', shop: '상점 구매', refund: '환불', manual: '직접 지급·회수', fix: '다시 계산 보정'
};
var GAME_IDS = ['roulette', 'rps', 'mines', 'g2048', 'metronome', 'darts', 'treasure', 'stopwatch', 'cards', 'updown'];
var GAME_NAMES = {
  roulette: '룰렛', rps: '가위바위보', mines: '지뢰찾기', g2048: '2048', metronome: '메트로놈 타이밍',
  darts: '다트', treasure: '보물상자', stopwatch: '스톱워치', cards: '카드 짝맞추기', updown: '업다운'
};
var COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
var DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];

var STATUS_WORDS = { none: '', pending: '확인 대기', ok: '인정', vague: '애매함', fail: '미수행' };
var MEMBER_STATUS_WORDS = { active: '활동', expelled: '퇴출', deleted: '삭제' };

// ================================================================
// 0-1. 기능별로 쓸 수 있는 사람
//   [최소 단계, 묶음, 설명]   단계: 0 모든 멤버 · 1 서포터 이상 · 2 부대표 이상 · 3 대표 이상 · 4 개발자
//   바꾸고 싶으면 숫자만 고치면 됩니다. 화면 메뉴도 이 표를 따라 보였다 숨었다 해요.
// ================================================================
var ACCESS = {
  // 서포터 이상
  'judge.view':      [1, '인증 확인', '판정 표 · 확인 대기 보기'],
  'judge.attend':    [1, '인증 확인', '생존신고 출석 대신 처리'],
  'posts.hide':      [1, '게시판', '한줄 게시판 글 숨기기'],
  // 부대표 이상 (일반 운영)
  'admin.home':      [2, '인증 확인', '오늘 할 일 보기'],
  'judge.all':       [2, '인증 확인', '미션 판정 (인정 · 애매함 · 미수행 · 초기화 · 공부시간 확정)'],
  'members.manage':  [2, '멤버 관리', '멤버 추가 · 정보 수정 · 퇴출 · 다시 활성화, 비밀번호 보기 · 새로 정하기 (나보다 아래 단계 계정)'],
  'members.memo':    [2, '멤버 관리', '운영 메모 남기기'],
  'members.bulk':    [2, '멤버 관리', '멤버 여러 명 한꺼번에 추가'],
  'warn.manage':     [2, '멤버 관리', '경고 주기 · 취소 · 넘어가기 · 고치기'],
  'dayoff.manage':   [2, '멤버 관리', '데이오프 지정 · 취소'],
  'pie.adjust':      [2, '멤버 관리', '파이 직접 지급 · 회수'],
  'pie.view':        [2, '멤버 관리', '전체 파이 내역 보기'],
  'quests.manage':   [2, '콘텐츠 관리', '퀘스트 등록 · 수정 ({weeksAhead})'],
  'shop.manage':     [2, '콘텐츠 관리', '상품 · 구매 관리'],
  'games.schedule':  [2, '콘텐츠 관리', '날짜별 미니게임 정하기 ({weeksAhead}), 게임 켜기 · 끄기'],
  'games.extra':     [2, '콘텐츠 관리', '멤버에게 미니게임 기회 더 주기, 플레이 기록 보기'],
  'notices.manage':  [2, '콘텐츠 관리', '공지 쓰기 · 고치기 · 지우기'],
  'posts.manage':    [2, '게시판', '남의 한줄 글 고치기 · 지우기, 반응 지우기'],
  'settle.view':     [2, '정산 · 기록', '주간 정산 미리보기 · 결과 보기'],
  'logs.view':       [2, '정산 · 기록', '활동 기록 보기'],
  // 개발자 (큰 영향 · 기본 수치)
  'settle.confirm':  [4, '정산 · 기록', '주간 정산 확정'],
  'settle.cancel':   [4, '정산 · 기록', '확정한 주간 정산 취소'],
  'judge.locked':    [4, '인증 확인', '정산이 끝난 주의 판정 고치기'],
  'anytime':         [4, '콘텐츠 관리', '퀘스트 · 미니게임을 기간 제한 없이 정하기'],
  'games.rules':     [4, '콘텐츠 관리', '미니게임 보상 · 기회 · 규칙 수치'],
  'games.records':   [4, '콘텐츠 관리', '미니게임 기록 고치기 · 지우기'],
  'settings.edit':   [4, '시스템', '기본 수치 (마감 시각, 미션 파이, 주간 보너스 표, 랭킹 보너스, 퇴출 기준 등)'],
  'missions.edit':   [4, '시스템', '미션 이름 · 순서 · 켜기 · 멘티 필수 · 체크 마감'],
  'holidays':        [4, '시스템', '전체 휴일 지정'],
  'texts.edit':      [4, '시스템', '화면 문구 · 태그 이름 · 태그 색 · 메뉴 숨기기'],
  'season.edit':     [4, '시스템', '시즌 이름 · 시작일 · 하루가 바뀌는 시각'],
  'members.dev':     [4, '멤버 관리', '모든 계정 고치기 (본인 · 개발자 포함), 아이디 바꾸기, 계정 합치기, 모든 기기 로그아웃, 가입일 고치기'],
  'members.purge':   [4, '멤버 관리', '계정과 기록 완전 삭제'],
  'pie.tools':       [4, '멤버 관리', '파이 내역 한 줄 고치기 · 지우기, 잔액 맞추기, 파이 다시 계산'],
  'view.as':         [4, '시스템', '멤버 화면으로 보기 (보기 전용)'],
  'data.edit':       [4, '데이터 도구', '데이터 편집기 (모든 표 직접 고치기) · 되돌리기'],
  'data.check':      [4, '데이터 도구', '데이터 점검 · 한 번에 맞추기'],
  'backup':          [4, '데이터 도구', '백업 내려받기 · 복구, 엑셀(CSV) 내보내기 · 올리기'],
  'usage.view':      [4, '시스템', '사용량 · 오류 기록 보기'],
  'maintenance':     [4, '시스템', '점검 중 모드'],
  'access.edit':     [4, '시스템', '기능별로 쓸 수 있는 사람 바꾸기'],
  'season.reset':    [4, '시스템', '전체 초기화 (새 시즌 시작)']
};
/** 항상 개발자만 쓰는 기능 (웹에서 바꿀 수 없음) */
var LOCKED_ACCESS = ['access.edit', 'season.reset', 'data.edit', 'data.check', 'backup', 'maintenance', 'members.purge', 'members.dev', 'view.as', 'usage.view'];

// ================================================================
// 1. 표 정의
//   - 모든 표는 compass 보관 영역에 있고, 칸은 모두 글자(text)로 저장해요.
//     (Supabase 표 편집 화면에서 사람이 읽고 고칠 수 있게, 상태도 '인정' '미수행'처럼 한글로 적어요)
//   - 모든 표에는 _id(줄 번호), _season(시즌) 칸이 자동으로 붙어요.
//   - 날짜별 · 멤버별 · 주별로 나뉘는 표에는 _date / _member / _week 칸이 더 붙어요.
//   - 칸을 새로 더하면 서버가 시작할 때 표에 자동으로 추가돼요. (지우는 건 자동으로 하지 않아요)
// ================================================================
function T_(table, title, cols, scope) { return { table: table, title: title, cols: cols, scope: scope || null }; }

var BOOKS = {
  members: { members: T_('members', '멤버 명단', [['id', '아이디'], ['name', '이름'], ['password', '비밀번호'], ['ops', '운영 태그'], ['mentor', '멘토'], ['mentee', '멘티'],
    ['insta', '인스타그램'], ['memo', '운영 메모'], ['status', '상태'], ['joinedAt', '가입일'], ['session', '로그인 초기화 번호']]) },
  settings: {
    basic: T_('settings', '기본 설정', [['key', '항목'], ['value', '값'], ['note', '설명']]),
    bonus: T_('settings_bonus', '주간 보너스', [['item', '항목'], ['d7', '7일'], ['d6', '6일'], ['d5', '5일'], ['d4', '4일'], ['d3', '3일'], ['d2', '2일'], ['d1', '1일']]),
    missions: T_('settings_missions', '미션 설정', [['mission', '미션'], ['name', '이름'], ['order', '순서'], ['on', '켜기'], ['required', '멘티 필수'], ['deadline', '본인 체크 마감'], ['note', '설명']]),
    games: T_('game_list', '미니게임 목록', [['order', '순서'], ['game', '게임'], ['on', '켜기']]),
    rewards: T_('game_rewards', '미니게임 보상', [['game', '게임'], ['key', '항목'], ['value', '값'], ['note', '설명']]),
    schedule: T_('game_schedule', '날짜별 미니게임', [['date', '날짜'], ['games', '게임'], ['by', '정한 사람'], ['at', '일시']]),
    holidays: T_('holidays', '전체 휴일', [['date', '날짜'], ['reason', '사유'], ['by', '정한 사람'], ['at', '일시']]),
    texts: T_('settings_texts', '화면 문구', [['key', '항목'], ['value', '값'], ['note', '설명']]),
    access: T_('settings_access', '기능별로 쓸 수 있는 사람', [['feature', '기능'], ['rank', '쓸 수 있는 사람'], ['note', '설명']])
  },
  quests: {
    quests: T_('quests', '퀘스트', [['id', '번호'], ['type', '종류'], ['week', '적용 주(월요일)'], ['dow', '요일'], ['title', '제목'], ['desc', '설명'], ['by', '작성한 사람'], ['at', '작성 일시']]),
    weekly: T_('weekly_done', '위클리 수행', [['week', '주(월요일)'], ['memberId', '아이디'], ['name', '이름'], ['status', '상태'], ['selfAt', '본인 체크 시각'], ['paidFor', '지급 기준'], ['pie', '지급 파이'], ['judgeBy', '판정한 사람'], ['judgeAt', '판정 시각']])
  },
  shop: {
    products: T_('products', '상품', [['id', '번호'], ['name', '상품명'], ['desc', '설명'], ['price', '가격'], ['type', '종류'], ['stock', '재고'], ['limitType', '구매 제한'], ['limitN', '제한 개수'], ['status', '판매'], ['at', '등록 일시']]),
    purchases: T_('purchases', '구매 내역', [['id', '번호'], ['at', '일시'], ['memberId', '아이디'], ['name', '이름'], ['productId', '상품 번호'], ['productName', '상품명'], ['price', '가격'], ['type', '종류'], ['status', '상태'], ['by', '처리한 사람'], ['doneAt', '처리 일시'], ['warningId', '차감한 경고 번호']])
  },
  warnings: {
    warnings: T_('warnings', '경고 내역', [['id', '번호'], ['memberId', '아이디'], ['name', '이름'], ['reason', '사유'], ['refDate', '관련 날짜'], ['refMission', '관련 미션'], ['by', '준 사람'], ['at', '일시'], ['canceled', '취소'], ['canceledBy', '취소한 사람'], ['canceledAt', '취소 일시'], ['cancelReason', '취소 사유']]),
    skips: T_('warning_skips', '넘어간 경고 후보', [['date', '날짜'], ['memberId', '아이디'], ['name', '이름'], ['by', '처리한 사람'], ['at', '일시']])
  },
  dayoffs: { dayoffs: T_('dayoffs', '데이오프', [['id', '번호'], ['memberId', '아이디'], ['name', '이름'], ['date', '날짜'], ['mode', '방식'], ['by', '처리한 사람'], ['reason', '사유'], ['at', '일시'], ['canceled', '취소'], ['canceledBy', '취소한 사람'], ['canceledAt', '취소 일시']]) },
  settle: { list: T_('settle_weeks', '주간 정산 목록', [['week', '주 시작'], ['to', '주 끝'], ['at', '확정 일시'], ['by', '확정한 사람'], ['total', '총 지급 파이']]) },
  board: { notices: T_('notices', '공지', [['id', '번호'], ['title', '제목'], ['body', '본문'], ['author', '작성한 사람'], ['at', '일시'], ['pinned', '상단 고정'], ['important', '중요'], ['draft', '초안'], ['deleted', '삭제'], ['updatedAt', '수정 일시']]) },
  // 아래 표들은 통째로 읽지 않고, 필요한 줄만 골라 읽어요
  posts: { posts: T_('posts', '한줄 게시판', [['id', '번호'], ['memberId', '아이디'], ['name', '이름'], ['text', '내용'], ['at', '일시'], ['hidden', '숨김'], ['deleted', '삭제'], ['editedAt', '고친 일시']]) },
  reactions: { reactions: T_('reactions', '반응', [['postId', '글 번호'], ['memberId', '아이디'], ['kind', '반응'], ['at', '일시']]) },
  logs: { logs: T_('logs', '활동 기록', [['at', '일시'], ['actor', '한 사람'], ['action', '한 일'], ['target', '대상'], ['before', '바꾸기 전'], ['after', '바꾼 후'], ['reason', '사유·내용']]) },
  history: { history: T_('edit_history', '직접 고친 기록 (되돌리기용)', [['batch', '묶음 번호'], ['at', '일시'], ['actor', '한 사람'], ['tableName', '표'], ['rowId', '줄 번호'], ['op', '한 일'], ['before', '바꾸기 전'], ['after', '바꾼 후'], ['undone', '되돌림']]) },
  errors: { errors: T_('error_log', '오류 기록', [['at', '일시'], ['action', '기능'], ['actor', '사용자'], ['message', '내용']]) }
};
// 날짜별 · 멤버별 · 주별 표 (책 이름 뒤에 날짜/아이디/주가 붙어요: 'date:2026-10-26', 'member:minji', 'sweek:2026-10-19')
var DATE_TABS = {
  grid: T_('missions', '미션', [['memberId', '아이디'], ['name', '이름'], ['attend', '생존신고'], ['study', '공부인증'], ['problem', '문제만들기'], ['mentoring', '멘토/멘티 활동'], ['hoursIn', '공부시간(입력)'], ['hoursFinal', '공부시간(확정)'], ['daily', '데일리 퀘스트']], 'date'),
  log: T_('mission_pay', '지급·판정 기록', [['memberId', '아이디'], ['name', '이름'], ['mission', '미션'], ['paidFor', '지급 기준'], ['pie', '지급 파이'], ['selfAt', '본인 체크 시각'], ['judgeBy', '판정한 사람'], ['judgeAt', '판정 시각']], 'date'),
  plays: T_('game_plays', '미니게임 기록', [['id', '플레이 번호'], ['memberId', '아이디'], ['name', '이름'], ['round', '회차'], ['game', '게임'], ['startedAt', '시작 시각'], ['preset', '미리 정한 값'], ['result', '결과'], ['pie', '파이'], ['status', '상태'], ['finishedAt', '끝난 시각']], 'date'),
  extra: T_('game_extra', '미니게임 추가 기회', [['memberId', '아이디'], ['name', '이름'], ['n', '추가 기회'], ['by', '준 사람'], ['at', '일시'], ['reason', '사유']], 'date')
};
var MEMBER_TABS = {
  ledger: T_('ledger', '파이 내역', [['at', '일시'], ['amount', '금액'], ['type', '종류'], ['refDate', '관련 날짜'], ['refItem', '항목'], ['by', '처리한 사람'], ['reason', '내용']], 'member')
};
var SETTLE_WEEK_COLS = [['memberId', '아이디'], ['name', '이름'], ['attend', '생존신고 일수'], ['study', '공부인증 일수'], ['problem', '문제만들기 일수'], ['mentoring', '멘토/멘티 일수'], ['daily', '데일리 일수'],
  ['bAttend', '생존신고 보너스'], ['bStudy', '공부인증 보너스'], ['bProblem', '문제만들기 보너스'], ['bMentoring', '멘토/멘티 보너스'], ['bDaily', '데일리 보너스'],
  ['minutes', '공부시간'], ['rank', '순위'], ['rankBonus', '랭킹 보너스'], ['total', '합계']];
var SWEEK_TABS = { rows: T_('settle_rows', '주간 정산 결과', SETTLE_WEEK_COLS, 'week') };

var SCOPE_COLS = { date: '_date', member: '_member', week: '_week' };
var SCOPE_LABELS = { _date: '날짜', _member: '멤버 아이디', _week: '주 시작' };

/** 모든 표 정의 목록 (표 이름 → 정의) */
var TABLES = (function () {
  var out = {};
  function add(def) { out[def.table] = def; }
  Object.keys(BOOKS).forEach(function (b) { Object.keys(BOOKS[b]).forEach(function (tk) { add(BOOKS[b][tk]); }); });
  [DATE_TABS, MEMBER_TABS, SWEEK_TABS].forEach(function (g) { Object.keys(g).forEach(function (tk) { add(g[tk]); }); });
  return out;
})();
/** 멤버 아이디가 들어 있는 칸 (아이디 바꾸기 · 계정 합치기 · 완전 삭제에 씀) */
var MEMBER_REF_COLS = [['missions', 'memberId'], ['mission_pay', 'memberId'], ['game_plays', 'memberId'], ['game_extra', 'memberId'], ['weekly_done', 'memberId'],
  ['purchases', 'memberId'], ['warnings', 'memberId'], ['warning_skips', 'memberId'], ['dayoffs', 'memberId'], ['posts', 'memberId'], ['reactions', 'memberId'],
  ['settle_rows', 'memberId'], ['ledger', '_member']];
/** '이름 (아이디)' 형태로 사람이 적혀 있는 칸 */
var WHO_COLS = [['quests', 'by'], ['weekly_done', 'judgeBy'], ['purchases', 'by'], ['warnings', 'by'], ['warnings', 'canceledBy'], ['warning_skips', 'by'], ['dayoffs', 'by'],
  ['dayoffs', 'canceledBy'], ['settle_weeks', 'by'], ['notices', 'author'], ['logs', 'actor'], ['logs', 'target'], ['mission_pay', 'judgeBy'], ['ledger', 'by'],
  ['game_schedule', 'by'], ['holidays', 'by'], ['game_extra', 'by'], ['edit_history', 'actor'], ['error_log', 'actor']];

/** 'date:2026-10-26' → { group, scope, val } */
function bookDef_(key) {
  if (BOOKS[key]) return { key: key, tabs: BOOKS[key], scopeVal: null };
  var i = key.indexOf(':');
  if (i > 0) {
    var kind = key.slice(0, i), val = key.slice(i + 1);
    if (kind === 'date') return { key: key, tabs: DATE_TABS, scopeVal: val };
    if (kind === 'member') return { key: key, tabs: MEMBER_TABS, scopeVal: val };
    if (kind === 'sweek') return { key: key, tabs: SWEEK_TABS, scopeVal: val };
  }
  throw new Error('알 수 없는 묶음: ' + key);
}
/** 'date:2026-10-26/grid' → { key, book, tk, def, scopeCol, scopeVal } */
function tabSpec_(tabKey) {
  var j = tabKey.lastIndexOf('/');
  var book = tabKey.slice(0, j), tk = tabKey.slice(j + 1), bd = bookDef_(book), def = bd.tabs[tk];
  if (!def) throw new Error('알 수 없는 표: ' + tabKey);
  return { key: tabKey, book: book, tk: tk, def: def, table: def.table, scopeCol: def.scope ? SCOPE_COLS[def.scope] : null, scopeVal: bd.scopeVal };
}

// ================================================================
// 2. 시간 (모든 판단은 한국 시간)
//    '하루가 바뀌는 시각'(기본 0시)을 바꾸면, 예를 들어 4시로 정했을 때 새벽 3시는 아직 전날로 셉니다.
// ================================================================
var KST_MS = 9 * 3600 * 1000;
function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function nowMs_() { return CLOCK_ ? CLOCK_() : (CTX && CTX.now ? CTX.now : (CLOCK_ ? CLOCK_() : Date.now())); }
function ymd_(ms) { var d = new Date(ms + KST_MS); return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate()); }
function dayStartHour_() { return CTX && CTX.dayStartHour ? CTX.dayStartHour : 0; }
/** 오늘 (하루가 바뀌는 시각 반영) */
function today_() { return ymd_(nowMs_() - dayStartHour_() * 3600000); }
function addDays_(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dow_(s) { return (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; }
function weekOf_(s) { return addDays_(s, -dow_(s)); }
/** 그 날짜의 한국 시각 hour시 (24 = 다음 날 0시) */
function kstAt_(s, hour) { return Date.parse(s + 'T00:00:00Z') - KST_MS + hour * 3600000; }
/** 그 날(하루가 바뀌는 시각 기준)이 끝나는 순간 */
function dayEnd_(s) { return kstAt_(s, 24 + dayStartHour_()); }
function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z')); }
function dayNum_(s) { return Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000); }
/** 사람이 읽는 시각: 2026-10-26 21:03:15 (한국 시간) */
function stamp_(ms) {
  if (ms === undefined) ms = nowMs_();
  var d = new Date(ms + KST_MS);
  return ymd_(ms) + ' ' + pad2_(d.getUTCHours()) + ':' + pad2_(d.getUTCMinutes()) + ':' + pad2_(d.getUTCSeconds());
}
function nowStamp_() { return stamp_(nowMs_()); }
/** 적힌 시각 → ms. '2026-10-26 21:03', '2026-10-26 21:03:15', '2026. 10. 26 오후 9:03:15' 등 */
function parseStamp_(s) {
  s = String(s || '').trim();
  if (!s) return 0;
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) { var iso = Date.parse(s); return isNaN(iso) ? 0 : iso; }
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*?(?:(오전|오후)\s*)?(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) return 0;
  var h = +(m[5] || 0);
  if (m[4] === '오후' && h < 12) h += 12;
  if (m[4] === '오전' && h === 12) h = 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], h, +(m[6] || 0), +(m[7] || 0)) - KST_MS;
}
function stampDate_(s) { var ms = parseStamp_(s); return ms ? ymd_(ms) : ''; }
/** 날짜 칸 → YYYY-MM-DD */
function parseDate_(s) {
  s = String(s || '').trim();
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '';
  var d = m[1] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[3]);
  return isDate_(d) ? d : '';
}
function monthDay_(s) { return (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)); }

// ================================================================
// 3. 값 변환
// ================================================================
function fail_(msg, code) { var e = new Error(msg); e.userMsg = msg; e.code = code || 'ERR'; throw e; }
function num_(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var n = Number(String(v === null || v === undefined ? '' : v).replace(/[,\s원파이]/g, '')); return isFinite(n) ? n : 0; }
function isNumText_(v) { var t = String(v === null || v === undefined ? '' : v).replace(/[,\s원파이]/g, ''); return t === '' || /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t); }
function str_(v, max) { v = (v === null || v === undefined) ? '' : String(v).trim(); return max ? v.slice(0, max) : v; }
function yes_(v) { v = str_(v).toLowerCase(); return ['o', 'ㅇ', '○', '●', 'y', 'yes', '예', '네', 'true', '✓', '✔', 'v', '1', '켜기', '켬'].indexOf(v) >= 0; }
function yn_(b) { return b ? 'O' : ''; }
function uid_() { return ((CLOCK_ ? CLOCK_() : Date.now()) % 1e9).toString(36) + Math.random().toString(36).slice(2, 6); }
function clone_(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
function parseJson_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
/** 상태 글자 → 내부 값 */
function parseStatus_(v) {
  v = str_(v).replace(/\s/g, '');
  if (!v) return 'none';
  if (/^(인정|완료|확인완료|o|ㅇ|○|✓|✔|ok)$/i.test(v)) return 'ok';
  if (/^(애매|애매함|△|세모)$/.test(v)) return 'vague';
  if (/^(미수행|미시행|x|×|✕|안함|불인정|fail)$/i.test(v)) return 'fail';
  if (/^(확인대기|대기|체크|체크함|했어요|pending)$/i.test(v)) return 'pending';
  return 'pending';
}
/** 알아볼 수 있는 상태 글자인가 (데이터 점검용) */
function knownStatus_(v) {
  v = str_(v).replace(/\s/g, '');
  return !v || /^(인정|완료|확인완료|o|ㅇ|○|✓|✔|ok|애매|애매함|△|세모|미수행|미시행|x|×|✕|안함|불인정|fail|확인대기|대기|체크|체크함|했어요|pending)$/i.test(v);
}
/** 시간 글자 → 분. '3:20', '3:20:00', '3시간 20분', '200분', '3' (=3시간), '2.5' (=2시간 30분) */
function parseMinutes_(v) {
  v = str_(v);
  if (!v) return null;
  var m;
  if ((m = v.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/))) return (+m[1]) * 60 + (+m[2]);
  if ((m = v.match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?$/)) && (m[1] || m[2])) return (+(m[1] || 0)) * 60 + (+(m[2] || 0));
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 60);
  return null;
}
function fmtMinutes_(min) { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + ':' + pad2_(min % 60); }
function isFailWord_(v) { return parseStatus_(v) === 'fail'; }
function opsParse_(v) {
  var map = { '개발자': 'dev', 'dev': 'dev', '대표': 'lead', 'lead': 'lead', '부대표': 'sub', 'sub': 'sub', '서포터': 'sup', 'sup': 'sup' };
  var out = [];
  str_(v).split(/[,/·\s]+/).forEach(function (t) { var k = map[t.trim().toLowerCase()] || map[t.trim()]; if (k && out.indexOf(k) < 0) out.push(k); });
  return out;
}
function opsStr_(ops) { return ops.slice().sort(function (a, b) { return TAG_SORT[a] - TAG_SORT[b]; }).map(function (t) { return TAG_NAMES[t]; }).join(', '); }
function memberStatusParse_(v) { v = str_(v); if (/퇴출|expel/i.test(v)) return 'expelled'; if (/삭제|delet/i.test(v)) return 'deleted'; return 'active'; }
function gameKey_(v) { v = str_(v); for (var k in GAME_NAMES) if (GAME_NAMES[k] === v || k === v) return k; return ''; }
function setPath_(o, path, v) { var p = path.split('.'); for (var i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; } o[p[p.length - 1]] = v; }
function getPath_(o, path) { var p = path.split('.'); for (var i = 0; i < p.length; i++) { if (o === undefined || o === null) return undefined; o = o[p[i]]; } return o; }
function validId_(id) { return /^[A-Za-z0-9_\-가-힣.]{1,30}$/.test(id || ''); }

// ================================================================
// 3-1. SHA-256 (로그인 표시용, 외부 도구 없이 동작)
// ================================================================
var SHA_K_ = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
function utf8Bytes_(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { var c2 = s.charCodeAt(i + 1); if (c2 >= 0xdc00 && c2 < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); i++; } }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function sha256_(s) {
  var b = utf8Bytes_(String(s)), l = b.length * 8;
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  var hi = Math.floor(l / 0x100000000), lo = l >>> 0;
  b.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
  function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
  for (var i = 0; i < b.length; i += 64) {
    for (var t = 0; t < 16; t++) w[t] = (b[i + 4 * t] << 24) | (b[i + 4 * t + 1] << 16) | (b[i + 4 * t + 2] << 8) | b[i + 4 * t + 3];
    for (t = 16; t < 64; t++) {
      var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + SHA_K_[t] + w[t]) | 0;
      var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', bytes = [], out = '';
  H.forEach(function (x) { bytes.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); });
  for (i = 0; i < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return out;
}

// ================================================================
// 4. 요청 하나의 작업 공간
//    기능은 필요한 표를 읽어 와서(메모리) 고친 뒤, 끝날 때 바뀐 줄만 한꺼번에 저장해요.
//    아직 안 읽은 표가 필요하면 NeedLoad 를 던지고, 엔진이 그 표를 읽어 온 뒤 처음부터 다시 실행해요.
//    (고친 내용은 저장 전까지 메모리에만 있으므로 다시 실행해도 안전해요)
// ================================================================
var CTX = null;
function NeedLoad_(keys) { var e = new Error('필요한 표: ' + keys.join(', ')); e.needLoad = keys; return e; }

function newCtx_(base) {
  return { cache: base.cache, qcache: base.qcache, meta: base.meta, season: Math.max(1, Math.round(num_(base.meta.season)) || 1), now: base.now,
           tabs: {}, qrows: [], ops: [], metaSet: {}, me: null, viewer: null, viewOnly: false, members: null, settings: null, dayStartHour: 0, inTx: !!base.inTx, req: base.req || {} };
}
/** 'members' 처럼 묶음 이름을 주면 그 안의 모든 표, 'date:2026-10-26/grid' 처럼 주면 그 표만 */
function expandKeys_(keys) {
  var out = [];
  keys.forEach(function (k) {
    if (!k) return;
    if (k.indexOf('q:') === 0 || k.indexOf('/') > 0) { if (out.indexOf(k) < 0) out.push(k); return; }
    var bd = bookDef_(k);
    Object.keys(bd.tabs).forEach(function (tk) { var x = k + '/' + tk; if (out.indexOf(x) < 0) out.push(x); });
  });
  return out;
}
function loaded_(k) { return k.indexOf('q:') === 0 ? (k in CTX.qcache) : (k in CTX.cache); }
/** 필요한 표를 한꺼번에 알려 둡니다. 없으면 읽어 온 뒤 처음부터 다시 실행돼요 */
function need_(keys) {
  var miss = expandKeys_(keys).filter(function (k) { return !loaded_(k); });
  if (miss.length) throw NeedLoad_(miss);
}
var load_ = need_;

function norm_(cols, obj) {
  cols.forEach(function (c) { var v = obj[c[0]]; obj[c[0]] = (v === null || v === undefined) ? '' : String(v); });
  return obj;
}
function tab_(book, tk) {
  var k = book + '/' + tk, t = CTX.tabs[k];
  if (t && !t.stub) return t;
  if (!(k in CTX.cache)) throw NeedLoad_([k]);
  var sp = tabSpec_(k);
  var nt = { key: k, spec: sp, cols: sp.def.cols, rows: CTX.cache[k].map(function (r) { return Object.assign({}, r); }), appends: [], dirty: [], removed: [], rewrite: false };
  if (t && t.stub) t.appends.forEach(function (o) { nt.rows.push(o); nt.appends.push(o); });
  CTX.tabs[k] = nt;
  return nt;
}
function rows_(book, tk) { return tab_(book, tk).rows; }
function insert_(book, tk, obj) {
  var t = tab_(book, tk);
  norm_(t.cols, obj);
  obj._id = '';
  t.rows.push(obj);
  t.appends.push(obj);
  return obj;
}
/** 읽지 않고 덧붙이기만 할 때 (활동 기록 · 파이 내역처럼 계속 쌓이는 표) */
function winsert_(book, tk, obj) {
  var k = book + '/' + tk;
  if ((CTX.tabs[k] && !CTX.tabs[k].stub) || (k in CTX.cache)) return insert_(book, tk, obj);
  var t = CTX.tabs[k];
  if (!t) { var sp = tabSpec_(k); t = CTX.tabs[k] = { key: k, spec: sp, cols: sp.def.cols, stub: true, appends: [] }; }
  norm_(t.cols, obj);
  obj._id = '';
  t.appends.push(obj);
  return obj;
}
function stubAppends_(book, tk) { var t = CTX.tabs[book + '/' + tk]; return t && t.stub ? t.appends : []; }
function touch_(book, tk, obj) {
  var t = tab_(book, tk);
  norm_(t.cols, obj);
  if (obj._id && t.dirty.indexOf(obj) < 0) t.dirty.push(obj);
}
function remove_(book, tk, obj) {
  var t = tab_(book, tk);
  t.rows = t.rows.filter(function (r) { return r !== obj; });
  if (obj._id) t.removed.push(obj._id);
  else t.appends = t.appends.filter(function (r) { return r !== obj; });
}
function replaceAll_(book, tk, list) {
  var t = tab_(book, tk);
  list.forEach(function (o) { norm_(t.cols, o); });
  t.rows = list;
  t.rewrite = true;
}

// ---------- 골라 읽기 (조건에 맞는 줄만) ----------
function qkey_(name, args) { return 'q:' + name + ':' + JSON.stringify(args || {}); }
function q_(name, args) {
  var k = qkey_(name, args);
  if (!(k in CTX.qcache)) throw NeedLoad_([k]);
  return clone_(CTX.qcache[k]);
}
/** 골라 읽은 줄을 고쳤을 때 (줄 번호로 저장) */
function touchRow_(table, obj) {
  norm_(TABLES[table].cols, obj);
  for (var i = 0; i < CTX.qrows.length; i++) if (CTX.qrows[i].obj === obj) return;
  CTX.qrows.push({ table: table, obj: obj });
}
function removeRow_(table, id) { if (id) CTX.ops.push({ op: 'delete', table: table, ids: [String(id)] }); }
/** 저장할 때 그대로 실행할 작업 (여러 줄을 조건으로 고치기 등) */
function op_(o) { CTX.ops.push(o); }
function setMeta_(k, v) { CTX.metaSet[k] = v === null || v === undefined ? null : String(v); CTX.meta[k] = CTX.metaSet[k]; }

function plainRow_(cols, o) { var r = {}; cols.forEach(function (c) { r[c[0]] = o[c[0]] === undefined || o[c[0]] === null ? '' : String(o[c[0]]); }); return r; }
/** 이번 요청에서 바뀐 내용을 저장 작업 목록으로 */
function collectChanges_() {
  var out = [];
  Object.keys(CTX.tabs).forEach(function (k) {
    var t = CTX.tabs[k], sp = t.spec, table = sp.table, scope = sp.scopeCol ? { col: sp.scopeCol, val: sp.scopeVal } : null;
    if (t.stub) { if (t.appends.length) out.push({ op: 'insert', table: table, scope: scope, rows: t.appends.map(function (o) { return plainRow_(t.cols, o); }) }); return; }
    if (t.rewrite) {
      out.push({ op: 'deleteScope', table: table, scope: scope });
      if (t.rows.length) out.push({ op: 'insert', table: table, scope: scope, rows: t.rows.map(function (o) { return plainRow_(t.cols, o); }) });
      return;
    }
    var live = new Set(t.rows);
    if (t.removed.length) out.push({ op: 'delete', table: table, ids: t.removed.slice() });
    var dirty = t.dirty.filter(function (o) { return o._id && live.has(o); });
    if (dirty.length) out.push({ op: 'update', table: table, rows: dirty.map(function (o) { var r = plainRow_(t.cols, o); r._id = String(o._id); return r; }) });
    var ap = t.appends.filter(function (o) { return live.has(o); });
    if (ap.length) out.push({ op: 'insert', table: table, scope: scope, rows: ap.map(function (o) { return plainRow_(t.cols, o); }) });
  });
  var byTable = {};
  CTX.qrows.forEach(function (x) { if (!x.obj._id) return; (byTable[x.table] = byTable[x.table] || []).push(x.obj); });
  Object.keys(byTable).forEach(function (tb) { out.push({ op: 'update', table: tb, rows: byTable[tb].map(function (o) { var r = plainRow_(TABLES[tb].cols, o); r._id = String(o._id); return r; }) }); });
  CTX.ops.forEach(function (o) { out.push(o); });
  if (Object.keys(CTX.metaSet).length) out.push({ op: 'meta', set: CTX.metaSet });
  return out;
}

// ================================================================
// 5. 설정 (설정 표 ↔ 내부 값)
//    설정 표에는 사람이 읽는 한글 이름으로 적혀 있어서, Supabase 표 편집 화면에서 바로 고쳐도 반영돼요.
// ================================================================
/** [키, 표에 적히는 이름, 기본값, 설명, 형식(num|text|list)] */
var BASIC_FIELDS = [
  ['groupName', '그룹 이름', '나침반', '사이트 머리말에 보이는 이름', 'text'],
  ['deadlineHour', '다음 날 체크 마감 시각', 12, '공부인증 등은 다음 날 이 시각까지 체크 (0~23)'],
  ['dayStartHour', '하루가 바뀌는 시각', 0, '0이면 자정. 4로 정하면 새벽 4시 전까지는 전날로 셈 (0~6)'],
  ['expelAt', '퇴출 기준 경고 수', 5, '이 횟수가 되면 퇴출 대상으로 표시'],
  ['dayoffPerWeek', '본인 데이오프 신청 (주당 횟수)', 1, '멤버가 직접 신청할 수 있는 횟수'],
  ['r.attend', '생존신고 파이', 100, ''], ['r.study', '공부인증 인정 파이', 200, ''], ['r.studyVague', '공부인증 애매함 파이', 100, ''],
  ['r.problem', '문제만들기 파이', 100, ''], ['r.mentoring', '멘토/멘티 활동 파이', 100, ''],
  ['r.hourPer', '공부시간 1시간당 파이', 20, '분 단위는 버림'], ['r.hourCap', '공부시간 최대 인정 시간', 10, '파이 계산에만 적용'],
  ['r.daily', '데일리 퀘스트 파이', 100, ''], ['r.weekly', '위클리 퀘스트 파이', 500, ''],
  ['rankBonus', '공부랭킹 보너스 (1등부터 차례로)', '1000, 500, 300, 200, 100', '쉼표로 구분. 개수를 늘리면 더 많은 등수에 보너스', 'list'],
  ['g.baseChances', '미니게임 기본 기회', 1, '하루 기본 도전 횟수'], ['g.bonusChances', '공부인증 체크 시 추가 기회', 1, ''],
  ['g.maxPerPlay', '미니게임 1회 최대 파이', 100, ''],
  ['weeksAhead', '미리 정할 수 있는 기간 (주)', 4, '퀘스트 · 날짜별 미니게임 (개발자는 제한 없음)'],
  ['banner.evening', '오늘 마감 알림 시작 시각', 20, '생존신고 · 미니게임 알림'], ['banner.morning', '어제 마감 알림 시작 시각', 6, '어제 미션 체크 마감 알림'],
  ['budget.dbMB', '저장 공간 예산 (MB)', 200, '개발자 화면의 사용량 색 기준'], ['budget.requests', '하루 요청 예산 (회)', 5000, '개발자 화면의 사용량 색 기준']
];
var BONUS_ITEMS = [['attend', '생존신고'], ['study', '공부인증'], ['problem', '문제만들기'], ['mentoring', '멘토/멘티 활동'], ['daily', '주간미션(데일리 퀘스트)']];
var DEFAULT_BONUS = { attend: { 7: 300, 6: 100 }, study: { 7: 300, 6: 100 }, problem: { 7: 300, 6: 100 }, mentoring: { 7: 300, 6: 200, 5: 100 }, daily: { 7: 300, 6: 200, 5: 100 } };
/** 미션 설정 기본값: [키, 순서, 켜기, 멘티 필수, 체크 마감(today=당일 24시, next=다음 날 마감 시각)] */
var MISSION_DEFAULTS = [['attend', 1, true, true, 'today'], ['study', 2, true, true, 'next'], ['problem', 3, true, true, 'next'], ['mentoring', 4, true, false, 'next'],
  ['hours', 5, true, false, 'next'], ['daily', 6, true, false, 'next'], ['weekly', 7, true, false, 'week']];
var DEADLINE_WORDS = { today: '당일 24시', next: '다음 날 마감 시각', week: '다음 주 월요일 마감 시각' };
/** 화면 문구 · 태그 · 메뉴: [키, 이름, 기본값] */
var TEXT_FIELDS = [
  ['subtitle', '사이트 부제목', '공스타그램 스터디그룹'],
  ['loginTagline', '로그인 화면 문구', '오늘도 방향을 잃지 않고, 한 걸음씩'],
  ['pwNotice', '비밀번호 안내 문구', '실제 사용하는 비밀번호와 다른 비밀번호를 사용하세요. 관리자가 열람할 수 있습니다.'],
  ['homeNotice', '홈 맨 위 안내 (비우면 안 보임)', ''],
  ['tag.dev', '개발자 태그 이름', '개발자'], ['tag.lead', '대표 태그 이름', '대표'], ['tag.sub', '부대표 태그 이름', '부대표'],
  ['tag.sup', '서포터 태그 이름', '서포터'], ['tag.mentor', '멘토 태그 이름', '멘토'], ['tag.mentee', '멘티 태그 이름', '멘티'],
  ['color.dev', '개발자 태그 색', '#e0464c'], ['color.lead', '대표 태그 색', '#3266d8'], ['color.sub', '부대표 태그 색', '#29b2ef'],
  ['color.sup', '서포터 태그 색', '#8b5cf6'], ['color.mentor', '멘토 태그 색', '#1f9e57'], ['color.mentee', '멘티 태그 색', '#e5b30c'],
  ['menu.games', '미니게임 메뉴 보이기', 'O'], ['menu.shop', '상점 메뉴 보이기', 'O'], ['menu.ranking', '랭킹 메뉴 보이기', 'O'], ['menu.board', '공지 · 한줄 게시판 메뉴 보이기', 'O']
];

/** 게임별 보상 항목. 형식: num 숫자, tiers '기준=파이, 기준=파이', list '10, 20, 30' */
var GAME_FIELDS = {
  roulette: [['table.N', 'N (북)', 'num', 100], ['table.NE', 'NE (북동)', 'num', 30], ['table.E', 'E (동)', 'num', 60], ['table.SE', 'SE (남동)', 'num', 20],
             ['table.S', 'S (남)', 'num', 80], ['table.SW', 'SW (남서)', 'num', 40], ['table.W', 'W (서)', 'num', 50], ['table.NW', 'NW (북서)', 'num', 10]],
  rps: [['rounds', '판 수', 'num', 3], ['base', '기본 파이', 'num', 10], ['win', '승리 1판', 'num', 30], ['draw', '무승부 1판', 'num', 10], ['lose', '패배 1판', 'num', 0]],
  mines: [['size', '판 크기 (가로·세로 칸 수)', 'num', 9], ['mines', '지뢰 수', 'num', 10],
          ['success', '성공: 걸린 초 이하 = 파이', 'tiers', [[59, 100], [89, 90], [119, 80], [179, 70], [239, 60]]], ['successElse', '성공: 그보다 오래 걸리면', 'num', 50],
          ['fail', '실패: 정답 깃발 수 이하 = 파이', 'tiers', [[1, 0], [3, 10], [5, 20], [7, 30], [9, 40]]], ['failElse', '실패: 그보다 많으면', 'num', 40]],
  g2048: [['tiers', '최고 타일 이상 = 파이', 'tiers', [[2048, 100], [1024, 80], [512, 70], [256, 60], [128, 50], [64, 40], [32, 30], [16, 20]]], ['else', '그 외', 'num', 10]],
  metronome: [['taps', '탭 횟수', 'num', 3], ['beatMs', '박 간격 (1000 = 1초)', 'num', 1000], ['base', '기본 파이', 'num', 10],
              ['PERFECT', 'PERFECT 파이', 'num', 30], ['GREAT', 'GREAT 파이', 'num', 20], ['GOOD', 'GOOD 파이', 'num', 10], ['MISS', 'MISS 파이', 'num', 0],
              ['windows.PERFECT', 'PERFECT 범위 (±1/1000초)', 'num', 30], ['windows.GREAT', 'GREAT 범위 (±1/1000초)', 'num', 60], ['windows.GOOD', 'GOOD 범위 (±1/1000초)', 'num', 100]],
  darts: [['throws', '다트 수', 'num', 2], ['speed', '조준점 속도 (작을수록 느림)', 'num', 0.55]],
  treasure: [['values', '상자 속 파이 (같은 확률로 하나)', 'list', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]]],
  stopwatch: [['targetSec', '목표 시간 (초)', 'num', 10], ['tiers', '오차 초 이하 = 파이', 'tiers', [[0.1, 100], [0.2, 90], [0.3, 80], [0.4, 70], [0.5, 50], [0.6, 40], [0.8, 30], [1.0, 20]]], ['else', '그 외', 'num', 10]],
  cards: [['maxTries', '최대 시도 횟수', 'num', 22], ['success', '성공: 시도 이하 = 파이', 'tiers', [[14, 100], [18, 90], [22, 80]]], ['perPair', '실패: 찾은 쌍 1개당', 'num', 10], ['failCap', '실패: 최대', 'num', 70]],
  updown: [['max', '숫자 범위 (1 ~ 이 숫자)', 'num', 100], ['guesses', '기회', 'num', 10], ['first', '1번에 맞히면', 'num', 100], ['step', '한 번 늘 때마다 감소', 'num', 10], ['min', '맞혔을 때 최소', 'num', 10], ['fail', '못 맞히면', 'num', 10]]
};
function tiersStr_(t) { return t.map(function (x) { return x[0] + '=' + x[1]; }).join(', '); }
function parseTiers_(s) {
  var out = [];
  str_(s).split(/[,\n]+/).forEach(function (part) { var m = part.match(/(-?[\d.]+)\s*[=:→>]\s*(-?[\d.]+)/); if (m) out.push([parseFloat(m[1]), parseFloat(m[2])]); });
  return out;
}
function parseList_(s) { return str_(s).split(/[,\s]+/).filter(Boolean).map(Number).filter(function (n) { return isFinite(n); }); }
function fieldStr_(type, v) { return type === 'tiers' ? tiersStr_(v) : type === 'list' ? v.join(', ') : String(v); }
function fieldParse_(type, s, dflt) {
  if (type === 'tiers') { var t = parseTiers_(s); return t.length ? t : dflt; }
  if (type === 'list') { var l = parseList_(s); return l.length ? l : dflt; }
  return str_(s) === '' || !isNumText_(s) ? dflt : num_(s);
}
function rankParse_(v) {
  v = str_(v);
  if (/^[0-4]$/.test(v)) return +v;
  for (var k in RANK_WORDS) if (RANK_WORDS[k] === v) return +k;
  if (/개발자/.test(v)) return 4; if (/대표 이상/.test(v) && !/부/.test(v)) return 3; if (/부대표/.test(v)) return 2; if (/서포터/.test(v)) return 1; if (/모든|멤버/.test(v)) return 0;
  return null;
}
/** 미션 이름 → 키 (기본 이름 · 바꾼 이름 모두) */
function missionKey_(v) {
  v = str_(v);
  for (var k in MISSION_NAMES) if (MISSION_NAMES[k] === v || k === v) return k;
  if (v === '멘토/멘티') return 'mentoring';
  if (v === '공부시간') return 'hours';
  if (CTX && CTX.settings) { var L = CTX.settings.missions.byKey; for (var k2 in L) if (L[k2].name === v) return k2; }
  return '';
}

function settings_() {
  if (CTX.settings) return CTX.settings;
  var basic = {};
  rows_('settings', 'basic').forEach(function (r) { basic[str_(r.key)] = r.value; });
  var S = { rewards: {}, rankBonus: [], games: { order: [], enabled: {}, schedule: {}, cfg: {} }, bonus: {}, budget: {}, banner: {},
            missions: { list: [], byKey: {} }, holidays: {}, texts: {}, access: {} };
  BASIC_FIELDS.forEach(function (f) {
    var raw = basic[f[1]], blank = raw === undefined || str_(raw) === '', v;
    if (f[4] === 'text') v = blank ? f[2] : str_(raw);
    else if (f[4] === 'list') v = parseList_(blank ? f[2] : raw);
    else v = blank || !isNumText_(raw) ? f[2] : num_(raw);
    if (f[0].indexOf('r.') === 0) S.rewards[f[0].slice(2)] = v;
    else if (f[0].indexOf('g.') === 0) S.games[f[0].slice(2)] = v;
    else if (f[0].indexOf('budget.') === 0) S.budget[f[0].slice(7)] = v;
    else if (f[0].indexOf('banner.') === 0) S.banner[f[0].slice(7)] = v;
    else S[f[0]] = v;
  });
  S.deadlineHour = Math.max(0, Math.min(23, Math.round(S.deadlineHour)));
  S.dayStartHour = Math.max(0, Math.min(6, Math.round(S.dayStartHour)));
  S.dayoffPerWeek = Math.max(0, Math.round(S.dayoffPerWeek));
  S.weeksAhead = Math.max(0, Math.round(S.weeksAhead));
  S.rankBonus = S.rankBonus.map(function (v) { return Math.max(0, Math.round(v)); });
  CTX.dayStartHour = S.dayStartHour;
  // 주간 보너스
  var bonusRows = rows_('settings', 'bonus');
  BONUS_ITEMS.forEach(function (it) {
    var r = bonusRows.filter(function (x) { return str_(x.item) === it[1] || MISSION_NAMES[it[0]] === str_(x.item) || it[0] === str_(x.item); })[0];
    var o = {};
    if (r) { for (var n = 1; n <= 7; n++) { var v = num_(r['d' + n]); if (v > 0) o[n] = v; } }
    else o = clone_(DEFAULT_BONUS[it[0]]);
    S.bonus[it[0]] = o;
  });
  // 미션 설정
  var mrows = {};
  rows_('settings', 'missions').forEach(function (r) { var k = null, v = str_(r.mission); for (var x in MISSION_NAMES) if (x === v || MISSION_NAMES[x] === v) k = x; if (k) mrows[k] = r; });
  MISSION_DEFAULTS.forEach(function (d) {
    var r = mrows[d[0]], dl = r ? str_(r.deadline) : '';
    var m = { key: d[0], name: r && str_(r.name) ? str_(r.name) : MISSION_NAMES[d[0]], order: r && str_(r.order) ? num_(r.order) : d[1],
              on: r && str_(r.on) !== '' ? yes_(r.on) : d[2], required: r && str_(r.required) !== '' ? yes_(r.required) : d[3],
              deadline: d[0] === 'weekly' ? 'week' : (/당일|today|24/.test(dl) ? 'today' : /다음|next/.test(dl) ? 'next' : d[4]) };
    if (d[0] === 'weekly') m.required = false;
    S.missions.byKey[d[0]] = m;
  });
  S.missions.list = MISSION_DEFAULTS.map(function (d) { return S.missions.byKey[d[0]]; }).filter(function (m) { return m.key !== 'weekly'; })
    .sort(function (a, b) { return a.order - b.order || MISSIONS.indexOf(a.key) - MISSIONS.indexOf(b.key); });
  // 미니게임 목록 · 보상
  var gRows = rows_('settings', 'games').slice().sort(function (a, b) { return num_(a.order) - num_(b.order); });
  gRows.forEach(function (r) { var g = gameKey_(r.game); if (g && S.games.order.indexOf(g) < 0) { S.games.order.push(g); S.games.enabled[g] = str_(r.on) === '' ? true : yes_(r.on); } });
  GAME_IDS.forEach(function (g) { if (S.games.order.indexOf(g) < 0) { S.games.order.push(g); S.games.enabled[g] = true; } });
  var rw = {};
  rows_('settings', 'rewards').forEach(function (r) { var g = gameKey_(r.game); if (g) { rw[g] = rw[g] || {}; rw[g][str_(r.key)] = r.value; } });
  GAME_IDS.forEach(function (g) {
    S.games.cfg[g] = {};
    GAME_FIELDS[g].forEach(function (f) { var raw = rw[g] ? rw[g][f[1]] : undefined; setPath_(S.games.cfg[g], f[0], raw === undefined ? clone_(f[3]) : fieldParse_(f[2], raw, clone_(f[3]))); });
  });
  rows_('settings', 'schedule').forEach(function (r) {
    var d = parseDate_(r.date);
    if (!d) return;
    var gs = str_(r.games).split(/[,/·]+/).map(function (x) { return gameKey_(x.trim()); }).filter(function (g, i, a) { return g && a.indexOf(g) === i; }).slice(0, 2);
    if (gs.length) S.games.schedule[d] = gs;
  });
  rows_('settings', 'holidays').forEach(function (r) { var d = parseDate_(r.date); if (d) S.holidays[d] = str_(r.reason) || '전체 휴일'; });
  var tx = {};
  rows_('settings', 'texts').forEach(function (r) { tx[str_(r.key)] = r.value; });
  TEXT_FIELDS.forEach(function (f) { var v = tx[f[1]]; S.texts[f[0]] = v === undefined ? f[2] : String(v); });
  rows_('settings', 'access').forEach(function (r) {
    var f = str_(r.feature), key = ACCESS[f] ? f : null;
    if (!key) for (var k in ACCESS) if (accessDesc_(k, null) === accessDesc_(f, null, true)) key = k;
    var rk = rankParse_(r.rank);
    if (key && rk !== null && LOCKED_ACCESS.indexOf(key) < 0) S.access[key] = rk;
  });
  CTX.settings = S;
  return S;
}
function rewardsOf_() { return settings_().rewards; }

// ---------- 설정 표 다시 쓰기 ----------
function writeBasic_(S) {
  replaceAll_('settings', 'basic', BASIC_FIELDS.map(function (f) {
    var v = f[0].indexOf('r.') === 0 ? S.rewards[f[0].slice(2)] : f[0].indexOf('g.') === 0 ? S.games[f[0].slice(2)] :
            f[0].indexOf('budget.') === 0 ? S.budget[f[0].slice(7)] : f[0].indexOf('banner.') === 0 ? S.banner[f[0].slice(7)] : S[f[0]];
    if (v === undefined) v = f[2];
    if (f[4] === 'list' && Array.isArray(v)) v = v.join(', ');
    return { key: f[1], value: v, note: f[3] };
  }));
}
function writeBonus_(S) {
  replaceAll_('settings', 'bonus', BONUS_ITEMS.map(function (it) {
    var o = { item: it[1] }, b = S.bonus[it[0]] || {};
    for (var n = 1; n <= 7; n++) o['d' + n] = b[n] ? b[n] : '';
    return o;
  }));
}
function writeMissions_(S) {
  replaceAll_('settings', 'missions', MISSION_DEFAULTS.map(function (d) {
    var m = S.missions.byKey[d[0]];
    return { mission: MISSION_NAMES[d[0]], name: m.name, order: m.order, on: m.on ? 'O' : 'X', required: d[0] === 'weekly' ? '' : (m.required ? 'O' : 'X'), deadline: DEADLINE_WORDS[m.deadline],
             note: d[0] === 'weekly' ? '이름만 바꿀 수 있어요' : '마감: 당일 24시 / 다음 날 마감 시각' };
  }));
}
function writeGames_(S) {
  replaceAll_('settings', 'games', S.games.order.map(function (g, i) { return { order: i + 1, game: GAME_NAMES[g], on: S.games.enabled[g] === false ? 'X' : 'O' }; }));
  var rw = [];
  GAME_IDS.forEach(function (g) { GAME_FIELDS[g].forEach(function (f) { var v = getPath_(S.games.cfg[g], f[0]); rw.push({ game: GAME_NAMES[g], key: f[1], value: fieldStr_(f[2], v === undefined ? f[3] : v), note: f[2] === 'tiers' ? '예) 59=100, 89=90' : f[2] === 'list' ? '쉼표로 구분' : '' }); }); });
  replaceAll_('settings', 'rewards', rw);
}
function writeTexts_(S) {
  replaceAll_('settings', 'texts', TEXT_FIELDS.map(function (f) { return { key: f[1], value: S.texts[f[0]] === undefined ? f[2] : S.texts[f[0]], note: /^menu\./.test(f[0]) ? 'O 또는 X' : /^color\./.test(f[0]) ? '#으로 시작하는 색 코드' : '' }; }));
}
/** 기능 설명. {weeksAhead} 는 '미리 정할 수 있는 기간' 설정값으로 바꿔요. w 가 null 이면 비교용으로 그 부분을 지워요 */
function accessDesc_(k, w, raw) {
  var d = raw ? String(k) : String(ACCESS[k] ? ACCESS[k][2] : '');
  if (w === null) return d.replace(/\s*\(?\{weeksAhead\}\)?|\s*\(\d+주 뒤까지\)|\s*\(기간 제한 없음\)/g, '').trim();
  return d.replace('{weeksAhead}', w > 0 ? w + '주 뒤까지' : '기간 제한 없음');
}
function writeAccess_(S) {
  replaceAll_('settings', 'access', Object.keys(S.access).filter(function (k) { return ACCESS[k] && LOCKED_ACCESS.indexOf(k) < 0 && S.access[k] !== ACCESS[k][0]; })
    .map(function (k) { return { feature: k, rank: RANK_WORDS[S.access[k]], note: accessDesc_(k, S.weeksAhead) }; }));
}
/** 처음 설치 · 새 시즌: 설정 표 전부 쓰기 */
function writeAllSettings_(S) { writeBasic_(S); writeBonus_(S); writeMissions_(S); writeGames_(S); writeTexts_(S); writeAccess_(S); CTX.settings = null; }
function defaultSettingsObj_() {
  var keep = {};
  ['basic', 'bonus', 'missions', 'games', 'rewards', 'schedule', 'holidays', 'texts', 'access'].forEach(function (tk) { var k = 'settings/' + tk; keep[k] = CTX.cache[k]; CTX.cache[k] = []; delete CTX.tabs[k]; });
  var old = CTX.settings, oldH = CTX.dayStartHour; CTX.settings = null;
  var S = clone_(settings_());
  Object.keys(keep).forEach(function (k) { CTX.cache[k] = keep[k]; delete CTX.tabs[k]; });
  CTX.settings = old; CTX.dayStartHour = oldH;
  return S;
}

// ================================================================
// 6. 멤버 · 로그인 · 쓸 수 있는 기능
// ================================================================
function members_() {
  if (CTX.members) return CTX.members;
  var seen = {};
  CTX.members = rows_('members', 'members').filter(function (r) { return str_(r.id) && str_(r.name); }).map(function (r) {
    return { id: str_(r.id), name: str_(r.name), password: String(r.password === undefined ? '' : r.password), ops: opsParse_(r.ops),
             mentor: yes_(r.mentor), mentee: yes_(r.mentee), insta: str_(r.insta).replace(/^@/, ''), memo: str_(r.memo),
             status: memberStatusParse_(r.status), joinedAt: str_(r.joinedAt), session: str_(r.session), _row: r };
  }).filter(function (m) { if (seen[m.id]) return false; seen[m.id] = true; return true; });
  return CTX.members;
}
function member_(id) { var l = members_(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function saveMember_(m) {
  var r = m._row;
  r.id = m.id; r.name = m.name; r.password = m.password; r.ops = opsStr_(m.ops); r.mentor = yn_(m.mentor); r.mentee = yn_(m.mentee);
  r.insta = m.insta; r.memo = m.memo; r.status = MEMBER_STATUS_WORDS[m.status]; r.joinedAt = m.joinedAt; r.session = m.session || '';
  touch_('members', 'members', r);
}
function rankOf_(m) { var r = 0; (m.ops || []).forEach(function (t) { if (TAG_RANK[t] > r) r = TAG_RANK[t]; }); return r; }
function tagsOf_(m) {
  var t = (m.ops || []).slice().sort(function (a, b) { return TAG_SORT[a] - TAG_SORT[b]; });
  if (m.mentor) t.push('mentor');
  if (m.mentee) t.push('mentee');
  return t;
}
function sortKey_(m) { var k = 4; (m.ops || []).forEach(function (t) { if (TAG_SORT[t] < k) k = TAG_SORT[t]; }); return k; }
function sortMembers_(list) { return list.slice().sort(function (a, b) { return (sortKey_(a) - sortKey_(b)) || String(a.name).localeCompare(String(b.name), 'ko'); }); }
function activeMembers_() { return sortMembers_(members_().filter(function (m) { return m.status === 'active'; })); }
function pubMember_(m) { return m ? { id: m.id, name: m.name, tags: tagsOf_(m), insta: m.insta, mentor: m.mentor, mentee: m.mentee, status: m.status } : null; }
function nameOf_(id) { var m = member_(id); return m ? m.name : (id === 'system' ? '자동' : id === 'shop' ? '상점' : id); }
function whoStr_(id) { if (!id) return ''; if (id === 'system') return '자동'; if (id === 'shop') return '상점'; var m = member_(id); return m ? m.name + ' (' + id + ')' : id; }
function whoId_(s) { s = str_(s); if (!s) return ''; if (s === '자동') return 'system'; if (s === '상점') return 'shop'; var m = s.match(/\(([^()]+)\)\s*$/); return m ? m[1] : s; }
function devCount_() { return members_().filter(function (m) { return m.status === 'active' && m.ops.indexOf('dev') >= 0; }).length; }

// ---------- 기능별로 쓸 수 있는 사람 ----------
function accessRank_(f) {
  if (!ACCESS[f]) return 4;
  if (LOCKED_ACCESS.indexOf(f) >= 0) return 4;
  var o = settings_().access[f];
  return o === undefined ? ACCESS[f][0] : o;
}
function myRank_() { return CTX.me ? rankOf_(CTX.me) : 0; }
function can_(f) { if (!CTX.me) return false; var r = CTX.viewer ? rankOf_(CTX.viewer) : myRank_(); return CTX.viewer ? false : r >= accessRank_(f); }
function needAccess_(f) { if (!can_(f)) fail_('이 메뉴는 사용할 수 없어요.', 'PERM'); }
function canMap_() { var o = {}; Object.keys(ACCESS).forEach(function (f) { o[f] = can_(f); }); return o; }
function meInfo_(m) {
  var p = pubMember_(m);
  p.rank = rankOf_(m);
  p.balance = balance_(m.id);
  p.can = canMap_();
  if (CTX.viewer) { p.viewOnly = true; p.viewer = { id: CTX.viewer.id, name: CTX.viewer.name }; }
  return p;
}

function secret_() { var s = CTX.meta.token_secret; if (!s) fail_('서버 준비가 끝나지 않았어요. 잠시 후 다시 시도해 주세요.'); return s; }
function makeToken_(m) { return m.id + '.' + sha256_(secret_() + '|' + m.id + '|' + m.password + '|' + m.status + '|' + (m.session || '')); }
/** 멤버 화면으로 보기 (보기 전용) */
function makeViewToken_(target, dev) { return '@' + target.id + '@' + dev.id + '.' + sha256_(secret_() + '|view|' + target.id + '|' + dev.id + '|' + dev.password + '|' + (dev.session || '')); }
function tokenId_(token) {
  token = String(token || '');
  var i = token.lastIndexOf('.');
  if (i <= 0) return '';
  var head = token.slice(0, i);
  if (head.charAt(0) === '@') return head.split('@')[1] || '';
  return head;
}
function auth_(token) {
  token = String(token || '');
  if (!token) fail_('로그인이 필요해요.', 'AUTH');
  var i = token.lastIndexOf('.');
  if (i <= 0) fail_('다시 로그인해 주세요.', 'AUTH');
  var head = token.slice(0, i);
  if (head.charAt(0) === '@') {
    var p = head.split('@'), t = member_(p[1] || ''), dev = member_(p[2] || '');
    if (!t || !dev || dev.status !== 'active' || rankOf_(dev) < accessRank_('view.as') || makeViewToken_(t, dev) !== token) fail_('다시 로그인해 주세요.', 'AUTH');
    CTX.viewer = dev; CTX.viewOnly = true;
    return t;
  }
  var m = member_(head);
  if (!m || m.status !== 'active' || makeToken_(m) !== token) fail_('다시 로그인해 주세요.', 'AUTH');
  return m;
}
function requireLower_(t) {
  if (!t) fail_('멤버를 찾을 수 없어요.');
  if (can_('members.dev')) return;
  if (t.id === CTX.me.id) fail_('본인 계정에는 할 수 없어요.');
  if (rankOf_(t) >= myRank_()) fail_('이 멤버의 계정 정보는 바꿀 수 없어요.', 'PERM');
}
function notSelf_(id) { if (id === CTX.me.id) fail_('본인에게는 할 수 없어요.'); }

// ================================================================
// 7. 파이 · 활동 기록
// ================================================================
function ledgerKey_(name) { for (var k in LEDGER_TYPES) if (LEDGER_TYPES[k] === name) return k; if (name === '시트 수정 반영') return 'sheet'; return null; }
/** 잔액 = 멤버의 파이 내역 금액 합계 */
function balance_(id) {
  var k = 'member:' + id + '/ledger', s = 0;
  if ((CTX.tabs[k] && !CTX.tabs[k].stub) || (k in CTX.cache)) { rows_('member:' + id, 'ledger').forEach(function (r) { s += num_(r.amount); }); return s; }
  s = num_(q_('bal', { member: id }).sum);
  stubAppends_('member:' + id, 'ledger').forEach(function (r) { s += num_(r.amount); });
  return s;
}
function addPie_(memberId, amount, type, refDate, refItem, reason) {
  amount = Math.round(num_(amount));
  if (!amount) return;
  winsert_('member:' + memberId, 'ledger', { at: nowStamp_(), amount: amount, type: LEDGER_TYPES[type] || type, refDate: refDate || '',
    refItem: mname_(refItem) || GAME_NAMES[refItem] || refItem || '', by: whoStr_(CTX.me ? CTX.me.id : 'system'), reason: reason || '' });
}
function pubLedger_(r, memberId) {
  var t = ledgerKey_(str_(r.type)) || 'manual';
  return { id: str_(r._id), at: str_(r.at), ms: parseStamp_(r.at), memberId: memberId, name: nameOf_(memberId), amount: num_(r.amount), type: t, typeName: str_(r.type) || LEDGER_TYPES[t],
           refDate: parseDate_(r.refDate), refName: str_(r.refItem), by: whoId_(r.by), byName: nameOf_(whoId_(r.by)), reason: str_(r.reason) };
}
var ACTION_LABELS = {
  'judge': '미션 판정', 'judge.self': '본인 미션 판정', 'attend.proxy': '출석 대신 처리', 'pie.adjust': '파이 직접 지급·회수',
  'warn.give': '경고 주기', 'warn.cancel': '경고 취소', 'warn.skip': '경고 후보 넘어가기', 'warn.unskip': '넘어간 경고 후보 되돌리기', 'warn.edit': '경고 고치기',
  'member.expel': '퇴출', 'member.delete': '멤버 삭제', 'member.restore': '멤버 다시 활성화', 'member.purge': '기록까지 완전 삭제', 'member.create': '멤버 추가',
  'member.update': '멤버 정보 수정', 'tag.change': '태그 변경', 'member.rename': '아이디 바꾸기', 'member.merge': '계정 합치기', 'member.logout': '모든 기기 로그아웃',
  'dayoff.request': '데이오프 신청', 'dayoff.assign': '데이오프 지정', 'dayoff.cancel': '데이오프 취소', 'holiday.save': '전체 휴일 지정', 'holiday.delete': '전체 휴일 취소',
  'password.view': '비밀번호 보기', 'password.reset': '비밀번호 새로 정하기', 'password.change': '비밀번호 변경',
  'product.save': '상품 저장', 'shop.buy': '상점 구매', 'shop.deliver': '지급 완료', 'shop.cancel': '구매 취소', 'quest.save': '퀘스트 저장', 'quest.delete': '퀘스트 삭제',
  'game.config': '미니게임 설정', 'game.schedule': '날짜별 미니게임', 'game.extra': '미니게임 기회 더 주기', 'game.playEdit': '미니게임 기록 고치기',
  'settle.confirm': '주간 정산', 'settle.cancel': '주간 정산 취소', 'notice.save': '공지 저장', 'notice.delete': '공지 삭제',
  'post.hide': '글 숨김', 'post.unhide': '글 숨김 해제', 'post.delete': '글 삭제', 'post.edit': '글 고치기', 'post.clearReactions': '반응 지우기',
  'settings.save': '시스템 설정', 'missions.save': '미션 설정', 'texts.save': '화면 문구 설정', 'access.save': '기능별로 쓸 수 있는 사람', 'season.edit': '시즌 정보 수정',
  'season.reset': '전체 초기화(새 시즌)', 'season.start': '시즌 시작', 'pie.editRow': '파이 내역 고치기', 'pie.deleteRow': '파이 내역 지우기', 'pie.setBalance': '잔액 맞추기',
  'pie.recalc': '파이 다시 계산', 'data.save': '데이터 직접 고치기', 'data.undo': '되돌리기', 'data.import': '엑셀(CSV) 올리기', 'backup.restore': '백업으로 되돌리기',
  'data.fix': '데이터 점검 맞추기', 'data.prune': '오래된 기록 정리', 'view.as': '멤버 화면으로 보기', 'maintenance': '점검 중 모드'
};
function log_(action, targetId, before, after, reason) {
  winsert_('logs', 'logs', { at: nowStamp_(), actor: whoStr_(CTX.viewer ? CTX.viewer.id : CTX.me ? CTX.me.id : 'system'), action: ACTION_LABELS[action] || action,
    target: targetId ? whoStr_(targetId) : '', before: typeof before === 'object' && before !== null ? JSON.stringify(before) : str_(before),
    after: typeof after === 'object' && after !== null ? JSON.stringify(after) : str_(after), reason: str_(reason) });
}
/** 다음 번호 (읽어 온 표가 있으면 그 안에서, 아니면 저장된 최댓값 + 1) */
function nextId_(book, tk) {
  var k = book + '/' + tk, mx = 0;
  if ((CTX.tabs[k] && !CTX.tabs[k].stub) || (k in CTX.cache)) rows_(book, tk).forEach(function (r) { var n = parseInt(r.id, 10); if (n > mx) mx = n; });
  else { mx = num_(q_('maxid', { table: tabSpec_(k).table }).max); stubAppends_(book, tk).forEach(function (r) { var n = parseInt(r.id, 10); if (n > mx) mx = n; }); }
  return String(mx + 1);
}

// ================================================================
// 8. 날짜별 미션 기록
// ================================================================
function dayKey_(d) { return 'date:' + d; }
/** 기간 안의 날짜 목록 */
function existingDates_(from, to) {
  var out = [];
  if (!isDate_(from) || !isDate_(to)) return out;
  for (var d = from; d <= to && out.length < 400; d = addDays_(d, 1)) out.push(d);
  return out;
}
/** 날짜별 표 읽어 두기 (기본: 미션 · 지급 기록) */
function loadDays_(dates, tks) {
  tks = tks || ['grid', 'log'];
  var keys = [];
  dates.forEach(function (d) { tks.forEach(function (tk) { keys.push(dayKey_(d) + '/' + tk); }); });
  need_(keys);
}
function missionsOn_() { return settings_().missions.list.filter(function (m) { return m.on; }).map(function (m) { return m.key; }); }
function requiredList_() { var L = settings_().missions.byKey; return MISSIONS.filter(function (mi) { return L[mi].on && L[mi].required; }); }
function mname_(mi) { if (!mi) return ''; var S = CTX.settings; if (S && S.missions.byKey[mi]) return S.missions.byKey[mi].name; return MISSION_NAMES[mi] || ''; }
function gridFind_(date, mid, create) {
  var rs = rows_(dayKey_(date), 'grid');
  for (var i = 0; i < rs.length; i++) if (str_(rs[i].memberId) === mid) return rs[i];
  if (!create) return null;
  return insert_(dayKey_(date), 'grid', { memberId: mid, name: nameOf_(mid) });
}
function logFind_(date, mid, mi, create) {
  var rs = rows_(dayKey_(date), 'log');
  for (var i = 0; i < rs.length; i++) if (str_(rs[i].memberId) === mid && missionKey_(rs[i].mission) === mi) return rs[i];
  if (!create) return null;
  return insert_(dayKey_(date), 'log', { memberId: mid, name: nameOf_(mid), mission: MISSION_NAMES[mi], paidFor: '', pie: '0' });
}
function touchDay_(date, tk, row) { touch_(dayKey_(date), tk, row); }
function cellStatus_(g, mi) {
  if (!g) return { status: 'none', inputMin: null, finalMin: null };
  if (mi === 'hours') {
    var inp = parseMinutes_(g.hoursIn), fin = str_(g.hoursFinal);
    if (fin) {
      if (isFailWord_(fin)) return { status: 'fail', inputMin: inp, finalMin: null };
      var fm = parseMinutes_(fin);
      if (fm !== null) return { status: 'ok', inputMin: inp, finalMin: fm };
    }
    return { status: inp !== null ? 'pending' : 'none', inputMin: inp, finalMin: null };
  }
  return { status: parseStatus_(g[mi]), inputMin: null, finalMin: null };
}
function rec_(date, mid, mi) {
  if (mi === 'weekly') return weeklyRec_(date, mid);
  var g = gridFind_(date, mid), st = cellStatus_(g, mi), lg = logFind_(date, mid, mi);
  var jb = lg ? whoId_(lg.judgeBy) : '';
  return { date: date, memberId: mid, mission: mi, status: st.status, selfMarked: !!(lg && str_(lg.selfAt)), selfAt: lg ? str_(lg.selfAt) : '',
           inputMin: st.inputMin, finalMin: st.finalMin, pie: lg ? num_(lg.pie) : 0, judgeBy: jb, judgeName: jb ? nameOf_(jb) : '', judgeAt: lg ? str_(lg.judgeAt) : '' };
}
function paidKey_(mi, st) {
  if (st.status === 'ok') return mi === 'hours' ? fmtMinutes_(st.finalMin) : '인정';
  if (st.status === 'vague') return '애매함';
  if (st.status === 'fail') return '미수행';
  return '';
}
function normPaid_(s) {
  s = str_(s);
  if (!s) return '';
  if (/^\d/.test(s)) { var m = parseMinutes_(s); if (m !== null) return fmtMinutes_(m); }
  var p = parseStatus_(s);
  return p === 'ok' ? '인정' : p === 'vague' ? '애매함' : p === 'fail' ? '미수행' : '';
}
function pieFor_(mi, status, finalMin) {
  var R = settings_().rewards;
  if (status === 'vague') return mi === 'study' ? num_(R.studyVague) : 0;
  if (status !== 'ok') return 0;
  if (mi === 'hours') return Math.min(Math.floor(num_(finalMin) / 60), num_(R.hourCap)) * num_(R.hourPer);
  return num_(R[mi]);
}

/** 상태를 바꾸고 파이 차액을 반영합니다. to: none | pending | ok | vague | fail */
function setStatus_(date, mid, mi, to, finalMin, opts) {
  opts = opts || {};
  if (mi === 'weekly') return setWeekly_(date, mid, to, opts);
  var before = rec_(date, mid, mi);
  var g = gridFind_(date, mid, true);
  if (mi === 'hours') {
    if (opts.inputMin !== undefined) g.hoursIn = opts.inputMin === null ? '' : fmtMinutes_(opts.inputMin);
    if (to === 'ok') g.hoursFinal = fmtMinutes_(finalMin);
    else if (to === 'fail') g.hoursFinal = '미수행';
    else { g.hoursFinal = ''; if (to === 'none') g.hoursIn = ''; }
  } else g[mi] = STATUS_WORDS[to];
  touchDay_(date, 'grid', g);
  var lg = logFind_(date, mid, mi, true);
  var st = cellStatus_(g, mi);
  var newPie = pieFor_(mi, st.status, st.finalMin), diff = newPie - num_(lg.pie);
  lg.paidFor = paidKey_(mi, st);
  lg.pie = String(newPie);
  if (opts.selfAt !== undefined) lg.selfAt = opts.selfAt;
  if (to === 'none' || to === 'pending') { lg.judgeBy = ''; lg.judgeAt = ''; }
  else { lg.judgeBy = whoStr_(CTX.me.id); lg.judgeAt = nowStamp_(); }
  touchDay_(date, 'log', lg);
  if (diff) addPie_(mid, diff, (before.status === 'none' || before.status === 'pending') ? 'mission' : 'rejudge', date, mi, '');
  return before;
}

// ---------- 위클리 ----------
function weeklyRow_(week, mid, create) {
  var rs = rows_('quests', 'weekly');
  for (var i = 0; i < rs.length; i++) if (parseDate_(rs[i].week) === week && str_(rs[i].memberId) === mid) return rs[i];
  if (!create) return null;
  return insert_('quests', 'weekly', { week: week, memberId: mid, name: nameOf_(mid), status: '', selfAt: '', paidFor: '', pie: '0' });
}
function weeklyRec_(week, mid) {
  var r = weeklyRow_(week, mid);
  var st = r ? parseStatus_(r.status) : 'none', jb = r ? whoId_(r.judgeBy) : '';
  return { date: week, memberId: mid, mission: 'weekly', status: st, selfMarked: !!(r && str_(r.selfAt)), selfAt: r ? str_(r.selfAt) : '',
           inputMin: null, finalMin: null, pie: r ? num_(r.pie) : 0, judgeBy: jb, judgeName: jb ? nameOf_(jb) : '', judgeAt: r ? str_(r.judgeAt) : '' };
}
function setWeekly_(week, mid, to, opts) {
  var before = weeklyRec_(week, mid), r = weeklyRow_(week, mid, true);
  r.status = STATUS_WORDS[to];
  if (opts.selfAt !== undefined) r.selfAt = opts.selfAt;
  var newPie = to === 'ok' ? num_(settings_().rewards.weekly) : 0, diff = newPie - num_(r.pie);
  r.paidFor = to === 'ok' ? '인정' : (to === 'fail' ? '미수행' : '');
  r.pie = String(newPie);
  if (to === 'none' || to === 'pending') { r.judgeBy = ''; r.judgeAt = ''; } else { r.judgeBy = whoStr_(CTX.me.id); r.judgeAt = nowStamp_(); }
  touch_('quests', 'weekly', r);
  if (diff) addPie_(mid, diff, 'weekly', week, 'weekly', '');
  return before;
}

// ---------- 표에서 직접 고친 내용 반영 (Supabase 표 편집 · 데이터 편집기) ----------
function mismatches_(dates) {
  var out = [];
  dates.forEach(function (d) {
    var seen = {}, grid = rows_(dayKey_(d), 'grid'), log = rows_(dayKey_(d), 'log');
    grid.forEach(function (g) {
      var mid = str_(g.memberId);
      if (!mid || !member_(mid) || seen[mid + '|']) return;
      seen[mid + '|'] = true;
      MISSIONS.forEach(function (mi) {
        seen[mid + '|' + mi] = true;
        var lg = logFind_(d, mid, mi), want = paidKey_(mi, cellStatus_(g, mi));
        if (want !== (lg ? normPaid_(lg.paidFor) : '')) out.push({ date: d, memberId: mid, mission: mi });
      });
    });
    log.forEach(function (lg) {
      var mid = str_(lg.memberId), mi = missionKey_(lg.mission);
      if (!mi || mi === 'weekly' || seen[mid + '|' + mi] || !member_(mid)) return;
      if (normPaid_(lg.paidFor) !== '' || num_(lg.pie)) { seen[mid + '|' + mi] = true; out.push({ date: d, memberId: mid, mission: mi }); }
    });
  });
  return out;
}
function weeklyMismatches_() {
  if (!('quests/weekly' in CTX.cache)) return [];
  return rows_('quests', 'weekly').filter(function (r) {
    if (!member_(str_(r.memberId)) || !parseDate_(r.week)) return false;
    var st = parseStatus_(r.status), want = st === 'ok' ? '인정' : st === 'fail' ? '미수행' : '';
    return want !== normPaid_(r.paidFor);
  });
}
function syncDays_(dates) {
  var mm = mismatches_(dates), wk = weeklyMismatches_();
  mm.forEach(function (x) {
    var g = gridFind_(x.date, x.memberId), st = cellStatus_(g, x.mission), lg = logFind_(x.date, x.memberId, x.mission, true);
    var newPie = pieFor_(x.mission, st.status, st.finalMin), diff = newPie - num_(lg.pie);
    lg.paidFor = paidKey_(x.mission, st); lg.pie = String(newPie);
    touchDay_(x.date, 'log', lg);
    if (diff) addPie_(x.memberId, diff, 'sheet', x.date, x.mission, '표에서 직접 바꾼 상태 반영');
  });
  wk.forEach(function (r) {
    var st = parseStatus_(r.status), newPie = st === 'ok' ? num_(settings_().rewards.weekly) : 0, diff = newPie - num_(r.pie);
    r.paidFor = st === 'ok' ? '인정' : st === 'fail' ? '미수행' : ''; r.pie = String(newPie);
    touch_('quests', 'weekly', r);
    if (diff) addPie_(str_(r.memberId), diff, 'sheet', parseDate_(r.week), 'weekly', '표에서 직접 바꾼 상태 반영');
  });
  return mm.length + wk.length;
}

function lockedWeeks_() {
  var s = {};
  rows_('settle', 'list').forEach(function (r) { var w = parseDate_(r.week); if (w) s[weekOf_(w)] = true; });
  return s;
}
function isLocked_(date) { return !!lockedWeeks_()[weekOf_(date)]; }
/** 정산이 끝난 주인지 (정산 끝난 주 판정 고치기를 쓸 수 있으면 잠기지 않음) */
function lockedFor_(date) { return isLocked_(date) && !can_('judge.locked'); }
function selfDeadline_(date, mi) {
  var S = settings_(), m = S.missions.byKey[mi];
  if (mi === 'weekly') return kstAt_(addDays_(date, 7), S.deadlineHour);
  if (m && m.deadline === 'today') return dayEnd_(date);
  var dl = kstAt_(addDays_(date, 1), S.deadlineHour);
  return dl > dayEnd_(date) ? dl : dayEnd_(date);
}

// ================================================================
// 9. 퀘스트 · 데이오프 · 휴일 · 경고
// ================================================================
function questList_() {
  return rows_('quests', 'quests').map(function (r) {
    var w = parseDate_(r.week), dw = DOW_KO.indexOf(str_(r.dow).replace('요일', ''));
    return { id: str_(r.id), type: /위클리|weekly/i.test(r.type) ? 'weekly' : 'daily', week: w ? weekOf_(w) : '', dow: dw >= 0 ? dw : null, title: str_(r.title), desc: str_(r.desc), _row: r };
  }).filter(function (q) { return q.week && q.title; });
}
function pubQuest_(q) { return q ? { id: q.id, type: q.type, week: q.week, dow: q.dow, title: q.title, desc: q.desc } : null; }
function questsForWeek_(week) {
  var o = { daily: null, weekly: null, over: {} };
  questList_().forEach(function (q) {
    if (q.week !== week) return;
    if (q.type === 'weekly') o.weekly = q; else if (q.dow === null) o.daily = q; else o.over[q.dow] = q;
  });
  return o;
}
function dailyQuest_(date) { var w = questsForWeek_(weekOf_(date)); return w.over[dow_(date)] || w.daily || null; }
/** 미리 정할 수 있는 마지막 주 (개발자 등 기간 제한 없이 정할 수 있으면 null) */
function aheadLimit_() { return can_('anytime') ? null : addDays_(weekOf_(today_()), 7 * settings_().weeksAhead); }

function dayoffList_() {
  return rows_('dayoffs', 'dayoffs').filter(function (r) { return !yes_(r.canceled) && parseDate_(r.date) && member_(str_(r.memberId)); }).map(function (r) {
    return { id: str_(r.id), memberId: str_(r.memberId), name: nameOf_(str_(r.memberId)), date: parseDate_(r.date), mode: /본인/.test(r.mode) ? 'self' : 'admin',
             by: whoId_(r.by), byName: nameOf_(whoId_(r.by)), reason: str_(r.reason), at: str_(r.at), _row: r };
  });
}
function holidayOn_(date) { var h = settings_().holidays[date]; return h ? { id: '', memberId: '', date: date, mode: 'holiday', reason: h, byName: '', at: '' } : null; }
function dayoffOn_(mid, date) {
  var d = dayoffList_().filter(function (x) { return x.memberId === mid && x.date === date; })[0];
  if (d) return d;
  var h = holidayOn_(date);
  if (h) { h.memberId = mid; h.name = nameOf_(mid); }
  return h;
}
function strip_(o) { var x = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') x[k] = o[k]; }); return x; }
var pubDayoff_ = strip_;
/** 기간 안의 데이오프 + 전체 휴일 (멤버마다) */
function dayoffsWithHolidays_(from, to, members) {
  var list = dayoffList_().filter(function (d) { return d.date >= from && d.date <= to; }).map(pubDayoff_), have = {};
  list.forEach(function (d) { have[d.date + '|' + d.memberId] = true; });
  Object.keys(settings_().holidays).forEach(function (date) {
    if (date < from || date > to) return;
    members.forEach(function (m) { if (!have[date + '|' + m.id]) list.push({ id: '', memberId: m.id, name: m.name, date: date, mode: 'holiday', reason: settings_().holidays[date], byName: '', at: '' }); });
  });
  return list;
}

function warningList_() {
  return rows_('warnings', 'warnings').filter(function (r) { return str_(r.memberId); }).map(function (r) {
    var cb = whoId_(r.canceledBy);
    return { id: str_(r.id), memberId: str_(r.memberId), name: nameOf_(str_(r.memberId)), reason: str_(r.reason), refDate: parseDate_(r.refDate), refName: str_(r.refMission),
             by: whoId_(r.by), byName: nameOf_(whoId_(r.by)), at: str_(r.at), canceled: yes_(r.canceled), canceledBy: cb, canceledByName: cb ? nameOf_(cb) : '',
             canceledAt: str_(r.canceledAt), cancelReason: str_(r.cancelReason), _row: r };
  });
}
function activeWarnings_(mid) { return warningList_().filter(function (w) { return w.memberId === mid && !w.canceled; }); }
var pubWarning_ = strip_;

/** 경고 후보: 멘티가 필수 미션을 '미수행'으로 확정받은 날 (데이오프 · 전체 휴일 제외). 한 사람당 하루에 하나 */
function warnCandidates_() {
  var today = today_(), dates = existingDates_(addDays_(today, -28), today);
  need_(['warnings', 'dayoffs']);
  loadDays_(dates, ['grid']);
  var used = {}, skipped = {}, req = requiredList_();
  warningList_().forEach(function (w) { if (w.refDate) used[w.refDate + '|' + w.memberId] = true; });
  rows_('warnings', 'skips').forEach(function (s) { skipped[parseDate_(s.date) + '|' + str_(s.memberId)] = true; });
  var out = [];
  dates.forEach(function (d) {
    rows_(dayKey_(d), 'grid').forEach(function (g) {
      var m = member_(str_(g.memberId));
      if (!m || m.status !== 'active' || !m.mentee) return;
      var key = d + '|' + m.id;
      if (used[key] || skipped[key] || dayoffOn_(m.id, d)) return;
      var missed = req.filter(function (mi) { return cellStatus_(g, mi).status === 'fail'; });
      if (!missed.length) return;
      used[key] = true;
      out.push({ key: key, date: d, memberId: m.id, name: m.name, missions: missed, missionName: missed.map(function (x) { return mname_(x); }).join(' · '),
                 warnings: activeWarnings_(m.id).length });
    });
  });
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.name).localeCompare(String(b.name), 'ko'); });
  return out;
}
function expelTargets_() {
  var lim = num_(settings_().expelAt);
  return activeMembers_().map(function (m) { return { memberId: m.id, name: m.name, warnings: activeWarnings_(m.id).length }; }).filter(function (x) { return x.warnings >= lim; });
}

// ================================================================
// 10. 화면 조립
// ================================================================
function dayView_(m, date) {
  var now = nowMs_(), today = today_(), q = dailyQuest_(date), locked = isLocked_(date), off = dayoffOn_(m.id, date), req = requiredList_();
  var items = missionsOn_().map(function (mi) {
    var p = rec_(date, m.id, mi), dl = selfDeadline_(date, mi), open = date <= today && now < dl && !locked;
    p.name = mname_(mi); p.required = m.mentee && req.indexOf(mi) >= 0; p.deadline = dl; p.closed = !open;
    p.canMark = open && (p.status === 'none' || (mi === 'hours' && p.status === 'pending')) && (mi !== 'daily' || !!q);
    p.canUnmark = open && p.status === 'pending' && p.selfMarked;
    return p;
  });
  return { date: date, dayoff: off ? pubDayoff_(off) : null, quest: pubQuest_(q), locked: locked, items: items };
}
function weeklyView_(m, week) {
  var q = questsForWeek_(week).weekly, p = weeklyRec_(week, m.id), dl = selfDeadline_(week, 'weekly');
  var open = week <= today_() && nowMs_() < dl && !isLocked_(week);
  p.name = mname_('weekly'); p.deadline = dl; p.closed = !open;
  p.canMark = open && !!q && p.status === 'none';
  p.canUnmark = open && p.status === 'pending' && p.selfMarked;
  return { week: week, quest: pubQuest_(q), rec: p };
}
function weekRanking_(week) {
  var to = addDays_(week, 6), mins = {}, dates = existingDates_(week, to);
  loadDays_(dates, ['grid']);
  dates.forEach(function (d) {
    rows_(dayKey_(d), 'grid').forEach(function (g) { var st = cellStatus_(g, 'hours'); if (st.status === 'ok') mins[str_(g.memberId)] = (mins[str_(g.memberId)] || 0) + st.finalMin; });
  });
  var bonus = settings_().rankBonus;
  var list = activeMembers_().filter(function (m) { return (mins[m.id] || 0) > 0; }).map(function (m) { return { memberId: m.id, name: m.name, tags: tagsOf_(m), minutes: mins[m.id] }; });
  list.sort(function (a, b) { return b.minutes - a.minutes || String(a.name).localeCompare(String(b.name), 'ko'); });
  list.forEach(function (x) { x.rank = 1 + list.filter(function (y) { return y.minutes > x.minutes; }).length; x.bonus = num_(bonus[x.rank - 1]); });
  return list;
}
function weekDates_(week) { var a = []; for (var i = 0; i < 7; i++) a.push(addDays_(week, i)); return a; }
function streaks_(m) {
  var today = today_(), map = {};
  q_('memberGrid', { member: m.id, from: addDays_(today, -60), to: today }).forEach(function (g) { ['attend', 'study'].forEach(function (mi) { map[g._date + mi] = cellStatus_(g, mi).status; }); });
  function run(mi, okSet) {
    var d = today, n = 0;
    if (okSet.indexOf(map[d + mi]) < 0) d = addDays_(d, -1);
    while (okSet.indexOf(map[d + mi]) >= 0) { n++; d = addDays_(d, -1); }
    return n;
  }
  return { attend: run('attend', ['ok']), study: run('study', ['ok', 'vague', 'pending']) };
}

// ---------- 미니게임 ----------
/** 그날 열리는 게임 (정해 둔 게임이 있으면 그것, 없으면 켜진 게임을 순서대로 돌아가며 1개) */
function todayGames_(date) {
  var G = settings_().games, s = G.schedule[date];
  if (s && s.length) return s.slice(0, 2);
  var list = G.order.filter(function (g) { return G.enabled[g] !== false; });
  if (!list.length) return [];
  return [list[((dayNum_(date) % list.length) + list.length) % list.length]];
}
function extraChances_(mid, date) {
  var n = 0;
  rows_(dayKey_(date), 'extra').forEach(function (r) { if (str_(r.memberId) === mid) n += Math.round(num_(r.n)); });
  return n;
}
function chances_(m, date) {
  var G = settings_().games, r = rec_(date, m.id, 'study');
  var got = r.selfMarked || r.status === 'pending' || r.status === 'ok' || r.status === 'vague', extra = extraChances_(m.id, date);
  return { base: num_(G.baseChances), bonus: got ? num_(G.bonusChances) : 0, bonusAvailable: num_(G.bonusChances), extra: extra,
           total: Math.max(0, num_(G.baseChances) + (got ? num_(G.bonusChances) : 0) + extra) };
}
function playsOf_(mid, date) { return rows_(dayKey_(date), 'plays').filter(function (p) { return str_(p.memberId) === mid; }); }
function pubPlay_(p, date) {
  return { id: str_(p.id), rowId: str_(p._id), memberId: str_(p.memberId), name: nameOf_(str_(p.memberId)), date: date, game: gameKey_(p.game), gameName: str_(p.game),
           round: num_(p.round), startedAt: str_(p.startedAt), finishedAt: str_(p.finishedAt), pie: num_(p.pie), status: /완료/.test(p.status) ? 'done' : 'started', resultText: str_(p.result) };
}
function gameState_(m, date) {
  loadDays_([date], ['grid', 'log', 'plays', 'extra']);
  var G = settings_().games, games = todayGames_(date), plays = playsOf_(m.id, date), ch = chances_(m, date), earned = 0, cfgs = {};
  plays.forEach(function (p) { earned += num_(p.pie); });
  games.forEach(function (g) { cfgs[g] = G.cfg[g]; });
  return { date: date, games: games, gameNames: games.map(function (g) { return GAME_NAMES[g]; }), cfgs: cfgs,
           game: games[0] || null, gameName: games.map(function (g) { return GAME_NAMES[g]; }).join(' · '), cfg: games[0] ? G.cfg[games[0]] : null,
           chances: ch, used: plays.length, remaining: Math.max(0, ch.total - plays.length), earned: earned, maxPerPlay: num_(G.maxPerPlay),
           maxPerDay: num_(G.maxPerPlay) * ch.total, plays: plays.map(function (p) { return pubPlay_(p, date); }) };
}
function tier_(tiers, v, dflt, cmp) { for (var i = 0; i < tiers.length; i++) if (cmp(v, tiers[i][0])) return num_(tiers[i][1]); return num_(dflt); }
function computeGamePie_(game, r, preset, c, maxPer) {
  r = r || {}; var p = 0;
  switch (game) {
    case 'roulette': p = num_(c.table[preset.dir]); break;
    case 'treasure': p = num_(preset.value); break;
    case 'rps': p = num_(c.base); (r.rounds || []).slice(0, num_(c.rounds) || 3).forEach(function (x) { p += x === 'w' ? num_(c.win) : x === 'd' ? num_(c.draw) : num_(c.lose); }); break;
    case 'mines':
      p = r.success ? tier_(c.success, Math.floor(num_(r.timeSec)), c.successElse, function (v, t) { return v <= t; })
                    : tier_(c.fail, num_(r.correctFlags), c.failElse, function (v, t) { return v <= t; });
      break;
    case 'g2048': p = tier_(c.tiers, num_(r.maxTile), c['else'], function (v, t) { return v >= t; }); break;
    case 'metronome':
      p = num_(c.base);
      (r.deltas || []).slice(0, num_(c.taps) || 3).forEach(function (d) {
        if (d === null || d === undefined || d === '') return;
        var a = Math.abs(num_(d));
        p += a <= c.windows.PERFECT ? num_(c.PERFECT) : a <= c.windows.GREAT ? num_(c.GREAT) : a <= c.windows.GOOD ? num_(c.GOOD) : num_(c.MISS);
      });
      break;
    case 'darts':
      (r.throws || []).slice(0, num_(c.throws) || 2).forEach(function (s) { s = Math.round(num_(s)); if (s === 50 || (s >= 0 && s <= 20) || (s <= 40 && s > 0 && s % 2 === 0)) p += s; });
      break;
    case 'stopwatch':
      p = !r.stopped ? num_(c['else']) : tier_(c.tiers, Math.round(Math.abs(num_(r.elapsedMs) - num_(c.targetSec) * 1000)) / 1000, c['else'], function (v, t) { return v <= t + 1e-9; });
      break;
    case 'cards': p = (r.success && num_(r.tries) <= num_(c.maxTries)) ? tier_(c.success, num_(r.tries), 0, function (v, t) { return v <= t; }) : Math.min(num_(r.pairs) * num_(c.perPair), num_(c.failCap)); break;
    case 'updown': p = (r.success && num_(r.guesses) >= 1 && num_(r.guesses) <= num_(c.guesses)) ? Math.max(num_(c.min), num_(c.first) - num_(c.step) * (num_(r.guesses) - 1)) : num_(c.fail); break;
  }
  return Math.max(0, Math.min(Math.round(p), maxPer));
}
var DIR_KO = { N: '북', NE: '북동', E: '동', SE: '남동', S: '남', SW: '남서', W: '서', NW: '북서' };
function describeResult_(game, r, preset) {
  r = r || {};
  switch (game) {
    case 'roulette': return preset.dir + ' (' + DIR_KO[preset.dir] + ')';
    case 'treasure': return '상자 ' + ((num_(r.box) || 0) + 1) + ' → ' + preset.value;
    case 'rps': return (r.rounds || []).map(function (x) { return { w: '승', d: '무', l: '패' }[x] || ''; }).join(' ') || '진행 없음';
    case 'mines': return r.success ? '성공 ' + Math.floor(num_(r.timeSec)) + '초' : '실패 · 정답 깃발 ' + num_(r.correctFlags) + '개';
    case 'g2048': return '최고 타일 ' + num_(r.maxTile);
    case 'metronome': return (r.deltas || []).map(function (d) { return d === null || d === undefined ? 'MISS' : (d > 0 ? '+' : '') + Math.round(d) + '/1000초'; }).join(', ');
    case 'darts': return (r.labels || r.throws || []).join(', ') || '던지지 않음';
    case 'stopwatch': return r.stopped ? (num_(r.elapsedMs) / 1000).toFixed(2) + '초' : '멈추지 않음';
    case 'cards': return r.success ? '성공 ' + r.tries + '번 시도' : '실패 · ' + num_(r.pairs) + '쌍';
    case 'updown': return r.success ? r.guesses + '번 만에 성공' : '실패';
  }
  return '';
}

// ---------- 상점 ----------
function productList_() {
  return rows_('shop', 'products').filter(function (r) { return str_(r.id) && str_(r.name); }).map(function (r) {
    var st = str_(r.stock);
    return { id: str_(r.id), name: str_(r.name), desc: str_(r.desc), price: num_(r.price), type: /경고/.test(r.type) ? 'warn' : 'normal',
             stock: st === '' || /무제한/.test(st) ? null : num_(st), limitType: /주/.test(r.limitType) ? 'weekly' : /전체|기간/.test(r.limitType) ? 'total' : 'none',
             limitN: num_(r.limitN), status: /숨김|중지|삭제/.test(r.status) ? 'hidden' : 'on', at: str_(r.at), _row: r };
  });
}
var pubProduct_ = strip_;
function writeProduct_(p) {
  var r = p._row;
  r.name = p.name; r.desc = p.desc; r.price = String(p.price); r.type = p.type === 'warn' ? '경고 차감' : '일반';
  r.stock = p.stock === null ? '' : String(p.stock); r.limitType = { none: '없음', total: '전체 기간', weekly: '주당' }[p.limitType];
  r.limitN = p.limitType === 'none' ? '' : String(p.limitN); r.status = p.status === 'hidden' ? '숨김' : '판매 중';
  touch_('shop', 'products', r);
}
function purchaseList_() {
  return rows_('shop', 'purchases').filter(function (r) { return str_(r.id); }).map(function (r) {
    var by = whoId_(r.by);
    return { id: str_(r.id), memberId: str_(r.memberId), name: nameOf_(str_(r.memberId)), productId: str_(r.productId), productName: str_(r.productName),
             price: num_(r.price), type: /경고/.test(r.type) ? 'warn' : 'normal', at: str_(r.at), status: /취소/.test(r.status) ? 'canceled' : /완료/.test(r.status) ? 'done' : 'waiting',
             by: by, byName: by ? nameOf_(by) : '', doneAt: str_(r.doneAt), warningId: str_(r.warningId), _row: r };
  });
}
var PURCHASE_WORDS = { waiting: '지급 대기', done: '지급 완료', canceled: '취소' };
var pubPurchase_ = strip_;
function myCounts_(mid, pid) {
  var wk = weekOf_(today_()), all = 0, week = 0;
  purchaseList_().forEach(function (x) { if (x.memberId !== mid || x.productId !== pid || x.status === 'canceled') return; all++; var d = stampDate_(x.at); if (d && weekOf_(d) === wk) week++; });
  return { all: all, week: week };
}

// ---------- 주간 정산 ----------
var SETTLE_ITEMS = ['attend', 'study', 'problem', 'mentoring', 'daily'];
function settlePreview_(week) {
  if (!isDate_(week) || weekOf_(week) !== week) fail_('주의 시작(월요일) 날짜를 골라주세요.');
  if (week >= weekOf_(today_())) fail_('지난 주까지만 정산할 수 있어요.');
  var S = settings_(), to = addDays_(week, 6), dates = existingDates_(week, to), req = requiredList_();
  need_(['dayoffs', 'quests']);
  loadDays_(dates);
  syncDays_(dates);
  var members = activeMembers_(), pending = [], grayRequired = [], grayTotal = 0;
  var ranking = weekRanking_(week), rk = {};
  ranking.forEach(function (x) { rk[x.memberId] = x; });
  var on = missionsOn_();
  var rows = members.map(function (m) {
    var counts = {}, bonus = {}, total = 0;
    SETTLE_ITEMS.forEach(function (mi) { counts[mi] = 0; });
    dates.forEach(function (d) {
      var g = gridFind_(d, m.id);
      MISSIONS.forEach(function (mi) {
        var st = cellStatus_(g, mi).status;
        if (st === 'pending') pending.push({ date: d, memberId: m.id, name: m.name, mission: mi, missionName: mname_(mi) });
        if (st === 'none' && on.indexOf(mi) >= 0) {
          grayTotal++;
          if (m.mentee && req.indexOf(mi) >= 0 && !dayoffOn_(m.id, d)) grayRequired.push({ date: d, memberId: m.id, name: m.name, mission: mi, missionName: mname_(mi) });
        }
        if (counts[mi] !== undefined && (st === 'ok' || st === 'vague')) counts[mi]++;
      });
    });
    SETTLE_ITEMS.forEach(function (mi) { bonus[mi] = num_((S.bonus[mi] || {})[counts[mi]]); total += bonus[mi]; });
    var r = rk[m.id];
    total += r ? r.bonus : 0;
    return { memberId: m.id, name: m.name, tags: tagsOf_(m), counts: counts, bonus: bonus, minutes: r ? r.minutes : 0, rank: r ? r.rank : null, rankBonus: r ? r.bonus : 0, total: total };
  });
  return { week: week, to: to, locked: isLocked_(week), precheck: { pending: pending, grayTotal: grayTotal, grayRequired: grayRequired }, rows: rows, ranking: ranking };
}
function settledWeek_(week) {
  var t = rows_('sweek:' + week, 'rows'), row = rows_('settle', 'list').filter(function (r) { return parseDate_(r.week) === week; })[0];
  var rows = t.map(function (r) {
    var m = member_(str_(r.memberId));
    return { memberId: str_(r.memberId), name: str_(r.name), tags: m ? tagsOf_(m) : [],
             counts: { attend: num_(r.attend), study: num_(r.study), problem: num_(r.problem), mentoring: num_(r.mentoring), daily: num_(r.daily) },
             bonus: { attend: num_(r.bAttend), study: num_(r.bStudy), problem: num_(r.bProblem), mentoring: num_(r.bMentoring), daily: num_(r.bDaily) },
             minutes: parseMinutes_(r.minutes) || 0, rank: str_(r.rank) ? num_(r.rank) : null, rankBonus: num_(r.rankBonus), total: num_(r.total) };
  });
  var ranking = rows.filter(function (r) { return r.rank; }).sort(function (a, b) { return a.rank - b.rank; })
    .map(function (r) { return { memberId: r.memberId, name: r.name, tags: r.tags, minutes: r.minutes, rank: r.rank, bonus: r.rankBonus }; });
  return { week: week, to: addDays_(week, 6), locked: true, at: row ? str_(row.at) : '', byName: row ? nameOf_(whoId_(row.by)) : '', rows: rows, ranking: ranking };
}
function seasonStart_() { return parseDate_(CTX.meta.season_start) || addDays_(weekOf_(today_()), -56); }
function unsettledWeeks_() {
  var cur = weekOf_(today_()), locked = lockedWeeks_(), start = seasonStart_(), out = [];
  for (var i = 1; i <= 8; i++) { var w = addDays_(cur, -7 * i); if (addDays_(w, 6) < start) break; if (!locked[w]) out.push(w); }
  return out;
}

// ================================================================
// 11. 기능 목록 — 멤버 화면
//   need: 이 기능을 쓸 수 있는 사람 (ACCESS 표의 키). 없으면 로그인한 멤버 모두
//   write: 기록을 바꾸는 기능 (차례로 한 번에 하나씩 처리)
//   books: 미리 읽어 둘 표 묶음, pre(req, 아이디): 요청에 따라 미리 읽어 둘 표
// ================================================================
var ACTIONS = {};
function uiSettings_() {
  var S = settings_();
  return { groupName: S.groupName, deadlineHour: S.deadlineHour, dayStartHour: S.dayStartHour, rewards: S.rewards, bonus: S.bonus, rankBonus: S.rankBonus,
           expelAt: S.expelAt, dayoffPerWeek: S.dayoffPerWeek, weeksAhead: S.weeksAhead, banner: S.banner,
           missions: S.missions.list.map(function (m) { return { key: m.key, name: m.name, on: m.on, required: m.required, deadline: m.deadline }; }),
           weeklyName: S.missions.byKey.weekly.name, texts: S.texts };
}
function bootData_(me) {
  return { me: meInfo_(me), today: today_(), now: nowMs_(), version: VERSION, season: CTX.season, seasonName: CTX.meta.season_name || ('시즌 ' + CTX.season),
           settings: uiSettings_(), gameNames: GAME_NAMES, maintenance: CTX.meta.maintenance || '' };
}

ACTIONS['public.members'] = { auth: false, fn: function () {
  var S = settings_(), maint = CTX.meta.maintenance || '';
  var list = activeMembers_().filter(function (m) { return !maint || m.ops.indexOf('dev') >= 0; });
  return { groupName: S.groupName, texts: S.texts, maintenance: maint, members: list.map(function (m) { return { id: m.id, name: m.name, tags: tagsOf_(m) }; }) };
} };
ACTIONS['auth.login'] = { auth: false, pre: function (req) { return [qkey_('bal', { member: str_(req.id) })]; }, fn: function (req) {
  var m = member_(str_(req.id));
  if (!m || m.status !== 'active') fail_('계정을 찾을 수 없어요.');
  if (m.password !== String(req.pw)) fail_('비밀번호가 맞지 않아요.');
  if (CTX.meta.maintenance && accessRank_('maintenance') > rankOf_(m)) fail_(CTX.meta.maintenance, 'MAINT');
  CTX.me = m;
  var b = bootData_(m);
  b.token = makeToken_(m);
  return b;
} };
ACTIONS['boot'] = { pre: function (req, id) { return [qkey_('bal', { member: id })]; }, fn: function (req, me) { return bootData_(me); } };

// ---------- 홈 · 미션 ----------
ACTIONS['home'] = { books: ['quests', 'dayoffs', 'board', 'warnings', 'settle'],
  pre: function (req, id) {
    var t = today_(), y = addDays_(t, -1);
    return [dayKey_(t) + '/grid', dayKey_(t) + '/log', dayKey_(t) + '/plays', dayKey_(t) + '/extra', dayKey_(y) + '/grid', dayKey_(y) + '/log',
            qkey_('bal', { member: id }), qkey_('posts', { limit: 3 })];
  },
  fn: function (req, me) {
    var S = settings_(), today = today_(), now = nowMs_(), hour = new Date(now + KST_MS).getUTCHours(), yday = addDays_(today, -1);
    loadDays_([today, yday]);
    syncDays_([today, yday]);
    var view = dayView_(me, today), week = weekOf_(today), weekly = weeklyView_(me, week), game = gameState_(me, today), banners = [];
    if (hour >= S.banner.evening && now < dayEnd_(today)) {
      var att = view.items.filter(function (x) { return x.mission === 'attend'; })[0];
      if (att && att.status === 'none' && att.canMark) banners.push({ kind: 'today', text: '오늘 ' + att.name + '을(를) 아직 안 했어요', deadline: att.deadline });
      if (game.games.length && game.remaining > 0) banners.push({ kind: 'game', text: '오늘 미니게임 기회 ' + game.remaining + '회 남음', deadline: dayEnd_(today) });
    }
    var yDeadline = selfDeadline_(yday, 'study');
    if (hour >= S.banner.morning && now < yDeadline) {
      var left = dayView_(me, yday).items.filter(function (it) { return it.mission !== 'attend' && it.status === 'none' && it.canMark; });
      if (left.length) banners.push({ kind: 'yesterday', date: yday, text: '어제 ' + left.map(function (x) { return x.name; }).join(' · ') + ' 체크 마감', deadline: yDeadline });
    }
    var lastWeekly = null;
    if (dow_(today) === 0 && now < kstAt_(today, S.deadlineHour)) {
      lastWeekly = weeklyView_(me, addDays_(week, -7));
      if (hour >= S.banner.morning && lastWeekly.quest && lastWeekly.rec.canMark) banners.push({ kind: 'weekly', text: '지난주 위클리 퀘스트 체크 마감', deadline: lastWeekly.rec.deadline, week: lastWeekly.week });
    }
    var notices = rows_('board', 'notices').filter(function (n) { return str_(n.title) && !yes_(n.deleted) && !yes_(n.draft); });
    var isNew = function (n) { return now - parseStamp_(n.at) < 3 * 86400000; };
    var pinned = notices.filter(function (n) { return yes_(n.pinned); }).sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); })
      .map(function (n) { return { id: str_(n.id), title: str_(n.title), important: yes_(n.important), at: str_(n.at), isNew: isNew(n) }; });
    var posts = q_('posts', { limit: 3 }).rows.map(function (p) {
      return { id: str_(p.id), text: str_(p.text), at: str_(p.at), author: pubMember_(member_(str_(p.memberId))) || { id: str_(p.memberId), name: str_(p.name), tags: [] } };
    });
    var out = { today: today, now: now, day: view, weekly: weekly, lastWeekly: lastWeekly, game: game, banners: banners, pinned: pinned,
             newNotices: notices.filter(isNew).length, posts: posts, balance: balance_(me.id), warnings: activeWarnings_(me.id).length, expelAt: S.expelAt, homeNotice: S.texts.homeNotice || '' };
    if (req.boot) out.boot = bootData_(me);   // 앱을 열 때 내 정보까지 한 번에
    return out;
  } };

ACTIONS['mission.day'] = { books: ['quests', 'dayoffs', 'settle'], pre: function (req) { return isDate_(req.date) ? [dayKey_(req.date) + '/grid', dayKey_(req.date) + '/log'] : []; }, fn: function (req, me) {
  if (!isDate_(req.date)) fail_('날짜가 올바르지 않아요.');
  loadDays_([req.date]);
  syncDays_([req.date]);
  return { day: dayView_(me, req.date), weekly: weeklyView_(me, weekOf_(req.date)) };
} };

ACTIONS['mission.mark'] = { write: true, books: ['quests', 'dayoffs', 'settle'], pre: function (req) { return isDate_(req.date) ? [dayKey_(req.date) + '/grid', dayKey_(req.date) + '/log'] : []; }, fn: function (req, me) {
  var mi = req.mission, date = req.date;
  if (MISSIONS.indexOf(mi) < 0 && mi !== 'weekly') fail_('알 수 없는 미션이에요.');
  if (mi !== 'weekly' && missionsOn_().indexOf(mi) < 0) fail_('지금은 쓰지 않는 미션이에요.');
  if (!isDate_(date)) fail_('날짜가 올바르지 않아요.');
  if (mi === 'weekly') date = weekOf_(date);
  if (date > today_()) fail_('아직 오지 않은 날에는 체크할 수 없어요.');
  if (isLocked_(date)) fail_('정산이 끝난 주예요.');
  if (nowMs_() >= selfDeadline_(date, mi)) fail_('체크 마감 시간이 지났어요.');
  if (mi === 'daily' && !dailyQuest_(date)) fail_('이 날의 데일리 퀘스트가 아직 없어요.');
  if (mi === 'weekly' && !questsForWeek_(date).weekly) fail_('이번 주 위클리 퀘스트가 아직 없어요.');
  if (mi !== 'weekly') loadDays_([date]);
  var r = rec_(date, me.id, mi);
  if (!(r.status === 'none' || (mi === 'hours' && r.status === 'pending'))) fail_('이미 확인된 항목이에요.');
  var stamp = nowStamp_();
  if (mi === 'hours') {
    var min = Math.round(num_(req.inputMin));
    if (min <= 0 || min > 1440) fail_('공부시간을 올바르게 입력하세요.');
    setStatus_(date, me.id, 'hours', 'pending', null, { inputMin: min, selfAt: stamp });
  } else if (mi === 'attend') {
    setStatus_(date, me.id, 'attend', 'ok', null, { selfAt: stamp });
  } else {
    setStatus_(date, me.id, mi, 'pending', null, { selfAt: stamp });
  }
  if (mi === 'weekly') return { weekly: weeklyView_(me, date) };
  return { day: dayView_(me, date) };
} };

ACTIONS['mission.unmark'] = { write: true, books: ['quests', 'dayoffs', 'settle'], fn: function (req, me) {
  var mi = req.mission, date = mi === 'weekly' ? weekOf_(req.date) : req.date;
  if (!isDate_(date)) fail_('날짜가 올바르지 않아요.');
  if (mi !== 'weekly') loadDays_([date]);
  var r = rec_(date, me.id, mi);
  if (r.status !== 'pending' || !r.selfMarked) fail_('취소할 체크가 없어요.');
  if (nowMs_() >= selfDeadline_(date, mi)) fail_('체크 마감 시간이 지났어요.');
  if (isLocked_(date)) fail_('정산이 끝난 주예요.');
  setStatus_(date, me.id, mi, 'none', null, { selfAt: '', inputMin: null });
  if (mi === 'weekly') return { weekly: weeklyView_(me, date) };
  return { day: dayView_(me, date) };
} };

ACTIONS['me.status'] = { books: ['quests', 'dayoffs', 'warnings', 'shop', 'settle'], pre: function (req, id) { var t = today_(), w = weekOf_(t), k = ['member:' + id, qkey_('memberGrid', { member: id, from: addDays_(t, -60), to: t })]; existingDates_(w, addDays_(w, 6)).forEach(function (d) { k.push(dayKey_(d) + '/grid', dayKey_(d) + '/log'); }); return k; }, fn: function (req, me) {
  var S = settings_(), today = today_(), week = weekOf_(today), to = addDays_(week, 6), dates = existingDates_(week, to);
  loadDays_(dates);
  need_(['member:' + me.id]);
  syncDays_(dates);
  var progress = {};
  SETTLE_ITEMS.forEach(function (mi) {
    var done = 0, pend = 0;
    dates.forEach(function (d) { var st = cellStatus_(gridFind_(d, me.id), mi).status; if (st === 'ok' || st === 'vague') done++; if (st === 'pending') pend++; });
    var b = S.bonus[mi] || {};
    progress[mi] = { name: mname_(mi), done: done, pending: pend, bonusNow: num_(b[done]), table: b };
  });
  var ranking = weekRanking_(week), mine = ranking.filter(function (x) { return x.memberId === me.id; })[0] || null, studyMin = 0;
  dates.forEach(function (d) { var st = cellStatus_(gridFind_(d, me.id), 'hours'); if (st.status === 'ok') studyMin += st.finalMin; });
  var ledger = rows_('member:' + me.id, 'ledger').map(function (r) { return pubLedger_(r, me.id); });
  var weekEarned = 0, balance = 0;
  ledger.forEach(function (l) { balance += l.amount; if (l.type === 'shop' || l.type === 'refund') return; var d = l.ms ? ymd_(l.ms) : ''; if (d >= week && d <= to) weekEarned += l.amount; });
  var warnings = warningList_().filter(function (w) { return w.memberId === me.id; }).sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); }).map(pubWarning_);
  var offs = dayoffList_().filter(function (d) { return d.memberId === me.id && d.date >= week && d.date <= to; }).map(pubDayoff_);
  var selfUsed = offs.filter(function (o) { return o.mode === 'self'; }).length;
  var info = meInfo_(me); info.balance = balance;
  return { me: info, today: today, week: week, balance: balance, weekEarned: weekEarned, progress: progress, studyMin: studyMin,
           rank: mine ? mine.rank : null, rankBonus: mine ? mine.bonus : 0, warnings: warnings, warnCount: warnings.filter(function (w) { return !w.canceled; }).length,
           expelAt: S.expelAt, dayoffs: offs, dayoffSelfUsed: selfUsed >= S.dayoffPerWeek, dayoffSelfLeft: Math.max(0, S.dayoffPerWeek - selfUsed), dayoffPerWeek: S.dayoffPerWeek,
           holidays: Object.keys(S.holidays).filter(function (d) { return d >= week && d <= to; }).map(function (d) { return { date: d, reason: S.holidays[d] }; }),
           streaks: streaks_(me), ledger: ledger.sort(function (a, b) { return b.ms - a.ms; }).slice(0, 200),
           purchases: purchaseList_().filter(function (x) { return x.memberId === me.id; }).sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); }).map(pubPurchase_) };
} };

ACTIONS['me.password'] = { write: true, fn: function (req, me) {
  if (String(req.oldPw) !== me.password) fail_('지금 비밀번호가 맞지 않아요.');
  var pw = str_(req.newPw);
  if (pw.length < 4) fail_('비밀번호는 4자 이상으로 정하세요.');
  me.password = pw;
  saveMember_(me);
  log_('password.change', me.id, '', '', '본인 변경');
  return { token: makeToken_(me) };
} };

function monthRange_(ym) { var from = ym + '-01'; return { from: from, to: addDays_(addDays_(from, 31).slice(0, 7) + '-01', -1) }; }
ACTIONS['calendar'] = { books: ['dayoffs'], pre: function (req, id) { var ym = str_(req.month); if (!/^\d{4}-\d{2}$/.test(ym)) return []; var r = monthRange_(ym); return [qkey_('memberGrid', { member: id, from: r.from, to: r.to })]; }, fn: function (req, me) {
  var ym = str_(req.month);
  if (!/^\d{4}-\d{2}$/.test(ym)) fail_('월 형식이 올바르지 않아요.');
  var mr = monthRange_(ym), from = mr.from, to = mr.to, recs = [], seen = {};
  q_('memberGrid', { member: me.id, from: from, to: to }).forEach(function (g) {
    if (seen[g._date]) return;
    seen[g._date] = true;
    MISSIONS.forEach(function (mi) { var st = cellStatus_(g, mi).status; if (st !== 'none') recs.push({ date: g._date, mission: mi, status: st }); });
  });
  return { month: ym, today: today_(), recs: recs, dayoffs: dayoffsWithHolidays_(from, to, [me]).filter(function (d) { return d.memberId === me.id; }) };
} };

// ---------- 데이오프 ----------
ACTIONS['dayoff.request'] = { write: true, books: ['dayoffs'], fn: function (req, me) {
  var today = today_(), date = str_(req.date), S = settings_();
  if (!isDate_(date) || date < today) fail_('오늘 또는 이후 날짜를 고르세요.');
  if (weekOf_(date) !== weekOf_(today)) fail_('이번 주(월~일) 안의 날짜만 신청할 수 있어요.');
  var used = dayoffList_().filter(function (d) { return d.memberId === me.id && d.mode === 'self' && weekOf_(d.date) === weekOf_(date); }).length;
  if (used >= S.dayoffPerWeek) fail_(S.dayoffPerWeek ? '이번 주 데이오프 신청을 모두 썼어요.' : '지금은 데이오프를 직접 신청할 수 없어요.');
  if (dayoffOn_(me.id, date)) fail_('이미 데이오프인 날이에요.');
  insert_('dayoffs', 'dayoffs', { id: nextId_('dayoffs', 'dayoffs'), memberId: me.id, name: me.name, date: date, mode: '본인 신청', by: whoStr_(me.id), reason: str_(req.reason, 200), at: nowStamp_() });
  log_('dayoff.request', me.id, '', date, '');
  return true;
} };
ACTIONS['dayoff.cancel'] = { write: true, books: ['dayoffs'], fn: function (req, me) {
  var d = dayoffList_().filter(function (x) { return x.id === str_(req.id); })[0];
  if (!d) fail_('데이오프를 찾을 수 없어요.');
  if (!(d.memberId === me.id && d.mode === 'self' && d.date > today_())) needAccess_('dayoff.manage');
  d._row.canceled = 'O'; d._row.canceledBy = whoStr_(me.id); d._row.canceledAt = nowStamp_();
  touch_('dayoffs', 'dayoffs', d._row);
  log_('dayoff.cancel', d.memberId, d.date, '', str_(req.reason));
  return true;
} };

// ---------- 미니게임 ----------
ACTIONS['game.state'] = { pre: function () { var t = today_(); return ['grid', 'log', 'plays', 'extra'].map(function (tk) { return dayKey_(t) + '/' + tk; }); }, fn: function (req, me) {
  var st = gameState_(me, today_());
  st.names = GAME_NAMES;
  return st;
} };
ACTIONS['game.start'] = { write: true, pre: function () { var t = today_(); return ['grid', 'log', 'plays', 'extra'].map(function (tk) { return dayKey_(t) + '/' + tk; }); }, fn: function (req, me) {
  var date = today_(), st = gameState_(me, date), G = settings_().games;
  if (!st.games.length) fail_('오늘 열린 게임이 없어요.');
  var game = req.game || (st.games.length === 1 ? st.games[0] : null);
  if (!game) fail_('어떤 게임을 할지 골라 주세요.');
  if (st.games.indexOf(game) < 0) fail_('오늘의 게임이 바뀌었어요. 새로고침 해주세요.');
  if (st.used >= st.chances.total) fail_('오늘 도전 기회를 모두 썼어요.');
  var preset = {};
  if (game === 'roulette') preset.dir = COMPASS_DIRS[Math.floor(Math.random() * 8)];
  if (game === 'treasure') { var v = G.cfg.treasure.values; preset.value = v[Math.floor(Math.random() * v.length)]; }
  var round = st.used + 1, id = date + '-' + me.id + '-' + round;
  insert_(dayKey_(date), 'plays', { id: id, memberId: me.id, name: me.name, round: round, game: GAME_NAMES[game], startedAt: nowStamp_(),
    preset: game === 'roulette' ? preset.dir : game === 'treasure' ? String(preset.value) : '', result: '', pie: '0', status: '진행 중', finishedAt: '' });
  return { playId: id, round: round, game: game, preset: preset, cfg: G.cfg[game] };
} };
ACTIONS['game.finish'] = { write: true, pre: function (req, id) { var d = str_(req.playId).slice(0, 10); return isDate_(d) ? [dayKey_(d) + '/plays', qkey_('bal', { member: id })] : []; }, fn: function (req, me) {
  var id = str_(req.playId), date = id.slice(0, 10);
  if (!isDate_(date)) fail_('플레이 기록을 찾을 수 없어요.');
  var p = rows_(dayKey_(date), 'plays').filter(function (x) { return str_(x.id) === id; })[0];
  if (!p || str_(p.memberId) !== me.id) fail_('플레이 기록을 찾을 수 없어요.');
  if (/완료/.test(p.status)) return { pie: num_(p.pie), already: true, balance: balance_(me.id) };
  var G = settings_().games, game = gameKey_(p.game);
  if (!game) fail_('알 수 없는 게임이에요.');
  var preset = game === 'roulette' ? { dir: str_(p.preset) } : game === 'treasure' ? { value: num_(p.preset) } : {};
  var pie = computeGamePie_(game, req.result || {}, preset, G.cfg[game], num_(G.maxPerPlay));
  p.result = describeResult_(game, req.result || {}, preset) + (req.abandoned ? ' (중간에 나감)' : '');
  p.pie = String(pie); p.status = '완료'; p.finishedAt = nowStamp_();
  touch_(dayKey_(date), 'plays', p);
  if (pie) addPie_(me.id, pie, 'game', date, game, GAME_NAMES[game] + ' ' + p.round + '회차' + (req.abandoned ? ' (중간에 나감)' : ''));
  return { pie: pie, balance: balance_(me.id) };
} };

// ---------- 상점 ----------
ACTIONS['shop.list'] = { books: ['shop', 'warnings'], pre: function (req, id) { return [qkey_('bal', { member: id })]; }, fn: function (req, me) {
  var products = productList_().filter(function (p) { return p.status === 'on'; }).map(function (p) {
    var x = pubProduct_(p), c = myCounts_(me.id, p.id);
    x.myLeft = x.limitType === 'total' ? Math.max(0, x.limitN - c.all) : x.limitType === 'weekly' ? Math.max(0, x.limitN - c.week) : null;
    return x;
  });
  return { products: products, balance: balance_(me.id), warnings: activeWarnings_(me.id).length,
           purchases: purchaseList_().filter(function (x) { return x.memberId === me.id; }).sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); }).map(pubPurchase_) };
} };
ACTIONS['shop.buy'] = { write: true, books: ['shop', 'warnings'], pre: function (req, id) { return [qkey_('bal', { member: id })]; }, fn: function (req, me) {
  var p = productList_().filter(function (x) { return x.id === str_(req.productId); })[0];
  if (!p || p.status !== 'on') fail_('판매 중인 상품이 아니에요.');
  if (p.stock !== null && p.stock <= 0) fail_('품절된 상품이에요.');
  var bal = balance_(me.id);
  if (bal < p.price) fail_('파이가 부족해요.');
  var c = myCounts_(me.id, p.id);
  if (p.limitType === 'total' && c.all >= p.limitN) fail_('살 수 있는 수량을 모두 샀어요.');
  if (p.limitType === 'weekly' && c.week >= p.limitN) fail_('이번 주에 살 수 있는 수량을 모두 샀어요.');
  var warningId = '';
  if (p.type === 'warn') {
    var ws = activeWarnings_(me.id).sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); });
    if (!ws.length) fail_('차감할 경고가 없어요.');
    var w = ws[0];
    w._row.canceled = 'O'; w._row.canceledBy = '상점'; w._row.canceledAt = nowStamp_(); w._row.cancelReason = '경고 차감 상품 구매';
    touch_('warnings', 'warnings', w._row);
    warningId = w.id;
  }
  if (p.stock !== null) { p.stock -= 1; writeProduct_(p); }
  insert_('shop', 'purchases', { id: nextId_('shop', 'purchases'), at: nowStamp_(), memberId: me.id, name: me.name, productId: p.id, productName: p.name, price: p.price,
    type: p.type === 'warn' ? '경고 차감' : '일반', status: p.type === 'warn' ? '지급 완료' : '지급 대기', by: p.type === 'warn' ? '상점' : '', doneAt: p.type === 'warn' ? nowStamp_() : '', warningId: warningId });
  addPie_(me.id, -p.price, 'shop', '', p.name, p.name + ' 구매');
  log_('shop.buy', me.id, '', p.name, p.price + '파이');
  return { balance: bal - p.price };
} };

// ---------- 랭킹 ----------
ACTIONS['ranking'] = { books: ['settle'], fn: function (req, me) {
  var week = weekOf_(today_()), dates = existingDates_(week, addDays_(week, 6));
  loadDays_(dates);
  syncDays_(dates);
  var list = weekRanking_(week);
  var last = rows_('settle', 'list').map(function (r) { return parseDate_(r.week); }).filter(Boolean).sort().reverse()[0], lastData = null;
  if (last) {
    need_(['sweek:' + last]);
    var d = settledWeek_(last);
    lastData = { week: last, ranking: d.ranking, mine: d.rows.filter(function (r) { return r.memberId === me.id; })[0] || null,
                 perfect: d.rows.filter(function (r) { return r.counts.attend === 7 && r.counts.study === 7 && r.counts.problem === 7; }).map(function (r) { return r.name; }) };
  }
  return { week: week, list: list, rankBonus: settings_().rankBonus, last: lastData };
} };

// ---------- 공지 · 게시판 ----------
ACTIONS['notices.list'] = { books: ['board'], fn: function (req, me) {
  var admin = can_('notices.manage'), now = nowMs_();
  var list = rows_('board', 'notices').filter(function (n) { return str_(n.title) && !yes_(n.deleted) && (admin || !yes_(n.draft)); });
  list.sort(function (a, b) { return ((yes_(b.pinned) ? 1 : 0) - (yes_(a.pinned) ? 1 : 0)) || (parseStamp_(b.at) - parseStamp_(a.at)); });
  return list.map(function (n) {
    return { id: str_(n.id), authorName: nameOf_(whoId_(n.author)), title: str_(n.title), body: str_(n.body), at: str_(n.at), pinned: yes_(n.pinned), important: yes_(n.important),
             draft: yes_(n.draft), isNew: now - parseStamp_(n.at) < 3 * 86400000 };
  });
} };
function reactionsOf_(rows) {
  var rx = {};
  rows.forEach(function (r) {
    var pid = str_(r.postId), kind = null;
    for (var k in REACTION_NAMES) if (REACTION_NAMES[k] === str_(r.kind) || k === str_(r.kind)) kind = k;
    if (!kind) return;
    rx[pid] = rx[pid] || {};
    (rx[pid][kind] = rx[pid][kind] || []).push({ id: str_(r.memberId), name: nameOf_(str_(r.memberId)) });
  });
  return rx;
}
function pubPost_(p, rx) {
  return { id: str_(p.id), text: str_(p.text), at: str_(p.at), hidden: yes_(p.hidden), edited: !!str_(p.editedAt),
           author: pubMember_(member_(str_(p.memberId))) || { id: str_(p.memberId), name: str_(p.name), tags: [] }, reactions: (rx || {})[str_(p.id)] || {} };
}
ACTIONS['posts.list'] = { fn: function (req, me) {
  var ops = can_('posts.hide'), limit = Math.min(100, num_(req.limit) || 30);
  var args = { limit: limit, hidden: ops };
  if (req.before) args.before = str_(req.before);
  var r = q_('posts', args);
  var ids = r.rows.map(function (p) { return str_(p.id); });
  var rx = ids.length ? reactionsOf_(q_('reactions', { postIds: ids }).rows) : {};
  return { more: r.more, posts: r.rows.map(function (p) { return pubPost_(p, rx); }) };
} };
ACTIONS['posts.create'] = { write: true, fn: function (req, me) {
  var text = str_(req.text).replace(/\n{3,}/g, '\n\n');
  if (!text) fail_('내용을 입력하세요.');
  if (text.length > 150) fail_('150자 이내로 써주세요.');
  var p = winsert_('posts', 'posts', { id: nextId_('posts', 'posts'), memberId: me.id, name: me.name, text: text, at: nowStamp_() });
  return { id: p.id, text: text, at: p.at, hidden: false, author: pubMember_(me), reactions: {} };
} };
function findPost_(id) {
  var p = q_('post', { id: str_(id) }).rows[0];
  if (!p || yes_(p.deleted)) fail_('글을 찾을 수 없어요.');
  return p;
}
ACTIONS['posts.delete'] = { write: true, fn: function (req, me) {
  var p = findPost_(req.id);
  if (str_(p.memberId) !== me.id) { needAccess_('posts.manage'); log_('post.delete', str_(p.memberId), p.text, '', ''); }
  p.deleted = 'O';
  touchRow_('posts', p);
  return true;
} };
ACTIONS['posts.hide'] = { write: true, need: 'posts.hide', fn: function (req) {
  var p = findPost_(req.id);
  p.hidden = yn_(req.hidden);
  touchRow_('posts', p);
  log_(req.hidden ? 'post.hide' : 'post.unhide', str_(p.memberId), '', p.text, '');
  return true;
} };
ACTIONS['posts.edit'] = { write: true, fn: function (req, me) {
  var p = findPost_(req.id), text = str_(req.text).replace(/\n{3,}/g, '\n\n');
  if (str_(p.memberId) !== me.id) needAccess_('posts.manage');
  if (!text) fail_('내용을 입력하세요.');
  if (text.length > 150) fail_('150자 이내로 써주세요.');
  if (str_(p.memberId) !== me.id) log_('post.edit', str_(p.memberId), p.text, text, '');
  p.text = text; p.editedAt = nowStamp_();
  touchRow_('posts', p);
  return true;
} };
ACTIONS['posts.react'] = { write: true, fn: function (req, me) {
  if (REACTIONS.indexOf(req.kind) < 0) fail_('알 수 없는 반응이에요.');
  var p = findPost_(req.id), pid = str_(p.id), kname = REACTION_NAMES[req.kind];
  var all = q_('reactions', { postIds: [pid] }).rows;
  var mine = all.filter(function (r) { return str_(r.memberId) === me.id && (str_(r.kind) === kname || str_(r.kind) === req.kind); });
  if (mine.length) { mine.forEach(function (r) { removeRow_('reactions', r._id); }); all = all.filter(function (r) { return mine.indexOf(r) < 0; }); }
  else all.push(winsert_('reactions', 'reactions', { postId: pid, memberId: me.id, kind: kname, at: nowStamp_() }));
  return { id: pid, reactions: reactionsOf_(all)[pid] || {} };
} };
ACTIONS['posts.clearReactions'] = { write: true, need: 'posts.manage', fn: function (req) {
  var p = findPost_(req.id), pid = str_(p.id);
  var all = q_('reactions', { postIds: [pid] }).rows.filter(function (r) { return !req.kind || str_(r.kind) === REACTION_NAMES[req.kind] || str_(r.kind) === req.kind; });
  all.forEach(function (r) { removeRow_('reactions', r._id); });
  log_('post.clearReactions', str_(p.memberId), all.length + '개', '', p.text);
  return true;
} };

// ================================================================
// 12. 기능 목록 — 운영 화면
// ================================================================

// ---------- 오늘 할 일 · 판정 ----------
ACTIONS['admin.home'] = { need: 'admin.home', books: ['quests', 'shop', 'warnings', 'dayoffs', 'settle'], pre: function () { return [qkey_('size', {}), qkey_('usage', { days: 1 })]; }, fn: function (req, me) {
  var today = today_(), week = weekOf_(today), next = addDays_(week, 7), dates = existingDates_(addDays_(today, -28), today);
  loadDays_(dates, ['grid']);
  var pending = 0, todayAttend = 0;
  dates.forEach(function (d) {
    if (isLocked_(d)) return;
    rows_(dayKey_(d), 'grid').forEach(function (g) {
      var m = member_(str_(g.memberId)); if (!m || m.status !== 'active') return;
      MISSIONS.forEach(function (mi) { var st = cellStatus_(g, mi).status; if (st === 'pending') pending++; if (d === today && mi === 'attend' && st === 'ok') todayAttend++; });
    });
  });
  pending += rows_('quests', 'weekly').filter(function (r) { var w = parseDate_(r.week); return w && parseStatus_(r.status) === 'pending' && member_(str_(r.memberId)) && !isLocked_(w); }).length;
  var qThis = questsForWeek_(week), qNext = questsForWeek_(next), out = {
    today: today, pending: pending, candidates: warnCandidates_().length, expelTargets: expelTargets_(),
    waitingPurchases: purchaseList_().filter(function (x) { return x.status === 'waiting'; }).length,
    questThis: { week: week, daily: !!qThis.daily, weekly: !!qThis.weekly }, questNext: { week: next, daily: !!qNext.daily, weekly: !!qNext.weekly },
    unsettled: unsettledWeeks_(), activeCount: activeMembers_().length, todayAttend: todayAttend,
    attendName: mname_('attend'), maintenance: CTX.meta.maintenance || ''
  };
  if (can_('backup')) { var lb = CTX.meta.last_backup || ''; out.lastBackup = lb; out.backupDays = lb ? Math.floor((nowMs_() - parseStamp_(lb)) / 86400000) : null; }
  if (can_('usage.view')) {
    var S = settings_(), size = q_('size', {}), u = q_('usage', { days: 1 }), td = ymd_(nowMs_()), t = u.filter(function (x) { return x.day === td; })[0];
    out.usage = { dbPct: num_(size.schemaBytes) / (S.budget.dbMB * 1048576) * 100, reqPct: (t ? num_(t.requests) : 0) / S.budget.requests * 100 };
  }
  return out;
} };

ACTIONS['judge.grid'] = { need: 'judge.view', books: ['quests', 'dayoffs', 'settle'], fn: function (req) {
  var from = req.from, to = req.to;
  if (!isDate_(from) || !isDate_(to) || from > to) fail_('기간이 올바르지 않아요.');
  if (dayNum_(to) - dayNum_(from) > 62) fail_('최대 9주까지 볼 수 있어요.');
  var dates = existingDates_(from, to);
  loadDays_(dates);
  syncDays_(dates);
  var recs = [];
  dates.forEach(function (d) {
    rows_(dayKey_(d), 'grid').forEach(function (g) {
      var mid = str_(g.memberId); if (!member_(mid)) return;
      MISSIONS.forEach(function (mi) { var r = rec_(d, mid, mi); if (r.status !== 'none' || r.pie) recs.push(r); });
    });
  });
  var weeks = [], quests = {}, locked = {}, editable = {};
  for (var w = weekOf_(from); w <= to; w = addDays_(w, 7)) {
    weeks.push(w);
    var q = questsForWeek_(w), over = {};
    Object.keys(q.over).forEach(function (k) { over[k] = pubQuest_(q.over[k]); });
    quests[w] = { daily: pubQuest_(q.daily), weekly: pubQuest_(q.weekly), over: over };
    locked[w] = isLocked_(w);
    editable[w] = !lockedFor_(w);
    activeMembers_().forEach(function (m) { var r = weeklyRec_(w, m.id); if (r.status !== 'none' || r.pie) recs.push(r); });
  }
  var ms = activeMembers_();
  return { from: from, to: to, today: today_(), weeks: weeks, locked: locked, editable: editable, quests: quests, members: ms.map(pubMember_), recs: recs,
           missions: missionsOn_(), dayoffs: dayoffsWithHolidays_(from, to, ms) };
} };

ACTIONS['judge.set'] = { write: true, need: 'judge.view', books: ['quests', 'dayoffs', 'settle'], fn: function (req, me) {
  var cells = (req.cells || []).slice(0, 2000), today = today_(), admin = can_('judge.all'), attendOnly = can_('judge.attend'), results = [], skipped = [], dates = [];
  cells.forEach(function (c) { if (isDate_(c.date) && c.mission !== 'weekly' && dates.indexOf(c.date) < 0) dates.push(c.date); });
  loadDays_(dates);
  cells.forEach(function (c) {
    try {
      var mi = c.mission, st = c.status;
      if (MISSIONS.indexOf(mi) < 0 && mi !== 'weekly') fail_('알 수 없는 미션');
      if (['ok', 'vague', 'fail', 'reset'].indexOf(st) < 0) fail_('알 수 없는 판정');
      var t = member_(c.memberId);
      if (!t) fail_('멤버를 찾을 수 없어요');
      if (!isDate_(c.date)) fail_('날짜 오류');
      var date = mi === 'weekly' ? weekOf_(c.date) : c.date;
      if (date > today) fail_('아직 오지 않은 날');
      if (lockedFor_(date)) fail_('정산이 끝난 주');
      if (!admin && !(attendOnly && mi === 'attend' && st === 'ok')) fail_('생존신고 출석 처리만 할 수 있어요');
      if (st === 'vague' && mi !== 'study') fail_('애매함은 공부인증에만 쓸 수 있어요');
      var r = rec_(date, t.id, mi), to = st, fm = null;
      if (st === 'reset') to = ((r.selfMarked && mi !== 'attend') || (mi === 'hours' && r.inputMin !== null)) ? 'pending' : 'none';
      if (mi === 'hours' && st === 'ok') {
        fm = (c.finalMin !== null && c.finalMin !== undefined && c.finalMin !== '') ? Math.round(num_(c.finalMin)) : (r.finalMin !== null ? r.finalMin : r.inputMin);
        if (fm === null || fm === undefined) fail_('확정 시간을 입력하세요');
        if (fm < 0 || fm > 1440) fail_('시간 범위 오류');
      }
      if (to === r.status && (mi !== 'hours' || st !== 'ok' || fm === r.finalMin)) { results.push(r); return; }
      var opts = {};
      if (st === 'reset' && mi === 'attend') opts.selfAt = '';
      var before = setStatus_(date, t.id, mi, to, fm, opts), after = rec_(date, t.id, mi);
      log_(!admin ? 'attend.proxy' : (t.id === me.id ? 'judge.self' : 'judge'), t.id,
           (STATUS_WORDS[before.status] || '미표시') + (before.finalMin !== null ? ' ' + fmtMinutes_(before.finalMin) : '') + ' (' + before.pie + '파이)',
           (STATUS_WORDS[after.status] || '미표시') + (after.finalMin !== null ? ' ' + fmtMinutes_(after.finalMin) : '') + ' (' + after.pie + '파이)', mname_(mi) + ' ' + date + (isLocked_(date) ? ' (정산 끝난 주)' : ''));
      results.push(after);
    } catch (e) { if (e.needLoad) throw e; skipped.push({ date: c.date, memberId: c.memberId, mission: c.mission, reason: e.userMsg || String(e.message || e) }); }
  });
  return { recs: results, skipped: skipped };
} };

ACTIONS['judge.pending'] = { need: 'judge.view', books: ['quests', 'settle'], fn: function () {
  var today = today_(), dates = existingDates_(addDays_(today, -21), today), list = [];
  loadDays_(dates);
  syncDays_(dates);
  dates.forEach(function (d) {
    if (lockedFor_(d)) return;
    rows_(dayKey_(d), 'grid').forEach(function (g) {
      var m = member_(str_(g.memberId)); if (!m || m.status !== 'active') return;
      MISSIONS.forEach(function (mi) { if (cellStatus_(g, mi).status === 'pending') { var r = rec_(d, m.id, mi); r.name = m.name; r.insta = m.insta; r.missionName = mname_(mi); list.push(r); } });
    });
  });
  rows_('quests', 'weekly').forEach(function (r) {
    var m = member_(str_(r.memberId)), w = parseDate_(r.week);
    if (!m || m.status !== 'active' || !w || lockedFor_(w) || parseStatus_(r.status) !== 'pending') return;
    var x = weeklyRec_(w, m.id); x.name = m.name; x.insta = m.insta; x.missionName = mname_('weekly'); list.push(x);
  });
  list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : parseStamp_(a.selfAt) - parseStamp_(b.selfAt); });
  return { list: list, today: today };
} };

// ---------- 데이오프 · 전체 휴일 ----------
ACTIONS['dayoff.assign'] = { write: true, need: 'dayoff.manage', books: ['dayoffs'], fn: function (req, me) {
  var m = member_(str_(req.memberId));
  if (!m) fail_('멤버를 찾을 수 없어요.');
  if (!isDate_(req.date)) fail_('날짜가 올바르지 않아요.');
  if (dayoffList_().some(function (d) { return d.memberId === m.id && d.date === req.date; })) fail_('이미 데이오프인 날이에요.');
  insert_('dayoffs', 'dayoffs', { id: nextId_('dayoffs', 'dayoffs'), memberId: m.id, name: m.name, date: req.date, mode: '운영진 지정', by: whoStr_(me.id), reason: str_(req.reason, 200), at: nowStamp_() });
  log_('dayoff.assign', m.id, '', req.date, req.reason);
  return true;
} };
ACTIONS['dayoff.list'] = { need: 'dayoff.manage', books: ['dayoffs'], fn: function (req) {
  var week = weekOf_(isDate_(req.week) ? req.week : today_()), to = addDays_(week, 6), ms = activeMembers_(), S = settings_();
  return { week: week, members: ms.map(pubMember_), dayoffs: dayoffList_().filter(function (d) { return d.date >= week && d.date <= to; }).map(pubDayoff_),
           holidays: Object.keys(S.holidays).sort().filter(function (d) { return d >= addDays_(today_(), -60); }).map(function (d) { return { date: d, reason: S.holidays[d] }; }) };
} };
ACTIONS['holidays.save'] = { write: true, need: 'holidays', fn: function (req, me) {
  var d = str_(req.date), reason = str_(req.reason, 100) || '전체 휴일';
  if (!isDate_(d)) fail_('날짜가 올바르지 않아요.');
  var rows = rows_('settings', 'holidays'), r = rows.filter(function (x) { return parseDate_(x.date) === d; })[0];
  if (r) { r.reason = reason; r.by = whoStr_(me.id); r.at = nowStamp_(); touch_('settings', 'holidays', r); }
  else insert_('settings', 'holidays', { date: d, reason: reason, by: whoStr_(me.id), at: nowStamp_() });
  log_('holiday.save', '', '', d, reason);
  return true;
} };
ACTIONS['holidays.delete'] = { write: true, need: 'holidays', fn: function (req) {
  var d = str_(req.date);
  rows_('settings', 'holidays').filter(function (x) { return parseDate_(x.date) === d; }).forEach(function (r) { remove_('settings', 'holidays', r); });
  log_('holiday.delete', '', d, '', '');
  return true;
} };

// ---------- 경고 ----------
ACTIONS['warn.list'] = { need: 'warn.manage', books: ['warnings', 'dayoffs'], fn: function () {
  var skips = rows_('warnings', 'skips').map(function (s) { return { key: parseDate_(s.date) + '|' + str_(s.memberId), date: parseDate_(s.date), memberId: str_(s.memberId), name: nameOf_(str_(s.memberId)), byName: nameOf_(whoId_(s.by)), at: str_(s.at) }; })
    .filter(function (s) { return s.date; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 100);
  return { candidates: warnCandidates_(), expelTargets: expelTargets_(), expelAt: settings_().expelAt, skips: skips,
           warnings: warningList_().sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); }).map(pubWarning_),
           members: activeMembers_().map(function (m) { var p = pubMember_(m); p.warnings = activeWarnings_(m.id).length; return p; }) };
} };
ACTIONS['warn.give'] = { write: true, need: 'warn.manage', books: ['warnings'], fn: function (req, me) {
  var m = member_(str_(req.memberId));
  if (!m || m.status !== 'active') fail_('멤버를 찾을 수 없어요.');
  notSelf_(m.id);
  var reason = str_(req.reason, 300);
  if (!reason) fail_('사유를 입력하세요.');
  var refDate = isDate_(req.refDate) ? req.refDate : '';
  if (refDate && warningList_().some(function (w) { return w.memberId === m.id && w.refDate === refDate && !w.canceled; }))
    fail_('이 날짜에는 이미 경고를 줬어요. 필수 미션 미수행 경고는 하루에 한 번만 줄 수 있어요.');
  insert_('warnings', 'warnings', { id: nextId_('warnings', 'warnings'), memberId: m.id, name: m.name, reason: reason, refDate: refDate,
    refMission: str_(req.refMission, 100), by: whoStr_(me.id), at: nowStamp_(), canceled: '' });
  var count = activeWarnings_(m.id).length;
  log_('warn.give', m.id, count - 1, count, reason);
  return { count: count, expelTarget: count >= num_(settings_().expelAt) };
} };
ACTIONS['warn.skip'] = { write: true, need: 'warn.manage', books: ['warnings'], fn: function (req, me) {
  var p = str_(req.key).split('|'), d = p[0], mid = p[1];
  if (!isDate_(d) || !member_(mid)) fail_('대상을 찾을 수 없어요.');
  insert_('warnings', 'skips', { date: d, memberId: mid, name: nameOf_(mid), by: whoStr_(me.id), at: nowStamp_() });
  log_('warn.skip', mid, '', d, '');
  return true;
} };
ACTIONS['warn.unskip'] = { write: true, need: 'warn.manage', books: ['warnings'], fn: function (req) {
  var p = str_(req.key).split('|'), d = p[0], mid = p[1], n = 0;
  rows_('warnings', 'skips').filter(function (s) { return parseDate_(s.date) === d && str_(s.memberId) === mid; }).forEach(function (s) { remove_('warnings', 'skips', s); n++; });
  if (!n) fail_('넘어간 기록을 찾을 수 없어요.');
  log_('warn.unskip', mid, d, '', '');
  return true;
} };
ACTIONS['warn.cancel'] = { write: true, need: 'warn.manage', books: ['warnings'], fn: function (req, me) {
  var w = warningList_().filter(function (x) { return x.id === str_(req.id); })[0];
  if (!w || w.canceled) fail_('취소할 수 있는 경고가 아니에요.');
  notSelf_(w.memberId);
  w._row.canceled = 'O'; w._row.canceledBy = whoStr_(me.id); w._row.canceledAt = nowStamp_(); w._row.cancelReason = str_(req.reason, 300);
  touch_('warnings', 'warnings', w._row);
  log_('warn.cancel', w.memberId, w.reason, '', req.reason);
  return true;
} };
ACTIONS['warn.edit'] = { write: true, need: 'warn.manage', books: ['warnings'], fn: function (req, me) {
  var w = warningList_().filter(function (x) { return x.id === str_(req.id); })[0];
  if (!w) fail_('경고를 찾을 수 없어요.');
  notSelf_(w.memberId);
  var before = w.reason + (w.refDate ? ' · ' + w.refDate : '');
  if (req.reason !== undefined) { var r = str_(req.reason, 300); if (!r) fail_('사유를 입력하세요.'); w._row.reason = r; }
  if (req.refDate !== undefined) { var d = str_(req.refDate); if (d && !isDate_(d)) fail_('날짜가 올바르지 않아요.'); w._row.refDate = d; }
  if (req.refMission !== undefined) w._row.refMission = str_(req.refMission, 100);
  touch_('warnings', 'warnings', w._row);
  log_('warn.edit', w.memberId, before, w._row.reason + (w._row.refDate ? ' · ' + w._row.refDate : ''), '');
  return true;
} };

// ---------- 파이 ----------
ACTIONS['pie.adjust'] = { write: true, need: 'pie.adjust', fn: function (req, me) {
  var ids = (req.memberIds || []).filter(function (x, i, a) { return a.indexOf(x) === i; }), amount = Math.round(num_(req.amount)), reason = str_(req.reason, 300);
  if (!ids.length) fail_('대상을 고르세요.');
  if (!amount) fail_('금액을 입력하세요.');
  if (!reason) fail_('사유를 입력하세요.');
  if (ids.indexOf(me.id) >= 0 && !can_('pie.tools')) fail_('본인 파이는 바꿀 수 없어요.');
  ids.forEach(function (id) { if (!member_(id)) fail_('멤버를 찾을 수 없어요: ' + id); });
  ids.forEach(function (id) { addPie_(id, amount, 'manual', '', '', reason); log_('pie.adjust', id, '', amount, reason); });
  return { count: ids.length };
} };
ACTIONS['pie.ledger'] = { need: 'pie.view', fn: function (req) {
  var ms = sortMembers_(members_()), args = { limit: Math.min(1000, num_(req.limit) || 300) };
  if (req.memberId) args.member = str_(req.memberId);
  if (req.type && LEDGER_TYPES[req.type]) args.type = LEDGER_TYPES[req.type];
  if (isDate_(req.from)) args.from = req.from;
  if (isDate_(req.to)) args.to = req.to;
  var r = q_('ledger', args);
  var list = r.rows.map(function (x) { return pubLedger_(x, str_(x._member)); });
  return { total: r.total, sum: r.sum, list: list, members: ms.map(pubMember_), types: LEDGER_TYPES, tools: can_('pie.tools') };
} };

// ---------- 퀘스트 ----------
ACTIONS['quests.list'] = { need: 'quests.manage', books: ['quests'], fn: function (req) {
  var cur = weekOf_(today_()), lim = aheadLimit_(), from = isDate_(req.from) ? weekOf_(req.from) : addDays_(cur, -14), to = isDate_(req.to) ? weekOf_(req.to) : (lim || addDays_(cur, 28));
  return { current: cur, maxWeek: lim, from: from, to: to, quests: questList_().filter(function (q) { return q.week >= from && q.week <= to; }).map(pubQuest_) };
} };
ACTIONS['quests.save'] = { write: true, need: 'quests.manage', books: ['quests'], fn: function (req, me) {
  var d = req.quest || {}, lim = aheadLimit_();
  if (['daily', 'weekly'].indexOf(d.type) < 0) fail_('종류를 고르세요.');
  if (!isDate_(d.week) || weekOf_(d.week) !== d.week) fail_('적용할 주를 고르세요.');
  if (lim && d.week > lim) fail_('퀘스트는 ' + settings_().weeksAhead + '주 뒤까지만 미리 등록할 수 있어요.');
  var title = str_(d.title, 100);
  if (!title) fail_('제목을 입력하세요.');
  var dow = (d.type === 'daily' && d.dow !== null && d.dow !== undefined && d.dow !== '') ? Math.max(0, Math.min(6, Math.round(num_(d.dow)))) : null;
  var q = d.id ? questList_().filter(function (x) { return x.id === str_(d.id); })[0] : null;
  if (!q) q = questList_().filter(function (x) { return x.week === d.week && x.type === d.type && x.dow === dow; })[0];
  var row = q ? q._row : insert_('quests', 'quests', { id: nextId_('quests', 'quests') });
  row.type = d.type === 'weekly' ? '위클리' : '데일리'; row.week = d.week; row.dow = dow === null ? '' : DOW_KO[dow]; row.title = title; row.desc = str_(d.desc, 1000);
  row.by = whoStr_(me.id); row.at = nowStamp_();
  touch_('quests', 'quests', row);
  log_('quest.save', '', '', d.week + ' ' + row.type + (row.dow ? '(' + row.dow + ')' : '') + ' ' + title, '');
  return true;
} };
ACTIONS['quests.delete'] = { write: true, need: 'quests.manage', books: ['quests'], fn: function (req) {
  var q = questList_().filter(function (x) { return x.id === str_(req.id); })[0];
  if (!q) fail_('퀘스트를 찾을 수 없어요.');
  remove_('quests', 'quests', q._row);
  log_('quest.delete', '', q.week + ' ' + q.title, '', '');
  return true;
} };

// ---------- 상점 관리 ----------
ACTIONS['shop.admin'] = { need: 'shop.manage', books: ['shop'], fn: function () {
  return { products: productList_().map(pubProduct_), purchases: purchaseList_().sort(function (a, b) { return parseStamp_(b.at) - parseStamp_(a.at); }).slice(0, 500).map(pubPurchase_) };
} };
ACTIONS['shop.save'] = { write: true, need: 'shop.manage', books: ['shop'], fn: function (req) {
  var d = req.product || {}, name = str_(d.name, 60), price = Math.round(num_(d.price));
  if (!name) fail_('상품 이름을 입력하세요.');
  if (price < 0) fail_('가격이 올바르지 않아요.');
  var p = d.id ? productList_().filter(function (x) { return x.id === str_(d.id); })[0] : null;
  if (!p) p = { _row: insert_('shop', 'products', { id: nextId_('shop', 'products'), at: nowStamp_() }) };
  p.name = name; p.desc = str_(d.desc, 500); p.price = price; p.type = d.type === 'warn' ? 'warn' : 'normal';
  p.stock = (d.stock === null || d.stock === '' || d.stock === undefined || num_(d.stock) < 0) ? null : Math.round(num_(d.stock));
  p.limitType = ['none', 'total', 'weekly'].indexOf(d.limitType) >= 0 ? d.limitType : 'none'; p.limitN = Math.max(0, Math.round(num_(d.limitN)));
  p.status = d.status === 'hidden' ? 'hidden' : 'on';
  writeProduct_(p);
  log_('product.save', '', '', name, price + '파이');
  return true;
} };
ACTIONS['shop.deliver'] = { write: true, need: 'shop.manage', books: ['shop'], fn: function (req, me) {
  var x = purchaseList_().filter(function (q) { return q.id === str_(req.id); })[0];
  if (!x || x.status !== 'waiting') fail_('지급 대기 중인 구매가 아니에요.');
  x._row.status = '지급 완료'; x._row.by = whoStr_(me.id); x._row.doneAt = nowStamp_();
  touch_('shop', 'purchases', x._row);
  log_('shop.deliver', x.memberId, '지급 대기', '지급 완료', x.productName);
  return pubPurchase_(purchaseList_().filter(function (q) { return q.id === x.id; })[0]);
} };
ACTIONS['shop.cancel'] = { write: true, need: 'shop.manage', books: ['shop', 'warnings'], fn: function (req, me) {
  var x = purchaseList_().filter(function (q) { return q.id === str_(req.id); })[0];
  if (!x || x.status === 'canceled') fail_('취소할 수 있는 구매가 아니에요.');
  var was = x.status;
  x._row.status = '취소'; x._row.by = whoStr_(me.id); x._row.doneAt = nowStamp_();
  touch_('shop', 'purchases', x._row);
  var p = productList_().filter(function (q) { return q.id === x.productId; })[0];
  if (p && p.stock !== null) { p.stock += 1; writeProduct_(p); }
  if (x.warningId) {
    var w = warningList_().filter(function (q) { return q.id === x.warningId; })[0];
    if (w) { w._row.canceled = ''; w._row.canceledBy = ''; w._row.canceledAt = ''; w._row.cancelReason = ''; touch_('warnings', 'warnings', w._row); }
  }
  addPie_(x.memberId, x.price, 'refund', '', x.productName, x.productName + ' 구매 취소');
  log_('shop.cancel', x.memberId, PURCHASE_WORDS[was], '취소', x.productName);
  return pubPurchase_(purchaseList_().filter(function (q) { return q.id === x.id; })[0]);
} };

// ---------- 미니게임 관리 ----------
function gameFieldsDefs_() { var defs = {}; GAME_IDS.forEach(function (g) { defs[g] = GAME_FIELDS[g].map(function (f) { return { key: f[0], label: f[1], type: f[2], dflt: f[3] }; }); }); return defs; }
ACTIONS['game.config'] = { need: 'games.schedule', fn: function (req) {
  var S = settings_(), today = today_(), lim = aheadLimit_(), from = isDate_(req.from) ? weekOf_(req.from) : addDays_(weekOf_(today), -7);
  var to = isDate_(req.to) ? addDays_(weekOf_(req.to), 6) : addDays_(lim || addDays_(weekOf_(today), 28), 6);
  var days = [];
  for (var d = from; d <= to && days.length < 120; d = addDays_(d, 1)) days.push({ date: d, games: todayGames_(d), fixed: !!S.games.schedule[d] });
  return { games: { order: S.games.order, enabled: S.games.enabled, cfg: S.games.cfg, baseChances: S.games.baseChances, bonusChances: S.games.bonusChances, maxPerPlay: S.games.maxPerPlay },
           names: GAME_NAMES, fields: gameFieldsDefs_(), today: today, todayGames: todayGames_(today), days: days, from: from, to: to, maxDate: lim ? addDays_(lim, 6) : null,
           canRules: can_('games.rules'), canRecords: can_('games.records'), canExtra: can_('games.extra'), members: activeMembers_().map(pubMember_) };
} };
ACTIONS['game.saveList'] = { write: true, need: 'games.schedule', fn: function (req) {
  var S = settings_(), g = req.games || {}, G = S.games;
  if (g.order) { var ord = g.order.filter(function (x, i, a) { return GAME_IDS.indexOf(x) >= 0 && a.indexOf(x) === i; }); GAME_IDS.forEach(function (x) { if (ord.indexOf(x) < 0) ord.push(x); }); G.order = ord; }
  if (g.enabled) GAME_IDS.forEach(function (x) { if (x in g.enabled) G.enabled[x] = !!g.enabled[x]; });
  writeGames_(S);
  log_('game.config', '', '', '', '게임 순서 · 켜기/끄기 저장');
  return { todayGames: todayGames_(today_()) };
} };
ACTIONS['game.saveRules'] = { write: true, need: 'games.rules', fn: function (req) {
  var S = settings_(), g = req.games || {}, G = S.games;
  ['baseChances', 'bonusChances'].forEach(function (k) { if (g[k] !== undefined) G[k] = Math.max(0, Math.min(10, Math.round(num_(g[k])))); });
  if (g.maxPerPlay !== undefined) G.maxPerPlay = Math.max(0, Math.round(num_(g.maxPerPlay)));
  if (g.cfg) Object.keys(g.cfg).forEach(function (k) {
    if (GAME_IDS.indexOf(k) < 0 || !g.cfg[k]) return;
    GAME_FIELDS[k].forEach(function (fd) {
      var v = getPath_(g.cfg[k], fd[0]);
      if (v === undefined || v === null) return;
      if (fd[2] === 'num') { if (str_(v) !== '' && isFinite(Number(v))) setPath_(G.cfg[k], fd[0], Number(v)); }
      else if (Array.isArray(v)) { var ok = v.filter(function (x) { return Array.isArray(x) ? x.length === 2 && isFinite(+x[0]) && isFinite(+x[1]) : isFinite(+x); }); if (ok.length) setPath_(G.cfg[k], fd[0], ok); }
      else setPath_(G.cfg[k], fd[0], fieldParse_(fd[2], v, getPath_(G.cfg[k], fd[0])));
    });
  });
  writeGames_(S); writeBasic_(S);
  log_('game.config', '', '', '', '미니게임 보상 · 기회 저장');
  return true;
} };
/** 날짜별 게임 정하기: days = { 'YYYY-MM-DD': ['roulette', 'darts'] | [] (= 자동) } */
ACTIONS['game.schedule'] = { write: true, need: 'games.schedule', fn: function (req, me) {
  var days = req.days || {}, lim = aheadLimit_(), today = today_(), anytime = can_('anytime'), n = 0;
  var rows = rows_('settings', 'schedule');
  Object.keys(days).slice(0, 120).forEach(function (d) {
    if (!isDate_(d)) fail_('날짜가 올바르지 않아요: ' + d);
    if (!anytime && d < today) fail_('지난 날짜는 바꿀 수 없어요: ' + monthDay_(d));
    if (lim && d > addDays_(lim, 6)) fail_(settings_().weeksAhead + '주 뒤까지만 미리 정할 수 있어요.');
    var gs = (days[d] || []).filter(function (g, i, a) { return GAME_IDS.indexOf(g) >= 0 && a.indexOf(g) === i; });
    if (gs.length > 2) fail_('하루에 게임은 2개까지 고를 수 있어요.');
    var ex = rows.filter(function (r) { return parseDate_(r.date) === d; });
    ex.forEach(function (r, i) { if (i > 0 || !gs.length) remove_('settings', 'schedule', r); });
    if (gs.length) {
      var txt = gs.map(function (g) { return GAME_NAMES[g]; }).join(', ');
      if (ex[0]) { ex[0].games = txt; ex[0].by = whoStr_(me.id); ex[0].at = nowStamp_(); touch_('settings', 'schedule', ex[0]); }
      else insert_('settings', 'schedule', { date: d, games: txt, by: whoStr_(me.id), at: nowStamp_() });
    }
    n++;
  });
  if (n) log_('game.schedule', '', '', n + '일', Object.keys(days).sort().slice(0, 3).join(', ') + (n > 3 ? ' 외' : ''));
  return { count: n };
} };
ACTIONS['game.extra'] = { write: true, need: 'games.extra', fn: function (req, me) {
  var date = isDate_(req.date) ? req.date : today_(), n = Math.round(num_(req.n)), ids = (req.memberIds || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
  if (!ids.length) fail_('대상을 고르세요.');
  if (!n || Math.abs(n) > 10) fail_('기회 수는 -10 ~ 10 사이로 정하세요.');
  loadDays_([date], ['extra']);
  ids.forEach(function (id) {
    if (!member_(id)) fail_('멤버를 찾을 수 없어요: ' + id);
    insert_(dayKey_(date), 'extra', { memberId: id, name: nameOf_(id), n: n, by: whoStr_(me.id), at: nowStamp_(), reason: str_(req.reason, 200) });
    log_('game.extra', id, '', date + ' ' + (n > 0 ? '+' : '') + n + '회', req.reason);
  });
  return { count: ids.length };
} };
ACTIONS['game.plays'] = { need: 'games.extra', fn: function (req) {
  var to = isDate_(req.to) ? req.to : today_(), from = isDate_(req.from) ? req.from : addDays_(to, -6), dates = existingDates_(from, to).slice(-62), out = [], extras = [];
  loadDays_(dates, ['plays', 'extra']);
  dates.forEach(function (d) {
    rows_(dayKey_(d), 'plays').forEach(function (p) { if (!req.memberId || str_(p.memberId) === req.memberId) out.push(pubPlay_(p, d)); });
    rows_(dayKey_(d), 'extra').forEach(function (x) { if (!req.memberId || str_(x.memberId) === req.memberId) extras.push({ date: d, memberId: str_(x.memberId), name: nameOf_(str_(x.memberId)), n: num_(x.n), byName: nameOf_(whoId_(x.by)), at: str_(x.at), reason: str_(x.reason) }); });
  });
  out.sort(function (a, b) { return parseStamp_(b.startedAt) - parseStamp_(a.startedAt); });
  return { plays: out.slice(0, 500), extras: extras, canEdit: can_('games.records') };
} };
ACTIONS['game.playEdit'] = { write: true, need: 'games.records', fn: function (req) {
  var date = str_(req.date), id = str_(req.id);
  if (!isDate_(date)) fail_('날짜가 올바르지 않아요.');
  loadDays_([date], ['plays']);
  var p = rows_(dayKey_(date), 'plays').filter(function (x) { return str_(x.id) === id; })[0];
  if (!p) fail_('플레이 기록을 찾을 수 없어요.');
  var mid = str_(p.memberId), game = gameKey_(p.game), old = num_(p.pie);
  if (req.remove) {
    remove_(dayKey_(date), 'plays', p);
    if (old) addPie_(mid, -old, 'game', date, game, '미니게임 기록 삭제 (' + p.round + '회차)');
    log_('game.playEdit', mid, (GAME_NAMES[game] || p.game) + ' ' + p.round + '회차 ' + old + '파이', '삭제', str_(req.reason));
    return true;
  }
  var pie = Math.max(0, Math.round(num_(req.pie)));
  p.pie = String(pie);
  if (!/완료/.test(p.status)) { p.status = '완료'; p.finishedAt = nowStamp_(); if (!str_(p.result)) p.result = '운영진 처리'; }
  touch_(dayKey_(date), 'plays', p);
  if (pie !== old) addPie_(mid, pie - old, 'game', date, game, '미니게임 기록 고치기 (' + p.round + '회차)');
  log_('game.playEdit', mid, old + '파이', pie + '파이', str_(req.reason));
  return true;
} };

// ---------- 멤버 ----------
ACTIONS['members.list'] = { need: 'members.manage', books: ['warnings'], pre: function () { return [qkey_('balances', {})]; }, fn: function (req, me) {
  var all = sortMembers_(members_()), mr = myRank_(), bal = q_('balances', {}), dev = can_('members.dev');
  return { canDev: dev, canPurge: can_('members.purge'), canBulk: can_('members.bulk'), canView: can_('view.as'), members: all.map(function (m) {
    var p = pubMember_(m), b = bal[m.id] || { sum: 0, last: '' };
    p.ops = m.ops; p.memo = m.memo; p.joinedAt = m.joinedAt; p.balance = num_(b.sum); p.warnings = activeWarnings_(m.id).length;
    p.lastActivity = str_(b.last); p.rank = rankOf_(m); p.canManage = dev || (m.id !== me.id && rankOf_(m) < mr);
    return p;
  }) };
} };
function grantCheck_(oldOps, newOps) {
  var dev = can_('members.dev');
  oldOps.concat(newOps).forEach(function (x) {
    var changed = (oldOps.indexOf(x) >= 0) !== (newOps.indexOf(x) >= 0);
    if (changed && !dev && (x === 'dev' || TAG_RANK[x] >= myRank_())) fail_(TAG_NAMES[x] + ' 태그는 여기서 바꿀 수 없어요.');
  });
}
function createMember_(d) {
  var id = str_(d.id), name = str_(d.name, 30), pw = str_(d.password);
  if (!validId_(id)) fail_('아이디는 30자 이내의 영문·숫자·한글·_·-·. 로 정하세요: ' + id);
  if (member_(id)) fail_('이미 있는 아이디예요: ' + id);
  if (!name) fail_('이름을 입력하세요.');
  if (pw.length < 4) fail_('처음 비밀번호는 4자 이상으로 정하세요: ' + name);
  var ops = (d.ops || []).filter(function (x, i, a) { return TAG_RANK[x] && a.indexOf(x) === i; });
  grantCheck_([], ops);
  insert_('members', 'members', { id: id, name: name, password: pw, ops: opsStr_(ops), mentor: yn_(d.mentor), mentee: yn_(d.mentee),
    insta: str_(d.insta, 60).replace(/^@/, ''), memo: '', status: '활동', joinedAt: nowStamp_(), session: '' });
  CTX.members = null;
  log_('member.create', id, '', tagsOf_(member_(id)).map(function (x) { return TAG_NAMES[x]; }).join(', '), name);
  return member_(id);
}
ACTIONS['members.create'] = { write: true, need: 'members.manage', fn: function (req) { return pubMember_(createMember_(req.member || {})); } };
/** 여러 명 한꺼번에: 한 줄에 '이름, 아이디, 처음 비밀번호, 인스타, 멘토/멘티' */
ACTIONS['members.bulk'] = { write: true, need: 'members.bulk', fn: function (req) {
  var list = (req.members || []).slice(0, 200), made = [];
  if (!list.length) fail_('추가할 멤버가 없어요.');
  list.forEach(function (d) { made.push(pubMember_(createMember_(d))); });
  return { count: made.length, members: made };
} };
ACTIONS['members.update'] = { write: true, need: 'members.manage', fn: function (req) {
  var d = req.member || {}, m = member_(str_(d.id));
  requireLower_(m);
  var beforeTags = tagsOf_(m).map(function (x) { return TAG_NAMES[x]; }).join(', '), beforeInfo = m.name + ' / @' + m.insta;
  if (d.name !== undefined) { var nm = str_(d.name, 30); if (!nm) fail_('이름을 입력하세요.'); m.name = nm; }
  if (d.insta !== undefined) m.insta = str_(d.insta, 60).replace(/^@/, '');
  if (d.ops) {
    var newT = d.ops.filter(function (x, i, a) { return TAG_RANK[x] && a.indexOf(x) === i; });
    grantCheck_(m.ops, newT);
    m.ops = newT;
  }
  if (d.mentor !== undefined) m.mentor = !!d.mentor;
  if (d.mentee !== undefined) m.mentee = !!d.mentee;
  if (d.joinedAt !== undefined && can_('members.dev')) m.joinedAt = str_(d.joinedAt, 30);
  saveMember_(m);
  CTX.members = null;
  if (!devCount_()) fail_('활동 중인 개발자가 한 명은 있어야 해요.');
  var afterTags = tagsOf_(m).map(function (x) { return TAG_NAMES[x]; }).join(', ');
  if (beforeTags !== afterTags) log_('tag.change', m.id, beforeTags, afterTags, '');
  if (beforeInfo !== m.name + ' / @' + m.insta) log_('member.update', m.id, beforeInfo, m.name + ' / @' + m.insta, '');
  return pubMember_(m);
} };
ACTIONS['members.memo'] = { write: true, need: 'members.memo', fn: function (req) {
  var m = member_(str_(req.id));
  if (!m) fail_('멤버를 찾을 수 없어요.');
  m.memo = str_(req.memo, 2000);
  saveMember_(m);
  return true;
} };
ACTIONS['members.viewPw'] = { write: true, need: 'members.manage', fn: function (req) {
  var m = member_(str_(req.id));
  requireLower_(m);
  log_('password.view', m.id, '', '', '');
  return { password: m.password };
} };
ACTIONS['members.resetPw'] = { write: true, need: 'members.manage', fn: function (req) {
  var m = member_(str_(req.id));
  requireLower_(m);
  var pw = str_(req.password);
  if (pw.length < 4) fail_('비밀번호는 4자 이상으로 정하세요.');
  m.password = pw;
  saveMember_(m);
  log_('password.reset', m.id, '', '', '');
  return true;
} };
ACTIONS['members.setStatus'] = { write: true, need: 'members.manage', fn: function (req) {
  var m = member_(str_(req.id));
  requireLower_(m);
  var st = req.status;
  if (['active', 'expelled', 'deleted'].indexOf(st) < 0) fail_('상태 값이 올바르지 않아요.');
  var before = m.status;
  if (before === st) return true;
  m.status = st;
  saveMember_(m);
  CTX.members = null;
  if (!devCount_()) fail_('활동 중인 개발자가 한 명은 있어야 해요.');
  log_(st === 'expelled' ? 'member.expel' : st === 'deleted' ? 'member.delete' : 'member.restore', m.id, MEMBER_STATUS_WORDS[before], MEMBER_STATUS_WORDS[st], str_(req.reason, 300));
  return true;
} };
ACTIONS['members.purge'] = { write: true, need: 'members.purge', fn: function (req) {
  var m = member_(str_(req.id));
  if (!m) fail_('멤버를 찾을 수 없어요.');
  if (m.id === CTX.me.id) fail_('본인 계정은 지울 수 없어요.');
  if (m.status === 'active') fail_('활동 중인 멤버는 완전 삭제할 수 없어요. 먼저 퇴출하거나 삭제하세요.');
  var id = m.id, label = whoStr_(id);
  MEMBER_REF_COLS.forEach(function (x) { op_({ op: 'deleteWhere', table: x[0], where: [[x[1], id]], allSeasons: true }); });
  op_({ op: 'deleteWhere', table: 'members', where: [['id', id]], allSeasons: true });
  log_('member.purge', '', label, '', '기록까지 완전 삭제 (모든 시즌)');
  return true;
} };
ACTIONS['members.logoutAll'] = { write: true, need: 'members.dev', fn: function (req) {
  var m = member_(str_(req.id));
  if (!m) fail_('멤버를 찾을 수 없어요.');
  m.session = uid_();
  saveMember_(m);
  log_('member.logout', m.id, '', '', '');
  return m.id === CTX.me.id ? { token: makeToken_(m) } : true;
} };
ACTIONS['members.changeId'] = { write: true, need: 'members.dev', fn: function (req) {
  var m = member_(str_(req.id)), nid = str_(req.newId);
  if (!m) fail_('멤버를 찾을 수 없어요.');
  if (!validId_(nid)) fail_('아이디는 30자 이내의 영문·숫자·한글·_·-·. 로 정하세요.');
  if (nid === m.id) fail_('지금과 같은 아이디예요.');
  if (member_(nid)) fail_('이미 있는 아이디예요.');
  var old = m.id;
  op_({ op: 'renameMember', from: old, to: nid });
  log_('member.rename', old, old, nid, m.name);
  return { id: nid, self: old === CTX.me.id };
} };
ACTIONS['members.merge'] = { write: true, need: 'members.dev', fn: function (req) {
  var from = member_(str_(req.from)), into = member_(str_(req.into));
  if (!from || !into) fail_('멤버를 찾을 수 없어요.');
  if (from.id === into.id) fail_('같은 계정이에요.');
  if (from.id === CTX.me.id) fail_('지금 로그인한 계정을 다른 계정으로 합칠 수는 없어요.');
  op_({ op: 'mergeMember', from: from.id, into: into.id });
  log_('member.merge', into.id, from.name + ' (' + from.id + ')', into.name + ' (' + into.id + ')', '기록을 합치고 ' + from.id + ' 계정을 지움');
  return true;
} };
ACTIONS['view.as'] = { need: 'view.as', fn: function (req, me) {
  var t = member_(str_(req.id));
  if (!t) fail_('멤버를 찾을 수 없어요.');
  return { token: makeViewToken_(t, me), name: t.name };
} };

// ---------- 주간 정산 ----------
ACTIONS['settle.list'] = { need: 'settle.view', books: ['settle'], fn: function () {
  var list = rows_('settle', 'list').filter(function (r) { return parseDate_(r.week); }).map(function (r) { return { week: weekOf_(parseDate_(r.week)), at: str_(r.at), byName: nameOf_(whoId_(r.by)), total: num_(r.total) }; })
    .sort(function (a, b) { return a.week < b.week ? 1 : -1; });
  return { settled: list, unsettled: unsettledWeeks_(), current: weekOf_(today_()), canConfirm: can_('settle.confirm'), canCancel: can_('settle.cancel') };
} };
ACTIONS['settle.preview'] = { need: 'settle.view', books: ['settle'], fn: function (req) {
  var w = str_(req.week);
  if (isDate_(w) && isLocked_(w)) { need_(['sweek:' + weekOf_(w)]); return settledWeek_(weekOf_(w)); }
  return settlePreview_(w);
} };
ACTIONS['settle.confirm'] = { write: true, need: 'settle.confirm', books: ['board', 'settle'], fn: function (req, me) {
  var week = str_(req.week);
  if (str_(req.phrase) !== '정산 확정') fail_('확인 문구를 정확히 입력하세요: 정산 확정');
  if (isDate_(week) && isLocked_(week)) fail_('이미 정산한 주예요.');
  var pv = settlePreview_(week), total = 0;
  need_(['sweek:' + week]);
  var label = { attend: '생존', study: '공부', problem: '문제', mentoring: '멘토멘티', daily: '데일리' };
  pv.rows.forEach(function (r) {
    total += r.total;
    if (!r.total) return;
    var parts = [];
    Object.keys(label).forEach(function (k) { if (r.bonus[k]) parts.push(label[k] + ' ' + r.bonus[k]); });
    if (r.rankBonus) parts.push('랭킹 ' + r.rank + '등 ' + r.rankBonus);
    addPie_(r.memberId, r.total, 'settle', week, '주간 정산', monthDay_(week) + ' 주 (' + parts.join(' · ') + ')');
  });
  replaceAll_('sweek:' + week, 'rows', pv.rows.map(function (r) {
    return { memberId: r.memberId, name: r.name, attend: r.counts.attend, study: r.counts.study, problem: r.counts.problem, mentoring: r.counts.mentoring, daily: r.counts.daily,
             bAttend: r.bonus.attend, bStudy: r.bonus.study, bProblem: r.bonus.problem, bMentoring: r.bonus.mentoring, bDaily: r.bonus.daily,
             minutes: fmtMinutes_(r.minutes), rank: r.rank || '', rankBonus: r.rankBonus, total: r.total };
  }));
  insert_('settle', 'list', { week: week, to: pv.to, at: nowStamp_(), by: whoStr_(me.id), total: total });
  var lines = ['📊 ' + monthDay_(week) + ' ~ ' + monthDay_(pv.to) + ' 주간 정산 결과', '', '🏆 공부시간 랭킹'];
  if (!pv.ranking.length) lines.push('- 기록 없음');
  pv.ranking.filter(function (x) { return x.rank <= 5; }).forEach(function (x) { lines.push(x.rank + '등 ' + x.name + ' — ' + Math.floor(x.minutes / 60) + '시간 ' + (x.minutes % 60) + '분 (+' + x.bonus + ')'); });
  var full = pv.rows.filter(function (r) { return r.counts.attend === 7 && r.counts.study === 7 && r.counts.problem === 7; }).map(function (r) { return r.name; });
  var att = pv.rows.filter(function (r) { return r.counts.attend === 7; }).map(function (r) { return r.name; });
  lines.push('', '🌟 필수 인증 개근 (' + mname_('attend') + '·' + mname_('study') + '·' + mname_('problem') + ' 7일)', full.length ? full.join(', ') : '- 없음', '', '✅ ' + mname_('attend') + ' 개근', att.length ? att.join(', ') : '- 없음', '', '모두 수고하셨어요! 이번 주도 함께 나아가요 🧭');
  insert_('board', 'notices', { id: nextId_('board', 'notices'), title: '[주간 정산] ' + monthDay_(week) + ' ~ ' + monthDay_(pv.to) + ' 결과', body: lines.join('\n'),
    author: whoStr_(me.id), at: nowStamp_(), pinned: '', important: '', draft: 'O', deleted: '', updatedAt: nowStamp_() });
  log_('settle.confirm', '', '', week, '총 ' + total + '파이 지급');
  return { week: week, total: total };
} };
ACTIONS['settle.cancel'] = { write: true, need: 'settle.cancel', books: ['settle'], fn: function (req) {
  var week = str_(req.week);
  if (str_(req.phrase) !== '정산 취소') fail_('확인 문구를 정확히 입력하세요: 정산 취소');
  if (!isDate_(week) || !isLocked_(week)) fail_('정산하지 않은 주예요.');
  week = weekOf_(week);
  need_(['sweek:' + week]);
  var total = 0;
  rows_('sweek:' + week, 'rows').forEach(function (r) {
    var t = Math.round(num_(r.total)), mid = str_(r.memberId);
    if (!t || !mid) return;
    total += t;
    addPie_(mid, -t, 'settle', week, '주간 정산', monthDay_(week) + ' 주 정산 취소');
  });
  rows_('settle', 'list').filter(function (r) { return parseDate_(r.week) && weekOf_(parseDate_(r.week)) === week; }).forEach(function (r) { remove_('settle', 'list', r); });
  replaceAll_('sweek:' + week, 'rows', []);
  log_('settle.cancel', '', week, '', '지급했던 ' + total + '파이 회수');
  return { week: week, total: total };
} };

// ---------- 공지 ----------
ACTIONS['notices.save'] = { write: true, need: 'notices.manage', books: ['board'], fn: function (req, me) {
  var d = req.notice || {}, title = str_(d.title, 100);
  if (!title) fail_('제목을 입력하세요.');
  var row = d.id ? rows_('board', 'notices').filter(function (n) { return str_(n.id) === str_(d.id); })[0] : null;
  var publishing = row && yes_(row.draft) && !d.draft;
  if (!row) row = insert_('board', 'notices', { id: nextId_('board', 'notices'), author: whoStr_(me.id), at: nowStamp_() });
  row.title = title; row.body = str_(d.body, 20000); row.pinned = yn_(d.pinned); row.important = yn_(d.important); row.draft = yn_(d.draft); row.updatedAt = nowStamp_();
  if (publishing) { row.at = nowStamp_(); row.author = whoStr_(me.id); }
  touch_('board', 'notices', row);
  log_('notice.save', '', '', title, d.draft ? '초안' : '게시');
  return true;
} };
ACTIONS['notices.delete'] = { write: true, need: 'notices.manage', books: ['board'], fn: function (req) {
  var n = rows_('board', 'notices').filter(function (x) { return str_(x.id) === str_(req.id); })[0];
  if (!n) fail_('공지를 찾을 수 없어요.');
  n.deleted = 'O';
  touch_('board', 'notices', n);
  log_('notice.delete', '', n.title, '', '');
  return true;
} };

// ---------- 활동 기록 ----------
ACTIONS['logs.list'] = { need: 'logs.view', fn: function (req) {
  var args = { limit: Math.min(1000, num_(req.limit) || 300) };
  if (isDate_(req.from)) args.from = req.from;
  if (isDate_(req.to)) args.to = req.to;
  if (req.actor) args.actor = whoStr_(req.actor);
  if (req.target) args.target = whoStr_(req.target);
  if (req.act) args.act = str_(req.act);
  var r = q_('logs', args);
  return { total: r.total, list: r.rows.map(function (l) {
    return { at: str_(l.at), actorName: str_(l.actor), action: str_(l.action), targetName: str_(l.target), before: str_(l.before), after: str_(l.after), reason: str_(l.reason) };
  }), members: sortMembers_(members_()).map(pubMember_), actions: r.actions };
} };

// ================================================================
// 13. 기능 목록 — 시스템 설정 · 개발자 도구
// ================================================================

// ---------- 시스템 설정 ----------
ACTIONS['settings.get'] = { need: 'settings.edit', fn: function () {
  var S = settings_(), access = Object.keys(ACCESS).map(function (k) {
    return { key: k, group: ACCESS[k][1], desc: accessDesc_(k, S.weeksAhead), dflt: ACCESS[k][0], rank: accessRank_(k), locked: LOCKED_ACCESS.indexOf(k) >= 0 };
  });
  return { settings: clone_(S), version: VERSION, season: CTX.season, seasonName: CTX.meta.season_name || '', seasonStart: seasonStart_(), maintenance: CTX.meta.maintenance || '',
           basicFields: BASIC_FIELDS.map(function (f) { return { key: f[0], label: f[1], dflt: f[2], note: f[3], type: f[4] || 'num' }; }),
           textFields: TEXT_FIELDS.map(function (f) { return { key: f[0], label: f[1], dflt: f[2] }; }),
           missionDefaults: MISSION_NAMES, access: access, rankWords: RANK_WORDS,
           can: { missions: can_('missions.edit'), texts: can_('texts.edit'), access: can_('access.edit'), season: can_('season.edit'), reset: can_('season.reset'),
                  usage: can_('usage.view'), maintenance: can_('maintenance'), holidays: can_('holidays') } };
} };
ACTIONS['settings.save'] = { write: true, need: 'settings.edit', fn: function (req) {
  var S = settings_(), d = req.settings || {};
  if (d.groupName !== undefined) { var g = str_(d.groupName, 30); if (!g) fail_('그룹 이름을 입력하세요.'); S.groupName = g; }
  if (d.deadlineHour !== undefined) { var h = Math.round(num_(d.deadlineHour)); if (h < 0 || h > 23) fail_('마감 시각은 0~23 사이로 정하세요.'); S.deadlineHour = h; }
  if (d.rewards) Object.keys(S.rewards).forEach(function (k) { if (d.rewards[k] !== undefined && str_(d.rewards[k]) !== '') S.rewards[k] = Math.max(0, Math.round(num_(d.rewards[k]))); });
  if (d.bonus) Object.keys(S.bonus).forEach(function (k) { if (!d.bonus[k]) return; var o = {}; Object.keys(d.bonus[k]).forEach(function (n) { var v = Math.round(num_(d.bonus[k][n])); if (v > 0 && +n >= 1 && +n <= 7) o[+n] = v; }); S.bonus[k] = o; });
  if (d.rankBonus) { var rb = d.rankBonus.slice(0, 30).map(function (v) { return Math.max(0, Math.round(num_(v))); }); while (rb.length && !rb[rb.length - 1]) rb.pop(); S.rankBonus = rb; }
  if (d.expelAt !== undefined) S.expelAt = Math.max(1, Math.round(num_(d.expelAt)));
  if (d.dayoffPerWeek !== undefined) S.dayoffPerWeek = Math.max(0, Math.min(7, Math.round(num_(d.dayoffPerWeek))));
  if (d.weeksAhead !== undefined) S.weeksAhead = Math.max(0, Math.min(52, Math.round(num_(d.weeksAhead))));
  if (d.banner) ['evening', 'morning'].forEach(function (k) { if (d.banner[k] !== undefined) S.banner[k] = Math.max(0, Math.min(23, Math.round(num_(d.banner[k])))); });
  if (d.budget) { if (d.budget.dbMB !== undefined) S.budget.dbMB = Math.max(1, num_(d.budget.dbMB)); if (d.budget.requests !== undefined) S.budget.requests = Math.max(1, Math.round(num_(d.budget.requests))); }
  writeBasic_(S); writeBonus_(S);
  log_('settings.save', '', '', '', '기본 수치 저장');
  return true;
} };
ACTIONS['missions.save'] = { write: true, need: 'missions.edit', fn: function (req) {
  var S = settings_(), list = req.missions || [];
  list.forEach(function (m) {
    var cur = S.missions.byKey[m.key];
    if (!cur) return;
    if (m.name !== undefined) { var nm = str_(m.name, 20); if (!nm) fail_('미션 이름을 비울 수 없어요.'); cur.name = nm; }
    if (m.key === 'weekly') return;
    if (m.order !== undefined) cur.order = Math.round(num_(m.order));
    if (m.on !== undefined) cur.on = !!m.on;
    if (m.required !== undefined) cur.required = !!m.required;
    if (m.deadline === 'today' || m.deadline === 'next') cur.deadline = m.deadline;
  });
  var names = {};
  Object.keys(S.missions.byKey).forEach(function (k) { var n = S.missions.byKey[k].name; if (names[n]) fail_('미션 이름이 겹쳐요: ' + n); names[n] = true; });
  if (!Object.keys(S.missions.byKey).some(function (k) { return k !== 'weekly' && S.missions.byKey[k].on; })) fail_('미션을 하나 이상 켜 두세요.');
  writeMissions_(S);
  log_('missions.save', '', '', '', '미션 이름 · 순서 · 켜기 · 필수 · 마감');
  return true;
} };
ACTIONS['texts.save'] = { write: true, need: 'texts.edit', fn: function (req) {
  var S = settings_(), t = req.texts || {};
  TEXT_FIELDS.forEach(function (f) {
    if (t[f[0]] === undefined) return;
    var v = String(t[f[0]] === null ? '' : t[f[0]]).slice(0, 500);
    if (/^color\./.test(f[0]) && v && !/^#[0-9a-fA-F]{3,8}$/.test(v)) fail_(f[1] + '은(는) #으로 시작하는 색 코드로 적어 주세요.');
    if (/^tag\./.test(f[0]) && !str_(v)) v = f[2];
    if (/^menu\./.test(f[0])) v = yes_(v) || v === true ? 'O' : 'X';
    S.texts[f[0]] = v;
  });
  writeTexts_(S);
  log_('texts.save', '', '', '', '화면 문구 · 태그 · 메뉴');
  return true;
} };
ACTIONS['access.save'] = { write: true, need: 'access.edit', fn: function (req) {
  var S = settings_(), a = req.access || {};
  Object.keys(a).forEach(function (k) {
    if (!ACCESS[k] || LOCKED_ACCESS.indexOf(k) >= 0) return;
    var r = Math.round(num_(a[k]));
    if (r < 0 || r > 4) fail_('단계 값이 올바르지 않아요.');
    S.access[k] = r;
  });
  writeAccess_(S);
  log_('access.save', '', '', '', Object.keys(a).length + '개 기능');
  return true;
} };
ACTIONS['season.edit'] = { write: true, need: 'season.edit', fn: function (req) {
  var S = settings_();
  if (req.name !== undefined) setMeta_('season_name', str_(req.name, 40));
  if (req.start !== undefined) { if (!isDate_(req.start)) fail_('시작일이 올바르지 않아요.'); setMeta_('season_start', req.start); }
  if (req.dayStartHour !== undefined) {
    var h = Math.round(num_(req.dayStartHour));
    if (h < 0 || h > 6) fail_('하루가 바뀌는 시각은 0~6시 사이로 정하세요.');
    S.dayStartHour = h;
    writeBasic_(S);
  }
  log_('season.edit', '', '', (req.name || '') + ' ' + (req.start || '') + (req.dayStartHour !== undefined ? ' 하루 시작 ' + req.dayStartHour + '시' : ''), '');
  return true;
} };
ACTIONS['season.reset'] = { write: true, need: 'season.reset', books: ['shop', 'settings'], fn: function (req, me) {
  if (str_(req.digits).replace(/\s/g, '') !== PI_101_110) fail_('숫자가 맞지 않아요. 원주율 소수점 아래 101번째부터 110번째 자리를 정확히 입력하세요.');
  var o = req.keep || {}, S = clone_(settings_()), today = today_();
  var keep = members_().filter(function (m) { return m.status === 'active' && (o.members || m.ops.indexOf('dev') >= 0 || m.id === me.id); });
  var carryMembers = keep.map(function (m) {
    return { id: m.id, name: m.name, password: m.password, ops: opsStr_(o.members ? m.ops : m.ops.filter(function (t) { return t === 'dev'; })),
             mentor: yn_(!!o.members && m.mentor), mentee: yn_(!!o.members && m.mentee), insta: m.insta, memo: o.members ? m.memo : '', status: '활동', joinedAt: nowStamp_(), session: m.session || '' };
  });
  var products = o.products ? productList_().filter(function (p) { return p.status === 'on'; }).map(function (p, i) {
    return { id: String(i + 1), name: p.name, desc: p.desc, price: String(p.price), type: p.type === 'warn' ? '경고 차감' : '일반', stock: p.stock === null ? '' : String(p.stock),
             limitType: { none: '없음', total: '전체 기간', weekly: '주당' }[p.limitType], limitN: p.limitType === 'none' ? '' : String(p.limitN), status: '판매 중', at: nowStamp_() };
  }) : [];
  var sched = o.settings === false ? [] : rows_('settings', 'schedule').filter(function (r) { return parseDate_(r.date) >= today; }).map(function (r) { return { date: r.date, games: r.games, by: r.by, at: r.at }; });
  var hol = o.settings === false ? [] : rows_('settings', 'holidays').filter(function (r) { return parseDate_(r.date) >= today; }).map(function (r) { return { date: r.date, reason: r.reason, by: r.by, at: r.at }; });
  var prevNo = CTX.season, base = o.settings === false ? defaultSettingsObj_() : S;
  log_('season.reset', '', '시즌 ' + prevNo, '새 시즌 시작', '');
  // 여기부터 저장되는 줄은 모두 새 시즌으로 들어가요
  var logs = stubAppends_('logs', 'logs').slice();
  op_({ op: 'insert', table: 'logs', season: prevNo, rows: logs.map(function (x) { return plainRow_(TABLES.logs.cols, x); }) });
  stubAppends_('logs', 'logs').length = 0;
  CTX.season = prevNo + 1;
  writeAllSettings_(base);
  replaceAll_('settings', 'schedule', sched);
  replaceAll_('settings', 'holidays', hol);
  replaceAll_('members', 'members', carryMembers);
  replaceAll_('shop', 'products', products);
  CTX.members = null;
  setMeta_('season', CTX.season); setMeta_('season_start', today); setMeta_('season_name', '');
  log_('season.start', '', '', '시즌 ' + CTX.season, '');
  return { season: '시즌 ' + CTX.season };
} };

// ---------- 사용량 · 오류 · 점검 중 ----------
/** 속도 점검: 가장 가벼운 요청 (로그인 확인 + 기본 설정 읽기만) */
ACTIONS['system.ping'] = { need: 'usage.view', fn: function () { return { at: nowMs_() }; } };
ACTIONS['system.usage'] = { need: 'usage.view', pre: function () { return [qkey_('size', {}), qkey_('usage', { days: 30 })]; }, fn: function () {
  var S = settings_(), size = q_('size', {}), days = q_('usage', { days: 30 }), today = ymd_(nowMs_());
  var t = days.filter(function (x) { return x.day === today; })[0] || { day: today, requests: 0, errors: 0, ms: 0 };
  return { db: { bytes: num_(size.schemaBytes), totalBytes: num_(size.dbBytes), budgetMB: S.budget.dbMB, pct: num_(size.schemaBytes) / (S.budget.dbMB * 1048576) * 100 },
           today: { requests: num_(t.requests), errors: num_(t.errors), avgMs: num_(t.requests) ? Math.round(num_(t.ms) / num_(t.requests)) : 0, budget: S.budget.requests, pct: num_(t.requests) / S.budget.requests * 100 },
           days: days.map(function (x) { return { day: x.day, requests: num_(x.requests), errors: num_(x.errors), avgMs: num_(x.requests) ? Math.round(num_(x.ms) / num_(x.requests)) : 0 }; }),
           tables: size.tables || [] };
} };
ACTIONS['system.errors'] = { need: 'usage.view', fn: function () {
  return { list: q_('errors', { limit: 200 }).map(function (r) { return { at: str_(r.at), action: str_(r.action), actor: str_(r.actor), message: str_(r.message) }; }) };
} };
ACTIONS['system.maintenance'] = { write: true, need: 'maintenance', fn: function (req) {
  var msg = req.on ? (str_(req.message, 300) || '지금 점검 중이에요. 잠시 후 다시 들어와 주세요.') : '';
  setMeta_('maintenance', msg);
  log_('maintenance', '', '', msg ? '켜기' : '끄기', msg);
  return { maintenance: msg };
} };

// ---------- 파이 도구 ----------
ACTIONS['pie.editRow'] = { write: true, need: 'pie.tools', fn: function (req) {
  var r = q_('rowsById', { table: 'ledger', ids: [str_(req.id)] })[0];
  if (!r) fail_('파이 내역을 찾을 수 없어요.');
  var before = r.amount + ' / ' + r.reason;
  if (req.amount !== undefined) { if (!isNumText_(req.amount) || str_(req.amount) === '') fail_('금액을 숫자로 적어 주세요.'); r.amount = String(Math.round(num_(req.amount))); }
  if (req.reason !== undefined) r.reason = str_(req.reason, 300);
  touchRow_('ledger', r);
  log_('pie.editRow', str_(r._member), before, r.amount + ' / ' + r.reason, '');
  return true;
} };
ACTIONS['pie.deleteRow'] = { write: true, need: 'pie.tools', fn: function (req) {
  var r = q_('rowsById', { table: 'ledger', ids: [str_(req.id)] })[0];
  if (!r) fail_('파이 내역을 찾을 수 없어요.');
  removeRow_('ledger', r._id);
  log_('pie.deleteRow', str_(r._member), r.at + ' ' + r.type + ' ' + r.amount + ' (' + r.reason + ')', '', str_(req.reason));
  return true;
} };
ACTIONS['pie.setBalance'] = { write: true, need: 'pie.tools', pre: function (req) { return [qkey_('bal', { member: str_(req.memberId) })]; }, fn: function (req) {
  var m = member_(str_(req.memberId));
  if (!m) fail_('멤버를 찾을 수 없어요.');
  if (!isNumText_(req.target) || str_(req.target) === '') fail_('맞출 잔액을 숫자로 적어 주세요.');
  var target = Math.round(num_(req.target)), now = balance_(m.id), diff = target - now;
  if (!diff) return { diff: 0, balance: now };
  addPie_(m.id, diff, 'manual', '', '', str_(req.reason, 300) || ('잔액 맞추기 (' + now + ' → ' + target + ')'));
  log_('pie.setBalance', m.id, now, target, str_(req.reason));
  return { diff: diff, balance: target };
} };
/** 판정 · 위클리 · 미니게임 기록과 파이 내역이 맞는지 다시 계산 */
function pieRecalc_(from, to) {
  var dates = existingDates_(from, to);
  loadDays_(dates, ['grid', 'log', 'plays']);
  need_(['quests', qkey_('ledgerRange', { from: addDays_(from, -1), to: to })]);
  syncDays_(dates);
  var rows = q_('ledgerRange', { from: addDays_(from, -1), to: to }), actual = {}, expected = {}, label = {};
  var missionTypes = ['미션 판정', '재판정', '직접 수정 반영', '시트 수정 반영', '다시 계산 보정'];
  rows.forEach(function (r) {
    var d = parseDate_(r.refDate), mid = str_(r._member), t = str_(r.type), item = str_(r.refItem);
    if (!d) return;
    var mi = missionKey_(item), g = gameKey_(item), key = null;
    if (mi === 'weekly' && (t === '위클리 퀘스트' || missionTypes.indexOf(t) >= 0)) key = mid + '|' + d + '|weekly';
    else if (mi && missionTypes.indexOf(t) >= 0) key = mid + '|' + d + '|' + mi;
    else if (g && (t === '미니게임' || t === '다시 계산 보정')) key = mid + '|' + d + '|g:' + g;
    if (key) actual[key] = (actual[key] || 0) + num_(r.amount);
  });
  dates.forEach(function (d) {
    rows_(dayKey_(d), 'log').forEach(function (lg) { var mi = missionKey_(lg.mission), mid = str_(lg.memberId); if (!mi || mi === 'weekly' || !mid) return; var k = mid + '|' + d + '|' + mi; expected[k] = (expected[k] || 0) + num_(lg.pie); label[k] = mname_(mi); });
    rows_(dayKey_(d), 'plays').forEach(function (p) { var g = gameKey_(p.game), mid = str_(p.memberId); if (!g || !mid) return; var k = mid + '|' + d + '|g:' + g; expected[k] = (expected[k] || 0) + num_(p.pie); label[k] = GAME_NAMES[g]; });
  });
  rows_('quests', 'weekly').forEach(function (r) { var w = parseDate_(r.week), mid = str_(r.memberId); if (!w || w < from || w > to || !mid) return; var k = mid + '|' + w + '|weekly'; expected[k] = (expected[k] || 0) + num_(r.pie); label[k] = mname_('weekly'); });
  var keys = {}, out = [];
  Object.keys(actual).forEach(function (k) { keys[k] = true; });
  Object.keys(expected).forEach(function (k) { keys[k] = true; });
  Object.keys(keys).forEach(function (k) {
    var p = k.split('|'), d = p[1];
    if (d < from || d > to) return;
    var e = Math.round(expected[k] || 0), a = Math.round(actual[k] || 0);
    if (e === a) return;
    var item = p[2].indexOf('g:') === 0 ? p[2].slice(2) : p[2];
    out.push({ memberId: p[0], name: nameOf_(p[0]), date: d, item: item, itemName: label[k] || (GAME_NAMES[item] || mname_(item) || item), expected: e, actual: a, diff: e - a });
  });
  out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.name).localeCompare(String(b.name), 'ko'); });
  return out;
}
ACTIONS['pie.recalc'] = { need: 'pie.tools', fn: function (req, me) {
  var to = isDate_(req.to) ? req.to : today_(), from = isDate_(req.from) ? req.from : addDays_(to, -27);
  if (dayNum_(to) - dayNum_(from) > 92) fail_('한 번에 93일까지 계산할 수 있어요.');
  var list = pieRecalc_(from, to), sum = 0;
  list.forEach(function (x) { sum += x.diff; });
  if (req.apply) {
    list.forEach(function (x) { addPie_(x.memberId, x.diff, 'fix', x.date, x.item, '다시 계산 보정 (기록 ' + x.expected + ' / 지급 ' + x.actual + ')'); });
    log_('pie.recalc', '', '', list.length + '건', '합계 ' + sum + '파이 보정 (' + from + ' ~ ' + to + ')');
  }
  return { from: from, to: to, list: list, sum: sum, applied: !!req.apply };
} };

// ---------- 데이터 편집기 ----------
function dataTable_(name) {
  var def = TABLES[name];
  if (!def) fail_('알 수 없는 표예요: ' + name);
  return def;
}
function editableCols_(def) { var c = def.cols.map(function (x) { return x[0]; }); if (def.scope) c.push(SCOPE_COLS[def.scope]); c.push('_season'); return c; }
ACTIONS['data.tables'] = { need: 'data.edit', pre: function () { return [qkey_('tableCounts', {}), qkey_('seasons', {})]; }, fn: function () {
  var counts = q_('tableCounts', {}), seasons = q_('seasons', {});
  if (seasons.indexOf(CTX.season) < 0) seasons.push(CTX.season);
  return { season: CTX.season, seasons: seasons.sort(function (a, b) { return b - a; }), tables: Object.keys(TABLES).map(function (k) {
    var d = TABLES[k];
    return { table: k, title: d.title, scope: d.scope ? SCOPE_COLS[d.scope] : null, scopeLabel: d.scope ? SCOPE_LABELS[SCOPE_COLS[d.scope]] : '', cols: d.cols, count: counts[k] || 0 };
  }) };
} };
ACTIONS['data.rows'] = { need: 'data.edit', fn: function (req) {
  var def = dataTable_(str_(req.table)), cols = editableCols_(def).concat(['_id']);
  var args = { table: def.table, season: req.season === 'all' ? 'all' : (Math.round(num_(req.season)) || CTX.season), offset: Math.max(0, Math.round(num_(req.offset))), limit: Math.min(5000, Math.max(1, Math.round(num_(req.limit)) || 100)) };
  if (str_(req.search)) args.search = str_(req.search, 100);
  if (req.filters) { var f = {}; Object.keys(req.filters).forEach(function (c) { if (cols.indexOf(c) >= 0 && str_(req.filters[c]) !== '') f[c] = str_(req.filters[c], 100); }); if (Object.keys(f).length) args.filters = f; }
  if (req.sort && cols.indexOf(req.sort) >= 0) { args.sort = req.sort; args.desc = !!req.desc; }
  return q_('dataRows', args);
} };
function historyRow_(batch, table, rowId, op, before, after) {
  winsert_('history', 'history', { batch: batch, at: nowStamp_(), actor: whoStr_(CTX.me.id), tableName: table, rowId: String(rowId), op: op,
    before: before ? JSON.stringify(before) : '', after: after ? JSON.stringify(after) : '', undone: '' });
}
/** 고치기 · 추가 · 지우기를 한 번에. edits: [{id, set:{칸: 값}}], adds: [{칸: 값}], removes: [id] */
function dataApply_(table, edits, adds, removes, label, keepHistory) {
  var def = dataTable_(table), cols = editableCols_(def), batch = uid_(), n = 0;
  edits = edits || []; adds = adds || []; removes = removes || [];
  var ids = edits.map(function (e) { return str_(e.id); }).concat(removes.map(String)).filter(Boolean);
  var cur = {};
  if (ids.length) q_('rowsById', { table: table, ids: ids }).forEach(function (r) { cur[str_(r._id)] = r; });
  edits.forEach(function (e) {
    var r = cur[str_(e.id)], set = {}, before = {};
    if (!r) fail_('줄을 찾을 수 없어요 (번호 ' + e.id + '). 다른 사람이 지웠을 수 있어요.');
    Object.keys(e.set || {}).forEach(function (c) {
      if (cols.indexOf(c) < 0) fail_('고칠 수 없는 칸이에요: ' + c);
      var v = c === '_season' ? String(Math.max(1, Math.round(num_(e.set[c])))) : String(e.set[c] === null || e.set[c] === undefined ? '' : e.set[c]);
      if (String(r[c]) === v) return;
      before[c] = String(r[c] === null || r[c] === undefined ? '' : r[c]); set[c] = v;
    });
    if (!Object.keys(set).length) return;
    op_({ op: 'set', table: table, id: str_(e.id), set: set });
    if (keepHistory) historyRow_(batch, table, e.id, '수정', before, set);
    n++;
  });
  removes.forEach(function (id) {
    var r = cur[String(id)];
    if (!r) return;
    op_({ op: 'delete', table: table, ids: [String(id)] });
    if (keepHistory) historyRow_(batch, table, id, '삭제', r, null);
    n++;
  });
  if (adds.length) {
    var newIds = q_('nextIds', { table: table, n: adds.length });
    var rows = adds.map(function (a, i) {
      var r = { _id: String(newIds[i]), _season: String(a._season ? Math.max(1, Math.round(num_(a._season))) : CTX.season) };
      def.cols.forEach(function (c) { r[c[0]] = a[c[0]] === undefined || a[c[0]] === null ? '' : String(a[c[0]]); });
      if (def.scope) r[SCOPE_COLS[def.scope]] = str_(a[SCOPE_COLS[def.scope]]);
      return r;
    });
    op_({ op: 'insert', table: table, rows: rows });
    if (keepHistory) rows.forEach(function (r) { historyRow_(batch, table, r._id, '추가', null, r); });
    n += rows.length;
  }
  if (n) log_(label || 'data.save', '', '', def.title + ' ' + n + '줄', keepHistory ? '되돌리기 번호 ' + batch : '');
  return { count: n, batch: keepHistory ? batch : '' };
}
ACTIONS['data.save'] = { write: true, need: 'data.edit', pre: function (req) {
  var ids = (req.edits || []).map(function (e) { return str_(e.id); }).concat((req.removes || []).map(String)).filter(Boolean), out = [];
  if (ids.length) out.push(qkey_('rowsById', { table: str_(req.table), ids: ids }));
  if ((req.adds || []).length) out.push(qkey_('nextIds', { table: str_(req.table), n: req.adds.length }));
  return out;
}, fn: function (req) {
  if ((req.edits || []).length + (req.adds || []).length + (req.removes || []).length > 2000) fail_('한 번에 2000줄까지 고칠 수 있어요.');
  return dataApply_(str_(req.table), req.edits, req.adds, req.removes, 'data.save', true);
} };
ACTIONS['data.history'] = { need: 'data.edit', fn: function (req) {
  var rows = q_('history', { limit: Math.min(2000, num_(req.limit) || 600) }), batches = {}, order = [];
  rows.forEach(function (r) {
    var b = str_(r.batch);
    if (!batches[b]) { batches[b] = { batch: b, at: str_(r.at), actor: str_(r.actor), table: str_(r.tableName), title: TABLES[str_(r.tableName)] ? TABLES[str_(r.tableName)].title : str_(r.tableName), edits: 0, adds: 0, removes: 0, undone: yes_(r.undone), samples: [] }; order.push(b); }
    var x = batches[b];
    if (r.op === '수정') x.edits++; else if (r.op === '추가') x.adds++; else if (r.op === '삭제') x.removes++;
    if (x.samples.length < 3) x.samples.push({ op: str_(r.op), rowId: str_(r.rowId), before: str_(r.before).slice(0, 200), after: str_(r.after).slice(0, 200) });
  });
  return { batches: order.map(function (b) { return batches[b]; }) };
} };
ACTIONS['data.undo'] = { write: true, need: 'data.edit', pre: function (req) { return [qkey_('historyBatch', { batch: str_(req.batch) })]; }, fn: function (req) {
  var rows = q_('historyBatch', { batch: str_(req.batch) });
  if (!rows.length) fail_('되돌릴 기록을 찾을 수 없어요.');
  if (rows.every(function (r) { return yes_(r.undone); })) fail_('이미 되돌린 기록이에요.');
  rows.slice().reverse().forEach(function (r) {
    if (yes_(r.undone)) return;
    var table = str_(r.tableName), id = str_(r.rowId), before = parseJson_(r.before, null);
    if (!TABLES[table]) return;
    if (r.op === '수정' && before) op_({ op: 'set', table: table, id: id, set: before });
    else if (r.op === '추가') op_({ op: 'delete', table: table, ids: [id] });
    else if (r.op === '삭제' && before) { var row = {}; Object.keys(before).forEach(function (k) { row[k] = before[k] === null || before[k] === undefined ? '' : String(before[k]); }); row._id = id; op_({ op: 'insert', table: table, rows: [row] }); }
    r.undone = 'O';
    touchRow_('edit_history', r);
  });
  log_('data.undo', '', '', (TABLES[str_(rows[0].tableName)] || {}).title || rows[0].tableName, '되돌리기 번호 ' + req.batch + ' (' + rows.length + '줄)');
  return { count: rows.length };
} };
ACTIONS['data.import'] = { write: true, need: 'backup', pre: function (req) {
  var ids = (req.rows || []).map(function (r) { return str_(r._id); }).filter(Boolean), out = [];
  if (ids.length) out.push(qkey_('rowsById', { table: str_(req.table), ids: ids }));
  var adds = (req.rows || []).length;
  if (adds) out.push(qkey_('nextIds', { table: str_(req.table), n: adds }));
  return out;
}, fn: function (req) {
  var def = dataTable_(str_(req.table)), rows = req.rows || [];
  if (!rows.length) fail_('올릴 줄이 없어요.');
  if (rows.length > 5000) fail_('한 번에 5000줄까지 올릴 수 있어요.');
  var have = {}, ids = rows.map(function (r) { return str_(r._id); }).filter(Boolean);
  if (ids.length) q_('rowsById', { table: def.table, ids: ids }).forEach(function (r) { have[str_(r._id)] = true; });
  var cols = editableCols_(def), edits = [], adds = [];
  rows.forEach(function (r) {
    var set = {};
    Object.keys(r).forEach(function (c) { if (cols.indexOf(c) >= 0) set[c] = r[c]; });
    if (str_(r._id) && have[str_(r._id)] && req.mode !== 'append') edits.push({ id: str_(r._id), set: set }); else adds.push(set);
  });
  // nextIds 는 줄 수만큼 미리 받아 두었으니 그대로 써요
  var res = dataApply_(def.table, edits, adds.length ? adds : [], [], 'data.import', edits.length + adds.length <= 1000);
  return { count: res.count, edits: edits.length, adds: adds.length, batch: res.batch };
} };

// ---------- 백업 ----------
ACTIONS['backup.export'] = { write: true, need: 'backup', pre: function (req) { return [qkey_('dump', { all: !!req.all })]; }, fn: function (req) {
  var d = q_('dump', { all: !!req.all }), meta = {};
  Object.keys(CTX.meta).forEach(function (k) { if (k !== 'token_secret' && k !== 'schema_hash') meta[k] = CTX.meta[k]; });
  setMeta_('last_backup', nowStamp_());
  return { app: 'nachimban-compass', version: VERSION, at: nowStamp_(), season: CTX.season, all: !!req.all, meta: meta, tables: d };
} };
ACTIONS['backup.restore'] = { write: true, need: 'backup', fn: function (req) {
  if (str_(req.phrase) !== '백업으로 되돌리기') fail_('확인 문구를 정확히 입력하세요: 백업으로 되돌리기');
  var b = req.backup || {};
  if (b.app !== 'nachimban-compass' || !b.tables || typeof b.tables !== 'object') fail_('나침반 백업 파일이 아니에요.');
  var tables = {};
  Object.keys(b.tables).forEach(function (t) { if (TABLES[t] && Array.isArray(b.tables[t])) tables[t] = b.tables[t]; });
  if (!tables.members || !tables.members.length) fail_('백업에 멤버 명단이 없어요.');
  op_({ op: 'restore', tables: tables, all: !!b.all, season: Math.round(num_(b.season)) || CTX.season });
  if (b.meta) ['season', 'season_start', 'season_name'].forEach(function (k) { if (b.meta[k] !== undefined) setMeta_(k, b.meta[k]); });
  log_('backup.restore', '', '', b.at || '', (b.all ? '모든 시즌' : '시즌 ' + b.season) + ' 백업');
  return { tables: Object.keys(tables).length };
} };

// ---------- 데이터 점검 ----------
function dataIssues_(days) {
  var today = today_(), from = addDays_(today, -days + 1), dates = existingDates_(from, today), issues = [];
  loadDays_(dates, ['grid', 'log']);
  need_(['quests', 'warnings', 'dayoffs', qkey_('orphans', {}), qkey_('badLedger', {})]);
  var ids = {}, dup = {};
  rows_('members', 'members').forEach(function (r) { var id = str_(r.id); if (!id) return; if (ids[id]) dup[id] = true; ids[id] = true; });
  Object.keys(dup).forEach(function (id) { issues.push({ kind: 'dupMember', fix: false, text: '멤버 명단에 같은 아이디가 두 줄 이상 있어요: ' + id, where: '멤버 명단' }); });
  var orph = q_('orphans', {});
  Object.keys(orph).forEach(function (t) { if (orph[t]) issues.push({ kind: 'orphan', fix: false, text: (TABLES[t] ? TABLES[t].title : t) + '에 멤버 명단에 없는 아이디의 기록이 ' + orph[t] + '줄 있어요', where: t }); });
  var mm = mismatches_(dates);
  if (mm.length) issues.push({ kind: 'pay', fix: true, text: '미션 상태와 지급 기록이 맞지 않는 칸이 ' + mm.length + '개 있어요 (최근 ' + days + '일)', where: '미션', count: mm.length });
  var grids = {}, bad = [];
  dates.forEach(function (d) {
    rows_(dayKey_(d), 'grid').forEach(function (g) {
      var k = d + '|' + str_(g.memberId);
      if (grids[k]) issues.push({ kind: 'dupGrid', fix: false, text: monthDay_(d) + ' ' + nameOf_(str_(g.memberId)) + ': 미션 표에 같은 사람이 두 줄 있어요', where: '미션' });
      grids[k] = true;
      MISSIONS.forEach(function (mi) {
        if (mi === 'hours') { if (str_(g.hoursFinal) && !isFailWord_(g.hoursFinal) && parseMinutes_(g.hoursFinal) === null) bad.push(monthDay_(d) + ' ' + nameOf_(str_(g.memberId)) + ' 공부시간 "' + g.hoursFinal + '"'); return; }
        if (!knownStatus_(g[mi])) bad.push(monthDay_(d) + ' ' + nameOf_(str_(g.memberId)) + ' ' + mname_(mi) + ' "' + g[mi] + '"');
      });
    });
  });
  if (bad.length) issues.push({ kind: 'badStatus', fix: false, text: '알아볼 수 없는 상태 글자가 ' + bad.length + '칸 있어요 (확인 대기로 처리 중): ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ' 외' : ''), where: '미션' });
  var bl = q_('badLedger', {});
  if (bl.length) issues.push({ kind: 'badAmount', fix: false, text: '금액이 숫자가 아닌 파이 내역이 ' + bl.length + '줄 있어요 (0으로 계산 중): ' + bl.slice(0, 3).map(function (r) { return str_(r._member) + ' "' + r.amount + '"'; }).join(', '), where: '파이 내역' });
  var pr = pieRecalc_(from, today);
  if (pr.length) issues.push({ kind: 'ledger', fix: true, text: '기록된 파이와 실제 지급한 파이가 다른 곳이 ' + pr.length + '곳 있어요 (최근 ' + days + '일)', where: '파이 내역', count: pr.length, list: pr.slice(0, 50) });
  var wl = warningList_().filter(function (w) { return !member_(w.memberId); });
  if (wl.length) issues.push({ kind: 'warnOrphan', fix: false, text: '없는 멤버의 경고가 ' + wl.length + '개 있어요', where: '경고' });
  return issues;
}
ACTIONS['data.check'] = { need: 'data.check', fn: function (req) {
  var days = Math.max(7, Math.min(93, Math.round(num_(req.days)) || 60));
  var issues = dataIssues_(days);
  return { days: days, issues: issues.map(function (x) { var o = clone_(x); return o; }), ok: !issues.length };
} };
ACTIONS['data.fix'] = { write: true, need: 'data.check', fn: function (req) {
  var days = Math.max(7, Math.min(93, Math.round(num_(req.days)) || 60)), today = today_(), from = addDays_(today, -days + 1), n = 0;
  if (req.kind === 'pay' || req.kind === 'all') { var dates = existingDates_(from, today); loadDays_(dates); n += syncDays_(dates); }
  if (req.kind === 'ledger' || req.kind === 'all') { pieRecalc_(from, today).forEach(function (x) { addPie_(x.memberId, x.diff, 'fix', x.date, x.item, '데이터 점검 보정 (기록 ' + x.expected + ' / 지급 ' + x.actual + ')'); n++; }); }
  log_('data.fix', '', '', n + '건', req.kind + ' · 최근 ' + days + '일');
  return { count: n };
} };

// ---------- 오래된 기록 정리 ----------
var PRUNE_TABLES = { logs: ['at', '활동 기록'], game_plays: ['_date', '미니게임 기록'], error_log: ['at', '오류 기록'], edit_history: ['at', '직접 고친 기록 (되돌리기용)'] };
ACTIONS['data.prune'] = { write: true, need: 'backup', pre: function (req) { var p = PRUNE_TABLES[str_(req.table)]; return p ? [qkey_('olderCount', { table: str_(req.table), col: p[0], before: addDays_(today_(), -Math.max(7, Math.round(num_(req.days)) || 90)) })] : []; }, fn: function (req) {
  var p = PRUNE_TABLES[str_(req.table)];
  if (!p) fail_('정리할 수 없는 표예요.');
  var days = Math.max(7, Math.round(num_(req.days)) || 90), before = addDays_(today_(), -days);
  var n = num_(q_('olderCount', { table: str_(req.table), col: p[0], before: before }).n);
  if (!req.apply) return { count: n, before: before, title: p[1] };
  if (n) op_({ op: 'deleteOlder', table: str_(req.table), col: p[0], before: before, allSeasons: true });
  log_('data.prune', '', '', p[1] + ' ' + n + '줄', before + ' 이전 (' + days + '일 지난 기록)');
  return { count: n, before: before, title: p[1] };
} };

// ================================================================
// 14. 요청 처리
//   1) 필요한 표를 읽고  2) 기능을 실행하고  3) 바뀐 내용을 한꺼번에 저장해요.
//   기록을 바꾸는 요청은 차례 잠금 안에서 처리해서, 동시에 눌러도 꼬이지 않아요.
// ================================================================
var BASE_KEYS = ['members', 'settings'];
var MAX_ROUNDS = 16;

function randomSecret_() {
  var s = '';
  try {
    var a = new Uint8Array(32);
    (typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto : null).getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
  } catch (e) { s = sha256_(Math.random() + '|' + (CLOCK_ ? CLOCK_() : Date.now()) + '|' + Math.random()) + sha256_(String(Math.random())); }
  return s;
}
async function loadKeys_(db, exec, base, keys) {
  var miss = keys.filter(function (k) { return k.indexOf('q:') === 0 ? !(k in base.qcache) : !(k in base.cache); });
  if (!miss.length) return;
  var got = await db.load(exec, base.season, miss);
  miss.forEach(function (k) { if (k.indexOf('q:') === 0) base.qcache[k] = got[k]; else base.cache[k] = got[k] || []; });
}
/** 기능 하나 실행 (inTx: 잠금 안에서 실행 중인지) */
async function runAction_(db, exec, a, req, inTx) {
  var base = { cache: {}, qcache: {}, meta: {}, now: (CLOCK_ ? CLOCK_() : Date.now()), inTx: inTx, req: req, season: 1 };
  CTX = newCtx_(base);
  var pre = BASE_KEYS.concat(a.books || []);
  // 개발자 전용 기능은 미리 읽지 않아요 (로그인 확인 전에 무거운 표를 읽지 않도록)
  var devOnly = a.need && ACCESS[a.need] && ACCESS[a.need][0] >= 4;
  try { if (a.pre && !devOnly) pre = pre.concat(a.pre(req, tokenId_(req.token)) || []); } catch (e) { /* 미리 읽기 힌트는 틀려도 괜찮아요 */ }
  pre = expandKeys_(pre);
  // 설정(meta)과 미리 읽을 표를 한 번에
  var first = await db.load(exec, null, pre);
  base.meta = first.__meta || {}; base.season = first.__season || 1;
  var meta = base.meta;
  pre.forEach(function (k) { if (k.indexOf('q:') === 0) base.qcache[k] = first[k]; else base.cache[k] = first[k] || []; });
  for (var round = 0; round < MAX_ROUNDS; round++) {
    CTX = newCtx_(base);
    try {
      settings_();
      if (a.auth !== false) CTX.me = auth_(req.token);
      if (meta.maintenance && a.auth !== false && !CTX.viewer && rankOf_(CTX.me) < accessRank_('maintenance')) fail_(meta.maintenance, 'MAINT');
      if (CTX.viewOnly && a.write) fail_('멤버 화면으로 보는 중이라 바꿀 수 없어요. 내 화면으로 돌아가서 해 주세요.', 'VIEW');
      if (a.need) needAccess_(a.need);
      if (a.write && !inTx) return { needTx: true };
      var data = a.fn(req, CTX.me);
      var ops = collectChanges_();
      if (CTX.viewOnly) ops = [];
      if (ops.length && !inTx) return { needTx: true };
      if (ops.length) await db.apply(exec, CTX.season, ops);
      return { data: data === undefined ? null : data, wrote: ops.length > 0 };
    } catch (e) {
      if (e && e.needLoad) { await loadKeys_(db, exec, base, e.needLoad); continue; }
      throw e;
    }
  }
  throw new Error('필요한 표를 읽는 단계가 너무 많아요.');
}
/** 처음 설치: 시즌 1 · 기본 설정 · 개발자 계정을 만듭니다 */
async function ensureInit_(db) {
  if (db._initDone) return;
  var meta = await db.getMeta(db.exec);
  if (meta.season && meta.token_secret) { db._initDone = true; return; }
  await db.tx(async function (exec) {
    var m2 = await db.getMeta(exec);
    if (m2.season && m2.token_secret) return;
    var base = { cache: {}, qcache: {}, meta: m2, now: (CLOCK_ ? CLOCK_() : Date.now()), inTx: true, season: Math.max(1, Math.round(num_(m2.season)) || 1) };
    await loadKeys_(db, exec, base, expandKeys_(BASE_KEYS));
    CTX = newCtx_(base);
    if (!m2.token_secret) setMeta_('token_secret', randomSecret_());
    if (!m2.season) {
      writeAllSettings_(defaultSettingsObj_());
      if (!rows_('members', 'members').length) insert_('members', 'members', { id: INIT_DEV.id, name: INIT_DEV.name, password: INIT_DEV.password, ops: '개발자', mentor: '', mentee: '', insta: '', memo: '', status: '활동', joinedAt: nowStamp_(), session: '' });
      setMeta_('season', CTX.season); setMeta_('season_start', today_()); setMeta_('season_name', '');
      log_('season.start', '', '', '시즌 ' + CTX.season, '처음 설치');
    }
    await db.apply(exec, CTX.season, collectChanges_());
  });
}
/** 한 사람이 짧은 시간에 너무 많이 부르면 잠깐 막아요 (서버 한 대 안에서만 세요) */
var RATE_ = { map: {}, limit: 90, windowMs: 60000 };
function rateLimited_(key, limit) {
  if (!key) return false;
  var now = (CLOCK_ ? CLOCK_() : Date.now()), r = RATE_.map[key];
  if (!r || now - r.t > RATE_.windowMs) r = RATE_.map[key] = { t: now, n: 0 };
  r.n++;
  if (Object.keys(RATE_.map).length > 5000) RATE_.map = {};
  return r.n > (limit || RATE_.limit);
}
/** 속도 점검용: 이 서버(함수 한 대)가 받은 요청 수. 0이면 막 켜진 상태(첫 구동) */
var BOOT_ = { n: 0 };
/** 속도 점검용: 데이터베이스 질의 수와 걸린 시간을 세는 실행기 (동작은 그대로) */
function statExec_(exec, st) {
  return async function (text, params) {
    st.q++;
    var t1 = (CLOCK_ ? CLOCK_() : Date.now());
    try { return await exec(text, params); } finally { st.db += (CLOCK_ ? CLOCK_() : Date.now()) - t1; }
  };
}
/** 요청 하나 처리 → { ok, data, t } 또는 { ok:false, error, code, t }
 *  t = { ms: 서버 안에서 걸린 시간, q: 데이터베이스 질의 수, db: 그중 데이터베이스 시간, cold: 막 켜진 서버였는지 } */
async function handleRequest_(db, body) {
  var t0 = (CLOCK_ ? CLOCK_() : Date.now()), req = {}, res, isErr = false, st = { q: 0, db: 0 }, cold = BOOT_.n++ === 0;
  try {
    req = typeof body === 'string' ? JSON.parse(body || '{}') : (body || {});
    var a = ACTIONS[req.action];
    if (!a) fail_('알 수 없는 기능이에요: ' + req.action);
    var who = tokenId_(req.token);
    if (who ? rateLimited_(who) : (a.auth === false && rateLimited_('guest:' + req.action, RATE_.limit * 8))) fail_('요청이 너무 많아요. 1분쯤 뒤에 다시 시도해 주세요.', 'BUSY');
    await db.ready();
    await ensureInit_(db);
    // 기록을 바꾸는 기능은 처음부터 차례 잠금 안에서, 읽기만 하는 기능은 잠금 없이 (고칠 게 생기면 잠금 안에서 다시)
    var r = a.write ? { needTx: true } : await runAction_(db, statExec_(db.exec, st), a, req, false);
    if (r.needTx) r = await db.tx(function (exec) { return runAction_(db, statExec_(exec, st), a, req, true); });
    res = { ok: true, data: r.data };
  } catch (ex) {
    isErr = !ex || !ex.userMsg;
    if (isErr) {
      try { console.error(ex && ex.stack ? ex.stack : ex); } catch (e2) {}
      try { await db.logError({ at: stamp_((CLOCK_ ? CLOCK_() : Date.now())), action: String(req.action || ''), actor: tokenId_(req.token), message: String(ex && ex.message ? ex.message : ex) }); } catch (e3) {}
    }
    res = { ok: false, error: ex && ex.userMsg ? ex.userMsg : ('처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요. (' + (ex && ex.message ? ex.message : ex) + ')'), code: (ex && ex.code) || 'ERR' };
  } finally {
    CTX = null;
  }
  var ms = (CLOCK_ ? CLOCK_() : Date.now()) - t0;
  res.t = { ms: ms, q: st.q, db: Math.min(st.db, ms), cold: cold };  // 질의가 동시에 돌면 합이 커질 수 있어서 서버 시간을 넘지 않게
  try { await db.count(ymd_((CLOCK_ ? CLOCK_() : Date.now())), ms, isErr); } catch (e4) {}
  return res;
}

// ================================================================
// 저장소: 메모리 (체험판 · 테스트용). Postgres 저장소와 똑같이 동작하도록 맞춰 둔 것
// ================================================================
function MemStore(state, onSave) {
  this.s = state || {};
  this.s.tables = this.s.tables || {};
  this.s.meta = this.s.meta || {};
  this.s.usage = this.s.usage || {};
  this.s.seq = this.s.seq || {};
  this.onSave = onSave || null;
  this._chain = Promise.resolve();
  this.exec = function () { return Promise.resolve([]); };
}
MemStore.prototype.ready = function () {
  for (var t in TABLES) if (!this.s.tables[t]) this.s.tables[t] = [];
  return Promise.resolve();
};
MemStore.prototype.save = function () { if (this.onSave) this.onSave(this.s); };
MemStore.prototype.tx = function (fn) {
  var self = this;
  var run = this._chain.then(async function () {
    var snap = JSON.stringify(self.s);
    try { var r = await fn(self.exec); self.save(); return r; }
    catch (e) { var back = JSON.parse(snap); self.s.tables = back.tables; self.s.meta = back.meta; self.s.usage = back.usage; self.s.seq = back.seq; throw e; }
  });
  this._chain = run.catch(function () {});
  return run;
};
MemStore.prototype.getMeta = function () { return Promise.resolve(JSON.parse(JSON.stringify(this.s.meta))); };
MemStore.prototype.count = function (day, ms, isErr) {
  var u = this.s.usage[day] = this.s.usage[day] || { requests: 0, errors: 0, ms: 0 };
  u.requests++; if (isErr) u.errors++; u.ms += Math.max(0, Math.round(ms));
  this.save();
  return Promise.resolve();
};
MemStore.prototype.logError = function (row) {
  var t = this.s.tables.error_log;
  t.push(this.newRow_('error_log', { at: row.at, action: row.action, actor: row.actor, message: String(row.message).slice(0, 2000) }, 1));
  if (t.length > 500) t.splice(0, t.length - 500);
  this.save();
  return Promise.resolve();
};
MemStore.prototype.nextId_ = function (t) { this.s.seq[t] = (this.s.seq[t] || 0) + 1; return String(this.s.seq[t]); };
MemStore.prototype.newRow_ = function (t, src, season) {
  var d = TABLES[t], sc = d.scope ? SCOPE_COLS[d.scope] : null, r = { _id: src._id ? String(src._id) : this.nextId_(t), _season: Number(src._season !== undefined && src._season !== '' ? src._season : season) };
  if (src._id && Number(src._id) > (this.s.seq[t] || 0)) this.s.seq[t] = Number(src._id);
  if (sc) r[sc] = src[sc] === undefined || src[sc] === null ? '' : String(src[sc]);
  d.cols.forEach(function (c) { r[c[0]] = src[c[0]] === undefined || src[c[0]] === null ? '' : String(src[c[0]]); });
  return r;
};
function memCopy_(rows) { return rows.map(function (r) { return Object.assign({}, r); }); }
MemStore.prototype.load = async function (exec, season, keys) {
  var out = {}, self = this, withMeta = season === null || season === undefined;
  if (withMeta) { season = Math.max(1, Math.round(num_(this.s.meta.season)) || 1); out.__meta = JSON.parse(JSON.stringify(this.s.meta)); out.__season = season; }
  keys.forEach(function (k) {
    if (k.indexOf('q:') === 0) {
      var rest = k.slice(2), i = rest.indexOf(':'), name = rest.slice(0, i), args = JSON.parse(rest.slice(i + 1));
      if (!MEM_QUERIES[name]) throw new Error('알 수 없는 조회: ' + name);
      out[k] = JSON.parse(JSON.stringify(MEM_QUERIES[name].call(self, season, args)));
      return;
    }
    var sp = tabSpec_(k);
    out[k] = memCopy_(self.s.tables[sp.table].filter(function (r) { return r._season === season && (!sp.scopeCol || r[sp.scopeCol] === sp.scopeVal); }));
  });
  return out;
};
function memSeason_(rows, season) { return rows.filter(function (r) { return r._season === season; }); }
function memByAtDesc_(a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : Number(b._id) - Number(a._id); }
var MEM_QUERIES = {
  bal: function (season, a) { var s = 0; memSeason_(this.s.tables.ledger, season).forEach(function (r) { if (r._member === String(a.member || '')) s += num_(r.amount); }); return { sum: s }; },
  balances: function (season) {
    var o = {};
    memSeason_(this.s.tables.ledger, season).forEach(function (r) { var x = o[r._member] = o[r._member] || { sum: 0, last: '' }; x.sum += num_(r.amount); if (r.at > x.last) x.last = r.at; });
    return o;
  },
  maxid: function (season, a) { var m = 0; memSeason_(this.s.tables[a.table], season).forEach(function (r) { var n = num_(r.id); if (n > m) m = n; }); return { max: m }; },
  posts: function (season, a) {
    var lim = Math.max(1, Math.min(200, Number(a.limit) || 30));
    var rows = memSeason_(this.s.tables.posts, season).filter(function (p) { return str_(p.text) && !yes_(p.deleted) && (a.hidden || !yes_(p.hidden)) && (!a.before || num_(p.id) < num_(a.before)); });
    rows.sort(function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : (num_(y.id) - num_(x.id)) || (Number(y._id) - Number(x._id)); });
    return { rows: memCopy_(rows.slice(0, lim)), more: rows.length > lim };
  },
  post: function (season, a) { return { rows: memCopy_(memSeason_(this.s.tables.posts, season).filter(function (p) { return p.id === String(a.id); }).slice(0, 1)) }; },
  reactions: function (season, a) { var ids = (a.postIds || []).map(String); return { rows: memCopy_(memSeason_(this.s.tables.reactions, season).filter(function (r) { return ids.indexOf(r.postId) >= 0; })) }; },
  ledger: function (season, a) {
    var to = a.to ? addDays_(a.to, 1) : null;
    var rows = memSeason_(this.s.tables.ledger, season).filter(function (r) {
      return (!a.member || r._member === a.member) && (!a.type || r.type === a.type) && (!a.from || r.at >= a.from) && (!to || r.at < to);
    });
    var sum = 0; rows.forEach(function (r) { sum += num_(r.amount); });
    rows.sort(memByAtDesc_);
    return { rows: memCopy_(rows.slice(0, Math.max(1, Math.min(1000, Number(a.limit) || 300)))), total: rows.length, sum: sum };
  },
  memberGrid: function (season, a) { return memCopy_(memSeason_(this.s.tables.missions, season).filter(function (r) { return r.memberId === String(a.member) && r._date >= a.from && r._date <= a.to; })); },
  ledgerRange: function (season, a) { return memCopy_(memSeason_(this.s.tables.ledger, season).filter(function (r) { return r.refDate >= a.from && r.refDate <= a.to; })); },
  logs: function (season, a) {
    var to = a.to ? addDays_(a.to, 1) : null, all = memSeason_(this.s.tables.logs, season);
    var rows = all.filter(function (r) { return (!a.from || r.at >= a.from) && (!to || r.at < to) && (!a.actor || r.actor === a.actor) && (!a.target || r.target === a.target) && (!a.act || r.action === a.act); });
    rows.sort(memByAtDesc_);
    var acts = {}; all.forEach(function (r) { if (r.action) acts[r.action] = true; });
    return { rows: memCopy_(rows.slice(0, Math.max(1, Math.min(1000, Number(a.limit) || 300)))), total: rows.length, actions: Object.keys(acts).sort() };
  },
  size: function () {
    var self = this, total = 0, tables = Object.keys(TABLES).map(function (t) { var b = JSON.stringify(self.s.tables[t]).length * 2; total += b; return { table: t, title: TABLES[t].title, bytes: b, rows: self.s.tables[t].length }; });
    tables.sort(function (a, b) { return b.bytes - a.bytes; });
    return { schemaBytes: total, dbBytes: total + 8 * 1048576, tables: tables };
  },
  usage: function (season, a) {
    var u = this.s.usage, days = Object.keys(u).sort().slice(-Math.max(1, Number(a.days) || 30));
    return days.map(function (d) { return { day: d, requests: u[d].requests, errors: u[d].errors, ms: u[d].ms }; });
  },
  errors: function (season, a) { return memCopy_(this.s.tables.error_log.slice().reverse().slice(0, Number(a.limit) || 200)); },
  rowsById: function (season, a) { var ids = (a.ids || []).map(String); return memCopy_(this.s.tables[a.table].filter(function (r) { return ids.indexOf(r._id) >= 0; })); },
  nextIds: function (season, a) { var out = []; for (var i = 0; i < (Number(a.n) || 1); i++) out.push(this.nextId_(a.table)); return out; },
  tableCounts: function (season) { var o = {}, s = this.s; Object.keys(TABLES).forEach(function (t) { o[t] = memSeason_(s.tables[t], season).length; }); return o; },
  seasons: function () { var o = {}; ['members', 'settings', 'ledger'].forEach(function (t) { this.s.tables[t].forEach(function (r) { o[r._season] = true; }); }, this); return Object.keys(o).map(Number); },
  dataRows: function (season, a) {
    var d = TABLES[a.table], cols = d.cols.map(function (c) { return c[0]; }).concat(d.scope ? [SCOPE_COLS[d.scope]] : []);
    var rows = this.s.tables[a.table].filter(function (r) {
      if (a.season !== 'all' && r._season !== (Number(a.season) || season)) return false;
      if (a.search) { var s = cols.map(function (c) { return r[c]; }).join(' ').toLowerCase(); if (s.indexOf(String(a.search).toLowerCase()) < 0) return false; }
      return Object.keys(a.filters || {}).every(function (c) {
        if (c === '_id' || c === '_season') return String(r[c]) === String(a.filters[c]);
        return String(r[c] === undefined ? '' : r[c]).toLowerCase().indexOf(String(a.filters[c]).toLowerCase()) >= 0;
      });
    });
    if (a.sort) {
      var num = a.sort === '_id' || a.sort === '_season' || NUMERIC_COLS_MEM.indexOf(a.sort) >= 0;
      rows.sort(function (x, y) { var p = num ? num_(x[a.sort]) - num_(y[a.sort]) : (x[a.sort] < y[a.sort] ? -1 : x[a.sort] > y[a.sort] ? 1 : 0); return (a.desc ? -p : p) || (a.desc ? Number(y._id) - Number(x._id) : Number(x._id) - Number(y._id)); });
    } else rows.sort(function (x, y) { return Number(x._id) - Number(y._id); });
    var off = Math.max(0, Number(a.offset) || 0), lim = Math.max(1, Math.min(100000, Number(a.limit) || 100));
    return { rows: memCopy_(rows.slice(off, off + lim)), total: rows.length };
  },
  history: function (season, a) { return memCopy_(this.s.tables.edit_history.slice().reverse().slice(0, Number(a.limit) || 600)); },
  historyBatch: function (season, a) { return memCopy_(this.s.tables.edit_history.filter(function (r) { return r.batch === String(a.batch); })); },
  dump: function (season, a) { var o = {}, s = this.s; Object.keys(TABLES).forEach(function (t) { o[t] = memCopy_(a.all ? s.tables[t] : memSeason_(s.tables[t], season)); }); return o; },
  orphans: function (season) {
    var ids = {}, s = this.s, o = {};
    memSeason_(s.tables.members, season).forEach(function (m) { ids[m.id] = true; });
    MEMBER_REF_COLS.forEach(function (x) { var n = memSeason_(s.tables[x[0]], season).filter(function (r) { return r[x[1]] && !ids[r[x[1]]]; }).length; if (n) o[x[0]] = n; });
    return o;
  },
  olderCount: function (season, a) { return { n: this.s.tables[a.table].filter(function (r) { return r[a.col] && r[a.col] < a.before; }).length }; },
  badLedger: function (season) { return memCopy_(memSeason_(this.s.tables.ledger, season).filter(function (r) { return !isNumText_(r.amount); }).slice(0, 50)); }
};
var NUMERIC_COLS_MEM = ['amount', 'pie', 'price', 'total', 'n', 'round', 'order', 'id', 'stock', 'limitN', 'rank', 'rankBonus', 'postId', 'productId', 'rowId',
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'attend', 'study', 'problem', 'mentoring', 'daily', 'bAttend', 'bStudy', 'bProblem', 'bMentoring', 'bDaily'];

MemStore.prototype.apply = async function (exec, season, ops) {
  for (var i = 0; i < ops.length; i++) this.applyOne(season, ops[i]);
};
MemStore.prototype.applyOne = function (season, o) {
  var self = this, s = this.s;
  if (o.op === 'meta') { Object.keys(o.set).forEach(function (k) { if (o.set[k] === null) delete s.meta[k]; else s.meta[k] = String(o.set[k]); }); return; }
  if (o.op === 'renameMember') {
    MEMBER_REF_COLS.forEach(function (x) { s.tables[x[0]].forEach(function (r) { if (r[x[1]] === o.from) r[x[1]] = o.to; }); });
    s.tables.members.forEach(function (r) { if (r.id === o.from) { r.id = o.to; r.session = ''; } });
    var suf = '(' + o.from + ')', nsuf = '(' + o.to + ')';
    WHO_COLS.forEach(function (x) { s.tables[x[0]].forEach(function (r) { var v = r[x[1]]; if (v && v.length >= suf.length && v.slice(-suf.length) === suf) r[x[1]] = v.slice(0, v.length - suf.length) + nsuf; }); });
    s.tables.game_plays.forEach(function (r) { if (r.id.indexOf('-' + o.from + '-') >= 0) r.id = r.id.split('-' + o.from + '-').join('-' + o.to + '-'); });
    return;
  }
  if (o.op === 'mergeMember') {
    var nm = (s.tables.members.filter(function (m) { return m._season === season && m.id === o.into; })[0] || {}).name || o.into;
    [['missions', ['_date']], ['mission_pay', ['_date', 'mission']], ['weekly_done', ['week']], ['settle_rows', ['_week']], ['reactions', ['postId', 'kind']]].forEach(function (u) {
      var t = s.tables[u[0]], have = {};
      t.forEach(function (r) { if (r._season === season && r.memberId === o.into) have[u[1].map(function (k) { return r[k]; }).join('|')] = true; });
      s.tables[u[0]] = t.filter(function (r) { return !(r._season === season && r.memberId === o.from && have[u[1].map(function (k) { return r[k]; }).join('|')]); });
    });
    MEMBER_REF_COLS.forEach(function (x) {
      var hasName = TABLES[x[0]].cols.some(function (c) { return c[0] === 'name'; });
      s.tables[x[0]].forEach(function (r) { if (r._season === season && r[x[1]] === o.from) { r[x[1]] = o.into; if (hasName) r.name = nm; } });
    });
    s.tables.members = s.tables.members.filter(function (m) { return !(m._season === season && m.id === o.from); });
    return;
  }
  if (o.op === 'restore') {
    Object.keys(TABLES).forEach(function (t) { s.tables[t] = o.all ? [] : s.tables[t].filter(function (r) { return r._season !== o.season; }); });
    Object.keys(o.tables).forEach(function (t) {
      o.tables[t].forEach(function (r) { var x = {}; Object.keys(r).forEach(function (k) { if (k !== '_id') x[k] = r[k]; }); if (!o.all) x._season = o.season; s.tables[t].push(self.newRow_(t, x, o.season)); });
    });
    return;
  }
  var d = TABLES[o.table], sc = d.scope ? SCOPE_COLS[d.scope] : null, T = s.tables[o.table];
  if (o.op === 'insert') {
    (o.rows || []).forEach(function (r) {
      var src = Object.assign({}, r);
      if (src._season === undefined || src._season === '') src._season = o.season || season;
      if (sc && (src[sc] === undefined || src[sc] === '') && o.scope) src[sc] = o.scope.val;
      if (src._id && T.some(function (x) { return x._id === String(src._id); })) throw new Error('같은 줄 번호가 이미 있어요: ' + src._id);
      T.push(self.newRow_(o.table, src, season));
    });
    return;
  }
  if (o.op === 'update') {
    var by = {}; T.forEach(function (r) { by[r._id] = r; });
    (o.rows || []).forEach(function (r) { var x = by[String(r._id)]; if (x) d.cols.forEach(function (c) { x[c[0]] = r[c[0]] === undefined || r[c[0]] === null ? '' : String(r[c[0]]); }); });
    return;
  }
  if (o.op === 'delete') { var ids = (o.ids || []).map(String); s.tables[o.table] = T.filter(function (r) { return ids.indexOf(r._id) < 0; }); return; }
  if (o.op === 'deleteScope') { var ss = o.season || season; s.tables[o.table] = T.filter(function (r) { return !(r._season === ss && (!o.scope || !sc || r[sc] === String(o.scope.val))); }); return; }
  if (o.op === 'deleteWhere') {
    if (!(o.where || []).length) throw new Error('조건 없는 삭제는 할 수 없어요');
    var sw = o.season || season;
    s.tables[o.table] = T.filter(function (r) { return !((o.allSeasons || r._season === sw) && o.where.every(function (x) { return String(r[x[0]]) === String(x[1]); })); });
    return;
  }
  if (o.op === 'deleteOlder') { s.tables[o.table] = T.filter(function (r) { return !(r[o.col] && r[o.col] < String(o.before)); }); return; }
  if (o.op === 'set') {
    var row = T.filter(function (r) { return r._id === String(o.id); })[0];
    if (!row) return;
    Object.keys(o.set || {}).forEach(function (c) {
      if (c === '_id' || (c !== '_season' && c !== sc && !d.cols.some(function (x) { return x[0] === c; }))) throw new Error('고칠 수 없는 칸: ' + c);
      row[c] = c === '_season' ? Number(o.set[c]) : String(o.set[c] === null || o.set[c] === undefined ? '' : o.set[c]);
    });
    return;
  }
  throw new Error('알 수 없는 저장 작업: ' + o.op);
};

// ================================================================
// 체험판: 브라우저 안에서 서버를 그대로 돌려요 (저장은 이 브라우저에만)
// ================================================================
var DEMO_KEY = 'nc_demo_v16';
function demoLoad_() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { return null; } }
function demoSave_(s) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) {} }
RATE_.limit = 1e9;   // 체험판은 한 브라우저 안이라 막지 않아요
var DEMO_STORE = new MemStore(demoLoad_() || {}, demoSave_);
window.NC_SERVER = {
  handle: function (body) { return handleRequest_(DEMO_STORE, body); },
  isEmpty: function () { return !DEMO_STORE.s.meta.season; },
  reset: function () { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} DEMO_STORE = new MemStore({}, demoSave_); },
  /** 예시 데이터를 만들 때 시계를 잠깐 바꿔요 (fn: () => ms, 없애려면 null) */
  setClock: function (fn) { CLOCK_ = fn; },
  store: function () { return DEMO_STORE; }
};

})();
