/**
 * 완성 판정 체크리스트 (`docs/08-roadmap.md`) 중 **기계로 확실히 판정되는 것**만.
 *
 * 체크리스트는 18줄이고 대부분은 눈으로 봐야 한다. 여기 있는 것은 눈으로 보면 놓치기 쉽고
 * 기계로는 확실한 것들이다. 특히 개인정보 항목은 사람 눈에 맡기면 안 된다 —
 * 한 번 놓치면 학생 정보가 남는다.
 *
 * 애매한 것을 여기 넣지 말 것. 오탐이 한 번 나면 `npm run check` 를 아무도 믿지 않게 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { initialState, stripParams, UNDO_LIMITS, MARKERS } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';
import { reduce } from '../src/sim/rules.js';
import { renderStrip, visibleBands } from '../src/render/strip.js';
import { PIGMENT_IDS, ORIGIN_MM } from '../src/sim/develop.js';

const FIELD_PX = 328;

function sourceFiles() {
  const dir = new URL('../src/ui/', import.meta.url);
  const files = readdirSync(dir).map((f) => [`src/ui/${f}`, readFileSync(new URL(f, dir), 'utf8')]);
  files.push(['index.html', readFileSync(new URL('../index.html', import.meta.url), 'utf8')]);
  files.push(['src/main.js', readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')]);
  return files;
}

/* ---------------- 개인정보 — 눈으로 보면 놓친다 ---------------- */

/**
 * 개인정보 입력칸이 없는지 본다.
 *
 * 처음에는 소스 전체를 정규식으로 훑었다. **그게 틀렸다.**
 * 주석의 평범한 문장("슬라이드·용액 이름을 글자로 둔다")에 걸리면서,
 * 정작 진짜 입력칸(`<label>학번</label><input>`)은 놓쳤다.
 * 산문을 훑으면 오탐과 누락이 함께 온다.
 *
 * 대신 이 저장소의 불변식을 쓴다 — **화면에 보이는 한국어는 전부 `strings.js` 에 있다.**
 * 학생에게 이름을 물으려면 그 문구가 거기 있어야 한다. 주석에는 뭐라고 적혀 있든 상관없다.
 * 여기에 더해 화면에 직접 노출되는 자리(placeholder / aria-label / input type)만 본다.
 */

/** 객체 안의 모든 문자열을 경로와 함께 뽑는다 */
function allStrings(obj, path = 'UI', out = []) {
  if (typeof obj === 'string') out.push([path, obj]);
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) allStrings(v, `${path}.${k}`, out);
  }
  return out;
}

test('학생에게 이름·학번을 묻는 문구가 없다', () => {
  // 물어보는 문구여야 걸린다. "이름표", "애셋 이름" 같은 말은 걸리지 않는다.
  const asking = /(이름|성명|학번|학년|생년월일|연락처|전화)\s*(을|를)?\s*(입력|적|쓰|기입|알려)/;
  for (const [path, text] of allStrings(UI)) {
    assert.equal(asking.test(text), false,
      `${path} 가 개인정보를 묻습니다: "${text}"`);
  }
});

test('개인정보를 받는 입력칸이 화면에 없다', () => {
  // 주석은 보지 않는다. 화면에 실제로 노출되는 자리만 본다.
  const piiWord = /(이름|성명|학번|학년|생년월일|연락처|전화|이메일)/;
  for (const [name, src] of sourceFiles()) {
    for (const m of src.matchAll(/(?:placeholder|aria-label)\s*=\s*["'`]([^"'`]*)["'`]/g)) {
      assert.equal(piiWord.test(m[1]), false, `${name} 의 입력칸이 개인정보를 받습니다: "${m[1]}"`);
    }
    for (const m of src.matchAll(/<label[^>]*>([^<]*)<\/label>/g)) {
      assert.equal(piiWord.test(m[1]), false, `${name} 의 라벨이 개인정보를 가리킵니다: "${m[1]}"`);
    }
    const typed = src.match(/type\s*=\s*["'`]?(email|tel)\b/);
    assert.equal(typed, null, `${name} 에 ${typed?.[1]} 입력칸이 있습니다`);
  }
});

test('제출 대상 값에 개인을 가리키는 것이 없다', () => {
  // 결과 보드는 이 값들만 주고받는다. 이미지도 개인정보도 아니다.
  // 여기에 무언가 더하면 이 검사가 먼저 빨간불이 된다 — 그게 이 검사가 있는 이유다.
  const p = stripParams(initialState(1, 12345));
  const allowed = new Set([
    'originMm', 'marker', 'spots', 'spotMm', 'load', 'rawLoad', 'grit',
    'frontMm', 'overrun', 'markedFront', 'markedBands', 'rulerPlaced',
    'submerged', 'washedOut', 'chlorophyllKept', 'wetness', 'torn',
    'depthMm', 'inVial', 'seed',
    // 전개할 때의 깊이(mm). 그림용 depthMm 은 꺼내면 0 이라 카드·보고서가 「0 mm」를 찍었다 (PLAYTEST-REVIEW).
    'runDepthMm',
  ]);
  for (const key of Object.keys(p)) {
    assert.ok(allowed.has(key), `stripParams 에 예상 못 한 값이 있습니다: ${key}`);
  }
  for (const v of Object.values(p)) {
    assert.ok(['number', 'boolean', 'object', 'string'].includes(typeof v) || v === null);
  }
});

/* ---------------- 강제하지 않는가 ---------------- */

test('원점이 잠기게 세우는 것도 막히지 않는다', () => {
  // 막혀 있으면 개정 취지가 사라진 것이다. 진행되고, 결과가 답한다.
  let s = initialState(1, 12345);
  s = reduce(s, { type: 'ADD_LEAF', payload: {} }).state;
  s = reduce(s, { type: 'ADD_EXTRACT', payload: {} }).state;
  s = reduce(s, { type: 'SHAKE', payload: { amount: 1 } }).state;
  for (let i = 0; i < 12; i++) s = reduce(s, { type: 'TICK', payload: {} }).state;
  s = reduce(s, { type: 'DRAW_ORIGIN', payload: {} }).state;
  s = reduce(s, { type: 'LOAD_CAPILLARY', payload: {} }).state;
  for (let i = 0; i < 12; i++) {
    s = reduce(s, { type: 'SPOT', payload: { dwell: 0.2 } }).state;
    s = reduce(s, { type: 'DRY_SPOT', payload: {} }).state;
  }
  // 원점(10 mm)보다 깊게 붓는다. 막히지 않는다.
  const poured = reduce(s, { type: 'POUR_SOLVENT', payload: { mm: 20 } });
  assert.notEqual(poured.outcome, 'blocked');
  const inserted = reduce(poured.state, { type: 'INSERT_PAPER', payload: {} });
  assert.notEqual(inserted.outcome, 'blocked');
  assert.equal(inserted.state.paper.inVial, true, '세워지기는 세워져야 한다');
  const shot = reduce(inserted.state, { type: 'CAPTURE', payload: {} });
  assert.notEqual(shot.outcome, 'blocked', '기록까지 되어야 한다');
});

/* ---------------- 과학적으로 맞는가 ---------------- */

test('원점이 잠기면 띠가 하나도 남지 않는다', () => {
  // 색소가 종이를 타고 오르는 대신 전개액에 풀려 나간다. 그것이 이 실험의 가장 큰 실패다.
  assert.deepEqual(visibleBands({
    originMm: ORIGIN_MM, load: 0.9, frontMm: 90, submerged: true, spotMm: 2,
  }), []);
});

test('띠 순서는 종이의 순서다 — 카로틴이 가장 높다', () => {
  // 실리카겔 TLC 로 바꾸면 잔토필이 맨 아래로 내려간다. 이름을 바꾸려면 순서도 바꿔야 한다
  // (AGENTS.md §2.5). 그때 이 검사가 먼저 빨간불이 된다.
  const bands = visibleBands({ originMm: ORIGIN_MM, load: 0.9, frontMm: 90, spotMm: 2 });
  const topDown = [...bands].sort((a, b) => b.atMm - a.atMm).map((b) => b.id);
  assert.deepEqual(topDown, PIGMENT_IDS);
});

test('빛을 쬐면 엽록소 두 띠만 옅어진다', () => {
  // 엽록소는 빛에 쉽게 파괴된다. 카로티노이드 둘은 그대로다.
  const base = { originMm: ORIGIN_MM, load: 0.9, frontMm: 90, spotMm: 2 };
  const by = (bs) => Object.fromEntries(bs.map((b) => [b.id, b.alpha]));
  const dark = by(visibleBands(base));
  const lit = by(visibleBands({ ...base, chlorophyllKept: 0.1 }));
  assert.ok(lit.chlorophyllA < dark.chlorophyllA);
  assert.ok(lit.chlorophyllB < dark.chlorophyllB);
  assert.equal(lit.carotene, dark.carotene);
  assert.equal(lit.xanthophyll, dark.xanthophyll);
});

test('앱은 정답 전개율을 갖고 있지 않다 — 그림에 Rf 를 적지 않는다', () => {
  const svg = renderStrip({
    originMm: ORIGIN_MM, marker: MARKERS.PENCIL, load: 0.9, frontMm: 90,
    markedFront: 90, markedBands: true, rulerPlaced: true, spotMm: 2, seed: 1,
  }, { labels: true });
  assert.equal(/Rf|전개율/.test(svg), false);
});

/* ---------------- 만듦새 ---------------- */

test('같은 시드는 같은 그림, 다른 시드는 다른 그림', () => {
  const p = (seed) => ({
    originMm: ORIGIN_MM, marker: MARKERS.PENCIL, load: 0.9, frontMm: 90,
    markedFront: 90, spotMm: 2, seed,
  });
  assert.equal(renderStrip(p(7)), renderStrip(p(7)));
  assert.notEqual(renderStrip(p(7)), renderStrip(p(8)));
});

/* ---------------- 난이도가 실제로 다른가 ---------------- */

test('세 난이도의 되돌리기 횟수가 다르다', () => {
  assert.equal(UNDO_LIMITS[1], Infinity);
  assert.equal(UNDO_LIMITS[2], 3);
  assert.equal(UNDO_LIMITS[3], 1);
  const seen = new Set([1, 2, 3].map((lv) => String(initialState(lv).session.undosLeft)));
  assert.equal(seen.size, 3, '세 난이도가 실제로 달라야 합니다');
});

test('난이도를 올려도 하드 게이트가 늘지 않는다', () => {
  // 난이도는 **설명만** 줄인다. 막는 것을 늘리면 그건 설명을 줄인 게 아니라 길을 막은 것이다.
  const script = [
    ['ADD_LEAF', {}],
    ['ADD_EXTRACT', {}],
    ['SHAKE', { amount: 1 }],
    ['DRAW_ORIGIN', { heightMm: 3, marker: 'pen' }],
    ['LOAD_CAPILLARY', {}],
    ['SPOT', { dwell: 1 }],
    ['POUR_SOLVENT', { mm: 25 }],
    ['CAP_VIAL', {}],
    ['INSERT_PAPER', {}],       // 뚜껑이 닫혀 있어 막힌다 — 세 단계 모두 똑같이
    ['UNCAP_VIAL', {}],
    ['INSERT_PAPER', {}],
    ['MEASURE', {}],
    ['CAPTURE', {}],
  ];
  const blockedCount = (level) => {
    let s = initialState(level, 999);
    let n = 0;
    for (const [type, payload] of script) {
      const r = reduce(s, { type, payload });
      if (r.outcome === 'blocked') n++;
      s = r.state;
    }
    return n;
  };
  assert.equal(blockedCount(3), blockedCount(1),
    '3단계에서 막히는 횟수가 1단계와 같아야 합니다 — 메시지만 줄인다');
});
