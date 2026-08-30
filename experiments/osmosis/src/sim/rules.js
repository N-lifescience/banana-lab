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
 * 새 'blocked' 를 추가하려면 사람에게 먼저 물어볼 것. AGENTS.md §2.1 참조.
 * docs/04-interaction-rules.md 참조.
 */

import {
  SLIDE_IDS, SIDES, coverage, excess, focusError, brightness, isTooThick, fieldParams,
  mediumPct, settled, initialSlide, HISTORY_LIMIT, PAN_LIMIT,
} from './state.js';
import { focusTolerance, EYEPIECE } from './optics.js';
import { SOLUTION_PCT, pctOf, EXCHANGE_PER_WICK, stepEquivPct } from './osmosis.js';

export { PAN_LIMIT };

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시간이 흐르는 것과 시야를 둘러보는 것은 학생이 "한" 조작이 아니다.
 * 이걸 쌓으면 1초마다 도는 TICK 이 20칸짜리 기록을 몇 초 만에 밀어내고,
 * 되돌리기 1회짜리 3단계에서는 그 한 번이 TICK 을 무르는 데 쓰여 사라진다.
 */
export const TRANSIENT_ACTIONS = new Set([
  'TICK', 'MOVE_STAGE',
  // 탐구 노트의 어느 쪽을 읽었는지는 학생이 "한" 조작이 아니다. 되돌릴 것도 아니다.
  'MARK_READ',
]);

/**
 * 연속 조작 — 슬라이더 한 번 끄는 동안 수십 번 디스패치된다.
 * 앞선 액션이 같은 종류면 기록을 새로 쌓지 않는다. 이미 쌓인 것이 끌기 전 상태이기 때문이다.
 * 그래서 되돌리기 한 번이 "끌기 전" 으로 돌아간다. 슬라이더 눈금 하나씩 무르는 것은 뜻이 없다.
 */
export const CONTINUOUS_ACTIONS = new Set(['FINE_FOCUS', 'COARSE_FOCUS', 'SET_DIAPHRAGM', 'SAVE_NOTE']);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음 (닫힌 뚜껑 안으로 물체 넣기)
  BROKEN: 'broken',           // 기구가 파손돼 재제작이 필요함
};

/**
 * 뜻대로 됐다.
 *
 * 말은 **선택**이다. 시간이 흐르거나(TICK) 시야를 둘러보는 것(MOVE_STAGE)처럼
 * 학생이 "했다" 고 느끼지 않는 일에는 붙이지 않는다 — 붙이면 화면이 쉬지 않고 떠든다.
 */
const ok = (state, message = null, tag = null) => ({ state, outcome: 'ok', message, tag });

/** 마지막 글자에 받침이 있는가. 한글이 아니면 있는 것으로 본다. */
const hasJong = (w) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return true;
  return (c - 0xac00) % 28 !== 0;
};

/** 받침 조사. 받침이 있으면 '을', 없으면 '를'. */
const eul = (w) => (hasJong(w) ? '을' : '를');

/**
 * 받침 조사. 받침이 있으면 '이', 없으면 '가'.
 * 용액 이름이 「증류수」·「설탕 용액 20 %」 처럼 끝소리가 갈리므로 문장마다 필요하다 —
 * 「증류수이 남아 있는」 이 실제로 화면에 떴다.
 */
const iga = (w) => (hasJong(w) ? '이' : '가');

/** 토스트에 쓸 짧은 이름. 화면 문구(strings.js)와 같은 표기를 쓴다. */
const SLIDE_NAME = { A: '(가)', B: '(나)', C: '(다)' };

/**
 * 용액 이름. **농도는 이름표로만 구분한다.**
 * 설탕 용액은 농도가 달라도 눈으로는 다 무색이다 — 병에 색을 달리 칠하면
 * "진한 용액은 진한 색" 이라는 틀린 것을 가르치게 된다 (tasks/T02-assets.md).
 */
export const SOLUTION_NAME = {
  WATER: '증류수',
  S05: '설탕 용액 5 %',
  S10: '설탕 용액 10 %',
  S15: '설탕 용액 15 %',
  S20: '설탕 용액 20 %',
};

const SIDE_NAME = { outer: '바깥쪽', inner: '안쪽' };

const happened = (state, message, tag) => ({ state, outcome: 'happened', message, tag: tag ?? null });
const blocked = (state, message, reason) => {
  if (!Object.values(BLOCKING_REASONS).includes(reason)) {
    throw new Error(`허용되지 않은 차단 사유: ${reason}. AGENTS.md §2.1 을 읽으세요.`);
  }
  return { state, outcome: 'blocked', message, reason };
};

/** 얕은 복사로 불변성을 지킨다. reduce 는 부수효과가 없어야 한다. */
function withSlide(state, id, patch) {
  return { ...state, slides: { ...state.slides, [id]: { ...state.slides[id], ...patch } } };
}
function withScope(state, patch) {
  return { ...state, microscope: { ...state.microscope, ...patch } };
}
function withTools(state, patch) {
  return { ...state, tools: { ...state.tools, ...patch } };
}

/**
 * 되돌리기용 스냅샷.
 * history 를 비워서 담는다 — 스냅샷 안에 또 history 가 들어가면 지수적으로 커진다.
 */
function snapshot(state) {
  return { ...state, session: { ...state.session, history: [] } };
}

/**
 * 덮개 유리를 내려놓은 각도로 기포 수가 정해진다.
 * 35°~55° 사이면 0개, 수직(90°)이나 눕힘(0°)에 가까울수록 최대 6개.
 */
export function bubblesFromAngle(angleDeg) {
  const off = Math.abs(angleDeg - 45);
  return Math.round(6 * Math.max(0, Math.min((off - 10) / 45, 1)));
}

/**
 * 칼집을 내지 않고 벗겼을 때의 최소 두께.
 * 칼집이 없으면 표피가 통째로 찢겨 여러 겹으로 딸려 온다. 막지 않는다 —
 * 세포가 겹쳐 보이는 시야가 대신 답한다.
 */
export const UNCUT_MIN_THICKNESS = 0.72;

/* ------------------------------------------------------------------ */
/* 액션                                                                */
/* ------------------------------------------------------------------ */

export const ACTIONS = {

  /** R-01 비늘잎에 5×5 mm 칼집을 낸다 */
  CUT_SCALE(state) {
    if (state.tools.onion.cut) return ok(state, '칼집은 이미 나 있습니다.');
    return ok(withTools(state, { onion: { ...state.tools.onion, cut: true } }),
      '비늘잎에 5×5 mm 칼집을 냈습니다. 이 자리에서 표피를 벗깁니다.', 'cut');
  },

  /**
   * R-02 핀셋으로 표피를 벗긴다.
   *
   * **어느 면인지가 이 실험의 변인이다.** 안쪽을 벗겨도 막지 않는다 —
   * 색소가 없는 시야가 대신 답한다 (AGENTS.md §2.5).
   */
  PEEL_EPIDERMIS(state, { side = SIDES.OUTER, thickness = 0.28 }) {
    const cut = state.tools.onion.cut;
    // 칼집이 없으면 얇게 벗겨지지 않는다. 학생의 값을 무시하는 것이 아니라,
    // 그보다 얇아질 수 없다는 물리적 사실이다.
    const t = cut ? thickness : Math.max(thickness, UNCUT_MIN_THICKNESS);
    const next = withTools(state, {
      onion: { ...state.tools.onion, cut: false },   // 칼집은 한 조각에 한 번 쓰인다
      epidermis: { side, thickness: t },
    });
    if (!cut) {
      return happened(next,
        '칼집을 내지 않고 벗겨 표피가 여러 겹으로 딸려 왔습니다. 세포가 겹쳐 보입니다.', 'thick-peel');
    }
    if (side === SIDES.INNER) {
      // 여기서 「안쪽은 안 됩니다」 라고 말하면 안 된다. 시야를 보고 알아채는 것이 배우는 내용이다.
      return happened(next, '안쪽 표피를 얇게 벗겼습니다.', 'inner-peel');
    }
    return ok(next, '바깥쪽 표피를 얇게 벗겼습니다.', 'peeled');
  },

  /** R-03 벗긴 표피를 받침 유리에 올린다. 접혀 올라가도 막지 않는다. */
  PLACE_SAMPLE(state, { slide, folded = false }) {
    const piece = state.tools.epidermis;
    if (!piece) {
      return happened(state, '핀셋에 표피가 없습니다. 비늘잎에서 먼저 벗기세요.', 'no-epidermis');
    }
    const next = withTools(
      withSlide(state, slide, { sample: { ...piece, folded } }),
      { epidermis: null }
    );
    if (folded) {
      return happened(next, '표피가 접힌 채로 올라갔습니다. 접힌 자리는 세포가 겹쳐 보입니다.', 'folded');
    }
    if (isTooThick(next.slides[slide])) {
      return happened(next, `${SLIDE_NAME[slide]} 받침 유리에 올렸습니다. 조각이 두꺼워 세포가 겹쳐 보입니다.`, 'too-thick');
    }
    return ok(next, `${SLIDE_NAME[slide]} 받침 유리에 ${SIDE_NAME[piece.side]} 표피를 올렸습니다.`, 'placed');
  },

  /**
   * R-04 스포이트에 용액을 채운다.
   *
   * 씻지 않고 다른 용액을 채우면 **나가는 농도가 이름표와 달라진다.**
   * 이 어긋남은 `pct` 에 담긴다 — 이름으로만 다루면 오염이 결과에 없는 것이 된다.
   */
  FILL_DROPPER(state, { solution }) {
    const d = state.tools.dropper;
    const target = pctOf(solution);
    const contaminating = d.holds !== null && d.holds !== solution;
    const pct = contaminating ? (target + d.pct) / 2 : target;
    const next = withTools(state, {
      dropper: { holds: solution, pct, level: 1, rinsed: !contaminating },
    });
    if (contaminating) {
      const prev = SOLUTION_NAME[d.holds] ?? '앞 용액';
      return happened(next,
        `스포이트에 ${prev}${iga(prev)} 남아 있는 채로 채웠습니다. `
        + '나가는 농도가 이름표와 달라집니다. 폐액통에 헹군 뒤 다시 채우세요.', 'cross-contamination');
    }
    const rn = SOLUTION_NAME[solution] ?? '용액';
    return ok(next, `스포이트에 ${rn}${eul(rn)} 담았습니다.`, 'filled');
  },

  /** 스포이트 세척 */
  RINSE_DROPPER(state) {
    return ok(withTools(state, { dropper: { holds: null, pct: 0, level: 0, rinsed: true } }),
      '스포이트를 헹궜습니다. 안에 남은 용액이 없습니다.', 'rinsed');
  },

  /**
   * R-05 받침 유리에 용액을 n방울 떨어뜨려 봉입한다.
   * 방울 수를 검사하지 않는다. 몇 방울이든 받아서 coverage/excess 로 넘긴다.
   *
   * 덮개 유리가 이미 덮여 있으면 액은 안으로 들어가지 못하고 **가장자리에 고인다.**
   * 그것이 곧 R-09 이므로 그리로 넘긴다 — 같은 일을 두 군데 적지 않는다.
   */
  DROP(state, { slide, count = 1 }) {
    const s = state.slides[slide];
    if (!s) return happened(state, '어느 받침 유리에 떨어뜨릴지 알 수 없습니다.', 'no-slide');
    const d = state.tools.dropper;
    if (d.holds === null) {
      return happened(state, '스포이트가 비어 있어 아무것도 떨어지지 않았습니다.', 'dropper-empty');
    }
    if (s.coverslip.placed) {
      return ACTIONS.APPLY_SOLUTION(state, { slide });
    }
    const drops = s.drops + count;
    const contaminated = s.contaminated || !d.rinsed;
    const next = withSlide(state, slide, {
      medium: { id: d.holds, pct: d.pct },
      pending: null,
      exchange: 0,
      drops,
      contaminated,
    });
    if (contaminated && !s.contaminated) {
      return happened(next, '씻지 않은 스포이트를 썼습니다. 덮개 유리 아래 농도가 이름표와 다릅니다.', 'cross-contamination');
    }
    if (drops === 1) {
      return happened(next, '한 방울이 떨어졌습니다. 표피 전체가 잠기지는 않았습니다.', 'partial');
    }
    if (drops >= 5) {
      return happened(next, `액이 받침 유리 밖으로 흘러넘쳐 실험대에 고였습니다 (${drops}방울). `
        + '덮개 유리가 뜨고 상이 둘로 겹칩니다.', 'overflow');
    }
    if (drops >= 3) return happened(next, '용액이 넉넉히 퍼졌습니다.', 'excess');
    const dn = SOLUTION_NAME[d.holds] ?? '용액';
    return ok(next, `${SLIDE_NAME[slide]}에 ${dn}${eul(dn)} ${drops}방울 떨어뜨려 봉입했습니다.`, 'dropped');
  },

  /**
   * R-09 덮개 유리 **한쪽 가장자리**에 용액을 떨어뜨린다.
   *
   * **여기까지만 하면 아무 일도 일어나지 않는다.** 액은 가장자리에 고여 있을 뿐
   * 덮개 유리 아래로 들어가지 못한다. 반대쪽에 거름종이를 대야(R-10) 빨려 들어간다.
   *
   * 이것을 「거름종이를 먼저 대세요」로 막지 않는다. 고인 액을 보여 주고,
   * 시야가 그대로인 것을 보여 준다.
   */
  APPLY_SOLUTION(state, { slide }) {
    const s = state.slides[slide];
    // 재물대에 아무것도 없을 때 현미경에 대면 여기로 온다. 터뜨리지 않고 말로 답한다.
    if (!s) return happened(state, '어느 받침 유리에 댈지 알 수 없습니다. 재물대에 슬라이드가 없습니다.', 'no-slide');
    const d = state.tools.dropper;
    if (d.holds === null) {
      return happened(state, '스포이트가 비어 있어 아무것도 떨어지지 않았습니다.', 'dropper-empty');
    }
    if (!s.coverslip.placed) {
      // 덮을 것이 없으면 그냥 봉입액이 는다. 치환이라는 것이 성립하지 않는다.
      return ACTIONS.DROP(state, { slide, count: 1 });
    }
    const contaminated = s.contaminated || !d.rinsed;
    const next = withSlide(state, slide, {
      pending: { id: d.holds, pct: d.pct },
      exchange: 0,
      contaminated,
    });
    const dn = SOLUTION_NAME[d.holds] ?? '용액';
    if (contaminated && !s.contaminated) {
      return happened(next, '씻지 않은 스포이트를 썼습니다. 가장자리에 고인 농도가 이름표와 다릅니다.', 'cross-contamination');
    }
    if (s.pending && s.pending.id !== d.holds) {
      const was = SOLUTION_NAME[s.pending.id] ?? '용액';
      return happened(next,
        `가장자리에 있던 ${was}${iga(was)} ${dn}${eul(dn)}에 밀려났습니다. 치환을 처음부터 다시 합니다.`,
        'applied-replaced');
    }
    return ok(next, `덮개 유리 한쪽에 ${dn}${eul(dn)} 대었습니다. 반대쪽에서 빨아들여야 안으로 들어갑니다.`, 'applied');
  },

  /**
   * R-10 덮개 유리 반대쪽에 거름종이를 댄다.
   *
   * 이 조작이 이 실험의 중심이다. 한 번으로는 절반만 바뀌어 **섞인 농도**가 되고,
   * 그 어중간한 결과를 그대로 보여 준다 (AGENTS.md §2.1).
   */
  WICK(state, { slide }) {
    const s = state.slides[slide];
    if (!s) return happened(state, '어느 받침 유리에 댈지 알 수 없습니다. 재물대에 슬라이드가 없습니다.', 'no-slide');
    if (!s.coverslip.placed) {
      return happened(state, '덮개 유리가 없습니다. 빨아들일 것이 없어 액만 번집니다.', 'no-coverslip');
    }
    if (!s.pending) {
      return happened(state,
        '가장자리에 새 용액이 없습니다. 반대쪽에 용액을 한 방울 대고 나서 빨아들이세요.', 'nothing-to-wick');
    }
    const exchange = s.exchange + EXCHANGE_PER_WICK;
    if (exchange >= 1) {
      const next = withSlide(state, slide, { medium: s.pending, pending: null, exchange: 0 });
      const dn = SOLUTION_NAME[s.pending.id] ?? '용액';
      return ok(next, `덮개 유리 아래가 ${dn}으로 다 바뀌었습니다.`, 'exchanged');
    }
    // 여기서 happened 를 돌려주면 안 된다. **한 번에 다 안 바뀌는 것이 정상**이라,
    // 제대로 하고 있는 학생에게 매번 경고가 뜬다. 진행 상황을 말해 줄 뿐이다.
    return ok(withSlide(state, slide, { exchange }),
      '거름종이가 액을 빨아들였습니다. 아직 앞 용액이 섞여 있습니다 — 한 번 더 하세요.', 'wicking');
  },

  /**
   * R-11 시간 경과 — 삼투가 진행된다.
   * 삼투는 즉시 일어나지 않는다. 덜 기다리고 본 중간 상태도 그대로 보여 준다.
   */
  TICK(state, { seconds = 1, speed = 10 }) {
    const slides = { ...state.slides };
    for (const id of Object.keys(slides)) {
      const s = slides[id];
      if (!s.sample || !s.medium) continue;
      const target = mediumPct(s);
      const equivPct = stepEquivPct(s.equivPct, target, seconds, speed);
      if (equivPct !== s.equivPct) slides[id] = { ...s, equivPct };
    }
    return ok({ ...state, slides });
  },

  /** 핀셋으로 덮개 유리를 집는다 */
  PICK_COVERSLIP(state) {
    return ok(withTools(state, { forceps: { holding: 'coverslip' } }),
      '핀셋으로 덮개 유리를 집었습니다.', 'picked');
  },

  /** R-06 덮개 유리를 덮는다. 각도가 기포를 만든다. */
  PLACE_COVERSLIP(state, { slide, angleDeg = 45 }) {
    const s = state.slides[slide];
    if (state.tools.forceps.holding === 'usedCoverslip') {
      return happened(state, '한 번 쓴 덮개 유리는 다시 쓰지 않습니다. 쓰레기통에 버리고 새것을 집으세요.', 'coverslip-used');
    }
    if (state.tools.forceps.holding !== 'coverslip') {
      return happened(state, '핀셋이 비어 있습니다. 덮개 유리 통에서 먼저 집으세요.', 'forceps-empty');
    }
    const bubbles = bubblesFromAngle(angleDeg);
    const next = withTools(
      withSlide(state, slide, { coverslip: { placed: true, angleAtDrop: angleDeg, bubbles } }),
      { forceps: { holding: null } }
    );
    if (bubbles > 0) {
      return happened(next, `기포가 ${bubbles}개 생겼습니다. 45° 기울여 한쪽 끝부터 천천히 내려놓으면 생기지 않습니다.`, 'bubbles');
    }
    if (!s.medium) {
      return happened(next, '봉입액 없이 덮었습니다. 세포가 말라 시야가 어둡고 거칩니다.', 'dry-mount');
    }
    return ok(next, `${SLIDE_NAME[slide]}에 덮개 유리를 기포 없이 덮었습니다.`, 'covered');
  },

  /** R-07 재물대에 슬라이드를 올린다. */
  MOUNT(state, { slide }) {
    const s = state.slides[slide];
    if (s.cracked) {
      return blocked(state, '이 슬라이드는 금이 갔습니다. 받침 유리 통에서 새것을 꺼내 처음부터 다시 만드세요.',
        BLOCKING_REASONS.BROKEN);
    }
    const next = withScope(state, { stage: slide });
    if (!s.coverslip.placed) {
      return happened(next, '덮개 유리 없이 올렸습니다. 고배율로 올리면 대물렌즈가 시료에 닿습니다.', 'no-coverslip');
    }
    return ok(next, `${SLIDE_NAME[slide]} 슬라이드를 재물대에 올렸습니다.`, 'mounted');
  },

  /**
   * 덮은 덮개 유리를 핀셋으로 다시 들어낸다.
   *
   * 기포가 잔뜩 생겼거나 덮는 순서를 틀렸을 때 되돌아갈 길이다.
   * 들어낸 것은 **쓴 덮개 유리**다. 시료가 묻었고 얇아서 닦아 쓰지 않는다.
   */
  LIFT_COVERSLIP(state, { slide }) {
    const s = state.slides[slide];
    if (!s.coverslip.placed) {
      return happened(state, '이 받침 유리에는 덮개 유리가 없습니다.');
    }
    const next = withTools(
      withSlide(state, slide, {
        coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 },
        // 덮개 유리를 들어내면 가장자리에 고여 있던 액은 흘러 버린다.
        pending: null, exchange: 0,
      }),
      { forceps: { holding: 'usedCoverslip' } }
    );
    return ok(next, '덮개 유리를 들어냈습니다. 한 번 쓴 것이니 쓰레기통에 버리세요.', 'coverslip-lifted');
  },

  /**
   * 더러워진 대물렌즈를 닦는다.
   * 한 번의 실수로 현미경을 못 쓰게 만드는 것은 이 실험이 가르치려는 바가 아니다.
   */
  CLEAN_LENS(state) {
    const dirty = SLIDE_IDS.filter((id) => state.slides[id].lensTouched);
    if (dirty.length === 0) return ok(state, '렌즈는 깨끗합니다.');
    let next = state;
    for (const id of dirty) next = withSlide(next, id, { lensTouched: false });
    return ok(next, '대물렌즈를 닦았습니다. 시야가 다시 맑아집니다.', 'lens-cleaned');
  },

  /** 쓴 덮개 유리를 쓰레기통에 버린다. */
  DISCARD_COVERSLIP(state) {
    if (!state.tools.forceps.holding) {
      return happened(state, '핀셋이 비어 있습니다.');
    }
    return ok(withTools(state, { forceps: { holding: null } }),
      '쓴 덮개 유리를 쓰레기통에 버렸습니다.', 'discarded');
  },

  /**
   * 개수대에서 받침 유리를 씻는다.
   *
   * 안쪽 표피를 잘못 올렸거나 표피가 두꺼웠을 때 처음으로 돌아가는 길이다.
   * 금이 간 유리도 씻는 것 자체는 막지 않는다 — 씻겨도 금은 그대로 남는다.
   */
  RINSE_SLIDE(state, { slide }) {
    const s = state.slides[slide];
    if (s.cracked) {
      return happened(state, '씻어도 금은 그대로입니다. 받침 유리 통에 대어 새것으로 바꾸세요.', 'cracked');
    }
    const next = withSlide(state, slide, {
      sample: null, medium: null, pending: null, exchange: 0, drops: 0, equivPct: 0,
      coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 },
      contaminated: false, lensTouched: false,
    });
    return ok(next, `${SLIDE_NAME[slide]} 받침 유리를 씻었습니다. 처음부터 다시 만들 수 있습니다.`, 'slide-rinsed');
  },

  /**
   * 받침 유리 통에서 새것을 꺼낸다.
   * 금이 간 유리를 씻는 것으로는 되돌릴 수 없다 — 씻어도 금은 남는다.
   */
  NEW_SLIDE(state, { slide }) {
    const s = state.slides[slide];
    if (!s) return happened(state, '어느 받침 유리를 바꿀지 알 수 없습니다.');
    const fresh = { ...initialSlide(slide), seed: s.seed };
    let next = { ...state, slides: { ...state.slides, [slide]: fresh } };
    if (state.microscope.stage === slide) next = withScope(next, { stage: null });
    if (s.cracked) {
      return ok(next, `금 간 ${SLIDE_NAME[slide]}를 버리고 통에서 새것을 꺼냈습니다. 처음부터 다시 만드세요.`, 'slide-replaced');
    }
    return ok(next, `${SLIDE_NAME[slide]}를 새 받침 유리로 바꿨습니다. 쓰던 것의 표피와 용액은 사라졌습니다.`, 'slide-replaced');
  },

  /**
   * 기록한 결과를 지운다.
   *
   * `at` 은 캡처가 만들어질 때 한 번 붙는 번호다. 배열 인덱스로 지우면 안 된다 —
   * 앞엣것을 지운 순간 뒤엣것들의 인덱스가 밀려, 딸린 답이 남의 것이 된다.
   */
  DELETE_CAPTURE(state, { at }) {
    const captures = state.session.captures.filter((c) => c.at !== at);
    if (captures.length === state.session.captures.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    const notes = { ...state.session.notes };
    delete notes[`mag.${at}`];
    delete notes[`ratio.${at}`];
    return ok(
      { ...state, session: { ...state.session, captures, notes } },
      '기록을 지웠습니다.', 'capture-deleted'
    );
  },

  /**
   * 탐구 노트의 한 단계를 읽었다고 표시한다.
   * 실험대는 이것이 다 차야 열린다 — 조작을 막는 것이 아니라 시작하기 전에 읽게 하는 것이다.
   */
  MARK_READ(state, { stage }) {
    const read = state.session.readStages ?? [];
    if (!stage || read.includes(stage)) return ok(state);
    return ok({ ...state, session: { ...state.session, readStages: [...read, stage] } });
  },

  /** 재물대에서 슬라이드를 내린다. 잘못 올렸을 때 빠져나오는 길이다. */
  UNMOUNT(state) {
    const on = state.microscope.stage;
    if (!on) return ok(state);
    return ok(withScope(state, { stage: null }),
      `${SLIDE_NAME[on]} 슬라이드를 재물대에서 내렸습니다.`, 'unmounted');
  },

  /**
   * R-08 대물렌즈를 바꾼다.
   * 저배율을 건너뛰어도 막지 않는다. 초점 심도가 얕아 사실상 찾기 어려워질 뿐이다.
   */
  SET_OBJECTIVE(state, { objective }) {
    const m = state.microscope;
    let next = withScope(state, { objective });
    const slideId = m.stage;
    if (slideId && objective === 40 && !state.slides[slideId].coverslip.placed) {
      next = withSlide(next, slideId, { lensTouched: true });
      return happened(next, '대물렌즈가 시료에 닿았습니다. 시야가 뭉개지고 렌즈가 더러워졌습니다.', 'lens-touched');
    }
    if (objective === 40 && !m.lowMagFocused) {
      return happened(next, '저배율에서 초점을 맞추지 않고 올렸습니다. 초점 맞는 범위가 매우 좁습니다.', 'skipped-low-mag');
    }
    return ok(next, `대물렌즈를 ${objective}배로 바꿨습니다. 접안렌즈 ${EYEPIECE}배와 곱해 총 ${objective * EYEPIECE}배입니다.`, 'objective');
  },

  /**
   * 조동나사.
   * 고배율에서 돌리면 슬라이드가 깨진다. 허용되는 두 하드 게이트 중 하나다 —
   * 막는 것이 아니라, 이미 벌어진 파손 때문에 그 슬라이드를 더 쓸 수 없는 것이다.
   */
  COARSE_FOCUS(state, { delta }) {
    const m = state.microscope;
    if (m.objective === 40 && m.stage) {
      const next = withScope(withSlide(state, m.stage, { cracked: true }), { stage: null });
      return happened(next, '고배율에서 조동나사를 돌려 슬라이드에 금이 갔습니다. 새로 만들어야 합니다.', 'cracked');
    }
    const wanted = m.coarse + delta;
    const coarse = Math.max(-1, Math.min(1, wanted));
    // 끝까지 돌아갔는데 아직 초점이 아니면, **막지 말고 말한다.**
    // 앞서는 계속 돌려도 값도 화면도 그대로였다 — 학생은 고장 난 줄 안다 (AGENTS.md §2.1).
    // 「끝에 부딪혔다」는 원한 값이 잘렸을 때만이다. delta 0 은 끝이 아니다.
    // 남은 만큼은 돌아간다 — 끝에 부딪혔다고 손잡이가 그 자리에 얼어붙지는 않는다.
    if (coarse !== wanted && Math.abs(coarse + m.fine) >= focusTolerance(m.objective)) {
      return happened(withScope(state, { coarse }),
        '조동나사가 끝까지 돌아갔습니다. 반대 방향으로 돌리세요.', 'coarse-limit');
    }
    let next = withScope(state, { coarse });
    if (Math.abs(coarse + m.fine) < focusTolerance(m.objective)) {
      next = withScope(next, { lowMagFocused: true });
    }
    return ok(next);
  },

  /** 미동나사 — 언제나 안전하다 */
  FINE_FOCUS(state, { delta }) {
    const m = state.microscope;
    const wanted = m.fine + delta;
    const fine = Math.max(-0.2, Math.min(0.2, wanted));
    // 미동나사만으로는 조동나사가 벌려 놓은 거리를 못 좁힌다 (미동 ±0.2, 조동 ±1).
    // 40 배에서는 조동나사가 슬라이드를 깨므로 **여기가 막다른 길이 된다** —
    // 계속 돌려도 아무 일도 안 일어나고 아무 말도 없었다. 빠져나갈 길을 말해 준다.
    // 남은 만큼은 돌아간다 (조동나사와 같다).
    if (fine !== wanted && Math.abs(m.coarse + fine) >= focusTolerance(m.objective)) {
      return happened(withScope(state, { fine }), m.objective === 40
        ? '미동나사가 끝까지 돌아갔습니다. 40배에서는 조동나사를 쓸 수 없습니다 — 저배율로 내려 초점을 맞춘 뒤 다시 올리세요.'
        : '미동나사가 끝까지 돌아갔습니다. 조동나사로 먼저 대강 맞추세요.', 'fine-limit');
    }
    let next = withScope(state, { fine });
    if (m.objective <= 10 && Math.abs(m.coarse + fine) < focusTolerance(m.objective)) {
      next = withScope(next, { lowMagFocused: true });
    }
    return ok(next);
  },

  /** 재물대를 옮긴다. 끝에 닿아도 막지 않는다 — 더 가지 않을 뿐이다. */
  MOVE_STAGE(state, { dx = 0, dy = 0 }) {
    const m = state.microscope;
    return ok(withScope(state, {
      panX: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, (m.panX ?? 0) + dx)),
      panY: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, (m.panY ?? 0) + dy)),
    }));
  },

  /** 조리개 */
  SET_DIAPHRAGM(state, { value }) {
    const next = withScope(state, { diaphragm: Math.max(0, Math.min(1, value)) });
    if (brightness(next.microscope) < 0.35) {
      return happened(next, '시야가 어둡습니다. 세포벽과 원형질체의 경계가 잘 보이지 않습니다.', 'dark');
    }
    return ok(next);
  },

  /**
   * R-12 결과를 기록한다.
   * 흐린 상도 기록된다. 막지 않는다 — 정리 단계에서 왜 흐렸는지 스스로 설명하게 한다.
   *
   * **원형질분리 세포의 비율은 기록하지 않는다.** 그것을 시야에서 읽어 내는 것이
   * 이 실험의 탐구다. 화면이 세어 주면 탐구가 사라진다.
   */
  CAPTURE(state) {
    const m = state.microscope;
    if (!m.stage) return happened(state, '재물대에 슬라이드가 없습니다.');
    const s = state.slides[m.stage];
    const nextAt = state.session.captures.reduce((n, c) => Math.max(n, (c.at ?? -1) + 1), 0);
    const capture = {
      slide: m.stage,
      at: nextAt,
      eyepiece: EYEPIECE,
      drops: s.drops,
      // 어느 용액을 넣고 본 것인지. **이름표**다 — 실제 농도(pct)는 fieldParams 에 있다.
      solution: s.medium?.id ?? null,
      settled: settled(s),
      ...fieldParams(state, m.stage),
    };
    const next = {
      ...state,
      session: { ...state.session, captures: [...state.session.captures, capture] },
    };
    if (capture.focusErr > focusTolerance(m.objective)) {
      return happened(next, '흐린 채로 기록됐습니다. 정리 단계에서 왜 흐렸는지 적게 됩니다.', 'blurry-capture');
    }
    if (!capture.settled) {
      return happened(next, '삼투가 아직 진행 중일 때 기록했습니다. 조금 더 두고 다시 보면 달라집니다.', 'unsettled-capture');
    }
    return ok(next, `${SLIDE_NAME[m.stage]} 시야를 기록했습니다. 지금까지 ${next.session.captures.length}장입니다.`, 'captured');
  },

  /*
   * **안전·정리 조작은 걷어냈다.**
   *
   * 손 씻기·마개 닫기·폐액 버리기를 눌러서 하게 하고 안 하면 자기 평가에 적었다.
   * 그런데 가상 실험에서 그걸 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다 —
   * 안전 습관이 아니라 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
   * 자기 평가 쪽에는 대신 **판정하지 않는 안내**를 적어 둔다 (`UI.notebook.valuesItems`).
   *
   * 물건은 실험대에 그대로 있다 — 셋 다 **끌기 쓰임이 따로 있기 때문**이다.
   * 휴지→현미경(렌즈 닦기) · 폐액통←스포이트(헹구기) · 시약병←스포이트(채우기).
   * 그게 없었다면 **눌러도 아무 일 없는 물건**이 남았을 것이라 실험대에서 뺐어야 한다.
   */

  /** 세부 단계별 관찰 기록 */
  SAVE_NOTE(state, { step, text = '' }) {
    if (!step) return happened(state, '어느 단계의 기록인지 알 수 없어 저장하지 않았습니다.');
    return ok({
      ...state,
      session: { ...state.session, notes: { ...state.session.notes, [step]: text } },
    });
  },

  /**
   * 되돌리기. 난이도가 올라갈수록 횟수가 줄어든다 (1단계 무제한 · 2단계 3회 · 3단계 1회).
   * 횟수를 다 썼거나 되돌릴 것이 없어도 막지 않는다 — 아무 일도 일어나지 않았다고 말할 뿐이다.
   */
  UNDO(state) {
    const { history, undosLeft, log } = state.session;
    if (undosLeft <= 0) {
      return happened(state, '되돌릴 수 있는 횟수를 다 썼습니다.', 'undo-exhausted');
    }
    if (history.length === 0) {
      return happened(state, '되돌릴 것이 없습니다.', 'undo-empty');
    }
    const prev = history[history.length - 1];
    return happened({
      ...prev,
      session: {
        ...prev.session,
        history: history.slice(0, -1),
        undosLeft: undosLeft - 1,   // Infinity - 1 은 여전히 Infinity 다
        log,                        // 로그는 되돌리지 않는다. 되돌아보기용 기록이기 때문이다
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

  // 되돌리기 기록에 쌓을지 정한다. 참조가 달라졌다는 것만으로는 부족하다 —
  // TICK 은 1초마다 새 객체를 돌려주지만 학생이 한 조작이 아니다.
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
