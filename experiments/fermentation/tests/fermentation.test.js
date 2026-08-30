/**
 * 발효 모형 테스트.
 *
 * ── 값이 아니라 **순서**를 고정한다 ────────────────────────────────
 * `GAS_RATE_REF_ML_PER_MIN` 은 [모형][확인 필요] 값이다. 교실에서 실측하면 고쳐야 한다.
 * 그런데 그 숫자를 검사에 박아 두면, 실측해서 고치는 날 **빨간불이 나고 그날 지워지는 것은
 * 검사다** (`PLAYBOOK.md` §8). 그래서 여기서는 「30 ℃ 가 10 ℃ 보다 많다」처럼
 * **자료에서 온 순서**만 못 박는다.
 *
 * 자료에서 온 것(AGENTS.md §2.5):
 *   30~35 ℃ 최대 · 40 ℃ 이상 급감 · 55~60 ℃ 사실상 0 · 10 ℃ 이하 거의 0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gasRate, gasVolume, fillFraction, gasAfterKoh, normalizeConditions,
  tempFactor, activeFraction, coldFraction, glucoseFactor,
  OPT_GROWTH_LOW_C, OPT_GROWTH_HIGH_C, MAX_GROWTH_C, UPPER_LIMIT_C,
  GLUCOSE_STANDARD_PCT, YEAST_POUR_ML, KOH_POUR_ML,
  OBSERVE_LIMIT_MIN, CLOSED_ARM_CAPACITY_ML,
} from '../src/sim/fermentation.js';
import { tubeConditions } from '../src/sim/state.js';

/** 기준 조건 한 벌. 하나만 갈아 끼워 견주는 데 쓴다. */
const base = (over = {}) => normalizeConditions({
  tempC: OPT_GROWTH_HIGH_C, glucosePct: GLUCOSE_STANDARD_PCT,
  yeastMl: YEAST_POUR_ML, plugged: true, ...over,
});

const rateAt = (tempC) => gasRate(base({ tempC }));

/* ================================================================== */
/* 온도 — 이 실험이 가르치려는 곡선                                     */
/* ================================================================== */

test('최고점이 30~35 ℃ 안에 있다', () => {
  let peak = 0;
  let peakT = null;
  for (let t = 0; t <= 60; t += 0.5) {
    const f = tempFactor(t);
    if (f > peak) { peak = f; peakT = t; }
  }
  assert.ok(peakT >= 30 && peakT <= 35,
    `최고점이 ${peakT} ℃ 입니다 — 자료는 30~35 ℃ 라고 말합니다 (AGENTS.md §2.5)`);
});

test('최적 생장 구간(28~33 ℃)이 최고점의 8할을 넘는다', () => {
  const peak = tempFactor(OPT_GROWTH_HIGH_C);
  for (const t of [OPT_GROWTH_LOW_C, OPT_GROWTH_HIGH_C]) {
    assert.ok(tempFactor(t) / peak > 0.8, `${t} ℃ 가 최고점의 8할에 못 미칩니다`);
  }
});

test('40 ℃ 를 넘으면 급감한다', () => {
  const peak = tempFactor(OPT_GROWTH_HIGH_C);
  // 최대 생장 온도(41 ℃)에서는 아직 살아 있지만 확실히 내려와 있다.
  assert.ok(tempFactor(MAX_GROWTH_C) / peak < 0.5, '41 ℃ 가 최고점의 절반보다 큽니다');
  assert.ok(tempFactor(MAX_GROWTH_C) / peak > 0.05, '41 ℃ 에서 이미 죽어 버립니다 — 최대 생장 온도입니다');
  // 상한(45.4 ℃)을 넘으면 사실상 없다.
  assert.ok(tempFactor(UPPER_LIMIT_C) / peak < 0.1, `상한 ${UPPER_LIMIT_C} ℃ 에서 아직 활발합니다`);
});

test('55~60 ℃ 에서는 사실상 0 이다', () => {
  const peak = tempFactor(OPT_GROWTH_HIGH_C);
  for (const t of [55, 60]) {
    assert.ok(tempFactor(t) / peak < 0.02, `${t} ℃ 가 최고점의 2 % 를 넘습니다`);
  }
});

test('10 ℃ 이하에서는 거의 0 이다', () => {
  const peak = tempFactor(OPT_GROWTH_HIGH_C);
  for (const t of [0, 5, 10]) {
    assert.ok(tempFactor(t) / peak < 0.1, `${t} ℃ 가 최고점의 10 % 를 넘습니다`);
  }
});

/**
 * **낮은 쪽과 높은 쪽은 다른 일이다** (AGENTS.md §2.5).
 *
 * 10 ℃ 에서 느린 것은 분자 운동이 느려서이고 데우면 돌아온다.
 * 55 ℃ 에서 안 나는 것은 효모가 죽어서이고 식혀도 안 돌아온다.
 * 두 함수를 갈라 두었으므로, 갈라져 있는지를 검사가 지킨다 —
 * 한 곡선으로 뭉개면 여기서 잡힌다.
 */
test('차가워서 느린 것과 죽어서 안 나는 것이 다른 함수다', () => {
  // 10 ℃: 효모는 살아 있다(activeFraction 이 거의 1). 깨어 있지 않을 뿐이다.
  assert.ok(activeFraction(10) > 0.99, '10 ℃ 에서 효모가 죽은 것으로 계산됩니다');
  assert.ok(coldFraction(10) < 0.5, '10 ℃ 에서 효모가 다 깨어 있는 것으로 계산됩니다');

  // 55 ℃: 효모가 죽었다. 차가움과는 무관하다.
  assert.ok(activeFraction(55) < 0.01, '55 ℃ 에서 효모가 살아 있는 것으로 계산됩니다');
  assert.ok(coldFraction(55) > 0.99, '55 ℃ 를 차갑다고 계산합니다');
});

test('온도 순서가 자료와 같다 — 30 이 가장 많고 10 과 55 가 가장 적다', () => {
  const r = { 10: rateAt(10), 20: rateAt(20), 30: rateAt(30), 40: rateAt(40), 55: rateAt(55) };
  assert.ok(r[30] > r[20], '30 ℃ 가 20 ℃ 보다 적습니다');
  assert.ok(r[20] > r[10], '20 ℃ 가 10 ℃ 보다 적습니다');
  assert.ok(r[30] > r[40], '40 ℃ 가 30 ℃ 보다 많습니다');
  assert.ok(r[40] > r[55], '55 ℃ 가 40 ℃ 보다 많습니다');
  assert.ok(r[55] < r[10], '55 ℃ 가 10 ℃ 보다 많습니다 — 죽은 쪽이 더 나올 수는 없습니다');
});

/* ================================================================== */
/* 포도당 · 효모 · 산소                                                 */
/* ================================================================== */

test('포도당이 진하면 기체가 더 난다', () => {
  assert.ok(gasRate(base({ glucosePct: 10 })) > gasRate(base({ glucosePct: 5 })));
});

test('포도당이 없으면(증류수만) 발효할 것이 없다', () => {
  assert.equal(gasRate(base({ glucosePct: 0 })), 0);
  assert.equal(glucoseFactor(0), 0);
});

test('효모액 대신 증류수를 넣은 대조군은 기체가 안 모인다', () => {
  assert.equal(gasRate(base({ yeastMl: 0 })), 0);
  assert.equal(gasVolume(base({ yeastMl: 0 }), OBSERVE_LIMIT_MIN), 0);
});

test('효모액을 덜 넣으면 그만큼만 난다 — 부피가 결과를 바꾼다', () => {
  const full = gasRate(base({ yeastMl: YEAST_POUR_ML }));
  const half = gasRate(base({ yeastMl: YEAST_POUR_ML / 2 }));
  assert.ok(Math.abs(half / full - 0.5) < 1e-9, '효모액을 절반 넣었는데 절반이 안 납니다');
});

/**
 * **호흡도 이산화 탄소를 낸다.**
 *
 * 솜마개를 안 했을 때 기체가 확 줄게 만들면 「산소가 있으면 CO₂ 가 덜 난다」는
 * 틀린 것을 가르치게 된다 (AGENTS.md §2.5). 그림으로 안 갈리는 것이 사실이고,
 * 갈라 주는 것은 그래프의 **말**이다.
 */
test('솜마개를 안 해도 기체 양은 달라지지 않는다 — 갈라 주는 것은 말이지 그림이 아니다', () => {
  assert.equal(gasRate(base({ plugged: false })), gasRate(base({ plugged: true })));
});

/* ================================================================== */
/* 시간 · 맹관부                                                       */
/* ================================================================== */

test('시간이 흐르면 기체가 쌓인다', () => {
  const c = base();
  assert.ok(gasVolume(c, 10) > gasVolume(c, 5));
  assert.equal(gasVolume(c, 0), 0);
});

test('맹관부가 다 차면 더 모이지 않는다', () => {
  const c = base();
  assert.ok(gasVolume(c, 100000) <= CLOSED_ARM_CAPACITY_ML);
  assert.equal(fillFraction(c, 100000), 1);
});

test('기준 조건이 관찰 시간 안에 맹관부를 넘치지 않는다 — 넘치면 조건 차이가 안 보인다', () => {
  const f = fillFraction(base(), OBSERVE_LIMIT_MIN);
  assert.ok(f > 0.2 && f < 1,
    `기준 조건이 관찰 시간에 맹관부를 ${(f * 100).toFixed(0)} % 채웁니다 — `
    + '너무 적으면 안 보이고, 다 차면 조건 차이가 사라집니다');
});

/* ================================================================== */
/* 이산화 탄소 확인                                                     */
/* ================================================================== */

test('수산화 칼륨 수용액을 넣으면 이산화 탄소가 흡수되어 기체가 줄어든다', () => {
  const before = gasVolume(base(), OBSERVE_LIMIT_MIN);
  const after = gasAfterKoh(before, KOH_POUR_ML);
  assert.ok(after < before * 0.2, '기체가 줄어들지 않습니다 — 확인이 되지 않습니다');
  assert.ok(after > 0, '기체가 딱 0 이 됩니다 — 실제로는 조금 남습니다');
});

test('넣지 않으면 줄지 않는다', () => {
  const before = gasVolume(base(), OBSERVE_LIMIT_MIN);
  assert.equal(gasAfterKoh(before, 0), before);
});

test('조금만 넣으면 그만큼만 흡수된다 — 「안 줄었다」로 읽지 않게', () => {
  const before = gasVolume(base(), OBSERVE_LIMIT_MIN);
  const little = gasAfterKoh(before, KOH_POUR_ML / 3);
  const full = gasAfterKoh(before, KOH_POUR_ML);
  assert.ok(little > full && little < before);
});

test('모인 기체가 없으면 줄어들 것도 없다', () => {
  assert.equal(gasAfterKoh(0, KOH_POUR_ML), 0);
});

/* ================================================================== */
/* 순수 함수인가                                                       */
/* ================================================================== */

test('같은 조건이면 같은 값이 나온다', () => {
  const c = base({ tempC: 30 });
  assert.equal(gasVolume(c, 7), gasVolume(c, 7));
});

test('조건 객체를 건드리지 않는다', () => {
  const c = base();
  const copy = { ...c };
  gasVolume(c, 5);
  assert.deepEqual(c, copy);
});

/*
 * **`PLAYTEST.md` 의 표가 모형과 어긋나지 않는가.**
 *
 * ── 이 파일의 규칙을 어기는 것이 아니다 ────────────────────────────
 * 위 머리말대로 여기서는 **모형 값을 검사에 박지 않는다.** 이 검사도 박지 않는다 —
 * 박는 것은 **문서와 모형이 같다**는 것이고, 숫자는 양쪽에서 **읽어 온다.**
 * 상수를 실측해서 고치는 날 이 검사가 울면, 고칠 것은 **검사가 아니라 문서**다.
 * 그래서 울 때 **문서에 적을 값을 그대로 찍어 준다** — 안 찍어 주면 지워진다.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────
 * 그 표는 선생님이 **플레이하시며 손으로 맞대 보시는** 값이다. 낡으면 **맞는 앱을
 * 보고도 「모형이 틀렸다」고 적어 보내신다.** 없는 버그가 만들어진다.
 */
test('PLAYTEST 의 기체 표가 모형과 같다 — 낡으면 없는 버그를 만든다', async () => {
  const { readFileSync } = await import('node:fs');
  const doc = readFileSync(new URL('../PLAYTEST.md', import.meta.url), 'utf8');

  /*
   * **값을 다시 내는 길이 학생의 길과 같아야 한다.**
   *
   * 손으로 조건 한 벌을 지어 넣으면 안 된다. 실제로 지어 봤더니 `glucoseMl` 을 담고
   * `totalMl` 이 빠져 있었는데 — 학생의 길은 `totalMl` 을 담는다 — **값은 같았다.**
   * `normalizeConditions` 가 `totalMl` 을 기본값 35 로 채우고, 그게 마침 표준 배치의
   * 20 + 15 와 같았기 때문이다. **우연이다.** 표준 배치를 고치는 날 이 검사만 옛 35 를
   * 쓰고, 그러면 **멀쩡한 문서를 낡았다고** 한다.
   *
   * 그래서 발효관에서 조건을 뽑는 **그 함수**를 쓴다. 표가 밝혀 둔 배치 그대로다.
   */
  const tube = { glucosePct: 5, glucoseMl: 20, yeastMl: 15, waterMl: 0, plugged: true };
  const at = (tempC, min) => gasVolume(tubeConditions({ ...tube, tempC }), min);

  const rows = [...doc.matchAll(/^\s*>?\s*\|\s*(\d+)분\s*\|\s*([\d.]+)\s*mL\s*\|\s*([\d.]+)\s*mL\s*\|/gm)]
    .map((m) => ({ min: Number(m[1]), warm: Number(m[2]), hot: Number(m[3]) }));

  /*
   * **「몇 줄 이상 읽었다」는 앞 조건이 아니다. 「표에 있는 만큼 읽었다」가 앞 조건이다.**
   *
   * 0줄만 막으면 **한 줄만 모양이 바뀔 때** 남은 줄만 맞대 보고 초록불이 난다.
   * 그래서 표의 몸통이 몇 줄인지 따로 세어 견준다. 이 표는 인용구(`>`) 안에 있어서
   * 줄 세는 쪽도 `>` 를 감안해야 한다 — 처음 넣었을 때 `^\|` 라 0줄을 읽었다.
   */
  const lines = doc.split('\n');
  const head = lines.findIndex((l) => /지난 시간/.test(l) && l.includes('|'));
  assert.ok(head >= 0, 'PLAYTEST 에서 기체 표의 머리줄을 못 찾았습니다');
  let body = 0;
  for (let i = head + 1; i < lines.length; i += 1) {
    if (!/^\s*>?\s*\|/.test(lines[i])) break;
    if (/^\s*>?\s*\|[\s|:-]*\|\s*$/.test(lines[i])) continue;   // 구분선
    body += 1;
  }
  assert.equal(rows.length, body,
    `PLAYTEST 의 기체 표가 ${body}줄인데 ${rows.length}줄만 읽었습니다`
    + ' — 못 읽은 줄은 맞대 보지 못합니다');
  assert.ok(body >= 2, `기체 표의 몸통이 ${body}줄입니다 — 견줄 것이 없습니다`);

  const fresh = [];
  for (const r of rows) {
    const warm = at(30, r.min);
    const hot = at(55, r.min);
    fresh.push(`| ${r.min}분 | ${warm.toFixed(2)} mL | ${hot.toFixed(2)} mL |`);
    // 문서는 반올림해 적으므로 넉넉히 본다. 자릿수가 아니라 **어긋남**을 잡는 검사다.
    for (const [what, docVal, real] of [['30 ℃', r.warm, warm], ['55 ℃', r.hot, hot]]) {
      assert.ok(Math.abs(docVal - real) <= 0.1,
        `PLAYTEST 의 ${r.min}분 ${what} 값이 모형과 다릅니다 — 문서 ${docVal} · 모형 ${real.toFixed(2)}\n`
        + '  먼저 **왜 바뀌었는지** 보세요. 모형 상수를 일부러 고치신 것이면(교실에서 실측 등)\n'
        + '  고칠 것은 이 검사가 아니라 문서입니다 — 잰 값이 지금의 진실입니다.\n'
        + '  **일부러 고친 것이 아니면 그것이 버그입니다.** 그때 문서를 고치면\n'
        + '  버그를 정상으로 만들어 버립니다. 위의 온도 순서 검사들도 함께 보세요.\n'
        + '  문서를 고치실 때는 표를 이렇게 바꿔 넣으세요:\n'
        + `    ${fresh.join('\n    ')}`);
    }
  }
});
