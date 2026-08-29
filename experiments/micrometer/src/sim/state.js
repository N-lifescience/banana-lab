/**
 * 상태 모델. 이 파일은 DOM을 모른다 — document, window 를 참조하면 안 된다.
 * 그래야 node --test 로 규칙을 검증할 수 있다.
 *
 * ── 이 실험의 중심 구분 ────────────────────────────────────────────
 * **접안 마이크로미터는 렌즈 안에 있고, 대물 마이크로미터는 재물대 위에 있다.**
 * 배율을 올리면 재물대 위의 것만 커지고 렌즈 안의 눈금은 한 치도 안 변한다.
 * 이 비대칭 하나가 실험 전체를 지탱하므로 상태에서도 둘을 다른 자리에 둔다
 * (`eyepiece` 와 `items`). 한 곳에 섞어 두면 렌더러가 실수로 함께 확대하게 되고,
 * 그러면 이 실험은 아무것도 가르치지 않는다.
 *
 * 파생값은 **저장하지 않는다.** 저장하면 상태와 어긋나는 순간이 생기고 그때가 언제인지
 * 아무도 모른다. 필요할 때 계산한다.
 *
 * 설계: `tasks/DESIGN-rules.md` §1·§2 · `tasks/DESIGN-optics.md`
 */

import { PAN_LIMIT_PX, GAP_MAX_DEG, umPerEyepieceDiv, OBJECTIVES } from './optics.js';

/** 재물대에 오를 수 있는 것. 서로 대조군이 아니라 **차례로 쓰는 도구**다. */
export const ITEM_IDS = ['stageMic', 'specimen'];

/** 학생이 시야에서 찍은 지점의 종류. 눈금이 겹친 곳인가, 세포의 끝인가. */
export const PICK_KINDS = { SCALE: 'scale', CELL: 'cell' };

/**
 * 되돌리기 횟수. 바나나랩과 같다.
 * 되돌릴 것은 **조작**이지 학생이 찍은 점이 아니다 — 찍기는 무료로 지운다(`CLEAR_PICKS`).
 * 3단계의 한 번뿐인 되돌리기가 오타 지우기에 쓰이면 그 기능은 없는 것과 같다.
 */
export const UNDO_LIMITS = { 1: Infinity, 2: 3, 3: 1 };
export const HISTORY_LIMIT = 20;

/** 재물대를 옮길 수 있는 범위(화면 px). **여기 한 곳에만 적는다.** */
export const PAN_LIMIT = PAN_LIMIT_PX;

export const MODES = { SOLO: 'solo', GROUP: 'group' };

/**
 * 재물대에 오르는 물건 하나.
 *
 * `angleDeg` 는 **놓일 때 정해진다.** 늘 0 이면 학생이 접안렌즈를 돌릴 이유가 없고,
 * 그러면 절차의 한 단계가 통째로 사라진다. 시드로 흩뜨려 매번 조금씩 다르게 놓는다.
 */
export function initialItem(id, seed) {
  return { id, angleDeg: 0, cracked: false, seed };
}

export function initialState(level = 1, seed = 20260826, mode = MODES.GROUP) {
  return {
    /**
     * 접안렌즈. **재물대 위가 아니다.**
     * `micrometer` 가 false 면 시야에 눈금자가 없고, 그러면 잴 것이 없다.
     */
    eyepiece: {
      micrometer: false,
      flipped: false,   // 뒤집어 끼우면 숫자가 좌우로 뒤집혀 보인다. **값은 안 틀린다**
      angleDeg: 0,      // 접안렌즈를 돌린 각도. 연속값이다
      /**
       * 통 안에 들어 있는가. **처음에는 꺼내 놓은 채로 시작한다**(false).
       *
       * 실험대에 통만 놓여 있으면 학생은 통을 현미경에 끌어다 놓는다 — 통을 끼우는
       * 그림이 되고, 「렌즈 안에 들어가는 것은 원판」이라는 이 실험의 중심이 흐려진다.
       * 꺼내 둔 자를 눈으로 보고 집어 끼우는 것이 실제 순서와도 같다.
       *
       * 원판이 어디 있는지는 **이 값 하나가 말한다.** 「넣은 적이 있는가」 같은 기록으로는
       * 대신할 수 없다 — 넣었다 다시 꺼내면 화면이 여전히 「통 안에 있다」고 말하게 된다.
       */
      stowed: false,
    },

    /**
     * 재물대에 오를 수 있는 물건들. **어디에 있는지는 여기 적지 않는다** —
     * 그건 `microscope.stage` 하나가 말한다. 두 곳에 적으면 「재물대에는 표본이 있는데
     * 표본은 상자 안에 있다」 같은 상태가 만들어진다.
     */
    items: Object.fromEntries(
      ITEM_IDS.map((id, i) => [id, initialItem(id, seed + i * 977)])
    ),

    microscope: {
      stage: null,          // null | 'stageMic' | 'specimen'
      objective: 4,
      /**
       * **초점이 맞은 채로 시작하지 않는다.**
       *
       * 앞서는 `coarse: 0` 이라 처음부터 초점이 완벽했다. 그러면 탐구 노트가
       * 「초점을 맞추세요」 라고 하는데 **맞출 것이 없고**, 나사를 돌리면 오히려 나빠진다 —
       * 절차가 거짓말이 되고, 관찰 가능성 게이지는 정렬만 맞추면 곧장 99점에 붙어
       * 학생이 손댈 데가 없어진다. 실제로 「99점에서 안 움직인다」고 걸렸다.
       *
       * 현미경은 대물렌즈를 바꿀 때마다 다시 맞추는 물건이다. 처음 자리도 마찬가지로
       * 어긋나 있어야 **초점 맞추기가 실제로 하는 일**이 된다.
       * 저배율(4배)은 허용 범위가 넓어 이 값으로도 어느 정도 보이고, 100배로 올리면
       * 뚜렷하게 흐려진다 — 배율을 올릴수록 초점이 예민해진다는 것이 그대로 드러난다.
       */
      coarse: 0.8,          // -1 ~ 1
      fine: 0,              // -0.2 ~ 0.2
      diaphragm: 0.6,       // 0 ~ 1
      lamp: true,
      lowMagFocused: false, // 저배율에서 초점을 맞춘 적이 있는가
      panX: 0,              // 재물대 위치(화면 px). 「중앙 정렬」이 여기서 일어난다
      panY: 0,
    },

    /**
     * 학생이 시야에서 찍은 지점. 최대 두 개.
     *
     * **세는 일을 앱이 대신하지 않는다.** 학생이 두 곳을 찍으면 앱은 그 자리의 눈금 번호를
     * 읽어 줄 뿐이다. 뺄셈은 도구가 하고, 찾는 일은 눈이 한다.
     *
     * 겹치지 않은 자리를 찍어도 막지 않는다 — 어긋남이 `gap` 으로 남아 눈금값에 그대로
     * 섞이고, 같은 배율에서 두 번 구해 보면 두 값이 다르게 나온다. 학생은 자기 손끝의
     * 오차를 「틀렸습니다」가 아니라 **자기가 적은 두 숫자의 차이**로 만난다.
     */
    picks: [],

    session: {
      level,
      seed,
      mode,
      notes: {},
      captures: [],
      readStages: [],
      /** 접안 눈금 한 칸이 몇 µm 인가. **배율 도장이 함께 찍힌다.** */
      calibrations: [],
      /** 이 세포가 몇 µm 인가. `calibrationAt` 으로 **어느 눈금값을 썼는지**가 남는다. */
      measurements: [],
      log: [],
      history: [],
      undosLeft: UNDO_LIMITS[level] ?? Infinity,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 파생값 — 전부 연속값이다. 불리언으로 두지 않는다.                    */
/* ------------------------------------------------------------------ */

/** 초점이 얼마나 어긋났는가. 바나나랩 그대로. */
export function focusError(m) {
  return Math.abs((m.coarse ?? 0) + (m.fine ?? 0));
}

/** 시야가 얼마나 밝은가. 조리개와 조명만으로 정해진다. */
export function brightness(m) {
  if (!m.lamp) return 0;
  return Math.max(0, Math.min(1, m.diaphragm ?? 0));
}

/**
 * 눈금선의 또렷함.
 *
 * 조리개는 **어두워도 밝아도** 선을 흐린다 — 닫으면 어둡고, 활짝 열면 산란광이 대비를 씻는다.
 * 바나나랩의 `brightness` 는 밝을수록 좋았지만, 여기서 보는 것은 밝기가 아니라 **선의 경계**다.
 */
export function lineContrast(m) {
  const b = brightness(m);
  if (b <= 0) return 0;
  const d = Math.abs(b - 0.55) / 0.55;   // 0.55 근처가 가장 또렷하다
  return Math.max(0, 1 - d * d);
}

/**
 * 두 눈금자가 얼마나 어긋났는가(도). **180° 주기로 접는다** —
 * 눈금자는 화살표가 아니라 방향이라, 180° 돌린 것은 나란한 것과 같다.
 */
export function angleGap(state) {
  if (!state.eyepiece.micrometer) return 90;      // 견줄 눈금 자체가 없다
  const on = state.microscope.stage;
  if (!on) return 90;                              // 재물대가 비어 있다

  // **표본에는 눈금이 없다.** 나란히 맞출 상대가 없으므로 어긋남도 없다.
  // 여기서 각도를 재면, 눈금자를 완벽히 맞춰 놓고 표본으로 바꾼 학생이 이유 없이
  // 점수를 잃는다 — 그리고 화면은 "두 눈금자가 나란하지 않습니다" 라고, 있지도 않은
  // 눈금자를 맞추라고 말한다. 실제로 그렇게 만들었다가 27점이 나오는 것을 보고 고쳤다.
  if (on !== 'stageMic') return 0;

  const raw = (state.eyepiece.angleDeg ?? 0) - (state.items[on]?.angleDeg ?? 0);
  const folded = ((raw % 180) + 180) % 180;
  return folded > 90 ? 180 - folded : folded;
}

/** 나란한 정도 0~1. 화면과 점수가 같은 축을 쓰게 하려고 각도를 그대로 두지 않는다. */
export function alignment(state) {
  return 1 - Math.min(angleGap(state) / GAP_MAX_DEG, 1);
}

/** 눈금자가 시야 중심에서 얼마나 밀려났는가 0~1. 「중앙 정렬」이 이 값 하나로 산다. */
export function centerErr(m) {
  return Math.min(1, Math.hypot(m.panX ?? 0, m.panY ?? 0) / PAN_LIMIT);
}

/**
 * 시야 안에서 두 눈금을 **함께 볼 수 있는** 접안 칸 수.
 *
 * 중심에서 밀려날수록 짧아진다. 짧으면 겹친 두 지점 사이에 들어가는 칸이 적고,
 * 칸이 적으면 같은 손끝 오차가 눈금값에서 차지하는 비율이 커진다 — **덜 정확해진다.**
 * 막지 않는다. 거칠어질 뿐이고, 그 거칢은 두 번 재 보면 학생이 스스로 본다.
 */
export function spanDivs(state, reticleDivs) {
  const usable = 1 - centerErr(state.microscope) * 0.7;
  return Math.max(0, reticleDivs * usable);
}

/**
 * 읽기 쉬움 0~1. **정확함이 아니다.**
 *
 * 뒤집어 끼운 것은 읽기를 불편하게 할 뿐 값을 틀리게 하지 않는다 — 칸 간격이 같기 때문이다.
 * 그래서 여기에는 넣되 **관찰 가능성 점수에서는 뺀다.** 점수를 깎으면 앱이 사실이 아닌
 * 말을 하는 셈이 된다.
 */
export function readability(state, flipPenalty = 0.75) {
  const m = state.microscope;
  const focus = Math.max(0, 1 - focusError(m) * 2);
  return lineContrast(m) * focus * (state.eyepiece.flipped ? flipPenalty : 1);
}

/**
 * 지금 접안 눈금 한 칸이 몇 µm 인가 — **시뮬레이터가 아는 참값**이다.
 *
 * 화면에 내지 않는다. 학생이 구한 값과 견주지도 않는다 — 견주는 순간 채점이 되고,
 * 그러면 학생은 세는 대신 맞히려 든다. 시야를 그릴 때 눈금 간격을 정하는 데만 쓴다.
 */
export function trueUmPerDiv(state) {
  return umPerEyepieceDiv(state.microscope.objective);
}

/**
 * 시야 하나를 **그대로 다시 그릴 수 있는 값 한 벌.**
 *
 * 이 키 집합이 곧 기록이고 제출 데이터다. 늘리거나 줄이면 저장된 기록을 다시 못 그린다.
 * 바나나랩과 같은 이유로 여기 한 곳에서만 만든다.
 */
export function fieldParams(state) {
  const m = state.microscope;
  const on = m.stage;
  const item = on ? state.items[on] : null;
  return {
    on,                                    // 재물대에 무엇이 올라가 있는가
    hasReticle: state.eyepiece.micrometer,
    flipped: state.eyepiece.flipped,
    eyeAngle: state.eyepiece.angleDeg ?? 0,
    itemAngle: item?.angleDeg ?? 0,
    cracked: item?.cracked ?? false,
    objective: m.objective,
    focusErr: focusError(m),
    contrast: lineContrast(m),
    panX: m.panX ?? 0,
    panY: m.panY ?? 0,
    seed: item?.seed ?? state.session.seed,
  };
}
