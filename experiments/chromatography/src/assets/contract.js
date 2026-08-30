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
  /*
   * realSizeMm 은 실물의 가장 긴 변이다. 실험대에서의 화면 크기가 이 값에만 비례해 정해지므로
   * **지어내면 물건이 서로 가리고, 화면에서는 그것이 안 보인다** (PLAYBOOK §3).
   *
   * ── 조사에서 나온 것 (2026-08-27) ─────────────────────────────────
   * **이 실험에는 정본 프로토콜이 없다.** 국내 지도자료 두 편(서울대 SERC)을 원문까지
   * 확인했는데, 둘 다 **원심관도 바이알도 쓰지 않는다** — 막자사발로 갈아 거즈로 거르고,
   * 전개조는 메스실린더 또는 비커 + 랩이다. 점적은 이쑤시개 또는 모세유리관.
   *
   * 그래서 아래 값은 「그 기구의 치수」와 「이 실험이 그 기구를 쓴다는 근거」를 갈라 적는다.
   * 출처가 있는 것만 값을 고쳤고, 나머지는 `[확인 필요]` 를 그대로 뒀다.
   */

  leaf: {
    file: 'leaf.js',
    // [확인 필요] 출처가 갈린다 — NC State Extension 은 25~76 mm(시장에 나오는 잎),
    // 위키백과는 20~300 mm(식물 전체의 잎을 다 포함한 범위)다. 아래쪽 범위를 따랐다.
    realSizeMm: 70,
    viewBox: '0 0 400 300',
    states: ['fresh'],
    nodes: {
      '#blade':       { required: true,  mutable: ['fill'] },
      '#blade-shade': { required: true,  mutable: ['fill'] },
      '#veins':       { required: true,  mutable: [] },
      '#stalk':       { required: true,  mutable: [] },
    },
  },

  tube: {
    file: 'tube.js',
    // [확인 필요] **이 실험이 원심관을 쓴다는 근거를 못 찾았다.** 치수만 출처가 있다 —
    // 15 mL 코니컬 튜브 17 × 120 mm (SPL·Corning 두 제조사 규격표가 일치).
    // 앞서 적혀 있던 115 는 50 mL 관의 길이와 같아, 어느 쪽을 뜻한 값인지 알 수 없었다.
    realSizeMm: 120,
    viewBox: '0 0 400 300',
    states: ['leaf', 'extract', 'settleT', 'capped'],
    nodes: {
      '#tube':       { required: true,  mutable: [] },
      '#tube-shade': { required: true,  mutable: [] },
      // 아래층(잎 부스러기)과 위층(상층액). 흔들면 섞이고 두면 갈린다
      '#lower':      { required: true,  mutable: ['y', 'height', 'fill'] },
      '#upper':      { required: true,  mutable: ['y', 'height', 'fill'] },
      '#cap':        { required: true,  mutable: ['transform'] },
    },
  },

  paper: {
    file: 'paper.js',
    // 2 × 10 cm. 국내 상용 크로마토그래프지 20 × 400 mm 낱장에서 잘라 쓴다.
    // 실제 출처들은 크기 대신 **「용기에 맞춰 자르라」**고 한다 —
    // Pearson CP11 "a suitable size to fit the full length of a boiling tube",
    // SERC "메스실린더보다 약간 짧게".
    realSizeMm: 100,
    viewBox: '0 0 400 300',
    states: ['origin', 'spots', 'spotMm', 'wet'],
    nodes: {
      '#sheet':       { required: true,  mutable: [] },
      '#sheet-shade': { required: true,  mutable: [] },
      '#origin':      { required: true,  mutable: ['d'] },
      '#spot':        { required: true,  mutable: ['cy', 'rx', 'ry', 'opacity'] },
      '#wet':         { required: true,  mutable: ['y', 'height'] },
    },
  },

  // 낱장 4 cm 폭은 실험대에서 알아볼 수가 없다. 실제 실험실처럼 통에서 꺼내 쓴다.
  // 상태가 없다 — 몇 장이든 꺼내 쓸 수 있다. 소모품이 바닥나면 그건 막다른 길이다.
  paperbox: {
    file: 'paperbox.js',
    // [확인 필요] 크로마토그래피 용지를 담는 「통」으로 팔리는 제품을 찾지 못했다.
    // 국내 상용 크로마토그래프지는 낱장 20 × 400 mm, 100매입으로 판다.
    realSizeMm: 130,
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#box':       { required: true,  mutable: [] },
      '#box-shade': { required: true,  mutable: [] },
      '#sheets':    { required: true,  mutable: [] },
    },
  },

  capillary: {
    file: 'capillary.js',
    // [확인 필요] **모세유리관을 쓴다는 것은 확인됐다** (SERC 백인영 자료 준비물 +
    // "색소 추출액을 모세유리관으로 찍어"). 길이는 출처마다 갈린다 —
    // 국내 「색소실험용」 40 mm · 헤마토크릿 표준 75 mm · TLC용 100 mm.
    // 바깥지름 1.5 mm 는 헤마토크릿 규격과 일치한다. 75 를 그대로 둔다.
    realSizeMm: 75,
    viewBox: '0 0 400 300',
    states: ['loaded'],
    nodes: {
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      '#fill':        { required: true,  mutable: ['width', 'opacity'] },
    },
  },

  vial: {
    file: 'vial.js',
    /*
     * 20 mL 신틸레이션 바이알은 외경 28 × 높이 57 mm 다(Kimble·Sigma).
     *
     * 한때 여기에 **실물에서 성립하지 않는 것**이 있었다 — 거름종이가 폭 40 mm 라
     * 28 mm 병에 들어가지 않았다. 종이를 20 mm 로 줄여 풀었다(국내 상용 규격).
     * `tests/develop.test.js` 의 「거름종이가 전개조에 실제로 들어간다」가 그 자리를 지킨다.
     *
     * [확인 필요] 높이 60 은 여전히 출처가 없다. 그리고 **이 실험이 바이알을 쓴다는
     * 근거도 못 찾았다** — 국내 지도자료의 전개조는 메스실린더 또는 비커 + 랩이다.
     */
    realSizeMm: 60,
    viewBox: '0 0 400 300',
    states: ['depth', 'capped', 'hasPaper'],
    nodes: {
      '#body':       { required: true,  mutable: [] },
      '#body-shade': { required: true,  mutable: [] },
      '#solvent':    { required: true,  mutable: ['y', 'height'] },
      '#paper':      { required: true,  mutable: ['opacity'] },
      '#cap':        { required: true,  mutable: ['transform'] },
    },
  },

  pencil: {
    file: 'pencil.js',
    // 문화 더존 연필 실측 스펙 176 × 7 mm. KS G 2603 원문은 열지 못했고,
    // 한국어 위키백과는 172 라고 하나 KS 를 근거로 대지 않는다. 판매 스펙 쪽을 따랐다.
    realSizeMm: 176,
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#barrel':       { required: true,  mutable: [] },
      '#barrel-shade': { required: true,  mutable: [] },
      '#wood':         { required: true,  mutable: [] },
      '#lead':         { required: true,  mutable: [] },
      '#ferrule':      { required: true,  mutable: [] },
      '#eraser':       { required: true,  mutable: [] },
    },
  },

  ruler: {
    file: 'ruler.js',
    // [확인 필요] 자를 쓴다는 것은 확인됐다(SERC 준비물). 몇 cm 인지는 못 찾았다 —
    // 15·20·30 cm 가 다 흔하고, 10 cm 스트립을 재는 데는 15 cm 로 충분하다.
    // 게다가 **자의 실물 길이는 눈금 길이보다 길다**(50 cm 자의 표기 사이즈가 55 cm).
    // 300 은 「30 cm 자의 눈금」을 가정한 값이라 두 겹으로 미확인이다.
    realSizeMm: 300,
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#body':       { required: true,  mutable: [] },
      '#body-shade': { required: true,  mutable: [] },
      '#ticks':      { required: true,  mutable: [] },
    },
  },

  bottle: {
    file: 'bottle.js',
    // [확인 필요] Borosil 카탈로그 1509016 은 100 mL 갈색 시약병을 56 × 105 mm 로 적고,
    // 각주에 "*Height indicated is of Bottle only" — **마개는 빠진 높이다.**
    // 마개가 목 위로 얼마나 솟는지는 어느 출처에도 없어서 105 를 그대로 둔다.
    realSizeMm: 105,
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
  // 이 실험의 애셋 값은 `scripts/check-bench.mjs` 가 브라우저에서 `getBBox()` 로 재어
  // 알려 준 것을 옮겨 적었다. 손으로 계산한 값은 다섯 군데가 어긋나 있었다.
  // 그림을 다시 그리면 그 검사가 먼저 알려 준다 — **검사 쪽이 맞다.**
  leaf:       { x0: 46,  y0: 51,  x1: 360, y1: 266 },
  tube:       { x0: 140, y0: 0,   x1: 256, y1: 298 },
  paper:      { x0: 164, y0: 10,  x1: 236, y1: 300 },
  paperbox:   { x0: 84,  y0: 50,  x1: 346, y1: 246 },
  capillary:  { x0: 64,  y0: 138, x1: 346, y1: 205 },
  vial:       { x0: 112, y0: 0,   x1: 288, y1: 299 },
  pencil:     { x0: 40,  y0: 213, x1: 370, y1: 293 },
  ruler:      { x0: 38,  y0: 220, x1: 368, y1: 294 },
  // 아래는 바나나랩에서 그대로 물려받은 애셋이라 잰 값이 그대로 맞다.
  bottle:     { x0: 132, y0: 5,   x1: 286, y1: 284 },
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
