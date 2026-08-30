/**
 * 회전 물리와 혈액의 층.
 *
 * 여기서 지키는 것은 두 가지다.
 *   1. **출처가 있는 값이 흔들리지 않는 것** — 층의 비율.
 *   2. **출처가 없는 값이 화면으로 새어 나가지 않는 것** — 회전 시간·회전수.
 *
 * 두 번째가 이 실험에서 더 무섭다. 설명하려고 넣은 임시 숫자가 다음 사람에게는
 * 사실로 읽힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  HEMATOCRIT, BUFFY_FRACTION, TUBE_LEN_MM, MAX_SPEED, BEAT_FLOOR, WORK_HALF,
  layerFractions, packedFraction, hematocrit,
  beatRate, timingError, pullGain, wobbleOf, stepSpin, applyPull,
  workGain, separationOf, clotCeiling, sharpnessOf, mixGain, leakGain,
} from '../src/sim/spin.js';

/* ------------------------------------------------------------------ */
/* 혈액 — 출처가 있는 값                                               */
/* ------------------------------------------------------------------ */

test('층의 비율이 흔들리지 않는다', () => {
  assert.equal(HEMATOCRIT.male, 0.45);
  assert.equal(HEMATOCRIT.female, 0.40);
  assert.ok(BUFFY_FRACTION < 0.01, '연층은 1 % 미만이다');
});

test('세 층을 합치면 기둥 전체가 된다', () => {
  for (const hct of [HEMATOCRIT.male, HEMATOCRIT.female, 0.2, 0.6]) {
    const { packed, buffy, plasma } = layerFractions(hct);
    assert.ok(Math.abs(packed + buffy + plasma - 1) < 1e-12, `합이 1 이 아니다: ${hct}`);
    assert.ok(packed > 0 && buffy > 0 && plasma > 0);
  }
});

test('연층은 혈장이 아니라 혈구 쪽에서 떼어 온다', () => {
  // 혈장은 언제나 1 - 헤마토크릿 이어야 한다. 연층을 혈장에서 떼면 혈장이 얇아진다.
  const { plasma } = layerFractions(HEMATOCRIT.male);
  assert.ok(Math.abs(plasma - 0.55) < 1e-12);
});

test('연층은 눈에 겨우 보일 만큼 얇다', () => {
  const { packed, buffy } = layerFractions(HEMATOCRIT.male);
  assert.ok(buffy < packed / 40, '연층을 적혈구층만큼 두껍게 그리면 틀린 그림이다');
});

/* ------------------------------------------------------------------ */
/* 덜 돌리면 헤마토크릿이 크게 나온다                                   */
/* ------------------------------------------------------------------ */

test('갈리기 전에는 기둥 전체가 붉고, 다 갈리면 헤마토크릿까지 줄어든다', () => {
  assert.equal(packedFraction(0), 1);
  assert.ok(Math.abs(packedFraction(1) - HEMATOCRIT.male) < 1e-12);
});

test('덜 돌리면 적혈구층을 실제보다 길게 잰다 — 과대평가', () => {
  const half = packedFraction(0.5);
  assert.ok(half > HEMATOCRIT.male, '절반만 갈린 기둥은 실제 헤마토크릿보다 붉은 부분이 길다');
  // 계속 돌릴수록 참값에 다가간다. 단조로워야 한다 — 중간에 늘면 그림이 거꾸로 간다.
  let prev = Infinity;
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    const v = packedFraction(s);
    assert.ok(v <= prev, `분리가 진행되는데 붉은 부분이 늘었다: sep=${s}`);
    prev = v;
  }
});

test('헤마토크릿은 두 길이를 나눈 값일 뿐이다', () => {
  assert.ok(Math.abs(hematocrit(45, 100) - 0.45) < 1e-12);
  assert.equal(hematocrit(45, 0), null, '분모가 없으면 숫자를 지어내지 않는다');
  assert.equal(hematocrit(45, -1), null);
});

test('모세관 길이를 바꿔도 학생이 구하는 값은 그대로다', () => {
  // TUBE_LEN_MM 은 [확인 필요] 인 값이라, 결과가 여기에 좌우되면 안 된다.
  const frac = packedFraction(1);
  for (const len of [TUBE_LEN_MM, 60, 100]) {
    assert.ok(Math.abs(hematocrit(frac * len, len) - HEMATOCRIT.male) < 1e-12,
      `모세관 길이 ${len} 에서 값이 달라졌다`);
  }
});

/* ------------------------------------------------------------------ */
/* 당기는 리듬                                                         */
/* ------------------------------------------------------------------ */

test('맞는 박은 「한 주기 뒤」이고, 당긴 직후는 아니다', () => {
  // **이게 없으면 마구 눌러 대는 것이 이긴다.** 당긴 직후에는 끈이 풀려 있어 당길 것이 없다.
  assert.equal(timingError(0), 0.5, '당긴 직후를 맞는 박으로 치면 리듬이 변인이 아니게 된다');
  assert.equal(timingError(0.2), 0.5);
  // **가장 가까운 맞는 박을 「한 주기 뒤부터」 찾는 것**이 그 일을 한다.
  // 0 에서부터 세면 당긴 직후가 딱 맞는 때가 되어 버리고, 마구 눌러 대는 것이 이긴다.
  assert.ok(timingError(0.45) > timingError(0.8),
    '주기 안에서는 늦게 당길수록 맞는 박에 가까워야 한다');
  assert.equal(timingError(1), 0, '한 주기 뒤가 딱 맞는 때다');
  assert.equal(timingError(2), 0, '한 박 쉬어도 리듬이다');
  assert.equal(timingError(1.5), 0.5, '주기 사이에 당기면 돌고 있는 회전판을 거스른다');
  assert.ok(Math.abs(timingError(0.9) - 0.1) < 1e-12, '0.9 는 한 주기에 0.1 만큼 이르다');
});

test('빨라질수록 박자가 잦아진다 — 손을 더 빨리 놀려야 한다', () => {
  assert.ok(beatRate(1) > beatRate(0.5));
  assert.ok(beatRate(0.5) > beatRate(0));
});

test('박자가 맞으면 빨라지고, 반대 박에 당기면 느려진다', () => {
  const onBeat = applyPull({ speed: 0.6, phase: 1 }, { strength: 1 });
  assert.ok(onBeat.speed > 0.6, '박자가 맞았는데 안 빨라졌다');

  const offBeat = applyPull({ speed: 0.6, phase: 1.5 }, { strength: 1 });
  assert.ok(offBeat.speed < 0.6, '반대 박에 당겼는데 느려지지 않았다 — 이러면 리듬이 변인이 아니다');
  assert.ok(offBeat.gain < 0, '반대 박의 몫은 음수여야 한다');
});

test('당긴 직후에 또 당기면 오히려 느려진다 — 마구 눌러 대는 것이 이기지 않는다', () => {
  const mashed = applyPull({ speed: 0.6, phase: 0.05 }, { strength: 1 });
  assert.ok(mashed.gain < 0, '끈이 다시 꼬이기 전에 당겼는데 힘이 보태집니다');
  assert.ok(mashed.speed < 0.6);
});

test('반쯤 어긋나면 보태지도 깎이지도 않는다', () => {
  // 한 주기의 4분의 1 만큼 이른 자리. 여기가 이득도 손해도 없는 경계다.
  const g = pullGain(1, 0.75, 1);
  assert.ok(Math.abs(g) < 1e-12, `경계에서 ${g} 가 나왔다`);
});

test('멎어 있는 회전판에는 박자를 따지지 않는다', () => {
  // 물리적으로도 그렇고, 처음 당기는 학생을 벌주지 않기 위해서도 그렇다.
  const first = applyPull({ speed: 0, phase: 0 }, { strength: 1 });
  assert.ok(first.speed > 0, '처음 당김이 반대 박이라고 아무 일도 안 일어나면 시작을 못 한다');
  assert.ok(pullGain(1, 1.5, BEAT_FLOOR) < 0, '돌기 시작하면 반대 박이 걸린다');
});

test('세게 당길수록 많이 보탠다', () => {
  const weak = applyPull({ speed: 0.5, phase: 1 }, { strength: 0.3 });
  const hard = applyPull({ speed: 0.5, phase: 1 }, { strength: 1 });
  assert.ok(hard.speed > weak.speed);
});

test('속도는 상한을 넘지 않고 음수가 되지 않는다', () => {
  let r = { speed: MAX_SPEED, phase: 1 };
  for (let i = 0; i < 40; i++) r = applyPull({ ...r, phase: 1 }, { strength: 1 });
  assert.equal(r.speed, MAX_SPEED);

  const braked = applyPull({ speed: 0.02, phase: 1.5 }, { strength: 1 });
  assert.ok(braked.speed >= 0);
});

test('당기면 꼬임이 처음으로 돌아간다 — 다음 박은 한 주기 뒤다', () => {
  assert.equal(applyPull({ speed: 0.5, phase: 1.37 }, { strength: 1 }).phase, 0);
});

test('가만 두면 멎는다', () => {
  let r = { speed: 0.9, phase: 0 };
  for (let i = 0; i < 200; i++) r = stepSpin(r, { dt: 0.1 });
  assert.ok(r.speed < 0.05, '아무것도 안 했는데 계속 돈다');
});

/* ------------------------------------------------------------------ */
/* 균형과 흔들림                                                       */
/* ------------------------------------------------------------------ */

test('균형이 맞으면 흔들리지 않고, 안 맞으면 빠를수록 흔들린다', () => {
  assert.equal(wobbleOf(0, 1), 0);
  assert.equal(wobbleOf(1, 0), 0, '멎어 있으면 균형이 안 맞아도 흔들리지 않는다');
  assert.ok(wobbleOf(1, 1) > wobbleOf(1, 0.3));
});

test('흔들리는 회전판은 같은 힘으로 덜 빨라진다', () => {
  const start = { speed: 0.8, phase: 0 };
  const steady = stepSpin(start, { dt: 1, imbalance: 0 });
  const shaky = stepSpin(start, { dt: 1, imbalance: 1 });
  assert.ok(shaky.speed < steady.speed, '균형을 맞춰도 이득이 없으면 맞출 이유가 없다');
});

test('흔들리면 갈린 것이 다시 섞인다 — 다만 분리 진행도를 되돌리지는 않는다', () => {
  assert.ok(mixGain(1, 1, 1) > 0);
  assert.equal(mixGain(0, 1, 1), 0);
  // 흐려지는 것과 안 갈린 것은 다른 일이다. 화면이 갈라 말할 수 있어야 한다.
  assert.ok(sharpnessOf(1, 0.6) < sharpnessOf(1, 0));
  assert.ok(sharpnessOf(0.3, 0) < sharpnessOf(1, 0));
});

/* ------------------------------------------------------------------ */
/* 침강                                                                */
/* ------------------------------------------------------------------ */

test('원심 가속도는 속도의 제곱에 비례한다', () => {
  // 두 배 빠르면 네 배 일한다. "세게" 가 "오래" 보다 나은 이유다.
  assert.ok(Math.abs(workGain(1, 1) / workGain(0.5, 1) - 4) < 1e-9);
  assert.equal(workGain(0, 10), 0, '멎어 있으면 갈리지 않는다');
});

test('분리는 0 에서 시작해 1 로 다가가되 넘지 않는다', () => {
  assert.equal(separationOf(0), 0);
  assert.ok(Math.abs(separationOf(WORK_HALF) - 0.5) < 1e-12);
  // 아주 오래 돌려도 1 을 넘지 않는다. 넘으면 붉은 부분이 헤마토크릿보다 짧아진다.
  assert.ok(separationOf(WORK_HALF * 20) <= 1);
  assert.ok(separationOf(WORK_HALF * 10) > 0.999);
});

test('응고하면 층이 거의 안 생긴다', () => {
  assert.equal(clotCeiling(0), 1);
  assert.ok(clotCeiling(1) < 0.2);
  assert.ok(clotCeiling(0.5) < clotCeiling(0.2));
});

test('밀봉이 좋으면 새지 않고, 새는 것은 속도의 제곱에 비례한다', () => {
  assert.equal(leakGain(1, 1, 1), 0);
  assert.ok(leakGain(0, 1, 1) > 0);
  assert.ok(Math.abs(leakGain(0, 1, 1) / leakGain(0, 0.5, 1) - 4) < 1e-9);
  assert.equal(leakGain(0, 0, 1), 0, '멎어 있으면 새지 않는다');
});

/* ------------------------------------------------------------------ */
/* 없는 수치가 화면으로 새어 나가지 않는가                              */
/* ------------------------------------------------------------------ */

test('화면 문자열이 회전 시간이나 회전수를 말하지 않는다', () => {
  // **회전 시간과 당김 횟수는 [확인 필요] 다** (AGENTS.md §2.4).
  // 설명하려고 넣은 임시 숫자가 다음 사람에게는 사실로 읽힌다.
  const files = readdirSync(new URL('../src/ui/', import.meta.url))
    .filter((f) => f.endsWith('.js'));
  const bad = [];
  for (const f of files) {
    const src = readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8');
    // 주석은 뺀다 — 「1.5분은 연구 장비 기준이라 쓸 수 없다」 는 맞는 설명이다.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const [, hit] of code.matchAll(/'[^']*?(\d[\d.]*\s*(?:초|분|rpm|RPM|회전))[^']*'/g)) {
      bad.push(`${f}: ${hit}`);
    }
    for (const [, hit] of code.matchAll(/'[^']*?(\d+\s*번(?:씩)?\s*(?:당기|돌리))[^']*'/g)) {
      bad.push(`${f}: ${hit}`);
    }
  }
  assert.deepEqual(bad, [],
    `출처가 없는 수치가 화면 문자열에 있습니다:\n  ${bad.join('\n  ')}\n`
    + '  → 회전 시간·회전수·당김 횟수는 [확인 필요] 입니다. 화면에 시계를 띄우지 않습니다.');
});

test('sim 은 DOM 도 시계도 난수도 모른다', () => {
  const src = readFileSync(new URL('../src/sim/spin.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const banned of ['document', 'window', 'Date.now', 'Math.random']) {
    assert.equal(code.includes(banned), false, `spin.js 가 ${banned} 를 씁니다`);
  }
});
