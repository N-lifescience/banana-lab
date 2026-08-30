# tasks/ — 이 실험의 작업 카드

**T00~T13 전부 끝났다.** 각 카드에서 무엇을 왜 그렇게 했는지는 `PROGRESS.md` 에 있다.

번호순으로 진행한다. 카드 하나를 끝낼 때마다 **검증 명령을 실제로 실행해서** 통과를 확인하고
커밋한다. 카드에 없는 일을 하고 싶으면 먼저 카드를 추가한 뒤 진행한다.

바나나랩(참조 구현)의 카드는 `docs/banana-tasks/` 에 있다. **이 실험의 규칙이 아니다** —
함정 사례집으로만 읽는다.

| 카드 | 무엇 | 검증 명령 | 왜 이 순서인가 |
|---|---|---|---|
| [T00](T00-relabel.md) | 이름표 · 하네스 · 반응 속도 모형 | `npm run check` | 이름표가 바나나면 그 뒤 판단이 전부 틀린 전제 위에 선다 |
| [T01](T01-state-and-rules.md) | 상태 모델 · 규칙표 · 규칙 엔진 | `npm run check` | 화면 없이 규칙부터. 여기가 흔들리면 전부 흔들린다 |
| [T02](T02-assets.md) | 애셋 — 이 실험의 기구 | `npm run check:art -- <이름>` | 계약을 먼저 박고 그림은 갈아 끼운다. 병렬로 돌리기 좋다 |
| [T03](T03-result-renderer.md) | 결과 렌더러 — 비커와 떠오르는 원반 | `npm run shot` | 규칙과 애셋이 있어야 결과를 그린다 |
| [T04](T04-variable-design-ui.md) | **변인 설계 UI** (조작·통제·종속) | `node scripts/check-screen.mjs` | 이 실험의 몸통. fermentation 이 그대로 재활용한다 |
| [T05](T05-bench-ui.md) | 실험대 조작 UI + 어포던스 | `node scripts/check-screen.mjs` | 어포던스까지 **한 카드로**. 기능만 넣고 끝내지 않는다 |
| [T06](T06-graph.md) | 결과 그래프 — 조건 대 시간 | `node scripts/check-screen.mjs` | 통제변인이 어긋난 시행이 **여기서** 대답한다 |
| [T07](T07-notebook.md) | 탐구 노트 7단계 | `npm run check` | 7단계를 조작 절차로 납작하게 만들지 않는다 |
| [T08](T08-grading.md) | 서술형 채점 — 소재 목록 | `node scripts/check-grading.mjs` | **바깥에서 쓴 문장**으로 검사해야 뜻이 있다 |
| [T09](T09-progress.md) | 절차 판정표 (`progress.js`) | `node --test tests/progress.test.js` | 노트가 받아쓰기가 되지 않게 하는 것 |
| [T10](T10-report.md) | 보고서 | `node scripts/check-screen.mjs` | 개인정보 규칙은 **절대 바꾸지 않는다** |
| [T11](T11-levels.md) | 난이도 세 단계 | `npm run check` | 마지막에 가깝게. 앞이 흔들리면 여기서 다 뒤집힌다 |
| [T12](T12-build.md) | 배포본 확인 | `node scripts/check-build.mjs` | 통과하는 테스트는 증거가 아니다 |
| [T13](T13-manifest.md) | 매니페스트 | `node --test tests/manifest.test.js` | 5분. 없으면 합칠 때 사람이 되짚어 쓴다 |

## 지금 도는 검사

| 명령 | 무엇 | 커밋 게이트 |
|---|---|---|
| `npm run check` | 규칙·계약·문자열·개인정보 — 210개 | **예** |
| `node scripts/check-screen.mjs` | **눈에 보이는가** · 대비 · 잡는 크기 · 세 난이도 | 아니오 |
| `node scripts/check-grading.mjs` | 서술형 첨삭 — 바깥에서 던지는 문장 | 아니오 |
| `node scripts/check-build.mjs` | 배포본 — 25가지 (`npm run preview` 뒤에) | 아니오 |

## 카드마다 지키는 것

- **검사를 새로 넣으면 되돌려서 실제로 실패하는지 확인한다.** 되돌려도 통과하는 검사는
  없는 것보다 나쁘다 — 사람을 안심시키니까
- `npm run check` 에는 **기계로 확실히 판정되는 것만** 넣는다. 브라우저로 봐야 아는 것은
  `scripts/check-*.mjs` 로 뺀다
- 하드 게이트를 새로 추가하지 않는다. 두 종류뿐이고, 그때도 **어디로 가야 하는지까지** 말한다
- 확정 안 된 수치는 `[확인 필요]` 로 표시한다. **설명용 예시로도 쓰지 않는다**
- 끝낼 때 `PROGRESS.md` 에 한 절을 쓴다
