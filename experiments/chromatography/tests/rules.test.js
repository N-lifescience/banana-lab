/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 테스트는 「설계 원칙 회귀 테스트」 절의 둘이다 —
 * **하드 게이트는 두 종류뿐**이고, **그 둘은 빠져나갈 길을 문장에 담는다.**
 * 누군가 조작을 막는 코드를 추가하면 여기서 잡힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initialState, MARKERS, LEAF_KINDS, HISTORY_LIMIT,
  extractStrength, isSettled, isSubmerged, currentFrontMm, frontOverrun,
  measurableFrontMm, stripParams, pigmentLoad,
} from '../src/sim/state.js';
import { reduce, ACTIONS, BLOCKING_REASONS } from '../src/sim/rules.js';
import { observability } from '../src/sim/quality.js';
import { ORIGIN_MM, PAPER_H_MM, MIN_SPOT_MM, MAX_SPOT_MM } from '../src/sim/develop.js';

const S0 = () => initialState(1, 12345);

function run(state, type, payload) {
  return reduce(state, { type, payload });
}

/**
 * 모든 액션을 훑는 회귀 테스트에 쓰는 인자표.
 *
 * 두 곳에 따로 적어 뒀더니 액션을 하나 늘릴 때마다 한쪽만 고치고 다른 쪽이 터졌다.
 * 한 곳에서만 적는다 — 여기 없는 액션은 인자 없이도 돌아야 한다는 뜻이다.
 */
function fuzzPayloads() {
  return {
    ADD_LEAF: { kind: LEAF_KINDS.FRESH, amount: 0.5 },
    ADD_EXTRACT: { amount: 0.5 },
    SHAKE: { amount: 0.2 },
    TICK: { seconds: 1 },
    DRAW_ORIGIN: { heightMm: ORIGIN_MM, marker: MARKERS.PENCIL },
    SPOT: { dwell: 0.2 },
    POUR_SOLVENT: { mm: 5 },
    SAVE_NOTE: { step: '1a', text: 'x' },
    NOTE_VIOLATION: { kind: 'cap-left-open' },
    DELETE_CAPTURE: { at: 0 },
    MARK_READ: { stage: '1' },
  };
}

/** 상층액이 준비될 때까지 — 잎 · 추출액 · 흔들기 · 층 분리 */
function withExtract(state) {
  let s = state;
  s = run(s, 'ADD_LEAF', { amount: 0.5 }).state;
  s = run(s, 'ADD_EXTRACT', { amount: 0.5 }).state;
  for (let i = 0; i < 5; i++) s = run(s, 'SHAKE', { amount: 0.2 }).state;
  for (let i = 0; i < 12; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.ok(isSettled(s.tube), '층이 갈리지 않았습니다 — TICK 이 settleT 를 못 올리고 있습니다');
  return s;
}

/** 원점을 긋고 n번 찍은 상태까지 */
function withSpots(state, n = 15, dwell = 0.2) {
  let s = run(state, 'DRAW_ORIGIN', { heightMm: ORIGIN_MM, marker: MARKERS.PENCIL }).state;
  s = run(s, 'LOAD_CAPILLARY').state;
  for (let i = 0; i < n; i++) {
    s = run(s, 'SPOT', { dwell }).state;
    s = run(s, 'DRY_SPOT').state;
  }
  return s;
}

/** 전선이 목표 높이에 닿을 때까지 시간을 돌린다 */
function tickUntilFront(state, targetMm) {
  let s = state;
  for (let i = 0; i < 400; i++) {
    if (currentFrontMm(s.paper) >= targetMm) return s;
    s = run(s, 'TICK', { seconds: 1 }).state;
  }
  throw new Error(`전선이 ${targetMm} mm 에 닿지 않았습니다 (지금 ${currentFrontMm(s.paper)})`);
}

/* ---------------- 추출 ---------------- */

test('잎과 추출액이 1:1 에 가까울수록 진하게 뽑힌다', () => {
  const strength = (leaf, extract, shaken = 1) =>
    extractStrength({ leaf, extract, shaken, leafFresh: 1 });
  assert.ok(strength(0.5, 0.5) > strength(0.5, 1), '묽으면 옅어야 합니다');
  assert.ok(strength(0.5, 0.5) > strength(0.5, 0.2), '추출액이 모자라면 다 못 뽑습니다');
  assert.equal(strength(0, 0.5), 0);
  assert.equal(strength(0.5, 0), 0);
});

test('덜 흔들면 덜 뽑힌다 — 막지는 않는다', () => {
  const p = { leaf: 0.5, extract: 0.5, leafFresh: 1 };
  assert.ok(extractStrength({ ...p, shaken: 1 }) > extractStrength({ ...p, shaken: 0.2 }));
});

test('시든 잎도 그대로 들어가고, 색소만 적다', () => {
  const r = run(S0(), 'ADD_LEAF', { kind: LEAF_KINDS.WILTED });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'wilted-leaf');
  assert.ok(r.state.tube.leaf > 0, '막지 말고 실제로 넣어야 합니다');
  assert.ok(r.state.tube.leafFresh < 1);
});

test('추출액을 잎보다 훨씬 많이 넣어도 막지 않는다', () => {
  let s = run(S0(), 'ADD_LEAF', { amount: 0.2 }).state;
  const r = run(s, 'ADD_EXTRACT', { amount: 0.8 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'diluted');
  assert.equal(r.state.tube.extract, 0.8);
});

test('층이 갈리기 전에 뽑으면 부스러기가 딸려 온다', () => {
  let s = run(S0(), 'ADD_LEAF', {}).state;
  s = run(s, 'ADD_EXTRACT', {}).state;
  s = run(s, 'SHAKE', { amount: 1 }).state;
  const r = run(s, 'LOAD_CAPILLARY');
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'unsettled');
  assert.ok(r.state.tools.capillary.strength > 0, '뽑히기는 해야 합니다');
  assert.ok(r.state.tools.capillary.grit > 0);
});

/* ---------------- 원점 ---------------- */

test('볼펜으로 그어도 막지 않는다 — 잉크가 함께 올라갈 뿐이다', () => {
  const r = run(S0(), 'DRAW_ORIGIN', { heightMm: ORIGIN_MM, marker: MARKERS.PEN });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'pen-origin');
  assert.equal(r.state.paper.marker, MARKERS.PEN);
  assert.equal(r.state.paper.originMm, ORIGIN_MM, '막지 말고 실제로 그어야 합니다');
});

test('원점을 너무 낮게·높게 그어도 그어진다', () => {
  const low = run(S0(), 'DRAW_ORIGIN', { heightMm: 5 });
  assert.equal(low.tag, 'origin-low');
  assert.equal(low.state.paper.originMm, 5);
  const high = run(S0(), 'DRAW_ORIGIN', { heightMm: 38 });
  assert.equal(high.tag, 'origin-high');
  assert.equal(high.state.paper.originMm, 38);
});

/* ---------------- 점 찍기 ---------------- */

test('말리고 다시 찍으면 원점이 커지지 않는다', () => {
  const s = withSpots(withExtract(S0()), 20, 0.2);
  assert.equal(s.paper.spotMm, MIN_SPOT_MM, '절차대로 했는데 원점이 커지면 안 됩니다');
  assert.ok(s.paper.load > 0.9, '스무 번 찍으면 넉넉히 실려야 합니다');
});

test('다섯 번만 찍으면 흐리다 — 막지는 않는다', () => {
  const s = withSpots(withExtract(S0()), 5, 0.2);
  assert.ok(s.paper.load < 0.4, `다섯 번이면 흐려야 합니다 (지금 ${s.paper.load})`);
  assert.equal(s.paper.spots, 5);
});

test('마르기 전에 겹쳐 찍으면 원점이 번져 커진다', () => {
  let s = run(withExtract(S0()), 'DRAW_ORIGIN', {}).state;
  s = run(s, 'LOAD_CAPILLARY').state;
  s = run(s, 'SPOT', { dwell: 0.2 }).state;
  const r = run(s, 'SPOT', { dwell: 0.2 });   // 말리지 않고 바로
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'spot-smeared');
  assert.ok(r.state.paper.spotMm > MIN_SPOT_MM);
});

test('한 번에 오래 대면 원점이 커진다', () => {
  let s = run(withExtract(S0()), 'DRAW_ORIGIN', {}).state;
  s = run(s, 'LOAD_CAPILLARY').state;
  const r = run(s, 'SPOT', { dwell: 1 });
  assert.equal(r.tag, 'spot-wide');
  assert.ok(r.state.paper.spotMm > MIN_SPOT_MM);
});

test('빈 모세관으로는 아무것도 찍히지 않는다', () => {
  const r = run(S0(), 'SPOT', { dwell: 0.2 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.paper.spots, 0);
});

test('원점 선을 안 긋고 찍어도 찍히고, 잰 자리를 잃는다', () => {
  let s = run(withExtract(S0()), 'LOAD_CAPILLARY').state;
  const r = run(s, 'SPOT', { dwell: 0.2 });
  assert.equal(r.tag, 'no-origin-line');
  assert.equal(r.state.paper.spots, 1, '막지 말고 실제로 찍혀야 합니다');
  assert.equal(r.state.paper.marker, null, '표시가 남지 않아야 합니다');
});

/* ---------------- 전개 ---------------- */

test('원점이 잠기면 색소가 씻겨 나가 띠가 없다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 30 }).state;      // 원점(25 mm)보다 깊다
  const ins = run(s, 'INSERT_PAPER');
  assert.equal(ins.outcome, 'happened');
  assert.equal(ins.tag, 'origin-submerged');
  s = ins.state;
  assert.ok(isSubmerged(s.paper, s.vial));
  for (let i = 0; i < 40; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(pigmentLoad(s.paper), 0, '잠긴 채로 두면 색소가 남지 않아야 합니다');
});

test('전개액 없이 세우면 시간이 흘러도 전선이 오르지 않는다', () => {
  let s = withSpots(withExtract(S0()));
  const r = run(s, 'INSERT_PAPER');
  assert.equal(r.tag, 'no-solvent');
  s = r.state;
  for (let i = 0; i < 20; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(currentFrontMm(s.paper), 0);
});

test('뚜껑을 닫아 두면 빛이 들지 않아 엽록소가 남는다', () => {
  const build = (capped) => {
    let s = withSpots(withExtract(S0()));
    s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
    s = run(s, 'INSERT_PAPER').state;
    if (capped) s = run(s, 'CAP_VIAL').state;
    for (let i = 0; i < 60; i++) s = run(s, 'TICK', { seconds: 1 }).state;
    return s.paper.lightDose;
  };
  assert.equal(build(true), 0);
  assert.ok(build(false) > 0, '뚜껑을 열어 두면 빛을 쬐야 합니다');
});

test('너무 일찍 꺼내면 색소가 원점 가까이 뭉쳐 있다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = run(s, 'TICK', { seconds: 1 }).state;
  const r = run(s, 'REMOVE_PAPER');
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'too-early');
  assert.equal(r.state.paper.inVial, false, '막지 말고 실제로 꺼내야 합니다');
});

test('너무 늦게 꺼내면 전선이 종이 끝을 넘어가 잴 수 없다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = run(s, 'CAP_VIAL').state;
  for (let i = 0; i < 200; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.ok(frontOverrun(s.paper));
  const r = run(s, 'REMOVE_PAPER');
  assert.equal(r.tag, 'front-overrun');
  assert.equal(measurableFrontMm(r.state.paper), null, '분모를 잃어야 합니다');
});

test('꺼냈다 다시 세우면 전개가 이어진다 — 전선이 바닥으로 내려가지 않는다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = tickUntilFront(s, 40);
  const before = currentFrontMm(s.paper);
  s = run(s, 'REMOVE_PAPER').state;
  s = run(s, 'INSERT_PAPER').state;
  assert.ok(currentFrontMm(s.paper) >= before - 0.01);
});

/* ---------------- 표시하고 재기 ---------------- */

test('말라 버린 뒤에는 전선을 표시할 수 없다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = tickUntilFront(s, 80);
  s = run(s, 'REMOVE_PAPER').state;
  s = run(s, 'DRY_PAPER').state;
  const r = run(s, 'MARK_FRONT');
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'front-dried');
  assert.equal(r.state.paper.markedFront, null);
});

test('표시하기 전에 말리면 전선을 잃는다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = tickUntilFront(s, 80);
  s = run(s, 'REMOVE_PAPER').state;
  const r = run(s, 'DRY_PAPER');
  assert.equal(r.tag, 'front-lost');
});

test('표시해 둔 전선은 마른 뒤에도 남는다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = tickUntilFront(s, 80);
  const at = currentFrontMm(s.paper);
  s = run(s, 'REMOVE_PAPER').state;
  s = run(s, 'MARK_FRONT').state;
  s = run(s, 'DRY_PAPER').state;
  assert.ok(Math.abs(measurableFrontMm(s.paper) - at) < 0.01);
});

/* ---------------- 정상 경로 ---------------- */

test('정상 경로: 잎부터 기록까지 뜻대로 안 된 조작 없이 끝난다', () => {
  let s = S0();
  const step = (type, payload) => {
    const r = run(s, type, payload);
    assert.equal(r.outcome, 'ok', `${type} 에서 정상 경로를 벗어났습니다: ${r.message}`);
    s = r.state;
    return r;
  };

  step('ADD_LEAF', { kind: LEAF_KINDS.FRESH, amount: 0.5 });
  step('ADD_EXTRACT', { amount: 0.5 });
  for (let i = 0; i < 5; i++) step('SHAKE', { amount: 0.2 });
  for (let i = 0; i < 12; i++) step('TICK', { seconds: 1 });

  step('DRAW_ORIGIN', { heightMm: ORIGIN_MM, marker: MARKERS.PENCIL });
  step('LOAD_CAPILLARY');
  for (let i = 0; i < 15; i++) { step('SPOT', { dwell: 0.2 }); step('DRY_SPOT'); }

  step('POUR_SOLVENT', { mm: 5 });
  step('INSERT_PAPER');
  step('CAP_VIAL');
  s = tickUntilFront(s, PAPER_H_MM * 0.9);
  step('UNCAP_VIAL');
  step('REMOVE_PAPER');
  step('MARK_FRONT');
  step('DRY_PAPER');
  step('MARK_BANDS');
  step('MEASURE');
  step('CAPTURE');

  assert.equal(s.session.captures.length, 1);
  // 정상 경로에서는 뜻대로 안 된 일이 한 번도 일어나지 않는다.
  const notOk = s.session.log.filter((e) => e.outcome !== 'ok');
  assert.deepEqual(notOk, [], '정상 경로 전체에 뜻대로 안 된 조작이 하나라도 있으면 안 된다');
  assert.deepEqual(s.session.log.map((e) => e.at), s.session.log.map((_, i) => i));

  // 절차를 지켰으면 볼 만한 결과가 나와야 한다. 안 나오면 규칙이 아니라 절차가 틀린 것이다.
  const q = observability(stripParams(s));
  assert.ok(q.score >= 85, `절차를 다 지켰는데 ${q.score}점입니다 (가장 깎인 곳: ${q.worst})`);
});

test('되돌리기 기록은 기록한 결과에 들어가지 않는다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'CAPTURE').state;
  assert.ok(s.session.history.length > 0, '세션 안에는 남아 있어야 한다');
  assert.ok(s.session.captures.every((c) => !('history' in c)));
  assert.ok(!('history' in stripParams(s)));
});

/* ---------------- 되돌아갈 길 ---------------- */

test('거름종이 통에서 새것을 꺼내면 처음으로 돌아간다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  const r = run(s, 'NEW_PAPER');
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.paper.spots, 0);
  assert.equal(r.state.paper.originMm, null);
  assert.equal(r.state.vial.hasPaper, false, '바이알에 유령 종이가 남으면 안 됩니다');
  assert.ok(r.state.tube.leaf > 0, '원심관의 상층액까지 없애면 안 됩니다');
});

test('원심관과 바이알을 비워 되돌아갈 수 있다', () => {
  let s = withExtract(S0());
  s = run(s, 'POUR_SOLVENT', { mm: 20 }).state;
  const t = run(s, 'EMPTY_TUBE');
  assert.equal(t.state.tube.leaf, 0);
  const v = run(s, 'EMPTY_VIAL');
  assert.equal(v.state.vial.depthMm, 0);
});

test('모세관을 헹구면 안에 남은 것이 없다', () => {
  let s = run(withExtract(S0()), 'LOAD_CAPILLARY').state;
  const r = run(s, 'RINSE_CAPILLARY');
  assert.equal(r.state.tools.capillary.strength, 0);
});

/* ---------------- 안전 — 앱은 판정하지 않는다 ---------------- */

/**
 * **안전 조작과 그 판정은 걷어냈다.**
 *
 * 가상 실험에서 「마개를 닫았는가」를 따지면 **화면 속 단추를 눌렀다는 사실**을
 * 평가하게 된다 — 안전 습관이 아니라 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
 * 지금은 자기 평가 쪽에 가만히 적힌 안내만 있고 앱은 아무것도 판정하지 않는다.
 *
 * 되살아나면 여기서 잡는다. **이름이 소스에 남아 있는지**로 본다 —
 * 액션 표에서 지워도 다른 데서 부르고 있으면 조용히 되살아난다.
 */
test('안전 전용 액션이 하나도 남아 있지 않다', () => {
  // `reduce` 는 모르는 액션에 예외를 던진다. **그것이 여기서 바라는 결과다** —
  // 조용히 무시하면 다른 데서 계속 부르고 있어도 아무도 모른다.
  const gone = ['WASH_HANDS', 'CLOSE_CAP', 'DISPOSE_WASTE', 'CHECK_TIDY', 'NOTE_VIOLATION'];
  for (const name of gone) {
    assert.throws(() => run(S0(), name), /알 수 없는 액션/, `${name} 이 아직 동작합니다`);
  }
});

test('안전 전용 액션을 부르는 곳도 남아 있지 않다', () => {
  /*
   * 액션 표에서 지워도 **다른 데서 부르고 있으면** 화면이 예외로 죽는다.
   * 소스에서 이름 자체를 훑는다 — 주석은 걷어낸다(설명에 그 낱말을 쓰게 되므로).
   */
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const files = ['../src/main.js', '../src/ui/bench.js', '../src/ui/notebook.js',
    '../src/ui/zoom.js', '../src/ui/report.js', '../src/sim/rules.js', '../src/sim/state.js'];
  for (const f of files) {
    const src = strip(readFileSync(new URL(f, import.meta.url), 'utf8'));
    for (const name of ['WASH_HANDS', 'CLOSE_CAP', 'DISPOSE_WASTE', 'CHECK_TIDY', 'NOTE_VIOLATION']) {
      assert.equal(src.includes(name), false, `${f} 이 아직 ${name} 을 부릅니다`);
    }
  }
});

test('세션에 정리·위반 기록이 없다', () => {
  // 남겨 두면 아무도 안 채우는 빈 배열이 제출물까지 따라간다.
  const s = S0().session;
  assert.equal('tidy' in s, false);
  assert.equal('violations' in s, false);
});

test('기록을 지우면 거기 딸린 답도 함께 지워진다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'CAPTURE').state;
  const at = s.session.captures[0].at;
  s = run(s, 'SAVE_NOTE', { step: `rf.${at}`, text: '0.5' }).state;
  const r = run(s, 'DELETE_CAPTURE', { at });
  assert.equal(r.state.session.captures.length, 0);
  assert.equal(r.state.session.notes[`rf.${at}`], undefined);
});

test('로그에는 시각이 아니라 순번이 붙는다', () => {
  let s = S0();
  for (let i = 0; i < 4; i++) s = run(s, 'ADD_LEAF', {}).state;
  assert.deepEqual(s.session.log.map((e) => e.at), [0, 1, 2, 3]);
});

/* ---------------- 되돌리기 ---------------- */

test('난이도가 올라갈수록 되돌릴 수 있는 횟수가 줄어든다', () => {
  assert.equal(initialState(1).session.undosLeft, Infinity);
  assert.equal(initialState(2).session.undosLeft, 3);
  assert.equal(initialState(3).session.undosLeft, 1);
});

test('되돌리면 직전 상태로 돌아가고, 로그는 되돌리지 않는다', () => {
  let s = run(S0(), 'ADD_LEAF', {}).state;
  const before = s.tube.leaf;
  s = run(s, 'ADD_EXTRACT', {}).state;
  const r = run(s, 'UNDO');
  assert.equal(r.state.tube.extract, 0);
  assert.equal(r.state.tube.leaf, before);
  assert.ok(r.state.session.log.length > s.session.log.length, '로그는 되돌아보기용이라 되감지 않는다');
});

test('되돌리기를 다 써도, 되돌릴 것이 없어도 막지 않는다', () => {
  let s = initialState(3, 1);
  s = run(s, 'ADD_LEAF', {}).state;
  s = run(s, 'UNDO').state;
  const exhausted = run(s, 'UNDO');
  assert.equal(exhausted.outcome, 'happened');
  assert.equal(exhausted.tag, 'undo-exhausted');
  const empty = run(S0(), 'UNDO');
  assert.equal(empty.tag, 'undo-empty');
});

test('시간이 흘러도 되돌리기 기록이 밀리지 않는다', () => {
  let s = run(S0(), 'ADD_LEAF', {}).state;
  const depth = s.session.history.length;
  for (let i = 0; i < 30; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(s.session.history.length, depth, 'TICK 이 기록을 밀어내면 되돌리기가 죽는다');
});

test('연속 조작은 되돌리기 기록에서 하나로 합쳐진다', () => {
  let s = run(S0(), 'ADD_LEAF', {}).state;
  s = run(s, 'ADD_EXTRACT', {}).state;
  const before = s.session.history.length;
  for (let i = 0; i < 5; i++) s = run(s, 'SHAKE', { amount: 0.1 }).state;
  assert.equal(s.session.history.length, before + 1, '끌기 한 번은 되돌리기 한 칸이다');
});

test('아무것도 바꾸지 못한 조작은 되돌리기 기록에 쌓이지 않는다', () => {
  const r = run(S0(), 'DRY_SPOT');
  assert.equal(r.state.session.history.length, 0);
});

test('되돌리기 기록은 20개까지만 쌓이고, 스냅샷이 스냅샷을 품지 않는다', () => {
  let s = S0();
  for (let i = 0; i < 30; i++) s = run(s, 'DRAW_ORIGIN', { heightMm: 8 + (i % 10) }).state;
  assert.equal(s.session.history.length, HISTORY_LIMIT);
  assert.ok(s.session.history.every((h) => h.session.history.length === 0),
    '스냅샷이 스냅샷을 품으면 상태가 지수적으로 커진다');
});

test('reduce 는 원본 상태를 바꾸지 않는다', () => {
  const s = S0();
  const copy = JSON.parse(JSON.stringify(s));
  run(s, 'ADD_LEAF', {});
  run(s, 'DRAW_ORIGIN', { heightMm: 20 });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), copy);
});

/* ---------------- 설계 원칙 회귀 테스트 ---------------- */

/** 하드 게이트를 검사할 때 쓸, 서로 다른 상태 몇 벌 */
function gateStates() {
  const states = [S0()];
  let s = withSpots(withExtract(S0()));
  states.push(s);
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = run(s, 'CAP_VIAL').state;              // 뚜껑을 닫은 채로
  states.push(s);
  s = tickUntilFront(s, 80);
  s = run(s, 'UNCAP_VIAL').state;
  s = run(s, 'REMOVE_PAPER').state;          // 젖은 채로
  states.push(s);
  states.push(run(s, 'MEASURE').state);      // 찢어진 채로
  return states;
}

test('하드 게이트는 두 종류뿐이다', () => {
  const allowed = new Set(Object.values(BLOCKING_REASONS));
  const payloads = fuzzPayloads();
  for (const st of gateStates()) {
    for (const type of Object.keys(ACTIONS)) {
      const r = reduce(st, { type, payload: payloads[type] ?? {} });
      if (r.outcome === 'blocked') {
        assert.ok(allowed.has(r.reason),
          `${type} 이 허용되지 않은 사유로 차단했습니다: ${r.reason}. AGENTS.md §2.1 참조`);
      }
    }
  }
});

/**
 * **막는 대신 빠져나갈 길을 문장에 담는가.**
 *
 * 「새것을 꺼내세요」로는 어디서 꺼내는지 알 수 없다. 막아 놓고 갈 곳을 말하지 않으면
 * 그건 결과가 아니라 막다른 길이다.
 */
/**
 * **막힌 결과에는 `tag` 가 없다.**
 *
 * `blocked(state, message, reason)` 에는 `tag` 자리가 아예 없다 — 셋째 인자는 **사유**다.
 * 그런데 말풍선 검사가 `push(…, 'blocked', '어떤태그')` 로 태그를 손으로 실어
 * **앱이 만들 수 없는 상태**를 재고 있었다. 통과해도 아무것도 지키지 못한다.
 *
 * 층 사이를 여기서 못 박는다. 나중에 누가 `blocked` 에 태그를 붙이면 여기가 먼저 운다 —
 * 그러면 말풍선 쪽 가정도 함께 고칠 수 있다.
 * (허브 세션이 정본에서 찾고, osmosis 가 이 검사를 냈다.)
 */
test('막힌 결과에는 tag 가 없다 — 셋째 인자는 사유다', () => {
  const payloads = fuzzPayloads();
  let seen = 0;
  for (const st of gateStates()) {
    for (const type of Object.keys(ACTIONS)) {
      const r = reduce(st, { type, payload: payloads[type] ?? {} });
      if (r.outcome !== 'blocked') continue;
      seen++;
      assert.equal(r.tag, undefined,
        `${type} 의 막힌 결과에 tag 가 실렸습니다(${JSON.stringify(r.tag)}). ` +
        '말풍선 검사가 그 모양을 가정하고 있으면 함께 고치세요.');
      assert.ok(r.reason, `${type} 의 막힌 결과에 사유가 없습니다`);
    }
  }
  assert.ok(seen > 0, '막힌 결과를 하나도 못 만들었습니다 — 이 검사가 헛돕니다');
});

test('차단 메시지는 어디로 가야 하는지까지 말한다', () => {
  const payloads = fuzzPayloads();
  const seen = new Set();
  for (const st of gateStates()) {
    for (const type of Object.keys(ACTIONS)) {
      const r = reduce(st, { type, payload: payloads[type] ?? {} });
      if (r.outcome !== 'blocked') continue;
      seen.add(r.reason);
      assert.ok(/(세요|십시오)/.test(r.message ?? ''),
        `${type} 의 차단 메시지에 다음 행동이 없습니다: "${r.message}"`);
      assert.ok(/(선반|바이알|통|개수대|쓰레기통|폐액통)/.test(r.message ?? ''),
        `${type} 의 차단 메시지가 **어디로** 가야 하는지 말하지 않습니다: "${r.message}"`);
    }
  }
  assert.deepEqual([...seen].sort(), [...Object.values(BLOCKING_REASONS)].sort(),
    '두 하드 게이트가 실제로 닿는 상태에서 검사돼야 합니다');
});

test('뚜껑이 닫힌 바이알에는 종이를 넣을 수 없다 — 물리적으로 성립하지 않는다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'CAP_VIAL').state;
  const r = run(s, 'INSERT_PAPER');
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.reason, BLOCKING_REASONS.IMPOSSIBLE);
  assert.equal(r.state.paper.inVial, false);
  // 뚜껑을 열면 바로 들어간다 — 막다른 길이 아니다
  const opened = run(run(s, 'UNCAP_VIAL').state, 'INSERT_PAPER');
  assert.equal(opened.outcome, 'ok');
});

test('젖은 거름종이에 자를 대면 찢어지고, 새것으로 이어 갈 수 있다', () => {
  let s = withSpots(withExtract(S0()));
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = tickUntilFront(s, 80);
  s = run(s, 'REMOVE_PAPER').state;
  const r = run(s, 'MEASURE');
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.reason, BLOCKING_REASONS.BROKEN);
  assert.equal(r.state.paper.torn, true);
  // 말린 뒤에 재면 찢어지지 않는다
  const dried = run(run(s, 'MARK_FRONT').state, 'DRY_PAPER').state;
  assert.equal(run(dried, 'MEASURE').outcome, 'ok');
  // 찢어졌어도 새것을 꺼내 이어 갈 수 있다
  assert.equal(run(r.state, 'NEW_PAPER').state.paper.torn, false);
});

test('색소를 안 실은 종이에도 전개액은 오른다 — 갈라질 것이 없을 뿐이다', () => {
  let s = run(S0(), 'DRAW_ORIGIN', {}).state;
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  const r = run(s, 'INSERT_PAPER');
  assert.equal(r.tag, 'no-spots');
  s = tickUntilFront(r.state, 50);
  assert.ok(currentFrontMm(s.paper) >= 50);
  assert.equal(pigmentLoad(s.paper), 0);
});

/* ------------------------------------------------------------------ *
 * 끝까지 갔는데 아무 말이 없던 자리
 *
 * **막지 않고 말만 붙인다.** 계속 흔들 수도, 계속 기다릴 수도 있다 — 다만 값이 더는
 * 안 움직이는 순간에 **한 번** 말한다. 매번 말하면 잔소리가 되고, 그러면 학생이
 * 문구 자체를 안 읽는다.
 *
 * 세 가지를 잰다:
 *   ① 끝에 닿는 순간 말이 나온다
 *   ② **그 말대로 따라가면 실제로 맞는다** — 말만 그럴듯하면 안 된다
 *   ③ **그 뒤로는 안 한다**
 *
 * (허브 세션이 micrometer 의 미동나사에서 찾아 돌려 줬다.)
 * ------------------------------------------------------------------ */

/** 잎과 추출액이 든 원심관. 흔들기만 남은 상태. */
function tubeReady() {
  let s = initialState(1);
  s = run(s, 'ADD_LEAF', { kind: LEAF_KINDS.FRESH, amount: 0.5 }).state;
  s = run(s, 'ADD_EXTRACT', { amount: 0.5 }).state;
  return s;
}

test('다 뽑힌 순간 한 번 말한다 — 그 전에도 그 뒤에도 조용하다', () => {
  let s = tubeReady();
  const said = [];
  let sawFullBefore = false;
  for (let i = 1; i <= 30; i++) {
    const before = extractStrength(s.tube);
    const r = run(s, 'SHAKE', { amount: 0.2 });
    s = r.state;
    if (r.message) said.push({ i, before, msg: r.message });
    if (extractStrength(s.tube) >= 1) sawFullBefore = true;
  }
  assert.ok(sawFullBefore, '서른 번을 흔들어도 안 차면 이 검사가 헛돈다');
  assert.equal(said.length, 1, `말이 ${said.length}번 나왔다 — 한 번이어야 한다: ${JSON.stringify(said)}`);
  // ① 끝에 닿는 그 회차여야 한다. 한 번이기만 하면 아무 데서나 나와도 되는 것이 아니다.
  assert.ok(said[0].before < 1, '아직 안 찼을 때 말해야 한다 — 차고 난 뒤에 말하면 한 박자 늦다');
  assert.ok(/더 흔들어도/.test(said[0].msg), `무엇이 소용없는지 말하지 않는다: ${said[0].msg}`);
  // ② **말한 대로 하면 맞는가** — 「가라앉기를 기다렸다가 윗층을 씁니다」
  assert.ok(/가라앉/.test(said[0].msg), '다음에 할 일을 안 알려 준다');
  assert.equal(isSettled(s.tube), false, '방금 흔들었으니 아직 안 가라앉았다');
  for (let i = 0; i < 40; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(isSettled(s.tube), true, '말한 대로 기다렸는데 안 가라앉는다 — 그 말이 틀린 것이다');
});

test('용매 전선이 종이 끝에 닿는 순간 한 번 말한다 — 멈춰 세우지는 않는다', () => {
  let s = tubeReady();
  for (let i = 0; i < 8; i++) s = run(s, 'SHAKE', { amount: 0.2 }).state;
  for (let i = 0; i < 12; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  s = run(s, 'DRAW_ORIGIN', { heightMm: ORIGIN_MM, marker: MARKERS.PENCIL }).state;
  s = run(s, 'LOAD_CAPILLARY').state;
  for (let i = 0; i < 20; i++) { s = run(s, 'SPOT', { dwell: 0.2 }).state; s = run(s, 'DRY_SPOT').state; }
  s = run(s, 'POUR_SOLVENT', { mm: 5 }).state;
  s = run(s, 'INSERT_PAPER').state;
  s = run(s, 'CAP_VIAL').state;

  const said = [];
  let reached = false;
  for (let i = 1; i <= 60; i++) {
    const before = currentFrontMm(s.paper);
    const r = run(s, 'TICK', { seconds: 30 });
    s = r.state;
    if (r.message) said.push({ i, before, msg: r.message });
    if (currentFrontMm(s.paper) >= PAPER_H_MM) reached = true;
  }
  assert.ok(reached, '예순 번을 기다려도 전선이 끝에 안 닿으면 이 검사가 헛돈다');
  assert.equal(said.length, 1, `말이 ${said.length}번 나왔다 — 한 번이어야 한다: ${JSON.stringify(said)}`);
  assert.ok(said[0].before < PAPER_H_MM, '이미 끝에 닿은 뒤에 말했다 — 한 박자 늦다');

  // **멈춰 세우지 않는다.** 더 두면 전선이 끝을 넘어가고, 그것도 학생이 겪을 결과다.
  assert.equal(frontOverrun(s.paper), true,
    '계속 기다렸는데 전선이 끝을 안 넘는다 — 어딘가에서 막고 있다 (AGENTS.md §2.1)');

  // ② **말한 대로 하면 맞는가** — 「꺼내서 전선 자리를 표시하세요」
  assert.ok(/꺼내/.test(said[0].msg) && /표시/.test(said[0].msg),
    `다음에 할 일을 안 알려 준다: ${said[0].msg}`);
  const out = run(s, 'REMOVE_PAPER');
  assert.notEqual(out.outcome, 'blocked', '말한 대로 꺼내려 했는데 막혔다');
  const marked = run(out.state, 'MARK_FRONT');
  assert.notEqual(marked.outcome, 'blocked', '말한 대로 표시하려 했는데 막혔다');
});
