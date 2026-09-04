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
