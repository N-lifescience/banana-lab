/**
 * 학생이 적은 글이 **종이로 갈 때 정화를 지나는가.**
 *
 * ── 왜 이 검사가 없으면 안 되는가 ────────────────────────────────
 * `Projects/CLAUDE.md`:
 *   「`innerHTML` 을 쓸 거면 정화 함수 + **그 함수에 대한 테스트**까지 있어야 근거가 된다」
 *
 * 이 저장소는 활동지를 `innerHTML` 로 꽂는다 (`report.js` 의 `sheet.innerHTML = buildSheet(…)`).
 * 그 안에 들어가는 것 중 **학생이 직접 친 글**이 있다 — 관찰 기록·예상·토의·이름·모둠.
 * 정화 함수(`escapeHtml`)는 있었는데 **그 함수에 대한 테스트가 하나도 없었다**
 * (`grep -rl escapeHtml tests/` 가 비어 있었다). 함수가 있다는 것만으로는 근거가 아니다 —
 * 다음 사람이 `or()` 대신 값을 그대로 꽂아도 아무 데서도 빨간불이 안 뜬다.
 *
 * ── 두 층으로 잰다 ──────────────────────────────────────────────
 *   ① 함수 자체가 위험한 글자를 없애는가
 *   ② 학생 글이 **실제로 그 함수를 지나** 종이에 나가는가
 *
 * ①만 있으면 함수는 멀쩡한데 아무도 안 부르는 상태를 통과시킨다.
 * ②만 있으면 어디가 새는지 못 짚는다. 둘 다 있어야 반쪽이 아니다.
 *
 * ★ **낱말을 재지 않는다.**
 *   `onerror=` 라는 **글자**가 없는지 재면 안 된다 — 정화를 지나도 그 글자는 남는다
 *   (`&lt;img src=x onerror=1&gt;`). 그건 화면에 **글자로** 찍힐 뿐 아무 일도 안 한다.
 *   그렇게 재면 멀쩡한 코드에 빨간불이 뜨고, 다음 사람은 검사를 지운다.
 *   살아 있다는 것의 정의는 **태그 안에 있는가** 하나다 — `liveThreats()` 를 보라.
 *   (허브를 거쳐 넘어온 지적. 그러고도 나는 같은 함정에 한 번 빠졌다 — 「살아 있는 속성」을
 *    `\son[a-z]+=` 로 셌더니 정화를 제대로 지난 `&lt;svg onload=…&gt;` 가 걸렸다)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/ui/notebook.js';
import { buildSheet } from '../src/ui/report.js';
import { initialState } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

/** 학생이 칠 수 있는 공격 문자열들. 마지막 조각은 **표시로 남을 글자**다. */
const PAYLOADS = [
  '<img src=x onerror="alert(1)"> 표시aaa',
  '<script>alert(2)</script> 표시bbb',
  '"><svg onload=alert(3)> 표시ccc',
  "'><iframe src=javascript:alert(4)> 표시ddd",
];

/**
 * **살아 있는** 태그와 속성만 센다.
 *
 * ★ **낱말로 세면 안 된다.** 처음에 `\son[a-z]+=` 로 셌다가 바로 헛빨간불을 받았다 —
 *   `&lt;svg onload=alert(3)&gt;` 는 정화를 **제대로 지난** 결과인데, `onload=` 라는
 *   글자는 그대로 남아 있어서 걸렸다. 그 글자는 화면에 **글자로** 찍힐 뿐 아무 일도
 *   안 한다. 그렇게 재면 멀쩡한 코드가 빨간불이 되고 다음 사람은 검사를 지운다.
 *
 * 살아 있다는 것의 정의는 하나다 — **태그 안에 있는가.** `<` 가 `&lt;` 로 바뀌면
 * 태그가 아예 열리지 않으므로 그 뒤는 무엇이 적혀 있든 글자다. 그래서 **진짜 태그를
 * 먼저 잘라 내고, 그 안에서만** 위험한 것을 찾는다.
 */
function liveThreats(html) {
  const tags = html.match(/<[a-zA-Z][^>]*>/g) ?? [];
  const bad = [];
  for (const tag of tags) {
    const name = (tag.match(/^<\s*([a-zA-Z][a-zA-Z0-9]*)/) ?? [])[1] ?? '';
    if (/^(script|img|svg|iframe|object|embed|form|input)$/i.test(name)) bad.push(tag.slice(0, 40));
    if (/\son[a-z]+\s*=/i.test(tag)) bad.push(tag.slice(0, 40));            // 태그 **안**의 이벤트 속성
    if (/(href|src)\s*=\s*["']?\s*javascript:/i.test(tag)) bad.push(tag.slice(0, 40));
  }
  return bad;
}

/* ────────────────────────── ① 함수 자체 ────────────────────────── */

test('정화 함수가 위험한 글자를 없앤다', () => {
  for (const p of PAYLOADS) {
    const out = escapeHtml(p);
    assert.deepEqual(liveThreats(out), [],
      `정화했는데 살아 있는 것이 남았습니다: ${JSON.stringify(out)}`);
    // 꺾쇠·따옴표가 **한 글자도** 남으면 안 된다. 남으면 어딘가에서 태그가 열린다.
    assert.equal(/[<>"']/.test(out), false,
      `정화한 뒤에도 꺾쇠나 따옴표가 남았습니다: ${JSON.stringify(out)}`);
  }
});

test('정화가 학생 글을 삼키지는 않는다', () => {
  /**
   * ★ **없애기만 하면 통과하는 검사는 검사가 아니다.**
   *   빈 문자열을 돌려주는 함수는 위의 검사를 전부 통과한다. 그런데 그러면
   *   학생이 적은 것이 종이에서 사라진다 — 정화가 아니라 **삭제**다.
   */
  assert.equal(escapeHtml('물이 20 µm 라고 봤다'), '물이 20 µm 라고 봤다');
  assert.ok(escapeHtml('<b>굵게</b>').includes('굵게'), '글자 내용은 남아야 합니다');
});

/* ─────────────── ② 학생 글이 실제로 그 길을 지나는가 ─────────────── */

/** 학생이 적을 수 있는 칸을 되도록 다 채운다 — 한 곳만 새도 종이가 뚫린다. */
function stateWithPayloads(level, payload) {
  const st = initialState(level);
  const notes = {};
  for (const g of UI.protocol) {
    notes[g.id] = payload;                                   // 3단계 — STEP 하나에 칸 하나
    g.steps.forEach((s, i) => {                              // 1·2단계 — 세부 단계마다
      if (s.note) notes[`${g.id}${String.fromCharCode(97 + i)}`] = payload;
    });
  }
  for (const { key } of UI.notebook.predictItems) {
    notes[`predict.${key}`] = payload;
    notes[`predict.why.${key}`] = payload;
  }
  notes['q.a'] = payload;
  return { ...st, session: { ...st.session, notes } };
}

test('학생이 적은 글은 종이에서 살아 있는 태그가 되지 않는다', () => {
  const who = Object.fromEntries(
    [...UI.report.fields, ...UI.report.groupFields].map((f) => [f.key, PAYLOADS[0]]));

  for (const level of [1, 2, 3]) {
    for (const kind of ['solo', 'group']) {
      for (const payload of PAYLOADS) {
        const html = buildSheet(stateWithPayloads(level, payload), who, kind);
        const live = liveThreats(html);

        /**
         * 우리가 쓴 문구에도 태그는 있다 (`<b>`·`<section>`…). 그건 우리 글이라 막을 것이
         * 없다. 그래서 **위험한 태그 이름과 살아 있는 이벤트 속성**만 세었다 — 그 목록에
         * 우리 문구가 걸릴 일은 없다. 걸리면 그건 진짜로 학생 글이 샌 것이다.
         */
        assert.deepEqual(live, [],
          `${level}단계 ${kind} — 학생 글이 정화를 안 지나 종이에서 살아났습니다:`
          + ` ${live.slice(0, 3).join(' / ')}`);
      }
    }
  }
});

test('그러면서도 학생이 적은 것은 종이에 실린다', () => {
  /**
   * ★ **앞 검사만 두면 「학생 글을 통째로 안 싣는」 코드가 통과한다.**
   *   그건 안전하지만 종이가 백지다. 정화의 목적은 **싣되 죽여서 싣는 것**이지
   *   안 싣는 것이 아니다. 그래서 표시 글자가 종이에 있는지 함께 본다.
   */
  const who = Object.fromEntries(
    [...UI.report.fields, ...UI.report.groupFields].map((f) => [f.key, PAYLOADS[0]]));
  const html = buildSheet(stateWithPayloads(1, PAYLOADS[0]), who, 'group');
  assert.ok(html.includes('표시aaa'),
    '학생이 적은 글이 종이에 한 자도 안 실렸습니다 — 정화가 아니라 삭제입니다');
  // 꺾쇠는 실체가 아니라 **글자**로 실려야 한다.
  assert.ok(html.includes('&lt;img'),
    '학생이 친 꺾쇠가 글자(&lt;)로 실리지 않았습니다');
});
