/**
 * QR 코드를 그린다 — 버전 2~20, 오류 정정 M, 바이트 모드.
 *
 * ── 왜 직접 만드는가 ────────────────────────────────────────────────
 * 처음 담을 것은 참여 링크 하나(60자 안팎)뿐이었다. 그것 하나 때문에 의존성을 늘리지
 * 않았다 (AGENTS.md §3.3). 대신 **필요한 만큼만** 만든다 — 숫자·한자 모드도,
 * 다른 정정 수준도 넣지 않았다.
 *
 * T35(2026-09-05)에서 **버전 20 까지** 늘렸다. 모둠원의 탐구 노트를 QR 조각으로 모둠장
 * 기기에 옮기는데(`packages/lab-kit/group/codec.js`), 버전 7(122 B)로는 조각이 스무 장을
 * 넘어 폰이 따라 읽지 못했다. 버전 20 은 한 장에 666 B 다 — 압축한 노트가 두세 장에 든다.
 * 더 큰 버전은 폰 화면에서 모듈이 너무 잘아 오히려 안 읽힌다.
 * 버전 7 이상은 **버전 정보 18비트**가, 10 이상은 **16비트 길이 필드**가 붙는다 —
 * 둘 다 이때 넣었다 (앞서는 7 도 버전 정보 없이 그리고 있었다).
 * `tests/group-codec.test.js` 가 jsQR 로 **실제로 해독**해 본다.
 *
 * ── 안 읽히면 어쩌나 ────────────────────────────────────────────────
 * 교사 화면은 QR **과 함께 링크와 여섯 자리 코드를 늘 같이** 보여 준다. QR 은 편의이고,
 * 링크가 본체다. 카메라가 없는 학교 컴퓨터에서도 수업이 돌아가야 한다.
 *
 * 규격: ISO/IEC 18004. 용어를 규격 그대로 쓴다 (codeword, mask, format info).
 */

/* ── 갈루아 체 GF(256). 오류 정정 부호가 여기서 돈다. ───────────────── */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;        // 원시 다항식 x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** 생성 다항식 g(x) = (x-α^0)(x-α^1)…(x-α^(n-1)) */
function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    // 계수는 **높은 차수부터** 담는다. g(x)·x 는 자리를 그대로 두고(next[j]),
    // g(x)·α^i 는 한 칸 뒤로 간다(next[j+1]). 이 둘을 바꿔 쓰면 다항식이 뒤집혀
    // g[0] 이 1이 아니게 되고, 나눗셈이 조용히 엉뚱한 값을 낸다.
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** 데이터 코드워드에 대한 오류 정정 코드워드 n개. */
function ecCodewords(data, n) {
  const g = generator(n);
  const buf = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i];
    if (factor === 0) continue;
    for (let j = 0; j < g.length; j++) buf[i + j] ^= mul(g[j], factor);
  }
  return buf.slice(data.length);
}

/* ── 버전 표 (오류 정정 M 만). ──────────────────────────────────────
   [ 총 코드워드, 블록당 EC 코드워드, 그룹1 블록수, 그룹1 데이터수, 그룹2 블록수, 그룹2 데이터수 ] */
const VERSIONS = {
  2: [44, 16, 1, 28, 0, 0],
  3: [70, 26, 1, 44, 0, 0],
  4: [100, 18, 2, 32, 0, 0],
  5: [134, 24, 2, 43, 0, 0],
  6: [172, 16, 4, 27, 0, 0],
  7: [196, 18, 4, 31, 0, 0],
  8: [242, 22, 2, 38, 2, 39],
  9: [292, 22, 3, 36, 2, 37],
  10: [346, 26, 4, 43, 1, 44],
  11: [404, 30, 1, 50, 4, 51],
  12: [466, 22, 6, 36, 2, 37],
  13: [532, 22, 8, 37, 1, 38],
  14: [581, 24, 4, 40, 5, 41],
  15: [655, 24, 5, 41, 5, 42],
  16: [733, 28, 7, 45, 3, 46],
  17: [815, 28, 10, 46, 1, 47],
  18: [901, 26, 9, 43, 4, 44],
  19: [991, 26, 3, 44, 11, 45],
  20: [1085, 26, 3, 41, 13, 42],
};

/** 정렬 패턴 중심 좌표 (버전 2~20). */
const ALIGN = {
  2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38],
  8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58],
  13: [6, 34, 62], 14: [6, 26, 46, 66], 15: [6, 26, 48, 70], 16: [6, 26, 50, 74],
  17: [6, 30, 54, 78], 18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
};

/** 바이트 모드 길이 필드 — 버전 1~9 는 8비트, 10~26 은 16비트 (규격 표 3). */
const countBits = (v) => (v >= 10 ? 16 : 8);

/** 담을 수 있는 바이트 수 = 데이터 코드워드 − (모드 4비트 + 길이 필드)/8 */
export function capacityBytes(v) {
  const [, ecPer, g1, d1, g2, d2] = VERSIONS[v];
  const dataCw = g1 * d1 + g2 * d2;
  void ecPer;
  return Math.floor((dataCw * 8 - 4 - countBits(v)) / 8);
}

/** 가장 큰 버전이 담는 바이트 수 — 조각을 나누는 쪽이 이 값을 본다. */
export const MAX_QR_BYTES = capacityBytes(20);

/* ── 비트 버퍼 ─────────────────────────────────────────────────────── */
class Bits {
  constructor() { this.bits = []; }
  put(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length() { return this.bits.length; }
}

/**
 * 문자열을 데이터 코드워드로. 바이트 모드(0100) + 8비트 길이 + UTF-8 바이트.
 */
function encodeData(text, version) {
  const bytes = new TextEncoder().encode(text);
  const [, ecPer, g1, d1, g2, d2] = VERSIONS[version];
  const dataCw = g1 * d1 + g2 * d2;
  void ecPer;

  const b = new Bits();
  b.put(0b0100, 4);
  b.put(bytes.length, countBits(version));
  for (const byte of bytes) b.put(byte, 8);

  // 종단자 + 바이트 경계 맞추기
  const total = dataCw * 8;
  b.put(0, Math.min(4, total - b.length));
  while (b.length % 8) b.bits.push(0);

  const cw = [];
  for (let i = 0; i < b.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | b.bits[i + j];
    cw.push(v);
  }
  // 채움 코드워드는 규격이 정한 두 값을 번갈아 쓴다
  const PAD = [0xec, 0x11];
  for (let i = 0; cw.length < dataCw; i++) cw.push(PAD[i % 2]);
  return cw;
}

/** 블록으로 나눠 인터리브한 최종 코드워드 열. */
function interleave(dataCw, version) {
  const [, ecPer, g1, d1, g2, d2] = VERSIONS[version];
  const blocks = [];
  let at = 0;
  for (let i = 0; i < g1; i++) { blocks.push(dataCw.slice(at, at + d1)); at += d1; }
  for (let i = 0; i < g2; i++) { blocks.push(dataCw.slice(at, at + d2)); at += d2; }
  const ecs = blocks.map((blk) => ecCodewords(blk, ecPer));

  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPer; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

/* ── 모듈 배치 ─────────────────────────────────────────────────────── */

function placeFunctionPatterns(size, version) {
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) m[r][c] = v; };

  // 위치 검출 패턴 셋 + 분리자
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const on = r >= 0 && r <= 6 && c >= 0 && c <= 6
          && (r === 0 || r === 6 || c === 0 || c === 6
            || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(br + r, bc + c, on);
      }
    }
  }
  // 정렬 패턴 — 위치 검출 패턴과 겹치는 자리는 건너뛴다
  const centers = ALIGN[version];
  for (const r of centers) {
    for (const c of centers) {
      if ((r === 6 && c === 6) || (r === 6 && c === centers.at(-1))
        || (r === centers.at(-1) && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          set(r + dr, c + dc, on);
        }
      }
    }
  }
  // 타이밍 패턴
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
  }
  // 항상 검은 모듈 하나
  m[size - 8][8] = true;
  // 버전 정보 (7 이상) — 6비트 버전 + BCH(18,6). 오른쪽 위 6×3, 왼쪽 아래 3×6 에 같은 것을 둔다.
  // 마스크와 무관하므로 여기서 바로 놓는다. 없으면 7 이상은 폰이 아예 안 읽는다.
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = i % 3;
      m[a][size - 11 + b] = on;
      m[size - 11 + b][a] = on;
    }
  }
  return m;
}

/** 버전 정보 18비트 — 버전(6) + BCH(18,6), 생성 다항식 0x1F25. */
function versionBits(version) {
  let rem = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((rem >>> (i + 12)) & 1) rem ^= 0x1f25 << i;
  }
  return (version << 12) | rem;
}

/** 형식 정보 자리 — 데이터가 들어가면 안 되는 칸. */
function reserveFormat(m, size) {
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 형식 정보 15비트 — 오류 정정 M(=00) + 마스크 번호, BCH(15,5) + 마스크 0x5412. */
function formatBits(maskNo) {
  const data = (0b00 << 3) | maskNo;
  let bch = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((bch >>> (i + 10)) & 1) bch ^= 0b10100110111 << i;
  }
  return ((data << 10) | bch) ^ 0b101010000010010;
}

function placeFormat(m, size, maskNo) {
  const bits = formatBits(maskNo);
  /*
   * ★ 비트 14(MSB)가 (8,0) 에 온다 — 규격 그림 25.
   *
   * 앞서는 비트 0 부터 놓았다(뒤집힌 순서). 모듈 배치·오류 정정은 다 맞는데 **형식 정보만
   * 뒤집혀** 있어서, 어떤 폰도 이 QR 을 못 읽었다. 배포된 선생님 화면의 QR 이 그랬다 —
   * 「QR 은 편의이고 링크가 본체」라 아무도 못 알아챘다. T35 에서 jsQR 로 실제 해독해 보고
   * 잡았다 (`tests/group-codec.test.js` 가 이 자리를 지킨다).
   */
  const bit = (i) => ((bits >>> i) & 1) === 1;   // i 는 비트 번호. 14 가 MSB
  for (let i = 0; i <= 5; i++) m[8][i] = bit(14 - i);
  m[8][7] = bit(8);
  m[8][8] = bit(7);
  m[7][8] = bit(6);
  for (let r = 0; r <= 5; r++) m[r][8] = bit(r);

  for (let i = 0; i <= 6; i++) m[size - 1 - i][8] = bit(14 - i);
  for (let k = 0; k <= 7; k++) m[8][size - 8 + k] = bit(7 - k);
  m[size - 8][8] = true;
}

/** 규격의 네 가지 벌점. 낮을수록 잘 읽힌다. */
function penalty(m, size) {
  let score = 0;
  const at = (r, c) => m[r][c] === true;

  for (let i = 0; i < size; i++) {
    for (const line of [
      Array.from({ length: size }, (_, j) => at(i, j)),
      Array.from({ length: size }, (_, j) => at(j, i)),
    ]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
      // 1:1:3:1:1 무늬 — 위치 검출 패턴으로 오인되는 자리
      for (let j = 0; j + 7 <= size; j++) {
        const p = line.slice(j, j + 7).map(Boolean).join('');
        if (p === '1011101' && (j === 0 || !line[j - 1]) ) score += 40;
      }
    }
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (at(r, c)) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/**
 * 문자열 하나를 QR 모듈 격자로. `true` 가 검은 칸이다.
 * @returns {{size:number, modules:boolean[][], version:number}}
 */
export function encodeQR(text) {
  const version = Object.keys(VERSIONS)
    .map(Number).sort((a, b) => a - b)
    .find((v) => new TextEncoder().encode(text).length <= capacityBytes(v));
  if (!version) throw new Error(`QR 로 담기에 너무 깁니다: ${text.length}자`);

  const size = version * 4 + 17;
  const cw = interleave(encodeData(text, version), version);

  const base = placeFunctionPatterns(size, version);
  reserveFormat(base, size);

  // 데이터는 오른쪽 아래에서 두 칸 폭 세로줄을 지그재그로 거슬러 올라가며 채운다.
  const bitsOf = [];
  for (const byte of cw) for (let i = 7; i >= 0; i--) bitsOf.push((byte >>> i) & 1);

  let best = null;
  for (let maskNo = 0; maskNo < 8; maskNo++) {
    const m = base.map((row) => row.slice());
    let bi = 0;
    let upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5;            // 세로 타이밍 패턴 열은 건너뛴다
      for (let step = 0; step < size; step++) {
        const r = upward ? size - 1 - step : step;
        for (const c of [right, right - 1]) {
          if (m[r][c] !== null) continue;
          const bit = bi < bitsOf.length ? bitsOf[bi++] : 0;
          m[r][c] = (bit === 1) !== MASKS[maskNo](r, c) ? true : false;
        }
      }
      upward = !upward;
    }
    placeFormat(m, size, maskNo);
    const score = penalty(m, size);
    if (!best || score < best.score) best = { score, modules: m };
  }

  return { size, version, modules: best.modules.map((r) => r.map(Boolean)) };
}

/**
 * QR 을 SVG 문자열로. 사각형 하나로 배경을 깔고 검은 칸만 path 로 그린다 —
 * 모듈마다 rect 를 내면 노드가 1000개를 넘어 화면이 느려진다.
 */
export function qrSVG(text, { size = 220, quiet = 4, dark = '#111', light = '#fff' } = {}) {
  const { size: n, modules } = encodeQR(text);
  const total = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"
    width="${size}" height="${size}" shape-rendering="crispEdges" role="img">
    <rect width="${total}" height="${total}" fill="${light}"/>
    <path d="${d}" fill="${dark}"/>
  </svg>`;
}
