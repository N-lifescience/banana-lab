# T36 — 시작 흐름 세 쪽 + 「실제 실험 연습용 모드」

> 사장님 지시 (2026-09-05): 「첫 번째 팝업: 모드 고르기(가상 실험실 / 실제 실험 연습용).
> 두 번째: 가상 실험실이면 단계·혼자/모둠(기본 혼자), 연습용이면 바로 실험대·1단계·피드백 노트.
> 세 번째: 모둠이면 모둠명·구성·모둠장·모둠원.」

## 시작 화면 (`packages/lab-kit/ui/start.js`)

1쪽 용도 → 2쪽 단계·방식(기본 **혼자**) → 3쪽 모둠 짜기(모둠일 때만). 연습용은 1쪽에서 바로 `onStart(1, 'solo', null, { practice: true })`.
주소로 단계·모둠이 정해진 링크는 3쪽만(`lock`), `?mode=solo` 링크는 그대로 건너뛴다.

## 연습 모드 (`packages/lab-kit/practice/`)

- `feedback.js` — 순수. 토스트와 **같은 자리**(`createStore` 의 `onMessage`)에서 뜻대로 안 된 것(`happened`·`blocked`)과
  고칠 것이 있는 것(`ok` + `UI.toast.nextAction[tag]`)을 모은다. 같은 것은 횟수만. 막지 않는다.
- `panel.js` — 노트 머리의 연습 칸(최근 5개 + 「피드백 노트 PDF」), 보고서 단추 숨김, 피드백 노트 대화상자·종이.
  이름·학번은 이 창에서만, `afterprint` 에 지운다 — `report.js` 규칙 그대로. `tests/practice.test.js` 가 소스를 본다.
- 종이: 잘 안 된 것(무엇이·횟수·다음엔 이렇게) → 실제 실험에서 이렇게(☐ 조언 목록) → 내가 꼭 지킬 것(학생이 적음).

## 합격 기준

- [x] `node --test tests/practice.test.js`
- [x] `npm run check`
- [x] `node scripts/check-group.mjs <실험>` — 여덟 실험 30/30 (기본 혼자 · 연습 모드 흐름 포함)
