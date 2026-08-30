/**
 * 규칙 엔진.
 *
 * 이 프로젝트의 핵심 원칙: **강제하지 말고 결과로 답한다.**
 * 조작을 막는 대신 상태를 바꾸고, 무슨 일이 일어났는지 말한다.
 *
 * 결과 종류는 셋뿐이다:
 *   'ok'       뜻대로 됐다. 무엇이 바뀌었는지만 말한다
 *   'happened' 진행은 됐는데 뜻대로는 아니다. 무슨 일이 일어났는지 말한다
 *   'blocked'  진행되지 않았다. **아래 BLOCKING_REASONS 두 가지에만 허용된다.**
 *
 * 새 'blocked' 를 추가하려면 사람에게 먼저 물어볼 것. AGENTS.md §2.1 참조.
 * docs/04-interaction-rules.md 에 조작표가 있다.
 */

import {
  PH_METHODS, HISTORY_LIMIT, initialBeaker, initialBench,
  beakerConditions, activeConditions, offDesign, defaultControls,
} from './state.js';
import { riseTime, riseProgress, OBSERVE_LIMIT_S } from './kinetics.js';

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시간이 흐르는 것은 학생이 "한" 조작이 아니다. 이걸 쌓으면 1초마다 도는 TICK 이
 * 20칸짜리 기록을 몇 초 만에 밀어내고, 되돌리기 1회짜리 3단계에서는 그 한 번이
 * TICK 을 무르는 데 쓰여 사라진다. 바나나랩에서 실제로 그랬다.
 */
export const TRANSIENT_ACTIONS = new Set([
  'TICK', 'MARK_READ',
]);

/**
 * 연속 조작 — 슬라이더 한 번 끄는 동안 수십 번 디스패치된다.
 * 앞선 액션이 같은 종류면 기록을 새로 쌓지 않는다. 이미 쌓인 것이 끌기 전 상태이기 때문이다.
 */
export const CONTINUOUS_ACTIONS = new Set(['SET_CONTROL', 'SAVE_NOTE']);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음
  BROKEN: 'broken',           // 기구가 파손돼 재제작이 필요함
};

/**
 * 열 충격으로 비커가 깨지는 **냉각** 폭 (℃).
 *
 * 뜨거운 유리를 찬물에 바로 담그면 겉만 급히 줄어들어 깨진다. **식힐 때만 걸린다** —
 * 실온 비커를 끓는 물 수조에 넣는 것은 교실에서 늘 하는 일이고, 물중탕은 서서히 데운다.
 * 데울 때도 걸리게 두었더니 20 → 100 ℃ 라는 **정상 절차가 첫걸음부터 막혔다.**
 *
 * 이 실험에서 `blocked` 가 나오는 **유일한** 자리다. 80 으로 둔 것은 수조 온도
 * (0·20·37·60·100)에서 **100 → 0 · 100 → 20 만** 걸리게 하기 위해서다 —
 * 60 ℃ 에서 0 ℃ 로 옮기는 정도로 깨지면 실험을 하다가 자꾸 막힌다. [모형]
 */
export const THERMAL_SHOCK_DELTA_C = 80;

/**
 * 뜻대로 됐다.
 *
 * 말은 **선택**이다. 시간이 흐르는 것(TICK)처럼 학생이 "했다" 고 느끼지 않는 일에는
 * 붙이지 않는다 — 붙이면 화면이 쉬지 않고 떠든다.
 */
const ok = (state, message = null, tag = null) => ({ state, outcome: 'ok', message, tag });
const happened = (state, message, tag) => ({ state, outcome: 'happened', message, tag: tag ?? null });
const blocked = (state, message, reason) => {
  if (!Object.values(BLOCKING_REASONS).includes(reason)) {
    throw new Error(`허용되지 않은 차단 사유: ${reason}. AGENTS.md §2.1 을 읽으세요.`);
  }
  return { state, outcome: 'blocked', message, reason };
};

/**
 * 조건을 바꿨을 때 재고 있던 시행을 되감는다.
 *
 * ── 왜 되감나 ──────────────────────────────────────────────────────
 * 진행도는 **누적된 시간 전체**에 지금 조건을 곱해 낸다. 그래서 0 ℃ 에서 90 초를
 * 지켜본 뒤 37 ℃ 로 옮기면, 그 90 초가 소급해서 37 ℃ 로 계산돼 **화면에 91 초가 떠 있는데
 * 「8.2 초 걸렸습니다」라고 말했다.** 실제 실험에서도 도중에 조건을 바꾸면 그 시행은
 * 처음부터 다시 재야 한다.
 *
 * **이미 떠오른 뒤에는 되감지 않는다.** 측정이 끝났고, 그때 조건은 `runConditions` 에
 * 얼려 있으므로 뒤에 비커를 옮겨도 기록이 어긋나지 않는다.
 */
function rewindIfRunning(state, next, message) {
  const b = state.bench.beaker;
  if (!b.disc || b.floated) return null;
  return happened(withBeaker(next, {
    disc: null, runConditions: null, elapsedS: 0, floated: false, floatedAtS: null,
  }), message, 'run-restarted');
}

/**
 * 깨진 비커 안내.
 *
 * **어디로 가야 하는지까지 말한다.** 「새것을 쓰세요」로는 어디서 꺼내는지 알 수 없다.
 * 하드 게이트를 둘 때 지켜야 하는 것이다 (AGENTS.md §2.1).
 */
const CRACKED_MESSAGE = '비커에 금이 갔습니다. 선반의 비커 통에서 새 비커를 꺼내세요.';

/* ------------------------------------------------------------------ */
/* 얕은 복사 도우미 — reduce 는 부수효과가 없어야 한다                  */
/* ------------------------------------------------------------------ */

const withBench = (state, patch) => ({ ...state, bench: { ...state.bench, ...patch } });
const withBeaker = (state, patch) => withBench(state, { beaker: { ...state.bench.beaker, ...patch } });
const withDisc = (state, patch) => withBench(state, { disc: { ...state.bench.disc, ...patch } });
const withExtract = (state, patch) => withBench(state, { extract: { ...state.bench.extract, ...patch } });
const withDesign = (state, patch) => ({ ...state, design: { ...state.design, ...patch } });
const withSession = (state, patch) => ({ ...state, session: { ...state.session, ...patch } });

/**
 * 되돌리기용 스냅샷.
 * history 를 비워서 담는다 — 스냅샷 안에 또 history 가 들어가면 지수적으로 커진다.
 */
function snapshot(state) {
  return { ...state, session: { ...state.session, history: [] } };
}

/* ------------------------------------------------------------------ */
/* 액션                                                                */
/* ------------------------------------------------------------------ */

export const ACTIONS = {

  /* ---------------- 변인 설계 ---------------- */

  /**
   * 조작변인을 고른다.
   *
   * 도중에 바꾸는 것도 막지 않는다. 앞서 잰 시행은 그대로 남고, 그래프가 두 갈래로
   * 갈려 비교가 성립하지 않는 것이 눈에 보인다 — 그것이 답이다.
   */
  SET_INDEPENDENT(state, { variable }) {
    if (state.design.independent === variable) return ok(state);
    const next = withDesign(state, { independent: variable });
    if (state.trials.length > 0) {
      return happened(next,
        '조작변인을 바꿨습니다. 앞서 기록한 시행은 다른 변인을 바꾼 것이라 같은 그래프에 이어지지 않습니다.',
        'independent-changed');
    }
    return ok(next, null, 'independent-set');
  },

  /**
   * 통제변인의 목표값을 정한다.
   * 실험 도중에 바꿔도 막지 않는다 — 그 뒤 시행이 앞엣것과 어긋날 뿐이다.
   */
  SET_CONTROL(state, { key, value }) {
    if (!(key in defaultControls())) {
      return happened(state, '그런 조건은 없습니다.');
    }
    if (state.design.controls[key] === value) return ok(state);
    return ok(withDesign(state, { controls: { ...state.design.controls, [key]: value } }),
      null, 'control-set');
  },

  /**
   * 설계를 정했다고 표시한다.
   *
   * **잠금이 아니다.** 안 눌러도 실험은 그대로 된다. 설계 없이 얻은 값이
   * 그래프에서 「무엇을 바꾼 시행인지 알 수 없음」으로 남는 것이 답이다.
   */
  DECLARE_DESIGN(state) {
    if (state.design.declared) return ok(state);
    return ok(withDesign(state, { declared: true }), '실험 설계를 적어 두었습니다.', 'design-declared');
  },

  /* ---------------- 감자즙 ---------------- */

  /** 감자를 갈아 거른다. 물로 희석하면 효소가 그만큼 적다. */
  MAKE_EXTRACT(state, { pct = 100 }) {
    const next = withExtract(state, { pct, boiled: false, ready: true });
    if (state.bench.extract.boiled) {
      return ok(next, `끓인 감자즙을 버리고 새로 만들었습니다 (농도 ${pct} %).`, 'extract-made');
    }
    return ok(next, `감자즙을 만들었습니다 (농도 ${pct} %).`, 'extract-made');
  },

  /**
   * 감자즙을 끓인다.
   *
   * **식혀도 안 돌아온다.** 그래서 「식히기」 액션을 두지 않았다 — 식으면 돌아온다고
   * 배우면 이 실험을 거꾸로 배운 것이다. 되돌아가는 길은 새로 만드는 것이다.
   */
  BOIL_EXTRACT(state) {
    if (!state.bench.extract.ready) {
      return happened(state, '끓일 감자즙이 없습니다. 감자즙을 먼저 만드세요.');
    }
    if (state.bench.extract.boiled) {
      return ok(state, '이 감자즙은 이미 끓인 것입니다.');
    }
    return happened(withExtract(state, { boiled: true }),
      '감자즙을 끓였습니다. 효소가 변성되어 식혀도 돌아오지 않습니다. '
      + '다시 쓰려면 감자즙을 새로 만드세요.', 'extract-boiled');
  },

  /* ---------------- 원반 ---------------- */

  /** 거름종이를 펀치로 뚫는다. 몇 장이든 뚫을 수 있다 — 소모품이 바닥나지 않는다. */
  PUNCH_DISC(state) {
    return ok(withBench(state, {
      disc: { punched: true, soakedPct: 0, soakedBoiled: false, held: false },
    }), '거름종이 원반을 하나 뚫었습니다.', 'disc-punched');
  },

  /**
   * 원반을 감자즙에 담근다.
   *
   * 안 담근 채로 실험하는 것도 막지 않는다. 효소가 없어 안 뜨는 것이 답인데,
   * **완충하지 않은 pH 11 에서는 그래도 뜬다** — 이 실험의 가장 중요한 대조군이다.
   */
  SOAK_DISC(state) {
    const { disc, extract } = state.bench;
    if (!disc.punched) {
      return happened(state, '담글 원반이 없습니다. 거름종이를 펀치로 먼저 뚫으세요.');
    }
    if (!extract.ready) {
      return happened(state, '감자즙이 없어 원반에 아무것도 묻지 않았습니다.');
    }
    const next = withDisc(state, { soakedPct: extract.pct, soakedBoiled: extract.boiled });
    if (extract.boiled) {
      return happened(next, '끓인 감자즙에 원반을 담갔습니다. 효소가 없는 원반입니다.', 'disc-soaked-boiled');
    }
    return ok(next, `원반을 감자즙에 담갔습니다 (농도 ${extract.pct} %).`, 'disc-soaked');
  },

  /** 핀셋으로 원반을 집는다. */
  PICK_DISC(state) {
    if (!state.bench.disc.punched) {
      return happened(state, '집을 원반이 없습니다. 거름종이를 펀치로 먼저 뚫으세요.');
    }
    return ok(withDisc(state, { held: true }), '핀셋으로 원반을 집었습니다.', 'disc-picked');
  },

  /** 원반을 버린다. 되돌아갈 길이다. */
  DISCARD_DISC(state) {
    if (!state.bench.disc.punched) return ok(state, '버릴 원반이 없습니다.');
    return ok(withBench(state, { disc: initialBench().disc }),
      '원반을 버렸습니다. 새로 뚫어서 다시 하세요.', 'disc-discarded');
  },

  /* ---------------- 비커 ---------------- */

  /** 과산화수소수를 붓는다. */
  POUR_H2O2(state, { pct = 3 }) {
    const b = state.bench.beaker;
    if (b.cracked) return blocked(state, CRACKED_MESSAGE, BLOCKING_REASONS.BROKEN);
    const next = withBeaker(state, { h2o2Pct: pct });
    // 재는 도중에 부으면 그 시행은 처음부터 다시 재야 한다. 막지 않고 시계를 되돌린다.
    const rewound = rewindIfRunning(state, next,
      '원반이 들어 있는 비커에 과산화수소수를 더 부었습니다. 이 시행은 처음부터 다시 재야 합니다.');
    if (rewound) return rewound;
    return ok(next, `비커에 ${pct} % 과산화수소수를 부었습니다.`, 'poured');
  },

  /**
   * pH 를 맞춘다.
   *
   * 산·염기를 그대로 부으면 섞이기 전 국소적으로 pH 가 훨씬 높은 자리가 생기고
   * 거기서 분해가 몰아친다. **막지 않는다** — 그 결과를 pH 11 에서 보는 것이 배울 것이다.
   */
  SET_PH(state, { ph, method = PH_METHODS.BUFFER }) {
    const b = state.bench.beaker;
    if (b.cracked) return blocked(state, CRACKED_MESSAGE, BLOCKING_REASONS.BROKEN);
    const next = withBeaker(state, { ph, phMethod: method });
    const rewound = rewindIfRunning(state, next,
      '재는 도중에 pH 를 바꿨습니다. 이 시행은 처음부터 다시 재야 합니다.');
    if (rewound) return rewound;
    if (method === PH_METHODS.ACID_BASE) {
      return happened(next,
        `0.1 M 산·염기로 pH ${ph} 에 맞췄습니다. 완충 용액과 달리 섞이기 전에는 `
        + '국소적으로 pH 가 훨씬 높거나 낮은 자리가 생깁니다.', 'ph-acidbase');
    }
    return ok(next, `완충 용액으로 pH ${ph} 에 맞췄습니다.`, 'ph-buffer');
  },

  /**
   * 비커를 수조에 넣는다.
   *
   * 온도 차가 크면 유리가 깨진다. **깨지는 것 자체는 `happened` 다** — 진행됐고,
   * 그 결과가 파손이다. `blocked` 은 그다음에 그 비커를 쓰려 할 때 나온다.
   */
  PUT_IN_BATH(state, { tempC }) {
    const b = state.bench.beaker;
    if (b.cracked) return blocked(state, CRACKED_MESSAGE, BLOCKING_REASONS.BROKEN);
    // 식힐 때만 깨진다. 데우는 쪽은 물중탕이 서서히 올려 주므로 깨지지 않는다.
    if (b.tempC - tempC >= THERMAL_SHOCK_DELTA_C) {
      return happened(withBeaker(state, { cracked: true, disc: null }),
        `${b.tempC} ℃ 이던 비커를 ${tempC} ℃ 에 바로 담가 유리가 깨졌습니다. `
        + '선반의 비커 통에서 새 비커를 꺼내세요. 뜨거운 비커를 식힐 때는 한 단계씩 옮깁니다.',
        'thermal-shock');
    }
    const next = withBeaker(state, { tempC, inBath: true });
    const rewound = rewindIfRunning(state, next,
      `재는 도중에 비커를 ${tempC} ℃ 수조로 옮겼습니다. 이 시행은 처음부터 다시 재야 합니다.`);
    if (rewound) return rewound;
    return ok(next, `비커를 ${tempC} ℃ 수조에 넣었습니다.`, 'in-bath');
  },

  /** 수조에서 꺼낸다. 실온으로 돌아간다. */
  TAKE_FROM_BATH(state) {
    const b = state.bench.beaker;
    if (!b.inBath) return ok(state, '비커는 수조에 있지 않습니다.');
    const next = withBeaker(state, { inBath: false, tempC: 20 });
    const rewound = rewindIfRunning(state, next,
      '재는 도중에 비커를 수조에서 꺼냈습니다. 이 시행은 처음부터 다시 재야 합니다.');
    if (rewound) return rewound;
    return ok(next, '비커를 수조에서 꺼냈습니다. 실온으로 돌아갑니다.', 'out-of-bath');
  },

  /** 비커를 비운다. 되돌아갈 길이다. 금은 씻어도 남는다. */
  EMPTY_BEAKER(state) {
    const b = state.bench.beaker;
    if (b.cracked) {
      return happened(state,
        '비워도 금은 그대로입니다. 선반의 비커 통에서 새 비커를 꺼내세요.', 'cracked');
    }
    return ok(withBeaker(state, { ...initialBeaker(), tempC: b.tempC, inBath: b.inBath }),
      '비커를 비웠습니다. 처음부터 다시 준비할 수 있습니다.', 'beaker-emptied');
  },

  /** 선반의 비커 통에서 새것을 꺼낸다. 깨졌을 때의 유일한 길이다. */
  NEW_BEAKER(state) {
    const was = state.bench.beaker.cracked;
    const next = withBench(state, { beaker: initialBeaker() });
    if (was) return ok(next, '금 간 비커를 버리고 통에서 새것을 꺼냈습니다.', 'beaker-replaced');
    return ok(next, '새 비커를 꺼냈습니다. 쓰던 비커의 내용물은 사라졌습니다.', 'beaker-replaced');
  },

  /* ---------------- 시행 ---------------- */

  /**
   * 원반을 비커에 넣는다. 시계가 시작된다.
   *
   * 무엇 하나 빠져 있어도 막지 않는다 — 과산화수소수가 없으면 아무 일도 안 일어나고,
   * 감자즙을 안 묻혔으면 효소가 없다. 둘 다 결과가 대답한다.
   */
  DROP_DISC(state) {
    const b = state.bench.beaker;
    const d = state.bench.disc;
    if (b.cracked) return blocked(state, CRACKED_MESSAGE, BLOCKING_REASONS.BROKEN);
    if (!d.punched) {
      return happened(state, '넣을 원반이 없습니다. 거름종이를 펀치로 먼저 뚫으세요.');
    }
    if (b.disc) {
      return happened(state, '비커에 이미 원반이 들어 있습니다. 지금 시행을 기록하거나 비커를 비우세요.');
    }
    const dropped = withBeaker(state, {
      disc: { extractPct: d.soakedPct, extractBoiled: d.soakedBoiled },
      elapsedS: 0, floated: false, floatedAtS: null,
    });
    // **넣는 순간의 조건을 얼려 둔다.** 뒤에 비커를 옮겨도 이미 잰 시간이 남의 조건으로 남지 않는다.
    const next = withBench(
      withBeaker(dropped, { runConditions: beakerConditions(dropped.bench.beaker) }),
      { disc: initialBench().disc },
    );

    if (b.h2o2Pct === null) {
      return happened(next, '빈 비커에 원반을 넣었습니다. 과산화수소수가 없어 아무 일도 일어나지 않습니다.',
        'no-substrate');
    }
    if (d.soakedPct === 0) {
      return happened(next, '감자즙을 묻히지 않은 원반을 넣었습니다. 무슨 일이 일어나는지 보세요.',
        'no-enzyme');
    }
    return ok(next, '원반을 비커에 넣었습니다. 시간을 재기 시작합니다.', 'disc-dropped');
  },

  /**
   * 시간이 흐른다.
   *
   * 진행도가 1 이 되는 순간 원반이 떠오른다. 진행도는 `kinetics.js` 가 낸다 —
   * 여기서 다시 계산하지 않는다. 두 곳에 적으면 어긋난다.
   */
  TICK(state, { seconds = 1 }) {
    const b = state.bench.beaker;
    if (!b.disc || b.floated) return ok(state);
    const elapsedS = b.elapsedS + seconds;
    const conditions = activeConditions(b);
    if (riseProgress(conditions, elapsedS) >= 1) {
      // 떠오른 순간을 정확히 잡는다. 틱 폭만큼 늦게 적으면 시행마다 눈금이 흔들린다.
      //
      // `riseTime()` 이 「안 뜸」이라고 하면 **뜨지 않은 것이다.** 예전에는 그때 `elapsedS` 를
      // 대신 넣었는데, 그러면 관찰 시간을 넘긴 값이 `floated: true` 로 기록될 수 있었다.
      // 지금 틱 폭에서는 닿지 않지만, 틱 폭이나 배속을 건드리는 순간 열리는 문이었다.
      const t = riseTime(conditions);
      if (!t.floated) return ok(withBeaker(state, { elapsedS }));
      return ok(withBeaker(state, { elapsedS, floated: true, floatedAtS: t.seconds }),
        `원반이 떠올랐습니다. ${t.seconds.toFixed(1)} 초 걸렸습니다.`, 'floated');
    }
    return ok(withBeaker(state, { elapsedS }));
  },

  /**
   * 시행을 기록한다.
   *
   * **설계와 어긋난 조건이어도 기록된다.** 어긋난 통제변인의 이름이 `offDesign` 에 담기고,
   * 그래프에서 선에서 떨어져 나온 점으로 보인다. 막지도, 숨기지도, 지우지도 않는다.
   *
   * `at` 은 순번이 아니라 **한 번 붙으면 안 바뀌는 번호**다. 배열 길이를 쓰면
   * 중간 것을 지운 뒤 같은 번호가 다시 붙어, 지운 시행의 노트가 새 시행 칸에 들어간다.
   */
  RECORD_TRIAL(state) {
    const b = state.bench.beaker;
    if (!b.disc) {
      return happened(state, '비커에 원반이 없습니다. 원반을 넣고 시간을 재세요.');
    }
    // **잰 순간의 조건**으로 기록한다. 비커의 지금 조건이 아니다 (state.js 의 runConditions).
    const conditions = activeConditions(b);
    const overLimit = b.elapsedS >= OBSERVE_LIMIT_S;
    if (!b.floated && !overLimit) {
      return happened(state,
        `아직 떠오르지 않았습니다 (${b.elapsedS.toFixed(0)}초). 더 기다리거나, `
        + `${OBSERVE_LIMIT_S}초를 넘기면 「뜨지 않음」으로 기록할 수 있습니다.`, 'still-running');
    }
    // 번호는 **한 번 쓰면 다시 안 쓴다.** 남은 시행에서 최댓값을 뽑으면 마지막 것을 지운 뒤
    // 같은 번호가 다시 붙는다 — 그 번호에 딸린 노트가 새 시행의 것이 된다.
    const at = state.session.trialSeq;
    const trial = {
      at,
      conditions,
      floated: b.floated,
      seconds: b.floated ? b.floatedAtS : null,
      offDesign: offDesign(state.design, conditions),
      independent: state.design.independent,
    };
    const next = withSession({ ...state, trials: [...state.trials, trial] },
      { trialSeq: state.session.trialSeq + 1 });
    if (!b.floated) {
      return happened(next,
        `${OBSERVE_LIMIT_S}초 동안 떠오르지 않았습니다. 「뜨지 않음」으로 기록했습니다.`, 'recorded-nofloat');
    }
    if (trial.offDesign.length > 0) {
      return happened(next,
        `기록했습니다. 다만 통제변인 ${trial.offDesign.length}가지가 설계와 다릅니다 — `
        + '이 점은 그래프에서 다른 시행과 이어지지 않습니다.', 'recorded-offdesign');
    }
    return ok(next, `시행을 기록했습니다. 지금까지 ${next.trials.length}번입니다.`, 'recorded');
  },

  /**
   * 기록을 지운다.
   *
   * 관찰을 무르는 것이 아니다 — **무엇을 근거로 삼을지 고르는 일이다.**
   * `at` 으로 지운다. 배열 인덱스로 지우면 뒤엣것들이 밀려 노트가 남의 것이 된다.
   */
  DELETE_TRIAL(state, { at }) {
    const trials = state.trials.filter((t) => t.at !== at);
    if (trials.length === state.trials.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    // 그 시행에 딸린 노트도 함께 지운다. 남겨 두면 다음에 같은 번호가 붙었을 때
    // 쓴 적 없는 답이 칸에 들어가 있다.
    const notes = { ...state.session.notes };
    delete notes[`trial.${at}`];
    return ok(withSession({ ...state, trials }, { notes }), '기록을 지웠습니다.', 'trial-deleted');
  },

  /* ---------------- 노트 · 안전 · 되돌리기 ---------------- */

  /** 세부 단계별 관찰 기록 */
  SAVE_NOTE(state, { step, text = '' }) {
    if (!step) return happened(state, '어느 단계의 기록인지 알 수 없어 저장하지 않았습니다.');
    return ok(withSession(state, { notes: { ...state.session.notes, [step]: text } }));
  },

  /**
   * 탐구 노트의 한 단계를 읽었다고 표시한다.
   *
   * 실험대는 이것이 다 차야 열린다. 조작을 막는 것이 아니라 **시작하기 전에 무엇을
   * 하려는지 읽게 하는 것**이라, 하드 게이트가 아니다. 열린 뒤에는 어떤 조작도 막지 않는다.
   */
  MARK_READ(state, { stage }) {
    const read = state.session.readStages ?? [];
    if (!stage || read.includes(stage)) return ok(state);
    return ok(withSession(state, { readStages: [...read, stage] }));
  },

  /* 안전 규칙을 **앱이 판정하지 않는다.**
   *
   * 앞서는 손 씻기·마개 닫기·폐액 버리기를 지켜보고 자기 평가에 「지켰다/놓쳤다」를 찍었다.
   * 그런데 가상 실험에서 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다 —
   * 안전 습관이 아니라 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
   *
   * 게다가 그 판정은 **한 번도 돌지 않고 있었다.** `CHECK_TIDY` 도 `NOTE_VIOLATION` 도
   * 부르는 곳이 없어서 `violations` 가 늘 비었고, 자기 평가에는 학생이 무엇을 했든
   * **세 항목 전부 「지켰습니다」**가 찍혔다. 앱이 하지도 않은 판정을 한 척했다.
   *
   * 지금은 **준비물 쪽(2쪽)에 가만히 적힌 안내**만 둔다 (`UI.notebook.valuesList`).
   * 무엇을 지켜보지도, 기록하지도, 보내지도 않는다.
   */

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

  return {
    ...result,
    state: {
      ...result.state,
      session: {
        ...session,
        history,
        // at 은 순번이다. Date.now() 를 쓰면 테스트가 비결정적이 된다.
        log: [...session.log, {
          at: session.log.length, action: action.type, outcome: result.outcome, tag: result.tag ?? null,
        }],
      },
    },
  };
}
