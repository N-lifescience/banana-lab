/**
 * 챔버 그림 테스트 — **이 실험의 몸통.**
 *
 * 여기서 볼 것은 「예쁜가」가 아니라 셋이다.
 *   1. **갈려야 하는 상태가 실제로 다른 그림을 낸다** (린터는 색과 두께만 본다)
 *   2. **눈으로 아는 것과 센서로 아는 것이 갈려 있다** — 센서가 없어도 BTB 색은 나온다
 *   3. 순수 함수다 — 같은 뷰면 같은 HTML, `idPrefix` 로 여러 개를 그려도 id 가 안 겹친다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderChamberCard, renderComparison, chamberAssetState, tempFillOf, TEMP_SPAN_C,
  INSIDE_TOP, INSIDE_BOTTOM,
} from '../src/render/chamber.js';
import { initialState, chamberView, chamberViews, SENSOR } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { ROOM_TEMP_C, ATMOSPHERIC_CO2_PPM } from '../src/sim/metabolism.js';
import { UI } from '../src/ui/strings.js';
import { thermoGeometry } from '../src/assets/chamber.js';

const scoop = (kind, chamber) => [['SCOOP_BEANS', { kind }], ['POUR_BEANS', { chamber }]];

function play(script, seed = 4242) {
  let s = initialState(1, seed);
  for (const [type, payload] of script) s = reduce(s, { type, payload: payload ?? {} }).state;
  return s;
}

const viewOf = (st, id = 'L') => chamberView(st.chambers[id]);

/** 뷰를 손으로 짓는다 — 규칙을 거치지 않고 그림만 볼 때 쓴다. */
const fake = (over = {}) => ({
  id: 'L', beans: 'sprout', scoops: 2, mixed: false, btb: true, beanLevel: 0.33,
  sensor: SENSOR.CLEAR, sensorDepth: 0.35, sensorFouled: false, sealed: false,
  running: false, finished: false, elapsedMin: 0,
  co2Ppm: ATMOSPHERIC_CO2_PPM, tempC: ROOM_TEMP_C, btbStage: 'blue',
  reading: { co2Ppm: ATMOSPHERIC_CO2_PPM, tempC: ROOM_TEMP_C }, samples: [], seed: 5, ...over,
});

/* ---------------- 갈려야 하는 것이 갈리는가 ---------------- */

test('갈려야 하는 상태끼리 실제로 다른 그림이 나온다', () => {
  const pairs = [
    ['발아 콩 / 마른 콩', {}, { beans: 'dry' }],
    ['BTB 파랑 / 노랑', {}, { btbStage: 'yellow' }],
    ['BTB 넣음 / 안 넣음', {}, { btbStage: null, btb: false }],
    ['밀봉 / 열림', { sealed: true }, { sealed: false }],
    ['센서 있음 / 없음', {}, { sensor: SENSOR.NONE, sensorDepth: null }],
    ['센서 닿음 / 안 닿음', {}, { sensor: SENSOR.BURIED, sensorDepth: 0.9 }],
    ['한 숟갈 / 네 숟갈', { scoops: 1 }, { scoops: 4 }],
    ['온도 낮음 / 높음', {}, { tempC: ROOM_TEMP_C + 2 }],
  ];
  for (const [what, a, b] of pairs) {
    assert.notEqual(renderChamberCard(fake(a)), renderChamberCard(fake(b)),
      `${what} 이 그림에서 갈리지 않습니다`);
  }
});

/**
 * **밀봉을 잊는 것이 이 실험에서 가장 흔한 실수**이고, 밀봉은 통제변인이다.
 * 그림이 그것을 숨기면 결과가 대신 답할 수 없다.
 *
 * 애셋이 한동안 「센서를 넣었으면 뚜껑은 덮은 것」으로 짐작하고 있어서, 센서를 꽂고
 * 밀봉을 잊은 챔버가 밀봉한 챔버와 거의 같아 보였다. 하네스에서 눈으로 잡았다.
 */
test('센서를 꽂고 밀봉을 잊은 챔버가 밀봉한 챔버와 다르게 보인다', () => {
  const open = renderChamberCard(fake({ sealed: false, sensor: SENSOR.CLEAR }));
  const sealed = renderChamberCard(fake({ sealed: true, sensor: SENSOR.CLEAR }));
  assert.notEqual(open, sealed);
  // 뚜껑이 실제로 기울어야 한다 — 가느다란 밀봉 테 하나로는 교실 프로젝터에서 안 보인다.
  // id 에 앞가지가 붙으므로(`prefixIds`) 끝만 맞춰 본다.
  assert.match(open, /id="[\w-]*-?lid"[^>]*transform=/, '뚜껑이 열려도 그대로 있습니다');
  assert.doesNotMatch(sealed, /id="[\w-]*-?lid"[^>]*transform=/);
});

/* ---------------- 눈으로 아는 것과 센서로 아는 것 ---------------- */

test('센서가 없어도 BTB 색과 온도계는 나온다 — CO₂ 만 알 수 없다', () => {
  const html = renderChamberCard(fake({ sensor: SENSOR.NONE, sensorDepth: null, btbStage: 'yellow' }));
  assert.ok(html.includes(UI.chamber.btbStages.yellow), 'BTB 색이 센서 때문에 사라졌습니다');
  assert.ok(html.includes(UI.chamber.noSensorValue), 'CO₂ 를 센서 없이 아는 것처럼 적혀 있습니다');
});

test('읽을 값마다 눈으로 아는 것인지 센서로 아는 것인지 적혀 있다', () => {
  // 이 경계가 「센서는 재는 도구이지 일어나는 일이 아니다」를 화면에서 말해 준다.
  const html = renderChamberCard(fake());
  assert.ok(html.includes(UI.chamber.byEye) && html.includes(UI.chamber.bySensor));
  assert.match(html, /data-how="sensor"[\s\S]*?이산화 탄소/);
});

test('BTB 색을 글자로도 적는다 — 색만으로 가르지 않는다', () => {
  for (const [stage, name] of Object.entries(UI.chamber.btbStages)) {
    assert.ok(renderChamberCard(fake({ btbStage: stage })).includes(name),
      `${stage} 의 이름이 글자로 안 적혀 있습니다`);
  }
});

test('CO₂ 값은 센서가 읽은 값을 쓴다 — 챔버 안의 진짜 값이 아니다', () => {
  // 파묻힌 센서는 챔버가 아니라 콩 더미를 잰다. 화면이 진짜 값을 보여 주면
  // 「센서를 콩에 닿지 않게」의 이유가 사라진다.
  const html = renderChamberCard(fake({
    sensor: SENSOR.BURIED, co2Ppm: 900, reading: { co2Ppm: 1400, tempC: 21 },
  }));
  assert.ok(html.includes(UI.units.ppm(1400)), '센서가 읽은 값이 아닙니다');
  assert.ok(!html.includes(UI.units.ppm(900)), '챔버 안의 진짜 값을 보여 주고 있습니다');
});

/* ---------------- 온도계 눈금 ---------------- */

/**
 * 여기서 보는 것은 **신호**다 — 실온 위로 얼마나 올라갔는가(0~1).
 * **그림에서 기둥이 어디에 서는가는 다른 문제다** — 신호가 0 이어도 기둥은 서 있어야 한다.
 * 그쪽은 아래 「온도계 기둥은 실온에서도 서 있다」가 본다. 이름이 비슷해 덮인 줄 알기 쉽다.
 */
test('온도계는 실온부터 잰다 — 0 ℃ 부터 그리면 차이가 뭉개진다', () => {
  // 이 실험에서 견주는 것은 1~2 ℃ 차이다. 0 부터 그리면 눈금 하나 안에 들어간다.
  assert.equal(tempFillOf(fake({ tempC: ROOM_TEMP_C })), 0);
  assert.ok(tempFillOf(fake({ tempC: ROOM_TEMP_C + 1.5 })) > 0.4, '1.5 ℃ 차이가 안 보입니다');
  assert.equal(tempFillOf(fake({ tempC: ROOM_TEMP_C + TEMP_SPAN_C * 2 })), 1, '꼭대기를 넘지 않아야 합니다');
});

/* ---------------- 센서 손잡이 ---------------- */

test('센서 손잡이는 확대 뷰에서만 나온다', () => {
  // 실험대의 작은 그림에서는 손가락보다 작아 잡히지 않는다.
  assert.ok(!renderChamberCard(fake()).includes('sensor-handle'));
  assert.ok(renderChamberCard(fake(), { big: true }).includes('sensor-handle'));
});

test('센서가 없으면 손잡이도 없다', () => {
  assert.ok(!renderChamberCard(fake({ sensor: SENSOR.NONE, sensorDepth: null }), { big: true })
    .includes('sensor-handle'));
});

test('손잡이 자리가 깊이를 따라간다', () => {
  const topOf = (d) => Number(renderChamberCard(fake({ sensorDepth: d }), { big: true })
    .match(/class="sensor-handle"[\s\S]*?top:([\d.]+)%/)[1]);
  assert.ok(topOf(0.9) > topOf(0.1), '깊이를 바꿔도 손잡이가 안 움직입니다');
  assert.ok(topOf(0) >= INSIDE_TOP * 100 - 0.1 && topOf(1) <= INSIDE_BOTTOM * 100 + 0.1,
    '손잡이가 챔버 속을 벗어납니다');
});

test('손잡이가 키보드로도 읽히고 움직일 수 있게 돼 있다', () => {
  // 이 실험에서 손끝이 정하는 유일한 값이라, 키보드 경로가 없으면
  // 마우스를 못 쓰는 학생은 이 실험을 아예 할 수 없다.
  const html = renderChamberCard(fake(), { big: true });
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuenow="\d+"/);
  assert.ok(html.includes(UI.chamber.depthLabel));
});

/* ---------------- 실제 규칙을 거친 상태 ---------------- */

test('규칙을 거쳐 만든 챔버가 그대로 그려진다', () => {
  const st = play([
    ...scoop('sprout', 'L'), ...scoop('sprout', 'L'),
    ['POUR_BTB', { chamber: 'L' }], ['INSTALL_SENSOR', { chamber: 'L' }],
    ['SEAL', { chamber: 'L' }], ['START', { chamber: 'L' }],
    ...Array.from({ length: 30 }, () => ['TICK', { minutes: 1 }]),
  ]);
  const html = renderChamberCard(viewOf(st));
  assert.ok(html.includes(UI.chamber.btbStages.yellow), 'BTB 가 노래지지 않았습니다');
  assert.ok(html.includes(UI.beans.sprout) && html.includes(UI.units.scoops(2)));
});

test('콩을 섞은 챔버는 무엇이 들었는지 말할 수 없다고 적는다', () => {
  const st = play([...scoop('sprout', 'L'), ...scoop('dry', 'L')]);
  assert.ok(renderChamberCard(viewOf(st)).includes(UI.chamber.beansMixed));
});

test('아직 아무것도 안 넣은 챔버도 그려진다', () => {
  const html = renderChamberCard(viewOf(initialState(1)));
  assert.ok(html.includes(UI.chamber.beansNone));
  assert.ok(html.includes(UI.chamber.notStarted));
});

/* ---------------- 두 챔버를 나란히 ---------------- */

test('두 챔버가 한 칸에 나란히 놓인다', () => {
  // 견주는 것이 이 실험의 전부라, 한 화면에 함께 있어야 한다.
  const html = renderComparison(chamberViews(initialState(1)));
  assert.ok(html.includes('data-chamber="L"') && html.includes('data-chamber="R"'));
  assert.ok(html.includes(UI.chambers.L.name) && html.includes(UI.chambers.R.name));
});

/* ---------------- 순수 함수인가 ---------------- */

test('같은 뷰면 같은 HTML 이 나온다', () => {
  assert.equal(renderChamberCard(fake()), renderChamberCard(fake()));
});

/**
 * 이 실험은 챔버를 **한 화면에 둘** 그린다. 애셋 안의 고정 id 를 그대로 두면
 * 문서에 같은 id 가 두 벌 생기고, `document.querySelector('#lid')` 는
 * **언제나 왼쪽 것만** 집는다 — 에러 없이 조용히 틀린다.
 */
test('idPrefix 가 다르면 id 가 하나도 겹치지 않는다 — 애셋 안까지', () => {
  const idsOf = (h) => h.match(/id="[^"]+"/g) ?? [];
  const a = renderChamberCard(fake(), { idPrefix: 'left', big: true });
  const b = renderChamberCard(fake(), { idPrefix: 'right', big: true });
  assert.ok(idsOf(a).length > 5, '검사할 id 가 너무 적습니다');
  assert.deepEqual(idsOf(a).filter((x) => idsOf(b).includes(x)), [],
    '카드가 만드는 id 가 겹칩니다 — 한 화면에 여러 개를 그리면 조용히 틀립니다');
});

test('두 챔버를 나란히 그려도 같은 id 가 두 번 나오지 않는다', () => {
  const html = renderComparison(chamberViews(initialState(1)));
  const ids = (html.match(/id="([^"]+)"/g) ?? []).map((x) => x.slice(4, -1));
  assert.equal(new Set(ids).size, ids.length,
    `id 가 겹칩니다: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')}`);
});

test('학생이 쓴 글이 아니어도 값은 이스케이프된다', () => {
  // 뷰의 문자열이 그대로 HTML 로 들어가면, 상태를 하나 늘릴 때 구멍이 생긴다.
  const html = renderChamberCard(fake({ beans: '<img src=x>' }));
  assert.ok(!html.includes('<img src=x>'));
});

test('난수와 시계를 쓰지 않는다', () => {
  const code = readFileSync(new URL('../src/render/chamber.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!code.includes('Math.random') && !code.includes('Date.now'));
});

test('그림에 넘기는 상태는 chamberAssetState 하나만 거친다', () => {
  // 실험대 토큰도 확대 뷰도 보고서도 여기를 거친다. 세 곳에서 따로 만들면
  // 상태를 하나 더할 때 어긋난다.
  const st = chamberAssetState(fake({ tempC: ROOM_TEMP_C + 1.5 }));
  assert.deepEqual(Object.keys(st).sort(),
    ['beans', 'btbStage', 'scoops', 'sealed', 'seed', 'sensor', 'sensorDepth', 'tempFill'].sort());
  assert.ok(st.tempFill > 0.4);
});

/**
 * **실온에서 온도계가 비어 있으면 0 ℃ 로 읽힌다.**
 *
 * 앞서는 「올라간 만큼」만 기둥으로 그려서 `tempFill = 0` 이면 높이가 **0** 이었다.
 * 시작 상태의 챔버를 열면 온도계가 텅 비어 있고, 보는 사람은 20 ℃ 가 아니라 0 ℃ 로 읽는다.
 * (사장님이 플레이하다 찾으셨다 — 「높이가 하나도 없네. 0도인것 같잖아」)
 *
 * 값이 0 이라 아무것도 안 보이는 것 — 검사가 웃기 어려운 자리다. 그림이 없어도
 * 에러가 안 나고, 「없음」과 「0」이 화면에서 똑같이 생겼다. 그래서 **쉬는 높이**를 못 박는다.
 */
test('온도계 기둥은 실온에서도 서 있다 — 빈 관은 0 ℃ 로 읽힌다', () => {
  const rest = thermoGeometry({ tempFill: 0 });
  const full = thermoGeometry({ tempFill: 1 });
  const restH = Number(rest.height);

  assert.ok(restH > 20,
    `실온(tempFill 0)에서 기둥 높이가 ${restH} 입니다 — 비어 보이면 0 ℃ 로 읽힙니다`);

  // 그래도 **견주는 일**은 그대로여야 한다. 쉬는 높이가 꼭대기를 다 먹으면 차이가 안 보인다.
  const span = Number(full.height) - restH;
  assert.ok(span > restH,
    `올라갈 칸이 ${span.toFixed(1)}, 쉬는 높이가 ${restH} 입니다 — 두 챔버 차이가 안 보입니다`);

  // 작은 차이가 눈에 보이는가. 이 실험의 30분 온도차는 1.6 ℃ 남짓이다.
  const small = Number(thermoGeometry({ tempFill: 0.3 }).height);
  assert.ok(small - restH > 10,
    `조금 올라간 것(tempFill 0.3)이 ${(small - restH).toFixed(1)} 밖에 안 움직입니다`);
});

/**
 * **단추 이름은 여섯 군데에 적혀 있다.**
 *
 * 화면(`UI.zoom.record`) 하나가 출처인데, 안내문·탐구 노트의 예시·방침·플레이 문서가
 * 그 이름을 **손으로** 적는다. 이름을 고치는 사람은 자기가 연 파일만 보므로,
 * 나머지가 옛 이름으로 남아 **없는 단추를 누르라고** 말하게 된다.
 * (실제로 「지금 결과 기록」에서 「두 챔버 결과 기록」으로 고치며 다섯 곳이 낡을 뻔했다)
 *
 * 방침(`privacy.html`)이 특히 그렇다 — 무엇을 언제 보내는지 적는 문서라
 * 없는 단추 이름이 적혀 있으면 **읽는 사람이 그 항목을 못 찾는다.**
 */
test('결과 기록 단추 이름이 적힌 곳이 화면과 같다', () => {
  const label = UI.zoom.record;
  assert.ok(label && label.length > 3, '결과 기록 단추 이름을 못 찾았습니다');

  // 방침은 **사이트 것**이라 뿌리에 있다 (실험이 여덟이어도 하나다).
  const root = new URL('../', import.meta.url);
  const SITE = new URL('../../../', import.meta.url);
  const where = [['privacy.html', SITE], ['PLAYTEST.md', root], ['src/ui/strings.js', root]];
  const stale = [];
  let found = 0;
  for (const [f, base] of where) {
    const text = readFileSync(new URL(f, base), 'utf8');
    // 화면에 낼 이름 그 자체(`record:` 정의)는 세지 않는다 — 그것이 출처다.
    const body = text.replace(/record: '[^']*'/, '');
    for (const [, quoted] of body.matchAll(/「([^」]*결과 기록[^」]*)」/g)) {
      found += 1;
      const plain = quoted.replace(/\*/g, '').trim();   // 마크다운 굵게 표시를 벗긴다
      if (plain !== label) stale.push(`${f}  「${quoted}」`);
    }
  }
  // [앞 조건] 인용을 하나도 못 찾으면 「0곳 중 0곳이 맞다」로 통과한다.
  assert.ok(found >= 3, `단추 이름을 인용한 자리를 ${found}곳밖에 못 찾았습니다 — 찾는 방법이 죽었는지 보세요`);
  assert.deepEqual(stale, [], [
    `화면의 단추는 「${label}」인데 다른 이름으로 적힌 곳이 있습니다 — 없는 단추를 누르라고 말합니다.`,
    ...stale.map((x) => `  ${x}`),
    `  ★ 먼저 **어느 쪽이 맞는지** 보세요. 단추 이름을 바꾼 것이 맞다면 위 자리를 「${label}」로 고치세요.`,
  ].join('\n'));
});
