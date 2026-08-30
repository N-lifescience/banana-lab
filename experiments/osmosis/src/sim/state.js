/**
 * 상태 모델. 이 파일은 DOM을 모른다 — document, window 를 참조하면 안 된다.
 * 그래야 node --test 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조.
 */

import {
  SOLUTIONS, SOLUTION_PCT, pctOf, effectivePct, isSettled,
  protoplastRatio, CELL_SAP_PCT,
} from './osmosis.js';

export { SOLUTIONS, SOLUTION_PCT, pctOf };

/**
 * 받침 유리 석 장.
 *
 * 이 실험은 **한 장 위에서 용액을 갈아 가며** 같은 세포를 보는 것이 핵심이라, 셋이 서로 다른
 * 처리군은 아니다. 석 장을 두는 이유는 둘이다 — 여벌이 있어야 실수가 막다른 길이 되지 않고,
 * 농도가 다른 시야를 나란히 놓고 견줄 수 있어야 한다.
 */
export const SLIDE_IDS = ['A', 'B', 'C'];

/**
 * 표피를 어느 면에서 벗겼는가. **이 실험에서 가장 중요한 변인이다.**
 *
 * 안토시아닌은 적양파 **바깥쪽** 표피 세포의 액포에만 있다. 안쪽은 거의 무색이라
 * 벗겨 봐야 색으로 크기 변화를 볼 수가 없다. 국내 자료 상당수가 「안쪽」이라고 써 놓았지만
 * 그건 **흰 양파** 기준의 지시다 (`AGENTS.md` §2.5).
 *
 * **막지 않는다.** 안쪽을 벗기면 색 없는 시야를 보여 준다. 그것이 이 실험이 가르치는 것이다.
 */
export const SIDES = { OUTER: 'outer', INNER: 'inner' };

export function initialSlide(id) {
  return {
    id,
    // { side: 'outer'|'inner', thickness: 0~1, folded: boolean }
    sample: null,
    /** 지금 덮개 유리 아래에 있는 용액. 봉입하기 전에는 없다. */
    medium: null,
    /** 덮개 유리 가장자리에 떨어뜨렸으나 아직 안으로 들어가지 않은 용액. */
    pending: null,
    /** 치환 진행도 0~1. **거름종이를 대야 오른다.** 1 이 되면 medium 이 바뀐다. */
    exchange: 0,
    /** 봉입액 방울 수 */
    drops: 0,
    /**
     * 세포가 지금 평형을 이루고 있는 바깥 농도 (설탕 %).
     * 갓 벗긴 표피는 제 세포액과 평형이므로 0 이 아니라 **팽윤 상태**에서 출발한다 —
     * 그래서 0 으로 둔다 (증류수와 평형).
     */
    equivPct: 0,
    coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 },
    contaminated: false,   // 씻지 않은 스포이트로 다른 농도를 섞었는가
    cracked: false,        // 고배율 조동나사로 깨졌는가
    lensTouched: false,    // 덮개 유리 없이 고배율로 봤는가
    seed: 0,
  };
}

/**
 * 난이도별 되돌리기 횟수.
 * 1단계는 마음껏 시도하게 두고, 올라갈수록 한 번의 조작을 무겁게 만든다.
 */
export const UNDO_LIMITS = { 1: Infinity, 2: 3, 3: 1 };

/** 되돌리기용 상태 스냅샷 보관 개수 */
export const HISTORY_LIMIT = 20;

/**
 * 재물대를 옮길 수 있는 범위 (화면 px).
 * 렌더러도 이 값을 읽는다 — 봉입액이 적신 범위가 여기까지 닿아야 하기 때문이다.
 * 두 곳에 따로 적으면 어긋나는 순간 시야를 옮겼을 때 세포가 마르는 것처럼 보인다.
 */
export const PAN_LIMIT = 240;

/**
 * 혼자 하는가, 모둠으로 하는가.
 *
 * 활동지가 갈린다 — 혼자 하는 학생에게 "다른 모둠의 결과와 비교해 보세요" 를 물으면
 * 답할 수 없는 것을 묻는 셈이고, 빈칸으로 남은 문항은 "못 한 일" 로 읽힌다.
 */
export const MODES = { SOLO: 'solo', GROUP: 'group' };

export function initialState(level = 1, seed = 20260826, mode = MODES.GROUP) {
  return {
    slides: Object.fromEntries(
      SLIDE_IDS.map((id, i) => [id, { ...initialSlide(id), seed: seed + i * 977 }])
    ),
    microscope: {
      stage: null,         // 'A' | 'B' | 'C'
      objective: 4,
      coarse: 0,           // -1 ~ 1
      fine: 0,             // -0.2 ~ 0.2
      diaphragm: 0.6,      // 0 ~ 1
      lamp: true,
      lowMagFocused: false, // 저배율에서 초점을 맞춘 적이 있는가 (막지는 않고 기록만)
      panX: 0,             // 재물대 위치 (화면 px). 상은 반대로 움직인다
      panY: 0,
    },
    tools: {
      dropper: { holds: null, pct: 0, level: 1, rinsed: true },
      forceps: { holding: null },
      /**
       * 적양파 비늘잎. `cut` 은 5×5 mm 칼집이다.
       * 칼집이 없으면 표피가 통째로 찢겨 두껍게 벗겨진다 — 막지 않고 두께로 답한다.
       * 벗기고 나면 칼집도 함께 없어진다. 다음 조각은 새로 칼집을 내야 한다.
       *
       * **비늘잎과 거름종이는 소모품으로 세지 않는다.** 안쪽 표피를 잘못 벗겼을 때
       * 되돌아갈 길이 여기밖에 없고, 치환은 여러 번 하는 것이 정상 경로다.
       * 바닥나면 그건 결과가 아니라 막다른 길이다 (`PLAYBOOK.md` §1).
       */
      onion: { cut: false },
      /** 핀셋에 물려 있는 표피 조각. { side, thickness } */
      epidermis: null,
    },
    session: {
      level,
      seed,
      mode,
      step: '1a',
      notes: {},          // { '3b': '관찰 기록...' }
      captures: [],       // 그때 본 시야를 그대로 다시 그릴 수 있는 값 한 벌
      // 탐구 노트에서 **읽은** 단계. 실험대는 이것이 다 차야 열린다 (src/ui/bench.js).
      // 읽었다는 사실은 조작이 아니라서 되돌리기 기록에 쌓지 않는다 (rules.js TRANSIENT_ACTIONS).
      readStages: [],
      log: [],            // { at, action, outcome, tag } — 되돌아보기용. at 은 순번이다
      // 되돌리기용. 세션 안에서만 쓴다 — captures 나 제출 데이터에 넣지 않는다.
      history: [],
      undosLeft: UNDO_LIMITS[level] ?? Infinity,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 파생값 — 저장하지 않고 그때그때 계산한다                            */
/* ------------------------------------------------------------------ */

export function focusError(m) {
  return Math.abs(m.coarse + m.fine);
}

/**
 * 실효 광량.
 * 고배율일수록 더 많은 빛이 필요하다 — 조리개를 그만큼 열어야 1이 된다.
 */
export function brightness(m) {
  if (!m.lamp) return 0;
  const needed = m.objective === 40 ? 0.85 : m.objective === 10 ? 0.55 : 0.35;
  return Math.max(0, Math.min(1, m.diaphragm / needed));
}

/** 봉입액이 시야에 도달한 범위. 두 방울이면 전부. */
export function coverage(slide) {
  return Math.min(slide.drops / 2, 1);
}

/** 넘친 정도. 세 방울부터 덮개 유리가 뜨기 시작한다. */
export function excess(slide) {
  return Math.max(0, Math.min((slide.drops - 2) / 3, 1));
}

/** 액이 넘쳐 덮개 유리가 뜬 상태 */
export function isFloating(slide) {
  return excess(slide) > 0.6;
}

/** 표피가 두꺼워 세포가 여러 겹으로 겹쳐 보이는 상태 */
export function isTooThick(slide) {
  return Boolean(slide.sample && slide.sample.thickness > 0.6);
}

/** 지금 덮개 유리 아래에 실제로 있는 농도. 치환이 덜 됐으면 섞인 농도다. */
export function mediumPct(slide) {
  return effectivePct(slide.medium?.pct ?? 0, slide.pending?.pct ?? null, slide.exchange);
}

/** 삼투가 지금 용액에 대해 평형에 닿았는가 */
export function settled(slide) {
  return isSettled(slide.equivPct, mediumPct(slide));
}

/** 세포액 농도와 같은 농도의 원형질체 부피비 — 모형이 도는지 보는 데 쓴다. */
export const sapRatioAt = (pct) => protoplastRatio(pct, CELL_SAP_PCT);

/** 렌더러에 넘길 값만 추린 뷰. 이 객체가 시야 그림을 완전히 결정한다. */
export function fieldParams(state, slideId) {
  const s = state.slides[slideId];
  const m = state.microscope;
  return {
    // 시료
    side: s.sample?.side ?? null,
    folded: Boolean(s.sample?.folded),
    tooThick: isTooThick(s),
    // 용액
    equivPct: s.equivPct,
    targetPct: mediumPct(s),
    exchange: s.exchange,
    coverage: coverage(s),
    excess: excess(s),
    floating: isFloating(s),
    contaminated: s.contaminated,
    // 슬라이드
    bubbles: s.coverslip.bubbles,
    cracked: s.cracked,
    lensTouched: s.lensTouched,
    // 현미경
    objective: m.objective,
    focusErr: focusError(m),
    brightness: brightness(m),
    panX: m.panX ?? 0,
    panY: m.panY ?? 0,
    seed: s.seed,
  };
}
