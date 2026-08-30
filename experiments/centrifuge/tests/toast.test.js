/**
 * 말풍선 큐 — **막힘이 제때 도착하는가.**
 *
 * micrometer 파일럿에서 실제로 겪은 일이다. 금 간 유리를 재물대에 올리려다 막혔는데,
 * 그 이유가 **12.7초 뒤에** 도착했다 — 앞선 말풍선들 뒤에 줄을 섰기 때문이다.
 * 그 12초 동안 화면은 아무 답도 하지 않고, 학생은 같은 조작을 되풀이하다 손을 뗀다.
 *
 * toast.js 는 DOM 을 쓰므로 여기서 최소한의 가짜 DOM 을 세운다. jsdom 을 들이지 않는 이유는
 * `AGENTS.md` 의 「새 의존성을 추가하지 않는다」 때문이고, 여기서 필요한 것은
 * **무엇이 언제 붙었는가** 뿐이라 이 정도로 충분하다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/sim/state.js';
import { reduce } from '../src/sim/rules.js';
import { readFileSync } from 'node:fs';

/** 붙은 순서를 그대로 남기는 가짜 root. */
function fakeDom() {
  const shown = [];
  /*
   * **말풍선이 「글 + 닫기 단추」가 되면서 스텁이 따라와야 했다.**
   * 예전 스텁은 `el.textContent` 를 그대로 읽었는데, 이제 글은 자식 `<span>` 에 있고
   * `el.textContent` 는 빈 문자열이다 — 그대로 두면 **검사 아홉이 「아무 말도 안 떴다」**로
   * 무더기로 터진다. 고장이 아니라 **스텁이 못 읽는 것**이다.
   * ✕ 의 글자('✕')는 세지 않는다 — 학생이 읽는 말이 아니다.
   */
  const textOf = (el) => {
    const span = (el.children ?? []).find((c) => (c.className ?? '').includes('toast-text'));
    return span ? span.textContent : el.textContent;
  };
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(textOf(el)); },
  };
  globalThis.document = {
    createElement: () => {
      const node = {
        children: [], textContent: '', className: '', type: '',
        classList: { add() {} },
        setAttribute() {},
        addEventListener() {},
        append(...kids) { node.children.push(...kids); },
        remove() { root.children.pop(); },
      };
      return node;
    },
  };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  return { root, shown };
}

const { createToastQueue } = await import('../src/ui/toast.js');

test('막힘은 줄을 서지 않고 곧장 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  toast.push('첫 번째로 일어난 일입니다.', 'happened', 'a');
  toast.push('두 번째로 일어난 일입니다.', 'happened', 'b');
  assert.equal(shown.length, 1, '한 번에 하나만 떠야 합니다');

  toast.push('막혔습니다. 이렇게 하면 됩니다.', 'blocked');   // 막힘에는 tag 가 없다 (아래 계약 검사)
  assert.equal(shown.at(-1), '막혔습니다. 이렇게 하면 됩니다.',
    `막힘이 줄 뒤에 섰습니다 — 화면에 뜬 차례: ${JSON.stringify(shown)}`);
});

test('막힘이 앞선 말풍선을 지워 버리지 않는다', (t) => {
  // 앞선 것들은 실제로 일어난 일이다(「유리에 금이 갔습니다」).
  // 지워 버리면 학생은 왜 막혔는지의 **앞뒤**를 영영 못 듣는다.
  //
  // 말풍선은 글자 수에 따라 3.5~8초 머문다. 진짜로 기다리면 이 검사 하나가 커밋 게이트를
  // 9초 늦추고, 느린 게이트는 곧 아무도 안 돌리는 게이트가 된다. 시계를 가짜로 돌린다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  toast.push('유리에 금이 갔습니다.', 'happened', 'cracked');
  toast.push('막혔습니다.', 'blocked');
  t.mock.timers.tick(20000);
  assert.ok(shown.includes('유리에 금이 갔습니다.'),
    `앞선 말풍선이 사라졌습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});

test('같은 말을 겹쳐 쌓지 않는다', (t) => {
  // 조리개 슬라이더는 끄는 동안 수십 번 디스패치된다. 그때마다 큐에 쌓이면
  // 손을 뗀 뒤에도 같은 문장이 **몇 분 동안** 계속 뜬다 — 학생은 자기가 뭘 잘못했는지
  // 몰라 같은 곳을 계속 만진다.
  //
  // **한 번에 하나만 뜨는 것은 원래 그렇다.** 그것만 보면 이 버그는 안 잡힌다 —
  // 시간을 흘려 보내며 같은 말이 **몇 번 떴는지**를 세야 한다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  for (let i = 0; i < 30; i++) toast.push('시야가 어둡습니다.', 'happened', 'dark');
  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(shown.length, 1,
    `손을 뗀 뒤에도 같은 말이 ${shown.length}번 떴습니다`);
});

test('3단계도 막힌 이유는 감추지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // 3단계가 감추는 것은 「어떻게 하면 되는지」이지 **벽이 있다는 사실**이 아니다.
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 3);

  toast.push('뜻대로 안 됐습니다. 이렇게 해 보세요.', 'happened', 'hint');
  assert.notEqual(shown[0], '뜻대로 안 됐습니다. 이렇게 해 보세요.',
    '3단계인데 힌트가 그대로 나왔습니다');

  const { root: r2, shown: s2 } = fakeDom();
  const t2 = createToastQueue(r2, () => 3);
  t2.push('금이 간 것은 다시 올릴 수 없습니다. 새것을 꺼내세요.', 'blocked');
  assert.equal(s2[0], '금이 간 것은 다시 올릴 수 없습니다. 새것을 꺼내세요.',
    '3단계에서 막힌 이유가 가려졌습니다 — 여기서 실험이 끝납니다');
});

test('잘된 조작도 말한다 — 마지막 것만 남는다', () => {
  // **문이 닫혀 있었다.** `main.js` 의 store 가 `outcome !== 'ok'` 일 때만 문구를 내보내서,
  // `rules.js` 가 잘된 조작에 달아 둔 문구가 전부 버려지고 있었다.
  // 이 실험에서 가장 아팠던 자리는 **자**다 — 눈금은 실험대가 아니라 모세관 그림 안에
  // 그려지므로, 화면이 말까지 안 하면 **한 것인지 아닌지 알 길이 없다.**
  //
  // 다만 이 파일은 store 를 안 지나므로 **그 문은 여기서 못 잡는다.**
  // 문이 열려 있는지는 `scripts/check-bench.mjs` 가 브라우저에서 본다.
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  toast.push('모세관에 자를 댔습니다.', 'ok', 'ruler-placed');
  assert.equal(shown.at(-1), '모세관에 자를 댔습니다.', '잘된 조작이 아무 말도 안 했습니다');

  // 같은 종류를 이어서 하면 **지금 사실**이 떠야 한다. 앞의 것이 줄을 지키면
  // 두 번째로 빨아올렸을 때도 첫 번째 기둥 길이가 뜬 채로 있게 된다.
  const { root: r2, shown: s2 } = fakeDom();
  const t2 = createToastQueue(r2, () => 1);
  t2.push('기둥이 관의 33% 입니다.', 'ok', 'blood-drawn');
  t2.push('기둥이 관의 66% 입니다.', 'ok', 'blood-drawn');
  t2.push('기둥이 관의 100% 입니다.', 'ok', 'blood-drawn');
  assert.ok(!s2.includes('기둥이 관의 66% 입니다.'),
    `지난 길이가 줄을 서 있습니다: ${JSON.stringify(s2)}`);

  // 뜻대로 안 된 것은 그대로 줄을 지킨다 — 갈아 끼우면 슬라이더를 끄는 동안 쌓인 경고가
  // 손을 뗀 뒤에도 몇 분 동안 계속 뜬다.
  const { root: r3, shown: s3 } = fakeDom();
  const t3 = createToastQueue(r3, () => 1);
  t3.push('깊이가 다릅니다.', 'happened', 'seat-mismatch');
  t3.push('깊이가 다릅니다.', 'happened', 'seat-mismatch');
  assert.equal(s3.length, 1, `뜻대로 안 된 것이 쌓였습니다: ${JSON.stringify(s3)}`);
});

test('막힌 결과에는 tag 가 없다 — 층 사이를 못 박는다', () => {
  /*
   * `blocked(state, message, reason)` 에는 **tag 자리가 아예 없다.** 그러니 `main.js` 가
   * `result.tag` 로 넘기는 값은 막힘일 때 언제나 `undefined` 다.
   *
   * 이것을 안 못 박으면 **앱이 만들 수 없는 상태를 재는 검사**가 자란다 — 태그를 손으로
   * 실어 보내 놓고 「막힘은 태그로 이렇게 걸러진다」를 확인하는 식이다. 실제로 이 파일의
   * 세 자리가 그랬다. 그리고 여기가 바뀌면 `toast.js` 의 주석이 거짓이 되고,
   * 태그로 막으려는 코드가 **조용히 죽는다.**
   * (osmosis 세션이 정본에서 낸 것을 허브가 넘겨 주었다)
   */
  const st = initialState(1);
  const spun = reduce(st, { type: 'LOAD_ROTOR', payload: { slot: 'A', what: 'sample' } }).state;
  const seen = [];
  for (const [type, payload] of [
    ['DRAW_BLOOD', { angleDeg: 35, dwell: 0.9 }],
    ['SEAL_END', { end: 'outer', press: 0.99 }],
    ['MEASURE', {}],
    ['LOAD_ROTOR', { slot: 'A', what: 'sample' }],
  ]) {
    let s2 = spun;
    for (let i = 0; i < 3; i++) s2 = reduce(s2, { type, payload }).state;
    const r = reduce(s2, { type, payload });
    if (r.outcome === 'blocked') seen.push([type, r.tag]);
  }
  assert.ok(seen.length > 0, '막힌 결과를 하나도 못 만들었습니다 — 검사가 헛돌고 있습니다');
  assert.deepEqual(seen.filter(([, tag]) => tag !== undefined), [],
    `막힌 결과에 tag 가 실렸습니다: ${JSON.stringify(seen)}`);
});

test('같은 막힘이 잇달아 와도 깜빡이지 않는다', (t) => {
  /*
   * 막힘은 줄을 서지 않고 **앞선 것을 지우고 끼어든다.** 그래야 「왜 안 되는지」가
   * 늦게 도착하지 않는다. 그런데 **같은 막힘이 잇달아 오면** 그때마다 지웠다 띄우므로
   * 화면이 깜빡이기만 한다.
   *
   * **넣기 전에 그런 자리가 실제로 있는지 쟀다** — 부러진 모세관에 자를 잇달아 대면
   * 같은 막힘이 20번 나온다. (돌고 있는 회전판에 손대는 쪽은 `happened` 라 해당 없다)
   * 「빼도 안 깨지면 넣지 않는다」 — 그래서 이 검사를 함께 둔다.
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  const msg = '부러진 모세관은 잴 수 없습니다. 선반의 모세관 통에서 새것을 꺼내세요.';
  for (let i = 0; i < 20; i++) toast.push(msg, 'blocked');
  assert.equal(shown.filter((s) => s === msg).length, 1,
    `같은 막힘이 ${shown.filter((s) => s === msg).length}번 떴습니다 — 깜빡입니다: ${JSON.stringify(shown.slice(0, 4))}`);
});

test('두 상황이 같은 문장을 쓰지 않는다 — 거르기가 남의 말을 삼키지 않게', () => {
  /*
   * 말풍선은 **학생이 읽는 글자**로 겹침을 거른다(`toast.js`). 그러니 **서로 다른 상황이
   * 같은 문장을 쓰면 뒤엣것이 삼켜진다** — 태그로 거를 때 겪은 것과 같은 일이 한 층 아래서
   * 되풀이되는 것이다.
   *
   * 지금은 겹침이 0이라 **갈래를 두지 않고 여기서 붙든다.** 나중에 누가 같은 문장을
   * 한 번 더 쓰면 화면에서는 조용히 사라지고 아무 검사도 안 깨지므로, 그 자리를 여기로 만든다.
   * (fermentation·osmosis 가 정본에서 낸 것을 허브가 넘겨 주었다)
   *
   * `${...}` 가 든 것은 런타임에 조립되므로 값이 달라진다 — 상수만 센다.
   */
  const src = readFileSync(new URL('../src/sim/rules.js', import.meta.url), 'utf8');

  /*
   * **「스물 넘게 찾았으면 됐다」는 앞 조건이 아니다.**
   * 패턴이 절반을 놓쳐도 스물은 넘으므로, **남은 절반만 맞대 보고 초록불**이 된다.
   * 물음은 「몇 개 찾았나」가 아니라 **「부르는 자리를 다 읽었나」** 다.
   * (germination 세션이 정본에서 같은 틈을 짚었다 — `rows.length > 0` 은 앞 조건이 아니다)
   *
   * 그래서 부르는 자리를 **전부 세고 하나씩 갈래에 넣는다.** 어디에도 안 들어가는 것이
   * 하나라도 있으면 그 자리에서 빨간불 — 새로운 꼴이 생기면 조용히 넘어가지 않는다.
   */
  /** 괄호·따옴표 깊이를 세며 **최상위 인자**만 가른다 —
   *  `ok(withTube(state, { swabbed: true }), '…')` 처럼 첫 인자 안에도 쉼표가 있다.
   *  첫 쉼표에서 자르면 객체 안으로 들어가 엉뚱한 것을 인자로 본다. */
  function argsOf(text, from) {
    let d = 0; let q = null; let cur = ''; const out = [];
    for (let i = from; i < text.length; i++) {
      const c = text[i];
      if (q) { cur += c; if (c === q && text[i - 1] !== '\\') q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
      if ('([{'.includes(c)) { d++; if (d === 1 && c === '(') continue; }
      if (')]}'.includes(c)) { d--; if (d === 0) { out.push(cur.trim()); return out; } }
      if (c === ',' && d === 1) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    return out;
  }

  const lit = []; const tpl = []; const unknown = [];
  let sites = 0; let classified = 0;
  for (const m of src.matchAll(/\b(?:happened|ok|blocked)\(/g)) {
    sites++;
    const arg2 = argsOf(src, m.index + m[0].length - 1)[1] ?? '';
    // **문장이 하나가 아닐 수 있다.** 삼항으로 둘 중 하나를 고르는 자리가 있는데,
    // 처음 패턴은 그것을 통째로 건너뛰고도 「스물 넘게 찾았다」로 통과했다.
    // 인자 안의 **글월을 전부** 뽑는다.
    const strs = [...arg2.matchAll(/`[^`]*`|'(?:[^'\\]|\\.)*'/g)].map((x) => x[0]);
    // **자리를 센다, 글월을 세지 않는다.** 한 자리가 글월 둘을 낼 수 있어서
    // (삼항) 글월 수와 자리 수는 애초에 같을 수가 없다.
    if (!arg2 || /^null\b/.test(arg2)) classified++;
    else if (strs.length) { classified++; for (const one of strs) (one.includes('${') ? tpl : lit).push(one); }
    else unknown.push(arg2.slice(0, 46));
  }
  assert.deepEqual(unknown, [],
    `문장 자리를 갈래에 못 넣었습니다 — 패턴이 이 꼴을 모릅니다:\n  ${unknown.join('\n  ')}`);
  assert.equal(classified, sites,
    `부르는 자리 ${sites}개 중 ${classified}개만 읽었습니다`);

  const found = lit
    .map((raw) => raw.slice(1, raw.lastIndexOf(raw[0])).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  assert.ok(found.length >= 20,
    `상수 문장을 ${found.length}개밖에 못 찾았습니다 — 검사가 헛돌고 있습니다`);

  const seen = new Map();
  for (const m of found) seen.set(m, (seen.get(m) ?? 0) + 1);
  const dup = [...seen].filter(([, n]) => n > 1).map(([m, n]) => `${n}번 "${m.slice(0, 40)}…"`);
  assert.deepEqual(dup, [],
    '두 상황이 같은 문장을 씁니다 — 뒤엣것이 말풍선에서 삼켜집니다:\n  ' + dup.join('\n  '));
});
