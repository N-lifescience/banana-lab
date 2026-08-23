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
import { dropTable, tapTable, BENCH_KINDS } from '../src/ui/bench.js';
import { UI } from '../src/ui/strings.js';
import { initialState } from '../src/sim/state.js';

const LEVELS = [1, 2, 3];

/** dispatch 를 받아 적기만 하는 가짜 저장소. */
function fakeStore(level = 1) {
  const calls = [];
  return {
    calls,
    getState: () => initialState(level, 12345),
    dispatch(type, payload) {
      calls.push({ type, payload });
      return { state: initialState(level, 12345), outcome: 'ok', message: null, tag: null };
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

test('안전 수칙 세 가지를 실험대에서 부를 수 있다', () => {
  // 이 셋은 rules.js 에 오래 있었지만 부르는 곳이 없었다 —
  // 위반 기록이 한 번 남으면 자기 평가에서 영영 지워지지 않았다.
  const expected = { bottle: 'CLOSE_CAP', waste: 'DISPOSE_WASTE', tissue: 'WASH_HANDS' };
  for (const [kind, action] of Object.entries(expected)) {
    const store = fakeStore();
    tapTable(store, () => {})[kind]({ kind }, null);
    assert.deepEqual(store.calls.map((c) => c.type), [action], `${kind} 을 눌러도 ${action} 이 안 간다`);
  }
});
