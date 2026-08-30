/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 테스트는 맨 아래 **"하드 게이트는 두 종류뿐"** 과
 * **"막을 때는 빠져나갈 길을 문장에 담는다"** 이다.
 * 누군가 조작을 막는 코드를 추가하면 여기서 잡힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, tubeParams, columnLength, imbalanceOf, isSpinning, separation,
  isClotted, rhythmQuality, weakestSeal, isSealed, sampleSlot,
  TUBE_KINDS, SLOT_ITEMS, SLOTS, ENDS, PRESS_BREAK, PRESS_GOOD,
  ANGLE_BEST_DEG, HISTORY_LIMIT, UNDO_LIMITS,
} from '../src/sim/state.js';
import { reduce, ACTIONS, BLOCKING_REASONS, TRANSIENT_ACTIONS } from '../src/sim/rules.js';
import { observability } from '../src/sim/quality.js';
import { HEMATOCRIT, beatRate, MAX_SPEED } from '../src/sim/spin.js';

const S0 = () => initialState(1, 12345);

function run(state, type, payload) {
  return reduce(state, { type, payload });
}

/**
 * 모든 액션을 훑는 회귀 테스트에 쓰는 인자표.
 *
 * **한 곳에서만 적는다** — 여기 없는 액션은 인자 없이도 돌아야 한다는 뜻이다.
 * 두 곳에 따로 적으면 액션을 하나 늘릴 때마다 한쪽만 고치게 된다.
 */
const FUZZ = {
  PICK_CAPILLARY: { kind: TUBE_KINDS.PLAIN },
  DRAW_BLOOD: { angleDeg: 70, dwell: 0.5 },
  SEAL_END: { end: ENDS.OUTER, press: 0.7 },
  PEEL_CLAY: { end: ENDS.OUTER },
  LOAD_ROTOR: { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE },
  SEAT: { slot: SLOTS.A, depth: 0.4 },
  PULL: { strength: 0.8 },
  UNLOAD: { slot: SLOTS.A },
  TICK: { seconds: 1 },
  NEW_CAPILLARY: { kind: TUBE_KINDS.HEPARIN },
  DELETE_CAPTURE: { at: 0 },
  MARK_READ: { stage: '1' },
  SAVE_NOTE: { step: '1a', text: 'x' },
};

/** 절차를 지켜 혈액이 든 모세관을 만든다 */
function loadedTube(state = S0(), kind = TUBE_KINDS.HEPARIN) {
  let s = state;
  if (kind !== TUBE_KINDS.HEPARIN) s = run(s, 'NEW_CAPILLARY', { kind }).state;
  s = run(s, 'SWAB_FINGER').state;
  s = run(s, 'PRICK_FINGER').state;
  s = run(s, 'DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.9 }).state;
  s = run(s, 'PRICK_FINGER').state;
  s = run(s, 'DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.9 }).state;
  s = run(s, 'SEAL_END', { end: ENDS.OUTER, press: 0.75 }).state;
  s = run(s, 'SEAL_END', { end: ENDS.INNER, press: 0.75 }).state;
  return s;
}

/** 회전판에 물리고 균형까지 맞춘다 */
function onRotor(state = loadedTube()) {
  let s = run(state, 'LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE }).state;
  s = run(s, 'LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER }).state;
  return s;
}

/**
 * 박자에 맞춰 n 번 당긴다. 한 번 당길 때마다 한 박자만큼 시간을 흘린다.
 * `off` 를 주면 그만큼 어긋나게 기다린다.
 */
function pullTimes(state, n, { strength = 1, off = 0 } = {}) {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = run(s, 'PULL', { strength }).state;
    const period = 1 / beatRate(s.rotor.speed);
    s = run(s, 'TICK', { seconds: period * (1 + off), speed: 1 }).state;
  }
  return s;
}

/** 회전이 멎을 때까지 시간을 돌린다 */
function tickUntilStopped(state) {
  let s = state;
  for (let i = 0; i < 200; i++) {
    if (!isSpinning(s.rotor)) return s;
    s = run(s, 'TICK', { seconds: 0.4, speed: 1 }).state;
  }
  throw new Error('회전이 멎지 않았습니다. TICK 이 감쇠를 못 하고 있습니다.');
}

/* ================================================================== */
/* 채혈                                                                */
/* ================================================================== */

test('소독을 건너뛰어도 막히지 않는다 — 그 자리에서 말해 줄 뿐이다', () => {
  // **세지 않는다.** 안전 수칙은 2쪽에 적어 두기만 하고 앱은 확인하지 않는다.
  // 다만 그때 무슨 일이 일어났는지는 말해 준다 — 화면이 아무 말도 안 하면 안 된다.
  const r = run(S0(), 'PRICK_FINGER');
  assert.notEqual(r.outcome, 'blocked', '소독을 안 했다고 채혈을 막으면 이 방식이 아니다');
  assert.ok(r.state.finger.drop > 0, '진행은 돼야 한다');
  assert.match(r.message ?? '', /소독하지 않은/, '무슨 일이 일어났는지 말해 주지 않습니다');
  assert.equal('violations' in r.state.session, false, '안전 기록을 아직 세고 있습니다');
});

test('쓴 채혈침을 다시 써도 막지 않는다', () => {
  let s = run(S0(), 'SWAB_FINGER').state;
  s = run(s, 'PRICK_FINGER').state;
  const again = run(s, 'PRICK_FINGER');
  assert.notEqual(again.outcome, 'blocked');
  assert.match(again.message ?? '', /다시 썼습니다/);
});

/* ================================================================== */
/* 빨아올리기 — 각도가 변인이다                                        */
/* ================================================================== */

test('비스듬히 대면 잘 들어오고, 세워서 대면 기포가 낀다', () => {
  let base = run(run(S0(), 'SWAB_FINGER').state, 'PRICK_FINGER').state;
  const good = run(base, 'DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.6 }).state;
  const steep = run(base, 'DRAW_BLOOD', { angleDeg: 0, dwell: 0.6 }).state;
  assert.ok(good.tube.fill > steep.tube.fill, '비스듬히 댄 쪽이 더 많이 들어와야 한다');
  assert.ok(steep.tube.bubbles > good.tube.bubbles, '세워서 대면 공기가 함께 들어온다');
});

test('세워서 대도 막지 않는다', () => {
  let s = run(run(S0(), 'SWAB_FINGER').state, 'PRICK_FINGER').state;
  const r = run(s, 'DRAW_BLOOD', { angleDeg: 0, dwell: 0.6 });
  assert.notEqual(r.outcome, 'blocked');
  assert.ok(r.state.tube.fill > 0, '적게라도 들어와야 한다');
});

test('손끝에 오래 맺힌 피는 헤파린 모세관이라도 굳기 시작한 채로 들어온다', () => {
  let s = run(run(S0(), 'SWAB_FINGER').state, 'PRICK_FINGER').state;
  for (let i = 0; i < 20; i++) s = run(s, 'TICK', { seconds: 1, speed: 6 }).state;
  const r = run(s, 'DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.6 });
  assert.equal(r.state.tube.kind, TUBE_KINDS.HEPARIN);
  assert.ok(r.state.tube.clot > 0, '이미 굳기 시작한 피는 헤파린으로 되돌릴 수 없다');
  assert.equal(r.tag, 'aged-drop');
});

/* ================================================================== */
/* 헤파린 — 이 실험의 변인                                             */
/* ================================================================== */

test('헤파린이 없는 모세관을 골라도 막지 않는다', () => {
  const r = run(S0(), 'PICK_CAPILLARY', { kind: TUBE_KINDS.PLAIN });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.tools.pickKind, TUBE_KINDS.PLAIN);
});

test('헤파린이 없으면 시간이 갈수록 굳고, 있으면 굳지 않는다', () => {
  const tick = (s) => {
    for (let i = 0; i < 30; i++) s = run(s, 'TICK', { seconds: 1, speed: 6 }).state;
    return s;
  };
  const plain = tick(loadedTube(S0(), TUBE_KINDS.PLAIN));
  const hep = tick(loadedTube(S0(), TUBE_KINDS.HEPARIN));
  assert.ok(plain.tube.clot > 0, '헤파린 없는 관의 혈액이 굳지 않으면 변인이 아니다');
  assert.equal(hep.tube.clot, 0, '헤파린이 발린 관은 굳지 않는다');
});

test('굳은 혈액은 아무리 돌려도 층이 안 갈린다 — 그때 위층은 혈청이다', () => {
  let s = loadedTube(S0(), TUBE_KINDS.PLAIN);
  for (let i = 0; i < 90; i++) s = run(s, 'TICK', { seconds: 1, speed: 6 }).state;
  assert.ok(isClotted(s.tube), '충분히 두면 굳어야 한다');
  s = pullTimes(onRotor(s), 30);
  s = tickUntilStopped(s);
  assert.ok(separation(s.tube) < 0.35, '굳었는데 깨끗하게 갈리면 틀린 그림이다');
  assert.equal(tubeParams(s).clotted, true, '위층의 이름이 혈청으로 바뀌어야 한다');
});

/* ================================================================== */
/* 밀봉                                                                */
/* ================================================================== */

test('얕게 막아도 막지 않는다 — 돌리면 샌다', () => {
  let s = loadedTube();
  s = run(s, 'PEEL_CLAY', { end: ENDS.OUTER }).state;
  const r = run(s, 'SEAL_END', { end: ENDS.OUTER, press: 0.2 });
  assert.notEqual(r.outcome, 'blocked');
  assert.ok(r.state.tube.seal.outer > 0 && r.state.tube.seal.outer < 0.6);

  const spun = tickUntilStopped(pullTimes(onRotor(r.state), 25));
  assert.ok(spun.tube.lost > 0.02, '얕게 막았는데 새지 않으면 결과가 답을 안 한 것이다');
});

test('꽉 막으면 새지 않는다', () => {
  const spun = tickUntilStopped(pullTimes(onRotor(loadedTube()), 25));
  assert.ok(spun.tube.lost < 1e-9, '제대로 막았는데 새면 절차를 지킨 학생이 손해를 본다');
});

test('너무 세게 누르면 부러진다 — 허용된 하드 게이트 둘 중 하나', () => {
  let s = loadedTube();
  s = run(s, 'PEEL_CLAY', { end: ENDS.OUTER }).state;
  const r = run(s, 'SEAL_END', { end: ENDS.OUTER, press: PRESS_BREAK });
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.reason, BLOCKING_REASONS.BROKEN);
  assert.equal(r.state.tube.broken, true);
});

test('고무찰흙을 떼면 다시 막을 수 있다 — 되돌아가는 길', () => {
  let s = loadedTube();
  s = run(s, 'PEEL_CLAY', { end: ENDS.INNER }).state;
  assert.equal(s.tube.seal.inner, 0);
  s = run(s, 'SEAL_END', { end: ENDS.INNER, press: 0.8 }).state;
  assert.ok(s.tube.seal.inner > 0.6);
});

/* ================================================================== */
/* 회전판과 균형                                                        */
/* ================================================================== */

test('반대쪽을 비운 채 돌려도 막지 않는다 — 흔들려서 층이 흐려진다', () => {
  const lone = run(loadedTube(), 'LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE }).state;
  assert.equal(imbalanceOf(lone.rotor), 1);
  const shaky = tickUntilStopped(pullTimes(lone, 25));
  const steady = tickUntilStopped(pullTimes(onRotor(), 25));
  assert.ok(shaky.tube.mixed > steady.tube.mixed, '흔들렸는데 안 섞이면 균형을 맞출 이유가 없다');
  assert.ok(tubeParams(shaky).sharpness < tubeParams(steady).sharpness);
});

test('넣은 깊이가 다르면 그만큼 어긋난다', () => {
  let s = onRotor();
  assert.equal(imbalanceOf(s.rotor), 0);
  s = run(s, 'SEAT', { slot: SLOTS.B, depth: 0.4 }).state;
  assert.ok(Math.abs(imbalanceOf(s.rotor) - 0.6) < 1e-9);
});

test('돌고 있으면 넣을 수 없다 — 빠져나갈 길이 문장에 있다', () => {
  // 균형을 안 맞춘 채 돌리다가 뒤늦게 빈 모세관을 넣으려는 자리다. 실제로 자주 나온다.
  const lone = run(loadedTube(), 'LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE }).state;
  const spinning = pullTimes(lone, 6);
  assert.ok(isSpinning(spinning.rotor));
  const r = run(spinning, 'LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER });
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.reason, BLOCKING_REASONS.IMPOSSIBLE);
  assert.match(r.message, /멈춘/, '어떻게 빠져나가는지가 문장에 있어야 한다');
});

test('돌고 있는 회전판에 손을 대면 모세관이 부러진다', () => {
  const spinning = pullTimes(onRotor(), 8);
  const r = run(spinning, 'UNLOAD', { slot: SLOTS.A });
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.reason, BLOCKING_REASONS.BROKEN);
  assert.equal(r.state.tube.broken, true);
  assert.match(r.message, /모세관 통/, '새것을 어디서 꺼내는지가 문장에 있어야 한다');
});

test('멈춘 뒤에는 그냥 꺼내진다', () => {
  let s = run(pullTimes(onRotor(), 8), 'STOP_ROTOR').state;
  assert.equal(isSpinning(s.rotor), false);
  const r = run(s, 'UNLOAD', { slot: SLOTS.A });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.tube.broken, false);
});

test('부러진 모세관에서 빠져나오는 길이 있다', () => {
  let s = loadedTube();
  s = run(s, 'PEEL_CLAY', { end: ENDS.OUTER }).state;
  s = run(s, 'SEAL_END', { end: ENDS.OUTER, press: 1 }).state;
  assert.equal(s.tube.broken, true);
  const r = run(s, 'NEW_CAPILLARY', {});
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.tube.broken, false);
  assert.equal(r.state.tube.fill, 0);
});

test('모세관은 바닥나지 않는다', () => {
  let s = S0();
  for (let i = 0; i < 60; i++) {
    const r = run(s, 'NEW_CAPILLARY', {});
    assert.notEqual(r.outcome, 'blocked', `${i}개째에서 막혔습니다 — 소모품이 바닥나면 막다른 길이다`);
    s = r.state;
  }
});

/* ================================================================== */
/* 당기는 리듬 — 이 실험의 몸통                                        */
/* ================================================================== */

test('박자에 맞춰 당기면 빨라지고, 어긋나게 당기면 그만큼 못 간다', () => {
  const good = pullTimes(onRotor(), 20, { off: 0 });
  const bad = pullTimes(onRotor(), 20, { off: 0.5 });
  assert.ok(good.rotor.speed > bad.rotor.speed,
    '리듬이 결과를 안 가르면 「리듬 있게」가 장식이 된다');
  assert.ok(rhythmQuality(good.rotor) > rhythmQuality(bad.rotor));
});

test('덜 돌리면 적혈구층을 실제보다 길게 재게 된다 — 과대평가', () => {
  const few = tickUntilStopped(pullTimes(onRotor(), 8));
  const many = tickUntilStopped(pullTimes(onRotor(), 30));
  const a = tubeParams(few);
  const b = tubeParams(many);
  assert.ok(a.packedOfColumn > b.packedOfColumn);
  assert.ok(b.packedOfColumn < a.packedOfColumn,
    '더 돌렸는데 붉은 부분이 안 줄면 그림이 거꾸로 간 것이다');
  assert.ok(Math.abs(b.packedOfColumn - HEMATOCRIT.male) < 0.06,
    '충분히 돌리면 참값 가까이 가야 한다');
});

test('약하게 당기면 덜 갈린다 — 막지는 않는다', () => {
  const soft = tickUntilStopped(pullTimes(onRotor(), 20, { strength: 0.25 }));
  const hard = tickUntilStopped(pullTimes(onRotor(), 20, { strength: 1 }));
  assert.ok(separation(soft.tube) < separation(hard.tube));
});

test('당김 횟수는 목표가 아니라 한 일의 기록이다', () => {
  const s = pullTimes(onRotor(), 5);
  assert.equal(s.rotor.pulls, 5);
  // 몇 번 당겨야 하는지를 규칙 엔진이 판정하지 않는다. 판정하는 것은 층뿐이다.
  const src = ACTIONS.PULL.toString();
  assert.ok(!/pulls\s*[<>]=?\s*\d/.test(src),
    'PULL 이 당김 횟수를 기준으로 무언가를 판정하고 있습니다 — 그 수는 [확인 필요] 입니다');
});

test('회전판이 비어 있어도 당길 수 있다', () => {
  const r = run(S0(), 'PULL', { strength: 1 });
  assert.notEqual(r.outcome, 'blocked');
});

/* ================================================================== */
/* 재기와 기록                                                         */
/* ================================================================== */

test('기포가 많으면 재기 어렵다고 말하되 막지는 않는다', () => {
  let s = run(run(S0(), 'SWAB_FINGER').state, 'PRICK_FINGER').state;
  s = run(s, 'DRAW_BLOOD', { angleDeg: 0, dwell: 1 }).state;
  s = run(s, 'PRICK_FINGER').state;
  s = run(s, 'DRAW_BLOOD', { angleDeg: 0, dwell: 1 }).state;
  const r = run(s, 'MEASURE');
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.tools.rulerPlaced, true);
  assert.equal(r.tag, 'bubbly');
});

test('흐린 결과도 기록된다', () => {
  const r = run(loadedTube(), 'CAPTURE');
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.session.captures.length, 1);
});

test('기록은 그 모세관을 다시 그릴 수 있는 값 한 벌이다', () => {
  const s = tickUntilStopped(pullTimes(onRotor(), 25));
  const cap = run(s, 'CAPTURE').state.session.captures[0];
  for (const k of Object.keys(tubeParams(s))) {
    assert.ok(k in cap, `기록에 ${k} 가 없습니다 — 그림을 되살릴 수 없습니다`);
  }
});

test('기록을 지우면 거기 딸린 답도 함께 지워진다', () => {
  let s = run(loadedTube(), 'CAPTURE').state;
  s = run(s, 'SAVE_NOTE', { step: 'hct.0', text: '45%' }).state;
  s = run(s, 'DELETE_CAPTURE', { at: 0 }).state;
  assert.equal(s.session.captures.length, 0);
  assert.equal(s.session.notes['hct.0'], undefined,
    '지운 기록의 답이 남아 있으면 다음 기록 칸에 쓴 적 없는 답이 들어간다');
});

/* ================================================================== */
/* 정리                                                                */
/* ================================================================== */

test('안전 수칙을 세는 액션이 아예 없다', () => {
  // 사장님 지시로 걷어냈다 — 억지로 정리를 시키는 것도, 그것을 세어 「지켰다/놓쳤다」 를
  // 말하는 것도 하지 않는다. 안내는 2쪽에 남고, **앱은 확인하지 않는다**고 밝힌다.
  for (const gone of ['CHECK_TIDY', 'WASH_HANDS', 'DISPOSE_LANCET', 'DISPOSE_TUBE',
    'WIPE_FINGER', 'NOTE_VIOLATION']) {
    assert.equal(ACTIONS[gone], undefined, `${gone} 이 아직 남아 있습니다`);
  }
  // 상태에도 남기지 않는다 — 남겨 두면 다음 사람이 그것을 살아 있는 값으로 읽는다.
  const st = S0();
  assert.equal('violations' in st.session, false);
  assert.equal('tidy' in st.session, false);
});

/* ================================================================== */
/* 되돌리기                                                            */
/* ================================================================== */

test('되돌리기는 한 조작 앞으로 간다', () => {
  let s = loadedTube();
  const before = s.tube.seal.outer;
  s = run(s, 'PEEL_CLAY', { end: ENDS.OUTER }).state;
  assert.equal(s.tube.seal.outer, 0);
  s = run(s, 'UNDO').state;
  assert.equal(s.tube.seal.outer, before);
});

test('시간이 흐르는 것은 되돌릴 조작이 아니다', () => {
  let s = onRotor();
  const depth = s.session.history.length;
  for (let i = 0; i < 30; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(s.session.history.length, depth,
    'TICK 이 기록을 밀어내면 되돌리기 1회짜리 3단계에서 그 한 번이 TICK 무르는 데 쓰인다');
});

test('당김은 하나하나가 조작이라 합치지 않는다', () => {
  let s = onRotor();
  const depth = s.session.history.length;
  s = run(s, 'PULL', { strength: 1 }).state;
  s = run(s, 'PULL', { strength: 1 }).state;
  assert.equal(s.session.history.length, depth + 2,
    '열 번 당긴 것을 한 번에 무르면 리듬을 고쳐 볼 수가 없다');
});

test('되돌리기 횟수를 다 써도 막지 않는다', () => {
  let s = initialState(3, 1);
  assert.equal(s.session.undosLeft, UNDO_LIMITS[3]);
  s = run(s, 'SWAB_FINGER').state;
  s = run(s, 'PRICK_FINGER').state;
  s = run(s, 'UNDO').state;
  const second = run(s, 'UNDO');
  assert.notEqual(second.outcome, 'blocked', '되돌리기 소진은 하드 게이트가 아니다');
});

/* ================================================================== */
/* 불변식                                                              */
/* ================================================================== */

test('reduce 는 원본 상태를 바꾸지 않는다', () => {
  const s = S0();
  const before = JSON.stringify(s);
  for (const type of Object.keys(ACTIONS)) reduce(s, { type, payload: FUZZ[type] ?? {} });
  assert.equal(JSON.stringify(s), before);
});

test('알 수 없는 액션은 조용히 넘어가지 않는다', () => {
  assert.throws(() => reduce(S0(), { type: 'NOPE' }), /알 수 없는 액션/);
});

test('되돌리기 기록은 한도를 넘지 않는다', () => {
  let s = S0();
  for (let i = 0; i < HISTORY_LIMIT * 3; i++) {
    s = run(s, i % 2 ? 'SEAL_END' : 'PEEL_CLAY',
      i % 2 ? { end: ENDS.INNER, press: 0.7 } : { end: ENDS.INNER }).state;
  }
  assert.ok(s.session.history.length <= HISTORY_LIMIT);
});

/* ================================================================== */
/* 하드 게이트 — 이 파일에서 가장 중요한 두 검사                        */
/* ================================================================== */

/** 여러 국면의 상태를 모아 둔다. 한 상태만 훑으면 대부분의 분기를 못 지나간다. */
function fuzzStates() {
  const states = [S0()];
  states.push(loadedTube());
  states.push(loadedTube(S0(), TUBE_KINDS.PLAIN));
  states.push(onRotor());
  states.push(pullTimes(onRotor(), 10));                    // 돌고 있는 중
  states.push(tickUntilStopped(pullTimes(onRotor(), 25)));  // 다 돌린 뒤
  // 부러진 모세관
  let broken = run(loadedTube(), 'PEEL_CLAY', { end: ENDS.OUTER }).state;
  broken = run(broken, 'SEAL_END', { end: ENDS.OUTER, press: 1 }).state;
  states.push(broken);
  return states;
}

test('하드 게이트는 두 종류뿐이다', () => {
  const allowed = new Set(Object.values(BLOCKING_REASONS));
  for (const st of fuzzStates()) {
    for (const type of Object.keys(ACTIONS)) {
      const r = reduce(st, { type, payload: FUZZ[type] ?? {} });
      if (r.outcome === 'blocked') {
        assert.ok(allowed.has(r.reason),
          `${type} 이 허용되지 않은 사유로 차단했습니다: ${r.reason}. AGENTS.md §2.1 참조`);
      }
    }
  }
});

test('막을 때는 빠져나갈 길을 문장에 담는다', () => {
  // 「새것을 꺼내세요」로는 **어디서** 꺼내는지 알 수 없다. 어디로 가야 하는지까지 말한다.
  // 막다른 길에 세워 놓고 문을 안 알려 주면, 막지 않는 것보다 나쁘다.
  const ways = /모세관 통|멈춘|감싸/;
  let seen = 0;
  for (const st of fuzzStates()) {
    for (const type of Object.keys(ACTIONS)) {
      const r = reduce(st, { type, payload: FUZZ[type] ?? {} });
      if (r.outcome !== 'blocked') continue;
      seen++;
      assert.ok(ways.test(r.message ?? ''),
        `${type} 이 막으면서 빠져나갈 길을 안 알려 줍니다: "${r.message}"`);
    }
  }
  assert.ok(seen > 0, '막히는 자리가 하나도 안 잡혔습니다 — 이 검사가 아무것도 안 보고 있습니다');
});

test('막힌 조작은 되돌리기 기록에 쌓이지 않는다', () => {
  // 막혀서 아무 일도 안 일어난 것을 무르면, 되돌리기 한 번이 헛돈다.
  let s = onRotor();
  s = pullTimes(s, 6);
  const depth = s.session.history.length;
  const r = run(s, 'LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.COUNTER });
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.state.session.history.length, depth);
});

/* ================================================================== */
/* 품질                                                                */
/* ================================================================== */

test('절차를 지키면 점수가 높고, 아무것도 안 하면 낮다', () => {
  const good = tickUntilStopped(pullTimes(onRotor(), 30));
  const measured = run(run(good, 'MEASURE').state, 'CAPTURE').state;
  assert.ok(observability(tubeParams(measured)).score > 80);
  assert.ok(observability(tubeParams(S0())).score < 40);
});

test('나무랄 것이 없으면 「가장 크게 깎이는 항목」이 없다', () => {
  const perfect = { separation: 1, mixed: 0, column: 1, bubbles: 0, clot: 0, rulerPlaced: true };
  assert.equal(observability(perfect).worst, null);
});

test('덜 갈린 것과 흔들려 섞인 것을 갈라 말한다', () => {
  const under = observability({ separation: 0.2, mixed: 0, column: 1, bubbles: 0, clot: 0, rulerPlaced: true });
  const shaken = observability({ separation: 1, mixed: 0.9, column: 1, bubbles: 0, clot: 0, rulerPlaced: true });
  assert.equal(under.worst, 'separation');
  assert.equal(shaken.worst, 'sharpness');
});
