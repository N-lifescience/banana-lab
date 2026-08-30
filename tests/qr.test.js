/**
 * QR 인코더 검증.
 *
 * ── 왜 이렇게까지 하나 ──────────────────────────────────────────────
 * 잘못 만든 QR 은 **잘 만든 것과 똑같이 생겼다.** 눈으로는 절대 못 잡고, 교실에 가서
 * 서른 명이 카메라를 들이대고 나서야 안다. 스캐너를 테스트에 넣을 수 없으니
 * **직접 되읽는다** — 격자에서 비트를 다시 뽑아 원문이 나오면 배치·마스킹·인터리브·
 * 오류정정이 모두 맞았다는 뜻이다.
 *
 * 되읽기 코드는 인코더와 **따로** 썼다. 같은 함수를 돌려 쓰면 같이 틀린 것을 못 잡는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQR, qrSVG } from '../packages/lab-kit/ui/qr.js';

/* ── 인코더와 독립적으로 다시 구현한 최소한의 되읽기 ─────────────── */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

const VERSIONS = {
  2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0],
};
const ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38] };
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 기능 패턴이 차지한 칸 표시 — 데이터를 읽을 때 건너뛸 자리. */
function functionMask(size, version) {
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r, c) => { if (r >= 0 && r < size && c >= 0 && c < size) f[r][c] = true; };
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(br + r, bc + c);
  }
  const ce = ALIGN[version];
  for (const r of ce) for (const c of ce) {
    if ((r === 6 && c === 6) || (r === 6 && c === ce.at(-1)) || (r === ce.at(-1) && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
  }
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  return f;
}

/** 형식 정보 15비트를 되읽어 (오류정정, 마스크)를 얻는다. */
function readFormat(m, size) {
  let bits = 0;
  const get = (r, c) => (m[r][c] ? 1 : 0);
  const seq = [];
  for (let i = 0; i <= 5; i++) seq.push(get(8, i));
  seq.push(get(8, 7), get(8, 8), get(7, 8));
  for (let i = 9; i <= 14; i++) seq.push(get(14 - i, 8));
  for (let i = 14; i >= 0; i--) bits = (bits << 1) | seq[i];
  const unmasked = bits ^ 0b101010000010010;
  return { ec: (unmasked >>> 13) & 0b11, mask: (unmasked >>> 10) & 0b111 };
}

/** 오류 정정 부호가 성립하는가 — 신드롬이 전부 0이어야 한다. */
function syndromesZero(block, ecCount) {
  for (let i = 0; i < ecCount; i++) {
    let s = 0;
    for (const b of block) s = mul(s, EXP[i]) ^ b;
    if (s !== 0) return false;
  }
  return true;
}

/** 격자 → 원문. */
function decodeQR({ size, version, modules }) {
  const { mask } = readFormat(modules, size);
  const fn = functionMask(size, version);

  const bits = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (fn[r][c]) continue;
        const v = modules[r][c] ? 1 : 0;
        bits.push(MASKS[mask](r, c) ? v ^ 1 : v);
      }
    }
    upward = !upward;
  }

  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    cw.push(v);
  }

  // 인터리브를 되돌린다
  const [ecPer, g1, d1, g2, d2] = VERSIONS[version];
  const sizes = [...new Array(g1).fill(d1), ...new Array(g2).fill(d2)];
  const blocks = sizes.map(() => []);
  let at = 0;
  for (let i = 0; i < Math.max(...sizes); i++) {
    for (let b = 0; b < blocks.length; b++) if (i < sizes[b]) blocks[b].push(cw[at++]);
  }
  const ecs = blocks.map(() => []);
  for (let i = 0; i < ecPer; i++) for (let b = 0; b < blocks.length; b++) ecs[b].push(cw[at++]);

  for (let b = 0; b < blocks.length; b++) {
    assert.ok(syndromesZero([...blocks[b], ...ecs[b]], ecPer),
      `블록 ${b} 의 오류 정정 부호가 성립하지 않습니다`);
  }

  const data = blocks.flat();
  assert.equal(data[0] >>> 4, 0b0100, '바이트 모드가 아닙니다');
  const len = ((data[0] & 0x0f) << 4) | (data[1] >>> 4);
  const bytes = [];
  for (let i = 0; i < len; i++) {
    bytes.push(((data[1 + i] & 0x0f) << 4) | (data[2 + i] >>> 4));
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

/* ------------------------------------------------------------------ */

/*
 * 되읽기만 보는 표본이라 내용은 아무거나 되지만, **실제로 QR 에 실릴 모양**을 쓴다 —
 * 교사가 나눠 주는 학생용 링크가 이 길이·문자 구성이다. 여기서 통과했다는 것이
 * 그 링크에 대해 통과했다는 뜻이어야 한다.
 *
 * 실험 이름은 **긴 것**으로 하나 둔다. 짧은 것만 표본으로 두면 길이가 늘 때
 * 판(version)이 커지는 자리를 한 번도 안 밟는다.
 */
const SAMPLES = [
  'https://virtual-biolab.vercel.app/cell-metabolism/banana?code=482013',
  'https://virtual-biolab.vercel.app/cell-metabolism/chromatography?code=100000&level=1',
  'HELLO',
  'https://example.com/?code=999999&mode=solo',
];

test('만든 QR 을 되읽으면 원문이 그대로 나온다', () => {
  for (const text of SAMPLES) {
    const qr = encodeQR(text);
    assert.equal(decodeQR(qr), text, `되읽기 실패: ${text}`);
  }
});

test('격자 크기와 위치 검출 패턴이 규격대로다', () => {
  const qr = encodeQR(SAMPLES[0]);
  assert.equal(qr.size, qr.version * 4 + 17);
  const m = qr.modules;
  for (const [br, bc] of [[0, 0], [0, qr.size - 7], [qr.size - 7, 0]]) {
    // 7×7 테두리는 검고, 그 안 5×5 테두리는 희고, 가운데 3×3 은 검다
    assert.equal(m[br][bc], true);
    assert.equal(m[br + 1][bc + 1], false);
    assert.equal(m[br + 3][bc + 3], true);
  }
  // 타이밍 패턴은 번갈아 나온다
  for (let i = 8; i < qr.size - 8; i++) assert.equal(m[6][i], i % 2 === 0, `타이밍 ${i}`);
});

test('형식 정보가 오류 정정 M 으로 읽힌다', () => {
  const qr = encodeQR(SAMPLES[0]);
  assert.equal(readFormat(qr.modules, qr.size).ec, 0b00, '오류 정정 수준이 M 이 아닙니다');
});

test('SVG 는 바깥 여백을 두고 자기 안에서 완결된다', () => {
  const svg = qrSVG(SAMPLES[0], { size: 200 });
  assert.match(svg, /^<svg /);
  assert.ok(!svg.includes('http://') || svg.includes('www.w3.org/2000/svg'));
  // 조용한 구역 4모듈 — 이게 없으면 스캐너가 경계를 못 찾는다
  const qr = encodeQR(SAMPLES[0]);
  assert.ok(svg.includes(`0 0 ${qr.size + 8} ${qr.size + 8}`), '조용한 구역이 4모듈이 아닙니다');
});

test('담을 수 없이 길면 조용히 틀린 것을 내지 않고 멈춘다', () => {
  assert.throws(() => encodeQR('x'.repeat(200)), /너무 깁니다/);
});
