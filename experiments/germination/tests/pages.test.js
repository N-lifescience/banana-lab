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
 * **이 실험에 없는** 재료·기구·현상 낱말. 복제하면 여기만 갈아 끼운다.
 *
 * 이 실험(발아 중인 콩)에 있는 것은 콩·바이오챔버·센서·BTB 뿐이다.
 * 앞줄의 바나나·현미경·슬라이드가 **복제해 온 쪽의 것**이라 여기 함께 적는다 —
 * 물려받은 머리말이 남아 있으면 브라우저 탭에 남의 실험 이름이 뜬다.
 */
const OTHER_MATERIALS =
  /바나나|녹말|지질|아이오딘|수단 Ⅲ|현미경|슬라이드|덮개 유리|받침 유리|스포이트|핀셋/;

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

/*
 * ── 「저장소 이름」·「점검 설정」·「canonical」 은 **사이트로 옮겼다** ──────
 *
 * 셋 다 `package.json`·`dorms-check.config.json`·배포 주소라는 **사이트 것 하나**를 보고
 * 「내 이름이 있어야 한다」고 말한다. 실험이 하나일 때는 맞는 말이었지만, 실험이 둘
 * 이상이 되는 순간 **반드시 서로 모순**이 된다 — banana 는 banana 를, 이 실험은 자기를
 * 가리키라고 한다. 같은 파일에 대해서다.
 *
 * 중복이면 하나를 지우면 되는데 **모순은 주인을 정해야** 풀린다. `tests/site.test.js` 의
 * 「저장소 이름이 사이트 이름이다」·「점검 설정이 사이트 이름을 쓴다」·
 * 「실험마다 canonical 이 이 사이트의 자기 자리를 가리킨다」가 여덟 몫을 한 번에 잰다.
 * (합치기 3·4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
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
  // 학생들은 열기도 전에 다른 실험인 줄 안다.
  const ogTitle = metaOf(read('index.html'), 'og:title');
  assert.ok(ogTitle, 'index.html 에 og:title 이 없습니다');
  assert.ok(ogTitle.includes(UI.appTitle), `og:title 이 앱 제목과 다릅니다: "${ogTitle}"`);
});

test('배포되는 페이지에 다른 실험의 재료가 남아 있지 않다', () => {
  // 복제본에서 이름표를 갈아 끼울 때 **HTML 머리말이 반드시 남는다.**
  // **먼저 「실제로 쟀는가」를 찍는다.** 「센 결과가 0이면 통과」는 이 검사 방식의
  // 기본 성질이라, 쪽을 하나도 못 읽어도 초록불이 난다 — 안 잰 것과 구별되지 않는다.
  const bad = [];
  let lines = 0;
  for (const name of PAGES) {
    for (const line of visible(read(name)).split('\n')) {
      lines++;
      if (OTHER_MATERIALS.test(line)) bad.push(`${name}: ${line.trim().slice(0, 90)}`);
    }
  }
  /*
   * [앞 조건] **수를 새 현실에 맞춰 다시 쟀다.** 예전에는 쪽이 셋(`index`·`teacher`·
   * `privacy`)이라 「둘 이상 · 100줄 넘게」였는데, 뒤의 둘이 **사이트 것**으로 가면서
   * 이 실험이 가진 쪽은 `index.html` 하나가 됐다. 눈에 닿는 줄은 37개다
   * (다른 실험도 37~53개 — `<style>`·`<script>` 를 걷어낸 값이다).
   * **통과시키려고 낮춘 것이 아니라, 재는 대상이 줄어서 다시 잰 것이다.**
   */
  assert.ok(PAGES.length >= 1 && lines >= 20,
    `쟀다고 할 수 없습니다 — 쪽 ${PAGES.length}개 · 줄 ${lines}개`);
  assert.deepEqual(bad, [],
    `다른 실험의 재료가 배포되는 페이지에 남아 있습니다 (줄 ${lines}개 중 ${bad.length}건):\n  ${bad.join('\n  ')}`);
});

test('다른 실험의 배포 주소를 가리키지 않는다', () => {
  // `canonical` 과 `og:url` 이 남의 주소를 가리키면 검색엔진에는
  // "이 페이지는 저 사이트의 사본" 이라고 말하는 셈이고, 링크 미리보기도 그쪽으로 간다.
  // **틀린 주소는 없는 주소보다 나쁘다** — 배포 주소가 정해질 때까지는 아예 두지 않는다.
  // **앞 조건** — 볼 주소가 하나도 없으면 이 검사는 아무것도 안 잰 것이다.
  // 실제로 겪었다: `dorms-check.config.json` 이 남의 주소를 가리키는 동안에도 이 검사는
  // 초록불이었다 — 그 파일이 **이 검사가 보는 자리 밖**이었기 때문이다.
  const bad = [];
  let urls = 0;
  for (const name of PAGES) {
    for (const [, url] of visible(read(name)).matchAll(/(?:href|content)="(https?:\/\/[^"]+)"/g)) {
      urls++;
      if (EXPERIMENT_IDS.some((id) => url.includes(id))) bad.push(`${name}: ${url}`);
    }
  }
  assert.ok(urls > 0, `볼 주소가 하나도 없습니다 — 이 검사가 아무것도 안 쟀습니다 (쪽 ${PAGES.length}개)`);
  assert.deepEqual(bad, [],
    `다른 실험의 주소가 남아 있습니다 (주소 ${urls}개 중 ${bad.length}건):\n  ${bad.join('\n  ')}`);
});
