# T02 — 애셋 넷을 이 실험 것으로

## 그대로 쓰는 것

`bench` · `bottle` · `sink` · `waste` · `bin` · `tissue`.
`bottle` 만 `kind: 'BTB'` 갈래와 라벨을 더한다.

## 빼는 것

`banana` · `slide` · `coverslip` · `coverbox` · `slidebox` · `dropper` · `forceps` ·
`microscope` · `dish`. `src/assets/index.js` 등록과 `CONTRACT`·`CONTENT_BOX` 에서 함께 뺀다 —
안 빼면 아트 시트와 린터가 계속 남의 그림을 검사한다.

## 새로 그리는 것 넷

| 이름 | 실물 긴 변 | 상태 | 무엇 |
|---|---|---|---|
| `chamber` | `[확인 필요]` — 아래 참조 | `beans` `scoops` `btb` `sensor` `sealed` | 바이오챔버 (실험대 토큰) |
| `sensor` | `[확인 필요]` | `on` `linked` | 무선 CO₂·온도 센서 막대 |
| `beanjar` | `[확인 필요]` | `kind`(`sprout`\|`dry`) `level` | 콩 통. 한 애셋에 두 갈래 |
| `scoop` | `[확인 필요]` | `holds`(`null`\|`sprout`\|`dry`) | 계량 숟가락 |

**실물 치수를 지어내지 않는다.** 확인되지 않은 것은 `realSizeMm` 옆에 `[확인 필요]` 주석을
달고, 실험대에서 서로 겹치지 않을 만한 값을 **잠정값이라고 밝혀** 둔다.

## 색

BTB 색은 이 실험 고유의 반응색이다 — `src/style/palette.experiment.js` 의 `EXP_PALETTE` 에만
넣는다. `tokens.js` 는 수정하지 않는다.

```
btbBlue   BTB 원래 색 (염기성)
btbGreen  중간
btbYellow CO₂ 가 늘어 산성이 된 색
```

**반응색을 기구에 쓰지 않는다.** 챔버 몸통은 `glass`, 뚜껑은 `bodyDark`, 센서는 `metal` 이다.

## 서브에이전트로 돌릴 때

`docs/banana-tasks/T02-PROMPT.md` 의 형식을 그대로 베낀다. 반드시 넣을 것:

- 읽을 파일을 **여섯 개로 제한**한다
- **`src/render/` 는 읽히지 않는다** — 아트 디렉션 예외라 따라 쓰면 애셋이 오염된다
- 완료 조건은 `npm run check:art -- <이름>` (등록 없이 단일 애셋만 검사된다)
- 하네스 애셋 시트에서 **옆 칸과 견주며** 고치라고 명시한다

## 합격 기준

- [ ] `npm run check:art` 위반 0건
- [ ] `/harness.html` 애셋 시트에 넷이 나오고, 선 두께·음영 방향이 옆 칸과 같다
- [ ] 챔버의 `sealed`·`sensor`·`btb` 가 **눈으로 갈린다** (린터는 색과 두께만 본다)
- [ ] `tests/bench.test.js` — 실험대 위 물건이 서로 겹치지 않는다

## 되돌려 보기

`EXP_PALETTE` 에 없는 색(예: `#FF00FF`)을 챔버에 넣어 **린터가 실제로 잡는지** 본다.
잡은 뒤 되돌린다. **되돌리기 전에 먼저 커밋한다.**

---

## 애셋별 형태 요점 — **에이전트가 읽는 표**

전 애셋 공통: `viewBox="0 0 400 300"` · 광원 좌상단 45° · 음영은 형태의 **우하단** ·
선은 `INK` 하나 · 두께는 `STROKE.outline(3) / detail(2) / hair(1.5)` 셋뿐 ·
그라데이션·필터·블러 금지 · `Math.random()` 금지(난수는 `geometry.js` 의 `rng(seed)`).

### `chamber` — 바이오챔버 (이 실험의 몸통)

**정면에서 본 투명한 통.** 뚜껑이 위에 있고, 안이 들여다보인다.
결과 화면이 이 그림을 그대로 크게 키워 쓰므로, **상태가 눈에 보이는 것이 전부다.**

| 노드 | 무엇 | 상태로 어떻게 달라지나 |
|---|---|---|
| `#jar` · `#jar-shade` | 통 몸통. `glass` | — |
| `#lid` | 뚜껑. `bodyDark` | 열면 **비스듬히 들린다** (`transform`) |
| `#seal` | 밀봉 테. `metal` | 밀봉했을 때만 보인다 (`opacity`) |
| `#dish` | 바닥의 얕은 접시. `glass` | — |
| `#btb` | 접시에 담긴 BTB 용액 | `btbBlue`/`btbGreen`/`btbYellow` · 안 넣었으면 `opacity 0` |
| `#beans` | 콩 알갱이 | 숟갈 수만큼 **바닥부터 쌓인다.** 발아 콩은 `beanSprout` + `beanSproutTip` 흰 싹, 마른 콩은 `beanDry` 이고 싹이 없다 |
| `#sensor` | 꽂힌 센서 막대. `metal` | 안 꽂았으면 `opacity 0` · 깊이는 `transform` 으로 위아래 |
| `#thermo` · `#thermo-fill` | 통 안쪽에 붙은 온도계 | 눈금과 함께. `#thermo-fill` 은 `y`/`height` 로 오르내린다 |

**꼭 지킬 것**
- 발아 콩과 마른 콩이 **한눈에 갈려야 한다.** 흰 싹이 그 차이를 만든다
- BTB 세 단계가 **명도까지 달라야 한다.** 색으로만 가르면 색각 이상이 있으면 같아 보인다
- 뚜껑이 **열림/닫힘/밀봉** 셋으로 읽혀야 한다
- 온도계 눈금은 **읽으라는 것이 아니라 높이를 견주라는 것**이다. 숫자를 넣지 않는다

### `sensor` — 무선 CO₂·온도 센서

**세로로 선 막대.** 위쪽이 몸체(표시등이 있다), 아래로 가느다란 탐침이 뻗는다.
`#body`(`bodyDark`) · `#body-shade` · `#probe`(`metal`) · `#led`(`lamp`, 꺼지면 `opacity` 낮게) ·
`#fouling`(끝에 묻은 콩 부스러기, `beanSprout` 음영색, 닦으면 `opacity 0`).

### `beanjar` — 콩 통 (한 애셋으로 두 갈래)

**뚜껑 달린 넓은 통.** `kind` 가 `'sprout'` 이면 흰 싹이 난 콩, `'dry'` 면 갈색 콩.
`#label-text` 에 무엇이 든 통인지 **글자로도** 밝힌다 — 색으로만 가르지 않는다.
`#lid` 는 `capOpen` 일 때 비스듬히 들린다 (마개를 닫는 정리 동작이 눈에 보여야 한다).

### `scoop` — 계량 숟가락

**옆에서 본 숟가락.** 손잡이(`metal`)가 오른쪽 위로, 오목한 부분이 왼쪽 아래.
`#load` 에 담긴 콩을 넣는다 — 비었으면 `opacity 0`.
**이 실험에서 양을 정하는 유일한 손**이라, 담겼는지 비었는지가 멀리서도 보여야 한다.

## 색

기구 색은 `tokens.js` 의 공용 `PALETTE` 를 `paint()` 로 쓴다.
**이 실험의 색**(BTB 세 단계 · 콩 두 갈래)은 `src/style/palette.experiment.js` 의
`EXP_PALETTE` 를 `paintExp()` 로 쓴다. **`tokens.js` 를 수정하지 않는다.**

```js
import { paint, INK, STROKE, PATH_ATTRS } from '../style/tokens.js';
import { paintExp } from '../style/palette.experiment.js';
// <path ${paintExp('btbYellow', { shade: true })} d="..."/>
```
