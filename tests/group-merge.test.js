/**
 * T35 — 여러 사람의 글을 초안 하나로. 같은 문장은 한 번만, 여럿이 쓴 문장이 앞에.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, similarity, mergeEntries, SAME_LINE } from '../packages/lab-kit/group/merge.js';
import { createGroupStore, recordOf, clampSize } from '../packages/lab-kit/group/store.js';

test('문장으로 나눈다 — 마침표·물음표·줄바꿈', () => {
  assert.deepEqual(
    splitSentences('청람색으로 변했다. 녹말이 있다는 뜻이다!\n지방은 적었다'),
    ['청람색으로 변했다.', '녹말이 있다는 뜻이다!', '지방은 적었다']
  );
  assert.deepEqual(splitSentences('   '), []);
});

test('띄어쓰기·어미가 조금 달라도 같은 문장으로 본다', () => {
  assert.ok(similarity('청람색으로 변했다.', '청람색으로 변함') >= SAME_LINE);
  assert.ok(similarity('녹말립이 크고 빽빽했다', '녹말립이 크고빽빽했다.') >= SAME_LINE);
  assert.ok(similarity('청람색으로 변했다', '선홍색 방울이 드물게 보였다') < SAME_LINE);
});

test('같은 문장은 하나만 남고, 여럿이 쓴 문장이 앞에 온다', () => {
  const { sentences, draft } = mergeEntries([
    { nick: 'A', text: '지방 방울은 작고 드물었다. 청람색으로 변했다.' },
    { nick: 'B', text: '청람색으로 변함. 기포가 두 개 생겼다.' },
    { nick: 'C', text: '청람색으로 변했다. 지방 방울은 작고 드물었다.' },
  ]);
  assert.equal(sentences.length, 3);
  assert.deepEqual(sentences[0].by.sort(), ['A', 'B', 'C']);
  assert.deepEqual(sentences[1].by.sort(), ['A', 'C']);
  assert.deepEqual(sentences[2].by, ['B']);
  // 더 긴 표현이 남는다 — 「변함」이 아니라 「변했다」
  assert.match(sentences[0].text, /변했다/);
  assert.equal((draft.match(/청람색/g) ?? []).length, 1);
});

test('빈 글은 아무것도 만들지 않는다', () => {
  assert.deepEqual(mergeEntries([{ nick: 'A', text: '' }]), { sentences: [], draft: '' });
});

test('모둠 store — 같은 별명은 바꿔 넣고, 다른 실험은 담지 않고, 개인정보 칸이 없다', () => {
  const g = createGroupStore({ name: '바나나조', size: 4, role: 'leader', nick: '반장' });
  assert.equal(g.expected(), 3);
  assert.equal(g.addMember({ v: 1, exp: 'osmosis', nick: 'X', notes: {} }, { exp: 'banana' }).ok, false);
  assert.equal(g.addMember({ v: 1, exp: 'banana', nick: 'A', notes: { q2: '하나' } }, { exp: 'banana' }).ok, true);
  const r = g.addMember({ v: 1, exp: 'banana', nick: 'A', notes: { q2: '둘' } }, { exp: 'banana' });
  assert.equal(r.replaced, true);
  assert.equal(g.members().length, 1);
  assert.deepEqual(g.entriesFor('q2'), [{ nick: 'A', text: '둘' }]);
  assert.deepEqual(g.entriesFor('q3'), []);
  g.addMember({ nick: '', notes: { q2: 3 } });
  assert.equal(g.members()[1].nick, '모둠원 2');
  assert.equal(g.members()[1].notes.q2, '3');
  assert.ok(g.removeMember('A'));
  assert.equal(g.members().length, 1);
  for (const k of Object.keys(g.me)) assert.ok(!/school|name$|grade|number|class/i.test(k) || k === 'name');
  assert.deepEqual(Object.keys(g.me).sort(), ['name', 'nick', 'role', 'size']);
});

test('보낼 기록에는 노트 글과 점수뿐이다 — 되돌리기 기록·로그·시야 그림은 없다', () => {
  const state = {
    slides: { A: { big: 'thing' } },
    session: {
      level: 2, notes: { '1a': '적음', q2: '', 'q.a': '  ' }, history: [{}, {}], log: [{}],
      captures: [{ slide: 'B', objective: 40, focusErr: 0.1, seed: 5, bubbles: 2 }],
    },
  };
  const rec = recordOf(state, { nick: 'A', name: '조' }, { exp: 'banana', capScore: () => 77 });
  assert.deepEqual(rec, {
    v: 1, exp: 'banana', nick: 'A', group: '조', level: 2,
    notes: { '1a': '적음' },
    caps: [{ slide: 'B', objective: 40, score: 77 }],
  });
  assert.equal(JSON.stringify(rec).includes('history'), false);
  assert.equal(JSON.stringify(rec).includes('seed'), false);
});

test('인원은 2~8 로 접는다', () => {
  assert.equal(clampSize(1), 2);
  assert.equal(clampSize(99), 8);
  assert.equal(clampSize('abc'), 4);
  assert.equal(clampSize('5'), 5);
});
