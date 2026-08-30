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

/**
 * 붙은 순서를 그대로 남기는 가짜 root.
 *
 * ★ 말풍선이 **「글 + 닫기 단추」** 로 바뀌면서 `el.textContent` 가 빈 문자열이 됐다 —
 *   스텁이 `append` 를 모르니 자식이 어디에도 안 담겼고, 모든 시험이 「아무 말도 안 떴다」로
 *   보였다. **읽히는 글은 `.toast-text` 다.** 거기서 꺼낸다.
 *   (닫기 단추의 ✕ 까지 이어 붙이면 시험의 문장 대조가 전부 어긋난다.)
 */
function fakeDom() {
  const shown = [];
  const clicks = [];          // 닫기 단추에 걸린 처리기
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) {
      root.children.push(el);
      const txt = el.kids.find((k) => k.className === 'toast-text');
      shown.push(txt ? txt.textContent : el.textContent);
    },
  };
  const make = (tag) => {
    const kids = [];
    return {
      tag, attrs: {}, textContent: '', className: '', type: '', kids,
      classList: { add() {} },
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(type, fn) { if (type === 'click') clicks.push(fn); },
      append(...ks) { kids.push(...ks); },
      remove() { root.children.pop(); },
    };
  };
  globalThis.document = { createElement: make };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  /** 지금 떠 있는 말풍선의 ✕ 를 누른다. */
  const clickClose = () => clicks[clicks.length - 1]?.();
  return { root, shown, clickClose };
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

/* ---------------------------------------------------------------------------
 * ★ **막힘에는 태그가 없다.** `blocked()` 는 `{state, outcome, message, reason}` 를
 *   돌려준다 — `tag` 자리가 아예 없다 (`src/sim/rules.js`, tests/rules.test.js 가 못박는다).
 *   그래서 태그로 겹침을 다루는 장치는 **막힘에는 하나도 안 걸린다.**
 *   태그를 실어 넣고 재면 앱이 만들 수 없는 상태를 재게 된다.
 *
 * 그 아래에 두 가지 잘못이 따로 있다. **둘을 갈라야 한다.**
 *   막힘 위에 **같은 막힘**        → 그대로 둔다   (깜빡임)
 *   다른 것 위에 **같은 글자 막힘** → 반드시 내보낸다 (삼킴)
 * 하나만 고치면 다른 하나가 되살아난다. (허브 · catalase 가 정본에서 겪었다.)
 * ------------------------------------------------------------------------- */

test('같은 막힘을 연달아 밀어도 화면이 깜빡이지 않는다', (t) => {
  // 금 간 유리를 재물대에 올리려다 막힌 학생은 **같은 단추를 여러 번 누른다.**
  // 막힘은 줄을 앞지르며 떠 있던 것을 지우므로, 누를 때마다 지웠다 다시 띄운다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  for (let i = 0; i < 5; i += 1) toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  t.mock.timers.tick(60 * 1000);
  assert.equal(shown.length, 1, `같은 막힘이 ${shown.length}번 떴습니다 — 화면이 깜빡입니다`);
});

test('깜빡임을 막아도 막힌 이유가 삼켜지지 않는다', (t) => {
  // 깜빡임만 막으면 **다른 것이 떠 있을 때 온 막힘**까지 함께 삼켜지기 쉽다.
  // 그때 증상은 「막혔는데 아무 말도 없다」다 — 고치기 전과 똑같이 보인다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('유리에 금이 갔습니다.', 'happened', 'cracked');
  toast.push('줄에서 기다리는 말입니다.', 'happened', 'other');
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  t.mock.timers.tick(60 * 1000);
  assert.ok(shown.some((x) => x.includes('새것을 꺼내세요')),
    `막힌 이유가 삼켜졌습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});

test('막힘이 지나간 뒤 같은 막힘이 다시 오면 다시 뜬다', (t) => {
  // 떠 있던 글자를 기억해서 거를 때, **지울 때 함께 잊지 않으면** 지나간 문장이
  // 다음 것을 영영 삼킨다. 증상은 역시 「막혔는데 아무 말도 없다」다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  t.mock.timers.tick(60 * 1000);          // 다 읽고 사라진다
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  t.mock.timers.tick(60 * 1000);
  assert.equal(shown.length, 2,
    `두 번째 막힘이 안 떴습니다 — 지나간 글자를 계속 기억하고 있습니다: ${JSON.stringify(shown)}`);
});

test('글자가 다른 막힘은 따로 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  toast.push('뚜껑이 닫혀 있습니다.', 'blocked');
  t.mock.timers.tick(60 * 1000);
  assert.equal(shown.length, 2, `다른 막힘이 삼켜졌습니다: ${JSON.stringify(shown)}`);
});

test('떠 있는 것이 막힘이 아니면, 글자가 같아도 막힘은 내보낸다', (t) => {
  // 깜빡임을 막으려고 「같은 글자면 거른다」로만 두면 여기가 삼켜진다.
  // **떠 있는 것이 막힘인가**를 함께 봐야 두 자리가 갈린다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'happened', 'cracked');
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  t.mock.timers.tick(60 * 1000);
  assert.equal(shown.length, 2,
    `글자가 같다고 막힘을 삼켰습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});

/* ---------------- 닫기 단추 — 사장님이 아이폰으로 해 보시고 주신 지시 ----------------
 * 「지속시간이 꽤 긴 것 같은데, **긴 시간은 그대로 두고** X표시를 만들어서 거기를 터치하면
 *  사라질 수 있도록 — 팝업같은 느낌이지만, **토스트로!**」
 *
 * 그래서 **`holdFor` 는 손대지 않는다.** 시간이 아니라 **길**을 하나 더 주는 일이다.
 */

test('닫기 단추가 진짜 <button> 이고 읽어 줄 이름이 붙는다', (t) => {
  // 눈에는 ✕ 하나뿐이라, 이름이 없으면 스크린리더에서 **「버튼」이라고만** 읽힌다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, clickClose } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('금이 갔습니다. 새것을 꺼내세요.', 'blocked');
  const el = root.children.at(-1);
  const x = el.kids.find((k) => k.className === 'toast-x');
  assert.ok(x, '닫기 단추가 없습니다');
  assert.equal(x.tag, 'button', '<button> 이라야 자판으로도 닿습니다');
  assert.equal(x.type, 'button', 'type=button 이 없으면 폼 안에서 제출이 됩니다');
  assert.ok(x.attrs['aria-label'], '읽어 줄 이름이 없습니다 — ✕ 만으로는 무엇인지 모릅니다');
  assert.ok(typeof clickClose === 'function');
});

test('닫으면 줄에 있던 다음 말이 **바로** 뜬다', (t) => {
  // 닫기가 「지우기」가 되면, 밀려 있던 말이 함께 사라진다 — 학생은 앞뒤를 못 듣는다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown, clickClose } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('첫 번째로 일어난 일입니다.', 'happened', 'a');
  toast.push('두 번째로 일어난 일입니다.', 'happened', 'b');
  assert.equal(shown.length, 1, '   (앞 조건) 한 번에 하나만 뜬다');
  clickClose();
  assert.equal(shown.length, 2, `닫았더니 다음 말이 안 떴습니다: ${JSON.stringify(shown)}`);
  assert.equal(shown[1], '두 번째로 일어난 일입니다.');
});

test('닫기 단추가 생겨도 머무는 시간은 그대로다', (t) => {
  // 「긴 시간은 그대로 두고」가 지시였다. 짧아도 3.5초는 머문다 (holdFor).
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  toast.push('짧은 말.', 'happened', 'a');
  t.mock.timers.tick(3000);
  assert.equal(root.children.length, 1, '3초 만에 사라졌습니다 — 머무는 시간이 짧아졌습니다');
  t.mock.timers.tick(6000);
  assert.equal(root.children.length, 0, '시간이 지나도 저절로 안 사라집니다');
});
