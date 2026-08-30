/**
 * 상태 모델. 이 파일은 DOM 을 모른다 — `document`·`window`·`Date.now()`·`Math.random()`
 * 을 쓰면 안 된다. 그래야 `node --test` 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조.
 */

import { H2O2_STANDARD_PCT, PH_OPTIMUM } from './kinetics.js';

/* ------------------------------------------------------------------ */
/* 변인 — 이 실험의 몸통                                                */
/* ------------------------------------------------------------------ */

/**
 * 조작변인으로 고를 수 있는 것.
 *
 * **이 목록이 변인 설계 UI 의 유일한 출처다** (`src/ui/design.js`).
 * 화면 코드에 「온도」·「pH」를 박지 않는다 — 그래야 같은 UI 를 다른 실험이 재활용한다.
 */
export const INDEPENDENT_VARIABLES = ['temp', 'ph'];

/** 조작변인 하나가 실제로 건드리는 조건 칸. 통제변인 목록에서 이 칸을 빼는 데 쓴다. */
export const VARIABLE_KEY = { temp: 'tempC', ph: 'ph' };

/**
 * 조건마다 학생이 고를 수 있는 값들.
 *
 * 여기 없는 값도 상태에는 들어갈 수 있다 — 이 목록은 **화면이 무엇을 내놓을지**이지
 * 무엇을 허용할지가 아니다. 막는 것은 이 프로젝트의 방식이 아니다 (AGENTS.md §2.1).
 */
export const CHOICES = {
  tempC: [0, 20, 37, 60, 100],
  ph: [3, 5, 7, 9, 11],
  h2o2Pct: [1, 2, 3],
  extractPct: [25, 50, 100],
};

/** pH 를 무엇으로 맞췄는가. `none` 은 아무것도 안 넣은 것 — 과산화수소수 그대로다. */
export const PH_METHODS = { NONE: 'none', BUFFER: 'buffer', ACID_BASE: 'acidbase' };

/**
 * 종속변인은 하나뿐이라 고를 것이 없다.
 * 그래도 이름을 두는 것은, 탐구 노트와 보고서가 「무엇을 쟀는가」를 이 한 곳에서 읽기 때문이다.
 */
export const DEPENDENT_VARIABLE = 'riseTime';

/* ------------------------------------------------------------------ */
/* 초기 상태                                                           */
/* ------------------------------------------------------------------ */

/** 통제변인의 기본 목표값. 기준 조건과 같다 (`kinetics.js` 의 T_REF_S 가 재는 조건). */
export function defaultControls() {
  return {
    tempC: 20,
    ph: PH_OPTIMUM,
    h2o2Pct: H2O2_STANDARD_PCT,
    extractPct: 100,
    buffered: true,
    /**
     * 감자즙을 끓인 것으로 쓰는가.
     *
     * 처음에는 통제변인에 넣지 않았다. 그러자 **실수로 끓인 감자즙을 쓴 시행이
     * 아무 표시 없이 깨끗한 점으로 찍혔다** — pH 계열에서 pH 7 자리에만 끓인 것을 쓰면
     * 「카탈레이스는 pH 7 에서 활성이 없다」가 학생이 읽는 결론이 된다.
     * 실험대에서 끓인 감자즙 통이 생감자즙 바로 옆에 있어 헷갈리기 쉽다.
     *
     * 통제변인으로 두면 설계와 어긋난 것이 그래프에서 이름과 함께 드러난다.
     * 대조군으로 **일부러** 쓸 때는 설계에서 골라 두면 되고, 그것이 곧 「대조군을 두었다」는 뜻이다.
     */
    extractBoiled: false,
  };
}

/** 빈 비커 하나. */
export function initialBeaker() {
  return {
    // null 은 「아직 안 부었다」다. 0(물만 부었다)과 다르다 — 학생이 한 일이 다르므로
    // 화면이 다른 말을 해야 한다.
    h2o2Pct: null,
    ph: PH_OPTIMUM,
    phMethod: PH_METHODS.NONE,
    tempC: 20,
    inBath: false,
    cracked: false,
    disc: null,          // { extractPct, extractBoiled }
    /**
     * 원반을 넣은 **그 순간의 조건 한 벌.**
     *
     * 넣은 뒤에 수조를 옮기거나 pH 를 바꾸면 비커의 지금 조건은 달라지는데,
     * **이미 잰 시간은 그때 조건에서 나온 값**이다. 기록할 때 지금 조건을 다시 읽으면
     * 20 ℃ 에서 잰 25 초가 37 ℃ 시행으로 남는다 — 아무 표시도 없이.
     *
     * 그래서 넣는 순간에 얼려 둔다. 재는 도중에 조건을 바꾸면 시행 자체를 되감으므로
     * (`rules.js`), 이 값과 비커의 조건이 어긋난 채로 재고 있는 일은 생기지 않는다.
     */
    runConditions: null,
    elapsedS: 0,
    floated: false,
    floatedAtS: null,
  };
}

export function initialBench() {
  return {
    extract: { pct: 100, boiled: false, ready: false },
    disc: { punched: false, soakedPct: 0, soakedBoiled: false, held: false },
    beaker: initialBeaker(),
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
 * 혼자 하는가, 모둠으로 하는가.
 *
 * 활동지가 갈린다 — 혼자 하는 학생에게 「다른 모둠의 결과와 비교해 보세요」를 물으면
 * 답할 수 없는 것을 묻는 셈이고, 빈칸으로 남은 문항은 「못 한 일」로 읽힌다.
 */
export const MODES = { SOLO: 'solo', GROUP: 'group' };

export function initialState(level = 1, seed = 20260826, mode = MODES.GROUP) {
  return {
    design: {
      // 조작변인은 **비워 두고 시작한다.** 1단계에서도 대신 골라 주지 않는다 —
      // 무엇을 바꿔 볼지 정하는 것이 이 실험에서 배울 것이라, 채워 주면 실험이 사라진다.
      independent: null,
      controls: defaultControls(),
      declared: false,
    },
    bench: initialBench(),
    trials: [],
    session: {
      level,
      seed,
      mode,
      step: '1a',
      notes: {},
      // 탐구 노트에서 **읽은** 단계. 실험대는 이것이 다 차야 열린다.
      // 읽었다는 사실은 조작이 아니라서 되돌리기 기록에 쌓지 않는다.
      readStages: [],
      log: [],            // { at, action, outcome, tag } — 되돌아보기용. at 은 순번이다
      /**
       * 다음 시행에 붙일 번호. **한 번 쓴 번호는 다시 쓰지 않는다.**
       * 남은 시행에서 최댓값을 뽑는 방식이었는데, 마지막 것을 지우면 같은 번호가 다시 붙어
       * 그 번호에 딸린 노트가 새 시행의 것이 됐다.
       */
      trialSeq: 0,
      history: [],
      undosLeft: UNDO_LIMITS[level] ?? Infinity,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 파생값 — 저장하지 않고 그때그때 계산한다                            */
/* ------------------------------------------------------------------ */

/**
 * 비커 상태 → `kinetics.js` 가 받는 조건 한 벌.
 *
 * **이 함수가 이 실험의 유일한 통로다.** 그림도 계산도 기록도 전부 여기를 거친다.
 * 비커 상태를 직접 읽는 코드가 따로 생기면, 조건을 하나 더할 때 두 곳이 어긋난다.
 */
export function beakerConditions(beaker) {
  return {
    tempC: beaker.tempC,
    ph: beaker.ph,
    // 안 부은 비커는 농도가 0 이다 — 발생 속도가 0 이라 원반이 영원히 안 뜬다.
    // 빈 비커에 원반을 넣는 것은 물리적으로 성립하는 일이라 막을 이유가 없고,
    // 아무 일도 안 일어나는 것이 답이다.
    h2o2Pct: beaker.h2o2Pct ?? 0,
    // 안 담근 원반은 효소가 0 이다. 그래도 **염기 갈래는 살아 있다** —
    // 완충하지 않은 pH 11 에서는 안 담근 원반도 뜬다. 이 실험의 가장 중요한 대조군이다.
    extractPct: beaker.disc?.extractPct ?? 0,
    extractBoiled: beaker.disc?.extractBoiled ?? false,
    // 산·염기를 그대로 부었을 때만 완충이 아니다. 아무것도 안 넣은 비커는
    // pH 7 이라 어느 쪽이든 염기 분해가 없으므로 완충으로 둔다.
    buffered: beaker.phMethod !== PH_METHODS.ACID_BASE,
  };
}

/** 설계에서 조작변인이 차지한 칸. 통제변인 목록에서 이 칸을 뺀다. */
export function controlledKeys(design) {
  const taken = VARIABLE_KEY[design.independent];
  return Object.keys(defaultControls()).filter((k) => k !== taken);
}

/**
 * 설계와 어긋난 통제변인의 목록.
 *
 * **막는 데 쓰지 않는다.** 그래프가 이 목록을 읽어 그 점을 선에서 떼어 놓고,
 * 무엇이 어긋났는지 이름으로 말한다. 어긋난 시행을 보는 것이 이 실험이 가르치려는 것이다.
 *
 * 조작변인을 아직 안 골랐으면 통제변인이 무엇인지도 정해지지 않았다.
 * 그때는 **빈 목록**을 준다 — 「전부 어긋났다」고 말하면 아무것도 안 한 학생을 나무라는 꼴이다.
 */
export function offDesign(design, conditions) {
  if (!design.independent) return [];
  return controlledKeys(design).filter((k) => conditions[k] !== design.controls[k]);
}

/** 원반이 들어 있고 시간이 흐르고 있는가. */
export function isRunning(beaker) {
  return Boolean(beaker.disc) && !beaker.floated;
}

/**
 * 지금 재고 있는(또는 방금 잰) 시행의 조건.
 *
 * 원반이 들어 있으면 **넣은 순간에 얼려 둔 것**을 쓴다. 비커의 지금 조건이 아니다.
 * 그림도 기록도 이 하나를 읽어야 「화면에 보이는 것」과 「기록되는 것」이 같아진다.
 */
export function activeConditions(beaker) {
  return beaker.runConditions ?? beakerConditions(beaker);
}

/** 관찰 시간을 넘겼는가. `kinetics.js` 의 OBSERVE_LIMIT_S 를 쓴다. */
export { OBSERVE_LIMIT_S } from './kinetics.js';
