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



  // 낱장 22 mm 는 화면에서 12 px 이라 알아볼 수가 없었다. 실제 실험실처럼 통에서 꺼내 쓴다.
  // 그림은 tasks/T17-PROMPT.md 로 다시 그려 받았다 — 뚜껑이 열려 있고 유리가 겹쳐 보인다.
  // 상태가 없다 — 덮개 유리는 얼마든지 꺼내 쓰고, 한 번 쓴 것은 쓰레기통으로 간다.

  // 받침 유리도 통에서 꺼내 쓴다. 석 장을 세다가 금이 세 번 가면 실험이 끝나 버렸다 —
  // 그건 결과로 답한 것이 아니라 그냥 막다른 길이었다 (rules.js 의 NEW_SLIDE).
  // 상태가 없다 — 몇 장 남았는지 세지 않는 것이 이 통을 놓는 이유다.

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


  /**
   * 비커. 250 mL 비커는 높이 약 95 mm · 지름 약 70 mm 다 (KS 규격 비커의 통상 치수).
   * 시행이 일어나는 그릇이라 실험대에 여러 개가 놓인다.
   */
  beaker: {
    file: 'beaker.js',
    realSizeMm: 95,
    viewBox: '0 0 400 300',
    states: ['level', 'contents', 'cracked'],
    nodes: {
      '#glass':        { required: true,  mutable: [] },
      '#glass-shade':  { required: true,  mutable: [] },
      '#spout':        { required: true,  mutable: [] },
      '#graduations':  { required: true,  mutable: [] },
      '#liquid':       { required: true,  mutable: ['fill', 'y', 'height', 'opacity'] },
      '#liquid-shade': { required: true,  mutable: ['fill', 'y', 'height', 'opacity'] },
      // 열 충격으로 깨진 비커. 막힌 이유가 그림에도 보여야 한다 (rules.js 의 PUT_IN_BATH).
      '#crack':        { required: true,  mutable: ['children'] },
    },
  },

  /**
   * 거름종이 원반. 펀치로 뚫는 지름 6 mm 원반이다 (AGENTS.md §2.4).
   *
   * 실험대에 낱개로 놓지 않는다 — 6 mm 는 화면에서 점 하나다. 핀셋에 물린 모습과
   * 접시 위, 그리고 결과 화면의 확대 뷰에서 쓴다.
   */
  disc: {
    file: 'disc.js',
    realSizeMm: 6,
    viewBox: '0 0 400 300',
    states: ['soaked', 'boiled'],
    nodes: {
      '#disc':       { required: true,  mutable: ['fill'] },
      '#disc-shade': { required: true,  mutable: ['fill'] },
      '#fibers':     { required: true,  mutable: [] },
    },
  },

  /**
   * 비커 통. 깨진 비커에서 빠져나가는 **유일한 길**이다.
   * 막힘 문구가 「선반의 비커 통」을 가리키므로 그 물건이 실제로 선반에 있어야 한다.
   * 상태가 없다 — 몇 개 남았는지 세지 않는다.
   */
  beakerbox: {
    file: 'beakerbox.js',
    realSizeMm: 300,   // 비커 서너 개를 엎어 두는 쟁반. 긴 변 [확인 필요]
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#tray':       { required: true,  mutable: [] },
      '#tray-shade': { required: true,  mutable: [] },
      '#stack':      { required: true,  mutable: [] },
    },
  },

  /** 거름종이(지름 110 mm 원형 여과지)와 펀치. 원반을 만드는 자리다. */
  filterpaper: {
    file: 'filterpaper.js',
    realSizeMm: 110,
    viewBox: '0 0 400 300',
    states: ['punched'],
    nodes: {
      '#sheet':       { required: true,  mutable: [] },
      '#sheet-shade': { required: true,  mutable: [] },
      '#punch':       { required: true,  mutable: ['transform'] },
      // 뚫은 자리. 한 일이 그림에 남아야 방금 누른 것이 먹혔는지 알 수 있다.
      '#holes':       { required: true,  mutable: ['children'] },
    },
  },

  /**
   * 수조. 온도 조건을 만드는 그릇이다.
   *
   * **다섯 수조의 물 색이 같다.** 온도는 `#gauge-text` 하나만 말한다 —
   * 뜨거운 것을 붉게 칠하면 학생이 그래프를 보기 전에 색으로 답을 짐작한다.
   */
  waterbath: {
    file: 'waterbath.js',
    // 1 L 비커에 물을 받아 쓰는 크기의 작은 수조. **[확인 필요]**
    // 300 mm 로 두었더니 다섯 대가 실험대 폭의 3분의 2를 먹어, 나머지 도구가 전부 겹쳤다.
    // 실제 학교에서도 이 실험의 「수조」는 큰 항온조가 아니라 물을 받은 비커나 작은 통이다.
    realSizeMm: 180,
    viewBox: '0 0 400 300',
    states: ['tempC'],
    nodes: {
      '#tank':        { required: true,  mutable: [] },
      '#tank-shade':  { required: true,  mutable: [] },
      '#water':       { required: true,  mutable: [] },
      '#water-shade': { required: true,  mutable: [] },
      '#gauge':       { required: true,  mutable: [] },
      '#gauge-text':  { required: true,  mutable: ['children'] },
      // 얼음과 김. 그 온도에서 **실제로 보이는 것**이라 색칠과 다르다.
      '#surface':     { required: true,  mutable: ['children'] },
    },
  },

  /**
   * 초시계. 이 실험의 **종속변인을 재는 기구**다.
   * 화면에 없으면 시간이 저절로 나오는 것처럼 보인다.
   */
  stopwatch: {
    file: 'stopwatch.js',
    realSizeMm: 70,    // 손에 쥐는 초시계 지름 [확인 필요]
    viewBox: '0 0 400 300',
    states: ['seconds', 'running'],
    nodes: {
      '#case':       { required: true,  mutable: [] },
      '#case-shade': { required: true,  mutable: [] },
      '#face':       { required: true,  mutable: [] },
      '#ticks':      { required: true,  mutable: [] },
      '#hand':       { required: true,  mutable: ['transform'] },
      '#button':     { required: true,  mutable: ['transform'] },
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
            landmarks: { shelfTopY: 65, shelf2TopY: 116, surfaceFrontY: 172 } },
};

/**
 * 애셋에서 **실제로 그려진 범위** (viewBox 좌표).
 *
 * 애셋은 저마다 400×300 프레임을 채워 그리지만 실제로 칠해진 부분은 그보다 좁다.
 * 스포이트는 폭 400 중 55 만 쓴다 — 나머지는 빈 여백이다.
 * 그 여백까지 잡는 영역으로 치면 눈에는 한참 떨어져 보이는 물건 둘이 겹친 것으로 판정된다.
 * 실제로 작업면 일곱을 프레임 폭으로 재면 1695 mm 라 1500 mm 실험대에 아예 못 앉힌다.
 *
 * **이 값은 손으로 적지 않는다.** 브라우저에서 `getBBox()` 로 재어 옮긴 것이다.
 * 손으로 적었다가 실제로 여러 칸이 어긋났다 — 수조는 눈금 글자가 프레임 밖으로 26 px
 * 더 나가 있었고, 눈으로는 알 수 없었다.
 *
 * 재는 방법: 대표 상태를 **전부** 그려 bbox 의 합집합을 잡는다. 한 상태에서만 나타나는
 * 것(금·얼음·김)을 빼면 그 상태에서 잡는 영역이 그림보다 작아진다.
 */
export const CONTENT_BOX = {
  beaker:      { x0: 106, y0:  72, x1: 286, y1: 276 },
  beakerbox:   { x0:  80, y0: 132, x1: 320, y1: 252 },
  disc:        { x0: 118, y0:  78, x1: 282, y1: 242 },
  filterpaper: { x0:  88, y0:  52, x1: 318, y1: 258 },
  waterbath:   { x0:  68, y0:  60, x1: 332, y1: 266 },
  stopwatch:   { x0: 102, y0:  40, x1: 298, y1: 280 },
  dropper:     { x0: 174, y0:  29, x1: 228, y1: 280 },
  forceps:     { x0: 164, y0:  40, x1: 236, y1: 271 },
  bottle:      { x0: 132, y0:   5, x1: 285, y1: 284 },
  dish:        { x0:  90, y0: 112, x1: 310, y1: 213 },
  waste:       { x0: 120, y0:  64, x1: 280, y1: 282 },
  sink:        { x0:  98, y0:  50, x1: 302, y1: 264 },
  bin:         { x0: 120, y0:  32, x1: 280, y1: 277 },
  tissue:      { x0: 110, y0:  58, x1: 318, y1: 232 },
  bench:       { x0:   0, y0:   0, x1: 400, y1: 300 },
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
