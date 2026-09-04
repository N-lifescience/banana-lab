/**
 * 화면 코드가 지켜야 할 것 — **디렉터리를 훑는다.**
 *
 * 파일 하나를 겨누면 그 파일을 치우는 순간 검사가 함께 꺼진다. 여기 있는 것은 전부
 * `src/ui/` 와 `src/render/` 아래를 훑으므로, 카드마다 화면이 하나씩 들어와도
 * 그때그때 검사된다.
 *
 * 문구·절차에 매인 검사는 여기 두지 않는다. 그런 것은 짝이 되는 카드의 테스트에 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { initialState, UNDO_LIMITS, MODES, INDEPENDENT_VARIABLES, CHOICES } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

/**
 * 주석을 걷어낸다.
 *
 * 여기 있는 검사는 전부 **코드에 그것이 있는가**를 본다. 주석은 화면에 나오지 않는다.
 * 걷어내지 않았더니 「이 파일에는 disabled 가 없다」고 적어 둔 설명문 자체가 걸려서,
 * 규칙을 지켰다는 증거가 규칙 위반으로 판정됐다. 산문을 훑으면 오탐이 난다.
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

function uiSources() {
  const out = [];
  for (const dir of ['../src/ui/', '../src/render/']) {
    const url = new URL(dir, import.meta.url);
    if (!existsSync(url)) continue;
    for (const f of readdirSync(url)) {
      if (f.endsWith('.js')) out.push([`${dir.replace('../', '')}${f}`, stripComments(readFileSync(new URL(f, url), 'utf8'))]);
    }
  }
  out.push(['src/main.js', stripComments(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'))]);
  return out;
}

/* ---------------- 설계 원칙 회귀 테스트 ---------------- */

test('UI 는 포인터 이벤트만 쓴다 — 마우스/터치 전용 이벤트 금지', () => {
  // 태블릿 대응. mouse* 와 touch* 를 섞으면 한쪽에서만 동작하는 조작이 생긴다.
  const banned = /\b(mousedown|mousemove|mouseup|touchstart|touchmove|touchend)\b/;
  for (const [name, src] of uiSources()) {
    const hit = src.match(banned);
    assert.equal(hit, null, `${name} 에 ${hit?.[0]} 이 있습니다 — pointerdown/pointermove/pointerup 을 쓰세요`);
  }
});

test('UI 는 버튼을 disabled 로 막지 않는다', () => {
  // 이 프로젝트는 잘못된 조작을 막지 않는다. 누를 수 있어야 하고,
  // 누른 결과가 화면에 나타나는 것이 설계다. AGENTS.md §2.1 참조.
  //
  // 탐구 노트가 쪽을 넘기는 순서를 막는 자리가 생겼지만, 거기서도 `disabled` 는 안 쓴다 —
  // 그 속성은 포커스를 빼앗아 **왜 못 누르는지 들을 방법까지 없앤다.** `aria-disabled` 를 쓴다.
  // 금지되는 것은 「막는 것」이 아니라 **`disabled` 라는 수단**이다.
  for (const [name, src] of uiSources()) {
    assert.equal(/(?<!aria-)\bdisabled\b/.test(src), false,
      `${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md §2.1)`);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/(?<!aria-)\bdisabled\b/.test(html), false, 'index.html 에 disabled 가 있습니다');
});

test('UI 는 상태를 직접 고치지 않고 reduce 를 거친다', () => {
  // src/sim/ 은 DOM 을 모르고, UI 는 상태를 직접 만지지 않는다. 이 경계가 있어야
  // 규칙을 node --test 로 검증할 수 있다.
  for (const [name, src] of uiSources()) {
    if (name.endsWith('strings.js')) continue;
    assert.equal(
      /\bfrom ['"][.\/]*sim\/state\.js['"]/.test(src) && /\bstate\.\w+\s*=[^=]/.test(src), false,
      `${name} 이 상태를 직접 대입합니다 — reduce(state, action) 을 쓰세요`);
  }
});

/* ---------------- 난이도 ---------------- */

test('세 난이도의 되돌리기 횟수가 실제로 다르다', () => {
  const seen = new Set([1, 2, 3].map((lv) => String(initialState(lv).session.undosLeft)));
  assert.equal(seen.size, 3, '세 난이도가 실제로 달라야 합니다');
  assert.equal(UNDO_LIMITS[1], Infinity);
});

test('되돌리기 횟수가 무제한일 때 쓸 표기가 있다', () => {
  // 1단계 undosLeft 는 Infinity 라, 그대로 그리면 "Infinity회 남음" 이 나온다.
  assert.ok(UI.undo && typeof UI.undo.unlimited === 'string',
    'UI.undo.unlimited 이 필요합니다 — 화면에 Infinity 가 뜨지 않게 하기 위함입니다');
  assert.ok(!/Infinity/.test(UI.undo.unlimited));
});

test('난이도 세 단계에 이름과 설명이 있고, 셋 다 다르다', () => {
  const levels = UI.start.levels;
  assert.equal(levels.length, 3);
  assert.equal(new Set(levels.map((l) => l.desc)).size, 3, '설명이 겹칩니다');
  assert.deepEqual(levels.map((l) => l.id), [1, 2, 3]);
});

test('혼자·모둠 둘 다 고를 수 있다', () => {
  assert.deepEqual(new Set(UI.start.modes.map((m) => m.id)), new Set(Object.values(MODES)));
});

/* ---------------- 변인 — 화면이 읽는 목록 ---------------- */

test('조작변인 목록에 화면이 쓸 이름이 다 있다', () => {
  // 변인 설계 UI(T04)는 이 목록을 읽어 화면을 만든다. 코드에 「온도」·「pH」를 박지 않는다.
  for (const v of INDEPENDENT_VARIABLES) {
    assert.ok(UI.variables?.[v]?.name, `UI.variables.${v}.name 이 없습니다`);
  }
});

test('고를 수 있는 값마다 화면에 쓸 단위 표기가 있다', () => {
  for (const key of Object.keys(CHOICES)) {
    assert.ok(typeof UI.units?.[key] === 'function', `UI.units.${key} 가 없습니다`);
    for (const v of CHOICES[key]) {
      const label = UI.units[key](v);
      assert.ok(typeof label === 'string' && label.length > 0, `${key}=${v} 의 표기가 비었습니다`);
    }
  }
});

/**
 * 화면에 나가는 글자에 마크다운이 섞이지 않았는가.
 *
 * 소스에서 읽기 좋으라고 `**강조**` 를 적었더니 화면에 별표가 그대로 나갔다 —
 * 이 문자열들은 HTML 로 들어가지 마크다운으로 렌더되지 않는다.
 * 소스에서 눈으로는 안 보인다. 화면을 열어야 보이고, 그때는 이미 학생이 본 뒤다.
 */
test('화면 문자열에 마크다운 표시가 남아 있지 않다', () => {
  /*
   * **`**굵게**` 를 허용하는 자리는 `emph()` 로 그리는 것뿐이다.**
   * 탐구 과정 머리말(`stepLeadIn`)·가치 안내는 여덟 실험이 글자까지 같아야 하고
   * (`tests/uniformity.test.js`), 정본은 강조를 `**` 로 적는다. 그 문자열은 `notebook.js` 가
   * `emph()` 로 <b> 로 바꿔 그린다 — 그 함수를 거치지 않는 문자열에 `**` 가 있으면 별표가 그대로 나간다.
   */
  const viaEmph = new Set(['UI.notebook.stepLeadIn', 'UI.notebook.valuesLead', 'UI.notebook.valuesList', 'UI.notebook.predictLeadIn',
    // 세부 단계의 「어떻게 하는가」 — `notebook.js` 가 emph() 로 그린다 (실험대 물건 이름을 굵게).
    'UI.protocol']);
  const notebook = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  for (const key of ['stepLeadIn', 'valuesLead']) {
    assert.ok(notebook.includes(`emph(N.${key})`), `notebook.js 가 N.${key} 를 emph() 로 그리지 않습니다`);
  }
  const found = [];
  (function walk(node, path) {
    if (typeof node === 'string') {
      if (/\*\*|(^|\s)__/.test(node) && ![...viaEmph].some((k) => path.startsWith(k))) found.push(`${path}: ${node.slice(0, 40)}…`);
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
    }
  }(UI, 'UI'));
  assert.deepEqual(found, []);
});

/**
 * 탐구 노트의 쪽과 실험대 자물쇠가 짝을 이루는가.
 *
 * 자물쇠가 없는 탭 id 를 요구하면 **실험대가 영영 안 열린다.** 화면에는 아무 표시도 안 난다 —
 * 학생은 무엇을 더 읽어야 하는지 모른 채 잠긴 실험대를 본다.
 */
test('실험대 자물쇠가 요구하는 쪽이 탐구 노트에 실제로 있다', () => {
  const ids = new Set(UI.notebook.stages.map((s) => s.id));
  for (const id of UI.bench.lock.required) {
    assert.ok(ids.has(id), `실험대가 요구하는 「${id}」 쪽이 탐구 노트에 없습니다`);
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

  // **표시만 하고 넘기기를 안 막으면 표시가 거짓말이 된다.** 눌렀을 때 되돌아가는 줄이 있어야 한다.
  assert.ok(/aria-disabled'\) === 'true'\) return;/.test(src),
    '막힌 단추를 눌렀을 때 되돌아가는 줄이 없습니다 — aria-disabled 는 표시일 뿐 막지 않습니다');

  /**
   * 그 자리에 붙는 이유 문구 — strings.js 에 있어야 하고 비어 있으면 안 된다.
   *
   * **셋을 다 요구한다.** 하나로 두었을 때 두 자리에서 거짓말이 나왔다:
   * 2·3단계는 예상을 «고르는» 것이 아니라 «적는» 것이고(`stage3`), 예상을 이미 정한
   * 학생에게 비어 있는 것은 **이유 칸**이다. 3단계로 끝까지 해 보다 나왔다.
   */
  for (const key of ['readNeedsPredict', 'readNeedsPredictWrite', 'readNeedsPredictWhy']) {
    assert.ok(typeof UI.notebook[key] === 'string' && UI.notebook[key].trim().length > 0,
      `UI.notebook.${key} 가 필요합니다 — 왜 못 누르는지 말해야 합니다`);
  }
  // 「고르세요」와 「적으세요」가 같은 말이면 갈라 둔 뜻이 없다.
  assert.notEqual(UI.notebook.readNeedsPredict, UI.notebook.readNeedsPredictWrite,
    '보기에서 고르는 쪽과 직접 적는 쪽의 문구가 같습니다 — 없는 단추를 찾게 됩니다');

  // STEP 잠금은 disabled 를 쓰지 않는다(열리는 척하다 안 열리는 것이 가장 나쁘다).
  // 대신 이유를 적는다. 그 문구도 실제로 있어야 한다.
  assert.equal(typeof UI.notebook.stepLockedWhy, 'function',
    'UI.notebook.stepLockedWhy(id) 가 필요합니다 — 어느 STEP 으로 돌아가야 하는지 말해야 합니다');
  assert.ok(UI.notebook.stepLockedWhy('3').includes('3'),
    'stepLockedWhy 는 돌아갈 STEP 번호를 담아야 합니다');
});

/**
 * **크로뮴이 못 재는 것은 소스에서 잰다.**
 *
 * 아이폰에서 실험대를 길게 누르면 돋보기가 떴다 (선생님이 직접 해 보고 알려 주심,
 * 2026-08-29). 막는 것은 `-webkit-touch-callout:none` 인데, **크로뮴은 그 이름을
 * 아예 갖고 있지 않다** — 계산값에도 CSSOM 에도 안 들어간다(파싱 단계에서 버린다).
 *
 * 그래서 브라우저 검사로 재면 「걸린 규칙 없음」이 나오는데, 그것은 **안 걸린 것이
 * 아니라 못 재는 것**이다. 옆 랩이 그것으로 두 번 헛짚었다.
 * 잴 수 있는 것(`touch-action` · `user-select`)은 `check-screen.mjs` 가 재고,
 * **여기서는 글자가 그 자리에 있는지만** 본다.
 */
test('아이폰 길게 누르기 막이가 실험대에 걸려 있다', async () => {
  const { readFileSync } = await import('node:fs');
  // 화면 CSS 는 여덟 실험이 함께 쓰는 한 파일에 있다 (docs/09-uniformity.md §1).
  const html = readFileSync(new URL('../../../packages/lab-kit/style/shell.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = html.slice(html.indexOf('.bench-stage{'), html.indexOf('.bench-bg{'));
  assert.ok(rule.includes('-webkit-touch-callout:none'),
    '.bench-stage 에 -webkit-touch-callout:none 이 없습니다 — 아이폰에서 돋보기가 뜹니다');
  assert.ok(html.includes(".bench-stage *{-webkit-touch-callout:none}"),
    '실험대 «안의 물건» 에 -webkit-touch-callout 이 안 걸렸습니다 — 물건을 길게 누르면 뜹니다');
  /**
   * ★ **`touch-action:none` 이면 안 된다.** 그 위에서 손가락을 밀 때 쪽이 안 넘어가
   * 폰에서 아래로 내려갈 길이 막힌다. 있는지가 아니라 **무엇인지**를 본다.
   */
  assert.ok(rule.includes('touch-action:manipulation'),
    '.bench-stage 의 touch-action 이 manipulation 이 아닙니다 — none 이면 폰에서 쪽이 안 넘어갑니다');
});

test('탐구 노트에는 길게 누르기 막이를 안 건다', () => {
  // 글칸에 걸면 **붙여넣기와 글자 고르기가 죽는다.** 학생이 쓴 것을 못 옮긴다.
  const html = readFileSync(new URL('../../../packages/lab-kit/style/shell.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const sel of ['#note-panel', '#notebook,#side{', 'textarea[data-note]']) {
    const at = html.indexOf(sel);
    if (at < 0) continue;
    const rule = html.slice(at, html.indexOf('}', at));
    assert.ok(!rule.includes('-webkit-touch-callout') && !rule.includes('user-select:none'),
      `${sel} 에 길게 누르기 막이가 걸렸습니다 — 붙여넣기가 죽습니다`);
  }
});
