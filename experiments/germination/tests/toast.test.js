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
  // **붙은 것과 떨어진 것을 따로 센다.** 「몇 번 떴나」만으로는 **깜빡임**이 안 보인다 —
  // 같은 말이 갈아 끼워지면 뜬 수는 같은데 화면에서는 사라졌다 나타난다.
  const counts = { mounted: 0, removed: 0 };
  /*
   * 말풍선이 **한 덩이가 아니다** — 「글 + 닫기 단추」다.
   * 그래서 뜬 글은 `el.textContent` 가 아니라 **글 조각**에서 읽어야 한다.
   * 안 그러면 전부 빈 문자열이 되어 **「아무 말도 안 떴다」로 보인다** —
   * 단추를 붙이자마자 이 파일에서 아홉 개가 한꺼번에 터졌다. 고친 것은 검사지 앱이 아니다.
   */
  const textOf = (el) => {
    const t = (el.kids ?? []).find((k) => k.className === 'toast-text');
    return t ? t.textContent : el.textContent;
  };
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(textOf(el)); counts.mounted++; },
  };
  globalThis.document = {
    createElement: () => ({
      textContent: '', className: '', type: '',
      kids: [], on: {},
      classList: { add() {} },
      setAttribute(k, v) { this[k] = v; },
      addEventListener(type, fn) { this.on[type] = fn; },
      append(...more) { this.kids.push(...more); },
      remove() { root.children.pop(); counts.removed++; },
    }),
  };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  return { root, shown, counts };
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

/* ---------------- 거르기는 「학생이 읽는 글자」로 ---------------- */

/**
 * 겹침을 **태그**로 거르면 한 태그가 문장 둘을 내는 자리에서 둘째가 사라지고,
 * **날것**으로 거르면 3단계가 깨진다 — 3단계는 뜻대로 안 된 말을 전부 같은 「숨김」
 * 한 문장으로 바꾸므로 서로 다른 날것이 **같은 글자로 두 번** 뜬다.
 * 그래서 **꾸민 뒤의 글자**끼리 견준다.
 */
test('한 태그가 문장 둘을 내면 둘 다 나온다 (1단계)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('센서가 가장 얕은 자리입니다.', 'happened', 'sensor-depth-end');
  toast.push('센서가 가장 깊은 자리입니다.', 'happened', 'sensor-depth-end');
  t.mock.timers.tick(60000);
  assert.equal(shown.filter((s) => s.includes('얕은')).length, 1, '얕은 쪽이 안 나왔습니다');
  assert.equal(shown.filter((s) => s.includes('깊은')).length, 1,
    '깊은 쪽이 삼켜졌습니다 — 태그로 거르면 이렇게 됩니다');
});

test('3단계에서 같은 「숨김」 글자가 겹쳐 뜨지 않는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 3);
  // 서로 다른 날것이지만 3단계에서는 같은 글자가 된다.
  toast.push('센서가 가장 얕은 자리입니다.', 'happened', 'sensor-depth-end');
  toast.push('센서가 가장 깊은 자리입니다.', 'happened', 'sensor-depth-end');
  toast.push('센서 끝이 콩에 닿았습니다.', 'happened', 'sensor-buried');
  t.mock.timers.tick(60000);
  assert.equal(shown.length, 1,
    `3단계에서 같은 글자가 ${shown.length}번 떴습니다: ${JSON.stringify(shown)}`);
});

test('막힘은 거르기보다 앞이다 — 다른 막힘이 줄에 밀려 삼켜지지 않는다', (t) => {
  /*
   * 앞서는 **같은 글자를 두 번** 밀어 넣어 재고 있었다. 같은 말을 두 번 띄우는 것은
   * 학생에게 아무것도 더 주지 않으므로, 그건 보증할 값어치가 없다.
   * 진짜 보증은 **다른 막힘이 줄에 밀려 삼켜지지 않는 것**이다.
   * (검사가 재려던 것과 실제로 재던 것이 달랐던 자리다)
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('첫 번째 일이 있었습니다.', 'happened', 'a');
  toast.push('두 번째 일이 있었습니다.', 'happened', 'b');
  // **막힘에는 `tag` 가 없다** (`blocked()` 가 안 낸다). 앱이 만들 수 없는 상태를
  // 재면 검사가 통과해도 아무것도 보증하지 못한다.
  toast.push('뚜껑이 닫혀 있어 넣을 수 없습니다.', 'blocked', undefined);
  t.mock.timers.tick(60000);
  assert.ok(shown.some((s) => s.includes('뚜껑')),
    `막힌 이유가 삼켜졌습니다 — 학생은 벽에 부딪힌 채 아무 말도 못 듣습니다: ${JSON.stringify(shown)}`);
  // **이미 떠 있던 것은 되돌릴 수 없다.** 보증할 것은 「줄에서 **기다리던** 것보다
  // 먼저 나오는가」다 — 그것이 「12.7초 뒤에 도착했다」를 막는다.
  assert.ok(shown.indexOf('뚜껑이 닫혀 있어 넣을 수 없습니다.') < shown.indexOf('두 번째 일이 있었습니다.'),
    `막힘이 줄 뒤에 섰습니다 — 앞선 말들이 지나갈 동안 학생은 답을 못 받습니다: ${JSON.stringify(shown)}`);
});

test('같은 막힘을 되풀이해도 깜빡이지 않는다', (t) => {
  /*
   * 막힘을 거르기보다 앞으로 옮기면, 학생이 **같은 곳을 계속 만질 때마다** 갈아 끼워져
   * 읽고 있던 문장이 **눈앞에서 사라졌다 나타난다.** 뜬 수만 세면 안 보인다 —
   * **붙은 것과 떨어진 것**을 함께 세야 보인다. (centrifuge 세션이 잡았다)
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, counts } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  for (let i = 0; i < 10; i++) {
    toast.push('뚜껑이 닫혀 있어 넣을 수 없습니다.', 'blocked', undefined);
    t.mock.timers.tick(120);
  }
  assert.equal(counts.mounted, 1,
    `같은 막힘이 ${counts.mounted}번 갈아 끼워졌습니다 — 읽는 중에 깜빡입니다`);
  assert.equal(counts.removed, 0, `${counts.removed}번 떨어졌습니다 — 읽던 문장이 사라집니다`);

  // **짝** — 다른 막힘은 그대로 새치기해야 한다. 안 그러면 위를 「아무것도 안 하기」로
  // 통과시킬 수 있고, 그러면 새 막힘이 영영 안 뜬다.
  toast.push('기구가 깨졌습니다.', 'blocked', undefined);
  t.mock.timers.tick(120);
  assert.equal(counts.mounted, 2, '다른 막힘이 새치기하지 못했습니다');
});

test('지나간 문장이 다음 것을 계속 삼키지 않는다', (t) => {
  // 지우면서 기억해 둔 글자도 지워야 한다. 안 지우면 증상이 고치기 전과 똑같아진다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('같은 말입니다.', 'happened', 'y');
  t.mock.timers.tick(60000);          // 다 뜨고 사라진 뒤
  toast.push('같은 말입니다.', 'happened', 'y');
  t.mock.timers.tick(60000);
  assert.equal(shown.length, 2,
    `한참 뒤에 같은 말을 다시 해도 나와야 합니다 (${shown.length}개)`);
});

/* ---------------- 손으로 닫기 ---------------- */

/**
 * **머무는 시간은 그대로 두고, 치울 길을 준다.**
 *
 * 긴 문장은 오래 떠 있어야 읽힌다. 그런데 다 읽은 사람은 사라질 때까지 기다릴 수밖에
 * 없었다. (사장님 — 「긴 시간은 그대로 두고 X표시를 만들어서 거기를 터치하면 사라질 수
 * 있도록. 팝업같은 느낌이지만, 토스트로!」)
 *
 * 여기서 보는 것 셋이다. **셋 다 따로 틀릴 수 있다.**
 */
const closeOf = (root) => {
  const el = root.children[root.children.length - 1];
  return (el?.kids ?? []).find((k) => k.className === 'toast-x');
};

test('닫기 단추가 진짜 단추이고 이름이 붙어 있다 — 키보드로도 닿는다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('무엇인가 일어났습니다.', 'happened', 'a');

  const x = closeOf(root);
  assert.ok(x, '닫기 단추가 없습니다');
  // `<div>` 에 클릭을 달면 손가락으로는 눌리지만 **Tab 으로 못 닿고 Enter 로 안 눌린다.**
  assert.equal(x.type, 'button', '닫기가 진짜 단추가 아닙니다 — 키보드로 닿지 못합니다');
  assert.ok(x['aria-label'] && x['aria-label'].length > 1,
    '닫기 단추에 읽어 줄 이름이 없습니다 — 화면 읽기로는 「✕」만 들립니다');
  assert.ok(typeof x.on.click === 'function', '닫기 단추가 아무 일도 안 합니다');
});

test('닫으면 줄 서 있던 다음 말이 바로 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('첫 번째로 일어난 일입니다.', 'happened', 'a');
  toast.push('두 번째로 일어난 일입니다.', 'happened', 'b');

  // [앞 조건] 둘째는 아직 줄에 있어야 이 검사가 뜻을 갖는다.
  assert.deepEqual(shown, ['첫 번째로 일어난 일입니다.'], '둘째가 벌써 떠 있습니다');

  closeOf(root).on.click();
  assert.deepEqual(shown, ['첫 번째로 일어난 일입니다.', '두 번째로 일어난 일입니다.'],
    '닫았더니 다음 말이 안 뜹니다 — 뒤에 밀려 있던 말이 통째로 사라집니다');
});

test('닫기 단추를 달아도 머무는 시간은 그대로다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, counts } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  // 긴 문장일수록 오래 머문다. **줄이는 것이 아니라 치울 길을 주는 것**이 이번 고침이다.
  toast.push('센서가 콩에 파묻혔습니다. 챔버를 클릭해 크게 보고 손잡이를 위로 끌어 올리세요.', 'happened', 'a');

  t.mock.timers.tick(3000);
  assert.equal(counts.removed, 0, '3초 만에 사라집니다 — 머무는 시간이 짧아졌습니다');
  t.mock.timers.tick(6000);
  assert.equal(counts.removed, 1, '9초가 지나도 안 사라집니다');
});
