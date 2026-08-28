/**
 * 애셋 계약 테스트.
 *
 * 아트 디렉션 린터(scripts/check-art-direction.mjs)가 렌더 결과를 검사한다면,
 * 여기서는 계약 자체의 정합성과 결정론을 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, PENDING, SAMPLE_STATES } from '../src/assets/index.js';
import { CONTRACT, requiredNodes, isMutable } from '../src/assets/contract.js';
import { PALETTE } from '../src/style/tokens.js';

test('등록된 애셋은 모두 계약에 선언돼 있다', () => {
  for (const name of Object.keys(ASSETS)) {
    assert.ok(CONTRACT[name], `${name} 이 contract.js 에 없습니다`);
  }
});

test('아직 만들지 않은 애셋도 계약에는 선언돼 있다', () => {
  for (const name of PENDING) {
    assert.ok(CONTRACT[name], `${name} 을 만들기 전에 contract.js 에 노드를 선언하세요`);
  }
});

test('모든 애셋에 대표 상태가 정의돼 있다', () => {
  for (const name of Object.keys(CONTRACT)) {
    assert.ok(SAMPLE_STATES[name], `${name} 의 SAMPLE_STATES 가 없습니다 — 린터가 검사할 수 없습니다`);
  }
});

test('모든 애셋에 realSizeMm 이 선언돼 있다', () => {
  // 애셋은 저마다 프레임을 꽉 채워 그린다. 실험대에 함께 놓을 때의 크기는
  // 그린 크기가 아니라 이 값으로 정한다. 값의 정합성은 사람이 본다.
  for (const [name, spec] of Object.entries(CONTRACT)) {
    assert.equal(typeof spec.realSizeMm, 'number', `${name} 의 realSizeMm 이 없습니다`);
    assert.ok(spec.realSizeMm > 0, `${name} 의 realSizeMm 은 양수여야 합니다`);
  }
});

/**
 * 그룹 안에 적힌 좌표 중 가장 작은 y. `<g id="...">` 부터 짝이 되는 `</g>` 까지를 본다.
 * points/x·y/rect/line 어느 형태로 그렸든 숫자는 여기 다 들어온다.
 */
function topYOfGroup(svg, id) {
  const start = svg.indexOf(`<g id="${id}"`);
  assert.notEqual(start, -1, `#${id} 그룹이 없습니다`);
  let depth = 0;
  let i = start;
  for (; i < svg.length; i++) {
    if (svg.startsWith('<g', i)) depth++;
    else if (svg.startsWith('</g>', i)) { depth--; if (depth === 0) break; }
  }
  const body = svg.slice(start, i);
  const ys = [];
  for (const [, v] of body.matchAll(/\b(?:y|y1|y2|cy)="(-?[\d.]+)"/g)) ys.push(Number(v));
  for (const [, list] of body.matchAll(/\bpoints="([^"]+)"/g)) {
    const nums = list.trim().split(/[\s,]+/).map(Number);
    for (let k = 1; k < nums.length; k += 2) ys.push(nums[k]);
  }
  for (const [, d] of body.matchAll(/\bd="([^"]+)"/g)) {
    const nums = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
    for (let k = 1; k < nums.length; k += 2) ys.push(nums[k]);
  }
  assert.ok(ys.length, `#${id} 에서 좌표를 하나도 못 읽었습니다`);
  return Math.min(...ys);
}

test('실험대 배경의 랜드마크가 제자리에 있다', () => {
  // 물건은 허공이 아니라 이 두 선에 **바닥을 대고** 선다 (src/ui/bench.js).
  // 그림을 다시 그리면서 선반이나 작업면을 위아래로 옮기면 실험대 위 물건이 전부 뜨는데,
  // 그림만 보면 멀쩡해 보여서 아무도 눈치채지 못한다. 벽·바닥 같은 분위기 도형은 #room 에 둔다.
  const { shelfTopY, surfaceFrontY } = CONTRACT.bench.landmarks;
  const svg = ASSETS.bench.render({});
  assert.equal(topYOfGroup(svg, 'shelf'), shelfTopY,
    `선반 상판 윗면이 y=${shelfTopY} 에 있어야 합니다 — 선반 위 물건이 뜹니다`);
  assert.equal(topYOfGroup(svg, 'surface'), surfaceFrontY,
    `작업면 앞 모서리가 y=${surfaceFrontY} 에 있어야 합니다 — 작업면 위 물건이 뜹니다`);
});

test('실험대 배경에 금속 부속이 남아 있지 않다', () => {
  /*
   * 콘센트 두 개 · 선반 지지 기둥 · 「연필처럼 생긴」 가스 밸브 노즐 · 서랍 손잡이 —
   * 전부 지웠다. 넷 다 **금속 색**을 쓰던 것들이라, 하나라도 되살아나면 여기서 걸린다.
   *
   * 이 검사가 없으면 「지웠습니다」 는 스크린샷 한 장으로만 남는다. 다음 사람이 배경을
   * 손보다 하나를 도로 그려 넣어도 초록불이다.
   */
  const svg = ASSETS.bench.render({});
  for (const hex of PALETTE.metal) {
    assert.equal(svg.includes(hex), false,
      `실험대 배경에 금속 부속(${hex})이 있습니다 — 콘센트·기둥·밸브·서랍 손잡이는 지웠습니다`);
  }
});

test('작업면 아래가 「그 밑」 으로 읽히게 쌓여 있다', () => {
  /*
   * 예전에는 작업면 아래가 **화면에서 가장 밝은 아이보리**였다. 밝은 것은 앞으로 나와 보이므로
   * 아래가 아래로 안 읽히고 평평했다. 어두운 그늘 띠를 넣어 단을 만들었다.
   *
   * **색 이름만 훑으면 안 된다** — 같은 어두운 색이 상판에도 쓰인다. 작업면 앞 모서리
   * 아래(y ≥ 248)에 있는 사각형만 골라서 본다.
   */
  const svg = ASSETS.bench.render({});
  const below = [...svg.matchAll(/<rect[^>]*y="(\d+)"[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*>/g)]
    .filter((m) => Number(m[1]) >= 248)
    .map((m) => ({ y: Number(m[1]), fill: m[2] }));

  assert.ok(below.length >= 3,
    `작업면 아래에 단이 ${below.length}개뿐입니다 — 두께면·그늘·몸통이 있어야 합니다`);
  assert.equal(below.some((r) => r.fill === PALETTE.paper[0]), false,
    '작업면 아래에 가장 밝은 아이보리가 있습니다 — 아래가 앞으로 튀어나와 보입니다');
  assert.ok(below.some((r) => r.y < 280 && r.fill === PALETTE.bodyDark[1]),
    '상판 바로 밑에 그늘 띠가 없습니다 — 앞뒤가 평평해 보입니다');
});

test('등록된 애셋은 render 와 applyState 를 모두 내보낸다', () => {
  for (const [name, mod] of Object.entries(ASSETS)) {
    assert.equal(typeof mod.render, 'function', `${name}.render 없음`);
    assert.equal(typeof mod.applyState, 'function', `${name}.applyState 없음`);
  }
});

test('같은 상태·같은 시드는 항상 같은 SVG를 만든다', () => {
  for (const [name, mod] of Object.entries(ASSETS)) {
    for (const st of SAMPLE_STATES[name] ?? [{}]) {
      const a = mod.render({ ...st, seed: 777 });
      const b = mod.render({ ...st, seed: 777 });
      assert.equal(a, b, `${name} 이 결정론적이지 않습니다 — Math.random() 을 쓰고 있지 않은지 확인하세요`);
    }
  }
});

test('시드가 다르면 그림도 달라진다', () => {
  const banana = ASSETS.banana;
  const a = banana.render({ ripe: 0.9, seed: 1 });
  const b = banana.render({ ripe: 0.9, seed: 2 });
  assert.notEqual(a, b, '시드가 반영되지 않으면 모둠마다 같은 그림이 나옵니다');
});

test('계약에 없는 속성을 바꾸려 하면 막는다', () => {
  assert.equal(isMutable('banana', '#peel', 'fill'), true);
  assert.equal(isMutable('banana', '#peel', 'd'), false, '패스 데이터는 코드가 바꾸는 대상이 아닙니다');
  assert.equal(isMutable('banana', '#stem', 'fill'), false);
});

test('requiredNodes 는 필수 노드만 돌려준다', () => {
  const nodes = requiredNodes('banana');
  assert.ok(nodes.includes('#peel'));
  assert.ok(nodes.includes('#peel-strips'));
  assert.equal(requiredNodes('slide').includes('#label'), false, 'required:false 는 빠져야 합니다');
});
