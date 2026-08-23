/**
 * 현미경 시야 렌더러 검증.
 *
 * renderFOV 는 상태에서 SVG 문자열을 매번 만들어 낸다. 여기서는 그 문자열을
 * 파싱해 결정성·조합·시야 경계·이동·염색 단계·배율·상태 반영을 확인한다.
 *
 * docs/05-fov-renderer.md, docs/04-interaction-rules.md 참조.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFOV, FOV } from '../src/render/fov.js';
import { PAN_LIMIT } from '../src/sim/state.js';
import { PALETTE } from '../src/style/tokens.js';
import { lipidCount } from '../src/sim/optics.js';

const P = (over = {}) => ({
  reagent: 'IKI', coverage: 1, excess: 0, floating: false, tooThick: false,
  contaminated: false, bubbles: 0, cracked: false, lensTouched: false,
  objective: 40, focusErr: 0, brightness: 1, reactionT: 1,
  panX: 0, panY: 0, seed: 31337, ...over,
});

const PLAIN_FILL = 'rgba(255,255,255,.30)';

/** 색으로 묶인 <g fill="..." stroke="..."> 무리 안의 녹말립(<ellipse>)만 골라, 시야 원 안에 있는 것만 남긴다. */
function granulesInFOV(svg, panX = 0, panY = 0) {
  const groupRe = /<g fill="([^"]+)" stroke="[^"]+" stroke-width="[^"]+">([\s\S]*?)<\/g>/g;
  const out = [];
  let gm;
  while ((gm = groupRe.exec(svg))) {
    const fill = gm[1];
    const ellRe = /<ellipse cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g;
    let em;
    while ((em = ellRe.exec(gm[2]))) {
      const x = parseFloat(em[1]) - panX;
      const y = parseFloat(em[2]) - panY;
      if (Math.hypot(x - FOV.cx, y - FOV.cy) <= FOV.radius) out.push({ fill, x, y });
    }
  }
  return out;
}

/** #fov-scene 처럼 안에 다른 <g> 가 중첩된 태그의 내용만 짝 맞춰 잘라낸다. */
function extractTagRegion(svg, startMarker) {
  const start = svg.indexOf(startMarker);
  assert.notEqual(start, -1, `마커를 찾을 수 없습니다: ${startMarker}`);
  let i = svg.indexOf('>', start) + 1;
  const contentStart = i;
  let depth = 1;
  while (depth > 0) {
    const nextOpen = svg.indexOf('<g', i);
    const nextClose = svg.indexOf('</g>', i);
    assert.notEqual(nextClose, -1, '</g> 짝을 찾지 못했습니다');
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 2;
    } else {
      depth--;
      i = nextClose + 4;
    }
  }
  return svg.slice(contentStart, i - 4);
}

/* ------------------------------------------------------------------ */
/* 1. 결정성                                                           */
/* ------------------------------------------------------------------ */

test('같은 파라미터면 같은 SVG 가 나온다', () => {
  assert.equal(renderFOV(P()), renderFOV(P()));
});

test('seed 만 바꾸면 SVG 가 달라진다', () => {
  assert.notEqual(renderFOV(P()), renderFOV(P({ seed: 4242 })));
});

test('coverage 만 바꾸면 SVG 가 달라진다', () => {
  assert.notEqual(renderFOV(P({ coverage: 1 })), renderFOV(P({ coverage: 0.5 })));
});

test('objective 만 바꾸면 SVG 가 달라진다', () => {
  assert.notEqual(renderFOV(P({ objective: 40 })), renderFOV(P({ objective: 10 })));
});

test('reactionT 만 바꾸면 SVG 가 달라진다', () => {
  assert.notEqual(renderFOV(P({ reactionT: 1 })), renderFOV(P({ reactionT: 0 })));
});

test('panX 만 바꾸면 SVG 가 달라진다', () => {
  assert.notEqual(renderFOV(P({ panX: 0 })), renderFOV(P({ panX: 40 })));
});

/* ------------------------------------------------------------------ */
/* 2. 시약 × coverage 여섯 조합                                        */
/* ------------------------------------------------------------------ */

/**
 * 카드에는 "(가)/(나)/(다) × 1방울/2방울 여섯 조합" 이라고 적혀 있지만
 * 여섯 번째는 존재하지 않는다. DROP 은 스포이트가 비어 있으면 방울을 세지 않고,
 * 아니면 stain 을 반드시 채운다. 그래서 `drops > 0` 이면 stain 은 절대 null 이 아니다.
 * (가) 대조군은 방울이 0개인 한 가지 상태뿐이다 — tests/rules.test.js 가 이 불변식을 지킨다.
 *
 * 도달할 수 있는 조합은 다섯이고, 그 다섯이 서로 구별되면 된다.
 */
test('도달할 수 있는 시약×방울 다섯 조합이 서로 다른 SVG 를 만든다', () => {
  const reachable = [
    { reagent: null, coverage: 0 },        // (가) 대조군 — 방울 없음
    { reagent: 'IKI', coverage: 0.5 },     // (나) 한 방울
    { reagent: 'IKI', coverage: 1 },       // (나) 두 방울
    { reagent: 'SUDAN3', coverage: 0.5 },  // (다) 한 방울
    { reagent: 'SUDAN3', coverage: 1 },    // (다) 두 방울
  ];
  const svgs = reachable.map((o) => renderFOV(P(o)));
  assert.equal(new Set(svgs).size, svgs.length, '다섯 조합이 눈에 띄게 구별돼야 합니다');
});

test('대조군은 방울 수가 그림을 바꾸지 않는다 — 물들 것이 없기 때문이다', () => {
  // 도달할 수 없는 상태지만, 만에 하나 흘러들어도 조용히 같은 그림이라야 한다.
  // 여기서 색이 생기면 시약 없이 염색된 시야가 나온다는 뜻이다.
  assert.equal(renderFOV(P({ reagent: null, coverage: 0 })),
    renderFOV(P({ reagent: null, coverage: 1 })));
});

test('IKI 는 녹말 염색색만, SUDAN3 는 지질 염색색만, 무염색은 둘 다 없다', () => {
  for (const coverage of [0.5, 1]) {
    const none = renderFOV(P({ reagent: null, coverage }));
    const iki = renderFOV(P({ reagent: 'IKI', coverage }));
    const sudan = renderFOV(P({ reagent: 'SUDAN3', coverage }));

    assert.ok(iki.includes(PALETTE.stainStarch[0]), `coverage=${coverage} IKI 에는 녹말 염색색이 있어야 합니다`);
    assert.ok(!iki.includes(PALETTE.stainLipid[0]), `coverage=${coverage} IKI 에는 지질 염색색이 없어야 합니다`);

    assert.ok(sudan.includes(PALETTE.stainLipid[0]), `coverage=${coverage} SUDAN3 에는 지질 염색색이 있어야 합니다`);
    assert.ok(!sudan.includes(PALETTE.stainStarch[0]), `coverage=${coverage} SUDAN3 에는 녹말 염색색이 없어야 합니다`);

    assert.ok(!none.includes(PALETTE.stainStarch[0]) && !none.includes(PALETTE.stainLipid[0]),
      `coverage=${coverage} 무염색에는 둘 다 없어야 합니다`);
  }
});

/* ------------------------------------------------------------------ */
/* 3. 한 방울이면 시야 안에 경계가 보인다                                */
/* ------------------------------------------------------------------ */

test('대물 40, 한 방울(coverage 0.5)이면 시야 안에 염색된 녹말립과 안 된 것이 함께 있다', () => {
  const svg = renderFOV(P({ coverage: 0.5, objective: 40 }));
  const granules = granulesInFOV(svg);
  assert.ok(granules.some(g => g.fill !== PLAIN_FILL), '염색된 녹말립이 있어야 합니다');
  assert.ok(granules.some(g => g.fill === PLAIN_FILL), '염색 안 된 녹말립이 있어야 합니다');
});

test('대물 40, 두 방울(coverage 1.0)이면 시야 안에 염색 안 된 녹말립이 없다', () => {
  const svg = renderFOV(P({ coverage: 1, objective: 40 }));
  const granules = granulesInFOV(svg);
  assert.equal(granules.filter(g => g.fill === PLAIN_FILL).length, 0);
});

/* ------------------------------------------------------------------ */
/* 4. 시야 이동은 상을 반대로 옮긴다                                     */
/* ------------------------------------------------------------------ */

function sceneTransform(svg) {
  const m = svg.match(/<g id="fov-scene" transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
  assert.ok(m, 'fov-scene 태그를 찾을 수 없습니다');
  return { tx: parseFloat(m[1]), ty: parseFloat(m[2]) };
}

test('panX 를 옮기면 #fov-scene 의 transform 에 -panX 가 들어간다', () => {
  assert.equal(sceneTransform(renderFOV(P({ panX: 40 }))).tx, -40);
});

test('panY 를 옮기면 #fov-scene 의 transform 에 -panY 가 들어간다', () => {
  assert.equal(sceneTransform(renderFOV(P({ panY: 40 }))).ty, -40);
});

test('panX 를 -PAN_LIMIT, 0, +PAN_LIMIT 로 옮겨도 시야 안에 녹말립이 항상 있다', () => {
  for (const panX of [-PAN_LIMIT, 0, PAN_LIMIT]) {
    const svg = renderFOV(P({ objective: 40, panX }));
    const granules = granulesInFOV(svg, panX, 0);
    assert.ok(granules.length > 0, `panX=${panX} 일 때 시야 안에 녹말립이 있어야 합니다`);
  }
});

/* ------------------------------------------------------------------ */
/* 5. 두 방울은 어디로 옮겨도 염색이 유지된다                             */
/* ------------------------------------------------------------------ */

test('두 방울(coverage 1.0)은 panX 를 -PAN_LIMIT, 0, +PAN_LIMIT 로 옮겨도 염색이 유지된다', () => {
  for (const panX of [-PAN_LIMIT, 0, PAN_LIMIT]) {
    const svg = renderFOV(P({ coverage: 1, objective: 40, panX }));
    const granules = granulesInFOV(svg, panX, 0);
    assert.equal(granules.filter(g => g.fill === PLAIN_FILL).length, 0,
      `panX=${panX} 일 때 무색 녹말립이 없어야 합니다`);
  }
});

/* ------------------------------------------------------------------ */
/* 6. 반응 진행도는 세 단계다                                           */
/* ------------------------------------------------------------------ */

test('reactionT 0 이면 염색색이 전혀 없다', () => {
  const svg = renderFOV(P({ reactionT: 0 }));
  assert.ok(!svg.includes(PALETTE.stainStarch[0]));
  assert.ok(!svg.includes(PALETTE.stainStarchPale[0]));
});

test('reactionT 0.5 면 옅은 색만 있고 완전한 색은 없다', () => {
  const svg = renderFOV(P({ reactionT: 0.5 }));
  assert.ok(svg.includes(PALETTE.stainStarchPale[0]));
  assert.ok(!svg.includes(PALETTE.stainStarch[0]));
});

test('reactionT 1 이면 완전한 색이 있다', () => {
  assert.ok(renderFOV(P({ reactionT: 1 })).includes(PALETTE.stainStarch[0]));
});

test('reactionT 는 보간하지 않는다 — 0.3 과 0.7 은 같은 결과다', () => {
  assert.equal(renderFOV(P({ reactionT: 0.3 })), renderFOV(P({ reactionT: 0.7 })));
});

test('reactionT 를 생략하면 1 과 같다', () => {
  const withoutIt = P();
  delete withoutIt.reactionT;
  assert.equal(renderFOV(withoutIt), renderFOV(P({ reactionT: 1 })));
});

/* ------------------------------------------------------------------ */
/* 7. 배율이 세포 개수로 구별된다                                       */
/* ------------------------------------------------------------------ */

test('배율이 높을수록 <rect> 개수가 적다 (세포가 덜 나뉜다)', () => {
  const counts = [4, 10, 40].map(objective =>
    (renderFOV(P({ objective })).match(/<rect\b/g) || []).length
  );
  assert.ok(counts[0] > counts[1], `4배(${counts[0]}) > 10배(${counts[1]}) 이어야 합니다`);
  assert.ok(counts[1] > counts[2], `10배(${counts[1]}) > 40배(${counts[2]}) 이어야 합니다`);
});

test('대물 4배에서는 녹말립이 개별 ellipse 대신 <pattern> 텍스처로 나온다', () => {
  assert.ok(renderFOV(P({ objective: 4 })).includes('<pattern id="gp-plain"'));
});

test('대물 10, 40배에서는 <pattern> 없이 녹말립이 개별 <ellipse> 여러 개로 나온다', () => {
  for (const objective of [10, 40]) {
    const svg = renderFOV(P({ objective }));
    assert.ok(!svg.includes('<pattern'), `대물 ${objective}에는 pattern이 없어야 합니다`);
    assert.ok((svg.match(/<ellipse\b/g) || []).length > 10,
      `대물 ${objective}에는 개별 녹말립 ellipse가 여러 개 있어야 합니다`);
  }
});

/* ------------------------------------------------------------------ */
/* 8. 지질 방울 개수가 늘지 않는다                                      */
/* ------------------------------------------------------------------ */

test('대물 40에서 지질 방울(<circle>) 개수가 lipidCount(40) 의 3배를 넘지 않는다', () => {
  const svg = renderFOV(P({ objective: 40, reagent: 'SUDAN3' }));
  const circleCount = (svg.match(/<circle\b/g) || []).length;
  // 시야를 이루는 고정 원(클립·배경·비네트·테두리) 4개는 지질 방울이 아니므로 뺀다.
  const lipidCircles = circleCount - 4;
  assert.ok(lipidCircles > 0, '지질 방울 원이 있어야 합니다');
  assert.ok(lipidCircles <= lipidCount(40) * 3,
    `지질 방울 관련 circle ${lipidCircles}개 — lipidCount(40)*3=${lipidCount(40) * 3} 이하여야 합니다`);
});

/* ------------------------------------------------------------------ */
/* 9. 나머지 상태가 그림에 반영된다                                     */
/* ------------------------------------------------------------------ */

test('floating true 면 겹친 상(고스트, translate(8,6))이 생긴다', () => {
  assert.ok(renderFOV(P({ floating: true })).includes('<g transform="translate(8,6)"'));
  assert.ok(!renderFOV(P({ floating: false })).includes('<g transform="translate(8,6)"'));
});

test('cracked 는 금 간 선(<polyline>)의 유무를 결정한다', () => {
  assert.ok(renderFOV(P({ cracked: true })).includes('<polyline'));
  assert.ok(!renderFOV(P({ cracked: false })).includes('<polyline'));
});

test('bubbles 가 늘면 <circle> 개수도 늘어난다', () => {
  const count = svg => (svg.match(/<circle\b/g) || []).length;
  assert.ok(count(renderFOV(P({ bubbles: 3 }))) > count(renderFOV(P({ bubbles: 0 }))));
});

test('contaminated 면 반대쪽 염색색이 함께 나온다', () => {
  assert.ok(renderFOV(P({ reagent: 'IKI', contaminated: true })).includes(PALETTE.stainLipid[0]),
    'IKI 오염이면 지질 염색색도 나와야 합니다');
  assert.ok(renderFOV(P({ reagent: 'SUDAN3', contaminated: true })).includes(PALETTE.stainStarch[0]),
    'SUDAN3 오염이면 녹말 염색색도 나와야 합니다');
});

test('기포와 금 간 선은 #fov-scene 안에 있고, 렌즈 얼룩은 밖에 있다', () => {
  const svg = renderFOV(P({ bubbles: 2, cracked: true, lensTouched: true }));
  const sceneContent = extractTagRegion(svg, '<g id="fov-scene"');
  assert.ok(sceneContent.includes('<polyline'), '금 간 선은 fov-scene 안에 있어야 합니다');
  assert.ok(sceneContent.includes('stroke-width="4"'), '기포는 fov-scene 안에 있어야 합니다');
  assert.ok(!sceneContent.includes('#6B5A3A'), '렌즈 얼룩은 fov-scene 안에 있으면 안 됩니다');
  assert.ok(svg.includes('#6B5A3A'), '렌즈 얼룩 자체는 어딘가에 있어야 합니다');
});
