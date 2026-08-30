/**
 * 손끝(finger) 애셋 — 라인 + 플랫 구현.
 *
 * 옆에서 본 손가락 끝 한 마디. 손톱이 보이고, 소독한 자리와 맺힌 핏방울이 상태로 붙는다.
 *
 * **채혈은 가상이다.** 학생이 실제로 자기 손을 찌르는 활동이 아니므로
 * 상처·바늘·통증을 그리지 않는다. 도식적으로만 그린다.
 *
 * 살색: 공용 팔레트에 사람 피부색은 없다. `flesh` 는 **바나나 과육 색**(#FAF4E0)이라
 * 살로 읽히지 않으므로 쓰지 않는다. `rubber`(#E39B9B)는 palette.experiment.js 주석이
 * 적어 둔 대로 **핏방울과 헷갈리는 살구빛**이라 이 그림에서는 최악의 선택이다 —
 * 핏방울이 바로 그 위에 맺히기 때문이다.
 * 그래서 `peelOverripe`(#DCC084 / #B08A48)를 쓴다. 팔레트에 실제로 있는 색 중
 * 선홍(#D6303A)과 가장 멀면서 살빛으로 읽히는 유일한 색이다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE, paintExp } from '../style/palette.experiment.js';
import { clamp } from './geometry.js';

export const NODES = ['#hand', '#hand-shade', '#nail', '#drop', '#swabbed'];

/** 살빛. 팔레트에 사람 피부색이 없어 가장 가까운 공용 색을 고정으로 쓴다. */
const SKIN = PALETTE.peelOverripe;

/** 소독한 자리가 보이는가. */
export function swabbedOpacity(state = {}) {
  return state.swabbed ? '1' : '0';
}

/**
 * 맺힌 핏방울의 크기. 휴지로 눌러 지혈했으면(wiped) 0이다.
 * 0~1 의 연속값이라 "조금 맺혔다 / 충분히 맺혔다" 가 그림에서 그대로 보인다.
 */
export function dropAmount(state = {}) {
  if (state.wiped) return 0;
  return clamp(state.drop ?? 0, 0, 1);
}

export function dropOpacity(state = {}) {
  return dropAmount(state) > 0 ? '1' : '0';
}

/** 핏방울은 원점에 그려 두고 위치·크기를 transform 으로만 준다 (계약: transform 가변). */
export function dropTransform(state = {}) {
  const s = (0.36 + 0.64 * dropAmount(state)).toFixed(2);
  return `translate(296,184) scale(${s})`;
}

export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="finger">
  <!-- 손가락 끝 한 마디 (왼쪽은 프레임 밖으로 이어진다).
       끝으로 갈수록 좁아지고 끝은 둥글다 — 곧은 각기둥으로 그리면 손가락으로 안 읽힌다 -->
  <g id="hand">
    <path d="M 40,104 C 120,104 200,106 250,112 C 292,118 330,132 334,156 C 330,180 292,194 250,200 C 200,206 120,206 40,206 Z" fill="${SKIN[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 마디 주름 -->
    <path d="M 104,110 C 112,132 112,180 104,200" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 120,116 C 126,136 126,176 120,196" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 지문 (손끝 안쪽 볼) -->
    <path d="M 206,150 C 222,142 240,142 252,148" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 204,166 C 220,157 240,157 254,164" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 우하단 음영 (광원 좌상단 45°) -->
  <path id="hand-shade" d="M 40,190 L 250,186 C 296,182 326,172 330,158 L 334,156 C 330,180 292,194 250,200 C 200,206 120,206 40,206 Z" fill="${SKIN[1]}"/>

  <!-- 손톱 (손등 쪽, 끝마디 위) -->
  <g id="nail">
    <path d="M 238,126 C 252,118 276,122 296,134 C 308,141 310,151 304,156 C 296,161 280,157 262,148 C 246,140 234,133 238,126 Z" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
    <path d="M 296,134 C 308,141 310,151 304,156 C 296,161 280,157 262,148 C 280,153 296,154 304,150 C 308,147 306,140 296,134 Z" fill="${PALETTE.paper[1]}"/>
    <!-- 손톱 반달 -->
    <path d="M 244,130 C 250,126 258,126 266,130" fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 소독한 자리 — 손끝 볼(지문 쪽)이다. 손톱 밑이 아니다 -->
  <g id="swabbed" opacity="${swabbedOpacity(state)}">
    <path d="M 262,176 C 268,166 286,164 300,169 C 310,173 312,182 306,187 C 296,192 278,191 268,186 C 260,182 259,179 262,176 Z" fill="${EXP_PALETTE.alcohol[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <path d="M 300,169 C 310,173 312,182 306,187 C 296,192 278,191 268,186 C 284,189 298,187 304,182 C 308,178 306,173 300,169 Z" fill="${EXP_PALETTE.alcohol[1]}"/>
  </g>

  <!-- 맺힌 핏방울 — **선홍색이다.** 압축된 적혈구층(암적색)과 다른 색이어야
       "다져졌다" 는 변화가 나중에 보인다. 원점에 그리고 transform 으로 옮긴다. -->
  <g id="drop" opacity="${dropOpacity(state)}" transform="${dropTransform(state)}">
    <path d="M 0,-20 C 9,-11 18,-2 18,7 C 18,16 9,22 0,22 C -9,22 -18,16 -18,7 C -18,-2 -9,-11 0,-20 Z" ${paintExp('bloodFresh', { stroke: 'detail' })}/>
    <path d="M 4,-16 C 12,-7 18,-1 18,7 C 18,16 9,22 0,22 C 9,18 13,12 13,5 C 13,-3 9,-10 4,-16 Z" fill="${EXP_PALETTE.bloodFresh[1]}"/>
  </g>
</svg>`;
}

export function applyState(root, state = {}) {
  const swabbed = root.querySelector('#swabbed');
  if (swabbed) swabbed.setAttribute('opacity', swabbedOpacity(state));

  const drop = root.querySelector('#drop');
  if (drop) {
    drop.setAttribute('opacity', dropOpacity(state));
    drop.setAttribute('transform', dropTransform(state));
  }
}
