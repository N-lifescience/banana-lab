/**
 * 탐구 과정의 각 세부 단계를 **실제로 했는가.**
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 탐구 노트 4단계는 읽고 칸을 채우는 곳이었다. 그런데 칸은 실험대에 손도 대지 않고 채울 수
 * 있다. 그러면 노트는 관찰 기록이 아니라 받아쓰기가 되고, 실험대와 노트가 따로 논다.
 *
 * 여기서는 **상태만 보고** 각 단계가 실제로 일어났는지 판정한다. 화면은 이 값을 읽어
 * "했다/아직" 을 표시하고, 다음에 무엇을 적으면 되는지 짚어 준다.
 *
 * ── 이 실험에서 부딪힌 것 — 「세기」는 상태에 안 남는다 ──────────────
 * 이 실험의 몸통은 **세는 일**이고, 세는 것은 머릿속에서 일어난다. 그래서 판정의 근거를
 * 세기 자체가 아니라 **세고 나서 남긴 기록**에 둔다 (`session.calibrations` ·
 * `session.measurements` · `session.captures`). 셋 다 학생이 실험대에서 조작해야만 생긴다.
 *
 * **화면은 여전히 세지 않는다.** 여기서 보는 것은 「기록이 생겼는가」뿐이고,
 * 그 기록에 적힌 칸 수가 맞는지는 묻지도 따지지도 않는다 (DESIGN-notebook §3.4).
 *
 * ── 찍은 점(`picks`)으로 판정하지 않는 까닭 ─────────────────────────
 * `picks` 는 `RECORD_CALIBRATION`·`RECORD_MEASUREMENT` 가 비운다. 찍은 것을 판정에 쓰면
 * **기록하는 순간 ✓ 가 사라진다.** 설계도가 「두 지점을 표시한다」와 「칸 수를 세어
 * 기록한다」를 두 칸으로 나눴던 것을 여기서 한 칸으로 합친 이유가 이것이다 —
 * 한 일이 사라지는 화면은 학생을 뒤로 되돌려 보낸다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 안 한 단계의 칸도 그대로 열려 있다. 여기서 나오는 것은 **표시**이지 잠금이 아니다
 * (AGENTS.md §2.1). 순서를 바꿔 하거나 먼저 적어 두는 것을 금지할 이유가 없다.
 *
 * ── 왜 sim 에 있는가 ───────────────────────────────────────────────
 * DOM 을 모르는 순수 함수라 `node --test` 로 검증된다. 화면 안에 두면 이 판정이 맞는지
 * 브라우저를 띄워야만 알 수 있다.
 *
 * 설계: `tasks/DESIGN-notebook.md` §2
 */

import { angleGap, focusError } from './state.js';
import { focusTolerance, usableRunDiv, MAJOR_EVERY_DIV } from './optics.js';

/** 대물렌즈 배율. 총배율(100·400배)이 아니라 `microscope.objective` 에 들어가는 값이다. */
const OBJ_100 = 10;
const OBJ_400 = 40;

/**
 * 「나란하다」고 볼 기울기 차.
 *
 * 각도로 직접 정하지 않고 **셀 수 있는 칸 수에서 거꾸로 잡는다.** 두 눈금자가 기울면
 * 겹쳐 보이는 구간이 짧아지고(`usableRunDiv`), 굵은 눈금 한 마디(10칸)도 안 나오면
 * 애초에 셀 자리가 없다. 약 2.9° 에 해당한다.
 *
 * 각도를 손으로 고르면 화면(`alignment`)과 판정이 서로 다른 각도를 말하게 된다.
 */
const alignedEnough = (gapDeg) => usableRunDiv(gapDeg) >= MAJOR_EVERY_DIV;

/** 그 배율에서 그 물건의 시야를 기록했는가. `fieldParams` 가 `on` 으로 무엇이었는지 남긴다. */
const captured = (st, objective, on) =>
  st.session.captures.some((c) => c.objective === objective && c.on === on);

/**
 * 재물대에 올린 적이 있는가.
 *
 * 「지금 올라가 있는가」로만 보면, 다음 단계로 가려고 바꿔 올린 순간 앞 칸의 ✓ 가 사라진다.
 * 기록이 남아 있으면 그것으로 친다 — 기록은 재물대에 올려야만 생긴다.
 */
const everOnStage = (st, id) =>
  st.microscope.stage === id
  || st.session.captures.some((c) => c.on === id)
  || st.session.measurements.some((r) => r.target === id);

/** 그 물건에 맞는 초점 허용 범위. 크롬 선을 증착한 대물 마이크로미터가 잡기 쉽다. */
const tolFor = (objective, on) =>
  focusTolerance(objective, on === 'stageMic' ? 'micrometer' : 'specimen');

/**
 * 그 배율에서 그 물건이 **또렷했는가.**
 *
 * 상태에는 저배율 표시(`lowMagFocused`) 하나뿐이고 고배율용 끈적한 표시가 없다.
 * 그래서 **지금 맞아 있거나, 맞은 채로 기록한 적이 있거나** 로 본다.
 * 기록에 `focusErr` 가 함께 찍히므로 뒤늦게도 판정할 수 있다.
 *
 * 이것은 「나사를 돌렸는가」가 아니라 「또렷한 상태였는가」다. 모델에서 초점은
 * `coarse + fine` 하나로 정해지고 처음 상태가 0(딱 맞음)이라, 나사를 한 번도 안 건드린
 * 학생도 배율만 올리면 참이 된다. **그래도 이쪽이 맞다** — 판정이 말하는 것은
 * 「이 배율에서 이것을 또렷하게 보았는가」이고, 흐린 채로 넘어간 학생에게는 거짓이 된다.
 * 나사를 실제로 돌렸는지는 저배율에 한해 `lowMagFocused` 가 따로 말해 준다.
 */
const focusedOn = (st, objective, on) => {
  const m = st.microscope;
  const live = m.objective === objective && m.stage === on
    && focusError(m) <= tolFor(objective, on);
  return live || st.session.captures.some((c) =>
    c.objective === objective && c.on === on && c.focusErr <= tolFor(objective, on));
};

/**
 * 두 눈금자를 나란히 놓았는가.
 *
 * `PLACE_ON_STAGE` 가 놓을 때마다 각도를 시드로 흩뜨리므로(±32°), 접안렌즈를 돌리지 않으면
 * 참이 되지 않는다. 다만 표본으로 바꿔 올리면 `angleGap` 은 그 표본의 각도를 말하게 되므로,
 * **나란한 채로 남긴 눈금값 기록**이 있으면 그것으로도 친다.
 */
const aligned = (st) => alignedEnough(angleGap(st))
  || st.session.calibrations.some((c) => alignedEnough(c.angleGap));

/** 그 배율에서 눈금값을 구해 기록했는가. 값이 빈칸(`umPerDiv === null`)이어도 기록은 기록이다. */
const calibratedAt = (st, objective) =>
  st.session.calibrations.some((c) => c.objective === objective);

/** 그 배율에서 표본을 재어 기록했는가. */
const measuredAt = (st, objective) =>
  st.session.measurements.some((r) => r.objective === objective && r.target === 'specimen');

/**
 * `UI.protocol` 의 순서와 **한 칸씩 짝**을 이룬다. 그룹 id → 판정 함수 배열.
 * 절차를 고치면 여기도 함께 고쳐야 한다 — `tests/progress.test.js` 가 개수를 맞춰 본다.
 *
 * **처음 상태에서 참인 칸은 하나도 없다.** 열일곱 칸 전부 실험대의 조작으로만 참이 된다
 * (바나나랩의 「받침 유리 꺼내기」 같은, 조작이 없어 늘 참인 칸을 남기지 않았다).
 */
export const STEP_DONE = {
  '1': [
    (st) => st.eyepiece.micrometer,
    // 뒤집힌 채로 두는 것을 막지 않는다. 이 칸만 '아직' 으로 남고,
    // 시야에는 눈금 숫자가 좌우로 뒤집힌 채 그려진다 — 화면이 말로 알려 주는 대신 보여 준다.
    // 값은 틀리지 않으므로 점수에는 넣지 않는다 (rules.js M-01).
    (st) => st.eyepiece.micrometer && !st.eyepiece.flipped,
  ],
  '2': [
    (st) => everOnStage(st, 'stageMic'),
    aligned,
  ],
  '3': [
    // 「또렷한가」 에 「저배율에서 초점을 맞춘 적이 있는가」 를 함께 건다.
    // 처음 상태가 이미 딱 맞아 있어서, 또렷함만 보면 나사를 한 번도 안 돌린 학생에게도
    // 참이 된다. `lowMagFocused` 는 저배율에서 초점 나사를 돌려 맞췄을 때만 서는 표시라
    // (`rules.js` FINE_FOCUS·COARSE_FOCUS), 이 칸이 뜻을 갖게 해 준다. 한 번 서면 안 지워진다.
    (st) => st.microscope.lowMagFocused && focusedOn(st, OBJ_100, 'stageMic'),
    (st) => calibratedAt(st, OBJ_100),
    (st) => captured(st, OBJ_100, 'stageMic'),
  ],
  '4': [
    (st) => everOnStage(st, 'specimen'),
    (st) => st.microscope.lowMagFocused && focusedOn(st, OBJ_100, 'specimen'),
    (st) => measuredAt(st, OBJ_100),
    (st) => captured(st, OBJ_100, 'specimen'),
  ],
  '5': [
    (st) => focusedOn(st, OBJ_400, 'specimen'),
    (st) => measuredAt(st, OBJ_400),
    (st) => captured(st, OBJ_400, 'specimen'),
  ],
  '6': [
    // 지금 올려 놓았거나, 올려서 기록한 적이 있거나. 다음 단계로 가느라 내려놓은
    // 학생의 ✓ 를 뺏지 않는다.
    (st) => (st.microscope.stage === 'stageMic' && st.microscope.objective === OBJ_400)
      || captured(st, OBJ_400, 'stageMic'),
    (st) => calibratedAt(st, OBJ_400),
    (st) => captured(st, OBJ_400, 'stageMic'),
  ],
};

/**
 * 「눈금을 시야 가운데로」 칸을 두지 않은 까닭 — 설계도 §2.4 가 「위태롭다」고 짚은 자리다.
 *
 * 설계도는 두 갈래를 놓고 규칙 쪽 결정을 기다렸다. 규칙은 **자리가 아니라 각도를 흩뜨리는**
 * 쪽으로 정해졌다 — `PLACE_ON_STAGE` 는 `panX`·`panY` 를 0 으로 두고 물건의 `angleDeg` 만
 * 시드로 흩뜨린다. 그러면 올려놓자마자 `centerErr` 가 0 이라 그 칸은 **늘 참**이 된다.
 *
 * 그래서 그 칸을 없애고, 같은 자리에 규칙이 실제로 만들어 둔 일 —
 * **접안렌즈를 돌려 두 눈금자를 나란히 놓기** — 를 넣었다. 설계도가 STEP 3 에 두었던 칸을
 * 앞으로 당긴 것인데, 흩어진 각도가 「올려놓은 직후」의 상태이므로 자리가 여기가 맞다.
 *
 * 재물대를 옮기는 일(`MOVE_STAGE`)을 판정 칸으로 만들지 않은 것은 그것대로 까닭이 있다.
 * 중앙에서 밀려나면 막히는 것이 아니라 **눈금값이 거칠어질 뿐**이고(DESIGN-rules §2.2),
 * 이것을 ✓ 로 만들면 「가운데로 옮겼다」가 아니라 「옮기기는 했다」를 세게 된다 —
 * 설계가 없애려던 누르기 게임이 되돌아온다. `centerErr` 는 눈금값의 정밀도로만 흐른다.
 */

/**
 * 결과가 다 나왔다는 것 — **(배율 × 재물대에 올린 것) 네 짝의 기록.**
 *
 * 바나나랩은 (가)(나)(다) 세 장이었다. 여기서 견주는 것은 슬라이드가 아니라 배율이고,
 * 배율마다 「눈금값의 근거」와 「세포」가 한 장씩 있어야 결과 표의 네 칸이 채워진다
 * (DESIGN-notebook §7.2). 눈금 사진이 없으면 「한 칸 = ? µm」 는 학생 주장일 뿐이고,
 * 세포 사진이 없으면 잰 것이 무엇인지 아무도 확인할 수 없다.
 */
export const RESULT_SHOTS = [
  { objective: OBJ_100, on: 'stageMic' },   // 100배 · 한 칸의 길이를 구한 근거
  { objective: OBJ_100, on: 'specimen' },   // 100배 · 세포
  { objective: OBJ_400, on: 'specimen' },   // 400배 · 세포
  { objective: OBJ_400, on: 'stageMic' },   // 400배 · 한 칸의 길이를 다시 구한 근거
];

/** 세부 단계 하나를 했는가. 표에 없는 자리는 판정하지 않는다(=아직). */
export function stepDone(st, groupId, index) {
  return Boolean(STEP_DONE[groupId]?.[index]?.(st));
}

/** 그룹 하나를 다 했는가. */
export function groupDone(st, groupId) {
  const fns = STEP_DONE[groupId];
  return Boolean(fns?.length) && fns.every((f) => f(st));
}

/**
 * 네 장을 다 기록했는가 — 탐구 노트 5단계가 끝났다는 뜻이다.
 * **왜 넉 장인지는 화면에서 말하지 않는다** (설계도 §7.4). 남은 것만 알린다.
 */
export function resultsDone(st) {
  return RESULT_SHOTS.every(({ objective, on }) => captured(st, objective, on));
}

/**
 * 5단계에서 **아직 안 찍은 짝**. 화면이 「무엇이 남았는지」 말할 수 있어야 한다.
 *
 * 「다 적은 것 같은데 왜 체크가 안 뜨지?」 라는 물음이 실제로 나왔다.
 * 표를 채우는 것과 **시야를 기록하는 것**은 다른 일인데, 화면이 그 차이를 말하지 않으면
 * 학생은 자기가 무엇을 안 했는지 알 길이 없다. 조건을 낮추는 대신 조건을 **보이게** 한다.
 */
export function resultsMissing(st) {
  return RESULT_SHOTS.filter(({ objective, on }) => !captured(st, objective, on));
}
