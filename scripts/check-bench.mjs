/** T08 브라우저 검증 — 어포던스가 실제로 화면에 나타나는지. */
import { devUrl } from '../dev-port.js';
import { chromium } from 'playwright';
import { benchLayout } from '../src/ui/bench.js';

/** 실험대에 놓인 물건 수. 배치에서 세어 온다 — 여기에 숫자를 적어 두면 물건을 하나 늘릴 때마다 어긋난다. */
const ITEM_COUNT = benchLayout().length;

const BASE = process.env.BASE ?? devUrl();

/**
 * 브라우저가 중간에 죽었을 때 **앱을 의심하지 않게** 한다.
 *
 * 이 검사는 페이지를 열댓 개 열고 닫는다. 여러 실험 저장소와 세션이 함께 도는 기계에서는
 * 크로뮴이 자원 부족으로 그냥 죽는 일이 있다. 그때 스택만 뱉으면 다음 사람은
 * **「끌기가 깨졌나」 하고 앱을 파기 시작한다** — 실제로는 아무것도 안 깨졌는데.
 *
 * 여기까지 통과한 것을 먼저 찍고, 무엇이 일어난 것인지 한 줄로 말한다.
 * 종료 코드도 가른다 — 1 은 「검사가 틀렸다」, 2 는 「검사를 못 마쳤다」.
 */
function bail(e) {
  const done = (globalThis.out ?? []).filter((r) => r.pass).length;
  const total = (globalThis.out ?? []).length;
  console.log(`\n${done}/${total} 까지 통과한 뒤 **검사가 중간에 멎었습니다.**`);
  console.log(`  ${String(e?.message ?? e).split('\n')[0]}`);
  if (/browser has been closed|Target page|Session closed|crashed/i.test(String(e?.message ?? e))) {
    console.log('  → 브라우저가 죽은 것이지 앱이 깨진 것이 아닙니다.');
    console.log('    다른 실험 저장소·세션이 함께 돌고 있으면 자원이 모자랍니다. 다시 돌려 보세요.');
  }
  process.exit(2);
}
process.on('uncaughtException', bail);
process.on('unhandledRejection', bail);
const out = [];
globalThis.out = out;
/*
 * **한 줄씩 그때그때 찍는다.**
 *
 * 예전에는 결과를 맨 끝에서 한꺼번에 찍었다. 그래서 중간에 브라우저가 죽으면
 * **앞에서 통과한 백몇 줄이 한 줄도 안 나왔다** — 「어디까지 봤는가」와 「아무것도 못 봤는가」가
 * 구분되지 않는다. 여덟 저장소가 한 기계에서 함께 도는 동안 이 일이 자주 난다.
 * (웨이브 3 의 centrifuge 세션이 세 번 헛돌고 나서 짚었다)
 */
const ok = (pass, name, detail = '') => {
  out.push({ pass, name, detail });
  console.log(`${pass ? '  통과' : '실패'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

async function box(sel) {
  return page.locator(sel).boundingBox();
}
const center = (b) => [b.x + b.width / 2, b.y + b.height / 2];

/**
 * 실험대 자물쇠를 연다.
 *
 * 실험대는 탐구 노트 1~4 쪽을 읽어야 열린다 (`src/ui/bench.js`). 학생에게는 그것이 절차지만,
 * 여기서 보려는 것은 그 뒤의 어포던스라 매번 노트를 클릭해 넘길 이유가 없다.
 * 자물쇠 자체는 아래 「탐구 노트를 읽기 전」 항목에서 따로 본다.
 */
async function unlock(p) {
  await p.evaluate(() => {
    for (const stage of ['1', '2', '3', '4']) window.__store.dispatch('MARK_READ', { stage });
  });
  await p.waitForTimeout(80);
}

/**
 * 보고서를 낼 수 있는 상태로 만든다.
 *
 * 「보고서 만들기」 단추는 다 마무리해야 나온다 (`notebook.js` 의 reportReadiness).
 * 여기서 보려는 것은 그 뒤의 창이라, 필요한 것을 상태로 채워 둔다.
 */
async function finishForReport(p) {
  await p.evaluate(() => {
    const s = window.__store;
    const put = (step, text) => s.dispatch('SAVE_NOTE', { step, text });
    s.dispatch('PEEL_BANANA', {});
    for (const id of ['A', 'B', 'C']) {
      s.dispatch('SMEAR', { slide: id, thickness: 0.3 });
      s.dispatch('PICK_COVERSLIP', {});
      s.dispatch('PLACE_COVERSLIP', { slide: id, angleDeg: 45 });
      s.dispatch('UNMOUNT', {});
      s.dispatch('SET_OBJECTIVE', { objective: 4 });
      s.dispatch('MOUNT', { slide: id });
      s.dispatch('CAPTURE', {});
      put(`predict.${id}`, '청람색 알갱이가 보인다');
    }
    put('q.a', '(가)에서는 색이 없어 구분할 수 없었는데 용액을 넣으니 색이 나타나 알 수 있었다');
    put('q2', '녹말은 청람색으로 빽빽했고 지방은 선홍색 방울이 드물었다');
    put('q3', '다른 모둠과 비슷했다');
    for (const k of ['process', 'evidence', 'careful', 'safety', 'retry']) put(`selfeval.${k}`, '4');
  });
  await p.waitForTimeout(120);
}

/** 한 물건을 다른 물건 한가운데로 끌어다 놓는다. */
async function drag(from, to) {
  const a = await box(from);
  const z = await box(to);
  if (!a || !z) throw new Error(`끌 물건이 없습니다: ${!a ? from : to} (from=${!!a} to=${!!z}) 상태=${JSON.stringify(await page.evaluate(() => ({ stage: window.__store.getState().microscope.stage })))}`);
  await page.mouse.move(...center(a));
  await page.mouse.down();
  await page.mouse.move(...center(z), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

/* ---------- 시작 화면 ---------- */
await page.goto(BASE, { waitUntil: 'networkidle' });

ok(await page.locator('#start .start-card').isVisible(), '시작 화면이 먼저 뜬다');
ok(await page.locator('.start-level[data-level]').count() === 3, '난이도 세 단계를 고를 수 있다');
ok(await page.locator('.start-level[data-mode]').count() === 2, '혼자/모둠을 고를 수 있다');
const startText = await page.locator('#start').innerText();
ok(!/[A-Za-z]{4,}/.test(startText.replace(/level=\d/g, '')), '시작 화면이 한글이다',
   JSON.stringify(startText.slice(0, 40)));
ok(await page.locator('#app').isHidden(), '고르기 전에는 실험대가 안 보인다');
// 2단계를 골랐다가 다시 1단계로 — 고른 것이 화면에 표시되는가
await page.locator('.start-level[data-level="2"]').click();
ok(await page.locator('.start-level[data-level="2"]').getAttribute('aria-checked') === 'true',
   '고른 단계가 표시된다');
ok((await page.locator('#start-go').innerText()).includes('2단계'), '시작 버튼이 고른 단계를 말한다');
await page.locator('.start-level[data-level="1"]').click();
await page.locator('#start-go').click();
await page.waitForTimeout(250);
ok(await page.locator('#app').isVisible() && await page.locator('#start').isHidden(),
   '시작하면 실험대로 넘어간다');
ok(await page.evaluate(() => window.__store.getState().session.level) === 1,
   '고른 단계로 시작한다');

// 자물쇠가 실제로 걸려 있는가 — 열기 전에 한 번 본다.
ok(await page.locator('#bench-lock').isVisible(), '탐구 노트를 읽기 전에는 실험대가 잠겨 있다');
await unlock(page);
ok(await page.locator('#bench-lock').isHidden(), '1~4 쪽을 읽으면 실험대가 열린다');

/* ---------- 1단계 ---------- */

// 되돌리기 버튼이 실험대에 있는가
ok(await page.locator('#bench #undo').count() === 1, '되돌리기 버튼이 실험대에 있다');
ok(await page.locator('#notebook #undo').count() === 0, '탐구 노트에는 되돌리기가 없다');

// 마우스를 올리면 이름 + 안내가 뜨는가
const bananaBox = await box('[data-id="banana"]');
await page.mouse.move(...center(bananaBox));
await page.waitForTimeout(120);
const tipVisible = await page.locator('#bench-tip').isVisible();
const tipText = await page.locator('#bench-tip').innerText().catch(() => '');
ok(tipVisible, '물건에 마우스를 올리면 말풍선이 뜬다');
ok(tipText.includes('바나나'), '말풍선에 한글 이름이 있다', JSON.stringify(tipText.slice(0, 60)));
ok(tipText.includes('문질러') || tipText.includes('문지'), '말풍선에 조작 안내가 있다',
   JSON.stringify(tipText.replace(/\n/g, ' | ').slice(0, 120)));

// 클릭하면 껍질이 벗겨지는가 (안 벗기면 문질러도 과육이 묻지 않는다 — 막지는 않는다)
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(80);
ok(await page.evaluate(() => window.__store.getState().tools.banana.peeled), '바나나를 누르면 껍질이 벗겨진다');

// 끌기 시작하면 놓을 수 있는 곳이 표시되는가
const slideBox = await box('[data-id="slideB"]');
await page.mouse.move(...center(bananaBox));
await page.mouse.down();
await page.mouse.move(center(bananaBox)[0] + 20, center(bananaBox)[1] + 5, { steps: 3 });
await page.waitForTimeout(60);
const marked = await page.locator('.token--target').count();
const inert = await page.locator('.token--inert').count();
ok(marked === 3, '바나나를 끌면 받침 유리 3장이 표시된다', `강조 ${marked}개 / 흐림 ${inert}개`);

// 슬라이드 위에서 왔다 갔다 하면 문지르기 계량기가 나오는가
const [sx, sy] = center(slideBox);
await page.mouse.move(sx, sy, { steps: 6 });
await page.waitForTimeout(40);
const hot = await page.locator('.token--target-hot').count();
ok(hot === 1, '지금 놓을 대상이 따로 강조된다');
// 왕복 폭(±26 px)이 받침 유리 폭(약 41 px)보다 크다 — **일부러 그렇다.**
// 실제로 문지르면 매번 가장자리를 넘어가고, 손을 뗄 때 유리 밖에 있기 마련이다.
// 이 폭을 줄이면 "문지르다 유리 밖에서 손을 떼면 아무 일도 안 일어나던" 회귀를 놓친다.
for (let i = 0; i < 8; i++) {
  await page.mouse.move(sx + (i % 2 ? 26 : -26), sy + (i % 3 ? 4 : -4), { steps: 4 });
}
const meterW = await page.locator('.token--dragging .smear-meter i')
  .evaluate((el) => el.style.width).catch(() => null);
ok(meterW && parseFloat(meterW) > 0, '문지르는 동안 얼마나 발렸는지 보인다', `계량기 ${meterW}`);
await page.mouse.up();
await page.waitForTimeout(120);

const thickA = await page.evaluate(() => window.__store.getState().slides.B.sample?.thickness);
ok(thickA > 0.12, '왔다 갔다 한 만큼 두껍게 발린다', `두께 ${thickA?.toFixed(3)}`);

// 살짝 끌어다 놓기만 하면 얇게 발린다
const bananaBox2 = await box('[data-id="banana"]');
const slideCBox = await box('[data-id="slideC"]');
await page.mouse.move(...center(bananaBox2));
await page.mouse.down();
await page.mouse.move(...center(slideCBox), { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(120);
const thickC = await page.evaluate(() => window.__store.getState().slides.C.sample?.thickness);
ok(thickC < thickA, '문지르지 않고 놓기만 하면 더 얇다', `(다) ${thickC?.toFixed(3)} < (나) ${thickA?.toFixed(3)}`);

// 핀셋으로 덮개 유리를 집을 수 있는가 (그림이 아주 작은 대상)
const forcepsBox = await box('[data-id="forceps"]');
const coverBox = await box('[data-id="coverbox"]');
await page.mouse.move(...center(forcepsBox));
await page.mouse.down();
await page.mouse.move(...center(coverBox), { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(120);
const holding = await page.evaluate(() => window.__store.getState().tools.forceps.holding);
ok(holding === 'coverslip', '작은 덮개 유리도 핀셋으로 집힌다', `holding=${holding}`);

// 현미경에 올린 슬라이드를 내릴 수 있는가
await page.evaluate(() => window.__store.dispatch('MOUNT', { slide: 'B' }));
await page.waitForTimeout(80);
ok(await page.locator('#unmount').isVisible(), '슬라이드를 올리면 내리기 버튼이 나타난다');
const undosBefore = await page.evaluate(() => window.__store.getState().session.undosLeft);
await page.locator('#unmount').click();
await page.waitForTimeout(80);
const stage = await page.evaluate(() => window.__store.getState().microscope.stage);
ok(stage === null, '내리기 버튼으로 재물대가 비워진다');
ok(!(await page.locator('#unmount').isVisible()), '내리면 버튼이 사라진다');

/*
 * **탭으로 하던 안전 수칙을 걷어낸 뒤, 그 물건이 말없이 먹통이 되지 않았는가.**
 *
 * 시약병·폐액통·휴지는 눌러서 「마개 닫기」·「폐액 버리기」·「손 씻기」 를 하던 물건이다.
 * 그 조작을 없앴다. 그런데 물건은 실험대에 그대로 있다 — **누르면 아무 일도 안 나는 물건**이
 * 남으면 학생은 앱이 고장 난 줄 안다. 우리가 이미 한 번 잡은 버그의 얼굴이다.
 *
 * 그래서 두 가지를 잰다: 실험대가 **안 바뀌는가**(조작이 없어졌는가)와
 * 말풍선이 **여전히 말을 하는가**(이름과 쓰임).
 */
const bottleBox = await box('[data-id="bottleIKI"]');
const beforeTap = await page.evaluate(() => JSON.stringify(window.__store.getState()).length);
await page.mouse.move(...center(bottleBox));
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(150);
const afterTap = await page.evaluate(() => JSON.stringify(window.__store.getState()).length);
ok(beforeTap === afterTap, '시약병을 눌러도 조작이 일어나지 않는다', `${beforeTap} → ${afterTap}`);
const bottleTip = await page.locator('#bench-tip').innerText().catch(() => '');
ok(bottleTip.trim().length > 0,
   '그래도 시약병은 말을 한다 — 말없이 먹통인 물건은 남기지 않는다',
   bottleTip.replace(/\n/g, ' | ') || '(아무 말도 없음)');

/* ---------- 키보드만으로 끌어다 놓기 ---------- */

// 끌어다 놓는 조작에 키보드 경로가 없으면, 마우스를 쓰지 못하는 사람은 실험을 시작조차 못 한다.
// 포커스로 말풍선이 뜰 때 **놓을 곳 버튼**이 함께 나오고, Enter 로 놓인다.
{
  const kb = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await kb.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(kb);
  await kb.waitForTimeout(250);
  const state = () => kb.evaluate(() => window.__store.getState());
  // 말풍선은 포커스가 옮겨 온 다음 프레임에 뜬다. 고정 시간으로 기다리면
  // 기계가 느린 날에 부서진다 — 버튼이 나타날 때까지 기다린다.
  const put = async (who, onto) => {
    await kb.locator(`[data-id="${who}"]`).focus();
    const btn = kb.locator(`#bench-tip [data-onto="${onto}"]`);
    try {
      await btn.waitFor({ state: 'attached', timeout: 3000 });
    } catch {
      return false;
    }
    await btn.focus();
    await kb.keyboard.press('Enter');
    await kb.waitForTimeout(260);
    return true;
  };

  await kb.locator('[data-id="banana"]').focus();
  await kb.keyboard.press('Enter');
  await kb.waitForTimeout(150);
  ok((await state()).tools.banana.peeled, '키보드 — Enter 로 껍질을 벗긴다');

  ok(await put('banana', 'slideB'), '키보드 — 말풍선에 놓을 곳 버튼이 나온다');
  ok((await state()).slides.B.sample !== null, '키보드 — 받침 유리에 문질러 바른다',
     JSON.stringify((await state()).slides.B.sample));
  await put('dropper', 'bottleIKI');
  ok((await state()).tools.dropper.holds === 'IKI', '키보드 — 스포이트를 채운다');
  await put('forceps', 'coverbox');
  ok((await state()).tools.forceps.holding === 'coverslip', '키보드 — 핀셋으로 집는다');
  await put('slideB', 'microscope');
  ok((await state()).microscope.stage === 'B', '키보드 — 재물대에 올린다');
  // 받침 유리는 재물대에 올라가면 화면에서 사라진다. 그때는 놓은 자리로 옮겨야 한다 —
  // 그냥 두면 포커스가 <body> 로 빠져 처음부터 Tab 해 돌아와야 한다.
  ok(await kb.evaluate(() => document.activeElement?.dataset?.id) === 'microscope',
     '키보드 — 놓은 물건이 사라지면 놓은 자리로 포커스가 간다');

  // ── 키보드로 연 말풍선을 마우스가 덮지 않는가 ──────────────────────
  //
  // **마우스를 못 쓰는 사람에게는 이 말풍선의 「여기에 놓기」 버튼이 물건을 옮기는 길의
  // 전부다.** 마우스가 그것을 지우면 길이 사라진다.
  //
  // 사람 눈으로는 거의 안 보이는 종류다 — 마우스와 키보드를 동시에 쓰는 일이 드무니까.
  // 화면 검사에서는 여섯 번에 두세 번 실패로 나타났고, 멈춘 순간을 찍으니 포커스는
  // 핀셋인데 말풍선은 비커 것이고 놓기 버튼이 0개였다.
  const putsNow = () => kb.evaluate(() => document.querySelectorAll('#bench-tip [data-onto]').length);
  await kb.locator('[data-id="dropper"]').focus();
  await kb.waitForTimeout(200);
  const putsAfterFocus = await putsNow();
  ok(putsAfterFocus > 0, '키보드 — 포커스만으로 놓을 곳 버튼이 나온다', putsAfterFocus);

  // 마우스를 딴 물건 위로 옮겨도, 실험대 밖으로 빼도 그 버튼이 살아 있어야 한다.
  const overBox = await kb.locator('[data-id="microscope"]').boundingBox();
  await kb.mouse.move(overBox.x + overBox.width / 2, overBox.y + overBox.height / 2);
  await kb.waitForTimeout(200);
  ok(await putsNow() === putsAfterFocus,
     '키보드 — 마우스가 다른 물건에 올라가도 놓을 곳 버튼이 남는다', await putsNow());
  await kb.mouse.move(5, 5);
  await kb.waitForTimeout(200);
  ok(await putsNow() === putsAfterFocus,
     '키보드 — 마우스가 실험대를 벗어나도 놓을 곳 버튼이 남는다', await putsNow());

  // 보조기기가 element.focus() 로 짚는 경우. `:focus-visible` 로 거르면 **마우스를 한 번
  // 쓰고 난 뒤** 이 길이 막힌다 — 그 값은 「지금 키보드를 쓰는 중인가」의 어림값이라
  // 프로그램이 부른 focus() 를 키보드로 안 쳐 주기 때문이다.
  await kb.mouse.click(overBox.x + overBox.width / 2, overBox.y + overBox.height / 2);
  await kb.waitForTimeout(200);
  await kb.evaluate(() => document.querySelector('[data-id="forceps"]')?.focus());
  await kb.waitForTimeout(250);
  //
  // **이 검사는 되돌려도 여기서는 빨간불이 나지 않는다.** `:focus-visible` 로 거른 옛 코드로
  // 되돌려 확인해 봤는데 헤드리스 크로뮴은 마우스를 쓴 뒤에도 프로그램이 부른 focus() 를
  // 여전히 focus-visible 로 쳐 준다. 즉 **이 검사는 그 버그를 잡은 것이 아니라, 앞으로
  // 그 방식으로 되돌아가는 것을 막는 울타리다.** (PLAYBOOK: 못 잡으면 그 사실을 적어 둔다)
  // 실제 보조기기·다른 브라우저에서는 갈린다.
  ok(await putsNow() > 0,
     '키보드 — 마우스를 쓴 뒤 보조기기가 focus() 로 짚어도 버튼이 나온다', await putsNow());

  // ── **거기까지 갈 수 있는가** ──────────────────────────────────────
  //
  // 위의 검사들과 `put()` 헬퍼는 전부 `btn.focus()` 를 **부른다.** 그러면
  // 「누르면 동작하는가」만 알 수 있고 **「Tab 으로 닿을 수 있는가」는 알 수 없다.**
  //
  // 실제로 닿을 수 없었다. `#bench-tip` 이 DOM 에서 `.bench-tokens` **뒤**에 있어서,
  // 물건에서 Tab 하면 옆 물건으로 가고 그 물건의 focus 가 말풍선을 제 것으로 갈아 끼워
  // **방금 열려 있던 버튼을 지웠다.** Tab 을 마흔 번 눌러도 못 닿았다.
  // 버튼은 화면에 멀쩡히 떠 있었고 눌리기도 했다 — **검사만 누르고 있었다.**
  //
  // 그래서 여기서는 `focus()` 를 부르지 않는다. **진짜 Tab 만 친다.**
  const activeWhat = () => kb.evaluate(() => {
    const a = document.activeElement;
    return a?.dataset?.onto ? `놓기:${a.dataset.onto}` : a?.dataset?.id ? `물건:${a.dataset.id}` : (a?.tagName ?? '?');
  });

  await kb.locator('[data-id="banana"]').focus();
  await kb.waitForTimeout(200);
  await kb.keyboard.press('Tab');
  await kb.waitForTimeout(120);
  const afterTab = await activeWhat();
  ok(afterTab.startsWith('놓기:'), '키보드 — 물건에서 Tab 하면 놓을 곳 버튼에 닿는다', afterTab);

  await kb.keyboard.press('Shift+Tab');
  await kb.waitForTimeout(120);
  const afterBack = await activeWhat();
  ok(afterBack === '물건:banana', '키보드 — 첫 버튼에서 Shift+Tab 하면 물건으로 돌아온다', afterBack);

  // 마지막 버튼에서 Tab 하면 **그 물건의 다음 물건**으로. 그냥 두면 탐구 노트로 튕겨
  // 실험대를 다 돌기도 전에 밖으로 나간다.
  await kb.keyboard.press('Tab');
  let hop = await activeWhat();
  for (let i = 0; i < 8 && hop.startsWith('놓기:'); i++) {
    await kb.keyboard.press('Tab');
    await kb.waitForTimeout(80);
    hop = await activeWhat();
  }
  ok(hop.startsWith('물건:'), '키보드 — 마지막 버튼에서 Tab 하면 실험대의 다음 물건으로 간다', hop);

  // Esc 로 말풍선을 치운다 (WCAG 1.4.13). 놓을 곳이 일곱이면 Tab 을 일곱 번 눌러
  // 빠져나가야 하는데, 그건 길이 아니다.
  //
  // **앞에서 현미경을 눌러 확대 뷰가 열려 있다.** 그대로 Esc 를 치면 말풍선이 아니라
  // 확대 뷰가 닫히고, 그 뒤 포커스가 현미경으로 돌아가 말풍선이 다시 뜬다 —
  // 검사가 「Esc 가 안 먹는다」 고 잘못 말한다. 먼저 치워 두고 시작한다.
  await kb.keyboard.press('Escape');
  await kb.waitForTimeout(250);
  ok(await kb.evaluate(() => !document.querySelector('.zoom:not([hidden]), #zoom:not([hidden])')),
     '키보드 — Esc 로 확대 뷰를 닫는다');
  // **마우스를 실험대 밖으로 뺀다.** 앞에서 현미경을 눌러 포인터가 그 위에 얹혀 있는데,
  // 그대로 두면 다시 그릴 때 포인터 밑에 새 현미경이 들어서며 pointerenter 가 나고
  // **현미경 말풍선**이 뜬다. 그건 마우스가 제 일을 한 것이지 Esc 가 안 먹은 것이 아니다.
  // 여기서 보려는 것은 **키보드만 쓰는 사람**의 길이므로 마우스를 치우고 잰다.
  await kb.mouse.move(4, 4);
  await kb.waitForTimeout(150);
  await kb.locator('[data-id="dropper"]').focus();
  await kb.waitForTimeout(200);
  await kb.keyboard.press('Escape');
  await kb.waitForTimeout(200);
  ok(await kb.evaluate(() => document.querySelector('#bench-tip').hidden),
     '키보드 — Esc 로 말풍선을 치운다');
  // 치운 뒤 다시 그려도 되살아나면 안 된다 — 포커스가 그 물건에 남아 있어서
  // focus 가 새로 나 도로 뜬다. Esc 가 안 먹은 것처럼 보이는 자리다.
  // **상태가 실제로 달라지는 조작**이라야 다시 그린다. 이 검사 앞에서 이미 껍질을 벗겼으므로
  // PEEL_BANANA 를 다시 부르면 아무것도 안 바뀌고, 그러면 이 검사는 아무것도 안 본다.
  const objBefore = (await state()).microscope.objective;
  await kb.evaluate((o) => window.__store.dispatch('SET_OBJECTIVE', { objective: o === 10 ? 4 : 10 }), objBefore);
  await kb.waitForTimeout(300);
  ok((await state()).microscope.objective !== objBefore, '   (앞 조건) 배율이 실제로 바뀌었다');
  ok(await kb.evaluate(() => document.querySelector('#bench-tip').hidden),
     '키보드 — Esc 로 치운 말풍선은 다시 그려도 안 되살아난다',
     await kb.evaluate(() => document.activeElement?.dataset?.id ?? document.activeElement?.tagName));
  // 다른 물건으로 옮기면 다시 떠야 한다. 안 그러면 Esc 한 번에 영영 안 뜬다.
  await kb.locator('[data-id="forceps"]').focus();
  await kb.waitForTimeout(250);
  ok(!(await kb.evaluate(() => document.querySelector('#bench-tip').hidden)),
     '키보드 — 다른 물건으로 옮기면 말풍선이 다시 뜬다');

  // **Tab 만으로 실제 조작이 되는가.** 여기까지 와야 「길이 있다」 고 말할 수 있다.
  await kb.locator('[data-id="dropper"]').focus();
  await kb.waitForTimeout(200);
  await kb.keyboard.press('Tab');
  let target = await activeWhat();
  for (let i = 0; i < 10 && !target.includes('bottleIKI'); i++) {
    await kb.keyboard.press('Tab');
    await kb.waitForTimeout(80);
    target = await activeWhat();
  }
  await kb.keyboard.press('Enter');
  await kb.waitForTimeout(350);
  ok((await state()).tools.dropper.holds === 'IKI',
     '키보드 — Tab 과 Enter 만으로 스포이트를 채운다', target);

  // 3단계도 조작은 똑같이 된다 — 줄어드는 것은 설명뿐이다.
  const kb3 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await kb3.goto(`${BASE}/?level=3`, { waitUntil: 'networkidle' });
  await unlock(kb3);
  await kb3.waitForTimeout(250);
  await kb3.locator('[data-id="banana"]').focus();
  await kb3.waitForTimeout(200);
  ok(await kb3.locator('#bench-tip [data-onto]').count() === 3,
     '3단계에서도 놓을 곳 버튼은 그대로 나온다');
  await kb3.close();
  await kb.close();
}

/* ---------- 슬라이드 제작 확대 뷰 ---------- */

// 빗나간 슬라이드는 제자리로 돌아가는가 (현미경 위에 얹혀 "올라간 것처럼" 보이지 않는가)
await page.evaluate(() => window.__store.dispatch('UNMOUNT', {}));
await page.waitForTimeout(80);
const homeBefore = await box('[data-id="slideA"]');
const farBox = await box('[data-id="sink"]');
await page.mouse.move(...center(homeBefore));
await page.mouse.down();
// 어디에도 닿지 않는 빈 곳으로
await page.mouse.move(farBox.x + farBox.width * 3, farBox.y - 90, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(120);
const homeAfter = await box('[data-id="slideA"]');
ok(Math.abs(homeAfter.x - homeBefore.x) < 2 && Math.abs(homeAfter.y - homeBefore.y) < 2,
   '아무 데도 닿지 않은 물건은 제자리로 돌아간다',
   `${homeBefore.x.toFixed(0)},${homeBefore.y.toFixed(0)} → ${homeAfter.x.toFixed(0)},${homeAfter.y.toFixed(0)}`);

// 실험 접시로 씻기
await drag('[data-id="slideB"]', '[data-id="sink"]');
const washed = await page.evaluate(() => window.__store.getState().slides.B.sample);
ok(washed === null, '받침 유리를 개수대에 대면 씻긴다', `sample=${JSON.stringify(washed)}`);

// 다시 바르고, 스포이트를 채워 받침 유리에 댄다 → 확대 뷰가 열려야 한다
await drag('[data-id="banana"]', '[data-id="slideB"]');
await drag('[data-id="dropper"]', '[data-id="bottleIKI"]');
await drag('[data-id="dropper"]', '[data-id="slideB"]');
await page.waitForTimeout(200);
ok(await page.locator('#zoom .zoom-panel').isVisible(),
   '스포이트를 받침 유리에 대면 확대 뷰가 열린다');
const dropsBefore = await page.evaluate(() => window.__store.getState().slides.B.drops);
ok(dropsBefore === 0, '대기만 해서는 방울이 떨어지지 않는다', `${dropsBefore}방울`);

ok(await page.locator('#dropper-tool').count() === 1, '들고 온 스포이트가 확대 뷰에 있다');
ok(await page.locator('#cover-tool').count() === 0, '들고 오지 않은 핀셋은 나오지 않는다');

// 받침 유리 위로 옮기지 않은 채 고무를 눌러도 떨어지지 않는다
const bulbTap = async () => {
  const d = await box('#dropper-tool');
  await page.mouse.move(d.x + d.width / 2, d.y + d.height * 0.16);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
};
await bulbTap();
ok(await page.evaluate(() => window.__store.getState().slides.B.drops) === 0,
   '받침 유리 밖에서 누르면 떨어지지 않는다');

// 스포이트를 받침 유리 위로 옮긴다
const dtool = await box('#dropper-tool');
const sBox = await box('#slide-stage');
await page.mouse.move(dtool.x + dtool.width / 2, dtool.y + dtool.height * 0.6);
await page.mouse.down();
await page.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(150);
const overHint = await page.locator('#cover-hint').innerText();
ok(overHint.includes('고무를 누르면'), '받침 유리 위로 오면 누르라고 알려 준다', JSON.stringify(overHint));

await bulbTap();
const drops1 = await page.evaluate(() => window.__store.getState().slides.B.drops);
await bulbTap();
const drops2 = await page.evaluate(() => window.__store.getState().slides.B.drops);
ok(drops1 === 1 && drops2 === 2, '고무를 누를 때마다 한 방울씩 떨어진다', `${drops1} → ${drops2}`);
// 한 방울 뒤에도 손은 그 자리에 있어야 한다 — 매번 다시 끌고 오게 하면 조작이 아니다.
ok(await page.locator('#dropper-tool').getAttribute('data-over') === 'true',
   '한 방울 떨어뜨려도 스포이트가 받침 유리 위에 남는다');

// 색이 변하는 동안 확대 뷰는 1초마다 통째로 다시 그려진다.
// 그때 도구가 붙잡아 둔 요소가 DOM 에서 떨어져 나가면, 떨어져 나간 요소의 크기는 0 이라
// 스포이트가 유리 한가운데 있는데도 "받침 유리 위로 옮기세요" 라고 말하게 된다.
await page.waitForTimeout(2200);
const afterTicks = await page.evaluate(() => ({
  over: document.querySelector('#dropper-tool')?.dataset.over,
  hint: document.querySelector('#cover-hint')?.textContent ?? '',
  reaction: window.__store.getState().slides.B.reactionT,
}));
ok(afterTicks.over === 'true' && afterTicks.hint.includes('고무를 누르면'),
   '색이 변하는 동안 다시 그려져도 안내가 어긋나지 않는다',
   `over=${afterTicks.over} 반응=${afterTicks.reaction?.toFixed(2)} ${JSON.stringify(afterTicks.hint.slice(0, 30))}`);

// 도구 없이 열면 아무 도구도 안 나온다
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
await page.locator('[data-id="slideC"]').click();
await page.waitForTimeout(150);
const bare = await page.evaluate(() => ({
  dropper: document.querySelectorAll('#dropper-tool').length,
  forceps: document.querySelectorAll('#cover-tool').length,
}));
ok(bare.dropper === 0 && bare.forceps === 0,
   '도구를 안 들고 열면 도구가 뜨지 않는다', JSON.stringify(bare));
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
await drag('[data-id="forceps"]', '[data-id="slideB"]');
await page.waitForTimeout(150);

// 슬라이드 제작 뷰 — 제목이 시약 이름을 미리 알려 주지 않는가
const title = await page.locator('.zoom-body h2').innerText();
ok(title === '(나) 슬라이드 제작', '제목이 무엇을 떨어뜨릴지 미리 알려 주지 않는다', JSON.stringify(title));

// 시료가 눈에 보이는가 (덮기 전)
const smearOpacity = await page.locator('#slide-stage #smear').getAttribute('fill-opacity');
ok(Number(smearOpacity) >= 0.5, '얇게 발라도 시료가 보인다', `fill-opacity=${smearOpacity}`);

// 핀셋이 잡은 덮개 유리 — 처음부터 45°, 좌우로 움직이면 기울기가 바뀐다
const startHint = await page.locator('#cover-hint').innerText();
ok(/45°/.test(startHint), '핀셋을 잡으면 45° 에서 시작한다', JSON.stringify(startHint));

const tool = await box('#cover-tool');
const stageBox = await box('#slide-stage');
const [tx0, ty0] = center(tool);
await page.mouse.move(tx0, ty0);
await page.mouse.down();
await page.mouse.move(tx0 + 80, ty0, { steps: 8 });   // 좌우만 — 각도만 바뀌어야 한다
const tiltedHint = await page.locator('#cover-hint').innerText();
const tiltedDeg = Number((tiltedHint.match(/(\d+)°/) ?? [])[1]);
ok(tiltedDeg > 45, '좌우로 움직이면 기울기가 바뀐다', `45° → ${tiltedDeg}°`);
ok(await page.locator('#cover-hint').getAttribute('data-good') === 'false',
   '기포가 생기는 각도라고 알려 준다', `${tiltedDeg}°`);

// 다시 45° 로 돌린 뒤 **곧장 아래로만** 내린다 — 가로로 움직이지 않으므로 각도가 유지돼야 한다
await page.mouse.move(tx0, ty0, { steps: 6 });
await page.mouse.move(tx0, stageBox.y + stageBox.height / 2, { steps: 10 });
const dropHint = await page.locator('#cover-hint').innerText();
ok(/\d+°/.test(dropHint), '내리는 동안에도 기울기가 숫자로 보인다', JSON.stringify(dropHint));
await page.mouse.up();
await page.waitForTimeout(200);
const cov = await page.evaluate(() => window.__store.getState().slides.B.coverslip);
ok(cov.placed && cov.bubbles === 0, '45° 부근으로 내리면 기포 없이 덮인다', JSON.stringify(cov));

// 덮여도 시료가 비치는가
const csFill = await page.locator('#slide-stage #coverslip rect').getAttribute('fill-opacity');
ok(csFill !== null && Number(csFill) < 1, '덮개 유리가 비쳐 시료가 계속 보인다', `fill-opacity=${csFill}`);

// 들어내기 — 쓴 덮개 유리는 핀셋에 남고 재활용되지 않는다
await page.locator('#cover-lift').click();
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({
  placed: window.__store.getState().slides.B.coverslip.placed,
  holding: window.__store.getState().tools.forceps.holding,
}));
ok(after.placed === false && after.holding === 'usedCoverslip',
   '들어낸 덮개 유리는 핀셋에 물린 채 남는다', JSON.stringify(after));
const usedHint = await page.locator('#cover-hint').innerText();
ok(usedHint.includes('쓰레기통'), '쓴 것은 버리라고 알려 준다', JSON.stringify(usedHint));

await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// 실험 접시에 버린다
await drag('[data-id="forceps"]', '[data-id="bin"]');
const discarded = await page.evaluate(() => window.__store.getState().tools.forceps.holding);
ok(discarded === null, '쓴 덮개 유리를 쓰레기통에 버린다', `holding=${discarded}`);

// 재물대 버튼이 어느 유리인지 말하는가
await drag('[data-id="slideB"]', '[data-id="microscope"]');
const unmountLabel = await page.locator('#unmount').innerText();
ok(unmountLabel.includes('(나)'), '내리기 버튼이 어느 받침 유리인지 말한다', JSON.stringify(unmountLabel));
ok(await page.evaluate(() => window.__store.getState().microscope.objective) === 40,
   '1단계는 올리면 400배까지 대신 맞춰 준다');

/* ---------- 현미경 확대 뷰 ---------- */

await page.locator('[data-id="microscope"]').click();
await page.waitForTimeout(250);
ok(await page.locator('#scope-figure svg').count() === 1, '확대 뷰에 현미경 그림이 있다');
ok(await page.locator('#dial-coarse').count() === 1 && await page.locator('#dial-fine').count() === 1,
   '조동·미동나사가 돌리는 다이얼이다');
ok(await page.locator('[data-obj="40"]').count() === 1, '배율은 1단계에서도 직접 고른다');
ok(await page.locator('#scope-unmount').count() === 1, '확대 뷰 안에서 받침 유리를 내릴 수 있다');

// 겹치지 않는가 — 현미경 그림과 시야
const figBox = await box('#scope-figure');
const fovBox = await box('#fov-slot svg');
ok(figBox.x + figBox.width <= fovBox.x + 1, '현미경 그림과 시야가 겹치지 않는다',
   `그림 끝 ${(figBox.x + figBox.width).toFixed(0)} / 시야 시작 ${fovBox.x.toFixed(0)}`);

// 다이얼을 돌리면 초점이 바뀌고 재물대가 움직인다
// 미동나사로 검사한다. 1단계는 올리면 400배가 되고, 그 배율에서 **조동나사**를 돌리면
// 슬라이드에 금이 가는 것이 규칙이다 — 그건 아래에서 따로 확인한다.
const stageTf = () => page.evaluate(
  () => document.querySelector('#scope-figure #stage')?.getAttribute('transform') ?? null);
const turnDial = async (id, turns = 0.5) => {
  const d = await box(id);
  const [cx, cy] = center(d);
  const r = Math.min(d.width, d.height) / 2 - 6;
  await page.mouse.move(cx, cy - r);
  await page.mouse.down();
  const steps = Math.max(6, Math.round(turns * 12));
  for (let i = 1; i <= steps; i++) {
    const rad = ((i / steps) * turns * 360 - 90) * Math.PI / 180;
    await page.mouse.move(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
};

const stageBefore = await stageTf();
const fineBefore = await page.evaluate(() => window.__store.getState().microscope.fine);
await turnDial('#dial-fine');
const fineAfter = await page.evaluate(() => window.__store.getState().microscope.fine);
const stageAfter = await stageTf();
ok(Math.abs(fineAfter - fineBefore) > 0.005, '다이얼을 돌리면 미동나사가 움직인다',
   `fine ${fineBefore?.toFixed(3)} → ${fineAfter?.toFixed(3)}`);
ok(stageBefore !== stageAfter, '나사를 돌리면 재물대 높이가 바뀐다',
   `${stageBefore} → ${stageAfter}`);

// 결과 기록 → 확인 문구 → 탐구 노트 5단계에 실제로 보이는가
await page.locator('#capture').click();
await page.waitForTimeout(250);
const savedNote = await page.locator('#capture-note').innerText().catch(() => '');
ok(savedNote.includes('탐구 노트'), '기록하면 어디서 볼 수 있는지 알려 준다', JSON.stringify(savedNote));
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.locator('.note-tab[data-stage="5"]').click();
await page.waitForTimeout(200);
const cards = await page.locator('#notebook .capture-card').count();
ok(cards >= 1, '기록한 결과가 탐구 노트 5단계에 보인다', `카드 ${cards}장`);

// 카드의 표는 "대물렌즈" 라 써 놓고 총배율(400배)을 적고 있었다. 이름과 값이 어긋난 데다,
// 바로 아래 "배율 입력" 이 채점하는 답을 화면이 먼저 알려 주고 있었다.
const readout = await page.locator('#notebook .capture-card .capture-readout').first().innerText();
ok(/대물렌즈[\s\S]*\b40배/.test(readout) && !readout.includes('400배'),
   '결과 카드가 대물렌즈 배율을 그대로 적는다 (총배율을 대신 적어 답을 흘리지 않는다)',
   JSON.stringify(readout.replace(/\n/g, ' | ')));

// 고배율에서 조동나사 다이얼을 돌리면 깨지고, 화면이 그 사실을 말한다.
// 손으로 돌려서 확인한다 — dispatch 로 부르면 다이얼이 그 결과를 화면에 반영하는지는 못 본다.
await page.locator('[data-id="microscope"]').click();
await page.waitForTimeout(250);
ok(await page.evaluate(() => window.__store.getState().microscope.objective) === 40,
   '1단계는 다시 올려도 400배로 맞춰 준다');
await turnDial('#dial-coarse', 0.4);
const emptyWhy = await page.locator('[data-why="cracked"]').innerText().catch(() => '');
ok(emptyWhy.includes('금이'), '고배율에서 조동나사를 돌리면 깨지고, 확대 뷰가 그 사실을 말한다',
   JSON.stringify(emptyWhy));

// 휴지로 렌즈를 닦을 수 있는가
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.evaluate(() => {
  const st = window.__store.getState();
  window.__store.dispatch('MOUNT', { slide: 'A' });
  return st;
});
await page.waitForTimeout(120);
const dirty = await page.evaluate(() => {
  window.__store.dispatch('SET_OBJECTIVE', { objective: 40 });
  return window.__store.getState().slides.A.lensTouched;
});
ok(dirty === true, '덮개 유리 없이 고배율로 올리면 렌즈가 더러워진다');
await drag('[data-id="tissue"]', '[data-id="microscope"]');
const cleaned = await page.evaluate(() => window.__store.getState().slides.A.lensTouched);
ok(cleaned === false, '휴지를 현미경에 대면 렌즈를 닦는다', `lensTouched=${cleaned}`);

/* ---------- 6단계 정리 ---------- */
{
  const nb = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await nb.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(nb);
  await nb.waitForTimeout(250);

  // 아무것도 안 쓴 칸에 첨삭이 먼저 뜨면, 학생은 쓰기도 전에 부족하다는 말부터 듣는다.
  await nb.locator('.note-tab[data-stage="6"]').click();
  await nb.waitForTimeout(220);
  const empty = await nb.locator('#notebook .grade-line').evaluateAll(
    (e) => e.map((x) => `${x.id}:${x.dataset.grade}`));
  ok(empty.every((g) => g.endsWith(':unavailable')),
     '빈칸에는 첨삭이 뜨지 않는다 (아직 답할 수 없는 문항 안내만 남는다)', JSON.stringify(empty));

  // 실험을 돌리고 예상-실제 비교를 본다
  await nb.evaluate(() => {
    const d = (t, p) => window.__store.dispatch(t, p);
    d('PEEL_BANANA', {});
    for (const s of ['A', 'B', 'C']) d('SMEAR', { slide: s, thickness: 0.3 });
    d('FILL_DROPPER', { reagent: 'IKI' }); d('DROP', { slide: 'B', count: 2 });
    d('RINSE_DROPPER', {}); d('FILL_DROPPER', { reagent: 'SUDAN3' }); d('DROP', { slide: 'C', count: 2 });
    for (let i = 0; i < 5; i++) d('TICK', { seconds: 1 });
    for (const s of ['A', 'B', 'C']) { d('PICK_COVERSLIP', {}); d('PLACE_COVERSLIP', { slide: s, angleDeg: 45 }); }
    d('SAVE_NOTE', { step: 'predict.A', text: '색이 변하지 않는다' });
    for (const s of ['A', 'B', 'C']) {
      d('MOUNT', { slide: s }); d('SET_OBJECTIVE', { objective: 4 });
      d('COARSE_FOCUS', { delta: -window.__store.getState().microscope.coarse });
      d('SET_OBJECTIVE', { objective: 40 }); d('CAPTURE', {});
    }
  });
  await nb.locator('.note-tab[data-stage="5"]').click();
  await nb.waitForTimeout(150);
  await nb.locator('.note-tab[data-stage="6"]').click();
  await nb.waitForTimeout(300);

  // 실제 결과는 시약 이름이 아니라 **눈으로 본 것**이어야 한다.
  // (가) 대조군이 "없음" 으로 나오던 자리다 — 견줄 것이 없는 답이었다.
  const compare = await nb.locator('.predict-compare-row').first().innerText();
  ok(compare.includes('색이 변하지 않았습니다'),
     '실제 결과가 무엇이 보였는지를 말한다 (시약 이름이 아니라)', JSON.stringify(compare.replace(/\n/g, ' | ')));
  ok(!compare.includes('없음'), '대조군 결과가 "없음" 으로 나오지 않는다');

  const t6 = await nb.locator('#note-panel').innerText();
  ok(!/undefined|NaN|\[object/.test(t6), '6단계에 새는 값이 없다');
  await nb.close();
}

/* ---------- 버튼이 눈에 보이는가 (다크 모드에서 흰 바탕 흰 글씨였다) ---------- */

async function checkButtonContrast(page, where) {
  const bad = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parse = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
    const solidBg = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c;
      }
      return [255, 255, 255];
    };
    const out = [];
    for (const el of document.querySelectorAll('button')) {
      if (!el.offsetParent) continue;
      // SVG 안의 글자는 CSS color 가 아니라 애셋이 정한 fill 로 칠해진다.
      // 그걸 CSS 색으로 재면 실제로 잘 보이는 글자를 못 읽는다고 말하게 된다 —
      // 검사가 한 번 헛발질하면 그 뒤로 아무도 안 믿는다. HTML 글자만 잰다.
      //
      // 이름표(.token-name)와 좌표 딱지(.edit-x-tag)도 제 색과 제 바탕을 갖고 물건 그림 위에
      // 떠 있다. 그것을 버튼의 색으로 재면 실제로는 잘 읽히는 글자를 못 읽는다고 말하게 된다 —
      // 실제로 그랬다. 그 둘은 아래에서 따로 잰다.
      const htmlText = [...el.childNodes]
        .filter((n) => n.nodeType === 3
          || (n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg'
              && !n.classList.contains('token-name') && !n.classList.contains('edit-x-tag')))
        .map((n) => n.textContent).join('').trim();
      if (!htmlText) continue;
      const fg = parse(getComputedStyle(el).color);
      const bg = solidBg(el);
      const [a, b] = [lum(fg) + 0.05, lum(bg) + 0.05].sort((x, y) => y - x);
      const ratio = a / b;
      if (ratio < 3) out.push(`${el.id || el.className || htmlText}=${ratio.toFixed(2)}`);
    }
    return out;
  });
  ok(bad.length === 0, `버튼 글자가 배경에 묻히지 않는다 (${where})`, bad.join(' / '));
}

await checkButtonContrast(page, '라이트');

const darkPage = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' });
// 다크 모드 대비 검사는 실험대부터 본다. 주소로 단계를 주면 시작 화면을 건너뛴다.
await darkPage.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
await unlock(darkPage);
await darkPage.evaluate(() => window.__store.dispatch('MOUNT', { slide: 'A' }));
await darkPage.locator('[data-id="microscope"]').click();
await darkPage.waitForTimeout(200);
ok(await darkPage.locator('#capture').isVisible(), '현미경 뷰에 결과 기록 버튼이 있다');
await checkButtonContrast(darkPage, '다크 — 현미경 뷰');
await darkPage.keyboard.press('Escape');
// 탐구 노트 7단계를 모두 열어 본다 — 골라 놓은 탭은 배경이 --indigo 로 바뀌므로
// 탭마다 대비가 달라진다. 한 단계만 보면 놓친다.
for (let i = 1; i <= 7; i++) {
  await darkPage.locator(`.note-tab[data-stage="${i}"]`).click();
  await darkPage.waitForTimeout(60);
  await checkButtonContrast(darkPage, `다크 — 탐구 노트 ${i}단계`);
}
await darkPage.close();

/* ---------- 3단계 — 안내만 줄고 조작은 그대로인가 ---------- */
await page.goto(`${BASE}/?level=3`, { waitUntil: 'networkidle' });
await unlock(page);
const b3 = await box('[data-id="banana"]');
await page.mouse.move(...center(b3));
await page.waitForTimeout(120);
const tip3 = await page.locator('#bench-tip').innerText();
ok(tip3.trim() === '바나나', '3단계 말풍선은 이름만 뜬다', JSON.stringify(tip3));

await page.mouse.down();
await page.mouse.move(center(b3)[0] + 20, center(b3)[1] + 5, { steps: 3 });
await page.waitForTimeout(60);
const marked3 = await page.locator('.token--target').count();
await page.mouse.up();
ok(marked3 === 3, '3단계에서도 끌어다 놓을 곳은 똑같이 표시된다', `${marked3}개`);

/* ---------- 배치 편집 모드 — 옮기기만 하고 아무 일도 일으키지 않는가 ---------- */
{
  const ed = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  await ed.goto(`${BASE}/?level=1&edit=1`, { waitUntil: 'networkidle' });
  ok(await ed.locator('#edit-panel').count() === 1, '?edit=1 로 배치 편집 모드가 열린다');

  const eBox = async (sel) => ed.locator(sel).boundingBox();
  const eCenter = (b) => [b.x + b.width / 2, b.y + b.height / 2];

  // 먼저 아래로 내린다. 선반 물건을 아래로 끌면 작업면에 붙어야 한다.
  // (순서가 중요하다 — 먼저 다른 물건 위로 옮겨 놓으면 그 물건이 위에 겹쳐 그려져서
  //  다음 번에 집는 것이 바나나가 아니라 겹친 물건이 된다.)
  const ban = await eBox('[data-id="banana"]');
  await ed.mouse.move(...eCenter(ban));
  await ed.mouse.down();
  await ed.mouse.move(eCenter(ban)[0], eCenter(ban)[1] + 300, { steps: 12 });
  await ed.mouse.up();
  await ed.waitForTimeout(200);

  const code = await ed.evaluate(() => window.__layoutCode());
  const bananaLine = code.split('\n').find((l) => l.includes("id: 'banana'"));
  ok(/^\s*surface\(\d+,/.test(bananaLine ?? ''),
     '아래로 끌면 작업면에 붙고, 그 자리가 코드로 나온다', JSON.stringify(bananaLine));
  ok(code.split('\n').filter((l) => l.includes('labelKey')).length === ITEM_COUNT,
     `코드에 실험대 물건 ${ITEM_COUNT}개가 모두 나온다`);

  // 화면에도 좌표가 보여야 한다 — 스크린샷 한 장으로 읽을 수 있어야 하기 때문이다.
  ok(await ed.locator('.edit-x-tag').count() === ITEM_COUNT, '물건마다 x 좌표가 화면에 붙는다');

  // 핀셋을 덮개 유리 통에 끌어다 댄다. 평소라면 한 장 집는다.
  //
  // 바나나를 받침 유리에 문지르는 것으로 검사하다가 한 번 헛발질했다 — 껍질을 안 벗긴
  // 바나나는 편집 모드가 아니어도 발리지 않아서, 편집 모드를 껐다 켜도 결과가 같았다.
  // **앞 조건이 없는 조작**으로 봐야 이 검사가 무언가를 말한다.
  const fps = await eBox('[data-id="forceps"]');
  const cbx = await eBox('[data-id="coverbox"]');
  await ed.mouse.move(...eCenter(fps));
  await ed.mouse.down();
  await ed.mouse.move(...eCenter(cbx), { steps: 10 });
  await ed.mouse.up();
  await ed.waitForTimeout(200);

  const holding = await ed.evaluate(() => window.__store.getState().tools.forceps.holding);
  ok(holding === null,
     '편집 모드에서는 끌어다 놓아도 조작이 일어나지 않는다', `holding=${holding}`);

  // 「여기에 놓기」 버튼은 진짜 조작을 일으킨다. "조작은 일어나지 않습니다" 라고 적어 둔
  // 화면에 그 버튼이 있으면 안 된다.
  await ed.locator('[data-id="forceps"]').focus();
  await ed.waitForTimeout(150);
  ok(await ed.locator('#bench-tip .tip-actions').count() === 0,
     '편집 모드 말풍선에는 놓기 버튼이 없다');
  await ed.close();
}

/* ---------- 그려진 범위(CONTENT_BOX)가 실제 그림과 맞는가 ---------- */
{
  // 이 숫자로 "물건이 서로 겹치는가" 를 판정하고, 포인터도 칠해진 곳에서만 받는다.
  // 그림을 다시 그리면 값이 어긋나는데, 화면만 보면 멀쩡해 보인다. 여기서 잡는다.
  const cb = await browser.newPage();
  await cb.goto(`${BASE}/harness.html`, { waitUntil: 'networkidle' });
  const drift = await cb.evaluate(async () => {
    const { ASSETS, SAMPLE_STATES } = await import('/src/assets/index.js');
    const { CONTENT_BOX, CONTRACT } = await import('/src/assets/contract.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px';
    document.body.appendChild(host);
    const bad = [];
    for (const [name, mod] of Object.entries(ASSETS)) {
      const [, , vw, vh] = CONTRACT[name].viewBox.split(/\s+/).map(Number);
      let box = null;
      for (const st of SAMPLE_STATES[name] ?? [{}]) {
        host.innerHTML = mod.render({ ...st, seed: 1 });
        const b = host.querySelector('svg').getBBox();
        const cur = { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
        box = box ? {
          x0: Math.min(box.x0, cur.x0), y0: Math.min(box.y0, cur.y0),
          x1: Math.max(box.x1, cur.x1), y1: Math.max(box.y1, cur.y1),
        } : cur;
      }
      // 프레임 밖은 잘려서 보이지도 눌리지도 않는다. 프레임 안으로 자른 값과 견준다.
      const live = {
        x0: Math.max(0, Math.floor(box.x0)), y0: Math.max(0, Math.floor(box.y0)),
        x1: Math.min(vw, Math.ceil(box.x1)), y1: Math.min(vh, Math.ceil(box.y1)),
      };
      const saved = CONTENT_BOX[name];
      if (!saved) { bad.push(`${name}: 값이 없음`); continue; }
      // 2 는 선 두께 반올림 정도의 여유다. 그림이 실제로 바뀌면 이보다 크게 벌어진다.
      for (const k of ['x0', 'y0', 'x1', 'y1']) {
        if (Math.abs(saved[k] - live[k]) > 2) {
          bad.push(`${name}.${k} 적힌 값 ${saved[k]} / 실제 ${live[k]}`);
        }
      }
    }
    host.remove();
    return bad;
  });
  ok(drift.length === 0, '적어 둔 그려진 범위가 실제 그림과 맞는다', drift.slice(0, 3).join(' / '));
  await cb.close();
}

/* ---------- 이름표가 늘 보이는가, 서로 겹치지 않는가 ---------- */
{
  // 이름이 말풍선에만 있으면 마우스를 하나씩 올려 보기 전에는 실험대에 무엇이 있는지 모른다.
  const nm = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await nm.goto(`${BASE}/?level=3`, { waitUntil: 'networkidle' });
  await unlock(nm);
  const names = await nm.evaluate(() => [...document.querySelectorAll('.token-name')]
    .map((n) => ({ text: n.textContent.trim(), r: n.getBoundingClientRect().toJSON() })));
  ok(names.length === ITEM_COUNT, `실험대 물건 ${ITEM_COUNT}개에 모두 이름표가 붙는다`, `${names.length}개`);
  ok(names.every((n) => n.text.length > 0), '빈 이름표가 없다');
  // 3단계에서도 이름은 보인다 — 난이도가 줄이는 것은 설명이지 물건이 무엇인지가 아니다.
  ok(names.some((n) => n.text === '현미경'), '3단계에서도 이름표가 보인다');

  const clash = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i].r;
      const b = names[j].r;
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
        clash.push(`${names[i].text}↔${names[j].text}`);
      }
    }
  }
  ok(clash.length === 0, '이름표끼리 겹치지 않는다 (겹치면 아래 줄로 내려간다)', clash.join(' / '));

  // 이름표는 물건 그림 위에 얹힌다. 제 바탕을 깔지 않으면 그림 색에 따라 글자가 묻힌다.
  const readable = await nm.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parse = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
    const bad = [];
    for (const n of document.querySelectorAll('.token-name')) {
      const st = getComputedStyle(n);
      const fg = parse(st.color);
      const bg = parse(st.backgroundColor);
      if (bg.length < 3 || (bg[3] !== undefined && bg[3] < 0.6)) { bad.push(`${n.textContent}: 바탕 없음`); continue; }
      const [a, b] = [lum(fg.slice(0, 3)), lum(bg.slice(0, 3))].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      if (ratio < 4.5) bad.push(`${n.textContent}=${ratio.toFixed(2)}`);
    }
    return bad;
  });
  ok(readable.length === 0, '이름표 글자가 제 바탕 위에서 읽힌다', readable.join(' / '));
  await nm.close();
}

/* ---------- 겨눈 그림이 잡히는가 (프레임이 겹치는 이웃이 가로채지 않는가) ---------- */
{
  // 개수대 프레임(380 mm)은 휴지 그림 자리까지 뻗어 있다. 프레임으로 판정하던 때에는
  // 휴지 그림을 겨눠도 개수대가 잡혔고, 받침 유리가 씻겨 시료가 사라졌다.
  const aim = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await aim.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(aim);
  await aim.evaluate(() => {
    window.__store.dispatch('PEEL_BANANA', {});
    window.__store.dispatch('SMEAR', { slide: 'B', thickness: 0.3 });
  });
  await aim.waitForTimeout(120);
  const aBox = async (sel) => aim.locator(sel).boundingBox();
  const aCenter = (b) => [b.x + b.width / 2, b.y + b.height / 2];
  const sb = await aBox('[data-id="slideB"]');
  const ti = await aBox('[data-id="tissue"]');
  await aim.mouse.move(...aCenter(sb));
  await aim.mouse.down();
  await aim.mouse.move(...aCenter(ti), { steps: 10 });
  await aim.mouse.up();
  await aim.waitForTimeout(180);
  const kept = await aim.evaluate(() => window.__store.getState().slides.B.sample !== null);
  ok(kept, '휴지 그림을 겨누면 옆 개수대가 가로채지 않는다 (시료가 씻기지 않는다)');
  await aim.close();
}

/* ---------- 보고서 — 화면에서 이름을 받고, 종이에만 남는가 ---------- */
{
  const rp = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  // 인쇄 창이 뜨면 스크립트가 거기서 멈춘다. 브라우저 창을 여는 것 자체가 검사 대상은 아니다.
  await rp.addInitScript(() => { window.print = () => {}; });
  await rp.goto(`${BASE}/?level=2`, { waitUntil: 'networkidle' });
  await unlock(rp);

  // 다 마무리하기 전에는 단추 대신 "무엇이 남았는지" 가 있어야 한다.
  ok(await rp.locator('#make-report').count() === 0 && await rp.locator('.report-todo').count() === 1,
     '마무리 전에는 보고서 단추 대신 남은 것이 적혀 있다');
  await finishForReport(rp);
  ok(await rp.locator('#make-report').count() === 1, '다 마무리하면 보고서 단추가 나온다');

  await rp.locator('#make-report').click();
  await rp.waitForTimeout(150);
  ok(await rp.locator('#report-dialog').isVisible(), '탐구 노트에서 보고서 만들기 창을 연다');

  // 좁은 창에서 창이 넘치는가. 처음엔 넘쳤다 — grid 트랙을 1fr 로 두면 트랙의 최소 폭이
  // input 기본 너비(약 20자)라 세 칸이 창보다 넓어지고, 번호 칸이 잘린 채 가로 스크롤이 생긴다.
  await rp.setViewportSize({ width: 480, height: 760 });
  await rp.waitForTimeout(120);
  const fit = await rp.evaluate(() => {
    const d = document.querySelector('#report-dialog');
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  ok(fit.scrollW <= fit.clientW, '좁은 창에서도 보고서 창이 가로로 넘치지 않는다', JSON.stringify(fit));
  await rp.setViewportSize({ width: 1400, height: 900 });

  await rp.locator('#rp-name').fill('홍길동');
  await rp.locator('#rp-grade').fill('2');
  await rp.locator('#rp-make').click();
  // 시야를 그림으로 굽고 나서야 인쇄가 걸린다 (src/ui/report.js). 그동안 기다린다.
  await rp.waitForTimeout(1200);

  const sheet = await rp.locator('#report-sheet').innerHTML();
  ok(sheet.includes('홍길동') && sheet.includes('탐구 보고서'),
     '넣은 이름이 보고서에 실린다', `종이 ${sheet.length}자`);

  // 파일 이름 — 서른 명이 낸 파일 이름이 전부 같으면 받는 쪽에서 누구 것인지 알 수 없다.
  const docTitle = await rp.title();
  ok(docTitle.includes('홍길동'), '저장되는 파일 이름에 학번·이름이 붙는다', docTitle);

  // 시야는 그림으로 구워져야 한다. 작은 기기에서 SVG 필터가 까맣게 인쇄되던 자리다.
  const baked = await rp.evaluate(() => ({
    imgs: document.querySelectorAll('#report-sheet .rp-fov img').length,
    svgs: document.querySelectorAll('#report-sheet .rp-fov svg').length,
  }));
  ok(baked.imgs > 0 && baked.svgs === 0,
     '보고서의 시야가 그림으로 구워진다 (모바일 인쇄에서 까맣게 나오던 자리)', JSON.stringify(baked));

  // 가장 중요한 것 — 이름이 상태로 새지 않는다. 새면 되돌리기 기록에 남고 화면 곳곳으로 흘러간다.
  const leaked = await rp.evaluate(() => ({
    store: JSON.stringify(window.__store.getState()).includes('홍길동'),
    storage: JSON.stringify({ ...localStorage, ...sessionStorage }).includes('홍길동'),
  }));
  ok(!leaked.store && !leaked.storage,
     '이름이 상태에도 브라우저 저장소에도 남지 않는다', JSON.stringify(leaked));

  // 인쇄 모양에서 실험대는 사라지고 종이만 남는가
  await rp.emulateMedia({ media: 'print' });
  await rp.waitForTimeout(120);
  const printed = await rp.evaluate(() => ({
    layout: getComputedStyle(document.querySelector('.layout')).display,
    sheet: getComputedStyle(document.querySelector('#report-sheet')).display,
  }));
  ok(printed.layout === 'none' && printed.sheet !== 'none',
     '인쇄하면 실험대는 빠지고 보고서만 나온다', JSON.stringify(printed));
  await rp.emulateMedia({ media: 'screen' });

  // 인쇄 창이 닫히면 이름이 화면에서도 지워지는가
  await rp.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const after = await rp.evaluate(() => ({
    sheet: document.querySelector('#report-sheet').innerHTML.length,
    inputs: [...document.querySelectorAll('[data-field]')].map((e) => e.value).join(''),
  }));
  ok(after.sheet === 0 && after.inputs === '',
     '인쇄가 끝나면 이름이 화면에서 지워진다', JSON.stringify(after));
  await rp.close();
}

/* ---------- 결과 ---------- */
/* ────────────────────────────────────────────────────────────────
 * 손가락으로 끌기 — **한 줄도 검사가 없었다.**
 *
 * 이 검사는 `page.mouse.down/move/up` 을 마흔 번 넘게 쓴다. 그래서 **마우스로 끄는 길은
 * 촘촘히 덮여 있다** — 놓기 한 줄을 끊으면 첫 항목도 못 지나가고 죽는다.
 *
 * 그런데 **손가락은 한 번도 안 눌러 봤다.** 앱에는 손가락 전용 갈래가 여럿이다
 * (`e.pointerType !== 'mouse'` · `fingerTapAt` · 「움직였는가」로 탭과 끌기를 가르는 자리).
 * 학생은 대부분 태블릿으로 쓴다. 마우스만 재고 「끌기가 된다」 고 말하면 안 된다.
 *
 * Playwright 의 `touchscreen` 에는 `tap()` 밖에 없고, 손으로 만든 `PointerEvent` 는
 * `setPointerCapture` 에서 걸린다. CDP 로 진짜 터치를 쏜다.
 * (웨이브 2 의 catalase 세션이 알려 준 길이다)
 * ──────────────────────────────────────────────────────────────── */
{
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, x, y) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }],
    });
  };
  /**
   * 손가락으로 끈다.
   *
   * **두 끝을 한 번에, 아무것도 움직이지 않은 상태에서 잰다.** 좌표 헬퍼 안에서
   * 스크롤을 건드리면 두 번째 호출이 화면을 움직여 첫 좌표가 썩는다 —
   * 그러면 「좁은 화면에서는 끌기가 안 된다」 로 잘못 읽게 된다.
   */
  const touchDrag = async (fromSel, toSel) => {
    const [a, b] = [await box(fromSel), await box(toSel)];
    if (!a || !b) return false;
    const [x0, y0] = center(a);
    const [x1, y1] = center(b);
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', x1, y1);
    await page.waitForTimeout(300);
    return true;
  };

  // 새 판에서 시작한다 — 앞 검사들이 이미 다 만들어 둔 상태를 쓰면 무엇이 일어났는지 못 가린다.
  await page.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__store.dispatch('PEEL_BANANA', {}));
  await page.waitForTimeout(250);

  const before = await page.evaluate(() => window.__store.getState().slides.A.sample);
  await touchDrag('[data-id="banana"]', '[data-id="slideA"]');
  const after = await page.evaluate(() => window.__store.getState().slides.A.sample);
  ok(before === null && after !== null,
     '손가락 — 끌어다 놓으면 받침 유리에 발린다', JSON.stringify(after));

  // 손가락으로 **탭**한 것은 끌기가 아니다. 움직이지 않았으면 탭으로 갈려야 한다.
  const tapped = await page.evaluate(() => window.__store.getState().tools.dropper.holds);
  const db = await box('[data-id="dropper"]');
  await touch('touchStart', ...center(db));
  await touch('touchEnd', ...center(db));
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__store.getState().tools.dropper.holds) === tapped,
     '손가락 — 움직이지 않은 것은 끌기로 치지 않는다');

  // 손가락으로 눌렀을 때 말풍선이 떠서 안 사라지면 실험대를 가린다 (실제로 그랬다).
  ok(await page.evaluate(() => document.querySelector('#bench-tip').hidden),
     '손가락 — 탭한 뒤 말풍선이 남아 실험대를 가리지 않는다');
}

/* ────────────────────────────────────────────────────────────────
 * 폰에서 **겨눈 것이 집히는가.**
 *
 * `.token::after` 가 그림을 `MIN_HIT_PX`(44) 까지 넓혀 손가락에 잡히게 한다.
 * 데스크톱에서는 안 겹치는데 **폰(420 px)에서는 물건 자체가 14~38 px 이라 열여섯 짝이
 * 포개진다.** 그때는 DOM 에서 나중에 그려진 것이 이벤트를 가져가므로,
 * **스포이트 한가운데를 눌러도 겹쳐 있는 핀셋이 집혔다.**
 *
 * 스포이트를 병으로 끌었다고 생각했는데 실제로 끌린 것은 핀셋이었고, 핀셋은 병을 안 받으므로
 * **아무 일도 안 일어나고 아무 말도 안 나왔다.** 데스크톱에서만 재면 영영 안 보인다 —
 * 교실에서 쓰는 것은 태블릿이다.
 * (웨이브 2 의 chromatography 세션이 자기 저장소에서 먼저 짚었다)
 * ──────────────────────────────────────────────────────────────── */
{
  const ph = await browser.newPage({ viewport: { width: 420, height: 880 }, hasTouch: true });
  await ph.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(ph);
  await ph.evaluate(() => window.__store.dispatch('PEEL_BANANA', {}));
  await ph.waitForTimeout(300);

  const pBox = (sel) => ph.locator(sel).boundingBox();
  const pDrag = async (from, to) => {
    const [a, b] = [await pBox(`[data-id="${from}"]`), await pBox(`[data-id="${to}"]`)];
    if (!a || !b) return { grabbed: '(토큰 없음)', hot: '(토큰 없음)' };
    const [x0, y0] = center(a);
    const [x1, y1] = center(b);
    await ph.mouse.move(x0, y0);
    await ph.mouse.down();
    await ph.waitForTimeout(60);
    const grabbed = await ph.evaluate(() => document.querySelector('.token--dragging')?.dataset.id ?? '(없음)');
    for (let i = 1; i <= 12; i++) {
      await ph.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12);
      await ph.waitForTimeout(16);
    }
    const hot = await ph.evaluate(() =>
      [...document.querySelectorAll('.token--target-hot')].map((e) => e.dataset.id).join(',') || '(없음)');
    await ph.mouse.up();
    await ph.waitForTimeout(200);
    return { grabbed, hot };
  };

  // 스포이트와 핀셋은 폰에서 넓힌 자리가 겹친다. 겨눈 쪽이 집혀야 한다.
  const r1 = await pDrag('dropper', 'bottleIKI');
  ok(r1.grabbed === 'dropper', '폰 — 겹친 자리에서 겨눈 물건이 집힌다', `집힌것 ${r1.grabbed}`);
  ok(r1.hot === 'bottleIKI', '폰 — 겨눈 물건 위에 놓을 곳 표시가 뜬다', `강조 ${r1.hot}`);
  ok(await ph.evaluate(() => window.__store.getState().tools.dropper.holds) === 'IKI',
     '폰 — 끌어다 놓으면 스포이트가 채워진다');

  const r2 = await pDrag('banana', 'slideA');
  ok(r2.grabbed === 'banana' && r2.hot === 'slideA',
     '폰 — 받침 유리 세 장이 붙어 있어도 겨눈 것이 잡힌다', `${r2.grabbed}→${r2.hot}`);

  // **배열 끝에 있는 물건으로도 잰다.**
  // 「목록에서 먼저 오는 것이 이긴다」 는 옛 방식과 가장 크게 어긋나는 것이 배열 끝이다.
  // 중간 것으로만 재면 **반쯤 우연히 맞는다** — osmosis 세션은 그 우연 때문에 놓기 판정을
  // 고쳤다고 적어 놓고 실제로는 근거가 없는 상태였다(되돌려도 153개가 전부 초록불).
  // 수단 Ⅲ 병은 세 병 중 배열 마지막이라 물 병(첫 번째)과 겹칠 때 갈린다.
  const r3 = await pDrag('dropper', 'bottleSUDAN');
  ok(r3.grabbed === 'dropper' && r3.hot === 'bottleSUDAN',
     '폰 — 배열 끝에 있는 물건을 겨눠도 그것이 잡힌다', `${r3.grabbed}→${r3.hot}`);
  ok(await ph.evaluate(() => window.__store.getState().tools.dropper.holds) === 'SUDAN3',
     '폰 — 배열 끝 물건에 놓아도 그것이 받는다',
     await ph.evaluate(() => window.__store.getState().tools.dropper.holds));

  // **한가운데만 재면 이 버그를 못 본다.**
  // 한가운데는 멀쩡한데 **가장자리가 새는 것**이 이 버그의 모양이다. catalase 세션이
  // 「그림 300점 중 15점이 이웃에게 갔다」 고 점수로 알려 준 이유가 그것이다 —
  // 그쪽에서는 원래 있던 「물건 한가운데를 짚으면 그 물건이 잡힌다」 검사가
  // 버그가 있는 상태에서도 **초록불**이었다.
  //
  // 그래서 **그려진 부분 안 3×3 격자**를 실제로 눌러 본다. 프레임이 아니라 그림 안이다 —
  // 프레임의 빈 귀퉁이는 이웃 것이 잡히는 게 옳다.
  for (const w of [320, 420]) {
    const gp = await browser.newPage({ viewport: { width: w, height: 900 }, hasTouch: true });
    await gp.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
    await unlock(gp);
    await gp.waitForTimeout(300);
    const stateSize = await gp.evaluate(() => JSON.stringify(window.__store.getState()).length);
    const pts = await gp.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('[data-id]')) {
        const svg = e.querySelector('svg');
        if (!svg) continue;
        const bb = svg.getBBox();
        const vb = svg.viewBox.baseVal;
        const r = e.getBoundingClientRect();
        const sx = r.width / vb.width;
        const sy = r.height / vb.height;
        const x0 = r.x + bb.x * sx;
        const y0 = r.y + bb.y * sy;
        const dw = bb.width * sx;
        const dh = bb.height * sy;
        for (let i = 1; i <= 3; i++) {
          for (let j = 1; j <= 3; j++) out.push({ id: e.dataset.id, x: x0 + dw * i / 4, y: y0 + dh * j / 4 });
        }
      }
      return out;
    });
    // **누르고 그 자리에서 떼면 그것은 탭이다 — 진짜 조작이 일어난다.**
    // 앞서는 그렇게 쟀다. 그랬더니 현미경을 짚으면 확대 뷰가 열려 실험대를 덮고,
    // 물건을 짚으면 재물대로 올라가 화면에서 사라졌다. 그러면 아무것도 안 집혀
    // `got` 이 null 이 되고 **「이웃에게 간 점 0개」로 초록불**이 뜬다.
    //
    // 재어 보니 **144점 중 19점(320px)·23점(420px)이 재지도 못한 채** 지나갔고,
    // 실험대 상태가 1,277 → 81,019 바이트로 불었다. 뒤엣점들은 **다른 실험대**를 잰 것이다.
    // (micrometer 세션이 자기 저장소에서 25/175 를 찾아 알려 주었다)
    //
    // → **빈 곳으로 조금 끌었다가 뗀다.** 움직였으니 탭이 아니고, 받는 것이 없으니
    //   아무 일도 안 남는다.
    const EMPTY = { x: 4, y: 4 };   // 실험대 밖 — 받는 물건이 없다
    const stray = [];
    let missed = 0;
    for (const pt of pts) {
      await gp.mouse.move(pt.x, pt.y);
      await gp.mouse.down();
      const got = await gp.evaluate(() => document.querySelector('.token--dragging')?.dataset.id ?? null);
      // 빈 곳으로 끌어 놓는다. 여기서 떼면 탭이 아니다.
      await gp.mouse.move(EMPTY.x, EMPTY.y, { steps: 3 });
      await gp.mouse.up();
      if (!got) missed++;
      else if (got !== pt.id) stray.push(`${pt.id}→${got}`);
    }

    // **이 둘이 먼저 초록불이어야 위의 숫자가 뜻이 있다.**
    // 아무것도 안 집혔는데 「이웃에게 간 점 0개」인 것은 재지 않은 것이다.
    ok(missed === 0, `폰 ${w}px — 그림 안 어느 점을 짚어도 무언가 집힌다 (앞 조건)`,
       `${pts.length}점 중 ${missed}점은 아무것도 안 집힘 — 이 숫자가 0이 아니면 아래 검사는 뜻이 없다`);
    const moved = await gp.evaluate(() => JSON.stringify(window.__store.getState()).length);
    ok(Math.abs(moved - stateSize) < 200, `폰 ${w}px — 다 짚어도 실험대가 안 변한다 (앞 조건)`,
       `상태 ${stateSize} → ${moved} — 짚는 것이 조작을 일으키고 있다`);

    ok(stray.length === 0, `폰 ${w}px — 그림 안 어느 점을 짚어도 그 물건이 잡힌다`,
       `${pts.length}점 중 ${stray.length}점이 이웃에게: ${stray.slice(0, 4).join(' ')}`);

    // **그림의 가장자리**도 짚어 본다. 3×3 격자는 안쪽만 보므로 가장자리 띠를 놓친다.
    //
    // 앞서는 「그림 **한가운데**까지의 거리」로 갈랐는데, 그러면 **크거나 긴 그림이 불리하다.**
    // 개수대(100×75)의 가장자리는 자기 한가운데보다 옆 물건의 한가운데가 더 가깝다 —
    // 재어 보니 320 px 에서 개수대 그림 위의 **68점**이 폐액통·휴지에게 갔다.
    // 지금은 **그림까지의 거리**(안이면 0)로 가른다.
    // (centrifuge 세션이 27×7 px 자를 재다 같은 자리를 찾았다)
    const edgeStray = [];
    for (const id of ['sink', 'tissue', 'waste', 'microscope']) {
      const epts = await gp.evaluate((id) => {
        const e = document.querySelector(`[data-id="${id}"]`);
        if (!e) return [];
        const svg = e.querySelector('svg');
        const bb = svg.getBBox();
        const vb = svg.viewBox.baseVal;
        const r = e.getBoundingClientRect();
        const sx = r.width / vb.width;
        const sy = r.height / vb.height;
        const x0 = r.x + bb.x * sx;
        const y0 = r.y + bb.y * sy;
        const dw = bb.width * sx;
        const dh = bb.height * sy;
        const out = [];
        for (let i = 0; i <= 4; i++) { out.push({ x: x0 + dw * i / 4, y: y0 + 1 }); out.push({ x: x0 + dw * i / 4, y: y0 + dh - 1 }); }
        for (let j = 1; j < 4; j++) { out.push({ x: x0 + 1, y: y0 + dh * j / 4 }); out.push({ x: x0 + dw - 1, y: y0 + dh * j / 4 }); }
        return out;
      }, id);
      for (const pt of epts) {
        await gp.mouse.move(pt.x, pt.y);
        await gp.mouse.down();
        const got = await gp.evaluate(() => document.querySelector('.token--dragging')?.dataset.id ?? null);
        await gp.mouse.up();
        if (got && got !== id) edgeStray.push(`${id}→${got}`);
      }
    }
    ok(edgeStray.length === 0, `폰 ${w}px — 큰 그림의 가장자리를 짚어도 그 물건이 잡힌다`,
       edgeStray.slice(0, 3).join(' '));

    // **말풍선이 집힐 물건의 이름을 말하는가.**
    //
    // 재기 전에 **포커스를 떨군다.** 앞 단계가 물건에 포커스를 남겨 두면 「키보드로 연
    // 말풍선」이 살아 있고, `keyboardTipAlive()` 가 hover 갱신을 **일부러 막는다** —
    // 마우스가 그 위를 지나며 키보드 말풍선을 덮어쓰면 「여기에 놓기」 단추가 사라져
    // 키보드로 쓰는 사람이 그 단추에 닿을 수 없기 때문이다.
    // 그 상태에서 재면 「말풍선은 받침 유리, 집힌 것은 폐액통」이 나오는데,
    // **앱이 옳게 동작한 것이고 검사가 틀린 것이다.** 여기서 재려는 것은 hover 말풍선이다.
    await gp.evaluate(() => document.activeElement?.blur?.());
    await gp.mouse.move(4, 4);
    await gp.waitForTimeout(150);
    // 겹친 자리에서 집는 것만 고치면, 「받침 유리 통」 이라 적힌 것을 눌렀는데
    // **받침 유리가 끌린다.** 이름과 손이 다른 것을 가리키면 화면이 거짓말을 하는 것이다.
    // 고치기 전 320 px 에서 예순네 점 중 열여덟 점이 그랬다.
    // **좌표를 다시 잰다.** 위 격자 루프가 물건을 하나씩 끌었다 놓았으므로 그 사이에
    // 실험대가 달라졌을 수 있다. 묵은 좌표로 재면 「말풍선은 받침 유리, 집힌 것은 폐액통」
    // 같은 값이 나오는데 — **앱이 옳고 검사가 옛 자리를 짚은 것**이다.
    // (chromatography 세션이 매 점마다 물건을 끌면서 재다 같은 자리에 걸렸다)
    const freshPts = await gp.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('[data-id]')) {
        const svg = e.querySelector('svg');
        if (!svg) continue;
        const bb = svg.getBBox();
        const vb = svg.viewBox.baseVal;
        const r = e.getBoundingClientRect();
        const sx = r.width / vb.width;
        const sy = r.height / vb.height;
        out.push({ id: e.dataset.id, x: r.x + (bb.x + bb.width / 2) * sx, y: r.y + (bb.y + bb.height / 2) * sy });
      }
      return out;
    });
    const lied = [];
    for (const pt of freshPts) {
      await gp.mouse.move(pt.x, pt.y);
      await gp.waitForTimeout(30);
      const tip = await gp.evaluate(() =>
        document.querySelector('#bench-tip')?.innerText.split('\n')[0]?.trim() ?? '');
      await gp.mouse.down();
      const got = await gp.evaluate(() => document.querySelector('.token--dragging')?.dataset.id ?? null);
      await gp.mouse.up();
      if (!got || !tip) continue;
      const name = await gp.evaluate((id) =>
        document.querySelector(`[data-id="${id}"]`)?.getAttribute('aria-label') ?? '', got);
      if (name && tip !== name) lied.push(`"${tip}"≠"${name}"`);
    }
    ok(lied.length === 0, `폰 ${w}px — 말풍선이 집힐 물건의 이름을 말한다`,
       lied.slice(0, 3).join(' '));
    await gp.close();
  }
  await ph.close();
}

/* ────────────────────────────────────────────────────────────────
 * **잘된 조작이 말을 하는가.**
 *
 * store 가 `outcome !== 'ok'` 일 때만 문구를 내보내고 있어서, `rules.js` 가 잘된 조작에
 * 달아 둔 문구 **열여섯 개**가 전부 버려졌다. 껍질을 벗겨도, 시료를 발라도, 스포이트를
 * 채워도 화면은 아무 말도 하지 않았다.
 *
 * **콘솔 에러도 안 난다.** 규칙 검사는 `reduce()` 가 문구를 돌려주는 것만 보므로 초록불이고,
 * `docs/banana-progress.md` 의 T25 는 「토스트가 말을 하게 했다」 고 적어 두었다.
 * 문이 안 열려 있다는 것은 **브라우저를 열어야만** 보였다.
 * (germination 세션이 자기 저장소에서 먼저 찾아 넘겨 주었다)
 * ──────────────────────────────────────────────────────────────── */
{
  const sp = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await sp.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(sp);
  await sp.waitForTimeout(250);

  const said = [];
  await sp.exposeFunction('_said', (t) => said.push(t));
  await sp.evaluate(() => new MutationObserver(() => {
    const t = document.querySelector('.toast');
    if (t?.innerText.trim()) window._said(t.innerText.trim());
  }).observe(document.body, { childList: true, subtree: true }));

  const r = await sp.evaluate(() => window.__store.dispatch('PEEL_BANANA', {}));
  await sp.waitForTimeout(400);
  ok(r.outcome === 'ok' && Boolean(r.message), '   (앞 조건) 잘된 조작이 문구를 갖고 있다', r.message);
  ok(said.some((t) => t.includes('껍질')), '잘된 조작도 화면에서 말을 한다', said.join(' | ') || '(아무 말도 없음)');
  await sp.close();
}

/* ────────────────────────────────────────────────────────────────
 * 탐구 과정 — **한 번에 한 STEP.**
 *
 * **「접어지는가」로 시험하면 `toggle` 을 들어도 통과한다** — 사람이 접으면 어느 쪽이든
 * `open=false` 가 기록되기 때문이다. **「끝내면 저절로 접히는가」로 재야** 갈린다.
 * micrometer 에서 직접 재현한 갈림이다:
 *     toggle        STEP1 완료 → 1:done**펼침**  2:now펼침   ← 영영 안 접힘
 *     summary click STEP1 완료 → 1:done접힘     2:now펼침
 * ──────────────────────────────────────────────────────────────── */
{
  const ac = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await ac.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(ac);
  await ac.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => /^4\.\s/.test(b.innerText.trim()))[0]?.click());
  await ac.waitForTimeout(350);

  const shape = () => ac.evaluate(() => [...document.querySelectorAll('details[data-step-group]')]
    .map((d) => `${d.dataset.stepGroup}:${d.dataset.state}${d.open ? '펼침' : '접힘'}`).join(' '));
  const openCount = () => ac.evaluate(() =>
    document.querySelectorAll('details[data-step-group][open]').length);

  ok(await openCount() === 1, '4절 — 지금 할 차례인 STEP 하나만 펼쳐져 있다', await shape());

  /** STEP 하나의 관찰 기록 칸을 **다시 찾아 가며** 채운다 (칸마다 노트가 다시 그려진다). */
  async function writeGroup(id) {
    let n = 0;
    for (let i = 0; i < 12; i += 1) {
      const wrote = await ac.evaluate((gid) => {
        const t = [...document.querySelectorAll('#note-step-4 textarea[data-note]')]
          .find((x) => x.dataset.note.startsWith(gid) && !x.value.trim());
        if (!t) return false;
        t.value = '적었습니다';
        t.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }, id);
      if (!wrote) break;
      n += 1;
      await ac.waitForTimeout(180);
    }
    return n;
  }

  // **조작만으로는 안 넘어간다.** 적을 자리가 계속 펼쳐져 있어야 한다 —
  // 조작을 마치자마자 접혀 버리면 다음은 잠겨 있으므로 **아무것도 안 펼쳐진 벽**이 남는다.
  await ac.evaluate(() => window.__store.dispatch('PEEL_BANANA', {}));
  await ac.waitForTimeout(400);
  const acted = await shape();
  ok(/1:done펼침/.test(acted) && await openCount() === 1,
     '4절 — 조작만 하고 안 적으면 그 STEP 이 펼쳐진 채로 남는다', acted);

  // **끝내면 저절로 접히는가.** 이것이 toggle 함정의 눈에 보이는 얼굴이다.
  // 「끝냈다」 는 조작과 기록이 **둘 다** 된 것이다.
  ok(await writeGroup('1') > 0, '   (앞 조건) STEP 1 의 관찰 기록을 채웠다');
  const after = await shape();
  ok(/1:done접힘/.test(after) && /2:now펼침/.test(after),
     '4절 — 조작하고 적고 나면 저절로 접히고 다음이 펼쳐진다', after);

  /*
   * **앞 STEP 을 안 적었으면 뒤 STEP 은 열리지 않는다.**
   *
   * 여기서 두 가지가 갈린다. 「안 열린다」 만 보면, 눌러도 아무 일 안 나는 화면과
   * 왜 안 되는지 말해 주는 화면이 **똑같이 통과한다.** 학생에게는 그 둘이 전혀 다르다 —
   * 말이 없으면 고장으로 읽고 새로고침한다. 그래서 **이유가 화면에 있는지**를 함께 잰다.
   * 그리고 그 이유는 **어느 STEP 으로 돌아가야 하는지**를 담아야 한다.
   */
  const locked = () => ac.evaluate(() => {
    const el = document.querySelector('[data-step-group="5"]');
    return { tag: el?.tagName, state: el?.dataset.state,
             why: el?.querySelector('.step-locked-why')?.innerText.trim() ?? '' };
  });
  {
    const L = await locked();
    ok(L.tag === 'DIV' && L.state === 'locked',
       '4절 — 앞 STEP 을 안 적으면 뒤 STEP 이 열리지 않는다', JSON.stringify(L));
    ok(L.why.length > 0 && /STEP\s*2/.test(L.why),
       '4절 — 안 열리는 이유와 돌아갈 STEP 을 화면에 말한다', L.why || '(아무 말도 없음)');
  }

  /*
   * **적고 나면 실제로 열리는가.** 위 검사만 두면 「영영 안 열리는 화면」 도 통과한다.
   * STEP 1 의 관찰 기록 칸을 채워서 자물쇠가 풀리는지 본다 — 두 방향을 다 재야 판정이 된다.
   */
  /*
   * **한 칸 채울 때마다 노트가 통째로 다시 그려진다.** 칸 목록을 미리 붙잡아 두고 훑으면
   * 두 번째부터는 DOM 에서 떨어져 나간 칸에 쓰게 되고, 아무 오류 없이 한 칸만 저장된다.
   * 그러면 자물쇠가 안 풀리는데 그것을 「기능이 안 된다」 로 읽게 된다. 매번 다시 찾는다.
   *
   * 잠긴 STEP 은 몸통을 안 그리므로 그 칸들은 아직 DOM 에 없다. 앞을 적으면 다음이 드러난다 —
   * 그래서 한 칸씩, 드러나는 대로 채워 나간다.
   */
  let filled = 0;
  for (let n = 0; n < 40 && (await locked()).state === 'locked'; n += 1) {
    const wrote = await ac.evaluate(() => {
      const t = [...document.querySelectorAll('#note-step-4 textarea[data-note]')]
        .find((x) => !x.value.trim());
      if (!t) return false;
      t.value = '적었습니다';
      t.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    if (!wrote) break;
    filled += 1;
    await ac.waitForTimeout(180);
  }
  ok(filled > 0, '   (앞 조건) 앞 STEP 의 관찰 기록 칸을 실제로 채웠다', `${filled}칸`);
  ok((await locked()).state !== 'locked',
     '4절 — 앞을 다 적고 나면 뒤 STEP 이 열린다', JSON.stringify(await locked()));

  // **접힘은 잠금이 아니다** — 자물쇠가 풀린 다음에는 앞으로 올 STEP 도 눌러서 열려야 한다.
  await ac.locator('details[data-step-group="5"] > summary').click({ timeout: 3000 });
  await ac.waitForTimeout(250);
  ok(/5:later펼침/.test(await shape()), '4절 — 앞으로 올 STEP 도 눌러서 열린다', await shape());

  // 손으로 연 것은 다시 그려도 그대로다.
  await ac.evaluate(() => window.__store.dispatch('SMEAR', { slide: 'A', thickness: 0.3 }));
  await ac.waitForTimeout(400);
  ok(/5:later펼침/.test(await shape()), '4절 — 손으로 연 STEP 은 다시 그려도 열려 있다', await shape());

  ok(await ac.evaluate(() => document.querySelectorAll('#note-step-4 [disabled]').length) === 0,
     '4절 — 잠글 때도 disabled 를 쓰지 않는다 (열리는 척하다 안 열리는 것이 가장 나쁘다)');
  await ac.close();
}

/* ────────────────────────────────────────────────────────────────
 * STEP 자물쇠가 **조용히 죽지 않는가.**
 *
 * 「한 번 열어 본 STEP 은 다시 안 잠근다」 는 옳다 — 열려 있던 것이 사라지면 고장으로 읽힌다.
 * 그런데 **「열어 본 적 있다」 를 「그때 안 잠겨 있었다」 로 쌓으면 자물쇠가 통째로 죽는다.**
 *
 * 학생이 조작은 안 하고 STEP 1 의 관찰 기록만 먼저 채우면, 그 순간 잠글 조건이 사라져
 * **여섯이 통째로 「열어 본 것」 이 된다.** 그 뒤로는 무엇을 해도 영영 안 잠긴다.
 * 화면은 멀쩡하고 단위 검사도 초록불이다 — 이건 브라우저에서만 보인다.
 * (웨이브 2 의 osmosis 세션이 자기 저장소에서 잡았다)
 * ──────────────────────────────────────────────────────────────── */
{
  const lk = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await lk.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(lk);
  await lk.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => /^4\.\s/.test(b.innerText.trim()))[0]?.click());
  await lk.waitForTimeout(350);

  const lockedCount = () => lk.evaluate(() =>
    document.querySelectorAll('[data-step-group][data-state="locked"]').length);
  ok(await lockedCount() > 0, '   (앞 조건) 처음에는 뒤 STEP 이 잠겨 있다', `${await lockedCount()}개`);

  // ① **조작은 안 하고 기록만** 채운다. 이때 STEP 1 의 조건이 풀려 아무것도 안 잠긴다.
  for (let i = 0; i < 6; i += 1) {
    const wrote = await lk.evaluate(() => {
      const t = [...document.querySelectorAll('#note-step-4 textarea[data-note]')]
        .find((x) => /^1[a-z]$/.test(x.dataset.note) && !x.value.trim());
      if (!t) return false;
      t.value = '적었습니다';
      t.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    if (!wrote) break;
    await lk.waitForTimeout(180);
  }
  ok(await lockedCount() === 0, '   (앞 조건) 지금 STEP 을 다 적으면 잠금이 풀린다', `${await lockedCount()}개`);

  /*
   * ①-b **잠기기 전에 맨 뒤 STEP 을 손으로 펼쳐 둔다.**
   *
   * ★ 여기서 「지금 안 열린 것 아무거나」 를 집으면 **아무것도 증명하지 못한다.** 그 시점에
   * 접혀 있는 것은 이미 끝난 STEP 1 뿐이고, 그건 애초에 잠길 수 없는 자리다(지금보다 앞).
   * 「STEP 1 → done」 을 받고 초록불이 나는데 실제로는 맨 뒤가 도로 잠겨 있었다.
   * (웨이브 1 의 micrometer 세션이 이 헛초록불을 잡았다)
   *
   * **확실히 「앞으로 올 STEP」 인 맨 뒤**를 연다. 지금은 아무것도 안 잠겨 있어 열린다.
   */
  const back = await lk.evaluate(() => {
    const all = [...document.querySelectorAll('details[data-step-group]')];
    return all[all.length - 1]?.dataset.stepGroup ?? null;
  });
  ok(back !== null, '   (앞 조건) 맨 뒤 STEP 을 손으로 펼칠 수 있다', `STEP ${back}`);
  if (back) {
    await lk.locator(`details[data-step-group="${back}"] > summary`).click({ timeout: 3000 });
    await lk.waitForTimeout(250);
  }

  // ② 이제 조작을 마치면 다음 STEP 이 「지금」 이 되고, 그 기록은 비어 있다.
  //    **아직 펼쳐 본 적 없는 뒤엣것은 다시 잠겨야 한다.**
  await lk.evaluate(() => window.__store.dispatch('PEEL_BANANA', {}));
  await lk.waitForTimeout(400);

  /*
   * ★ **「지금 STEP 이 실제로 넘어갔는가」 를 먼저 본다.**
   *
   * 안 넘어갔으면 잠글 근거 자체가 없어서, **자물쇠가 죽었는지 멀쩡한지 구별이 안 된다** —
   * 그 상태의 빨간불을 보고 앱을 의심하게 된다. 조작 하나를 빠뜨려 STEP 이 안 끝나는 일은
   * 실험마다 다른 자리에서 난다. (웨이브 2 의 osmosis 세션이 그 자리에서 한 번 헛짚었다)
   */
  const moved = await lk.evaluate(() => {
    const el = document.querySelector('[data-step-group="1"]');
    return { state: el?.dataset.state, done: el?.dataset.done };
  });
  ok(moved.done === 'true' && moved.state !== 'now',
     '   (앞 조건) 조작으로 STEP 1 이 실제로 끝났다', JSON.stringify(moved));

  ok(await lockedCount() > 0,
     '자물쇠 — 기록만 먼저 채워도 자물쇠가 죽지 않는다',
     `조작 뒤 잠긴 STEP ${await lockedCount()}개 (0이면 통째로 죽은 것)`);

  /*
   * ③ **반대 방향 — 그리고 이쪽이 더 잘 샌다.**
   *
   * 누를 때는 다시 그리지 않으므로(`<details>` 가 알아서 열린다), 그리는 쪽에서만
   * 「열어 봤다」 를 담으면 그 STEP 은 담기지 못한 채 다음 렌더에서 잠긴다 —
   * **눈앞에서 펼쳐져 있던 것이 사라진다.** 잠긴 갈래가 먼저 `return` 하니 영영 못 담는다.
   * 그래서 **누르는 자리에서도** 담아야 한다.
   * (catalase 와 micrometer 두 세션이 각각 잡았다)
   */
  if (back) {
    const after = await lk.evaluate((g) => ({
      mine: document.querySelector(`[data-step-group="${g}"]`)?.dataset.state,
      locked: document.querySelectorAll('[data-step-group][data-state="locked"]').length,
    }), back);
    ok(after.mine !== 'locked',
       '자물쇠 — 손으로 펼쳐 둔 맨 뒤 STEP 은 그 뒤에도 안 잠긴다',
       `STEP ${back} → ${after.mine}`);
    ok(after.locked > 0,
       '   (앞 조건) 그때 펴 본 적 없는 STEP 은 실제로 다시 잠긴다', `${after.locked}개`);
  }
  /*
   * ④ **저절로 열렸던 STEP 도 면제여야 한다 — 이건 ③ 과 다른 경우다.**
   *
   * 「지금 할 차례」라서 저절로 펼쳐진 STEP 은 **학생이 누른 적이 없다.** 누르는 자리에서만
   * 담으면 그런 STEP 은 안 담기고, 학생이 **앞 STEP 의 기록을 지우는 순간**
   * 「지금 자리」가 뒤로 밀려 **봤던 것이 잠긴다.**
   *
   * 그래서 두 줄은 **서로 다른 경우**를 지킨다 — 누른 것과 저절로 열린 것.
   * 「둘 다 넣었다」 로 끝내면 한 줄이 언제 사라져도 아무도 모른다.
   * (웨이브 3 의 germination 세션이 되돌려 보고 잡았다)
   */
  {
    const auto = await lk.evaluate(() =>
      document.querySelector('details[data-step-group][data-state="now"]')?.dataset.stepGroup ?? null);
    ok(auto !== null, '   (앞 조건) 저절로 펼쳐진 「지금」 STEP 이 있다', `STEP ${auto}`);
    if (auto) {
      // 앞 STEP 의 기록을 지운다 → 「지금 자리」가 뒤로 밀려 이 STEP 이 잠길 자리가 된다.
      // **한 번의 렌더로 잠기게** 한다 — 사이에 「아직 아무것도 안 잠긴」 렌더가 끼면
      // 그때 담겨 버려서 고장난 코드가 그대로 초록불을 받는다.
      await lk.evaluate(() => {
        const now = document.querySelector('details[data-step-group][data-state="now"]');
        const prev = now?.previousElementSibling;
        for (const t of prev?.querySelectorAll('textarea[data-note]') ?? []) {
          if (!t.value.trim()) continue;
          t.value = '';
          t.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await lk.waitForTimeout(400);
      const st = await lk.evaluate((g) => ({
        mine: document.querySelector(`[data-step-group="${g}"]`)?.dataset.state,
        locked: document.querySelectorAll('[data-step-group][data-state="locked"]').length,
      }), auto);
      ok(st.mine !== 'locked',
         '자물쇠 — 저절로 펼쳐졌던 STEP 도 누른 적 없어도 다시 안 잠긴다',
         `STEP ${auto} → ${st.mine}`);
      ok(st.locked > 0, '   (앞 조건) 그때 다른 STEP 은 실제로 잠겨 있다', `${st.locked}개`);
    }
  }

  await lk.close();
}

/* ────────────────────────────────────────────────────────────────
 * 탐구 노트가 **학생을 다음 쪽으로 데려가는가.**
 *
 * 「이 쪽을 읽었습니다」 를 누르면 그 자리에 ✓ 만 남고 아무 일도 안 일어났다. 학생은 자기가
 * 무엇을 더 해야 하는지 모른 채 그 쪽에 서 있었다 — 탭을 직접 찾아 눌러야 다음이었다.
 *
 * 그리고 예상 쪽에서는 **예상을 세우기 전에 넘어가지 못한다.** 막는 것 자체보다
 * **말 없이 막는 것**이 나쁘므로, 왜 못 누르는지가 화면에 있는지도 함께 잰다.
 * ──────────────────────────────────────────────────────────────── */
{
  const nb = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await nb.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  const activeTab = () => nb.evaluate(() =>
    document.querySelector('.note-tab[aria-selected="true"]')?.dataset.stage ?? '(없음)');

  ok(await activeTab() === '1', '   (앞 조건) 탐구 노트는 1 쪽에서 시작한다', await activeTab());

  /*
   * **차례대로만 재면 이 버그는 절대 안 나타난다.**
   *
   * 넘길 곳을 「아직 안 읽은 쪽」 으로 고르면, 차례대로 읽는 동안에는 늘 맞다.
   * 그런데 4 쪽을 먼저 읽어 둔 학생이 3 쪽에서 누르면 **거꾸로 끌려가거나 아무 데도 안 간다.**
   * 그래서 **마지막 쪽에서 먼저** 눌러 보고, 그 다음에 앞쪽에서 눌러 본다.
   * (fermentation 세션이 자기 저장소에서 실제로 두 번 물린 자리다.)
   */
  // ① 마지막 읽기 쪽(4)에서는 **그 자리에 머문다.** 누르는 순간 실험대가 열리고,
  //    그 쪽이 실험하는 내내 보는 「탐구 과정」이다.
  await nb.locator('.note-tab[data-stage="4"]').click();
  await nb.waitForTimeout(200);
  await nb.locator('#mark-read').click();
  await nb.waitForTimeout(250);
  const afterLast = await activeTab();

  /*
   * ② **가운데 쪽들을 먼저 읽어 두고 맨 앞에서 누른다.** 이것이 갈리는 조합이다.
   *
   * 마지막 쪽에서 안 넘기는 앱에서는 「4쪽 먼저 → 1쪽에서 누르기」로 **두 구현이 같은 답**을
   * 낸다. 2·3 을 채워 두어야 「자리로 고르기(→2)」와 「안 읽은 쪽으로 고르기(→1 또는 5)」가
   * 갈린다. (chromatography·centrifuge 두 세션이 숫자로 갈라 보였다)
   */
  await nb.evaluate(() => {
    window.__store.dispatch('MARK_READ', { stage: '2' });
    window.__store.dispatch('MARK_READ', { stage: '3' });
  });
  await nb.waitForTimeout(150);
  await nb.locator('.note-tab[data-stage="1"]').click();
  await nb.waitForTimeout(200);
  await nb.locator('#mark-read').click();
  await nb.waitForTimeout(250);
  ok(afterLast === '4' && await activeTab() === '2',
     '노트 — 뒤쪽을 먼저 읽어 뒀어도 앞뒤가 안 뒤바뀐다',
     `4쪽에서 누른 뒤 ${afterLast}(4여야 함) → 2·3 읽어 둔 뒤 1쪽에서 누르니 ${await activeTab()}(2여야 함)`);

  // 여기서부터는 다시 처음 상태로 본다.
  await nb.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await nb.waitForTimeout(250);
  await nb.locator('#mark-read').click();
  await nb.waitForTimeout(250);
  ok(await activeTab() === '2', '노트 — 「읽었습니다」 를 누르면 다음 쪽으로 데려간다', await activeTab());

  // 1 쪽에 ✓ 가 제대로 붙었는가. **넘길 쪽과 표시할 쪽을 헷갈리면 2 쪽에 ✓ 가 붙는다** —
  // 화면은 멀쩡해 보이고, 학생은 안 읽은 쪽이 읽은 것으로 되어 있는 것을 모른다.
  const marks = await nb.evaluate(() => [...document.querySelectorAll('.note-tab')]
    .map((t) => `${t.dataset.stage}:${t.dataset.read}`).join(' '));
  ok(/1:true/.test(marks) && /2:false/.test(marks),
     '노트 — ✓ 는 넘어간 쪽이 아니라 **읽은 쪽**에 붙는다', marks);

  await nb.locator('.note-tab[data-stage="3"]').click();
  await nb.waitForTimeout(250);
  const gate = () => nb.evaluate(() => {
    const b = document.querySelector('#mark-read');
    const said = b?.getAttribute('aria-describedby');
    return { off: b?.getAttribute('aria-disabled') === 'true',
             reachable: Boolean(b && !b.disabled),
             // 낭독기가 단추를 읽을 때 이유까지 함께 읽는가. 이 줄이 없으면 이유는
             // **눈으로 보는 사람에게만** 있는 것이 된다.
             told: Boolean(said && document.getElementById(said)?.innerText.trim()),
             why: b?.closest('.read-mark')?.querySelector('p')?.innerText.trim() ?? '' };
  });
  {
    const g = await gate();
    ok(g.off === true, '노트 — 예상을 안 세우면 「읽었습니다」 가 막혀 있다', JSON.stringify(g));
    ok(/예상/.test(g.why), '노트 — 왜 안 눌리는지 화면에 말한다', g.why || '(아무 말도 없음)');

    // **`disabled` 로 막지 않는다.** 그 속성은 포커스를 빼앗아, 키보드로 그 단추에 닿을 수 없고
    // 낭독기가 지나쳐 버린다 — 왜 못 누르는지 들을 방법이 사라진다.
    ok(g.reachable, '노트 — 막혔어도 키보드로 닿는다 (disabled 가 아니다)', JSON.stringify(g));
    ok(g.told, '노트 — 낭독기도 이유를 함께 듣는다 (aria-describedby)', JSON.stringify(g));

    // **표시만 하고 안 막으면 표시가 거짓말이 된다.** 실제로 눌러 보고 안 넘어가는지 본다.
    // `force` 를 붙인다 — 플레이라이트는 `aria-disabled="true"` 를 「못 누르는 것」 으로 보고
    // 그냥 기다리다 시간이 다한다. 여기서 보려는 것은 **눌렸을 때 무슨 일이 나는가**다.
    await nb.locator('#mark-read').click({ force: true });
    await nb.waitForTimeout(250);
    ok(await activeTab() === '3', '노트 — 막힌 단추는 눌려도 안 넘어간다', await activeTab());
  }

  // **반대 방향도 잰다.** 「늘 안 눌리는 단추」 도 위 검사만으로는 통과한다.
  for (const id of ['A', 'B', 'C']) {
    await nb.evaluate((k) => window.__store.dispatch('SAVE_NOTE', { step: `predict.${k}`, text: '색이 변한다' }), id);
    await nb.waitForTimeout(120);
  }
  ok((await gate()).off === false, '노트 — 예상을 세우면 눌린다', JSON.stringify(await gate()));
  await nb.locator('#mark-read').click();
  await nb.waitForTimeout(250);
  ok(await activeTab() === '4', '노트 — 예상 쪽에서도 다음 쪽으로 데려간다', await activeTab());
  await nb.close();
}

/* ────────────────────────────────────────────────────────────────
 * 자기 평가의 가치·태도는 **적어만 둔다.**
 *
 * 예전에는 손 씻기·마개 닫기·폐액 버리기를 지켜보고 ✓/✗ 를 붙였다. 그런데 그 판정은
 * 「화면 속 단추를 눌렀는가」 를 재는 것이었다 — 안전 습관이 아니라 조작 순서 외우기다.
 * 판정도 조작도 통째로 걷어냈다.
 *
 * 그래서 여기서 잴 것은 둘이다: **아무 판정도 안 하는가**, 그리고 **그래도 말은 하는가.**
 * 앞엣것만 재면 **빈 칸**도 통과한다 — 지우고 아무것도 안 넣은 화면이 제일 그럴듯하게 통과한다.
 * ──────────────────────────────────────────────────────────────── */
{
  const sv = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await sv.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(sv);
  await sv.locator('.note-tab[data-stage="7"]').click();
  await sv.waitForTimeout(250);
  const values = () => sv.evaluate(() => {
    const box = document.querySelector('#values-list')?.closest('.self-eval-item');
    return { lines: document.querySelectorAll('#values-list li').length,
             text: box?.innerText.replace(/\s+/g, ' ').trim() ?? '' };
  });
  {
    const v = await values();
    ok(v.lines >= 3, '자기 평가 — 실제 실험에서 지킬 것이 적혀 있다', `${v.lines}줄`);
    ok(!/지켰습니다|놓쳤습니다|아직 하지 않았습니다|✓|✗/.test(v.text),
       '자기 평가 — 무엇을 했는지 판정하지 않는다', v.text.slice(0, 120));
    ok(/확인하지 않습니다/.test(v.text),
       '자기 평가 — 판정하지 않는다는 사실을 밝힌다', v.text.slice(0, 120));
  }

  /*
   * **실험을 하고 와도 그대로인가.** 위 검사만 두면 「처음에는 안 하다가 나중에 판정하는」
   * 화면도 통과한다. 시약을 쓰고 돌아와서 글자 그대로 같은지 본다.
   */
  const before = (await values()).text;
  await sv.evaluate(() => {
    const d = (t, p = {}) => window.__store.dispatch(t, p);
    d('PEEL_BANANA', {});
    d('SMEAR', { slide: 'A', thickness: 0.3 });
    d('FILL_DROPPER', { reagent: 'IKI' });
  });
  await sv.waitForTimeout(300);
  await sv.locator('.note-tab[data-stage="1"]').click();
  await sv.waitForTimeout(150);
  await sv.locator('.note-tab[data-stage="7"]').click();
  await sv.waitForTimeout(250);
  ok((await values()).text === before,
     '자기 평가 — 실험을 하고 와도 같은 글이 그대로 있다',
     before === (await values()).text ? '같음' : '달라짐');
  await sv.close();
}

/* ────────────────────────────────────────────────────────────────
 * **키보드 말풍선이 밑의 물건을 죽이지 않는가.**
 *
 * 포커스로 뜬 말풍선에는 「여기에 놓기」 단추가 붙는다. 그래서 이때만 포인터를 받아야 하는데,
 * `:has(.tip-actions)` 로 **말풍선을 통째로** 받게 해 두면 —
 * **키보드로 물건 하나에 Tab 해 두는 것만으로 그 말풍선이 덮은 자리의 물건이 안 집힌다.**
 * 말풍선이 사건을 삼키고 **콘솔 오류 한 줄 없이 아무 일도 안 일어난다.**
 *
 * **마우스만으로는 몇만 점을 눌러도 안 나온다. 키보드를 섞어야 드러난다.**
 * (germination 세션이 「반증해 보라」로 시켜 찾았다 — 「맞는지 확인해라」였으면 못 찾았다)
 *
 * 단추 자리는 그대로 둔다 — 눌리라고 있는 자리다. **몸통만** 본다.
 *
 * ── 정직하게: **이 검사는 이 저장소에서 그 버그를 못 잡는다** ──────
 * CSS 를 `:has(.tip-actions){pointer-events:auto}` 로 되돌려도 **0점**이다.
 * 재어 보니 말풍선이 그림점 위에 오더라도 `elementFromPoint` 는 여전히 **물건**을 돌려준다 —
 * 이 저장소의 말풍선 자리와 물건 배치에서는 둘이 실제로 안 겹친다.
 * germination 세션의 목록은 **CSS 글자**로 고른 것이지 재서 고른 것이 아니었고,
 * 여기서 재 보니 해당이 없었다.
 *
 * 그러면 왜 두는가 — **배치를 옮기면 그때 생기는 버그**이기 때문이다. germination 은
 * 숟가락에 Tab 해 둔 것만으로 챔버 그림 한가운데 24점이 통째로 죽었다.
 * 이 검사는 「잡았다」가 아니라 **그 자리로 걸어 들어가는 것을 막는 울타리**다.
 * ──────────────────────────────────────────────────────────────── */
for (const w of [320, 768, 1400]) {
  const tp = await browser.newPage({ viewport: { width: w, height: 900 } });
  await tp.goto(`${BASE}/?level=1`, { waitUntil: 'networkidle' });
  await unlock(tp);
  await tp.waitForTimeout(250);
  // 키보드로 물건 하나에 포커스 → 말풍선에 놓기 단추가 붙는다
  await tp.locator('[data-id="banana"]').focus();
  await tp.waitForTimeout(250);
  const puts = await tp.evaluate(() => document.querySelectorAll('#bench-tip [data-onto]').length);

  const covered = await tp.evaluate(() => {
    const rr = document.querySelector('#bench-tip').getBoundingClientRect();
    const out = [];
    for (const e of document.querySelectorAll('[data-id]')) {
      const svg = e.querySelector('svg');
      if (!svg) continue;
      const bb = svg.getBBox();
      const vb = svg.viewBox.baseVal;
      const r = e.getBoundingClientRect();
      const sx = r.width / vb.width;
      const sy = r.height / vb.height;
      const x0 = r.x + bb.x * sx;
      const y0 = r.y + bb.y * sy;
      const dw = bb.width * sx;
      const dh = bb.height * sy;
      for (let i = 1; i <= 3; i++) {
        for (let j = 1; j <= 3; j++) {
          const px = x0 + dw * i / 4;
          const py = y0 + dh * j / 4;
          if (px < rr.x || px > rr.x + rr.width || py < rr.y || py > rr.y + rr.height) continue;
          if (document.elementFromPoint(px, py)?.closest('[data-onto]')) continue;  // 단추는 눌리는 게 맞다
          out.push({ id: e.dataset.id, x: px, y: py });
        }
      }
    }
    return out;
  });

  // **「0점 중 0점」을 초록불로 내보내지 않는다.** 배치가 저마다 달라 어떤 폭에서는
  // 말풍선이 덮는 그림점이 하나도 없다 — 그때 ✓ 를 내면 **아무것도 안 재고 통과**한 것이
  // 「괜찮다」로 읽힌다. (germination 세션이 짚었다)
  if (covered.length === 0) {
    ok(true, `키보드 — ${w}px 에서는 말풍선이 덮는 그림점이 없다 (이 폭에서는 못 잼)`);
  } else {
    const dead = [];
    for (const c of covered) {
      await tp.mouse.move(c.x, c.y);
      await tp.mouse.down();
      const got = await tp.evaluate(() => document.querySelector('.token--dragging')?.dataset.id ?? null);
      await tp.mouse.move(4, 4, { steps: 2 });
      await tp.mouse.up();
      if (!got) dead.push(c.id);
    }
    ok(dead.length === 0,
       `키보드 — ${w}px 말풍선 몸통이 밑의 물건을 죽이지 않는다`,
       `덮인 그림점 ${covered.length}점 중 ${dead.length}점이 안 집힘: ${[...new Set(dead)].slice(0, 3).join(' ')}`);
  }

  // **반쪽 고침 방지** — 몸통을 통과시키면서 단추까지 죽이면 키보드 길이 사라진다.
  await tp.locator('[data-id="banana"]').focus();
  await tp.waitForTimeout(200);
  await tp.keyboard.press('Tab');
  await tp.waitForTimeout(150);
  ok(await tp.evaluate(() => Boolean(document.activeElement?.dataset?.onto)),
     `키보드 — ${w}px 놓을 곳 단추는 그대로 눌린다`, `단추 ${puts}개`);
  await tp.close();
}

ok(errors.length === 0, '콘솔 에러 0건', errors.slice(0, 3).join(' / '));

await browser.close();

// 줄은 이미 하나씩 찍혔다 (`ok`). 여기서는 **실패만 다시 모아** 맨 밑에 놓는다 —
// 백몇 줄 위로 스크롤해 찾게 두지 않는다.
const failed = out.filter((r) => !r.pass);
const fail = failed.length;
if (fail) {
  console.log('\n다시 모은 실패:');
  for (const r of failed) console.log(`실패  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${out.length - fail}/${out.length} 통과`);
process.exit(fail ? 1 : 0);

