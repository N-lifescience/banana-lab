/**
 * 광학 상수와 환산 — 「현미경을 이용하여 세포의 크기 측정하기」
 *
 * 바나나랩에서 광학 수치는 "그림을 얼마나 크게 그릴지"를 정하는 데만 쓰였다.
 * 여기서는 다르다. 접안 눈금 한 칸이 몇 µm 인지가 **학생이 구해야 하는 답 그 자체**다.
 * 그래서 이 파일의 숫자를 "보기 좋게" 바꾸면 시야가 예뻐지는 게 아니라
 * 학생이 계산해서 얻은 답이 틀린 답이 된다.
 *
 * 값은 두 부류다.
 *   물리 — 광학과 기구 규격에서 따라 나온다. 규격을 바꾸지 않는 한 못 바꾼다.
 *   판정 — 렌더링·판독 편의로 우리가 골랐다. 바꿔도 되지만 왜 그 값인지 적는다.
 *
 * 설계 근거는 tasks/DESIGN-optics.md, 값을 고정하는 것은 tests/optics.test.js 다.
 */

/* ------------------------------------------------------------------ *
 * 1. 기구 규격
 * ------------------------------------------------------------------ */

/** 물리 · 접안렌즈 시야수(Field Number). 학교용 광학현미경의 표준값. */
export const FIELD_NUMBER_UM = 18000;

/**
 * 물리 · 접안렌즈 배율. 학교용은 대개 고정 10배.
 * 교과서의 100배·400배가 여기서 나온다 (10 × 10, 10 × 40).
 *
 * 이 값은 **총배율에만** 쓰인다. 접안 눈금 한 칸의 µm 값에는 들어가지 않는다.
 * 이유는 umPerEyepieceDiv() 를 볼 것.
 */
export const EYEPIECE = 10;

/**
 * 물리 · 쓸 수 있는 대물렌즈. 4배는 측정에 쓰지 않지만 **지우지 않는다.**
 * 실물 회전판에 4배가 달려 있고, 표본을 찾는 단계가 실제로 있으며,
 * 4배에서 대물 눈금은 한 칸 0.73 px 로 뭉개져서 "여기선 못 잰다"고 화면이 스스로 답한다.
 * 하드 게이트를 달 필요가 없는 것은 그래서다.
 */
export const OBJECTIVES = [4, 10, 40];

/**
 * 접안 마이크로미터(리클) 규격 — **우리가 고르는 설계값이다.**
 *
 * 이 실험에서 아는 값은 대물 마이크로미터 한 칸(10 µm) 하나뿐이다. 접안 눈금의 실제 간격은
 * 학생도 교사도 몰라야 한다 — 모르니까 보정을 하는 것이고, 그게 이 실험이 가르치려는 것이다.
 * 실물 표준(10 mm / 100칸)을 고른 이유는 화면의 칸 수가 실물과 같아 보이게 하기 위해서일 뿐이다.
 * 이 값이 바뀌면 아래 10 µm · 2.5 µm 도 함께 바뀌지만, 그건 눈금이 촘촘해지는 것이지
 * 실험이 틀리는 것이 아니다 — 학생은 어느 경우에도 보정으로 그 값을 구해 낸다.
 */
export const RETICLE_LENGTH_MM = 10;

/** 물리 · 눈금자에 실제로 새겨진 칸 수. 시야를 가로지르는 180칸이 아니다 (아래 참조). */
export const RETICLE_DIVS = 100;

/** 물리 · 중간상 평면에서의 접안 눈금 간격 (µm). 10 mm ÷ 100칸 = 0.1 mm. */
export const RETICLE_PITCH_UM = (RETICLE_LENGTH_MM * 1000) / RETICLE_DIVS;

/**
 * 물리 · 대물 마이크로미터 한 칸 (µm). 1 mm 를 100칸으로 새긴 것.
 * **이 실험에서 유일하게 아는 값**이라 상수로 둘 값어치가 있다.
 * 다른 규격의 표본을 쓰게 되면 고칠 곳이 여기 하나여야 한다.
 */
export const STAGE_DIV_UM = 10;

/** 물리 · 대물 마이크로미터에서 눈금이 새겨진 부분의 길이 (µm). 슬라이드 한가운데 1 mm 뿐이다. */
export const STAGE_RULED_UM = 1000;

/* ------------------------------------------------------------------ *
 * 2. 배율과 시야
 * ------------------------------------------------------------------ */

export function magnification(objective) {
  return EYEPIECE * objective;
}

/** 물리 · 시야 지름 (µm) = 시야수 18 mm ÷ 대물배율 */
export function fieldDiameterUm(objective) {
  return FIELD_NUMBER_UM / objective;
}

/** µm 를 화면 px 로 바꾸는 계수. fieldPx 는 시야 원의 지름(px). */
export function pxPerUm(objective, fieldPx) {
  return fieldPx / fieldDiameterUm(objective);
}

/**
 * 판정 · 시야 원 지름의 기준값 (px). render/fov.js 의 `FOV.radius × 2` 와 같아야 한다.
 *
 * px 로 표현되는 상수(PAN_LIMIT_PX)가 여기서 나오기 때문에 이 파일이 알아야 한다.
 * 렌더러에서 가져오지 않는 이유는 src/sim 이 src/render 를 몰라야 하기 때문이다.
 * 시야 원 크기를 바꾸면 여기도 함께 고치고, 확대 뷰 배수(ZOOM.scale)를 다시 잡을 것.
 */
export const FIELD_PX_REF = 328;

/* ------------------------------------------------------------------ *
 * 3. 접안 눈금 — 이 실험의 뼈대
 * ------------------------------------------------------------------ */

/**
 * 물리 · 접안 눈금 한 칸이 시료 위에서 갖는 길이 (µm).
 *
 * **인자가 objective 하나뿐인 것이 이 함수의 요점이다.** 총배율도 접안배율도 받지 않는다.
 *
 * 접안 마이크로미터는 접안렌즈 안, 곧 중간상 평면(intermediate image plane)에 놓인다.
 * 대물렌즈가 시료를 그 평면에 결상하고, 접안렌즈는 그 평면에 있는 두 가지 —
 * 시료의 상과 눈금자 — 를 **똑같이** 확대해서 눈에 보낸다.
 * 그래서 접안배율은 둘의 비를 바꾸지 못하고, 한 칸의 µm 값은 대물배율로만 정해진다.
 * 접안렌즈를 10배에서 15배로 바꾸면 총배율은 1.5배가 되지만 한 칸의 µm 값은 그대로다.
 *
 * 시그니처에 EYEPIECE 가 들어올 자리를 아예 만들지 않아 그 사실을 코드로 못박는다.
 *
 *   100 µm ÷ 10 = 10.0 µm  (100배)
 *   100 µm ÷ 40 =  2.5 µm  (400배)   → 다시 구하지 않으면 정확히 4배 틀린다
 */
export function umPerEyepieceDiv(objective) {
  return RETICLE_PITCH_UM / objective;
}

/**
 * 물리 · 접안 눈금 한 칸이 시야 지름에서 차지하는 비율.
 *
 * **이 실험 전체가 걸려 있는 불변량이다.** 배율이 인자로 없는 것이 그 뜻이다.
 * 눈금자도 시야 조리개도 같은 중간상 평면에 있으므로, 대물렌즈를 바꿔도 둘의 비는 변하지 않는다.
 *   0.1 mm / 18 mm = 0.005556  (시야 지름의 0.556 %)
 */
export const EYEPIECE_DIV_FIELD_FRACTION = RETICLE_PITCH_UM / FIELD_NUMBER_UM;

/** 물리 · 시야 지름에 들어가는 접안 칸 수. 18 mm ÷ 0.1 mm = 180. 배율과 무관하다. */
export const EYEPIECE_DIVS_ACROSS_FIELD = FIELD_NUMBER_UM / RETICLE_PITCH_UM;

/**
 * 물리 · 눈금자 전체가 시야 지름에서 차지하는 비율. 10 mm / 18 mm = 0.5556.
 *
 * 180칸은 "한 칸이 시야의 1/180" 이라는 비율이지 화면에 그만큼 그려진다는 뜻이 아니다.
 * 눈금자는 100칸뿐이라 시야를 55.6 % 만 가로지른다. 180칸을 세는 문항은 만들 수 없다 —
 * 그런 칸이 존재하지 않는다.
 */
export const RETICLE_SPAN_FIELD_FRACTION = (RETICLE_DIVS * RETICLE_PITCH_UM) / FIELD_NUMBER_UM;

/**
 * 물리 · 화면에서의 접안 눈금 한 칸 (px).
 *
 * **objective 를 받지 않는다.** 렌더러가 배율을 보고 눈금자를 다시 그리는 순간
 * 이 실험이 가르치려는 성질이 화면에서 사라진다. 시그니처로 막는다.
 * (시야 원 328 px 기준 1.82 px — 시야 원에서는 셀 수 없다. 세는 일은 확대 뷰에서 한다.)
 */
export function eyepieceDivPx(fieldPx) {
  return fieldPx * EYEPIECE_DIV_FIELD_FRACTION;
}

/** 물리 · 화면에서의 대물 마이크로미터 한 칸 (px). 이쪽은 배율을 따라 움직인다. */
export function stageDivPx(objective, fieldPx) {
  return STAGE_DIV_UM * pxPerUm(objective, fieldPx);
}

/**
 * 물리 · 대물 눈금 한 칸에 접안 눈금이 몇 칸 들어가는가 (= 보정에 쓰는 비).
 *   4× → 0.4   ·   10× → 1 (두 눈금자가 완전히 포개진다)   ·   40× → 4
 * 400배에서 100배 값을 그대로 쓰면 정확히 이 비만큼 틀린다.
 */
export function eyepieceDivsPerStageDiv(objective) {
  return STAGE_DIV_UM / umPerEyepieceDiv(objective);
}

/* ------------------------------------------------------------------ *
 * 4. 무엇을 개별 선으로 그릴 수 있는가
 * ------------------------------------------------------------------ */

/**
 * 판정 · 잔눈금을 개별 선으로 그릴 수 있는 최소 간격 (px).
 * STROKE.hair 가 1.5 px 이므로 선과 빈칸이 각각 2 px 는 되어야 구별된다.
 * 그 밑에서는 앨리어싱으로 없는 무늬(모아레)가 생긴다 — 세라고 그린 것이 셀 수 없게 그려지면
 * 학생은 조작이 아니라 렌더링 때문에 틀린다. 못 그리는 자리에는 옅은 띠를 그린다.
 */
export const TICK_RESOLVE_PX = 4;

/** 판정 · 굵은 눈금 + 숫자를 그릴 수 있는 최소 간격 (px). 숫자 한 글자가 약 10 px. */
export const MAJOR_RESOLVE_PX = 6;

/** 굵은 눈금은 10칸마다다 (실제 리클이 그렇다). */
export const MAJOR_EVERY_DIV = 10;

/** 접안 잔눈금을 시야 원에 개별로 그릴 수 있는가 — 배율과 무관하다. */
export function canResolveEyepieceTicks(fieldPx) {
  return eyepieceDivPx(fieldPx) >= TICK_RESOLVE_PX;
}

/** 접안 굵은 눈금(10칸)을 시야 원에 그릴 수 있는가 — 배율과 무관하다. */
export function canResolveEyepieceMajor(fieldPx) {
  return eyepieceDivPx(fieldPx) * MAJOR_EVERY_DIV >= MAJOR_RESOLVE_PX;
}

/** 대물 잔눈금을 시야 원에 개별로 그릴 수 있는가 — 400배에서만 참이다. */
export function canResolveStageTicks(objective, fieldPx) {
  return stageDivPx(objective, fieldPx) >= TICK_RESOLVE_PX;
}

/** 대물 굵은 눈금(100 µm)을 시야 원에 그릴 수 있는가. */
export function canResolveStageMajor(objective, fieldPx) {
  return stageDivPx(objective, fieldPx) * MAJOR_EVERY_DIV >= MAJOR_RESOLVE_PX;
}

/* ------------------------------------------------------------------ *
 * 5. 눈금 확대 뷰 — 칸을 세는 곳
 * ------------------------------------------------------------------ */

/**
 * 판정 · 확대 뷰 사양.
 *
 * 시야 원에서는 접안 한 칸이 1.82 px 라 셀 수 없고, 배율을 올려도 그 값은 안 변한다.
 * 눈금 칸 수를 줄이면 한 칸의 µm 값이 깨지고(물리를 화면 사정에 맞추는 것),
 * 시야 원을 키워도 700 px 에서 3.9 px 라 부족하다. 그래서 확대 뷰를 따로 둔다.
 *
 * 8배 · 600 px 폭으로 정한 이유는 하나다 — 400배 보정 구간인 **접안 40칸**이
 * 스크롤 없이 한 화면에 들어와야 한다. 40칸을 창 밖으로 밀면 세다가 놓친 학생이
 * 조작이 아니라 UI 때문에 틀린다.
 */
export const ZOOM = { scale: 8, width: 600, height: 140 };

/**
 * 판정 · 세기 좋은 최소 간격 (px). 확대 뷰 배수를 8배로 정한 근거.
 * 선(1.5 px)과 빈칸이 구별되고, 10칸마다 두 자리 숫자가 여유 있게 들어가고,
 * 커서로 "여기부터 여기까지"를 짚을 수 있는 최소 폭이다.
 */
export const COUNTABLE_PITCH_PX = 12;

/** 확대 뷰에서의 접안 눈금 한 칸 (px). 여기서도 배율은 들어가지 않는다. */
export function zoomEyepieceDivPx(fieldPx) {
  return eyepieceDivPx(fieldPx) * ZOOM.scale;
}

/** 확대 뷰 한 화면에 들어오는 접안 칸 수. 328 px 기준 약 41칸. */
export function zoomVisibleDivs(fieldPx) {
  return ZOOM.width / zoomEyepieceDivPx(fieldPx);
}

/* ------------------------------------------------------------------ *
 * 6. 재물대를 옮길 수 있는 범위
 * ------------------------------------------------------------------ */

/**
 * 판정 · 재물대 이동 한계 (화면 px). state.js 가 PAN_LIMIT 이라는 이름으로 다시 내보낸다.
 *
 * 바나나랩은 이 값을 state.js 에 두었지만, 여기서는 「중앙 정렬」이 절차의 한 단계라
 * 광학에서 나와야 하는 값이다. 두 조각의 합으로 잡았다 (100배 = 보정하는 배율 기준):
 *
 *   시야 반지름            164 px  — 끝까지 밀면 눈금 부분이 시야에서 완전히 빠진다.
 *                                    그래서 저배율로 「찾는」 단계가 실제로 생긴다
 *   눈금 부분(1 mm)의 절반  91 px  — 범위 안에서 눈금의 어느 지점이든 시야 중앙에 놓을 수 있다
 *
 * 100배에서 눈금 부분 1 mm 는 접안 눈금자 100칸과 길이가 같다(둘 다 1 : 1). 그래서 이 값은
 * 「눈금자 길이의 절반 + 시야 반지름」이기도 하다 — 확대 뷰 배수를 고쳐도 함께 움직일 값이다.
 */
export const PAN_LIMIT_PX = Math.round(
  FIELD_PX_REF / 2 + (STAGE_RULED_UM * pxPerUm(10, FIELD_PX_REF)) / 2,
);

/* ------------------------------------------------------------------ *
 * 7. 두 눈금자가 어긋난 정도 — 막지 않고 결과로 흘린다
 * ------------------------------------------------------------------ */

/**
 * 판정 · 두 눈금선이 "한 줄로 이어진다"고 판단할 수 있는 최대 벌어짐 (접안 칸 단위).
 * 실물 규격이 아니라 **사람의 판독 한계**를 모델링한 값이다.
 * 두 눈금자가 서로 반 칸 넘게 벌어지면 어느 눈금선끼리 짝인지 사람이 못 고른다.
 */
export const JUDGE_GAP_DIV = 0.5;

/**
 * 판정 · 이보다 짧은 구간에서는 칸 수를 셀 수 없다고 본다 (접안 칸 단위).
 * 한 칸 반이면 양 끝을 짚을 자리가 남지 않는다.
 */
export const MIN_COUNTABLE_RUN_DIV = 1.5;

/**
 * 판정 · 나란한 정도(alignment)가 0 이 되는 기울기 차 (도). 약 19.5°.
 *
 * **usableRunDiv() 에서 유도한다.** 두 함수가 서로 다른 각도를 말하면 화면과 점수가 어긋난다.
 * 겹쳐 보이는 구간이 MIN_COUNTABLE_RUN_DIV 로 줄어드는 각도이므로
 * `usableRunDiv(GAP_MAX_DEG) === MIN_COUNTABLE_RUN_DIV` 가 항등식으로 성립한다.
 * 설계도 §5.3 표의 「20° 이상 → 1.5칸 이하 → 셀 수 없다」와 같은 지점이다.
 */
export const GAP_MAX_DEG = (Math.asin(JUDGE_GAP_DIV / MIN_COUNTABLE_RUN_DIV) * 180) / Math.PI;

/** 판정 · 위상이 완벽할 때의 최소 판독 오차 (칸). 눈금선 두께에서 온다. */
export const READ_ERR_BASE_DIV = 0.25;

/** 판정 · 위상차가 최대일 때 더해지는 판독 오차 (칸). */
export const READ_ERR_PHASE_DIV = 0.5;

/**
 * 접안 눈금자와 슬라이드의 기울기 차 (도). −90 ~ +90 으로 접는다.
 * 180° 로 접는 이유: 눈금자는 방향이 아니라 **선**이다. 180° 돌린 눈금자는 나란하다.
 */
export function foldSkewDeg(eyepieceRotDeg, slideRotDeg) {
  const d = (((eyepieceRotDeg - slideRotDeg) % 180) + 180) % 180;
  return d > 90 ? d - 180 : d;
}

/**
 * 두 눈금자가 겹쳐 보이는 구간의 길이 (접안 칸 단위). 인자는 기울기 차(도).
 *
 * 기울기 skew 로 어긋난 두 직선은 한 점에서만 만난다. 교차점에서 n 칸 떨어진 곳의
 * 수직 간격이 n × sin|skew| 이므로, 그 간격이 판독 한계를 넘는 지점에서 세기가 끝난다.
 *   usableRunDiv = min(눈금자 전체 100칸, JUDGE_GAP_DIV / sin|skew|)
 *
 * 기울기는 **답을 치우게 하지 않는다.** 눈금 간격 자체는 cos(skew) 만큼만 변하는데
 * 3° 에서 0.14 % 라 무시된다. 기울기가 망가뜨리는 것은 셀 수 있는 칸 수이고,
 * 칸 수가 줄면 오차 폭이 넓어진다. 실제 현미경에서 일어나는 일과 같다.
 *
 *   0.1° → 100칸(상한)  ·  1° → 29칸 (400배 보정 40칸이 간신히 안 된다)
 *   3° → 9.5칸  ·  19.5° → 1.5칸 (막지 않아도 못 센다)
 */
export function usableRunDiv(skewDeg) {
  const s = Math.abs(Math.sin((skewDeg * Math.PI) / 180));
  if (s === 0) return RETICLE_DIVS;
  return Math.min(RETICLE_DIVS, JUDGE_GAP_DIV / s);
}

/**
 * 위상차 — 두 눈금자가 나란해도 영점이 어긋나 있으면 어떤 눈금선도 정확히 포개지지 않는다.
 * 학생은 재물대를 조금 옮겨서 맞춘다 (기존 MOVE_STAGE 액션).
 *
 * 0(완전히 포개짐) ~ 0.5(반 칸 어긋남, 최악) 로 **접어서** 돌려준다.
 * 설계도는 "소수부 0~1" 이라고 적었지만, 한 칸 뒤로 어긋난 것은 어긋나지 않은 것과 같다 —
 * 소수부 0.9 는 0.1 과 같은 어긋남이다. 접지 않으면 0.9 가 0.1 보다 나쁘다고 계산되어
 * 설계도가 함께 적은 "phase 0.5 에서 최대" 와 어긋난다.
 *
 * 위상차는 양 끝에 똑같이 걸려 뺄셈에서 상쇄되므로 **답을 치우게 하지 않는다.**
 * 「여기가 겹친 지점이다」라는 판단만 흐린다. 그래서 판독 폭으로만 넘긴다.
 */
export function phaseDiv(objective, offsetUm) {
  const frac = Math.abs(offsetUm / umPerEyepieceDiv(objective)) % 1;
  return Math.min(frac, 1 - frac);
}

/** 한쪽 끝에서의 판독 오차 (접안 칸 단위). */
export function readErrDiv(phase = 0) {
  return READ_ERR_BASE_DIV + READ_ERR_PHASE_DIV * phase;
}

/**
 * 보정 한 번의 구조와 그 오차.
 *
 * 학생은 접안 A 칸 = 대물 B 칸을 세고 「한 칸 = B × 10 µm ÷ A」를 계산한다.
 * A 는 겹쳐 보이는 구간과 확대 뷰에 들어오는 칸 수 중 작은 쪽으로 잘린다.
 * 양 끝을 짚으므로 판독 오차는 눈금자마다 두 번 들어간다.
 *
 * umPerDiv 는 **기울기·위상과 무관하다** — 어긋남은 답을 치우게 하지 않고 오차 폭만 넓힌다.
 *
 *   100배 잘 맞춤 → 약 2.4 %   ·   400배 잘 맞춤 → 약 6 %
 *   400배 skew 1° → 약 9 %     ·   400배 skew 3° → 약 26 %
 *
 * 400배 보정이 100배 보정보다 덜 정밀한 것은 시야가 좁아 대물 눈금이 몇 칸 안 들어오기
 * 때문이다. 이건 실제로 그렇다 — 「100배에서 보정하고 배율비로 나눈다」는 방법이 있는 이유다.
 */
export function calibration(objective, { fieldPx = FIELD_PX_REF, skewDeg = 0, phase = 0 } = {}) {
  const eyepieceRunDiv = Math.min(usableRunDiv(skewDeg), zoomVisibleDivs(fieldPx));
  const stageRunDiv = eyepieceRunDiv / eyepieceDivsPerStageDiv(objective);
  const err = readErrDiv(phase);
  return {
    umPerDiv: umPerEyepieceDiv(objective),
    eyepieceRunDiv,
    stageRunDiv,
    readErrDiv: err,
    relErr: (2 * err) / eyepieceRunDiv + (2 * err) / stageRunDiv,
  };
}

/** 세포를 재는 판독 오차. 세포가 cellDiv 칸일 때의 상대오차. */
export function measureRelErr(cellDiv, phase = 0) {
  return (2 * readErrDiv(phase)) / cellDiv;
}

/* ------------------------------------------------------------------ *
 * 8. 관찰 대상 — 자주달개비 잎 표피의 공변세포
 * ------------------------------------------------------------------ */

/**
 * 물리 · 공변세포 길이(장축)의 범위 (µm).
 *
 * 출처: Tradescantia virginiana 의 기공 반응 실측 — 상대습도 55 % 에서 자란 개체의
 * 공변세포 길이 평균 56.7 µm, 고습(90 %) 개체는 73.3 µm.
 * 근거와 종(species) 주의사항은 tasks/RESOLVED-cell-size.md 에 있다.
 *
 * **한 값으로 고정하지 않는 이유:** 생육 습도에 따라 1.3배까지 달라진다. 고정값을 쓰면
 * 서른 명이 모두 같은 숫자를 얻고, 그건 관찰이 아니라 정답 맞히기가 된다.
 * 그래서 RH 55 % 근처의 현실적인 폭으로 시드마다 흩뜨린다.
 *
 * 폭(단축)은 기공이 여닫히면서 변해서 아직 확인되지 않았고, 측정 대상도 아니다
 * (실측 연구도 교과서 절차도 길이를 잰다). 값 없이 두고, 필요해지면 출처를 달아 여기에 넣는다.
 */
export const GUARD_CELL_UM = { min: 55, max: 62 };

/**
 * 시드로 흩뜨린 공변세포 길이 (µm).
 * 어느 시드에서도 「400배에서 접안 15~25칸」 창을 벗어나지 않는다 (22.0 ~ 24.8칸).
 */
export function guardCellLengthUm(seed = 0) {
  return GUARD_CELL_UM.min + hashUnit(seed, 0x60a2) * (GUARD_CELL_UM.max - GUARD_CELL_UM.min);
}

/** 공변세포가 접안 눈금 몇 칸을 차지하는가 — 학생이 실제로 세게 될 수. */
export function guardCellDivs(objective, seed = 0) {
  return guardCellLengthUm(seed) / umPerEyepieceDiv(objective);
}

/** 화면에서의 공변세포 길이 (px). */
export function guardCellLengthPx(objective, fieldPx, seed = 0) {
  return guardCellLengthUm(seed) * pxPerUm(objective, fieldPx);
}

/**
 * 시드 해시. assets/geometry.js 에 같은 것이 있지만 가져다 쓰지 않는다 —
 * src/sim 이 애셋 층을 모르는 덕분에 node --test 로 규칙만 따로 검증할 수 있다.
 */
function hashUnit(seed, salt) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (salt | 0), 0x27220a95);
  h ^= h >>> 15;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ *
 * 9. 초점
 * ------------------------------------------------------------------ */

/**
 * 판정 · 대물 마이크로미터에 초점을 맞출 때의 완화 계수.
 * 유리 위에 증착한 크롬 선이라 두께가 없어 초점면이 하나뿐이다 — 조직 절편보다 잡기 쉽다.
 * 「100배에서 눈금에 먼저 초점을 맞춘다」는 절차가 그래서 성립한다.
 */
export const STAGE_MICROMETER_FOCUS_EASE = 2;

/**
 * 초점 허용 범위.
 * 고배율일수록 초점 심도가 얕다. 저배율을 건너뛰고 400배로 바로 가면
 * 막히는 게 아니라 "사실상 못 찾는" 이유가 이 값이다.
 *
 * 접안 눈금자를 위한 값은 여기 없다. 눈금자는 접안렌즈 안에 있어 **초점 나사와 무관하게
 * 항상 선명하다** — 렌더러가 눈금 레이어를 블러 대상에서 뺀다.
 * 눈금은 선명한데 표본이 뿌옇다는 것 자체가 "초점이 안 맞았다"는 단서가 된다.
 */
export function focusTolerance(objective, target = 'specimen') {
  const base = objective === 4 ? 0.30 : objective === 10 ? 0.12 : 0.03;
  return target === 'micrometer' ? base * STAGE_MICROMETER_FOCUS_EASE : base;
}
