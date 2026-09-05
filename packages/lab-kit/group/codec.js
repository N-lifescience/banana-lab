/**
 * 모둠원의 기록을 QR 조각으로, QR 조각을 다시 기록으로.
 *
 * ── 왜 조각인가 ──────────────────────────────────────────────────────
 * 탐구 노트 하나는 압축해도 1~2 KB 다. QR 한 장(버전 20, `MAX_QR_BYTES` = 666 B)에 안 든다.
 * 그래서 **여러 장으로 나눠** 모둠원 화면에서 자동으로 넘기고, 모둠장 기기는 읽히는 대로
 * 주워 담는다. 순서는 상관없다 — 조각마다 번호가 붙어 있다.
 *
 * 조각 하나의 모양 (전부 ASCII — QR 바이트 모드에서 한글보다 세 배 싸다):
 *
 *     VB1.<id>.<i>.<n>.<data>
 *       VB1   판. 모양이 바뀌면 올린다
 *       id    기록 하나의 꼬리표(6자). 같은 id 의 조각만 한 기록으로 모은다
 *       i, n  이 조각의 번호(0부터) / 조각 수
 *       data  (z|r) + deflate-raw → base64url 한 것의 i 번째 토막. z 는 압축, r 은 날것 —
 *             이 글자는 **첫 조각에만** 붙는다 (몸통의 첫 글자라서)
 *
 * ── 서버 없음 ────────────────────────────────────────────────────────
 * 이 파일은 네트워크를 모른다. 기록은 화면(QR)이나 클립보드(코드 복사)로만 나간다.
 * `docs/…/privacy.html` 제1조가 말하는 「그 브라우저의 메모리에만」이 모둠장 기기까지
 * 넓어질 뿐이고, 그 사이에 서버는 없다.
 *
 * ── 순수하다 ────────────────────────────────────────────────────────
 * DOM 을 모른다. `CompressionStream` 은 브라우저와 Node 20 에 다 있어서 `node --test` 로 돈다.
 */

import { MAX_QR_BYTES } from '../ui/qr.js';

export const FORMAT = 'VB1';

/**
 * 조각 하나의 데이터 토막 길이.
 *
 * 버전 20(666 B) 꽉 채우면 한 변이 97칸이라 폰 화면에 띄운 것을 다른 폰이 잘 못 읽는다 —
 * 칸 하나가 화면 픽셀 서너 개다. **버전 14(365 B, 73칸) 안에 들게** 자른다. 장수는 늘지만
 * 자동으로 넘어가므로 학생이 할 일은 없고, 한 장 한 장은 훨씬 잘 읽힌다.
 * 머리(`VB1.xxxxxx.99.99.` ≤ 20자)를 뺀 값이다.
 */
export const CHUNK_BYTES = 340;

/* ── base64url ─────────────────────────────────────────────────────── */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >>> 6) & 63] : '';
    out += i + 2 < bytes.length ? B64[n & 63] : '';
  }
  return out;
}

export function fromBase64url(text) {
  const idx = new Map([...B64].map((ch, i) => [ch, i]));
  const bytes = [];
  let buf = 0;
  let bits = 0;
  for (const ch of text) {
    const v = idx.get(ch);
    if (v === undefined) throw new Error(`base64url 이 아닙니다: ${ch}`);
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >>> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

/* ── 압축 ──────────────────────────────────────────────────────────── */

async function pump(stream, bytes) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const parts = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const hasZip = () => typeof CompressionStream === 'function';

/**
 * 기록(아무 JSON) → 조각 문자열 배열.
 * 압축기가 없는 옛 브라우저면 압축 없이(`z:0`) 나간다 — 조각이 늘 뿐 못 보내지는 않는다.
 */
export async function packRecord(record, { chunkBytes = CHUNK_BYTES } = {}) {
  const json = new TextEncoder().encode(JSON.stringify(record));
  const zipped = hasZip() ? await pump(new CompressionStream('deflate-raw'), json) : json;
  const body = (hasZip() ? 'z' : 'r') + toBase64url(zipped);
  const id = recordId(json);
  const n = Math.max(1, Math.ceil(body.length / chunkBytes));
  const chunks = [];
  for (let i = 0; i < n; i++) {
    chunks.push(`${FORMAT}.${id}.${i}.${n}.${body.slice(i * chunkBytes, (i + 1) * chunkBytes)}`);
  }
  return chunks;
}

/** 기록의 꼬리표 — 내용에서 나온 6자. 같은 기록을 두 번 보내도 같은 꼬리표라 두 번 안 쌓인다. */
function recordId(bytes) {
  let h = 2166136261;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  return toBase64url(new Uint8Array([h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255])).slice(0, 6);
}

/** 조각 문자열 하나를 읽는다. 조각이 아니면 null. */
export function parseChunk(text) {
  const m = /^VB1\.([A-Za-z0-9_-]{6})\.(\d+)\.(\d+)\.([A-Za-z0-9_-]*)$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const i = Number(m[2]);
  const n = Number(m[3]);
  if (!(n >= 1 && i >= 0 && i < n)) return null;
  return { id: m[1], i, n, data: m[4] };
}

async function unpackBody(body) {
  const mode = body[0];
  const bytes = fromBase64url(body.slice(1));
  const json = mode === 'z' ? await pump(new DecompressionStream('deflate-raw'), bytes) : bytes;
  return JSON.parse(new TextDecoder().decode(json));
}

/**
 * 조각을 모아 기록으로 되돌린다. 카메라가 읽는 대로, 붙여 넣는 대로 `add()` 에 넣으면 된다.
 *
 *   add(text) → { id, got, total, done, record? }   조각이 아니면 null
 *
 * 여러 기록이 섞여 들어와도 id 로 가른다. 같은 조각이 또 오면 세지 않는다.
 */
export function createCollector() {
  const pending = new Map();   // id → { n, parts: Map<i, data> }

  async function add(text) {
    const c = parseChunk(text);
    if (!c) return null;
    let slot = pending.get(c.id);
    if (!slot || slot.n !== c.n) {
      slot = { n: c.n, parts: new Map() };
      pending.set(c.id, slot);
    }
    slot.parts.set(c.i, c.data);
    const got = slot.parts.size;
    if (got < slot.n) return { id: c.id, got, total: slot.n, done: false };
    const body = Array.from({ length: slot.n }, (_, i) => slot.parts.get(i)).join('');
    pending.delete(c.id);
    const record = await unpackBody(body);
    return { id: c.id, got, total: slot.n, done: true, record };
  }

  /** 여러 줄을 한 번에 — 붙여 넣기용. 줄마다 add() 한 결과 중 마지막 것을 돌려준다. */
  async function addText(text) {
    let last = null;
    for (const line of String(text ?? '').split(/\s+/)) {
      const r = await add(line);
      if (r) last = r;
    }
    return last;
  }

  return { add, addText, pendingIds: () => [...pending.keys()] };
}
