/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 */

import * as banana from './banana.js';
import * as slide from './slide.js';
import * as ocular from './ocular.js';
import * as ocularbox from './ocularbox.js';
import * as stagemic from './stagemic.js';
import * as stagemicbox from './stagemicbox.js';
import * as specimen from './specimen.js';
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
  banana, slide, ocular, ocularbox, stagemic, stagemicbox, specimen, coverslip, coverbox, slidebox,
  dropper, forceps, bottle,
  microscope, dish, waste, sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 * 붙여 넣을 지시는 tasks/T17-PROMPT.md 에 있다.
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
    { sample: { thickness: 0.3 }, stain: 'SUDAN3', reaction: 1, excess: 1 },
  ],
  // 접안 마이크로미터 — 케이스에 든 채/꺼낸 채, 바로 끼운 채/뒤집어 끼운 채.
  // 네 조합을 다 검사한다. 뒤집힘은 숫자만 달라지므로 눈으로도 여기서 본다.
  ocular: [{}, { flipped: true }, { inCase: true }, { inCase: true, flipped: true }],
  // 두 통 — 뚜껑(open)과 속(empty)은 서로 다른 것을 말한다. 넷 다 성립하지만
  // 실험대에 실제로 나타나는 셋만 검사한다: 열고 든 것 · 열고 빈 것 · 덮은 것.
  ocularbox: [{ open: true }, { open: true, empty: true }, { open: false }],
  stagemicbox: [{ open: true }, { open: true, empty: true }, { open: false }],
  // 대물 마이크로미터 · 영구표본 — 금은 불리언으로도 연속값으로도 들어온다.
  stagemic: [{}, { cracked: true }, { cracked: 0.4 }],
  specimen: [{}, { cracked: true }, { cracked: 0.4 }],
  coverslip: [{ angle: 45 }, { angle: 90 }],
  coverbox: [{}],
  slidebox: [{}],
  dropper: [{ holds: null }, { holds: 'IKI', level: 1 }, { holds: 'SUDAN3', level: 0.4 }],
  forceps: [{ closed: false }, { closed: true, holding: 'coverslip' }],
  bottle: [{ kind: 'IKI', level: 1 }, { kind: 'SUDAN3', level: 0.3, capOpen: true }, { kind: 'WATER', level: 0.8 }],
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
