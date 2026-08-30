/**
 * 규칙 엔진.
 *
 * 이 프로젝트의 핵심 원칙: **강제하지 말고 결과로 답한다.**
 * 조작을 막는 대신 상태를 바꾸고, 무슨 일이 일어났는지 말한다.
 *
 * 결과 종류는 셋뿐이다:
 *   'ok'       뜻대로 됐다. 무엇이 바뀌었는지만 말한다. (말이 없을 수도 있다)
 *   'happened' 진행은 됐는데 뜻대로는 아니다. 무슨 일이 일어났는지 말한다. **대부분 여기다**
 *   'blocked'  진행되지 않았다. **아래 BLOCKING_REASONS 두 가지에만 허용된다.**
 *
 * 새 'blocked' 를 추가하려면 사람에게 먼저 물어볼 것. AGENTS.md §2.1 참조.
 */

import {
  CHAMBERS, BEAN_KINDS, SENSOR, LID, MAX_SCOOPS, HISTORY_LIMIT,
  initialChamber, sensorState, chamberConditions, chamberViews,
  comparisonKind, mismatches, beanLevel,
} from './state.js';
import { advance, sensorReading, OBSERVE_LIMIT_MIN } from './metabolism.js';

/**
 * 되돌리기 기록에 쌓지 않는 액션.
 *
 * 시간이 흐르는 것은 학생이 "한" 조작이 아니다. 이걸 쌓으면 1초마다 도는 TICK 이
 * 20칸짜리 기록을 몇 초 만에 밀어내고, 되돌리기 1회짜리 3단계에서는 그 한 번이
 * TICK 을 무르는 데 쓰여 사라진다.
 */
export const TRANSIENT_ACTIONS = new Set([
  'TICK', 'NOTE_PRACTICE', 'MARK_READ',
]);

/**
 * 연속 조작 — 끄는 동안 수십 번 디스패치된다.
 * 앞선 액션이 같은 종류면 기록을 새로 쌓지 않는다. 이미 쌓인 것이 끌기 전 상태이기 때문이다.
 */
export const CONTINUOUS_ACTIONS = new Set(['SET_SENSOR_DEPTH', 'SAVE_NOTE']);

/** 하드 게이트가 허용되는 단 두 가지 이유 */
export const BLOCKING_REASONS = {
  IMPOSSIBLE: 'impossible',   // 물리적으로 성립하지 않음 (닫힌 뚜껑 안으로 물체 넣기)
  BROKEN: 'broken',           // 기구가 파손돼 재제작이 필요함
};

/** 챔버를 부르는 짧은 이름. 화면 문구(strings.js)와 같은 표기를 쓴다. */
const CH_NAME = { L: '왼쪽 챔버', R: '오른쪽 챔버' };
const BEAN_NAME = { sprout: '발아 중인 콩', dry: '마른 콩' };

/**
 * 뚜껑이 닫혀 있어 할 수 없는 일.
 *
 * **빠져나갈 길을 문장에 담는다.** 「뚜껑을 여세요」로는 어디를 눌러야 여는지 알 수 없다 —
 * 어디로 가야 하는지까지 말한다. 이것이 허용되는 두 하드 게이트 중 하나(물리적으로
 * 성립하지 않는 동작)이고, 막는 대신 길을 알려 주는 것이 대가다.
 */
const lidClosedMessage = (id, what) =>
  `${CH_NAME[id]}의 뚜껑이 닫혀 있어 ${what} 넣을 수 없습니다. `
  + `${CH_NAME[id]}를 클릭해 확대 뷰를 열고 「뚜껑 열기」를 누르세요.`;

const ok = (state, message = null, tag = null) => ({ state, outcome: 'ok', message, tag });
const happened = (state, message, tag) => ({ state, outcome: 'happened', message, tag: tag ?? null });
const blocked = (state, message, reason) => {
  if (!Object.values(BLOCKING_REASONS).includes(reason)) {
    throw new Error(`허용되지 않은 차단 사유: ${reason}. AGENTS.md §2.1 을 읽으세요.`);
  }
  return { state, outcome: 'blocked', message, reason };
};

/** 얕은 복사로 불변성을 지킨다. reduce 는 부수효과가 없어야 한다. */
function withChamber(state, id, patch) {
  return { ...state, chambers: { ...state.chambers, [id]: { ...state.chambers[id], ...patch } } };
}

/**
 * 되돌리기용 스냅샷.
 * history 를 비워서 담는다 — 스냅샷 안에 또 history 가 들어가면 지수적으로 커진다.
 */
function snapshot(state) {
  return { ...state, session: { ...state.session, history: [] } };
}

/**
 * 실제 실험에서 해야 하는 일 — **적어 두기만 한다.**
 *
 * 문구를 `src/ui/strings.js` 가 아니라 여기 둔다. `src/sim/` 은 `src/ui/` 를 보지 않는다 —
 * 그 경계가 있어야 규칙을 `node --test` 로 검증할 수 있다. 다른 조작 문구도 전부 여기 있다.
 *
 * **앱은 이것을 확인하지 않는다**는 말을 문구마다 담는다. 안 밝히면 학생이
 * 「어딘가 채점되고 있나」 하고 눈치를 본다.
 */
const PRACTICE_NOTES = {
  waste: '실제 실험에서는 BTB 폐액을 싱크대에 붓지 않고 폐액통에 모읍니다. '
    + '이 앱은 그것을 확인하지 않습니다.',
  bin: '실제 실험에서는 쓰고 난 콩과 종이를 쓰레기통에 버리고, 실험대를 닦아 둡니다. '
    + '이 앱은 그것을 확인하지 않습니다.',
};

/* ------------------------------------------------------------------ */
/* 액션                                                                */
/* ------------------------------------------------------------------ */

export const ACTIONS = {

  /**
   * 숟가락에 콩을 담는다.
   *
   * 이미 다른 것을 들고 있으면 통에 도로 붓고 새로 담는다. 막을 이유가 없다 —
   * 실제로도 그렇게 한다.
   */
  SCOOP_BEANS(state, { kind }) {
    if (kind !== BEAN_KINDS.SPROUT && kind !== BEAN_KINDS.DRY) {
      return happened(state, '어느 통에서 담을지 알 수 없습니다.');
    }
    const had = state.scoop.holds;
    const next = { ...state, scoop: { holds: kind } };
    if (had && had !== kind) {
      return happened(next,
        `숟가락에 있던 ${BEAN_NAME[had]}을 통에 도로 붓고 ${BEAN_NAME[kind]}을 담았습니다.`,
        'scoop-swapped');
    }
    return ok(next, `숟가락에 ${BEAN_NAME[kind]}을 한 숟갈 담았습니다.`, 'scooped');
  },

  /**
   * 숟가락의 콩을 챔버에 붓는다.
   *
   * 두 갈래를 섞어 넣어도 **막지 않는다.** 섞인 챔버로는 아무것도 말할 수 없다는 것이
   * 답이고, 개수대에서 비우면 처음부터 다시 할 수 있다.
   */
  POUR_BEANS(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    if (ch.lid === LID.SEALED) {
      return blocked(state, lidClosedMessage(chamber, '콩을'), BLOCKING_REASONS.IMPOSSIBLE);
    }
    const kind = state.scoop.holds;
    if (!kind) {
      return happened(state,
        '숟가락이 비어 있어 아무것도 담기지 않았습니다. 콩 통에 가져다 대어 한 숟갈 담으세요.',
        'scoop-empty');
    }
    if (ch.scoops >= MAX_SCOOPS) {
      return happened({ ...state, scoop: { holds: null } },
        `${CH_NAME[chamber]}가 가득 차서 더 담기지 않고 실험대에 흘렀습니다 (${MAX_SCOOPS}숟갈).`,
        'chamber-full');
    }
    const mixed = ch.mixed || Boolean(ch.beans && ch.beans !== kind);
    const next = withChamber({ ...state, scoop: { holds: null } }, chamber, {
      beans: ch.beans ?? kind,
      scoops: ch.scoops + 1,
      mixed,
    });
    if (mixed) {
      return happened(next,
        `${CH_NAME[chamber]}에 두 가지 콩이 섞였습니다. 이 챔버의 변화가 어느 쪽 때문인지 말할 수 없습니다. `
        + '개수대에 대면 비우고 다시 시작할 수 있습니다.', 'beans-mixed');
    }
    const after = next.chambers[chamber];
    // 콩을 더 부어 **이미 꽂아 둔 센서가 파묻히는** 일이 실제로 생긴다.
    // 그때 아무 말이 없으면 그래프가 왜 튀는지 알 길이 없다.
    if (sensorState(ch) === SENSOR.CLEAR && sensorState(after) === SENSOR.BURIED) {
      return happened(next,
        `${CH_NAME[chamber]}에 ${BEAN_NAME[kind]}을 한 숟갈 더 넣어 ${after.scoops}숟갈이 됐습니다. `
        + '콩이 쌓여 센서 끝이 콩에 닿았습니다 — 신호가 튑니다. 확대 뷰에서 센서를 위로 끌어 올리세요.',
        'sensor-buried');
    }
    return ok(next,
      `${CH_NAME[chamber]}에 ${BEAN_NAME[kind]}을 넣었습니다. 지금까지 ${after.scoops}숟갈입니다.`,
      'poured');
  },

  /**
   * BTB 용액을 챔버에 붓는다.
   *
   * 안 넣어도 막지 않는다 — 색이 안 보이고 그래프만 남는 것이 답이다.
   * BTB 는 **재는 도구가 아니라 눈으로 보는 지시약**이라, 센서가 없어도 색은 변한다.
   */
  POUR_BTB(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    if (ch.lid === LID.SEALED) {
      return blocked(state, lidClosedMessage(chamber, 'BTB 용액을'), BLOCKING_REASONS.IMPOSSIBLE);
    }
    if (ch.btb) return happened(state, `${CH_NAME[chamber]}에는 이미 BTB 용액이 들어 있습니다.`);
    return ok(withChamber(state, chamber, { btb: true }),
      `${CH_NAME[chamber]} 바닥 접시에 BTB 용액을 넣었습니다.`, 'btb-added');
  },

  /**
   * 센서를 꽂는다. 깊이는 확대 뷰에서 정한다.
   *
   * 처음 꽂을 때는 **지금 콩 높이에 닿지 않는 자리**에 놓는다. 꽂자마자 파묻힌 채로
   * 시작하면 학생은 자기가 무엇을 잘못했는지 모른 채 튀는 그래프부터 본다.
   * 그 뒤로 콩을 더 부으면 닿을 수 있고, 그때는 `POUR_BEANS` 가 말해 준다.
   */
  INSTALL_SENSOR(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    if (ch.lid === LID.SEALED) {
      return blocked(state, lidClosedMessage(chamber, '센서를'), BLOCKING_REASONS.IMPOSSIBLE);
    }
    if (ch.sensorIn) {
      return happened(state, `${CH_NAME[chamber]}에는 이미 센서가 꽂혀 있습니다.`);
    }
    const safe = Math.max(0.1, Math.min(ch.sensorDepth, (1 - beanLevel(ch)) - 0.1));
    return ok(withChamber(state, chamber, { sensorIn: true, sensorDepth: safe }),
      `${CH_NAME[chamber]}에 센서를 꽂았습니다. 확대 뷰에서 센서를 위아래로 끌어 깊이를 정하세요.`,
      'sensor-in');
  },

  /**
   * 센서 깊이를 정한다 (확대 뷰에서 끄는 동안 수십 번 들어온다).
   *
   * 콩에 닿는 깊이도 **막지 않는다.** 닿으면 신호가 튀고, 튀는 그래프를 보는 것이
   * 「센서를 콩에 닿지 않게」의 이유다.
   */
  SET_SENSOR_DEPTH(state, { chamber, depth }) {
    const ch = state.chambers[chamber];
    if (!ch || !ch.sensorIn) return happened(state, '꽂혀 있는 센서가 없습니다.');
    /*
     * **끝까지 갔는데 아무 말이 없으면 고장으로 읽힌다.**
     *
     * 깊이는 0~1 로 잘린다. 그런데 끝에 닿은 뒤로는 계속 눌러도 값도 화면도 그대로였다 —
     * 재어 보니 **양 끝에서 스무 번을 더 눌러도 한 마디도 없었다.**
     * 학생은 손잡이가 고장 났다고 생각한다.
     *
     * **막지 않는다.** 자르는 것은 그대로 두고 **왜 안 움직이는지만** 말한다.
     * 그리고 **어디까지 왔는지**를 말한다 — 「더 못 간다」만으로는 무엇을 하라는 건지 모른다.
     * (micrometer 세션이 미동나사에서 찾았다)
     */
    const clamped = Math.max(0, Math.min(1, depth));
    /*
     * **남은 만큼은 먼저 움직인 뒤에 말한다.**
     *
     * 0.02 에서 끝까지 밀었는데 「끝입니다」만 하고 상태를 통째로 되돌리면, 손잡이가
     * 0.02 에 얼어붙어 **0 에 영영 못 닿는다.** 말을 붙이면서 손잡이를 얼려 버리면
     * 고침이 아니라 새 결함이다. 그래서 자른 값을 **먼저 넣고**, 그 위에서 말한다.
     * (osmosis 세션이 자기 저장소에서 그렇게 얼어붙는 것을 잡았다)
     */
    const next = withChamber(state, chamber, { sensorDepth: clamped });
    // 콩에 닿은 것이 더 무거운 소식이다 — 끝에 닿은 것보다 먼저 말한다.
    if (sensorState(next.chambers[chamber]) === SENSOR.BURIED && sensorState(ch) !== SENSOR.BURIED) {
      return happened(next, '센서 끝이 콩에 닿았습니다. 이대로 재면 신호가 튑니다.', 'sensor-buried');
    }
    if (depth !== clamped) {
      return happened(next,
        depth > 1
          ? '센서가 가장 깊은 자리입니다. 더 내려가지 않습니다 — 위로 올리려면 반대 방향으로 미세요.'
          : '센서가 가장 얕은 자리입니다. 더 올라가지 않습니다 — 아래로 내리려면 반대 방향으로 미세요.',
        'sensor-depth-end');
    }
    return ok(next);
  },

  /**
   * 센서를 뺀다. 되돌아갈 길이다.
   *
   * 콩에 파묻혀 있던 센서를 빼면 **부스러기가 묻어 온다.** 닦지 않으면 그 뒤로도
   * 값이 조금씩 튄다 — 실제로도 그렇고, 휴지가 할 일이 생긴다.
   */
  REMOVE_SENSOR(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch || !ch.sensorIn) return happened(state, '꽂혀 있는 센서가 없습니다.');
    if (ch.lid === LID.SEALED) {
      return blocked(state,
        `${CH_NAME[chamber]}의 뚜껑이 닫혀 있어 센서를 뺄 수 없습니다. `
        + `${CH_NAME[chamber]}를 클릭해 확대 뷰를 열고 「뚜껑 열기」를 누르세요.`,
        BLOCKING_REASONS.IMPOSSIBLE);
    }
    const fouled = ch.sensorFouled || sensorState(ch) === SENSOR.BURIED;
    const next = withChamber(state, chamber, { sensorIn: false, sensorFouled: fouled });
    if (fouled && !ch.sensorFouled) {
      return happened(next,
        '센서를 뺐습니다. 끝에 콩 부스러기가 묻어 있어 이대로 다시 꽂으면 값이 조금씩 튑니다. '
        + '휴지에 가져다 대어 닦으세요.', 'sensor-fouled');
    }
    return ok(next, `${CH_NAME[chamber]}에서 센서를 뺐습니다.`, 'sensor-out');
  },

  /** 센서를 닦는다. 부스러기가 지워진다. */
  WIPE_SENSOR(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 센서인지 알 수 없습니다.');
    if (!ch.sensorFouled) return ok(state, '센서는 깨끗합니다.');
    return ok(withChamber(state, chamber, { sensorFouled: false }),
      `${CH_NAME[chamber]} 센서를 닦았습니다. 값이 다시 안정됩니다.`, 'sensor-wiped');
  },

  /** 뚜껑을 닫아 밀봉한다. */
  SEAL(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    if (ch.lid === LID.SEALED) return ok(state, `${CH_NAME[chamber]}는 이미 밀봉돼 있습니다.`);
    return ok(withChamber(state, chamber, { lid: LID.SEALED }),
      `${CH_NAME[chamber]}를 밀봉했습니다.`, 'sealed');
  },

  /**
   * 뚜껑을 연다.
   *
   * 재는 도중에 열어도 막지 않는다 — CO₂ 가 새어 나가 곡선이 그 자리에서 꺾인다.
   * 그 꺾임을 보는 것이 「밀봉」이 왜 통제변인인지에 대한 답이다.
   */
  OPEN_LID(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    if (ch.lid === LID.OPEN) return ok(state, `${CH_NAME[chamber]}는 이미 열려 있습니다.`);
    const next = withChamber(state, chamber, { lid: LID.OPEN });
    if (ch.running) {
      return happened(next,
        `재는 도중에 ${CH_NAME[chamber]}의 뚜껑을 열었습니다. CO₂ 가 새어 나가 그래프가 여기서 꺾입니다.`,
        'opened-while-running');
    }
    return ok(next, `${CH_NAME[chamber]}의 뚜껑을 열었습니다.`, 'lid-open');
  },

  /**
   * 측정을 시작한다.
   *
   * 밀봉하지 않아도, 센서가 없어도, 콩이 없어도 **막지 않는다.**
   * 밀봉 안 함 → CO₂ 가 새어 그래프가 이내 평평해진다.
   * 센서 없음 → 그래프에 아무것도 안 쌓인다. **그래도 BTB 색은 변한다** —
   *   센서는 재는 도구이지 일어나는 일이 아니다. 그 둘을 갈라 보는 것이 배울 거리다.
   */
  START(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    if (ch.running) return ok(state, `${CH_NAME[chamber]}는 이미 재고 있습니다.`);
    const next = withChamber(state, chamber, { running: true, finished: false });
    const notes = [];
    if (ch.lid !== LID.SEALED) notes.push('뚜껑이 열려 있어 CO₂ 가 새어 나갑니다');
    if (!ch.sensorIn) notes.push('센서가 없어 그래프에는 아무것도 쌓이지 않습니다');
    if (!ch.beans) notes.push('콩이 들어 있지 않습니다');
    if (notes.length) {
      return happened(next,
        `${CH_NAME[chamber]}의 측정을 시작했습니다 — ${notes.join(', ')}.`, 'started-incomplete');
    }
    return ok(next, `${CH_NAME[chamber]}의 측정을 시작했습니다.`, 'started');
  },

  /** 측정을 멈춘다. 쌓인 값은 그대로 남는다 — 그때 잰 값이기 때문이다. */
  STOP(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch || !ch.running) return ok(state);
    return ok(withChamber(state, chamber, { running: false }),
      `${CH_NAME[chamber]}의 측정을 멈췄습니다.`, 'stopped');
  },

  /**
   * 시간이 흐른다. **재고 있는 챔버에만** 흐른다.
   *
   * 값을 쌓을 때는 **그 순간의 조건**으로 계산한다. 그래서 도중에 뚜껑을 열면
   * 그 뒤부터 곡선이 꺾이고, **이미 쌓인 값은 그대로 남는다.**
   */
  TICK(state, { minutes = 1 }) {
    const chambers = { ...state.chambers };
    let changed = false;
    let hitLimit = null;
    for (const id of CHAMBERS) {
      const ch = chambers[id];
      if (!ch.running) continue;
      changed = true;
      const step = Math.min(minutes, OBSERVE_LIMIT_MIN - ch.elapsedMin);
      const elapsedMin = ch.elapsedMin + step;
      const cond = chamberConditions(ch);
      // **지금 값에서 지금 조건으로** 한 걸음 나아간다. 경과 시간으로 다시 계산하면
      // 도중에 뚜껑을 연 순간 곡선이 수직으로 떨어진다 (metabolism.advance 머리말).
      const truth = advance(cond, { co2Ppm: ch.co2Ppm, tempC: ch.tempC }, step);
      const samples = sensorState(ch) === SENSOR.NONE
        ? ch.samples
        : [...ch.samples, { min: elapsedMin, ...sensorReading(cond, elapsedMin, truth) }];
      const finished = elapsedMin >= OBSERVE_LIMIT_MIN;
      if (finished) hitLimit = id;
      chambers[id] = { ...ch, ...truth, elapsedMin, samples, running: !finished, finished };
    }
    if (!changed) return ok(state);
    const next = { ...state, chambers };
    if (hitLimit) {
      return happened(next,
        `${CH_NAME[hitLimit]}가 관찰 시간(${OBSERVE_LIMIT_MIN}분)을 다 채워 측정을 멈췄습니다. `
        + '다시 시작할 수도, 개수대에서 비우고 처음부터 할 수도 있습니다.', 'observe-limit');
    }
    return ok(next);
  },

  /**
   * 개수대에서 챔버를 비운다.
   *
   * **막다른 길을 만들지 않는다.** 콩을 섞었거나 양을 잘못 넣었을 때 처음으로 돌아가는
   * 유일한 길이다. 이것이 없으면 한 번의 실수가 곧 끝이 되고, 그건 결과로 답한 것이
   * 아니라 그냥 막힌 것이다. 센서에 묻은 부스러기는 **남는다** — 그건 휴지로 닦는다.
   */
  EMPTY_CHAMBER(state, { chamber }) {
    const ch = state.chambers[chamber];
    if (!ch) return happened(state, '어느 챔버인지 알 수 없습니다.');
    const fresh = { ...initialChamber(chamber, ch.seed), sensorFouled: ch.sensorFouled };
    return ok({ ...state, chambers: { ...state.chambers, [chamber]: fresh } },
      `${CH_NAME[chamber]}를 비우고 헹궜습니다. 처음부터 다시 꾸밀 수 있습니다.`, 'chamber-emptied');
  },

  /**
   * 지금 두 챔버의 상태를 기록한다.
   *
   * 기록은 그때 본 것을 **그대로 다시 그릴 수 있는** 값 한 벌이다. 챔버 그림도 그래프도
   * 이 하나에서 되살아나므로, 탐구 노트와 보고서가 두 벌을 따로 만들지 않는다.
   *
   * 대조가 성립하지 않는 상태도 그대로 기록된다. **막지 않는다** —
   * 무엇이 어긋났는지 함께 적어 두고, 그것을 보는 것이 이 실험이다.
   */
  RECORD(state) {
    const views = chamberViews(state);
    const nextAt = state.session.captures.reduce((n, c) => Math.max(n, (c.at ?? -1) + 1), 0);
    const capture = {
      at: nextAt,
      elapsedMin: Math.max(views.L.elapsedMin, views.R.elapsedMin),
      comparison: comparisonKind(state),
      mismatches: mismatches(state),
      chambers: views,
    };
    const next = {
      ...state,
      session: { ...state.session, captures: [...state.session.captures, capture] },
    };
    if (capture.comparison !== 'ok') {
      return happened(next,
        `기록했습니다 (${next.session.captures.length}번째). 지금은 두 챔버를 곧바로 견줄 수 없는 상태입니다 — `
        + '탐구 노트 「5. 결과」 에 무엇이 어긋났는지 적혀 있습니다.', 'recorded-off');
    }
    return ok(next,
      `두 챔버의 결과를 기록했습니다. 지금까지 ${next.session.captures.length}개입니다.`, 'recorded');
  },

  /**
   * 기록을 지운다.
   *
   * `at` 은 기록이 만들어질 때 한 번 붙는 번호다. 배열 인덱스로 지우면 안 된다 —
   * 앞엣것을 지운 순간 뒤엣것들의 인덱스가 밀려, 그 기록에 딸린 답이 남의 것이 된다.
   */
  DELETE_CAPTURE(state, { at }) {
    const captures = state.session.captures.filter((c) => c.at !== at);
    if (captures.length === state.session.captures.length) {
      return happened(state, '그 기록은 이미 없습니다.');
    }
    const notes = { ...state.session.notes };
    delete notes[`read.${at}`];
    return ok({ ...state, session: { ...state.session, captures, notes } },
      '기록을 지웠습니다.', 'capture-deleted');
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

  /**
   * 실제 실험에서 해야 하는 일을 **말해 준다.** 판정하지 않는다.
   *
   * 앞서는 손 씻기·마개 닫기·폐액 버리기를 조작으로 두고 **지켰는지 세었다.** 그러면
   * 평가되는 것이 안전 습관이 아니라 **화면 속 단추를 눌렀다는 사실**이다 — 조작 순서
   * 외우기가 된다. 진짜 마개는 교실에서 닫는다. 그래서 세는 것을 전부 걷어내고,
   * 그 자리에 **가만히 적힌 안내**만 남겼다.
   *
   * 상태를 하나도 바꾸지 않는다. 기록도 점수도 남지 않는다 —
   * 누른 물건이 자기 쓰임을 한 번 말할 뿐이다.
   */
  NOTE_PRACTICE(state, { kind }) {
    const line = PRACTICE_NOTES[kind];
    if (!line) return ok(state);
    return ok(state, line, 'practice');
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
