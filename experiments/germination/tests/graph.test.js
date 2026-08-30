/**
 * 결과 그래프 테스트.
 *
 * 그래프는 이 실험의 **보조** 화면이다 — 몸통은 챔버 그림이다. 그래도 있어야 하는 이유는
 * 하나뿐이라, 여기서 볼 것도 그 하나다: **언제 무엇이 꺾였는지 읽히는가.**
 * 그리고 「예쁜가」가 아니라 **어긋난 것을 이름과 값으로 말하는가.**
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderGraph, resultNotes, co2Max, tempMax, GRAPH } from '../src/render/graph.js';
import { initialState, chamberViews, comparisonKind, mismatches } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { ATMOSPHERIC_CO2_PPM, ROOM_TEMP_C, OBSERVE_LIMIT_MIN } from '../src/sim/metabolism.js';
import { UI } from '../src/ui/strings.js';

const scoop = (kind, chamber) => [['SCOOP_BEANS', { kind }], ['POUR_BEANS', { chamber }]];
const ticks = (n) => Array.from({ length: n }, () => ['TICK', { minutes: 1 }]);

function play(script, seed = 4242) {
  let s = initialState(1, seed);
  for (const [type, payload] of script) s = reduce(s, { type, payload: payload ?? {} }).state;
  return s;
}

/** 제대로 꾸민 두 챔버 — 여기서 하나씩 어긋뜨린다. */
function standard({ extraR = 0, mid = [], minutes = OBSERVE_LIMIT_MIN } = {}) {
  return play([
    ...scoop('sprout', 'L'), ...scoop('sprout', 'L'),
    ...scoop('dry', 'R'), ...scoop('dry', 'R'),
    ...Array.from({ length: extraR }, () => scoop('dry', 'R')).flat(),
    ['POUR_BTB', { chamber: 'L' }], ['POUR_BTB', { chamber: 'R' }],
    ['INSTALL_SENSOR', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'R' }],
    ['SEAL', { chamber: 'L' }], ['SEAL', { chamber: 'R' }],
    ['START', { chamber: 'L' }], ['START', { chamber: 'R' }],
    ...ticks(Math.floor(minutes / 2)), ...mid, ...ticks(Math.ceil(minutes / 2)),
  ]);
}

const viewsOf = (st) => { const v = chamberViews(st); return [v.L, v.R]; };
const notesOf = (st) => resultNotes(chamberViews(st), comparisonKind(st), mismatches(st)).join(' ');

/* ---------------- 두 챔버를 갈라 놓는가 ---------------- */

test('두 챔버를 색만으로 가르지 않는다 — 선 모양이 다르다', () => {
  // 색각 이상이 있어도, 흑백으로 인쇄해도 갈려야 한다.
  const svg = renderGraph(viewsOf(standard()));
  const left = svg.match(/id="g-co2-L"[^>]*/)[0];
  const right = svg.match(/id="g-co2-R"[^>]*/)[0];
  assert.ok(!left.includes('stroke-dasharray'), '왼쪽이 실선이 아닙니다');
  assert.ok(right.includes('stroke-dasharray'), '오른쪽이 점선이 아닙니다');
});

test('범례 대신 선 끝에 이름이 직접 붙는다', () => {
  // 범례와 선을 눈으로 잇는 일을 없앤다.
  const svg = renderGraph(viewsOf(standard()));
  for (const id of ['L', 'R']) {
    assert.ok(svg.includes(`id="g-co2-end-${id}"`), `${id} 의 이름표가 CO₂ 칸에 없습니다`);
    assert.ok(svg.includes(`id="g-temp-end-${id}"`), `${id} 의 이름표가 온도 칸에 없습니다`);
  }
  assert.ok(svg.includes(UI.chambers.L.short) && svg.includes(UI.chambers.R.short));
});

test('두 이름표가 겹치면 아래쪽 것이 내려간다', () => {
  // 겹치면 둘 다 못 읽는다. 마른 콩 쪽 선은 늘 대기 농도 가까이에 있어 자주 겹친다.
  const svg = renderGraph(viewsOf(standard({ minutes: 2 })));
  const y = (id) => Number(svg.match(new RegExp(`id="g-co2-end-${id}"[\\s\\S]*?y="([\\d.]+)"`))[1]);
  assert.ok(Math.abs(y('L') - y('R')) >= 13, '두 이름표가 겹쳐 있습니다');
});

/* ---------------- 그림과 그래프를 잇는가 ---------------- */

test('BTB 색이 갈리는 자리가 CO₂ 칸에 표시된다', () => {
  // 이것이 없으면 「BTB 가 노래졌다」와 「곡선이 여기까지 올라갔다」가
  // 같은 이야기인 줄 모른다. 그림과 그래프를 잇는 유일한 선이다.
  const svg = renderGraph(viewsOf(standard()));
  assert.ok(svg.includes(UI.graph.btbGreen), 'BTB 녹색 자리가 없습니다');
  assert.ok(svg.includes(UI.graph.btbYellow), 'BTB 노랑 자리가 없습니다');
});

test('대기 농도 기준선이 있다 — 챔버는 0 에서 출발하지 않는다', () => {
  assert.ok(renderGraph(viewsOf(standard())).includes(UI.graph.airLabel));
});

test('CO₂ 와 온도를 한 칸에 겹쳐 그리지 않는다', () => {
  // 한 칸에 두 단위를 겹치면 학생이 어느 눈금을 읽는지 알 수 없다.
  const svg = renderGraph(viewsOf(standard()));
  assert.ok(svg.includes('id="g-co2-grid"') && svg.includes('id="g-temp-grid"'));
  const co2Y = Number(svg.match(/id="g-co2-L" d="M [\d.]+,([\d.]+)/)[1]);
  const tempY = Number(svg.match(/id="g-temp-L" d="M [\d.]+,([\d.]+)/)[1]);
  assert.ok(tempY > co2Y, '온도 칸이 CO₂ 칸 아래에 있어야 합니다');
});

/* ---------------- 축이 데이터를 따라가는가 ---------------- */

test('세로축이 잰 값에 맞춰지고 눈금이 읽을 수 있는 수로 올림된다', () => {
  const short = viewsOf(standard({ minutes: 4 }));
  const long = viewsOf(standard());
  assert.ok(co2Max(short) < co2Max(long), '많이 잴수록 축이 자라야 합니다');
  assert.ok(Number.isInteger(co2Max(long)), '눈금이 읽을 수 있는 수여야 합니다');
});

test('아무것도 안 쟀을 때도 축이 무너지지 않는다', () => {
  const empty = viewsOf(initialState(1));
  assert.ok(co2Max(empty) > ATMOSPHERIC_CO2_PPM);
  assert.ok(tempMax(empty) > ROOM_TEMP_C);
  const svg = renderGraph(empty);
  assert.ok(svg.includes('data-points="0"'), '안 쟀다고 그래프를 안 그리면 안 됩니다');
});

/* ---------------- 어긋난 것을 이름과 값으로 말하는가 ---------------- */

test('어긋난 통제변인을 이름과 두 값으로 말한다', () => {
  // 「통제변인이 다릅니다」로는 무엇을 고쳐야 할지 알 수 없다.
  const notes = notesOf(standard({ extraR: 1 }));
  assert.ok(notes.includes(UI.controls.scoops), `어긋난 조건의 이름이 없습니다: ${notes}`);
  assert.ok(notes.includes(UI.graph.values.scoops(2)) && notes.includes(UI.graph.values.scoops(3)),
    `두 챔버의 값이 안 적혀 있습니다: ${notes}`);
});

test('재는 도중에 뚜껑을 열면 밀봉이 어긋났다고 말한다', () => {
  const notes = notesOf(standard({ mid: [['OPEN_LID', { chamber: 'L' }]] }));
  assert.ok(notes.includes(UI.controls.sealed), notes);
  assert.ok(notes.includes(UI.graph.values.open), notes);
});

test('한쪽 센서만 콩에 파묻히면 센서 위치가 어긋났다고 말한다', () => {
  const notes = notesOf(standard({ mid: [['SET_SENSOR_DEPTH', { chamber: 'L', depth: 1 }]] }));
  assert.ok(notes.includes(UI.controls.sensor), notes);
  assert.ok(notes.includes(UI.graph.values.sensor.buried), notes);
});

test('두 챔버에 같은 콩을 넣으면 견줄 것이 없다고 말한다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('sprout', 'R')]);
  assert.ok(notesOf(st).includes(UI.beans.sprout));
});

test('콩을 섞으면 어느 챔버가 섞였는지 이름으로 말한다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('dry', 'L'), ...scoop('dry', 'R')]);
  const notes = notesOf(st);
  assert.ok(notes.includes(UI.chambers.L.short), notes);
  assert.ok(notes.includes('개수대'), `되돌아갈 길이 문장에 없습니다: ${notes}`);
});

test('아직 콩을 안 넣었으면 나무라지 않고 무엇을 하면 되는지 말한다', () => {
  const notes = resultNotes(chamberViews(initialState(1)), 'empty', []);
  assert.deepEqual(notes, [UI.graph.notes.empty]);
});

test('제대로 꾸미면 「콩의 상태 때문이라고 말할 수 있다」고 말해 준다', () => {
  const notes = notesOf(standard());
  assert.ok(notes.includes('콩의 상태'), notes);
  assert.ok(!notes.includes('가릴 수 없습니다'), `어긋난 것이 없는데 나무랍니다: ${notes}`);
});

test('한쪽만 오래 재면 그것도 말해 준다', () => {
  const st = play([
    ...scoop('sprout', 'L'), ...scoop('dry', 'R'),
    ['POUR_BTB', { chamber: 'L' }], ['POUR_BTB', { chamber: 'R' }],
    ['INSTALL_SENSOR', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'R' }],
    ['SEAL', { chamber: 'L' }], ['SEAL', { chamber: 'R' }],
    ['START', { chamber: 'L' }], ...ticks(10),
  ]);
  assert.ok(notesOf(st).includes('잰 시간이 다릅니다'), notesOf(st));
});

test('설명 문구에 「이(가)」 같은 괄호가 없다', () => {
  // 괄호를 치면 학생이 읽다가 걸린다. josa() 가 받침을 보고 고른다.
  for (const st of [standard({ extraR: 1 }), standard({ mid: [['OPEN_LID', { chamber: 'L' }]] })]) {
    assert.ok(!/이\(가\)|을\(를\)|은\(는\)/.test(notesOf(st)), notesOf(st));
  }
});

/* ---------------- 순수 함수인가 ---------------- */

test('같은 상태면 같은 그림이 나온다', () => {
  const v = viewsOf(standard());
  assert.equal(renderGraph(v), renderGraph([...v]));
});

test('idPrefix 가 다르면 id 가 하나도 겹치지 않는다', () => {
  const idsOf = (svg) => svg.match(/id="[^"]+"/g) ?? [];
  const v = viewsOf(standard());
  const a = renderGraph(v, { idPrefix: 'left' });
  const b = renderGraph(v, { idPrefix: 'right' });
  assert.deepEqual(idsOf(a).filter((x) => idsOf(b).includes(x)), []);
});

test('난수와 시계를 쓰지 않는다', () => {
  const code = readFileSync(new URL('../src/render/graph.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!code.includes('Math.random') && !code.includes('Date.now'));
});

test('그래프 자리가 통째로 화면 밖으로 나가지 않는다', () => {
  const svg = renderGraph(viewsOf(standard()));
  for (const [, x, y] of svg.matchAll(/<path[^>]*d="M ([\d.]+),([\d.]+)/g)) {
    assert.ok(Number(x) >= 0 && Number(x) <= GRAPH.w, `x=${x} 가 그림 밖입니다`);
    assert.ok(Number(y) >= 0 && Number(y) <= GRAPH.h, `y=${y} 가 그림 밖입니다`);
  }
});

/**
 * **탐구 노트가 예시로 내미는 답에, 학생이 화면에서 닿을 수 있는가.**
 *
 * 「마른 콩도 아주 조금은 숨을 쉰다는 것을 알았다」가 예시 답으로 적혀 있다.
 * 그런데 마른 콩 쪽에서 화면이 보여 주는 것은 이렇다:
 *   BTB   파랑 그대로 (540 ppm < 녹색 문턱 700)
 *   온도   +0.1 ℃ — 기둥이 안 움직인다
 *   그래프 축이 발아 콩(2800)에 맞춰져 **판 높이의 4.6 %** 만 오른다
 * 그러니 값을 글로 적어 주지 않으면 **닿을 수 없는 답을 예시로 내미는 것**이 된다.
 * (사장님 — 「진짜 알 수 있어? 우리 가상 실험실에서???? 나 못본거 같은데」)
 *
 * 예시 답은 **학생이 쓸 말을 미리 정해 주는 자리**다. 거기 적힌 것이 화면에서 확인
 * 불가능하면, 학생은 보지도 않은 것을 베껴 쓰게 된다 — 이 실험이 가르치려는 것의 반대다.
 */
test('마른 콩 쪽 변화가 글로 적혀 나온다 — 예시 답에 닿을 수 있어야 한다', () => {
  let st = initialState(1);
  const d = (type, payload) => { st = reduce(st, { type, payload }).state; };
  for (const [kind, chamber] of [['sprout', 'L'], ['sprout', 'L'], ['dry', 'R'], ['dry', 'R']]) {
    d('SCOOP_BEANS', { kind }); d('POUR_BEANS', { chamber });
  }
  for (const c of ['L', 'R']) {
    d('POUR_BTB', { chamber: c }); d('INSTALL_SENSOR', { chamber: c });
    d('SEAL', { chamber: c }); d('START', { chamber: c });
  }
  while (st.chambers.L.elapsedMin < OBSERVE_LIMIT_MIN) d('TICK', { minutes: 1 });
  const views = chamberViews(st);

  // [앞 조건] 마른 쪽이 실제로 공기보다 높아야 이 말이 뜻을 갖는다.
  const dry = Math.round(views.R.co2Ppm);
  assert.ok(dry > ATMOSPHERIC_CO2_PPM,
    `마른 콩 쪽이 ${dry} ppm 으로 공기(${ATMOSPHERIC_CO2_PPM})보다 높지 않습니다 — 예시 답이 사실이 아닙니다`);

  // [앞 조건] 그림만으로는 안 보인다는 것을 여기 적어 둔다. 보이게 되면 이 검사를 다시 보라.
  assert.equal(views.R.btbStage, 'blue',
    '마른 콩 쪽 BTB 색이 바뀝니다 — 그러면 눈으로도 보이니 아래 요구를 다시 생각하세요');

  const notes = resultNotes(views, comparisonKind(st), mismatches(st));
  const line = notes.find((t) => t.includes(String(dry)) && t.includes(String(ATMOSPHERIC_CO2_PPM)));
  assert.ok(line, [
    '결과 정리가 마른 콩 쪽 값을 공기와 나란히 말해 주지 않습니다.',
    `  마른 콩 ${dry} ppm · 공기 ${ATMOSPHERIC_CO2_PPM} ppm — 이 둘이 함께 적혀야 견줄 수 있습니다.`,
    `  지금 적힌 것: ${notes.map((t) => t.slice(0, 30)).join(' / ')}`,
    '  ★ 값을 안 적을 거면 탐구 노트의 예시 답(「마른 콩도 아주 조금은 숨을 쉰다」)도 함께 지우세요 —',
    '    화면에서 못 보는 것을 예시로 내밀면 학생이 보지도 않은 것을 베껴 씁니다.',
  ].join('\n'));
});
