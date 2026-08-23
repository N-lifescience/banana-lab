/**
 * 애셋 레지스트리.
 *
 * 새 애셋을 만들면 여기에 등록한다. `npm run check:art` 가 이 목록을 훑어
 * 아트 디렉션과 계약을 검사한다. 등록하지 않으면 검사도 되지 않는다.
 *
 * 아직 만들지 않은 애셋은 아래 PENDING 에 남겨 두었다. T02에서 하나씩 옮긴다.
 */

import * as banana from './banana.js';

export const ASSETS = {
  banana,
  // T02에서 채운다 — 아래 PENDING 참조
};

/**
 * 아직 구현되지 않은 애셋. contract.js 에는 이미 노드가 선언되어 있으니
 * banana.js 를 본보기로 하나씩 만들어 위 ASSETS 에 등록한다.
 */
export const PENDING = [
  'slide', 'coverslip', 'dropper', 'forceps', 'bottle',
  'microscope', 'dish', 'waste', 'tissue', 'bench',
];

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
  tissue: [{ used: 0 }],
  bench: [{}],
};
