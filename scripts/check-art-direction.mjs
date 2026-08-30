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
 *
 * ── ★ 실험 **전부**를 돈다 (합치기 4단계, 2026-08-30) ─────────────────
 * 앞서 이 파일은 `experiments/banana/…` 를 **손으로 적어** 하나만 봤다. 실험이 셋이
 * 된 뒤에도 그대로였고, `npm run check` 는 그동안 「애셋 15종 · 위반 없음」이라고
 * 말하고 있었다. **micrometer 와 osmosis 의 애셋 스물여섯은 한 번도 안 봤다.**
 *
 * 못 잡는 것보다 나쁘다 — **잡았다고 착각하게 만든다.** 폴더를 읽어 도는 것으로 바꿨고,
 * 애셋이 하나도 없는 실험이 있으면 **조용히 건너뛰지 않고 빨간불**을 낸다.
 *
 * ── 색은 실험마다 따로 허용한다 (`MERGE-AND-DEPLOY.md` §3.1) ──────────
 * 기구 색(`tokens.js`)은 공용이고, 시약색·반응색(`palette.experiment.js`)은 그 실험 것이다.
 * 여덟 실험의 색을 한 통에 합쳐서 허용하면 **양파의 카민색이 카탈레이스 애셋에 들어가도
 * 안 잡힌다.** 그래서 실험마다 `공용 + 자기 것`으로 따로 잰다.
 */

import { readdirSync, existsSync } from 'node:fs';

const at = (p) => new URL(`../${p}`, import.meta.url);

/** 이 저장소에 들어 있는 실험들 — 폴더가 곧 목록이다. 손으로 적지 않는다. */
const EXPERIMENTS = readdirSync(at('experiments'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const FORBIDDEN_ELEMENTS = [
  'linearGradient', 'radialGradient', 'filter',
  'feGaussianBlur', 'feDropShadow', 'feColorMatrix', 'image',
];

const problems = [];
let checked = 0;
let assetCount = 0;

function attrValues(svg, attr) {
  const re = new RegExp(`\\b${attr}="([^"]*)"`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(svg)) !== null) out.push(m[1]);
  return out;
}

function checkOne(exp, name, svg, label, rules) {
  const { CONTRACT, requiredNodes, ALLOWED_FILLS_EXT, ALLOWED_STROKE_WIDTHS, INK } = rules;
  const where = `${exp}/${name} [${label}]`;
  checked++;

  for (const el of FORBIDDEN_ELEMENTS) {
    if (new RegExp(`<${el}[\\s/>]`).test(svg)) {
      problems.push(`${where}: <${el}> 사용 — 라인+플랫에서는 금지입니다 (docs/01-art-direction.md)`);
    }
  }

  for (const v of attrValues(svg, 'fill')) {
    if (v.startsWith('url(')) {
      problems.push(`${where}: fill="${v}" — 그라데이션·패턴 채움은 금지입니다`);
    } else if (!ALLOWED_FILLS_EXT.has(v)) {
      problems.push(`${where}: 팔레트에 없는 채움색 "${v}" — 기구색이면 style/tokens.js, `
        + `이 실험의 반응색이면 experiments/${exp}/src/style/palette.experiment.js 의 EXP_PALETTE 에 넣으세요`);
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

/** 그 실험의 규칙 한 벌 — 계약 · 공용 기구색 + **그 실험의** 반응색. */
async function rulesFor(exp) {
  const { CONTRACT, requiredNodes } = await import(at(`experiments/${exp}/src/assets/contract.js`).href);
  const { ALLOWED_FILLS, ALLOWED_STROKE_WIDTHS, INK } =
    await import(at(`experiments/${exp}/src/style/tokens.js`).href);

  // 반응색을 안 쓰는 실험은 파일이 없을 수 있다 — 그때는 공용 색만 허용된다.
  let EXP_PALETTE = {};
  const palette = at(`experiments/${exp}/src/style/palette.experiment.js`);
  if (existsSync(palette)) ({ EXP_PALETTE = {} } = await import(palette.href));

  const EXP_FILLS = Object.values(EXP_PALETTE).flat(Infinity).map(String);
  return {
    CONTRACT,
    requiredNodes,
    ALLOWED_FILLS_EXT: new Set([...ALLOWED_FILLS, ...EXP_FILLS]),
    ALLOWED_STROKE_WIDTHS,
    INK,
  };
}

function renderAll(exp, name, mod, states, rules) {
  if (typeof mod.render !== 'function') {
    problems.push(`${exp}/${name}: render(state) 를 내보내지 않았습니다`);
    return;
  }
  assetCount++;
  states.forEach((st, i) => {
    let svg;
    try {
      svg = mod.render(st);
    } catch (e) {
      problems.push(`${exp}/${name} [state ${i}]: render() 가 던졌습니다 — ${e.message}`);
      return;
    }
    checkOne(exp, name, svg, `state ${i}`, rules);
  });
}

/**
 * 애셋 이름을 인자로 주면 그 하나만 검사한다. index.js 등록 여부와 무관하다.
 *
 *   npm run check:art                    # 실험 전부, 등록된 애셋 전부
 *   npm run check:art -- slide           # 이름이 slide 인 애셋 (실험을 뒤져 찾는다)
 *   npm run check:art -- osmosis/slide   # 그 실험의 것만
 *
 * 애셋 제작을 여러 에이전트에게 병렬로 맡길 때, 각자 자기 것만 검사하고
 * index.js 는 마지막에 한 번만 손대면 되도록 하기 위한 장치다.
 */
const only = process.argv[2] ?? null;
const PENDING_BY_EXP = [];

if (only) {
  const [a, b] = only.includes('/') ? only.split('/') : [null, only];
  const where = a ? [a] : EXPERIMENTS;
  const found = where.filter((exp) => existsSync(at(`experiments/${exp}/src/assets/${b}.js`)));
  if (!found.length) {
    console.log(`\n${b}.js 를 찾지 못했습니다 — 뒤진 곳: ${where.map((e) => `experiments/${e}/src/assets/`).join(' · ')}\n`);
    process.exit(1);
  }
  for (const exp of found) {
    const rules = await rulesFor(exp);
    const mod = await import(at(`experiments/${exp}/src/assets/${b}.js`).href);
    const { SAMPLE_STATES } = await import(at(`experiments/${exp}/src/assets/index.js`).href);
    renderAll(exp, b, mod, SAMPLE_STATES[b] ?? [{}], rules);
  }
} else {
  /*
   * **애셋이 없는 실험은 조용히 지나가지 않는다.** 폴더를 읽어 도는 방식의 값은
   * 실험이 늘 때 저절로 붙는 것인데, 대가는 **못 읽으면 0종을 검사하고도 초록불**이다.
   * 여기서 세워 둔다.
   */
  for (const exp of EXPERIMENTS) {
    const index = at(`experiments/${exp}/src/assets/index.js`);
    if (!existsSync(index)) {
      problems.push(`${exp}: experiments/${exp}/src/assets/index.js 가 없습니다 — 이 실험의 애셋을 한 종도 검사하지 못합니다`);
      continue;
    }
    const rules = await rulesFor(exp);
    const { ASSETS, PENDING = [], SAMPLE_STATES = {} } = await import(index.href);
    const names = Object.keys(ASSETS);
    if (!names.length) {
      problems.push(`${exp}: assets/index.js 의 ASSETS 가 비어 있습니다 — 검사가 헛돌고 있습니다`);
      continue;
    }
    for (const [name, mod] of Object.entries(ASSETS)) {
      renderAll(exp, name, mod, SAMPLE_STATES[name] ?? [{}], rules);
    }
    if (PENDING.length) PENDING_BY_EXP.push([exp, PENDING]);
  }
}

/* ------------------------------------------------------------------ */

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const scope = only ? `"${only}"` : `실험 ${EXPERIMENTS.length}종(${EXPERIMENTS.join(' · ')})`;
console.log(`\n아트 디렉션 검사 — ${scope} · 애셋 ${assetCount}종, ${checked}개 상태\n`);

if (problems.length) {
  for (const p of problems) console.log(`  ${red('✗')} ${p}`);
  console.log(`\n${red(`${problems.length}건 위반`)}\n`);
  process.exit(1);
}

console.log(`  ${green('✓')} 위반 없음`);
for (const [exp, pending] of PENDING_BY_EXP) {
  console.log(dim(`\n  ${exp} — 그림을 다시 그려야 하는 애셋 ${pending.length}종: ${pending.join(', ')}`));
  console.log(dim('  계약과 상호작용은 이미 붙어 있고 형태만 자리표시입니다.'));
  console.log(dim(`  tasks/ 의 해당 프롬프트 카드 참조. experiments/${exp}/src/assets/ 의 완성된 것을 본보기로 만드세요.`));
}
console.log('');
