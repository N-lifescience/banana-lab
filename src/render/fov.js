/**
 * 현미경 시야 렌더러.
 *
 * 시야는 미리 그린 그림이 아니라 상태에서 매번 생성한다. 그래야 배율·초점·두께를 바꾼 결과가
 * 정직하게 반영되고, 결과 보드가 이미지 대신 시드만 저장할 수 있다.
 *
 * 요소의 위치와 모양은 그리는 순서가 아니라 **좌표의 순수 함수**다 (geometry.js 의 hash).
 * 그래서 재물대를 옮겨도 같은 셀은 같은 모양으로 남고, 보이는 범위만 생성하면 된다.
 *
 * 주의: 아트 디렉션(라인+플랫)은 기구 애셋에만 적용된다. 시야는 광학 시뮬레이션이므로
 * 굵은 외곽선을 쓰지 않는다. 다만 염색색은 팔레트를 공유한다.
 *
 * docs/05-fov-renderer.md 참조.
 */

import { PALETTE } from '../style/tokens.js';
import { rng, hash, clamp } from '../assets/geometry.js';
import {
  cellPx, granuleRadiusPx, lipidRadiusPx, canResolveGranules,
  lipidCount, fieldDiameterUm,
} from '../sim/optics.js';
import { PAN_LIMIT } from '../sim/state.js';

export const FOV = { size: 360, radius: 164, cx: 180, cy: 180 };

const WALL = { IKI: 'rgba(150,120,60,.55)', SUDAN3: 'rgba(140,100,95,.45)', NONE: 'rgba(90,95,80,.40)' };
const CYTO = { IKI: 'rgba(246,236,205,.28)', SUDAN3: 'rgba(255,250,248,.22)', NONE: 'rgba(255,255,255,.18)' };
const BG   = { IKI: '#F6EFD8', SUDAN3: '#F7F1EE', NONE: '#F3F2EC' };

const PLAIN_FILL = 'rgba(255,255,255,.30)';
const PLAIN_LINE = 'rgba(62,66,56,.34)';

const CRACK_LIGHT = 'rgba(255,255,255,.60)';
const CRACK_DARK  = 'rgba(38,42,34,.50)';

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
 * 반응 진행도를 염색 단계로 바꾼다. 연속 보간하지 않는다.
 * 0 아직 색이 오르지 않음 · 1 색이 오르는 중(시야가 통째로 옅다) · 2 다 올랐다(안쪽 완전 / 바깥 옅음)
 */
function reactionStage(reactionT) {
  const t = reactionT ?? 1;   // 값이 없으면 다 진행된 것으로 본다
  if (t <= 0) return 0;
  return t >= 1 ? 2 : 1;
}

/**
 * 재생성이 필요한 값과 아닌 값.
 *
 * 100배는 알갱이가 5780개라 한 번 만드는 데 브라우저까지 합쳐 60 ms 넘게 든다.
 * 슬라이더를 끄는 동안 매 프레임 이걸 다시 만들면 안 된다.
 * 아래 셋은 이미 있는 노드의 속성만 바꾸면 되므로 `renderFOV` 를 다시 부르지 마라.
 *
 *   시야 이동  →  #fov-scene 의 transform = translate(-panX, -panY)
 *   초점       →  #fov-blur 의 stdDeviation
 *   광량       →  #fov-dark 의 opacity
 *
 * 나머지(시약·방울·배율·반응·오염·기포·파손·시드)는 그림 자체가 달라지므로 다시 만든다.
 * 대신 이것들은 드래그가 아니라 한 번씩 일어나는 조작이라 60 ms 를 치러도 된다.
 *
 * @param {object} p  state.fieldParams() 의 결과
 * @returns {string} SVG 문자열
 */
export function renderFOV(p) {
  const { size: FS, radius: R, cx: CX, cy: CY } = FOV;
  const seed = p.seed || 1;
  const r = rng(seed);
  const fieldPx = R * 2;
  const isIKI = p.reagent === 'IKI';
  const isSU = p.reagent === 'SUDAN3';
  const key = p.reagent === 'IKI' ? 'IKI' : p.reagent === 'SUDAN3' ? 'SUDAN3' : 'NONE';

  const cell = cellPx(p.objective, fieldPx);
  const granR = granuleRadiusPx(p.objective, fieldPx);
  const lipR = lipidRadiusPx(p.objective, fieldPx);
  const resolve = canResolveGranules(p.objective, fieldPx);

  // 재물대 위치. 실제 현미경은 상이 뒤집혀 있어서 재물대를 오른쪽으로 밀면 상은 왼쪽으로 간다.
  // 그래서 내용은 -pan 만큼 옮겨 그리고, 보이는 세계 좌표 창은 +pan 쪽으로 열린다.
  const panX = p.panX || 0, panY = p.panY || 0;

  // 용액이 떨어진 자리와 퍼진 범위. 슬라이드에 붙어 있으므로 세계 좌표다 — 시야와 함께 움직인다.
  //
  // 두 방울(coverage 1)이면 덮개 유리 전체가 젖는다. 400배에서 이동 범위 ±240 px 는
  // 약 ±0.33 mm 인데 덮개 유리는 22 mm 라, 옮겨 갈 수 있는 어디든 물들어 있어야 한다.
  // 적신 반지름을 시야 반지름에 묶어 두면 시야를 옮겼을 때 염색이 사라져
  // docs/04 의 "2방울 → 시야 전체가 고르게 염색" 이 깨진다.
  // 한 방울(coverage 0.5)은 반대로 시야만 한 자국이라야 경계가 보인다.
  const sfx = CX - 52, sfy = CY + 26;
  const sfr = p.coverage >= 1
    ? Math.hypot(FS + PAN_LIMIT, FS + PAN_LIMIT)   // 볼 수 있는 세계의 대각선
    : p.coverage * R * 1.6;
  // 전이 구간: 완전히 물든 안쪽과 무색인 바깥 사이
  const sfrInner = sfr * 0.72;

  const wall = WALL[key], cyto = CYTO[key];
  let defsExtra = '', body = '';

  const stage = reactionStage(p.reactionT);
  const fullTone = stainTone(key, 2);
  const paleTone = stainTone(key, 1);
  // 진행 중이면 시야 전체가 옅은 한 단계뿐이다. 다 올랐으면 안쪽만 완전해진다.
  const stainTop = stage === 2 ? fullTone : paleTone;

  /** 이 지점의 염색 색. 물들지 않았으면 null. */
  const toneAt = (x, y) => {
    if (stage === 0 || sfr <= 0) return null;
    const d = Math.hypot(x - sfx, y - sfy);
    if (d >= sfr) return null;
    if (stage === 1) return paleTone;
    return d < sfrInner ? fullTone : paleTone;
  };

  // 보이는 세계 좌표 창 [pan, pan + FS] 을 덮는 셀 인덱스만 만든다.
  // 생성 범위를 통째로 넓히면 총 100배에서 요소가 몇 배로 늘어 성능이 무너진다.
  const i0 = Math.floor(panX / cell) - 1, i1 = Math.ceil((panX + FS) / cell) + 1;
  const j0 = Math.floor(panY / cell) - 1, j1 = Math.ceil((panY + FS) / cell) + 1;
  const cellX = (i, j) => i * cell + (hash(seed, 1, i, j) - 0.5) * cell * 0.16;
  const cellY = (i, j) => j * cell + (hash(seed, 2, i, j) - 0.5) * cell * 0.16;

  // 세포벽도 색이 하나뿐이라 <g> 에 한 번만 적는다. 도형에는 좌표만 남긴다.
  const cellW = (cell * 0.94).toFixed(1), cellRx = (cell * 0.13).toFixed(1);
  const wallRect = (x, y) =>
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW}" height="${cellW}" rx="${cellRx}"/>`;
  const wallGroup = (s, sw) => s
    ? `<g fill="${cyto}" stroke="${wall}" stroke-width="${sw}">${s}</g>` : '';

  if (resolve) {
    // 고배율 — 녹말립을 개별 객체로 그린다.
    //
    // 색은 셋 중 하나뿐이므로(무색 / 옅음 / 완전) 알갱이마다 fill·stroke 를 적지 않고
    // 세 무리로 나눠 <g> 에 한 번만 적는다. 100배에서 알갱이가 5780개라
    // 속성 하나가 만 번 넘게 늘어나고, 브라우저 파싱 시간이 15 ms 쯤 붙는다.
    const bucket = { plain: '', pale: '', full: '' };
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const cx0 = cellX(i, j), cy0 = cellY(i, j);
        for (let k = 0; k < 20; k++) {
          const px = cx0 + granR + hash(seed, 3, i, j, k) * (cell * 0.94 - granR * 2);
          const py = cy0 + granR + hash(seed, 4, i, j, k) * (cell * 0.94 - granR * 2);
          const rx = granR * (0.82 + hash(seed, 5, i, j, k) * 0.5), ry = rx / 1.58;
          const rot = hash(seed, 6, i, j, k) * 180;
          const tone = isIKI ? toneAt(px, py) : null;
          const X = px.toFixed(1), Y = py.toFixed(1);
          const shape = `<ellipse cx="${X}" cy="${Y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"` +
            ` transform="rotate(${rot.toFixed(0)} ${X} ${Y})"/>`;
          if (!tone) bucket.plain += shape;
          else if (tone === fullTone) bucket.full += shape;
          else bucket.pale += shape;
        }
      }
    }
    const grain = (s, tone) => s
      ? `<g fill="${tone[0]}" stroke="${tone[1]}" stroke-width="1">${s}</g>` : '';
    body += grain(bucket.plain, [PLAIN_FILL, PLAIN_LINE]) +
      (paleTone ? grain(bucket.pale, paleTone) : '') +
      (fullTone ? grain(bucket.full, fullTone) : '');

    let walls = '';
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        walls += wallRect(cellX(i, j), cellY(i, j));
      }
    }
    body += wallGroup(walls, Math.min(4, 1 + cell / 44).toFixed(1));
  } else {
    // 저배율 — 녹말립이 분해되지 않으므로 텍스처로 대체한다. 성능 최적화가 아니라 사실이다.
    const T = Math.max(3.2, granR * 3.2);
    const psw = Math.min(0.7, granR * 0.3).toFixed(2);
    const tile = (f, l) =>
      `<ellipse cx="${(T * 0.30).toFixed(2)}" cy="${(T * 0.28).toFixed(2)}" rx="${granR.toFixed(2)}" ry="${(granR / 1.58).toFixed(2)}" transform="rotate(22 ${(T * 0.30).toFixed(2)} ${(T * 0.28).toFixed(2)})" fill="${f}" stroke="${l}" stroke-width="${psw}"/>` +
      `<ellipse cx="${(T * 0.78).toFixed(2)}" cy="${(T * 0.74).toFixed(2)}" rx="${(granR * 0.9).toFixed(2)}" ry="${(granR * 0.9 / 1.58).toFixed(2)}" transform="rotate(-38 ${(T * 0.78).toFixed(2)} ${(T * 0.74).toFixed(2)})" fill="${f}" stroke="${l}" stroke-width="${psw}"/>`;
    const stained = isIKI && stage > 0 && sfr > 0;
    defsExtra =
      `<pattern id="gp-plain" width="${T.toFixed(2)}" height="${T.toFixed(2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">${tile(PLAIN_FILL, PLAIN_LINE)}</pattern>` +
      (stained ? `<pattern id="gp-stain" width="${T.toFixed(2)}" height="${T.toFixed(2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">${tile(stainTop[0], stainTop[1])}</pattern>` : '');
    // 배경 텍스처는 보이는 창만 덮는다. 패턴이 userSpaceOnUse 라 창을 옮겨도 무늬가 이어진다.
    body += `<rect x="${panX.toFixed(1)}" y="${panY.toFixed(1)}" width="${FS}" height="${FS}" fill="url(#gp-plain)"/>`;
    if (stained) {
      body += `<circle cx="${sfx}" cy="${sfy}" r="${sfr.toFixed(1)}" fill="url(#gp-stain)"/>`;
      // 배율이 낮을수록 알갱이가 뭉쳐 하나의 색면으로 보인다
      body += `<circle cx="${sfx}" cy="${sfy}" r="${sfr.toFixed(1)}" fill="${stainTop[0]}" opacity="${(0.30 * Math.min(1, 20 / cell)).toFixed(2)}"/>`;
    }
    let walls = '';
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        walls += wallRect(cellX(i, j), cellY(i, j));
      }
    }
    body += wallGroup(walls, Math.max(0.5, Math.min(4, cell / 22)).toFixed(2));
  }

  /**
   * 흩뿌린 요소를 세계 좌표에 채운다.
   * 한 변 FS 짜리 타일마다 n 개씩 두므로, 시야를 어디로 옮겨도 밀도가 정확히 같다.
   * 지질 방울 개수를 이 방식으로 늘리지 말 것 — 바나나 지방 함량은 0.3 % 다.
   */
  const scatter = (channel, n, draw) => {
    const m0 = Math.floor(panX / FS), m1 = Math.ceil((panX + FS) / FS) - 1;
    const n0 = Math.floor(panY / FS), n1 = Math.ceil((panY + FS) / FS) - 1;
    // 창 밖은 버린다. 여유를 두지 않아도 된다 — 시야 원이 이 사각형보다 16 px 안쪽이라
    // 경계에 걸친 도형은 어차피 보이지 않는다. 덕분에 창 안 개수가 정확히 n 으로 유지된다.
    for (let m = m0; m <= m1; m++) {
      for (let q = n0; q <= n1; q++) {
        for (let k = 0; k < n; k++) {
          const px = (m + hash(seed, channel, m, q, k)) * FS;
          if (px < panX || px >= panX + FS) continue;
          const py = (q + hash(seed, channel + 1, m, q, k)) * FS;
          if (py < panY || py >= panY + FS) continue;
          draw(px, py, hash(seed, channel + 2, m, q, k));
        }
      }
    }
  };

  // 지질 방울 — 개수는 시야 면적에 비례하는 고정 밀도. 절대 늘리지 말 것.
  scatter(10, lipidCount(p.objective), (px, py, h) => {
    const rr = Math.max(0.9, lipR * (0.7 + h * 0.7));
    const tone = isSU ? toneAt(px, py) : null;
    const fill = tone ? tone[0] : 'rgba(255,255,255,.38)';
    const line = tone ? tone[1] : 'rgba(70,72,62,.34)';
    body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rr.toFixed(1)}" fill="${fill}" stroke="${line}" stroke-width="${Math.min(1.2, Math.max(0.4, rr * 0.22)).toFixed(2)}"/>`;
    if (rr > 3.5) {
      body += `<circle cx="${(px - rr * 0.3).toFixed(1)}" cy="${(py - rr * 0.32).toFixed(1)}" r="${(rr * 0.26).toFixed(1)}" fill="#FFFFFF" opacity="0.4"/>`;
    }
  });

  // 교차 오염 — 두 색이 한 시야에 섞여 나타난다
  if (p.contaminated) {
    const other = isIKI ? PALETTE.stainLipid : PALETTE.stainStarch;
    const rr = Math.max(1.4, granR * 0.7);
    scatter(20, 14, (px, py) => {
      body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${rr.toFixed(1)}" fill="${other[0]}" opacity="0.75"/>`;
    });
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
      cracks += `<polyline points="${d}" fill="none" stroke="${CRACK_LIGHT}" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<polyline points="${d}" fill="none" stroke="${CRACK_DARK}" stroke-width="0.9" stroke-linejoin="round"/>`;
    }
  }

  // 상은 재물대와 반대로 움직인다.
  // 기포와 금 간 선은 슬라이드에 붙은 것이라 함께 움직인다 — 렌즈에 붙은 얼룩(smudge)만 고정이다.
  // 여기서 갈라 두지 않으면 기포가 접안렌즈에 붙어 있는 것처럼 보인다.
  const scene = `<g id="fov-scene" transform="translate(${(-panX).toFixed(1)},${(-panY).toFixed(1)})">${body}${bubbles}${cracks}</g>`;

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
    ? `<g transform="translate(8,6)" opacity="0.48" filter="url(#fov-blur)">${scene}</g>` : '';
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
    <g filter="url(#fov-blur)">${scene}</g>
    ${ghost}${wash}${thick}${smudge}
    <rect id="fov-dark" x="0" y="0" width="${FS}" height="${FS}" fill="#000" opacity="${(dark * 0.55).toFixed(2)}"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#fov-vig)"/>
  </g>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="4"/>
  <text x="${CX}" y="${FS - 6}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="rgba(0,0,0,.42)">시야 지름 약 ${Math.round(fieldDiameterUm(p.objective))} µm</text>
</svg>`;
}
