/**
 * 보고서 테스트.
 *
 * 종이에 무엇이 실리는가와, **이름이 어디로 가지 않는가**를 본다.
 * 뒤쪽이 더 중요하다 — 개인정보가 상태나 저장소로 새면 화면 어디서도 티가 안 나고,
 * 티가 안 나는 채로 계속 쌓인다.
 *
 * 소스를 훑는 개인정보 검사는 `tests/privacy.test.js` 가 **디렉터리 단위로** 한다.
 * 파일 하나를 겨누면 그 파일을 치우는 순간 검사가 함께 꺼지기 때문이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/sim/state.js';
import { OBSERVE_LIMIT_MIN } from '../src/sim/fermentation.js';
import { reduce } from '../src/sim/rules.js';
import { buildSheet } from '../src/ui/report.js';
import { UI } from '../src/ui/strings.js';

const put = (st, step, text) => reduce(st, { type: 'SAVE_NOTE', payload: { step, text } }).state;

/** 시행 하나를 실제로 끝까지. */
function trial(s, { tempC = 30, glucosePct = 10 } = {}) {
  for (const [type, payload] of [
    ['EMPTY_TUBE', {}],
    ['POUR_GLUCOSE', { pct: glucosePct }], ['POUR_YEAST', {}], ['PLUG_TUBE', {}],
    ['PUT_IN_INCUBATOR', { tempC }],
  ]) s = reduce(s, { type, payload }).state;
  for (let t = 0; t <= OBSERVE_LIMIT_MIN && s.bench.tube.elapsedMin < OBSERVE_LIMIT_MIN; t += 5) {
    s = reduce(s, { type: 'TICK', payload: { minutes: 5 } }).state;
  }
  return reduce(s, { type: 'RECORD_TRIAL' }).state;
}

function filled() {
  let st = initialState(2);
  st = reduce(st, { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  st = reduce(st, { type: 'SET_CONTROL', payload: { key: 'tempC', value: 30 } }).state;
  st = trial(st, { tempC: 30 });
  st = trial(st, { tempC: 20 });
  st = put(st, 'predict', '어느 온도까지 많아지다가 다시 줄어든다');
  st = put(st, 'predict.why', '효모도 너무 뜨거우면 못 견딜 것 같아서');
  st = put(st, '1a', '온도를 바꿔 보기로 했다');
  st = put(st, 'qa', '효모가 포도당을 분해하면서 낸 이산화 탄소가 맹관부에 모였다');
  st = put(st, 'q2', '30도가 20도보다 기체가 많이 났다');
  st = put(st, 'selfeval.process', '4');
  st = put(st, 'feedback.learned', '효모가 온도를 탄다는 것을 알았다');
  return st;
}

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' });
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('어느 온도까지 많아지다가'), '예상이 종이에 없습니다');
  assert.ok(html.includes('효모도 너무 뜨거우면'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('온도를 바꿔 보기로 했다'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('효모가 온도를 탄다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

test('실험 설계와 시행이 종이에 실린다', () => {
  // 무엇을 바꾸기로 했는지가 이 보고서의 전제다. 없으면 결과를 읽을 수 없다.
  const html = buildSheet(filled(), {});
  assert.ok(html.includes(UI.report.designLabel), '실험 설계가 종이에 없습니다');
  assert.ok(html.includes(UI.variables.temp.name), '무엇을 바꿨는지가 종이에 없습니다');
  assert.ok(html.includes('30 ℃') && html.includes('20 ℃'), '시행이 종이에 없습니다');
  assert.ok(html.includes('data-render="graph"'), '그래프가 종이에 없습니다');
});

test('기체가 안 난 시행과 어긋난 시행도 종이에 그대로 실린다', () => {
  // 종이에서 지우면 학생은 자기가 무엇을 잘못했는지 모른 채 깨끗한 그래프만 낸다.
  let st = initialState(2);
  st = reduce(st, { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  st = trial(st, { tempC: 30 });
  st = trial(st, { tempC: 20, glucosePct: 5 });   // 통제변인이 어긋난 시행
  assert.equal(st.trials.length, 2);
  assert.ok(st.trials[1].offDesign.length > 0);

  const html = buildSheet(st, {});
  assert.ok(html.includes(UI.conditions.glucosePct), '어긋난 조건의 이름이 종이에 없습니다');
});

/** 탐구 과정 절만 오려낸다. 종이 전체를 세면 다른 절의 빈칸까지 딸려 와 수가 뭉개진다. */
function processSection(html) {
  const from = html.indexOf(UI.report.sections.process);
  const to = html.indexOf('</section>', from);
  assert.ok(from >= 0 && to > from, '종이에 탐구 과정 절이 없습니다');
  return html.slice(from, to);
}

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  const html = buildSheet(initialState(1), {});
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');
  // **탐구 과정 절 안에서** 센다. 종이 전체를 세면 예상·정리 절의 빈칸이 수를 채워 줘서,
  // 탐구 과정에서 빈칸이 다섯 개 사라져도 검사가 초록불로 남는다. 실제로 그랬다.
  const shown = (processSection(html).match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  assert.ok(shown > 0, '탐구 과정 절에 빈칸 표시가 하나도 없습니다');
});

test('종이가 기록칸 없던 단계를 「적지 않았습니다」로 찍지 않는다', () => {
  // 화면에서 관찰 기록 칸을 열세 칸에서 여덟 칸으로 줄였다. 종이가 그대로 열세 칸을 찍으면
  // **학생이 건너뛴 적 없는 일을 건너뛴 것처럼** 보이게 된다 — 선생님이 종이만 보고 그렇게 읽는다.
  // micrometer-lab 이 이걸 놓쳐서 열 칸에 「적지 않았습니다」가 달렸다.
  const blanks = (processSection(buildSheet(initialState(1), {}))
    .match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  const noteCells = UI.protocol.flatMap((g) => g.steps).filter((s) => s.note).length;
  assert.equal(blanks, noteCells,
    `탐구 과정 절의 빈칸 ${blanks}개가 화면의 기록칸 ${noteCells}개와 다릅니다`);
});

test('칸이 없던 세부 단계도 제목은 종이에 남는다', () => {
  // 빈칸을 지운다고 줄까지 지우면, 종이만 보고는 그 절차를 하기는 했는지 알 수 없다.
  const section = processSection(buildSheet(initialState(1), {}));
  for (const s of UI.protocol.flatMap((g) => g.steps).filter((x) => !x.note)) {
    assert.ok(section.includes(s.label), `「${s.label}」 이 종이에서 통째로 사라졌습니다`);
  }
});

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' });
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
});

test('혼자 한 활동지에는 모둠 문항이 아예 안 실린다', () => {
  // 답할 수 없었던 문항이 빈칸으로 남으면 「안 한 일」로 읽힌다.
  const solo = buildSheet(filled(), {}, 'solo');
  const group = buildSheet(filled(), {}, 'group');
  assert.ok(!solo.includes(UI.notebook.q6Label), '개별 활동지에 모둠 비교 문항이 있습니다');
  assert.ok(group.includes(UI.notebook.q6Label), '모둠 활동지에 모둠 비교 문항이 없습니다');
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  // 이 글은 학생 자기 화면에만 들어가지만, 보고서로 인쇄돼 남에게 건네진다.
  // 따옴표까지 막지 않으면 속성 안에 들어갈 때 새 속성을 붙일 수 있다.
  let st = initialState(1);
  const payload = '<img src=x onerror=alert(1)>" onfocus="alert(2)';
  for (const step of ['q2', 'predict', '1a', 'feedback.learned']) st = put(st, step, payload);
  const html = buildSheet(st, { name: payload });
  // 「onerror=alert」라는 **글자**는 남는다 — 그게 학생이 쓴 내용이고, 글자로 보이는 것이 맞다.
  // 봐야 할 것은 그것이 태그나 속성으로 **해석되는가**다.
  assert.ok(!html.includes('<img src=x'), '학생이 쓴 태그가 그대로 들어갔습니다');
  assert.ok(!html.includes('" onfocus='), '따옴표로 속성을 빠져나갈 수 있습니다');
  assert.ok(html.includes('&lt;img'), '글자로는 남아 있어야 합니다');
  assert.ok(html.includes('&quot;'), '따옴표가 인코딩되지 않았습니다');
});

test('보고서를 만드는 것이 상태를 바꾸지 않는다', () => {
  // 종이를 뽑는 것은 읽기만 하는 일이다. 상태가 바뀌면 되돌리기 기록에 남는다.
  const st = filled();
  const before = JSON.stringify(st);
  buildSheet(st, { name: '홍길동' });
  assert.equal(JSON.stringify(st), before);
});

/* ---------------- 줄인 제출물로도 같은 종이가 나오는가 ---------------- */

/**
 * **이 검사가 제출물을 줄일 수 있게 해 주는 근거다.**
 *
 * 예전에는 상태를 통째로(되돌리기 기록만 빼고) 보냈다. 그러자 보고서가 한 번도 안 읽는 것들이
 * 함께 나갔다 — 학생이 무엇을 어떤 차례로 눌렀는지, 실험대에 마지막으로 놓여 있던 것 같은.
 *
 * 이제 **보낼 것만 적는다**. 그렇게 줄여도 되는 유일한 근거는 「줄인 것만으로 같은 종이가
 * 나온다」이고, 그것을 여기서 확인한다. 목록에서 하나라도 빠지면 종이가 달라져 빨간불이 난다.
 */
test('제출한 값만으로 선생님 화면이 같은 종이를 다시 만든다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const st = filled();
  const who = { name: '홍길동', grade: '2', classNo: '4', number: '17' };

  const sent = payloadOf(st, { school: '', team: '' }, 'group').state;
  assert.equal(buildSheet(sent, who, 'group'), buildSheet(st, who, 'group'),
    '보낸 값만으로는 같은 종이가 안 나옵니다 — SUBMIT_SESSION_KEYS 에 빠진 것이 있습니다');
  assert.equal(buildSheet(sent, who, 'solo'), buildSheet(st, who, 'solo'));
});

/**
 * **군더더기가 없다는 근거.**
 *
 * 위 검사는 「보낸 값만으로 같은 종이가 나온다」는 것이고, 그것은 *빠진 것이 없다*는 말이지
 * *군더더기가 없다*는 말이 아니다. 목록에 쓸데없는 키를 더 넣어도 그 등식은 그대로 성립한다.
 *
 * 그래서 **키를 하나씩 빼 보며 종이가 달라지는지** 본다. 빼도 종이가 그대로면 그 키는
 * 종이에 안 쓰이는 것이고, 안 쓰이는 것을 받는 것은 고지가 아니라 **수집**이다.
 */
test('제출 목록의 키는 하나도 군더더기가 아니다 — 빼면 종이가 달라진다', async () => {
  const { payloadOf, SUBMIT_SESSION_KEYS } = await import('../src/ui/report.js');
  const st = filled();
  const who = { name: '홍길동', grade: '2', classNo: '4', number: '17' };
  const full = payloadOf(st, { school: '○○고', team: '3모둠' }, 'group').state;
  const paper = buildSheet(full, who, 'group');

  /**
   * 빼고 나서 종이를 만들어 본다.
   *
   * **던지는 것도 「달라졌다」로 친다.** 없으면 종이를 아예 못 만드는 칸은 두말할 것 없이
   * 쓰이는 칸이다. 던지는 것을 통과로 치면 검사가 거꾸로 선다.
   */
  const differs = (without) => {
    try {
      return buildSheet(without, who, 'group') !== paper;
    } catch {
      return true;
    }
  };

  // state 의 큰 칸부터
  for (const key of Object.keys(full)) {
    if (key === 'session') continue;
    const without = { ...full };
    delete without[key];
    assert.ok(differs(without),
      `state.${key} 를 빼도 종이가 그대로입니다 — 종이에 안 쓰이는 것을 받고 있습니다`);
  }
  // session 안의 칸 하나씩
  for (const key of SUBMIT_SESSION_KEYS) {
    const without = { ...full, session: { ...full.session } };
    delete without.session[key];
    assert.ok(differs(without),
      `session.${key} 를 빼도 종이가 그대로입니다 — 종이에 안 쓰이는 것을 받고 있습니다`);
  }
});

test('보고서가 안 읽는 것은 보내지 않는다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const sent = payloadOf(filled(), {}, 'group').state;
  // 실험대 상태와 조작 차례는 종이에 안 실린다. 실리지 않는 것을 보낼 이유가 없다.
  assert.equal(sent.bench, undefined, '실험대 상태가 나갑니다');
  assert.equal(sent.session.log, undefined, '학생이 무엇을 눌렀는지가 나갑니다');
  assert.equal(sent.session.history, undefined, '되돌리기 기록이 나갑니다');
  assert.equal(sent.session.seed, undefined, '쓰이지 않는 시드가 나갑니다');
});

/**
 * 상태에 칸이 새로 생겨도 **저절로 나가지 않는다.**
 *
 * 「빼야 할 것을 뺀다」였을 때는 새 칸이 생길 때마다 조용히 새어 나갔다.
 * 지금은 목록에 적은 것만 나가므로, 새 칸은 사람이 적어 넣기 전에는 안 나간다.
 */
test('상태에 새 칸이 생겨도 저절로 나가지 않는다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const st = filled();
  const withExtra = {
    ...st,
    비밀: '이건 나가면 안 된다',
    session: { ...st.session, 비밀2: '이것도' },
  };
  const json = JSON.stringify(payloadOf(withExtra, {}, 'solo'));
  assert.ok(!json.includes('이건 나가면 안 된다'), '상태의 새 칸이 그대로 나갔습니다');
  assert.ok(!json.includes('이것도'), 'session 의 새 칸이 그대로 나갔습니다');
});

/**
 * 가치·태도 절은 **학생이 무엇을 했는지 읽지 않는다.** (정본 `banana-lab` 과 같은 검사)
 *
 * 예전에는 이 절이 「손을 씻었는가」를 적었다. 그 판정을 통째로 걷어냈다 — 가상 실험에서
 * 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다.
 *
 * 그러니 이 절은 **상태와 무관하게 늘 같은 글**이어야 한다. 무엇을 했든 안 했든 똑같다.
 * 여기가 상태를 다시 읽기 시작하면 제출 계약(`SUBMIT_SESSION_KEYS`)도 함께 깨지는데,
 * 그때는 **선생님 화면에서만** 조용히 달라져서 학생 화면으로는 알 수가 없다.
 */
test('가치·태도 절은 학생이 무엇을 했는지 읽지 않는다', () => {
  /*
   * **그 절만 오려 낸다.** 예전에는 「표제부터 문서 끝까지」로 잘랐는데, 그건 안전 안내가
   * 종이의 **맨 끝**에 있을 때만 맞는 말이었다. 준비물 옆으로 옮기고 나니 그 뒤로 종이
   * 전체가 딸려 와서, 학생이 적은 것이 달라질 때마다 이 검사가 빨간불을 냈다 —
   * **검사가 재려던 것과 다른 것을 재고 있었다.**
   */
  const cut = (html) => {
    const from = html.indexOf(UI.notebook.valuesLabel);
    assert.ok(from >= 0, '종이에 안전 안내가 없습니다');
    return html.slice(from, html.indexOf('</section>', from));
  };
  const empty = cut(buildSheet(initialState(2), {}));
  const busy = cut(buildSheet(filled(), {}));
  assert.equal(empty, busy,
    '가치·태도 절이 학생이 한 일에 따라 달라집니다 — 적어만 두기로 한 자리입니다');

  // 「늘 같다」만 보면 **늘 비어 있어도** 통과한다. 안내가 실제로 실렸는지도 본다.
  for (const line of UI.notebook.valuesWatched) {
    assert.ok(busy.includes(line.slice(0, 12)), `안내 한 줄이 종이에 없습니다: ${line}`);
  }
  assert.ok(busy.includes(UI.notebook.valuesNotChecked.slice(0, 20)),
    '「이 시뮬레이터는 확인하지 않습니다」가 종이에 없습니다');
});

/** 화면과 종이가 **글자 그대로 같은 글**을 쓰는가. 둘이 갈리면 학생이 낸 종이와 화면이 달라진다. */
test('안전 안내는 화면과 종이가 같은 문자열을 쓴다', () => {
  const paper = buildSheet(filled(), {});
  for (const line of UI.notebook.valuesWatched) {
    assert.ok(paper.includes(line), `종이에 없는 줄: ${line}`);
  }
  assert.ok(paper.includes(UI.notebook.valuesNotChecked));
});
