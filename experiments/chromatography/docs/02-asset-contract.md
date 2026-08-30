# 02 · 애셋 계약

## 층을 셋으로 나눈다

| 층 | 무엇 | 누가 만드나 | 어디에 |
|---|---|---|---|
| **형태** | SVG 패스 데이터 | 일러스트레이터 또는 애셋 라이브러리 | `src/assets/*.js` |
| **스타일** | 색·선 두께·명암 단계 | 아트 디렉션 (01번 문서) | `src/style/tokens.js` |
| **상태** | 어느 노드의 어느 속성을 어떤 값으로 | 코드 | `src/assets/contract.js` |

**코드는 패스를 만들지 않는다. 이미 있는 노드의 속성을 바꾼다.**
이 경계를 지키면 나중에 그림을 통째로 교체해도 로직은 한 줄도 고치지 않는다.

```js
// ❌ 코드가 형태를 만든다
function drawSlide(state) { return `<path d="M60,92 h272 ..."/>` }

// ✅ 형태는 애셋에서 오고, 코드는 계약된 노드만 건드린다
setAttr(root, 'slide', '#smear', 'fill', stainColor(state));
```

## 계약 읽는 법

`src/assets/contract.js` 에 애셋마다 이렇게 적혀 있다.

```js
slide: {
  file: 'slide.js',
  realSizeMm: 76,
  viewBox: '0 0 400 300',
  states: ['sample', 'stain', 'reaction', 'coverslip', 'bubbles'],
  nodes: {
    '#smear':     { required: true, mutable: ['fill', 'fill-opacity', 'transform'] },
    '#coverslip': { required: true, mutable: ['transform', 'opacity'] },
    '#bubbles':   { required: true, mutable: ['children'] },
  },
}
```

- `required: true` — 이 id를 가진 요소가 **정확히 하나** 있어야 한다. 린터가 센다.
- `mutable` — 코드가 상태에 따라 바꿔도 되는 속성. 여기 없는 속성을 바꾸려 하면 `setAttr` 이 던진다.
- `'children'` — 그 그룹 안에 도형을 주입해도 된다는 뜻 (기포 n개, 반점 n개).

## realSizeMm — 크기는 애셋 밖에서 맞춘다

**애셋은 저마다 프레임을 꽉 채워 그린다.** 단독 아이콘이나 버튼으로 쓸 때 그래야 하기 때문이다.
그 결과 자(실물 300 mm)와 바이알(실물 60 mm)이 프레임 안에서는 비슷한 크기로 그려져 있다.
**그린 크기끼리 비교하면 안 된다.** 크기 감각은 애셋 안이 아니라 배치할 때 맞춘다.

`realSizeMm` 은 **실물의 가장 긴 변**(mm)이다. 세로로 긴 물체는 높이, 가로로 긴 물체는 폭이다.
여러 애셋을 실험대에 함께 놓을 때는 이 값에 비례해 화면 크기를 정한다.

| 애셋 | realSizeMm | 근거 |
|---|---|---|
| `leaf` | 120 | **[확인 필요]** 시금치 잎 한 장의 길이 |
| `tube` | 115 | **[확인 필요]** 원심관 길이. 몇 mL 관인지 출처에 없다 |
| `paper` | 100 | 2 × 10 cm 의 긴 변. 국내 상용 규격 20 × 400 mm 에서 잘라 쓴다 |
| `paperbox` | 130 | **[확인 필요]** 스트립을 담는 통 |
| `capillary` | 75 | **[확인 필요]** 모세관 길이 |
| `vial` | 60 | **[확인 필요]** 바이알 높이 |
| `pencil` | 175 | **[확인 필요]** 연필 한 자루 |
| `ruler` | 300 | **[확인 필요]** 학생용 자 |
| `bottle` | 105 | **[확인 필요]** 100 mL 시약병, 마개 포함 |
| `dish` | 90 | 페트리 접시 표준 지름 |
| `waste` | 250 | 실험대용 폐액통 높이 |
| `tissue` | 215 | 킴와이프스 박스 긴 변 (117 은 폭이라 규약에 맞지 않는다) |
| `bench` | 1500 | 학교 실험대 폭 |

린터는 **선언 여부만** 검사한다. 값이 실물과 맞는지는 기계가 판정할 수 없으니 사람이 본다.

## 새 애셋 만드는 순서

1. `contract.js` 에 노드 목록과 `realSizeMm` 을 **먼저** 선언한다
2. `src/assets/<name>.js` 에 `render()` / `applyState()` / `NODES` 를 만든다
3. `src/assets/index.js` 의 `ASSETS` 에 등록하고 `PENDING` 에서 지운다
4. `SAMPLE_STATES[name]` 에 대표 상태를 3~4개 넣는다 — 린터가 이 상태들로 검사한다
5. `npm run check` 통과 확인

## id 명명 규약

- 소문자 케밥 케이스. `#peel-shade`, `#objective-40`
- 음영 도형은 `-shade` 접미사. `#glass` / `#glass-shade`
- 주입 대상 그룹은 복수형. `#bubbles`, `#spots`, `#contents`
- 상태에 따라 회전·이동하는 부품은 그 부품 이름 그대로. `#cap`, `#knob-coarse`

## 결정론

애셋에 난수가 들어가면(반점 위치 등) 반드시 `geometry.js` 의 `rng(seed)` 를 쓴다.
`Math.random()` 금지. 이유:

- 결과 보드가 이미지 대신 **시드만 저장**할 수 있다 (07번 문서)
- 같은 학생이 다시 열어도 같은 그림이 나온다
- 테스트가 가능하다 (`tests/assets.contract.test.js`)

## 외부 그림으로 교체할 때

나중에 일러스트레이터에게 발주하거나 애셋 라이브러리에서 가져오는 경우,
전달할 사양은 이 문서 그대로다. 추가로 요구할 것:

- 레이어를 위 id 규약대로 명명, 각각 **독립 패스**로 분리
- 그룹 변환(transform) 없이 절대 좌표로 저장
- viewBox 는 계약에 선언된 값
- 색은 `PALETTE` 값 그대로, 선은 `INK` 3 px

받은 SVG를 `render()` 가 문자열로 돌려주도록 감싸기만 하면 교체가 끝난다.
**상태 코드와 결과 렌더러는 손대지 않는다.**

## 프레임 바닥에 발을 붙인다

실험대는 프레임의 **아래**를 선반·작업면에 맞춘다. 그림이 프레임 가운데에 있으면
물건이 허공에 뜬 채로 놓이는데, **그림만 보면 멀쩡해 보인다.**
연필과 자가 실제로 8 cm 떠 있었고, `scripts/check-bench.mjs` 로 실험대를 띄우기 전에는
아무도 몰랐다.

## `CONTENT_BOX` 는 손으로 계산하지 않는다

이 실험에서는 패스 좌표를 보고 손으로 계산했다가 **다섯 군데가 틀렸다.**
`scripts/check-bench.mjs` 가 브라우저에서 `getBBox()` 로 재어 어긋난 곳을 전부 알려 준다.
**그 검사가 다른 값을 말하면 검사 쪽이 맞다.**

## 애셋 안의 id 는 문서 전체에 올라온다

애셋은 인라인 SVG 라 `<rect id="sheet">` 같은 id 가 페이지의 id 공간에 그대로 들어간다.
화면 쪽에서 같은 이름을 쓰면 `querySelector` 가 애셋을 집고, `<label for="…">` 는
애셋의 도형을 가리킨다. 둘 다 **콘솔 에러 없이** 틀린다.
`tests/dom-ids.test.js` 가 지킨다 — 실제로 두 번 물렸다.
