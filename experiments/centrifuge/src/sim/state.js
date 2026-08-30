/**
 * 상태 모델. 이 파일은 DOM을 모른다 — document, window 를 참조하면 안 된다.
 * 그래야 node --test 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조.
 */

import {
  HEMATOCRIT, DEFAULT_DONOR, TUBE_LEN_MM,
  layerFractions, packedFraction, separationOf, clotCeiling, sharpnessOf, wobbleOf,
} from './spin.js';

/**
 * 모세관 두 가지. **이것이 이 실험의 변인 하나다.**
 *
 * 헤파린이 도포된 것과 아무것도 안 발린 것. 민무늬를 고르는 것을 막지 않는다 —
 * 돌리는 동안 응고해서 층이 안 갈리고, 위에 뜨는 것은 혈장이 아니라 **혈청**이 된다.
 */
export const TUBE_KINDS = { HEPARIN: 'heparin', PLAIN: 'plain' };

/** 회전판의 두 자리. 마주 보고 있다 — 그래서 반대쪽을 비우면 흔들린다. */
export const SLOTS = { A: 'A', B: 'B' };

/** 빨대에 들어가는 것 두 가지. */
export const SLOT_ITEMS = { SAMPLE: 'sample', COUNTER: 'counter' };

/** 모세관의 두 끝. **「아래」가 아니다** — 회전판은 모세관을 수평으로 문다. */
export const ENDS = { OUTER: 'outer', INNER: 'inner' };

/**
 * 유리가 부러지는 누름 세기.
 *
 * 고무찰흙에 모세관을 눌러 막을 때 실제로 일어나는 일이다. 이 값 위로 누르면 부러진다 —
 * 허용된 하드 게이트 둘 중 하나(`BROKEN`).
 */
export const PRESS_BREAK = 0.92;

/** 밀봉이 온전해지는 누름 세기. 이보다 얕으면 샌다. */
export const PRESS_GOOD = 0.55;

/**
 * 모세관 끝을 대는 각도 (도). 0 이면 손끝에 수직으로 세운 것, 90 이면 완전히 눕힌 것.
 *
 * 비스듬히 대야 모세관 현상이 제대로 일어난다. 수직으로 세우면 공기가 함께 들어간다.
 * **어느 각도든 막지 않는다** — 기포가 얼마나 들어오는지가 달라질 뿐이다.
 */
export const ANGLE_RANGE_DEG = [0, 90];
export const ANGLE_BEST_DEG = 35;

/** 지금 다루고 있는 모세관 한 개 */
export function initialTube(seed = 0, kind = TUBE_KINDS.HEPARIN) {
  return {
    kind,
    fill: 0,            // 혈액 기둥의 길이 — 관 전체에서 차지하는 비율 0~1
    bubbles: 0,         // 기둥 안에 낀 공기 0~1. 잴 때 어디까지가 혈액인지 애매해진다
    lastAngle: null,    // 마지막에 댄 각도 (도)
    seal: { outer: 0, inner: 0 },   // 양끝 밀봉의 온전함 0~1
    clot: 0,            // 응고 0~1
    work: 0,            // 누적 원심 일 — 이것이 분리를 만든다
    mixed: 0,           // 흔들려 다시 섞인 정도 0~1
    lost: 0,            // 새어 나간 몫 0~1
    broken: false,      // 파손 — 허용된 하드 게이트 둘 중 하나
    donor: DEFAULT_DONOR,
    seed,
  };
}

/** 손끝 */
export function initialFinger() {
  return {
    swabbed: false,   // 소독했는가
    drop: 0,          // 맺힌 핏방울의 크기 0~1
    dropAge: 0,       // 맺힌 뒤 지난 시뮬레이션 시간 — 오래 두면 굳기 시작한다
  };
}

/**
 * 회전판. **모세관을 수평으로 문다.**
 *
 * 두 자리는 마주 보고 있다. `seat` 은 얼마나 밀어 넣었는가 0~1 이고,
 * 두 쪽의 깊이가 다르면 무게 중심이 축에서 벗어나 그만큼 흔들린다.
 */
export function initialRotor() {
  return {
    slots: { A: null, B: null },      // null | 'sample' | 'counter'
    seat: { A: 1, B: 1 },             // 밀어 넣은 깊이 0~1
    speed: 0,                         // 0~1 로 정규화한 회전 속도. **rpm 이 아니다**
    phase: 0,                         // 꼬임 주기 안의 위치 0~1. 0 이 당길 때다
    pulls: 0,                         // 당긴 횟수 — **목표가 아니라 한 일의 기록이다**
    onBeat: 0,                        // 박자가 맞은 몫의 합. pulls 로 나누면 리듬의 질이다
  };
}

/** 채혈침 하나 */
export function initialLancet() {
  return { used: false, disposed: false };
}

/**
 * 난이도별 되돌리기 횟수.
 * 1단계는 마음껏 시도하게 두고, 올라갈수록 한 번의 조작을 무겁게 만든다.
 */
export const UNDO_LIMITS = { 1: Infinity, 2: 3, 3: 1 };

/** 되돌리기용 상태 스냅샷 보관 개수 */
export const HISTORY_LIMIT = 20;

/**
 * 혼자 하는가, 모둠으로 하는가.
 *
 * 활동지가 갈린다 — 혼자 하는 학생에게 "다른 모둠의 결과와 비교해 보세요" 를 물으면
 * 답할 수 없는 것을 묻는 셈이고, 빈칸으로 남은 문항은 "못 한 일" 로 읽힌다.
 */
export const MODES = { SOLO: 'solo', GROUP: 'group' };

export function initialState(level = 1, seed = 20260827, mode = MODES.GROUP) {
  return {
    finger: initialFinger(),
    tube: initialTube(seed),
    rotor: initialRotor(),
    lancet: initialLancet(),
    tools: {
      // 다음에 집을 모세관의 종류. **이것이 변인이다** — 화면이 알아서 헤파린을 집어 주면
      // "왜 헤파린이 발린 것을 쓰는가" 가 학생 손을 떠난다 (PLAYBOOK §4).
      pickKind: TUBE_KINDS.HEPARIN,
      // 몇 개째 모세관인가. 통에 넉넉히 있으므로 바닥나지 않는다 —
      // 소모품이 바닥나면 그건 결과가 아니라 막다른 길이다.
      tubesUsed: 0,
      rulerPlaced: false,
    },
    session: {
      level,
      seed,
      mode,
      step: '1a',
      notes: {},          // { '3b': '관찰 기록...' }
      captures: [],       // 기록한 결과 한 벌
      // 탐구 노트에서 **읽은** 단계. 실험대는 이것이 다 차야 열린다 (src/ui/bench.js).
      // 읽었다는 사실은 조작이 아니라서 되돌리기 기록에 쌓지 않는다 (rules.js TRANSIENT_ACTIONS).
      readStages: [],
      // 뒤늦게라도 하면 위반 기록에서 지워진다 — 벌이 아니라 기록이기 때문이다.
      log: [],            // { at, action, outcome, tag } — 되돌아보기용. at 은 순번이다
      // 되돌리기용. 세션 안에서만 쓴다 — captures 나 제출 자료에 넣지 않는다.
      history: [],
      undosLeft: UNDO_LIMITS[level] ?? Infinity,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 파생값 — 저장하지 않고 그때그때 계산한다                            */
/* ------------------------------------------------------------------ */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 지금 남아 있는 혈액 기둥의 길이 (관 전체에 대한 비율) */
export function columnLength(tube) {
  return clamp01(tube.fill * (1 - tube.lost));
}

/** 양끝 밀봉 중 **약한 쪽**. 새는 곳은 언제나 약한 쪽이다. */
export function weakestSeal(tube) {
  return Math.min(tube.seal.outer, tube.seal.inner);
}

/** 양끝이 다 막혔는가 */
export function isSealed(tube) {
  return tube.seal.outer > 0 && tube.seal.inner > 0;
}

/** 회전판이 얼마나 어긋나 있는가 0~1 */
export function imbalanceOf(rotor) {
  const a = rotor.slots.A;
  const b = rotor.slots.B;
  if (!a && !b) return 0;                    // 빈 회전판은 어긋날 것이 없다
  if (!a || !b) return 1;                    // 한쪽만 넣으면 통째로 어긋난다
  return clamp01(Math.abs(rotor.seat.A - rotor.seat.B));
}

/** 지금 흔들리는 정도 0~1 */
export function currentWobble(rotor) {
  return wobbleOf(imbalanceOf(rotor), rotor.speed);
}

/** 돌고 있는가. 아주 느린 것은 멎은 것으로 본다 — 손을 대도 되는 자리를 정한다. */
export function isSpinning(rotor) {
  return rotor.speed > 0.02;
}

/** 시료 모세관이 회전판에 물려 있는 자리. 없으면 null. */
export function sampleSlot(rotor) {
  if (rotor.slots.A === SLOT_ITEMS.SAMPLE) return SLOTS.A;
  if (rotor.slots.B === SLOT_ITEMS.SAMPLE) return SLOTS.B;
  return null;
}

/** 빈 자리 하나. 둘 다 찼으면 null. */
export function freeSlot(rotor) {
  if (!rotor.slots.A) return SLOTS.A;
  if (!rotor.slots.B) return SLOTS.B;
  return null;
}

/**
 * 얼마나 갈렸는가 0~1.
 *
 * 누적 원심 일이 만들고, **응고가 천장을 씌운다.** 응고한 혈액은 젤이라 적혈구가
 * 따로 가라앉지 못한다.
 */
export function separation(tube) {
  return clamp01(separationOf(tube.work) * clotCeiling(tube.clot));
}

/** 층의 경계가 또렷한 정도 0~1 */
export function sharpness(tube) {
  return sharpnessOf(separation(tube), tube.mixed);
}

/**
 * 응고했는가. 그러면 위에 뜨는 것은 **혈장이 아니라 혈청**이다 — 응고인자가
 * 혈병으로 빠져나갔기 때문이다 (AGENTS.md §2.5).
 */
export function isClotted(tube) {
  return tube.clot >= 0.35;
}

/** 학생이 당긴 리듬이 얼마나 고르게 맞았는가 0~1. 한 번도 안 당겼으면 0. */
export function rhythmQuality(rotor) {
  if (rotor.pulls <= 0) return 0;
  return clamp01(rotor.onBeat / rotor.pulls);
}

/**
 * 렌더러에 넘길 값만 추린 뷰. 이 객체가 모세관 그림을 완전히 결정한다.
 * 기록(CAPTURE)도 이것을 통째로 담는다 — 두 벌을 따로 만들면 어긋난다.
 *
 * **길이는 전부 「관 전체에 대한 비율」이다.** mm 로 환산하지 않는다 —
 * 모세관의 실제 규격이 `[확인 필요]` 라서, 환산하면 지어낸 값이 그림에 박힌다.
 */
export function tubeParams(state) {
  const t = state.tube;
  const sep = separation(t);
  const hct = HEMATOCRIT[t.donor] ?? HEMATOCRIT[DEFAULT_DONOR];
  const parts = layerFractions(hct);
  return {
    column: columnLength(t),                 // 기둥의 길이 (관 전체에 대한 비율)
    // 붉게 보이는 부분이 **기둥 안에서** 차지하는 비율. 덜 갈리면 1 에 가깝다 —
    // 그래서 덜 돌린 학생은 헤마토크릿을 과대평가한다 (spin.js packedFraction).
    packedOfColumn: packedFraction(sep, hct),
    // 연층은 다 갈려야 눈에 선다. 덜 갈렸으면 아직 적혈구 사이에 흩어져 있다.
    buffyOfColumn: parts.buffy * sep,
    separation: sep,
    sharpness: sharpness(t),
    clotted: isClotted(t),
    clot: t.clot,
    bubbles: t.bubbles,
    lost: t.lost,
    mixed: t.mixed,
    broken: t.broken,
    // 마개가 얼마나 물렸는지도 그림에 나온다 — 얕게 막은 것이 눈에 보여야 한다.
    seal: { ...t.seal },
    kind: t.kind,
    donor: t.donor,
    rulerPlaced: state.tools.rulerPlaced,
    // 자의 눈금을 그리는 데만 쓴다. 헤마토크릿은 길이의 비라 이 값에 좌우되지 않는다.
    tubeLenMm: TUBE_LEN_MM,
    seed: t.seed,
  };
}
