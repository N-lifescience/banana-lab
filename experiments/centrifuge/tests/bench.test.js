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

test('손끝으로 하는 일은 실험대에서 곧장 일어나지 않고 확대 뷰를 연다', () => {
  // 각도 · 누르는 깊이 · 당기는 세기는 이 실험의 변인이다. 실험대에서 끌어다 대는 것만으로
  // 정해지면 학생이 정할 수 있는 것이 없다 (PLAYBOOK §4).
  const cases = [
    ['finger', 'draw', '손끝에 대면 빨아올리는 확대 뷰'],
    ['clay', 'seal', '고무찰흙에 대면 막는 확대 뷰'],
  ];
  for (const [target, wantMode, why] of cases) {
    const store = fakeStore();
    const opened = [];
    dropTable(store, (...a) => opened.push(a))
      .capillary[target]({ kind: 'capillary' }, { kind: target }, { lastDx: 10, lastDy: 10 });
    assert.deepEqual(store.calls, [], `${why}: 실험대에서 곧장 조작이 일어난다`);
    assert.deepEqual(opened, [[wantMode]], `${why}: 확대 뷰가 안 열린다`);
  }
});

test('회전판을 누르면 끈을 당기는 확대 뷰가 열린다', () => {
  // 이 실험의 몸통이 그 화면에 있다. 여기가 막히면 실험이 없는 것과 같다.
  const store = fakeStore();
  const opened = [];
  tapTable(store, (...a) => opened.push(a)).rotor({ kind: 'rotor' }, null);
  assert.deepEqual(store.calls, []);
  assert.equal(opened[0][0], 'spin');
});

test('모세관 통을 누르면 헤파린과 민무늬가 오간다', () => {
  // **이것이 이 실험의 변인이다.** 화면이 알아서 헤파린을 집어 주면
  // "왜 헤파린이 발린 것을 쓰는가" 가 학생 손을 떠난다.
  const store = fakeStore();
  tapTable(store, () => {}).capbox({ kind: 'capbox' }, null);
  assert.deepEqual(store.calls, [{ type: 'PICK_CAPILLARY', payload: { kind: 'plain' } }]);
});

test('모세관을 회전판에 대면 시료로, 모세관 통을 대면 균형추로 들어간다', () => {
  const a = fakeStore();
  dropTable(a).capillary.rotor({ kind: 'capillary' }, { kind: 'rotor' }, {});
  assert.equal(a.calls[0].payload.what, 'sample');

  const b = fakeStore();
  dropTable(b).capbox.rotor({ kind: 'capbox' }, { kind: 'rotor' }, {});
  assert.equal(b.calls[0].payload.what, 'counter');
});

test('잘못 채운 모세관에서 빠져나가는 길이 실험대에 있다', () => {
  // 막다른 길을 만들지 않는다. 통에 대면 새것, 폐기물 통에 대면 버리고 새것.
  const box = fakeStore();
  dropTable(box).capillary.capbox({ kind: 'capillary' }, { kind: 'capbox' }, {});
  assert.deepEqual(box.calls.map((c) => c.type), ['NEW_CAPILLARY']);

  const bin = fakeStore();
  dropTable(bin).capillary.bin({ kind: 'capillary' }, { kind: 'bin' }, {});
  assert.deepEqual(bin.calls.map((c) => c.type), ['NEW_CAPILLARY']);
});

test('자를 모세관에 대면 층의 길이를 읽는다', () => {
  const store = fakeStore();
  dropTable(store).ruler.capillary({ kind: 'ruler' }, { kind: 'capillary' }, {});
  assert.deepEqual(store.calls.map((c) => c.type), ['MEASURE']);
});

test('안전 수칙은 조작이 아니라 **적어 둔 안내**다', () => {
  // **세던 것을 걷어냈다.** 손 씻기·침 버리기·지혈은 조작으로 두지 않는다 —
  // 억지로 정리를 시키는 것은 배우는 일이 아니고, 세는 순간 화면이 「지켰다/놓쳤다」 를
  // 말해야 하는데 그 판정이 학생을 대신해 거짓말을 하기 쉽다.
  // 대신 2쪽(준비물)에 **실제 실험 기준으로** 적어 두고, 앱이 확인하지 않는다는 것도 밝힌다.
  const taps = tapTable(fakeStore(), () => {});
  for (const kind of ['sink', 'bin', 'sharpsbin', 'tissue']) {
    assert.equal(taps[kind], undefined, `${kind} 에 안전 조작이 남아 있습니다`);
  }
  const drops = dropTable(fakeStore());
  assert.equal(drops.tissue, undefined, '휴지에 조작이 남아 있습니다');
  assert.equal(drops.lancet.sharpsbin, undefined, '채혈침을 침 폐기함에 버리는 조작이 남아 있습니다');

  // **안내는 사라지지 않았다.** 조작만 걷어낸 것이지 가르치는 것을 뺀 것이 아니다.
  const notes = UI.notebook.safetyNotes.join(' ');
  for (const must of ['일회용', '손상성 폐기물', '자기 손끝', '지혈', '손을 씻습니다']) {
    assert.ok(notes.includes(must), `안전 안내에 「${must}」 가 없습니다`);
  }
  assert.match(UI.notebook.safetyDisclaimer, /확인하지 않습니다/,
    '이 앱이 안전 수칙을 확인하지 않는다는 것을 밝히지 않았습니다');
});

test('실험대에 **눌러도 아무 일 없는 물건**이 없다', () => {
  // 안전 조작만 쓰이던 물건을 남겨 두면 눌러도 아무 일 없는 물건이 된다.
  // 끌기 출발점도, 놓을 곳도, 탭도 없는 물건은 학생에게 고장으로 읽힌다.
  const drops = dropTable(fakeStore(), () => {});
  const taps = tapTable(fakeStore(), () => {});
  const targets = new Set(Object.values(drops).flatMap((o) => Object.keys(o)));
  const dead = benchLayout()
    .map((it) => it.id)
    .filter((id) => !drops[id] && !targets.has(id) && !taps[id]);
  assert.deepEqual(dead, [], `눌러도 아무 일 없는 물건이 있습니다: ${dead.join(', ')}`);
});

test('소독과 채혈이 손끝에서 일어난다', () => {
  // 소독은 **안전 점검이 아니라 탐구 과정 STEP 1 의 첫 칸**이라 그대로 남는다.
  const cases = [['swab', 'SWAB_FINGER'], ['lancet', 'PRICK_FINGER']];
  for (const [from, action] of cases) {
    const store = fakeStore();
    dropTable(store)[from].finger({ kind: from }, { kind: 'finger' }, {});
    assert.deepEqual(store.calls.map((c) => c.type), [action]);
  }
});
