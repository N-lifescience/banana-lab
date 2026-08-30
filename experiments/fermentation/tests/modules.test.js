/**
 * 모든 모듈이 실제로 **읽히는가**.
 *
 * 이 검사가 없어서 실제로 겪은 일: 테스트 140개가 전부 통과하는 동안 앱은 켜지지도 않았다.
 * `notebook.js` 의 HTML 주석 안에 백틱이 들어가 템플릿 문자열이 그 자리에서 끊겼는데,
 * 규칙 테스트는 `src/sim/` 만 불러오므로 `src/ui/` 가 깨진 것을 아무도 몰랐다.
 * 브라우저에서만 `SyntaxError: Unexpected identifier 'UI'` 로 드러났다.
 *
 * 그래서 여기서는 **모든 모듈을 한 번씩 불러 본다.** 구문 오류와 못 찾는 import 를 잡는다.
 * 모듈 최상위에서 DOM 을 건드리는 파일이 있으면 여기서 함께 터지는데, 그것도 규칙 위반이므로
 * (AGENTS.md §3.4) 잡히는 편이 맞다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src/', import.meta.url);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(`${dir}${e.name}/`));
    else if (e.name.endsWith('.js')) out.push(`${dir}${e.name}`);
  }
  return out;
}

const files = walk('');

test('src 아래 모든 모듈에 구문 오류가 없다', async () => {
  assert.ok(files.length > 15, `모듈을 못 찾았습니다 (${files.length}개)`);
  const broken = [];
  for (const f of files) {
    try {
      await import(new URL(f, ROOT).href);
    } catch (e) {
      // 진입점(main.js · harness.js)은 최상위에서 DOM 을 만진다 — 그것이 하는 일이다.
      // 여기서 보려는 것은 **파일이 파싱되는가** 이므로 실행 중 오류는 넘긴다.
      // 파싱 단계에서 나는 오류(SyntaxError · 못 찾는 import)만 실패로 본다.
      const parseFailed = e instanceof SyntaxError
        || e.code === 'ERR_MODULE_NOT_FOUND'
        || e.code === 'ERR_UNSUPPORTED_DIR_IMPORT';
      if (parseFailed) broken.push(`${f} — ${e.message.split('\n')[0]}`);
    }
  }
  assert.deepEqual(broken, [], `읽히지 않는 모듈이 있습니다:\n  ${broken.join('\n  ')}`);
});
