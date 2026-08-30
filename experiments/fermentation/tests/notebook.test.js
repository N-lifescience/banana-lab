/**
 * 탐구 노트 4단계 — **한 번에 한 STEP.**
 *
 * 어느 STEP 이 펼쳐지는가는 이 노트에서 가장 조용히 깨지는 자리다. 잘못돼도 오류가 안 나고
 * 화면이 조금 이상할 뿐이라, 학생이 「원래 이런가 보다」 하고 넘어간다. 그래서 판정을
 * DOM 을 모르는 순수 함수(`stepPanels`)로 빼 두고 여기서 브라우저 없이 잰다.
 *
 * 브라우저에서만 나는 함정(`innerHTML` 삽입이 `toggle` 을 쏘는 것)은 `tests/ui.contract.test.js`
 * 가 코드 쪽에서 막고, 실제로 눌러 보는 것은 `scripts/check-screen.mjs` 가 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPanels } from '../src/ui/notebook.js';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { OBSERVE_LIMIT_MIN } from '../src/sim/fermentation.js';
import { UI } from '../src/ui/strings.js';

const run = (s0, steps) => steps.reduce((s, [type, payload]) => reduce(s, { type, payload }).state, s0);

const tickToEnd = (s0, step = 5) => {
  let s = s0;
  for (let t = 0; t <= OBSERVE_LIMIT_MIN && s.bench.tube.elapsedMin < OBSERVE_LIMIT_MIN; t += step) {
    s = reduce(s, { type: 'TICK', payload: { minutes: step } }).state;
  }
  return s;
};

/** 한 시행을 처음부터 끝까지. STEP 2~4 를 실제로 밟는다. */
function trial(s, { tempC = 33, glucosePct = 10 } = {}) {
  const st = run(s, [
    ['EMPTY_TUBE', {}],
    ['POUR_GLUCOSE', { pct: glucosePct }],
    ['POUR_YEAST', {}],
    ['PLUG_TUBE', {}],
    ['PUT_IN_INCUBATOR', { tempC }],
  ]);
  return reduce(tickToEnd(st), { type: 'RECORD_TRIAL' }).state;
}

const openIds = (panels) => panels.filter((p) => p.open).map((p) => p.id);
const stateOf = (panels, id) => panels.find((p) => p.id === id).state;

/* ---------------- 하나만 펼쳐진다 ---------------- */

test('아무것도 안 했으면 STEP 1 하나만 펼쳐진다', () => {
  const panels = stepPanels(initialState(1));
  assert.deepEqual(openIds(panels), ['1'],
    `펼쳐진 STEP 이 ${JSON.stringify(openIds(panels))} 입니다 — 하나여야 합니다`);
  assert.equal(stateOf(panels, '1'), 'now');
  assert.deepEqual(panels.slice(1).map((p) => p.state), ['later', 'later', 'later', 'later']);
});

test('앞 STEP 을 마치면 다음 STEP 하나로 넘어간다 — 앞엣것은 접힌다', () => {
  // 실험대에서 한 일이 그대로 노트를 넘긴다. 「지금 STEP」을 따로 저장하지 않는 값이 이것이다.
  let st = initialState(1);
  st = run(st, [['SET_INDEPENDENT', { variable: 'temp' }], ['DECLARE_DESIGN', {}]]);
  const panels = stepPanels(st);
  assert.equal(stateOf(panels, '1'), 'done', 'STEP 1 을 마쳤는데 done 이 아닙니다');
  assert.deepEqual(openIds(panels), ['2'],
    `STEP 1 을 마친 뒤 펼쳐진 것이 ${JSON.stringify(openIds(panels))} 입니다`);
});

test('다 마치면 펼쳐진 STEP 이 하나도 없다 — 「지금 할 차례」가 없다', () => {
  let st = initialState(1);
  st = run(st, [['SET_INDEPENDENT', { variable: 'temp' }], ['DECLARE_DESIGN', {}],
    ['ADD_TO_MIX', { from: 'glucose10', ml: 10 }], ['ADD_TO_MIX', { from: 'water', ml: 10 }]]);
  for (const tempC of [20, 30, 40]) st = trial(st, { tempC });
  st = run(st, [['ADD_KOH', {}]]);
  const panels = stepPanels(st);
  assert.deepEqual(panels.map((p) => p.state), ['done', 'done', 'done', 'done', 'done'],
    `다 마쳤는데 상태가 ${JSON.stringify(panels.map((p) => p.state))} 입니다`);
  assert.deepEqual(openIds(panels), []);
});

/* ---------------- 접힘은 잠금이 아니다 (AGENTS.md §2.1) ---------------- */

test('앞으로 올 STEP 도 손으로 열린다', () => {
  const manual = new Map([['5', true]]);
  const panels = stepPanels(initialState(1), manual);
  assert.equal(stateOf(panels, '5'), 'later', '아직 안 한 STEP 인데 later 가 아닙니다');
  assert.ok(panels.find((p) => p.id === '5').open,
    '앞으로 올 STEP 을 열어 두었는데 접혀 있습니다 — 접힘이 잠금이 되었습니다');
  // 순서를 건너뛰어 실험한 학생은 거기에 적으면 된다. 지금 STEP 도 함께 열려 있다.
  assert.deepEqual(openIds(panels), ['1', '5']);
});

test('손으로 접은 것은 「지금 할 차례」여도 접힌 채로 남는다', () => {
  const panels = stepPanels(initialState(1), new Map([['1', false]]));
  assert.equal(stateOf(panels, '1'), 'now');
  assert.deepEqual(openIds(panels), [],
    '손으로 접었는데 다시 펼쳐졌습니다 — 학생이 한 일이 무시됩니다');
});

test('손으로 연 것은 그 STEP 이 끝난 뒤에도 그대로다 — 다시 그려도 이긴다', () => {
  // 다시 그리기는 `manualOpen` 을 건드리지 않는다. 같은 Map 을 다시 넣어 같은 답이 나오는지 본다.
  let st = initialState(1);
  const manual = new Map([['1', true]]);
  assert.ok(stepPanels(st, manual).find((p) => p.id === '1').open);
  st = run(st, [['SET_INDEPENDENT', { variable: 'temp' }], ['DECLARE_DESIGN', {}]]);
  const after = stepPanels(st, manual);
  assert.equal(stateOf(after, '1'), 'done');
  assert.ok(after.find((p) => p.id === '1').open,
    'STEP 1 이 끝나자 손으로 열어 둔 것이 저절로 접혔습니다 — 적던 글이 화면에서 사라집니다');
});

/* ---------------- 앞으로 올 STEP 을 지우지 않는다 ---------------- */

test('어느 때든 STEP 다섯이 모두 화면에 남는다', () => {
  // 몇 칸짜리 여정인지 보여야 학생이 자기가 어디쯤인지 안다.
  let st = initialState(1);
  for (const acts of [[], [['SET_INDEPENDENT', { variable: 'temp' }]], [['DECLARE_DESIGN', {}]]]) {
    st = run(st, acts);
    assert.equal(stepPanels(st).length, UI.protocol.length,
      'STEP 이 화면에서 사라졌습니다');
  }
});

/* ---------------- 관찰 기록을 적어야 다음 STEP 이 열린다 ---------------- */

/*
 * 이것은 AGENTS.md §2.1 의 「막지 마라」와 부딪히지 않는다. §2.1 은 **실험대 조작** 이야기다 —
 * 잘못 부어도 그대로 진행시키고 결과가 답한다. 여기서 막는 것은 **노트를 읽어 나가는 차례**다.
 * 다만 막는 값은 그대로 지킨다: 왜 막혔는지 말하고(`stepLockedHint`), 죽여 두지 않고,
 * **한 번 열어 본 것은 계속 열린다.**
 */

const lockedIds = (panels) => panels.filter((p) => p.locked).map((p) => p.id);

test('지금 STEP 의 관찰 기록이 비어 있으면 앞으로 올 STEP 이 잠긴다', () => {
  const panels = stepPanels(initialState(1));
  assert.deepEqual(lockedIds(panels), ['2', '3', '4', '5'],
    `잠긴 것이 ${JSON.stringify(lockedIds(panels))} 입니다`);
  // 잠긴 것은 펼쳐지지도 않는다. 「지금 할 차례」는 잠기지 않는다 — 거기가 적을 자리다.
  assert.deepEqual(panels.filter((p) => p.open).map((p) => p.id), ['1']);
  assert.equal(panels[0].locked, false, '지금 할 STEP 이 잠겼습니다 — 적을 데가 없어집니다');
});

test('지금 STEP 의 기록을 적으면 **다음 한 칸만** 열린다', () => {
  /*
   * 예전에는 뒤가 통째로 풀렸다. 선생님이 플레이하시다 짚으셨다 —
   * 「step1 의 관찰 기록을 작성하면 step2 가 열리도록 해야지. 왜 나머지 step 들까지도 다 열려.」
   * 한꺼번에 열리면 「한 번에 한 STEP」이라 해 놓고 실제로는 다시 목록이 된다.
   */
  // STEP 1 의 기록칸은 1a 하나뿐이다 (`UI.protocol` 의 note: true).
  const st = reduce(initialState(1), { type: 'SAVE_NOTE', payload: { step: '1a', text: '온도를 바꾸기로 했다' } }).state;
  assert.deepEqual(lockedIds(stepPanels(st)), ['3', '4', '5'],
    '기록을 적었더니 뒤 STEP 이 통째로 열렸습니다 — 다음 한 칸만 열려야 합니다');
});

test('공백만 적은 것은 적은 것이 아니다', () => {
  const st = reduce(initialState(1), { type: 'SAVE_NOTE', payload: { step: '1a', text: '   \n  ' } }).state;
  assert.deepEqual(lockedIds(stepPanels(st)), ['2', '3', '4', '5'],
    '공백만 넣어도 잠금이 풀립니다');
});

test('끝난 STEP 은 잠기지 않는다 — 되돌아가 읽는 것까지 막지 않는다', () => {
  let st = initialState(1);
  st = run(st, [['SET_INDEPENDENT', { variable: 'temp' }], ['DECLARE_DESIGN', {}]]);
  const panels = stepPanels(st);
  assert.equal(stateOf(panels, '1'), 'done');
  assert.equal(panels.find((p) => p.id === '1').locked, false,
    '끝낸 STEP 이 잠겼습니다 — 적어 둔 것을 다시 볼 수 없습니다');
  // 그 대신 다음 STEP(2)의 칸이 비어 있으니 그 뒤가 다시 잠긴다.
  assert.deepEqual(lockedIds(panels), ['3', '4', '5']);
});

test('한 번 열어 본 STEP 은 계속 열린다', () => {
  const st = initialState(1);
  assert.ok(lockedIds(stepPanels(st)).includes('5'), '먼저 잠겨 있어야 합니다');
  assert.equal(stepPanels(st, new Map(), new Set(['5'])).find((p) => p.id === '5').locked, false,
    '한 번 펼쳐졌던 STEP 이 다시 잠겼습니다');
  // 손으로 연 것도 마찬가지다 — 그것이 「가 봤다」는 뜻이다.
  assert.equal(stepPanels(st, new Map([['5', true]])).find((p) => p.id === '5').locked, false);
});

test('잠긴 STEP 에도 무엇을 하면 열리는지가 적혀 있다', () => {
  // 「잠겼습니다」만 적으면 막다른 길이다. 어디로 가야 하는지까지 문장에 담는다.
  assert.ok(UI.notebook.stepLockedHint.length > 0);
  assert.ok(/기록|적으면/.test(UI.notebook.stepLockedHint),
    `잠금 안내가 무엇을 하라는 말인지 알려 주지 않습니다 — 「${UI.notebook.stepLockedHint}」`);
});

/**
 * **저절로 펼쳐진 STEP 도 「가 본 것」이다.**
 *
 * 「지금 할 차례」라서 저절로 열린 STEP 은 학생이 누른 적이 없어 `manualOpen` 에 없다.
 * 그런데 나중에 「지금 자리」가 **앞으로 밀리면** 그 STEP 은 `later` 가 되어 잠길 자리가 된다.
 * 이 저장소에서 그 길은 **시행을 지우는 것**이다 — STEP 4 의 「시행 기록하기」가 되돌아가고,
 * 그러면 이미 펼쳐 봤던 STEP 5 가 뒤로 밀린다.
 *
 * 열려서 읽고 적기까지 한 STEP 이 그때 잠기면, **학생 눈에는 적어 둔 것이 사라진 것**이다.
 * (웨이브 2 의 germination 세션이 자기 저장소에서 찾았고 허브가 여덟에 돌렸다)
 *
 * ── 이 검사가 못 보는 것 ─────────────────────────────────────────
 * `opened` 에 무엇을 담는지는 **화면 쪽 두 줄**이 정한다. 여기서는 그 두 줄을 **흉내 낸다** —
 * 진짜로 부르지 않는다. 그 줄을 누가 고치면 이 검사는 그대로 초록불이다.
 * 실제로 재려면 브라우저가 필요한데 이 경우는 시행 둘을 끝까지 돌려야 해서
 * `check-screen.mjs` 에 넣기에는 너무 느리다(관찰 시간 20분 × 2). 그래서 여기에 규칙만 못 박고,
 * **손으로 연 쪽**은 `check-screen.mjs` 의 자물쇠 묶음이 진짜 화면에서 잰다.
 */
test('저절로 펼쳐졌던 STEP 은 「지금 자리」가 앞으로 밀려도 잠기지 않는다', () => {
  const opened = new Set();
  const manualOpen = new Map();
  // 화면이 하는 그대로: 그리고 나서 **펼쳐진 것만** 담는다.
  const draw = (state) => {
    const panels = stepPanels(state, manualOpen, opened);
    panels.forEach((p) => { if (p.open) opened.add(p.id); });
    return panels;
  };

  let st = initialState(1);
  st = run(st, [['SET_INDEPENDENT', { variable: 'temp' }], ['DECLARE_DESIGN', {}],
    ['ADD_TO_MIX', { from: 'glucose10', ml: 10 }], ['ADD_TO_MIX', { from: 'water', ml: 10 }]]);
  st = trial(st, { tempC: 20 });
  st = trial(st, { tempC: 30 });          // 두 번만 — 조건이 셋이 아니라 STEP 5 는 아직 「지금」
  st = run(st, [['ADD_KOH', {}]]);

  const before = draw(st);
  assert.equal(stateOf(before, '5'), 'now', 'STEP 5 가 「지금 할 차례」가 아닙니다');
  assert.ok(before.find((p) => p.id === '5').open, 'STEP 5 가 저절로 펼쳐지지 않았습니다');
  assert.equal(manualOpen.has('5'), false, '이 경우는 학생이 누른 적이 없어야 합니다');

  // 시행을 전부 지운다 → STEP 4 가 되돌아가고 「지금 자리」가 앞으로 밀린다.
  for (const at of st.trials.map((t) => t.at)) {
    st = reduce(st, { type: 'DELETE_TRIAL', payload: { at } }).state;
  }
  const after = draw(st);
  assert.equal(stateOf(after, '5'), 'later', '「지금 자리」가 앞으로 안 밀렸습니다 — 이 검사가 헛돕니다');
  assert.equal(after.find((p) => p.id === '5').locked, false,
    '저절로 펼쳐졌던 STEP 이 잠겼습니다 — 학생 눈에는 적어 둔 것이 사라진 것입니다');
});
