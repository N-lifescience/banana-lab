/**
 * 물건 화면 — 실험대의 물건을 누르면 열리는 「크게 보기」의 한 가지 모양.
 *
 * ── 규칙 (docs/09-uniformity.md §2·§3) ─────────────────────────────
 *   **누르면 본다, 끌면 옮긴다, 단추로 한다.**
 *   실험대에서 물건을 누르는 것만으로는 아무것도 바뀌지 않는다. 눌러서 열린 이 화면에
 *   지금 상태·하는 일·그림이 나오고, 할 수 있는 일은 **단추**로 나온다.
 *
 * 화면의 차례는 여덟 실험이 같다 — 사장님 지시 (2026-09-03, micrometer 에서 먼저 잡았다):
 *   ① 제목 = 실험대의 이름     ② 어디에 있나 · 무엇이 들었나 (한 줄)
 *   ③ 하는 일 (준비물 표의 그 줄) ④ 그림
 *   ⑤ 덧붙일 말 (금이 갔다, 비었다 …)  ⑥ 여기에 끌어다 놓을 수 있는 것
 *   ⑦ 단추 — 갈 수 있는 곳만. 못 가는 곳을 회색으로 죽여 두지 않는다 (AGENTS.md §2.1)
 *
 * 통·상자도 같은 화면이다. 그림이 「열린 통 안」이고 단추가 「꺼내기」일 뿐이다.
 *
 * @typedef {{ id: string, label: string, run: () => void, quiet?: boolean }} ItemAction
 *   quiet — 진한 단추가 아니라 조용한 단추. 되돌리는 쪽(도로 넣기·버리기)에 쓴다.
 */

/** HTML 로 넣을 글자를 안전하게. 문자열은 실험 것이라 여기서 믿지 않는다. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 글 한 줄을 안전한 HTML 로 — `**굵게**` 만 살린다.
 * 준비물 표의 「하는 일」이 강조를 쓰는데(micrometer·osmosis), escape 만 하면 별표가 그대로 뜬다.
 */
export function emphasize(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

/**
 * 물건 화면의 본문 HTML. 그림은 `#item-figure` 에 따로 넣는다 — SVG 문자열은 실험 것이다.
 *
 * @param {{
 *   title: string,
 *   where?: string|null,    ② 어디에 있나 · 무엇이 들었나
 *   role?: string|null,     ③ 하는 일
 *   note?: string|null,     ⑤ 덧붙일 말 (경고색이 아니다 — 사실을 말할 뿐이다)
 *   noteWhy?: string|null,  note 의 data-why (검사·스타일용 꼬리표)
 *   accepts?: string[],     ⑥ 여기에 끌어다 놓을 수 있는 것 — 이름 목록
 *   acceptsLabel?: string,  ⑥ 의 머리말 (실험 문자열 `UI.zoom.acceptsLabel`)
 *   actions?: ItemAction[], ⑦
 *   figureClass?: string,   그림 자리의 추가 class (기본 zoom-slide-stage)
 *   extra?: string,         ④ 와 ⑥ 사이에 실험이 끼워 넣을 HTML (읽음표·선택 단추 등). 이미 안전한 HTML.
 * }} v
 */
export function itemViewHTML(v) {
  const acts = v.actions ?? [];
  const accepts = (v.accepts ?? []).filter(Boolean);
  return `
    <h2>${escapeHtml(v.title)}</h2>
    ${v.where ? `<p class="zoom-slide-label">${emphasize(v.where)}</p>` : ''}
    ${v.role ? `<p class="zoom-empty">${emphasize(v.role)}</p>` : ''}
    <div class="${v.figureClass ?? 'zoom-slide-stage'}" id="item-figure"></div>
    ${v.extra ?? ''}
    ${v.note ? `<p class="zoom-hint" id="item-note"${v.noteWhy ? ` data-why="${escapeHtml(v.noteWhy)}"` : ''}>${emphasize(v.note)}</p>` : ''}
    ${accepts.length ? `<p class="zoom-hint zoom-accepts">${escapeHtml(v.acceptsLabel ?? '')} ${accepts.map(escapeHtml).join(' · ')}</p>` : ''}
    ${acts.length ? `<div class="zoom-scope-controls" style="margin-top:12px">
      ${acts.map((a) => `<button type="button" class="zoom-action${a.quiet ? ' zoom-action--quiet' : ''}" id="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`).join('')}
    </div>` : ''}`;
}

/**
 * 그림을 꽂고 단추를 건다. `itemViewHTML` 로 만든 본문에만 쓴다.
 * @param {HTMLElement} body
 * @param {{ figure?: string, actions?: ItemAction[] }} v  figure — SVG 문자열
 */
export function bindItemView(body, v) {
  const fig = body.querySelector('#item-figure');
  if (fig) fig.innerHTML = v.figure ?? '';
  for (const a of v.actions ?? []) {
    body.querySelector(`#${CSS.escape(a.id)}`)?.addEventListener('click', a.run);
  }
}

/** 한 번에 — 본문을 그리고 그림을 꽂고 단추를 건다. */
export function renderItemView(body, v) {
  body.innerHTML = itemViewHTML(v);
  bindItemView(body, v);
}

/**
 * 「여기에 끌어다 놓을 수 있는 것」 — 놓기 표(`dropTable`)를 거꾸로 읽는다.
 *
 * 표는 `{ 끄는 것: { 받는 것: 실행 } }` 이다. 어떤 물건이 무엇을 받는지는 표를 세로로 읽어야
 * 나온다. 따로 적으면 조작을 하나 늘릴 때마다 두 곳이 어긋난다 (PLAYBOOK §4).
 *
 * @param {Record<string, Record<string, unknown>>} table  dropTable(...) 의 결과
 * @param {string} kind  받는 물건의 종류 (표의 안쪽 키)
 * @param {(from: string, to: string) => string} nameOf  끄는 물건 종류 (와 받는 종류) → 화면에 쓸 이름.
 *   한 종류가 받는 쪽에 따라 다른 이름일 때(추출액 병→원심관, 전개액 병→바이알) 둘째 인자로 가른다.
 */
export function acceptsFrom(table, kind, nameOf) {
  return Object.keys(table)
    .filter((from) => table[from] && Object.prototype.hasOwnProperty.call(table[from], kind))
    .map((from) => nameOf(from, kind))
    .filter(Boolean);
}
