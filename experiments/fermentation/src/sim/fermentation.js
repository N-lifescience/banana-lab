/**
 * 알코올 발효 모형 — 맹관부에 모이는 이산화 탄소의 양.
 *
 * 이 파일은 DOM 을 모른다. `document`·`window`·`Date.now()`·`Math.random()` 을 쓰지 않는다.
 * 순수 함수만 두어 `node --test` 로 검증한다 (AGENTS.md §3.4).
 *
 * ── 무엇을 재는가 ──────────────────────────────────────────────────
 * 효모에게 포도당을 주고 **산소를 끊으면** 알코올 발효가 일어난다.
 *
 *     C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂
 *
 * 발효관의 팽대부에 용액을 담고 솜마개로 막아 두면, 나온 이산화 탄소가 **맹관부**에 모인다.
 * 그러므로 **모인 기체의 양 = 발생 속도 × 흐른 시간** 이다.
 * 이 파일이 하는 일은 조건에서 발생 속도를 내고, 그것을 시간에 곱하는 것뿐이다.
 *
 * ── 상수의 출처를 갈라 둔다 ────────────────────────────────────────
 * 아래 상수는 두 종류다. **섞어 읽으면 안 된다.**
 *
 *   [사실]  자료·교과서에서 온 값. 바꾸려면 사람에게 묻는다 (AGENTS.md §6)
 *   [모형]  관찰되는 **순서와 배율**을 재현하려고 고른 계수. **실측값이 아니다.**
 *           실물 수치로 인용하지 말 것. 교실에서 실제로 재 보면 보정해야 한다.
 */

/* ------------------------------------------------------------------ */
/* [사실] 자료·교과서에서 온 값                                          */
/* ------------------------------------------------------------------ */

/**
 * 효모액 조제법. **「10 % 효모액」이라는 표기는 쓰지 않는다** —
 * 한국 지도서는 전부 g/mL 조제법으로 적는다.
 */
export const YEAST_DRY_G = 6;
export const YEAST_WATER_ML = 50;

/** 이 실험에서 쓰는 포도당 수용액의 기준 농도 (%). 통제변인의 기준값이다. */
export const GLUCOSE_STANDARD_PCT = 10;

/**
 * 교과서의 표준 배치 부피 (mL).
 *
 * A: 10 % 포도당 20 mL + **증류수** 15 mL (대조군)
 * B: 10 % 포도당 20 mL + 효모액 15 mL
 * C:  5 % 포도당 20 mL + 효모액 15 mL
 *
 * **대조군에 증류수를 넣는 까닭은 총 부피를 같게 맞추기 위해서다.**
 * 그 자리를 비워 두면 기체가 덜 모인 것이 효모가 없어서인지 양이 적어서인지 갈라낼 수 없다.
 */
export const GLUCOSE_POUR_ML = 20;
export const YEAST_POUR_ML = 15;
export const STANDARD_TOTAL_ML = GLUCOSE_POUR_ML + YEAST_POUR_ML;   // 35

/** 이산화 탄소 확인에 쓰는 수산화 칼륨 수용액. **강한 부식성 물질이다** (README 안전 절). */
export const KOH_PCT = 40;
export const KOH_POUR_ML = 15;

/**
 * *Saccharomyces cerevisiae* 의 온도 (℃). [사실]
 *
 * 이 넷이 아래 [모형] 계수가 맞춰야 하는 과녁이다. 계수를 고쳤으면
 * `tests/fermentation.test.js` 가 이 과녁을 여전히 맞히는지 본다.
 */
export const OPT_GROWTH_LOW_C = 28;
export const OPT_GROWTH_HIGH_C = 33;
export const MAX_GROWTH_C = 41;
export const UPPER_LIMIT_C = 45.4;

/**
 * 온도가 10 ℃ 오를 때 반응 속도가 몇 배가 되는가 (Q₁₀).
 * 생물 반응에서 흔히 쓰는 값이 2 다. **효모가 죽는 것은 여기 들어 있지 않다** — 따로 곱한다.
 */
export const Q10 = 2;

/** Q₁₀ 의 기준 온도 (℃). 실온이다. */
export const Q10_REF_C = 20;

/* ------------------------------------------------------------------ */
/* [모형] 보정 계수 — 실측값이 아니다                                   */
/* ------------------------------------------------------------------ */

/**
 * 효모가 반쯤 죽는 온도 (℃) 와 그 전이의 가파르기. **[모형]**
 *
 * 이 두 값은 Q₁₀ 로 오르는 곡선과 곱해져 **최고점이 약 33 ℃ 에 오게** 맞춰져 있다.
 * 상한 45.4 ℃ 에서 살아 있는 비율은 약 3 % 가 된다.
 * 온도를 올리면 반응은 빨라지지만 효모가 죽는다. 그 줄다리기가 최적 온도를 만든다.
 *
 * **[사실] 이 아니다.** 실제 사멸 곡선은 시간에도 달려 있고 균주마다 다르다.
 */
export const DEATH_HALF_C = 37;
export const DEATH_WIDTH_C = 2.5;

/**
 * 차가운 쪽에서 발효가 잦아드는 온도 (℃) 와 폭. **[모형]**
 *
 * ── 왜 Q₁₀ 만으로는 모자라나 ───────────────────────────────────────
 * Q₁₀ = 2 만 쓰면 10 ℃ 가 20 ℃ 의 **절반**이 된다. 그런데 실제 교실에서 10 ℃ 이하는
 * 관찰 시간 동안 **거의 아무 일도 일어나지 않는다** (AGENTS.md §2.5). 냉장고에 넣은 반죽이
 * 하룻밤을 두어야 부푸는 것과 같은 이야기다.
 *
 * **이것은 죽는 것이 아니다.** 데우면 그대로 돌아온다 — `activeFraction` 과 정반대다.
 * 그래서 함수를 따로 두었다. 두 가지를 한 곡선으로 뭉개면 「10 ℃ 에서 효모가 죽었다」가
 * 학생이 얻는 결론이 되는데, 그것은 이 실험을 거꾸로 배운 것이다.
 */
export const COLD_HALF_C = 12;
export const COLD_WIDTH_C = 2.5;

/**
 * 기준 조건에서 1 분 동안 모이는 기체의 양 (mL). **[모형] [확인 필요]**
 *
 * 기준 조건 = 33 ℃ · 10 % 포도당 20 mL · 효모액 15 mL · 솜마개로 막음.
 * **교실에서 실제로 재 본 값이 아니다.** 다른 상수를 다 정하고 나면 양의 눈금은 이 하나로
 * 정해지므로, **한 번 실측하면 이 숫자만 고치면 된다.** 그러라고 따로 뽑아 두었다.
 */
export const GAS_RATE_REF_ML_PER_MIN = 0.6;

/**
 * 맹관부가 담을 수 있는 기체의 양 (mL). **[확인 필요]**
 *
 * 실물 발효관(큐네 발효관)의 규격을 확인하지 못했다. 이 값은 **그림의 눈금**이지
 * 실물 치수가 아니다 — 화면에 「맹관부는 20 mL 입니다」라고 적지 않는다.
 * 규격을 확인하는 사람이 이 숫자와 `docs/05-result-renderer.md` 를 함께 고친다.
 */
export const CLOSED_ARM_CAPACITY_ML = 20;

/**
 * 관찰을 접는 시간 (분). **[모형]**
 *
 * 실제 수업에서도 무한정 기다리지 않는다. 이 시간까지가 한 시행이다.
 * 막는 것이 아니다 — 기체가 안 모인 것도 결과이고, 그 결과가 답이다.
 */
export const OBSERVE_LIMIT_MIN = 20;

/* ------------------------------------------------------------------ */
/* 부분 인자 — 하나씩 따로 검사할 수 있게 내보낸다                      */
/* ------------------------------------------------------------------ */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 온도가 올라가면 분자가 더 자주 부딪힌다. 효모가 죽는 것은 여기 없다. */
export function rateByTemp(tempC) {
  return Q10 ** ((tempC - Q10_REF_C) / 10);
}

/**
 * 아직 살아 있는 효모의 비율 (0~1).
 *
 * 55 ℃ 에서 기체가 안 나는 것은 효모가 죽어서이고, **식혀도 돌아오지 않는다.**
 * 이 함수는 그쪽만 다룬다. 차가운 쪽은 `coldFraction` 이 다룬다.
 * **두 가지를 가르는 것이 이 실험이 가르치려는 것 중 하나다.**
 */
export function activeFraction(tempC) {
  return 1 / (1 + Math.exp((tempC - DEATH_HALF_C) / DEATH_WIDTH_C));
}

/**
 * 차가운 쪽에서 효모가 얼마나 깨어 있는가 (0~1).
 *
 * 10 ℃ 에서 느린 것은 **죽은 것이 아니다.** 데우면 그대로 돌아온다.
 * `activeFraction` 과 반드시 따로 두어야 하는 이유가 이것이다.
 */
export function coldFraction(tempC) {
  return 1 / (1 + Math.exp((COLD_HALF_C - tempC) / COLD_WIDTH_C));
}

/**
 * 온도가 발효 속도에 미치는 영향 전부. 최고점은 약 33 ℃ 에 온다.
 * **규격화하지 않은 값**이다 — 기준 조건에서 1 이 되게 맞추는 것은 `gasRate` 가 한다.
 */
export function tempFactor(tempC) {
  return rateByTemp(tempC) * activeFraction(tempC) * coldFraction(tempC);
}

/** 최고점의 온도 인자. 규격화에 쓴다. 상수를 고치면 이 값도 알아서 따라온다. */
const TEMP_FACTOR_REF = tempFactor(OPT_GROWTH_HIGH_C);

/**
 * 포도당이 발효 속도에 미치는 영향. **[모형]**
 *
 * 학교에서 쓰는 5~10 % 구간에서는 기질이 모자라 속도가 농도에 거의 비례한다.
 * (정확한 포화 상수는 균주·조건마다 갈린다 — [확인 필요]. 여기서는 비례로 둔다.)
 * 포도당이 아예 없으면(증류수만) 발효할 것이 없어 0 이다.
 */
export function glucoseFactor(glucosePct) {
  return Math.max(0, glucosePct) / GLUCOSE_STANDARD_PCT;
}

/* ------------------------------------------------------------------ */
/* 합치기                                                              */
/* ------------------------------------------------------------------ */

/**
 * 한 시행의 조건.
 * @typedef {object} Conditions
 * @property {number} tempC       발효 온도 (℃)
 * @property {number} glucosePct  포도당 수용액의 농도 (%)
 * @property {number} yeastMl     넣은 효모액의 양 (mL). 0 이면 대조군이다
 * @property {number} totalMl     팽대부에 담긴 용액의 총 부피 (mL)
 * @property {boolean} plugged    솜마개로 산소를 차단했는가
 */

/** 조건 하나를 채운다. 빠진 값은 기준 조건으로 둔다. */
export function normalizeConditions(c = {}) {
  return {
    tempC: c.tempC ?? Q10_REF_C,
    glucosePct: c.glucosePct ?? GLUCOSE_STANDARD_PCT,
    yeastMl: c.yeastMl ?? YEAST_POUR_ML,
    totalMl: c.totalMl ?? STANDARD_TOTAL_ML,
    plugged: c.plugged ?? true,
  };
}

/**
 * 이산화 탄소 발생 속도 (mL/분).
 *
 * ── 솜마개를 안 했으면 왜 속도가 그대로인가 ────────────────────────
 * **호흡도 이산화 탄소를 낸다.** 그래서 맹관부에 모인 기체만으로는 발효인지 호흡인지
 * 갈라낼 수 없다 (AGENTS.md §2.5). 솜마개를 안 했을 때 기체가 확 줄게 만들면
 * 「산소가 있으면 CO₂ 가 덜 난다」는 **틀린 것**을 가르치게 된다.
 *
 * 그래서 여기서는 속도를 건드리지 않는다. 대신 그 시행이 **무엇을 보여 주지 못하는지**를
 * 규칙 엔진과 그래프가 말한다 (`rules.js` 의 `PUT_IN_INCUBATOR`, `graph.js` 의 설명).
 * 결과가 답하되, 그 답이 그림이 아니라 **말**인 자리다.
 */
export function gasRate(conditions) {
  const c = normalizeConditions(conditions);
  // 효모가 없으면(대조군) 아무 일도 일어나지 않는다. 증류수만으로는 발효가 없다.
  const yeastAmount = Math.max(0, c.yeastMl) / YEAST_POUR_ML;
  return GAS_RATE_REF_ML_PER_MIN
    * (tempFactor(c.tempC) / TEMP_FACTOR_REF)
    * glucoseFactor(c.glucosePct)
    * yeastAmount;
}

/**
 * 흐른 시간 뒤 맹관부에 모인 기체의 양 (mL).
 *
 * ── 왜 시간에 비례하나 ─────────────────────────────────────────────
 * 실제로는 효모가 깨어나는 데 걸리는 시간(유도기)이 있고, 포도당이 줄면 속도도 준다.
 * 관찰 시간 20 분은 그 둘이 다 눈에 띄기 전이라 **직선으로 둔다.**
 * 시간을 더 길게 늘리려면 이 함수부터 고쳐야 한다 — 늘여 놓고 직선으로 두면 틀린다.
 *
 * 맹관부가 다 차면 더 모이지 않는다. 실제로도 그렇다.
 */
export function gasVolume(conditions, elapsedMin) {
  const raw = gasRate(conditions) * Math.max(0, elapsedMin);
  return Math.min(raw, CLOSED_ARM_CAPACITY_ML);
}

/**
 * 맹관부를 채운 정도 (0~1). 렌더러가 기체 기둥의 길이를 이 값으로 정한다.
 * **시간을 받아 그림이 되는 유일한 통로다.**
 */
export function fillFraction(conditions, elapsedMin) {
  return clamp01(gasVolume(conditions, elapsedMin) / CLOSED_ARM_CAPACITY_ML);
}

/**
 * 수산화 칼륨 수용액을 넣은 뒤 맹관부에 남는 기체의 양 (mL).
 *
 * CO₂ 는 KOH 에 흡수된다. 넣은 양이 넉넉하면 거의 다 흡수되고, 맹관부의 기체가 줄어든다.
 * **그것이 이 실험의 CO₂ 확인 방법이다.**
 *
 * 0 으로 딱 떨어지게 두지 않은 것은, 실제로도 용액에 안 닿은 자리와 공기가 조금 남기 때문이다.
 * 남는 비율은 [모형] 이다.
 */
export const KOH_RESIDUAL_FRACTION = 0.06;

export function gasAfterKoh(gasMl, kohMl) {
  if (kohMl <= 0) return gasMl;
  // 넣은 KOH 가 표준량에 못 미치면 그만큼만 흡수한다 — 조금 넣고 「안 줄었다」고 읽지 않게.
  const reach = clamp01(kohMl / KOH_POUR_ML);
  const absorbed = gasMl * (1 - KOH_RESIDUAL_FRACTION) * reach;
  return Math.max(0, gasMl - absorbed);
}
