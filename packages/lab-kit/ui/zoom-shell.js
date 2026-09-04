/**
 * 확대 뷰의 틀 — 덮개 · 패널 · 「닫기 (Esc)」 · 포커스 되돌리기 · 스크롤 맨 위.
 *
 * ── 왜 공용인가 ──────────────────────────────────────────────────────
 * 실험 여덟의 `zoom.js` 가 저마다 이 틀을 40줄씩 갖고 있었고, 하나(germination)는 아예
 * 다른 모양(`.zoom-sheet` — 제목과 닫기가 한 줄)이었다. 그 사이 micrometer 가 찾은 고침
 * (「열 때마다 맨 위에서 시작한다」 — 아래로 내린 채 닫았다 다시 열면 시야 원이 화면 위로
 * 잘렸다)은 다른 일곱에 옮겨지지 않았다. 틀이 하나면 고침도 한 번이다.
 *
 * 실험 쪽 `zoom.js` 는 **무엇을 그릴지**만 갖는다. `open(render, openerEl)` 에 그리는 함수를
 * 넘기면 틀이 열고, 그리고, 포커스를 준다. 다시 그릴 일이 있으면 `repaint()`.
 *
 * ── 규칙 (docs/09-uniformity.md §3) ─────────────────────────────────
 *   · 패널 첫 자식은 닫기 단추. sticky 라 아래로 스크롤해도 늘 보인다.
 *   · Esc · 덮개 탭 · 닫기 단추 — 세 길이 다 닫는다.
 *   · 닫으면 열었던 물건으로 포커스가 돌아간다. 실험대가 그 사이 다시 그려졌을 수 있으므로
 *     요소가 아니라 `data-id` 로 다시 찾는다.
 *
 * @param {HTMLElement} root  `#zoom`
 * @param {{ closeLabel: string, onClose?: () => void }} opts
 *   closeLabel — 실험 문자열(`UI.zoom.close`). 문구는 실험 것이라 받아 온다.
 *   onClose    — 닫힌 직후 한 번. 드래그 중 조용히 갱신한 상태를 실험대에 반영할 때 쓴다.
 */
export function createZoomShell(root, { closeLabel, onClose = () => {} }) {
  root.className = 'zoom-overlay';
  root.hidden = true;
  root.innerHTML = `
    <div class="zoom-panel" role="dialog" aria-modal="true" tabindex="-1">
      <button type="button" id="zoom-close" class="zoom-close"></button>
      <div class="zoom-body"></div>
    </div>`;
  const panel = root.querySelector('.zoom-panel');
  const body = root.querySelector('.zoom-body');
  const closeBtn = root.querySelector('.zoom-close');
  closeBtn.textContent = closeLabel;

  let render = null;
  let opener = null;
  let openerId = null;

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    render = null;
    document.removeEventListener('keydown', onKeydown);
    onClose();
    // onClose 가 실험대를 다시 그리면 잡아 둔 요소는 문서에서 떨어져 나간다. id 로 다시 찾는다.
    const target = openerId ? document.querySelector(`[data-id="${openerId}"]`) : opener;
    if (target && target.isConnected) target.focus();
    opener = null;
    openerId = null;
  }

  /**
   * @param {(body: HTMLElement) => void} renderFn  본문을 그린다. `repaint()` 가 다시 부른다.
   * @param {HTMLElement|null} openerEl  닫을 때 포커스를 돌려줄 물건. 문자열이 넘어오는 통로가
   *   있으므로(끌어다 놓기) 포커스를 줄 수 있는 것만 잡는다.
   */
  function open(renderFn, openerEl = null) {
    render = renderFn;
    opener = (openerEl && typeof openerEl.focus === 'function') ? openerEl : document.activeElement;
    openerId = opener?.dataset?.id ?? null;
    root.hidden = false;
    document.addEventListener('keydown', onKeydown);
    render(body);
    // 열 때마다 맨 위에서 시작한다 — 내려간 자리가 남으면 그림이 화면 위로 잘린다.
    root.scrollTop = 0;
    panel.scrollTop = 0;
    panel.focus();
  }

  /** 열려 있으면 같은 그리기 함수로 다시 그린다. 닫혀 있으면 아무 일도 없다. */
  function repaint() {
    if (root.hidden || !render) return;
    /*
     * 다시 그려도 손은 그 자리에 남는다. 본문이 `innerHTML` 로 통째로 바뀌면 포커스가
     * `<body>` 로 떨어져, 키보드로는 한 번 누르고 나면 Tab 으로 되돌아와야 다음을 누를 수 있다.
     * 같은 id 의 새 요소로 되돌려 준다 (centrifuge 가 끈 당기기에서 겪었다).
     */
    const focusedId = body.contains(document.activeElement) ? document.activeElement.id : null;
    render(body);
    if (focusedId) body.querySelector(`#${CSS.escape(focusedId)}`)?.focus();
  }

  closeBtn.addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });

  return {
    panel, body, open, close, repaint,
    isOpen: () => !root.hidden,
    /** 닫을 때 포커스를 돌려줄 곳을 바꾼다 — 열린 채로 다른 물건으로 옮겨 갈 때. */
    setOpener(el) { opener = el; openerId = el?.dataset?.id ?? null; },
  };
}
