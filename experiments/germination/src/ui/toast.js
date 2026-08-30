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
  // 길이 없다 — 뚜껑을 닫아 놓고 콩을 부으려는 학생이 「결과가 나오지 않았습니다」만
  // 보면 거기서 끝난다. 그 문구에는 어디를 눌러 여는지가 담겨 있다 (rules.js).
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
  /** 지금 떠 있는 것이 「뜻대로 됐다」인가. 뒤에 오는 확인 문구가 이것을 밀어낸다. */
  let showingGood = false;
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;
  // 지금 떠 있는 것의 **학생이 읽는 글자**. 겹침은 그것으로 거른다 (push 참조).
  let showingShown = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, good, tag } = queue.shift();
    showingTag = tag ?? null;
    showingShown = message;
    showingGood = good;

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');
    /*
     * 글과 **닫기 단추**로 나뉜다. 한 덩이였을 때는 `textContent` 하나로 끝났다.
     *
     * 머무는 시간(`holdFor`)은 그대로다. 줄이는 것이 아니라 **치울 길을 주는 것**이다 —
     * 읽는 사람은 오래 읽고, 다 읽은 사람은 안 기다린다.
     *
     * 단추는 진짜 `<button>` 이라야 한다. 그래야 Tab 으로 닿고 Enter 로 눌린다 —
     * 손가락만 보고 만들면 키보드로 못 닿는 자리가 하나 더 생긴다.
     */
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    close.setAttribute('aria-label', UI.toast.close);
    close.textContent = '✕';
    // 지우면 `dismiss` 가 **줄의 다음 것을 바로 띄운다** — 뒤에 밀린 말이 사라지지 않는다.
    close.addEventListener('click', () => { dismiss?.(); });
    /*
     * **글이 먼저다.** 이 자리는 `role="status"` 라 **DOM 순서대로 읽힌다** —
     * 단추를 앞에 두면 화면 읽기를 쓰는 학생이 알림마다 「이 알림 닫기」를 먼저 듣는다.
     *
     * 단추를 앞에 두면 `float` 이 걸린 줄만 좁힐 수 있어 320 px 에서 21 px 을 아낀다.
     * 재 보고 **안 쓰기로 했다** — 알림마다 되풀이되는 것과 한 번의 21 px 은 무게가 다르다.
     */
    el.append(text, close);
    root.appendChild(el);

    const timer = setTimeout(() => { dismiss?.(); }, holdFor(message));
    dismiss = () => {
      clearTimeout(timer);
      el.remove();
      dismiss = null;
      showing = false;
      showingTag = null;
      // **기억해 둔 글자도 지운다.** 안 지우면 지나간 문장이 다음 것을 계속 삼켜,
      // 증상이 고치기 전과 똑같아진다. (centrifuge 세션이 잡았다)
      showingShown = null;
      showingGood = false;
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
      const blocked = outcome === 'blocked';
      /*
       * **거르기는 「학생이 실제로 읽는 글자」로 한다.**
       *
       * 태그로 거르면 **한 태그가 문장 둘을 내는 자리**에서 둘째가 사라진다 —
       * 센서 깊이의 양 끝이 그렇다. 그렇다고 날것으로 거르면 이번엔 **3단계**가 깨진다:
       * 3단계는 뜻대로 안 된 말을 전부 같은 「숨김」 한 문장으로 바꾸므로, 서로 다른
       * 날것이 **같은 글자로 두 번, 세 번** 뜬다. 재어 보니 「결과가 나오지 않았습니다」가
       * 연달아 셋 떴다.
       *
       * 그래서 **꾸민 뒤의 글자**끼리 견준다. 학생이 읽는 것이 그것이고, 겹치는지도
       * 그것으로 정해진다.
       * (fermentation 이 태그 문제를, chromatography 가 3단계 쪽을 잡았다)
       */
      const shown = detail(message, tag, level, good, blocked);

      /*
       * **막힘은 거르기보다 앞이다.**
       *
       * 막힘은 「방금 네가 한 것이 안 된 이유」다. 거르기를 앞에 두면 줄에 같은 글자가
       * 있다는 이유로 **그 이유가 통째로 삼켜진다** — 학생은 벽에 부딪힌 채 아무 말도
       * 못 듣는다. 줄을 비우지는 않는다: 앞선 것들은 실제로 일어난 일이다.
       * (chromatography 세션이 잡았다)
       */
      if (blocked) {
        /*
         * **같은 막힘이 이미 떠 있으면 그대로 둔다.**
         *
         * 학생은 막히면 **같은 곳을 계속 만진다.** 그때마다 갈아 끼우면 읽고 있던 문장이
         * 눈앞에서 **사라졌다 나타난다.** 재어 보니 같은 막힘 열 번에 열 번 갈아 끼워졌다.
         * 뜬 수만 세면 안 보인다 — 붙은 것과 떨어진 것을 함께 세야 보인다.
         * **다른 막힘은 그대로 새치기한다** — 그건 새 소식이다.
         * (centrifuge 세션이 잡았다)
         */
        if (showingShown === shown) return;
        queue.unshift({ message: shown, good: false, tag });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      // **같은 글자를 쌓지 않는다.** 끄는 동안 수십 번 디스패치되는 자리가 있어서,
      // 그대로 두면 손을 뗀 뒤에도 같은 말이 몇십 초 동안 계속 뜬다.
      // 잘된 조작에는 이 문이 없다 — 아래에서 **마지막 것만 남기므로** 쌓일 일이 없고,
      // 여기서 막으면 「지금까지 1숟갈입니다」가 뜬 채로 두 숟갈째가 삼켜진다.
      if (!good && (showingShown === shown || queue.some((q) => q.message === shown))) return;

      // **뜻대로 된 것은 줄을 서지 않는다 — 마지막 것만 남는다.**
      // 확인 문구는 「지금 어디까지 왔는가」다(「지금까지 2숟갈입니다」). 줄을 세우면
      // 한 숟갈 더 넣은 뒤에도 앞의 「1숟갈」이 떠 있어 **화면이 거짓말을 한다.**
      // 앞선 확인만 걷어낸다 — 「일어난 일」과 「막힌 이유」는 지나간 사건이라 그대로 둔다.
      if (good) {
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].good) queue.splice(i, 1);
        queue.push({ message: shown, good: true, tag });
        if (showing && showingGood) dismiss?.();   // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      queue.push({ message: shown, good, tag });
      showNext();
    },
  };
}
