/**
 * 규칙 엔진.
 *
 * 이 프로젝트의 핵심 원칙: **강제하지 말고 결과로 답한다.**
 * 조작을 막는 대신 상태를 바꾸고, 무슨 일이 일어났는지 말한다.
 *
 * 결과 종류는 셋뿐이다:
 *   'ok'       진행됐다. 별말 없음.
 *   'happened' 진행됐다. 다만 이런 일이 일어났다. (대부분 여기 해당)
 *   'blocked'  진행되지 않았다. **아래 BLOCKING_REASONS 두 가지에만 허용된다.**
 *
 * 새 'blocked' 를 추가하려면 사람에게 먼저 물어볼 것. AGENTS.md §2.1 참조.
 * docs/04-interaction-rules.md 참조.
 */

import {
  REAGENTS, SLIDE_IDS, coverage, excess, focusError, brightness, isTooThick,
  HISTORY_LIMIT, PAN_LIMIT,
} from './state.js';
import { focusTolerance } from './optics.js';

export { PAN_LIMIT };

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시간이 흐르는 것과 시야를 둘러보는 것은 학생이 "한" 조작이 아니다.
 * 이걸 쌓으면 1초마다 도는 TICK 이 20칸짜리 기록을 몇 초 만에 밀어내고,
 * 되돌리기 1회짜리 3단계에서는 그 한 번이 TICK 을 무르는 데 쓰여 사라진다.
 */
export const TRANSIENT_ACTIONS = new Set(['TICK', 'MOVE_STAGE', 'NOTE_VIOLATION']);

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

const ok = (state) => ({ state, outcome: 'ok', message: null, tag: null });
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
 * 안전 수칙 액션을 만든다.
 * 마개·손·폐액은 시야에 나타나지 않으므로 결과로 말할 수 없다.
 * 늦게라도 지키면 위반 기록에서 지운다. 감점은 애초에 없다. docs/04 「안전 규칙만은 예외」 참조.
 */
function safetyAction(kind, message) {
  return function (state) {
    const { violations } = state.session;
    if (!violations.includes(kind)) return ok(state);
    const next = {
      ...state,
      session: { ...state.session, violations: violations.filter((v) => v !== kind) },
    };
    return happened(next, message, 'safety-recovered');
  };
}

/**
 * 덮개 유리를 내려놓은 각도로 기포 수가 정해진다.
 * 35°~55° 사이면 0개, 수직(90°)이나 눕힘(0°)에 가까울수록 최대 6개.
 */
export function bubblesFromAngle(angleDeg) {
  const off = Math.abs(angleDeg - 45);
  return Math.round(6 * Math.max(0, Math.min((off - 10) / 45, 1)));
}

/* ------------------------------------------------------------------ */
/* 액션                                                                */
/* ------------------------------------------------------------------ */

export const ACTIONS = {

  /** R-01 바나나 껍질 벗기기 */
  PEEL_BANANA(state) {
    if (state.tools.banana.peeled) return ok(state);
    return ok(withTools(state, { banana: { ...state.tools.banana, peeled: true } }));
  },

  /**
   * R-02 과육을 받침 유리에 문지른다.
   * 두껍게 발라도 막지 않는다 — 시야가 어두워질 뿐이다.
   */
  SMEAR(state, { slide, thickness = 0.3, area = 0.6 }) {
    const s = state.slides[slide];
    if (!state.tools.banana.peeled) {
      return happened(state, '껍질이 벗겨져 있지 않아 과육이 묻지 않았습니다.');
    }
    const next = withSlide(state, slide, { sample: { thickness, area } });
    if (thickness > 0.6) {
      return happened(next, '시료가 두껍게 발렸습니다. 현미경으로 보면 빛이 잘 통과하지 않습니다.', 'too-thick');
    }
    return ok(next);
  },

  /** R-04 스포이트에 용액을 채운다 */
  FILL_DROPPER(state, { reagent }) {
    const d = state.tools.dropper;
    const contaminating = d.holds !== REAGENTS.NONE && d.holds !== reagent;
    const next = withTools(state, { dropper: { holds: reagent, level: 1, rinsed: !contaminating } });
    if (contaminating) {
      return happened(next, '스포이트에 다른 용액이 남아 있는 채로 채웠습니다.', 'cross-contamination');
    }
    return ok(next);
  },

  /** 스포이트 세척 */
  RINSE_DROPPER(state) {
    return ok(withTools(state, { dropper: { holds: REAGENTS.NONE, level: 0, rinsed: true } }));
  },

  /**
   * R-05 용액을 n방울 떨어뜨린다.
   * 방울 수를 검사하지 않는다. 몇 방울이든 받아서 coverage/excess 로 넘긴다.
   */
  DROP(state, { slide, count = 1 }) {
    const s = state.slides[slide];
    const reagent = state.tools.dropper.holds;
    if (reagent === REAGENTS.NONE) {
      return happened(state, '스포이트가 비어 있어 아무것도 떨어지지 않았습니다.');
    }
    if (s.coverslip.placed) {
      return happened(state, '덮개 유리 가장자리로 용액이 스며들었습니다. 고르게 퍼지지 않습니다.', 'edge-seep');
    }
    const drops = s.drops + count;
    const contaminated = s.contaminated || (!state.tools.dropper.rinsed && s.stain && s.stain !== reagent);
    const next = withSlide(state, slide, {
      stain: s.stain ?? reagent,
      drops,
      contaminated,
      reactionT: Math.min(s.reactionT, 0.05),
    });
    if (contaminated) {
      return happened(next, '씻지 않은 스포이트를 썼습니다. 두 용액이 섞였습니다.', 'cross-contamination');
    }
    if (drops === 1) return happened(next, '한 방울이 떨어졌습니다. 용액이 시료 전체에 닿지는 않았습니다.', 'partial');
    if (drops >= 5) return happened(next, '액이 받침 유리 밖으로 흘러넘쳤습니다.', 'overflow');
    if (drops >= 3) return happened(next, '용액이 넉넉히 퍼졌습니다.', 'excess');
    return ok(next);
  },

  /** 시간 경과 — 색 변화 진행 */
  TICK(state, { seconds = 1, speed = 10 }) {
    const slides = { ...state.slides };
    for (const id of Object.keys(slides)) {
      const s = slides[id];
      if (s.stain && s.drops > 0 && s.reactionT < 1) {
        slides[id] = { ...s, reactionT: Math.min(1, s.reactionT + (seconds * speed) / 30) };
      }
    }
    return ok({ ...state, slides });
  },

  /** 핀셋으로 덮개 유리를 집는다 */
  PICK_COVERSLIP(state) {
    return ok(withTools(state, { forceps: { holding: 'coverslip' } }));
  },

  /**
   * R-08 덮개 유리를 덮는다. 각도가 기포를 만든다.
   * 반응이 끝나기 전에 덮어도 막지 않는다 — 아래에서 계속 진행된다.
   */
  PLACE_COVERSLIP(state, { slide, angleDeg = 45 }) {
    const s = state.slides[slide];
    if (state.tools.forceps.holding === 'usedCoverslip') {
      return happened(state, '한 번 쓴 덮개 유리는 다시 쓰지 않습니다. 쓰레기통에 버리고 새것을 집으세요.', 'coverslip-used');
    }
    if (state.tools.forceps.holding !== 'coverslip') {
      // 예전 문구는 "손으로 집으려 하니 미끄러집니다. 핀셋을 쓰세요" 였는데,
      // 여기까지 오는 유일한 길이 **핀셋을 가져다 대는 것**이라 닿을 수 없는 말이었다.
      return happened(state, '핀셋이 비어 있습니다. 덮개 유리를 먼저 집으세요.', 'forceps-empty');
    }
    const bubbles = bubblesFromAngle(angleDeg);
    const next = withTools(
      withSlide(state, slide, { coverslip: { placed: true, angleAtDrop: angleDeg, bubbles } }),
      { forceps: { holding: null } }
    );
    if (bubbles > 0) {
      return happened(next, `기포가 ${bubbles}개 생겼습니다. 45° 기울여 한쪽 끝부터 천천히 내려놓으면 생기지 않습니다.`, 'bubbles');
    }
    // 시약을 떨어뜨린 슬라이드만 색이 변한다.
    // (가) 대조군은 reactionT 가 영원히 0이므로 stain 을 함께 보지 않으면 늘 이르게 덮은 셈이 된다.
    if (s.stain && s.reactionT < 1) {
      return happened(next, '색 변화가 끝나기 전에 덮었습니다. 반응은 덮개 유리 아래에서 계속됩니다.', 'early-cover');
    }
    return ok(next);
  },

  /**
   * R-10 재물대에 슬라이드를 올린다.
   * 덮개 유리가 없어도 올릴 수 있다. 고배율로 보면 렌즈가 시료에 닿는다.
   */
  MOUNT(state, { slide }) {
    const s = state.slides[slide];
    if (s.cracked) {
      return blocked(state, '이 슬라이드는 금이 갔습니다. 새로 만들어야 합니다.', BLOCKING_REASONS.BROKEN);
    }
    const next = withScope(state, { stage: slide });
    if (!s.coverslip.placed) {
      return happened(next, '덮개 유리 없이 올렸습니다. 고배율로 올리면 대물렌즈가 시료에 닿습니다.', 'no-coverslip');
    }
    // 재물대에는 한 장만 올라간다. 바꿔 올려도 토스트를 띄우지 않는다 —
    // 세 장을 차례로 올려 보는 것이 이 실험의 정상 경로이고, 거기에 알림을 달면
    // 제대로 하고 있을 때마다 경고가 뜨는 꼴이 된다.
    // 무엇이 올라가 있는지는 실험대의 내리기 버튼이 이름으로 말한다 (bench.js).
    return ok(next);
  },

  /**
   * 덮은 덮개 유리를 핀셋으로 다시 들어낸다.
   *
   * 기포가 잔뜩 생겼거나 덮는 순서를 틀렸을 때 되돌아갈 길이다.
   *
   * 들어낸 것은 **쓴 덮개 유리**다. 시료가 묻었고 얇아서 닦아 쓰지 않는다 —
   * 실제 실험실에서도 버린다. 핀셋에 물린 채로 남으니 쓰레기통에 버리고 새것을 집는다.
   */
  LIFT_COVERSLIP(state, { slide }) {
    const s = state.slides[slide];
    if (!s.coverslip.placed) {
      return happened(state, '이 받침 유리에는 덮개 유리가 없습니다.');
    }
    const next = withTools(
      withSlide(state, slide, { coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 } }),
      { forceps: { holding: 'usedCoverslip' } }
    );
    return happened(next, '덮개 유리를 들어냈습니다. 한 번 쓴 것이니 쓰레기통에 버리세요.', 'coverslip-lifted');
  },

  /**
   * 더러워진 대물렌즈를 닦는다.
   *
   * 덮개 유리 없이 고배율로 올리면 렌즈가 시료에 닿아 더러워지는데(`SET_OBJECTIVE`),
   * 여태 그걸 되돌릴 길이 없었다. 실제 실험실에서도 렌즈 종이로 닦아 낸다 —
   * 한 번의 실수로 현미경을 못 쓰게 만드는 것은 이 실험이 가르치려는 바가 아니다.
   * 렌즈만 닦는다. 슬라이드에 이미 생긴 일(금, 뭉개진 시료)은 그대로다.
   */
  CLEAN_LENS(state) {
    const dirty = SLIDE_IDS.filter((id) => state.slides[id].lensTouched);
    if (dirty.length === 0) {
      return happened(state, '렌즈는 깨끗합니다.');
    }
    let next = state;
    for (const id of dirty) next = withSlide(next, id, { lensTouched: false });
    return happened(next, '대물렌즈를 닦았습니다. 시야가 다시 맑아집니다.', 'lens-cleaned');
  },

  /** 쓴 덮개 유리를 쓰레기통에 버린다. */
  DISCARD_COVERSLIP(state) {
    if (!state.tools.forceps.holding) {
      return happened(state, '핀셋이 비어 있습니다.');
    }
    return ok(withTools(state, { forceps: { holding: null } }));
  },

  /**
   * 개수대에서 받침 유리를 씻는다.
   *
   * 시료를 너무 두껍게 바르거나 시약을 엉뚱한 데 떨어뜨렸을 때 처음으로 돌아가는 길이다.
   * 이것이 없으면 받침 유리 석 장이 전부인 실험에서 한 번의 실수가 곧 끝이 된다 —
   * 그건 "강제하지 말고 결과로 답한다" 가 아니라 그냥 막다른 길이다.
   * 금이 간 유리도 씻는 것 자체는 막지 않는다 — 씻겨도 금은 그대로 남는다.
   * 여기에 하드 게이트를 하나 더 다는 것보다, 씻고 나서도 여전히 못 쓴다는 것을
   * 눈으로 보는 편이 이 프로젝트의 방식에 맞다.
   */
  RINSE_SLIDE(state, { slide }) {
    const s = state.slides[slide];
    if (s.cracked) {
      return happened(state, '씻어도 금은 그대로입니다. 이 받침 유리는 쓸 수 없습니다.', 'cracked');
    }
    const next = withSlide(state, slide, {
      sample: null, stain: null, drops: 0, reactionT: 0,
      coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 },
      contaminated: false, lensTouched: false,
    });
    return happened(next, '받침 유리를 씻었습니다. 처음부터 다시 만들 수 있습니다.', 'slide-rinsed');
  },

  /**
   * 재물대에서 슬라이드를 내린다.
   *
   * 잘못 올렸을 때 빠져나오는 길이다. 이것이 없으면 되돌리기밖에 방법이 없는데,
   * 되돌리기는 2·3단계에서 횟수가 유한하다 — 실수 한 번이 남은 조작 예산을 깎는 셈이 된다.
   * 실제 실험에서 슬라이드를 도로 집어 드는 것은 아무 대가가 없는 동작이므로 여기서도 그렇다.
   */
  UNMOUNT(state) {
    if (!state.microscope.stage) return ok(state);
    return ok(withScope(state, { stage: null }));
  },

  /**
   * R-11 대물렌즈를 바꾼다.
   * 저배율을 건너뛰어도 막지 않는다. 초점 심도가 얕아 사실상 찾기 어려워질 뿐이다.
   * R-10에서 덮개 유리를 덮지 않았다면 여기서 렌즈가 시료에 닿는다.
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
    return ok(next);
  },

  /**
   * R-12 조동나사.
   * 고배율에서 돌리면 슬라이드가 깨진다. 이것이 허용되는 두 하드 게이트 중 하나다 —
   * 막는 것이 아니라, 이미 벌어진 파손 때문에 그 슬라이드를 더 쓸 수 없는 것이다.
   */
  COARSE_FOCUS(state, { delta }) {
    const m = state.microscope;
    if (m.objective === 40 && m.stage) {
      const next = withScope(withSlide(state, m.stage, { cracked: true }), { stage: null });
      return happened(next, '고배율에서 조동나사를 돌려 슬라이드에 금이 갔습니다. 새로 만들어야 합니다.', 'cracked');
    }
    const coarse = Math.max(-1, Math.min(1, m.coarse + delta));
    let next = withScope(state, { coarse });
    if (Math.abs(coarse + m.fine) < focusTolerance(m.objective)) {
      next = withScope(next, { lowMagFocused: true });
    }
    return ok(next);
  },

  /** R-13 미동나사 — 언제나 안전하다 */
  FINE_FOCUS(state, { delta }) {
    const m = state.microscope;
    const fine = Math.max(-0.2, Math.min(0.2, m.fine + delta));
    let next = withScope(state, { fine });
    if (m.objective <= 10 && Math.abs(m.coarse + fine) < focusTolerance(m.objective)) {
      next = withScope(next, { lowMagFocused: true });
    }
    return ok(next);
  },

  /**
   * 재물대를 옮긴다. 시야를 벗어난 곳은 볼 수 없으므로 ±240 px 로 묶는다.
   * 끝에 닿아도 막지 않는다 — 더 가지 않을 뿐이다.
   */
  MOVE_STAGE(state, { dx = 0, dy = 0 }) {
    const m = state.microscope;
    return ok(withScope(state, {
      panX: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, (m.panX ?? 0) + dx)),
      panY: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, (m.panY ?? 0) + dy)),
    }));
  },

  /** R-14 조리개 */
  SET_DIAPHRAGM(state, { value }) {
    const next = withScope(state, { diaphragm: Math.max(0, Math.min(1, value)) });
    if (brightness(next.microscope) < 0.35) {
      return happened(next, '시야가 어둡습니다. 알갱이 경계가 잘 보이지 않습니다.', 'dark');
    }
    return ok(next);
  },

  /**
   * R-15 결과를 기록한다.
   * 흐린 상도 기록된다. 막지 않는다 — 정리 단계에서 왜 흐렸는지 스스로 설명하게 한다.
   */
  CAPTURE(state) {
    const m = state.microscope;
    if (!m.stage) return happened(state, '재물대에 슬라이드가 없습니다.');
    const s = state.slides[m.stage];
    const capture = {
      slide: m.stage,
      objective: m.objective,
      reagent: s.stain,
      drops: s.drops,
      seed: s.seed,
      focusErr: focusError(m),
      bubbles: s.coverslip.bubbles,
      brightness: brightness(m),
      tooThick: isTooThick(s),
      coverage: coverage(s),
      excess: excess(s),
      at: state.session.captures.length,
    };
    const next = {
      ...state,
      session: { ...state.session, captures: [...state.session.captures, capture] },
    };
    if (capture.focusErr > focusTolerance(m.objective)) {
      return happened(next, '흐린 채로 기록됐습니다. 정리 단계에서 왜 흐렸는지 적게 됩니다.', 'blurry-capture');
    }
    return ok(next);
  },

  /** 안전 규칙 위반 기록. 진행을 막지 않고 자기 평가에 보여 주기만 한다. */
  NOTE_VIOLATION(state, { kind }) {
    return ok({
      ...state,
      session: { ...state.session, violations: [...state.session.violations, kind] },
    });
  },

  /** 손을 씻는다 */
  WASH_HANDS: safetyAction('hands-unwashed', '늦었지만 손을 씻었습니다. 위반 기록에서 지웠습니다.'),

  /** 시약병 마개를 닫는다 */
  CLOSE_CAP: safetyAction('cap-left-open', '늦었지만 마개를 닫았습니다. 위반 기록에서 지웠습니다.'),

  /** 폐액을 처리한다 */
  DISPOSE_WASTE: safetyAction('waste-left', '늦었지만 폐액을 처리했습니다. 위반 기록에서 지웠습니다.'),

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
  //   · UNDO 는 스스로 되감으므로 다시 쌓지 않는다
  //   · 상태를 못 바꾼 액션은 쌓지 않는다. 되돌리기가 헛돌게 된다
  //   · 시간 경과와 시야 둘러보기는 조작이 아니다
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
