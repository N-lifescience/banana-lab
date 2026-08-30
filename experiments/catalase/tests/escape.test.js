/**
 * 정화 함수 검사 — **`innerHTML` 을 쓰는 앱의 근거 파일이다.**
 *
 * 이 저장소는 화면을 `innerHTML` 로 그린다(열 개 남짓 파일에서). 그러면
 * **학생이 쓴 글이 마크업으로 읽힐 자리**가 생긴다. `dorms-ready.md` 는 그럴 때
 * 「정화 함수 **+ 그 함수에 대한 테스트**까지 있어야 근거가 된다」고 못 박아 뒀고,
 * `CLAUDE.md` 도 가장 자주 놓치는 것으로 같은 문장을 적어 뒀다.
 *
 * **함수는 있었는데 이 파일이 없었다.** 그래서 「정화한다」가 코드에 적힌 주장일 뿐
 * 지켜지는 약속은 아니었다 — 누가 `escapeHtml` 을 빼거나 한 글자를 빠뜨려도
 * 아무 검사도 빨간불이 나지 않았다.
 *
 * 두 층으로 잰다:
 *   ① 함수 자체가 다섯 글자를 다 막는가
 *   ② **학생 글이 실제로 그 함수를 지나 종이에 나가는가** — ①만으로는 함수가
 *      호출되지 않는 자리를 못 본다. 어제 「잘된 조작이 아무 말도 못 한다」가 그 모양이었다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/ui/notebook.js';
import { buildSheet } from '../src/ui/report.js';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';

/* ---------------- ① 함수 자체 ---------------- */

test('정화 함수가 마크업이 될 다섯 글자를 다 막는다', () => {
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('&'), '&amp;');
  // **따옴표 둘까지 막아야 한다.** 학생 글은 본문뿐 아니라 속성 안에도 들어간다.
  // `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가 새 속성을 붙일 수 있다.
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('정화 함수가 & 를 먼저 막아 두 번 새지 않는다', () => {
  // `&lt;` 를 넣었을 때 `&` 를 나중에 막으면 `&amp;lt;` 가 아니라 `&lt;` 로 남아
  // 원래 글자가 아니라 **꺾쇠로 되살아난다.**
  assert.equal(escapeHtml('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
});

test('정화 함수가 문자열이 아닌 것도 받아 넘긴다', () => {
  // 안 쓴 칸은 `undefined` 로 온다. 거기서 터지면 종이가 통째로 안 나온다.
  assert.equal(escapeHtml(undefined), 'undefined');
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(42), '42');
});

/* ---------------- ② 실제로 그 길을 지나는가 ---------------- */

/**
 * **함수가 있는 것과 학생 글이 그 함수를 지나는 것은 다른 말이다.**
 *
 * 위 검사는 `escapeHtml('<')` 이 잘 도는지만 본다. 종이를 만드는 쪽이 그 함수를
 * 안 부르면 위는 전부 초록불인 채로 마크업이 그대로 나간다.
 * 그래서 **학생이 쓴 것처럼 넣고, 나온 종이에서 찾는다.**
 */
const NASTY = '<img src=x onerror="alert(1)"> \'따옴표\' & "큰따옴표"';

function sheetWithNote(step) {
  let st = initialState(1);
  st = reduce(st, { type: 'SAVE_NOTE', payload: { step, text: NASTY } }).state;
  return buildSheet(st, { school: '가나고', team: '1모둠' }, 'solo');
}

test('학생이 쓴 글이 종이에 마크업으로 나가지 않는다', () => {
  for (const step of ['predict', '1a', 'reflect.off']) {
    const html = sheetWithNote(step);
    assert.equal(html.includes('<img src=x'), false,
      `${step} 칸의 글이 태그로 나갑니다 — 정화를 안 거쳤습니다`);
    assert.ok(html.includes('&lt;img src=x'),
      `${step} 칸의 글이 종이에 실리지 않았습니다 — 검사가 아무것도 못 봤습니다`);
    assert.equal(html.includes('onerror="alert(1)"'), false,
      `${step} 칸에서 속성이 살아 나갑니다`);
  }
});

test('학교·모둠 이름도 정화를 거친다 — 그 칸도 사람이 친다', () => {
  const st = initialState(1);

  // **모둠 이름은 모둠 활동지에만 실린다** (`UI.report.groupFields`).
  // 처음에 solo 로 물었다가 「따옴표가 안 막혔다」로 빨간불이 났는데,
  // 안 막힌 게 아니라 **그 칸이 종이에 아예 없었다.** 없는 것을 두고 샌다고 읽을 뻔했다.
  const group = buildSheet(st, { school: '<b>가나고</b>', team: '"1모둠"' }, 'group');
  assert.ok(group.includes('&quot;1모둠&quot;'), '모둠 이름의 따옴표가 안 막혔습니다');

  for (const kind of ['solo', 'group']) {
    const html = buildSheet(st, { school: '<b>가나고</b>', team: '"1모둠"' }, kind);
    assert.equal(html.includes('<b>가나고</b>'), false, `${kind}: 학교 이름이 태그로 나갑니다`);
    assert.ok(html.includes('&lt;b&gt;가나고'), `${kind}: 학교 이름이 종이에 실리지 않았습니다`);
  }
});
