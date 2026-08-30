/**
 * 결과 메시지 토스트.
 *
 * reduce() 가 돌려주는 message 를 큐에 쌓아 하나씩 보여준다.
 * 처음부터 큐로 만든다 — 액션이 빠르게 이어지면 메시지가 여러 개 쌓이기 때문이다.
 *
 * ── 색 ─────────────────────────────────────────────────────────────
 * 두 가지뿐이다. **초록은 뜻대로 됐다, 빨강은 뜻대로 안 됐다.**
 *   'ok'                   초록 — 무엇이 바뀌었는지 말한다
 *   'happened' · 'blocked' 빨강 — 무슨 일이 일어났고 어떻게 하면 되는지 말한다
 * 색을 셋 이상으로 나누면 학생이 색을 해석하는 데 시간을 쓴다. 여기서 필요한 판단은
 * "다음으로 넘어가도 되나" 하나뿐이라 둘이면 된다.
 *
 * ── 머무는 시간 ────────────────────────────────────────────────────
 * 예전에는 3.2초 고정이었다. 교실에서 재어 보니 긴 문장은 읽다가 사라졌다. 이제
 * **글자 수로 정한다** — 읽는 데 걸리는 시간이 글자 수를 따라가기 때문이다.
 *
 * T07 — 메시지 상세도는 난이도별로 여기서만 갈린다. sim(rules.js)이 만드는 전체 메시지는
 * 그대로 session.log 에 남고, 화면에 얼마나 보여줄지만 조절한다. UI.toast 참조.
 */

import { UI } from './strings.js';

/** 읽는 시간. 한글 한 글자에 90 ms 로 잡고, 짧아도 3.5초·길어도 8초 안에 둔다. */
const holdFor = (text) => Math.min(8000, Math.max(3500, 2200 + text.length * 90));

/**
 * 난이도별로 화면에 보일 메시지를 만든다. 표에 없는 tag 는 원인만 보여 준다(undefined 를 내지 않는다).
 *
 * 3단계에서 숨기는 것은 **뜻대로 안 됐을 때의 원인**이다 (스스로 찾으라는 단계이므로).
 * 뜻대로 됐을 때 무엇이 바뀌었는지는 힌트가 아니라 조작의 확인이라, 단계와 무관하게 그대로 보여 준다.
 */
function detail(message, tag, level, good, blocked = false) {
  if (good) return message;
  // **막힌 이유는 3단계에서도 감추지 않는다.**
  // 3단계가 감추는 것은 「어떻게 하면 되는지」이지 **벽이 있다는 사실**이 아니다.
  // 막히는 것은 두 종류뿐인데(할 수 없는 일·깨진 기구), 둘 다 이유를 모르면 빠져나올
  // 길이 없다 — 금 간 유리를 든 학생이 「결과가 나오지 않았습니다」만 보면 거기서 끝난다.
  if (blocked) return message;
  if (level >= 3) return UI.toast.hidden;
  if (level <= 1) {
    const next = UI.toast.nextAction[tag];
    if (next) return `${message} ${next}`;
  }
  return message;
}

/** @param {() => number} [getLevel]  현재 session.level 을 돌려주는 함수. 없으면 1단계로 본다. */
export function createToastQueue(root, getLevel) {
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const queue = [];
  let showing = false;
  /** 지금 화면에 떠 있는 것의 태그. 잘된 조작을 갈아 끼울 때 쓴다. */
  let showingTag = null;
  /*
   * 지금 떠 있는 것의 **꾸미기 전 문장**.
   *
   * 겹침 방지를 **태그로** 하고 있었더니 **다른 말을 삼켰다.** 태그 하나에 문장이 둘인
   * 자리가 둘 있었다:
   *   plain-tube   「…모세관을 골랐습니다」  vs 「…새 모세관을 꺼냈습니다. 처음부터 다시 시작합니다」
   *   rotor-empty  「회전판에 든 것이 없습니다」 vs 「돌아가기는 하지만 갈릴 것이 없습니다」
   * 잘못 채운 관을 버린 학생에게 **「기둥이 사라졌다」는 가장 중요한 말이 안 간다.**
   *
   * **꾸민 것이 아니라 날것을 견준다.** 큐에는 `detail()` 을 거친 문장이 들어가므로
   * 들어온 원문과 견주면 영영 안 맞고, 겹침 방지가 통째로 죽는다.
   * (fermentation 세션이 잡아 허브가 넘겨 주었고, 여기도 같았다)
   */
  let showingShown = null;
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, good, tag, shown } = queue.shift();
    showingTag = tag ?? null;
    showingShown = shown ?? null;

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');
    /*
     * **글과 닫기 단추로 나눈다.** 머무는 시간(`holdFor`)은 그대로 둔다 — 짧게 줄이면
     * 느리게 읽는 학생이 문장을 잃는다. 급한 사람만 ✕ 로 치우고 가면 된다.
     * (사장님이 아이폰으로 해 보시고 「긴 시간은 그대로 두고 X 를 만들어라」 하셨다)
     */
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    close.setAttribute('aria-label', UI.toast.close);
    close.textContent = '✕';
    close.addEventListener('click', () => { dismiss?.(); });
    el.append(text, close);
    root.appendChild(el);

    const timer = setTimeout(() => { dismiss?.(); }, holdFor(message));
    dismiss = () => {
      clearTimeout(timer);
      el.remove();
      dismiss = null;
      showing = false;
      showingTag = null;
      showingShown = null;   // 이것을 안 지우면 지나간 문장이 다음 것을 계속 삼킨다
      showNext();
    };
  }

  return {
    /** 메시지가 없으면 아무것도 하지 않는다 — 'ok' 라도 말할 것이 있으면 띄운다. */
    push(message, outcome, tag) {
      if (!message) return;

      // **같은 말을 쌓지 않는다.**
      // 조리개·초점 슬라이더는 끄는 동안 수십 번 디스패치된다. 그때마다 같은 문장이 큐에
      // 쌓이면 손을 뗀 뒤에도 몇십 초 동안 계속 뜬다 — 학생은 자기가 뭘 잘못했는지 몰라
      // 같은 곳을 계속 만진다. 이미 떠 있거나 줄을 선 것과 같은 말이면 그 자리를 지킨다.
      const good = outcome === 'ok';
      const level = getLevel ? getLevel() : 1;

      /*
       * **학생이 실제로 읽는 글자로 거른다.**
       *
       * 처음에는 날것(reduce 가 준 원문)으로 걸렀다. 그러면 **3단계에서 같은 글자가 두 번**
       * 뜬다 — `detail()` 이 3단계의 뜻대로 안 된 말을 **전부 같은 「숨김」으로** 바꾸기
       * 때문이다. 원문이 다르니 통과시켜 놓고, 화면에는 똑같은 줄이 둘 뜬다.
       * (chromatography 세션이 정본에서 잡아 허브가 넘겨 주었다)
       *
       * 태그로 걸러도 안 되고(다른 말을 삼킨다), 날것으로 걸러도 안 된다(같은 말을 두 번
       * 띄운다). **거르는 자와 학생이 보는 것이 같아야 한다.**
       */
      const shown = detail(message, tag, level, good, outcome === 'blocked');

      /*
       * **막힘을 먼저 처리한다.** 거르기를 앞에 두면 「왜 안 되는지」가 삼켜진다 —
       * 막힘은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**라
       * 줄을 서면 늦게 도착하고, 그 사이 학생은 같은 조작을 되풀이한다.
       * 다만 **지금 떠 있는 것과 같은 글자면 다시 띄우지 않는다** — 끄는 동안 같은
       * 막힘이 수십 번 오면 화면이 깜빡이기만 한다.
       */
      if (outcome === 'blocked') {
        if (showingShown === shown) return;
        queue.unshift({ message: shown, shown, good: false, tag });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      // **잘된 조작은 줄을 서지 않는다 — 마지막 것만 남는다.**
      // 같은 종류를 이어서 하면 앞의 것이 다 지나갈 때까지 화면이 **지난 사실**을 보여 준다.
      // 겹침 방지로 삼키면 더 나빠서, 두 번째 조작에도 첫 번째 문구가 뜬 채로 남는다 —
      // 손끝을 두 번 찌르면 두 번째에도 첫 번째 「맺혔습니다」가 떠 있는 식이다.
      // 지금 사실을 말해야 하므로 갈아 끼운다.
      if (good && tag) {
        const at = queue.findIndex((q) => q.tag === tag);
        if (at >= 0) queue.splice(at, 1);
      } else if (showingShown === shown || queue.some((q) => q.shown === shown)) {
        // 뜻대로 안 된 것은 그대로 줄을 지킨다. 밀어 넣은 깊이 슬라이더를 끄는 동안 같은
        // 경고가 수십 번 쌓이면, 손을 뗀 뒤에도 몇 분 동안 계속 뜬다.
        return;
      }
      // **막힘은 줄을 서지 않는다.**
      // 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
      // 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채 같은
      // 조작을 되풀이한다. micrometer 파일럿에서 재어 보니 막힌 지 **12.7초** 뒤에 설명이
      // 도착했다 — 그 사이에 학생은 「안 되네」 하고 손을 뗀다.
      // 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라 지우면 앞뒤를 못 듣는다.
      queue.push({ message: shown, shown, good, tag });
      showNext();
    },
  };
}
