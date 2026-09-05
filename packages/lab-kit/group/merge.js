/**
 * 여러 사람이 같은 칸에 쓴 글을 **초안 하나**로 합친다.
 *
 * ── 무엇을 하고 무엇을 안 하는가 ─────────────────────────────────────
 * 서버가 없으니 AI 요약은 없다. 하는 일은 셋뿐이다.
 *   1. 문장으로 나눈다 (마침표·물음표·느낌표·줄바꿈).
 *   2. 거의 같은 문장은 하나만 남긴다 (글자 두 자 묶음의 겹침으로 잰다 — 띄어쓰기·조사가
 *      조금 달라도 같은 문장으로 본다).
 *   3. **여럿이 같이 쓴 문장을 앞에** 놓는다. 그 다음은 사람 순서·문장 순서 그대로.
 *
 * 그래서 나오는 것은 「모둠이 같은 말을 한 것 → 한 사람만 본 것」 순서의 문장 목록이다.
 * 토의의 출발점이지 결론이 아니다 — 모둠장이 고쳐 쓰라고 칸에 넣어 주는 것이고,
 * 화면에는 누가 무엇을 썼는지 카드가 그대로 남는다.
 *
 * 순수 함수다. DOM 을 모른다.
 */

/** 문장으로 나눈다. 빈 것은 버린다. */
export function splitSentences(text) {
  return String(text ?? '')
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 비교용 열쇠 — 공백·문장부호를 빼고 글자만. */
function bare(s) {
  return s.replace(/[\s.,!?。·:;'"()\[\]-]/g, '').toLowerCase();
}

/** 글자 두 자 묶음의 집합. 짧은 문장은 한 자씩. */
function grams(s) {
  const b = bare(s);
  if (b.length < 2) return new Set(b ? [b] : []);
  const g = new Set();
  for (let i = 0; i < b.length - 1; i++) g.add(b.slice(i, i + 2));
  return g;
}

/** 두 문장이 얼마나 같은가 (0~1). Jaccard. */
export function similarity(a, b) {
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let both = 0;
  for (const g of ga) if (gb.has(g)) both++;
  return both / (ga.size + gb.size - both);
}

/** 이 이상이면 같은 문장으로 본다. 「청람색으로 변했다」와 「청람색으로 변함」이 묶이는 선. */
export const SAME_LINE = 0.6;

/**
 * @param {{nick:string, text:string}[]} entries  사람마다 하나
 * @returns {{sentences: {text:string, by:string[]}[], draft: string}}
 *   sentences — 겹친 것을 지운 문장과 그 문장을 쓴 사람들 (여럿이 쓴 것부터)
 *   draft     — 그 문장들을 이어 붙인 글. 칸에 넣을 것
 */
export function mergeEntries(entries) {
  const kept = [];   // { text, by: Set, order }
  let order = 0;
  for (const { nick, text } of entries) {
    for (const s of splitSentences(text)) {
      const hit = kept.find((k) => similarity(k.text, s) >= SAME_LINE);
      if (hit) {
        hit.by.add(nick);
        // 더 긴 쪽을 남긴다 — 「변함」보다 「청람색으로 변했다」가 초안으로 낫다
        if (bare(s).length > bare(hit.text).length) hit.text = s;
      } else {
        kept.push({ text: s, by: new Set([nick]), order: order++ });
      }
    }
  }
  const sentences = kept
    .sort((a, b) => (b.by.size - a.by.size) || (a.order - b.order))
    .map((k) => ({ text: k.text, by: [...k.by] }));
  return { sentences, draft: sentences.map((s) => s.text).join(' ') };
}
