/**
 * T35 — 기록 → QR 조각 → 기록. **QR 은 jsQR 로 실제로 해독한다.**
 *
 * 앞서 `qr.js` 는 형식 정보 비트가 뒤집혀 있어서 어떤 폰도 못 읽었는데, 검사가 「그려진다」만
 * 봐서 몰랐다. 그리는 쪽과 읽는 쪽이 **다른 구현**이어야 잡힌다 — 그래서 jsQR 이다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { encodeQR, capacityBytes, MAX_QR_BYTES } from '../packages/lab-kit/ui/qr.js';
import { packRecord, createCollector, parseChunk, toBase64url, fromBase64url, CHUNK_BYTES } from '../packages/lab-kit/group/codec.js';

const jsQR = createRequire(import.meta.url)('jsqr');

/** 모듈 격자를 RGBA 화소로 — 카메라가 보는 것과 같은 것을 jsQR 에 준다. */
function raster(modules, n, scale = 5, quiet = 4) {
  const w = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!modules[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((r + quiet) * scale + dy) * w + (c + quiet) * scale + dx) * 4;
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
        }
      }
    }
  }
  return { data, w };
}

function decode(text) {
  const { size, modules } = encodeQR(text);
  const { data, w } = raster(modules, size);
  return jsQR(data, w, w)?.data ?? null;
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.';
const filler = (len, seed) => Array.from({ length: len }, (_, i) => ALPHA[(i * 7 + seed) % ALPHA.length]).join('');

/** 압축이 잘 안 되는 긴 한글 — 학생이 실제로 쓰는 글처럼 낱말이 바뀐다. */
function prose(words, seed = 1) {
  const W = ['청람색', '선홍색', '녹말립', '지방', '방울', '두', '방울을', '떨어뜨리고', '덮개', '유리를', '비스듬히',
    '덮었다', '기포가', '생겼다', '초점을', '맞추니', '알갱이가', '보였다', '대조군은', '변하지', '않았다', '시야가',
    '어두워', '조리개를', '열었다', '400배에서', '관찰했다', '바나나', '과육을', '얇게', '발랐다', '너무', '두꺼워서'];
  let x = seed;
  const out = [];
  for (let i = 0; i < words; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out.push(W[x % W.length]);
    if (x % 9 === 0) out[out.length - 1] += '.';
  }
  return out.join(' ');
}

test('QR 버전 2~20 을 jsQR 이 그대로 읽는다 — 꽉 채웠을 때와 반만 채웠을 때', () => {
  for (let v = 2; v <= 20; v++) {
    for (const len of [capacityBytes(v), Math.floor(capacityBytes(v) / 2)]) {
      const text = filler(len, v);
      assert.equal(decode(text), text, `버전 ${v}, ${len} B`);
    }
  }
});

test('선생님 화면의 참여 링크 QR 도 읽힌다 (되돌려 보기 — T35 전에는 못 읽었다)', () => {
  const link = 'https://virtual-biolab.vercel.app/cell-metabolism/banana?level=2&mode=group';
  assert.equal(decode(link), link);
});

test('한 조각은 가장 큰 QR 에 든다', () => {
  assert.ok(CHUNK_BYTES < MAX_QR_BYTES);
  assert.equal(MAX_QR_BYTES, capacityBytes(20));
});

test('base64url 왕복', () => {
  for (const n of [0, 1, 2, 3, 4, 31, 100]) {
    const bytes = new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255));
    assert.deepEqual([...fromBase64url(toBase64url(bytes))], [...bytes]);
  }
  assert.doesNotMatch(toBase64url(new Uint8Array([255, 254, 253, 251])), /[+/=]/);
});

const RECORD = {
  v: 1, exp: 'banana', nick: '초록이', group: '바나나조', level: 1,
  notes: {
    '1a': '바나나 껍질을 벗기고 과육을 조금 떼어 냈다.',
    '3b': '아이오딘–아이오딘화 칼륨 용액을 두 방울 떨어뜨리니 청람색으로 변했다. 녹말이 있다는 뜻이다.',
    'q.a': '(가)는 대조군이라 색이 안 변하고, (나)는 녹말 때문에 청람색, (다)는 지방 때문에 선홍색이 된다. '
      + '용액이 없으면 무엇이 있는지 눈으로 구별할 수 없어서 검출 용액을 쓴다.'.repeat(3),
    q2: '녹말립은 크고 빽빽했고 지질 방울은 작고 드물었다. 바나나에는 지방이 아주 적다.',
  },
  caps: [{ slide: 'B', objective: 40, score: 88 }, { slide: 'C', objective: 40, score: 61 }],
};

test('기록 → 조각 → 기록: 순서를 뒤집어 넣어도, 같은 조각을 두 번 넣어도 되돌아온다', async () => {
  const chunks = await packRecord(RECORD);
  assert.ok(chunks.length >= 1);
  for (const c of chunks) {
    const p = parseChunk(c);
    assert.ok(p, c.slice(0, 30));
    assert.ok(new TextEncoder().encode(c).length <= MAX_QR_BYTES, '조각이 QR 에 안 든다');
    assert.equal(decode(c), c, 'QR 로 그려 읽으면 같은 조각');
  }
  const col = createCollector();
  let last = null;
  for (const c of [...chunks].reverse()) last = await col.add(c);
  assert.equal(last.done, true);
  assert.deepEqual(last.record, RECORD);
  // 같은 조각을 또 넣으면 새 기록으로 다시 시작할 뿐 깨지지 않는다
  const again = await col.add(chunks[0]);
  assert.equal(again.done, chunks.length === 1);
});

test('긴 노트는 여러 조각이 되고, 조각 수는 압축 뒤 크기를 따른다', async () => {
  const long = { ...RECORD, notes: { ...RECORD.notes, q3: prose(300, 7) } };
  const chunks = await packRecord(long);
  assert.ok(chunks.length >= 2, `조각 ${chunks.length}`);
  const ids = new Set(chunks.map((c) => parseChunk(c).id));
  assert.equal(ids.size, 1);
  const col = createCollector();
  const r = await col.addText(chunks.join('\n'));
  assert.equal(r.done, true);
  assert.deepEqual(r.record, long);
});

test('조각이 아닌 것은 null — 링크·빈 줄·다른 판', async () => {
  const col = createCollector();
  assert.equal(await col.add('https://example.com'), null);
  assert.equal(await col.add(''), null);
  assert.equal(await col.add('VB9.abcdef.0.1.zAAAA'), null);
  assert.equal(parseChunk('VB1.abcdef.1.1.zAAAA'), null, 'i >= n');
});

test('두 사람의 조각이 섞여 들어와도 각각 모인다', async () => {
  const a = await packRecord({ ...RECORD, nick: 'A', notes: { q2: prose(300, 3) } });
  const b = await packRecord({ ...RECORD, nick: 'B', notes: { q2: prose(300, 5) } });
  assert.ok(a.length >= 2 && b.length >= 2);
  const col = createCollector();
  const mixed = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) mixed.push(a[i]);
    if (b[i]) mixed.push(b[i]);
  }
  const got = [];
  for (const c of mixed) {
    const r = await col.add(c);
    if (r?.done) got.push(r.record.nick);
  }
  assert.deepEqual(got.sort(), ['A', 'B']);
});
