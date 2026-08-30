# T07 · 보고서

## 목표

보고서를 이 실험 것으로 맞춘다. 뼈대는 거의 그대로 쓴다.

## 먼저 읽을 것

- `NEW-EXPERIMENT.md` §3.7
- `PLAYBOOK.md` §7 — 개인정보

## 건드릴 파일

```
src/ui/report.js        buildSheet() 안에서 이 실험에 없는 절만
src/ui/strings.js       report.*
tests/report.test.js
```

## 이 실험에 새로 필요한 것

- 농도별 기록 표 — 농도 · 원형질분리 세포 비율 · 시야
- 「절반이 원형질 분리를 일으킨 농도」를 학생이 **스스로 읽어 적는** 칸
  (**화면이 계산해 주지 않는다.** 계산해 주면 이 탐구가 사라진다)

## 하지 말 것

- **개인정보 규칙을 바꾸지 말 것.** 이름·학번은 보고서를 만들 때만 받고,
  `store` 에도 `localStorage` 에도 넣지 않으며, 인쇄가 끝나면 지운다.
  `tests/report.test.js` 가 소스에서 `dispatch` · `localStorage` · `fetch` 를 막고 있다

## 합격 기준

- [ ] `npm run check` 통과
- [ ] 인쇄 미리보기에서 표가 잘리지 않는다 (눈)
- [ ] 이름·학번이 어디에도 저장되지 않는다 (테스트)

## 검증

```bash
npm run check
node scripts/check-bench.mjs
```
