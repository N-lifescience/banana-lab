/**
 * **문서가 이름을 부를 때, 그 이름이 실제로 있는가.**
 *
 * 밤새 걷어낸 기능이 규칙표에는 **현재형으로** 살아 있었다 —
 * 「`WASH_HANDS` · `CLOSE_CAP` · `DISPOSE_WASTE` · `CHECK_TIDY` 를 그대로 쓴다」.
 * 넷 다 없다. 상태 모델에는 `violations` · `tidy` 가 칸 목록에 남아 있었다.
 * **「그대로 쓴다」와 「없앴다」는 반대말이라, 다음 사람이 그것을 보고 되살린다.**
 *
 * ── 왜 «식별자» 만 재는가 ──────────────────────────────────────
 * 문구를 맞대는 검사는 이 저장소에서 **반드시 헛돈다.** 실패 사례를 주석에 길게
 * 적어 두기 때문에, 낡은 인용이 **주석에 남아 있는 옛 문구와 맞아** 통과한다.
 * 식별자는 다르다 — 코드에서 지우면 같이 사라진다.
 *
 * 그리고 **문서가 걷어낸 것을 «걷어냈다고» 말하는 것은 막지 않는다.** 그건 필요한 말이다.
 * 그래서 훑는 자리를 **약속하는 자리**로 좁힌다 — 칸 목록과 되돌아갈 길 표.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../src/sim/state.js';
import { ACTIONS } from '../src/sim/rules.js';

const doc = (n) => readFileSync(new URL(`../docs/${n}`, import.meta.url), 'utf8');

test('03 의 session 칸 목록이 실제 칸과 같다', () => {
  const src = doc('03-state-model.md');
  // `### `session`` 다음 문단 — 인용(>)은 뺀다. 거기는 「없는 것」을 설명하는 자리다.
  const after = src.split('### `session`')[1] ?? '';
  const para = after.split('\n\n').find((p) => p.trim().startsWith('`')) ?? '';
  const listed = [...para.matchAll(/`([a-zA-Z]+)`/g)].map((m) => m[1]).sort();
  const real = Object.keys(initialState(1).session).sort();
  assert.deepEqual(listed, real,
    `문서의 칸 목록이 실제와 다릅니다.\n  문서 ${listed.join(' ')}\n  실제 ${real.join(' ')}`);
});

test('04 의 「되돌아갈 길」 표가 부르는 조작이 전부 있다', () => {
  const src = doc('04-interaction-rules.md');
  const table = (src.split('## 되돌아갈 길')[1] ?? '').split('\n---')[0];
  const named = [...new Set([...table.matchAll(/`([A-Z_]{4,})`/g)].map((m) => m[1]))];
  assert.ok(named.length >= 4, `표에서 조작 이름을 못 찾았습니다 (${named.length}개) — 검사가 헛돕니다`);
  const missing = named.filter((n) => !(n in ACTIONS));
  assert.deepEqual(missing, [],
    `되돌아갈 길 표가 없는 조작을 가리킵니다: ${missing.join(' · ')}\n`
    + '  이 표는 학생에게 「이럴 땐 이걸로 무르세요」라고 약속하는 자리입니다.');
});

/**
 * **아직 갈아 끼우지 않은 설계 문서는 그렇다고 적혀 있어야 한다.**
 *
 * 아홉 중 여섯이 아직 바나나랩(현미경) 것이다. `docs/00-overview.md` 는
 * 「바나나에 들어 있는 녹말과 지방을 현미경으로 관찰」로 시작한다 —
 * **프로젝트 개요가 다른 실험을 설명하고 있었다.**
 *
 * 고쳐 쓰는 것은 사람이 정할 일이라 손대지 않았다. 대신 **못 박은 것이 안 풀렸는지** 잰다.
 */
test('안 갈아 끼운 설계 문서에는 그렇다고 적혀 있다', () => {
  const NOT_YET = ['00-overview.md', '01-art-direction.md', '02-asset-contract.md',
    '06-lab-notebook.md', '07-board-and-deploy.md', '08-roadmap.md'];
  for (const n of NOT_YET) {
    assert.ok(doc(n).includes('아직 바나나랩'),
      `${n} 에 「아직 바나나랩 것이다」가 없습니다 — 이 실험 문서로 읽힙니다.`);
  }
  // 갈아 끼운 것에 그 딱지가 붙어 있으면 그것도 거짓말이다.
  for (const n of ['03-state-model.md', '04-interaction-rules.md', '05-result-renderer.md']) {
    assert.ok(!doc(n).includes('아직 바나나랩'),
      `${n} 은 갈아 끼웠는데 「아직 바나나랩」 딱지가 붙어 있습니다.`);
  }
});

/**
 * **문서에 적힌 숫자가 모형이 지금 내는 값과 같은가.**
 *
 * 낡은 «문구» 는 안 보이면 못 찾고 끝이다. 낡은 «숫자» 는 다르다 —
 * **틀린 신고를 만들어 낸다.** 선생님이 **맞는 값을 보고도** 「고장이다」로 적어 보내신다.
 * 그 신고를 받은 다음 사람은 「재현 안 됨」을 찾느라 또 시간을 쓴다.
 *
 * pH 표가 그 자리다. 나중에 누가 계수를 손대면 **문서만 옛 값으로** 남는다.
 * (옆 랩이 짚어 준 것을 받아 넣었다.)
 *
 * **표를 못 읽었으면 초록불이 아니라 빨간불이다** — 「0줄 중 0줄이 맞다」를 막는 앞 조건.
 */

import { PH_METHODS } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';

/** 문서 표와 같은 조건으로 한 번 재 본다 — 37 ℃ · 3 % · 감자즙 원액. */
function riseSeconds(ph, method) {
  let st = initialState(1);
  const d = (type, payload) => { st = reduce(st, { type, payload }).state; };
  d('PUNCH_DISC', {}); d('MAKE_EXTRACT', { pct: 100 }); d('SOAK_DISC', {});
  d('POUR_H2O2', { pct: 3 });
  d('SET_PH', { ph, method });
  d('PUT_IN_BATH', { tempC: 37 });
  d('DROP_DISC', {});
  for (let i = 0; i < 400; i++) { d('TICK', { seconds: 1 }); if (st.bench.beaker.floated) break; }
  return st.bench.beaker.floated ? st.bench.beaker.floatedAtS : null;
}

test('PLAYTEST 의 pH 표가 모형이 지금 내는 값과 같다', () => {
  const src = readFileSync(new URL('../PLAYTEST.md', import.meta.url), 'utf8');
  const HEAD = [3, 5, 7, 9, 11];
  const ROWS = [
    { mark: '완충 용액', method: PH_METHODS.BUFFER },
    { mark: '0.1 M 산·염기', method: PH_METHODS.ACID_BASE },
  ];
  const wrong = [];
  const fresh = [];
  let read = 0;
  for (const { mark, method } of ROWS) {
    const line = src.split('\n').find((l) => l.startsWith(`| ${mark}`));
    assert.ok(line, `pH 표에서 「${mark}」 줄을 못 찾았습니다 — 표 모양이 바뀌었습니다`);
    const cells = line.split('|').slice(2, 7);
    assert.equal(cells.length, 5, `「${mark}」 줄의 칸이 다섯이 아닙니다: ${line}`);
    const out = [];
    cells.forEach((cell, i) => {
      const bare = cell.replace(/\*/g, '').trim();
      /**
       * **「—」 는 화면에서 못 만드는 자리다.** 산·염기 병은 둘뿐이라(pH 3 · 11)
       * pH 5·7·9 에 닿는 길이 없다. 잴 것이 없으니 건너뛴다 —
       * 건너뛴다는 것이 여기 적혀 있어야 다음 사람이 「왜 셋만 재나」로 안 본다.
       */
      if (bare === '—' || bare === '') { out.push('—'); return; }
      /**
       * ★ **「—」 가 아닌 칸은 «반드시» 숫자로 읽혀야 한다.**
       * 안 읽히는 것을 조용히 건너뛰면, 한 칸이 `8.2 s` 로 바뀌어도 남은 칸만 맞대 보고
       * **초록불**이 난다. 「몇 줄을 읽었나」만 세는 앞 조건으로는 그 한 칸을 못 본다.
       */
      // 칸 뒤에 표시가 붙을 수 있다(「4.5초 ← 역전」). 값은 **맨 앞**이어야 한다 —
      // 그래야 「8.2 s」 처럼 단위가 바뀐 것이 걸린다.
      const m = bare.match(/^([\d.]+)\s*초(\s|$)/);
      assert.ok(m, `${mark} pH ${HEAD[i]} 칸을 숫자로 못 읽었습니다: "${bare}"`);
      const real = riseSeconds(HEAD[i], method);
      assert.ok(real !== null,
        `${mark} pH ${HEAD[i]} — 문서엔 ${m[1]}초인데 모형에서는 안 뜹니다`);
      read += 1;
      out.push(`${real.toFixed(1)}초`);
      if (Math.abs(real - Number(m[1])) >= 0.15) {
        wrong.push(`${mark} pH ${HEAD[i]} — 문서 ${m[1]}초 / 지금 ${real.toFixed(1)}초`);
      }
    });
    fresh.push(`| ${mark} … | ${out.join(' | ')} |`);
  }
  // ★ 앞 조건 — 하나도 못 맞대 봤으면 그것은 통과가 아니다.
  assert.ok(read >= 6, `맞대 본 칸이 ${read}개뿐입니다 — 표를 제대로 못 읽었습니다.`);
  /**
   * **울 때는 무엇을 고칠지까지 준다.** 안 그러면 첫 빨간불에서 이 검사가 죽는다.
   * 다만 **「왜 바뀌었는지 먼저 보라」를 앞에 둔다** — 안 두면 진짜 회귀를 문서에
   * 받아 적어 **버그를 정상으로** 만든다. (옆 랩이 짚어 준 것을 받아 넣었다.)
   */
  assert.deepEqual(wrong, [],
    `문서의 pH 표가 낡았습니다:\n  ${wrong.join('\n  ')}\n\n`
    + '  ★ 붙여 넣기 전에 **왜 바뀌었는지 먼저** 보세요.\n'
    + '    계수를 일부러 고쳤으면(예: T_REF_S 를 교실 값으로) 아래를 붙여 넣으시고,\n'
    + '    일부러 고친 적이 없으면 **그것이 회귀입니다** — 문서가 아니라 모형을 보세요.\n\n'
    + `  지금 값:\n  ${fresh.join('\n  ')}`);
});
