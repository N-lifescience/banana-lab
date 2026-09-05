/**
 * T35 — 모둠장의 보고서에 별명 줄과 「모둠원별 기록」 절이 붙는다. 여덟 실험 다.
 * 이름·학번은 여전히 `who` 로만 들어간다 — 모둠 store 에는 그 칸이 없다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroupStore } from '../packages/lab-kit/group/store.js';

const EXPERIMENTS = ['banana', 'catalase', 'centrifuge', 'chromatography', 'fermentation', 'germination', 'micrometer', 'osmosis'];

for (const exp of EXPERIMENTS) {
  test(`${exp}: 모둠장 보고서에 별명·모둠원별 기록, 혼자 보고서에는 없다`, async () => {
    const { initialState } = await import(`../experiments/${exp}/src/sim/state.js`);
    const { buildSheet } = await import(`../experiments/${exp}/src/ui/report.js`);
    const g = createGroupStore({ name: '바나나조', size: 3, role: 'leader', nick: '반장' });
    g.addMember({ v: 1, exp, nick: '초록이', notes: { q2: '초록이가 쓴 정리 문장' } }, { exp });
    const st = initialState(1, undefined, 'group');
    const who = { school: '○○고', name: '홍길동', team: '바나나조' };
    const html = buildSheet(st, who, 'group', g);
    assert.match(html, /모둠원\(별명\)/);
    assert.match(html, /반장 · 초록이/);
    assert.match(html, /모둠원별 기록/);
    assert.match(html, /초록이가 쓴 정리 문장/);
    assert.match(html, /홍길동/);
    // 혼자 — 모둠 store 가 없어도, 종류가 solo 여도 아무것도 안 붙는다
    const solo = buildSheet(initialState(1, undefined, 'solo'), who, 'solo', null);
    assert.doesNotMatch(solo, /모둠원별 기록|모둠원\(별명\)/);
    const groupNoStore = buildSheet(st, who, 'group', null);
    assert.doesNotMatch(groupNoStore, /모둠원별 기록/);
  });
}
