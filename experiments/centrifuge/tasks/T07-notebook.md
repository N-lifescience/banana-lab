# T07 — 탐구 노트 7단계 · 절차 판정 · 문자열

`src/ui/strings.js` · `src/ui/notebook.js` · `src/sim/progress.js`

7단계 뼈대(문제 인식 · 준비물 · 예상 · 탐구 과정 · 결과 · 정리 · 자기 평가)는 그대로.

- `notebook.protocol` 의 **예시 문구는 칸마다 전부 달라야 한다.** 학생은 한 문장을 베낀다.
- 화면이 **채점하는 답을 먼저 적어 두지 않는다** — 헤마토크릿 값을 묻는 칸 위에
  적혈구층 비율을 적어 두면 안 된다.
- `progress.js` 는 세부 단계마다 「실제로 했는가」를 본다. 표시이지 잠금이 아니다.

## 검증

```bash
npm run check
node --test tests/progress.test.js
```
