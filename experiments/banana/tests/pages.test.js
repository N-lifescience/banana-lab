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
import { readFileSync, existsSync } from 'node:fs';
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

/**
 * 다른 실험의 저장소 이름. 자기 id 는 뺀다 — 자기 주소를 가리키는 것은 옳다.
 *
 * **이 「자기는 뺀다」 가 함정을 하나 만든다.** 갓 복제한 저장소는 `manifest.id` 가 아직
 * `'banana'` 라, **가장 남아 있기 쉬운 바나나랩 주소가 「자기 주소」로 분류돼 안 잡힌다.**
 * 실제로 웨이브 3 의 한 저장소가 바나나랩 주소를 도로 넣어 보고도 초록불을 받았다.
 *
 * 그래서 아래 「이 저장소가 자기 이름을 알고 있다」 가 먼저 있어야 한다 —
 * `manifest.id` 를 갈지 않으면 그 검사가 **먼저** 빨간불을 낸다.
 */
const EXPERIMENT_IDS = [
  'banana', 'micrometer', 'osmosis', 'catalase',
  'chromatography', 'fermentation', 'centrifuge', 'germination',
].filter((id) => id !== manifest.id);

/*
 * ★ **실험 것과 사이트 것이 서로 다른 자리에 있다.**
 *   `index.html`·`teacher.html` 은 이 실험 폴더에 있고, **개인정보처리방침은 사이트 전체
 *   것**이라 뿌리에 있다. 실험이 여덟이어도 방침은 하나다 — 실험마다 복제하면
 *   고칠 때 여덟 번 고치게 된다. (합치기 2단계, 2026-08-29)
 */
const SITE_WIDE = new Set(['privacy.html']);
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

test('점검 설정이 자기 앱을 가리킨다 — 남의 배포본을 보고 판정하지 않는다', () => {
  /*
   * `dorms-check.config.json` 은 복제해 오면 **바나나랩을 가리킨 채로 남는다.**
   * 그 상태로 `/dorms` 를 돌리면 **남의 배포본을 열어 보고 이 저장소에 대한 판정을 낸다** —
   * 개인정보처리방침도 응답 헤더도 남의 것을 읽는다. 다섯 저장소가 받은 초록불이
   * **한 사이트를 다섯 번 검사한 것**이었다.
   *
   * **검사가 없었던 것보다 있는 것처럼 보였던 것이 나쁘다.**
   *
   * ── 「남의 것 목록」을 두지 않는다 ─────────────────────────────────
   * 무엇이 남의 주소인지 목록으로 들고 다니면 **그 목록이 또 복제된다.**
   * 대신 **자기를 가리키는지**만 본다 — 이름은 앱 제목과 같아야 하고, 주소는
   * 비었거나(`null`) 자기 id 를 담아야 한다. 목록이 필요 없고 저장소마다 저절로 맞는다.
   * (웨이브 2 의 osmosis 세션이 이 모양을 냈다)
   *
   * **이름만 갈고 주소를 안 간 상태**도 잡아야 한다. 복제 도중 한쪽만 고치면 실제로 그 꼴이 된다.
   */
  const cfgPath = new URL('../../../dorms-check.config.json', import.meta.url);
  if (!existsSync(cfgPath)) return;   // 이 저장소가 점검 대상이 아니면 잴 것이 없다
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

  assert.equal(cfg.app?.name, UI.appTitle,
    `점검 설정의 이름이 이 앱과 다릅니다 — "${cfg.app?.name}" 이 아니라 "${UI.appTitle}" 이어야 합니다`);

  const url = cfg.app?.url;
  assert.ok(url === null || url === undefined || url === '' || String(url).includes(manifest.id),
    `점검 설정이 남의 주소를 가리킵니다: ${url}\n`
    + '  → 배포 전에는 null 이 정직합니다. **비어 있으면 사람이 알고, 남의 주소면 아무도 모릅니다.**');
});

test('이 저장소가 자기 이름을 알고 있다', () => {
  // **아래 주소 검사가 눈이 멀지 않게 지키는 검사다.**
  // 주소 검사는 `manifest.id` 를 「자기 주소」로 보고 뺀다. 복제한 뒤 id 를 안 갈면
  // 그 값이 `'banana'` 인 채라, **하필 가장 남아 있기 쉬운 바나나랩 주소를 못 본다.**
  // package.json 의 이름은 복제 절차 첫머리에서 갈리므로, 둘이 어긋나면 여기서 잡힌다.
  const name = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).name;
  assert.equal(name, `${manifest.id}-lab`,
    `package.json 의 이름과 manifest.id 가 어긋납니다:\n`
    + `  package.json  "${name}"\n  manifest.id   "${manifest.id}"\n`
    + '  → 복제한 저장소라면 src/manifest.js 의 id 를 이 실험 것으로 가세요.\n'
    + '    그 전까지는 「다른 실험의 배포 주소를 가리키지 않는다」 검사가 바나나랩 주소를 못 봅니다.');
});

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
