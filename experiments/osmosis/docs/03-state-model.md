# 03 · 상태 모델

> **세포에서 일어나는 삼투 현상 관찰하기** (id: `osmosis`)

`src/sim/state.js`. 이 파일은 **DOM 을 모른다.** `document` · `window` · `Date.now()` ·
`Math.random()` 을 쓰지 않는다. 그 경계 덕분에 `node --test` 로 규칙 전체를 브라우저 없이
검증할 수 있다 — 이 저장소에서 가장 값어치 있는 결정이었다 (`PLAYBOOK.md` §2).

## 한눈에

```
state
├─ slides { A, B, C }         받침 유리 석 장
├─ microscope                 재물대 · 대물렌즈 · 초점 · 조리개 · 시야 위치
├─ tools                      스포이트 · 핀셋 · 비늘잎 · 벗긴 표피
└─ session                    난이도 · 기록 · 노트 · 되돌리기 · 위반
```

## 받침 유리가 왜 석 장인가

이 실험은 **한 장 위에서 용액을 갈아 가며** 같은 세포를 보는 것이 핵심이다.
셋은 서로 다른 처리군이 아니다. 석 장을 두는 이유는 둘이다.

- 여벌이 있어야 실수가 막다른 길이 되지 않는다 (금이 가거나 안쪽 표피를 올렸을 때)
- 농도가 다른 시야를 나란히 놓고 견줄 수 있어야 한다

**그래서 「셋을 한 번씩 찍었는가」로는 아무것도 판정할 수 없다.** 갖춰야 하는 것은
**농도열**이다 — 증류수 + 설탕 용액 4종 (`progress.resultsDone`).
바나나랩에서 그대로 베껴 오면 안 되는 곳이다.

## 슬라이드 하나

| 값 | 무엇 |
|---|---|
| `sample` | `{ side: 'outer'\|'inner', thickness: 0~1, folded }` · 없으면 `null` |
| `medium` | 지금 덮개 유리 아래에 있는 용액 `{ id, pct }` |
| `pending` | 가장자리에 고여 있고 **아직 안 들어간** 용액 `{ id, pct }` |
| `exchange` | 치환 진행도 0~1. **거름종이를 대야 오른다** |
| `drops` | 봉입액 방울 수 |
| `equivPct` | 세포가 **지금 평형을 이루고 있는** 바깥 농도 (설탕 %) |
| `coverslip` | `{ placed, angleAtDrop, bubbles }` |
| `contaminated` · `cracked` · `lensTouched` · `seed` | |

### 왜 농도를 `{ id, pct }` 로 두는가

씻지 않은 스포이트로 옮기면 **실제로 나가는 농도가 병에 붙은 이름표와 다르다.**
이름(id)으로만 다루면 그 어긋남을 담을 데가 없어, 오염을 「보여 주기만 하고 결과에는
없는 것」으로 만들게 된다. `id` 는 이름표, `pct` 는 실제다.

### 왜 `equivPct` 스칼라 하나인가

세포마다의 원형질체 부피비를 상태에 저장하지 않는다. `equivPct` 하나에서 파생시킨다
(`osmosis.protoplastRatio(equivPct, sapPct)`).

이렇게 두면 학생이 평형에 닿기 전에 용액을 또 바꿔도 자연스럽게 이어진다 —
「직전 평형이 무엇이었나」를 따로 기억할 필요가 없다.

## 도구

| 값 | 무엇 |
|---|---|
| `dropper` | `{ holds, pct, level, rinsed }` |
| `forceps` | `{ holding: null \| 'coverslip' \| 'usedCoverslip' }` |
| `onion` | `{ cut }` — 5×5 mm 칼집. **벗기면 함께 없어진다** |
| `epidermis` | 핀셋에 물려 있는 표피 조각 `{ side, thickness }` |

비늘잎과 거름종이는 **개수를 세지 않는다.** 안쪽 표피를 잘못 벗겼을 때 되돌아갈 길이
거기밖에 없고, 치환은 여러 번 하는 것이 정상 경로다. 바닥나면 그건 결과가 아니라
막다른 길이다 (`PLAYBOOK.md` §1).

## 파생값 — 저장하지 않고 그때그때 계산한다

```js
focusError(m)        |coarse + fine|
brightness(m)        조리개 / 배율이 요구하는 광량
coverage(slide)      min(drops / 2, 1)
excess(slide)        clamp((drops − 2) / 3, 0, 1)
isFloating(slide)    excess > 0.6
isTooThick(slide)    sample.thickness > 0.6
mediumPct(slide)     치환이 덜 됐으면 **섞인 농도**
settled(slide)       삼투가 지금 용액에 대해 평형에 닿았는가
```

## `fieldParams(state, slideId)`

**이 객체 하나가 시야 그림을 완전히 결정한다.** 같은 값을 주면 같은 SVG 가 나온다
(난수는 `seed` 로 받는다). 그래서 기록해 둔 시야를 탐구 노트와 보고서에서 되살릴 수 있고,
결과 보드에 **이미지 대신 이 값들만** 보내면 된다.

```
side · folded · tooThick
equivPct · targetPct · exchange · coverage · excess · floating · contaminated
bubbles · cracked · lensTouched
objective · focusErr · brightness · panX · panY · seed
```

**개인을 가리키는 값이 하나도 없다.** `tests/roadmap.test.js` 가 이 목록을 고정하고 있어,
무언가 더하면 잡힌다.

## 세션

| 값 | 무엇 |
|---|---|
| `level` · `mode` · `seed` | 난이도(1·2·3) · 혼자/모둠 |
| `notes` | 세부 단계별 관찰 기록 |
| `captures` | 그때 본 시야를 **그대로 다시 그릴 수 있는** 값 한 벌 + `solution` · `settled` |
| `readStages` | 탐구 노트에서 읽은 단계 |
| `log` | `{ at, action, outcome, tag }`. `at` 은 순번이다 — `Date.now()` 를 쓰면 테스트가 비결정적이 된다 |
| `history` · `undosLeft` | 되돌리기. 세션 안에서만 쓰고 제출 데이터에 넣지 않는다 |

`captures[].at` 은 **한 번 붙으면 안 바뀌는 번호**다. 배열 인덱스를 쓰면 중간 것을 지운 뒤
같은 번호가 다시 붙어, 지운 기록에 딸린 답이 새 기록 칸에 들어간다.

## 기록에 없는 것

**원형질분리 세포의 비율.** 그것을 시야에서 읽어 내는 것이 이 실험의 탐구다.
화면이 세어 주면 탐구가 사라진다 (`tests/rules.test.js` 가 검사한다).
