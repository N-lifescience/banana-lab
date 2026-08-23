import { chromium } from 'playwright';
const url = process.env.SHOT_URL ?? 'http://localhost:5174';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const ids = ['#app', '#bench', '#notebook', '#zoom', '#zoom-close', '#toast-region', '#undo', '#undo-left'];
for (const id of ids) console.log(id, '->', (await page.locator(id).count()) > 0);

console.log('data-tool on dropper:', await page.locator('[data-tool="dropper"]').count());
console.log('data-slide on A:', await page.locator('[data-slide="A"]').count());
console.log('data-zoom=slide count:', await page.locator('[data-zoom="slide"]').count());
console.log('data-zoom=scope count:', await page.locator('[data-zoom="scope"]').count());

// 키보드로 현미경 확대뷰(data-zoom=scope) 열기
await page.locator('[data-zoom="scope"]').focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
console.log('#zoom hidden after keyboard open:', await page.locator('#zoom').isHidden());
console.log('#fov-slot present:', (await page.locator('#fov-slot').count()) > 0);
console.log('#quality present:', (await page.locator('#quality').count()) > 0);
console.log('#quality-score text:', await page.locator('#quality-score').textContent().catch(() => null));
console.log('#quality-worst text:', await page.locator('#quality-worst').textContent().catch(() => null));

await page.keyboard.press('Escape');
await page.waitForTimeout(150);
console.log('focus back on scope opener:', await page.evaluate(() => document.activeElement?.dataset?.zoom));

console.log('#undo text:', await page.locator('#undo').textContent());
console.log('#undo-left text:', await page.locator('#undo-left').textContent());

await browser.close();
console.log('ERRORS:', errors.length ? errors.join('\n') : '없음');
process.exit(errors.length ? 1 : 0);
