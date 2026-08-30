/**
 * 개인정보처리방침이 **실제로 보내는 것과 같은 말을 하는가.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 복제해서 만든 실험 셋이 전부 같은 자리를 밟았다. 제2조가 바나나랩 문장을 그대로
 * 물려받아 「수치(시드·배율·초점 등)」 라고 적고 있었는데, 현미경을 안 쓰는 실험은
 * **보내지도 않는 값을 받는다고 고지**하고 있었다.
 *
 * 그러다 catalase 세션이 반대쪽을 찾았다 — **적혀 있지 않은데 나가는 것**이 있었다.
 * `session.log`(학생이 무엇을 어떤 차례로 눌렀는지)와 되돌리기 기록(안전 수칙을
 * 지켰는지)가 그것이다. 이 저장소도 같았다.
 *
 * **양쪽 다 틀린 고지다** — 안 받는 것을 받는다고 적은 것도, 받는 것을 안 적은 것도.
 *
 * 문장은 기계가 못 읽으므로 **키를 맞춘다.** `privacy.html` 의 `<dl>` 안 `<dt>` 에
 * `data-sends` 로 그 항목이 담는 키를 적어 두고, 여기서 `payloadOf()` 가 실제로 내는
 * 키와 양방향으로 비교한다. 상태를 하나 늘리면 이 검사가 먼저 빨간불이 된다.
 *
 * 방침의 **말씨**(어느 실험의 기구를 이름으로 대는가)는 여기서 안 본다 — 사이트 것이다.
 * 이 파일은 **이 실험이 무엇을 보내는가**만 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, ENDS, SLOTS, SLOT_ITEMS, ANGLE_BEST_DEG } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { payloadOf, buildSheet } from '../src/ui/report.js';

const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

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

  /*
   * ★ **반대 방향(「방침이 받는다는데 안 보낸다」)은 여기 두지 않는다.**
   *   방침은 사이트에 하나뿐이고, 거기 적힌 것은 **실험 여덟이 보내는 것의 합집합**이다.
   *   이 실험만 보고 재면 `slides`(banana 만) · `design`·`trials`(catalase 만)를 보고
   *   「안 보내니 지워라」고 말한다 — **실험이 늘 때마다 고지가 깎여 나간다.**
   *   합집합을 아는 자리가 갖는다: `tests/site.test.js` 의
   *   「방침이 받는다는 것은 적어도 한 실험이 실제로 보낸다」.
   *   (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
   */
});

/**
 * 몇 가지를 실제로 한 상태 하나. **빈 상태로는 아무것도 검증되지 않는다** —
 * 빈 종이 둘은 무엇을 빼도 같기 때문이다.
 */
function played() {
  let st = initialState(2, 4242);
  const go = (type, payload = {}) => { st = reduce(st, { type, payload }).state; };
  go('SWAB_FINGER');
  go('PRICK_FINGER');
  go('DRAW_BLOOD', { angleDeg: ANGLE_BEST_DEG, dwell: 0.9 });
  go('SEAL_END', { end: ENDS.OUTER, press: 0.75 });
  go('SEAL_END', { end: ENDS.INNER, press: 0.75 });
  go('LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE });
  go('LOAD_ROTOR', { slot: SLOTS.B, what: SLOT_ITEMS.COUNTER });
  for (let i = 0; i < 20; i++) { go('PULL', { strength: 1 }); go('TICK', { seconds: 0.4, speed: 1 }); }
  go('MEASURE');
  go('CAPTURE');
  for (const [step, text] of [
    ['predict.split', '세 부분으로 갈린다'], ['1a', '손끝이 차가웠다'],
    ['q2', '바깥쪽은 적혈구층, 축 쪽은 혈장이었다'], ['hct.0', '46'],
    ['selfeval.process', '4'], ['feedback.learned', '절반 넘게가 액체였다'],
  ]) go('SAVE_NOTE', { step, text });
  return st;
}

const WHO = { school: '○○고등학교', team: '3모둠' };

/**
 * **줄인 것만으로 같은 종이가 나오는가.**
 *
 * 선생님 화면은 받은 값으로 `buildSheet()` 을 다시 돌린다. 그러니 "이만큼이면 된다" 는
 * 눈이 아니라 이 등식이 증명한다. 「눈으로 보니 안 쓰는 것 같다」로 줄이면
 * 나중에 종이가 조용히 깨진다.
 */
test('보낸 값만으로 같은 종이가 나온다 — 빠진 것이 없다', () => {
  const st = played();
  assert.equal(
    buildSheet(payloadOf(st, WHO, 'group').state, WHO, 'group'),
    buildSheet(st, WHO, 'group'),
    '보낸 값으로 다시 그린 종이가 원본과 다릅니다 — 무언가 빠졌습니다'
  );
});

/**
 * **군더더기가 없는가.**
 *
 * 위 등식만으로는 반쪽이다. 「빠진 것이 없다」는 말이지 「군더더기가 없다」는 말이 아니라서,
 * 상태를 통째로 보내도 저 등식은 통과한다. **키를 하나씩 빼 보며 종이가 달라지는지**까지
 * 봐야 보내는 것이 전부 쓰인다는 것이 증명된다.
 */
test('보내는 값 가운데 하나라도 빼면 종이가 달라진다 — 군더더기가 없다', () => {
  const st = played();
  const full = payloadOf(st, WHO, 'group');
  const want = buildSheet(full.state, WHO, 'group');
  const keys = Object.keys(full.state.session);
  assert.ok(keys.length > 0, 'session 이 비어 있으면 이 검사가 아무것도 안 봅니다');
  for (const key of keys) {
    const { [key]: _dropped, ...rest } = full.state.session;
    let got;
    try {
      got = buildSheet({ ...full.state, session: rest }, WHO, 'group');
    } catch {
      // 없으면 종이가 아예 안 그려지는 값도 「쓰이고 있다」는 증거다.
      continue;
    }
    assert.notEqual(got, want,
      `session.${key} 를 빼도 종이가 같습니다 — 활동지에 실리지도 않는 것을 보내고 있습니다`);
  }
});

test('되돌리기 기록은 보내지 않는다', () => {
  // history 는 이전 상태를 통째로 쌓아 둔 것이라, 그대로 보내면
  // **학생이 지운 글까지 따라간다.** 방침도 그렇게 약속하고 있다.
  const p = payloadOf(played(), WHO, 'group');
  assert.equal(p.state.session.history, undefined,
    '되돌리기 기록이 제출 자료에 들어 있습니다 — 학생이 지운 글이 따라갑니다');
  // 낱말이 아니라 **약속**을 확인한다. `history` 라는 영문 낱말이 적혀 있는지 보면
  // 문장을 한국어로 다듬는 순간 헛발질한다 — 바나나랩에서 실제로 그랬다.
  // 「전송하지 않습니다」로 여는 목록 안에 「되돌리기 기록」이 있으면 약속한 것이다.
  const notSentBlock = html.slice(html.indexOf('전송하지 않습니다'));
  assert.ok(notSentBlock.includes('되돌리기 기록'),
    '방침이 되돌리기 기록을 보내지 않는다고 말하지 않습니다');
});

test('학생이 무엇을 어떤 차례로 눌렀는지도 보내지 않는다', () => {
  // 바나나랩에서 `session.log` 가 방침에 적히지도 않은 채 나갔다. 여기서는 아예 안 보낸다 —
  // 활동지에 실리지 않는 것을 보내 놓고 고지하는 것은 고지가 아니라 수집이다.
  const p = payloadOf(played(), WHO, 'group');
  assert.equal(p.state.session.log, undefined);
  const notSentBlock = html.slice(html.indexOf('전송하지 않습니다'));
  assert.ok(notSentBlock.includes('조작 기록'),
    '방침이 조작 기록을 보내지 않는다고 말하지 않습니다');
  // 실험대와 기구의 마지막 상태도 안 나간다.
  assert.deepEqual(Object.keys(p.state), ['session'],
    `state 에 session 말고 다른 것이 있습니다: ${Object.keys(p.state).join(', ')}`);
});

/*
 * ── 「방침에 다른 실험의 말이 없다」는 **사이트로 옮겼다** ─────────────
 *
 * 「**다른** 실험의 말」로 재면 자기 실험의 말(「원심분리」·「적혈구」)은 **통과시킨다.**
 * 방침이 사이트에 하나뿐인 지금, 그건 원심분리를 안 하는 학생에게 틀린 고지다.
 * 그리고 실험이 늘면 서로 정반대를 요구한다 — catalase 는 「원심분리를 지워라」,
 * centrifuge 는 「그건 내 것이니 둬라」. 같은 파일 하나에 대해서다.
 *
 * `tests/site.test.js` 의 「방침이 실험 하나의 말씨를 쓰지 않는다」가 **여덟 몫을 한 번에**
 * 재고, 자기 것도 봐준다. 거기서는 **주석을 걷어내고** 본다 — 여기서는 안 걷어내서
 * 방침에 달린 설명 주석의 「바나나」·「카탈레이스」에 걸렸다.
 * (합치기 4·5단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 */

test('조항 번호가 1부터 빠짐없이 이어진다', () => {
  // **조항을 하나 끼워 넣으면 뒤가 다 밀린다.** 손으로 밀다가 제7조가 둘이 되고
  // 제6조가 사라진 일이 실제로 있었다(허브 세션). 눈으로는 잘 안 보인다.
  const src = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');
  const nums = [...src.matchAll(/<h2>제(\d+)조/g)].map((m) => Number(m[1]));
  assert.deepEqual(nums, nums.map((_, i) => i + 1),
    `조항 번호가 어긋납니다: ${nums.join(' · ')}`);
});

test('본문이 가리키는 조항이 그 내용의 조항이다', () => {
  /*
   * 「제10조의 연락처로」 같은 상호참조는 조항이 밀릴 때 **조용히 다른 곳을 가리킨다.**
   *
   * 처음에는 「없는 조항을 가리키는가」로만 봤는데 **그것으로는 안 잡힌다** —
   * 조항을 하나 끼우면 제10조는 여전히 있고, 다만 **다른 조항**이 되어 있다.
   * 되돌려 보고 알았다(번호만 안 민 채로 두었더니 초록불이었다).
   *
   * 그래서 **가리키는 곳의 표제**까지 본다. 뒤따르는 말이 곧 무엇을 가리키는지 말해 준다.
   * 아는 말이 아니면 건너뛴다 — 문장을 다듬었다고 빨간불이 나면 검사가 꺼진다.
   * 대신 하나도 못 봤으면 그것을 먼저 빨간불로 낸다(앞 조건).
   */
  const src = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');
  const heads = new Map([...src.matchAll(/<h2>제(\d+)조 \(([^)]*)\)/g)].map((m) => [m[1], m[2]]));
  const CUES = [
    [/^\s*[가-힣]목/, '개인정보 항목'],   // 제2조 가목 · 나목
    [/^의?\s*보관 기간/, '보유 기간'],     // 제4조의 보관 기간
    [/^의?\s*연락처/, '보호책임자'],       // 제11조의 연락처
  ];
  const body = src.replace(/<h2>[\s\S]*?<\/h2>/g, '');
  const bad = [];
  let checked = 0;
  for (const m of body.matchAll(/제(\d+)조/g)) {
    const tail = body.slice(m.index + m[0].length, m.index + m[0].length + 20);
    const cue = CUES.find(([re]) => re.test(tail));
    if (!cue) continue;
    checked++;
    const head = heads.get(m[1]);
    if (!head || !head.includes(cue[1])) {
      bad.push(`제${m[1]}조${tail.trim().slice(0, 12)}… → 「${head ?? '없는 조항'}」 (「${cue[1]}」 이어야 함)`);
    }
  }
  assert.ok(checked >= 3, `상호참조를 하나도 못 봤습니다 — 검사가 헛돌고 있습니다 (본 것 ${checked}개)`);
  assert.deepEqual(bad, [], '본문이 엉뚱한 조항을 가리킵니다:\n  ' + bad.join('\n  '));
});
