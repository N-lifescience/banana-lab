/**
 * 봉인 — 보고서를 **담당 선생님만 열 수 있게** 잠근다. **사이트에 하나뿐이다.**
 *
 * ── 왜 (2026-09-03, 사장님 결정 A′) ─────────────────────────────────
 * 제출된 보고서는 이 사이트 주인의 Supabase 에 쌓인다. 주인은 앱 화면으로는 남의 반을
 * 못 보지만 **대시보드를 열면 볼 수 있었다.** 그러면 주인이 학생 개인정보의 처리자가 되고,
 * 열람 요청·유출 신고·배상이 전부 주인 몫이 된다.
 *
 * 그래서 서버에는 **잠긴 봉투**만 둔다. 선생님 브라우저가 수업을 열 때 자물쇠(공개키)와
 * 열쇠(비밀키)를 한 쌍 만들고, 자물쇠만 서버에 올린다. **열쇠는 관리 링크의 `#` 뒤에만**
 * 있다 — 브라우저는 `#` 뒤를 서버로 보내지 않으므로, 서버 로그에도 표에도 남지 않는다.
 * 학생 브라우저는 그 자물쇠로 보고서를 잠가 보내고, 선생님 브라우저가 열쇠로 푼다.
 * 주인은 대시보드에서 암호문만 본다. 열쇠를 잃으면 **아무도, 주인도** 못 연다 — 그것이 봉인이다.
 *
 * ── 어떻게 ──────────────────────────────────────────────────────────
 *   선생님: ECDH P-256 키 쌍. 공개키는 raw(65 B) base64url, 비밀키는 JWK 의 `d`(32 B) 만.
 *   학생:   일회용 ECDH 키 쌍 → 선생님 공개키와 합쳐 비밀 → HKDF → AES-GCM-256 → 잠금.
 *           봉투 = { v, epk(학생 일회용 공개키), iv, ct }. 학생 비밀키는 버린다.
 *   선생님: `d` + 자기 공개키로 비밀키를 되살려 같은 비밀을 만들고 푼다.
 *
 * 전부 브라우저 내장 WebCrypto 다 — 새 의존성이 없다 (AGENTS.md §3.3). Node 20+ 에도 같은
 * API 가 있어 `node --test` 로 돈다 (`tests/seal.test.js`).
 */

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const SEAL_VERSION = 1;
const CURVE = 'P-256';
const HKDF_INFO = 'virtual-biolab sealed report v1';

/* ── base64url ─────────────────────────────────────────────────────── */

export function toB64u(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── 키 ────────────────────────────────────────────────────────────── */

/**
 * 선생님의 자물쇠·열쇠 한 쌍.
 * @returns {Promise<{pub: string, secret: string}>}  둘 다 base64url. `pub` 은 서버로, `secret` 은 링크 `#` 뒤로.
 */
export async function generateTeacherKeys() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: CURVE }, true, ['deriveBits']);
  const raw = await subtle.exportKey('raw', kp.publicKey);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { pub: toB64u(raw), secret: jwk.d };
}

async function importPub(pub) {
  return subtle.importKey('raw', fromB64u(pub), { name: 'ECDH', namedCurve: CURVE }, true, []);
}

/** 비밀키는 `d` 만 들고 다닌다. x·y 는 공개키(raw: 0x04 ‖ x ‖ y)에서 다시 꺼낸다. */
async function importSecret(secret, pub) {
  const raw = fromB64u(pub);
  if (raw.length !== 65 || raw[0] !== 4) throw new Error('공개키 모양이 아닙니다');
  const jwk = {
    kty: 'EC', crv: CURVE, ext: true,
    x: toB64u(raw.slice(1, 33)), y: toB64u(raw.slice(33, 65)), d: String(secret),
  };
  return subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: CURVE }, false, ['deriveBits']);
}

async function aesKeyFrom(privateKey, publicKey) {
  const shared = await subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hk = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(HKDF_INFO) },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/* ── 잠그기 · 풀기 ─────────────────────────────────────────────────── */

/**
 * 학생 쪽. 선생님 공개키로 잠근다. 일회용 키 쌍은 여기서 만들고 버린다.
 * @param {string} pub   선생님 공개키 (base64url raw)
 * @param {unknown} obj  JSON 이 되는 값
 * @returns {Promise<{v:number, epk:string, iv:string, ct:string}>}
 */
export async function seal(pub, obj) {
  const teacherPub = await importPub(pub);
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: CURVE }, true, ['deriveBits']);
  const key = await aesKeyFrom(eph.privateKey, teacherPub);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const epk = await subtle.exportKey('raw', eph.publicKey);
  return { v: SEAL_VERSION, epk: toB64u(epk), iv: toB64u(iv), ct: toB64u(ct) };
}

/**
 * 선생님 쪽. 열쇠(`secret`)와 자기 공개키(`pub`)로 봉투를 연다.
 * 잘못된 열쇠·손댄 봉투는 **던진다** — 조용히 빈 값을 돌려주면 「학생이 빈 것을 냈다」로 읽힌다.
 */
export async function open(secret, pub, envelope) {
  if (!envelope || envelope.v !== SEAL_VERSION) throw new Error('모르는 봉투 형식입니다');
  const priv = await importSecret(secret, pub);
  const epk = await importPub(envelope.epk);
  const key = await aesKeyFrom(priv, epk);
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64u(envelope.iv) }, key, fromB64u(envelope.ct),
  );
  return JSON.parse(dec.decode(plain));
}

/** 봉투처럼 생겼는가 — 서버에서 온 행이 봉인된 것인지 가를 때. */
export const isSealed = (x) =>
  Boolean(x && typeof x === 'object' && x.v === SEAL_VERSION && x.epk && x.iv && x.ct);
