/**
 * T36 — 실제 실험 연습 모드: 피드백 기록과 피드백 노트 종이.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFeedbackLog } from '../packages/lab-kit/practice/feedback.js';
import { buildFeedbackSheet } from '../packages/lab-kit/practice/panel.js';

const ADVICE = { excess: '두 방울이 가장 선명하게 보입니다.', bubbles: '덮개 유리를 들어 45°로 천천히 다시 덮어 보세요.' };

test('뜻대로 안 된 것과 고칠 것이 있는 것만 담고, 같은 것은 횟수만 는다', () => {
  const f = createFeedbackLog({ adviceOf: (t) => ADVICE[t] ?? null });
  assert.equal(f.add({ message: '스포이트에 담았습니다.', outcome: 'ok', tag: null }), null, '잘된 것은 안 담는다');
  assert.equal(f.add({ message: '보고서를 만들 수 있습니다', outcome: 'ok', tag: 'report-ready' }), null);
  f.add({ message: '세 방울째 — 넘칩니다.', outcome: 'ok', tag: 'excess' });
  f.add({ message: '네 방울째 — 넘칩니다.', outcome: 'ok', tag: 'excess' });
  f.add({ message: '핀셋이 비어 있습니다.', outcome: 'happened', tag: null });
  f.add({ message: '핀셋이 비어 있습니다.', outcome: 'happened', tag: null });
  f.add({ message: '기포가 3개 생겼습니다.', outcome: 'ok', tag: 'bubbles' });
  const items = f.entries();
  assert.equal(items.length, 3);
  assert.equal(items[0].count, 2);
  assert.equal(items[0].message, '네 방울째 — 넘칩니다.', '최근 문장이 남는다');
  assert.equal(items[0].advice, ADVICE.excess);
  assert.equal(items[1].count, 2);
  assert.equal(items[1].advice, null);
  assert.deepEqual(f.checklist(), [ADVICE.excess, ADVICE.bubbles], '조언 없는 것은 목록에 안 든다');
});

test('종이에는 잘 안 된 것·횟수·다음엔 이렇게·내가 지킬 것이 실리고, 안 넣은 이름 칸은 없다', () => {
  const f = createFeedbackLog({ adviceOf: (t) => ADVICE[t] ?? null });
  f.add({ message: '세 방울째 — 넘칩니다.', outcome: 'ok', tag: 'excess' });
  const html = buildFeedbackSheet({ feedback: f, appTitle: '바나나', levelName: '1단계' }, { name: '홍길동', school: '' }, '두 방울만.\n45°로.');
  assert.match(html, /피드백 노트 — 바나나/);
  assert.match(html, /세 방울째/);
  assert.match(html, /두 방울이 가장 선명하게/);
  assert.match(html, /☐ 두 방울만\./);
  assert.match(html, /☐ 45°로\./);
  assert.match(html, /홍길동/);
  assert.doesNotMatch(html, /<dt>학교<\/dt>/);
  const empty = buildFeedbackSheet({ feedback: createFeedbackLog(), appTitle: '바나나' }, {}, '');
  assert.match(empty, /잘 안 된 조작이 없었습니다/);
  assert.match(empty, /적지 않았습니다/);
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  const f = createFeedbackLog();
  f.add({ message: '<img src=x onerror=1>', outcome: 'happened' });
  const html = buildFeedbackSheet({ feedback: f, appTitle: '바나나' }, { name: '<b>x</b>' }, '<script>1</script>');
  assert.doesNotMatch(html, /<img|<script|<b>x/);
});

test('피드백 노트는 이름을 상태에도 저장소에도 보내지 않는다', () => {
  const src = readFileSync(new URL('../packages/lab-kit/practice/panel.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\.dispatch\(/.test(src));
  for (const sink of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!src.includes(sink), `panel.js 가 ${sink} 를 씁니다`);
  }
  assert.ok(/afterprint/.test(src), '인쇄가 끝나면 지워야 한다');
});
