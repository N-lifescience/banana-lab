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

/** 붙은 순서를 그대로 남기는 가짜 root. */
function fakeDom() {
  const shown = [];
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(el.textContent); },
  };
  globalThis.document = {
    createElement: () => ({
      textContent: '', className: '',
      classList: { add() {} },
      remove() { root.children.pop(); },
    }),
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

  toast.push('막혔습니다. 이렇게 하면 됩니다.', 'blocked', 'blocked-x');
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
  toast.push('막혔습니다.', 'blocked', 'broken');
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
  t2.push('금이 간 것은 다시 올릴 수 없습니다. 새것을 꺼내세요.', 'blocked', 'broken');
  assert.equal(s2[0], '금이 간 것은 다시 올릴 수 없습니다. 새것을 꺼내세요.',
    '3단계에서 막힌 이유가 가려졌습니다 — 여기서 실험이 끝납니다');
});

test('잘된 조작도 말한다 — 마지막 것만 남는다', () => {
  // **문이 닫혀 있었다.** store 가 `outcome !== 'ok'` 일 때만 문구를 내보내서,
  // `rules.js` 가 잘된 조작에 달아 둔 문구 열여섯 개가 전부 버려지고 있었다.
  // 화면에 남는 것이 없는 조작은 **한 것인지 아닌지 알 길이 없다.**
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  toast.push('바나나 껍질을 벗겼습니다.', 'ok', 'peeled');
  assert.equal(shown.at(-1), '바나나 껍질을 벗겼습니다.', '잘된 조작이 아무 말도 안 했습니다');

  // 같은 종류를 이어서 하면 **지금 사실**이 떠야 한다. 앞의 것이 줄을 지키면
  // 두 숟갈째에도 「1숟갈」이 뜬 채로 있게 된다.
  const { root: r2, shown: s2 } = fakeDom();
  const t2 = createToastQueue(r2, () => 1);
  t2.push('지금까지 1숟갈입니다.', 'ok', 'scooped');
  t2.push('지금까지 2숟갈입니다.', 'ok', 'scooped');
  t2.push('지금까지 3숟갈입니다.', 'ok', 'scooped');
  assert.ok(!s2.includes('지금까지 2숟갈입니다.'),
    `지난 수가 줄을 서 있습니다: ${JSON.stringify(s2)}`);
});

test('같은 태그라도 **다른 말**은 삼키지 않는다', (t) => {
  /*
   * 앞서는 같은 태그면 삼켰다. 그런데 한 태그가 **다른 말 둘**을 내는 자리가 있다 —
   * `cross-contamination` 은 「스포이트에 다른 용액이 남아 있는 채로 채웠습니다」와
   * 「씻지 않은 스포이트를 썼습니다. 두 용액이 섞였습니다」 둘을 내고, `cracked` 도 둘이다.
   * 그러면 **둘째가 통째로 삼켜져** 학생은 왜 그렇게 됐는지를 못 듣는다.
   *
   * 막으려던 것은 「**같은 문장**이 수십 번」이므로 문장으로 걸러도 그대로 막힌다 —
   * 위 검사가 그것을 지킨다. 둘을 함께 두어야 한쪽으로 기울지 않는다.
   * (웨이브 3 의 fermentation 세션이 자기 저장소에서 희석 안내가 삼켜지는 것으로 잡았다)
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  toast.push('스포이트에 다른 용액이 남아 있는 채로 채웠습니다.', 'happened', 'cross-contamination');
  toast.push('씻지 않은 스포이트를 썼습니다. 두 용액이 섞였습니다.', 'happened', 'cross-contamination');
  t.mock.timers.tick(5 * 60 * 1000);

  assert.ok(shown.some((s) => s.includes('남아 있는 채로')), '첫째가 떠야 합니다');
  assert.ok(shown.some((s) => s.includes('두 용액이 섞였습니다')),
    `같은 태그라도 다른 말은 삼키면 안 됩니다 — 뜬 것: ${JSON.stringify(shown)}`);
});

test('막힘은 겹침 방지에 걸리지 않는다 — 이유를 못 들으면 빠져나올 길이 없다', (t) => {
  /*
   * 앞서는 겹침 방지가 막힘 분기보다 **앞**에 있었다. 그래서 막힘 설명이 줄에 있는 다른
   * 말과 글자가 같으면 **통째로 삼켜졌다.** 막혔는데 이유가 안 나오면 학생은 같은 조작을
   * 되풀이하다 손을 뗀다. (웨이브 2 의 chromatography 세션이 짚었다)
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  /*
   * ★ **재려는 것은 「같은 글자가 두 번 뜨는가」가 아니다.**
   *
   * 처음엔 같은 글자로 두 번 밀어 넣고 「둘 다 떠야 한다」로 적었다. 그런데 같은 글자를
   * 두 번 띄우는 것은 **학생에게 아무것도 더 주지 않는다** — 깜빡이기만 한다(아래 검사).
   * 진짜 보증은 **다른 막힘이 줄에 밀려 삼켜지지 않는 것**이다.
   */
  toast.push('덮개 유리를 덮었습니다.', 'happened', 'covered');
  toast.push('고배율에서는 조동나사를 돌리지 않습니다.', 'blocked', 'coarse-high');
  t.mock.timers.tick(5 * 60 * 1000);

  assert.ok(shown.some((s) => s.includes('조동나사')),
    `막힘이 삼켜졌습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
  // 앞엣것은 밀어 넣는 순간 이미 떠 버린다. 막힘은 **그 바로 다음**으로 와야 한다 —
  // 줄 뒤에 서면 앞선 말풍선 두어 개가 지나갈 동안 학생은 아무 답도 못 받는다.
  assert.equal(shown[1], '고배율에서는 조동나사를 돌리지 않습니다.',
    `막힘이 줄 뒤로 밀렸습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});

test('3단계에서 감춘 말끼리는 겹쳐 쌓지 않는다', (t) => {
  /*
   * 3단계는 뜻대로 안 된 말을 **전부 같은 「숨김」**으로 바꾼다. 날것으로 걸러 두면
   * 원문이 다르니 안 걸러지고, **학생이 보는 글자는 같은데 두 번 뜬다.**
   * 거르기는 학생이 실제로 읽는 글자로 해야 한다.
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 3);

  toast.push('시야가 어둡습니다.', 'happened', 'dark');
  toast.push('두께가 너무 두껍습니다.', 'happened', 'thick');   // 원문은 다르다
  t.mock.timers.tick(5 * 60 * 1000);

  assert.equal(shown.length, 1,
    `3단계에서는 둘 다 같은 글자로 보이므로 한 번만 떠야 합니다 — 뜬 것: ${JSON.stringify(shown)}`);
});

test('같은 막힘이 이미 떠 있으면 갈아 끼우지 않는다 — 깜빡이기만 한다', (t) => {
  /*
   * 막힘을 거르기보다 앞으로 옮기고 나면, 학생이 같은 곳을 계속 만질 때마다 갈아 끼워서
   * **깜빡이기만 한다** — 열 번 만지면 말풍선이 열 번 새로 붙고 아홉 번 떨어진다.
   * 읽고 있는 문장이 눈앞에서 사라졌다 나타난다. **다른** 막힘은 그대로 새치기해야 한다.
   * (웨이브 3 의 centrifuge 세션이 짚었다)
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  for (let i = 0; i < 10; i += 1) toast.push('그 자리에는 놓을 수 없습니다.', 'blocked', 'nope');
  /*
   * ★ **시계를 돌려 줄을 비운 뒤에 센다.**
   *
   * 말풍선은 한 번에 하나만 뜬다. 그래서 「걸러진 것」과 「줄 서 있는 것」이 똑같이
   * 「지금 하나만 떠 있다」로 보인다 — 곧장 세면 **고장 난 코드에도 초록불**이다.
   * (웨이브 2 의 catalase 세션이 자기 검사에서 이 함정을 잡았다)
   */
  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(shown.length, 1, `같은 막힘이 ${shown.length}번 새로 떴습니다 — 깜빡입니다`);

  // 다른 막힘은 그대로 새치기한다 — 그건 다른 사실이다.
  toast.push('유리에 금이 갔습니다.', 'blocked', 'cracked');
  assert.equal(shown.length, 2,
    `다른 막힘은 곧장 떠야 합니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});

test('다른 말 위에 같은 글자로 오는 막힘은 삼키지 않는다 — 깜빡임 고침이 삼킴을 되살리면 안 된다', (t) => {
  /*
   * 「같은 글자면 그대로 둔다」로만 깜빡임을 막으면, **다른 것 위에 같은 글자 막힘**이
   * 올 때도 삼킨다 — 그건 깜빡임이 아니라 삼킴이다. 글자만으로는 두 자리를 못 가른다.
   * (웨이브 2 의 catalase 세션이 깜빡임을 고치다 한 시간 전에 고친 삼킴을 되살렸다.
   *  그때 한 시간 전에 넣은 검사가 막아 줬다 — 사람 기억이 아니라 검사가 본다)
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  toast.push('덮개 유리를 덮었습니다.', 'happened', 'covered');
  toast.push('덮개 유리를 덮었습니다.', 'blocked', 'covered');   // 글자가 같지만 막힘이다
  t.mock.timers.tick(5 * 60 * 1000);

  assert.equal(shown.length, 2,
    `다른 말 위의 막힘이 삼켜졌습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});
