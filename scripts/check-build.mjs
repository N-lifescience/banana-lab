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
// 없는 주소를 일부러 두드리는 것이므로 여기서 나는 404 는 콘솔 에러로 세지 않는다.
// 세면 "하네스가 배포되지 않았다" 를 확인할 때마다 "콘솔 에러 0건" 이 실패한다 — 실제로 그랬다.
const errorsBeforeProbe = errors.length;
const harness = await page.goto(`${BASE}/harness.html`).catch(() => null);
ok(!(await page.locator('div#sheet').count()),
   '개발 하네스(애셋 시트)는 배포본에 없다', harness ? `HTTP ${harness.status()}` : '응답 없음');
errors.length = errorsBeforeProbe;

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

/* ---------- 개인정보처리방침 ----------
   자바스크립트가 그리는 링크는 응답 HTML 만 읽는 쪽(검사 도구·크롤러)에 안 보인다.
   정적 HTML 에 들어 있는지를 본다. */
const homeHtml = await (await fetch(BASE)).text();
ok(/href=["']\/privacy["']/.test(homeHtml),
   '개인정보처리방침 링크가 정적 HTML 에 있다');
const privacyRes = await page.goto(`${BASE}/privacy`, { waitUntil: 'domcontentloaded' }).catch(() => null);
ok(privacyRes && privacyRes.status() === 200 && /개인정보처리방침/.test(await page.title()),
   '/privacy 가 열린다', privacyRes ? `HTTP ${privacyRes.status()}` : '응답 없음');
ok(/수집하지 않습니다/.test(await page.content()), '방침이 무엇을 수집하는지 밝힌다');

/* ---------- 보안 응답 헤더 ----------
   vercel.json 이 붙이는 것이라 로컬 preview 에서는 확인할 수 없다.
   BASE 가 배포 주소일 때만 잰다 — 로컬에서 통과했다고 배포본이 통과한 게 아니다. */
if (BASE.startsWith('https://')) {
  const res = await fetch(BASE, { redirect: 'follow' });
  const want = {
    'content-security-policy': /default-src/,
    'strict-transport-security': /max-age=\d+/,
    'x-frame-options': /DENY|SAMEORIGIN/i,
    'x-content-type-options': /nosniff/i,
    'referrer-policy': /\S/,
    'permissions-policy': /\S/,
  };
  const missing = Object.entries(want)
    .filter(([k, re]) => !re.test(res.headers.get(k) ?? ''))
    .map(([k]) => k);
  ok(missing.length === 0, '보안 응답 헤더 6종이 붙는다', missing.join(', '));

  const csp = res.headers.get('content-security-policy') ?? '';
  ok(!/unsafe-eval/.test(csp) && /script-src 'self'/.test(csp),
     'CSP 가 스크립트를 자기 출처로 제한한다', csp.slice(0, 80));

  const http = await fetch(BASE.replace('https://', 'http://'), { redirect: 'manual' });
  ok(http.status >= 300 && http.status < 400
     && (http.headers.get('location') ?? '').startsWith('https://'),
     'HTTP 요청이 HTTPS 로 넘어간다', `HTTP ${http.status}`);
} else {
  console.log('  건너뜀  보안 응답 헤더 — BASE 가 배포 주소일 때만 잽니다');
}

ok(errors.length === 0, '콘솔 에러 0건', errors.slice(0, 3).join(' / '));

await browser.close();

let fail = 0;
for (const r of out) {
  if (!r.pass) fail++;
  console.log(`${r.pass ? '  통과' : '실패'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${out.length - fail}/${out.length} 통과`);
process.exit(fail ? 1 : 0);
