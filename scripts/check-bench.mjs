/** T08 브라우저 검증 — 어포던스가 실제로 화면에 나타나는지. */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const out = [];
const ok = (pass, name, detail = '') => out.push({ pass, name, detail });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

async function box(sel) {
  return page.locator(sel).boundingBox();
}
const center = (b) => [b.x + b.width / 2, b.y + b.height / 2];

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
ok(await page.locator('.start-level').count() === 3, '난이도 세 단계를 고를 수 있다');
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
const coverBox = await box('[data-id="coverslip1"]');
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

// 안전 수칙을 실험대에서 지울 수 있는가
await page.evaluate(() => window.__store.dispatch('NOTE_VIOLATION', { kind: 'cap-left-open' }));
await page.waitForTimeout(60);
const bottleBox = await box('[data-id="bottleIKI"]');
await page.mouse.move(...center(bottleBox));
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(120);
const viol = await page.evaluate(() => window.__store.getState().session.violations);
ok(!viol.includes('cap-left-open'), '시약병을 누르면 마개를 닫은 것으로 기록된다', JSON.stringify(viol));

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
await page.evaluate(() => window.__store.dispatch('NOTE_VIOLATION', { kind: 'hands-unwashed' }));
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
      const htmlText = [...el.childNodes]
        .filter((n) => n.nodeType === 3 || (n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg'))
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

/* ---------- 결과 ---------- */
ok(errors.length === 0, '콘솔 에러 0건', errors.slice(0, 3).join(' / '));

await browser.close();

let fail = 0;
for (const r of out) {
  if (!r.pass) fail++;
  console.log(`${r.pass ? '  통과' : '실패'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${out.length - fail}/${out.length} 통과`);
process.exit(fail ? 1 : 0);
