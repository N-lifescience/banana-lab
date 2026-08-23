# 03 · 상태 모델

`src/sim/state.js` 가 구현이고 이 문서는 설명이다. 값이 어긋나면 코드가 맞다.

## 원칙

- 단일 `state` 객체에 전부 담는다
- 변경은 `reduce(state, action)` 만 거친다. **부수효과 없음, 원본 불변**
- `src/sim/` 안에서 `document` / `window` 를 참조하지 않는다 — 그래야 `node --test` 로 검증된다
- 저장할 값과 계산할 값을 구분한다. 파생값은 저장하지 않는다

## 스키마

```
slides: { A, B, C }          # (가) 대조군 · (나) 아이오딘 · (다) 수단 Ⅲ
  sample        null | { thickness 0~1, area 0~1 }
  stain         null | 'IKI' | 'SUDAN3'
  drops         0~n          # 검사하지 않는다. 몇 방울이든 받는다
  reactionT     0~1          # 색 변화 진행도
  coverslip     { placed, angleAtDrop, bubbles }
  contaminated  bool         # 씻지 않은 스포이트
  cracked       bool         # 고배율 조동나사로 파손
  lensTouched   bool         # 덮개 유리 없이 고배율
  seed          int          # 시야 재현용. 절대 Math.random() 으로 대체하지 말 것

microscope
  stage         null | 'A'|'B'|'C'
  objective     4 | 10 | 40
  coarse        -1 ~ 1
  fine          -0.2 ~ 0.2
  diaphragm     0 ~ 1
  lamp          bool
  lowMagFocused bool         # 저배율에서 초점을 맞춘 적이 있는가 (막지 않고 기록만)

tools
  dropper  { holds, level, rinsed }
  forceps  { holding }
  banana   { peeled, ripe, fleshLeft }

session
  level, seed, step
  notes      { '3b': '관찰 기록…' }
  captures   [ { slide, objective, reagent, drops, seed, focusErr, bubbles, … } ]
  violations [ 'cap-left-open', … ]   # 감점하지 않고 자기 평가에 보여만 준다
  log        [ { at, action, outcome, tag } ]   # at 은 순번. Date.now() 를 쓰면 테스트가 비결정적이 된다
  history    [ state, … ]             # 되돌리기용 스냅샷, 최대 20개
  undosLeft  int                      # 1단계 Infinity · 2단계 3 · 3단계 1
```

`history` 는 **세션 안에서만 쓴다.** `captures` 나 제출 데이터에 절대 넣지 않는다.
스냅샷은 `history` 를 비운 채로 담는다 — 안 그러면 상태가 지수적으로 커진다.

## 파생값 — 저장하지 않는다

| 함수 | 계산 |
|---|---|
| `focusError(m)` | `\|coarse + fine\|` |
| `brightness(m)` | `diaphragm × 배율 패널티` (40배 0.45 · 10배 0.75 · 4배 1) |
| `coverage(slide)` | `min(drops / 2, 1)` |
| `excess(slide)` | `clamp((drops − 2) / 3, 0, 1)` |
| `isFloating(slide)` | `excess > 0.6` |
| `isTooThick(slide)` | `sample.thickness > 0.6` |

## fieldParams()

시야 렌더러에 넘기는 뷰. **이 객체가 시야 그림을 완전히 결정한다.**
결과 보드에 저장하는 것도 이 값들이다 — 이미지가 아니라.

```js
{ reagent, coverage, excess, floating, tooThick, contaminated,
  bubbles, cracked, lensTouched, objective, focusErr, brightness, seed }
```

40바이트 남짓이면 어느 기기에서든 같은 그림이 재생성된다.
