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
import { initialState, tubeConditions } from '../src/sim/state.js';
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
test('제출 대상 값에 개인을 가리키는 것이 없다', () => {
  const c = tubeConditions(initialState(1, 12345).bench.tube);
  const allowed = new Set(['tempC', 'glucosePct', 'yeastMl', 'totalMl', 'plugged']);
  for (const key of Object.keys(c)) {
    assert.ok(allowed.has(key), `조건 한 벌에 예상 못 한 값이 있습니다: ${key}`);
  }
  for (const v of Object.values(c)) {
    assert.ok(['number', 'boolean'].includes(typeof v), `조건 값이 숫자·참거짓이 아닙니다: ${v}`);
  }
});

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
test('방침에 적힌 항목이 실제로 보내는 것과 정확히 같다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const { reduce } = await import('../src/sim/rules.js');
  const { OBSERVE_LIMIT_MIN } = await import('../src/sim/fermentation.js');

  // 한 시행을 실제로 끝낸 상태로 잰다. 빈 상태로 재면 아직 안 생긴 칸을 놓친다.
  let st = initialState(2);
  const run = (type, payload = {}) => { st = reduce(st, { type, payload }).state; };
  run('SET_INDEPENDENT', { variable: 'temp' });
  run('POUR_GLUCOSE', { pct: 10 }); run('POUR_YEAST'); run('PLUG_TUBE');
  run('PUT_IN_INCUBATOR', { tempC: 30 });
  for (let i = 0; i < OBSERVE_LIMIT_MIN; i++) run('TICK', { minutes: 1 });
  run('RECORD_TRIAL');
  run('SAVE_NOTE', { step: 'q2', text: '기체가 더 많이 났다' });

  const payload = payloadOf(st, { school: '', team: '' }, 'group');
  const sent = new Set();
  for (const key of Object.keys(payload.state)) {
    if (key === 'session') continue;
    sent.add(key);
  }
  for (const key of Object.keys(payload.state.session)) sent.add(`session.${key}`);
  assert.ok(sent.size > 0, '보내는 것이 하나도 없다고 나옵니다 — 검사가 헛돌고 있습니다');

  const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');
  /*
   * ★ **`match` 가 아니라 `matchAll` 이다.** 따로 서 있던 시절 방침은 목록이 한 줄이라
   *   맨 앞 하나만 읽어도 다 읽은 것이었다. 사이트 방침은 항목마다 `<dt>` 가 따로다 —
   *   맨 앞(`student_no,student_name`)만 읽으면 **나머지를 전부 「안 적힌 것」으로 본다.**
   *   (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
   */
  const attr = [...html.matchAll(/<dt[^>]+data-sends="([^"]+)"/g)];
  assert.ok(attr.length, 'privacy.html 에 data-sends 목록이 없습니다');
  // 쉼표로 나눈다 — `data-sends="session.captures,slides,design,trials"` 처럼 한 항목이 여럿을 담는다
  const declared = new Set(attr.flatMap((m) => m[1].split(',').map((k) => k.trim())).filter(Boolean));

  const undeclared = [...sent].filter((k) => !declared.has(k));
  assert.deepEqual(undeclared, [],
    `방침에 안 적힌 것을 보내고 있습니다: ${undeclared.join(', ')} — privacy.html 을 고치세요`);

  /*
   * ★ **반대 방향(「방침이 받는다는데 안 보낸다」)은 여기 두지 않는다.**
   *   방침은 사이트에 하나뿐이고 거기 적힌 것은 **실험 여덟이 보내는 것의 합집합**이다.
   *   이 실험만 보고 재면 `slides`(banana 만)·`session.captures`(이 실험은 안 보낸다)를
   *   「지워라」고 말한다 — 실험이 늘 때마다 고지가 깎여 나간다. 합집합을 아는 자리가
   *   갖는다: `tests/site.test.js` 의 「방침이 받는다는 것은 적어도 한 실험이 실제로 보낸다」.
   *   (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
   */
});

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
test('보고서에 안 실리는 것은 제출물에 들어가지 않는다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const { reduce } = await import('../src/sim/rules.js');
  let st = initialState(2);
  st = reduce(st, { type: 'POUR_GLUCOSE', payload: { pct: 10 } }).state;
  const json = JSON.stringify(payloadOf(st, {}, 'solo'));
  for (const key of ['bench', 'log', 'history', 'seed', 'readStages', 'trialSeq', 'undosLeft', 'step', 'tidy']) {
    assert.ok(!json.includes(`"${key}"`), `제출물에 ${key} 가 들어 있습니다`);
  }
});

test('되돌리기 기록은 제출물에 들어가지 않는다', async () => {
  const { payloadOf } = await import('../src/ui/report.js');
  const { reduce } = await import('../src/sim/rules.js');
  let st = initialState(2);
  st = reduce(st, { type: 'POUR_GLUCOSE', payload: { pct: 10 } }).state;
  st = reduce(st, { type: 'SAVE_NOTE', payload: { step: 'q2', text: '지울 글' } }).state;
  assert.ok(st.session.history.length > 0, '되돌리기 기록이 쌓이지도 않았습니다');

  const payload = payloadOf(st, {}, 'solo');
  assert.equal(payload.state.session.history, undefined, 'history 가 제출물에 있습니다');
  assert.ok(!JSON.stringify(payload).includes('"history"'));
});

test('방침에 이 실험에 없는 기구가 적혀 있지 않다', () => {
  // 「배율·초점」이 실제로 그렇게 남아 있었다. 다른 실험 문장이 흘러 들어온 것을 잡는다.
  const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '');
  const OTHER = [
    '배율', '초점', '현미경', '슬라이드', '덮개 유리', '바나나', '녹말',
    // 이 저장소는 카탈레이스 실험의 뼈대에서 왔다. 그쪽 낱말이 특히 잘 새어 들어온다 —
    // 실제로 방침 제2조에 「수조 온도, pH, 과산화수소수 농도, 감자즙 농도」가 그대로 남아 있었다.
    '과산화수소', '감자즙', '카탈레이스', '완충 용액', '수조', '원반',
  ];
  for (const word of OTHER) {
    assert.ok(!html.includes(word),
      `개인정보처리방침에 이 실험에 없는 말이 있습니다: 「${word}」`);
  }
});

/*
 * ── 「방침에 있어야 할 대목이 다 있다」는 **사이트로 옮겼다** ──────────
 *
 * 이 검사는 `privacy.html` 하나만 읽고 이 실험 이야기를 전혀 안 한다. 방침은 사이트에
 * 하나뿐이므로 실험 여덟이 저마다 같은 것을 재면 **여덟 벌 중복**이고, 표제 문구를
 * 다듬을 때 여덟 군데가 동시에 운다. `tests/site.test.js` 가 한 번만 잰다.
 * (`/Volumes/T7/Projects/CLAUDE.md` 의 dorms 요건 목록이 여기서 기계로 확인된다)
 */

test('방침의 조 번호가 1부터 빠짐없이 이어지고, 본문 참조가 실재하는 조를 가리킨다', () => {
  const html = readFileSync(new URL('../../../privacy.html', import.meta.url), 'utf8');
  const headings = [...html.matchAll(/<h2>제(\d+)조/g)].map((m) => Number(m[1]));
  assert.deepEqual(headings, headings.map((_, i) => i + 1),
    `조 번호가 이어지지 않습니다: ${headings.join(', ')}`);

  const body = html.replace(/<h2>[^<]*<\/h2>/g, ' ');
  const refs = [...new Set([...body.matchAll(/제(\d+)조/g)].map((m) => Number(m[1])))];
  const dangling = refs.filter((n) => !headings.includes(n));
  assert.deepEqual(dangling, [],
    `본문이 없는 조를 가리킵니다: ${dangling.map((n) => `제${n}조`).join(', ')}`);
});

/**
 * **`import.meta.env` 를 통째로 읽지 않는가.** (형태는 정본 `banana-lab` 것을 그대로 씀)
 *
 * 객체째 잡으면 vite 가 정적 분석을 포기하고 접두사에 걸리는 값을 **전부** 번들에 박는다.
 * Vercel 은 시스템 변수를 `VITE_VERCEL_*` 로 자동 노출하므로 **커밋한 사람의 실명**과
 * 커밋 메시지가 배포본에 실려 나갔다. 실제로 스물한 개가 박혀 있었다.
 *
 * 배포본 쪽은 `scripts/check-build.mjs` 가 **내려받아** 본다. **둘 다 있어야 한다** —
 * 소스가 멀쩡해도 빌드가 다르면 앞엣것만으로는 못 보고, 배포 전에는 뒤엣것을 못 돌린다.
 *
 * 뒤에 `.이름` 이 안 붙은 것만 잡으므로 `import.meta.env.DEV` 는 안 걸린다.
 * **`import.meta.env?.DEV` 는 걸린다** — 물음표가 끼면 vite 가 그 형태를 못 찾고
 * 통째로 바꾸기 때문이다 (catalase 가 `main.js` 에서 그 꼴을 찾았다).
 */
test('소스가 import.meta.env 를 통째로 읽지 않는다', () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
    return e.isDirectory() ? walk(full) : (e.name.endsWith('.js') ? [full] : []);
  });
  const bad = [];
  for (const file of walk(new URL('../src/', import.meta.url))) {
    const src = strip(readFileSync(file, 'utf8'));
    const bare = src.match(/import\.meta\.env(?!\s*\.\s*[A-Za-z_$])/g) ?? [];
    if (bare.length) bad.push(`${file.pathname.split('/src/')[1]} (${bare.length}곳)`);
  }
  assert.deepEqual(bad, [],
    `import.meta.env 를 통째로 읽는 자리가 있습니다: ${bad.join(' · ')}\n`
    + '  → 키를 하나씩 집으세요. 물음표(?.)도 안 됩니다 — vite 는 글자 그대로를 찾아 바꿉니다.');
});
