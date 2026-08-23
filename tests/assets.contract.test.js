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

test('시드가 다르면 그림도 달라진다', () => {
  const banana = ASSETS.banana;
  const a = banana.render({ ripe: 0.9, seed: 1 });
  const b = banana.render({ ripe: 0.9, seed: 2 });
  assert.notEqual(a, b, '시드가 반영되지 않으면 모둠마다 같은 그림이 나옵니다');
});

test('계약에 없는 속성을 바꾸려 하면 막는다', () => {
  assert.equal(isMutable('banana', '#peel', 'fill'), true);
  assert.equal(isMutable('banana', '#peel', 'd'), false, '패스 데이터는 코드가 바꾸는 대상이 아닙니다');
  assert.equal(isMutable('banana', '#stem', 'fill'), false);
});

test('requiredNodes 는 필수 노드만 돌려준다', () => {
  const nodes = requiredNodes('banana');
  assert.ok(nodes.includes('#peel'));
  assert.ok(nodes.includes('#peel-strips'));
  assert.equal(requiredNodes('slide').includes('#label'), false, 'required:false 는 빠져야 합니다');
});
