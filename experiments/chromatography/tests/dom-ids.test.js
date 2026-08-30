/**
 * 화면의 id 가 애셋 안의 id 와 부딪히지 않는가.
 *
 * ── 실제로 물린 것 ──────────────────────────────────────────────────
 * 하네스의 애셋 시트 칸이 `<div id="sheet">` 였는데, 거름종이 애셋 안에도
 * `<rect id="sheet">` 가 있었다. 애셋이 페이지에 먼저 그려지므로
 * `document.querySelector('#sheet')` 가 **그 사각형**을 집었고, 애셋 시트 열다섯 칸이
 * 종이 그림 속으로 들어갔다. **콘솔 에러는 한 줄도 없었다.**
 *
 * 애셋은 인라인 SVG 라 그 안의 id 가 문서 전체의 id 공간에 그대로 올라온다.
 * 애셋 쪽 이름(`#body`·`#cap`·`#ticks`)은 계약이라 못 바꾸므로, **화면 쪽 id 를 피한다.**
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTRACT } from '../src/assets/contract.js';

/**
 * 주석을 뺀 코드.
 *
 * **산문까지 훑으면 오탐이 온다.** 이 저장소에서 세 번 겪었다 — 상대 간격을 찾는 검사가
 * 좌표 0.5 에, 색소 표를 찾는 검사가 설명 주석에, id 를 찾는 검사가 "이 id 는 부딪힌다"
 * 라고 적어 둔 경고 주석에 걸렸다. 오탐이 한 번 나면 그 뒤로 아무도 그 검사를 안 믿는다
 * (PLAYBOOK §9-3).
 */
function code(file) {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/** 계약에 선언된 모든 애셋 노드 id (앞의 # 을 뗀 것) */
function assetNodeIds() {
  const ids = new Set();
  for (const spec of Object.values(CONTRACT)) {
    for (const sel of Object.keys(spec.nodes)) ids.add(sel.replace(/^#/, ''));
  }
  return ids;
}

/** HTML 파일에서 `id="..."` 를 뽑는다. 애셋은 자바스크립트가 나중에 넣으므로 여기 없다. */
function pageIds(file) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  return [...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
}

for (const file of ['index.html', 'harness.html']) {
  test(`${file} 의 id 가 애셋 노드 id 와 부딪히지 않는다`, () => {
    const asset = assetNodeIds();
    for (const id of pageIds(file)) {
      assert.equal(asset.has(id), false,
        `${file} 의 #${id} 가 애셋 안의 같은 id 와 부딪힙니다 — `
        + 'querySelector 가 애셋 쪽을 집어 화면이 에러 없이 조용히 틀립니다');
    }
  });
}

/**
 * 화면 코드가 **만드는** id 도 애셋 안의 id 와 부딪히면 안 된다.
 *
 * 조회는 `body.querySelector` 처럼 자기 영역 안에서만 하면 안전하지만, **`<label for="…">`
 * 는 문서 전체에서 찾는다.** 확대 뷰의 `<label for="origin">` 이 거름종이 그림의
 * `<path id="origin">` 을 가리키면 손잡이의 이름이 사라진다 —
 * 화면은 멀쩡해 보이고 스크린리더에서만 틀린다.
 */
test('화면 코드가 만드는 id 가 애셋 노드 id 와 부딪히지 않는다', () => {
  const asset = assetNodeIds();
  for (const file of ['src/ui/zoom.js', 'src/ui/bench.js', 'src/ui/notebook.js', 'src/ui/report.js']) {
    const src = code(file);
    // 템플릿 문자열 안의 `id="…"`.
    //
    // **이 검사가 못 보는 것:** 값이 통째로 보간된 자리(`id="${zid(name)}"`)는 정적으로
    // 읽을 수 없다. 그런 자리는 아래 「확대 뷰는 접두사를 붙인다」 가 대신 지킨다.
    // 못 보는 것을 적어 두지 않으면 다음 사람이 이 검사를 실제보다 더 믿는다.
    for (const m of src.matchAll(/\bid="([A-Za-z][A-Za-z0-9_-]*)"/g)) {
      assert.equal(asset.has(m[1]), false,
        `${file} 이 #${m[1]} 을 만듭니다 — 애셋 안의 같은 id 와 부딪힙니다`);
    }
    // `for="…"` 는 문서 전체에서 찾으므로 특히 위험하다.
    for (const m of src.matchAll(/\bfor="([A-Za-z][A-Za-z0-9_-]*)"/g)) {
      assert.equal(asset.has(m[1]), false,
        `${file} 의 <label for="${m[1]}"> 이 애셋 안의 도형을 가리킵니다`);
    }
  }
});

test('화면 코드가 찾는 id 도 애셋 노드 id 와 부딪히지 않는다', () => {
  // 화면이 `document.querySelector('#…')` 로 찾는 것들. 애셋 안을 뒤지는
  // `root.querySelector` 는 애셋 루트에 갇혀 있으므로 여기서 보지 않는다.
  const asset = assetNodeIds();
  for (const file of ['src/harness.js', 'src/main.js']) {
    const src = code(file);
    for (const m of src.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)|querySelector\('#([A-Za-z0-9_-]+)'\)/g)) {
      const id = m[1] ?? m[2];
      assert.equal(asset.has(id), false,
        `${file} 이 #${id} 를 문서 전체에서 찾습니다 — 애셋 안의 같은 id 를 집게 됩니다`);
    }
  }
});

/**
 * 확대 뷰의 id 는 보간이라 위 검사가 못 본다. **접두사가 살아 있는지**를 따로 본다.
 *
 * 접두사를 지워 보면 위 검사는 그대로 초록불이고 이 검사만 빨간불이 된다 —
 * 그래서 둘 다 있어야 한다.
 */
test('확대 뷰는 자기가 만드는 id 에 접두사를 붙인다', () => {
  const src = code('src/ui/zoom.js');
  const m = src.match(/const ZID = '([^']*)'/);
  assert.ok(m, 'zoom.js 에 ZID 접두사가 없습니다');
  assert.ok(m[1].length > 0,
    'ZID 가 비었습니다 — 확대 뷰의 #origin·#spot 이 거름종이 애셋의 도형과 부딪힙니다');
  // 조회하는 쪽도 같은 통로를 쓰는가. 한쪽만 붙이면 아무것도 못 찾는다.
  assert.equal(/body\.querySelector\('#/.test(src), false,
    '확대 뷰가 접두사 없이 id 를 조회합니다');
});
