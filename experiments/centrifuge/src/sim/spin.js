/**
 * 회전 물리와 혈액의 층 — **이 실험의 `optics.js`.**
 *
 * 바나나랩의 `src/sim/optics.js` 자리에 오는 파일이다. 이 실험에는 현미경이 없다.
 * 여기 있는 것은 **끈을 당겨 얻은 회전**과, 그 회전이 혈액을 갈라 놓는 정도다.
 *
 * "보기 좋게" 바꾸지 말 것. `tests/spin.test.js` 가 값을 고정하고 있다.
 * `docs/05-tube-renderer.md` 참조.
 */

/* ================================================================== */
/* 1. 혈액 — 출처가 있는 값                                            */
/* ================================================================== */

/**
 * **헤마토크릿** — 전체 혈액에서 적혈구가 차지하는 부피 비율.
 *
 * 성인 남성 약 45 %, 성인 여성 약 40 %. 나머지 약 55 % 가 혈장이다.
 * (사람이 검증한 브리프 `prompts/centrifuge.txt` — 이 세션이 지어낸 값이 아니다)
 *
 * 이 값은 **띠를 그릴 자리**이지 화면이 읊는 정답이 아니다. 학생은 자로 두 길이를
 * 재어 스스로 나눈다 (`hematocrit()` 참조). 화면이 45 % 를 먼저 말하면 잴 이유가 없다.
 */
export const HEMATOCRIT = { male: 0.45, female: 0.40 };

/** 화면이 기본으로 쓰는 시료. 학생이 고를 수 있게 두면 「누구의 피인가」가 변인이 된다. */
export const DEFAULT_DONOR = 'male';

/**
 * **연층(백혈구·혈소판)** 이 차지하는 비율 — **1 % 미만.**
 *
 * 아주 얇은 띠다. 두껍게 그리면 백혈구가 적혈구만큼 많다는 틀린 그림이 된다.
 * 색은 **회백색**이다 — 한국어 위키백과의 「담황색」을 따르면 혈장과 구분이 안 된다
 * (AGENTS.md §2.5).
 */
export const BUFFY_FRACTION = 0.007;

/**
 * 완전히 갈렸을 때 세 층이 차지하는 비율. 바깥쪽부터 적혈구 → 연층 → 혈장.
 *
 * **연층은 적혈구층에서 떼어 온다.** 혈장에서 떼면 혈장이 55 % 보다 얇아지는데,
 * 연층은 혈구라서 혈장 쪽이 아니라 혈구 쪽에 속한다.
 */
export function layerFractions(hct = HEMATOCRIT[DEFAULT_DONOR]) {
  const buffy = Math.min(BUFFY_FRACTION, hct);
  return { packed: hct - buffy, buffy, plasma: 1 - hct };
}

/**
 * **덜 돌리면 헤마토크릿이 크게 나온다** — 이 실험에서 가장 값진 오차다.
 *
 * 적혈구는 바깥쪽으로 가라앉으므로, 갈리는 동안 **축 쪽에서 맑은 혈장이 자라 들어온다.**
 * 붉은 부분은 처음에 기둥 전체였다가 다져지면서 헤마토크릿 값까지 줄어든다.
 * 그래서 절반만 돌린 학생은 적혈구층을 실제보다 길게 재고, 헤마토크릿을 과대평가한다.
 * 막지 않는다 — 그 과대평가가 "왜 더 돌려야 하는가" 를 말해 준다.
 *
 * @param {number} sep 분리 진행도 0~1
 * @returns {number} 붉게 보이는 부분이 기둥에서 차지하는 비율
 */
export function packedFraction(sep, hct = HEMATOCRIT[DEFAULT_DONOR]) {
  const s = clamp01(sep);
  return 1 - (1 - hct) * s;
}

/**
 * 학생이 자로 잰 두 길이를 나눈다.
 *
 * **앱은 정답 헤마토크릿을 갖고 있지 않다.** 이 함수는 계산기일 뿐이고,
 * 어디서도 시료(남/여)를 인자로 받지 않는 것이 그 증거다.
 * 잴 수 없는 값이 들어오면 숫자를 지어내지 않고 null 을 돌려준다.
 */
export function hematocrit(packedMm, columnMm) {
  if (!(columnMm > 0) || !(packedMm >= 0)) return null;
  return packedMm / columnMm;
}

/**
 * 모세관의 길이 (mm). **자의 눈금을 그리는 데만 쓴다.**
 *
 * 헤마토크릿 표준 모세관의 길이로 널리 쓰이는 값이지만, 교과서가 어느 규격을 집는지는
 * **[확인 필요]** 다. 그래도 결과가 흔들리지 않는 이유는 헤마토크릿이 **길이의 비**이기
 * 때문이다 — 이 상수를 바꿔도 학생이 구하는 값은 그대로다.
 * `tests/spin.test.js` 가 그 무관함을 검사한다.
 *
 * **내경과 부피는 적지 않는다.** 이 실험은 그 값을 쓰지 않고, 지어내면 다음 사람이
 * 사실로 읽는다.
 */
export const TUBE_LEN_MM = 75;

/* ================================================================== */
/* 2. 당기는 리듬 — 이 실험의 몸통                                     */
/* ================================================================== */

/**
 * ── 왜 「박자」인가 ─────────────────────────────────────────────────
 * 종이 원심분리기는 꼬인 끈이 풀리며 회전판을 돌리고, 회전판의 관성이 끈을 **반대로 다시
 * 꼬면서** 멎는다. 다시 꼬여 멎는 그 순간에 당겨야 힘이 보태진다. 어긋나면 아직 돌고 있는
 * 회전판을 거스르게 되어 **오히려 느려진다.**
 *
 * 그리고 빨라질수록 다시 꼬이는 데 걸리는 시간이 짧아진다 — **박자가 저절로 빨라진다.**
 * 학생은 손을 그에 맞춰 빠르게 놀려야 한다. 이것이 이 실험에서 손이 배우는 것이다.
 *
 * 아래 값들은 전부 **시뮬레이션 단위**다. 실제 rpm 도, 실제 초도 아니다 —
 * 그 값은 `[확인 필요]` 이고, 그래서 **화면에 시계도 회전수도 띄우지 않는다** (AGENTS.md §2.4).
 */

/** 회전 속도의 상한. 0~1 로 정규화한다 — rpm 을 지어내지 않기 위해서다. */
export const MAX_SPEED = 1;

/**
 * 박자가 완전히 맞은 당김 한 번이 세기 1 로 올리는 속도.
 *
 * 저항과 짝지어 **잘 맞은 리듬이면 상한까지 간다**는 것을 정한다. 여기가 너무 낮으면
 * 아무리 잘해도 절반쯤에서 멎어, 학생이 리듬을 고쳐 봐도 결과가 달라지지 않는다.
 */
export const PULL_KICK = 0.25;

/**
 * 공기 저항과 종이의 마찰. 선형 + 이차 두 항.
 *
 * 박자가 절반쯤 맞은 학생은 이 저항과 균형을 이루는 자리(속도 0.55 언저리)에서 멎는다.
 * 그 차이가 층으로 드러나는 것이 이 실험의 몸통이다.
 */
export const DRAG = 0.28;
export const DRAG_Q = 0.22;

/** 꼬임이 한 번 오갔다 돌아오는 데 걸리는 시간의 역수 — 박자. 빠를수록 잦아진다. */
export const BEAT_BASE = 0.9;
export const BEAT_SLOPE = 1.6;

/**
 * 이 속도 아래에서는 박자를 따질 것이 없다.
 *
 * **멎어 있는 회전판에 대고 「박자가 틀렸다」고 할 수는 없다.** 물리적으로도 그렇고,
 * 처음 당기는 학생을 벌주지 않기 위해서도 그렇다. 돌기 시작한 뒤부터 박자가 걸린다.
 */
export const BEAT_FLOOR = 0.15;

/**
 * 시뮬레이션 시간이 실제 시간보다 얼마나 빨리 흐르는가.
 *
 * **이 값이 손에 잡히는 박자를 정한다.** 6 으로 두었더니 회전이 빠를 때 한 주기가
 * 0.1초가 되어 사람 손으로는 맞힐 수가 없었고, 회전은 1초도 안 되어 멎었다.
 * 여기서 정하는 것은 물리가 아니라 **손과 화면 사이의 속도**다 —
 * 회전 시간을 이 값으로 환산해 화면에 적지 않는다 (AGENTS.md §2.4).
 */
export const SIM_PER_SECOND = 1.7;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 지금 박자의 빠르기 (주기/시뮬레이션 초). 빠를수록 잦아진다. */
export function beatRate(speed) {
  return BEAT_BASE + BEAT_SLOPE * clamp01(speed);
}

/**
 * 박자에서 얼마나 어긋났는가. 0 이면 딱 맞고, 0.5 면 정확히 반대 박이다.
 *
 * `since` 는 **마지막으로 당긴 뒤 지난 꼬임 주기 수**다 (0 에서 시작해 늘어난다).
 * 딱 한 주기 뒤가 가장 좋고, 두 주기·세 주기 뒤도 맞는 박이다 — 한 박 쉬어도 리듬이다.
 * 그 사이(반 박)에 당기면 아직 돌고 있는 회전판을 거스른다.
 *
 * ── 마구 눌러 대는 것이 이기지 않는 이유는 `Math.max(1, …)` 한 자리다 ──────
 * 가장 가까운 맞는 박을 **한 주기 뒤부터** 찾는다. 그래서 당긴 직후(`since` ≈ 0)는
 * 자동으로 가장 나쁜 때가 된다 — 실제로도 그렇다. 끈이 풀려 있어 당길 것이 없고,
 * 회전판이 관성으로 되감아야 다음에 당길 것이 생긴다.
 *
 * 앞서 여기에 「다시 꼬이는 몫(REWIND)」 상수를 따로 두고 그 아래면 0.5 를 돌려줬는데,
 * **없애도 아무 검사가 안 깨졌다.** 위의 `Math.max(1, …)` 가 이미 같은 일을 하고 있었다.
 * 하는 일이 없는 상수는 다음 사람에게 "여기서 무언가를 막고 있다" 고 거짓말한다.
 */
export function timingError(since) {
  const k = Math.max(1, Math.round(since));
  return Math.min(0.5, Math.abs(since - k));
}

/**
 * 당김 한 번이 회전에 보태는 몫. **-1 ~ +1** 이다.
 *
 * 반대 박에 당기면 **음수** — 회전을 거스른다. 이것이 "리듬이 맞아야 한다" 를 결과로
 * 말하는 자리다. 막지 않는다. 아무 때나 당길 수 있고, 아무 때나 당기면 안 빨라진다.
 */
export function pullGain(strength, since, speed) {
  const s = clamp01(strength);
  const err = timingError(since);
  // 멎어 있을 때는 박자를 안 따진다. 돌기 시작하면 점점 따진다.
  const weight = clamp01(speed / BEAT_FLOOR);
  return s * (1 - 4 * err * weight);
}

/**
 * 회전판이 흔들리는 정도 0~1.
 *
 * 균형이 안 맞으면 무게 중심이 축에서 벗어나고, 빠를수록 그 흔들림이 커진다.
 * **막지 않는다** — 균형을 안 맞춰도 돌아가고, 흔들린 만큼 층이 흐리게 섞인다.
 */
export function wobbleOf(imbalance, speed) {
  return clamp01(clamp01(imbalance) * clamp01(speed) * 1.6);
}

/**
 * 시간이 dt 만큼 흐른 뒤의 회전 상태.
 *
 * 흔들림은 여분의 저항이 된다 — 흔들리는 회전판은 같은 힘으로 덜 빨라진다.
 * 실제로 그렇고, "균형을 맞추면 더 빨리 돈다" 는 것을 학생이 손으로 느끼는 자리다.
 *
 * @param {{speed:number, phase:number}} rotor
 * @param {{dt:number, imbalance:number}} opts
 */
export function stepSpin({ speed = 0, phase = 0 }, { dt = 1, imbalance = 0 } = {}) {
  const wob = wobbleOf(imbalance, speed);
  const decel = (DRAG * (1 + 2 * wob) * speed + DRAG_Q * speed * speed) * dt;
  const next = clamp(speed - decel, 0, MAX_SPEED);
  return {
    speed: next,
    // 박자는 지금 속도로 흐른다. 느려지면 박자도 느려진다.
    // **감싸지 않는다** — 몇 주기가 지났는지가 곧 박자 판정이다 (timingError).
    // 다만 한없이 늘리지는 않는다. 한참 손을 놓았다가 당기는 것은 새로 시작하는 것이다.
    phase: Math.min(MAX_SINCE, phase + beatRate(speed) * dt),
    wobble: wob,
  };
}

/** 마지막으로 당긴 뒤 셀 수 있는 주기 수의 상한. 한참 놓았다가 당기는 것은 새로 시작이다. */
export const MAX_SINCE = 4;

/**
 * 당긴 뒤의 회전 상태.
 *
 * 당기는 순간 꼬임이 풀리므로 `phase`(마지막 당김 뒤 지난 주기 수)를 0 으로 되돌린다 —
 * 다음 당길 때는 **한 주기가 지난 뒤**가 맞는 때다.
 */
export function applyPull({ speed = 0, phase = 0 }, { strength = 1 } = {}) {
  const gain = pullGain(strength, phase, speed);
  return {
    speed: clamp(speed + PULL_KICK * gain, 0, MAX_SPEED),
    phase: 0,
    gain,
  };
}

/* ================================================================== */
/* 3. 침강 — 회전이 층을 만든다                                        */
/* ================================================================== */

/**
 * **원심 가속도는 속도의 제곱에 비례한다** (RCF = ω²r / g).
 *
 * 그래서 두 배 빠르게 돌리면 네 배 빨리 갈린다. "세게 당기는 것이 오래 당기는 것보다
 * 훨씬 낫다" 가 이 제곱에서 나온다. 절차가 「리듬 있게」 라고 적힌 이유이기도 하다 —
 * 리듬이 맞아야 속도가 오르고, 속도가 올라야 제곱이 일한다.
 */
export function workGain(speed, dt = 1) {
  return clamp01(speed) ** 2 * dt;
}

/**
 * 누적 원심 일이 이만큼 쌓이면 절반쯤 갈린다.
 *
 * **실제 시간이 아니다.** 손으로 돌리는 원심분리기로 혈장이 분리된다는 것 자체는
 * 실증돼 있지만(paperfuge, *Nature Biomedical Engineering* 2017), 그 논문의 1.5분은
 * **연구 장비 기준**이라 학생 활동 수치로 쓸 수 없다. 이 상수가 정하는 것은
 * 화면에서 층이 갈리는 **속도 감각**뿐이고, 화면에는 시계가 뜨지 않는다.
 */
export const WORK_HALF = 2;

/** 누적 원심 일 → 분리 진행도 0~1. 지수적으로 접근한다 — 끝은 오래 걸린다. */
export function separationOf(work) {
  return 1 - Math.pow(0.5, Math.max(0, work) / WORK_HALF);
}

/**
 * 응고가 분리를 얼마나 막는가.
 *
 * 응고한 혈액은 젤이 되어 있어 적혈구가 따로 가라앉지 못한다. 완전히 응고하면
 * 층이 거의 안 생기고, 그때 위에 뜨는 것은 **혈장이 아니라 혈청**이다 —
 * 응고인자가 혈병으로 빠져나갔기 때문이다 (AGENTS.md §2.5).
 */
export function clotCeiling(clot) {
  return clamp01(1 - 0.85 * clamp01(clot));
}

/**
 * 층의 경계가 얼마나 또렷한가 0~1.
 *
 * 두 가지가 흐린다 — **덜 갈린 것**(아직 섞여 있다)과 **흔들린 것**(갈린 것이 다시 섞였다).
 * 둘을 나눠 두어야 화면이 "더 돌리세요" 와 "균형을 맞추세요" 를 갈라 말할 수 있다.
 * 학생이 고쳐야 할 것이 서로 다르다.
 */
export function sharpnessOf(sep, mixed) {
  return clamp01(clamp01(sep) * (1 - clamp01(mixed)));
}

/**
 * 흔들려 다시 섞이는 정도. 흔들림이 클수록, 빠를수록 빨리 섞인다.
 * 갈린 것을 도로 흐리게 만들 뿐 **분리 진행도 자체를 되돌리지는 않는다** —
 * 원심력은 계속 걸려 있기 때문이다.
 */
export function mixGain(wobble, speed, dt = 1) {
  return clamp01(wobble) * clamp01(speed) * dt * 0.09;
}

/**
 * 밀봉이 샐 때 빠져나가는 혈액의 몫.
 *
 * 원심력이 혈액을 바깥쪽 마개로 밀어붙이므로 **속도의 제곱에 비례**하고,
 * 밀봉이 좋을수록 적다. 새어도 막지 않는다 — 기둥이 짧아져 재기 어려워질 뿐이다.
 */
export function leakGain(sealQuality, speed, dt = 1) {
  const weak = clamp01(1 - clamp01(sealQuality));
  return weak * weak * clamp01(speed) ** 2 * dt * 0.06;
}
