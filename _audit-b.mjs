/** 임시 UI 감사 2부 — 노트 7단계 / 난이도 / 레이아웃. 끝나면 지운다. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5177';
mkdirSync('_audit-shots', { recursive: true });
const browser = await chromium.launch();
const log = (...a) => console.log(...a);

function hookErrors(page, bag) {
  page.on('console', (m) => { if (m.type() === 'error') bag.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => bag.push(`pageerror: ${String(e)}`));
}

/** 캡처 3장을 실제 조작 없이 만들어 넣는다 (슬라이드별로 다른 상태). */
const makeCaptures = (page) => page.evaluate(() => {
  const d = (t, p) => window.__store.dispatch(t, p);
  for (const [id, reagent, obj, dia] of [['A', null, 4, 0.6], ['B', 'IKI', 10, 0.5], ['C', 'SUDAN3', 40, 0.9]]) {
    d('SMEAR', { slide: id, thickness: 0.3 });
    if (reagent) { d('FILL_DROPPER', { reagent }); d('DROP', { slide: id, count: 2 }); }
    d('PICK_COVERSLIP', {}); d('PLACE_COVERSLIP', { slide: id, angleDeg: 45 });
    d('MOUNT', { slide: id });
    d('SET_OBJECTIVE', { objective: obj });
    d('SET_DIAPHRAGM', { value: dia });
    d('CAPTURE', {});
    d('UNMOUNT', {});
  }
  return window.__store.getState().session.captures.length;
});

/* ---------- 4. 노트 7단계 ---------- */
log('\n########## 4. 탐구 노트 7단계 ##########\n');
for (const withCaps of [false, true]) {
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  hookErrors(page, errs);
  await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (withCaps) log('\n--- 캡처 있음 ---'), log('캡처 수:', await makeCaptures(page));
  else log('--- 캡처 없음 ---');
  await page.waitForTimeout(200);

  for (let i = 1; i <= 7; i++) {
    await page.locator(`.note-tab[data-stage="${i}"]`).click();
    await page.waitForTimeout(200);
    const txt = (await page.locator('#note-panel').innerText()).trim();
    log(`  ${i}단계: 길이 ${txt.length} | ${JSON.stringify(txt.slice(0, 70).replace(/\n/g, ' / '))}`);
    if (txt.length === 0) log('    !!! 빈 화면');
    if (/undefined|NaN|\[object/.test(txt)) log('    !!! 수상한 문자열:', txt.match(/.{0,30}(undefined|NaN|\[object).{0,30}/)?.[0]);
  }

  if (withCaps) {
    // 5단계 — 카드마다 시야가 다른가 (idPrefix)
    await page.locator('.note-tab[data-stage="5"]').click();
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.capture-card')];
      return cards.map((c, i) => {
        const svg = c.querySelector('.capture-fov svg');
        const ids = [...svg.querySelectorAll('[id]')].map((e) => e.id);
        const uses = [...svg.querySelectorAll('[clip-path],[filter],[mask]')]
          .map((e) => e.getAttribute('clip-path') || e.getAttribute('filter') || e.getAttribute('mask'));
        const blur = svg.querySelector('feGaussianBlur')?.getAttribute('stdDeviation');
        return { i, title: c.querySelector('h3').textContent.trim(), nIds: ids.length,
                 sampleIds: ids.slice(0, 4), refs: [...new Set(uses)], blur,
                 body: svg.innerHTML.length, hash: [...svg.innerHTML].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) };
      });
    });
    log('\n  5단계 카드별 시야:');
    for (const c of info) log('   ', JSON.stringify(c));
    const hashes = new Set(info.map((c) => c.hash));
    log('  → 서로 다른 그림인가:', hashes.size === info.length ? `예 (${hashes.size}종)` : `아니오! (${hashes.size}종/${info.length}장)`);
    // 전역 id 충돌 검사
    const dupIds = await page.evaluate(() => {
      const seen = new Map();
      for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
      return [...seen].filter(([, n]) => n > 1);
    });
    log('  문서 전체 중복 id:', JSON.stringify(dupIds));
    await page.screenshot({ path: '_audit-shots/stage5-captures.png', fullPage: false });
  }
  log('  콘솔 에러:', errs.length ? errs : '없음');
  await page.close();
}

/* ---------- 5. 난이도 1·2·3 ---------- */
log('\n########## 5. 난이도별 3단계 예상 / 말풍선 ##########\n');
for (const lv of [1, 2, 3]) {
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  hookErrors(page, errs);
  await page.goto(`${BASE}/?level=${lv}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.note-tab[data-stage="3"]').click();
  await page.waitForTimeout(250);
  const s3 = await page.evaluate(() => ({
    choices: document.querySelectorAll('.predict-opt').length,
    textareas: document.querySelectorAll('#note-panel textarea').length,
    labels: [...document.querySelectorAll('#note-panel .notes-label')].map((e) => e.textContent.trim()),
    placeholders: [...document.querySelectorAll('#note-panel textarea')].map((e) => e.placeholder),
  }));
  log(`level=${lv} 3단계 예상:`, JSON.stringify(s3));
  // 4단계
  await page.locator('.note-tab[data-stage="4"]').click();
  await page.waitForTimeout(250);
  const s4 = await page.evaluate(() => ({
    substeps: document.querySelectorAll('.substep').length,
    next: document.querySelectorAll('.substep--next').length,
    textareas: document.querySelectorAll('#note-panel textarea').length,
    hasQA: !!document.querySelector('.question-a'),
    ph: [...new Set([...document.querySelectorAll('#note-panel textarea')].map((e) => e.placeholder))],
  }));
  log(`level=${lv} 4단계 탐구 과정:`, JSON.stringify(s4));
  // 말풍선
  const b = await page.locator('[data-id="dropper"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(200);
  log(`level=${lv} 스포이트 말풍선:`,
      JSON.stringify((await page.locator('#bench-tip').innerText()).replace(/\n/g, ' | ')));
  log(`level=${lv} 되돌리기 표시:`, JSON.stringify(await page.locator('#undo-left').innerText()));
  log('  콘솔 에러:', errs.length ? errs : '없음');
  await page.close();
}

/* ---------- 6. 좁은/넓은 창 ---------- */
log('\n########## 6. 레이아웃 ##########\n');
for (const [w, h] of [[820, 640], [1600, 1000]]) {
  const errs = [];
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  hookErrors(page, errs);
  await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const geo = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(0), y: +b.y.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0) }; };
    return {
      viewport: [innerWidth, innerHeight],
      docScrollW: document.documentElement.scrollWidth,
      bodyOverflowX: document.documentElement.scrollWidth > innerWidth,
      bar: r('.bench-bar'), stage: r('.bench-stage'), bench: r('#bench'), notebook: r('#notebook'),
      benchScroll: (() => { const e = document.querySelector('#bench'); return { sh: e.scrollHeight, ch: e.clientHeight }; })(),
    };
  });
  log(`\n${w}x${h} 실험대:`, JSON.stringify(geo));
  await page.screenshot({ path: `_audit-shots/bench-${w}x${h}.png` });

  // 도구 막대가 스크롤 뒤에도 보이는가
  await page.evaluate(() => { const e = document.querySelector('#bench'); e.scrollTop = e.scrollHeight; });
  await page.waitForTimeout(200);
  const barAfter = await page.evaluate(() => {
    const b = document.querySelector('.bench-bar').getBoundingClientRect();
    const p = document.querySelector('#bench').getBoundingClientRect();
    return { barTop: +b.y.toFixed(0), barBottom: +(b.y + b.height).toFixed(0), panelTop: +p.y.toFixed(0), panelBottom: +(p.y + p.height).toFixed(0) };
  });
  log(`${w}x${h} 스크롤 뒤 도구 막대:`, JSON.stringify(barAfter),
      barAfter.barBottom <= barAfter.panelTop ? ' !!! 가려짐' : ' 보임');

  // 확대 뷰 — 현미경
  await page.evaluate(() => {
    window.__store.dispatch('SMEAR', { slide: 'B', thickness: 0.3 });
    window.__store.dispatch('PICK_COVERSLIP', {});
    window.__store.dispatch('PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
    window.__store.dispatch('MOUNT', { slide: 'B' });
  });
  await page.locator('[data-id="microscope"]').click();
  await page.waitForTimeout(400);
  const zoomGeo = await page.evaluate(() => {
    const p = document.querySelector('.zoom-panel').getBoundingClientRect();
    const fig = document.querySelector('#scope-figure')?.getBoundingClientRect();
    const fov = document.querySelector('#fov-slot svg')?.getBoundingClientRect();
    const cap = document.querySelector('#capture')?.getBoundingClientRect();
    return {
      panel: { x: +p.x.toFixed(0), y: +p.y.toFixed(0), w: +p.width.toFixed(0), h: +p.height.toFixed(0) },
      overflowsViewport: p.bottom > innerHeight + 1 || p.right > innerWidth + 1 || p.top < -1,
      panelScroll: (() => { const e = document.querySelector('.zoom-panel'); return { sh: e.scrollHeight, ch: e.clientHeight }; })(),
      figFovOverlap: fig && fov ? +(fig.right - fov.left).toFixed(0) : null,
      captureVisibleWithoutScroll: cap ? cap.bottom <= p.bottom + 1 : null,
    };
  });
  log(`${w}x${h} 현미경 확대 뷰:`, JSON.stringify(zoomGeo));
  await page.screenshot({ path: `_audit-shots/zoom-scope-${w}x${h}.png` });

  // 슬라이드 제작 뷰 (핀셋 들고)
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__store.dispatch('UNMOUNT', {}));
  const f = await page.locator('[data-id="forceps"]').boundingBox();
  const s = await page.locator('[data-id="slideC"]').boundingBox();
  await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const slideGeo = await page.evaluate(() => {
    const p = document.querySelector('.zoom-panel')?.getBoundingClientRect();
    const t = document.querySelector('#cover-tool')?.getBoundingClientRect();
    const st = document.querySelector('#slide-stage')?.getBoundingClientRect();
    return p ? { panel: { y: +p.y.toFixed(0), h: +p.height.toFixed(0) },
      overflows: p.bottom > innerHeight + 1,
      panelScroll: (() => { const e = document.querySelector('.zoom-panel'); return { sh: e.scrollHeight, ch: e.clientHeight }; })(),
      toolTop: t ? +t.y.toFixed(0) : null, stageTop: st ? +st.y.toFixed(0) : null } : null;
  });
  log(`${w}x${h} 슬라이드 제작 뷰:`, JSON.stringify(slideGeo));
  await page.screenshot({ path: `_audit-shots/zoom-slide-${w}x${h}.png` });
  log('  콘솔 에러:', errs.length ? errs : '없음');
  await page.close();
}

/* ---------- 노트 입력 중 TICK 재렌더 격리 ---------- */
log('\n########## 부록: 반응 중 노트 입력 ##########\n');
{
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  hookErrors(page, errs);
  await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('.note-tab[data-stage="4"]').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    window.__store.dispatch('SMEAR', { slide: 'B', thickness: 0.3 });
    window.__store.dispatch('FILL_DROPPER', { reagent: 'IKI' });
    window.__store.dispatch('DROP', { slide: 'B', count: 2 });
  });
  await page.waitForTimeout(200);
  await page.locator('#note-1a').focus();
  await page.keyboard.type('껍질을');
  log('입력 시작 포커스:', await page.evaluate(() => document.activeElement.id));
  await page.waitForTimeout(1400);
  log('1.4초 뒤 포커스:', await page.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id));
  await page.keyboard.type(' 벗겼다');
  await page.waitForTimeout(300);
  log('이어서 친 뒤 note-1a 값:', JSON.stringify(await page.locator('#note-1a').inputValue()));
  log('저장된 notes:', JSON.stringify(await page.evaluate(() => window.__store.getState().session.notes)));
  log('reactionT:', await page.evaluate(() => window.__store.getState().slides.B.reactionT));
  log('에러:', errs.length ? errs : '없음');
  await page.close();
}

await browser.close();
