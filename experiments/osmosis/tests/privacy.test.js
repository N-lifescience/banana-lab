/**
 * 개인정보처리방침에 적은 것과 **실제로 보내는 것**이 같은가.
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 「선생님께 제출」은 `payloadOf()` 가 만든 것을 그대로 보낸다. 그 안에 무엇이 들어 있는지는
 * 코드를 열어야만 알 수 있고, 방침은 손으로 적은 산문이라 **둘은 조용히 어긋난다.**
 *
 * 실제로 어긋나 있었다. 방침에는 「관찰 결과를 다시 그리기 위한 수치(시드·배율·초점 등)」
 * 라고만 적혀 있었는데, 보내는 것에는 **학생이 한 조작의 순서와 결과가 통째로**(`session.log`)
 * 들어 있었다. 안전·정리 기록과 기구 상태도 적혀 있지 않았다.
 *
 * **받는 것을 안 적어 두는 것은 안 받는 것을 적어 두는 것과 똑같이 틀린 고지다.**
 *
 * ── 어떻게 보는가 — 문구가 아니라 **키**를 맞댄다 ─────────────────
 * 처음에는 「보내는 키 → 방침의 어느 문구가 그것을 덮는가」 표를 손으로 적어 두고
 * 그 **문구가 방침에 있는지**를 봤다. 실험이 하나일 때는 됐지만, 합친 뒤로 방침은
 * **사이트에 하나뿐인 문서**다. 그러면 실험 여덟이 저마다 자기 문장을 그 한 문서에
 * 요구하게 되고 — 「활동 설정」이냐 「난이도」냐 같은 **말씨 싸움**이 된다.
 * 고지가 맞는지와 아무 상관이 없는 싸움이다.
 *
 * 그래서 방침 쪽 `<dt>` 에 `data-sends="키,키"` 를 적어 두고 **키끼리** 맞댄다.
 * 양방향으로 본다:
 *
 *   1. 보내는데 방침에 안 적힌 것이 있는가 — 상태에 값을 하나 늘리면 여기서 걸린다
 *   2. 방침이 받는다는데 안 보내는 것이 있는가 — 안 받는 것을 받는다고 적은 것도
 *      **똑같이 틀린 고지**다 (현미경을 안 쓰는 실험이 「초점」을 받는다고 적고 있었다)
 *
 * 그래서 상태를 늘리려면 **방침을 함께 고쳐야** 초록불이 된다. 그것이 이 파일의 목적이다.
 * (합치기 4단계, 2026-08-30 — banana 가 먼저 이 모양으로 갔고 osmosis 가 따라왔다)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { payloadOf, buildSheet, SUBMIT_SESSION_KEYS } from '../src/ui/report.js';
import { initialState, MODES } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';

const PRIVACY = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

/** 실험을 조금 해 본 상태. 빈 상태로는 `captures` 같은 것이 안 채워져 검사가 헐거워진다. */
function playedState(level = 2, mode = MODES.GROUP) {
  let st = initialState(level, 4242, mode);
  const d = (t, payload) => { st = reduce(st, { type: t, payload }).state; };
  d('CUT_SCALE', {});
  d('PEEL_EPIDERMIS', { side: 'outer', thickness: 0.28 });
  d('PLACE_SAMPLE', { slide: 'A' });
  d('FILL_DROPPER', { solution: 'WATER' });
  d('DROP', { slide: 'A', count: 2 });
  d('PICK_COVERSLIP', {});
  d('PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 });
  d('MOUNT', { slide: 'A' });
  d('CAPTURE', {});
  d('SAVE_NOTE', { step: 'q2', text: '10 % 와 15 % 사이' });
  for (const k of ['process', 'evidence', 'careful', 'safety', 'retry']) {
    d('SAVE_NOTE', { step: `selfeval.${k}`, text: '4' });
  }
  d('SAVE_NOTE', { step: 'feedback.learned', text: '세포벽이 있어서 안 터진다' });
  d('SAVE_NOTE', { step: 'q3', text: '세포벽이 버텨 주기 때문' });
  d('SAVE_NOTE', { step: 'discussion.roles', text: '나는 표피를 벗겼다' });
  return st;
}

/**
 * 실제로 나가는 키를 `a.b` 꼴로 편다. 두 겹까지만 본다 — 방침이 그 깊이로 적혀 있다.
 */
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

/*
 * **표에 직접 들어가는 칸도 세어야 한다.**
 *
 * 위 `data-sends` 맞대기는 `payloadOf()` 가 만든 것만 본다. 그런데 제출은 payload 말고도
 * **테이블 칸을 따로 채운다** — `student_no` · `student_name` 이 거기 있다.
 * 이 실험에서 **가장 민감한 두 값이 그 바깥에 있었다.**
 *
 * 방침에는 「필수 항목 — 학번, 이름」으로 적혀 있어 지금은 아귀가 맞는다. 그런데
 * **아귀가 맞는지를 재는 것이 없었다.** 칸을 하나 늘려도 아무 데서도 안 걸린다 —
 * 「검사가 없는 것보다 있는 것처럼 보이는 것이 나쁘다」의 그 자리다.
 *
 * `src/net/` 은 손대지 않는다(이미 돌아간다). **읽어서 세기만 한다.**
 */
/*
 * **방침에 있어야 하는 표제가 다 있는가 — 회귀 방지용이다.**
 *
 * 「파기」가 통째로 빠져 있었다(낱말이 0회). 제4조가 보유 기간을 말하고는 있었지만
 * **요구되는 표제 아래 적혀 있지 않았고**, 여덟 저장소가 다 그랬다.
 *
 * ★ **이 목록이 판정의 주인이 아니다.** 판정 목록의 주인은 `/dorms` 다
 * (`Projects/CLAUDE.md` — 「항목 수를 외워 세지 말 것」). 여기 있는 것은
 * **한 번 빠졌던 것이 다시 빠지지 않게** 붙잡아 두는 울타리일 뿐이고,
 * 이게 통과했다고 방침이 충족이라고 보고하면 안 된다.
 */
const REQUIRED_HEADINGS = ['항목', '목적', '보유', '파기', '제3자', '위탁', '권리', '안전성', '보호책임자'];

test('방침에 요구되는 표제가 다 있다 (판정은 /dorms 가 한다)', () => {
  const headings = [...PRIVACY.matchAll(/<h2>제\d+조 \(([^)]*)\)<\/h2>/g)].map((m) => m[1]);
  assert.ok(headings.length >= 10, `조가 ${headings.length}개뿐입니다`);
  const joined = headings.join(' | ');
  const missing = REQUIRED_HEADINGS.filter((w) => !joined.includes(w));
  assert.deepEqual(missing, [], `방침에 없는 표제: ${missing.join(', ')}  (조 목록: ${joined})`);

  // 권리 4종은 표제만으로는 안 되고 본문에 다 있어야 한다.
  for (const r of ['열람', '정정', '삭제', '처리정지']) {
    assert.ok(PRIVACY.includes(r), `정보주체의 권리 「${r}」가 방침에 없습니다`);
  }
  assert.ok(PRIVACY.includes('분쟁조정'), '분쟁조정 연락처가 방침에 없습니다');
});

test('조 번호를 가리키는 본문이 실제 그 조를 가리킨다', () => {
  /*
   * 「파기」를 끼워 넣으면서 뒤 조 번호가 한 칸씩 밀렸다. 본문에서 조를 가리키는 곳도
   * 같이 밀어야 하는데, **안 밀면 아무 데서도 안 걸린다** — 학생이 「제10조의 연락처」를
   * 찾아갔더니 거기가 안전성 조치인 식이 된다.
   */
  const heading = (n) => PRIVACY.match(new RegExp(`<h2>제${n}조 \\(([^)]*)\\)</h2>`))?.[1] ?? '';
  for (const [, n] of PRIVACY.matchAll(/제(\d+)조의 연락처/g)) {
    assert.match(heading(n), /보호책임자|연락처/,
      `본문이 「제${n}조의 연락처」라고 하는데 제${n}조는 「${heading(n)}」입니다`);
  }
});

const payload = payloadOf(playedState(), { school: '○○중학교', team: '3모둠' }, 'individual');


test('보고서에 안 실리는 것은 아예 보내지 않는다', () => {
  // **「빼야 할 것을 뺀다」 가 아니라 「보낼 것만 적는다」 다** (`src/ui/report.js`).
  // 앞서는 상태를 통째로 보내고 history 만 뺐다 — 그러면 상태에 값이 하나 늘 때마다
  // 조용히 함께 새어 나간다. 실제로 아래가 전부 나가고 있었다.
  const neverSend = [
    'history',      // 되돌리기 스냅샷 — 상태 전체가 통째로 몇 벌
    'log',          // 학생이 무엇을 어떤 차례로 눌렀는지 전부
    'tidy', 'step', 'readStages', 'undosLeft', 'seed', 'mode',
  ];
  const sent = Object.keys(payload.state.session);
  const leaked = neverSend.filter((k) => sent.includes(k));
  assert.deepEqual(leaked, [], `보고서에 안 쓰이는 것이 나갑니다: ${leaked.join(' · ')}`);
  assert.deepEqual(Object.keys(payload.state), ['session'],
    '기구 상태(slides·microscope·tools)가 나갑니다');
});

test('학생 이름은 payload 에 들어가지 않는다', () => {
  // 이름은 `submitReport` 의 studentName 으로만 간다 (방침 「필수 항목」).
  // payload 안에까지 들어가면 같은 값이 두 군데 남고, 지울 때 한쪽이 남는다.
  const withName = payloadOf(playedState(), { school: '', team: '', name: '홍길동' }, 'individual');
  assert.equal(JSON.stringify(withName).includes('홍길동'), false,
    '이름이 제출 payload 안에 들어갔습니다');
});


/* ---------------- 줄여도 되는 근거 ---------------- */

/**
 * 선생님 화면은 받은 값으로 **같은 종이를 다시 그린다** (`src/teacher.js` 의 `sheetOf`).
 * 그러니 판정은 종이로 한다 — 목록을 눈으로 검토하는 것보다 확실하다.
 *
 *   충분한가 — 보낸 것만으로 같은 종이가 나오는가
 *   군더더기가 없는가 — **하나 빼면 종이가 달라지는가**
 *
 * 난이도 3 × 활동방식 2 × 활동지 2 = 12가지에서 본다. 한 가지만 보면 놓친다 —
 * 혼자/모둠에 따라 실리는 절이 다르고, 난이도에 따라 예상 문항의 모양이 다르다.
 */
const CASES = [];
for (const level of [1, 2, 3]) {
  for (const mode of [MODES.SOLO, MODES.GROUP]) {
    for (const kind of ['individual', 'group']) CASES.push({ level, mode, kind });
  }
}

const WHO = { school: '○○중학교', team: '3모둠', studentNo: '20304' };

test('보낸 것만으로 학생이 낸 것과 같은 종이가 나온다', () => {
  for (const { level, mode, kind } of CASES) {
    const st = playedState(level, mode);
    const sent = payloadOf(st, WHO, kind).state;
    assert.equal(buildSheet(sent, WHO, kind), buildSheet(st, WHO, kind),
      `${level}단계 · ${mode} · ${kind} 활동지에서 종이가 달라집니다 — 보내는 것이 모자랍니다`);
  }
});

test('보내는 것 가운데 종이에 안 쓰이는 것이 없다', () => {
  // 하나를 빼도 종이가 같으면 그것은 안 쓰이는 것이다 — 안 쓰이면 보내지 않는다.
  const useless = [];
  for (const key of SUBMIT_SESSION_KEYS) {
    const sameEverywhere = CASES.every(({ level, mode, kind }) => {
      const st = playedState(level, mode);
      const sent = payloadOf(st, WHO, kind).state;
      const { [key]: _dropped, ...rest } = sent.session;
      try {
        return buildSheet({ session: rest }, WHO, kind) === buildSheet(st, WHO, kind);
      } catch {
        return false;   // 터지면 쓰이는 것이다
      }
    });
    if (sameEverywhere) useless.push(key);
  }
  assert.deepEqual(useless, [],
    `종이에 안 쓰이는데 보내고 있습니다: ${useless.join(' · ')} — SUBMIT_SESSION_KEYS 에서 빼세요`);
});

/**
 * **보낼 길 자체가 없는가.**
 *
 * 앞서 이 자리에는 「방침에 적힌 항목 = 실제로 보내는 것」 맞대기가 있었다. 제출 기능이
 * 있던 때의 검사다. 그 기능을 걷어낸 지금(사장님 결정 2026-09-03) 재야 할 것은 하나로 바뀐다:
 * **이 실험의 코드가 바깥으로 무엇을 보낼 수 있는가.** 보낼 길이 없으면 고지와 어긋날 일도 없다.
 */
test('이 실험은 바깥으로 아무것도 보내지 않는다', () => {
  const dir = new URL('../src/', import.meta.url);
  const walk = (u) => readdirSync(u, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(new URL(`${d.name}/`, u)) : [new URL(d.name, u)]);
  const files = walk(dir).filter((u) => u.pathname.endsWith('.js'));
  assert.ok(files.length > 0, '소스를 하나도 못 읽었습니다 — 검사가 헛돌고 있습니다');
  for (const u of files) {
    const src = readFileSync(u, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const name = u.pathname.split('/src/')[1];
    for (const [re, what] of [
      [/\bfetch\s*\(/, 'fetch'],
      [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
      [/sendBeacon\s*\(/, 'sendBeacon'],
      [/\bnew WebSocket\b/, 'WebSocket'],
      [/\bnew EventSource\b/, 'EventSource'],
    ]) {
      assert.equal(re.test(src), false,
        `src/${name} 이 ${what} 을 씁니다 — 이 앱은 학생 데이터를 바깥으로 보내지 않습니다.`
        + ' 보내야 할 이유가 생겼다면 개인정보처리방침부터 고치세요.');
    }
  }
});

test('방침이 「수집하지 않는다」고 말한다', () => {
  assert.match(PRIVACY, /수집하지 않습니다/);
  assert.match(PRIVACY, /전송할 서버가 없습니다|서버도 없습니다|받는 서버도/);
});
