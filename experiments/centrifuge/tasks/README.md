# 작업 카드 — 간이 원심분리기 · 혈액 원심분리 (`centrifuge`)

번호순으로 하나씩 끝낸다. **카드 하나가 커밋 하나다.**
카드마다 「검증」에 적힌 명령을 실제로 돌려 통과를 본 뒤에 커밋한다.

바나나랩의 카드는 `docs/banana-tasks/` 에 있다. 그것은 바나나 실험의 것이고 여기 번호와 무관하다.

| 카드 | 무엇 | 검증 |
|---|---|---|
| [T00](T00-nameplates.md) | 이름표 — 문서 · HTML 머리말 · 검사 낱말 목록 | `node --test tests/pages.test.js` |
| [T01](T01-spin-and-blood.md) | 물리와 사실 — `spin.js` (회전·침강·혈액 층) | `node --test tests/spin.test.js` |
| [T02](T02-rules.md) | 상태 모델 · 규칙 엔진 · 품질 | `npm run check` |
| [T03](T03-assets.md) | 애셋 + 하네스 | `npm run check:art` |
| [T04](T04-tube-renderer.md) | 결과 렌더러 — 모세관의 층 | `node --test tests/tube.test.js` |
| [T05](T05-bench-ui.md) | 실험대 조작 UI · 어포던스 | `node scripts/check-bench.mjs` |
| [T06](T06-zoom-pull.md) | 확대 뷰 — **끈을 당기는 리듬** | `node scripts/check-ui.mjs` |
| [T07](T07-notebook.md) | 탐구 노트 7단계 · 절차 판정 | `npm run check` |
| [T08](T08-grading.md) | 서술형 첨삭 (바깥 문장) | `node scripts/check-grading.mjs` |
| [T09](T09-report-privacy.md) | 보고서 · 개인정보처리방침 제2조 | `node --test tests/privacy.test.js` |
| [T10](T10-difficulty-build.md) | 난이도 세 단계 · 배포본 | `node scripts/check-build.mjs` |
| [T11](T11-manifest.md) | 매니페스트 · 문서 · 진행 기록 | `node --test tests/manifest.test.js` |

## 이 실험에서 특히 조심할 것

- **회전판은 모세관을 수평으로 문다.** 「아래」는 회전 **바깥쪽** 끝이고, 혈장은 **축 쪽**이다.
  그리는 사람도 규칙을 쓰는 사람도 여기서 뒤집는다.
- **회전 시간과 당김 횟수의 구체적 수치는 `[확인 필요]` 다.** 화면에 시계를 띄우지 않는다.
- **적혈구층은 암적색**이고 **연층은 회백색**이다. 채혈 순간의 핏방울만 선홍이다.

---

## 진행 상황

| 카드 | 커밋 |
|---|---|
| T00 | 이름표 |
| T01 | 회전 물리와 혈액의 층 |
| T02~T07 | 엔진 갈아 끼우기 (한 커밋 — 중간에서 끊으면 검사가 빨간불인 커밋이 남는다) |
| T10 | 브라우저 검사 넷과 난이도 |
| T11 | 매니페스트 · 문서 · 진행 기록 · PLAYTEST |

무엇을 왜 고쳤는지는 `PROGRESS.md` 에 있다.
사람이 직접 플레이해 볼 목록은 `PLAYTEST.md` 에 있다.
