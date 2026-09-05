/**
 * 탐구 노트에 붙는 모둠 부품 — 여덟 실험이 같은 것을 쓴다.
 *
 *   mountGroupHead(noteRoot, ctx)   노트 머리 밑에 모둠 칸 (모둠명·역할·별명·모인 수·단추)
 *   decorateNoteFields(panel, ctx)  그려진 노트 판의 `textarea[data-note]` 마다 모둠원 기록 카드를 붙인다
 *
 * ── 모둠장의 노트가 곧 모둠 정리다 ───────────────────────────────────
 * 따로 「정리 칸」을 만들지 않는다. 모둠장 화면의 **원래 칸** 아래에 모둠원 카드가 붙고,
 * 「초안 채우기」가 그 칸에 합친 문장을 넣는다 (`merge.js`). 그러면 보고서(`report.js`)는
 * 지금처럼 모둠장의 노트를 읽기만 하면 된다 — 종이가 읽는 자리를 하나도 안 늘린다.
 *
 * ── 왜 노트를 다 그린 뒤에 붙이는가 ──────────────────────────────────
 * 실험마다 노트가 다르고 칸이 스무 개가 넘는다. 칸마다 손으로 끼우면 여덟 실험 × 스무 자리다.
 * 판을 그린 뒤 `textarea[data-note]` 를 훑어 붙이면 **한 줄**이고, 실험이 칸을 늘려도 따라간다.
 */

import { G } from './strings.js';
import { mergeEntries } from './merge.js';
import { recordOf } from './store.js';
import { openSendDialog } from './send-ui.js';
import { openCollectDialog } from './collect-ui.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @typedef {object} GroupCtx
 * @property {ReturnType<import('./store.js').createGroupStore>} groupStore
 * @property {{getState:Function, dispatch:Function}} store   실험 store — 초안을 SAVE_NOTE 로 넣는다
 * @property {HTMLElement} host        대화상자를 붙일 빈 상자
 * @property {string} exp              실험 이름 ('banana' …)
 * @property {(cap:any)=>number} [capScore]  캡처 하나의 관찰 가능성 점수
 * @property {()=>void} [rerender]     기록이 들어오면 노트를 다시 그린다
 */

/** 노트 머리 밑의 모둠 칸. groupStore 가 바뀔 때마다 다시 그린다. */
export function mountGroupHead(noteRoot, ctx) {
  const { groupStore } = ctx;
  let slot = noteRoot.querySelector('#group-head');
  if (!slot) {
    slot = document.createElement('section');
    slot.id = 'group-head';
    slot.className = 'group-head';
    const head = noteRoot.querySelector('.note-head');
    if (head) head.insertAdjacentElement('afterend', slot);
    else noteRoot.prepend(slot);
  }

  function paint() {
    const me = groupStore.me;
    const leader = groupStore.isLeader();
    const members = groupStore.members();
    const want = groupStore.expected();
    const nick = me.nick || G.nickFallback;
    const list = members.map((m) => `
      <li><span>${esc(m.nick)}</span>
        <button type="button" class="group-remove" data-remove="${esc(m.nick)}"
          aria-label="${esc(G.removeLabel(m.nick))}">${G.removeMember}</button></li>`).join('');
    slot.innerHTML = `
      <div class="group-head-row">
        <h2 class="group-title">${esc(G.panelTitle(me.name))}</h2>
        <span class="group-badge" data-role="${me.role}">${G.roleBadge[me.role]}</span>
        <span class="group-nick">${esc(G.nickLine(nick))}</span>
      </div>
      ${leader ? `
        <p class="group-hint">${G.leaderHint}</p>
        <div class="group-actions">
          <button type="button" id="group-collect-btn">${G.collectButton}</button>
          <span class="group-count">${members.length ? G.collected(members.length, want) : G.collectedNone}</span>
        </div>
        ${members.length ? `<ul class="group-members">${list}</ul>` : ''}`
      : `
        <p class="group-hint">${G.memberHint}</p>
        <div class="group-actions">
          <button type="button" id="group-send-btn">${G.sendButton}</button>
        </div>`}`;

    slot.querySelector('#group-send-btn')?.addEventListener('click', () => {
      const record = recordOf(ctx.store.getState(), me, { exp: ctx.exp, capScore: ctx.capScore });
      openSendDialog(ctx.host, record);
    });
    slot.querySelector('#group-collect-btn')?.addEventListener('click', () => {
      openCollectDialog(ctx.host, groupStore, { exp: ctx.exp });
    });
    slot.querySelectorAll('[data-remove]').forEach((b) => {
      b.addEventListener('click', () => groupStore.removeMember(b.dataset.remove));
    });
  }

  paint();
  groupStore.subscribe(() => { paint(); ctx.rerender?.(); });
  return slot;
}

/**
 * 그려진 노트 판에서 `textarea[data-note]` 마다 모둠원 기록을 붙인다. **모둠장 화면에만.**
 * 같은 칸에 쓴 사람이 없으면 아무것도 안 붙는다 — 빈 카드는 소음이다.
 */
export function decorateNoteFields(panel, ctx) {
  const { groupStore, store } = ctx;
  if (!groupStore?.isLeader()) return;
  panel.querySelectorAll('textarea[data-note]').forEach((ta) => {
    const key = ta.dataset.note;
    const entries = groupStore.entriesFor(key);
    if (entries.length === 0) return;
    const { sentences } = mergeEntries(entries);
    const cards = entries.map((e) => `
      <li class="group-entry"><b>${esc(e.nick)}</b><span>${esc(e.text)}</span></li>`).join('');
    // 여럿이 같은 말을 한 문장이 몇인지 — 토의에서 먼저 볼 자리다
    const agreed = sentences.filter((s) => s.by.length > 1).length;
    const box = document.createElement('div');
    box.className = 'group-entries';
    box.innerHTML = `
      <div class="group-entries-head">
        <span>${G.entriesHeading} · ${entries.length}명${agreed ? ` · ${G.agreeMark(agreed)}` : ''}</span>
        <button type="button" class="group-fill" data-fill="${esc(key)}" title="${esc(G.fillDraftTitle)}">${G.fillDraft}</button>
      </div>
      <ul class="group-entry-list">${cards}</ul>`;
    ta.insertAdjacentElement('afterend', box);
    box.querySelector('.group-fill').addEventListener('click', () => {
      const { draft } = mergeEntries([
        // 모둠장 자신이 쓴 것도 한 사람 몫으로 넣는다 — 지워지지 않는다
        ...(ta.value.trim() ? [{ nick: groupStore.me.nick || G.nickFallback, text: ta.value }] : []),
        ...entries,
      ]);
      if (ta.value.trim() && !window.confirm(G.fillConfirm)) return;
      ta.value = draft;
      store.dispatch('SAVE_NOTE', { step: key, text: draft });
    });
  });
}
