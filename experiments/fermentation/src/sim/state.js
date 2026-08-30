/**
 * 상태 모델. 이 파일은 DOM 을 모른다 — `document`·`window`·`Date.now()`·`Math.random()`
 * 을 쓰면 안 된다. 그래야 `node --test` 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조.
 */

import {
  GLUCOSE_STANDARD_PCT, GLUCOSE_POUR_ML, YEAST_POUR_ML, STANDARD_TOTAL_ML,
  OPT_GROWTH_HIGH_C, Q10_REF_C, OBSERVE_LIMIT_MIN,
} from './fermentation.js';

/** 실험대와 탐구 노트와 규칙이 **같은 값**을 읽게 그대로 흘려보낸다. */
export { GLUCOSE_POUR_ML, YEAST_POUR_ML, STANDARD_TOTAL_ML, OBSERVE_LIMIT_MIN };

/* ------------------------------------------------------------------ */
/* 변인 — 이 실험의 몸통                                                */
/* ------------------------------------------------------------------ */

/**
 * 조작변인으로 고를 수 있는 것.
 *
 * **이 목록이 변인 설계 UI 의 유일한 출처다** (`src/ui/design.js`).
 * 화면 코드에 「온도」·「포도당 농도」를 박지 않는다 — 그래야 같은 UI 를 다른 실험이 재활용한다.
 *
 * **효모액 농도는 여기 없다.** 표준 변인은 기질 종류·기질 농도·온도다 (AGENTS.md §2.5).
 */
export const INDEPENDENT_VARIABLES = ['glucose', 'temp'];

/** 조작변인 하나가 실제로 건드리는 조건 칸. 통제변인 목록에서 이 칸을 빼는 데 쓴다. */
export const VARIABLE_KEY = { glucose: 'glucosePct', temp: 'tempC' };

/**
 * 조건마다 학생이 고를 수 있는 값들.
 *
 * 여기 없는 값도 상태에는 들어갈 수 있다 — 이 목록은 **화면이 무엇을 내놓을지**이지
 * 무엇을 허용할지가 아니다. 막는 것은 이 프로젝트의 방식이 아니다 (AGENTS.md §2.1).
 *
 * 포도당 0 % 는 **증류수만 부은 것**이다. 교과서의 세 배치에는 없지만, 기질이 없으면
 * 발효도 없다는 것을 눈으로 보는 자리라 축에 남겨 둔다 — 실험대의 증류수 병이 그 자리다.
 *
 * 온도 다섯은 위아래 두 갈래를 다 보게 고른 것이다 — 10 은 「거의 0」,
 * 30 은 최고점 가까이, 40 은 급감이 시작되는 자리, 55 는 「사실상 0」 (AGENTS.md §2.5).
 */
export const CHOICES = {
  glucosePct: [0, 5, 10],
  tempC: [10, 20, 30, 40, 55],
};

/**
 * 종속변인은 하나뿐이라 고를 것이 없다.
 * 그래도 이름을 두는 것은, 탐구 노트와 보고서가 「무엇을 쟀는가」를 이 한 곳에서 읽기 때문이다.
 */
export const DEPENDENT_VARIABLE = 'gasMl';

/* ------------------------------------------------------------------ */
/* 초기 상태                                                           */
/* ------------------------------------------------------------------ */

/**
 * 통제변인의 기본 목표값. 기준 조건과 같다.
 *
 * `yeast` 와 `plugged` 를 통제변인에 넣은 까닭:
 *
 * - `yeast` 가 거짓이면 **효모액 자리에 증류수를 넣은 대조군**이다. 실수로 그렇게 한 시행이
 *   아무 표시 없이 점으로 찍히면 「30 ℃ 에서는 발효가 안 된다」가 학생이 읽는 결론이 된다.
 *   대조군으로 **일부러** 쓸 때는 설계에서 골라 두면 되고, 그것이 곧 「대조군을 두었다」는 뜻이다.
 * - `plugged` 가 거짓이면 산소가 들어온다. 기체는 그대로 나지만 **발효인지 호흡인지
 *   갈라낼 수 없다.** 그림으로는 안 갈리는 차이라, 설계에 적어 두어야 그래프가 말해 준다.
 */
export function defaultControls() {
  return {
    glucosePct: GLUCOSE_STANDARD_PCT,
    tempC: OPT_GROWTH_HIGH_C,
    yeast: true,
    plugged: true,
  };
}

/** 빈 발효관 하나. */
export function initialTube() {
  return {
    /**
     * 팽대부에 부은 포도당 수용액의 농도.
     *
     * `null` 은 「아직 아무것도 안 부었다」다. 0(증류수만 부었다)과 **다르다** —
     * 학생이 한 일이 다르므로 화면이 다른 말을 해야 한다.
     */
    glucosePct: null,
    glucoseMl: 0,
    yeastMl: 0,
    /** 대조군에서 효모액 자리에 넣은 증류수. **총 부피를 같게 맞추는 것**이 이 칸의 뜻이다. */
    waterMl: 0,
    plugged: false,
    tempC: Q10_REF_C,
    inIncubator: false,
    /**
     * 항온기에 넣은 **그 순간의 조건 한 벌.**
     *
     * 넣은 뒤에 항온기를 옮기면 발효관의 지금 조건은 달라지는데, **이미 모인 기체는 그때
     * 조건에서 나온 것**이다. 기록할 때 지금 조건을 다시 읽으면 20 ℃ 에서 모은 기체가
     * 30 ℃ 시행으로 남는다 — 아무 표시도 없이.
     *
     * 그래서 넣는 순간에 얼려 둔다. 도중에 조건을 바꾸면 시행 자체를 되감으므로
     * (`rules.js`), 이 값과 발효관의 조건이 어긋난 채로 재고 있는 일은 생기지 않는다.
     */
    runConditions: null,
    elapsedMin: 0,
    /** 팽대부 용액을 스포이트로 빼냈는가. KOH 를 넣기 전에 하는 일이다. */
    drained: false,
    /** 넣은 40 % 수산화 칼륨 수용액의 양 (mL). */
    kohMl: 0,
  };
}

/**
 * 「만든 포도당 수용액」 병 — 학생이 직접 희석해서 채우는 빈 병.
 *
 * ── 왜 5 % 병을 미리 두지 않았나 ───────────────────────────────────
 * 5 % 는 **10 % 10 mL + 증류수 10 mL** 로 만드는 것이 이 실험의 절차다. 다 만들어진 병을
 * 선반에 놓아 두면 그 절차가 사라지고, 「같은 부피를 더하면 농도가 절반」이라는
 * 배울 것도 함께 사라진다.
 *
 * ── 계산이 틀리면 결과가 대신 답한다 ──────────────────────────────
 * 증류수를 두 번 더하면 3.3 % 가 된다. **막지 않는다.** 그 농도가 그대로 발효관에 들어가고,
 * 설계에 적어 둔 5 % 와 어긋나 그래프가 그 점을 선에서 떼어 놓는다.
 * 「희석 계산이 틀리면 조건 간 차이가 사라진다」를 눈으로 보는 자리다.
 */
export function initialMix() {
  return { glucoseMl: 0, waterMl: 0 };
}

/**
 * 만든 병의 농도 (%). 아무것도 안 넣었으면 `null` — 「빈 병」이지 「0 %」가 아니다.
 * 희석 계산을 **여기 한 곳에서만** 한다. 두 곳에 적으면 화면과 결과가 어긋난다.
 */
export function mixPct(mix) {
  const total = mix.glucoseMl + mix.waterMl;
  if (total <= 0) return null;
  return (GLUCOSE_STANDARD_PCT * mix.glucoseMl) / total;
}

export function initialBench() {
  return {
    mix: initialMix(),
    tube: initialTube(),
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

export function initialState(level = 1, seed = 20260827, mode = MODES.GROUP) {
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
 * 발효관 상태 → `fermentation.js` 가 받는 조건 한 벌.
 *
 * **이 함수가 이 실험의 유일한 통로다.** 그림도 계산도 기록도 전부 여기를 거친다.
 * 발효관 상태를 직접 읽는 코드가 따로 생기면, 조건을 하나 더할 때 두 곳이 어긋난다.
 */
export function tubeConditions(tube) {
  return {
    tempC: tube.tempC,
    // 아무것도 안 부은 발효관은 포도당이 0 이다 — 발효할 것이 없어 기체가 안 모인다.
    // 빈 발효관을 항온기에 넣는 것은 물리적으로 성립하는 일이라 막을 이유가 없고,
    // 아무 일도 안 일어나는 것이 답이다.
    glucosePct: tube.glucosePct ?? 0,
    yeastMl: tube.yeastMl,
    totalMl: tube.glucoseMl + tube.yeastMl + tube.waterMl,
    plugged: tube.plugged,
  };
}

/** 설계에서 조작변인이 차지한 칸. 통제변인 목록에서 이 칸을 뺀다. */
export function controlledKeys(design) {
  const taken = VARIABLE_KEY[design.independent];
  return Object.keys(defaultControls()).filter((k) => k !== taken);
}

/**
 * 통제변인 한 칸을 조건 한 벌에서 읽는다.
 *
 * `yeast` 만 조건에 그 이름으로 없다 — 조건은 **몇 mL 를 넣었는가**를 담고,
 * 설계는 **넣었는가 아닌가**를 담기 때문이다. 부피가 결과를 바꾸므로 조건 쪽이 더 자세하다.
 * 이 한 곳에서 이어 주면 나머지 코드는 둘의 차이를 몰라도 된다.
 */
export function conditionValue(key, conditions) {
  if (key === 'yeast') return conditions.yeastMl > 0;
  return conditions[key];
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
  return controlledKeys(design)
    .filter((k) => conditionValue(k, conditions) !== design.controls[k]);
}

/**
 * 총 부피가 남들과 다른 시행들.
 *
 * ── 왜 통제변인 칩으로 두지 않았나 ─────────────────────────────────
 * 부피는 **고르는 것이 아니라 붓는 것**이다. 칩으로 두면 「35 mL」를 눌러 놓고 20 mL 만
 * 부어도 설계와 맞는 것이 되어, 정작 어긋난 것을 못 잡는다.
 *
 * ── 왜 35 mL 와 견주지 않고 서로 견주나 ────────────────────────────
 * 표준 배치는 35 mL 지만, **일관되기만 하면 다른 부피로도 비교는 성립한다.**
 * 35 를 못 박으면 맞는 일을 한 학생에게 빨간불이 나고, 그러면 이 표시를 아무도 안 믿는다
 * (`PLAYBOOK.md` §8). 그래서 **가장 많이 쓴 부피에서 벗어난 시행**만 짚는다.
 *
 * 이것이 「대조군에 증류수를 넣는 까닭」이 화면에서 대답하는 자리다 — 효모액 자리를
 * 비워 두면 그 시행만 부피가 달라져 여기 걸린다.
 */
export function volumeOutliers(trials = []) {
  if (trials.length < 2) return [];
  const count = new Map();
  for (const t of trials) {
    count.set(t.conditions.totalMl, (count.get(t.conditions.totalMl) ?? 0) + 1);
  }
  let common = null;
  let best = -1;
  for (const [ml, n] of count) if (n > best) { best = n; common = ml; }
  // 전부 제각각이면 「대세」라는 것이 없다. 그때는 아무것도 짚지 않는다 —
  // 다 틀렸다고 말하는 것은 아무것도 말하지 않는 것과 같다.
  if (best < 2) return [];
  return trials.filter((t) => t.conditions.totalMl !== common);
}

/** 발효관이 항온기에 들어 있고 아직 관찰 시간이 남았는가. */
export function isRunning(tube) {
  return tube.inIncubator && tube.elapsedMin < OBSERVE_LIMIT_MIN;
}

/**
 * 지금 재고 있는(또는 방금 잰) 시행의 조건.
 *
 * 항온기에 넣었으면 **넣은 순간에 얼려 둔 것**을 쓴다. 발효관의 지금 조건이 아니다.
 * 그림도 기록도 이 하나를 읽어야 「화면에 보이는 것」과 「기록되는 것」이 같아진다.
 */
export function activeConditions(tube) {
  return tube.runConditions ?? tubeConditions(tube);
}
