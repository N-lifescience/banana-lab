# T09 · 배포본 확인

## 목표

빌드한 것이 실제로 도는지 본다. 개발 서버에서 도는 것으로는 알 수 없다.

## 건드릴 파일

```
scripts/check-build.mjs    이 실험에 맞게 확인 항목만
vercel.json
```

## 합격 기준

- [ ] `npm run build` 경고 없이 끝난다
- [ ] `node scripts/check-build.mjs` 통과
- [ ] 배포본에서 콘솔 에러 0건
- [ ] `git config user.email` 이 비어 있지 않다 —
      비면 Vercel 이 배포를 **`blocked`** 로 막고, **로컬에서는 아무 이상이 없다**

## 검증

```bash
npm run build && npm run preview      # 다른 터미널에서
node scripts/check-build.mjs
git config user.email
```
