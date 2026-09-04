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

test('문지른 거리가 시료 두께가 된다', () => {
  const cases = [
    [0, 0.12, '대기만 하고 문지르지 않으면 가장 얇게'],
    [350, 0.5, '절반쯤 문지르면 절반쯤'],
    [700, 0.9, '충분히 문지르면 가장 두껍게'],
    [5000, 0.9, '아무리 문질러도 상한을 넘지 않는다'],
  ];
  for (const [smearMm, expected, why] of cases) {
    const store = fakeStore();
    dropTable(store).banana.slide({ kind: 'banana' }, { kind: 'slide', slide: 'A' }, { smearMm });
    assert.equal(store.calls.length, 1);
    assert.equal(store.calls[0].type, 'SMEAR');
    assert.ok(
      Math.abs(store.calls[0].payload.thickness - expected) < 1e-9,
      `${why}: ${smearMm}mm → ${store.calls[0].payload.thickness} (기대 ${expected})`
    );
  }
});

test('손끝으로 하는 일은 실험대에서 곧장 일어나지 않고 확대 뷰를 연다', () => {
  // 방울 수와 덮는 각도는 이 실험의 변인이다. 실험대에서 끌어다 대는 것만으로 정해지면
  // 학생이 정할 수 있는 것이 없다 — 가져다 대면 알아서 두 방울이 떨어지던 것이 그랬다.
  // 확대 뷰를 열어 거기서 고무를 누르고 핀셋을 기울인다.
  // 들고 온 도구가 무엇인지도 함께 넘겨야 한다 — 확대 뷰는 들고 온 것만 보여 준다.
  // 바나나만 문질렀는데 핀셋과 스포이트가 함께 떠 있으면 무엇을 하는 화면인지 알 수 없다.
  for (const tool of ['dropper', 'forceps']) {
    const store = fakeStore();
    const opened = [];
    dropTable(store, (...a) => opened.push(a))[tool]
      .slide({ kind: tool }, { kind: 'slide', slide: 'B' }, { lastDx: 10, lastDy: 10 });
    assert.deepEqual(store.calls, [], `${tool} 가 실험대에서 곧장 조작을 일으킨다`);
    assert.deepEqual(opened, [['slide', 'B', tool]], `${tool} 를 들고 온 것이 전해지지 않는다`);
  }
});

test('1단계만 저배율 초점을 대신 맞춰 주고 고배율로 올려 준다', () => {
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
  assert.equal(one.calls[3].payload.objective, 40);

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

test('말풍선이 없는 조작을 약속하지 않는다 — 세 난이도 모두', () => {
  /*
   * 탭을 걷어내면서 **말풍선의 「클릭하면 …」 은 남기기 쉽다.** 그러면 학생은 눌러 보고
   * 아무 일도 안 나는 것을 보고 고장이라고 여긴다 — **기능이 없는데 안내가 있는 것은
   * 안내가 없는 것보다 나쁘다.**
   *
   * ★ **세 난이도를 다 훑는다.** `UI.bench.hints` 는 난이도마다 문자열이 따로 있어서,
   * 한 단계만 보는 검사는 나머지 둘에 남은 약속을 못 본다. fermentation 세션이 바로
   * 그 구멍에 물렸다 — 2단계 문구에 약속을 되살렸는데 1단계만 보는 검사가 초록불이었다.
   */
  const taps = tapTable(fakeStore(), () => {});
  for (const [kind, byLevel] of Object.entries(UI.bench.hints)) {
    for (const [level, lines] of Object.entries(byLevel)) {
      const promises = (lines ?? []).filter((t) => /클릭/.test(t));
      if (promises.length === 0) continue;
      assert.ok(taps[kind],
        `${kind} 의 ${level}단계 말풍선이 클릭을 약속하는데 누르는 조작이 없습니다`
        + ` — 학생은 눌러 보고 고장이라고 여깁니다: ${promises.join(' / ')}`);
    }
  }
});

test('시약병·폐액통·휴지는 눌러도 조작이 일어나지 않는다 — 자기 화면이 열린다', () => {
  /*
   * 손 씻기·마개 닫기·폐액 버리기를 **통째로 걷어냈다.** 가상 실험에서 그것을 따지면
   * 안전 습관이 아니라 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다.
   *
   * 그래도 셋은 실험대에 남아 있고 **하는 일이 있다** — 스포이트를 대면 채우고, 헹구고,
   * 휴지를 현미경에 대면 렌즈를 닦는다. 끌기는 살아 있다.
   * 누르면 **자기 화면이 열린다** (docs/09-uniformity.md §2 — 누르면 본다, 끌면 옮긴다,
   * 단추로 한다). 상태는 바뀌지 않는다 — **말없이 먹통인 물건은 남기지 않는다.**
   */
  const store = fakeStore();
  const opened = [];
  const taps = tapTable(store, (mode, id) => opened.push([mode, id]));
  for (const kind of ['bottle', 'waste', 'tissue', 'sink', 'bin', 'slidebox', 'coverslip', 'dropper', 'forceps']) {
    assert.equal(typeof taps[kind], 'function', `${kind} 는 눌러도 아무 일이 없습니다`);
    const before = store.calls.length;
    taps[kind]({ id: kind, kind }, null);
    assert.equal(store.calls.length, before, `${kind} 를 누르는 것만으로 상태가 바뀝니다`);
  }
  assert.ok(opened.every(([mode]) => mode === 'item'), `누르면 물건 화면(item)이 열려야 합니다: ${JSON.stringify(opened)}`);
  // 끌기는 살아 있어야 한다 — 여기까지 지우면 스포이트를 채울 길이 없어진다.
  const drops = dropTable(store, () => {});
  assert.ok(drops.dropper.bottle, '스포이트를 시약병에 대는 길이 없어졌습니다');
  assert.ok(drops.dropper.waste, '스포이트를 헹구는 길이 없어졌습니다');
  assert.ok(drops.tissue.microscope, '휴지로 렌즈를 닦는 길이 없어졌습니다');
});
