/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 *
 * **바나나랩에서 물려받은 애셋(바나나·슬라이드·현미경 …)은 목록에서 뺐다.**
 * 남겨 두면 아트 시트와 린터가 계속 남의 그림을 검사한다.
 */

import * as rotor from './rotor.js';
import * as capillary from './capillary.js';
import * as capbox from './capbox.js';
import * as clay from './clay.js';
import * as lancet from './lancet.js';
import * as finger from './finger.js';
import * as swab from './swab.js';
import * as ruler from './ruler.js';
import * as sharpsbin from './sharpsbin.js';
import * as sink from './sink.js';
import * as bin from './bin.js';
import * as tissue from './tissue.js';
import * as bench from './bench.js';

export const ASSETS = {
  rotor, capillary, capbox, clay, lancet, finger, swab, ruler, sharpsbin,
  sink, bin, tissue, bench,
};

/**
 * 그림을 다시 그려야 하는 애셋. 계약과 상호작용은 이미 붙어 있고 형태만 자리표시다.
 */
export const PENDING = [];

/** 린터와 UI가 함께 쓰는 대표 상태 조합. 애셋마다 최소 이 상태들에서 검사한다. */
export const SAMPLE_STATES = {
  rotor: [
    { speed: 0, slotA: null, slotB: null },
    { speed: 0, slotA: 'sample', slotB: 'counter' },
    { speed: 0.85, slotA: 'sample', slotB: 'counter' },
    // 한쪽만 물린 채 도는 것 — 균형이 안 맞아 흔들린다
    { speed: 0.6, slotA: 'sample', slotB: null, wobble: 1 },
  ],
  capillary: [
    { fill: 0, kind: 'heparin' },
    { fill: 0.7, kind: 'heparin', seal: { outer: 0, inner: 0 } },
    { fill: 0.7, kind: 'heparin', seal: { outer: 1, inner: 1 } },
    { fill: 0.5, kind: 'plain', seal: { outer: 1, inner: 0.3 } },
    { fill: 0.4, kind: 'heparin', broken: true },
  ],
  capbox: [{ kind: 'heparin' }, { kind: 'plain' }],
  clay: [{ dents: 0 }, { dents: 3 }],
  lancet: [{ used: false }, { used: true }],
  finger: [
    { swabbed: false, drop: 0 },
    { swabbed: true, drop: 0 },
    { swabbed: true, drop: 0.8 },
    { swabbed: true, drop: 0, wiped: true },
  ],
  swab: [{ used: false }, { used: true }],
  ruler: [{}],
  sharpsbin: [{ fill: 0 }, { fill: 0.7 }],
  sink: [{ water: 0 }, { water: 1 }],
  bin: [{ fill: 0 }, { fill: 1 }],
  tissue: [{ used: 0 }],
  bench: [{}],
};
