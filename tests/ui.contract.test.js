/**
 * UI 계약 테스트.
 *
 * 화면을 띄우지 않고도 확실히 판정되는 것만 검사한다.
 * 눈으로 봐야 아는 것(배치가 예쁜가, 크기 감각이 맞는가)은 여기 넣지 않는다 —
 * 애매한 검사가 한 번 헛발질하면 그 뒤로 아무도 `npm run check` 를 믿지 않는다.
 *
 * 여기 없는 항목은 사람이 본다: tasks/T04-interaction-ui.md 의 합격 기준.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { observability } from '../src/sim/quality.js';
import { initialState, UNDO_LIMITS } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

const UI_DIR = new URL('../src/ui/', import.meta.url);

/** src/ui/ 안의 .js 파일을 전부 읽어 [이름, 내용] 으로 돌려준다 */
function uiSources() {
  const dir = new URL('.', UI_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => [f, readFileSync(new URL(f, UI_DIR), 'utf8')]);
}

/* ---------------- 문자열 표가 상태를 전부 덮는가 ---------------- */

test('observability 가 돌려주는 worst 는 모두 사람이 읽는 말이 있다', () => {
  // 하나라도 빠지면 화면에 undefined 가 뜬다. quality.js 에 항목을 추가하고
  // strings.js 를 잊는 것이 흔한 실수라 기계가 지킨다.
  const { factors } = observability({});
  for (const key of Object.keys(factors)) {
    assert.equal(typeof UI.observability.worst[key], 'string',
      `UI.observability.worst.${key} 가 없습니다 — 게이지에 undefined 가 뜹니다`);
  }
});

test('실제로 나올 수 있는 worst 값이 모두 문자열 표에 있다', () => {
  // 항목마다 그 항목만 최악이 되는 상태를 만들어 worst 를 실제로 뽑아 본다.
  // 방울 수는 **시약을 쓴 슬라이드**에서만 깎인다 — 대조군은 안 넣는 것이 맞는 절차다.
  const cases = [
    { reagent: 'IKI', coverage: 0, excess: 0 },
    { focusErr: 2, objective: 40 },
    { brightness: 0 },
    { tooThick: true },
    { bubbles: 6 },
    { objective: 4 },
    { lensTouched: true },
  ];
  for (const c of cases) {
    const { worst } = observability(c);
    assert.equal(typeof UI.observability.worst[worst], 'string',
      `worst='${worst}' 에 해당하는 문자열이 없습니다`);
  }
  // 아무것도 안 깎였으면 worst 는 없다. 그때 쓸 문구가 따로 있어야 한다 —
  // 없으면 게이지가 "지금 가장 크게 깎이는 항목: undefined" 를 띄운다.
  {
    const perfect = observability({ reagent: 'IKI', coverage: 1, excess: 0, focusErr: 0, brightness: 1, objective: 40 });
    assert.equal(perfect.worst, null, '완벽한데도 깎인 항목을 지어내면 안 된다');
    assert.equal(typeof UI.observability.allGood, 'string');
  }
});

/* ---------------- 되돌리기 표시 ---------------- */

test('되돌리기 횟수가 무제한일 때 쓸 표기가 있다', () => {
  // 1단계 undosLeft 는 Infinity 라, 그대로 그리면 "Infinity회 남음" 이 나온다.
  assert.equal(UNDO_LIMITS[1], Infinity, '1단계는 무제한이어야 합니다');
  assert.equal(initialState(1).session.undosLeft, Infinity);
  assert.ok(UI.undo && typeof UI.undo.unlimited === 'string',
    'UI.undo.unlimited 이 필요합니다 — 화면에 Infinity 가 뜨지 않게 하기 위함입니다');
  assert.ok(!/Infinity/.test(UI.undo.unlimited));
});

/* ---------------- 설계 원칙 회귀 테스트 ---------------- */

test('UI 는 포인터 이벤트만 쓴다 — 마우스/터치 전용 이벤트 금지', () => {
  // 태블릿 대응. mouse* 와 touch* 를 섞으면 한쪽에서만 동작하는 조작이 생긴다.
  const banned = /\b(mousedown|mousemove|mouseup|touchstart|touchmove|touchend)\b/;
  for (const [name, src] of uiSources()) {
    const hit = src.match(banned);
    assert.equal(hit, null,
      `src/ui/${name} 에 ${hit?.[0]} 이 있습니다 — pointerdown/pointermove/pointerup 을 쓰세요`);
  }
});

test('UI 는 버튼을 disabled 로 막지 않는다', () => {
  // 이 프로젝트는 잘못된 조작을 막지 않는다. 누를 수 있어야 하고,
  // 누른 결과가 시야에 나타나는 것이 설계다. AGENTS.md 2.1 참조.
  for (const [name, src] of uiSources()) {
    assert.equal(/\bdisabled\b/.test(src), false,
      `src/ui/${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md 2.1)`);
  }
  if (existsSync(new URL('../index.html', import.meta.url))) {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.equal(/\bdisabled\b/.test(html), false, 'index.html 에 disabled 가 있습니다');
  }
});

test('UI 는 상태를 직접 고치지 않고 reduce 를 거친다', () => {
  // src/sim/ 은 DOM 을 모르고, UI 는 상태를 직접 만지지 않는다. 이 경계가 있어야
  // 규칙을 node --test 로 검증할 수 있다.
  for (const [name, src] of uiSources()) {
    if (name === 'strings.js') continue;
    assert.equal(/\bfrom ['"]\.\.\/sim\/state\.js['"]/.test(src) && /state\.\w+\s*=/.test(src), false,
      `src/ui/${name} 이 상태를 직접 대입합니다 — reduce(state, action) 을 쓰세요`);
  }
});

test('탐구 과정의 예시 문구가 세부 단계마다 다르다', () => {
  // 스무 칸에 같은 문장을 띄우면 무엇을 적으라는 건지 알려 주지 못하고,
  // 그 자리에서 관찰한 것이 아니라 앞 칸을 베끼게 만든다. 실제로 그랬다.
  const egs = UI.protocol.flatMap((g) => g.steps.map((s) => s.eg));
  for (const [i, eg] of egs.entries()) {
    assert.equal(typeof eg, 'string', `${i}번째 세부 단계에 예시 문구가 없습니다`);
    assert.ok(eg.trim().length > 0, `${i}번째 세부 단계의 예시 문구가 비었습니다`);
  }
  assert.equal(new Set(egs).size, egs.length,
    `예시 문구가 겹칩니다 — ${egs.length}칸에 서로 다른 ${new Set(egs).size}개뿐입니다`);
  // 세부 단계 이름도 함께 확인한다. 구조를 { label, eg } 로 바꿨으므로 label 이 있어야 한다.
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      assert.equal(typeof s.label, 'string', `STEP ${g.id} 에 label 없는 세부 단계가 있습니다`);
    }
  }
});

test('자기 평가는 난이도와 무관하게 같다', () => {
  // 자기를 돌아보는 일에 난이도를 매길 이유가 없다. 점수를 합산하지도 등급을 내지도 않는다.
  assert.equal(UI.notebook.likertScale.length, 5, '리커트 5점 척도여야 한다');
  const values = UI.notebook.likertScale.map((s) => s.value);
  assert.deepEqual(values, ['1', '2', '3', '4', '5']);
  for (const s of UI.notebook.likertScale) {
    assert.ok(s.label && s.label.trim(), `척도 ${s.value} 에 사람이 읽는 말이 없습니다`);
  }
  assert.ok(UI.notebook.selfEvalItems.length >= 3, '자기 평가 문항이 너무 적습니다');
  for (const it of UI.notebook.selfEvalItems) {
    assert.ok(it.key && it.label, '자기 평가 문항에 key 나 label 이 없습니다');
  }
  // 척도로는 안 남는 것 — 소감을 서술로 받는 자리가 있어야 한다.
  assert.ok(UI.notebook.reflectionItems.length >= 1, '느낀 점을 적을 자리가 없습니다');
  for (const it of UI.notebook.reflectionItems) {
    assert.ok(it.key && it.label && it.eg, '느낀 점 문항에 key·label·eg 가 모두 있어야 합니다');
  }
  const keys = UI.notebook.reflectionItems.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, '느낀 점 문항 키가 겹칩니다');
});
