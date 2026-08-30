/**
 * 난이도 — **설명만 줄이고 조작은 줄이지 않는다.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 바나나랩에서 검사 118개가 통과하는 상태에서 **2·3단계에 닿을 방법이 아예 없었다.**
 * 구현은 다 되어 있었는데 그 화면으로 들어가는 문이 없었다. 그건 어느 단위 테스트에도
 * 안 걸린다 — 각 조각은 멀쩡했기 때문이다.
 *
 * 그래서 여기서는 **닿을 수 있는가**부터 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, UNDO_LIMITS, MODES } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
/*
 * 시작 화면은 **공용**이다 (`packages/lab-kit/ui/start.js`) — 실험 다섯이 같은 것을 쓴다.
 * 그래도 여기서 본다: 단계에 닿는 길이 끊기면 **이 실험이** 2·3단계를 못 쓰기 때문이다.
 * 공용을 고쳐 길이 끊기면 여기가 빨간불을 낸다. (합치기 5단계, 2026-08-30)
 */
const start = readFileSync(
  new URL('../../../packages/lab-kit/ui/start.js', import.meta.url), 'utf8');

test('세 단계에 닿는 길이 둘 다 있다 — 시작 화면과 주소', () => {
  // 주소(`?level=2`)는 **교사가 반이나 모둠에 따라 링크를 나눠 주는 길**이다.
  // 시작 화면만 있으면 서른 명에게 일일이 말해야 하고, 주소만 있으면 혼자 하는 학생이 못 고른다.
  assert.match(main, /level/, 'main.js 가 주소에서 단계를 읽지 않습니다');
  assert.match(main, /URLSearchParams/, '주소를 읽는 통로가 없습니다');
  assert.equal(UI.start.levels.length, 3, '시작 화면에 단계 셋이 있어야 합니다');
  assert.match(start, /data-level/, '시작 화면이 단계를 고르게 하지 않습니다');
});

test('혼자/모둠도 두 길로 고를 수 있다', () => {
  assert.equal(UI.start.modes.length, 2);
  assert.match(main, /mode/, 'main.js 가 주소에서 혼자/모둠을 읽지 않습니다');
  assert.deepEqual(UI.start.modes.map((m) => m.id).sort(), [MODES.GROUP, MODES.SOLO].sort());
});

test('세 단계가 실제로 다르다', () => {
  assert.equal(UNDO_LIMITS[1], Infinity);
  assert.equal(UNDO_LIMITS[2], 3);
  assert.equal(UNDO_LIMITS[3], 1);
  const seen = new Set([1, 2, 3].map((lv) => String(initialState(lv).session.undosLeft)));
  assert.equal(seen.size, 3, '세 단계의 되돌리기 횟수가 같으면 고를 이유가 없습니다');
});

test('단계 설명이 「무엇이 달라지는가」를 말한다', () => {
  // "어렵다/쉽다" 로 적으면 학생이 자기를 낮춰 고른다. 화면이 얼마나 거들어 주는가를 적는다.
  for (const lv of UI.start.levels) {
    assert.ok(lv.desc && lv.desc.length > 20, `${lv.id}단계 설명이 너무 짧습니다`);
    assert.equal(/어렵|쉬운|쉽습|잘하는|못하는/.test(lv.desc), false,
      `${lv.id}단계 설명이 난이도를 사람의 능력으로 말합니다: "${lv.desc}"`);
  }
  // 셋이 서로 다른 말을 해야 고를 거리가 된다.
  assert.equal(new Set(UI.start.levels.map((l) => l.desc)).size, 3);
});

test('자기 평가는 난이도와 무관하게 같다', () => {
  // 자기를 돌아보는 일에 난이도를 매길 이유가 없다. 점수를 합산하지도 등급을 내지도 않는다.
  assert.ok(UI.notebook.selfEvalItems.length >= 5);
  assert.equal(UI.notebook.likertScale.length, 5);
});

test('3단계에서도 할 수 있는 일이 그대로다', () => {
  // 안내가 비는 것과 길이 막히는 것은 다르다. 조작표가 난이도를 안 받는지는
  // tests/bench.test.js 가 보고, 여기서는 **안내만 비었는지**를 본다.
  for (const kind of Object.keys(UI.bench.hints)) {
    assert.deepEqual(UI.bench.hints[kind][3], [], `${kind} 의 3단계 안내가 남아 있습니다`);
    assert.ok(UI.bench.hints[kind][1].length > 0, `${kind} 의 1단계 안내가 비었습니다`);
  }
});
