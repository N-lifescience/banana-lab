/**
 * 대사 모형 테스트.
 *
 * 여기서 볼 것은 「숫자가 맞는가」가 아니다 — `[모형]` 계수는 실측값이 아니다.
 * 볼 것은 **AGENTS.md §2.5 의 과학적 사실이 실제로 나오는가** 다:
 *
 *   발아 콩 > 마른 콩 · 마른 콩은 0 이 아니되 색이 안 바뀔 만큼 작다 ·
 *   밀봉을 안 하면 낮은 값에서 평평해진다 · BTB 는 파랑 → 녹색 → 노랑
 *
 * 계수를 「보기 좋게」 바꾸다 이 성질이 깨지면 여기서 잡힌다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import {
  ATMOSPHERIC_CO2_PPM, ROOM_TEMP_C, OBSERVE_LIMIT_MIN,
  BTB_GREEN_PPM, BTB_YELLOW_PPM, DRY_ACTIVITY_RATIO,
  co2Rate, co2Rise, tempRise, trueState, sensorReading, btbStage, jitter, advance,
} from '../src/sim/metabolism.js';

const cond = (over = {}) => ({ beans: 'sprout', scoops: 2, sealed: true, sensor: 'clear', seed: 7, lane: 1, ...over });
const LIMIT = OBSERVE_LIMIT_MIN;

/* ---------------- 과학적 사실이 나오는가 ---------------- */

test('아무것도 안 넣은 챔버는 대기 농도와 실온에 그대로 있다', () => {
  // 빈 챔버를 밀봉하고 재는 것은 막지 않는다. 아무 일도 안 일어나는 것이 답이다.
  const t = trueState(cond({ beans: null, scoops: 0 }), LIMIT);
  assert.equal(t.co2Ppm, ATMOSPHERIC_CO2_PPM);
  assert.equal(t.tempC, ROOM_TEMP_C);
});

test('발아 콩 쪽이 마른 콩 쪽보다 CO₂ 도 온도도 크게 오른다', () => {
  const s = trueState(cond(), LIMIT);
  const d = trueState(cond({ beans: 'dry' }), LIMIT);
  assert.ok(s.co2Ppm > d.co2Ppm * 3, `발아 ${s.co2Ppm.toFixed(0)} vs 마른 ${d.co2Ppm.toFixed(0)} — 차이가 너무 작습니다`);
  assert.ok(s.tempC > d.tempC, '발아 콩 쪽 온도가 더 높아야 합니다');
});

test('마른 콩도 0 은 아니다 — 살아 있는 씨앗이다', () => {
  // 0 으로 두면 「마른 콩은 죽었다」가 학생이 얻는 결론이 되는데 그건 틀렸다.
  assert.ok(DRY_ACTIVITY_RATIO > 0, '마른 콩의 대사를 0 으로 두면 안 됩니다');
  assert.ok(co2Rise(cond({ beans: 'dry' }), LIMIT) > 0);
});

test('관찰 시간 안에 마른 콩 쪽 BTB 는 파랑에 남는다', () => {
  // 마른 콩 쪽에서도 색이 바뀌면 대조 실험이 성립하지 않는다 (AGENTS.md §2.5).
  const d = trueState(cond({ beans: 'dry' }), LIMIT);
  assert.equal(btbStage(d.co2Ppm), 'blue', `마른 콩 쪽이 ${d.co2Ppm.toFixed(0)} ppm 까지 올랐습니다`);
});

test('관찰 시간 안에 발아 콩 쪽 BTB 는 노랑까지 간다', () => {
  const s = trueState(cond(), LIMIT);
  assert.equal(btbStage(s.co2Ppm), 'yellow', `발아 콩 쪽이 ${s.co2Ppm.toFixed(0)} ppm 밖에 안 올랐습니다`);
});

test('BTB 는 파랑 → 녹색 → 노랑 순서로만 간다', () => {
  // 방향을 뒤집으면 틀린 것이다 (AGENTS.md §2.5).
  assert.equal(btbStage(ATMOSPHERIC_CO2_PPM), 'blue');
  assert.equal(btbStage(BTB_GREEN_PPM), 'green');
  assert.equal(btbStage(BTB_YELLOW_PPM), 'yellow');
  assert.ok(BTB_GREEN_PPM > ATMOSPHERIC_CO2_PPM, '대기 농도에서 이미 녹색이면 안 됩니다');
  assert.ok(BTB_YELLOW_PPM > BTB_GREEN_PPM);
});

test('밀봉하지 않으면 변화가 약하게 새고 낮은 값에서 평평해진다', () => {
  // 「변화가 약하게 샌다」이지 「아무 일도 없다」가 아니다.
  const open = trueState(cond({ sealed: false }), LIMIT);
  const sealed = trueState(cond(), LIMIT);
  assert.ok(open.co2Ppm > ATMOSPHERIC_CO2_PPM, '뚜껑을 열면 아무 변화가 없다고 하면 안 됩니다');
  assert.ok(open.co2Ppm < sealed.co2Ppm / 3, '밀봉 여부가 눈에 띄게 갈려야 합니다');
  // 평평해졌는가 — 뒤쪽 10분에 앞쪽 10분만큼 오르지 않는다.
  const early = co2Rise(cond({ sealed: false }), 10);
  const late = co2Rise(cond({ sealed: false }), 20) - early;
  assert.ok(late < early * 0.2, '뚜껑을 열어 두었는데 계속 오릅니다');
});

test('콩을 많이 넣을수록 더 크게 오른다', () => {
  assert.ok(co2Rate(cond({ scoops: 4 })) > co2Rate(cond({ scoops: 2 })));
  assert.ok(tempRise(cond({ scoops: 4 }), LIMIT) > tempRise(cond({ scoops: 2 }), LIMIT));
});

/* ---------------- 한 걸음씩 나아가는가 ---------------- */

/**
 * 조건이 내내 같으면 **걸음의 합이 닫힌 형태와 같아야** 한다.
 * 이것이 어긋나면 `advance()` 가 다른 물리를 풀고 있는 것이다.
 */
test('조건이 같으면 한 걸음씩 나아간 결과가 닫힌 형태와 같다', () => {
  for (const c of [cond(), cond({ beans: 'dry' }), cond({ sealed: false }), cond({ scoops: 5 })]) {
    let v = { co2Ppm: ATMOSPHERIC_CO2_PPM, tempC: ROOM_TEMP_C };
    for (let i = 0; i < OBSERVE_LIMIT_MIN; i++) v = advance(c, v, 1);
    const closed = trueState(c, OBSERVE_LIMIT_MIN);
    const gap = Math.abs(v.co2Ppm - closed.co2Ppm) / Math.max(1, closed.co2Ppm - ATMOSPHERIC_CO2_PPM);
    assert.ok(gap < 0.02, `CO₂ 가 ${(gap * 100).toFixed(1)} % 어긋납니다`);
    assert.ok(Math.abs(v.tempC - closed.tempC) < 0.05);
  }
});

/**
 * 재는 도중에 뚜껑을 열면 **거기서부터 새어 나간다.**
 *
 * 경과 시간에서 다시 계산하던 시절에는 곡선이 그 자리에서 **수직으로 뚝 떨어졌다** —
 * 2 000 ppm 이던 챔버가 한순간에 600 ppm 이 됐다. 그런 일은 없다.
 * 그래프를 눈으로 보다가 잡았다.
 */
test('뚜껑을 열어도 곡선이 수직으로 떨어지지 않는다', () => {
  let v = { co2Ppm: ATMOSPHERIC_CO2_PPM, tempC: ROOM_TEMP_C };
  for (let i = 0; i < 10; i++) v = advance(cond(), v, 1);
  const peak = v.co2Ppm;
  const after = advance(cond({ sealed: false }), v, 1);
  const dropped = peak - after.co2Ppm;
  assert.ok(dropped > 0, '뚜껑을 열었는데 안 샙니다');
  assert.ok(dropped < (peak - ATMOSPHERIC_CO2_PPM) * 0.6,
    `1분 만에 ${dropped.toFixed(0)} ppm 이 사라졌습니다 — 곡선이 수직으로 떨어집니다`);
  // 그래도 내내 열어 두면 결국 대기 농도 가까이로 내려온다.
  let far = after;
  for (let i = 0; i < 20; i++) far = advance(cond({ sealed: false }), far, 1);
  assert.ok(far.co2Ppm < peak * 0.5, '내내 열어 두었는데 안 내려옵니다');
});

/* ---------------- 센서는 재는 도구일 뿐인가 ---------------- */

test('센서가 콩에 파묻히면 값이 튄다 — 챔버 안에서 일어난 일은 그대로다', () => {
  const c = cond({ sensor: 'buried' });
  const truth = trueState(c, 10);
  // 여러 분을 훑어 실제로 튀는지 본다. 한 분만 보면 잡음이 0 에 가까운 순간을 볼 수 있다.
  const gaps = [];
  for (let m = 1; m <= LIMIT; m++) gaps.push(Math.abs(sensorReading(c, m).co2Ppm - trueState(c, m).co2Ppm));
  assert.ok(Math.max(...gaps) > 50, '파묻힌 센서가 전혀 안 튑니다');
  // 챔버 안의 진짜 값은 센서와 무관하다 — BTB 색이 센서 때문에 바뀌면 안 된다.
  assert.deepEqual(trueState(cond({ sensor: 'clear' }), 10), truth);
});

test('부스러기가 묻은 센서는 덜 튀지만 계속 튄다', () => {
  const worst = (c) => {
    let g = 0;
    for (let m = 1; m <= LIMIT; m++) g = Math.max(g, Math.abs(sensorReading(c, m).co2Ppm - trueState(c, m).co2Ppm));
    return g;
  };
  const buried = worst(cond({ sensor: 'buried' }));
  const fouled = worst(cond({ sensor: 'clear', fouled: true }));
  assert.ok(fouled > 0, '닦지 않은 센서가 전혀 안 튑니다 — 닦을 이유가 없어집니다');
  assert.ok(fouled < buried, '부스러기가 파묻힌 것만큼 튀면 안 됩니다');
  assert.equal(worst(cond({ sensor: 'clear' })), 0, '깨끗한 센서는 튀지 않아야 합니다');
});

/**
 * 파묻힌 센서는 **언제나 높게** 읽는다.
 *
 * 위아래로 흔들리게 두었더니 그래프가 **대기 농도 아래로 내려갔고**, 그건 「닫힌 챔버에서
 * CO₂ 가 줄었다」로 읽힌다 — 학생이 얻을 결론으로 최악이다.
 * 실제로도 한쪽이다: 센서 끝이 콩 더미 속에 있으면 **콩 바로 옆의 진한 공기**를 잰다.
 */
test('파묻힌 센서는 언제나 높게 읽는다 — 대기 농도 아래로 내려가지 않는다', () => {
  const c = cond({ beans: null, scoops: 0, sensor: 'buried' });
  for (let m = 0; m <= LIMIT; m++) {
    const r = sensorReading(c, m);
    assert.ok(r.co2Ppm >= ATMOSPHERIC_CO2_PPM,
      `${m}분에 ${r.co2Ppm.toFixed(0)} ppm — 대기 농도보다 낮습니다`);
    assert.ok(r.tempC >= ROOM_TEMP_C, `${m}분에 온도가 실온보다 낮습니다`);
  }
});

/* ---------------- 순수 함수인가 ---------------- */

test('같은 상태·같은 시드면 같은 값이 나온다', () => {
  const c = cond({ sensor: 'buried' });
  assert.deepEqual(sensorReading(c, 7), sensorReading({ ...c }, 7));
});

test('시드가 다르면 튀는 모양이 다르다', () => {
  const a = sensorReading(cond({ sensor: 'buried', seed: 1 }), 7);
  const b = sensorReading(cond({ sensor: 'buried', seed: 2 }), 7);
  assert.notEqual(a.co2Ppm, b.co2Ppm);
});

test('잡음은 −1~1 안에 있다', () => {
  for (let i = 0; i < 200; i++) {
    const v = jitter(20260827, i % 3, i);
    assert.ok(v >= -1 && v <= 1, `${v} 가 범위 밖입니다`);
  }
});

/**
 * 주석은 걷어내고 본다. 이 파일의 머리말은 「`Math.random()` 을 쓰지 않는다」처럼
 * 금지어를 그대로 적고 있어서, 안 걷어내면 **설명문을 코드로 오해한다.**
 * 검사가 맞는 코드에 빨간불을 내면 사람은 검사를 꺼 버린다.
 */
const codeOf = (url) => readFileSync(url, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('난수와 시계를 쓰지 않는다', () => {
  const code = codeOf(new URL('../src/sim/metabolism.js', import.meta.url));
  assert.ok(!code.includes('Math.random'), 'Math.random 을 쓰면 같은 상태에서 같은 그림이 안 나옵니다');
  assert.ok(!code.includes('Date.now'), 'Date.now 를 쓰면 테스트가 비결정적이 됩니다');
});

/* ---------------- 지어낸 수치가 없는가 ---------------- */

test('모형 파일에 g 과 mL 이 없다', () => {
  // 콩의 양과 챔버 부피는 교과서에서 확인하지 않았다 (AGENTS.md §2.4).
  // 설명하려고 넣은 임시 숫자가 다음 사람에게는 사실로 읽힌다.
  const src = readFileSync(new URL('../src/sim/metabolism.js', import.meta.url), 'utf8');
  const bad = [...src.matchAll(/\d+\s*(g|mL|ml|그램|밀리리터)\b/g)].map((m) => m[0]);
  assert.deepEqual(bad, [], `확인하지 않은 실물 수치가 있습니다: ${bad.join(', ')}`);
});

/* ---------------- 문서의 사다리가 모형과 갈라지지 않는가 ---------------- */

/**
 * `PLAYTEST.md` 에 「몇 분째에 얼마」 표를 두었다. 사람이 손으로 다시 잴 때
 * **어느 상태에서 잰 값인지**를 알려 주려는 것이다 — 0분에 재면 두 챔버가 똑같아서
 * 「차이가 없다」가 그냥 나오고, 그것을 버그로 적어 보내게 된다.
 *
 * **그 표는 낡는다.** 계수를 손대면 문서만 옛 값으로 남고, 그러면 선생님이 맞는 값을
 * 보고도 「모형이 틀렸다」고 적으신다 — 문서가 없는 버그를 만들어 내는 자리다.
 * 그래서 표를 **읽어서** 모형과 맞대 본다.
 */
test('PLAYTEST 의 시간별 값이 모형과 같다', () => {
  const doc = readFileSync(new URL('../PLAYTEST.md', import.meta.url), 'utf8');
  const rows = [...doc.matchAll(
    /^\|\s*\*{0,2}(\d+)분\*{0,2}\s*\|\s*(\d+)\s*\/\s*(\d+)[^|]*\|\s*([\d.]+)\s*\/\s*([\d.]+)/gm)]
    .map((m) => m.slice(1).map(Number));
  // [앞 조건] 표 모양이 바뀌어 **덜 읽으면** 남은 줄만 맞대 보고 초록불이 켜진다 —
  // 0 줄이면 「0 줄 중 0 줄이 맞다」로 통과한다. 그래서 **표에 있는 만큼 읽었는지**를 먼저 본다.
  const tableLines = doc.split('\n')
    .filter((l) => /^\|/.test(l) && /ppm|℃|\d+\s*\/\s*\d+/.test(l) && !/^\|\s*-/.test(l)).length;
  assert.equal(rows.length, tableLines,
    `PLAYTEST 의 시간별 표를 ${tableLines}줄 중 ${rows.length}줄만 읽었습니다 — 표 모양이 바뀌었으면 이 검사의 정규식도 함께 고치세요`);
  assert.ok(rows.length >= 4, `PLAYTEST 의 시간별 표를 못 읽었습니다 (${rows.length}줄)`);

  const f = (n) => n.toFixed(1);   // 붙여 넣을 줄이 문서의 자릿수(20.0)와 같아야 그대로 붙는다
  let st = initialState(1);
  const d = (type, payload) => { st = reduce(st, { type, payload }).state; };
  for (const [kind, chamber] of [['sprout', 'L'], ['sprout', 'L'], ['dry', 'R'], ['dry', 'R']]) {
    d('SCOOP_BEANS', { kind }); d('POUR_BEANS', { chamber });
  }
  for (const c of ['L', 'R']) {
    d('POUR_BTB', { chamber: c }); d('INSTALL_SENSOR', { chamber: c });
    d('SEAL', { chamber: c }); d('START', { chamber: c });
  }
  for (const [min, co2L, co2R, tL, tR] of rows) {
    while (st.chambers.L.elapsedMin < min) d('TICK', { minutes: 1 });
    const got = {
      co2L: Math.round(st.chambers.L.co2Ppm), co2R: Math.round(st.chambers.R.co2Ppm),
      tL: Number(st.chambers.L.tempC.toFixed(1)), tR: Number(st.chambers.R.tempC.toFixed(1)),
    };
    assert.deepEqual(got, { co2L, co2R, tL, tR }, [
      `${min}분 값이 문서와 다릅니다.`,
      `  모형: ${got.co2L} / ${got.co2R} ppm · ${f(got.tL)} / ${f(got.tR)} ℃`,
      `  문서: ${co2L} / ${co2R} ppm · ${f(tL)} / ${f(tR)} ℃`,
      '  ★ 먼저 **왜 바뀌었는지** 보세요. 계수를 일부러 고친 것이 아니라면 이것은 회귀이고,',
      '    문서에 받아 적으면 버그가 그대로 정상이 됩니다.',
      '  일부러 고친 것이 맞다면 PLAYTEST.md 의 그 줄 숫자를 이것으로 바꾸세요 (줄 모양은 그대로):',
      `    ${got.co2L} / ${got.co2R}   ·   ${f(got.tL)} / ${f(got.tR)}`,
    ].join('\n'));
  }
});

test('0분에는 두 챔버가 같다 — 문서가 그렇게 말하는 근거', () => {
  // 이 한 줄이 「측정을 막 시작하고 재면 차이가 없는 것이 정상」의 근거다.
  let st = initialState(1);
  const d = (type, payload) => { st = reduce(st, { type, payload }).state; };
  for (const [kind, chamber] of [['sprout', 'L'], ['dry', 'R']]) {
    d('SCOOP_BEANS', { kind }); d('POUR_BEANS', { chamber });
  }
  for (const c of ['L', 'R']) { d('SEAL', { chamber: c }); d('START', { chamber: c }); }

  // [앞 조건] **측정이 실제로 돌고 있어야** 「같다」가 뜻을 갖는다.
  // 밀봉·시작이 빠지면 두 챔버가 대기 농도에 그대로 앉아 있어 **아무 일도 안 해서** 같아지고,
  // 이 검사는 그 0 을 세어 초록불을 켠다 — 문서가 말하는 것과 정반대의 이유로.
  assert.ok(st.chambers.L.running && st.chambers.R.running, '측정이 시작되지 않았습니다');
  assert.equal(st.chambers.L.elapsedMin, 0, '0분이 아닙니다');
  assert.notEqual(st.chambers.L.beans, st.chambers.R.beans,
    '두 챔버에 같은 콩이 들어갔습니다 — 그러면 같은 것이 당연해서 아무것도 증명하지 못합니다');

  assert.equal(st.chambers.L.co2Ppm, st.chambers.R.co2Ppm, '0분인데 이산화 탄소가 다릅니다');
  assert.equal(st.chambers.L.tempC, st.chambers.R.tempC, '0분인데 온도가 다릅니다');
});

/**
 * 표 위의 산문 한 줄도 **같은 숫자를 두 번째로** 적어 둔 자리다.
 * 지나가는 참고 수치가 아니라 **선생님께 「재 보시고 다르면 알려 달라」고 내미는 값**이라
 * 표와 함께 못 박는다. 안 그러면 표만 고쳐지고 산문이 옛 값으로 남는다.
 */
test('PLAYTEST 의 산문 요약(약 N ppm · +N ℃)도 모형과 같다', () => {
  const doc = readFileSync(new URL('../PLAYTEST.md', import.meta.url), 'utf8');
  const m = doc.match(/30분에[^\n]*?약\s*([\d\s]+)\s*ppm[^\n]*?\+\s*([\d.]+)\s*℃/);
  assert.ok(m, 'PLAYTEST 에서 「30분에 … 약 N ppm · +N ℃」 줄을 못 찾았습니다 — 지웠으면 이 검사도 지우세요');
  const [, ppmRaw, riseRaw] = m;
  const saidPpm = Number(ppmRaw.replace(/\s/g, ''));
  const saidRise = Number(riseRaw);

  let st = initialState(1);
  const d = (type, payload) => { st = reduce(st, { type, payload }).state; };
  for (const [kind, chamber] of [['sprout', 'L'], ['sprout', 'L']]) {
    d('SCOOP_BEANS', { kind }); d('POUR_BEANS', { chamber });
  }
  d('SEAL', { chamber: 'L' }); d('START', { chamber: 'L' });
  assert.ok(st.chambers.L.running, '측정이 시작되지 않았습니다 — 이 검사의 준비 단계가 깨졌습니다');
  while (st.chambers.L.elapsedMin < 30) d('TICK', { minutes: 1 });

  const ppm = Math.round(st.chambers.L.co2Ppm / 100) * 100;   // 문서가 「약」이라 100 단위
  const rise = Number((st.chambers.L.tempC - ROOM_TEMP_C).toFixed(1));
  assert.deepEqual({ ppm, rise }, { ppm: saidPpm, rise: saidRise }, [
    '표 위의 산문 요약이 모형과 다릅니다.',
    `  모형: 약 ${ppm} ppm · +${rise} ℃ / 문서: 약 ${saidPpm} ppm · +${saidRise} ℃`,
    '  ★ 먼저 **왜 바뀌었는지** 보세요 — 회귀라면 문서가 아니라 코드를 고쳐야 합니다.',
    `  문서를 고칠 것이 맞다면 그 줄을 「약 ${String(ppm).replace(/(\d)(\d{3})$/, '$1 $2')} ppm · +${rise} ℃」 로 바꾸세요.`,
  ].join('\n'));
});
