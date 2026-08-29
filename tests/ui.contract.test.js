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
import { UI } from '../src/ui/strings.js';

const UI_DIR = new URL('../src/ui/', import.meta.url);

/**
 * **금지어를 훑을 때 주석을 걷어낸다.**
 *
 * 금지어 검사는 그 낱말을 **설명에도 쓰게 되므로** 구조적으로 자기 주석을 문다.
 * 「이 저장소는 `disabled` 를 쓰지 않는다」 라고 적어 두면 그 줄이 「쓴다」로 읽힌다 —
 * **규칙을 적어 두는 것이 규칙 위반이 되는 셈이다.**
 *
 * 그러면 사람은 규칙을 지우거나 검사를 지운다. 둘 다 나쁘다.
 * (chromatography 세션이 자기 저장소에서 **네 번째로** 겪고 알려 주었다)
 *
 * 주석만 걷어내고 문자열은 남긴다 — 문자열에 든 `disabled` 는 진짜로 화면에 나간다.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** src/ui/ 안의 .js 파일을 전부 읽어 [이름, 내용] 으로 돌려준다. **주석은 걷어낸다.** */
function uiSources() {
  const dir = new URL('.', UI_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => [f, stripComments(readFileSync(new URL(f, UI_DIR), 'utf8'))]);
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
  // 방울 수는 **시약을 쓴 슬라이드**에서만 깎인다 — 대조군은 안 넣는 것이 맞는 절차다.
  const cases = [
    { reagent: 'IKI', coverage: 0, excess: 0 },
    { focusErr: 2, objective: 40 },
    { brightness: 0 },
    { tooThick: true },
    { bubbles: 6 },
    { objective: 4 },
    { lensTouched: true },
  ];
  for (const c of cases) {
    const { worst } = observability(c);
    assert.equal(typeof UI.observability.worst[worst], 'string',
      `worst='${worst}' 에 해당하는 문자열이 없습니다`);
  }
  // 아무것도 안 깎였으면 worst 는 없다. 그때 쓸 문구가 따로 있어야 한다 —
  // 없으면 게이지가 "지금 가장 크게 깎이는 항목: undefined" 를 띄운다.
  {
    const perfect = observability({ reagent: 'IKI', coverage: 1, excess: 0, focusErr: 0, brightness: 1, objective: 40 });
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

test('UI 는 버튼을 disabled 로 막지 않는다', () => {
  // 이 프로젝트는 잘못된 **조작**을 막지 않는다. 누를 수 있어야 하고,
  // 누른 결과가 시야에 나타나는 것이 설계다. AGENTS.md 2.1 참조.
  //
  // 탐구 노트가 쪽을 넘기는 순서를 막는 자리가 생겼지만, 거기서도 `disabled` 는 안 쓴다 —
  // 그 속성은 포커스를 빼앗아 **왜 못 누르는지 들을 방법까지 없앤다.** `aria-disabled` 를 쓴다.
  // 금지되는 것은 「막는 것」 이 아니라 **`disabled` 라는 수단**이다.
  for (const [name, src] of uiSources()) {
    assert.equal(/(?<!aria-)\bdisabled\b/.test(src), false,
      `src/ui/${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md 2.1)`);
  }
  if (existsSync(new URL('../index.html', import.meta.url))) {
    // HTML 주석도 같은 이유로 걷어낸다.
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(/\bdisabled\b/.test(html), false, 'index.html 에 disabled 가 있습니다');
  }
});

test('탐구 노트가 막는 자리는 하나뿐이고, 왜 막혔는지 말한다', () => {
  // 막는 것 자체보다 **말 없이 막는 것**이 나쁘다. 회색 단추만 두면 학생은 고장으로 읽는다.
  // 그래서 개수를 세고, 그 옆에 이유 문구가 실제로 있는지 본다.
  // 개수를 세는 이유: 하나씩 늘어나는 것은 아무도 안 막는다. 늘리려면 이 줄을 고쳐야 한다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // 화면에 다는 표시만 센다. 아래에서 따로 보는 「눌러도 되돌아가는 줄」 은 표시가 아니다.
  const hits = src.match(/aria-disabled="true"/g) ?? [];
  assert.equal(hits.length, 1,
    `탐구 노트가 막는 자리는 「예상을 세워야 다음 쪽」 하나뿐이어야 합니다 (지금 ${hits.length}개)`);

  /*
   * **표시만 하고 넘기기를 안 막으면 표시가 거짓말이 된다.** 눌렀을 때 되돌아가는 줄이 있어야 한다.
   *
   * ★ 그 판정은 **지금 상태**로 해야 한다. 앞서는 `getAttribute('aria-disabled')` 를 봤는데,
   * 마지막 칸에 적고 곧장 누르면 그 표시가 **적기 전의 값**이라 방금 채운 칸을 못 본 채로
   * 그 누름을 삼켰다. **DOM 표시는 낡을 수 있고, 상태는 안 낡는다.**
   */
  assert.ok(/!predictDone\(store\.getState\(\)\)\) return;/.test(src),
    '막힌 단추를 눌렀을 때 되돌아가는 줄이 없거나, 지금 상태가 아니라 DOM 표시를 보고 있습니다');

  // 그 자리에 붙는 이유 문구 — strings.js 에 있어야 하고 비어 있으면 안 된다.
  assert.ok(typeof UI.notebook.readNeedsPredict === 'string'
    && UI.notebook.readNeedsPredict.trim().length > 0,
    'UI.notebook.readNeedsPredict 가 필요합니다 — 왜 못 누르는지 말해야 합니다');

  // STEP 잠금은 disabled 를 쓰지 않는다(열리는 척하다 안 열리는 것이 가장 나쁘다).
  // 대신 이유를 적는다. 그 문구도 실제로 있어야 한다.
  assert.equal(typeof UI.notebook.stepLockedWhy, 'function',
    'UI.notebook.stepLockedWhy(id) 가 필요합니다 — 어느 STEP 으로 돌아가야 하는지 말해야 합니다');
  assert.ok(UI.notebook.stepLockedWhy('3').includes('3'),
    'stepLockedWhy 는 돌아갈 STEP 번호를 담아야 합니다');
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
  // 3단계(예상)의 예시도 같은 이유로 슬라이드마다 달라야 한다. 여기가 한동안 세 칸 모두
  // 같은 문장이었고, 그건 (가) 대조군에는 아예 맞지도 않는 문장이었다.
  for (const map of [UI.notebook.predictWhyPlaceholder, UI.notebook.predictFreePlaceholder]) {
    const eg = ['A', 'B', 'C'].map((id) => map[id]);
    for (const [i, s] of eg.entries()) {
      assert.ok(typeof s === 'string' && s.trim(), `예상 ${'ABC'[i]} 칸에 예시 문구가 없습니다`);
    }
    assert.equal(new Set(eg).size, 3, `예상 칸의 예시 문구가 겹칩니다 — ${JSON.stringify(eg)}`);
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

/*
 * 문서에 손으로 적어 둔 **되돌리기 횟수**가 아직 상수와 맞는가.
 *
 * ★ **사본이 셋이면 하나는 떠 있다.**
 *   `UNDO_LIMITS` 와 위의 검사들은 **상수를 import** 해서 서로 물려 있다. 그런데
 *   문서 둘(`PLAYBOOK` 의 난이도 표 · `docs/03` 의 설명)은 **손으로 적은 숫자**라
 *   아무 데도 안 물려 있다. 그러면 이렇게 샌다:
 *
 *       상수를 고침 → 검사가 운다 → 그 사람은 **검사만 고치고 지나간다**
 *       → 문서만 옛 값으로 남고, 그 문서를 믿는 다음 사람이 없는 버그를 찾는다
 *
 *   숫자가 적힌 자리를 **세어** 본다 — 둘이면 물려 있고, **셋이면 하나는 떠 있다.**
 *   (웨이브 3 의 germination 세션이 자기 저장소에서 같은 세 겹을 찾아 알려 주었다)
 */
test('문서에 적힌 되돌리기 횟수가 UNDO_LIMITS 와 같다', () => {
  const say = (n) => (n === Infinity ? '무제한' : `${n}회`);

  const playbook = readFileSync(new URL('../PLAYBOOK.md', import.meta.url), 'utf8');
  const row = playbook.match(/^\|\s*되돌리기\s*\|([^|]+)\|([^|]+)\|([^|]+)\|/m);
  // 표를 못 읽었으면 초록불이 아니라 빨간불이다 — 「0줄 중 0줄이 맞다」를 막는다
  assert.ok(row, 'PLAYBOOK 의 난이도 표에서 「되돌리기」 줄을 못 찾았습니다 — 표 모양이 바뀌었습니다');
  const want = [1, 2, 3].map((lv) => say(UNDO_LIMITS[lv]));
  const got = [row[1], row[2], row[3]].map((c) => c.trim());
  assert.deepEqual(got, want,
    `PLAYBOOK 의 난이도 표가 낡았습니다.\n`
    + `  ★ 먼저 **왜 바뀌었는지** 보세요. UNDO_LIMITS 를 일부러 고친 것이 아니면 그쪽이 회귀입니다.\n`
    + `  일부러 고친 것이면 그 줄을 이렇게 바꾸세요:\n`
    + `    | 되돌리기 | ${want.join(' | ')} |`);

  const model = readFileSync(new URL('../docs/03-state-model.md', import.meta.url), 'utf8');
  const phrase = model.match(/되돌리기가\s*(\d+)회뿐인\s*(\d+)단계/);
  assert.ok(phrase, 'docs/03 에서 「되돌리기가 N회뿐인 M단계」를 못 찾았습니다 — 문장 모양이 바뀌었습니다');
  assert.equal(Number(phrase[1]), UNDO_LIMITS[Number(phrase[2])],
    `docs/03 의 설명이 낡았습니다 — 문서 ${phrase[1]}회 / 상수 ${UNDO_LIMITS[Number(phrase[2])]}회`);
});

/*
 * 편집 모드 안내가 **지금 하는 일**을 말하는가.
 *
 * ★ **걷어낸 기능을 설명하는 문장은 기능보다 오래 산다.**
 *   배치를 `placeFreely`(놓은 자리에 그대로) 로 바꾼 뒤에도 안내문은 「선반 또는 작업면에
 *   **자동으로 붙습니다**」라고 배포된 화면에서 말하고 있었다. 사장님 지시가
 *   **「가능한 포지션을 정해 두지 마라」**였으니 화면이 지시와 정반대를 말한 셈이다.
 *   기능이 사라져도 문장은 남고, **사장님은 그 문장을 보고 안 붙는 것을 버그로 여기신다.**
 *   (germination 이 자기 문서에서 같은 얼굴을 찾아 알려 주었다)
 */
test('편집 모드 안내가 「자동으로 붙는다」고 말하지 않는다 (놓은 자리에 그대로 둔다)', () => {
  const bench = readFileSync(new URL('../src/ui/bench.js', import.meta.url), 'utf8');
  // 앞 조건 — 자유 배치가 실제로 있는가. 없으면 이 검사는 엉뚱한 것을 지킨다
  assert.ok(/function placeFreely\(/.test(bench),
    'placeFreely 가 없습니다 — 배치 방식이 바뀌었다면 이 검사와 안내문을 함께 다시 보세요');
  /*
   * ★ **부분일치로 「없다」를 잡으려 들면 반대 뜻이 통과한다.**
   *
   *   「붙는다」를 찾는 정규식이 「붙**지 않**는다」에 걸려, **동작을 붙이기로 되돌려도
   *   초록불**이 나는 자리가 있다. 그래서 **긍정형만** 본다 — `붙습니다` 는
   *   `붙지 않습니다` 에 안 걸린다(「붙지」와 「붙습니다」는 다른 글자다).
   *   (germination 이 자기 검사에서 정확히 이 구멍을 찾아 알려 주었다)
   *
   *   그리고 처음에는 `자동으로 붙습니다` 처럼 **문장 전체**를 찾고 있었다.
   *   그러면 「물건은 선에 붙습니다」로 바꿔 적으면 그냥 지나간다 — **낱말**로 본다.
   */
  assert.ok(!/붙습니다|붙어요|붙는다|자동 정렬|자동으로 맞[춰추]/.test(UI.edit.note),
    `편집 안내가 걷어낸 기능을 설명하고 있습니다: "${UI.edit.note}"\n`
    + '  ★ 지금 코드는 placeFreely — **놓은 자리에 그대로** 둡니다.\n'
    + '  고칠 것은 코드가 아니라 이 문장입니다.');
  assert.ok(/그대로 (남|둡|둔)/.test(UI.edit.note),
    `편집 안내가 「그대로 남는다」를 말하지 않습니다: "${UI.edit.note}"`);

  /*
   * ★ **이름만 보면 몸통이 바뀐 것을 못 본다.**
   *   위 앞 조건은 `placeFreely` 라는 **이름**이 있는지만 본다. 이름을 그대로 두고
   *   **몸통에서 가까운 선으로 스냅**하면 그 앞 조건은 아무것도 안 지킨다.
   *   그래서 몸통이 선 상수를 안 쓰는지까지 본다 — 스냅은 그것 없이는 못 한다.
   */
  const body = bench.slice(bench.indexOf('function placeFreely('));
  const inner = body.slice(0, body.indexOf('\n  }') + 4);
  assert.ok(!/SHELF_MM|SHELF2_MM|SURFACE_MM/.test(inner),
    `placeFreely 가 선 상수를 쓰고 있습니다 — 놓은 자리에 그대로 두는 것이 아닙니다:\n${inner}`);
});
