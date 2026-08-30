# T00 — 이름표를 이 실험 것으로

## 목표
바나나랩 복제본에 남은 이름표를 전부 갈아 끼운다. **가장 먼저 한다** — 여기가 남의 것이면
그 뒤로 읽고 판단하는 것이 전부 틀린 전제 위에 선다.

## 건드릴 파일
- `README.md` · `CLAUDE.md` · `AGENTS.md` §1·§2.5 · `package.json` 의 `description`
- `index.html` · `teacher.html` · `privacy.html` 의 `<title>` · `og:title` · `og:description`
  - **`canonical` · `og:url` 은 아예 뺀다.** 배포 주소가 안 정해졌다. 틀린 주소는 없는 주소보다 나쁘다
- `privacy.html` 본문 첫 줄과 **제2조 수집 항목**
- `harness.html` · `src/harness.js` — 바나나 상태를 읽어 **열면 죽는다**
- `tests/pages.test.js` 의 `OTHER_MATERIALS` — 이 실험에 **없는** 낱말로

## 합격 기준
- [ ] 세 페이지의 `<title>` 이 `UI.appTitle` 을 담는다
- [ ] 배포되는 페이지에 다른 실험의 재료 낱말이 없다
- [ ] `canonical`·`og:url` 이 없다
- [ ] `/harness.html` 이 콘솔 에러 없이 열린다

## 검증
```bash
npm run check
npm run dev   # http://localhost:5173/experiments/fermentation/harness.html 를 실제로 연다
```
