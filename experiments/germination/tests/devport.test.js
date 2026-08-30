/**
 * 검사 스크립트가 **자기 클론의** 개발 서버를 보는가.
 *
 * 실험마다 저장소를 통째로 복제해 여러 세션이 동시에 돈다. 포트가 겹치면 두 번째 세션의
 * `npm run dev` 는 옆 포트로 밀려나는데, 스크립트에 주소가 박혀 있으면 **남의 앱을
 * 검사하고 초록불을 낸다.** 못 잡는 것보다 나쁘다 — 잡았다고 착각하게 만든다.
 *
 * 그래서 주소는 `dev-port.js` 한 곳에서만 나온다. 이 검사는 누군가 다시 주소를 박는 것을
 * 막는다.
 *
 * ★ **「문서는 대상이 아니다 — 기계가 여는 것만 본다」고 여기 적혀 있었다.** 그 면제가
 *   틀렸다. 선생님은 `PLAYTEST.md` 를 **보면서** 플레이하신다. 문서의 주소가 죽으면
 *   기계는 아무 말도 안 하고 **사람이 막힌다.** 실제로 `NEW-EXPERIMENT.md` 에
 *   `localhost:5173`(다른 랩의 기본 포트)이 남아 있었다.
 *
 *   면제 선언은 근거가 사라져도 남는다. 그리고 읽는 사람은 **그 자리를 아예 안 본다.**
 *   (허브가 catalase 에서 찾은 얼굴 — 820 px 고정을 걷어냈는데 면제 주석만 남아 있던 것)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEV_PORT, PREVIEW_PORT, devUrl, previewUrl } from '../../../dev-port.js';

const SCRIPTS = fileURLToPath(new URL('../../../scripts/', import.meta.url));

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

/**
 * **문서에 적힌 주소가 죽어 있지 않은가.**
 *
 * 포트는 `dev-port.js` 하나가 출처인데, 문서는 그 숫자를 **손으로** 적는다.
 * `dev-port.js` 를 고치는 사람은 문서를 안 고치고, 그러면 문서를 보고 여는 사람만 막힌다.
 * 검사는 초록불이다 — **기계는 문서를 안 열기 때문이다.**
 *
 * `docs/banana-*` 는 복제 전 실험의 기록이라 이 실험의 사실이 아니다(CLAUDE.md).
 * 그래서 대상에서 뺀다 — 다만 **몇 개를 봤는지 세어** 나중에 조용히 좁혀지지 않게 한다.
 */
test('문서에 적힌 포트가 전부 dev-port.js 에서 나온 것이다', () => {
  /*
   * ★ **사이트 뿌리부터 훑는다.** 따로 서 있던 시절에는 저장소 뿌리가 곧 이 실험이라
   *   `../` 면 됐다. 합친 뒤로 `README`·`AGENTS`·작업 카드는 **사이트 뿌리**에 있고
   *   이 폴더에는 `PLAYTEST.md` 와 `docs/` 뿐이다 — `../` 로 두면 볼 것이 거의 없어져
   *   앞 조건이 먼저 운다. (실제로 그렇게 울어서 알았다. 좁아진 줄 모르고 지나갈 뻔했다)
   *   `dev-port.js` 도 사이트 것이므로 재는 범위도 사이트가 맞다.
   *   (합치기 5단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
   */
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const docs = [];
  const walk = (dir) => {
    for (const e of readdirSync(ROOT + dir, { withFileTypes: true })) {
      const rel = dir + e.name;
      if (rel.startsWith('docs/banana')) continue;   // 복제 전 실험의 기록 — 이 실험의 사실이 아니다
      /*
       * **감사 기록은 「그때 무엇이 일어났는가」다 — 지금 열라는 안내가 아니다.**
       * `tasks/AUDIT-parallel.md` 는 클론 두 벌(5174·5176)을 띄워 본 그날의 기록이고,
       * 붙여 넣은 터미널 출력까지 들어 있다. 숫자를 지금 포트로 갈면 **기록이 거짓이 된다.**
       * 그래서 대상에서 빼되, 아래 앞 조건이 「조용히 좁아졌는가」를 계속 지킨다.
       * (합치기 5단계, 2026-08-30)
       */
      if (/^tasks\/AUDIT-/.test(rel)) continue;
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        walk(`${rel}/`);
      } else if (e.name.endsWith('.md')) docs.push(rel);
    }
  };
  walk('');

  // [앞 조건] 문서를 못 찾으면 「0곳 중 0곳이 맞다」로 통과한다.
  assert.ok(docs.length >= 5, `읽은 문서가 ${docs.length}개뿐입니다 — 대상이 좁혀졌는지 보세요`);
  const withPort = docs.filter((f) => /localhost:\d+/.test(readFileSync(ROOT + f, 'utf8')));
  assert.ok(withPort.length >= 3, `주소가 적힌 문서가 ${withPort.length}개뿐입니다 — 찾는 방법이 죽었는지 보세요`);

  const allowed = new Set([String(DEV_PORT), String(PREVIEW_PORT)]);
  const offenders = [];
  for (const f of withPort) {
    readFileSync(ROOT + f, 'utf8').split('\n').forEach((line, i) => {
      for (const [, port] of line.matchAll(/localhost:(\d+)/g)) {
        if (!allowed.has(port)) offenders.push(`${f}:${i + 1}  localhost:${port}`);
      }
    });
  }
  assert.deepEqual(offenders, [], [
    `문서에 ${DEV_PORT}·${PREVIEW_PORT} 이 아닌 주소가 적혀 있습니다 — 그 주소로는 안 열립니다.`,
    ...offenders.map((o) => `  ${o}`),
    `  ★ 먼저 **왜 다른지** 보세요 — 포트를 바꾼 것이 맞다면 dev-port.js 가 이미 바뀌었을 테니`,
    `    문서의 그 숫자를 ${DEV_PORT} 로 바꾸시면 됩니다.`,
  ].join('\n'));
});
