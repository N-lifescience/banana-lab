/**
 * 탐구 노트 — 7단계 패널.
 *
 * docs/06-lab-notebook.md 의 7단계(문제 인식~자기 평가)를 최상위 탭으로, T04 까지 탭으로
 * 조작 절차 여섯(표피 벗기기~증류수로 되돌리기)은 4단계 「탐구 과정」 안의 STEP 으로 내린다.
 * strings.js 의 UI.protocol 이 이미 그 6개 STEP 의 제목/세부 단계 텍스트를 갖고 있으므로
 * 그대로 재사용하고, 세부 단계 id(1a, 1b, 2a…)는 배열 순서에서 글자를 붙여 만든다.
 *
 * 결과를 바꾸는 조작은 전부 store.dispatch('SAVE_NOTE', …) 를 거쳐 reduce() 로 간다 — 이 파일은
 * session.notes 를 직접 대입하지 않는다.
 */

import { SLIDE_IDS, MODES, SIDES } from '../sim/state.js';
import { changeStage } from '../sim/osmosis.js';
import { ASSETS } from '../assets/index.js';
import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { gradeQuestion, gradeMagnification } from './grading.js';
import { EYEPIECE } from '../sim/optics.js';
import { UI, emphasize } from './strings.js';
import {
  stepDone, groupDone, resultsDone, CONDITIONS, captureForCondition, capturedSolutions,
} from '../sim/progress.js';


const N = UI.notebook;

/** 흐림 판정 기준 점수. observability().score 가 이보다 낮으면 성찰 문항이 붙는다. */
// ponytail: 임계값 추정치. docs/06 에 정확한 수치가 없다 — 체감상 어긋나면 이 숫자만 바꾸면 된다.
const LOW_OBSERVABILITY = 60;

/**
 * 화면에 넣기 전에 막는다.
 *
 * **따옴표까지 막는다.** 학생이 쓴 글이 본문에만 들어가는 게 아니라 속성 안에도 들어가기 때문이다
 * (5단계 배율 칸의 `value="…"`). `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가
 * 새 속성을 붙일 수 있다. 자기 화면에만 영향을 주는 자리이지만, 그 글은 보고서로 인쇄되고
 * 남에게 건네진다. 막는 값이 셋에서 다섯으로 느는 것뿐이라 굳이 자리를 가리지 않는다.
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * 관찰 기록 칸에 흐리게 띄울 예시 문구.
 *
 * "관찰 기록" 이라고만 써 두면 무엇을 어떻게 적어야 할지 감이 안 온다.
 * placeholder 라 칸을 누르는 순간 사라지고, 학생이 쓴 글과 섞이지 않는다 — 브라우저가 하는 일이다.
 *
 * **1단계는 세부 단계마다 다른 예시를 띄운다.** 스무 칸에 같은 문장을 띄우면
 * 무엇을 적으라는 건지 알려 주지 못하고, 그 자리에서 관찰한 것이 아니라 앞 칸을 베끼게 만든다.
 * 2단계는 무엇을 적을지만 알려 주는 한 줄, 3단계는 비운다 —
 * 무엇을 적을지 스스로 정하는 것도 이 실험의 일부다.
 */
function notePlaceholder(level, step) {
  if (level === 1) return step?.eg ?? '';
  return UI.notebook.notePlaceholders[level] ?? '';
}

/**
 * STEP 을 **한 번에 하나만** 펼친다 — 4절이 「읽을 글」이 아니라 「따라가는 길」이 되게.
 *
 * 여럿을 한꺼번에 펼쳐 놓으면 학생이 그것을 읽을거리로 받는다. 주욱 읽고 내려간 다음
 * 실험대로 가서 무엇부터 할지 몰라 멈춘다. 지금 할 것 하나만 펼치면 다음 손짓이 분명해진다.
 *
 * **「지금 STEP」은 따로 저장하지 않는다** — 끝나지 않은 첫 STEP 이 곧 지금이다.
 * 실험대에서 한 일이 그대로 노트를 넘긴다. 저장하면 둘이 어긋날 자리가 생긴다.
 *
 * **접힘은 잠금이 아니다.** 앞으로 올 STEP 도 눌러서 열리고, 순서를 건너뛰어 실험한
 * 학생은 거기에 적으면 된다 (`AGENTS.md` §2.1 — 잘못된 조작을 막지 않는다).
 * 그리고 앞으로 올 STEP 을 **지우지 않는다.** 몇 칸짜리 여정인지 보여야 어디쯤인지 안다.
 *
 * @param {{id:string}[]} groups
 * @param {boolean[]} groupsDone            STEP 마다 끝났는가
 * @param {Map<string,boolean>} manualOpen  학생이 손으로 여닫은 기록 (STEP id → 열림)
 * @returns {{state:'done'|'now'|'later', open:boolean}[]}
 */
export function stepPanelStates(groups, groupsDone, manualOpen = new Map(), nowIdxIn) {
  /*
   * **「지금 자리」는 밖에서 받는다.**
   *
   * 여기서 `groupsDone.findIndex((d) => !d)` 로 따로 세고 있었는데, 그리는 쪽은
   * **「조작을 마쳤고 적기까지 한」 첫 STEP** 으로 센다. 둘이 갈리면 이런 일이 난다 —
   * 조작은 끝냈는데 기록을 안 적은 STEP 이 있으면, 그리는 쪽은 그것을 「지금」이라 하고
   * 여기서는 그 **다음**을 편다. 그런데 그 다음은 잠겨 있어 안 열린다.
   * 결과는 **아무것도 펼쳐지지 않은 화면** — 적어야 할 칸이 접힌 채 숨는다. 실제로 그랬다.
   */
  const nowIdx = nowIdxIn ?? groupsDone.findIndex((d) => !d);   // 다 끝났으면 -1
  return groups.map((group, gi) => {
    const isDone = groupsDone[gi];
    const isNow = gi === nowIdx;
    return {
      state: isDone ? 'done' : (isNow ? 'now' : 'later'),
      // 손으로 여닫은 것이 있으면 그것이 이긴다. 없으면 지금 할 STEP 만 펼친다.
      open: manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow,
    };
  });
}

/** STEP(UI.protocol 의 한 원소) 안에서 i번째 세부 단계의 저장 키. '3b' 같은 형태. */
function substepId(group, i) {
  return `${group.id}${String.fromCharCode(97 + i)}`;
}

/**
 * 절차 기록 키인가. `'3b'`, `'12'` 처럼 **그룹 id + 선택적 세부 단계 글자**다.
 *
 * 예전에는 `/^[1-6][a-z]?$/` 로 박혀 있었다. 바나나랩 절차가 여섯 그룹이라 맞아떨어졌지만,
 * **그것은 이 실험의 사정이지 엔진의 사정이 아니다.** 일곱 번째 그룹을 둔 실험은
 * 그 그룹의 관찰 기록이 6단계 복습과 보고서에서 **조용히 사라진다** — 화면에 빈칸이
 * 뜨는 것이 아니라 줄 자체가 안 나오므로 아무도 모른다.
 * (micrometer 파일럿에서 잡혔다. PROGRESS T28)
 *
 * 이제 개수를 세지 않고 `UI.protocol` 에 그 id 가 실제로 있는지로 본다.
 */
export function isStepNoteKey(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  return Boolean(m) && UI.protocol.some((g) => g.id === m[1]);
}

/** notes 키 '3b' 를 "STEP 3 · 색 변화 관찰" 같은 사람이 읽는 문장으로. */
export function stepNoteLabel(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  if (!m) return key;
  const group = UI.protocol.find((g) => g.id === m[1]);
  if (!group) return key;
  const title = m[2] ? group.steps[m[2].charCodeAt(0) - 97]?.label : group.title;
  return `STEP ${group.id} · ${title ?? group.title}`;
}

/**
 * 실제로 **무엇이 보였는가**.
 *
 * 예상과 견주는 자리다 — 학생이 "세포가 쭈그러들 것 같다" 고 예상했는데 실제 결과가
 * 용액 이름이면 견줄 것이 없다. 눈으로 본 것을 말한다.
 *
 * **낱말로 답을 주지 않는다.** 「원형질 분리가 일어났습니다」 라고 적으면 정리 단계에서
 * 그 낱말을 묻는 문항이 받아쓰기가 된다. 보인 모양만 말하고 이름은 학생이 붙인다.
 * 원형질분리 세포의 **비율도 적지 않는다** — 세는 것이 이 실험의 탐구다.
 *
 * 보고서(`report.js`)도 같은 문장을 쓴다 — 화면과 종이가 다른 말을 하면 안 된다.
 */
export function actualSummary(st, condition) {
  const cap = captureForCondition(st, condition);
  if (!cap) return `${N.actualNoSample} ${N.actualNotCaptured}`;

  let seen;
  if (!cap.side) seen = N.actualNoSample;
  else if (cap.side === SIDES.INNER) seen = N.actualNoPigment;
  else if (cap.settled === false) seen = N.actualPending;
  else {
    const stage = changeStage(cap.equivPct);
    seen = stage === 'turgid' ? N.actualTurgid
      : stage === 'mixed' ? N.actualMixed
        : N.actualPlasmolysed;
  }
  return `${seen} (${UI.observability.label} ${observability(cap).score})`;
}

/** 모둠으로 하는 세션인가. 혼자라면 토의·모둠 비교 문항을 아예 내지 않는다. */
export function isGroup(st) {
  return (st.session.mode ?? MODES.GROUP) === MODES.GROUP;
}

/**
 * 보고서를 낼 수 있는가, 아직 무엇이 남았는가.
 *
 * 「보고서 만들기」 를 늘 띄워 두면 첫 화면에서부터 눌러 빈 종이를 뽑는다. 그 종이를 낸
 * 학생은 자기가 무엇을 안 했는지 **종이를 보고서야** 안다.
 * 막는 것이 목적이 아니므로, 감추는 자리에 **무엇이 남았는지**를 대신 적는다.
 *
 * 5~7 단계는 결과가 있어야 채울 수 있어서 여기에 넣고, 1·2 단계(문제 인식·준비물)는
 * 읽기만 하는 쪽이라 넣지 않는다 — 그쪽은 실험대 자물쇠가 이미 챙긴다 (`src/ui/bench.js`).
 *
 * @returns {{ready: boolean, missing: string[]}}
 */
/** 칸이 채워졌는가. 공백만 있는 것은 안 채운 것이다. */
const hasNote = (st, key) => String(st.session.notes[key] ?? '').trim().length > 0;

/*
 * 쪽마다 "다 했는가". 탭의 ✓ 와 보고서 단추가 **같은 함수**를 본다.
 * 따로 세면 언젠가 어긋나고, 그때 학생은 탭이 전부 ✓ 인데 보고서가 안 나오는 화면을 본다.
 */
/**
 * 이 STEP 의 관찰 기록을 다 적었는가.
 *
 * ── 정본(banana-lab)과 **다른 곳** ──────────────────────────────────
 * 정본은 `group.steps.every(...)` 로 **모든 세부 단계**에 기록을 요구한다. 거기는 단계마다
 * 글칸이 있기 때문이다. **이 실험은 열아홉 단계 중 일곱에만 칸이 있다** —
 * 「조작의 결과가 시야에 나타나는 자리만」 남겼고, STEP 1·2 는 칸이 **하나도 없다.**
 *
 * 그래서 정본 그대로 쓰면 **적을 자리도 없는 칸을 기다리다 STEP 2 부터 영영 잠긴다.**
 * 칸이 있는 단계만 본다. 칸이 없는 STEP 은 적을 것이 없으므로 「다 적었다」로 본다.
 */
export function stepNotesWritten(st, group) {
  if (qaEmpty(st, group)) return false;
  if (st.session.level >= 3) return hasNote(st, group.id);
  return group.steps.every((s, i) => !s.note || hasNote(st, substepId(group, i)));
}

/**
 * 질문 ⓐ 를 어느 STEP 밑에 붙이는가 — **STEP 4 (용액 치환하기)**. 종이를 대기 전과 후를
 * 눈으로 본 **직후**의 자리다 (`docs/06`). 그리는 곳과 「다 적었는가」(`qaEmpty`)가 같은 번호를 본다.
 */
export const QUESTION_A_STEP = '4';

/**
 * 질문 ⓐ 가 붙은 STEP 은 **ⓐ 까지 적어야 「다 적은 것」이다** (정본 banana 와 같다).
 *
 * 앞서는 4d 를 적는 순간 STEP 4 가 「다 적었다」가 되어 접히고 ⓐ 가 눈앞에서 사라져서,
 * 접히지 않게 따로 붙잡아 두었다. 이제 ⓐ 를 그 STEP 의 관찰 기록 칸 하나로 센다 —
 * 비워 두면 STEP 4 가 펼쳐진 채 남고 다음 STEP 은 잠겨 있다. 다른 기록칸과 똑같다.
 * **막는 것이 아니다** (AGENTS.md §2.1) — 실험대 조작은 아무것도 막지 않는다.
 */
function qaEmpty(st, group) {
  return group.id === QUESTION_A_STEP && !hasNote(st, 'q.a');
}


/** 실험대가 아직 잠겨 있는가. 노트가 「실험대에서 해 보세요」라고 말해도 되는지 가른다. */
const benchLocked = (st) =>
  !UI.bench.lock.required.every((id) => (st.session.readStages ?? []).includes(id));

const predictDone = (st) => CONDITIONS.every((c) => hasNote(st, `predict.${c}`));

/**
 * **보고서를 막는 서술형 키.** 여기 있는 키는 반드시 **아코디언 밖에도** 적을 칸이 있어야 한다.
 *
 * 4절의 STEP 은 한 번에 하나만 펼쳐진다. 보고서를 가르는 답을 STEP 안에만 두면,
 * 그 STEP 이 접히는 순간 **답할 칸이 화면 어디에도 없는 채로 보고서만 막힌다** —
 * 학생은 「남은 것」 목록을 보면서 어디에 적어야 하는지 못 찾는다.
 * (fermentation 세션이 자기 저장소에서 그 자리를 찾아 알려 줬다.)
 *
 * 여기 `q.a` 는 STEP 4 안에도 있지만 **6쪽(정리)에도 같은 칸이 있다** — 같은
 * `notes['q.a']` 를 쓰므로 어느 쪽에서 적어도 한 벌이다. 그래서 접혀도 길이 남는다.
 * `scripts/check-ui.mjs` 가 이 목록을 그대로 읽어 아코디언 밖에 칸이 있는지 확인한다.
 */
export const REPORT_REQUIRED_NOTE_KEYS = ['q.a', 'q2', 'q3'];
/** 모둠일 때만 추가로 막는 키. 혼자 하는 학생에게는 물을 수 없는 질문이다. */
export const REPORT_REQUIRED_GROUP_KEYS = ['q4'];

const wrapupDone = (st) =>
  [...REPORT_REQUIRED_NOTE_KEYS, ...(isGroup(st) ? REPORT_REQUIRED_GROUP_KEYS : [])]
    .every((k) => hasNote(st, k));
const selfEvalDone = (st) => N.selfEvalItems.every(({ key }) => hasNote(st, `selfeval.${key}`));

/**
 * 탐구 노트의 한 쪽이 끝났는가 — 탭에 ✓ 를 붙일지 정한다.
 *
 * 1~4 쪽은 **읽었는가**로 본다(실험대를 여는 조건이 그것이다).
 * 5~7 쪽은 **채워졌는가**로 본다. 같은 ✓ 를 쓰지만 뜻은 하나다 — "이 쪽은 할 일을 마쳤다".
 */
export function stageDone(st, id) {
  if (UI.bench.lock.required.includes(id)) return (st.session.readStages ?? []).includes(id);
  if (id === '5') return resultsDone(st);
  if (id === '6') return wrapupDone(st);
  if (id === '7') return selfEvalDone(st);
  return false;
}

export function reportReadiness(st) {
  const missing = [];
  if (!predictDone(st)) missing.push(N.reportTodo.predict);
  // (가)(나)(다)를 한 번씩은 봐야 한다. 이 실험이 하려는 일이 그것이다.
  // 금이 가서 못 본 슬라이드가 있어도 받침 유리 통에서 새로 만들 수 있다.
  if (!resultsDone(st)) missing.push(N.reportTodo.captures);
  if (!wrapupDone(st)) missing.push(N.reportTodo.wrapup);
  if (!selfEvalDone(st)) missing.push(N.reportTodo.selfEval);
  return { ready: missing.length === 0, missing };
}

export function createNotebook(root, store, { onOpenZoom, onReport, onReady }) {
  root.innerHTML = `
    <div class="note-head">
      <h1>${N.heading}</h1>
      <div id="report-slot" class="report-slot"></div>
    </div>
    <div id="note-tabs" class="note-tabs" role="tablist"></div>
    <div id="note-panel" class="note-panel"></div>`;

  const reportSlot = root.querySelector('#report-slot');

  /**
   * 학생이 **손으로** 여닫은 STEP. 다시 그려도 그대로 남아야, 앞으로 올 STEP 을 펼쳐 놓고
   * 실험대에서 손을 댈 수 있다. 화면에만 있는 것이라 상태에 넣지 않는다 —
   * 보고서에 나가지도, 다시 열었을 때 이어지지도 않아야 하는 값이다.
   */
  const manualOpen = new Map();

  /**
   * **한 번이라도 열려 있던 STEP.** 잠금은 여기 없는 것에만 건다.
   * 열려 있던 칸이 나중에 사라지면 그건 잠금이 아니라 고장으로 읽힌다.
   */
  const everOpened = new Set();

  /**
   * 보고서 단추는 **다 마무리했을 때** 나온다. 그 전에는 남은 것을 적어 둔다.
   *
   * 단추를 회색으로 죽여 두지 않는다 — 눌리지 않는 단추는 왜 안 눌리는지 말해 주지 못한다.
   * 그 자리에 남은 것을 적은 목록을 대신 그린다.
   */
  // 방금 열렸는가. 학생이 다른 쪽을 보고 있을 수도 있으니 탭의 변화만으로는 부족하다.
  let wasReady = false;

  function renderReportSlot(st) {
    const { ready, missing } = reportReadiness(st);
    if (ready && !wasReady) onReady?.();
    wasReady = ready;
    if (ready) {
      reportSlot.innerHTML = `<button type="button" id="make-report">${UI.report.button}</button>`;
      // 보고서는 탐구 노트가 내놓는 것이라 여기 둔다. 여는 일만 넘기고, 만드는 일은 report.js 가 한다.
      reportSlot.querySelector('#make-report').addEventListener('click', () => onReport?.());
      return;
    }
    reportSlot.innerHTML = `
      <details class="report-todo">
        <summary>${N.reportLockedHint} (${missing.length})</summary>
        <ul>${missing.map((m) => `<li>${m}</li>`).join('')}</ul>
      </details>`;
  }

  const tabsEl = root.querySelector('#note-tabs');
  const panelEl = root.querySelector('#note-panel');
  let activeStage = N.stages[0].id;

  for (const stage of N.stages) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'note-tab';
    tab.textContent = `${stage.id}. ${stage.title}`;
    tab.setAttribute('role', 'tab');
    tab.dataset.stage = stage.id;
    tab.addEventListener('click', () => { activeStage = stage.id; render(); });
    tabsEl.appendChild(tab);
  }
  // 되돌리기 버튼은 실험대(`bench.js`) 에 있다. 되돌리는 대상이 조작이지 글이 아니기 때문이다.

  /* ---------------------------------------------------------------- */
  /* 1 문제 인식 · 2 준비물                                             */
  /* ---------------------------------------------------------------- */

  function renderStage1() {
    return `<p class="stage-text">${emph(N.problem)}</p>`;
  }

  /**
   * 2 준비물 — 이름만 늘어놓으면 실험대에서 그것을 못 찾는다.
   * **그림 · 이름 · 하는 일** 셋을 나란히 둔다. 그림은 실험대에 놓인 것과 같은 애셋이라
   * 노트에서 본 것을 실험대에서 그대로 알아본다.
   */
  function renderStage2() {
    const rows = N.materials.map(({ asset, name, role, state = {} }) => `
      <tr>
        <td class="mat-fig">${ASSETS[asset].render(state)}</td>
        <th scope="row">${name}</th>
        <td>${emph(role)}</td>
      </tr>`).join('');
    return `
      <h3>${N.materialsHeading}</h3>
      <table class="materials-table">
        <thead><tr><th>${N.matHeadFigure}</th><th>${N.matHeadName}</th><th>${N.matHeadRole}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="safety-note">
        <h3>${N.valuesLabel}</h3>
        <p class="stage-text values-lead">${emph(N.valuesLead)}</p>
        <ul class="values-list">${N.valuesList.map((line) => `<li>${emph(line)}</li>`).join('')}</ul>
      </section>`;
  }

  /* ---------------------------------------------------------------- */
  /* 3 예상 — 채점하지 않는다. 6단계에서 실제 결과와 나란히 보여 줄 뿐이다. */
  /* ---------------------------------------------------------------- */

  /**
   * 예상은 난이도에 따라 **묻는 방식**이 달라진다.
   *
   *   1단계 선택형    — 보기에서 고른다. 무엇을 예상해야 하는지 자체를 배우는 자리다.
   *   2단계 반주관식  — 보기에서 고르고, 왜 그렇게 생각했는지 한 줄 덧붙인다.
   *   3단계 완전 주관식 — 빈칸만 있다.
   *
   * 어느 쪽이든 답은 `notes['predict.X']` 한 곳에 **글로** 남는다.
   * 6단계에서 실제 결과와 나란히 놓고 견주기 때문에, 보기를 골랐어도 문장으로 남아야 한다.
   * 채점하지 않는다 — 예상은 맞히는 것이 아니라 세워 보는 것이다.
   */
  function renderStage3(st) {
    const level = st.session.level;
    // 무엇을 할지 모르는 채로 (가)(나)(다) 중 하나를 고르라고 하면 뜬금없다.
    // 할 일은 밝히고, 무엇이 보일지는 밝히지 않는다 — 그게 지금 묻고 있는 것이다.
    const lead = `<div class="predict-lead">${
      N.predictLeadIn.map((p) => `<p>${emph(p)}</p>`).join('')
    }</div>`;
    return lead + CONDITIONS.map((id) => {
      const key = `predict.${id}`;
      const val = st.session.notes[key] ?? '';
      const whyKey = `predict.why.${id}`;
      const choices = level >= 3 ? '' : `
        <div class="predict-choices" role="group" aria-label="${N.predictLabel}">
          ${N.predictOptions.map((opt) => `
            <button type="button" class="predict-opt${val === opt ? ' predict-opt--chosen' : ''}"
              data-choice="${key}" data-value="${escapeHtml(opt)}"
              aria-pressed="${val === opt}">${opt}</button>`).join('')}
        </div>`;
      const free = level === 1 ? '' : `
        <label class="notes-label" for="note-${level === 2 ? 'why' : 'predict'}-${id}">${
          level === 2 ? N.predictWhyLabel : N.predictLabel
        }</label>
        <textarea data-note="${level === 2 ? whyKey : key}"
          id="note-${level === 2 ? 'why' : 'predict'}-${id}"
          placeholder="${(level === 2 ? N.predictWhyPlaceholder : N.predictFreePlaceholder)[id]}"
          >${escapeHtml(st.session.notes[level === 2 ? whyKey : key] ?? '')}</textarea>`;
      return `
        <div class="predict-block">
          <h3>${N.conditions[id].title}</h3>
          ${choices}
          ${free}
        </div>`;
    }).join('');
  }

  /** 화면 문구의 `**굵게**`. 규칙은 `src/ui/strings.js` 의 emphasize 하나에 있다. */
  const emph = emphasize;

  /* ---------------------------------------------------------------- */
  /* 4 탐구 과정 — STEP 1~6. 난이도별로 절차 제시만 달리한다 (docs/06 표). */
  /* ---------------------------------------------------------------- */

  function renderStage4(st) {
    const level = st.session.level;
    // 잠금 판정은 `lockInfo` 한 곳에서 — 그리는 쪽·글자 고치는 쪽·누르는 쪽이 **같은 것**을 본다.
    const { groups, groupsDone, unwritten, nowIdx, openableUpTo, blockerIdx } = lockInfo(st);
    const doneCount = groupsDone.filter(Boolean).length;
    const panels = stepPanelStates(groups, groupsDone, manualOpen, nowIdx);

    const stepsHtml = groups.map((group, gi) => {
      const isDone = groupsDone[gi];
      const isNow = gi === nowIdx;
      const { state, open } = panels[gi];
      /*
       * **한 칸씩만 열린다** (docs/09 §4 — 여덟 실험이 같은 규칙, 정본은 banana):
       *   아직 안 적은 첫 STEP 까지 열리고, 그것을 적으면 **그 다음 하나**가 열린다.
       * 그 너머는 잠근다. 다만 **한 번이라도 열어 본 것은 안 잠근다** — 열려 있던 것이
       * 눈앞에서 사라지면 고장으로 읽힌다. `<details>` 를 죽이지 않고 **아예 다른 껍데기**로
       * 그린다 — 열리는 척하다가 안 열리는 것이 가장 나쁘다. `disabled` 도 `pointer-events:none` 도 안 쓴다.
       *
       * 문이 되는 STEP(`blockerIdx`)은 언제나 **아직 안 적은, 기록칸이 있는 STEP** 이다 (`lockInfo`).
       * 이 실험은 STEP 1·2 에 칸이 없어서, 실험대 진행으로 잠그면 「STEP 2 의 관찰 기록을
       * 적어야」라고 **없는 칸을 시켰다.** 배포본을 플레이하다 찾았다.
       */
      const lockedBy = gi > openableUpTo && !everOpened.has(group.id) ? groups[blockerIdx].id : null;
      /*
       * **「열어 본 적 있다」는 실제로 펼쳐져 있었다는 뜻이다.**
       *
       * 정본은 STEP 1 에도 기록칸이 있어 첫 그림부터 뒤엣것이 잠기지만, 이 실험은 STEP 1·2 에
       * 칸이 없어 **첫 그림에서 셋이 안 잠긴다** — 접힌 것까지 담으면 그 뒤로 영영 안 잠긴다.
       * 손으로 펼친 것(`manualOpen`)은 `open` 이 참이라 그대로 담긴다.
       */
      if (!lockedBy && open) everOpened.add(group.id);
      if (lockedBy) {
        return `
        <div class="note-step note-step--locked" data-step-group="${group.id}"
          data-state="locked" data-done="false" data-locked-by="${lockedBy}">
          <div class="step-summary">
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            <span class="step-open-hint">${N.stepLockedHint}</span>
          </div>
          <p class="step-locked-why">${N.stepLockedWhy(lockedBy)}</p>
        </div>`;
      }

      let body;
      if (level >= 3) {
        // 3단계 — 목표만, 절차 없음
        const val = st.session.notes[group.id] ?? '';
        body = `
          <label class="notes-label" for="note-${group.id}">${N.goalOnlyLabel(group.title)}</label>
          <textarea data-note="${group.id}" id="note-${group.id}">${escapeHtml(val)}</textarea>`;
      } else {
        // 짚어 줄 곳은 **했는데 아직 안 적은** 칸이다. 그런 칸이 없으면 아직 안 한 첫 칸이다.
        // 읽는 순서가 아니라 하는 순서를 따라간다 — 그게 이 쪽에서 하려는 일이다.
        const done = group.steps.map((_, i) => stepDone(st, group.id, i));
        const written = group.steps.map((_, i) => Boolean(st.session.notes[substepId(group, i)]));
        // 앞에서부터 **아직 끝나지 않은 첫 칸**을 짚는다. "했는데 안 적은 칸" 을 먼저 찾으면
        // 아직 손도 안 댄 첫 칸을 건너뛰고 뒤엣것을 짚는 일이 생긴다.
        // **적을 칸이 없는 단계는 하기만 하면 끝난 것이다** — 안 그러면 적을 수도 없는
        // 준비 동작에서 「적어 보세요」가 걸려 다음으로 안 넘어간다.
        const nextIdx = group.steps.findIndex((s, i) => !(done[i] && (!s.note || written[i])));

        const items = group.steps.map((step, i) => {
          const id = substepId(group, i);
          // 하이라이트는 1단계에서만, 그리고 **지금 STEP 안에서만**. 손으로 펼쳐 본
          // 앞으로 올 STEP 에까지 「지금 하세요」가 붙으면 지금이 둘이 된다.
          const hi = level === 1 && isNow && i === nextIdx ? ' substep--next' : '';
          // 실험대가 잠겨 있으면 **할 수 없는 일을 시키지 않는다.** 어디를 눌러야 열리는지 말한다.
          const nudge = benchLocked(st) ? N.stepBenchLocked
            : (done[i] ? N.stepWriteNow : N.stepNotYet);
          const hint = level === 1 && isNow && i === nextIdx
            ? `<p class="substep-hint">${emph(nudge)}</p>` : '';
          return `
            <li class="substep${hi}" data-done="${done[i]}">
              <div class="substep-title">
                <span class="substep-mark" aria-hidden="true">${done[i] ? '✓' : '·'}</span>
                ${step.label}
                <span class="substep-state">${done[i] ? N.stepDoneMark : N.stepTodoMark}</span>
              </div>
              <!-- **「어떻게 하는가」한 줄.** 제목(label)은 무엇을 하는가만 말한다 — 그것만 읽고
                   실험대를 보면 무엇을 어디에 끌어다 대라는 건지 알 수 없다. how 는 실험대의 물건
                   이름을 그대로 써서 손이 할 일을 적는다. 없는 조작은 절대 약속하지 않는다 —
                   tests/uniformity.test.js 가 빈 how 와 실험대에 없는 이름을 잡는다. -->
              ${step.how ? `<p class="substep-how">${emph(step.how)}</p>` : ''}
              ${hint}
              ${step.note ? `
              <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
              <textarea data-note="${id}" id="note-${id}"
                placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(st.session.notes[id] ?? '')}</textarea>` : ''}
            </li>`;
        }).join('');
        body = `<ul class="substep-list">${items}</ul>`;
      }

      // 접힌 STEP 에도 **「눌러서 열린다」를 적어 둔다.** 말하지 않으면 잠긴 것으로 읽힌다.
      const openHint = isNow ? ''
        : `<span class="step-open-hint">${isDone ? N.stepReopenHint : N.stepPeekHint}</span>`;

      return `
        <details class="note-step" data-step-group="${group.id}"
          data-state="${state}" data-done="${isDone}"${open ? ' open' : ''}>
          <summary class="step-summary">
            <!-- 제목은 접혀도 h3 로 남는다. 다른 쪽이 전부 h3 라, 여기만 span 이면
                 제목만 훑어 내려가는 학생에게 4절이 통째로 사라진다. -->
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            ${isDone ? '<span class="step-done-mark">✓</span>' : ''}
            ${isNow ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
            ${openHint}
          </summary>
          <div class="step-body">
            ${body}
            ${group.id === QUESTION_A_STEP ? questionA(st) : ''}
          </div>
        </details>`;
    }).join('');

    const tally = nowIdx === -1
      ? `<p class="step-tally step-tally--done">${N.stepAllDone}</p>`
      : `<p class="step-tally">${N.stepProgress(doneCount, groups.length)}</p>`;

    return `<p class="stage-text step-lead">${emph(N.stepLeadIn)}</p>
      ${tally}
      <div id="note-step-4">${stepsHtml}</div>`;
  }

  /**
   * 질문 ⓐ — STEP 4 직후에 묻는다. **순서가 곧 논증이다** (`docs/06`).
   *
   * (가) 대조군과 (나)(다)의 색 차이를 눈으로 본 **직후**에 물어야 답이 나온다.
   * 6단계까지 미뤄서 물으면 학생은 그때 본 것을 기억으로 더듬어야 하고,
   * "왜 용액을 쓰는가" 가 눈앞의 관찰이 아니라 지식 회상 문제가 된다.
   *
   * 여기서 받은 답은 `notes['q.a']` 한 곳에 저장되고, 6단계에서는 같은 값을 이어 쓴다 —
   * 다시 묻지 않는다.
   */
  function questionA(st) {
    const val = st.session.notes['q.a'] ?? '';
    const g = val.trim() ? gradeQuestion('qa', val) : null;
    return `
      <div class="grade-block question-a">
        <h4>${N.questionA.heading}</h4>
        <p class="stage-text">${N.questionA.prompt}</p>
        <label class="notes-label" for="note-qa-step4">${N.questionA.label}</label>
        <textarea data-note="q.a" id="note-qa-step4">${escapeHtml(val)}</textarea>
        ${g ? `<p class="grade-line" id="grade-qa" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>` : ''}
      </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* 5 결과 — 캡처 자동 첨부 + 배율 직접 입력                            */
  /* ---------------------------------------------------------------- */

  /**
   * 농도별 표 — **이 실험의 결과는 시야 한 장이 아니라 농도열이다.**
   *
   * 화면은 **세어 주지 않는다.** 원형질분리 세포의 비율을 읽어 내는 것이 이 탐구이고,
   * 화면이 그 숫자를 채워 주면 정리 단계의 「절반이 변한 농도」 물음이 받아쓰기가 된다
   * (`docs/04` 「화면이 답을 먼저 말하지 않는다」).
   *
   * 화면이 하는 일은 **어느 농도를 아직 안 봤는지 알려 주는 것**뿐이다.
   */
  function renderConcentrationTable(st) {
    const seen = capturedSolutions(st);
    const rows = ['WATER', 'S05', 'S10', 'S15', 'S20'].map((sol) => {
      const key = `ratio.${sol}`;
      const done = seen.has(sol);
      return `
        <tr>
          <th scope="row">${UI.solutions[sol]}</th>
          <td>${done ? N.stepDoneMark : N.stepTodoMark}</td>
          <td><input type="text" data-note="${key}" id="note-ratio-${sol}"
            value="${escapeHtml(st.session.notes[key] ?? '')}"
            placeholder="${N.ratioPlaceholder}"></td>
        </tr>`;
    }).join('');
    return `
      <h3>${N.concTableHeading}</h3>
      <p class="stage-empty">${emph(N.concTableHint)}</p>
      <table class="materials-table conc-table">
        <thead><tr><th>${N.concHeadSolution}</th><th>${N.concHeadSeen}</th><th>${N.concHeadRatio}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderStage5(st) {
    const caps = st.session.captures;
    if (caps.length === 0) {
      return `${renderConcentrationTable(st)}<p class="stage-empty">${N.noCaptures}</p>`;
    }
    return `${renderConcentrationTable(st)}
      <p class="stage-empty">${N.captureListHint}</p>
      <div class="capture-list">${caps.map((c, i) => {
      // 저장 키는 배열 인덱스가 아니라 캡처에 붙은 번호(`at`)다.
      // 가운데 기록을 지우면 인덱스가 밀려, 아래 카드의 배율 답이 통째로 한 칸씩 어긋난다.
      const at = c.at ?? i;
      const key = `mag.${at}`;
      const domId = `note-mag-${at}`; // id 에는 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const check = saved !== '' ? gradeMagnification(saved, c.objective) : null;
      const eyepiece = c.eyepiece ?? EYEPIECE;
      // 제목에는 짧은 이름을 쓴다. 어느 유리에서 **어느 용액으로** 본 것인지가
      // 한 줄에 함께 있어야 농도별로 견줄 수 있다.
      return `
        <div class="capture-card">
          <div class="capture-head">
            <h3>${UI.slideShort[c.slide]} · ${c.solution ? UI.solutions[c.solution] : UI.noSolution}</h3>
            <button type="button" class="capture-del" data-del="${at}"
              aria-label="${N.captureDeleteLabel(i + 1)}">${N.captureDelete}</button>
          </div>
          <!-- 기록한 시야를 그대로 되살린다. 캡처가 fieldParams 한 벌을 통째로 담고 있으므로
               그때 본 것과 같은 그림이 나온다. idPrefix 를 카드마다 달리 주지 않으면
               모든 카드가 첫 카드의 흐림·잘라내기를 쓴다 — 에러 없이 조용히 틀린다.
               번호(at)로 붙인다 — 지우고 나서도 남은 카드의 접두사가 바뀌지 않는다. -->
          <div class="capture-fov">${renderFOV(c, { idPrefix: `cap${at}-` })}</div>
          <dl class="capture-readout">
            <!-- 곱할 두 수를 **둘 다** 보여 준다.
                 앞서는 대물렌즈 한 줄뿐이었고, 정작 현미경 화면의 단추에는 총배율이 적혀 있어서
                 두 숫자가 서로 달랐다 — 무엇에 무엇을 곱하라는 건지 알 수가 없었다.
                 곱한 답은 여전히 알려 주지 않는다. 그건 아래 칸이 묻는 것이다. -->
            <div><dt>${N.eyepieceLabel}</dt><dd>${UI.units.mag(eyepiece)}</dd></div>
            <div><dt>${N.objectiveLabel}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
            <div><dt>${UI.observability.label}</dt><dd>${observability(c).score}</dd></div>
          </dl>
          <label class="notes-label" for="${domId}">${N.magInput}</label>
          <input type="text" inputmode="numeric" placeholder="${N.magPlaceholder}"
            data-note="${key}" id="${domId}" value="${escapeHtml(saved)}">
          ${check ? `<p class="grade-line" data-grade="${check.status}">${check.message ?? ''}</p>` : ''}
        </div>`;
    }).join('')}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* 6 정리 — 서술형 3문항 + 첨삭, 세부 단계 기록·예상 재복습, 성찰 문항  */
  /* ---------------------------------------------------------------- */

  function renderStepNotesRecap(st) {
    const rows = Object.entries(st.session.notes)
      .filter(([k, v]) => isStepNoteKey(k) && v && v.trim())
      .map(([k, v]) => `<li><b>${stepNoteLabel(k)}</b> — ${escapeHtml(v)}</li>`);
    if (rows.length === 0) return '';
    return `<section><h3>${N.stepNotesHeading}</h3><ul class="step-notes-recap">${rows.join('')}</ul></section>`;
  }

  function renderPredictCompare(st) {
    const rows = CONDITIONS.map((id) => `
      <div class="predict-compare-row">
        <h4>${N.conditions[id].title}</h4>
        <dl class="compare-pair">
          <dt>${N.predictRecapLabel}</dt>
          <dd>${escapeHtml(st.session.notes[`predict.${id}`] || N.predictNone)}</dd>
          <dt>${N.actualLabel}</dt>
          <dd>${actualSummary(st, id)}</dd>
        </dl>
      </div>`).join('');
    return `<section><h3>${N.predictHeading}</h3>${rows}</section>`;
  }

  function blurryCaptures(st) {
    const bySlide = new Map();
    for (const c of st.session.captures) {
      if (observability(c).score < LOW_OBSERVABILITY) bySlide.set(c.slide, c); // 최근 것으로 덮어씀
    }
    return [...bySlide.values()];
  }

  function renderReflect(st) {
    const blurry = blurryCaptures(st);
    if (blurry.length === 0) return '';
    const items = blurry.map((c) => {
      const key = `reflect.${c.slide}`;
      const chosen = st.session.notes[key];
      const options = Object.keys(UI.observability.worst).map((k) => `
        <button type="button" class="reflect-opt${chosen === k ? ' reflect-opt--chosen' : ''}"
          data-reflect="${key}" data-value="${k}">${UI.observability.worst[k]}</button>`).join('');
      const retry = chosen
        ? `<button type="button" class="reflect-retry" data-retry="${c.slide}">${N.reflectRetry}</button>`
        : '';
      return `
        <div class="reflect-item" data-slide="${c.slide}">
          <p>${N.reflectQuestion(UI.slides[c.slide])}</p>
          <div class="reflect-options" role="group">${options}</div>
          ${retry}
        </div>`;
    }).join('');
    return `<section id="reflect">${items}</section>`;
  }

  /**
   * 첨삭 줄. **빈칸에는 띄우지 않는다.**
   *
   * 아무것도 안 쓴 칸에 "두 물질의 양과 흩어진 모양을 서로 견주어 써 보세요" 가 먼저 뜨면,
   * 학생은 쓰기도 전에 부족하다는 말부터 듣는다. 쓸 마음이 꺾이는 자리다.
   * 다만 **답할 수 없는 문항**(아직 결과 보드가 없는 3번)은 왜 못 쓰는지 미리 알려 준다 —
   * 그건 지적이 아니라 안내다.
   */
  function gradeLine(id, key, text) {
    const g = gradeQuestion(key, text);
    if (!text.trim() && g.status !== 'unavailable') return '';
    return `<p id="grade-${id}" class="grade-line" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>`;
  }

  /**
   * 모둠 토의 기록 — 모둠으로 하는 세션에만 나온다.
   * 혼자 하는 학생에게 "누가 무엇을 맡았나요" 를 물으면 답할 것이 없고,
   * 빈칸으로 남은 문항은 보고서에서 "안 한 일" 로 읽힌다.
   */
  function renderDiscussion(st) {
    if (!isGroup(st)) return '';
    const items = N.discussionItems.map(({ key, label, eg }) => `
      <div class="self-eval-item">
        <label class="notes-label" for="note-discuss-${key}">${label}</label>
        <textarea data-note="discuss.${key}" id="note-discuss-${key}"
          placeholder="${escapeHtml(eg)}">${escapeHtml(st.session.notes[`discuss.${key}`] ?? '')}</textarea>
      </div>`).join('');
    return `<section class="grade-block"><h3>${N.discussionHeading}</h3>${items}</section>`;
  }

  function renderStage6(st) {
    const qa = st.session.notes['q.a'] ?? '';
    const q2 = st.session.notes.q2 ?? '';
    const q3 = st.session.notes.q3 ?? '';
    // 4번(다른 모둠과 비교)은 모둠으로 할 때만 낸다. 혼자 한 학생에게 내면
    // 답할 수 없는 것을 묻는 셈이고, 빈칸으로 남은 문항은 「못 한 일」 로 읽힌다.
    const q4 = st.session.notes.q4 ?? '';
    return `
      ${renderStepNotesRecap(st)}
      ${renderPredictCompare(st)}
      <section class="grade-block">
        <!-- 질문 ⓐ 는 STEP 4 직후에 이미 물었다 (docs/06 — 순서가 곧 논증이다).
             여기서 다시 묻지 않고, 그때 쓴 답을 그대로 이어 쓰게 한다.
             같은 notes['q.a'] 를 쓰므로 어느 쪽에서 고쳐도 한 벌이다. -->
        <label class="notes-label" for="note-qa">${N.qaContinueLabel}</label>
        <p class="stage-empty">${qa.trim() ? N.qaCarried : N.qaNotYet}</p>
        <textarea data-note="q.a" id="note-qa">${escapeHtml(qa)}</textarea>
        ${gradeLine('qa', 'qa', qa)}
      </section>
      <section class="grade-block">
        <label class="notes-label" for="note-q2">${emph(N.q2Label)}</label>
        <textarea data-note="q2" id="note-q2">${escapeHtml(q2)}</textarea>
        ${gradeLine('q2', 'q2', q2)}
      </section>
      <section class="grade-block">
        <label class="notes-label" for="note-q3">${N.q3Label}</label>
        <textarea data-note="q3" id="note-q3">${escapeHtml(q3)}</textarea>
        ${gradeLine('q3', 'q3', q3)}
      </section>
      ${isGroup(st) ? `
      <section class="grade-block">
        <label class="notes-label" for="note-q4">${N.q4Label}</label>
        <textarea data-note="q4" id="note-q4">${escapeHtml(q4)}</textarea>
        ${gradeLine('q4', 'q4', q4)}
      </section>` : ''}
      ${renderDiscussion(st)}
      ${renderReflect(st)}`;
  }

  /* ---------------------------------------------------------------- */
  /* 7 자기 평가 — 리커트·되돌아보기, 그리고 **판정하지 않는** 안전 안내. */
  /* ---------------------------------------------------------------- */

  /**
   * 7 자기 평가.
   *
   * 척도는 **난이도와 무관하게 세 단계 모두 똑같다.** 자기를 돌아보는 일에 난이도를 매길 이유가 없다.
   * 점수를 합산하지도, 등급을 내지도 않는다 — 학생이 스스로를 어디쯤으로 보는지가 남을 뿐이다.
   *
   * 라디오 버튼을 쓴다. 커스텀 버튼으로 만들면 화살표 이동·그룹 읽기를 직접 구현해야 하는데,
   * 브라우저가 이미 표준으로 해 주는 일이다.
   */
  function renderStage7(st) {
    const scale = N.likertScale;
    const rows = N.selfEvalItems.map(({ key, label }) => {
      const saved = st.session.notes[`selfeval.${key}`] ?? '';
      const cells = scale.map(({ value, label: vLabel }) => `
        <label class="likert-cell">
          <input type="radio" name="selfeval.${key}" value="${value}"
            data-note="selfeval.${key}"${saved === value ? ' checked' : ''}>
          <span class="likert-num">${value}</span>
          <span class="likert-word">${vLabel}</span>
        </label>`).join('');
      return `
        <fieldset class="likert-row">
          <legend>${label}</legend>
          <div class="likert-scale">${cells}</div>
        </fieldset>`;
    }).join('');

    const reflections = N.reflectionItems.map(({ key, label, eg }) => `
      <div class="self-eval-item">
        <!-- for 와 id 가 서로 달랐다 (note-reflect-* 와 note-feedback-*).
             화면에는 아무 티도 안 난다 — 스크린리더에서만 이름 없는 칸이 된다.
             주석 안에 백틱을 쓰지 말 것. 여기는 템플릿 문자열 안이라 그 자리에서 끊긴다. -->
        <label class="notes-label" for="note-feedback-${key}">${label}</label>
        <textarea data-note="feedback.${key}" id="note-feedback-${key}"
          placeholder="${escapeHtml(eg)}">${escapeHtml(st.session.notes[`feedback.${key}`] ?? '')}</textarea>
      </div>`).join('');

    // 이 칸은 학생이 채우는 곳이 아니다. 실험하는 동안 지켜본 것을 그대로 보여 준다.
    // 지킨 것도 함께 적는다 — 빈 목록에 "위반 없음" 한 줄만 뜨면 무엇을 보고 하는 말인지
    // 알 수 없고, 아무것도 안 해도 늘 그렇게 뜨는 줄 알게 된다.
    /*
     * **여기는 앱이 판정하지 않는다.** 가만히 적힌 안내다.
     *
     * 예전에는 마개를 닫았는지·폐액을 버렸는지를 지켜보고 ✓/✗ 를 달았다. 두 가지가 틀렸다.
     * 하나는 **거짓말을 했다** — 판정을 채우는 `CHECK_TIDY` 가 「보고서 열기」를 누를 때만
     * 도는데 이 쪽은 그 전에 보므로, 아무것도 안 한 학생에게 「모두 지켰습니다」가 떴다.
     * 다른 하나가 더 크다 — 가상 실험에서 그걸 따지면 **화면 속 단추를 눌렀다는 사실**을
     * 평가하게 된다. 안전 습관이 아니라 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
     *
     * 그래서 지켜보기를 통째로 걷어냈다. **여기에 ✓ 도 ✗ 도 없다.**
     * `scripts/check-ui.mjs` 가 판정 표시가 하나도 없는지 확인한다.
     */
    return `
      <div id="self-eval">
        <h3>${N.likertHeading}</h3>
        ${rows}
        <h3>${N.reflectionHeading}</h3>
        ${reflections}

      </div>`;
  }

  const STAGE_RENDERERS = {
    1: renderStage1, 2: renderStage2, 3: renderStage3, 4: renderStage4,
    5: renderStage5, 6: renderStage6, 7: renderStage7,
  };

  /* ---------------------------------------------------------------- */

  function bindPanel() {
    /*
     * STEP 을 손으로 여닫은 것을 기억한다.
     *
     * **`toggle` 이 아니라 summary 의 `click` 을 듣는다.** `<details open>` 을 `innerHTML`
     * 로 꽂으면 브라우저가 **삽입만으로도 `toggle` 을 한 번 쏜다.** 그러면 「지금 할
     * 차례라서 펼쳐진 것」이 **「학생이 손으로 연 것」으로 기록**되고, 그 STEP 은 끝난 뒤에도
     * 영영 안 접힌다 — 한 번에 하나만 펼치려던 것이 통째로 무너진다.
     * `click` 은 사람이 눌렀을 때만 온다. summary 는 포커스를 받으므로 Enter·Space 도
     * click 으로 오니 키보드도 같이 산다.
     */
    /*
     * **잠긴 STEP 을 누르면 한 번에 열린다.**
     *
     * 적던 손을 칸에 둔 채 잠긴 STEP 을 누르면, 저장은 `change` 로 늦게 오고 그 사이
     * 판이 안 갈려서 **한 번 눌러도 안 열렸다.** 여기서 먼저 저장하고 다시 판정한다.
     *
     * ★ **무조건 펴 주면 뒷문이 된다.** `manualOpen` 이 참이면 다음 그림에서 열린 것으로
     *   보고 `everOpened` 에 담기므로, 아무것도 안 적고 누르기만 해도 영영 안 잠긴다.
     *   **저장한 뒤 다시 재어 정말 풀렸을 때만** 편다.
     */
    panelEl.addEventListener('pointerdown', (e) => {
      const locked = e.target.closest?.('.note-step--locked');
      if (!locked) return;
      const focused = document.activeElement;
      /*
       * ★ **손이 글칸에 없어도 판정한다.** 앞서는 글칸에 손이 없으면 곧장 `return` 했다.
       *   그런데 학생이 STEP 3 기록을 적고 **딴 데를 한 번 누른 뒤**(손을 떼려고 흔히 그런다)
       *   잠긴 STEP 4 를 누르면 — 저장은 `change` 로 이미 됐지만 판은 안 갈렸고
       *   (`savingNote` 는 글자만 고친다), 여기서는 손이 글칸에 없다고 아무것도 안 했다.
       *   화면에는 「이제 열립니다. 눌러서 여세요」가 떠 있는데 **눌러도 안 열렸다.**
       *   osmosis 플레이테스트(2026-09-02)에서 1단계 정상 경로 그대로 밟다 잡았다.
       *   저장은 손이 글칸에 있을 때만, 판정과 열기는 언제나 한다.
       */
      if (focused?.matches?.('[data-note]')) {
        store.dispatch('SAVE_NOTE', { step: focused.dataset.note, text: focused.value });
      }
      const { openableUpTo } = lockInfo(store.getState());
      const gi = UI.protocol.findIndex((g) => g.id === locked.dataset.stepGroup);
      if (gi <= openableUpTo) {
        manualOpen.set(locked.dataset.stepGroup, true);
        // 누르는 중이라 `render()` 는 미뤄지고(`pressing`), 손을 떼는 순간 한 번 그려진다.
        render();
      }
    });

    panelEl.querySelectorAll('details[data-step-group] > summary').forEach((el) => {
      el.addEventListener('click', () => {
        // 기본 동작이 아직 일어나기 전이라 `open` 은 누르기 **전**의 값이다.
        const id = el.parentElement.dataset.stepGroup;
        const willOpen = !el.parentElement.open;
        manualOpen.set(id, willOpen);
        /*
         * **여기서도 「열어 봤다」에 담는다.** 그리는 쪽에만 두면 기댈 것이 생긴다 —
         * 누를 때는 다시 그리지 않으므로, 누른 **바로 다음 렌더**에서 잠금 조건이 켜지면
         * 잠금 판정이 먼저 돌아 일찍 `return` 하고 담을 자리까지 못 간다. 그러면
         * **손으로 펼친 STEP 이 도로 잠긴다.**
         *
         * 이 저장소에서는 재현되지 않았다 — 그 사이에 렌더가 한 번 끼어 먼저 담기더라.
         * 그런데 그건 **우연히 끼는 렌더에 기대고 있다는 뜻**이지 안전하다는 뜻이 아니다.
         * catalase·micrometer 가 각자 잡았고 정본도 고쳤다. 그리는 쪽 것도 **그대로 둔다** —
         * 둘 다 있어야 한다(그리는 쪽은 「지금 할 차례라서 펼쳐진 것」을 담는다).
         */
        if (willOpen) everOpened.add(id);
      });
    });
    panelEl.querySelectorAll('[data-note]').forEach((el) => {
      el.addEventListener('change', () => {
        // **내가 방금 저장시켰다**는 표시. 「누가 눌렀나」로는 Tab 을 못 잡는다 —
        // `change` 는 포커스가 아직 옮겨 가는 중(대개 `<body>`)일 때 온다.
        savingNote = true;
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
        savingNote = false;
      });
      /*
       * **글자를 칠 때마다 말을 맞춘다.** 저장은 손이 떠나야 되지만, 화면이 그때까지
       * 「먼저 고르세요」라고 버티면 학생은 다 적어 놓고 벽을 본다. 판은 안 간다 —
       * 단추의 잠금과 까닭 글자만 제자리에서 고친다.
       */
      el.addEventListener('input', () => {
        const live = liveState(store.getState());
        patchGate(live);
        patchStepHints(live);
      });
    });
    // 선택형 예상 — 고른 보기를 **글로** 저장한다. 6단계에서 실제 결과와 나란히 읽히려면
    // 코드가 아니라 문장이어야 한다.
    panelEl.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('SAVE_NOTE', { step: btn.dataset.choice, text: btn.dataset.value });
      });
    });
    panelEl.querySelectorAll('[data-reflect]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('SAVE_NOTE', { step: btn.dataset.reflect, text: btn.dataset.value });
      });
    });
    panelEl.querySelectorAll('[data-retry]').forEach((btn) => {
      btn.addEventListener('click', () => onOpenZoom('scope', btn.dataset.retry, btn));
    });
    panelEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_CAPTURE', { at: Number(btn.dataset.del) });
      });
    });
    panelEl.querySelector('#mark-read')?.addEventListener('click', (e) => {
      /*
       * **표시만 하고 안 막으면 표시가 거짓말이 된다.** `aria-disabled` 는 브라우저가
       * 눌리는 것을 막아 주지 않으므로 여기서 한 번 더 막는다.
       * (`disabled` 를 안 쓰는 까닭은 `readFooter` 주석 참조.)
       *
       * **DOM 속성이 아니라 상태를 본다.** 속성은 마지막으로 그린 시점의 것이라 **낡을 수
       * 있다** — 마지막 칸을 채운 직후라면 화면은 아직 「막힘」인데 상태는 이미 다 찼다.
       * 그때 속성을 믿으면 **다 적었는데도 안 눌린다.**
       */
      const now = store.getState();
      if (activeStage === '3' && !predictDone(now)) return;
      const from = activeStage;
      store.dispatch('MARK_READ', { stage: from });
      /*
       * **누르면 다음 쪽으로 넘어간다.** 그 자리에 ✓ 만 남기면 학생이 탭을 직접 눌러
       * 옮겨야 하는데, 그 사실을 알려 주는 것이 화면 어디에도 없었다.
       *
       * 다음 쪽은 **차례에서 고른다** — 「아직 안 읽은 쪽」으로 고르면 안 된다.
       * 차례대로 읽는 동안에는 둘이 같아서 멀쩡해 보이지만, **4쪽을 먼저 읽어 둔 학생이
       * 3쪽에서 누르면** 거꾸로 끌려가거나 아무 데도 안 간다. 허브가 짚어 준 자리다.
       *
       * 마지막 읽기 쪽(4쪽)에서는 **넘기지 않고 그대로 둔다.** 4쪽이 탐구 과정이라
       * 실험대에서 일하는 내내 보게 될 쪽이기 때문이다. 5쪽(결과)으로 보내면 아직 아무것도
       * 없는 빈 표가 떠서 자리를 잃은 것처럼 보인다. 대신 「실험대가 열렸습니다」가 뜬다.
       */
      const required = UI.bench.lock.required;
      const next = required[required.indexOf(from) + 1];
      if (next) activeStage = next;
      render();
    });
  }

  /**
   * 「읽었습니다」 — 실험대의 자물쇠를 여는 단추.
   *
   * 1~4 쪽 아래에만 붙는다. 5~7 쪽은 결과가 있어야 채울 수 있어 "읽는" 쪽이 아니다.
   * 다 읽었는지를 기계가 재는 방법은 없다 — 스크롤 끝까지 내렸는지는 손가락이 움직였다는
   * 증거일 뿐이다. 그래서 학생에게 묻는다. 누르는 것 자체가 약속이 된다.
   */
  function readFooter(st) {
    const required = UI.bench.lock.required;
    if (!required.includes(activeStage)) return '';
    const read = st.session.readStages ?? [];
    const left = required.filter((id) => !read.includes(id));
    if (read.includes(activeStage)) {
      return `<p class="read-mark" data-done="true">${N.readDone}${
        left.length === 0 ? ` ${N.readAllDone}` : ''}</p>`;
    }
    /*
     * 예상 쪽에서는 **예상을 적어야** 넘어갈 수 있다. 채점이 아니다 — 적기만 하면 통과다.
     *
     * **`disabled` 를 쓰지 않는다.** `disabled` 단추는 포커스를 받지 못해서, 키보드나
     * 낭독기로 오는 학생은 **왜 못 누르는지 들을 길이 아예 없다** — 막아 놓고 이유를
     * 안 알려 주는 셈이 된다. `aria-disabled` 로 「지금은 못 누른다」만 알리고,
     * 이유 문단을 `aria-describedby` 로 묶어 **단추에 닿는 순간 함께 읽히게** 한다.
     * 실제로 막는 것은 누르는 쪽에서 한다 (`bindPanel`).
     */
    const blocked = activeStage === '3' && !predictDone(st);
    const whyId = 'read-blocked-why';
    return `
      <div class="read-mark">
        <p>${N.readLeadIn}</p>
        <button type="button" id="mark-read" class="read-confirm"
          ${blocked ? `aria-disabled="true" aria-describedby="${whyId}"` : ''}>${N.readConfirm}</button>
        <!-- 까닭 문단은 **늘 그리고 hidden 으로만 여닫는다.** 글칸에 손이 있는 동안에는
             판을 갈 수 없어서(갈면 손이 있던 칸이 사라진다) 여기 글자만 제자리에서 고친다. -->
        <p id="${whyId}" class="read-blocked"${blocked ? '' : ' hidden'}>${N.readNeedsPredict}</p>
      </div>`;
  }

  /*
   * **누르는 동안에는 다시 그리지 않는다.**
   *
   * 마지막 예상 칸에 적고 **곧장** 「읽었습니다」를 누르면 그 누름이 사라졌다.
   * 누르는 순간 글칸에서 포커스가 빠지며 `change` → `SAVE_NOTE` → 여기서 패널을
   * `innerHTML` 로 통째로 갈아 끼우는데, 그러면 **누르려던 단추가 떨어져 나가** click 이
   * 아무 데도 안 닿는다. 학생 눈에는 「눌렀는데 아무 일도 안 일어났다」이다.
   * (germination 세션이 찾았고 정본도 같았다.)
   *
   * 누르기가 끝날 때까지 미뤘다가 한 번 그린다. `click` 은 **target 의 핸들러가 끝난 뒤**
   * 여기로 올라오므로, 그때 풀어야 누름이 살아 있다.
   */
  let pressing = false;
  let renderPending = false;
  function releasePress() {
    if (!pressing) return;
    pressing = false;
    if (renderPending) { renderPending = false; render(); }
  }
  panelEl.addEventListener('pointerdown', () => { pressing = true; }, true);
  panelEl.addEventListener('click', releasePress);            // 버블 — 단추 핸들러 뒤
  // 단추 밖에서 떼거나 취소된 경우. click 이 안 오면 여기서 푼다.
  window.addEventListener('pointerup', () => setTimeout(releasePress, 0));
  window.addEventListener('pointercancel', releasePress);

  /*
   * **기록을 저장할 때는 판을 갈지 않는다.**
   *
   * 갈면 **손이 있던 글칸이 사라진다.** 마우스로 옮길 때는 `pointerdown` 이 먼저 와서
   * 위의 `pressing` 이 막아 주지만 **Tab 에는 그 누름이 없다.** 3단계에서 첫 칸에 적고
   * Tab 을 누르면 포커스가 `<body>` 로 떨어지고 **그 뒤에 친 글자가 전부 사라졌다.**
   *
   *     Tab 뒤 포커스 : BODY
   *     화면 값      : [["predict.water","예상0"],["predict.sugar",""],["predict.back",""]]
   *
   * 대신 **노트에 달린 것만 제자리에서 고친다** — 단추의 잠금과 까닭 글자, 탭의 ✓.
   * (germination·정본이 같은 자리를 찾았다.)
   */
  let savingNote = false;

  /**
   * 잠긴 STEP 의 **말만** 제자리에서 고친다.
   *
   * 다 적고 손을 글칸에 둔 채로는 판을 갈 수 없으니, 잠긴 STEP 은 계속 「앞 STEP 을 먼저
   * 적으세요」라고 **거짓말**을 했다 — 방금 다 적었는데. 열어 줄 수는 없다(여는 것은
   * 누르는 순간이다). **말만** 바꾼다.
   *
   * `everOpened` 는 **건드리지 않는다.** 여기는 그리는 자리가 아니라 글자를 고치는
   * 자리라서, 여기서 담으면 「열어 본 적 있다」가 열어 본 적 없는 것까지 삼킨다.
   */
  /**
   * **화면에 적힌 것까지 쳐 준 상태.**
   *
   * 글칸은 손이 떠나야(`change`) 저장된다. 그래서 다 적어 놓고도 단추는 「먼저 고르세요」라고
   * 옛말을 했다 — 눌러 보면 넘어가지만, **그 전에 학생은 「다 적었는데 안 열리는 화면」**을 본다.
   * 판단은 저장된 값으로 하되, **보여 주는 말**은 화면에 적힌 것까지 쳐서 만든다.
   */
  function liveState(st) {
    const notes = { ...st.session.notes };
    for (const el of panelEl.querySelectorAll('textarea[data-note], input[data-note]')) {
      notes[el.dataset.note] = el.value;
    }
    return { ...st, session: { ...st.session, notes } };
  }

  /** 잠금 판정 한 곳. 그리는 쪽·글자 고치는 쪽·누르는 쪽이 **같은 것**을 본다. */
  function lockInfo(st) {
    const groups = UI.protocol;
    const groupsDone = groups.map((g) => groupDone(st, g.id));
    const unwritten = groups.map((g) => !stepNotesWritten(st, g));
    /*
     * 「지금 할 차례」는 **조작을 마쳤고 적기까지 한** 첫 STEP 의 다음이다.
     * 조작만 보고 정하면 STEP 의 조작을 끝내는 순간 그것이 접히는데, 적지 않았으니 다음은
     * 잠겨 있다 — **아무것도 펼쳐지지 않은 화면**이 남는다. 안 적었으면 적을 자리가 계속 펼쳐져 있어야 한다.
     */
    const nowIdx = groupsDone.findIndex((d, i) => !(d && !unwritten[i]));
    /*
     * **문은 관찰 기록으로만 정한다** — 「STEP n 의 관찰 기록을 적어야 여기가 열립니다」가
     * 언제나 참이 되게. 아직 안 적은 첫 STEP 까지 열리고, 그 너머는 잠긴다. 그 STEP 을 적으면
     * 다음 하나가 열린다 (docs/09 §4).
     *
     * 정본은 여기에 실험대 진행(`nowIdx`)을 함께 본다. 그러면 실험대에서 STEP 1 을 안 한 채
     * STEP 3 의 기록을 적었을 때 STEP 4 가 「STEP 3 의 관찰 기록을 적어야」라며 잠긴 채 남는다 —
     * 방금 적었는데. 정상 경로(실험대에서 하고 나서 적는다)에서는 두 규칙이 같은 답을 낸다.
     * 기록칸이 없는 STEP(여기 1·2)은 `unwritten` 이 거짓이라 문이 되지 않는다 — 적을 것이
     * 없는데 기다리게 하지 않는다.
     */
    const firstUnwritten = unwritten.findIndex(Boolean);
    const openableUpTo = firstUnwritten < 0 ? groups.length : firstUnwritten;
    return { groups, groupsDone, unwritten, nowIdx, openableUpTo,
      blockerIdx: Math.min(openableUpTo, groups.length - 1) };
  }

  /**
   * 잠긴 STEP 의 **말**을 지금 적은 것에 맞춘다 (정본과 같다).
   *
   * 잠긴 STEP 은 `<div>` 라 열어 줄 수는 없다 — 여는 것은 **누르는 순간** 일어난다
   * (`pointerdown` 에서 저장하고, 그 덕에 풀렸으면 펼친다). 여기서는 **말만** 바꾼다.
   * 손보는 것은 **맨 앞의 잠긴 STEP 하나뿐**이다 — 실제로 열리는 것은 그것 하나이고,
   * 뒤엣것까지 「눌러서 여세요」로 바꾸면 눌러도 안 열리는 거짓말이 새로 생긴다.
   * 잠긴 STEP 이 스스로 누구를 기다리는지 말한다(`data-locked-by`) — 표시가 아니라 상태를 본다.
   */
  function patchStepHints(st) {
    const next = panelEl.querySelector('.note-step--locked[data-locked-by]');
    if (!next) return;
    const by = next.dataset.lockedBy;
    const group = UI.protocol.find((g) => g.id === by);
    if (!group) return;
    const ready = stepNotesWritten(st, group);
    const hint = next.querySelector('.step-open-hint');
    const why = next.querySelector('.step-locked-why');
    if (hint) hint.textContent = ready ? N.stepReadyHint : N.stepLockedHint;
    if (why) why.textContent = ready ? N.stepReadyWhy : N.stepLockedWhy(by);
  }

  /** 단추의 잠금과 까닭 글자만 제자리에서 고친다. 판은 그대로 둔다. */
  function patchGate(st) {
    const btn = panelEl.querySelector('#mark-read');
    if (!btn) return;
    const blocked = activeStage === '3' && !predictDone(st);
    btn.toggleAttribute('aria-disabled', blocked);
    if (blocked) btn.setAttribute('aria-describedby', 'read-blocked-why');
    else btn.removeAttribute('aria-describedby');
    const why = panelEl.querySelector('#read-blocked-why');
    if (why) why.hidden = !blocked;
  }

  /**
   * **손이 노트를 떠나면 그때 한 번 제대로 그린다.**
   *
   * `savingNote` 갈래는 글자만 고치고 판은 안 간다 — 손이 있는 글칸을 지키려는 것이다.
   * 그런데 그 뒤로 **아무것도 판을 안 갈아 주면** 화면이 낡은 채 남는다:
   *   · 잠긴 STEP 이 「이제 열립니다」라고 말하면서 잠긴 껍데기 그대로다
   *   · 서술형을 적고 손을 떼도 첨삭 줄이 안 뜬다 (첨삭은 판을 갈 때만 붙는다)
   *   · 결과 기록을 적어도 ✓ 가 안 붙는다
   * 다음 조작(실험대·탭)이 올 때까지 그대로다. 학생은 「적었는데 아무 일도 없다」를 본다.
   * osmosis 플레이테스트(2026-09-02)에서 잡았다.
   *
   * 한 박자 뒤에 **손이 노트 안에 없을 때만** 통째로 그린다. 글칸이든 단추든 노트 안에
   * 손이 있으면 그대로 둔다 — Tab 으로 옆 칸에 간 손, 「읽었습니다」에 얹힌 손이 사라지면
   * 안 된다. 누르는 중이면 `pressing` 이 손을 뗄 때 그려 준다.
   */
  function settleSoon() {
    setTimeout(() => {
      if (pressing) { renderPending = true; return; }
      const a = document.activeElement;
      if (a && a !== document.body && panelEl.contains(a)) return;
      render();
    }, 0);
  }

  function render() {
    /*
     * **`savingNote` 를 `pressing` 보다 먼저 본다.** 순서를 거꾸로 두면, 글칸을 눌러
     * 옮기는 동안(pressing) 일어난 저장이 **「미뤄 둔 전체 다시 그리기」로 바뀌어**
     * 누르기가 끝나는 순간 판이 갈리고 **방금 옮겨 간 칸이 사라진다.**
     * 실제로 그렇게 짰다가 가운데 칸에 친 글자가 통째로 없어졌다.
     */
    if (savingNote) {
      // 판을 갈지 않고 노트에 달린 것만 고친다.
      const now = store.getState();
      patchGate(liveState(now));
      patchStepHints(liveState(now));
      tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
        tab.dataset.read = String(stageDone(now, tab.dataset.stage));
      });
      /*
       * **보고서 자리도 함께 고친다.** 이걸 빼먹었더니 마지막 칸을 채워 조건이 다 찼는데도
       * **「보고서 만들기」 단추가 안 나왔다** — 판을 안 가니 남은 일 목록이 옛것 그대로였다.
       * 상태는 맞는데 화면만 안 따라온 것이라, 학생은 「다 했는데 단추가 없다」를 본다.
       * 이 자리는 노트 바깥(`#report-slot`)이라 글칸을 건드리지 않는다 — 안전하게 갈 수 있다.
       */
      renderReportSlot(now);
      settleSoon();
      return;
    }
    if (pressing) { renderPending = true; return; }
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다 —
      // 앞 네 쪽은 실험대를 여는 조건이고, 뒤 세 쪽은 보고서를 내는 조건이다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });
    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st) + readFooter(st);
    bindPanel();
    renderReportSlot(st);
  }

  store.subscribe(render);
  render();
}
