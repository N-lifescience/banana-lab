/**
 * 개인정보 — **눈으로 보면 놓친다.**
 *
 * ── 왜 따로 뺐나 ───────────────────────────────────────────────────
 * 이 검사들은 원래 `report.test.js` 와 `roadmap.test.js` 에 흩어져 있었다.
 * 그런데 T01 에서 보고서를 갈아 끼우려고 잠시 치우자 **개인정보 검사가 함께 꺼졌다.**
 * 꺼진 검사는 없는 검사이고, 없는 줄도 모르는 검사가 가장 나쁘다.
 *
 * 그래서 **파일 하나를 겨누지 않고 디렉터리를 훑는 검사**로 옮겼다.
 * `src/ui/` 아래 무엇이 들어오고 나가든 계속 본다.
 *
 * ── 무엇을 안 하는가 ───────────────────────────────────────────────
 * 소스 전체를 정규식으로 훑지 않는다. **그게 틀린 방법이었다** — 주석의 평범한 문장에
 * 걸리면서 정작 진짜 입력칸(`<label>학번</label><input>`)은 놓쳤다.
 * 산문을 훑으면 오탐과 누락이 함께 온다.
 *
 * 대신 이 저장소의 불변식을 쓴다 — **화면에 보이는 한국어는 전부 `strings.js` 에 있다.**
 * 학생에게 이름을 물으려면 그 문구가 거기 있어야 한다.
 * 여기에 더해 화면에 직접 노출되는 자리(placeholder / aria-label / label / input type)만 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { initialState, beakerConditions } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

/** 화면을 만드는 파일 전부. 디렉터리를 훑으므로 파일이 늘어도 저절로 검사된다. */
function screenSources() {
  const files = [];
  for (const dir of ['../src/ui/', '../src/render/']) {
    const url = new URL(dir, import.meta.url);
    if (!existsSync(url)) continue;
    for (const f of readdirSync(url)) {
      if (f.endsWith('.js')) files.push([`${dir.replace('../', '')}${f}`, readFileSync(new URL(f, url), 'utf8')]);
    }
  }
  for (const f of ['index.html', 'src/main.js']) {
    files.push([f, readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')]);
  }
  return files;
}

/** 주석을 걷어낸 소스. 주석은 금지어를 설명하려고 그대로 적는다 — 걷어내지 않으면 오탐이 난다. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** 객체 안의 모든 문자열을 경로와 함께 뽑는다 */
function allStrings(obj, path = 'UI', out = []) {
  if (typeof obj === 'string') out.push([path, obj]);
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) allStrings(v, `${path}.${k}`, out);
  }
  return out;
}

test('학생에게 이름·학번을 묻는 문구가 없다', () => {
  // 물어보는 문구여야 걸린다. 「이름표」·「애셋 이름」 같은 말은 걸리지 않는다.
  const asking = /(이름|성명|학번|학년|생년월일|연락처|전화)\s*(을|를)?\s*(입력|적|쓰|기입|알려)/;
  for (const [path, text] of allStrings(UI)) {
    assert.equal(asking.test(text), false, `${path} 가 개인정보를 묻습니다: "${text}"`);
  }
});

test('개인정보를 받는 입력칸이 화면에 없다', () => {
  const piiWord = /(이름|성명|학번|학년|생년월일|연락처|전화|이메일)/;
  for (const [name, raw] of screenSources()) {
    const src = stripComments(raw);
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

/**
 * 화면 코드가 개인정보를 어디에도 남기지 않는다.
 *
 * 보고서는 이름을 **인쇄할 때만** 받고 상태에도 저장소에도 넣지 않는다. 이름이 상태로
 * 들어가면 되돌리기 기록에 남고, 상태를 읽는 모든 화면으로 흘러간다. 화면 어디서도
 * 티가 안 나고, 티가 안 나는 채로 계속 쌓인다.
 *
 * `src/net/` 은 여기서 보지 않는다 — 제출을 실제로 하는 파일이라 `fetch` 가 있는 것이 맞다.
 * 무엇을 보내는지는 `tests/submit.test.js` 가 따로 본다.
 */
test('화면 코드는 저장소에도 네트워크에도 손대지 않는다', () => {
  const sinks = ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest'];
  for (const [name, raw] of screenSources()) {
    const src = stripComments(raw);
    for (const sink of sinks) {
      assert.ok(!src.includes(sink), `${name} 가 ${sink} 를 씁니다 — 학생이 쓴 것이 남습니다`);
    }
  }
});

/**
 * 결과 보드에 보낼 값에 개인을 가리키는 것이 없다.
 *
 * 보내는 것은 **관찰 조건 값들뿐**이고 이미지가 아니다. 목록을 여기서 고정한다 —
 * 무언가 더하면 잡히게.
 */

/* ---------------- 방침이 실제로 보내는 것과 같은가 ---------------- */

/**
 * **개인정보처리방침에 적힌 항목이 실제 제출물과 정확히 같아야 한다.**
 *
 * ── 왜 이 검사가 필요한가 ──────────────────────────────────────────
 * 방침이 「관찰 결과를 다시 그리기 위한 수치(시드·**배율·초점** 등)」를 보낸다고 적고 있었다.
 * **이 실험에는 현미경이 없다.** 바나나랩 문장을 그대로 물려받은 것이었고,
 * 사람 눈으로는 몇 번을 읽어도 안 보였다 — 문장이 그럴듯하기 때문이다.
 *
 * 안 받는 것을 받는다고 적는 것도 **틀린 고지**다. 그리고 이 어긋남은 상태에 칸을 하나
 * 늘릴 때마다 다시 생긴다. 그래서 문장이 아니라 **키**를 기계가 맞춰 본다.
 *
 * `privacy.html` 의 `data-sends` 에 적힌 키와, `payloadOf()` 가 실제로 내는 키가
 * **정확히 같아야** 한다. 한쪽만 늘면 빨간불이다.
 */

/**
 * 되돌리기 기록은 제출물에 안 들어간다.
 *
 * `history` 는 이전 상태를 통째로 쌓아 둔 것이라, 그대로 나가면 학생이 지운 글까지 따라간다.
 * `payloadOf()` 가 빼고 있고 방침도 그렇게 적었다 — 둘이 어긋나지 않는지 본다.
 */
/**
 * 보고서에 안 실리는 것은 보내지 않는다.
 *
 * 예전에는 상태를 통째로(되돌리기 기록만 빼고) 보냈다. 그러자 **학생이 무엇을 어떤 차례로
 * 눌렀는지**(`session.log`)와 **실험대에 마지막으로 놓여 있던 것**(`bench`)이 함께 나갔다.
 * 종이 어디에도 안 실리는 것들이다.
 */


/*
 * ── 「방침에 이 실험에 없는 기구가 적혀 있지 않다」는 **사이트로 옮겼다** ──
 *
 * 잡던 것은 진짜였다. 이 실험에는 현미경이 없는데 방침이 바나나랩 문장을 물려받아
 * 「배율·초점」을 받는다고 적고 있었다 — **안 받는 것을 받는다고 적는 것도 틀린 고지**이고,
 * 문장이 그럴듯해서 사람 눈으로는 몇 번을 읽어도 안 보인다.
 *
 * 그런데 방침은 **사이트에 하나뿐인 문서**다. 「이 실험에 없는 말」로 재면
 * **banana 와 micrometer 에는 정말로 있는 「배율」을 지우라고** 말하게 된다.
 * 실험마다 지우라는 말이 달라서, 실험이 늘수록 방침이 깎여 나간다.
 *
 * 주인을 바꾸면 규칙이 하나가 된다: **공용 문서는 어느 실험의 기구도 이름으로 대지 않는다.**
 * 받는 것이 무엇인지는 산문이 아니라 `data-sends` 가 말한다 (바로 위 검사).
 * `tests/site.test.js` 의 「방침이 실험 하나의 말씨를 쓰지 않는다」로 갔다.
 * (합치기 5단계, 2026-08-30)
 */

/**
 * **조항 번호가 스스로 어긋나지 않는가.**
 *
 * 방침에 조항을 하나 끼워 넣으면 뒤 번호가 전부 밀린다. 그런데 본문에는
 * 「제10조의 연락처로」처럼 **번호로 가리키는 문장**이 있고, 그것은 안 밀린다 —
 * 넣은 사람 눈에는 새 조항이 잘 들어간 것처럼 보이고, 읽는 사람은
 * **엉뚱한 조항으로 안내받는다.** 파기 조항을 넣다가 실제로 그렇게 됐다
 * (「제10조의 연락처」가 안전성 조치 조항을 가리키게 됐다).
 *
 * 무엇을 가리켜야 하는지까지는 기계가 모른다. 하지만 **가리키는 곳이 있기는 한지**와
 * **번호가 1부터 빠짐없이 이어지는지**는 기계가 안다. 그 둘만 잡아도 이 사고는 안 난다.
 */
test('방침의 조항 번호가 빠짐없이 이어지고, 본문이 가리키는 조항이 실제로 있다', () => {
  const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');

  const headings = [...html.matchAll(/<h2>제(\d+)조/g)].map((m) => Number(m[1]));
  assert.ok(headings.length > 0, '방침에 조항이 하나도 없습니다');
  headings.forEach((n, i) => {
    assert.equal(n, i + 1,
      `조항 번호가 이어지지 않습니다 — ${i + 1}번째 조항이 제${n}조입니다 (번호를 밀다 만 자리)`);
  });

  // 본문(제목이 아닌 곳)에서 번호로 가리키는 조항은 실제로 있어야 한다.
  const body = html.replace(/<h2>제\d+조[^<]*<\/h2>/g, '');
  for (const m of body.matchAll(/제(\d+)조/g)) {
    assert.ok(headings.includes(Number(m[1])),
      `본문이 제${m[1]}조를 가리키는데 그런 조항이 없습니다 — 번호를 밀 때 본문도 함께 밀어야 합니다`);
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
  const policy = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');
  assert.match(policy, /수집하지 않습니다/);
  assert.match(policy, /전송할 서버가 없습니다|서버도 없습니다|받는 서버도/);
});
