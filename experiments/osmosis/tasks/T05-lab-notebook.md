# T05 · 탐구 노트

## 목표

7단계 뼈대(문제 인식 · 준비물 · 예상 · 탐구 과정 · 결과 · 정리 · 자기 평가)는 그대로 쓰고,
내용을 이 실험 것으로 갈아 끼운다. `progress.js` 의 **"실제로 했는가" 판정표**도 함께.

## 먼저 읽을 것

- `docs/06-lab-notebook.md`
- `NEW-EXPERIMENT.md` §3.6 · §7 (5·6·7번 함정)
- `PLAYBOOK.md` §9-1 — 7단계를 조작 절차로 납작하게 만들지 마라

## 건드릴 파일

```
src/ui/strings.js       UI.protocol · materials · predictOptions · q2Label · q3Label
src/ui/notebook.js      이 실험에 없는 절만
src/sim/progress.js     STEP_DONE — 절차의 세부 단계마다 실제로 했는가
tests/progress.test.js
tests/report.test.js    절차 단계 키가 바뀌므로 여기가 먼저 빨간불이 된다. 버그가 아니다
```

## 이 실험의 탐구 질문

> 세포를 서로 다른 농도의 설탕 용액에 넣으면 어떻게 될까?
> **어느 농도에서 세포의 절반이 원형질 분리를 일으킬까?**

두 번째 질문이 이 실험을 정량 탐구로 만든다.

## 하지 말 것

- **화면이 채점하는 답을 먼저 적어 두기.** 세포액 농도를 추정하는 것이 이 탐구인데
  화면 어딘가에 그 숫자가 적혀 있으면 탐구가 사라진다
- **같은 예시 문구를 여러 칸에 걸기.** 학생은 그 한 문장을 베낀다
  (`tests/ui.contract.test.js` 가 잡는다)
- **빈칸에 첨삭 띄우기.** 쓰기도 전에 부족하다는 말부터 듣는다
- 이름 · 학번 · 학교를 묻는 칸 만들기 (`tests/report.test.js` 가 잡는다)

## 합격 기준

- [ ] `UI.protocol` 의 세부 단계와 `STEP_DONE` 의 판정 함수가 **한 칸씩 짝**을 이룬다
      (`tests/progress.test.js` 가 개수를 맞춰 본다)
- [ ] 실험대에 손도 안 대고 노트를 채워도 "아직" 으로 표시된다 (막지는 않는다)
- [ ] 예시 문구가 칸마다 전부 다르다
- [ ] `selfEvalItems` · `reflectionItems` 는 손대지 않았다 (실험과 무관하다)
- [ ] 「결과」에 기록한 시야가 되살아난다

## 검증

```bash
npm run check
npm run dev   →   탐구 노트를 처음부터 끝까지 채워 본다
```
