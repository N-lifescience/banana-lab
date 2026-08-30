#!/usr/bin/env node
/**
 * 시야 렌더러 성능 측정.
 *
 *   node scripts/perf-fov.mjs          # 문자열 생성 시간만
 *   node scripts/perf-fov.mjs --dom    # npm run dev 를 띄운 뒤, 브라우저 파싱·레이아웃까지
 *
 * 왜 테스트가 아니라 스크립트인가:
 * 렌더 시간은 기계 부하에 따라 흔들린다. `npm run test` 에 16 ms 단언을 넣으면
 * 언젠가 무관한 이유로 빨간불이 뜨고, 그 뒤로 아무도 그 명령을 믿지 않게 된다.
 * 성능은 사람이 필요할 때 재고 PROGRESS.md 에 숫자를 남긴다.
 *
 * 가장 무거운 경우는 총 100배(대물 10×)다. 총 40배도 400배도 아니다 —
 * 비용을 지배하는 것은 세포 수가 아니라 녹말립 수이기 때문이다.
 */

import { devUrl } from '../dev-port.js';
import { renderFOV } from '../src/render/fov.js';

const BASE = {
  reagent: 'IKI', coverage: 1, excess: 0, floating: false, tooThick: false,
  contaminated: false, bubbles: 0, cracked: false, lensTouched: false,
  focusErr: 0, brightness: 1, seed: 31337, reactionT: 1, panX: 0, panY: 0,
};

const N = 20;

function measure(objective) {
  const p = { ...BASE, objective };
  for (let i = 0; i < 3; i++) renderFOV(p);   // 워밍업
  const t0 = performance.now();
  let svg;
  for (let i = 0; i < N; i++) svg = renderFOV(p);
  const ms = (performance.now() - t0) / N;
  const count = (re) => (svg.match(re) || []).length;
  return {
    objective, ms, kb: svg.length / 1024,
    rect: count(/<rect/g), ellipse: count(/<ellipse/g), circle: count(/<circle/g),
    elements: count(/<(rect|ellipse|circle|path)/g),
  };
}

const rows = [4, 10, 40].map(measure);

console.log('\n시야 렌더러 — 문자열 생성 시간 (' + N + '회 평균)\n');
for (const r of rows) {
  console.log(
    `  대물 ${String(r.objective).padStart(2)}×  (총 ${String(r.objective * 10).padStart(3)}배)   ` +
    `${r.ms.toFixed(2).padStart(6)} ms   요소 ${String(r.elements).padStart(5)}개   ` +
    `${r.kb.toFixed(0).padStart(4)} KB`
  );
}

const worst = rows.reduce((a, b) => (b.ms > a.ms ? b : a));
console.log(`\n  가장 무거운 경우: 총 ${worst.objective * 10}배 — ${worst.ms.toFixed(2)} ms\n`);

if (!process.argv.includes('--dom')) process.exit(0);

/* ------------------------------------------------------------------ */
/* 브라우저 실측 — 문자열을 만드는 시간보다 파싱·레이아웃이 더 비싸다   */
/* ------------------------------------------------------------------ */

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('playwright 가 없어 브라우저 측정을 건너뜁니다.');
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto(process.env.SHOT_URL ?? devUrl(), { waitUntil: 'networkidle' });

console.log('브라우저 — SVG 주입 후 강제 레이아웃까지 (' + N + '회 평균)\n');
for (const r of rows) {
  const svg = renderFOV({ ...BASE, objective: r.objective });
  const ms = await page.evaluate(([html, n]) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;width:360px';
    document.body.appendChild(host);
    host.innerHTML = html; host.getBoundingClientRect();   // 워밍업
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { host.innerHTML = html; host.getBoundingClientRect(); }
    const out = (performance.now() - t0) / n;
    host.remove();
    return out;
  }, [svg, N]);
  console.log(`  대물 ${String(r.objective).padStart(2)}×  (총 ${String(r.objective * 10).padStart(3)}배)   ${ms.toFixed(2).padStart(6)} ms`);
}
console.log('');

await browser.close();
