/**
 * 상태 모델. 이 파일은 DOM을 모른다 — document, window 를 참조하면 안 된다.
 * 그래야 node --test 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조.
 */

/** (가) 대조군 · (나) 아이오딘 · (다) 수단 Ⅲ */
export const SLIDE_IDS = ['A', 'B', 'C'];

export const REAGENTS = { NONE: null, IKI: 'IKI', SUDAN: 'SUDAN3' };

export function initialSlide(id) {
  return {
    id,
    sample: null,          // { thickness: 0~1, area: 0~1 }
    stain: REAGENTS.NONE,
    drops: 0,
    reactionT: 0,          // 색 변화 진행도 0~1
    coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 },
    contaminated: false,   // 씻지 않은 스포이트를 썼는가
    cracked: false,        // 고배율 조동나사로 깨졌는가
    lensTouched: false,    // 덮개 유리 없이 고배율로 봤는가
    seed: 0,
  };
}

export function initialState(level = 1, seed = 20260823) {
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
    },
    tools: {
      dropper: { holds: REAGENTS.NONE, level: 1, rinsed: true },
      forceps: { holding: null },
      banana: { peeled: false, ripe: 0.35, fleshLeft: 1 },
    },
    session: {
      level,
      seed,
      step: '1a',
      notes: {},          // { '3b': '관찰 기록...' }
      captures: [],       // { slide, objective, drops, reagent, seed, quality, focusErr, bubbles }
      violations: [],     // 안전 규칙 위반 기록. 감점하지 않고 보여 주기만 한다.
      log: [],            // { at, action, outcome } — 되돌아보기용
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
 * 400배에서 조리개를 조금만 닫아도 어두워지는 이유이자,
 * 조리개를 끝까지 열면 어느 배율에서도 충분히 밝은 이유다.
 */
export function brightness(m) {
  if (!m.lamp) return 0;
  const needed = m.objective === 40 ? 0.85 : m.objective === 10 ? 0.55 : 0.35;
  return Math.max(0, Math.min(1, m.diaphragm / needed));
}

/** 용액이 시야에 도달한 범위. 두 방울이면 전부. */
export function coverage(slide) {
  return Math.min(slide.drops / 2, 1);
}

/** 넘친 정도. 세 방울부터 배경이 물들기 시작한다. */
export function excess(slide) {
  return Math.max(0, Math.min((slide.drops - 2) / 3, 1));
}

/** 액이 넘쳐 덮개 유리가 뜬 상태 */
export function isFloating(slide) {
  return excess(slide) > 0.6;
}

/** 시료가 두꺼워 빛이 통과하지 못하는 상태 */
export function isTooThick(slide) {
  return Boolean(slide.sample && slide.sample.thickness > 0.6);
}

/** 렌더러에 넘길 값만 추린 뷰. 이 객체가 시야 그림을 완전히 결정한다. */
export function fieldParams(state, slideId) {
  const s = state.slides[slideId];
  const m = state.microscope;
  return {
    reagent: s.stain,
    coverage: coverage(s),
    excess: excess(s),
    floating: isFloating(s),
    tooThick: isTooThick(s),
    contaminated: s.contaminated,
    bubbles: s.coverslip.bubbles,
    cracked: s.cracked,
    lensTouched: s.lensTouched,
    objective: m.objective,
    focusErr: focusError(m),
    brightness: brightness(m),
    seed: s.seed,
  };
}
