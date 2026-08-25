/**
 * 검사 스크립트가 **자기 클론의** 개발 서버를 보는가.
 *
 * 실험마다 저장소를 통째로 복제해 여러 세션이 동시에 돈다. 포트가 겹치면 두 번째 세션의
 * `npm run dev` 는 옆 포트로 밀려나는데, 스크립트에 주소가 박혀 있으면 **남의 앱을
 * 검사하고 초록불을 낸다.** 못 잡는 것보다 나쁘다 — 잡았다고 착각하게 만든다.
 *
 * 그래서 주소는 `dev-port.js` 한 곳에서만 나온다. 이 검사는 누군가 다시 주소를 박는 것을
 * 막는다. 사람이 손으로 여는 문서(`README.md` 등)는 대상이 아니다 — 기계가 여는 것만 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEV_PORT, PREVIEW_PORT, devUrl, previewUrl } from '../dev-port.js';

const SCRIPTS = fileURLToPath(new URL('../scripts/', import.meta.url));

test('개발 포트와 미리보기 포트가 겹치지 않는다', () => {
  assert.notEqual(DEV_PORT, PREVIEW_PORT);
  assert.equal(devUrl('/x'), `http://localhost:${DEV_PORT}/x`);
  assert.equal(previewUrl(), `http://localhost:${PREVIEW_PORT}`);
});

test('scripts 안에 localhost 주소를 박아 두지 않았다', () => {
  const offenders = [];
  for (const name of readdirSync(SCRIPTS)) {
    if (!name.endsWith('.mjs')) continue;
    const src = readFileSync(SCRIPTS + name, 'utf8');
    src.split('\n').forEach((line, i) => {
      // 주석은 사람이 읽는 안내다. 코드에서 실제로 쓰는 주소만 본다.
      const code = line.replace(/^\s*(\*|\/\/).*/, '');
      if (/localhost:\d+/.test(code)) offenders.push(`${name}:${i + 1}  ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [],
    `dev-port.js 의 devUrl()/previewUrl() 을 쓰세요:\n${offenders.join('\n')}`);
});
