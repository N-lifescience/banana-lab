/**
 * 시작 화면 — 난이도 고르기.
 *
 * 앞서는 주소(`?level=2`)로만 정할 수 있었다. 그러면 링크를 받지 못한 학생은
 * 1단계밖에 못 만나고, `docs/06` 이 정한 세 단계가 구현돼 있어도 아무도 닿지 못한다.
 *
 * 주소로 정한 값이 있으면 이 화면을 건너뛴다 — 교사가 반이나 모둠에 따라
 * 다른 링크를 나눠 주는 길은 그대로 남는다.
 */

import { UI } from './strings.js';

const S = UI.start;

/**
 * @param {HTMLElement} root
 * @param {(level:number)=>void} onStart 고른 단계로 실험을 시작한다
 * @param {number} initial 처음 골라 둘 단계
 */
export function createStart(root, onStart, initial = 1) {
  let level = initial;

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
      <button type="button" class="start-go" id="start-go"></button>
      <p class="start-note">${S.note}</p>
    </div>`;

  const goBtn = root.querySelector('#start-go');

  function paint() {
    root.querySelectorAll('.start-level').forEach((b) => {
      b.setAttribute('aria-checked', String(Number(b.dataset.level) === level));
    });
    goBtn.textContent = S.go(S.levels.find((l) => l.id === level).name);
  }

  root.querySelectorAll('.start-level').forEach((b) => {
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

  goBtn.addEventListener('click', () => onStart(level));

  paint();
  root.querySelector(`.start-level[data-level="${level}"]`).focus();
}
