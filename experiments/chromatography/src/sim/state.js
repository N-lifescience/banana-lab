/**
 * 상태 모델. 이 파일은 DOM을 모른다 — document, window 를 참조하면 안 된다.
 * 그래야 node --test 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조.
 */

import {
  ORIGIN_MM, PAPER_H_MM, MIN_SPOT_MM,
  frontMm, isOverrun, riseMm,
} from './develop.js';

/** 원점을 긋는 도구. 볼펜은 막지 않는다 — 잉크가 함께 올라갈 뿐이다. */
export const MARKERS = { PENCIL: 'pencil', PEN: 'pen' };

/** 병에 든 것 두 가지. 이름을 문자로 두어 규칙표가 읽히게 한다. */
export const LIQUIDS = { EXTRACT: 'EXTRACT', SOLVENT: 'SOLVENT' };

/** 잎의 상태. 시든 잎으로도 실험은 진행된다 — 색소가 적을 뿐이다. */
export const LEAF_KINDS = { FRESH: 'fresh', WILTED: 'wilted' };

/** 원심관 — 색소를 뽑는 곳 */
export function initialTube() {
  return {
    leaf: 0,          // 넣은 잎의 양 0~1
    leafFresh: 1,     // 넣은 잎의 신선도 0~1 (여러 번 넣으면 섞인다)
    extract: 0,       // 넣은 추출액 0~1
    shaken: 0,        // 흔든 정도 0~1
    settleT: 0,       // 층 분리 진행도 0~1
    drawn: 0,         // 상층액을 뽑아 쓴 횟수 (바닥나지 않게 넉넉히 둔다)
  };
}

/** 거름종이 한 장 */
export function initialPaper(seed = 0) {
  return {
    originMm: null,        // 원점 선을 그은 높이. null 이면 아직 안 그었다
    marker: null,          // 'pencil' | 'pen'
    spots: 0,              // 찍은 횟수
    spotMm: MIN_SPOT_MM,   // 원점의 지름
    spotWet: 0,            // 원점이 아직 젖어 있는가 0~1. 마르기 전에 겹쳐 찍으면 번진다
    load: 0,               // 실린 색소량 0~1
    grit: 0,               // 잎 부스러기 오염 0~1 (층 분리 전에 뽑으면 는다)
    inVial: false,
    runT: 0,               // 전개 시간 (시뮬레이션 단위)
    depthAtRun: 0,         // 전개를 시작할 때의 전개액 깊이
    washedOut: 0,          // 원점이 잠겨 씻겨 나간 정도 0~1
    lightDose: 0,          // 빛을 쬔 양 0~1 (엽록소만 잃는다)
    wetness: 0,            // 젖은 정도 0~1. 마르면 0
    markedFront: null,     // 표시해 둔 용매 전선 높이 (mm). null 이면 표시 안 했다
    markedBands: false,
    rulerPlaced: false,    // 자를 대어 눈금을 읽고 있는가
    torn: false,           // 찢어짐 — 허용된 하드 게이트 둘 중 하나
    seed,
  };
}

/** 전개조 */
export function initialVial() {
  return { depthMm: 0, capped: false, hasPaper: false };
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

export function initialState(level = 1, seed = 20260826, mode = MODES.GROUP) {
  return {
    tube: initialTube(),
    paper: initialPaper(seed),
    vial: initialVial(),
    tools: {
      // 모세관이 머금은 것 — 얼마나 진한 상층액인가, 부스러기가 얼마나 딸려 왔는가.
      // 찍을 때 이 값이 종이로 옮겨 간다.
      capillary: { strength: 0, grit: 0 },
      // 지금 집으려는 잎. **이것이 이 실험의 변인 하나다** — 시든 잎을 쓰면 색소가 적다.
      // 실험대에서 잎을 누르면 열리는 잎 화면에서 고른다 (ui/zoom.js, `PICK_LEAF`).
      leafKind: LEAF_KINDS.FRESH,
      // 몇 장째 거름종이인가. 통에 넉넉히 있으므로 바닥나지 않는다 —
      // 소모품이 바닥나면 그건 결과가 아니라 막다른 길이다.
      papersUsed: 0,
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

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 상층액의 색소 농도 0~1.
 *
 * 잎을 넣고, 추출액을 넣고, 흔들어야 나온다. 추출액을 너무 많이 넣으면 **묽어진다** —
 * 막지 않는다. 묽은 상층액을 찍으면 띠가 흐리게 나오고, 그것이 답이다.
 */
export function extractStrength(tube) {
  if (tube.leaf <= 0 || tube.extract <= 0) return 0;
  // 중요한 것은 절대량이 아니라 **비율**이다. 추출액이 모자라면 다 못 뽑고,
  // 넘치면 묽어진다. 1 : 1 을 가장 좋은 자리로 둔다.
  const ratio = tube.extract / tube.leaf;
  const fit = ratio <= 1 ? ratio : Math.min(1, 2 / (1 + ratio));
  return clamp01(fit * (0.25 + 0.75 * tube.shaken) * tube.leafFresh);
}

/** 층이 갈렸는가. 갈리기 전에 뽑으면 부스러기가 딸려 온다. */
export function isSettled(tube) {
  return tube.settleT >= 0.99;
}

/** 원점이 전개액에 잠겼는가. 이 실험에서 가장 크게 갈리는 한 줄이다. */
export function isSubmerged(paper, vial) {
  const origin = paper.originMm ?? ORIGIN_MM;
  return paper.inVial && vial.depthMm >= origin;
}

/** 용매 전선의 지금 높이 (mm) */
export function currentFrontMm(paper) {
  return frontMm(paper.runT, paper.depthAtRun);
}

/** 전선이 종이 끝을 넘어가 **잴 수 없게** 됐는가 */
export function frontOverrun(paper) {
  return isOverrun(paper.runT, paper.depthAtRun);
}

/** 전개가 얼마나 진행됐는가 0~1 — 진행 표시에만 쓴다. 시계가 아니다. */
export function runProgress(paper) {
  return clamp01(riseMm(paper.runT) / (PAPER_H_MM - paper.depthAtRun || PAPER_H_MM));
}

/**
 * 잴 수 있는 용매 전선 높이. 없으면 null.
 *
 * 표시해 두었으면 그 값, 아직 젖어 있으면 눈에 보이는 지금 값, 말라 버렸는데 표시를
 * 안 했으면 **없다.** 꺼내자마자 표시하라는 절차가 왜 있는지를 이것이 설명한다.
 */
export function measurableFrontMm(paper) {
  if (paper.markedFront !== null) return paper.markedFront;
  if (frontOverrun(paper)) return null;
  if (paper.wetness > 0.15) return currentFrontMm(paper);
  return null;
}

/** 남아 있는 색소량 0~1 — 씻김·빛·시듦을 다 뺀 값 */
export function pigmentLoad(paper) {
  return clamp01(paper.load * (1 - paper.washedOut));
}

/** 빛에 잃은 정도. 엽록소 두 가지에만 걸린다. */
export function chlorophyllKept(paper) {
  return clamp01(1 - paper.lightDose * 0.85);
}

/**
 * 렌더러에 넘길 값만 추린 뷰. 이 객체가 거름종이 그림을 완전히 결정한다.
 * 기록(CAPTURE)도 이것을 통째로 담는다 — 두 벌을 따로 만들면 어긋난다.
 */
export function stripParams(state) {
  const p = state.paper;
  const originMm = p.originMm ?? ORIGIN_MM;
  return {
    originMm,
    marker: p.marker,
    spots: p.spots,
    spotMm: p.spotMm,
    load: pigmentLoad(p),
    // 씻겨 나가기 전에 **실린** 양. load 와 나누어 두어야 화면이 "덜 찍었다" 와
    // "잠겨서 씻겼다" 를 갈라 말할 수 있다 — 학생이 고쳐야 할 것이 서로 다르다.
    rawLoad: p.load,
    grit: p.grit,
    frontMm: currentFrontMm(p),
    overrun: frontOverrun(p),
    markedFront: p.markedFront,
    markedBands: p.markedBands,
    rulerPlaced: p.rulerPlaced,
    submerged: isSubmerged(p, state.vial),
    washedOut: p.washedOut,
    chlorophyllKept: chlorophyllKept(p),
    wetness: p.wetness,
    torn: p.torn,
    depthMm: p.inVial ? state.vial.depthMm : 0,
    /*
     * **전개할 때의 깊이.** 위 `depthMm` 은 그림용이라 종이를 꺼내면 0 이 된다 — 그대로
     * 카드와 보고서에 실렸더니 「전개액 깊이 0 mm」가 찍혔다. 학생이 5 mm 를 붓고 세운 조건이
     * 종이에서는 안 부은 것으로 읽힌다. 조건은 여기서 읽는다.
     */
    runDepthMm: p.depthAtRun,
    inVial: p.inVial,
    seed: p.seed,
  };
}
