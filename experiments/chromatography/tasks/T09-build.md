# T09 · 배포본 확인

**통과하는 테스트는 증거가 아니다.** 바나나랩에서 테스트 140개가 통과하는 동안
앱이 아예 뜨지 않은 적이 있다 (주석 안의 백틱 하나가 템플릿 리터럴을 끊었다).

## 할 일

```bash
npm run build
npm run preview            # 다른 터미널에서
node scripts/check-build.mjs
```

## 합격 기준

- [ ] `dist/` 가 만들어지고 `npm run preview` 로 열린다
- [ ] 콘솔 에러 0건
- [ ] `node scripts/check-build.mjs` 통과
- [ ] `/harness.html` 도 함께 확인 (개발 전용이라 빌드에서 빠져도 된다 — 어느 쪽인지 확인만)
- [ ] `AIza…` · `sk-…` · `gho_…` 형태 문자열이 없다

## 커밋 전 — 작성자 이메일

```bash
git config user.email      # 비어 있으면 Vercel 이 배포를 통째로 막는다
```

`CLAUDE.md` 의 마지막 절을 읽는다. **로컬에서는 아무 이상이 없어 아무도 모른다.**

## 검증 명령

```bash
npm run build && node scripts/check-build.mjs
```
