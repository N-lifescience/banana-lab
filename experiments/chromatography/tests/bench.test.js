/**
 * 실험대 조작표 테스트.
 *
 * 실험대에서 무엇을 할 수 있는지는 `dropTable` 과 `tapTable` 두 표에만 적혀 있고,
 * 실제 실행 · 드래그 중 하이라이트 · 안내 문구가 전부 그 표를 읽는다.
 * 여기서 검사하는 것은 "표와 안내 문구가 서로 어긋나지 않는가" 다 —
 * 조작을 하나 늘려 놓고 안내를 안 적으면, 학생 눈에는 그 조작이 없는 것과 같다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropTable, tapTable, BENCH_KINDS, benchLayout } from '../src/ui/bench.js';
import { UI } from '../src/ui/strings.js';
import { initialState } from '../src/sim/state.js';

const LEVELS = [1, 2, 3];

/** dispatch 를 받아 적기만 하는 가짜 저장소. */
function fakeStore(level = 1, patch = (s) => s) {
  const calls = [];
  const state = patch(initialState(level, 12345));
  return {
    calls,
    getState: () => state,
    dispatch(type, payload) {
      calls.push({ type, payload });
      return { state, outcome: 'ok', message: null, tag: null };
    },
  };
}

const drops = () => dropTable(fakeStore());

test('끌어다 놓는 표의 출발과 도착이 모두 실험대에 있는 물건이다', () => {
  for (const [from, targets] of Object.entries(drops())) {
    assert.ok(BENCH_KINDS.includes(from), `${from} 은 실험대에 없는 물건이다`);
    for (const to of Object.keys(targets)) {
      assert.ok(BENCH_KINDS.includes(to), `${from} → ${to} 의 ${to} 가 실험대에 없다`);
    }
  }
});

test('실험대 위 물건들이 서로 겹치지 않는다', () => {
  // 겹치면 나중에 그려진 쪽이 앞선 쪽의 클릭을 통째로 가로챈다.
  // 애셋은 저마다 400×300 프레임을 채워 그리므로 잡는 영역에 **빈 여백까지 들어간다** —
  // 화면에서는 아래쪽에만 그려져 있어 보이는 물건이 위쪽 물건을 덮을 수 있다.
  // 실제로 개수대를 500 mm 로 잡았다가 선반 위 받침 유리를 못 끌게 됐다.
  const items = benchLayout();
  const hit = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      assert.ok(!hit(items[i], items[j]),
        `${items[i].id} 와 ${items[j].id} 가 겹칩니다 — 뒤엣것이 앞엣것의 클릭을 가로챕니다`);
    }
  }
});

test('실험대 위 물건이 실험대를 벗어나지 않는다', () => {
  for (const it of benchLayout()) {
    assert.ok(it.x >= 0 && it.x + it.w <= 1500, `${it.id} 가 실험대 폭(1500 mm)을 벗어납니다`);
    assert.ok(it.y >= 0, `${it.id} 가 실험대 위쪽으로 벗어납니다`);
  }
});

test('실험대의 모든 물건이 난이도 1·2·3 안내를 갖는다', () => {
  for (const kind of BENCH_KINDS) {
    const h = UI.bench.hints[kind];
    assert.ok(h, `${kind} 에 안내 문구가 없다 — 마우스를 올려도 이름밖에 안 뜬다`);
    for (const level of LEVELS) {
      assert.ok(Array.isArray(h[level]), `${kind} 의 ${level}단계 안내가 배열이 아니다`);
    }
  }
});

test('조작이 있는 물건은 1·2단계에서 그 조작을 알려 준다', () => {
  const table = drops();
  const taps = tapTable(fakeStore(), () => {});
  const interactive = new Set([
    ...Object.keys(table),
    ...Object.values(table).flatMap((t) => Object.keys(t)),
    ...Object.keys(taps),
  ]);
  for (const kind of interactive) {
    for (const level of [1, 2]) {
      assert.ok(
        UI.bench.hints[kind][level].length > 0,
        `${kind} 는 할 수 있는 조작이 있는데 ${level}단계 안내가 비었다`
      );
    }
  }
});

test('3단계는 이름만 남는다', () => {
  for (const kind of BENCH_KINDS) {
    assert.equal(UI.bench.hints[kind][3].length, 0, `${kind} 의 3단계 안내가 남아 있다`);
  }
});

test('난이도는 안내만 줄이고 조작을 줄이지 않는다', () => {
  // 조작표는 난이도를 인자로 받지 않는다. 3단계라고 해서 할 수 있는 일이 사라지면
  // 그건 설명을 줄인 게 아니라 길을 막은 것이고, "강제하지 말고 결과로 답한다" 를 어긴다.
  const shape = (t) => Object.entries(t).map(([k, v]) => `${k}:${Object.keys(v).sort().join(',')}`).sort();
  assert.deepEqual(shape(dropTable(fakeStore(3))), shape(dropTable(fakeStore(1))));
  assert.deepEqual(
    Object.keys(tapTable(fakeStore(3), () => {})).sort(),
    Object.keys(tapTable(fakeStore(1), () => {})).sort()
  );
});

test('잎을 원심관에 대면 **선반에서 고른 잎**이 들어간다', () => {
  // 신선한 잎과 시든 잎 중 무엇을 넣을지는 학생이 정한다. 화면이 알아서 신선한 것을
  // 집어 주면 "왜 신선한 시료를 쓰는가" 라는 이 실험의 변인이 학생 손을 떠난다.
  for (const kind of ['fresh', 'wilted']) {
    const store = fakeStore(1, (st) => ({ ...st, tools: { ...st.tools, leafKind: kind } }));
    dropTable(store).leaf.tube({ kind: 'leaf' }, { kind: 'tube' }, {});
    assert.deepEqual(store.calls, [{ type: 'ADD_LEAF', payload: { kind } }]);
  }
});

test('손끝으로 하는 일은 실험대에서 곧장 일어나지 않고 확대 뷰를 연다', () => {
  // 찍는 횟수·대는 시간·원점 높이·붓는 깊이는 이 실험의 변인이다. 실험대에서 끌어다
  // 대는 것만으로 정해지면 학생이 정할 수 있는 것이 없다.
  // 들고 온 도구가 무엇인지도 함께 넘겨야 한다 — 확대 뷰는 들고 온 것만 보여 준다.
  const cases = [
    ['capillary', 'paper', 'paper'],
    ['pencil', 'paper', 'paper'],
    ['bottle', 'vial', 'vial'],
  ];
  for (const [tool, targetKind, zoomMode] of cases) {
    const store = fakeStore();
    const opened = [];
    dropTable(store, (...a) => opened.push(a))[tool]
      [targetKind]({ kind: tool, liquid: 'SOLVENT' }, { kind: targetKind }, {});
    assert.deepEqual(store.calls, [], `${tool} 가 실험대에서 곧장 조작을 일으킨다`);
    assert.deepEqual(opened, [[zoomMode, null, tool]], `${tool} 를 들고 온 것이 전해지지 않는다`);
  }
});

test('추출액은 원심관에 곧장 들어가고, 전개액만 확대 뷰를 연다', () => {
  // 추출액은 "얼마나" 가 아니라 "넣었는가" 가 갈린다 — 확대 뷰를 열 이유가 없다.
  // 전개액은 **깊이가 결과를 가른다.** 원점이 잠기느냐 마느냐가 여기서 정해진다.
  const store = fakeStore();
  const opened = [];
  dropTable(store, (...a) => opened.push(a)).bottle
    .tube({ kind: 'bottle', liquid: 'EXTRACT' }, { kind: 'tube' }, {});
  assert.deepEqual(store.calls.map((c) => c.type), ['ADD_EXTRACT']);
  assert.deepEqual(opened, []);
});

test('되돌아갈 길이 실험대에 있다', () => {
  // 막다른 길을 만들지 않는다. 새 조작을 넣을 때마다 되돌아올 길을 같이 정한다.
  const paths = [
    ['paper', 'paperbox', 'NEW_PAPER'],
    ['paper', 'bin', 'NEW_PAPER'],
    ['tube', 'waste', 'EMPTY_TUBE'],
    ['vial', 'waste', 'EMPTY_VIAL'],
    ['capillary', 'waste', 'RINSE_CAPILLARY'],
  ];
  for (const [from, to, action] of paths) {
    const store = fakeStore();
    dropTable(store)[from][to]({ kind: from }, { kind: to }, {});
    assert.deepEqual(store.calls.map((c) => c.type), [action],
      `${from} → ${to} 가 ${action} 을 부르지 않습니다`);
  }
});

test('젖은 종이에 자를 대는 것도 막지 않는다 — 규칙 엔진이 답한다', () => {
  // 실험대가 미리 걸러 내면 "젖은 종이에 자를 대면 찢어진다" 를 들을 기회가 사라진다.
  const store = fakeStore();
  dropTable(store).ruler.paper({ kind: 'ruler' }, { kind: 'paper' }, {});
  assert.deepEqual(store.calls.map((c) => c.type), ['MEASURE']);
});


/**
 * **말없이 먹통인 물건을 남기지 않는다.**
 *
 * 안전 조작(손 씻기·마개 닫기·폐액 버리기)을 걷어내면서 그 조작에만 쓰이던 물건이
 * 죽은 채 남을 수 있었다. 실제로 **휴지**가 그랬다 — 끌기 원천도 대상도 아니고 탭뿐이라
 * 탭을 지우는 순간 눌러도 끌어도 아무 일이 없는 물건이 된다. 그래서 실험대에서 뺐다.
 * 폐액통·시약병은 끌기로 살아 있어 남겼다.
 *
 * 이 검사는 **앞으로도** 그런 물건이 생기지 않게 지킨다.
 */
test('실험대의 모든 물건이 적어도 한 가지 쓰임이 있다', () => {
  const drops = dropTable(fakeStore(), () => {});
  const taps = tapTable(fakeStore(), () => {});
  const sources = new Set(Object.keys(drops));
  const targets = new Set(Object.values(drops).flatMap((t) => Object.keys(t)));
  const dead = BENCH_KINDS.filter((k) => !sources.has(k) && !targets.has(k) && !taps[k]);
  assert.deepEqual(dead, [],
    `눌러도 끌어도 아무 일이 없는 물건이 있습니다: ${dead.join(', ')}`);
});

test('휴지는 실험대에서 빠졌다 — 손 씻기 말고는 쓰임이 없었다', () => {
  assert.equal(BENCH_KINDS.includes('tissue'), false);
  assert.equal(benchLayout().some((i) => i.id === 'tissue'), false);
});

/*
 * **버리는 자리는 둘 다 열려 있어야 한다.**
 *
 * 이 저장소는 「버리는 손짓이 먼저 나오는 학생도 있으므로 **같은 길을 연다**」를
 * 종이(통·쓰레기통)와 원심관·바이알(폐액통·개수대)에 적용해 놓고,
 * **모세관에만 안 했다.** 폐액통에는 되고 개수대에는 아무 일도 안 났다.
 *
 * 그리고 `PLAYTEST.md` 는 §4 에서 「폐액통·개수대 … 모세관 헹구기」를 **한 줄에 묶어**
 * 시키고 있었다 — 문서가 시키는 자리를 앱이 안 받고 있었던 것이다.
 * (허브 세션이 「앱이 실제로 받는 자리인가로 훑어 보라」고 해서 찾았다.)
 */
test('폐액통에 되는 것은 개수대에도 된다 — 둘 중 하나만 열어 두지 않는다', () => {
  const table = dropTable({ dispatch() {}, getState: () => ({ tools: {} }) }, () => {});
  const onlyOne = [];
  for (const [item, targets] of Object.entries(table)) {
    const w = 'waste' in targets;
    const k = 'sink' in targets;
    if (w !== k) onlyOne.push(`${item}: ${w ? '폐액통만' : '개수대만'}`);
  }
  assert.deepEqual(onlyOne, [],
    `버리는 자리 하나만 열려 있습니다 — 다른 쪽으로 가져간 학생에게는 아무 일도 안 납니다: ${onlyOne.join(' / ')}`);
});

/*
 * **누르면 본다, 끌면 옮긴다, 단추로 한다** (docs/09-uniformity.md §2).
 *
 * 예전에는 잎을 누르면 말없이 신선한 잎↔시든 잎이 바뀌고, 바이알을 누르면 말없이 뚜껑이
 * 열리고 닫혔다. 어떤 물건은 눌러도 아무 일이 없었다. 이제 **모든 물건이 누르면 자기 화면을
 * 열고**, 상태는 그 화면의 단추(잎 고르기 · 뚜껑 덮기/열기 · 꺼내기)로만 바뀐다.
 */
test('모든 물건이 눌러도 조작이 일어나지 않는다 — 자기 화면이 열린다', () => {
  const store = fakeStore();
  const opened = [];
  const taps = tapTable(store, (mode, id) => opened.push([mode, id]));
  for (const kind of BENCH_KINDS) {
    assert.equal(typeof taps[kind], 'function', `${kind} 는 눌러도 아무 일이 없습니다`);
    const before = store.calls.length;
    taps[kind]({ id: kind, kind }, null);
    assert.equal(store.calls.length, before, `${kind} 를 누르는 것만으로 상태가 바뀝니다`);
  }
  assert.equal(opened.length, BENCH_KINDS.length, '누를 때마다 화면이 하나 열려야 합니다');
  const modes = Object.fromEntries(opened.map(([mode, id]) => [id ?? mode, mode]));
  assert.equal(modes.tube, 'tube');
  assert.equal(modes.paper, 'paper');
  assert.equal(modes.vial, 'vial');
  for (const kind of ['leaf', 'bottle', 'paperbox', 'capillary', 'pencil', 'ruler', 'waste', 'sink', 'bin']) {
    assert.equal(modes[kind], 'item', `${kind} 는 물건 화면(item)이 열려야 합니다`);
  }
  // 끌기는 살아 있어야 한다 — 여기까지 지우면 잎을 넣을 길이 없어진다.
  const drops = dropTable(store, () => {});
  assert.ok(drops.leaf.tube, '잎을 원심관에 넣는 길이 없어졌습니다');
  assert.ok(drops.paper.vial, '종이를 바이알에 세우는 길이 없어졌습니다');
});
