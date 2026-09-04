/**
 * 쪽을 넘긴 뒤 **화면을 그 쪽 머리로 데려간다.**
 *
 * 「이 쪽을 읽었습니다」는 쪽 **맨 아래**에 있다. 학생은 거기까지 내려와서 누른다.
 * 탭은 다음 쪽으로 넘어가지만 **스크롤은 그 자리에 남는다** — 그래서 새 쪽의 한중간이
 * 화면에 뜨고, 첫 줄은 화면 위로 밀려나 있다. 폰에서 실제로 잰 값:
 *
 *     누르기 전 스크롤 654px → 누른 뒤 654px,  새 쪽 첫 줄의 화면 위치 −156px
 *
 * 학생 눈에는 「눌렀는데 아무 일도 안 일어났다」이거나 「엉뚱한 데가 떴다」이다.
 * (사장님 지시, 2026-09-05: 「이용자 화면을 바로 그쪽이 뜨게 설정하라고.」)
 *
 * ★ **탭 줄로 데려간다.** 본문 첫 줄이 아니다 — 탭이 보여야 「3쪽에 ✓ 가 붙고 4쪽으로
 *   왔다」가 한눈에 읽힌다. 본문만 띄우면 어디로 온 것인지는 여전히 모른다.
 *
 * ★ **포커스도 옮긴다.** 스크롤만 옮기면 낭독기를 쓰는 학생에게는 아무 일도 안 일어난 것이다.
 *   `preventScroll` 로 포커스가 스크롤을 다시 흔들지 않게 한다.
 */
export function revealNotePage(root) {
  if (!root) return;
  const anchor = root.querySelector('#note-tabs') ?? root.querySelector('.note-head') ?? root;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  /*
   * **다시 그린 다음에 옮긴다.** 새 쪽이 아직 안 그려졌으면 높이가 옛 쪽 것이라
   * 엉뚱한 자리로 데려간다. 한 프레임 뒤에는 새 쪽이 자리를 잡고 있다.
   */
  requestAnimationFrame(() => {
    anchor.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    const panel = root.querySelector('#note-panel');
    if (!panel) return;
    // 글칸이 아니므로 탭 순서에는 넣지 않는다 (-1). 프로그램으로만 포커스를 준다.
    panel.setAttribute('tabindex', '-1');
    panel.focus({ preventScroll: true });
  });
}
