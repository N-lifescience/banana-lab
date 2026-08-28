/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 테스트는 맨 아래 "하드 게이트는 두 종류뿐" 이다.
 * 누군가 조작을 막는 코드를 추가하면 여기서 잡힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, coverage, excess, isFloating, fieldParams,
  REAGENTS, SLIDE_IDS, HISTORY_LIMIT,
} from '../src/sim/state.js';
import { reduce, ACTIONS, bubblesFromAngle, BLOCKING_REASONS } from '../src/sim/rules.js';
import { observability } from '../src/sim/quality.js';
import { renderFOV } from '../src/render/fov.js';
import { PALETTE } from '../src/style/tokens.js';

const S0 = () => initialState(1, 12345);

function run(state, type, payload) {
  return reduce(state, { type, payload });
}

/**
 * 모든 액션을 훑는 회귀 테스트에 쓰는 인자표.
 *
 * 두 곳에 따로 적어 뒀더니 액션을 하나 늘릴 때마다 한쪽만 고치고 다른 쪽이
 * `state.slides[undefined]` 로 터졌다. 한 곳에서만 적는다 —
 * 여기 없는 액션은 인자 없이도 돌아야 한다는 뜻이다.
 */
function fuzzPayloads(slide) {
  return {
    SMEAR: { slide, thickness: 0.3 }, FILL_DROPPER: { reagent: REAGENTS.IKI },
    DROP: { slide, count: 1 }, TICK: { seconds: 1 },
    PLACE_COVERSLIP: { slide, angleDeg: 45 }, LIFT_COVERSLIP: { slide },
    RINSE_SLIDE: { slide }, MOUNT: { slide }, CLEAN_LENS: {},
    SET_OBJECTIVE: { objective: 40 }, COARSE_FOCUS: { delta: 0.2 },
    FINE_FOCUS: { delta: 0.05 }, SET_DIAPHRAGM: { value: 0.5 },
    SAVE_NOTE: { step: '1a', text: 'x' },
    MOVE_STAGE: { dx: 20, dy: 0 },
    NEW_SLIDE: { slide }, DELETE_CAPTURE: { at: 0 }, MARK_READ: { stage: '1' },
  };
}

/** 시약을 떨어뜨린 슬라이드의 색 변화가 끝날 때까지 시간을 돌린다 (R-07) */
function tickUntilReacted(state) {
  for (let i = 0; i < 10; i++) {
    const pending = SLIDE_IDS.some((id) => state.slides[id].stain && state.slides[id].reactionT < 1);
    if (!pending) return state;
    state = run(state, 'TICK', { seconds: 1 }).state;
  }
  throw new Error('색 변화가 끝나지 않았습니다. TICK 이 reactionT 를 올리지 못하고 있습니다.');
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
  // 방울 수를 재는 것은 **시약을 쓰는 슬라이드** 이야기다 (아래 대조군 테스트 참조).
  const p = { reagent: 'IKI', excess: 0, focusErr: 0, brightness: 1, objective: 40 };
  const best = observability({ ...p, coverage: 1 });
  assert.equal(best.score, 100);

  const oneDrop = observability({ ...p, coverage: 0.5 });
  assert.ok(oneDrop.score < best.score && oneDrop.score > 50);

  const flooded = observability({ ...p, coverage: 1, excess: 1 });
  assert.ok(flooded.score < oneDrop.score);

  const lowMag = observability({ ...p, coverage: 1, objective: 4 });
  assert.equal(lowMag.worst, 'magnification', '무엇부터 고쳐야 하는지 알려 줘야 한다');
});

test('대조군은 방울 수로 깎이지 않는다', () => {
  // (가) 에 아무것도 떨어뜨리지 않는 것이 **맞는 절차**다.
  // 그런데 방울 수를 그대로 재면 0방울이 55 % 감점이 되고, 화면은
  // "지금 가장 크게 깎이는 항목: 방울 수" 라고 말한다 —
  // 제대로 한 학생에게 화면이 틀린 것을 하라고 안내하는 꼴이 된다.
  const control = observability({
    reagent: null, coverage: 0, excess: 0, focusErr: 0, brightness: 1, objective: 40,
  });
  assert.equal(control.score, 100, '시약을 안 쓴 대조군도 온전히 볼 만해야 한다');
  assert.notEqual(control.worst, 'drops');

  // 시약을 쓴 슬라이드는 여전히 방울 수로 깎인다.
  const stained = observability({
    reagent: 'IKI', coverage: 0, excess: 0, focusErr: 0, brightness: 1, objective: 40,
  });
  assert.ok(stained.score < 100);
  assert.equal(stained.worst, 'drops');
});

/* ---------------- 정상 경로 통합 ---------------- */

test('정상 경로: 껍질부터 캡처 세 장까지 경고 하나 없이 끝난다', () => {
  let s = S0();
  const step = (type, payload) => {
    const r = run(s, type, payload);
    assert.equal(r.outcome, 'ok', `${type} 에서 정상 경로를 벗어났습니다: ${r.message}`);
    s = r.state;
    return r;
  };

  step('PEEL_BANANA');
  for (const id of SLIDE_IDS) step('SMEAR', { slide: id, thickness: 0.3 });

  // (나) 아이오딘 두 방울. 씻고 나서 (다) 수단 Ⅲ 두 방울 — 안 씻으면 R-06 이 돈다
  step('FILL_DROPPER', { reagent: REAGENTS.IKI });
  step('DROP', { slide: 'B', count: 2 });
  step('RINSE_DROPPER');
  step('FILL_DROPPER', { reagent: REAGENTS.SUDAN });
  step('DROP', { slide: 'C', count: 2 });

  // R-07 색 변화를 기다린다. 건너뛰면 PLACE_COVERSLIP 이 early-cover 를 붙인다
  s = tickUntilReacted(s);

  for (const id of SLIDE_IDS) {
    step('PICK_COVERSLIP');
    step('PLACE_COVERSLIP', { slide: id, angleDeg: 45 });
  }

  // 슬라이드를 바꿔 가며 저배율 초점 → 400배 → 기록. 세 번 올려야 세 장이 남는다
  const captureResults = SLIDE_IDS.map((id) => {
    step('SET_OBJECTIVE', { objective: 4 });
    step('MOUNT', { slide: id });
    step('COARSE_FOCUS', { delta: 0 });
    step('SET_OBJECTIVE', { objective: 40 });
    return step('CAPTURE');
  });

  assert.equal(s.session.captures.length, 3);
  assert.deepEqual(s.session.captures.map((c) => c.slide), ['A', 'B', 'C']);
  for (const r of captureResults) assert.equal(r.outcome, 'ok');

  // 예전에는 "태그가 하나도 없다" 로 봤다. 이제는 잘된 조작에도 태그가 붙는다 —
  // 무엇이 바뀌었는지 말해 주기 위해서다(rules.js 의 ok()). 그래서 태그가 아니라
  // **결과 종류**로 본다. 이쪽이 원래 지키려던 것에 더 가깝다: 정상 경로에서는
  // 뜻대로 안 된 일이 한 번도 일어나지 않는다.
  const notOk = s.session.log.filter((e) => e.outcome !== 'ok');
  assert.deepEqual(notOk, [], '정상 경로 전체에 뜻대로 안 된 조작이 하나라도 있으면 안 된다');
  assert.deepEqual(s.session.log.map((e) => e.at), s.session.log.map((_, i) => i));
});

test('되돌리기 기록은 제출 데이터에 들어가지 않는다', () => {
  let s = S0();
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 }).state;
  s = run(s, 'MOUNT', { slide: 'B' }).state;
  s = run(s, 'CAPTURE').state;

  assert.ok(s.session.history.length > 0, '세션 안에는 남아 있어야 한다');
  assert.ok(s.session.captures.every((c) => !('history' in c)));
  assert.ok(!('history' in fieldParams(s, 'B')));
});

/* ---------------- 실패 경로 — 전부 진행되고 태그로만 답한다 ---------------- */

test('두껍게 문지르면 진행되고 too-thick 이 붙는다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  const r = run(s, 'SMEAR', { slide: 'B', thickness: 0.9 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'too-thick');
  assert.equal(r.state.slides.B.sample.thickness, 0.9, '막지 말고 실제로 발라야 한다');
});

test('껍질을 안 벗기고 문지르면 과육이 묻지 않는다', () => {
  const r = run(S0(), 'SMEAR', { slide: 'B', thickness: 0.3 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.B.sample, null);
});

test('방울이 많으면 excess, 더 많으면 overflow 다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;

  const three = run(s, 'DROP', { slide: 'B', count: 3 });
  assert.equal(three.outcome, 'happened');
  assert.equal(three.tag, 'excess');

  const five = run(s, 'DROP', { slide: 'B', count: 5 });
  assert.equal(five.outcome, 'happened');
  assert.equal(five.tag, 'overflow');
  assert.equal(isFloating(five.state.slides.B), true, '넘치면 덮개 유리가 뜬다');
});

test('빈 스포이트로는 아무것도 떨어지지 않는다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  const r = run(s, 'DROP', { slide: 'B', count: 2 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.B.drops, 0);
});

test('덮개 유리를 덮은 뒤 떨어뜨리면 가장자리로 스며든다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  const r = run(s, 'DROP', { slide: 'B', count: 2 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'edge-seep');
});

test('색 변화 전에 덮으면 early-cover, 대조군은 붙지 않는다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'SMEAR', { slide: 'A', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  s = run(s, 'DROP', { slide: 'B', count: 2 }).state;

  s = run(s, 'PICK_COVERSLIP').state;
  const early = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  assert.equal(early.outcome, 'happened');
  assert.equal(early.tag, 'early-cover');
  assert.equal(early.state.slides.B.coverslip.placed, true, '막지 말고 덮어야 한다');

  // (가) 대조군은 시약이 없어 색이 변할 일이 없다. reactionT 만 보면 늘 이르게 덮은 셈이 된다
  s = run(s, 'PICK_COVERSLIP').state;
  const control = run(s, 'PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 });
  assert.equal(control.outcome, 'ok');
  assert.notEqual(control.tag, 'early-cover');
});

test('덮개 유리를 수직으로 떨어뜨리면 기포가 생긴다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  const r = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 90 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'bubbles');
  assert.equal(r.state.slides.B.coverslip.bubbles, bubblesFromAngle(90));
});

test('핀셋 없이 덮으려 하면 미끄러진다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  const r = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.B.coverslip.placed, false);
});

test('조리개를 닫으면 어두워진다 — 막지는 않는다', () => {
  let s = run(S0(), 'SET_OBJECTIVE', { objective: 40 }).state;
  const r = run(s, 'SET_DIAPHRAGM', { value: 0.1 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'dark');
  assert.equal(r.state.microscope.diaphragm, 0.1);
});

test('덮개 유리는 다시 들어내고 덮을 수 있다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  // 수직으로 떨어뜨려 기포를 만든다
  const bad = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 90 });
  assert.equal(bad.tag, 'bubbles');
  assert.ok(bad.state.slides.B.coverslip.bubbles > 0);

  const lifted = run(bad.state, 'LIFT_COVERSLIP', { slide: 'B' });
  assert.equal(lifted.state.slides.B.coverslip.placed, false);
  assert.equal(lifted.state.slides.B.coverslip.bubbles, 0, '들어내면 기포도 함께 사라진다');
  assert.equal(lifted.state.tools.forceps.holding, 'usedCoverslip', '들어낸 것은 핀셋에 남는다');

  // 한 번 쓴 덮개 유리는 다시 쓰지 않는다 — 막지는 않고 그렇게 답한다.
  const reuse = run(lifted.state, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  assert.equal(reuse.outcome, 'happened');
  assert.equal(reuse.tag, 'coverslip-used');
  assert.equal(reuse.state.slides.B.coverslip.placed, false);

  // 버리고 새것을 집으면 다시 덮인다.
  let s2 = run(lifted.state, 'DISCARD_COVERSLIP').state;
  assert.equal(s2.tools.forceps.holding, null);
  s2 = run(s2, 'PICK_COVERSLIP').state;
  const again = run(s2, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  assert.equal(again.outcome, 'ok');
  assert.equal(again.state.slides.B.coverslip.bubbles, 0);

  assert.equal(run(S0(), 'LIFT_COVERSLIP', { slide: 'A' }).outcome, 'happened',
    '덮여 있지 않아도 막지 않는다');
});

test('핀셋이 비었을 때의 안내가 실제로 닿는 상황을 말한다', () => {
  // 예전 문구는 "손으로 집으려 하니 미끄러집니다. 핀셋을 쓰세요" 였는데,
  // 여기 닿는 유일한 길이 핀셋을 가져다 대는 것이라 앞뒤가 맞지 않았다.
  const r = run(S0(), 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'forceps-empty');
  assert.ok(!r.message.includes('손으로'), `아직 옛 문구다: ${r.message}`);
});

test('더러워진 대물렌즈를 닦을 수 있다', () => {
  // 덮개 유리 없이 고배율로 올리면 렌즈가 시료에 닿는다. 여태 되돌릴 길이 없었다 —
  // 한 번의 실수로 현미경을 못 쓰게 만드는 것은 이 실험이 가르치려는 바가 아니다.
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'MOUNT', { slide: 'B' }).state;
  const dirty = run(s, 'SET_OBJECTIVE', { objective: 40 });
  assert.equal(dirty.tag, 'lens-touched');
  assert.equal(dirty.state.slides.B.lensTouched, true);

  const cleaned = run(dirty.state, 'CLEAN_LENS');
  assert.equal(cleaned.tag, 'lens-cleaned');
  assert.equal(cleaned.state.slides.B.lensTouched, false);
  // 렌즈만 닦는다. 슬라이드에 이미 생긴 일은 그대로다.
  assert.equal(cleaned.state.slides.B.sample.thickness, 0.3);

  assert.equal(run(cleaned.state, 'CLEAN_LENS').outcome, 'ok', '깨끗해도 막지 않는다');
});

test('받침 유리를 씻으면 처음으로 돌아간다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.9 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  s = run(s, 'DROP', { slide: 'B', count: 3 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 90 }).state;

  const washed = run(s, 'RINSE_SLIDE', { slide: 'B' });
  assert.equal(washed.outcome, 'ok');
  const b = washed.state.slides.B;
  assert.equal(b.sample, null);
  assert.equal(b.stain, null);
  assert.equal(b.drops, 0);
  assert.equal(b.reactionT, 0);
  assert.equal(b.coverslip.placed, false);
  assert.equal(b.coverslip.bubbles, 0);
  assert.equal(washed.state.slides.C.sample, null, '다른 받침 유리는 건드리지 않는다');

  // 금이 간 유리는 씻어도 그대로다 — 막지는 않는다.
  const cracked = { ...s, slides: { ...s.slides, C: { ...s.slides.C, cracked: true } } };
  const r = run(cracked, 'RINSE_SLIDE', { slide: 'C' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.C.cracked, true);
});

test('재물대에 잘못 올린 슬라이드는 되돌리기를 쓰지 않고 내릴 수 있다', () => {
  let s = run(S0(), 'MOUNT', { slide: 'B' }).state;
  assert.equal(s.microscope.stage, 'B');

  const before = s.session.undosLeft;
  const off = run(s, 'UNMOUNT');
  assert.equal(off.outcome, 'ok');
  assert.equal(off.state.microscope.stage, null);
  assert.equal(
    off.state.session.undosLeft, before,
    '내리는 데 되돌리기 횟수를 쓰면 2·3단계에서 실수 한 번이 조작 예산을 깎는다'
  );

  assert.equal(run(off.state, 'UNMOUNT').outcome, 'ok', '올린 것이 없으면 조용히 넘어간다');
});

/* ---------------- 안전 수칙 · 기록 ---------------- */

test('단계별 관찰 기록이 남는다', () => {
  const r = run(S0(), 'SAVE_NOTE', { step: '3b', text: '청람색 알갱이가 보인다' });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.session.notes['3b'], '청람색 알갱이가 보인다');

  const noStep = run(S0(), 'SAVE_NOTE', { text: '어느 단계인지 모른다' });
  assert.equal(noStep.outcome, 'happened');
  assert.deepEqual(noStep.state.session.notes, {});
});

test('로그에는 시각이 아니라 순번이 붙는다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'TICK', { seconds: 1 }).state;
  s = run(s, 'UNDO').state;
  assert.deepEqual(s.session.log.map((e) => e.at), [0, 1, 2]);
  assert.deepEqual(s.session.log.map((e) => e.action), ['PEEL_BANANA', 'TICK', 'UNDO']);
});

/* ---------------- 되돌리기 ---------------- */

test('난이도가 올라갈수록 되돌릴 수 있는 횟수가 줄어든다', () => {
  assert.equal(initialState(1).session.undosLeft, Infinity);
  assert.equal(initialState(2).session.undosLeft, 3);
  assert.equal(initialState(3).session.undosLeft, 1);
});

test('되돌리면 직전 상태로 돌아가고, 로그는 되돌리지 않는다', () => {
  let s = initialState(2, 12345);
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;

  const r = run(s, 'UNDO');
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'undo');
  assert.equal(r.state.slides.B.sample, null, '도포 이전으로 돌아간다');
  assert.equal(r.state.tools.banana.peeled, true, '그보다 앞선 조작은 남는다');
  assert.equal(r.state.session.undosLeft, 2);
  assert.equal(r.state.session.log.at(-1).action, 'UNDO', '되돌아보기용 기록은 남아야 한다');
  assert.equal(r.state.session.log.length, 3);
});

test('1단계는 되돌리기가 무제한이다', () => {
  let s = run(initialState(1, 12345), 'PEEL_BANANA').state;
  for (let i = 0; i < 5; i++) {
    s = run(s, 'SMEAR', { slide: 'B', thickness: 0.2 + i * 0.05 }).state;
  }
  for (let i = 0; i < 5; i++) {
    const r = run(s, 'UNDO');
    assert.equal(r.tag, 'undo', `${i + 1}번째 되돌리기가 실패했습니다`);
    s = r.state;
  }
  assert.equal(s.session.undosLeft, Infinity);
  assert.equal(s.slides.B.sample, null, '다섯 번 되돌리면 도포 이전이다');
});

test('되돌리기를 다 써도 막지 않고 알려 준다', () => {
  let s = run(initialState(3, 12345), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;

  const first = run(s, 'UNDO');
  assert.equal(first.tag, 'undo');
  assert.equal(first.state.session.undosLeft, 0);

  const second = run(first.state, 'UNDO');
  assert.notEqual(second.outcome, 'blocked', '되돌리기 소진은 하드 게이트가 아니다');
  assert.equal(second.tag, 'undo-exhausted');
  assert.equal(second.state.tools.banana.peeled, true, '상태는 그대로 둔다');
});

test('되돌릴 것이 없어도 막지 않는다', () => {
  const r = run(S0(), 'UNDO');
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.tag, 'undo-empty');
});

test('아무것도 바꾸지 못한 조작은 되돌리기 기록에 쌓이지 않는다', () => {
  // 껍질을 안 벗기고 문질렀다 — 진행은 됐지만 상태는 그대로다
  const r = run(S0(), 'SMEAR', { slide: 'B', thickness: 0.3 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.session.history.length, 0, '되돌리기가 헛돌면 안 된다');
});

test('시간이 흘러도 되돌리기 기록이 밀리지 않는다', () => {
  // TICK 은 1초마다 돈다. 이걸 기록에 쌓으면 20칸이 20초 만에 다 밀리고,
  // 되돌리기 1회짜리 3단계에서는 그 한 번이 TICK 을 무르는 데 쓰여 사라진다.
  let s = initialState(3, 777);
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  const before = s.session.history.length;

  for (let i = 0; i < 30; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(s.session.history.length, before, '시간 경과는 조작이 아니다');

  const r = run(s, 'UNDO');
  assert.equal(r.state.slides.B.sample, null, '되돌리기는 학생의 마지막 조작을 되돌려야 한다');
  assert.equal(r.state.tools.banana.peeled, true, '그보다 앞선 조작은 남는다');
});

test('시야를 둘러보는 것은 되돌릴 조작이 아니다', () => {
  let s = run(S0(), 'PEEL_BANANA').state;
  const before = s.session.history.length;
  for (let i = 0; i < 30; i++) s = run(s, 'MOVE_STAGE', { dx: 4, dy: 2 }).state;
  assert.equal(s.session.history.length, before, '드래그 한 번이 기록을 다 밀어내면 안 된다');
  assert.notEqual(s.microscope.panX, 0, '상태는 실제로 바뀌어야 한다');
});

test('연속 조작은 되돌리기 기록에서 하나로 합쳐진다', () => {
  // 슬라이더를 한 번 끄는 동안 input 이 수십 번 뜬다. 눈금 하나씩 무르는 것은 뜻이 없다.
  let s = run(S0(), 'PEEL_BANANA').state;
  const before = s.session.history.length;
  for (let i = 0; i < 20; i++) s = run(s, 'SET_DIAPHRAGM', { value: 0.9 - i * 0.04 }).state;
  assert.equal(s.session.history.length, before + 1, '끌기 한 번은 기록 한 칸이다');

  const r = run(s, 'UNDO');
  assert.equal(r.state.microscope.diaphragm, 0.6, '끌기 전 값으로 돌아간다');
});

test('되돌리기 기록은 20개까지만 쌓이고, 스냅샷이 스냅샷을 품지 않는다', () => {
  let s = run(initialState(1, 12345), 'PEEL_BANANA').state;
  for (let i = 0; i < 30; i++) {
    s = run(s, 'SMEAR', { slide: 'B', thickness: 0.1 + i * 0.01 }).state;
  }
  assert.equal(s.session.history.length, HISTORY_LIMIT);
  assert.ok(
    s.session.history.every((h) => h.session.history.length === 0),
    '스냅샷이 스냅샷을 품으면 상태가 지수적으로 커진다'
  );
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

  const payloads = { ...fuzzPayloads('B'), PLACE_COVERSLIP: { slide: 'B', angleDeg: 70 } };

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

test('시약이 없는 슬라이드는 몇 방울이 떨어져도 색이 나타나지 않는다', () => {
  // 앞서는 "방울이 있으면 반드시 stain 이 있다" 로 적혀 있었다. 물(REAGENTS.WATER)이
  // 생기면서 그 형태로는 성립하지 않는다 — 물은 봉입액이라 방울 수만 늘리고 stain 은
  // 비워 둔다. 지키려던 것은 애초에 **시약 없이 염색된 시야가 나오지 않는 것**이었으므로,
  // 그것을 그대로 검사한다. 시야 렌더러에 물어보는 편이 불변식보다 정확하다.
  const payloads = fuzzPayloads('A');
  const types = Object.keys(ACTIONS);
  // 시드로 순서를 정해 결정적으로 훑는다. Math.random() 을 쓰면 실패가 재현되지 않는다.
  let s = S0();
  for (let step = 0; step < 600; step++) {
    const type = types[(step * 7 + Math.floor(step / types.length) * 3) % types.length];
    s = run(s, type, payloads[type] ?? {}).state;
    for (const id of SLIDE_IDS) {
      if (s.slides[id].stain !== null) continue;
      const svg = renderFOV(fieldParams(s, id));
      assert.ok(!svg.includes(PALETTE.stainStarch[0]) && !svg.includes(PALETTE.stainLipid[0]),
        `${step}번째 ${type} 뒤 슬라이드 ${id} — 시약이 없는데 염색색이 나왔습니다`);
    }
  }
});

test('물은 방울 수만 늘리고 색을 내지 않는다', () => {
  // 교과서 절차의 봉입액이다. (가) 대조군이 대조군인 이유이기도 하다.
  let s = run(S0(), 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'A', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.WATER }).state;
  s = run(s, 'DROP', { slide: 'A', count: 2 }).state;
  assert.equal(s.slides.A.drops, 2, '물도 방울로 센다 — 넘치면 넘친다');
  assert.equal(s.slides.A.stain, null, '물이 검출 용액 자리를 차지하면 안 됩니다');
  assert.equal(coverage(s.slides.A), 1);
  s = tickUntilReacted(s);
  assert.equal(s.slides.A.reactionT, 0, '물은 반응하지 않습니다');
});

test('reduce 는 원본 상태를 바꾸지 않는다', () => {
  const s = S0();
  const before = JSON.stringify(s);
  run(s, 'PEEL_BANANA');
  run(s, 'SMEAR', { slide: 'A', thickness: 0.9 });
  assert.equal(JSON.stringify(s), before, 'reduce 는 순수 함수여야 합니다');
});
