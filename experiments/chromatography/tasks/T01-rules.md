# T01 · 상태 모델 · 전개 물리 · 규칙 엔진

화면 없이 규칙부터 만든다. **여기가 흔들리면 전부 흔들린다.**

## 목표

`src/sim/` 을 이 실험의 것으로 갈아 끼운다. `node --test` 만으로 실험 전체가 검증되는 상태.

## 건드릴 파일

| 파일 | 무엇을 |
|---|---|
| `src/sim/optics.js` → `src/sim/develop.js` | **파일을 갈아 끼운다.** 광학 → 모세관 상승(전개) |
| `src/sim/state.js` | 이 실험의 상태 스키마와 파생값 |
| `src/sim/rules.js` | 조작 하나당 함수 하나 |
| `src/sim/quality.js` | 결과의 **질**을 0~1 로 |
| `src/sim/progress.js` | 절차 세부 단계 판정표 |
| `tests/optics.test.js` → `tests/develop.test.js` | 상수를 못 박는다 |
| `tests/rules.test.js` | 규칙표 전부 |
| `docs/03-state-model.md` · `docs/04-interaction-rules.md` | 표를 먼저 적고 코드로 옮긴다 |

`src/sim/` 안에서 `document`·`window`·`Date.now()`·`Math.random()` 을 쓰지 않는다.

## 전개 물리 (`src/sim/develop.js`)

```
거름종이            2 × 10 cm            (PAPER_W_MM 20 · PAPER_H_MM 100)
원점                아래에서 2.5 cm       (ORIGIN_MM 25)
용매 전선           바닥 기준 = 액면 깊이 + K·√t,  종이 끝(100 mm)에서 멈춘다
색소 띠             원점 + 상대간격 × (전선 − 원점)
Rf                  (띠 − 원점) / (전선 − 원점)   ← **학생이 자로 재어 구한다**
```

- **전선 거리는 시간의 제곱근에 비례한다(Washburn).** 처음에 쑥 오르다 갈수록 느려진다.
  이 사실이 "전개액이 상단 가까이 오면 꺼내라"는 절차가 왜 시간이 아니라 **높이**로
  적혀 있는지를 설명한다.
- **시계를 화면에 띄우지 않는다.** 실제 소요 시간은 `[확인 필요]` 라 지어낼 수 없고,
  절차가 보라고 한 것은 시간이 아니라 전선의 높이다. 학생은 전선이 오르는 것을 보고 꺼낸다.
- 상대 간격은 **그림용 값이지 실측 Rf 가 아니다.** 상수 이름에 `RF` 를 쓰지 않는다.
  **화면 어디에도 이 숫자가 나오면 안 된다** — 검사로 못 박는다(아래 합격 기준).

## 상태 스키마 (뼈대)

```js
tube   { leaf, extract, shaken, settleT, capped }         // 원심관 — 추출
paper  { originMm, marker, spots, spotWidthMm, load,      // 거름종이 한 장
         inVial, runT, washedOut, lightDose, wetness,
         markedFront, frontAtMark, markedBands, torn }
vial   { depthMm, capped, hasPaper }
tools  { capillary: { loaded, dirty } }
session{ …바나나랩 그대로 — level·seed·mode·notes·captures·readStages·
         violations·tidy·log·history·undosLeft }
```

`session` 은 손대지 않는다. 되돌리기·기록·제출이 전부 여기에 매여 있다.

## 규칙표 — 잘못하면 무엇이 보이는가

**막지 않는다.** 아래는 전부 `happened` 다.

| 조작 | 잘못하면 | 결과로 보이는 것 |
|---|---|---|
| `ADD_LEAF` | 시든 잎 | 색소량이 적어 띠 넷이 다 흐리다 |
| `ADD_EXTRACT` | 너무 많이 | 상층액이 묽어 띠가 흐리다 |
| `SHAKE` | 덜 흔듦 | 추출이 덜 돼 색소량이 적다 |
| (기다림) | 층 분리 전에 뽑음 | 잎 부스러기가 딸려 와 원점이 지저분하고 띠가 번진다 |
| `DRAW_ORIGIN` | **볼펜으로** 그음 | 잉크가 함께 올라가 **가짜 띠**가 생긴다 |
| `DRAW_ORIGIN` | 너무 낮게 | 전개액에 잠겨 색소가 씻겨 나간다 |
| `DRAW_ORIGIN` | 너무 높게 | 전개 거리가 짧아 띠가 덜 갈라진다 |
| `SPOT` | 횟수가 적음 | 띠가 흐려 넷을 구별할 수 없다 |
| `SPOT` | 한 번에 오래 댐 | 원점이 커져 띠가 굵고 서로 겹친다 |
| `SPOT` | 안 말리고 연달아 | 원점이 번진다 (같은 결과, 다른 원인) |
| `POUR_SOLVENT` | 많이 부음 | **원점이 잠겨 띠가 아예 없다** |
| `INSERT_PAPER` | 원점이 잠기게 세움 | 위와 같다 |
| `CAP_VIAL` 안 함 | 뚜껑 열어 둠 | 용매가 날아가 전선이 느리고, 빛에 **엽록소 두 띠가 먼저 옅어진다** |
| (기다림) | 너무 일찍 꺼냄 | 띠가 원점 가까이 뭉쳐 갈라지지 않았다 |
| (기다림) | 너무 늦게 꺼냄 | 전선이 종이 끝을 넘어가 **Rf 를 잴 수 없다** |
| `MARK_FRONT` | 마른 뒤에 표시 | 전선이 사라져 어디였는지 알 수 없다 |
| `MEASURE` | 젖은 채로 자를 댐 | **찢어진다** ← 하드 게이트 2 |

### 하드 게이트는 둘뿐 — **빠져나갈 길을 문장에 담는다**

1. `IMPOSSIBLE` — 뚜껑을 닫은 바이알에 종이를 넣을 수 없다
   → 「바이알 뚜껑이 닫혀 있습니다. **바이알을 눌러 뚜껑을 먼저 여세요.**」
2. `BROKEN` — 젖은 거름종이가 찢어졌다
   → 「젖은 거름종이가 찢어졌습니다. **선반의 거름종이 통에서 새것을 꺼내세요.**」

「새것을 꺼내세요」로 끝내지 않는다 — **어디서** 꺼내는지까지 말한다.

### 되돌아갈 길 (막다른 길을 만들지 않는다)

`NEW_PAPER`(거름종이 통) · `EMPTY_TUBE` · `EMPTY_VIAL` · `RINSE_CAPILLARY` ·
`UNCAP_VIAL` · `REMOVE_PAPER`. **새 조작을 넣을 때마다 되돌아올 길을 같이 정한다.**

## 합격 기준

- [ ] `reduce()` 가 `blocked` 를 내는 자리가 **위 둘뿐**이고, 회귀 테스트가 모든 액션을
      여러 상태에서 돌려 그것을 확인한다 (바나나랩의 테스트를 그대로 잇는다)
- [ ] 모든 `blocked` 메시지에 **어디로 가야 하는지**가 들어 있다 (검사로 못 박는다)
- [ ] 전개 상수(2 × 10 cm · 원점 10 mm · √t)가 `tests/develop.test.js` 에 박혀 있다
- [ ] 띠 상대 간격 숫자가 **`src/ui/strings.js` 와 화면 문자열 어디에도 없다** — 검사로 못 박는다
- [ ] 「TLC」·「실리카겔」·「청녹」이 소스 어디에도 없다 — 검사로 못 박는다
- [ ] 전개액 비율이 **9:1**, 추출액이 **3:1** 로 적혀 있다 — 검사로 못 박는다
- [ ] `src/sim/` 에 `document`·`window`·`Date.now`·`Math.random` 이 없다 (기존 검사 유지)
- [ ] 새로 넣은 검사를 **되돌려서 실제로 실패하는지** 확인했다

## 검증 명령

```bash
npm run check
```
