# T10 — 난이도 세 단계 · 매니페스트 · 배포본

## 목표
**난이도는 설명만 줄인다. 할 수 있는 일은 세 단계가 똑같다.**
그리고 `src/manifest.js` 를 채운다 — 화면에 안 쓰이지만 없으면 합칠 때 사람이 되짚어 쓴다.

## 매니페스트에 채울 것
`id`(=`fermentation`, 주소가 되고 못 바꾼다) · `summary`(**결과를 적지 않는다**) ·
`skeleton` · `levels` · `modes` · `curriculum`(목록이다).
**쪽수를 모르면 `null`.** 지어낸 쪽수는 없는 쪽수보다 나쁘다.

## 검증
```bash
npm run check
node --test tests/manifest.test.js
npm run build && npm run preview &   # 그다음
node scripts/check-build.mjs
```
