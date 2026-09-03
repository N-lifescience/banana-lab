/**
 * 규칙 엔진 테스트.
 *
 * 여기서 지키려는 것은 「기능이 도는가」가 아니라 **이 실험이 가르치려는 것이 살아 있는가**다.
 * 그래서 가장 많은 줄이 「하지 않는 것」에 쓰인다 — 막지 않는가, 대신 말해 주지 않는가.
 *
 * 화면을 띄우지 않고 판정되는 것만 넣는다. 그림이 예쁜가는 여기 없다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce, ACTIONS, BLOCKING_REASONS, TRANSIENT_ACTIONS } from '../src/sim/rules.js';
import { initialState, angleGap, ITEM_IDS } from '../src/sim/state.js';
import { umPerEyepieceDiv, EYEPIECE } from '../src/sim/optics.js';

const S0 = (level = 1) => initialState(level, 20260826);
const run = (s, type, payload = {}) => reduce(s, { type, payload });

/** 접안렌즈를 돌려 두 눈금자를 나란히 맞춘다. 학생이 손으로 하는 일을 대신한다. */
function align(s) {
  for (let i = 0; i < 800 && angleGap(s) > 0.3; i++) {
    s = run(s, 'ROTATE_EYEPIECE', { deltaDeg: -0.5 }).state;
  }
  return s;
}

/** 눈금값을 한 번 구한다. 배율은 부르는 쪽이 미리 맞춰 둔다. */
function calibrate(s) {
  s = align(s);
  s = run(s, 'PICK_SCALE', { x: -0.6 }).state;
  s = run(s, 'PICK_SCALE', { x: 0.6 }).state;
  return run(s, 'RECORD_CALIBRATION').state;
}

/* ------------------------------------------------------------------ */
/* 이 실험의 물리                                                       */
/* ------------------------------------------------------------------ */

test('눈금값은 배율에 따라 정확히 4배로 갈린다', () => {
  // 이 실험이 가르치려는 것 전부가 이 한 줄에 있다.
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = run(s, 'FINE_FOCUS', { delta: 0 }).state;
  s = calibrate(s);
  const at100 = s.session.calibrations.at(-1);

  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  s = calibrate(s);
  const at400 = s.session.calibrations.at(-1);

  assert.equal(at100.umPerDiv, umPerEyepieceDiv(10));
  assert.equal(at400.umPerDiv, umPerEyepieceDiv(40));
  assert.equal(at100.umPerDiv / at400.umPerDiv, 4,
    '100배와 400배의 눈금값이 정확히 4배가 아니면 실험이 성립하지 않는다');
  // 기록마다 배율 도장이 찍힌다. 이것이 강제 없이 함정을 드러내는 장치다.
  assert.equal(at100.objective, 10);
  assert.equal(at400.objective, 40);
});

test('나란히 맞출수록 눈금값이 참값에 가까워진다 — 막지는 않는다', () => {
  // 정렬을 「맞았다/틀렸다」로 두면 화면이 할 수 있는 말이 "정렬하세요" 뿐이다.
  // 연속값이라 **덜 정확해질 뿐이고**, 그 거칢을 학생이 자기 숫자로 만난다.
  const err = (stopAt) => {
    let s = S0();
    s = run(s, 'INSERT_OCULAR').state;
    s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
    s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
    for (let i = 0; i < 800 && angleGap(s) > stopAt; i++) {
      s = run(s, 'ROTATE_EYEPIECE', { deltaDeg: -0.5 }).state;
    }
    s = run(s, 'PICK_SCALE', { x: -0.6 }).state;
    s = run(s, 'PICK_SCALE', { x: 0.6 }).state;
    s = run(s, 'RECORD_CALIBRATION').state;
    return Math.abs(s.session.calibrations.at(-1).umPerDiv - umPerEyepieceDiv(10));
  };
  const rough = err(12);
  const fine = err(0.3);
  assert.ok(rough > fine, `엉성하게 맞춘 쪽(${rough})이 잘 맞춘 쪽(${fine})보다 정확하면 안 된다`);
  assert.equal(fine, 0, '나란히 맞추면 참값이 나와야 한다');
});

/* ------------------------------------------------------------------ */
/* 하지 않는 것 — 이 실험의 핵심                                        */
/* ------------------------------------------------------------------ */

test('배율을 바꿀 때 눈금값에 대해 아무 말도 하지 않는다', () => {
  // 「배율을 바꿨으니 다시 구하세요」 한 문장이 학습 목표 전부를 대신 말해 버린다.
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = run(s, 'FINE_FOCUS', { delta: 0 }).state;
  s = calibrate(s);

  const r = run(s, 'SET_OBJECTIVE', { objective: 40 });
  for (const word of ['다시 구', '다시 측정', '무효', '만료', '더 이상', '유효하지']) {
    assert.equal(r.message.includes(word), false,
      `배율을 바꿀 때 "${word}" 라고 말하면 안 된다: ${r.message}`);
  }
  // 기존 기록에 딱지를 붙이지도 않는다.
  assert.deepEqual(r.state.session.calibrations, s.session.calibrations,
    '배율을 바꿨다고 이미 구한 눈금값을 건드리면 안 된다');
});

test('다른 배율의 눈금값을 골라도 막지 않고, 두 사실을 나란히 말한다', () => {
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = run(s, 'FINE_FOCUS', { delta: 0 }).state;
  s = calibrate(s);                                     // 100배 눈금값
  s = run(s, 'PLACE_ON_STAGE', { item: 'specimen' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  s = run(s, 'PICK_CELL', { x: -0.2 }).state;
  s = run(s, 'PICK_CELL', { x: 0.2 }).state;

  const r = run(s, 'RECORD_MEASUREMENT', { calibrationAt: 0 });
  assert.equal(r.outcome, 'happened', '막지 않는다');
  assert.equal(r.tag, 'calib-other-mag');
  assert.equal(r.state.session.measurements.length, 1, '그래도 기록된다');
  assert.ok(r.state.session.measurements[0].lengthUm > 0, '값도 나온다');
  // 두 배율을 사실로 말할 뿐, 틀렸다고 하지 않는다.
  assert.ok(r.message.includes(String(10 * EYEPIECE)) && r.message.includes(String(40 * EYEPIECE)));
  for (const word of ['틀렸', '잘못', '다시 하']) {
    assert.equal(r.message.includes(word), false, `"${word}" 라고 말하면 안 된다`);
  }
});

test('뒤집어 끼워도 값이 안 틀린다 — 읽기만 불편하다', () => {
  const value = (flipped) => {
    let s = S0();
    s = run(s, 'INSERT_OCULAR', { flipped }).state;
    s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
    s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
    return calibrate(s).session.calibrations.at(-1).umPerDiv;
  };
  assert.equal(value(true), value(false),
    '칸 간격이 같으므로 뒤집어 끼워도 값은 같아야 한다');
  assert.equal(run(S0(), 'INSERT_OCULAR', { flipped: true }).outcome, 'happened');
});

/* ------------------------------------------------------------------ */
/* 막지 않는 것들                                                       */
/* ------------------------------------------------------------------ */

test('순서를 강제하지 않는다 — 표본을 먼저 올려도 진행된다', () => {
  const r = run(S0(), 'PLACE_ON_STAGE', { item: 'specimen' });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.microscope.stage, 'specimen');
  assert.equal(r.tag, 'no-eyepiece-scale', '견줄 눈금이 없다는 것을 말해 준다');
});

test('겹치지 않은 자리를 찍어도 잡힌다 — 어긋남이 값에 섞인다', () => {
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  const r = run(s, 'PICK_SCALE', { x: 0.9 });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.picks.length, 1);
  assert.equal(typeof r.state.picks[0].gap, 'number', '어긋남이 기록으로 남는다');
});

test('대물 눈금이 한 칸도 안 들어가면 빈칸으로 기록된다 — 거부하지 않는다', () => {
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = align(s);
  // 같은 자리를 두 번 찍으면 구간이 0 이다.
  s = run(s, 'PICK_SCALE', { x: 0 }).state;
  s = run(s, 'PICK_SCALE', { x: 0 }).state;
  const r = run(s, 'RECORD_CALIBRATION');
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'zero-span');
  assert.equal(r.state.session.calibrations.at(-1).umPerDiv, null, '빈칸으로 남는다');
});

test('눈금값이 없어도 칸 수만으로 기록된다', () => {
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'specimen' }).state;
  s = run(s, 'PICK_CELL', { x: -0.2 }).state;
  s = run(s, 'PICK_CELL', { x: 0.2 }).state;
  const r = run(s, 'RECORD_MEASUREMENT', {});
  assert.equal(r.tag, 'no-calibration');
  const row = r.state.session.measurements[0];
  assert.ok(row.cellDivs > 0, '센 칸 수는 사실이므로 남는다');
  assert.equal(row.lengthUm, null);
});

/* ------------------------------------------------------------------ */
/* 하드 게이트 — 하나뿐                                                 */
/* ------------------------------------------------------------------ */

test('하드 게이트는 금 간 기구를 다시 올릴 때 하나뿐이다', () => {
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;

  // 조동나사를 돌리는 조작 자체는 막지 않는다. 돌아가고, 깨진다.
  const broke = run(s, 'COARSE_FOCUS', { delta: 0.3 });
  assert.equal(broke.outcome, 'happened', '조작을 막으면 안 된다');
  assert.equal(broke.tag, 'cracked');
  assert.equal(broke.state.items.stageMic.cracked, true);

  /**
   * ★ **깨진 것은 재물대에 그대로 있다** (사장님 지시 2026-09-03).
   *
   * 앞서는 여기서 규칙이 스스로 `stage: null` 로 내렸다. 그러면 학생이 보고 있던 것이
   * **말도 없이 사라진다** — 무엇이 어떻게 됐는지는 문장 한 줄로만 남는다.
   * 실물에서 깨진 유리는 재물대에 남는다. 내리는 것은 학생이 단추로 한다.
   */
  assert.equal(broke.state.microscope.stage, 'stageMic',
    '깨졌다고 화면이 스스로 내려놓습니다 — 학생이 보고 있던 것이 소리 없이 사라집니다');
  assert.ok(/재물대에서 내리기/.test(broke.message), '어떻게 내리는지 말하지 않습니다');

  // 학생이 내린다. 내린 것은 **현미경 옆**에 놓인다 — 선반의 제자리가 아니다.
  const down = run(broke.state, 'REMOVE_FROM_STAGE', {});
  assert.equal(down.state.microscope.stage, null);
  assert.equal(down.state.items.stageMic.unmounted, true,
    '내려놓은 자리 표시가 없습니다 — 실험대가 금 간 유리를 선반에 도로 꽂습니다');
  assert.ok(/쓰레기통/.test(down.message), '어디에 버리는지 말하지 않습니다');

  // 막히는 것은 그다음이다.
  const again = run(down.state, 'PLACE_ON_STAGE', { item: 'stageMic' });
  assert.equal(again.outcome, 'blocked');
  assert.equal(again.reason, BLOCKING_REASONS.BROKEN);
  assert.ok(/쓰레기통/.test(again.message), '막으면서 빠져나갈 길을 말하지 않습니다');

  // 쓰레기통에 버린다. 버린 것은 실험대에서 사라진다.
  const gone = run(again.state, 'DISCARD_ITEM', { item: 'stageMic' });
  assert.equal(gone.state.items.stageMic.discarded, true);

  // 그리고 반드시 빠져나갈 길이 있다. 없으면 결과가 아니라 막다른 길이다.
  const fresh = run(gone.state, 'NEW_ITEM', { item: 'stageMic' });
  assert.equal(fresh.state.items.stageMic.cracked, false);
  assert.equal(fresh.state.items.stageMic.discarded, false);
  assert.notEqual(run(fresh.state, 'PLACE_ON_STAGE', { item: 'stageMic' }).outcome, 'blocked');
});

/**
 * ★ **멀쩡한 것을 버려도 막지 않는다** (AGENTS.md §2.1).
 * 버려지고, 무슨 일이 일어났는지 말한다. 막으면 학생은 쓰레기통이 무엇을 받는 물건인지
 * 영영 모르고, 실물에도 그런 보호막은 없다.
 */
test('멀쩡한 것을 쓰레기통에 넣으면 막지 않고 결과로 답한다', () => {
  for (const id of ['stageMic', 'specimen']) {
    const r = run(S0(), 'DISCARD_ITEM', { item: id });
    assert.notEqual(r.outcome, 'blocked', '버리는 것을 막았습니다');
    assert.equal(r.state.items[id].discarded, true, '버렸다는데 그대로 남아 있습니다');
    assert.ok(/멀쩡한/.test(r.message), '멀쩡한 것을 버렸다는 사실을 말하지 않습니다');
    assert.ok(/새로 꺼내/.test(r.message), '어떻게 다시 얻는지 말하지 않습니다');
  }
});

/** 상자에 넣으면 실험대에서 사라지고, 꺼내면 돌아온다. 넣기만 있고 꺼내기가 없으면 안 된다. */
test('상자에 넣고 꺼내는 길이 둘 다 있다', () => {
  for (const id of ['stageMic', 'specimen']) {
    const put = run(S0(), 'PUT_AWAY_ITEM', { item: id });
    assert.equal(put.state.items[id].stowed, true);
    const out = run(put.state, 'TAKE_OUT_ITEM', { item: id });
    assert.equal(out.state.items[id].stowed, false);
  }
});

test('막는 결과는 이 하나뿐이다', () => {
  // 규칙을 하나 늘릴 때마다 막고 싶어진다. 여기서 셈이 늘면 사람에게 물어야 한다.
  const all = Object.values(ACTIONS).map((f) => f.toString()).join('\n');
  const blocks = all.match(/return blocked\(/g) ?? [];
  assert.equal(blocks.length, 1,
    `하드 게이트가 ${blocks.length}개다. AGENTS.md §2.1 을 읽고 사람에게 물어라`);
});

/* ------------------------------------------------------------------ */
/* 정상 경로 · 기록 · 되돌리기                                          */
/* ------------------------------------------------------------------ */

test('정상 경로: 끼우기부터 두 배율 측정까지 경고 하나 없이 끝난다', () => {
  let s = S0();
  const step = (type, payload) => {
    const r = run(s, type, payload);
    assert.equal(r.outcome, 'ok', `${type} 에서 정상 경로를 벗어났습니다: ${r.message}`);
    s = r.state;
  };

  step('INSERT_OCULAR', {});
  step('PLACE_ON_STAGE', { item: 'stageMic' });
  step('SET_OBJECTIVE', { objective: 10 });
  // **초점 맞추기는 정상 경로의 일부다.** 현미경은 초점이 어긋난 채로 시작한다.
  // 안 맞추면 CAPTURE 가 「흐린 채로 기록됐습니다」로 답한다 — 그게 옳다.
  step('COARSE_FOCUS', { delta: -s.microscope.coarse });
  step('FINE_FOCUS', { delta: -s.microscope.fine });
  s = align(s);
  step('PICK_SCALE', { x: -0.6 });
  step('PICK_SCALE', { x: 0.6 });
  step('RECORD_CALIBRATION', {});
  step('CAPTURE', {});

  step('PLACE_ON_STAGE', { item: 'specimen' });
  step('PICK_CELL', { x: -0.2 });
  step('PICK_CELL', { x: 0.2 });
  step('RECORD_MEASUREMENT', { calibrationAt: 0 });
  step('CAPTURE', {});

  const notOk = s.session.log.filter((e) => e.outcome !== 'ok');
  assert.deepEqual(notOk, [], '정상 경로에 뜻대로 안 된 조작이 하나라도 있으면 안 된다');
  assert.deepEqual(s.session.log.map((e) => e.at), s.session.log.map((_, i) => i));
});

test('기록 번호는 지워도 겹치지 않는다', () => {
  // 배열 인덱스로 지우면 앞엣것을 지운 순간 뒤엣것 번호가 밀려, 측정이 남의 눈금값을 가리킨다.
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = calibrate(s);
  s = calibrate(s);
  assert.deepEqual(s.session.calibrations.map((c) => c.at), [0, 1]);
  s = run(s, 'DELETE_CALIBRATION', { at: 0 }).state;
  s = calibrate(s);
  assert.deepEqual(s.session.calibrations.map((c) => c.at), [1, 2], '지운 번호를 다시 쓰면 안 된다');
});

test('눈금값을 지우면 그것을 쓰던 측정은 빈칸으로 되돌아간다 — 사라지지 않는다', () => {
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = calibrate(s);
  s = run(s, 'PLACE_ON_STAGE', { item: 'specimen' }).state;
  s = run(s, 'PICK_CELL', { x: -0.2 }).state;
  s = run(s, 'PICK_CELL', { x: 0.2 }).state;
  s = run(s, 'RECORD_MEASUREMENT', { calibrationAt: 0 }).state;

  const after = run(s, 'DELETE_CALIBRATION', { at: 0 }).state;
  assert.equal(after.session.measurements.length, 1, '학생이 센 칸 수는 여전히 사실이다');
  assert.equal(after.session.measurements[0].lengthUm, null);
  assert.equal(after.session.measurements[0].calibrationAt, null);
});

test('찍은 점을 지우는 데 되돌리기를 쓰지 않는다', () => {
  // 3단계의 한 번뿐인 되돌리기가 오타 지우기에 쓰이면 그 기능은 없는 것과 같다.
  assert.ok(TRANSIENT_ACTIONS.has('CLEAR_PICKS'));
  let s = S0(3);
  s = run(s, 'INSERT_OCULAR').state;
  s = run(s, 'PLACE_ON_STAGE', { item: 'stageMic' }).state;
  const before = s.session.undosLeft;
  s = run(s, 'PICK_SCALE', { x: 0.2 }).state;
  s = run(s, 'CLEAR_PICKS').state;
  assert.equal(s.picks.length, 0);
  assert.equal(s.session.undosLeft, before, '되돌리기 횟수를 깎으면 안 된다');
});

/**
 * 가치·태도를 **지켜보지 않는다.**
 *
 * 앞서는 정리 넷을 세어 자기 평가에 ✓/✗ 로 적었다. 그러다 두 번 거짓말을 했고
 * (아무것도 안 했는데 넷 다 ✓ · 고치고 나니 시작하자마자 둘이 ✗), 더 근본적으로는
 * **화면 속 단추를 눌렀다는 사실을 평가하는 일**이었다. 판정을 통째로 걷어냈다.
 *
 * 검사를 지우지 않고 **뜻을 바꾼다** — 「제대로 세는가」에서 「세지 않는가」로.
 * 지우면 나중에 누가 슬그머니 다시 넣어도 아무도 모른다.
 */
test('안전 규칙을 지켜보는 장치가 하나도 없다', () => {
  const gone = ['CHECK_TIDY', 'NOTE_VIOLATION', 'LAMP_OFF', 'LOWER_OBJECTIVE', 'PUT_AWAY_SPECIMEN'];
  for (const type of gone) {
    assert.equal(type in ACTIONS, false,
      `${type} 이 아직 있습니다 — 안전 규칙 준수는 지켜보지 않고 적어 두기만 합니다`);
  }
  const s = S0();
  assert.equal('violations' in s.session, false, 'session.violations 가 아직 있습니다');
  assert.equal('tidy' in s.session, false, 'session.tidy 가 아직 있습니다');
});

test('제자리에 넣는 조작은 남아 있고, 넣고 꺼내는 길이 둘 다 열려 있다', () => {
  // ★ **말없이 먹통인 물건을 남기지 않는다.** 원판에는 통이라는 제자리가 실제로 있고,
  //   넣는 길을 지우면 통이 눌러도 아무 일도 안 나는 물건이 된다.
  //   다만 그것을 **세지 않는다** — 점수도 기록도 아니다.
  let s = S0();
  s = run(s, 'INSERT_OCULAR').state;
  const away = run(s, 'PUT_AWAY_OCULAR');
  assert.equal(away.state.eyepiece.stowed, true, '통에 넣는 길이 막혔습니다');
  assert.ok(away.message, '넣었는데 화면이 아무 말도 안 합니다');
  const out = run(away.state, 'TAKE_OUT_OCULAR');
  assert.equal(out.state.eyepiece.stowed, false, '통에서 꺼내는 길이 막혔습니다');
  assert.ok(out.message, '꺼냈는데 화면이 아무 말도 안 합니다');
});

test('아무 액션에나 빈 payload 를 줘도 터지지 않는다', () => {
  // 화면이 실수로 payload 를 빠뜨리면 앱이 통째로 멈춘다. 규칙이 스스로 막아야 한다.
  const s = S0();
  for (const type of Object.keys(ACTIONS)) {
    assert.doesNotThrow(() => run(s, type, {}), `${type} 이 빈 payload 에서 터집니다`);
  }
  for (const item of [...ITEM_IDS, 'nonsense', null, undefined]) {
    assert.doesNotThrow(() => run(s, 'PLACE_ON_STAGE', { item }));
    assert.doesNotThrow(() => run(s, 'NEW_ITEM', { item }));
  }
});

test('막힘은 빠져나갈 길까지 말한다', () => {
  // 막히는 것은 이 실험에 둘뿐이다. 둘 다 이유만 말하고 길을 안 말하면 거기서 실험이 끝난다 —
  // 실제로 「새것을 꺼내세요」 만 보고 같은 곳에 계속 끌어다 놓다가 손을 뗀 일이 있었다.
  let st = initialState(1);
  for (const a of [['INSERT_OCULAR'], ['PLACE_ON_STAGE', { item: 'stageMic' }],
                   ['SET_OBJECTIVE', { objective: 40 }], ['COARSE_FOCUS', { delta: 0.1 }]]) {
    st = reduce(st, { type: a[0], payload: a[1] ?? {} }).state;
  }
  assert.ok(st.items.stageMic.cracked, '고배율에서 조동나사를 돌렸는데 금이 안 갔습니다');

  const r = reduce(st, { type: 'PLACE_ON_STAGE', payload: { item: 'stageMic' } });
  assert.equal(r.outcome, 'blocked');
  assert.ok(r.message.includes('보관함'),
    `막힘 문장이 어디로 가야 하는지 말하지 않습니다: ${r.message}`);
});

test('접안 마이크로미터는 통 밖에 꺼내진 채로 시작한다', () => {
  // 통만 놓여 있으면 학생은 통을 현미경에 끌어다 놓는다 — 통을 끼우는 그림이 되고,
  // 「렌즈 안에 들어가는 것은 원판」이라는 이 실험의 중심이 첫 조작부터 흐려진다.
  const st = initialState(1);
  assert.equal(st.eyepiece.stowed, false, '접안 마이크로미터가 통 안에서 시작합니다');
  assert.equal(st.eyepiece.micrometer, false, '끼워진 채로 시작하면 끼우는 단계가 사라집니다');

  // 넣으면 통 안, 다시 끼우면 통 밖. tidy 기록으로는 이 왕복을 못 담는다.
  const away = reduce(st, { type: 'PUT_AWAY_OCULAR', payload: {} }).state;
  assert.equal(away.eyepiece.stowed, true);
  const back = reduce(away, { type: 'INSERT_OCULAR', payload: {} }).state;
  assert.equal(back.eyepiece.stowed, false, '다시 꺼냈는데 통 안에 있다고 말합니다');
});
