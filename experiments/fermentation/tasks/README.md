# tasks/ — 이 실험의 작업 카드

**T00~T10 전부 끝났다.** 각 카드에서 무엇을 왜 그렇게 했는지는 `PROGRESS.md` 에 있다.
선생님이 직접 플레이하며 볼 것은 `PLAYTEST.md` 에 있다.

번호순으로 진행한다. 카드 하나를 끝낼 때마다 **검증 명령을 실제로 실행해서** 통과를 확인하고
커밋한다. 카드에 없는 일을 하고 싶으면 먼저 카드를 추가한 뒤 진행한다.

바나나랩(참조 구현)의 카드는 `docs/banana-tasks/` 에 있다. **이 실험의 규칙이 아니다** —
함정 사례집으로만 읽는다.

| 카드 | 무엇 | 검증 명령 | 왜 이 순서인가 |
|---|---|---|---|
| [T00](T00-relabel.md) | 이름표 — 문서 · HTML 머리말 · 방침 | `npm run check` | 이름표가 남의 것이면 그 뒤 판단이 전부 틀린 전제 위에 선다 |
| [T01](T01-state-and-rules.md) | 상태 모델 · 발효 모형 · 규칙 엔진 | `npm run check` | 화면 없이 규칙부터. 여기가 흔들리면 전부 흔들린다 |
| [T02](T02-assets.md) | 애셋 — 발효관 · 솜마개 · 항온기 | `npm run check:art` | 계약을 먼저 박고 그림은 갈아 끼운다 |
| [T03](T03-result-renderer.md) | 결과 렌더러 — 맹관부에 모이는 기체 | `npm run check` | 규칙과 애셋이 있어야 결과를 그린다 |
| [T04](T04-variable-design-ui.md) | 변인 설계 UI (조작·통제·종속) | `node scripts/check-screen.mjs` | catalase 와 **같은 손짓**이어야 한다 |
| [T05](T05-bench-ui.md) | 실험대 조작 UI + 어포던스 | `node scripts/check-screen.mjs` | 어포던스까지 **한 카드로** |
| [T06](T06-graph.md) | 결과 그래프 — 조건 대 기체 발생량 | `node scripts/check-screen.mjs` | 어긋난 시행이 **여기서** 대답한다 |
| [T07](T07-notebook.md) | 탐구 노트 7단계 · 절차 판정표 | `npm run check` | 7단계를 조작 절차로 납작하게 만들지 않는다 |
| [T08](T08-grading.md) | 서술형 채점 — 소재 목록 | `node scripts/check-grading.mjs` | **바깥에서 쓴 문장**으로 검사해야 뜻이 있다 |
| [T09](T09-report-privacy.md) | 보고서 · 개인정보처리방침 | `npm run check` | 방침 제2조는 실제 payload 와 **기계로** 맞댄다 |
| [T10](T10-levels-and-manifest.md) | 난이도 세 단계 · 매니페스트 · 배포본 | `node scripts/check-build.mjs` | 앞이 흔들리면 여기서 다 뒤집힌다 |

## 카드마다 지키는 것

- **잘못된 조작을 막지 않는다.** 결과가 대신 답한다. 하드 게이트는 두 종류뿐이고
  (할 수 없는 일 · 깨진 기구), 그 둘은 **빠져나갈 길을 문장에 담는다**
- **검사를 새로 넣으면 되돌려서 실제로 실패하는지 확인한다.** 그리고 **맞는 값에 초록불인지**까지
  본다. 맞는 일에 검사가 막아서면 사람은 검사를 꺼 버린다
- **되돌리기 전에 먼저 커밋한다** — `git checkout` 이 커밋 안 한 다른 수정까지 날린다
- **확정 안 된 수치는 예시로도 쓰지 않는다.** `[확인 필요]` 로 표시한다

## 지금 도는 검사

| 명령 | 무엇 | 커밋 게이트 |
|---|---|---|
| `npm run check` | 규칙·계약·문자열·개인정보 — 241개 | **예** |
| `node scripts/check-screen.mjs` | **눈에 보이는가** · 대비 · 잡는 크기 · 세 난이도 (개발 서버) | 아니오 |
| `node scripts/check-grading.mjs` | 서술형 첨삭 — **바깥에서 던지는 문장** | 아니오 |
| `node scripts/check-build.mjs` | 배포본 — 25가지 (`npm run build && npm run preview` 뒤에) | 아니오 |
