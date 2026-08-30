/**
 * 매니페스트가 합칠 때 쓸 만한 상태인가.
 *
 * 이 파일은 화면에 안 쓰이므로 **아무도 깨진 것을 모른다.** 실험 일곱 개가 각자 채워
 * 돌아온 뒤 합치는 자리에서야 알게 되는데, 그때는 일곱 개를 동시에 고쳐야 한다.
 * 그래서 여기서 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifest, validateManifest, SKELETONS } from '../src/manifest.js';
import { UI } from '../src/ui/strings.js';

test('이 실험의 매니페스트가 규약을 지킨다', () => {
  assert.deepEqual(validateManifest(manifest), []);
});

test('제목이 화면과 어긋나지 않는다', () => {
  // 두 곳에 적어 두면 한쪽만 고치는 날이 온다. 목록의 제목과 앱의 제목이 다르면
  // 학생이 링크를 열고 "내가 눌러야 할 게 이거 맞나" 를 한 번 더 생각한다.
  assert.equal(manifest.title, UI.appTitle);
});

test('검사기가 실제로 걸러 낸다', () => {
  const bad = (patch) => validateManifest({ ...manifest, ...patch });
  assert.ok(bad({ id: 'bio1-osmosis' }).some((m) => m.includes('교과 접두사')));
  assert.ok(bad({ id: 'Banana Lab' }).length > 0);
  assert.ok(bad({ skeleton: 'made-up' }).some((m) => m.includes('모르는 뼈대')));
  assert.ok(bad({ curriculum: [] }).length > 0);
  assert.ok(bad({ curriculum: [{ school: '대', course: 'x', page: null }] }).length > 0);
  // 쪽수를 모를 때 null 은 통과해야 한다 — 그래야 지어내지 않는다.
  assert.deepEqual(bad({ curriculum: [{ school: '중', course: '과학', page: null }] }), []);
});

test('뼈대 목록이 비어 있지 않고 설명이 붙어 있다', () => {
  const names = Object.keys(SKELETONS);
  assert.ok(names.length >= 1);
  for (const n of names) {
    assert.match(n, /^[a-z][a-z0-9-]*$/, `뼈대 이름 규약 위반: ${n}`);
    assert.ok(SKELETONS[n].length > 0, `${n} 에 설명이 없습니다`);
  }
});

/**
 * 카드 한 문장이 **답을 먼저 말하지 않는가.**
 *
 * 목록 화면은 실험을 고르는 자리다. 거기서 결과를 읽으면 학생은 실험하기 전에 답을 안다.
 * 「가장 빠른 조건」을 **모형에서 실제로 뽑아** 그 값이 문장에 있는지 본다 —
 * 손으로 「37」을 적어 두면 최적 온도가 바뀌었을 때 이 검사가 조용히 헛돈다.
 */
test('카드 한 문장에 결과가 적혀 있지 않다', async () => {
  const { gasVolume, OBSERVE_LIMIT_MIN } = await import('../src/sim/fermentation.js');
  const { CHOICES } = await import('../src/sim/state.js');
  for (const key of ['tempC', 'glucosePct']) {
    let best = null;
    let bestMl = -1;
    for (const v of CHOICES[key]) {
      const ml = gasVolume({ [key]: v }, OBSERVE_LIMIT_MIN);
      if (ml > bestMl) { bestMl = ml; best = v; }
    }
    assert.ok(!manifest.summary.includes(String(best)),
      `카드 한 문장이 가장 많이 나는 조건(${key} ${best})을 먼저 말합니다`);
  }
});

/* 「id 가 저장소 이름과 짝이 맞는다」는 **사이트 것**이다 — `package.json` 은
 * 사이트에 하나뿐이고 실험마다 다른 이름을 요구하면 반드시 모순이 된다.
 * `tests/site.test.js` 의 「실험마다 자기 이름을 아는 manifest 가 있다」가 갖는다. */

test('뼈대가 이 실험이 실제로 하는 일과 맞는다', () => {
  // 변인을 고르고 조건을 바꿔 되풀이하는 실험이다. 현미경도 분리도 없다.
  assert.equal(manifest.skeleton, 'variable-design');
});
