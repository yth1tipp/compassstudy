/*
 * 나침반 스터디그룹 — 사이트 설정
 *
 * API_URL: Supabase 에 만든 서버 함수 주소를 넣으세요.
 *          예) 'https://abcdefghijkl.supabase.co/functions/v1/compass'
 *          비워 두면 '체험판'으로 동작해요. (이 기기 브라우저에만 저장되는 예시 데이터)
 * API_KEY: 보통은 비워 둡니다. 서버 함수의 'JWT 확인'을 끌 수 없을 때만 Supabase 의 anon(공개) 키를 넣으세요.
 */
window.NC_CONFIG = {
  API_URL: 'https://kbvqtnxeqkzlkaynjhpt.supabase.co/functions/v1/compass?forceFunctionRegion=ap-northeast-1',
  API_KEY: '',
  GROUP_NAME: '나침반'
};
