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
 * (「다른 실험의 낱말이 남아 있는가」는 합치기 5단계에서 **사이트**로 갔다 —
 *  방침이 하나뿐인 문서가 되면서 「내 것은 봐준다」가 성립하지 않게 됐다.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { payloadOf } from '../src/ui/report.js';

const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

/** 이 실험에 **없는** 말. 다른 실험 방침이 흘러 들어왔는지 본다. */
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
   * ★ **반대 방향(「방침이 받는다는데 안 보낸다」)은 여기서 재지 않는다.**
   *   방침은 **사이트에 하나뿐인 문서**라, 실험 여덟이 보내는 것의 **합집합**을 적는다.
   *   banana 만 `slides` 를 보내는데 여기서 「osmosis 가 안 보내니 방침에서 지워라」고
   *   말하면 **banana 의 고지를 지우게 된다.** 그래서 그 방향은 사이트가 갖는다 —
   *   `tests/site.test.js` 의 「방침이 받는다는 것은 적어도 한 실험이 실제로 보낸다」.
   *   (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
   */
});

test('방침의 조 번호가 이어지고, 본문이 가리키는 조가 맞는 조다', () => {
  /*
   * 조를 하나 끼우면 뒤 번호가 다 밀린다. 표제는 눈에 띄어서 고치는데,
   * **본문 속 「제10조의 연락처」 같은 상호참조는 조용히 어긋난다.**
   * 학생이 연락처를 찾아갔다가 엉뚱한 조를 읽는다. 정본에서 실제로 그랬다 —
   * 「제10조의 연락처」가 **안전성 확보 조치** 조항을 가리키고 있었다.
   *
   * ── 「없는 조를 가리키는가」로 재면 안 잡힌다 ─────────────────────
   * 조를 끼워도 `제10조` 는 **여전히 있다.** 다만 다른 조가 되어 있을 뿐이다.
   * **가리키는 곳의 표제까지 봐야** 갈린다 — 뒤따르는 말이 무엇을 가리키는지 말해 준다.
   * (웨이브 3 의 centrifuge 세션이 자기 검사가 헛초록불인 것을 잡고 이 모양을 냈다)
   */
  const heads = [...html.matchAll(/<h2>제(\d+)조 \(([^)]*)\)/g)]
    .map((m) => ({ n: Number(m[1]), title: m[2] }));
  assert.ok(heads.length > 0, '방침에 조항 표제가 하나도 없습니다');
  assert.deepEqual(heads.map((h) => h.n), heads.map((_, i) => i + 1),
    `조 번호가 1부터 이어지지 않습니다: ${heads.map((h) => h.n).join('·')}`);

  // 뒤따르는 말 → 그 참조가 가리켜야 하는 것. 아는 말이 아니면 건너뛴다.
  const MEANS = [
    [/^\s*[가-힣]목/, '항목'],
    [/^의?\s*보관 기간/, '보유'],
    [/^의?\s*연락처/, '보호책임자'],
  ];
  const body = html.replace(/<h2>[^<]*<\/h2>/g, '');
  let checked = 0;
  for (const m of body.matchAll(/제(\d+)조([^<。]{0,12})/g)) {
    const rule = MEANS.find(([re]) => re.test(m[2]));
    if (!rule) continue;
    checked += 1;
    const target = heads.find((h) => h.n === Number(m[1]));
    assert.ok(target, `본문이 없는 조를 가리킵니다: 제${m[1]}조`);
    assert.ok(target.title.includes(rule[1]),
      `제${m[1]}조${m[2]} → 「${target.title}」 (「${rule[1]}」 을 담은 조여야 합니다)`);
  }
  // **하나도 못 봤으면 그것부터 빨간불이다.** 문장을 다듬는 순간 조용히 0개를 보게 된다.
  assert.ok(checked > 0, '상호참조를 하나도 못 찾았습니다 — 이 검사가 아무것도 안 재고 있습니다');
});

test('환경변수를 통째로 읽지 않는다 — 실명과 커밋 메시지가 번들에 실린다', () => {
  /*
   * `const env = import.meta.env` 처럼 **통째로** 읽으면 Vite 가 `VITE_` 로 시작하는 것을
   * **전부** 번들에 박아 넣는다. Vercel 은 시스템 값 스물몇 개를 `VITE_VERCEL_*` 로 자동
   * 노출하므로, 그 순간 **커밋한 사람의 실명과 커밋 메시지가 학생 브라우저로 나간다.**
   * 배포본에서 실제로 확인했다 (약 3 KB):
   *
   *     VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME · GIT_COMMIT_MESSAGE · PROJECT_ID · …
   *
   * 비밀값은 아니지만 **아무도 그러라고 하지 않은 것**이고, 이 저장소는 사람 이름을 안 싣는다.
   * 이름을 하나씩 적어 읽으면 Vite 는 그 키만 바꿔 넣는다.
   *
   * `import.meta.env.DEV` 처럼 **점을 찍어 한 개씩** 읽는 것은 괜찮다 — 그 하나만 박힌다.
   * (웨이브 1 의 micrometer 세션이 배포 번들을 열어 보고 찾았다)
   */
  const files = readdirSync(new URL('../src', import.meta.url), { recursive: true })
    .filter((f) => String(f).endsWith('.js'));
  for (const f of files) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // 뒤에 `.이름` 이 안 붙은 `import.meta.env` — 통째로 집어 가는 모양이다.
    const bare = src.match(/import\.meta\.env(?!\s*\.\s*[A-Za-z_$])/g) ?? [];
    assert.deepEqual(bare, [],
      `src/${f} 가 import.meta.env 를 통째로 읽습니다 — VITE_VERCEL_* 스물몇 개가 번들에 박히고`
      + ' 커밋한 사람의 실명과 커밋 메시지가 학생 브라우저로 나갑니다.'
      + ' 쓰는 키를 하나씩 이름으로 적어 읽으세요.');
  }
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

/*
 * ── 「방침에 다른 실험의 말이 없다」는 **사이트로 옮겼다** ─────────────
 *
 * 「**다른** 실험의 말」로 재면 자기 실험의 말(「바나나」·「배율」)은 **통과시킨다.**
 * 방침이 사이트에 하나뿐인 지금, 그건 바나나를 안 하는 학생에게 틀린 고지다.
 * 그리고 실험이 넷이 되자 서로 정반대를 요구하기 시작했다 —
 * catalase 는 「배율을 지워라」, banana 는 「배율은 내 것이니 둬라」.
 *
 * `tests/site.test.js` 의 「방침이 실험 하나의 말씨를 쓰지 않는다」가 **여덟 몫을 한 번에**
 * 재고, 자기 것도 봐준다. 거기서는 주석을 걷어내고 본다 —
 * 여기서는 안 걷어내서 방침에 새로 단 **설명 주석의 「카탈레이스」**에 걸렸다.
 * 「검사가 한 번이라도 헛발질하면 그 뒤로 아무도 안 믿는다」의 그 자리다.
 * (합치기 5단계, 2026-08-30)
 */
