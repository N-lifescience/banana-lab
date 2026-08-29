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
  /** 지금 화면에 떠 있는 **글자**(꾸민 뒤). 같은 말을 겹쳐 띄우지 않으려고 기억한다. */
  let showingShown = null;
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, shown, good, tag } = queue.shift();
    showingTag = tag ?? null;
    showingShown = shown ?? message;

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');

    /*
     * ★ **다 읽은 사람은 치울 수 있어야 한다 — 머무는 시간은 그대로 둔다.**
     *
     * 사장님 지시 (2026-08-29, 아이폰에서 직접 해 보시고):
     * 「토스트가 지속시간이 꽤 긴 것 같은데, **긴 시간은 그대로 두고** 토스트에 X표시를
     *  만들어서 거기를 터치하면 사라질 수 있도록 해줄래? **팝업같은 느낌이지만, 토스트로!**」
     *
     * **시간을 줄이는 것이 아니다.** 읽을 사람은 오래 읽고, 다 읽은 사람은 치운다.
     * 시간을 줄이면 느리게 읽는 학생이 문장을 잃는다 — 그래서 `holdFor` 는 손대지 않는다.
     *
     * 세 가지를 지킨다:
     *   · **키보드로도 닿는다** — 진짜 `<button>` 이라 Tab 으로 간다. 폰만 보고
     *     만들면 손가락으로만 닿는 단추가 생긴다.
     *   · 지우면 **큐의 다음 것이 바로 뜬다** — `dismiss()` 가 `showNext()` 를 부른다.
     *     안 그러면 뒤에 밀려 있던 말이 통째로 사라진다.
     *   · 말풍선 자리는 `pointer-events:none` 이라 손가락이 **통과**한다(밑의 실험대를
     *     가리지 않으려고 그렇게 두었다). 그래서 **X 에만** `pointer-events:auto` 를 준다.
     * (사장님 지시를 germination 세션이 그대로 전해 왔다)
     */
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    close.setAttribute('aria-label', UI.toast.close);
    close.textContent = '\u2715';
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
      showingShown = null;
      showNext();
    };
  }

  return {
    /** 메시지가 없으면 아무것도 하지 않는다 — 'ok' 라도 말할 것이 있으면 띄운다. */
    push(message, outcome, tag) {
      if (!message) return;
      const good = outcome === 'ok';
      const level = getLevel ? getLevel() : 1;


      /*
       * ★ **학생이 실제로 읽는 글자로 거른다.**
       *
       * 큐에 드는 것은 `detail()` 을 거친 글자다. 날것으로 걸렀더니 두 가지가 어긋났다:
       *   · 큐에 든 것은 꾸며진 것이라 날것과 **영영 같지 않아** 겹침 방지가 죽는다
       *   · **3단계는 뜻대로 안 된 말을 전부 같은 「숨김」으로 바꾼다.** 날것이 달라도
       *     학생이 보는 글자는 같으므로, 날것으로 걸러 두면 같은 글자가 두 번 뜬다
       * (웨이브 2 의 chromatography 세션이 3단계 쪽을 짚었다)
       */
      /*
       * ★ **막힘은 3단계에서도 안 감춘다** — 그 표시를 여기서 함께 넘긴다.
       *
       * 앞서는 막힘 분기가 따로 `detail(…, blocked=true)` 를 불렀다. 분기를 거르기 뒤로
       * 옮기면서 이 표시를 안 넘겼더니, 3단계에서 막힌 이유가 「숨김」으로 바뀌었다.
       * 검사가 잡았다(「3단계도 막힌 이유는 감추지 않는다」) — 3단계가 감추는 것은
       * 「어떻게 하면 되는지」이지 **벽이 있다는 사실**이 아니다.
       */
      const isBlocked = outcome === 'blocked';
      const shown = detail(message, tag, level, good, isBlocked);

      /*
       * **잘된 조작은 줄을 서지 않는다 — 마지막 것만 남는다.**
       * 숟갈을 두 번 뜨면 「1숟갈」 뒤에 「2숟갈」이 줄을 서고, 앞의 것이 다 지나갈 때까지
       * 화면은 **지난 수를 보여 준다.** 같은 태그를 겹침 방지로 삼키면 더 나빠서,
       * 두 숟갈째에도 「1숟갈」이 뜬 채로 있게 된다. 지금 사실을 말해야 하므로 갈아 끼운다.
       */
      if (good && tag) {
        const at = queue.findIndex((q) => q.tag === tag);
        if (at >= 0) queue.splice(at, 1);
      } else if (showingShown === shown || queue.some((q) => q.shown === shown)) {
        /*
         * **같은 말을 쌓지 않는다.**
         * 조리개·초점 슬라이더는 끄는 동안 수십 번 디스패치된다. 그때마다 같은 문장이 큐에
         * 쌓이면 손을 뗀 뒤에도 몇십 초 동안 계속 뜬다 — 학생은 자기가 뭘 잘못했는지 몰라
         * 같은 곳을 계속 만진다.
         *
         * ★ **태그가 아니라 글자로 거른다.** 앞서는 같은 태그면 삼켰는데, 한 태그가
         * **다른 말 둘**을 내는 자리가 있다 — `cross-contamination` 은 「스포이트에 다른
         * 용액이 남아 있는 채로 채웠습니다」와 「씻지 않은 스포이트를 썼습니다. 두 용액이
         * 섞였습니다」 둘을 내고, `cracked` 도 둘이다. 그러면 **둘째가 통째로 삼켜져**
         * 학생은 왜 그렇게 됐는지를 못 듣는다.
         * (웨이브 3 의 fermentation 세션이 희석 안내가 삼켜지는 것으로 잡았다)
         */
        return;
      }

      /*
       * **막힘은 줄을 서지 않는다 — 새치기한다.**
       *
       * 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
       * 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채 같은
       * 조작을 되풀이한다. micrometer 파일럿에서 재어 보니 막힌 지 **12.7초** 뒤에 설명이
       * 도착했다 — 그 사이에 학생은 「안 되네」 하고 손을 뗀다.
       * 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라 지우면 앞뒤를 못 듣는다.
       *
       * ── 거르기보다 **뒤**에 둔다 ────────────────────────────────
       * 한때 앞에 두었다. 「같은 태그면 삼킨다」 시절에는 막힘 설명이 삼켜졌기 때문이다.
       * 거르기를 **학생이 읽는 글자**로 바꾼 뒤로 그 일이 없어졌다 — 막힘 문장은 다른
       * 어떤 문장과도 글자가 같지 않고, 그 전제를 `rules.test.js` 가 붙든다.
       *
       * 그리고 앞에 두면 **새 결함이 생긴다** — 같은 곳을 계속 만지는 학생에게 말풍선이
       * 열 번 붙고 아홉 번 떨어져 **깜빡인다.** 뒤에 두면 거르기가 그 일까지 한다.
       * 앞으로 옮기고 깜빡임 방지를 따로 다는 길도 있는데, **줄만 늘고 얻는 것이 없다** —
       * 옮겨 보았더니 어느 검사도 안 깨졌다. (웨이브 3 의 fermentation 세션이 이 매듭을 풀었다)
       */
      if (isBlocked) {
        queue.unshift({ message: shown, shown, good: false, tag });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      queue.push({ message: shown, shown, good, tag });
      showNext();
    },
  };
}
