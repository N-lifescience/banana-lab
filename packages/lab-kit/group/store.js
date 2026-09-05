/**
 * 모둠 — 설정과 모인 기록. **메모리뿐이다.**
 *
 * ── 왜 실험 store 밖인가 ─────────────────────────────────────────────
 * 실험 store(`reduce()`)는 조작의 기록이다. 되돌리기가 그 위를 걷는다.
 * 모둠원이 보낸 기록은 조작이 아니고, 되돌릴 것도 아니며, 여덟 실험이 같은 모양으로 갖는다.
 * 그래서 `packages/lab-kit` 에 따로 둔다. 새로 고치면 사라진다 — 실험 상태와 같다.
 *
 * ── 개인정보 ─────────────────────────────────────────────────────────
 * 여기 드는 것은 모둠명·인원·역할·닉네임과 노트 글뿐이다. 학교·학번·이름은 **여기 없다** —
 * 그것은 보고서를 만들 때 `report.js` 가 그 자리에서만 받는다 (`tests/report.test.js`).
 * 닉네임 칸의 안내문이 「이름·학번은 적지 마세요」라고 말한다.
 */

export const ROLES = { LEADER: 'leader', MEMBER: 'member' };

export const DEFAULT_SETUP = { name: '', size: 4, role: ROLES.LEADER, nick: '' };

/**
 * @param {{name?:string, size?:number, role?:string, nick?:string}} setup
 */
export function createGroupStore(setup = {}) {
  const me = { ...DEFAULT_SETUP, ...setup };
  me.size = clampSize(me.size);
  me.name = String(me.name ?? '').trim();
  me.nick = String(me.nick ?? '').trim();
  me.role = me.role === ROLES.MEMBER ? ROLES.MEMBER : ROLES.LEADER;

  /** @type {Array<{nick:string, level:number, notes:Record<string,string>, caps?:any[], receivedAt:number}>} */
  const members = [];
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(snapshot()));

  function snapshot() {
    return { me: { ...me }, members: members.map((m) => ({ ...m })) };
  }

  /**
   * 기록 하나를 담는다. 같은 닉네임이 다시 오면 **바꿔 넣는다** — 고쳐 쓰고 다시 보낸 것이다.
   * 실험이 다르면 담지 않고 이유를 돌려준다.
   */
  function addMember(record, { exp } = {}) {
    if (!record || typeof record !== 'object') return { ok: false, reason: 'shape' };
    if (exp && record.exp && record.exp !== exp) return { ok: false, reason: 'exp', exp: record.exp };
    const nick = String(record.nick ?? '').trim() || fallbackNick(members.length);
    const entry = {
      nick,
      level: Number(record.level) || 1,
      notes: sanitizeNotes(record.notes),
      caps: Array.isArray(record.caps) ? record.caps.slice(0, 40) : [],
      receivedAt: Date.now(),
    };
    const at = members.findIndex((m) => m.nick === nick);
    const replaced = at >= 0;
    if (replaced) members[at] = entry;
    else members.push(entry);
    notify();
    return { ok: true, nick, replaced };
  }

  function removeMember(nick) {
    const at = members.findIndex((m) => m.nick === nick);
    if (at < 0) return false;
    members.splice(at, 1);
    notify();
    return true;
  }

  /** 같은 칸(key)에 모둠원들이 쓴 글. 안 쓴 사람은 뺀다. */
  function entriesFor(key) {
    return members
      .map((m) => ({ nick: m.nick, text: String(m.notes[key] ?? '') }))
      .filter((e) => e.text.trim());
  }

  return {
    get me() { return { ...me }; },
    isLeader: () => me.role === ROLES.LEADER,
    members: () => members.map((m) => ({ ...m })),
    /** 모둠장을 뺀 나머지가 몇이면 다 모인 것인가 */
    expected: () => Math.max(0, me.size - 1),
    addMember, removeMember, entriesFor,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot,
  };
}

export function clampSize(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_SETUP.size;
  return Math.min(8, Math.max(2, Math.round(v)));
}

const fallbackNick = (i) => `모둠원 ${i + 1}`;

/** 글만 남긴다. 숫자·객체가 섞여 와도 종이에 문자열로만 간다. */
function sanitizeNotes(notes) {
  const out = {};
  if (!notes || typeof notes !== 'object') return out;
  for (const [k, v] of Object.entries(notes)) {
    if (typeof k !== 'string' || k.length > 40) continue;
    if (v === null || v === undefined) continue;
    out[k] = String(v).slice(0, 4000);
  }
  return out;
}

/**
 * 모둠원이 보낼 기록 — **노트 글과 관찰 가능성 점수뿐이다.**
 * 시야 그림(fieldParams)은 크고, 모둠장 화면이 그것을 다시 그릴 일이 없다.
 * 되돌리기 기록(history)·조작 로그는 넣지 않는다 (T06 의 규칙과 같다).
 */
export function recordOf(state, me, { exp, capScore } = {}) {
  const s = state.session ?? {};
  const caps = Array.isArray(s.captures) && capScore
    ? s.captures.map((c) => ({ slide: c.slide, objective: c.objective, score: capScore(c) }))
    : [];
  return {
    v: 1,
    exp: exp ?? '',
    nick: me.nick || '',
    group: me.name || '',
    level: s.level ?? 1,
    notes: Object.fromEntries(
      Object.entries(s.notes ?? {}).filter(([, v]) => String(v ?? '').trim())
    ),
    caps,
  };
}
