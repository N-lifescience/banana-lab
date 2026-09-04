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

test('해부칼을 비늘잎에 대면 칼집이 난다', () => {
  // 칼집이 없으면 표피가 통째로 찢겨 두껍게 벗겨진다 (docs/04 R-03).
  // **막지 않는다** — 칼집 없이 벗기는 것도 그대로 되고, 겹쳐 보이는 시야가 대신 답한다.
  const store = fakeStore();
  dropTable(store).blade.onion({ kind: 'blade' }, { kind: 'onion' }, {});
  assert.deepEqual(store.calls.map((c) => c.type), ['CUT_SCALE']);
});

test('거름종이를 받침 유리에 대면 용액이 치환된다', () => {
  // 이 실험의 중심 조작이다. **여기서 「가장자리에 용액을 먼저 대세요」로 막지 않는다** —
  // 댈 것이 없으면 규칙 엔진이 어디에 무엇을 하면 되는지 답해 주고, 그 답이 배우는 내용이다.
  const store = fakeStore();
  dropTable(store).filterpaper.slide({ kind: 'filterpaper' }, { kind: 'slide', slide: 'C' }, {});
  assert.deepEqual(store.calls, [{ type: 'WICK', payload: { slide: 'C' } }]);
});

test('용액병에서 채울 때 어느 농도인지가 전해진다', () => {
  // 병 다섯이 색이 다 같아서, 여기가 어긋나면 학생은 이름표를 읽고 골랐는데
  // 엉뚱한 농도가 담기고도 **화면 어디에서도 그것을 알 수 없다.**
  const store = fakeStore();
  dropTable(store).dropper.bottle({ kind: 'dropper' }, { kind: 'bottle', solution: 'S15' }, {});
  assert.deepEqual(store.calls, [{ type: 'FILL_DROPPER', payload: { solution: 'S15' } }]);
});

test('손끝으로 하는 일은 실험대에서 곧장 일어나지 않고 확대 뷰를 연다', () => {
  // 방울 수와 덮는 각도는 이 실험의 변인이다. 실험대에서 끌어다 대는 것만으로 정해지면
  // 학생이 정할 수 있는 것이 없다 — 가져다 대면 알아서 두 방울이 떨어지던 것이 그랬다.
  // 확대 뷰를 열어 거기서 고무를 누르고 핀셋을 기울인다.
  // 들고 온 도구가 무엇인지도 함께 넘겨야 한다 — 확대 뷰는 들고 온 것만 보여 준다.
  // 스포이트만 가져왔는데 핀셋이 함께 떠 있으면 무엇을 하는 화면인지 알 수 없다.
  for (const tool of ['dropper', 'forceps']) {
    const store = fakeStore();
    const opened = [];
    dropTable(store, (...a) => opened.push(a))[tool]
      .slide({ kind: tool }, { kind: 'slide', slide: 'B' }, { lastDx: 10, lastDy: 10 });
    assert.deepEqual(store.calls, [], `${tool} 가 실험대에서 곧장 조작을 일으킨다`);
    assert.deepEqual(opened, [['slide', 'B', tool]], `${tool} 를 들고 온 것이 전해지지 않는다`);
  }
});

test('1단계만 저배율 초점을 대신 맞춰 주고 100배로 올려 준다', () => {
  // 나사 조작을 잘못하면 슬라이드가 깨져 되돌릴 길이 좁아진다. 1단계는 그걸 감당하는 자리가 아니다.
  // 다만 **순서**가 중요하다 — 초점을 먼저 맞추고 배율을 올린다.
  // 400배로 올린 뒤 조동나사를 건드리면 그 자리에서 슬라이드가 깨지고,
  // 초점을 안 맞춘 채 올리면 학생이 한 적 없는 일로 "저배율에서 초점을 안 맞췄다" 는 경고가 뜬다.
  // 배율은 슬라이드를 바꿔도 남아 있다. 앞 것을 400배로 보다가 새것을 올리면
  // 곧바로 400배에서 조동나사를 돌리는 셈이 되어 올리자마자 깨진다 — 실제로 그렇게 깨졌다.
  const one = fakeStore(1, (s) => ({ ...s, microscope: { ...s.microscope, objective: 40 } }));
  dropTable(one).slide.microscope({ kind: 'slide', slide: 'B' }, { kind: 'microscope' }, {});
  assert.deepEqual(one.calls.map((c) => c.type),
    ['MOUNT', 'SET_OBJECTIVE', 'COARSE_FOCUS', 'SET_OBJECTIVE']);
  assert.equal(one.calls[1].payload.objective, 4, '조동나사를 돌리기 전에 저배율로 내려야 한다');
  // **400배가 아니라 100배다.** 이 관찰이 재는 것은 「몇 개 중 몇 개」라 시야에 셀 만큼의
  // 세포가 있어야 한다 (quality.magnificationFactor). 바나나랩에서 베껴 오면 안 되는 곳이다.
  assert.equal(one.calls[3].payload.objective, 10);

  // 2·3단계는 저배율부터 직접 올라간다.
  for (const level of [2, 3]) {
    const store = fakeStore(level);
    dropTable(store).slide.microscope({ kind: 'slide', slide: 'B' }, { kind: 'microscope' }, {});
    assert.deepEqual(store.calls.map((c) => c.type), ['MOUNT'],
      `${level}단계에서 올리는 것 말고 다른 일이 함께 일어난다`);
  }
});

test('쓴 덮개 유리는 쓰레기통에 버린다', () => {
  const store = fakeStore(1, (s) => ({
    ...s, tools: { ...s.tools, forceps: { holding: 'usedCoverslip' } },
  }));
  dropTable(store).forceps.bin({ kind: 'forceps' }, { kind: 'bin' }, {});
  assert.deepEqual(store.calls.map((c) => c.type), ['DISCARD_COVERSLIP']);
});

test('받침 유리를 개수대에 대면 씻는다', () => {
  // 씻을 길이 없으면
  // 받침 유리 석 장짜리 실험에서 실수 한 번이 곧 막다른 길이 된다.
  const store = fakeStore();
  dropTable(store).slide.sink({ kind: 'slide', slide: 'C' }, { kind: 'sink' }, {});
  assert.deepEqual(store.calls, [{ type: 'RINSE_SLIDE', payload: { slide: 'C' } }]);
});

/*
 * **안전 전용 탭은 걷어냈다** — 안전을 앱이 판정하지 않기로 했기 때문이다.
 * 그런데 셋 다 실험대에 그대로 남아 있다. **끌기 쓰임이 따로 있어서**다.
 * 누르면 **자기 화면이 열린다** (docs/09-uniformity.md §2 — 누르면 본다, 끌면 옮긴다,
 * 단추로 한다). 상태는 바뀌지 않는다 — **말없이 먹통인 물건은 남기지 않는다.**
 */
test('용액병·폐액통·휴지는 눌러도 조작이 일어나지 않는다 — 자기 화면이 열린다', () => {
  const store = fakeStore();
  const opened = [];
  const taps = tapTable(store, (mode, id) => opened.push([mode, id]));
  for (const kind of ['bottle', 'waste', 'tissue', 'sink', 'bin', 'slidebox', 'coverslip',
    'dropper', 'forceps', 'blade', 'filterpaper']) {
    assert.equal(typeof taps[kind], 'function', `${kind} 는 눌러도 아무 일이 없습니다`);
    const before = store.calls.length;
    taps[kind]({ id: kind, kind }, null);
    assert.equal(store.calls.length, before, `${kind} 를 누르는 것만으로 상태가 바뀝니다`);
  }
  assert.ok(opened.every(([mode]) => mode === 'item'),
    `누르면 물건 화면(item)이 열려야 합니다: ${JSON.stringify(opened)}`);
});

test('실험대의 모든 물건이 누르면 무언가를 연다 (말없이 먹통인 물건이 없다)', () => {
  const taps = tapTable(fakeStore(), () => {});
  for (const kind of BENCH_KINDS) {
    assert.equal(typeof taps[kind], 'function', `${kind} 를 눌러도 아무 일이 없습니다`);
  }
});

test('그래도 셋 다 끌기로는 쓸모가 있다 (말없이 먹통인 물건을 남기지 않는다)', () => {
  const D = dropTable(fakeStore(), () => {});
  assert.ok(D.tissue?.microscope, '휴지로 렌즈를 못 닦습니다');
  assert.ok(D.dropper?.waste, '폐액통에서 스포이트를 못 헹굽니다');
  assert.ok(D.dropper?.bottle, '시약병에서 스포이트를 못 채웁니다');
});
