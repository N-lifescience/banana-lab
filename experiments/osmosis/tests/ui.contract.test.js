/**
 * UI 계약 테스트.
 *
 * 화면을 띄우지 않고도 확실히 판정되는 것만 검사한다.
 * 눈으로 봐야 아는 것(배치가 예쁜가, 크기 감각이 맞는가)은 여기 넣지 않는다 —
 * 애매한 검사가 한 번 헛발질하면 그 뒤로 아무도 `npm run check` 를 믿지 않는다.
 *
 * 여기 없는 항목은 사람이 본다: tasks/T04-interaction-ui.md 의 합격 기준.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { observability } from '../src/sim/quality.js';
import { initialState, UNDO_LIMITS } from '../src/sim/state.js';
import { reduce, ACTIONS } from '../src/sim/rules.js';
import { UI } from '../src/ui/strings.js';
import { CONDITIONS } from '../src/sim/progress.js';

const UI_DIR = new URL('../src/ui/', import.meta.url);

/**
 * src/ui/ 안의 .js 파일을 전부 읽어 [이름, **주석을 걷어낸** 내용] 으로 돌려준다.
 *
 * 주석을 그대로 두면 거짓 양성이 난다. 이 저장소의 주석은 「disabled 로 막지 않는다」
 * 처럼 금지어를 그대로 적고 있어서, 설명문을 코드로 오해한다 — 실제로 그렇게 잡혔다.
 * 주석까지 훑는 검사는 못 잡는 것보다 나쁘다. 한 번 헛발질하면 아무도 안 믿는다
 * (`PLAYBOOK.md` §7). `tests/report.test.js` 도 같은 이유로 같은 일을 한다.
 */
function uiSources() {
  const dir = new URL('.', UI_DIR);
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => [f, strip(readFileSync(new URL(f, UI_DIR), 'utf8'))]);
}

/* ---------------- 문자열 표가 상태를 전부 덮는가 ---------------- */

test('observability 가 돌려주는 worst 는 모두 사람이 읽는 말이 있다', () => {
  // 하나라도 빠지면 화면에 undefined 가 뜬다. quality.js 에 항목을 추가하고
  // strings.js 를 잊는 것이 흔한 실수라 기계가 지킨다.
  const { factors } = observability({});
  for (const key of Object.keys(factors)) {
    assert.equal(typeof UI.observability.worst[key], 'string',
      `UI.observability.worst.${key} 가 없습니다 — 게이지에 undefined 가 뜹니다`);
  }
});

test('실제로 나올 수 있는 worst 값이 모두 문자열 표에 있다', () => {
  // 항목마다 그 항목만 최악이 되는 상태를 만들어 worst 를 실제로 뽑아 본다.
  // **가장 잘 보이는 배율은 100배다** — 이 실험이 재는 것은 「몇 개 중 몇 개」이고,
  // 400배는 시야에 세포가 몇 개 없어 비율을 잴 수 없다 (quality.magnificationFactor).
  const best = { coverage: 1, excess: 0, focusErr: 0, brightness: 1, objective: 10, side: 'outer' };
  const cases = [
    { ...best, coverage: 0 },
    { ...best, focusErr: 2, objective: 40 },
    { ...best, brightness: 0 },
    { ...best, tooThick: true },
    { ...best, bubbles: 6 },
    { ...best, objective: 4 },
    { ...best, lensTouched: true },
    { ...best, side: 'inner' },
  ];
  for (const c of cases) {
    const { worst } = observability(c);
    assert.equal(typeof UI.observability.worst[worst], 'string',
      `worst='${worst}' 에 해당하는 문자열이 없습니다`);
  }
  // 아무것도 안 깎였으면 worst 는 없다. 그때 쓸 문구가 따로 있어야 한다 —
  // 없으면 게이지가 "지금 가장 크게 깎이는 항목: undefined" 를 띄운다.
  {
    const perfect = observability(best);
    assert.equal(perfect.worst, null, '완벽한데도 깎인 항목을 지어내면 안 된다');
    assert.equal(typeof UI.observability.allGood, 'string');
  }
});

/* ---------------- 되돌리기 표시 ---------------- */

test('되돌리기 횟수가 무제한일 때 쓸 표기가 있다', () => {
  // 1단계 undosLeft 는 Infinity 라, 그대로 그리면 "Infinity회 남음" 이 나온다.
  assert.equal(UNDO_LIMITS[1], Infinity, '1단계는 무제한이어야 합니다');
  assert.equal(initialState(1).session.undosLeft, Infinity);
  assert.ok(UI.undo && typeof UI.undo.unlimited === 'string',
    'UI.undo.unlimited 이 필요합니다 — 화면에 Infinity 가 뜨지 않게 하기 위함입니다');
  assert.ok(!/Infinity/.test(UI.undo.unlimited));
});

/* ---------------- 설계 원칙 회귀 테스트 ---------------- */

test('UI 는 포인터 이벤트만 쓴다 — 마우스/터치 전용 이벤트 금지', () => {
  // 태블릿 대응. mouse* 와 touch* 를 섞으면 한쪽에서만 동작하는 조작이 생긴다.
  const banned = /\b(mousedown|mousemove|mouseup|touchstart|touchmove|touchend)\b/;
  for (const [name, src] of uiSources()) {
    const hit = src.match(banned);
    assert.equal(hit, null,
      `src/ui/${name} 에 ${hit?.[0]} 이 있습니다 — pointerdown/pointermove/pointerup 을 쓰세요`);
  }
});

/*
 * 실험대 조작은 막지 않는다 (AGENTS.md §2.1). 누를 수 있어야 하고, 누른 결과가 시야에
 * 나타나는 것이 설계다.
 *
 * ── `aria-disabled` 는 예외다 ──────────────────────────────────────
 * 탐구 노트에서 **예상을 적기 전에 「읽었습니다」를 누르는 것**은 막는다. 실험대 조작이
 * 아니라 노트의 진행 순서라 §2.1 이 말하는 자리가 아니다.
 *
 * 그때도 **`disabled` 는 쓰지 않는다.** `disabled` 단추는 포커스를 받지 못해서, 키보드나
 * 낭독기로 오는 학생은 **왜 못 누르는지 들을 길이 아예 없다** — 막아 놓고 이유를 안
 * 알려 주는 셈이 된다. `aria-disabled` 로 알리고 이유를 `aria-describedby` 로 묶는다.
 *
 * 그래서 금지어를 지우지 않고 **좁혔다.** `aria-` 가 앞에 붙은 것만 통과한다.
 */
test('UI 는 버튼을 disabled 로 막지 않는다 (aria-disabled 는 된다)', () => {
  const banned = /(?<!aria-)\bdisabled\b/;
  for (const [name, src] of uiSources()) {
    assert.equal(banned.test(src), false,
      `src/ui/${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md 2.1). ` +
      '노트 진행을 막아야 한다면 aria-disabled 를 쓰세요 — disabled 는 포커스를 빼앗아 ' +
      '왜 못 누르는지 들을 길을 없앱니다.');
  }
  if (existsSync(new URL('../index.html', import.meta.url))) {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.equal(banned.test(html), false, 'index.html 에 disabled 가 있습니다');
  }
});

test('UI 는 상태를 직접 고치지 않고 reduce 를 거친다', () => {
  // src/sim/ 은 DOM 을 모르고, UI 는 상태를 직접 만지지 않는다. 이 경계가 있어야
  // 규칙을 node --test 로 검증할 수 있다.
  for (const [name, src] of uiSources()) {
    if (name === 'strings.js') continue;
    assert.equal(/\bfrom ['"]\.\.\/sim\/state\.js['"]/.test(src) && /state\.\w+\s*=/.test(src), false,
      `src/ui/${name} 이 상태를 직접 대입합니다 — reduce(state, action) 을 쓰세요`);
  }
});

test('탐구 과정의 예시 문구가 세부 단계마다 다르다', () => {
  // 스무 칸에 같은 문장을 띄우면 무엇을 적으라는 건지 알려 주지 못하고,
  // 그 자리에서 관찰한 것이 아니라 앞 칸을 베끼게 만든다. 실제로 그랬다.
  const egs = UI.protocol.flatMap((g) => g.steps.map((s) => s.eg));
  for (const [i, eg] of egs.entries()) {
    assert.equal(typeof eg, 'string', `${i}번째 세부 단계에 예시 문구가 없습니다`);
    assert.ok(eg.trim().length > 0, `${i}번째 세부 단계의 예시 문구가 비었습니다`);
  }
  assert.equal(new Set(egs).size, egs.length,
    `예시 문구가 겹칩니다 — ${egs.length}칸에 서로 다른 ${new Set(egs).size}개뿐입니다`);
  // 3단계(예상)의 예시도 같은 이유로 **조건마다** 달라야 한다.
  // 예상하는 단위는 받침 유리가 아니라 조건이다 — 유리 석 장은 여벌일 뿐이라,
  // 유리별로 물으면 학생이 같은 것을 세 번 예상하게 된다 (src/sim/progress.js).
  for (const map of [UI.notebook.predictWhyPlaceholder, UI.notebook.predictFreePlaceholder]) {
    const eg = CONDITIONS.map((id) => map[id]);
    for (const [i, s] of eg.entries()) {
      assert.ok(typeof s === 'string' && s.trim(), `예상 ${CONDITIONS[i]} 칸에 예시 문구가 없습니다`);
    }
    assert.equal(new Set(eg).size, CONDITIONS.length, `예상 칸의 예시 문구가 겹칩니다 — ${JSON.stringify(eg)}`);
  }
  // 조건마다 제목이 있어야 한다 — 없으면 예상 칸 머리에 undefined 가 뜬다.
  for (const id of CONDITIONS) {
    assert.equal(typeof UI.notebook.conditions[id]?.title, 'string', `조건 ${id} 의 제목이 없습니다`);
  }
  // 세부 단계 이름도 함께 확인한다. 구조를 { label, eg } 로 바꿨으므로 label 이 있어야 한다.
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      assert.equal(typeof s.label, 'string', `STEP ${g.id} 에 label 없는 세부 단계가 있습니다`);
    }
  }
});

test('자기 평가는 난이도와 무관하게 같다', () => {
  // 자기를 돌아보는 일에 난이도를 매길 이유가 없다. 점수를 합산하지도 등급을 내지도 않는다.
  assert.equal(UI.notebook.likertScale.length, 5, '리커트 5점 척도여야 한다');
  const values = UI.notebook.likertScale.map((s) => s.value);
  assert.deepEqual(values, ['1', '2', '3', '4', '5']);
  for (const s of UI.notebook.likertScale) {
    assert.ok(s.label && s.label.trim(), `척도 ${s.value} 에 사람이 읽는 말이 없습니다`);
  }
  assert.ok(UI.notebook.selfEvalItems.length >= 3, '자기 평가 문항이 너무 적습니다');
  for (const it of UI.notebook.selfEvalItems) {
    assert.ok(it.key && it.label, '자기 평가 문항에 key 나 label 이 없습니다');
  }
  // 척도로는 안 남는 것 — 소감을 서술로 받는 자리가 있어야 한다.
  assert.ok(UI.notebook.reflectionItems.length >= 1, '느낀 점을 적을 자리가 없습니다');
  for (const it of UI.notebook.reflectionItems) {
    assert.ok(it.key && it.label && it.eg, '느낀 점 문항에 key·label·eg 가 모두 있어야 합니다');
  }
  const keys = UI.notebook.reflectionItems.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, '느낀 점 문항 키가 겹칩니다');
});

test('절차 그룹 수에 상한을 박아 두지 않는다', async () => {
  // 예전에는 `/^[1-6][a-z]?$/` 가 박혀 있었다. 바나나랩 절차가 여섯이라 맞아떨어졌지만
  // 그건 **이 실험의 사정**이었다. 일곱 번째 그룹을 둔 실험은 그 그룹의 관찰 기록이
  // 6단계 복습과 보고서에서 조용히 사라진다 — 빈칸이 뜨는 게 아니라 줄이 안 나오므로
  // 아무도 모른다. micrometer 파일럿에서 잡혔다.
  const { isStepNoteKey, stepNoteLabel } = await import('../src/ui/notebook.js');

  for (const group of UI.protocol) {
    assert.ok(isStepNoteKey(group.id), `STEP ${group.id} 이 절차 기록 키로 안 읽힙니다`);
    assert.match(stepNoteLabel(group.id), new RegExp(`^STEP ${group.id} · `));
    group.steps.forEach((step, i) => {
      const key = `${group.id}${String.fromCharCode(97 + i)}`;
      assert.ok(isStepNoteKey(key), `${key} 가 절차 기록 키로 안 읽힙니다`);
      assert.ok(stepNoteLabel(key).includes(step.label),
        `${key} 의 이름이 세부 단계 이름을 못 찾습니다`);
    });
  }

  // 절차에 없는 id 는 절차 기록이 아니다. 'q.a' 나 'selfeval.x' 가 여기 섞이면 안 된다.
  for (const notAKey of ['q.a', 'selfeval.process', 'predict.A', 'mag.0', '99']) {
    assert.equal(isStepNoteKey(notAKey), false, `${notAKey} 를 절차 기록으로 잘못 읽습니다`);
  }

  // 어느 소스에도 개수 상한을 **코드로** 다시 박지 않았는가.
  // 주석은 사람이 읽는 글이다 — 옛 정규식을 설명하는 문장까지 잡으면 검사가 아니다.
  for (const [name, src] of uiSources()) {
    const code = src.split('\n').map((l) => l.replace(/^\s*(\*|\/\/).*/, '')).join('\n');
    assert.equal(/\[1-6\]\[a-z\]/.test(code), false,
      `src/ui/${name} 에 절차 그룹 수 상한이 박혀 있습니다`);
  }
});

/* ---------------- 실패 안내에 다음 행동이 있는가 ---------------- */

test('뜻대로 안 된 조작마다 1단계에서 보여 줄 다음 행동이 있다', () => {
  // 1단계는 「원인 + 다음 행동」 을 준다 (`PLAYBOOK.md` §5). 태그를 하나 늘려 놓고
  // 여기에 안 적으면 원인만 뜨고 어디로 가야 하는지는 학생이 혼자 찾아야 한다.
  //
  // 「새것을 꺼내세요」 로는 어디서 꺼내는지 알 수 없다 — 그래서 문장에 **곳**이 들어 있는지도 본다.
  const seen = new Set();
  const states = [initialState(1, 4242)];
  {
    let s = initialState(1, 4242);
    for (const [type, payload] of [
      ['CUT_SCALE', {}], ['PEEL_EPIDERMIS', { side: 'outer' }], ['PLACE_SAMPLE', { slide: 'A' }],
      ['FILL_DROPPER', { solution: 'WATER' }], ['DROP', { slide: 'A', count: 2 }],
      ['PICK_COVERSLIP', {}], ['PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 }],
      ['MOUNT', { slide: 'A' }],
    ]) s = reduce(s, { type, payload }).state;
    states.push(s);
  }
  const payloads = {
    PEEL_EPIDERMIS: { side: 'inner' }, PLACE_SAMPLE: { slide: 'A', folded: true },
    FILL_DROPPER: { solution: 'S20' }, DROP: { slide: 'A', count: 5 },
    APPLY_SOLUTION: { slide: 'A' }, WICK: { slide: 'A' },
    PLACE_COVERSLIP: { slide: 'A', angleDeg: 90 }, LIFT_COVERSLIP: { slide: 'A' },
    RINSE_SLIDE: { slide: 'A' }, MOUNT: { slide: 'A' }, NEW_SLIDE: { slide: 'A' },
    SET_OBJECTIVE: { objective: 40 }, COARSE_FOCUS: { delta: 0.4 },
    FINE_FOCUS: { delta: 0.05 }, SET_DIAPHRAGM: { value: 0 },
    SAVE_NOTE: { step: '1a', text: 'x' }, MOVE_STAGE: { dx: 10 },
    DELETE_CAPTURE: { at: 0 }, MARK_READ: { stage: '1' },
    TICK: { seconds: 1 },
  };
  for (const st of states) {
    for (const type of Object.keys(ACTIONS)) {
      const r = reduce(st, { type, payload: payloads[type] ?? {} });
      if (r.outcome === 'happened' && r.tag) seen.add(r.tag);
    }
  }
  assert.ok(seen.size > 5, `이 검사가 아무것도 안 보고 있습니다 — 태그를 ${seen.size}개밖에 못 만났습니다`);
  /**
   * 뜻대로 **된** 일인데 `happened` 로 나오는 것. 갈 곳이 따로 없다.
   * 되돌리기는 학생이 시킨 일을 그대로 했을 뿐이라, 「다음에 무엇을 하세요」 를 붙이면
   * 잘한 조작에 잔소리가 붙는다. 목록을 늘리기 전에 **정말 실패가 아닌지** 따져 볼 것.
   */
  const notAFailure = new Set(['undo']);
  for (const tag of seen) {
    if (notAFailure.has(tag)) continue;
    assert.equal(typeof UI.toast.nextAction[tag], 'string',
      `태그 '${tag}' 에 다음 행동이 없습니다 — 1단계에서 원인만 뜨고 어디로 가야 하는지는 안 알려 줍니다`);
  }
});

/* ---------------- 화면이 답을 먼저 말하지 않는가 ---------------- */

test('화면 코드가 원형질분리 세포의 비율을 세지 않는다', () => {
  // 그 비율을 시야에서 읽어 내는 것이 이 실험의 탐구다. 화면이 세어 주면
  // 정리 단계의 「절반이 변한 농도」 물음이 받아쓰기가 된다
  // (`docs/04-interaction-rules.md` 「화면이 답을 먼저 말하지 않는다」).
  //
  // 하네스(`src/harness.js`)는 예외다 — 모형이 뜻대로 도는지 개발자가 보는 화면이고,
  // 그 숫자 옆에 「앱 화면에는 나오지 않습니다」 라고 적혀 있다.
  for (const [name, src] of uiSources()) {
    assert.equal(/plasmolysedFraction|CELL_SAP_PCT/.test(src), false,
      `src/ui/${name} 가 답을 계산합니다 — 세는 것은 학생의 일입니다`);
  }
});
