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
import { UI } from '../src/ui/strings.js';
import { stepNoteKeys } from '../src/ui/notebook.js';

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
  put('predict.split', '세 부분으로 갈린다');
  put('predict.why.split', '흙탕물이 가라앉는 것을 본 적이 있어서');
  // 기록칸이 **있는** 칸에 적는다 (`note: true`). 없는 칸에 적으면 화면이 받아 준 적도
  // 없는 글이라, 종이에 실리지 않는 것이 맞다.
  put('2a', '손끝에 선홍색 방울이 동그랗게 맺혔다');
  put('selfeval.process', '4');
  put('feedback.learned', '혈액의 절반 넘게가 액체였다');
  return st;
}

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' });
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('세 부분으로 갈린다'), '예상이 종이에 없습니다');
  assert.ok(html.includes('흙탕물이 가라앉는 것을 본 적이 있어서'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('손끝에 선홍색 방울이'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('혈액의 절반 넘게가 액체였다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

/** 종이의 「4. 탐구 과정」 절만 잘라낸다. 빈칸 표시는 다른 절에도 나오므로 범위를 좁힌다. */
function processSection(html) {
  const start = html.indexOf(UI.report.sections.process);
  assert.notEqual(start, -1, '종이에 탐구 과정 절이 없습니다');
  const end = html.indexOf('<h2', start);
  return html.slice(start, end === -1 ? undefined : end);
}

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  const html = buildSheet(initialState(1), {});
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');
  // 세부 단계는 하나도 안 적었어도 **제목은** 전부 실린다. 무엇을 하는 절차였는지
  // 종이만 보고 알 수 있어야 한다.
  const section = processSection(html);
  for (const g of UI.protocol) {
    for (const step of g.steps) {
      assert.ok(section.includes(step.label), `「${step.label}」 이 종이에 없습니다`);
    }
  }
});

/**
 * **난이도를 축으로 돈다.**
 *
 * 이 파일의 검사가 전부 `initialState(1)` 로만 종이를 만들고 있었다. 그런데 난이도가
 * 바뀌면 **저장되는 키 자체가 바뀐다** — 3단계는 절차를 안 짚어 줘서 STEP 하나에 칸
 * 하나(`notes['1']`)이고, 1·2단계는 세부 단계마다다(`notes['1a']`).
 * 그 축을 아무도 안 흔들어 봐서, **3단계 학생이 적은 7칸이 종이에 0칸 실리고
 * 준 적도 없는 8칸에 「적지 않았습니다」가 달리는 것**을 오래 못 봤다.
 */
const LEVELS = [1, 2, 3];

/** 그 난이도에서 화면이 내주는 칸을 **전부** 채운 상태. */
function allWritten(level) {
  let st = initialState(level);
  for (const key of stepNoteKeys(level)) {
    st = reduce(st, { type: 'SAVE_NOTE', payload: { step: key, text: `${level}단계-${key}-학생이적은글` } }).state;
  }
  return st;
}

for (const level of LEVELS) {
  test(`${level}단계 — 화면에서 적은 것이 종이에 하나도 빠짐없이 실린다`, () => {
    // 「적지 않았습니다」보다 나쁜 것은 **적은 것을 지우고 그 자리에 안 적었다고 쓰는 것**이다.
    const section = processSection(buildSheet(allWritten(level), {}));
    const missing = stepNoteKeys(level).filter((k) => !section.includes(`${level}단계-${k}-학생이적은글`));
    assert.deepEqual(missing, [],
      `${level}단계에서 학생이 적은 것이 종이에 없습니다: ${missing.join(', ')}`);
  });

  test(`${level}단계 — 다 적었으면 종이에 빈칸이 하나도 없다`, () => {
    // 위 검사만으로는 반쪽이다. 글이 실리면서 **빈칸도 함께** 찍히면 선생님은
    // 적은 칸과 안 적은 칸이 뒤섞인 종이를 받는다.
    const section = processSection(buildSheet(allWritten(level), {}));
    const blanks = (section.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
    assert.equal(blanks, 0, `${level}단계에서 다 적었는데 빈칸이 ${blanks}칸 남았습니다`);
  });

  test(`${level}단계 — 탐구 과정 절의 빈칸 수 = 화면의 기록칸 수`, () => {
    // **줄이면 보고서가 따라와야 한다.** 화면이 적을 칸을 준 적도 없는 자리에 종이가
    // 「적지 않았습니다」 를 달면, 선생님 눈에는 학생이 건너뛴 것으로 읽힌다.
    // micrometer 가 기록칸을 열일곱에서 일곱으로 줄이면서 실제로 그렇게 어긋났다.
    const section = processSection(buildSheet(initialState(level), {}));
    const boxes = stepNoteKeys(level).length;
    const shown = (section.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
    assert.equal(shown, boxes,
      `${level}단계 — 화면의 기록칸은 ${boxes}칸인데 종이의 빈칸은 ${shown}칸입니다`);
  });
}

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  // 이 글은 학생 자기 화면에만 들어가지만, 보고서로 인쇄돼 남에게 건네진다.
  // 따옴표까지 막지 않으면 속성 안에 들어갈 때 새 속성을 붙일 수 있다 (5단계 헤마토크릿 칸).
  let st = initialState(1);
  const payload = `<img src=x onerror=alert(1)>" onfocus="alert(2)`;
  for (const step of ['q2', 'hct.0', 'predict.split', '1a', 'feedback.learned']) {
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


test('종이에 안전 기록 절이 없다 — 앱은 안전 수칙을 세지 않는다', () => {
  // 세던 것을 걷어냈다. 종이에 「지켰다/놓쳤다」 가 남아 있으면 선생님은 앱이 그것을
  // 봐 준 줄 알게 된다 — **앱은 확인하지 않는다.** 안내는 화면 2쪽에만 있다.
  const html = buildSheet(initialState(1), {});
  assert.equal(/가치·태도|안전 규칙 준수|지켰습니다|놓쳤습니다/.test(html), false,
    '종이가 아직 안전 수칙을 판정하고 있습니다');
});

test('모둠 활동지에는 모둠 이름이 실린다', () => {
  // 화면에서는 모둠을 고르면 「모둠 이름」 칸이 나오고 학생이 거기 적는다.
  // 그런데 `head()` 가 `R.fields` 만 돌아 **적은 것이 종이에 안 실렸다.**
  // 모둠 활동지를 여러 장 걷어 놓으면 어느 모둠 것인지 알 수 없다.
  const who = { name: '홍길동', grade: '1', classNo: '3', number: '12', team: '3모둠' };
  const sheet = buildSheet(initialState(1), who, 'group');
  assert.ok(sheet.includes('3모둠'), '모둠 활동지에 모둠 이름이 없습니다');
});

test('혼자 활동지에는 모둠 이름 칸을 만들지 않는다', () => {
  // 혼자 활동지에는 그 칸이 화면에 안 나온다. 안 물어본 것을 빈칸으로 찍으면
  // 「답할 수 없었던 것」이 「안 한 일」로 읽힌다.
  const sheet = buildSheet(initialState(1), { name: '홍길동', team: '3모둠' }, 'solo');
  assert.ok(!sheet.includes('3모둠'), '혼자 활동지에 모둠 이름이 실렸습니다');
});
