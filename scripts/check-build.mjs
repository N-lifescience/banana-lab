#!/usr/bin/env node
/**
 * 배포본 연기 검사.
 *
 *   npm run build && npm run preview   # 다른 터미널에서 먼저 띄운다
 *   node scripts/check-build.mjs
 *
 * 개발 서버가 아니라 **실제로 배포될 파일**을 연다. 개발에서만 열리는 뒷문
 * (`window.__store`)이 배포본에 남아 있지 않은지, 그러고도 실험이 처음부터 끝까지
 * 도는지를 본다. 여기서 걸리는 것은 개발 서버에서는 절대 안 보인다.
 *
 * ── `?edit=1` 은 뒷문이 아니다 ─────────────────────────────────────
 * 예전에는 이 머리글이 `?edit=1` 도 뒷문으로 적고 있었는데, **아래 검사는 정반대로
 * 「배포본에서도 열린다」를 확인한다.** 검사가 맞다 — 실험대 배치를 정하는 사람은
 * 교실에서 쓰는 선생님이고, 그 사람 손에 있는 것은 배포된 주소다.
 *
 * **머리글과 검사가 반대말을 하면 위험하다.** 나중에 누가 머리글을 믿고 검사를 뒤집으면
 * 배포본에서 편집 모드가 **조용히 막히고**, 선생님은 못 여는데 검사는 초록불이다.
 * (웨이브 3 의 centrifuge 세션이 짚었다)
 */

import { previewUrl } from '../dev-port.js';
import { benchLayout } from '../src/ui/bench.js';
import { UI } from '../src/ui/strings.js';   // 개수는 손으로 적지 않고 여기서 세어 온다

/** 실험대에 놓인 물건 수. 배치에서 세어 온다 — 적어 두면 물건을 하나 늘릴 때마다 어긋난다. */
const ITEM_COUNT = benchLayout().length;

const BASE = process.env.BASE ?? previewUrl();
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
ok(await page.locator('.start-level[data-level]').count() === UI.start.levels.length,
   `시작 화면에 단계 ${UI.start.levels.length}개가 있다 (개수는 strings.js 에서 세어 온다)`);
await page.locator('.start-level[data-level="1"]').click();
await page.locator('#start-go').click();
await page.waitForTimeout(300);
ok(await page.locator('.token').count() === ITEM_COUNT, `실험대에 물건 ${ITEM_COUNT}개가 놓인다`,
   `${await page.locator('.token').count()}개`);
ok(await page.locator('.token-name').count() === ITEM_COUNT, '이름표가 보인다');

/* ---------- 뒷문이 닫혀 있는가 ---------- */
ok(await page.evaluate(() => window.__store === undefined),
   '배포본에 window.__store 가 없다');

/*
 * 배치 편집 모드는 **배포본에서도 열려야 한다.**
 *
 * 예전에는 여기서 「없다」 를 확인했다. 그런데 실험대 배치를 정하는 사람은 교실에서 쓰는
 * 선생님이고, 그 사람 손에 있는 것은 배포된 주소다. 개발 서버에서만 열리면 있으나 마나다.
 * 상태를 바꾸는 뒷문(`window.__store`)은 그대로 닫아 둔다 — 그쪽은 성격이 다르다.
 */
await page.goto(`${BASE}/?level=1&edit=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
ok(await page.locator('#edit-panel').count() === 1, '배포본에서도 배치 편집 모드가 열린다');
ok(await page.evaluate(() => typeof window.__layoutCode === 'function'),
   '배포본 편집 모드에서 __layoutCode 로 좌표를 꺼낼 수 있다');

// **주소에 붙이지 않으면 열리지 않는다.** 위 검사만 두면 「늘 켜져 있는 편집 모드」 도 통과한다.
await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
ok(await page.locator('#edit-panel').count() === 0,
   '`?edit=1` 없이는 편집 모드가 안 열린다 — 학생 화면은 그대로다');
ok(await page.evaluate(() => window.__layoutCode === undefined),
   '`?edit=1` 없이는 __layoutCode 도 없다');

/* ---------- 번들에 실려 나가면 안 되는 것 ---------- */
/*
 * **로컬 빌드로는 절대 안 보이는 검사다.** `VITE_VERCEL_*` 는 Vercel 빌드에만 있다.
 *
 * `import.meta.env` 를 통째로 읽으면 Vite 가 `VITE_` 로 시작하는 것을 전부 박아 넣고,
 * Vercel 이 시스템 값 스물몇 개를 그 접두사로 자동 노출한다 — 그 순간
 * **커밋한 사람의 실명과 커밋 메시지가 학생 브라우저로 나간다.**
 *
 * 소스에서 `import.meta.env` 를 통째로 읽는지 보는 검사는 `tests/privacy.test.js` 에 있다.
 * 여기서는 **실제로 나간 물건**을 받아서 본다 — 소스가 멀쩡해도 빌드가 다르면 여기서 걸린다.
 * (웨이브 3 의 fermentation 세션이 이 모양을 냈다)
 */
{
  const html = await (await fetch(`${BASE}/`)).text();
  const srcs = [...new Set([...html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.js/g)].map((m) => m[0]))];
  /*
   * ★ **`> 0` 은 「덜 받았다」를 못 잡는다.** 덩어리가 둘인데 하나만 받아도 참이다.
   *   그리고 **덜 받은 것과 안 새는 것은 같은 얼굴이다** — 안 받은 파일에서는
   *   `VITE_VERCEL_` 이 당연히 0건이라 **초록불이 더 짙어진다.**
   *
   *   여기 주소 긁기는 `<script src>` 뿐 아니라 `<link rel=modulepreload href>` 까지
   *   집는다(HTML 전체에 정규식을 건다). 큰 덩어리가 preload 쪽으로 불리는 저장소가
   *   있어서, `<script src>` 만 보면 **제일 큰 번들을 안 보고** 있을 수 있다.
   *   (germination 이 자기 검사에서 그 자리를 찾아 알려 주었다)
   *
   *   ★ 받은 뒤에는 **하나하나 빈 본문이 아닌지** 본다. 리디렉션을 안 따라가면
   *   200 인데 본문이 비어 오고, 그러면 「없음」이 「안 샌다」로 읽힌다.
   *   (micrometer 가 `cleanUrls` 308 에서 `-L` 없이 빈 본문을 받고 겪었다)
   */
  ok(srcs.length > 0, '   (앞 조건) 배포본에서 번들 주소를 찾았다', `${srcs.length}개 — ${srcs.join(' ')}`);
  let hits = 0;
  let bytes = 0;
  const empty = [];
  for (const src of srcs) {
    const code = await (await fetch(`${BASE}${src}`)).text();
    if (code.length < 100) empty.push(`${src}=${code.length}자`);
    bytes += code.length;
    hits += (code.match(/VITE_VERCEL_/g) ?? []).length;
  }
  ok(empty.length === 0, '   (앞 조건) 찾은 덩어리를 **하나도 빠짐없이** 받았다',
     empty.length ? `★ 빈 본문: ${empty.join(' / ')}` : `${srcs.length}개 모두 받음`);
  ok(hits === 0,
     '번들에 Vercel 시스템 환경변수가 안 실린다 (커밋한 사람의 실명·커밋 메시지)',
     `${srcs.length}개 덩어리 ${bytes} bytes 중 VITE_VERCEL_ ${hits}건`);
}

/* ---------- 개발 하네스는 배포되지 않는다 ----------
   vite build 는 index.html 하나만 묶는다. 다만 `npm run preview` 는 모르는 주소를
   index.html 로 되돌려 주므로 HTTP 200 이 올 수 있다 — 상태 코드가 아니라
   **하네스 내용이 나오는가**로 판단한다. */
// 없는 주소를 일부러 두드리는 것이므로 여기서 나는 404 는 콘솔 에러로 세지 않는다.
// 세면 "하네스가 배포되지 않았다" 를 확인할 때마다 "콘솔 에러 0건" 이 실패한다 — 실제로 그랬다.
const errorsBeforeProbe = errors.length;
const harness = await page.goto(`${BASE}/harness.html`).catch(() => null);
/*
 * ★ **`.catch(() => null)` 로 삼킨 뒤 「없다」를 재면, 서버가 죽어도 통과한다.**
 *
 * 응답이 없으면 화면이 안 넘어가고 `div#sheet` 도 0개다 — 그래서 아래 줄이 초록불이
 * 되면서 detail 에는 **「응답 없음」이라고 스스로 적는다.** 그 모순을 아무도 안 본다.
 *
 * ★ 이 구멍은 **서버가 아예 없을 때는 안 보인다** — 그때는 첫 `goto` 에서 죽는다.
 *   **서버가 그 지점에서 죽을 때만** 열린다(오늘 밤 여러 번 그랬던 그 상황이다).
 *   재려면 서버를 안 띄우지 말고 **그 한 번의 요청만** 막아야 한다.
 * (웨이브 3 의 fermentation 세션이 잡고, micrometer 가 재는 법을 붙였다)
 */
ok(Boolean(harness), '   (앞 조건) 하네스 주소에서 응답을 받았다',
   harness ? `HTTP ${harness.status()}` : '★ 응답 없음 (서버가 죽었을 수 있습니다)');
ok(!(await page.locator('div#sheet').count()),
   '개발 하네스(애셋 시트)는 배포본에 없다', harness ? `HTTP ${harness.status()}` : '응답 없음');
errors.length = errorsBeforeProbe;

/* ---------- 실험이 처음부터 끝까지 도는가 (마우스로) ---------- */
await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

/*
 * 실험대는 탐구 노트 1~4 쪽을 읽어야 열린다. 다른 검사 스크립트는 `window.__store` 로
 * 질러가지만 **배포본에는 그 뒷문이 없다** — 여기서는 학생과 똑같이 눌러서 연다.
 * 덕분에 잠금 자체가 배포본에서 도는지도 같이 확인된다.
 */
ok(await page.locator('#bench-lock').isVisible(), '처음에는 실험대가 잠겨 있다');
for (const stage of ['1', '2', '3', '4']) {
  await page.locator(`.note-tab[data-stage="${stage}"]`).click();
  await page.waitForTimeout(80);
  // 예상 쪽은 예상을 세우기 전에는 안 넘어간다. 학생과 똑같이 세 장 다 고른다 —
  // 여기서 안 고르면 단추가 안 눌리고, 그건 앱이 깨진 것이 아니라 설계대로다.
  if (stage === '3') {
    ok(await page.locator('#mark-read').isDisabled(),
       '배포본에서도 예상을 안 세우면 다음 쪽으로 못 간다');
    for (const id of ['A', 'B', 'C']) {
      await page.locator(`[data-choice="predict.${id}"]`).first().click();
      await page.waitForTimeout(80);
    }
    ok(await page.locator('#mark-read').isEnabled(), '배포본에서도 예상을 세우면 눌린다');
  }
  await page.locator('#mark-read').click();
  await page.waitForTimeout(80);
}
ok(await page.locator('#bench-lock').isHidden(), '1~4 쪽을 읽으면 실험대가 열린다');

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

/*
 * (가)(나)(다)를 한 장씩 올려 기록한다. 재물대에는 한 장만 올라가고 바꿔 올리면
 * 앞의 것이 실험대로 돌아온다 (rules.js MOUNT) — 그래서 내리는 조작이 따로 없다.
 */
for (const [i, id] of ['B', 'A', 'C'].entries()) {
  await drag(`[data-id="slide${id}"]`, '[data-id="microscope"]');
  await page.waitForTimeout(250);
  await page.locator('[data-id="microscope"]').click();
  await page.waitForTimeout(400);
  if (i === 0) {
    ok(await page.locator('#fov-slot svg').count() === 1, '현미경으로 시야를 볼 수 있다');
    ok(await page.locator('#capture').isVisible(), '결과를 기록할 수 있다');
  }
  await page.locator('#capture').click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

/* ---------- 보고서 ----------
   「보고서 만들기」는 다 마무리해야 나온다 (notebook.js 의 reportReadiness).
   다른 스크립트는 `window.__store` 로 상태를 채워 질러가지만 배포본에는 그 뒷문이 없다.
   여기서는 학생과 똑같이 칸을 채운다 — 채우는 길 자체가 배포본에서 도는지도 함께 본다. */
ok(await page.locator('.report-todo').count() === 1,
   '마무리 전에는 단추 대신 남은 일이 적혀 있다');

for (const stage of await page.locator('.note-tab').evaluateAll((els) => els.map((e) => e.dataset.stage))) {
  await page.locator(`.note-tab[data-stage="${stage}"]`).click();
  await page.waitForTimeout(80);

  // 서술형 — 값을 넣고 change 를 알린다. 이 앱은 change 에서만 저장한다.
  await page.locator('#note-panel [data-note]:not([type="radio"])').evaluateAll((els) => {
    for (const el of els) {
      if (String(el.value ?? '').trim()) continue;
      el.value = '색과 모양이 조건에 따라 달랐고, 그것을 근거로 판단했습니다.';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 자기 평가는 라디오다. 값을 넣는 것이 아니라 고르는 것이고, 하나 고를 때마다
  // 화면이 다시 그려지므로 묶음마다 그때그때 다시 찾는다.
  const radioNames = await page.locator('#note-panel input[type="radio"][data-note]')
    .evaluateAll((els) => [...new Set(els.map((e) => e.name))]);
  for (const name of radioNames) {
    await page.locator(`#note-panel input[type="radio"][name="${name}"]`).first().check();
    await page.waitForTimeout(60);
  }

  // 선택형(예상·자기 평가) — 누를 때마다 다시 그려지므로 키마다 그때그때 다시 찾는다.
  for (const attr of ['data-choice', 'data-reflect']) {
    const keys = await page.locator(`#note-panel [${attr}]`)
      .evaluateAll((els, a) => [...new Set(els.map((e) => e.getAttribute(a)))], attr);
    for (const key of keys) {
      await page.locator(`#note-panel [${attr}="${key}"]`).first().click();
      await page.waitForTimeout(60);
    }
  }
}

await page.addInitScript(() => { window.print = () => {}; });

// 안 나왔으면 **무엇이 남았는지**를 함께 적는다. "단추가 없다" 만으로는 고칠 수가 없다.
const left = await page.locator('.report-todo li').allTextContents();
const ready = await page.locator('#make-report').count() === 1;
ok(ready, '다 마무리하면 보고서 단추가 나온다', left.length ? `남은 것: ${left.join(' · ')}` : '');
if (ready) {
  await page.locator('#make-report').click();
  await page.waitForTimeout(200);
  ok(await page.locator('#report-dialog').isVisible(), '보고서 창이 열린다');
  await page.keyboard.press('Escape');
}

/* ---------- 선생님 화면 ----------
   제출 서버를 설정하지 않은 배포본에서는 **꺼진 채로** 떠야 한다.
   설정 안 한 학교에서 이 화면이 반쯤 도는 것이 가장 나쁘다. */
const teacher = await page.goto(`${BASE}/teacher.html`, { waitUntil: 'networkidle' }).catch(() => null);
ok(teacher?.status() === 200, '선생님 화면이 열린다', teacher ? `HTTP ${teacher.status()}` : '응답 없음');
const teacherText = await page.locator('body').innerText().catch(() => '');
const configured = await page.locator('#tc-go').count() > 0;
ok(configured || teacherText.includes('아직 설정되지 않았습니다'),
   '설정 여부에 따라 켜지거나 꺼진 채로 뜬다', configured ? '켜짐(수업 열기)' : '꺼짐(안내)');
ok(!/service_role|eyJ[A-Za-z0-9_-]{20,}/.test(await page.content()),
   '선생님 화면에 서비스 키가 새지 않는다');

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
/* ★ 통째로 안 돈 것을 잡는 바닥 — 자세한 까닭은 `check-ui.mjs` 끝에 적어 두었다. */
const FLOOR = 20;   // 지금 28항목
if (out.length < FLOOR) {
  console.log(`\n★ ${out.length}항목밖에 못 봤습니다 (바닥 ${FLOOR}) — 중간에 끊긴 것입니다.`);
  process.exit(1);
}
console.log(`\n${out.length - fail}/${out.length} 통과`);
process.exit(fail ? 1 : 0);
