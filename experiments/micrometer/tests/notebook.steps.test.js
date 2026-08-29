/**
 * 탐구 과정(4절) — **한 번에 한 STEP.**
 *
 * 여섯 STEP 을 한꺼번에 펼쳐 놓으면 학생이 그것을 「읽을 글」로 받는다. 주욱 읽고 내려간
 * 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다. 지금 할 것 하나만 펼치면 노트가 글이
 * 아니라 **따라가는 길**이 된다.
 *
 * **접힘은 잠금이 아니다** (AGENTS.md §2.1). 앞으로 올 STEP 도 눌러서 열려야 하고,
 * 순서를 건너뛰어 실험한 학생은 거기에 적으면 된다. 그래서 여기서 잴 것은
 * 「못 열게 막았는가」가 아니라 **「열어 둔 것이 그대로 있는가」**다.
 *
 * 화면(`<details>`)이 아니라 `stepPanelStates()` 를 잰다 — 그리는 일에서 떼어 놓은
 * 순수 함수라 DOM 없이 판정된다. 브라우저에서 실제로 넘어가는지는
 * `scripts/check-ui.mjs` 의 「탐구 과정 —」 항목이 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepPanelStates, stepLockedBy } from '../src/ui/notebook.js';
import { buildSheet } from '../src/ui/report.js';
import { initialState } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';
import { stripComments } from './strip-comments.js';

const GROUPS = UI.protocol.map((g) => ({ id: g.id }));
const allFalse = () => GROUPS.map(() => false);

/* ---------------- 지금 할 차례인 STEP 하나만 펼쳐진다 ---------------- */

test('지금 할 차례인 STEP 하나만 펼쳐진다', () => {
  const panels = stepPanelStates(GROUPS, allFalse());
  const open = panels.filter((p) => p.open);
  assert.equal(open.length, 1, `펼쳐진 STEP 이 ${open.length}개입니다 — 하나여야 합니다`);
  assert.equal(panels[0].state, 'now');
  assert.equal(panels[0].open, true);
});

test('끝난 STEP 은 접히고 그 다음이 지금 STEP 이 된다', () => {
  const done = allFalse();
  done[0] = true;
  done[1] = true;
  const panels = stepPanelStates(GROUPS, done);
  assert.deepEqual(panels.map((p) => p.state).slice(0, 3), ['done', 'done', 'now']);
  assert.equal(panels.filter((p) => p.open).length, 1);
  assert.equal(panels[2].open, true, '지금 STEP 이 펼쳐져 있어야 합니다');
});

test('다 끝나면 펼쳐진 STEP 이 없다 — 가리킬 다음이 없기 때문이다', () => {
  const panels = stepPanelStates(GROUPS, GROUPS.map(() => true));
  assert.equal(panels.every((p) => p.state === 'done'), true);
  assert.equal(panels.filter((p) => p.open).length, 0);
});

/* ---------------- 앞으로 올 STEP 도 열린다 (접힘은 잠금이 아니다) ---------------- */

/* ---------------- 앞 STEP 을 적어야 다음이 열린다 ---------------- */

/**
 * 선생님 지시로 잠금이 들어왔다 — 「관찰 기록 입력하지 않으면 다음 step 으로 못 넘어가게」.
 *
 * ★ **「접힘은 잠금이 아니다」와 부딪히지 않는다.** 잠금은 **아직 한 번도 안 가 본 앞쪽**에만
 *   걸린다(조건 ③). 한 번 닿아 본 STEP 은 앞엣것을 도로 지워도 다시 안 잠기고,
 *   순서를 건너뛴 학생은 열어 둔 곳에 계속 적을 수 있다. 아래 검사들이 그 둘을 함께 잰다.
 */
test('앞 STEP 의 관찰 기록이 비었으면 뒤 STEP 이 잠긴다', () => {
  const unwritten = GROUPS.map(() => true);
  const locked = stepLockedBy(GROUPS, 2, 0, unwritten, new Set());
  assert.equal(locked, GROUPS[0].id, '뒤 STEP 이 안 잠겼습니다');
  assert.equal(stepLockedBy(GROUPS, 0, 0, unwritten, new Set()), null,
    '지금 할 STEP 을 잠갔습니다 — 적을 자리가 사라집니다');
});

test('★ 앞 STEP 을 적으면 **딱 한 칸만** 열린다', () => {
  /*
   * ★ 여기 있던 검사는 「STEP 3 이 열리는가」를 재고 **초록불이었다.**
   *   그런데 그게 바로 버그였다 — STEP 1 을 적는 순간 **여섯이 통째로 열렸고**,
   *   검사는 그것을 「잠금이 풀렸다」고 칭찬하고 있었다.
   *   선생님이 플레이하다 찾으셨다: 「왜 나머지 step 들까지도 다 열려」.
   *
   *   **한 칸 여는 것과 통째로 여는 것을 가르지 않으면 검사가 버그를 보증한다.**
   *   그래서 여는 쪽과 안 여는 쪽을 **함께** 잰다.
   */
  const unwritten = GROUPS.map(() => true);
  unwritten[0] = false;                       // STEP 1 의 관찰 기록을 적었다
  assert.equal(stepLockedBy(GROUPS, 1, 0, unwritten, new Set()), null,
    'STEP 1 을 적었는데 STEP 2 가 안 열립니다');
  assert.equal(stepLockedBy(GROUPS, 2, 0, unwritten, new Set()), GROUPS[1].id,
    'STEP 1 을 적었더니 STEP 3 까지 열렸습니다 — 한 칸씩만 열려야 합니다');
  for (let gi = 3; gi < GROUPS.length; gi++) {
    assert.ok(stepLockedBy(GROUPS, gi, 0, unwritten, new Set()),
      `STEP ${gi + 1} 이 열려 있습니다 — 한 칸씩만 열려야 합니다`);
  }
});

test('아직 안 적었으면 지금 STEP 까지만 열린다', () => {
  const unwritten = GROUPS.map(() => true);
  assert.equal(stepLockedBy(GROUPS, 0, 0, unwritten, new Set()), null, '지금 STEP 이 잠겼습니다');
  assert.equal(stepLockedBy(GROUPS, 1, 0, unwritten, new Set()), GROUPS[0].id,
    '적지 않았는데 다음 STEP 이 열렸습니다');
});

test('★ 한 번 열어 본 STEP 은 앞엣것을 도로 지워도 다시 안 잠긴다', () => {
  // 이것이 「접힘은 잠금이 아니다」를 살려 두는 조건이다 (AGENTS.md §2.1).
  // 브라우저에서도 확인했다 — STEP 3 에 닿은 뒤 STEP 2 의 기록을 지워도 3 은 열려 있다.
  const unwritten = GROUPS.map(() => true);
  const seen = new Set([GROUPS[2].id]);
  assert.equal(stepLockedBy(GROUPS, 2, 0, unwritten, seen), null,
    '한 번 닿아 본 STEP 을 도로 잠갔습니다 — 열어 둔 곳에 적던 학생의 자리가 사라집니다');
});

test('다 끝났으면 아무것도 안 잠근다', () => {
  const unwritten = GROUPS.map(() => false);
  for (let i = 0; i < GROUPS.length; i++) {
    assert.equal(stepLockedBy(GROUPS, i, -1, unwritten, new Set()), null);
  }
});

test('잠글 때는 왜 막혔는지 말한다 — 말 없는 회색 칸은 고장으로 읽힌다', () => {
  const why = UI.notebook.stepLockedWhy(GROUPS[0].id);
  assert.ok(why && why.includes(GROUPS[0].id), '무엇을 적어야 하는지 말하지 않습니다');
  assert.ok(UI.notebook.stepLockedHint?.trim().length > 0, '잠긴 칸에 붙는 짧은 안내가 없습니다');
});

test('잠근 칸도 disabled 나 pointer-events 로 죽이지 않는다', () => {
  // 잠긴 칸은 `<details>` 가 아니라 아예 다른 껍데기(`div`)로 그린다 —
  // **열리는 척하다가 안 열리는 것이 가장 나쁘다.**
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const stage4 = stripComments(
    src.slice(src.indexOf('function renderStage4'), src.indexOf('function questionA')));
  assert.equal(/(?<!aria-)\bdisabled\b/.test(stage4), false);
  assert.equal(/pointer-events\s*:\s*none/.test(stage4), false);
  assert.ok(stage4.includes('note-step--locked'), '잠긴 칸을 다른 껍데기로 그리지 않습니다');
});

test('앞으로 올 STEP 도 눌러서 열린다 — 접힘은 잠금이 아니다', () => {
  const last = GROUPS[GROUPS.length - 1].id;
  const panels = stepPanelStates(GROUPS, allFalse(), new Map([[last, true]]));
  assert.equal(panels[GROUPS.length - 1].open, true,
    '앞으로 올 STEP 을 열어 두었는데 안 열렸습니다 — 순서를 건너뛴 학생이 적을 곳이 없어집니다');
  // 지금 STEP 은 그대로 열려 있다. 하나를 더 연다고 다른 것이 닫히지는 않는다.
  assert.equal(panels[0].open, true);
});

test('앞으로 올 STEP 을 죽여 두는 속성을 쓰지 않는다', () => {
  // `disabled`·`pointer-events:none` 으로 막으면 순서를 건너뛴 학생이 적을 곳을 잃는다.
  // 판정할 것은 값이 아니라 **그런 코드가 없다**는 것이라 원본을 읽는다 — 주석은 빼고.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const stage4 = stripComments(
    src.slice(src.indexOf('function renderStage4'), src.indexOf('function questionA')));
  /**
   * ★ **`aria-disabled` 는 막지 않는다.**
   *
   * `disabled` 는 단추에서 **포커스를 빼앗는다** — 키보드나 낭독기로 오는 학생은 그
   * 단추에 닿을 수조차 없어서 **「왜 못 누르는지」를 들을 길이 사라진다.** 그래서
   * 무언가를 못 하게 표시할 일이 생기면 `aria-disabled` + `aria-describedby` 로 하고,
   * 누르는 쪽에서 한 번 더 막는다(표시만 하고 안 막으면 표시가 거짓말이 된다).
   *
   * 검사를 지우지 않고 **좁힌다.** 지우면 진짜 `disabled` 가 슬그머니 들어온다.
   * (여덟 저장소가 각각 같은 결론에 왔고 허브가 모아 내려보냈다)
   */
  assert.equal(/(?<!aria-)\bdisabled\b/.test(stage4), false,
    'renderStage4 에 disabled 가 있습니다 — 포커스를 빼앗아 이유를 들을 길이 사라집니다.'
    + ' 막아야 한다면 aria-disabled 를 쓰세요 (AGENTS.md §2.1)');
  assert.equal(/pointer-events\s*:\s*none/.test(stage4), false,
    'renderStage4 에 pointer-events:none 이 있습니다 — 접힘은 잠금이 아닙니다');
});

test('그 검사가 자기 주석을 물지 않고, 진짜 코드는 문다', () => {
  // **양방향으로 본다.** 빨간불만으로는 반쪽이다 — 주석에 초록불인지까지 봐야 한다.
  // `stripComments` 는 **줄 하나가 통째로 주석인 것**을 지운다. 이 저장소의 규칙 설명은
  // 전부 제 줄에 있으므로(JSDoc) 잡으려는 것은 다 잡힌다.
  const jsdoc = [
    '/**',
    ' * disabled 로 죽이지 마세요 — pointer-events:none 도 안 됩니다.',
    ' */',
    'function f() { return 1; }',
  ].join('\n');
  assert.equal(/disabled/.test(stripComments(jsdoc)), false,
    '주석에 적은 규칙을 코드로 셌습니다 — 검사가 문서를 쫓아냅니다');
  assert.equal(/pointer-events\s*:\s*none/.test(stripComments(jsdoc)), false);

  const lineComment = '// disabled 를 쓰지 않는다\nconst a = 1;';
  assert.equal(/disabled/.test(stripComments(lineComment)), false);

  const realCode = 'function f(){ el.disabled = true; }';
  assert.equal(/disabled/.test(stripComments(realCode)), true,
    '진짜로 죽이는 코드를 놓쳤습니다');

  // 문자열에 든 것은 화면에 나가므로 **남아야** 한다.
  const inString = 'const h = `<summary disabled>`;';
  assert.equal(/disabled/.test(stripComments(inString)), true,
    '문자열에 든 disabled 를 지웠습니다 — 그것은 진짜로 화면에 나갑니다');

  // HTML 주석도 같이 지운다 (`index.html` 이 이 함수를 지난다).
  const html = '<!-- disabled 를 쓰지 마세요 -->\n<button id="x">누르기</button>';
  assert.equal(/disabled/.test(stripComments(html)), false);
});

/* ---------------- 질문 ⓐ 가 붙은 자리 ---------------- */

/**
 * ★ 아코디언이 되기 전에는 **다 펼쳐져 있어서 스크롤하면 보였다.** 그래서 물음이 엉뚱한
 *   STEP 에 붙어 있어도 아무도 몰랐다. 접히기 시작하면 **그 STEP 이 끝나는 순간 사라진다** —
 *   묻는 조작을 하기도 전에 접혀 버리면 학생은 그 물음을 영영 못 본다.
 *   (centrifuge 세션이 자기 저장소에서 그 자리를 찾아 허브를 거쳐 넘겨 주었다)
 */
test('질문 ⓐ 는 그 물음이 말하는 조작이 실제로 일어나는 STEP 에 붙어 있다', () => {
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const m = src.match(/group\.id === '(\d+)' \? questionA\(st\)/);
  assert.ok(m, 'renderStage4 에서 질문 ⓐ 를 붙이는 자리를 못 찾았습니다');
  const hostId = m[1];
  const hostAt = UI.protocol.findIndex((g) => g.id === hostId);
  assert.ok(hostAt >= 0, `STEP ${hostId} 이 없습니다`);

  // 물음은 「방금 두 눈금자를 겹쳐 보았습니다」 로 시작한다. 그 조작이 있는 STEP 이어야 한다.
  const host = UI.protocol[hostAt];
  assert.ok(host.steps.some((st) => st.label.includes('겹치')),
    `질문 ⓐ 가 STEP ${hostId}(${host.title}) 에 붙어 있는데, 거기에는 「겹치」는 조작이 없습니다`);

  // **그보다 앞선 STEP 에서 이미 일어나는 일이어서도 안 된다.** 「방금」이 거짓이 된다.
  const earlier = UI.protocol.slice(0, hostAt)
    .filter((g) => g.steps.some((st) => st.label.includes('겹치')));
  assert.equal(earlier.length, 0,
    `「겹치」는 조작이 STEP ${earlier.map((g) => g.id).join('·')} 에서 이미 일어납니다 — `
    + '「방금 …했습니다」가 거짓이 됩니다');
});

test('6단계는 질문 ⓐ 를 다시 묻지 않고 탐구 과정에서 쓴 답을 이어 쓴다', () => {
  // 같은 물음을 두 번 물으면 학생은 앞에서 쓴 것을 기억으로 더듬어 다시 쓴다 —
  // 「눈앞의 관찰」이 「지식 회상」으로 바뀐다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const stage6 = src.slice(src.indexOf('function renderStage6'));

  // 6단계에도 칸이 있는 것은 맞다 — **같은 `q.a` 를 이어 쓰는 칸**이라 어느 쪽에서
  // 고쳐도 한 벌이다. 잴 것은 「칸이 몇 개인가」가 아니라 **「다시 묻는가」**다.
  assert.ok(stage6.includes('data-note="q.a"'),
    '6단계에 질문 ⓐ 를 이어 쓰는 칸이 없습니다');
  // ★ **원본에서 찾을 것은 그려진 글자가 아니라 그 글자를 부르는 자리**다.
  //   `UI.notebook.questionA.label` 의 **내용**으로 원본을 뒤지면 영영 안 걸린다 —
  //   원본에는 `${N.questionA.label}` 이라고만 적혀 있기 때문이다.
  //   (실제로 그렇게 썼다가 되돌려도 초록불이라 알아챘다)
  assert.equal(/questionA\.label/.test(stage6), false,
    '6단계가 질문 ⓐ 의 물음을 **다시 내걸고** 있습니다 — 그때 본 것을 기억으로 더듬는 문제가 됩니다');
  assert.ok(UI.notebook.qaContinueLabel.includes('탐구 과정'),
    '6단계 안내가 「탐구 과정에서 쓴 답」이라고 말하지 않습니다');

  // 저장 키가 하나여야 「한 벌」이 성립한다. 다른 키로 새면 두 답이 갈린다.
  const keys = [...src.matchAll(/data-note="(q\.a|qa)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)], ['q.a'],
    `질문 ⓐ 가 여러 키로 저장됩니다: ${[...new Set(keys)].join(' ')}`);
});

/* ---------------- 빈칸 수 = 기록칸 수 ---------------- */

/** 종이의 「탐구 과정」 절만 잘라 낸다. `<li><b>` 는 다른 절에도 있어 통째로 세면 헛짚는다. */
function processSection(st) {
  const sheet = buildSheet(st, {});
  const from = sheet.indexOf(UI.report.sections.process);
  assert.ok(from >= 0, '종이에 탐구 과정 절이 없습니다');
  const rest = sheet.slice(from);
  return rest.slice(0, rest.indexOf('</section>'));
}

const countBlanks = (html) =>
  (html.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;

/**
 * 그 난이도에서 **화면이 실제로 내는 기록칸**의 키. 난이도마다 다르다.
 * 1·2단계는 세부 단계마다(`3b`), 3단계는 STEP 하나에 하나(`3`).
 */
function noteKeysFor(level) {
  if (level >= 3) return UI.protocol.map((g) => g.id);
  return UI.protocol.flatMap((g) =>
    g.steps.map((s, i) => (s.note ? `${g.id}${String.fromCharCode(97 + i)}` : null)).filter(Boolean));
}

test('아무것도 안 적었을 때 빈칸 수 = 그 난이도의 기록칸 수 (1·2·3단계 모두)', () => {
  // 기록칸을 열일곱에서 일곱으로 줄이면서 생긴 어긋남이다. 종이가 여전히 열일곱 칸을
  // 찍으면, **적을 칸을 준 적도 없는 열 칸**에 「적지 않았습니다」가 달린다 —
  // 선생님 눈에는 학생이 건너뛴 것으로 읽힌다.
  //
  // ★ **난이도를 다 돌아야 한다.** 예전에는 `initialState(1)` 하나로만 종이를 만들었고,
  //   그래서 3단계에서 종이가 다른 키를 읽고 있는 것을 아무도 못 봤다.
  for (const level of [1, 2, 3]) {
    const expected = noteKeysFor(level).length;
    const blanks = countBlanks(processSection(initialState(level)));
    assert.equal(blanks, expected,
      `${level}단계 — 종이의 빈칸이 ${blanks}개인데 화면의 기록칸은 ${expected}개입니다`);
  }
});

test('학생이 적은 것은 난이도와 무관하게 종이에 그대로 실린다', () => {
  // ★ 3단계 노트는 절차를 안 짚어 줘서 **STEP 하나에 칸 하나**(`notes['1']`)인데,
  //   종이가 **세부 단계 키**(`notes['1a']`)만 읽고 있었다. 그래서 3단계로 푼 학생은
  //   적고도 **한 자도 안 실렸고**, 준 적 없는 칸에 「적지 않았습니다」가 달렸다 —
  //   재어 보니 적은 칸 6 · 실린 것 0 · 빈칸 7 이었다.
  //   화면 쪽 갈래만 만들고 종이 쪽을 잊은 자리다.
  for (const level of [1, 2, 3]) {
    const keys = noteKeysFor(level);
    const notes = Object.fromEntries(keys.map((k) => [k, `학생이적은글-${level}-${k}`]));
    const st = initialState(level);
    const html = processSection({ ...st, session: { ...st.session, notes } });

    const missing = keys.filter((k) => !html.includes(notes[k]));
    assert.deepEqual(missing, [],
      `${level}단계에서 학생이 적은 것이 종이에 없습니다: ${missing.join(', ')}`);
    // 다 적었으면 빈칸은 하나도 없어야 한다. **양쪽을 다 봐야 반쪽이 아니다.**
    assert.equal(countBlanks(html), 0,
      `${level}단계 — 다 적었는데 종이에 빈칸이 ${countBlanks(html)}개 남았습니다`);
  }
});

test('기록칸은 조작의 결과가 화면에 나타나는 자리에만 있다', () => {
  // 준비 동작이나 초점 맞추기는 상태이지 관찰 결과가 아니고, ✓ 가 이미 말한다.
  // 칸이 다시 늘어나면 빈칸이 줄줄이 남아 안 한 일처럼 읽힌다.
  const total = UI.protocol.reduce((n, g) => n + g.steps.length, 0);
  const noteBoxes = UI.protocol.reduce((n, g) => n + g.steps.filter((s) => s.note).length, 0);
  assert.ok(noteBoxes < total,
    '모든 세부 단계에 기록칸이 있습니다 — 「조작의 결과가 나타나는 자리만」 이라는 기준이 사라졌습니다');
  assert.equal(noteBoxes, 7, `기록칸이 ${noteBoxes}개입니다 — 기준을 바꿨다면 이 수와 보고서를 함께 고치세요`);
});
