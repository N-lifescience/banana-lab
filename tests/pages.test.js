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
const PAGES = ['index.html', 'teacher.html', 'privacy.html'];

/**
 * **이 실험에 없는** 재료·현상 낱말. 복제하면 여기만 갈아 끼운다.
 * 바나나랩에는 바나나·녹말·지질이 있으므로, 여기 적는 것은 다른 실험들의 것이다.
 */
const OTHER_MATERIALS =
  /삼투|원형질|적양파|카탈레이스|과산화수소|크로마토그래피|엽록소|잔토필|효모|발효|맹관부|원심분리|적혈구|버피코트|접안 마이크로미터|대물 마이크로미터/;

/** 다른 실험의 저장소 이름. 자기 id 는 뺀다 — 자기 주소를 가리키는 것은 옳다. */
const EXPERIMENT_IDS = [
  'banana', 'micrometer', 'osmosis', 'catalase',
  'chromatography', 'fermentation', 'centrifuge', 'germination',
].filter((id) => id !== manifest.id);

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

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
