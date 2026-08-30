/**
 * 현미경 시야 렌더러 검증.
 *
 * renderFOV 는 상태에서 SVG 문자열을 매번 만들어 낸다. 여기서는 그 문자열을 뜯어
 * **과학적으로 지켜야 할 것**과 결정성·이동·상태 반영을 확인한다.
 *
 * 가장 중요한 것 둘:
 *   · 세포벽은 줄지 않는다 (줄이면 이 실험을 통째로 틀리게 가르친다)
 *   · 저장액에서 터지지 않는다
 *
 * docs/05-fov-renderer.md · AGENTS.md §2.5 참조.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFOV, FOV } from '../src/render/fov.js';
import { PAN_LIMIT } from '../src/sim/state.js';
import { EXP_PALETTE } from '../src/style/palette.experiment.js';
import { CELL_SAP_PCT, SOLUTION_PCT } from '../src/sim/osmosis.js';

const P = (over = {}) => ({
  side: 'outer', equivPct: 0, targetPct: 0, exchange: 0,
  coverage: 1, excess: 0, floating: false, tooThick: false, folded: false,
  contaminated: false, bubbles: 0, cracked: false, lensTouched: false,
  objective: 10, focusErr: 0, brightness: 1,
  panX: 0, panY: 0, seed: 31337, ...over,
});

/** `<g fill="X" ...>` 무리 안의 <rect> 를 fill 별로 모은다. */
function rectsByFill(svg) {
  const out = new Map();
  const groupRe = /<g fill="([^"]+)"([^>]*)>((?:(?!<\/g>)[\s\S])*?)<\/g>/g;
  let gm;
  while ((gm = groupRe.exec(svg))) {
    const fill = gm[1];
    const list = out.get(fill) ?? [];
    const rectRe = /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g;
    let rm;
    while ((rm = rectRe.exec(gm[3]))) {
      list.push({ x: +rm[1], y: +rm[2], w: +rm[3], h: +rm[4] });
    }
    out.set(fill, list);
  }
  return out;
}

const WALL_FILL = 'rgba(255,255,255,.34)';

/* ---------------- 결정성 ---------------- */

test('같은 값을 두 번 주면 문자열이 똑같다', () => {
  assert.equal(renderFOV(P()), renderFOV(P()));
  assert.equal(renderFOV(P({ equivPct: 20 })), renderFOV(P({ equivPct: 20 })));
});

test('시드가 다르면 그림도 다르다', () => {
  assert.notEqual(renderFOV(P({ seed: 7 })), renderFOV(P({ seed: 8 })));
});

test('idPrefix 를 주면 참조가 겹치지 않는다', () => {
  // 겹치면 결과 카드를 여러 장 늘어놓았을 때 **에러 없이 조용히** 첫 카드의 흐림을 쓴다.
  const a = renderFOV(P(), { idPrefix: 'card1-' });
  const b = renderFOV(P({ focusErr: 0.4 }), { idPrefix: 'card2-' });
  assert.ok(a.includes('id="card1-fov-blur"'));
  assert.ok(b.includes('id="card2-fov-blur"'));
  assert.equal(a.includes('card2-'), false);
});

/* ---------------- 과학적으로 지켜야 하는 것 ---------------- */

test('세포벽은 농도가 달라져도 그대로 있다', () => {
  // **이 검사가 이 파일에서 가장 중요하다.** 세포벽까지 함께 줄이면
  // 「줄어드는 것은 원형질체뿐」이라는 이 실험의 핵심을 거꾸로 가르친다.
  const water = rectsByFill(renderFOV(P({ equivPct: 0 }))).get(WALL_FILL);
  const sugar = rectsByFill(renderFOV(P({ equivPct: 20 }))).get(WALL_FILL);
  assert.ok(water && water.length > 10, '세포벽을 못 찾았습니다');
  assert.deepEqual(sugar, water, '설탕 용액에서 세포벽 좌표가 달라졌습니다');
});

test('저장액에서 원형질체가 세포벽을 넘지 않는다 — 터지지 않는다', () => {
  const svg = renderFOV(P({ equivPct: 0 }));
  const by = rectsByFill(svg);
  const walls = by.get(WALL_FILL);
  const vac = by.get(EXP_PALETTE.vacuole[0]);
  assert.ok(vac && vac.length > 10, '액포를 못 찾았습니다');
  assert.equal(walls.length, vac.length, '세포마다 원형질체가 하나씩이라야 한다');
  for (let i = 0; i < walls.length; i++) {
    assert.ok(vac[i].w <= walls[i].w + 0.05 && vac[i].h <= walls[i].h + 0.05,
      `원형질체가 세포벽보다 큽니다 — 식물세포는 터지지 않습니다`);
  }
});

test('고장액에서 원형질체가 줄고, 진할수록 더 줄어든다', () => {
  const areaOf = (pct) => {
    const by = rectsByFill(renderFOV(P({ equivPct: pct })));
    const all = [...(by.get(EXP_PALETTE.vacuole[0]) ?? []), ...(by.get(EXP_PALETTE.vacuoleDeep[0]) ?? [])];
    return all.reduce((a, r) => a + r.w * r.h, 0);
  };
  const a0 = areaOf(0), a15 = areaOf(15), a20 = areaOf(20);
  assert.ok(a15 < a0, '15 % 에서 줄어야 한다');
  assert.ok(a20 < a15, '20 % 가 15 % 보다 더 줄어야 한다');
});

test('물러난 자리는 비어 있지 않다 — 바깥 용액이 들어와 있다', () => {
  // 세포벽은 전투과성이라 설탕 용액이 자유롭게 지난다.
  const svg = renderFOV(P({ equivPct: 20 }));
  assert.ok(svg.includes('rgba(232,238,236,.55)'), '틈을 채우는 층이 없습니다');
  assert.equal(renderFOV(P({ equivPct: 0 })).includes('rgba(232,238,236,.55)'), false,
    '틈이 없을 때는 그 층도 없어야 한다');
});

test('한 시야 안에서 세포마다 정도가 갈린다', () => {
  // 전부 한꺼번에 갈라지면 「절반이 원형질분리」 라는 판정이 성립하지 않는다.
  const by = rectsByFill(renderFOV(P({ equivPct: CELL_SAP_PCT + 1 })));
  const normal = by.get(EXP_PALETTE.vacuole[0]) ?? [];
  const deep = by.get(EXP_PALETTE.vacuoleDeep[0]) ?? [];
  assert.ok(normal.length > 0 && deep.length > 0,
    `세포액 농도 언저리에서 두 종류가 섞여 있어야 합니다 (아직 ${normal.length} · 갈라진 ${deep.length})`);
});

test('안쪽 표피에는 액포색이 나오지 않는다', () => {
  const svg = renderFOV(P({ side: 'inner', equivPct: 20 }));
  assert.equal(svg.includes(EXP_PALETTE.vacuole[0]), false);
  assert.equal(svg.includes(EXP_PALETTE.vacuoleDeep[0]), false);
  // 그래도 세포 윤곽은 보인다 — 아무것도 없는 화면은 「고장 난 것」으로 읽힌다
  assert.ok(rectsByFill(svg).get(WALL_FILL).length > 10);
});

test('치환이 안 됐으면 용액을 골라도 시야가 안 바뀐다', () => {
  // 가장자리에 액을 대기만 한 상태. equivPct 는 그대로이므로 그림도 그대로여야 한다.
  const before = renderFOV(P({ equivPct: 0, targetPct: 0, exchange: 0 }));
  const applied = renderFOV(P({ equivPct: 0, targetPct: 0, exchange: 0 }));
  assert.equal(applied, before);
});

/* ---------------- 조작이 시야에 나타나는가 ---------------- */

test('봉입액이 모자라면 마른 자리가 보인다', () => {
  const wet = renderFOV(P({ coverage: 1 }));
  const half = renderFOV(P({ coverage: 0.5 }));
  assert.notEqual(half, wet);
  assert.ok(half.includes('#EDEAE2'), '마른 곳을 나타내는 층이 없습니다');
  assert.equal(wet.includes('#EDEAE2'), false, '다 젖었으면 마른 층이 없어야 한다');
});

test('기포 개수가 그대로 그려진다', () => {
  const count = (svg) => (svg.match(/fill="rgba\(255,255,255,\.30\)" stroke="rgba\(40,44,36,\.55\)"/g) ?? []).length;
  assert.equal(count(renderFOV(P({ bubbles: 0 }))), 0);
  assert.equal(count(renderFOV(P({ bubbles: 4 }))), 4);
});

test('금·렌즈 오염·넘침·두꺼움이 각각 시야를 바꾼다', () => {
  const base = renderFOV(P());
  for (const over of [{ cracked: true }, { lensTouched: true }, { excess: 0.8 }, { tooThick: true }, { folded: true }]) {
    assert.notEqual(renderFOV(P(over)), base, `${Object.keys(over)[0]} 가 시야에 나타나지 않습니다`);
  }
});

test('초점과 광량은 그림을 다시 만들지 않고 속성만 바꾼다', () => {
  // 슬라이더를 끄는 동안 매 프레임 다시 만들면 안 되므로 이 두 값만 따로 뽑아 쓴다.
  assert.ok(renderFOV(P({ focusErr: 0.5 })).includes('stdDeviation="11.00"'));
  assert.ok(renderFOV(P({ brightness: 0 })).includes('id="fov-dark"'));
});

test('재물대를 옮기면 상은 반대로 간다', () => {
  const svg = renderFOV(P({ panX: 120, panY: -40 }));
  assert.ok(svg.includes('id="fov-scene" transform="translate(-120.0,40.0)"'));
});

test('시야를 끝까지 옮겨도 세포가 사라지지 않는다', () => {
  for (const pan of [-PAN_LIMIT, 0, PAN_LIMIT]) {
    const walls = rectsByFill(renderFOV(P({ panX: pan, panY: pan }))).get(WALL_FILL);
    assert.ok(walls && walls.length > 10, `panX=${pan} 에서 세포가 없습니다`);
  }
});

/* ---------------- 배율 ---------------- */

test('배율을 올리면 세포가 커지고 개수가 준다', () => {
  const cells = (ob) => rectsByFill(renderFOV(P({ objective: ob }))).get(WALL_FILL);
  const low = cells(4), mid = cells(10), high = cells(40);
  assert.ok(low.length > mid.length && mid.length > high.length);
  assert.ok(high[0].w > mid[0].w && mid[0].w > low[0].w);
});

test('시야 지름이 화면에 적히고 배율마다 다르다', () => {
  assert.ok(renderFOV(P({ objective: 10 })).includes('약 1800 µm'));
  assert.ok(renderFOV(P({ objective: 40 })).includes('약 450 µm'));
});

test('시야에 세포액 농도나 원형질분리 비율이 적혀 있지 않다', () => {
  // 시야 아래에 적히는 것은 시야 지름뿐이다. 답을 적어 두면 탐구가 사라진다.
  const svg = renderFOV(P({ equivPct: 15 }));
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['시야 지름 약 1800 µm']);
  assert.equal(new RegExp(`${CELL_SAP_PCT}\\s*%`).test(svg), false);
});

test('시야 원의 크기가 광학 환산과 짝이 맞는다', () => {
  assert.equal(FOV.radius * 2, 328);
  assert.ok(renderFOV(P()).includes(`r="${FOV.radius}"`));
});

test('용액 농도는 색이 아니라 원형질체 크기로만 나타난다', () => {
  // 농도마다 배경색을 달리 칠하면 "진한 용액은 진한 색" 이라는 틀린 것을 가르친다.
  const bg = (pct) => (renderFOV(P({ equivPct: pct })).match(/<circle cx="180" cy="180" r="164" fill="([^"]+)"/) ?? [])[1];
  const seen = new Set(Object.values(SOLUTION_PCT).map(bg));
  assert.equal(seen.size, 1, `농도마다 배경색이 다릅니다: ${[...seen].join(' ')}`);
});
