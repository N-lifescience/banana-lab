/**
 * Supabase 와 이야기하는 유일한 창구.
 *
 * ── 왜 라이브러리를 안 쓰는가 ────────────────────────────────────────
 * `@supabase/supabase-js` 는 인증·실시간·저장소까지 들고 온다. 여기서 필요한 것은
 * 표 두 개에 넣고 빼는 것뿐이고, 그건 PostgREST 의 REST 규약이라 `fetch` 로 된다.
 * 의존성을 하나 늘리면 학교에서 도는 배포본이 그만큼 무거워지고, 그 라이브러리가
 * 언제 무엇을 바꿀지 우리가 정할 수 없게 된다 (AGENTS.md §3.3).
 *
 * ── 안 켜져 있으면 없는 것처럼 군다 ──────────────────────────────────
 * 주소와 키가 없으면 `enabled()` 가 false 다. 그러면 제출 단추가 아예 안 그려지고,
 * 앱은 지금까지처럼 완전히 오프라인으로 돈다. **설정하지 않은 채로 배포해도 멀쩡하다** —
 * 학교마다 쓰고 안 쓰고를 고를 수 있어야 하기 때문이다.
 *
 * ── anon 키는 공개돼도 되는 값이다 ───────────────────────────────────
 * 브라우저에 그대로 들어간다. 막아 주는 것은 키가 아니라 **RLS** 다 (supabase/schema.sql).
 * 서비스 롤 키는 절대 여기 넣지 않는다 — 그 키는 RLS 를 통째로 건너뛴다.
 */

/*
 * ── 두 값만 **이름을 적어** 읽는다. `import.meta.env` 를 통째로 읽지 않는다 ──────
 *
 * `const env = import.meta.env` 처럼 통째로 읽으면 Vite 가 **VITE_ 로 시작하는 환경변수를
 * 전부** 번들에 박아 넣는다. Vercel 은 시스템 값 스물몇 개를 `VITE_VERCEL_*` 로 자동
 * 노출하므로, 그 순간 **커밋한 사람의 실명과 커밋 메시지가 학생 브라우저로 그대로 나간다.**
 * 지어낸 걱정이 아니라 이 저장소의 배포본에서 직접 확인했다 (26개 · 약 2.2 KB):
 *
 *     VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME: `조성주`
 *     VITE_VERCEL_GIT_COMMIT_MESSAGE:     `머리글이 검사와 반대말을 하고 있었다 — …`
 *     VITE_VERCEL_PROJECT_ID · DEPLOYMENT_ID · 팀 슬러그 …
 *
 * 비밀값은 아니지만 **아무도 그러라고 하지 않은 것**이고, 이 저장소는 사람 이름을 안 싣는다
 * (`Projects/CLAUDE.md`). 이름을 하나씩 적어 읽으면 Vite 는 **그 두 개만** 바꿔 넣는다.
 *
 * ★ **`?.` 를 쓰지 않는다.** Vite 는 `import.meta.env.VITE_X` 라는 **글자 그대로**를 찾아
 *   바꾼다. 물음표가 끼면 못 찾고 **다시 객체를 통째로 박는다** — 고침이 그 자리에서 무효다.
 *   (fermentation 세션이 짚어 허브를 거쳐 넘겨 주었다)
 *
 * 순수 node(테스트)에서는 `import.meta.env` 자체가 없어서 읽는 순간 터진다.
 * 그래서 감싼다 — 모듈을 불러 보는 것만으로 죽으면 안 된다.
 */
const { url: RAW_URL, key: RAW_KEY } = (() => {
  try {
    return { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_ANON_KEY };
  } catch {
    return { url: undefined, key: undefined };
  }
})();

export const SUPABASE_URL = String(RAW_URL ?? '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = String(RAW_KEY ?? '');

/** 제출 기능을 켤 수 있는 상태인가. */
export const enabled = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** 서버가 돌려준 오류를 사람이 읽을 수 있게 바꾼다. 원문은 콘솔에만 남긴다. */
export class NetError extends Error {
  constructor(message, { status = 0, detail = '' } = {}) {
    super(message);
    this.name = 'NetError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * PostgREST 호출 한 번.
 *
 * @param {string} path      '/rest/v1/reports?select=...'
 * @param {object} opts
 * @param {string} [opts.method]
 * @param {object} [opts.body]
 * @param {string} [opts.classCode]      x-class-code 헤더 (학생)
 * @param {string} [opts.teacherToken]   x-teacher-token 헤더 (교사)
 * @param {string} [opts.prefer]         'return=representation' 등
 */
async function rest(path, { method = 'GET', body, classCode, teacherToken, prefer } = {}) {
  if (!enabled()) throw new NetError('제출 기능이 설정돼 있지 않습니다.');

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  // 정책이 이 두 헤더를 읽는다 (supabase/schema.sql 의 current_class_code / current_teacher_token).
  if (classCode) headers['x-class-code'] = classCode;
  if (teacherToken) headers['x-teacher-token'] = teacherToken;

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    // 학교망에서 바깥이 막히는 일이 실제로 있다. "실패" 가 아니라 "닿지 않았다" 로 말한다.
    throw new NetError('서버에 닿지 못했습니다. 학교망 상태를 확인해 주세요.', { detail: String(e) });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new NetError(`서버가 요청을 거절했습니다 (${res.status}).`, { status: res.status, detail });
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ------------------------------------------------------------------ */
/* 수업                                                                */
/* ------------------------------------------------------------------ */

/** 여섯 자리 수업 코드. 학생이 손으로 친다. */
function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
  return String(n);
}

/**
 * 교사 관리 토큰.
 *
 * 이것을 아는 사람이 그 반의 보고서를 본다. 링크에 담기므로 **추측할 수 없어야** 한다.
 * 32바이트 난수를 base64url 로 적는다 — 여섯 자리 코드와는 쓰임이 전혀 다르다.
 */
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 수업을 연다. 코드가 겹치면 몇 번 다시 뽑는다 — 90만 개 중 하나라 실제로는 거의 안 겹친다.
 * @returns {Promise<{id:string, code:string, teacherToken:string, expiresAt:string}>}
 */
export async function createClass({ exp = 'banana', title = '', days = 30 } = {}) {
  const teacherToken = randomToken();
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  for (let tries = 0; tries < 5; tries++) {
    const code = randomCode();
    try {
      const rows = await rest('/rest/v1/classes?select=id,code,expires_at', {
        method: 'POST',
        prefer: 'return=representation',
        teacherToken,
        body: { code, teacher_token: teacherToken, exp, title, expires_at: expiresAt },
      });
      const row = rows?.[0];
      if (!row) throw new NetError('수업을 만들었는데 결과가 비어 있습니다.');
      return { id: row.id, code: row.code, teacherToken, expiresAt: row.expires_at };
    } catch (e) {
      // 23505 = unique 위반. 코드가 겹쳤을 때만 다시 뽑는다.
      if (e instanceof NetError && e.detail.includes('23505')) continue;
      throw e;
    }
  }
  throw new NetError('수업 코드를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
}

/** 학생이 코드를 확인한다. 없으면 null — "그런 수업이 없다" 와 "기한이 지났다" 를 구분하지 않는다. */
export async function findClass(code) {
  const rows = await rest(
    `/rest/v1/classes?select=id,code,exp,title,expires_at&code=eq.${encodeURIComponent(code)}`,
    { classCode: code }
  );
  return rows?.[0] ?? null;
}

/** 교사가 관리 토큰으로 자기 수업을 연다. */
export async function findClassByToken(teacherToken) {
  const rows = await rest('/rest/v1/classes?select=id,code,exp,title,expires_at', { teacherToken });
  return rows?.[0] ?? null;
}

/** 수업을 닫는다. 그 반 보고서가 함께 사라진다. */
export async function closeClass(teacherToken, classId) {
  await rest(`/rest/v1/classes?id=eq.${encodeURIComponent(classId)}`, {
    method: 'DELETE', teacherToken, prefer: 'return=minimal',
  });
}

/* ------------------------------------------------------------------ */
/* 보고서                                                              */
/* ------------------------------------------------------------------ */

/**
 * 보고서를 낸다.
 *
 * 돌려받는 것이 없다(`return=minimal`). 학생은 자기가 낸 것조차 다시 읽지 못한다 —
 * 읽게 하면 같은 코드를 아는 다른 학생도 읽게 되고, 거기엔 이름이 들어 있다.
 */
export async function submitReport({ classCode, classId, exp, studentNo, studentName, mode, level, payload }) {
  await rest('/rest/v1/reports', {
    method: 'POST',
    classCode,
    prefer: 'return=minimal',
    body: {
      class_id: classId, exp,
      student_no: studentNo, student_name: studentName,
      mode, level, payload,
    },
  });
}

/** 교사가 자기 반 제출물을 받아 온다. 최근 것이 위로. */
export function listReports(teacherToken, classId) {
  return rest(
    `/rest/v1/reports?select=id,exp,student_no,student_name,mode,level,payload,created_at`
    + `&class_id=eq.${encodeURIComponent(classId)}&order=created_at.desc`,
    { teacherToken }
  );
}

/** 잘못 낸 것을 지운다. */
export async function deleteReport(teacherToken, id) {
  await rest(`/rest/v1/reports?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE', teacherToken, prefer: 'return=minimal',
  });
}
