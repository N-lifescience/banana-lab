#!/usr/bin/env node
/**
 * T35 — 모둠 기록 옮기기를 브라우저에서 끝까지 돌려 본다.
 *
 *   npm run dev            # 먼저 띄운다
 *   node scripts/check-group.mjs [banana]
 *
 * 모둠원 탭에서 노트를 적고 「기록 보내기」 → QR 을 **화면 픽셀로 찍어** jsQR 로 읽는다 →
 * 모둠장 탭에서 「기록 모으기」(카메라 없는 환경이라 붙여넣기 길) → 칸마다 카드 → 「초안 채우기」.
 * 화면을 띄워야 아는 것이라 `npm run check` 에는 안 넣는다 (CLAUDE.md).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { devUrl } from '../dev-port.js';

const jsQR = createRequire(import.meta.url)('jsqr');
const exp = process.argv[2] ?? 'banana';
const url = process.env.SHOT_URL ?? `${devUrl().replace(/\/$/, '')}/experiments/${exp}/`;

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.log('playwright 가 없습니다'); process.exit(0);
}
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(String(e)));
  // 개발 서버의 favicon 404 는 앱의 잘못이 아니다
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url ?? '')) errors.push(m.text()); });
};
let pass = 0;
const ok = (cond, msg) => { if (!cond) { console.log('  ✗', msg); errors.push(msg); } else { pass++; console.log('  ✓', msg); } };

async function start(page, { role, nick, name }) {
  await page.goto(url);
  await page.click('.start-purpose[data-purpose="virtual"]');   // 1쪽: 가상 실험실
  await page.click('.start-level[data-mode="group"]');
  await page.click('#start-go');                                 // 2쪽 → 「다음」
  await page.fill('#sg-name', name);
  await page.fill('#sg-size', '3');
  await page.fill('#sg-nick', nick);
  await page.click(`.start-level[data-role="${role}"]`);
  await page.click('#start-go');
  await page.waitForSelector('#group-head');
}

/* ── 모둠원 ─────────────────────────────────────────────────────────── */
const member = await ctx.newPage(); watch(member);
await start(member, { role: 'member', nick: '초록이', name: '바나나조' });
ok(await member.textContent('#group-head') .then((t) => t.includes('모둠원') && t.includes('초록이')), '모둠원 화면에 역할·별명');
ok(await member.$('#group-send-btn') !== null, '모둠원에게 「기록 보내기」');
ok(await member.$('#group-collect-btn') === null, '모둠원에게 「기록 모으기」는 없다');

const NOTES = {
  '1a': '바나나 껍질을 벗기고 과육을 조금 떼어 냈다.',
  'q.a': '(가)는 대조군이라 색이 안 변한다. 검출 용액이 있어야 무엇이 있는지 눈으로 가릴 수 있다.',
  q2: '녹말립은 크고 빽빽했다. 지질 방울은 작고 드물었다.',
  'discuss.roles': '초록이가 슬라이드를 만들고 파랑이가 현미경을 봤다.',
};
await member.evaluate((notes) => {
  for (const [step, text] of Object.entries(notes)) window.__store.dispatch('SAVE_NOTE', { step, text });
}, NOTES);
await member.click('#group-send-btn');
await member.waitForSelector('#group-send[open]');
await member.screenshot({ path: 'shots/group-send.png' });
const code = await member.inputValue('#group-code-text');
const chunks = code.split('\n').filter(Boolean);
ok(chunks.length >= 1 && chunks.every((c) => c.startsWith('VB1.')), `조각 ${chunks.length}개`);

// 화면에 그려진 QR 을 픽셀로 찍어 남의 해독기로 읽는다 — 카메라가 보는 것과 같은 것
const shot = await member.locator('#group-qr svg').screenshot({ type: 'png' });
const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
if (PNG) {
  const png = PNG.sync.read(shot);
  const hit = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);
  ok(hit && chunks.includes(hit.data), `화면의 QR 을 jsQR 이 읽는다 (${hit ? hit.data.slice(0, 20) : '실패'})`);
} else {
  console.log('  · pngjs 가 없어 픽셀 해독은 건너뜀');
}
await member.click('#group-send-close');

/* ── 모둠장 ─────────────────────────────────────────────────────────── */
const leader = await ctx.newPage(); watch(leader);
await start(leader, { role: 'leader', nick: '반장', name: '바나나조' });
ok(await leader.$('#group-collect-btn') !== null, '모둠장에게 「기록 모으기」');
await leader.click('#group-collect-btn');
await leader.waitForSelector('#group-collect[open]');
// 헤드리스에는 카메라가 없다 — 붙여넣기 길로 간다 (카메라가 없는 학교 컴퓨터와 같다)
await leader.waitForFunction(() => /카메라를 쓸 수 없습니다|읽는 중/.test(document.querySelector('#group-status')?.textContent ?? ''));
await leader.fill('#group-paste', code);
await leader.click('#group-paste-add');
await leader.waitForFunction(() => /담았습니다/.test(document.querySelector('#group-status')?.textContent ?? ''));
ok(true, '붙여넣기로 기록이 담긴다');
await leader.screenshot({ path: 'shots/group-collect.png' });
await leader.click('#group-collect-close');
ok((await leader.textContent('#group-head')).includes('모인 기록 1/2'), '모둠 칸에 모인 수 1/2');
ok((await leader.textContent('#group-head')).includes('초록이'), '모둠원 별명이 목록에');

// 6 정리 쪽 — 칸 아래 카드와 초안 채우기
// 「정리」 쪽 — 실험마다 쪽 번호가 다르다 (catalase·fermentation 은 실험 설계 쪽이 하나 더 있다)
await leader.locator('.note-tab', { hasText: '정리' }).first().click();
await leader.waitForSelector('#note-q2');
const cards = await leader.$$('.group-entries');
ok(cards.length >= 2, `모둠원이 쓴 칸마다 카드 (${cards.length})`);
ok((await leader.textContent('.group-entries')).includes('초록이'), '카드에 별명');
await leader.locator('#note-q2').scrollIntoViewIfNeeded();
await leader.locator('#notebook').screenshot({ path: 'shots/group-notebook.png' });
await leader.click('[data-fill="q2"]');
await leader.waitForFunction(() => document.querySelector('#note-q2')?.value.includes('녹말립'));
ok(true, '「초안 채우기」가 칸에 넣는다');
const inState = await leader.evaluate(() => window.__store.getState().session.notes.q2);
ok(inState.includes('녹말립'), '초안이 상태(SAVE_NOTE)에도 들어간다');

// 모둠장이 이미 쓴 칸은 confirm 을 묻는다 — 취소하면 그대로
leader.once('dialog', (d) => d.dismiss());
await leader.click('[data-fill="q2"]');
ok((await leader.inputValue('#note-q2')).includes('녹말립'), '취소하면 칸이 그대로');

// 같은 사람이 다시 보내면 바꿔 넣는다
await leader.click('#group-collect-btn');
await leader.waitForSelector('#group-collect[open]');
await leader.fill('#group-paste', code);
await leader.click('#group-paste-add');
await leader.waitForFunction(() => /새것으로 바꿨습니다/.test(document.querySelector('#group-status')?.textContent ?? ''));
ok(true, '같은 별명은 바꿔 넣는다');
await leader.click('#group-collect-close');
ok((await leader.textContent('#group-head')).includes('1/2'), '두 번 보내도 한 사람');

// 빼기
await leader.click('[data-remove="초록이"]');
ok((await leader.textContent('#group-head')).includes('아직 모인 기록이 없습니다'), '「빼기」');

// 혼자 하면 모둠 칸이 없다
const solo = await ctx.newPage(); watch(solo);
await solo.goto(url);
await solo.click('.start-purpose[data-purpose="virtual"]');
ok(await solo.getAttribute('.start-level[data-mode="solo"]', 'aria-checked') === 'true', '기본은 혼자');
ok(await solo.isHidden('#start-group'), '2쪽에는 모둠 짜기가 없다');
ok((await solo.textContent('#start-go')).includes('시작') || !(await solo.textContent('#start-go')).includes('다음'), '혼자면 단추가 「시작」');
await solo.click('#start-go');
await solo.waitForSelector('#note-panel');
ok(await solo.$('#group-head') === null, '혼자 하면 모둠 칸이 없다');

// 주소로 단계가 정해진 모둠 링크 — 모둠 짜기만 보인다
const linked = await ctx.newPage(); watch(linked);
await linked.goto(`${url}?level=2&mode=group`);
await linked.waitForSelector('#start-group');
ok(await linked.isHidden('.start-levels[aria-label]:not(.start-roles)'), '단계 고르기는 접혀 있다');
ok(await linked.isVisible('#sg-name'), '모둠명 칸은 보인다');
await linked.fill('#sg-nick', '파랑이');
await linked.click('#start-go');
await linked.waitForSelector('#group-head');
ok(await linked.evaluate(() => window.__store.getState().session.level) === 2, '주소의 단계(2)로 시작한다');

// 실험 리허설 — 1쪽에서 바로 시작, 1단계·혼자, 피드백 칸, 보고서 단추 없음
const prac = await ctx.newPage(); watch(prac);
await prac.goto(url);
await prac.click('.start-purpose[data-purpose="practice"]');
await prac.waitForSelector('#practice-head');
ok(await prac.evaluate(() => window.__store.getState().session.level) === 1, '연습은 1단계');
ok(await prac.evaluate(() => window.__store.getState().session.mode) === 'solo', '연습은 혼자');
ok(await prac.isHidden('#report-slot'), '연습에는 보고서 단추가 없다');
ok(await prac.$('#group-head') === null, '연습에는 모둠 칸이 없다');
// 뜻대로 안 된 조작을 하나 일으킨다 — 빈 스포이트로 떨어뜨리기 같은 것. 실험마다 다르니 상태로 흉내 낸다
await prac.evaluate(() => window.__store.dispatch('UNDO', {}));
await prac.evaluate(() => window.__store.dispatch('UNDO', {}));
const head = await prac.textContent('#practice-head');
ok(/잘 안 된 것 \d+가지/.test(head) || /아직/.test(head), `연습 칸이 산다 (${head.trim().slice(0, 40)}…)`);
await prac.click('#practice-note-btn');
await prac.waitForSelector('#practice-dialog[open]');
await prac.fill('#pn-own', '두 방울만.');
await prac.evaluate(() => { window.print = () => { window.__printed = true; }; });
await prac.click('#pn-make');
await prac.waitForFunction(() => window.__printed === true);
const sheetHtml = await prac.evaluate(() => document.querySelector('#practice-sheet').innerHTML);
ok(/피드백 노트/.test(sheetHtml) && /두 방울만/.test(sheetHtml), '피드백 노트 종이가 만들어진다');
await prac.screenshot({ path: 'shots/practice-head.png' });

/* ── 리허설 링크 (T37) ──────────────────────────────────────────────
 * 선생님 화면이 만드는 세 번째 링크. **묻지 않고 바로 리허설로 열려야** 한다 —
 * 시작 화면이 한 번이라도 뜨면 QR 을 찍은 학생이 「탐구 실험」을 고를 수 있고,
 * 그러면 선생님이 고른 것과 다른 수업이 된다.
 */
const pracLink = await ctx.newPage(); watch(pracLink);
await pracLink.goto(`${url}?practice=1`);
await pracLink.waitForSelector('#practice-head');
ok(await pracLink.isHidden('#start'), '리허설 링크는 시작 화면을 안 거친다');
ok(await pracLink.evaluate(() => window.__store.getState().session.level) === 1, '리허설 링크는 1단계');
ok(await pracLink.evaluate(() => window.__store.getState().session.mode) === 'solo', '리허설 링크는 혼자');
ok(await pracLink.isHidden('#report-slot'), '리허설 링크에도 보고서 단추는 없다');

/* ── 선생님 화면이 두 모드를 다 만드는가 (T37) ───────────────────────
 * **선생님은 이 링크를 인쇄해 나눠 준다.** 틀린 채로 나가면 되돌릴 수 없다.
 */
const tc = await ctx.newPage(); watch(tc);
await tc.goto(`${devUrl().replace(/\/$/, '')}/teacher.html?exp=${exp}`);
await tc.waitForSelector('#tc-plain');
ok(await tc.inputValue('#tc-plain') === `${new URL(tc.url()).origin}/cell-metabolism/${exp}?level=1&mode=solo`,
  `탐구 실험 링크가 단계·방식을 싣는다 (${await tc.inputValue('#tc-plain')})`);
ok(await tc.isVisible('input[name="tc-level"]'), '탐구 실험이면 단계를 고른다');
await tc.click('input[name="tc-purpose"][value="practice"]');
await tc.waitForSelector('.tc-locked');
ok(await tc.inputValue('#tc-plain') === `${new URL(tc.url()).origin}/cell-metabolism/${exp}?practice=1`,
  `리허설 링크는 practice=1 하나 (${await tc.inputValue('#tc-plain')})`);
ok(await tc.$('input[name="tc-level"]') === null, '리허설이면 단계·방식을 안 고른다 (고정이라 물으면 거짓말이다)');
ok((await tc.textContent('.tc-duty')).includes('피드백 노트'), '리허설은 「피드백 노트 받는 법」을 말한다');
await tc.click('input[name="tc-purpose"][value="virtual"]');
await tc.click('input[name="tc-mode"][value="group"]');
ok((await tc.textContent('.tc-card')).includes('QR 로 모둠장 기기에 모아'), '모둠을 고르면 모으는 법을 말한다');
await tc.screenshot({ path: 'shots/teacher-modes.png', fullPage: true });

await browser.close();
console.log(`\n${errors.length ? '✗' : '✓'} pass ${pass}, errors ${errors.length}`);
for (const e of errors) console.log('  ', e);
process.exit(errors.length ? 1 : 0);
