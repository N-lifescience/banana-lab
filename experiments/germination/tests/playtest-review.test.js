/**
 * 플레이테스트에서 잡은 것들 — 되돌리면 빨간불이 나야 한다 (`PLAYTEST-REVIEW.md`).
 *
 * 전부 브라우저에서 학생 자리로 끝까지 플레이하다 나온 것이다. 검사는 전부 초록불이었고
 * 콘솔 에러도 없었다. 그래서 여기 한 파일에 모아 둔다 — 다음 사람이 「왜 이렇게 돼 있나」를
 * 코드가 아니라 실패 문장으로 읽게.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepNotesWritten, groupNotesEmpty, QUESTION_A_STEP } from '../src/ui/notebook.js';
import { resultNotes, co2Ticks, renderGraph, TIME_SLACK_MIN } from '../src/render/graph.js';
import { initialState, chamberViews, comparisonKind, mismatches } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { OBSERVE_LIMIT_MIN } from '../src/sim/metabolism.js';
import { gradeQuestion } from '../src/ui/grading.js';
import { dropTable, tapTable } from '../src/ui/bench.js';
import { UI } from '../src/ui/strings.js';

const play = (st, steps) => steps.reduce((s, [type, payload]) => reduce(s, { type, payload }).state, st);
const scoop = (kind, ch, n = 2) => Array.from({ length: n }, () => [['SCOOP_BEANS', { kind }], ['POUR_BEANS', { chamber: ch }]]).flat();
const prepared = (level = 1) => play(initialState(level, 7), [
  ...scoop('sprout', 'L'), ...scoop('dry', 'R'),
  ['POUR_BTB', { chamber: 'L' }], ['POUR_BTB', { chamber: 'R' }],
  ['INSTALL_SENSOR', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'R' }],
  ['SEAL', { chamber: 'L' }], ['SEAL', { chamber: 'R' }],
]);
const withNotes = (st, notes) => ({ ...st, session: { ...st.session, notes: { ...st.session.notes, ...notes } } });
const notesOf = (st) => resultNotes(chamberViews(st), comparisonKind(st), mismatches(st)).join('\n');

/* ---------------- STEP 5 는 질문 ⓐ 까지 적어야 접힌다 ---------------- */

const stepA = UI.protocol.find((g) => g.id === QUESTION_A_STEP);
const boxKeys = stepA.steps.map((s, i) => (s.note ? `${stepA.id}${String.fromCharCode(97 + i)}` : null)).filter(Boolean);

test('1단계 — STEP 5 의 관찰 기록을 다 적어도 질문 ⓐ 가 비어 있으면 아직 안 적은 것이다', () => {
  // 두 칸을 적고 손을 떼는 순간 STEP 5 가 접혀, 그 밑의 질문 ⓐ 를 한 번도 못 본 채 지나갔다.
  const filled = withNotes(initialState(1), Object.fromEntries(boxKeys.map((k) => [k, '왼쪽이 더 변했다'])));
  assert.equal(stepNotesWritten(filled, stepA), false, 'ⓐ 를 안 적었는데 STEP 5 가 다 적은 것으로 잡힙니다 — 접히면서 ⓐ 가 사라집니다');
  assert.equal(groupNotesEmpty(filled, stepA), true, '「기록이 비었습니다」 배지가 ⓐ 를 안 셉니다');
  const withA = withNotes(filled, { 'q.a': '발아 콩이 호흡해서' });
  assert.equal(stepNotesWritten(withA, stepA), true, 'ⓐ 까지 적었는데도 안 넘어갑니다');
  assert.equal(groupNotesEmpty(withA, stepA), false);
});

test('3단계 — 목표 칸을 적어도 질문 ⓐ 가 비어 있으면 STEP 5 는 아직이다', () => {
  const filled = withNotes(initialState(3), { [stepA.id]: '두 챔버를 지켜봤다' });
  assert.equal(stepNotesWritten(filled, stepA), false);
  assert.equal(stepNotesWritten(withNotes(filled, { 'q.a': '호흡 때문' }), stepA), true);
});

test('질문 ⓐ 가 없는 STEP 은 이 규칙과 무관하다', () => {
  const other = UI.protocol.find((g) => g.id !== QUESTION_A_STEP && g.steps.some((s) => s.note));
  const keys = other.steps.map((s, i) => (s.note ? `${other.id}${String.fromCharCode(97 + i)}` : null)).filter(Boolean);
  const filled = withNotes(initialState(1), Object.fromEntries(keys.map((k) => [k, '적었다'])));
  assert.equal(stepNotesWritten(filled, other), true, `STEP ${other.id} 이 ⓐ 없이도 안 넘어갑니다`);
});

test('4쪽 안내가 「앞 STEP 의 기록을 적어야 열린다」를 말한다', () => {
  // 「다른 STEP 도 눌러서 열 수 있습니다」라고만 하고 실제로는 잠겨 있었다.
  assert.match(UI.notebook.stepLeadIn, /기록을 적어야 열립니다/, '잠금이 있다는 것을 안내가 말하지 않습니다');
});

/* ---------------- 잰 시간 1분 차이는 어긋난 것이 아니다 ---------------- */

test('두 챔버를 차례로 시작해 1분 어긋난 것은 「잰 시간이 다릅니다」가 아니다', () => {
  // 화면의 1초가 1분이라 왼쪽 시작 → 오른쪽 시작 사이에 늘 1분이 흐른다. 정상 경로의
  // 거의 모든 기록에 이 말이 붙어 있었다.
  const st = play(prepared(), [['START', { chamber: 'L' }], ['TICK', { minutes: 1 }], ['START', { chamber: 'R' }], ['TICK', { minutes: 10 }]]);
  assert.equal(st.chambers.L.elapsedMin - st.chambers.R.elapsedMin, 1);
  assert.ok(!notesOf(st).includes('잰 시간이 다릅니다'), notesOf(st));
});

test('그보다 크게 어긋나면 그대로 말한다', () => {
  const st = play(prepared(), [['START', { chamber: 'L' }], ['TICK', { minutes: TIME_SLACK_MIN + 1 }], ['START', { chamber: 'R' }], ['TICK', { minutes: 5 }]]);
  assert.ok(notesOf(st).includes('잰 시간이 다릅니다'), notesOf(st));
});

/* ---------------- 관찰 시간을 다 채운 것은 초록이다 ---------------- */

test('관찰 시간을 다 채워 멈추는 것은 뜻대로 된 일이다 — 빨간 토스트가 아니다', () => {
  const st = play(prepared(), [['START', { chamber: 'L' }]]);
  const r = reduce(st, { type: 'TICK', payload: { minutes: OBSERVE_LIMIT_MIN } });
  assert.equal(r.tag, 'observe-limit');
  assert.equal(r.outcome, 'ok', '제대로 끝낸 순간 빨간 글이 뜨면 학생은 「내가 뭘 틀렸나」부터 찾습니다');
  assert.match(r.message, /다시 시작할 수도/, '되돌아갈 길이 문장에서 빠졌습니다');
});

/* ---------------- 확대 뷰 안에서 닿았을 때의 다음 행동 ---------------- */

test('확대 뷰에서 손잡이를 내리다 닿으면 「챔버를 클릭해 크게 보라」고 하지 않는다', () => {
  const st = prepared();
  const r = reduce(st, { type: 'SET_SENSOR_DEPTH', payload: { chamber: 'L', depth: 1 } });
  assert.equal(r.outcome, 'happened');
  const next = UI.toast.nextAction[r.tag];
  assert.ok(next, `'${r.tag}' 에 1단계 다음 행동이 없습니다`);
  assert.ok(!/챔버를 클릭/.test(next), `이미 확대 뷰 안인데 「${next}」`);
});

/* ---------------- 말풍선이 없는 조작을 약속하지 않는다 ---------------- */

test('말풍선의 「클릭하면 …」 이 실제 조작표에 있는 것만 말한다', () => {
  const fake = { dispatch() {}, getState: () => initialState(1) };
  const taps = new Set(Object.keys(tapTable(fake, () => {})));
  void dropTable(fake);
  const promised = /클릭하면 (통 뚜껑|마개|손을 씻)|자기 평가에 남습니다|클릭 — (뚜껑|마개|손)/;
  for (const [kind, byLevel] of Object.entries(UI.bench.hints)) {
    for (const line of [byLevel[1], byLevel[2]].flat()) {
      assert.equal(promised.test(line), false, `${kind} 말풍선이 없는 조작을 약속합니다: "${line}"`);
      if (/클릭/.test(line)) assert.ok(taps.has(kind), `${kind} 는 클릭 조작이 없는데 「${line}」`);
    }
  }
});

/* ---------------- 그래프 눈금이 읽을 수 있는 수다 ---------------- */

test('CO₂ 세로 눈금이 「1190」 같은 어중간한 수가 아니다', () => {
  for (const hi of [800, 1000, 1500, 2000, 3000, 4000, 6000]) {
    const ticks = co2Ticks(380, hi);
    assert.ok(ticks.length >= 2, `${hi} 에서 눈금이 ${ticks.length}개뿐입니다`);
    assert.ok(ticks.every((v) => v % 100 === 0), `${hi} 의 눈금이 어중간합니다: ${ticks}`);
    assert.equal(ticks[ticks.length - 1], hi, '꼭대기 눈금이 빠졌습니다');
  }
  const st = play(prepared(), [['START', { chamber: 'L' }], ['START', { chamber: 'R' }], ['TICK', { minutes: 18 }]]);
  const svg = renderGraph(Object.values(chamberViews(st)));
  const grid = svg.slice(svg.indexOf('co2-grid'), svg.indexOf('</g>', svg.indexOf('co2-grid')));
  const labels = [...grid.matchAll(/>(\d+)<\/text>/g)].map((m) => Number(m[1]));
  assert.ok(labels.length >= 2 && labels.every((v) => v % 100 === 0), `실제 그래프의 눈금: ${labels}`);
});

/* ---------------- 짧은 관찰 한 줄도 기록으로 통과한다 ---------------- */

test('「온도가 왼쪽이 1도 정도 높았다」는 기록으로 충분하다', () => {
  assert.equal(gradeQuestion('record', '온도가 왼쪽이 1도 정도 높았다.').status, 'pass');
  assert.equal(gradeQuestion('record', '노란색.').status, 'more', '한두 낱말은 여전히 걸러야 합니다');
});

/* ---------------- 실험대 판이 가로로 스크롤되지 않는다 ---------------- */

test('#bench 는 가로 스크롤을 막는다 — 오른쪽 끝 물건의 프레임이 무대를 넘는다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rule = /#bench\{[^}]*\}/.exec(html)?.[0] ?? '';
  assert.match(rule, /overflow-x:hidden/, '윈도우·크롬북에서 실험대 밑에 가로 스크롤바가 생깁니다');
});
