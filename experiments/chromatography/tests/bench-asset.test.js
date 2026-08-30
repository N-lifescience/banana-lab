/**
 * 실험대 배경 애셋 — **배경은 물건을 돋보이게 하는 자리다.**
 *
 * 선생님이 여덟 랩을 돌려 보고 빼라고 하신 것들이 있다: 콘센트 둘 · 선반 지지 기둥 ·
 * 연필처럼 보이던 가스 밸브 노즐 · 서랍 셋. 공통점은 **아무 일도 안 하면서 눈길을
 * 끄는 것**이다. 특히 서랍과 밸브는 학생이 눌러 보거나 집으려 든다 —
 * 눌러서 아무 일도 안 나는 그림은 이 앱에서 만들지 않는다.
 *
 * 그림이 어떻게 보이는지는 기계가 못 판정한다. 여기서 지키는 것은 **다시 그려 넣지
 * 않는가**와 **깊이를 만드는 두 단이 살아 있는가** 둘이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, NODES } from '../src/assets/bench.js';
import { PALETTE } from '../src/style/tokens.js';

const svg = render();

/** 색의 밝기. 「누운 면이 더 밝은가」를 재려면 이름이 아니라 값으로 봐야 한다. */
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

test('걷어낸 부속이 되살아나지 않았다 — 콘센트 · 기둥 · 밸브 · 서랍', () => {
  /*
   * ── 이 검사가 한 번 헛발질했다 ──────────────────────────────────
   * 처음에는 **「금속색을 안 쓴다」**로 적었다. 걷어낸 넷이 다 금속색이었으니 그때는 맞았다.
   * 그런데 참고 이미지대로 **상판을 밝은 회색으로, 선반 브래킷을 금속으로** 다시 그리자
   * 이 검사가 물었다 — **지킬 것은 색이 아니라 그 물건들이었는데** 색을 재고 있었다.
   * 검사가 맞는 일을 막아서면 사람이 검사를 끄고, 그러면 진짜도 같이 못 잡는다.
   *
   * 그래서 **그 넷이 있던 자리와 모양**을 잰다. (정본 banana-lab 과 같은 검사다.)
   */
  assert.equal(/<circle/.test(svg), false,
    '실험대 배경에 원이 있습니다 — 콘센트 구멍이 되살아났습니다');

  // 콘센트·가스 밸브·서비스 채널이 있던 벽 띠. 지금은 **비어 있어야** 한다.
  const shapes = [...svg.matchAll(/<(?:rect|polygon|line)\b[^>]*>/g)].map((m) => m[0])
    .filter((tag) => {
      const ys = [...tag.matchAll(/(?:\by|\by1|\by2)="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
      for (const [, list] of tag.matchAll(/points="([^"]+)"/g)) {
        const n = list.trim().split(/[\s,]+/).map(Number);
        for (let k = 1; k < n.length; k += 2) ys.push(n[k]);
      }
      const h = Number(tag.match(/(?<![-\w])height="([\d.]+)"/)?.[1] ?? 0);
      if (ys.length === 0) return false;
      return Math.min(...ys) >= 92 && Math.max(...ys) + h <= 132;
    });
  assert.deepEqual(shapes, [],
    '뒷벽 한가운데에 도형이 있습니다 — 콘센트·가스 밸브·서비스 채널을 걷어낸 자리입니다');

  // 서랍 손잡이는 둥근 모서리의 납작한 막대였다.
  const surface = svg.slice(svg.indexOf('<g id="surface"'), svg.indexOf('</g>', svg.indexOf('<g id="surface"')));
  assert.equal(/rx="1\.5"/.test(surface), false, '캐비닛에 서랍 손잡이가 되살아났습니다');
});

test('작업면이 두 단으로 갈려 아래쪽이 아래로 읽힌다', () => {
  /*
   * 위를 보는 면은 빛을 더 받고, 앞으로 떨어지는 두께면은 어둡다. 그 한 단이 없으면
   * 작업면이 평평한 판때기로 보여 어디가 앞인지 알 수 없다 — 선생님이 지적하신 자리다.
   * **그라데이션이 아니라 색 두 단이다** (check:art 가 그쪽을 지킨다).
   *
   * ── 재는 법을 두 번 고쳤다 ──────────────────────────────────────
   * ① 처음에는 어두운 색이 소스에 있는지만 봤다. 그 색은 걸레받이에도 쓰여서
   *    **아래 단을 통째로 지워도 초록불**이었다.
   * ② 다음에는 옛 구조의 사각형 좌표를 박아 뒀다. 참고 이미지대로 **누운 면을 사다리꼴로**
   *    다시 그리자 좌표가 안 맞아 맞는 그림을 막았다.
   * 이제 **면 둘을 찾아 밝기를 견준다** — 좌표도 색 이름도 아니고 「어느 쪽이 밝은가」다.
   */
  const lying = /<polygon points="0,155 400,155 [^"]*" fill="([^"]+)"/.exec(svg);
  assert.ok(lying, '작업면의 누운 면(물건이 딛고 서는 면)을 못 찾았습니다');
  const standing = /<rect x="0" y="155"[^>]*fill="([^"]+)"/.exec(svg);
  assert.ok(standing, '작업면의 서 있는 면(두께)을 못 찾았습니다');
  assert.ok(lum(lying[1]) > lum(standing[1]),
    `누운 면이 서 있는 면보다 밝아야 합니다 — 지금 ${lying[1]} vs ${standing[1]}`);
});

test('애셋 계약의 노드 넷이 그대로 있다', () => {
  // 물건을 빼면서 실수로 통째로 지우기 쉬운 자리다. 노드가 없으면 렌더러가 조용히 깨진다.
  for (const n of NODES) {
    assert.ok(svg.includes(`id="${n.slice(1)}"`), `${n} 노드가 사라졌습니다`);
  }
});
