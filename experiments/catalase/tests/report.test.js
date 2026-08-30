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
import { initialState, PH_METHODS } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { buildSheet } from '../src/ui/report.js';
import { UI } from '../src/ui/strings.js';
import { stepNoteLabel } from '../src/ui/notebook.js';

const put = (st, step, text) => reduce(st, { type: 'SAVE_NOTE', payload: { step, text } }).state;

/** 시행 하나를 실제로 끝까지. */
function trial(s, tempC) {
  for (const [type, payload] of [
    ['EMPTY_BEAKER', {}], ['PUNCH_DISC', {}], ['MAKE_EXTRACT', { pct: 100 }], ['SOAK_DISC', {}],
    ['POUR_H2O2', { pct: 3 }], ['SET_PH', { ph: 7, method: PH_METHODS.BUFFER }],
    ['PUT_IN_BATH', { tempC }], ['DROP_DISC', {}],
  ]) s = reduce(s, { type, payload }).state;
  for (let t = 0; t < 300 && !s.bench.beaker.floated; t += 5) {
    s = reduce(s, { type: 'TICK', payload: { seconds: 5 } }).state;
  }
  return reduce(s, { type: 'RECORD_TRIAL' }).state;
}

function filled() {
  let st = initialState(2);
  st = reduce(st, { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  st = trial(st, 37);
  st = trial(st, 20);
  st = put(st, 'predict', '어느 온도까지 빨라지다가 다시 느려진다');
  st = put(st, 'predict.why', '효소도 너무 뜨거우면 못 견딜 것 같아서');
  st = put(st, '1a', '온도를 바꿔 보기로 했다');
  st = put(st, 'qa', '효소가 만든 산소 기포가 원반을 띄웠다');
  st = put(st, 'q2', '37도가 20도보다 빨랐다');
  st = put(st, 'selfeval.process', '4');
  st = put(st, 'feedback.learned', '효소가 온도를 탄다는 것을 알았다');
  return st;
}

test('보고서에 학생이 적은 것과 넣은 이름이 실린다', () => {
  const html = buildSheet(filled(), { name: '홍길동', grade: '2', classNo: '4', number: '17' }, 'group');
  assert.ok(html.includes('홍길동'), '이름이 종이에 없습니다');
  assert.ok(html.includes('어느 온도까지 빨라지다가'), '예상이 종이에 없습니다');
  assert.ok(html.includes('효소도 너무 뜨거우면'), '예상의 까닭이 종이에 없습니다');
  assert.ok(html.includes('온도를 바꿔 보기로 했다'), '탐구 과정 기록이 종이에 없습니다');
  assert.ok(html.includes('효소가 온도를 탄다'), '느낀 점이 종이에 없습니다');
  // 리커트는 숫자만 적으면 무슨 뜻인지 모른다. 뜻을 함께 싣는다.
  assert.ok(html.includes('4 · 그렇다'), '자기 평가 점수의 뜻이 종이에 없습니다');
});

test('실험 설계와 시행이 종이에 실린다', () => {
  // 무엇을 바꾸기로 했는지가 이 보고서의 전제다. 없으면 결과를 읽을 수 없다.
  const html = buildSheet(filled(), {}, 'group');
  assert.ok(html.includes(UI.report.designLabel), '실험 설계가 종이에 없습니다');
  assert.ok(html.includes(UI.variables.temp.name), '무엇을 바꿨는지가 종이에 없습니다');
  assert.ok(html.includes('37 ℃') && html.includes('20 ℃'), '시행이 종이에 없습니다');
  assert.ok(html.includes('data-render="graph"'), '그래프가 종이에 없습니다');
});

test('안 뜬 시행과 어긋난 시행도 종이에 그대로 실린다', () => {
  // 종이에서 지우면 학생은 자기가 무엇을 잘못했는지 모른 채 깨끗한 그래프만 낸다.
  let st = initialState(2);
  st = reduce(st, { type: 'SET_INDEPENDENT', payload: { variable: 'temp' } }).state;
  st = trial(st, 37);
  // 통제변인을 어긋나게 한 시행
  for (const [type, payload] of [
    ['EMPTY_BEAKER', {}], ['PUNCH_DISC', {}], ['MAKE_EXTRACT', { pct: 100 }], ['SOAK_DISC', {}],
    ['POUR_H2O2', { pct: 1 }], ['PUT_IN_BATH', { tempC: 20 }], ['DROP_DISC', {}],
  ]) st = reduce(st, { type, payload }).state;
  for (let t = 0; t < 300 && !st.bench.beaker.floated; t += 5) {
    st = reduce(st, { type: 'TICK', payload: { seconds: 5 } }).state;
  }
  st = reduce(st, { type: 'RECORD_TRIAL' }).state;
  assert.equal(st.trials.length, 2);
  assert.ok(st.trials[1].offDesign.length > 0);

  const html = buildSheet(st, {}, 'group');
  assert.ok(html.includes(UI.conditions.h2o2Pct), '어긋난 조건의 이름이 종이에 없습니다');
});

test('적지 않은 칸도 종이에 남는다 — 어디를 건너뛰었는지 보여야 한다', () => {
  const html = buildSheet(initialState(1), {}, 'group');
  assert.ok(html.includes(UI.report.notWritten), '빈칸 표시가 없습니다');
  const steps = UI.protocol.reduce((n, g) => n + g.steps.length, 0);
  const shown = (html.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;
  assert.ok(shown >= steps, `세부 단계 ${steps}칸 중 ${shown}칸만 실렸습니다`);
});

test('넣지 않은 개인정보 칸은 종이에 아예 나오지 않는다', () => {
  const html = buildSheet(initialState(1), { name: '홍길동' }, 'group');
  assert.ok(html.includes('홍길동'));
  assert.ok(!html.includes('>학교<'), '비워 둔 학교 칸이 종이에 빈 항목으로 남습니다');
});

test('혼자 한 활동지에는 모둠 문항이 아예 안 실린다', () => {
  // 답할 수 없었던 문항이 빈칸으로 남으면 「안 한 일」로 읽힌다.
  const solo = buildSheet(filled(), {}, 'solo');
  const group = buildSheet(filled(), {}, 'group');
  assert.ok(!solo.includes(UI.notebook.q5Label), '개별 활동지에 모둠 비교 문항이 있습니다');
  assert.ok(group.includes(UI.notebook.q5Label), '모둠 활동지에 모둠 비교 문항이 없습니다');
});

test('학생이 쓴 글은 태그로 해석되지 않는다', () => {
  // 이 글은 학생 자기 화면에만 들어가지만, 보고서로 인쇄돼 남에게 건네진다.
  // 따옴표까지 막지 않으면 속성 안에 들어갈 때 새 속성을 붙일 수 있다.
  let st = initialState(1);
  const payload = '<img src=x onerror=alert(1)>" onfocus="alert(2)';
  for (const step of ['q2', 'predict', '1a', 'feedback.learned']) st = put(st, step, payload);
  const html = buildSheet(st, { name: payload }, 'group');
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
  buildSheet(st, { name: '홍길동' }, 'group');
  assert.equal(JSON.stringify(st), before);
});

/* ---------------- 줄인 제출물로도 같은 종이가 나오는가 ---------------- */

/**
 * 부르는 모양을 **한 가지만 재면 놓친다.**
 *
 * 난이도(머리말) · 활동 방식(모둠 문항을 실을지) · 활동지 종류가 서로 다른 절을 켠다.
 * 한 조합만 재면 그 조합이 안 건드리는 칸은 있으나 없으나 같아 보인다.
 *
 * 실제로 물렸다 — **모둠 세션 하나로만 재었더니 `mode` 가 안 쓰이는 것처럼 나왔다.**
 * `isGroup()` 이 `st.session.mode ?? MODES.GROUP` 으로 떨어져 기본값과 같아졌기 때문이다.
 * 혼자 세션에서 재면 달라진다. (osmosis-lab 세션이 같은 자리에서 물렸다)
 */
const SHEET_CASES = [];
for (const level of [1, 2, 3]) {
  for (const mode of ['solo', 'group']) {
    // `kind` 를 **안 넘기는 모양은 재지 않는다.** 앱에도 선생님 화면에도 그렇게 부르는 곳이
    // 없기 때문이다. 재었더니 `session.mode` 가 필요한 것처럼 보였고, 아무도 안 쓰는 칸이
    // 제출물에 남을 뻔했다. 실제로 부르는 모양만 잰다.
    for (const kind of ['solo', 'group']) SHEET_CASES.push({ level, mode, kind });
  }
}

/** 그 조합으로 충분히 채워진 상태 하나. */
function filledAs(level, mode) {
  let st = filled();
  return { ...st, session: { ...st.session, level, mode } };
}

/**
 * **① 보낸 것으로 같은 종이가 나오는가 — 목록이 충분한가.**
 *
 * 제출물을 줄일 수 있게 해 주는 근거다. 선생님 화면은 받은 값으로 `buildSheet()` 를 돌려
 * 같은 종이를 다시 만드니, **줄인 것만으로 같은 종이가 나오면 그것이 전부**다.
 */
test('제출한 값만으로 선생님 화면이 같은 종이를 다시 만든다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const who = { name: '홍길동', grade: '2', classNo: '4', number: '17' };
  for (const { level, mode, kind } of SHEET_CASES) {
    const st = filledAs(level, mode);
    const sent = payloadOf(st, { school: '', team: '' }, kind ?? mode).state;
    assert.equal(buildSheet(sent, who, kind), buildSheet(st, who, kind),
      `${level}단계 · ${mode} · 활동지=${kind}: 보낸 값만으로 같은 종이가 안 나옵니다 `
      + '— SUBMIT_SESSION_KEYS 에 빠진 것이 있습니다');
  }
});

/**
 * **② 하나를 빼면 종이가 달라지는가 — 목록에 군더더기가 없는가.**
 *
 * ①만으로는 「넉넉히 보내면 늘 통과」다. 목록이 **최소**임을 증명하려면 반대 방향이 필요하다.
 * 어느 칸을 빼도 종이가 그대로라면, 그 칸은 보낼 이유가 없다.
 *
 * `MIN_SLOT_MM` 때 배운 것이다 — 되돌려도 아무 검사가 안 걸리는 것은 아무 일도 안 하고 있다.
 */
test('제출 목록에 군더더기가 없다 — 하나만 빼도 종이가 달라진다', async () => {
  const { payloadOf, SUBMIT_SESSION_KEYS } = await import('../src/ui/report.js');
  const who = { name: '홍길동', grade: '2', classNo: '4', number: '17' };

  /** 이 칸을 뺐을 때, 어느 조합에서든 종이가 달라지는가. */
  const matters = (drop) => SHEET_CASES.some(({ level, mode, kind }) => {
    const st = filledAs(level, mode);
    const sent = payloadOf(st, { school: '', team: '' }, kind ?? mode).state;
    const without = drop.startsWith('session.')
      ? { ...sent, session: { ...sent.session, [drop.slice(8)]: undefined } }
      : { ...sent, [drop]: undefined };
    try {
      return buildSheet(without, who, kind) !== buildSheet(sent, who, kind);
    } catch {
      return true;   // 없으면 터진다면 그것도 「필요하다」는 뜻이다
    }
  });

  const dead = ['design', 'trials', ...SUBMIT_SESSION_KEYS.map((k) => `session.${k}`)]
    .filter((key) => !matters(key));
  assert.deepEqual(dead, [],
    `빼도 종이가 그대로인 칸이 있습니다: ${dead.join(', ')} — 보낼 이유가 없습니다`);
});

/**
 * `buildSheet` 는 활동지 종류 없이는 **종이를 만들지 않는다.**
 *
 * 없으면 예전에는 `isGroup(st)` 로 떨어졌다. 그런데 제출물에는 `session.mode` 가 없으므로
 * 선생님 화면에서 그 길로 떨어지면 **혼자 한 학생의 종이가 모둠 활동지로 만들어진다**
 * — 빈칸이 「안 한 일」로 읽히는 바로 그 상황이다.
 *
 * 소스를 훑어 「인자를 셋 넘겼는가」를 세어 볼까 했는데, 정규식이 `store.getState()` 의
 * 괄호에서 끊겨 멀쩡한 호출을 위반으로 짚었다. **문장을 훑는 검사는 또 헛발질한다.**
 * 함수가 스스로 막게 하면 어떤 호출이든 그 자리에서 걸린다.
 */
test('활동지 종류 없이는 보고서를 만들지 않는다', () => {
  for (const kind of [undefined, null, '', 'GROUP', 'both']) {
    assert.throws(() => buildSheet(filled(), {}, kind), /활동지 종류/,
      `kind=${JSON.stringify(kind)} 인데 조용히 종이가 만들어집니다`);
  }
  // 제대로 넘기면 그대로 만들어진다.
  for (const kind of ['solo', 'group']) assert.ok(buildSheet(filled(), {}, kind).length > 0);
});

test('보고서가 안 읽는 것은 보내지 않는다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const sent = payloadOf(filled(), {}, 'group').state;
  // 실험대 상태와 조작 차례는 종이에 안 실린다. 실리지 않는 것을 보낼 이유가 없다.
  assert.equal(sent.bench, undefined, '실험대 상태가 나갑니다');
  assert.equal(sent.session.log, undefined, '학생이 무엇을 눌렀는지가 나갑니다');
  assert.equal(sent.session.history, undefined, '되돌리기 기록이 나갑니다');
  assert.equal(sent.session.seed, undefined, '쓰이지 않는 시드가 나갑니다');
  // 혼자/모둠은 꾸러미 맨 위의 kind 와 제출 표의 칸으로 이미 나간다. 상태 안의 것은 군더더기다.
  assert.equal(sent.session.mode, undefined, '혼자/모둠이 상태 안에도 실려 나갑니다');
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
 * **보고서의 빈칸 수 = 탐구 노트의 기록칸 수.**
 *
 * 허브가 짚어 준 자리다. micrometer 는 기록칸을 17 → 7 로 줄였는데 종이가 여전히
 * 17칸을 찍으면서, **적을 칸을 준 적도 없는 열 칸에 「적지 않았습니다」**를 달았다.
 * 선생님 눈에는 학생이 건너뛴 것으로 읽힌다 — 종이가 학생을 잘못 고발하는 셈이다.
 *
 * 여기는 노트도 종이도 `UI.protocol` 에서 나오므로 **지금은 어긋날 수가 없다.**
 * 그래도 못 박아 둔다. 한쪽에 칸을 손으로 박아 넣는 순간 조용히 갈라지는 자리고,
 * 갈라져도 화면은 멀쩡해 보인다.
 */
test('보고서가 찍는 절차 칸이 탐구 노트의 기록칸과 하나씩 맞는다', () => {
  const html = buildSheet(initialState(1), { school: 'ㅇ', team: '1' }, 'solo');

  // 종이가 찍은 **절차** 칸만 센다. `<li><b>` 는 다른 절에도 있어서 통째로 세면
  // 25칸이 나온다 — 처음에 그렇게 세어 놓고 「종이가 어긋났다」로 읽을 뻔했다.
  const from = html.indexOf(UI.report.sections.process);
  assert.notEqual(from, -1, '종이에 탐구 과정 절이 없다');
  const to = html.indexOf('<section', from);
  const processHtml = html.slice(from, to === -1 ? undefined : to);
  const printed = (processHtml.match(/<li><b>/g) ?? []).length;

  // 노트가 내주는 기록칸 — UI.protocol 의 step 하나가 칸 하나다
  const fields = UI.protocol.reduce((n, g) => n + g.steps.length, 0);

  assert.equal(printed, fields,
    `종이 ${printed}칸 · 노트 ${fields}칸 — 적을 곳을 준 적 없는 칸에 「적지 않았습니다」가 붙는다`);

  // 키도 같은 규칙으로 만들어야 한다. 종이가 `1a`, 노트가 `1-a` 면 값이 영영 안 만난다.
  for (const g of UI.protocol) {
    g.steps.forEach((_, i) => {
      const key = `${g.id}${String.fromCharCode(97 + i)}`;
      assert.equal(stepNoteLabel(key) === null, false,
        `노트가 ${key} 를 모르는 칸으로 본다 — 종이와 키 규칙이 갈라졌다`);
    });
  }
});

/**
 * **꾸러미의 바깥층도 종이가 읽는가.**
 *
 * 위 「군더더기가 없다」 검사는 `state.*` 만 봤다. 그래서 꾸러미 맨 위의 `school`·`team` 은
 * 아무도 안 보고 있었고, 실제로 **`team` 이 새고 있었다** — 폼에서 받고, 제출되고,
 * 선생님 화면이 `buildSheet` 로 넘겨 주는데 종이가 그 칸을 안 그렸다.
 * 모둠 활동지에 모둠 이름이 없었다.
 *
 * 「읽지도 않는 것을 모아 보내지 않는다」는 `violations` 를 뺄 때 세운 규칙인데,
 * **같은 꾸러미의 다른 층에서 그 규칙이 지켜지지 않고 있었다.**
 * 층을 나눠 재면 층 사이가 빈다.
 */
test('꾸러미 맨 위의 칸도 종이가 실제로 읽는다', () => {
  const st = initialState(1);
  const who = { school: 'ZZSCHOOLZZ', team: 'YYTEAMYY', name: '홍길동' };

  // 어느 활동지에서든 한 번은 실려야 한다. 한 종류에만 실리는 칸이 있다(모둠 이름).
  for (const key of ['school', 'team']) {
    const shown = ['solo', 'group'].some((kind) => buildSheet(st, who, kind).includes(who[key]));
    assert.ok(shown,
      `꾸러미는 ${key} 를 보내는데 어느 활동지도 그것을 싣지 않습니다 — 읽거나, 안 받거나 둘 중 하나여야 합니다`);
  }

  // 모둠 이름은 **모둠 활동지에만** 실린다. 개별 활동지에 실리면 안 묻고 받은 것을 싣는 셈이다.
  assert.equal(buildSheet(st, who, 'solo').includes('YYTEAMYY'), false,
    '개별 활동지에 모둠 이름이 실립니다 — 그 종이는 모둠을 묻지 않습니다');
  assert.ok(buildSheet(st, who, 'group').includes('YYTEAMYY'),
    '모둠 활동지에 모둠 이름이 없습니다');
});
