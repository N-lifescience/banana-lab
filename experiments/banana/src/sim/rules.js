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
  REAGENTS, SLIDE_IDS, coverage, excess, focusError, brightness, isTooThick, fieldParams,
  isStaining, initialSlide, HISTORY_LIMIT, PAN_LIMIT,
} from './state.js';
import { focusTolerance, EYEPIECE, OBJECTIVES } from './optics.js';

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
  // 정리했는지 보는 것은 학생이 "한" 조작이 아니다. 되돌릴 것도 아니다.
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
 * 예전에는 말이 없었다. 그런데 조작이 **성공했을 때 화면이 아무 말도 안 하면**, 학생은
 * 방금 누른 것이 먹힌 것인지 아닌지를 그림에서 혼자 읽어내야 한다. 받침 유리 위의
 * 20 mm 짜리 변화는 교실 프로젝터에서 보이지 않는다. 그래서 무엇이 바뀌었는지 말한다.
 *
 * 말은 **선택**이다. 시간이 흐르거나(TICK) 시야를 둘러보는 것(MOVE_STAGE)처럼
 * 학생이 "했다" 고 느끼지 않는 일에는 붙이지 않는다 — 붙이면 화면이 쉬지 않고 떠든다.
 */
const ok = (state, message = null, tag = null) => ({ state, outcome: 'ok', message, tag });

/** 받침 조사. 마지막 글자에 받침이 있으면 '을', 없으면 '를'. 한글이 아니면 '을' 로 둔다. */
const eul = (w) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '을';
  return (c - 0xac00) % 28 ? '을' : '를';
};

/** 토스트에 쓸 짧은 이름. 화면 문구(strings.js)와 같은 표기를 쓴다. */
const SLIDE_NAME = { A: '(가)', B: '(나)', C: '(다)' };
const REAGENT_NAME = {
  WATER: '증류수',
  IKI: '아이오딘–아이오딘화 칼륨 용액',
  SUDAN3: '수단 Ⅲ 용액',
};
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
/**
 * 덮개 유리를 내려놓은 각도로 기포 수가 정해진다.
 * 35°~55° 사이면 0개, 수직(90°)이나 눕힘(0°)에 가까울수록 최대 6개.
 */
export function bubblesFromAngle(angleDeg) {
  const off = Math.abs(angleDeg - 45);
  return Math.round(6 * Math.max(0, Math.min((off - 10) / 45, 1)));
}

/**
 * 슬라이드를 재물대에 올린 직후의 **조동나사 자리**.
 *
 * 4배 허용 범위(`focusTolerance(4)` = 0.30)보다 커서 **저배율에서도 흐리게 시작한다** —
 * 조동나사로 맞추는 것이 첫 일이 되게 하려는 것이다. 조동나사 범위(±1) 안쪽이라 어느 쪽으로
 * 돌려도 닿는다.
 *
 * ── 왜 0 이 아니어야 하는가 (2026-09-03 플레이테스트) ──────────────
 * 앞서는 올린 순간 `coarse = 0` 이라 **이미 초점이 맞아 있었다.** 2·3단계 학생이 나사를
 * 한 번도 안 돌리고 곧장 400배로 올려도 **관찰 가능성 100** 이 나왔고, 그러면서 화면은
 * 빨간 글씨로 「저배율에서 초점을 맞추지 않고 올렸습니다. 초점 맞는 범위가 매우 좁습니다」
 * 라고 나무랐다 — **화면이 저 스스로와 다른 말을 한다.** 시작 화면의 「현미경은 저배율부터
 * 직접 맞춥니다」(2단계 설명)도 사실이 아니었다.
 * 1단계는 실험대(`ui/bench.js`)가 올린 직후 이 값을 도로 0 으로 돌려 초점을 맞춰 준다 —
 * 「1단계는 초점과 배율을 맞춰 놓고 시작합니다」가 그 약속이므로 그대로다.
 * (osmosis 세션이 자기 저장소에서 먼저 고친 자리다)
 */
export const MOUNT_COARSE = 0.45;

/* ------------------------------------------------------------------ */
/* 액션                                                                */
/* ------------------------------------------------------------------ */

export const ACTIONS = {

  /** R-01 바나나 껍질 벗기기 */
  PEEL_BANANA(state) {
    if (state.tools.banana.peeled) return ok(state, '바나나는 이미 껍질이 벗겨져 있습니다.');
    return ok(withTools(state, { banana: { ...state.tools.banana, peeled: true } }),
      '바나나 껍질을 벗겼습니다.', 'peeled');
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
    return ok(next, `${SLIDE_NAME[slide]} 받침 유리에 바나나 과육을 얇게 발랐습니다.`, 'smeared');
  },

  /** R-04 스포이트에 용액을 채운다 */
  FILL_DROPPER(state, { reagent }) {
    const d = state.tools.dropper;
    const contaminating = d.holds !== REAGENTS.NONE && d.holds !== reagent;
    const next = withTools(state, { dropper: { holds: reagent, level: 1, rinsed: !contaminating } });
    if (contaminating) {
      return happened(next, '스포이트에 다른 용액이 남아 있는 채로 채웠습니다.', 'cross-contamination');
    }
    const rn = REAGENT_NAME[reagent] ?? '용액';
    return ok(next, `스포이트에 ${rn}${eul(rn)} 담았습니다.`, 'filled');
  },

  /** 스포이트 세척 */
  RINSE_DROPPER(state) {
    return ok(withTools(state, { dropper: { holds: REAGENTS.NONE, level: 0, rinsed: true } }),
      '스포이트를 헹궜습니다. 안에 남은 용액이 없습니다.', 'rinsed');
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
    // 물은 봉입액이라 `stain` 을 차지하지 않는다. 방울 수만 는다 —
    // 물을 먼저 떨어뜨린 뒤 검출 용액을 쓰면 그만큼 액이 많아지고, 그건 실제로도 그렇다.
    const next = withSlide(state, slide, {
      stain: isStaining(reagent) ? (s.stain ?? reagent) : s.stain,
      drops,
      contaminated,
      reactionT: Math.min(s.reactionT, 0.05),
    });
    if (contaminated) {
      return happened(next, '씻지 않은 스포이트를 썼습니다. 두 용액이 섞였습니다.', 'cross-contamination');
    }
    /*
     * **첫 방울은 실패가 아니다.**
     *
     * 화면의 스포이트는 고무를 누를 때마다 **한 방울씩** 떨어뜨린다 (`src/ui/zoom.js`).
     * 그러니 「두 방울」을 제대로 하는 학생도 **반드시 한 번은 한 방울인 상태**를 지난다.
     * 앞서는 여기서 `happened`(빨강)를 돌려줘서, 정상 경로 한가운데에 빨간 말풍선
     * 「한 방울이 떨어졌습니다. 용액이 시료 전체에 닿지는 않았습니다」가 떴다 —
     * **제대로 하고 있는데 「뜻대로 안 됐다」는 색**을 본다. PLAYTEST.md 가 「회색 문구가
     * 빨간색으로 뜨면 버그」라고 적어 둔 바로 그 모양이다.
     * 2026-09-03 플레이테스트에서 잡았다 (osmosis 가 자기 저장소에서 먼저 고친 자리다).
     *
     * 한 방울에서 **멈추면** 그것은 시야가 답한다 (`coverage` — 절반만 염색된 시야).
     * 다음에 할 일은 `UI.toast.nextAction` 이 아니라 문장 안에 넣는다 — 그 표는 빨간 말에만
     * 붙기 때문이다 (`ui/toast.js` 의 `detail`).
     */
    if (drops === 1) {
      const dn1 = REAGENT_NAME[reagent] ?? '용액';
      return ok(next, `${SLIDE_NAME[slide]}에 ${dn1}${eul(dn1)} 한 방울 떨어뜨렸습니다. `
        + '한 방울 더 떨어뜨려야 시료 전체에 닿습니다.', 'partial');
    }
    if (drops >= 5) {
      return happened(next, `액이 받침 유리 밖으로 흘러넘쳐 실험대에 고였습니다 (${drops}방울). `
        + '덮개 유리가 뜨고, 현미경으로는 색만 짙게 깔려 알갱이가 잘 보이지 않습니다.', 'overflow');
    }
    /*
     * **빨간 말풍선인데 글이 칭찬처럼 읽히면 안 된다.**
     * 「용액이 넉넉히 퍼졌습니다」만 적어 두었더니, 색은 「뜻대로 안 됐다」인데 문장은
     * 잘된 일처럼 읽혔다 — 학생은 색과 글 중 어느 쪽을 믿어야 할지 모른다
     * (`PLAYTEST.md §2` 「회색 문구가 빨간색으로 뜨면 버그」). 색은 그대로 두고,
     * **무슨 일이 일어났는지**를 적는다. 세 방울은 실제로 `excess` 를 올려 시야를 깎는다.
     */
    if (drops >= 3) {
      return happened(next, `${drops}방울이라 용액이 넉넉히 퍼졌습니다. 색이 짙게 깔려 알갱이가 덜 또렷합니다.`, 'excess');
    }
    const dn = REAGENT_NAME[reagent] ?? '용액';
    return ok(next, `${SLIDE_NAME[slide]}에 ${dn}${eul(dn)} ${drops}방울 떨어뜨렸습니다.`, 'dropped');
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
    return ok(withTools(state, { forceps: { holding: 'coverslip' } }),
      '핀셋으로 덮개 유리를 집었습니다.', 'picked');
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
    return ok(next, `${SLIDE_NAME[slide]}에 덮개 유리를 기포 없이 덮었습니다.`, 'covered');
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
    /*
     * 새 슬라이드를 올리면 **초점이 흐트러지고, 대물렌즈는 저배율로 내려온다.**
     *
     * · 초점(`MOUNT_COARSE`) — 새 유리는 두께도 놓인 자리도 다르다. 맞출 것이 있어야
     *   「저배율부터 직접 맞춥니다」(2단계 설명)가 사실이 된다.
     * · 배율 — **저배율로 내리지 않으면 새 유리를 넣을 자리가 없다.** 400배 대물렌즈는
     *   덮개 유리에 거의 닿아 있어서, 그 상태로 유리를 갈아 끼우면 렌즈를 친다
     *   (이 실험은 그 닿음을 `lens-touched` 로 이미 모형화하고 있다).
     *   이것을 안 하면 **덫이 생긴다** — 앞 유리를 400배로 보다가 다음 유리를 올리면
     *   화면은 흐리고, 학생은 조동나사를 돌리고, R-12 로 **올리자마자 깨진다.**
     *   2·3단계 학생은 슬라이드 둘째·셋째마다 그 덫을 밟는다. 1단계는 실험대가
     *   이 순서를 대신 밟아 주고 있었고(`ui/bench.js`), 그 주석이 이미 「저배율로 먼저
     *   내리고, 초점을 맞추고, 그다음 올린다」고 적어 두었다 — 그 순서를 여기로 옮긴다.
     * 미동나사는 그대로 둔다 — 학생이 맞춰 둔 미세 조정까지 지우면 「내가 한 것이 사라졌다」가 된다.
     */
    const next = withScope(state, {
      stage: slide, coarse: MOUNT_COARSE, objective: OBJECTIVES[0], lowMagFocused: false,
    });
    if (!s.coverslip.placed) {
      return happened(next, '덮개 유리 없이 올렸습니다. 고배율로 올리면 대물렌즈가 시료에 닿습니다.', 'no-coverslip');
    }
    // 재물대에는 한 장만 올라간다. 바꿔 올려도 토스트를 띄우지 않는다 —
    // 세 장을 차례로 올려 보는 것이 이 실험의 정상 경로이고, 거기에 알림을 달면
    // 제대로 하고 있을 때마다 경고가 뜨는 꼴이 된다.
    // 무엇이 올라가 있는지는 실험대의 내리기 버튼이 이름으로 말한다 (bench.js).
    return ok(next, `${SLIDE_NAME[slide]} 슬라이드를 재물대에 올렸습니다.`, 'mounted');
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
    return ok(next, '덮개 유리를 들어냈습니다. 한 번 쓴 것이니 쓰레기통에 버리세요.', 'coverslip-lifted');
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
      return ok(state, '렌즈는 깨끗합니다.');
    }
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
      return happened(state, '씻어도 금은 그대로입니다. 받침 유리 통에 대어 새것으로 바꾸세요.', 'cracked');
    }
    const next = withSlide(state, slide, {
      sample: null, stain: null, drops: 0, reactionT: 0,
      coverslip: { placed: false, angleAtDrop: 0, bubbles: 0 },
      contaminated: false, lensTouched: false,
    });
    return ok(next, `${SLIDE_NAME[slide]} 받침 유리를 씻었습니다. 처음부터 다시 만들 수 있습니다.`, 'slide-rinsed');
  },

  /**
   * 받침 유리 통에서 새것을 꺼낸다.
   *
   * 금이 간 유리를 씻는 것으로는 되돌릴 수 없다 — 씻어도 금은 남는다. 그런데 받침 유리가
   * 석 장뿐이라, 금이 세 번 가면 실험이 거기서 끝났다. 막다른 길이지 결과가 아니다.
   * 실제 실험실에서도 받침 유리는 통에 쌓여 있고 깨지면 새것을 꺼낸다.
   *
   * 재물대에 올라가 있던 것이면 함께 내린다 — 통에서 꺼낸 새 유리가 재물대에 있을 수는 없다.
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
    return ok(next, `${SLIDE_NAME[slide]}를 새 받침 유리로 바꿨습니다. 쓰던 것의 시료와 시약은 사라졌습니다.`, 'slide-replaced');
  },

  /**
   * 기록한 결과를 지운다.
   *
   * 결과 기록은 누르는 데 힘이 안 들어서 열 장이 금세 쌓인다. 그중 남기고 싶은 것을 고를
   * 길이 없으면 탐구 노트 「5. 결과」 가 실패작 목록이 되고, 보고서에도 그대로 실린다.
   * 지우는 것은 관찰을 무르는 것이 아니다 — 무엇을 근거로 삼을지 고르는 일이다.
   *
   * `at` 은 캡처가 만들어질 때 한 번 붙는 번호다. 배열 인덱스로 지우면 안 된다 —
   * 앞엣것을 지운 순간 뒤엣것들의 인덱스가 밀려, 배율 답(notes['mag.N'])이 남의 것이 된다.
   */
  DELETE_CAPTURE(state, { at }) {
    const captures = state.session.captures.filter((c) => c.at !== at);
    if (captures.length === state.session.captures.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    // 그 기록에 딸린 배율 답도 함께 지운다. 남겨 두면 다음에 같은 번호가 붙었을 때
    // 쓴 적 없는 답이 칸에 들어가 있다.
    const notes = { ...state.session.notes };
    delete notes[`mag.${at}`];
    return ok(
      { ...state, session: { ...state.session, captures, notes } },
      '기록을 지웠습니다.', 'capture-deleted'
    );
  },

  /**
   * 탐구 노트의 한 단계를 읽었다고 표시한다.
   *
   * 실험대는 이것이 다 차야 열린다 (`src/ui/bench.js`). 조작을 막는 것이 아니라
   * **시작하기 전에 무엇을 하려는지 읽게 하는 것**이라, 하드 게이트(AGENTS.md §2.1)가 아니다.
   * 열린 뒤에는 어떤 조작도 막지 않는다.
   */
  MARK_READ(state, { stage }) {
    const read = state.session.readStages ?? [];
    if (!stage || read.includes(stage)) return ok(state);
    return ok({ ...state, session: { ...state.session, readStages: [...read, stage] } });
  },

  /**
   * 재물대에서 슬라이드를 내린다.
   *
   * 잘못 올렸을 때 빠져나오는 길이다. 이것이 없으면 되돌리기밖에 방법이 없는데,
   * 되돌리기는 2·3단계에서 횟수가 유한하다 — 실수 한 번이 남은 조작 예산을 깎는 셈이 된다.
   * 실제 실험에서 슬라이드를 도로 집어 드는 것은 아무 대가가 없는 동작이므로 여기서도 그렇다.
   */
  UNMOUNT(state) {
    const on = state.microscope.stage;
    // 아무것도 안 올려 뒀는데 내리려 하면 — 말없이 넘기지 않는다. 스무 번을 눌러도
    // 값도 화면도 그대로면 학생은 단추가 고장 난 줄 안다 (AGENTS.md §2.1).
    if (!on) return happened(state, '재물대에 올려 둔 받침 유리가 없습니다.', 'nothing-mounted');
    return ok(withScope(state, { stage: null }),
      `${SLIDE_NAME[on]}를 재물대에서 내렸습니다.`, 'unmounted');
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
    return ok(next, `대물렌즈를 ${objective}배로 바꿨습니다. 접안렌즈 ${EYEPIECE}배와 곱해 총 ${objective * EYEPIECE}배입니다.`, 'objective');
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
      return happened(next, '고배율에서 조동나사를 돌려 받침 유리에 금이 갔습니다. 재물대에서 내려왔습니다 — 쓰레기통이나 받침 유리 통에 대어 새것으로 바꾸세요.', 'cracked');
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
    /*
     * **끝에 닿았는데도 안 맞으면 말한다** (AGENTS.md §2.1 — 막힌 이유와 빠져나갈 길).
     *
     * 미동나사는 ±0.2 까지만 돈다. 초점이 그보다 멀리 어긋나 있으면 **스무 번을 더
     * 돌려도 값도 화면도 그대로**다 — 학생은 나사가 고장 난 줄 안다. 실제로 그랬다:
     * 40배에서 `coarse 1` · `fine 0.2` · 스무 번 · **한 마디도 없음.**
     *
     * 막지는 않는다. 계속 돌 수 있고, 다만 왜 안 되는지와 어디로 가면 되는지를 말한다.
     * 같은 말은 토스트가 겹쳐 띄우지 않으므로 매 번 말해도 화면이 시끄러워지지 않는다.
     * (웨이브 1 의 micrometer 세션이 자기 저장소에서 잡았고, 여기도 똑같았다)
     */
    const atLimit = fine === m.fine && delta !== 0;
    if (atLimit && Math.abs(m.coarse + fine) >= focusTolerance(m.objective)) {
      return happened(next,
        '미동나사가 끝까지 갔습니다. 조동나사로 크게 맞춘 뒤 미동나사로 다듬으세요.',
        'fine-at-limit');
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
    // 기록은 그때 본 시야를 **그대로 다시 그릴 수 있는** 값 한 벌이다.
    // fieldParams 를 통째로 담으므로 탐구 노트가 캡처마다 시야를 되살릴 수 있고,
    // 결과 보드(T06)에 보낼 값도 이것과 같다 — 두 벌을 따로 만들면 어긋난다.
    // `at` 은 순번이 아니라 **한 번 붙으면 안 바뀌는 번호**다.
    // 배열 길이를 쓰면 중간 것을 지운 뒤 같은 번호가 다시 붙어, 지운 기록의 배율 답이
    // 새 기록 칸에 들어간다 (DELETE_CAPTURE 참조).
    const nextAt = state.session.captures.reduce((n, c) => Math.max(n, (c.at ?? -1) + 1), 0);
    const capture = {
      slide: m.stage,
      drops: s.drops,
      at: nextAt,
      eyepiece: EYEPIECE,
      ...fieldParams(state, m.stage),
    };
    const next = {
      ...state,
      session: { ...state.session, captures: [...state.session.captures, capture] },
    };
    if (capture.focusErr > focusTolerance(m.objective)) {
      return happened(next, '흐린 채로 기록됐습니다. 정리 단계에서 왜 흐렸는지 적게 됩니다.', 'blurry-capture');
    }
    return ok(next, `${SLIDE_NAME[m.stage]} 시야를 기록했습니다. 지금까지 ${next.session.captures.length}장입니다.`, 'captured');
  },

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
