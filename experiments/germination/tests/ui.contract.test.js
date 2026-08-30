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
import { initialState, UNDO_LIMITS, CONTROL_KEYS } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

const UI_DIR = new URL('../src/ui/', import.meta.url);

/** src/ui/ 안의 .js 파일을 전부 읽어 [이름, 내용] 으로 돌려준다 */
function uiSources() {
  const dir = new URL('.', UI_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => [f, readFileSync(new URL(f, UI_DIR), 'utf8')]);
}

/* ---------------- 문자열 표가 상태를 전부 덮는가 ---------------- */

test('통제변인마다 사람이 읽는 이름이 있다', () => {
  // 하나라도 빠지면 결과 설명에 undefined 가 뜬다. `state.js` 에 조건을 추가하고
  // `strings.js` 를 잊는 것이 흔한 실수라 기계가 지킨다 — 실제로 한 번 그랬다.
  for (const key of CONTROL_KEYS) {
    assert.equal(typeof UI.controls[key], 'string',
      `UI.controls.${key} 가 없습니다 — 어긋난 조건 이름에 undefined 가 뜹니다`);
  }
});

test('통제변인마다 값을 사람 말로 옮기는 자리가 있다', () => {
  // 「통제변인이 다릅니다」로는 무엇을 고쳐야 할지 알 수 없다. 값까지 말해야 한다.
  const V = UI.graph.values;
  assert.equal(typeof V.scoops(2), 'string');
  for (const k of ['btbIn', 'btbOut', 'sealed', 'open']) {
    assert.equal(typeof V[k], 'string', `UI.graph.values.${k} 가 없습니다`);
  }
  for (const k of ['none', 'clear', 'buried']) {
    assert.equal(typeof V.sensor[k], 'string', `센서 상태 ${k} 의 이름이 없습니다`);
  }
});

test('BTB 세 단계에 글자 이름이 있다 — 색만으로 가르지 않는다', () => {
  for (const k of ['blue', 'green', 'yellow']) {
    assert.equal(typeof UI.chamber.btbStages[k], 'string', `${k} 의 이름이 없습니다`);
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

test('UI 는 버튼을 disabled 로 막지 않는다', () => {
  // 이 프로젝트는 잘못된 조작을 막지 않는다. 누를 수 있어야 하고,
  // 누른 결과가 시야에 나타나는 것이 설계다. AGENTS.md 2.1 참조.
  //
  // **`aria-disabled` 는 예외다.** 노트 진행 순서에서 딱 한 곳(예상을 안 쓰고 「읽었습니다」를
  // 누르려 할 때) 쓴다. `disabled` 와 정반대의 물건이다 — `disabled` 는 단추에서
  // **포커스를 빼앗아** 키보드·낭독기로 오는 학생이 **왜 못 누르는지를 들을 길을 없애는데**,
  // `aria-disabled` 는 단추를 살려 둔 채 알리기만 한다. 그래서 이 규칙이 지키려는 것
  // (「막으려면 빠져나갈 길을 문장에 담아라」)을 오히려 지킨다.
  // 금지를 **지우지 않고 좁힌다** — 다른 곳의 회색 단추는 그대로 잡아야 한다.
  //
  // **주석은 빼고 본다.** 「이것을 쓰지 마세요」라고 적어 둔 주석이 그 자리에서 빨간불을
  // 내면, 다음 사람은 규칙을 적는 대신 낱말을 피해 다니게 된다 — 그러면 왜 안 쓰는지가
  // 코드에서 사라진다. 줄 전체가 주석인 것만 걷어낸다. 코드 줄은 손대지 않는다
  // (`'https://…'` 의 `//` 를 주석으로 잘못 읽으면 그 줄의 진짜 위반을 놓친다).
  const banned = /(?<!aria-)\bdisabled\b/;
  const stripComments = (src) => src.split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  for (const [name, src] of uiSources()) {
    assert.equal(banned.test(stripComments(src)), false,
      `src/ui/${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md 2.1)`);
  }
  if (existsSync(new URL('../index.html', import.meta.url))) {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.equal(banned.test(stripComments(html)), false, 'index.html 에 disabled 가 있습니다');
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
  // 3단계(예상)의 예시도 같은 이유로 묻는 것마다 달라야 한다.
  const topics = UI.notebook.predictTopics.map((t) => t.id);
  for (const map of [UI.notebook.predictWhyPlaceholder, UI.notebook.predictFreePlaceholder]) {
    const eg = topics.map((id) => map[id]);
    for (const [i, one] of eg.entries()) {
      assert.ok(typeof one === 'string' && one.trim(), `예상 ${topics[i]} 칸에 예시 문구가 없습니다`);
    }
    assert.equal(new Set(eg).size, topics.length, `예상 칸의 예시 문구가 겹칩니다 — ${JSON.stringify(eg)}`);
  }
  // 보기도 물음마다 달라야 한다 — 같은 보기를 세 번 내면 무엇을 묻는지 알 수 없다.
  for (const id of topics) {
    const opts = UI.notebook.predictOptions[id];
    assert.ok(Array.isArray(opts) && opts.length >= 3, `예상 ${id} 의 보기가 없습니다`);
    assert.equal(new Set(opts).size, opts.length, `예상 ${id} 의 보기가 겹칩니다`);
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

test('안전 수칙을 세던 조작이 소스에 하나도 안 남았다', () => {
  // 「지켰는지 세는」 것을 걷어냈다 — 평가되는 것이 안전 습관이 아니라 화면 속 단추를
  // 눌렀다는 사실이 되기 때문이다. 이름이 하나라도 남아 있으면 어딘가에서 아직 센다.
  const GONE = ['WASH_HANDS', 'CLOSE_CAP', 'DISPOSE_WASTE', 'CHECK_TIDY', 'NOTE_VIOLATION'];
  for (const [name, src] of uiSources()) {
    for (const gone of GONE) {
      assert.ok(!src.includes(gone), `src/ui/${name} 에 ${gone} 이 남아 있습니다`);
    }
  }
  for (const f of ['rules.js', 'state.js', 'progress.js']) {
    const src = readFileSync(new URL(`../src/sim/${f}`, import.meta.url), 'utf8');
    for (const gone of GONE) {
      assert.ok(!src.includes(gone), `src/sim/${f} 에 ${gone} 이 남아 있습니다`);
    }
    assert.ok(!/session\.(tidy|violations)/.test(src), `src/sim/${f} 이 아직 tidy/violations 를 읽습니다`);
  }
});

test('자기 평가 쪽에 ✓/✗ 판정이 하나도 없다', () => {
  // 적어 두기만 한다. 지켰는지 세지 않으므로 표시할 판정도 없다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  // **주석까지 함께 센다.** 좁혀서 세면 「판정 안 한다」고 적어 둔 주석은 통과시키지만,
  // 그 대가로 문자열 안에 숨은 진짜 표시도 놓친다. 넓게 두고, 주석에서는 그 글자를
  // 안 쓰는 쪽을 골랐다 — 이 검사가 한 번이라도 헛발질하면 그 뒤로 아무도 안 믿는다.
  const stage7 = src.slice(src.indexOf('function renderStage7'));
  const body = stage7.slice(0, stage7.indexOf('const STAGE_RENDERERS'));
  assert.ok(!body.includes('✗'), '자기 평가에 ✗ 가 남아 있습니다 — 판정하지 않기로 했습니다');
  assert.ok(!/valuesKept|valuesMissed|noViolations/.test(body),
    '자기 평가가 아직 「지켰다/놓쳤다」를 말합니다');
});

test('안전 안내는 준비물 쪽에 있고 자기 평가 쪽에는 없다', () => {
  // 자기 평가는 **다 끝낸 뒤에** 보는 쪽이다. 「실제 실험에서는 이렇게 하세요」를 거기서
  // 읽으면 이미 늦다 — 재료를 훑는 준비물에서 함께 읽는 것이 맞다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
  const stage2 = cut('function renderStage2', 'function renderStage3');
  const stage7 = cut('function renderStage7', 'const STAGE_RENDERERS');
  assert.ok(stage2.includes('valuesPractice'), '준비물 쪽에 안전 안내가 없습니다');
  assert.ok(stage2.includes('safety-note'), '준비물 쪽 안내가 정본 모양(safety-note)이 아닙니다');
  assert.ok(!stage7.includes('valuesPractice'), '자기 평가 쪽에 안전 안내가 남아 있습니다');
});

test('안전 안내가 두 곳에 갈라져 있지 않다', () => {
  // 옛 `safetyNotes` 와 새 `valuesPractice` 가 둘 다 있으면 같은 말이 두 벌이 되고,
  // 언젠가 달라진다. 하나로 합쳤다.
  assert.equal(UI.notebook.safetyNotes, undefined,
    '옛 safetyNotes 가 남아 있습니다 — valuesPractice 하나로 합치세요');
  assert.ok(Array.isArray(UI.notebook.valuesPractice) && UI.notebook.valuesPractice.length >= 5);
  // 합치면서 없어진 것이 없어야 한다.
  assert.ok(UI.notebook.valuesPractice.some((l) => l.includes('마개')),
    '합치면서 「마개」 안내가 사라졌습니다');
});

test('배치는 놓은 자리에 그대로 둔다 — 앱이 자리를 정하지 않는다', () => {
  // 두 선 중 가까운 쪽에 바닥을 붙이면 **놓을 수 있는 자리를 앱이 정해 버린다.**
  const src = readFileSync(new URL('../src/ui/bench.js', import.meta.url), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(code.includes('placeFreely('), 'placeFreely 가 없습니다');
  assert.ok(!code.includes('snapToLine('), 'snapToLine 이 남아 있습니다 — 자리가 튕겨 나갑니다');
});

test('Ctrl+P 가 인쇄를 뺏지 않는다', () => {
  // Ctrl+P 는 원래 브라우저 인쇄고, 보고서 창은 **그 인쇄로 PDF 를 만든다.**
  // 보고서가 열려 있을 때 가로채면 활동지를 못 뽑는다.
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function bindEditShortcut'), src.indexOf('let store'));
  // **「자식이 있는가」로 보면 안 된다.** `#report` 는 부팅할 때부터 `<dialog>` 를 품고
  // 있어서 그 조건은 늘 참이고, 그러면 Ctrl+P 가 영영 안 먹는다. 실제로 그랬다.
  assert.ok(/#report-dialog\[open\]/.test(fn),
    '보고서가 **열려 있는지**를 안 봅니다 — childElementCount 는 부팅 직후부터 참입니다');
  assert.ok(!/childElementCount/.test(fn),
    'childElementCount 로 보고 있습니다 — 늘 참이라 Ctrl+P 가 영영 안 먹습니다');
  assert.ok(fn.indexOf('#report-dialog[open]') < fn.indexOf('preventDefault'),
    '인쇄를 먼저 가로채고 나서 보고서를 봅니다 — 순서가 거꾸로입니다');
});
