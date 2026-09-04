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
import { focusLineFor, dialStateFor } from '../src/ui/zoom.js';
import { focusTolerance, focusToleranceOn, KNOB_SPAN } from '../src/sim/optics.js';
import { isFocused } from '../src/sim/state.js';
import { stripComments } from './strip-comments.js';

const UI_DIR = new URL('../src/ui/', import.meta.url);

/** src/ui/ 안의 .js 파일을 전부 읽어 [이름, 내용] 으로 돌려준다 */
function uiSources() {
  const dir = new URL('.', UI_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => [f, readFileSync(new URL(f, UI_DIR), 'utf8')]);
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
  // 이 실험의 다섯 항목. 배율과 뒤집힘은 **일부러 없다** —
  // 100배도 400배도 정답이고, 뒤집어 끼워도 값이 안 틀린다 (quality.js 머리말).
  const cases = [
    { hasReticle: false },                            // equipped
    { hasReticle: true, on: 'stageMic', angleGapDeg: 90 },   // align
    { hasReticle: true, on: 'stageMic', angleGapDeg: 0, focusErr: 2, objective: 40 },  // focus
    { hasReticle: true, on: 'stageMic', angleGapDeg: 0, contrast: 0 },                 // contrast
    { hasReticle: true, on: 'stageMic', angleGapDeg: 0, centerErr: 1 },                // span
  ];
  for (const c of cases) {
    const { worst } = observability(c);
    assert.equal(typeof UI.observability.worst[worst], 'string',
      `worst='${worst}' 에 해당하는 문자열이 없습니다`);
  }
  // 아무것도 안 깎였으면 worst 는 없다. 그때 쓸 문구가 따로 있어야 한다 —
  // 없으면 게이지가 "지금 가장 크게 깎이는 항목: undefined" 를 띄운다.
  {
    const perfect = observability({ hasReticle: true, on: 'stageMic', angleGapDeg: 0, focusErr: 0, contrast: 1, centerErr: 0, objective: 10 });
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
 * `disabled` 는 쓰지 않는다. `aria-disabled` 는 **다른 것이라 통과시킨다.**
 *
 * ★ `disabled` 는 단추에서 **포커스를 빼앗는다.** 키보드나 낭독기로 오는 학생은 그
 *   단추에 닿을 수조차 없어서 **「왜 못 누르는지」를 들을 길이 사라진다** —
 *   막으면서 이유를 말해 주려면 단추는 살아 있어야 한다.
 *   그래서 못 하게 표시할 일이 생기면 `aria-disabled` + `aria-describedby` 로 하고,
 *   누르는 쪽에서 한 번 더 막는다(표시만 하고 안 막으면 표시가 거짓말이 된다).
 *
 * ★ **검사를 지우지 않고 좁힌다.** 지우면 진짜 `disabled` 가 슬그머니 들어온다.
 *   (여덟 저장소가 각각 같은 결론에 왔고 허브가 모아 내려보냈다)
 */
const HARD_DISABLED = /(?<!aria-)\bdisabled\b/;

test('UI 는 버튼을 disabled 로 막지 않는다 (aria-disabled 는 된다)', () => {
  // 이 프로젝트는 잘못된 **조작**을 막지 않는다. 누를 수 있어야 하고,
  // 누른 결과가 시야에 나타나는 것이 설계다. AGENTS.md 2.1 참조.
  //
  // **예외 하나** — 탐구 노트의 「이 쪽을 읽었습니다」는 예상을 고르기 전에는 못 누른다.
  // §2.1 이 말하는 것은 **실험대 조작**이고, 이것은 노트를 읽는 순서다. 그리고 막는 자리에
  // **왜 막혔는지**를 함께 낸다 (`readNeedPredict`) — 말 없는 회색 단추는 고장으로 읽힌다.
  // 규칙 파일(AGENTS.md)은 건드리지 않았다. 예외 사유를 여기 적어 두는 것까지만 한다.
  for (const [name, raw] of uiSources()) {
    // **주석은 빼고 본다.** 안 그러면 이 규칙을 설명한 주석이 자기 자신을 문다.
    const src = stripComments(raw);
    assert.equal(HARD_DISABLED.test(src), false,
      `src/ui/${name} 에 disabled 가 있습니다 — 포커스를 빼앗아 이유를 들을 길이 사라집니다.`
      + ' 막아야 한다면 aria-disabled 를 쓰세요 (AGENTS.md 2.1)');
  }
  if (existsSync(new URL('../index.html', import.meta.url))) {
    const html = stripComments(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
    assert.equal(HARD_DISABLED.test(html), false, 'index.html 에 disabled 가 있습니다');
  }
});

test('aria-disabled 로 막은 자리는 왜 막혔는지 함께 말한다', () => {
  // **말 없는 회색 단추는 고장으로 읽힌다.** 그리고 그 이유는 **눈으로 보는 사람에게만
  // 있으면 안 된다** — `aria-describedby` 로 묶어야 낭독기에도 들린다.
  for (const [name, raw] of uiSources()) {
    const src = stripComments(raw);
    if (!/aria-disabled/.test(src)) continue;
    assert.ok(/aria-describedby/.test(src),
      `src/ui/${name} 이 aria-disabled 로 막는데 이유를 aria-describedby 로 묶지 않았습니다`);
    /**
     * 표시만 하고 안 막으면 표시가 거짓말이 된다. **누르는 쪽에도 관문이 있어야 한다.**
     *
     * ★ **`getAttribute('aria-disabled')` 를 찾으면 안 된다.** 여기 그렇게 적혀 있었고,
     *   그 방법이 바로 버그였다 — 그 표시는 **마지막으로 그린 순간의 값**이라 칸을 채우고
     *   곧장 누른 학생에게는 **낡은 값**이다. 표시로 막으면 다 채웠는데도 안 넘어간다.
     *   옳은 관문은 **지금 상태**를 보는 것인데, 그러자 이 검사가 **옳은 코드를 물었다.**
     *
     * ★ 그래서 「조건에 쓰인 이름이 파일 어딘가에 두 번 나오는가」로 느슨하게 고쳤더니
     *   이번에는 **관문을 통째로 빼도 초록불**이었다 — 이름은 표시 쪽에만 있어도 두 번 나온다.
     *   느슨하게 고치는 것은 고치는 것이 아니다.
     *
     * 지금 재는 것: 표시를 붙일 때 쓴 조건의 **이름들이 한 `if (…) return` 안에 다 모여
     * 있는가.** 그 자리가 곧 관문이다. 글자를 그대로 맞추라고 하지는 않는다 —
     * `st` 를 `store.getState()` 로 바꿔 쓰는 것까지 막을 이유는 없다.
     */
    const cond = src.match(/const blocked = ([^;]+);/)?.[1];
    assert.ok(cond, `src/ui/${name} 에서 aria-disabled 를 붙이는 조건(const blocked = …)을 못 찾았습니다`);

    // 조건에 쓰인 이름들 — 함수·상수·변수. 리터럴은 뺀다.
    const names = [...new Set(cond.match(/[A-Za-z_$][\w$]*/g) ?? [])]
      .filter((w) => !['true', 'false', 'null', 'undefined', 'st', 'store', 'getState'].includes(w));
    assert.ok(names.length > 0, `조건에서 이름을 못 뽑았습니다: ${cond}`);

    // `if ( … ) return` 을 괄호 균형으로 잘라 낸다. 정규식만으로는 중첩 괄호에서 끊긴다.
    const guards = [];
    for (let i = src.indexOf('if ('); i >= 0; i = src.indexOf('if (', i + 1)) {
      let depth = 0;
      let j = i + 3;
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') { depth--; if (depth === 0) break; }
      }
      if (/^\s*return/.test(src.slice(j + 1, j + 12))) guards.push(src.slice(i + 4, j));
    }
    const guarded = guards.some((g) => names.every((w) => new RegExp(`\\b${w}\\b`).test(g)));
    assert.ok(guarded,
      `src/ui/${name} 이 aria-disabled 를 붙여 놓고 누르는 쪽에서 막지 않습니다.`
      + ` 표시 조건은 「${cond.trim()}」 인데, 그 이름들이 한 관문(if … return) 안에 다 모인 곳이 없습니다.`);
  }
});

test('실험대 무대가 길게 누르기를 막는다 — 노트는 안 막는다', () => {
  /**
   * 아이폰에서 실험대를 **길게 누르면** 돋보기가 뜨고 글자가 잡힌다. 사장님이 아이폰으로
   * 플레이하시고 짚으셨다. 물건에는 걸려 있었는데 **무대 바탕과 이름표에는 없었다.**
   *
   * ★ **이것은 소스로 본다. 브라우저로는 못 잰다** — 크로뮴은
   *   `-webkit-touch-callout` 을 계산값에도 CSSOM 에도 안 넣는다(파싱에서 버린다).
   *   「걸린 규칙 없음」은 **안 걸린 것이 아니라 못 재는 것**이다.
   *   허브가 거기서 두 번 헛짚고 멀쩡한 CSS 를 지울 뻔했다.
   *   `touch-action`·`user-select` 는 브라우저로도 재지만, callout 은 여기서만 본다.
   *
   * ★ **`touch-action:none` 이면 빨간불이다.** 무대에 `none` 을 걸면 그 위에 손을 대고
   *   밀 때 쪽이 안 넘어간다 — 되돌린 적이 있다. `manipulation` 이어야 한다.
   *
   * ★ **탐구 노트에는 걸리면 안 된다** — 붙여넣기와 글자 고르기가 죽는다.
   */
  // 화면 CSS 는 여덟 실험이 함께 쓰는 한 파일에 있다 (docs/09-uniformity.md §1).
  const html = stripComments(readFileSync(new URL('../../../packages/lab-kit/style/shell.css', import.meta.url), 'utf8'));
  const rule = html.match(/\.bench-stage\s*\{[^}]*\}/)?.[0]?.replace(/\s+/g, '');
  assert.ok(rule, '.bench-stage 규칙을 못 찾았습니다 — 이름이 바뀌었으면 이 검사도 고치세요');

  for (const need of ['user-select:none', '-webkit-user-select:none', '-webkit-touch-callout:none']) {
    assert.ok(rule.includes(need),
      `.bench-stage 에 ${need} 이 없습니다 — 아이폰에서 길게 누르면 글자가 잡힙니다: ${rule.slice(0, 120)}`);
  }
  assert.ok(/touch-action:\s*manipulation/.test(rule),
    `.bench-stage 의 touch-action 이 manipulation 이 아닙니다 —`
    + ` none 을 걸면 그 위에서 밀 때 쪽이 안 넘어갑니다: ${rule.slice(0, 120)}`);

  // 이름표 같은 자식도 길게 누르기 메뉴가 안 떠야 한다.
  assert.ok(/\.bench-stage\s*\*\{[^}]*-webkit-touch-callout:\s*none/.test(html),
    '.bench-stage 의 자식에 -webkit-touch-callout:none 이 없습니다 — 이름표를 길게 누르면 메뉴가 뜹니다');

  // 노트에는 걸면 안 된다 — 붙여넣기가 죽는다.
  const noteRules = [...html.matchAll(/#(?:notebook|note-panel)[^{]*\{[^}]*\}/g)].map((m) => m[0]);
  for (const r of noteRules) {
    assert.ok(!/user-select:\s*none/.test(r),
      `탐구 노트에 user-select:none 이 걸렸습니다 — 붙여넣기와 글자 고르기가 죽습니다: ${r.slice(0, 100)}`);
  }
});

test('role="slider" 에는 범위(min·max)가 함께 있다', () => {
  /**
   * `aria-valuenow` 만 두고 `aria-valuemin`/`max` 를 안 주면 낭독기는 **0~100 을 가정**한다.
   * 그러면 `0.800` 이 「100 중 0.8」로 읽힌다 — 눈으로 보는 학생은 손잡이 그림으로 어디쯤인지
   * 아는데, 낭독기로 오는 학생은 **끝에 닿았는지조차 알 수 없다.**
   *
   * 이 저장소가 `disabled` 를 안 쓰는 것과 같은 이유다 (바로 위 검사) — 그 길로 오는
   * 학생을 안 버린다. 초점 나사에서 실제로 빠져 있었다. 배포본을 밟다 찾았다.
   *
   * ★ **`<input type="range">` 는 브라우저가 범위를 아니까 여기서 안 본다.**
   *   손으로 만든 `role="slider"` 만 잰다 — 그것이 계약을 사람 손에 맡기는 자리다.
   */
  for (const [name, raw] of uiSources()) {
    const src = stripComments(raw);
    // `role="slider"` 가 붙은 여는 태그를 통째로 집는다.
    const tags = src.match(/<[a-zA-Z][^>]*role="slider"[^>]*>/g) ?? [];
    if (tags.length === 0) continue;
    for (const tag of tags) {
      for (const need of ['aria-valuemin', 'aria-valuemax']) {
        assert.ok(tag.includes(need),
          `src/ui/${name} 의 role="slider" 에 ${need} 가 없습니다 —`
          + ` 낭독기가 0~100 을 가정해 값을 엉뚱하게 읽습니다: ${tag.slice(0, 90)}`);
      }
    }
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

/* ---------------- 4단계 탐구 과정 — 한 번에 한 STEP ---------------- */

test('관찰 기록 칸은 조작의 결과가 나오는 칸에만 있다', () => {
  // 열일곱 칸 전부에 기록칸을 내면 노트가 받아쓰기 숙제가 된다. 학생이 실제로
  // 「이걸 다 적어야 하나」 하고 멈췄다. 「재물대에 올리고 클립으로 고정하기」 는
  // 했거나 안 했거나이지 관찰할 것이 없다 — ✓ 하나로 충분하다.
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

test('1단계 안내가 세부 단계 열일곱 칸과 짝이 맞는다', () => {
  // 1단계는 「어디서 무엇을 하는지」까지 짚는다. 한 칸이라도 빠지면 그 칸에서만
  // 안내가 사라져, 학생은 자기가 무엇을 잘못해서 설명이 없어졌는지 몰라 멈춘다.
  const where = UI.notebook.stepWhere;
  const keys = [];
  for (const g of UI.protocol) {
    g.steps.forEach((step, i) => {
      const key = `${g.id}${String.fromCharCode(97 + i)}`;
      keys.push(key);
      assert.ok(typeof where[key] === 'string' && where[key].trim(),
        `${key} 「${step.label}」 에 1단계 안내가 없습니다`);
    });
  }
  // 절차에서 없앤 칸의 안내가 남아 있으면, 다음 사람이 그것을 살아 있는 문구로 읽는다.
  for (const key of Object.keys(where)) {
    assert.ok(keys.includes(key), `stepWhere 에 절차에 없는 칸 ${key} 이 남아 있습니다`);
  }
  // **정답을 말하지 않는다.** 어디를 만지라고만 한다 — 몇 µm 인지, 몇 칸이 나와야 하는지는
  // 학생이 세어서 낼 것이고, 안내가 그것을 먼저 말하면 실험이 확인 절차가 된다.
  for (const [key, text] of Object.entries(where)) {
    assert.equal(/µm|마이크로미터당|정답/.test(text), false,
      `stepWhere.${key} 가 답을 말합니다 — ${text}`);
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
  // 3단계(예상)의 예시도 같은 이유로 문항마다 달라야 한다. 바나나랩에서 여기가 한동안
  // 세 칸 모두 같은 문장이었고, 그건 (가) 대조군에는 아예 맞지도 않는 문장이었다.
  // 문항 키는 `predictItems` 에서 끌어온다 — 실험마다 문항이 다르므로 여기에 적어 두면
  // 다음 실험에서 이 검사가 통째로 헛돈다.
  const predictKeys = UI.notebook.predictItems.map((p) => p.key);
  assert.ok(predictKeys.length >= 2, '예상 문항이 둘 이상은 있어야 견줄 것이 생깁니다');
  for (const map of [UI.notebook.predictWhyPlaceholder, UI.notebook.predictFreePlaceholder]) {
    const eg = predictKeys.map((k) => map[k]);
    for (const [i, str] of eg.entries()) {
      assert.ok(typeof str === 'string' && str.trim(),
        `예상 「${predictKeys[i]}」 칸에 예시 문구가 없습니다`);
    }
    assert.equal(new Set(eg).size, eg.length, `예상 칸의 예시 문구가 겹칩니다 — ${JSON.stringify(eg)}`);
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

/* ---------------- 플레이테스트에서 잡은 것들 ---------------- */

/**
 * ★ 400배에서 미동나사가 끝에 닿았을 때 「조동나사로 크게 맞추세요」라고 하면 학생은
 *   시키는 대로 조동나사를 돌리고 **유리에 금이 간다** (`rules.js` COARSE_FOCUS).
 *   100배에서 미동을 끝까지 쓴 채 400배로 올리면 누구나 만나는 자리다.
 */
test('고배율에서 미동나사가 끝에 닿으면 조동나사로 보내지 않는다', () => {
  const end = -KNOB_SPAN.fine;   // 미동나사 폭이 바뀌어도 「끝까지 갔다」를 계속 물어야 한다
  const low = focusLineFor({ objective: 10, coarse: 0.3, fine: end }, false);
  const high = focusLineFor({ objective: 40, coarse: 0.3, fine: end }, false);
  assert.equal(low, UI.zoom.focusFineAtEnd);
  assert.equal(high, UI.zoom.focusFineAtEndHighMag);
  assert.ok(!/조동나사로 크게/.test(high), '고배율 안내가 조동나사를 돌리라고 합니다 — 유리가 깨집니다');
  assert.ok(/10배|내려/.test(high), '고배율 안내에 빠져나갈 길(배율 내리기)이 없습니다');
  assert.ok(/미동나사/.test(high), '무엇이 끝에 닿았는지 말해야 합니다');
  // 맞았으면 끝에 닿았어도 그 말을 안 한다.
  assert.equal(focusLineFor({ objective: 40, coarse: 0.2, fine: end }, true), UI.zoom.focusInRange);
});

/**
 * ★ 첫 화면의 단계 설명이 「눈금에 5칸마다 숫자」·「숫자는 없습니다」라고 했는데,
 *   눈금 렌더러(`reticleLayer`)는 난이도를 받지 않는다 — 세 단계가 똑같이 그린다.
 *   설명은 화면이 실제로 다르게 하는 것만 말해야 한다.
 */
test('시작 화면의 단계 설명이 눈금 렌더러가 하지 않는 차이를 약속하지 않는다', () => {
  const src = readFileSync(new URL('../src/render/fov.js', import.meta.url), 'utf8');
  assert.ok(/export function reticleLayer\(fieldPx, \{[^)]*\}/.test(src), 'reticleLayer 시그니처를 못 찾았습니다');
  assert.ok(!/reticleLayer\([^)]*level/.test(src), '눈금 렌더러가 난이도를 받게 됐다면 이 검사를 다시 쓰세요');
  for (const { id, desc } of UI.start.levels) {
    assert.ok(!/눈금에|굵은 선|숫자는 없|칸마다/.test(desc),
      `${id}단계 설명이 눈금 그림의 차이를 약속합니다 — 렌더러는 단계를 모릅니다: "${desc}"`);
  }
});

test('되돌리기 문구는 경고색이 아니다', () => {
  assert.ok(UI.toast.neutral.includes('undo'), '「한 단계 되돌렸습니다」가 빨간색으로 뜹니다');
});

/**
 * ★ 조리개 기본값(0.6)에서 점수 99 인데 화면이 늘 「조리개를 반쯤…」이라고 짚었다.
 *   눈에 안 보이는 몫은 깎인 것이 아니다.
 */
/**
 * ★ **100 이 아니면 100 이 될 방법을 말한다** (사장님 지시 2026-09-03: 「100이 아니면
 *   100이 될 방법을 알려 줘」).
 *
 * 앞서는 2 % 안쪽(`NEGLIGIBLE_LOSS = 0.98`)을 「안 깎인 것」으로 쳐서, 99·98 점 화면이
 * 「지금 조건에서 볼 수 있는 만큼 잘 보입니다」라고만 했다. 학생은 남은 점수를 어디서
 * 잃고 있는지 알 길이 없었다. 이 검사를 되돌리려면 문턱을 되살려야 하고, 그러면 여기서 걸린다.
 */
test('점수가 100 미만이면 언제나 무엇을 고칠지 말한다', () => {
  const near = observability({ hasReticle: true, on: 'stageMic', angleGapDeg: 0, focusErr: 0, contrast: 0.992, centerErr: 0, objective: 10 });
  assert.ok(near.score < 100, `이 조건은 100 미만이어야 검사가 뜻을 갖습니다 (지금 ${near.score})`);
  assert.equal(near.worst, 'contrast',
    `점수 ${near.score} 인데 고칠 곳을 안 짚습니다 — 학생이 100 이 되는 길을 못 찾습니다`);
  assert.equal(typeof UI.observability.fix[near.worst], 'string', '짚기만 하고 고치는 법을 안 말합니다');

  // 눈에 띄게 깎였으면 물론 짚는다.
  const dim = observability({ hasReticle: true, on: 'stageMic', angleGapDeg: 0, focusErr: 0, contrast: 0.5, centerErr: 0, objective: 10 });
  assert.equal(dim.worst, 'contrast');

  // 100 일 때만 나무랄 것이 없다.
  const perfect = observability({ hasReticle: true, on: 'stageMic', angleGapDeg: 0, focusErr: 0, contrast: 1, centerErr: 0, objective: 10 });
  assert.equal(perfect.score, 100);
  assert.equal(perfect.worst, null, '나무랄 것이 없는데 없는 잘못을 지어냅니다');
});

/**
 * ★ **초점 판정이 세 곳에서 갈리지 않는다** (사장님: 「관찰 가능성 100인데 초점이 안
 *   맞았다고 뜬다」).
 *
 * `quality.js` 는 늘 눈금자 기준(2배 관대)으로 쟀고, `zoom.js`·`progress.js` 는 표본이면
 * 2배 엄격한 기준을 썼다. 그래서 표본에서 게이지는 100 인데 바로 밑줄은 「아직 초점이
 * 맞지 않았습니다」였다. 셋이 `focusToleranceOn` 하나를 부르는지 값으로 확인한다.
 */
test('초점 판정 — 게이지 · 화면 문장 · 노트의 ✓ 가 같은 것을 말한다', () => {
  const tol = focusToleranceOn(40, 'specimen');
  // 표본 허용 범위를 아슬아슬하게 벗어난 자리. 눈금자 기준(2배)이면 「맞았다」가 되는 폭이다.
  const err = tol * 1.5;
  const m = { stage: 'specimen', objective: 40, coarse: err, fine: 0, diaphragm: 0.55, lamp: true, panX: 0, panY: 0 };

  assert.equal(isFocused(m), false, '화면이 「맞았습니다」라고 말합니다');
  const q = observability({
    hasReticle: true, on: 'specimen', angleGapDeg: 0, focusErr: err, contrast: 1, centerErr: 0, objective: 40,
  });
  assert.ok(q.factors.focus < 1,
    `게이지는 초점을 깎지 않는데 화면은 안 맞았다고 합니다 (focus=${q.factors.focus})`);
  assert.equal(q.worst, 'focus', '가장 크게 깎인 것이 초점이어야 합니다');

  // 허용 범위 안이면 셋 다 「맞았다」다.
  const good = { ...m, coarse: tol * 0.9 };
  assert.equal(isFocused(good), true);
  assert.equal(observability({
    hasReticle: true, on: 'specimen', angleGapDeg: 0, focusErr: tol * 0.9, contrast: 1, centerErr: 0, objective: 40,
  }).factors.focus, 1);
});

/**
 * ★ **저배율에서 맞춘 자리에서 40배 초점까지 미동나사만으로 닿는다** (사장님: 「40배에서
 *   미동나사만으로는 초점이 안 맞고, 조동나사를 돌리면 깨진다」).
 *
 * 조동나사는 고배율에서 유리를 깨뜨리므로 쓸 수 없다. 그러니 저배율 합격선에 걸친
 * 잔차에서 40배 허용까지 **미동나사 폭 안에서** 내려올 수 있어야 한다.
 * 이 검사를 되돌리려면 `KNOB_SPAN.fine` 을 줄여야 하고, 그러면 여기서 걸린다.
 */
test('저배율에서 초점을 맞추고 올라오면 미동나사만으로 40배 초점에 닿는다', () => {
  /**
   * 덮어야 하는 잔차 둘.
   *
   *   `focusTolerance(4)`  = 0.30 · `focusTolerance(10)` = 0.12
   *       — 규칙이 「저배율에서 초점을 맞췄다」(`lowMagFocused`)로 세우는 바로 그 문턱
   *   `focusTolerance(10,'micrometer')` = 0.24
   *       — 10배에서 대물 마이크로미터를 보며 화면이 「초점이 맞았습니다」라고 말하는 폭.
   *         사장님이 짚은 자리가 여기다 (「10배에서 합격한 상태의 잔차가 0.2~0.24 면…」)
   *
   * **4배 눈금자 기준(0.60)은 넣지 않는다.** 그 폭까지 미동나사로 덮으려면 나사가
   * 조동나사만큼 강해져서 저배율에서 조동나사를 돌릴 이유가 사라진다. 그 자리는 규칙이
   * 「저배율에서 초점을 맞추지 않고 올렸습니다」로 잡고, 화면이 배율을 내려 맞추라고 말한다.
   */
  const bands = [
    ['4배 · lowMagFocused', focusTolerance(4)],
    ['10배 · lowMagFocused', focusTolerance(10)],
    ['10배 · 화면이 「맞았습니다」라고 하는 폭', focusTolerance(10, 'micrometer')],
  ];
  for (const [what, worst] of bands) {
    for (const on of ['stageMic', 'specimen']) {
      const need = focusToleranceOn(40, on);
      // 미동나사를 가운데(0)에 두고 저배율에서 맞춘 자리 — 거기서 한쪽으로 끝까지 돌린다.
      const reach = Math.max(0, worst - KNOB_SPAN.fine);
      assert.ok(reach <= need + 1e-9,
        `${what}(잔차 ${worst})에서 40배(${on}) 허용 ${need} 까지 `
        + `미동나사(±${KNOB_SPAN.fine})로 못 내려옵니다 — 남는 오차 ${reach.toFixed(3)}. `
        + '학생은 조동나사를 돌리게 되고 유리가 깨집니다');
    }
  }
  // 폭을 되돌리면(±0.2) 사장님이 짚은 그 자리가 되살아난다 — 검사가 그걸 물어야 한다.
  assert.ok(focusTolerance(10, 'micrometer') - 0.2 > focusToleranceOn(40, 'specimen'),
    '이 검사는 「±0.2 로는 못 닿는다」를 전제로 합니다. 광학 상수가 바뀌었으면 다시 쓰세요');
});

/**
 * ★ **나사 테두리의 호가 무엇인지 화면이 글로 말한다** (사장님: 「빨간 호·초록 원이
 *   왜 나오는지, 조건이 뭔지 모르겠다」). 색만으로 나르면 색을 못 가리는 학생에게는
 *   아무 말도 안 한 것이 된다 (WCAG 1.4.1).
 */
test('나사가 「얼마나 돌렸는지」와 「초점 범위 안인지」를 글로 말한다', () => {
  const mid = dialStateFor(0, KNOB_SPAN.fine, false);
  assert.ok(mid.includes(UI.zoom.dialCenter), '가운데(0)라는 말이 없습니다');
  assert.ok(mid.includes('초점 범위 밖'), '초점 범위 밖이라는 말이 없습니다');

  const end = dialStateFor(KNOB_SPAN.fine, KNOB_SPAN.fine, true);
  assert.ok(/끝까지/.test(end), '끝에 닿았다는 말이 없습니다');
  assert.ok(end.includes('초점 범위 안'), '초점 범위 안이라는 말이 없습니다');

  // 어느 쪽으로 돌렸는지도 말한다 — 「얼마나」만으로는 되돌릴 방향을 모른다.
  assert.ok(dialStateFor(-KNOB_SPAN.coarse / 2, KNOB_SPAN.coarse, false).includes(UI.zoom.dialLeft));
  assert.ok(dialStateFor(KNOB_SPAN.coarse / 2, KNOB_SPAN.coarse, false).includes(UI.zoom.dialRight));

  // 화면에 그 말이 실제로 그려지는지 — 함수만 있고 안 부르면 아무 데도 안 뜬다.
  const src = readFileSync(new URL('../src/ui/zoom.js', import.meta.url), 'utf8');
  assert.ok(/class="dial-state"/.test(src), '나사 밑에 그 글을 그리는 자리가 없습니다');
  assert.ok(src.includes('UI.zoom.dialLegend'), '호가 무엇인지 설명하는 줄이 화면에 없습니다');
});

/* ------------------------------------------------------------------ */
/* 통·상자 셋 · 꺼낸 물건 셋 — 한 화면으로 통일 (사장님 지시 2026-09-03) */
/* ------------------------------------------------------------------ */

const zoomSrc = () => readFileSync(new URL('../src/ui/zoom.js', import.meta.url), 'utf8');

/**
 * ★ 「통을 누르면 **진짜 통 내부처럼** 보이게. 단추는 「꺼내기」 하나만.」
 *
 * 앞서는 접안 통만 다른 함수(`renderOcularMode`)로 그려졌고, 통이 아니라 **원판 그림**이
 * 떴으며 단추가 넷이었다. 대물 보관함·표본 상자는 「살펴보기」 화면이었다 —
 * 셋이 같은 일을 하는데 화면이 셋 다 달랐다.
 */
test('통·상자 셋이 한 화면을 쓰고, 열린 통 안을 그리고, 단추는 「꺼내기」 하나다', () => {
  const src = stripComments(zoomSrc());
  assert.ok(!/function renderOcularMode/.test(src),
    '접안 통만 따로 그리는 함수가 남아 있습니다 — 셋이 갈립니다');
  assert.ok(/function renderBoxMode/.test(src), '통·상자 공통 화면이 없습니다');

  // 셋 다 같은 표에서 나온다.
  for (const kind of ['ocularBox', 'stageMicBox', 'specimenBox']) {
    assert.ok(new RegExp(`${kind}:\\s*\\{[^}]*asset:`).test(src),
      `${kind} 가 통 화면 표(BOX_VIEW)에 없습니다`);
  }
  // 통 그림은 **열린 상태**로 그린다 — 닫힌 통을 그리면 안이 안 보인다.
  assert.ok(/ASSETS\[view\.asset\]\.render\(\{ open: true/.test(src),
    '통을 열린 상태로 그리지 않습니다 — 「진짜 통 내부처럼」이 되지 않습니다');
  // 단추는 하나뿐이다. 화면은 공용 `renderItemView` 가 그리므로 단추는 `actions` 의 id 로 센다.
  const boxBtns = src.slice(src.indexOf('function renderBoxMode'), src.indexOf('function renderItemMode'));
  const ids = boxBtns.match(/id: '[a-z-]+'/g) ?? [];
  assert.deepEqual([...new Set(ids)], ["id: 'box-take'"],
    `통 화면에 단추가 「꺼내기」 말고 더 있습니다: ${ids.join(', ')}`);
  assert.ok(/label: UI\.zoom\.takeOut/.test(boxBtns), '통 화면의 단추가 「꺼내기」(UI.zoom.takeOut)가 아닙니다');

  // 설명 세 줄이 다 있다 — ① 무엇이 들었나 ② 하는 일 ③ 그림.
  assert.equal(typeof UI.zoom.boxHolds('접안 마이크로미터'), 'string');
  assert.ok(UI.zoom.boxHolds('접안 마이크로미터').startsWith('접안 마이크로미터가'),
    '조사가 「이(가)」로 남아 있습니다');
  assert.ok(UI.zoom.boxHolds('표본').startsWith('표본이'), '받침 없는 이름에 조사가 안 맞습니다');
  // ② 는 준비물 표의 「하는 일」을 그대로 쓴다 — 두 곳에 따로 쓰면 갈린다.
  for (const asset of ['ocular', 'stagemic', 'specimen']) {
    assert.ok(UI.notebook.materials.some((m) => m.asset === asset && m.role),
      `${asset} 의 「하는 일」이 준비물 표에 없습니다 — 통 화면 둘째 줄이 빕니다`);
  }
});

/**
 * ★ 「세 물건의 확대 화면·문구·단추 구조가 서로 같아야 합니다.」
 *
 * 원판·대물 마이크로미터·표본이 한 함수(`renderItemMode`)와 한 표(`ITEM_VIEW`)를 쓴다.
 * 끌어다 놓는 곳도 같은 모양이다 — 자기 상자, 그리고 현미경.
 */
test('꺼낸 물건 셋이 한 화면·한 표를 쓴다', () => {
  const src = stripComments(zoomSrc());
  for (const id of ['ocular', 'stageMic', 'specimen']) {
    assert.ok(new RegExp(`${id}:\\s*\\{[^}]*asset:[^}]*boxKey:`).test(src),
      `${id} 이(가) 물건 화면 표(ITEM_VIEW)에 없습니다 — 화면이 갈립니다`);
  }
  // 셋 다 자기 상자가 있고, 그 상자 이름이 실험대의 이름표와 같다.
  for (const key of ['ocularCase', 'stageMicBox', 'specimenBox']) {
    assert.equal(typeof UI.bench.items[key], 'string', `${key} 이름이 없습니다`);
  }
  // 넣기·올리기·버리기 문구가 다 있다.
  assert.equal(typeof UI.zoom.itemPutAwayBox('표본 상자'), 'string');
  assert.equal(typeof UI.zoom.itemPlaceOnStage, 'string');
  assert.equal(typeof UI.zoom.itemDiscard, 'string');
});

/**
 * ★ **확대 화면의 차례가 실제 관찰 순서다** (사장님 지시 2026-09-03).
 *
 * 시야 → 게이지 → (현미경 그림 밑) 내리기 → 접안렌즈 돌리기 → 배율 → 나사 → 조리개 →
 * 찍기 → 기록 → 사진. 앞서는 찍기가 배율보다 먼저였고 내리기가 맨 아래였다.
 */
test('현미경 확대 화면이 관찰 순서대로 놓인다', () => {
  const src = stripComments(zoomSrc());
  const body = src.slice(src.indexOf('function renderScopeMode'), src.indexOf('function crackedHtml'));
  const at = (needle) => {
    const i = body.indexOf(needle);
    assert.notEqual(i, -1, `화면에서 ${needle} 를 못 찾았습니다`);
    return i;
  };
  const order = ['scope-stage', 'count-slot', 'zoom-gauge', 'rotateHtml()', 'objectiveHtml(m)',
    'dial-row', 'ctrl-diaphragm', 'pickHtml(st)', 'record-cal', 'calibrationListHtml(st)', 'id="capture"'];
  let prev = -1;
  for (const key of order) {
    const i = at(key);
    assert.ok(i > prev, `${key} 이(가) 순서에서 앞으로 밀렸습니다`);
    prev = i;
  }
  // 「재물대에서 내리기」는 현미경 그림에 딸린다 — 깨졌을 때 가장 먼저 눈에 들어와야 한다.
  assert.ok(/scope-figure-col[\s\S]{0,400}scope-unmount/.test(body),
    '「재물대에서 내리기」가 현미경 그림 바로 아래에 없습니다');
});

/**
 * ★ **세포 경계를 찍는 일이 「눈금 확대 띠」로 안내된다** (사장님: 「세포에 눈금을 찍는
 *   것이 매우 어렵고 엉뚱한 곳에 찍힌다」).
 *
 * 시야 원에서는 접안 눈금 한 칸이 1.82 px 라 세포 끝을 눈금에 맞출 수가 없다.
 * 띠는 같은 것을 8배로 그린다. 그리고 찍히기 전에 십자선이 어디에 찍힐지 보여 준다.
 */
test('세포 찍기 — 확대 띠로 데려가고, 찍기 전에 십자선으로 보여 준다', () => {
  assert.ok(/눈금 확대 띠/.test(UI.zoom.pickHowCell),
    '세포를 시야 원에서만 찍으라고 합니다 — 거기서는 한 칸이 1.82 px 입니다');
  assert.ok(/십자선/.test(UI.zoom.pickHowCell), '십자선이 뜬다는 말이 없습니다');
  const src = stripComments(zoomSrc());
  assert.ok(/function drawAim/.test(src), '겨누는 자리를 그리는 함수가 없습니다');
  assert.ok(/function axisNormOf/.test(src), '누른 자리를 눈금자 축으로 내리는 함수가 없습니다');
  // **눈금선에 강제로 붙이지 않는다** — 세포 경계는 눈금선 사이에 온다.
  assert.ok(!/snapTo|Math\.round\(t \//.test(src), '찍는 자리를 눈금선에 붙이고 있습니다');
  // 손끝 보정 — 손가락이 닿는 자국의 한가운데는 겨눈 곳보다 아래다.
  assert.ok(/TOUCH_LIFT_PX/.test(src), '손끝 좌표 보정이 없습니다 — 폰에서 늘 아래를 찍습니다');
});
