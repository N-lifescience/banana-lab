# T08 · 보고서

`src/ui/report.js` 는 **거의 그대로 쓴다.** `buildSheet()` 안에서 이 실험에 없는 절만 손본다.

## 갈아 끼울 것

- 결과 카드의 「배율」 → **「용매 전선 높이 · 원점 높이」**
- 시야 그림 자리 → `renderStrip()` (T03). `idPrefix` 를 반드시 넘긴다 —
  한 장에 여러 결과가 실리므로 하드코딩 id 는 **에러 없이 조용히** 틀린다
- 「관찰 조건」 목록 — 찍은 횟수 · 원점 높이 · 전개액 깊이 · 뚜껑 여부 · 전선 높이

## 개인정보 규칙은 **절대 바꾸지 않는다**

이름·학번은 보고서를 만들 때만 받고, `store` 에도 `localStorage` 에도 넣지 않으며,
인쇄가 끝나면 지운다. `tests/report.test.js` 가 소스에서 `dispatch`·`localStorage`·`fetch`
를 막고 있다.

## 미리 알아 둘 것

`tests/report.test.js` 의 고정값이 **바나나의 절차 단계 키**에 매여 있다. T05 에서
절차를 갈아 끼우면 여기가 먼저 빨간불이 된다 — **버그가 아니다.** 함께 고친다.

## 합격 기준

- [ ] `npm run check` 통과 (`tests/report.test.js` 포함)
- [ ] 보고서 한 장에 결과 두 개 이상을 실어도 그림이 서로 간섭하지 않는다
- [ ] 인쇄 미리보기를 실제로 열어 봤다

## 검증 명령

```bash
npm run check
node scripts/check-bench.mjs
```
