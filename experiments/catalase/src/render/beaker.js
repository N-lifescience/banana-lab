/**
 * 결과 렌더러 — 비커 안에서 원반이 떠오르는 그림.
 *
 * 이 실험의 결과는 색이 아니라 **시간 하나**다. 그래서 이 그림이 하는 일은
 * 「지금 어디까지 왔는가」를 보여 주는 것이다 — 원반의 높이와 붙은 기포 수.
 *
 * ── 순수 함수다 ────────────────────────────────────────────────────
 * 같은 입력이면 언제나 같은 SVG 문자열이 나온다. 난수는 `seed` 로만 들어온다
 * (`geometry.js` 의 `hash`). 그래야 결과를 이미지가 아니라 **값 한 벌로 저장해 두었다가**
 * 탐구 노트와 보고서에서 되살릴 수 있다.
 *
 * ── 물리를 여기서 계산하지 않는다 ──────────────────────────────────
 * 진행도와 거품 세기는 `src/sim/kinetics.js` 가 낸다. 여기서 다시 계산하면
 * 두 곳이 어긋나는 순간 **그림과 기록이 다른 말을 하게 된다.**
 *
 * ── idPrefix 를 처음부터 받는다 ────────────────────────────────────
 * 한 화면에 비커를 여러 개 그리는 순간(시행 비교·결과 보드) `id` 가 하드코딩이면
 * **에러 없이 조용히** 틀린다. 바나나랩에서 물린 자리라 미리 받아 둔다.
 *
 * 주의: 아트 디렉션(라인+플랫)은 **기구 애셋에만** 적용된다. 이 파일은 결과 그림이라
 * 반투명과 잔 선을 쓴다. 다만 색은 팔레트를 공유한다.
 *
 * docs/05-result-renderer.md 참조.
 */

import { PALETTE, INK } from '../style/tokens.js';
import { EXP_PALETTE } from '../style/palette.experiment.js';
import { hash, clamp } from '../assets/geometry.js';
import { riseProgress, preFizz, OBSERVE_LIMIT_S } from '../sim/kinetics.js';

/** 그림틀. 비커 안쪽의 좌표만 여기서 정한다 — 다른 곳에서 숫자를 다시 적지 않는다. */
export const VIEW = {
  w: 360, h: 400,
  // 비커 안쪽
  x0: 96, x1: 264,
  // 액면(위)과 바닥(아래)
  surfaceY: 118, floorY: 330,
};

const DISC_R = 21;

/** 원반이 놓이는 y. 진행도 0 이면 바닥, 1 이면 액면 바로 아래. */
export function discY(progress) {
  const top = VIEW.surfaceY + DISC_R + 4;
  const bottom = VIEW.floorY - DISC_R - 4;
  return bottom - (bottom - top) * clamp(progress, 0, 1);
}

/**
 * 원반에 붙은 기포의 수.
 *
 * 진행도에 **비례**한다 — 기포가 모여 부력이 무게를 넘는 순간 뜨는 것이므로,
 * 「떠오를 때 가장 많다」가 이 실험의 그림이 말해야 하는 것이다.
 * 하나도 안 붙었는데 떠오르면 학생은 왜 떴는지 그림에서 읽을 수 없다.
 */
export function bubbleCount(progress) {
  return Math.round(clamp(progress, 0, 1) * 9);
}

/** 원반에 붙은 기포. 좌표는 시드와 번호의 순수 함수라 틱마다 튀지 않는다. */
function clingingBubbles(progress, seed, cx, cy) {
  const n = bubbleCount(progress);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = hash(seed, 1, i) * Math.PI * 2;
    const r = DISC_R * (0.55 + hash(seed, 2, i) * 0.55);
    const rr = 2.6 + hash(seed, 3, i) * 3.2;
    const x = (cx + Math.cos(a) * r).toFixed(1);
    const y = (cy + Math.sin(a) * r * 0.75).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${rr.toFixed(1)}"`
      + ` fill="${EXP_PALETTE.bubble[0]}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>`;
  }
  return out;
}

/**
 * 원반을 넣기 **전부터** 비커 안에 이는 거품.
 *
 * 완충하지 않은 pH 11 에서 1.00 이 된다. **효소가 없는데 거품이 이는 것**을 학생이
 * 눈으로 먼저 만나야 「왜 pH 11 이 더 빨랐지?」를 스스로 묻는다.
 * 이걸 안 그리면 결과 숫자만 이상해 보이고 까닭은 화면 어디에도 없다.
 */
function fizzBubbles(strength, seed) {
  const n = Math.round(clamp(strength, 0, 1) * 22);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = VIEW.x0 + 10 + hash(seed, 4, i) * (VIEW.x1 - VIEW.x0 - 20);
    const y = VIEW.surfaceY + 12 + hash(seed, 5, i) * (VIEW.floorY - VIEW.surfaceY - 24);
    const r = 1.8 + hash(seed, 6, i) * 2.4;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"`
      + ` fill="${EXP_PALETTE.bubble[0]}" fill-opacity="0.85"/>`;
  }
  return out;
}

/** 수조. 온도 조건이 눈에 보여야 어느 시행의 그림인지 알 수 있다. */
function bath(tempC) {
  const marks = tempC <= 5
    ? [0, 1, 2, 3].map((i) => `<rect x="${44 + i * 74}" y="140" width="22" height="11" rx="2"`
        + ` fill="${EXP_PALETTE.ice[0]}" stroke="${INK}" stroke-opacity="0.4" stroke-width="1"/>`).join('')
    : tempC >= 90
      ? [56, 296].map((x) => `<path d="M ${x},140 c 12,-18 -12,-26 0,-46" fill="none"`
          + ` stroke="${INK}" stroke-opacity="0.4" stroke-width="2"/>`).join('')
      : '';
  return `<rect x="24" y="140" width="312" height="220" rx="6"`
    + ` fill="${EXP_PALETTE.bathWater[0]}" stroke="${INK}" stroke-width="2.5"/>`
    + `<rect x="286" y="140" width="50" height="220" rx="6" fill="${EXP_PALETTE.bathWater[1]}" stroke="none"/>`
    + marks
    + `<text x="180" y="384" font-size="19" font-weight="bold" text-anchor="middle" fill="${INK}">${tempC} ℃</text>`;
}

/**
 * @param {object} p
 * @param {object} p.conditions  `beakerConditions()` 가 낸 조건 한 벌
 * @param {number} p.elapsedS    원반을 넣고 흐른 시간 (초)
 * @param {boolean} p.hasDisc    원반이 비커에 들어 있는가
 * @param {number} p.seed
 * @param {{idPrefix?: string}} opts
 */
export function renderBeaker(p = {}, { idPrefix = 'bk' } = {}) {
  const conditions = p.conditions ?? {};
  const seed = p.seed ?? 0;
  const elapsedS = p.elapsedS ?? 0;
  const hasDisc = p.hasDisc ?? false;
  const id = (name) => `${idPrefix}-${name}`;

  const progress = hasDisc ? riseProgress(conditions, elapsedS) : 0;
  const fizz = conditions.h2o2Pct > 0 ? preFizz(conditions) : 0;
  const cy = discY(progress);
  const cx = (VIEW.x0 + VIEW.x1) / 2;
  const hasLiquid = (conditions.h2o2Pct ?? 0) > 0;

  // 원반 색은 애셋과 같은 규칙을 따른다 — 끓인 감자즙은 갈변한다.
  const discPair = !hasDisc ? PALETTE.paper
    : conditions.extractBoiled ? EXP_PALETTE.potatoBoiled
      : (conditions.extractPct ?? 0) > 0 ? EXP_PALETTE.discWet : PALETTE.paper;

  return `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" xmlns="http://www.w3.org/2000/svg"
  role="img" data-render="beaker" data-progress="${progress.toFixed(3)}">
  <g id="${id('bath')}">${bath(conditions.tempC ?? 20)}</g>

  <!-- 비커 -->
  <path id="${id('glass')}" d="M ${VIEW.x0 - 8},96 L ${VIEW.x0},${VIEW.floorY + 6}
    C ${VIEW.x0},${VIEW.floorY + 14} ${VIEW.x1},${VIEW.floorY + 14} ${VIEW.x1},${VIEW.floorY + 6}
    L ${VIEW.x1 + 8},96 Z"
    fill="${PALETTE.glass[0]}" fill-opacity="0.92" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>

  <!-- 과산화수소수 -->
  <g id="${id('liquid')}" opacity="${hasLiquid ? 1 : 0}">
    <rect x="${VIEW.x0}" y="${VIEW.surfaceY}"
      width="${VIEW.x1 - VIEW.x0}" height="${VIEW.floorY - VIEW.surfaceY}" fill="${EXP_PALETTE.h2o2[0]}"/>
    <!-- 우하단 음영. 액체가 유리보다 앞에 있다는 것을 이 띠 하나가 말한다 -->
    <rect x="${VIEW.x1 - 34}" y="${VIEW.surfaceY}" width="34"
      height="${VIEW.floorY - VIEW.surfaceY}" fill="${EXP_PALETTE.h2o2[1]}"/>
    <!-- 액면. 빈 비커와 가르는 가장 강한 단서다 -->
    <line x1="${VIEW.x0}" y1="${VIEW.surfaceY}" x2="${VIEW.x1}" y2="${VIEW.surfaceY}"
      stroke="${INK}" stroke-width="2.5" stroke-opacity="0.8"/>
  </g>

  <!-- 효소 없이 이는 거품. 원반을 넣기 전에도 보인다 -->
  <g id="${id('fizz')}">${fizzBubbles(fizz, seed)}</g>

  <!-- 원반 -->
  <g id="${id('disc')}" opacity="${hasDisc ? 1 : 0}">
    <ellipse cx="${cx}" cy="${cy.toFixed(1)}" rx="${DISC_R}" ry="${(DISC_R * 0.42).toFixed(1)}"
      fill="${discPair[0]}" stroke="${INK}" stroke-width="2"/>
    <path d="M ${cx},${(cy + DISC_R * 0.42).toFixed(1)} a ${DISC_R},${DISC_R * 0.42} 0 0 0 ${DISC_R},${-DISC_R * 0.42}"
      fill="${discPair[1]}" stroke="none"/>
    <g id="${id('cling')}">${clingingBubbles(progress, seed, cx, cy)}</g>
  </g>

  <!-- 비커 앞면 테두리를 한 번 더. 원반과 기포가 유리 위로 튀어나와 보이지 않게 -->
  <path d="M ${VIEW.x0},${VIEW.floorY + 6}
    C ${VIEW.x0},${VIEW.floorY + 14} ${VIEW.x1},${VIEW.floorY + 14} ${VIEW.x1},${VIEW.floorY + 6}"
    fill="none" stroke="${INK}" stroke-width="2.5"/>
</svg>`;
}

/**
 * 이 시행이 관찰 시간 안에 끝났는가 — 화면이 「기다리는 중」과 「안 뜸」을 갈라 말할 때 쓴다.
 * 안 뜬 시행에 **시간을 지어내지 않는다.**
 */
export function observationState(conditions, elapsedS, hasDisc) {
  if (!hasDisc) return 'idle';
  if (riseProgress(conditions, elapsedS) >= 1) return 'floated';
  return elapsedS >= OBSERVE_LIMIT_S ? 'not-floated' : 'running';
}
