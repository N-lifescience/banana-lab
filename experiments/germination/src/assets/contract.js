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
  /**
   * 바이오챔버 — **이 실험의 몸통.**
   *
   * 실물 크기는 교과서에서 확인하지 않았다 (`[확인 필요]`). 실험대에서 다른 물건과
   * 겹치지 않고, 콩 몇 숟갈을 담는 통으로 읽힐 만한 **잠정값**을 썼다.
   * 확인되면 이 숫자만 고치면 자리도 알아서 따라온다 (`src/ui/bench.js` 가 비례로 낸다).
   *
   * 온도계를 챔버 안에 함께 그린다 — 결과 화면(`src/render/chamber.js`)이 이 그림을
   * 크게 키워 쓰므로, 그림을 두 벌 그리면 두 곳이 어긋난다.
   */
  chamber: {
    file: 'chamber.js',
    realSizeMm: 200,   // [확인 필요] 잠정값. 뚜껑 포함 높이
    viewBox: '0 0 400 300',
    states: ['beans', 'scoops', 'btbStage', 'sensor', 'sealed', 'tempFill'],
    nodes: {
      '#jar':         { required: true,  mutable: [] },
      '#jar-shade':   { required: true,  mutable: [] },
      // 닫으면 제자리, 열면 비스듬히 들린다.
      '#lid':         { required: true,  mutable: ['transform'] },
      // 밀봉했을 때만 보이는 테. 「닫혀 있다」와 「밀봉됐다」를 눈으로 갈라 준다.
      '#seal':        { required: true,  mutable: ['opacity'] },
      '#dish':        { required: true,  mutable: [] },
      // BTB 용액. 안 넣었으면 opacity 0 — 「투명」이 아니라 **없는 것**이다.
      '#btb':         { required: true,  mutable: ['fill', 'opacity'] },
      // 콩 알갱이를 주입한다. 숟갈 수만큼 쌓인다.
      '#beans':       { required: true,  mutable: ['children'] },
      '#sensor':      { required: true,  mutable: ['opacity', 'transform'] },
      '#thermo':      { required: true,  mutable: [] },
      '#thermo-fill': { required: true,  mutable: ['y', 'height'] },
    },
  },

  /** 무선 CO₂·온도 센서. 챔버에 꽂는 막대다. */
  sensor: {
    file: 'sensor.js',
    realSizeMm: 150,   // [확인 필요] 잠정값
    viewBox: '0 0 400 300',
    states: ['on', 'fouled'],
    nodes: {
      '#body':       { required: true,  mutable: [] },
      '#body-shade': { required: true,  mutable: [] },
      '#probe':      { required: true,  mutable: [] },
      // 켜져 있는지 알리는 표시등. 꺼짐/켜짐이 눈에 보여야 한다.
      '#led':        { required: true,  mutable: ['fill', 'opacity'] },
      // 끝에 묻은 콩 부스러기. 닦으면 사라진다 (되돌아갈 길이 눈에 보여야 한다).
      '#fouling':    { required: true,  mutable: ['opacity'] },
    },
  },

  /**
   * 콩 통. **한 애셋으로 두 갈래를 그린다** (`kind`).
   *
   * 발아 콩과 마른 콩을 다른 애셋으로 만들면 둘의 크기 감각과 선 두께가 어긋난다.
   * 시약병(`bottle`)이 `kind` 로 세 갈래를 그리는 것과 같은 방식이다.
   */
  beanjar: {
    file: 'beanjar.js',
    realSizeMm: 150,   // [확인 필요] 잠정값
    viewBox: '0 0 400 300',
    states: ['kind', 'level', 'capOpen'],
    nodes: {
      '#jar':        { required: true,  mutable: [] },
      '#jar-shade':  { required: true,  mutable: [] },
      '#lid':        { required: true,  mutable: ['transform'] },
      '#beans':      { required: true,  mutable: ['children'] },
      '#label':      { required: true,  mutable: [] },
      '#label-text': { required: true,  mutable: ['children'] },
    },
  },

  /** 계량 숟가락. 양을 재는 도구이자, 이 실험에서 **양을 정하는 유일한 손**이다. */
  scoop: {
    file: 'scoop.js',
    realSizeMm: 180,   // [확인 필요] 잠정값
    viewBox: '0 0 400 300',
    states: ['holds'],
    nodes: {
      '#handle':     { required: true,  mutable: [] },
      '#bowl':       { required: true,  mutable: [] },
      '#bowl-shade': { required: true,  mutable: [] },
      // 담긴 콩. 비었으면 opacity 0.
      '#load':       { required: true,  mutable: ['children', 'opacity'] },
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

  // 폐액통 높이 250 · 개수대 폭 380 · 쓰레기통 높이 240 · 킴와이프스 박스 긴 변 215
  waste:  { file: 'waste.js',  realSizeMm: 250,  viewBox: '0 0 400 300', states: ['level'],
            nodes: { '#bin': { required: true, mutable: [] },
                     '#bin-shade': { required: true, mutable: [] },
                     '#level': { required: true, mutable: ['y', 'height', 'fill'] } } },

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
  // 새로 그린 넷은 **그림을 받은 뒤 재어 넣은 값**이다.
  // 손으로 짐작해 적으면 잡는 영역이 그림과 어긋나, 눈에는 한참 떨어져 보이는 물건이
  // 옆엣것의 클릭을 가로챈다. `scripts/check-bench.mjs` 가 실제 그림과 대조한다.
  chamber:    { x0: 95,  y0: 14,  x1: 305, y1: 284 },
  sensor:     { x0: 168, y0: 26,  x1: 232, y1: 276 },
  beanjar:    { x0: 108, y0: 40,  x1: 292, y1: 272 },
  scoop:      { x0: 84,  y0: 96,  x1: 320, y1: 212 },
  bottle:     { x0: 132, y0: 5,   x1: 286, y1: 284 },
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
