/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 */

import * as onion from './onion.js';
import * as filterpaper from './filterpaper.js';
import * as blade from './blade.js';
import * as slide from './slide.js';
import * as coverslip from './coverslip.js';
import * as coverbox from './coverbox.js';
import * as slidebox from './slidebox.js';
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
  onion, blade, slide, coverslip, coverbox, slidebox, dropper, forceps, bottle,
  filterpaper, microscope, dish, waste, sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 * 하네스 애셋 시트에 「자리표시」로 표시된다.
 */
export const PENDING = [];

/** 린터와 UI가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다. */
export const SAMPLE_STATES = {
  // 어느 면인지가 색으로 갈리는 것을 애셋 시트에서 눈으로 대조해야 한다.
  onion: [
    { side: 'outer' },
    { side: 'outer', cut: true },
    { side: 'outer', cut: true, peeled: 1 },
    { side: 'inner' },
    { side: 'inner', cut: true, peeled: 1 },
  ],
  blade: [{}],
  filterpaper: [{ wet: 0 }, { wet: 1 }],
  slide: [
    { sample: null },
    { sample: { side: 'outer', thickness: 0.28 } },
    { sample: { side: 'inner', thickness: 0.28 }, medium: 'WATER' },
    { sample: { side: 'outer', thickness: 0.28 }, medium: 'WATER', coverslip: true, bubbles: 3 },
    { sample: { side: 'outer', thickness: 0.72 }, medium: 'S20', excess: 1 },
  ],
  coverslip: [{ angle: 45 }, { angle: 90 }],
  coverbox: [{}],
  slidebox: [{}],
  dropper: [{ holds: null }, { holds: 'WATER', level: 1 }, { holds: 'S15', level: 0.4 }],
  forceps: [{ closed: false }, { closed: true, holding: 'coverslip' }],
  // 다섯 병이 **같은 색**이고 이름표만 다른지 애셋 시트에서 확인한다.
  bottle: [
    { kind: 'WATER', level: 0.8 },
    { kind: 'S05', level: 1 }, { kind: 'S10', level: 0.7 },
    { kind: 'S15', level: 0.5, capOpen: true }, { kind: 'S20', level: 0.3 },
  ],
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
