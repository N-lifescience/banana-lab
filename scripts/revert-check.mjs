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

/** 명령을 돌리고 초록불이었는지만 돌려준다. 화면에는 안 쏟는다 — 네 줄만 남긴다. */
function run() {
  const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', shell: false });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** 실패한 검사 이름을 몇 개만 뽑아 보여 준다 — 무엇이 물었는지가 이 도구의 답이다. */
function bites(out) {
  const lines = out.split('\n')
    .filter((l) => /^\s*(✖|실패)/.test(l))
    .map((l) => l.trim()
      .replace(/^(✖|실패)\s*/, '')
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
  if (hurt.ok) {
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
