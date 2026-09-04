/**
 * 실험대 조작표 테스트.
 *
 * 실험대에서 무엇을 할 수 있는지는 `dropTable` 과 `tapTable` **두 표에만** 적혀 있고,
 * 실제 실행 · 드래그 중 하이라이트 · 안내 문구가 전부 그 표를 읽는다.
 * 여기서 검사하는 것은 「표와 안내 문구가 서로 어긋나지 않는가」다 —
 * 조작을 하나 늘려 놓고 안내를 안 적으면, **학생 눈에는 그 조작이 없는 것과 같다.**
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/* ---------------- 표가 실험대와 맞는가 ---------------- */

test('끌어다 놓는 표의 출발과 도착이 모두 실험대에 있는 물건이다', () => {
  for (const [from, targets] of Object.entries(drops())) {
    assert.ok(BENCH_KINDS.includes(from), `${from} 은 실험대에 없는 물건이다`);
    for (const to of Object.keys(targets)) {
      assert.ok(BENCH_KINDS.includes(to), `${from} → ${to} 의 ${to} 가 실험대에 없다`);
    }
  }
});

/* ---------------- 배치 ---------------- */

test('실험대 위 물건들이 서로 겹치지 않는다', () => {
  // 겹치면 나중에 그려진 쪽이 앞선 쪽의 클릭을 통째로 가로챈다.
  // 재는 것은 **그려진 부분**이다 (프레임이 아니라) — 애셋은 저마다 400×300 프레임을
  // 채워 그리므로 프레임으로 재면 눈에는 한참 떨어져 보이는 둘이 겹친 것이 된다.
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

/**
 * 견주는 것이 이 실험의 전부다. 두 챔버가 멀리 떨어져 있으면
 * **한 화면에서 나란히 보는 일 자체가 안 된다.**
 */
test('두 챔버가 나란히, 가까이 놓인다', () => {
  const byId = Object.fromEntries(benchLayout().map((it) => [it.id, it]));
  const L = byId.chamberL;
  const R = byId.chamberR;
  assert.ok(L && R, '챔버 둘이 실험대에 없습니다');
  assert.equal(Math.round(L.y), Math.round(R.y), '두 챔버가 같은 높이에 있어야 합니다');
  assert.ok(L.x < R.x, '왼쪽 챔버가 왼쪽에 있어야 합니다');
  const gap = R.x - (L.x + L.w);
  assert.ok(gap > 0 && gap < L.w * 2,
    `두 챔버 사이가 ${Math.round(gap)} mm 입니다 — 나란히 견주기 어렵습니다`);
});

test('센서 둘이 챔버와 같은 순서로 놓인다', () => {
  // 순서가 어긋나면 학생이 어느 센서를 어느 챔버에 꽂는지 매번 확인해야 한다.
  const byId = Object.fromEntries(benchLayout().map((it) => [it.id, it]));
  assert.ok(byId.sensorL.x < byId.sensorR.x, '센서 순서가 챔버와 어긋납니다');
});

/* ---------------- 안내 문구 ---------------- */

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
      assert.ok(UI.bench.hints[kind][level].length > 0,
        `${kind} 는 할 수 있는 조작이 있는데 ${level}단계 안내가 비었다`);
    }
  }
});

test('3단계는 이름만 남는다', () => {
  for (const kind of BENCH_KINDS) {
    assert.equal(UI.bench.hints[kind][3].length, 0, `${kind} 의 3단계 안내가 남아 있다`);
  }
});

/**
 * **화면이 답을 먼저 말하지 않는다.**
 * 안내에 「CO₂ 가 늘면 노래집니다」를 적으면 예상 문항이 답을 이미 아는 문제가 된다.
 */
test('안내 문구가 결과를 미리 말하지 않는다', () => {
  const spoiler = /노래|노랑|녹색으로 변|색이 변합니다|온도가 오릅니다|더 많이 나옵니다/;
  for (const [kind, byLevel] of Object.entries(UI.bench.hints)) {
    for (const lines of Object.values(byLevel)) {
      for (const line of lines) {
        assert.equal(spoiler.test(line), false, `${kind} 안내가 결과를 미리 말합니다: "${line}"`);
      }
    }
  }
});

test('난이도는 안내만 줄이고 조작을 줄이지 않는다', () => {
  // 조작표는 난이도를 인자로 받지 않는다. 3단계라고 해서 할 수 있는 일이 사라지면
  // 그건 설명을 줄인 게 아니라 길을 막은 것이다.
  const shape = (t) => Object.entries(t).map(([k, v]) => `${k}:${Object.keys(v).sort().join(',')}`).sort();
  assert.deepEqual(shape(dropTable(fakeStore(3))), shape(dropTable(fakeStore(1))));
  assert.deepEqual(
    Object.keys(tapTable(fakeStore(3), () => {})).sort(),
    Object.keys(tapTable(fakeStore(1), () => {})).sort()
  );
});

/* ---------------- 조작이 실제로 무엇을 보내는가 ---------------- */

test('어느 콩 통에 댔는지가 곧 어느 콩인지다', () => {
  for (const beans of ['sprout', 'dry']) {
    const store = fakeStore();
    dropTable(store).scoop.beanjar({ kind: 'scoop' }, { kind: 'beanjar', beans }, {});
    assert.deepEqual(store.calls, [{ type: 'SCOOP_BEANS', payload: { kind: beans } }]);
  }
});

test('숟가락을 챔버에 대면 그 챔버에 붓는다', () => {
  const store = fakeStore();
  dropTable(store).scoop.chamber({ kind: 'scoop' }, { kind: 'chamber', chamber: 'R' }, {});
  assert.deepEqual(store.calls, [{ type: 'POUR_BEANS', payload: { chamber: 'R' } }]);
});

/**
 * 손끝으로 정하는 값은 실험대에서 곧장 정해지지 않는다.
 *
 * 센서 깊이는 이 실험의 변인이다. 끌어다 대는 것만으로 정해지면 학생이 정할 것이 없다 —
 * 「가져다 대면 알아서 두 방울이 떨어지던」 바나나랩의 자리와 같다.
 */
test('센서를 챔버에 대면 꽂히고 확대 뷰가 열린다', () => {
  const store = fakeStore();
  const opened = [];
  dropTable(store, (...a) => opened.push(a))
    .sensor.chamber({ kind: 'sensor' }, { kind: 'chamber', chamber: 'L' }, {});
  assert.deepEqual(store.calls, [{ type: 'INSTALL_SENSOR', payload: { chamber: 'L' } }]);
  assert.deepEqual(opened, [['L']], '깊이를 정할 화면이 안 열립니다');
});

test('챔버를 개수대에 대면 비운다 — 막다른 길을 없애는 유일한 길이다', () => {
  const store = fakeStore();
  dropTable(store).chamber.sink({ kind: 'chamber', chamber: 'R' }, { kind: 'sink' }, {});
  assert.deepEqual(store.calls, [{ type: 'EMPTY_CHAMBER', payload: { chamber: 'R' } }]);
});

test('휴지를 센서에 대면 닦는다 — 파묻었다 뺐을 때 돌아오는 길이다', () => {
  const store = fakeStore();
  dropTable(store).tissue.sensor({ kind: 'tissue' }, { kind: 'sensor', chamber: 'L' }, {});
  assert.deepEqual(store.calls, [{ type: 'WIPE_SENSOR', payload: { chamber: 'L' } }]);
});

test('눌러도 아무 일도 안 나는 물건이 실험대에 없다', () => {
  // 안전 수칙 조작을 걷어내면서 **폐액통이 통째로 죽을 뻔했다** — 끌기도 받기도 없고
  // 탭이 안전 조작뿐이었다. 그리고 **쓰레기통은 그 전부터 이미 죽어 있었다.**
  // 눌러도 아무 말도 안 나는 물건은 「고장인가?」로 읽힌다.
  const drops = dropTable(fakeStore());
  const taps = tapTable(fakeStore(), () => {});
  const isTarget = (k) => Object.values(drops).some((m) => k in m);
  const kinds = BENCH_KINDS ?? [];
  for (const kind of kinds) {
    assert.ok(drops[kind] || isTarget(kind) || taps[kind],
      `${kind} 은 끌 수도 받을 수도 누를 수도 없습니다 — 실험대 위의 죽은 물건입니다`);
  }
});

test('모든 물건은 눌러도 조작이 일어나지 않는다 — 자기 화면이 열린다', () => {
  /*
   * **누르면 본다, 끌면 옮긴다, 단추로 한다** (docs/09-uniformity.md §2).
   * 폐액통·쓰레기통은 한동안 누르면 알림(`NOTE_PRACTICE`)을 띄웠다 — 이제 그 말은
   * 물건 화면의 덧붙일 말이고, 누르는 것만으로 dispatch 하는 물건은 하나도 없다.
   * **말없이 먹통인 물건도 남기지 않는다** — 실험대의 모든 종류가 표에 있어야 한다.
   */
  const store = fakeStore();
  const opened = [];
  const taps = tapTable(store, (mode, id) => opened.push([mode, id]));
  for (const kind of BENCH_KINDS) {
    assert.equal(typeof taps[kind], 'function', `${kind} 는 눌러도 아무 일이 없습니다`);
    const before = store.calls.length;
    taps[kind]({ id: kind === 'chamber' ? 'chamberR' : kind, kind, chamber: 'R' }, null);
    assert.equal(store.calls.length, before, `${kind} 를 누르는 것만으로 상태가 바뀝니다`);
  }
  assert.ok(opened.every(([mode]) => mode === 'chamber' || mode === 'item'),
    `누르면 챔버 화면이나 물건 화면이 열려야 합니다: ${JSON.stringify(opened)}`);
});

test('챔버를 누르면 그 챔버의 확대 뷰가, 센서를 누르면 센서 자기 화면이 열린다', () => {
  const opened = [];
  const taps = tapTable(fakeStore(), (...a) => opened.push(a));
  taps.chamber({ id: 'chamberR', kind: 'chamber', chamber: 'R' }, null);
  taps.sensor({ id: 'sensorR', kind: 'sensor', chamber: 'R' }, null);
  assert.deepEqual(opened, [['chamber', 'R', null], ['item', 'sensorR', null]]);
});

/* ---------------- 편집 모드가 내는 코드 ---------------- */

test('자유롭게 놓은 자리는 at(x, y) 로 나온다 — 붙여 넣으면 되돌아가지 않는다', () => {
  // 앞서는 「가장 가까운 선」으로만 적어서, 선 사이에 놓아도 붙여 넣는 순간 선으로
  // 되돌아갔다. 화면에서는 옮겨 놓고 코드로는 안 옮겨진 셈이라 같은 일을 몇 번이고
  // 다시 하게 된다. 실제로 70px 내린 것이 surface(...) 로 적혀 사라졌다.
  const src = readFileSync(new URL('../src/ui/bench.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function layoutCode'), src.indexOf('\n}', src.indexOf('function layoutCode')));
  const code = fn.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(code.includes("'at'"),
    'layoutCode 가 at(x, y) 를 낼 줄 모릅니다 — 선 사이에 놓은 자리가 버려집니다');
  assert.ok(/onSurface/.test(code),
    '작업면 선에 **딱 맞는지**를 안 봅니다 — 가장 가까운 선으로 뭉개고 있습니다');
  // defaultItems 가 그 모양을 되읽을 수 있어야 왕복이 성립한다.
  const def = src.slice(src.indexOf('function defaultItems'), src.indexOf('\n}', src.indexOf('function defaultItems')));
  assert.ok(/const at = \(x, y, rest\)/.test(def),
    'defaultItems 에 at() 이 없습니다 — 편집 모드가 낸 코드를 붙여 넣을 수 없습니다');
});

/**
 * **편집 모드 안내문이 실제 동작과 같은 말을 하는가.**
 *
 * 「물건은 선반 또는 작업면에 **자동으로 붙습니다**」가 화면에 떠 있었다.
 * 붙이는 것을 걷어내고 `placeFreely()` 로 바꾼 뒤에도 **문장만 남아 있었다** —
 * 사장님이 「가능한 포지션을 정해 두지 마라」 하셔서 바꾼 그 동작이다.
 * 배포본에 그대로 떠 있었고, 배치를 옮기는 사람이 **그 말을 믿고** 손을 뗀다.
 *
 * 기능을 걷어낸 뒤 그 기능을 설명하는 문장만 남는 것 — 검사가 하나도 안 우는 자리다.
 * 그래서 **문장과 함수를 물려 둔다.** 어느 쪽이 바뀌어도 빨간불이다.
 */
test('편집 모드 안내문이 실제 배치 동작과 같은 말을 한다', () => {
  const src = readFileSync(new URL('../src/ui/bench.js', import.meta.url), 'utf8');
  const note = UI.edit.note;
  assert.ok(note && note.length > 10, '편집 모드 안내문을 못 찾았습니다');

  /**
   * ★ **이름으로 묶으면 아무것도 안 지킨다.**
   * 앞서는 `function placeFreely(` 가 있는지만 봤다. 되돌려 보니 **이름은 그대로 두고
   * 몸통만 선에 붙이게** 바꿔도 이 검사가 통과했다 — 지키려던 것을 하나도 안 지킨 것이다.
   * 그래서 이름은 아예 안 본다. **몸통이 선 상수를 쓰는가**로 판정한다 —
   * 스냅은 그것 없이 못 한다. (허브가 짚었다)
   */
  const at = src.search(/function (placeFreely|snapToLine)\(/);
  assert.notEqual(at, -1, '배치 함수(placeFreely/snapToLine)를 못 찾았습니다 — 이름이 바뀌었으면 이 검사도 고치세요');
  const body = src.slice(at, src.indexOf('\n  }', at));
  const code = body.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // [앞 조건] 몸통을 **제대로** 잘라 읽었는가. 첫 `\n  }` 까지 자르므로, 배치 로직이
  // 뒤쪽 도우미로 옮겨 가면 조용히 딴 데를 읽고 「선 상수가 없다」고 말하게 된다.
  // (되돌려 확인: 로직을 뒤 도우미로 빼면 여기서 운다. 「몸통이 너무 길다」는 눈금도
  //  달아 봤는데 **어떻게 물려도 한 번을 안 울어서** 뺐다 — 안 우는 눈금은 장식이다)
  assert.ok(code.includes('item.y'), `배치 함수 몸통을 못 읽었습니다 (${code.length}자)`);

  const snapping = /SHELF_MM|SURFACE_MM/.test(code);

  /**
   * 문구는 **긍정형만** 잡는다. `/선에 붙/` 로 보면 **「선에 붙지 않습니다」에도 걸려**
   * 반대 뜻을 통과시킨다 — 되돌려 보다 실제로 그랬다.
   * 그리고 **낱말**로 본다. 「자동으로 붙습니다」만 찾으면 「선에 붙습니다」를 놓친다.
   */
  const claimsSnap = /붙습니다|붙어요|붙는다|달라붙|자동 정렬|자동으로 맞[춰추]/.test(note)
    && !/붙지 않|안 붙/.test(note);

  assert.equal(claimsSnap, snapping, [
    snapping
      ? '몸통이 선에 붙이는데 안내문이 그렇게 말하지 않습니다.'
      : '몸통은 놓은 자리에 두는데 안내문이 「붙는다」고 합니다 — 화면이 거짓말을 합니다.',
    `  안내문: ${note}`,
    `  몸통: ${snapping ? '선 상수(SHELF_MM/SURFACE_MM)를 씀 — 붙이고 있다' : '선 상수를 안 씀 — 자유 배치'}`,
    '  ★ 먼저 **어느 쪽이 바뀐 것인지** 보세요. 동작을 되돌린 것이 아니라면 문장을 고쳐야 합니다.',
    snapping
      ? '  붙이는 것이 맞다면: 「물건은 선반 또는 작업면에 자동으로 붙습니다.」'
      : '  자유 배치가 맞다면: 「물건은 놓은 자리에 그대로 남습니다 — 선에 붙지 않습니다.」',
  ].join('\n'));

  if (!snapping) {
    assert.ok(/그대로|붙지 않/.test(note),
      `자유 배치라면 「놓은 자리에 그대로 남는다」고 말해 줘야 합니다:\n  ${note}`);
  }
});

/**
 * **길게 누르기 메뉴를 막는 CSS 는 브라우저 검사로 못 잰다.**
 *
 * `-webkit-touch-callout` 은 크로뮴이 아예 구현하지 않아 계산값에도, CSSOM 에도 없다 —
 * 파싱 단계에서 버린다. 그래서 모바일 흉내 검사는 **「안 걸렸다」와 「못 잰다」를
 * 구별하지 못한다.** 초록불을 보고 멀쩡한 CSS 를 지울 뻔한 세션이 둘 있었다.
 *
 *   잴 수 있는 것  touch-action · user-select  → scripts/check-bench.mjs (폰 흉내)
 *   못 재는 것     -webkit-touch-callout       → **여기, 소스에서**
 *
 * 실기 확인은 아이폰 사파리라야 한다. 여기서 지키는 것은 **규칙이 사라지지 않는 것**뿐이다.
 */
test('폰에서 길게 누르기 메뉴를 막는 규칙이 실험대에 남아 있다', () => {
  // 화면 CSS 는 여덟 실험이 함께 쓰는 한 파일에 있다 (docs/09-uniformity.md §1).
  const css = readFileSync(new URL('../../../packages/lab-kit/style/shell.css', import.meta.url), 'utf8');

  // [앞 조건] 실험대 CSS 를 실제로 읽었는가. 못 읽으면 「0곳이 다 맞다」가 된다.
  assert.match(css, /\.bench-stage\s*[,{]/, '실험대 CSS 를 못 찾았습니다 — 이름이 바뀌었으면 이 검사도 고치세요');

  // 주석을 먼저 벗긴다 — 안 벗기면 주석 글이 **선택자에 딸려 들어와**,
  // 주석에 적힌 `textarea` 같은 말 때문에 엉뚱한 데서 운다. (되돌려 보다 실제로 그랬다)
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const rules = [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => /-webkit-touch-callout\s*:\s*none/.test(body))
    .map(([, sel]) => sel.replace(/\s+/g, ' ').trim());
  assert.ok(rules.length > 0, '길게 누르기 메뉴를 막는 규칙이 하나도 없습니다');

  // 공용 CSS 는 `.bench-stage *` 로 무대 안 전부(물건 층 포함)를 한 번에 막는다 — 그것도 덮은 것으로 센다.
  const covered = (name) => rules.some((sel) => sel.includes(name) || (name !== '.bench-stage' && /\.bench-stage \*/.test(sel)));
  const missing = ['.bench-stage', '.bench-tokens', '.token'].filter((n) => !covered(n));
  assert.deepEqual(missing, [], [
    `실험대에서 길게 누르면 복사 메뉴가 뜹니다 — 안 막힌 자리: ${missing.join(' · ')}`,
    '  ★ 이것은 **아이폰 사파리에서만** 실제로 확인됩니다. 여기서는 규칙이 있는지만 봅니다.',
    `  지금 걸린 자리: ${rules.join(' / ')}`,
  ].join('\n'));

  // 글칸에 걸면 학생이 자기가 쓴 글을 고르지도 붙여넣지도 못한다. **닿으면 안 되는 자리다.**
  const onNotes = rules.filter((sel) => /textarea|#note-panel|body\b/.test(sel));
  assert.deepEqual(onNotes, [],
    `글칸까지 막고 있습니다 — 학생이 자기가 쓴 글을 못 고릅니다: ${onNotes.join(' / ')}`);
});
