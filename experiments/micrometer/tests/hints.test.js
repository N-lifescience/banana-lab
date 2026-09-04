/**
 * 1단계 안내가 **화면에 실제로 있는 것**을 가리키는가.
 *
 * 안내(`UI.notebook.stepWhere`)는 「어디서 무엇을 누르는지」를 말해 주는 줄이고,
 * 거기 굵게 적힌 이름은 학생이 화면에서 **눈으로 찾을 글자**다. 그 글자가 화면에
 * 없으면 학생은 없는 것을 찾다가 멈춘다 — 화면이 아무 소리도 안 내므로 아무도 모른다.
 *
 * 실제로 넷이 어긋나 있었다:
 *   · 「대물렌즈를 **100배**로」  — 단추에 적힌 것은 `10배` 다 (총배율과 대물배율)
 *   · 「접안렌즈 돌리기 **슬라이더**」 — 슬라이더를 없애고 단추만 남겼는데 안내가 안 따라왔다
 *   · 「**크기 기록**」            — 단추 글자는 `세포 크기 기록`
 *   · 절차 이름 「…**기록하기**」  — 같은 단추를 「결과 기록」과 두 이름으로 불렀다
 *
 * 넷 다 사람이 플레이하다 찾았다. 검사가 있었으면 한 번에 걸렸을 것이라 여기 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/ui/strings.js';
import { OBJECTIVES } from '../src/sim/optics.js';

/**
 * 화면에 **글자로 나오는** 이름을 모은다.
 *
 * 여기에 없는 이름을 안내가 가리키면 그것은 학생이 찾을 수 없는 이름이다.
 * 「시야」·「눈금 확대 띠」 처럼 단추가 아니라 **자리**를 가리키는 말은 따로 적는다 —
 * 화면에 글자로는 없지만 확대 뷰에서 눈에 보이는 영역이고, 본문이 그 말로 설명한다.
 */
function onScreenNames() {
  const Z = UI.zoom;
  const names = new Set([
    // 확대 뷰의 단추와 손잡이 이름
    Z.capture, Z.recordCalibration, Z.recordMeasurement,
    Z.insert, Z.insertFlipped, Z.remove, Z.takeOut, Z.putAway,
    Z.pickScale, Z.pickCell, Z.clearPicks, Z.lampOff, Z.lowerObjective,
    Z.coarseGroup, Z.rotateGroup,
    UI.controls.rotate, UI.controls.focus, UI.controls.diaphragm, UI.controls.objective,
    // 대물렌즈 단추에 적히는 글자 (4배·10배·40배)
    ...OBJECTIVES.map((o) => UI.units.mag(o)),
    // 실험대 물건 이름표
    ...Object.values(UI.bench.items),
    ...Object.values(UI.stageItems ?? {}),
    // 단추가 아니라 **자리**를 가리키는 말. 확대 뷰 본문이 이 말로 설명한다.
    '시야', '눈금 확대 띠', '현미경',
  ].filter(Boolean));
  return names;
}

/** 안내 한 줄에서 굵게 적힌 이름들. */
const boldsIn = (line) => (line.match(/<b>(.*?)<\/b>/g) ?? []).map((b) => b.replace(/<\/?b>/g, ''));

test('1단계 안내가 화면에 없는 이름을 가리키지 않는다', () => {
  const names = [...onScreenNames()];
  const bad = [];
  for (const [id, line] of Object.entries(UI.notebook.stepWhere)) {
    for (const bold of boldsIn(line)) {
      // 「조동·미동나사」 처럼 둘을 한 번에 가리키는 것이 있다. 조각마다 따로 본다.
      for (const part of bold.split('·')) {
        // 「대물렌즈를 10배」 처럼 이름을 문장에 녹여 쓴 것도 있다 —
        // 화면의 어떤 이름이 그 안에 들어 있으면(또는 그 안에 들어가면) 찾을 수 있는 것으로 본다.
        const found = names.some((n) => part.includes(n) || n.includes(part));
        if (!found) bad.push(`${id}: 「${part}」 (안내 전체: 「${bold}」)`);

        /**
         * ★ **이름이 맞다고 숫자까지 맞은 것은 아니다.**
         *
         * 위의 느슨한 규칙만으로는 「대물렌즈를 **100배**로」가 통과한다 —
         * 「대물렌즈」가 화면에 있는 이름이기 때문이다. 그런데 단추에 적힌 것은 `10배` 이고
         * 100배라는 단추는 없다. 되돌려 보고 알았다: 안내를 「100배」로 되돌렸는데
         * **검사가 초록불이었다.** 배율을 말하면 그 배율 단추가 실제로 있는지 따로 본다.
         */
        for (const [, n] of part.matchAll(/(\d+)\s*배/g)) {
          const label = UI.units.mag(Number(n));
          if (!OBJECTIVES.map((o) => UI.units.mag(o)).includes(label)) {
            bad.push(`${id}: 「${part}」 — ${label} 라는 대물렌즈 단추는 없습니다`
              + ` (있는 것: ${OBJECTIVES.map((o) => UI.units.mag(o)).join(' ')})`);
          }
        }
      }
    }
  }
  assert.deepEqual(bad, [],
    `안내가 화면에 없는 이름을 가리킵니다 — 학생이 그 글자를 찾다가 멈춥니다:\n  ${bad.join('\n  ')}`);
});

test('없앤 손잡이 이름이 안내에 남아 있지 않다', () => {
  // 슬라이더는 없앴다 (`zoom.js` 의 `rotateHtml` — 단추만 남았다).
  // 조리개 하나만 슬라이더이고, 그것은 안내가 굵게 가리키지 않는다.
  const all = Object.values(UI.notebook.stepWhere).join('\n');
  assert.equal(/접안렌즈 돌리기 ?<?\/?b?>? ?슬라이더|돌리기<\/b> 슬라이더|슬라이더/.test(all), false,
    `안내에 「슬라이더」가 남아 있습니다: ${(all.match(/[^.]*슬라이더[^.]*/g) ?? []).join(' / ')}`);
});

test('결과 기록을 한 이름으로만 부른다', () => {
  // 확대 뷰 단추 · 절차 문구 · 안내 셋이 같은 일을 다른 이름으로 부르면,
  // 학생은 노트를 읽고 실험대에서 그 단추를 찾는데 찾을 이름이 없다.
  // 그 이름은 여덟 실험이 같다 — 「결과 기록」 (docs/09-uniformity.md §5).
  //
  // **결과를 기록하는 칸이 어느 것인지는 안내가 말한다** — 그 칸의 `stepWhere` 가
  // 그 단추를 가리킨다. 절차 이름만 보고 고르면 「눈금값 기록하기」(다른 단추)까지
  // 함께 잡혀서, 검사가 애먼 것을 나무란다.
  const name = UI.zoom.capture;
  assert.equal(name, '결과 기록', '결과를 남기는 단추의 이름이 여덟 실험과 다릅니다');
  const shotIds = Object.entries(UI.notebook.stepWhere)
    .filter(([, line]) => line.includes(name))
    .map(([id]) => id);
  assert.ok(shotIds.length > 0, `안내 중 「${name}」 를 가리키는 칸이 하나도 없습니다`);

  for (const id of shotIds) {
    const group = UI.protocol.find((g) => g.id === id[0]);
    const step = group?.steps[id.charCodeAt(1) - 97];
    assert.ok(step, `${id} 에 해당하는 절차가 없습니다`);
    assert.ok(step.label.includes(name),
      `절차가 결과 기록을 다른 이름으로 부릅니다: 「${step.label}」 (단추는 「${name}」)`);
  }
});

test('첨삭 문구에 마크다운이 새지 않는다', async () => {
  // 첨삭 줄(`.grade-line`)은 문구를 그대로 innerHTML 에 꽂는다 — `**` 를 쓰면
  // 화면에 별표가 그대로 나온다. 노트 다른 곳에는 `emph()` 가 있지만 여기는 안 거친다.
  const { QUESTIONS, MISCONCEPTION } = await import('../src/ui/grading.js');
  /**
   * ★ **되돌아오는 말은 문항 표에만 있는 것이 아니다.**
   *
   * 처음에는 `QUESTIONS` 만 훑었다. 그런데 별표가 샌 자리는 오개념 문구
   * (`MISCONCEPTION.feedback`)였고 그것은 표 밖에 있다 — **되돌려도 초록불이었다.**
   * 화면에 나가는 문구를 하나도 빠짐없이 모아서 본다.
   */
  const lines = [
    ...QUESTIONS.flatMap((q) => [[q.id + ' feedback', q.feedback], [q.id + ' hint', q.hint]]),
    ['오개념 문구', MISCONCEPTION.feedback],
  ];
  for (const [what, line] of lines) {
    if (!line) continue;
    assert.equal(/\*\*/.test(line), false,
      `${what} 에 마크다운 별표가 있습니다 — 화면에 그대로 나옵니다: ${line}`);
  }
});

test('산술 되짚기 문장이 바로 위에 적힌 식과 같은 말을 한다', () => {
  /**
   * 되짚기 문장에 「**× 10 µm**」가 빠져 있었다. 식은
   * `(대물 눈금 []칸 × 10 µm) ÷ 접안 눈금 []칸` 인데 문장은 「대물 칸 수를 접안 칸 수로
   * 나눈 값」이라고 했다 — 그대로 따르면 21 ÷ 21 = **1 µm**, 답은 10 µm 다.
   *
   * 이 문장은 **막혔을 때 보는 문장**이고 보는 사람은 1단계 학생이다.
   * 그 자리에서 식과 다른 말을 하면 되짚기가 아니라 **잘못 이끄는 것**이다.
   *
   * ★ 문장을 글자로 박지 않는다. **식에 있는 숫자가 문장에도 있는가**만 본다 —
   *   문장을 다듬을 자유는 남기고, 식과 어긋나는 것만 잡는다.
   */
  const { formulaScale, mismatch } = UI.notebook.calc;
  const nums = [...new Set(formulaScale.match(/\d+(?:\.\d+)?/g) ?? [])];
  assert.ok(nums.length > 0, `식에서 숫자를 못 찾았습니다: ${formulaScale}`);

  const line = mismatch[1];
  assert.ok(line && line.trim().length > 0, '1단계 되짚기 문장이 비어 있습니다');
  const missing = nums.filter((n) => !line.includes(n));
  assert.deepEqual(missing, [],
    `되짚기 문장이 식의 숫자를 빠뜨렸습니다 — 그대로 따르면 답이 달라집니다.\n`
    + `  식   : ${formulaScale}\n  문장 : ${line}\n  빠진 것: ${missing.join(', ')}`);

  /**
   * ★ **반대 방향도 본다 — 문장이 답을 알려 주면 안 된다.**
   *
   * 식의 자리는 전부 빈칸(`[ ]`)이다. 그 답은 **학생이 세어서 채우는 것**이다.
   * 되짚기 문장에 식에 없는 숫자가 들어가면, 그건 십중팔구 **답**이다 —
   * 알려 주면 문제가 아니게 된다. 「어느 자리가 어디서 온 값인지」를 짚어 주는 것과
   * **값을 말해 주는 것**은 다르다. (허브를 거쳐 온 지적)
   *
   * ★ 다만 **배율 줄(`UI.zoom.magLine`)에는 이 잣대를 대지 않는다.** 거기 적힌
   *   「접안렌즈 10배 × 대물렌즈 10배 = 총배율 100배」는 선생님이 **남기라고 하신
   *   다리**다. 학생이 세어서 채울 답이 아니라 **앱이 알려 주는 사실**이라 자리가 다르다.
   *
   * ★★ **이 검사가 못 잡는 것 — 재서 확인했다.**
   *
   *     「답은 2.5 µm 입니다.」 를 넣으면  → 빨간불 (잡는다)
   *     「답은 10 µm 입니다.」  를 넣으면  → **통과** (못 잡는다)
   *
   *   답이 식에 이미 있는 숫자와 **우연히 같으면** 걸러지지 않는다. 100배에서는 답이
   *   10 µm 인데 식에도 `× 10 µm` 가 있어서 그렇다. 그러니 이 검사는
   *   **「문장에 군더더기 숫자가 없다」까지**만 지킨다 — 「답을 안 알려 준다」를 통째로
   *   지키지는 못한다. 그 자리는 사람이 문장을 읽어야 한다.
   *   못 잡는 것을 적어 두지 않으면 다음 사람이 이 검사를 믿고 안 읽는다.
   */
  const extra = [...new Set(line.match(/\d+(?:\.\d+)?/g) ?? [])].filter((n) => !nums.includes(n));
  assert.deepEqual(extra, [],
    `되짚기 문장에 식에 없는 숫자가 있습니다 — 답을 알려 주면 문제가 아니게 됩니다.\n`
    + `  식   : ${formulaScale}\n  문장 : ${line}\n  군더더기: ${extra.join(', ')}`);
});

test('게이지 안내가 항목마다 어느 손잡이를 만지는지 말한다', () => {
  // 항목 이름만 말하면 「눈금선의 또렷함」이 깎였다는 것은 알아도
  // 무엇을 어떻게 하라는 것인지 알 길이 없다.
  const { worst, fix } = UI.observability;
  for (const key of Object.keys(worst)) {
    assert.ok(fix[key] && fix[key].trim().length > 0,
      `${key} 에 「어떻게 고치는지」가 없습니다 — 이름만 말하고 맙니다`);
  }
});
