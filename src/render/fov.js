/**
 * 현미경 시야 렌더러.
 *
 * 시야는 미리 그린 그림이 아니라 상태에서 매번 생성한다. 그래야 배율·초점·두께를 바꾼 결과가
 * 정직하게 반영되고, 결과 보드가 이미지 대신 시드만 저장할 수 있다.
 *
 * 주의: 아트 디렉션(라인+플랫)은 기구 애셋에만 적용된다. 시야는 광학 시뮬레이션이므로
 * 굵은 외곽선을 쓰지 않는다. 다만 염색색은 팔레트를 공유한다.
 *
 * docs/05-fov-renderer.md 참조.
 */

import { PALETTE } from '../style/tokens.js';
import { rng, clamp } from '../assets/geometry.js';
import {
  cellPx, granuleRadiusPx, lipidRadiusPx, canResolveGranules,
  lipidCount, fieldDiameterUm,
} from '../sim/optics.js';

export const FOV = { size: 360, radius: 164, cx: 180, cy: 180 };

const WALL = { IKI: 'rgba(150,120,60,.55)', SUDAN3: 'rgba(140,100,95,.45)', NONE: 'rgba(90,95,80,.40)' };
const CYTO = { IKI: 'rgba(246,236,205,.28)', SUDAN3: 'rgba(255,250,248,.22)', NONE: 'rgba(255,255,255,.18)' };
const BG   = { IKI: '#F6EFD8', SUDAN3: '#F7F1EE', NONE: '#F3F2EC' };

const PLAIN_FILL = 'rgba(255,255,255,.30)';
const PLAIN_LINE = 'rgba(62,66,56,.34)';

/**
 * 염색 강도는 보간하지 않고 세 단계로 양자화한다 (플랫 팔레트를 닫아 두기 위해).
 * 0 없음 · 1 옅음(전이 구간) · 2 완전
 */
function stainTone(kind, level) {
  if (level <= 0) return null;
  const key = kind === 'IKI'
    ? (level === 1 ? 'stainStarchPale' : 'stainStarch')
    : (level === 1 ? 'stainLipidPale' : 'stainLipid');
  return PALETTE[key];
}

/**
 * @param {object} p  state.fieldParams() 의 결과
 * @returns {string} SVG 문자열
 */
export function renderFOV(p) {
  const { size: FS, radius: R, cx: CX, cy: CY } = FOV;
  const r = rng(p.seed || 1);
  const fieldPx = R * 2;
  const isIKI = p.reagent === 'IKI';
  const isSU = p.reagent === 'SUDAN3';
  const key = p.reagent === 'IKI' ? 'IKI' : p.reagent === 'SUDAN3' ? 'SUDAN3' : 'NONE';

  const cell = cellPx(p.objective, fieldPx);
  const granR = granuleRadiusPx(p.objective, fieldPx);
  const lipR = lipidRadiusPx(p.objective, fieldPx);
  const resolve = canResolveGranules(p.objective, fieldPx);

  // 용액이 떨어진 자리와 퍼진 범위. coverage 가 1이면 시야 전체를 덮는다.
  const sfx = CX - 52, sfy = CY + 26, sfr = p.coverage * R * 1.6;
  // 전이 구간: 완전히 물든 안쪽과 무색인 바깥 사이
  const sfrInner = sfr * 0.72;

  const wall = WALL[key], cyto = CYTO[key];
  let defsExtra = '', body = '';

  const fullTone = stainTone(key, 2);
  const paleTone = stainTone(key, 1);

  if (resolve) {
    // 고배율 — 녹말립을 개별 객체로 그린다
    const cells = [];
    const span = Math.ceil(FS / cell) + 2;
    for (let i = -1; i < span; i++) {
      for (let j = -1; j < span; j++) {
        cells.push({ x: i * cell + (r() - 0.5) * cell * 0.16, y: j * cell + (r() - 0.5) * cell * 0.16 });
      }
    }
    for (const c of cells) {
      for (let i = 0; i < 20; i++) {
        const px = c.x + granR + r() * (cell * 0.94 - granR * 2);
        const py = c.y + granR + r() * (cell * 0.94 - granR * 2);
        const rx = granR * (0.82 + r() * 0.5), ry = rx / 1.58, rot = r() * 180;
        const d = Math.hypot(px - sfx, py - sfy);
        let fill = PLAIN_FILL, line = PLAIN_LINE;
        if (isIKI && d < sfr) {
          const tone = d < sfrInner ? fullTone : paleTone;
          fill = tone[0]; line = tone[1];
        }
        body += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"` +
          ` transform="rotate(${rot.toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})"` +
          ` fill="${fill}" stroke="${line}" stroke-width="1"/>`;
      }
    }
    for (const c of cells) {
      body += `<rect x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${(cell * 0.94).toFixed(1)}" height="${(cell * 0.94).toFixed(1)}"` +
        ` rx="${(cell * 0.13).toFixed(1)}" fill="${cyto}" stroke="${wall}" stroke-width="${Math.min(4, 1 + cell / 44).toFixed(1)}"/>`;
    }
  } else {
    // 저배율 — 녹말립이 분해되지 않으므로 텍스처로 대체한다. 성능 최적화가 아니라 사실이다.
    const T = Math.max(3.2, granR * 3.2);
    const sw = Math.min(0.7, granR * 0.3).toFixed(2);
    const tile = (f, l) =>
      `<ellipse cx="${(T * 0.30).toFixed(2)}" cy="${(T * 0.28).toFixed(2)}" rx="${granR.toFixed(2)}" ry="${(granR / 1.58).toFixed(2)}" transform="rotate(22 ${(T * 0.30).toFixed(2)} ${(T * 0.28).toFixed(2)})" fill="${f}" stroke="${l}" stroke-width="${sw}"/>` +
      `<ellipse cx="${(T * 0.78).toFixed(2)}" cy="${(T * 0.74).toFixed(2)}" rx="${(granR * 0.9).toFixed(2)}" ry="${(granR * 0.9 / 1.58).toFixed(2)}" transform="rotate(-38 ${(T * 0.78).toFixed(2)} ${(T * 0.74).toFixed(2)})" fill="${f}" stroke="${l}" stroke-width="${sw}"/>`;
    defsExtra =
      `<pattern id="gp-plain" width="${T.toFixed(2)}" height="${T.toFixed(2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">${tile(PLAIN_FILL, PLAIN_LINE)}</pattern>` +
      (isIKI ? `<pattern id="gp-stain" width="${T.toFixed(2)}" height="${T.toFixed(2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">${tile(fullTone[0], fullTone[1])}</pattern>` : '');
    body += `<rect x="0" y="0" width="${FS}" height="${FS}" fill="url(#gp-plain)"/>`;
    if (isIKI && sfr > 0) {
      body += `<circle cx="${sfx}" cy="${sfy}" r="${sfr.toFixed(1)}" fill="url(#gp-stain)"/>`;
      // 배율이 낮을수록 알갱이가 뭉쳐 하나의 색면으로 보인다
      body += `<circle cx="${sfx}" cy="${sfy}" r="${sfr.toFixed(1)}" fill="${fullTone[0]}" opacity="${(0.30 * Math.min(1, 20 / cell)).toFixed(2)}"/>`;
    }
    const span = Math.ceil(FS / cell) + 2;
    for (let i = -1; i < span; i++) {
      for (let j = -1; j < span; j++) {
        const x = i * cell + (r() - 0.5) * cell * 0.16, y = j * cell + (r() - 0.5) * cell * 0.16;
        body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cell * 0.94).toFixed(1)}" height="${(cell * 0.94).toFixed(1)}"` +
          ` rx="${(cell * 0.13).toFixed(1)}" fill="${cyto}" stroke="${wall}" stroke-width="${Math.max(0.5, Math.min(4, cell / 22)).toFixed(2)}"/>`;
      }
    }
  }

  // 지질 방울 — 개수는 시야 면적에 비례하는 고정 밀도. 절대 늘리지 말 것.
  const nLip = lipidCount(p.objective);
  for (let i = 0; i < nLip; i++) {
    const px = r() * FS, py = r() * FS, rr = Math.max(0.9, lipR * (0.7 + r() * 0.7));
    const d = Math.hypot(px - sfx, py - sfy);
    let fill = 'rgba(255,255,255,.38)', line = 'rgba(70,72,62,.34)';
    if (isSU && d < sfr) {
      const tone = d < sfrInner ? fullTone : paleTone;
      fill = tone[0]; line = tone[1];
    }
    body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rr.toFixed(1)}" fill="${fill}" stroke="${line}" stroke-width="${Math.min(1.2, Math.max(0.4, rr * 0.22)).toFixed(2)}"/>`;
    if (rr > 3.5) {
      body += `<circle cx="${(px - rr * 0.3).toFixed(1)}" cy="${(py - rr * 0.32).toFixed(1)}" r="${(rr * 0.26).toFixed(1)}" fill="#FFFFFF" opacity="0.4"/>`;
    }
  }

  // 교차 오염 — 두 색이 한 시야에 섞여 나타난다
  if (p.contaminated) {
    const other = isIKI ? PALETTE.stainLipid : PALETTE.stainStarch;
    for (let i = 0; i < 14; i++) {
      const px = r() * FS, py = r() * FS, rr = Math.max(1.4, granR * 0.7);
      body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rr.toFixed(1)}" fill="${other[0]}" opacity="0.75"/>`;
    }
  }

  // 기포
  let bubbles = '';
  for (let i = 0; i < (p.bubbles || 0); i++) {
    const bx = 40 + r() * (FS - 80), by = 40 + r() * (FS - 80), br = 22 + r() * 26;
    bubbles += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${br.toFixed(1)}" fill="rgba(255,255,255,.30)" stroke="rgba(40,44,36,.55)" stroke-width="4"/>`;
  }

  // 넘친 용액이 배경까지 물들인다
  let wash = '';
  if (p.excess > 0) {
    const c = isIKI ? '#C9A23C' : isSU ? '#D6394F' : '#B9B9A8';
    wash = `<rect x="0" y="0" width="${FS}" height="${FS}" fill="${c}" opacity="${(p.excess * (isIKI ? 0.40 : 0.30)).toFixed(2)}"/>`;
  }

  // 두껍게 바른 시료는 빛을 막는다
  let thick = '';
  if (p.tooThick) {
    thick = `<rect x="0" y="0" width="${FS}" height="${FS}" fill="#5A4526" opacity="0.45"/>`;
  }

  // 렌즈가 시료에 닿았다면 시야가 밀리고 더러워진다
  let smudge = '';
  if (p.lensTouched) {
    smudge = `<ellipse cx="${(CX + 30).toFixed(0)}" cy="${(CY - 20).toFixed(0)}" rx="110" ry="70" fill="#6B5A3A" opacity="0.35"/>`;
  }

  const blur = (p.focusErr || 0) * 22 + (p.floating ? 2.4 : 0);
  const ghost = p.floating
    ? `<g transform="translate(8,6)" opacity="0.48" filter="url(#fov-blur)">${body}</g>` : '';
  const dark = 1 - clamp(p.brightness ?? 1, 0, 1);

  return `<svg viewBox="0 0 ${FS} ${FS}" role="img" aria-label="현미경 시야">
  <defs>
    <clipPath id="fov-clip"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
    <filter id="fov-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter>
    <radialGradient id="fov-vig"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>
    ${defsExtra}
  </defs>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="${BG[key]}"/>
  <g clip-path="url(#fov-clip)">
    <g filter="url(#fov-blur)">${body}</g>
    ${ghost}${wash}${thick}${smudge}${bubbles}
    <rect x="0" y="0" width="${FS}" height="${FS}" fill="#000" opacity="${(dark * 0.55).toFixed(2)}"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#fov-vig)"/>
  </g>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="4"/>
  <text x="${CX}" y="${FS - 6}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="rgba(0,0,0,.42)">시야 지름 약 ${Math.round(fieldDiameterUm(p.objective))} µm</text>
</svg>`;
}
