/**
 * 실험대 테스트.
 *
 * 화면 없이 볼 수 있는 것만 여기 둔다 — **배치**와 **조작표**다.
 * 어포던스(말풍선이 실제로 뜨는가, 잡히는 크기인가)는 브라우저가 있어야 하므로
 * `scripts/check-screen.mjs` 로 뺐다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { benchLayout, dropTable, tapTable } from '../src/ui/bench.js';
import { CONTRACT } from '../src/assets/contract.js';
import { ACTIONS } from '../src/sim/rules.js';
import { UI } from '../src/ui/strings.js';
import { initialState } from '../src/sim/state.js';

const LAYOUT = benchLayout();
const STAGE_W_MM = CONTRACT.bench.realSizeMm;

/** 조작표는 함수를 담고 있어 그냥은 못 본다. 아무것도 안 하는 store 로 종류 쌍만 뽑는다. */
function tableShape() {
  const calls = [];
  const store = {
    getState: () => ({ session: { level: 1 }, bench: { extract: {} } }),
    dispatch: (type, payload) => { calls.push({ type, payload }); },
  };
  return { drops: dropTable(store), taps: tapTable(store), calls, store };
}

/* ================== 배치 ================== */

/**
 * 물건이 서로 겹치면 **뒤에 그려진 쪽이 앞엣것의 클릭을 가로챈다.**
 *
 * 처음 배치가 실제로 그랬다 — 비커가 수조를 덮었고 쓰레기통은 실험대 오른쪽 밖에 있었다.
 * 스물여덟 개의 x 를 손으로 적었기 때문인데, 지금은 `row()` 가 계산한다.
 * 이 검사는 그 계산이 자리가 모자란 것을 **조용히 좁혀서** 넘기지 않는지 본다.
 */
test('실험대 위 물건이 서로 겹치지 않는다', () => {
  const bad = [];
  for (let i = 0; i < LAYOUT.length; i++) {
    for (let j = i + 1; j < LAYOUT.length; j++) {
      const a = LAYOUT[i];
      const b = LAYOUT[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
        bad.push(`${a.id} × ${b.id}`);
      }
    }
  }
  assert.deepEqual(bad, [], `겹친 물건: ${bad.join(', ')}`);
});

test('실험대 밖으로 나간 물건이 없다', () => {
  const out = LAYOUT.filter((i) => i.x < 0 || i.x + i.w > STAGE_W_MM);
  assert.deepEqual(out.map((i) => i.id), [],
    out.map((i) => `${i.id} ${Math.round(i.x)}~${Math.round(i.x + i.w)} mm`).join(', '));
});

test('물건의 프레임까지 실험대 안에 있다 — 빈 여백이 삐져나가 스크롤을 만들지 않는다', () => {
  // 그려진 부분은 안에 있어도 `<button>` 은 프레임 크기다. 줄 끝 물건의 프레임 여백이
  // 실험대 밖으로 나가면 `#bench` 에 가로 스크롤이 생긴다 — 1280 px 에서 23 px 이 그랬다.
  const out = LAYOUT.filter((i) => i.frame.x < -0.01 || i.frame.x + i.frame.w > STAGE_W_MM + 0.01);
  assert.deepEqual(out.map((i) => i.id), [],
    out.map((i) => `${i.id} 프레임 ${Math.round(i.frame.x)}~${Math.round(i.frame.x + i.frame.w)} mm`).join(', '));
});

test('조건마다 물건이 하나씩 있다', async () => {
  // 화면이 조건을 대신 골라 주면 통제변인을 틀릴 수가 없어지고, 틀릴 수 없으면
  // 그래프에서 어긋난 점을 볼 일도 없다 — 이 실험이 가르치려는 것이 사라진다.
  const { CHOICES } = await import('../src/sim/state.js');
  const ids = LAYOUT.map((i) => i.id);
  for (const t of CHOICES.tempC) assert.ok(ids.includes(`bath${t}`), `${t} ℃ 수조가 없습니다`);
  for (const p of CHOICES.ph) assert.ok(ids.includes(`buffer${p}`), `pH ${p} 완충 용액이 없습니다`);
  for (const c of CHOICES.h2o2Pct) assert.ok(ids.includes(`h2o2_${c}`), `${c} % 과산화수소수가 없습니다`);
  for (const e of CHOICES.extractPct) assert.ok(ids.includes(`extract${e}`), `${e} % 감자즙이 없습니다`);
});

test('막힘 문구가 가리키는 물건이 실험대에 있다', () => {
  // 「선반의 비커 통에서 새 비커를 꺼내세요」라고 해 놓고 그 물건이 없으면 거짓말이 된다.
  assert.ok(LAYOUT.some((i) => i.id === 'beakerbox'));
});

test('물건마다 긴 이름과 짧은 이름이 다 있다', () => {
  for (const it of LAYOUT) {
    assert.ok(UI.bench.items[it.id], `UI.bench.items.${it.id} 이 없습니다`);
    assert.ok(UI.bench.shortNames[it.id], `UI.bench.shortNames.${it.id} 이 없습니다`);
  }
});

/* ================== 조작표 ================== */

test('조작표가 부르는 액션이 전부 규칙 엔진에 있다', () => {
  const { drops, taps, calls, store } = tableShape();
  for (const [from, targets] of Object.entries(drops)) {
    for (const [to, run] of Object.entries(targets)) {
      calls.length = 0;
      run({ kind: from, pct: 3, ph: 7 }, { kind: to, tempC: 20, pct: 100 });
      assert.ok(calls.length > 0, `${from} → ${to} 가 아무 액션도 부르지 않습니다`);
      for (const c of calls) {
        assert.ok(ACTIONS[c.type], `${from} → ${to} 가 없는 액션 ${c.type} 을 부릅니다`);
      }
    }
  }
  for (const [kind, run] of Object.entries(taps)) {
    calls.length = 0;
    run({ kind }, null);
    assert.ok(calls.length > 0, `${kind} 탭이 아무 액션도 부르지 않습니다`);
    for (const c of calls) assert.ok(ACTIONS[c.type], `${kind} 탭이 없는 액션 ${c.type} 을 부릅니다`);
  }
  void store;
});

/**
 * 조작표와 안내 문구가 어긋나지 않는가.
 *
 * 조작을 하나 늘리면서 안내를 빠뜨리면, 학생에게는 **없는 기능**이 된다.
 * 기능이 있는데 어포던스가 없으면 없는 것과 같다 — 바나나랩에서 가장 크게 물린 것이다.
 */
test('조작할 수 있는 물건마다 안내 문구가 있다', () => {
  const { drops, taps } = tableShape();
  const kinds = new Set([...Object.keys(drops), ...Object.keys(taps)]);
  // 놓이는 쪽(대상)도 안내가 있어야 한다 — 무엇을 받는 물건인지 학생이 알아야 한다.
  for (const targets of Object.values(drops)) for (const k of Object.keys(targets)) kinds.add(k);
  for (const kind of kinds) {
    assert.ok(UI.bench.hints[kind], `UI.bench.hints.${kind} 이 없습니다 — 학생에게는 없는 기능입니다`);
  }
});

test('안내 문구가 있는 종류는 실험대에 실제로 놓여 있다', () => {
  // 안 놓인 물건의 안내는 아무도 못 본다. 조작을 지우고 안내만 남는 것을 잡는다.
  const kinds = new Set(LAYOUT.map((i) => i.kind));
  for (const kind of Object.keys(UI.bench.hints)) {
    assert.ok(kinds.has(kind), `UI.bench.hints.${kind} 은 실험대에 없는 물건입니다`);
  }
});

/**
 * 난이도는 **설명만** 줄인다. 할 수 있는 일은 세 단계가 똑같다.
 *
 * 조작표가 난이도를 인자로 받지 않는지 본다. 받는 순간 「3단계에서는 이 조작을 막자」가
 * 가능해지고, 그건 설명을 줄인 게 아니라 길을 막은 것이다.
 */
test('조작표는 난이도를 보지 않는다', () => {
  const shapeOf = (level) => {
    const store = { getState: () => ({ session: { level }, bench: { extract: {} } }), dispatch: () => {} };
    const drops = dropTable(store);
    return Object.entries(drops).map(([k, v]) => `${k}:${Object.keys(v).sort().join(',')}`).sort();
  };
  assert.deepEqual(shapeOf(3), shapeOf(1), '3단계의 조작표가 1단계와 다릅니다');
});

test('난이도가 올라가면 안내 문구만 짧아진다', () => {
  for (const [kind, byLevel] of Object.entries(UI.bench.hints)) {
    const lens = [1, 2, 3].map((lv) => (byLevel[lv] ?? []).join('').length);
    assert.ok(lens[0] >= lens[1] && lens[1] >= lens[2],
      `${kind}: 난이도가 올라가는데 안내가 길어집니다 (${lens.join(' → ')})`);
  }
});

/**
 * 마우스가 지나갔다고 **키보드로 열어 둔 말풍선을 닫지 않는다.**
 *
 * 마우스를 안 쓰는 사람에게는 끌어다 놓는 길이 말풍선의 「여기에 놓기」 버튼뿐이다.
 * 그런데 `pointerleave` 가 조건 없이 말풍선을 닫고 있어서, **다른 물건 위에서 마우스가
 * 벗어나기만 해도 그 버튼들이 사라졌다** — 포커스는 그대로인데 길만 없어진 것이다.
 *
 * 화면 검사가 여섯 번에 다섯 번 실패해서 잡혔다. 눈으로 볼 수 있는 종류가 아니다 —
 * 사람이 마우스와 키보드를 동시에 쓰는 일이 드물기 때문이다.
 * 실제 동작은 `scripts/check-screen.mjs` 가 브라우저에서 확인하고, 여기서는
 * **그 조건이 코드에 남아 있는지**를 지킨다.
 */
test('마우스가 벗어나도 키보드로 연 말풍선은 닫지 않는다', () => {
  const src = readFileSync(new URL('../src/ui/bench.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const leave = src.match(/addEventListener\('pointerleave',[\s\S]{0,220}?\n\s*\}\);/);
  assert.ok(leave, 'pointerleave 처리를 못 찾았습니다');
  assert.ok(/document\.activeElement/.test(leave[0]),
    'pointerleave 가 포커스를 보지 않고 말풍선을 닫습니다 — 키보드로 연 버튼이 사라집니다');
});

/**
 * **말없이 먹통인 물건을 실험대에 남기지 않는다.**
 *
 * 안전 판정을 걷어내면서 탭 조작 넷이 사라졌다(시약병 마개·폐액 버리기·손 씻기).
 * 시약병과 폐액통은 **끌기로 하던 일이 그대로** 있어서 괜찮지만, 휴지는 손 씻기 하나뿐이라
 * 그대로 두면 **눌러도 아무 일도 안 나는 물건**이 된다. 그래서 실험대에서 뺐다.
 *
 * 이 검사는 그런 물건이 또 생기는 것을 막는다. 실험대에 놓인 종류는 저마다
 * **누르면 무언가 하거나, 무언가를 받거나, 어딘가에 놓을 수 있어야** 한다.
 * 셋 다 아니면 학생이 눌러 보고 아무 답도 못 받는다 — 그 침묵은 고장과 구별되지 않는다.
 */
test('실험대의 모든 물건은 무언가를 한다 — 말없이 먹통인 것이 없다', () => {
  const store = { dispatch: () => {}, getState: () => initialState() };
  const taps = tapTable(store);
  const drops = dropTable(store);
  const kinds = [...new Set(benchLayout().map((i) => i.kind))];

  const mute = kinds.filter((kind) => {
    if (taps[kind]) return false;                                   // 누르면 한다
    if (drops[kind] && Object.keys(drops[kind]).length) return false; // 끌면 한다
    const receives = Object.values(drops).some((t) => t && t[kind]); // 받는다
    return !receives;
  });

  assert.deepEqual(mute, [],
    `누르지도 끌지도 받지도 못하는 물건: ${mute.join(', ')} — 눌러 보고 아무 답도 못 받습니다`);
});
