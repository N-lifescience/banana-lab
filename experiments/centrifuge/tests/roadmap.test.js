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
import {
  initialState, tubeParams, UNDO_LIMITS, ENDS, SLOTS, SLOT_ITEMS, ANGLE_BEST_DEG,
} from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';
import { reduce } from '../src/sim/rules.js';
import { renderTube, layerBands } from '../src/render/tube.js';
import { HEMATOCRIT, layerFractions, beatRate } from '../src/sim/spin.js';
import { EXP_PALETTE } from '../src/style/palette.experiment.js';

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
  // 기록(CAPTURE)과 제출이 함께 쓰는 값 한 벌이다. 이미지도 개인정보도 아니다.
  const p = tubeParams(initialState(1, 12345));
  const allowed = new Set([
    'column', 'packedOfColumn', 'buffyOfColumn', 'separation', 'sharpness',
    'clotted', 'clot', 'bubbles', 'lost', 'mixed', 'broken', 'seal',
    'kind', 'donor', 'rulerPlaced', 'tubeLenMm', 'seed',
  ]);
  for (const key of Object.keys(p)) {
    assert.ok(allowed.has(key), `tubeParams 에 예상 못 한 값이 있습니다: ${key}`);
  }
  for (const v of Object.values(p)) {
    assert.ok(['number', 'boolean', 'object', 'string'].includes(typeof v) || v === null);
  }
});

/* ---------------- 강제하지 않는가 ---------------- */

test('절차를 어겨도 끝까지 갈 수는 있다', () => {
  // 막혀 있으면 개정 취지가 사라진 것이다.
  // 소독도 안 하고, 헤파린도 없는 관에, 한쪽만 막고, 균형도 안 맞추고 돌린다.
  let s = initialState(1, 12345);
  const go = (t, p = {}) => {
    const r = reduce(s, { type: t, payload: p });
    assert.notEqual(r.outcome, 'blocked', `${t} 이 막혔습니다 — 이 실험은 막지 않습니다`);
    s = r.state;
    return r;
  };
  go('PICK_CAPILLARY', { kind: 'plain' });
  go('NEW_CAPILLARY', { kind: 'plain' });
  go('PRICK_FINGER');
  go('DRAW_BLOOD', { angleDeg: 0, dwell: 0.9 });
  go('SEAL_END', { end: ENDS.OUTER, press: 0.2 });
  go('LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE });
  for (let i = 0; i < 10; i++) go('PULL', { strength: 0.4 });
  go('MEASURE');
  go('CAPTURE');
  assert.equal(s.session.captures.length, 1, '엉망으로 해도 기록까지는 가야 한다');
});

/* ---------------- 과학적으로 맞는가 ---------------- */

test('층의 차례가 바깥쪽부터 적혈구 → 연층 → 혈장이다', () => {
  // **이 차례가 이 실험에서 가장 자주 뒤집히는 자리다.** 회전판이 모세관을 수평으로 물어서,
  // 교과서 그림의 「아래」를 위/아래로 되돌려 생각하다가 뒤집는다.
  const bands = layerBands({
    column: 0.8, packedOfColumn: HEMATOCRIT.male, buffyOfColumn: 0.007, clotted: false,
  });
  assert.deepEqual(bands.map((b) => b.id), ['packed', 'buffy', 'plasma']);
  // from 이 0 인 것이 **바깥쪽 끝**이다.
  assert.equal(bands[0].from, 0);
  for (let i = 1; i < bands.length; i++) {
    assert.ok(bands[i].from >= bands[i - 1].to - 1e-12, '띠가 겹치거나 순서가 뒤집혔습니다');
  }
});

test('연층은 아주 얇고, 적혈구층은 기둥의 절반쯤이다', () => {
  const { packed, buffy, plasma } = layerFractions(HEMATOCRIT.male);
  assert.ok(buffy < 0.01, '연층을 두껍게 그리면 백혈구가 적혈구만큼 많다는 틀린 그림이 된다');
  assert.ok(packed > 0.4 && packed < 0.5);
  assert.ok(Math.abs(plasma - 0.55) < 1e-12);
});

test('응고하면 위에 뜨는 것의 이름이 혈청으로 바뀐다', () => {
  // 혈장과 혈청은 다른 것이다 — 응고인자가 혈병으로 빠져나갔다 (AGENTS.md §2.5).
  const clean = layerBands({ column: 0.8, packedOfColumn: 0.45, buffyOfColumn: 0.007 });
  const clotted = layerBands({ column: 0.8, packedOfColumn: 0.45, buffyOfColumn: 0, clotted: true });
  assert.ok(clean.some((b) => b.id === 'plasma'));
  assert.ok(clotted.some((b) => b.id === 'serum'));
  assert.ok(clotted.some((b) => b.id === 'clot'));
});

test('압축된 적혈구층은 암적색이고, 선홍은 채혈 순간의 핏방울뿐이다', () => {
  const svg = renderTube({
    column: 0.8, packedOfColumn: 0.45, buffyOfColumn: 0.007, sharpness: 1,
    seal: { outer: 1, inner: 1 }, kind: 'heparin', seed: 1,
  }, { idPrefix: 't-' });
  assert.ok(svg.includes(EXP_PALETTE.packedCells[0]), '적혈구층에 암적색이 없습니다');
  assert.equal(svg.includes(EXP_PALETTE.bloodFresh[0]), false,
    '다 갈라진 결과에 선홍(생혈)이 섞여 있습니다 — 두 색을 갈라 칠합니다');

  // 그리고 **갈리기 전에는 선홍이어야 한다.** 한 색으로 칠하면
  // "다져져서 어두워졌다" 는 변화가 화면에서 사라진다 — 눈으로 보는 것의 절반이 그것이다.
  const raw = renderTube({
    column: 0.8, packedOfColumn: 1, buffyOfColumn: 0, separation: 0, sharpness: 0,
    seal: { outer: 1, inner: 1 }, kind: 'heparin', seed: 1,
  }, { idPrefix: 'r-' });
  assert.ok(raw.includes(EXP_PALETTE.bloodFresh[0]), '갈리기 전 생혈이 선홍이 아닙니다');
  assert.equal(raw.includes(EXP_PALETTE.packedCells[0]), false,
    '갈리기도 전에 암적색으로 칠하면 변화가 안 보입니다');
});

test('빈 관에는 아무 층도 없다', () => {
  assert.deepEqual(layerBands({ column: 0 }), []);
});

/* ---------------- 만듦새 ---------------- */

test('같은 값이면 같은 그림이 나온다', () => {
  const p = (seed) => ({
    column: 0.8, packedOfColumn: 0.45, buffyOfColumn: 0.007, sharpness: 0.8,
    bubbles: 0.5, seal: { outer: 1, inner: 1 }, kind: 'heparin', seed,
  });
  assert.equal(renderTube(p(7), { idPrefix: 'a-' }), renderTube(p(7), { idPrefix: 'a-' }));
  assert.notEqual(renderTube(p(7), { idPrefix: 'a-' }), renderTube(p(8), { idPrefix: 'a-' }));
});

test('idPrefix 를 달리 주면 id 가 부딪히지 않는다', () => {
  // 한 화면에 여러 장을 그리는 순간 **에러 없이 조용히** 틀린다 — 뒤엣것의 그라데이션을
  // 앞엣것이 쓴다. 결과 카드가 여럿 쌓이는 탐구 노트 5단계에서 실제로 일어나는 일이다.
  const p = { column: 0.8, packedOfColumn: 0.45, buffyOfColumn: 0.007, sharpness: 0.5, seed: 1 };
  const a = [...renderTube(p, { idPrefix: 'cap0-' }).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const b = [...renderTube(p, { idPrefix: 'cap1-' }).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(a.length > 0, 'id 가 하나도 없으면 이 검사가 아무것도 안 봅니다');
  assert.equal(a.some((id) => b.includes(id)), false, `id 가 겹칩니다: ${a.join(', ')}`);
});

test('방향을 글자로 적어 둔다', () => {
  // 이 두 낱말이 없으면 그리는 사람도 읽는 사람도 위/아래로 되돌려 생각하다 뒤집는다.
  const svg = renderTube({ column: 0.5, packedOfColumn: 0.45, seed: 1 }, { idPrefix: 'd-' });
  assert.match(svg, /바깥쪽/);
  assert.match(svg, /축 쪽/);
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
  // 난이도는 설명만 줄인다. 막는 것을 늘리면 그건 길을 막은 것이다.
  const script = [
    ['PRICK_FINGER', {}],
    ['DRAW_BLOOD', { angleDeg: 0, dwell: 0.9 }],
    ['SEAL_END', { end: ENDS.OUTER, press: 0.2 }],
    ['LOAD_ROTOR', { slot: SLOTS.A, what: SLOT_ITEMS.SAMPLE }],
    ['PULL', { strength: 1 }],
    ['PULL', { strength: 1 }],
    ['UNLOAD', { slot: SLOTS.A }],
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
