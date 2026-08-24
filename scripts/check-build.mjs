#!/usr/bin/env node
/**
 * 배포본 연기 검사.
 *
 *   npm run build && npm run preview   # 다른 터미널에서 먼저 띄운다
 *   node scripts/check-build.mjs
 *
 * 개발 서버가 아니라 **실제로 배포될 파일**을 연다. 개발에서만 열리는 뒷문
 * (`window.__store`, `?edit=1`)이 배포본에 남아 있지 않은지, 그러고도 실험이
 * 처음부터 끝까지 도는지를 본다. 여기서 걸리는 것은 개발 서버에서는 절대 안 보인다.
 */

const BASE = process.env.BASE ?? 'http://localhost:4173';
const out = [];
const ok = (pass, name, detail = '') => out.push({ pass, name, detail });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('playwright 가 설치돼 있지 않습니다.  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });

/* ---------- 시작 화면 ---------- */
ok(await page.locator('.start-level').count() === 3, '시작 화면에 단계 셋이 있다');
await page.locator('.start-level[data-level="1"]').click();
await page.locator('#start-go').click();
await page.waitForTimeout(300);
ok(await page.locator('.token').count() === 14, '실험대에 물건 14개가 놓인다',
   `${await page.locator('.token').count()}개`);
ok(await page.locator('.token-name').count() === 14, '이름표가 보인다');

/* ---------- 뒷문이 닫혀 있는가 ---------- */
ok(await page.evaluate(() => window.__store === undefined),
   '배포본에 window.__store 가 없다');
await page.goto(`${BASE}/?level=1&edit=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
ok(await page.locator('#edit-panel').count() === 0, '배포본에 배치 편집 모드가 없다');
ok(await page.evaluate(() => window.__layoutCode === undefined),
   '배포본에 __layoutCode 가 없다');

/* ---------- 개발 하네스는 배포되지 않는다 ----------
   vite build 는 index.html 하나만 묶는다. 다만 `npm run preview` 는 모르는 주소를
   index.html 로 되돌려 주므로 HTTP 200 이 올 수 있다 — 상태 코드가 아니라
   **하네스 내용이 나오는가**로 판단한다. */
const harness = await page.goto(`${BASE}/harness.html`).catch(() => null);
ok(!(await page.locator('div#sheet').count()),
   '개발 하네스(애셋 시트)는 배포본에 없다', harness ? `HTTP ${harness.status()}` : '응답 없음');

/* ---------- 실험이 처음부터 끝까지 도는가 (마우스로) ---------- */
await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const box = async (sel) => page.locator(sel).boundingBox();
const center = (b) => [b.x + b.width / 2, b.y + b.height / 2];
async function drag(from, to) {
  const a = await box(from);
  const z = await box(to);
  if (!a || !z) throw new Error(`끌 물건이 없습니다: ${from} → ${to}`);
  await page.mouse.move(...center(a));
  await page.mouse.down();
  await page.mouse.move(...center(z), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

await page.locator('[data-id="banana"]').click();
await page.waitForTimeout(150);
await drag('[data-id="banana"]', '[data-id="slideB"]');
const smeared = await page.locator('[data-id="slideB"] #smear').count();
ok(smeared === 1, '바나나를 껍질 벗겨 받침 유리에 문지를 수 있다');

await drag('[data-id="slideB"]', '[data-id="microscope"]');
await page.waitForTimeout(250);
await page.locator('[data-id="microscope"]').click();
await page.waitForTimeout(400);
ok(await page.locator('#fov-slot svg').count() === 1, '현미경으로 시야를 볼 수 있다');
ok(await page.locator('#capture').isVisible(), '결과를 기록할 수 있다');
await page.keyboard.press('Escape');

/* ---------- 보고서 ---------- */
await page.addInitScript(() => { window.print = () => {}; });
await page.locator('#make-report').click();
await page.waitForTimeout(200);
ok(await page.locator('#report-dialog').isVisible(), '보고서 창이 열린다');
await page.keyboard.press('Escape');

ok(errors.length === 0, '콘솔 에러 0건', errors.slice(0, 3).join(' / '));

await browser.close();

let fail = 0;
for (const r of out) {
  if (!r.pass) fail++;
  console.log(`${r.pass ? '  통과' : '실패'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${out.length - fail}/${out.length} 통과`);
process.exit(fail ? 1 : 0);
