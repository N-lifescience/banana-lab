/**
 * 결과 렌더러 테스트 — 발효관과 맹관부의 기체.
 *
 * **이 실험은 그림이 몸통이다.** 그러므로 여기서 볼 것은 「예쁜가」가 아니라
 * **눈으로 갈리는가**다 — 효모를 넣은 관과 안 넣은 관, 기체가 모인 관과 안 모인 관,
 * 수산화 칼륨을 넣기 전과 뒤.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderTube, tubeAssetState, tubeFromTrial, renderTrialTubes,
  liquidKind, gasNow, observationState, tubeContents,
} from '../src/render/tube.js';
import { initialTube, tubeConditions } from '../src/sim/state.js';
import {
  OBSERVE_LIMIT_MIN, KOH_POUR_ML, GLUCOSE_POUR_ML, YEAST_POUR_ML, CLOSED_ARM_CAPACITY_ML,
} from '../src/sim/fermentation.js';

/** 관찰이 끝난 발효관 하나. 하나씩 갈아 끼워 견준다. */
function tube(over = {}) {
  const t = {
    ...initialTube(),
    glucosePct: 10,
    glucoseMl: GLUCOSE_POUR_ML,
    yeastMl: YEAST_POUR_ML,
    plugged: true,
    tempC: 30,
    inIncubator: true,
    elapsedMin: OBSERVE_LIMIT_MIN,
    ...over,
  };
  return { ...t, runConditions: t.runConditions ?? tubeConditions(t) };
}

/** `#gas` 의 높이. 그림에서 결과가 실제로 달라지는지 보는 유일한 자리다. */
function gasHeight(svg) {
  const m = svg.match(/id="[^"]*gas"[^>]*height="([\d.]+)"/);
  return m ? Number(m[1]) : null;
}

/* ---------------- 무엇이 담겼는가가 눈으로 갈리는가 ---------------- */

/**
 * **효모액이 든 관은 뿌옇고, 안 든 관은 맑다.** 그것이 실제로 눈에 보이는 차이다.
 * 대조군(포도당 + 증류수)은 효모가 없으므로 맑은 포도당 수용액으로 보인다 —
 * 색을 따로 지어내지 않는다.
 */
test('효모액이 들었는지가 팽대부의 색으로 갈린다', () => {
  assert.equal(liquidKind(tube()), 'BREW', '효모액이 든 관이 맑게 보입니다');
  assert.equal(liquidKind(tube({ yeastMl: 0, waterMl: YEAST_POUR_ML })), 'GLUCOSE',
    '대조군이 효모가 든 것처럼 뿌옇게 보입니다');
  assert.equal(liquidKind(tube({ yeastMl: 0, waterMl: 0, glucosePct: 0 })), 'WATER');
  assert.equal(liquidKind(initialTube()), null, '빈 관에 액체가 그려집니다');
});

test('효모액을 넣은 관과 증류수 대조군이 그림에서 갈린다', () => {
  const a = renderTube(tube(), { idPrefix: 'a' });
  const b = renderTube(tube({ yeastMl: 0, waterMl: YEAST_POUR_ML }), { idPrefix: 'a' });
  assert.notEqual(a, b, '대조군과 실험군이 같은 그림입니다');
  assert.ok(gasHeight(a) > gasHeight(b), '대조군에 기체가 더 많거나 같습니다');
});

test('수산화 칼륨을 넣으면 맹관부의 기체가 줄어든 그림이 된다', () => {
  const before = renderTube(tube({ drained: true }), { idPrefix: 'a' });
  const after = renderTube(tube({ drained: true, kohMl: KOH_POUR_ML }), { idPrefix: 'a' });
  assert.ok(gasHeight(after) < gasHeight(before) * 0.3,
    `기체가 줄어들지 않았습니다: ${gasHeight(before)} → ${gasHeight(after)}`);
});

test('맹관부가 다 차면 더 자라지 않는다', () => {
  const s = tubeAssetState(tube({ elapsedMin: 100000 }));
  assert.ok(s.fill <= 1);
});

test('기체는 계산 파일에서만 온다 — 렌더러가 다시 계산하지 않는다', () => {
  const t = tube();
  assert.equal(gasNow(t) <= CLOSED_ARM_CAPACITY_ML, true);
  // 흡수된 뒤의 양을 그림이 쓴다. 두 곳에서 따로 계산하면 그림과 기록이 다른 말을 한다.
  assert.ok(gasNow({ ...t, drained: true, kohMl: KOH_POUR_ML }) < gasNow(t));
});

/* ---------------- 기포는 지금 일어나고 있을 때만 ---------------- */

test('관찰이 끝난 관에는 기포를 그리지 않는다', () => {
  assert.equal(tubeAssetState(tube({ elapsedMin: OBSERVE_LIMIT_MIN })).bubbling, false,
    '다 끝난 관에 기포가 올라옵니다 — 아직 진행 중인 줄 압니다');
  assert.equal(tubeAssetState(tube({ elapsedMin: 5 })).bubbling, true);
});

test('발효가 안 일어나는 조건에서는 기포도 없다', () => {
  assert.equal(tubeAssetState(tube({ elapsedMin: 5, yeastMl: 0, waterMl: 15 })).bubbling, false);
  assert.equal(tubeAssetState(tube({ elapsedMin: 5, glucosePct: 0 })).bubbling, false);
});

/* ---------------- 한 화면에 여러 개 ---------------- */

/**
 * **`url(#...)` 까지 함께 바뀌어야 한다.**
 *
 * 발효관 애셋은 관 안쪽만 남기려고 `clipPath` 를 쓴다. id 만 바꾸고 가리키는 쪽을 그대로
 * 두면 잘라 내기가 통째로 풀려 액체가 유리 밖으로 삐져나오는데, **콘솔에는 아무 말도 안 나온다.**
 * 처음 짤 때 실제로 그렇게 두었다.
 */
test('idPrefix 가 다르면 id 도 url(#) 참조도 하나도 겹치지 않는다', () => {
  const a = renderTube(tube(), { idPrefix: 'a' });
  const b = renderTube(tube(), { idPrefix: 'b' });
  const idsOf = (svg) => [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const refsOf = (svg) => [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(idsOf(a).length > 0);
  assert.deepEqual(idsOf(a).filter((x) => idsOf(b).includes(x)), []);
  // 가리키는 쪽이 있으면 그것도 앞가지를 달고 있어야 하고, 그 id 가 같은 그림 안에 있어야 한다.
  for (const ref of refsOf(a)) {
    assert.ok(ref.startsWith('a-'), `url(#${ref}) 가 앞가지를 못 받았습니다 — 잘라 내기가 풀립니다`);
    assert.ok(idsOf(a).includes(ref), `url(#${ref}) 가 가리키는 id 가 이 그림에 없습니다`);
  }
});

/* ---------------- 시행에서 되살리는가 ---------------- */

test('기록한 시행을 그림으로 되살릴 수 있다 — 이미지를 저장하지 않는 이유', () => {
  const t = tube();
  const trial = {
    at: 0, conditions: tubeConditions(t), minutes: OBSERVE_LIMIT_MIN,
    gasMl: gasNow(t), kohChecked: false, offDesign: [], independent: 'temp',
  };
  const revived = tubeFromTrial(trial);
  assert.equal(gasNow(revived).toFixed(6), gasNow(t).toFixed(6),
    '되살린 관의 기체 양이 기록된 것과 다릅니다');
});

test('시행 여러 개를 한 줄로 그려도 id 가 안 겹친다', () => {
  const t = tube();
  const trials = [0, 1, 2].map((at) => ({
    at, conditions: tubeConditions(t), minutes: OBSERVE_LIMIT_MIN,
    gasMl: gasNow(t), kohChecked: false, offDesign: [], independent: 'temp',
  }));
  const all = renderTrialTubes(trials).map((x) => x.svg).join('');
  const ids = [...all.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, '같은 id 가 한 화면에 여럿입니다');
});

/* ---------------- 말이 붙는가 ---------------- */

test('지금 무슨 일이 일어나고 있는지 한 마디로 말한다', () => {
  assert.equal(observationState(initialTube()), 'idle');
  assert.equal(observationState(tube({ elapsedMin: 5 })), 'running');
  assert.equal(observationState(tube()), 'done');
  assert.equal(observationState(tube({ yeastMl: 0, waterMl: 15 })), 'no-gas');
});

test('발효관에 무엇이 들었는지 한 줄로 적는다', () => {
  assert.deepEqual(tubeContents(initialTube()), []);
  const parts = tubeContents(tube());
  assert.equal(parts.length, 2);
  assert.ok(parts[0].includes('포도당') && parts[1].includes('효모액'));
});

test('희석을 잘못한 농도도 읽을 수 있는 수로 적는다', () => {
  const parts = tubeContents(tube({ glucosePct: 10 / 3 }));
  assert.ok(parts[0].includes('3.3'), `농도를 그대로 늘어놓습니다: ${parts[0]}`);
});

/* ---------------- 순수 함수인가 ---------------- */

test('같은 발효관이면 같은 그림이 나온다', () => {
  assert.equal(renderTube(tube()), renderTube(tube()));
});

test('난수를 쓰지 않는다', () => {
  const src = readFileSync(new URL('../src/render/tube.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!src.includes('Math.random'), '난수를 쓰면 결과를 되살릴 수 없습니다');
});
