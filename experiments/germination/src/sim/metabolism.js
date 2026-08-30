/**
 * 대사 모형 — 챔버 안의 CO₂ 농도와 온도가 시간에 따라 어떻게 되는가.
 *
 * 이 파일은 DOM 을 모른다. `document`·`window`·`Date.now()`·`Math.random()` 을 쓰지 않는다.
 * 순수 함수만 두어 `node --test` 로 검증한다 (AGENTS.md §3.4).
 *
 * ── 무엇을 재는가 ──────────────────────────────────────────────────
 * 발아 중인 콩은 세포호흡이 활발하다. 저장된 유기물을 분해해 에너지를 얻으면서
 *
 *     C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + 에너지
 *
 * **CO₂ 를 내놓고 열을 낸다.** 닫힌 챔버 안이므로 CO₂ 가 쌓이고 온도가 오른다.
 * 마른 콩(발아하지 않은 콩)은 대사가 거의 없어 같은 시간 동안 거의 그대로다.
 *
 * ── 상수의 출처를 갈라 둔다 ────────────────────────────────────────
 * 아래 상수는 두 종류다. **섞어 읽으면 안 된다.**
 *
 *   [사실]              자료에서 온 값. 바꾸려면 사람에게 묻는다 (AGENTS.md §6)
 *   [모형] [확인 필요]  관찰되는 **순서와 배율**을 재현하려고 고른 계수.
 *                       **실측값이 아니다.** 실물 수치로 인용하지 말 것.
 *
 * ── 특히 지어내지 않은 것 ──────────────────────────────────────────
 * **콩의 양(g) · 챔버 부피(mL) · 실제 측정 시간은 교과서에서 확인하지 않았다.**
 * 그래서 이 파일 어디에도 g 과 mL 이 없다. 양은 **숟갈 수**로만 들어온다 —
 * 그것은 학생이 한 조작이지 인용한 수치가 아니다.
 * 확인되면 아래 `[모형]` 값 몇 개만 고치면 되도록 따로 뽑아 두었다.
 */

/* ------------------------------------------------------------------ */
/* [사실] 자료에서 온 값                                                */
/* ------------------------------------------------------------------ */

/**
 * 대기 중 CO₂ 농도 (ppm). **[사실]**
 * 챔버는 여기서 출발한다. 뚜껑을 열어 두면 결국 이 값으로 되돌아간다.
 */
export const ATMOSPHERIC_CO2_PPM = 420;

/** 실온 (℃). **[사실]** 챔버 온도의 출발점이자, 열이 빠져나가는 쪽의 온도다. */
export const ROOM_TEMP_C = 20;

/**
 * BTB(브로모티몰 블루) 가 색을 바꾸는 **방향**. **[사실]**
 *
 * CO₂ 가 물에 녹으면 탄산이 되어 산성 쪽으로 간다. BTB 는 그때
 * **파랑 → 녹색 → 노랑** 으로 변한다. 이 순서를 뒤집으면 틀린 것이다.
 *
 * 색이 갈리는 **농도 경계**는 실제 BTB 농도·용액량에 따라 달라지므로
 * 아래 `[모형]` 쪽에 두었다.
 */
export const BTB_STAGES = ['blue', 'green', 'yellow'];

/* ------------------------------------------------------------------ */
/* [모형] [확인 필요] — 실측값이 아니다                                 */
/* ------------------------------------------------------------------ */

/**
 * 발아 콩 **한 숟갈**이 1분에 올리는 CO₂ (ppm/분). **[모형] [확인 필요]**
 *
 * 교실에서 실제로 재 본 값이 아니다. 다른 상수를 다 정하고 나면 CO₂ 눈금은 이 하나로
 * 정해지므로, **한 번 실측하면 이 숫자만 고치면 된다.** 그러라고 따로 뽑아 두었다.
 */
export const SPROUT_PPM_PER_MIN_PER_SCOOP = 45;

/**
 * 마른 콩의 대사가 발아 콩의 몇 분의 일인가. **[모형]**
 *
 * **0 이 아니다.** 마른 콩도 살아 있는 씨앗이라 아주 느리게 호흡한다.
 * 0 으로 두면 「마른 콩은 죽었다」가 학생이 얻는 결론이 되는데 그건 틀렸다.
 * 다만 30분 안에는 **BTB 색이 바뀌지 않을 만큼** 작아야 한다 (AGENTS.md §2.5).
 */
export const DRY_ACTIVITY_RATIO = 0.05;

/**
 * CO₂ 가 빠져나가는 시간 상수 (분). **[모형]**
 *
 * 밀봉했으면 거의 안 샌다 — 관찰 시간 안에서는 거의 직선으로 오른다.
 * 뚜껑을 안 닫았으면 금세 대기와 같아져 **낮은 값에서 평평해진다.**
 * 0 이 되는 것이 아니다 — 「변화가 약하게 샌다」이지 「아무 일도 없다」가 아니다.
 */
export const SEALED_TAU_MIN = 120;
export const OPEN_TAU_MIN = 2;

/**
 * BTB 색이 갈리는 CO₂ 농도 (ppm). **[모형] [확인 필요]**
 *
 * 실제 경계는 BTB 농도와 용액량에 따라 달라진다. 여기서는 **관찰 시간 안에
 * 발아 콩 쪽만 노랑까지 가고 마른 콩 쪽은 파랑에 남도록** 잡았다 (AGENTS.md §2.5).
 * 색은 **3단계로 양자화**한다 — 연속으로 섞으면 두 챔버가 비슷해 보인다.
 */
export const BTB_GREEN_PPM = 700;
export const BTB_YELLOW_PPM = 1500;

/**
 * 발아 콩 한 숟갈이 **끝내** 올리는 온도 (℃) 와 그 시간 상수 (분). **[모형] [확인 필요]**
 *
 * 세포호흡이 내는 열과 챔버 밖으로 빠져나가는 열이 균형을 이루는 지점이다.
 * 뚜껑을 안 닫으면 열도 함께 빠져나가므로 `OPEN_HEAT_KEEP` 을 곱한다.
 */
export const TEMP_RISE_PER_SCOOP_C = 0.9;
export const TEMP_TAU_MIN = 12;
export const OPEN_HEAT_KEEP = 0.25;

/**
 * 관찰을 접는 시간 (분). **[모형]**
 *
 * 실제 수업에서도 무한정 기다리지 않는다. 여기까지 재고 나면 측정이 스스로 멈춘다.
 * **막는 것이 아니다** — 다시 시작할 수 있고, 챔버를 비우고 처음부터 할 수도 있다.
 */
export const OBSERVE_LIMIT_MIN = 30;

/**
 * 센서가 콩에 파묻혔을 때 신호가 튀는 폭. **[모형]**
 *
 * ── 왜 **위로만** 튀는가 ───────────────────────────────────────────
 * 처음에는 위아래로 흔들리게 두었다. 그랬더니 그래프가 **대기 농도 아래로 내려갔고**,
 * 그건 「닫힌 챔버에서 CO₂ 가 줄었다」로 읽힌다 — 학생이 얻을 결론으로 최악이다.
 *
 * 실제로 일어나는 일은 한쪽이다. CO₂ 는 **콩에서 나온다.** 센서 끝이 콩 더미 속에
 * 있으면 챔버 전체가 아니라 **콩 바로 옆의 진한 공기**를 재게 되므로 언제나 높게 나온다.
 * 온도도 같다 — 세포호흡이 내는 열이 콩 더미 안에서 가장 높다.
 *
 * 그래서 「센서를 콩에 닿지 않게」의 이유가 그림에 그대로 나온다:
 * **재고 있는 것이 챔버가 아니라 콩 더미다.**
 *
 * **막지 않는다.** 튀는 그래프를 보는 것이 그 이유다.
 * 콩에서 빼내도 부스러기가 묻어 있으면 덜하지만 계속 튄다 (`FOULED_NOISE_RATIO`).
 */
export const BURIED_NOISE_PPM = 260;
export const BURIED_NOISE_C = 1.2;
export const FOULED_NOISE_RATIO = 0.4;

/* ------------------------------------------------------------------ */
/* 모형                                                                */
/* ------------------------------------------------------------------ */

/**
 * 결정적 잡음 — 같은 (시드, 챔버, 분) 이면 언제나 같은 값이 나온다. −1 ~ 1.
 *
 * `Math.random()` 을 쓰지 않는 이유는 두 가지다. 하나는 `src/sim/` 규칙이고,
 * 다른 하나는 **같은 상태에서 같은 그림이 나와야** 보고서가 결과를 되살릴 수 있기 때문이다.
 */
export function jitter(seed, lane, minute) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (lane * 0x85ebca6b), 0xc2b2ae35);
  h = Math.imul(h ^ (minute * 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  // >>> 0 으로 부호를 없앤 뒤 0~1 로. 32비트 정수 나눗셈이라 플랫폼을 안 탄다.
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * 챔버 조건 한 벌 → 1분에 나오는 CO₂ (ppm/분).
 *
 * 콩이 없으면 0 이다. **빈 챔버를 밀봉하고 재는 것은 막지 않는다** —
 * 아무 일도 안 일어나는 것이 답이고, 그것이 대조군의 뜻을 알려 준다.
 */
export function co2Rate(cond) {
  if (!cond.beans || cond.scoops <= 0) return 0;
  const activity = cond.beans === 'sprout' ? 1 : DRY_ACTIVITY_RATIO;
  return cond.scoops * SPROUT_PPM_PER_MIN_PER_SCOOP * activity;
}

/** 새는 시간 상수 (분). 뚜껑을 안 닫으면 짧다. */
export const leakTau = (cond) => (cond.sealed ? SEALED_TAU_MIN : OPEN_TAU_MIN);

/**
 * 대기 농도 위로 얼마나 올랐는가 (ppm).
 *
 * 나오는 속도와 새는 속도가 맞물려 **끝내 `rate × tau` 에 가까워진다.**
 * 밀봉하면 tau 가 커서 관찰 시간 안에는 거의 직선이고,
 * 안 닫으면 tau 가 작아 **낮은 값에서 이내 평평해진다.**
 */
export function co2Rise(cond, minutes) {
  const tau = leakTau(cond);
  return co2Rate(cond) * tau * (1 - Math.exp(-Math.max(0, minutes) / tau));
}

/** 온도가 실온 위로 얼마나 올랐는가 (℃). */
export function tempRise(cond, minutes) {
  if (!cond.beans || cond.scoops <= 0) return 0;
  const activity = cond.beans === 'sprout' ? 1 : DRY_ACTIVITY_RATIO;
  const ceiling = cond.scoops * TEMP_RISE_PER_SCOOP_C * activity
    * (cond.sealed ? 1 : OPEN_HEAT_KEEP);
  return ceiling * (1 - Math.exp(-Math.max(0, minutes) / TEMP_TAU_MIN));
}

/**
 * 온도가 끝내 다다르는 값 (℃). `tempRise` 와 `advance` 가 함께 쓴다.
 */
export function tempCeiling(cond) {
  if (!cond.beans || cond.scoops <= 0) return ROOM_TEMP_C;
  const activity = cond.beans === 'sprout' ? 1 : DRY_ACTIVITY_RATIO;
  return ROOM_TEMP_C + cond.scoops * TEMP_RISE_PER_SCOOP_C * activity
    * (cond.sealed ? 1 : OPEN_HEAT_KEEP);
}

/**
 * **한 걸음 나아간다.** 지금 값에서 지금 조건으로.
 *
 * ── 왜 닫힌 형태(`trueState`)를 그대로 쓰지 않는가 ─────────────────
 * `trueState` 는 조건이 **처음부터 끝까지 같았다면** 얼마가 됐을지를 낸다. 그런데 학생은
 * 재는 도중에 뚜껑을 연다. 그때 닫힌 형태를 다시 부르면 **곡선이 그 자리에서 수직으로
 * 뚝 떨어진다** — 2 000 ppm 이던 챔버가 한순간에 600 ppm 이 된다. 그런 일은 없다.
 * 실제로는 **거기서부터 새어 나가기 시작해** 완만하게 내려온다.
 *
 * 그래서 미분식을 그대로 한 걸음씩 푼다:
 *
 *     dC/dt = (나오는 속도) − (지금 넘치는 만큼) / (새는 시간 상수)
 *     dT/dt = (끝내 다다를 온도 − 지금 온도) / (시간 상수)
 *
 * 조건이 내내 같으면 이 걸음의 합이 `trueState` 와 같아진다 — 테스트가 그것을 본다.
 *
 * @param {object} cond              지금 조건
 * @param {{co2Ppm:number, tempC:number}} cur  지금 값
 * @param {number} minutes           나아갈 시간 (분)
 */
export function advance(cond, cur, minutes) {
  const tau = leakTau(cond);
  const ceiling = tempCeiling(cond);
  // 한 걸음을 잘게 나눈다. 통째로 한 번에 풀면 tau 가 작을 때(뚜껑 열림) 값이 튄다.
  const steps = Math.max(1, Math.ceil(minutes * 4));
  const dt = minutes / steps;
  let { co2Ppm, tempC } = cur;
  for (let i = 0; i < steps; i++) {
    co2Ppm += (co2Rate(cond) - (co2Ppm - ATMOSPHERIC_CO2_PPM) / tau) * dt;
    tempC += ((ceiling - tempC) / TEMP_TAU_MIN) * dt;
  }
  return { co2Ppm, tempC };
}

/**
 * **조건이 내내 같았다면** 챔버 안이 어떻게 됐을까. 센서와 무관하다.
 *
 * 조건이 도중에 바뀌는 실제 진행은 `advance()` 가 맡는다. 이 함수는 **기준**이다 —
 * 테스트가 「조건이 같으면 둘이 일치한다」로 `advance()` 를 검증한다.
 */
export function trueState(cond, minutes) {
  return {
    co2Ppm: ATMOSPHERIC_CO2_PPM + co2Rise(cond, minutes),
    tempC: ROOM_TEMP_C + tempRise(cond, minutes),
  };
}

/**
 * **센서가 읽은 값.** 콩에 파묻혔거나 부스러기가 묻어 있으면 튄다.
 *
 * @param {object} cond   `{ beans, scoops, sealed, sensor, fouled, seed, lane }`
 * @param {number} minutes
 */
export function sensorReading(cond, minutes, truth = trueState(cond, minutes)) {
  let ratio = 0;
  if (cond.sensor === 'buried') ratio = 1;
  else if (cond.fouled) ratio = FOULED_NOISE_RATIO;
  if (ratio === 0) return truth;
  // **언제나 높게** 나온다 (위 머리말 참조). 절댓값을 쓰는 이유가 그것이다.
  const n = Math.abs(jitter(cond.seed ?? 0, cond.lane ?? 0, Math.round(minutes)));
  return {
    co2Ppm: truth.co2Ppm + n * BURIED_NOISE_PPM * ratio,
    tempC: truth.tempC + n * BURIED_NOISE_C * ratio,
  };
}

/**
 * CO₂ 농도 → BTB 색 단계. **3단계로 양자화한다.**
 *
 * 연속으로 보간하면 두 챔버가 비슷해 보여 **견줄 것이 없어진다.**
 * 이 실험에서 봐야 하는 것은 「얼마나」가 아니라 「어느 쪽이 넘어갔나」다.
 */
export function btbStage(co2Ppm) {
  if (co2Ppm >= BTB_YELLOW_PPM) return 'yellow';
  if (co2Ppm >= BTB_GREEN_PPM) return 'green';
  return 'blue';
}
