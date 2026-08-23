#!/usr/bin/env node
/**
 * 아트 디렉션 린터.
 *
 * "라인 + 플랫" 을 사람의 눈이 아니라 기계가 강제한다.
 * 등록된 애셋을 대표 상태마다 렌더링해서 다음을 검사한다:
 *
 *   1. 그라데이션·필터를 쓰지 않았는가
 *   2. 모든 채움색이 PALETTE 안에 있는가
 *   3. 모든 외곽선이 INK 한 가지인가
 *   4. 선 두께가 STROKE 세 값 중 하나인가
 *   5. 계약(contract.js)에 선언된 노드가 전부, 한 번씩 있는가
 *   6. viewBox 가 계약과 같은가
 *   7. realSizeMm 이 계약에 선언돼 있는가 (값의 정합성은 검사하지 않는다)
 *
 * 통과하지 못하면 종료 코드 1. CI와 에이전트가 이 값을 본다.
 */

import { ASSETS, PENDING, SAMPLE_STATES } from '../src/assets/index.js';
import { CONTRACT, requiredNodes } from '../src/assets/contract.js';
import { ALLOWED_FILLS, ALLOWED_STROKE_WIDTHS, INK } from '../src/style/tokens.js';

const FORBIDDEN_ELEMENTS = [
  'linearGradient', 'radialGradient', 'filter',
  'feGaussianBlur', 'feDropShadow', 'feColorMatrix', 'image',
];

const problems = [];
let checked = 0;

function attrValues(svg, attr) {
  const re = new RegExp(`\\b${attr}="([^"]*)"`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(svg)) !== null) out.push(m[1]);
  return out;
}

function checkOne(name, state, svg, label) {
  const where = `${name} [${label}]`;
  checked++;

  for (const el of FORBIDDEN_ELEMENTS) {
    if (new RegExp(`<${el}[\\s/>]`).test(svg)) {
      problems.push(`${where}: <${el}> 사용 — 라인+플랫에서는 금지입니다 (docs/01-art-direction.md)`);
    }
  }

  for (const v of attrValues(svg, 'fill')) {
    if (v.startsWith('url(')) {
      problems.push(`${where}: fill="${v}" — 그라데이션·패턴 채움은 금지입니다`);
    } else if (!ALLOWED_FILLS.has(v)) {
      problems.push(`${where}: 팔레트에 없는 채움색 "${v}" — src/style/tokens.js 에 먼저 추가하세요`);
    }
  }

  for (const v of attrValues(svg, 'stroke')) {
    if (v !== INK && v !== 'none') {
      problems.push(`${where}: 외곽선 색 "${v}" — 모든 애셋은 INK(${INK}) 한 가지만 씁니다`);
    }
  }

  for (const v of attrValues(svg, 'stroke-width')) {
    if (!ALLOWED_STROKE_WIDTHS.has(v)) {
      problems.push(`${where}: 선 두께 "${v}" — STROKE(3 / 2 / 1.5) 중 하나여야 합니다`);
    }
  }

  const spec = CONTRACT[name];
  if (!spec) {
    problems.push(`${where}: contract.js 에 선언되지 않은 애셋입니다`);
    return;
  }

  const vb = attrValues(svg, 'viewBox')[0];
  if (vb !== spec.viewBox) {
    problems.push(`${where}: viewBox "${vb}" — 계약은 "${spec.viewBox}" 입니다`);
  }

  // 선언 여부만 본다. 값이 실물과 맞는지는 기계가 판정할 수 없어 사람이 본다.
  if (typeof spec.realSizeMm !== 'number' || !(spec.realSizeMm > 0)) {
    problems.push(`${where}: contract.js 에 realSizeMm(실물의 가장 긴 변, mm)이 없습니다`);
  }

  for (const id of requiredNodes(name)) {
    const bare = id.slice(1);
    const count = (svg.match(new RegExp(`\\bid="${bare}"`, 'g')) || []).length;
    if (count === 0) problems.push(`${where}: 계약 노드 ${id} 가 없습니다`);
    if (count > 1) problems.push(`${where}: 계약 노드 ${id} 가 ${count}번 나옵니다 — id는 유일해야 합니다`);
  }
}

/**
 * 애셋 이름을 인자로 주면 그 하나만 검사한다. index.js 등록 여부와 무관하다.
 *
 *   npm run check:art            # 등록된 애셋 전부
 *   npm run check:art -- slide   # slide.js 만 (아직 등록 전이어도 됨)
 *
 * 애셋 제작을 여러 에이전트에게 병렬로 맡길 때, 각자 자기 것만 검사하고
 * index.js 는 마지막에 한 번만 손대면 되도록 하기 위한 장치다.
 */
const only = process.argv[2] ?? null;

let entries;
if (only) {
  try {
    entries = [[only, await import(`../src/assets/${only}.js`)]];
  } catch (e) {
    console.log(`\nsrc/assets/${only}.js 를 불러올 수 없습니다 — ${e.message}\n`);
    process.exit(1);
  }
} else {
  entries = Object.entries(ASSETS);
}

for (const [name, mod] of entries) {
  if (typeof mod.render !== 'function') {
    problems.push(`${name}: render(state) 를 내보내지 않았습니다`);
    continue;
  }
  const states = SAMPLE_STATES[name] ?? [{}];
  states.forEach((st, i) => {
    let svg;
    try {
      svg = mod.render(st);
    } catch (e) {
      problems.push(`${name} [state ${i}]: render() 가 던졌습니다 — ${e.message}`);
      return;
    }
    checkOne(name, st, svg, `state ${i}`);
  });
}

/* ------------------------------------------------------------------ */

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.log(`\n아트 디렉션 검사 — 애셋 ${entries.length}종, ${checked}개 상태\n`);

if (problems.length) {
  for (const p of problems) console.log(`  ${red('✗')} ${p}`);
  console.log(`\n${red(`${problems.length}건 위반`)}\n`);
  process.exit(1);
}

console.log(`  ${green('✓')} 위반 없음`);
if (!only && PENDING.length) {
  console.log(dim(`\n  그림을 다시 그려야 하는 애셋 ${PENDING.length}종: ${PENDING.join(', ')}`));
  console.log(dim('  계약과 상호작용은 이미 붙어 있고 형태만 자리표시입니다.'));
  console.log(dim('  tasks/T12-PROMPT.md 참조. src/assets/banana.js 를 본보기로 만드세요.'));
}
console.log('');
