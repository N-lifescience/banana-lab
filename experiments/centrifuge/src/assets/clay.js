/**
 * 고무찰흙(clay) 애셋 — 라인 + 플랫 구현.
 *
 * 작은 접시(`#tray`) 위의 덩이. 모세관 끝을 여기 눌러 막는다.
 * `dents` 만큼 눌린 자국이 `#dents` 안에 쌓인다 — 몇 번 눌렀는지가 덩이에 남는다.
 *
 * 자국 위치는 `geometry.js` 의 `rng(seed)` 로 정한다. `Math.random()` 은 쓰지 않는다 —
 * 같은 학생이 다시 열어도 같은 그림이 나와야 하고, 결과 보드가 시드만 저장할 수 있어야 한다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS, paint } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng } from './geometry.js';

export const NODES = ['#tray', '#lump', '#lump-shade', '#dents'];

const SVG_NS = 'http://www.w3.org/2000/svg';
const DENT_SEED = 4212;
const MAX_DENTS = 14;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function num(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * 눌린 자국의 좌표. 순수 함수라 렌더러와 갱신이 같은 그림을 만든다.
 *
 * 각도를 **황금각**으로 돌리고 반지름을 √로 늘린다. 그냥 난수로 뽑으면 몇 개가
 * 겹쳐 찍혀 "세 번 눌렀다" 가 두 자국으로 보인다 — 개수가 보여야 하는 그림이라
 * 자리는 고르게 벌리고, 흔들림만 난수(`rng`)로 준다.
 *
 * @param {{dents?: number, seed?: number}} state
 */
export function dentShapes(state = {}) {
  const n = Math.max(0, Math.min(MAX_DENTS, Math.round(num(state.dents))));
  const r = rng(num(state.seed, DENT_SEED));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * GOLDEN_ANGLE + (r() - 0.5) * 0.7;
    const rad = 14 + 30 * Math.sqrt((i + 0.6) / MAX_DENTS) + r() * 4;
    const rx = 10 + r() * 3;
    out.push({
      cx: +(200 + Math.cos(a) * rad * 1.15).toFixed(1),
      cy: +(142 + Math.sin(a) * rad * 0.78).toFixed(1),
      rx: +rx.toFixed(1),
      ry: +(rx * 0.62).toFixed(1),
    });
  }
  return out;
}

function dentMarkup(state) {
  return dentShapes(state)
    .map(
      (d) =>
        `    <ellipse cx="${d.cx}" cy="${d.cy}" rx="${d.rx}" ry="${d.ry}" fill="${EXP_PALETTE.clay[1]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`
    )
    .join('\n');
}

/**
 * 고무찰흙 SVG 문자열 렌더링
 *
 * @param {{dents?: number, seed?: number}} state
 */
export function render(state = {}) {
  const dents = dentMarkup(state);
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="clay">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="226" rx="134" ry="13" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 접시 -->
  <g id="tray">
    <!-- 접시 옆벽 -->
    <path d="M 74,182 L 74,190 Q 80,220 200,222 Q 320,220 326,190 L 326,182 Z" ${paint('paper')}/>
    <!-- 옆벽 우하단 음영 -->
    <path d="M 200,222 Q 320,220 326,190 L 326,182 L 308,182 Q 302,206 200,210 Z" fill="${PALETTE.paper[1]}"/>
    <!-- 접시 테두리 -->
    <ellipse cx="200" cy="182" rx="126" ry="36" ${paint('paper')}/>
    <!-- 접시 안쪽 바닥 -->
    <ellipse cx="200" cy="182" rx="108" ry="27" ${paint('paper', { shade: true, stroke: 'detail' })}/>
  </g>

  <!-- 고무찰흙 덩이 -->
  <path id="lump" d="M 138,152 Q 128,124 152,106 Q 184,86 222,96 Q 260,106 268,136 Q 274,164 244,176 Q 202,190 166,180 Q 142,172 138,152 Z" fill="${EXP_PALETTE.clay[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 덩이 우하단 음영 -->
  <path id="lump-shade" d="M 268,136 Q 274,164 244,176 Q 202,190 166,180 Q 208,180 234,166 Q 258,152 254,124 Q 265,126 268,136 Z" fill="${EXP_PALETTE.clay[1]}"/>

  <!-- 모세관 끝을 눌러 막은 자국. 누를 때마다 는다. -->
  <g id="dents">
${dents}
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 *
 * 문자열을 밀어 넣지 않고 노드를 만들어 붙인다 — `innerHTML` 을 쓰지 않는 편이
 * SVG 네임스페이스에서도 안전하고, 정화 함수를 따로 두지 않아도 된다.
 */
export function applyState(root, state = {}) {
  const g = root.querySelector('#dents');
  while (g.firstChild) g.removeChild(g.firstChild);
  for (const d of dentShapes(state)) {
    const el = (g.ownerDocument ?? document).createElementNS(SVG_NS, 'ellipse');
    el.setAttribute('cx', String(d.cx));
    el.setAttribute('cy', String(d.cy));
    el.setAttribute('rx', String(d.rx));
    el.setAttribute('ry', String(d.ry));
    el.setAttribute('fill', EXP_PALETTE.clay[1]);
    el.setAttribute('stroke', INK);
    el.setAttribute('stroke-width', String(STROKE.hair));
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('stroke-linecap', 'round');
    g.appendChild(el);
  }
}
