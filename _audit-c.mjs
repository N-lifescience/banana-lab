/** 임시 — 5단계 캡처가 왜 안 보이는지. 끝나면 지운다. */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:5177';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const caps = () => page.evaluate(() => window.__store.getState().session.captures.map((c) => c.slide));

await page.locator('.note-tab[data-stage="5"]').click();
await page.waitForTimeout(200);

for (const [id, reagent, obj] of [['A', null, 4], ['B', 'IKI', 10], ['C', 'SUDAN3', 40]]) {
  await page.evaluate(([id, reagent, obj]) => {
    const d = (t, p) => window.__store.dispatch(t, p);
    d('SMEAR', { slide: id, thickness: 0.3 });
    if (reagent) { d('FILL_DROPPER', { reagent }); d('DROP', { slide: id, count: 2 }); }
    d('PICK_COVERSLIP', {}); d('PLACE_COVERSLIP', { slide: id, angleDeg: 45 });
    d('MOUNT', { slide: id });
    d('SET_OBJECTIVE', { objective: obj });
    d('CAPTURE', {});
    d('UNMOUNT', {});
  }, [id, reagent, obj]);
  await page.waitForTimeout(300);
  console.log(`${id} 뒤 captures=`, JSON.stringify(await caps()),
    '| 카드 수=', await page.locator('.capture-card').count(),
    '| 패널=', JSON.stringify((await page.locator('#note-panel').innerText()).slice(0, 40)));
}

// TICK 이 도는 중인가
console.log('\n반응 중 슬라이드:', JSON.stringify(await page.evaluate(() =>
  Object.entries(window.__store.getState().slides).map(([k, s]) => [k, s.stain, s.drops, s.reactionT]))));
await page.waitForTimeout(2500);
console.log('2.5초 뒤 captures=', JSON.stringify(await caps()),
  '| 카드 수=', await page.locator('.capture-card').count());

// 탭을 다시 눌러 보면?
await page.locator('.note-tab[data-stage="4"]').click(); await page.waitForTimeout(150);
await page.locator('.note-tab[data-stage="5"]').click(); await page.waitForTimeout(300);
console.log('탭 재클릭 뒤 카드 수=', await page.locator('.capture-card').count(),
  '| captures=', JSON.stringify(await caps()));

// 카드가 있으면 그림이 서로 다른가
const info = await page.evaluate(() => [...document.querySelectorAll('.capture-card')].map((c, i) => {
  const svg = c.querySelector('.capture-fov svg');
  return { i, title: c.querySelector('h3').textContent.trim(),
    ids: [...svg.querySelectorAll('[id]')].map((e) => e.id).slice(0, 5),
    clip: svg.querySelector('[clip-path]')?.getAttribute('clip-path'),
    filter: svg.querySelector('[filter]')?.getAttribute('filter'),
    blur: svg.querySelector('feGaussianBlur')?.getAttribute('stdDeviation'),
    nCircles: svg.querySelectorAll('circle,ellipse').length,
    hash: [...svg.innerHTML].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) };
}));
console.log('\n카드별:', JSON.stringify(info, null, 1));
console.log('그림 해시 종류:', new Set(info.map((c) => c.hash)).size, '/', info.length);
await page.screenshot({ path: '_audit-shots/stage5.png' });
console.log('에러:', errs.length ? errs : '없음');
await browser.close();
