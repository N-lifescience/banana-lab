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
 * **잘된 말은 뒤에 줄이 서면 이만큼만 머물고 비켜 준다.**
 *
 * 잘된 조작마다 초록 말풍선이 하나씩 나오는데(「스포이트에 증류수를 담았습니다」), 한 번에
 * 하나씩 3.5~8초를 머문다. 학생은 그 사이에 조작을 서너 개 더 한다 — 그러면 화면은
 * **한참 전에 한 일**을 읽어 주고 있다. osmosis 플레이테스트(2026-09-02)에서 1단계 정상
 * 경로를 그대로 밟았더니 5 % 용액을 가장자리에 댈 때 화면에는 아직 「바깥쪽 표피를
 * 얇게 벗겼습니다」가 떠 있었다 — **여덟 조작 전** 말이다. 「지금 무엇이 바뀌었나」를
 * 말하려던 문장이 지금 사실이 아닌 것을 읽힌다.
 *
 * 그래서 초록 말풍선은 **뒤에 기다리는 것이 있으면** 이 시간만 채우고 다음에 자리를 준다.
 * 아무것도 안 기다리면 원래 시간(`holdFor`)을 다 머문다. 빨간 말풍선(뜻대로 안 된 것)은
 * 건드리지 않는다 — 그건 읽어야 하는 말이라 시간을 줄이지 않는다.
 */
const OK_YIELD_MS = 1500;

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
   * 지금 떠 있는 것이 **막힘인지**와 그 **글자**. 막힘에는 태그가 없어 태그로는 못 가른다.
   * 학생이 같은 단추를 여러 번 누르면 막힘이 줄을 앞지르며 떠 있던 것을 지우고 다시 띄운다 —
   * **화면이 깜빡인다.** 그렇다고 통째로 거르면 이번엔 「다른 것이 떠 있을 때 온 막힘」까지
   * 삼켜서, 증상이 고치기 전과 똑같아진다. **두 자리를 갈라야 한다.**
   *   막힘 위에 같은 막힘        → 그대로 둔다
   *   다른 것 위에 같은 글자 막힘 → 반드시 내보낸다
   * ★ 지울 때 **함께 잊는다.** 안 잊으면 지나간 문장이 다음 것을 영영 삼킨다.
   */
  let showingBlocked = false;
  let showingShown = null;
  /** 지금 떠 있는 것을 지우는 함수. 막힘이 새치기할 때 쓴다. */
  let dismiss = null;
  /** 지금 떠 있는 것이 잘된 말인가, 언제 떴는가 — 비켜 줄지 정할 때 쓴다 (`OK_YIELD_MS`). */
  let showingGood = false;
  let shownAt = 0;
  let yieldTimer = 0;

  /**
   * 초록 말풍선이 떠 있고 뒤에 줄이 있으면, 최소 시간을 채운 뒤 비켜 준다.
   * 새 말이 줄에 설 때마다 부른다 — 뜰 때 줄이 비어 있었어도 나중에 찰 수 있다.
   */
  function yieldIfCrowded() {
    if (!showing || !showingGood || queue.length === 0) return;
    clearTimeout(yieldTimer);
    const left = Math.max(0, OK_YIELD_MS - (Date.now() - shownAt));
    yieldTimer = setTimeout(() => {
      if (showing && showingGood && queue.length > 0) dismiss?.();
    }, left);
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, good, tag, blocked: wasBlocked } = queue.shift();
    showingTag = tag ?? null;
    showingBlocked = !!wasBlocked;
    showingShown = message;
    showingGood = good;
    shownAt = Date.now();

    const el = document.createElement('div');
    // 색은 잘됐나/안 됐나 둘뿐이다. outcome 이름을 그대로 클래스로 쓰면 셋이 된다.
    el.className = `toast toast--${good ? 'done' : 'warn'}`;
    if (reducedMotion()) el.classList.add('toast--still');

    /*
     * **글과 닫기 단추로 나눈다.**
     * 머무는 시간은 글자 수를 따라가는데(`holdFor`) 긴 말은 8초까지 간다 —
     * 폰에서는 그 사이 화면을 가린다. **시간은 그대로 두고 손으로 지울 길을 준다.**
     *
     * ★ `#toast-region` 은 `pointer-events:none` 이다(밑에 있는 물건을 눌러야 하니까).
     *   그래서 이 단추에만 `auto` 를 돌려준다 — 안 그러면 **보이는데 안 눌린다.**
     *   좁은 화면에서 이 말풍선은 흐름에 자리를 차지하므로 특히 그렇다.
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
      clearTimeout(yieldTimer);
      el.remove();
      dismiss = null;
      showing = false;
      showingTag = null;
      showingBlocked = false;
      showingShown = null;   // 지울 때 함께 잊는다 — 안 잊으면 다음 막힘이 삼켜진다
      showingGood = false;
      showNext();
    };
    // 뜨는 순간 이미 줄이 있으면(연달아 조작한 뒤) 이것도 최소 시간만 머문다.
    yieldIfCrowded();
  }

  return {
    /** 메시지가 없으면 아무것도 하지 않는다 — 'ok' 라도 말할 것이 있으면 띄운다. */
    push(message, outcome, tag) {
      if (!message) return;

      const good = outcome === 'ok';

      // **같은 태그를 어떻게 다루는지가 잘된 것과 안 된 것에서 갈린다.**
      //
      // 뜻대로 **안 된** 말은 「방금 무슨 일이 있었는지」다. 조리개·초점 슬라이더는 끄는 동안
      // 수십 번 디스패치되는데, 그때마다 같은 경고가 쌓이면 손을 뗀 뒤에도 몇십 초 동안 계속
      // 뜬다 — 학생은 자기가 뭘 잘못했는지 몰라 같은 곳을 계속 만진다. **줄을 지킨다.**
      //
      // 잘된 말은 다르다. 「대물렌즈를 4배로 바꿨습니다」는 **지금 상태를 말하는 문장**이다.
      // 4 → 10 → 40 을 빠르게 누르면 줄을 지키는 규칙에서는 40배로 끝났는데 화면은 계속
      // 「4배로 바꿨습니다」라고 말한다. **이미 참이 아닌 것을 읽힌다.** 그래서 잘된 것은
      // 줄에 있는 같은 태그를 **갈아 끼운다** — 마지막에 남는 말이 지금 사실이 되게.
      if (tag) {
        if (good) {
          const at = queue.findIndex((q) => q.tag === tag);
          if (at >= 0) queue.splice(at, 1);
        } else if (showingTag === tag || queue.some((q) => q.tag === tag)) {
          // ★ **이 거르기는 막힘에 닿지 않는다.** `blocked()` 는 `{state, outcome, message,
          //   reason}` 을 돌려주고 **`tag` 자리가 없다** (`src/sim/rules.js`). 그래서 막힘은
          //   `if (tag)` 에 들어오지도 않는다. 막힘의 겹침은 **아래에서 글자로** 가른다.
          //   여기에 `outcome !== 'blocked'` 같은 조건을 덧대 봐야 닿지 않는 갈래다 —
          //   실제로 그렇게 넣고 시험까지 썼는데, 앱이 만들 수 없는 상태를 재고 있었다.
          return;
        }
      }

      const level = getLevel ? getLevel() : 1;

      // **막힘은 줄을 서지 않는다.**
      // 이것은 「무슨 일이 있었다」가 아니라 **「방금 네가 한 것이 안 된 이유」**다.
      // 뒤에 세우면, 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받은 채 같은
      // 조작을 되풀이한다. micrometer 파일럿에서 재어 보니 막힌 지 **12.7초** 뒤에 설명이
      // 도착했다 — 그 사이에 학생은 「안 되네」 하고 손을 뗀다.
      // 줄을 **비우지는 않는다.** 앞선 것들은 실제로 일어난 일이라 지우면 앞뒤를 못 듣는다.
      if (outcome === 'blocked') {
        // **학생이 실제로 읽는 글자**로 가른다. 3단계는 뜻대로 안 된 말을 다시 쓰므로,
        // 날것으로 견주면 화면에는 같은 글자가 두 번 뜬다.
        const shown = detail(message, tag, level, false, true);
        if (showingBlocked && showingShown === shown) return;   // 같은 막힘이 떠 있다 → 그대로 둔다
        // 「줄에 같은 막힘이 있으면」은 **여기서는 닿지 않는다.** 막힘은 바로 아래에서 줄을
        // 앞지르고 곧장 뜨므로 줄에 남아 있을 수가 없다. 변이로 확인했다 — 그 갈래를 빼도
        // 아무 시험도 안 깨진다. 닿지 않는 갈래를 지키는 척하는 코드는 두지 않는다.
        queue.unshift({ message: shown, good: false, tag, blocked: true });
        if (showing) dismiss?.();      // 지우면 showNext 가 이어서 불린다
        else showNext();
        return;
      }

      queue.push({ message: detail(message, tag, level, good), good, tag });
      showNext();
      yieldIfCrowded();
    },
  };
}
