/**
 * 변인 설계 화면 — 조작변인 · 통제변인 · 종속변인.
 *
 * ── 이 파일에는 이 실험의 말이 하나도 없다 ─────────────────────────
 * 「온도」·「pH」·「과산화수소수」가 이 파일 어디에도 없다. 변인 목록은
 * `src/sim/state.js` 의 `INDEPENDENT_VARIABLES` · `VARIABLE_KEY` · `CHOICES` 에서,
 * 화면에 쓸 말은 `src/ui/strings.js` 의 `UI.variables` · `UI.conditions` · `UI.units` 에서 온다.
 *
 * 그래야 **다른 실험이 이 화면을 그대로 재활용한다.** 효모 발효 실험도 조작변인을 고르고
 * 통제변인을 맞추는 것은 똑같고, 갈리는 것은 목록뿐이다.
 * `tests/design.test.js` 가 이 파일에 실험 고유의 말이 섞이는지 훑는다.
 *
 * ── 막지 않는다 ────────────────────────────────────────────────────
 * 설계를 안 하고 실험을 시작해도, 조작변인을 도중에 바꿔도, 통제변인을 시행마다
 * 달리해도 **막지 않는다.** 여기서 나오는 것은 전부 **표시**다.
 * `disabled` 버튼이 하나도 없다 — `tests/ui.contract.test.js` 가 훑는다.
 *
 * ── 답을 먼저 말하지 않는다 ────────────────────────────────────────
 * 「온도를 고르면 37 ℃ 가 가장 빠릅니다」 같은 문구를 두지 않는다.
 * 이 화면이 하는 말은 **묻는 말**(`UI.variables[v].question`)까지다.
 */

import {
  INDEPENDENT_VARIABLES, VARIABLE_KEY, CHOICES, controlledKeys, defaultControls,
} from '../sim/state.js';
import { UI } from './strings.js';

const R = UI.variableRoles;

/** 조건 하나가 고를 수 있는 값들. 목록에 없는 조건(참/거짓)은 둘 중 하나다. */
function choicesFor(key) {
  return CHOICES[key] ?? [true, false];
}

/** 값 하나를 화면에 쓸 글자로. 표기는 전부 `UI.units` 에서 온다. */
function label(key, value) {
  const fmt = UI.units[key];
  return fmt ? fmt(value) : String(value);
}

/**
 * 값은 문자열로 오간다(`dataset`). 원래 자리로 되돌린다.
 * 참/거짓 조건을 문자열 `"true"` 로 저장하면 `offDesign` 이 늘 어긋났다고 말한다.
 */
function parseValue(key, raw) {
  if (!CHOICES[key]) return raw === 'true';
  return Number(raw);
}

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 */
export function createDesign(root, store) {
  root.classList.add('design');

  function independentBlock(design) {
    const cards = INDEPENDENT_VARIABLES.map((v) => `
      <button type="button" class="design-pick" role="radio" data-independent="${v}"
        aria-checked="${design.independent === v}">
        <span class="design-pick-name">${UI.variables[v].name}</span>
        <span class="design-pick-desc">${UI.variables[v].question}</span>
      </button>`).join('');
    return `
      <section class="design-section">
        <h3>${R.independent}</h3>
        <p class="design-hint">${R.independentHint}</p>
        <div class="design-picks" role="radiogroup" aria-label="${R.independent}">${cards}</div>
      </section>`;
  }

  /**
   * 통제변인.
   *
   * 조작변인이 차지한 조건은 **목록에서 빠진다** — 같은 것을 두 번 정하게 하지 않는다.
   * 아직 조작변인을 안 골랐으면 전부 통제변인으로 보여 준다. 그래야 무엇을 붙들어야
   * 하는지 먼저 볼 수 있다.
   */
  function controlBlock(design) {
    const keys = design.independent ? controlledKeys(design) : Object.keys(defaultControls());
    const rows = keys.map((key) => {
      const chips = choicesFor(key).map((value) => `
        <button type="button" class="design-chip" role="radio"
          data-control="${key}" data-value="${value}"
          aria-checked="${design.controls[key] === value}">${label(key, value)}</button>`).join('');
      return `
        <div class="design-row">
          <span class="design-row-name">${UI.conditions[key]}</span>
          <div class="design-chips" role="radiogroup" aria-label="${UI.conditions[key]}">${chips}</div>
        </div>`;
    }).join('');
    return `
      <section class="design-section">
        <h3>${R.control}</h3>
        <p class="design-hint">${R.controlHint}</p>
        ${rows}
      </section>`;
  }

  /** 종속변인은 고를 것이 없다. 그래도 보여 주는 것은 **무엇을 재는지 알고 시작하기 위해서**다. */
  function dependentBlock() {
    return `
      <section class="design-section">
        <h3>${R.dependent}</h3>
        <p class="design-hint">${R.dependentHint}</p>
        <p class="design-dependent">${UI.dependentName}</p>
      </section>`;
  }

  function render() {
    const { design } = store.getState();
    root.innerHTML = `
      <div class="design-card">
        <h2>${UI.design.title}</h2>
        <p class="design-lead">${UI.design.lead}</p>
        ${independentBlock(design)}
        ${controlBlock(design)}
        ${dependentBlock()}
        <button type="button" class="design-go" id="design-go">
          ${design.declared ? UI.design.declared : UI.design.declare}
        </button>
        <p class="design-note">${UI.design.notALock}</p>
      </div>`;
  }

  // 클릭은 위임으로 받는다. 다시 그릴 때마다 붙잡아 둔 노드가 문서에서 떨어져 나가는데,
  // 떨어져 나간 노드에 건 리스너는 조용히 아무 일도 안 한다 — 바나나랩에서 물린 자리다.
  //
  // `click` 을 듣는 것도 일부러다. 포인터 이벤트만 들으면 `element.click()` 이 아무 일도
  // 안 하고, **보조기기(음성 제어·스크린리더)로는 조작을 아예 못 한다.**
  root.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-independent]');
    if (pick) {
      store.dispatch('SET_INDEPENDENT', { variable: pick.dataset.independent });
      return;
    }
    const chip = e.target.closest('[data-control]');
    if (chip) {
      store.dispatch('SET_CONTROL', {
        key: chip.dataset.control,
        value: parseValue(chip.dataset.control, chip.dataset.value),
      });
      return;
    }
    if (e.target.closest('#design-go')) store.dispatch('DECLARE_DESIGN', {});
  });

  store.subscribe(render);
  render();
  return { render };
}

/**
 * 설계를 한 문장으로. 탐구 노트와 보고서가 같은 문장을 쓴다 —
 * 두 곳에서 따로 만들면 학생이 적은 설계와 보고서의 설계가 달라진다.
 */
export function designSentence(design) {
  if (!design.independent) return UI.design.noIndependent;
  const changing = UI.variables[design.independent].name;
  const held = controlledKeys(design)
    .map((k) => `${UI.conditions[k]} ${label(k, design.controls[k])}`)
    .join(' · ');
  return UI.design.sentence(changing, held, UI.dependentName);
}

/** 조작변인이 실제로 건드리는 조건 칸. 실험대가 「지금 바꿀 것」을 짚을 때 쓴다. */
export function independentKey(design) {
  return VARIABLE_KEY[design.independent] ?? null;
}
