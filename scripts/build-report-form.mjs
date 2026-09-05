#!/usr/bin/env node
/**
 * **실제 실험용 탐구 보고서 양식**을 A4 PDF 로 굽는다 — 실험 여덟 + 공용 하나.
 *
 *   node scripts/build-report-form.mjs          # public/forms/ 를 다시 만든다
 *   node scripts/build-report-form.mjs --check  # 굽지 않고, PDF 가 원본과 맞는지만 본다
 *   node scripts/build-report-form.mjs banana   # 하나만 (빨리 보고 고칠 때)
 *
 * ── 실험마다 다른 종이인 까닭 (T39, 사장님 지적) ─────────────────────
 * 처음에는 한 장이었는데 **현미경 시야 칸이 여덟 중 셋에만 맞았다.** 원심분리는 관 안의 층을,
 * 크로마토그래피는 띠와 Rf 를, 발효·효소는 시간에 따른 값을 적는다. 재는 것이 다르면 칸도 달라야 한다.
 * 그래서 **틀은 하나**(`src/forms/template.js`), 무엇을 묻고 무엇을 재는지는
 * **실험의 것**(`experiments/<id>/src/forms/spec.js`)으로 갈랐다.
 *
 * 준비물 ☐ 목록은 그 실험의 `UI.notebook.materials` 에서 그대로 온다 — 손으로 옮겨 적으면
 * 화면의 기구가 바뀌었을 때 종이만 옛것으로 남는다.
 *
 * ── 왜 PDF 를 저장소에 넣는가 ───────────────────────────────────────
 * 굽는 데는 크로미엄이 필요하고 Vercel 빌드에는 그것이 없다 — **구울 수 있는 자리는 사람
 * 컴퓨터뿐**이라 결과를 넣어 둔다. `public/fonts/*.woff2` 와 같은 사정이고, 어긋남은 같은
 * 방식으로 막는다: 원본들의 해시를 함께 적어 두고 `--check` 가 견준다.
 *
 * ★ **PDF 를 직접 고치지 마라.** 원본은 틀과 spec 이다. PDF 만 고치면 다음에 굽는 사람이
 *   그 손질을 조용히 지운다.
 *
 * ★ **`file` 이름이 곧 선생님이 저장하게 될 이름이다.** `<a download="…">` 로 정해 봐야
 *   배포 서버의 `Content-Disposition` 이 이긴다 (T38 에서 영어 이름으로 나갔다).
 *
 * 새 의존성을 쓰지 않는다 — 이미 있는 playwright(개발용)와 표준 라이브러리뿐이다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'public', 'forms');
const STAMP = join(OUT_DIR, 'forms.sha');
const CHECK_ONLY = process.argv.includes('--check');
const ONLY = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? null;

/** 이 사이트의 실험. `src/teacher.js` 의 목록과 같아야 한다 (`tests/site.test.js` 가 본다). */
const EXPERIMENTS = [
  'banana', 'micrometer', 'osmosis', 'catalase',
  'centrifuge', 'chromatography', 'fermentation', 'germination',
];

const { buildForm } = await import(new URL('../src/forms/template.js', import.meta.url));

/** 구울 종이 한 벌 — 실험 여덟과 공용 하나. */
async function papers() {
  const out = [];
  for (const id of EXPERIMENTS) {
    const [{ form }, { manifest }, { UI }] = await Promise.all([
      import(new URL(`../experiments/${id}/src/forms/spec.js`, import.meta.url)),
      import(new URL(`../experiments/${id}/src/manifest.js`, import.meta.url)),
      import(new URL(`../experiments/${id}/src/ui/strings.js`, import.meta.url)),
    ]);
    /*
     * **매니페스트의 `formFile` 이 이 종이를 가리키는 유일한 주소다.** 앱과 선생님 화면이
     * 그 값으로 링크를 만들고, 여기서 그 이름으로 굽는다. 어긋나면 링크가 404 가 되므로
     * 여기서 먼저 멎는다 — `tests/site.test.js` 도 같은 것을 본다.
     */
    if (manifest.formFile !== form.file) {
      throw new Error(`${id}: manifest.formFile 과 spec.file 이 다릅니다\n`
        + `  매니페스트  ${manifest.formFile ?? '(없음)'}\n  양식        ${form.file}`);
    }
    out.push({
      id,
      file: form.file,
      html: buildForm(form, {
        title: manifest.title,
        materials: (UI.notebook?.materials ?? []).map((m) => m.name),
      }),
    });
  }
  const { form: common } = await import(new URL('../src/forms/common.js', import.meta.url));
  out.push({ id: 'common', file: common.file, html: buildForm(common) });
  return out;
}

const all = await papers();
const wanted = ONLY ? all.filter((p) => p.id === ONLY) : all;
if (ONLY && !wanted.length) {
  console.error(`그런 실험이 없습니다: ${ONLY}\n  있는 것: ${all.map((p) => p.id).join(' · ')}`);
  process.exit(1);
}

/** 원본 전체의 지문. 하나라도 고쳐지면 값이 달라진다. */
const stampNow = createHash('sha256')
  .update(all.map((p) => `${p.file}\n${p.html}`).join('\n'))
  .digest('hex').slice(0, 16);

if (CHECK_ONLY) {
  /* 셋을 가른다 — **없다 · 어긋났다 · 맞다.** 셋은 할 일이 서로 다르다. */
  const missing = all.filter((p) => !existsSync(join(OUT_DIR, p.file)));
  if (missing.length) {
    console.error(`public/forms/ 에 없는 양식이 있습니다: ${missing.map((p) => p.file).join(', ')}`);
    console.error('`node scripts/build-report-form.mjs` 를 돌리세요.');
    process.exit(1);
  }
  if (!existsSync(STAMP) || readFileSync(STAMP, 'utf8').trim() !== stampNow) {
    console.error('양식 원본(틀 또는 실험의 spec)이 바뀌었는데 PDF 는 옛것입니다.');
    console.error('`node scripts/build-report-form.mjs` 로 다시 구우세요.');
    process.exit(1);
  }
  console.log(`보고서 양식 PDF ${all.length}장이 원본과 맞습니다 (${stampNow}).`);
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
for (const paper of wanted) {
  /*
   * 파일에서 읽지 않고 내용을 넣는다 — 이 종이는 바깥 파일을 하나도 안 부른다(글꼴도 시스템 것).
   * 바깥을 안 부르는 것이 이 종이의 성질이다.
   */
  await page.setContent(paper.html, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  // 여백은 종이 쪽 `@page` 가 정한다. 여기서 또 주면 두 곳이 다투고, 이기는 쪽이 헷갈린다.
  await page.pdf({ path: join(OUT_DIR, paper.file), format: 'A4', printBackground: true, preferCSSPageSize: true });
  const bytes = readFileSync(join(OUT_DIR, paper.file));
  /*
   * ★ **두 쪽을 넘기지 않는다.** 세 쪽짜리는 마지막 장에 자기 평가만 덩그러니 남아,
   *   교실에서 한 학급 분을 뽑으면 종이 한 통이 그냥 는다. 넘치면 여기서 멎고,
   *   틀이나 그 실험의 spec(물음 수·표 줄 수)을 줄여야 한다. **눈으로만 보면 놓친다.**
   */
  const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (pages > 2) {
    await browser.close();
    console.error(`\n${paper.id}: 양식이 ${pages}쪽입니다 — 두 쪽 안에 앉아야 합니다.`);
    console.error('  → 그 실험의 spec 에서 표 줄 수나 6번 물음을 줄이거나, 틀의 칸 높이를 줄이세요.');
    process.exit(1);
  }
  console.log(`  ${paper.id.padEnd(15)} ${paper.file}  (${(bytes.length / 1024).toFixed(0)} KB · ${pages}쪽)`);
}
await browser.close();

if (!ONLY) {
  /* 이름을 바꾼 옛 양식이 남아 있으면 배포본에 죽은 파일이 쌓인다. 종이 목록이 곧 폴더다. */
  const keep = new Set([...all.map((p) => p.file), 'forms.sha']);
  for (const f of readdirSync(OUT_DIR)) {
    if (!keep.has(f)) { rmSync(join(OUT_DIR, f)); console.log(`  (지움) ${f}`); }
  }
  writeFileSync(STAMP, `${stampNow}\n`);
}
console.log(`\n양식 ${wanted.length}장을 구웠습니다 — public/forms/`);
console.log('원본을 고쳤으면 다시 돌리세요. `--check` 가 어긋남을 알려 줍니다.');
