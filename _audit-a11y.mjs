/** 임시 UI 감사 — 끝나면 지운다. */
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

const active = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el) return 'null';
  return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset?.id ? '[data-id=' + el.dataset.id + ']' : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;
});

/* ================================================================= */
log('\n########## 1. 키보드만으로 실험 끝까지 ##########\n');
{
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  hookErrors(page, errs);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);

  log('시작 화면 첫 포커스:', await active(page));
  await page.keyboard.press('ArrowDown');
  log('ArrowDown 후 포커스:', await active(page),
      '| aria-checked=', await page.locator('.start-level[aria-checked="true"]').getAttribute('data-level'));
  await page.keyboard.press('ArrowUp');
  // Tab 으로 시작 버튼까지
  let hops = 0;
  while (hops < 12) {
    await page.keyboard.press('Tab'); hops++;
    if ((await active(page)).includes('start-go')) break;
  }
  log(`시작 버튼까지 Tab ${hops}번, 현재 포커스:`, await active(page));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('시작 후 #app 보임:', await page.locator('#app').isVisible(),
      '| 포커스:', await active(page));

  // Tab 순서 전수
  const order = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    order.push(await active(page));
  }
  log('\nTab 순서(45):', JSON.stringify(order, null, 0));

  // 껍질 벗기기 — 키보드
  await page.evaluate(() => document.querySelector('[data-id="banana"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  log('\n[껍질] Enter 후 peeled =', await page.evaluate(() => window.__store.getState().tools.banana.peeled));

  // 문지르기 — 키보드로 가능한가?
  await page.evaluate(() => document.querySelector('[data-id="banana"]').focus());
  for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Space']) {
    await page.keyboard.press(k === 'Space' ? ' ' : k);
  }
  await page.waitForTimeout(150);
  log('[문지르기] 화살표/Space 후 slides.B.sample =',
      JSON.stringify(await page.evaluate(() => window.__store.getState().slides.B.sample)));

  // 스포이트 채우기 — 키보드
  await page.evaluate(() => document.querySelector('[data-id="dropper"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  log('[스포이트 채우기] Enter 후 dropper =',
      JSON.stringify(await page.evaluate(() => window.__store.getState().tools.dropper)),
      '| zoom 열림:', !(await page.locator('#zoom').isHidden()));

  // 슬라이드 확대 뷰 — 키보드로 열면 도구가 있는가
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-id="slideB"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  log('[슬라이드 확대] 열림:', !(await page.locator('#zoom').isHidden()),
      '| 포커스:', await active(page),
      '| #dropper-tool:', await page.locator('#dropper-tool').count(),
      '| #cover-tool:', await page.locator('#cover-tool').count(),
      '| 안내:', JSON.stringify(await page.locator('#cover-hint').innerText().catch(() => '')));
  // 확대 뷰 안 Tab 순환 — 뒤 배경으로 새는가
  const zorder = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); zorder.push(await active(page)); }
  log('[슬라이드 확대] Tab 8회:', JSON.stringify(zorder));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  log('[슬라이드 확대] Esc 후 포커스:', await active(page));

  // 핀셋 — 키보드로 덮개 유리 집기
  await page.evaluate(() => document.querySelector('[data-id="forceps"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  log('[핀셋] Enter 후 forceps =',
      JSON.stringify(await page.evaluate(() => window.__store.getState().tools.forceps)),
      '| zoom:', !(await page.locator('#zoom').isHidden()));

  // 현미경에 슬라이드 올리기 — 키보드
  await page.evaluate(() => document.querySelector('[data-id="slideB"]')?.focus());
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  log('[재물대] 키보드 조작 후 microscope.stage =',
      await page.evaluate(() => window.__store.getState().microscope.stage));

  // 현미경 뷰 — 키보드
  await page.evaluate(() => document.querySelector('[data-id="microscope"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('[현미경] 열림:', !(await page.locator('#zoom').isHidden()),
      '| body 내용:', JSON.stringify((await page.locator('.zoom-body').innerText()).slice(0, 120)));
  await page.keyboard.press('Escape');

  // 강제로 올린 뒤 현미경 뷰 키보드 조작 (다이얼/캡처)
  await page.evaluate(() => {
    window.__store.dispatch('SMEAR', { slide: 'B', thickness: 0.3 });
    window.__store.dispatch('PICK_COVERSLIP', {});
    window.__store.dispatch('PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
    window.__store.dispatch('MOUNT', { slide: 'B' });
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-id="microscope"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const ktab = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); ktab.push(await active(page)); }
  log('[현미경] Tab 12회:', JSON.stringify(ktab));

  await page.evaluate(() => document.querySelector('#dial-fine').focus());
  const fine0 = await page.evaluate(() => window.__store.getState().microscope.fine);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  log('[미동나사] 키보드 fine', fine0, '→',
      await page.evaluate(() => window.__store.getState().microscope.fine),
      '| 포커스 유지:', await active(page),
      '| aria-valuenow:', await page.locator('#dial-fine').getAttribute('aria-valuenow'));

  await page.evaluate(() => document.querySelector('#capture').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('[결과 기록] captures =',
      await page.evaluate(() => window.__store.getState().session.captures.length),
      '| 기록 후 포커스:', await active(page));

  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  log('[현미경] Esc 후 포커스:', await active(page));

  log('\n콘솔 에러:', errs.length ? errs : '없음');
  await page.close();
}

/* ================================================================= */
log('\n########## 2. 포커스 유실 ##########\n');
{
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  hookErrors(page, errs);
  await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // 실험대 토큰 — Enter 로 상태 바꾼 뒤 포커스
  await page.evaluate(() => document.querySelector('[data-id="banana"]').focus());
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  log('토큰 Enter 후 포커스:', await active(page));

  // 노트 탭 이동 후 포커스
  await page.locator('.note-tab[data-stage="4"]').click();
  await page.waitForTimeout(200);
  log('노트 탭 클릭 후 포커스:', await active(page),
      '| 탭 화살표 지원 확인 →');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  log('  ArrowRight 후 포커스:', await active(page),
      '| 선택된 탭:', await page.locator('.note-tab[aria-selected="true"]').getAttribute('data-stage'));

  // 반응 진행 중 TICK 이 노트 다시 그리기 → 입력 중 포커스/글자 유실?
  await page.evaluate(() => {
    window.__store.dispatch('SMEAR', { slide: 'B', thickness: 0.3 });
    window.__store.dispatch('FILL_DROPPER', { reagent: 'IKI' });
    window.__store.dispatch('DROP', { slide: 'B', count: 2 });
  });
  await page.waitForTimeout(200);
  log('반응 중? reactionT =', await page.evaluate(() => window.__store.getState().slides.B.reactionT));
  await page.locator('#note-1a').focus();
  await page.keyboard.type('가나다');
  const before = await active(page);
  await page.waitForTimeout(2500);   // TICK 두어 번
  const after = await active(page);
  const val = await page.locator('#note-1a').inputValue().catch(() => '(사라짐)');
  log('입력 중 2.5초 대기 — 포커스', before, '→', after, '| 칸 내용:', JSON.stringify(val));

  // 확대 뷰 열고 닫기 포커스 복귀
  await page.locator('[data-id="slideC"]').click();
  await page.waitForTimeout(250);
  log('확대 뷰 열림 포커스:', await active(page));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  log('확대 뷰 닫은 뒤 포커스:', await active(page));

  // 다이얼 돌린 뒤 (마우스) 포커스
  await page.evaluate(() => {
    window.__store.dispatch('PICK_COVERSLIP', {});
    window.__store.dispatch('PLACE_COVERSLIP', { slide: 'B', angleDeg: 45 });
    window.__store.dispatch('MOUNT', { slide: 'B' });
  });
  await page.locator('[data-id="microscope"]').click();
  await page.waitForTimeout(300);
  await page.locator('#dial-coarse').focus();
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
  log('조동나사(저배율) 키보드 후 포커스:', await active(page));
  // 고배율에서 조동 → cracked → renderBody
  await page.evaluate(() => window.__store.dispatch('SET_OBJECTIVE', { objective: 40 }));
  await page.waitForTimeout(200);
  await page.locator('#dial-coarse').focus();
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(300);
  log('고배율 조동 → 금 감:',
      await page.evaluate(() => window.__store.getState().slides.B.cracked),
      '| 포커스:', await active(page),
      '| 화면:', JSON.stringify((await page.locator('.zoom-body').innerText()).slice(0, 60)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  log('Esc 후 포커스:', await active(page));
  log('\n콘솔 에러:', errs.length ? errs : '없음');
  await page.close();
}

/* ================================================================= */
log('\n########## 3. aria 속성 vs 실제 상태 ##########\n');
{
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  hookErrors(page, errs);
  await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const dumpAria = async (where) => log(where, JSON.stringify(await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[aria-pressed],[aria-checked],[aria-selected],[role]')) {
      if (!el.offsetParent && el.tagName !== 'BODY') continue;
      out.push({
        t: el.tagName.toLowerCase(),
        id: el.id || el.dataset.stage || el.dataset.obj || el.dataset.value || el.className.split(' ')[0],
        role: el.getAttribute('role'),
        pressed: el.getAttribute('aria-pressed'),
        checked: el.getAttribute('aria-checked'),
        selected: el.getAttribute('aria-selected'),
        tabindex: el.getAttribute('tabindex'),
      });
    }
    return out;
  }), null, 0));

  await dumpAria('실험대:');
  // 노트 3단계 (예상 보기 aria-pressed)
  await page.locator('.note-tab[data-stage="3"]').click(); await page.waitForTimeout(200);
  await dumpAria('노트 3단계:');
  await page.locator('.predict-opt').first().click(); await page.waitForTimeout(200);
  log('보기 하나 고른 뒤 notes:',
      JSON.stringify(await page.evaluate(() => window.__store.getState().session.notes)));
  await dumpAria('고른 뒤:');

  // 현미경 배율 aria-pressed
  await page.evaluate(() => {
    window.__store.dispatch('SMEAR', { slide: 'A', thickness: 0.3 });
    window.__store.dispatch('PICK_COVERSLIP', {});
    window.__store.dispatch('PLACE_COVERSLIP', { slide: 'A', angleDeg: 45 });
    window.__store.dispatch('MOUNT', { slide: 'A' });
  });
  await page.locator('[data-id="microscope"]').click(); await page.waitForTimeout(300);
  await dumpAria('현미경 뷰:');
  log('실제 objective =', await page.evaluate(() => window.__store.getState().microscope.objective));

  // 성찰 문항 옵션 (aria 없음?)
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.evaluate(() => {
    window.__store.dispatch('SET_DIAPHRAGM', { value: 0.02 });
    window.__store.dispatch('CAPTURE', {});
  });
  await page.locator('.note-tab[data-stage="6"]').click(); await page.waitForTimeout(300);
  log('성찰 문항 개수:', await page.locator('.reflect-opt').count());
  await dumpAria('노트 6단계:');
  log('\n콘솔 에러:', errs.length ? errs : '없음');
  await page.close();
}

await browser.close();
