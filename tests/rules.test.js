/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 테스트는 맨 아래 "하드 게이트는 두 종류뿐" 이다.
 * 누군가 조작을 막는 코드를 추가하면 여기서 잡힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, coverage, excess, isFloating, REAGENTS } from '../src/sim/state.js';
import { reduce, ACTIONS, bubblesFromAngle, BLOCKING_REASONS } from '../src/sim/rules.js';
import { observability } from '../src/sim/quality.js';

const S0 = () => initialState(1, 12345);

function run(state, type, payload) {
  return reduce(state, { type, payload });
}

/* ---------------- 방울 수 반응 곡선 ---------------- */

test('coverage 는 두 방울에서 1이 된다', () => {
  const mk = (drops) => ({ drops });
  assert.equal(coverage(mk(0)), 0);
  assert.equal(coverage(mk(1)), 0.5);
  assert.equal(coverage(mk(2)), 1);
  assert.equal(coverage(mk(5)), 1, '두 방울을 넘어도 도달 범위는 1을 넘지 않는다');
});

test('excess 는 세 방울부터 생기고 다섯 방울에서 1이 된다', () => {
  const mk = (drops) => ({ drops });
  assert.equal(excess(mk(2)), 0);
  assert.ok(Math.abs(excess(mk(3)) - 1 / 3) < 1e-9);
  assert.equal(excess(mk(5)), 1);
  assert.equal(isFloating(mk(5)), true, '다섯 방울이면 덮개 유리가 뜬다');
  assert.equal(isFloating(mk(3)), false);
});

test('한 방울만 떨어뜨려도 막히지 않고, 상태가 실제로 바뀐다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  const r = run(s, 'DROP', { slide: 'B', count: 1 });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.slides.B.drops, 1);
  assert.equal(coverage(r.state.slides.B), 0.5);
  assert.equal(r.tag, 'partial');
});

/* ---------------- 기포 ---------------- */

test('덮개 유리 각도가 기포 수를 만든다', () => {
  assert.equal(bubblesFromAngle(45), 0);
  assert.equal(bubblesFromAngle(40), 0, '35~55도 사이는 안전');
  assert.ok(bubblesFromAngle(90) >= 4, '수직으로 떨어뜨리면 기포가 많이 생긴다');
  assert.ok(bubblesFromAngle(0) >= 4, '완전히 눕혀도 마찬가지');
});

/* ---------------- 강제하지 않는다 ---------------- */

test('덮개 유리 없이도 재물대에 올라간다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'A', thickness: 0.3 }).state;
  const r = run(s, 'MOUNT', { slide: 'A' });
  assert.notEqual(r.outcome, 'blocked', '막지 말고 결과로 답해야 한다');
  assert.equal(r.state.microscope.stage, 'A');
  assert.equal(r.tag, 'no-coverslip');
});

test('덮개 유리 없이 400배로 올리면 렌즈가 시료에 닿는다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'A', thickness: 0.3 }).state;
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  const r = run(s, 'SET_OBJECTIVE', { objective: 40 });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.slides.A.lensTouched, true);
  assert.equal(r.tag, 'lens-touched');
});

test('저배율을 건너뛰어도 막히지 않는다 — 초점 범위가 좁아질 뿐', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 }).state;
  s = run(s, 'MOUNT', { slide: 'B' }).state;
  const r = run(s, 'SET_OBJECTIVE', { objective: 40 });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.microscope.objective, 40);
  assert.equal(r.tag, 'skipped-low-mag');
});

test('흐린 상도 기록된다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 }).state;
  s = run(s, 'MOUNT', { slide: 'B' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  s = run(s, 'FINE_FOCUS', { delta: 0.2 }).state;   // 400배 허용 오차 0.03 을 크게 벗어난다
  const r = run(s, 'CAPTURE');
  assert.notEqual(r.outcome, 'blocked', '기록 자체를 막으면 안 된다');
  assert.equal(r.state.session.captures.length, 1);
  assert.equal(r.tag, 'blurry-capture');
});

/* ---------------- 파손: 허용된 하드 귀결 ---------------- */

test('고배율에서 조동나사를 돌리면 슬라이드가 깨진다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 }).state;
  s = run(s, 'MOUNT', { slide: 'B' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  const r = run(s, 'COARSE_FOCUS', { delta: 0.3 });
  assert.equal(r.state.slides.B.cracked, true);
  assert.equal(r.state.microscope.stage, null, '깨진 슬라이드는 재물대에서 내려온다');
  const again = run(r.state, 'MOUNT', { slide: 'B' });
  assert.equal(again.outcome, 'blocked');
  assert.equal(again.reason, BLOCKING_REASONS.BROKEN);
});

/* ---------------- 교차 오염 ---------------- */

test('씻지 않은 스포이트로 다른 시약을 쓰면 오염된다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  s = run(s, 'DROP', { slide: 'B', count: 2 }).state;
  const filled = run(s, 'FILL_DROPPER', { reagent: REAGENTS.SUDAN });
  assert.equal(filled.tag, 'cross-contamination');
  const r = run(filled.state, 'DROP', { slide: 'B', count: 1 });
  assert.equal(r.state.slides.B.contaminated, true);
  assert.notEqual(r.outcome, 'blocked');
});

/* ---------------- 관찰 가능성 ---------------- */

test('두 방울·초점·400배가 갖춰지면 100점, 조건이 나빠지면 내려간다', () => {
  const best = observability({ coverage: 1, excess: 0, focusErr: 0, brightness: 1, objective: 40 });
  assert.equal(best.score, 100);

  const oneDrop = observability({ coverage: 0.5, excess: 0, focusErr: 0, brightness: 1, objective: 40 });
  assert.ok(oneDrop.score < best.score && oneDrop.score > 50);

  const flooded = observability({ coverage: 1, excess: 1, focusErr: 0, brightness: 1, objective: 40 });
  assert.ok(flooded.score < oneDrop.score);

  const lowMag = observability({ coverage: 1, excess: 0, focusErr: 0, brightness: 1, objective: 4 });
  assert.equal(lowMag.worst, 'magnification', '무엇부터 고쳐야 하는지 알려 줘야 한다');
});

/* ---------------- 설계 원칙 회귀 테스트 ---------------- */

test('하드 게이트는 두 종류뿐이다', () => {
  const src = ACTIONS;
  // 모든 액션을 여러 상태에서 돌려 보고 blocked 가 나오면 사유를 확인한다
  const states = [S0()];
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.9 }).state;
  states.push(s);
  s = run(s, 'MOUNT', { slide: 'B' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  s = run(s, 'COARSE_FOCUS', { delta: 0.4 }).state;
  states.push(s);

  const payloads = {
    SMEAR: { slide: 'B' }, FILL_DROPPER: { reagent: REAGENTS.IKI },
    DROP: { slide: 'B', count: 1 }, TICK: { seconds: 1 },
    PLACE_COVERSLIP: { slide: 'B', angleDeg: 70 }, MOUNT: { slide: 'B' },
    SET_OBJECTIVE: { objective: 40 }, COARSE_FOCUS: { delta: 0.2 },
    FINE_FOCUS: { delta: 0.05 }, SET_DIAPHRAGM: { value: 0.1 },
    NOTE_VIOLATION: { kind: 'cap-left-open' },
  };

  const allowed = new Set(Object.values(BLOCKING_REASONS));
  for (const st of states) {
    for (const type of Object.keys(src)) {
      const r = reduce(st, { type, payload: payloads[type] ?? {} });
      if (r.outcome === 'blocked') {
        assert.ok(allowed.has(r.reason),
          `${type} 이 허용되지 않은 사유로 차단했습니다: ${r.reason}. AGENTS.md §2.1 참조`);
      }
    }
  }
});

test('reduce 는 원본 상태를 바꾸지 않는다', () => {
  const s = S0();
  const before = JSON.stringify(s);
  run(s, 'PEEL_BANANA');
  run(s, 'SMEAR', { slide: 'A', thickness: 0.9 });
  assert.equal(JSON.stringify(s), before, 'reduce 는 순수 함수여야 합니다');
});
