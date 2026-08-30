# T08 — 서술형 첨삭

비용은 **비대칭**이다. 맞는 답을 부족하다고 하는 쪽이 훨씬 비싸다.

- 소재(subject)로 본다. 길이는 공백 뺀 글자 수.
- 결과는 `pass` / `more` / `unavailable` 셋. **틀렸다는 판정은 없다.**
- **바깥에서 만든 학생 문장**으로 검사한다 (`tests/grading.holdout.test.js`).
  구현한 사람이 자기 키워드를 보고 만든 문장은 아무것도 검증하지 못한다.

## 검증

```bash
node scripts/check-grading.mjs
node --test tests/grading.holdout.test.js
```
