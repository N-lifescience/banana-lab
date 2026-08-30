/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 */

import * as fermtube from './fermtube.js';
import * as incubator from './incubator.js';
import * as cotton from './cotton.js';
import * as dropper from './dropper.js';
import * as bottle from './bottle.js';
import * as waste from './waste.js';
import * as bin from './bin.js';
import * as tissue from './tissue.js';
import * as bench from './bench.js';

export const ASSETS = {
  fermtube, incubator, cotton, dropper, bottle, waste, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 */
export const PENDING = [];

/** 린터와 UI가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다. */
export const SAMPLE_STATES = {
  fermtube: [
    { fill: 0, liquid: null },
    { fill: 0, liquid: 'GLUCOSE', level: 0.5 },
    { fill: 0.15, liquid: 'BREW', level: 0.6, plugged: true, bubbling: true },
    { fill: 0.6, liquid: 'BREW', level: 0.6, plugged: true },
    { fill: 0.6, liquid: 'KOH', level: 0.4, drained: true },
  ],
  // 다섯 항온기. 몸통 색은 다 같고 눈금만 다르다 — 색으로 온도를 말하지 않는다.
  incubator: [{ tempC: 10 }, { tempC: 20 }, { tempC: 30 }, { tempC: 40 }, { tempC: 55 }],
  cotton: [{}],
  dropper: [{ holds: null }, { holds: 'BREW', level: 0.6 }],
  bottle: [
    { kind: 'GLUCOSE', pct: 10, level: 0.8 },
    { kind: 'WATER', level: 0.9 },
    { kind: 'MIX', level: 0 },
    { kind: 'MIX', pct: 5, level: 0.5 },
    { kind: 'YEAST', level: 0.7 },
    { kind: 'KOH', level: 0.6, capOpen: true },
  ],
  waste: [{ level: 0 }, { level: 0.6 }],
  bin: [{ fill: 0 }, { fill: 1 }],
  tissue: [{ used: 0 }, { used: 3 }],
  bench: [{}],
};
