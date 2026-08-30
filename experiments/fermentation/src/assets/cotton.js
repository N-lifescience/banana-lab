/**
 * 솜마개(cotton) 애셋 — 라인 + 플랫 구현.
 *
 * 발효관 입구에 꽂아 산소를 차단하는 솜마개를, 스테인리스 쟁반에 담아 둔 모습으로 그린다.
 *
 * 두 가지를 일부러 이렇게 했다.
 *
 *  1. **아래가 좁다.** `topR` > `botR` 인 것이 이 애셋의 요점이다. 좁은 쪽이 관에 들어간다는
 *     것이 설명 없이 읽혀야 한다.
 *  2. **윤곽이 울퉁불퉁하다.** 곧은 원기둥에 매끈한 타원을 얹으면 종이컵으로 읽힌다.
 *     실제로 한 번 그렇게 그려 봤고 영락없는 컵이었다. 옆선과 윗면을 불규칙하게 부풀려
 *     「눌러 뭉친 솜」으로 보이게 했다. 흔들림은 고정 배열이라 렌더할 때마다 같은 그림이다
 *     (docs/02-asset-contract.md 결정론 — `Math.random()` 금지).
 *
 * 상태가 없다 (contract.js 의 `states: []`). 몇 개 남았는지 세지 않으므로
 * applyState() 는 아무것도 하지 않는다. 계약을 지키기 위해 함수만 내보낸다.
 *
 * docs/01-art-direction.md · docs/02-asset-contract.md 규칙을 따른다.
 * 광원은 좌상단 45° 고정이라 음영 도형은 전부 형태의 우하단에 온다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS, paint } from '../style/tokens.js';
import { EXP_PALETTE, paintExp } from '../style/palette.experiment.js';

export const NODES = ['#tray', '#tray-shade', '#plugs'];

/** 솜마개 네 개의 배치. 앞에 놓인 것일수록 `botY` 가 크다 — 그렇게 깊이가 생긴다. */
const PLUGS = [
  { cx: 168, topY: 146, botY: 186, topR: 19, botR: 12, wob: 0 },  // 뒤 왼쪽
  { cx: 230, topY: 140, botY: 184, topR: 21, botR: 13, wob: 1 },  // 뒤 오른쪽 (가장 큼)
  { cx: 144, topY: 162, botY: 192, topR: 16, botR: 10, wob: 2 },  // 앞 왼쪽 (작게 뭉친 것)
  { cx: 196, topY: 154, botY: 200, topR: 22, botR: 14, wob: 3 },  // 앞 가운데
];

/**
 * 윗면 흔들림 표. 솜뭉치마다 다른 줄을 쓴다.
 *
 * 0번과 4번은 **반드시 1** 이다. 그 둘이 타원의 좌·우 끝점이고, 몸통 옆선이 거기서 시작하기
 * 때문이다. 1이 아니면 윗면과 몸통이 어긋나 옆구리에 혹이 튀어나온다.
 */
const CAP_WOBBLE = [
  [1, 1.07, 0.95, 1.06, 1, 0.94, 1.08, 0.96],
  [1, 0.95, 1.08, 0.96, 1, 1.06, 0.94, 1.07],
  [1, 1.05, 0.94, 1.08, 1, 0.96, 1.06, 0.95],
  [1, 0.96, 1.06, 0.94, 1, 1.07, 0.95, 1.08],
];

const n = (v) => +v.toFixed(1);

/** 점들을 지나는 매끄러운 닫힌 곡선. 중점을 이어 2차 베지에로 잇는 흔한 방법이다. */
function closedCurve(pts) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[pts.length - 1], pts[0]);
  let d = `M ${n(start[0])},${n(start[1])}`;
  for (let i = 0; i < pts.length; i++) {
    const m = mid(pts[i], pts[(i + 1) % pts.length]);
    d += ` Q ${n(pts[i][0])},${n(pts[i][1])} ${n(m[0])},${n(m[1])}`;
  }
  return `${d} Z`;
}

/** 솜뭉치 하나. 몸통 → 우하단 음영 → 윗면 → 섬유 자국 순으로 겹친다. */
function plug({ cx, topY, botY, topR, botR, wob }) {
  const h = botY - topY;
  const capR = topR * 0.36;                     // 윗면 타원의 세로 반지름
  const bulge = botR * 0.42;                    // 아랫면 앞쪽 불룩함
  const rAt = (t) => topR + (botR - topR) * t;  // 위에서 아래로 좁아지는 반지름
  const y = (t) => topY + h * t;
  const rA = rAt(0.36);
  const rB = rAt(0.70);
  const b = [4, 3, 5, 3.5][wob % 4];  // 옆구리가 부푼 정도. 뭉치마다 다르게 둔다

  // 옆선. 곧게 두지 않고 마디마다 조금씩 부풀린다 — 눌러 뭉친 재료라는 표시.
  const leftDown =
    `Q ${n(cx - topR - b)},${n(y(0.18))} ${n(cx - rA - 2)},${n(y(0.36))} ` +
    `Q ${n(cx - rA - b - 1)},${n(y(0.52))} ${n(cx - rB - 1)},${n(y(0.70))} ` +
    `Q ${n(cx - rB - b)},${n(y(0.86))} ${n(cx - botR)},${n(botY)}`;
  const rightUp =
    `Q ${n(cx + rB + b)},${n(y(0.86))} ${n(cx + rB + 1)},${n(y(0.70))} ` +
    `Q ${n(cx + rA + b + 1)},${n(y(0.52))} ${n(cx + rA + 2)},${n(y(0.36))} ` +
    `Q ${n(cx + topR + b)},${n(y(0.18))} ${n(cx + topR)},${n(topY)}`;

  // 몸통. 윗면 뒤쪽은 얕은 호로 닫는다 — 그 위를 윗면이 다시 덮으므로 밖으로 새면 안 된다.
  const body =
    `M ${n(cx - topR)},${n(topY)} ${leftDown} ` +
    `Q ${n(cx)},${n(botY + bulge)} ${n(cx + botR)},${n(botY)} ${rightUp} ` +
    `Q ${n(cx)},${n(topY - capR * 0.8)} ${n(cx - topR)},${n(topY)} Z`;

  // 우하단 음영. 오른쪽 옆선은 몸통과 같은 곡선을 다시 쓴다.
  // 안쪽 경계도 곧게 두지 않는다 — 수직으로 자르면 솜이 아니라 접힌 종이로 보인다.
  const shade =
    `M ${n(cx + topR * 0.2)},${n(topY + capR)} ` +
    `Q ${n(cx + topR * 0.04)},${n(y(0.3))} ${n(cx + topR * 0.16)},${n(y(0.48))} ` +
    `Q ${n(cx + botR * 0.32)},${n(y(0.72))} ${n(cx + botR * 0.16)},${n(botY + bulge * 0.85)} ` +
    `Q ${n(cx + botR * 0.7)},${n(botY + bulge * 0.6)} ${n(cx + botR)},${n(botY)} ${rightUp} Z`;

  // 윗면. 광원을 정면으로 받는 면이라 음영을 두지 않는다.
  const W = CAP_WOBBLE[wob % CAP_WOBBLE.length];
  const cap = closedCurve(
    W.map((w, i) => {
      const a = (i / W.length) * Math.PI * 2;
      return [cx + Math.cos(a) * topR * w, topY + Math.sin(a) * capR * w];
    })
  );

  // 섬유 자국. 두 가지를 피한다 — 테두리를 따라가면 컵 주둥이가 되고,
  // 서로 교차하면 꿰맨 X 자국이 된다. 나란한 물결로 긋는다.
  const fiber1 =
    `M ${n(cx - topR * 0.55)},${n(topY + capR * 0.1)} ` +
    `Q ${n(cx - topR * 0.18)},${n(topY - capR * 0.5)} ${n(cx + topR * 0.12)},${n(topY)} ` +
    `Q ${n(cx + topR * 0.34)},${n(topY + capR * 0.4)} ${n(cx + topR * 0.56)},${n(topY - capR * 0.1)}`;
  const fiber2 =
    `M ${n(cx - topR * 0.3)},${n(topY + capR * 0.62)} ` +
    `Q ${n(cx)},${n(topY + capR * 0.3)} ${n(cx + topR * 0.26)},${n(topY + capR * 0.55)}`;
  const hair = `fill="none" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}`;

  return `    <path d="${body}" ${paintExp('cotton')}/>
    <path d="${shade}" fill="${EXP_PALETTE.cotton[1]}"/>
    <path d="${cap}" ${paintExp('cotton')}/>
    <path d="${fiber1}" ${hair}/>
    <path d="${fiber2}" ${hair}/>`;
}

/**
 * 솜마개 접시 SVG 문자열 렌더링.
 *
 * @param {object} [state] 쓰지 않는다 — 이 애셋에는 상태가 없다.
 */
export function render(state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="cotton">
  <!-- 접지 그림자 — 애셋에서 허용되는 유일한 반투명 요소 -->
  <ellipse cx="204" cy="218" rx="96" ry="8" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 얕은 쟁반. 테두리 타원(ry 22)보다 바깥 벽을 깊게(224) 두어야 벽이 보인다 -->
  <g id="tray">
    <!-- 바깥 벽 -->
    <path d="M 102,192 C 102,209 148,224 200,224 C 252,224 298,209 298,192 Z" ${paint('metal')}/>
    <!-- 테두리 -->
    <ellipse cx="200" cy="192" rx="98" ry="22" ${paint('metal')}/>
    <!-- 안쪽 바닥 — 우묵한 곳이라 음영 단계로 채운다 -->
    <ellipse cx="200" cy="194" rx="84" ry="16" fill="${PALETTE.metal[1]}" stroke="${INK}" stroke-width="${STROKE.detail}" ${PATH_ATTRS}/>
  </g>

  <!-- 쟁반 우하단 음영 — 바깥 벽의 오른쪽 아래 띠.
       오른쪽 끝은 벽이 사라지는 점(298,192)에서 두 변이 만나게 해 단이 지지 않도록 하고,
       왼쪽 끝은 짧게 비스듬히 끊는다. 한가운데를 수직으로 자르면 칠하다 만 것처럼 보인다. -->
  <path id="tray-shade" d="M 185,223.7 C 191,223.9 196,224 200,224 C 252,224 298,209 298,192 C 292,202 250,211 196,214 Z" fill="${PALETTE.metal[1]}"/>

  <!-- 솜마개 — 위가 넓고 아래가 좁다. 좁은 쪽이 발효관에 들어간다 -->
  <g id="plugs">
${PLUGS.map(plug).join('\n')}
  </g>
</svg>`;
}

/**
 * 상태가 없는 애셋이라 갱신할 것이 없다.
 * 계약(`states: []`)을 지키기 위해 형태만 맞춰 내보낸다.
 */
export function applyState(root, state = {}) {
  // 의도적으로 비어 있다 — 솜마개는 개수를 세지 않는다.
}
