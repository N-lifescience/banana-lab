/**
 * 반응 속도 모형 — 원반이 떠오르는 데 걸리는 시간.
 *
 * 이 파일은 DOM 을 모른다. `document`·`window`·`Date.now()`·`Math.random()` 을 쓰지 않는다.
 * 순수 함수만 두어 `node --test` 로 검증한다 (AGENTS.md §3.4).
 *
 * ── 무엇을 재는가 ──────────────────────────────────────────────────
 * 감자즙을 적신 거름종이 원반을 과산화수소수에 넣으면 카탈레이스가 H₂O₂ 를 분해한다.
 *
 *     2H₂O₂ → 2H₂O + O₂
 *
 * 생긴 산소 기포가 원반에 붙어 부력이 무게를 넘는 순간 원반이 떠오른다.
 * 그러므로 **떠오르는 시간 = (뜨는 데 필요한 기체량) / (산소 발생 속도)** 다.
 * 이 파일이 하는 일은 조건에서 발생 속도를 내고, 그것을 시간으로 뒤집는 것뿐이다.
 *
 * ── 두 갈래의 산소 ─────────────────────────────────────────────────
 * 발생 속도는 **효소가 만드는 것**과 **효소 없이 염기가 만드는 것**의 합이다.
 * 두 번째를 빼면 시뮬레이터가 실제 교실 실험과 어긋난다 (AGENTS.md §2.5).
 *
 * ── 상수의 출처를 갈라 둔다 ────────────────────────────────────────
 * 아래 상수는 두 종류다. 섞어 읽으면 안 된다.
 *
 *   [사실]  자료에서 온 값. 바꾸려면 사람에게 묻는다 (AGENTS.md §6)
 *   [모형]  관찰되는 **순서와 배율**을 재현하려고 고른 계수. **실측값이 아니다.**
 *           실물 수치로 인용하지 말 것. 교실에서 실제로 재 보면 보정해야 한다.
 */

/* ------------------------------------------------------------------ */
/* [사실] 자료에서 온 값                                                */
/* ------------------------------------------------------------------ */

/** 이 실험에서 쓰는 과산화수소수의 표준 농도 (%). 통제변인의 기준값이다. */
export const H2O2_STANDARD_PCT = 3;

/** 펀치로 뚫는 거름종이 원반의 지름 (mm). */
export const DISC_DIAMETER_MM = 6;

/**
 * 온도가 10 ℃ 오를 때 반응 속도가 몇 배가 되는가 (Q₁₀).
 * 생물 반응에서 흔히 쓰는 값이 2 다. 변성은 여기 들어 있지 않다 — 아래에서 따로 곱한다.
 */
export const Q10 = 2;

/** Q₁₀ 의 기준 온도 (℃). 실온이다. */
export const Q10_REF_C = 20;

/**
 * 카탈레이스가 반쯤 변성되는 온도 (℃) 와 그 전이의 가파르기.
 *
 * 변성은 **약 40~50 ℃ 에서 시작**한다. 이 두 값은 그 구간을 지나가는 S 자를 만든다 —
 * 곱한 결과의 최고점이 **약 35~40 ℃** 에 오게 맞춰져 있다 (AGENTS.md §2.4).
 * 온도를 올리면 반응은 빨라지지만 효소가 죽는다. 그 줄다리기가 최적 온도를 만든다.
 */
export const DENATURE_HALF_C = 45;
export const DENATURE_WIDTH_C = 3;

/** 카탈레이스의 최적 pH. */
export const PH_OPTIMUM = 7;

/** pH 활성 곡선의 폭. 최적점에서 얼마나 빨리 떨어지는가. [모형] */
export const PH_WIDTH = 2.2;

/**
 * 과산화수소의 pKa. [사실]
 *
 * 염기 촉매 분해는 HOO⁻ 가 남은 H₂O₂ 를 치는 반응이라 **둘이 반반일 때 가장 빠르다.**
 * 반반이 되는 pH 가 곧 pKa 이므로, 최고점은 pH 11.7 부근이다 — 흔히 인용되는
 * 「pH 11.5 부근 최대」와 같은 이야기다. 이 값은 **맞춘 것이 아니라 pKa 에서 나온다.**
 */
export const H2O2_PKA = 11.7;

/* ------------------------------------------------------------------ */
/* [모형] 보정 계수 — 실측값이 아니다                                   */
/* ------------------------------------------------------------------ */

/**
 * 기준 조건에서 원반이 떠오르는 데 걸리는 시간 (초). **[모형] [확인 필요]**
 *
 * 기준 조건 = 20 ℃ · pH 7 · 3 % 과산화수소수 · 감자즙 원액 · 완충 용액.
 * 교실에서 실제로 재 본 값이 아니다. 다른 상수를 다 정하고 나면 시간 눈금은 이 하나로 정해지므로,
 * **한 번 실측하면 이 숫자만 고치면 된다.** 그러라고 따로 뽑아 두었다.
 */
export const T_REF_S = 25;

/**
 * 기포가 원반에 붙어 있지 못하게 되는 온도 (℃). **[사실에서 나온 모형]**
 *
 * ── 왜 이것이 필요한가 ─────────────────────────────────────────────
 * 염기 촉매 분해에는 변성이 없어서 온도를 올릴수록 끝없이 빨라진다. 그래서 pH 를 9 나 11 로
 * **통제해 두고** 온도를 바꾸면 **100 ℃ 가 가장 빨라졌다** — 「끓는 물이 제일 빠르다」가
 * 학생이 얻는 결론이 됐다. `AGENTS.md` §2.5 의 「끓인 조건에서는 원반이 아예 뜨지 않는다」와
 * 정면으로 어긋난다. 실험대에 pH 9 완충 병과 100 ℃ 수조가 나란히 있으므로
 * **설계상 완전히 정상적인 선택**이 그 결론으로 이어졌다.
 *
 * ── 왜 이렇게 고치나 ───────────────────────────────────────────────
 * 염기 갈래만 눌러 놓는 것은 그 항을 겨눈 땜질이다. 실제로 일어나는 일은 따로 있다:
 * **끓는 물에서는 기포가 원반에 붙어 있지 못한다.** 액체 자체가 끓어 기포가 쉬지 않고
 * 떨어져 나가므로 모이지 않는다. 그래서 끓는 물에서는 이 측정 자체가 성립하지 않는다.
 *
 * 두 갈래 **모두**에 곱한다 — 효소가 만든 기포든 염기가 만든 기포든 붙어 있지 못하는 것은
 * 같기 때문이다. 60 ℃(230 초)는 그대로 두고 100 ℃ 에서만 0 이 되게 잡았다.
 */
export const BUBBLE_HOLD_FULL_C = 85;
export const BOILING_C = 100;

/**
 * 관찰을 접는 시간 (초). **[모형]**
 *
 * 실제 수업에서도 무한정 기다리지 않는다. 이 시간까지 안 뜨면 「뜨지 않음」으로 적는다.
 * 막는 것이 아니다 — 안 뜨는 것도 결과이고, 그 결과가 효소가 죽었다는 뜻이다.
 */
export const OBSERVE_LIMIT_S = 300;

/**
 * 염기 촉매 분해의 세기. **[모형]**
 *
 * 기준 조건의 효소 반응 속도를 1 로 두었을 때, 20 ℃ · pH 11.7 에서 염기만으로 나는 속도.
 * 3 으로 두면 **완충하지 않은 pH 11 이 pH 7 보다 빨라진다** — 실제 교실에서 흔히 나오는
 * 역전이다 (AGENTS.md §2.5). 이 계수를 0 으로 만들면 시뮬레이터가 실제와 어긋난다.
 */
export const BASE_STRENGTH = 3;

/**
 * 완충 용액을 쓸 때 염기 촉매 분해가 줄어드는 비율. **[모형]**
 *
 * 산·염기를 그대로 부으면 섞이기 전 국소적으로 pH 가 훨씬 높은 자리가 생기고, 거기서
 * 분해가 몰아친다. 완충 용액은 pH 를 이름값에 붙들어 두므로 그 몰아침이 준다.
 * **없어지지는 않는다** — 완충해도 pH 11 에서는 여전히 염기 분해가 일어난다.
 */
export const BUFFERED_BASE_FACTOR = 0.35;

/* ------------------------------------------------------------------ */
/* 부분 인자 — 하나씩 따로 검사할 수 있게 내보낸다                      */
/* ------------------------------------------------------------------ */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** 온도가 올라가면 분자가 더 자주 부딪힌다. 변성은 여기 없다. */
export function rateByTemp(tempC) {
  return Q10 ** ((tempC - Q10_REF_C) / 10);
}

/**
 * 아직 살아 있는 효소의 비율 (0~1).
 *
 * 0 ℃ 에서 느린 것은 **변성이 아니다** — 분자 운동이 느릴 뿐이고 데우면 돌아온다.
 * 60 ℃ 에서 느린 것은 효소가 죽어서이고, 식혀도 돌아오지 않는다.
 * 이 함수는 뒤쪽만 다룬다. 앞쪽은 rateByTemp 가 다룬다. 두 가지를 가르는 것이
 * 이 실험이 가르치려는 것 중 하나다.
 */
export function activeFraction(tempC) {
  return 1 / (1 + Math.exp((tempC - DENATURE_HALF_C) / DENATURE_WIDTH_C));
}

/** 온도가 효소 반응에 미치는 영향 전부. 최고점은 약 35~40 ℃ 에 온다. */
export function enzymeTempFactor(tempC) {
  return rateByTemp(tempC) * activeFraction(tempC);
}

/**
 * 생긴 기포가 원반에 **붙어 있는** 비율 (0~1).
 *
 * 끓는 물에서는 액체가 스스로 끓어 기포가 쉬지 않고 떨어져 나가므로 모이지 않는다.
 * 85 ℃ 까지는 그대로 붙어 있고(1), 100 ℃ 에서 0 이 된다.
 * **효소가 만든 기포든 염기가 만든 기포든 같다** — 그래서 두 갈래 모두에 곱한다.
 */
export function bubbleRetention(tempC) {
  if (tempC <= BUBBLE_HOLD_FULL_C) return 1;
  return clamp01((BOILING_C - tempC) / (BOILING_C - BUBBLE_HOLD_FULL_C));
}

/** pH 가 효소 활성에 미치는 영향 (0~1). 최적점 pH 7 에서 1 이다. */
export function enzymePhFactor(ph) {
  const d = (ph - PH_OPTIMUM) / PH_WIDTH;
  return Math.exp(-d * d);
}

/**
 * 염기 촉매 분해의 pH 의존성 (0~1, pKa 에서 1).
 *
 * HOO⁻ 와 H₂O₂ 가 **둘 다 있어야** 반응한다. 한쪽 비율을 α 라 하면 속도는 α(1−α) 에 비례하고,
 * 그 곱은 α = 0.5, 곧 pH = pKa 에서 최대다. 여기서는 최고점을 1 로 맞추려고 4 를 곱한다.
 */
export function baseCatalysisFactor(ph) {
  const alpha = 1 / (1 + 10 ** (H2O2_PKA - ph));
  return 4 * alpha * (1 - alpha);
}

/* ------------------------------------------------------------------ */
/* 합치기                                                              */
/* ------------------------------------------------------------------ */

/**
 * 한 시행의 조건.
 * @typedef {object} Conditions
 * @property {number} tempC        수조 온도 (℃)
 * @property {number} ph           용액의 pH
 * @property {number} h2o2Pct      과산화수소수 농도 (%)
 * @property {number} extractPct   감자즙 농도 (%). 100 이 원액
 * @property {boolean} buffered    완충 용액으로 pH 를 맞췄는가. 거짓이면 0.1 M 산·염기
 * @property {boolean} extractBoiled  감자즙을 미리 끓였는가 (대조군)
 */

/** 조건 하나를 채운다. 빠진 값은 기준 조건으로 둔다. */
export function normalizeConditions(c = {}) {
  return {
    tempC: c.tempC ?? 20,
    ph: c.ph ?? PH_OPTIMUM,
    h2o2Pct: c.h2o2Pct ?? H2O2_STANDARD_PCT,
    extractPct: c.extractPct ?? 100,
    buffered: c.buffered ?? true,
    extractBoiled: c.extractBoiled ?? false,
  };
}

/**
 * 산소 발생 속도. 기준 조건에서 1 이 되도록 규격화돼 있다.
 * @returns {{enzyme:number, base:number, total:number}}
 */
export function oxygenRate(conditions) {
  const c = normalizeConditions(conditions);

  // 기질 농도. 학교 농도에서 카탈레이스는 포화와 거리가 멀어 속도가 농도에 거의 비례한다.
  // (정확한 K_M 은 자료마다 크게 갈린다 — [확인 필요]. 여기서는 비례로 둔다.)
  const substrate = c.h2o2Pct / H2O2_STANDARD_PCT;

  // 끓인 감자즙에는 살아 있는 효소가 없다. 식혀도 돌아오지 않는다.
  const enzymeAmount = c.extractBoiled ? 0 : c.extractPct / 100;

  const enzyme = enzymeTempFactor(c.tempC)
    * enzymePhFactor(c.ph)
    * substrate
    * enzymeAmount;

  // 염기 촉매 분해에는 효소가 필요 없다. 끓인 감자즙에서도, 감자즙이 없어도 일어난다.
  // 온도에는 따라가지만 변성될 것이 없으므로 activeFraction 을 곱하지 않는다.
  const base = BASE_STRENGTH
    * baseCatalysisFactor(c.ph)
    * rateByTemp(c.tempC)
    * substrate
    * (c.buffered ? BUFFERED_BASE_FACTOR : 1);

  // 끓는 물에서는 기포가 붙어 있지 못한다. **두 갈래 모두**에 곱한다.
  const hold = bubbleRetention(c.tempC);
  return { enzyme: enzyme * hold, base: base * hold, total: (enzyme + base) * hold };
}

/**
 * 원반이 떠오르는 데 걸리는 시간.
 *
 * @returns {{floated:boolean, seconds:number|null, rate:object, limitS:number}}
 *   `floated` 가 거짓이면 관찰 시간(OBSERVE_LIMIT_S) 안에 뜨지 않은 것이다.
 *   `seconds` 는 그때 null 이다 — 「아주 큰 수」로 두면 그래프가 그 점을 그리려 든다.
 */
export function riseTime(conditions) {
  const rate = oxygenRate(conditions);
  const seconds = rate.total > 0 ? T_REF_S / rate.total : Infinity;
  const floated = Number.isFinite(seconds) && seconds <= OBSERVE_LIMIT_S;
  return {
    floated,
    seconds: floated ? seconds : null,
    rate,
    limitS: OBSERVE_LIMIT_S,
  };
}

/**
 * 원반을 넣기 **전에** 비커에서 이는 거품의 세기 (0~1).
 *
 * 완충하지 않은 pH 11 에서는 감자즙을 넣기도 전에 거품이 인다. 실제 기록에 있는 일이고,
 * 학생이 「효소가 없는데 왜 거품이 나지?」를 눈으로 먼저 만나는 자리다.
 * 렌더러가 이 값으로 비커 안 기포를 그린다.
 */
export function preFizz(conditions) {
  return clamp01(oxygenRate(conditions).base / 1.5);
}

/**
 * 지금까지 모인 기체의 비율 (0~1). 1 이 되는 순간 원반이 뜬다.
 * 렌더러가 원반의 높이를 이 값으로 정한다 — 시간을 받아 그림이 되는 유일한 통로다.
 */
export function riseProgress(conditions, elapsedS) {
  const { total } = oxygenRate(conditions);
  if (total <= 0) return 0;
  return clamp01((elapsedS * total) / T_REF_S);
}
