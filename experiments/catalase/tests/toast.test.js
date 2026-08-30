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
 * ★ **말풍선 안이 두 조각이 되면서 스텁도 같이 커져야 했다.** 이제 글자는
 * `<span class="toast-text">` 에 들어가고 옆에 닫기 단추가 붙는다. 스텁이
 * `append`·`setAttribute`·`addEventListener` 를 모르면 **거기서 터지고,
 * 화면에는 「아무 말도 안 떴다」로 보인다** — 옆 랩은 그렇게 아홉 개가 터졌다.
 *
 * 글자를 **클래스로 찾는다.** 「첫 아이가 글자」로 두면 순서가 바뀔 때 조용히
 * 엉뚱한 것을 읽는다. 못 찾으면 빈 문자열이 되어 **검사가 시끄럽게 터진다** —
 * 조용히 틀리는 것보다 낫다.
 */
function fakeDom() {
  const shown = [];
  const textOf = (el) => {
    const t = (el.children ?? []).find((c) => c.className === 'toast-text');
    return t ? t.textContent : el.textContent;
  };
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(textOf(el)); },
  };
  globalThis.document = {
    createElement: () => {
      const node = {
        textContent: '', className: '', type: '',
        children: [],
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

  toast.push('막혔습니다. 이렇게 하면 됩니다.', 'blocked', undefined);
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
  toast.push('막혔습니다.', 'blocked', undefined);
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
  t2.push('금이 간 것은 다시 올릴 수 없습니다. 새것을 꺼내세요.', 'blocked', undefined);
  assert.equal(s2[0], '금이 간 것은 다시 올릴 수 없습니다. 새것을 꺼내세요.',
    '3단계에서 막힌 이유가 가려졌습니다 — 여기서 실험이 끝납니다');
});

/**
 * 난이도는 **설명만** 줄인다.
 *
 * 1단계는 원인 + 다음 행동, 2단계는 원인만, 3단계는 그것도 감춘다.
 * **막힌 이유는 세 단계 모두 감추지 않는다** — 3단계가 감추는 것은 「어떻게 하면 되는지」이지
 * 벽이 있다는 사실이 아니다. 금 간 비커를 든 학생이 「결과가 나오지 않았습니다」만 보면
 * 거기서 끝난다.
 */
const { UI } = await import('../src/ui/strings.js');

test('1단계에만 다음 행동이 붙고, 2·3단계는 줄어든다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const tag = 'no-substrate';
  const said = (level) => {
    const { root, shown } = fakeDom();
    createToastQueue(root, () => level).push('빈 비커에 원반을 넣었습니다.', 'happened', tag);
    t.mock.timers.tick(50);
    return shown.join(' ');
  };
  assert.ok(said(1).includes(UI.toast.nextAction[tag]), '1단계에 다음 행동이 없습니다');
  assert.ok(!said(2).includes(UI.toast.nextAction[tag]), '2단계에 다음 행동이 붙습니다');
  assert.ok(said(2).includes('빈 비커'), '2단계가 원인까지 감췄습니다');
  assert.ok(!said(3).includes('빈 비커'), '3단계가 원인을 그대로 보여 줍니다');
});

test('다음 행동 표의 태그가 전부 규칙 엔진에 있는 것이다', async () => {
  // 없는 태그에 걸어 두면 그 안내는 영영 안 뜬다. 화면에는 아무 표시도 안 난다.
  const { readFileSync } = await import('node:fs');
  const { UI } = await import('../src/ui/strings.js');
  const src = readFileSync(new URL('../src/sim/rules.js', import.meta.url), 'utf8');
  const orphan = Object.keys(UI.toast.nextAction).filter((tag) => !src.includes(`'${tag}'`));
  assert.deepEqual(orphan, [], `규칙 엔진에 없는 태그: ${orphan.join(', ')}`);
});

/**
 * **거르기는 막힘 «뒤» 에 온다.**
 *
 * 같은 말을 쌓지 않는 것과 막힌 이유를 반드시 전하는 것은 부딪힌다. 순서가 정한다:
 * 거르기가 앞이면 **막힌 이유가 통째로 삼켜진다.** 학생은 왜 안 되는지 못 들은 채
 * 같은 조작을 되풀이한다.
 *
 * 부딪히는 자리를 손으로 만든다 — **같은 글자**를 먼저 띄워 두고 막힘을 낸다.
 * 3단계에서 실제로 생기는 모양이다(뜻대로 안 된 말이 전부 같은 「숨김」 문장이 된다).
 */
test('같은 글자가 이미 떠 있어도 막힘은 삼켜지지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  const SAME = '똑같은 문장입니다.';

  toast.push(SAME, 'happened', 'a');
  assert.equal(shown.length, 1, '앞선 말이 안 떴습니다 — 다음 줄이 잴 바탕이 없습니다');

  toast.push(SAME, 'blocked', undefined);
  assert.equal(shown.length, 2,
    `막힘이 삼켜졌습니다 — 거르기가 막힘보다 앞에 있습니다. 화면: ${JSON.stringify(shown)}`);
  assert.equal(shown.at(-1), SAME);
});

/**
 * **거르는 열쇠는 「화면에 나가는 글자」다. 태그가 아니다.**
 *
 * 이 저장소의 `happened` 열넷 중 **열둘에 태그가 없다.** 3단계는 서로 다른 태그를
 * 같은 「숨김」 문장으로 바꾼다. 태그로만 거르면 둘 다 안 걸려서, 같은 실패를 다섯 번
 * 누르면 같은 문장이 **24초** 동안 화면을 잡고 있었다.
 */
test('태그가 없어도 같은 말은 쌓이지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  for (let i = 0; i < 5; i++) toast.push('비커에 원반이 없습니다.', 'happened', null);
  // ★ **시계를 돌려서 큐를 비운다.** 안 돌리면 «걸러진 것» 과 «줄 서 있는 것» 이
  //    똑같이 「지금 하나만 떠 있다」로 보인다 — 그러면 고장 난 코드도 초록불이다.
  //    되돌림 검사로 알았다: 태그로만 거르게 되돌려도 이 줄이 안 빨개졌다.
  t.mock.timers.tick(60_000);
  assert.equal(shown.length, 1, `같은 말이 ${shown.length}번 쌓였습니다`);
});

test('3단계에서 태그가 달라도 같은 「숨김」 문장은 한 번만 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 3);
  toast.push('까닭 하나입니다.', 'happened', 'x');
  toast.push('까닭 둘입니다.', 'happened', 'y');     // 태그가 다르지만 3단계에선 같은 글자가 된다
  t.mock.timers.tick(60_000);                        // 줄에 선 것까지 다 흘려보낸다
  assert.equal(shown.length, 1,
    `3단계에서 같은 문장이 ${shown.length}번 떴습니다 — 날것으로 걸렀습니다`);
});

/**
 * **떠 있던 글자는 사라질 때 함께 잊는다.**
 *
 * 안 잊으면 지나간 문장이 다음 것을 계속 삼킨다. 그때 증상이 **고치기 전과 똑같아서**
 * 어디를 보고 있는지 알 수 없게 된다 — 옆 랩이 그 자리에서 헤맸다.
 */
test('말풍선이 사라지면 같은 말을 다시 할 수 있다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('비커에 원반이 없습니다.', 'happened', null);
  t.mock.timers.tick(9000);                          // 최대 8초를 넘긴다
  toast.push('비커에 원반이 없습니다.', 'happened', null);
  assert.equal(shown.length, 2,
    '지나간 문장이 다음 것을 삼켰습니다 — dismiss 에서 기억해 둔 글자를 안 지웠습니다');
});

/**
 * **같은 막힘이 이미 떠 있으면 그대로 둔다 — 깜빡이지 않게.**
 *
 * 막힘을 줄 앞으로 보내 놓으면, 학생이 **같은 곳을 계속 만질 때마다** 떠 있던 것을
 * 지우고 새로 붙인다. 글자는 그대로인데 **깜빡인다.** 읽고 있던 문장이 계속 새로
 * 시작되니 긴 문장은 끝까지 읽히지 않는다.
 *
 * 「몇 개 떴나」로는 못 본다 — 늘 하나다. **붙은 횟수**를 세야 갈린다.
 */
test('같은 막힘을 되풀이해도 깜빡이지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  for (let i = 0; i < 10; i++) {
    toast.push('비커에 금이 갔습니다. 선반의 비커 통에서 새 비커를 꺼내세요.', 'blocked', undefined);
    t.mock.timers.tick(120);
  }
  assert.equal(shown.length, 1, `같은 막힘이 ${shown.length}번 새로 붙었습니다 — 깜빡입니다`);
});

test('다른 막힘은 그래도 새치기한다 — 새 소식은 지금 보여야 한다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('막힌 이유 가.', 'blocked', undefined);
  t.mock.timers.tick(120);
  toast.push('막힌 이유 나.', 'blocked', undefined);
  assert.deepEqual(shown, ['막힌 이유 가.', '막힌 이유 나.'],
    '다른 막힘이 안 나왔습니다 — 깜빡임을 막다가 새 이유까지 막았습니다');
});
