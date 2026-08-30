/**
 * 비커 통(beakerbox) 애셋 — 라인 + 플랫.
 *
 * ── 왜 이 물건이 있나 ──────────────────────────────────────────────
 * 뜨거운 비커를 찬물에 담그면 유리가 깨진다. 이 실험에서 조작이 막히는 **유일한** 자리다
 * (`src/sim/rules.js` 의 `PUT_IN_BATH`). 막을 때는 **어디로 가야 하는지까지** 말해야 하고,
 * 그 문구가 「선반의 비커 통에서 새 비커를 꺼내세요」다.
 *
 * 문구가 가리키는 물건이 실제로 선반에 없으면 그 문구는 거짓말이 된다.
 * 그래서 이 애셋이 있다. **몇 개 남았는지 세지 않는다** — 소모품이 바닥나면
 * 결과로 답한 것이 아니라 그냥 막다른 길이 된다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';

export const NODES = ['#tray', '#tray-shade', '#stack'];

/** 통에 엎어 둔 비커 셋. 겹쳐 보이게 조금씩 어긋나 있다. */
function beakerStack() {
  return [0, 1, 2].map((i) => {
    const x = 108 + i * 62;
    const y = 132 + (i % 2) * 4;
    return `<path d="M ${x},${y} L ${x + 6},${y + 68} L ${x + 42},${y + 68} L ${x + 48},${y} Z"`
      + ` fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>`
      + `<path d="M ${x + 34},${y} L ${x + 28},${y + 68} L ${x + 42},${y + 68} L ${x + 48},${y} Z"`
      + ` fill="${PALETTE.glass[1]}" stroke="none"/>`;
  }).join('');
}

export function render() {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="beakerbox">
  <ellipse cx="200" cy="238" rx="120" ry="14" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 얕은 쟁반. 비커를 엎어 두는 곳이다 -->
  <path id="tray" d="M 84,196 L 92,236 C 92,242 308,242 308,236 L 316,196 Z"
    fill="${PALETTE.metal[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <g id="stack">${beakerStack()}</g>

  <!-- 쟁반 앞면이 비커를 가리므로 테두리를 한 번 더 긋는다 -->
  <path d="M 84,196 L 316,196" fill="none" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
  <path id="tray-shade" d="M 240,196 L 236,240 C 288,240 308,240 308,236 L 316,196 Z"
    fill="${PALETTE.metal[1]}" stroke="none"/>
</svg>`;
}

/** 상태가 없다 — 몇 개 남았는지 세지 않는 것이 이 통을 놓는 이유다. */
export function applyState() {}
