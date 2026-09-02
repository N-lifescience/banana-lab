/**
 * QR·링크로 들어온 수업 코드(`?code=`)가 **보고서 창까지 가는가.**
 *
 * `report.js` 는 `open({ classCode })` 를 받을 준비가 돼 있었는데 `main.js` 가
 * `report.open()` 으로 빈손으로 불렀다 — 다른 여섯 실험은 넘기고 여기만 빠져 있었다.
 * QR 로 들어온 학생이 여섯 자리를 다시 쳐야 했다. 허브가 E2E 로 잡았다 (2026-09-02).
 *
 * `main.js` 는 모듈을 읽는 순간 `document` 를 만지므로 node 에서 import 할 수 없다.
 * 소스 문자열로 본다 — 부르는 모양과, 코드를 **숫자 여섯 자리로 다듬는 줄**이 있는지.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('main.js 가 report.open 에 주소의 수업 코드를 넘긴다', () => {
  assert.match(main, /report\.open\(\{\s*classCode:\s*classCodeFromUrl\(\)\s*\}\)/,
    'onReport 가 report.open({ classCode: classCodeFromUrl() }) 이어야 합니다 — 빈손으로 부르면 QR 코드가 버려집니다');
  assert.doesNotMatch(main, /report\.open\(\s*\)/, 'report.open() 을 빈손으로 부르는 곳이 남아 있습니다');
});

test('수업 코드는 주소의 code 에서 숫자만 여섯 자리로 다듬는다', () => {
  assert.match(main, /function classCodeFromUrl\(\)/);
  assert.match(main, /\.get\('code'\)/, '주소의 code 를 읽어야 합니다');
  assert.match(main, /replace\(\/\\D\/g,\s*''\)\.slice\(0,\s*6\)/, '숫자만 남기고 여섯 자리로 자르는 줄이 있어야 합니다 (report.js 와 같은 규칙)');
});
