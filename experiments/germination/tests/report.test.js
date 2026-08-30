/**
 * 보고서 테스트.
 *
 * 종이에 무엇이 실리는가와, **이름이 어디로 가지 않는가**를 본다.
 * 뒤쪽이 더 중요하다 — 개인정보가 상태나 저장소로 새면 화면 어디서도 티가 안 나고,
 * 티가 안 나는 채로 계속 쌓인다 (AGENTS.md §6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { buildSheet } from '../src/ui/report.js';
import { UI } from '../src/ui/strings.js';

/** 몇 가지를 적어 둔 상태 하나 */
function filled() {
  let st = initialState(2);
  const put = (step, text) => { st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text } }).state; };
  put('predict.sprout', '이산화 탄소가 늘고 온도가 오른다');
  put('predict.why.sprout', '싹이 나려면 힘이 필요할 테니까');
  // 기록칸이 있는 자리에 적는다. `1a`(콩 넣기)는 준비 동작이라 칸이 없다 —
  // 있는 것은 `1c`(두 챔버의 숟갈 수 맞추기)다 (`UI.protocol` 의 `note`).
  put('1c', '양쪽 다 두 숟갈로 맞췄다');
  put('selfeval.process', '4');
  put('feedback.learned', '마른 콩도 아주 조금은 숨을 쉰다');
  return st;
}

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' });
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('이산화 탄소가 늘고 온도가 오른다'), '예상이 종이에 없습니다');
  assert.ok(html.includes('싹이 나려면 힘이 필요할 테니까'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('양쪽 다 두 숟갈로'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('마른 콩도 아주 조금은 숨을 쉰다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  const html = buildSheet(initialState(1), {});
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');
  // **적을 칸을 준 자리는** 하나도 안 적었어도 전부 실린다.
  // 「전부」가 세부 단계 열다섯이 아니라 **기록칸 일곱**이라는 것은
  // tests/notebook-steps.test.js 가 화면과 맞대어 못 박는다.
  //
  // **절을 잘라서 `equal` 로 센다.** 종이 전체에서 세면 아무것도 못 잡는다 —
  // 여기 종이는 전체 빈칸이 22개인데 탐구 과정 절은 7개라, 그 일곱이 통째로 사라져도
  // 「15 >= 7」 로 초록불이 난다. 다른 절의 빈칸이 수를 채워 주기 때문이다.
  // (바나나랩에서 재 보니 세부 단계 20칸 · 종이 전체 35개 · 탐구 과정 절 20개였고,
  //  fermentation 은 그 때문에 실제로 다섯 칸을 놓쳤다)
  const boxes = UI.protocol.reduce((n, g) => n + g.steps.filter((s) => s.note).length, 0);
  const from = html.indexOf(UI.report.sections.process);
  const section = html.slice(from, html.indexOf('</section>', from));
  const shown = (section.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  assert.equal(shown, boxes, `탐구 과정 절의 빈칸이 ${shown}개인데 기록칸은 ${boxes}개입니다`);
});

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  // 이 글은 학생 자기 화면에만 들어가지만, 보고서로 인쇄돼 남에게 건네진다.
  // 따옴표까지 막지 않으면 속성 안에 들어갈 때 새 속성을 붙일 수 있다 (5단계 배율 칸).
  let st = initialState(1);
  const payload = `<img src=x onerror=alert(1)>" onfocus="alert(2)`;
  for (const step of ['q2', 'read.0', 'predict.sprout', '1c', 'feedback.learned']) {
    st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text: payload } }).state;
  }
  const html = buildSheet(st, { name: payload });
  // "onerror=alert" 라는 **글자**는 남는다 — 그게 학생이 쓴 내용이고, 글자로 보이는 것이 맞다.
  // 봐야 할 것은 그것이 태그나 속성으로 **해석되는가** 다.
  assert.ok(!html.includes('<img src=x'), '학생이 쓴 태그가 그대로 들어갔습니다');
  assert.ok(!html.includes('" onfocus='), '따옴표로 속성을 빠져나갈 수 있습니다');
  assert.ok(html.includes('&lt;img'), '글자로는 남아 있어야 합니다');
  assert.ok(html.includes('&quot;'), '따옴표가 인코딩되지 않았습니다');
});

/**
 * 「보고서가 개인정보를 상태에도 저장소에도 보내지 않는다」는 **`tests/privacy.test.js` 로
 * 옮겼다.** 여기 두면 보고서를 치우는 날 그 검사가 **함께 꺼진다** — 초록불은 그대로라
 * 아무 데도 안 나온다. 실제로 T01 에서 그럴 뻔했다.
 */

test('모둠 활동지에는 모둠 이름이 실린다', () => {
  // `head()` 가 `R.fields` 만 돌면 모둠 칸(`R.groupFields` 의 team)이 종이에서 빠진다.
  // 모둠으로 낸 종이에 모둠 이름이 없으면 **누가 낸 것인지 종이만 보고 알 수 없다** —
  // 이름은 개인 것이고, 모둠 활동지에서 묶는 단위는 모둠이다.
  const html = buildSheet(filled(), { name: '홍길동', team: '3모둠' }, 'group');
  assert.ok(html.includes('3모둠'), '모둠 이름이 종이에 없습니다');
  const label = UI.report.groupFields[0].label;
  assert.ok(html.includes(label), `모둠 칸의 이름표(${label})가 종이에 없습니다`);
});

test('개별 활동지에는 모둠 칸이 아예 안 나온다', () => {
  // 빈 칸으로 남기지 않는다 — 빈칸은 「안 한 일」 처럼 보인다 (`R.kinds` 의 뜻).
  const html = buildSheet(filled(), { name: '홍길동' }, 'solo');
  assert.ok(!html.includes(UI.report.groupFields[0].label),
    '개별 활동지에 모둠 칸이 나옵니다');
});
