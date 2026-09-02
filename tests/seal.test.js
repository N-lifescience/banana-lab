/**
 * 봉인의 **선**을 지킨다 (`packages/lab-kit/net/seal.js`).
 *
 *   · 선생님 열쇠로만 열린다 — 다른 열쇠, 손댄 봉투는 열리지 않고 **던진다**
 *   · 봉투 자체에는 원문이 한 글자도 없다 — 사이트 주인이 대시보드에서 봐도 못 읽는다
 *   · 열쇠(`secret`)는 서버로 가는 값(`pub`, 봉투)에 들어 있지 않다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateTeacherKeys, seal, open, isSealed, toB64u, fromB64u } from '../packages/lab-kit/net/seal.js';

const report = {
  studentNo: '2417', studentName: '홍길동', mode: 'group', level: 2,
  payload: { state: { session: { notes: { q2: '녹말은 청람색' } } }, seed: 42 },
};

test('선생님 열쇠로 잠근 것을 그 열쇠로 연다', async () => {
  const t = await generateTeacherKeys();
  const env = await seal(t.pub, report);
  assert.ok(isSealed(env));
  assert.deepEqual(await open(t.secret, t.pub, env), report);
});

test('봉투에는 원문이 한 글자도 없다 — 주인이 봐도 못 읽는다', async () => {
  const t = await generateTeacherKeys();
  const env = await seal(t.pub, report);
  const flat = JSON.stringify(env);
  for (const word of ['홍길동', '2417', '청람색', 'studentName', 'payload']) {
    assert.equal(flat.includes(word), false, `봉투에 "${word}" 가 그대로 보입니다`);
  }
});

test('다른 선생님의 열쇠로는 열리지 않는다 — 던진다', async () => {
  const a = await generateTeacherKeys();
  const b = await generateTeacherKeys();
  const env = await seal(a.pub, report);
  await assert.rejects(() => open(b.secret, b.pub, env));
  await assert.rejects(() => open(b.secret, a.pub, env));
});

test('손댄 봉투는 열리지 않는다', async () => {
  const t = await generateTeacherKeys();
  const env = await seal(t.pub, report);
  const ct = fromB64u(env.ct);
  ct[ct.length - 1] ^= 1;
  await assert.rejects(() => open(t.secret, t.pub, { ...env, ct: toB64u(ct) }));
  await assert.rejects(() => open(t.secret, t.pub, { ...env, v: 99 }));
});

test('같은 것을 두 번 잠가도 봉투가 다르다 (일회용 키·iv)', async () => {
  const t = await generateTeacherKeys();
  const [a, b] = await Promise.all([seal(t.pub, report), seal(t.pub, report)]);
  assert.notEqual(a.ct, b.ct);
  assert.notEqual(a.epk, b.epk);
});

test('열쇠는 서버로 가는 값에 들어 있지 않다', async () => {
  const t = await generateTeacherKeys();
  const env = await seal(t.pub, report);
  assert.equal(t.pub.includes(t.secret), false);
  assert.equal(JSON.stringify(env).includes(t.secret), false);
  // 열쇠는 링크의 `#` 뒤에만 실린다 — 선생님 화면이 그렇게 만드는지 소스로 본다.
  const teacher = readFileSync(new URL('../packages/lab-kit/teacher.js', import.meta.url), 'utf8');
  assert.match(teacher, /#k=/, '관리 링크가 열쇠를 # 뒤에 싣지 않습니다');
  const client = readFileSync(new URL('../packages/lab-kit/net/supabase.js', import.meta.url), 'utf8');
  assert.equal(/secret/.test(client), false, '통신 창구가 열쇠(secret)를 만진다 — 서버로 새어 나갈 길이다');
});
