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
  HISTORY_LIMIT, initialTube, initialMix, mixPct,
  tubeConditions, activeConditions, offDesign, defaultControls,
} from './state.js';
import {
  gasVolume, gasAfterKoh,
  GLUCOSE_STANDARD_PCT, GLUCOSE_POUR_ML, YEAST_POUR_ML, KOH_POUR_ML, KOH_PCT,
  OBSERVE_LIMIT_MIN,
} from './fermentation.js';

/**
 * 희석할 때 한 번에 더하는 양 (mL).
 *
 * 10 % 를 한 번, 증류수를 한 번 더하면 **10 mL + 10 mL = 5 %** 다 —
 * 교과서의 희석 예시와 같다. 몇 mL 를 더할지까지 손으로 정하게 하면 계량 시뮬레이터가 되고,
 * 정작 배울 것(같은 부피를 더하면 절반)이 숫자 입력에 묻힌다.
 */
export const MIX_STEP_ML = 10;

/** 농도를 화면에 적을 때. 3.33333 을 그대로 보여 주면 학생이 그 숫자를 옮겨 적는다. */
const fmtPct = (pct) => (Number.isInteger(pct) ? String(pct) : pct.toFixed(1));

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시간이 흐르는 것은 학생이 "한" 조작이 아니다. 이걸 쌓으면 주기적으로 도는 TICK 이
 * 20칸짜리 기록을 몇 초 만에 밀어내고, 되돌리기 1회짜리 3단계에서는 그 한 번이
 * TICK 을 무르는 데 쓰여 사라진다. 바나나랩에서 실제로 그랬다.
 */
export const TRANSIENT_ACTIONS = new Set([
  'TICK', 'MARK_READ',
]);

/**
 * 연속 조작 — 칩을 훑는 동안 여러 번 디스패치된다.
 * 앞선 액션이 같은 종류면 기록을 새로 쌓지 않는다. 이미 쌓인 것이 손대기 전 상태이기 때문이다.
 */
export const CONTINUOUS_ACTIONS = new Set(['SET_CONTROL', 'SAVE_NOTE']);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음
  BROKEN: 'broken',           // 기구가 파손돼 재제작이 필요함
};

/**
 * 솜마개가 막고 있어 부을 수 없다는 안내.
 *
 * ── 이 실험에서 `blocked` 가 나오는 **유일한** 자리다 ──────────────
 * 솜마개로 막힌 발효관에 액체를 부을 수는 없다. 「닫힌 뚜껑 안으로 물체 넣기」와 같은
 * 종류이고, 허용된 두 사유 중 첫째(물리적으로 성립하지 않음)에 든다.
 *
 * **어디로 가야 하는지까지 말한다.** 「마개를 빼세요」로는 어떻게 빼는지 알 수 없다.
 *
 * ── 왜 「깨진 기구」 사유는 없나 ────────────────────────────────────
 * 이 실험의 항온기는 가장 뜨거운 것이 55 ℃ 라 열 충격으로 유리가 깨질 만한 온도 차가
 * 생기지 않는다. **쓸 데가 없는 사유를 미리 만들어 두지 않는다** — 코드가 그것을 근거로
 * 삼기 시작하면, 정작 깨질 일이 없다는 사실이 안 보이게 된다.
 */
const PLUGGED_MESSAGE =
  '솜마개가 발효관 입구를 막고 있어 부을 수 없습니다. 발효관을 눌러 솜마개를 먼저 빼세요.';

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

/* ------------------------------------------------------------------ */
/* 얕은 복사 도우미 — reduce 는 부수효과가 없어야 한다                  */
/* ------------------------------------------------------------------ */

const withBench = (state, patch) => ({ ...state, bench: { ...state.bench, ...patch } });
const withTube = (state, patch) => withBench(state, { tube: { ...state.bench.tube, ...patch } });
const withMix = (state, patch) => withBench(state, { mix: { ...state.bench.mix, ...patch } });
const withDesign = (state, patch) => ({ ...state, design: { ...state.design, ...patch } });
const withSession = (state, patch) => ({ ...state, session: { ...state.session, ...patch } });

/**
 * 되돌리기용 스냅샷.
 * history 를 비워서 담는다 — 스냅샷 안에 또 history 가 들어가면 지수적으로 커진다.
 */
function snapshot(state) {
  return { ...state, session: { ...state.session, history: [] } };
}

/**
 * 발효관에 손댔을 때 재고 있던 시행을 되감는다.
 *
 * ── 왜 되감나 ──────────────────────────────────────────────────────
 * 모인 기체는 **흐른 시간 전체**에 지금 조건을 곱해 낸다. 그래서 10 ℃ 에서 15 분을
 * 지켜본 뒤 30 ℃ 로 옮기면, 그 15 분이 소급해서 30 ℃ 로 계산돼 **화면에는 16 분이 떠 있는데
 * 30 ℃ 에서 16 분 동안 모인 양**이 나온다. 실제 실험에서도 도중에 조건을 바꾸면
 * 그 시행은 처음부터 다시 해야 한다.
 *
 * **관찰 시간을 다 채운 뒤에는 되감지 않는다.** 측정이 끝났고, 그때 조건은 `runConditions` 에
 * 얼려 있으므로 뒤에 발효관을 옮겨도 기록이 어긋나지 않는다.
 */
function rewindIfRunning(state, next, message) {
  const t = state.bench.tube;
  if (!t.inIncubator || t.elapsedMin >= OBSERVE_LIMIT_MIN) return null;
  if (t.elapsedMin === 0) return null;   // 아직 아무것도 안 모였으면 되감을 것이 없다
  return happened(withTube(next, { elapsedMin: 0, runConditions: null }), message, 'run-restarted');
}

/** 발효관에 무언가 붓는다. 세 시약이 앞뒤로 똑같이 해야 하는 일을 한 곳에 모은다. */
function pourInto(state, patch, message, tag) {
  const t = state.bench.tube;
  if (t.plugged) return blocked(state, PLUGGED_MESSAGE, BLOCKING_REASONS.IMPOSSIBLE);
  const next = withTube(state, patch);
  const rewound = rewindIfRunning(state, next,
    '발효 중인 발효관에 더 부었습니다. 이 시행은 처음부터 다시 해야 합니다.');
  if (rewound) return rewound;
  return ok(next, message, tag);
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

  /* ---------------- 발효관 채우기 ---------------- */

  /**
   * 포도당 수용액을 붓는다.
   *
   * 병에 적힌 농도가 그대로 들어간다. **병을 잘못 고르는 것을 막지 않는다** — 통제변인이다.
   * 두 번 부으면 나중 것으로 덮이고 부피만 늘어난다. 실제로도 그렇다.
   */
  POUR_GLUCOSE(state, { pct, ml = GLUCOSE_POUR_ML }) {
    const t = state.bench.tube;
    return pourInto(state,
      { glucosePct: pct, glucoseMl: t.glucoseMl + ml },
      `발효관에 ${pct} % 포도당 수용액 ${ml} mL 를 부었습니다.`, 'glucose-poured');
  },

  /**
   * 빈 병에 10 mL 를 더해 포도당 수용액을 **만든다.**
   *
   * 10 % 를 한 번, 증류수를 한 번 더하면 5 % 가 된다 — 같은 부피를 더했으므로 절반이다.
   * **계산이 틀려도 막지 않는다.** 증류수를 두 번 더하면 3.3 % 가 되고, 그 농도가 그대로
   * 발효관에 들어간다. 설계에 적어 둔 값과 어긋나면 그래프가 그 점을 떼어 놓는다.
   */
  ADD_TO_MIX(state, { kind, ml = MIX_STEP_ML }) {
    const mix = state.bench.mix;
    const next = kind === 'water'
      ? withMix(state, { waterMl: mix.waterMl + ml })
      : withMix(state, { glucoseMl: mix.glucoseMl + ml });
    const pct = mixPct(next.bench.mix);
    const what = kind === 'water' ? '증류수' : `${GLUCOSE_STANDARD_PCT} % 포도당 수용액`;
    if (next.bench.mix.glucoseMl === 0) {
      return happened(next,
        `빈 병에 ${what} ${ml} mL 를 넣었습니다. 포도당이 없어 아직 ${pct.toFixed(0)} % 입니다.`,
        'mix-water-only');
    }
    return ok(next,
      `${what} ${ml} mL 를 더했습니다. 병에 든 것은 ${fmtPct(pct)} % 포도당 수용액입니다.`,
      'mix-added');
  },

  /** 만든 병을 비운다. 희석을 잘못했을 때 되돌아갈 길이다. */
  EMPTY_MIX(state) {
    if (mixPct(state.bench.mix) === null) return ok(state, '병은 이미 비어 있습니다.');
    return ok(withBench(state, { mix: initialMix() }),
      '만든 병을 비웠습니다. 처음부터 다시 만들 수 있습니다.', 'mix-emptied');
  },

  /** 만든 병에서 발효관에 붓는다. 농도는 **실제로 만든 값**이 그대로 들어간다. */
  POUR_MIX(state, { ml = GLUCOSE_POUR_ML }) {
    const t = state.bench.tube;
    const pct = mixPct(state.bench.mix);
    if (pct === null) {
      return happened(state,
        '만든 병이 비어 있습니다. 선반의 10 % 포도당 수용액과 증류수를 이 병에 끌어다 넣어 만드세요.',
        'mix-empty');
    }
    return pourInto(state,
      { glucosePct: pct, glucoseMl: t.glucoseMl + ml },
      `만든 병에서 ${fmtPct(pct)} % 포도당 수용액 ${ml} mL 를 부었습니다.`, 'glucose-poured');
  },

  /** 효모액을 붓는다. */
  POUR_YEAST(state, { ml = YEAST_POUR_ML }) {
    const t = state.bench.tube;
    return pourInto(state,
      { yeastMl: t.yeastMl + ml },
      `발효관에 효모액 ${ml} mL 를 부었습니다.`, 'yeast-poured');
  },

  /**
   * 증류수를 붓는다.
   *
   * 대조군에서 **효모액 자리를 채우는** 일이다. 총 부피를 같게 맞추려고 넣는 것이므로,
   * 그 뜻을 말로 붙여 준다 — 화면이 안 말하면 「왜 물을 넣지?」가 남는다.
   * 포도당 대신 부으면 포도당 0 % 조건이 된다. 그것도 막지 않는다.
   */
  POUR_WATER(state, { ml = YEAST_POUR_ML, asGlucose = false }) {
    const t = state.bench.tube;
    if (asGlucose) {
      return pourInto(state,
        { glucosePct: 0, glucoseMl: t.glucoseMl + ml },
        `발효관에 증류수 ${ml} mL 를 부었습니다. 포도당이 없습니다.`, 'water-as-glucose');
    }
    return pourInto(state,
      { waterMl: t.waterMl + ml },
      `효모액 자리에 증류수 ${ml} mL 를 넣었습니다. 총 부피를 다른 발효관과 같게 맞춘 것입니다.`,
      'water-poured');
  },

  /**
   * 솜마개로 막는다. 산소를 차단하는 일이다.
   *
   * **막지 않고 발효시키는 것도 막지 않는다.** 기체는 그대로 나지만 발효인지 호흡인지
   * 갈라낼 수 없고, 그것을 그래프가 말한다 (AGENTS.md §2.5).
   */
  PLUG_TUBE(state) {
    if (state.bench.tube.plugged) return ok(state, '이미 솜마개로 막혀 있습니다.');
    return ok(withTube(state, { plugged: true }),
      '솜마개로 발효관 입구를 막았습니다. 산소가 들어오지 않습니다.', 'plugged');
  },

  /** 솜마개를 뺀다. 되돌아갈 길이다 — 막고 나서 더 부어야 할 때 여기로 온다. */
  UNPLUG_TUBE(state) {
    if (!state.bench.tube.plugged) return ok(state, '솜마개가 꽂혀 있지 않습니다.');
    const next = withTube(state, { plugged: false });
    const rewound = rewindIfRunning(state, next,
      '발효 중에 솜마개를 뺐습니다. 산소가 들어왔으므로 이 시행은 처음부터 다시 해야 합니다.');
    if (rewound) return rewound;
    return ok(next, '솜마개를 뺐습니다.', 'unplugged');
  },

  /* ---------------- 발효 ---------------- */

  /**
   * 발효관을 항온기에 넣는다. **여기서 시간이 흐르기 시작한다.**
   *
   * 무엇 하나 빠져 있어도 막지 않는다 — 포도당이 없으면 발효할 것이 없고, 효모액을 안 넣었으면
   * 발효할 것이 없다. 둘 다 결과가 대답한다.
   */
  PUT_IN_INCUBATOR(state, { tempC }) {
    const t = state.bench.tube;
    const moved = withTube(state, { tempC, inIncubator: true });
    // 이미 재고 있었으면 온도를 바꾼 것이므로 되감는다.
    const rewound = rewindIfRunning(state, moved,
      `발효 중에 발효관을 ${tempC} ℃ 항온기로 옮겼습니다. 이 시행은 처음부터 다시 해야 합니다.`);
    if (rewound) return rewound;

    // **넣는 순간의 조건을 얼려 둔다.** 뒤에 옮겨도 이미 모인 기체가 남의 조건으로 남지 않는다.
    const next = withTube(moved, {
      elapsedMin: 0,
      runConditions: tubeConditions(moved.bench.tube),
    });

    if (t.glucosePct === null && t.yeastMl === 0) {
      return happened(next, '빈 발효관을 항온기에 넣었습니다. 아무 일도 일어나지 않습니다.', 'empty-tube');
    }
    if (t.yeastMl === 0) {
      return happened(next, '효모액을 넣지 않은 발효관입니다. 무슨 일이 일어나는지 보세요.', 'no-yeast');
    }
    if (!t.plugged) {
      return happened(next,
        '솜마개를 하지 않은 채로 넣었습니다. 산소가 들어오므로 기체가 나더라도 '
        + '발효인지 호흡인지 갈라낼 수 없습니다.', 'not-plugged');
    }
    return ok(next, `발효관을 ${tempC} ℃ 항온기에 넣었습니다. 시간을 재기 시작합니다.`, 'in-incubator');
  },

  /** 항온기에서 꺼낸다. 관찰이 끝났으면 기록할 수 있다. */
  TAKE_FROM_INCUBATOR(state) {
    const t = state.bench.tube;
    if (!t.inIncubator) return ok(state, '발효관은 항온기에 있지 않습니다.');
    const next = withTube(state, { inIncubator: false });
    const rewound = rewindIfRunning(state, next,
      '발효 중에 발효관을 항온기에서 꺼냈습니다. 이 시행은 처음부터 다시 해야 합니다.');
    if (rewound) return rewound;
    return ok(next, '발효관을 항온기에서 꺼냈습니다.', 'out-of-incubator');
  },

  /**
   * 시간이 흐른다.
   *
   * 모인 기체의 양은 `fermentation.js` 가 낸다 — 여기서 다시 계산하지 않는다.
   * 두 곳에 적으면 어긋난다.
   */
  TICK(state, { minutes = 1 }) {
    const t = state.bench.tube;
    if (!t.inIncubator || t.elapsedMin >= OBSERVE_LIMIT_MIN) return ok(state);
    const elapsedMin = Math.min(t.elapsedMin + minutes, OBSERVE_LIMIT_MIN);
    const next = withTube(state, { elapsedMin });
    if (elapsedMin >= OBSERVE_LIMIT_MIN) {
      const ml = gasVolume(activeConditions(t), OBSERVE_LIMIT_MIN);
      return ok(next,
        `${OBSERVE_LIMIT_MIN}분이 지났습니다. 맹관부에 모인 기체는 ${ml.toFixed(1)} mL 입니다.`,
        'observation-done');
    }
    return ok(next);
  },

  /* ---------------- 이산화 탄소 확인 ---------------- */

  /**
   * 팽대부의 용액을 스포이트로 빼낸다.
   *
   * KOH 를 넣기 전에 하는 일이다. 안 빼고 KOH 를 부으면 부피가 넘치고 섞이는 것이 달라진다 —
   * 그래도 막지 않는다. `ADD_KOH` 가 그 결과를 말한다.
   */
  DRAIN_TUBE(state) {
    const t = state.bench.tube;
    if (t.plugged) return blocked(state, PLUGGED_MESSAGE, BLOCKING_REASONS.IMPOSSIBLE);
    if (t.drained) return ok(state, '팽대부는 이미 비어 있습니다.');
    return ok(withTube(state, { drained: true }),
      '스포이트로 팽대부의 용액을 빼냈습니다. 맹관부의 기체는 그대로 있습니다.', 'drained');
  },

  /**
   * 40 % 수산화 칼륨 수용액을 넣는다. **이산화 탄소인지 확인하는 단계다.**
   *
   * CO₂ 는 KOH 에 흡수되므로 맹관부의 기체가 줄어든다. 줄어드는 것을 보는 것이 확인이다.
   * 모인 기체가 없으면 줄어들 것도 없고, 그것도 결과다.
   */
  ADD_KOH(state, { ml = KOH_POUR_ML }) {
    const t = state.bench.tube;
    if (t.plugged) return blocked(state, PLUGGED_MESSAGE, BLOCKING_REASONS.IMPOSSIBLE);
    const next = withTube(state, { kohMl: t.kohMl + ml });
    const before = gasVolume(activeConditions(t), t.elapsedMin);
    const after = gasAfterKoh(before, t.kohMl + ml);

    if (!t.drained) {
      return happened(next,
        `팽대부의 용액을 빼내지 않은 채로 ${KOH_PCT} % 수산화 칼륨 수용액을 넣었습니다. `
        + '용액이 넘칩니다. 스포이트로 먼저 빼내면 깨끗하게 볼 수 있습니다.', 'koh-without-drain');
    }
    if (before <= 0) {
      return happened(next,
        `${KOH_PCT} % 수산화 칼륨 수용액을 넣었습니다. 맹관부에 모인 기체가 없어 줄어들 것도 없습니다.`,
        'koh-no-gas');
    }
    return ok(next,
      `${KOH_PCT} % 수산화 칼륨 수용액 ${ml} mL 를 넣었습니다. 맹관부의 기체가 `
      + `${before.toFixed(1)} mL 에서 ${after.toFixed(1)} mL 로 줄었습니다.`, 'koh-added');
  },

  /* ---------------- 되돌아갈 길 ---------------- */

  /**
   * 발효관을 비운다. 다음 시행으로 가는 길이다.
   *
   * **되돌아갈 길은 이 하나로 충분하다.** 「새 발효관 꺼내기」를 따로 두었다가 지웠다 —
   * 이 실험에서는 발효관이 깨질 일이 없어서(항온기 최고가 55 ℃ 다) 새것이 필요한 자리가
   * 없고, 하는 일이 같은 조작 둘은 학생에게 「무엇이 다르지?」만 남긴다.
   */
  EMPTY_TUBE(state) {
    return ok(withBench(state, { tube: initialTube() }),
      '발효관을 비웠습니다. 처음부터 다시 준비할 수 있습니다.', 'tube-emptied');
  },

  /* ---------------- 시행 ---------------- */

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
    const t = state.bench.tube;
    if (t.runConditions === null) {
      return happened(state, '아직 발효를 시작하지 않았습니다. 발효관을 항온기에 넣으세요.');
    }
    if (t.elapsedMin < OBSERVE_LIMIT_MIN) {
      return happened(state,
        `아직 ${t.elapsedMin.toFixed(0)}분입니다. ${OBSERVE_LIMIT_MIN}분을 채우면 기록할 수 있습니다.`,
        'still-running');
    }
    // **잰 순간의 조건**으로 기록한다. 발효관의 지금 조건이 아니다 (state.js 의 runConditions).
    const conditions = activeConditions(t);
    const at = state.session.trialSeq;
    const trial = {
      at,
      conditions,
      minutes: OBSERVE_LIMIT_MIN,
      gasMl: gasVolume(conditions, OBSERVE_LIMIT_MIN),
      // 이산화 탄소를 확인했는가. 확인 안 한 시행도 그대로 기록된다 — 안 한 것이 남을 뿐이다.
      kohChecked: t.kohMl > 0 && t.drained,
      offDesign: offDesign(state.design, conditions),
      independent: state.design.independent,
    };
    const next = withSession({ ...state, trials: [...state.trials, trial] },
      { trialSeq: state.session.trialSeq + 1 });

    if (trial.gasMl <= 0) {
      return happened(next, '기체가 모이지 않았습니다. 그대로 기록했습니다.', 'recorded-nogas');
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
  // TICK 은 주기마다 새 객체를 돌려주지만 학생이 한 조작이 아니다.
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
