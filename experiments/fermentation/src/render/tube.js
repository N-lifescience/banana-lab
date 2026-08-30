/**
 * 결과 렌더러 — 발효관과 맹관부에 모이는 기체.
 *
 * **이 실험의 결과는 그림이 몸통이고 그래프는 보조다.** 교과서는 무선 CO₂ 센서로 재지만,
 * 센서 곡선 하나만 보여 주면 그래프 뷰어가 된다.
 *
 * ── 이 파일이 그림을 그리지 않는다 ────────────────────────────────
 * 기구 그림은 `src/assets/fermtube.js` 가 갖고 있다. 여기서는 **상태를 만들어 넘기고
 * id 에 앞가지를 붙이는 일**만 한다. 그래야 실험대의 발효관과 결과 화면의 발효관이
 * 같은 그림이 된다 — 두 곳에서 따로 그리면 학생이 옮겨 갈 때마다 다른 관을 본다.
 *
 * 순수 함수다. 같은 입력이면 같은 SVG 가 나오고 `Math.random()` 을 쓰지 않는다.
 * docs/05-result-renderer.md 참조.
 */

import { ASSETS } from '../assets/index.js';
import {
  fillFraction, gasVolume, gasAfterKoh, gasRate,
  CLOSED_ARM_CAPACITY_ML, OBSERVE_LIMIT_MIN,
} from '../sim/fermentation.js';
import { activeConditions, tubeConditions, STANDARD_TOTAL_ML } from '../sim/state.js';

/**
 * 팽대부에 담긴 것의 이름.
 *
 * **무엇을 부었는가로 정한다.** 「효모액이 들었다」와 「증류수만 들었다」가 눈으로 갈려야
 * 대조군을 대조군으로 볼 수 있다. 수산화 칼륨을 넣은 뒤는 또 다른 것이다.
 */
export function liquidKind(tube) {
  if (tube.kohMl > 0) return 'KOH';
  if (tube.glucoseMl + tube.yeastMl + tube.waterMl <= 0) return null;
  if (tube.yeastMl > 0) return 'BREW';
  if (tube.glucosePct > 0) return 'GLUCOSE';
  return 'WATER';
}

/**
 * 지금 맹관부에 있는 기체의 양 (mL).
 *
 * 수산화 칼륨을 넣었으면 흡수된 뒤의 양이다 — **줄어드는 것을 보는 것이 CO₂ 확인**이다.
 * 계산은 전부 `fermentation.js` 가 한다. 여기서 다시 하면 그림과 기록이 다른 말을 한다.
 */
export function gasNow(tube) {
  const raw = gasVolume(activeConditions(tube), tube.elapsedMin);
  return gasAfterKoh(raw, tube.kohMl);
}

/**
 * 발효관 상태 → 애셋이 받는 상태 한 벌.
 *
 * **실험대와 결과 화면이 이 함수 하나를 함께 쓴다.** 두 곳에서 따로 만들면
 * 상태를 하나 늘릴 때마다 한쪽이 조용히 옛 그림을 그린다.
 */
export function tubeAssetState(tube) {
  const conditions = activeConditions(tube);
  const total = tube.glucoseMl + tube.yeastMl + tube.waterMl;
  return {
    // 맹관부에 남은 기체의 비율. 흡수된 뒤의 양으로 그린다.
    fill: Math.min(gasNow(tube) / CLOSED_ARM_CAPACITY_ML, 1),
    liquid: liquidKind(tube),
    /**
     * 관에 담긴 양. 표준 배치(35 mL)를 가득으로 본다 — 눈금이 아니라 보이는 양이다.
     *
     * **가득이 곧 맹관부까지 찬 것**이다. 큐네 발효관은 처음에 맹관부에 공기가 남지 않게
     * 채우는 것이 절차이고, 거기 모이는 기체는 나중에 발효로 난 것뿐이어야 한다.
     *
     * 팽대부를 빼낸 뒤에는 **넣은 수산화 칼륨만큼만** 남는다. 빼내고도 가득 찬 것으로
     * 그리면 스포이트로 빼낸 일이 그림에서 사라진다 — 실제로 그렇게 두었다가 고쳤다.
     */
    level: tube.drained
      ? Math.min(tube.kohMl / STANDARD_TOTAL_ML, 1)
      : Math.min(total / STANDARD_TOTAL_ML, 1),
    plugged: tube.plugged,
    // 기포는 **지금 실제로 발효가 일어나고 있을 때만** 올라온다.
    // 다 끝난 관에 기포를 계속 그리면 학생이 아직 진행 중인 줄 안다.
    bubbling: tube.inIncubator
      && tube.elapsedMin > 0
      && tube.elapsedMin < OBSERVE_LIMIT_MIN
      && gasRate(conditions) > 0,
    drained: tube.drained,
  };
}

/**
 * id 에 앞가지를 붙인다.
 *
 * 한 화면에 발효관을 여러 개 그리면 `id="glass"` 가 여럿이 되고, 브라우저는 첫 번째만
 * 찾는다 — **에러 없이 조용히** 틀린다. 바나나랩에서 물린 자리다 (`PLAYBOOK.md` §9).
 *
 * ── `url(#...)` 도 함께 고쳐야 한다 ───────────────────────────────
 * 발효관 애셋은 관 안쪽만 남기려고 `clipPath` 를 쓰고 `clip-path="url(#ftBore)"` 로
 * 가리킨다. **id 만 바꾸고 가리키는 쪽을 그대로 두면 잘라 내기가 통째로 풀린다** —
 * 액체와 기체가 유리 밖으로 삐져나오는데, 콘솔에는 아무 말도 안 나온다.
 * 처음 짤 때 실제로 그렇게 두었고, `tests/tube.test.js` 가 그것을 잡는다.
 *
 * 앞가지를 붙인 그림에는 `applyState()` 를 쓰지 않는다 (선택자가 안 맞는다).
 * 다시 그리는 쪽이 값싸고, 여기서 그리는 것은 결과 화면이라 자주 바뀌지 않는다.
 */
function prefixIds(svg, idPrefix) {
  return svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${idPrefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${idPrefix}-${id})`);
}

/**
 * 발효관 하나를 그린다.
 *
 * @param {object} tube  `state.bench.tube` 또는 시행에서 되살린 발효관
 * @param {{idPrefix?: string}} opts
 */
export function renderTube(tube, { idPrefix = 't' } = {}) {
  const svg = ASSETS.fermtube.render(tubeAssetState(tube));
  return prefixIds(svg, idPrefix);
}

/**
 * 기록한 시행 하나를 발효관 그림으로 되살린다.
 *
 * 시행에는 조건과 결과만 남는다 — 그림을 저장하지 않는다. 그래서 되살릴 수 있어야 한다
 * (그것이 렌더러를 순수 함수로 둔 이유다). 여기서 만드는 발효관은 **관찰이 끝난 상태**다.
 */
export function tubeFromTrial(trial) {
  const c = trial.conditions;
  return {
    glucosePct: c.glucosePct,
    glucoseMl: c.totalMl - c.yeastMl,
    yeastMl: c.yeastMl,
    waterMl: c.yeastMl > 0 ? 0 : 0,
    plugged: c.plugged,
    tempC: c.tempC,
    inIncubator: false,
    runConditions: c,
    elapsedMin: trial.minutes,
    drained: false,
    kohMl: 0,
  };
}

/**
 * 기록한 시행들을 발효관 그림 한 줄로.
 *
 * **여기가 「발효관 세 개를 늘어놓고 견주는」 자리다.** 교과서의 A·B·C 배치는 세 관을
 * 나란히 놓고 보는 것인데, 이 시뮬레이터는 한 번에 한 관을 다루므로 견주는 일이
 * 기억에 맡겨진다. 기록한 것을 그림으로 되살려 늘어놓으면 그 견줌이 화면으로 돌아온다.
 */
export function renderTrialTubes(trials = [], { idPrefix = 'tt' } = {}) {
  return trials.map((t) => ({
    at: t.at,
    gasMl: t.gasMl,
    conditions: t.conditions,
    svg: renderTube(tubeFromTrial(t), { idPrefix: `${idPrefix}-${t.at}` }),
  }));
}

/**
 * 지금 발효관이 어떤 상태인가 — 화면이 말로 붙일 한 마디.
 *
 * **그림이 못 하는 말을 여기서 한다.** 「기체가 안 모였다」는 10 ℃ 든 55 ℃ 든 같은 그림이라,
 * 그림만으로는 왜인지 알 수 없다. 왜인지는 그래프의 설명이 말하고, 여기서는
 * 지금 무슨 일이 일어나고 있는지까지만 말한다.
 */
export function observationState(tube) {
  if (!tube.inIncubator && tube.runConditions === null) return 'idle';
  if (tube.elapsedMin < OBSERVE_LIMIT_MIN && tube.inIncubator) return 'running';
  if (gasNow(tube) <= 0) return 'no-gas';
  return 'done';
}

/** 팽대부에 지금 무엇이 얼마나 들었는가. 실험대 막대가 한 줄로 적는다. */
export function tubeContents(tube) {
  const parts = [];
  if (tube.glucoseMl > 0) {
    const pct = tube.glucosePct ?? 0;
    parts.push(`포도당 ${Number.isInteger(pct) ? pct : pct.toFixed(1)} % ${tube.glucoseMl} mL`);
  }
  if (tube.yeastMl > 0) parts.push(`효모액 ${tube.yeastMl} mL`);
  if (tube.waterMl > 0) parts.push(`증류수 ${tube.waterMl} mL`);
  if (tube.kohMl > 0) parts.push(`수산화 칼륨 ${tube.kohMl} mL`);
  return parts;
}

/** 조건 한 벌에서 그림에 쓸 채운 정도. 하네스가 조건만으로 그림을 볼 때 쓴다. */
export function fillFor(conditions, elapsedMin) {
  return fillFraction(conditions, elapsedMin);
}

/** 발효관 상태에서 조건 한 벌로. 하네스와 검사가 쓰는 통로. */
export { tubeConditions };
