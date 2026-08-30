# T02 — 애셋

## 목표
이 실험의 기구를 그린다. 라인 + 플랫. 그라데이션·필터·블러 금지, 선 두께 셋, 광원 좌상단 45°.

## 만들 것
`fermtube`(큐네 발효관 — 맹관부·팽대부) · `incubator`(항온기) · `cylinder`(메스실린더) ·
`tuberack`(발효관 걸이). 나머지(`bottle`·`dropper`·`waste`·`bin`·`tissue`·`bench`)는 이웃에서 가져와 쓴다.

## 지킬 것
- 색은 `tokens.js` 의 `PALETTE` + 이 실험의 `src/style/palette.experiment.js` 만
- **반응색을 기구에 쓰지 않는다** — 결과 색과 헷갈린다
- 코드가 패스 좌표를 만들지 않는다. 계약된 노드의 속성만 바꾼다

## 검증
```bash
npm run check:art
npm run dev   # /harness.html 애셋 시트에서 옆 칸과 견준다
```
