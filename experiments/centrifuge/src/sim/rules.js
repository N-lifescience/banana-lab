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
  TUBE_KINDS, SLOTS, SLOT_ITEMS, ENDS, HISTORY_LIMIT,
  PRESS_BREAK, PRESS_GOOD, ANGLE_RANGE_DEG, ANGLE_BEST_DEG,
  initialTube, initialFinger, initialRotor, initialLancet,
  columnLength, weakestSeal, isSealed, imbalanceOf, isSpinning,
  sampleSlot, freeSlot, separation, isClotted, tubeParams,
} from './state.js';
import {
  MAX_SPEED, MAX_SINCE, BEAT_BASE, SIM_PER_SECOND,
  applyPull, stepSpin, workGain, mixGain, leakGain, timingError, wobbleOf,
} from './spin.js';

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
  // 정리했는지 보는 것은 학생이 "한" 조작이 아니다. 되돌릴 것도 아니다.
  // 탐구 노트의 어느 쪽을 읽었는지는 학생이 "한" 조작이 아니다.
  'MARK_READ',
]);

/**
 * 연속 조작 — 슬라이더 한 번 끄는 동안 수십 번 디스패치된다.
 * 앞선 액션이 같은 종류면 기록을 새로 쌓지 않는다. 이미 쌓인 것이 끌기 전 상태이기 때문이다.
 * 그래서 되돌리기 한 번이 "끌기 전" 으로 돌아간다.
 *
 * **PULL 은 여기 넣지 않는다.** 당김 하나하나가 이 실험의 조작이고, 열 번 당긴 것을
 * 한 번에 무르면 리듬을 고쳐 볼 수가 없다.
 * DRAW_BLOOD 는 반대다 — 확대 뷰에서 손가락을 누르고 있는 동안 계속 들어오므로,
 * 한 번 누른 것이 되돌리기 기록 스무 칸을 밀어내면 안 된다.
 */
export const CONTINUOUS_ACTIONS = new Set(['SEAT', 'SAVE_NOTE', 'DRAW_BLOOD']);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음 (돌고 있는 회전판에 넣기)
  BROKEN: 'broken',           // 기구가 파손돼 새것이 필요함
};

/** 부러진 모세관에서 빠져나가는 길. **어디로 가야 하는지까지** 적는다. */
const NEW_TUBE_WAY = '선반의 모세관 통에서 새것을 꺼내세요.';

/**
 * 뜻대로 됐다.
 *
 * 말은 **선택**이다. 시간이 흐르는 것(TICK)처럼 학생이 "했다" 고 느끼지 않는 일에는
 * 붙이지 않는다 — 붙이면 화면이 쉬지 않고 떠든다. 다만 조작이 성공했을 때 화면이 아무 말도
 * 안 하면, 학생은 방금 누른 것이 먹혔는지를 그림에서 혼자 읽어내야 한다.
 * 모세관 안의 1 mm 짜리 변화는 교실 프로젝터에서 보이지 않는다.
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
const withTube = (state, patch) => ({ ...state, tube: { ...state.tube, ...patch } });
const withFinger = (state, patch) => ({ ...state, finger: { ...state.finger, ...patch } });
const withRotor = (state, patch) => ({ ...state, rotor: { ...state.rotor, ...patch } });
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
   * R-01 손끝을 소독한다. **탐구 과정 STEP 1 의 첫 칸이다** — 안전 점검이 아니라 절차다.
   * 건너뛰어도 막지 않는다 (AGENTS.md §2.1). 안 하고 찌르면 그렇게 진행될 뿐이다.
   */
  SWAB_FINGER(state) {
    if (state.finger.swabbed) return ok(state, '손끝은 이미 소독돼 있습니다.');
    return ok(withFinger(state, { swabbed: true }),
      '소독솜으로 손끝을 닦았습니다.', 'finger-swabbed');
  },

  /**
   * R-02 어느 모세관을 집을지 고른다.
   *
   * **헤파린과 민무늬를 학생이 정한다.** 화면이 알아서 헤파린을 집어 주면
   * "왜 헤파린이 발린 것을 쓰는가" 라는 이 실험의 변인이 학생 손을 떠난다 (PLAYBOOK §4).
   */
  PICK_CAPILLARY(state, { kind }) {
    const next = kind === TUBE_KINDS.PLAIN ? TUBE_KINDS.PLAIN : TUBE_KINDS.HEPARIN;
    if (state.tools.pickKind === next) return ok(state);
    const patched = withTools(state, { pickKind: next });
    if (next === TUBE_KINDS.PLAIN) {
      return happened(patched,
        '헤파린이 발려 있지 않은 모세관을 골랐습니다. 헤파린은 혈액이 굳는 것을 막습니다.',
        'plain-tube');
    }
    return ok(patched, '헤파린이 발린 모세관을 골랐습니다.', 'heparin-tube');
  },

  /**
   * R-03 채혈침으로 손끝을 톡 누른다.
   *
   * 소독을 안 했어도, 쓴 침을 다시 써도 **막지 않고 세지도 않는다.**
   * 안전 수칙은 2쪽(준비물)에 **적어 두기만 한다** — 이 앱은 그것을 확인하지 않는다.
   * 그때그때 무슨 일이 일어났는지는 말해 주되, 그것을 모아 두지 않는다.
   */
  PRICK_FINGER(state) {
    const notes = [];
    if (!state.finger.swabbed) notes.push('소독하지 않은 손끝을 찔렀습니다');
    if (state.lancet.used) notes.push('한 번 쓴 채혈침을 다시 썼습니다');
    const next = {
      ...withFinger(state, { drop: clamp01(state.finger.drop + 0.7), dropAge: 0 }),
      lancet: { ...state.lancet, used: true },
    };
    if (notes.length) {
      return happened(next,
        `${notes.join('. ')}. 실제 실험이라면 하지 않는 일입니다.`, 'safety-noted');
    }
    return ok(next, '손끝에 선홍색 핏방울이 맺혔습니다.', 'pricked');
  },

  /**
   * R-04 모세관 끝을 손끝에 대어 혈액을 빨아올린다.
   *
   * **각도가 변인이다.** 비스듬히 대야 모세관 현상이 제대로 일어나고, 수직으로 세우면
   * 공기가 함께 들어가 기둥에 기포가 낀다. 어느 각도든 막지 않는다.
   */
  DRAW_BLOOD(state, { angleDeg = ANGLE_BEST_DEG, dwell = 0.4 } = {}) {
    const t = state.tube;
    if (t.broken) {
      return blocked(state, `부러진 모세관으로는 빨아올릴 수 없습니다. ${NEW_TUBE_WAY}`,
        BLOCKING_REASONS.BROKEN);
    }
    if (state.finger.drop <= 0) {
      return happened(state, '손끝에 맺힌 피가 없습니다. 채혈침으로 손끝을 톡 누르세요.', 'no-drop');
    }
    const [lo, hi] = ANGLE_RANGE_DEG;
    const angle = clamp(angleDeg, lo, hi);
    // 35° 언저리가 가장 잘 들어온다. 수직에 가까울수록 덜 들어오고 공기가 낀다.
    const fit = clamp01(1 - Math.abs(angle - ANGLE_BEST_DEG) / 55);
    const gained = Math.min(state.finger.drop, (0.25 + dwell * 0.55) * (0.35 + 0.65 * fit));
    // 손끝에 오래 맺혀 있던 피는 이미 굳기 시작했다. **헤파린도 되돌리지 못한다.**
    const aged = clamp01(state.finger.dropAge / 60);
    const next = withFinger(withTube(state, {
      fill: clamp01(t.fill + gained),
      bubbles: clamp01(t.bubbles + (1 - fit) * (0.12 + dwell * 0.2)),
      clot: clamp01(t.clot + aged * 0.5),
      lastAngle: angle,
    }), { drop: clamp01(state.finger.drop - gained) });

    if (aged > 0.35) {
      return happened(next,
        '손끝에 맺힌 지 오래된 피를 빨아올렸습니다. 이미 굳기 시작한 피는 헤파린으로도 되돌릴 수 없습니다.',
        'aged-drop');
    }
    if (fit < 0.45) {
      return happened(next,
        `모세관을 너무 세워서 댔습니다(${angle.toFixed(0)}°). 공기가 함께 들어가 기둥에 기포가 꼈습니다.`,
        'steep-angle');
    }
    return ok(next,
      `혈액이 모세관을 타고 올라왔습니다. 기둥이 관의 ${(next.tube.fill * 100).toFixed(0)}% 입니다.`,
      'blood-drawn');
  },

  /**
   * R-06 · R-07 모세관 끝을 고무찰흙에 눌러 막는다.
   *
   * **하드 게이트 2** — 너무 세게 누르면 유리가 부러진다. 실제로 그렇다.
   * 막는 것이 아니라, 이미 벌어진 파손 때문에 그 모세관을 더 쓸 수 없는 것이다.
   * 얕게 누르는 것은 막지 않는다 — 돌리는 동안 새고, 그것이 답이다.
   */
  SEAL_END(state, { end = ENDS.OUTER, press = 0.7 } = {}) {
    const t = state.tube;
    if (t.broken) {
      return blocked(state, `부러진 모세관은 막을 수 없습니다. ${NEW_TUBE_WAY}`,
        BLOCKING_REASONS.BROKEN);
    }
    const which = end === ENDS.INNER ? ENDS.INNER : ENDS.OUTER;
    const p = clamp01(press);
    if (p >= PRESS_BREAK) {
      return blocked(withTube(state, { broken: true }),
        `고무찰흙에 너무 세게 눌러 모세관이 부러졌습니다. ${NEW_TUBE_WAY} 다음에는 살살 돌려 가며 누르세요.`,
        BLOCKING_REASONS.BROKEN);
    }
    const quality = clamp01(p / PRESS_GOOD);
    const next = withTube(state, { seal: { ...t.seal, [which]: quality } });
    const label = which === ENDS.OUTER ? '바깥쪽 끝' : '축 쪽 끝';
    if (quality < 0.6) {
      return happened(next,
        `${label}을 얕게 막았습니다. 돌리면 그쪽으로 혈액이 새어 나갑니다.`, 'seal-weak');
    }
    return ok(next, `${label}을 고무찰흙으로 막았습니다.`, 'sealed');
  },

  /** R-08 고무찰흙을 뗀다 — 잘못 막았을 때 되돌아가는 길 */
  PEEL_CLAY(state, { end = ENDS.OUTER } = {}) {
    const which = end === ENDS.INNER ? ENDS.INNER : ENDS.OUTER;
    if (state.tube.seal[which] <= 0) return ok(state, '그쪽 끝은 막혀 있지 않습니다.');
    return ok(withTube(state, { seal: { ...state.tube.seal, [which]: 0 } }),
      '고무찰흙을 떼어 냈습니다. 다시 막을 수 있습니다.', 'clay-peeled');
  },

  /**
   * R-10 회전판의 빨대에 넣는다.
   *
   * **하드 게이트 1** — 돌고 있으면 넣을 수 없다. 물리적으로 성립하지 않는다.
   * 균형을 안 맞추고 돌리는 것은 막지 않는다. 그건 성립하는 동작이고, 결과가 답한다.
   */
  LOAD_ROTOR(state, { slot, what = SLOT_ITEMS.SAMPLE } = {}) {
    const r = state.rotor;
    if (isSpinning(r)) {
      return blocked(state,
        '회전판이 돌고 있어 넣을 수 없습니다. 회전판을 손으로 감싸 멈춘 뒤에 넣으세요.',
        BLOCKING_REASONS.IMPOSSIBLE);
    }
    const item = what === SLOT_ITEMS.COUNTER ? SLOT_ITEMS.COUNTER : SLOT_ITEMS.SAMPLE;
    if (item === SLOT_ITEMS.SAMPLE && state.tube.broken) {
      return blocked(state, `부러진 모세관은 회전판에 물릴 수 없습니다. ${NEW_TUBE_WAY}`,
        BLOCKING_REASONS.BROKEN);
    }
    // 이미 들어 있으면 아무 일도 안 일어난다. 자리를 바꾸려면 먼저 꺼낸다.
    if (r.slots.A === item || r.slots.B === item) {
      return happened(state, '그것은 이미 회전판에 물려 있습니다.', 'already-loaded');
    }
    const target = slot && !r.slots[slot] ? slot : freeSlot(r);
    if (!target) {
      return happened(state, '회전판의 두 자리가 다 찼습니다. 하나를 먼저 꺼내세요.', 'rotor-full');
    }
    const next = withRotor(state, { slots: { ...r.slots, [target]: item } });
    if (item === SLOT_ITEMS.SAMPLE && !isSealed(state.tube)) {
      return happened(next,
        '아직 막지 않은 끝이 있는 채로 물렸습니다. 돌리면 그쪽으로 혈액이 그대로 날아갑니다.',
        'unsealed-loaded');
    }
    if (item === SLOT_ITEMS.SAMPLE) {
      return ok(next, '혈액이 든 모세관을 회전판 빨대에 넣었습니다. 모세관은 수평으로 물립니다.', 'sample-loaded');
    }
    return ok(next, '반대쪽 빨대에 빈 모세관을 넣었습니다. 이제 균형이 맞습니다.', 'counter-loaded');
  },

  /**
   * R-12 밀어 넣는 깊이를 맞춘다.
   * 두 쪽의 깊이가 다르면 무게 중심이 축에서 벗어나 그만큼 흔들린다. 막지 않는다.
   */
  SEAT(state, { slot = SLOTS.A, depth = 1 } = {}) {
    const which = slot === SLOTS.B ? SLOTS.B : SLOTS.A;
    if (!state.rotor.slots[which]) {
      return happened(state, '그 자리는 비어 있습니다.', 'empty-slot');
    }
    const next = withRotor(state, {
      seat: { ...state.rotor.seat, [which]: clamp01(depth) },
    });
    const gap = imbalanceOf(next.rotor);
    if (gap > 0.25) {
      return happened(next,
        '두 모세관을 넣은 깊이가 다릅니다. 무게 중심이 축에서 벗어나 돌리면 흔들립니다.',
        'seat-uneven');
    }
    return ok(next, null, 'seated');
  },

  /**
   * R-13 끈을 당겼다 놓는다. **이 실험의 몸통이다.**
   *
   * 아무 때나 당길 수 있다. 다만 박자가 어긋나면 돌고 있는 회전판을 거스르게 되어
   * **오히려 느려진다.** 그리고 빨라질수록 박자가 잦아진다 — 손을 더 빨리 놀려야 한다.
   */
  PULL(state, { strength = 1 } = {}) {
    const r = state.rotor;
    if (!r.slots.A && !r.slots.B) {
      return happened(state, '회전판이 비어 있습니다. 돌아가기는 하지만 갈릴 것이 없습니다.', 'rotor-empty');
    }
    const before = r.speed;
    const spun = applyPull(r, { strength });
    const err = timingError(r.phase);
    const next = withRotor(state, {
      speed: spun.speed,
      phase: spun.phase,
      pulls: r.pulls + 1,
      // 박자가 얼마나 맞았는지를 쌓아 둔다. pulls 로 나누면 리듬의 질이 된다.
      onBeat: r.onBeat + clamp01(1 - 2 * err),
    });
    if (spun.gain < -0.05) {
      return happened(next,
        '박자가 어긋나 회전을 거슬렀습니다. 끈이 다시 꼬여 멎는 순간에 당겨야 힘이 보태집니다.',
        'off-beat');
    }
    if (spun.speed >= MAX_SPEED && before >= MAX_SPEED) {
      return happened(next, '이보다 더 빨리 돌리기는 어렵습니다.', 'at-max');
    }
    return ok(next, null, 'pulled');
  },

  /** R-15 회전판을 손으로 감싸 멈춘다 — 되돌아가는 길 */
  STOP_ROTOR(state) {
    if (!isSpinning(state.rotor)) return ok(state, '회전판은 이미 멎어 있습니다.');
    return ok(withRotor(state, { speed: 0, phase: 0 }),
      '회전판을 손으로 감싸 멈췄습니다.', 'rotor-stopped');
  },

  /**
   * R-16 회전판에서 꺼낸다.
   *
   * **하드 게이트 2** — 돌고 있는데 손을 대면 모세관이 부러진다. 실제로 그렇다.
   * 빠져나갈 길이 둘 다 문장에 있다: 먼저 멈추는 것과, 새것을 꺼내는 곳.
   */
  UNLOAD(state, { slot } = {}) {
    const r = state.rotor;
    const which = slot && r.slots[slot] ? slot : (sampleSlot(r) ?? freeSlotFilled(r));
    if (!which) return happened(state, '회전판에 든 것이 없습니다.', 'rotor-empty');
    if (isSpinning(r)) {
      const wasSample = r.slots[which] === SLOT_ITEMS.SAMPLE;
      const stopped = withRotor(state, { slots: { ...r.slots, [which]: null }, speed: 0, phase: 0 });
      const next = wasSample ? withTube(stopped, { broken: true }) : stopped;
      return blocked(next,
        wasSample
          ? `돌고 있는 회전판에 손을 대자 모세관이 부러졌습니다. ${NEW_TUBE_WAY} 다음에는 회전판을 손으로 감싸 멈춘 뒤에 꺼내세요.`
          : '돌고 있는 회전판에 손을 대자 빈 모세관이 부러졌습니다. 회전판을 손으로 감싸 멈춘 뒤에 꺼내세요.',
        BLOCKING_REASONS.BROKEN);
    }
    return ok(withRotor(state, { slots: { ...r.slots, [which]: null } }),
      '회전판에서 모세관을 꺼냈습니다.', 'unloaded');
  },

  /**
   * 시간 경과. 회전 감쇠 · 분리 · 응고 · 누출 · 핏방울이 굳는 것이 전부 여기서 진행된다.
   *
   * 이 액션만은 **화면이 시계를 띄우지 않는다.** 실제 소요 시간은 `[확인 필요]` 라
   * 지어낼 수 없고, 절차가 보라고 한 것은 시간이 아니라 층이다 (spin.js).
   */
  TICK(state, { seconds = 1, speed = SIM_PER_SECOND } = {}) {
    const dt = seconds * speed;
    let next = state;

    // 손끝에 맺힌 피는 굳기 시작한다
    if (next.finger.drop > 0) {
      next = withFinger(next, { dropAge: next.finger.dropAge + dt });
    }

    const r = next.rotor;
    const t = next.tube;
    const inRotor = sampleSlot(r) !== null;

    // 회전은 언제나 잦아든다
    if (r.speed > 0) {
      const stepped = stepSpin(r, { dt, imbalance: imbalanceOf(r) });
      next = withRotor(next, { speed: stepped.speed, phase: stepped.phase });
    } else if (r.slots.A || r.slots.B) {
      // 멎어 있어도 박자는 흐른다 — 그래야 처음 당길 때가 정해진다
      next = withRotor(next, { phase: Math.min(MAX_SINCE, r.phase + dt * BEAT_BASE) });
    }

    const patch = {};
    // 헤파린이 안 발린 관에 든 혈액은 굳는다. 발린 관은 굳지 않는다.
    if (t.fill > 0 && t.kind === TUBE_KINDS.PLAIN) {
      patch.clot = clamp01(t.clot + dt / 260);
    }
    if (inRotor && r.speed > 0) {
      const wob = wobbleOf(imbalanceOf(r), r.speed);
      patch.work = t.work + workGain(r.speed, dt);
      patch.mixed = clamp01(t.mixed + mixGain(wob, r.speed, dt));
      // 막지 않은 끝은 밀봉 0 이라 그쪽으로 그대로 날아간다
      patch.lost = clamp01(t.lost + leakGain(weakestSeal(t), r.speed, dt));
    }
    if (Object.keys(patch).length) next = withTube(next, patch);
    return ok(next);
  },

  /**
   * R-21 모세관 통에서 새것을 꺼낸다.
   *
   * 부러진 모세관에서 빠져나오는 유일한 길이자, 잘못 채운 기둥을 되돌리는 길이다.
   * 통에 넉넉히 들어 있어 바닥나지 않는다 — 소모품이 바닥나면 그건 결과가 아니라 막다른 길이다.
   */
  NEW_CAPILLARY(state, { kind } = {}) {
    const used = state.tools.tubesUsed + 1;
    const pick = kind ?? state.tools.pickKind;
    const fresh = initialTube(state.tube.seed + used * 977, pick);
    const r = state.rotor;
    const slot = sampleSlot(r);
    let next = withTools({ ...state, tube: fresh }, { tubesUsed: used, pickKind: pick, rulerPlaced: false });
    if (slot) next = withRotor(next, { slots: { ...r.slots, [slot]: null } });
    if (pick === TUBE_KINDS.PLAIN) {
      return happened(next,
        '헤파린이 발려 있지 않은 새 모세관을 꺼냈습니다. 처음부터 다시 시작합니다.', 'plain-tube');
    }
    return ok(next, '헤파린이 발린 새 모세관을 꺼냈습니다. 처음부터 다시 시작합니다.', 'tube-replaced');
  },

  /**
   * R-17 자를 대어 층의 길이를 읽는다.
   *
   * 막지 않는다. 기둥이 짧거나 기포가 많으면 **어디까지가 혈액인지 애매해질** 뿐이고,
   * 그 애매함이 "왜 기포가 안 들어가게 대야 하는가" 를 말해 준다.
   */
  MEASURE(state) {
    const t = state.tube;
    if (t.broken) {
      return blocked(state, `부러진 모세관은 잴 수 없습니다. ${NEW_TUBE_WAY}`,
        BLOCKING_REASONS.BROKEN);
    }
    const next = withTools(state, { rulerPlaced: true });
    const column = columnLength(t);
    if (column <= 0.02) {
      return happened(next, '잴 혈액이 없습니다. 모세관이 비어 있습니다.', 'nothing-to-measure');
    }
    if (t.bubbles > 0.3) {
      return happened(next,
        '기둥에 기포가 끼어 어디까지가 혈액인지 읽기 어렵습니다.', 'bubbly');
    }
    return ok(next,
      '모세관에 자를 댔습니다. 바깥쪽 끝에서 적혈구층 경계까지, 그리고 기둥 전체를 읽으세요.',
      'ruler-placed');
  },

  /** R-18 자를 치운다 */
  LIFT_RULER(state) {
    if (!state.tools.rulerPlaced) return ok(state);
    return ok(withTools(state, { rulerPlaced: false }), '자를 치웠습니다.', 'ruler-lifted');
  },

  /**
   * R-19 결과를 기록한다.
   *
   * 흐린 결과도 기록된다. 막지 않는다 — 정리 단계에서 왜 흐렸는지 스스로 설명하게 한다.
   *
   * 기록은 그때 본 모세관을 **그대로 다시 그릴 수 있는** 값 한 벌이다. `tubeParams` 를
   * 통째로 담으므로 탐구 노트가 기록마다 그림을 되살릴 수 있다.
   */
  CAPTURE(state) {
    if (state.tube.broken) {
      return happened(state, '부러진 모세관은 기록할 것이 없습니다.', 'broken');
    }
    // `at` 은 순번이 아니라 **한 번 붙으면 안 바뀌는 번호**다.
    // 배열 길이를 쓰면 중간 것을 지운 뒤 같은 번호가 다시 붙어, 지운 기록에 딸린 답이
    // 새 기록 칸에 들어간다 (DELETE_CAPTURE 참조).
    const nextAt = state.session.captures.reduce((n, c) => Math.max(n, (c.at ?? -1) + 1), 0);
    const capture = {
      at: nextAt,
      tubesUsed: state.tools.tubesUsed,
      pulls: state.rotor.pulls,
      ...tubeParams(state),
    };
    const next = {
      ...state,
      session: { ...state.session, captures: [...state.session.captures, capture] },
    };
    if (capture.column <= 0.02) {
      return happened(next,
        '혈액이 거의 없는 채로 기록됐습니다. 정리 단계에서 왜 그랬는지 적게 됩니다.', 'empty-capture');
    }
    if (capture.separation < 0.2) {
      return happened(next,
        '아직 층이 거의 갈리지 않은 채로 기록됐습니다. 더 돌린 뒤 다시 기록할 수도 있습니다.',
        'unseparated-capture');
    }
    return ok(next,
      `모세관을 기록했습니다. 지금까지 ${next.session.captures.length}개입니다.`, 'captured');
  },

  /**
   * R-20 기록한 결과를 지운다.
   *
   * 기록은 누르는 데 힘이 안 들어서 열 개가 금세 쌓인다. 그중 남기고 싶은 것을 고를 길이
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
    delete notes[`hct.${at}`];
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

/** 회전판에서 무엇이든 든 자리 하나. `UNLOAD` 가 자리를 안 받았을 때 쓴다. */
function freeSlotFilled(rotor) {
  if (rotor.slots.A) return SLOTS.A;
  if (rotor.slots.B) return SLOTS.B;
  return null;
}

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
