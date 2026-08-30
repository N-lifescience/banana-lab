# T03 · 시야 렌더러와 하네스

## 목표

같은 세포가 용액에 따라 **원형질 분리 → 한계원형질분리 → 팽윤** 으로 변하는 것을
현미경 시야로 그린다. 그리고 **하네스를 이 실험 것으로 갈아 끼운다.**

하네스는 이 카드에서 함께 간다. 렌더러가 이 실험 것이 되기 전에 손잡이만 갈아 끼워 봐야
뒤에 아무것도 없기 때문이다. 반대로 여기서 안 하면 그 뒤로 **하네스를 아예 못 쓴다.**

## 먼저 읽을 것

- `AGENTS.md` §2.4 (광학) · §2.5 (**무엇이 보이는가** 표)
- `docs/05-fov-renderer.md`
- `src/sim/osmosis.js` (T01 에서 만든 삼투 모형)

## 건드릴 파일

```
src/render/fov.js
harness.html
src/harness.js
docs/05-fov-renderer.md
tests/fov.test.js
tests/optics.test.js
```

## 시야가 받는 값

`fieldParams(state, slideId)` 가 돌려주는 것 하나로 그림이 **완전히** 정해져야 한다.
같은 값을 주면 같은 그림이 나온다 (난수는 `seed` 로 받는다). 그래야 기록해 둔 시야를
탐구 노트와 보고서에서 되살릴 수 있다.

```
side            'outer' | 'inner'      안쪽이면 색이 없다
conc            0 | 5 | 10 | 15 | 20   지금 덮개 유리 아래 용액의 설탕 %
osmosisT        0~1                    평형까지 얼마나 갔나
exchange        0~1                    치환 진행도 (거름종이)
coverage · excess · tooThick · folded · bubbles · contaminated · cracked · lensTouched
objective · focusErr · brightness · panX · panY · seed
```

## 그림에서 읽혀야 하는 것

- **보라색 영역의 크기 = 원형질체의 크기.** 색소가 액포에 있기 때문이다 (`AGENTS.md` §2.5)
- **세포벽은 그 자리에 그대로 있다.** 수축하는 것은 원형질체다.
  세포벽까지 같이 줄어드는 그림을 그리면 이 실험을 통째로 틀리게 가르친다
- 원형질체와 세포벽 사이의 **틈은 바깥 용액으로 차 있다** (세포벽은 전투과성)
- **한 시야 안에서 세포마다 정도가 갈린다.** 「절반이 원형질분리」 판정이 여기서 나온다
- **터지지 않는다.** 저장액에서는 세포벽까지 꽉 찰 뿐이다
- `side === 'inner'` 면 색이 거의 없다. 윤곽만 희미하게 보인다

## 하지 말 것

- 세포 크기를 "보기 좋게" 키우기 (`tests/optics.test.js` 가 잡는다)
- 세포벽을 함께 수축시키기
- 저장액에서 세포를 터뜨리기
- 렌더러 안에서 `id` 를 하드코딩하기 — 한 화면에 여러 시야를 그리는 순간
  **에러 없이 조용히** 틀린다. `idPrefix` 를 받아 둔다
- `Math.random()` — 같은 상태가 같은 그림을 내야 한다

## 하네스에 붙일 손잡이

바나나 것(익은 정도 · 껍질 벗김 · 방울 수 · 반응 진행도)을 지우고 이 실험 것으로 바꾼다.

- 표피 면 — 바깥 / 안쪽
- 용액 — 증류수 · 설탕 5 · 10 · 15 · 20 %
- 치환 진행도 (거름종이)
- 삼투 진행도
- 표피 두께
- 봉입 방울 수
- 대물렌즈 · 초점 · 조리개 · 재물대 좌우 (그대로)
- 슬라이드 상태 — 금 · 오염 · 기포
- 관찰 가능성 미터 (그대로)
- 애셋 패널은 `banana` 대신 `onion`

## 합격 기준

- [ ] `/harness.html` 이 **콘솔 에러 0건**으로 뜨고 손잡이가 전부 그림을 바꾼다
- [ ] 같은 파라미터를 두 번 주면 **문자열이 같다** (테스트)
- [ ] 설탕 20 % 시야에서 세포벽 좌표가 증류수 시야와 **같다** (테스트로 못 박는다)
- [ ] 증류수 시야에서 터진 세포가 없다
- [ ] `side='inner'` 시야에 액포색이 나오지 않는다 (테스트)
- [ ] `exchange = 0` 이면 용액을 골라도 시야가 안 바뀐다 (테스트)
- [ ] 400배 성능이 바나나랩 기준을 넘지 않는다 (`node scripts/perf-fov.mjs --dom`)

## 검증

```bash
npm run check
npm run dev   →   http://localhost:5173/experiments/osmosis/harness.html
npm run shot -- '#fov-slot' fov-plasmolysis
node scripts/perf-fov.mjs --dom
```
