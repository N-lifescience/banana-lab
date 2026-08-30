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

test('UI 는 버튼을 disabled 로 막지 않는다 — 예상 관문은 aria-disabled 로 막는다', () => {
  /*
   * 이 프로젝트는 잘못된 **조작**을 막지 않는다. 누를 수 있어야 하고, 누른 결과가 화면에
   * 나타나는 것이 설계다 (AGENTS.md §2.1).
   *
   * **예외가 딱 하나 있다.** 예상 쪽(3)의 「이 쪽을 읽었습니다」다. §2.1 이 말하는 것은
   * 실험대 조작이고, **노트를 읽어 나가는 차례**는 막아도 된다 — 예상을 안 하고 결과를 본
   * 다음 예상을 적으면 그건 예상이 아니라 베껴 쓴 것이고, 그 쪽이 있는 이유가 사라진다.
   * 선생님이 여덟 실험 전부에 넣기로 정하셨다.
   *
   * 그래서 이 검사를 **지우지 않고 좁혔다.** 지우면 다음 사람이 아무 데나 disabled 를 달고,
   * 그때는 아무도 못 본다. 여기서 보는 것 둘:
   *   · `notebook.js` 밖에는 `disabled` 가 하나도 없다
   *   · `notebook.js` 안에도 **하나뿐**이고, 그 옆에 **왜 못 누르는지가 함께 붙는다**
   *     — 말 없는 회색 단추는 학생에게 고장으로 읽힌다
   */
  /**
   * `aria-disabled` 안의 disabled 는 세지 않는다 — 그건 다른 것이다.
   * **정본(banana-lab)과 같은 모양**을 쓴다: `(?<!aria-)\bdisabled\b`.
   */
  const plainDisabled = (src) => src.match(/(?<!aria-)\bdisabled\b/g) ?? [];

  for (const [name, src] of uiSources()) {
    if (name.endsWith('notebook.js')) {
      assert.equal(plainDisabled(src).length, 0,
        'notebook.js 에 disabled 가 있습니다 — 관문은 aria-disabled 로 막으세요');
      // **속성으로 붙는 자리**만 센다. `getAttribute('aria-disabled')` 로 읽는 곳은 막는 코드다.
      const aria = src.match(/aria-disabled="/g) ?? [];
      assert.equal(aria.length, 1,
        `notebook.js 가 aria-disabled 를 ${aria.length}군데 답니다 — 예상 관문 하나뿐이어야 합니다`);
      assert.ok(/gated \? 'aria-disabled="true" aria-describedby="read-why"'/.test(src),
        '관문이 aria-disabled + aria-describedby 짝으로 붙어 있지 않습니다');
      // 막는 것은 브라우저가 아니라 클릭 처리다. 이 줄이 없으면 aria 만 달고 실제로는 눌린다.
      assert.ok(/getAttribute\('aria-disabled'\) === 'true'\) return/.test(src),
        'aria-disabled 를 달아만 두고 클릭을 막지 않습니다 — 그냥 눌립니다');
      assert.ok(src.includes('readNeedsPredict') && src.includes('readNeedsVariable'),
        '못 누르는 까닭을 말하지 않습니다 — 회색 단추만 두면 고장으로 읽힙니다');
      continue;
    }
    assert.equal(plainDisabled(src).length, 0,
      `${name} 에 disabled 가 있습니다 — 막지 말고 결과로 답하세요 (AGENTS.md §2.1)`);
  }
  /*
   * HTML 에는 `disabled` 속성이 하나도 없어야 한다. **CSS 선택자는 예외다** —
   * `#read-confirm[disabled]` 는 막는 것이 아니라 **막힌 것을 그렇게 보이게 하는** 규칙이고,
   * 회색으로 보이지 않는 못 누르는 단추가 더 나쁘다. 그래서 선택자만 걷어내고 나머지를 본다.
   */
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#read-confirm\[aria-disabled="true"\]/g, '');
  assert.equal(/\bdisabled\b/.test(html), false, 'index.html 에 disabled 가 있습니다');
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
  const found = [];
  (function walk(node, path) {
    if (typeof node === 'string') {
      if (/\*\*|(^|\s)__/.test(node)) found.push(`${path}: ${node.slice(0, 40)}…`);
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

/* ---------------- 4단계 탐구 과정 — 한 번에 한 STEP ---------------- */

/**
 * 관찰 기록 칸을 **어디에 내는가.**
 *
 * 열세 칸 전부에 칸을 내면 노트가 받아쓰기 숙제가 된다. 「발효관 비우기」는 했거나
 * 안 했거나이지 관찰할 것이 없고, 그건 ✓ 하나로 충분하다. 적을 것이 없는 칸을 채우느라
 * 진짜 관찰이 대충 적히는 것이 실제로 일어나는 일이다.
 */
test('관찰 기록 칸은 조작의 결과가 화면에 나오는 칸에만 있다', () => {
  const steps = UI.protocol.flatMap((g) => g.steps);
  const noted = steps.filter((s) => s.note);

  assert.ok(noted.length >= 5 && noted.length <= 9,
    `기록칸이 ${noted.length}칸입니다 — 전부(${steps.length}) 도 아니고 한둘도 아닌 대여섯~여덟쯤이어야 합니다`);
  assert.ok(noted.length < steps.length,
    '모든 세부 단계에 기록칸이 있습니다 — 준비 동작에는 적을 것이 없습니다');

  // STEP 하나가 통째로 말없이 지나가면, 거기서 무엇을 보았는지가 보고서에서 사라진다.
  for (const g of UI.protocol) {
    assert.ok(g.steps.some((s) => s.note),
      `STEP ${g.id} 에 적을 칸이 하나도 없습니다 — 그 STEP 의 관찰이 통째로 사라집니다`);
  }

  // `note` 는 참이거나 없거나 둘 중 하나다. `'false'` 같은 글자가 섞이면 조용히 참이 된다.
  for (const s of steps) {
    assert.ok(s.note === true || s.note === undefined,
      `note 는 true 이거나 없어야 합니다 — 「${s.label}」 에 ${JSON.stringify(s.note)} 가 있습니다`);
  }
});

/**
 * 접힘은 **잠금이 아니다** (AGENTS.md §2.1).
 *
 * 「지금 할 차례」가 아닌 STEP 도 눌러서 열려야 하고, 순서를 건너뛰어 실험한 학생은
 * 거기에 적으면 된다. `disabled` 는 위쪽 검사가 이미 막지만, `<details>` 는
 * **`pointer-events:none` 이나 `open` 강제로도** 죽는다 — 그쪽은 이 검사가 본다.
 */
test('STEP 아코디언을 눌리지 않게 죽여 두지 않는다', () => {
  const src = uiSources().find(([f]) => f.endsWith('notebook.js'))[1];
  // `includes` 가 아니라 낱말로 본다 — `inert` 를 `includes` 로 보면 `insert` 에도 걸린다.
  for (const bad of [/\bpointer-events\b/, /\binert\b/]) {
    assert.equal(bad.test(src), false,
      `notebook.js 가 ${bad.source} 를 씁니다 — 접힌 STEP 이 잠긴 STEP 이 됩니다`);
  }
  /*
   * `aria-disabled` 는 **예상 관문 하나에만** 쓴다 (위 검사가 그 자리를 못 박는다).
   * STEP 머리에 달면 낭독기가 「누를 수 없음」이라 읽어 버려, 눌러서 열리는 STEP 이
   * 열 수 없는 것으로 전해진다 — 화면과 낭독기가 서로 다른 말을 한다.
   */
  // 여는 태그만 오려 본다. 파일 전체를 훑으면 저 아래 클릭 처리에 있는 `getAttribute` 에 걸린다.
  const detailsTag = src.match(/<details class="step-group"[\s\S]*?>/)?.[0] ?? '';
  assert.ok(detailsTag, 'STEP 아코디언의 여는 태그를 못 찾았습니다');
  assert.equal(/aria-disabled|disabled|tabindex="-1"/.test(detailsTag), false,
    `STEP 머리에 못 쓰는 것이 붙었습니다 — 눌러서 열리는 것을 못 연다고 읽습니다: ${detailsTag}`);
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/\.step-(group|summary)[^{]*\{[^}]*pointer-events\s*:\s*none/.test(css),
    'CSS 가 STEP 머리를 눌리지 않게 막고 있습니다');
});

/**
 * **`toggle` 이 아니라 `summary` 의 `click` 을 듣는다.**
 *
 * `<details open>` 을 `innerHTML` 로 꽂으면 브라우저가 **삽입만으로 `toggle` 을 한 번 쏜다.**
 * 그러면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로 연 것」으로 기록되고,
 * 그 STEP 은 끝난 뒤에도 **영영 안 접힌다.** 화면에는 아무 오류도 안 난다 —
 * 다시 그릴 때마다 조금씩 더 펼쳐질 뿐이라 아무도 버그라고 부르지 않는다.
 */
test('STEP 여닫힘을 toggle 로 듣지 않는다 — 삽입만으로 쏘는 사건이다', () => {
  const src = uiSources().find(([f]) => f.endsWith('notebook.js'))[1];
  assert.ok(!/['"]toggle['"]/.test(src),
    "notebook.js 가 'toggle' 을 듣습니다 — innerHTML 삽입이 그것을 쏘아 STEP 이 영영 안 접힙니다");
  assert.ok(/data-step-group\]\s*>\s*summary/.test(src),
    'summary 의 click 을 듣는 자리가 없습니다');
});

/**
 * **말풍선이 약속하는 조작이 실제로 있는가.**
 *
 * 안전 수칙 조작을 걷어내면서 시약병·폐액통·휴지의 누르기가 사라졌다. 그런데 말풍선은
 * 문자열이라 따라 지워지지 않는다 — 「클릭하면 마개를 닫습니다」가 남으면 학생은 눌러 보고
 * **앱이 고장 났다고 여긴다.** 기능이 없는데 안내가 있는 것은, 안내가 없는 것보다 나쁘다.
 *
 * 브라우저 검사(`check-screen.mjs`)도 이걸 보지만 **한 난이도에서만** 본다.
 * 실제로 2단계 문구에 약속을 되살려 봤더니 그 검사는 초록불이었다.
 * 여기서는 **세 난이도를 다 훑는다** — 문자열은 난이도마다 따로 있다.
 */
test('말풍선이 「클릭」을 약속하는 물건에는 실제로 누르는 조작이 있다', async () => {
  const { tapTable } = await import('../src/ui/bench.js');
  const taps = new Set(Object.keys(tapTable({ dispatch() {} })));

  const promised = [];
  for (const [kind, byLevel] of Object.entries(UI.bench.hints)) {
    for (const [level, lines] of Object.entries(byLevel)) {
      for (const line of lines) {
        if (/클릭/.test(line) && !taps.has(kind)) promised.push(`${kind}(${level}단계): ${line}`);
      }
    }
  }
  assert.deepEqual(promised, [],
    `누르는 조작이 없는데 클릭을 약속합니다 — 학생은 눌러 보고 고장이라고 여깁니다`);
});
