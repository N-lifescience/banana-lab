/**
 * 상태 모델. 이 파일은 DOM 을 모른다 — `document`·`window`·`Date.now()`·`Math.random()`
 * 을 쓰면 안 된다. 그래야 `node --test` 로 규칙을 검증할 수 있다.
 *
 * docs/03-state-model.md 참조 (예시는 바나나랩 것이다. 구조만 같다).
 */

import {
  ATMOSPHERIC_CO2_PPM, ROOM_TEMP_C, OBSERVE_LIMIT_MIN,
  sensorReading, btbStage,
} from './metabolism.js';

export { OBSERVE_LIMIT_MIN, ATMOSPHERIC_CO2_PPM, ROOM_TEMP_C };

/* ------------------------------------------------------------------ */
/* 이 실험의 몸통 — 챔버 둘                                             */
/* ------------------------------------------------------------------ */

/**
 * 나란히 놓인 바이오챔버 둘. **왼쪽·오른쪽일 뿐 이름에 뜻이 없다.**
 *
 * 「발아 콩 챔버」·「마른 콩 챔버」로 이름 짓지 않는다. 어느 쪽에 무엇을 넣을지는
 * 학생이 정하는 것이고, 이름이 먼저 정해져 있으면 화면이 답을 미리 말하는 꼴이 된다.
 */
export const CHAMBERS = ['L', 'R'];

/** 콩 두 갈래. **이 실험에서 다르게 두는 것은 이것 하나뿐이다** (조작변인). */
export const BEAN_KINDS = { SPROUT: 'sprout', DRY: 'dry' };

/** 센서가 어디에 있는가. `buried` 는 콩에 닿은 것 — 막지 않고 신호가 튄다. */
export const SENSOR = { NONE: 'none', CLEAR: 'clear', BURIED: 'buried' };

/**
 * 챔버가 담을 수 있는 숟갈 수.
 *
 * 이 값은 **부피가 아니라 칸 수**다 (`AGENTS.md` §2.4 — mL 을 지어내지 않는다).
 * 콩이 쌓인 높이를 이 값으로 나눠 내고, 센서가 그 높이 아래로 내려가면 닿은 것이 된다.
 * 그래서 **많이 넣을수록 얕게 꽂아야 한다** — 두 조작이 서로 물려 있다.
 */
export const MAX_SCOOPS = 6;

/** 뚜껑. `sealed` 여야 CO₂ 가 쌓인다. */
export const LID = { OPEN: 'open', SEALED: 'sealed' };

export function initialChamber(id, seed = 0) {
  return {
    id,
    seed,
    // null 은 「아직 안 넣었다」다. 0 숟갈과 다르다 — 학생이 한 일이 다르므로
    // 화면이 다른 말을 해야 한다.
    beans: null,
    scoops: 0,
    /** 두 갈래를 섞어 넣었는가. 막지 않는다 — 섞인 챔버로는 무엇도 말할 수 없다는 것이 답이다. */
    mixed: false,
    btb: false,
    /** 센서를 꽂았는가. 깊이는 따로 둔다 — 콩을 더 넣으면 같은 깊이가 닿게 될 수 있다. */
    sensorIn: false,
    /** 뚜껑에서 잰 깊이. 0 = 뚜껑 바로 밑, 1 = 바닥. */
    sensorDepth: 0.35,
    /** 콩에서 빼낸 센서에 부스러기가 묻어 있는가. 닦으면 지워진다 (되돌아갈 길). */
    sensorFouled: false,
    lid: LID.OPEN,
    running: false,
    elapsedMin: 0,
    /**
     * **챔버 안에서 지금 실제로 어떤가.** 센서와 무관하다.
     *
     * 경과 시간에서 그때그때 다시 계산하지 않고 **값을 들고 간다.** 재는 도중에 뚜껑을
     * 열면 다시 계산한 값은 그 자리에서 수직으로 뚝 떨어지는데 — 2 000 ppm 이던 챔버가
     * 한순간에 600 ppm 이 된다 — 그런 일은 없다. 거기서부터 새어 나가기 시작할 뿐이다.
     * `metabolism.advance()` 가 한 걸음씩 나아간다.
     */
    co2Ppm: ATMOSPHERIC_CO2_PPM,
    tempC: ROOM_TEMP_C,
    /**
     * 센서가 읽어 쌓은 값. `[{ min, co2Ppm, tempC }]`
     *
     * **쌓고 나서 조건을 바꿔도 이미 쌓인 것은 그대로다.** 그것이 그때 잰 값이기 때문이다.
     * 도중에 뚜껑을 열면 그 뒤부터 곡선이 꺾인다 — 그 꺾임을 보는 것이 이 실험이다.
     */
    samples: [],
    /** 관찰 시간을 다 채웠는가. 막는 것이 아니다 — 다시 시작할 수 있다. */
    finished: false,
  };
}

/* ------------------------------------------------------------------ */
/* 파생값 — 저장하지 않고 그때그때 계산한다                            */
/* ------------------------------------------------------------------ */

/** 콩이 챔버 안에서 차지한 높이 (0~1). 바닥에서 잰다. */
export const beanLevel = (ch) => Math.min(ch.scoops / MAX_SCOOPS, 1);

/**
 * 센서가 지금 어떤 상태인가.
 *
 * **저장하지 않고 그때그때 잰다.** 저장해 두면, 센서를 꽂아 놓고 콩을 더 부었을 때
 * 이미 파묻혔는데도 「닿지 않음」으로 남는다. 그 어긋남은 화면 어디에도 안 나온다.
 */
export function sensorState(ch) {
  if (!ch.sensorIn) return SENSOR.NONE;
  // 깊이는 뚜껑에서 재고 콩 높이는 바닥에서 잰다. 둘을 같은 자로 맞춰 견준다.
  return ch.sensorDepth > 1 - beanLevel(ch) ? SENSOR.BURIED : SENSOR.CLEAR;
}

/**
 * 챔버 상태 → `metabolism.js` 가 받는 조건 한 벌.
 *
 * **이 함수가 유일한 통로다.** 그림도 계산도 기록도 전부 여기를 거친다.
 * 챔버 상태를 직접 읽는 코드가 따로 생기면, 조건을 하나 더할 때 두 곳이 어긋난다.
 */
export function chamberConditions(ch) {
  return {
    beans: ch.beans,
    scoops: ch.scoops,
    sealed: ch.lid === LID.SEALED,
    sensor: sensorState(ch),
    fouled: ch.sensorFouled,
    seed: ch.seed,
    lane: ch.id === 'L' ? 1 : 2,
  };
}

/**
 * 렌더러에 넘길 값만 추린 뷰. **이 객체가 챔버 그림을 완전히 결정한다.**
 *
 * `co2Ppm`·`tempC` 는 **챔버 안에서 실제로 일어난 일**이다 (센서와 무관).
 * BTB 색과 온도계는 이 값을 쓴다 — 센서를 안 꽂아도 색은 변하고 온도는 오른다.
 * 센서가 읽은 값(`reading`)은 그래프가 쓴다. 둘은 다를 수 있고, 다른 것이 요점이다.
 */
export function chamberView(ch) {
  const cond = chamberConditions(ch);
  const truth = { co2Ppm: ch.co2Ppm, tempC: ch.tempC };
  return {
    id: ch.id,
    // 알갱이를 흩는 데 쓴다. 챔버마다 달라야 두 그림이 판박이로 보이지 않는다.
    seed: ch.seed,
    beans: ch.beans,
    scoops: ch.scoops,
    mixed: ch.mixed,
    btb: ch.btb,
    beanLevel: beanLevel(ch),
    sensor: sensorState(ch),
    sensorDepth: ch.sensorIn ? ch.sensorDepth : null,
    sensorFouled: ch.sensorFouled,
    sealed: cond.sealed,
    running: ch.running,
    finished: ch.finished,
    elapsedMin: ch.elapsedMin,
    co2Ppm: truth.co2Ppm,
    tempC: truth.tempC,
    // BTB 를 안 넣었으면 색 칸이 **없다.** 「투명」이 아니라 없는 것이다.
    btbStage: ch.btb ? btbStage(truth.co2Ppm) : null,
    reading: sensorReading(cond, ch.elapsedMin, truth),
    samples: ch.samples,
  };
}

/* ------------------------------------------------------------------ */
/* 대조가 성립하는가 — 이 실험이 가르치려는 것                          */
/* ------------------------------------------------------------------ */

/**
 * 두 챔버에서 **같아야 하는 것들** (통제변인).
 *
 * 조작변인은 `beans` 하나뿐이고 여기 들어가지 않는다 — 그것은 **달라야** 한다.
 */
export const CONTROL_KEYS = ['scoops', 'btb', 'sealed', 'sensor'];

export function controlValues(ch) {
  const c = chamberConditions(ch);
  return { scoops: ch.scoops, btb: ch.btb, sealed: c.sealed, sensor: c.sensor };
}

/**
 * 두 챔버에서 어긋난 통제변인의 목록.
 *
 * **막는 데 쓰지 않는다.** 결과 화면이 이 목록을 읽어 **무엇이 어떻게 어긋났는지
 * 값과 함께** 말한다. 「통제변인이 다릅니다」로는 무엇을 고쳐야 할지 알 수 없다.
 * 어긋난 채로 잰 결과를 보는 것이 이 실험이 가르치려는 것이다.
 */
export function mismatches(state) {
  const a = controlValues(state.chambers.L);
  const b = controlValues(state.chambers.R);
  return CONTROL_KEYS.filter((k) => a[k] !== b[k]);
}

/**
 * 지금 두 챔버로 무엇을 말할 수 있는가.
 *
 *   `empty`        아직 콩을 안 넣었다 — 나무라는 것이 아니라 아직 시작 전이다
 *   `same-beans`   양쪽에 같은 것을 넣었다. 대조가 아니라 되풀이다
 *   `mixed`        한쪽에 두 갈래가 섞였다. 그 챔버가 무엇인지 말할 수 없다
 *   `off-control`  조작변인 말고도 다른 것이 다르다 — 차이의 원인을 가릴 수 없다
 *   `ok`           콩의 상태만 다르다. 이제 「콩의 상태 때문이다」라고 말할 수 있다
 */
export function comparisonKind(state) {
  const { L, R } = state.chambers;
  if (L.mixed || R.mixed) return 'mixed';
  if (!L.beans || !R.beans) return 'empty';
  if (L.beans === R.beans) return 'same-beans';
  if (mismatches(state).length > 0) return 'off-control';
  return 'ok';
}

/* ------------------------------------------------------------------ */
/* 세션                                                                */
/* ------------------------------------------------------------------ */

/**
 * 난이도별 되돌리기 횟수.
 * 1단계는 마음껏 시도하게 두고, 올라갈수록 한 번의 조작을 무겁게 만든다.
 */
export const UNDO_LIMITS = { 1: Infinity, 2: 3, 3: 1 };

/** 되돌리기용 상태 스냅샷 보관 개수 */
export const HISTORY_LIMIT = 20;

/**
 * 혼자 하는가, 모둠으로 하는가.
 *
 * 활동지가 갈린다 — 혼자 하는 학생에게 「다른 모둠의 결과와 비교해 보세요」를 물으면
 * 답할 수 없는 것을 묻는 셈이고, 빈칸으로 남은 문항은 「못 한 일」로 읽힌다.
 */
export const MODES = { SOLO: 'solo', GROUP: 'group' };

export function initialState(level = 1, seed = 20260827, mode = MODES.GROUP) {
  return {
    chambers: Object.fromEntries(
      CHAMBERS.map((id, i) => [id, initialChamber(id, seed + i * 977)])
    ),
    /** 숟가락이 지금 들고 있는 것. `null` 이면 비어 있다. */
    scoop: { holds: null },
    session: {
      level,
      seed,
      mode,
      step: '1a',
      notes: {},          // { '3b': '관찰 기록...' }
      /**
       * 기록해 둔 결과. `{ at, elapsedMin, comparison, mismatches, chambers: {L, R} }`
       *
       * 누르는 데 힘이 안 들어 금세 쌓인다. 무엇을 근거로 삼을지 고르는 것도 탐구의
       * 일부라 지우는 길을 함께 연다 (`DELETE_CAPTURE`).
       */
      captures: [],
      // 탐구 노트에서 **읽은** 단계. 실험대는 이것이 다 차야 열린다 (src/ui/bench.js).
      // 읽었다는 사실은 조작이 아니라서 되돌리기 기록에 쌓지 않는다.
      readStages: [],
      log: [],            // { at, action, outcome, tag } — 되돌아보기용. at 은 순번이다
      history: [],
      undosLeft: UNDO_LIMITS[level] ?? Infinity,
    },
  };
}

/** 두 챔버의 뷰 한 벌. 결과 화면과 기록이 함께 쓴다 — 두 벌을 만들면 어긋난다. */
export function chamberViews(state) {
  return Object.fromEntries(CHAMBERS.map((id) => [id, chamberView(state.chambers[id])]));
}
