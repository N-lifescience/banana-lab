/**
 * **규칙에 있는 조작이 화면에서 닿는가.**
 *
 * `rules.js` 에 손짓이 적혀 있고 단위 검사도 초록불인데 **화면 어디서도 그것을 부르지
 * 않는** 경우가 있다. 그러면 이런 일이 벌어진다:
 *
 *   · 먹통 훑기(「말없이 아무 일도 안 하는 조작이 있는가」)가 그 조작을 집어 오면,
 *     **애먼 곳에 말을 붙이게 된다** — 학생이 닿지도 못하는 자리다.
 *   · 규칙 문서가 「이럴 땐 이걸로 무르세요」라고 적어 두면 **그 문장이 거짓말이 된다.**
 *
 * 그래서 **규칙과 화면을 맞대 본다.** 소스에서 그 이름을 부르는 곳이 있는지 센다.
 * (옆 랩이 낸 것을 받아 넣었다. 그쪽은 스물다섯 가지 중 죽은 것이 0개였다.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ACTIONS } from '../src/sim/rules.js';

/*
 * ★ **이 검사가 도는 자리에서부터 센다 — 명령을 어디서 쳤는지가 아니라.**
 *   앞서 여기는 `walk('src')` 였다. 저장소 하나 = 실험 하나였을 때는 맞았지만,
 *   합친 뒤로 뿌리의 `src/` 는 **사이트의 것**(선생님 화면 진입점)이다.
 *   그대로 두면 남의 폴더를 훑고 **조작 스물한 개가 전부 「화면에서 안 부른다」**로 나온다.
 *   합치기 직전에는 뿌리에 `src/` 가 아예 없어서 터졌을 텐데, 지금은 **있는 채로 틀린다.**
 *   (합치기 5단계, 2026-08-30)
 */
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** `src/` 아래 자바스크립트를 전부 읽어 하나로 잇는다. 규칙 파일 자신은 뺀다. */
function uiSource() {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!name.endsWith('.js')) continue;
      if (p.endsWith(join('sim', 'rules.js'))) continue;   // 자기 자신은 부르는 곳이 아니다
      out.push(readFileSync(p, 'utf8'));
    }
  })(SRC);
  return out.join('\n');
}

/**
 * **아직 화면에 안 달린 것.** 지우지 않고 여기 적어 둔다 —
 * 적어 두지 않으면 「0건」이 되어 **없는 문제처럼 보인다.**
 *
 * `DELETE_TRIAL` — `docs/04-interaction-rules.md` 는 「시행을 잘못 기록했다」의 답으로
 * 이것을 적어 두었는데 **화면에는 지우는 길이 없다.** 되돌리기로 덮이긴 하지만
 * 3단계는 되돌리기가 **한 번뿐**이라(`UNDO_LIMITS`), 두 번째로 잘못 기록하면
 * 틀린 점이 그래프에 그대로 남는다. **달지 말지는 선생님이 정할 일**이라 손대지 않는다.
 */
const NOT_WIRED_YET = new Set(['DELETE_TRIAL']);

test('규칙에 있는 조작은 화면에서 닿는다 — 새로 죽은 것이 없다', () => {
  const src = uiSource();
  const dead = Object.keys(ACTIONS).filter((name) => !src.includes(`'${name}'`)
    && !src.includes(`"${name}"`));
  const fresh = dead.filter((name) => !NOT_WIRED_YET.has(name));
  assert.deepEqual(fresh, [],
    `화면에서 부르지 않는 조작입니다: ${fresh.join(' · ')}\n`
    + '  규칙에만 있고 화면에 없으면, 그 조작을 두고 하는 말은 전부 닿지 않는 곳을 가리킵니다.');
});

test('아직 안 단 것으로 적어 둔 조작은 실제로 아직 안 달려 있다', () => {
  // **목록이 낡으면 그것도 거짓말이다.** 달아 놓고 여기 남아 있으면 알려 준다.
  const src = uiSource();
  for (const name of NOT_WIRED_YET) {
    assert.ok(!src.includes(`'${name}'`) && !src.includes(`"${name}"`),
      `${name} 은 이제 화면에서 부릅니다 — NOT_WIRED_YET 에서 빼세요.`);
  }
});
