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
 * **말풍선이 「글 + 닫기 단추」가 되면서 이 스텁이 거짓말을 할 뻔했다.** 예전에는
 * `el.textContent` 를 그대로 적었는데, 글이 자식 span 으로 내려가면 그 값은 **빈 문자열**이
 * 된다 — 검사 열둘이 한꺼번에 「아무 말도 안 떴다」로 보인다. **앱은 멀쩡한데** 말이다.
 * 「돌려서 없음」과 「못 돌려서 없음」이 또 갈리는 자리다.
 *
 * 그래서 스텁이 진짜 DOM 처럼 굴게 한다 — `append` 를 받고, 글은 **`.toast-text`** 에서
 * 읽는다. 닫기 단추의 「✕」가 메시지에 섞이지 않아야 하므로 클래스로 고른다.
 */
function fakeDom() {
  const shown = [];
  const textOf = (el) => {
    const t = el.kids?.find((k) => k.className === 'toast-text');
    return t ? t.textContent : el.textContent;
  };
  const root = {
    children: [],
    setAttribute() {},
    appendChild(el) { root.children.push(el); shown.push(textOf(el)); },
  };
  globalThis.document = {
    createElement: () => ({
      textContent: '', className: '', type: '', kids: [], attrs: {}, handlers: {},
      classList: { add() {} },
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k]; },
      addEventListener(ev, fn) { this.handlers[ev] = fn; },
      append(...kids) { this.kids.push(...kids); },
      remove() { root.children.pop(); },
    }),
  };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  return { root, shown };
}

/** 지금 떠 있는 말풍선의 닫기 단추. 없으면 undefined — 검사가 그걸 말하게 둔다. */
const closeBtn = (root) => root.children.at(-1)?.kids?.find((k) => k.className === 'toast-x');

const { createToastQueue } = await import('../src/ui/toast.js');

test('막힘은 줄을 서지 않고 곧장 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  /*
   * **줄을 서는 것은 `happened` 뿐이다.** 잘된 조작의 확인(`ok`)은 서로를 밀어내므로
   * (아래 「확인이 실제로 일어난 일을 밀어내지는 않는다」) 줄에 쌓이지 않는다.
   * 막힘이 밀려날 수 있는 진짜 자리는 **일어난 일이 여럿 쌓여 있을 때**다.
   */
  for (let i = 0; i < 4; i++) toast.push(`${i + 1}번째로 일어난 일입니다.`, 'happened', `a${i}`);
  assert.equal(shown.length, 1, '한 번에 하나만 떠야 합니다');

  toast.push('막혔습니다. 이렇게 하면 됩니다.', 'blocked', 'blocked-x');
  assert.equal(shown.at(-1), '막혔습니다. 이렇게 하면 됩니다.',
    `막힘이 줄 뒤에 섰습니다 — 지난 일 넷을 다 읽어야 답이 옵니다.`
    + ` 화면에 뜬 차례: ${JSON.stringify(shown)}`);

  /*
   * **여기서 「같은 막힘을 두 번 누르면 두 번 답한다」는 재지 않는다.** 그건 깜빡임이고,
   * 아래 「같은 막힘을 되풀이해 눌러도 깜빡이지 않는다」가 **반대쪽**을 붙든다.
   * 한때 이 자리에서 그것을 재다가 깜빡임을 만들었다 — 겨눔이 틀렸던 것이다.
   * 지켜야 할 것은 「같은 글자를 두 번 띄우는 것」이 아니라
   * **「막힘이 줄 끝에서 기다리지 않는 것」**이다.
   */
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
  const tag = 'no-yeast';
  const said = (level) => {
    const { root, shown } = fakeDom();
    createToastQueue(root, () => level).push('효모액을 넣지 않은 발효관입니다.', 'happened', tag);
    t.mock.timers.tick(50);
    return shown.join(' ');
  };
  assert.ok(said(1).includes(UI.toast.nextAction[tag]), '1단계에 다음 행동이 없습니다');
  assert.ok(!said(2).includes(UI.toast.nextAction[tag]), '2단계에 다음 행동이 붙습니다');
  assert.ok(said(2).includes('효모액'), '2단계가 원인까지 감췄습니다');
  assert.ok(!said(3).includes('효모액'), '3단계가 원인을 그대로 보여 줍니다');
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
 * **잘된 조작의 확인은 줄을 서지 않는다.**
 *
 * PLAYTEST 를 브라우저로 끝까지 따라 해 보다 잡았다. `createStore` 가 `outcome !== 'ok'` 로
 * 걸러 잘된 조작의 문장이 한 번도 안 뜨고 있었는데, 그것을 고치고 나니 이번에는
 * **네 걸음 전 문장이 떠 있었다.** 희석 → 붓기 → 효모 → 솜마개 → 항온기를 이어서 하면
 * 말풍선 하나에 3.5~8초씩 걸리기 때문이다 — 솜마개를 꽂는 순간 화면에 떠 있는 것은
 * 「병에 든 것은 10 % 포도당 수용액입니다」였고, 이름표는 이미 5 % 였다.
 *
 * 확인은 방금 한 조작 **바로 뒤**에 붙어 있을 때만 뜻이 있다. 늦게 도착한 확인은
 * 화면과 다른 말을 한다.
 */
test('잘된 조작의 확인은 지금 한 것을 말한다 — 지나간 것이 남아 있지 않다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  /** 지금 화면에 떠 있는 것. 한 번에 하나다. */
  // **`textContent` 를 그대로 읽지 않는다** — 글은 `.toast-text` 로 내려갔다 (fakeDom 참조).
  const onScreen = () => root.children.map((e) => e.kids.find((k) => k.className === 'toast-text').textContent);

  // 학생이 실제로 하는 속도로 — 조작 사이에 1.5초.
  toast.push('병에 든 것은 10 % 포도당 수용액입니다.', 'ok', 'mix-added');
  t.mock.timers.tick(1500);
  toast.push('만든 병에서 20 mL 를 부었습니다.', 'ok', 'glucose-poured');
  t.mock.timers.tick(1500);
  assert.deepEqual(onScreen(), ['만든 병에서 20 mL 를 부었습니다.'],
    `방금 한 조작이 아니라 앞의 것이 떠 있습니다 — 화면: ${JSON.stringify(onScreen())}`);

  toast.push('효모액 15 mL 를 부었습니다.', 'ok', 'yeast-poured');
  t.mock.timers.tick(1500);
  toast.push('솜마개로 입구를 막았습니다.', 'ok', 'plugged');
  t.mock.timers.tick(1500);
  assert.deepEqual(onScreen(), ['솜마개로 입구를 막았습니다.'],
    `네 걸음 전 문장이 아직 떠 있습니다 — 화면: ${JSON.stringify(onScreen())}`);

  // 줄에 남아서 뒤늦게 튀어나오는 것도 없어야 한다.
  t.mock.timers.tick(60 * 1000);
  assert.deepEqual(onScreen(), [],
    `다 끝난 뒤에 지나간 확인이 떴습니다 — 화면: ${JSON.stringify(onScreen())}`);
});

test('확인이 실제로 일어난 일을 밀어내지는 않는다', (t) => {
  // `happened` 는 확인이 아니라 **결과**다. 하나라도 못 들으면 왜 그런 결과가 나왔는지
  // 앞뒤를 잃는다 — 「효모액을 넣지 않은 발효관입니다」를 못 들으면 기체 0 이 설명되지 않는다.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);

  toast.push('효모액을 넣지 않은 발효관입니다.', 'happened', 'no-yeast');
  toast.push('솜마개로 입구를 막았습니다.', 'ok', 'plugged');
  t.mock.timers.tick(60 * 1000);

  assert.ok(shown.some((s) => s.startsWith('효모액을 넣지 않은 발효관입니다.')),
    `실제로 일어난 일이 확인에 밀려 사라졌습니다 — 뜬 차례: ${JSON.stringify(shown)}`);
});

test('말이 다르면 태그가 같아도 삼키지 않는다', (t) => {
  /*
   * **태그는 갈래이지 문장이 아니다.**
   *
   * 이 실험에서 희석은 두 번이다 — 10 % 를 넣고, 증류수를 넣는다. 둘 다 `mix-added` 라
   * 태그로 거르면 **둘째 말이 통째로 삼켜진다.** 실제로 그랬다:
   *
   *     10 % → 만든 병 : 「10 % 포도당 수용액 10 mL 를 더했습니다…」
   *     증류수 → 만든 병: **(아무 말도 없음)**
   *
   * 하필 그 자리다. 「같은 부피를 더하면 농도가 절반」이 이 실험에서 배울 것 중 하나이고,
   * `PLAYTEST.md` 가 「여기를 꼭 보세요」라고 적어 둔 칸이다. 이름표는 5 % 로 바뀌는데
   * **왜 그런지를 말해 주던 문장이 사라졌다.** 직접 플레이해 보고서야 나왔다.
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);

  toast.push('10 % 포도당 수용액 10 mL 를 더했습니다.', 'ok', 'mix-added');
  toast.push('증류수 10 mL 를 더했습니다. 병에 든 것은 5 % 포도당 수용액입니다.', 'ok', 'mix-added');
  t.mock.timers.tick(60 * 1000);

  assert.equal(shown.length, 2,
    `태그가 같다고 다른 말을 삼켰습니다 — 뜬 것: ${JSON.stringify(shown)}`);
  assert.ok(shown.some((m) => /증류수/.test(m)),
    `증류수를 넣은 말이 안 떴습니다 — 뜬 것: ${JSON.stringify(shown)}`);
});

test('3단계에서 감춰져 같아진 말은 두 번 뜨지 않는다', (t) => {
  /*
   * 3단계는 뜻대로 안 된 말을 **전부 「결과가 나오지 않았습니다.」 하나로 감춘다.**
   * 그래서 원문이 다르면 둘 다 통과해 **학생은 같은 문장을 두 번 본다.**
   *
   *     3단계에서 본 것: ["결과가 나오지 않았습니다.", "결과가 나오지 않았습니다."]
   *
   * 거르기 기준이 태그도 원문도 아니고 **화면에 뜰 글자**여야 하는 까닭이다.
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 3);
  toast.push('만든 병이 비어 있습니다. 포도당을 먼저 넣으세요.', 'happened', 'mix-empty');
  toast.push('포도당이 없어 아직 0 % 입니다.', 'happened', 'mix-water-only');
  t.mock.timers.tick(60 * 1000);
  assert.equal(shown.length, 1,
    `감춰져 같아진 말이 ${shown.length}번 떴습니다 — ${JSON.stringify(shown)}`);
});

test('같은 막힘을 되풀이해 눌러도 깜빡이지 않는다', (t) => {
  /*
   * 막힘을 거르기 앞으로 옮기고 나면 나오는 자리다. 같은 것을 되풀이해 누를 때마다
   * 떠 있던 말풍선을 지우고 똑같은 것을 다시 붙이면 — 열 번에 **붙은 것 10 · 떨어진 것 9** —
   * 학생 눈에는 답이 오는 것이 아니라 **깜빡이는 것**이다.
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 2);
  for (let i = 0; i < 10; i++) toast.push('솜마개가 막고 있어 부을 수 없습니다.', 'blocked', 'plugged');
  t.mock.timers.tick(60 * 1000);
  assert.equal(shown.length, 1,
    `같은 막힘이 ${shown.length}번 붙었습니다 — 깜빡입니다`);
});

/*
 * **막힘이 잘된 조작·일어난 일과 같은 글자가 되면 안 된다.**
 *
 * 말풍선 거르기는 「화면에 뜰 글자」로 한다(`src/ui/toast.js`). 그 구조는 **막힘 문장이
 * 다른 문장과 겹치지 않는다**는 전제 위에 서 있다 — 겹치면 막힘이 앞선 말풍선에
 * 삼켜지고, 학생은 **막혔는데 아무 말도 못 듣는다.**
 *
 * 오늘은 막힘 문장이 하나뿐이라 겹칠 수가 없다. 그래서 코드에 방어 갈래를 두지 않았다.
 * 대신 **전제를 여기서 지킨다** — 겹치는 문장이 생기는 날 이 검사가 빨간불이 된다.
 * 갈래를 두면 평소엔 한 줄도 안 돌면서 자리만 차지하고, 안 두고 검사도 없으면
 * 그날 증상이 「아무 말도 없음」이라 **아무도 여기를 안 본다.**
 */
test('막힘 문장이 다른 문장과 겹치지 않는다 — 거르기의 전제', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/sim/rules.js', import.meta.url), 'utf8');

  // 문자열 리터럴 하나를 여는 따옴표 자리에서부터 읽어 낸다. 템플릿의 ${…} 는 자리표시자로.
  const readLiteral = (i) => {
    const q = src[i];
    let out = '';
    for (let j = i + 1; j < src.length; j += 1) {
      if (src[j] === '\\') { j += 1; continue; }
      if (src[j] === q) return { text: out, end: j };
      if (q === '`' && src.startsWith('${', j)) {
        let depth = 1; j += 2;
        while (j < src.length && depth) { if (src[j] === '{') depth += 1; if (src[j] === '}') depth -= 1; j += 1; }
        out += '␟'; j -= 1; continue;
      }
      out += src[j];
    }
    return { text: out, end: src.length };
  };

  const literalsAfter = (re) => {
    const found = [];
    for (const m of src.matchAll(re)) {
      const i = src.indexOf(m[1], m.index);
      found.push(readLiteral(i).text.trim());
    }
    return found;
  };

  // 막힘의 문장은 상수로 두고 쓴다 — 이름을 모아 그 정의를 읽는다.
  const blockedNames = [...src.matchAll(/return blocked\(\s*\w+\s*,\s*([A-Z_][A-Z0-9_]*)/g)]
    .map((m) => m[1]);
  const blockedInline = literalsAfter(/return blocked\(\s*\w+\s*,\s*(['"`])/g);
  const blockedFromConst = [...new Set(blockedNames)].map((name) => {
    const at = src.search(new RegExp(`const ${name}\\s*=\\s*`));
    assert.ok(at >= 0, `막힘 문장 상수 ${name} 을 찾지 못했습니다`);
    const q = src.slice(at).search(/['"`]/);
    return readLiteral(at + q).text.trim();
  });

  const others = [
    ...literalsAfter(/\bok\(\s*[\w.]+\s*,\s*(['"`])/g),
    ...literalsAfter(/\bhappened\(\s*[\w.]+\s*,\s*(['"`])/g),
  ];

  const bone = (t) => t.replace(/[\s␟0-9.]/g, '');
  const blockedTexts = [...blockedFromConst, ...blockedInline];
  assert.ok(blockedTexts.length > 0, '막힘 문장을 하나도 못 찾았습니다 — 이 검사가 헛돌고 있습니다');
  assert.ok(others.length > 5, `견줄 문장이 ${others.length}개뿐입니다 — 이 검사가 헛돌고 있습니다`);

  const otherBones = new Set(others.map(bone));
  for (const b of blockedTexts) {
    assert.ok(!otherBones.has(bone(b)),
      `막힘 문장이 다른 문장과 같습니다 — 거르기에 삼켜져 학생이 아무 말도 못 듣습니다:\n  「${b}」`);
  }
});

test('말풍선에 닫기 단추가 있고 낭독기가 무엇인지 읽어 준다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('10 mL 를 더했습니다.', 'ok', 'mix-added');
  const x = closeBtn(root);
  assert.ok(x, '닫기 단추가 없습니다');
  assert.equal(x.type, 'button', 'type=button 이 아니면 폼 안에서 제출이 됩니다');
  assert.ok((x.getAttribute('aria-label') ?? '').trim().length > 0,
    '낭독기에 「✕」만 읽힙니다 — 무엇을 하는 단추인지 이름이 있어야 합니다');
});

test('닫기 단추를 누르면 사라지고 줄에 선 다음 것이 뜬다', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('첫 번째로 일어난 일입니다.', 'happened', 'a');
  toast.push('두 번째로 일어난 일입니다.', 'happened', 'b');
  assert.equal(shown.length, 1, '한 번에 하나만 떠야 합니다');
  closeBtn(root).handlers.click();
  assert.equal(shown.length, 2, '닫았는데 다음 것이 안 떴습니다 — 줄이 멈춥니다');
  assert.ok(shown.at(-1).includes('두 번째'), `다음 것이 아닙니다 — ${JSON.stringify(shown)}`);
});

test('닫기 단추가 생겨도 머무는 시간은 그대로다', (t) => {
  /*
   * **선생님이 「긴 시간은 그대로 두고」라고 하셨다.** 닫는 길을 내는 김에 시간을 줄이면
   * 읽을 시간이 필요한 사람에게서 빼앗는 것이 된다 — 그건 부탁받은 것의 반대다.
   *
   * 시간을 줄이는 고침이 슬쩍 섞여도 다른 검사는 아무도 안 문다. 여기서만 잡힌다.
   */
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { root, shown } = fakeDom();
  const toast = createToastQueue(root, () => 1);
  toast.push('20분이 지났습니다. 맹관부에 모인 기체는 5.5 mL 입니다.', 'happened', 'observation-done');
  t.mock.timers.tick(3000);
  assert.equal(root.children.length, 1,
    '3초 만에 사라졌습니다 — 읽을 시간을 빼앗습니다');
  t.mock.timers.tick(6000);
  assert.equal(root.children.length, 0,
    `9초가 지나도 안 사라집니다 — ${JSON.stringify(shown)}`);
});
