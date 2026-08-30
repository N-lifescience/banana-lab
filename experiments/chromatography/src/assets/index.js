/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. **등록하지 않으면 검사도 되지 않는다.**
 * 반대로 안 쓰는 애셋을 남겨 두면 아트 시트와 린터가 계속 남의 그림을 검사한다.
 */

import * as leaf from './leaf.js';
import * as tube from './tube.js';
import * as paper from './paper.js';
import * as paperbox from './paperbox.js';
import * as capillary from './capillary.js';
import * as vial from './vial.js';
import * as pencil from './pencil.js';
import * as ruler from './ruler.js';
import * as bottle from './bottle.js';
import * as dish from './dish.js';
import * as waste from './waste.js';
import * as sink from './sink.js';
import * as bin from './bin.js';
import * as tissue from './tissue.js';
import * as bench from './bench.js';

export const ASSETS = {
  leaf, tube, paper, paperbox, capillary, vial, pencil, ruler,
  bottle, dish, waste, sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 */
export const PENDING = [];

/** 린터와 UI가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다. */
export const SAMPLE_STATES = {
  leaf: [{ fresh: 1 }, { fresh: 0.2 }],
  tube: [
    { leaf: 0, extract: 0, settleT: 0 },
    { leaf: 0.5, extract: 0.5, settleT: 0 },
    { leaf: 0.5, extract: 0.5, settleT: 1 },
    { leaf: 0.5, extract: 0.5, settleT: 1, capped: false },
  ],
  paper: [
    { origin: 25, spots: 0 },
    { origin: 25, spots: 12, spotMm: 2 },
    { origin: 25, spots: 12, spotMm: 10, wet: 0.8 },
  ],
  paperbox: [{}],
  capillary: [{ loaded: 0 }, { loaded: 1 }],
  vial: [
    { depth: 0, capped: false },
    { depth: 5, capped: true, hasPaper: true },
    { depth: 20, capped: false, hasPaper: true },
  ],
  pencil: [{}],
  ruler: [{}],
  bottle: [
    { kind: 'EXTRACT', level: 1 },
    { kind: 'SOLVENT', level: 0.6 },
    { kind: 'SOLVENT', level: 0.3, capOpen: true },
  ],
  dish: [{ contents: [] }],
  waste: [{ level: 0 }, { level: 0.6 }],
  sink: [{ water: 0 }, { water: 1 }],
  bin: [{ fill: 0 }, { fill: 1 }],
  tissue: [{ used: 0 }],
  bench: [{}],
};
