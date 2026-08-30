# tasks/ — 이 실험의 작업 카드

번호 순서대로 진행합니다. 카드 하나를 끝낼 때마다 **검증 명령을 실제로 실행해서** 통과를
확인하고 커밋합니다. 카드에 없는 일을 하고 싶으면 먼저 카드를 추가한 뒤 진행합니다.

| 카드 | 무엇 | 검증 명령 |
|---|---|---|
| [T01](T01-rules.md) | 상태 모델 · 전개 물리 · 규칙 엔진 | `npm run check` |
| [T02](T02-assets.md) | 애셋 7종 · 팔레트 · 하네스 갈아 끼우기 | `npm run check:art` |
| [T03](T03-strip-renderer.md) | 결과 렌더러 — 거름종이 위의 색 띠 | `npm run check` · 하네스 눈 |
| [T04](T04-bench-ui.md) | 실험대 조작 UI · 확대 뷰 · 어포던스 | `node scripts/check-bench.mjs` |
| [T05](T05-notebook.md) | 탐구 노트 7단계 · 문자열 | `npm run check` |
| [T06](T06-grading.md) | 서술형 첨삭 — 소재 목록 | `node scripts/check-grading.mjs` |
| [T07](T07-difficulty.md) | 난이도 세 단계 | `npm run check` |
| [T08](T08-report.md) | 보고서 | `node scripts/check-bench.mjs` |
| [T09](T09-build.md) | 배포본 확인 | `node scripts/check-build.mjs` |
| [T10](T10-manifest.md) | 매니페스트 · 문서 정리 | `node --test tests/manifest.test.js` |

## 이 실험에서 흔들면 안 되는 것

카드마다 되풀이해 적지 않습니다. **전부 `AGENTS.md` §2.5 에 있습니다.** 요약만:

- **종이 크로마토그래피**다. TLC 가 아니다 — 띠 순서가 종이의 순서라서
- 전개액 **석유에터:아세톤 = 9:1**, 추출액 **메탄올:아세톤 = 3:1**
- 카로틴 **주황** · 잔토필 **노랑** · 엽록소 a **청록** · 엽록소 b **황록**
- **Rf 는 출처가 있다** (Pearson CP11, 우리와 같은 9:1 용매계). 다만 **화면에는 말하지 않는다** — 재는 것은 학생이다
- 거름종이 **2 × 10 cm**(국내 상용 20 × 400 mm 에서 자름), 원점 **아래에서 2.5 cm**
- 전개 물리는 **Washburn** — 전선 거리 ∝ √시간

## 카드 쓰는 본

`docs/banana-tasks/` 에 바나나랩의 카드가 있습니다. 형식을 그대로 베끼세요.
`docs/banana-progress.md` 는 **함정 사례집**입니다 — 막혔을 때 여기부터 찾아보세요.
