/**
 * 2026-09-03 플레이테스트에서 고친 것들 — **되돌리면 여기서 빨간불이 난다.**
 *
 * 일곱 복제본(micrometer·osmosis·catalase·centrifuge·chromatography·fermentation·germination)을
 * 먼저 플레이해서 나온 구멍 가운데, **정본인 banana 에도 그대로 있던 것**을 고쳤다.
 * 검사마다 어느 자리인지와 왜 그게 문제인지를 적어 둔다 — 숫자만 맞추는 검사는 다음 사람이
 * 지워 버린다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { reduce, MOUNT_COARSE } from '../src/sim/rules.js';
import { initialState, REAGENTS } from '../src/sim/state.js';
import { focusTolerance } from '../src/sim/optics.js';
import { stepNotesWritten, QUESTION_A_STEP } from '../src/ui/notebook.js';
import { UI } from '../src/ui/strings.js';

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const run = (s, type, payload = {}) => reduce(s, { type, payload });

/* ------------------------------------------------------------------ */
/* ① 「여기에 놓기」 단추가 손가락을 받는가 — 주석 하나가 규칙을 통째로 삼켰다 */
/* ------------------------------------------------------------------ */

test('실험대 말풍선의 놓기 단추가 포인터를 받는다 (주석이 CSS 를 삼키지 않는다)', () => {
  /*
   * `index.html` 의 <style> 안에서 주석이 **한 줄 일찍 닫혀** 있었다. 그 뒤 두 줄이 CSS
   * 본문으로 읽히면서, CSS 오류 복구가 **바로 다음 규칙 하나를 통째로 버렸다** —
   * 버려진 것이 `.bench-tip [data-onto]{pointer-events:auto}` 였다.
   * 말풍선 몸통은 `pointer-events:none` 이라, 「여기에 놓기」 단추는 화면에 떠 있는데
   * **마우스·손가락으로 누르면 그대로 통과**해 아무 일도 안 일어났다. 물건을 클릭하면
   * 그 물건이 포커스를 받아 이 단추가 나오므로 마우스만 쓰는 학생도 이 막다른 길을 본다.
   * 키보드는 Enter 가 포커스된 단추로 바로 가서 멀쩡했다 — 그래서 여태 안 보였다.
   */
  const html = src('../index.html');
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];

  // 주석을 걷어낸 자리에 닫는 표시가 남아 있으면 어딘가 일찍 닫힌 것이다.
  const withoutComments = style.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  assert.ok(!withoutComments.includes('*/'),
    'CSS 주석이 짝이 안 맞습니다 — 그 뒤 규칙 하나가 조용히 버려집니다');

  // 그리고 그 규칙이 **주석 밖에** 실제로 살아 있어야 한다.
  assert.ok(/\.bench-tip\s+\[data-onto\]\s*\{[^}]*pointer-events\s*:\s*auto/.test(withoutComments),
    '놓기 단추가 포인터를 받지 못합니다 — 마우스·손가락으로는 물건을 옮길 수 없습니다');
});

/* ------------------------------------------------------------------ */
/* ② 질문 ⓐ 가 STEP 이 접히며 사라지지 않는가                            */
/* ------------------------------------------------------------------ */

const withNotes = (level, notes) => {
  const st = initialState(level);
  return { ...st, session: { ...st.session, level, notes } };
};
const groupA = UI.protocol.find((g) => g.id === QUESTION_A_STEP);
const subKeys = groupA.steps.map((_, i) => `${groupA.id}${String.fromCharCode(97 + i)}`);

test('질문 ⓐ 를 적기 전에는 그 STEP 이 「다 적은 것」이 아니다 (1단계)', () => {
  /*
   * 관찰 기록 칸을 다 적고 손을 떼는 순간 그 STEP 이 접혔고, 밑에 붙어 있던 질문 ⓐ 가
   * **한 번도 보이지 않은 채** 사라졌다. ⓐ 는 (가)(나)(다) 세 색을 눈으로 본 **직후**에
   * 물어야 하는 것이라(docs/06), 그 자리를 놓치면 6쪽에서 기억으로 더듬는 문제가 된다.
   */
  const filled = Object.fromEntries(subKeys.map((k) => [k, '적었습니다']));
  assert.equal(stepNotesWritten(withNotes(1, filled), groupA), false,
    'ⓐ 가 비었는데 STEP 이 접힙니다 — 학생은 그 물음을 한 번도 못 봅니다');
  assert.equal(stepNotesWritten(withNotes(1, { ...filled, 'q.a': '대조군이 있어야 …' }), groupA), true,
    'ⓐ 까지 적었는데도 안 넘어갑니다');
});

test('질문 ⓐ 는 3단계에서도 같은 자리에 있다 — 없는 칸을 채우라는 벽이 되면 안 된다', () => {
  const one = { [groupA.id]: '스스로 적은 목표' };
  assert.equal(stepNotesWritten(withNotes(3, one), groupA), false);
  assert.equal(stepNotesWritten(withNotes(3, { ...one, 'q.a': '대조군이 있어야 …' }), groupA), true);

  // 3단계 갈래에도 ⓐ 를 그린다. 안 그리면 위 판정이 **답할 칸 없는 자물쇠**가 된다.
  const nb = src('../src/ui/notebook.js');
  const goalOnly = nb.match(/if \(level >= 3\) \{[\s\S]*?\n {6}\}/)[0];
  assert.ok(goalOnly.includes('${qa}'),
    '3단계 STEP 에 질문 ⓐ 가 없습니다 — 답할 칸이 없는 채로 잠깁니다');
});

test('ⓐ 를 붙이는 STEP 은 한 곳에서만 정한다', () => {
  const nb = src('../src/ui/notebook.js');
  assert.ok(!/group\.id === '\d'/.test(nb),
    'STEP 번호를 코드에 박아 두면 그리는 쪽과 판정하는 쪽이 갈립니다 (QUESTION_A_STEP 을 쓰세요)');
  assert.ok(UI.protocol.some((g) => g.id === QUESTION_A_STEP), 'QUESTION_A_STEP 이 없는 STEP 입니다');
});

/* ------------------------------------------------------------------ */
/* ③ 초록 말풍선이 몇 조작 뒤처지지 않는가                               */
/* ------------------------------------------------------------------ */

function fakeDom() {
  const shown = [];
  const mk = () => {
    const el = {
      textContent: '', className: '', type: '', attrs: {}, kids: [], handlers: {},
      classList: { add() {} },
      setAttribute(k, v) { el.attrs[k] = v; },
      addEventListener(t, fn) { el.handlers[t] = fn; },
      append(...cs) { el.kids.push(...cs); },
      remove() { root.children = root.children.filter((c) => c !== el); },
      get shownText() { return el.kids[0]?.textContent ?? el.textContent; },
    };
    return el;
  };
  const root = {
    children: [], setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(el); },
  };
  globalThis.document = { createElement: mk };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  return { root, shown };
}
const { createToastQueue } = await import('../src/ui/toast.js');
const texts = (shown) => shown.map((e) => e.shownText);

test('잘된 말은 뒤에 줄이 서면 비켜 준다 — 여섯 조작 전 이야기를 읽어 주지 않는다', (t) => {
  /*
   * 1단계 정상 경로를 그대로 밟았더니, 아이오딘 병에 스포이트를 댈 때까지도 화면에는
   * **「바나나 껍질을 벗겼습니다」**가 떠 있었다 — 여섯 조작 전 말이다. 태그가 저마다
   * 달라서 「같은 태그면 갈아 끼운다」로는 하나도 안 걸렸다.
   */
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  const said = ['껍질을 벗겼습니다.', '(가)에 발랐습니다.', '(나)에 발랐습니다.',
    '(다)에 발랐습니다.', '증류수를 담았습니다.', '헹궜습니다.', '아이오딘을 담았습니다.'];
  // 사람이 조작 사이에 두는 정도(1.7초)로 이어서 한다. 그 속도면 화면이 따라와야 한다 —
  // 앞서는 하나가 3.5~8초를 머물러 **여섯 조작 전** 말을 읽어 주고 있었다.
  for (const [i, m] of said.entries()) {
    toast.push(m, 'ok', `t${i}`);
    t.mock.timers.tick(1700);
  }
  assert.equal(texts(shown).at(-1), said.at(-1),
    `화면이 조작보다 뒤처져 있습니다 — 뜬 차례: ${JSON.stringify(texts(shown))}`);
});

test('빨간 말은 시간을 안 뺏는다 — 뒤에 줄이 서 있어도 제 시간을 머문다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('금이 갔습니다. 새로 만들어야 합니다.', 'happened', 'cracked');
  toast.push('껍질을 벗겼습니다.', 'ok', 'peeled');
  t.mock.timers.tick(2500);          // 초록이 비키는 시간(1.5초)을 넘겼는데도
  assert.equal(shown.length, 1, '읽어야 하는 빨간 말이 밀려났습니다');
});

test('숫자만 다른 말은 줄을 서지 않고 갈아 끼운다 — 지난 수를 읽어 주지 않는다', (t) => {
  /*
   * 스포이트를 열한 번 누르면 「…고였습니다 (5방울)」…(11방울) 이 **저마다 다른 글자**라
   * 큐에 일곱 개가 쌓였고, 하나가 8초씩 머물러 손을 뗀 뒤 거의 1분 동안 지난 수를 읽어 줬다.
   * 그동안 그다음 조작 둘의 답은 그 줄에 파묻혀 아예 안 나왔다 (PLAYTEST §4-2).
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  for (let n = 5; n <= 11; n++) toast.push(`액이 흘러넘쳐 고였습니다 (${n}방울).`, 'happened', 'overflow');
  toast.push('그다음 조작의 답입니다.', 'happened', 'other');
  t.mock.timers.tick(5 * 60 * 1000);
  const all = texts(shown);
  assert.equal(all.filter((m) => m.includes('흘러넘쳐')).length, 1,
    `같은 말이 ${all.length}번 줄을 섰습니다: ${JSON.stringify(all)}`);
  assert.ok(all.some((m) => m.includes('흘러넘쳐 고였습니다 (11방울)')),
    `마지막 수를 못 듣습니다 — 뜬 것: ${JSON.stringify(all)}`);
  assert.ok(all.includes('그다음 조작의 답입니다.'), '뒤 조작의 답이 파묻혔습니다');
});

/* ------------------------------------------------------------------ */
/* ④ 정상 경로 한가운데에 빨간 말풍선이 뜨지 않는가                      */
/* ------------------------------------------------------------------ */

test('첫 방울은 실패가 아니다 — 두 방울을 제대로 하는 학생도 반드시 지나는 자리다', () => {
  let s = initialState(1);
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  const r = run(s, 'DROP', { slide: 'B', count: 1 });
  assert.equal(r.outcome, 'ok',
    '한 방울에 빨간 말풍선이 뜹니다 — 제대로 하고 있는데 「틀렸다」는 색을 봅니다');
  assert.ok(r.message.includes('한 방울 더'), '다음에 무엇을 할지가 문장 안에 있어야 합니다');
});

test('세 방울 안내는 빨간 색과 같은 말을 한다 — 칭찬처럼 읽히지 않는다', () => {
  let s = initialState(1);
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  const r = run(s, 'DROP', { slide: 'B', count: 3 });
  assert.equal(r.tag, 'excess');
  assert.ok(/덜 또렷|잘 보이지/.test(r.message),
    `빨간 말풍선인데 글은 잘된 일처럼 읽힙니다: ${r.message}`);
});

/* ------------------------------------------------------------------ */
/* ⑤ 2·3단계가 「저배율부터 직접 맞춥니다」를 지키는가                    */
/* ------------------------------------------------------------------ */

test('재물대에 올리면 초점이 흐트러진다 — 안 그러면 나사를 안 돌려도 400배가 선명하다', () => {
  let s = initialState(2);
  s = run(s, 'PEEL_BANANA').state;
  s = run(s, 'SMEAR', { slide: 'B', thickness: 0.3 }).state;
  s = run(s, 'FILL_DROPPER', { reagent: REAGENTS.IKI }).state;
  s = run(s, 'DROP', { slide: 'B', count: 2 }).state;
  for (let i = 0; i < 12; i++) s = run(s, 'TICK', { seconds: 1, speed: 10 }).state;
  s = run(s, 'PICK_COVERSLIP').state;
  s = run(s, 'PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 }).state;

  s = run(s, 'MOUNT', { slide: 'B' }).state;
  assert.equal(s.microscope.lowMagFocused, false, '올리자마자 초점이 맞아 있다고 기록됩니다');
  assert.ok(Math.abs(s.microscope.coarse + s.microscope.fine) > focusTolerance(4),
    '올린 직후가 저배율 허용 범위 안입니다 — 맞출 것이 없으면 「직접 맞춥니다」가 거짓말입니다');

  // 조동나사로 맞추면 실제로 맞아야 한다 — 말만 하고 길이 없으면 더 나쁘다.
  s = run(s, 'COARSE_FOCUS', { delta: -MOUNT_COARSE }).state;
  assert.equal(s.microscope.lowMagFocused, true);
  assert.ok(Math.abs(s.microscope.coarse + s.microscope.fine) < focusTolerance(40),
    '조동나사로 맞춰도 고배율 초점에 못 닿습니다');
  assert.ok(MOUNT_COARSE < 1, '조동나사 범위(±1) 밖이면 어느 쪽으로 돌려도 못 맞춥니다');
});

/* ------------------------------------------------------------------ */
/* ⑥ 다크 모드 · 죽은 문자열                                            */
/* ------------------------------------------------------------------ */

test('시야 지름 글자는 바탕 색을 따라간다 — 다크 모드에서 배율 눈금이 사라지면 안 된다', () => {
  const fov = src('../src/render/fov.js');
  const line = fov.split('\n').find((l) => l.includes('시야 지름 약'));
  assert.ok(line.includes('currentColor'),
    '검정을 박아 두면 다크 모드에서 안 읽힙니다 — 배율을 읽는 유일한 눈금입니다');
});

test('다음 행동 표에 같은 열쇠가 두 번 들어 있지 않다 — 뒤엣것이 앞엣것을 조용히 지운다', () => {
  const strings = src('../src/ui/strings.js');
  const block = strings.match(/nextAction: \{([\s\S]*?)\n {4}\},/)[1];
  const keys = [...block.matchAll(/^\s*'?([\w-]+)'?\s*:/gm)].map((m) => m[1]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dup, [], `열쇠가 겹칩니다 — 앞의 문장은 한 번도 화면에 안 나옵니다: ${dup}`);
});
