/**
 * 콩 통(beanjar) 애셋 — 라인 + 플랫 구현.
 *
 * **한 애셋으로 두 갈래를 그린다** (`kind: 'sprout' | 'dry'`).
 * 발아 콩과 마른 콩을 다른 파일로 만들면 둘의 크기 감각과 선 두께가 어긋난다.
 * 시약병(bottle)이 `kind` 로 세 갈래를 그리는 것과 같은 방식이다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 *
 * 콩 알갱이 도형(beanMarkup)은 여기 한 곳에만 둔다 — 숟가락(scoop.js)이 그대로 가져다 쓴다.
 * 통과 숟가락의 콩이 다른 크기로 그려지면 「같은 콩을 옮겼다」로 읽히지 않기 때문이다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, clamp } from './geometry.js';

export const NODES = ['#jar', '#jar-shade', '#lid', '#beans', '#label', '#label-text'];

/** 콩 알갱이 하나. 발아 콩은 흰 싹이 나와 있고, 마른 콩은 싹이 없다. */
export function beanMarkup(cx, cy, kind = 'sprout', rx = 11) {
  const sprout = kind !== 'dry';
  const tone = sprout ? 'beanSprout' : 'beanDry';
  const R = sprout ? rx : rx - 1.4;   // 마른 콩은 물을 머금지 않아 조금 더 작다
  const ry = R * 0.8;
  const body = EXP_PALETTE[tone];

  const n = (v) => Number(v).toFixed(1);
  // 우하단 음영. 광원이 좌상단 45° 이므로 초승달은 항상 오른쪽 아래에 붙는다.
  const p1 = `${n(cx - R * 0.55)},${n(cy + ry * 0.83)}`;
  const p2 = `${n(cx + R * 0.83)},${n(cy - ry * 0.55)}`;
  const q = `${n(cx + R * 0.49)},${n(cy + ry * 0.49)}`;

  let out =
    `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(R)}" ry="${n(ry)}" ` +
    `fill="${body[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>` +
    `<path d="M ${p1} A ${n(R)},${n(ry)} 0 0 0 ${p2} Q ${q} ${p1} Z" fill="${body[1]}"/>`;

  if (sprout) {
    const t = cy - ry;
    // 가늘고 길게 — 짧고 둥글게 그리면 「싹」이 아니라 콩 위에 얹힌 흰 구슬로 보인다.
    out +=
      `<path d="M ${n(cx - 3.5)},${n(t + 1)} C ${n(cx - 9)},${n(t - 5)} ${n(cx - 8)},${n(t - 13)} ${n(cx - 1)},${n(t - 17)} ` +
      `C ${n(cx + 3)},${n(t - 12)} ${n(cx + 1)},${n(t - 5)} ${n(cx + 2.5)},${n(t + 1)} Z" ` +
      `fill="${EXP_PALETTE.beanSproutTip[0]}" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>`;
  }
  return out;
}

/**
 * 통 안에 쌓인 콩.
 *
 * `level` 은 「얼마나 남았나」다. 바닥부터 쌓이므로 줄어드는 것이 눈에 보인다.
 * 위치는 `rng(seed)` 로만 흔든다 — 같은 시드는 같은 그림이다.
 */
export function beansMarkup(state = {}) {
  const kind = state.kind === 'dry' ? 'dry' : 'sprout';
  const level = clamp(state.level ?? 0.7, 0, 1);
  const rows = Math.round(level * 6);
  const r = rng(state.seed ?? 11);
  const out = [];

  for (let i = 0; i < rows; i++) {
    const cy = 241 - i * 17;   // 맨 아랫줄은 통 바닥에 닿는다 — 떠 있으면 「담긴 것」으로 안 읽힌다
    const even = i % 2 === 0;
    const cols = even ? 5 : 4;
    const x0 = even ? 148 : 161;
    for (let c = 0; c < cols; c++) {
      const cx = x0 + c * 26 + (r() * 2 - 1) * 2.5;
      const rx = 10.2 + r() * 1.6;
      out.push(beanMarkup(cx, cy + (r() * 2 - 1) * 1.5, kind, rx));
    }
  }
  return out.join('');
}

/** 뚜껑 열림 변형. 「닫는 정리 동작」이 눈에 보여야 한다. */
export function lidTransform(state = {}) {
  // 프레임 밖으로 나가면 뚜껑이 잘려 「어디 갔는지」 알 수 없다. 들린 채로 화면 안에 머문다.
  if (state.capOpen) return 'translate(48, -22) rotate(16 200 70)';
  return '';
}

/**
 * 라벨 글자. **색으로만 가르지 않는다** — 무엇이 든 통인지 글자로도 밝힌다.
 * 색각 이상이 있거나 흑백으로 인쇄해도 어느 통인지 알 수 있어야 한다.
 */
export function labelTextContent(kind) {
  if (kind === 'dry') {
    return `<text x="200" y="122" font-size="16" font-weight="bold" text-anchor="middle" fill="${INK}">마른 콩</text>` +
      `<text x="200" y="140" font-size="10" text-anchor="middle" fill="${INK}">싹이 없는 것</text>`;
  }
  return `<text x="200" y="122" font-size="16" font-weight="bold" text-anchor="middle" fill="${INK}">발아 콩</text>` +
    `<text x="200" y="140" font-size="10" text-anchor="middle" fill="${INK}">싹이 튼 것</text>`;
}

/**
 * 콩 통 SVG 문자열 렌더링
 *
 * @param {{kind?: 'sprout'|'dry', level?: number, capOpen?: boolean, seed?: number}} state
 */
export function render(state = {}) {
  const lid = lidTransform(state);

  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="beanjar">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="262" rx="92" ry="10" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 통 몸통 -->
  <path id="jar" d="M 122,96 L 278,96 L 278,240 C 278,250 270,258 260,258 L 140,258 C 130,258 122,250 122,240 Z" fill="${PALETTE.glass[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>

  <!-- 통 우하단 음영 (광원 좌상단 45°) -->
  <path id="jar-shade" d="M 266,100 L 272,100 L 272,240 C 272,246 267,252 261,252 L 146,252 L 152,246 L 259,246 C 263,246 266,243 266,239 Z" fill="${PALETTE.glass[1]}"/>

  <!-- 통 안의 콩. 숟갈로 퍼낼수록 줄어든다 -->
  <g id="beans">${beansMarkup(state)}</g>

  <!-- 라벨 -->
  <rect id="label" x="146" y="104" width="108" height="44" rx="4" fill="${PALETTE.paper[0]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  <line x1="146" y1="127" x2="254" y2="127" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  <g id="label-text">${labelTextContent(state.kind)}</g>

  <!-- 뚜껑 -->
  <g id="lid"${lid ? ` transform="${lid}"` : ''}>
    <rect x="114" y="64" width="172" height="34" rx="8" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <!-- 뚜껑 우하단 음영 -->
    <path d="M 262,68 L 278,68 C 281,68 283,70 283,73 L 283,88 C 283,92 280,94 277,94 L 150,94 L 156,88 L 275,88 C 277,88 278,87 278,85 L 278,73 Z" fill="${PALETTE.bodyDark[1]}"/>
    <line x1="120" y1="80" x2="280" y2="80" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
    <!-- 손잡이 -->
    <rect x="182" y="40" width="36" height="26" rx="8" fill="${PALETTE.bodyDark[0]}" stroke="${INK}" stroke-width="${STROKE.outline}" ${PATH_ATTRS}/>
    <path d="M 206,44 L 213,44 C 215,44 216,46 216,48 L 216,60 C 216,62 214,63 212,63 L 190,63 L 196,58 L 210,58 L 210,48 Z" fill="${PALETTE.bodyDark[1]}"/>
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 * 계약(contract.js)이 허용한 것만 건드린다 — #lid 의 transform, #beans·#label-text 의 children.
 */
export function applyState(root, state = {}) {
  const lid = root.querySelector('#lid');
  const t = lidTransform(state);
  if (t) lid.setAttribute('transform', t);
  else lid.removeAttribute('transform');

  root.querySelector('#beans').innerHTML = beansMarkup(state);
  root.querySelector('#label-text').innerHTML = labelTextContent(state.kind);
}
