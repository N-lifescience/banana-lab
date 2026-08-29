/**
 * 결과 메시지 토스트.
 *
 * reduce() 가 돌려주는 message 를 큐에 쌓아 하나씩 보여준다.
 * 처음부터 큐로 만든다 — 액션이 빠르게 이어지면 메시지가 여러 개 쌓이기 때문이다.
 *
 * ── 색 ─────────────────────────────────────────────────────────────
 *   초록  뜻대로 됐다 (`ok`)
 *   회색  일어난 일을 **사실로** 말한다 (`UI.toast.neutral` 의 태그)
 *   빨강  뜻대로 안 됐다. 어떻게 하면 되는지 말한다
 *
 * 바나나랩은 초록·빨강 둘뿐이었다. 이 실험에는 **정상 경로인 `happened`** 가 있어서
 * 셋이 됐다 — 다른 배율의 눈금값을 고르는 것은 학생을 데려가려는 바로 그 자리인데,
 * 그 문장을 빨간색으로 칠하면 「틀렸다」로 읽힌다. **색이 문구를 뒤집는다.**
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
  // 이 실험에서 막히는 것은 딱 둘(할 수 없는 일·깨진 기구)뿐이고, 둘 다 이유를 모르면
  // 빠져나올 길이 없다 — 금 간 유리를 든 학생이 「결과가 나오지 않았습니다」만 보면
  // 거기서 실험이 끝난다.
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
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;
  /** 지금 화면에 떠 있는 것의 태그. 같은 말을 겹쳐 띄우지 않으려고 기억한다. */
  let showingTag = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, tone, tag } = queue.shift();
    showingTag = tag ?? null;

    const el = document.createElement('div');
    el.className = `toast toast--${tone}`;
    if (reducedMotion()) el.classList.add('toast--still');

    /*
     * 글과 닫기 단추를 나눠 담는다.
     *
     * 사장님 지시 — 「긴 시간은 그대로 두고 X표시를 만들어서 거기를 터치하면 사라질 수
     * 있도록. 팝업같은 느낌이지만, 토스트로!」 **머무는 시간(`holdFor`)은 안 건드린다** —
     * 줄이면 느리게 읽는 학생이 문장을 잃는다. 읽기를 마친 사람에게 치울 길만 준다.
     *
     * ★ 말풍선 자리(`#toast-region`)는 `pointer-events:none` 이라 손가락이 그대로
     *   통과한다. 그래서 **X 에만 `auto` 를 돌려준다** — 안 그러면 눌러도 아무 일이 없다.
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
      showNext();
    };
  }

  return {
    /** 메시지가 없으면 아무것도 하지 않는다 — 'ok' 라도 말할 것이 있으면 띄운다. */
    push(message, outcome, tag) {
      if (!message) return;

      const good = outcome === 'ok';

      // **지금 사실을 말하는 것은 갈아 끼우고, 막힌 것은 새치기한다.**
      //
      // 이 실험의 결과는 셋이다 — `ok`(뜻대로 됨) · `happened`(진행은 됐는데 뜻대로는
      // 아님) · `blocked`(막힘). 앞의 둘은 **지금 무엇이 되었는가**를 말하므로 마지막
      // 것만 뜨면 된다. 재물대에 대물 마이크로미터를 올렸다 표본으로 바꾸면 「올렸습니다」가
      // 같은 태그로 두 번 나는데, 앞의 것을 겹침 방지로 삼키면 **두 번째 조작에도
      // 첫 번째 문구가 뜬 채**로 남는다 — 재어 보니 두 번째 문구는 12초를 기다려도
      // 영영 오지 않았다. 삼키지 말고 줄에서 앞엣것을 빼고 새것을 세운다.
      //
      // 이러면 슬라이더를 끄는 동안 수십 번 디스패치돼도 줄에는 그 태그가 **하나뿐**이라,
      // 손을 뗀 뒤에 같은 문장이 몇십 초 동안 계속 뜨는 일도 함께 사라진다.
      // (`happened` 를 「뜻대로 안 된 것」으로 묶으면 안 된다. 색은 회색이지만 하는 일은
      //  사실을 말하는 것이다 — `UI.toast.neutral` 주석의 「색이 문구를 뒤집는다」와 같은 자리다.)
      if (outcome !== 'blocked' && tag) {
        const at = queue.findIndex((q) => q.tag === tag);
        if (at >= 0) queue.splice(at, 1);
      }

      /**
       * **기구가 깨진 것도 줄을 서지 않는다.**
       *
       * 400배에서 조동나사를 돌리면 유리에 금이 가고 재물대에서 내려간다. 그런데 그것은
       * `happened` 라 줄을 섰고, 앞선 문구 셋이 지나가는 동안 **18초 뒤에야** 화면에
       * 도착했다 — 그 사이 화면은 네 단계 전 이야기를 하고 있었다.
       *
       * 이것은 「무슨 일이 있었다」가 아니라 **「방금 네 기구가 부서졌다」**다.
       * 막힘과 같은 급이라 같은 길로 보낸다.
       */
      const urgent = outcome === 'blocked' || tag === 'cracked';

      // **막힘은 줄을 서지 않는다.**
      // 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
      // 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채
      // 같은 조작을 계속 되풀이한다. 재어 보니 막힌 지 **12.7초** 뒤에 설명이 도착했다 —
      // 그 사이에 학생은 「안 되네」 하고 손을 뗀다. 앞의 것을 지우고 곧장 띄운다.
      if (urgent) {
        const level = getLevel ? getLevel() : 1;
        // 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라(「유리에 금이 갔습니다」)
        // 지워 버리면 학생은 왜 막혔는지의 앞뒤를 영영 못 듣는다. 맨 앞에 세우기만 한다.
        // `detail(…, blocked=true)` 는 3단계에서도 이유를 감추지 않는다는 뜻이다.
        // 깨진 것도 마찬가지 — 왜 깨졌는지 모르면 다음에 또 깨뜨린다.
        queue.unshift({ message: detail(message, tag, level, false, true), tone: 'warn', tag });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }
      // 중립 톤이 필요한 이유는 `UI.toast.neutral` 주석에 있다 — 색이 문구를 뒤집는다.
      const neutral = !good && (UI.toast.neutral ?? []).includes(tag);
      const tone = good ? 'done' : (neutral ? 'note' : 'warn');
      const level = getLevel ? getLevel() : 1;
      queue.push({ message: detail(message, tag, level, good || neutral), tone, tag });
      showNext();
    },
  };
}
