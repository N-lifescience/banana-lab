# T11 — 매니페스트 · 문서 · 진행 기록

`src/manifest.js` 를 채운다. 화면에 안 쓰이지만 **없으면 합칠 때 사람이 되짚어 쓴다.**

- `id: 'centrifuge'` — 주소가 되고 학습지에 인쇄돼 나간다. 한 번 정하면 못 바꾼다.
- `skeleton: 'separation'` — 섞인 것을 나눈다. 결과가 **위치**로 나온다.
- `summary` 에 **결과를 적지 않는다.** 목록 화면이 답을 먼저 말하면 안 된다.
- `curriculum` — 「세포와 물질대사」 **24쪽**. 판본은 `[확인 필요]` 라 `publisher: null`.

`docs/00-overview.md` · `docs/04-interaction-rules.md` · `docs/05-*` 를 이 실험 것으로.
`PROGRESS.md` 에 카드마다 무엇을 왜 했는지 한 절씩.

## 검증

```bash
node --test tests/manifest.test.js
npm run check
```
