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
 * 순수 함수라 DOM 없이 판정된다. 브라우저에서 실제로 STEP 이 넘어가는지는
 * `scripts/check-bench.mjs` 가 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepPanelStates, QUESTION_A_STEP, PREDICT_STAGE } from '../src/ui/notebook.js';
import { buildSheet } from '../src/ui/report.js';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { groupDone } from '../src/sim/progress.js';
import { OBSERVE_LIMIT_MIN } from '../src/sim/metabolism.js';
import { UI } from '../src/ui/strings.js';

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

test('앞으로 올 STEP 을 지우지 않는다 — 몇 칸짜리 여정인지 보여야 한다', () => {
  // **잠긴 것도 남는다.** 잠긴 STEP 은 열리지 않을 뿐 제목이 그대로 있어, 몇 칸짜리
  // 여정인지를 계속 보여 준다. 지워 버리면 학생은 자기가 어디쯤인지 알 수 없다.
  const panels = stepPanelStates(GROUPS, allFalse());
  assert.equal(panels.length, GROUPS.length,
    'STEP 이 줄었습니다 — 자기가 어디쯤인지 알려면 앞으로 올 것도 보여야 합니다');
  assert.equal(panels.slice(1).every((p) => p.state === 'later' || p.state === 'locked'), true,
    `앞으로 올 STEP 의 상태가 이상합니다: ${panels.map((p) => p.state).join(' ')}`);
});

/* ---------------- 앞으로 올 STEP 도 열린다 (접힘은 잠금이 아니다) ---------------- */

test('잠기지 않은 앞 STEP 은 눌러서 열린다 — 접힘은 잠금이 아니다', () => {
  // 한 칸씩만 열리므로 「앞으로 올 STEP 전부」가 열리지는 않는다. 그래도 **잠기지 않은
  // 것**은 눌러서 열려야 한다 — 접힘 자체는 여전히 잠금이 아니다.
  const next = GROUPS[1].id;
  const panels = stepPanelStates(GROUPS, allFalse(), new Map([[next, true]]));
  assert.equal(panels[1].lockedBy, null, '바로 다음 STEP 이 잠겼습니다 — 한 칸은 열려야 합니다');
  assert.equal(panels[1].open, true, '잠기지 않은 STEP 을 열어 두었는데 안 열렸습니다');
  // 지금 STEP 은 그대로 열려 있다. 하나를 더 연다고 다른 것이 닫히지는 않는다.
  assert.equal(panels[0].open, true);
});

test('한 칸씩만 열린다 — 하나를 적었다고 나머지가 다 열리지 않는다', () => {
  // 앞서는 기록을 적는 순간 **나머지가 통째로 한꺼번에** 열렸다. 한 번에 한 STEP 이라고
  // 해 놓고 그러면 앞뒤가 안 맞는다.
  const done = allFalse();
  done[0] = true;
  /*
   * **갈리는 자리는 「지금 STEP 을 이미 적어 둔」 때다.**
   *
   * 먼저 적어 두는 것도 공부라 학생은 실험대에서 하기 전에 적을 수 있다. 그러면 지금
   * STEP 의 기록이 차 있는데 조작은 아직 안 끝난 상태가 된다.
   * 옛 규칙(`지금 기록이 비면 그 뒤를 잠근다`)은 이때 **아무것도 안 잠갔다** —
   * 여섯이 통째로 열렸다. 사장님이 보신 장면이 이것이다.
   */
  const unwritten = GROUPS.map((_, i) => i > 1);   // STEP 1·2 를 적어 두었다
  const panels = stepPanelStates(GROUPS, done, new Map(), lockOpts(unwritten));
  assert.equal(panels[1].lockedBy, null, 'STEP 2 가 안 열렸습니다');
  assert.equal(panels[2].lockedBy, null, '적어 둔 다음 한 칸이 안 열렸습니다');
  assert.equal(panels[3].state, 'locked',
    `한 칸보다 많이 열렸습니다: ${panels.map((p) => p.state).join(' ')}`);
  assert.equal(panels.filter((p) => p.state === 'locked').length, GROUPS.length - 3,
    `열린 칸 수가 맞지 않습니다: ${panels.map((p) => p.state).join(' ')}`);
});

test('잠글 때도 죽여 두는 속성을 쓰지 않는다', () => {
  // 잠긴 STEP 은 **아예 다른 껍데기**(`note-step--locked`)로 그린다.
  // `<details>` 를 죽여 두면 **열리는 척하다 안 열리고**, 그게 가장 나쁘다.
  //
  // **주석은 빼고 본다.** 「이것을 쓰지 마세요」라고 적어 둔 주석이 그 자리에서 빨간불을
  // 내면 다음 사람은 규칙을 적는 대신 낱말을 피해 다니게 된다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const stage4 = src.slice(src.indexOf('function renderStage4'), src.indexOf('function questionA'));
  const code = stage4.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(code.includes('note-step--locked'), '구간을 제대로 못 잘랐습니다');
  assert.equal(/disabled/.test(code), false,
    'renderStage4 에서 단추를 막고 있습니다 (AGENTS.md §2.1)');
  assert.equal(/pointer-events\s*:\s*none/.test(code), false,
    'renderStage4 에 pointer-events:none 이 있습니다');
});

/* ---------------- 잠금 — 세 조건을 다 지나야 한다 ---------------- */

const lockOpts = (unwritten, everOpened = []) => ({ unwritten, everOpened: new Set(everOpened) });

test('지금 STEP 의 관찰 기록이 비면 뒤 STEP 이 잠긴다', () => {
  // ① 뒤일 것 ② 지금 STEP 기록이 비었을 것 ③ 한 번도 안 열어 봤을 것
  const done = allFalse();
  done[0] = true;   // STEP 1 은 실험대에서 마쳤지만 아직 안 적었다
  const unwritten = GROUPS.map((_, i) => i === 0);
  const panels = stepPanelStates(GROUPS, done, new Map(), lockOpts(unwritten));
  // 실험대 일을 마쳤으므로 표시는 `done` 이지만, **적지 않았으니 여기가 아직 지금 자리다** —
  // 그래서 펼쳐진 채로 남는다. 아니면 아무것도 안 열린 벽이 된다.
  assert.equal(panels[0].open, true,
    '적지 않았는데 접혔습니다 — 적을 자리가 사라지고 뒤는 잠겨 아무것도 안 열린 화면이 됩니다');
  assert.equal(panels.filter((p) => p.open).length, 1, '펼쳐진 STEP 은 하나여야 합니다');
  assert.deepEqual(panels.slice(1).map((p) => p.state), GROUPS.slice(1).map(() => 'locked'));
  assert.equal(panels[1].lockedBy, GROUPS[0].id, '누가 막고 있는지를 들고 다녀야 합니다');
});

test('지금 STEP 을 적으면 **한 칸** 더 열린다', () => {
  const done = allFalse();
  done[0] = true;
  // 적기 전: 하나도 안 적었다. 적은 뒤: STEP 1 만 적었다.
  const before = stepPanelStates(GROUPS, done, new Map(), lockOpts(GROUPS.map(() => true)));
  const after = stepPanelStates(GROUPS, done, new Map(), lockOpts(GROUPS.map((_, i) => i !== 0)));
  const locked = (ps) => ps.filter((p) => p.state === 'locked').length;
  assert.equal(locked(after), locked(before) - 1,
    `적었는데 열린 칸이 하나가 아닙니다: ${locked(before)} → ${locked(after)}`);
  assert.equal(after[1].lockedBy, null, '바로 다음 STEP 이 안 열렸습니다');
});

test('한 번 열어 본 STEP 은 다시 잠기지 않는다', () => {
  // 미리 훑어본 STEP 이 뒤늦게 다시 잠기면 **열려 있던 것이 사라진 것**이고, 고장으로 읽힌다.
  // 순서를 건너뛴 학생은 열어 둔 곳에 계속 적을 수 있어야 한다.
  const done = allFalse();
  done[0] = true;
  const unwritten = GROUPS.map((_, i) => i === 0);
  const seen = [GROUPS[4].id];
  const panels = stepPanelStates(GROUPS, done, new Map(), lockOpts(unwritten, seen));
  assert.equal(panels[4].lockedBy, null,
    '한 번 열어 본 STEP 이 다시 잠겼습니다 — 학생 눈에는 열려 있던 것이 사라진 것입니다');
  assert.equal(panels[3].state, 'locked', '열어 본 적 없는 것은 그대로 잠겨 있어야 합니다');
});

test('지나온 STEP 과 지금 STEP 은 잠그지 않는다', () => {
  const done = allFalse();
  done[0] = true; done[1] = true;
  const unwritten = GROUPS.map((_, i) => i === 1);
  const panels = stepPanelStates(GROUPS, done, new Map(), lockOpts(unwritten));
  assert.equal(panels[0].lockedBy, null, '지나온 STEP 이 잠겼습니다 — 되돌아가 고칠 수 없습니다');
  assert.equal(panels[1].lockedBy, null, '지금 STEP 이 잠겼습니다');
  assert.equal(panels[2].state, 'locked');
});

/* ---------------- 손으로 연 것은 다시 그려도 그대로다 ---------------- */

test('손으로 연 것은 상태가 바뀌어 다시 그려도 그대로다', () => {
  const later = GROUPS[3].id;
  const manual = new Map([[later, true]]);
  // 실험대에서 STEP 1 을 끝내 노트가 다시 그려진 상황.
  // 손으로 열면 `everOpened` 에 담긴다 — 그것이 잠금 면제의 근거다.
  const seen = { everOpened: new Set([later]) };
  const before = stepPanelStates(GROUPS, allFalse(), manual, seen);
  const done = allFalse();
  done[0] = true;
  const after = stepPanelStates(GROUPS, done, manual, seen);
  assert.equal(before[3].open, true);
  assert.equal(after[3].open, true,
    '조작 한 번에 학생이 열어 둔 STEP 이 도로 접혔습니다 — 화면이 학생과 씨름합니다');
});

test('손으로 접은 것은 지금 STEP 이라도 접힌 채로 남는다', () => {
  const now = GROUPS[0].id;
  const panels = stepPanelStates(GROUPS, allFalse(), new Map([[now, false]]));
  assert.equal(panels[0].state, 'now', '상태는 여전히 「지금」이어야 합니다');
  assert.equal(panels[0].open, false,
    '학생이 접은 것을 다시 펼쳤습니다 — 손으로 한 것이 이겨야 합니다');
});

/**
 * **`toggle` 이 아니라 `summary` 의 `click` 을 들어야 한다.**
 *
 * `<details open>` 을 `innerHTML` 로 꽂으면 브라우저가 **삽입만으로 `toggle` 을 한 번
 * 쏜다.** `toggle` 을 들으면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로 연 것」으로
 * 기록되고, 그 STEP 이 끝난 뒤에도 **영영 안 접힌다.** 값으로는 안 잡히는 자리라
 * 원본을 읽어 못 박는다.
 */
test('여닫은 기록은 summary 의 click 으로만 남는다 — toggle 은 삽입만으로도 쏜다', () => {
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  assert.ok(/details\[data-step-group\] > summary/.test(src),
    'summary 를 직접 듣고 있지 않습니다');
  assert.equal(/addEventListener\('toggle'/.test(src), false,
    "toggle 을 듣고 있습니다 — <details open> 은 삽입만으로 toggle 을 쏘므로 "
    + '「지금 차례라서 펼쳐진 것」이 「손으로 연 것」으로 기록됩니다');
});

/* ---------------- 빈칸 수 = 기록칸 수 ---------------- */

/** 보고서에서 **탐구 과정 절만** 잘라 낸다. 다른 절의 빈칸까지 세면 뜻이 없다. */
function processSection(st) {
  const sheet = buildSheet(st, {});
  const from = sheet.indexOf(UI.report.sections.process);
  assert.ok(from >= 0, '보고서에 탐구 과정 절이 없습니다');
  const rest = sheet.slice(from);
  return rest.slice(0, rest.indexOf('</section>'));
}

const blanksIn = (html) => (html.match(new RegExp(UI.report.notWritten, 'g')) ?? []).length;

test('1·2단계 — 보고서 탐구 과정 절의 빈칸 수 = 탐구 노트의 기록칸 수', () => {
  // 기록칸을 열다섯에서 일곱으로 줄이면서 생기는 어긋남이다. 종이가 여전히 열다섯 칸을
  // 찍으면 **적을 칸을 준 적도 없는 여덟 칸**에 「적지 않았습니다」가 달린다 —
  // 선생님 눈에는 학생이 건너뛴 것으로 읽힌다.
  // (micrometer 가 이걸 놓쳐 열 칸을 그렇게 찍었다)
  const boxes = UI.protocol.reduce((n, g) => n + g.steps.filter((s) => s.note).length, 0);
  for (const level of [1, 2]) {
    const blanks = blanksIn(processSection(initialState(level)));
    assert.equal(blanks, boxes,
      `${level}단계 — 종이의 빈칸이 ${blanks}개인데 노트의 기록칸은 ${boxes}개입니다`);
  }
});

test('3단계 — 절차를 안 주므로 빈칸도 STEP 마다 하나다', () => {
  // 3단계 화면은 세부 단계를 안 보여 주고 STEP 마다 칸 하나(키가 '1'~'6')를 낸다.
  // 종이가 세부 단계 기준으로 찍으면 **학생이 적은 여섯 칸이 통째로 사라지고**
  // 그 자리에 준 적 없는 칸의 빈칸이 달린다 — 한 장에 두 가지 거짓말이 함께 난다.
  const blanks = blanksIn(processSection(initialState(3)));
  assert.equal(blanks, UI.protocol.length,
    `종이의 빈칸이 ${blanks}개인데 3단계 화면의 기록칸은 ${UI.protocol.length}개입니다`);
});

test('3단계에서 적은 것이 종이에 실린다', () => {
  // 빈칸 수만 맞추고 값을 안 실으면 수는 맞는데 글이 사라진다.
  let st = initialState(3);
  st = { ...st, session: { ...st.session, notes: { ...st.session.notes, 3: '센서를 같은 깊이로 맞췄다' } } };
  assert.ok(processSection(st).includes('센서를 같은 깊이로 맞췄다'),
    '3단계에서 적은 STEP 기록이 종이에 없습니다');
});

test('기록칸은 조작의 결과가 화면에 나타나는 자리에만 있다', () => {
  // 준비 동작(콩을 넣는다·센서를 꽂는다)은 상태이지 관찰 결과가 아니고, ✓ 가 이미 말한다.
  // 칸이 다시 늘어나면 빈칸이 줄줄이 남아 안 한 일처럼 읽히고, 학생은 적을 것이 없는
  // 칸을 채우느라 진짜 관찰을 대충 적는다.
  const total = UI.protocol.reduce((n, g) => n + g.steps.length, 0);
  const boxes = UI.protocol.reduce((n, g) => n + g.steps.filter((s) => s.note).length, 0);
  assert.ok(boxes < total,
    '모든 세부 단계에 기록칸이 있습니다 — 「조작의 결과가 나타나는 자리만」 이라는 기준이 사라졌습니다');
  assert.equal(boxes, 7, `기록칸이 ${boxes}개입니다 — 기준을 바꿨다면 이 수와 보고서를 함께 고치세요`);
  // STEP 마다 적어도 하나는 있어야 한다. 통째로 빈 STEP 이 생기면 그 STEP 은
  // 학생 입장에서 「할 일만 있고 남길 것은 없는」 자리가 된다.
  for (const g of UI.protocol) {
    assert.ok(g.steps.some((s) => s.note), `STEP ${g.id} 에 기록칸이 하나도 없습니다`);
  }
});

/* ---------------- 질문 ⓐ 는 묻는 조작과 같은 STEP 에 붙어 있어야 한다 ---------------- */

/**
 * 「방금 두 챔버를 나란히 보았습니다」라고 묻는 물음이 **아직 보지도 않은 STEP** 에
 * 붙어 있으면, STEP 이 한 번에 하나만 펼쳐지고부터는 **그 STEP 이 끝나는 순간 접혀
 * 사라진다.** 다 펼쳐져 있을 때는 스크롤하면 보여서 아무도 몰랐던 자리다.
 * (centrifuge 세션이 자기 저장소에서 찾아 알려 주었다)
 */
const scoop = (kind, chamber) => [['SCOOP_BEANS', { kind }], ['POUR_BEANS', { chamber }]];
const play = (script) => script.reduce(
  (st, [type, payload]) => reduce(st, { type, payload: payload ?? {} }).state, initialState(1, 4242));

/** 지켜보기 **직전**까지 — 콩·BTB·센서·밀봉·측정 시작. 아직 아무것도 안 봤다. */
const UPTO_WATCH = [
  ...scoop('sprout', 'L'), ...scoop('dry', 'R'),
  ['POUR_BTB', { chamber: 'L' }], ['POUR_BTB', { chamber: 'R' }],
  ['INSTALL_SENSOR', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'R' }],
  ['SEAL', { chamber: 'L' }], ['SEAL', { chamber: 'R' }],
  ['START', { chamber: 'L' }], ['START', { chamber: 'R' }],
];

test('질문 ⓐ 가 붙은 STEP 은 그 물음이 묻는 조작을 하기 전에는 끝나지 않는다', () => {
  const before = play(UPTO_WATCH);
  assert.equal(groupDone(before, QUESTION_A_STEP), false,
    `STEP ${QUESTION_A_STEP} 이 지켜보기도 전에 끝났습니다 — `
    + '「방금 두 챔버를 나란히 보았습니다」라고 묻는 물음이 접혀 사라집니다');

  const after = play([...UPTO_WATCH, ...Array.from({ length: OBSERVE_LIMIT_MIN }, () => ['TICK', { minutes: 1 }])]);
  assert.equal(groupDone(after, QUESTION_A_STEP), true,
    `끝까지 지켜봤는데도 STEP ${QUESTION_A_STEP} 이 안 끝났습니다`);
});

test('6단계 안내 문구가 질문 ⓐ 가 붙은 STEP 과 같은 번호를 말한다', () => {
  // 화면은 STEP 5 밑에서 묻는데 6단계가 「STEP 3 에서 쓴 답」이라고 하면,
  // 학생은 있지도 않은 자리를 찾아 되돌아간다.
  for (const key of ['qaCarried', 'qaNotYet']) {
    assert.ok(UI.notebook[key].includes(`STEP ${QUESTION_A_STEP}`),
      `UI.notebook.${key} 가 STEP ${QUESTION_A_STEP} 을 말하지 않습니다 — "${UI.notebook[key]}"`);
  }
});

test('질문 ⓐ 는 6단계에도 칸이 있다 — 접힌 STEP 안에만 있으면 보고서가 막힌다', () => {
  // 질문 ⓐ 의 답은 6단계 완료(=보고서)를 가른다. 4절 STEP 안에만 칸이 있으면
  // 그 STEP 이 접히는 순간 **답할 칸이 화면 어디에도 없는 채로 보고서만 막힌다.**
  // (fermentation 세션이 자기 저장소에서 그렇게 막혔다)
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const stage6 = src.slice(src.indexOf('function renderStage6'), src.indexOf('function renderStage7'));
  assert.ok(/data-note="q\.a"/.test(stage6),
    '6단계에 질문 ⓐ 칸이 없습니다 — 4절 STEP 이 접히면 답할 곳이 사라지는데 보고서는 그 답을 요구합니다');
});

/* ---------------- 「읽었습니다」 단추 ---------------- */

test('예상 쪽은 읽는 쪽 목록 안에 있다 — 아니면 막는 코드가 영영 안 돈다', () => {
  assert.ok(UI.bench.lock.required.includes(PREDICT_STAGE),
    `예상 쪽 ${PREDICT_STAGE} 이 읽는 쪽 목록에 없습니다 — 그 쪽에는 「읽었습니다」 단추가 `
    + '아예 안 나오므로 예상을 안 썼는지 보는 코드가 한 번도 안 돕니다');
});

test('「읽었습니다」 는 자리로 다음 쪽을 고른다 — 읽음 여부로 고르지 않는다', () => {
  // 「아직 안 읽은 쪽」 으로 고르면 차례대로 읽는 동안에는 늘 맞다. **4쪽을 먼저 읽어 둔
  // 학생이 3쪽에서 누를 때만** 거꾸로 끌려간다 — 차례대로만 재면 절대 안 나타난다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  // **구간을 잘못 자르면 검사가 조용히 헛돈다.** 첫 `});` 로 끊으면 그 앞의
  // `dispatch('MARK_READ', { stage: from });` 에서 잘려 정작 볼 줄이 안 들어온다.
  // 핸들러가 닫히는 들여쓰기(`\n    });`)까지 가져온다.
  const handler = src.slice(src.indexOf("querySelector('#mark-read')"));
  const body = handler.slice(0, handler.indexOf('\n    });'));
  assert.ok(body.includes('MARK_READ') && body.includes('activeStage'),
    '핸들러 본문을 제대로 못 잘랐습니다 — 이 검사는 아무것도 안 보고 있습니다');
  assert.ok(/required\.indexOf\(from\) \+ 1/.test(body),
    '다음 쪽을 자리(indexOf + 1)로 고르고 있지 않습니다');
  assert.ok(!/readStages/.test(body),
    '다음 쪽을 읽음 여부로 고르고 있습니다 — 먼저 읽어 둔 쪽이 있으면 거꾸로 끌려갑니다');
});

test('단추를 죽이지 않고 aria-disabled 로 알린다 — 이유를 들을 길을 남긴다', () => {
  // `disabled` 는 단추에서 포커스를 빼앗는다. 키보드·낭독기로 오는 학생은 그 단추에
  // 닿을 수조차 없어, **왜 못 누르는지를 들을 길이 사라진다.**
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  // `readFooter` 는 `bindPanel` **뒤에** 있다. 순서를 거꾸로 짚으면 빈 문자열이 나오고,
  // 빈 문자열에는 아무것도 없으므로 **검사가 조용히 통과한다.**
  const from = src.indexOf('function readFooter');
  const foot = src.slice(from, src.indexOf('\n  }', from));
  assert.ok(foot.includes('mark-read'), 'readFooter 구간을 제대로 못 잘랐습니다');
  assert.ok(/aria-disabled/.test(foot), 'aria-disabled 로 알리고 있지 않습니다');
  assert.ok(/aria-describedby/.test(foot),
    '이유 문단을 aria-describedby 로 묶지 않았습니다 — 눈으로 보는 사람에게만 이유가 있습니다');
  // **누르는 쪽은 DOM 표시가 아니라 지금 상태를 봐야 한다.** 마지막 칸에 적고 곧장
  // 누르면 단추에는 적기 전의 표시가 그대로 붙어 있어, 그것을 믿으면 **방금 조건을
  // 채운 누름을 삼킨다.** 학생 눈에는 고장 난 단추다.
  const handler = src.slice(src.indexOf("querySelector('#mark-read')"));
  const body = handler.slice(0, handler.indexOf('\n    });'));
  assert.ok(/!predictDone\(/.test(body),
    '누르는 쪽에서 안 막고 있습니다 — 표시만 하고 안 막으면 표시가 거짓말이 됩니다');
  assert.ok(!/getAttribute\('aria-disabled'\)/.test(body),
    '누르는 쪽이 DOM 표시를 믿고 있습니다 — 그 표시는 낡아 있을 수 있습니다');
});

/**
 * **손이 글칸에 있는 동안 다시 그리지 않는가 — 그 가드가 아직 있는가.**
 *
 * 재는 동안 상태가 바뀌면 노트가 다시 그려지고, 치던 `textarea` 가 교체되면서
 * **포커스가 `<body>` 로 떨어진다.** 그 뒤에 친 글자는 아무 데도 안 들어간다.
 *
 * ★ **이 고침은 실제로 한 번 사라진 적이 있다.** 되돌림을 커밋 전에 돌리고
 *   `git checkout` 으로 복원하다 날아갔고, **`npm run check` 는 그때도 초록불이었다.**
 *   검사는 자기가 사라진 것을 스스로 알리지 못한다. (chromatography 가 자기 커밋
 *   둘이 비어 있는 것을 찾아 허브가 여덟에 돌렸다)
 *
 * 뜻이 맞는지 재는 것은 브라우저 검사다 — `node scripts/check-bench.mjs` 의
 * 「재는 동안 적은 글이 남는가」. 가드를 무력화하고 재 보면 **28자 중 10자**만 남는다.
 * 여기 있는 것은 그보다 얇다. **지워졌을 때 커밋 문턱에서 말해 주는 것**이 일이다 —
 * 실제로 일어난 사고가 「뜻이 틀어짐」이 아니라 「통째로 없어짐」이었다.
 */
test('적는 동안 다시 그리기를 미루는 가드가 render 앞에 있다', () => {
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');

  // [앞 조건] 가드가 무엇을 보는지 정의한 자리를 찾는다.
  assert.match(src, /const isTyping = \(\) => \{/,
    'isTyping 정의를 못 찾았습니다 — 이름이 바뀌었다면 이 검사와 scripts/check-bench.mjs 를 함께 보세요');
  assert.match(src, /activeElement/,
    'isTyping 이 지금 어디에 포커스가 있는지를 안 봅니다 — 이름만 남은 껍데기입니다');

  // 미루는 자리와 따라잡는 자리, 둘 다 있어야 글이 남는다.
  const defer = src.match(/if \(isTyping\(\)[^)]*\) \{/);
  assert.ok(defer, [
    '다시 그리기를 미루는 가드가 없습니다 — 적는 도중 칸이 교체되어 글자가 사라집니다.',
    '  ★ 일부러 걷어낸 것이 아니라면 되돌리세요. 실제로 한 번 사라진 적이 있습니다.',
    '  뜻까지 재려면: node scripts/check-bench.mjs — 「재는 동안 적은 글이 남는다」',
  ].join('\n'));
  assert.match(src, /renderPending && !isTyping\(\)/,
    '손을 뗀 뒤 밀어 둔 다시 그리기를 따라잡는 자리가 없습니다 — 화면이 옛 상태로 남습니다');
});
