/**
 * 전개 물리 — 모세관 상승.
 *
 * 바나나랩의 `optics.js` 자리에 오는 파일이다. 이 실험에는 현미경이 없다.
 * 여기 있는 것은 **거름종이를 타고 오르는 전개액**과 그것이 색소를 데려가는 거리다.
 *
 * "보기 좋게" 바꾸지 말 것. `tests/develop.test.js` 가 값을 고정하고 있다.
 * docs/05-strip-renderer.md 참조.
 */

/* ------------------------------------------------------------------ */
/* 치수 — 출처가 있는 값                                               */
/* ------------------------------------------------------------------ */

/**
 * 거름종이 **2 × 10 cm** 스트립.
 *
 * ── 폭 20 mm 인 이유 ────────────────────────────────────────────────
 * 국내에 유통되는 크로마토그래프지가 **20 × 400 mm** 낱장이다. 거기서 10 cm 로 잘라 쓴다.
 *
 * 처음에는 40 mm 로 잡았는데 **실물에서 성립하지 않았다** — 20 mL 바이알은 외경 28 mm 라
 * 폭 40 mm 짜리 종이가 들어가지 않는다. 그림에서는 그것이 보이지 않는다.
 * 조사에서도 4 × 10 cm 를 명시한 출처를 찾지 못했고, 실제 출처들은 크기 대신
 * **「용기에 맞춰 자르라」**고 한다 (Pearson CP11 "a suitable size to fit the full
 * length of a boiling tube" · SERC "메스실린더보다 약간 짧게").
 *
 * 흔히 도는 1.5 × 10 cm 는 어느 출처에도 없다.
 */
export const PAPER_W_MM = 20;
export const PAPER_H_MM = 100;

/**
 * 원점은 아래에서 **2.5 cm.**
 *
 * 출처 — Pearson Edexcel Biology B, Core Practical 11: `Draw a pencil line about 25 mm
 * from the bottom edge`. 국내 지도자료(서울대 SERC)도 2 ~ 2.5 cm 다.
 *
 * 처음에는 1 cm 였는데 출처를 찾고 나서 고쳤다. **전개액 깊이보다 높아야** 원점이
 * 잠기지 않는다 — 같은 출처가 전개액을 `to a depth of no more than 1 cm` 라고 하므로,
 * 2.5 cm 원점과 1 cm 액면 사이에 1.5 cm 여유가 남는다.
 */
export const ORIGIN_MM = 25;

/** 원점을 그을 수 있는 범위. 막지 않는다 — 자가 종이 밖을 가리키지 않을 뿐이다. */
export const ORIGIN_RANGE_MM = [2, 40];

/**
 * 바이알에 부을 수 있는 전개액 깊이의 상한.
 *
 * 바이알 치수는 **[확인 필요]** 다. 이 값은 "더는 부을 수 없다" 는 자리를 정할 뿐이고,
 * 화면에는 깊이(mm)가 **자로 재어지는 그림**으로만 나온다 — 부피(mL)로 환산하지 않는다.
 * 환산하려면 바이알 안지름이 필요한데 그것을 지어내면 다음 사람이 사실로 읽는다.
 */
export const MAX_DEPTH_MM = 30;

/* ------------------------------------------------------------------ */
/* 물리 — 이것이 이 실험의 optics 다                                    */
/* ------------------------------------------------------------------ */

/**
 * 전개가 종이 끝까지 가는 데 걸리는 **시뮬레이션 시간.**
 *
 * 실제 소요 시간이 아니다 — 실제 값은 `[확인 필요]` 이고, 그래서 **화면에 시계를 띄우지
 * 않는다.** 절차가 보라고 한 것은 시간이 아니라 전선의 **높이**다. 이 상수가 정하는 것은
 * 화면에서 전선이 오르는 속도 감각뿐이다.
 *
 * 물리인 것은 아래의 **√ 하나**다.
 */
export const FULL_RUN_T = 900;

/**
 * Washburn 계수 — 오른 거리 = K · √시간.
 *
 * 모세관이 액을 빨아올리는 거리는 시간의 제곱근에 비례한다. 처음에 쑥 오르다가 갈수록
 * 느려진다. 이 사실이 "전개액이 상단 가까이 오면 꺼내라" 는 절차가 왜 시간이 아니라
 * 높이로 적혀 있는지를 설명한다 — 같은 1분이 앞에서는 3 cm 고 뒤에서는 5 mm 다.
 */
export const RISE_K = PAPER_H_MM / Math.sqrt(FULL_RUN_T);

/** 액에 잠긴 만큼은 이미 젖어 있다. 전선은 액면에서 시작해 오른다. */
export function riseMm(runT) {
  return RISE_K * Math.sqrt(Math.max(0, runT));
}

/**
 * 용매 전선의 높이 (종이 아랫단 기준).
 * 종이 끝에 닿으면 거기서 멈춘다 — 더 오를 곳이 없다.
 */
export function frontMm(runT, depthMm) {
  return Math.min(PAPER_H_MM, depthMm + riseMm(runT));
}

/**
 * 전선이 종이 끝을 넘어갔는가.
 *
 * 넘어가면 전선이 **어디였는지 알 수 없다.** 막지 않는다 — 꺼내는 것도, 재려고 하는 것도
 * 그대로 되고, 다만 Rf 의 분모를 잃는다. 너무 늦게 꺼내면 안 되는 이유가 이것이다.
 */
export function isOverrun(runT, depthMm) {
  return depthMm + riseMm(runT) >= PAPER_H_MM;
}

/**
 * 색소 띠 하나의 높이 (종이 아랫단 기준).
 *
 * 정의 그대로다 — 색소는 용매가 간 거리의 일정 비율만큼 간다.
 * 전선이 아직 원점에 못 미쳤으면 색소는 원점에 그대로 있다.
 */
export function bandMm(rfValue, front, originMm = ORIGIN_MM) {
  if (front <= originMm) return originMm;
  return originMm + rfValue * (front - originMm);
}

/**
 * 전개율(Rf) = 색소가 이동한 거리 ÷ 용매가 이동한 거리.
 *
 * **앱은 정답 Rf 를 갖고 있지 않다.** 이 함수는 학생이 자로 **재어 넣은 두 수**를 나누는
 * 계산기일 뿐이다. 어디서도 색소 이름을 인자로 받지 않는 것이 그 증거다.
 * 잴 수 없는 값(0 이하)이 들어오면 숫자를 지어내지 않고 null 을 돌려준다.
 */
export function rf(pigmentMm, solventMm) {
  if (!(solventMm > 0) || !(pigmentMm >= 0)) return null;
  return pigmentMm / solventMm;
}

/* ------------------------------------------------------------------ */
/* 색소 네 가지                                                        */
/* ------------------------------------------------------------------ */

/**
 * 색소와 **전개율(Rf).**
 *
 * ── 출처 ────────────────────────────────────────────────────────────
 * Pearson Edexcel A-level Biology B, Core Practical 11
 * 「Investigate the presence of different chloroplast pigments using chromatography」
 * (c) Pearson Education Ltd 2016 — 학생용 시트 table A
 *
 * table A 원문: carotene 0.95 (yellow-orange) · phaeophytin 0.83 (grey-yellow) ·
 * xanthophyll 0.71 (yellow-brown) · chlorophyll a 0.65 (blue-green) ·
 * chlorophyll b 0.45 (light green)
 *
 * **이 출처를 고른 이유는 용매계가 우리와 정확히 같기 때문이다.** 준비물에
 * "chromatography solvent (1 : 9 mix of propanone : petroleum spirit)" —
 * 곧 석유에터 : 아세톤 = 9 : 1 이다. 절차에도 "a stationary solid phase
 * (in this case, paper)" 라고 못 박혀 있고, 교사용 주석은 TLC 를 대안으로 밀어내며
 * "This procedure instead uses paper chromatography" 라고 적는다.
 *
 * ── 실리카겔 값을 여기 넣지 마라 ────────────────────────────────────
 * 검색하면 가장 먼저 나오는 표(카로틴 0.98 · 엽록소 a 0.59 · 잔토필 0.28 · 0.15)는
 * **실리카겔** 값이다. 잔토필이 맨 아래로 내려가 있는 것으로 알아볼 수 있다.
 * 그 값이 여러 블로그에서 「종이 크로마토그래피 표준값」으로 재유통되고 있다.
 *
 * ── 앱은 이 값을 화면에 말하지 않는다 ───────────────────────────────
 * 여기 있는 것은 **띠를 그릴 자리**다. 학생은 자로 재어 자기 Rf 를 구한다 —
 * 재는 것과 나누는 것이 이 실험이 가르치려는 바다.
 * `tests/develop.test.js` 가 화면 문자열을 훑어 이 숫자가 새어 나가는지 본다.
 * 정리 단계에서 대조표로 보여 줄지는 **따로 판단할 일**이고, 아직 하지 않았다.
 *
 * ── 페오피틴(0.83)은 넣지 않았다 ────────────────────────────────────
 * 엽록소가 분해돼 생기는 것이라 실제 크로마토그램에는 자주 보이지만,
 * 교과서가 묻는 색소는 넷이다. 다섯 번째 띠를 그리면 학생이 답해야 할 것이 달라진다.
 */
export const PIGMENTS = [
  { id: 'carotene',     tone: 'carotene',     rf: 0.95, lightSensitive: false },
  { id: 'xanthophyll',  tone: 'xanthophyll',  rf: 0.71, lightSensitive: false },
  { id: 'chlorophyllA', tone: 'chlorophyllA', rf: 0.65, lightSensitive: true },
  { id: 'chlorophyllB', tone: 'chlorophyllB', rf: 0.45, lightSensitive: true },
];

/** 위에서부터 읽은 순서 — 카로틴이 가장 높다. */
export const PIGMENT_IDS = PIGMENTS.map((p) => p.id);

/**
 * 볼펜 잉크가 갈라져 생기는 **가짜 띠.**
 *
 * 원점을 볼펜으로 그으면 잉크의 염료도 함께 전개된다. 실제로 일어나는 일이고,
 * 연필로 그으라는 절차가 왜 있는지를 이것이 설명한다.
 * 색소가 아니므로 `PIGMENTS` 에 넣지 않는다 — 넣으면 결과 판정이 이것을 색소로 센다.
 */
export const INK_BANDS = [
  // 잉크 염료의 Rf 는 출처가 없다. 이 둘은 **그림용 값**이고, 색소 넷과 겹치지 않는
  // 자리를 골랐을 뿐이다. 화면에 수치로 나오지 않는다.
  { id: 'inkA', tone: 'inkDye', rf: 0.82 },
  { id: 'inkB', tone: 'inkDye', rf: 0.38 },
];

/* ------------------------------------------------------------------ */
/* 번짐 — 띠의 굵기                                                    */
/* ------------------------------------------------------------------ */

/**
 * 원점의 지름 (mm).
 *
 * 모세관을 한 번에 오래 대면 커지고, 마르기 전에 겹쳐 찍어도 커진다.
 * 실제로 원점을 크게 찍으면 띠가 굵어져 이웃 띠와 겹친다 — 이 실험에서 가장 흔한 실패다.
 */
export const MIN_SPOT_MM = 2;
export const MAX_SPOT_MM = 12;

/**
 * 띠가 올라가면서 세로로 퍼지는 정도. 출처가 없는 **그림용 값**이다.
 *
 * 처음에는 0.12 였는데, 그때는 띠 자리도 지어낸 값이었다. 실측 Rf 로 바꾸고 나니
 * 잔토필(0.71)과 엽록소 a(0.65)가 5 mm 안쪽으로 붙어서, 절차를 다 지켜도 둘이
 * 뭉쳐 보였다 — **실제로는 갈라지는 것이라 그건 틀린 그림이다.**
 * 절차를 지키면 넷이 갈라지고, 원점을 크게 찍으면 뭉치도록 다시 잡았다.
 * `tests/develop.test.js` 가 양쪽을 다 검사한다.
 */
export const BAND_SPREAD = 0.035;

/**
 * 띠 하나의 굵기 (mm).
 *
 * 원점 지름에서 출발해, 올라간 거리에 비례해 퍼진다(세로 확산).
 * 두 띠의 굵기 합의 절반보다 사이가 가까우면 눈으로는 하나로 보인다.
 */
export function bandWidthMm(spotMm, travelMm) {
  return spotMm + travelMm * BAND_SPREAD;
}

/** 이웃한 두 띠가 겹쳐 보이는가. 렌더러와 품질 계산이 같은 판정을 쓰게 한다. */
export function bandsOverlap(aMm, aW, bMm, bW) {
  return Math.abs(aMm - bMm) < (aW + bW) / 2;
}
