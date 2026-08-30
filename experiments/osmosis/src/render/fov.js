/**
 * 현미경 시야 렌더러.
 *
 * 시야는 미리 그린 그림이 아니라 상태에서 매번 생성한다. 그래야 배율·초점·농도를 바꾼 결과가
 * 정직하게 반영되고, 결과 보드가 이미지 대신 시드만 저장할 수 있다.
 *
 * 요소의 위치와 모양은 그리는 순서가 아니라 **좌표의 순수 함수**다 (geometry.js 의 hash).
 * 그래서 재물대를 옮겨도 같은 세포는 같은 모양으로 남고, 보이는 범위만 생성하면 된다.
 *
 * ── 이 시야가 지켜야 하는 것 (AGENTS.md §2.5) ──────────────────────
 *   · **보라색 영역의 크기 = 원형질체의 크기.** 안토시아닌이 액포에 있기 때문이다
 *   · **세포벽은 그 자리에 그대로 있다.** 줄어드는 것은 원형질체뿐이다
 *   · 원형질체와 세포벽 사이의 틈은 **바깥 용액으로 차 있다** (세포벽은 전투과성)
 *   · **터지지 않는다.** 저장액에서는 세포벽까지 꽉 찰 뿐이다
 *   · 한 시야 안에서 **세포마다 정도가 갈린다** — 「절반이 원형질분리」 판정이 여기서 나온다
 *   · 안쪽 표피면 색이 거의 없다
 *
 * 주의: 아트 디렉션(라인+플랫)은 기구 애셋에만 적용된다. 시야는 광학 시뮬레이션이므로
 * 굵은 외곽선을 쓰지 않는다. 다만 액포색은 palette.experiment.js 를 공유한다.
 *
 * docs/05-fov-renderer.md 참조.
 */

import { EXP_PALETTE } from '../style/palette.experiment.js';
import { rng, hash, clamp } from '../assets/geometry.js';
import {
  cellLongPx, cellShortPx, wallPx, fieldDiameterUm,
} from '../sim/optics.js';
import { sapPct, protoplastRatio, protoplastAxes, PLASMOLYSIS_RATIO } from '../sim/osmosis.js';
import { PAN_LIMIT } from '../sim/state.js';

export const FOV = { size: 360, radius: 164, cx: 180, cy: 180 };

/** 배경 — 봉입액이 찬 시야는 밝고 살짝 따뜻하다 */
const BG = '#F4F1F3';
/** 마른 채로 덮인 시야 */
const BG_DRY = '#EDEAE2';

const WALL_LINE = 'rgba(96,80,92,.55)';
const WALL_FILL = 'rgba(255,255,255,.34)';
/** 원형질체가 물러난 자리 — 바깥 용액이 차 있다. 비어 있는 것이 아니다. */
const GAP_FILL = 'rgba(232,238,236,.55)';
const NUCLEUS = 'rgba(104,60,96,.55)';

const CRACK_LIGHT = 'rgba(255,255,255,.60)';
const CRACK_DARK = 'rgba(38,42,34,.50)';

/**
 * 세포 하나를 그릴 만큼 크게 보이는가.
 * 짧은 변이 이보다 얇으면 핵을 따로 그려도 점 하나로 뭉개진다 — 개수만 늘고 보이지 않는다.
 */
const NUCLEUS_MIN_PX = 9;

/**
 * 액포색은 두 단으로만 쓴다. 연속 보간하지 않는다.
 *
 * 수축하면 색소가 **같은 색으로 짙어진다.** 다른 색으로 바뀌면 학생이 「반응이 일어났다」로
 * 읽는데, 삼투는 반응이 아니다.
 */
function vacuoleTone(ratio) {
  return ratio < PLASMOLYSIS_RATIO ? EXP_PALETTE.vacuoleDeep : EXP_PALETTE.vacuole;
}

/**
 * @param {object} p  state.fieldParams() 의 결과
 * @param {{idPrefix?: string}} [opts]
 *   한 화면에 시야를 여러 개 그릴 때는 `idPrefix` 를 서로 다르게 줘야 한다.
 *   같은 문서에 같은 id 가 둘 이상 있으면 브라우저는 **먼저 나온 것 하나만** 쓴다 —
 *   결과 카드를 늘어놓으면 모든 카드가 첫 카드의 흐림을 쓰게 되어 **조용히 틀린다.**
 * @returns {string} SVG 문자열
 */
export function renderFOV(p, { idPrefix = '' } = {}) {
  const id = (name) => `${idPrefix}${name}`;
  const ref = (name) => `url(#${idPrefix}${name})`;
  const { size: FS, radius: R, cx: CX, cy: CY } = FOV;
  const seed = p.seed || 1;
  const r = rng(seed);
  const fieldPx = R * 2;

  /** 이 시야의 위치 해시. 세포마다의 값은 전부 여기서 나온다. */
  const h = (...ints) => hash(seed, ...ints);

  const long = cellLongPx(p.objective, fieldPx);
  const short = cellShortPx(p.objective, fieldPx);
  const wallW = clamp(wallPx(p.objective, fieldPx), 0.5, 5);
  const drawNucleus = short >= NUCLEUS_MIN_PX;

  // 안쪽 표피에는 안토시아닌이 없다. 세포벽 윤곽만 희미하게 보인다.
  const hasPigment = p.side !== 'inner';

  // 재물대 위치. 실제 현미경은 상이 뒤집혀 있어서 재물대를 오른쪽으로 밀면 상은 왼쪽으로 간다.
  const panX = p.panX || 0, panY = p.panY || 0;

  // 봉입액이 적신 범위. 두 방울(coverage 1)이면 덮개 유리 전체가 젖는다 —
  // 적신 반지름을 시야 반지름에 묶어 두면 시야를 옮겼을 때 젖은 곳이 사라진다.
  const wetX = CX - 44, wetY = CY + 22;
  const wetR = p.coverage >= 1
    ? Math.hypot(FS + PAN_LIMIT, FS + PAN_LIMIT)
    : (p.coverage ?? 0) * R * 1.6;

  /** 이 자리가 봉입액에 잠겼는가. 마른 곳의 세포는 삼투가 일어나지 않는다. */
  const wetAt = (x, y) => wetR > 0 && Math.hypot(x - wetX, y - wetY) < wetR;

  // 보이는 세계 좌표 창만 만든다. 생성 범위를 넓히면 저배율에서 요소가 몇 배로 늘어난다.
  const i0 = Math.floor(panX / long) - 1, i1 = Math.ceil((panX + FS) / long) + 1;
  const j0 = Math.floor(panY / short) - 1, j1 = Math.ceil((panY + FS) / short) + 1;

  // 표피세포는 줄지어 붙어 있다. 줄마다 이음매를 어긋나게 두어야 벽돌처럼 보인다.
  const rowShift = (j) => (h(7, 0, j) - 0.5) * long * 0.9;
  const cellX = (i, j) => i * long + rowShift(j);
  const cellY = (i, j) => j * short;

  /**
   * 색이 셋뿐(무색 / 액포 / 짙은 액포)이라 도형마다 fill 을 적지 않고 무리로 나눠
   * <g> 에 한 번만 적는다. 저배율에서 세포가 수천 개라 속성 하나가 만 번 넘게 늘어난다.
   */
  const bucket = { wall: '', plain: '', vac: '', deep: '', nuc: '', gap: '' };

  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const x = cellX(i, j), y = cellY(i, j);
      const w = long * 0.97, hgt = short * 0.94;
      const rx = (hgt * 0.28).toFixed(1);
      bucket.wall += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hgt.toFixed(1)}" rx="${rx}"/>`;

      // **세포벽은 위 사각형에서 끝난다. 아래는 전부 원형질체 이야기다.**
      // 세포벽까지 함께 줄이면 이 실험을 통째로 틀리게 가르친다.
      const wet = wetAt(x + w / 2, y + hgt / 2);
      const sap = sapPct(h, i, j);
      const ratio = wet ? protoplastRatio(p.equivPct ?? 0, sap) : 1;
      const ax = protoplastAxes(ratio);
      const pw = w * ax.long, ph = hgt * ax.short;
      const px = x + (w - pw) / 2, py = y + (hgt - ph) / 2;
      const prx = (ph * 0.42).toFixed(1);

      if (ratio < 1) {
        // 물러난 자리는 비어 있지 않다. 세포벽은 전투과성이라 **바깥 용액이 들어와 있다.**
        bucket.gap += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hgt.toFixed(1)}" rx="${rx}"/>`;
      }
      const shape = `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="${prx}"/>`;
      if (!hasPigment) bucket.plain += shape;
      else if (ratio < PLASMOLYSIS_RATIO) bucket.deep += shape;
      else bucket.vac += shape;

      if (drawNucleus) {
        const nx = px + pw * (0.28 + h(9, i, j) * 0.44);
        const ny = py + ph * 0.5;
        const nr = Math.min(ph * 0.3, long * 0.06);
        bucket.nuc += `<ellipse cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" rx="${(nr * 1.25).toFixed(1)}" ry="${nr.toFixed(1)}"/>`;
      }
    }
  }

  const group = (s, attrs) => (s ? `<g ${attrs}>${s}</g>` : '');
  let body = '';
  // 그리는 차례: 세포벽 → 틈(바깥 용액) → 원형질체 → 핵.
  body += group(bucket.wall, `fill="${WALL_FILL}" stroke="${WALL_LINE}" stroke-width="${wallW.toFixed(2)}"`);
  body += group(bucket.gap, `fill="${GAP_FILL}" stroke="none"`);
  body += group(bucket.plain, `fill="rgba(255,255,255,.42)" stroke="rgba(120,110,120,.30)" stroke-width="${Math.min(1, wallW * 0.5).toFixed(2)}"`);
  body += group(bucket.vac, `fill="${EXP_PALETTE.vacuole[0]}" stroke="${EXP_PALETTE.vacuole[1]}" stroke-width="${Math.min(1.2, wallW * 0.6).toFixed(2)}" opacity="0.82"`);
  body += group(bucket.deep, `fill="${EXP_PALETTE.vacuoleDeep[0]}" stroke="${EXP_PALETTE.vacuoleDeep[1]}" stroke-width="${Math.min(1.2, wallW * 0.6).toFixed(2)}" opacity="0.92"`);
  if (hasPigment) body += group(bucket.nuc, `fill="${NUCLEUS}" stroke="none"`);

  // 접힌 자리 — 세포가 한 겹 더 겹쳐 보인다. 시료에 붙은 것이라 시야와 함께 움직인다.
  let fold = '';
  if (p.folded) {
    const fy = panY + FS * 0.36;
    fold = `<g opacity="0.55" transform="translate(${(long * 0.31).toFixed(1)},${(short * 0.4).toFixed(1)})"`
      + ` clip-path="${ref('fov-fold')}">${body}</g>`
      + `<rect x="${panX}" y="${fy.toFixed(1)}" width="${FS}" height="${(FS * 0.2).toFixed(1)}" fill="rgba(120,100,110,.16)" clip-path="${ref('fov-fold')}"/>`;
  }

  // 기포
  let bubbles = '';
  for (let i = 0; i < (p.bubbles || 0); i++) {
    const bx = 40 + r() * (FS - 80), by = 40 + r() * (FS - 80), br = 22 + r() * 26;
    bubbles += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" fill="rgba(255,255,255,.30)" stroke="rgba(40,44,36,.55)" stroke-width="4"/>`;
  }

  // 금 간 슬라이드 — 가장자리에서 시작해 시야를 가로지르는 선 3~5개
  let cracks = '';
  if (p.cracked) {
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      let x = CX + Math.cos(a) * R, y = CY + Math.sin(a) * R;
      let dir = a + Math.PI + (r() - 0.5) * 0.9;
      const pts = [`${x.toFixed(1)},${y.toFixed(1)}`];
      for (let k = 0; k < 5; k++) {
        dir += (r() - 0.5) * 0.7;
        x += Math.cos(dir) * R * 0.46;
        y += Math.sin(dir) * R * 0.46;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const d = pts.join(' ');
      cracks += `<polyline points="${d}" fill="none" stroke="${CRACK_LIGHT}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<polyline points="${d}" fill="none" stroke="${CRACK_DARK}" stroke-width="0.9" stroke-linejoin="round"/>`;
    }
  }

  // 상은 재물대와 반대로 움직인다.
  // 기포와 금 간 선은 슬라이드에 붙은 것이라 함께 움직인다 — 렌즈에 붙은 얼룩만 고정이다.
  const scene = `<g id="${id('fov-scene')}" transform="translate(${(-panX).toFixed(1)},${(-panY).toFixed(1)})">${body}${fold}${bubbles}${cracks}</g>`;

  // 마른 곳 — 봉입액이 닿지 않은 자리는 뿌옇고 대비가 죽는다
  let dry = '';
  if ((p.coverage ?? 0) < 1) {
    dry = `<rect x="0" y="0" width="${FS}" height="${FS}" fill="${BG_DRY}" opacity="0.62"/>`
      + `<circle cx="${(wetX - panX).toFixed(1)}" cy="${(wetY - panY).toFixed(1)}" r="${wetR.toFixed(1)}" fill="${BG}"/>`;
  }

  // 액이 넘쳐 덮개 유리가 뜨면 상이 둘로 겹치고 전체가 뿌예진다
  let wash = '';
  if (p.excess > 0) {
    wash = `<rect x="0" y="0" width="${FS}" height="${FS}" fill="#C6CFC8" opacity="${(p.excess * 0.55).toFixed(2)}"/>`;
  }

  // 두꺼운 표피 — 세포가 여러 겹으로 겹쳐 빛이 잘 지나가지 못한다
  let thick = '';
  if (p.tooThick) {
    thick = `<g opacity="0.42" transform="translate(${(long * 0.24).toFixed(1)},${(short * 0.5).toFixed(1)})">${scene}</g>`
      + `<rect x="0" y="0" width="${FS}" height="${FS}" fill="#4B3A45" opacity="0.30"/>`;
  }

  // 렌즈가 시료에 닿았다면 시야가 밀리고 더러워진다
  let smudge = '';
  if (p.lensTouched) {
    smudge = `<ellipse cx="${(CX + 30).toFixed(0)}" cy="${(CY - 20).toFixed(0)}" rx="110" ry="70" fill="#6B5A3A" opacity="0.35"/>`;
  }

  const blur = (p.focusErr || 0) * 22 + (p.floating ? 2.4 : 0);
  const ghost = p.floating
    ? `<g transform="translate(8,6)" opacity="0.48" filter="${ref('fov-blur')}">${scene}</g>` : '';
  const dark = 1 - clamp(p.brightness ?? 1, 0, 1);

  return `<svg viewBox="0 0 ${FS} ${FS}" role="img" aria-label="현미경 시야">
  <defs>
    <clipPath id="${id('fov-clip')}"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
    <clipPath id="${id('fov-fold')}"><rect x="${panX}" y="${(panY + FS * 0.36).toFixed(1)}" width="${FS}" height="${(FS * 0.2).toFixed(1)}"/></clipPath>
    <filter id="${id('fov-blur')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter>
    <radialGradient id="${id('fov-vig')}"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>
  </defs>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="${BG}"/>
  <g clip-path="${ref('fov-clip')}">
    ${dry}
    <g filter="${ref('fov-blur')}">${scene}</g>
    ${ghost}${thick}${wash}${smudge}
    <rect id="${id('fov-dark')}" x="0" y="0" width="${FS}" height="${FS}" fill="#000" opacity="${(dark * 0.55).toFixed(2)}"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${ref('fov-vig')}"/>
  </g>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="4"/>
  <text x="${CX}" y="${FS - 6}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="rgba(0,0,0,.42)">시야 지름 약 ${Math.round(fieldDiameterUm(p.objective))} µm</text>
</svg>`;
}
