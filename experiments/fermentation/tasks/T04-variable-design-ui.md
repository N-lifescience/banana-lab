# T04 — 변인 설계 UI

## 목표
조작변인 · 통제변인 · 종속변인을 고르는 화면. **catalase-lab 과 같은 손짓이어야 한다** —
학생이 두 실험을 오갈 때 같은 동작이 같은 뜻이어야 한다.

## 지킬 것
- 이 파일에 **이 실험의 말이 하나도 없다.** 변인 목록은 `src/sim/state.js`,
  화면에 쓸 말은 `src/ui/strings.js` 에서 온다
- **막지 않는다.** 설계를 안 하고 시작해도, 도중에 바꿔도 그대로 된다. `disabled` 버튼이 없다
- **답을 먼저 말하지 않는다.** 「30 ℃ 가 가장 빠릅니다」 같은 문구를 두지 않는다

## 검증
```bash
node --test tests/design.test.js
node scripts/check-screen.mjs
```
