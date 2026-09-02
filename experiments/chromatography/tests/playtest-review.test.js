/**
 * 플레이테스트에서 잡은 것들 — 되돌리면 빨간불이 나야 한다 (PLAYTEST-REVIEW.md).
 *
 * 전부 **브라우저에서 학생 손으로 끝까지 해 보고서야** 나온 것이다. 그 전까지 검사는
 * 모두 초록불이었다. 여기 못 박아 두는 것은 「같은 자리가 도로 무너지지 않는가」다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UI } from '../src/ui/strings.js';
import { initialState, stripParams } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { buildSheet } from '../src/ui/report.js';
import { renderStrip } from '../src/render/strip.js';
import { stepPanelStates, QUESTION_A_AFTER } from '../src/ui/notebook.js';
import { PAPER_H_MM } from '../src/sim/develop.js';
import * as require_grading from '../src/ui/grading.js';

const run = (st, type, payload = {}) => reduce(st, { type, payload }).state;

/** 화면 문자열 표를 전부 편다 — 함수 값은 빈 인자로 한 번 불러 본다. */
function allStrings(o, path = 'UI', out = []) {
  if (typeof o === 'string') out.push([path, o]);
  else if (typeof o === 'function') { try { const v = o(); if (typeof v === 'string') out.push([path, v]); } catch { /* 인자가 필요한 것 */ } }
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) allStrings(v, `${path}.${k}`, out);
  return out;
}

test('화면 문자열 어디에도 바나나랩의 재료가 남아 있지 않다', () => {
  // 보고서 첫 줄이 「탐구 보고서 — 바나나에서 탄수화물과 지질 관찰하기」로 찍혀 나갔다.
  // tests/pages.test.js 는 HTML 머리말만 훑는다 — 이 표는 그 그물 밖이었다.
  const absent = /바나나|녹말|전분|지질|지방|아이오딘|수단\s*Ⅲ|청람|선홍|현미경|덮개 유리|받침 유리|스포이트|핀셋|재물대|대물렌즈|배율/;
  const bad = allStrings(UI).filter(([, s]) => absent.test(s)).map(([p, s]) => `${p}: ${s.slice(0, 60)}`);
  assert.deepEqual(bad, [], `이 실험에 없는 재료가 화면 문자열에 있습니다:\n  ${bad.join('\n  ')}`);
});

test('보고서 제목이 앱 제목과 같은 실험을 말한다', () => {
  assert.ok(UI.report.sheetTitle.includes(UI.appTitle),
    `보고서 제목 "${UI.report.sheetTitle}" 이 앱 제목과 다릅니다`);
});

test('3단계로 푼 학생의 STEP 기록이 보고서에 실린다', () => {
  // 3단계는 STEP 하나에 칸이 하나(`notes['1']`)다. 세부 단계 키(`1a`)만 돌면 한 자도 안 실리고
  // 열네 줄이 「적지 않았습니다」로 찍혀, 선생님 눈에는 아무것도 안 한 학생이 된다.
  let st = initialState(3);
  st = run(st, 'SAVE_NOTE', { step: '1', text: '잎을 잘라 넣었더니 바닥에 초록이 깔렸다' });
  st = run(st, 'SAVE_NOTE', { step: '5', text: '전개액을 얕게 붓고 종이를 세웠다' });
  const html = buildSheet(st, { name: '홍길동' });
  assert.ok(html.includes('잎을 잘라 넣었더니'), '3단계 STEP 1 기록이 종이에 없습니다');
  assert.ok(html.includes('전개액을 얕게 붓고'), '3단계 STEP 5 기록이 종이에 없습니다');
  // 적은 STEP 의 세부 단계가 「적지 않았습니다」로 따로 찍히지 않는다.
  const label = UI.protocol[0].steps[0].label;
  assert.equal(html.includes(`<b>${label}</b><span>${UI.report.notWritten}`), false,
    '3단계에서 적은 STEP 인데 세부 단계가 「적지 않았습니다」로 찍혔습니다');
});

/** 절차를 지켜 전개까지 마친 상태 */
function developed() {
  let s = initialState(1);
  s = run(s, 'ADD_LEAF'); s = run(s, 'ADD_EXTRACT');
  for (let i = 0; i < 5; i++) s = run(s, 'SHAKE', { amount: 0.2 });
  for (let i = 0; i < 13; i++) s = run(s, 'TICK');
  s = run(s, 'DRAW_ORIGIN'); s = run(s, 'LOAD_CAPILLARY');
  for (let i = 0; i < 15; i++) { s = run(s, 'SPOT', { dwell: 0.2 }); s = run(s, 'DRY_SPOT'); }
  s = run(s, 'POUR_SOLVENT', { mm: 5 }); s = run(s, 'INSERT_PAPER'); s = run(s, 'CAP_VIAL');
  for (let i = 0; i < 70; i++) s = run(s, 'TICK');
  s = run(s, 'REMOVE_PAPER'); s = run(s, 'MARK_FRONT'); s = run(s, 'DRY_PAPER');
  return s;
}

test('기록에는 종이를 꺼낸 뒤에도 전개할 때의 전개액 깊이가 남는다', () => {
  // 카드와 보고서가 「전개액 깊이 0 mm」를 찍고 있었다 — 그림용 `depthMm` 은 꺼내면 0 이다.
  const s = developed();
  const p = stripParams(s);
  assert.equal(p.depthMm, 0, '그림용 깊이는 꺼내면 0 이다 (잠긴 부분을 그리는 값)');
  assert.equal(p.runDepthMm, 5, '전개할 때의 깊이가 기록에 남아야 합니다');
  const st = run(s, 'CAPTURE');
  const html = buildSheet(st, {});
  assert.ok(html.includes('5 mm'), '보고서의 전개액 깊이가 5 mm 여야 합니다');
  assert.equal(html.includes('0 mm'), false, '보고서에 전개액 깊이 0 mm 가 찍혔습니다');
});

test('보고서의 「뚜껑」 칸은 뚜껑을 말하고, 용매 전선 높이를 대신 적지 않는다', () => {
  // 「뚜껑」 옆에 89 mm 가 찍혀 있었다 — 이름표와 값이 다른 데다, 그 값은 학생이 자로 읽는 분모다.
  const s = run(developed(), 'CAPTURE');
  const html = buildSheet(s, {});
  const front = Math.round(s.session.captures[0].markedFront);
  assert.equal(html.includes(`${front} mm`), false, `보고서가 용매 전선 높이 ${front} mm 를 대신 적었습니다`);
  assert.ok(html.includes(UI.notebook.cappedKept), '뚜껑 칸에 「덮음」이 없습니다');
});

test('질문 ⓐ 는 띠를 처음 보는 STEP(꺼내기) 밑에 붙는다', () => {
  // STEP 4(점 찍기) 밑에 있었다 — 아직 전개 전인데 「방금 띠가 여러 개 갈라졌습니다」라고 물었다.
  const removeIdx = UI.protocol.findIndex((g) => g.steps.some((s) => /꺼내/.test(s.label)));
  assert.equal(QUESTION_A_AFTER, UI.protocol[removeIdx].id, '질문 ⓐ 가 꺼내기 STEP 밑이 아닙니다');
  assert.ok(UI.notebook.qaNotYet.includes(`STEP ${QUESTION_A_AFTER}`), '정리 쪽 안내가 다른 STEP 번호를 말합니다');
  const doc = readFileSync(new URL('../docs/06-lab-notebook.md', import.meta.url), 'utf8');
  assert.ok(doc.includes(`STEP ${QUESTION_A_AFTER} 직후`), 'docs/06 이 다른 STEP 번호를 말합니다');
});

test('실험대에서 했어도 관찰 기록을 적기 전에는 그 STEP 이 접히지 않는다', () => {
  // 잎을 넣고 흔든 학생이 노트로 돌아오면 STEP 1·2 가 ✓ 로 접혀 있고 STEP 3 이 펼쳐져 있었다 —
  // 「방금 했습니다. 무엇을 보았는지 적어 보세요」는 한 번도 안 떴고, 기록칸은 끝까지 비었다.
  const groups = UI.protocol;
  const done = groups.map((_, i) => i < 2);          // 실험대에서 STEP 1·2 를 했다
  const written = groups.map(() => false);           // 아직 아무것도 안 적었다
  const finished = done.map((d, i) => d && written[i]);
  const panels = stepPanelStates(groups, done, new Map(), finished);
  assert.equal(panels[0].state, 'now', 'STEP 1 은 했지만 안 적었으므로 지금 할 차례여야 합니다');
  assert.equal(panels[0].open, true);
  assert.equal(panels[2].open, false, 'STEP 3 이 먼저 펼쳐지면 안 됩니다');
  // 적고 나면 접히고 다음이 열린다
  const finished2 = [true, false, false, false, false, false, false];
  const panels2 = stepPanelStates(groups, done, new Map(), finished2);
  assert.equal(panels2[0].state, 'done');
  assert.equal(panels2[0].open, false);
  assert.equal(panels2[1].state, 'now');
  // 넘기지 않으면 예전과 같다 — 다른 실험이 그대로 쓸 수 있다
  assert.deepEqual(stepPanelStates(groups, done), stepPanelStates(groups, done, new Map(), done));
});

test('자의 잔눈금은 1 mm 다', () => {
  // 5 mm 마다만 그어져 있었다. 학생이 손에 쥐는 자와 다르고, ±0.05 첨삭은 mm 읽기가 전제다.
  const svg = renderStrip({ originMm: 25, marker: 'pencil', spots: 15, spotMm: 2, load: 0.9, rawLoad: 0.9,
    frontMm: 90, markedFront: 90, rulerPlaced: true, wetness: 0, seed: 1 });
  const ruler = svg.slice(svg.indexOf('strip-ruler'));
  const ticks = (ruler.match(/<line /g) ?? []).length;
  assert.ok(ticks >= PAPER_H_MM + 1, `자 눈금이 ${ticks}개뿐입니다 — mm 마다 있어야 합니다`);
});

test('전개 전에는 「볼 만함」 게이지를 재지 않는다 — 문구가 있다', () => {
  // 원점을 찍는 동안 「볼 만함 3 · 가장 크게 깎이는 항목: 갈라진 정도」가 떴다. 잘못한 것이 없는데.
  assert.ok(UI.zoom.notDeveloped && /전개/.test(UI.zoom.notDeveloped));
  const src = readFileSync(new URL('../src/ui/zoom.js', import.meta.url), 'utf8');
  assert.ok(/runT > 0 \?/.test(src), 'zoom.js 가 전개 전에도 게이지를 그립니다');
});

test('전선이 종이 끝을 넘어간 기록에는 「표시하지 않아」라고 하지 않는다', () => {
  // 넘어간 종이에 「용매 전선을 표시하지 않아 … 꺼내자마자 표시하세요」가 붙었다 —
  // 진단도 처방도 틀린다. 그 학생의 잘못은 늦게 꺼낸 것이다.
  assert.ok(UI.notebook.rfOverrun && /넘어가/.test(UI.notebook.rfOverrun));
  assert.ok(/닿기 전에 꺼내/.test(UI.notebook.rfOverrun), '처방이 「일찍 꺼내라」여야 합니다');
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  assert.ok(/c\.overrun \? N\.rfOverrun : N\.rfUnmeasurable/.test(src), '5쪽이 넘어간 경우를 가르지 않습니다');
});

test('「나뉜다」·「갈린다」로 쓴 맞는 답이 미달로 떨어지지 않는다', () => {
  // 어간이 바뀌는 활용이라 「나뉘」·「갈라」로는 못 잡았다. 맞게 쓴 답을 미달로 만드는 비용이 가장 크다.
  const { gradeQuestion } = require_grading;
  for (const t of [
    '각 색소가 용매에 실려 가는 정도가 같지 않아서 여러 줄로 나뉜다',
    '색소마다 종이에 붙는 정도가 달라 위아래로 갈린다',
  ]) assert.equal(gradeQuestion('qa', t).status, 'pass', `미달로 판정됨: "${t}"`);
});

test('원점이 잠겨 띠가 없을 때는 「더 찍으라」가 아니라 「잠겼다」고 말한다', () => {
  // 실패 경로 A: 전개액 30 mm 에 종이를 세운 학생이 색소 위치를 표시하려 하자
  // 「표시할 색 띠가 없습니다. 원점에 상층액을 여러 번 찍고 …」 — 처방이 틀렸다.
  let s = initialState(1);
  s = run(s, 'ADD_LEAF'); s = run(s, 'ADD_EXTRACT');
  for (let i = 0; i < 5; i++) s = run(s, 'SHAKE', { amount: 0.2 });
  for (let i = 0; i < 13; i++) s = run(s, 'TICK');
  s = run(s, 'DRAW_ORIGIN'); s = run(s, 'LOAD_CAPILLARY');
  for (let i = 0; i < 15; i++) { s = run(s, 'SPOT', { dwell: 0.2 }); s = run(s, 'DRY_SPOT'); }
  for (let i = 0; i < 3; i++) s = run(s, 'POUR_SOLVENT', { mm: 10 });
  s = run(s, 'INSERT_PAPER');
  for (let i = 0; i < 70; i++) s = run(s, 'TICK');
  s = run(s, 'REMOVE_PAPER');
  const r = reduce(s, { type: 'MARK_BANDS', payload: {} });
  assert.equal(r.tag, 'origin-submerged');
  assert.ok(/잠겨/.test(r.message));
  assert.ok(UI.toast.nextAction['origin-submerged'].includes('얕게'), '다음 행동이 「얕게 다시 부으세요」여야 합니다');
});

test('1단계의 「다음 행동」이 원인 문장과 같은 말을 되풀이하지 않는다', () => {
  // 「뽑을 색소가 없습니다. 원심관에 잎과 추출액을 넣고 흔드세요. 원심관에 잎과 추출액을 넣고 흔드세요.」
  const src = readFileSync(new URL('../src/sim/rules.js', import.meta.url), 'utf8');
  const messages = new Map();
  for (const m of src.matchAll(/(?:happened|ok)\(\s*\w+,\s*[`']([^`']*)[`'],\s*'([\w-]+)'\)/g)) {
    messages.set(m[2], [...(messages.get(m[2]) ?? []), m[1]]);
  }
  assert.ok(messages.size > 10, '규칙 엔진의 문장을 못 읽었습니다');
  for (const [tag, next] of Object.entries(UI.toast.nextAction)) {
    const core = next.replace(/^다음에는\s*/, '').replace(/[.。]\s*$/, '');
    for (const msg of messages.get(tag) ?? []) {
      assert.equal(msg.includes(core), false,
        `${tag}: 원인 문장이 이미 「${core}」를 담고 있는데 다음 행동이 또 붙습니다`);
    }
  }
});
