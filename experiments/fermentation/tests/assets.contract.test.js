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

/**
 * 같은 상태는 같은 그림을 낸다.
 *
 * 이 실험의 애셋에는 난수가 없다 — 바나나의 반점 같은 것이 없기 때문이다.
 * 그래서 시드로 달라지는지가 아니라 **상태로 달라지는지**를 본다. 상태가 그림에
 * 안 나타나면 학생은 방금 누른 것이 먹혔는지 화면에서 읽을 수 없다.
 */
test('상태가 달라지면 그림도 달라진다', () => {
  for (const [name, mod] of Object.entries(ASSETS)) {
    const states = SAMPLE_STATES[name] ?? [];
    if (CONTRACT[name].states.length === 0) continue;   // 상태가 없는 애셋은 건너뛴다
    assert.ok(states.length >= 2, `${name}: 상태가 있는데 대표 상태가 하나뿐입니다`);
    const drawn = new Set(states.map((st) => mod.render(st)));
    assert.ok(drawn.size > 1,
      `${name}: 상태를 바꿔도 그림이 같습니다 — 상태가 그림에 나타나지 않습니다`);
  }
});

test('같은 상태는 언제나 같은 그림을 낸다', () => {
  for (const [name, mod] of Object.entries(ASSETS)) {
    const st = (SAMPLE_STATES[name] ?? [{}])[0];
    assert.equal(mod.render(st), mod.render({ ...st }),
      `${name}: 같은 상태인데 그림이 다릅니다 — 저장한 결과를 되살릴 수 없습니다`);
  }
});

test('계약에 없는 속성을 바꾸려 하면 막는다', () => {
  assert.equal(isMutable('fermtube', '#liquid', 'height'), true);
  assert.equal(isMutable('fermtube', '#liquid', 'd'), false, '패스 데이터는 코드가 바꾸는 대상이 아닙니다');
  assert.equal(isMutable('fermtube', '#glass', 'fill'), false, '유리 색은 상태로 바꾸는 것이 아닙니다');
});

test('requiredNodes 는 필수 노드만 돌려준다', () => {
  const nodes = requiredNodes('fermtube');
  assert.ok(nodes.includes('#liquid'));
  assert.ok(nodes.includes('#gas'));
  assert.equal(requiredNodes('bench').includes('#room'), false, 'required:false 는 빠져야 합니다');
});

/**
 * 애셋마다 화면에 쓸 한글 이름이 있는가.
 *
 * 이름이 없으면 하네스의 애셋 시트와 실험대 말풍선이 **파일 키를 그대로 보여 준다.**
 * `fermtube` 라고 뜨는 물건을 학생이 집을 리가 없다.
 */
test('등록된 애셋마다 화면에 쓸 한글 이름이 있다', async () => {
  const { UI } = await import('../src/ui/strings.js');
  for (const name of Object.keys(ASSETS)) {
    assert.ok(UI.assetNames[name], `UI.assetNames.${name} 이 없습니다`);
  }
  for (const name of Object.keys(UI.assetNames)) {
    assert.ok(ASSETS[name], `UI.assetNames.${name} 은 등록되지 않은 애셋입니다`);
  }
});

test('CONTENT_BOX 가 프레임을 벗어나지 않는다', async () => {
  const { CONTENT_BOX } = await import('../src/assets/contract.js');
  for (const [name, box] of Object.entries(CONTENT_BOX)) {
    const [, , vw, vh] = CONTRACT[name].viewBox.split(/\s+/).map(Number);
    assert.ok(box.x0 >= 0 && box.y0 >= 0, `${name}: 그림이 프레임 왼쪽·위로 나갑니다`);
    assert.ok(box.x1 <= vw && box.y1 <= vh,
      `${name}: 그림이 프레임 밖으로 나갑니다 (${box.x1}×${box.y1} > ${vw}×${vh})`);
    assert.ok(box.x1 > box.x0 && box.y1 > box.y0, `${name}: 그려진 범위가 비었습니다`);
  }
});

test('등록된 애셋마다 CONTENT_BOX 가 있다', async () => {
  const { CONTENT_BOX } = await import('../src/assets/contract.js');
  for (const name of Object.keys(ASSETS)) {
    assert.ok(CONTENT_BOX[name], `${name}: CONTENT_BOX 가 없습니다 — 잡는 영역을 프레임으로 재게 됩니다`);
  }
});

/* ---------------- 실험대 배경 — **여덟이 같은 그림을 쓴다** ---------------- */

/*
 * 이 아래 둘은 **banana-lab 이 정본**이다 (`src/assets/bench.js` 도 그 파일을 그대로 쓴다).
 * 여덟 실험이 제각각 손대다 실험대와 선반이 다 달라졌고, 선생님이 그것을 잡으셨다.
 * 여기서 고칠 일이 생기면 **정본에서 고치고 여덟에 내려보낸다.**
 */

test('걷어낸 부속이 되살아나지 않았다 — 콘센트 · 기둥 · 밸브 · 서랍', () => {
  /*
   * ── 이 검사가 한 번 헛발질했다 ────────────────────────────────
   * 처음에는 「금속색을 안 쓴다」 로 적었다. 넷이 다 금속색이었으니 그때는 맞았다.
   * 그런데 참고 이미지대로 **상판을 밝은 회색(metal)** 으로, **선반 브래킷을 금속**으로
   * 다시 그리자 이 검사가 물었다 — **지킬 것은 색이 아니라 그 물건들이었는데** 색을 재고
   * 있었다. 검사가 맞는 일을 막아서면 사람이 검사를 끄고, 그러면 진짜도 같이 못 잡는다.
   *
   * 그래서 **그 넷이 있던 자리와 모양**을 잰다.
   */
  const svg = ASSETS.bench.render({});

  // ① 콘센트 구멍은 이 배경에서 원을 쓰던 **유일한** 것이었다.
  assert.equal(/<circle/.test(svg), false,
    '실험대 배경에 원이 있습니다 — 콘센트 구멍이 되살아났습니다');

  // ② 콘센트·가스 밸브·서비스 채널이 있던 벽 띠. 지금은 **비어 있어야** 한다.
  //    선반이 둘이 되면서 띠가 좁아졌다 — 아래 선반이 y=105~116 을 쓴다.
  //    정본과 같은 범위(95~104)를 쓴다. 좌표는 여덟이 같은 그림이라 정본에서 따온다.
  const shapes = [
    ...[...svg.matchAll(/<(?:rect|polygon|line)\b[^>]*>/g)].map((m) => m[0]),
  ].filter((tag) => {
    const ys = [...tag.matchAll(/(?:\by|\by1|\by2)="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    for (const [, list] of tag.matchAll(/points="([^"]+)"/g)) {
      const n = list.trim().split(/[\s,]+/).map(Number);
      for (let k = 1; k < n.length; k += 2) ys.push(n[k]);
    }
    const h = Number(tag.match(/(?<![-\w])height="([\d.]+)"/)?.[1] ?? 0);
    if (ys.length === 0) return false;
    return Math.min(...ys) >= 95 && Math.max(...ys) + h <= 104;
  });
  assert.deepEqual(shapes, [],
    '뒷벽 한가운데에 도형이 있습니다 — 콘센트·가스 밸브·서비스 채널을 걷어낸 자리입니다');

  // ③ 서랍 손잡이는 둥근 모서리의 납작한 막대였다. 캐비닛 안에 그런 것이 없어야 한다.
  const surface = svg.slice(svg.indexOf('<g id="surface"'), svg.indexOf('</g>', svg.indexOf('<g id="surface"')));
  assert.equal(/rx="1\.5"/.test(surface), false,
    '캐비닛에 서랍 손잡이가 되살아났습니다');
});

/** 색의 밝기. 「누운 면이 더 밝은가」 를 재려면 이름이 아니라 값으로 봐야 한다. */
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

test('선반과 작업면이 「누운 면 + 서 있는 면」 으로 서 있다', () => {
  /*
   * 앞에서 본 네모만 쌓아서는 아무리 칠해도 평평하다. 실제로 두 번 그렇게 만들었다.
   *
   * 입체는 **면이 둘**일 때 생긴다 — 물건이 딛고 선 **누운 면**이 뒤로 물러나고,
   * 그 앞으로 **서 있는 면**(두께)이 떨어진다. 그리고 누운 면은 **빛을 더 받는다.**
   * 위아래를 뒤집으면 다시 평평해지는데, 두 색이 다 팔레트 안이라 `check:art` 는
   * 초록불을 낸다 — 그래서 여기서 잰다.
   *
   * 누운 면은 #room 에 있다. #shelf·#surface 의 맨 위 y 는 **물건이 서는 선**이고
   * (바로 위 검사), 그 위로 뻗는 면을 그 안에 넣으면 선이 밀려 올라가 물건이 전부 뜬다.
   */
  const svg = ASSETS.bench.render({});
  const shapes = [
    ...[...svg.matchAll(/<polygon[^>]*points="([^"]+)"[^>]*fill="(#[0-9A-Fa-f]{6})"/g)]
      .map((m) => ({ ys: m[1].trim().split(/[\s,]+/).map(Number).filter((_, i) => i % 2), fill: m[2] })),
    ...[...svg.matchAll(/<rect[^>]*\by="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*fill="(#[0-9A-Fa-f]{6})"/g)]
      .map((m) => ({ ys: [Number(m[1]), Number(m[1]) + Number(m[2])], fill: m[3] })),
  ];

  for (const [name, line] of [['선반', CONTRACT.bench.landmarks.shelfTopY],
                              ['작업면', CONTRACT.bench.landmarks.surfaceFrontY]]) {
    // 누운 면 — 앞 모서리가 물건이 서는 선에 닿고, 거기서 **뒤로(위로)** 물러난다.
    const deck = shapes.find((sh) => sh.ys.includes(line) && Math.min(...sh.ys) < line);
    assert.ok(deck, `${name}에 누운 면이 없습니다 — 앞에서 본 네모뿐이라 평평해 보입니다`);

    // 서 있는 면 — 그 선에서 아래로 떨어지는 두께.
    const front = shapes.find((sh) => Math.min(...sh.ys) === line && Math.max(...sh.ys) > line);
    assert.ok(front, `${name}에 서 있는 면(두께)이 없습니다`);

    assert.ok(lum(deck.fill) > lum(front.fill),
      `${name}의 누운 면(${deck.fill})이 서 있는 면(${front.fill})보다 어둡습니다`
      + ' — 누운 면이 빛을 더 받습니다. 위아래가 뒤집혔습니다');
  }
});
