/**
 * 반응 속도 모형 — **순서를 고정한다.**
 *
 * 여기서 초 단위 숫자를 박지 않는 이유: 시간 눈금은 `T_REF_S` 하나로 정해지고 그 값은
 * **[확인 필요]** 다 (교실에서 한 번 재면 바뀐다). 숫자를 박아 두면 실측한 날
 * 이 파일이 통째로 빨간불이 되고, 사람은 값을 고치는 대신 테스트를 지운다.
 *
 * **바뀌면 안 되는 것은 순서다.** 37 ℃ 가 20 ℃ 보다 빠르다 · 100 ℃ 는 안 뜬다 ·
 * 완충하지 않은 pH 11 이 pH 7 보다 빠르다. 이 셋은 실제 실험에서 오는 것이고,
 * 하나라도 어긋나면 시뮬레이터가 틀린 것이다 (AGENTS.md §2.5).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  riseTime, oxygenRate, preFizz, riseProgress,
  enzymeTempFactor, activeFraction, rateByTemp, enzymePhFactor, baseCatalysisFactor,
  OBSERVE_LIMIT_S, H2O2_PKA, PH_OPTIMUM,
} from '../src/sim/kinetics.js';

/** 기준 조건에 몇 가지만 바꿔서 시간을 낸다. 안 뜬 조건은 Infinity 로 재서 비교만 한다. */
const secs = (c) => riseTime(c).seconds ?? Infinity;

/* ---------------- 온도 ---------------- */

test('온도가 오르면 반응 자체는 빨라진다 — 변성은 여기 없다', () => {
  assert.ok(rateByTemp(30) > rateByTemp(20));
  assert.ok(rateByTemp(100) > rateByTemp(60));
  // 0 ℃ 가 느린 것은 변성이 아니라 분자 운동이 느려서다. 효소는 멀쩡히 살아 있다.
  assert.ok(activeFraction(0) > 0.99, '0 ℃ 에서 효소가 죽어 있으면 안 됩니다 — 되돌아와야 합니다');
});

test('변성은 40~50 ℃ 에서 시작해 100 ℃ 에서는 거의 남지 않는다', () => {
  assert.ok(activeFraction(37) > 0.9, '37 ℃ 에서 효소가 벌써 죽고 있습니다');
  assert.ok(activeFraction(40) > 0.7 && activeFraction(50) < 0.3,
    '변성 구간이 40~50 ℃ 를 지나가지 않습니다');
  assert.ok(activeFraction(100) < 0.001, '100 ℃ 에서 효소가 남아 있습니다');
});

test('효소 활성의 최고점이 35~40 ℃ 사이에 온다', () => {
  let best = 0, bestT = null;
  for (let t = 0; t <= 100; t += 0.5) {
    const v = enzymeTempFactor(t);
    if (v > best) { best = v; bestT = t; }
  }
  assert.ok(bestT >= 35 && bestT <= 41, `최적 온도가 ${bestT} ℃ 입니다 — 35~40 ℃ 여야 합니다`);
});

test('온도 계열의 순서가 실제 실험과 같다', () => {
  const at = (tempC) => secs({ tempC, ph: PH_OPTIMUM });
  assert.ok(at(37) < at(20), '37 ℃ 가 20 ℃ 보다 빨라야 합니다');
  assert.ok(at(20) < at(0), '20 ℃ 가 0 ℃ 보다 빨라야 합니다');
  assert.ok(at(60) > at(20), '60 ℃ 는 변성이 시작돼 20 ℃ 보다 느려야 합니다');
  assert.equal(riseTime({ tempC: 100, ph: PH_OPTIMUM }).floated, false,
    '끓는 물에서 원반이 떠오르면 안 됩니다');
});

test('0 ℃ 는 느릴 뿐 뜨기는 뜬다 — 100 ℃ 와 다른 일이다', () => {
  const cold = riseTime({ tempC: 0, ph: PH_OPTIMUM });
  assert.equal(cold.floated, true, '0 ℃ 에서 아예 안 뜨면 변성과 구분되지 않습니다');
});

/* ---------------- pH ---------------- */

test('효소 활성의 최적 pH 는 7 이고 양쪽으로 떨어진다', () => {
  assert.equal(enzymePhFactor(PH_OPTIMUM), 1);
  assert.ok(enzymePhFactor(5) < 1 && enzymePhFactor(9) < 1);
  assert.ok(enzymePhFactor(3) < enzymePhFactor(5));
  assert.ok(enzymePhFactor(11) < enzymePhFactor(9));
});

test('염기 촉매 분해는 pKa 에서 가장 빠르다 — 맞춘 값이 아니라 유도된 값이다', () => {
  let best = 0, bestPh = null;
  for (let p = 0; p <= 14; p += 0.05) {
    const v = baseCatalysisFactor(p);
    if (v > best) { best = v; bestPh = p; }
  }
  assert.ok(Math.abs(bestPh - H2O2_PKA) < 0.1,
    `염기 분해 최고점이 pH ${bestPh} 입니다 — pKa(${H2O2_PKA}) 에 와야 합니다`);
  assert.ok(baseCatalysisFactor(7) < baseCatalysisFactor(11) / 100,
    'pH 7 에서도 염기 분해가 일어나고 있습니다');
});

test('완충 용액을 쓰면 pH 7 이 가장 빠르다 — 교과서 모양', () => {
  const at = (ph) => secs({ ph, buffered: true });
  assert.ok(at(7) < at(5) && at(7) < at(9), 'pH 7 이 가장 빨라야 합니다');
  assert.ok(at(7) < at(11), '완충했는데도 pH 11 이 더 빠릅니다');
});

test('완충하지 않으면 pH 11 이 pH 7 보다 빨리 뜬다 — 실제 교실의 역전', () => {
  // 이 검사가 이 파일에서 가장 중요하다. 염기 갈래를 지우면 여기서 잡힌다.
  // AGENTS.md §2.5 — 「높은 pH 를 무조건 효소가 변성돼 반응 없음으로 두면 어긋난다」
  const raw = (ph) => secs({ ph, buffered: false });
  assert.ok(raw(11) < raw(7),
    `완충하지 않은 pH 11(${raw(11).toFixed(1)}초)이 pH 7(${raw(7).toFixed(1)}초)보다 느립니다`);
});

test('완충하면 그 역전이 줄어든다 — 없어지지는 않는다', () => {
  const raw = secs({ ph: 11, buffered: false });
  const buf = secs({ ph: 11, buffered: true });
  assert.ok(buf > raw, '완충 용액을 써도 pH 11 이 더 빨라지지 않았습니다');
  // 완충해도 pH 11 은 pH 9 보다 빠르다. 염기 분해가 남아 있기 때문이다.
  assert.ok(buf < secs({ ph: 9, buffered: true }),
    '완충하면 염기 분해가 아예 사라져 버렸습니다 — 줄어드는 것이지 없어지는 것이 아닙니다');
});

test('완충하지 않은 강한 염기에서는 원반을 넣기 전부터 거품이 인다', () => {
  assert.ok(preFizz({ ph: 11, buffered: false }) > 0.5,
    'pH 11 에서 원반을 넣기 전 거품이 보이지 않습니다');
  assert.ok(preFizz({ ph: 7, buffered: true }) < 0.01, 'pH 7 에서 거품이 일면 안 됩니다');
});

/* ---------------- 효소가 없을 때 ---------------- */

test('끓인 감자즙 원반은 중성에서 뜨지 않는다 — 식혀도 마찬가지다', () => {
  assert.equal(riseTime({ extractBoiled: true, tempC: 20, ph: 7 }).floated, false);
  assert.equal(riseTime({ extractBoiled: true, tempC: 0, ph: 7 }).floated, false);
});

test('감자즙을 안 묻힌 원반도 강한 염기에서는 뜬다 — 이 실험의 대조군', () => {
  // 효소가 하나도 없는데 뜬다. 「그러면 지금까지 뜬 것은 전부 효소 때문이었나?」를
  // 학생이 스스로 묻게 되는 자리다. 이 갈래가 없으면 그 질문이 아예 생기지 않는다.
  const bare = { extractPct: 0, ph: 11, buffered: false };
  assert.equal(riseTime(bare).floated, true);
  assert.equal(oxygenRate(bare).enzyme, 0, '감자즙이 없는데 효소 갈래가 0 이 아닙니다');
  assert.ok(oxygenRate(bare).base > 0);
});

test('감자즙을 안 묻힌 원반은 중성에서는 뜨지 않는다', () => {
  assert.equal(riseTime({ extractPct: 0, ph: 7 }).floated, false);
});

/* ---------------- 통제변인 ---------------- */

test('과산화수소수가 묽으면 느려진다', () => {
  assert.ok(secs({ h2o2Pct: 3 }) < secs({ h2o2Pct: 2 }));
  assert.ok(secs({ h2o2Pct: 2 }) < secs({ h2o2Pct: 1 }));
});

test('감자즙이 묽으면 느려진다', () => {
  assert.ok(secs({ extractPct: 100 }) < secs({ extractPct: 50 }));
  assert.ok(secs({ extractPct: 50 }) < secs({ extractPct: 25 }));
});

test('과산화수소수를 아예 안 부으면 아무 일도 안 일어난다', () => {
  const r = riseTime({ h2o2Pct: 0 });
  assert.equal(r.floated, false);
  assert.equal(r.rate.total, 0);
});

/* ---------------- 안 뜨는 조건을 어떻게 돌려주나 ---------------- */

test('안 뜬 조건에는 시간이 없다 — 큰 수가 아니라 null 이다', () => {
  const r = riseTime({ tempC: 100 });
  assert.equal(r.floated, false);
  assert.equal(r.seconds, null, '안 뜬 조건에 숫자를 주면 그래프가 없는 값을 그립니다');
});

test('관찰 시간을 넘기면 안 뜬 것으로 본다', () => {
  const slow = riseTime({ tempC: 20, ph: 3 });
  assert.equal(slow.floated, false);
  assert.equal(slow.limitS, OBSERVE_LIMIT_S);
});

/* ---------------- 진행도 ---------------- */

test('진행도는 시간에 비례해 늘고 1 에서 떠오른다', () => {
  const c = { tempC: 20, ph: 7 };
  const t = riseTime(c).seconds;
  assert.ok(riseProgress(c, 0) === 0);
  assert.ok(Math.abs(riseProgress(c, t / 2) - 0.5) < 1e-9);
  assert.ok(riseProgress(c, t) >= 1);
  assert.equal(riseProgress(c, t * 10), 1, '진행도가 1 을 넘어갑니다');
});

test('발생 속도가 0 이면 아무리 기다려도 진행도가 0 이다', () => {
  assert.equal(riseProgress({ h2o2Pct: 0 }, 10000), 0);
});

/* ---------------- 순수 함수 ---------------- */

test('같은 조건은 언제나 같은 값을 낸다', () => {
  const c = { tempC: 37, ph: 9, h2o2Pct: 2, extractPct: 50, buffered: false };
  assert.deepEqual(oxygenRate(c), oxygenRate({ ...c }));
  assert.deepEqual(riseTime(c).seconds, riseTime({ ...c }).seconds);
});

test('kinetics 는 조건 객체를 고치지 않는다', () => {
  const c = { tempC: 37 };
  riseTime(c); oxygenRate(c); preFizz(c);
  assert.deepEqual(c, { tempC: 37 });
});

/* ---------------- 끓는 물 — pH 를 어디에 두든 ---------------- */

/**
 * **어떤 pH 로 통제해도 100 ℃ 에서는 원반이 뜨지 않는다.**
 *
 * 이 검사가 `{ tempC: 100, ph: 7 }` 하나만 보고 있었다. 그래서 pH 를 9 로 **통제해 두고**
 * 온도를 바꾼 학생에게는 **100 ℃ 가 가장 빠른 조건**이 됐다 — 「끓는 물이 제일 빠르다」가
 * 그 학생이 얻는 결론이었다. 실험대에 pH 9 완충 병과 100 ℃ 수조가 나란히 있으므로
 * 설계상 완전히 정상적인 선택이었다.
 *
 * 염기 촉매 분해에는 변성이 없어서 온도를 올릴수록 끝없이 빨라진 것이 원인이었다.
 * 이제 **끓는 물에서는 기포가 원반에 붙어 있지 못한다**로 두 갈래 모두를 누른다.
 */
test('어떤 pH 로 통제해도 끓는 물에서는 원반이 뜨지 않는다', async () => {
  const { CHOICES } = await import('../src/sim/state.js');
  for (const ph of CHOICES.ph) {
    for (const buffered of [true, false]) {
      const r = riseTime({ tempC: 100, ph, buffered });
      assert.equal(r.floated, false,
        `100 ℃ · pH ${ph} · ${buffered ? '완충' : '산·염기'} 에서 ${r.seconds?.toFixed(1)}초 만에 떠올랐습니다`);
    }
  }
});

test('60 ℃ 까지는 기포가 그대로 붙어 있는다 — 끓는 물만 다르다', async () => {
  const { bubbleRetention } = await import('../src/sim/kinetics.js');
  // 60 ℃ 조건(230초)이 이 수정으로 달라지면 온도 계열의 뜻이 통째로 바뀐다.
  for (const t of [0, 20, 37, 60]) assert.equal(bubbleRetention(t), 1, `${t} ℃ 가 눌렸습니다`);
  assert.equal(bubbleRetention(100), 0);
});

test('온도를 더 밀어도 다시 빨라지지 않는다', () => {
  // 염기 갈래에 천장이 없던 시절에는 150 ℃ 가 36초, 200 ℃ 가 1.1초였다.
  for (const tempC of [110, 150, 200]) {
    assert.equal(riseTime({ tempC, ph: 11, buffered: false }).floated, false,
      `${tempC} ℃ 에서 떠올랐습니다`);
  }
});
