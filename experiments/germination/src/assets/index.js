/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 */

import * as chamber from './chamber.js';
import * as sensor from './sensor.js';
import * as beanjar from './beanjar.js';
import * as scoop from './scoop.js';
import * as bottle from './bottle.js';
import * as waste from './waste.js';
import * as sink from './sink.js';
import * as bin from './bin.js';
import * as tissue from './tissue.js';
import * as bench from './bench.js';

export const ASSETS = {
  chamber, sensor, beanjar, scoop, bottle, waste, sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 * 비어 있으면 전부 제 그림이다.
 */
export const PENDING = [];

/**
 * 린터와 하네스가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다.
 *
 * **상태마다 한 칸씩** 하네스 애셋 시트에 나온다. 한 상태만 두면
 * 「상태가 눈에 보이는가」를 사람이 볼 수가 없다 — 밀봉한 챔버와 안 한 챔버가
 * 같아 보여도 모른다. 그래서 **갈려야 하는 것끼리 나란히** 두었다.
 */
export const SAMPLE_STATES = {
  chamber: [
    { beans: null, scoops: 0, btbStage: null, sensor: 'none', sensorDepth: null, sealed: false, tempFill: 0, seed: 11 },
    // 센서를 꽂고 **밀봉을 잊은** 챔버. 바로 아래 밀봉한 칸과 나란히 두어,
    // 이 실험에서 가장 흔한 실수가 그림에서 갈리는지 사람이 눈으로 본다.
    { beans: 'sprout', scoops: 2, btbStage: 'blue', sensor: 'clear', sensorDepth: 0.35, sealed: false, tempFill: 0, seed: 24 },
    { beans: 'sprout', scoops: 2, btbStage: 'yellow', sensor: 'clear', sensorDepth: 0.35, sealed: true, tempFill: 0.8, seed: 24 },
    { beans: 'dry', scoops: 2, btbStage: 'blue', sensor: 'clear', sensorDepth: 0.35, sealed: true, tempFill: 0.05, seed: 57 },
    { beans: 'sprout', scoops: 5, btbStage: 'green', sensor: 'buried', sensorDepth: 0.85, sealed: true, tempFill: 0.5, seed: 68 },
    // 마른 콩을 가득 넣고 센서를 바닥까지 밀어 넣은 것. 「가득 차면 얕게 꽂아야 한다」가
    // 그림에서 보이는지 본다 — 두 조작이 서로 물려 있는 자리다.
    { beans: 'dry', scoops: 6, btbStage: 'blue', sensor: 'buried', sensorDepth: 1, sealed: true, tempFill: 0.05, seed: 92 },
  ],
  // 시드를 밝혀 두면 하네스에서 같은 그림이 고정돼, 그림을 고칠 때 앞뒤를 견줄 수 있다.
  sensor: [
    { on: false, fouled: false, seed: 3 },
    { on: true, fouled: false, seed: 3 },
    { on: true, fouled: true, seed: 12 },
  ],
  beanjar: [
    { kind: 'sprout', level: 0.8, seed: 21 },
    { kind: 'dry', level: 0.8, seed: 21 },
    { kind: 'sprout', level: 0.4, capOpen: true, seed: 21 },
  ],
  scoop: [{ holds: null }, { holds: 'sprout', seed: 5 }, { holds: 'dry', seed: 9 }],
  bottle: [{ kind: 'BTB', level: 1 }, { kind: 'BTB', level: 0.3, capOpen: true }],
  waste: [{ level: 0 }, { level: 0.6 }],
  sink: [{ water: 0 }, { water: 1 }],
  bin: [{ fill: 0 }, { fill: 1 }],
  tissue: [{ used: 0 }],
  bench: [{}],
};
