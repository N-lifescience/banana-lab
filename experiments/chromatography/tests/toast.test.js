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

/*
 * 붙은 순서를 그대로 남기는 가짜 root.
 *
 * ★ **말풍선이 「글 + ✕ 단추」로 나뉜 뒤로는 `el.textContent` 를 보면 안 된다.**
 *   진짜 DOM 에서는 자식의 글이 합쳐져 나오지만 **이 스텁에서는 빈 문자열**이라,
 *   그대로 두면 검사 전부가 「아무 말도 안 떴다」로 무더기로 터진다 — 앱은 멀쩡한데.
 *   화면에 뜬 **문장**을 보는 것이 원래 뜻이므로 `.toast-text` 에서 꺼낸다.
 *   (허브 세션이 정본에서 아홉 개가 터지는 것을 겪고 알려 줬다.)
 */
function fakeDom() {
  const shown = [];
  /** 화면에 뜬 문장 — 닫기 단추(✕)의 글자는 세지 않는다. */
  const textOf = (el) => {
    const t = (el.children ?? []).find((k) => k.className === 'toast-text');
    return t ? t.textContent : el.textContent;
  };
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(textOf(el)); },
  };
  globalThis.document = {
    createElement: () => {
      const el = {
        textContent: '', className: '', type: '',
        children: [],
        classList: { add() {} },
        setAttribute() {},
        addEventListener() {},
        append(...kids) { el.children.push(...kids); },
        remove() { root.children.pop(); },
      };
      return el;
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

  toast.push('막혔습니다. 이렇게 하면 됩니다.', 'blocked');
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

/*
 * **한 태그가 이는 다른 문장이 통째로 사라졌다.**
 *
 * `front-overrun` 은 서로 다른 두 자리에서 난다 — 전선을 **표시하려** 할 때와
 * 전개율을 **재려** 할 때다. 문장도 다르다. 그런데 거르기가 태그만 보고 있어서,
 * 첫 문장을 받은 학생이 곧이어 다른 조작을 하면 **아무 답도 못 받았다.**
 * 학생 눈에는 그 조작이 아무 일도 안 한 것이다 — 그래서 같은 곳을 계속 만진다.
 * (허브 세션이 fermentation 의 희석 안내에서 찾아 돌려 줬다.)
 */
test('같은 태그라도 말이 다르면 둘 다 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  const 첫 = '전선이 종이 끝을 넘어가 표시할 자리가 없습니다.';
  const 둘 = '전개액이 종이 끝을 넘어갔습니다. 전개율을 잴 수 없습니다.';
  toast.push(첫, 'happened', 'front-overrun');
  toast.push(둘, 'happened', 'front-overrun');

  t.mock.timers.tick(60_000);   // 줄 선 것이 다 지나가게 둔다
  assert.ok(shown.includes(첫), `첫 문장이 안 떴습니다: ${JSON.stringify(shown)}`);
  assert.ok(shown.includes(둘),
    `같은 태그라는 이유로 둘째 문장이 삼켜졌습니다 — 방금 한 조작에 답이 없습니다: ${JSON.stringify(shown)}`);
});

test('말이 같으면 태그가 달라도 한 번만 뜬다', (t) => {
  // 거르기의 원래 뜻은 「**같은 말**을 쌓지 않는다」다. 그 뜻은 그대로 지킨다 —
  // 흔드는 동안 같은 문장이 수십 번 쌓이면 손을 뗀 뒤에도 몇십 초를 떠 있는다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  const 같은말 = '원심관에 잎과 추출액이 둘 다 있어야 색소가 나옵니다.';
  toast.push(같은말, 'happened', 'nothing-to-shake');
  toast.push(같은말, 'happened', 'nothing-to-shake-2');
  toast.push(같은말, 'happened', 'nothing-to-shake');

  t.mock.timers.tick(60_000);
  assert.equal(shown.filter((x) => x === 같은말).length, 1,
    `같은 말이 ${shown.filter((x) => x === 같은말).length}번 떴습니다: ${JSON.stringify(shown)}`);
});

/*
 * **막힘은 겹침 방지보다 앞이다.**
 *
 * 거르기를 위에 두었더니 **막힌 이유까지 걸렸다.** 막힘은 「무슨 일이 있었다」가 아니라
 * 「방금 네가 한 것이 안 된 이유」여서, 못 들으면 빠져나올 길이 없다.
 * (허브 세션이 정본에서 같은 것을 찾아 알려 줬다.)
 */
test('막힘은 겹침 방지에 걸리지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  /*
   * ★ **막힘에는 태그를 싣지 않는다.** `blocked(state, message, reason)` 에는 `tag` 자리가
   *   아예 없어서, 앱이 보내는 막힘은 늘 `tag === undefined` 다. 검사가 태그를 손으로
   *   실으면 **앱이 만들 수 없는 상태**를 재게 된다 — 통과해도 아무것도 지키지 못한다.
   *   층 사이는 `tests/rules.test.js` 의 「막힌 결과에는 tag 가 없다」가 못 박는다.
   *   (허브 세션이 정본에서 일곱 자리를 찾아 돌려 줬다.)
   */
  const 같은말 = '유리에 금이 갔습니다. 새 것을 꺼내 쓰세요.';
  // 먼저 「일어난 일」로 같은 문장이 떠 있게 만든다.
  toast.push(같은말, 'happened', 'cracked');
  assert.equal(shown.length, 1);
  // 이제 같은 문장이 **막힘**으로 온다. 걸러 버리면 학생은 자기 조작에 답을 못 받는다.
  toast.push(같은말, 'blocked');   // **태그를 안 싣는다** — 아래 주석 참조
  assert.equal(shown.length, 2,
    `막힘이 겹침 방지에 걸렸습니다 — 화면에 뜬 차례: ${JSON.stringify(shown)}`);
});

/*
 * **3단계에서는 뜻대로 안 된 말이 전부 같은 「숨김」으로 바뀐다.**
 *
 * 그래서 원문이 서로 달라도 **학생이 보는 글자는 같다.** 원문으로 거르면 같은 글자가
 * 두 번 뜬다 — 그건 정말 같은 말이라 한 번이어야 한다.
 */
test('3단계에서 감춘 말끼리는 겹쳐 쌓지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 3);

  toast.push('원점이 번졌습니다.', 'happened', 'spot-bleed');
  toast.push('전개액이 너무 많습니다.', 'happened', 'too-much-solvent');
  t.mock.timers.tick(60_000);
  assert.equal(shown.length, 1,
    `학생이 보는 글자는 같은데 두 번 떴습니다: ${JSON.stringify(shown)}`);
});
