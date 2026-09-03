/**
 * 관찰 가능성 — 합격선이 아니라 상태 지표.
 *
 * 학생을 통과·불통과로 가르지 않는다. 지금 시야가 얼마나 볼 만한지를 0~100 으로 보여 주고,
 * 정리 단계에서 "왜 이 값이 나왔는지" 스스로 설명하게 하는 데 쓴다.
 *
 * ── 이 실험에서 **점수에 넣지 않는 것** ────────────────────────────
 *
 * **배율.** 바나나랩은 「이 관찰은 400배에서 해야 한다」였다. 이 실험은 **100배도 400배도
 * 정답이다** — 둘을 견주는 것이 실험의 몸통이다. 배율이 감점 항목이면 화면이
 * "400배로 올리세요" 라고 안내하게 되고, 그건 학생이 스스로 발견해야 할 것을 앱이
 * 먼저 말해 버리는 것이다.
 *
 * **뒤집어 끼움.** 접안 마이크로미터를 뒤집어도 **칸 간격이 같아 값이 안 틀린다.**
 * 읽기 불편할 뿐이다. 점수를 깎으면 앱이 사실이 아닌 말을 하는 셈이 된다.
 * 읽기 쉬움은 `state.js` 의 `readability()` 가 따로 담는다.
 *
 * `tasks/DESIGN-rules.md` §2.3 참조.
 */

import { focusToleranceOn, GAP_MAX_DEG } from './optics.js';
import { angleGap, centerErr, focusError, lineContrast, PAN_LIMIT } from './state.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 기록에 남은 두 각도로 어긋남을 되짚는다. `state.js` 의 `angleGap` 과 같은 규칙이다 —
 * 표본에는 눈금이 없으므로 맞출 상대도 없다.
 */
function gapFromAngles(p) {
  if (!p.hasReticle || !p.on) return 90;
  if (p.on !== 'stageMic') return 0;
  const raw = (p.eyeAngle ?? 0) - (p.itemAngle ?? 0);
  const folded = ((raw % 180) + 180) % 180;
  return folded > 90 ? 180 - folded : folded;
}

/**
 * 정렬. 두 눈금자가 나란할수록 겹친 지점이 여러 곳 생기고 셀 구간이 길어진다.
 * 이 실험에서 **가장 크게 움직이는 항목**이라 여기 있다.
 */
export function alignFactor(gapDeg) {
  return clamp01(1 - gapDeg / GAP_MAX_DEG);
}

/**
 * 초점. 눈금선은 크롬으로 새겨진 것이라 두께가 없다 —
 * 시료보다 초점에 관대하다 (`focusTolerance` 의 'micrometer' 갈래).
 *
 * ★ **재물대에 무엇이 올라가 있는지를 받는다.** 앞서는 늘 `'micrometer'` 로 쟀는데,
 *   `zoom.js` 의 「초점이 맞았습니다」와 `progress.js` 의 ✓ 는 표본일 때 2배 엄격한
 *   `'specimen'` 을 썼다. 그래서 표본에서 **게이지는 100 인데 바로 밑줄은 「아직 초점이
 *   맞지 않았습니다」**였다. 갈래를 `focusToleranceOn` 한 곳으로 모아 다시 갈라질 수 없게 했다.
 */
export function focusFactor(focusErr, objective, on = 'stageMic') {
  const tol = focusToleranceOn(objective, on);
  if (focusErr <= tol) return 1;
  return clamp01(1 - (focusErr - tol) / (tol * 6));
}

/**
 * 선의 대비. 조리개는 **어두워도 밝아도** 나빠진다 —
 * 닫으면 어둡고, 활짝 열면 산란광이 가는 선을 하얗게 씻는다.
 * 바나나랩은 밝을수록 좋았다. 보는 것이 달라졌으므로 함수도 달라진다.
 */
export function contrastFactor(contrast) {
  return clamp01(0.2 + contrast * 0.8);
}

/**
 * 셀 수 있는 구간. 눈금자가 시야 중심에서 밀려날수록 시야 안에 남는 구간이 짧아지고,
 * 구간이 짧으면 같은 손끝 오차가 눈금값에서 차지하는 비율이 커진다.
 */
export function spanFactor(centerError) {
  return clamp01(1 - centerError * 0.75);
}

/**
 * 견줄 것이 갖춰졌는가.
 *
 * 접안 눈금이 없거나 재물대가 비었으면 **볼 것 자체가 없다.** 다른 항목이 아무리 좋아도
 * 이 시야로는 아무것도 재지 못하므로 점수가 낮은 것이 사실에 맞다.
 */
export function equippedFactor(hasReticle, on) {
  if (!hasReticle) return 0.25;
  if (!on) return 0.4;
  return 1;
}

/**
 * @param {object} p  `fieldParams()` 가 준 값 한 벌 (+ 파생값 몇 개)
 * @returns {{score:number, worst:string|null, factors:object}}
 *   worst 는 가장 많이 깎은 항목 — 화면이 "무엇부터 고칠지" 안내할 때 쓴다.
 *   `strings.js` 의 `UI.observability.worst` 가 이 키를 사람 말로 옮긴다.
 */
export function observability(p) {
  // **기록(캡처)을 그대로 넘겨도 제대로 매겨져야 한다.**
  // `fieldParams` 는 그림을 다시 그리는 데 필요한 것만 담으므로 각도차·중심오차가 없다.
  // 그것을 모르고 기본값(90°)을 쓰면 **모든 기록이 0점**이 되는데, 화면은 에러 없이
  // 그냥 0 을 보여 준다 — 아무도 모른다. 없으면 여기서 유도한다.
  const gapDeg = p.angleGapDeg ?? gapFromAngles(p);
  const centerError = p.centerErr ?? Math.min(1, Math.hypot(p.panX ?? 0, p.panY ?? 0) / PAN_LIMIT);
  const factors = {
    equipped: equippedFactor(p.hasReticle ?? false, p.on ?? null),
    align: alignFactor(gapDeg),
    focus: focusFactor(p.focusErr ?? 0, p.objective ?? 10, p.on ?? 'stageMic'),
    contrast: contrastFactor(p.contrast ?? 1),
    span: spanFactor(centerError),
  };
  const score = Math.round(100 * Object.values(factors).reduce((a, b) => a * b, 1));
  // 아무것도 깎이지 않았으면 "가장 크게 깎이는 항목" 은 없다.
  // 전부 1.0 일 때 그냥 정렬하면 첫 항목이 뽑혀, 나무랄 것이 없는데도
  // 화면이 엉뚱한 것을 고치라고 말한다.
  const ranked = Object.entries(factors).sort((a, b) => a[1] - b[1]);
  /**
   * ★ **갖춰지지 않았으면 그것이 먼저다.**
   *
   * 접안 눈금이나 재물대 위의 것이 없으면 `gapFromAngles` 가 90° 를 돌려주고
   * `alignFactor(90)` 이 **0** 이 된다. `equipped` 는 0.25/0.4 라 **align 이 늘 더 낮아
   * worst 를 가져간다.** 그래서 아무것도 없는 화면이 「접안렌즈 돌리기로 두 눈금자를
   * 나란히 맞추세요」 라고 말했다 — 맞출 눈금자가 없는데. 돌려 봐야 아무 일도 안 난다.
   *
   * 「없는 것」과 「어긋난 것」은 크기를 견줄 수 있는 값이 아니다. 없으면 없다고 먼저 말한다.
   */
  /**
   * ★ **100 이 아니면 100 이 될 방법을 말한다** (사장님 지시 2026-09-03).
   *
   * 앞서는 2 % 안쪽(`NEGLIGIBLE_LOSS = 0.98`)을 「안 깎인 것」으로 쳤다. 그래서 99·98 점
   * 화면이 「지금 조건에서 볼 수 있는 만큼 잘 보입니다」라고만 했고, **학생은 남은 2점을
   * 어디서 잃고 있는지 알 길이 없었다.** 조리개 기본값에서 늘 같은 말이 뜨던 것을 고치려던
   * 문턱이었는데, 고치려던 것보다 큰 것을 가렸다.
   *
   * 이제 **점수로 가른다.** 100 일 때만 나무랄 것이 없다고 말하고, 그 밑에서는 언제나
   * 가장 크게 깎인 항목과 고치는 법을 댄다. 조리개 기본값 문제는 다른 방식으로 답한다 —
   * 그 말이 뜨는 것이 사실이기 때문이다 (조리개를 0.55 로 옮기면 100 이 된다).
   */
  const worst = factors.equipped < 1 ? 'equipped'
    : (score >= 100 ? null : ranked[0][0]);
  return { score, worst, factors };
}

/** 상태에서 바로 재는 편의 함수. `fieldParams` 에 없는 파생값을 여기서 채운다. */
export function observabilityOf(state) {
  const m = state.microscope;
  return observability({
    hasReticle: state.eyepiece.micrometer,
    on: m.stage,
    angleGapDeg: angleGap(state),
    focusErr: focusError(m),
    contrast: lineContrast(m),
    centerErr: centerErr(m),
    objective: m.objective,
  });
}
