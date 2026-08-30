/**
 * 난이도 세 단계 — **설명만 줄이고 조작은 줄이지 않는다.**
 *
 * 이 검사가 없어서 바나나랩에서 실제로 겪은 일: 전체 118개가 통과하는 동안
 * **2·3단계에 닿을 방법이 아예 없었다.** 구현돼 있어도 아무도 못 쓰는 것은 없는 것이다.
 *
 * 그래서 여기서 보는 것은 둘이다.
 *   1. **세 단계가 실제로 다른가** — 다르지 않으면 고른 뜻이 없다
 *   2. **어려운 단계가 길을 막지는 않는가** — 막으면 설명을 줄인 게 아니라 강제를 넣은 것이다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, UNDO_LIMITS } from '../src/sim/state.js';
import { reduce, ACTIONS, BLOCKING_REASONS } from '../src/sim/rules.js';
import { dropTable, tapTable, BENCH_KINDS } from '../src/ui/bench.js';
import { UI } from '../src/ui/strings.js';
import { manifest } from '../src/manifest.js';

const LEVELS = [1, 2, 3];

/** 주석을 걷어낸 소스. 설명문을 코드나 화면 문구로 오해하지 않게 한다. */
const codeOf = (url) => readFileSync(url, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ---------------- 닿을 수 있는가 ---------------- */

test('주소로 세 단계에 모두 들어갈 수 있다', () => {
  // 화면 선택기만 두면 교사가 반마다 다른 링크를 나눠 줄 수 없고,
  // 주소만 두면 학생이 처음에 고를 수가 없다. 둘 다 있어야 한다.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /get\('level'\)/, '주소로 난이도를 정하는 길이 없습니다');
  assert.match(main, /createStart/, '시작 화면에서 고르는 길이 없습니다');
  assert.deepEqual(UI.start.levels.map((l) => l.id), LEVELS);
  assert.deepEqual(manifest.levels, LEVELS, '매니페스트가 말하는 단계와 화면이 다릅니다');
});

test('시작 화면의 단계 설명이 서로 다르고, 무엇이 달라지는지 말한다', () => {
  const descs = UI.start.levels.map((l) => l.desc);
  assert.equal(new Set(descs).size, 3, '세 단계 설명이 겹칩니다');
  for (const d of descs) {
    assert.ok(d.includes('되돌리기'), `무엇이 달라지는지 말해 주지 않습니다: ${d}`);
  }
  // 「어렵다/쉽다」가 아니라 **화면이 얼마나 거들어 주는가**를 적는다.
  assert.ok(!descs.some((d) => /어렵습니다|쉽습니다/.test(d)));
});

/* ---------------- 실제로 다른가 ---------------- */

test('되돌리기 횟수가 세 단계에서 다르다', () => {
  assert.deepEqual(LEVELS.map((l) => UNDO_LIMITS[l]), [Infinity, 3, 1]);
  const seen = new Set(LEVELS.map((l) => String(initialState(l).session.undosLeft)));
  assert.equal(seen.size, 3, '세 단계가 실제로 달라야 합니다');
});

/**
 * `PLAYTEST §6` 의 난이도 표는 **되돌리기 횟수를 세 번째로** 적어 둔 자리다.
 * 코드(`UNDO_LIMITS`)와 바로 위 검사의 리터럴이 둘, 이 표가 셋이다.
 *
 * 코드를 고치면 위 검사가 울고, 그 사람은 **검사 리터럴만 고치고 지나간다.**
 * 그러면 문서만 옛 값으로 남고, 사장님은 그 표대로 눌러 보고
 * 「2단계 되돌리기가 3회가 아니다」를 **버그로 적어 보내신다.** 그래서 표도 맞댄다.
 */
test('PLAYTEST §6 이 말하는 되돌리기 횟수가 코드와 같다', () => {
  const doc = readFileSync(new URL('../PLAYTEST.md', import.meta.url), 'utf8');
  const row = doc.match(/^\|\s*되돌리기\s*\|([^\n]*)$/m);
  assert.ok(row, 'PLAYTEST 에서 「| 되돌리기 |」 줄을 못 찾았습니다 — 표를 지웠으면 이 검사도 지우세요');
  const cells = row[1].split('|').map((c) => c.trim()).filter(Boolean);
  assert.equal(cells.length, LEVELS.length,
    `되돌리기 줄에서 ${LEVELS.length}칸을 읽어야 하는데 ${cells.length}칸을 읽었습니다 — 표 모양이 바뀌었으면 이 검사도 함께 고치세요`);

  const said = cells.map((c) => (c.includes('무제한') ? Infinity : Number(c.replace(/[^\d]/g, ''))));
  const real = LEVELS.map((l) => UNDO_LIMITS[l]);
  assert.deepEqual(said, real, [
    'PLAYTEST §6 의 되돌리기 횟수가 코드와 다릅니다.',
    `  코드: ${real.join(' · ')} / 문서: ${said.join(' · ')}`,
    '  ★ 먼저 **왜 바뀌었는지** 보세요 — 일부러 고친 것이 아니라면 코드를 되돌려야 합니다.',
    `  문서를 고칠 것이 맞다면 그 줄을 이렇게 바꾸세요:`,
    `    | 되돌리기 | ${real.map((n) => (n === Infinity ? '무제한' : `${n}회`)).join(' | ')} |`,
  ].join('\n'));
});

test('말풍선 안내가 단계마다 짧아지고 3단계는 이름만 남는다', () => {
  for (const kind of BENCH_KINDS) {
    const h = UI.bench.hints[kind];
    const len = LEVELS.map((l) => h[l].join('').length);
    assert.ok(len[0] >= len[1], `${kind} — 2단계가 1단계보다 깁니다`);
    assert.equal(len[2], 0, `${kind} — 3단계에 안내가 남아 있습니다`);
  }
});

test('예상 묻는 방식이 단계마다 다르다', () => {
  // 1단계 선택형 · 2단계 보기+까닭 · 3단계 완전 주관식.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  assert.match(src, /level >= 3 \? '' :/, '3단계에서 보기를 없애지 않습니다');
  assert.match(src, /level === 1 \? '' :/, '1단계에서 서술 칸을 없애지 않습니다');
});

test('토스트가 1단계에서만 다음 행동까지 알려 준다', () => {
  const src = readFileSync(new URL('../src/ui/toast.js', import.meta.url), 'utf8');
  assert.match(src, /level <= 1[\s\S]*?nextAction/, '1단계에서 다음 행동을 안 붙입니다');
  assert.match(src, /level >= 3[\s\S]*?hidden/, '3단계에서 원인을 안 줄입니다');
  assert.ok(Object.keys(UI.toast.nextAction).length >= 6, '다음 행동 표가 너무 얇습니다');
});

/**
 * **죽은 항목이 없는가.** 규칙이 내지도 않는 tag 에 다음 행동을 적어 두면
 * 그 문장은 영영 안 뜬다 — 적어 두었으니 있는 줄 알게 되는 것이 더 나쁘다.
 */
test('다음 행동 표의 tag 가 규칙이 실제로 내는 것이다', () => {
  const rules = codeOf(new URL('../src/sim/rules.js', import.meta.url));
  const emitted = new Set([...rules.matchAll(/'([a-z][a-z-]+)'\s*\)/g)].map((m) => m[1]));
  for (const tag of Object.keys(UI.toast.nextAction)) {
    assert.ok(rules.includes(`'${tag}'`),
      `다음 행동 표의 '${tag}' 를 규칙이 내지 않습니다 — 그 문장은 영영 안 뜹니다`);
  }
  void emitted;
});

/*
 * ── 넣지 않기로 한 검사 ────────────────────────────────────────────
 * 「다음 행동이 원인 문구를 되풀이하지 않는가」를 낱말 겹침으로 재 보려 했다.
 * **거짓 양성이 잡을 것보다 많았다** — 「챔버를」·「손잡이를」·「올리세요」는 원인 문구에도
 * 당연히 나오는 말이라, 멀쩡한 문장이 겹쳤다고 걸렸다.
 *
 * 검사 하나가 헛발질하면 그 파일 전체가 신뢰를 잃는다 (`PLAYBOOK.md` §9.3).
 * 겹침은 **사람이 토스트를 눈으로 보고** 잡는다 — 실제로 그렇게 한 번 잡았고,
 * 그 판단은 `UI.toast.nextAction` 머리말에 적어 두었다.
 */

/* ---------------- 길을 막지는 않는가 ---------------- */

test('조작표가 난이도를 인자로 받지 않는다', () => {
  // 받는 순간 「3단계에서는 이걸 못 한다」를 쓸 수 있게 된다.
  const fake = (level) => ({ getState: () => initialState(level, 1), dispatch: () => {} });
  const shape = (t) => Object.entries(t)
    .map(([k, v]) => `${k}:${Object.keys(v).sort().join(',')}`).sort();
  assert.deepEqual(shape(dropTable(fake(3))), shape(dropTable(fake(1))));
  assert.deepEqual(
    Object.keys(tapTable(fake(3), () => {})).sort(),
    Object.keys(tapTable(fake(1), () => {})).sort()
  );
});

test('어느 단계에서든 막히는 것은 같고, 사유도 같다', () => {
  // 난이도는 **설명만** 줄인다. 막는 것을 늘리면 길을 막은 것이다.
  const payloads = [{}, { chamber: 'L' }, { kind: 'sprout' }, { chamber: 'L', depth: 1 }, { minutes: 3 }];
  const blockedOf = (level) => {
    const st = initialState(level, 55);
    const sealed = reduce(st, { type: 'SEAL', payload: { chamber: 'L' } }).state;
    const out = [];
    for (const type of Object.keys(ACTIONS)) {
      for (const payload of payloads) {
        const r = reduce(sealed, { type, payload });
        if (r.outcome === 'blocked') out.push(`${type}:${r.reason}`);
      }
    }
    return out.sort();
  };
  const one = blockedOf(1);
  assert.ok(one.length > 0, '이 각본은 실제로 한 번은 막혀야 뜻이 있습니다');
  assert.deepEqual(blockedOf(3), one, '3단계에서 막히는 것이 1단계와 다릅니다');
  assert.deepEqual(blockedOf(2), one);
  for (const b of one) {
    assert.ok(Object.values(BLOCKING_REASONS).some((r) => b.endsWith(r)));
  }
});

test('자기 평가는 난이도와 무관하게 같다', () => {
  // 자기를 돌아보는 일에 난이도를 매길 이유가 없다.
  const src = readFileSync(new URL('../src/ui/notebook.js', import.meta.url), 'utf8');
  const stage7 = src.slice(src.indexOf('function renderStage7'), src.indexOf('const STAGE_RENDERERS'));
  assert.ok(!/level/.test(stage7), '7단계가 난이도를 봅니다');
});
