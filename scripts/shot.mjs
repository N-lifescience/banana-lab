#!/usr/bin/env node
/**
 * 스크린샷 도구.
 *
 *   npm run dev            # 다른 터미널에서 먼저 띄운다
 *   npm run shot           # shots/harness.png
 *   npm run shot -- '#fov-slot' fov   # 특정 요소만
 *   SHOT_SCHEME=dark npm run shot -- '#sheet-panel' sheet-dark   # 다크 모드
 *
 * 에이전트가 "눈으로 확인" 단계를 실제로 수행할 수 있게 하는 용도다.
 * Playwright 가 없으면 안내만 하고 조용히 끝난다.
 */

import { mkdirSync } from 'node:fs';

const url = process.env.SHOT_URL ?? 'http://localhost:5173';
const selector = process.argv[2] ?? null;
const name = process.argv[3] ?? 'harness';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('playwright 가 설치돼 있지 않습니다.  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
// 애셋은 라이트/다크 양쪽에서 확인해야 한다. AGENTS.md §4 참조.
const colorScheme = process.env.SHOT_SCHEME === 'dark' ? 'dark' : 'light';
const page = await browser.newPage({
  viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, colorScheme,
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const target = selector ? page.locator(selector) : page;
await target.screenshot({ path: `shots/${name}.png` });

await browser.close();

if (errors.length) {
  console.log('콘솔 에러:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`shots/${name}.png 저장. 콘솔 에러 없음.`);
