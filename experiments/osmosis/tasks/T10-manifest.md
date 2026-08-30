# T10 · 매니페스트 (5분)

## 목표

`src/manifest.js` 를 이 실험 것으로 채운다. 화면에 안 쓰이지만 **없으면 합칠 때
사람이 되짚어 써야 한다.**

## 건드릴 파일

```
src/manifest.js
tests/manifest.test.js
```

## 채울 것

- `id` — **`osmosis`**. 주소가 되고 **한 번 정하면 못 바꾼다**
  (교사가 만든 링크가 학습지에 인쇄돼 나간다)
- `summary` — 카드 한 문장. **결과를 적지 않는다.** 목록 화면이 답을 먼저 말하면 안 된다
- `skeleton` — `'microscope-slide'`
- `levels` · `modes`
- `curriculum` — **목록이다.** 중학교 과학에도 생명과학Ⅰ에도 나온다.
  **쪽수를 모르면 `null`.** 지어낸 쪽수는 없는 쪽수보다 나쁘다

## 합격 기준

- [ ] `validateManifest(manifest)` 가 빈 배열을 돌려준다
- [ ] `summary` 에 「원형질 분리」 같은 **결과**가 적혀 있지 않다
- [ ] 확인 못 한 쪽수가 `null` 이다

## 검증

```bash
node --test tests/manifest.test.js
```
