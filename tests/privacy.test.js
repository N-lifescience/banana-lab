/**
 * 개인정보처리방침이 **실제로 보내는 것과 같은 말을 하는가.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 복제해서 만든 실험 셋이 전부 같은 자리를 밟았다. 제2조가 바나나랩 문장을 그대로
 * 물려받아 「수치(시드·배율·초점 등)」 라고 적고 있었는데, 현미경을 안 쓰는 실험은
 * **보내지도 않는 값을 받는다고 고지**하고 있었다.
 *
 * 그러다 catalase 세션이 반대쪽을 찾았다 — **적혀 있지 않은데 나가는 것**이 있었다.
 * `session.log`(학생이 무엇을 어떤 차례로 눌렀는지)와 `session.violations`(지금은 없앤, 안전 수칙을
 * 지켰는지)가 그것이다. 이 저장소도 같았다.
 *
 * **양쪽 다 틀린 고지다** — 안 받는 것을 받는다고 적은 것도, 받는 것을 안 적은 것도.
 *
 * 문장은 기계가 못 읽으므로 **키를 맞춘다.** `privacy.html` 의 `<dl>` 안 `<dt>` 에
 * `data-sends` 로 그 항목이 담는 키를 적어 두고, 여기서 `payloadOf()` 가 실제로 내는
 * 키와 양방향으로 비교한다. 상태를 하나 늘리면 이 검사가 먼저 빨간불이 된다.
 *
 * 복제해서 새 실험을 만들 때는 `OTHER_WORDS` 만 그 실험에 **없는** 낱말로 갈아 끼운다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { payloadOf } from '../src/ui/report.js';

const html = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

/** 이 실험에 **없는** 말. 다른 실험 방침이 흘러 들어왔는지 본다. */
const OTHER_WORDS = ['원형질', '적양파', '카탈레이스', '과산화수소', '크로마토그래피',
  '엽록소', '효모', '발효', '맹관부', '원심분리', '적혈구', '접안 마이크로미터'];

/** 실제로 나가는 키를 `a.b` 꼴로 편다. 두 겹까지만 본다 — 방침이 그 깊이로 적혀 있다. */
function sentKeys() {
  const p = payloadOf(initialState(1), { school: '', team: '' }, 'individual');
  const out = new Set();
  for (const [k, v] of Object.entries(p)) {
    if (k === 'state') continue;
    out.add(k);
  }
  for (const [k, v] of Object.entries(p.state)) {
    if (k !== 'session') { out.add(k); continue; }
    for (const sub of Object.keys(v)) out.add(`session.${sub}`);
  }
  return out;
}

/** 방침이 받는다고 적어 둔 키. */
function declaredKeys() {
  const out = new Set();
  for (const [, list] of html.matchAll(/<dt[^>]+data-sends="([^"]+)"/g)) {
    for (const k of list.split(',')) out.add(k.trim());
  }
  return out;
}

test('방침에 적힌 항목이 실제로 보내는 것과 정확히 같다', () => {
  const sent = sentKeys();
  const said = declaredKeys();
  assert.ok(said.size > 0, 'privacy.html 에 data-sends 가 하나도 없습니다');

  // 방침이 다루지 않는 전달 봉투. 값이 아니라 그릇이라 고지 대상이 아니다.
  const envelope = new Set(['kind', 'app']);

  const undeclared = [...sent].filter((k) => !said.has(k) && !envelope.has(k));
  assert.deepEqual(undeclared, [],
    `방침에 안 적힌 것을 보내고 있습니다: ${undeclared.join(', ')}\n`
    + '  → privacy.html 제2조를 고치세요. **받는 것을 안 적은 것도 틀린 고지입니다.**');

  const notSent = [...said].filter((k) => !sent.has(k)
    && !['student_no', 'student_name', 'submitted_at'].includes(k));
  assert.deepEqual(notSent, [],
    `보내지도 않는 것을 방침이 받는다고 적고 있습니다: ${notSent.join(', ')}`);
});

test('되돌리기 기록은 보내지 않는다', () => {
  // history 는 이전 상태를 통째로 쌓아 둔 것이라, 그대로 보내면
  // **학생이 지운 글까지 따라간다.** 방침도 그렇게 약속하고 있다.
  const p = payloadOf(initialState(1), { school: '', team: '' }, 'individual');
  assert.equal(p.state.session.history, undefined,
    '되돌리기 기록이 제출 자료에 들어 있습니다 — 학생이 지운 글이 따라갑니다');
  // 낱말이 아니라 **약속**을 확인한다. `<code>history</code>` 가 적혀 있는지 보면
  // 문장을 한국어로 다듬는 순간 헛발질한다 — 실제로 그랬다.
  // 「전송하지 않습니다」 로 여는 목록 안에 「되돌리기 기록」 이 있으면 약속한 것이다.
  const notSentBlock = html.slice(html.indexOf('전송하지 않습니다'));
  assert.ok(notSentBlock.includes('되돌리기 기록'),
    '방침이 되돌리기 기록을 보내지 않는다고 말하지 않습니다');
  assert.ok(notSentBlock.includes('조작 기록'),
    '방침이 조작 기록을 보내지 않는다고 말하지 않습니다');
});

test('개인정보처리방침에 다른 실험의 말이 없다', () => {
  const bad = OTHER_WORDS.filter((w) => html.includes(w));
  assert.deepEqual(bad, [], `다른 실험의 말이 남아 있습니다: ${bad.join(', ')}`);
});
