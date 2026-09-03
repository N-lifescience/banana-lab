/**
 * 개인정보 — **눈으로 보면 놓치는 자리.**
 *
 * ── 왜 한 파일에 모았나 ────────────────────────────────────────────
 * 앞서 이 검사들은 `roadmap.test.js` 와 `report.test.js` 에 흩어져 있었다. 그런데 T01 에서
 * 보고서 화면을 `docs/banana-ui/` 로 치우자 **그 검사들이 함께 꺼졌다.** 검사가 꺼진 것은
 * 아무 데도 안 나온다 — 초록불은 그대로이기 때문이다. catalase 세션이 같은 자리를 밟았다.
 *
 * 그래서 여기로 옮기면서 **파일 하나가 아니라 디렉터리를 훑게** 고쳤다.
 * `src/ui/` 에 무엇이 들어오고 나가든 계속 본다.
 *
 * ── 세 방향으로 본다 ───────────────────────────────────────────────
 * 문장은 기계가 못 읽으므로 **키를 맞춘다.** `privacy.html` 의 `<dt>` 에 `data-sends` 로
 * 그 항목이 담는 키를 적어 두고, `payloadOf()` 가 실제로 내는 키와 대 본다.
 *
 *   1. **안 적고 보내는 것이 없는가** — 고지 없는 수집이다
 *   2. **적어 놓고 안 보내는 것이 없는가** — 이것도 틀린 고지다
 *   3. **보내는데 종이에 안 실리는 것이 없는가** — 활동지에 실리지도 않는 것을 보내
 *      놓고 방침에 적는 것은 고지가 아니라 **수집**이다. 키를 하나씩 빼 보며
 *      종이가 달라지는지로 본다. 「빠진 것이 없다」만 보면 반쪽이다 —
 *      쓸데없는 키를 더 넣어도 그 등식은 그대로 성립한다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { UI } from '../src/ui/strings.js';
import { reduce } from '../src/sim/rules.js';
import { payloadOf, buildSheet, SUBMIT_SESSION_KEYS } from '../src/ui/report.js';

const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

/**
 * 이 실험에 **없는** 말. 다른 실험 방침이 흘러 들어왔는지 본다.
 *
 * 앞줄(바나나랩)의 낱말을 맨 앞에 둔다 — 복제해 온 방침이 그대로 남는 것이
 * 가장 흔하고, 그 경우 「보내지도 않는 값을 받는다」고 고지하게 된다.
 */
const OTHER_WORDS = ['바나나', '녹말', '지질', '아이오딘', '수단 Ⅲ', '현미경', '슬라이드',
  '배율', '초점', '원형질', '적양파', '카탈레이스', '과산화수소', '크로마토그래피',
  '엽록소', '효모', '발효', '맹관부', '원심분리', '적혈구', '접안 마이크로미터'];

/**
 * 화면에 닿는 소스 전부. **디렉터리를 훑는다** — 파일 하나를 가리키면
 * 그 파일이 치워지는 날 검사가 조용히 꺼진다.
 */
function screenSources() {
  const dir = new URL('../src/ui/', import.meta.url);
  const out = readdirSync(dir).map((f) => [`src/ui/${f}`, readFileSync(new URL(f, dir), 'utf8')]);
  for (const extra of ['index.html', 'src/main.js']) {
    const u = new URL(`../${extra}`, import.meta.url);
    if (existsSync(u)) out.push([extra, readFileSync(u, 'utf8')]);
  }
  return out;
}

/** 객체 안의 모든 문자열을 경로와 함께 뽑는다 */
function allStrings(obj, path = 'UI', out = []) {
  if (typeof obj === 'string') out.push([path, obj]);
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) allStrings(v, `${path}.${k}`, out);
  }
  return out;
}

/* ---------------- 묻지 않는가 ---------------- */

/**
 * 처음에는 소스 전체를 정규식으로 훑었다. **그게 틀렸다.**
 * 주석의 평범한 문장에 걸리면서, 정작 진짜 입력칸은 놓쳤다.
 *
 * 대신 이 저장소의 불변식을 쓴다 — **화면에 보이는 한국어는 전부 `strings.js` 에 있다.**
 * 학생에게 이름을 물으려면 그 문구가 거기 있어야 한다. 주석에는 뭐라고 적혀 있든 상관없다.
 */
test('학생에게 이름·학번을 묻는 문구가 없다', () => {
  // 물어보는 문구여야 걸린다. 「이름표」·「애셋 이름」 같은 말은 걸리지 않는다.
  const asking = /(이름|성명|학번|학년|생년월일|연락처|전화)\s*(을|를)?\s*(입력|적|쓰|기입|알려)/;
  for (const [path, text] of allStrings(UI)) {
    assert.equal(asking.test(text), false,
      `${path} 가 학생에게 개인정보를 묻습니다: "${text}"`);
  }
});

test('개인정보를 받는 입력칸이 화면에 없다', () => {
  // 주석은 보지 않는다. 화면에 실제로 노출되는 자리만 본다.
  const piiWord = /(이름|성명|학번|학년|생년월일|연락처|전화|이메일)/;
  for (const [name, src] of screenSources()) {
    for (const m of src.matchAll(/(?:placeholder|aria-label)\s*=\s*["'`]([^"'`]*)["'`]/g)) {
      assert.equal(piiWord.test(m[1]), false, `${name} 의 입력칸이 개인정보를 받습니다: "${m[1]}"`);
    }
    for (const m of src.matchAll(/<label[^>]*>([^<]*)<\/label>/g)) {
      assert.equal(piiWord.test(m[1]), false, `${name} 의 라벨이 개인정보를 가리킵니다: "${m[1]}"`);
    }
    const typed = src.match(/type\s*=\s*["'`]?(email|tel)\b/);
    assert.equal(typed, null, `${name} 에 ${typed?.[1]} 입력칸이 있습니다`);
  }
});

/* ---------------- 남기지 않는가 ---------------- */

test('화면 코드가 브라우저 저장소에 무엇도 남기지 않는다', () => {
  // 이름을 저장소에 넣으면 탭을 닫아도 남고, 다음 학생이 같은 기기를 쓴다.
  // 주석은 걷어낸다 — 이 저장소의 주석은 「localStorage 에 저장하지 않는다」처럼
  // 금지어를 그대로 적고 있어서, 안 걷어내면 설명문을 코드로 오해한다.
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const [name, src] of screenSources()) {
    for (const sink of ['localStorage', 'sessionStorage', 'indexedDB']) {
      assert.ok(!strip(src).includes(sink), `${name} 이 ${sink} 를 씁니다 — 학생 기기에 남습니다`);
    }
  }
});

/* ---------------- 방침이 이 실험의 말을 하는가 ---------------- */

/*
 * ── 「방침에 다른 실험의 말이 없다」는 **사이트로 옮겼다** ─────────────
 *
 * 「**다른** 실험의 말」로 재면 자기 실험의 말(「발아」·「떡잎」)은 **통과시킨다.**
 * 방침이 사이트에 하나뿐인 지금, 그건 발아 실험을 안 하는 학생에게 틀린 고지다.
 * 그리고 실험이 여덟이 되면 서로 정반대를 요구한다 — 이쪽은 「카탈레이스를 지워라」,
 * catalase 는 「그건 내 것이니 둬라」. 같은 파일 하나에 대해서다.
 *
 * `tests/site.test.js` 의 「방침이 실험 하나의 말씨를 쓰지 않는다」가 **여덟 몫을 한 번에**
 * 재고, 자기 것도 봐준다. 거기서는 **주석을 걷어내고** 본다 — 여기서는 안 걷어내서
 * 방침에 달린 설명 주석의 「바나나」·「카탈레이스」에 걸렸다.
 * (합치기 4·5단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 */

function filled(kind = 'group') {
  let st = initialState(2, 7);
  const d = (type, payload) => { st = reduce(st, { type, payload: payload ?? {} }).state; };
  for (let i = 0; i < 2; i++) {
    d('SCOOP_BEANS', { kind: 'sprout' }); d('POUR_BEANS', { chamber: 'L' });
    d('SCOOP_BEANS', { kind: 'dry' }); d('POUR_BEANS', { chamber: 'R' });
  }
  d('POUR_BTB', { chamber: 'L' }); d('POUR_BTB', { chamber: 'R' });
  d('INSTALL_SENSOR', { chamber: 'L' }); d('INSTALL_SENSOR', { chamber: 'R' });
  d('SEAL', { chamber: 'L' }); d('SEAL', { chamber: 'R' });
  d('START', { chamber: 'L' }); d('START', { chamber: 'R' });
  for (let i = 0; i < 30; i++) d('TICK', { minutes: 1 });
  d('RECORD');
  d('SAVE_NOTE', { step: 'q2', text: '콩 말고 다 같게 두어야 무엇 때문인지 알 수 있다' });
  d('SAVE_NOTE', { step: 'predict.sprout', text: '이산화 탄소가 늘 것 같다' });
  d('SAVE_NOTE', { step: 'selfeval.process', text: '4' });
  return { st, kind, who: { school: '○○고', team: '3모둠' } };
}

/**
 * **방침이 갖춰야 할 항목이 다 있는가.**
 *
 * `Projects/CLAUDE.md` 가 직접 못 박고 있다 — 수집항목·목적·보유기간·**파기**·안전성조치·
 * 권리 4종·제3자·위탁·분쟁조정 연락처. **하나라도 빠지면 미충족이다.**
 *
 * 실제로 **파기가 빠져 있었다.** 제4조가 「기간이 지나면 자동으로 삭제」라고 말하고는
 * 있었지만 **파기절차·파기방법·파기시점을 나눠 적은 조항이 없었다** — 여덟이 다 같았다.
 * 「뜻은 들어 있다」와 「항목이 있다」는 다르고, 심사는 뒤엣것을 본다.
 *
 * `/dorms` 의 `security` 트랙은 **방침이 있는가**까지만 본다. 세부 항목은 다른 트랙이라
 * 도구 판정을 기다릴 것이 없다 — 여기서 센다.
 */

test('방침에 갖춰야 할 항목이 다 있다', () => {
  const NEED = [
    ['수집 항목', /처리하는 개인정보 항목|수집(하는)? ?항목/],
    ['처리 목적', /처리 목적/],
    ['보유 기간', /보유 기간|보관 기간/],
    ['파기절차', /파기절차/],
    ['파기방법', /파기방법/],
    ['파기시점', /파기시점/],
    ['안전성 확보 조치', /안전성 확보 조치/],
    ['권리 — 열람', /열람/],
    ['권리 — 정정', /정정/],
    ['권리 — 삭제', /삭제/],
    ['권리 — 처리정지', /처리정지/],
    ['제3자 제공', /제3자/],
    ['처리 위탁', /위탁/],
    ['분쟁조정 연락처', /개인정보분쟁조정위원회|개인정보침해신고센터/],
    ['보호책임자', /개인정보 보호책임자/],
  ];
  const missing = NEED.filter(([, re]) => !re.test(html)).map(([name]) => name);
  assert.deepEqual(missing, [],
    `개인정보처리방침에 빠진 항목이 있습니다: ${missing.join(' · ')}\n`
    + '  → 하나라도 빠지면 미충족입니다 (Projects/CLAUDE.md)');
});

test('방침의 조항 번호가 건너뛰지 않는다', () => {
  // 조항을 끼우면 뒤 번호가 밀린다. 본문이 「제10조의 연락처로」 처럼 **다른 조항을
  // 가리키고 있어서**, 번호만 고치고 본문을 안 고치면 있지도 않은 곳을 가리키게 된다.
  const nums = [...html.matchAll(/<h2>제(\d+)조/g)].map((m) => Number(m[1]));
  assert.deepEqual(nums, nums.map((_, i) => i + 1),
    `조항 번호가 이어지지 않습니다: ${nums.join(', ')}`);

  // 본문이 가리키는 조항이 실제로 있는가.
  const refs = [...html.matchAll(/제(\d+)조(?!\s*\()/g)].map((m) => Number(m[1]));
  const bad = [...new Set(refs)].filter((n) => !nums.includes(n));
  assert.deepEqual(bad, [], `본문이 없는 조항을 가리킵니다: ${bad.map((n) => `제${n}조`).join(', ')}`);
});


/**
 * **보내는데 종이에 안 실리는 것이 없는가.**
 *
 * 활동지에 실리지도 않는 것을 보내 놓고 방침에 적는 것은 고지가 아니라 **수집**이다.
 * 키를 하나씩 빼 보며 종이가 달라지는지로 본다 — 안 달라지면 그 키는 군더더기다.
 * 실제로 `session.mode` 가 여기서 잡혔다 (표의 제 칸으로 따로 가고 있었다).
 */


/* ---------------- 보고서가 이름을 어디로도 흘리지 않는가 ---------------- */

test('보고서가 개인정보를 상태에도 저장소에도 보내지 않는다', () => {
  // 이름을 store 에 넣으면 되돌리기 기록에 남고, 상태를 읽는 모든 화면으로 흘러간다.
  const src = readFileSync(new URL('../src/ui/report.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/\.dispatch\(/.test(src),
    'report.js 가 store.dispatch 를 부릅니다 — 이름이 상태로 들어갑니다');
  for (const sink of ['localStorage', 'sessionStorage', 'indexedDB']) {
    assert.ok(!src.includes(sink), `report.js 가 ${sink} 를 씁니다 — 이름이 남습니다`);
  }
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
  assert.match(html, /수집하지 않습니다/);
  assert.match(html, /전송할 서버가 없습니다|서버도 없습니다|받는 서버도/);
});
