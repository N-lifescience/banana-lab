# 03 · 상태 모델

`src/sim/state.js` 가 구현이고 이 문서는 설명이다. 값이 어긋나면 코드가 맞다.

## 원칙

- 단일 `state` 객체에 전부 담는다
- 변경은 `reduce(state, action)` 만 거친다. **부수효과 없음, 원본 불변**
- `src/sim/` 안에서 `document` / `window` 를 참조하지 않는다 — 그래야 `node --test` 로 검증된다
- 저장할 값과 계산할 값을 구분한다. 파생값은 저장하지 않는다

## 스키마

```
tube                        # 원심관 — 색소를 뽑는 곳
  leaf          0~1         # 넣은 잎의 양
  leafFresh     0~1         # 넣은 잎의 신선도. 여러 번 넣으면 양으로 가중해 섞인다
  extract       0~1         # 넣은 추출액 (메탄올:아세톤 = 3:1)
  shaken        0~1         # 흔든 정도
  settleT       0~1         # 층 분리 진행도. 흔들면 0 으로 돌아간다
  drawn         int         # 뽑아 쓴 횟수. 바닥나지 않는다

paper                       # 거름종이 한 장 (2 × 10 cm)
  originMm      null | 2~40 # 원점 선 높이. null 이면 아직 안 그었다
  marker        null|'pencil'|'pen'   # 볼펜이면 잉크가 함께 올라간다
  spots         0~n         # 검사하지 않는다. 몇 번이든 받는다
  spotMm        2~12        # 원점의 지름. 오래 대거나 겹쳐 찍으면 커진다
  spotWet       0~1         # 원점이 아직 젖어 있는가
  load          0~1         # 실린 색소량
  grit          0~1         # 잎 부스러기 오염
  inVial        bool
  runT          int         # 전개 시간 (시뮬레이션 단위). **화면에 시계로 나오지 않는다**
  depthAtRun    mm          # 전개를 시작할 때의 전개액 깊이
  washedOut     0~1         # 원점이 잠겨 씻겨 나간 정도
  lightDose     0~1         # 빛을 쬔 양. **엽록소 두 가지만** 잃는다
  wetness       0~1         # 젖은 정도
  markedFront   null | mm   # 표시해 둔 용매 전선
  markedBands   bool
  rulerPlaced   bool
  torn          bool        # 젖은 채로 자를 대면 — 허용된 하드 게이트 둘 중 하나
  seed          int         # 그림 재현용. 절대 Math.random() 으로 대체하지 말 것

vial                        # 전개조
  depthMm       0~30        # 전개액 깊이. **원점보다 깊으면 잠긴다**
  capped        bool        # 덮으면 용매가 안 날아가고 빛도 안 든다
  hasPaper      bool

tools
  capillary  { strength 0~1, grit 0~1 }   # 머금은 상층액의 진하기와 부스러기
  leafKind   'fresh' | 'wilted'           # 지금 집으려는 잎 — **이것이 변인 하나다**
  papersUsed int

session
  level, seed, mode, step
  notes      { '4b': '관찰 기록…', 'rf.0': '0.9', 'predict': '카로틴' }
  captures   [ { at, ...stripParams } ]
  readStages [ '1', '2', … ]           # 탐구 노트에서 읽은 쪽. 실험대는 1~4 를 읽어야 열린다
  violations [ 'cap-left-open', … ]    # 감점하지 않고 자기 평가에 보여만 준다
  tidy       [ 'hands-unwashed', … ]   # 늦게라도 하면 위반에서 지워진다
  log        [ { at, action, outcome, tag } ]   # at 은 순번. Date.now() 를 쓰면 테스트가 비결정적이 된다
  history    [ state, … ]              # 되돌리기용 스냅샷, 최대 20개
  undosLeft  int                       # 1단계 Infinity · 2단계 3 · 3단계 1
```

`history` 는 **세션 안에서만 쓴다.** `captures` 나 제출 데이터에 절대 넣지 않는다.
스냅샷은 `history` 를 비운 채로 담는다 — 안 그러면 상태가 지수적으로 커진다.

### 무엇을 되돌릴 수 있는가

상태가 바뀌었다고 다 쌓지 않는다. 쌓는 기준은 **학생이 한 조작인가** 다.

| 분류 | 액션 | 왜 |
|---|---|---|
| 쌓지 않음 (`TRANSIENT_ACTIONS`) | `TICK` · `NOTE_VIOLATION` · `CHECK_TIDY` · `MARK_READ` | 시간이 흐르는 것과 노트를 읽는 것은 조작이 아니다 |
| 하나로 합침 (`CONTINUOUS_ACTIONS`) | `SHAKE` · `POUR_SOLVENT` · `SAVE_NOTE` | 한 번 끌면 수십 번 디스패치된다. 되돌리기는 끌기 전으로 돌아가야 한다 |
| 그대로 쌓음 | 나머지 전부 | |

`TICK` 이 1초마다 도는데 이걸 쌓으면 20칸이 20초 만에 다 밀린다.
되돌리기가 1회뿐인 3단계에서는 그 한 번이 `TICK` 을 무르는 데 쓰여 기능이 사라진다.
「시간이 흘러도 되돌리기 기록이 밀리지 않는다」 테스트가 이걸 지킨다.

## 파생값 — 저장하지 않는다

| 함수 | 계산 |
|---|---|
| `extractStrength(tube)` | 잎:추출액 **비율**이 1:1 에 가까울수록 진하다 × 흔든 정도 × 신선도 |
| `isSettled(tube)` | `settleT >= 0.99` |
| `isSubmerged(paper, vial)` | `inVial && vial.depthMm >= originMm` — **이 실험에서 가장 크게 갈리는 한 줄** |
| `currentFrontMm(paper)` | `depthAtRun + K·√runT`, 종이 끝에서 멈춤 |
| `frontOverrun(paper)` | 전선이 종이 끝을 넘어갔는가 |
| `measurableFrontMm(paper)` | 표시해 뒀으면 그 값 · 젖어 있으면 지금 값 · 마르고 표시도 없으면 **null** |
| `pigmentLoad(paper)` | `load × (1 − washedOut)` |
| `chlorophyllKept(paper)` | `1 − lightDose × 0.85` — 엽록소 두 가지에만 걸린다 |

## stripParams()

결과 렌더러에 넘기는 뷰. **이 객체가 거름종이 그림을 완전히 결정한다.**
기록(`CAPTURE`)도 이것을 통째로 담으므로, 탐구 노트가 기록마다 그림을 되살릴 수 있고
결과 보드에 보낼 값도 이것과 같다 — 두 벌을 따로 만들면 어긋난다.

`tests/roadmap.test.js` 가 이 객체의 키 목록을 못 박는다.
**여기에 무언가 더하면 그 검사가 먼저 빨간불이 된다** — 학생을 가리키는 값이
제출 데이터로 새 나가지 않게 하는 자리다.
