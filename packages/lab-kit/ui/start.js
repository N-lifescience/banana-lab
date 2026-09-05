/**
 * 시작 화면 — 난이도 고르기.
 *
 * 앞서는 주소(`?level=2`)로만 정할 수 있었다. 그러면 링크를 받지 못한 학생은
 * 1단계밖에 못 만나고, `docs/06` 이 정한 세 단계가 구현돼 있어도 아무도 닿지 못한다.
 *
 * 주소로 정한 값이 있으면 이 화면을 건너뛴다 — 교사가 반이나 모둠에 따라
 * 다른 링크를 나눠 주는 길은 그대로 남는다.
 *
 * ── 공용이다 (합치기 4단계, 2026-08-30) ──────────────────────────────
 * 세 실험의 이 파일이 **바이트까지 같았다.** 난이도를 고르는 일에 실험의 사정이
 * 들어갈 자리가 없기 때문이다. 문구만 실험 것이라 `createStart(…, UI)` 로 받는다.
 *
 * ── 모둠 짜기 (T35, 2026-09-05) ─────────────────────────────────────
 * 「모둠으로 합니다」를 고르면 모둠명·인원·역할·별명을 받는다. **이름·학번은 받지 않는다**
 * — 그것은 보고서를 만들 때만 받는다 (`report.js`). 여기서 받은 것은 `onStart(level, mode, group)`
 * 의 셋째 인자로 나가고, 실험 store 가 아니라 `createGroupStore` 에 산다.
 * 아무것도 안 적어도 시작된다 — 막지 않는다. 별명이 비면 「모둠원」이다.
 */

import { G } from '../group/strings.js';
import { clampSize, DEFAULT_SETUP } from '../group/store.js';

/**
 * @param {HTMLElement} root
 * @param {(level:number, mode:string, group?:object)=>void} onStart 고른 단계·방식으로 실험을 시작한다
 * @param {number} initial 처음 골라 둘 단계
 * @param {string} initialMode 처음 골라 둘 방식 ('solo' | 'group')
 */
/**
 * @param {{lock?:boolean}} [opts]  lock — 단계·방식은 주소가 정했다. 모둠 짜기만 보인다 (T35)
 */
export function createStart(root, onStart, initial = 1, initialMode = 'group', UI = null, { lock = false } = {}) {
  /*
   * ★ **문구는 실험 것이라 받아 온다** (`MERGE-AND-DEPLOY.md` §3.3).
   *   앞서 이 파일은 `./strings.js` 를 직접 읽었다. 실험 여덟이 함께 쓰는 지금
   *   그러면 **자기 폴더의 남의 문구**를 읽게 된다.
   *   안 넘기면 화면이 `undefined` 를 그리므로 여기서 멎는다.
   *   (합치기 4단계, 2026-08-30 — 세 사본이 바이트까지 같아 올렸다)
   */
  if (!UI?.start) throw new Error('시작 화면에 이 실험의 UI 를 넘겨야 합니다 (UI.start)');
  const S = UI.start;
  let level = initial;
  // 혼자 하는가 모둠으로 하는가. 도중에 바꾸는 길은 두지 않는다 — 난이도와 같은 이유다.
  // 이 값이 탐구 노트에서 **무엇을 묻는지**를 가른다 (토의 기록·다른 모둠과의 비교).
  let mode = initialMode;
  let role = DEFAULT_SETUP.role;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  root.innerHTML = `
    <div class="start-card" role="dialog" aria-labelledby="start-title">
      <h1 id="start-title">${UI.appTitle}</h1>
      <p class="start-lead">${S.lead}</p>
      <div class="start-levels" role="radiogroup" aria-label="${S.chooseLabel}">
        ${S.levels.map((l) => `
          <button type="button" class="start-level" role="radio" data-level="${l.id}"
            aria-checked="${l.id === level}">
            <span class="start-level-name">${l.name}</span>
            <span class="start-level-desc">${l.desc}</span>
          </button>`).join('')}
      </div>
      <h2 class="start-sub">${S.modeLabel}</h2>
      <div class="start-levels start-modes" role="radiogroup" aria-label="${S.modeLabel}">
        ${S.modes.map((m) => `
          <button type="button" class="start-level" role="radio" data-mode="${m.id}"
            aria-checked="${m.id === mode}">
            <span class="start-level-name">${m.name}</span>
            <span class="start-level-desc">${m.desc}</span>
          </button>`).join('')}
      </div>
      <section class="start-group" id="start-group">
        <h2 class="start-sub">${G.setupHeading}</h2>
        <p class="start-group-lead">${G.setupLead}</p>
        <div class="start-group-fields">
          <label class="start-field start-field--wide">
            <span>${G.nameLabel}</span>
            <input type="text" id="sg-name" placeholder="${esc(G.namePlaceholder)}" autocomplete="off" maxlength="30">
          </label>
          <label class="start-field">
            <span>${G.sizeLabel}</span>
            <input type="number" id="sg-size" min="2" max="8" value="${DEFAULT_SETUP.size}" inputmode="numeric">
          </label>
          <label class="start-field start-field--wide">
            <span>${G.nickLabel}</span>
            <input type="text" id="sg-nick" placeholder="${esc(G.nickPlaceholder)}" autocomplete="off" maxlength="16">
          </label>
        </div>
        <h3 class="start-sub">${G.roleLabel}</h3>
        <div class="start-levels start-roles" role="radiogroup" aria-label="${G.roleLabel}">
          ${G.roles.map((r) => `
            <button type="button" class="start-level" role="radio" data-role="${r.id}"
              aria-checked="${r.id === role}">
              <span class="start-level-name">${r.name}</span>
              <span class="start-level-desc">${r.desc}</span>
            </button>`).join('')}
        </div>
      </section>
      <button type="button" class="start-go" id="start-go"></button>
    </div>`;

  const goBtn = root.querySelector('#start-go');
  const groupEl = root.querySelector('#start-group');

  function paint() {
    root.querySelectorAll('.start-level[data-level]').forEach((b) => {
      b.setAttribute('aria-checked', String(Number(b.dataset.level) === level));
    });
    root.querySelectorAll('.start-level[data-mode]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.mode === mode));
    });
    root.querySelectorAll('.start-level[data-role]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.role === role));
    });
    groupEl.hidden = mode !== 'group';
    goBtn.textContent = S.go(S.levels.find((l) => l.id === level).name);
    // 주소가 단계·방식을 정한 링크 — 그 둘은 접고 모둠 짜기만 남긴다
    if (lock) {
      root.querySelectorAll('.start-levels[aria-label], .start-sub').forEach((el) => {
        if (!groupEl.contains(el)) el.hidden = true;
      });
    }
  }

  root.querySelectorAll('.start-level[data-mode]').forEach((b) => {
    b.addEventListener('click', () => { mode = b.dataset.mode; paint(); });
  });
  root.querySelectorAll('.start-level[data-role]').forEach((b) => {
    b.addEventListener('click', () => { role = b.dataset.role; paint(); });
  });

  root.querySelectorAll('.start-level[data-level]').forEach((b) => {
    b.addEventListener('click', () => { level = Number(b.dataset.level); paint(); });
    // 라디오 그룹은 화살표로 옮기는 것이 표준 동작이다.
    b.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      level = ((level - 1 + dir + S.levels.length) % S.levels.length) + 1;
      paint();
      root.querySelector(`.start-level[data-level="${level}"]`).focus();
    });
  });

  /** 모둠으로 할 때 받은 것. 혼자면 null — 모둠 store 를 만들 일이 없다. */
  function groupSetup() {
    if (mode !== 'group') return null;
    return {
      name: root.querySelector('#sg-name').value.trim(),
      size: clampSize(root.querySelector('#sg-size').value),
      role,
      nick: root.querySelector('#sg-nick').value.trim(),
    };
  }

  goBtn.addEventListener('click', () => onStart(level, mode, groupSetup()));

  paint();
  (lock ? root.querySelector('#sg-name') : root.querySelector(`.start-level[data-level="${level}"]`)).focus();
}
