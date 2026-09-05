/**
 * 손가락으로 노트를 적을 때 — 아이패드에서 겪은 것.
 *
 *     node scripts/check-touch.mjs            # 여덟 실험
 *     node scripts/check-touch.mjs osmosis    # 하나만
 *
 * 사장님 제보 (2026-05-09 → 2026-09-05): 「탐구노트에 적고, 같은 STEP 내의 다음 칸에
 * 관찰기록 적으려고 하니까 터치가 잘 안 되네. 실험대에서 기물 아무거나 클릭해야지만
 * 다음 칸이 터치가 되어서 타이핑 커서가 깜빡여.」
 *
 * ── 왜 손가락에서만 났나 ────────────────────────────────────────────
 * **마우스는 `mousedown` 때 포커스가 옮겨 가지만, 손가락은 `touchend` → `click` 을 거친다.**
 * 그 사이에 판을 통째로 다시 그리면(`panelEl.innerHTML = …`) 뒤늦게 도착한 포커스가
 * **이미 버려진 마디**로 가서 `body` 에 떨어진다. 실험대를 한 번 누르면 그때 판이 갈린
 * 뒤라 다음 탭이 성한 마디에 앉는다 — 그래서 「기물을 눌러야 된다」로 보였다.
 *
 * 실제로 찍은 차례 (chromatography):
 *     pointerdown 2a · pointerup 2a · change 1a · focusin 2a · click 2a
 *     → 그 뒤에 판이 갈리고 → BODY
 *
 * ── 이 검사가 보는 것 둘 ────────────────────────────────────────────
 *   ① 적고 나서 **다음 칸을 짚으면 그 칸에 커서가 앉는가**
 *   ② 손이 노트를 떠나면 **밀어 둔 것이 그려지고 저장되는가**
 * 둘을 함께 봐야 한다. ①만 보면 「영영 안 그림」으로 도망칠 수 있고,
 * ②만 보면 원래 버그가 그대로 남는다. 한 자리를 고치다 반대쪽으로 넘어가기 쉬운 곳이다.
 *
 * `npm run check` 에는 안 넣는다 — 브라우저가 필요하다 (CLAUDE.md).
 */
import { chromium, devices } from 'playwright';
import { devUrl } from '../dev-port.js';
const EXPS = process.argv[2] ? [process.argv[2]]
  : ['banana','catalase','centrifuge','chromatography','fermentation','germination','micrometer','osmosis'];
const browser = await chromium.launch();
let bad = 0;
for (const exp of EXPS) {
  const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'] });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${devUrl()}/experiments/${exp}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /1단계로 시작하기/ }).tap();
  await page.waitForTimeout(500);
  // 노트 쪽을 다 읽은 것으로 만든다 — 여기서 보려는 것은 그 뒤의 글칸이다.
  const protoTab = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#bench-lock-left li')]
      .map((li) => li.textContent.split('.')[0].trim()).filter(Boolean);
    for (const stage of ids) window.__store.dispatch('MARK_READ', { stage });
    const t = [...document.querySelectorAll('.note-tab')].find((x) => x.textContent.includes('탐구 과정'));
    t?.click(); return t?.dataset.stage ?? null;
  });
  await page.waitForTimeout(400);
  /*
   * 글칸이 둘 이상인 STEP 까지 간다. 뒤 STEP 은 앞 STEP 의 관찰 기록을 적어야 열리므로
   * (`stepPanels`), 열린 것의 기록을 채워 가며 한 칸씩 나아간다.
   */
  let found = null;
  for (let round = 0; round < 8 && !found; round++) {
    found = await page.evaluate(() => {
      for (const d of document.querySelectorAll('details.note-step:not(.note-step--locked)')) {
        d.open = true;
        if (d.querySelectorAll('textarea[data-note]').length >= 2) return d.dataset.stepGroup;
      }
      return null;
    });
    if (found) break;
    const advanced = await page.evaluate(() => {
      const open = [...document.querySelectorAll('details.note-step:not(.note-step--locked)')];
      const last = open.at(-1);
      if (!last) return false;
      const boxes = [...last.querySelectorAll('textarea[data-note]')];
      if (!boxes.length) return false;
      for (const b of boxes) window.__store.dispatch('SAVE_NOTE', { step: b.dataset.note, text: '앞 칸을 채운다' });
      return true;
    });
    if (!advanced) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(250);
  /*
   * 같은 STEP 안에 둘이 없으면 **쪽 안의 아무 두 칸**으로 본다. 사장님이 겪으신 것은
   * 같은 STEP 이었지만, 판을 통째로 다시 그리는 것이 원인이라 자리를 안 가린다.
   */
  const boxes = found
    ? page.locator(`details.note-step[data-step-group="${found}"] textarea[data-note]`)
    : page.locator('#note-panel textarea[data-note]:visible, .note-panel textarea[data-note]:visible');
  const many = await boxes.count() >= 2;
  if (!many) {
    /*
     * 한 STEP 에 글칸이 하나뿐인 실험 — 「다음 칸 짚기」는 일어나지 않는다.
     * 그래도 **적고 손을 떼면 저장되는가**는 봐야 한다. 미루기 장치를 고치다
     * 반대쪽(영영 안 그림)으로 넘어가는 것이 이 자리의 흔한 실수다.
     */
    const one = boxes.first();
    if (await one.count() === 0) { console.log(`${exp.padEnd(15)} 글칸 없음 — 건너뜀`); await ctx.close(); continue; }
    await one.tap();
    await page.keyboard.type('적고 손을 뗀다');
    await page.waitForTimeout(120);
    await page.locator('.bench-stage').tap({ position: { x: 8, y: 8 } }).catch(() => {});
    await page.waitForTimeout(600);
    const saved = await page.evaluate(() => Object.values(window.__store?.getState()?.session?.notes ?? {})
      .some((v) => String(v).includes('적고 손을 뗀다')));
    if (!saved) bad++;
    console.log(`${exp.padEnd(15)} ${saved ? '통과' : '★ 실패'}  글칸 하나 — 적고 손을 떼면 저장된다`);
    await ctx.close(); continue;
  }
  const want = await boxes.nth(1).getAttribute('data-note');
  await boxes.nth(0).tap();
  await page.keyboard.type('물이 조금 올라왔다');
  await page.waitForTimeout(150);
  await boxes.nth(1).tap();
  await page.waitForTimeout(450);
  const got = await page.evaluate(() => document.activeElement?.dataset?.note
    ?? document.activeElement?.tagName ?? '(없음)');
  const ok = got === want;
  if (!ok) bad++;

  /*
   * **미루기만 하고 끝내 안 그리면 다른 버그가 된다.**
   * 손이 노트를 떠났을 때는 밀어 둔 것이 그려져야 한다 — 안 그러면 다 적었는데도
   * ✓ 가 안 붙고 「보고서 만들기」가 안 나온다. 한쪽을 고치다 반대쪽으로 넘어가기 쉬운 자리다.
   */
  await page.keyboard.type('두 번째 칸에도 적는다');
  await page.waitForTimeout(120);
  const beforeLeave = await page.evaluate(() =>
    document.querySelectorAll('#note-panel .note-tab[data-read="true"], .note-tab[data-read="true"]').length);
  await page.locator('.bench-stage').tap({ position: { x: 8, y: 8 } }).catch(() => {});
  await page.waitForTimeout(600);
  const settled = await page.evaluate((n) => {
    const saved = window.__store?.getState()?.session?.notes ?? {};
    return { 저장됨: Object.values(saved).some((v) => String(v).includes('두 번째 칸에도')),
      탭표시: document.querySelectorAll('.note-tab[data-read="true"]').length, 이전: n };
  }, beforeLeave);
  if (!settled.저장됨) { bad++; console.log(`${exp.padEnd(15)} ★ 실패  손을 뗐는데 글이 저장되지 않았다`); }
  console.log(`${exp.padEnd(15)} ${ok ? '통과' : '★ 실패'}  ${found ? 'STEP ' + found : '쪽 안'} · 짚은 칸 ${want} → 손이 간 곳 ${got}  (오류 ${errs.length})`);
  await ctx.close();
}
await browser.close();
console.log(bad ? `\n실패 ${bad}개` : '\n전부 통과');
process.exit(bad ? 1 : 0);
