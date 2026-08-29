/**
 * 규칙 엔진.
 *
 * 이 프로젝트의 핵심 원칙: **강제하지 말고 결과로 답한다.**
 * 조작을 막는 대신 상태를 바꾸고, 무슨 일이 일어났는지 말한다.
 *
 * 결과 종류는 셋뿐이다:
 *   'ok'       뜻대로 됐다. 무엇이 바뀌었는지만 말한다. (말이 없을 수도 있다)
 *   'happened' 진행은 됐는데 뜻대로는 아니다. 무슨 일이 일어났는지 말한다.
 *   'blocked'  진행되지 않았다. **아래 BLOCKING_REASONS 두 가지에만 허용된다.**
 *
 * ── 이 실험에서 절대 하지 않는 말 ──────────────────────────────────
 * `SET_OBJECTIVE` 는 눈금값에 대해 **아무 말도 하지 않는다.** 「배율을 바꿨으니 한 칸의
 * 길이를 다시 구하세요」 한 문장이 이 실험의 학습 목표 전부를 대신 말해 버린다.
 * 학생은 세 갈래로 스스로 도달한다 — 시야가 보여 주고, 기록에 배율 도장이 찍히고,
 * 두 배율에서 잰 값이 나란히 놓인다 (`tasks/DESIGN-rules.md` §6.3).
 *
 * 새 'blocked' 를 추가하려면 사람에게 먼저 물어볼 것. AGENTS.md §2.1 참조.
 */

import {
  ITEM_IDS, PICK_KINDS, HISTORY_LIMIT, PAN_LIMIT,
  initialItem, angleGap, centerErr, focusError, readability, fieldParams,
} from './state.js';
import { focusTolerance, EYEPIECE, STAGE_DIV_UM } from './optics.js';
import { pickAt, calibrationFrom } from './scale.js';

export { PAN_LIMIT };

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시야를 둘러보는 것과 정리 점검은 학생이 "한" 조작이 아니다.
 * 바나나랩에 있던 `TICK` 은 이 실험에 없다 — 반응이 없으므로 시간이 상태를 바꾸지 않는다.
 * 덕분에 1초마다 도는 액션이 되돌리기 기록을 밀어내던 문제도 함께 사라졌다.
 */
export const TRANSIENT_ACTIONS = new Set([
  'MOVE_STAGE', 'MARK_READ',
  // 찍은 점을 지우는 것은 조작을 무르는 것이 아니라 **무엇을 근거로 삼을지 고르는 일**이다.
  // 여기 넣지 않으면 3단계의 한 번뿐인 되돌리기가 오타 지우기에 쓰인다.
  'CLEAR_PICKS',
]);

/** 연속 조작 — 슬라이더·다이얼을 끄는 동안 수십 번 디스패치된다. 앞선 것과 같으면 합친다. */
export const CONTINUOUS_ACTIONS = new Set([
  'FINE_FOCUS', 'COARSE_FOCUS', 'SET_DIAPHRAGM', 'SAVE_NOTE', 'ROTATE_EYEPIECE',
]);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음
  BROKEN: 'broken',           // 기구가 파손돼 재제작이 필요함
};

/**
 * 뜻대로 됐다. 말은 **선택**이다.
 *
 * 조작이 성공했을 때 화면이 아무 말도 안 하면 학생은 방금 누른 것이 먹혔는지를
 * 그림에서 혼자 읽어내야 한다. 다만 시야를 둘러보거나 다이얼을 돌리는 것처럼
 * 학생이 "했다" 고 느끼지 않는 일에는 붙이지 않는다 — 화면이 쉬지 않고 떠든다.
 */
const ok = (state, message = null, tag = null) => ({ state, outcome: 'ok', message, tag });
const happened = (state, message, tag) => ({ state, outcome: 'happened', message, tag: tag ?? null });
const blocked = (state, message, reason) => {
  if (!Object.values(BLOCKING_REASONS).includes(reason)) {
    throw new Error(`허용되지 않은 차단 사유: ${reason}. AGENTS.md §2.1 을 읽으세요.`);
  }
  return { state, outcome: 'blocked', message, reason };
};

/** 받침 조사. 마지막 글자에 받침이 있으면 '을', 없으면 '를'. 한글이 아니면 '을'. */
const eul = (w) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '을';
  return (c - 0xac00) % 28 ? '을' : '를';
};

/** 화면 문구에 쓰는 이름. `strings.js` 와 같은 표기를 쓴다. */
const ITEM_NAME = { stageMic: '대물 마이크로미터', specimen: '공변세포 표본' };
/** 제자리. 금 간 것을 새것으로 바꾸는 곳이기도 하다 (`PLACE_ON_STAGE` 의 막힘 문장). */
const BOX_NAME = { stageMic: '대물 마이크로미터 보관함', specimen: '표본 상자' };

/** 목적격 조사를 붙인 이름. '표본를' 이 되지 않게 한다. */
const item = (id) => `${ITEM_NAME[id]}${eul(ITEM_NAME[id])}`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const withScope = (state, patch) => ({ ...state, microscope: { ...state.microscope, ...patch } });
const withEye = (state, patch) => ({ ...state, eyepiece: { ...state.eyepiece, ...patch } });
const withItem = (state, id, patch) => ({
  ...state, items: { ...state.items, [id]: { ...state.items[id], ...patch } },
});
const withSession = (state, patch) => ({ ...state, session: { ...state.session, ...patch } });

/** 되돌리기용 스냅숏. 기록 자신은 담지 않는다 — 담으면 기하급수로 커진다. */
function snapshot(state) {
  return { ...state, session: { ...state.session, history: [] } };
}

/** 다음 기록 번호. **배열 길이를 쓰지 않는다** — 중간 것을 지우면 번호가 겹친다. */
const nextAt = (rows) => rows.reduce((n, r) => Math.max(n, (r.at ?? -1) + 1), 0);

/**
 * 정리 동작 하나. **했다고 기록**하고, 이미 붙은 위반이 있으면 **지운다.**
 * 벌이 아니라 기록이므로 늦게 해도 지워진다.
 */
/**
 * 제자리에 넣는다. **점수도 기록도 아니다.**
 *
 * 앞서는 이것이 「안전 규칙 준수」를 지켜보는 장치였다 — 했는지 안 했는지를 세어
 * 자기 평가에 ✓/✗ 로 적었다. 그것을 걷어냈다.
 *
 * ★ **가상 실험에서 「정리했는가」를 따지면 화면 속 단추를 눌렀다는 사실을 평가하게 된다.**
 *   그건 안전 습관이 아니라 조작 순서 외우기다. 진짜 현미경은 교실에서 두 손으로 들고,
 *   진짜 유리는 교실에서 깨진다. 앱은 **가르쳐 주기만** 한다
 *   (`UI.notebook.valuesItems` 의 가만히 적힌 안내).
 *
 * 조작 자체는 남는다 — 원판에는 통이라는 **제자리가 실제로 있고**, 넣고 꺼내는 길이
 * 막히면 되돌아갈 수 없는 자리가 생긴다. 다만 그것을 **세지 않는다.**
 */
/* ------------------------------------------------------------------ */

export const ACTIONS = {

  /* ── 접안렌즈 — 재물대 위가 아니다 ─────────────────────────────── */

  /**
   * M-01 접안 마이크로미터를 접안렌즈에 끼운다.
   * 뒤집어 끼워도 막지 않는다. **값은 안 틀린다** — 칸 간격이 같기 때문이다.
   * 숫자가 좌우로 뒤집혀 읽기 불편할 뿐이고, 그래서 점수를 깎지도 않는다.
   */
  INSERT_OCULAR(state, { flipped = false }) {
    // **어긋남은 접안렌즈 쪽에 생긴다.**
    // 리클은 접안렌즈 통 안에 손으로 끼우는 것이라 매번 조금씩 돌아간 채로 들어간다.
    // 대물 마이크로미터는 재물대 클립이 잡아 주므로 반듯하게 놓인다.
    // 그래서 학생이 맞추는 것은 **접안렌즈를 돌리는 일**이고, 그 조작이 절차에 있다.
    // 처음에는 반대로 만들었다 — 대물 마이크로미터가 기울고 접안 마이크로미터가 반듯했다. 그러면 접안렌즈를
    // 왜 돌려야 하는지 설명이 안 되고, 학생 눈에는 재물대를 돌려야 할 것처럼 보인다.
    // **반드시 어긋난다.** 시드에 따라 0° 가 나오면 그 학생은 맞출 것이 없어서
    // 절차의 한 단계를 건너뛰게 되고, 왜 그 단계가 있는지도 모른 채 지나간다.
    // 6~22° 사이로만 준다 — 눈으로 어긋난 것이 보이고, 슬라이더로 몇 번에 맞출 수 있는 폭이다.
    const seed = state.session.seed;
    const jitter = ((seed % 2 ? 1 : -1) * (6 + (seed % 17)));
    const next = withEye(state, { micrometer: true, flipped, angleDeg: jitter, stowed: false });
    if (flipped) {
      return happened(next,
        '접안 마이크로미터를 뒤집어 끼웠습니다. 눈금 숫자가 좌우로 뒤집혀 보입니다.',
        'micrometer-flipped');
    }
    return ok(next, '접안 마이크로미터를 접안렌즈에 끼웠습니다. 시야에 눈금이 겹쳐 보입니다.',
      'micrometer-inserted');
  },

  /** M-02 빼낸다. 뒤집어 끼운 것을 고치는 길이기도 하다. */
  REMOVE_OCULAR(state) {
    if (!state.eyepiece.micrometer) return ok(state, '접안렌즈에 끼워진 것이 없습니다.');
    // 빼낸 것은 **통이 아니라 손 위**에 있다. 통에 넣는 것은 `PUT_AWAY_OCULAR` 뿐이다 —
    // 여기서 통에 넣어 버리면 뒤집어 끼운 것을 고치려던 학생이 통을 다시 열어야 한다.
    return ok(withEye(state, { micrometer: false, flipped: false, stowed: false }),
      '접안 마이크로미터를 빼냈습니다. 시야에서 눈금이 사라집니다.', 'micrometer-removed');
  },

  /**
   * M-04 접안렌즈를 돌린다. **연속값이다.**
   * 말이 없다 — 돌리는 동안 토스트가 수십 번 뜨면 화면이 쉬지 않고 떠든다.
   * 무슨 일이 일어나는지는 시야가 말한다.
   */
  ROTATE_EYEPIECE(state, { deltaDeg = 0 }) {
    const raw = (state.eyepiece.angleDeg ?? 0) + deltaDeg;
    return ok(withEye(state, { angleDeg: ((raw % 360) + 360) % 360 }));
  },

  /* ── 재물대 ────────────────────────────────────────────────────── */

  /**
   * M-05·M-06·M-29 재물대에 올린다.
   *
   * 순서를 강제하지 않는다 — 표본을 먼저 올려도 막지 않는다. 견줄 눈금자가 없으니
   * 칸 수만 세어질 뿐이고, 그 사실이 시야에 그대로 보인다.
   * 클립에는 한 장만 들어가므로 이미 있던 것은 **바꿔 내린다.**
   */
  PLACE_ON_STAGE(state, { item: itemId }) {
    if (!ITEM_IDS.includes(itemId)) return happened(state, '재물대에 올릴 것을 알 수 없습니다.');
    const it = state.items[itemId];
    if (it.cracked) {
      // **어디로 가야 하는지까지 말한다.**
      // 「새것을 꺼내세요」 만으로는 어디서 꺼내는지 알 길이 없다. 실제로 여기서 막힌 채
      // 같은 곳에 계속 끌어다 놓다가 「안 되네」 하고 손을 뗀 일이 있었다.
      // 막힘은 이 실험에 둘뿐이니, 그 둘만큼은 빠져나갈 길을 문장에 담는다.
      return blocked(state,
        `금이 간 ${item(itemId)} 다시 올릴 수 없습니다. ${BOX_NAME[itemId]}에 끌어다 놓으면 새것이 나옵니다.`,
        BLOCKING_REASONS.BROKEN);
    }
    const before = state.microscope.stage;
    if (before === itemId) return ok(state, `${ITEM_NAME[itemId]}는 이미 재물대에 있습니다.`);

    // 재물대 클립이 잡아 주므로 **반듯하게** 놓인다. 어긋남은 접안렌즈 쪽에 있다
    // (`INSERT_OCULAR` 참조) — 그래야 학생이 돌릴 것이 접안렌즈가 된다.
    let next = withItem(state, itemId, { angleDeg: 0 });
    next = withScope(next, { stage: itemId, panX: 0, panY: 0 });

    if (!state.eyepiece.micrometer) {
      return happened(next,
        `${item(itemId)} 올렸습니다. 접안렌즈에 눈금자가 없어 견줄 것이 없습니다.`,
        'no-eyepiece-scale');
    }
    if (before) {
      return ok(next, `${item(before)} 내리고 ${item(itemId)} 올렸습니다.`,
        'swapped');
    }
    const extra = itemId === 'stageMic' ? ` 한 칸이 ${STAGE_DIV_UM} µm 입니다.` : '';
    return ok(next, `${item(itemId)} 재물대에 올렸습니다.${extra}`, 'placed');
  },

  /** M-07 재물대에서 내린다. 대가 없는 되돌아가기 길이다. */
  REMOVE_FROM_STAGE(state) {
    const on = state.microscope.stage;
    if (!on) return ok(state);
    return ok(withScope(state, { stage: null }),
      `${item(on)} 재물대에서 내렸습니다.`, 'removed');
  },

  /**
   * M-08 재물대를 옮긴다. 「중앙 정렬」이 여기서 일어난다.
   *
   * 확인 단계로 두면 누르기 게임이 된다. 대신 밀려날수록 시야 안에 남는 눈금 구간이
   * 짧아지고(`spanDivs`), 구간이 짧으면 같은 손끝 오차가 눈금값에서 차지하는 비율이 커진다.
   * 막히지 않는다. **덜 정확해질 뿐이다.**
   */
  MOVE_STAGE(state, { dx = 0, dy = 0 }) {
    const m = state.microscope;
    return ok(withScope(state, {
      panX: clamp((m.panX ?? 0) + dx, -PAN_LIMIT, PAN_LIMIT),
      panY: clamp((m.panY ?? 0) + dy, -PAN_LIMIT, PAN_LIMIT),
    }));
  },

  /* ── 현미경 ────────────────────────────────────────────────────── */

  /**
   * M-09·M-10 대물렌즈를 바꾼다.
   *
   * **눈금값에 대해 아무 말도 하지 않는다.** 이것이 이 실험에서 가장 중요한 침묵이다.
   * 재물대 위 눈금 간격만 4배로 벌어지고 접안 눈금은 한 치도 안 변한다 —
   * 그 비대칭을 학생이 눈으로 본다.
   */
  SET_OBJECTIVE(state, { objective }) {
    const m = state.microscope;
    const next = withScope(state, { objective });
    if (objective > 10 && !m.lowMagFocused) {
      return happened(next,
        '저배율에서 초점을 맞추지 않고 올렸습니다. 초점 맞는 범위가 매우 좁습니다.',
        'skipped-low-mag');
    }
    return ok(next,
      `대물렌즈를 ${objective}배로 바꿨습니다. 접안렌즈 ${EYEPIECE}배와 곱해 총 ${objective * EYEPIECE}배입니다.`,
      'objective');
  },

  /**
   * M-11·M-28 조동나사.
   *
   * 고배율에서 돌리면 대물렌즈가 재물대 위 유리를 누른다. 교과서가 경고하는 그 일이다.
   * **조작 자체는 막지 않는다** — 돌아가고, 깨지고, 깨진 것이 재물대에서 내려온다.
   * 막히는 것은 그다음, 금 간 것을 **다시 올릴 때**다 (`PLACE_ON_STAGE`).
   */
  COARSE_FOCUS(state, { delta = 0 }) {
    const m = state.microscope;
    const coarse = clamp((m.coarse ?? 0) + delta, -1, 1);
    if (m.objective > 10 && m.stage) {
      const id = m.stage;
      let next = withItem(state, id, { cracked: true });
      next = withScope(next, { coarse, stage: null });
      return happened(next,
        `고배율에서 조동나사를 돌려 대물렌즈가 ${item(id)} 눌렀습니다. 유리에 금이 갔습니다.`,
        'cracked');
    }
    const err = Math.abs(coarse + (m.fine ?? 0));
    return ok(withScope(state, {
      coarse,
      lowMagFocused: m.lowMagFocused || (m.objective <= 10 && err <= focusTolerance(m.objective)),
    }));
  },

  /** M-12 미동나사. 언제나 안전하다. 저배율에서 맞으면 `lowMagFocused` 가 선다. */
  FINE_FOCUS(state, { delta = 0 }) {
    const m = state.microscope;
    const fine = clamp((m.fine ?? 0) + delta, -0.2, 0.2);
    const err = Math.abs((m.coarse ?? 0) + fine);
    return ok(withScope(state, {
      fine,
      lowMagFocused: m.lowMagFocused || (m.objective <= 10 && err <= focusTolerance(m.objective)),
    }));
  },

  /**
   * M-13 조리개. **양쪽 다 나빠진다.**
   * 어두우면 눈금선이 배경에 묻히고, 너무 밝으면 가는 선이 하얗게 날아간다.
   * 바나나랩은 밝을수록 좋았지만 여기서 보는 것은 밝기가 아니라 **선의 경계**다.
   */
  SET_DIAPHRAGM(state, { value }) {
    const next = withScope(state, { diaphragm: clamp(value, 0, 1) });
    const b = next.microscope.diaphragm;
    if (b < 0.3) return happened(next, '시야가 어두워 눈금선이 배경에 묻힙니다.', 'dark');
    if (b > 0.85) return happened(next, '너무 밝아 가는 눈금선이 하얗게 날아갑니다.', 'washed-out');
    return ok(next);
  },

  /* ── 세기 — 이 실험의 몸통 ──────────────────────────────────────── */

  /**
   * M-14·M-26 눈금이 겹친 지점을 찍는다.
   *
   * **스냅하지 않는다.** 겹치지 않은 자리를 찍어도 막지 않고, 그 어긋남이 `gap` 으로 남아
   * 눈금값에 그대로 섞인다. 학생은 자기 손끝의 오차를 「틀렸습니다」가 아니라
   * **같은 배율에서 두 번 구한 값의 차이**로 만난다.
   */
  PICK_SCALE(state, { x = 0 }) {
    if (!state.eyepiece.micrometer || !state.microscope.stage) {
      return happened(state, '견줄 눈금이 없습니다. 접안 마이크로미터와 눈금자를 먼저 갖추세요.', 'no-scale');
    }
    const p = { kind: PICK_KINDS.SCALE, ...pickAt(state, x) };
    const picks = [...state.picks, p].slice(-2);
    const next = { ...state, picks };
    const msg = `접안 ${p.eyeDiv}번 선과 대물 ${p.stageDiv}번 선을 잡았습니다. (${picks.length}/2)`;
    if (p.gap > 0.25) {
      return happened(next, `${msg} 두 선이 ${p.gap.toFixed(2)}칸 어긋난 자리입니다.`, 'loose-pick');
    }
    return ok(next, msg, 'picked');
  },

  /** M-18 세포의 양 끝을 찍는다. 세포가 아닌 것을 재도 막지 않는다. */
  PICK_CELL(state, { x = 0 }) {
    if (!state.eyepiece.micrometer) {
      return happened(state, '접안 눈금이 없어 길이를 칸으로 옮길 수 없습니다.', 'no-scale');
    }
    const p = { kind: PICK_KINDS.CELL, ...pickAt(state, x) };
    const picks = [...state.picks, p].slice(-2);
    const next = { ...state, picks };
    if (picks.length < 2) return ok(next, '한쪽 끝을 잡았습니다. (1/2)', 'cell-picked');
    const divs = Math.abs(picks[1].eyeDiv - picks[0].eyeDiv);
    if (state.microscope.stage !== 'specimen') {
      return happened(next, `${divs}칸을 잡았습니다. 다만 재물대에 있는 것은 표본이 아닙니다.`,
        'measured-not-specimen');
    }
    return ok(next, `세포의 양 끝을 잡았습니다. 접안 눈금 ${divs}칸입니다.`, 'cell-picked');
  },

  /** M-15 찍은 것을 지운다. **되돌리기를 쓰지 않는다.** */
  CLEAR_PICKS(state) {
    if (state.picks.length === 0) return ok(state);
    return ok({ ...state, picks: [] }, '찍은 지점을 지웠습니다.', 'picks-cleared');
  },

  /**
   * M-16·M-17 접안 눈금 한 칸의 길이를 기록한다.
   *
   * **언제나 기록된다.** 잘 안 맞은 채 구한 값도 기록되고, 거기에 배율·어긋남·정렬이
   * 함께 붙는다. 그 값이 나중에 자기 정밀도를 스스로 보게 하는 재료가 된다.
   */
  RECORD_CALIBRATION(state) {
    const scalePicks = state.picks.filter((p) => p.kind === PICK_KINDS.SCALE);
    if (scalePicks.length < 2) {
      return happened(state, '겹친 지점 두 곳을 먼저 찍으세요.', 'need-two-picks');
    }
    const c = calibrationFrom(scalePicks);
    const m = state.microscope;
    const row = {
      at: nextAt(state.session.calibrations),
      objective: m.objective,
      eyeDivs: c.eyeDivs,
      stageDivs: c.stageDivs,
      umPerDiv: c.umPerDiv,
      gap: c.gap,
      angleGap: angleGap(state),
      focusErr: focusError(m),
      centerErr: centerErr(m),
    };
    const next = {
      ...withSession(state, { calibrations: [...state.session.calibrations, row] }),
      picks: [],
    };
    if (c.umPerDiv === null) {
      return happened(next,
        `두 지점 사이에 대물 눈금이 ${c.stageDivs}칸입니다. 한 칸의 길이를 구할 수 없어 빈칸으로 남겼습니다.`,
        'zero-span');
    }
    return ok(next,
      `접안 눈금 ${c.eyeDivs}칸과 대물 눈금 ${c.stageDivs}칸이 같았습니다. `
      + `한 칸의 길이를 ${m.objective * EYEPIECE}배 기준으로 기록했습니다.`,
      'calibrated');
  },

  /**
   * M-19·M-20·M-27 세포 크기를 기록한다.
   *
   * **어느 눈금값이든 고를 수 있다.** 다른 배율에서 구한 것을 골라도 막지 않는다 —
   * 두 배율을 **사실로 나란히 말할 뿐**, 틀렸다고 하지 않는다. 그 문장 하나가
   * 이 실험의 학습 목표를 대신 말해 버리기 때문이다.
   */
  RECORD_MEASUREMENT(state, { calibrationAt = null }) {
    const cellPicks = state.picks.filter((p) => p.kind === PICK_KINDS.CELL);
    if (cellPicks.length < 2) {
      return happened(state, '세포의 양 끝을 먼저 찍으세요.', 'need-two-picks');
    }
    const cellDivs = Math.abs(cellPicks[1].eyeDiv - cellPicks[0].eyeDiv);
    const cal = state.session.calibrations.find((c) => c.at === calibrationAt) ?? null;
    const m = state.microscope;
    const row = {
      at: nextAt(state.session.measurements),
      objective: m.objective,
      target: m.stage,
      cellDivs,
      calibrationAt: cal?.at ?? null,
      lengthUm: cal?.umPerDiv != null ? cellDivs * cal.umPerDiv : null,
    };
    const next = {
      ...withSession(state, { measurements: [...state.session.measurements, row] }),
      picks: [],
    };

    if (!cal) {
      return happened(next,
        `접안 눈금 ${cellDivs}칸으로 기록했습니다. 아직 한 칸의 길이를 모르므로 µm 는 빈칸입니다.`,
        'no-calibration');
    }
    if (cal.objective !== m.objective) {
      // 두 사실을 나란히 놓을 뿐이다. 무엇이 잘못됐는지도, 어떻게 하라고도 말하지 않는다.
      return happened(next,
        `이 눈금값은 ${cal.objective * EYEPIECE}배에서 구한 것이고, 방금 센 칸 수는 `
        + `${m.objective * EYEPIECE}배에서 센 것입니다.`,
        'calib-other-mag');
    }
    return ok(next,
      `${row.target === 'specimen' ? '공변세포' : '잰 것'}의 길이를 ${row.lengthUm.toFixed(1)} µm 로 기록했습니다.`,
      'measured');
  },

  /** M-21 기록을 지운다. 관찰을 무르는 것이 아니라 **무엇을 근거로 삼을지 고르는 일**이다. */
  DELETE_CALIBRATION(state, { at }) {
    const rows = state.session.calibrations.filter((c) => c.at !== at);
    if (rows.length === state.session.calibrations.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    // 그 눈금값을 쓰던 측정은 참조를 잃는다. 지우지 않고 **빈칸으로 되돌린다** —
    // 학생이 센 칸 수는 여전히 사실이기 때문이다.
    const measurements = state.session.measurements.map((r) =>
      (r.calibrationAt === at ? { ...r, calibrationAt: null, lengthUm: null } : r));
    return ok(withSession(state, { calibrations: rows, measurements }),
      '눈금값 기록을 지웠습니다.', 'record-deleted');
  },

  DELETE_MEASUREMENT(state, { at }) {
    const rows = state.session.measurements.filter((r) => r.at !== at);
    if (rows.length === state.session.measurements.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    return ok(withSession(state, { measurements: rows }), '측정 기록을 지웠습니다.', 'record-deleted');
  },

  /**
   * M-22 결과를 기록한다. 흐린 상도 기록된다 — 막지 않는다.
   * 정리 단계에서 왜 흐렸는지 스스로 설명하게 한다.
   */
  CAPTURE(state) {
    const m = state.microscope;
    if (!m.stage) return happened(state, '재물대에 아무것도 없습니다.');
    const capture = {
      at: nextAt(state.session.captures),
      eyepiece: EYEPIECE,
      readability: readability(state),
      ...fieldParams(state),
    };
    const next = withSession(state, { captures: [...state.session.captures, capture] });
    if (focusError(m) > focusTolerance(m.objective, 'micrometer')) {
      return happened(next, '흐린 채로 기록됐습니다. 정리 단계에서 왜 흐렸는지 적게 됩니다.',
        'blurry-capture');
    }
    return ok(next,
      `${ITEM_NAME[m.stage]} 시야를 기록했습니다. 지금까지 ${next.session.captures.length}장입니다.`,
      'captured');
  },

  DELETE_CAPTURE(state, { at }) {
    const captures = state.session.captures.filter((c) => c.at !== at);
    if (captures.length === state.session.captures.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    const notes = { ...state.session.notes };
    delete notes[`mag.${at}`];
    return ok(withSession(state, { captures, notes }), '기록을 지웠습니다.', 'capture-deleted');
  },

  /**
   * M-23 새 기구를 꺼낸다.
   *
   * 대물 마이크로미터는 이 실험에서 **유일한 기준자**다. 깨지고 새것을 꺼낼 길이 없으면
   * 실험이 거기서 끝난다 — 그건 결과가 아니라 막다른 길이다.
   * 바나나랩이 `NEW_SLIDE` 를 뒤늦게 넣은 이유를 읽고 처음부터 넣었다.
   */
  NEW_ITEM(state, { item: itemId }) {
    if (!ITEM_IDS.includes(itemId)) return happened(state, '어느 기구를 바꿀지 알 수 없습니다.');
    const old = state.items[itemId];
    const fresh = initialItem(itemId, old.seed);
    let next = { ...state, items: { ...state.items, [itemId]: fresh } };
    if (state.microscope.stage === itemId) next = withScope(next, { stage: null });
    const name = ITEM_NAME[itemId];
    if (old.cracked) {
      return ok(next, `금 간 ${name}${eul(name)} 버리고 새것을 꺼냈습니다. 다시 올려 정렬하세요.`,
        'item-replaced');
    }
    return ok(next, `새 ${name}${eul(name)} 꺼냈습니다.`, 'item-replaced');
  },

  /* ── 정리 — 시야로 말할 수 없는 것들 ───────────────────────────── */

  /**
   * 정리 넷.
   *
   * **정리는 기록만 남기는 것이 아니라 실제로 그 일이 일어나야 한다.**
   * 「조명을 껐습니다」 라고 말해 놓고 램프가 켜져 있으면 화면이 거짓말을 하는 것이고,
   * 그건 이 프로젝트에서 가장 하면 안 되는 일이다. 그래서 `apply` 로 상태를 함께 바꾼다.
   * (접안 마이크로미터를 케이스에 넣는 것과 표본을 상자에 넣는 것은 기구를 원래 자리로
   *  되돌리는 일이라, 재물대/접안렌즈에서 실제로 내려온다.)
   */
  /**
   * M-01b 통에서 **꺼낸다.** 넣기(`PUT_AWAY_OCULAR`)의 짝이다.
   *
   * 통에 넣는 길만 있고 꺼내는 길이 없었다. 그래서 통을 누른 학생은 원판이 통 안으로
   * 사라지는 것만 보고, 다시 꺼내려면 통을 또 눌러야 하는데 그러면 또 넣기가 일어난다 —
   * **되돌아갈 길이 없는 자리**였다 (AGENTS.md §2.1).
   *
   * 정리(`tidy`) 기록은 건드리지 않는다. 꺼내는 것은 정리를 무르는 일이 아니라
   * 실험을 이어 하는 일이고, 마지막에 다시 넣으면 그때 정리로 다시 잡힌다.
   */
  TAKE_OUT_OCULAR(state) {
    if (!state.eyepiece.stowed) {
      return ok(state, '접안 마이크로미터는 이미 꺼내져 있습니다.');
    }
    return ok(withEye(state, { stowed: false }),
      '통에서 접안 마이크로미터를 꺼냈습니다. 접안렌즈에 끼울 수 있습니다.', 'ocular-out');
  },

  /**
   * 원판을 **통에 넣는다.** 원판이 있을 수 있는 세 자리 중 하나이고,
   * 넣는 길이 없으면 통이 눌러도 아무 일도 안 나는 물건이 된다.
   * 안전 점수가 아니다 — 그냥 제자리에 놓는 일이다.
   */
  PUT_AWAY_OCULAR(state) {
    if (state.eyepiece.stowed) return ok(state, '접안 마이크로미터는 이미 통 안에 있습니다.');
    return ok(withEye(state, { micrometer: false, flipped: false, stowed: true }),
      '접안 마이크로미터를 통에 넣었습니다.', 'ocular-stowed');
  },

  /* ── 탐구 노트 · 되돌리기 — 바나나랩과 같다 ─────────────────────── */

  SAVE_NOTE(state, { step, text = '' }) {
    if (!step) return happened(state, '어느 단계의 기록인지 알 수 없어 저장하지 않았습니다.');
    return ok(withSession(state, { notes: { ...state.session.notes, [step]: text } }));
  },

  MARK_READ(state, { stage }) {
    const read = state.session.readStages ?? [];
    if (!stage || read.includes(stage)) return ok(state);
    return ok(withSession(state, { readStages: [...read, stage] }));
  },

  UNDO(state) {
    const { history, undosLeft, log } = state.session;
    if (undosLeft <= 0) return happened(state, '되돌릴 수 있는 횟수를 다 썼습니다.', 'undo-exhausted');
    if (history.length === 0) return happened(state, '되돌릴 것이 없습니다.', 'undo-empty');
    const prev = history[history.length - 1];
    return happened({
      ...prev,
      session: {
        ...prev.session,
        history: history.slice(0, -1),
        undosLeft: undosLeft - 1,   // Infinity - 1 은 여전히 Infinity 다
        log,                        // 로그는 되돌리지 않는다. 되돌아보기용이기 때문이다
      },
    }, '한 단계 되돌렸습니다.', 'undo');
  },
};

/** 단일 진입점. 부수효과 없이 새 상태를 돌려준다. */
export function reduce(state, action) {
  const fn = ACTIONS[action.type];
  if (!fn) throw new Error(`알 수 없는 액션: ${action.type}`);
  const result = fn(state, action.payload ?? {});
  const session = result.state.session;

  // 되돌리기 기록에 쌓을지 정한다. 참조가 달라졌다는 것만으로는 부족하다.
  //   · UNDO 는 스스로 되감으므로 다시 쌓지 않는다
  //   · 상태를 못 바꾼 액션은 쌓지 않는다. 되돌리기가 헛돌게 된다
  //   · 시야 둘러보기와 정리 점검은 조작이 아니다
  //   · 연속 조작은 앞선 것과 같은 종류면 합친다. 끌기 전 상태가 이미 쌓여 있다
  const changed = result.state !== state;
  const prevAction = session.log.length ? session.log[session.log.length - 1].action : null;
  const coalesced = CONTINUOUS_ACTIONS.has(action.type) && prevAction === action.type;
  const keep = changed
    && action.type !== 'UNDO'
    && !TRANSIENT_ACTIONS.has(action.type)
    && !coalesced;
  const history = keep
    ? [...session.history, snapshot(state)].slice(-HISTORY_LIMIT)
    : session.history;

  const logged = {
    ...result.state,
    session: {
      ...session,
      history,
      // at 은 순번이다. Date.now() 를 쓰면 테스트가 비결정적이 된다.
      log: [...session.log, {
        at: session.log.length, action: action.type, outcome: result.outcome, tag: result.tag ?? null,
      }],
    },
  };
  return { ...result, state: logged };
}
