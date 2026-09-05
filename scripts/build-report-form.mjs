#!/usr/bin/env node
/**
 * **실제 실험용 빈 보고서 양식**을 A4 PDF 로 굽는다.
 *
 *   node scripts/build-report-form.mjs          # public/forms/ 를 다시 만든다
 *   node scripts/build-report-form.mjs --check  # 굽지 않고, PDF 가 원본과 맞는지만 본다
 *
 * ── 왜 PDF 를 저장소에 넣는가 ───────────────────────────────────────
 * 이 사이트에는 서버가 없다. 배포되는 것은 `public/` 에 있는 파일 그대로다.
 * 그런데 굽는 데는 크로미엄이 필요하고, Vercel 의 빌드에는 그것이 없다 —
 * **구울 수 있는 자리는 여기(사람 컴퓨터)뿐**이라 결과를 넣어 둔다.
 * `public/fonts/*.woff2` 와 같은 사정이고, 같은 방식으로 어긋남을 막는다:
 * 원본의 해시를 함께 적어 두고 `--check` 가 견준다.
 *
 * ★ **PDF 를 직접 고치지 마라.** 원본은 `src/forms/report-form.html` 이다.
 *   PDF 만 고치면 다음에 굽는 사람이 그 손질을 조용히 지운다.
 *
 * 새 의존성을 쓰지 않는다 — 이미 있는 playwright(개발용)와 표준 라이브러리뿐이다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src', 'forms', 'report-form.html');
const OUT_DIR = join(ROOT, 'public', 'forms');
/*
 * ★ **파일 이름이 곧 선생님이 저장하게 될 이름이다.**
 *   `<a download="…">` 로 정해 봐야 소용없다 — 배포 서버가 `Content-Disposition: inline;
 *   filename="…"` 를 파일 이름 그대로 붙여 보내고, 그 헤더가 속성을 이긴다.
 *   실제로 그렇게 나갔다: 첫 배포에서 「탐구보고서_양식.pdf」 로 받게 해 두었는데
 *   내려받아 보니 `lab-report-form.pdf` 였다. 그래서 **파일 이름을 한국어로 둔다.**
 */
const PDF = join(OUT_DIR, '탐구보고서_양식.pdf');
const STAMP = join(OUT_DIR, '탐구보고서_양식.sha');
const CHECK_ONLY = process.argv.includes('--check');

const html = readFileSync(SRC, 'utf8');
const hash = createHash('sha256').update(html).digest('hex').slice(0, 16);

if (CHECK_ONLY) {
  /*
   * 셋을 가른다 — **없다 · 어긋났다 · 맞다.** 「없다」와 「어긋났다」는 할 일이 다르다.
   */
  if (!existsSync(PDF) || !existsSync(STAMP)) {
    console.error('public/forms/ 에 구운 양식이 없습니다. `node scripts/build-report-form.mjs` 를 돌리세요.');
    process.exit(1);
  }
  if (readFileSync(STAMP, 'utf8').trim() !== hash) {
    console.error('양식 원본(src/forms/report-form.html)이 바뀌었는데 PDF 는 옛것입니다.');
    console.error('`node scripts/build-report-form.mjs` 로 다시 구우세요.');
    process.exit(1);
  }
  console.log(`보고서 양식 PDF 가 원본과 맞습니다 (${hash}).`);
  process.exit(0);
}

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('playwright 가 없습니다 — `npm install` 뒤 `npx playwright install chromium`.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
/*
 * 파일에서 읽지 않고 내용을 넣는다 — 이 종이는 바깥 파일을 하나도 안 부르므로
 * (글꼴도 시스템 것) 기준 주소가 필요 없다. 바깥을 안 부르는 것이 이 종이의 성질이다.
 */
await page.setContent(html, { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
// 여백은 종이 쪽 `@page` 가 정한다. 여기서 또 주면 두 곳이 다투고, 이기는 쪽이 헷갈린다.
await page.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();

writeFileSync(STAMP, `${hash}\n`);
const kb = (readFileSync(PDF).length / 1024).toFixed(1);
console.log(`보고서 양식을 구웠습니다 — public/forms/탐구보고서_양식.pdf (${kb} KB)`);
console.log('원본을 고쳤으면 이 스크립트를 다시 돌리세요. `--check` 가 어긋남을 알려 줍니다.');
