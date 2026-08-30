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
  /**
   * 지금 화면에 떠 있는 **글자**. 같은 말을 겹쳐 띄우지 않으려고 기억한다.
   *
   * 예전에는 **태그**를 기억했다. 그런데 한 태그가 서로 다른 문장을 이는 자리가 있다 —
   * `front-overrun` 은 「표시할 자리가 없습니다」와 「전개율을 잴 수 없습니다」 둘을 낸다.
   * 표시하려다 첫 문장을 받은 학생이 곧이어 재려고 하면, **둘째가 통째로 사라졌다.**
   * 방금 한 조작에 아무 답이 없는 것이라 학생은 같은 곳을 계속 만진다.
   * (허브 세션이 fermentation 의 희석 안내에서 찾아 돌려 줬다.)
   *
   * 원래 뜻이 「**같은 말**을 쌓지 않는다」였으므로 말로 거른다. 3단계에서 서로 다른
   * 문장이 같은 「숨김」으로 바뀌는 것도 이 방식이 옳게 처리한다 — 그건 정말 같은 말이다.
   */
  let showingText = null;
  /** 지금 떠 있는 것이 「잘됐다」인가. 확인은 갈아 끼우고 그 밖의 것은 줄을 지킨다. */
  let showingGood = false;
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, good } = queue.shift();
    showingText = message;
    showingGood = good;

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');

    /*
     * **글과 닫기 단추로 나눈다.**
     *
     * 폰에서 직접 해 보니 말풍선이 **오래 머무는데 치울 길이 없었다.** 다음 조작을 하려면
     * 그냥 기다려야 한다. **머무는 시간은 줄이지 않는다** — 읽는 데 걸리는 시간은 그대로다.
     * 대신 **✕ 를 눌러 치울 수 있게** 한다. 팝업처럼 닫히지만 말풍선인 것은 그대로다.
     *
     * ★ 말풍선 자리(`#toast-region`)는 `pointer-events:none` 이라 손가락이 통과한다.
     *   **✕ 에만 `auto` 를 돌려준다** — 그러지 않으면 눌리지 않는다.
     * ★ 화면에는 ✕ 하나뿐이라 **읽어 주는 기계에는 이름을 따로 준다.**
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
      showingText = null;
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
      // 화면에 실제로 뜰 글자로 거른다. `detail()` 이 난이도에 따라 문장을 바꾸므로
      // **거르기 전에 먼저 만들어야** 같은 것을 같다고 볼 수 있다.
      const text = detail(message, tag, level, good, outcome === 'blocked');

      // **막힘은 줄을 서지 않는다. 그리고 아래 겹침 방지보다 먼저다.**
      //
      // 겹침 방지를 위에 두었더니 **막힌 이유까지 걸렸다.** 막힘은 「무슨 일이 있었다」가
      // 아니라 **「방금 네가 한 것이 안 된 이유」**여서, 못 들으면 빠져나올 길이 없다 —
      // 금 간 유리를 든 학생이 아무 답도 못 받는다. (허브 세션이 정본에서 같은 것을 찾았다.)
      // 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
      // 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채 같은
      // 조작을 되풀이한다. micrometer 파일럿에서 재어 보니 막힌 지 **12.7초** 뒤에 설명이
      // 도착했다 — 그 사이에 학생은 「안 되네」 하고 손을 뗀다.
      // 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라 지우면 앞뒤를 못 듣는다.
      if (outcome === 'blocked') {
        queue.unshift({ message: text, good: false, tag });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      // **같은 말을 쌓지 않는다.**
      // 원심관을 흔드는 동안에는 같은 조작이 수십 번 디스패치된다. 그때마다 같은 문장이
      // 큐에 쌓이면 손을 뗀 뒤에도 몇십 초 동안 계속 뜬다 — 학생은 자기가 뭘 잘못했는지
      // 몰라 같은 곳을 계속 만진다. 이미 떠 있거나 줄을 선 것과 같은 말이면 그 자리를 지킨다.
      //
      // ★ **태그가 아니라 말로 거른다.** 태그로 거르면 한 태그가 이는 **다른 문장**까지
      //   삼킨다 — 방금 한 조작에 아무 답이 없어진다. 위 `showingText` 주석에 사례가 있다.
      if (showingText === text || queue.some((q) => q.message === text)) return;

      // **확인은 줄을 서지 않고 갈아 끼운다.**
      //
      // 「잎을 넣었습니다」는 **방금 한 것**에 대한 답이다. 뒤에 세우면 다음 조작을 한 뒤에도
      // 앞엣말이 떠 있어 **화면이 방금 한 것과 다른 말을 한다.** 재어 보니 조작 다섯 번에
      // 마지막 문구가 20초 뒤에 도착했다 — 그쯤이면 확인이 아니라 방해다.
      // (문을 열자마자 이 증상이 나왔다. 허브 세션이 banana-lab 에서 먼저 겪었다.)
      //
      // 「일어난 일」(happened)과 「막힘」(blocked)은 그대로 줄을 지킨다. 그것들은 확인이
      // 아니라 **읽어야 할 결과**라, 지나가 버리면 학생이 무슨 일이 있었는지 모른다.
      if (good) {
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].good) queue.splice(i, 1);
        queue.push({ message: text, good: true, tag });
        // 떠 있는 것도 확인이면 갈아 끼운다. 읽어야 할 것이면 그것이 끝나기를 기다린다.
        if (showing && showingGood) dismiss?.();   // dismiss 가 showNext 를 이어 부른다
        else showNext();
        return;
      }

      queue.push({ message: text, good, tag });
      showNext();
    },
  };
}
