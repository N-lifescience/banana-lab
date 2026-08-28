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
import { buildSheet, payloadOf, SUBMIT_TOP_KEYS, SUBMIT_SESSION_KEYS } from '../src/ui/report.js';
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
  put('predict.A', '색이 변하지 않는다');
  put('predict.why.A', '아무 용액도 넣지 않았으니까');
  put('1a', '껍질을 벗기니 안쪽이 연한 노란색이었다');
  put('selfeval.process', '4');
  put('feedback.learned', '바나나에 녹말이 많다');
  return st;
}

test('가치·태도 절은 학생이 무엇을 했는지 읽지 않는다', () => {
  /*
   * 예전에는 이 절이 「손을 씻었는가」 를 적었다. 그 판정을 통째로 걷어냈다 —
   * 가상 실험에서 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다.
   *
   * 그러니 이 절은 **상태와 무관하게 늘 같은 글**이어야 한다. 무엇을 했든 안 했든 똑같다.
   * 여기가 상태를 다시 읽기 시작하면 제출 계약(`SUBMIT_SESSION_KEYS`)도 함께 깨지는데,
   * 그때는 **선생님 화면에서만** 조용히 달라져서 학생 화면으로는 알 수가 없다.
   */
  const cut = (html) => html.slice(html.indexOf(UI.notebook.valuesLabel));
  const empty = cut(buildSheet(initialState(2), {}));
  const busy = cut(buildSheet(filled(), {}));
  assert.equal(empty, busy,
    '가치·태도 절이 학생이 한 일에 따라 달라집니다 — 적어만 두기로 한 자리입니다');

  // 그리고 실제로 안내가 실려 있어야 한다. 「늘 같다」 만 보면 **늘 비어 있어도** 통과한다.
  for (const line of UI.notebook.valuesList) {
    const bare = line.replace(/\*\*/g, '');
    assert.ok(busy.includes(bare.slice(0, 12)), `안내 한 줄이 종이에 없습니다: ${bare}`);
  }
});

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' });
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('색이 변하지 않는다'), '예상이 종이에 없습니다');
  assert.ok(html.includes('아무 용액도 넣지 않았으니까'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('껍질을 벗기니'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('바나나에 녹말이 많다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  // **종이 전체에서 세면 못 잡는다.**
  // 앞서는 `shown >= steps` 를 종이 전체에서 셌다. 그런데 예상·정리 절에도 빈칸이 있어서,
  // 이 저장소에서는 빈칸이 전체 35개 · 탐구 과정 절 20개였다 —
  // **탐구 과정 절에서 열다섯 칸이 사라져도 초록불**이었다. 다른 절이 수를 채워 준 것이다.
  // (fermentation 세션이 자기 저장소에서 실제로 다섯 개를 놓친 뒤 알려 주었다)
  //
  // 절을 잘라서, **같은지**를 본다. 「몇 개 이상」이 아니라 「몇 개」다.
  const html = buildSheet(initialState(1), {});
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');

  const from = html.indexOf(UI.report.sections.process);
  assert.ok(from >= 0, '종이에서 탐구 과정 절을 못 찾았습니다');
  const section = html.slice(from, html.indexOf('</section>', from));

  const steps = UI.protocol.reduce((n, g) => n + g.steps.length, 0);
  const shown = (section.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  assert.equal(shown, steps,
    `탐구 과정 절의 빈칸 ${shown}개가 세부 단계 ${steps}칸과 다릅니다.\n`
    + '  적을 칸을 준 적도 없는 자리에 「적지 않았습니다」가 붙으면\n'
    + '  선생님 눈에는 학생이 건너뛴 것으로 읽힙니다. 반대로 모자라면 건너뛴 것이 안 보입니다.');
});

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
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

test('제출한 값만으로 선생님 화면이 같은 종이를 만든다', () => {
  // **줄여도 되는 근거를 기계가 확인한다.**
  // 「눈으로 보니 안 쓰는 것 같다」 로 payload 를 줄이면, 나중에 종이가 조용히 깨진다.
  // 선생님 화면은 받은 값으로 buildSheet 을 다시 돌리므로,
  // **줄인 것만으로 같은 종이가 나오면 그것이 전부**다 (teacher.js 의 sheetOf).
  const who = { school: '한빛고', team: '2모둠', name: '홍길동', studentNo: '10203' };
  let st = initialState(1);
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      if (s.note) st = reduce(st, { type: 'SAVE_NOTE', payload: { step: s.id ?? g.id, text: '적음' } }).state;
    }
  }
  st = { ...st, session: { ...st.session,
    captures: [{ at: 1, reagent: 'IKI', objective: 40, ripe: 0.5, thickness: 0.3, drops: 2, seed: 7 }],
    violations: ['pipette-mouth'],
    log: [{ t: '이건 종이에 안 실린다' }],
  } };

  for (const kind of ['individual', 'group']) {
    const sent = payloadOf(st, who, kind).state;
    assert.equal(buildSheet(sent, who, kind), buildSheet(st, who, kind),
      `[${kind}] 보낸 값만으로는 같은 종이가 안 나옵니다 — SUBMIT_SESSION_KEYS 에 빠진 것이 있습니다`);
  }
});

test('상태에 칸이 새로 생겨도 저절로 나가지 않는다', () => {
  // 예전 방식(`const { history, ...session }`)은 **빼야 할 것을 뺐다.**
  // 그러면 칸이 하나 생길 때마다 조용히 새어 나간다 — 실제로 session.log 가 그렇게 나갔다.
  const st = initialState(1);
  const dirty = {
    ...st,
    비밀상자: '나가면 안 된다',
    session: { ...st.session, deviceId: '나가면 안 된다', log: [{ t: '나가면 안 된다' }] },
  };
  const json = JSON.stringify(payloadOf(dirty, { school: '', team: '' }, 'individual'));
  assert.ok(!json.includes('나가면 안 된다'),
    '허용 목록에 없는 값이 제출 꾸러미에 실렸습니다 — payloadOf 가 다시 상태를 통째로 담고 있습니까?');
});

test('제출 목록에 군더더기가 없다 — 하나만 빼도 종이가 달라진다', () => {
  // **동치 검사만으로는 반쪽이다.**
  // 「보낸 값만으로 같은 종이가 나온다」 는 **빠진 것이 없다**는 말이지
  // **군더더기가 없다**는 말이 아니다. 목록에 쓸데없는 키를 하나 더 넣어도 그 검사는
  // 그대로 초록불이다 — 그러면 안 실리는 값이 계속 나가고 아무도 모른다.
  // (웨이브 2 의 chromatography 세션이 이 구멍을 짚었다. 등식만 봤으면 중복인 키를
  //  그대로 뒀을 것이라고 했다.)
  const who = { school: '한빛고', team: '2모둠', name: '홍길동', studentNo: '10203' };
  let st = initialState(1);
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      if (s.note) st = reduce(st, { type: 'SAVE_NOTE', payload: { step: s.id ?? g.id, text: '적음' } }).state;
    }
  }
  st = { ...st, session: { ...st.session,
    captures: [{ at: 1, reagent: 'IKI', objective: 40, ripe: 0.5, thickness: 0.3, drops: 2, seed: 7 }],
    violations: ['pipette-mouth'],
  } };

  /** 키 하나를 뺀 꾸러미로 종이를 만든다. 터지는 것도 「달라진다」로 친다. */
  const sheetWithout = (drop, kind) => {
    const p = payloadOf(st, who, kind).state;
    const trimmed = drop.startsWith('session.')
      ? { ...p, session: { ...p.session, [drop.slice(8)]: undefined } }
      : { ...p, [drop]: undefined };
    try { return buildSheet(trimmed, who, kind); } catch { return '(터짐)'; }
  };

  const keys = [...SUBMIT_TOP_KEYS, ...SUBMIT_SESSION_KEYS.map((k) => `session.${k}`)];
  const useless = [];
  for (const k of keys) {
    const kinds = ['individual', 'group'];
    // 두 갈래 어디에서도 종이가 안 달라지면 그 키는 보낼 이유가 없다.
    if (kinds.every((kind) => sheetWithout(k, kind) === buildSheet(payloadOf(st, who, kind).state, who, kind))) {
      useless.push(k);
    }
  }
  assert.deepEqual(useless, [],
    `보내지만 종이에 아무 영향이 없는 항목이 있습니다: ${useless.join(', ')}\n`
    + '  → SUBMIT_TOP_KEYS / SUBMIT_SESSION_KEYS 에서 빼세요. 안 실리는 것을 보내는 것은 수집입니다.');
});

test('난이도가 달라도 학생이 적은 것이 종이에 실린다', () => {
  // **화면이 적는 자리와 종이가 읽는 자리가 같아야 한다.**
  //
  // 3단계 노트는 절차를 짚어 주지 않아 **STEP 하나에 칸 하나**다(`notes['1']`~).
  // 1·2단계는 세부 단계마다 칸이 있다(`notes['1a']`~).
  // 그런데 종이는 늘 세부 단계 키만 읽고 있었다 — 3단계로 푼 학생은
  // **적은 것이 한 자도 안 실리고** 준 적 없는 스무 칸에 「적지 않았습니다」가 달렸다.
  // 선생님 눈에는 아무것도 안 한 학생으로 읽힌다.
  //
  // 앞선 검사들이 **1단계로만** 종이를 만들어서 못 봤다.
  // 난이도가 바뀌면 **읽는 자리도 바뀐다.**
  for (const level of [1, 2, 3]) {
    const perStep = UI.protocol.map((g) => g.id);
    const perSub = UI.protocol.flatMap((g) => g.steps.map((s, i) => g.id + String.fromCharCode(97 + i)));
    const keys = level >= 3 ? perStep : perSub;

    let st = initialState(level);
    for (const k of keys) st = reduce(st, { type: 'SAVE_NOTE', payload: { step: k, text: `학생글${k}` } }).state;

    const html = buildSheet(st, {}, 'individual');
    const missing = keys.filter((k) => !html.includes(`학생글${k}`));
    assert.deepEqual(missing, [],
      `${level}단계에서 학생이 적은 것이 종이에 없습니다: ${missing.join(', ')}`);

    // 다 적었으면 빈칸이 하나도 없어야 한다 — 남아 있으면 준 적 없는 칸을 찍은 것이다.
    const from = html.indexOf(UI.report.sections.process);
    const section = html.slice(from, html.indexOf('</section>', from));
    const blanks = (section.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
    assert.equal(blanks, 0,
      `${level}단계에서 다 적었는데도 「적지 않았습니다」가 ${blanks}개 남았습니다`);
  }
});
