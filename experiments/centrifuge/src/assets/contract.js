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
   * ── realSizeMm 에 대하여 ────────────────────────────────────────────
   * 이 실험의 기구 중 **실물 규격을 확실히 아는 것이 많지 않다.** 아래 값 가운데
   * `★` 가 붙은 것은 **[확인 필요]** 다. 이 값이 정하는 것은 **실험대에서 물건끼리의
   * 상대 크기**뿐이고, 화면에 수치로 나오지 않으며 결과 계산에도 쓰이지 않는다.
   * (헤마토크릿은 길이의 **비**라서 모세관 길이에 좌우되지 않는다 — `src/sim/spin.js`)
   */

  /**
   * 완성된 회전판 + 끈 + 링. **교과서 1단계인 제작은 하지 않는다** — 완성품으로 준다.
   *
   * **회전판은 모세관을 수평으로 문다.** `#straw-a` 와 `#straw-b` 는 원판을 가로질러
   * 마주 보고 붙어 있고, 그 안에 모세관이 눕는다. 「아래」는 회전 **바깥쪽** 끝이다.
   */
  rotor: {
    file: 'rotor.js',
    realSizeMm: 100,   // ★ 종이 원판의 지름 — [확인 필요]
    viewBox: '0 0 400 300',
    states: ['speed', 'slotA', 'slotB', 'wobble'],
    nodes: {
      '#disc':        { required: true,  mutable: [] },
      '#disc-shade':  { required: true,  mutable: [] },
      '#hub':         { required: true,  mutable: [] },
      // 모세관이 눕는 빨대 둘. 마주 본다 — 그래서 한쪽만 채우면 흔들린다.
      '#straw-a':     { required: true,  mutable: [] },
      '#straw-b':     { required: true,  mutable: [] },
      // 그 안에 물린 모세관. 없으면 opacity 0 이다.
      '#tube-a':      { required: true,  mutable: ['opacity', 'transform'] },
      '#tube-b':      { required: true,  mutable: ['opacity', 'transform'] },
      '#string':      { required: true,  mutable: [] },
      '#ring-left':   { required: true,  mutable: ['transform'] },
      '#ring-right':  { required: true,  mutable: ['transform'] },
      // 얼마나 빨리 도는지를 보이는 표시. 속도에 따라 개수가 바뀐다.
      '#spin-marks':  { required: true,  mutable: ['children', 'opacity'] },
      // 흔들림. 균형이 안 맞을 때만 보인다.
      '#wobble':      { required: true,  mutable: ['opacity'] },
    },
  },

  /**
   * 모세관 한 개.
   *
   * **이 애셋은 갈린 층을 그리지 않는다.** 층은 결과 렌더러(`src/render/tube.js`)의
   * 몫이고, 결과색(암적색·회백색·담황색)은 기구에 쓰면 안 된다 (`tests/palette.test.js`).
   * 여기서 보이는 것은 **선홍색 생혈**뿐이다 — 그 대비가 "다져져서 어두워졌다" 를 만든다.
   */
  capillary: {
    file: 'capillary.js',
    realSizeMm: 75,    // ★ 헤마토크릿 모세관의 길이 — [확인 필요] (src/sim/spin.js 참조)
    viewBox: '0 0 400 300',
    states: ['fill', 'seal', 'kind', 'broken'],
    nodes: {
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      // 혈액 기둥. 바깥쪽 끝에서 자란다 — transform 으로 길이를 준다.
      '#column':      { required: true,  mutable: ['transform', 'opacity'] },
      '#plug-outer':  { required: true,  mutable: ['opacity', 'transform'] },
      '#plug-inner':  { required: true,  mutable: ['opacity', 'transform'] },
      // 헤파린이 발린 것을 갈라 보이는 띠. **실물의 색 코드는 [확인 필요]** 라
      // 여기 색은 규격이 아니라 구분 표시다.
      '#band':        { required: true,  mutable: ['opacity'] },
      '#crack':       { required: true,  mutable: ['opacity'] },
    },
  },

  /** 모세관 통 — 헤파린 칸과 민무늬 칸. **고르는 것이 변인이라 둘이 한눈에 갈려야 한다.** */
  capbox: {
    file: 'capbox.js',
    realSizeMm: 120,   // ★ [확인 필요]
    viewBox: '0 0 400 300',
    states: ['kind'],
    nodes: {
      '#box':         { required: true,  mutable: [] },
      '#box-shade':   { required: true,  mutable: [] },
      '#slot-heparin':{ required: true,  mutable: [] },
      '#slot-plain':  { required: true,  mutable: [] },
      '#band':        { required: true,  mutable: [] },
      // 지금 고른 칸을 짚어 주는 표시
      '#pick':        { required: true,  mutable: ['transform', 'opacity'] },
    },
  },

  /** 고무찰흙 — 모세관 끝을 눌러 막는다 */
  clay: {
    file: 'clay.js',
    realSizeMm: 70,    // ★ [확인 필요]
    viewBox: '0 0 400 300',
    states: ['dents'],
    nodes: {
      '#tray':        { required: true,  mutable: [] },
      '#lump':        { required: true,  mutable: [] },
      '#lump-shade':  { required: true,  mutable: [] },
      // 눌러 막은 자국. 누를 때마다 는다.
      '#dents':       { required: true,  mutable: ['children'] },
    },
  },

  /** 채혈침 — **가상이다.** 실제로 학생이 자기 손을 찌르는 활동이 아니다. */
  lancet: {
    file: 'lancet.js',
    realSizeMm: 55,    // ★ [확인 필요]
    viewBox: '0 0 400 300',
    states: ['used'],
    nodes: {
      '#body':        { required: true,  mutable: [] },
      '#body-shade':  { required: true,  mutable: [] },
      '#cap':         { required: true,  mutable: ['opacity', 'transform'] },
      '#tip':         { required: true,  mutable: ['opacity'] },
      // 다 쓴 것을 알아보게 하는 표시
      '#spent':       { required: true,  mutable: ['opacity'] },
    },
  },

  /** 손끝 — 소독 전/후와 맺힌 핏방울 */
  finger: {
    file: 'finger.js',
    realSizeMm: 90,    // ★ 손끝에서 둘째 마디까지 — [확인 필요]
    viewBox: '0 0 400 300',
    states: ['swabbed', 'drop', 'wiped'],
    nodes: {
      '#hand':        { required: true,  mutable: [] },
      '#hand-shade':  { required: true,  mutable: [] },
      '#nail':        { required: true,  mutable: [] },
      // 맺힌 핏방울. **선홍색이다** — 압축된 적혈구층의 암적색과 다른 색이다.
      '#drop':        { required: true,  mutable: ['opacity', 'transform'] },
      // 소독한 자리
      '#swabbed':     { required: true,  mutable: ['opacity'] },
    },
  },

  /** 소독솜 */
  swab: {
    file: 'swab.js',
    realSizeMm: 60,    // ★ [확인 필요]
    viewBox: '0 0 400 300',
    states: ['used'],
    nodes: {
      '#cotton':       { required: true, mutable: [] },
      '#cotton-shade': { required: true, mutable: [] },
      '#wrapper':      { required: true, mutable: ['opacity'] },
      '#damp':         { required: true, mutable: ['opacity'] },
    },
  },

  /** 자 — 층의 길이를 읽는다 */
  ruler: {
    file: 'ruler.js',
    realSizeMm: 150,   // ★ [확인 필요]
    viewBox: '0 0 400 300',
    states: [],
    nodes: {
      '#body':        { required: true,  mutable: [] },
      '#body-shade':  { required: true,  mutable: [] },
      '#ticks':       { required: true,  mutable: ['children'] },
    },
  },

  /** 손상성 폐기물 통 — 쓴 채혈침을 넣는다. 그냥 쓰레기통에 버리면 다음 사람이 찔린다. */
  sharpsbin: {
    file: 'sharpsbin.js',
    realSizeMm: 200,   // ★ [확인 필요]
    viewBox: '0 0 400 300',
    states: ['fill'],
    nodes: {
      '#body':        { required: true,  mutable: [] },
      '#body-shade':  { required: true,  mutable: [] },
      '#lid':         { required: true,  mutable: [] },
      '#slot':        { required: true,  mutable: [] },
      '#mark':        { required: true,  mutable: [] },
      '#fill':        { required: true,  mutable: ['opacity'] },
    },
  },

  /** 개수대 — 손을 씻는다 */
  sink:   { file: 'sink.js',   realSizeMm: 500,  viewBox: '0 0 400 300', states: ['water'],
            nodes: { '#basin': { required: true, mutable: [] },
                     '#basin-shade': { required: true, mutable: [] },
                     '#faucet': { required: true, mutable: [] },
                     '#water': { required: true, mutable: ['opacity'] } } },

  /** 폐기물 통 — 혈액이 묻은 모세관과 솜을 넣는다 */
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
  rotor:      { x0:  30, y0:  54, x1: 370, y1: 246 },
  capillary:  { x0:  14, y0: 128, x1: 382, y1: 193 },
  capbox:     { x0:  40, y0:  20, x1: 360, y1: 256 },
  clay:       { x0:  66, y0:  92, x1: 334, y1: 240 },
  lancet:     { x0:  62, y0: 124, x1: 379, y1: 246 },
  finger:     { x0:  40, y0: 104, x1: 334, y1: 206 },
  swab:       { x0:  82, y0:  82, x1: 318, y1: 250 },
  ruler:      { x0:  18, y0: 110, x1: 382, y1: 205 },
  sharpsbin:  { x0: 110, y0:  68, x1: 290, y1: 276 },
  sink:       { x0:  98, y0:  50, x1: 302, y1: 264 },
  bin:        { x0: 120, y0:  32, x1: 280, y1: 277 },
  tissue:     { x0: 110, y0:  58, x1: 318, y1: 232 },
  bench:      { x0:   0, y0:   0, x1: 400, y1: 300 },
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
