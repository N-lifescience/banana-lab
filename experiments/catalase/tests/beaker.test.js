/**
 * 결과 렌더러 테스트.
 *
 * 그림이 **예쁜가**는 여기서 못 본다 — 사람이 봐야 한다. 여기서 보는 것은
 * 그림이 **상태를 정직하게 말하는가**다. 100 ℃ 에서 원반이 떠오르면 시뮬레이터가
 * 거짓말을 하는 것이고, 그건 기계가 잡을 수 있다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBeaker, observationState, discY, bubbleCount, VIEW } from '../src/render/beaker.js';
import { riseTime, OBSERVE_LIMIT_S } from '../src/sim/kinetics.js';

const NORMAL = { tempC: 20, ph: 7, h2o2Pct: 3, extractPct: 100, extractBoiled: false, buffered: true };
const draw = (c, elapsedS = 0, hasDisc = true, seed = 42) =>
  renderBeaker({ conditions: c, elapsedS, hasDisc, seed });
const progressOf = (svg) => Number(svg.match(/data-progress="([\d.]+)"/)[1]);
const bubbles = (svg) => (svg.match(/<circle /g) ?? []).length;

/* ---------------- 순수 함수인가 ---------------- */

test('같은 입력이면 언제나 같은 그림이 나온다', () => {
  assert.equal(draw(NORMAL, 7), draw({ ...NORMAL }, 7));
});

test('시드가 다르면 기포 자리가 달라진다 — 개수는 같다', () => {
  const a = renderBeaker({ conditions: NORMAL, elapsedS: 12, hasDisc: true, seed: 1 });
  const b = renderBeaker({ conditions: NORMAL, elapsedS: 12, hasDisc: true, seed: 2 });
  assert.notEqual(a, b, '시드가 반영되지 않으면 모둠마다 같은 그림이 나옵니다');
  assert.equal(bubbles(a), bubbles(b), '기포 개수는 시드가 아니라 진행도가 정합니다');
});

test('난수를 쓰지 않는다 — 소스에 Math.random 이 없다', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/render/beaker.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('Math.random'),
    '난수를 쓰면 결과를 값 한 벌로 저장해 두었다가 되살릴 수 없습니다');
});

/* ---------------- 여러 개를 한 화면에 ---------------- */

test('idPrefix 가 다르면 id 가 하나도 겹치지 않는다', () => {
  const idsOf = (svg) => (svg.match(/id="([^"]+)"/g) ?? []);
  const a = renderBeaker({ conditions: NORMAL, hasDisc: true }, { idPrefix: 'left' });
  const b = renderBeaker({ conditions: NORMAL, hasDisc: true }, { idPrefix: 'right' });
  const shared = idsOf(a).filter((x) => idsOf(b).includes(x));
  assert.deepEqual(shared, [],
    'id 가 겹칩니다 — 한 화면에 두 개를 그리면 에러 없이 조용히 틀립니다');
});

/* ---------------- 그림이 상태를 정직하게 말하는가 ---------------- */

test('진행도는 kinetics 가 낸 값을 그대로 쓴다', () => {
  const t = riseTime(NORMAL).seconds;
  assert.ok(Math.abs(progressOf(draw(NORMAL, t / 2)) - 0.5) < 0.01);
  assert.equal(progressOf(draw(NORMAL, t)), 1);
});

/**
 * 안 뜨는 조건에서는 관찰 시간이 다 지나도 원반이 액면에 닿지 않는다.
 *
 * **바닥에 딱 붙어 있으라고 하지 않는다.** 100 ℃ 에서는 효소가 죽어도 과산화수소수 자체가
 * 열로 서서히 분해되므로 기포가 조금씩 생긴다 — 실제로 그렇다. 원반이 조금 떠오르다 마는
 * 것이 정직한 그림이고, 「5분 안에 안 떴다」가 이 시행의 측정값이다.
 *
 * 처음에는 「바닥에 그대로 있어야 한다」로 적었다가 이 검사가 빨간불이 됐다.
 * 코드가 아니라 **검사가 틀렸다** — 모형이 실제 화학을 따라간 것이었다.
 */
test('안 뜨는 조건에서는 관찰 시간이 다 지나도 액면에 닿지 못한다', () => {
  for (const [label, c] of [
    ['끓는 물', { ...NORMAL, tempC: 100 }],
    ['강한 산', { ...NORMAL, ph: 3 }],
    ['끓인 감자즙', { ...NORMAL, extractBoiled: true }],
    ['빈 비커', { ...NORMAL, h2o2Pct: 0 }],
  ]) {
    const svg = draw(c, OBSERVE_LIMIT_S);
    assert.ok(progressOf(svg) < 1, `${label}: 관찰 시간이 다 지났는데 원반이 떠올랐습니다`);
    assert.equal(observationState(c, OBSERVE_LIMIT_S, true), 'not-floated',
      `${label}: 「뜨지 않음」으로 판정되지 않았습니다`);
  }
});

test('끓는 물에서는 같은 시간에 원반이 37 ℃ 보다 훨씬 아래에 있다', () => {
  // 위 검사가 「액면에 안 닿는다」만 보므로, 순서까지 여기서 못 박는다.
  const at = (c, t) => progressOf(draw(c, t));
  assert.ok(at({ ...NORMAL, tempC: 100 }, 8) < at({ ...NORMAL, tempC: 37 }, 8) / 10,
    '끓는 물의 원반이 37 ℃ 와 비슷하게 올라갑니다');
});

test('원반을 안 넣었을 때와 바닥에 있을 때의 자리가 같다', () => {
  assert.ok(draw({ ...NORMAL, h2o2Pct: 0 }, 0).includes(`cy="${discY(0).toFixed(1)}"`));
});

test('원반은 진행도만큼 올라간다 — 위로 갈수록 y 가 작아진다', () => {
  assert.ok(discY(1) < discY(0.5) && discY(0.5) < discY(0));
  assert.ok(discY(1) > VIEW.surfaceY, '원반이 액면 위로 튀어나갑니다');
  assert.ok(discY(0) < VIEW.floorY, '원반이 바닥을 뚫고 나갑니다');
});

test('기포는 진행도만큼 늘고, 떠오르는 순간 가장 많다', () => {
  assert.equal(bubbleCount(0), 0, '아무 일도 안 일어났는데 기포가 붙어 있습니다');
  assert.ok(bubbleCount(0.5) > 0 && bubbleCount(1) > bubbleCount(0.5),
    '기포가 안 늘면 학생은 왜 떠올랐는지 그림에서 읽을 수 없습니다');
});

test('빈 비커에는 액체가 그려지지 않는다', () => {
  // 「아직 안 부었다」와 「부었다」가 눈으로 갈려야 한다. 실제로 이 둘이 같아 보여
  // 과산화수소수 색을 유리색에서 더 벌렸다.
  assert.ok(/id="[^"]*liquid" opacity="0"/.test(draw({ ...NORMAL, h2o2Pct: 0 })));
  assert.ok(/id="[^"]*liquid" opacity="1"/.test(draw(NORMAL)));
});

test('원반을 안 넣었으면 원반이 안 보인다', () => {
  assert.ok(/id="[^"]*disc" opacity="0"/.test(draw(NORMAL, 0, false)));
});

/**
 * **이 파일에서 가장 중요한 검사다.**
 *
 * 완충하지 않은 pH 11 에서는 **원반을 넣기도 전에 거품이 인다.** 효소가 없는데
 * 거품이 이는 것을 학생이 눈으로 먼저 만나야 「왜 pH 11 이 더 빨랐지?」를 스스로 묻는다.
 * 이걸 안 그리면 결과 숫자만 이상해 보이고 까닭은 화면 어디에도 없다.
 */
test('완충 안 한 강한 염기에서는 원반을 넣기 전부터 거품이 보인다', () => {
  const raw = draw({ ...NORMAL, ph: 11, buffered: false }, 0, false);
  const neutral = draw(NORMAL, 0, false);
  assert.ok(bubbles(raw) > 5, '거품이 그려지지 않았습니다');
  assert.equal(bubbles(neutral), 0, 'pH 7 에서 거품이 일면 안 됩니다');
});

test('과산화수소수가 없으면 거품도 없다', () => {
  assert.equal(bubbles(draw({ ...NORMAL, h2o2Pct: 0, ph: 11, buffered: false }, 0, false)), 0);
});

/* ---------------- 「기다리는 중」과 「안 뜸」을 가른다 ---------------- */

test('관찰 상태 넷을 가려 낸다', () => {
  assert.equal(observationState(NORMAL, 0, false), 'idle');
  assert.equal(observationState(NORMAL, 1, true), 'running');
  assert.equal(observationState(NORMAL, riseTime(NORMAL).seconds, true), 'floated');
  assert.equal(observationState({ ...NORMAL, tempC: 100 }, OBSERVE_LIMIT_S, true), 'not-floated');
});

test('아직 기다리는 중인 것을 「안 뜸」이라고 하지 않는다', () => {
  // 느린 조건(0 ℃)은 오래 걸릴 뿐 뜬다. 관찰 시간을 넘기기 전에는 「안 뜸」이 아니다.
  const cold = { ...NORMAL, tempC: 0 };
  assert.equal(observationState(cold, 10, true), 'running');
});
