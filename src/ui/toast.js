/**
 * 결과 메시지 토스트.
 *
 * reduce() 가 돌려주는 message 를 큐에 쌓아 하나씩 보여준다.
 * 처음부터 큐로 만든다 — 액션이 빠르게 이어지면 메시지가 여러 개 쌓이기 때문이다.
 *
 * outcome === 'happened' 는 중립 톤, 'blocked' 만 경고 톤. 'ok' 는 애초에 push() 에서 걸러진다.
 * docs/04-interaction-rules.md 참조.
 */

const HOLD_MS = 3200;
const HOLD_MS_REDUCED = 1600;

export function createToastQueue(root) {
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const queue = [];
  let showing = false;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showNext() {
    if (showing || queue.length === 0) return;
    showing = true;
    const { message, outcome } = queue.shift();

    const el = document.createElement('div');
    el.className = `toast toast--${outcome}`;
    el.textContent = message;
    root.appendChild(el);

    const hold = reducedMotion() ? HOLD_MS_REDUCED : HOLD_MS;
    setTimeout(() => {
      el.remove();
      showing = false;
      showNext();
    }, hold);
  }

  return {
    /** outcome 이 'ok' 이거나 메시지가 없으면 아무것도 하지 않는다. */
    push(message, outcome) {
      if (!message || outcome === 'ok') return;
      queue.push({ message, outcome });
      showNext();
    },
  };
}
