/**
 * 변인 설계 화면 테스트.
 *
 * 여기서 가장 중요한 것은 **이 화면이 이 실험에 매이지 않았는가**다.
 * 효모 발효 실험이 이 파일을 그대로 가져다 쓰려면, 「온도」·「pH」·「과산화수소수」가
 * 이 파일 어디에도 없어야 한다. 사람 눈으로는 놓친다 — 한 줄만 새어 들어가도
 * 다음 실험에서 그 한 줄을 찾느라 파일을 통째로 읽게 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initialState, INDEPENDENT_VARIABLES, VARIABLE_KEY, CHOICES, controlledKeys, defaultControls,
} from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { designSentence, independentKey } from '../src/ui/design.js';
import { UI } from './../src/ui/strings.js';

/**
 * 주석을 걷어낸 소스.
 *
 * 처음에는 주석까지 훑었다. **그게 틀렸다** — 「이 파일에는 온도·pH 가 없다」고 적어 둔
 * 설명문 자체가 걸려서, 규칙을 지켰다는 증거가 규칙 위반으로 판정됐다.
 * 산문을 훑으면 오탐이 난다 (`PLAYBOOK.md` §7). 주석은 화면에 나오지 않는다.
 */
const SOURCE = readFileSync(new URL('../src/ui/design.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ---------------- 재활용할 수 있는가 ---------------- */

/**
 * 이 실험 고유의 말이 화면 코드에 섞였는가.
 *
 * 주석까지 훑는다 — 주석에 「온도」가 있어도 다음 사람이 그것을 규칙으로 읽고 따라 쓴다.
 * 대신 목록을 **이 실험의 실제 값**에서 만든다. 손으로 적으면 조건을 하나 늘릴 때
 * 이 검사가 조용히 그것을 놓친다.
 */
test('설계 화면에 이 실험의 말이 하나도 없다', () => {
  const banned = [
    ...INDEPENDENT_VARIABLES.map((v) => UI.variables[v].name),
    ...Object.values(UI.conditions),
    UI.dependentName,
    '카탈레이스', '감자', '과산화수소', '원반', '효소',
  ];
  const found = banned.filter((w) => SOURCE.includes(w));
  assert.deepEqual(found, [],
    `src/ui/design.js 에 이 실험의 말이 있습니다: ${found.join(', ')} — `
    + 'strings.js 와 state.js 에서 읽어 오세요');
});

test('변인 목록을 코드에 박지 않고 상태에서 읽는다', () => {
  for (const v of INDEPENDENT_VARIABLES) {
    assert.ok(!SOURCE.includes(`'${v}'`), `design.js 에 조작변인 '${v}' 가 박혀 있습니다`);
  }
  for (const key of Object.keys(defaultControls())) {
    assert.ok(!SOURCE.includes(`'${key}'`), `design.js 에 조건 '${key}' 가 박혀 있습니다`);
  }
});

/* ---------------- 막지 않는가 ---------------- */

test('설계 화면에 disabled 가 없다', () => {
  assert.ok(!/\bdisabled\b/.test(SOURCE), '막지 말고 결과로 답하세요 (AGENTS.md §2.1)');
});

test('클릭으로도 동작한다 — 포인터 이벤트만 듣지 않는다', () => {
  // 포인터 이벤트만 들으면 element.click() 이 아무 일도 안 하고,
  // 보조기기(음성 제어·스크린리더)로는 조작을 아예 못 한다.
  assert.ok(SOURCE.includes("addEventListener('click'"), 'click 을 듣지 않습니다');
  assert.ok(!/pointerdown|mousedown/.test(SOURCE));
});

/* ---------------- 같은 것을 두 번 정하지 않는가 ---------------- */

test('조작변인이 차지한 조건은 통제변인에서 빠진다', () => {
  for (const v of INDEPENDENT_VARIABLES) {
    const keys = controlledKeys({ independent: v });
    assert.ok(!keys.includes(VARIABLE_KEY[v]),
      `${v} 를 조작변인으로 골랐는데 ${VARIABLE_KEY[v]} 가 통제변인에도 있습니다`);
  }
});

test('조작변인을 안 골랐으면 조건이 하나도 빠지지 않는다', () => {
  assert.deepEqual(controlledKeys({ independent: null }).sort(),
    Object.keys(defaultControls()).sort());
});

/* ---------------- 설계 문장 ---------------- */

test('설계 문장이 세 갈래를 다 말한다', () => {
  const st = initialState();
  const s = designSentence({ ...st.design, independent: INDEPENDENT_VARIABLES[0] });
  assert.ok(s.includes(UI.variables[INDEPENDENT_VARIABLES[0]].name), '조작변인이 없습니다');
  assert.ok(s.includes(UI.dependentName), '종속변인이 없습니다');
  for (const k of controlledKeys({ independent: INDEPENDENT_VARIABLES[0] })) {
    assert.ok(s.includes(UI.conditions[k]), `통제변인 ${k} 가 문장에 없습니다`);
  }
});

test('설계 문장에 같은 말이 두 번 붙지 않는다', () => {
  // 「pH pH 7」처럼 조건 이름과 값 표기가 겹쳐 보이던 일이 있었다.
  const st = initialState();
  for (const v of INDEPENDENT_VARIABLES) {
    const s = designSentence({ ...st.design, independent: v });
    for (const name of Object.values(UI.conditions)) {
      assert.ok(!s.includes(`${name} ${name}`), `설계 문장에 「${name} ${name}」 이 있습니다`);
    }
  }
});

test('조작변인을 안 골랐으면 문장이 그렇다고 말한다', () => {
  assert.equal(designSentence(initialState().design), UI.design.noIndependent);
});

test('independentKey 가 실제 조건 칸을 가리킨다', () => {
  assert.equal(independentKey({ independent: null }), null);
  for (const v of INDEPENDENT_VARIABLES) {
    assert.ok(Object.keys(defaultControls()).includes(independentKey({ independent: v })));
  }
});

/* ---------------- 화면이 답을 먼저 말하지 않는가 ---------------- */

/**
 * 설계 화면에 결과가 적혀 있으면 학생은 실험하기 전에 답을 읽는다.
 *
 * 「가장 빠른 조건」을 실제 모형에서 뽑아 그 값이 화면 문구에 있는지 본다 —
 * 손으로 「37」을 적어 두면 최적 온도가 바뀌었을 때 이 검사가 조용히 헛돈다.
 */
test('설계 화면 문구에 정답이 적혀 있지 않다', async () => {
  const { riseTime } = await import('../src/sim/kinetics.js');
  const texts = [
    UI.design.title, UI.design.lead, UI.design.notALock,
    ...INDEPENDENT_VARIABLES.map((v) => UI.variables[v].question),
  ].join(' ');

  const best = {};
  for (const key of ['tempC', 'ph']) {
    let bestV = null, bestT = Infinity;
    for (const v of CHOICES[key]) {
      const t = riseTime({ [key]: v }).seconds ?? Infinity;
      if (t < bestT) { bestT = t; bestV = v; }
    }
    best[key] = bestV;
  }
  for (const [key, v] of Object.entries(best)) {
    assert.ok(!texts.includes(String(v)),
      `설계 화면이 가장 빠른 조건(${UI.conditions[key]} ${v})을 먼저 말합니다`);
  }
});
