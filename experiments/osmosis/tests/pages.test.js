/**
 * 배포되는 HTML 페이지 — **브라우저를 안 열면 아무도 모르는 자리.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 실험을 다 만들고 검사 192개가 전부 초록불인 상태에서, `index.html` 의 `<title>` 이
 * **바나나인 채로 남아 있었다.** 브라우저 탭에도, 채팅방에 붙인 링크의 미리보기에도
 * 남의 실험 이름이 떴다. `canonical` 과 `og:url` 은 아예 **바나나랩의 배포 주소**를
 * 가리키고 있었다 — 검색엔진에 "이 페이지는 저 사이트의 사본" 이라고 말하는 셈이다.
 * 개인정보처리방침 본문에도 남아 있었다.
 *
 * 앱 안 화면은 전부 `src/ui/strings.js` 를 거치므로 그쪽은 검사가 잡는다.
 * **HTML 파일의 머리말만 그 그물 밖에 있었다.** 그래서 이 파일이 있다.
 *
 * 복제해서 새 실험을 만들 때 **이 검사를 가장 먼저** 돌려 보라.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UI } from '../src/ui/strings.js';
import { manifest } from '../src/manifest.js';
import { initialState } from '../src/sim/state.js';
import { cellsInField } from '../src/sim/optics.js';
import { CELL_SAP_PCT } from '../src/sim/osmosis.js';

/*
 * 배포본에 실제로 실리는 페이지. 하네스(harness.html)는 빌드에 안 들어간다.
 *
 * ★ **실험 것과 사이트 것이 서로 다른 자리에 있다.**
 *   `index.html`·`PLAYTEST.md`·`docs/` 는 이 실험 폴더에, **개인정보처리방침은 사이트
 *   전체 것**이라 뿌리에 있다. 실험이 여덟이어도 방침은 하나다 — 실험마다 복제하면
 *   고칠 때 여덟 번 고치게 되고, 하나를 빠뜨리면 학생이 보는 방침과 실제가 달라진다.
 *
 * ★ **선생님 화면은 여기 없다.** `teacher.js` 가 여덟 저장소에서 **바이트까지 같아서**
 *   `packages/lab-kit/` 으로 올렸다 — 사이트에 하나면 된다. 이 목록에 `teacher.html` 을
 *   되살리지 말고 **사이트 검사**(`tests/site.test.js`)에 맡긴다.
 *   (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 */
const SITE_WIDE = new Set(['privacy.html']);
const PAGES = ['index.html'];   // 방침은 사이트 것 — tests/site.test.js 가 본다

const read = (name) => readFileSync(
  new URL(SITE_WIDE.has(name) ? `../../../${name}` : `../${name}`, import.meta.url), 'utf8');

/**
 * 사람 눈에 닿는 부분만 남긴다 — `<style>` · `<script>` · 주석을 걷어낸다.
 *
 * 주석을 남겨 두면 「바나나랩에서 물려받았다」 처럼 **맞는 설명**에 걸려 헛발질한다.
 * 검사가 한 번이라도 헛발질하면 그 뒤로 아무도 안 믿는다 (`PLAYBOOK.md` §8).
 */
function visible(src) {
  return src
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

const titleOf = (src) => (src.match(/<title>([\s\S]*?)<\/title>/i) ?? [])[1]?.trim();
const metaOf = (src, key) =>
  (src.match(new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]+content="([^"]*)"`, 'i')) ?? [])[1];

/*
 * ── 「점검 설정」과 「저장소 이름」 두 검사는 **사이트로 옮겼다** ──────────
 *
 * 둘 다 `dorms-check.config.json` · `package.json` 이라는 **사이트 파일 하나**를 보고
 * 「내 이름이 있어야 한다」고 말한다. 실험이 하나일 때는 맞는 말이었지만, 실험이 둘
 * 이상이 되는 순간 **반드시 서로 모순**이 된다 — banana 는 banana 를, osmosis 는
 * osmosis 를 가리키라고 한다. 같은 파일에 대해서다.
 *
 * 중복이면 하나를 지우면 되는데 **모순은 주인을 정해야** 풀린다. 사이트 것이므로
 * `tests/site.test.js` 가 갖는다 — 거기서 잃지 않고 다시 세웠다:
 *   · 실험마다 `manifest.id` 가 폴더 이름과 같다 (주소가 폴더에서 나온다)
 *   · `package.json` 의 이름이 실험 하나를 가리키지 않는다
 *   · 점검 설정이 사이트 이름을 쓰고, 남의 배포본을 가리키지 않는다
 *
 * ★ **아래 「다른 실험의 배포 주소」 검사의 눈을 지키던 것이 이 자리였다.** 그 검사는
 *   `manifest.id` 로 자기 주소를 골라내 목록에서 빼는데, 갓 복제한 저장소는 id 가 아직
 *   `'banana'` 라 **가장 남아 있기 쉬운 바나나랩 주소가 「자기 주소」로 분류돼 빠졌다**
 *   (germination 세션이 실제로 겪었다). 그 울타리는 사라지지 않았다 — 사이트 검사의
 *   「id = 폴더 이름」이 **더 센 울타리**다. 폴더가 `osmosis` 인데 id 가 `banana` 면
 *   거기서 먼저 빨간불이 난다.
 * (합치기 3단계에서 banana·micrometer 가 같은 길을 갔다 — `MERGE-AND-DEPLOY.md` §3단계)
 */

test('모든 페이지의 <title> 이 이 실험의 이름을 말한다', () => {
  // 탭에 뜨는 이름이다. 앱 안 제목과 어긋나 있어도 화면 안쪽만 보면 절대 모른다.
  for (const name of PAGES) {
    const title = titleOf(read(name));
    assert.ok(title, `${name} 에 <title> 이 없습니다`);
    assert.ok(title.includes(UI.appTitle),
      `${name} 의 <title> 이 앱 제목과 다릅니다:\n  탭  "${title}"\n  앱  "${UI.appTitle}"`);
  }
});

test('링크 미리보기(og)가 이 실험의 이름을 말한다', () => {
  // 선생님이 링크를 채팅방에 붙이면 이것이 카드로 뜬다. 남의 실험 이름이 뜨면
  // 학생들은 링크를 열기 전에 다른 실험인 줄 안다.
  const src = read('index.html');
  const ogTitle = metaOf(src, 'og:title');
  assert.ok(ogTitle, 'index.html 에 og:title 이 없습니다');
  assert.ok(ogTitle.includes(UI.appTitle),
    `og:title 이 앱 제목과 다릅니다: "${ogTitle}"`);
});

test('배포되는 페이지에 이 실험에 없는 재료가 남아 있지 않다', () => {
  // 복제본에서 이름표를 갈아 끼울 때 **HTML 머리말이 반드시 남는다.**
  // 주석은 보지 않는다 — 「바나나랩에서 물려받았다」 는 맞는 설명이다.
  const absent = /바나나|녹말|전분|지질|지방|아이오딘|수단\s*Ⅲ|청람|선홍/;
  const bad = [];
  for (const name of PAGES) {
    for (const line of visible(read(name)).split('\n')) {
      if (absent.test(line)) bad.push(`${name}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [],
    `이 실험에 없는 재료가 배포되는 페이지에 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

/**
 * 형제 실험들. **자기 id 는 스스로 뺀다** — 그래야 저장소마다 목록을 손볼 데가 없다.
 *
 * 손으로 적은 금지 목록을 두었더니 새 실험이 늘 때마다 여덟 저장소를 다 고쳐야 했다.
 * `manifest.id` 로 거르면 이 파일을 그대로 복제해 써도 된다.
 * (banana-lab 허브 세션이 짚어 준 것. 여기 목록은 허브의 실험 명단과 같아야 한다.)
 */
const OTHER_EXPERIMENTS = [
  'banana', 'micrometer', 'osmosis', 'catalase',
  'chromatography', 'fermentation', 'centrifuge', 'germination',
].filter((id) => id !== manifest.id);

test('다른 실험의 배포 주소를 가리키지 않는다', () => {
  // `canonical` 과 `og:url` 이 남의 주소를 가리키면 검색엔진에는
  // "이 페이지는 저 사이트의 사본" 이라고 말하는 셈이고, 링크 미리보기도 그쪽으로 간다.
  // **틀린 주소는 없는 주소보다 나쁘다** — 배포 주소가 정해질 때까지는 아예 두지 않는다.
  //
  // **자기 주소는 막지 않는다.** 맞는 일을 했는데 검사가 막아서면 사람은 검사를 꺼 버리고,
  // 그러면 남의 주소도 같이 못 잡게 된다. 아래 검사가 그 방향까지 본다.
  const banned = new RegExp(OTHER_EXPERIMENTS.join('|'));
  const bad = [];
  for (const name of PAGES) {
    for (const [, url] of visible(read(name)).matchAll(/(?:href|content)="(https?:\/\/[^"]+)"/g)) {
      if (banned.test(url)) bad.push(`${name}: ${url}`);
    }
  }
  assert.deepEqual(bad, [], `다른 실험의 주소가 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

test('자기 배포 주소는 막지 않는다', () => {
  // **되돌림 확인은 양방향이어야 한다.** 남의 주소로 빨간불을 본 것만으로는 반쪽이다 —
  // 배포할 때 자기 주소를 넣었는데 검사가 막아서면, 사람은 그 검사를 지운다.
  const banned = new RegExp(OTHER_EXPERIMENTS.join('|'));
  for (const url of [
    `https://${manifest.id}-lab.vercel.app/`,
    `https://${manifest.id}.example.kr/`,
    `https://${manifest.id}-inquiry-based-virtual-lab.vercel.app/`,
  ]) {
    assert.equal(banned.test(url), false, `자기 배포 주소를 막고 있습니다: ${url}`);
  }
});

/* ---------------- 규칙표가 없어진 것을 아직 적고 있지 않은가 ---------------- */
/*
 * 안전 판정을 걷어내면서 `session.violations` · `tidy` 가 상태에서 사라졌는데,
 * **규칙표 셋은 그대로 남아 있었다** — `docs/03` 의 상태 표, `docs/04` 의 「안전 규칙만은
 * 예외」 절, `docs/06` 의 「자기 평가 = 리커트 + 안전·정리 기록」.
 * 규칙표는 **다음 사람이 보고 만드는 것**이라, 그대로 두면 걷어낸 기능이 되살아난다.
 * (허브 · centrifuge 가 「안전을 걷어낸 저장소는 문서가 둘, 픽스처까지 셋」으로 짚었다.)
 *
 * ★ 문구가 아니라 **식별자**를 맞댄다. 문구를 맞대는 검사는 주석에 남은 옛 문장과 맞아
 *   헛돌지만(허브 ③), 식별자는 `initialState()` 에 있거나 없거나 둘 중 하나다.
 * ★ 표의 **첫 칸만** 읽는다. 설명 칸에는 `captures[].at` 같은 하위 값이 나오는데
 *   그건 session 의 칸이 아니다.
 * ★ 반대 방향(상태에 있는데 표에 없는 것)은 **안 잰다** — `step` 이 표에 없다.
 *   여기서 재는 것은 「없어진 것이 문서에 남아 있는가」 하나다.
 */
test('상태 모델 표의 session 칸이 실제 상태에 다 있다', () => {
  const doc = readFileSync(new URL('../docs/03-state-model.md', import.meta.url), 'utf8');
  const keys = new Set(Object.keys(initialState(1, 1).session));
  const named = [];
  let rows = 0, rowsRead = 0;
  let inTable = false;
  for (const line of doc.split('\n')) {
    if (/^\|\s*`level`/.test(line)) inTable = true;
    else if (inTable && !line.trim().startsWith('|')) break;
    if (!inTable) continue;
    rows += 1;
    const first = line.split('|')[1] ?? '';
    const got = [...first.matchAll(/`([a-zA-Z][a-zA-Z0-9_]*)`/g)].map((m) => m[1]);
    if (got.length) rowsRead += 1;
    named.push(...got);
  }
  // ★ **앞 조건은 「몇 개 읽었나」가 아니라 「표에 있는 만큼 읽었나」다.**
  //   `named.length >= 8` 로 두었더니, **한 줄만 모양이 바뀌어도 남은 줄만 맞대 보고
  //   초록불**이었다. 줄 수와 읽은 줄 수가 같아야 한다. (허브 · germination)
  assert.equal(rowsRead, rows,
    `표 ${rows}줄 중 ${rowsRead}줄에서만 칸 이름을 읽었습니다 — 못 읽은 줄은 맞대지도 못합니다.\n`
    + '   표의 첫 칸을 `이름` 꼴로 적어 주세요 (설명 칸은 안 읽습니다).');
  assert.ok(rows >= 5, `표를 ${rows}줄밖에 못 찾았습니다 — 훑기가 표를 놓쳤습니다`);

  const gone = named.filter((n) => !keys.has(n));
  // ★ 울 때 **무엇을 고칠지**까지 말한다. 다만 **문서를 고치라고 먼저 말하지 않는다** —
  //   상태에서 칸이 사라진 것이 **진짜 회귀**일 수 있고, 그때 문서를 고치면 버그를 문서에
  //   받아 적는 셈이 된다. 순서를 못박아 둔다. (허브 · fermentation)
  assert.deepEqual(gone, [],
    `상태에 없는 칸이 규칙표에 적혀 있습니다: ${gone.join(', ')}\n`
    + '   ① **먼저 `src/sim/state.js` 의 initialState() 를 보세요.** 그 칸이 실수로\n'
    + '      빠진 것이면 고칠 곳은 문서가 아니라 상태입니다.\n'
    + '   ② 일부러 걷어낸 것이면 `docs/03-state-model.md` 의 그 줄을 지우고,\n'
    + '      `docs/04` · `docs/06` 에도 같은 것이 남아 있는지 함께 보세요 —\n'
    + '      규칙표는 다음 사람이 보고 만드는 것이라, 남겨 두면 걷어낸 기능이 되살아납니다.');
});

/* ---------------- PLAYTEST 에 적힌 **숫자**가 실제 값과 맞는가 ---------------- */
/*
 * 낡은 **문구**는 안 보이면 못 찾고 끝이지만, **낡은 숫자는 틀린 신고를 만들어 낸다** —
 * 사람이 **맞는 값을 보고도** 「고장이다」로 적어 보낸다. (허브 · germination)
 *
 * ★ **값 자체가 문서의 내용인 것만 맞댄다.** 「검사 181개가 통과하는 동안」 같은 지나가는
 *   수치까지 맞대면 자리마다 오차 폭을 저울질하게 된다. 아래 셋은 **사람이 그 숫자를 보고
 *   화면과 견주는** 값이라 틀리면 곧장 틀린 신고가 된다.
 * ★ **학생이 보는 길과 같은 값인가**를 먼저 쟀다 (centrifuge 의 단서). `cellsInField` 는
 *   시야 원에 **걸친 것까지** 세는 수이고, 실제로 그려진 것을 원과 맞대 보면
 *   4배 660 · 10배 108 · 40배 7 로 맞는다. 그리지 않는 수를 문서에 적어 둔 것이 아니다.
 *   (렌더러는 끌어서 볼 여백까지 더 그리고 원으로 자른다 — 40배에서 그린 벽은 50개다.)
 */
test('PLAYTEST 에 적힌 숫자가 실제 값과 맞는다', () => {
  const doc = read('PLAYTEST.md');
  const claims = [
    { what: '400배 시야의 세포 수', re: /세포가 (\d+)개뿐/, actual: cellsInField(40) },
    { what: '40배 시야의 세포 수', re: /세포는 (\d+)개나/, actual: cellsInField(4) },
    { what: '세포액 농도', re: /지금은 (\d+) % 로 두어/, actual: CELL_SAP_PCT },
  ];
  for (const c of claims) {
    const m = doc.match(c.re);
    // 앞 조건 — 문장을 못 찾으면 **맞대지도 못한 채 통과**한다.
    assert.ok(m, `${c.what} — PLAYTEST 에서 그 문장을 못 찾았습니다.\n`
      + `   문장을 다듬으셨으면 이 검사의 정규식(${c.re})도 함께 고쳐 주세요.`);
    assert.equal(Number(m[1]), c.actual,
      `PLAYTEST 의 ${c.what} 가 ${m[1]} 인데 실제 값은 ${c.actual} 입니다.\n`
      + '   ① **먼저 값이 왜 바뀌었는지 보세요.** 광학 상수는 고정입니다\n'
      + '      (`src/sim/optics.js` · tests/optics.test.js). 실수로 바뀐 것이면\n'
      + '      고칠 곳은 문서가 아닙니다.\n'
      + '   ② 일부러 바꾼 것이면 PLAYTEST 의 그 숫자를 고치고, **그 숫자가 이끄는 판정**도\n'
      + '      함께 보세요 — 「400배는 비율을 잴 수 없다」는 결론이 그 수에 기대고 있습니다.');
  }
});

/* ---------------- 문서가 가리키는 배포 주소가 실제와 같은가 ---------------- */
/*
 * 사람이 이 문서를 보고 **그 주소를 연다.** 주소가 어긋나면 남의 실험을 열어 보고
 * 「고쳤다더니 그대로다」라고 적게 된다 — 문서 하나로 밤새 한 일이 통째로 없던 일이 된다.
 *
 * ★ 앞서 여기 「배포 주소는 아직 안 넣었습니다」가 남아 있었다. 실제로는 `canonical` 이
 *   벌써 들어가 있었다. **「아직 안 했다」고 적힌 낡은 항목**은 사람에게 없는 일을 시킨다.
 * ★ 세 곳(`index.html` 의 canonical · og:url · `PLAYTEST.md`)이 **같은 주소**여야 한다.
 */
test('PLAYTEST 가 가리키는 배포 주소가 index.html 과 같다', () => {
  const html = read('index.html');
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const og = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
  assert.ok(canon, 'index.html 에 canonical 이 없습니다');
  assert.equal(og, canon, 'canonical 과 og:url 이 다릅니다');

  const host = new URL(canon).host;
  const doc = read('PLAYTEST.md');
  const inDoc = [...doc.matchAll(/https?:\/\/([a-z0-9.-]+\.vercel\.app)/g)].map((m) => m[1]);
  // 앞 조건 — 문서가 주소를 하나도 안 적었으면 **맞댈 것이 없어 저절로 통과**한다.
  assert.ok(inDoc.length > 0,
    'PLAYTEST 에 배포 주소가 없습니다 — 사람이 어디를 열어야 할지 모릅니다.');
  const wrong = [...new Set(inDoc)].filter((h) => h !== host);
  assert.deepEqual(wrong, [],
    `PLAYTEST 가 다른 주소를 가리킵니다: ${wrong.join(', ')} (실제 ${host})\n`
    + '   ① **먼저 `index.html` 의 canonical 이 맞는지 보세요.** 거기가 틀렸으면\n'
    + '      검색엔진에 「이 페이지는 저 사이트의 사본」이라고 말하는 셈입니다.\n'
    + '   ② canonical 이 맞으면 PLAYTEST 의 주소를 고치세요.');
});

/* ---------------- 편집 모드 안내가 실제 동작과 반대로 말하지 않는가 ---------------- */
/*
 * 배치 편집은 **미세하게 조정하려고** 여는 화면이다. 그런데 안내가
 * 「선반 또는 작업면에 **자동으로 붙습니다**」라고 말하고 있었다 — 붙이는 기능은 걷어냈고
 * `placeFreely` 가 **무대 밖으로만** 못 나가게 자르는데도.
 * 이 문장을 보면 **안 붙는 것을 버그로 여기게 된다.** 걷어낸 기능을 설명하는 문장이
 * 화면에 남으면, 고친 것이 고장으로 신고된다. (허브가 다섯 랩에서 같은 자리를 찾았다.)
 *
 * ★ 문장만 재면 다음에 누가 붙이는 기능을 되살렸을 때 못 잡는다. **동작도 함께 못박는다** —
 *   `placeFreely` 가 있고, 그것이 선에 붙이지 않는다는 것(자르기만 한다).
 *   실제로 끌어 놓아 보는 것은 `scripts/check-bench.mjs` 가 한다
 *   (「코드가 at(x, y) 로 나왔다」 — 선 위가 아니면 shelf()/surface() 가 아니라 at() 이 나온다).
 */
test('편집 모드 안내가 「자동으로 붙는다」고 말하지 않는다', () => {
  assert.ok(UI.edit?.note, '   (앞 조건) 편집 모드 안내 문장을 찾았다');
  assert.doesNotMatch(UI.edit.note, /자동으로 붙습니다|자동으로 붙고/,
    `편집 안내가 「자동으로 붙는다」고 말합니다: ${UI.edit.note}\n`
    + '   ① **먼저 실제로 붙는지 보세요.** `src/ui/bench.js` 의 placeFreely 가\n'
    + '      무대 밖으로만 자르면 붙지 않는 것이고, 그러면 고칠 곳은 문장입니다.\n'
    + '   ② 정말 붙는다면 그쪽이 잘못입니다 — 미세 조정을 하러 여는 화면입니다.');

  // ★ **이름만 보면 몸통이 바뀐 것을 못 본다.** 이름을 두고 안에서 다시 선에 붙이면
  //   「placeFreely 가 있다」는 그대로 통과한다. 붙이려면 **선 상수**(SHELF_MM ·
  //   SURFACE_MM)가 몸통 안에 있어야 하므로 그것으로 본다. (허브 · 정본이 같은 자리에서 걸렸다)
  //   `layoutCode()` 는 그 상수를 써도 된다 — 거기서는 **붙이는 것이 아니라
  //   「마침 선 위에 있는가」를 보고 shelf(x) 로 적을지 at(x, y) 로 적을지 고른다.**
  const bench = read('src/ui/bench.js');
  const body = bench.match(/function placeFreely\([^)]*\)\s*\{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(body, 'placeFreely 를 못 찾았습니다 — 끌어 놓은 자리를 그대로 두는 함수입니다.\n'
    + '   붙이는 방식으로 되돌리셨으면 편집 안내 문장도 함께 고쳐야 합니다.');
  assert.doesNotMatch(body, /SHELF_MM|SURFACE_MM/,
    'placeFreely 가 선 상수를 씁니다 — 다시 선에 붙이고 있을 수 있습니다.\n'
    + `   몸통: ${body.trim().slice(0, 120)}\n`
    + '   ① 정말 붙이기로 되돌리셨으면 편집 안내 문장(`UI.edit.note`)도 함께 고치세요.\n'
    + '   ② 아니라면 자르기(clamp)만 남기세요.');
  assert.match(body, /clamp\(/, 'placeFreely 가 무대 밖으로 나가는 것을 안 막습니다');
});

/* ---------------- 아이폰에서 길게 눌러도 돋보기가 안 뜨는가 ---------------- */
/*
 * 아이폰에서 실험대 물건을 **길게 눌러 끌면** 돋보기가 뜨고 글자가 골라졌다 —
 * 끌기가 그 밑에서 죽는다. 교실 기기의 절반이 태블릿이라 이게 안 되면 통째로 못 쓴다.
 *
 * ★ **이것만은 「돌아가는 것에 묻는다」가 안 통한다.**
 *   `-webkit-touch-callout` 은 크로뮴이 **파싱 단계에서 버린다** — 계산값에도 CSSOM 에도
 *   안 들어간다. 「걸린 규칙 없음」은 **안 걸린 것이 아니라 못 재는 것**이다.
 *   그래서 여기서만은 **소스 글자가 유일한 근거**다. (허브가 두 번 헛짚고 알려 왔다.)
 *   나머지 둘(touch-action · user-select)은 화면에서 잰다 — `scripts/check-bench.mjs`.
 *
 * ★ **탐구 노트에는 걸면 안 된다.** 글칸에서 붙여넣기와 고르기가 죽는다.
 *   그쪽은 화면에서 `auto` 인지 잰다.
 */
test('실험대 무대에 아이폰 길게 누르기 막이가 걸려 있다', () => {
  const html = read('index.html');
  const block = html.match(/\.bench-stage\s*\{[^}]*\}/)?.[0];
  assert.ok(block, '   (앞 조건) .bench-stage 규칙을 찾았다');
  assert.match(block, /-webkit-touch-callout\s*:\s*none/,
    '.bench-stage 에 -webkit-touch-callout:none 이 없습니다 — 아이폰에서 길게 누르면\n'
    + '   돋보기가 뜨고 끌기가 죽습니다. **크로뮴으로는 이걸 못 재므로** 소스로만 압니다.');
  assert.doesNotMatch(block, /touch-action\s*:\s*none/,
    '.bench-stage 에 touch-action:none 을 걸면 그 위에서 세로로 밀 때 **쪽이 안 넘어갑니다** —\n'
    + '   실험대가 화면을 거의 다 차지하는 폰에서는 갇힙니다. manipulation 을 쓰세요.');
});
