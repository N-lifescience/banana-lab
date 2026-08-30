/**
 * 배포되는 HTML 페이지 — **브라우저를 안 열면 아무도 모르는 자리.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 복제해서 만든 실험 둘이 같은 자리를 밟았다. 실험을 다 만들고 검사가 **전부 초록불**인
 * 상태에서 `index.html` 의 `<title>` 이 바나나인 채로 남아 있었다 — 브라우저 탭에도,
 * 채팅방에 붙인 링크의 미리보기에도 남의 실험 이름이 떴다. 한쪽은 `canonical` 과
 * `og:url` 이 아예 **바나나랩의 배포 주소**를 가리키고 있었다. 검색엔진에
 * "이 페이지는 저 사이트의 사본이니 저쪽을 색인하라" 고 말하는 태그다.
 *
 * 앱 안 화면은 전부 `src/ui/strings.js` 를 거치므로 그쪽은 검사가 잡는다.
 * **HTML 파일의 머리말만 그 그물 밖에 있었다.** 그래서 이 파일이 있다.
 *
 * ── 복제해서 새 실험을 만들 때 ──────────────────────────────────────
 * 이 파일에서 실험에 매인 것은 **`OTHER_MATERIALS` 하나뿐**이다.
 * 거기에 **이 실험에 없는** 재료 낱말을 적는다. 나머지는 그대로 통한다.
 * (`NEW-EXPERIMENT.md` §3.0)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UI } from '../src/ui/strings.js';
import { manifest } from '../src/manifest.js';

/** 배포본에 실제로 실리는 페이지. 하네스(harness.html)는 빌드에 안 들어간다. */
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
const PAGES = ['index.html'];   // 방침·선생님 화면은 사이트 것 — tests/site.test.js 가 본다

/**
 * **이 실험에 없는** 재료·현상 낱말. 복제하면 여기만 갈아 끼운다.
 *
 * 이 실험에는 효모·발효관·맹관부·포도당·수산화칼륨이 있으므로, 여기 적는 것은 다른 실험들의 것이다.
 * **이 저장소는 카탈레이스 실험의 뼈대를 가져와 만들었으므로** 그쪽 낱말
 * (감자즙 · 과산화수소 · 완충 용액 · 수조)을 특히 촘촘히 적어 둔다 —
 * 실제로 `index.html` 의 description 과 방침 제2조에 그대로 남아 있었다.
 */
const OTHER_MATERIALS =
  /삼투|원형질|적양파|카탈레이스|과산화수소|감자즙|완충 용액|거름종이 원반|수조|바나나|녹말|수단 ?Ⅲ|현미경|배율|크로마토그래피|엽록소|잔토필|원심분리|적혈구|버피코트|접안 마이크로미터|대물 마이크로미터/;

/** 다른 실험의 저장소 이름. 자기 id 는 뺀다 — 자기 주소를 가리키는 것은 옳다. */
const EXPERIMENT_IDS = [
  'banana', 'micrometer', 'osmosis', 'catalase',
  'chromatography', 'fermentation', 'centrifuge', 'germination',
].filter((id) => id !== manifest.id);

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
  // 학생들은 열기도 전에 다른 실험인 줄 안다.
  const ogTitle = metaOf(read('index.html'), 'og:title');
  assert.ok(ogTitle, 'index.html 에 og:title 이 없습니다');
  assert.ok(ogTitle.includes(UI.appTitle), `og:title 이 앱 제목과 다릅니다: "${ogTitle}"`);
});

test('배포되는 페이지에 다른 실험의 재료가 남아 있지 않다', () => {
  // 복제본에서 이름표를 갈아 끼울 때 **HTML 머리말이 반드시 남는다.**
  const bad = [];
  for (const name of PAGES) {
    for (const line of visible(read(name)).split('\n')) {
      if (OTHER_MATERIALS.test(line)) bad.push(`${name}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [],
    `다른 실험의 재료가 배포되는 페이지에 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

test('다른 실험의 배포 주소를 가리키지 않는다', () => {
  // `canonical` 과 `og:url` 이 남의 주소를 가리키면 검색엔진에는
  // "이 페이지는 저 사이트의 사본" 이라고 말하는 셈이고, 링크 미리보기도 그쪽으로 간다.
  // **틀린 주소는 없는 주소보다 나쁘다** — 배포 주소가 정해질 때까지는 아예 두지 않는다.
  const bad = [];
  for (const name of PAGES) {
    for (const [, url] of visible(read(name)).matchAll(/(?:href|content)="(https?:\/\/[^"]+)"/g)) {
      if (EXPERIMENT_IDS.some((id) => url.includes(id))) bad.push(`${name}: ${url}`);
    }
  }
  assert.deepEqual(bad, [], `다른 실험의 주소가 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

/*
 * **아이폰 길게 누르기 — 브라우저 검사로는 못 재는 자리.**
 *
 * 선생님이 아이폰에서 실험대를 길게 누르셨더니 돋보기가 뜨고 글자가 선택됐다.
 * 물건을 끌려던 손이 그것을 만난다. 막는 것은 `-webkit-touch-callout:none` 인데 —
 *
 * ── 왜 여기(소스)에서 재는가 ───────────────────────────────────────
 * **크로뮴은 `-webkit-touch-callout` 을 파싱 단계에서 버린다.** 계산값에도 CSSOM 에도
 * 안 들어간다. 그래서 브라우저 검사는 「걸린 규칙 없음」을 내는데, 그것은 **안 걸린 것이
 * 아니라 못 재는 것**이다. 그 둘을 못 가르면 「고쳤는데 검사가 없다고 한다」가 되고,
 * 사람은 멀쩡한 CSS 를 지운다. (`revert-check` 의 `status: null` 과 같은 뿌리다)
 *
 * 잴 수 있는 것(`touch-action`·`user-select`)은 화면 검사가 폰 폭에서 잰다.
 */
test('아이폰에서 실험대를 길게 눌러도 돋보기·글자 선택이 안 뜬다 (소스)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  const stage = html.match(/\.bench-stage\{[^}]*\}/s)?.[0];
  assert.ok(stage, '`.bench-stage` 규칙을 못 찾았습니다 — 이 검사가 아무것도 안 지키고 있습니다');

  for (const need of ['-webkit-touch-callout:none', 'user-select:none', '-webkit-user-select:none']) {
    assert.ok(stage.includes(need), `\`.bench-stage\` 에 ${need} 이 없습니다 — ${stage.slice(0, 90)}`);
  }
  /*
   * **`manipulation` 이어야 하고, 특히 `none` 이면 안 된다.** 무대에 `touch-action:none` 을
   * 걸면 그 위에서 밀 때 쪽이 안 넘어간다 — 이웃 실험이 그렇게 했다가 되돌렸다.
   *
   * 「있는가」와 「none 이 아닌가」를 **두 줄로 나눠 놓았더니 뒤엣것이 영영 안 돌았다** —
   * `none` 으로 바꾸면 앞줄이 먼저 울어서다. 값을 뽑아 **한 줄로** 본다.
   */
  const touch = stage.match(/touch-action:\s*([a-z-]+)/)?.[1];
  assert.equal(touch, 'manipulation',
    `\`.bench-stage\` 의 touch-action 이 ${touch ?? '(없음)'} 입니다`
    + ' — none 이면 그 위에서 밀 때 쪽이 안 넘어가고, 없으면 길게 누르기가 그대로 뜹니다');

  // 자식까지 꺼 줘야 물건 위에서 길게 눌러도 안 뜬다.
  assert.ok(/\.bench-stage\s*\*\{[^}]*-webkit-touch-callout:\s*none/s.test(html),
    '`.bench-stage *` 에 -webkit-touch-callout:none 이 없습니다 — 물건 위에서는 그대로 뜹니다');

  /*
   * **탐구 노트에는 절대 걸지 않는다.** 거기는 학생이 글을 적는 곳이라
   * `user-select:none` 을 걸면 붙여넣기와 글자 고르기가 죽는다.
   */
  const note = html.match(/#notebook\{[^}]*\}/s)?.[0] ?? '';
  assert.ok(!/user-select:\s*none/.test(note),
    '탐구 노트에 user-select:none 이 걸렸습니다 — 붙여넣기가 죽습니다');
});
