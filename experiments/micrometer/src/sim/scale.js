/**
 * 두 눈금자가 시야에서 어떻게 겹치는가 — 순수 기하.
 *
 * ── 왜 1차원으로 푸는가 ────────────────────────────────────────────
 * 학생이 하는 일은 **접안 눈금자를 따라가며 대물 눈금선과 맞아떨어지는 자리를 찾는 것**이다.
 * 그러니 축은 하나로 충분하다 — 접안 눈금자의 축. 두 자가 기울어진 것은 "축이 두 개" 가
 * 아니라 **맞아떨어지는 자리에서 멀어질수록 두 선이 옆으로 벌어진다**는 뜻이고,
 * 그건 `usableRunDiv` 한 값으로 들어온다 (`optics.js`).
 *
 * 2차원으로 풀면 코드는 그럴듯해지지만 학생이 겪는 것은 달라지지 않고,
 * 검증만 어려워진다.
 *
 * ── 여기서 하지 않는 것 ────────────────────────────────────────────
 * **겹친 자리를 찾아 주지 않는다.** `coincidences()` 는 시뮬레이터가 자기 그림을 그리고
 * 학생의 클릭을 눈금 번호로 옮기는 데 쓰는 것이지, 화면에 강조 표시를 하기 위한 것이 아니다
 * (`DESIGN-rules.md` M-25). 찾는 일은 학생 눈이 한다.
 */

import {
  RETICLE_DIVS, STAGE_DIV_UM, umPerEyepieceDiv, usableRunDiv,
} from './optics.js';
import { angleGap, centerErr, PAN_LIMIT } from './state.js';

/**
 * 대물 눈금 한 칸이 **접안 눈금 몇 칸**으로 보이는가.
 *
 * 이 값 하나가 배율에 따라 달라지는 전부다. 100배에서 1.0(두 자가 포개진다),
 * 400배에서 4.0(접안 4칸이 대물 1칸). 학생이 발견해야 하는 것이 바로 이 수의 변화다.
 */
export function stageDivInEyeDivs(objective) {
  return STAGE_DIV_UM / umPerEyepieceDiv(objective);
}

/**
 * 대물 눈금자가 접안 눈금자 위에서 얼마나 밀려 있는가(접안 칸 단위, 0~1 의 소수부).
 *
 * 재물대를 옮기면(`panX`) 대물 눈금선 전체가 함께 밀린다. 이 위상차가 0 이 아니면
 * 두 자의 0번 선끼리 안 맞고, 학생은 **어딘가 맞아떨어지는 다른 자리**를 찾아야 한다.
 * 시드로 흩뜨리지 않고 `panX` 에서 그대로 끌어오는 이유는, 학생이 옮긴 만큼만
 * 달라지는 것이 실제와 같기 때문이다.
 */
export function stagePhase(state) {
  const perDiv = stageDivInEyeDivs(state.microscope.objective);
  const shifted = (state.microscope.panX ?? 0) / PAN_LIMIT * RETICLE_DIVS * 0.25;
  const p = shifted % perDiv;
  return p < 0 ? p + perDiv : p;
}

/**
 * 접안 눈금 `k` 번 선에서 가장 가까운 대물 눈금선까지의 거리(접안 칸).
 * 0 이면 딱 맞아떨어진 자리다.
 */
export function gapAtDiv(state, k) {
  const perDiv = stageDivInEyeDivs(state.microscope.objective);
  const rel = (k - stagePhase(state)) / perDiv;
  const frac = Math.abs(rel - Math.round(rel));
  return frac * perDiv;
}

/**
 * 그 자리에서 두 선이 **옆으로** 얼마나 벌어져 있는가(접안 칸).
 *
 * 두 자가 기울어져 있으면 한 곳에서만 만나고, 거기서 멀어질수록 벌어진다.
 * `usableRunDiv` 가 「판독 한계 0.5칸을 넘기 전까지 몇 칸을 갈 수 있는가」이므로,
 * 중심에서 k 칸 떨어진 자리의 옆벌어짐은 그 비율로 커진다.
 */
export function skewDriftAtDiv(state, k) {
  return Math.abs(signedDrift(state, k));
}

/**
 * 어느 쪽으로 밀렸는가까지 담은 벌어짐. **부호가 결정적이다.**
 *
 * 기운 자는 만나는 지점을 기준으로 한쪽은 앞으로, 반대쪽은 뒤로 밀린다.
 * 부호 없이 절댓값만 쓰면 양쪽 밀림이 같은 방향이 되어 **뺄셈에서 상쇄된다** —
 * 그러면 정렬을 아무리 안 맞춰도 눈금값이 정확히 나오고, 학생이 접안렌즈를 돌릴
 * 이유가 사라진다. 실제로 그렇게 만들었다가 값이 참값과 똑같이 나오는 것을 보고 고쳤다.
 */
export function signedDrift(state, k) {
  const run = usableRunDiv(angleGap(state));
  const center = RETICLE_DIVS / 2;
  return (k - center) / Math.max(run, 1e-6) * 0.5;
}

/**
 * 시야 안에서 **볼 수 있는** 접안 눈금 번호의 범위.
 *
 * 눈금자가 중심에서 밀려나면 시야 원 밖으로 나간 쪽은 안 보인다. 안 보이는 자리는
 * 찍을 수도 없고 셀 수도 없다 — 「중앙 정렬」이 결과에 닿는 통로가 이것이다.
 */
export function visibleRange(state) {
  const err = centerErr(state.microscope);
  const half = (RETICLE_DIVS / 2) * (1 - err * 0.7);
  const center = RETICLE_DIVS / 2 + err * RETICLE_DIVS * 0.25;
  return { from: Math.max(0, center - half), to: Math.min(RETICLE_DIVS, center + half) };
}

/**
 * 두 눈금선이 맞아떨어지는 자리들.
 *
 * `eps` 는 사람이 「맞았다」고 볼 수 있는 한계다. 여기서 나오는 목록은 시뮬레이터가
 * 자기 그림을 그리고 클릭을 번호로 옮기는 데 쓴다. **화면에 표시하지 않는다.**
 */
export function coincidences(state, eps = 0.08) {
  const out = [];
  if (!state.eyepiece.micrometer || !state.microscope.stage) return out;
  const { from, to } = visibleRange(state);
  const perDiv = stageDivInEyeDivs(state.microscope.objective);
  for (let k = Math.ceil(from); k <= Math.floor(to); k++) {
    const gap = gapAtDiv(state, k);
    const drift = skewDriftAtDiv(state, k);
    if (gap + drift > eps) continue;
    out.push({
      eyeDiv: k,
      stageDiv: Math.round((k - stagePhase(state)) / perDiv),
      gap: gap + drift,
    });
  }
  return out;
}

/**
 * 학생이 시야의 한 자리를 찍었다. **가장 가까운 두 선을 잡고 어긋남을 남긴다.**
 *
 * 스냅하지 않는다. 겹치지 않은 자리를 찍으면 그 어긋남이 `gap` 으로 그대로 남고,
 * 눈금값에 섞여 들어간다. 학생은 자기 손끝의 오차를 「틀렸습니다」가 아니라
 * **같은 배율에서 두 번 구한 값의 차이**로 만난다.
 *
 * @param {number} xNorm  시야 지름을 -1~1 로 잡은 가로 위치
 */
export function pickAt(state, xNorm) {
  const { from, to } = visibleRange(state);
  const raw = from + ((xNorm + 1) / 2) * (to - from);
  const eyeDiv = Math.round(Math.max(from, Math.min(to, raw)));
  const perDiv = stageDivInEyeDivs(state.microscope.objective);
  const drift = signedDrift(state, eyeDiv);
  const gap = gapAtDiv(state, eyeDiv) + Math.abs(drift);

  // **어긋난 자리를 찍으면 읽는 번호가 실제로 틀린다.**
  // 두 자가 기울어 있으면 어느 대물 선이 맞은 것인지 눈으로 가릴 수가 없다.
  // 여기서 어긋남을 기록만 하고 번호는 정확히 돌려주면, 설계가 말한 귀결
  // (「오차가 눈금값에 그대로 들어간다」)이 일어나지 않는다 — 학생은 아무리 대충
  // 찍어도 늘 같은 답을 얻고, 그러면 정렬을 맞출 이유가 없어진다.
  const misread = Math.round(drift / perDiv);
  return {
    eyeDiv,
    stageDiv: Math.round((eyeDiv - stagePhase(state)) / perDiv) + misread,
    gap,
  };
}

/**
 * 찍은 두 지점으로 접안 눈금 한 칸의 길이를 구한다.
 *
 * **막지 않는다.** 대물 눈금이 한 칸도 안 들어간 구간(`stageDivs === 0`)이면
 * 나눌 수가 없으므로 `umPerDiv` 가 `null` 로 남는다 — 「구할 수 없었다」가
 * 빈칸으로 기록되는 것이지, 조작이 거부되는 것이 아니다 (M-17).
 */
export function calibrationFrom(picks) {
  const [a, b] = picks;
  if (!a || !b) return null;
  const eyeDivs = Math.abs(b.eyeDiv - a.eyeDiv);
  const stageDivs = Math.abs(b.stageDiv - a.stageDiv);
  const gap = (a.gap + b.gap) / 2;
  const umPerDiv = eyeDivs > 0 && stageDivs > 0
    ? (stageDivs * STAGE_DIV_UM) / eyeDivs
    : null;
  return { eyeDivs, stageDivs, umPerDiv, gap };
}
