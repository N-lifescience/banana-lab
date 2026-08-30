/**
 * 개인정보처리방침에 적은 것과 **실제로 보내는 것**이 같은가.
 *
 * ── 왜 뒤늦게 생겼는가 ─────────────────────────────────────────────
 * 이 실험에는 **이 검사만 없었다.** 조 번호가 이어지는지는 봤고
 * (`privacy.crossref.test.js`), 방침에 요구되는 표제가 있는지도 다른 실험이 봤는데,
 * **꾸러미에 실제로 무엇이 담기는지를 방침과 맞대는 검사가 없었다.**
 *
 * 그 사이 `payloadOf()` 가 `{ ...st, session }` — 되돌리기 기록 하나만 빼고
 * **상태를 통째로** 담고 있었다. 방침이 「기기 안에만 있고 전송하지 않습니다」로
 * 못박아 둔 것들(조작 기록 · 남은 되돌리기 횟수 · 읽은 쪽 · 기구의 마지막 상태)이
 * 전부 그 안에 있었다. **학생이 읽는 고지가 이 실험에 대해 거짓이었다.**
 *
 * 방침은 사이트에 하나뿐인 문서라 banana 것을 그대로 물려받았는데, 꾸러미를 만드는
 * 자리는 실험마다 따로였다 — **문서 하나에 구현 여덟이 매달린 모양**이다.
 * 그래서 이 검사는 실험마다 있어야 한다.
 * (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 *
 * ── 어떻게 보는가 ──────────────────────────────────────────────────
 * 문장은 기계가 못 읽으므로 **키를 맞춘다.** `privacy.html` 의 `<dt>` 에
 * `data-sends` 로 그 항목이 담는 키를 적어 두고, `payloadOf()` 가 실제로 내는
 * 키와 맞댄다. 상태에 값을 하나 늘리면 이 검사가 먼저 빨간불이 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { payloadOf, SUBMIT_SESSION_KEYS, SUBMIT_TOP_KEYS } from '../src/ui/report.js';

/** 방침은 **사이트 것**이라 뿌리에 있다. 실험이 여덟이어도 문서는 하나다. */
const PRIVACY = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

/** 실제로 나가는 키를 `a.b` 꼴로 편다. 두 겹까지만 본다 — 방침이 그 깊이로 적혀 있다. */
function sentKeys() {
  const p = payloadOf(initialState(1, 1), { school: '', team: '' }, 'individual');
  const out = new Set();
  for (const k of Object.keys(p)) {
    if (k !== 'state') out.add(k);
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
  for (const [, list] of PRIVACY.matchAll(/<dt[^>]+data-sends="([^"]+)"/g)) {
    for (const k of list.split(',')) out.add(k.trim());
  }
  return out;
}

test('방침에 안 적힌 것을 보내지 않는다', () => {
  const said = declaredKeys();
  // 앞 조건 — `data-sends` 가 하나도 없으면 아래가 **아무것도 안 재고 통과**한다.
  assert.ok(said.size > 0, 'privacy.html 에 data-sends 가 하나도 없습니다');

  /*
   * 방침이 다루지 않는 **전달 봉투.** 값이 아니라 그릇이라 고지 대상이 아니다 —
   * `kind` 는 개인/모둠 활동지 중 어느 종이를 그릴지, `app` 은 어느 실험의 종이인지다.
   */
  const envelope = new Set(['kind', 'app']);
  const undeclared = [...sentKeys()].filter((k) => !said.has(k) && !envelope.has(k));
  assert.deepEqual(undeclared, [],
    `방침에 안 적힌 것을 보내고 있습니다: ${undeclared.join(', ')}\n`
    + '  → privacy.html 제2조를 고치세요. **받는 것을 안 적은 것도 틀린 고지입니다.**\n'
    + '    (반대 방향은 사이트가 봅니다 — tests/site.test.js)');
});

/*
 * **「뺄 것을 뺀다」로 돌아가는 것을 막는다.**
 *
 * 위 검사만 있으면 `payloadOf()` 를 `{ ...st, session }` 으로 되돌려 놓고 방침에
 * 줄을 몇 개 늘려도 초록불이 난다. 그런데 이 자리에서 실제로 났던 사고는
 * **새 상태값이 생길 때마다 고지 없이 따라 나가는 것**이었다.
 * 목록으로 담는 모양 자체를 붙들어 둔다.
 */
test('꾸러미는 뺄 것을 빼는 게 아니라 보낼 것만 담는다', () => {
  const src = readFileSync(new URL('../src/ui/report.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function payloadOf'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(body.includes('SUBMIT_SESSION_KEYS'),
    'payloadOf() 가 SUBMIT_SESSION_KEYS 를 안 씁니다 — 허용 목록으로 담으세요');
  assert.ok(!/\.\.\.st\b/.test(body),
    'payloadOf() 가 상태를 통째로 펴 담고 있습니다 (`...st`).\n'
    + '  → 뺄 것을 빼는 방식은 값이 늘 때마다 조용히 샙니다. 보낼 키만 적으세요.');

  // 목록이 비어 있으면 위 「안 적힌 것을 보내지 않는다」가 저절로 통과한다.
  assert.ok(SUBMIT_SESSION_KEYS.length > 0, 'SUBMIT_SESSION_KEYS 가 비어 있습니다');
  assert.ok(Array.isArray(SUBMIT_TOP_KEYS), 'SUBMIT_TOP_KEYS 가 배열이 아닙니다');
});

/*
 * **종이에 실리는데 안 보내는 것이 있으면 선생님 화면이 빈칸을 그린다.**
 * 위 둘은 「많이 보내는 것」만 잡는다. 모자란 쪽은 이 검사가 잡는다 —
 * 보고서가 읽는 `st.session.<칸>` 이 전부 보낼 목록에 있어야 한다.
 */
test('종이가 읽는 session 칸은 전부 보낸다', () => {
  const src = readFileSync(new URL('../src/ui/report.js', import.meta.url), 'utf8');
  const sheet = src.slice(0, src.indexOf('export function payloadOf'));
  const read = new Set([...sheet.matchAll(/st\.session\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map((m) => m[1]));
  assert.ok(read.size > 0, '보고서가 읽는 session 칸을 하나도 못 찾았습니다 — 검사가 헛돌고 있습니다');
  const missing = [...read].filter((k) => !SUBMIT_SESSION_KEYS.includes(k) && k !== 'mode');
  assert.deepEqual(missing, [],
    `종이가 읽는데 안 보내는 칸이 있습니다: ${missing.join(', ')}\n`
    + '  → 선생님 화면이 그 자리를 빈칸으로 그립니다. SUBMIT_SESSION_KEYS 에 넣으세요.');
});
