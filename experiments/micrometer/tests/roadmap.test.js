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
import { initialState, fieldParams, UNDO_LIMITS } from '../src/sim/state.js';
import { UI } from '../src/ui/strings.js';
import { reduce } from '../src/sim/rules.js';
import { renderFOV } from '../src/render/fov.js';
import { umPerEyepieceDiv } from '../src/sim/optics.js';

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
  // 결과 보드(T06)는 이 값들만 주고받는다. 이미지도 개인정보도 아니다.
  const p = fieldParams(initialState(1, 12345));
  const allowed = new Set([
    'on', 'hasReticle', 'flipped', 'eyeAngle', 'itemAngle', 'cracked',
    'objective', 'focusErr', 'contrast', 'panX', 'panY', 'seed',
  ]);
  for (const key of Object.keys(p)) {
    assert.ok(allowed.has(key), `fieldParams 에 예상 못 한 값이 있습니다: ${key}`);
  }
  for (const v of Object.values(p)) {
    assert.ok(['number', 'boolean', 'object', 'string'].includes(typeof v) || v === null);
  }
});

/* ---------------- 강제하지 않는가 ---------------- */

test('접안 눈금이 없어도 관찰은 되기는 된다', () => {
  // 막지 않는다. 다만 견줄 눈금이 없어 잴 것이 없다는 사실이 시야에 그대로 있다.
  let s = initialState(1, 42);
  s = reduce(s, { type: 'PLACE_ON_STAGE', payload: { item: 'specimen' } }).state;
  const svg = renderFOV(fieldParams(s));
  assert.ok(svg.includes('<svg'), '시야는 그려진다');
  assert.equal(fieldParams(s).hasReticle, false);
});

test('두 배율의 눈금값이 정확히 4배 차이 난다', () => {
  // 이 실험의 완성 판정. 이 관계가 깨지면 학생이 발견할 것이 없어진다.
  assert.equal(umPerEyepieceDiv(10) / umPerEyepieceDiv(40), 4);
});

test('접안 눈금은 배율을 바꿔도 화면에서 그대로다', () => {
  // 이 실험 전체가 이 비대칭 하나에 걸려 있다. 함께 확대되면 아무것도 안 가르친다.
  let s = initialState(1, 42);
  s = reduce(s, { type: 'INSERT_OCULAR', payload: {} }).state;
  s = reduce(s, { type: 'PLACE_ON_STAGE', payload: { item: 'stageMic' } }).state;
  // 레이어의 끝을 **중첩 <g> 를 세어** 찾는다. 글자 수로 잘라 내면 레이어를 넘어
  // 재물대 쪽까지 들어오고, 그건 배율에 따라 당연히 달라진다 — 멀쩡한 렌더러가
  // 틀린 것으로 잡힌다. 실제로 그렇게 잡았다가 고쳤다.
  const at = (obj) => {
    const t = reduce(s, { type: 'SET_OBJECTIVE', payload: { objective: obj } }).state;
    const svg = renderFOV(fieldParams(t));
    const i = svg.indexOf('id="fov-reticle"');
    assert.ok(i > 0, '접안 눈금 레이어를 찾지 못했습니다');
    let depth = 0;
    let j = i;
    for (; j < svg.length; j++) {
      if (svg.startsWith('<g', j)) depth++;
      else if (svg.startsWith('</g>', j)) { depth--; if (depth <= 0) { j += 4; break; } }
    }
    return svg.slice(i, j);
  };
  assert.equal(at(10), at(40), '배율을 바꿔도 접안 눈금 레이어가 같아야 한다');
});

test('같은 시드는 같은 그림, 다른 시드는 다른 그림', () => {
  // 표본을 볼 때 시드가 세포 배치를 정한다. 눈금자는 규격이라 시드와 무관하다 —
  // 그러니 이 검사는 반드시 표본으로 해야 한다.
  const p = (seed) => ({
    on: 'specimen', hasReticle: true, flipped: false, eyeAngle: 0, itemAngle: 0,
    cracked: false, objective: 40, focusErr: 0, contrast: 1, panX: 0, panY: 0, seed,
  });
  assert.equal(renderFOV(p(7)), renderFOV(p(7)));
  assert.notEqual(renderFOV(p(7)), renderFOV(p(8)));
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
  // docs/06 은 3단계에서 메시지만 줄이라고 한다. 막는 것을 늘리면 안 된다.
  // 일부러 엉망으로 하는 각본. 난이도가 올라가도 막히는 횟수가 늘면 안 된다.
  const script = [
    ['PLACE_ON_STAGE', { item: 'specimen' }],     // 접안 눈금 없이 올린다
    ['SET_OBJECTIVE', { objective: 40 }],          // 저배율을 건너뛴다
    ['COARSE_FOCUS', { delta: 0.4 }],              // 고배율에서 조동나사 → 깨진다
    ['PLACE_ON_STAGE', { item: 'specimen' }],      // 깨진 것을 다시 올린다 → 유일한 하드 게이트
    ['PICK_SCALE', { x: 0.3 }],
    ['RECORD_CALIBRATION', {}],
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
