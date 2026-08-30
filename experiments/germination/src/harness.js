/**
 * 개발 확인용 하네스.
 *
 * 실제 시뮬레이터 화면이 아니다. **애셋이 살아 있는지 눈으로 보는 페이지**다.
 *
 * ── 왜 애셋 시트가 필요한가 ────────────────────────────────────────
 * 린터(`npm run check:art`)는 **색과 두께만** 본다. 시점이 섞였는지, 실루엣을 알아볼 수
 * 있는지, **상태가 눈에 보이는지**는 기계가 못 잡는다. 실제로 린터를 통과한 외주 애셋이
 * 한 그림 안에 시점이 둘이었고, 상태 노드가 다른 도형에 가려 화면에 나타나지 않았다.
 * 그래서 전 종을 한 줄로 늘어놓고 옆 칸과 견준다.
 *
 * 상태는 `SAMPLE_STATES` 를 쓴다 — 린터가 검사하는 상태와 같아야 하기 때문이다.
 * 여러 상태를 가진 애셋은 **상태마다 한 칸씩** 낸다. 한 상태만 보면 「상태가 눈에
 * 보이는가」를 볼 수가 없다 — 밀봉한 챔버와 안 한 챔버가 같아 보여도 모른다.
 *
 * 결과 렌더러(챔버 그림 · 시간 그래프)를 만드는 T03 에서 여기에 결과 실험대를 더한다.
 */

import { ASSETS, SAMPLE_STATES, PENDING } from './assets/index.js';
import { UI } from './ui/strings.js';

const $ = (sel) => document.querySelector(sel);

/** 시드는 한 번만 정한다. 칸마다 다르면 같은 그림을 견줄 수가 없다. */
const SEED = 31337;

/** 상태 한 벌을 사람이 읽는 한 줄로. 무엇이 달라 이 칸이 따로 있는지 보여 준다. */
function stateLabel(state) {
  const parts = Object.entries(state)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
    .map(([k, v]) => (v === true ? k : `${k}=${typeof v === 'object' ? '…' : v}`));
  return parts.length ? parts.join(' · ') : '기본';
}

/**
 * 애셋 시트. 애셋 × 상태를 격자로 늘어놓는다.
 * 한글 이름과 함께 파일 키도 보여 준다 — 그림을 고칠 사람이 찾아야 할 것은 키다.
 */
function paintSheet() {
  const cells = [];
  for (const [name, mod] of Object.entries(ASSETS)) {
    const states = SAMPLE_STATES[name]?.length ? SAMPLE_STATES[name] : [{}];
    for (const state of states) {
      const label = `${UI.assetNames[name] ?? name} <code>${name}.js</code>`;
      const pending = PENDING.includes(name) ? ' <b>자리표시</b>' : '';
      cells.push(
        `<div class="cell">${mod.render({ ...state, seed: SEED })}`
        + `<span class="name">${label}${pending}</span>`
        + `<span class="state">${stateLabel(state)}</span></div>`
      );
    }
  }
  $('#asset-sheet').innerHTML = cells.join('');
  $('#sheet-count').textContent =
    `애셋 ${Object.keys(ASSETS).length}종 · 상태 ${cells.length}개`;
}

$('#harness-title').textContent = `${UI.appTitle} — ${UI.harnessTitle}`;
$('#harness-note').textContent = UI.harnessNote;
document.title = `${UI.appTitle} — ${UI.harnessTitle}`;
paintSheet();
