/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 */

import * as beaker from './beaker.js';
import * as beakerbox from './beakerbox.js';
import * as disc from './disc.js';
import * as filterpaper from './filterpaper.js';
import * as waterbath from './waterbath.js';
import * as stopwatch from './stopwatch.js';
import * as dropper from './dropper.js';
import * as forceps from './forceps.js';
import * as bottle from './bottle.js';
import * as dish from './dish.js';
import * as waste from './waste.js';
import * as sink from './sink.js';
import * as bin from './bin.js';
import * as tissue from './tissue.js';
import * as bench from './bench.js';

export const ASSETS = {
  beaker, beakerbox, disc, filterpaper, waterbath, stopwatch,
  dropper, forceps, bottle, dish, waste, sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 * 붙여 넣을 지시는 tasks/T17-PROMPT.md 에 있다.
 */
export const PENDING = [];

/** 린터와 UI가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다. */
export const SAMPLE_STATES = {
  beaker: [
    { level: 0 },
    { level: 0.6, contents: 'H2O2' },
    { level: 0.5, contents: 'POTATO' },
    { level: 0.5, contents: 'POTATO_BOILED' },
    { level: 0.6, contents: 'H2O2', cracked: true },
  ],
  beakerbox: [{}],
  disc: [{ soaked: false }, { soaked: true }, { soaked: true, boiled: true }],
  filterpaper: [{ punched: 0 }, { punched: 5 }],
  // 다섯 수조. 물 색은 다 같고 얼음·김만 다르다 — 색으로 온도를 말하지 않는다.
  waterbath: [{ tempC: 0 }, { tempC: 20 }, { tempC: 37 }, { tempC: 60 }, { tempC: 100 }],
  stopwatch: [{ seconds: 0 }, { seconds: 25, running: true }],
  dropper: [{ holds: null }, { holds: 'BUFFER', level: 1 }, { holds: 'ACID', level: 0.4 }],
  forceps: [{ closed: false }, { closed: true, holding: 'disc' }],
  bottle: [
    { kind: 'H2O2', pct: 3, level: 0.8 },
    { kind: 'BUFFER', ph: 7, level: 1 },
    { kind: 'BUFFER', ph: 11, level: 0.6 },
    { kind: 'ACID', level: 0.3, capOpen: true },
    { kind: 'BASE', level: 0.5 },
    { kind: 'WATER', level: 0.9 },
  ],
  dish: [{ contents: [] }, { contents: ['DISC', 'DISC'] }, { contents: ['DISC_BOILED'] }],
  waste: [{ level: 0 }, { level: 0.6 }],
  sink: [{ water: 0 }, { water: 1 }],
  bin: [{ fill: 0 }, { fill: 1 }],
  tissue: [{ used: 0 }, { used: 3 }],
  bench: [{}],
};
