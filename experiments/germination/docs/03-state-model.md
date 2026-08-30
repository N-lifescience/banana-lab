# 03 — 상태 모델

`src/sim/state.js`. **DOM 을 모른다** — `document`·`window`·`Date.now()`·`Math.random()`
을 쓰지 않는다. 그래서 `node --test` 로 규칙 전체를 브라우저 없이 검증할 수 있다.

## 덩어리 셋

```
chambers   { L, R }   나란히 놓인 바이오챔버 둘. **이 실험의 몸통**
scoop      { holds }  숟가락이 지금 들고 있는 것
session               난이도·기록·되돌리기·노트
```

`CHAMBERS = ['L','R']` 은 **왼쪽·오른쪽일 뿐 이름에 뜻이 없다.**
「발아 콩 챔버」로 이름 지으면 화면이 답을 미리 말하는 꼴이 된다.

## 챔버 하나

| 칸 | 뜻 |
|---|---|
| `beans` | `null` \| `'sprout'` \| `'dry'`. **`null` 은 아직 안 넣은 것 — 0 숟갈과 다르다** |
| `scoops` | 숟갈 수. **g 이 아니다** (AGENTS.md §2.4) |
| `mixed` | 두 갈래를 섞어 넣었는가 |
| `btb` | BTB 용액을 넣었는가 |
| `sensorIn` · `sensorDepth` | 꽂았는가 · 뚜껑에서 잰 깊이(0~1) |
| `sensorFouled` | 콩 부스러기가 묻었는가 |
| `lid` | `'open'` \| `'sealed'` |
| `running` · `elapsedMin` · `finished` | 재고 있는가 · 얼마나 쟀는가 |
| `samples` | `[{ min, co2Ppm, tempC }]` — **센서가 읽어 쌓은 값** |

### 왜 `samples` 를 쌓아 두는가

`TICK` 이 **그 순간의 조건**으로 계산해 붙인다. 그래서 도중에 뚜껑을 열면 그 뒤부터
곡선이 꺾이고, **이미 쌓인 값은 그대로 남는다.** 그때 잰 값이기 때문이다.
지금 조건으로 곡선 전체를 다시 그리면, 20 ℃ 에서 잰 값이 아무 표시 없이 딴 조건의
값으로 바뀐다.

### 왜 `sensorState` 는 저장하지 않는가

`sensorState(ch)` 는 `sensorDepth` 와 콩 높이(`scoops`)를 **그때그때** 견줘 낸다.
저장해 두면, 센서를 꽂아 놓고 콩을 더 부었을 때 **이미 파묻혔는데도 「닿지 않음」으로
남는다.** 그 어긋남은 화면 어디에도 안 나온다.

## 파생값 — 유일한 통로

```
chamberConditions(ch)   →  metabolism.js 가 받는 조건 한 벌
chamberView(ch)         →  렌더러가 받는 값 한 벌
```

**이 둘이 유일한 통로다.** 챔버 상태를 직접 읽는 코드가 따로 생기면, 조건을 하나 더할 때
두 곳이 어긋난다.

`chamberView` 는 **일어난 일**(`co2Ppm`·`tempC`·`btbStage`)과 **센서가 읽은 값**(`reading`·
`samples`)을 갈라서 낸다. **센서를 안 꽂아도 BTB 색은 변한다** — 센서는 재는 도구이지
일어나는 일이 아니다.

## 대조가 성립하는가

```
CONTROL_KEYS = ['scoops', 'btb', 'sealed', 'sensor']   // 같아야 하는 것
beans                                                   // 달라야 하는 것 (조작변인)
```

`mismatches(state)` 는 두 챔버에서 어긋난 통제변인의 목록이다.
**막는 데 쓰지 않는다.** 결과 화면이 이 목록을 읽어 **값과 함께** 말한다.

`comparisonKind(state)` — `empty` · `same-beans` · `mixed` · `off-control` · `ok`.
아직 콩을 안 넣었으면 `empty` 이고 `mismatches` 는 **빈 목록**이다 —
「전부 어긋났다」고 말하면 아무것도 안 한 학생을 나무라는 꼴이 된다.
