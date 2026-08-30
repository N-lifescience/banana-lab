# T05 — 탐구 노트 7단계 · 절차 판정표

7단계 뼈대(문제 인식·준비물·예상·탐구 과정·결과·정리·자기 평가)는 그대로 쓴다.
`src/ui/strings.js` 를 갈아 끼우면 대부분 따라온다.

## `strings.js` 에서 손볼 것

- `appTitle`(T00 에서 이미) · `start.levels`
- `bench.items` · `bench.shortNames` · `bench.hints` — 물건 이름과 난이도별 안내
- `protocol` — STEP 과 세부 단계. **예시 문구는 칸마다 전부 달라야 한다**
  (`tests/ui.contract.test.js` 가 겹침을 잡는다)
- `notebook.materials` — 준비물 표. 그림은 실험대와 **같은 애셋**을 쓴다
- `notebook.problem` — 「발아 중인 콩과 마른 콩은 무엇이 다를까?」 계열
- `notebook.predictOptions` · `predictWhyPlaceholder` · `predictFreePlaceholder`
  — **챔버마다 다른** 예시 문구
- `notebook.q2Label` · `q3Label` — 정리 서술형
- `toast.nextAction` — tag 별 「다음 행동」

`selfEvalItems`(리커트 5점)와 `reflectionItems`(느낀 점)는 실험과 무관하다. **그대로 둔다.**

## 절차 (`protocol`) 초안

1. 챔버 두 개 준비 — 씻어서 말린 챔버, 어느 쪽이 무엇인지 정하기
2. 콩 담기 — 발아 콩과 마른 콩을 **같은 숟갈 수**로
3. BTB 용액 넣기 — 두 챔버에 같이
4. 센서 꽂기 — **콩에 닿지 않게**
5. 밀봉하고 측정 시작
6. 시간 경과 관찰 — BTB 색과 온도계, 그래프

## `src/sim/progress.js`

`UI.protocol` 의 세부 단계와 **한 칸씩 짝**을 이룬다. 상태만 보고 「실제로 했는가」를 판정한다.
표시일 뿐 잠금이 아니다 — 안 한 단계의 칸도 그대로 열려 있다.

`tests/progress.test.js` 가 개수를 맞춰 본다.

## 화면이 답을 먼저 말하지 않게

- 챔버 이름에 「발아 콩」·「마른 콩」을 **미리 박아 두지 않는다.** 무엇을 넣을지는 학생이 정한다
- 예상 문항 위에 결과를 적어 두지 않는다
- 준비물 표의 `role` 에 「CO₂ 가 늘면 노래집니다」까지 적으면 예상할 것이 없어진다.
  「기체의 변화를 색으로 보여 줍니다」까지만 적는다

## 합격 기준

- [ ] `npm run check` 통과 (`ui.contract` · `progress` · `report` 포함)
- [ ] 예시 문구가 세부 단계마다 전부 다르다
- [ ] 탐구 노트 1~4 쪽을 읽어야 실험대가 열린다 (`bench.lock.required`)
- [ ] 준비물 표의 그림이 실험대의 그림과 같다

## 검증

```bash
npm run check
node --test tests/progress.test.js tests/ui.contract.test.js
```
