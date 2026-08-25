#!/usr/bin/env node
/**
 * 메인 페이지의 글꼴을 **직접 호스팅**할 수 있게 굽는다.
 *
 *   node scripts/build-fonts.mjs          # public/fonts/ 를 다시 만든다
 *   node scripts/build-fonts.mjs --check  # 굽지 않고, 지금 글자가 다 덮이는지만 본다
 *
 * ── 왜 직접 호스팅하는가 ────────────────────────────────────────────
 * 배포 헤더(`vercel.json`)의 CSP 가 `font-src 'self'` 다. 남의 서버에서 글꼴을 받아 오면
 * 그대로 막혀 글자가 시스템 글꼴로 떨어진다. 학교망에서 구글 도메인이 느리거나 막히는 일도 있다.
 * 남의 서버에 기대지 않으면 둘 다 없어진다.
 *
 * ── 왜 통째로 싣지 않는가 ──────────────────────────────────────────
 * 세 글꼴을 한글까지 통째로 실으면 **13.1 MB, 파일 572개** 다. 랜딩 페이지 하나에 그럴 수 없다.
 * 이 페이지가 쓰는 글자는 한글 268자를 포함해 377자뿐이라, 그만큼만 잘라 받으면 **250 KB** 다.
 * 자르는 일은 구글 글꼴 API 의 `text=` 가 대신 해 준다 — 부분집합 도구를 새로 들이지 않는다.
 *
 * ── 그래서 조심할 것 ───────────────────────────────────────────────
 * 페이지 글자가 바뀌면 **없는 글자가 시스템 글꼴로 떨어진다.** 깨지지는 않지만 눈에 띈다.
 * 그래서 구울 때 쓴 글자 목록을 `subset.txt` 에 남기고, `--check` 가 지금 페이지와 견준다.
 * 문구를 고쳤으면 이 스크립트를 다시 돌려라.
 *
 * 새 의존성을 쓰지 않는다 — Node 20 의 fetch 와 표준 라이브러리뿐이다 (AGENTS.md §3.3).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PAGE = join(ROOT, 'main-page.html');
const OUT_DIR = join(ROOT, 'public', 'fonts');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * 굽는 글꼴과 무게.
 *
 * 안 쓰는 무게를 하나 넣을 때마다 한글은 50 KB 쯤이 그냥 늘어난다. 브라우저에서 실제로
 * 쓰이는 조합을 재어 보고 정했다 — 본고딕 700 만 예외로 남긴다.
 *
 * IBM Plex Mono 500 은 뺐다. 이 페이지는 등폭 글자의 굵기를 바꾸는 자리가 없고,
 * 라틴 글자는 나중에 필요해지면 다시 넣는 값이 싸다.
 *
 * Noto Sans KR 700 은 **지금 안 쓰는데도 남긴다.** 본문에 `<strong>` 하나가 들어오는 것은
 * 랜딩 페이지에서 거의 일어나는 일이고, 그때 700 이 없으면 브라우저가 한글 굵은꼴을
 * 합성한다 — 획이 뭉개져 눈에 띄게 지저분하다. 라틴이라면 합성해도 봐줄 만하지만
 * 한글은 아니다. 이 아래 `--check` 는 글자만 보지 무게는 못 보므로 여기서 미리 막는다.
 */
const FAMILIES = [
  { name: 'Gowun Batang', file: 'gowun-batang', weights: [400, 700] },
  { name: 'Noto Sans KR', file: 'noto-sans-kr', weights: [400, 500, 700] },
  { name: 'IBM Plex Mono', file: 'ibm-plex-mono', weights: [400] },
];

/**
 * 페이지에 없더라도 늘 넣어 두는 글자.
 *
 * 라틴 글자·숫자·문장부호는 몇 자 더 넣어도 거의 공짜인데(한글 한 자보다 싸다),
 * 빠지면 문구를 조금 고치는 것만으로 티가 난다. 한글은 비싸서 이렇게 못 한다.
 */
const ALWAYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  + '.,:;!?()[]{}<>/\\|-–—_=+*&%#@~^\'"`·…→←↑↓×÷°ⅠⅡⅢⅣⅤ';

/** 브라우저인 척해야 woff2 를 준다. 옛 UA 로 물으면 ttf 가 온다 — 세 배 크다. */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

/** 화면에 **보이는** 글자만. `<style>`·`<script>` 안과 태그·엔티티는 글꼴과 상관없다. */
function pageChars(html) {
  const text = html
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z]+;|&#\d+;/g, ' ');
  const set = new Set([...text, ...ALWAYS].filter((c) => !/\s/.test(c)));
  return [...set].sort().join('');
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

async function fetchBytes(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/* ------------------------------------------------------------------ */

// 메인 페이지가 없는 클론(실험 하나짜리 앱)에서는 검사할 것이 없다.
// `npm run check` 가 여기서 걸리면 실험 세션이 남의 사정으로 빨간불을 보게 된다.
if (!existsSync(PAGE)) {
  console.log('main-page.html 이 없습니다 — 이 저장소에는 직접 호스팅할 글꼴이 없습니다.');
  process.exit(0);
}

const chars = pageChars(readFileSync(PAGE, 'utf8'));
const subsetPath = join(OUT_DIR, 'subset.txt');

if (CHECK_ONLY) {
  if (!existsSync(subsetPath)) {
    console.error('public/fonts/subset.txt 가 없습니다. `node scripts/build-fonts.mjs` 를 먼저 돌리세요.');
    process.exit(1);
  }
  const baked = new Set(readFileSync(subsetPath, 'utf8').trim());
  const missing = [...chars].filter((c) => !baked.has(c));
  if (missing.length) {
    console.error(`글꼴에 없는 글자 ${missing.length}자: ${missing.join('')}`);
    console.error('메인 페이지 문구가 바뀌었습니다. `node scripts/build-fonts.mjs` 로 다시 구우세요.');
    process.exit(1);
  }
  console.log(`글꼴 부분집합이 지금 문구를 모두 덮습니다 (${chars.length}자).`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`\n메인 페이지에 쓰인 글자 ${chars.length}자를 잘라 받습니다.\n`);

const faces = [];
let total = 0;

for (const fam of FAMILIES) {
  const q = new URLSearchParams({
    family: `${fam.name}:wght@${fam.weights.join(';')}`,
    text: chars,
  });
  const css = await fetchText(`https://fonts.googleapis.com/css2?${q}`);
  // `text=` 로 물으면 무게마다 @font-face 가 하나씩, 선언 순서대로 온다.
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
  if (urls.length !== fam.weights.length) {
    throw new Error(`${fam.name}: @font-face ${urls.length}개 — ${fam.weights.length}개를 기대했습니다`);
  }
  for (const [i, weight] of fam.weights.entries()) {
    const bytes = await fetchBytes(urls[i]);
    const file = `${fam.file}-${weight}.woff2`;
    writeFileSync(join(OUT_DIR, file), bytes);
    total += bytes.length;
    faces.push({ family: fam.name, weight, file, size: bytes.length });
    console.log(`  ${fam.name} ${weight}`.padEnd(28) + kb(bytes.length).padStart(9));
  }
}

writeFileSync(subsetPath, `${chars}\n`);

writeFileSync(join(OUT_DIR, 'fonts.css'), `/* 이 파일은 손으로 고치지 않습니다.
   scripts/build-fonts.mjs 가 만듭니다 — 메인 페이지 문구를 고쳤으면 다시 돌리세요.

   여기 실린 글꼴은 이 페이지에 실제로 쓰인 글자만 담고 있습니다 (subset.txt).
   통째로 실으면 13.1 MB 인데 이렇게 하면 ${kb(total)} 입니다.
   라이선스는 같은 폴더의 LICENSE.md 를 보세요 — 셋 다 SIL Open Font License 1.1 입니다. */

${faces.map(({ family, weight, file }) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  /* 글꼴이 늦게 와도 글자가 먼저 보여야 한다. 학교망에서 특히. */
  font-display: swap;
  src: url('/fonts/${file}') format('woff2');
}`).join('\n\n')}
`);

console.log(`\n  합계 ${kb(total)} — public/fonts/ 에 넣었습니다.`);
console.log('  문구를 고치면 `node scripts/build-fonts.mjs --check` 가 알려 줍니다.\n');
