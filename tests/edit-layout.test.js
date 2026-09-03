/**
 * **배치 편집 모드는 x 와 y 를 **둘 다** 숫자로 옮길 수 있어야 한다** (사장님 지시 2026-09-03).
 *
 * 끌기는 원래 두 축 다 됐지만, 표에는 x 만 있었고 값을 직접 칠 길이 없었다. 1 mm 를 맞추려면
 * 화면을 확대했다 줄였다 하며 손으로 끄는 수밖에 없었다.
 *
 * 이 검사는 **사이트 것**이다 — 여덟 실험이 같은 편집 화면을 쓰므로 하나가 빠지면
 * 그 실험만 조용히 예전 모양으로 남는다. 소스를 읽어 판정한다 (브라우저 없이 도는 검사).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const at = (p) => new URL(`../${p}`, import.meta.url);
const EXPERIMENTS = readdirSync(at('experiments'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name);

const benches = EXPERIMENTS.map((id) => [id, readFileSync(at(`experiments/${id}/src/ui/bench.js`), 'utf8')]);

test('실험이 하나 이상 있다 (앞 조건 — 없으면 아래가 아무것도 안 잰다)', () => {
  assert.ok(benches.length > 0);
});

test('편집 표에 x·y 입력칸이 둘 다 있다', () => {
  for (const [id, src] of benches) {
    assert.match(src, /numCell\(it, 'x'\)/, `${id}: 편집 표에 x 입력칸이 없습니다`);
    assert.match(src, /numCell\(it, 'y'\)/, `${id}: 편집 표에 y 입력칸이 없습니다 — x 만 고칠 수 있습니다`);
  }
});

test('입력칸에 친 값이 물건 자리에 반영된다', () => {
  for (const [id, src] of benches) {
    const handler = src.match(/#edit-rows'\)\.addEventListener\('input',[\s\S]*?\n    \}\);/)?.[0] ?? '';
    assert.ok(handler, `${id}: 입력칸을 듣는 자리가 없습니다 — 숫자를 쳐도 아무 일이 안 일어납니다`);
    assert.match(handler, /item\[input\.dataset\.axis\] = v/, `${id}: 친 값을 물건에 넣지 않습니다`);
    // 실험대 밖으로 나가지 않게 잡아 주는 것은 끌 때와 같은 함수여야 한다.
    assert.match(handler, /placeFreely\(item\)/, `${id}: 친 값이 실험대 밖으로 나갈 수 있습니다`);
    assert.match(handler, /renderTokens\(\)/, `${id}: 숫자를 쳐도 화면이 안 움직입니다`);
  }
});

test('타이핑 중인 칸의 값을 덮어쓰지 않는다', () => {
  // 덮어쓰면 커서가 튀어 두 자리 수를 칠 수가 없다. 실제로 그렇게 깨진다.
  for (const [id, src] of benches) {
    assert.match(src, /document\.activeElement !== input/,
      `${id}: 표를 다시 칠할 때 지금 치고 있는 칸까지 덮어씁니다`);
  }
});

test('물건에 붙는 이름표가 x 와 y 를 함께 말한다', () => {
  for (const [id, src] of benches) {
    const tag = src.match(/class="edit-x-tag">([^<]*)</)?.[1];
    if (!tag) continue;   // 이름표가 없는 실험은 잴 것이 없다
    assert.match(tag, /item\.x[\s\S]*item\.y/, `${id}: 이름표가 x 만 말합니다 — 스크린샷 한 장으로 좌표가 전달되지 않습니다`);
  }
});
