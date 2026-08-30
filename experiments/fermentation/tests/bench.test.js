/**
 * 실험대 테스트.
 *
 * 화면 없이 볼 수 있는 것만 여기 둔다 — **배치**와 **조작표**다.
 * 어포던스(말풍선이 실제로 뜨는가, 잡히는 크기인가)는 브라우저가 있어야 하므로
 * `scripts/check-screen.mjs` 로 뺐다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchLayout, dropTable, tapTable } from '../src/ui/bench.js';
import { CONTRACT } from '../src/assets/contract.js';
import { ACTIONS } from '../src/sim/rules.js';
import { UI } from '../src/ui/strings.js';

const LAYOUT = benchLayout();
const STAGE_W_MM = CONTRACT.bench.realSizeMm;

/** 조작표는 함수를 담고 있어 그냥은 못 본다. 아무것도 안 하는 store 로 종류 쌍만 뽑는다. */
function tableShape() {
  const calls = [];
  const store = {
    getState: () => ({ session: { level: 1 }, bench: {} }),
    dispatch: (type, payload) => { calls.push({ type, payload }); },
  };
  return { drops: dropTable(store), taps: tapTable(store), calls, store };
}

/* ================== 배치 ================== */

/**
 * 물건이 서로 겹치면 **뒤에 그려진 쪽이 앞엣것의 클릭을 가로챈다.**
 *
 * 이웃 실험에서 첫 배치가 그랬다 — 비커가 수조를 덮었고 쓰레기통은 실험대 오른쪽 밖에 있었다.
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

test('조건마다 물건이 하나씩 있다', async () => {
  // 화면이 조건을 대신 골라 주면 통제변인을 틀릴 수가 없어지고, 틀릴 수 없으면
  // 그래프에서 어긋난 점을 볼 일도 없다 — 이 실험이 가르치려는 것이 사라진다.
  const { CHOICES } = await import('../src/sim/state.js');
  const ids = LAYOUT.map((i) => i.id);
  for (const t of CHOICES.tempC) assert.ok(ids.includes(`inc${t}`), `${t} ℃ 항온기가 없습니다`);
  // 포도당 농도는 병으로 늘어놓지 않는다 — **만들어 쓴다.** 10 % 병과 증류수와 빈 병
  // 셋이 있으면 5 % 도 3.3 % 도 만들 수 있고, 만드는 것이 이 실험의 절차다.
  for (const id of ['glucose10', 'water', 'mix']) {
    assert.ok(ids.includes(id), `${id} 이 없습니다 — 이것이 없으면 농도를 만들 수 없습니다`);
  }
});

test('막힘 문구가 가리키는 조작이 실험대에 있다', async () => {
  // 「발효관을 눌러 솜마개를 먼저 빼세요」라고 해 놓고 그 조작이 없으면 거짓말이 된다.
  // **막다른 길이 되는 자리라 특히 그렇다** — 빼는 길이 없으면 아무것도 부을 수 없다.
  const { tapTable } = await import('../src/ui/bench.js');
  const store = { getState: () => ({ session: { level: 1 }, bench: {} }), dispatch: () => {} };
  assert.ok(tapTable(store).fermtube, '발효관을 눌러도 아무 일이 없습니다');
  assert.ok(LAYOUT.some((i) => i.kind === 'cotton'), '솜마개가 실험대에 없습니다');
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
    const store = { getState: () => ({ session: { level }, bench: {} }), dispatch: () => {} };
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

/*
 * **`PLAYTEST.md` 가 시키는 끌기를 앱이 실제로 받는가.**
 *
 * 이웃 실험이 「스포이트를 **개수대**에 대어 씻으라」고 적어 두었는데 앱은 **폐액통만**
 * 받았다. 선생님이 그대로 하시면 아무 일도 안 일어나고, **버그로 적어 보내신다.**
 * 여기도 하나 있었다 — 「폐액통을 끌어다 놓는 것은 그대로 된다」고 했는데 폐액통은
 * **드는 물건이 아니라 놓는 자리**다.
 *
 * 이건 `PLAYTEST` 가 **선생님이 보는 문서**라 더 급하다. 코드 주석이 낡으면 다음 사람이
 * 헷갈리지만, 이 문서가 낡으면 **없는 버그가 신고된다.**
 */
test('PLAYTEST 가 시키는 끌기를 앱이 받는다', async () => {
  const { readFileSync } = await import('node:fs');
  const doc = readFileSync(new URL('../PLAYTEST.md', import.meta.url), 'utf8');

  // 이름 → 물건 id → kind. 긴 이름부터 맞춰야 「발효관」이 「30 ℃ 항온기」를 가로채지 않는다.
  const kindOf = Object.fromEntries(benchLayout().map((i) => [i.id, i.kind]));
  // **두 이름표를 합치지 않는다.** 합치면 물건 하나에 이름이 하나만 남아, 긴 이름이
  // 짧은 이름을 덮는다 — 「만든 병」이 「만든 포도당 수용액 (빈 병)」에 덮여 안 읽혔다.
  // 문서는 둘 다 쓰므로 **둘 다** 후보로 둔다.
  const names = [...Object.entries(UI.bench.shortNames), ...Object.entries(UI.bench.items)]
    .filter(([id]) => kindOf[id])
    .sort((a, b) => b[1].length - a[1].length);
  const idOf = (label) => names.find(([, n]) => label.includes(n))?.[0];

  /*
   * 「**A**을 **B**으로 끌기」 — 굵게 쓴 이름 둘을 뽑는다.
   *
   * **표 한 칸 안에서만 찾는다.** 처음엔 줄 전체에서 찾았더니 「하는 일」 칸의 이름과
   * 옆 「이래야 정상」 칸의 굵은 글씨가 짝지어져 「를 말한다 |」 같은 것이 이름으로 잡혔다.
   */
  const rows = [];
  for (const line of doc.split('\n')) {
    if (!line.startsWith('|')) continue;
    for (const cell of line.split('|')) {
      if (!/(으로|로)\s*끌/.test(cell)) continue;
      const m = cell.match(/\*\*([^*]{2,30})\*\*[^*]{0,12}?\*\*([^*]{2,30})\*\*(?:으로|로)\s*끌/);
      if (m) rows.push({ raw: `${m[1]} → ${m[2]}`, from: idOf(m[1]), to: idOf(m[2]) });
    }
  }

  /*
   * **앞 조건 둘.** 하나라도 빠지면 이 검사는 아무것도 안 지킨다 —
   * 걸린 줄이 0개면 `for` 가 한 바퀴도 안 돌고, 이름을 못 읽으면 그 줄만 조용히 빠진다.
   */
  assert.ok(rows.length >= 6,
    `PLAYTEST 에서 끌기 지시를 ${rows.length}줄만 읽었습니다 — 표 모양이 바뀌었다면`
    + ' 이 검사가 아무것도 지키지 않습니다');
  for (const r of rows) {
    assert.ok(r.from && r.to,
      `PLAYTEST 의 「${r.raw}」에서 실험대에 없는 이름이 있습니다`
      + ' — 문서가 없는 물건을 시키고 있거나, 이 검사가 이름을 못 읽고 있습니다');
  }

  for (const r of rows) {
    const accepts = dropTable({ dispatch() {}, getState() { return {}; } })[kindOf[r.from]] ?? {};
    assert.ok(accepts[kindOf[r.to]],
      `PLAYTEST 가 「${r.raw}」를 시키는데 앱은 그 자리를 받지 않습니다`
      + ' — 선생님이 그대로 하시면 아무 일도 안 일어나고 버그로 적어 보내십니다');
  }
});
