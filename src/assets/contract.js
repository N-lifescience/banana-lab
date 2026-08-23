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
 */
export const CONTRACT = {
  banana: {
    file: 'banana.js',
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
    viewBox: '0 0 400 300',
    states: ['sample', 'stain', 'reaction', 'coverslip', 'bubbles'],
    nodes: {
      '#glass':       { required: true,  mutable: [] },
      '#glass-shade': { required: true,  mutable: [] },
      '#smear':       { required: true,  mutable: ['fill', 'fill-opacity', 'transform'] },
      '#coverslip':   { required: true,  mutable: ['transform', 'opacity'] },
      '#bubbles':     { required: true,  mutable: ['children'] },
      '#label':       { required: false, mutable: ['children'] },
    },
  },

  coverslip: {
    file: 'coverslip.js',
    viewBox: '0 0 400 300',
    states: ['angle', 'held'],
    nodes: {
      '#glass':       { required: true,  mutable: ['transform'] },
      '#glass-shade': { required: true,  mutable: [] },
    },
  },

  dropper: {
    file: 'dropper.js',
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

  dish:   { file: 'dish.js',   viewBox: '0 0 400 300', states: ['contents'],
            nodes: { '#dish': { required: true, mutable: [] },
                     '#dish-shade': { required: true, mutable: [] },
                     '#contents': { required: true, mutable: ['children'] } } },

  waste:  { file: 'waste.js',  viewBox: '0 0 400 300', states: ['level'],
            nodes: { '#bin': { required: true, mutable: [] },
                     '#bin-shade': { required: true, mutable: [] },
                     '#level': { required: true, mutable: ['y', 'height', 'fill'] } } },

  tissue: { file: 'tissue.js', viewBox: '0 0 400 300', states: ['used'],
            nodes: { '#box': { required: true, mutable: [] },
                     '#box-shade': { required: true, mutable: [] },
                     '#sheet': { required: true, mutable: ['opacity'] } } },

  bench:  { file: 'bench.js',  viewBox: '0 0 400 300', states: [],
            nodes: { '#surface': { required: true, mutable: [] },
                     '#surface-shade': { required: true, mutable: [] },
                     '#shelf': { required: true, mutable: [] } } },
};

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
