/**
 * 애셋 계약 — 형태 · 스타일 · 상태를 분리하는 지점.
 *
 * 코드는 SVG 패스를 만들지 않는다. 아래에 선언된 노드의, 아래에 허용된 속성만 바꾼다.
 * 이 계약을 지키면 나중에 일러스트레이터가 그림을 통째로 교체해도 로직은 그대로 돈다.
 *
 * 새 애셋을 추가할 때:
 *   1. 여기에 노드 목록을 먼저 선언한다
 *   2. src/assets/<name>.js 에 render() / applyState() 를 만든다
 *   3. src/assets/index.js 에 등록한다
 *   4. `npm run check:art` 로 계약과 아트 디렉션을 동시에 검사한다
 *
 * docs/02-asset-contract.md 참조.
 */

/**
 * mutable: 상태에 따라 코드가 바꿔도 되는 속성
 * 'children' 은 그 그룹 안에 도형을 주입해도 된다는 뜻 (기포, 반점 등)
 *
 * realSizeMm: 실물의 **가장 긴 변** (mm).
 *   애셋은 저마다 400×300 프레임을 꽉 채워 그린다. 단독 아이콘으로 쓸 때 그래야 하기 때문이다.
 *   그래서 그린 크기끼리 비교하면 안 된다 — 스포이트와 시약병이 같은 높이로 그려져 있다.
 *   실험대에 함께 놓을 때의 화면 크기는 이 값에 비례해서 정한다. docs/02-asset-contract.md 참조.
 */
export const CONTRACT = {
  banana: {
    file: 'banana.js',
    realSizeMm: 180,   // 중간 크기 바나나, 껍질 포함 길이
    viewBox: '0 0 400 312',
    states: ['ripe', 'peel'],
    nodes: {
      '#peel':        { required: true,  mutable: ['fill'] },
      '#peel-shade':  { required: true,  mutable: ['fill'] },
      '#peel-line':   { required: true,  mutable: [] },
      '#stem':        { required: true,  mutable: [] },
      '#tip':         { required: true,  mutable: [] },
      '#spots':       { required: true,  mutable: ['children'] },
      '#flesh':       { required: true,  mutable: ['opacity'] },
      '#peel-strips': { required: true,  mutable: ['opacity', 'transform', 'children'] },
    },
  },

  slide: {
    file: 'slide.js',
    realSizeMm: 76,    // 표준 슬라이드글라스 76 × 26 mm 의 긴 변
    viewBox: '0 0 400 300',
    states: ['sample', 'stain', 'reaction', 'excess', 'coverslip', 'bubbles'],
    nodes: {
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      '#smear':       { required: true,  mutable: ['fill', 'fill-opacity', 'transform'] },
      // 흘러넘친 액. 방울을 세 개 넘게 떨어뜨리면 나타난다 (state.excess).
      '#spill':       { required: true,  mutable: ['opacity'] },
      '#coverslip':   { required: true,  mutable: ['transform', 'opacity'] },
      '#bubbles':     { required: true,  mutable: ['children'] },
      '#label':       { required: false, mutable: ['children'] },
    },
  },

  // 접안 마이크로미터(리클). 접안렌즈 통 안에 끼우는 지름 20 mm 유리 원판.
  // 눈금선은 좌우 대칭이라 뒤집어도 그대로다 — 달라지는 것은 숫자뿐이라
  // `#numbers` 만 좌우로 뒤집는다. 케이스는 원판보다 한 겹 크게 겹쳐 그려 두고
  // 통에서 꺼내면 `opacity` 로 지운다.
  ocular: {
    file: 'ocular.js',
    // 리클 원판만 재면 20 mm 다. 그런데 1500 mm 실험대에서 20 mm 는 화면에서 13 px —
    // 점 하나라 집을 수도, 무엇인지 알아볼 수도 없다. 바나나랩이 덮개 유리(22 mm)에서
    // 똑같이 겪고 「통」으로 푼 자리다. 실험대에 놓이는 것은 **케이스에 든 상태**이므로
    // 케이스 기준으로 잰다. 시야에 그려지는 눈금 간격은 optics.js 가 따로 정하므로
    // 이 값이 광학에 영향을 주지 않는다.
    realSizeMm: 58,    // 접안 마이크로미터 원판 지름 (20 mm 안팎이 표준)
    viewBox: '0 0 400 300',
    states: ['flipped', 'inCase'],
    nodes: {
      '#case':        { required: true,  mutable: ['opacity'] },
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      '#scale':       { required: true,  mutable: [] },
      '#numbers':     { required: true,  mutable: ['transform'] },
    },
  },

  // 접안 마이크로미터 통. 20 mm 리클을 담는 작고 납작한 원통형 플라스틱 통.
  //
  // 앞서는 이 자리에 `ocular` 애셋의 `inCase` 상태를 놓았는데, 원판 둘레에 테두리가
  // 한 겹 더 그려질 뿐이라 실험대에서 「통에 든 자」가 아니라 「테가 굵은 유리」로 보였다.
  // 통이라고 말하는 것은 색이 아니라 선이다 — 벽 두께가 보이는 림, 뚜껑의 손잡이 결, 자리 홈.
  //
  // 상태 둘이 서로 다른 것을 말한다. `open` 은 뚜껑, `empty` 는 속이다. 넷 다 성립한다.
  ocularbox: {
    file: 'ocularbox.js',
    realSizeMm: 55,    // 리클 케이스 지름 (원판은 그 안에 20 mm)
    viewBox: '0 0 400 300',
    states: ['open', 'empty'],
    nodes: {
      '#case':       { required: true,  mutable: [] },
      '#case-shade': { required: true,  mutable: [] },
      // 덮은 뚜껑과 젖힌 뚜껑. 그림이 서로 달라 한 노드를 옮겨서는 안 되고,
      // 그리는 순서도 반대다 — 덮은 것은 속을 덮으려고 맨 뒤에, 젖힌 것은 몸통 뒤에 온다.
      '#lid':        { required: true,  mutable: ['opacity'] },
      '#lid-open':   { required: true,  mutable: ['opacity'] },
      '#disc':       { required: true,  mutable: ['opacity'] },
    },
  },

  // 대물 마이크로미터 보관함. 유리판 한 장을 눕혀 담는 납작한 상자.
  // 깨졌을 때 새것을 꺼내는 **제자리**다 — 앞서는 그 자리가 표본 상자뿐이었는데,
  // 대물 마이크로미터를 표본 상자에서 꺼내는 그림은 거짓말이다 (rules.js 의 NEW_ITEM).
  stagemicbox: {
    file: 'stagemicbox.js',
    realSizeMm: 95,    // 76 mm 유리판을 눕혀 담는 상자. 긴 변 기준
    viewBox: '0 0 400 300',
    states: ['open', 'empty'],
    nodes: {
      '#box':       { required: true,  mutable: [] },
      '#box-shade': { required: true,  mutable: [] },
      '#lid':       { required: true,  mutable: ['opacity'] },
      '#lid-open':  { required: true,  mutable: ['opacity'] },
      '#slide':     { required: true,  mutable: ['opacity'] },
      '#label':     { required: false, mutable: ['children'] },
    },
  },

  // 대물 마이크로미터. 받침 유리와 같은 76 × 26 mm 이고, 가운데 금속 테 안에
  // 1 mm 를 100 등분한 눈금이 있다. 실험대에서 받침 유리와 갈리는 단서가 그 테다.
  stagemic: {
    file: 'stagemic.js',
    realSizeMm: 76,    // 슬라이드글라스와 같은 76 × 26 mm 의 긴 변
    viewBox: '0 0 400 300',
    states: ['cracked'],
    nodes: {
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      '#ring':        { required: true,  mutable: [] },
      '#scale':       { required: true,  mutable: [] },
      '#crack':       { required: true,  mutable: ['opacity'] },
      '#label':       { required: false, mutable: ['children'] },
    },
  },

  // 공변세포 영구표본. 학생이 만드는 것이 아니라 만들어져 온 것이다 —
  // 굳은 봉입제 테두리(#seal)와 손으로 쓴 라벨이 그 사실을 말한다.
  specimen: {
    file: 'specimen.js',
    realSizeMm: 76,    // 받침 유리에 봉입한 표본. 76 × 26 mm 의 긴 변
    viewBox: '0 0 400 300',
    states: ['cracked'],
    nodes: {
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      '#mount':       { required: true,  mutable: [] },
      '#mount-shade': { required: true,  mutable: [] },
      '#coverslip':   { required: true,  mutable: [] },
      '#seal':        { required: true,  mutable: [] },
      '#crack':       { required: true,  mutable: ['opacity'] },
      '#label':       { required: false, mutable: ['children'] },
    },
  },

  coverslip: {
    file: 'coverslip.js',
    realSizeMm: 22,    // 표준 커버글라스 22 × 22 mm
    viewBox: '0 0 400 300',
    states: ['angle', 'held'],
    nodes: {
      '#glass':       { required: true,  mutable: ['transform'] },
      '#glass-shade': { required: true,  mutable: [] },
    },
  },

  // 낱장 22 mm 는 화면에서 12 px 이라 알아볼 수가 없었다. 실제 실험실처럼 통에서 꺼내 쓴다.
  // 그림은 tasks/T17-PROMPT.md 로 다시 그려 받았다 — 뚜껑이 열려 있고 유리가 겹쳐 보인다.
  // 상태가 없다 — 덮개 유리는 얼마든지 꺼내 쓰고, 한 번 쓴 것은 쓰레기통으로 간다.
  coverbox: {
    file: 'coverbox.js',
    realSizeMm: 60,    // 22 mm 낱장을 담는 통. 긴 변 기준
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#box':       { required: true,  mutable: [] },
      '#box-shade': { required: true,  mutable: [] },
      '#stack':     { required: true,  mutable: [] },
    },
  },

  // 받침 유리도 통에서 꺼내 쓴다. 석 장을 세다가 금이 세 번 가면 실험이 끝나 버렸다 —
  // 그건 결과로 답한 것이 아니라 그냥 막다른 길이었다 (rules.js 의 NEW_SLIDE).
  // 상태가 없다 — 몇 장 남았는지 세지 않는 것이 이 통을 놓는 이유다.
  slidebox: {
    file: 'slidebox.js',
    realSizeMm: 100,   // 76 mm 슬라이드를 눕혀 담는 얕은 상자. 긴 변 기준
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#tray':       { required: true,  mutable: [] },
      '#tray-shade': { required: true,  mutable: [] },
      '#stack':      { required: true,  mutable: [] },
    },
  },

  dropper: {
    file: 'dropper.js',
    realSizeMm: 150,   // 고무 젖꼭지 포함 스포이트 전장
    viewBox: '0 0 400 300',
    states: ['holds', 'level', 'squeezed'],
    nodes: {
      '#bulb':       { required: true,  mutable: ['transform'] },
      '#bulb-shade': { required: true,  mutable: [] },
      '#tube':       { required: true,  mutable: [] },
      '#tube-shade': { required: true,  mutable: [] },
      '#liquid':     { required: true,  mutable: ['fill', 'y', 'height', 'opacity'] },
      '#drop':       { required: true,  mutable: ['fill', 'opacity', 'transform'] },
    },
  },

  forceps: {
    file: 'forceps.js',
    realSizeMm: 120,   // 실험용 핀셋 표준 길이
    viewBox: '0 0 400 300',
    states: ['closed', 'holding'],
    nodes: {
      '#arm-left':  { required: true,  mutable: ['transform'] },
      '#arm-right': { required: true,  mutable: ['transform'] },
      '#joint':     { required: true,  mutable: [] },
      '#held':      { required: true,  mutable: ['children', 'opacity'] },
    },
  },

  bottle: {
    file: 'bottle.js',
    realSizeMm: 105,   // 100 mL 갈색 시약병, 마개 포함 높이
    viewBox: '0 0 400 300',
    states: ['kind', 'level', 'capOpen'],
    nodes: {
      '#body':       { required: true,  mutable: [] },
      '#body-shade': { required: true,  mutable: [] },
      '#liquid':     { required: true,  mutable: ['fill', 'y', 'height'] },
      '#cap':        { required: true,  mutable: ['transform'] },
      '#label':      { required: true,  mutable: [] },
      '#label-text': { required: true,  mutable: ['children'] },
    },
  },

  microscope: {
    file: 'microscope.js',
    realSizeMm: 340,   // 학생용 광학현미경 높이
    viewBox: '0 0 400 300',
    states: ['objective', 'coarse', 'fine', 'diaphragm', 'lamp', 'stage'],
    nodes: {
      '#base':         { required: true,  mutable: [] },
      '#arm':          { required: true,  mutable: [] },
      '#stage':        { required: true,  mutable: ['transform'] },
      '#stage-slot':   { required: true,  mutable: ['children', 'opacity'] },
      '#clip-left':    { required: true,  mutable: ['transform'] },
      '#clip-right':   { required: true,  mutable: ['transform'] },
      '#nosepiece':    { required: true,  mutable: ['transform'] },
      '#objective-4':  { required: true,  mutable: ['transform'] },
      '#objective-10': { required: true,  mutable: ['transform'] },
      '#objective-40': { required: true,  mutable: ['transform'] },
      '#tube':         { required: true,  mutable: [] },
      '#eyepiece':     { required: true,  mutable: [] },
      '#knob-coarse':  { required: true,  mutable: ['transform'] },
      '#knob-fine':    { required: true,  mutable: ['transform'] },
      '#lamp':         { required: true,  mutable: ['fill', 'opacity'] },
      '#diaphragm':    { required: true,  mutable: ['transform', 'opacity'] },
    },
  },

  // 페트리 접시 지름 90 · 폐액통 높이 250 · 킴와이프스 박스 긴 변 215 · 실험대 폭 1500
  dish:   { file: 'dish.js',   realSizeMm: 90,   viewBox: '0 0 400 300', states: ['contents'],
            nodes: { '#dish': { required: true, mutable: [] },
                     '#dish-shade': { required: true, mutable: [] },
                     '#contents': { required: true, mutable: ['children'] } } },

  waste:  { file: 'waste.js',  realSizeMm: 250,  viewBox: '0 0 400 300', states: ['level'],
            nodes: { '#bin': { required: true, mutable: [] },
                     '#bin-shade': { required: true, mutable: [] },
                     '#level': { required: true, mutable: ['y', 'height', 'fill'] } } },

  // 개수대 폭 380 · 쓰레기통 높이 240. 둘 다 자리표시 그림이다 (tasks/T12-PROMPT.md).
  // 개수대를 더 키우면 세로로 자라 선반 위 물건을 덮는다 — tests/bench.test.js 가 잡는다.
  sink:   { file: 'sink.js',   realSizeMm: 380,  viewBox: '0 0 400 300', states: ['water'],
            nodes: { '#basin': { required: true, mutable: [] },
                     '#basin-shade': { required: true, mutable: [] },
                     '#faucet': { required: true, mutable: [] },
                     '#water': { required: true, mutable: ['opacity'] } } },

  bin:    { file: 'bin.js',    realSizeMm: 240,  viewBox: '0 0 400 300', states: ['fill'],
            nodes: { '#trash': { required: true, mutable: [] },
                     '#trash-shade': { required: true, mutable: [] },
                     '#trash-fill': { required: true, mutable: ['opacity'] } } },

  tissue: { file: 'tissue.js', realSizeMm: 215,  viewBox: '0 0 400 300', states: ['used'],
            nodes: { '#box': { required: true, mutable: [] },
                     '#box-shade': { required: true, mutable: [] },
                     '#sheet': { required: true, mutable: ['opacity'] } } },

  // 실험대 배경. `#room` 은 벽·바닥·천장 같은 분위기용이라 없어도 된다 —
  // 대신 **랜드마크를 건드리면 안 된다**. 아래 landmarks 를 보라.
  bench:  { file: 'bench.js',  realSizeMm: 1500, viewBox: '0 0 400 300', states: [],
            nodes: { '#surface': { required: true, mutable: [] },
                     '#surface-shade': { required: true, mutable: [] },
                     '#shelf': { required: true, mutable: [] },
                     '#room': { required: false, mutable: [] } },
            /**
             * 물건이 **바닥을 대고 서는 선**. viewBox y 좌표다.
             *
             * `src/ui/bench.js` 가 이 값으로 선반 위·작업면 위 물건의 높이를 정한다.
             * 그림을 다시 그리면서 이 선을 옮기면 실험대 위 물건이 전부 허공에 뜬다.
             * 그러고도 화면은 멀쩡해 보인다 — 그래서 tests/assets.contract.test.js 가 지킨다.
             */
            landmarks: { shelfTopY: 65, surfaceFrontY: 155 } },
};

/**
 * 애셋에서 **실제로 그려진 범위** (viewBox 좌표).
 *
 * 애셋은 저마다 400×300 프레임을 채워 그리지만 실제로 칠해진 부분은 그보다 좁다.
 * 스포이트는 폭 400 중 55 만 쓴다 — 나머지는 빈 여백이다.
 * 그 여백까지 잡는 영역으로 치면 눈에는 한참 떨어져 보이는 물건 둘이 겹친 것으로 판정된다.
 * 실제로 작업면 일곱을 프레임 폭으로 재면 1695 mm 라 1500 mm 실험대에 아예 못 앉힌다.
 *
 * 이 값은 손으로 적지 않는다 — 브라우저에서 `getBBox()` 로 재어 옮긴 것이고,
 * `scripts/check-bench.mjs` 가 실제 그림과 어긋나지 않는지 확인한다.
 * 그림을 다시 그리면 그 검사가 먼저 알려 준다.
 */
export const CONTENT_BOX = {
  banana:     { x0: 52,  y0: 25,  x1: 350, y1: 312 },
  slide:      { x0: 60,  y0: 105, x1: 344, y1: 209 },
  // 접안 마이크로미터는 **케이스를 씌운 상태**가 가장 넓다. 케이스를 벗기면 그림은 줄지만
  // 이 값은 줄이지 않는다 — 실험대에서 물건이 잡히는 영역이 상태에 따라 오르내리면
  // 같은 자리를 눌러도 어떤 때는 잡히고 어떤 때는 안 잡힌다.
  ocular:     { x0: 80,  y0: 30,  x1: 320, y1: 270 },
  // 두 통도 **가장 넓은 상태**로 잰다 (뚜껑을 덮었을 때와 젖혔을 때의 합집합).
  // 잡히는 영역이 상태에 따라 오르내리면 같은 자리를 눌러도 어떤 때는 잡히고 어떤 때는 안 잡힌다.
  ocularbox:  { x0: 76,  y0: 42,  x1: 330, y1: 254 },
  stagemicbox:{ x0: 72,  y0: 108, x1: 356, y1: 256 },
  stagemic:   { x0: 60,  y0: 105, x1: 344, y1: 202 },
  specimen:   { x0: 60,  y0: 105, x1: 344, y1: 202 },
  coverslip:  { x0: 20,  y0: 37,  x1: 232, y1: 215 },
  coverbox:   { x0: 80,  y0: 41,  x1: 330, y1: 246 },
  slidebox:   { x0: 78,  y0: 160, x1: 362, y1: 268 },
  dropper:    { x0: 173, y0: 29,  x1: 228, y1: 280 },
  forceps:    { x0: 163, y0: 40,  x1: 237, y1: 271 },
  bottle:     { x0: 132, y0: 5,   x1: 286, y1: 284 },
  microscope: { x0: 90,  y0: 26,  x1: 300, y1: 289 },
  dish:       { x0: 90,  y0: 112, x1: 310, y1: 213 },
  waste:      { x0: 120, y0: 64,  x1: 280, y1: 282 },
  sink:       { x0: 98,  y0: 50,  x1: 302, y1: 264 },
  bin:        { x0: 120, y0: 32,  x1: 280, y1: 277 },
  tissue:     { x0: 110, y0: 58,  x1: 318, y1: 232 },
  bench:      { x0: 0,   y0: 0,   x1: 400, y1: 300 },
};

/**
 * 그려진 범위를 **밀리미터**로. 프레임 왼쪽 위에서의 치우침(dx, dy)과 크기(w, h).
 *
 * 실험대에 놓인 물건의 `x` 는 여전히 **프레임** 왼쪽이다. 그림은 그보다 dx 만큼 안쪽에서 시작한다.
 */
export function drawnBoxMm(name) {
  const spec = CONTRACT[name];
  const [, , vw, vh] = spec.viewBox.split(/\s+/).map(Number);
  const c = CONTENT_BOX[name];
  const frameW = spec.realSizeMm;
  const frameH = frameW * (vh / vw);
  return {
    dx: frameW * (c.x0 / vw),
    dy: frameH * (c.y0 / vh),
    w: frameW * ((c.x1 - c.x0) / vw),
    h: frameH * ((c.y1 - c.y0) / vh),
  };
}

/** 계약에 선언된, 반드시 존재해야 하는 노드 id 목록 */
export function requiredNodes(name) {
  const spec = CONTRACT[name];
  if (!spec) throw new Error(`계약에 없는 애셋: ${name}`);
  return Object.entries(spec.nodes)
    .filter(([, v]) => v.required)
    .map(([id]) => id);
}

/** 이 애셋의 이 노드에서 이 속성을 바꿔도 되는가 */
export function isMutable(name, nodeId, attr) {
  const node = CONTRACT[name]?.nodes?.[nodeId];
  return Boolean(node && node.mutable.includes(attr));
}

/**
 * 상태 반영의 유일한 진입점.
 * 계약에 없는 속성을 바꾸려 하면 개발 중에 바로 터진다 — 조용히 무시하지 않는다.
 */
export function setAttr(root, assetName, nodeId, attr, value) {
  if (!isMutable(assetName, nodeId, attr)) {
    throw new Error(
      `계약 위반: ${assetName} ${nodeId} 의 ${attr} 는 상태로 바꿀 수 없습니다. ` +
      `필요하다면 src/assets/contract.js 를 먼저 고치세요.`
    );
  }
  const el = root.querySelector(nodeId);
  if (!el) throw new Error(`노드를 찾을 수 없습니다: ${assetName} ${nodeId}`);
  el.setAttribute(attr, value);
  return el;
}
