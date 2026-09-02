/**
 * 규칙 엔진 테스트.
 *
 * 가장 중요한 테스트는 맨 아래 "하드 게이트는 두 종류뿐" 이다.
 * 누군가 조작을 막는 코드를 추가하면 여기서 잡힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, coverage, excess, isFloating, isTooThick, fieldParams,
  mediumPct, settled, focusError, SIDES, SLIDE_IDS, HISTORY_LIMIT,
} from '../src/sim/state.js';
import { focusTolerance } from '../src/sim/optics.js';
import { reduce, ACTIONS, bubblesFromAngle, BLOCKING_REASONS, UNCUT_MIN_THICKNESS } from '../src/sim/rules.js';
import { observability } from '../src/sim/quality.js';
import {
  CELL_SAP_PCT, SOLUTION_PCT, EXCHANGE_PER_WICK,
  protoplastRatio, plasmolysedFraction, isPlasmolysed,
} from '../src/sim/osmosis.js';
import { hash } from '../src/assets/geometry.js';
import { UI } from '../src/ui/strings.js';

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
    PEEL_EPIDERMIS: { side: SIDES.OUTER, thickness: 0.3 },
    PLACE_SAMPLE: { slide },
    FILL_DROPPER: { solution: 'S10' },
    DROP: { slide, count: 1 },
    APPLY_SOLUTION: { slide },
    WICK: { slide },
    TICK: { seconds: 1 },
    PLACE_COVERSLIP: { slide, angleDeg: 45 }, LIFT_COVERSLIP: { slide },
    RINSE_SLIDE: { slide }, MOUNT: { slide }, CLEAN_LENS: {},
    SET_OBJECTIVE: { objective: 40 }, COARSE_FOCUS: { delta: 0.2 },
    FINE_FOCUS: { delta: 0.05 }, SET_DIAPHRAGM: { value: 0.5 },
    SAVE_NOTE: { step: '1a', text: 'x' },
    MOVE_STAGE: { dx: 20, dy: 0 },
    NEW_SLIDE: { slide }, DELETE_CAPTURE: { at: 0 }, MARK_READ: { stage: '1' },
  };
}

/** 삼투가 평형에 닿을 때까지 시간을 돌린다 */
function tickUntilSettled(state) {
  for (let i = 0; i < 40; i++) {
    if (SLIDE_IDS.every((id) => settled(state.slides[id]))) return state;
    state = run(state, 'TICK', { seconds: 1, speed: 10 }).state;
  }
  throw new Error('삼투가 평형에 닿지 않았습니다. TICK 이 equivPct 를 옮기지 못하고 있습니다.');
}

/** 바깥쪽 표피를 얇게 벗겨 받침 유리에 올리고 증류수로 봉입해 덮은 슬라이드 */
function readySlide(state, slide = 'A') {
  let s = state;
  s = run(s, 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER, thickness: 0.28 }).state;
  s = run(s, 'PLACE_SAMPLE', { slide }).state;
  s = run(s, 'FILL_DROPPER', { solution: 'WATER' }).state;
  // 화면과 같은 길로 간다 — 고무를 누를 때마다 한 방울 (`src/ui/zoom.js`).
  // count:2 로 한 번에 떨어뜨리면 「첫 방울에 경고가 뜬다」를 정상 경로 검사가 못 본다.
  s = run(s, 'DROP', { slide, count: 1 }).state;
  s = run(s, 'DROP', { slide, count: 1 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide, angleDeg: 45 }).state;
  return s;
}

/** 덮개 유리 아래 용액을 끝까지 치환한다 (거름종이를 필요한 만큼 댄다) */
function exchangeTo(state, slide, solution) {
  let s = state;
  s = run(s, 'RINSE_DROPPER').state;
  s = run(s, 'FILL_DROPPER', { solution }).state;
  s = run(s, 'APPLY_SOLUTION', { slide }).state;
  for (let i = 0; i < Math.ceil(1 / EXCHANGE_PER_WICK); i++) {
    s = run(s, 'WICK', { slide }).state;
  }
  return s;
}

/* ---------------- 봉입액 방울 수 반응 곡선 ---------------- */

test('coverage 는 두 방울에서 1이 된다', () => {
  const mk = (drops) => ({ drops });
  assert.equal(coverage(mk(0)), 0);
  assert.equal(coverage(mk(1)), 0.5);
  assert.equal(coverage(mk(2)), 1);
  assert.equal(coverage(mk(4)), 1, '더 떨어뜨려도 1을 넘지 않는다');
});

test('excess 는 세 방울부터 오르고 다섯 방울에서 덮개 유리가 뜬다', () => {
  const mk = (drops) => ({ drops });
  assert.equal(excess(mk(2)), 0);
  assert.ok(excess(mk(3)) > 0);
  assert.equal(isFloating(mk(2)), false);
  assert.equal(isFloating(mk(5)), true);
});

/* ---------------- 기포 ---------------- */

test('45° 언저리에서는 기포가 생기지 않고 수직에서는 최대다', () => {
  assert.equal(bubblesFromAngle(45), 0);
  assert.equal(bubblesFromAngle(40), 0);
  assert.equal(bubblesFromAngle(55), 0);
  assert.ok(bubblesFromAngle(90) > bubblesFromAngle(70));
  assert.ok(bubblesFromAngle(0) > 0);
});

/* ---------------- R-01·R-02 칼집과 표피 ---------------- */

test('칼집 없이 벗기면 두껍게 딸려 온다 — 막지는 않는다', () => {
  const r = run(S0(), 'PEEL_EPIDERMIS', { side: SIDES.OUTER, thickness: 0.2 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'thick-peel');
  assert.equal(r.state.tools.epidermis.thickness, UNCUT_MIN_THICKNESS);
  assert.ok(r.state.tools.epidermis, '그래도 벗겨지기는 해야 한다');
});

test('칼집을 내고 벗기면 얇다. 칼집은 한 조각에 한 번 쓰인다', () => {
  let s = run(S0(), 'CUT_SCALE').state;
  assert.equal(s.tools.onion.cut, true);
  const r = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER, thickness: 0.28 });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.state.tools.epidermis.thickness, 0.28);
  assert.equal(r.state.tools.onion.cut, false, '다음 조각은 새로 칼집을 내야 한다');
});

test('안쪽 표피도 그대로 벗겨진다 — 막지 않는다', () => {
  let s = run(S0(), 'CUT_SCALE').state;
  const r = run(s, 'PEEL_EPIDERMIS', { side: SIDES.INNER });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.state.tools.epidermis.side, SIDES.INNER);
  // 문구가 "안쪽은 안 됩니다" 로 답을 먼저 말하면 안 된다.
  assert.equal(/안 됩|안됩|잘못|틀렸/.test(r.message), false, `문구가 답을 먼저 말합니다: ${r.message}`);
});

test('안쪽 표피는 관찰 가능성이 크게 깎이고, 그 이유가 표시된다', () => {
  const outer = observability({ side: SIDES.OUTER, objective: 10, coverage: 1, brightness: 1 });
  const inner = observability({ side: SIDES.INNER, objective: 10, coverage: 1, brightness: 1 });
  assert.ok(inner.score < outer.score / 2);
  assert.equal(inner.worst, 'side');
});

/* ---------------- R-03 올리기 ---------------- */

test('핀셋에 표피가 없으면 아무것도 올라가지 않는다', () => {
  const r = run(S0(), 'PLACE_SAMPLE', { slide: 'A' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.A.sample, null);
});

test('접혀 올라가도 막지 않는다', () => {
  let s = run(S0(), 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;
  const r = run(s, 'PLACE_SAMPLE', { slide: 'A', folded: true });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'folded');
  assert.equal(r.state.slides.A.sample.folded, true);
});

test('두껍게 벗긴 표피는 겹쳐 보이는 것으로 답한다', () => {
  let s = run(S0(), 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;   // 칼집 없이
  const r = run(s, 'PLACE_SAMPLE', { slide: 'A' });
  assert.equal(r.tag, 'too-thick');
  assert.equal(isTooThick(r.state.slides.A), true);
  assert.ok(observability(fieldParams(r.state, 'A')).factors.thickness < 1);
});

/* ---------------- R-04 스포이트 ---------------- */

test('씻지 않고 다른 용액을 채우면 나가는 농도가 이름표와 달라진다', () => {
  let s = run(S0(), 'FILL_DROPPER', { solution: 'S20' }).state;
  const r = run(s, 'FILL_DROPPER', { solution: 'S05' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'cross-contamination');
  assert.equal(r.state.tools.dropper.holds, 'S05');
  assert.equal(r.state.tools.dropper.pct, (20 + 5) / 2, '이름표는 5 % 인데 실제로는 더 진하다');
  assert.equal(r.state.tools.dropper.rinsed, false);
});

test('헹구면 남은 것이 없다', () => {
  let s = run(S0(), 'FILL_DROPPER', { solution: 'S20' }).state;
  s = run(s, 'RINSE_DROPPER').state;
  assert.equal(s.tools.dropper.holds, null);
  assert.equal(s.tools.dropper.pct, 0);
  assert.equal(s.tools.dropper.rinsed, true);
});

/* ---------------- R-05 봉입 ---------------- */

test('빈 스포이트로는 아무것도 떨어지지 않는다', () => {
  const r = run(S0(), 'DROP', { slide: 'A', count: 1 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.A.drops, 0);
});

test('한 방울만 떨어뜨려도 막지 않는다 — 일부만 잠긴다', () => {
  let s = run(S0(), 'FILL_DROPPER', { solution: 'WATER' }).state;
  const r = run(s, 'DROP', { slide: 'A', count: 1 });
  // **첫 방울은 경고가 아니다.** 화면은 고무를 누를 때마다 한 방울이라, 두 방울을 제대로
  // 떨어뜨리는 학생도 반드시 이 상태를 지난다. 빨간 말풍선이 뜨면 정상 경로에 경고가 뜬 것이다.
  assert.equal(r.outcome, 'ok', '첫 방울에 빨간 말풍선이 뜹니다 — 정상 경로 한가운데입니다');
  assert.equal(r.tag, 'partial');
  assert.ok(r.message && /더/.test(r.message), '한 방울 더 필요하다는 말이 있어야 한다');
  assert.equal(coverage(r.state.slides.A), 0.5);
});

test('화면처럼 한 방울씩 두 번 떨어뜨려도 경고가 없다', () => {
  // `readySlide` 는 count:2 로 한 번에 떨어뜨리는데, 실제 화면(`src/ui/zoom.js`)은
  // 고무를 누를 때마다 `count:1` 이다. 검사가 화면과 다른 길을 걸으면 여기서 뜨는
  // 경고를 영영 못 본다 — 실제로 그랬다 (osmosis 플레이테스트 2026-09-02).
  let s = run(S0(), 'FILL_DROPPER', { solution: 'WATER' }).state;
  const r1 = run(s, 'DROP', { slide: 'A', count: 1 });
  const r2 = run(r1.state, 'DROP', { slide: 'A', count: 1 });
  assert.equal(r1.outcome, 'ok');
  assert.equal(r2.outcome, 'ok');
  assert.equal(r2.state.slides.A.drops, 2);
});

test('다섯 방울은 넘쳐서 덮개 유리를 띄운다', () => {
  let s = run(S0(), 'FILL_DROPPER', { solution: 'WATER' }).state;
  const r = run(s, 'DROP', { slide: 'A', count: 5 });
  assert.equal(r.tag, 'overflow');
  assert.equal(isFloating(r.state.slides.A), true);
});

/* ---------------- R-09·R-10 치환 — 이 실험의 중심 ---------------- */

test('덮개 유리 한쪽에 용액을 대기만 하면 아래는 그대로다', () => {
  let s = readySlide(S0(), 'A');
  s = tickUntilSettled(s);
  const before = mediumPct(s.slides.A);
  s = run(s, 'RINSE_DROPPER').state;
  s = run(s, 'FILL_DROPPER', { solution: 'S20' }).state;
  const r = run(s, 'APPLY_SOLUTION', { slide: 'A' });

  assert.notEqual(r.outcome, 'blocked', '대는 것 자체를 막지 않는다');
  assert.equal(r.state.slides.A.pending.id, 'S20', '액은 가장자리에 고여 있다');
  assert.equal(r.state.slides.A.exchange, 0);
  assert.equal(mediumPct(r.state.slides.A), before, '아래 농도는 아직 그대로여야 한다');

  // 시간이 아무리 지나도 거름종이를 대기 전에는 세포가 변하지 않는다
  const later = tickUntilSettled(r.state);
  assert.equal(later.slides.A.equivPct, r.state.slides.A.equivPct);
});

test('거름종이를 한 번만 대면 섞인 농도가 된다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = run(s, 'RINSE_DROPPER').state;
  s = run(s, 'FILL_DROPPER', { solution: 'S20' }).state;
  s = run(s, 'APPLY_SOLUTION', { slide: 'A' }).state;
  const r = run(s, 'WICK', { slide: 'A' });

  // 한 번에 다 안 바뀌는 것이 정상이다. 여기서 경고를 띄우면 제대로 하는 학생이 매번 듣는다.
  assert.equal(r.outcome, 'ok');
  assert.equal(r.tag, 'wicking');
  const pct = mediumPct(r.state.slides.A);
  assert.ok(pct > 0 && pct < SOLUTION_PCT.S20, `섞인 농도라야 한다 — 지금 ${pct}`);
});

test('거름종이를 끝까지 대면 아래가 다 바뀐다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = exchangeTo(s, 'A', 'S20');
  assert.equal(s.slides.A.medium.id, 'S20');
  assert.equal(s.slides.A.pending, null);
  assert.equal(mediumPct(s.slides.A), SOLUTION_PCT.S20);
});

test('가장자리에 댈 용액이 없으면 빨아들일 것도 없다', () => {
  let s = readySlide(S0(), 'A');
  const r = run(s, 'WICK', { slide: 'A' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'nothing-to-wick');
  // 되돌아갈 길이 문장에 담겨 있어야 한다 — "새것을 꺼내세요" 로는 어디로 갈지 알 수 없다
  assert.ok(/반대쪽|대고|떨어/.test(r.message), `다음에 무엇을 할지가 없습니다: ${r.message}`);
});

test('덮개 유리가 없으면 치환이라는 것이 성립하지 않는다', () => {
  let s = run(S0(), 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;
  s = run(s, 'PLACE_SAMPLE', { slide: 'A' }).state;
  const r = run(s, 'WICK', { slide: 'A' });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'no-coverslip');
});

/* ---------------- R-11 삼투는 즉시가 아니다 ---------------- */

test('용액을 바꿔도 시간이 지나야 원형질체가 줄어든다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = exchangeTo(s, 'A', 'S20');
  assert.equal(s.slides.A.equivPct, 0, '바꾼 직후에는 아직 증류수와 평형이다');
  assert.equal(settled(s.slides.A), false);

  const mid = run(s, 'TICK', { seconds: 1, speed: 10 }).state;
  assert.ok(mid.slides.A.equivPct > 0 && mid.slides.A.equivPct < SOLUTION_PCT.S20,
    '한 틱 뒤에는 중간 상태여야 한다');

  const done = tickUntilSettled(mid);
  assert.equal(done.slides.A.equivPct, SOLUTION_PCT.S20);
});

test('증류수로 되돌리면 원형질체가 다시 퍼진다 — 원형질 분리 복귀', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = tickUntilSettled(exchangeTo(s, 'A', 'S20'));
  const shrunk = protoplastRatio(s.slides.A.equivPct, CELL_SAP_PCT);
  assert.ok(shrunk < 1, '설탕 용액에서는 줄어 있어야 한다');

  s = tickUntilSettled(exchangeTo(s, 'A', 'WATER'));
  const back = protoplastRatio(s.slides.A.equivPct, CELL_SAP_PCT);
  assert.equal(back, 1, '증류수로 돌아오면 세포벽까지 다시 찬다');
});

/* ---------------- 삼투 모형이 과학적으로 맞는가 ---------------- */

test('저장액에서는 세포벽이 버텨 터지지 않는다', () => {
  // 부피비가 1을 넘으면 「터진다」는 뜻이 된다. 식물세포에서는 있을 수 없다.
  for (const pct of [0, 1, 5, CELL_SAP_PCT - 0.1]) {
    assert.equal(protoplastRatio(pct, CELL_SAP_PCT), 1, `${pct} % 에서 부피비가 1이 아니다`);
  }
});

test('바깥이 진할수록 원형질체가 더 줄어든다', () => {
  const r = [15, 20, 30].map((pct) => protoplastRatio(pct, CELL_SAP_PCT));
  assert.ok(r[0] > r[1] && r[1] > r[2]);
  assert.ok(r.every((v) => v > 0 && v < 1));
});

test('한 시야 안에서도 세포마다 정도가 갈린다', () => {
  const h = (...ints) => hash(31337, ...ints);
  // 전부 같은 농도라면 「절반이 원형질분리를 일으키는 농도」 라는 판정이 성립하지 않는다.
  const f = [5, 10, 15, 20].map((pct) => plasmolysedFraction(pct, h));
  assert.ok(f.some((v) => v > 0 && v < 1), `중간 비율이 하나도 없습니다: ${f}`);
});

test('세포 절반이 원형질분리를 일으키는 농도가 10 %와 15 % 사이에 있다', () => {
  // 첫 칸이나 끝 칸에서 절반이 되면 5·10·15·20 % 4단 농도열을 고를 이유가 없어진다.
  const h = (...ints) => hash(31337, ...ints);
  assert.ok(plasmolysedFraction(10, h) < 0.5, '10 % 에서는 아직 절반이 안 된다');
  assert.ok(plasmolysedFraction(15, h) > 0.5, '15 % 에서는 절반을 넘는다');
  assert.equal(plasmolysedFraction(5, h), 0, '5 % 에서는 거의 일어나지 않는다');
  assert.ok(plasmolysedFraction(20, h) > 0.95, '20 % 에서는 거의 다 일어난다');
});

test('한계원형질분리 언저리가 부피비 판정과 어긋나지 않는다', () => {
  assert.equal(isPlasmolysed(1), false);
  assert.equal(isPlasmolysed(0.5), true);
});

/* ---------------- 화면이 답을 먼저 말하지 않는가 ---------------- */

test('세포액 농도가 화면 문자열 어디에도 숫자로 나오지 않는다', () => {
  // 이 숫자를 관찰로 추정하는 것이 이 실험의 탐구다. 화면이 먼저 말하면 탐구가 사라진다.
  const strings = [];
  (function walk(o, path) {
    if (typeof o === 'string') strings.push([path, o]);
    else if (typeof o === 'function') return;
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  })(UI, 'UI');

  const leak = new RegExp(`(^|[^0-9.])${CELL_SAP_PCT}\\s*%`);
  for (const [path, text] of strings) {
    assert.equal(leak.test(text), false, `${path} 가 세포액 농도를 흘립니다: "${text}"`);
  }
  // 병 이름표에 답이 적혀 있어도 안 된다.
  assert.equal(Object.values(SOLUTION_PCT).includes(CELL_SAP_PCT), false,
    '세포액 농도와 같은 농도의 용액을 두면 답이 선반에 놓여 있는 셈이 된다');
});

/* ---------------- R-06 덮개 유리 ---------------- */

test('빈 핀셋으로는 덮이지 않는다. 되돌아갈 길이 문장에 있다', () => {
  const r = run(S0(), 'PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 });
  assert.equal(r.outcome, 'happened');
  assert.ok(/덮개 유리 통/.test(r.message), `어디서 집는지가 없습니다: ${r.message}`);
});

test('수직으로 덮으면 기포가 생긴다 — 막지 않는다', () => {
  let s = run(S0(), 'PICK_COVERSLIP').state;
  const r = run(s, 'PLACE_COVERSLIP', { slide: 'A', angleDeg: 90 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'bubbles');
  assert.ok(r.state.slides.A.coverslip.bubbles > 0);
  assert.equal(r.state.slides.A.coverslip.placed, true, '그래도 덮이기는 한다');
});

test('한 번 쓴 덮개 유리는 다시 쓰지 않는다. 버릴 곳이 문장에 있다', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'LIFT_COVERSLIP', { slide: 'A' }).state;
  assert.equal(s.tools.forceps.holding, 'usedCoverslip');
  const r = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  assert.equal(r.outcome, 'happened');
  assert.ok(/쓰레기통/.test(r.message));
});

test('덮개 유리를 들어내면 가장자리에 고인 액도 사라진다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = run(s, 'RINSE_DROPPER').state;
  s = run(s, 'FILL_DROPPER', { solution: 'S15' }).state;
  s = run(s, 'APPLY_SOLUTION', { slide: 'A' }).state;
  const r = run(s, 'LIFT_COVERSLIP', { slide: 'A' });
  assert.equal(r.state.slides.A.pending, null);
  assert.equal(r.state.slides.A.exchange, 0);
});

/* ---------------- R-07·R-08 현미경 ---------------- */

test('덮개 유리 없이 올려도 막지 않는다. 고배율에서 렌즈가 닿는다', () => {
  let s = run(S0(), 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;
  s = run(s, 'PLACE_SAMPLE', { slide: 'A' }).state;
  const m = run(s, 'MOUNT', { slide: 'A' });
  assert.equal(m.outcome, 'happened');
  assert.equal(m.tag, 'no-coverslip');
  const z = run(m.state, 'SET_OBJECTIVE', { objective: 40 });
  assert.equal(z.tag, 'lens-touched');
  assert.equal(z.state.slides.A.lensTouched, true);
  // 되돌아갈 길이 있어야 한다
  const c = run(z.state, 'CLEAN_LENS');
  assert.equal(c.state.slides.A.lensTouched, false);
});

test('고배율에서 조동나사를 돌리면 슬라이드가 깨진다 — 허용된 하드 귀결', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  const r = run(s, 'COARSE_FOCUS', { delta: 0.3 });
  assert.equal(r.outcome, 'happened');
  assert.equal(r.state.slides.A.cracked, true);
  assert.equal(r.state.microscope.stage, null);

  // 깨진 것을 다시 올리려 할 때만 blocked 다. 그리고 되돌아갈 길이 문장에 있다.
  const again = run(r.state, 'MOUNT', { slide: 'A' });
  assert.equal(again.outcome, 'blocked');
  assert.equal(again.reason, BLOCKING_REASONS.BROKEN);
  assert.ok(/받침 유리 통/.test(again.message), `어디서 새것을 꺼내는지가 없습니다: ${again.message}`);

  // 씻어도 금은 남고, 통에서 새것을 꺼내면 살아난다
  assert.equal(run(r.state, 'RINSE_SLIDE', { slide: 'A' }).state.slides.A.cracked, true);
  assert.equal(run(r.state, 'NEW_SLIDE', { slide: 'A' }).state.slides.A.cracked, false);
});

test('저배율을 건너뛰어도 막지 않는다', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  const r = run(s, 'SET_OBJECTIVE', { objective: 40 });
  assert.notEqual(r.outcome, 'blocked');
  assert.equal(r.tag, 'skipped-low-mag');
  assert.equal(r.state.microscope.objective, 40);
});

test('재물대는 ±240 px 를 넘지 않지만 끝에 닿아도 막지 않는다', () => {
  let s = S0();
  for (let i = 0; i < 40; i++) s = run(s, 'MOVE_STAGE', { dx: 40 }).state;
  assert.equal(s.microscope.panX, 240);
  assert.equal(run(s, 'MOVE_STAGE', { dx: 40 }).outcome, 'ok');
});

/* ---------------- R-12 기록 ---------------- */

test('평형에 닿기 전에 기록해도 막지 않고, 그렇다고 말해 준다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'COARSE_FOCUS', { delta: -s.microscope.coarse }).state;   // 올리면 흐트러진 초점을 되돌린다
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = exchangeTo(s, 'A', 'S20');
  const r = run(s, 'CAPTURE');
  assert.equal(r.outcome, 'happened');
  assert.equal(r.tag, 'unsettled-capture');
  assert.equal(r.state.session.captures.length, 1, '그래도 기록은 남는다');
  assert.equal(r.state.session.captures[0].settled, false);
});

test('기록에는 원형질분리 세포의 비율이 들어 있지 않다', () => {
  // 그것을 시야에서 읽어 내는 것이 이 실험의 탐구다. 화면이 세어 주면 탐구가 사라진다.
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  const cap = run(s, 'CAPTURE').state.session.captures[0];
  for (const key of Object.keys(cap)) {
    assert.equal(/fraction|ratio|plasmoly|percent|answer/i.test(key), false,
      `기록이 답을 담고 있습니다: ${key}`);
  }
});

test('기록을 지우면 딸린 답도 함께 지워진다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'CAPTURE').state;
  s = run(s, 'CAPTURE').state;
  s = run(s, 'SAVE_NOTE', { step: 'mag.0', text: '100배' }).state;
  const r = run(s, 'DELETE_CAPTURE', { at: 0 });
  assert.equal(r.state.session.captures.length, 1);
  assert.equal(r.state.session.captures[0].at, 1, 'at 은 번호이지 순번이 아니다');
  assert.equal(r.state.session.notes['mag.0'], undefined);
});

/* ---------------- 정리 ---------------- */

/*
 * **안전·정리를 앱이 판정하지 않는다.**
 *
 * 예전에는 손 씻기·마개 닫기·폐액 버리기를 눌러서 하게 하고, 안 하면 자기 평가에 위반으로
 * 적었다. 두 가지가 틀렸다. 하나는 **거짓말을 했다** — 판정을 채우는 `CHECK_TIDY` 가
 * 「보고서 열기」를 누를 때만 도는데 자기 평가 쪽은 그 전에 보므로, 아무것도 안 한 학생에게
 * 「세 가지를 모두 지켰습니다」가 떴다. 다른 하나가 더 크다 — 가상 실험에서 그걸 따지면
 * **화면 속 단추를 눌렀다는 사실**을 평가하게 된다. 진짜 마개는 교실에서 닫는다.
 *
 * 그래서 액션도 상태도 걷어냈다. 되살아나면 여기가 빨간불이 된다.
 */
test('안전·정리를 판정하는 액션이 없다', () => {
  // `reduce` 는 모르는 액션에 예외를 던진다 (막힘이 아니다 — 막힘은 학생에게 하는 말이고,
  // 이건 코드가 잘못된 것이라 조용히 넘기면 안 된다).
  for (const a of ['CHECK_TIDY', 'WASH_HANDS', 'CLOSE_CAP', 'DISPOSE_WASTE', 'NOTE_VIOLATION']) {
    assert.throws(() => run(S0(), a), /알 수 없는 액션/, `${a} 가 아직 살아 있습니다`);
  }
});

test('상태에 안전 판정 기록이 없다', () => {
  const s = S0().session;
  assert.equal(s.violations, undefined, 'violations 가 남아 있습니다');
  assert.equal(s.tidy, undefined, 'tidy 가 남아 있습니다');
});

/* ---------------- 되돌리기 ---------------- */

test('난이도별 되돌리기 횟수가 실제로 다르다', () => {
  const undosLeft = (lv) => initialState(lv).session.undosLeft;
  assert.equal(undosLeft(1), Infinity);
  assert.equal(undosLeft(2), 3);
  assert.equal(undosLeft(3), 1);
});

test('되돌리기가 한 조작을 무른다', () => {
  let s = run(S0(), 'CUT_SCALE').state;
  s = run(s, 'PEEL_EPIDERMIS', { side: SIDES.OUTER }).state;
  const r = run(s, 'UNDO');
  assert.equal(r.state.tools.epidermis, null);
  assert.equal(r.state.tools.onion.cut, true, '칼집을 낸 데까지 돌아온다');
});

test('시간이 흐르는 것은 되돌리기 기록에 쌓이지 않는다', () => {
  let s = tickUntilSettled(readySlide(S0(), 'A'));
  const before = s.session.history.length;
  for (let i = 0; i < 30; i++) s = run(s, 'TICK', { seconds: 1 }).state;
  assert.equal(s.session.history.length, before, 'TICK 이 기록을 밀어내면 안 된다');
});

test('연속 조작은 한 번으로 합쳐진다', () => {
  let s = S0();
  s = run(s, 'SET_DIAPHRAGM', { value: 0.7 }).state;
  const after1 = s.session.history.length;
  for (let i = 0; i < 10; i++) s = run(s, 'SET_DIAPHRAGM', { value: 0.7 + i * 0.01 }).state;
  assert.equal(s.session.history.length, after1, '슬라이더 눈금마다 쌓이면 기록이 금세 밀린다');
});

test('되돌리기 기록은 상한을 넘지 않는다', () => {
  let s = S0();
  for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
    s = run(s, 'MARK_READ', { stage: String(i) }).state;
    s = run(s, 'SAVE_NOTE', { step: `s${i}`, text: String(i) }).state;
  }
  assert.ok(s.session.history.length <= HISTORY_LIMIT);
});

/* ---------------- 순수성 ---------------- */

test('reduce 는 원본 상태를 건드리지 않는다', () => {
  const s = readySlide(S0(), 'A');
  const before = JSON.stringify(s);
  for (const [type, payload] of Object.entries(fuzzPayloads('A'))) {
    reduce(s, { type, payload });
  }
  assert.equal(JSON.stringify(s), before, 'reduce 가 원본을 변형했습니다');
});

test('src/sim 은 Date.now 도 Math.random 도 쓰지 않는다', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../src/sim/', import.meta.url);
  // 주석에서 「쓰지 말 것」 이라고 적은 것까지 걸리면 안 된다. 주석을 먼저 걷어 낸다.
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = stripComments(readFileSync(new URL(f, dir), 'utf8'));
    assert.equal(/\bMath\.random\s*\(/.test(src), false, `${f} 가 Math.random 을 씁니다`);
    assert.equal(/\bDate\.now\s*\(/.test(src), false, `${f} 가 Date.now 를 씁니다`);
    assert.equal(/\bdocument\b|\bwindow\b/.test(src), false, `${f} 가 DOM 을 참조합니다`);
  }
});

/* ---------------- 가장 중요한 것 ---------------- */

test('하드 게이트는 두 종류뿐이다', () => {
  // 모든 액션을 여러 상태에서 돌려 보고, blocked 가 나오면 사유가 허용된 둘 중 하나인지 본다.
  const allowed = new Set(Object.values(BLOCKING_REASONS));
  const states = [
    S0(),
    readySlide(S0(), 'A'),
    tickUntilSettled(readySlide(S0(), 'A')),
    // 금 간 슬라이드
    (() => {
      let s = readySlide(S0(), 'A');
      s = run(s, 'MOUNT', { slide: 'A' }).state;
      s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
      return run(s, 'COARSE_FOCUS', { delta: 0.3 }).state;
    })(),
    // 치환 도중
    (() => {
      let s = tickUntilSettled(readySlide(S0(), 'A'));
      s = run(s, 'RINSE_DROPPER').state;
      s = run(s, 'FILL_DROPPER', { solution: 'S15' }).state;
      return run(s, 'APPLY_SOLUTION', { slide: 'A' }).state;
    })(),
  ];
  let blockedSeen = 0;
  for (const st of states) {
    for (const slide of SLIDE_IDS) {
      const payloads = fuzzPayloads(slide);
      for (const type of Object.keys(ACTIONS)) {
        const r = reduce(st, { type, payload: payloads[type] ?? {} });
        if (r.outcome === 'blocked') {
          blockedSeen++;
          assert.ok(allowed.has(r.reason),
            `${type} 이 허용되지 않은 사유로 막았습니다: ${r.reason}`);
          assert.ok(r.message && r.message.length > 0, `${type} 이 말 없이 막았습니다`);
        }
      }
    }
  }
  assert.ok(blockedSeen > 0, '이 검사가 아무것도 안 보고 있습니다 — 막는 경우를 하나도 못 만났습니다');
});

test('모든 액션이 셋 중 하나의 결과만 낸다', () => {
  const s = readySlide(S0(), 'A');
  const payloads = fuzzPayloads('A');
  for (const type of Object.keys(ACTIONS)) {
    const r = reduce(s, { type, payload: payloads[type] ?? {} });
    assert.ok(['ok', 'happened', 'blocked'].includes(r.outcome), `${type}: ${r.outcome}`);
    if (r.outcome === 'happened') {
      assert.ok(r.message, `${type} 이 무슨 일이 일어났는지 말하지 않습니다`);
    }
  }
});

/* ---------------- 정상 경로 통합 ---------------- */

test('정상 경로를 끝까지 밟으면 농도열과 되돌림까지 기록된다', () => {
  let s = S0();
  const go = (t, p) => { s = run(s, t, p).state; };

  // 표피 → 봉입 → 덮기
  s = readySlide(s, 'A');
  // 재물대 → 저배율 초점 → 100배
  go('MOUNT', { slide: 'A' });
  go('SET_DIAPHRAGM', { value: 0.7 });
  // 올리면 초점이 흐트러진다 (MOUNT_COARSE). 저배율에서 조동나사로 되돌려 맞춘다.
  go('COARSE_FOCUS', { delta: -s.microscope.coarse });
  go('SET_OBJECTIVE', { objective: 10 });
  s = tickUntilSettled(s);
  go('CAPTURE');   // 증류수

  for (const sol of ['S05', 'S10', 'S15', 'S20']) {
    s = exchangeTo(s, 'A', sol);
    s = tickUntilSettled(s);
    go('CAPTURE');
  }

  // 원형질 분리 복귀
  s = exchangeTo(s, 'A', 'WATER');
  s = tickUntilSettled(s);
  go('CAPTURE');

  assert.equal(s.session.captures.length, 6);
  assert.deepEqual(s.session.captures.map((c) => c.solution),
    ['WATER', 'S05', 'S10', 'S15', 'S20', 'WATER']);
  assert.ok(s.session.captures.every((c) => c.settled), '모두 평형에 닿은 뒤 기록됐다');
  // 마지막 시야는 처음과 같은 상태로 돌아와 있어야 한다
  assert.equal(s.session.captures[5].equivPct, s.session.captures[0].equivPct);
  // 정상 경로는 태그 하나 없이 끝나야 한다 (경고가 뜨면 절차가 잘못 짜인 것이다)
  const warned = s.session.log.filter((l) => l.outcome === 'happened' && l.tag);
  assert.deepEqual(warned.map((l) => `${l.action}:${l.tag}`), [],
    '정상 경로에서 경고가 떴습니다 — 절차나 규칙 한쪽이 틀렸습니다');
});

/* ---------------- 끝까지 돌렸는데 아무 말도 없던 자리 ---------------- */
/*
 * 40 배에서는 조동나사가 슬라이드를 깨므로 미동나사(±0.2)밖에 없다. 조동나사가 벌려 놓은
 * 거리가 그보다 크면 **계속 돌려도 값도 화면도 그대로**였고, 아무 말도 없었다.
 * 학생은 고장 난 줄 안다. 막지 않고 말만 붙인다 (AGENTS.md §2.1).
 *
 * ★ 다이얼은 **연속**으로 돌린다 — `(각도/360) × perTurn` (zoom.js `bindDial`).
 *   한 번에 0.16 씩 뛴다고 생각하면 안 된다. 자판은 15°, 곧 0.16/24 씩이다.
 * ★ `skipNotify` 는 **구독자만** 건너뛴다. `onMessage` 는 늘 불리므로 말은 나온다.
 *   토스트 줄은 같은 태그를 갈아 끼우므로 드래그 중에 쌓이지도 않는다 (toast.js).
 */

/** 40배에서 미동나사만 남은 막다른 자리를 만든다 */
function deadEndAt400(seedCoarse = 0.5) {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'COARSE_FOCUS', { delta: seedCoarse }).state;   // 초점에서 벗어난 채로
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  s = run(s, 'SET_OBJECTIVE', { objective: 40 }).state;
  // 미동나사를 끝까지 (연속이므로 여러 번 나눠 돌린다)
  for (let i = 0; i < 40; i += 1) s = run(s, 'FINE_FOCUS', { delta: 0.02 }).state;
  return s;
}

test('미동나사가 끝까지 갔는데 초점이 아니면, 왜 안 되는지와 빠져나갈 길을 말한다', () => {
  const s = deadEndAt400();
  assert.equal(s.microscope.fine, 0.2, '미동나사가 끝에 있다');
  const r = run(s, 'FINE_FOCUS', { delta: 0.02 });
  assert.equal(r.tag, 'fine-limit');
  assert.match(r.message, /저배율/, '40배에서는 저배율로 내려가라고 해야 한다');
  assert.match(r.message, /조동나사/);
});

test('저배율에서는 조동나사를 쓰라고 한다 — 40배와 다른 말이다', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'COARSE_FOCUS', { delta: 0.5 }).state;
  for (let i = 0; i < 40; i += 1) s = run(s, 'FINE_FOCUS', { delta: 0.02 }).state;
  const r = run(s, 'FINE_FOCUS', { delta: 0.02 });
  assert.equal(r.tag, 'fine-limit');
  assert.doesNotMatch(r.message, /저배율/, '이미 저배율인데 저배율로 내려가라고 하면 안 된다');
  assert.match(r.message, /조동나사/);
});

test('조동나사도 끝까지 가면 반대로 돌리라고 한다', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  for (let i = 0; i < 30; i += 1) s = run(s, 'COARSE_FOCUS', { delta: 0.05 }).state;
  assert.equal(s.microscope.coarse, 1, '조동나사가 끝에 있다');
  const r = run(s, 'COARSE_FOCUS', { delta: 0.05 });
  assert.equal(r.tag, 'coarse-limit');
  assert.match(r.message, /반대/);
});

test('★ 그 말대로 따라가면 실제로 초점이 맞는다', () => {
  let s = deadEndAt400();
  assert.ok(focusError(s.microscope) >= focusTolerance(40), '아직 안 맞은 자리에서 시작한다');

  // 말대로: 저배율로 내려 조동나사로 맞춘다 (자판 한 번 = 15/360 × 0.5)
  s = run(s, 'SET_OBJECTIVE', { objective: 10 }).state;
  const COARSE_KEY = (15 / 360) * 0.5;
  let turns = 0;
  while (focusError(s.microscope) >= focusTolerance(10) && turns < 200) {
    s = run(s, 'COARSE_FOCUS', { delta: -COARSE_KEY }).state;
    turns += 1;
  }
  assert.ok(focusError(s.microscope) < focusTolerance(10),
    `저배율에서도 못 맞췄다 (조동 ${turns}번, 오차 ${focusError(s.microscope)})`);
  assert.ok(s.microscope.lowMagFocused, '저배율에서 맞췄다는 표시가 서야 한다');

  // 다시 40배로 올리고 미동나사로 다듬는다
  const up = run(s, 'SET_OBJECTIVE', { objective: 40 });
  assert.notEqual(up.tag, 'skipped-low-mag', '저배율에서 맞추고 올렸는데 나무라면 안 된다');
  s = up.state;
  const FINE_KEY = (15 / 360) * 0.16;
  let fineTurns = 0;
  while (focusError(s.microscope) >= focusTolerance(40) && fineTurns < 200) {
    const dir = (s.microscope.coarse + s.microscope.fine) > 0 ? -1 : 1;
    s = run(s, 'FINE_FOCUS', { delta: dir * FINE_KEY }).state;
    fineTurns += 1;
  }
  assert.ok(focusError(s.microscope) < focusTolerance(40),
    `말대로 따라갔는데 400배 초점이 안 맞는다 (조동 ${turns}번 · 미동 ${fineTurns}번, ` +
    `오차 ${focusError(s.microscope)})`);
});

test('초점이 맞은 뒤에는 끝까지 돌려도 그 말을 하지 않는다', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'COARSE_FOCUS', { delta: -s.microscope.coarse }).state;   // 올리면 흐트러진 초점을 되돌린다
  // coarse 0, fine 을 끝까지 — 저배율(4배)은 허용 0.30 이라 0.2 는 맞은 것이다
  for (let i = 0; i < 40; i += 1) s = run(s, 'FINE_FOCUS', { delta: 0.02 }).state;
  assert.equal(s.microscope.fine, 0.2);
  assert.ok(focusError(s.microscope) < focusTolerance(4), '4배에서는 이미 맞은 상태다');
  const r = run(s, 'FINE_FOCUS', { delta: 0.02 });
  assert.equal(r.tag, null, '맞았는데 「끝까지 갔다」고 나무라면 안 된다');
  assert.ok(!r.message);
});

test('끝에 닿지 않았으면 아무 말도 하지 않는다 (delta 0 도 끝이 아니다)', () => {
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  s = run(s, 'COARSE_FOCUS', { delta: 0.5 }).state;
  for (const d of [0, 0.02, -0.02]) {
    const r = run(s, 'FINE_FOCUS', { delta: d });
    assert.equal(r.tag, null, `미동 ${d} 는 끝이 아니다`);
    const c = run(s, 'COARSE_FOCUS', { delta: d });
    assert.equal(c.tag, null, `조동 ${d} 는 끝이 아니다`);
  }
});

test('막힘 결과에는 tag 가 없다 — 태그로 겹침을 다루는 장치는 막힘에 닿지 않는다', () => {
  // 이 한 줄이 `src/ui/toast.js` 의 전제다. 여기가 바뀌면 거기 주석이 거짓이 되고,
  // 「막힘의 겹침」을 태그로 막으려는 코드가 **닿지도 않는 갈래**로 조용히 들어간다.
  // 실제로 그렇게 넣고 시험까지 썼다 — 앱이 만들 수 없는 상태를 재고 있었다.
  let s = S0();
  s = { ...s, slides: { ...s.slides, A: { ...s.slides.A, cracked: true } } };
  const r = run(s, 'MOUNT', { slide: 'A' });
  assert.equal(r.outcome, 'blocked');
  assert.equal(r.tag, undefined, '막힘에 tag 가 생겼습니다 — toast.js 의 전제를 다시 보세요');
  assert.equal(r.reason, BLOCKING_REASONS.BROKEN);
  assert.ok(r.message, '막힘은 반드시 이유를 말한다');
});

/* ---------------- 조사 ---------------- */

test('용액 이름 뒤의 조사가 맞다 — 「%」 는 「퍼센트」로 읽혀 받침이 없다', () => {
  // 「설탕 용액 10 %을 담았습니다」 「증류수으로 다 바뀌었습니다」 가 실제로 화면에 떴다
  // (osmosis 플레이테스트 2026-09-02). 조사는 글자로 박지 않고 이름을 보고 고른다.
  let s = S0();
  const bad = [];
  const say = (r) => { if (r.message && /%[을이으]|수으로|%으로/.test(r.message)) bad.push(r.message); };
  for (const sol of ['WATER', 'S05', 'S10', 'S15', 'S20']) {
    let t = readySlide(S0(), 'A');
    say(run(t, 'FILL_DROPPER', { solution: sol }));
    t = run(t, 'FILL_DROPPER', { solution: sol }).state;
    say(run(t, 'APPLY_SOLUTION', { slide: 'A' }));
    t = run(t, 'APPLY_SOLUTION', { slide: 'A' }).state;
    t = run(t, 'WICK', { slide: 'A' }).state;
    say(run(t, 'WICK', { slide: 'A' }));
    s = t;
  }
  // 증류수로 되돌릴 때 — 「증류수로」 라야 한다
  s = run(run(s, 'RINSE_DROPPER').state, 'FILL_DROPPER', { solution: 'WATER' }).state;
  s = run(s, 'APPLY_SOLUTION', { slide: 'A' }).state;
  s = run(s, 'WICK', { slide: 'A' }).state;
  const r = run(s, 'WICK', { slide: 'A' });
  say(r);
  assert.ok(/증류수로 다 바뀌었습니다/.test(r.message), `「증류수로」 라야 합니다: ${r.message}`);
  assert.deepEqual(bad, [], `조사가 틀린 문장:\n  ${bad.join('\n  ')}`);
});

test('재물대에 올리면 초점이 흐트러진다 — 2·3단계가 저배율부터 직접 맞추는 자리다', () => {
  // 처음 상태가 조동 0 이라 올린 순간 초점이 맞아 있었다. 그러면 나사를 한 번도 안 돌려도
  // 40배까지 선명하고, STEP 3 「저배율에서 초점 맞추기」는 영영 「아직」이다
  // (osmosis 플레이테스트 2026-09-02, 3단계). 올리면 저배율 허용 범위 밖에서 시작한다.
  let s = readySlide(S0(), 'A');
  s = run(s, 'MOUNT', { slide: 'A' }).state;
  assert.equal(s.microscope.lowMagFocused, false);
  assert.ok(focusError(s.microscope) >= focusTolerance(4), '올린 직후에 이미 초점이 맞아 있습니다');
  // 그래도 조동나사 범위 안이라 되돌려 맞출 수 있다
  const r = run(s, 'COARSE_FOCUS', { delta: -s.microscope.coarse });
  assert.ok(focusError(r.state.microscope) < focusTolerance(4));
  assert.equal(r.state.microscope.lowMagFocused, true);
});
