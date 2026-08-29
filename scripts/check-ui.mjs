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

import { mkdirSync, readFileSync } from 'node:fs';

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
/*
 * ★ **`.catch` 의 기본값이 통과 쪽이면 「없다」와 「닫혔다」가 같아진다.**
 *
 * `catch(() => true)` 였다. `#zoom` 이 아예 없어도(화면이 안 그려졌어도) `true` 가 되어
 * 「닫힌다」가 통과한다. **앞 조건으로 받치는 것보다 기본값을 바꾸는 쪽이 낫다** —
 * 위험을 지키는 것이 아니라 없앤다.
 *
 *     .catch(() => '')  뒤에 `.includes(…)`   → 안전 (빈 값은 못 통과)
 *     .catch(() => null) 뒤에 `!== null`       → 안전
 *     .catch(() => true) 뒤에 그 값을 그대로   → **위험**
 *
 * **「기본값이 통과 쪽이냐」 하나로 갈린다.** `grep "\.catch(() =>"` 로 훑어
 * **truthy 인 것만** 손보면 된다.
 * (웨이브 3 의 fermentation 이 잡고, 웨이브 2 의 osmosis 가 이 한 줄로 갈랐다)
 */
const closed = await page.$eval('#zoom', (el) => el.hidden).catch(() => null);
const focusBack = await page.evaluate(() => document.activeElement?.dataset?.id ?? null);
record(closed === true, 'Esc 로 확대 뷰가 닫힌다',
  closed === null ? '★ #zoom 이 화면에 없다' : `hidden=${closed}`);
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
    return { over: d.scrollWidth - d.clientWidth, wide: document.querySelector('.start-card')?.getBoundingClientRect().width ?? 0 };
  });
  /*
   * ★ **부등식은 양변이 0이면 저절로 참이다.** 화면이 안 그려지면
   * `scrollWidth - clientWidth` 가 `0 - 0` 이라 「안 삐져나간다」가 그냥 통과한다.
   * 「그 화면이 살아 있는가」를 먼저 찍는다.
   * (웨이브 2 의 osmosis 세션이 보고서 창에서 같은 자리를 찾았다)
   */
  record(flat.wide > 0, `   (앞 조건) 시작 화면 ${w}px — 화면이 실제로 그려졌다`, `너비 ${flat.wide}px`);
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
/*
 * ★ **폭만 주면 720 짜리 세로로 잰다 — 폰에 그런 화면은 없다.**
 *
 * 브라우저 UI 를 빼면 폰의 실제 세로는 568~667 쪽이다. 720 으로 재면 아래쪽에 여유가
 * 생겨서 「안 가림」 이 나온다 — **재는 화면이 학생의 화면과 다른 것**이다.
 * 폭과 높이를 **짝으로** 준다. (웨이브 3 의 centrifuge 세션이 짚었다:
 * 같은 폭에서도 568 은 노트 100 % · 720 은 0 % 로 갈렸다)
 */
const measured = new Map();   // 아래 5.7 에서 PLAYTEST 의 표와 맞댄다
for (const [w, h] of [[320, 568], [375, 667], [390, 664], [430, 568], [600, 700], [768, 700], [1280, 800]]) {
  const t = await browser.newPage({ viewport: { width: w, height: h } });
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
    /*
     * ★ **뒤에 가려진 것은 세지 않는다.**
     *
     * 확대 뷰 같은 모달이 열려 있으면 그 뒤의 실험대 이름표는 **이미 안 보인다.**
     * 그것까지 세면 「토스트가 덮었다」는 숫자가 부풀고, **덮지도 않은 것을 고치러**
     * 간다. 실제로 그럴 뻔했다 — 「숟가락 68 %」 같은 값이 나왔다.
     * 화면 안에 있고 그 자리에서 **실제로 맨 위인 것**만 센다.
     * (웨이브 3 의 germination 세션이 자기 자에서 잡았다)
     */
    const onTop = (el, r) => {
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const hit = document.elementFromPoint(cx, cy);
      return Boolean(hit) && (hit === el || el.contains(hit) || hit.contains(el));
    };
    const worstOf = (sel) => {
      let pct = 0; let who = '';
      for (const el of document.querySelectorAll(sel)) {
        /*
         * ★ **자기 자신은 안 센다.** 닫기 단추(✕)는 말풍선 **안**에 있으니 늘 100 %
         *   겹친다. 그것을 세면 「무엇을 가리는가」가 **자기 단추**로 채워져,
         *   바깥을 무엇을 가리는지 물으려던 검사가 자기 답을 보고 만다.
         *   `a[href]` 처럼 범위가 안 잡힌 선택자가 하나라도 있으면 언젠가 걸린다.
         *   (웨이브 3 의 fermentation 세션이 자기 검사에서 여섯 폭이 한꺼번에
         *    「✕ 100 %」로 빨간불이 나면서 찾았다)
         */
        if (el.closest('#toast-region')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        if (!onTop(el, r)) continue;
        const ov = Math.max(0, Math.min(tb.right, r.right) - Math.max(tb.left, r.left))
                 * Math.max(0, Math.min(tb.bottom, r.bottom) - Math.max(tb.top, r.top));
        const p = ov / (r.width * r.height) * 100;
        if (p > pct) { pct = p; who = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16); }
      }
      return { pct: Math.round(pct), who };
    };
    return {
      bar: worstOf('.bench-bar button'),
      /*
       * ★ **실험대 물건도 잰다 — 여기가 비어 있어서 회귀를 놓쳤다.**
       *
       * 닫기 단추를 달자 긴 문장에서 말풍선이 **160×171 기둥**이 되어 선반의
       * **바나나를 100 % 덮었다.** 그런데 조작 줄 덮임은 69 % → 4 % 로 **좋아진 것처럼**
       * 보였다 — 줄어든 게 아니라 **옮겨 간 것**이었고, 옮겨 간 쪽을 아무도 안 재고 있었다.
       *
       * 「덮임이 줄었다」가 좋은 소식이 아닐 수 있다. **무엇이 대신 덮였는지**를
       * 같이 재야 그 말을 할 수 있다.
       * (웨이브 1 의 micrometer 세션이 자기 저장소에서 먼저 겪고 짚어 주었다)
       */
      token: worstOf('.token'),
      name: worstOf('.token-name'),
      note: worstOf('#note-panel button, #note-panel textarea, .note-tab'),
      /*
       * ★ **넓이 % 가 아니라 「손댈 것을 몇 개나 가리는가」로 잰다.**
       *
       *   앞서는 「노트 덮임 20 % 이하」였다. 그런데 닫기 단추가 붙자 0 % 가 4 % 가 됐고,
       *   그때 **4 를 5 로 늘리는 것은 문턱을 지어내는 것**이다. 지어낸 문턱은 맞는지
       *   아무도 모르는 채 굳고, 다음에 또 넘으면 또 늘리게 된다.
       *
       *   재는 것 자체를 바꾼다 — **가운데가 말풍선에 막힌 것이 몇 개인가.**
       *   여기서 **0 은 「그때 마침 그랬던 값」이 아니라 뜻을 갖는다**:
       *   학생이 손댈 것 중 못 누르는 것이 하나도 없다는 뜻이다.
       *   넓이 숫자는 판정 없이 옆에 그대로 남긴다.
       *   (chromatography 가 자기 저장소에서 같은 자리를 만나 이렇게 바꾸었다)
       */
      blocked: [...document.querySelectorAll('#note-panel button, #note-panel textarea, .note-tab')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return false;
          if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
          const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
          const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
          return Boolean(document.elementFromPoint(cx, cy)?.closest('#toast-region'));
        })
        .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 12)),
      // 조작 단추만 보면 바닥 링크를 놓친다 — centrifuge 가 아래로 내린 뒤 잡은 자리다.
      foot: worstOf('.site-foot a, a[href], .site-foot button'),
      /*
       * ★ **보이는 단추만 센다.** 덮임을 재는 검사는 「숨은 것을 세는」 검사와 증상이
       * 반대다 — 단추가 사라지면 덮인 넓이가 0이 되어 **본 검사가 더 초록불이 된다.**
       * 0 % 는 「안 가렸다」가 아니라 **「거기 없다」**일 수 있다. 앞 조건까지 숨은 것을
       * 세면 그 거짓말을 못 잡는다.
       * (웨이브 1 의 micrometer 세션이 「방향이 반대여서 더 나쁘다」로 짚었다)
       */
      buttons: [...document.querySelectorAll('.bench-bar button')]
        .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length,
    };
  });
  record(!cover.none && cover.buttons > 0, `   (앞 조건) ${w}×${h} 에 토스트와 조작 단추가 둘 다 있다`,
    JSON.stringify(cover));
  /*
   * ★ **양쪽을 다 잰다 — 한쪽만 재면 고침이 문제를 옮기기만 한다.**
   *
   * 조작 줄만 재고 토스트를 아래로 내렸더니, 600px 에서 토스트가 **탐구 노트 위 91 %** 에
   * 올라앉았다 — 이 저장소가 예전에 이미 되돌린 자리다. 실험대에서 한 조작의 결과 문구가
   * 노트 위에 겹쳐 뜨면 어느 쪽 이야기인지 알 수 없다.
   * 여기서는 **가려진 비율을 숫자로 남기고**, 어느 쪽이 나빠지든 빨간불이 나게 둔다.
   * (웨이브 1 의 micrometer 세션이 「그 처방으로는 안 된다」고 되돌려 잰 것을 받았다)
   */
  record(true, `토스트 ${w}×${h} — 무엇을 얼마나 가리는지 (숫자로 남긴다)`,
    `조작 줄 ${cover.bar?.pct ?? 0}% ${cover.bar?.who ?? ''} · 물건 ${cover.token?.pct ?? 0}% ${cover.token?.who ?? ''}`
    + ` · 이름표 ${cover.name?.pct ?? 0}% · 노트 ${cover.note?.pct ?? 0}% · 바닥 ${cover.foot?.pct ?? 0}%`);
  /*
   * ★ **물건을 통째로 덮으면 그것만은 막는다.**
   * 조작 줄은 가려도 손가락이 닿지만(`pointer-events:none`), 물건이 통째로 덮이면
   * **거기 무엇이 있는지조차 모른다.** 절반까지는 남기고, 그 위는 빨간불로 둔다.
   */
  record((cover.token?.pct ?? 0) <= 60,
    `토스트 ${w}×${h} — **실험대 물건을 통째로 덮지 않는다**`,
    `${cover.token?.pct ?? 0}% ${cover.token?.who ?? ''}`);
  record((cover.blocked ?? []).length === 0,
    `토스트 ${w}×${h} — **탐구 노트에서 손댈 것을 하나도 막지 않는다**`,
    (cover.blocked ?? []).length
      ? `★ 막힌 것 ${cover.blocked.length}개: ${cover.blocked.join(' / ')}`
      : `막힌 것 0개 (넓이로는 ${cover.note?.pct ?? 0}% — 판정에는 안 씁니다)`);
  measured.set(`${w}×${h}`, { bar: cover.bar?.pct ?? 0, note: cover.note?.pct ?? 0 });
  await t.close();
}

/* ---------------- 5.7 PLAYTEST 의 덮임 표가 아직 맞는가 ---------------- */
/*
 * ★ **문서에 적어 둔 숫자는 문구보다 더 나쁘게 낡는다.**
 *
 * 낡은 문구는 안 보이면 못 찾고 끝이지만, **낡은 숫자는 틀린 신고를 만들어 낸다** —
 * 선생님이 맞는 값을 보고도 「표와 다르다, 고장이다」로 적어 보내신다. 실제로 어젯밤
 * 인용문이 낡아 없는 버그를 하나 만들어 냈고, 숫자는 그 자리에서 한 발 더 간다.
 * (웨이브 3 의 germination 세션이 자기 수치표에서 짚었다)
 *
 * 그래서 **표를 읽어서 잰 값과 맞대 본다.** 오차는 ±6 %p 로 둔다 — 글꼴 렌더링이
 * 한두 점 흔들리는 것까지 빨간불로 만들면 이 명령을 아무도 안 믿게 된다.
 *
 * ★ **표를 못 읽었으면 초록불이 아니라 빨간불이다.** 「0줄 중 0줄이 맞다」는
 *   여기서도 그대로 나온다 — 표 모양이 바뀌면 이 검사가 조용히 아무것도 안 하게 된다.
 *
 * 세 방향으로 물려 두었다 — **셋 다 안 보면 반쪽만 지킨다**:
 *
 *     문서 숫자만 낡게   PLAYTEST 92 % → 42 %                    빨간불
 *     앱만 바뀜          index.html 의 말풍선 top:14px → bottom   빨간불 (세 줄이 한꺼번에)
 *     표 모양이 바뀜     PLAYTEST 의 × → x                        **앞 조건**이 빨간불
 *
 * 가운데가 **실제로 일어날 일**이다. 문서를 손대는 사람과 앱을 손대는 사람이 다르고,
 * 앱을 손댄 쪽은 문서에 숫자가 있는 줄 모른다.
 * (catalase 가 자기 pH 표에서 세 방향을 다 물리고 「가운데가 내일 아침에 반드시
 *  일어날 일」이라고 짚었다 — 그쪽은 `[확인 필요]` 상수가 곧 바뀔 예정이다)
 */
{
  const doc = readFileSync('PLAYTEST.md', 'utf8');
  /*
   * ★ **「N줄 이상 읽었다」는 앞 조건이 아니다. 「표에 있는 만큼 읽었다」가 앞 조건이다.**
   *
   * 0줄만 막으면 그 사이가 열려 있다 — **한 줄만 모양이 바뀌면 남은 줄만 맞대 보고
   * 초록불**이 난다. 사라진 그 한 줄이 하필 낡은 줄일 수 있다.
   * 그래서 표의 몸통 줄을 **세어서** 읽은 수와 같은지 본다.
   * (웨이브 3 의 germination 세션이 자기 검사에서 `>= 4` 를 이렇게 바꾸고 알려 주었다)
   */
  const body = doc.split('\n');
  const head = body.findIndex((l) => /^\|\s*화면\s*\|/.test(l));
  let inTable = 0;
  for (let i = head + 2; i >= 2 && i < body.length && body[i].startsWith('|'); i += 1) inTable += 1;
  const rows = [...doc.matchAll(/^\|\s*(\d+)\s*×\s*(\d+)\s*\|.*?\*\*(\d+)\s*%\*\*.*?노트\s*(\d+)\s*%/gm)]
    .map((m) => ({ key: `${m[1]}×${m[2]}`, bar: Number(m[3]), note: Number(m[4]) }));
  record(head >= 0 && inTable > 0 && rows.length === inTable,
    '   (앞 조건) PLAYTEST 의 덮임 표를 **빠짐없이** 읽었다',
    `표에 ${inTable}줄 / 읽은 것 ${rows.length}줄 — 다르면 그 줄의 모양이 바뀐 것입니다`);
  const checked = rows.filter((r) => measured.has(r.key));
  record(checked.length > 0, '   (앞 조건) 그 줄들을 실제로 잰 화면이 있다',
    `맞댄 ${checked.length}줄 / 잰 화면 ${[...measured.keys()].join(' ')}`);
  /*
   * ★ **울 때 「무엇을 고치라」와 「붙여 넣을 것」을 준다.**
   *
   * 안 주면 이 검사는 첫 빨간불에서 죽는다. 그날 사람은 바쁘고, 빨간불 하나가
   * 무엇을 하라고 안 말하면 **가장 빠른 길이 검사를 지우는 것**이다.
   * 고칠 것은 거의 언제나 **문서**다 — 잰 값이 지금의 진실이니까.
   * (웨이브 3 의 fermentation 세션이 「붙여 넣을 것을 안 주면 지워진다」로 짚었다)
   */
  const stale = [];
  for (const r of checked) {
    const got = measured.get(r.key);
    const same = Math.abs(got.bar - r.bar) <= 6 && Math.abs(got.note - r.note) <= 6;
    if (!same) stale.push({ ...r, got });
    record(same,
      `PLAYTEST 의 ${r.key} 줄이 아직 맞다 (낡은 숫자는 없는 버그 신고를 만든다)`,
      `문서 조작 ${r.bar}% · 노트 ${r.note}%  /  잰 값 조작 ${got.bar}% · 노트 ${got.note}%`);
  }
  if (stale.length) {
    console.log('\n  ★ 먼저 **왜 바뀌었는지** 보세요. 말풍선 자리를 일부러 옮기신 것이면');
    console.log('     **고칠 것은 이 검사가 아니라 `PLAYTEST.md`** 입니다 — 잰 값이 지금의 진실입니다.');
    console.log('     (일부러 옮긴 것이 아니면 그것이 버그입니다. 노트를 가리는 쪽은 바로 위');
    console.log('      「탐구 노트를 가리지 않는다」가 따로 막고 있으니, 표만 고쳐도 그쪽은 안 샙니다)');
    console.log('     표를 고치실 때 아래 줄로 바꿔 넣으세요:\n');
    for (const r of stale) {
      console.log(`     | ${r.key.replace('×', ' × ')} | 「(다) 재물대에서 내리기」 **${r.got.bar} %** · 탐구 노트 ${r.got.note} % |`);
    }
    console.log('');
  }
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

/*
 * ★ **한 항목도 안 돌았는데 「전부 통과」가 나오던 자리.**
 *
 *   `results` 가 비면 `failed.length` 는 0 이고, 그러면 **「전부 통과」에 exit 0** 이다.
 *   중간에 브라우저가 죽거나 앞쪽에서 터져도 **거기까지만 세고 초록불**이 난다.
 *   오늘 밤 내내 검사 **안**의 「0개 중 0건」을 막았는데, **검사 자신**이 그 모양이었다.
 *   (웨이브 1 의 micrometer 세션이 셋 다 뚫려 있는 것을 찾아 알려 주었다)
 *
 *   바닥은 **지금 세는 것보다 넉넉히 낮게** 둔다 — 항목이 조금 줄었다고 울면
 *   사람이 바닥을 낮추기만 하게 된다. 통째로 안 돈 것만 잡으면 된다.
 */
const FLOOR = 40;   // 지금 54항목. 이보다 크게 줄면 중간에 끊긴 것이다
const failed = results.filter((r) => !r.ok);
if (results.length < FLOOR) {
  console.log(`\n★ ${results.length}항목밖에 못 봤습니다 (바닥 ${FLOOR}) — 중간에 끊긴 것입니다.`);
  console.log('  「전부 통과」가 아닙니다. 위 출력에서 어디서 멈췄는지 보세요.\n');
  process.exit(1);
}
console.log(failed.length ? `\n${failed.length}건 미달\n` : `\n전부 통과 (${results.length}항목)\n`);
process.exit(failed.length ? 1 : 0);
