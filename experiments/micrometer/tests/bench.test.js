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
import { readdirSync, readFileSync } from 'node:fs';
import { stripComments } from './strip-comments.js';
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

test('재물대에 올리는 것이 실험대의 몸통이다', () => {
  // 이 실험에서 실험대가 하는 일은 셋뿐이다 — 접안렌즈에 끼우고, 재물대에 올리고, 정리한다.
  // 나머지(세기·기록)는 전부 확대 뷰에서 일어난다.
  for (const kind of ['stageMic', 'specimen']) {
    const store = fakeStore();
    dropTable(store)[kind].microscope({ item: kind });
    assert.deepEqual(store.calls, [{ type: 'PLACE_ON_STAGE', payload: { item: kind } }]);
  }
});

test('끼우는 방향은 실험대에서 정하지 않는다', () => {
  // 뒤집어 끼웠는지 아닌지는 손끝 일이다. 실험대에서 끌어다 대는 것만으로는 정할 길이 없어
  // 확대 뷰를 연다. 여기서 곧장 INSERT_OCULAR 를 쏘면 학생이 방향을 고를 기회가 사라진다.
  const store = fakeStore();
  let opened = null;
  dropTable(store, (mode) => { opened = mode; }).ocular.microscope({});
  assert.equal(opened, 'ocular');
  assert.deepEqual(store.calls, [], '실험대에서 곧장 끼우면 안 된다');
});

test('금 간 기구를 새것으로 바꿀 길이 있다', () => {
  // 대물 마이크로미터는 이 실험에서 유일한 기준자다. 깨지고 새것을 꺼낼 길이 없으면
  // 실험이 거기서 끝난다 — 그건 결과가 아니라 막다른 길이다.
  //
  // **저마다 제자리가 다르다.** 대물 마이크로미터는 자기 보관함으로, 표본은 표본 상자로 간다.
  // 한때는 둘 다 표본 상자였는데, 대물 마이크로미터를 표본 상자에서 꺼내는 그림은 거짓말이고
  // 학생은 그 거짓말을 실험 순서로 배운다.
  const home = { stageMic: 'stageMicBox', specimen: 'specimenBox' };
  for (const [kind, box] of Object.entries(home)) {
    const store = fakeStore();
    dropTable(store)[kind][box]({ item: kind });
    assert.deepEqual(store.calls, [{ type: 'NEW_ITEM', payload: { item: kind } }]);
  }
});

test('상자를 누르면 조작이 일어나지 않고 들여다본다', () => {
  // **누르는 것만으로 되돌아갈 수 없는 자리가 생기면 안 된다** (AGENTS.md §2.1).
  // 앞서는 통을 누르면 곧장 「넣기」가 일어나 원판이 통 속으로 사라졌는데, 꺼내는 길이
  // 없어서 다시 누르면 또 넣기였다. 이제 눌러서 **들여다보고**, 거기서 고른다.
  for (const kind of ['ocularBox', 'specimenBox', 'stageMicBox']) {
    const store = fakeStore();
    const opened = [];
    tapTable(store, (...args) => opened.push(args))[kind]({}, null);
    assert.deepEqual(store.calls, [],
      `${kind} 를 눌렀는데 조작이 곧장 일어났습니다 — 되돌아갈 길 없이 상태가 바뀝니다`);
    assert.equal(opened.length, 1, `${kind} 를 눌러도 아무것도 안 열립니다`);
  }
});

/**
 * 안전 규칙을 **지켜보지 않는다.** 그래서 「정리 넷을 부르는 자리가 있는가」를 재던
 * 검사는 뜻이 없어졌다. 지우지 않고 **뜻을 바꾼다** —
 * 지켜보던 장치가 화면에 하나도 안 남았는지를 본다.
 */
test('안전 점수를 위해 있던 조작이 화면에 하나도 없다', () => {
  const dir = new URL('../src/', import.meta.url);
  const read = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const at = new URL(e.name + (e.isDirectory() ? '/' : ''), d);
    return e.isDirectory() ? read(at) : (e.name.endsWith('.js') ? [readFileSync(at, 'utf8')] : []);
  });
  const src = stripComments(read(dir).join('\n'));
  for (const type of ['CHECK_TIDY', 'NOTE_VIOLATION', 'LAMP_OFF', 'LOWER_OBJECTIVE', 'PUT_AWAY_SPECIMEN']) {
    assert.equal(src.includes(`'${type}'`), false,
      `${type} 을 부르는 자리가 아직 있습니다 — 안전 규칙은 적어 두기만 합니다`);
  }
});

test('남긴 물건은 여전히 무언가를 한다 — 말없이 먹통인 물건을 남기지 않는다', () => {
  // ★ 안전 전용 조작을 걷어내다 보면 **눌러도 아무 일도 안 나는 물건**이 남기 쉽다.
  //   그건 우리가 이미 한 번 잡은 버그다 (「잘된 조작이 아무 말도 못 한다」).
  const opened = [];
  const store = fakeStore();
  const taps = tapTable(store, (...args) => opened.push(args));
  for (const kind of BENCH_KINDS) {
    const acts = store.calls.length;
    const opens = opened.length;
    taps[kind]?.({ item: kind }, null);
    const dropsTo = Object.keys(dropTable(fakeStore(), () => {})[kind] ?? {});
    const doesSomething = store.calls.length > acts || opened.length > opens || dropsTo.length > 0;
    assert.ok(doesSomething,
      `${kind} 은 눌러도 끌어도 아무 일이 안 납니다 — 말없이 먹통인 물건입니다`);
  }
});

test('통에 넣는 길이 있으면 꺼내는 길도 있다', () => {
  // 넣기만 있고 꺼내기가 없으면 원판이 통 속으로 사라진 채 돌아오지 못한다.
  const dir = new URL('../src/ui/', import.meta.url);
  const src = readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(new URL(f, dir), 'utf8'))
    .join('\n');
  assert.ok(src.includes("'TAKE_OUT_OCULAR'"),
    '통에서 꺼내는 길이 화면 어디에도 없습니다 — 넣으면 돌아올 수 없습니다');
});
