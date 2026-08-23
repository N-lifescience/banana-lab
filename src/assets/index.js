/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 */

import * as banana from './banana.js';
import * as slide from './slide.js';
import * as coverslip from './coverslip.js';
import * as dropper from './dropper.js';
import * as forceps from './forceps.js';
import * as bottle from './bottle.js';
import * as microscope from './microscope.js';
import * as dish from './dish.js';
import * as waste from './waste.js';
import * as sink from './sink.js';
import * as bin from './bin.js';
import * as tissue from './tissue.js';
import * as bench from './bench.js';

export const ASSETS = {
  banana, slide, coverslip, dropper, forceps, bottle,
  microscope, dish, waste, sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 * 붙여 넣을 지시는 tasks/T12-PROMPT.md 에 있다.
 */
export const PENDING = [];

/** 린터와 UI가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다. */
export const SAMPLE_STATES = {
  banana: [
    { ripe: 0.1, peel: 0 },
    { ripe: 0.35, peel: 0 },
    { ripe: 0.9, peel: 0 },
    { ripe: 0.35, peel: 0.7 },
  ],
  slide: [
    { sample: null },
    { sample: { thickness: 0.3 }, stain: null },
    { sample: { thickness: 0.3 }, stain: 'IKI', reaction: 1 },
    { sample: { thickness: 0.3 }, stain: 'IKI', reaction: 1, coverslip: true, bubbles: 3 },
  ],
  coverslip: [{ angle: 45 }, { angle: 90 }],
  dropper: [{ holds: null }, { holds: 'IKI', level: 1 }, { holds: 'SUDAN3', level: 0.4 }],
  forceps: [{ closed: false }, { closed: true, holding: 'coverslip' }],
  bottle: [{ kind: 'IKI', level: 1 }, { kind: 'SUDAN3', level: 0.3, capOpen: true }],
  microscope: [
    { objective: 4, diaphragm: 0.6, lamp: true },
    { objective: 40, diaphragm: 1, lamp: true, stage: 'B' },
  ],
  dish: [{ contents: [] }],
  waste: [{ level: 0 }, { level: 0.6 }],
  sink: [{ water: 0 }, { water: 1 }],
  bin: [{ fill: 0 }, { fill: 1 }],
  tissue: [{ used: 0 }],
  bench: [{}],
};
