# T01 · 상태 머신 완성

## 목표

UI 없이 상태 머신만으로 실험의 정상 경로와 **모든 실패 경로**를 통과시킨다.
`src/sim/` 에 뼈대가 있으니 빠진 액션을 채우고 테스트를 늘린다.

## 먼저 읽을 것

- `AGENTS.md` §2.1 — 강제하지 말고 결과로 답한다
- `docs/03-state-model.md`
- `docs/04-interaction-rules.md` — **규칙표 전체**

## 건드릴 파일

```
src/sim/state.js
src/sim/rules.js
src/sim/quality.js
tests/rules.test.js
```

## 할 일

1. `docs/04` 규칙표의 R-01 ~ R-15 가 모두 `ACTIONS` 에 있는지 확인하고 빠진 것을 채운다
2. 아직 없는 액션을 추가한다
   - `WASH_HANDS`, `CLOSE_CAP`, `DISPOSE_WASTE` — 안전 규칙 관련
   - `UNDO` — 난이도별 되돌리기 횟수 제한 (1단계 무제한 · 2단계 3회 · 3단계 1회)
   - `SAVE_NOTE` — 세부 단계별 관찰 기록
3. `session.log` 를 되돌아보기에 쓸 수 있게 타임스탬프 대신 순번을 넣는다
   (`Date.now()` 를 쓰면 테스트가 비결정적이 된다)
4. 정상 경로 전체를 한 번에 도는 통합 테스트를 추가한다
   껍질 → 도포 ×3 → 아이오딘 → 세척 → 수단 → 덮개 ×3 → 저배율 초점 → 400배 → 캡처 ×3

## 하지 말 것

- `blocked` 를 새로 추가하지 말 것. `BLOCKING_REASONS` 두 가지 외에는 `blocked()` 가 던진다
- `src/sim/` 안에서 `document`, `window`, `Date.now()`, `Math.random()` 을 쓰지 말 것
- `reduce` 안에서 원본 상태를 변형하지 말 것 (테스트가 잡는다)

## 합격 기준

- [ ] `docs/04` 규칙표의 모든 행이 액션으로 존재한다
- [ ] 정상 경로 통합 테스트가 캡처 3장으로 끝난다
- [ ] 각 실패 경로마다 최소 1개 테스트가 있고, `outcome`과 `tag`를 검증한다
- [ ] 「하드 게이트는 두 종류뿐이다」 테스트가 통과한다
- [ ] `reduce` 순수성 테스트가 통과한다
- [ ] 난이도별 되돌리기 횟수가 동작한다

## 검증

```bash
npm run test
```
