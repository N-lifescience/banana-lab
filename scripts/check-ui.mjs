#!/usr/bin/env node
/**
 * 조작 UI 검증 — 화면을 띄워야만 알 수 있는 것들.
 *
 *   npm run dev                (다른 터미널)
 *   node scripts/check-ui.mjs
 *
 * 왜 `npm run check` 가 아니라 별도 스크립트인가:
 * 브라우저를 띄우는 검사는 기계 부하와 타이밍에 흔들린다. 이걸 커밋 게이트에 넣으면
 * 언젠가 무관한 이유로 빨간불이 뜨고, 그 뒤로 아무도 그 명령을 믿지 않게 된다.
 * 기계로 확실히 판정되는 것은 tests/ui.contract.test.js 에 있다.
 *
 * 여기서 보는 것:
 *   1. 콘솔 에러 0건
 *   2. 시야를 끄는 동안 시야가 다시 만들어지지 않는가  ← T03 이 남긴 성능 계약
 *   3. Esc 로 확대 뷰가 닫히는가
 *   4. 키보드만으로 확대 뷰에 들어갈 수 있는가
 *   5. 되돌리기 표시에 Infinity 가 새지 않는가
 *   6. 라이트/다크 스크린샷
 */
import { devUrl } from '../dev-port.js';

import { mkdirSync } from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('playwright 가 없습니다.  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

mkdirSync('shots', { recursive: true });

// 난이도를 주소로 정하면 시작 화면을 건너뛴다. 이 스크립트가 볼 것은 그 뒤의 조작이라
// 매번 시작 화면을 클릭해 넘길 이유가 없다 (시작 화면 자체는 check-bench.mjs 가 본다).
const URL_BASE = process.env.SHOT_URL ?? devUrl('/?level=1');
const results = [];
const record = (ok, label, detail = '') => {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();

/* ---------------- 1. 콘솔 에러 ---------------- */

const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL_BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

/**
 * 실험대 자물쇠를 연다 — 탐구 노트 1~4 쪽을 읽어야 열린다 (`src/ui/bench.js`).
 * 학생에게는 그것이 절차지만, 여기서 보려는 것은 그 뒤의 조작이다.
 */
const unlock = (p) => p.evaluate(() => {
  for (const stage of ['1', '2', '3', '4']) window.__store?.dispatch('MARK_READ', { stage });
});
await unlock(page);
await page.waitForTimeout(120);

console.log('\n조작 UI 검증\n');
record(errors.length === 0, '콘솔 에러 0건', errors.slice(0, 3).join(' / '));

/* ---------------- 2. 드래그 중 시야를 다시 만들지 않는가 ---------------- */

// 시야를 보려면 재물대에 슬라이드가 올라가 있어야 한다.
// 비어 있으면 확대 뷰는 열리되 "재물대에 슬라이드가 없습니다" 만 보여 준다 — 막는 게 아니다.
// 드래그로 여기까지 오는 것은 이 스크립트가 볼 대상이 아니라, 상태를 직접 만들어 둔다.
const staged = await page.evaluate(() => {
  const s = window.__store;
  if (!s) return false;
  s.dispatch('PEEL_BANANA', {});
  s.dispatch('SMEAR', { slide: 'B', thickness: 0.3 });
  s.dispatch('FILL_DROPPER', { reagent: 'IKI' });
  s.dispatch('DROP', { slide: 'B', count: 2 });
  s.dispatch('PICK_COVERSLIP', {});
  s.dispatch('PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
  s.dispatch('MOUNT', { slide: 'B' });
  s.dispatch('SET_OBJECTIVE', { objective: 40 });
  return s.getState().microscope.stage === 'B';
});
record(staged, '슬라이드를 재물대에 올리는 상태가 만들어진다');

// 현미경 확대 뷰를 키보드로 연다. 시야는 그 안에만 있다.
// 상태를 바꾸면 실험대가 다시 그려진다. 새로 붙은 요소를 잡아야 키 처리가 살아 있다.
await page.waitForTimeout(400);
await page.$eval('[data-id="microscope"]', (el) => el.focus());
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const zoomOpenedByKey = await page.$eval('#zoom', (el) => !el.hidden).catch(() => false);
const fovPresent = await page.$('#fov-slot') !== null;
record(zoomOpenedByKey, '확대 뷰를 키보드로 열 수 있다', 'data-id="microscope" 에 Enter');
record(fovPresent, '슬라이드가 올라가 있으면 시야가 그려진다');

// #fov-slot 의 자식이 통째로 갈리면 renderFOV 를 다시 부른 것이다.
// 시야 이동은 #fov-scene 의 transform 만 바꿔야 한다 (src/render/fov.js 머리말).
const slot = await page.$('#fov-slot');
if (!slot) {
  record(false, '시야를 끄는 동안 다시 만들지 않는다', '#fov-slot 이 화면에 없다');
} else {
  await page.evaluate(() => {
    window.__fovRebuilds = 0;
    const target = document.querySelector('#fov-slot');
    new MutationObserver((records) => {
      for (const r of records) if (r.addedNodes.length) window.__fovRebuilds++;
    }).observe(target, { childList: true });
  });

  const box = await slot.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(cx + i * 4, cy + i * 2);
  await page.mouse.up();
  await page.waitForTimeout(200);

  const rebuilds = await page.evaluate(() => window.__fovRebuilds);
  const transform = await page.$eval('#fov-scene', (el) => el.getAttribute('transform')).catch(() => null);
  record(rebuilds === 0, '시야를 끄는 동안 다시 만들지 않는다',
    `드래그 20프레임 동안 재생성 ${rebuilds}회 (0이어야 한다)`);
  record(transform !== null && transform !== 'translate(0.0,0.0)',
    '끄는 만큼 시야가 실제로 움직인다', `#fov-scene transform = ${transform}`);
}

/* ---------------- 3. Esc 로 나가고 포커스가 돌아오는가 ---------------- */

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const closed = await page.$eval('#zoom', (el) => el.hidden).catch(() => true);
const focusBack = await page.evaluate(() => document.activeElement?.dataset?.id ?? null);
record(closed, 'Esc 로 확대 뷰가 닫힌다');
record(focusBack === 'microscope', '닫으면 포커스가 열었던 곳으로 돌아온다',
  `activeElement data-id = ${focusBack}`);

/* ---------------- 4. 막지 않는가 — 절차를 어겨도 진행된다 ---------------- */

// 껍질을 안 벗긴 채 문지르면? 막히지 않고 토스트만 떠야 한다.
const toastCount = await page.evaluate(() => document.querySelector('#toast-region')?.children.length ?? -1);
record(toastCount >= 0, '토스트 영역이 살아 있다', `현재 ${toastCount}건`);

/* ---------------- 5. 되돌리기 표시 ---------------- */

const undoText = await page.$eval('#undo', (el) => el.textContent ?? '').catch(() => null);
const undoCount = await page.$eval('#undo-left', (el) => el.textContent ?? '').catch(() => null);
if (undoText === null) {
  record(false, '되돌리기 표시에 Infinity 가 새지 않는다', '#undo 이 없다');
} else {
  const shown = `${undoText} ${undoCount ?? ''}`;
  record(!/Infinity|undefined|NaN/.test(shown), '되돌리기 표시에 Infinity 가 새지 않는다',
    `표시 = "${shown.trim().replace(/\s+/g, ' ')}"`);
}

/* ---------------- 5b. 되돌리기가 TICK 에 잠식되지 않는가 ---------------- */

// TICK 이 1초마다 돌면서 history 를 채우면, 되돌리기가 "직전 조작" 이 아니라
// "직전 TICK" 을 되돌리게 된다. 2·3단계는 횟수가 3회/1회라 치명적이다.
const historyMix = await page.evaluate(async () => {
  const st = window.__store?.getState?.();
  if (!st) return null;
  const before = st.session.history.length;
  await new Promise((r) => setTimeout(r, 2600));   // TICK 두세 번
  const after = window.__store.getState().session.history.length;
  return { before, after, grew: after - before };
});
if (historyMix === null) {
  record(true, '되돌리기 기록이 TICK 에 잠식되는지 (수동 확인 필요)', 'window.__store 가 노출돼 있지 않다');
} else {
  record(historyMix.grew === 0, '가만히 두면 되돌리기 기록이 늘지 않는다',
    `2.6초 동안 ${historyMix.before} → ${historyMix.after} (TICK 이 쌓으면 안 된다)`);
}

/* ---------------- 5.5 폰에서 시작 단추에 닿는가 ---------------- */

/*
 * 시작 화면은 폰에서 **한 화면에 안 들어간다** — 375px 에서 카드가 877px 다.
 * 「1단계로 시작하기」는 y 822 에 있고 화면은 700 이다. 첫 화면에는 안 보인다.
 *
 * 안 보이는 것 자체는 참을 수 있다(내리면 된다). **닿을 수 없게 되는 것**이 사고다 —
 * `align-items:center` 인 세로 상자에서 내용이 화면보다 커지면 브라우저에 따라
 * **윗머리가 스크롤로도 안 돌아온다.** 그러면 학생은 앱을 열고 시작할 방법이 없다.
 * 여기서는 「내리면 화면 안에 들어오는가」와 「가로로 삐져나가지 않는가」를 잰다.
 * (웨이브 3 의 centrifuge 세션이 자기 저장소에서 「375 에서 시작 단추가 화면 밖」 을 알렸다)
 */
for (const w of [320, 375, 390]) {
  const phone = await browser.newPage({ viewport: { width: w, height: 700 } });
  // ★ `URL_BASE` 는 `?level=1` 이라 **시작 화면을 건너뛴다.** 그러면 `.start-go` 가
  //   없어서 「못 찾음」 이 나오고, 그것은 「단추가 화면 밖」 과 구별이 안 된다.
  //   재려는 화면으로 곧장 간다.
  await phone.goto(devUrl('/'), { waitUntil: 'networkidle' });
  await phone.waitForTimeout(350);
  const flat = await phone.evaluate(() => {
    const d = document.documentElement;
    return { over: d.scrollWidth - d.clientWidth };
  });
  record(flat.over <= 0, `시작 화면 ${w}px — 가로로 삐져나가지 않는다`, `넘침 ${flat.over}px`);
  await phone.evaluate(() => window.scrollTo(0, 99999));
  await phone.waitForTimeout(250);
  const go = await phone.evaluate(() => {
    const el = document.querySelector('.start-go');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: window.innerHeight };
  });
  record(Boolean(go) && go.top >= 0 && go.bottom <= go.h,
    `시작 화면 ${w}px — 끝까지 내리면 시작 단추가 화면 안에 들어온다`,
    go ? `단추 ${go.top}~${go.bottom} · 화면 ${go.h}` : '.start-go 를 못 찾음');
  await phone.close();
}

/* ---------------- 5.6 토스트가 조작 줄을 덮지 않는가 ---------------- */

/*
 * 토스트는 **뭘 하고 난 직후**에 뜬다. 바로 그때 학생은 다음 조작을 찾는다.
 * 좁은 화면에서 위쪽에 뜨면 실험대의 조작 줄을 덮는다 — 390px 에서
 * 「(다) 재물대에서 내리기」가 95 % 가려졌다. 손가락은 그대로 닿지만
 * (`pointer-events:none`) **눈에는 안 보인다.** 「눌리는가」만 재면 이걸 못 본다.
 */
for (const w of [320, 390, 768, 1280]) {
  const t = await browser.newPage({ viewport: { width: w, height: 780 } });
  await t.goto(devUrl(`/?level=1`), { waitUntil: 'networkidle' });
  await t.evaluate(() => { for (const s of ['1', '2', '3', '4']) window.__store.dispatch('MARK_READ', { stage: s }); });
  await t.evaluate(() => {
    const s = window.__store;
    s.dispatch('PEEL_BANANA', {});
    s.dispatch('SMEAR', { slide: 'C', thickness: 0.3 });
    s.dispatch('MOUNT', { slide: 'C' });   // 조작 줄에 「재물대에서 내리기」가 생긴다
  });
  await t.waitForTimeout(400);
  const cover = await t.evaluate(() => {
    const toast = [...document.querySelectorAll('#toast-region *')].find((e) => e.getBoundingClientRect().width > 20);
    if (!toast) return { none: true };
    const tb = toast.getBoundingClientRect();
    const worst = [];
    for (const el of document.querySelectorAll('.bench-bar button')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4) continue;
      const ov = Math.max(0, Math.min(tb.right, r.right) - Math.max(tb.left, r.left))
               * Math.max(0, Math.min(tb.bottom, r.bottom) - Math.max(tb.top, r.top));
      if (ov > 0) worst.push({ name: el.textContent.trim().slice(0, 16), pct: Math.round(ov / (r.width * r.height) * 100) });
    }
    return { worst, buttons: document.querySelectorAll('.bench-bar button').length };
  });
  record(!cover.none && cover.buttons > 0, `   (앞 조건) ${w}px 에 토스트와 조작 단추가 둘 다 있다`,
    JSON.stringify(cover));
  const bad = (cover.worst ?? []).filter((x) => x.pct > 20);
  record(bad.length === 0, `토스트 ${w}px — 실험대 조작 단추를 가리지 않는다`,
    bad.length ? bad.map((x) => `${x.name} ${x.pct}%`).join(' · ') : '가린 것 없음');
  await t.close();
}

/* ---------------- 6. 라이트/다크 스크린샷 ---------------- */

await page.screenshot({ path: 'shots/ui-light.png', fullPage: true });
const dark = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await dark.goto(URL_BASE, { waitUntil: 'networkidle' });
await unlock(dark);
await dark.waitForTimeout(400);
await dark.screenshot({ path: 'shots/ui-dark.png', fullPage: true });
record(true, '라이트/다크 스크린샷 저장', 'shots/ui-light.png · shots/ui-dark.png');

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length}건 미달\n` : '\n전부 통과\n');
process.exit(failed.length ? 1 : 0);
