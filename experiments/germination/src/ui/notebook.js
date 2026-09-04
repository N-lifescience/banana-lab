/**
 * 탐구 노트 — 7단계 패널.
 *
 * 7단계(문제 인식~자기 평가)가 최상위 탭이고, 조작 절차 여섯은 4단계 「탐구 과정」 안의
 * STEP 으로 들어간다. `UI.protocol` 이 그 여섯의 제목과 세부 단계를 갖고 있으므로
 * 그대로 쓰고, 세부 단계 id(`1a`·`1b`·`2a`…)는 배열 순서에서 글자를 붙여 만든다.
 *
 * 결과를 바꾸는 조작은 전부 `store.dispatch('SAVE_NOTE', …)` 를 거쳐 `reduce()` 로 간다 —
 * 이 파일은 `session.notes` 를 직접 대입하지 않는다.
 */

import { CHAMBERS, MODES, chamberViews, comparisonKind, mismatches } from '../sim/state.js';
import { ASSETS } from '../assets/index.js';
import { renderComparison } from '../render/chamber.js';
import { renderGraph, resultNotes } from '../render/graph.js';
import { gradeQuestion } from './grading.js';
import { UI } from './strings.js';
import { stepDone, groupDone, resultsDone, chamberWith } from '../sim/progress.js';


/**
 * STEP 마다 **어떤 상태로, 펼쳐서 그릴지.** 상태 하나에서 나온다.
 *
 * 「지금 STEP」은 `groupDone` 이 거짓인 **첫 STEP** 이다. 따로 저장하지 않는다 —
 * 실험대에서 한 일이 그대로 노트를 넘긴다. 저장해 두면 되돌리기를 했을 때 노트와
 * 실험대가 서로 다른 곳을 가리킨다.
 *
 * **학생이 손으로 여닫은 것은 기억해서 그것이 이긴다.** 순서를 건너뛰어 실험한 학생이
 * 앞선 STEP 을 펼쳐 두었는데 다음 조작 한 번에 도로 접히면, 화면이 학생과 씨름한다.
 *
 * DOM 없이 판정되도록 그리는 일에서 떼어 놓았다 — `tests/notebook-steps.test.js` 가
 * 이 함수를 잰다. **여덟 실험이 같은 계보이므로 베껴 갈 자리가 여기다.**
 *
 * @param {{id:string}[]} groups      STEP 들 (`UI.protocol`)
 * @param {boolean[]} groupsDone      STEP 마다 끝났는가
 * @param {Map<string,boolean>} manualOpen  학생이 손으로 여닫은 기록 (STEP id → 열림)
 * @returns {{state:'done'|'now'|'later', open:boolean}[]}
 */
/**
 * 「지금 할 차례」는 **조작을 마쳤고 적기까지 한** 첫 STEP 의 다음이다. 다 끝났으면 -1.
 *
 * **이 셈은 여기 한 곳에만 있어야 한다.** 두 곳에서 따로 세면 언젠가 갈리고, 갈리면
 * 「지금 자리」와 「어디까지 열리는가」가 서로 다른 곳을 가리켜 **아무것도 펼쳐지지 않은
 * 화면**이 난다. (osmosis 세션이 자기 저장소에서 그렇게 겪었다)
 */
export function nowStepIndex(groupsDone, unwritten) {
  return groupsDone.findIndex((d, i) => !(d && !unwritten[i]));
}

export function stepPanelStates(groups, groupsDone, manualOpen = new Map(), opts = {}) {
  // 관찰 기록을 안 적은 STEP. 안 주면 「다 적었다」로 보고 아무것도 안 잠근다.
  const unwritten = opts.unwritten ?? groups.map(() => false);
  const everOpened = opts.everOpened ?? new Set();

  /*
   * 「지금 할 차례」는 **조작을 마쳤고 적기까지 한** 첫 STEP 의 다음이다.
   *
   * 조작만 보고 정하면 이렇게 된다 — STEP 1 의 조작을 끝내는 순간 1 이 접히는데,
   * 적지 않았으니 STEP 2 는 잠겨 있다. **아무것도 펼쳐지지 않은 화면**이 남고 학생은
   * 벽을 본다. 안 적었으면 적을 자리가 계속 펼쳐져 있어야 한다.
   */
  const nowIdx = nowStepIndex(groupsDone, unwritten);

  return groups.map((group, gi) => {
    const isDone = groupsDone[gi];
    const isNow = gi === nowIdx;
    /*
     * **한 칸씩만 열린다.**
     *
     * 앞서는 「지금 STEP 의 기록이 비면 그 뒤를 전부 잠근다」였다. 그러면 기록을 적는
     * 순간 **나머지가 통째로 한꺼번에 열렸다** — STEP 1 을 적었더니 2 만이 아니라
     * 3·4·5·6 이 다 열렸다. 한 번에 한 STEP 이라고 해 놓고 그러면 앞뒤가 안 맞는다.
     *
     * 그래서 **「어디까지 열 수 있는가」**를 정한다:
     *   지금 STEP 을 아직 안 적었으면 → **지금 STEP 까지**
     *   다 적었으면                  → **그 다음 하나까지**
     *
     * 그 너머는 잠근다. 다만 **한 번이라도 열어 본 것은 안 잠근다** — 열려 있던 것이
     * 눈앞에서 사라지면 고장으로 읽힌다. 순서를 건너뛰어 미리 열어 둔 곳에는 계속 적는다.
     */
    const openableUpTo = nowIdx < 0 ? groups.length : (unwritten[nowIdx] ? nowIdx : nowIdx + 1);
    const lockedBy = gi > openableUpTo && !everOpened.has(group.id)
      ? groups[Math.min(openableUpTo, groups.length - 1)].id : null;
    if (lockedBy) return { state: 'locked', open: false, lockedBy };
    return {
      state: isDone ? 'done' : (isNow ? 'now' : 'later'),
      // 학생이 손으로 여닫은 것이 있으면 그것이 이긴다. 없으면 지금 할 STEP 만 펼친다.
      open: manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow,
      lockedBy: null,
    };
  });
}

/**
 * 질문 ⓐ 를 **어느 STEP 밑에** 두는가.
 *
 * 「방금 두 챔버를 나란히 보았습니다」라고 묻는 물음이므로, **그 봄이 일어나는 STEP**
 * 밑이어야 한다. STEP 5(시간 경과 지켜보기)가 그 자리다 — 두 챔버의 색과 온도 차이를
 * 눈으로 본 **직후**에 물어야 답이 나온다. 6단계까지 미루면 그때 본 것을 기억으로
 * 더듬는 문제가 된다 (docs/06 — 순서가 곧 논증이다).
 *
 * **STEP 이 한 번에 하나만 펼쳐지고부터 이 짝이 중요해졌다.** 다 펼쳐져 있을 때는
 * 엉뚱한 STEP 에 붙어 있어도 스크롤하면 보여서 아무도 몰랐는데, 이제는 그 STEP 이
 * 끝나는 순간 접혀 사라진다. 아직 해 보지도 않은 조작을 「방금 했지요?」라고 묻는
 * 물음이 접힌 채로 지나가 버린다.
 * (centrifuge 세션이 자기 저장소에서 그 자리를 찾아 알려 주었다 — 거기서는 회전판을
 *  돌려 보기도 전인 STEP 에 「방금 돌려 보았습니다」가 붙어 있었다)
 *
 * `tests/notebook-steps.test.js` 가 못 박는다 — 이 STEP 은 그 봄을 하기 전에는 끝나지
 * 않고, 6단계 안내 문구도 같은 번호를 말한다.
 */
export const QUESTION_A_STEP = '5';

/**
 * 예상을 적는 쪽. 여기서는 **예상을 고르거나 적기 전에는** 「읽었습니다」가 안 먹는다.
 *
 * 읽는 쪽(`UI.bench.lock.required`) 가운데 하나여야 뜻이 있다 — 거기 없는 쪽을 가리키면
 * 그 단추가 아예 안 나오므로 **막는 코드가 영영 안 돈다.** `tests/notebook-steps.test.js`
 * 가 그 짝을 맞대 본다.
 */
export const PREDICT_STAGE = '3';

/**
 * 실험대 일은 끝났는데 **관찰 기록이 비어 있는가.**
 *
 * **막는 데 쓰지 않는다.** 다음 STEP 은 그대로 열리고 앞으로 올 STEP 도 눌러서 열린다 —
 * 순서를 건너뛴 학생이 적을 곳을 잃으면 안 되기 때문이다 (AGENTS.md §2.1).
 * 이 값은 **짚어 주는 데만** 쓴다. 실험대에서 한 일은 ✓ 가 말해 주는데 **본 것을
 * 적었는지는 아무도 안 말해 줘서**, 학생이 기록을 통째로 비운 채 끝까지 가 버린다.
 */
export function groupNotesEmpty(st, group) {
  const boxes = group.steps.filter((step) => step.note);
  if (boxes.length === 0) return false;
  return group.steps.some((step, i) =>
    step.note && !String(st.session.notes[substepId(group, i)] ?? '').trim())
    || qaEmpty(st, group);
}

/**
 * 질문 ⓐ 가 붙은 STEP 은 **ⓐ 까지 적어야 「다 적은 것」이다.**
 *
 * ── 플레이테스트에서 잡은 것 ────────────────────────────────────────
 * STEP 5 의 관찰 기록 두 칸(「몇 분 지켜보기」·「온도계 견주기」)을 적고 손을 떼는 순간
 * **STEP 5 가 접혔다.** 그 밑에 붙어 있던 질문 ⓐ 는 **한 번도 보지 못한 채** 사라졌다 —
 * 「방금 두 챔버를 나란히 보았습니다」라고 묻는 물음이 그 봄 직후에 물어야 한다고
 * 자리까지 정해 두었는데(`QUESTION_A_STEP`), 접히면서 그 자리가 통째로 지나가 버렸다.
 * 1단계·3단계 둘 다 그랬고 콘솔 에러는 없었다. 6쪽에 같은 칸이 있어 결국 답할 수는
 * 있지만, 그때는 「눈앞의 관찰」이 아니라 기억을 더듬는 문제가 된다.
 *
 * 그래서 ⓐ 를 그 STEP 의 관찰 기록 칸 하나로 센다. ⓐ 를 비워 두면 STEP 5 는 펼쳐진 채
 * 「기록이 비었습니다」를 달고 있고, 다음 STEP 은 잠겨 있다 — 다른 관찰 기록 칸과 똑같다.
 * **막는 것이 아니다** — 이미 관찰 기록에 걸려 있던 자물쇠에 칸 하나가 더해질 뿐이다.
 * `tests/playtest-review.test.js` 가 못 박는다.
 */
function qaEmpty(st, group) {
  return group.id === QUESTION_A_STEP && !String(st.session.notes['q.a'] ?? '').trim();
}

/**
 * 이 STEP 의 관찰 기록을 **다 적었는가.**
 *
 * 정본(banana-lab)은 세부 단계 **전부**에 칸이 있어 전부를 본다. 이 저장소는 칸이
 * `note` 가 붙은 자리에만 있으므로(열넷 중 일곱) **그 자리만** 본다 — 전부를 보면
 * 칸을 준 적도 없는 단계 때문에 **영영 참이 되지 않아 자물쇠가 안 풀린다.**
 * 3단계는 STEP 마다 칸 하나(키가 그룹 id)라 그것을 본다.
 *
 * **무엇을 적었는지는 보지 않는다. 채점이 아니다.**
 */
export function stepNotesWritten(st, group) {
  if ((st.session.level ?? 1) >= 3) {
    // 3단계도 질문 ⓐ 는 그 STEP 밑에 붙어 있다 — 같은 이유로 함께 센다 (qaEmpty).
    return Boolean(String(st.session.notes[group.id] ?? '').trim()) && !qaEmpty(st, group);
  }
  return !groupNotesEmpty(st, group);
}

const N = UI.notebook;

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
 * 실제로 **무엇이 보였는가** — 3단계에서 물은 것과 나란히 놓을 답.
 *
 * **눈으로 본 것**을 말한다. 「발아 중인 콩」처럼 학생이 **넣은 것**을 되풀이하면
 * 견줄 것이 없다 — 학생은 「이산화 탄소가 늘 것이다」라고 예상했는데 결과가
 * 「발아 중인 콩」이면 맞았는지 틀렸는지 알 수 없다.
 *
 * 마지막으로 기록한 것을 본다. 기록이 없으면 없다고 말한다 — 지금 챔버 상태를
 * 대신 보여 주면 「기록했다」와 「아직 안 했다」가 화면에서 같아진다.
 *
 * 보고서(`report.js`)도 같은 문장을 쓴다 — 화면과 종이가 다른 말을 하면 안 된다.
 */
export function actualSummary(st, topic) {
  const last = st.session.captures[st.session.captures.length - 1];
  if (!last) return N.actualNoRecord;

  if (topic === 'control') {
    if (last.comparison === 'ok') return N.actualControlOk;
    const names = last.mismatches.length
      ? last.mismatches.map((k) => UI.controls[k]).join(' · ')
      : UI.graph.notes[last.comparison === 'same-beans' ? 'sameBeans' : 'empty'];
    return last.mismatches.length ? N.actualControlOff(names) : names;
  }

  const view = Object.values(last.chambers).find((v) => v.beans === topic && !v.mixed);
  if (!view) return N.actualNoBeans;
  if (!view.btbStage) return N.actualNoBtb;
  return N.actualSeen(UI.chamber.btbStages[view.btbStage], UI.units.celsius(view.tempC));
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
 * 실험대가 아직 잠겨 있는가. `bench.js` 의 `lockState()` 와 **같은 셈**이다 —
 * 읽어야 하는 쪽이 하나라도 남아 있으면 잠겨 있다.
 */
const benchLocked = (st) =>
  UI.bench.lock.required.some((id) => !(st.session.readStages ?? []).includes(id));

const predictDone = (st) => N.predictTopics.every(({ id }) => hasNote(st, `predict.${id}`));
const wrapupDone = (st) =>
  ['q.a', 'q2', ...(isGroup(st) ? ['q3'] : [])].every((k) => hasNote(st, k));
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
  /**
   * 결과를 한 번은 기록해야 한다. **어긋난 기록도 센다** —
   * 어긋난 채로 잰 결과를 보는 것이 이 실험이 가르치려는 것이라,
   * 「제대로 된 기록이 있어야 다음으로 간다」로 만들면 그 배울 거리를 막는 셈이 된다.
   */
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

  /**
   * 학생이 **손으로** 여닫은 STEP. 그것이 「지금 할 차례라서 펼친 것」을 이긴다.
   *
   * **상태(`session`)에 넣지 않는다.** 무엇을 펼쳐 봤는지는 관찰도 기록도 아니고,
   * 되돌리기에 쌓이거나 보고서에 실릴 것이 아니다. 화면이 혼자 기억하면 되는 일이다.
   */
  const manualOpen = new Map();

  /**
   * 한 번이라도 **열려 본** STEP. 잠금은 여기 없는 것에만 건다.
   *
   * 「앞 STEP 을 다 적어야 뒤가 열린다」로만 두면, 미리 훑어본 STEP 이 뒤늦게 다시 잠긴다 —
   * 학생 눈에는 **열려 있던 것이 사라진 것**이고, 그건 고장으로 읽힌다.
   */
  const everOpened = new Set();
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
    return `<p class="stage-text">${N.problem}</p>`;
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
        <td>${role}</td>
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
        <ul class="practice-list">${N.valuesPractice.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
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
    return lead + N.predictTopics.map(({ id, title }) => {
      const key = `predict.${id}`;
      const val = st.session.notes[key] ?? '';
      const whyKey = `predict.why.${id}`;
      const choices = level >= 3 ? '' : `
        <div class="predict-choices" role="group" aria-label="${N.predictLabel}">
          ${N.predictOptions[id].map((opt) => `
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
          <h3>${title}</h3>
          ${choices}
          ${free}
        </div>`;
    }).join('');
  }

  /** `**굵게**` 만 허용한다. 문구에 강조를 넣으려고 HTML 을 통째로 열어 두지 않는다. */
  function emph(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  /* ---------------------------------------------------------------- */
  /* 4 탐구 과정 — STEP 1~6. 난이도별로 절차 제시만 달리한다 (docs/06 표). */
  /* ---------------------------------------------------------------- */

  /**
   * 세부 단계 하나.
   *
   * **관찰 기록 칸은 `note` 가 붙은 칸에만 낸다** (`UI.protocol` 머리말).
   * 준비 동작에까지 칸을 내면 빈칸이 줄줄이 남아 안 한 일처럼 읽히고, 학생은 적을 것이
   * 없는 칸을 채우느라 진짜 관찰을 대충 적는다.
   */
  function substepHtml(st, group, step, i, { level, nextIdx, pointing }) {
    const id = substepId(group, i);
    const done = stepDone(st, group.id, i);
    // 짚어 주는 것은 **지금 할 차례인 STEP 안에서만** 한다. 접힌 STEP 을 열어 보면
    // 거기에도 파란 테가 있어, 어디가 지금인지가 두 곳이 된다.
    const isNext = pointing && level === 1 && i === nextIdx;
    const hi = isNext ? ' substep--next' : '';
    /*
     * 「실험대에서 먼저 해 보세요」는 **실험대가 열려 있을 때만** 맞는 말이다.
     * 4쪽에 막 들어오면 아직 잠겨 있어, 물건을 눌러도 아무 일이 없다.
     * 그때는 **어디를 눌러야 열리는지**를 말한다.
     */
    const notYet = benchLocked(st) ? N.stepBenchLocked : N.stepNotYet;
    const hint = isNext ? `<p class="substep-hint">${emph(done ? N.stepWriteNow : notYet)}</p>` : '';
    const box = step.note ? `
      <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
      <textarea data-note="${id}" id="note-${id}"
        placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(st.session.notes[id] ?? '')}</textarea>` : '';
    return `
      <li class="substep${hi}" data-done="${done}" data-has-note="${Boolean(step.note)}">
        <div class="substep-title">
          <span class="substep-mark" aria-hidden="true">${done ? '\u2713' : '\u00b7'}</span>
          ${step.label}
          <span class="substep-state">${done ? N.stepDoneMark : N.stepTodoMark}</span>
        </div>
        <!-- **「어떻게 하는가」한 줄.** 제목(label)은 무엇을 하는가만 말한다 — 그것만 읽고
             실험대를 보면 무엇을 어디에 끌어다 대라는 건지 알 수 없다. how 는 실험대의 물건
             이름을 그대로 써서 손이 할 일을 적는다. 없는 조작은 절대 약속하지 않는다 —
             tests/uniformity.test.js 가 빈 how 와 실험대에 없는 이름을 잡는다. -->
        ${step.how ? `<p class="substep-how">${emph(step.how)}</p>` : ''}
        ${hint}
        ${box}
      </li>`;
  }

  /**
   * 탐구 과정 — **한 번에 한 STEP.**
   *
   * 여섯이 한꺼번에 펼쳐져 있으면 학생이 이 쪽을 「읽을 글」로 받는다. 주욱 읽고 내려간
   * 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다. 지금 할 것 하나만 펼치면 노트가
   * 글이 아니라 **따라가는 길**이 된다.
   *
   * 「지금 STEP」은 `groupDone` 이 거짓인 **첫 STEP** 이다. **따로 저장하지 않는다** —
   * 상태에서 나오므로 실험대에서 한 일이 그대로 노트를 넘긴다.
   *
   * **접힘은 잠금이 아니다.** 눌리지 않게 죽여 두는 것(`pointer-events:none` 따위)도
   * 쓰지 않는다. 앞으로 올 STEP 도 눌러서 열리고, 순서를 건너뛴 학생은 거기에 적으면
   * 된다 (AGENTS.md §2.1). 앞으로 올 STEP 을 **지우지도 않는다** — 몇 칸짜리
   * 여정인지 보여야 자기가 어디쯤인지 안다.
   */
  function renderStage4(st) {
    const level = st.session.level;
    const groups = UI.protocol;
    const groupsDone = groups.map((g) => groupDone(st, g.id));
    const doneCount = groupsDone.filter(Boolean).length;
    // 어떤 상태로 · 펼쳐서 그릴지는 `stepPanelStates` 하나가 정한다. 그리는 일과 떼어
    // 놓아야 DOM 없이 잴 수 있고, 여덟 실험이 같은 함수를 베껴 쓸 수 있다.
    const unwritten = groups.map((g) => !stepNotesWritten(st, g));
    const panels = stepPanelStates(groups, groupsDone, manualOpen, { unwritten, everOpened });

    const stepsHtml = groups.map((group, gi) => {
      const isDone = groupsDone[gi];
      const { state, open, lockedBy } = panels[gi];
      const isNow = state === 'now';

      let body;
      if (level >= 3) {
        // 3단계 — 목표만, 절차 없음. 무엇을 할지 스스로 정하는 것이 이 난이도다.
        const val = st.session.notes[group.id] ?? '';
        body = `
          <label class="notes-label" for="note-${group.id}">${N.goalOnlyLabel(group.title)}</label>
          <textarea data-note="${group.id}" id="note-${group.id}">${escapeHtml(val)}</textarea>`;
      } else {
        // 짚어 줄 곳은 **했는데 아직 안 적은** 칸이다. 그런 칸이 없으면 아직 안 한 첫 칸이다.
        // 앞에서부터 **아직 끝나지 않은 첫 칸**을 찾는다 — "했는데 안 적은 칸" 을 먼저
        // 찾으면 아직 손도 안 댄 첫 칸을 건너뛰고 뒤엣것을 짚는 일이 생긴다.
        const nextIdx = group.steps.findIndex((step, i) =>
          !stepDone(st, group.id, i) || (step.note && !st.session.notes[substepId(group, i)]));
        const items = group.steps
          .map((step, i) => substepHtml(st, group, step, i, { level, nextIdx, pointing: isNow }))
          .join('');
        body = `<ul class="substep-list">${items}</ul>`;
      }

      // 접힌 STEP 에 **「눌러서 열립니다」를 적어 둔다.** 말하지 않으면 잠긴 것으로 읽힌다.
      const openHint = isNow ? ''
        : `<span class="step-open-hint">${isDone ? N.stepReopenHint : N.stepPeekHint}</span>`;
      // 실험대 일은 끝났는데 기록이 빈 STEP 은 **눈에 띄게 짚는다. 막지는 않는다** —
      // 다음 STEP 도 앞으로 올 STEP 도 그대로 열린다.
      const notesEmpty = level <= 2 && isDone && groupNotesEmpty(st, group);

      /*
       * 앞 STEP 의 관찰 기록이 비어 있으면 이 STEP 은 **열리지 않는다.**
       *
       * `<details>` 를 죽이는 대신 **아예 다른 껍데기**로 그린다 — 열리는 척하다가 안
       * 열리는 것이 가장 나쁘다. `disabled` 도 `pointer-events` 도 쓰지 않는다.
       * 제목은 그대로 남긴다. 몇 칸짜리 여정인지는 계속 보여야 한다.
       * 그리고 **누가 막고 있는지**를 적는다 — 「열리지 않습니다」만 띄우면 학생은
       * 어디로 돌아가야 하는지 모른다.
       */
      if (lockedBy) {
        return `
          <div class="note-step note-step--locked" data-step-group="${group.id}"
            data-state="locked" data-done="false">
            <div class="step-summary">
              <h3 class="step-summary-title">STEP ${group.id} \u00b7 ${group.title}</h3>
              <span class="step-open-hint">${N.stepLockedHint}</span>
            </div>
            <p class="step-locked-why">${N.stepLockedWhy(lockedBy)}</p>
          </div>`;
      }
      /*
       * **「열어 본 적 있다」는 실제로 펼쳐졌을 때만 쌓는다.**
       *
       * 안 잠긴 것을 전부 쌓으면 자물쇠가 조용히 죽는다 — 학생이 STEP 1 의 기록만 먼저
       * 채우면 그 순간 아무것도 안 잠기고, 여섯이 통째로 「열어 본 것」이 되어 그 뒤로는
       * 영영 안 잠긴다. 화면은 멀쩡하고 검사도 초록불이다.
       * (osmosis 세션이 자기 저장소에서 잡았다)
       */
      if (open) everOpened.add(group.id);
      return `
        <details class="note-step" data-step-group="${group.id}"
          data-state="${state}" data-done="${isDone}" data-notes-empty="${notesEmpty}"${open ? ' open' : ''}>
          <summary class="step-summary">
            <!-- 제목은 접혀도 h3 로 남는다. 다른 쪽이 전부 h3 라, 여기만 span 이면
                 제목만 훑어 내려가는 학생에게 4단계가 통째로 사라진다. -->
            <h3 class="step-summary-title">STEP ${group.id} \u00b7 ${group.title}</h3>
            ${isDone ? '<span class="step-done-mark">\u2713</span>' : ''}
            ${isNow ? `<span class="step-now-badge">${N.stepNowBadge}</span>` : ''}
            ${notesEmpty ? `<span class="step-note-badge">${N.stepNoteEmpty}</span>` : ''}
            ${openHint}
          </summary>
          <div class="step-body">
            ${notesEmpty ? `<p class="step-note-hint">${emph(N.stepNoteEmptyHint)}</p>` : ''}
            ${body}
            ${group.id === QUESTION_A_STEP ? questionA(st) : ''}
          </div>
        </details>`;
    }).join('');

    // 몇 칸짜리 여정의 어디쯤인가. 접혀 있어도 이 한 줄이 그것을 말한다.
    // 기록이 빈 STEP 이 몇 개인지도 함께 적는다. 접혀 있으면 배지가 안 보이므로,
    // 다 끝내고도 기록이 텅 빈 채로 넘어가는 것을 여기 한 줄이 잡아 준다.
    const emptyCount = level <= 2
      ? groups.filter((g, gi) => groupsDone[gi] && groupNotesEmpty(st, g)).length : 0;
    // **「다 마쳤다」를 `state === 'now'` 가 없는 것으로 판정하면 안 된다.** 실험대 일은
    // 마쳤는데 안 적은 STEP 은 표시가 `done` 이고 뒤는 전부 `locked` 라 `now` 가 사라진다 —
    // STEP 하나만 끝냈는데 「여섯을 모두 마쳤습니다」가 떴다. **같은 셈**을 쓴다.
    const allDone = nowStepIndex(groupsDone, unwritten) < 0;
    const tallyText = allDone ? N.stepAllDone : N.stepProgress(doneCount, groups.length);
    const tally = `<p class="step-tally${allDone && !emptyCount ? ' step-tally--done' : ''}">`
      + `${tallyText}${emptyCount ? ` · ${N.stepTallyNotes(emptyCount)}` : ''}</p>`;

    return `<p class="stage-text step-lead">${emph(N.stepLeadIn)}</p>
      ${tally}
      <div id="note-step-4">${stepsHtml}</div>`;
  }

  /**
   * 질문 ⓐ — STEP 5(시간 경과 지켜보기) 직후에 묻는다. **순서가 곧 논증이다.**
   *
   * 두 챔버의 색과 온도 차이를 눈으로 본 **직후**에 물어야 답이 나온다.
   * 6단계까지 미뤄서 물으면 학생은 그때 본 것을 기억으로 더듬어야 하고,
   * 「왜 다르게 변했나」가 눈앞의 관찰이 아니라 지식 회상 문제가 된다.
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
        <label class="notes-label" for="note-qa-step5">${N.questionA.label}</label>
        <textarea data-note="q.a" id="note-qa-step5">${escapeHtml(val)}</textarea>
        ${g ? `<p class="grade-line" id="grade-qa" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>` : ''}
      </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* 5 결과 — 캡처 자동 첨부 + 배율 직접 입력                            */
  /* ---------------------------------------------------------------- */

  /**
   * 5 결과 — 기록해 둔 것들.
   *
   * 기록 하나가 **두 챔버 한 벌**이다. 그림(챔버 카드 둘)이 몸통이고 그래프가 보조다.
   * 그 아래에 **무엇이 어긋났는지**를 이름과 값으로 적는다 — 이 실험이 가르치려는 것이
   * 거기 있다.
   *
   * 기록은 `at` 번호로 다룬다. 배열 인덱스로 지우면 가운데 것을 지웠을 때 뒤엣것의
   * 번호가 밀려, **그 기록에 딸린 글이 남의 것이 된다.**
   */
  function renderStage5(st) {
    const caps = st.session.captures;
    if (caps.length === 0) return `<p class="stage-empty">${N.noCaptures}</p>`;
    return `<p class="stage-empty">${N.captureListHint(caps.length)}</p>
      <div class="capture-list">${caps.map((c, i) => {
      const at = c.at ?? i;
      const key = `read.${at}`;
      const domId = `note-read-${at}`;  // id 에 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const g = saved.trim() ? gradeQuestion('record', saved) : null;
      const views = c.chambers;
      const notes = resultNotes(views, c.comparison, c.mismatches);
      return `
        <div class="capture-card" data-comparison="${c.comparison}">
          <div class="capture-head">
            <h3>${N.captureOrdinal(i + 1)} · ${c.elapsedMin > 0 ? N.captureAt(c.elapsedMin) : N.captureNotStarted}${
              caps.some((o, j) => j < i && o.elapsedMin === c.elapsedMin) ? ` · ${N.captureSameMin}` : ''}</h3>
            <button type="button" class="capture-del" data-del="${at}"
              aria-label="${N.captureDeleteLabel(i + 1)}">${N.captureDelete}</button>
          </div>
          <!-- 그때 본 것을 그대로 되살린다. 기록이 두 챔버의 뷰를 통째로 담고 있으므로
               같은 그림이 나온다. idPrefix 를 기록마다 달리 주지 않으면 문서에 같은 id 가
               여러 벌 생겨 에러 없이 조용히 틀린다 — 번호(at)로 붙인다. -->
          ${renderComparison(views, { idPrefix: `cap${at}` })}
          <div class="capture-graph">${renderGraph([views.L, views.R], { idPrefix: `capg${at}` })}</div>
          <ul class="result-notes">${notes.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
          <label class="notes-label" for="${domId}">${N.recordReadLabel}</label>
          <textarea data-note="${key}" id="${domId}"
            placeholder="${escapeHtml(N.recordReadPlaceholder)}">${escapeHtml(saved)}</textarea>
          ${g ? `<p class="grade-line" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>` : ''}
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
    const rows = N.predictTopics.map(({ id, title }) => `
      <div class="predict-compare-row">
        <h4>${title}</h4>
        <dl class="compare-pair">
          <dt>${N.predictRecapLabel}</dt>
          <dd>${escapeHtml(st.session.notes[`predict.${id}`] || N.predictNone)}</dd>
          <dt>${N.actualLabel}</dt>
          <dd>${actualSummary(st, id)}</dd>
        </dl>
      </div>`).join('');
    return `<section><h3>${N.predictHeading}</h3>${rows}</section>`;
  }

  /**
   * 견줄 수 없었던 기록을 돌아보는 자리.
   *
   * **나무라지 않는다.** 무엇이 어긋났는지 스스로 짚어 보는 것이 이 실험의 배울 거리다.
   * 어긋난 기록을 **지우거나 숨기지 않는** 것과 같은 이유다 — 숨기면 학생은 자기가
   * 무엇을 잘못했는지 모른 채 깨끗한 결과만 본다.
   */
  function renderReflect(st) {
    const off = st.session.captures.filter((c) => c.comparison !== 'ok');
    if (off.length === 0) return '';
    const items = off.map((c, i) => {
      const at = c.at ?? i;
      const key = `reflect.${at}`;
      const chosen = st.session.notes[key];
      const opts = [...Object.entries(UI.controls), ['beans', N.reflectOther]];
      const options = opts.map(([k, label]) => `
        <button type="button" class="reflect-opt${chosen === k ? ' reflect-opt--chosen' : ''}"
          data-reflect="${key}" data-value="${k}" aria-pressed="${chosen === k}">${label}</button>`).join('');
      // 어느 챔버를 다시 볼지는 학생이 정한다. 어긋난 쪽을 대신 골라 주면 답을 알려 주는 셈이다.
      const retry = chosen
        ? CHAMBERS.map((id) => `<button type="button" class="reflect-retry" data-retry="${id}"
            >${UI.chambers[id].short} ${N.reflectRetry}</button>`).join('')
        : '';
      return `
        <div class="reflect-item" data-at="${at}">
          <p>${N.reflectQuestion(st.session.captures.indexOf(c) + 1)}</p>
          <div class="reflect-options" role="group">${options}</div>
          ${retry}
        </div>`;
    }).join('');
    return `<section id="reflect"><h3>${N.reflectHeading}</h3>${items}</section>`;
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
        <label class="notes-label" for="note-q2">${N.q2Label}</label>
        <textarea data-note="q2" id="note-q2">${escapeHtml(q2)}</textarea>
        ${gradeLine('q2', 'q2', q2)}
      </section>
      ${isGroup(st) ? `
      <section class="grade-block">
        <label class="notes-label" for="note-q3">${N.q3Label}</label>
        <textarea data-note="q3" id="note-q3">${escapeHtml(q3)}</textarea>
        ${gradeLine('q3', 'q3', q3)}
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
        <label class="notes-label" for="note-reflect-${key}">${label}</label>
        <textarea data-note="feedback.${key}" id="note-feedback-${key}"
          placeholder="${escapeHtml(eg)}">${escapeHtml(st.session.notes[`feedback.${key}`] ?? '')}</textarea>
      </div>`).join('');

    /*
     * **안전 안내는 여기 없다.** 준비물(2쪽)로 옮겼다 — 자기 평가는 다 끝낸 뒤에 보는
     * 쪽이라, 「실제 실험에서는 이렇게 하세요」를 여기서 읽으면 이미 늦다.
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
    /**
     * 손으로 여닫은 것을 기억한다. **`toggle` 이 아니라 `summary` 의 `click` 을 듣는다.**
     *
     * `<details open>` 을 `innerHTML` 로 꽂으면 브라우저가 **삽입만으로 `toggle` 을
     * 한 번 쏜다.** `toggle` 을 들으면 「지금 할 차례라서 펼쳐진 것」이 「학생이 손으로
     * 연 것」으로 기록되고, 그 STEP 이 끝난 뒤에도 **영영 안 접힌다.**
     * `click` 은 사람이 누를 때만 온다.
     *
     * `summary` 는 포커스를 받으므로 Enter·Space 도 `click` 으로 온다 — 키보드도 같이 산다.
     */
    panelEl.querySelectorAll('details[data-step-group] > summary').forEach((el) => {
      el.addEventListener('click', () => {
        // 기본 동작이 아직 일어나기 전이라 `open` 은 누르기 **전**의 값이다.
        const id = el.parentElement.dataset.stepGroup;
        const willOpen = !el.parentElement.open;
        manualOpen.set(id, willOpen);
        /*
         * **여기서도 「열어 본 적 있다」를 담는다.** 그리는 쪽에도 같은 줄이 있지만
         * 둘 다 있어야 한다.
         *
         * 누르는 것 자체는 **다시 그리지 않는다.** 그래서 누른 바로 다음 렌더에서
         * 잠금이 걸리면, 잠금 판정이 먼저 돌아 일찍 되돌아가므로 그리는 쪽의 담는 줄까지
         * 못 간다 — **손으로 펼친 STEP 이 도로 잠긴다.** 사이에 렌더가 한 번 끼면
         * 우연히 담겨서 안 보이는데, 안 끼면 그대로 난다.
         */
        if (willOpen) everOpened.add(id);
      });
    });
    panelEl.querySelectorAll('[data-note]').forEach((el) => {
      el.addEventListener('change', () => {
        // **저장이 판을 갈지 않게 한다.** Tab 으로 옮길 때는 `change` 가 포커스도 누름도
        // 없는 사이에 와서, 이 표시가 없으면 그 자리에서 다시 그려지고 **다음 칸이
        // 사라진다** — 이어서 친 글자가 엉뚱한 칸으로 들어간다.
        savingNote = true;
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
        savingNote = false;
        setTimeout(flushRender, 0);
      });
      /*
       * **글자를 칠 때마다 관문의 「말」만 제자리에서 고친다.**
       *
       * 글은 손이 칸을 떠나야 저장되므로, 다 적어도 단추와 잠긴 STEP 은 **옛말**을 한다 —
       * 「먼저 고르세요」·「앞 STEP 을 먼저 적으세요」. 눌러 보면 넘어가지만 **그 전에
       * 학생은 「다 적었는데 안 열리는 화면」을 본다.** 판을 갈지 않고 글자만 고친다.
       */
      el.addEventListener('input', () => { patchGate(); patchStepHints(); });
      // 적는 동안 밀어 둔 다시 그리기를 여기서 따라잡는다. `change` 는 글이 바뀌었을
      // 때만 오므로, 아무것도 안 고치고 빠져나간 경우까지 보려면 `blur` 가 있어야 한다.
      // blur 가 focus 보다 먼저 오므로 한 프레임 미룬다 — 옆 칸으로 옮겨 가는 중이면
      // 그 칸이 포커스를 잡은 뒤에 판정된다.
      el.addEventListener('blur', () => setTimeout(flushRender, 0));
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
      btn.addEventListener('click', () => onOpenZoom('chamber', btn.dataset.retry, btn));
    });
    panelEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_CAPTURE', { at: Number(btn.dataset.del) });
      });
    });
    panelEl.querySelector('#mark-read')?.addEventListener('click', (e) => {
      /*
       * **표시만 하고 안 막으면 표시가 거짓말이 된다.** `aria-disabled` 는 보조기기에
       * 알릴 뿐 브라우저가 눌림을 막아 주지는 않으므로 누르는 쪽에서 한 번 더 본다.
       *
       * **다만 DOM 의 표시를 믿으면 안 된다 — 낡아 있을 수 있다.**
       * 마지막 칸에 적고 곧장 이 단추를 누르면 이런 차례가 된다:
       * 누름 → 칸에서 포커스가 빠짐 → `change` → 저장 → (다시 그리기는 누르는 중이라
       * 밀림) → 누름 완료. 이때 단추에는 **적기 전의 `aria-disabled="true"`** 가
       * 그대로 붙어 있어, 그 표시를 믿으면 **방금 조건을 채운 누름을 삼킨다.**
       * 학생 눈에는 고장 난 단추이고 두 번 눌러야 겨우 넘어간다.
       *
       * 그래서 **지금 상태**를 본다. 표시는 표시대로 두고, 판정은 상태가 한다.
       */
      const st = store.getState();
      if (activeStage === PREDICT_STAGE && !predictDone(st)) return;
      const from = activeStage;
      store.dispatch('MARK_READ', { stage: from });
      /**
       * 누른 순간 **다음 읽을 쪽으로 넘긴다.** 그 자리에 ✓ 만 남기면 학생이 탭을 직접
       * 찾아 눌러야 하고, 거기서 멈춘다.
       *
       * **자리로 고른다. 「아직 안 읽은 쪽」으로 고르면 안 된다** — 차례대로 읽는 동안에는
       * 늘 맞아서 안 보이다가, **4쪽을 먼저 읽어 둔 학생이 3쪽에서 누를 때만 거꾸로
       * 끌려간다.** 읽음 여부가 아니라 목록에서의 다음 자리다.
       *
       * 마지막 읽을 쪽에서는 넘기지 않는다. 그때 열리는 것은 **다음 노트 쪽이 아니라
       * 실험대**이고(`readAllDone` 이 그렇게 말한다), 5쪽 결과로 보내면 아직 아무것도
       * 없는 빈 쪽이 뜬다 — 할 일이 있는 곳은 실험대다.
       */
      const required = UI.bench.lock.required;
      const next = required[required.indexOf(from) + 1];
      if (next) { activeStage = next; }
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
    /**
     * 예상 쪽에서는 **예상을 고르거나 적기 전에는** 이 단추가 안 먹는다.
     *
     * `disabled` 를 쓰지 않는다. 그것은 단추에서 **포커스를 빼앗아** 키보드·낭독기로
     * 오는 학생이 그 단추에 닿을 수조차 없게 만들고, 그러면 **「왜 못 누르는지」를 들을
     * 길이 사라진다** — 이유를 말하려고 막는 것인데 이유를 못 듣게 하는 셈이다.
     * 그래서 단추는 살려 두고 `aria-disabled` 로 알리며, 이유 문단을
     * `aria-describedby` 로 묶는다 — **눈으로 보는 사람에게만 이유가 있으면 안 된다.**
     */
    const blocked = activeStage === PREDICT_STAGE && !predictDone(st);
    // **이유 문단은 늘 그리고 숨기기만 한다.** 막혔을 때만 그리면, 글자를 치다 다시
    // 막히는 순간 붙일 자리가 없어 판을 갈아야 한다 — 그러면 치던 칸이 사라진다.
    return `
      <div class="read-mark">
        <p>${N.readLeadIn}</p>
        <p class="read-why" id="read-why"${blocked ? '' : ' hidden'}>${N.readNeedPredict(st.session.level)}</p>
        <button type="button" id="mark-read" class="read-confirm" aria-describedby="read-why"
          ${blocked ? 'aria-disabled="true"' : ''}>${N.readConfirm}</button>
      </div>`;
  }

  /**
   * 지금 학생이 **칸에 적고 있는가.**
   *
   * 적는 중이면 패널을 다시 그리면 안 된다 — `innerHTML` 을 갈아 끼우는 순간
   * 치고 있던 `textarea` 가 통째로 새것으로 바뀌고, **아직 `change` 로 저장되지 않은
   * 글이 그대로 사라진다.**
   */
  const isTyping = () => {
    const el = document.activeElement;
    return Boolean(el && panelEl.contains(el) && el.matches('textarea[data-note], input[data-note]'));
  };
  // 적는 동안 밀어 둔 다시 그리기가 있는가. 손을 떼면 그때 한 번에 따라잡는다.
  let renderPending = false;

  /**
   * 지금 패널 안에서 **누르는 중**인가 — 눌렀고 아직 안 뗐다.
   *
   * ── 마지막 칸에 적고 곧장 단추를 누르면 그 누름이 사라졌다 ──────────
   * 칸에 적고 「이 쪽을 읽었습니다」를 누르면 이런 차례가 된다:
   * **누름 → 칸에서 포커스가 빠짐 → `change` → 저장 → 다시 그리기 → 단추가 사라짐 →
   * (없어진 단추에) 누름 완료.** 그래서 **아무 일도 안 일어난다.**
   * 학생 눈에는 고장 난 단추이고, 두 번 눌러야 겨우 넘어간다.
   *
   * 그래서 누르는 동안에는 다시 그리기를 밀어 둔다. 손을 뗀 **다음 차례**에 따라잡는다 —
   * 그때는 누름이 이미 제 핸들러에 닿은 뒤다.
   */
  let pressing = false;

  /**
   * 지금 **내가 방금 저장시킨** 참인가.
   *
   * ── Tab 으로 칸을 옮기면 글자가 첫 칸으로 몰렸다 ────────────────────
   * 마우스로 옮길 때는 `pointerdown` 이 먼저 와서 다시 그리기를 막아 준다.
   * **Tab 에는 그 누름이 없다.** 게다가 `change` 는 포커스가 **아직 `body` 인 동안**
   * 오므로 「지금 글칸에 손이 있는가」도 거짓이다 — 두 관문이 다 열린 채 판이 갈린다.
   * 재어 보니 화면 `["예상2예상0","",""]` · 상태 `["예상0","",""]` 였다.
   *
   * 그래서 관문을 「누가 눌렀나」가 아니라 **「내가 방금 저장시켰나」**로 옮긴다.
   */
  let savingNote = false;

  /**
   * 다시 그린다 — **적고 있는 중이 아니면.**
   *
   * ── 재는 동안 적으면 글이 사라지던 일 ──────────────────────────────
   * 이 함수는 `store.subscribe` 로 **상태가 바뀔 때마다** 불린다. 그런데 챔버를 재는
   * 동안에는 `TICK` 이 **1초에 한 번** 상태를 바꾸므로, 패널이 1초마다 통째로 다시
   * 그려졌다. 그 사이에 학생이 칸에 적고 있으면 치던 `textarea` 가 교체되고
   * **포커스가 `<body>` 로 떨어져, 그 뒤에 친 글자는 아무 데도 안 들어간다.**
   *
   * 재어 보니 재는 동안 28자를 치면 **0자가 남았다.** 4단계뿐 아니라 6단계 마무리 칸도
   * 같았다. **콘솔 에러는 한 줄도 안 난다.** 화면은 조용하고, 종이에는 빈칸이 아니라
   * **문장 앞토막**이 실린다 — 「적지 않았습니다」보다 나쁘다. 선생님은 학생이 그렇게
   * 적었다고 읽는다.
   *
   * 하필 지켜보는 동안 적으라고 만든 칸(STEP 5 의 「몇 분 지켜보기」·「온도계 견주기」)이
   * **재는 동안에만 열리는 자리**다. 그러니 이 버그는 가장 적으라던 곳에서 난다.
   *
   * 그래서 적는 중에는 **패널 속만** 밀어 둔다. 탭의 ✓ 와 보고서 단추는 패널 밖이라
   * 그대로 따라간다 — 얼어 보이지 않게 하려는 것이다. 손을 떼면(`blur`) 곧바로 따라잡는다.
   * ──────────────────────────────────────────────────────────────── */
  function render() {
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다 —
      // 앞 네 쪽은 실험대를 여는 조건이고, 뒤 세 쪽은 보고서를 내는 조건이다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });
    // 적고 있거나 · 누르는 중이거나 · 방금 저장시킨 참이면 속은 그대로 두고 밀어 둔다.
    if (isTyping() || pressing || savingNote) {
      renderPending = true;
      renderReportSlot(st);
      return;
    }
    renderPending = false;
    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st) + readFooter(st);
    bindPanel();
    renderReportSlot(st);
  }

  /**
   * 단추의 잠금과 까닭 글자를 **제자리에서** 고친다. 판을 갈지 않는다.
   *
   * 글은 손이 칸을 떠나야 저장되므로, 다 적어도 단추는 옛말을 한다. 눌러 보면 넘어가지만
   * **그 전에 학생은 「다 적었는데 안 열리는 화면」을 본다.**
   * `aria-disabled` 는 그대로 둔다 — 보조기기가 「지금은 못 누른다」를 들을 길이다.
   * **판정은 누를 때 상태가 한다.** 표시와 판정, 두 갈래가 각자 제 일을 한다.
   */
  /**
   * **아직 저장 안 된 글까지 넣은** 상태 한 벌.
   *
   * 글은 손이 칸을 떠나야 저장된다. 그래서 저장된 것만 보면 **다 적어 놓고도**
   * 「먼저 적으세요」가 그대로 남는다 — 학생 눈에는 화면이 거짓말을 하는 것이다.
   * 이 값은 **말을 고치는 데만** 쓴다. 진짜 판정(누를 때·다시 그릴 때)은 상태가 한다.
   */
  function liveState() {
    const st = store.getState();
    const notes = { ...st.session.notes };
    for (const el of panelEl.querySelectorAll('textarea[data-note], input[data-note]')) {
      if (el.type === 'radio' && !el.checked) continue;
      notes[el.dataset.note] = el.value;
    }
    return { ...st, session: { ...st.session, notes } };
  }

  function patchGate() {
    const btn = panelEl.querySelector('#mark-read');
    if (!btn) return;
    const blocked = activeStage === PREDICT_STAGE && !predictDone(liveState());
    if (blocked) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
    const why = panelEl.querySelector('#read-why');
    if (why) why.hidden = !blocked;
  }

  /**
   * 잠긴 STEP 의 **말만** 고친다.
   *
   * 잠긴 STEP 은 `<div>` 라 여기서 열어 줄 수는 없다 — 여는 것은 누르는 순간이다.
   * 그래도 「앞 STEP 을 먼저 적으세요」가 **방금 다 적은 학생에게** 그대로 남아 있으면
   * 화면이 거짓말을 한다. 글자만 지금 사실로 바꾼다.
   */
  function patchStepHints() {
    const locked = panelEl.querySelectorAll('.note-step--locked');
    if (locked.length === 0) return;
    const st = liveState();
    const groups = UI.protocol;
    const panels = stepPanelStates(groups, groups.map((g) => groupDone(st, g.id)), manualOpen, {
      unwritten: groups.map((g) => !stepNotesWritten(st, g)), everOpened,
    });
    for (const el of locked) {
      const gi = groups.findIndex((g) => g.id === el.dataset.stepGroup);
      const by = panels[gi]?.lockedBy ?? null;
      const why = el.querySelector('.step-locked-why');
      const hint = el.querySelector('.step-open-hint');
      if (why) why.textContent = by ? N.stepLockedWhy(by) : N.stepUnlockedNow;
      if (hint) hint.textContent = by ? N.stepLockedHint : N.stepPeekHint;
    }
  }

  /** 손을 뗐다 — 밀어 둔 것이 있으면 그때 따라잡는다. */
  function flushRender() {
    if (renderPending && !isTyping() && !pressing && !savingNote) render();
  }

  /*
   * 누름은 **패널이 다시 그려지는 동안에도** 제 핸들러에 닿아야 한다.
   * 잡는 단계(capture)에서 표시해 두고, 손을 뗀 **다음 차례**에 푼다 —
   * `pointerup` 다음에 `click` 이 오므로, 한 차례 미뤄야 그 사이에 안 지워진다.
   */
  panelEl.addEventListener('pointerdown', () => { pressing = true; }, true);
  window.addEventListener('pointerup', () => {
    if (!pressing) return;
    setTimeout(() => { pressing = false; flushRender(); }, 0);
  }, true);

  store.subscribe(render);
  render();
}
