/**
 * 현미경 시야 렌더러 검증 — 「현미경으로 세포의 크기 측정하기」
 *
 * `renderFOV` 는 `state.fieldParams()` 한 벌에서 SVG 문자열을 만든다.
 * 여기서는 그 문자열을 파싱해 **두 눈금자가 서로 다른 세계에 있다**는 것을 확인한다.
 *
 * ── 이 파일에서 가장 중요한 검사 ────────────────────────────────────
 * §2 「접안 눈금은 배율에 반응하지 않는다」.
 *
 * 접안 마이크로미터는 접안렌즈 안에, 대물 마이크로미터는 재물대 위에 있다. 배율을 올리면
 * 재물대 위의 것만 벌어지고 접안 눈금은 한 치도 안 변한다 — 학생이 발견해야 하는 것이
 * 이 비대칭이다. 실수로 둘을 함께 확대하면 이 실험은 아무것도 가르치지 않는데,
 * **화면만 봐서는 티가 안 난다** (눈금이 두 겹으로 잘 그려져 있으니까).
 * 그래서 사람 눈 대신 이 검사가 본다.
 *
 * docs/05-fov-renderer.md · src/sim/optics.js 참조.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderFOV, reticleLayer, focusBlurPx, hazeOpacity, FOV, FIELD_PX,
} from '../src/render/fov.js';
import { PALETTE } from '../src/style/tokens.js';
import { EXP_PALETTE } from '../src/style/palette.experiment.js';
import {
  OBJECTIVES, RETICLE_DIVS, MAJOR_EVERY_DIV, STAGE_DIV_UM, STAGE_RULED_UM,
  RETICLE_SPAN_FIELD_FRACTION, STAGE_MICROMETER_FOCUS_EASE,
  eyepieceDivPx, stageDivPx, guardCellLengthPx, guardCellDivs,
  canResolveStageTicks, magnification,
} from '../src/sim/optics.js';

/** `fieldParams()` 가 내주는 키 한 벌. 여기 없는 키를 렌더러가 읽으면 안 된다. */
const P = (over = {}) => ({
  on: 'stageMic',
  hasReticle: true,
  flipped: false,
  eyeAngle: 0,
  itemAngle: 0,
  cracked: false,
  objective: 40,
  focusErr: 0,
  contrast: 1,
  panX: 0,
  panY: 0,
  seed: 31337,
  ...over,
});

/* ------------------------------------------------------------------ */
/* 파싱 헬퍼                                                           */
/* ------------------------------------------------------------------ */

/** `<g ...>` 처럼 안에 다른 `<g>` 가 중첩된 태그의 내용만 짝 맞춰 잘라낸다. */
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

const reticleOf = (svg, prefix = '') => extractTagRegion(svg, `<g id="${prefix}fov-reticle">`);
const sceneOf = (svg, prefix = '') => extractTagRegion(svg, `<g id="${prefix}fov-scene"`);

/**
 * 세로 눈금선(x1 === x2)의 x 좌표를 선이 뻗는 방향·길이별로 모은다.
 * 접안 눈금은 축에서 아래로(y2 > y1), 대물 눈금은 위로(y2 < y1) 뻗는다.
 */
function ticksByLength(region) {
  const out = new Map();
  for (const m of region.matchAll(/<line x1="(-?[\d.]+)" y1="(-?[\d.]+)" x2="(-?[\d.]+)" y2="(-?[\d.]+)"/g)) {
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    if (x1 !== x2) continue;              // 축(가로선)은 눈금이 아니다
    const key = (y2 - y1).toFixed(2);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(x1);
  }
  for (const v of out.values()) v.sort((a, b) => a - b);
  return out;
}

/** 가장 긴 눈금선(굵은 눈금) 무리의 x 좌표. 뻗는 방향으로 어느 눈금자인지 고른다. */
function majorTicks(region, { down = true } = {}) {
  const by = ticksByLength(region);
  const keys = [...by.keys()].map(Number).filter((k) => (down ? k > 0 : k < 0));
  assert.ok(keys.length > 0, `${down ? '접안' : '대물'} 눈금선을 찾지 못했습니다`);
  const longest = keys.reduce((a, b) => (Math.abs(a) > Math.abs(b) ? a : b));
  return by.get(longest.toFixed(2));
}

/** 이웃한 눈금 사이 간격들. 전부 같아야 정상이다. */
function pitches(xs) {
  const out = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
}

const NEAR = (a, b, eps, msg) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg} — ${a} vs ${b} (허용 ${eps})`);

/* ------------------------------------------------------------------ */
/* 1. 결정성 — 기록이 그림 대신 값만 저장할 수 있는 근거                 */
/* ------------------------------------------------------------------ */

test('같은 파라미터면 같은 SVG 가 나온다', () => {
  assert.equal(renderFOV(P()), renderFOV(P()));
});

test('fieldParams 의 키를 하나씩 바꾸면 그림이 달라진다', () => {
  const base = renderFOV(P({ on: 'specimen' }));
  const changed = {
    on: 'stageMic', hasReticle: false, flipped: true, eyeAngle: 7, itemAngle: 5,
    cracked: true, objective: 10, focusErr: 0.2, contrast: 0.3,
    panX: 40, panY: 40, seed: 4242,
  };
  for (const [k, v] of Object.entries(changed)) {
    assert.notEqual(renderFOV(P({ on: 'specimen', [k]: v })), base,
      `${k} 를 바꿨는데 그림이 그대로입니다 — 기록을 다시 그릴 수 없게 됩니다`);
  }
});

/* ================================================================== */
/* 2. 접안 눈금은 배율에 반응하지 않는다 — 이 파일에서 가장 중요한 검사  */
/* ================================================================== */

test('배율을 바꿔도 접안 눈금의 화면상 간격이 같다 (4·10·40배)', () => {
  const measured = OBJECTIVES.map((objective) => {
    const xs = majorTicks(reticleOf(renderFOV(P({ objective }))), { down: true });
    const p = pitches(xs);
    // 한 눈금자 안에서도 간격이 고르지 않으면 셀 수가 없다
    for (const d of p) NEAR(d, p[0], 0.02, `대물 ${objective}배에서 접안 눈금 간격이 들쭉날쭉합니다`);
    return { objective, count: xs.length, pitch: p[0] };
  });

  for (const m of measured) {
    assert.equal(m.count, measured[0].count,
      `대물 ${m.objective}배에서 접안 굵은눈금 개수가 다릅니다 (${m.count} vs ${measured[0].count})`);
    NEAR(m.pitch, measured[0].pitch, 0.02,
      `대물 ${m.objective}배에서 접안 눈금 간격이 달라졌습니다 — 접안 눈금자에 배율이 새어 들어갔습니다`);
  }

  // 그 값이 optics.js 가 말하는 값과 같아야 한다 (한 칸 × 10칸)
  NEAR(measured[0].pitch, eyepieceDivPx(FIELD_PX) * MAJOR_EVERY_DIV, 0.02,
    '굵은 눈금 간격이 eyepieceDivPx × 10 과 다릅니다');
});

test('배율을 바꿔도 접안 눈금 레이어 문자열이 바이트까지 같다', () => {
  // 위 검사는 굵은 눈금 자리만 본다. 이 검사는 잔눈금·띠·숫자·회전·색까지 통째로 본다.
  // 재물대에 무엇이 올라가 있든, 어디로 옮겼든, 초점이 어떻든 접안 눈금은 그대로여야 한다.
  for (const on of [null, 'stageMic', 'specimen']) {
    for (const panX of [0, 120]) {
      for (const focusErr of [0, 0.4]) {
        const layers = OBJECTIVES.map((objective) =>
          reticleOf(renderFOV(P({ objective, on, panX, focusErr }))));
        assert.equal(new Set(layers).size, 1,
          `on=${on} panX=${panX} focusErr=${focusErr} 에서 배율에 따라 접안 눈금이 달라졌습니다`);
      }
    }
  }
});

test('접안 눈금을 그리는 함수는 objective 를 받지 않는다', () => {
  // 시그니처로 막는 것이 1차 방어선이다 (src/render/fov.js 머리말).
  // `length` 는 기본값 있는 인자를 세지 않으므로 개수만으로는 못 본다 —
  // **배율을 어느 자리로 밀어 넣어도 그림이 안 변한다**는 것으로 확인한다.
  assert.ok(reticleLayer.length <= 1,
    'reticleLayer 에 기본값 없는 인자가 늘었습니다 — 배율이 들어올 자리를 만들지 마세요');
  const base = reticleLayer(FIELD_PX);
  for (const objective of OBJECTIVES) {
    assert.equal(reticleLayer(FIELD_PX, {}, objective), base,
      '세 번째 인자로 배율이 먹혔습니다');
    assert.equal(reticleLayer(FIELD_PX, { objective }), base,
      'opts.objective 가 먹혔습니다');
  }
  // optics 쪽 짝도 함께 본다. 한쪽만 지키면 다른 쪽으로 새어 든다.
  assert.equal(eyepieceDivPx.length, 1,
    'eyepieceDivPx 의 인자가 늘었습니다 (src/sim/optics.js)');
});

test('접안 눈금자는 시야 지름의 55.6 % 만 가로지른다 — 꽉 채우지 않는다', () => {
  const xs = majorTicks(reticleOf(renderFOV(P())), { down: true });
  const span = xs[xs.length - 1] - xs[0];
  NEAR(span, FIELD_PX * RETICLE_SPAN_FIELD_FRACTION, 0.05,
    '눈금자 길이가 10 mm / 18 mm 비율과 다릅니다');
  assert.ok(span < FIELD_PX * 0.6, '눈금자가 시야를 너무 많이 가로지릅니다');
  NEAR((xs[0] + xs[xs.length - 1]) / 2, FOV.cx, 0.05, '눈금자가 시야 중앙에 있지 않습니다');
});

test('접안 눈금은 100칸이다 — 시야를 가로지르는 180칸이 아니다', () => {
  const region = reticleOf(renderFOV(P()));
  const xs = majorTicks(region, { down: true });
  assert.equal(xs.length, RETICLE_DIVS / MAJOR_EVERY_DIV + 1,
    `굵은 눈금은 0부터 ${RETICLE_DIVS}까지 ${MAJOR_EVERY_DIV}칸마다여야 합니다`);
  const labels = [...region.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
  assert.deepEqual(labels, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
});

test('시야 원에서는 접안 잔눈금을 개별 선으로 그리지 않고 옅은 띠로 둔다', () => {
  // 한 칸이 1.8 px 이라 선과 빈칸이 구별되지 않는다. 억지로 그으면 없는 무늬(모아레)가 생겨
  // 세라고 그린 것이 셀 수 없게 그려진다 — 학생이 조작이 아니라 렌더링 때문에 틀린다.
  // 배율을 올려도 이 값은 안 변하므로, 세는 일은 확대 뷰에서 한다.
  const region = reticleOf(renderFOV(P()));
  const by = ticksByLength(region);
  assert.equal(by.get('6.00'), undefined, '시야 원에 접안 잔눈금이 개별 선으로 그려졌습니다');
  assert.match(region, /<rect[^>]*opacity="0\.16"/, '못 그리는 자리에 띠가 없습니다');
});

/* ------------------------------------------------------------------ */
/* 3. 대물 눈금은 배율을 그대로 따라간다 — 반대쪽 절반                    */
/* ------------------------------------------------------------------ */

test('대물 눈금의 화면상 간격은 배율에 비례한다 (40배가 10배의 4배)', () => {
  const pitch = {};
  for (const objective of OBJECTIVES) {
    const xs = majorTicks(sceneOf(renderFOV(P({ objective, on: 'stageMic' }))), { down: false });
    pitch[objective] = pitches(xs)[0];
    NEAR(pitch[objective], stageDivPx(objective, FIELD_PX) * MAJOR_EVERY_DIV, 0.02,
      `대물 ${objective}배의 굵은 눈금 간격이 stageDivPx 와 다릅니다`);
  }
  // 좌표를 소수 둘째 자리로 적으므로 간격이 좁은 4배 쪽에 약 0.3 % 반올림이 남는다
  NEAR(pitch[40] / pitch[10], 4, 0.01, '400배에서 대물 눈금이 4배로 벌어져야 합니다');
  NEAR(pitch[10] / pitch[4], 2.5, 0.01, '100배는 40배의 2.5배여야 합니다');
});

test('두 눈금자는 100배에서 포개지고 400배에서 4:1 이 된다 — 학생이 발견할 수', () => {
  const eye = eyepieceDivPx(FIELD_PX);
  NEAR(stageDivPx(10, FIELD_PX) / eye, 1, 1e-9, '100배에서는 두 눈금자가 포개져야 합니다');
  NEAR(stageDivPx(40, FIELD_PX) / eye, 4, 1e-9, '400배에서는 접안 4칸이 대물 1칸이어야 합니다');

  // 식이 아니라 **그려진 결과**에서도 같은 비가 나와야 한다
  const eyePitch = pitches(majorTicks(reticleOf(renderFOV(P({ objective: 40 }))), { down: true }))[0];
  const stagePitch = pitches(majorTicks(sceneOf(renderFOV(P({ objective: 40 }))), { down: false }))[0];
  NEAR(stagePitch / eyePitch, 4, 0.01, '화면에 그려진 두 눈금의 비가 4 가 아닙니다');
});

test('대물 잔눈금은 400배에서만 개별 선으로 그려진다', () => {
  for (const objective of OBJECTIVES) {
    const region = sceneOf(renderFOV(P({ objective, on: 'stageMic' })));
    const minor = ticksByLength(region).get('-6.00') ?? [];
    const resolvable = canResolveStageTicks(objective, FIELD_PX);
    assert.equal(minor.length > 0, resolvable,
      `대물 ${objective}배: canResolveStageTicks=${resolvable} 인데 잔눈금 ${minor.length}개`);
    if (!resolvable) {
      assert.match(region, /<rect[^>]*opacity="0\.20"/,
        `대물 ${objective}배: 잔눈금을 못 그리면 띠라도 있어야 합니다`);
    }
  }
});

test('대물 마이크로미터에서 눈금이 새겨진 부분은 1 mm 뿐이다', () => {
  for (const objective of OBJECTIVES) {
    const xs = majorTicks(sceneOf(renderFOV(P({ objective }))), { down: false });
    const span = xs[xs.length - 1] - xs[0];
    NEAR(span, (STAGE_RULED_UM / STAGE_DIV_UM) * stageDivPx(objective, FIELD_PX), 0.05,
      `대물 ${objective}배에서 눈금 구간 길이가 1 mm 가 아닙니다`);
  }
  // 4배에서는 시야 반지름보다 작은 자국이라, 「저배율로 찾는」 단계가 하드 게이트 없이 생긴다
  const wide = majorTicks(sceneOf(renderFOV(P({ objective: 4 }))), { down: false });
  assert.ok(wide[wide.length - 1] - wide[0] < FOV.radius,
    '4배에서 눈금 구간이 시야 반지름보다 작아야 합니다 — 찾을 것이 있어야 합니다');
});

test('대물 눈금 번호는 µm 로 적고, 들어갈 자리가 없으면 안 적는다', () => {
  const labelsOf = (objective) =>
    [...sceneOf(renderFOV(P({ objective }))).matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
  assert.deepEqual(labelsOf(40), [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    '400배 대물 눈금 번호는 100 µm 마다여야 합니다');
  for (const objective of [4, 10]) {
    assert.deepEqual(labelsOf(objective), [],
      `대물 ${objective}배는 숫자가 겹치므로 안 적어야 합니다 — 잘못 읽힌 숫자는 없는 것보다 나쁩니다`);
  }
});

/* ------------------------------------------------------------------ */
/* 4. 레이어 분리 — 초점 나사는 접안 눈금에 닿지 않는다                  */
/* ------------------------------------------------------------------ */

/** `filter="url(#X)"` 로 가리켜진 필터의 stdDeviation */
function blurUsedBy(doc, sceneId) {
  const scene = doc.match(new RegExp(`<g id="${sceneId}"[^>]*>`));
  assert.ok(scene, `${sceneId} 를 찾을 수 없습니다`);
  const before = doc.slice(0, doc.indexOf(scene[0]));
  const refs = [...before.matchAll(/filter="url\(#([^)]+)\)"/g)];
  assert.ok(refs.length > 0, `${sceneId} 를 감싼 filter 가 없습니다`);
  const filterId = refs[refs.length - 1][1];
  const std = doc.match(new RegExp(`<filter id="${filterId}"[^>]*>\\s*<feGaussianBlur stdDeviation="([\\d.]+)"`));
  assert.ok(std, `${filterId} 필터를 찾을 수 없습니다`);
  return { filterId, stdDeviation: Number(std[1]) };
}

test('초점을 흐려도 접안 눈금 레이어는 그대로다 — 렌즈 안에 있으므로', () => {
  const sharp = renderFOV(P({ on: 'specimen', focusErr: 0 }));
  const blurry = renderFOV(P({ on: 'specimen', focusErr: 0.4 }));
  assert.equal(reticleOf(sharp), reticleOf(blurry),
    '초점 나사가 접안 눈금에 닿았습니다 — 눈금은 늘 선명해야 합니다');
  assert.equal(blurUsedBy(sharp, 'fov-scene').stdDeviation, 0);
  assert.ok(blurUsedBy(blurry, 'fov-scene').stdDeviation > 0, '표본은 흐려져야 합니다');
});

test('접안 눈금 레이어가 흐림 그룹 밖에 있다', () => {
  // 「눈금은 선명한데 표본만 뿌옇다」가 초점이 안 맞았다는 단서가 된다.
  // 눈금이 흐림 그룹 안에 들어가면 그 단서가 사라진다 — 에러 없이 조용히.
  const svg = renderFOV(P({ on: 'specimen', focusErr: 0.5 }));
  const blurred = extractTagRegion(svg, '<g filter="url(#fov-blur)">');
  assert.ok(blurred.includes('id="fov-scene"'), '재물대 레이어가 흐림 그룹 안에 없습니다');
  assert.ok(!blurred.includes('id="fov-reticle"'), '접안 눈금이 흐림 그룹 안에 들어가 있습니다');
  assert.ok(!reticleOf(svg).includes('filter='), '접안 눈금 안쪽에 따로 필터가 걸렸습니다');
});

test('대물 마이크로미터는 같은 focusErr 에서 표본보다 덜 흐리다', () => {
  // 크롬 선이라 두께가 없어 초점면이 하나뿐이다 (STAGE_MICROMETER_FOCUS_EASE).
  // 「100배에서 눈금에 먼저 초점을 맞춘다」는 절차가 성립하는 이유가 화면에 나와야 한다.
  const mic = focusBlurPx(P({ on: 'stageMic', focusErr: 0.2 }));
  const spec = focusBlurPx(P({ on: 'specimen', focusErr: 0.2 }));
  NEAR(spec / mic, STAGE_MICROMETER_FOCUS_EASE, 1e-9, '완화 계수가 반영되지 않았습니다');
  assert.equal(blurUsedBy(renderFOV(P({ on: 'stageMic', focusErr: 0.2 })), 'fov-scene').stdDeviation,
    Number(mic.toFixed(2)), '렌더러가 focusBlurPx 와 다른 식을 씁니다');
});

test('대비를 잃으면 안개가 짙어지고, 접안 눈금 레이어는 그대로다', () => {
  const op = (svg) => Number(svg.match(/<rect id="fov-dark"[^>]*opacity="([\d.]+)"/)[1]);
  const clear = renderFOV(P({ contrast: 1 })), murky = renderFOV(P({ contrast: 0 }));
  assert.equal(op(clear), 0);
  assert.ok(op(murky) > 0, '대비를 잃으면 안개가 있어야 합니다');
  NEAR(op(murky), Number(hazeOpacity(P({ contrast: 0 })).toFixed(2)), 1e-9,
    '렌더러가 hazeOpacity 와 다른 식을 씁니다');
  // 안개는 두 레이어를 함께 덮는다 — 눈금 자체를 다시 그리지 않는다
  assert.equal(reticleOf(clear), reticleOf(murky));
  assert.ok(op(murky) < 1, '대비를 다 잃어도 형체는 남아야 합니다');
});

/* ------------------------------------------------------------------ */
/* 5. 재물대 이동 — 상은 반대로 움직이고, 접안 눈금은 안 움직인다        */
/* ------------------------------------------------------------------ */

function sceneTransform(svg) {
  const m = svg.match(/<g id="fov-scene" transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
  assert.ok(m, 'fov-scene 태그를 찾을 수 없습니다 — src/ui 가 이 모양으로 속성만 갱신합니다');
  return { tx: parseFloat(m[1]), ty: parseFloat(m[2]) };
}

test('재물대를 옮기면 #fov-scene 의 transform 에 -pan 이 들어간다', () => {
  assert.deepEqual(sceneTransform(renderFOV(P({ panX: 40, panY: -25 }))), { tx: -40, ty: 25 });
});

test('재물대를 옮겨도 접안 눈금은 제자리다', () => {
  const still = reticleOf(renderFOV(P()));
  for (const [panX, panY] of [[120, 0], [0, -80], [-200, 200]]) {
    assert.equal(reticleOf(renderFOV(P({ panX, panY }))), still,
      `pan=(${panX},${panY}) 에서 접안 눈금이 함께 움직였습니다`);
  }
});

test('접안렌즈를 돌리면 접안 눈금만 돌고, 표본을 돌리면 표본만 돈다', () => {
  const eyeRot = (svg) => reticleOf(svg).match(/rotate\((-?[\d.]+) /)[1];
  const itemRot = (svg) => sceneOf(svg).match(/^<g transform="rotate\((-?[\d.]+) /)[1];

  const turnedEye = renderFOV(P({ eyeAngle: 12 }));
  assert.equal(eyeRot(turnedEye), '12.00');
  assert.equal(itemRot(turnedEye), '0.00', '접안렌즈를 돌렸는데 재물대가 함께 돌았습니다');

  const turnedItem = renderFOV(P({ itemAngle: 7 }));
  assert.equal(itemRot(turnedItem), '7.00');
  assert.equal(eyeRot(turnedItem), '0.00', '표본을 돌렸는데 접안 눈금이 함께 돌았습니다');
});

/* ------------------------------------------------------------------ */
/* 6. 뒤집어 끼운 눈금자 — 읽기만 불편하고 값은 안 틀린다                */
/* ------------------------------------------------------------------ */

test('뒤집어도 눈금선 간격은 그대로다 — 값이 틀리지 않는다', () => {
  const a = majorTicks(reticleOf(renderFOV(P({ flipped: false }))), { down: true });
  const b = majorTicks(reticleOf(renderFOV(P({ flipped: true }))), { down: true });
  assert.deepEqual(b, a, '뒤집었더니 눈금선 자리가 달라졌습니다 — 값이 틀리게 됩니다');
});

test('뒤집으면 숫자만 좌우로 뒤집힌다', () => {
  const flipped = reticleOf(renderFOV(P({ flipped: true })));
  assert.match(flipped, /<g font-family[^>]*transform="translate\([\d.]+,0\) scale\(-1,1\)"/,
    '숫자에 거울 변환이 걸려 있지 않습니다');
  assert.ok(!reticleOf(renderFOV(P({ flipped: false }))).includes('scale(-1,1)'));
  assert.notEqual(renderFOV(P({ flipped: true })), renderFOV(P({ flipped: false })));
});

/* ------------------------------------------------------------------ */
/* 7. 표본 — 자주달개비 잎 표피의 공변세포                              */
/* ------------------------------------------------------------------ */

/** 공변세포(연둣빛 타원) 무리에서 장축 반지름들을 뽑는다. */
function guardRadii(svg) {
  const m = sceneOf(svg).match(new RegExp(`<g fill="${EXP_PALETTE.leaf[0]}"[^>]*>([\\s\\S]*?)</g>`));
  assert.ok(m, '공변세포 무리를 찾을 수 없습니다');
  return [...m[1].matchAll(/rx="([\d.]+)"/g)].map((x) => Number(x[1]));
}

test('공변세포 길이는 optics.js 의 guardCellLengthUm 에서 온다 — 숫자를 새로 짓지 않는다', () => {
  for (const objective of [10, 40]) {
    for (const seed of [1, 31337, 987654]) {
      const rx = guardRadii(renderFOV(P({ on: 'specimen', objective, seed })));
      assert.ok(rx.length > 0, `대물 ${objective}배 seed=${seed} 에 공변세포가 없습니다`);
      const expect = guardCellLengthPx(objective, FIELD_PX, seed);
      for (const r of rx) {
        NEAR(r * 2, expect, 0.2,
          `대물 ${objective}배 seed=${seed}: 화면상 세포 길이가 guardCellLengthPx 와 다릅니다`);
      }
    }
  }
});

test('400배에서 공변세포는 접안 눈금 15~25칸을 차지한다 — 셀 만한 길이여야 한다', () => {
  // 화면에 그려진 길이와 sim 이 아는 칸 수가 같은지 본다.
  // 여기가 어긋나면 학생이 센 칸 수와 기록이 서로 다른 세포를 말하게 된다.
  for (const seed of [1, 31337, 987654]) {
    const rx = guardRadii(renderFOV(P({ on: 'specimen', objective: 40, seed })));
    const divs = (rx[0] * 2) / eyepieceDivPx(FIELD_PX);
    NEAR(divs, guardCellDivs(40, seed), 0.03, `seed=${seed}: 화면과 guardCellDivs 가 어긋납니다`);
    assert.ok(divs >= 15 && divs <= 25, `seed=${seed}: ${divs.toFixed(1)}칸 — 15~25칸 창을 벗어났습니다`);
  }
});

test('저배율에서는 기공 구멍이 분해되지 않는다', () => {
  // 「하나로 뭉친 점」으로만 보이는 것이 배율을 올릴 이유가 된다. 성능 때문이 아니다.
  const hasPore = (objective) =>
    sceneOf(renderFOV(P({ on: 'specimen', objective }))).includes(`<g fill="${PALETTE.glass[1]}"`);
  assert.equal(hasPore(4), false, '4배에서 기공 구멍이 보이면 안 됩니다');
  assert.equal(hasPore(10), false, '10배에서 기공 구멍이 보이면 안 됩니다');
  assert.equal(hasPore(40), true, '40배에서는 기공 구멍이 보여야 합니다');
});

test('배율이 높을수록 시야에 들어오는 표피세포가 적다', () => {
  const counts = OBJECTIVES.map((objective) =>
    (sceneOf(renderFOV(P({ on: 'specimen', objective }))).match(/<rect\b/g) || []).length);
  assert.ok(counts[0] > counts[1], `4배(${counts[0]}) > 10배(${counts[1]}) 여야 합니다`);
  assert.ok(counts[1] > counts[2], `10배(${counts[1]}) > 40배(${counts[2]}) 여야 합니다`);
});

test('재물대를 옮겨도 같은 세포가 같은 모양으로 남는다', () => {
  // 모양이 그리는 순서가 아니라 좌표의 순수 함수여야 성립한다 (geometry.hash).
  const shapesAt = (panX) => new Set(
    [...sceneOf(renderFOV(P({ on: 'specimen', objective: 40, panX })))
      .matchAll(/<ellipse cx="(-?[\d.]+)" cy="(-?[\d.]+)" rx="([\d.]+)"/g)]
      .map((m) => m.slice(1).join(',')));
  const a = shapesAt(0), b = shapesAt(60);
  assert.ok([...a].some((s) => b.has(s)), '조금 옮겼는데 겹치는 세포가 하나도 없습니다');
});

test('재물대를 끝까지 밀어도 표본은 시야를 채운다 — 표본은 슬라이드 전체를 덮는다', () => {
  for (const panX of [-260, 0, 260]) {
    const region = sceneOf(renderFOV(P({ on: 'specimen', objective: 40, panX })));
    assert.ok((region.match(/<rect\b/g) || []).length > 0, `panX=${panX} 에서 표본이 비었습니다`);
  }
});

/* ------------------------------------------------------------------ */
/* 8. 나머지 상태                                                      */
/* ------------------------------------------------------------------ */

test('재물대가 비면 눈금자도 세포도 없고, 접안 눈금은 남는다', () => {
  const svg = renderFOV(P({ on: null }));
  assert.equal(sceneOf(svg), '', '빈 재물대인데 무언가 그려져 있습니다');
  assert.ok(reticleOf(svg).length > 0, '접안 눈금은 렌즈 안에 있으므로 남아야 합니다');
});

test('접안 마이크로미터를 안 끼우면 눈금 레이어가 비어 있다 — 잴 것이 없다', () => {
  const svg = renderFOV(P({ hasReticle: false }));
  assert.equal(reticleOf(svg), '');
  assert.ok(sceneOf(svg).length > 0, '재물대 위의 것은 그대로 보여야 합니다');
});

test('cracked 는 금 간 선(<polyline>)의 유무를 결정하고, 선은 슬라이드와 함께 움직인다', () => {
  assert.ok(sceneOf(renderFOV(P({ cracked: true }))).includes('<polyline'));
  assert.ok(!renderFOV(P({ cracked: false })).includes('<polyline'));
  // 접안렌즈에 붙은 것이 아니므로 눈금 레이어에는 없어야 한다
  assert.ok(!reticleOf(renderFOV(P({ cracked: true }))).includes('<polyline'));
});

test('시야에 딸린 글은 총배율만 말한다 — 시야 지름(µm)을 적으면 보정이 필요 없어진다', () => {
  // 눈금자가 시야의 55.6 % 를 가로지르는 것이 눈에 보이므로, 시야 지름을 알려 주면
  // 「눈금자 길이 ÷ 100」으로 한 칸의 µm 값이 바로 나온다. 그게 학생이 할 일이다.
  for (const objective of OBJECTIVES) {
    const svg = renderFOV(P({ objective }));
    const caption = svg.slice(svg.lastIndexOf('<text'));
    assert.match(caption, new RegExp(`>총 ${magnification(objective)}배<`));
    assert.ok(!caption.includes('µm'), '맨 아래 글에 µm 가 있습니다');
    const aria = svg.match(/aria-label="([^"]*)"/)[1];
    assert.ok(!/\d{3,}\s*µm|µm/.test(aria), `aria-label 에 µm 값이 있습니다: ${aria}`);
    assert.ok(!aria.includes(String(18000 / objective)), 'aria-label 에 시야 지름이 있습니다');
  }
});

/* ------------------------------------------------------------------ */
/* 9. 한 문서에 여러 장 — 기록 카드가 설 자리                           */
/* ------------------------------------------------------------------ */

test('한 문서에 시야를 둘 그리면 각자의 흐림을 쓴다', () => {
  // 같은 문서에 같은 id 가 둘이면 브라우저는 먼저 나온 것만 쓴다 —
  // 모든 카드가 첫 카드의 흐림을 쓰게 되어 초점이 다른 카드가 같게 보인다.
  // 에러가 나지 않으므로 이 검사가 없으면 조용히 틀린 채로 배포된다.
  const doc = renderFOV(P({ on: 'specimen', focusErr: 0 }), { idPrefix: 'a-' }) +
    renderFOV(P({ on: 'specimen', focusErr: 0.2 }), { idPrefix: 'b-' });
  const a = blurUsedBy(doc, 'a-fov-scene');
  const b = blurUsedBy(doc, 'b-fov-scene');
  assert.notEqual(a.filterId, b.filterId, '두 시야가 같은 필터를 가리킵니다');
  assert.equal(a.stdDeviation, 0);
  assert.ok(b.stdDeviation > 0, `초점이 다른데 같은 흐림을 씁니다 (둘 다 ${a.stdDeviation})`);
});

test('접두사를 주면 모든 id 와 참조에 붙는다', () => {
  const svg = renderFOV(P({ on: 'specimen', objective: 4 }), { idPrefix: 'card2-' });
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.ok(id.startsWith('card2-'), `접두사가 안 붙은 id: ${id}`);
  for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(m[1].startsWith('card2-'), `접두사가 안 붙은 참조: url(#${m[1]})`);
  }
  // 접두사를 줘도 접안 눈금은 여전히 배율에 반응하지 않아야 한다
  const layers = OBJECTIVES.map((objective) =>
    reticleOf(renderFOV(P({ objective }), { idPrefix: 'card2-' }), 'card2-'));
  assert.equal(new Set(layers).size, 1);
});

test('접두사를 안 주면 src/ui 가 찾는 이름 그대로다', () => {
  const svg = renderFOV(P());
  for (const name of ['fov-clip', 'fov-blur', 'fov-vig', 'fov-scene', 'fov-dark', 'fov-reticle']) {
    assert.ok(svg.includes(`id="${name}"`), `${name} 이 없습니다 — src/ui 가 이 이름으로 찾습니다`);
  }
});
