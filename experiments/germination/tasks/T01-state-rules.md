# T01 — 상태 모델 · 대사 모형 · 규칙 엔진

화면 없이 규칙부터 짠다. 여기가 흔들리면 전부 흔들린다.

## 이 실험이 무엇인가

바이오챔버 **두 개**를 나란히 놓고, 한쪽에는 발아 중인 콩을, 다른 쪽에는 마른 콩을
**같은 양** 넣는다. CO₂·온도 센서를 콩에 닿지 않게 꽂고, 밀봉하고, 시간이 지나는 것을 본다.
발아 콩 쪽은 세포호흡이 활발해 CO₂ 가 늘고 온도가 오른다. 마른 콩 쪽은 거의 그대로다.

**조작변인은 콩의 상태(발아/마른) 하나뿐이다.** 나머지(양·BTB·밀봉·센서 위치)는 전부
통제변인이고, 두 챔버에서 **같아야** 비교가 성립한다. 그것이 이 실험이 가르치는 것이다.

## 만들 파일

### `src/sim/metabolism.js` — 이 실험의 물리

**상수의 출처를 갈라 적는다.** 섞어 읽으면 안 된다 (catalase-lab `kinetics.js` 의 본을 따른다).

```
[사실]   자료에서 온 값. 바꾸려면 사람에게 묻는다
[모형] [확인 필요]   순서와 배율을 재현하려고 고른 계수. 실측값이 아니다
```

- `[사실]` 대기 중 CO₂ 농도(약 420 ppm) · 실온 20 ℃ ·
  BTB 는 CO₂ 가 녹아 산성이 되면 파랑 → 녹색 → 노랑
- `[모형] [확인 필요]` 발아 콩 한 숟갈의 CO₂ 발생 속도 · 마른 콩의 비율 ·
  밀봉하지 않았을 때 새는 시간 상수 · 온도 상승 폭 · 관찰 시간
- **콩의 양을 g 으로, 챔버 부피를 mL 로 적지 않는다.** 확인된 값이 아니다.
  양은 **숟갈 수**로만 다룬다.

순수 함수여야 한다 — `document`·`window`·`Date.now()`·`Math.random()` 금지.
난수는 `seed` 로 받는다 (센서를 콩에 파묻었을 때 튀는 신호가 필요하다).

### `src/sim/state.js`

- `CHAMBERS = ['L', 'R']`
- 챔버 하나: `{ beans, scoops, btb, sensor, sealed, running, elapsedMin, samples }`
  - `sensor` 는 `'none' | 'clear' | 'buried'` — 콩에 닿았는가
  - `samples` 는 `[{ min, co2Ppm, tempC }]` — TICK 이 그때 조건으로 계산해 쌓는다.
    **쌓고 나서 조건을 바꿔도 이미 쌓인 것은 그대로다** (catalase 의 `runConditions` 와 같은 이유)
- `mismatches(state)` — 두 챔버에서 **어긋난 통제변인의 목록**.
  막는 데 쓰지 않는다. 그래프와 결과 카드가 이 목록을 읽어 이름으로 말한다.

### `src/sim/rules.js`

액션마다 함수 하나. `reduce(state, action) → { state, outcome, message, tag }`.

| 액션 | 무엇 | 잘못했을 때 무엇이 답하는가 |
|---|---|---|
| `SCOOP_BEANS {kind}` | 숟가락에 콩을 담는다 | — |
| `POUR_BEANS {chamber}` | 숟가락 → 챔버 | 두 종류를 섞으면 `happened` 로 알린다. 막지 않는다 |
| `POUR_BTB {chamber}` | BTB 용액 → 챔버 | 안 넣으면 색이 안 보인다. 그래프만 남는다 |
| `SET_SENSOR_DEPTH {chamber, depth}` | 센서 깊이 | 콩에 닿으면 `buried` — 신호가 튄다 |
| `REMOVE_SENSOR {chamber}` | 되돌아갈 길 | |
| `SEAL {chamber}` / `UNSEAL {chamber}` | 뚜껑 | 안 닫으면 CO₂ 가 샌다 |
| `START {chamber}` / `STOP {chamber}` | 측정 | |
| `TICK {minutes}` | 시간 경과 | 돌고 있는 챔버에만 |
| `EMPTY_CHAMBER {chamber}` | 개수대에서 비운다 | **막다른 길을 만들지 않는다** |
| 안전 · 정리 · 노트 · 되돌리기 | 바나나랩 것을 그대로 | |

**하드 게이트는 두 종류뿐이다.**
- 「닫힌 뚜껑 안으로 콩을 넣기」 = `IMPOSSIBLE` — **빠져나갈 길을 문장에 담는다**:
  「뚜껑을 열고 넣으세요」가 아니라 어디를 눌러 여는지까지 말한다.
- 기구 파손은 이 실험에 없다. 억지로 만들지 않는다.

## 합격 기준

- [ ] `src/sim/` 어디에도 `document`·`window`·`Date.now`·`Math.random` 이 없다
- [ ] 모든 액션을 여러 상태에서 돌려 `blocked` 가 나오면 사유가 허용된 둘 중 하나다
- [ ] `blocked` 메시지에 **다음에 어디를 눌러야 하는지**가 들어 있다
- [ ] 같은 상태 · 같은 시드면 `metabolism` 이 같은 값을 낸다
- [ ] 발아 콩 쪽이 마른 콩 쪽보다 CO₂ 도 온도도 크게 오른다
- [ ] 밀봉하지 않으면 변화가 약하고 이내 평평해진다
- [ ] 콩을 안 넣은 챔버는 대기 농도에서 움직이지 않는다

## 검증

```bash
npm run check
node --test tests/rules.test.js tests/metabolism.test.js
```
