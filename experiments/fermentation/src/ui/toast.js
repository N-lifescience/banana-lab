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
  /** 지금 떠 있는 **글자 그대로**. 같은 말을 겹쳐 띄우지 않으려고 기억한다 — 태그도 날것도 아니다. */
  let showingText = null;
  /** 지금 떠 있는 것이 잘된 조작의 확인인가. 새 확인이 밀어내도 되는지를 여기서 본다. */
  let showingGood = false;
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
    showingText = shown ?? null;
    showingGood = good;

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');

    /*
     * **글과 닫기 단추를 따로 담는다.**
     *
     * 선생님이 아이폰에서 해 보시고 「머무는 시간은 그대로 두고, 손으로 닫을 수 있게」
     * 하라고 하셨다. 그래서 **시간은 건드리지 않는다**(`holdFor`) — 읽을 시간이 필요한
     * 사람에게서 빼앗지 않고, 다 읽은 사람에게 치울 길을 준다.
     *
     * 글을 `el` 에 바로 넣지 않고 span 으로 감싸는 까닭은 단추와 나란히 놓기 위해서다.
     */
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    // 낭독기에는 「✕」가 아니라 **무엇을 하는 단추인지**가 읽혀야 한다.
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
      showingText = null;
      showingGood = false;
      showNext();
    };
  }

  return {
    /** 메시지가 없으면 아무것도 하지 않는다 — 'ok' 라도 말할 것이 있으면 띄운다. */
    push(message, outcome, tag) {
      if (!message) return;

      /*
       * **같은 「말」을 쌓지 않는다 — 같은 「태그」가 아니다.**
       *
       * 예전에는 태그로 걸렀다. 그런데 태그는 **무슨 일이 일어났는가**의 갈래이지 문장이
       * 아니다. 이 실험에서 희석은 두 번이다 — 10 % 를 넣고, 증류수를 넣는다. 둘 다
       * 태그가 `mix-added` 라 **둘째 말이 통째로 삼켜졌다.**
       *
       *     10 % → 만든 병 : 「10 % 포도당 수용액 10 mL 를 더했습니다…」
       *     증류수 → 만든 병: **(아무 말도 없음)**
       *
       * 하필 그 자리다. 「같은 부피를 더하면 농도가 절반」이 이 실험에서 배울 것 중 하나이고,
       * `PLAYTEST.md` 가 「여기를 꼭 보세요」라고 적어 둔 칸이다. 이름표는 5 % 로 바뀌는데
       * 왜 그런지를 말해 주던 문장이 사라졌다. **직접 플레이해 보고서야 나왔다.**
       *
       * 원래 막으려던 것은 **똑같은 문장이 수십 번 쌓이는 것**이었다(슬라이더를 끄는 동안).
       * 그건 문장으로 걸러도 그대로 막힌다 — 이 저장소에는 슬라이더가 아예 없고,
       * 태그로 거르는 바람에 **다른 말까지** 막고 있었다.
       */
      const good = outcome === 'ok';
      const blocked = outcome === 'blocked';
      const level = getLevel ? getLevel() : 1;
      // **학생이 실제로 읽는 글자**를 먼저 만든다. 거르기는 이것으로 한다 — 아래 참조.
      const text = detail(message, tag, level, good, blocked);

      // **막힘은 줄을 서지 않는다.**
      // 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
      // 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채 같은
      // 조작을 되풀이한다. micrometer 파일럿에서 재어 보니 막힌 지 **12.7초** 뒤에 설명이
      // 도착했다 — 그 사이에 학생은 「안 되네」 하고 손을 뗀다.
      // 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라 지우면 앞뒤를 못 듣는다.
      /*
       * **거르기는 「학생이 실제로 읽는 글자」로 한다.**
       *
       * 처음에는 태그로 걸렀다 — 희석 두 걸음이 같은 태그라 둘째 말이 통째로 삼켜졌다.
       * 그래서 날것(raw)으로 바꿨더니 이번엔 반대쪽이 났다: **3단계는 뜻대로 안 된 말을
       * 전부 「결과가 나오지 않았습니다.」 하나로 감춘다.** 날것이 다르니 둘 다 통과해서
       * 학생은 **같은 문장을 두 번** 본다.
       *
       *     3단계에서 본 것: ["결과가 나오지 않았습니다.", "결과가 나오지 않았습니다."]
       *
       * 태그도 날것도 아니고 **화면에 뜰 글자**가 기준이다. 그래야 네 경우가 다 맞는다 —
       * 어느 하나만 재면 나머지 중 하나가 깨진다:
       *
       *     같은 말 30번          → 한 번   (원래 목적)
       *     다른 말, 같은 태그     → 둘 다   (희석 두 걸음)
       *     감춰서 같아진 말       → 한 번   (3단계)
       *     같은 막힘을 되풀이     → 한 번   (깜빡이지 않는다)
       */
      if (showingText === text || queue.some((q) => q.shown === text)) return;

      if (blocked) {
        /*
         * 막힘은 **줄 끝에서 기다리지 않는다.** 지금 누른 것에 대한 답을 지난 일 넷을
         * 다 읽고 나서 받아서는 안 된다. 그래서 `unshift` 로 줄 앞에 선다.
         *
         * **거르기보다 뒤에 있는 것이 맞다.** 한때 앞으로 옮겼다가 되돌렸다 —
         * 거르기가 「화면에 뜰 글자」로 바뀌고 나니(바로 위) 막힘이 잘된 조작에
         * 삼켜질 일이 없어졌고, 앞에 두면 **같은 것을 되풀이해 누를 때마다 떠 있던
         * 말풍선을 지우고 똑같은 것을 다시 붙였다** — 열 번에 붙은 것 10 · 떨어진 것 9.
         * 학생 눈에는 답이 오는 것이 아니라 **깜빡이는 것**이다.
         *
         * 지켜야 할 것은 「같은 글자를 두 번 띄우는 것」이 아니라
         * **「다른 막힘이 줄에 밀려 삼켜지지 않는 것」**이다.
         */
        queue.unshift({ message: text, good: false, tag, shown: text });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      // **잘된 조작의 확인은 줄을 서지 않는다 — 새것이 앞것을 밀어낸다.**
      //
      // 이것은 「무엇이 바뀌었는가」다. 방금 한 조작 바로 뒤에 붙어 있을 때만 뜻이 있고,
      // 다음 조작이 이미 일어난 뒤에 도착하면 **화면과 다른 말**이 된다.
      // 실제로 재어 보니 그랬다: 희석 → 붓기 → 효모 → 솜마개 → 항온기를 이어서 하면
      // 말풍선 하나에 3.5~8초씩 걸려, 솜마개를 꽂을 때 화면에 떠 있는 것은 **네 걸음 전**의
      // 「병에 든 것은 10 % 포도당 수용액입니다」였다. 이름표는 이미 5 % 인데.
      //
      // 그래서 확인은 **가장 마지막 것 하나만** 남긴다. 줄을 서 있던 앞선 확인은 버린다.
      // **`happened` 는 그대로 줄을 선다** — 그것은 확인이 아니라 실제로 일어난 일이라,
      // 하나라도 못 들으면 왜 그런 결과가 나왔는지 앞뒤를 잃는다.
      if (good) {
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].good) queue.splice(i, 1);
        queue.push({ message: text, good: true, tag, shown: text });
        if (showing && showingGood) dismiss?.();   // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      queue.push({ message: text, good, tag, shown: text });
      showNext();
    },
  };
}
