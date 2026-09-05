/**
 * 연습 모드의 피드백 기록 — 잘 안 된 조작을 모아 둔다. **메모리뿐이다.**
 *
 * 무엇을 담는가: 토스트로 나가는 것 중 **뜻대로 안 된 것**(`happened`·`blocked`)과,
 * 잘됐지만 **고칠 것이 있는 것**(`ok` 인데 `UI.toast.nextAction[tag]` 가 있는 것 —
 * 「세 방울째, 넘칩니다」 같은 귀결). 같은 것이 또 나오면 횟수만 는다.
 *
 * 「강제하지 말고 결과로 답한다」(AGENTS.md §2.1)와 같은 자리다 — 막지 않고 적어 둘 뿐이다.
 * DOM 을 모른다. `node --test` 로 돈다.
 */

/** 고칠 것이 아닌 태그 — 학생이 한 일이 아니거나(보고서 준비됨) 그 자체가 정리다. */
const IGNORE = new Set(['report-ready', 'capture-deleted', 'slide-replaced', 'undo-empty', 'lens-cleaned', 'coverslip-lifted']);

export function createFeedbackLog({ adviceOf = () => null } = {}) {
  /** @type {Array<{key:string, message:string, advice:string|null, outcome:string, tag:string|null, count:number, at:number}>} */
  const items = [];
  const listeners = new Set();
  let seq = 0;

  function add({ message, outcome, tag = null }) {
    if (!message) return null;
    if (tag && IGNORE.has(tag)) return null;
    const advice = tag ? adviceOf(tag) ?? null : null;
    if (outcome === 'ok' && !advice) return null;
    const key = tag ? `t:${tag}` : `m:${message}`;
    let hit = items.find((i) => i.key === key);
    if (hit) {
      hit.count++;
      hit.message = message;           // 최근 문장이 지금 상태를 말한다 (「3방울」→「4방울」)
    } else {
      hit = { key, message, advice, outcome, tag, count: 1, at: seq++ };
      items.push(hit);
    }
    listeners.forEach((fn) => fn(entries()));
    return hit;
  }

  function entries() { return items.map((i) => ({ ...i })); }

  /** 「다음엔 이렇게」 — 조언이 있는 것만, 겹치지 않게, 처음 나온 순서로. 조언 없는 것은 표에만 남는다. */
  function checklist() {
    const seen = new Set();
    const out = [];
    for (const i of items) {
      const line = i.advice;
      if (!line || seen.has(line)) continue;
      seen.add(line);
      out.push(line);
    }
    return out;
  }

  return {
    add, entries, checklist,
    size: () => items.length,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
