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

/*
 * ★ **표의 행 열쇠를 `data-id` 로 두면 안 된다.**
 *   실험대의 물건도 `data-id` 를 쓴다. 편집 모드에서는 둘이 같은 화면에 있어서
 *   `[data-id="banana"]` 가 **물건과 표의 행 둘 다**에 걸린다 — 브라우저 검사가
 *   「하나를 가리켜야 하는데 둘이다」로 멎는다. `npm run check` 는 초록이라 안 잡힌다.
 *   (banana 점검 세션이 `scripts/check-bench.mjs` 가 서는 것으로 찾았다, 2026-09-03)
 */
test('편집 표의 행 열쇠가 물건의 열쇠와 부딪히지 않는다', () => {
  for (const [id, src] of benches) {
    assert.equal(/<tr data-id=/.test(src), false,
      `${id}: 표의 행이 data-id 를 씁니다 — 실험대 물건과 선택자가 부딪힙니다. data-row 를 쓰세요`);
    assert.match(src, /<tr data-row=/, `${id}: 표의 행에 열쇠가 없습니다`);
  }
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

/*
 * ── 시야 SVG 안에 주석을 넣지 않는다 ────────────────────────────────
 *
 * 보고서는 인쇄 직전에 시야 SVG 를 `<img>` 로 **구워서** 넣는다. 주석이 섞이면 그 이미지가
 * 로드에 실패하고, 굽기가 조용히 포기되어 SVG 그대로 남는다 — 화면에서는 멀쩡하고
 * **모바일 인쇄에서만** 시야가 까맣게 나온다. 단위 검사로는 안 보이고 브라우저 검사가 잡았다.
 * 여덟 실험이 같은 굽기 코드를 쓰므로 사이트가 지킨다. (2026-09-03)
 */
test('결과 렌더러가 내보내는 SVG 에 주석이 없다 (굽는 실험만)', () => {
  /*
   * **굽는 실험에만 해당한다.** 시야를 이미지로 굽지 않는 실험(catalase·fermentation)은
   * SVG 주석이 화면에만 남으므로 이 사고가 나지 않는다 — 안 나는 사고로 빨간불을 내면
   * 그 검사는 곧 꺼진다. 그래서 `svgToPng` 를 쓰는 실험만 잰다.
   */
  let looked = 0;
  for (const id of EXPERIMENTS) {
    const report = readFileSync(at(`experiments/${id}/src/ui/report.js`), 'utf8');
    if (!report.includes('svgToPng')) continue;
    looked++;
    const dir = at(`experiments/${id}/src/render/`);
    let files = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith('.js')); } catch { continue; }
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      // 템플릿 리터럴 안(= 내보내는 문자열)에 있는 `<!--` 만 본다. 코드 주석은 상관없다.
      for (const [, lit] of src.matchAll(/`([^`]*)`/g)) {
        assert.equal(lit.includes('<!--'), false,
          `${id}/src/render/${f} 이 SVG 안에 주석을 넣습니다 — 보고서의 시야가 그림으로 안 구워집니다.`
          + ' 설명은 코드 쪽에 적으세요.');
      }
    }
  }
  assert.ok(looked > 0, '굽는 실험을 하나도 못 찾았습니다 — 검사가 헛돌고 있습니다');
});
