# 03 · 상태 모델

`src/sim/state.js` 가 구현이고 이 문서는 설명이다. 값이 어긋나면 코드가 맞다.

## 원칙

- 단일 `state` 객체에 전부 담는다
- 변경은 `reduce(state, action)` 만 거친다. **부수효과 없음, 원본 불변**
- `src/sim/` 안에서 `document`·`window`·`Date.now()`·`Math.random()` 을 쓰지 않는다

## 스키마

```
finger   { swabbed, drop, dropAge, wiped }
tube     { kind, fill, bubbles, lastAngle, seal{outer,inner}, clot,
           work, mixed, lost, broken, donor, seed }
rotor    { slots{A,B}, seat{A,B}, speed, phase, pulls, onBeat }
lancet   { used, disposed }
tools    { pickKind, tubesUsed, rulerPlaced }
session  { level, seed, mode, step, notes, captures, readStages,
           violations, tidy, log, history, undosLeft }
```

### 여기서 헷갈리는 이름 셋

| 이름 | 실제로 담긴 것 |
|---|---|
| `tube.work` | **누적 원심 일**이다. 시간이 아니다 — 속도의 제곱에 비례해 쌓인다 |
| `rotor.phase` | **마지막으로 당긴 뒤 지난 꼬임 주기 수**다. 0~1 로 감기지 않는다 |
| `rotor.speed` | 0~1 로 **정규화한 값**이다. rpm 이 아니다 |

`tube.seal` 의 두 끝은 `outer`(회전 바깥쪽)와 `inner`(축 쪽)다. **위·아래가 아니다** —
회전판은 모세관을 수평으로 문다.

## 파생값 — 저장하지 않고 그때그때 계산한다

| 함수 | 무엇 |
|---|---|
| `columnLength(tube)` | 남아 있는 혈액 기둥 (샌 만큼 뺀다) |
| `separation(tube)` | 얼마나 갈렸는가. **응고가 천장을 씌운다** |
| `sharpness(tube)` | 경계의 또렷함. 덜 갈린 것과 흔들려 섞인 것을 **나눠 센다** |
| `imbalanceOf(rotor)` | 한쪽만 넣으면 1, 둘 다면 넣은 깊이의 차 |
| `isClotted(tube)` | 참이면 위층의 이름이 **혈청**으로 바뀐다 |
| `rhythmQuality(rotor)` | 당긴 것 중 박자가 맞은 몫 |
| `tubeParams(state)` | **결과 그림을 완전히 결정하는 값 한 벌.** 기록(CAPTURE)도 이것을 통째로 담는다 |

`tubeParams` 를 두 벌로 만들지 않는다. 화면이 보는 것과 기록이 담는 것이 갈리면
탐구 노트가 되살리는 그림이 그때 본 것과 달라진다.

## 제출에 나가는 것

`payloadOf()` 는 **허용 목록**이다 (`src/ui/report.js`). 상태에서 나가는 것은 다섯뿐이다 —
`session` 의 `level` · `notes` · `captures` · `violations`, 그리고 학교·모둠 이름.
기구의 마지막 상태도, 무엇을 어떤 차례로 눌렀는지(`log`)도 나가지 않는다.
`tests/privacy.test.js` 가 **양방향으로** 지킨다 (빠진 것도, 군더더기도 없는지).
