/**
 * 통일 규격 — `docs/09-uniformity.md` 의 기계로 잴 수 있는 부분.
 *
 * 실험 여덟이 저마다 조금씩 달라진 것을 2026-09-03 에 한 번 맞췄다. 이 검사는 **다시
 * 흩어지는 것**을 잡는다. 여기서 재는 것은 글자·선택자·구조뿐이다 — 화면이 실제로 같아
 * 보이는지는 사람이 열어 봐야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXP_DIR = join(ROOT, 'experiments');
const EXPS = readdirSync(EXP_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(EXP_DIR, d.name, 'src/ui/strings.js')))
  .map((d) => d.name).sort();

const read = (exp, rel) => readFileSync(join(EXP_DIR, exp, rel), 'utf8');
const has = (exp, rel) => existsSync(join(EXP_DIR, exp, rel));
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const UIS = {};
for (const exp of EXPS) UIS[exp] = (await import(join(EXP_DIR, exp, 'src/ui/strings.js'))).UI;

test('실험이 여덟이다 (앞 조건)', () => {
  assert.ok(EXPS.length >= 8, EXPS.join(', '));
});

/* ── 1. 껍데기 ─────────────────────────────────────────────────── */

const SHELL = readFileSync(join(ROOT, 'packages/lab-kit/style/shell.css'), 'utf8');
/** 공용 파일에 있는 최상위 선택자. 실험 쪽 <style> 에 같은 것이 또 있으면 그쪽이 이긴다 — 그래서 막는다. */
function topSelectors(css) {
  const out = new Set();
  let depth = 0; let buf = '';
  for (const c of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (c === '{') { if (depth === 0) out.add(buf.trim().replace(/\s+/g, ' ')); buf = ''; depth++; }
    else if (c === '}') { depth--; buf = ''; }
    else if (depth === 0) buf += c;
  }
  out.delete('');
  return out;
}
const SHARED = topSelectors(SHELL);

for (const exp of EXPS) {
  test(`${exp}: index.html 이 공용 껍데기 CSS 를 읽는다`, () => {
    const html = read(exp, 'index.html');
    assert.match(html, /<link rel="stylesheet" href="\/packages\/lab-kit\/style\/shell\.css">/);
  });

  test(`${exp}: 공용 선택자를 자기 <style> 에 다시 적지 않는다`, () => {
    // HTML 주석 속의 낱말에 걸리지 않게 주석부터 걷는다.
    const html = read(exp, 'index.html').replace(/<!--[\s\S]*?-->/g, '');
    const m = html.match(/<style>([\s\S]*?)<\/style>/);
    const local = m ? topSelectors(m[1]) : new Set();
    const dup = [...local].filter((s) => SHARED.has(s) && !s.startsWith('@'));
    assert.deepEqual(dup, [], `공용에 있는 선택자가 ${exp} 에 또 있습니다: ${dup.join(', ')}`);
  });

  test(`${exp}: 지금은 안 쓰는 옛 뼈대가 없다 (zoom-sheet · note-body · read-foot · likert-opt · mat-table)`, () => {
    const files = ['src/ui/notebook.js', 'src/ui/zoom.js', 'src/ui/design.js', 'index.html'].filter((f) => has(exp, f));
    for (const f of files) {
      const src = stripComments(read(exp, f));
      for (const old of ['zoom-sheet', 'note-body', 'read-foot', 'likert-opt', 'mat-table', 'note-tab--on', 'zoom-opt', 'zoom-note--', 'class="cover-hint', '.cover-hint{']) {
        assert.ok(!src.includes(old), `${exp}/${f} 에 옛 뼈대 「${old}」 가 남아 있습니다`);
      }
    }
  });
}

/* ── 2. 실험대 — 누르면 본다 ─────────────────────────────────────── */

for (const exp of EXPS) {
  test(`${exp}: tapTable 안에서 상태를 바꾸지 않는다 (누르면 본다, 끌면 옮긴다, 단추로 한다)`, () => {
    const src = read(exp, 'src/ui/bench.js');
    const m = src.match(/export function tapTable\([\s\S]*?\n\}/);
    assert.ok(m, 'tapTable 이 없습니다');
    const body = stripComments(m[0]);
    assert.ok(!/store\.dispatch\(/.test(body), `${exp} 의 tapTable 이 dispatch 를 부릅니다:\n${body}`);
  });
}

/* ── 3. 확대 뷰 틀과 물건 화면 ──────────────────────────────────── */

for (const exp of EXPS) {
  if (!has(exp, 'src/ui/zoom.js')) continue;
  test(`${exp}: zoom.js 가 공용 틀(createZoomShell)을 쓴다`, () => {
    const src = read(exp, 'src/ui/zoom.js');
    assert.match(src, /packages\/lab-kit\/ui\/zoom-shell\.js/);
    assert.match(src, /createZoomShell\(/);
    assert.ok(!/role="dialog"/.test(stripComments(src)), '패널 뼈대를 실험 쪽에서 또 만들고 있습니다');
  });
  test(`${exp}: 물건 화면은 공용 renderItemView 로 그린다`, () => {
    const src = read(exp, 'src/ui/zoom.js');
    assert.match(src, /packages\/lab-kit\/ui\/item-view\.js/);
    assert.match(src, /renderItemView\(/);
  });
}

/* ── 4·5. 말 ────────────────────────────────────────────────────── */

const CANON = UIS.banana;

for (const exp of EXPS) test(`${exp}: 닫기 · 결과 기록 · 관찰 가능성 — 여덟이 같은 말을 쓴다`, () => {
    const UI = UIS[exp];
    assert.equal(UI.zoom?.close, '닫기 (Esc)', `${exp} zoom.close`);
    assert.equal(UI.zoom?.capture, '결과 기록', `${exp} zoom.capture`);
    if (UI.observability) assert.equal(UI.observability.label, '관찰 가능성', `${exp} observability.label`);
    assert.equal(UI.undo.label, '되돌리기', `${exp} undo.label`);
    assert.equal(UI.undo.unlimited, '무제한', `${exp} undo.unlimited`);
    assert.equal(UI.undo.left(3), '3회 남음', `${exp} undo.left`);
    assert.equal(UI.notebook.readConfirm, '이 쪽을 읽었습니다', `${exp} readConfirm`);
    assert.equal(UI.notebook.readDone, '읽었습니다 ✓', `${exp} readDone`);
});

for (const exp of EXPS) test(`${exp}: 물건 화면의 공용 문구가 있다 (꺼내기 · 끌어다 놓을 수 있는 것 · 크게 보기)`, () => {
    const UI = UIS[exp];
    assert.equal(UI.zoom?.takeOut, '꺼내기', `${exp} zoom.takeOut`);
    assert.equal(UI.zoom?.acceptsLabel, '여기에 끌어다 놓을 수 있는 것:', `${exp} zoom.acceptsLabel`);
    assert.equal(UI.zoom?.tapView, '클릭 — 크게 보기', `${exp} zoom.tapView`);
});

for (const exp of EXPS) test(`${exp}: 배치 편집 문구가 여덟 실험에서 글자까지 같다`, () => {
    for (const k of ['heading', 'note', 'copy', 'copied', 'reset', 'surface', 'overlap']) {
      assert.equal(UIS[exp].edit[k], CANON.edit[k], `${exp} edit.${k}`);
    }
    // 선반이 하나면 「선반」, 둘이면 「위 선반」·「아래 선반」.
    assert.ok(['선반', '위 선반'].includes(UIS[exp].edit.shelf), `${exp} edit.shelf`);
});

test('보고서 창의 칸이 여덟 실험에서 같다', () => {
  const canonFields = JSON.stringify(CANON.report.fields);
  for (const exp of EXPS) {
    assert.equal(JSON.stringify(UIS[exp].report.fields), canonFields, `${exp} report.fields`);
    assert.equal(JSON.stringify(UIS[exp].report.groupFields ?? null), JSON.stringify(CANON.report.groupFields ?? null), `${exp} report.groupFields`);
    assert.equal(UIS[exp].report.button, CANON.report.button, `${exp} report.button`);
    assert.equal(UIS[exp].report.make, CANON.report.make, `${exp} report.make`);
  }
});

for (const exp of EXPS) test(`${exp}: 보고서 자리의 「아직 남은 것」 문구가 같다`, () => {
    assert.equal(UIS[exp].notebook.reportLockedHint, '아직 남은 것이 있습니다', `${exp} reportLockedHint`);
    assert.equal(UIS[exp].report.button, '보고서 만들기', `${exp} report.button`);
});

const walk = (node, path, out) => {
  if (typeof node === 'string') out.push([path, node]);
  else if (typeof node === 'function') out.push([path, String(node)]);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, out);
};
for (const exp of EXPS) test(`${exp}: 쓰지 않기로 한 말이 화면 문자열에 없다 (확대 화면 · 슬라이드 · 폐기물 통)`, () => {
  const out = [];
  walk(UIS[exp], exp, out);
  const bad = out.filter(([, s]) => /확대 화면|슬라이드|폐기물 통|커버글라스/.test(s));
  assert.deepEqual(bad.map(([p, s]) => `${p}: ${s.slice(0, 60)}`), [], `${exp} 에 금지어가 있습니다`);
});

test('실험대 물건 이름에 쓰레기통·폐액통·개수대·휴지가 있으면 그 이름 그대로다', () => {
  const canon = { bin: '쓰레기통', waste: '폐액통', sink: '개수대', tissue: '휴지' };
  for (const exp of EXPS) {
    const items = UIS[exp].bench?.items ?? {};
    for (const [k, v] of Object.entries(canon)) if (k in items) assert.equal(items[k], v, `${exp} bench.items.${k}`);
  }
});

for (const exp of EXPS) test(`${exp}: 탐구 과정 머리말과 셈 문구가 같다`, () => {
    const N = UIS[exp].notebook;
    assert.equal(typeof N.stepProgress, 'function', `${exp} notebook.stepProgress`);
    assert.equal(N.stepProgress(2, 6), 'STEP 6개 중 2개를 마쳤습니다.', `${exp} stepProgress`);
    assert.equal(N.stepLeadIn, CANON.notebook.stepLeadIn, `${exp} stepLeadIn`);
    assert.equal(N.stepLockedHint, '앞 STEP 을 먼저 적으세요', `${exp} stepLockedHint`);
    assert.equal(N.stepLockedWhy('1'), 'STEP 1 의 관찰 기록을 적어야 여기가 열립니다.', `${exp} stepLockedWhy`);
    assert.equal(N.stepNowBadge, '지금 할 차례', `${exp} stepNowBadge`);
});

for (const exp of EXPS) test(`${exp}: 자기 평가 척도는 다섯 칸에 말이 붙어 있다`, () => {
  {
    const scale = UIS[exp].notebook.likertScale;
    assert.ok(Array.isArray(scale) && scale.length === 5, `${exp} 자기 평가 척도 (notebook.likertScale)`);
    assert.equal(UIS[exp].notebook.likertHeading, CANON.notebook.likertHeading, `${exp} likertHeading`);
    assert.deepEqual(scale.map((s) => s.label), ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다'], `${exp} 척도 말`);
  }
});

/* ── 6. 탐구 과정 — 「어떻게 하는가」 ─────────────────────────────
 *
 * 제목(`label`)은 **무엇을 하는가**만 말한다. 「비늘잎에 5×5 mm 칼집 내기」를 읽고 실험대를
 * 봐도 무엇을 어디에 끌어다 대라는 건지 알 수 없다. 선생님이 플레이하시고 짚으셨다 —
 * 「STEP 을 읽어 보면, 뭘 어떻게 하라는지 설명이 너무 짧아서 못 알아먹겠어.」 (2026-09-04)
 *
 * 그래서 세부 단계마다 `how` 한 줄이 붙는다. 여기서 보는 것 셋:
 *   · 빠진 곳이 없다 — 하나만 비어도 그 칸에서 학생이 멈춘다
 *   · **실험대에 있는 물건 이름**을 쓴다. 노트에서 읽은 이름을 실험대에서 그대로 찾아야 한다
 *   · 제목을 그대로 베끼지 않았다 — 같은 말을 두 번 하면 한 줄을 더한 값이 없다
 */
for (const exp of EXPS) test(`${exp}: 세부 단계마다 「어떻게 하는가」가 적혀 있다`, () => {
  const UI = UIS[exp];
  const missing = [];
  for (const g of UI.protocol) {
    for (const [i, s] of g.steps.entries()) {
      if (!String(s.how ?? '').trim()) missing.push(`STEP ${g.id} · ${i + 1}. ${s.label}`);
    }
  }
  assert.deepEqual(missing, [], `${exp} 에서 「어떻게」가 빈 칸: ${missing.join(' / ')}`);
});

for (const exp of EXPS) test(`${exp}: 「어떻게」가 실험대에 있는 물건 이름을 쓴다`, () => {
  const UI = UIS[exp];
  /*
   * 실험대에 놓인 물건의 **긴 이름과 짧은 이름 둘 다** 받는다. 짧은 이름은 이름표로 늘
   * 붙어 있어(`shortNames`) 학생이 화면에서 먼저 만나는 말이고, 긴 이름은 말풍선과
   * 낭독기가 쓰는 말이다. 어느 쪽으로 적어도 실험대에서 찾을 수 있다.
   */
  const names = [...Object.values(UI.bench.items ?? {}), ...Object.values(UI.bench.shortNames ?? {})]
    .map((s) => String(s).trim()).filter((s) => s.length >= 2);
  const orphan = [];
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      const how = String(s.how ?? '');
      if (how && !names.some((n) => how.includes(n))) orphan.push(`STEP ${g.id} · ${s.label} — 「${how}」`);
    }
  }
  assert.deepEqual(orphan, [],
    `${exp} 에서 실험대 물건을 하나도 안 부르는 「어떻게」: ${orphan.join(' / ')}`);
});

for (const exp of EXPS) test(`${exp}: 「어떻게」가 제목을 그대로 베끼지 않았다`, () => {
  const UI = UIS[exp];
  const same = [];
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      const how = String(s.how ?? '').replace(/\s|\*/g, '');
      const label = String(s.label ?? '').replace(/\s|\*/g, '');
      if (how && (how === label || how.length < label.length)) same.push(`STEP ${g.id} · ${s.label}`);
    }
  }
  assert.deepEqual(same, [], `${exp} 에서 제목보다 짧거나 같은 「어떻게」: ${same.join(' / ')}`);
});

/*
 * 「」 로 따온 말은 **화면 어딘가에 그대로 있어야 한다.**
 *
 * `how` 에 「원반 뚫기」라고 적어 놓고 그런 단추가 없으면, 학생은 있지도 않은 단추를 찾다가
 * 자기가 못 찾는 줄 안다. 기능 없는 안내는 없는 것보다 나쁘다 (AGENTS.md).
 *
 * 실제로 여기서 하나 잡혔다 — banana 의 「받침 유리 통에서 꺼내면 (가)(나)(다) 가 놓입니다」.
 * `progress.js` 주석이 이미 못 박아 둔 것이었다: **받침 유리는 처음부터 선반에 나와 있고
 * 꺼내는 조작이 따로 없다.** 사람이 손으로 쓴 안내가 코드보다 앞서 나간 자리다.
 *
 * 단추 이름만 보지 않고 **화면 문자열 전체**에서 찾는다 — 「뜨지 않음」처럼 단추가 아니라
 * 기록되는 값을 따오는 자리도 있기 때문이다. 다만 `how` 자기 자신은 빼고 본다.
 *
 * ── 이 검사가 못 보는 것 ─────────────────────────────────────────
 * **화면 어딘가에 있기만 하면 통과한다.** 「스포이트 씻기」라고 따오면 그것이 STEP 제목으로
 * 실재하므로 지나간다 — 누를 단추가 아닌데도. (`revert-check` 로 실제로 확인했다:
 * 없는 말은 물고, 있는 말은 자리를 안 가리고 놓친다.)
 * 단추만 보게 좁히면 반대로 「뜨지 않음」 같은 정당한 인용을 물어 버려, 다음 사람이
 * 맞는 문구를 지운다. **넓게 두고 이 한계를 적어 두는 쪽**을 골랐다.
 * 따온 말이 정말 누를 수 있는 것인지는 사람이 화면을 열어 봐야 한다.
 */
for (const exp of EXPS) test(`${exp}: 「어떻게」가 따온 말이 화면에 실제로 있다`, () => {
  const UI = UIS[exp];
  const lines = [];
  walk(UI, exp, lines);
  const hows = new Set(UI.protocol.flatMap((g) => g.steps.map((s) => String(s.how ?? ''))));
  const elsewhere = lines.map(([, v]) => v).filter((v) => !hows.has(v));
  const orphan = [];
  for (const g of UI.protocol) {
    for (const s of g.steps) {
      for (const m of String(s.how ?? '').matchAll(/「([^」]+)」/g)) {
        const q = m[1].trim();
        if (!elsewhere.some((v) => v.includes(q))) orphan.push(`STEP ${g.id} · ${s.label} — 「${q}」`);
      }
    }
  }
  assert.deepEqual(orphan, [],
    `${exp} 에서 화면에 없는 말을 따왔습니다 — 학생은 없는 단추를 찾습니다: ${orphan.join(' / ')}`);
});
