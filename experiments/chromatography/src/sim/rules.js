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
  MARKERS, LEAF_KINDS, HISTORY_LIMIT,
  initialPaper, initialTube, initialVial,
  extractStrength, isSettled, isSubmerged, currentFrontMm, frontOverrun, stripParams,
} from './state.js';
import {
  ORIGIN_MM, ORIGIN_RANGE_MM, PAPER_H_MM, MAX_DEPTH_MM,
  MIN_SPOT_MM, MAX_SPOT_MM,
} from './develop.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시간이 흐르는 것과 눈금을 대어 보는 것은 학생이 "한" 조작이 아니다.
 * 이걸 쌓으면 1초마다 도는 TICK 이 20칸짜리 기록을 몇 초 만에 밀어내고,
 * 되돌리기 1회짜리 3단계에서는 그 한 번이 TICK 을 무르는 데 쓰여 사라진다.
 */
export const TRANSIENT_ACTIONS = new Set([
  'TICK',
  // 탐구 노트의 어느 쪽을 읽었는지는 학생이 "한" 조작이 아니다.
  'MARK_READ',
]);

/**
 * 연속 조작 — 슬라이더 한 번 끄는 동안 수십 번 디스패치된다.
 * 앞선 액션이 같은 종류면 기록을 새로 쌓지 않는다. 이미 쌓인 것이 끌기 전 상태이기 때문이다.
 * 그래서 되돌리기 한 번이 "끌기 전" 으로 돌아간다. 눈금 하나씩 무르는 것은 뜻이 없다.
 */
export const CONTINUOUS_ACTIONS = new Set(['SHAKE', 'POUR_SOLVENT', 'SAVE_NOTE']);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음 (닫힌 뚜껑 안으로 물체 넣기)
  BROKEN: 'broken',           // 기구가 파손돼 재제작이 필요함
};

/**
 * 뜻대로 됐다.
 *
 * 말은 **선택**이다. 시간이 흐르는 것(TICK)처럼 학생이 "했다" 고 느끼지 않는 일에는
 * 붙이지 않는다 — 붙이면 화면이 쉬지 않고 떠든다. 다만 조작이 성공했을 때 화면이 아무 말도
 * 안 하면, 학생은 방금 누른 것이 먹혔는지를 그림에서 혼자 읽어내야 한다.
 * 거름종이 위의 2 mm 짜리 변화는 교실 프로젝터에서 보이지 않는다.
 */
const ok = (state, message = null, tag = null) => ({ state, outcome: 'ok', message, tag });

/** 진행은 됐는데 뜻대로는 아니다. **이 실험의 대부분이 여기다.** */
const happened = (state, message, tag = null) => ({ state, outcome: 'happened', message, tag });

/**
 * 진행되지 않았다.
 *
 * **메시지에 빠져나갈 길을 담는다.** 「새것을 꺼내세요」로는 어디서 꺼내는지 알 수 없다.
 * 어디로 가야 하는지까지 말한다 — `tests/rules.test.js` 가 이것을 검사한다.
 */
const blocked = (state, message, reason) => {
  if (!Object.values(BLOCKING_REASONS).includes(reason)) {
    throw new Error(`허용되지 않은 차단 사유: ${reason}. AGENTS.md §2.1 을 읽으세요.`);
  }
  return { state, outcome: 'blocked', message, reason };
};

/** 얕은 복사로 불변성을 지킨다. reduce 는 부수효과가 없어야 한다. */
const withPaper = (state, patch) => ({ ...state, paper: { ...state.paper, ...patch } });
const withTube = (state, patch) => ({ ...state, tube: { ...state.tube, ...patch } });
const withVial = (state, patch) => ({ ...state, vial: { ...state.vial, ...patch } });
const withTools = (state, patch) => ({ ...state, tools: { ...state.tools, ...patch } });

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

  /**
   * R-01 잎을 원심관에 넣는다.
   * 시든 잎도 막지 않는다 — 색소가 적어 띠 넷이 다 흐릴 뿐이다.
   */
  ADD_LEAF(state, { kind = LEAF_KINDS.FRESH, amount = 0.5 }) {
    const t = state.tube;
    const fresh = kind === LEAF_KINDS.WILTED ? 0.35 : 1;
    const leaf = clamp01(t.leaf + amount);
    // 여러 번 나눠 넣으면 신선도가 섞인다. 양으로 가중한다.
    const leafFresh = t.leaf > 0
      ? (t.leafFresh * t.leaf + fresh * amount) / (t.leaf + amount)
      : fresh;
    // 잎을 더 넣으면 이미 뽑아 둔 것과 섞인다. 흔들기를 다시 해야 한다.
    const next = withTube(state, { leaf, leafFresh, shaken: t.leaf > 0 ? t.shaken * 0.5 : 0, settleT: 0 });
    if (kind === LEAF_KINDS.WILTED) {
      return happened(next, '시든 잎을 넣었습니다. 엽록소는 빛에 쉽게 파괴돼서, 시든 잎에서는 뽑을 색소가 적습니다.', 'wilted-leaf');
    }
    return ok(next, '신선한 시금치 잎을 원심관에 넣었습니다.', 'leaf-added');
  },

  /**
   * 어느 잎을 집을지 고른다.
   *
   * 신선한 잎과 시든 잎을 **학생이 정한다.** 화면이 알아서 신선한 것을 집어 주면
   * "왜 신선한 시료를 쓰는가" 라는 이 실험의 변인이 학생 손을 떠난다 (PLAYBOOK §4).
   */
  PICK_LEAF(state, { kind }) {
    const next = kind === LEAF_KINDS.WILTED ? LEAF_KINDS.WILTED : LEAF_KINDS.FRESH;
    if (state.tools.leafKind === next) return ok(state);
    const patched = withTools(state, { leafKind: next });
    if (next === LEAF_KINDS.WILTED) {
      return happened(patched, '시든 잎을 집었습니다. 엽록소는 빛에 쉽게 파괴돼서, 시든 잎에서는 뽑을 색소가 적습니다.', 'wilted-leaf');
    }
    return ok(patched, '신선한 시금치 잎을 집었습니다.', 'leaf-picked');
  },

  /**
   * R-02 추출액(메탄올:아세톤 = 3:1)을 넣는다.
   * 많이 넣어도 막지 않는다 — 상층액이 묽어져 띠가 흐려질 뿐이다.
   */
  ADD_EXTRACT(state, { amount = 0.5 }) {
    const t = state.tube;
    const extract = clamp01(t.extract + amount);
    const next = withTube(state, { extract, settleT: 0 });
    if (t.leaf <= 0) {
      return happened(next, '원심관에 잎이 없습니다. 추출액만 들어갔습니다.', 'no-leaf');
    }
    if (t.leaf > 0 && extract > t.leaf * 2) {
      return happened(next, '추출액이 잎에 비해 많습니다. 상층액이 묽어져 띠가 흐리게 나옵니다.', 'diluted');
    }
    return ok(next, '추출액(메탄올:아세톤 = 3:1)을 원심관에 넣었습니다.', 'extract-added');
  },

  /** R-03 원심관을 흔든다. 덜 흔들면 추출이 덜 된다. */
  SHAKE(state, { amount = 0.2 }) {
    const t = state.tube;
    if (t.leaf <= 0 || t.extract <= 0) {
      return happened(state, '원심관에 잎과 추출액이 둘 다 있어야 색소가 나옵니다.', 'nothing-to-shake');
    }
    const shaken = clamp01(t.shaken + amount);
    // 흔들면 층이 다시 섞인다. 실제로도 그렇다.
    const next = withTube(state, { shaken, settleT: 0 });
    /*
     * **다 뽑힌 뒤에도 계속 흔들면 아무 일도 안 일어난다 — 그런데 아무 말도 없었다.**
     *
     * `shaken` 은 1 에서 멈춘다. 재어 보니 다섯 번이면 「뽑힌 정도」가 끝까지 간다.
     * 그 뒤로 서른 번을 더 흔들어도 값도 안 변하고 문구도 안 나왔다.
     * **바이알 확대 화면에는 눈금이 있어서 멈춘 것이 보이지만, 실험대에서 흔들 때는
     * 그 눈금이 없다.** 학생 눈에는 고장이다.
     *
     * **막지 않는다.** 계속 흔들 수 있다 — 층이 다시 섞이는 것은 실제로 일어나는 일이다.
     * 끝에 닿는 **그 순간 한 번만** 말한다. 매번 말하면 잔소리가 되고,
     * 그러면 학생이 문구 자체를 안 읽는다.
     */
    if (t.shaken < 1 && shaken >= 1) {
      return ok(next, '색소가 다 뽑혔습니다. 더 흔들어도 진해지지 않습니다 — 가라앉기를 기다렸다가 윗층을 씁니다.', 'shaken-full');
    }
    return ok(next, null, 'shaken');
  },

  /** 원심관을 비운다 — 잘못 만든 추출액에서 빠져나오는 길 */
  EMPTY_TUBE(state) {
    if (state.tube.leaf <= 0 && state.tube.extract <= 0) {
      return ok(state, '원심관은 이미 비어 있습니다.');
    }
    return ok({ ...state, tube: initialTube() },
      '원심관을 폐액통에 비웠습니다. 처음부터 다시 뽑을 수 있습니다.', 'tube-emptied');
  },

  /**
   * 시간 경과. 층 분리 · 전개 · 건조 · 빛에 의한 엽록소 파괴가 전부 여기서 진행된다.
   *
   * 이 액션만은 **화면이 시계를 띄우지 않는다.** 실제 소요 시간은 `[확인 필요]` 라
   * 지어낼 수 없고, 절차가 보라고 한 것은 시간이 아니라 전선의 높이다 (develop.js).
   */
  TICK(state, { seconds = 1, speed = 10 }) {
    const dt = seconds * speed;
    const t = state.tube;
    let next = state;

    // 층 분리 — 흔들어 둔 것이 갈린다
    if (t.leaf > 0 && t.extract > 0 && t.shaken > 0 && t.settleT < 1) {
      next = withTube(next, { settleT: clamp01(t.settleT + dt / 120) });
    }

    const p = next.paper;
    if (p.inVial && next.vial.depthMm > 0) {
      const patch = { runT: p.runT + dt, wetness: clamp01(p.wetness + dt / 30) };
      // 원점이 잠기면 색소가 전개액에 풀려 나간다. 올라가는 것이 아니라 사라진다.
      if (isSubmerged(p, next.vial)) patch.washedOut = clamp01(p.washedOut + dt / 60);
      // 뚜껑을 안 덮으면 빛이 그대로 든다. 엽록소 두 가지가 먼저 옅어진다.
      if (!next.vial.capped) patch.lightDose = clamp01(p.lightDose + dt / 400);
      next = withPaper(next, patch);
      /*
       * **전선이 종이 끝까지 올라간 순간을 말해 준다.**
       *
       * 이 실험은 **시계를 안 띄운다**(카드 규칙 — 재는 것은 학생이다). 그런데 진행 표시도
       * 없다 (`runProgress` 는 어디서도 안 쓰인다). 그래서 종이를 세워 두고 나면
       * **끝났는지 알 길이 확대해서 들여다보는 것뿐**이었다.
       * 재어 보니 90초에 전선이 종이 끝(100 mm)에 닿고, 그 뒤 57번을 더 기다려도
       * 값도 문구도 그대로였다.
       *
       * 여기서 멈춰 세우지 않는다 — 더 두면 전선이 끝을 넘어가 **전개율의 분모를 못 재게**
       * 되는데, 그것도 학생이 겪어야 하는 결과다. 다만 **닿는 순간 한 번** 말해 준다.
       * 빠져나갈 길(꺼내서 전선을 표시한다)을 문장에 담는다.
       */
      if (currentFrontMm(p) < PAPER_H_MM && currentFrontMm(next.paper) >= PAPER_H_MM) {
        return ok(next, '용매 전선이 종이 끝까지 올라갔습니다. 이제 꺼내서 전선 자리를 표시하세요.', 'front-at-end');
      }
    } else if (p.wetness > 0 || p.spotWet > 0) {
      next = withPaper(next, {
        wetness: clamp01(p.wetness - dt / 45),
        spotWet: clamp01(p.spotWet - dt / 12),
      });
    }
    return ok(next);
  },

  /**
   * R-04 원점 선을 긋는다.
   *
   * 볼펜으로 그어도 막지 않는다 — 잉크의 염료가 함께 전개돼 **가짜 띠**가 생긴다.
   * 연필로 그으라는 절차가 왜 있는지를 그 가짜 띠가 설명한다.
   */
  DRAW_ORIGIN(state, { heightMm = ORIGIN_MM, marker = MARKERS.PENCIL }) {
    const [lo, hi] = ORIGIN_RANGE_MM;
    const originMm = clamp(heightMm, lo, hi);
    const next = withPaper(state, { originMm, marker });
    const where = `아래에서 ${originMm.toFixed(0)} mm`;
    if (marker === MARKERS.PEN) {
      return happened(next, `볼펜으로 원점 선을 그었습니다(${where}). 잉크도 전개액에 녹아 함께 올라갑니다.`, 'pen-origin');
    }
    // 절차의 값은 25 mm 다. 그 언저리를 정상으로 보고, 벗어나면 무슨 일이 일어나는지 말한다.
    // **막지는 않는다** — 낮게 그으면 잠기고, 높게 그으면 올라갈 거리가 짧아질 뿐이다.
    if (originMm < 15) {
      return happened(next, `원점을 너무 낮게 그었습니다(${where}). 전개액에 잠기기 쉽습니다.`, 'origin-low');
    }
    if (originMm > 33) {
      return happened(next, `원점을 높게 그었습니다(${where}). 색소가 올라갈 거리가 그만큼 짧아집니다.`, 'origin-high');
    }
    return ok(next, `연필로 원점 선을 그었습니다(${where}).`, 'origin-drawn');
  },

  /**
   * R-05 모세관에 상층액을 묻힌다.
   * 층이 갈리기 전에 뽑아도 막지 않는다 — 잎 부스러기가 딸려 온다.
   */
  LOAD_CAPILLARY(state) {
    const t = state.tube;
    const strength = extractStrength(t);
    if (strength <= 0) {
      return happened(state, '뽑을 색소가 없습니다. 원심관에 잎과 추출액을 넣고 흔드세요.', 'no-extract');
    }
    const settled = isSettled(t);
    const grit = settled ? 0 : clamp01(1 - t.settleT);
    const next = withTools(withTube(state, { drawn: t.drawn + 1 }), {
      capillary: { strength, grit },
    });
    if (!settled) {
      return happened(next, '층이 갈리기 전에 뽑았습니다. 잎 부스러기가 함께 딸려 왔습니다.', 'unsettled');
    }
    return ok(next, '모세관에 상층액을 묻혔습니다.', 'capillary-loaded');
  },

  /** 모세관을 헹군다 — 잘못 묻혔을 때 되돌아가는 길 */
  RINSE_CAPILLARY(state) {
    return ok(withTools(state, { capillary: { strength: 0, grit: 0 } }),
      '모세관을 헹궜습니다. 안에 남은 것이 없습니다.', 'capillary-rinsed');
  },

  /**
   * R-06 원점에 찍는다.
   *
   * 횟수를 검사하지 않는다. 몇 번이든 받아서 `load` 로 넘긴다.
   * 한 번에 오래 대면 원점이 커지고, 마르기 전에 겹쳐 찍어도 커진다 —
   * 커진 원점은 굵은 띠가 되어 이웃과 겹친다. 이 실험에서 가장 흔한 실패다.
   */
  SPOT(state, { dwell = 0.2 }) {
    const p = state.paper;
    const c = state.tools.capillary;
    if (c.strength <= 0) {
      return happened(state, '모세관이 비어 있습니다. 원심관의 상층액을 먼저 묻히세요.', 'capillary-empty');
    }
    // 원점 선을 안 그었어도 찍힌다. 다만 나중에 **어디서부터 쟀는지** 표시가 남지 않는다.
    const originMm = p.originMm ?? ORIGIN_MM;
    // **말리고 다시 찍으면 원점은 커지지 않는다.** 절차가 그렇게 하라고 하는 이유가 이것이다.
    // 커지는 것은 (가) 한 번에 오래 댔을 때와 (나) 마르기 전에 겹쳐 찍었을 때뿐이다.
    const dwellPenalty = Math.max(0, dwell - 0.3) * 6;
    const wetPenalty = p.spotWet > 0.3 ? 2.2 * p.spotWet : 0;
    const spotMm = clamp(p.spotMm + dwellPenalty + wetPenalty, MIN_SPOT_MM, MAX_SPOT_MM);
    // 10~20 번 찍으면 넉넉히 실린다. 다섯 번이면 흐리다 — 절차의 "10~20회" 가 여기 대응한다.
    const gained = c.strength * (0.055 + dwell * 0.03);
    const next = withPaper(state, {
      originMm,
      spots: p.spots + 1,
      spotMm,
      spotWet: clamp01(p.spotWet + 0.5 + dwell * 0.5),
      load: clamp01(p.load + gained),
      grit: clamp01(p.grit + c.grit * 0.15),
    });
    if (p.originMm === null) {
      return happened(next, '원점 선을 긋지 않고 찍었습니다. 자국은 남지만, 나중에 어디서부터 쟀는지 알 수 없습니다.', 'no-origin-line');
    }
    if (wetPenalty > 0) {
      return happened(next, '원점이 마르기 전에 겹쳐 찍었습니다. 자국이 번져 커졌습니다.', 'spot-smeared');
    }
    if (dwellPenalty > 0) {
      return happened(next, '모세관을 오래 댔습니다. 원점이 커져 띠가 굵게 나옵니다.', 'spot-wide');
    }
    return ok(next, `원점에 찍었습니다. 지금까지 ${next.paper.spots}번입니다.`, 'spotted');
  },

  /** 원점을 말린다. 절차가 "말리고 다시 찍는다" 인 이유가 여기 있다. */
  DRY_SPOT(state) {
    if (state.paper.spotWet <= 0) return ok(state, '원점은 이미 말라 있습니다.');
    return ok(withPaper(state, { spotWet: 0 }), '원점을 말렸습니다. 겹쳐 찍어도 번지지 않습니다.', 'spot-dried');
  },

  /**
   * 거름종이 통에서 새것을 꺼낸다.
   *
   * 찢어진 종이에서 빠져나오는 유일한 길이자, 잘못 찍은 원점을 되돌리는 길이다.
   * 통에 넉넉히 들어 있어 바닥나지 않는다 — 소모품이 바닥나면 그건 결과가 아니라 막다른 길이다.
   */
  NEW_PAPER(state) {
    const used = state.tools.papersUsed + 1;
    const fresh = initialPaper(state.paper.seed + used * 977);
    let next = withTools({ ...state, paper: fresh }, { papersUsed: used });
    if (state.vial.hasPaper) next = withVial(next, { hasPaper: false });
    return ok(next, '거름종이 통에서 새 거름종이를 꺼냈습니다. 원점부터 다시 시작합니다.', 'paper-replaced');
  },

  /**
   * R-07 바이알에 전개액(석유에터:아세톤 = 9:1)을 붓는다.
   *
   * 많이 부어도 막지 않는다. 원점이 잠기면 색소가 전개액에 풀려 나가 **띠가 아예 없다.**
   */
  POUR_SOLVENT(state, { mm = 5 }) {
    const depthMm = clamp(state.vial.depthMm + mm, 0, MAX_DEPTH_MM);
    const next = withVial(state, { depthMm });
    const origin = state.paper.originMm ?? ORIGIN_MM;
    if (depthMm >= origin) {
      return happened(next, `전개액이 ${depthMm.toFixed(0)} mm 로 원점(${origin.toFixed(0)} mm)보다 높습니다. 종이를 세우면 원점이 잠깁니다.`, 'solvent-deep');
    }
    return ok(next, `전개액을 부었습니다. 깊이 ${depthMm.toFixed(0)} mm 입니다.`, 'solvent-poured');
  },

  /** 바이알을 비운다 — 너무 많이 부었을 때 되돌아가는 길 */
  EMPTY_VIAL(state) {
    if (state.vial.depthMm <= 0 && !state.vial.hasPaper) {
      return ok(state, '바이알은 이미 비어 있습니다.');
    }
    const next = { ...state, vial: initialVial() };
    return ok(state.paper.inVial ? withPaper(next, { inVial: false }) : next,
      '바이알의 전개액을 폐액통에 비웠습니다.', 'vial-emptied');
  },

  /** 바이알 뚜껑을 덮는다. 용매가 날아가지 않고, 빛도 막는다. */
  CAP_VIAL(state) {
    if (state.vial.capped) return ok(state, '바이알 뚜껑은 이미 덮여 있습니다.');
    return ok(withVial(state, { capped: true }),
      '바이알 뚜껑을 덮었습니다. 용매가 날아가지 않고 빛도 들지 않습니다.', 'vial-capped');
  },

  /** 바이알 뚜껑을 연다 */
  UNCAP_VIAL(state) {
    if (!state.vial.capped) return ok(state, '바이알 뚜껑은 이미 열려 있습니다.');
    return ok(withVial(state, { capped: false }), '바이알 뚜껑을 열었습니다.', 'vial-uncapped');
  },

  /**
   * R-08 거름종이를 바이알에 세운다.
   *
   * **하드 게이트 1** — 뚜껑이 닫혀 있으면 안으로 넣을 수 없다. 물리적으로 성립하지 않는다.
   * 원점이 잠기게 세우는 것은 막지 않는다. 그건 성립하는 동작이고, 결과가 답한다.
   */
  INSERT_PAPER(state) {
    if (state.vial.capped) {
      return blocked(state, '바이알 뚜껑이 닫혀 있어 종이를 넣을 수 없습니다. 바이알을 눌러 열리는 화면에서 「뚜껑 열기」를 먼저 누르세요.',
        BLOCKING_REASONS.IMPOSSIBLE);
    }
    if (state.paper.torn) {
      return blocked(state, '찢어진 거름종이는 세울 수 없습니다. 선반의 거름종이 통에서 새것을 꺼내세요.',
        BLOCKING_REASONS.BROKEN);
    }
    const p = state.paper;
    // runT 를 0 으로 되돌리지 않는다. 꺼냈다 다시 세우면 전개는 이어진다 —
    // 되돌리면 이미 절반 오른 전선이 바닥으로 내려가는 그림이 된다.
    const next = withVial(withPaper(state, { inVial: true, depthAtRun: state.vial.depthMm }), { hasPaper: true });
    if (state.vial.depthMm <= 0) {
      return happened(next, '바이알에 전개액이 없습니다. 종이는 젖지 않고 그대로 서 있습니다.', 'no-solvent');
    }
    const origin = p.originMm ?? ORIGIN_MM;
    if (state.vial.depthMm >= origin) {
      return happened(next, '원점이 전개액에 잠겼습니다. 색소가 종이를 타고 오르는 대신 전개액에 풀려 나갑니다.', 'origin-submerged');
    }
    if (p.spots === 0) {
      return happened(next, '아무것도 찍지 않은 종이를 세웠습니다. 전개액은 오르지만 갈라질 색소가 없습니다.', 'no-spots');
    }
    return ok(next, '거름종이를 바이알에 세웠습니다. 전개액이 오르기 시작합니다.', 'paper-inserted');
  },

  /**
   * R-09 거름종이를 꺼낸다.
   * 너무 일찍 꺼내도, 너무 늦게 꺼내도 막지 않는다 — 종이가 답한다.
   */
  REMOVE_PAPER(state) {
    const p = state.paper;
    if (!p.inVial) return happened(state, '거름종이는 바이알에 들어 있지 않습니다.');
    const next = withVial(withPaper(state, { inVial: false }), { hasPaper: false });
    if (frontOverrun(p)) {
      return happened(next, '전개액이 종이 끝을 넘어갔습니다. 용매 전선이 어디였는지 알 수 없어 전개율을 잴 수 없습니다.', 'front-overrun');
    }
    const front = currentFrontMm(p);
    const origin = p.originMm ?? ORIGIN_MM;
    if (front - origin < (PAPER_H_MM - origin) * 0.3) {
      return happened(next, '너무 일찍 꺼냈습니다. 색소가 원점 가까이 뭉쳐 아직 갈라지지 않았습니다.', 'too-early');
    }
    return ok(next, '거름종이를 꺼냈습니다. 마르기 전에 용매 전선을 먼저 표시하고, 재는 것은 말린 뒤에 하세요 — 젖은 종이에 자를 대면 찢어집니다.', 'paper-removed');
  },

  /**
   * R-10 용매 전선을 연필로 표시한다.
   *
   * 마르면 전선이 사라진다. 꺼내자마자 표시하라는 절차가 왜 있는지를 이것이 설명한다.
   */
  MARK_FRONT(state) {
    const p = state.paper;
    if (frontOverrun(p)) {
      return happened(state, '전선이 종이 끝을 넘어가 표시할 자리가 없습니다. 전개율의 분모를 잃었습니다.', 'front-overrun');
    }
    if (p.wetness <= 0.15) {
      return happened(state, '전개액이 말라 전선이 어디였는지 알 수 없습니다. 다음에는 꺼내자마자 표시하세요.', 'front-dried');
    }
    const front = currentFrontMm(p);
    return ok(withPaper(state, { markedFront: front }),
      '용매 전선을 연필로 표시했습니다.', 'front-marked');
  },

  /**
   * 거름종이를 말린다.
   *
   * TICK 으로도 마르지만, 그러면 "말린다" 가 학생이 하는 일이 아니라 기다리는 일이 된다.
   * 절차에 있는 단계는 절차에 있는 대로 손으로 하게 둔다.
   * **용매 전선을 표시하기 전에 말리면 전선을 잃는다** — 그것도 결과가 답한다.
   */
  DRY_PAPER(state) {
    const p = state.paper;
    if (p.inVial) {
      return happened(state, '바이알 안에서는 마르지 않습니다. 먼저 꺼내세요.', 'still-in-vial');
    }
    if (p.wetness <= 0) return ok(state, '거름종이는 이미 말라 있습니다.');
    const next = withPaper(state, { wetness: 0, spotWet: 0 });
    if (p.markedFront === null && p.runT > 0) {
      return happened(next, '용매 전선을 표시하기 전에 말렸습니다. 전선이 사라져 전개율의 분모를 잃었습니다.', 'front-lost');
    }
    return ok(next, '거름종이를 말렸습니다. 이제 자를 대도 찢어지지 않습니다.', 'paper-dried');
  },

  /** R-11 색소 위치를 표시한다. 젖어 있으면 연필 자국이 번진다. */
  MARK_BANDS(state) {
    const p = state.paper;
    // 원점이 잠겨 씻겨 나간 것과 덜 찍은 것은 **고쳐야 할 것이 다르다.** 한 태그로 묶었더니
    // 원점을 잠근 학생에게 「더 여러 번 찍으세요」가 갔다 (플레이테스트 실패 경로 A).
    if (p.washedOut >= 1) {
      return happened(state, '원점이 전개액에 잠겨 색소가 씻겨 나갔습니다. 표시할 색 띠가 없습니다.', 'origin-submerged');
    }
    if (p.load <= 0) {
      return happened(state, '표시할 색 띠가 없습니다.', 'no-bands');
    }
    const next = withPaper(state, { markedBands: true });
    if (p.wetness > 0.5) {
      return happened(next, '아직 젖어 있어 연필 자국이 번집니다. 조금 말린 뒤에 표시하는 편이 낫습니다.', 'marks-smeared');
    }
    return ok(next, '색 띠의 위치를 표시했습니다.', 'bands-marked');
  },

  /**
   * R-12 자를 대어 거리를 잰다.
   *
   * **하드 게이트 2** — 젖은 거름종이에 자를 대면 찢어진다. 실제로 그렇다.
   * 막는 것이 아니라, 이미 벌어진 파손 때문에 그 종이를 더 쓸 수 없는 것이다.
   */
  MEASURE(state) {
    const p = state.paper;
    if (p.torn) {
      return blocked(state, '찢어진 거름종이는 잴 수 없습니다. 선반의 거름종이 통에서 새것을 꺼내세요.',
        BLOCKING_REASONS.BROKEN);
    }
    if (p.wetness > 0.6) {
      return blocked(withPaper(state, { torn: true, rulerPlaced: false }),
        '젖은 거름종이에 자를 대자 찢어졌습니다. 선반의 거름종이 통에서 새것을 꺼내세요. 다음에는 말린 뒤에 재세요.',
        BLOCKING_REASONS.BROKEN);
    }
    return ok(withPaper(state, { rulerPlaced: true }),
      '거름종이에 자를 댔습니다. 원점에서 용매 전선까지, 원점에서 띠까지를 읽으세요.', 'ruler-placed');
  },

  /** 자를 치운다 */
  LIFT_RULER(state) {
    if (!state.paper.rulerPlaced) return ok(state);
    return ok(withPaper(state, { rulerPlaced: false }), '자를 치웠습니다.', 'ruler-lifted');
  },

  /**
   * R-13 결과를 기록한다.
   *
   * 흐린 결과도 기록된다. 막지 않는다 — 정리 단계에서 왜 흐렸는지 스스로 설명하게 한다.
   *
   * 기록은 그때 본 종이를 **그대로 다시 그릴 수 있는** 값 한 벌이다. `stripParams` 를 통째로
   * 담으므로 탐구 노트가 기록마다 그림을 되살릴 수 있고, 결과 보드에 보낼 값도 이것과 같다.
   */
  CAPTURE(state) {
    const p = state.paper;
    if (p.torn) {
      return happened(state, '찢어진 거름종이는 기록할 것이 없습니다.', 'torn');
    }
    // `at` 은 순번이 아니라 **한 번 붙으면 안 바뀌는 번호**다.
    // 배열 길이를 쓰면 중간 것을 지운 뒤 같은 번호가 다시 붙어, 지운 기록에 딸린 답이
    // 새 기록 칸에 들어간다 (DELETE_CAPTURE 참조).
    const nextAt = state.session.captures.reduce((n, c) => Math.max(n, (c.at ?? -1) + 1), 0);
    const capture = { at: nextAt, papersUsed: state.tools.papersUsed, ...stripParams(state) };
    const next = {
      ...state,
      session: { ...state.session, captures: [...state.session.captures, capture] },
    };
    if (capture.load <= 0.02) {
      return happened(next, '색 띠가 거의 없는 채로 기록됐습니다. 정리 단계에서 왜 그랬는지 적게 됩니다.', 'empty-capture');
    }
    return ok(next, `거름종이를 기록했습니다. 지금까지 ${next.session.captures.length}장입니다.`, 'captured');
  },

  /**
   * 기록한 결과를 지운다.
   *
   * 기록은 누르는 데 힘이 안 들어서 열 장이 금세 쌓인다. 그중 남기고 싶은 것을 고를 길이
   * 없으면 탐구 노트 「5. 결과」 가 실패작 목록이 되고, 보고서에도 그대로 실린다.
   * 지우는 것은 관찰을 무르는 것이 아니다 — 무엇을 근거로 삼을지 고르는 일이다.
   */
  DELETE_CAPTURE(state, { at }) {
    const captures = state.session.captures.filter((c) => c.at !== at);
    if (captures.length === state.session.captures.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    // 그 기록에 딸린 답도 함께 지운다. 남겨 두면 다음에 같은 번호가 붙었을 때
    // 쓴 적 없는 답이 칸에 들어가 있다.
    const notes = { ...state.session.notes };
    delete notes[`rf.${at}`];
    return ok(
      { ...state, session: { ...state.session, captures, notes } },
      '기록을 지웠습니다.', 'capture-deleted'
    );
  },

  /**
   * 탐구 노트의 한 단계를 읽었다고 표시한다.
   *
   * 실험대는 이것이 다 차야 열린다 (`src/ui/bench.js`). 조작을 막는 것이 아니라
   * **시작하기 전에 무엇을 하려는지 읽게 하는 것**이라, 하드 게이트가 아니다.
   * 열린 뒤에는 어떤 조작도 막지 않는다.
   */
  MARK_READ(state, { stage }) {
    const read = state.session.readStages ?? [];
    if (!stage || read.includes(stage)) return ok(state);
    return ok({ ...state, session: { ...state.session, readStages: [...read, stage] } });
  },

  /*
   * **안전 조작(손 씻기·마개 닫기·폐액 버리기)과 그 판정은 걷어냈다.**
   *
   * 가상 실험에서 그것을 따지면 **화면 속 단추를 눌렀다는 사실**을 평가하게 된다 —
   * 안전 습관이 아니라 조작 순서 외우기다. 진짜 마개는 교실에서 닫는다.
   * 지금은 자기 평가 쪽에 **가만히 적힌 안내**만 있고 앱은 아무것도 판정하지 않는다
   * (`UI.notebook.safetyItems`).
   *
   * 물건 자체는 남아 있다 — 폐액통에 원심관·바이알·모세관을 끌어다 대는 조작은 그대로다.
   * 다만 **휴지는 뺐다.** 손 씻기 말고는 쓰임이 없어서, 남겨 두면 눌러도 아무 일도
   * 안 나는 물건이 된다.
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
  //   · UNDO 는 스스로 되감으므로 다시 쌓지 않는다
  //   · 상태를 못 바꾼 액션은 쌓지 않는다. 되돌리기가 헛돌게 된다
  //   · 시간 경과는 조작이 아니다
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
