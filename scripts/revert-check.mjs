#!/usr/bin/env node
/**
 * 되돌림 — **검사가 그 버그를 정말 무는지** 잰다.
 *
 * ── 왜 도구로 만드는가 ─────────────────────────────────────────────
 * 밤새 손으로 열댓 번 했고, 그러다 두 가지를 틀렸다.
 *
 *   · 주입한 채로 스크립트가 멈춰서 **파일이 고쳐진 상태로 남았다.**
 *     `git status` 를 안 봤으면 그대로 커밋됐다.
 *   · 되돌렸는데 초록불이 나서 「검사가 못 잡는다」로 읽었는데,
 *     실은 **주입 문자열이 한 글자 달라 안 먹은 것**이었다.
 *     `ℹ pass 8` 만 보면 그 둘이 구분되지 않는다.
 *
 * ── 네 걸음을 늘 같은 차례로 ────────────────────────────────────────
 *   ① 주입 전 검사   초록불이어야 한다 — 아니면 **잴 바탕이 없다**
 *   ② 주입이 먹었나  바꾼 자리 개수. **0곳이면 여기서 멈춘다**
 *   ③ 주입 뒤 검사   빨간불이어야 한다. 초록불이면 그 검사는 **이 버그를 못 잡는다**
 *   ④ 복구했나       사본과 바이트 비교 — **검사가 어떻게 끝나든 반드시 돈다**
 *
 * ④ 가 `finally` 인 것이 핵심이다. 오늘 개발 서버가 죽어 검사가 중간에 멎었을 때
 * 파일이 주입된 채 남았던 자리다.
 * (웨이브 1 의 micrometer 세션이 도구로 만들어 넘겨 주었다)
 *
 * ── 쓰는 법 ────────────────────────────────────────────────────────
 *   node scripts/revert-check.mjs <파일> <찾을 것> <바꿀 것> -- <돌릴 명령…>
 *
 *   node scripts/revert-check.mjs src/ui/toast.js \
 *     "if (showingShown === shown) return;" "" -- npm run check
 *
 * ── ★ 이 도구가 **못 하는 것** ──────────────────────────────────────
 * **한 파일에 한 자리만** 주입한다. 그런데 증상이 서려면 **조각이 여럿** 필요한 자리가 있다 —
 * 넘겨 주는 쪽과 읽는 쪽이 따로면, 한쪽만 돌려서는 아무 일도 안 일어난다.
 *
 * centrifuge 가 그렇게 걸렸다. `zoom.js` 만 옛것으로 돌리고 「주입이 먹었다(2곳)」까지
 * 확인했는데 **51 → 51 통과**였다. `quality.js` 의 읽는 쪽까지 함께 돌리니 **55 → 78**
 * 로 빨간불이 났다.
 *
 *     **「주입이 먹었나」를 세기 전에 「증상이 서려면 조각이 몇 개 필요한가」부터 센다.**
 *     한 조각만 넣고 확인하면 **안 도는 검사와 잘 도는 검사가 똑같이 초록불**이다.
 *
 * 조각이 여럿이면 이 도구를 쓰지 말고 **손으로 둘 다 바꾸고 `git checkout` 으로 되돌린다.**
 * 그때는 **커밋한 뒤에** 하라 — 안 그러면 되돌리면서 아직 커밋 안 한 작업까지 지운다
 * (chromatography 가 그렇게 커밋 셋을 비웠다).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const cut = argv.indexOf('--');
if (cut < 3) {
  console.error('쓰는 법: node scripts/revert-check.mjs <파일> <찾을 것> <바꿀 것> -- <돌릴 명령…>');
  process.exit(2);
}
const [file, find, replace] = argv.slice(0, 3);
const cmd = argv.slice(cut + 1);
if (cmd.length === 0) {
  console.error('`--` 뒤에 돌릴 명령이 없습니다.');
  process.exit(2);
}

/**
 * 명령을 돌리고 초록불이었는지만 돌려준다. 화면에는 안 쏟는다 — 네 줄만 남긴다.
 *
 * ★ **「돌려서 빨간불」과 「돌리지도 못함」을 가른다.**
 *
 * `spawnSync` 는 못 띄운 명령(이름 오타·실행 권한 없음)의 `status` 를 **`null`** 로 준다.
 * 그것을 `!== 0` 으로 뭉뚱그리면 **「이 저장소는 원래 빨갛다」**가 되고,
 * 사람은 **있지도 않은 실패를 찾으러** 간다. 되돌림 도구가 그러면 그 도구로 잰 판단이
 * 전부 흔들린다. (웨이브 3 의 fermentation 세션이 자기 도구에서 잡았다)
 */
function run() {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', shell: false });
  const ran = r.status !== null && !r.error;
  return { ran, ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`,
           why: r.error?.message ?? '끝값이 없습니다' };
}

/** 실패한 검사 이름을 몇 개만 뽑아 보여 준다 — 무엇이 물었는지가 이 도구의 답이다. */
function bites(out) {
  const lines = out.split('\n')
    /*
     * 검사마다 실패 표시가 다르다 — `npm run check` 는 `✖`, 실험대 검사는 `실패`,
     * 화면·아트·첨삭 검사는 `✗`. 하나만 알면 **「이름을 못 읽음」**이 되고, 그러면
     * **무엇이 물었는지**를 못 본다 — 이 도구가 답해야 할 바로 그것이다.
     *
     * ★ **표시 목록은 앱이 아니라 검사에서 센다.** 앱을 물게 하는 주입을 찾느라
     *   헤매지 말고, **표시만 내는 가짜 명령**을 이 도구에 물려 보면 한 번에 안다:
     *
     *     grep -ho "'[✓✗✖⚠]'" scripts/*.mjs | sort -u    ← 이 저장소가 쓰는 표시
     *     node scripts/revert-check.mjs <아무 파일> <바뀌지 않는 글자> <같은 글자> \
     *       -- node <표시를 다 내고 exit 1 하는 파일>
     *
     * (웨이브 1 의 micrometer 세션이 이 방법을 냈다 — 주입을 두 번 헛짚고 나서)
     */
    .filter((l) => /^\s*(✖|✗|⚠|실패)/.test(l))
    .map((l) => l.trim()
      .replace(/^(✖|✗|⚠|실패)\s*/, '')
      .replace(/\s*\([\d.]+m?s\)\s*$/, '')   // 걸린 시간은 이름이 아니다
      .replace(/\s+—.*$/, ''))
    // `✖ failing tests:` 는 묶음 머리글이지 검사 이름이 아니다
    .filter((l) => l && !/^failing tests/.test(l) && !/^tests\b/.test(l));
  return [...new Set(lines)].slice(0, 5);
}

const before = readFileSync(file);          // 사본. 되돌릴 때 이것을 쓴다 — git checkout 은 안 쓴다
const text = before.toString('utf8');
const hits = text.split(find).length - 1;

let code = 0;
try {
  // ① 주입 전 — 잴 바탕이 있는가
  const clean = run();
  if (!clean.ran) {
    console.log(`① 주입 전 검사   ★ **돌리지도 못했습니다** — ${clean.why}`);
    console.log('   검사가 빨간 것이 아닙니다. 「--」 뒤의 명령을 다시 보세요.');
    code = 2;
    throw new Error('stop');
  }
  console.log(`① 주입 전 검사   ${clean.ok ? '초록불' : '★ 빨간불 — 잴 바탕이 없습니다'}`);
  if (!clean.ok) {
    console.log(`   먼저 무는 것: ${bites(clean.out).join(' / ') || '(이름을 못 읽음)'}`);
    code = 2;
    throw new Error('stop');
  }

  // ② 주입이 먹었나 — 이것을 안 찍으면 「안 먹은 되돌림」과 「못 잡는 검사」가 구분되지 않는다
  console.log(`② 주입이 먹었나  ${hits}곳`);
  if (hits === 0) {
    console.log('   ★ 한 자리도 못 찾았습니다 — 찾을 문자열을 다시 보세요.');
    code = 2;
    throw new Error('stop');
  }
  writeFileSync(file, text.split(find).join(replace));

  // ③ 주입 뒤 — 검사가 무는가
  const hurt = run();
  if (!hurt.ran) {
    console.log(`③ 주입 뒤 검사   ★ **돌리지도 못했습니다** — ${hurt.why}`);
    code = 2;
  } else if (hurt.ok) {
    console.log('③ 주입 뒤 검사   ★ 초록불 — **이 검사는 그 버그를 못 잡습니다**');
    code = 1;
  } else {
    console.log(`③ 주입 뒤 검사   빨간불 — 문 것: ${bites(hurt.out).join(' / ') || '(이름을 못 읽음)'}`);
  }
} catch (e) {
  if (e.message !== 'stop') { console.error(e); code = 2; }
} finally {
  // ④ 복구 — 검사가 어떻게 끝나든 반드시 돈다
  writeFileSync(file, before);
  const same = readFileSync(file).equals(before);
  console.log(`④ 복구했나       ${same ? '바이트까지 같음' : '★ 다릅니다 — 손으로 확인하세요'}`);
  if (!same) code = 2;
}
process.exit(code);
