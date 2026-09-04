/**
 * 배포되는 HTML 페이지 — **브라우저를 안 열면 아무도 모르는 자리.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 이 저장소에서 실제로 겪었다. 검사 198개가 전부 초록불이고 브라우저 검사 94건까지
 * 통과한 상태에서, `teacher.html` 과 `privacy.html` 의 `<title>` 이 **바나나인 채로
 * 남아 있었다.** 개인정보처리방침 본문에도 남의 실험 이름과 「슬라이드 상태」가 있었다.
 * `canonical` 과 `og:url` 은 아예 **바나나랩의 배포 주소**를 가리키고 있었다 —
 * 검색엔진에 "이 페이지는 저 사이트의 사본" 이라고 말하는 셈이다.
 *
 * 옆 세션(osmosis-lab)이 같은 자리에서 물려 이 검사를 만들었고, 허브 세션이
 * 이 저장소에도 남아 있다고 알려 줘서 가져왔다. 낱말 목록만 이 실험 것으로 바꿨다.
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

/**
 * 다른 실험들의 id. **자기 id 는 스스로 뺀다.**
 *
 * 손으로 관리하는 목록이면 저장소마다 자기 이름을 빼 두어야 하는데, 그걸 잊으면
 * **나중에 자기 배포 주소를 넣는 순간 빨간불이 난다** — 맞는 일을 했는데 검사가
 * 막아서는 꼴이고, 그러면 사람이 검사를 꺼 버린다.
 * `manifest.id` 로 거르면 그 함정이 구조적으로 안 생긴다 (허브 세션이 쓰는 방식).
 */
const OTHER_EXPERIMENTS = [
  'banana', 'micrometer', 'osmosis', 'catalase',
  'chromatography', 'fermentation', 'centrifuge', 'germination',
].filter((id) => id !== manifest.id);

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

const read = (name) => readFileSync(
  new URL(SITE_WIDE.has(name) ? `../../../${name}` : `../${name}`, import.meta.url), 'utf8');
/** 화면 CSS 는 여덟 실험이 함께 쓰는 한 파일에 있다 (docs/09-uniformity.md §1). */
const readShell = () => readFileSync(new URL('../../../packages/lab-kit/style/shell.css', import.meta.url), 'utf8');

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
  // 바나나랩에서 물려받은 것 + 현미경 시절의 기구. 이 실험에는 하나도 없다.
  const absent = /바나나|녹말|전분|지질|지방|아이오딘|수단\s*Ⅲ|청람|선홍|현미경|덮개 유리|받침 유리|스포이트|핀셋|재물대|대물렌즈|배율/;
  const bad = [];
  for (const name of PAGES) {
    for (const line of visible(read(name)).split('\n')) {
      if (absent.test(line)) bad.push(`${name}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [],
    `이 실험에 없는 재료가 배포되는 페이지에 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

test('다른 실험의 배포 주소를 가리키지 않는다', () => {
  // `canonical` 과 `og:url` 이 남의 주소를 가리키면 검색엔진에는
  // "이 페이지는 저 사이트의 사본" 이라고 말하는 셈이고, 링크 미리보기도 그쪽으로 간다.
  // **틀린 주소는 없는 주소보다 나쁘다** — 배포 주소가 정해질 때까지는 아예 두지 않는다.
  const bad = [];
  for (const name of PAGES) {
    for (const [, url] of visible(read(name)).matchAll(/(?:href|content)="(https?:\/\/[^"]+)"/g)) {
      if (new RegExp(OTHER_EXPERIMENTS.join('|')).test(url)) {
        bad.push(`${name}: ${url}`);
      }
    }
  }
  assert.deepEqual(bad, [], `다른 실험의 주소가 남아 있습니다:\n  ${bad.join('\n  ')}`);
});

/* ------------------------------------------------------------------ *
 * 크로뮴이 **못 재는** CSS — 그래서 소스에서 본다
 *
 * `-webkit-touch-callout` 은 계산값에도 CSSOM 에도 안 들어간다. **파싱 단계에서 버린다.**
 * 그러니 브라우저 검사에서 「걸린 규칙 없음」이 나와도 그건 **안 걸린 것이 아니라
 * 못 재는 것**이다. 그걸 모르고 재면 「없다」가 나오고, **멀쩡한 CSS 를 지우러 간다** —
 * 틀린 표를 만드는 것보다 나쁘다.
 *
 * 「재고 → 쓰고 → 검사」 앞에 한 겹이 더 있다:
 * **「재려는 것을 이 도구가 잴 수 있는가」를 먼저 본다.**
 *
 *     잴 수 있는 것   touch-action · user-select     → 브라우저 검사
 *     **못 재는 것**  -webkit-touch-callout          → **여기 (커밋 게이트)**
 *
 * (허브 세션이 두 번 헛짚고 알려 줬다.)
 * ------------------------------------------------------------------ */

test('실험대는 길게 눌러도 돋보기·글자 고르기가 안 뜬다 (소스에서 본다)', () => {
  const html = readShell();
  const stage = html.match(/\.bench-stage\s*\{[^}]*\}/s)?.[0] ?? '';
  assert.ok(stage, '.bench-stage 규칙을 못 찾았습니다 — 이 검사가 헛돕니다');

  assert.match(stage, /-webkit-touch-callout\s*:\s*none/,
    '실험대 무대에 -webkit-touch-callout:none 이 없습니다 — 아이폰에서 길게 누르면 돋보기가 뜹니다');
  assert.match(stage, /user-select\s*:\s*none/, '글자 고르기가 막혀 있지 않습니다');
  assert.match(html, /\.bench-stage\s*\*\s*\{[^}]*-webkit-touch-callout\s*:\s*none/s,
    '무대 **안쪽 요소**에는 안 걸려 있습니다 — 배경 그림을 길게 누르면 그대로 납니다');

  // ★ `touch-action:none` 이면 그 위에서 밀 때 **쪽이 안 넘어간다.**
  assert.doesNotMatch(stage, /touch-action\s*:\s*none/,
    '무대에 touch-action:none 이 걸렸습니다 — 실험대 위에서 밀면 쪽이 안 넘어갑니다');
  assert.match(stage, /touch-action\s*:\s*manipulation/, 'touch-action 이 manipulation 이 아닙니다');
});

test('탐구 노트에는 글자 고르기를 막지 않는다 — 붙여넣기가 죽는다', () => {
  const html = readShell();
  for (const sel of ['#notebook', '#note-panel']) {
    const rule = html.match(new RegExp(`\\${sel}\\s*\\{[^}]*\\}`, 's'))?.[0] ?? '';
    assert.doesNotMatch(rule, /user-select\s*:\s*none/,
      `${sel} 에 user-select:none 이 걸렸습니다 — 학생이 적은 것을 복사·붙여넣기 못 합니다`);
    assert.doesNotMatch(rule, /-webkit-touch-callout\s*:\s*none/,
      `${sel} 에 touch-callout 이 막혔습니다 — 길게 눌러 붙여넣기가 죽습니다`);
  }
});
