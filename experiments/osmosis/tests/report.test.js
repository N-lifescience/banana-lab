/**
 * 보고서 테스트.
 *
 * 종이에 무엇이 실리는가와, **이름이 어디로 가지 않는가**를 본다.
 * 뒤쪽이 더 중요하다 — 개인정보가 상태나 저장소로 새면 화면 어디서도 티가 안 나고,
 * 티가 안 나는 채로 계속 쌓인다 (AGENTS.md §6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { buildSheet } from '../src/ui/report.js';
import { escapeHtml } from '../src/ui/notebook.js';
import { UI } from '../src/ui/strings.js';

/**
 * 주석을 걷어낸 소스. 이 파일의 주석은 "localStorage 에 저장하지 않는다" 처럼
 * 금지어를 그대로 적고 있어서, 걷어내지 않으면 설명문을 코드로 오해한다.
 */
const SOURCE = readFileSync(new URL('../src/ui/report.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** 몇 가지를 적어 둔 상태 하나 */
function filled() {
  let st = initialState(2);
  const put = (step, text) => { st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text } }).state; };
  put('predict.sugar', '세포 안의 보라색 부분이 작아진다');
  put('predict.why.sugar', '배추를 소금에 절이면 숨이 죽으니까');
  put('3d', '보라색이 세포 안을 가득 채우고 있었다');   // 기록칸이 있는 단계로 (note: true)
  put('selfeval.process', '4');
  put('feedback.learned', '세포벽이 있어서 터지지 않는다는 것을 알았다');
  return st;
}

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' });
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('보라색 부분이 작아진다'), '예상이 종이에 없습니다');
  assert.ok(html.includes('배추를 소금에 절이면'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('보라색이 세포 안을 가득'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('세포벽이 있어서 터지지 않는다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  const html = buildSheet(initialState(1), {});
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');
});

/**
 * **종이의 빈칸 수 = 화면의 기록칸 수.** 둘이 어긋나면 종이가 거짓말을 한다.
 *
 * 기록칸을 열아홉에서 일곱으로 줄이면서 종이를 안 고치면, 종이는 계속 열아홉 줄을 찍으면서
 * **칸을 준 적도 없는 열두 곳에 「적지 않았습니다」**를 단다. 선생님 눈에는 학생이 건너뛴
 * 것으로 읽힌다 — 적을 자리를 준 적이 없는데. micrometer-lab 이 실제로 그렇게 냈다.
 *
 * 그래서 「탐구 과정」 절 안의 빈칸만 세어 `note: true` 개수와 맞대 본다.
 * 다른 절(예상·농도별 표)에도 빈칸 표시가 있으므로 절을 잘라 내고 센다.
 */
test('종이의 탐구 과정 빈칸 수가 화면의 기록칸 수와 같다', () => {
  const html = buildSheet(initialState(1), {});
  const start = html.indexOf(UI.report.sections.process);
  assert.ok(start > 0, '탐구 과정 절을 종이에서 못 찾았습니다');
  const rest = html.slice(start);
  const end = rest.indexOf('<section', 1);
  const section = end > 0 ? rest.slice(0, end) : rest;

  const boxes = UI.protocol.reduce((n, g) => n + g.steps.filter((s) => s.note).length, 0);
  const blanks = (section.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  assert.equal(blanks, boxes,
    `화면 기록칸은 ${boxes}개인데 종이는 ${blanks}칸에 「${UI.report.notWritten}」을 달았습니다. ` +
    '칸을 준 적 없는 단계를 나무라면 안 됩니다.');

  // 절차 자체는 그대로 실려야 한다 — 무엇을 했는지는 보여야 하므로.
  const allSteps = UI.protocol.reduce((n, g) => n + g.steps.length, 0);
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      assert.ok(section.includes(s.label), `절차 「${s.label}」이 종이에서 빠졌습니다`);
    }
  }
  assert.ok(allSteps > boxes, '이 검사는 기록칸이 절차보다 적을 때만 뜻이 있습니다');
});

/*
 * **모둠 활동지에 모둠 이름이 실린다.**
 *
 * `head()` 가 `R.fields` 만 돌고 있어서 안 실렸다. 창에서 물어보고, 제출 꾸러미에도 담기고,
 * 선생님 화면도 읽는데 **정작 종이만 몰랐다** — 선생님은 모둠 이름 없는 활동지를 받는다.
 * 층을 나눠 만들면 층 사이가 빈다.
 */
test('모둠 활동지에 모둠 이름이 실린다', () => {
  const html = buildSheet(initialState(1), { team: 'YY모둠' }, 'group');
  assert.ok(html.includes('YY모둠'), '모둠 이름이 종이에 없습니다');
});

test('개별 활동지에는 모둠 칸이 아예 안 나온다', () => {
  // 「비워 두는 것이 아니라 아예 싣지 않는다」 — 빈칸은 안 한 일처럼 보인다.
  const html = buildSheet(initialState(1), { name: '홍길동' }, 'individual');
  assert.equal(/>모둠</.test(html), false, '비워 둔 모둠 칸이 종이에 남습니다');
});

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
});

/*
 * **정화 함수 자체를 잰다.**
 *
 * 아래 「태그로 해석되지 않는다」는 학생 글이 종이까지 가는 **길**을 재고, 이건 그 길의
 * **연장**을 잰다. 규칙이 「정화 함수 + **그 함수에 대한 테스트**」를 요구한다
 * (`Projects/CLAUDE.md`). 길만 재면 다른 곳에서 이 함수를 새로 쓸 때 무엇을 믿어도 되는지
 * 알 수 없고, 함수만 재면 정작 학생 글이 그 함수를 지나는지는 모른다. **둘 다 있어야 한다.**
 *
 * ★ **낱말을 재면 안 된다.** 정화를 거쳐도 `onerror=` 라는 **글자는 남는다** —
 *   그게 학생이 쓴 내용이고 글자로 보이는 것이 맞다. 재야 할 것은 **살아 있는 꺾쇠와 따옴표**다.
 */
test('escapeHtml 이 다섯 글자를 다 막는다', () => {
  assert.equal(escapeHtml('&'), '&amp;');
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
  // 따옴표까지 막는 까닭 — 속성 안에 들어갈 때 새 속성을 붙일 수 있다.
  assert.equal(escapeHtml('" onfocus="x'), '&quot; onfocus=&quot;x');
});

test('escapeHtml 을 지난 글에는 살아 있는 꺾쇠가 없다', () => {
  const nasty = `<img src=x onerror=alert(1)>" onfocus="alert(2)'--><script>`;
  const out = escapeHtml(nasty);
  assert.equal(/[<>"']/.test(out), false, `막지 못한 글자가 남았습니다: ${out}`);
  // 글자로는 남아야 한다 — 학생이 쓴 것을 지우면 안 된다.
  assert.ok(out.includes('onerror=alert(1)'), '학생이 쓴 글자가 사라졌습니다');
  assert.ok(out.includes('&lt;script&gt;'), '꺾쇠가 글자로 남아야 합니다');
});

test('escapeHtml 은 문자열이 아닌 것도 받아 넘긴다', () => {
  // 안 적은 칸은 `undefined` 로 온다. 여기서 터지면 종이가 통째로 안 나온다.
  assert.equal(escapeHtml(undefined), 'undefined');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(17), '17');
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  // 이 글은 학생 자기 화면에만 들어가지만, 보고서로 인쇄돼 남에게 건네진다.
  // 따옴표까지 막지 않으면 속성 안에 들어갈 때 새 속성을 붙일 수 있다 (5단계 배율 칸).
  let st = initialState(1);
  const payload = `<img src=x onerror=alert(1)>" onfocus="alert(2)`;
  for (const step of ['q2', 'mag.0', 'predict.A', '1a', 'feedback.learned']) {
    st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text: payload } }).state;
  }
  const html = buildSheet(st, { name: payload });
  // "onerror=alert" 라는 **글자**는 남는다 — 그게 학생이 쓴 내용이고, 글자로 보이는 것이 맞다.
  // 봐야 할 것은 그것이 태그나 속성으로 **해석되는가** 다.
  assert.ok(!html.includes('<img src=x'), '학생이 쓴 태그가 그대로 들어갔습니다');
  assert.ok(!html.includes('" onfocus='), '따옴표로 속성을 빠져나갈 수 있습니다');
  assert.ok(html.includes('&lt;img'), '글자로는 남아 있어야 합니다');
  assert.ok(html.includes('&quot;'), '따옴표가 인코딩되지 않았습니다');
});

test('보고서는 개인정보를 상태에도 저장소에도 보내지 않는다', () => {
  // 이름을 store 에 넣으면 되돌리기 기록에 남고, 상태를 읽는 모든 화면으로 흘러간다.
  assert.ok(!/\.dispatch\(/.test(SOURCE),
    'report.js 가 store.dispatch 를 부릅니다 — 이름이 상태로 들어갑니다');
  for (const sink of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!SOURCE.includes(sink), `report.js 가 ${sink} 를 씁니다 — 이름이 남습니다`);
  }
});

test('종이 제목이 이 실험의 이름을 말한다', () => {
  // **복제해서 만든 저장소라 여기가 실제로 남았다.** 이름표를 전부 갈아 끼운 뒤에도
  // 보고서 제목만 남의 실험 이름인 채로 인쇄되고 있었고, 검사 186개가 전부 초록불이었다.
  // 제목을 손으로 적지 말고 `UI.appTitle` 하나에서 끌어 쓴다.
  assert.ok(UI.report.sheetTitle.includes(UI.appTitle),
    `보고서 제목이 앱 제목과 다릅니다: "${UI.report.sheetTitle}" / "${UI.appTitle}"`);
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes(UI.appTitle), '종이에 이 실험의 이름이 없습니다');
});

test('화면에 보이는 한국어에 이 실험에 없는 재료가 섞여 있지 않다', () => {
  // 복제본에서 이름표를 갈아 끼울 때 **한두 줄이 반드시 남는다.** 눈으로는 못 잡는다 —
  // 보고서 제목 한 줄이 실제로 그렇게 남았고 아무도 몰랐다.
  // 주석은 보지 않는다. `UI` 표에 든 문자열만 본다 (거기 없으면 화면에 못 나온다).
  const absent = /바나나|녹말|전분|지질|지방|아이오딘|수단\s*Ⅲ|청람|선홍/;
  const bad = [];
  (function walk(o, path) {
    if (typeof o === 'string') { if (absent.test(o)) bad.push(`${path}: "${o.slice(0, 50)}"`); }
    else if (typeof o === 'function') { /* 함수는 인자를 알아야 하므로 여기서 보지 않는다 */ }
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  })(UI, 'UI');
  assert.deepEqual(bad, [], `이 실험에 없는 재료가 화면 문구에 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

test('종이에 `**굵게**` 표기가 날것으로 남지 않는다', () => {
  // 화면은 emphasize 로 풀어 쓰는데 종이만 날것으로 실어서, 인쇄된 활동지의 1절이
  // 「**어느 농도에서 세포의 절반이 변할까?**」 로 별표째 나왔다 (osmosis 플레이테스트 2026-09-02).
  // 학생이 쓴 글에 별표가 있을 수는 있으니, 학생 글이 하나도 없는 초기 상태로 본다.
  const html = buildSheet(initialState(1), {}, 'group');
  assert.equal(html.includes('**'), false, '종이에 별표가 그대로 남았습니다 — emphasize 를 거치지 않은 문구가 있습니다');
});

test('3단계 학생이 STEP 마다 적은 글이 종이에 실린다', () => {
  // 3단계는 STEP 마다 칸 하나(`notes['3']`)인데 종이는 세부 단계 키만 읽어서 **한 자도 안 실렸고**,
  // 그 자리에 「적지 않았습니다」 일곱 개가 붙었다 (osmosis 플레이테스트 2026-09-02).
  const st = initialState(3);
  for (const g of UI.protocol) st.session.notes[g.id] = `STEP${g.id}에서 본 것을 적었다`;
  const html = buildSheet(st, {}, 'individual');
  for (const g of UI.protocol) assert.ok(html.includes(`STEP${g.id}에서 본 것을 적었다`), `STEP ${g.id} 의 글이 종이에 없습니다`);
  const process = html.slice(html.indexOf(UI.report.sections.process), html.indexOf(UI.report.sections.result));
  assert.equal((process.match(/적지 않았습니다/g) ?? []).length, 0, '다 적었는데 탐구 과정에 「적지 않았습니다」가 붙습니다');
});
