import { chromium } from 'playwright';
const BASE='http://localhost:5177';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(`${BASE}/?level=1`,{waitUntil:'networkidle'});
await p.waitForTimeout(300);
const n=await p.evaluate(()=>{
  const d=(t,q)=>window.__store.dispatch(t,q);
  for (const [id,reagent,obj,dia] of [['A',null,4,0.6],['B','IKI',10,0.5],['C','SUDAN3',40,0.9]]) {
    d('SMEAR',{slide:id,thickness:0.3});
    if(reagent){d('FILL_DROPPER',{reagent});d('DROP',{slide:id,count:2});}
    d('PICK_COVERSLIP',{});d('PLACE_COVERSLIP',{slide:id,angleDeg:45});
    d('MOUNT',{slide:id});d('SET_OBJECTIVE',{objective:obj});d('SET_DIAPHRAGM',{value:dia});
    d('CAPTURE',{});d('UNMOUNT',{});
  }
  return window.__store.getState().session.captures.length;
});
console.log('직후 captures =',n);
await p.waitForTimeout(200);
console.log('200ms 뒤 captures =', await p.evaluate(()=>window.__store.getState().session.captures.length));
for (let i=1;i<=7;i++){
  await p.locator(`.note-tab[data-stage="${i}"]`).click();
  await p.waitForTimeout(200);
  if(i===5||i===6) console.log(i,'단계:',JSON.stringify((await p.locator('#note-panel').innerText()).slice(0,80)),
    '| captures 지금 =', await p.evaluate(()=>window.__store.getState().session.captures.length));
}
console.log('마지막 captures =', await p.evaluate(()=>window.__store.getState().session.captures.length));
console.log('log 마지막 6개 =', JSON.stringify(await p.evaluate(()=>window.__store.getState().session.log.slice(-6))));
console.log('에러:',errs.length?errs:'없음');
await b.close();
