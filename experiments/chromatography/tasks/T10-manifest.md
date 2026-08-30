# T10 · 매니페스트 · 문서 정리 (마지막, 5분)

화면에 안 쓰이는 파일이라 잊기 쉬운데, **합칠 때 이게 없으면 사람이 되짚어 써야 한다.**

## `src/manifest.js`

| 칸 | 값 |
|---|---|
| `id` | `chromatography` — **한 번 정하면 못 바꾼다** (학습지에 인쇄돼 나간다) |
| `title` | `UI.appTitle` (두 곳에 적으면 언젠가 달라진다) |
| `summary` | 카드 한 문장. **결과를 적지 않는다** — 목록 화면이 답을 먼저 말하면 안 된다 |
| `skeleton` | `separation` — 「분리 — 띠·층으로 읽는 결과」. 이미 `SKELETONS` 에 있다 |
| `levels` | `[1, 2, 3]` |
| `modes` | `['solo', 'group']` |
| `curriculum` | **목록이다.** 쪽수를 모르면 `null` — 지어낸 쪽수는 없는 쪽수보다 나쁘다 |

## 문서 정리

- `docs/00-overview.md` — 이 실험의 개요로
- `docs/05-fov-renderer.md` → `docs/05-strip-renderer.md` (`AGENTS.md` §5 의 지도도 함께)
- `docs/08-roadmap.md` — 완성 판정 체크리스트
- `PROGRESS.md` — 카드마다 한 절씩 채워져 있는지 확인

## 합격 기준

- [ ] `node --test tests/manifest.test.js` 통과
- [ ] `summary` 에 결과(색 띠 넷)가 적혀 있지 않다
- [ ] `AGENTS.md` §5 의 문서 지도가 실제 파일 이름과 맞다
- [ ] `PROGRESS.md` 에 카드별 기록이 있다

## 검증 명령

```bash
node --test tests/manifest.test.js
npm run check
```
