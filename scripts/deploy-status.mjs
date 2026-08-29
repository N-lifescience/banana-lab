#!/usr/bin/env node
/**
 * **밀었는데 왜 안 올라왔는가.**
 *
 * ── 왜 있는가 ──────────────────────────────────────────────────────
 * 배포본 파일만 보면 **「안 올라왔다」까지만** 알 수 있다. 그다음이 문제다 —
 * 「빌드가 도는 중인가 · 실패했는가 · 아예 시작도 안 했는가」가 안 갈린다.
 * 그 셋은 **할 일이 서로 다르다.** 도는 중이면 기다리고, 실패면 까닭을 보고,
 * 시작도 안 했으면 push 자체를 의심한다.
 * (웨이브 3 의 fermentation 세션이 「15분째 안 올라온다, 원인은 모른다」에서 멈춘 뒤
 *  도구로 만들었다. 여기 것은 그 판에 **시각**을 더한 것이다 — 아래 이유로)
 *
 * ── 「실패하면 다시 밀어라」도 「기다려라」도 함부로 말하지 않는다 ─────
 * 두 저장소에서 정반대 자료가 나왔다:
 *
 *     정본      셋 연달아 실패 → **그다음 커밋이 통과**
 *     catalase  01:52Z 부터 다섯 번 시도 → **전부 실패** (마지막은 3시간을 띄운 것)
 *
 * 그래서 **「밀어라 / 밀지 마라」가 아니라 「상태를 물어보라」**가 답이다.
 * 각자 자기 저장소에서 자국을 보고 정한다. 시각을 함께 찍는 것은 그 때문이다 —
 * **「몇 번 실패했나」보다 「얼마를 띄우고도 실패했나」가 판단을 가른다.**
 * (catalase 가 `created_at` 까지 훑어 「띄워도 안 된다」를 자료로 보였다)
 *
 * ★ **에러 문구 `retry in 24 hours` 를 그대로 믿지 않는다.** 정본이 반례다.
 *   문구가 아니라 자국을 본다 — 오늘 밤 내내 서로에게 한 말 그대로다.
 *
 * ── 쓰는 법 ────────────────────────────────────────────────────────
 *   node scripts/deploy-status.mjs        최근 여덟 커밋
 *   node scripts/deploy-status.mjs 20     최근 스무 개
 *
 * 끝값 — 0 맨 위가 배포됨 · 1 맨 위가 실패 · 2 도는 중이거나 **알 수 없음**
 * (**알 수 없음을 실패와 같은 값으로 내지 않는다** — `gh` 가 없거나 인증이 없을 때다)
 */

import { execFileSync } from 'node:child_process';

const N = Number(process.argv[2] ?? 8);
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

let repo;
try {
  // 원격 주소에서 `소유자/저장소` 를 뽑는다. https 든 ssh 든 같게 나온다 — 복제해도 그냥 돈다.
  repo = sh('git', ['remote', 'get-url', 'origin'])
    .replace(/\.git$/, '').replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1');
} catch {
  console.error('git 원격(origin)을 못 읽었습니다.');
  process.exit(2);
}

const lines = sh('git', ['log', `-${N}`, '--format=%H\t%h\t%s']).split('\n');

const ask = (sha) => {
  try {
    return JSON.parse(sh('gh', ['api', `repos/${repo}/commits/${sha}/status`, '--jq',
      '{state: .state, why: (.statuses[0].description // ""), at: (.statuses[0].created_at // "")}']));
  } catch (e) {
    return { state: '?', why: String(e.message ?? e).split('\n')[0].slice(0, 56), at: '' };
  }
};

const paint = (s) => ({ success: '\x1b[32m', failure: '\x1b[31m', pending: '\x1b[33m' }[s] ?? '\x1b[90m');

console.log(`\n배포 상태 — ${repo}\n`);
let top = null;
let unknown = 0;
for (const line of lines) {
  const [sha, short, subject] = line.split('\t');
  const r = ask(sha);
  top ??= r.state;
  if (r.state === '?') unknown += 1;
  const at = r.at ? r.at.replace('T', ' ').replace('Z', 'Z').slice(5, 19) : '           ';
  console.log(`  ${paint(r.state)}${r.state.padEnd(8)}\x1b[0m ${at}  ${short}  `
    + `${subject.slice(0, 34).padEnd(34)}  ${r.why}`);
}

/*
 * **맨 위가 무엇인지로 판정한다.** 아래쪽 실패는 이미 지나간 일이라 지금 할 일을
 * 바꾸지 않는다 — 실패 뒤의 push 가 통과한 자국이 실제로 있다.
 *
 * ★ 그리고 **여기서 「그러니 다시 미세요」라고 말하지 않는다.** 저장소마다 갈렸다.
 *   위 자국을 보고 사람이 정한다 — 도구는 **자국을 보여 주는 데까지**다.
 */
if (unknown === lines.length) {
  console.log('\n\x1b[90m상태를 하나도 못 읽었습니다\x1b[0m — `gh auth status` 를 보세요.'
    + ' **「실패」가 아니라 「못 읽음」입니다**\n');
  process.exit(2);
}
console.log(top === 'success' ? '\n\x1b[32m맨 위 커밋이 배포됐습니다\x1b[0m\n'
  : top === 'failure' ? '\n\x1b[31m맨 위 커밋이 실패했습니다\x1b[0m — 까닭은 위 줄에 있습니다.'
    + '\n  다시 밀지 말지는 **위 자국을 보고** 정하세요. 저장소마다 갈렸습니다 —'
    + '\n  정본은 셋 실패 뒤 통과했고, 어떤 곳은 세 시간을 띄우고도 실패했습니다.\n'
    : '\n\x1b[33m아직 도는 중입니다\x1b[0m — 잠시 뒤 다시 보세요\n');

process.exit(top === 'success' ? 0 : top === 'failure' ? 1 : 2);
