import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://localhost:5177/?level=1',{waitUntil:'networkidle'});await p.waitForTimeout(300);
// (나) 를 흐리게 캡처한 뒤 (다) 를 재물대에 올려 둔다
await p.evaluate(()=>{const d=(t,q)=>window.__store.dispatch(t,q);
 for(const id of ['B','C']){d('SMEAR',{slide:id,thickness:.3});d('PICK_COVERSLIP',{});d('PLACE_COVERSLIP',{slide:id,angleDeg:45});}
 d('MOUNT',{slide:'B'});d('SET_DIAPHRAGM',{value:0.02});d('CAPTURE',{});d('UNMOUNT',{});
 d('MOUNT',{slide:'C'});});
await p.locator('.note-tab[data-stage="6"]').click();await p.waitForTimeout(300);
const q=await p.locator('.reflect-item p').first().innerText();
console.log('성찰 문항:',JSON.stringify(q),'| 재물대:',await p.evaluate(()=>window.__store.getState().microscope.stage));
await p.locator('.reflect-opt').first().click();await p.waitForTimeout(250);
await p.locator('.reflect-retry').click();await p.waitForTimeout(400);
console.log('다시 관찰하기 → 확대 뷰가 보여 주는 슬라이드:',
  JSON.stringify((await p.locator('.zoom-body').innerText()).slice(0,60).replace(/\n/g,' / ')),
  '| 재물대:',await p.evaluate(()=>window.__store.getState().microscope.stage));
// 재물대가 비어 있을 때
await p.keyboard.press('Escape');await p.waitForTimeout(200);
await p.evaluate(()=>window.__store.dispatch('UNMOUNT',{}));
await p.locator('.note-tab[data-stage="6"]').click();await p.waitForTimeout(300);
await p.locator('.reflect-retry').click();await p.waitForTimeout(400);
console.log('재물대 빈 상태에서 다시 관찰하기:',
  JSON.stringify((await p.locator('.zoom-body').innerText()).slice(0,60).replace(/\n/g,' / ')));
console.log('에러:',errs.length?errs:'없음');
await b.close();
