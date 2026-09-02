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
import { reduce } from '../src/sim/rules.js';
import { groupDone } from '../src/sim/progress.js';
import { UI } from '../src/ui/strings.js';
import { BENCH_KINDS } from '../src/ui/bench.js';

const UI_DIR = new URL('../src/ui/', import.meta.url);

/**
 * **금지어를 훑을 때 주석을 걷어낸다.**
 *
 * 금지어 검사는 그 낱말을 **설명에도 쓰게 되므로** 구조적으로 자기 주석을 문다.
 * 「이 저장소는 `disabled` 로 막지 않는다」 라고 적어 두면 그 줄이 「막는다」로 읽힌다 —
 * **규칙을 적어 두는 것이 규칙 위반이 되는 셈이다.**
 *
 * 그러면 사람은 규칙을 지우거나, 문구를 돌려 적어 검사를 피한다. 둘 다 나쁘다.
 * 돌려 적으면 **다음 사람이 또 밟는다** — 여기서 실제로 그렇게 피했다가 되돌렸다.
 *
 * 주석만 걷어내고 **문자열은 남긴다** — 문자열에 든 `disabled` 는 진짜로 화면에 나간다.
 * (바나나랩 c090ac1. chromatography 세션이 네 번째로 겪고 알려 준 것이라 한다)
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
  const full = { separation: 1, mixed: 0, column: 1, bubbles: 0, clot: 0, rulerPlaced: true };
  const cases = [
    { ...full, separation: 0 },
    { ...full, mixed: 1 },
    { ...full, column: 0 },
    { ...full, bubbles: 1 },
    { ...full, clot: 1 },
    { ...full, rulerPlaced: false },
  ];
  for (const c of cases) {
    const { worst } = observability(c);
    assert.equal(typeof UI.observability.worst[worst], 'string',
      `worst='${worst}' 에 해당하는 문자열이 없습니다`);
  }
  // 아무것도 안 깎였으면 worst 는 없다. 그때 쓸 문구가 따로 있어야 한다 —
  // 없으면 게이지가 "지금 가장 크게 깎이는 항목: undefined" 를 띄운다.
  {
    const perfect = observability(full);
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

/**
 * `disabled` 는 막고 `aria-disabled` 는 통과시킨다.
 *
 * `\bdisabled\b` 는 `aria-disabled` **안에서도** 걸린다(`-` 뒤가 낱말 경계라서).
 * 그런데 둘은 정반대의 물건이다 — `disabled` 는 단추를 **죽여서** 포커스도 못 받게 하고,
 * `aria-disabled` 는 단추를 **살려 둔 채** 「지금은 안 된다」 를 알린다.
 * 죽은 단추는 키보드로 오는 학생에게 **왜 안 되는지 들을 길조차 주지 않는다.**
 * 이 검사가 막으려던 것은 죽은 단추이지 상태 알림이 아니다.
 */
const DEAD_CONTROL = /(?<!aria-)\bdisabled\b/;

test('UI 는 버튼을 disabled 로 막지 않는다', () => {
  // 이 프로젝트는 잘못된 조작을 막지 않는다. 누를 수 있어야 하고,
  // 누른 결과가 시야에 나타나는 것이 설계다. AGENTS.md 2.1 참조.
  for (const [name, src] of uiSources()) {
    assert.equal(DEAD_CONTROL.test(src), false,
      `src/ui/${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md 2.1)`);
  }
  if (existsSync(new URL('../index.html', import.meta.url))) {
    // HTML 주석도 같은 이유로 걷어낸다.
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(DEAD_CONTROL.test(html), false, 'index.html 에 disabled 가 있습니다');
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
  // 3단계(예상)의 예시도 같은 이유로 **물음마다 달라야 한다.**
  // 세 칸에 같은 예시를 걸면 학생은 그 한 문장을 세 번 베낀다.
  const items = UI.notebook.predictItems;
  assert.ok(items.length >= 2, '예상이 한 물음뿐이면 견줄 것이 없습니다');
  for (const key of ['why', 'free']) {
    const eg = items.map((it) => it[key]);
    for (const [i, s] of eg.entries()) {
      assert.ok(typeof s === 'string' && s.trim(), `예상 ${items[i].id} 칸에 ${key} 예시가 없습니다`);
    }
    assert.equal(new Set(eg).size, eg.length, `예상 칸의 예시 문구가 겹칩니다 — ${JSON.stringify(eg)}`);
  }
  // 보기도 물음마다 있어야 한다. 1단계는 보기에서 고르는 것이 전부다.
  for (const it of items) {
    assert.ok(Array.isArray(it.options) && it.options.length >= 3,
      `예상 ${it.id} 에 보기가 모자랍니다`);
  }
  // 세부 단계 이름도 함께 확인한다. 구조를 { label, eg } 로 바꿨으므로 label 이 있어야 한다.
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      assert.equal(typeof s.label, 'string', `STEP ${g.id} 에 label 없는 세부 단계가 있습니다`);
    }
  }
});

/* ---------------- 4단계 탐구 과정 — 한 번에 한 STEP ---------------- */

test('관찰 기록 칸은 조작의 결과가 화면에 나오는 칸에만 있다', () => {
  // 열세 칸 전부에 기록칸을 내면 노트가 관찰 기록이 아니라 받아쓰기 숙제가 된다.
  // 「모세관 고르기」 는 했거나 안 했거나이지 관찰할 것이 없다 — ✓ 하나로 충분하다.
  const steps = UI.protocol.flatMap((g) => g.steps);
  const noted = steps.filter((s) => s.note);

  assert.ok(noted.length >= 5 && noted.length <= 9,
    `기록칸이 ${noted.length}칸입니다 — 전부(${steps.length}) 도 아니고 한둘도 아닌 예닐곱쯤이어야 합니다`);
  assert.ok(noted.length < steps.length,
    '모든 세부 단계에 기록칸이 있습니다 — 준비 동작에는 적을 것이 없습니다');

  // STEP 하나가 통째로 말없이 지나가면, 거기서 무엇을 보았는지가 보고서에서 사라진다.
  for (const g of UI.protocol) {
    assert.ok(g.steps.some((s) => s.note),
      `STEP ${g.id} 에 적을 칸이 하나도 없습니다 — 그 STEP 의 관찰이 통째로 사라집니다`);
  }

  // `note` 는 참이거나 없거나 둘 중 하나다. 'false' 같은 글자가 섞이면 조용히 참이 된다.
  for (const s of steps) {
    assert.ok(s.note === true || s.note === undefined,
      `note 는 true 이거나 없어야 합니다 — 「${s.label}」 에 ${JSON.stringify(s.note)} 가 있습니다`);
  }
});

test('한 번에 한 STEP 을 여는 데 필요한 문구가 다 있다', () => {
  // 접힌 STEP 을 눌러서 열 수 있다는 것을 말해 주지 않으면 잠긴 것으로 읽힌다.
  const N = UI.notebook;
  for (const key of ['stepNowBadge', 'stepReopenHint', 'stepPeekHint', 'stepAllDone']) {
    assert.ok(typeof N[key] === 'string' && N[key].trim(), `UI.notebook.${key} 가 없습니다`);
  }
  assert.equal(typeof N.stepProgress, 'function', 'UI.notebook.stepProgress 가 없습니다');
  const line = N.stepProgress(2, UI.protocol.length);
  assert.ok(line.includes('2') && line.includes(String(UI.protocol.length)),
    `몇 칸짜리 여정인지 보여야 합니다 — "${line}"`);
});

test('펼침은 toggle 이 아니라 summary 의 click 으로 기억한다', async () => {
  // **`<details open>` 을 innerHTML 로 꽂으면 브라우저가 삽입만으로 `toggle` 을 한 번 쏜다.**
  // 그것을 들으면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로 연 것」으로 기록되고,
  // 그 STEP 은 끝난 뒤에도 영영 접히지 않는다. 화면을 띄워야만 보이는 종류의 버그라
  // 여기서는 **무엇을 듣고 있는지**만 본다. 실제로 접히는지는 scripts/check-ui.mjs 가 본다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(src, /details\[data-step-group\]\s*>\s*summary['"]\)[\s\S]{0,200}?addEventListener\('click'/,
    'summary 의 click 을 듣고 있지 않습니다');
  assert.equal(/addEventListener\(\s*'toggle'/.test(src), false,
    "toggle 을 듣고 있습니다 — <details open> 은 삽입만으로도 toggle 을 쏩니다");
});

test('질문 ⓐ 는 끈을 당겨 본 뒤에야 접히는 STEP 에 붙어 있다', () => {
  // **STEP 4(밀봉)에 붙어 있었다.** 「방금 회전판을 돌려 보았습니다」 라고 묻는 물음이
  // 돌려 보기도 전에 나왔다. STEP 이 한꺼번에 펼쳐져 있을 때는 스크롤하면 보였으니
  // 눈에 안 띄었지만, **한 번에 한 STEP 이 되자 밀봉이 끝나는 순간 접혀 사라진다** —
  // 학생은 회전판을 돌리고 나서 그 물음을 다시는 못 만난다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const m = /QUESTION_A_STEP\s*=\s*'(\d+)'/.exec(src);
  assert.ok(m, '질문 ⓐ 를 어느 STEP 에 붙였는지 찾을 수 없습니다');
  const gid = m[1];

  // 밀봉하고 회전판에 물리기까지 마친 상태 — **아직 한 번도 당기지 않았다.**
  let st = initialState(1);
  const go = (t, p) => { st = reduce(st, { type: t, payload: p ?? {} }).state; };
  go('SWAB_FINGER');
  go('PICK_CAPILLARY', { kind: 'heparin' });
  for (let i = 0; i < 2; i++) { go('PRICK_FINGER'); go('DRAW_BLOOD', { angleDeg: 35, dwell: 0.9 }); }
  go('SEAL_END', { end: 'outer', press: 0.75 });
  go('SEAL_END', { end: 'inner', press: 0.75 });
  go('LOAD_ROTOR', { slot: 'A', what: 'sample' });
  go('LOAD_ROTOR', { slot: 'B', what: 'counter' });

  assert.equal(groupDone(st, gid), false,
    `질문 ⓐ 가 STEP ${gid} 에 붙어 있는데, 끈을 당기기도 전에 그 STEP 이 끝나 접힙니다`);

  // 화면과 문구가 같은 STEP 을 말해야 한다. 6단계는 「STEP n 을 마치면 옮겨집니다」 라고
  // 적어 두는데, 그 n 이 다르면 학생은 있지도 않은 자리를 찾아 헤맨다.
  assert.ok(UI.notebook.qaNotYet.includes(`STEP ${gid}`),
    `6단계 안내가 다른 STEP 을 가리킵니다 — "${UI.notebook.qaNotYet}" 인데 물음은 STEP ${gid} 에 있습니다`);
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

test('실험대에 없는 준비물은 표에서 그렇다고 말한다', () => {
  // 안전 조작을 걷어내며 손상성 폐기물 통·개수대·휴지를 실험대에서 뺐다. 표에는
  // 「실제 실험에서는 이렇게 한다」로 남겼는데 **아무 표시가 없었다.**
  // 학생이 「손을 씻습니다」를 읽고 개수대를 찾으면 없고, 왜 없는지 화면이 말하지 않는다.
  //
  // 목록을 여기 적지 않는다 — BENCH_KINDS 에서 빠졌는가로 본다. 물건을 도로 넣거나
  // 더 빼도 검사가 따라온다. 적어 두면 그 순간부터 어긋난다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const off = UI.notebook.materials.filter((m) => !BENCH_KINDS.includes(m.asset)).map((m) => m.name);
  assert.ok(off.length > 0, '실험대에 없는 준비물이 하나도 없습니다 — 검사가 헛돌고 있습니다');
  assert.match(src, /BENCH_KINDS\.includes\(asset\)/,
    '준비물 표가 BENCH_KINDS 를 보지 않습니다 — 목록을 손으로 적으면 어긋납니다');
  assert.match(src, /mat-off-tag/, '실험대에 없는 준비물에 붙일 표시가 없습니다');
});

test('실험대만 길게 눌러도 돋보기가 안 뜨게 막는다 — 노트는 건드리지 않는다', () => {
  /*
   * **크로뮴으로는 못 잰다.** `-webkit-touch-callout` 은 계산값에도 CSSOM 에도 안 들어간다 —
   * 파싱 단계에서 버린다. 그러니 브라우저 검사에서 「걸린 규칙 없음」이 나오면 그것은
   * **안 걸린 것이 아니라 못 재는 것**이다. 잴 수 있는 것은 브라우저로, 못 재는 것은
   * 여기 소스로 나눈다. (허브가 정본에서 두 번 헛짚었다)
   *
   * 두 가지를 함께 못 박는다:
   *   ① 실험대 무대에 걸려 있다        — 아이폰에서 길게 누르면 돋보기가 뜬다
   *   ② `touch-action:none` 이 아니다  — 무대에 none 이면 그 위에서 밀 때 쪽이 안 넘어간다
   *   ③ 탐구 노트에는 안 걸려 있다      — 걸면 붙여넣기가 죽는다
   */
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const stage = html.match(/\.bench-stage\s*\{[^}]*\}/)?.[0] ?? '';
  assert.ok(stage, '.bench-stage 규칙을 못 찾았습니다 — 검사가 헛돌고 있습니다');
  assert.match(stage, /-webkit-touch-callout:\s*none/, '실험대에서 길게 누르면 돋보기가 뜹니다');
  assert.match(stage, /touch-action:\s*manipulation/,
    'touch-action 이 manipulation 이 아닙니다 — none 을 걸면 밀어서 쪽을 못 넘깁니다');

  const noteRules = [...html.matchAll(/#note-panel[^{]*\{[^}]*\}/g)].map((m) => m[0]);
  const bad = noteRules.filter((r) => /-webkit-touch-callout|user-select:\s*none/.test(r));
  assert.deepEqual(bad, [],
    `탐구 노트에 길게 누르기를 막아 두었습니다 — 붙여넣기가 죽습니다:\n  ${bad.join('\n  ')}`);
});

test('회전 확대 뷰는 관만 보고 점수를 매긴다 — 기록 여부를 섞지 않는다', () => {
  /*
   * 예전에 확대 뷰가 `observability({ ...params, captured: 기록수 > 0 })` 을 불렀다.
   * 「이 관을 기록했는가」가 아니라 **「무엇이든 한 번 기록한 적이 있는가」**라서,
   * 첫 기록을 넘기는 순간 **자를 안 댔는데도 70 에서 100 으로 뛰었다.** 그리고 탐구 노트는
   * 저장된 기록을 넘기는데 거기엔 그 열쇠가 없어 90 에 머물렀다 — 같은 관을 두 화면이
   * 다르게 말한 것이다. 걷어냈고, 다시 섞이지 않도록 여기서 못 박는다.
   *
   * 점수는 **관의 상태만** 보고 나와야 한다. 세션에서 온 것을 섞으면 같은 관이
   * 화면마다 다른 값을 갖는다.
   */
  const src = stripComments(readFileSync(new URL('zoom.js', UI_DIR), 'utf8'));
  const args = [...src.matchAll(/observability\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(args.length >= 2,
    `확대 뷰에서 observability 부르는 자리를 ${args.length}개밖에 못 찾았습니다 — 검사가 헛돌고 있습니다`);
  for (const arg of args) {
    assert.match(arg, /^params$/,
      `관 말고 다른 것을 섞었습니다 — observability(${arg})`);
  }
});

/* ---------------- 보고서 창이 읽는 열쇠가 문자열 표에 있는가 ---------------- */

test('보고서 창의 활동지 종류·제출 문구는 report.js 가 읽는 열쇠로 적혀 있다', () => {
  /*
   * `report.js` 는 바나나랩 것을 그대로 물려받았는데 `strings.js` 의 `report.kinds` 는
   * `name` · `individual` 이었다. 화면에는 활동지 종류 단추가 **「undefined」** 둘로 찍히고
   * 어느 쪽도 골라져 있지 않았다 (플레이테스트 — PLAYTEST-REVIEW #6).
   * 제출 문구도 `done` 이 문자열이라 성공한 순간 던져서 「제출하지 못했습니다」가 뜬다.
   * 문자열 표는 검사가 못 보는 자리라 여기서 `report.js` 의 소스와 맞대 본다.
   */
  const src = stripComments(readFileSync(new URL('report.js', UI_DIR), 'utf8'));
  const R = UI.report;
  assert.deepEqual(R.kinds.map((k) => k.id).sort(), ['group', 'solo'],
    'report.js 는 kind 를 solo | group 으로 고른다');
  for (const k of R.kinds) {
    assert.equal(typeof k.label, 'string', `report.kinds.${k.id}.label 이 없습니다 — 단추에 undefined 가 찍힙니다`);
    assert.equal(typeof k.note, 'string', `report.kinds.${k.id}.note 가 없습니다`);
  }
  // report.js 가 `R.submit.xxx` 로 읽는 열쇠 전부
  const used = new Set([...src.matchAll(/R\.submit\.(\w+)/g)].map((m) => m[1]));
  assert.ok(used.size >= 6, `report.js 에서 submit 열쇠를 ${used.size}개밖에 못 찾았습니다 — 검사가 헛돕니다`);
  for (const key of used) {
    assert.ok(key in R.submit, `UI.report.submit.${key} 가 없습니다 — 화면에 undefined 가 뜹니다`);
  }
  assert.equal(typeof R.submit.done, 'function', 'report.js 는 R.submit.done(name) 을 부른다');
  // 확대 뷰의 열쇠도 같은 방식으로 — `UI.zoom.scopeMode` 가 바나나 것이었다.
  const zoomKeys = new Set([...src.matchAll(/UI\.zoom\.(\w+)/g)].map((m) => m[1]));
  for (const key of zoomKeys) {
    assert.ok(key in UI.zoom, `UI.zoom.${key} 가 없습니다 (report.js 가 읽습니다)`);
  }
});
