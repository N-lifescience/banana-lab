/**
 * 플레이테스트(2026-09-02)에서 잡은 것들이 도로 깨지지 않게 못 박는다.
 * 무엇을 왜 고쳤는지는 `PLAYTEST-REVIEW.md` 에 있다. 검사마다 그 표의 번호를 적어 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultControls, CHOICES } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/* #1 — 통제변인 기본값이 실험대에 없는 값이면 학생은 아무 잘못 없이 전부 「설계와 다름」이 된다 */
test('통제변인 기본값은 전부 화면에서 고를 수 있는 값이다 (항온기에 있는 온도)', () => {
  const d = defaultControls();
  for (const [key, choices] of Object.entries(CHOICES)) {
    assert.ok(choices.includes(d[key]),
      `${key} 의 기본값 ${d[key]} 이 고를 수 있는 값 ${JSON.stringify(choices)} 에 없습니다 — `
      + '학생이 손대지 않아도 모든 시행이 「설계와 다름」이 됩니다');
  }
});

/* #2 — 「실험 설계」는 탐구 노트 **아래**에 있다. 왼쪽은 잠긴 실험대다 */
test('예상 관문이 학생을 왼쪽(잠긴 실험대)으로 보내지 않는다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const side = html.indexOf('id="side"');
  assert.ok(side > 0 && html.indexOf('id="notebook"', side) < html.indexOf('id="design-root"', side),
    '실험 설계가 탐구 노트 아래에 있다는 전제가 깨졌습니다 — 문구도 함께 고치세요');
  for (const s of [UI.notebook.readNeedsVariable, UI.notebook.predictNoVariable]) {
    assert.ok(!s.includes('왼쪽'), `「왼쪽」이라고 합니다: ${s}`);
    assert.ok(s.includes('아래'), `어디에 있는지 말하지 않습니다: ${s}`);
  }
});

test('실험대 물건에서 Tab → 놓기 단추, Esc → 말풍선 닫기 (진짜 Tab 으로 닿는 다리)', () => {
  const bench = src('../src/ui/bench.js');
  assert.ok(/function focusFirstPut\(\)/.test(bench), '놓기 단추로 들어가는 다리(focusFirstPut)가 없습니다');
  assert.ok(/e\.key === 'Tab' && !e\.shiftKey && tipFromKeyboard && focusFirstPut\(\)/.test(bench),
    '물건의 keydown 이 Tab 을 놓기 단추로 보내지 않습니다 — 키보드로는 단추에 닿을 수 없습니다');
  assert.ok((bench.match(/e\.key === 'Escape'/g) ?? []).length >= 2,
    'Esc 처리가 물건과 말풍선 양쪽에 있어야 합니다');
});

/* #6 — 맹관부에도 기포가 난다. 팽대부의 기포는 맹관부로 건너가지 못한다 */
test('발효 중인 발효관은 맹관부 안에서도 기포가 올라온다 — 고인 기체 아래에서만', async () => {
  const { bubbleMarkup } = await import('../src/assets/fermtube.js');
  const cy = (svg) => [...svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const arm = cy(bubbleMarkup({ bubbling: true, level: 1, fill: 0.5 })).filter(([x]) => x < 150);
  assert.ok(arm.length >= 2, '맹관부(x<150) 기포가 없습니다');
  const gasBottom = 33 + 205 * 0.5;
  for (const [, y] of arm) assert.ok(y > gasBottom, `기포 y=${y} 가 고인 기체(아랫면 ${gasBottom}) 안에 있습니다`);
  assert.equal(bubbleMarkup({ bubbling: false, level: 1, fill: 0.5 }), '', '발효가 안 일어나면 기포가 없어야 합니다');
});
