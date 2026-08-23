import { chromium } from 'playwright';
const BASE='http://localhost:5177';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});

// 시작 화면 radiogroup
await p.goto(BASE,{waitUntil:'networkidle'}); await p.waitForTimeout(300);
console.log('시작 화면 radio tabindex:', JSON.stringify(await p.evaluate(()=>
  [...document.querySelectorAll('.start-level')].map(e=>({lv:e.dataset.level,ti:e.getAttribute('tabindex'),ck:e.getAttribute('aria-checked')})))));
console.log('radiogroup 안 role:', await p.evaluate(()=>document.querySelector('.start-levels').getAttribute('role')));

await p.goto(`${BASE}/?level=1`,{waitUntil:'networkidle'}); await p.waitForTimeout(300);

// bench-tip: aria-describedby 대상이 숨겨져 있는가
console.log('\nbench-tip hidden:', await p.evaluate(()=>document.querySelector('#bench-tip').hidden),
  '| 토큰 describedby:', await p.evaluate(()=>document.querySelector('[data-id="banana"]').getAttribute('aria-describedby')));
// 두 토큰이 같은 id 를 가리킨다
console.log('describedby 를 가진 토큰 수:', await p.evaluate(()=>document.querySelectorAll('.token[aria-describedby="bench-tip"]').length));

// 확대 뷰 배경이 aria-hidden/inert 인가
await p.evaluate(()=>{const d=(t,q)=>window.__store.dispatch(t,q);
  d('SMEAR',{slide:'B',thickness:.3});d('PICK_COVERSLIP',{});d('PLACE_COVERSLIP',{slide:'B',angleDeg:45});d('MOUNT',{slide:'B'});});
await p.locator('[data-id="microscope"]').click(); await p.waitForTimeout(400);
console.log('\n확대 뷰 열림 — 배경 inert/aria-hidden:', JSON.stringify(await p.evaluate(()=>({
  benchInert: document.querySelector('#bench').hasAttribute('inert'),
  benchAriaHidden: document.querySelector('#bench').getAttribute('aria-hidden'),
  notebookInert: document.querySelector('#notebook').hasAttribute('inert'),
  zoomRole: document.querySelector('#zoom').getAttribute('role'),
  panelLabel: document.querySelector('.zoom-panel').getAttribute('aria-label') || document.querySelector('.zoom-panel').getAttribute('aria-labelledby'),
}))));
console.log('#fov-slot 접근 이름:', JSON.stringify(await p.evaluate(()=>{const e=document.querySelector('#fov-slot');
  return {tabindex:e.getAttribute('tabindex'),role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:e.textContent.trim().slice(0,20)};})));
console.log('다이얼 aria:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.dial')].map(e=>({
  id:e.id,role:e.getAttribute('role'),now:e.getAttribute('aria-valuenow'),min:e.getAttribute('aria-valuemin'),max:e.getAttribute('aria-valuemax'),label:e.getAttribute('aria-label')})))));

// 배율 버튼 aria-pressed 가 실제와 맞는가 (클릭 후)
await p.locator('[data-obj="10"]').click(); await p.waitForTimeout(300);
console.log('\n100배 클릭 후 objective =', await p.evaluate(()=>window.__store.getState().microscope.objective),
  '| aria-pressed:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('[data-obj]')].map(e=>[e.dataset.obj,e.getAttribute('aria-pressed')]))),
  '| 포커스:', await p.evaluate(()=>document.activeElement.tagName+(document.activeElement.dataset?.obj??'')));

// 다이얼 돌린 뒤 aria-valuenow 갱신되는가
await p.locator('#dial-fine').focus();
await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200);
console.log('미동 2회 후 fine =', await p.evaluate(()=>window.__store.getState().microscope.fine),
  '| aria-valuenow =', await p.locator('#dial-fine').getAttribute('aria-valuenow'));

// 조리개 슬라이더 라벨/값
console.log('조리개:', JSON.stringify(await p.evaluate(()=>{const e=document.querySelector('#zoom-diaphragm');
  return {value:e.value, state:window.__store.getState().microscope.diaphragm, label:document.querySelector('label[for="zoom-diaphragm"]')?.textContent};})));

// 노트 탭 aria-controls / 패널 role
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
console.log('\n노트 탭 aria-controls:', await p.evaluate(()=>document.querySelector('.note-tab').getAttribute('aria-controls')),
  '| 패널 role:', await p.evaluate(()=>document.querySelector('#note-panel').getAttribute('role')),
  '| 탭 tabindex:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.note-tab')].map(e=>e.getAttribute('tabindex')))));

// 성찰 옵션 aria
await p.evaluate(()=>{window.__store.dispatch('SET_DIAPHRAGM',{value:0.02});window.__store.dispatch('CAPTURE',{});});
await p.locator('.note-tab[data-stage="6"]').click(); await p.waitForTimeout(300);
console.log('성찰 옵션 aria:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.reflect-opt')].map(e=>({
  v:e.dataset.value, pressed:e.getAttribute('aria-pressed'), chosen:e.classList.contains('reflect-opt--chosen')})))));
await p.locator('.reflect-opt').first().click(); await p.waitForTimeout(300);
console.log('하나 고른 뒤:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.reflect-opt')].map(e=>({
  v:e.dataset.value, pressed:e.getAttribute('aria-pressed'), chosen:e.classList.contains('reflect-opt--chosen')})))));
console.log('reflect group aria-label:', await p.evaluate(()=>document.querySelector('.reflect-options')?.getAttribute('aria-label')));

// 6단계 성찰 "다시 관찰하기" 키보드 가능?
console.log('다시 관찰하기 버튼:', await p.locator('.reflect-retry').count());
console.log('\n에러:',errs.length?errs:'없음');
await b.close();
