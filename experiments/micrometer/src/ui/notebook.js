/**
 * 탐구 노트 — 7단계 패널.
 *
 * 7단계(문제 인식~자기 평가)를 최상위 탭으로, 여섯 개 조작 절차는 4단계 「탐구 과정」 안의
 * STEP 으로 내린다. `strings.js` 의 `UI.protocol` 이 그 STEP 의 제목·세부 단계·예시 문구를
 * 갖고 있으므로 그대로 쓰고, 세부 단계 id(1a, 1b, 2a…)는 배열 순서에서 글자를 붙여 만든다.
 *
 * 결과를 바꾸는 조작은 전부 `store.dispatch(...)` 를 거쳐 `reduce()` 로 간다 —
 * 이 파일은 상태를 직접 대입하지 않는다.
 *
 * ── 이 실험에서 5단계가 달라진 까닭 ────────────────────────────────
 * 바나나랩의 결과는 「사진 세 장」이었다. 여기서는 **표 두 벌**이다.
 *   · `session.calibrations` — 접안 눈금 한 칸이 몇 µm 인가. 행마다 배율이 함께 찍힌다
 *   · `session.measurements` — 이 세포가 몇 µm 인가. `calibrationAt` 으로 어느 눈금값을
 *     썼는지가 남는다
 * 이 둘을 **배율별로 나란히** 놓는 것이 이 실험의 함정을 드러내는 유일한 장치다.
 * 400배에서 잰 칸 수에 100배에서 구한 한 칸을 곱한 학생은, 화면이 아무 말을 하지 않아도
 * 자기가 적은 두 숫자가 어긋나 있는 것을 본다 (`tasks/DESIGN-notebook.md` §7.2).
 *
 * **앱은 채점하지 않는다.** 「정답입니다」도 「다시 하세요」도 없고, 표의 어느 칸도
 * 시뮬레이터가 채우지 않는다. 채워 주는 순간 그것이 답을 말한 것이 된다.
 */

import { MODES, PAN_LIMIT } from '../sim/state.js';
import { ASSETS } from '../assets/index.js';
import { renderFOV } from '../render/fov.js';
import { observability } from '../sim/quality.js';
import { gradeQuestion, gradeMagnification } from './grading.js';
import { EYEPIECE, STAGE_DIV_UM, foldSkewDeg, focusTolerance } from '../sim/optics.js';
import { UI } from './strings.js';
import { mountGroupHead, decorateNoteFields } from '../../../../packages/lab-kit/group/panel.js';
import { mountPracticeHead } from '../../../../packages/lab-kit/practice/panel.js';
import { stepDone, groupDone, resultsDone, resultsMissing } from '../sim/progress.js';
import { revealNotePage } from '../../../../packages/lab-kit/ui/reveal-note.js';

/**
 * STEP 마다 **어떤 상태로, 펼쳐서 그릴지.** 상태 하나에서 나온다.
 *
 * 「지금 STEP」 은 `groupDone` 이 거짓인 **첫 STEP** 이다. 따로 저장하지 않는다 —
 * 실험대에서 한 일이 그대로 노트를 넘긴다. 저장해 두면 되돌리기를 했을 때 노트와
 * 실험대가 서로 다른 곳을 가리킨다.
 *
 * **학생이 손으로 여닫은 것은 기억해서 그것이 이긴다.** 순서를 건너뛰어 실험한 학생이
 * 앞선 STEP 을 펼쳐 두었는데 다음 조작 한 번에 도로 접히면, 화면이 학생과 씨름한다.
 *
 * DOM 없이 판정되도록 그리는 일에서 떼어 놓았다 — `tests/notebook.steps.test.js` 가
 * 이 함수를 잰다. **여덟 실험이 같은 계보이므로 베껴 갈 자리가 여기다.**
 *
 * @param {{id:string}[]} groups      STEP 들 (`UI.protocol`)
 * @param {boolean[]} groupsDone      STEP 마다 끝났는가
 * @param {Map<string,boolean>} manualOpen  학생이 손으로 여닫은 기록 (STEP id → 열림)
 * @returns {{state:'done'|'now'|'later', open:boolean}[]}
 */
/**
 * 이 STEP 이 **잠기는가**, 잠긴다면 무엇 때문인가.
 *
 * 셋을 다 지나야 잠근다:
 *   ① 지금 STEP 보다 **뒤**일 것 (지나온 것·지금 것은 안 잠근다)
 *   ② 지금 STEP 의 관찰 기록이 **비어** 있을 것
 *   ③ 그 STEP 을 **한 번도 열어 본 적이 없을** 것
 *
 * ★ ③ 이 있어서 「접힘은 잠금이 아니다」(AGENTS.md §2.1)와 부딪히지 않는다.
 *   한 번 닿아 본 STEP 은 앞엣것을 도로 지워도 다시 안 잠기고, 순서를 건너뛴 학생은
 *   열어 둔 곳에 계속 적을 수 있다. 잠금은 **아직 한 번도 안 가 본 앞쪽**에만 걸린다.
 *
 * 그리는 일에서 떼어 놓았다 — DOM 없이 판정된다. **여덟이 같은 계보이므로 베껴 갈 자리다.**
 *
 * @returns {string|null}  잠겼으면 「무엇을 적어야 하는지」의 STEP id, 아니면 null
 */
export function stepLockedBy(groups, gi, nowIdx, unwritten, everOpened) {
  if (everOpened.has(groups[gi].id)) return null;      // ③ 한 번 열어 본 것은 안 잠근다

  /**
   * ★ **한 칸씩만 열린다.**
   *
   * 앞서는 「지금 STEP 의 기록이 비었는가」 하나로 뒤를 통째로 잠갔다. 그래서 STEP 1 을
   * 적는 순간 **여섯이 한꺼번에 다 열렸다.** 선생님이 플레이하다 찾으셨다 —
   * 「step1 의 관찰 기록을 작성하면 **step2 가 열리도록** 해야지;; 왜 나머지 step 들까지도
   * 다 열려」. 한 칸 여는 것과 통째로 여는 것 사이에 잠금의 뜻이 전부 들어 있다.
   *
   * 어디까지 열 수 있는가:
   *   지금 STEP 의 기록이 **비었으면** → 지금 것까지 (`nowIdx`)
   *   적었으면                        → **딱 한 칸 더** (`nowIdx + 1`)
   *   다 끝났으면(`nowIdx < 0`)        → 전부
   */
  const openableUpTo = nowIdx < 0 ? groups.length : (unwritten[nowIdx] ? nowIdx : nowIdx + 1);
  if (gi <= openableUpTo) return null;

  // 잠긴 이유는 「어디를 적어야 열리는가」다. 열 수 있는 마지막 칸을 가리킨다.
  return groups[Math.min(openableUpTo, groups.length - 1)].id;
}

export function stepPanelStates(groups, groupsDone, manualOpen = new Map()) {
  const nowIdx = groupsDone.findIndex((d) => !d);   // 다 끝났으면 -1
  return groups.map((group, gi) => {
    const isDone = groupsDone[gi];
    const isNow = gi === nowIdx;
    return {
      state: isDone ? 'done' : (isNow ? 'now' : 'later'),
      // 학생이 손으로 여닫은 것이 있으면 그것이 이긴다. 없으면 지금 할 STEP 만 펼친다.
      open: manualOpen.has(group.id) ? manualOpen.get(group.id) : isNow,
    };
  });
}


const N = UI.notebook;

/**
 * 화면에 넣기 전에 막는다.
 *
 * **따옴표까지 막는다.** 학생이 쓴 글이 본문에만 들어가는 게 아니라 속성 안에도 들어가기 때문이다
 * (5단계의 계산 칸 `value="…"`). `&<>` 만 막으면 큰따옴표 하나로 속성을 빠져나가
 * 새 속성을 붙일 수 있다. 자기 화면에만 영향을 주는 자리이지만, 그 글은 보고서로 인쇄되고
 * 남에게 건네진다. 막는 값이 셋에서 다섯으로 느는 것뿐이라 굳이 자리를 가리지 않는다.
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** 총배율. 접안렌즈는 10배로 고정이라 대물렌즈 배율만 곱하면 된다. */
const totalMag = (objective) => UI.units.mag(objective * EYEPIECE);

/**
 * 기록된 시야 한 장의 관찰 가능성.
 *
 * `fieldParams()` 는 두 눈금자의 **각도를 따로** 남기고(`eyeAngle`·`itemAngle`),
 * 재물대 위치도 px 로 남긴다. `observability()` 가 원하는 것은 그 둘에서 나오는
 * 파생값(`angleGapDeg`·`centerErr`)이라, 여기서 한 번 옮겨 준다.
 * 그냥 넘기면 정렬 항목이 기본값 90° 로 읽혀 **어느 기록이든 0점**이 된다 —
 * 에러 없이 조용히 틀리는 자리라 보고서와 화면이 같은 함수를 쓰게 한다.
 */
export function captureScore(c) {
  return observability({
    ...c,
    angleGapDeg: Math.abs(foldSkewDeg(c.eyeAngle ?? 0, c.itemAngle ?? 0)),
    centerErr: Math.min(1, Math.hypot(c.panX ?? 0, c.panY ?? 0) / PAN_LIMIT),
  });
}

/**
 * 관찰 기록 칸에 흐리게 띄울 예시 문구.
 *
 * "관찰 기록" 이라고만 써 두면 무엇을 어떻게 적어야 할지 감이 안 온다.
 * placeholder 라 칸을 누르는 순간 사라지고, 학생이 쓴 글과 섞이지 않는다 — 브라우저가 하는 일이다.
 *
 * **1단계는 세부 단계마다 다른 예시를 띄운다.** 열일곱 칸에 같은 문장을 띄우면
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

/** notes 키 '3b' 를 "STEP 3 · 눈금값 기록하기" 같은 사람이 읽는 문장으로. */
export function stepNoteLabel(key) {
  const m = /^(\d+)([a-z])?$/.exec(String(key));
  if (!m) return key;
  const group = UI.protocol.find((g) => g.id === m[1]);
  if (!group) return key;
  const title = m[2] ? group.steps[m[2].charCodeAt(0) - 97]?.label : group.title;
  return `STEP ${group.id} · ${title ?? group.title}`;
}

/* ------------------------------------------------------------------ */
/* 학생이 적은 값 — 이 실험의 결과는 전부 여기서 나온다                  */
/* ------------------------------------------------------------------ */

/**
 * 계산 칸의 저장 키. **기록에 붙은 번호(`at`)로 만든다.**
 *
 * 배열 인덱스로 만들면 가운데 기록을 지우는 순간 아래 행들의 답이 통째로 한 칸씩 밀린다.
 * `at` 은 `nextAt()` 이 늘 새 번호를 주므로 지워도 다시 쓰이지 않는다.
 */
const calibKey = (at, field) => `calib.${at}.${field}`;
const measKey = (at, field) => `meas.${at}.${field}`;

/** 칸 하나에 적힌 글. 없으면 빈 문자열. */
const noteOf = (st, key) => String(st.session.notes[key] ?? '');

/** 칸이 채워졌는가. 공백만 있는 것은 안 채운 것이다. */
const hasNote = (st, key) => noteOf(st, key).trim().length > 0;

/**
 * 학생이 적은 숫자 하나. **빈칸은 `null` 이다.**
 * `Number('')` 이 0 이라, 걸러 내지 않으면 안 적은 칸을 0 으로 읽어 없는 오류를 지어낸다.
 */
function num(text) {
  const t = String(text ?? '').replace(/[^\d.]/g, '');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** 산술 되짚기의 허용 폭. 학생은 반올림해서 적는다 — 3.33 을 3.3 으로 적은 것은 틀린 것이 아니다. */
const CALC_TOL = 0.05;

/** 적어 낸 값이 자기가 적은 두 값과 앞뒤가 맞는가. **정답과 대조하지 않는다** (설계도 §3.4). */
function agrees(got, want) {
  if (got === null || want === null || !Number.isFinite(want) || want === 0) return true;
  return Math.abs(got - want) / Math.abs(want) <= CALC_TOL;
}

/**
 * 그 배율에서 학생이 **마지막으로 적은** 값.
 *
 * 같은 배율에서 여러 번 기록할 수 있다. 표에 실을 것은 그중 마지막에 적은 것이다 —
 * 다시 재어 고쳐 적은 값이 그 배율에 대한 학생의 최종 판단이기 때문이다.
 * 기록은 있는데 칸이 비어 있으면 **비워 둔다.** 시뮬레이터가 아는 값으로 메우지 않는다.
 */
function lastWritten(rows, st, keyOf) {
  let out = '';
  for (const r of rows) {
    const v = noteOf(st, keyOf(r.at)).trim();
    if (v) out = v;
  }
  return out;
}

/** 눈금값 기록을 배율 오름차순(같으면 기록순)으로. 100배 줄과 400배 줄이 늘 같은 자리에 온다. */
const byMag = (rows) => [...rows].sort((a, b) => (a.objective - b.objective) || (a.at - b.at));

/** 그 배율의 눈금값·측정 기록만. */
const calibsAt = (st, objective) =>
  st.session.calibrations.filter((c) => c.objective === objective);
const measAt = (st, objective) =>
  st.session.measurements.filter((r) => r.objective === objective && r.target === 'specimen');

/**
 * 결과 표 한 줄에 들어갈 값 — **전부 학생이 적은 글자 그대로**다.
 * 숫자로 바꾸지 않는다. 학생이 「약 3.5」 라고 적었으면 그대로 실린다.
 */
export function resultRow(st, objective) {
  return {
    umPerDiv: lastWritten(calibsAt(st, objective), st, (at) => calibKey(at, 'um')),
    cellDivs: lastWritten(measAt(st, objective), st, (at) => measKey(at, 'divs')),
    cellUm: lastWritten(measAt(st, objective), st, (at) => measKey(at, 'cell')),
  };
}

/** 결과 표에 실리는 배율들. `resultTable.rows` 의 키가 곧 대물렌즈 배율이다. */
export const RESULT_MAGS = Object.keys(N.resultTable.rows).map(Number);

/**
 * 난이도별로 **몇 칸을 파 주는가** (설계도 §3.3).
 *
 *   1단계 — 빈칸 뚫린 식이 통째로 붙고, 식의 자리마다 칸이 있다
 *   2단계 — 칸 이름과 단위만. 식은 없다
 *   3단계 — 마지막 값 한 칸. 무엇을 세어 어떻게 구했는지는 관찰 기록에 스스로 적는다
 *
 * 눈금값에서 3단계가 「한 칸」 한 칸만 남기는 까닭: 무엇을 세어야 하는지 정하는 것이
 * 3단계에서는 학생의 몫이기 때문이다. 칸을 두 개 파 주면 "두 개를 세면 되는구나" 가 답이 된다.
 *
 * 측정에서는 3단계에도 「세포가 차지한 칸 수」를 남긴다. 그건 발견해야 할 방법이 아니라
 * 그냥 눈으로 센 값이고, 이 칸이 없으면 결과 표의 가운데 열이 3단계에서 **늘 비어** 있게 된다 —
 * 「빈칸은 아직 적지 않은 것입니다」 라는 표 아래 안내가 거짓이 되는 자리다.
 */
const calibFields = (level) => (level >= 3 ? ['um'] : ['stage', 'eye', 'um']);
const measFields = (level) => (level >= 3 ? ['divs', 'cell'] : ['divs', 'um', 'cell']);

const CALIB_LABEL = { stage: N.calc.stageDivs, eye: N.calc.eyeDivs, um: N.calc.umPerDiv };
const MEAS_LABEL = { divs: N.calc.cellDivs, um: N.calc.umPerDiv, cell: N.calc.cellUm };

/**
 * 표 한 벌에 실을 것 — **화면과 종이가 여기 한 곳에서 나온다.**
 *
 * 따로 만들면 난이도별 칸 수가 언젠가 어긋나고, 그때 학생은 화면에 없던 칸이 종이에
 * 빈칸으로 실린 보고서를 낸다. 빈칸은 "안 한 일" 로 읽힌다.
 *
 * `values` 는 **학생이 적은 글자 그대로**다. 숫자로 바꾸지 않는다 —
 * 「약 3.5」 라고 적었으면 그대로 실린다.
 * `used` 는 측정 기록에만 있다. 그 값을 어느 눈금값으로 계산했는지이고,
 * 거기 붙는 µm 도 시뮬레이터가 아는 값이 아니라 **학생이 그 눈금 기록에 적은 값**이다.
 *
 * @param {'calibration'|'measurement'} kind
 */
export function recordTable(st, kind) {
  const isCalib = kind === 'calibration';
  const level = st.session.level;
  const fields = isCalib ? calibFields(level) : measFields(level);
  const labels = isCalib ? CALIB_LABEL : MEAS_LABEL;
  const keyOf = isCalib ? calibKey : measKey;
  const source = isCalib ? st.session.calibrations : st.session.measurements;

  const rows = byMag(source).map((r) => {
    const keys = fields.map((f) => keyOf(r.at, f));
    const row = {
      at: r.at,
      objective: r.objective,
      keys,
      values: keys.map((k) => noteOf(st, k)),
      ok: true,
      used: null,
    };
    if (isCalib) {
      const stageDivs = num(noteOf(st, calibKey(r.at, 'stage')));
      const eyeDivs = num(noteOf(st, calibKey(r.at, 'eye')));
      const want = (stageDivs === null || eyeDivs === null || eyeDivs === 0)
        ? null : (stageDivs * STAGE_DIV_UM) / eyeDivs;
      row.ok = agrees(num(noteOf(st, calibKey(r.at, 'um'))), want);
    } else {
      const divs = num(noteOf(st, measKey(r.at, 'divs')));
      const um = num(noteOf(st, measKey(r.at, 'um')));
      row.ok = agrees(num(noteOf(st, measKey(r.at, 'cell'))), (divs === null || um === null) ? null : divs * um);
      const cal = st.session.calibrations.find((c) => c.at === r.calibrationAt) ?? null;
      row.used = cal
        ? UI.zoom.calibrationRow(cal.objective, escapeHtml(noteOf(st, calibKey(cal.at, 'um')).trim())
          || N.resultTable.empty)
        : N.resultTable.empty;
    }
    return row;
  });

  /*
   * 산술 되짚기 문구는 난이도마다 **하나뿐**이고, 1단계 것은 「'한 칸' 은 대물 눈금 칸 수를
   * 접안 눈금 칸 수로 나눈 값입니다」 — 눈금값 행에만 맞는 문장이다. 세포 크기가 안 맞는
   * 학생에게 그대로 띄우면 화면이 묻지도 않은 것을 되짚어 딴소리를 한다.
   * 그 자리에는 두 쪽 다에 맞는 2단계 문장을 쓴다. 되짚어 주지 않고 넘기는 것보다 낫다 —
   * 1단계가 2단계보다 덜 거들어 주는 화면이 되어 버린다.
   * (측정 행에 맞는 1단계 문구가 `strings.js` 에 생기면 그것으로 바꿀 자리다.)
   */
  const mismatch = (isCalib || level !== 1)
    ? (N.calc.mismatch[level] ?? '')
    : N.calc.mismatch[2];

  return { fields, labels, rows, mismatch };
}

/**
 * 6단계 「실제로 본 것」 칸.
 *
 * **시뮬레이터가 계산한 정답을 넣지 않는다.** 학생이 적은 숫자를 그대로 가져다 놓는다 —
 * 예상과 견주려면 같은 종류의 것이어야 한다.
 * 아직 기록조차 없는 것과, 기록은 했는데 안 적은 것을 **다른 말로** 구분한다.
 * 화면과 종이가 같은 문장을 쓰도록 `report.js` 도 이 함수를 부른다.
 */
export function actualFor(st, key) {
  if (key === 'size') {
    const rows = measAt(st, 40);
    if (rows.length === 0) return N.actualNotCaptured;
    const um = lastWritten(rows, st, (at) => measKey(at, 'cell'));
    if (!um) return N.actualNotWritten;
    return `${N.actualSize(escapeHtml(um))} ${N.actualSizeNote}`;
  }
  if (key === 'scale') {
    const rows100 = calibsAt(st, 10);
    const rows400 = calibsAt(st, 40);
    if (rows100.length === 0 && rows400.length === 0) return N.actualNotCaptured;
    const a = lastWritten(rows100, st, (at) => calibKey(at, 'um'));
    const b = lastWritten(rows400, st, (at) => calibKey(at, 'um'));
    if (!a && !b) return N.actualNotWritten;
    return N.actualScale(escapeHtml(a) || N.resultTable.empty, escapeHtml(b) || N.resultTable.empty);
  }
  return N.actualNotWritten;
}

/** 모둠으로 하는 세션인가. 혼자라면 토의·모둠 비교 문항을 아예 내지 않는다. */
export function isGroup(st) {
  return (st.session.mode ?? MODES.GROUP) === MODES.GROUP;
}

/*
 * 쪽마다 "다 했는가". 탭의 ✓ 와 보고서 단추가 **같은 함수**를 본다.
 * 따로 세면 언젠가 어긋나고, 그때 학생은 탭이 전부 ✓ 인데 보고서가 안 나오는 화면을 본다.
 */
/** 예상을 적는 쪽. 「읽었습니다」를 누르기 전에 골라야 하는 유일한 쪽이다. */
/**
 * 그 STEP 의 관찰 기록이 다 적혔는가.
 *
 * ★ **기록칸이 있는 칸만 센다.** 이 실험은 세부 단계 열일곱 중 **일곱**에만 칸을 낸다
 *   (「조작의 결과가 화면에 나타나는 자리만」). 정본은 모든 칸에 기록칸이 있어 전부를
 *   세지만, 여기서 그대로 쓰면 **칸을 준 적도 없는 자리를 「안 적었다」로 세어** 다음
 *   STEP 이 영영 안 열린다. 이 한 줄이 이 저장소에서 갈리는 자리다.
 */
export function stepNotesWritten(st, group) {
  /**
   * ★ **질문 ⓐ 가 붙은 STEP 은 그 답까지 적어야 「다 적은 것」이다.**
   *
   * 질문 ⓐ 는 STEP 3 의 관찰 기록 **아래**에 붙어 있다 (`questionA`). 그런데 관찰 기록만
   * 적으면 그 순간 STEP 3 이 「다 적은 것」이 되어 아코디언이 접히고, **질문 ⓐ 가 접힌
   * 칸 속으로 사라진다.** 학생은 위에서부터 읽어 내려오므로 관찰 기록을 먼저 적고,
   * 그러면 물음을 보기도 전에 물음이 없어진다. 플레이해 보니 그랬다 — 3b 를 적고 손을
   * 떼자 `#note-qa-step3` 이 보이지 않았다 (`isVisible() === false`).
   *
   * 「순서가 곧 논증이다」(설계도 §5.1) — 두 자를 겹쳐 본 **바로 그 순간**에 물어야 하는
   * 물음이라, 6단계에서 다시 만나게 두는 것으로는 부족하다. 그래서 그 답을 적기 전에는
   * STEP 3 을 「다 적은 것」으로 치지 않는다. 막는 것이 아니다 — STEP 3 이 펼쳐진 채로
   * 남아 물음이 눈앞에 있을 뿐이고, 다음 STEP 을 손으로 열 수 있는 길은 그대로다.
   */
  if (group.id === QUESTION_A_STEP && !hasNote(st, 'q.a')) return false;
  if (st.session.level >= 3) return hasNote(st, group.id);
  return group.steps.every((step, i) => !step.note || hasNote(st, substepId(group, i)));
}

/**
 * 질문 ⓐ 가 붙는 STEP. 「방금 두 눈금자를 겹쳐 보았습니다」라는 물음이라 겹치는 조작이
 * 있는 STEP 이어야 한다 — `tests/notebook.steps.test.js` 가 절차와 맞대어 본다.
 * 그리는 곳(`renderStage4`)과 판정하는 곳(`stepNotesWritten`)이 **같은 값**을 봐야 한다.
 */
export const QUESTION_A_STEP = '3';

const PREDICT_STAGE = '3';
const PREDICT_KEYS = N.predictItems.map((it) => it.key);
const predictDone = (st) => PREDICT_KEYS.every((k) => hasNote(st, `predict.${k}`));
const wrapupDone = (st) =>
  ['q.a', 'q2', ...(isGroup(st) ? ['q3'] : [])].every((k) => hasNote(st, k));
const selfEvalDone = (st) => N.selfEvalItems.every(({ key }) => hasNote(st, `selfeval.${key}`));

/**
 * 탐구 노트의 한 쪽이 끝났는가 — 탭에 ✓ 를 붙일지 정한다.
 *
 * 1~4 쪽은 **읽었는가**로 본다(실험대를 여는 조건이 그것이다).
 * 5~7 쪽은 **채워졌는가**로 본다. 같은 ✓ 를 쓰지만 뜻은 하나다 — "이 쪽은 할 일을 마쳤다".
 *
 * 5 쪽은 `resultsDone` — (배율 × 재물대에 올린 것) 네 짝을 다 기록했는가다.
 * 계산 칸이 채워졌는지는 보지 않는다. 그건 학생이 구하는 것이지 완료 조건이 아니다.
 */
export function stageDone(st, id) {
  if (UI.bench.lock.required.includes(id)) return (st.session.readStages ?? []).includes(id);
  if (id === '5') return resultsDone(st);
  if (id === '6') return wrapupDone(st);
  if (id === '7') return selfEvalDone(st);
  return false;
}

/**
 * 보고서를 낼 수 있는가, 아직 무엇이 남았는가.
 *
 * 「보고서 만들기」 를 늘 띄워 두면 첫 화면에서부터 눌러 빈 종이를 뽑는다. 그 종이를 낸
 * 학생은 자기가 무엇을 안 했는지 **종이를 보고서야** 안다.
 * 막는 것이 목적이 아니므로, 감추는 자리에 **무엇이 남았는지**를 대신 적는다.
 *
 * @returns {{ready: boolean, missing: string[]}}
 */
export function reportReadiness(st) {
  const missing = [];
  if (!predictDone(st)) missing.push(N.reportTodo.predict);
  // 배율마다 눈금과 표본을 한 번씩. **왜 넉 장인지는 적지 않는다** — 「배율이 바뀌면
  // 눈금값을 다시 구해야 하므로」 라고 적으면 6단계 문항의 답을 이 목록이 먼저 말해 버린다.
  if (!resultsDone(st)) missing.push(N.reportTodo.captures);
  if (!wrapupDone(st)) missing.push(N.reportTodo.wrapup);
  if (!selfEvalDone(st)) missing.push(N.reportTodo.selfEval);
  return { ready: missing.length === 0, missing };
}

export function createNotebook(root, store, { onOpenZoom, onReport, onReady, group = null, practice = null }) {
  root.innerHTML = `
    <div class="note-head">
      <h1>${N.heading}</h1>
      <div id="report-slot" class="report-slot"></div>
    </div>
    <div id="note-tabs" class="note-tabs" role="tablist"></div>
    <div id="note-panel" class="note-panel"></div>`;

  // 모둠 칸 (T35) — 노트 머리 밑. 기록이 들어오면 노트를 다시 그려 칸마다 카드가 붙게 한다.
  if (group) mountGroupHead(root, { ...group, store, rerender: () => render() });
  // 연습 모드 (T36) — 잘 안 된 것 목록과 「피드백 노트 PDF」. 보고서 단추는 숨는다.
  if (practice) mountPracticeHead(root, practice);

  const reportSlot = root.querySelector('#report-slot');

  /**
   * 4단계에서 학생이 **손으로** 여닫은 STEP. id → 열림 여부.
   *
   * 여기 없는 STEP 은 「지금 할 차례」인 것만 펼쳐진다. 손으로 연 것을 기억해야 하는 까닭은
   * 이 패널이 상태가 바뀔 때마다 `innerHTML` 째로 다시 그려지기 때문이다 — 기억하지 않으면
   * 앞으로 올 STEP 을 펼쳐 놓고 실험대에서 손을 대는 순간 도로 접힌다.
   *
   * **상태(`session`)에 넣지 않는다.** 무엇을 펼쳐 봤는지는 관찰도 기록도 아니고,
   * 되돌리기에 쌓이거나 보고서에 실릴 것이 아니다. 화면이 혼자 기억하면 되는 일이다.
   */
  const manualOpen = new Map();

  /**
   * **한 번이라도 열어 본 STEP.** 다시는 안 잠근다.
   *
   * 이것이 있어서 「접힘은 잠금이 아니다」가 그대로 산다 (AGENTS.md §2.1) —
   * 앞으로 올 STEP 도 눌러서 열리고, 순서를 건너뛰어 실험한 학생은 열어 둔 곳에
   * 계속 적을 수 있다. 잠금은 **아직 한 번도 안 열어 본 앞쪽**에만 걸린다.
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
    return `<p class="stage-text">${N.problem}</p>`;
  }

  /**
   * 안전 안내 — **준비물(2쪽)에 한 번만.**
   *
   * 앞서는 준비물에 하나(`safetyNotes` · 넉 줄), 자기 평가에 또 하나(`valuesItems` · 여섯 줄)
   * 있었다. **같은 말을 두 군데서 다른 모양으로** 하고 있었고, 학생은 어느 것이 진짜인지
   * 알 수 없었다. 선생님이 플레이하다 찾으셨다 —
   * 「어디에는 준비물에, 어디는 결과 정리 쪽에 들어가 있어. **준비물 앞으로 옮겨. UI 도 통일.**」
   *
   * 자리로도 준비물이 맞다. **안전은 하기 전에 읽는 것**이지 다 하고 나서 읽는 것이 아니다.
   * `safetyNotes` 넉 줄은 `valuesItems` 여섯 줄에 전부 들어 있어서 버린 말이 없다.
   *
   * **이 앱은 확인하지 않는다**고 밝히는 줄(`valuesLead`)을 함께 둔다 — 안 밝히면 학생이
   * 어딘가 채점되고 있나 하고 눈치를 본다.
   */
  function safetyNote() {
    return `
      <section class="safety-note">
        <h3>${N.valuesLabel}</h3>
        <p class="values-lead">${emph(N.valuesLead)}</p>
        <ul class="values-list">${
          N.valuesItems.map((t) => `<li class="value-note">${emph(t)}</li>`).join('')}</ul>
      </section>`;
  }

  /**
   * 2 준비물 — 이름만 늘어놓으면 실험대에서 그것을 못 찾는다.
   * **그림 · 이름 · 하는 일** 셋을 나란히 둔다. 그림은 실험대에 놓인 것과 같은 애셋이라
   * 노트에서 본 것을 실험대에서 그대로 알아본다.
   *
   * `role` 은 그대로 넣는다 — 두 눈금자의 대비(단위가 있다/없다)를 `<b>` 로 짚고 있고,
   * 그건 우리가 쓴 문구다. 학생이 쓴 글이 아니므로 막을 것이 없다.
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
      ${safetyNote()}`;
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
   *
   * 바나나랩은 슬라이드 세 장을 돌았다. 여기서 묻는 것은 **두 가지**다 (설계도 §4.1) —
   * 크기 감각(`size`)과 한 칸의 길이(`scale`). 문항마다 보기도 예시 문구도 다르다.
   */
  function renderStage3(st) {
    const level = st.session.level;
    // 무엇을 할지 모르는 채로 예상하라고 하면 뜬금없다.
    // 할 일은 밝히고, 무엇이 보일지는 밝히지 않는다 — 그게 지금 묻고 있는 것이다.
    const lead = `<div class="predict-lead">${
      N.predictLeadIn.map((p) => `<p>${emph(p)}</p>`).join('')
    }</div>`;
    return lead + N.predictItems.map(({ key, label, note }) => {
      const noteKey = `predict.${key}`;
      const val = st.session.notes[noteKey] ?? '';
      const whyKey = `predict.why.${key}`;
      const choices = level >= 3 ? '' : `
        <div class="predict-choices" role="group" aria-label="${N.predictLabel}">
          ${N.predictOptions[key].map((opt) => `
            <button type="button" class="predict-opt${val === opt ? ' predict-opt--chosen' : ''}"
              data-choice="${noteKey}" data-value="${escapeHtml(opt)}"
              aria-pressed="${val === opt}">${opt}</button>`).join('')}
        </div>`;
      const free = level === 1 ? '' : `
        <label class="notes-label" for="note-${level === 2 ? 'why' : 'predict'}-${key}">${
          level === 2 ? N.predictWhyLabel : N.predictLabel
        }</label>
        <textarea data-note="${level === 2 ? whyKey : noteKey}"
          id="note-${level === 2 ? 'why' : 'predict'}-${key}"
          placeholder="${escapeHtml((level === 2 ? N.predictWhyPlaceholder : N.predictFreePlaceholder)[key] ?? '')}"
          >${escapeHtml(st.session.notes[level === 2 ? whyKey : noteKey] ?? '')}</textarea>`;
      return `
        <div class="predict-block">
          <h3>${label}</h3>
          ${note ? `<p class="stage-empty">${note}</p>` : ''}
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
  /* 4 탐구 과정 — STEP 1~6. 한 번에 한 STEP 씩 따라간다.               */
  /* ---------------------------------------------------------------- */

  /**
   * 세부 단계 하나. **하나만 펼쳐 놓는 쪽에서 쓰는 조각이다.**
   *
   * `pointing` 은 「이 STEP 이 지금 할 차례인가」다. 끝난 STEP 이나 앞으로 올 STEP 을
   * 학생이 눌러서 펼쳤을 때 거기서도 「다음에 이걸 하세요」 를 외치면, 화면이 두 곳에서
   * 서로 다른 다음을 가리키게 된다.
   */
  function substepHtml(st, group, step, i, { level, nextIdx, pointing }) {
    const id = substepId(group, i);
    const done = stepDone(st, group.id, i);
    const isNext = pointing && i === nextIdx;

    // 3단계는 짚지 않는다. 1·2단계만 다음 칸을 표시하고, **어디서 무엇을 하는지**까지
    // 말해 주는 것은 1단계뿐이다 (`stepWhere`).
    const hi = isNext && level <= 2 ? ' substep--next' : '';
    let hint = '';
    if (isNext && level <= 2) {
      /*
       * ★ **실험대가 잠겨 있으면 실험대로 보내지 않는다.**
       *   그때는 물건을 눌러도 아무 일이 없고, 여는 단추는 이 쪽 맨 밑에 있다
       *   (재어 보니 화면 720 에 y 1258). 시킨 대로 했는데 아무 일도 안 일어나면
       *   학생은 앱이 고장 난 줄 안다. 막힌 이유와 빠져나갈 길을 그 자리에서 말한다.
       */
      const what = benchLocked(st) ? N.stepBenchLocked
        : done ? N.stepWriteNow
          : (level === 1 ? (N.stepWhere[id] ?? N.stepNotYet) : N.stepNotYet);
      hint = `<p class="substep-hint">${what}</p>`;
    }

    // 관찰 기록 칸은 **조작의 결과가 시야에 나타나는 칸에만** 낸다 (`UI.protocol` 머리말).
    // 준비 동작에까지 칸을 내면 빈칸이 줄줄이 남아 안 한 일처럼 읽히고,
    // 학생은 적을 것이 없는 칸을 채우느라 진짜 관찰을 대충 적는다.
    const box = step.note ? `
      <label class="notes-label" for="note-${id}">${N.notesLabel}</label>
      <textarea data-note="${id}" id="note-${id}"
        placeholder="${escapeHtml(notePlaceholder(level, step))}">${escapeHtml(noteOf(st, id))}</textarea>` : '';

    return `
      <li class="substep${hi}" data-done="${done}" data-has-note="${Boolean(step.note)}">
        <div class="substep-title">
          <span class="substep-mark" aria-hidden="true">${done ? '✓' : '·'}</span>
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
   * 여섯 STEP 을 한꺼번에 펼쳐 놓으면 학생이 그것을 「읽을 글」로 받는다. 주욱 읽고 내려간
   * 다음 실험대로 가서 무엇부터 할지 몰라 멈춘다. 지금 할 것 하나만 펼치면
   * 노트가 글이 아니라 **따라가는 길**이 된다.
   *
   * 「지금 STEP」 은 `groupDone` 이 거짓인 **첫 STEP** 이다. 상태에서 나오므로 따로 저장하지
   * 않는다 — 실험대에서 한 일이 그대로 노트를 넘긴다.
   *
   * **접힘은 잠금이 아니다** (AGENTS.md §2.1). `<details>` 라 앞으로 올 STEP 도 눌러서 열리고,
   * 순서를 건너뛰어 실험한 학생은 거기에 적으면 된다. 눌리지 않게 죽여 두는 속성은
   * 쓰지 않는다 — `tests/ui.contract.test.js` 가 잡기도 하지만, 애초에 막을 이유가 없다.
   *
   * 앞으로 올 STEP 을 **지우지 않는 것**도 같은 값이다. 몇 칸짜리 여정인지 보여야
   * 학생이 자기가 어디쯤인지 안다.
   */
  function renderStage4(st) {
    const level = st.session.level;
    const groups = UI.protocol;
    const groupsDone = groups.map((g) => groupDone(st, g.id));
    const unwritten = groups.map((g) => !stepNotesWritten(st, g));
    const doneCount = groupsDone.filter(Boolean).length;

    /**
     * 「지금 할 차례」는 **조작을 마쳤고 적기까지 한** 첫 STEP 의 다음이다.
     *
     * 조작만 보고 정하면 이렇게 된다 — STEP 1 의 조작을 끝내는 순간 1 이 접히는데,
     * 적지 않았으니 STEP 2 는 잠겨 있다. **아무것도 펼쳐지지 않은 화면**이 남고
     * 학생은 벽을 본다. 안 적었으면 적을 자리가 계속 펼쳐져 있어야 한다.
     */
    const nowIdx = groupsDone.findIndex((d, i) => !(d && !unwritten[i]));
    const panels = stepPanelStates(groups, groupsDone.map((d, i) => d && !unwritten[i]), manualOpen);

    const stepsHtml = groups.map((group, gi) => {
      /**
       * 앞 STEP 의 관찰 기록이 비어 있으면 이 STEP 은 **열리지 않는다.**
       *
       * 셋을 다 지나야 잠근다 — ① 지금 STEP 보다 **뒤**이고, ② 지금 STEP 의 관찰 기록이
       * **비어** 있고, ③ 그 STEP 을 **한 번도 열어 본 적이 없을** 것.
       *
       * ③ 덕분에 「접힘은 잠금이 아니다」와 부딪히지 않는다 — 한 번 열어 본 것은 다시
       * 안 잠기고, 순서를 건너뛴 학생은 열어 둔 곳에 계속 적을 수 있다.
       *
       * `<details>` 를 죽이는 대신 **아예 다른 껍데기**로 그린다 — 열리는 척하다가
       * 안 열리는 것이 가장 나쁘다. `disabled` 도 `pointer-events` 도 쓰지 않는다.
       * 제목은 그대로 남긴다. 몇 칸짜리 여정인지는 계속 보여야 한다.
       */
      const lockedBy = stepLockedBy(groups, gi, nowIdx, unwritten, everOpened);
      if (lockedBy) {
        return `
        <div class="note-step note-step--locked" data-step-group="${group.id}"
          data-state="locked" data-done="false">
          <div class="step-summary">
            <h3 class="step-summary-title">STEP ${group.id} · ${group.title}</h3>
            <span class="step-open-hint">${N.stepLockedHint}</span>
          </div>
          <p class="step-locked-why">${N.stepLockedWhy(lockedBy)}</p>
        </div>`;
      }

      const isDone = groupsDone[gi];
      const isNow = gi === nowIdx;
      const { state, open } = panels[gi];

      /**
       * ★ **실제로 펼쳐졌을 때만** 「열어 본 것」으로 친다.
       *
       * 앞서는 「잠기지 않은 STEP」을 전부 담았다. 그러면 자물쇠가 **한 번에 죽는다** —
       * 조작은 안 하고 지금 STEP 의 관찰 기록만 먼저 채우면 잠글 조건이 사라지고,
       * 그 한 번의 렌더에서 **여섯이 통째로 「열어 본 것」으로 쌓인다.** 그 뒤로는
       * 무엇을 해도 영영 안 잠긴다. 화면은 멀쩡하고 검사도 초록불이었다 —
       * 재어 보니 잠긴 칸 5 → **0**, 기록을 도로 지워도 0 이었다.
       *
       * 담을 것은 **학생이 실제로 볼 수 있었던 것**뿐이다. 접힌 채로 지나간 STEP 은
       * 열어 본 적이 없다. (osmosis 세션이 찾아 허브를 거쳐 넘겨 주었다)
       */
      if (open) everOpened.add(group.id);

      let body;
      if (level >= 3) {
        // 3단계 — 짚어 주지 않는다. STEP 제목과 목표 한 줄뿐이다.
        body = `
          <label class="notes-label" for="note-${group.id}">${N.goalOnlyLabel(group.title)}</label>
          <textarea data-note="${group.id}" id="note-${group.id}">${escapeHtml(noteOf(st, group.id))}</textarea>`;
      } else {
        // 앞에서부터 **아직 끝나지 않은 첫 칸**을 짚는다. 했는데 적을 칸(`note`)이 비어
        // 있으면 그 칸이 다음이다 — "했는데 안 적은 칸" 을 먼저 찾으면 아직 손도 안 댄
        // 첫 칸을 건너뛰고 뒤엣것을 짚는 일이 생긴다.
        const nextIdx = group.steps.findIndex((step, i) =>
          !stepDone(st, group.id, i) || (step.note && !hasNote(st, substepId(group, i))));
        const items = group.steps
          .map((step, i) => substepHtml(st, group, step, i, { level, nextIdx, pointing: isNow }))
          .join('');
        body = `<ul class="substep-list">${items}</ul>`;
      }

      // 접힌 STEP 에도 「눌러서 열린다」 를 적어 둔다. 말하지 않으면 잠긴 것으로 읽힌다.
      const openHint = isNow ? '' :
        `<span class="step-open-hint">${isDone ? N.stepReopenHint : N.stepPeekHint}</span>`;

      return `
        <details class="note-step" data-step-group="${group.id}"
          data-state="${state}" data-done="${isDone}"${open ? ' open' : ''}>
          <summary class="step-summary">
            <!-- 제목은 접혀도 h3 로 남는다. 다른 쪽이 전부 h3 라, 여기만 span 이면
                 제목만 훑어 내려가는 학생에게 4단계가 통째로 사라진다. -->
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
   * 질문 ⓐ — STEP 3 직후에 묻는다. **순서가 곧 논증이다** (설계도 §5.1).
   *
   * 두 눈금자를 겹쳐 보고 「접안 눈금에는 단위가 없다」는 것을 몸으로 겪은 **바로 그 순간**이어야
   * 답이 나온다. 6단계까지 미루면 그때 본 것을 기억으로 더듬는 문제가 되고,
   * "왜 두 자를 함께 쓰는가" 가 눈앞의 관찰이 아니라 지식 회상 문제가 된다.
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
        <label class="notes-label" for="note-qa-step3">${N.questionA.label}</label>
        <textarea data-note="q.a" id="note-qa-step3">${escapeHtml(val)}</textarea>
        ${g ? `<p class="grade-line" id="grade-qa" data-grade="${g.status}">${g.message ?? N.gradeOk}</p>` : ''}
      </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* 5 결과 — 눈금값 표 · 측정 표 · 기록한 시야                          */
  /* ---------------------------------------------------------------- */

  /**
   * 결과 표 — **이 표가 이 실험의 결론이다.**
   *
   * 왼쪽 열(한 칸의 길이)이 두 줄에서 달라야 한다는 것이 결론인데, 세로로 나란히 놓지 않으면
   * 학생 눈에 그게 안 들어온다. 5단계 맨 위와 6단계 q2 **바로 위** 두 곳에 같은 표를 놓는다 —
   * 견주라고 묻는 자리에 견줄 것이 없으면 그 물음은 기억력 문제가 된다.
   *
   * **전부 학생이 적은 값이다.** 시뮬레이터는 한 칸도 채우지 않는다.
   * 아직 안 적은 칸은 비워 둔다 — 채워 주면 그 순간 답을 말한 것이 된다.
   */
  function resultTable(st) {
    const T = N.resultTable;
    const rows = RESULT_MAGS.map((objective) => {
      const v = resultRow(st, objective);
      const cell = (s) => `<td>${s ? escapeHtml(s) : T.empty}</td>`;
      return `<tr>
        <th scope="row">${T.rows[objective]}</th>
        ${cell(v.umPerDiv)}${cell(v.cellDivs)}${cell(v.cellUm)}
      </tr>`;
    }).join('');
    return `
      <section class="grade-block">
        <h3>${T.heading}</h3>
        <table class="materials-table result-table">
          <thead><tr>${T.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="stage-empty">${T.note}</p>
      </section>`;
  }

  /**
   * 계산 칸 하나. **화면이 답을 채우지 않는다** — `value` 는 학생이 적은 것뿐이다.
   * 표 안에 들어가므로 좁게 잡는다.
   */
  function calcCell(st, key, domId, label) {
    return `<td><input type="text" inputmode="decimal" size="5"
      data-note="${key}" id="${domId}" aria-label="${escapeHtml(label)}"
      value="${escapeHtml(noteOf(st, key))}"></td>`;
  }

  /**
   * 기록 표 하나 — 눈금값이든 측정이든 모양이 같다.
   *
   * 행마다 그 값을 **어느 배율에서 구했는지**가 맨 앞에 찍히고, 배율 오름차순이라
   * 100배 줄 바로 아래에 400배 줄이 온다. 두 줄의 「한 칸」 이 달라지는 것이 이 실험의 답이고,
   * 화면은 그 사실에 대해 아무 말도 하지 않는다.
   *
   * 측정 행에는 **어느 눈금값으로 계산했는지**가 한 줄 더 붙는다. 400배에서 센 칸 수에
   * 100배에서 구한 눈금값을 쓴 학생은 「400배」 줄에 「대물렌즈 10배에서 구한 값」 이라고
   * 적힌 것을 본다. **틀렸다고 말하지 않는다.** 두 사실을 나란히 놓을 뿐이고,
   * 그 두 줄을 견주는 것이 6단계 2번 문항이다.
   *
   * 산술 되짚기(`mismatch`)도 **정답과 대조하지 않는다** — 학생이 적은 세 값의 앞뒤가
   * 맞는지만 본다. 세는 것은 관찰이고, 관찰을 정답과 대조하는 순간 학생은 세는 대신
   * 맞히려 든다. 잘못 센 것은 기록한 시야에 그대로 남아 선생님이 짚어 줄 수 있다 (설계도 §3.4).
   */
  function recordTableHtml(st, kind, heading, formula) {
    const { fields, labels, rows, mismatch } = recordTable(st, kind);
    if (rows.length === 0) return '';
    const span = fields.length + 2;
    const delAttr = kind === 'calibration' ? 'data-del-calib' : 'data-del-meas';
    const idKind = kind === 'calibration' ? 'calib' : 'meas';
    const body = rows.map((row, i) => `
      <tr data-record="${idKind}-${row.at}">
        <th scope="row">${totalMag(row.objective)}</th>
        ${fields.map((f, k) => calcCell(st, row.keys[k], `note-${idKind}-${row.at}-${f}`, labels[f])).join('')}
        <td><button type="button" class="capture-del" ${delAttr}="${row.at}"
          aria-label="${N.captureDeleteLabel(i + 1)}">${UI.zoom.recordDelete}</button></td>
      </tr>
      ${row.used ? `<tr><td colspan="${span}" class="meas-used">${row.used}</td></tr>` : ''}
      ${row.ok || !mismatch ? ''
        : `<tr><td colspan="${span}"><p class="grade-line" data-grade="more">${mismatch}</p></td></tr>`}`).join('');
    return `
      <section class="grade-block">
        <h3>${heading}</h3>
        ${st.session.level === 1 ? `<p class="stage-text">${formula}</p>` : ''}
        <table class="materials-table result-table">
          <thead><tr><th></th>${fields.map((f) => `<th>${labels[f]}</th>`).join('')}<th></th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>`;
  }

  /**
   * 기록한 시야.
   *
   * **눈금이 없는 시야는 이 실험의 증거가 아니다.** 세포만 찍힌 그림으로는 「20칸」 이라는
   * 학생의 주장을 아무도 확인할 수 없다. 그래서 카드 제목에 재물대에 올린 것을 함께 적는다 —
   * 넉 장 중 둘은 눈금 그림, 둘은 세포 그림인데 배율만 적혀 있으면 구분되지 않는다.
   */
  function captureCards(st) {
    const caps = st.session.captures;
    if (caps.length === 0) return '';
    return `
      <section class="grade-block">
        <p class="stage-empty">${N.captureListHint}</p>
        <p class="stage-empty">${N.magFixedNote}</p>
        <div class="capture-list">${caps.map((c, i) => {
      // 저장 키는 배열 인덱스가 아니라 기록에 붙은 번호(`at`)다.
      // 가운데 기록을 지우면 인덱스가 밀려, 아래 카드의 배율 답이 통째로 한 칸씩 어긋난다.
      const at = c.at ?? i;
      const key = `mag.${at}`;
      const domId = `note-mag-${at}`; // id 에는 '.' 을 안 쓴다 — CSS 선택자에서 클래스로 오해된다
      const saved = st.session.notes[key] ?? '';
      const check = saved !== '' ? gradeMagnification(saved, c.objective) : null;
      const eyepiece = c.eyepiece ?? EYEPIECE;
      return `
        <div class="capture-card">
          <div class="capture-head">
            <h3>${UI.stageShort[c.on] ?? ''} · ${UI.units.mag(c.objective)}</h3>
            <button type="button" class="capture-del" data-del="${at}"
              aria-label="${N.captureDeleteLabel(i + 1)}">${N.captureDelete}</button>
          </div>
          <!-- 기록한 시야를 그대로 되살린다. 기록이 fieldParams 한 벌을 통째로 담고 있으므로
               그때 본 것과 같은 그림이 나온다. idPrefix 를 카드마다 달리 주지 않으면
               모든 카드가 첫 카드의 흐림·잘라내기를 쓴다 — 에러 없이 조용히 틀린다.
               번호(at)로 붙인다 — 지우고 나서도 남은 카드의 접두사가 바뀌지 않는다. -->
          <div class="capture-fov">${renderFOV(c, { idPrefix: `cap${at}-` })}</div>
          <dl class="capture-readout">
            <!-- 곱할 두 수를 **둘 다** 보여 주고, 곱한 답은 알려 주지 않는다.
                 그건 아래 칸이 묻는 것이다. -->
            <div><dt>${N.eyepieceLabel}</dt><dd>${UI.units.mag(eyepiece)}</dd></div>
            <div><dt>${N.objectiveLabel}</dt><dd>${UI.units.mag(c.objective)}</dd></div>
            <div><dt>${N.onStageLabel}</dt><dd>${UI.stageItems[c.on] ?? ''}</dd></div>
            <div><dt>${UI.observability.label}</dt><dd>${captureScore(c).score}</dd></div>
          </dl>
          <label class="notes-label" for="${domId}">${N.magInput}</label>
          <input type="text" inputmode="numeric" placeholder="${N.magPlaceholder}"
            data-note="${key}" id="${domId}" value="${escapeHtml(saved)}">
          ${check ? `<p class="grade-line" data-grade="${check.status}">${check.message ?? ''}</p>` : ''}
        </div>`;
    }).join('')}</div>
      </section>`;
  }

  function renderStage5(st) {
    const { calibrations, measurements, captures } = st.session;
    if (calibrations.length === 0 && measurements.length === 0 && captures.length === 0) {
      return `<p class="stage-empty">${N.noCaptures}</p>`;
    }
    return resultsTodo(st)
      + resultTable(st)
      + recordTableHtml(st, 'calibration', UI.report.resultParts.calibration, N.calc.formulaScale)
      + recordTableHtml(st, 'measurement', UI.report.resultParts.measurement, N.calc.formulaCell)
      + captureCards(st);
  }

  /**
   * 아직 안 찍은 시야를 적어 둔다.
   *
   * 「다 적었는데 왜 체크가 안 뜨지?」 — 실제로 나온 물음이다. 표를 채우는 것과
   * 시야를 기록하는 것은 다른 일인데 화면이 그 차이를 말하지 않았다.
   * 조건을 낮추지 않고 **보이게** 한다. 탭의 ✓ 와 같은 함수를 보므로 어긋날 수 없다.
   */
  function resultsTodo(st) {
    const left = resultsMissing(st);
    if (left.length === 0) {
      return `<p class="results-todo results-todo--done">${N.resultsDoneMark}</p>`;
    }
    const items = left.map(({ objective, on }) =>
      `<li>${N.resultsShot(objective * EYEPIECE, UI.stageShort[on])}</li>`).join('');
    return `<div class="results-todo">
      <b>${N.resultsTodoHeading}</b>
      <ul>${items}</ul>
      <p class="results-todo-hint">${N.resultsTodoHint}</p>
    </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* 6 정리 — 서술형 문항 + 첨삭, 세부 단계 기록·예상 재복습, 성찰 문항   */
  /* ---------------------------------------------------------------- */

  function renderStepNotesRecap(st) {
    const rows = Object.entries(st.session.notes)
      .filter(([k, v]) => isStepNoteKey(k) && v && v.trim())
      .map(([k, v]) => `<li><b>${stepNoteLabel(k)}</b> — ${escapeHtml(v)}</li>`);
    if (rows.length === 0) return '';
    return `<section><h3>${N.stepNotesHeading}</h3><ul class="step-notes-recap">${rows.join('')}</ul></section>`;
  }

  function renderPredictCompare(st) {
    const rows = N.predictItems.map(({ key, label }) => `
      <div class="predict-compare-row">
        <h4>${label}</h4>
        <dl class="compare-pair">
          <dt>${N.predictRecapLabel}</dt>
          <dd>${escapeHtml(st.session.notes[`predict.${key}`] || N.predictNone)}</dd>
          <dt>${N.actualLabel}</dt>
          <dd>${actualFor(st, key)}</dd>
        </dl>
      </div>`).join('');
    return `<section><h3>${N.predictHeading}</h3>${rows}</section>`;
  }

  /**
   * 흐린 채로 남은 기록에 붙는 성찰 문항.
   *
   * 관찰 가능성 점수가 아니라 **초점**으로 고른다. 문항이 「눈금 가장자리가 번져 보였습니다」
   * 라고 말하므로, 정렬이나 대비 때문에 점수가 낮은 기록에까지 붙이면 화면이 있지도 않은
   * 현상을 지어내 말하게 된다. 판정 기준은 `CAPTURE` 가 「흐린 채로 기록됐습니다」 를
   * 띄울 때 쓰는 것과 같다.
   *
   * **맞히는 것이 목적이 아니다.** 고른 뒤에 그 값을 바꿔 다시 관찰할 수 있게 한다.
   */
  function blurryCaptures(st) {
    const byKind = new Map();
    for (const c of st.session.captures) {
      if ((c.focusErr ?? 0) > focusTolerance(c.objective, 'micrometer')) {
        byKind.set(`${c.objective}:${c.on}`, c);   // 같은 짝은 최근 것으로 덮어씀
      }
    }
    return [...byKind.values()];
  }

  function renderReflect(st) {
    const blurry = blurryCaptures(st);
    if (blurry.length === 0) return '';
    const items = blurry.map((c) => {
      const key = `reflect.${c.objective}.${c.on}`;
      const chosen = st.session.notes[key];
      const what = `${totalMag(c.objective)} · ${UI.stageShort[c.on] ?? ''}`;
      const options = Object.keys(UI.observability.worst).map((k) => `
        <button type="button" class="reflect-opt${chosen === k ? ' reflect-opt--chosen' : ''}"
          data-reflect="${key}" data-value="${k}">${UI.observability.worst[k]}</button>`).join('');
      const retry = chosen
        ? `<button type="button" class="reflect-retry" data-retry="${c.on}">${N.reflectRetry}</button>`
        : '';
      return `
        <div class="reflect-item" data-on="${c.on}">
          <p>${N.reflectQuestion(what)}</p>
          <div class="reflect-options" role="group">${options}</div>
          ${retry}
        </div>`;
    }).join('');
    return `<section id="reflect">${items}</section>`;
  }

  /**
   * 첨삭 줄. **빈칸에는 띄우지 않는다.**
   *
   * 아무것도 안 쓴 칸에 "이어서 써 보세요" 가 먼저 뜨면, 학생은 쓰기도 전에 부족하다는
   * 말부터 듣는다. 쓸 마음이 꺾이는 자리다.
   * 다만 **답할 수 없는 문항**(아직 다른 모둠의 결과가 없는 3번)은 왜 못 쓰는지 미리 알려 준다 —
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
        <!-- 질문 ⓐ 는 STEP 3 직후에 이미 물었다 (순서가 곧 논증이다).
             여기서 다시 묻지 않고, 그때 쓴 답을 그대로 이어 쓰게 한다.
             같은 notes['q.a'] 를 쓰므로 어느 쪽에서 고쳐도 한 벌이다. -->
        <label class="notes-label" for="note-qa">${N.qaContinueLabel}</label>
        <p class="stage-empty">${qa.trim() ? N.qaCarried : N.qaNotYet}</p>
        <textarea data-note="q.a" id="note-qa">${escapeHtml(qa)}</textarea>
        ${gradeLine('qa', 'qa', qa)}
      </section>
      <!-- 견주라고 묻는 자리에 견줄 것을 놓는다. 두 배율의 숫자를 다시 찾아 5단계로
           돌아가게 하면, 이 문항은 관찰을 견주는 문제가 아니라 기억력 문제가 된다. -->
      ${resultTable(st)}
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
  /* 7 자기 평가 — session.violations 를 그대로 보여 준다. 감점하지 않는다. */
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
        <label class="notes-label" for="note-feedback-${key}">${label}</label>
        <textarea data-note="feedback.${key}" id="note-feedback-${key}"
          placeholder="${escapeHtml(eg)}">${escapeHtml(st.session.notes[`feedback.${key}`] ?? '')}</textarea>
      </div>`).join('');

    /*
     * 안전 안내는 **여기 없다. 준비물(2쪽)에 있다.**
     *
     * 앞서는 준비물에 하나(`safetyNotes`), 자기 평가에 또 하나(`valuesItems`) —
     * **같은 말을 두 군데서 다른 모양으로** 하고 있었다. 선생님이 플레이하다 찾으셨다:
     * 「어디에는 준비물에, 어디는 결과 정리 쪽에 들어가 있어. **준비물 앞으로 옮겨.**」
     *
     * 자리로도 준비물이 맞다 — 안전은 **하기 전에** 읽는 것이지 다 하고 나서 읽는 것이
     * 아니다. 둘을 합쳤고 `safetyNotes` 는 `valuesItems` 에 다 들어 있어 버린 말이 없다.
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
    // STEP 을 손으로 여닫은 것을 기억한다. `innerHTML` 로 다시 그려도 그대로 남아야
    // 앞으로 올 STEP 을 펼쳐 놓고 실험대에서 손을 댈 수 있다.
    //
    // **`toggle` 이 아니라 summary 의 `click` 을 듣는다.** `<details open>` 을 innerHTML 로
    // 꽂으면 브라우저가 삽입만으로도 `toggle` 을 한 번 쏜다 — 그러면 「지금 할 차례라서
    // 펼쳐진 것」이 「학생이 손으로 펼친 것」으로 기록되고, 그 STEP 은 끝난 뒤에도
    // 영영 접히지 않는다. 실제로 그랬다. click 은 사람이 눌렀을 때만 온다
    // (summary 는 포커스를 받으므로 Enter·Space 도 click 으로 온다 — 키보드도 같이 산다).
    panelEl.querySelectorAll('details[data-step-group] > summary').forEach((el) => {
      el.addEventListener('click', () => {
        // 기본 동작이 아직 일어나기 전이라 `open` 은 누르기 **전**의 값이다.
        const id = el.parentElement.dataset.stepGroup;
        const willOpen = !el.parentElement.open;
        manualOpen.set(id, willOpen);
        /**
         * ★ **여기서도 「열어 본 것」으로 담는다.**
         *
         * 그리기 쪽에서만 담으면 손으로 연 것이 다시 잠긴다 — 누르는 순간에는 다시
         * 그리지 않고 브라우저가 `<details>` 를 열 뿐이라, 다음 렌더의 **잠금 판정이
         * 먼저 돌아** 그 자리를 잠가 버린다. 그러면 학생이 열어 둔 칸이 눈앞에서 사라진다.
         * 재어 보니 손으로 연 STEP 6 이 조작 한 번에 `locked` 로 돌아갔다.
         */
        if (willOpen) everOpened.add(id);
      });
    });
    panelEl.querySelectorAll('[data-note]').forEach((el) => {
      el.addEventListener('change', () => {
        savingNote = true;
        store.dispatch('SAVE_NOTE', { step: el.dataset.note, text: el.value });
        savingNote = false;
        // 브라우저가 포커스를 다 옮긴 **뒤에** 한 번 그린다. 미룬 것을 버리지 않는다 —
        // 버리면 화면이 상태보다 낡은 채로 남는다.
        setTimeout(() => {
          if (pendingRender && !pressing) { pendingRender = false; render(); }
        }, 0);
      });
      // 치는 **동안** 관문을 제자리에서 고친다 — 다 적었는데 잠긴 화면을 안 보게.
      el.addEventListener('input', () => { patchGate(); patchLocked(); });
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
    // 기록을 지우는 세 갈래. 관찰을 무르는 것이 아니라 **무엇을 근거로 삼을지 고르는 일**이다.
    panelEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_CAPTURE', { at: Number(btn.dataset.del) });
      });
    });
    panelEl.querySelectorAll('[data-del-calib]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_CALIBRATION', { at: Number(btn.dataset.delCalib) });
      });
    });
    panelEl.querySelectorAll('[data-del-meas]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.dispatch('DELETE_MEASUREMENT', { at: Number(btn.dataset.delMeas) });
      });
    });
    panelEl.querySelector('#mark-read')?.addEventListener('click', (e) => {
      /**
       * **표시만 하고 안 막으면 표시가 거짓말이 된다.** `aria-disabled` 는 브라우저가
       * 막아 주지 않으므로(그게 `disabled` 와 다른 점이다) 누르는 쪽에서 한 번 더 본다.
       *
       * ★ **표시가 아니라 상태를 본다.** `aria-disabled` 는 **마지막으로 그린 순간의
       *   값**이라, 방금 칸을 채우고 곧장 누른 학생에게는 **낡은 값**이다. 그것으로
       *   막으면 다 채웠는데도 안 넘어간다 — 표시는 낡고 상태는 안 낡는다.
       *   (허브를 거쳐 넘어온 지적)
       */
      if (activeStage === PREDICT_STAGE && !predictDone(store.getState())) return;
      store.dispatch('MARK_READ', { stage: activeStage });

      /**
       * 누르면 **다음 쪽으로 넘어간다.** 그 자리에 ✓ 만 남기고 학생이 탭을 직접 찾아
       * 누르게 하면, 읽는 흐름이 매 쪽 끊긴다.
       *
       * ★ **자리로 고른다. 「아직 안 읽은 쪽」으로 고르면 안 된다.**
       *   차례대로 읽는 동안에는 둘이 똑같아서 **절대 안 갈린다.** 2·3쪽을 먼저 읽어 둔
       *   학생이 1쪽에서 누르면 그때 갈린다 — 자리로 고르면 2쪽(맞음), 안 읽은 쪽으로
       *   고르면 4쪽으로 **건너뛴다.** (허브를 거쳐 fermentation 세션이 두 번 물렸다)
       *
       * 마지막 읽기 쪽(4. 탐구 과정)에서는 **넘기지 않고 그 자리에 남는다.**
       * 거기가 실험하는 동안 보는 쪽이고, 그 순간 실험대가 열린다 — 다음 할 일은
       * 다음 쪽을 읽는 것이 아니라 실험대로 가는 것이다.
       */
      const order = UI.bench.lock.required;
      const next = order[order.indexOf(activeStage) + 1];
      if (next) {
        activeStage = next;
        render();
        // 앞서는 본문 첫 제목으로 데려갔다. **탭 줄로 데려간다** — 어디로 왔는지가 보여야 한다.
        revealNotePage(root);
      }
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
     * **예상을 안 골랐으면 아직 읽었다고 할 수 없다.**
     *
     * 예상 쪽은 읽고 넘기는 쪽이 아니라 **자기 생각을 적어 두는 쪽**이다. 비워 둔 채
     * 넘어가면 나중에 견줄 것이 없어져서, 6단계의 「예상과 견주기」가 빈칸이 된다.
     *
     * ★ **채점이 아니다.** 무엇을 골랐는지는 보지 않는다 — 고르기만 하면 통과다.
     *
     * ★ **`disabled` 를 쓰지 않는다.** 그것은 단추에서 **포커스를 빼앗아**, 키보드나
     *   낭독기로 오는 학생이 그 단추에 닿을 수조차 없게 만든다 — 그러면 **왜 못 누르는지를
     *   들을 길이 사라진다.** 못 누르게 하면서 이유를 말해 주려면 단추는 살아 있어야 한다.
     *   `aria-disabled` 로 표시하고, 이유를 `aria-describedby` 로 묶고,
     *   누르는 쪽에서 한 번 더 막는다.
     */
    const blocked = activeStage === PREDICT_STAGE && !predictDone(st);
    /*
     * 까닭 글은 **늘 그려 두고 숨긴다.** 막힌 동안에만 만들면 제자리에서 켜고 끌 자리가
     * 없어서, 잠금을 풀 때마다 판을 다시 그려야 한다 — 그러면 치던 칸이 갈려 나간다.
     * (`patchGate()` 를 보라)
     */
    return `
      <div class="read-mark">
        <p>${N.readLeadIn(UI.bench.lock.required.at(-1))}</p>
        <button type="button" id="mark-read" class="read-confirm"
          ${blocked ? 'aria-disabled="true" aria-describedby="read-blocked-why"' : ''}
        >${N.readConfirm}</button>
        <p class="read-blocked" id="read-blocked-why"${blocked ? '' : ' hidden'}>${needPredictWhy(st)}</p>
      </div>`;
  }

  /**
   * **치던 글은 다시 그려도 살아남아야 한다.**
   *
   * 이 앱은 `change`(칸을 빠져나갈 때)에만 저장한다. 그래서 글을 치는 **도중에**
   * 상태가 바뀌어 패널이 통째로 다시 그려지면, 아직 저장 안 된 글자가 **통째로 날아가고
   * 포커스가 `<body>` 로 떨어진다.** 재어 보니 「앞토막」을 치고 조작이 하나 들어오자
   * 남은 것이 빈 문자열이었고, 그 뒤에 친 「뒤토막」은 아무 데도 안 들어갔다.
   *
   * 종이에는 **문장 앞토막**만 실리거나 아예 안 실린다. 학생은 자기가 쓴 것이
   * 사라진 줄도 모른다 — 화면이 조용하기 때문이다.
   *
   * 그래서 다시 그리기 전에 **치던 값과 커서 자리**를 들고 있다가 되돌려 준다.
   * (germination 세션이 자기 저장소에서 찾아 허브를 거쳐 넘겨 주었다)
   */
  /**
   * ★ **누르는 도중에는 다시 그리지 않는다.**
   *
   * 이 앱은 `change`(칸을 빠져나갈 때)에만 저장한다. 그래서 학생이 칸에 적고 **곧장**
   * 무언가를 누르면 이런 차례가 된다:
   *
   *     누름(pointerdown) → 칸에서 포커스 빠짐 → change → 저장 → **다시 그리기**
   *     → 누르려던 그 요소가 사라짐 → click 이 완성되지 못함
   *
   * 재어 보니 이 저장소에서는 두 가지로 나타났다:
   *   · 3단계 예상 쪽에서 마지막 칸에 적고 「이 쪽을 읽었습니다」를 누르면
   *     **두 번을 눌러도 안 넘어갔다** — 학생이 그 쪽에 갇힌다.
   *   · 첫 칸에 적고 둘째 칸을 누르면 **둘째 칸에 친 글자가 통째로 사라졌다**
   *     (누르는 사이에 그 칸이 갈려 나갔다).
   *
   * 그래서 누르는 동안에는 그리기를 **미뤄 두었다가** 손을 뗀 뒤에 한 번 그린다.
   * 미룬 그리기를 버리지 않는 것이 중요하다 — 버리면 화면이 상태보다 낡은 채로 남는다.
   * (germination·chromatography 세션이 찾아 허브를 거쳐 넘겨 주었다)
   */
  let pressing = false;
  let pendingRender = false;
  /**
   * ★ **Tab 으로 옮기는 길에는 `pointerdown` 이 없다.**
   *
   * 마우스로 칸을 옮기면 `pointerdown` 이 먼저 와서 그리기를 막아 준다. 그런데 **Tab 에는
   * 그 누름이 없고**, `change` 는 브라우저가 포커스를 옮기는 **도중에**(활성 요소가 아직
   * `body` 인 동안) 온다 — 그래서 「지금 글칸에 손이 있는가」도 거짓이다.
   * 두 관문이 다 열린 채 판이 갈리고, 옮겨 가려던 칸이 그 사이에 사라진다.
   *
   * 재어 보니 3단계에서 Tab 으로만 치면 이렇게 됐다:
   *     화면 ["예상0", ""] · 손 (칸 밖)     ← 둘째 칸부터는 **한 자도 안 들어간다**
   *
   * 키보드로만 오는 학생은 첫 칸 말고는 아무것도 못 적는다.
   * `pressing` 이나 활성 요소로 막으면 **마우스 경로에서만** 산다.
   * (fermentation 세션이 정본에서 찾아 허브를 거쳐 넘겨 주었다)
   */
  let savingNote = false;
  panelEl.addEventListener('pointerdown', (e) => {
    pressing = true;
    /*
     * ★ **누르기 직전에, 치던 글을 먼저 저장한다.**
     *
     * 마지막 관찰 기록을 적고 **곧장** 다음 STEP 을 누르면 그 글이 아직 상태에 없어
     * 자물쇠가 안 풀린다. 게다가 **잠긴 STEP 은 `<div>`** 라 누름이 아무것도 펼치지
     * 않는다 — 저장만 해 주면 `<details>` 로 바뀌기만 하고 **닫힌 채**로 남아서
     * 학생에게는 첫 누름이 **안 먹은 것**으로 보인다. 재어 보니 그랬다:
     *
     *     누르기 전  DIV / locked
     *     한 번 눌러  DETAILS / later / 열림 **false**   ← 아무 일도 안 일어난 것처럼 보인다
     *     두 번 눌러  DETAILS / later / 열림 true
     *
     * 그래서 저장과 함께 **열 자리도 여기서 잡아 둔다.** 다음 그리기가 그 자리를 편다.
     * (chromatography 세션이 찾아 허브를 거쳐 넘겨 주었다)
     */
    const live = document.activeElement;
    if (live?.matches?.('[data-note]') && live !== e.target) {
      store.dispatch('SAVE_NOTE', { step: live.dataset.note, text: live.value });
      const locked = e.target.closest?.('.note-step--locked');
      if (locked) manualOpen.set(locked.dataset.stepGroup, true);
    }
  });
  window.addEventListener('pointerup', () => {
    // 한 박자 뒤에 푼다 — `click` 은 `pointerup` **뒤에** 오므로, 여기서 바로 그리면
    // 그 click 이 다시 허공을 짚는다.
    setTimeout(() => {
      pressing = false;
      if (pendingRender) { pendingRender = false; render(); }
    }, 0);
  });

  /**
   * ★ **다 적어 놓고도 잠긴 채로 보이는 자리를 없앤다.**
   *
   * 칸의 글은 `change` 로 저장된다 — 즉 **손이 칸을 떠나야** 상태에 들어간다.
   * 그래서 예상을 다 적어 놓고도 단추가 잠긴 채 「예상을 먼저 골라 주세요」라고 말한다.
   * 재어 보니 두 칸을 다 채우고 손을 둔 채로 `aria-disabled="true"` 였다.
   *
   * 누를 때 상태로 판정하는 것(`#mark-read` 처리기)은 **누름만** 살린다. 눌러 보면
   * 넘어가지만 **그 전에 학생은 이미 「다 적었는데 안 열리는 화면」을 본다.**
   * 칸을 한 번 빠져나가야 풀린다는 것을 학생이 알 길이 없다.
   *
   * 치는 동안 판을 다시 그리면 치던 칸이 갈려 나가므로, **판은 그대로 두고 단추의
   * 잠금과 까닭 글자만 제자리에서** 고친다. 아직 저장 안 된 값은 칸에서 직접 읽어 얹는다.
   * (fermentation 세션이 찾아 허브를 거쳐 넘겨 주었다)
   */
  function patchGate() {
    const btn = panelEl.querySelector('#mark-read');
    if (!btn) return;
    const st = store.getState();
    const typed = {};
    panelEl.querySelectorAll('[data-note]').forEach((el) => { typed[el.dataset.note] = el.value; });
    const merged = { ...st, session: { ...st.session, notes: { ...st.session.notes, ...typed } } };
    const blocked = activeStage === PREDICT_STAGE && !predictDone(merged);
    if (blocked) {
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-describedby', 'read-blocked-why');
    } else {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('aria-describedby');
    }
    const why = panelEl.querySelector('#read-blocked-why');
    if (why) why.hidden = !blocked;
  }

  /**
   * ★ **잠긴 STEP 의 말도 갈아 준다.**
   *
   * 다 적고 손을 둔 채로 보면 STEP 2 가 이렇게 말했다:
   *
   *     「앞 STEP 을 먼저 적으세요」 · 「STEP 1 의 관찰 기록을 적어야 여기가 열립니다.」
   *
   * **방금 적었는데.** 학생은 자기가 쓴 것이 안 세어진 줄 안다.
   *
   * 여는 것은 누르는 순간에 일어나므로(`<div>` 를 `<details>` 로 바꾸는 것은 다시 그리기다)
   * 여기서는 **말만** 바꾼다. 치는 동안 판을 다시 그리면 치던 칸이 갈려 나가기 때문이다.
   * (chromatography 세션이 짚어 허브를 거쳐 넘겨 주었다)
   */
  function patchLocked() {
    const st = store.getState();
    const typed = {};
    panelEl.querySelectorAll('[data-note]').forEach((el) => { typed[el.dataset.note] = el.value; });
    const merged = { ...st, session: { ...st.session, notes: { ...st.session.notes, ...typed } } };

    const groups = UI.protocol;
    const groupsDone = groups.map((g) => groupDone(merged, g.id));
    const unwritten = groups.map((g) => !stepNotesWritten(merged, g));
    const nowIdx = groupsDone.findIndex((d, i) => !(d && !unwritten[i]));

    panelEl.querySelectorAll('.note-step--locked').forEach((el) => {
      const gi = groups.findIndex((g) => g.id === el.dataset.stepGroup);
      if (gi < 0) return;
      const lockedBy = stepLockedBy(groups, gi, nowIdx, unwritten, everOpened);
      const hint = el.querySelector('.step-open-hint');
      const whyEl = el.querySelector('.step-locked-why');
      if (lockedBy) {
        if (hint) hint.textContent = N.stepLockedHint;
        if (whyEl) { whyEl.textContent = N.stepLockedWhy(lockedBy); whyEl.hidden = false; }
      } else {
        // 이제 열 수 있다. 껍데기는 그대로지만 **누르면 펼쳐진다** — 그 말을 해 준다.
        if (hint) hint.textContent = N.stepPeekHint;
        if (whyEl) whyEl.hidden = true;
      }
    });
  }

  /**
   * 막는 말은 **그 화면에 있는 조작**을 가리켜야 한다.
   *
   * 3단계 예상 쪽은 보기를 안 그리고 **적는 칸**만 낸다(`renderStage3`). 그런데 문구가
   * 하나뿐이라 거기서도 「골라 주세요」라고 했다 — 고를 것이 없는데.
   * **막는 것보다 틀린 곳을 가리키며 막는 것이 나쁘다.**
   *
   * 난이도로 가르지 않고 **그 화면에 보기를 그렸는지**로 가른다. 난이도로 가르면
   * `renderStage3` 의 갈래가 바뀔 때 여기가 조용히 어긋난다 — 같은 사실을 두 곳에서
   * 따로 세는 셈이다.
   */
  function needPredictWhy(st) {
    return predictHasChoices(st) ? N.readNeedPredict : N.readNeedPredictWrite;
  }

  /** 지금 예상 쪽이 **보기를 그리는가**. 그리는 쪽과 같은 조건을 쓴다. */
  function predictHasChoices(st) {
    return (st.session.level ?? 1) < 3;
  }

  /**
   * 실험대가 잠겨 있는가. **실험대와 같은 판정을 쓴다** (`bench.js` 의 `lockState`) —
   * 두 곳에서 따로 세면 언젠가 한쪽만 바뀌어 화면이 서로 다른 말을 한다.
   */
  function benchLocked(st) {
    const read = st.session.readStages ?? [];
    return UI.bench.lock.required.some((id) => !read.includes(id));
  }

  function render() {
    if (pressing || savingNote) { pendingRender = true; return; }
    const st = store.getState();
    tabsEl.querySelectorAll('.note-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.stage === activeStage));
      // 끝낸 쪽에는 표시를 남긴다. 어디가 남았는지 탭만 보고 알 수 있어야 한다 —
      // 앞 네 쪽은 실험대를 여는 조건이고, 뒤 세 쪽은 보고서를 내는 조건이다.
      tab.dataset.read = String(stageDone(st, tab.dataset.stage));
    });

    // 다시 그리기 **전에** 치고 있던 것을 들고 있는다.
    const live = panelEl.contains(document.activeElement) ? document.activeElement : null;
    const typing = live && 'value' in live && live.dataset.note
      ? {
        key: live.dataset.note, value: live.value, at: live.selectionStart, to: live.selectionEnd,
        // **치고 있는 칸이 든 STEP 은 접으면 안 된다.** 아래 주석을 보라.
        group: live.closest('details[data-step-group]')?.dataset.stepGroup ?? null,
      }
      : null;

    panelEl.innerHTML = STAGE_RENDERERS[activeStage](st) + readFooter(st);
    bindPanel();

    if (typing) {
      /**
       * ★ **글을 치고 있는 STEP 은 접지 않는다.**
       *
       * 실험대에서 한 조작이 그 STEP 을 끝내면 아코디언이 그 자리를 접는데, 그때 학생이
       * 바로 그 STEP 의 기록칸에 글을 치고 있으면 **치던 칸이 눈앞에서 접혀 사라진다.**
       * 접힌 칸은 `display:none` 이라 `focus()` 도 조용히 실패해서, 그다음 글자는
       * **아무 데도 안 들어간다.** 재어 보니 「앞토막」까지만 남고 「뒤토막」은 사라졌다.
       *
       * 이것은 「손으로 연 것이 이긴다」와 같은 자리다 — **지금 손이 가 있는 곳**이 이긴다.
       * `manualOpen` 에 적어 두므로 그 뒤로도 열린 채 남는다.
       */
      if (typing.group) {
        manualOpen.set(typing.group, true);
        const host = panelEl.querySelector(`details[data-step-group="${typing.group}"]`);
        if (host) host.open = true;
      }
      const back = panelEl.querySelector(`[data-note="${typing.key}"]`);
      // 저장된 값보다 **치던 값이 이긴다.** 아직 저장 안 된 글자가 그 안에 들어 있다.
      if (back && 'value' in back) {
        back.value = typing.value;
        back.focus();
        // 커서 자리까지 돌려준다. 맨 끝으로 튀면 치던 자리를 손으로 다시 찾아야 한다.
        if (typing.at != null && back.setSelectionRange) {
          try { back.setSelectionRange(typing.at, typing.to); } catch { /* range 를 안 받는 칸 */ }
        }
      }
    }
    // 모둠장 화면이면 칸마다 모둠원 기록 카드 + 「초안 채우기」 (T35)
    if (group) decorateNoteFields(panelEl, { ...group, store });
    renderReportSlot(st);
  }

  store.subscribe(render);
  render();
}
