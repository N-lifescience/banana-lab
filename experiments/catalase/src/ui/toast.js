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
  /** 지금 화면에 떠 있는 것의 태그. 같은 말을 겹쳐 띄우지 않으려고 기억한다. */
  let showingTag = null;
  /**
   * 지금 떠 있는 것의 **꾸민 뒤 글자.**
   *
   * 태그만으로는 못 거른다. 이 저장소의 `happened` 열넷 중 **열둘에 태그가 없고**,
   * 3단계는 뜻대로 안 된 말을 전부 같은 「숨김」 문장으로 바꾼다 — 태그가 달라도
   * **화면에 나가는 글자는 같다.** 걸러야 할지는 **나가는 글자**가 정한다.
   */
  let showingText = null;
  /** 지금 떠 있는 것이 **조작의 확인**인가. 새 확인이 오면 갈아 끼울지 정하는 데 쓴다. */
  let showingGood = false;
  /**
   * 지금 떠 있는 것이 **막힘**인가.
   *
   * 글자만으로는 못 가른다. 「이미 떠 있는 것과 같은 글자」라도, 떠 있는 것이
   * **막힘이 아니면** 새 막힘은 반드시 나가야 한다 — 그게 「막힘은 삼켜지지 않는다」이다.
   * 깜빡임을 막는 것은 **막힘 위에 같은 막힘**이 올 때뿐이다. 둘은 다른 자리다.
   */
  let showingBlocked = false;
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, good, tag, blocked: wasBlocked } = queue.shift();
    showingTag = tag ?? null;
    showingText = message;
    showingBlocked = wasBlocked === true;
    showingGood = good;

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');

    /**
     * **글자와 닫기 단추를 따로 둔다.**
     *
     * 선생님이 아이폰으로 해 보시고 「**긴 시간은 그대로 두고** ✕ 를 만들어 거기를
     * 터치하면 사라지게」라고 하셨다 (2026-08-29). **머무는 시간은 안 건드린다** —
     * 교실에서 재 보고 글자 수에 맞춰 늘려 둔 값이다(`holdFor`). 다 읽은 사람만
     * 먼저 치울 수 있게 하는 것이지, 짧게 만드는 것이 아니다.
     *
     * 말풍선 자리(`#toast-region`)는 `pointer-events:none` 이라 손가락이 그대로
     * 통과한다 — 뒤에 있는 실험대를 가리지 않으려고 그렇게 뒀다.
     * 그래서 **✕ 에만 `auto` 를 돌려준다**(`index.html` 의 `.toast-x`).
     */
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    // 눈에는 ✕ 만 보인다. 읽어 주는 기기에는 이름이 있어야 한다.
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
      // **기억해 둔 글자도 함께 지운다.** 안 지우면 지나간 문장이 다음 것을 계속
      // 삼키고, 그때 증상이 «고치기 전과 똑같아» 어디를 보고 있는지 알 수 없게 된다.
      showingText = null;
      showingBlocked = false;
      showingGood = false;
      showNext();
    };
  }

  return {
    /** 메시지가 없으면 아무것도 하지 않는다 — 'ok' 라도 말할 것이 있으면 띄운다. */
    push(message, outcome, tag) {
      if (!message) return;

      const good = outcome === 'ok';
      const level = getLevel ? getLevel() : 1;

      // **막힘은 줄을 서지 않는다.**
      // 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
      // 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채 같은
      // 조작을 되풀이한다. micrometer 파일럿에서 재어 보니 막힌 지 **12.7초** 뒤에 설명이
      // 도착했다 — 그 사이에 학생은 「안 되네」 하고 손을 뗀다.
      // 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라 지우면 앞뒤를 못 듣는다.
      if (outcome === 'blocked') {
        const shownBlocked = detail(message, tag, level, false, true);
        /**
         * **같은 막힘이 이미 떠 있으면 그대로 둔다.**
         *
         * 막힘을 앞으로 보내 놓고 나면, 학생이 **같은 곳을 계속 만질 때마다** 떠 있던 것을
         * 지우고 새로 붙인다 — 글자는 그대로인데 **깜빡인다.** 재 보니 120 ms 간격으로
         * 열 번 만졌을 때 **붙은 것 10 · 떨어진 것 9** 였다. 읽고 있던 문장이 계속
         * 새로 시작되니 긴 문장은 끝까지 읽히지 않는다.
         *
         * **다른 막힘은 그대로 새치기한다** — 그건 새 소식이라 지금 보여야 한다.
         * 가르는 것은 태그가 아니라 **나가는 글자**다. 이유가 같으면 같은 말이다.
         * (옆 랩이 정본에서 재어 보내 준 것을 받아 넣었다.)
         *
         * **줄에 있는 막힘까지 훑지 않는다.** 막힘은 `unshift` 한 다음 줄에서 곧장
         * 꺼내지므로(`dismiss` 든 `showNext` 든 맨 앞을 꺼낸다) **줄에 머무를 수가 없다.**
         * 훑는 줄을 넣어 봤다가 뺐다 — 빼도 아무것도 안 깨졌다.
         * **빼도 안 깨지면 넣지 않는다.** 안 도는 갈래는 언젠가 「돌고 있다」고 읽힌다.
         */
        if (showingBlocked && showingText === shownBlocked) return;
        queue.unshift({ message: shownBlocked, good: false, tag, blocked: true });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      /**
       * **같은 말을 쌓지 않는다 — 막힘을 먼저 보낸 «뒤» 에 거른다.**
       *
       * 순서가 중요하다. 거르기를 앞에 두면 **막힌 이유가 통째로 삼켜진다.**
       * 막힘은 「방금 네가 한 것이 안 된 이유」라, 한 번이라도 못 들으면 학생은
       * 같은 조작을 되풀이한다. 그래서 위의 `blocked` 분기는 **이 줄 위**에 있다.
       *
       * 거르는 기준은 **화면에 나가는 글자**다. 태그가 아니다 —
       * `happened` 열넷 중 열둘에 태그가 없고, 3단계는 서로 다른 태그를 같은
       * 「숨김」 문장으로 바꾼다. 태그로만 거르면 둘 다 안 걸린다.
       *
       * 재 봤다. 같은 실패를 다섯 번 누르면:
       *
       *     1단계  4.9초 → **24.2초**      3단계  **17.8초**
       *
       * 손을 뗀 뒤로도 20초 넘게 같은 문장이 떠 있었다. 주석에 「그러면 안 된다」고
       * 적어 두고도 그렇게 돌고 있었다 — 거르는 열쇠가 실제 자료와 안 맞았다.
       *
       * 태그도 함께 본다. 같은 태그인데 글자만 조금 다른 것(「아직 떠오르지
       * 않았습니다 (8초)」 / 「(12초)」)은 글자로는 못 걸러진다.
       */
      const shown = detail(message, tag, level, good);
      if ((tag && (showingTag === tag || queue.some((q) => q.tag === tag)))
        || showingText === shown || queue.some((q) => q.message === shown)) return;

      /**
       * **확인 문구는 줄을 서지 않는다. 앞엣것을 갈아 끼운다.**
       *
       * 확인 문구는 「방금 네가 한 것」이다. 줄을 서면 그 「방금」이 어긋난다 —
       * 실제로 재 보니 원반을 뚫고 과산화수소수를 붓고 감자즙에 담그고 수조에 넣는 동안
       * 화면에는 내내 **「거름종이 원반을 하나 뚫었습니다」**가 떠 있었다.
       * 네 번째 조작을 하는 학생에게 첫 번째 조작의 확인을 보여 주는 것은
       * 아무 말도 안 하는 것보다 나쁘다 — **틀린 말을 하고 있는 것이다.**
       *
       * 그래서 새 확인이 오면 줄에 있던 확인들을 걷어내고 떠 있던 것도 갈아 끼운다.
       * **막힘과 실패는 건드리지 않는다.** 그것은 「무슨 일이 있었다」가 아니라
       * 「왜 안 됐다」라서, 지나갔다고 사라지면 학생이 이유를 영영 못 듣는다.
       */
      if (good) {
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].good) queue.splice(i, 1);
        queue.push({ message: shown, good, tag });
        // 떠 있는 것이 확인이면 갈아 끼우고, 막힘·실패면 그것을 다 읽게 두고 뒤에 선다.
        if (showing && showingGood) dismiss?.();
        else showNext();
        return;
      }

      queue.push({ message: shown, good, tag });
      showNext();
    },
  };
}
