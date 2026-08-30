# tasks/ — 이 실험의 작업 카드

「발아 중인 콩의 물질대사 — 대조 실험」(id `germination`) 을 만드는 순서다.
**번호순으로 하나씩** 끝내고, 카드마다 적힌 검증 명령을 실제로 돌려 통과를 본 뒤 커밋한다.
카드 하나가 커밋 하나다.

바나나랩의 카드는 `docs/banana-tasks/` 에 있다. 그것은 **바나나 실험의 것**이라
여기 번호와 겹치지 않게 옮겨 두었을 뿐이고, 이 실험의 지시가 아니다.

| 카드 | 무엇 | 검증 |
|---|---|---|
| ✅ [T00](T00-nameplates.md) | 이름표 — 제목·머리말·방침·하네스 | `npm run check` · `/harness.html` 이 열린다 |
| ✅ [T01](T01-state-rules.md) | 상태 모델 · 대사 모형 · 규칙 엔진 | `npm run check` |
| ✅ [T02](T02-assets.md) | 애셋 넷 — 챔버·센서·콩 통·숟가락 | `npm run check:art` |
| ✅ [T03](T03-result-render.md) | 결과 화면 — 챔버 그림 + 그래프 | `npm run check` · `npm run shot` |
| ✅ [T04](T04-bench-ui.md) | 실험대 조작 UI · 확대 뷰(센서 깊이) | `node scripts/check-bench.mjs` |
| ✅ [T05](T05-notebook.md) | 탐구 노트 7단계 · 절차 판정표 | `npm run check` |
| ✅ [T06](T06-report-privacy.md) | 보고서 · 개인정보처리방침 제2조 · 첨삭 | `npm run check` · `node scripts/check-grading.mjs` |
| ✅ [T07](T07-levels-manifest.md) | 난이도 세 단계 · 매니페스트 · 배포본 | `npm run check` · `node scripts/check-build.mjs` |

## 이 실험에서 특히 조심할 것

1. **막지 않는다.** 콩을 안 넣고 밀봉해도, 센서를 콩에 파묻어도 진행된다.
   결과(챔버 그림·그래프)가 대신 말한다. 하드 게이트는 두 종류뿐이다 (AGENTS.md §2.1).
2. **확정 안 된 수치를 사실처럼 적지 않는다.** 콩의 양(g)·챔버 부피(mL)·측정 시간은
   교과서에서 확인하지 않았다. `src/sim/metabolism.js` 에서 `[사실]` 과
   `[모형] [확인 필요]` 를 갈라 적고, **화면 문구에는 g·mL 을 쓰지 않는다.**
   학생이 정하는 양은 **숟갈 수**다 — 그것은 학생이 한 조작이지 인용한 수치가 아니다.
3. **결과는 그림이 몸통, 그래프가 보조다.** 그래프만 남으면 이 실험은 그래프 뷰어가 된다.
